// 對戰規則與 bot AI。純邏輯：不依賴 THREE / DOM，node 可直接跑。
// 畫面層讀 game.ents 與 game.fx（每幀取走的演出事件）。
import { buildMap } from './map.js';
import { World } from './world.js';

export const TEAMS = [
  { id: 0, name: 'VANGUARD', zh: '先鋒', names: ['Harrow', 'Quill', 'Sable', 'Marlow', 'Finch'] },
  { id: 1, name: 'EMBER', zh: '餘燼', names: ['Cinder', 'Rook', 'Vesper', 'Tallow', 'Brand'] },
];

// 槍匠零件。數值都是對基礎值的增減。
export const PARTS = {
  optic: [
    { id: 'iron',   name: '機械照門', en: 'IRON SIGHTS', zoom: 1.25, ads: 0,     note: '視野最開闊，開鏡最快' },
    { id: 'reflex', name: '反射式紅點', en: 'REFLEX RDS', zoom: 1.4,  ads: 0.01,  note: '乾淨的單點，近中距離' },
    { id: 'holo',   name: '全像瞄具', en: 'HOLO SIGHT', zoom: 1.6,  ads: 0.02,  note: '環形分劃，移動目標好抓' },
    { id: 'scope',  name: '4× 光學瞄準鏡', en: '4× OPTIC', zoom: 4.0,  ads: 0.09,  note: '長走廊對槍用；開鏡慢、視野窄' },
  ],
  barrel: [
    { id: 'std',  name: '14.5 吋標準槍管', en: 'STANDARD 14.5"', recoil: 1.0,  range: 1.0,  ads: 0,    noise: 38, flash: 1,   note: '消焰器，均衡' },
    { id: 'long', name: '18 吋重型槍管＋制退器', en: 'HEAVY 18" + BRAKE', recoil: 0.78, range: 1.35, ads: 0.05, noise: 44, flash: 1.3, note: '後座力小、射程遠；較重、較吵' },
    { id: 'sup',  name: '短槍管＋抑制器', en: 'SHORT + SUPPRESSOR', recoil: 0.9,  range: 0.75, ads: 0.02, noise: 11, flash: 0,   note: '敵人難以聽聲辨位，沒有槍口火光；射程短' },
  ],
  mag: [
    { id: 'std',  name: '30 發標準彈匣', en: '30-RD STANDARD', size: 30, reload: 2.1,  ads: 0,    move: 1.0,  note: '換彈最快' },
    { id: 'ext',  name: '40 發加長彈匣', en: '40-RD EXTENDED', size: 40, reload: 2.5,  ads: 0.02, move: 1.0,  note: '多 10 發，換彈稍慢' },
    { id: 'drum', name: '60 發彈鼓', en: '60-RD DRUM', size: 60, reload: 3.4,  ads: 0.06, move: 0.94, note: '火力持續；換彈慢、行動變重' },
  ],
};
export function weaponStats(lo) {
  const o = PARTS.optic.find(p => p.id === lo.optic) || PARTS.optic[0];
  const b = PARTS.barrel.find(p => p.id === lo.barrel) || PARTS.barrel[0];
  const m = PARTS.mag.find(p => p.id === lo.mag) || PARTS.mag[0];
  return {
    optic: o, barrel: b, magPart: m,
    mag: m.size, reload: m.reload, adsTime: 0.2 + o.ads + b.ads + m.ads, zoom: o.zoom,
    recoil: b.recoil, rangeStart: 16 * b.range, rangeEnd: 42 * b.range, dmg: 27, minMul: 0.7,
    noise: b.noise, flash: b.flash, moveMul: m.move, interval: 60 / 720,
    hip: 0.022, adsSpread: o.id === 'scope' ? 0.0012 : 0.0028,
  };
}

export const SKILLS = {
  easy:   { err0: 0.26, err1: 0.060, settle: 1.25, react: 0.70, turn: 4.6, toPlayer: 0.5, head: 0.06 },
  normal: { err0: 0.21, err1: 0.044, settle: 1.0,  react: 0.55, turn: 6.0, toPlayer: 0.7, head: 0.14 },
  hard:   { err0: 0.15, err1: 0.030, settle: 0.7,  react: 0.38, turn: 7.5, toPlayer: 0.95, head: 0.24 },
};

export const RULES = { winScore: 5, roundTime: 110, freeze: 3.5, post: 5, teamSize: 5, regenDelay: 6, regenRate: 11 };

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

export class Game {
  constructor(o = {}) {
    this.map = o.map || buildMap();
    this.world = o.world || new World(this.map);
    this.rng = mulberry(o.seed || 20261113);
    this.skill = SKILLS[o.difficulty || 'normal'];
    this.playerTeam = o.playerTeam ?? 0;
    this.auto = !!o.auto;          // 玩家也由 AI 操作（觀戰／驗收）
    this.fx = [];
    this.time = 0; this.round = 0; this.score = [0, 0]; this.phase = 'idle'; this.phaseT = 0; this.timeLeft = 0;
    this.lastWinner = -1; this.lastReason = '';
    this.bb = [{ seen: new Map() }, { seen: new Map() }];
    this.dark = new Uint8Array(this.map.zones.length); // 區域裡的燈大半被打滅：bot 在暗處看不遠
    this.ents = [];
    for (let t = 0; t < 2; t++) for (let i = 0; i < RULES.teamSize; i++) {
      const isPlayer = t === this.playerTeam && i === 0;
      const lo = isPlayer ? { optic: 'reflex', barrel: 'std', mag: 'std', ...(o.loadout || {}) }
        : { optic: ['iron', 'reflex', 'holo', 'reflex', 'scope'][(i + t) % 5], barrel: ['std', 'long', 'std', 'sup', 'std'][(i + t * 2) % 5], mag: ['std', 'ext', 'std', 'std', 'drum'][(i * 2 + t) % 5] };
      this.ents.push({
        id: this.ents.length, team: t, slot: i, isPlayer, name: isPlayer ? 'YOU' : TEAMS[t].names[i],
        x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, crouch: 0, ads: 0, sprint: 0, speed: 0, ground: true,
        hp: 100, alive: false, ammo: 30, reserve: 120, reloadT: 0, reloadStage: 0, fireCd: 0, bloom: 0, shots: 0,
        loadout: lo, w: weaponStats(lo), k: 0, d: 0, a: 0, dmgDealt: 0,
        damagers: new Map(), lastHurt: -99, lastShot: -99, hurtDir: 0, stepAcc: 0, deathT: 0, killer: -1,
        cmd: { wx: 0, wz: 0, sprint: false, crouch: false, jump: false, fire: false, ads: false, reload: false },
        bot: null,
      });
    }
    this.player = this.ents.find(e => e.isPlayer);
    for (const e of this.ents) if (!e.isPlayer || this.auto) e.bot = newBot();
  }
  setLoadout(e, lo) { e.loadout = { ...e.loadout, ...lo }; e.w = weaponStats(e.loadout); if (e.ammo > e.w.mag) e.ammo = e.w.mag; }
  setAuto(on) { this.auto = on; const p = this.player; p.bot = on ? (p.bot || newBot()) : null; if (!on) Object.assign(p.cmd, { wx: 0, wz: 0, sprint: false, crouch: false, jump: false, fire: false, ads: false, reload: false }); }
  eyeY(e) { return e.y + 1.62 - 0.56 * e.crouch; }
  alive(team) { let n = 0; for (const e of this.ents) if (e.team === team && e.alive) n++; return n; }

  startMatch() { this.score = [0, 0]; this.round = 0; for (const e of this.ents) { e.k = e.d = e.a = 0; e.dmgDealt = 0; } this.startRound(); }
  startRound() {
    this.round++; this.phase = 'freeze'; this.phaseT = RULES.freeze; this.timeLeft = RULES.roundTime;
    this.resetScene();
    this.bb[0].seen.clear(); this.bb[1].seen.clear();
    const map = this.map;
    for (let t = 0; t < 2; t++) {
      const order = [0, 1, 2, 3, 4, 5]; for (let i = 5; i > 0; i--) { const j = (this.rng() * (i + 1)) | 0;[order[i], order[j]] = [order[j], order[i]]; }
      const roles = ['push', 'push', 'flank', 'hold', 'push']; const lanes = ['mid', 'hall', 'north', 'office', 'mid', 'hall'];
      for (let i = 4; i > 0; i--) { const j = (this.rng() * (i + 1)) | 0;[lanes[i], lanes[j]] = [lanes[j], lanes[i]]; }
      let k = 0;
      for (const e of this.ents) {
        if (e.team !== t) continue;
        const sp = map.spawns[t][order[k]];
        Object.assign(e, { x: sp[0], y: 0, z: sp[1], vx: 0, vy: 0, vz: 0, yaw: map.spawnYaw[t], pitch: 0, crouch: 0, ads: 0, sprint: 0, speed: 0, ground: true,
          hp: 100, alive: true, ammo: e.w.mag, reserve: e.w.mag * 4, reloadT: 0, fireCd: 0, bloom: 0, shots: 0, lastHurt: -99, killer: -1 });
        e.damagers.clear();
        if (e.bot) {
          Object.assign(e.bot, newBot());
          const b = e.bot; b.role = e.isPlayer ? 'push' : roles[k % roles.length];
          const ln = b.role === 'flank' ? (this.rng() < 0.5 ? 'north' : 'office') : lanes[k % lanes.length];
          b.lane = map.lanes[ln].map(p => [t === 0 ? p[0] : -p[0], p[1]]); b.li = 0;
          if (b.role === 'hold') { const h = map.holds[(this.rng() * map.holds.length) | 0]; b.lane = [[t === 0 ? h[0] : -h[0], h[1]]]; b.holdUntil = this.time + RULES.freeze + 18 + this.rng() * 16; }
          b.wait = this.rng() * 0.8;
        }
        k++;
      }
    }
    this.fx.push({ t: 'round', phase: 'freeze', round: this.round });
  }
  // 每回合開始：家具與燈全部復原（map / world 由每一場共用，所以狀態記在它們身上）
  resetScene() {
    for (const it of this.map.items) { it.hp = it.hp0; it.dead = false; }
    for (const l of this.map.lamps) { l.hp = l.hp0; l.s = 1; }
    this.world.reviveAll(); this.dark.fill(0);
  }
  _lampHit(l, n) {
    if (l.hp <= 0) return;
    l.hp = Math.max(0, l.hp - n); l.s = l.hp / l.hp0;
    this.fx.push({ t: 'lamp', lamp: l.id, s: l.s, dead: l.hp <= 0 });
    for (const f of this.map.lamps) if (f.follow === l.id) f.s = l.s;
    if (l.zone < 0) return;
    let sum = 0, on = 0; for (const f of this.map.lamps) if (f.zone === l.zone && f.hp0 > 0) { sum += f.I; on += f.I * f.s; }
    this.dark[l.zone] = sum > 0 && on < sum * 0.3 ? 1 : 0;
  }
  _itemHit(it, dmg) {
    if (!it.hp0 || it.dead) return;
    it.hp -= dmg; if (it.hp > 0) return;
    it.hp = 0; it.dead = true; this.world.setDead(it.box, true);
    this.fx.push({ t: 'break', item: it.id });
    for (const l of this.map.lamps) if (l.item === it.id) this._lampHit(l, l.hp); // 床頭櫃上的檯燈跟著摔壞
  }
  endRound(winner, reason) {
    this.phase = 'post'; this.phaseT = RULES.post; this.lastWinner = winner; this.lastReason = reason;
    if (winner >= 0) this.score[winner]++;
    this.fx.push({ t: 'round', phase: 'post', winner, reason });
  }

  step(dt) {
    this.time += dt;
    if (this.phase === 'idle' || this.phase === 'over') return;
    this.phaseT -= dt;
    if (this.phase === 'freeze' && this.phaseT <= 0) { this.phase = 'live'; this.fx.push({ t: 'round', phase: 'live', round: this.round }); }
    else if (this.phase === 'post' && this.phaseT <= 0) {
      if (Math.max(this.score[0], this.score[1]) >= RULES.winScore) { this.phase = 'over'; this.fx.push({ t: 'round', phase: 'over', winner: this.score[0] > this.score[1] ? 0 : 1 }); return; }
      this.startRound(); return;
    }
    const live = this.phase === 'live';
    if (live) this.timeLeft -= dt;
    for (const e of this.ents) {
      if (!e.alive) { e.deathT += dt; continue; }
      if (e.bot) think(this, e, dt, this.phase !== 'freeze');
      if (this.phase === 'freeze') { e.cmd.wx = e.cmd.wz = 0; e.cmd.fire = false; e.cmd.jump = false; }
      this._move(e, dt); this._weapon(e, dt, live || this.phase === 'post');
      if (this.time - e.lastHurt > RULES.regenDelay && e.hp < 100) e.hp = Math.min(100, e.hp + RULES.regenRate * dt);
    }
    // 互相推開
    const E = this.ents;
    for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) {
      const a = E[i], b = E[j]; if (!a.alive || !b.alive) continue;
      const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz; if (d2 > 0.49 || d2 < 1e-8) continue;
      const d = Math.sqrt(d2), p = (0.7 - d) * 0.5 / d; a.x -= dx * p; a.z -= dz * p; b.x += dx * p; b.z += dz * p;
    }
    if (live) {
      const a0 = this.alive(0), a1 = this.alive(1);
      if (!a0 || !a1) this.endRound(a0 ? 0 : a1 ? 1 : -1, 'elim');
      else if (this.timeLeft <= 0) {
        let h0 = 0, h1 = 0; for (const e of E) if (e.alive) { if (e.team) h1 += e.hp; else h0 += e.hp; }
        this.endRound(a0 > a1 ? 0 : a1 > a0 ? 1 : h0 > h1 ? 0 : h1 > h0 ? 1 : -1, 'time');
      }
    }
  }

  _move(e, dt) {
    const c = e.cmd, w = e.w;
    let wx = c.wx, wz = c.wz; const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
    const reloading = e.reloadT > 0;
    const fwd = -Math.sin(e.yaw) * wx - Math.cos(e.yaw) * wz;
    const wantSprint = c.sprint && wl > 0.3 && fwd > 0.3 && !c.crouch && !c.ads && !c.fire && e.ground;
    e.sprint = clamp(e.sprint + (wantSprint ? dt / 0.16 : -dt / 0.2), 0, 1);
    e.crouch = clamp(e.crouch + (c.crouch ? dt / 0.18 : -dt / 0.2), 0, 1);
    const adsWant = c.ads && !reloading && e.sprint < 0.4;
    e.ads = clamp(e.ads + (adsWant ? dt / w.adsTime : -dt / (w.adsTime * 0.8)), 0, 1);
    let sp = 4.3; if (e.crouch > 0.5) sp = 2.1; else if (wantSprint) sp = 6.4; if (e.ads > 0.5) sp = Math.min(sp, 2.8);
    sp *= w.moveMul;
    const k = Math.min(1, dt * (e.ground ? 13 : 3));
    e.vx += (wx * sp - e.vx) * k; e.vz += (wz * sp - e.vz) * k;
    if (c.jump && e.ground && e.crouch < 0.3) { e.vy = 4.7; e.ground = false; this.fx.push({ t: 'jump', id: e.id }); }
    if (!e.ground) { e.vy -= 15 * dt; e.y += e.vy * dt; if (e.y <= 0) { e.y = 0; e.vy = 0; e.ground = true; this.fx.push({ t: 'land', id: e.id }); } }
    const o = this._o || (this._o = { x: 0, z: 0 });
    this.world.resolve(e.x + e.vx * dt, e.z + e.vz * dt, 0.33, o);
    const mx = o.x - e.x, mz = o.z - e.z; e.x = o.x; e.z = o.z;
    e.speed = Math.hypot(mx, mz) / dt;
    if (e.ground && e.speed > 0.8) {
      e.stepAcc += e.speed * dt;
      const stride = e.sprint > 0.5 ? 2.25 : e.crouch > 0.5 ? 1.2 : 1.55;
      if (e.stepAcc > stride) { e.stepAcc = 0; this.fx.push({ t: 'step', id: e.id, loud: e.sprint > 0.5 ? 1 : e.crouch > 0.5 ? 0.25 : 0.6 }); }
    }
  }

  _weapon(e, dt, canFire) {
    const c = e.cmd, w = e.w;
    e.fireCd -= dt; e.bloom = Math.max(0, e.bloom - dt * 0.09); if (this.time - e.lastShot > 0.28) e.shots = 0;
    if (e.reloadT > 0) {
      const p0 = 1 - e.reloadT / w.reload; e.reloadT -= dt; const p1 = 1 - e.reloadT / w.reload;
      if (p0 < 0.5 && p1 >= 0.5) this.fx.push({ t: 'reload', id: e.id, stage: 1 });
      if (p0 < 0.82 && p1 >= 0.82) this.fx.push({ t: 'reload', id: e.id, stage: 2 });
      if (e.reloadT <= 0) { const n = Math.min(w.mag - e.ammo, e.reserve); e.ammo += n; e.reserve -= n; e.reloadT = 0; }
      return;
    }
    if ((c.reload || (e.ammo === 0 && (c.fire || e.bot))) && e.ammo < w.mag && e.reserve > 0) { e.reloadT = w.reload; this.fx.push({ t: 'reload', id: e.id, stage: 0 }); return; }
    if (c.fire && e.fireCd <= 0 && canFire && e.sprint < 0.35) {
      if (e.ammo > 0) this._shoot(e); else if (!e.dry) { e.dry = true; this.fx.push({ t: 'dry', id: e.id }); }
    }
    if (!c.fire) e.dry = false;
  }

  _shoot(e) {
    const w = e.w, r = this.rng;
    e.ammo--; e.fireCd = w.interval; e.lastShot = this.time; e.shots++;
    let sp = w.hip + (w.adsSpread - w.hip) * e.ads + e.bloom + (e.speed / 4.3) * 0.02 * (1 - e.ads * 0.75) + (e.ground ? 0 : 0.05);
    if (e.crouch > 0.5) sp *= 0.8;
    e.bloom = Math.min(0.045, e.bloom + 0.0045 * w.recoil * (1 - e.ads * 0.6));
    const ang = r() * Math.PI * 2, rad = Math.sqrt(r()) * sp;
    const yaw = e.yaw + Math.cos(ang) * rad, pitch = clamp(e.pitch + Math.sin(ang) * rad, -1.5, 1.5);
    const cp = Math.cos(pitch), dx = -Math.sin(yaw) * cp, dy = Math.sin(pitch), dz = -Math.cos(yaw) * cp;
    const ox = e.x, oy = this.eyeY(e), oz = e.z;
    let best = this.world.raycast(ox, oy, oz, dx, dy, dz, 120, false);
    const wh = this.world.hit; let nx = wh.nx, ny = wh.ny, nz = wh.nz, box = wh.box;
    let victim = null, head = false, leg = false, lamp = null;
    for (const l of this.map.lamps) { // 燈：橢球
      if (l.hp <= 0) continue;
      const ky = l.hr / l.hv, rx = ox - l.x, ry = (oy - l.hy) * ky, rz = oz - l.z, ddy = dy * ky;
      const a = dx * dx + ddy * ddy + dz * dz, bq = rx * dx + ry * ddy + rz * dz, cq = rx * rx + ry * ry + rz * rz - l.hr * l.hr, disc = bq * bq - a * cq;
      if (disc <= 0 || cq < 0) continue;
      const t = (-bq - Math.sqrt(disc)) / a;
      if (t > 0 && t < best) { best = t; lamp = l; box = -1; const il = 1 / l.hr; nx = (rx + dx * t) * il; ny = (ry + ddy * t) * il; nz = (rz + dz * t) * il; }
    }
    for (const v of this.ents) {
      if (!v.alive || v.team === e.team) continue;
      const rx = ox - v.x, rz = oz - v.z;
      // 頭：球
      const hy = this.eyeY(v) + 0.03, ry = oy - hy;
      let bq = rx * dx + ry * dy + rz * dz, cq = rx * rx + ry * ry + rz * rz - 0.0225, disc = bq * bq - cq;
      if (disc > 0) { const t = -bq - Math.sqrt(disc); if (t > 0 && t < best) { best = t; victim = v; head = true; leg = false; lamp = null; } }
      // 身體：直立圓柱
      const a = dx * dx + dz * dz; if (a < 1e-9) continue;
      bq = rx * dx + rz * dz; cq = rx * rx + rz * rz - 0.085; disc = bq * bq - a * cq;
      if (disc > 0) {
        const sq = Math.sqrt(disc), t0 = (-bq - sq) / a, t1 = (-bq + sq) / a, top = v.y + 1.48 - 0.5 * v.crouch;
        for (const t of [t0, (t0 + t1) / 2]) {
          if (t <= 0 || t >= best) continue; const y = oy + dy * t;
          if (y >= v.y && y <= top) { best = t; victim = v; head = false; lamp = null; leg = y < v.y + 0.72 * (1 - 0.3 * v.crouch); break; }
        }
      }
    }
    const hx = ox + dx * best, hy2 = oy + dy * best, hz = oz + dz * best;
    const hb = !victim && !lamp && box >= 0 ? this.map.boxes[box] : null, item = hb && hb.item !== undefined ? this.map.items[hb.item] : null;
    const kind = victim ? 'body' : lamp ? 'lamp' : box === -2 ? 'floor' : box === -3 ? 'ceil' : hb ? hb.kind : 'none';
    this.fx.push({ t: 'shot', id: e.id, ox, oy, oz, dx, dy, dz, hx, hy: hy2, hz, dist: best, kind, nx, ny, nz, sup: w.flash === 0, victim: victim ? victim.id : -1, item: item ? item.id : -1 });
    if (lamp) this._lampHit(lamp, 1); else if (item) this._itemHit(item, w.dmg);
    // 槍聲讓對方知道大概位置
    const bbE = this.bb[1 - e.team];
    for (const v of this.ents) if (v.alive && v.team !== e.team && v.bot && Math.hypot(v.x - e.x, v.z - e.z) < w.noise) {
      const s = bbE.seen.get(e.id); if (!s || this.time - s.t > 1.5) bbE.seen.set(e.id, { x: e.x + (r() - 0.5) * 3, z: e.z + (r() - 0.5) * 3, t: this.time - 2, heard: true });
      break;
    }
    if (victim) {
      let dmg = w.dmg * (best <= w.rangeStart ? 1 : best >= w.rangeEnd ? w.minMul : 1 - (1 - w.minMul) * (best - w.rangeStart) / (w.rangeEnd - w.rangeStart));
      dmg *= head ? 2.3 : leg ? 0.8 : 1;
      if (victim.isPlayer && !this.auto) dmg *= this.skill.toPlayer;
      this._hurt(victim, e, dmg, head);
    }
  }
  _hurt(v, by, dmg, head) {
    dmg = Math.min(dmg, v.hp); v.hp -= dmg; v.lastHurt = this.time; by.dmgDealt += dmg;
    const d = v.damagers.get(by.id) || { dmg: 0, t: 0 }; d.dmg += dmg; d.t = this.time; v.damagers.set(by.id, d);
    v.hurtDir = Math.atan2(-(by.x - v.x), -(by.z - v.z));
    if (v.bot) { v.bot.alert.set(by.id, this.time); this.bb[v.team].seen.set(by.id, { x: by.x, z: by.z, t: this.time }); }
    this.fx.push({ t: 'hurt', id: v.id, by: by.id, dmg, head, dead: v.hp <= 0.01 });
    if (v.hp <= 0.01) {
      v.hp = 0; v.alive = false; v.d++; by.k++; v.deathT = 0; v.killer = by.id; v.reloadT = 0;
      v.fallYaw = Math.atan2(v.x - by.x, v.z - by.z);
      const assists = [];
      for (const [id, q] of v.damagers) if (id !== by.id && this.time - q.t < 12 && q.dmg >= 22) { this.ents[id].a++; assists.push(id); }
      this.fx.push({ t: 'kill', id: v.id, by: by.id, head, assists });
    }
  }

  board(team) { return this.ents.filter(e => e.team === team).sort((a, b) => b.k - a.k || a.d - b.d || b.a - a.a); }
}

// ================= Bot AI =================
function newBot() {
  return { state: 'adv', role: 'push', lane: null, li: 0, path: null, pi: 0, gx: 0, gz: 0, repathT: 0, senseT: 0, target: -1, visible: false,
    seenT: -99, lastKnown: null, onTarget: 0, react: 0, errY: 0, errP: 0, errTY: 0, errTP: 0, errT: 0, burstT: 0, pauseT: 0, strafe: 1, strafeT: 0,
    hideT: 0, cover: null, stuckT: 0, sx: 0, sz: 0, stuckN: 0, nudgeT: 0, nudgeA: 0, huntT: 0, holdUntil: 0, alert: new Map(), wait: 0,
    lookYaw: 0, lookT: 0, wantHead: false, patrolN: 0, flankT: 0, crouchT: 0, wantCrouch: false };
}

function sense(g, e) {
  const b = e.bot, W = g.world, ey = g.eyeY(e), bb = g.bb[e.team];
  let best = null, bd = 1e9;
  for (const o of g.ents) {
    if (o.team === e.team || !o.alive) continue;
    const dx = o.x - e.x, dz = o.z - e.z, d = Math.hypot(dx, dz); if (d > 60) continue;
    const ang = Math.abs(wrap(Math.atan2(-dx, -dz) - e.yaw));
    const loud = g.time - o.lastShot < 0.6, hot = g.time - (b.alert.get(o.id) || -99) < 3;
    const aware = d < 3.2 || ang < 1.1 || hot || (loud && d < o.w.noise * 0.5);
    if (!aware) continue;
    if (d > 11 && !loud && !hot) { const zc = W.cellOf(o.x, o.z); if (zc >= 0 && W.zoneOf[zc] >= 0 && g.dark[W.zoneOf[zc]]) continue; } // 燈被打滅的房間裡，遠處的人看不清楚
    const oy = g.eyeY(o);
    if (!W.blocked(e.x, ey, e.z, o.x, oy, o.z) || !W.blocked(e.x, ey, e.z, o.x, o.y + 0.95 - 0.3 * o.crouch, o.z)) {
      bb.seen.set(o.id, { x: o.x, z: o.z, t: g.time });
      const s = d - (o.id === b.target ? 5 : 0); if (s < bd) { bd = s; best = o; }
    }
  }
  if (best) {
    if (b.target !== best.id || !b.visible) {
      if (b.target !== best.id || g.time - b.seenT > 1.5) { b.react = g.skill.react * (0.7 + g.rng() * 0.6); b.onTarget = 0; }
      b.target = best.id; b.wantHead = g.rng() < g.skill.head;
    }
    b.visible = true; b.seenT = g.time; b.lastKnown = { x: best.x, z: best.z };
  } else b.visible = false;
}

function setPath(g, e, x, z, zoneCost) {
  const b = e.bot; b.gx = x; b.gz = z;
  b.path = g.world.path(e.x, e.z, x, z, zoneCost); b.pi = 0; b.repathT = 1.2 + g.rng() * 0.6;
  return !!b.path;
}
// 沿路徑走；回傳 true 表示已抵達或沒有路徑
function follow(g, e, run) {
  const b = e.bot, c = e.cmd;
  if (!b.path) { c.wx = c.wz = 0; return true; }
  let p = b.path[b.pi];
  while (p && Math.hypot(p[0] - e.x, p[1] - e.z) < 0.42) p = b.path[++b.pi];
  if (!p) { b.path = null; c.wx = c.wz = 0; return true; }
  let dx = p[0] - e.x, dz = p[1] - e.z; const d = Math.hypot(dx, dz); dx /= d; dz /= d;
  if (b.nudgeT > 0) { dx = Math.cos(b.nudgeA); dz = Math.sin(b.nudgeA); }
  c.wx = dx; c.wz = dz; c.sprint = !!run;
  b.moveYaw = Math.atan2(-dx, -dz);
  return false;
}
function latestSighting(g, e, maxAge) {
  let best = null, bt = -1e9;
  for (const [id, s] of g.bb[e.team].seen) { if (!g.ents[id].alive) continue; if (g.time - s.t > maxAge) continue; if (s.t > bt) { bt = s.t; best = s; } }
  return best;
}
function findCover(g, e, tx, tz) {
  const W = g.world; let best = null, bs = 1e9; const ty = 1.5;
  for (const p of W.cover) {
    const d = Math.hypot(p.x - e.x, p.z - e.z); if (d > 9) continue;
    const dt = Math.hypot(p.x - tx, p.z - tz); if (dt < 3) continue;
    const s = d + (dt < 6 ? 4 : 0) + g.rng() * 1.5; if (s >= bs) continue;
    if (!W.blocked(p.x, p.low ? 1.0 : 1.55, p.z, tx, ty, tz)) continue;
    bs = s; best = p;
  }
  return best;
}
function flankCost(g, e, tx, tz) {
  const W = g.world, zc = new Float32Array(g.map.zones.length).fill(1);
  const direct = W.path(e.x, e.z, tx, tz); if (!direct) return null;
  const tz0 = W.zoneOf[W.nearest(tx, tz)], mz = W.zoneOf[W.nearest(e.x, e.z)];
  for (const p of direct) { const q = W.zoneOf[W.cellOf(p[0], p[1])]; if (q >= 0 && q !== tz0 && q !== mz) zc[q] = 4.5; }
  return zc;
}

function think(g, e, dt, canAct) {
  const b = e.bot, c = e.cmd, sk = g.skill, r = g.rng;
  c.fire = false; c.reload = false; c.jump = false; c.ads = false; c.sprint = false; c.crouch = false;
  if (!canAct) { c.wx = c.wz = 0; return; }
  if (b.wait > 0) { b.wait -= dt; c.wx = c.wz = 0; return; }
  b.senseT -= dt; if (b.senseT <= 0) { b.senseT = 0.1 + r() * 0.06; sense(g, e); }
  b.repathT -= dt; b.nudgeT -= dt;
  let tgt = b.target >= 0 ? g.ents[b.target] : null;
  if (tgt && !tgt.alive) { tgt = null; b.target = -1; b.visible = false; b.lastKnown = null; if (b.state === 'fight' || b.state === 'hunt') b.state = 'adv'; }
  const hurtBad = e.hp < 40, endgame = g.timeLeft < 35;
  let aimX = null, aimY = 0, aimZ = 0, lookYaw = null;

  switch (b.state) {
    case 'adv': {
      if (b.visible) { b.state = 'fight'; b.strafeT = 0; break; }
      const s = (b.role !== 'hold' || endgame) ? latestSighting(g, e, 12) : latestSighting(g, e, 3);
      if (s) {
        if (b.repathT <= 0 || !b.path) {
          const zc = b.role === 'flank' ? flankCost(g, e, s.x, s.z) : null;
          setPath(g, e, s.x, s.z, zc); if (b.role === 'flank') b.repathT = 3;
        }
        const d = Math.hypot(s.x - e.x, s.z - e.z);
        if (follow(g, e, d > 12) && d < 2.5) g.bb[e.team].seen.forEach((q, id) => { if (q === s) g.bb[e.team].seen.delete(id); });
        if (d < 16 && !g.world.blocked(e.x, 1.5, e.z, s.x, 1.4, s.z)) lookYaw = Math.atan2(-(s.x - e.x), -(s.z - e.z));
      } else if (b.role === 'hold' && g.time < b.holdUntil && !endgame) {
        const h = b.lane[0];
        if (Math.hypot(h[0] - e.x, h[1] - e.z) > 0.8) { if (!b.path || b.repathT <= 0) setPath(g, e, h[0], h[1]); follow(g, e, true); }
        else { c.wx = c.wz = 0; c.crouch = true; b.lookT -= dt; if (b.lookT <= 0) { b.lookT = 1.5 + r() * 2; b.lookYaw = g.map.spawnYaw[e.team] + (r() - 0.5) * 1.6; } lookYaw = b.lookYaw; }
      } else {
        if (b.role === 'hold') b.role = 'push';
        let p = b.lane && b.lane[b.li];
        if (!p) { // 路線走完：巡邏
          const P = g.map.patrol; b.lane = [P[(r() * P.length) | 0]]; b.li = 0; p = b.lane[0];
        }
        if (Math.hypot(p[0] - e.x, p[1] - e.z) < 1.6) { b.li++; b.path = null; }
        else { if (!b.path || b.repathT <= 0) { if (!setPath(g, e, p[0], p[1])) b.li++; } follow(g, e, g.round > 0 && (b.li < 2 || endgame)); }
      }
      if (e.ammo < e.w.mag * 0.5) c.reload = true;
      break;
    }
    case 'fight': {
      if (!tgt) { b.state = 'adv'; break; }
      if (!b.visible && g.time - b.seenT > 0.7) { b.state = 'hunt'; b.huntT = 7 + r() * 3; b.path = null; break; }
      const dx = tgt.x - e.x, dz = tgt.z - e.z, d = Math.hypot(dx, dz) || 1;
      if ((hurtBad || e.ammo === 0) && b.hideT <= 0) {
        const cv = findCover(g, e, tgt.x, tgt.z);
        if (cv && setPath(g, e, cv.x, cv.z)) { b.cover = cv; b.state = 'retreat'; b.hideT = 6; break; }
        b.hideT = 3; // 找不到就硬拚一陣子
      }
      b.hideT -= dt;
      aimX = tgt.x; aimZ = tgt.z; aimY = b.wantHead && d < 22 ? g.eyeY(tgt) : tgt.y + 1.12 - 0.36 * tgt.crouch;
      // 橫移
      b.strafeT -= dt;
      if (b.strafeT <= 0) { b.strafeT = 0.5 + r() * 1.1; b.strafe = r() < 0.25 ? 0 : r() < 0.5 ? -1 : 1; b.wantCrouch = d > 9 && r() < 0.3; }
      const px = -dz / d, pz = dx / d; let ax = px * b.strafe, az = pz * b.strafe;
      if (d > 24) { ax += dx / d; az += dz / d; } else if (d < 4) { ax -= dx / d * 0.6; az -= dz / d * 0.6; }
      c.wx = ax; c.wz = az; c.ads = true; c.crouch = b.wantCrouch;
      break;
    }
    case 'retreat': {
      const arrived = follow(g, e, true);
      if (b.lastKnown) lookYaw = b.moveYaw;
      if (arrived) { b.state = 'hide'; b.hideT = 1.4 + r() * 1.6; }
      else if (b.repathT <= -4) { b.state = 'fight'; }
      break;
    }
    case 'hide': {
      c.wx = c.wz = 0; c.crouch = !!(b.cover && b.cover.low) || e.hp < 60; c.reload = e.ammo < e.w.mag;
      if (b.lastKnown) lookYaw = Math.atan2(-(b.lastKnown.x - e.x), -(b.lastKnown.z - e.z));
      b.hideT -= dt;
      if (b.visible && e.ammo > 0 && e.reloadT <= 0 && (b.hideT < 0.6 || g.time - e.lastHurt < 0.5)) { b.state = 'fight'; b.hideT = 5; break; }
      if (b.hideT <= 0 && e.reloadT <= 0 && (e.hp > 62 || b.hideT < -5 || endgame)) { b.state = b.lastKnown ? 'hunt' : 'adv'; b.huntT = 8; b.path = null; b.hideT = 4; }
      break;
    }
    case 'hunt': {
      if (b.visible) { b.state = 'fight'; break; }
      b.huntT -= dt;
      const s = latestSighting(g, e, 6) || b.lastKnown;
      if (!s || b.huntT <= 0) { b.state = 'adv'; b.lastKnown = null; b.path = null; break; }
      if (!b.path || b.repathT <= 0) { if (!setPath(g, e, s.x, s.z)) { b.state = 'adv'; break; } }
      const d = Math.hypot(s.x - e.x, s.z - e.z);
      if (follow(g, e, d > 14) || d < 1.2) { b.state = 'adv'; b.lastKnown = null; b.path = null; }
      if (d < 14 && !g.world.blocked(e.x, 1.5, e.z, s.x, 1.4, s.z)) lookYaw = Math.atan2(-(s.x - e.x), -(s.z - e.z));
      if (e.ammo < e.w.mag * 0.4) c.reload = true;
      break;
    }
  }

  // 卡住偵測
  b.stuckT += dt;
  if (b.stuckT > 0.8) {
    const moved = Math.hypot(e.x - b.sx, e.z - b.sz), want = Math.hypot(c.wx, c.wz) > 0.3 && b.state !== 'fight';
    if (want && moved < 0.25) { b.stuckN++; b.path = null; b.repathT = 0; if (b.stuckN > 1) { b.nudgeT = 0.5; b.nudgeA = r() * 6.283; } if (b.stuckN > 5 && b.state === 'adv') { b.li++; b.stuckN = 0; } }
    else b.stuckN = 0;
    b.stuckT = 0; b.sx = e.x; b.sz = e.z;
  }

  // 瞄準
  let wy, wp = 0;
  if (aimX !== null) {
    const dx = aimX - e.x, dz = aimZ - e.z, d = Math.hypot(dx, dz) || 1, ey = g.eyeY(e);
    b.onTarget += dt; b.errT -= dt;
    const sig = (sk.err0 * Math.exp(-b.onTarget / sk.settle) + sk.err1) * (1 + tgt.speed * 0.11) * (1 + e.speed * 0.07) * (e.crouch > 0.5 ? 0.85 : 1);
    if (b.errT <= 0) { b.errT = 0.22 + r() * 0.25; b.errTY = gauss(r) * sig; b.errTP = gauss(r) * sig * 0.7; }
    const kk = Math.min(1, dt * 7); b.errY += (b.errTY - b.errY) * kk; b.errP += (b.errTP - b.errP) * kk;
    wy = Math.atan2(-dx, -dz) + b.errY; wp = Math.atan2(aimY - ey, d) + b.errP;
    b.react -= dt;
    const off = Math.abs(wrap(wy - e.yaw)) + Math.abs(wp - e.pitch);
    if (b.react <= 0 && b.visible && off < 0.09) {
      if (b.burstT > 0) { b.burstT -= dt; c.fire = true; if (b.burstT <= 0) b.pauseT = 0.18 + r() * (d > 14 ? 0.55 : 0.25); }
      else { b.pauseT -= dt; if (b.pauseT <= 0) b.burstT = d < 8 ? 0.5 + r() * 0.6 : 0.22 + r() * 0.35; }
    }
  } else {
    wy = lookYaw !== null ? lookYaw : (Math.hypot(c.wx, c.wz) > 0.2 ? Math.atan2(-c.wx, -c.wz) : e.yaw);
    wp = 0;
  }
  const maxTurn = sk.turn * dt * (aimX !== null ? 1 : 0.7);
  e.yaw = wrap(e.yaw + clamp(wrap(wy - e.yaw), -maxTurn, maxTurn));
  e.pitch += clamp(wp - e.pitch, -maxTurn, maxTurn);
}
function gauss(r) { return (r() + r() + r() + r() - 2) * 0.866 * 2; }
