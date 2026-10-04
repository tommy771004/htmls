// 普攻連段、技能、投射物、區域效果。
import { COMBO_WINDOW, KI_BAR, SPARK, RECALL_TIME, WARD, CONTROL } from './config.js';
import {
  damage, dist, dist2, angTo, clamp, steer, face, enemiesNear, nearestEnemy, targetable, vulnerable, moveSpeed, interrupt, cancelRecall, addKi, heal,
} from './units.js';
import { collide, blocked, walkable, heightAt as heightAtXZ } from './map.js';
import { findPath } from './nav.js';
import { seen as seenBy } from './vision.js';

const sin = Math.sin, cos = Math.cos;
// 技能與範圍傷害不會打到眼（眼只能用普攻點掉）
const hittable = (G, u) => u.kind !== 'ward' && targetable(G, u);
const rankOf = (h, k) => h.ranks[k] - 1;
const sk = (h, k) => h.def.skills[k];
const skillDmg = (h, k) => { const s = sk(h, k), r = Math.max(0, rankOf(h, k)); return s.dmg[Math.min(r, s.dmg.length - 1)] + (s.adR || 0) * h.ad; };
const sfx = (G, name, at, o) => G.sfx && G.sfx(name, at, o);
const fx = (G) => G.fx;

/* ---------------- 投射物 ---------------- */
// p: { x,z,y, ang, speed, range, team, src, radius, pierce, onHit(G,p,u)->stop?, target(homing), onArrive, vis, life }
export function spawnProjectile(G, p) {
  p.traveled = 0; p.hit = new Set(); p.y ??= 1.2; p.life ??= 4;
  G.projectiles.push(p); return p;
}
export function updateProjectiles(G, dt) {
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const p = G.projectiles[i];
    let done = false;
    p.life -= dt;
    if (p.target) {
      const t = p.target;
      if (!t.alive) { done = true; }
      else {
        const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz), step = p.speed * dt;
        p.ang = Math.atan2(dx, dz);
        if (d <= step + t.radius * 0.5) { p.x = t.x; p.z = t.z; p.onArrive && p.onArrive(G, p, t); done = true; }
        else { p.x += (dx / d) * step; p.z += (dz / d) * step; }
      }
    } else {
      const step = p.speed * dt;
      p.x += sin(p.ang) * step; p.z += cos(p.ang) * step; p.traveled += step;
      for (const u of G.units) {
        if (!u.alive || u.team === p.team || p.hit.has(u) || u.st.invuln > 0 || u.kind === 'ward') continue;
        if (p.skipStructures && (u.kind === 'tower' || u.kind === 'core')) continue;
        const rr = u.radius + p.radius;
        if (dist2(u, p) < rr * rr) {
          p.hit.add(u);
          if (p.onHit(G, p, u) !== false && !p.pierce) { done = true; break; }
        }
      }
      if (p.boomerang && p.traveled >= p.range && !p.returning) { p.returning = true; p.hit.clear(); }
      if (p.returning) { const src = p.src; p.ang = Math.atan2(src.x - p.x, src.z - p.z); if (Math.hypot(src.x - p.x, src.z - p.z) < 1.2 || !src.alive) done = true; }
      else if (p.traveled >= p.range) { p.onEnd && p.onEnd(G, p); done = true; }
    }
    if (p.life <= 0) done = true;
    if (p.vis) p.vis.update(p, dt);
    if (done) { p.vis && p.vis.remove(); G.projectiles.splice(i, 1); }
  }
}

/* ---------------- 區域效果 ---------------- */
export function updateZones(G, dt) {
  for (let i = G.zones.length - 1; i >= 0; i--) {
    const z = G.zones[i]; z.t += dt;
    z.tick && z.tick(G, z, dt);
    if (z.t >= z.dur) { z.vis && z.vis.remove(); G.zones.splice(i, 1); }
  }
}

/* ---------------- 普攻 ---------------- */
const CHAIN = [
  { anim: 'atk1', wind: 0.12, mul: 1.0, type: 'L' },
  { anim: 'atk2', wind: 0.14, mul: 1.12, type: 'M' },
  { anim: 'atk3', wind: 0.2, mul: 1.5, type: 'H' },
];
function startAuto(G, h, t) {
  if (G.time - h.chainT > COMBO_WINDOW || h.chainTarget !== t) h.chain = 0;
  const c = CHAIN[h.chain];
  const as = h.st.haste > 0 ? h.as * (1 - (h.st.hasteAs || 0)) : h.as;
  const spd = Math.min(1, as / 0.8);
  const wind = c.wind * spd, total = Math.max(as * (h.chain === 2 ? 1.25 : 1), wind + 0.12);
  h.atkCd = total;
  face(h, t.x, t.z);
  const idx = h.chain;
  h.action = {
    name: c.anim, t: 0, dur: Math.min(total, wind + 0.28), hitDone: false, auto: true,
    step(G, h, dt) {
      if (!this.hitDone && this.t >= wind) {
        this.hitDone = true;
        if (!t.alive || !targetable(G, t)) return;
        face(h, t.x, t.z);
        autoHit(G, h, t, idx);
      }
    },
  };
  h.anim.name = c.anim; h.anim.t = 0;
  h.chainT = G.time; h.chainTarget = t;
  if (h.def.melee) sfx(G, h.def.blade ? 'slash' : 'swing', h, { vol: idx === 2 ? 0.7 : 0.5 });
  G.emit('swing', { h, idx });
  h.chain = (h.chain + 1) % 3;
}
function autoHit(G, h, t, idx) {
  const c = CHAIN[idx];
  let dmg = h.ad * c.mul, opts = { type: c.type };
  if (idx === 2) { opts.knock = 10; opts.stun = 0.18; }
  if (h.empowered > G.time) { dmg *= 1.5; opts.stun = 0.7; opts.type = 'H'; opts.knock = 6; h.empowered = 0; fx(G).ring(t.x, t.z, h.def.color, 2.4, 0.35); }
  const col = h.def.color;
  if (h.def.melee) {
    damage(G, h, t, dmg, opts);
    const a = angTo(h, t);
    fx(G).hitSpark(t.x - sin(a) * t.radius * 0.6, 1.1 + t.y, t.z - cos(a) * t.radius * 0.6, col, idx === 2 ? 1.5 : 1, idx === 2 ? 'heavy' : 'light');
    sfx(G, idx === 2 ? 'hitH' : idx === 1 ? 'hitM' : 'hitL', h);
    if (h === G.player) G.shake(idx === 2 ? 0.45 : 0.18, a);
  } else {
    const p = spawnProjectile(G, {
      x: h.x + sin(h.facing) * 0.8, z: h.z + cos(h.facing) * 0.8, y: 1.3, speed: 30, team: h.team, src: h, target: t, radius: 0.3,
      onArrive(G, p, u) {
        damage(G, h, u, dmg, opts);
        fx(G).hitSpark(u.x, 1.1 + u.y, u.z, col, idx === 2 ? 1.3 : 0.85, 'light');
        if (h.heroId === 'nami') { fx(G).lightning({ x: u.x + 0.6, y: 7, z: u.z - 0.6 }, { x: u.x, y: 1 + u.y, z: u.z }, '#ffe36a'); if (idx === 2) sfx(G, 'thunder', u, { vol: 0.4 }); }
        sfx(G, idx === 2 ? 'hitM' : 'hitL', u);
        if (h === G.player) G.shake(idx === 2 ? 0.3 : 0.12);
      },
    });
    p.vis = fx(G).bolt(col, idx === 2 ? 0.55 : 0.38);
    sfx(G, 'blast', h, { vol: 0.35 });
  }
}

/* ---------------- 英雄每步 ---------------- */
export function heroAct(G, h, dt) {
  h.atkCd -= dt;
  h.anim.t += dt;
  if (h.action) {
    const a = h.action; a.t += dt;
    if (a.name) { if (h.anim.name !== a.name) { h.anim.name = a.name; h.anim.t = a.t; } }
    a.step && a.step(G, h, dt);
    if (h.action === a && a.t >= a.dur) { a.end && a.end(G, h); if (h.action === a) h.action = null; }
    return;
  }
  if (h.st.stun > 0 || h.y > 0.05) { h.anim.name = h.y > 0.05 ? 'air' : 'stun'; return; }
  if (h.charging) { setAnim(h, 'charge'); return; }
  if (h.recall > 0) { setAnim(h, 'charge'); return; }
  const spd = moveSpeed(h);
  // 攻擊指令
  let t = h.target;
  if (t && (!t.alive || !targetable(G, t) || t.team === h.team)) { t = h.target = null; }
  if (!t && !h.goal && h.autoAcquire !== false) {
    const near = nearestEnemy(G, h, h.range + 1.2, (o) => o.team <= 1 && targetable(G, o) && (!G.vision || seenBy(G, h.team, o)));
    if (near) t = near;
  }
  if (t) {
    const d = dist(h, t) - t.radius - h.radius;
    if (d > h.range) { steer(G, h, t.x, t.z, spd, dt, 0); setAnim(h, 'run'); return; }
    if (h.atkCd <= 0) { startAuto(G, h, t); return; }
    face(h, t.x, t.z); setAnim(h, 'idle'); return;
  }
  if (h.goal) {
    let wx = h.goal.x, wz = h.goal.z, last = true;
    if (h.path && h.path.length) { wx = h.path[0].x; wz = h.path[0].z; last = h.path.length === 1; }
    const arrived = steer(G, h, wx, wz, spd, dt, last ? 0.25 : 0.9);
    if (arrived) { if (h.path && h.path.length > 1) h.path.shift(); else { h.goal = null; h.path = null; setAnim(h, 'idle'); return; } }
    setAnim(h, 'run');
    return;
  }
  setAnim(h, 'idle');
}
function setAnim(h, n) { if (h.anim.name !== n) { h.anim.name = n; h.anim.t = 0; } }

/* ---------------- 指令 ---------------- */
export function orderMove(G, h, x, z) {
  if (!h.alive) return;
  const far = Math.hypot(x - h.x, z - h.z) > 5;
  // 同一個目標附近就沿用舊路徑，避免按住滑鼠時每幀重算
  if (!(h.goal && h.path && Math.hypot(h.goal.x - x, h.goal.z - z) < 1.5)) h.path = far ? findPath(h.x, h.z, x, z) : null;
  h.goal = { x, z }; h.target = null; h.charging = false; cancelRecall(G, h);
}
export function orderAttack(G, h, t) {
  if (!h.alive || !t || t.team === h.team) return;
  h.target = t; h.goal = null; h.path = null; h.charging = false; cancelRecall(G, h);
}
export function orderStop(G, h) { h.goal = null; h.target = null; }
export function startRecall(G, h) {
  if (!h.alive || h.action || h.recall > 0) return false;
  h.goal = null; h.target = null; h.recall = RECALL_TIME; G.emit('recall', { h, state: 'start' }); return true;
}
export function setCharging(G, h, on) {
  if (!h.alive) return;
  if (on && (h.action || h.st.stun > 0)) return;
  if (on) { h.goal = null; h.target = null; cancelRecall(G, h); }
  if (on !== h.charging) G.emit('charge', { h, on });
  h.charging = on;
}
export function spark(G, h) {
  if (!h.alive || h.cds.D > 0) return false;
  h.cds.D = SPARK.cd; h.st.spark = SPARK.dur; h.st.stun = 0; h.st.slow = 0; h.st.slowAmt = 0;
  if (h.def.ssj) h.form = 'ssj';
  fx(G).ring(h.x, h.z, h.def.color, 5, 0.5); fx(G).hitSpark(h.x, 1.2, h.z, h.def.glow, 2.2, 'heavy');
  sfx(G, 'spark', h); if (h === G.player) G.shake(0.6);
  G.emit('spark', h); return true;
}

/* ---------------- 眼 ---------------- */
let wardId = 0;
export function placeWard(G, h, x, z) {
  if (!h.alive || h.cds.T > 0) return false;
  const d = Math.hypot(x - h.x, z - h.z);
  if (d > WARD.range) { x = h.x + (x - h.x) / d * WARD.range; z = h.z + (z - h.z) / d * WARD.range; }
  const p = { x, z }; collide(p, 0.4);
  const mine = G.wards.filter((w) => w.alive && w.owner === h);
  if (mine.length >= WARD.max) { const old = mine[0]; old.alive = false; old.hp = 0; G.emit('wardDeath', { u: old }); }
  const w = {
    id: 200000 + wardId++, kind: 'ward', team: h.team, owner: h, x: p.x, z: p.z, y: 0, vy: 0, radius: 0.45, hp: WARD.hp, maxHp: WARD.hp, alive: true, facing: 0,
    st: { stun: 0, slow: 0, slowAmt: 0, frozen: 0, shield: 0, shieldT: 0, spark: 0, mark: 0, invuln: 0 }, kx: 0, kz: 0, life: WARD.life, deadT: 0, flash: 0, anim: { name: 'idle', t: 0 },
  };
  G.wards.push(w); G.units.push(w); G.emit('spawn', w);
  h.cds.T = WARD.cd; sfx(G, 'ui', h, { pitch: 1.6 });
  G.emit('ward', { h, w });
  return true;
}
// 真眼：消耗品，敵我都看得到、不會消失，會照出附近的敵方眼；每人場上只能有一顆
export function placeControl(G, h, x, z) {
  if (!h.alive || !(h.controls > 0)) return false;
  const d = Math.hypot(x - h.x, z - h.z);
  if (d > CONTROL.range) { x = h.x + (x - h.x) / d * CONTROL.range; z = h.z + (z - h.z) / d * CONTROL.range; }
  const p = { x, z }; collide(p, 0.4);
  for (const w of G.wards) if (w.alive && w.control && w.owner === h) { w.alive = false; w.hp = 0; G.emit('wardDeath', { u: w }); }
  h.controls--;
  const w = {
    id: 200000 + wardId++, kind: 'ward', control: true, team: h.team, owner: h, x: p.x, z: p.z, y: 0, vy: 0, radius: 0.5, hp: CONTROL.hp, maxHp: CONTROL.hp, alive: true, facing: 0,
    st: { stun: 0, slow: 0, slowAmt: 0, frozen: 0, shield: 0, shieldT: 0, spark: 0, mark: 0, invuln: 0 }, kx: 0, kz: 0, life: Infinity, deadT: 0, flash: 0, anim: { name: 'idle', t: 0 },
  };
  G.wards.push(w); G.units.push(w); G.emit('spawn', w);
  sfx(G, 'ui', h, { pitch: 1.2 });
  G.emit('ward', { h, w });
  return true;
}
export function updateWards(G, dt) {
  for (const w of G.wards) if (w.alive) { w.life -= dt; if (w.life <= 0) { w.alive = false; G.emit('wardDeath', { u: w }); } }
  for (let i = G.wards.length - 1; i >= 0; i--) {
    const w = G.wards[i];
    if (!w.alive) { w.deadT += dt; if (w.deadT > 0.4) { G.wards.splice(i, 1); const j = G.units.indexOf(w); if (j >= 0) G.units.splice(j, 1); G.emit('despawn', w); } }
  }
}

export function canLevel(h, k) {
  if (h.sp <= 0) return false;
  if (k === 'R') return h.ranks.R < 3 && h.ranks.R < Math.floor(h.level / 4);
  return h.ranks[k] < 5 && h.ranks[k] < Math.ceil(h.level / 2);
}
export function levelSkill(G, h, k) {
  if (!canLevel(h, k)) return false;
  h.ranks[k]++; h.sp--; G.emit('skillup', { h, k }); return true;
}

export function skillReady(h, k) {
  const s = sk(h, k);
  return h.alive && h.ranks[k] > 0 && h.cds[k] <= 0 && h.ki >= (s.ki || 0) * KI_BAR;
}
// 施放技能。tx,tz 為目標點（游標）。回傳是否成功。
export function cast(G, h, k, tx, tz) {
  if (!skillReady(h, k) || h.st.stun > 0 || h.y > 0.05) return false;
  if (h.action && !h.action.auto) return false;
  const s = sk(h, k);
  let dx = tx - h.x, dz = tz - h.z, d = Math.hypot(dx, dz);
  if (d < 0.01) { dx = sin(h.facing); dz = cos(h.facing); d = 1; }
  const ang = Math.atan2(dx, dz);
  const r = Math.min(d, s.range);
  const px = h.x + (dx / d) * r, pz = h.z + (dz / d) * r;
  const fn = KITS[h.heroId][k];
  const ok = fn(G, h, { ang, px, pz, tx, tz, d, rank: h.ranks[k] - 1, s });
  if (ok === false) return false;
  h.cds[k] = (k === 'R' ? s.cd : s.cd * (1 - 0.06 * (h.ranks[k] - 1))) * (1 - (h.cdr || 0));
  if (s.ki) h.ki -= s.ki * KI_BAR;
  h.charging = false; cancelRecall(G, h);
  G.emit('cast', { h, k });
  return true;
}

/* ---------------- 共用動作 ---------------- */
function act(h, o) { h.action = Object.assign({ t: 0 }, o); h.anim.name = o.name; h.anim.t = 0; h.goal = null; return h.action; }

// 衝刺：沿 ang 前進 len，撞到敵人時呼叫 onContact(u)（回傳 true 停下）
function dashAction(G, h, { ang, len, speed, name = 'dash', pass = false, onContact, onEnd, onPass, hitR = 1.3 }) {
  const sx = h.x, sz = h.z;
  let moved = 0; const passed = new Set();
  h.dashing = true; face(h, h.x + sin(ang), h.z + cos(ang));
  return act(h, {
    name, dur: len / speed + 0.05, unstoppable: true,
    step(G, h, dt) {
      const step = Math.min(speed * dt, len - moved); moved += step;
      const ox = h.x, oz = h.z;
      h.x += sin(ang) * step; h.z += cos(ang) * step;
      if (collide(h, h.radius) && Math.hypot(h.x - ox, h.z - oz) < step * 0.3) { this.t = this.dur; }
      fx(G).trail(h, h.def.color);
      for (const u of G.units) {
        if (!u.alive || u.team === h.team || passed.has(u) || !hittable(G, u)) continue;
        if (dist(u, h) < u.radius + hitR) {
          passed.add(u);
          if (pass) { onPass && onPass(u); continue; }
          if (onContact && onContact(u)) { this.t = this.dur; h.dashing = false; return; }
        }
      }
      if (moved >= len - 1e-3) this.t = this.dur;
    },
    end(G, h) { h.dashing = false; onEnd && onEnd(); },
    cancel() { h.dashing = false; },
  });
}

// 連打：對 u 打 n 下，間隔 gap；最後一下打飛
function rushAction(G, h, u, { n, gap, dmg, finisher, color, sound = 'hitM', name = 'rush' }) {
  let i = 0, next = 0.02;
  return act(h, {
    name, dur: n * gap + 0.25, unstoppable: true,
    step(G, h, dt) {
      if (!u.alive) { this.t = this.dur; return; }
      face(h, u.x, u.z);
      // 黏住目標
      const a = angTo(u, h), want = u.radius + h.radius + 0.35;
      if (dist(h, u) > want + 0.2) { h.x = u.x + sin(a) * want; h.z = u.z + cos(a) * want; }
      if (i < n && this.t >= next) {
        const last = i === n - 1;
        const o = last ? Object.assign({ type: 'H' }, finisher) : { type: 'M', stun: 0.35 };
        u.kx = u.kz = 0;
        damage(G, h, u, dmg, o);
        const ha = angTo(h, u);
        fx(G).hitSpark(u.x - sin(ha) * 0.4, 1.0 + u.y + Math.random() * 0.6, u.z - cos(ha) * 0.4, color, last ? 1.7 : 1, last ? 'heavy' : 'light');
        sfx(G, last ? 'hitH' : sound, u);
        if (h === G.player) G.shake(last ? 0.7 : 0.22, ha);
        i++; next += gap;
        h.anim.name = last ? 'atk3' : 'rush'; if (last) h.anim.t = 0;
      }
    },
  });
}

// 瞬移到 (x,z)，可指定面向目標
function blink(G, h, x, z, faceU) {
  const ox = h.x, oz = h.z;
  fx(G).vanish(ox, oz, h.def.color, h);
  h.x = x; h.z = z; collide(h, h.radius);
  if (faceU) face(h, faceU.x, faceU.z);
  fx(G).vanish(h.x, h.z, h.def.color, h, true);
  sfx(G, 'vanish', h);
  h.blinkT = G.time;
  G.emit('blink', { h, ox, oz });
}
function behind(h, u) {
  const a = angTo(h, u), d = u.radius + h.radius + 0.6;
  return { x: u.x + sin(a) * d, z: u.z + cos(a) * d };
}
function pickNear(G, h, x, z, r, preferHeroes = true) {
  let best = null, bs = 1e9;
  for (const u of G.units) {
    if (!u.alive || u.team === h.team || !hittable(G, u) || u.kind === 'tower' || u.kind === 'core') continue;
    const d = Math.hypot(u.x - x, u.z - z);
    if (d > r) continue;
    const s = d - (preferHeroes && u.kind === 'hero' ? 2 : 0);
    if (s < bs) { bs = s; best = u; }
  }
  return best;
}
function inLine(G, h, ang, len, width, fn) {
  const nx = sin(ang), nz = cos(ang);
  for (const u of G.units) {
    if (!u.alive || u.team === h.team || !hittable(G, u)) continue;
    const ox = u.x - h.x, oz = u.z - h.z, along = ox * nx + oz * nz, perp = Math.abs(ox * nz - oz * nx);
    if (along > -0.5 && along < len + u.radius && perp < width / 2 + u.radius) fn(u);
  }
}
function inCircle(G, h, x, z, r, fn, structures = true) {
  for (const u of G.units) {
    if (!u.alive || u.team === h.team || !hittable(G, u)) continue;
    if (!structures && (u.kind === 'tower' || u.kind === 'core')) continue;
    if (Math.hypot(u.x - x, u.z - z) < r + u.radius) fn(u);
  }
}

// 必殺技前奏：慢動作特寫＋橫幅
function superIntro(G, h, k) {
  G.emit('super', { h, k });
  if (h === G.player) { G.slowmo = 0.6; G.cam.focus = h; G.cam.focusPos = { x: h.x, z: h.z }; }
  sfx(G, 'beamCharge', h);
  fx(G).ring(h.x, h.z, h.def.color, 4, 0.5);
}
function superOutro(G) { if (G.cam) G.cam.focus = null; }

/* ---------------- 各角色技能 ---------------- */
/* ---------------- 共用招式模板 ---------------- */
// 直線氣彈：命中（或飛到盡頭）時爆炸
function blastBall(G, h, { ang, s }, color, style = 'ki') {
  face(h, h.x + sin(ang), h.z + cos(ang));
  act(h, {
    name: 'cast', dur: 0.32, fired: false,
    step(G, h) {
      if (this.fired || this.t < 0.14) return; this.fired = true;
      const dmg = skillDmg(h, 'Q');
      const boom = (G, p) => {
        fx(G).explode(p.x, p.z, color, s.radius); sfx(G, 'explode', p);
        inCircle(G, h, p.x, p.z, s.radius, (u) => damage(G, h, u, dmg, { type: 'skill', knock: 6, kdir: angTo(p, u) }));
        if (h === G.player) G.shake(0.4);
      };
      const p = spawnProjectile(G, { x: h.x + sin(ang), z: h.z + cos(ang), y: 1.3, ang, speed: s.speed, range: s.range, team: h.team, src: h, radius: 0.7, onHit: (G, p) => { boom(G, p); }, onEnd: boom });
      p.vis = fx(G).orb(color, 0.8, style); sfx(G, 'blast', h);
    },
  });
}
// 貫穿氣功波／圓盤
function pierceWave(G, h, { ang, s }, color, vis, opts = {}) {
  face(h, h.x + sin(ang), h.z + cos(ang));
  act(h, {
    name: 'cast', dur: 0.32, fired: false,
    step(G, h) {
      if (this.fired || this.t < 0.14) return; this.fired = true;
      const dmg = skillDmg(h, opts.key || 'Q');
      const p = spawnProjectile(G, {
        x: h.x + sin(ang), z: h.z + cos(ang), y: 1.3, ang, speed: s.speed || 32, range: s.range, team: h.team, src: h, radius: (s.width || 1.2) / 2, pierce: true,
        onHit(G, p, u) { damage(G, h, u, dmg, { type: opts.type || 'skill', knock: opts.knock ?? 4, kdir: ang }); fx(G).hitSpark(u.x, 1.2, u.z, color, 1.1, 'light'); sfx(G, 'hitM', u, { vol: 0.6 }); },
      });
      p.vis = vis(); sfx(G, 'blast', h, { pitch: opts.pitch || 1 });
    },
  });
}
// 衝刺連打
function dashRush(G, h, { ang, s }, color, hits, gap, finisher, sound = 'hitM', key = 'W') {
  const dmg = skillDmg(h, key);
  sfx(G, 'dash', h);
  dashAction(G, h, {
    ang, len: s.range, speed: 32,
    onContact: (u) => { if (u.kind === 'tower' || u.kind === 'core') return true; rushAction(G, h, u, { n: hits, gap, dmg, finisher, color, sound }); return true; },
  });
}
// 光束必殺：蓄力 windup 秒後持續 1.25 秒多段傷害
function beamSuper(G, h, { ang, s }, color, core, style) {
  const dmg = skillDmg(h, 'R'), wind = s.windup || 0.32;
  superIntro(G, h, 'R');
  face(h, h.x + sin(ang), h.z + cos(ang));
  let beam = null, tick = 0, snd = null;
  act(h, {
    name: 'beam', dur: wind + 1.25, unstoppable: true,
    step(G, h, dt) {
      if (this.t < wind) { if (Math.random() < 0.5) fx(G).aura(h.x, 1.2, h.z, color, 2); return; }
      if (!beam) { superOutro(G); beam = fx(G).beam(h, ang, s.range, s.width, color, core, style); snd = sfx(G, 'beam', h); G.emit('superFire', { h }); }
      beam.update(h, ang);
      if (h === G.player) G.shake(0.55);
      const tt = this.t - wind;
      while (tick < s.ticks && tt >= tick * (1.2 / s.ticks)) {
        tick++;
        inLine(G, h, ang, s.range, s.width + 0.6, (u) => {
          damage(G, h, u, dmg, { type: tick === s.ticks ? 'super' : 'skill', knock: tick === s.ticks ? 14 : 1.5, kdir: ang, stun: 0.3 });
          fx(G).hitSpark(u.x, 1.2, u.z, core, 1.1, 'light');
        });
      }
    },
    end() { beam && beam.remove(); snd && snd.stop && snd.stop(); superOutro(G); },
    cancel() { beam && beam.remove(); snd && snd.stop && snd.stop(); superOutro(G); },
  });
}
// 瞬移到點，下一次普攻硬直
function blinkEmpower(G, h, { px, pz }) {
  const p = { x: px, z: pz }; collide(p, h.radius); blink(G, h, p.x, p.z);
  h.empowered = G.time + 2.5; h.atkCd = Math.min(h.atkCd, 0.05);
  act(h, { name: 'vanish', dur: 0.12, unstoppable: true });
}
function chainBolt(G, h, { ang, s }, color) {
  face(h, h.x + sin(ang), h.z + cos(ang));
  act(h, {
    name: 'cast', dur: 0.26, fired: false,
    step(G, h) {
      if (this.fired || this.t < 0.1) return; this.fired = true;
      const dmg = skillDmg(h, 'Q');
      const p = spawnProjectile(G, {
        x: h.x + sin(ang), z: h.z + cos(ang), y: 1.3, ang, speed: s.speed, range: s.range, team: h.team, src: h, radius: 0.6,
        onHit(G, p, u) {
          damage(G, h, u, dmg, { type: 'skill', stun: 0.2 }); fx(G).hitSpark(u.x, 1.2, u.z, color, 1.2, 'spark'); sfx(G, 'explode', u, { vol: 0.5 });
          let from = u; const hitSet = new Set([u]);
          for (let c = 0; c < s.chain; c++) {
            let nb = null, bd = 6;
            for (const o of G.units) { if (!o.alive || o.team === h.team || hitSet.has(o) || !hittable(G, o)) continue; const d = dist(o, from); if (d < bd) { bd = d; nb = o; } }
            if (!nb) break;
            hitSet.add(nb); const a = from, b = nb;
            const q = spawnProjectile(G, { x: a.x, z: a.z, y: 1.2, speed: 40, team: h.team, src: h, target: b, radius: 0.3, onArrive(G, q, t) { damage(G, h, t, dmg * 0.7, { type: 'skill', stun: 0.15 }); fx(G).hitSpark(t.x, 1.2, t.z, color, 0.9, 'spark'); } });
            q.vis = fx(G).orb(color, 0.45, 'spark');
            from = nb;
          }
        },
      });
      p.vis = fx(G).orb(color, 0.55, 'spark'); sfx(G, 'blast', h, { pitch: 1.3 });
    },
  });
}

/* ---------------- 各角色技能 ---------------- */
const KITS = {
  goku: {
    Q: (G, h, o) => blastBall(G, h, o, '#4fc3ff'),
    W: (G, h, o) => dashRush(G, h, o, '#8fdcff', o.s.hits, 0.1, { knock: 15, air: 0.45 }),
    E: (G, h, { px, pz, tx, tz }) => vanishSkill(G, h, tx, tz, px, pz, 3),
    R: (G, h, o) => beamSuper(G, h, o, '#3fb4ff', '#eafaff', 'kame'),
  },
  vegeta: {
    Q: (G, h, o) => chainBolt(G, h, o, '#ffd84a'),
    W: (G, h, o) => dashRush(G, h, o, '#ffe88a', o.s.hits, 0.075, { knock: 12, stun: 0.4 }, 'hitL'),
    E(G, h, { px, pz, tx, tz, s }) {
      const u = pickNear(G, h, tx, tz, 3.5) || pickNear(G, h, px, pz, 3.5);
      if (u && dist(h, u) < s.range + 3) { const b = behind(h, u); blink(G, h, b.x, b.z, u); h.chain = 0; h.atkCd = 0; h.empowered = G.time + 2.5; h.target = u; }
      else { const p = { x: px, z: pz }; collide(p, h.radius); blink(G, h, p.x, p.z); }
      act(h, { name: 'vanish', dur: 0.1, unstoppable: true });
    },
    R: (G, h, o) => beamSuper(G, h, o, '#ffd84a', '#fffbe6', 'flash'),
  },
  trunks: {
    Q: (G, h, o) => pierceWave(G, h, o, '#ffcf6a', () => fx(G).wave('#ffcf6a', o.s.width), { knock: 7 }),
    W(G, h, { ang, s }) {
      const dmg = skillDmg(h, 'W');
      sfx(G, 'dash', h, { pitch: 1.2 });
      dashAction(G, h, {
        ang, len: s.range, speed: 34, pass: true, name: 'dash',
        onPass: (u) => { damage(G, h, u, dmg, { type: 'skill', stun: 0.25 }); fx(G).slash(u.x, u.z, ang + 1.2, '#fff4d8', 1.8); fx(G).hitSpark(u.x, 1.1, u.z, '#ffcf6a', 1.1, 'light'); sfx(G, 'hitM', u); if (h === G.player) G.shake(0.25); },
        onEnd: () => {
          h.action = null;
          act(h, { name: 'cast', dur: 0.3 });
          const p = spawnProjectile(G, { x: h.x, z: h.z, y: 1.3, ang, speed: 30, range: 5, team: h.team, src: h, radius: 0.8, onHit: (G, p, u) => { damage(G, h, u, dmg * 0.6, { type: 'H', knock: 10, kdir: ang }); fx(G).explode(p.x, p.z, '#ffcf6a', 1.6); } });
          p.vis = fx(G).orb('#ffcf6a', 0.6, 'ki');
        },
      });
    },
    E: (G, h, o) => blinkEmpower(G, h, o),
    R(G, h, { s }) {
      const dmg = skillDmg(h, 'R');
      const u = pickNear(G, h, h.x, h.z, s.range);
      if (!u) return false;
      superIntro(G, h, 'R');
      act(h, {
        name: 'dash', dur: 1.25, unstoppable: true, stage: 0,
        step(G, h, dt) {
          h.st.invuln = 0.2;
          if (this.stage === 0 && this.t > 0.22) {
            this.stage = 1; superOutro(G); G.emit('superFire', { h });
            if (!u.alive) { this.t = this.dur; return; }
            const b = behind(h, u); blink(G, h, b.x, b.z, u);
            h.anim.name = 'atk3'; h.anim.t = 0;
            damage(G, h, u, dmg * 0.3, { type: 'H', air: 1.1 });
            fx(G).slash(u.x, u.z, angTo(h, u), '#fff4d8', 2.4); fx(G).hitSpark(u.x, 1.4, u.z, '#ffcf6a', 1.6, 'heavy'); sfx(G, 'hitH', u);
            this.tx = u.x; this.tz = u.z;
          }
          if (this.stage === 1 && this.t > 0.6) {
            this.stage = 2; h.anim.name = 'beam'; h.anim.t = 0;
            fx(G).dome(this.tx, this.tz, s.radius, '#ffcf6a'); sfx(G, 'explode', { x: this.tx, z: this.tz }); sfx(G, 'slam', h);
            if (h === G.player || dist(G.player, h) < 22) G.shake(1.0);
            inCircle(G, h, this.tx, this.tz, s.radius, (v) => damage(G, h, v, dmg * 0.75, { type: 'super', air: 0.8 }));
          }
        },
        end() { superOutro(G); }, cancel() { superOutro(G); },
      });
    },
  },
  piccolo: {
    Q(G, h, { px, pz, s }) {
      face(h, px, pz);
      act(h, { name: 'overhead', dur: 0.35 });
      fx(G).hellzone(px, pz, s.radius, '#d8ff7a', 0.6);
      sfx(G, 'blast', h, { pitch: 0.8 });
      G.later(0.6, () => {
        const dmg = skillDmg(h, 'Q');
        fx(G).explode(px, pz, '#d8ff7a', s.radius); sfx(G, 'explode', { x: px, z: pz });
        if (h === G.player) G.shake(0.5);
        inCircle(G, h, px, pz, s.radius, (u) => damage(G, h, u, dmg, { type: 'skill', air: 0.6 }));
      });
    },
    W(G, h, { ang, s }) {
      face(h, h.x + sin(ang), h.z + cos(ang));
      const dmg = skillDmg(h, 'W');
      let tether = null;
      act(h, {
        name: 'grab', dur: 0.55, fired: false,
        step(G, h) {
          h.anim.k = Math.min(1, this.t / 0.3);
          if (this.fired) return; this.fired = true;
          sfx(G, 'dash', h, { pitch: 0.8 });
          const p = spawnProjectile(G, {
            x: h.x + sin(ang), z: h.z + cos(ang), y: 1.3, ang, speed: 34, range: s.range, team: h.team, src: h, radius: 0.6, skipStructures: true,
            onHit(G, p, u) {
              damage(G, h, u, dmg, { type: 'skill', stun: 0.9 }); sfx(G, 'hitH', u); fx(G).hitSpark(u.x, 1.2, u.z, '#b6ff5c', 1.3, 'heavy');
              const sx = u.x, sz = u.z, tx = h.x + sin(ang) * (h.radius + u.radius + 0.4), tz = h.z + cos(ang) * (h.radius + u.radius + 0.4);
              G.zones.push({ x: sx, z: sz, r: 0, t: 0, dur: 0.28, tick(G, z) { if (!u.alive) return; const k = Math.min(1, z.t / 0.25); u.x = sx + (tx - sx) * k; u.z = sz + (tz - sz) * k; u.kx = u.kz = 0; } });
              return true;
            },
          });
          tether = fx(G).stretch(() => ({ x: h.x + sin(ang) * 0.6, y: heightOf(h) + 1.3, z: h.z + cos(ang) * 0.6 }), () => ({ x: p.x, y: 1.3, z: p.z }), '#7bc043', 0.22, 0.55);
          p.vis = fx(G).orb('#b6ff5c', 0.35, 'ki');
        },
      });
    },
    E(G, h, { px, pz, s, rank }) {
      const p = { x: px, z: pz }; collide(p, h.radius);
      blink(G, h, p.x, p.z);
      h.st.shield = s.shield[rank]; h.st.shieldT = 3; heal(G, h, h.maxHp * 0.08);
      fx(G).shieldFx(h, '#b6ff5c', 3); fx(G).levelUp(h, '#d8ff7a');
      act(h, { name: 'vanish', dur: 0.12, unstoppable: true });
    },
    R(G, h, { ang, s }) {
      const dmg = skillDmg(h, 'R');
      superIntro(G, h, 'R');
      face(h, h.x + sin(ang), h.z + cos(ang));
      let beam = null, snd = null;
      act(h, {
        name: 'beam', dur: s.windup + 0.6, unstoppable: true,
        step(G, h) {
          if (this.t < s.windup) { if (Math.random() < 0.6) fx(G).emit(h.x + sin(ang) * 0.6, 2.2, h.z + cos(ang) * 0.6, { n: 1, speed: 2, color: '#fff27a', color2: '#e070ff', size: 0.35, life: 0.3, gravity: 0 }); return; }
          if (!beam) {
            superOutro(G); G.emit('superFire', { h });
            beam = fx(G).beam(h, ang, s.range, s.width, '#fff27a', '#ffffff', 'spiral'); beam.update(h, ang);
            snd = sfx(G, 'beam', h, { pitch: 1.4 });
            if (h === G.player) G.shake(0.9);
            inLine(G, h, ang, s.range, s.width + 0.8, (u) => { damage(G, h, u, dmg, { type: 'super', knock: 12, kdir: ang, stun: 0.4 }); fx(G).hitSpark(u.x, 1.2, u.z, '#fff27a', 1.6, 'heavy'); });
          }
        },
        end() { beam && beam.remove(); snd && snd.stop && snd.stop(); superOutro(G); },
        cancel() { beam && beam.remove(); snd && snd.stop && snd.stop(); superOutro(G); },
      });
    },
  },
  frieza: {
    Q(G, h, { ang, s }) {
      face(h, h.x + sin(ang), h.z + cos(ang));
      act(h, {
        name: 'cast', dur: 0.28, fired: false,
        step(G, h) {
          if (this.fired || this.t < 0.12) return; this.fired = true;
          const dmg = skillDmg(h, 'Q');
          const p = spawnProjectile(G, {
            x: h.x + sin(ang), z: h.z + cos(ang), y: 1.4, ang, speed: s.speed, range: s.range, team: h.team, src: h, radius: 0.45,
            onHit(G, p, u) { damage(G, h, u, dmg, { type: 'skill', slow: s.slow, slowT: 2 }); fx(G).hitSpark(u.x, 1.2, u.z, '#ff4fb4', 1.1, 'spark'); sfx(G, 'hitM', u); },
          });
          p.vis = fx(G).needle('#ff4fb4'); sfx(G, 'vanish', h, { pitch: 0.8 });
        },
      });
    },
    W(G, h, { ang, s }) {
      face(h, h.x + sin(ang), h.z + cos(ang));
      act(h, {
        name: 'overhead', dur: 0.3, fired: false,
        step(G, h) {
          if (this.fired || this.t < 0.14) return; this.fired = true;
          const dmg = skillDmg(h, 'W');
          const p = spawnProjectile(G, {
            x: h.x + sin(ang), z: h.z + cos(ang), y: 1.4, ang, speed: s.speed, range: s.range, team: h.team, src: h, radius: 0.9, pierce: true, boomerang: true, life: 4,
            onHit(G, p, u) { damage(G, h, u, dmg, { type: 'skill' }); fx(G).hitSpark(u.x, 1.2, u.z, '#ff8fd0', 1, 'light'); sfx(G, 'hitL', u); },
          });
          p.vis = fx(G).disc('#ff8fd0', 1.0); sfx(G, 'dash', h, { pitch: 1.6 });
        },
      });
    },
    E: (G, h, o) => blinkEmpower(G, h, o),
    R(G, h, { px, pz, s }) {
      const dmg = skillDmg(h, 'R');
      superIntro(G, h, 'R');
      face(h, px, pz);
      const ball = fx(G).deathBall('#ff7a3a');
      const mark = fx(G).target(px, pz, s.radius, '#ff7a3a', 1.6);
      act(h, {
        name: 'overhead', dur: 0.9, unstoppable: true,
        step(G, h) { ball.update(h.x, heightOf(h) + 3.4 + this.t * 1.5, h.z, 0.4 + this.t * 2.4); },
        end(G, h) {
          superOutro(G); G.emit('superFire', { h });
          act(h, { name: 'cast', dur: 0.35 });
          const sx = h.x, sz = h.z, sy = heightOf(h) + 4.7, d = Math.hypot(px - sx, pz - sz), T = Math.max(0.4, d / 16);
          let t = 0;
          G.zones.push({ x: sx, z: sz, r: 0, t: 0, dur: T, tick(G, z, dt) { t += dt; const k = Math.min(1, t / T); ball.update(sx + (px - sx) * k, sy + (heightAtXZ(px, pz) + 1.5 - sy) * k, sz + (pz - sz) * k, 3.4); } });
          G.later(T, () => {
            ball.remove(); mark.remove();
            fx(G).explode(px, pz, '#ff7a3a', s.radius); fx(G).dome(px, pz, s.radius * 0.9, '#ffb08a');
            sfx(G, 'explode', { x: px, z: pz }); sfx(G, 'slam', { x: px, z: pz });
            if (h === G.player || dist(G.player, { x: px, z: pz }) < 22) G.shake(1.1);
            inCircle(G, h, px, pz, s.radius, (u) => damage(G, h, u, dmg, { type: 'super', stun: 1.0, knock: 8, kdir: angTo({ x: px, z: pz }, u) }));
          });
        },
        cancel() { superOutro(G); ball.remove(); mark.remove(); },
      });
    },
  },
  a18: {
    Q: (G, h, o) => pierceWave(G, h, o, '#fff6c0', () => fx(G).disc('#fff6c0', 0.8), { knock: 2, pitch: 1.5 }),
    W(G, h, { ang, s }) {
      const dmg = skillDmg(h, 'W');
      sfx(G, 'dash', h, { pitch: 1.3 });
      dashAction(G, h, {
        ang, len: s.range, speed: 30,
        onContact: (u) => {
          if (u.kind === 'tower' || u.kind === 'core') return true;
          act(h, { name: 'atk3', dur: 0.4 });
          u.x = h.x - sin(ang) * 1.2; u.z = h.z - cos(ang) * 1.2; collide(u, u.radius);
          damage(G, h, u, dmg, { type: 'H', stun: 0.7, knock: 13, kdir: ang + Math.PI });
          fx(G).hitSpark(u.x, 1.2, u.z, '#c7f0ff', 1.5, 'heavy'); fx(G).dust(u.x, u.z, 12); sfx(G, 'slam', u, { vol: 0.6 });
          if (h === G.player) G.shake(0.6);
          return true;
        },
      });
    },
    E(G, h, { s, rank }) {
      h.st.shield = s.shield[rank]; h.st.shieldT = 3;
      fx(G).barrier(h, '#c7f0ff'); sfx(G, 'freeze', h, { pitch: 1.4 });
      for (const u of G.units) if (u.alive && u.team !== h.team && (u.kind === 'hero' || u.kind === 'minion') && dist(u, h) < 4.2 + u.radius) damage(G, h, u, 20 + h.level * 6, { type: 'skill', knock: 15, kdir: angTo(h, u), stun: 0.3 });
      act(h, { name: 'barrier', dur: 0.35 });
    },
    R(G, h, { ang, s }) {
      const dmg = skillDmg(h, 'R');
      superIntro(G, h, 'R');
      face(h, h.x + sin(ang), h.z + cos(ang));
      let n = 0;
      act(h, {
        name: 'cast', dur: 0.3 + s.shots * 0.08 + 0.2, unstoppable: true,
        step(G, h) {
          if (this.t < 0.3) return;
          if (!this.go) { this.go = true; superOutro(G); G.emit('superFire', { h }); }
          while (n < s.shots && this.t >= 0.3 + n * 0.08) {
            n++; h.anim.name = n % 2 ? 'cast' : 'atk2'; h.anim.t = 0.05;
            const a = ang + (Math.random() - 0.5) * 0.6;
            const p = spawnProjectile(G, {
              x: h.x + sin(a), z: h.z + cos(a), y: 1.3, ang: a, speed: 36, range: s.range, team: h.team, src: h, radius: 0.55,
              onHit(G, p, u) { damage(G, h, u, dmg, { type: n === s.shots ? 'super' : 'skill', knock: 2.5, kdir: a }); fx(G).hitSpark(u.x, 1.2, u.z, '#fff6c0', 0.9, 'light'); },
              onEnd(G, p) { fx(G).dust(p.x, p.z, 3); },
            });
            p.vis = fx(G).orb('#fff6c0', 0.45, 'ki'); sfx(G, 'blast', h, { vol: 0.5, pitch: 1.2 + Math.random() * 0.3 });
            if (h === G.player) G.shake(0.2);
          }
        },
        end() { superOutro(G); }, cancel() { superOutro(G); },
      });
    },
  },
};

/* ---------------- 客串角色（火影忍者、海賊王） ---------------- */
// 衝到第一個敵人並觸發 hit(u)；用來做螺旋丸、千鳥、雷切、怪力衝拳等「衝撞一擊」
function dashStrike(G, h, ang, len, speed, color, hit, sound = 'dash') {
  sfx(G, sound, h);
  return dashAction(G, h, {
    ang, len, speed,
    onContact: (u) => { if (u.kind === 'tower' || u.kind === 'core') return true; act(h, { name: 'atk3', dur: 0.35 }); hit(u); return true; },
  });
}
// 範圍持續傷害（螺旋手裏劍、神威、雷雲）：每 every 秒對範圍內敵人呼叫 fn
function tickZone(G, h, x, z, r, dur, every, fn) {
  let acc = every;
  G.zones.push({ x, z, r, t: 0, dur, tick(G, zz, dt) { acc += dt; while (acc >= every) { acc -= every; inCircle(G, h, x, z, r, fn, false); } } });
}
Object.assign(KITS, {
  naruto: {
    Q(G, h, { ang, s }) {
      const dmg = skillDmg(h, 'Q');
      dashStrike(G, h, ang, s.range, 30, '#7fd0ff', (u) => {
        fx(G).explode(u.x, u.z, '#7fd0ff', s.radius); sfx(G, 'explode', u); sfx(G, 'hitH', u);
        if (h === G.player) G.shake(0.7);
        inCircle(G, h, u.x, u.z, s.radius, (v) => damage(G, h, v, v === u ? dmg : dmg * 0.6, { type: 'skill', knock: 14, kdir: ang, air: 0.4 }));
      });
    },
    W(G, h, { px, pz, s }) {
      const dmg = skillDmg(h, 'W');
      face(h, px, pz); act(h, { name: 'cast', dur: 0.3 });
      G.emit('clones', { h, x: px, z: pz, n: 3, r: 1.9, dur: 0.25 + s.hits * 0.18 });
      sfx(G, 'vanish', { x: px, z: pz }, { pitch: 0.8 });
      for (let i = 0; i < s.hits; i++) G.later(0.25 + i * 0.18, () => {
        inCircle(G, h, px, pz, s.radius, (u) => { damage(G, h, u, dmg, { type: i === s.hits - 1 ? 'H' : 'M', stun: 0.3, air: i === s.hits - 1 ? 0.5 : 0 }); fx(G).hitSpark(u.x, 1.1, u.z, '#ff8a1f', i === s.hits - 1 ? 1.4 : 0.9, i === s.hits - 1 ? 'heavy' : 'light'); }, false);
        sfx(G, i === s.hits - 1 ? 'hitH' : 'hitM', { x: px, z: pz });
      });
    },
    E(G, h, o) { fx(G).dust(h.x, h.z, 14, '#d8d0c4', 1.6); G.emit('substitute', { h, x: h.x, z: h.z }); return blinkEmpower(G, h, o); },
    R(G, h, { px, pz, ang, s }) {
      const dmg = skillDmg(h, 'R');
      superIntro(G, h, 'R'); face(h, px, pz);
      act(h, {
        name: 'overhead', dur: 0.55, unstoppable: true, fired: false,
        step(G, h) {
          if (this.fired || this.t < 0.45) return; this.fired = true;
          superOutro(G); G.emit('superFire', { h });
          const d = Math.hypot(px - h.x, pz - h.z);
          const p = spawnProjectile(G, { x: h.x + sin(ang), z: h.z + cos(ang), y: 1.6, ang, speed: 26, range: Math.max(2, d), team: h.team, src: h, radius: 0.1, skipStructures: true, pierce: true, onHit() {},
            onEnd(G, p) {
              fx(G).dome(p.x, p.z, s.radius, '#dff6ff'); fx(G).explode(p.x, p.z, '#bfeaff', s.radius * 0.7); sfx(G, 'explode', p); sfx(G, 'beam', p, { pitch: 1.6 });
              if (h === G.player || dist(G.player, p) < 22) G.shake(1.0);
              tickZone(G, h, p.x, p.z, s.radius, 1.2, 1.2 / s.ticks, (u) => { damage(G, h, u, dmg, { type: 'super', stun: 0.25 }); fx(G).slash(u.x, u.z, Math.random() * 6.28, '#ffffff', 1.4); });
            } });
          p.vis = fx(G).disc('#dff6ff', 1.3); sfx(G, 'dash', h, { pitch: 0.6 });
        },
        cancel() { superOutro(G); },
      });
    },
  },
  sasuke: {
    Q(G, h, o) { return blastBall(G, h, o, '#ff6a1f', 'ki'); },
    W(G, h, { ang, s }) {
      const dmg = skillDmg(h, 'W');
      dashStrike(G, h, ang, s.range, 36, '#bfe8ff', (u) => {
        damage(G, h, u, dmg, { type: 'H', stun: 0.8, knock: 6, kdir: ang });
        fx(G).lightning({ x: h.x, y: 1.2, z: h.z }, { x: u.x, y: 1.2, z: u.z }, '#bfe8ff'); fx(G).hitSpark(u.x, 1.2, u.z, '#bfe8ff', 1.6, 'heavy');
        sfx(G, 'thunder', u, { vol: 0.7 }); if (h === G.player) G.shake(0.6);
      }, 'thunder');
    },
    E: (G, h, o) => KITS.vegeta.E(G, h, o),
    R(G, h, { px, pz, s }) {
      const dmg = skillDmg(h, 'R');
      superIntro(G, h, 'R'); face(h, px, pz);
      const mark = fx(G).target(px, pz, s.radius, '#bfe8ff', 1.0);
      act(h, { name: 'overhead', dur: 1.0, unstoppable: true, cancel() { superOutro(G); mark.remove(); } });
      G.later(1.0, () => {
        mark.remove(); superOutro(G); G.emit('superFire', { h });
        for (let i = 0; i < 5; i++) fx(G).lightning({ x: px + (Math.random() - 0.5) * 4, y: 26, z: pz + (Math.random() - 0.5) * 4 }, { x: px, y: 0.3, z: pz }, i % 2 ? '#bfe8ff' : '#8f7bff');
        fx(G).explode(px, pz, '#bfe8ff', s.radius); fx(G).dome(px, pz, s.radius * 0.8, '#8f7bff'); fx(G).crater(px, pz, s.radius * 0.7);
        sfx(G, 'thunder', { x: px, z: pz }, { vol: 1.5 }); sfx(G, 'explode', { x: px, z: pz });
        if (h === G.player || dist(G.player, { x: px, z: pz }) < 24) G.shake(1.2);
        inCircle(G, h, px, pz, s.radius, (u) => damage(G, h, u, dmg, { type: 'super', stun: 0.8, air: 0.6 }));
      });
    },
  },
  kakashi: {
    Q: (G, h, o) => pierceWave(G, h, o, '#5fb4ff', () => fx(G).wave('#5fb4ff', o.s.width), { knock: 9 }),
    W(G, h, { ang, s }) {
      const dmg = skillDmg(h, 'W');
      face(h, h.x + sin(ang), h.z + cos(ang)); act(h, { name: 'overhead', dur: 0.4 });
      fx(G).quake(h.x, h.z, ang, s.range, 0.25, '#b08a5a'); sfx(G, 'slam', h, { pitch: 1.2 });
      G.later(0.25, () => inLine(G, h, ang, s.range, s.width, (u) => { damage(G, h, u, dmg, { type: 'skill', stun: 1.0 }); fx(G).dust(u.x, u.z, 10, '#a08868', 1.2); fx(G).hitSpark(u.x, 0.8, u.z, '#d8b080', 1, 'light'); }));
    },
    E(G, h, { ang, s }) {
      const dmg = skillDmg(h, 'E');
      fx(G).sparks(h.x, 1.2, h.z, '#bfe8ff');
      dashStrike(G, h, ang, s.range, 40, '#bfe8ff', (u) => {
        damage(G, h, u, dmg, { type: 'H', stun: 0.6 }); fx(G).hitSpark(u.x, 1.2, u.z, '#bfe8ff', 1.5, 'heavy'); fx(G).lightning({ x: h.x, y: 1.3, z: h.z }, { x: u.x, y: 1.3, z: u.z }, '#bfe8ff');
        sfx(G, 'thunder', u, { vol: 0.6 }); h.empowered = G.time + 2.5;
      }, 'thunder');
    },
    R(G, h, { px, pz, s }) {
      const dmg = skillDmg(h, 'R');
      superIntro(G, h, 'R'); face(h, px, pz);
      act(h, { name: 'cast', dur: 0.5, unstoppable: true, cancel() { superOutro(G); } });
      G.later(0.45, () => {
        superOutro(G); G.emit('superFire', { h });
        const mist = fx(G).mist(px, pz, s.radius, '#5a3a8a', 1.4); fx(G).dome(px, pz, s.radius, '#8a5ad8'); sfx(G, 'vanish', { x: px, z: pz }, { pitch: 0.5 });
        G.zones.push({ x: px, z: pz, r: s.radius, t: 0, dur: 1.2, tick(G, z, dt) { for (const u of G.units) if (u.alive && u.team !== h.team && (u.kind === 'hero' || u.kind === 'minion') && Math.hypot(u.x - px, u.z - pz) < s.radius + 1) { const a = Math.atan2(px - u.x, pz - u.z), d = Math.hypot(px - u.x, pz - u.z); const k = Math.min(d, 5 * dt); u.x += sin(a) * k; u.z += cos(a) * k; } } });
        tickZone(G, h, px, pz, s.radius, 1.2, 1.2 / s.ticks, (u) => damage(G, h, u, dmg, { type: 'super' }));
        G.later(1.25, () => mist.remove());
      });
    },
  },
  sakura: {
    Q(G, h, { px, pz, s }) {
      const dmg = skillDmg(h, 'Q');
      face(h, px, pz); act(h, { name: 'overhead', dur: 0.45 });
      G.later(0.22, () => {
        fx(G).crater(px, pz, s.radius); fx(G).quake(h.x, h.z, Math.atan2(px - h.x, pz - h.z), Math.hypot(px - h.x, pz - h.z) + s.radius, 0.5, '#c8a070');
        fx(G).explode(px, pz, '#ff9ac8', s.radius * 0.8, 'rock'); sfx(G, 'slam', { x: px, z: pz }); sfx(G, 'explode', { x: px, z: pz }, { vol: 0.6 });
        if (h === G.player) G.shake(0.8);
        inCircle(G, h, px, pz, s.radius, (u) => damage(G, h, u, dmg, { type: 'skill', air: 0.8 }));
      });
    },
    W(G, h, { ang, s }) {
      const dmg = skillDmg(h, 'W');
      dashStrike(G, h, ang, s.range, 30, '#ff6fae', (u) => {
        damage(G, h, u, dmg, { type: 'H', stun: 0.7, knock: 16, kdir: ang }); fx(G).hitSpark(u.x, 1.2, u.z, '#ff6fae', 1.7, 'heavy'); fx(G).dust(u.x, u.z, 12);
        sfx(G, 'hitH', u); sfx(G, 'slam', u, { vol: 0.6 }); if (h === G.player) G.shake(0.7);
      });
    },
    E(G, h, { s, rank }) {
      act(h, { name: 'barrier', dur: 0.4 });
      sfx(G, 'levelUp', h, { pitch: 1.2 });
      for (const a of G.heroes) if (a.alive && a.team === h.team && dist(a, h) < 7) { heal(G, a, a.maxHp * 0.12 + 30 + h.level * 8); a.st.shield = Math.max(a.st.shield, s.shield[rank] * (a === h ? 1 : 0.6)); a.st.shieldT = 3; fx(G).shieldFx(a, '#7fffb0', 2.5); fx(G).levelUp(a, '#7fffb0'); }
    },
    R(G, h, { px, pz, s }) {
      const dmg = skillDmg(h, 'R');
      superIntro(G, h, 'R');
      const sx = h.x, sz = h.z, mark = fx(G).target(px, pz, s.radius, '#ff6fae', 0.75);
      face(h, px, pz);
      act(h, {
        name: 'air', dur: 0.75, unstoppable: true,
        step(G, h) { const k = Math.min(1, this.t / 0.7); h.x = sx + (px - sx) * k; h.z = sz + (pz - sz) * k; h.y = Math.sin(k * Math.PI) * 5; h.st.invuln = 0.1; },
        end(G, h) {
          h.y = 0; collide(h, h.radius); mark.remove(); superOutro(G); G.emit('superFire', { h });
          act(h, { name: 'atk3', dur: 0.4 });
          fx(G).crater(px, pz, s.radius); fx(G).explode(px, pz, '#ff6fae', s.radius, 'rock'); fx(G).dome(px, pz, s.radius * 0.85, '#ffb0d8');
          sfx(G, 'slam', h); sfx(G, 'explode', h);
          if (h === G.player || dist(G.player, h) < 24) G.shake(1.2);
          inCircle(G, h, px, pz, s.radius, (u) => damage(G, h, u, dmg, { type: 'super', stun: 1.0, air: 0.9 }));
        },
        cancel() { h.y = 0; mark.remove(); superOutro(G); },
      });
    },
  },
  luffy: {
    Q(G, h, { ang, s }) {
      face(h, h.x + sin(ang), h.z + cos(ang));
      const dmg = skillDmg(h, 'Q');
      let tether = null;
      act(h, {
        name: 'grab', dur: 0.5, fired: false,
        step(G, h) {
          h.anim.k = Math.min(1, this.t / 0.25);
          if (this.fired) return; this.fired = true;
          sfx(G, 'dash', h, { pitch: 1.1 });
          const p = spawnProjectile(G, { x: h.x + sin(ang), z: h.z + cos(ang), y: 1.3, ang, speed: 40, range: s.range, team: h.team, src: h, radius: 0.7,
            onHit(G, p, u) { damage(G, h, u, dmg, { type: 'H', knock: 12, kdir: ang }); fx(G).hitSpark(u.x, 1.2, u.z, '#ff3b4b', 1.5, 'heavy'); sfx(G, 'hitH', u); if (h === G.player) G.shake(0.45); return true; } });
          tether = fx(G).stretch(() => ({ x: h.x + sin(ang) * 0.6, y: heightOf(h) + 1.3, z: h.z + cos(ang) * 0.6 }), () => ({ x: p.x, y: 1.3, z: p.z }), '#f2c49b', 0.13, 0.5);
          p.vis = fx(G).orb('#f2c49b', 0.32, 'ki');
        },
      });
    },
    W(G, h, { px, pz, s }) {
      const dmg = skillDmg(h, 'W');
      const sx = h.x, sz = h.z; face(h, px, pz); sfx(G, 'dash', h, { pitch: 0.7 });
      act(h, {
        name: 'dash', dur: 0.45, unstoppable: true,
        step(G, h) { const k = Math.min(1, this.t / 0.4); h.x = sx + (px - sx) * k; h.z = sz + (pz - sz) * k; h.y = Math.sin(k * Math.PI) * 1.4; fx(G).trail(h, '#ff3b4b'); },
        end(G, h) {
          h.y = 0; collide(h, h.radius); fx(G).explode(h.x, h.z, '#ffb0a0', s.radius * 0.7, 'rock'); fx(G).dust(h.x, h.z, 18); sfx(G, 'slam', h);
          if (h === G.player) G.shake(0.6);
          inCircle(G, h, h.x, h.z, s.radius, (u) => damage(G, h, u, dmg, { type: 'skill', knock: 10, kdir: angTo(h, u), stun: 0.3 }));
        },
        cancel() { h.y = 0; },
      });
    },
    E(G, h, { s }) {
      h.st.haste = s.dur; h.st.hasteMs = s.ms; h.st.hasteAs = s.as;
      act(h, { name: 'charge', dur: 0.35 }); fx(G).transform(h, '#ff8a9a'); fx(G).mist(h.x, h.z, 2, '#ffb0c0', 0.8); sfx(G, 'spark', h, { pitch: 1.3 });
      G.emit('gear', { h, dur: s.dur });
    },
    R(G, h, o) {
      superIntro(G, h, 'R');
      act(h, { name: 'charge', dur: 0.5, unstoppable: true, cancel() { superOutro(G); } });
      G.later(0.5, () => { superOutro(G); G.emit('superFire', { h }); h.action = null; pierceWave(G, h, o, '#ff3b4b', () => fx(G).orb('#f2c49b', o.s.width * 0.55, 'ki'), { knock: 18, type: 'super', pitch: 0.6, key: 'R' }); if (h === G.player) G.shake(1.0); });
    },
  },
  zoro: {
    Q: (G, h, o) => pierceWave(G, h, o, '#8fffb8', () => fx(G).wave('#8fffb8', o.s.width), { knock: 5, pitch: 1.4 }),
    W(G, h, { ang, s }) {
      const dmg = skillDmg(h, 'W');
      sfx(G, 'slash', h);
      dashAction(G, h, { ang, len: s.range, speed: 36, pass: true, name: 'dash',
        onPass: (u) => { damage(G, h, u, dmg, { type: 'skill', stun: 0.3 }); for (const d of [-0.6, 0, 0.6]) fx(G).slash(u.x, u.z, ang + 1.57 + d, '#e8fff0', 1.8); fx(G).hitSpark(u.x, 1.1, u.z, '#3fd07a', 1.2, 'light'); sfx(G, 'hitM', u); if (h === G.player) G.shake(0.3); },
        onEnd: () => { h.action = null; act(h, { name: 'slash', dur: 0.3 }); } });
    },
    E(G, h, { px, pz, s }) {
      const dmg = skillDmg(h, 'E'), sx = h.x, sz = h.z, ang = Math.atan2(px - sx, pz - sz), len = Math.hypot(px - sx, pz - sz);
      blink(G, h, px, pz);
      fx(G).slash((sx + h.x) / 2, (sz + h.z) / 2, ang, '#ffffff', Math.max(2, len * 0.6));
      sfx(G, 'slash', h, { pitch: 0.8 });
      for (const u of G.units) if (u.alive && u.team !== h.team && hittable(G, u) && distToSegXZ(u.x, u.z, sx, sz, h.x, h.z) < u.radius + 1.2) { damage(G, h, u, dmg, { type: 'skill', stun: 0.4 }); fx(G).hitSpark(u.x, 1.1, u.z, '#3fd07a', 1.2, 'light'); }
      h.empowered = G.time + 2.5; h.atkCd = Math.min(h.atkCd, 0.05);
      act(h, { name: 'slash', dur: 0.2, unstoppable: true });
    },
    R(G, h, { s }) {
      const dmg = skillDmg(h, 'R');
      const u = pickNear(G, h, h.x, h.z, s.range);
      if (!u) return false;
      superIntro(G, h, 'R');
      act(h, {
        name: 'dash', dur: 1.0, unstoppable: true, stage: 0,
        step(G, h) {
          h.st.invuln = 0.2;
          if (this.stage === 0 && this.t > 0.3) {
            this.stage = 1; superOutro(G); G.emit('superFire', { h });
            if (u.alive) { const b = behind(h, u); blink(G, h, b.x, b.z, u); }
            h.anim.name = 'vanish'; h.anim.t = 0;
            for (let i = 0; i < 9; i++) fx(G).slash(h.x, h.z, i * 0.7, i % 3 ? '#e8fff0' : '#3fd07a', s.radius * (0.6 + (i % 3) * 0.2));
            fx(G).dome(h.x, h.z, s.radius, '#8fffb8'); sfx(G, 'slash', h, { pitch: 0.6 }); sfx(G, 'explode', h, { vol: 0.6 });
            if (h === G.player || dist(G.player, h) < 22) G.shake(1.0);
            inCircle(G, h, h.x, h.z, s.radius, (v) => { damage(G, h, v, dmg, { type: 'super', air: 0.7, stun: 0.4 }); fx(G).hitSpark(v.x, 1.3, v.z, '#3fd07a', 1.6, 'heavy'); });
          }
        },
        end() { superOutro(G); }, cancel() { superOutro(G); },
      });
    },
  },
  sanji: {
    Q(G, h, { ang, s }) {
      const dmg = skillDmg(h, 'Q');
      face(h, h.x + sin(ang), h.z + cos(ang)); act(h, { name: 'atk3', dur: 0.4 });
      const sx = h.x, sz = h.z; h.x += sin(ang) * 1.5; h.z += cos(ang) * 1.5; collide(h, h.radius);
      fx(G).slash(h.x + sin(ang), h.z + cos(ang), ang, '#ffffff', 2.2); sfx(G, 'swing', h);
      G.later(0.12, () => { let hit = false; inLine(G, h, ang, s.range - 1.5, 2.2, (u) => { hit = true; damage(G, h, u, dmg, { type: 'H', knock: 16, kdir: ang, air: 0.3 }); fx(G).hitSpark(u.x, 1.2, u.z, '#ff6a3d', 1.4, 'heavy'); sfx(G, 'hitH', u); }); if (hit && h === G.player) G.shake(0.5); });
      void sx; void sz;
    },
    W(G, h, { s }) {
      const dmg = skillDmg(h, 'W');
      act(h, { name: 'vanish', dur: 0.2 + s.hits * 0.16, unstoppable: true });
      for (let i = 0; i < s.hits; i++) G.later(0.1 + i * 0.16, () => {
        fx(G).slash(h.x, h.z, i * 2.1, '#ffffff', s.radius * 0.9); sfx(G, 'swing', h, { pitch: 1.2 });
        inCircle(G, h, h.x, h.z, s.radius, (u) => { damage(G, h, u, dmg, { type: i === s.hits - 1 ? 'H' : 'M', knock: i === s.hits - 1 ? 10 : 2, kdir: angTo(h, u), stun: 0.25 }); fx(G).hitSpark(u.x, 1.1, u.z, '#ffd0a0', 1, 'light'); });
      });
    },
    E(G, h, { px, pz }) {
      const sx = h.x, sz = h.z; face(h, px, pz);
      act(h, {
        name: 'air', dur: 0.4, unstoppable: true,
        step(G, h) { const k = Math.min(1, this.t / 0.36); h.x = sx + (px - sx) * k; h.z = sz + (pz - sz) * k; h.y = Math.sin(k * Math.PI) * 2.6; if (Math.floor(this.t * 12) !== this.s) { this.s = Math.floor(this.t * 12); fx(G).dust(h.x, h.z, 2, '#ffffff', 0.7); } },
        end(G, h) { h.y = 0; collide(h, h.radius); h.empowered = G.time + 2.5; h.atkCd = Math.min(h.atkCd, 0.05); },
        cancel() { h.y = 0; },
      });
      sfx(G, 'dash', h, { pitch: 1.4 });
    },
    R(G, h, o) {
      superIntro(G, h, 'R');
      G.later(0.3, () => { superOutro(G); G.emit('superFire', { h }); });
      return dashRush(G, h, o, '#ff6a3d', o.s.hits, 0.09, { knock: 18, air: 0.6, type: 'super' }, 'hitM', 'R');
    },
  },
  nami: {
    Q(G, h, { px, pz, s }) {
      const dmg = skillDmg(h, 'Q');
      face(h, px, pz); act(h, { name: 'cast', dur: 0.3 });
      const mark = fx(G).target(px, pz, s.radius, '#ffe36a', 0.4);
      G.later(0.4, () => {
        mark.remove(); fx(G).lightning({ x: px + 1, y: 18, z: pz - 1 }, { x: px, y: 0.2, z: pz }, '#ffe36a'); fx(G).explode(px, pz, '#ffe36a', s.radius);
        sfx(G, 'thunder', { x: px, z: pz });
        inCircle(G, h, px, pz, s.radius, (u) => damage(G, h, u, dmg, { type: 'skill', stun: 0.5 }));
      });
    },
    W(G, h, { px, pz, s }) {
      const dmg = skillDmg(h, 'W');
      face(h, px, pz); act(h, { name: 'cast', dur: 0.3 });
      fx(G).mist(px, pz, s.radius, '#bfe8ff', 3); sfx(G, 'freeze', { x: px, z: pz });
      inCircle(G, h, px, pz, s.radius, (u) => damage(G, h, u, dmg, { type: 'skill' }));
      tickZone(G, h, px, pz, s.radius, 3, 0.25, (u) => { u.st.slow = Math.max(u.st.slow, 0.4); u.st.slowAmt = Math.max(u.st.slowAmt, s.slow); });
    },
    E(G, h, { s }) {
      const dmg = skillDmg(h, 'E');
      act(h, { name: 'barrier', dur: 0.35 }); fx(G).dome(h.x, h.z, 4.2, '#ffd8a0'); fx(G).dust(h.x, h.z, 20, '#e8dcc0', 1.3); sfx(G, 'dash', h, { pitch: 0.6 });
      for (const u of G.units) if (u.alive && u.team !== h.team && (u.kind === 'hero' || u.kind === 'minion') && dist(u, h) < 4.2 + u.radius) damage(G, h, u, dmg, { type: 'skill', knock: 16, kdir: angTo(h, u), stun: 0.35 });
    },
    R(G, h, { px, pz, s }) {
      const dmg = skillDmg(h, 'R');
      superIntro(G, h, 'R'); face(h, px, pz);
      act(h, { name: 'overhead', dur: 0.5, unstoppable: true, cancel() { superOutro(G); } });
      G.later(0.45, () => {
        superOutro(G); G.emit('superFire', { h });
        const cloud = fx(G).mist(px, pz, s.radius, '#3a3f58', 3.2); sfx(G, 'thunder', { x: px, z: pz }, { vol: 1.2 });
        for (let i = 0; i < s.ticks; i++) G.later(0.2 + i * 0.36, () => {
          const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * s.radius * 0.8, x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
          fx(G).lightning({ x: x + 1, y: 16, z: z - 1 }, { x, y: 0.2, z }, '#ffe36a'); fx(G).explode(x, z, '#ffe36a', 2.2); sfx(G, 'thunder', { x, z }, { vol: 0.6 });
          inCircle(G, h, x, z, 2.6, (u) => damage(G, h, u, dmg, { type: 'super', stun: 0.3 }));
        });
        G.later(3.2, () => cloud.remove());
      });
    },
  },
});
function distToSegXZ(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz; let t = L ? ((px - ax) * dx + (pz - az) * dz) / L : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - dx * t, pz - az - dz * t); }
const heightOf = (u) => heightAtXZ(u.x, u.z) + (u.y || 0);

// 悟空的瞬間移動：游標附近有敵人時繞背，否則瞬移到點
function vanishSkill(G, h, tx, tz, px, pz, near) {
  const u = pickNear(G, h, tx, tz, near);
  if (u && dist(h, u) < sk(h, 'E').range + 3) { const b = behind(h, u); blink(G, h, b.x, b.z, u); h.empowered = G.time + 2.5; h.target = u; h.atkCd = Math.min(h.atkCd, 0.05); }
  else { const p = { x: px, z: pz }; collide(p, h.radius); blink(G, h, p.x, p.z); }
  act(h, { name: 'vanish', dur: 0.12, unstoppable: true });
}

/* ---------------- 小兵與塔的射擊 ---------------- */
export function wireShots(G) {
  G.on('minionShot', ({ src, dst }) => {
    const p = spawnProjectile(G, {
      x: src.x, z: src.z, y: 1.1, speed: 22, team: src.team, src, target: dst, radius: 0.2,
      onArrive(G, p, u) { damage(G, src, u, src.dmg * (u.kind === 'hero' ? 0.8 : u.kind === 'minion' ? 1 : src.structMul), { type: 'minion', noKi: true }); if (src.mkind === 'siege') { fx(G).hitSpark(u.x, 1.4, u.z, '#ffd08a', 1.2, 'light'); sfx(G, 'explode', u, { vol: 0.35 }); } },
    });
    p.vis = fx(G).bolt(src.team === 0 ? '#8fe8d4' : '#ffa184', src.mkind === 'siege' ? 0.5 : 0.22);
  });
  G.on('monsterShot', ({ src, dst }) => {
    const p = spawnProjectile(G, { x: src.x, z: src.z, y: 1.4, speed: 20, team: 2, src, target: dst, radius: 0.3, onArrive(G, p, u) { damage(G, src, u, src.dmg, { type: 'minion' }); fx(G).hitSpark(u.x, 1.2, u.z, '#ff6a4a', 0.8, 'light'); } });
    p.vis = fx(G).bolt('#ff6a4a', 0.4); sfx(G, 'tower', src, { vol: 0.4, pitch: 1.4 });
  });
  G.on('towerShot', ({ src, dst, dmg }) => {
    const p = spawnProjectile(G, {
      x: src.x, z: src.z, y: src.kind === 'core' ? 7 : 6.6, speed: 26, team: src.team, src, target: dst, radius: 0.4,
      onArrive(G, p, u) {
        damage(G, src, u, dmg, { type: 'tower', noKi: false });
        fx(G).hitSpark(u.x, 1.2, u.z, src.team === 0 ? '#8fe8d4' : '#ffa184', 1.2, 'light');
        sfx(G, 'towerHit', u);
        if (u === G.player) G.shake(0.35);
      },
    });
    p.vis = fx(G).orb(src.team === 0 ? '#8fe8d4' : '#ffa184', 0.6, 'tower');
    sfx(G, 'tower', src);
  });
}
export { skillDmg };
