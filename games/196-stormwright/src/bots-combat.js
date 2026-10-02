// Bot 戰鬥：感知（視錐＋視線＋聽覺）、武器選擇、瞄準誤差、開火節奏、受擊時蓋牆／箱子／斜坡、遠處簡化結算。
import * as THREE from 'three';
import { clamp, angleDiff } from './shared.js';
import { weaponStat, falloffMul } from './items.js';

// ---- 可調參數（改這裡就能調整整體難度與對戰節奏）----
export const TUNE = {
  aimBase: 0.020,        // 技能 1.0 時的角度誤差基底（弧度）
  aimSkill: 0.060,       // 技能 0 時額外的誤差
  aimDist: 80,           // 距離每增加這麼多公尺，誤差 ×2
  turnBase: 3.2,         // 視角追蹤速度（rad/s）= turnBase + turnSkill*skill
  turnSkill: 7.5,
  visBase: 80, visSkill: 70,     // 視距
  fov: 2.0,              // 視錐全角（弧度）
  memory: 4.0,           // 失去視線後記得目標的秒數
  hearRange: 120,
  // 各階段的交戰意願（storm.phase 0..6）。越晚越願意主動找人打。
  phaseAggr: [0.22, 0.28, 0.4, 0.5, 0.7, 1.1, 1.6],
  initP: [0.06, 0.08, 0.09, 0.09, 0.12, 0.2, 0.4],   // 看到敵人時主動開戰的機率（依風暴階段）
  rangeOf: { pump: 22, smg: 42, ar: 70, sniper: 150, pistol: 32 },
  // 簡化結算用的 dps 表 [距離, 每秒傷害]（技能 0.55、稀有度 1；由 tools/check-bots.mjs --only dps 實測）
  simDps: {
    ar: [[6, 26], [12, 19], [20, 19], [35, 10.5], [55, 9.5], [80, 6], [120, 0.6], [170, 0.2]],
    smg: [[6, 54], [12, 35], [20, 16], [35, 9.6], [55, 7.7], [80, 4.8], [120, 0.6], [170, 0]],
    pump: [[6, 38], [12, 37], [20, 34], [35, 27], [55, 20], [80, 10], [120, 0.3], [170, 0]],
    pistol: [[6, 43], [12, 39], [20, 18], [35, 9.2], [55, 8.5], [80, 5.5], [120, 2.4], [170, 0]],
    sniper: [[6, 28], [12, 28], [20, 27], [35, 30], [55, 25], [80, 12], [120, 3], [170, 0.7]],
  },
  simRate: { ar: 4.3, smg: 6.5, pump: 0.67, pistol: 2.8, sniper: 0.35 },   // 簡化結算每秒耗彈數（實測）
  lodDist: 150,          // 距離玩家小於此值的 bot 真的開槍
};
const WBASE = {
  pump: (d) => (d < 7 ? 10 : d < 12 ? 8 : d < 18 ? 4 : d < 25 ? 1.5 : 0.3),
  smg: (d) => (d < 8 ? 7 : d < 25 ? 8 : d < 40 ? 6 : 2.5),
  ar: (d) => (d < 8 ? 6 : d < 60 ? 8 : d < 100 ? 6.5 : 4.5),
  sniper: (d) => (d < 25 ? 1 : d < 50 ? 3 : d < 90 ? 8 : 10),
  pistol: (d) => (d < 15 ? 4 : 2.5),
};
export const WVALUE = { ar: 10, pump: 8.5, smg: 8, sniper: 7.5, pistol: 3.5 };
const _e = new THREE.Vector3(), _t = new THREE.Vector3();
const DX = [0, 1, 0, -1], DZ = [-1, 0, 1, 0];

export const CombatMixin = {
  // ---------- 背包摘要 ----------
  refreshInv() {
    const inv = this.a.inventory, s = this.inv || (this.inv = {});
    s.guns = []; s.heal = [];
    inv.slots.forEach((it, i) => {
      if (!it) return;
      if (it.kind === 'weapon') s.guns.push({ slot: i + 1, it, st: weaponStat(it) });
      else if (it.kind === 'consumable') s.heal.push({ slot: i + 1, it });
    });
    s.mats = inv.mats.wood + inv.mats.stone + inv.mats.metal;
    s.hasGun = s.guns.some((g) => g.it.mag > 0 || inv.ammo[g.st.ammo] > 0);
    return s;
  },
  pickMat(n) {
    const inv = this.a.inventory, m = inv.mats;
    for (const k of ['wood', 'stone', 'metal']) if (m[k] >= n) { inv.buildMat = k; return true; }
    return false;
  },
  weaponScore(g, d) {
    const inv = this.a.inventory, it = g.it, st = g.st;
    if (it.mag <= 0 && inv.ammo[st.ammo] <= 0) return -1;
    let s = WBASE[it.defId](d) * (1 + 0.12 * it.rarity);
    if (it.mag <= 0) s *= it.defId === 'sniper' ? 0.3 : 0.55;
    if (inv.selected === g.slot) s += 0.7;
    return s;
  },
  bestGun(d) {
    let best = null, bs = 0;
    for (const g of this.inv.guns) { const s = this.weaponScore(g, d); if (s > bs) { bs = s; best = g; } }
    return best;
  },
  curGun() {
    const it = this.a.inventory.current();
    return it && it.kind === 'weapon' && it.defId !== 'pickaxe' ? { it, st: weaponStat(it), slot: this.a.inventory.selected } : null;
  },
  // ---------- 感知 ----------
  perceive() {
    const c = this.ctx, a = this.a, now = c.time.now, T = TUNE;
    a.eyePos(_e);
    const cur = this.curGun();
    const vis = T.visBase + T.visSkill * this.skill + (cur && cur.it.defId === 'sniper' ? 60 : 0);
    let best = null, bs = 1e9;
    for (const o of c.actors) {
      if (o === a || !o.alive || o.state === 'bus' || o.state === 'skydive' || o.state === 'glide') continue;
      const dx = o.pos.x - a.pos.x, dz = o.pos.z - a.pos.z, d2 = dx * dx + dz * dz;
      let range = vis;
      if (o === this.foe) range *= 1.35;
      if (d2 > range * range) continue;
      const d = Math.sqrt(d2);
      if (d > 8 && o !== this.foe) {
        const ang = Math.abs(angleDiff(a.yaw, Math.atan2(-dx, -dz)));
        if (ang > T.fov * 0.5) continue;
      }
      o.headCenter(_t);
      if (!c.physics.lineOfSight(_e, _t)) {
        _t.set(o.pos.x, o.pos.y + 0.6, o.pos.z);
        if (!c.physics.lineOfSight(_e, _t)) continue;
      }
      let sc = d; if (o === this.foe) sc -= 25; if (o === this.hitBy && now - this.hitAt < 4) sc -= 15;
      if (sc < bs) { bs = sc; best = o; }
    }
    this.seeing = best;
    if (best) {
      if (this.foe !== best) { this.foe = best; this.firstSeen = now; this.trackQ = 0; this.engaged = false; this.burstLeft = 0; }
      this.lastSeen = now; this.seenX = best.pos.x; this.seenY = best.pos.y; this.seenZ = best.pos.z;
      this.lastEnemySeen = now;
    } else if (this.foe && (!this.foe.alive || now - this.lastSeen > T.memory)) { this.foe = null; this.engaged = false; }
    // 受擊／聽見槍聲：沒看到敵人也轉向來源
    if (!this.foe && this.hitBy && now - this.hitAt < 2.5 && this.hitBy.alive) {
      const o = this.hitBy, jit = Math.hypot(o.pos.x - a.pos.x, o.pos.z - a.pos.z) > 60 ? 10 : 2;
      this.foe = o; this.firstSeen = now - 0.1; this.lastSeen = now; this.trackQ = 0;
      this.seenX = o.pos.x + (Math.random() - 0.5) * jit; this.seenY = o.pos.y; this.seenZ = o.pos.z + (Math.random() - 0.5) * jit;
    }
    return best;
  },
  // 是否值得／願意交戰
  wantFight(o, d) {
    const c = this.ctx, a = this.a, now = c.time.now, T = TUNE, st = c.storm;
    const inv = this.inv;
    if (!inv.hasGun) return d < 2.8 && now - this.hitAt < 4;
    if (this.fleeUntil > now) return false;
    const rc = this.pass.get(o);
    if (rc && rc.cool > now) return false;
    const attacked = this.hitBy === o && now - this.hitAt < 5;
    // 第一次看到某人時擲骰決定要不要主動開戰（被打則一定還擊）
    if (!attacked) {
      const rec = this.pass.get(o);
      if (rec === undefined || rec.until < now) {
        const ph = Math.min(6, st.active ? st.phase : 0);
        const fight = Math.random() < clamp(T.initP[ph] * (0.45 + 0.8 * this.aggr) * this.bots.pace, 0, 1);
        this.pass.set(o, { fight, until: now + (fight ? 25 : 8 + Math.random() * 8) });
      }
      const r2 = this.pass.get(o);
      if (!r2.fight && r2.until > now) return false;
    }
    const g = this.bestGun(d) || this.curGun();
    const key = g ? (g.it ? g.it.defId : g.defId) : 'pistol';
    const phase = st.active ? st.phase : 0;
    let range = (T.rangeOf[key] || 40) * T.phaseAggr[Math.min(6, phase)] * (0.65 + 0.7 * this.aggr) * clamp(Math.sqrt(this.bots.pace), 0.45, 1.6);
    if (now - this.landedAt < 20 && !attacked) range *= 0.5;  // 剛落地先搜刮
    if (attacked) range = Math.max(range, 60) * 1.2;
    if (this.engaged) range *= 1.35;
    const hp = a.health + a.shield * 0.7;
    if (hp < 38 && !attacked && !this.engaged) return false;
    return d < range;
  },
  // ---------- 瞄準誤差 ----------
  aimSigma(d, o, cur) {
    const T = TUNE, sk = this.skill;
    const spd = Math.hypot(o.vel.x, o.vel.z), own = Math.hypot(this.a.vel.x, this.a.vel.z);
    let s = (T.aimBase + (1 - sk) * T.aimSkill) * (0.55 + d / T.aimDist);
    s *= 1 + Math.min(1, spd / 6) * 0.55 + Math.min(1, own / 6) * 0.4;
    s *= 1.9 - 1.1 * this.trackQ;
    if (cur && cur.it.defId === 'sniper') s *= 0.2;
    if (cur && cur.it.defId === 'pump') s *= 0.6;
    return s;
  },
  // ---------- 每個固定步：視角追蹤、瞄準點、開火 ----------
  stepAim(dt) {
    const a = this.a, I = a.intent, now = this.ctx.time.now, L = this.look;
    let wy, wp, rate = L.rate;
    if (L.mode === 'target' && L.tgt && L.tgt.alive) {
      const o = L.tgt; a.eyePos(_e);
      const dxz = Math.hypot(o.pos.x - a.pos.x, o.pos.z - a.pos.z);
      let tx = o.pos.x, ty = o.pos.y + (o.crouching ? 0.7 : L.hy), tz = o.pos.z;
      const cur = L.cur;
      if (cur && cur.it.defId === 'sniper') {
        const tf = dxz / 380; tx += o.vel.x * tf; tz += o.vel.z * tf; ty += o.vel.y * tf * 0 + 0.5 * 9 * tf * tf;
      } else { const tf = Math.min(0.12, dxz * 0.0015); tx += o.vel.x * tf * (this.skill > 0.5 ? 1 : 0.4); tz += o.vel.z * tf * (this.skill > 0.5 ? 1 : 0.4); }
      // 瞄準誤差：每 0.25–0.5 s 重新抽樣一次（近似高斯，標準差 = this.sigma），再平滑過去
      this.errClock -= dt;
      if (this.errClock <= 0) {
        const r = Math.random; this.errClock = 0.25 + r() * 0.25;
        this.errTy = (r() + r() + r() - 1.5) * 2 * this.sigma; this.errTp = (r() + r() + r() - 1.5) * 2 * this.sigma * 0.7;
      }
      const k = Math.min(1, dt * 9);
      this.errYaw += (this.errTy - this.errYaw) * k; this.errPitch += (this.errTp - this.errPitch) * k;
      const ty0 = Math.atan2(-(tx - _e.x), -(tz - _e.z)), tp0 = Math.atan2(ty - _e.y, Math.hypot(tx - _e.x, tz - _e.z));
      wy = ty0 + this.errYaw; wp = tp0 + this.errPitch;
      L.dist = Math.hypot(tx - _e.x, ty - _e.y, tz - _e.z);
      L.trueYaw = ty0; L.truePitch = tp0;
    } else { wy = L.yaw; wp = L.pitch; }
    const rr = rate * dt;
    I.yaw += clamp(angleDiff(I.yaw, wy), -rr, rr);
    I.pitch = clamp(I.pitch + clamp(wp - I.pitch, -rr, rr), -1.4, 1.4);
    if (L.mode === 'target' && L.tgt && L.tgt.alive) {
      a.eyePos(_e);
      const cp = Math.cos(I.pitch), D = clamp(L.dist, 4, 300);
      const ap = a.intent.aimPoint || (a.intent.aimPoint = new THREE.Vector3());
      ap.set(_e.x - Math.sin(I.yaw) * cp * D, _e.y + Math.sin(I.pitch) * D, _e.z - Math.cos(I.yaw) * cp * D);
      // 對準判斷：準心離真實目標的角度（換算成公尺）
      const dy = Math.abs(angleDiff(I.yaw, L.trueYaw)), dp = Math.abs(I.pitch - L.truePitch);
      this.missM = Math.hypot(angleDiff(I.yaw, wy) * Math.cos(wp), wp - I.pitch) * L.dist;   // 準心離「自己以為的目標位置」多遠（含誤差，所以不會只挑好時機開槍）
    } else if (!this.noAimOverride) { I.aimPoint = null; this.missM = 99; }
    // 開火（槍）
    if (this.fireMode === 'gun') {
      const cur = L.cur;
      let ok = this.wantFire && now >= this.nextShotAt && this.missM < this.fireTol && this.reactDone(now);
      if (ok && cur && a.action && a.action.kind === 'reload' && !(cur.st.perShell && cur.it.mag > 0)) ok = false;
      I.fire = ok;
    } else if (this.fireMode === 'hold') I.fire = true;
  },
  reactDone(now) { return now - this.firstSeen >= this.reactT; },
  // 'shot' 事件（自己開火後）：決定下一槍的人類節奏
  onShot(weapon) {
    const now = this.ctx.time.now, r = Math.random;
    let gap = 0;
    if (weapon === 'pump') gap = 1 / 0.75 + 0.05 + r() * 0.3;
    else if (weapon === 'sniper') gap = 2.5 + 0.1 + r() * 0.7;
    else if (weapon === 'pistol') gap = 0.17 + r() * 0.22;
    else {
      if (this.burstLeft === undefined || this.burstLeft <= 0) this.burstLeft = 1;
      this.burstLeft--;
      if (this.burstLeft <= 0) {
        const d = this.look.dist || 30;
        const n = d < 22 ? 14 + r() * 16 : d < 55 ? 5 + r() * 6 : 2 + r() * 4;
        this.burstLeft = Math.round(n * (0.7 + this.skill * 0.6));
        gap = (d < 22 ? 0.08 : 0.16) + r() * (d < 22 ? 0.2 : 0.4);
        if (weapon === 'smg') this.burstLeft = Math.round(this.burstLeft * 1.6);
      }
    }
    this.nextShotAt = now + gap;
  },
  // ---------- 交戰 tick ----------
  fightTick(o, d, visible, dt) {
    const c = this.ctx, a = this.a, I = a.intent, inv = a.inventory, now = c.time.now;
    this.state = 'fight';
    const g = this.bestGun(d) || this.curGun();
    // 切槍
    if (g && inv.selected !== g.slot && now - this.switchAt > 0.9) { I.slot = g.slot; this.switchAt = now; }
    const cur = this.curGun();
    const key = cur ? cur.it.defId : null;
    // 瞄準
    this.sigma = this.aimSigma(d, o, cur) * (visible ? 1 : 3);
    this.look.mode = 'target'; this.look.tgt = o; this.look.cur = cur;
    this.look.rate = TUNE.turnBase + TUNE.turnSkill * this.skill;
    this.look.hy = 1.05 + (this.skill > 0.55 && Math.random() < 0.3 ? 0.45 : 0);
    if (visible) this.trackQ = Math.min(1, this.trackQ + dt / 1.6); else this.trackQ = Math.max(0, this.trackQ - dt * 0.5);
    // 開火條件
    this.fireMode = 'gun';
    this.wantFire = visible && !!cur && cur.it.mag > 0 && !a.building && d < (key === 'pump' ? 28 : key === 'smg' ? 55 : key === 'pistol' ? 45 : key === 'ar' ? 120 : 260);
    this.fireTol = key === 'pump' ? 1.5 : key === 'sniper' ? 0.8 : 0.7 + d * 0.008;
    // 子彈打完且沒有備彈 / 彈匣空：換槍或重裝
    if (cur && cur.it.mag <= 0 && !a.action && inv.ammo[cur.st.ammo] > 0 && g && g.slot === cur.slot && !cur.st.perShell) I.reload = true;
    if (cur && cur.st.perShell && cur.it.mag < 2 && !visible && !a.action && inv.ammo[cur.st.ammo] > 0) I.reload = true;
    I.ads = !!cur && ((key === 'sniper') || (d > 28 && key === 'ar' && this.skill > 0.35)) && visible;
    // 移動：保持偏好距離＋側移
    const pref = key === 'pump' ? 6 : key === 'smg' ? 13 : key === 'sniper' ? 70 : key === 'pistol' ? 16 : 26;
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafe = Math.random() < 0.5 ? -1 : 1; this.strafeT = 0.5 + Math.random() * 1.0; if (this.skill > 0.45 && d > 18 && Math.random() < 0.3) this.crouchT = 0.45 + Math.random() * 0.5; }
    this.crouchT -= dt;
    this.moveIntent = false;
    if (!visible) {
      // 把自己關在箱子裡：整備一下就打穿朝向敵人的那面牆
      if (this.coverKind === 'box' && this.coverUntil > now && now > this.boxAt && this.breakOut(o, dt)) return;
      if (cur && cur.it.mag < cur.st.mag * 0.7 && inv.ammo[cur.st.ammo] > 0 && !a.action) I.reload = true;   // 看不到敵人（躲在掩護後）趁機換彈
      // 失去視線：追擊最後位置（有侵略性才追）
      if (this.aggr > 0.5 && (!this.hitBy || now - this.hitAt > 3 || true)) { this.navStep(this.seenX, this.seenZ, d > 20, dt); this.look.mode = 'target'; this.look.yaw = this.look.yaw; }
      this.lookOverride = false;
      I.crouch = false;
      return;
    }
    let mz = 0, mx = this.strafe * (0.55 + this.skill * 0.45);
    if (d > pref + 9) mz = 1; else if (d < pref - 5) mz = -0.7;
    if (key === 'sniper') { mx = d < 45 ? mx : 0; mz = d < 40 ? -1 : 0; }
    if (key === 'ar' && d > 28 && this.skill > 0.5 && now - this.lastHurtAt > 1.2) { mx *= 0.35; }
    if (key === 'pump' && d > 5) mz = 1;
    I.moveZ = mz; I.moveX = mx; I.sprint = mz > 0 && d > pref + 25 && !this.wantFire;
    I.crouch = this.crouchT > 0 && d > 15;
    if (key === 'pump' && d < 10 && Math.random() < 0.02) I.jump = true;
    else if (this.skill > 0.4 && Math.random() < 0.004) I.jump = true;
    // 邊走邊避開障礙
    if (mz !== 0 && this.clearAlong(a.yaw + (mz > 0 ? 0 : Math.PI), 2.2) < 1.0) { I.moveZ = 0; }
    if (Math.abs(mx) > 0 && this.clearAlong(a.yaw + (mx > 0 ? -1.57 : 1.57), 1.4) < 0.8) I.moveX = -mx;
  },
  // 沒槍或不想打的目標：十字鎬近戰（真的沒槍才用）
  meleeTick(o, d, dt) {
    const a = this.a, I = a.intent, inv = a.inventory;
    this.state = 'melee';
    if (inv.selected !== 0) I.slot = 0;
    this.look.mode = 'target'; this.look.tgt = o; this.look.cur = null; this.look.rate = 6; this.look.hy = 1.0;
    this.sigma = 0; this.errTy = this.errTp = 0; this.fireMode = 'off';
    if (d > 1.8) this.navStep(o.pos.x, o.pos.z, true, dt); else { I.moveZ = 0; this.moveIntent = false; }
    I.fire = d < 2.3 && inv.selected === 0;
    this.fireMode = 'off';
  },
  // ---------- 受擊後的蓋牆 ----------
  edgeToward(ux, uz, minT) {
    const a = this.a, x = a.pos.x, z = a.pos.z;
    let ix = Math.floor(x / 4), kz = Math.floor(z / 4);
    const sx = ux > 0 ? 1 : -1, sz = uz > 0 ? 1 : -1;
    const tdx = Math.abs(ux) > 1e-6 ? 4 / Math.abs(ux) : Infinity, tdz = Math.abs(uz) > 1e-6 ? 4 / Math.abs(uz) : Infinity;
    let tx = Math.abs(ux) > 1e-6 ? ((ux > 0 ? (ix + 1) * 4 : ix * 4) - x) / ux : Infinity, tz = Math.abs(uz) > 1e-6 ? ((uz > 0 ? (kz + 1) * 4 : kz * 4) - z) / uz : Infinity;
    for (let n = 0; n < 6; n++) {
      const useX = tx < tz, t = useX ? tx : tz;
      if (t >= minT) return useX ? { i: ix, k: kz, edge: ux > 0 ? 1 : 3 } : { i: ix, k: kz, edge: uz > 0 ? 2 : 0 };
      if (useX) { ix += sx; tx += tdx; } else { kz += sz; tz += tdz; }
    }
    return null;
  },
  planCover(o) {
    const a = this.a, B = this.ctx.build, s = this.inv, now = this.ctx.time.now;
    if (this.bseq || now < this.buildCd || a.state !== 'ground') return false;
    if (s.mats < 10) return false;
    const dx = o.pos.x - a.pos.x, dz = o.pos.z - a.pos.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
    const level = Math.floor((a.pos.y + 0.4) / 3.5);
    const seq = [], r = Math.random();
    const i0 = Math.floor(a.pos.x / 4), k0 = Math.floor(a.pos.z / 4);
    const wall = (e) => ({ piece: 'wall', i: e.i, k: e.k, level, edge: e.edge });
    const fc = this.forceCover;   // 測試用：強制某種掩護
    const box = fc ? fc === 'box' : s.mats >= 60 && this.skill > 0.55 && r < 0.5 * this.skill + 0.1;
    const ramp = fc ? fc === 'ramp' : !box && s.mats >= 50 && this.skill > 0.4 && d > 12 && d < 70 && r > 0.8 && o.pos.y - a.pos.y < 4;
    if (box) {
      const lx = a.pos.x - i0 * 4, lz = a.pos.z - k0 * 4;
      if (Math.min(lx, 4 - lx, lz, 4 - lz) < 0.7) seq.push({ go: [i0 * 4 + 2, k0 * 4 + 2] });
      const toward = this.edgeToward(ux, uz, 0.6) || { i: i0, k: k0, edge: 0 };
      seq.push(wall(toward));
      for (let e = 0; e < 4; e++) if (!(e === toward.edge && toward.i === i0 && toward.k === k0)) seq.push({ piece: 'wall', i: i0, k: k0, level, edge: e });
      seq.push({ piece: 'floor', i: i0, k: k0, level: level + 1 });
      this.coverKind = 'box';
    } else if (ramp) {
      const dir = B.cardinal(Math.atan2(-ux, -uz));
      seq.push({ piece: 'ramp', i: i0 + DX[dir], k: k0 + DZ[dir], level, edge: dir, walk: 1 });
      seq.push({ piece: 'ramp', i: i0 + 2 * DX[dir], k: k0 + 2 * DZ[dir], level: level + 1, edge: dir, walk: 2, needY: a.pos.y + 1.6 });
      seq.push({ piece: 'floor', i: i0 + 3 * DX[dir], k: k0 + 3 * DZ[dir], level: level + 2, walk: 3, needY: a.pos.y + 4.8 });
      seq.push({ piece: 'wall', i: i0 + 3 * DX[dir], k: k0 + 3 * DZ[dir], level: level + 2, edge: dir, walk: 0 });
      this.coverKind = 'ramp';
    } else {
      const e1 = this.edgeToward(ux, uz, 0.9); if (e1) seq.push(wall(e1));
      if (this.skill > 0.45 && s.mats >= 30) { const e2 = this.edgeToward(ux * 0.7 + uz * 0.3, uz * 0.7 - ux * 0.3, 0.9); if (e2 && (!e1 || e2.i !== e1.i || e2.k !== e1.k || e2.edge !== e1.edge)) seq.push(wall(e2)); }
      this.coverKind = 'wall';
    }
    if (!seq.length) return false;
    this.bseq = { steps: seq, idx: 0, t: now + 0.12 + (1 - this.skill) * 0.3, enemy: o, start: now };
    this.coverUntil = now + 14; this.boxAt = now + 2.5 + seq.length * 0.2;
    this.buildCd = now + 6 + Math.random() * 4;
    return true;
  },
  // 執行建造序列。回傳 true 表示 bot 目前被建造佔住（不做別的移動）
  runBuild(dt) {
    const bs = this.bseq; if (!bs) return false;
    const a = this.a, I = a.intent, B = this.ctx.build, now = this.ctx.time.now;
    if (now - bs.start > 9 || a.state !== 'ground' && a.state !== 'air' || bs.idx >= bs.steps.length) { this.bseq = null; return false; }
    const st = bs.steps[bs.idx];
    this.moveIntent = false;
    if (st.go) {
      const d = Math.hypot(st.go[0] - a.pos.x, st.go[1] - a.pos.z);
      if (d < 0.35 || now - bs.start > 2) bs.idx++; else { this.navStep(st.go[0], st.go[1], false, dt); this.moveIntent = false; }
      return true;
    }
    if (st.needY !== undefined && a.pos.y < st.needY - 0.2) {
      // 往斜坡上爬
      const dir = this.look.yaw;
      I.moveZ = 1; I.moveX = 0; this.look.mode = 'yaw'; this.look.pitch = 0.1;
      if (now - bs.start > 6) this.bseq = null;
      return true;
    }
    if (now >= bs.t) {
      this.pickMat(10);
      const p = this.pickMat(10) && B.placeAt(a, st);
      bs.idx++; bs.t = now + 0.1 + Math.random() * 0.1 + (1 - this.skill) * 0.1;
      if (p && st.piece === 'ramp') { I.moveZ = 1; }
    }
    if (st.walk) { I.moveZ = 1; I.moveX = 0; I.jump = false; } else if (!st.walk && st.piece !== 'ramp') { I.moveZ = 0; I.moveX = 0; }
    // 面向敵人
    if (bs.enemy && bs.enemy.alive) { const e = bs.enemy; this.look.mode = 'yaw'; this.look.yaw = Math.atan2(-(e.pos.x - a.pos.x), -(e.pos.z - a.pos.z)); this.look.pitch = 0; this.look.rate = 9; }
    return true;
  },
  // 打穿自己蓋的牆（朝敵人那面），回傳是否正在處理
  breakOut(o, dt) {
    const a = this.a, I = a.intent, inv = a.inventory, B = this.ctx.build;
    let best = null, bs = -9;
    const dx = o.pos.x - a.pos.x, dz = o.pos.z - a.pos.z, dl = Math.hypot(dx, dz) || 1;
    for (const p of B.pieces.values()) {
      if (p.owner !== a || p.dead || p.type !== 'wall') continue;
      const px = p.center.x - a.pos.x, pz = p.center.z - a.pos.z, pl = Math.hypot(px, pz) || 1;
      if (pl > 4) continue;
      const sc = (px * dx + pz * dz) / (pl * dl);
      if (sc > bs) { bs = sc; best = p; }
    }
    if (!best) { this.coverKind = null; return false; }
    const g = this.curGun();
    if (!g || (g.it.mag <= 0 && inv.ammo[g.st.ammo] <= 0)) { if (inv.selected !== 0) I.slot = 0; } else if (inv.selected !== g.slot) { I.slot = g.slot; return true; }
    const ap = this.aimV || (this.aimV = new THREE.Vector3());
    ap.set(best.center.x, a.pos.y + 1.2, best.center.z); I.aimPoint = ap; this.noAimOverride = true;
    this.look.mode = 'yaw'; this.look.yaw = Math.atan2(-(ap.x - a.pos.x), -(ap.z - a.pos.z)); this.look.pitch = 0; this.look.rate = 12;
    I.moveX = I.moveZ = 0; this.moveIntent = false;
    this.fireMode = 'hold'; I.fire = Math.abs(angleDiff(I.yaw, this.look.yaw)) < 0.25 && (!g || g.it.mag > 0 || inv.selected === 0);
    this.state = 'breakout';
    return true;
  },
  // ---------- 簡化結算（距離玩家 > lodDist 的 bot 對 bot）----------
  // 以真實戰鬥實測的「持續火力 dps（含換彈、連發節奏）」查表，積累傷害後以整發為單位結算。
  simShoot(o, d, dt) {
    const a = this.a, cur = this.curGun(); if (!cur) return;
    const key = cur.it.defId, tab = TUNE.simDps[key], st = cur.st, now = this.ctx.time.now;
    if (!tab || !this.reactDone(now) || cur.it.mag <= 0 && a.inventory.ammo[st.ammo] <= 0) return;
    let dps = 0;
    if (d >= tab[tab.length - 1][0]) dps = tab[tab.length - 1][1];
    else for (let i = 1; i < tab.length; i++) if (d <= tab[i][0]) { const [d0, v0] = tab[i - 1], [d1, v1] = tab[i]; dps = v0 + (v1 - v0) * (d - d0) / (d1 - d0); break; }
    if (d < tab[0][0]) dps = tab[0][1];
    const sk = (TUNE.aimBase + 0.45 * TUNE.aimSkill) / (TUNE.aimBase + (1 - this.skill) * TUNE.aimSkill);
    dps *= clamp(sk * sk, 0.3, 3.2) * Math.pow(1.05, cur.it.rarity - 1) * (o.crouching ? 0.85 : 1);
    // 耗彈：彈匣空了就從備彈補（時間成本已含在實測 dps 裡）；備彈也沒了就停火
    this.simShots += (TUNE.simRate[key] || 3) * dt;
    while (this.simShots >= 1) {
      this.simShots -= 1;
      if (cur.it.mag <= 0) { const n = Math.min(st.mag, a.inventory.ammo[st.ammo]); if (n <= 0) return; cur.it.mag += n; a.inventory.ammo[st.ammo] -= n; }
      cur.it.mag--;
    }
    this.simDmg += dps * dt * (0.3 + 1.4 * Math.random());
    const unit = key === 'pump' ? 45 : key === 'sniper' ? 90 : st.dmg * falloffMul(st, d);
    let n = 0;
    while (this.simDmg >= unit && n++ < 6 && o.alive) {
      this.simDmg -= unit;
      const head = key !== 'pump' && Math.random() < 0.08 + 0.1 * this.skill;
      o.takeDamage(unit * (head ? 1.4 : 1), { source: a, weapon: key, headshot: head, point: _t.set(o.pos.x, o.pos.y + 1.2, o.pos.z) });
    }
    if (!o.alive) this.simDmg = 0;
    this.ctx.bots.noise(a.pos.x, a.pos.z, a);
  },
};
