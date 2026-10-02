// 戰鬥：開火、hitscan／彈道、散布與準心、換彈、十字鎬採集（含弱點）、消耗品、傷害結算（SPEC §6）
// 公開 API（其他模組可用）：
//   crosshairSpread(actor) -> 弧度（半角，已平滑；開火瞬間張開、之後回收）
//   crosshairPixels(actor, viewH = 1080) -> 該散布在 viewH 高的畫面上的半徑像素
//   weaponInfo(actor) -> { item, st, spread, reserve, ads, reloading, equip, mag }
//   weakPoint -> 玩家目前的採集弱點 { active, owner, point, normal, t }
//   projectiles -> 彈道子彈池（fx 讀取畫曳光）
//   rayActors(origin, dir, maxT, ignore)
// 新事件：'impact'、'dryFire'、'equip'、'consume'、'shieldBreak'，另外 'shot' 多了 projectile / ends 欄位。
import * as THREE from 'three';
import { weaponStat, falloffMul, CONSUMABLES, PICKAXE } from './items.js';
import { clamp, damp } from './shared.js';
import { MOVE } from './config.js';

const HARVEST = { wood: 7, stone: 6, metal: 5 };
const BUILD_MUL = 0.7;          // 子彈對建材的傷害倍率（十字鎬仍是 50）
const OBJ_MUL = 0.3;            // 子彈對樹、岩石等場景物件（有 takeDamage）的倍率；owner.bulletMul 可覆寫
const WEAK_R = 0.5;             // 弱點判定半徑（m）
const WEAK_LIFE = 9;            // 弱點存留秒數
const BUF_T = 0.18;             // 半自動提前按下的緩衝秒數
const MAX_PROJ = 24;

const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _h = new THREE.Vector3(), _m = new THREE.Vector3(), _u = new THREE.Vector3(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
const _ux = new THREE.Vector3(), _uy = new THREE.Vector3(), _dir = new THREE.Vector3(), _up = new THREE.Vector3(), _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3(), _o2 = new THREE.Vector3(), _n = new THREE.Vector3();
const _hits = [];

export class Combat {
  constructor(ctx) {
    this.ctx = ctx;
    this.projectiles = [];
    for (let i = 0; i < MAX_PROJ; i++) this.projectiles.push({ active: false, owner: null, item: null, st: null, pos: new THREE.Vector3(), vel: new THREE.Vector3(), from: new THREE.Vector3(), t: 0, travel: 0 });
    this.weakPoint = { active: false, owner: null, point: new THREE.Vector3(), normal: new THREE.Vector3(0, 1, 0), t: 0 };
    ctx.events.on('damage', (d) => this._onDamage(d));
    ctx.events.on('matchState', ({ state }) => { if (state === 'bus') this.reset(); });
  }
  reset() { for (const p of this.projectiles) p.active = false; this.weakPoint.active = false; }
  _onDamage(d) {
    const ctx = this.ctx, t = d.target;
    if (t.shield <= 0.001 && d.shieldDamage > 0) ctx.events.emit('shieldBreak', { actor: t, point: d.point });
    if (t === ctx.player && d.amount > 0 && d.source && d.source !== t) ctx.cam?.shake?.(clamp(0.1 + d.amount / 160, 0.1, 0.45), 0.2);
  }

  // ---------- 幾何 ----------
  // 射線 vs 球
  _sphere(o, d, c, r, maxT) {
    _u.copy(c).sub(o); const tca = _u.dot(d); if (tca < 0) return -1;
    const d2 = _u.lengthSq() - tca * tca; if (d2 > r * r) return -1;
    const t = tca - Math.sqrt(r * r - d2); return t >= 0 && t <= maxT ? t : (t < 0 && tca <= maxT ? 0 : -1);
  }
  // 射線 vs 膠囊（線段 p0→p1，半徑 r）
  _capsule(o, d, p0, p1, r, maxT) {
    _u.copy(p1).sub(p0); const e2 = _u.dot(_u), b = d.dot(_u);
    _v.copy(o).sub(p0); const dd = d.dot(_v), ee = _u.dot(_v), D = e2 - b * b;
    let s = D < 1e-8 ? 0 : (ee - b * dd) / D; s = clamp(s, 0, 1);
    let t = s * b - dd; if (t < 0) t = 0;
    s = clamp((t * b + ee) / e2, 0, 1);
    _w.copy(p0).addScaledVector(_u, s);
    _v.copy(o).addScaledVector(d, t).sub(_w); const dist = _v.length();
    if (dist > r) return -1;
    const tt = t - Math.sqrt(Math.max(0, r * r - dist * dist));
    return tt <= maxT ? Math.max(0, tt) : -1;
  }
  // 射線打到的存活 actor（最近）。回傳 { actor, t, head } 或 null
  rayActors(origin, dir, maxT, ignore) {
    let best = null;
    for (const a of this.ctx.actors) {
      if (a === ignore || !a.alive || a.state === 'bus') continue;
      const dx = a.pos.x - origin.x, dz = a.pos.z - origin.z;
      if (dx * dx + dz * dz > (maxT + 2) * (maxT + 2)) continue;
      a.headCenter(_h);
      let t = this._sphere(origin, dir, _h, MOVE.headR, maxT), head = t >= 0;
      _m.set(a.pos.x, a.pos.y + 0.4, a.pos.z);
      const top = a.crouching ? 0.85 : (a.state === 'skydive' ? 0.4 : 1.3);
      _w.set(a.pos.x, a.pos.y + top, a.pos.z);
      const tb = this._capsule(origin, dir, _m, _w, 0.36, maxT);
      if (!head || (tb >= 0 && tb < t - 0.05)) { if (tb >= 0) { t = tb; head = false; } }
      if (t >= 0 && (!best || t < best.t)) best = { actor: a, t, head };
    }
    return best;
  }
  computeAim(a) {
    const I = a.intent; a.eyePos(a.aim.origin);
    if (I.aimPoint) { a.aim.dir.copy(I.aimPoint).sub(a.aim.origin); if (a.aim.dir.lengthSq() < 1) a.forward(a.aim.dir); }
    else a.forward(a.aim.dir);
    a.aim.dir.normalize();
  }

  // ---------- 內部狀態與散布 ----------
  _cs(a) {
    const cs = a.cs;
    if (cs.sel === undefined) {
      cs.sel = 1; cs.uid = -1; cs.equip = 0; cs.buf = 0; cs.prevFire = false; cs.since = 9; cs.burst = 0; cs.xh = 0.015;
      cs.swing = -1; cs.lock = false; cs.dry = 0; cs.cd = cs.cd || 0; cs.bloom = cs.bloom || 0; cs.weak = null;
    }
    return cs;
  }
  _isAds(a) { return !!a.intent.ads && a.state === 'ground'; }
  // 目前實際散布（弧度）。forShot：開火當下，AR 在 ADS＋站定＋沒累積 bloom 時第一發 0 散布。
  _spread(a, st, cs, forShot) {
    const ads = this._isAds(a), speed = Math.hypot(a.vel.x, a.vel.z);
    if (forShot && st.firstShot && ads && speed < 0.5 && a.grounded && cs.bloom <= 0.0008) return 0;
    const base = ads ? st.spreadAds : st.spreadHip;
    const mul = (speed > 0.5 ? 1.6 : 1) * (a.grounded ? 1 : 2.5) * (a.crouching ? 0.8 : 1);
    return (base + cs.bloom * (ads ? 0.45 : 1)) * mul;
  }
  crosshairSpread(a = this.ctx.player) { return this._cs(a).xh; }
  crosshairPixels(a = this.ctx.player, viewH = 1080) { const c = this.ctx.camera; return Math.tan(this.crosshairSpread(a)) / Math.tan(c.fov * Math.PI / 360) * viewH * 0.5; }
  weaponInfo(a) {
    const it = a.inventory.current(); if (!it || it.kind !== 'weapon') return null;
    const cs = this._cs(a), st = weaponStat(it);
    return { item: it, st, spread: st.melee ? 0 : cs.xh, reserve: st.ammo ? a.inventory.ammo[st.ammo] : 0, ads: this._isAds(a), reloading: !!(a.action && a.action.kind === 'reload'), equip: cs.equip, mag: it.mag };
  }

  fixedUpdate(dt) {
    for (const a of this.ctx.actors) if (a.alive) this.updateActor(a, dt);
    this.stepProjectiles(dt);
  }

  cancelAction(a) {
    const act = a.action;
    if (act && (act.kind === 'reload' || act.kind === 'consume')) {
      a.action = null;
      if (act.kind === 'reload') this.ctx.events.emit('reload', { actor: a, weapon: act.data.item.defId, phase: 'cancel' });
      else this.ctx.events.emit('consume', { actor: a, item: act.data.item, phase: 'cancel' });
    }
  }
  startReload(a, it, st) {
    const inv = a.inventory;
    if (a.action || it.mag >= st.mag || inv.ammo[st.ammo] <= 0) return false;
    a.action = { kind: 'reload', t: 0, duration: st.reload, data: { item: it } };
    a.view?.playOneShot('reload');
    this.ctx.events.emit('reload', { actor: a, weapon: it.defId, phase: 'start' });
    return true;
  }

  updateActor(a, dt) {
    const I = a.intent, inv = a.inventory, cs = this._cs(a);
    cs.since += dt;
    if (cs.dry > 0) cs.dry -= dt;
    if (cs.weak && cs.weak.active && (cs.weak.t -= dt) <= 0) cs.weak.active = false;
    if (a.state !== 'ground' && a.state !== 'air') { cs.cd = Math.max(-dt, cs.cd - dt); return; }
    cs.cd = Math.max(-dt, cs.cd - dt);
    if (cs.equip > 0) cs.equip = Math.max(0, cs.equip - dt);
    // 切欄位
    if (I.slot >= 0 && I.slot !== inv.selected && (I.slot === 0 || inv.slots[I.slot - 1])) { this.cancelAction(a); inv.selected = I.slot; a.building = false; }
    // 目前手持物消失（用完）
    if (inv.selected > 0 && !inv.slots[inv.selected - 1]) { inv.selected = 0; this.cancelAction(a); }
    this.computeAim(a);
    const it = inv.current();
    // 手持物改變（任何原因，包含撿起後自動切換）→ 重新準備
    const uid = it ? it.uid : -1;
    if (cs.uid !== uid) {
      const first = cs.uid === -1;
      // 冷卻跟著物品走（不會讓上一把狙擊的 2.5 s 冷卻卡住下一把槍；切回去也不能靠換槍洗掉冷卻）
      const now = this.ctx.time.now;
      if (cs.item && cs.item !== PICKAXE) { cs.item.cdLeft = Math.max(0, cs.cd); cs.item.cdAt = now; }
      cs.cd = it && it !== PICKAXE && it.cdLeft ? Math.max(0, it.cdLeft - (now - it.cdAt)) : 0;
      cs.item = it;
      cs.uid = uid; cs.bloom = 0; cs.burst = 0; cs.buf = 0; cs.swing = -1; cs.lock = false;
      const def = it && (it.kind === 'weapon' ? weaponStat(it) : CONSUMABLES[it.defId]);
      cs.equip = def ? (def.equip || 0.3) : 0;
      if (!first && it) this.ctx.events.emit('equip', { actor: a, item: it });
      if (a.action && a.action.kind !== 'open' && a.action.data && a.action.data.item !== it) this.cancelAction(a);
    }
    const fireEdge = I.fire && !cs.prevFire; cs.prevFire = I.fire;
    // 進行中的動作
    const act = a.action;
    if (act) {
      if (act.kind === 'reload') {
        if (inv.current() !== act.data.item) { a.action = null; this.ctx.events.emit('reload', { actor: a, weapon: act.data.item.defId, phase: 'cancel' }); }
        else {
          act.t += dt;
          const st = weaponStat(act.data.item);
          if (act.t >= act.duration) {
            const w = act.data.item;
            if (st.perShell) {
              if (inv.ammo[st.ammo] > 0 && w.mag < st.mag) { w.mag++; inv.ammo[st.ammo]--; }
              a.action = null; this.ctx.events.emit('reload', { actor: a, weapon: w.defId, phase: 'shell' });
              if (w.mag < st.mag && inv.ammo[st.ammo] > 0) this.startReload(a, w, st); else this.ctx.events.emit('reload', { actor: a, weapon: w.defId, phase: 'end' });
            } else { const n = Math.min(st.mag - w.mag, inv.ammo[st.ammo]); w.mag += n; inv.ammo[st.ammo] -= n; a.action = null; this.ctx.events.emit('reload', { actor: a, weapon: w.defId, phase: 'end' }); }
          }
        }
      } else if (act.kind === 'consume') {
        if (!I.fire || inv.current() !== act.data.item) { a.action = null; this.ctx.events.emit('consume', { actor: a, item: act.data.item, phase: 'cancel' }); }
        else {
          act.t += dt;
          if (act.t >= act.duration) {
            const w = act.data.item, def = CONSUMABLES[w.defId];
            a.heal(def.heal, def.amount, def.cap);
            w.count--; a.action = null; if (a.isPlayer) cs.lock = true;
            this.ctx.events.emit('consume', { actor: a, item: w, phase: 'end' });
            if (w.count <= 0) { const i = inv.slots.indexOf(w); if (i >= 0) inv.slots[i] = null; inv.selected = 0; }
          }
        }
      }
    }
    if (!I.fire) cs.lock = false;
    if (a.building || !it) { this._xh(a, null, cs, dt); return; }
    if (it.kind === 'consumable') {
      const def = CONSUMABLES[it.defId];
      const cur = def.heal === 'health' ? a.health : a.shield;
      if (I.fire && !a.action && !cs.lock && cs.equip <= 0 && cur < Math.min(100, def.cap)) {
        a.action = { kind: 'consume', t: 0, duration: def.use, data: { item: it } };
        a.view?.playOneShot('consume');
        this.ctx.events.emit('consume', { actor: a, item: it, phase: 'start' });
      }
      this._xh(a, null, cs, dt); return;
    }
    if (it.kind !== 'weapon') { this._xh(a, null, cs, dt); return; }
    const st = weaponStat(it);
    // 十字鎬
    if (st.melee) {
      if (cs.swing >= 0) { cs.swing += dt; if (cs.swing >= st.hitDelay) { cs.swing = -1; this.meleeHit(a, st, cs); } }
      if (I.fire && cs.cd <= 0 && cs.equip <= 0 && cs.swing < 0) { cs.cd += 1 / st.rate; cs.swing = 0; a.view?.playOneShot('pickaxe'); this.ctx.events.emit('swing', { actor: a }); }
      this._xh(a, null, cs, dt); return;
    }
    // 槍
    if (cs.since > st.bloomDelay) cs.bloom = Math.max(0, cs.bloom - st.bloomRecover * dt);
    if (cs.since > 0.45) cs.burst = 0;
    const reserve = inv.ammo[st.ammo];
    if (I.reload) this.startReload(a, it, st);
    if (it.mag <= 0 && !a.action) this.startReload(a, it, st);   // 彈匣空自動換
    // 半自動：玩家按一下開一槍（提前按下可緩衝）；bot 一直按著 fire，所以直接放行
    let want;
    if (st.auto || !a.isPlayer) want = I.fire;
    else { cs.buf = fireEdge ? BUF_T : Math.max(0, cs.buf - dt); want = cs.buf > 0; }
    if (fireEdge && it.mag <= 0 && reserve <= 0 && cs.dry <= 0 && a.isPlayer) { cs.dry = 0.35; this.ctx.events.emit('dryFire', { actor: a, weapon: it.defId }); }
    if (want && cs.cd <= 0 && cs.equip <= 0 && it.mag > 0) {
      const ra = a.action && a.action.kind === 'reload';
      if (ra && st.perShell) this.cancelAction(a);           // 泵動可中斷裝填
      if (!a.action) { this.shoot(a, it, st, cs); cs.buf = 0; }
    }
    this._xh(a, st, cs, dt);
  }
  // 準心平滑：張開快、收回慢
  _xh(a, st, cs, dt) {
    const target = st ? this._spread(a, st, cs, false) : 0.012;
    cs.xh = damp(cs.xh, target, target > cs.xh ? 40 : 9, dt);
  }

  // ---------- 開火 ----------
  shoot(a, it, st, cs) {
    const ev = this.ctx.events, o = a.aim.origin, base = a.aim.dir;
    const spread = this._spread(a, st, cs, true), ads = this._isAds(a);
    _up.set(0, Math.abs(base.y) > 0.95 ? 0 : 1, Math.abs(base.y) > 0.95 ? 1 : 0);
    _ux.crossVectors(base, _up).normalize(); _uy.crossVectors(_ux, base);
    _hits.length = 0;
    let firstHit = null, firstEnd = null; const ends = [];
    const proj = st.proj;
    for (let p = 0; p < st.pellets; p++) {
      const ang = Math.tan(spread * Math.sqrt(Math.random())), az = Math.random() * Math.PI * 2;
      _dir.copy(base).addScaledVector(_ux, Math.cos(az) * ang).addScaledVector(_uy, Math.sin(az) * ang).normalize();
      if (proj) {
        this.spawnProjectile(a, it, st, o, _dir);
        if (p === 0) { const wh = this.ctx.physics.raycast(o, _dir, 400, {}); firstEnd = (wh ? wh.point : _o.copy(o).addScaledVector(_dir, 400)).clone(); }
        continue;
      }
      const wh = this.ctx.physics.raycast(o, _dir, 400, {});
      const wd = wh ? wh.dist : 400;
      const ah = this.rayActors(o, _dir, wd, a);
      let end, hit = null;
      if (ah) {
        let e = null; for (const x of _hits) if (x.actor === ah.actor) { e = x; break; }
        if (!e) { e = { actor: ah.actor, dmg: 0, head: false, point: new THREE.Vector3(), pts: [] }; _hits.push(e); }
        e.dmg += st.dmg * falloffMul(st, ah.t) * (ah.head ? st.head : 1);
        e.head = e.head || ah.head; e.point.copy(o).addScaledVector(_dir, ah.t);
        if (e.pts.length < 3) e.pts.push(e.point.clone());
        end = e.point.clone(); hit = { actor: ah.actor, point: end };
      } else if (wh) {
        end = wh.point; hit = { point: wh.point, owner: wh.owner };
        this._worldImpact(a, it, st, wh, 1);
      } else end = _o.copy(o).addScaledVector(_dir, 400).clone();
      if (p === 0) { firstHit = hit; firstEnd = end; }
      if (ends.length < 4) ends.push(end);
    }
    for (const e of _hits) {
      const r = e.actor.takeDamage(e.dmg, { source: a, weapon: it.defId, headshot: e.head, point: e.point });
      for (const pt of e.pts) ev.emit('impact', { point: pt, normal: null, surface: r.shieldDamage > 0 ? 'shield' : 'flesh', actor: e.actor, owner: null, weapon: it.defId, head: e.head, killed: r.killed, shot: a });
    }
    // 節奏、彈藥、bloom
    cs.cd = Math.max(cs.cd, -0.0167) + 1 / st.rate; it.mag--; cs.since = 0;
    cs.bloom = Math.min(st.bloomMax || 0, cs.bloom + st.bloom);
    cs.xh = Math.max(cs.xh, this._spread(a, st, cs, false));
    const from = a.view ? a.view.muzzleWorld(new THREE.Vector3()) : o.clone();
    ev.emit('shot', { actor: a, weapon: it.defId, from, to: firstEnd, hit: firstHit, projectile: !!proj, ends, pellets: st.pellets });
    // 後座力與鏡頭震動（只有玩家）
    if (a.isPlayer) {
      const rc = st.recoil, r = rc[cs.burst % rc.length], k = ads ? (st.adsRecoil || 1) : 1;
      cs.burst++;
      const cam = this.ctx.cam;
      if (cam && cam.addRecoil) cam.addRecoil(r[0] * k, r[1] * k); else a.recoil = (a.recoil || 0) + r[0] * k;
      if (st.shake) cam?.shake?.(st.shake[0], st.shake[1]);
    }
    cs.burst = a.isPlayer ? cs.burst : 0;
  }
  // 命中場景：地形／建材／道具。回傳 impact 事件，建材才會受子彈傷害。
  _worldImpact(a, it, st, wh, k) {
    const ow = wh.owner;
    let dmgMul = 0;
    if (ow && ow.takeDamage) dmgMul = ow.bulletMul !== undefined ? ow.bulletMul : ow.kind === 'build' ? BUILD_MUL : OBJ_MUL;
    if (dmgMul > 0 && ow.takeDamage) ow.takeDamage(st.dmg * falloffMul(st, wh.dist) * dmgMul * k, { source: a, weapon: it.defId });
    this.ctx.events.emit('impact', { point: wh.point, normal: wh.normal, surface: this.surfaceOf(wh), actor: null, owner: ow, weapon: it.defId, kind: wh.kind, shot: a });
  }
  surfaceOf(wh) {
    const ow = wh.owner;
    if (ow) {
      if (ow.kind === 'build') return ow.mat || 'wood';
      if (ow.harvest && ow.harvest.material) return ow.harvest.material;
      if (ow.kind === 'tree') return 'wood';
      if (ow.kind === 'rock') return 'stone';
      return ow.surface || 'wood';
    }
    if (wh.kind === 'terrain' || !wh.kind) {
      const s = this.ctx.terrain.surfaceType(wh.point.x, wh.point.z);
      return s === 'path' ? 'dirt' : s;
    }
    return 'stone';
  }

  // ---------- 彈道子彈（狙擊） ----------
  spawnProjectile(a, it, st, o, dir) {
    let p = null; for (const q of this.projectiles) if (!q.active) { p = q; break; }
    if (!p) p = this.projectiles.reduce((x, y) => (x.t > y.t ? x : y));
    p.active = true; p.owner = a; p.item = it; p.st = st; p.t = 0; p.travel = 0;
    p.pos.copy(o); p.from.copy(o); p.vel.copy(dir).multiplyScalar(st.proj.speed);
  }
  stepProjectiles(dt) {
    const P = this.ctx.physics;
    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.vel.y -= p.st.proj.grav * dt;
      const sp = p.vel.length(), seg = sp * dt;
      _d.copy(p.vel).divideScalar(sp);
      const wh = P.raycast(p.pos, _d, seg, {});
      const wd = wh ? wh.dist : seg;
      const ah = this.rayActors(p.pos, _d, wd, p.owner);
      if (ah) {
        const a = p.owner, it = p.item, st = p.st;
        const pt = new THREE.Vector3().copy(p.pos).addScaledVector(_d, ah.t);
        const dmg = st.dmg * falloffMul(st, p.travel + ah.t) * (ah.head ? st.head : 1);
        const r = ah.actor.takeDamage(dmg, { source: a, weapon: it.defId, headshot: ah.head, point: pt });
        this.ctx.events.emit('impact', { point: pt, normal: null, surface: r.shieldDamage > 0 ? 'shield' : 'flesh', actor: ah.actor, owner: null, weapon: it.defId, head: ah.head, killed: r.killed, shot: a });
        p.pos.copy(pt); p.active = false; continue;
      }
      if (wh) {
        this._worldImpact(p.owner, p.item, p.st, wh, 1);
        p.pos.copy(wh.point); p.active = false; continue;
      }
      p.pos.addScaledVector(_d, seg); p.travel += seg; p.t += dt;
      if (p.t > 4 || p.pos.y < -40 || Math.abs(p.pos.x) > 800 || Math.abs(p.pos.z) > 800) p.active = false;
    }
  }

  // ---------- 十字鎬 ----------
  meleeHit(a, st, cs) {
    this.computeAim(a);
    const ev = this.ctx.events, P = this.ctx.physics, R = st.range, o = a.aim.origin, base = a.aim.dir;
    _up.set(0, Math.abs(base.y) > 0.95 ? 0 : 1, Math.abs(base.y) > 0.95 ? 1 : 0);
    _ux.crossVectors(base, _up).normalize(); _uy.crossVectors(_ux, base);
    let best = null, bs = 1e9;
    for (let k = 0; k < 5; k++) {   // 中心射線 + 四條輔助射線（寬容的揮擊）
      const sx = k === 1 ? -0.2 : k === 2 ? 0.2 : 0, sy = k === 3 ? -0.22 : k === 4 ? 0.16 : 0;
      _dir.copy(base).addScaledVector(_ux, sx).addScaledVector(_uy, sy).normalize();
      const wh = P.raycast(o, _dir, R, {});
      const wd = wh ? Math.min(wh.dist, R) : R;
      const ah = this.rayActors(o, _dir, wd, a);
      let score = 1e9, cand = null;
      if (ah) { score = ah.t - 1.5 + k * 0.25; cand = { actor: ah.actor, t: ah.t, head: ah.head, dir: _dir.clone() }; }
      else if (wh) {
        const ow = wh.owner, useful = ow && (ow.harvest || ow.takeDamage);
        score = wh.dist + k * 0.35 + (wh.kind === 'terrain' ? 1.2 : 0) + (useful ? 0 : 0.8);
        cand = { wh, dir: _dir.clone() };
      }
      if (cand && score < bs) { bs = score; best = cand; }
    }
    if (!best) return;
    if (best.actor) {
      const pt = new THREE.Vector3().copy(o).addScaledVector(best.dir, best.t);
      const r = best.actor.takeDamage(st.dmg, { source: a, weapon: 'pickaxe', point: pt, headshot: false });
      ev.emit('impact', { point: pt, normal: null, surface: r.shieldDamage > 0 ? 'shield' : 'flesh', actor: best.actor, owner: null, weapon: 'pickaxe', head: false, killed: r.killed, shot: a });
      return;
    }
    const wh = best.wh, ow = wh.owner;
    let hitSurface = this.surfaceOf(wh);
    if (ow && ow.harvest) {
      const mat = ow.harvest.material;
      const wk = cs.weak, weak = !!(wk && wk.active && wk.owner === ow && wk.point.distanceTo(wh.point) < WEAK_R);
      const mul = weak ? 2 : 1;
      const base0 = ow.harvest.amount || HARVEST[mat];
      const amt = a.inventory.addMat(mat, Math.round(base0 * mul));
      if (ow.takeDamage) ow.takeDamage(20 * mul, { source: a, weapon: 'pickaxe', weak });
      ev.emit('harvest', { actor: a, material: mat, amount: amt, point: wh.point, normal: wh.normal, weakPoint: weak, owner: ow });
      const gone = ow.dead || (ow.hp !== undefined && ow.hp <= 0);
      if (gone) { if (wk) wk.active = false; } else this.spawnWeak(a, cs, ow, wh);
      hitSurface = mat;
    } else if (ow && ow.takeDamage) {
      ow.takeDamage(ow.kind === 'build' ? 50 : 20, { source: a, weapon: 'pickaxe' });
    }
    ev.emit('impact', { point: wh.point, normal: wh.normal, surface: hitSurface, actor: null, owner: ow, weapon: 'pickaxe', kind: wh.kind, shot: a });
  }
  // 在被採集物表面的另一個隨機位置放一個弱點
  spawnWeak(a, cs, ow, wh) {
    if (!cs.weak) cs.weak = a.isPlayer ? this.weakPoint : { active: false, owner: null, point: new THREE.Vector3(), normal: new THREE.Vector3(0, 1, 0), t: 0 };
    const wk = cs.weak;
    _n.copy(wh.normal || _up.set(0, 1, 0));
    _up.set(0, Math.abs(_n.y) > 0.9 ? 0 : 1, Math.abs(_n.y) > 0.9 ? 1 : 0);
    _t1.crossVectors(_n, _up).normalize(); _t2.crossVectors(_n, _t1);
    for (let k = 0; k < 6; k++) {
      const ang = Math.random() * Math.PI * 2, r = 0.45 + Math.random() * 0.5;
      _o2.copy(wh.point).addScaledVector(_n, 0.7).addScaledVector(_t1, Math.cos(ang) * r).addScaledVector(_t2, Math.sin(ang) * r);
      _d.copy(_n).negate();
      const h = this.ctx.physics.raycast(_o2, _d, 1.6, {});
      if (h && h.owner === ow && h.point.distanceTo(wh.point) < 1.3) {
        wk.point.copy(h.point); wk.normal.copy(h.normal); wk.owner = ow; wk.active = true; wk.t = WEAK_LIFE; return;
      }
    }
    wk.active = false;
  }
}
