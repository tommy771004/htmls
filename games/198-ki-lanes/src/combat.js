// 普攻連段、技能、投射物、區域效果。
import { COMBO_WINDOW, KI_BAR, SPARK, RECALL_TIME } from './config.js';
import {
  damage, dist, dist2, angTo, clamp, steer, face, enemiesNear, nearestEnemy, targetable, vulnerable, moveSpeed, interrupt, cancelRecall, addKi, heal,
} from './units.js';
import { collide, blocked, walkable } from './map.js';

const sin = Math.sin, cos = Math.cos;
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
        if (!u.alive || u.team === p.team || p.hit.has(u) || u.st.invuln > 0) continue;
        if (p.skipStructures && (u.kind === 'tower' || u.kind === 'core')) continue;
        const rr = u.radius + p.radius;
        if (dist2(u, p) < rr * rr) {
          p.hit.add(u);
          if (p.onHit(G, p, u) !== false && !p.pierce) { done = true; break; }
        }
      }
      if (p.traveled >= p.range) { p.onEnd && p.onEnd(G, p); done = true; }
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
  const spd = Math.min(1, h.as / 0.8);
  const wind = c.wind * spd, total = Math.max(h.as * (h.chain === 2 ? 1.25 : 1), wind + 0.12);
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
    const near = nearestEnemy(G, h, h.range + 1.2, (o) => targetable(G, o));
    if (near) t = near;
  }
  if (t) {
    const d = dist(h, t) - t.radius - h.radius;
    if (d > h.range) { steer(G, h, t.x, t.z, spd, dt, 0); setAnim(h, 'run'); return; }
    if (h.atkCd <= 0) { startAuto(G, h, t); return; }
    face(h, t.x, t.z); setAnim(h, 'idle'); return;
  }
  if (h.goal) {
    const arrived = steer(G, h, h.goal.x, h.goal.z, spd, dt, 0.25);
    if (arrived) { h.goal = null; setAnim(h, 'idle'); } else setAnim(h, 'run');
    return;
  }
  setAnim(h, 'idle');
}
function setAnim(h, n) { if (h.anim.name !== n) { h.anim.name = n; h.anim.t = 0; } }

/* ---------------- 指令 ---------------- */
export function orderMove(G, h, x, z) {
  if (!h.alive) return;
  h.goal = { x, z }; h.target = null; h.charging = false; cancelRecall(G, h);
}
export function orderAttack(G, h, t) {
  if (!h.alive || !t || t.team === h.team) return;
  h.target = t; h.goal = null; h.charging = false; cancelRecall(G, h);
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
  fx(G).ring(h.x, h.z, h.def.color, 5, 0.5); fx(G).hitSpark(h.x, 1.2, h.z, h.def.glow, 2.2, 'heavy');
  sfx(G, 'spark', h); if (h === G.player) G.shake(0.6);
  G.emit('spark', h); return true;
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
  h.action && h.action.auto && (h.action = h.action.keep ? h.action : h.action);
  h.cds[k] = s.cd * (1 - 0.06 * (h.ranks[k] - 1)); if (k === 'R') h.cds[k] = s.cd;
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
        if (!u.alive || u.team === h.team || passed.has(u) || !targetable(G, u)) continue;
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
    if (!u.alive || u.team === h.team || !targetable(G, u) || u.kind === 'tower' || u.kind === 'core') continue;
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
    if (!u.alive || u.team === h.team || !targetable(G, u)) continue;
    const ox = u.x - h.x, oz = u.z - h.z, along = ox * nx + oz * nz, perp = Math.abs(ox * nz - oz * nx);
    if (along > -0.5 && along < len + u.radius && perp < width / 2 + u.radius) fn(u);
  }
}
function inCircle(G, h, x, z, r, fn, structures = true) {
  for (const u of G.units) {
    if (!u.alive || u.team === h.team || !targetable(G, u)) continue;
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
const KITS = {
  homura: {
    Q(G, h, { ang, s }) {
      act(h, {
        name: 'cast', dur: 0.32, fired: false,
        step(G, h) {
          if (this.fired || this.t < 0.13) return; this.fired = true;
          const dmg = skillDmg(h, 'Q');
          const boom = (G, p) => {
            fx(G).explode(p.x, p.z, '#ff7a1a', s.radius); sfx(G, 'explode', p);
            inCircle(G, h, p.x, p.z, s.radius, (u) => damage(G, h, u, dmg, { type: 'skill', knock: 6, kdir: angTo(p, u) }));
            if (h === G.player) G.shake(0.4);
          };
          const p = spawnProjectile(G, { x: h.x + sin(ang), z: h.z + cos(ang), y: 1.3, ang, speed: s.speed, range: s.range, team: h.team, src: h, radius: 0.7, onHit: (G, p) => { boom(G, p); }, onEnd: boom });
          p.vis = fx(G).orb('#ff7a1a', 0.8, 'fire'); sfx(G, 'blast', h);
        },
      });
      face(h, h.x + sin(ang), h.z + cos(ang));
    },
    W(G, h, { ang, s, rank }) {
      const dmg = skillDmg(h, 'W');
      sfx(G, 'dash', h);
      dashAction(G, h, {
        ang, len: s.range, speed: 30,
        onContact: (u) => { rushAction(G, h, u, { n: s.hits, gap: 0.1, dmg, finisher: { knock: 15, air: 0.45 }, color: '#ff7a1a' }); return true; },
      });
    },
    E(G, h, { px, pz, tx, tz }) { return vanishSkill(G, h, tx, tz, px, pz, 3); },
    R(G, h, { ang, s }) {
      const dmg = skillDmg(h, 'R');
      superIntro(G, h, 'R');
      face(h, h.x + sin(ang), h.z + cos(ang));
      let beam = null, tick = 0, snd = null;
      act(h, {
        name: 'beam', dur: 0.32 + 1.25, unstoppable: true,
        step(G, h, dt) {
          if (this.t < 0.32) return;
          if (!beam) { superOutro(G); beam = fx(G).beam(h, ang, s.range, s.width, '#ff7a1a', '#fff1c8'); snd = sfx(G, 'beam', h); G.emit('superFire', { h }); }
          beam.update(h, ang);
          if (h === G.player) G.shake(0.55);
          const tt = this.t - 0.32;
          while (tick < s.ticks && tt >= tick * (1.2 / s.ticks)) {
            tick++;
            inLine(G, h, ang, s.range, s.width + 0.6, (u) => {
              damage(G, h, u, dmg, { type: tick === s.ticks ? 'super' : 'skill', knock: tick === s.ticks ? 14 : 1.5, kdir: ang, stun: 0.3 });
              fx(G).hitSpark(u.x, 1.2, u.z, '#ffd29a', 1.1, 'light');
            });
          }
        },
        end() { beam && beam.remove(); snd && snd.stop && snd.stop(); superOutro(G); },
        cancel() { beam && beam.remove(); snd && snd.stop && snd.stop(); superOutro(G); },
      });
    },
  },

  shimo: {
    Q(G, h, { ang, s }) {
      face(h, h.x + sin(ang), h.z + cos(ang));
      act(h, {
        name: 'cast', dur: 0.34, fired: false,
        step(G, h) {
          if (this.fired || this.t < 0.15) return; this.fired = true;
          const dmg = skillDmg(h, 'Q');
          const p = spawnProjectile(G, {
            x: h.x + sin(ang), z: h.z + cos(ang), y: 1.3, ang, speed: s.speed, range: s.range, team: h.team, src: h, radius: s.width / 2, pierce: true,
            onHit(G, p, u) { damage(G, h, u, dmg, { type: 'skill', slow: s.slow, slowT: 2, knock: 3, kdir: ang }); fx(G).hitSpark(u.x, 1.2, u.z, '#bfefff', 1.1, 'ice'); sfx(G, 'freeze', u, { vol: 0.5 }); },
          });
          p.vis = fx(G).lance('#7fd8ff'); sfx(G, 'blast', h, { pitch: 1.3 });
        },
      });
    },
    W(G, h, { ang, s }) {
      const dmg = skillDmg(h, 'W');
      sfx(G, 'dash', h, { pitch: 1.2 });
      dashAction(G, h, {
        ang, len: s.range, speed: 34, pass: true, name: 'dash',
        onPass: (u) => { damage(G, h, u, dmg, { type: 'skill', slow: 0.3, slowT: 1.5 }); fx(G).hitSpark(u.x, 1.1, u.z, '#bfefff', 1.2, 'ice'); sfx(G, 'hitM', u); if (h === G.player) G.shake(0.25); },
        onEnd: () => {
          h.action = null;
          act(h, { name: 'atk3', dur: 0.3 });
          fx(G).slash(h.x, h.z, ang, '#bfefff', 2.6); sfx(G, 'freeze', h);
          inCircle(G, h, h.x + sin(ang) * 1.2, h.z + cos(ang) * 1.2, 2.6, (u) => damage(G, h, u, dmg * 0.6, { type: 'H', knock: 8 }), false);
        },
      });
    },
    E(G, h, { px, pz }) {
      const ox = h.x, oz = h.z;
      const p = { x: px, z: pz }; collide(p, h.radius);
      blink(G, h, p.x, p.z);
      act(h, { name: 'vanish', dur: 0.12, unstoppable: true });
      const zone = { x: ox, z: oz, r: 3, t: 0, dur: 3, team: h.team, tick(G, z) { inCircle(G, h, z.x, z.z, z.r, (u) => { u.st.slow = Math.max(u.st.slow, 0.3); u.st.slowAmt = Math.max(u.st.slowAmt, 0.45); }, false); } };
      zone.vis = fx(G).mist(ox, oz, 3, '#bfefff', 3);
      G.zones.push(zone);
    },
    R(G, h, { px, pz, s }) {
      const dmg = skillDmg(h, 'R');
      superIntro(G, h, 'R');
      face(h, px, pz);
      const mark = fx(G).target(px, pz, s.radius, '#7fd8ff', 1.1);
      act(h, {
        name: 'cast', dur: 0.4,
        end(G, h) {
          superOutro(G);
          G.emit('superFire', { h });
          fx(G).comet(px, pz, '#bfefff', 0.7);
          G.later(0.7, () => {
            mark.remove();
            fx(G).explode(px, pz, '#bfefff', s.radius, 'ice'); fx(G).iceField(px, pz, s.radius);
            sfx(G, 'freeze', { x: px, z: pz }); sfx(G, 'explode', { x: px, z: pz });
            if (h === G.player || dist(G.player, { x: px, z: pz }) < 20) G.shake(0.9);
            inCircle(G, h, px, pz, s.radius, (u) => damage(G, h, u, dmg, { type: 'super', freeze: 1.2 }));
          });
        },
        cancel() { superOutro(G); mark.remove(); },
      });
    },
  },

  iwao: {
    Q(G, h, { ang, s }) {
      face(h, h.x + sin(ang), h.z + cos(ang));
      act(h, {
        name: 'atk3', dur: 0.45, fired: false,
        step(G, h) {
          if (this.fired || this.t < 0.22) return; this.fired = true;
          const dmg = skillDmg(h, 'Q');
          fx(G).quake(h.x, h.z, ang, s.range, s.arc, '#9be03c');
          sfx(G, 'slam', h);
          if (h === G.player) G.shake(0.6);
          for (const u of G.units) {
            if (!u.alive || u.team === h.team || !targetable(G, u)) continue;
            const d = dist(h, u); if (d > s.range + u.radius) continue;
            let da = angTo(h, u) - ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
            if (Math.abs(da) < s.arc * 0.6 || d < 1.6) damage(G, h, u, dmg, { type: 'skill', air: 0.6 });
          }
        },
      });
    },
    W(G, h, { ang, s }) {
      const dmg = skillDmg(h, 'W');
      let carried = null;
      sfx(G, 'dash', h, { pitch: 0.7 });
      dashAction(G, h, {
        ang, len: s.range, speed: 24, name: 'dash', hitR: 1.5,
        onContact: (u) => {
          if (u.kind === 'tower' || u.kind === 'core') return true;
          if (!carried && (u.kind === 'hero' || true)) { carried = u; }
          if (u !== carried) { damage(G, h, u, dmg, { type: 'M', knock: 12, kdir: ang + (Math.random() < 0.5 ? 1 : -1) }); return false; }
          return false;
        },
        onEnd: () => { if (carried && carried.alive) { h.action = null; rushAction(G, h, carried, { n: s.hits, gap: 0.14, dmg, finisher: { knock: 16, air: 0.5 }, color: '#9be03c', sound: 'hitH' }); } },
      });
      // 頂著目標
      const a = h.action, base = a.step;
      a.step = function (G, h, dt) {
        base.call(this, G, h, dt);
        if (carried && carried.alive) { carried.x = h.x + sin(ang) * (h.radius + carried.radius + 0.2); carried.z = h.z + cos(ang) * (h.radius + carried.radius + 0.2); carried.st.stun = Math.max(carried.st.stun, 0.3); collide(carried, carried.radius); }
      };
    },
    E(G, h, { px, pz, s, rank }) {
      const p = { x: px, z: pz }; collide(p, h.radius);
      blink(G, h, p.x, p.z);
      h.st.shield = s.shield[rank]; h.st.shieldT = 3;
      fx(G).shieldFx(h, '#9be03c', 3);
      act(h, { name: 'vanish', dur: 0.12, unstoppable: true });
    },
    R(G, h, { px, pz, s }) {
      const dmg = skillDmg(h, 'R');
      superIntro(G, h, 'R');
      face(h, px, pz);
      const sx = h.x, sz = h.z, mark = fx(G).target(px, pz, s.radius, '#9be03c', 0.9);
      act(h, {
        name: 'leap', dur: 0.25 + 0.6, unstoppable: true,
        step(G, h, dt) {
          if (this.t < 0.25) return;
          if (!this.go) { this.go = true; superOutro(G); G.emit('superFire', { h }); sfx(G, 'dash', h, { pitch: 0.6 }); h.st.invuln = 0.6; }
          const k = Math.min(1, (this.t - 0.25) / 0.6);
          h.x = sx + (px - sx) * k; h.z = sz + (pz - sz) * k; h.y = Math.sin(k * Math.PI) * 6;
        },
        end(G, h) {
          h.y = 0; h.vy = 0; collide(h, h.radius); mark.remove();
          fx(G).explode(h.x, h.z, '#9be03c', s.radius, 'rock'); fx(G).crater(h.x, h.z, s.radius);
          sfx(G, 'slam', h); sfx(G, 'explode', h);
          if (h === G.player || dist(G.player, h) < 22) G.shake(1.1);
          inCircle(G, h, h.x, h.z, s.radius, (u) => damage(G, h, u, dmg, { type: 'super', air: 1.0 }));
          act(h, { name: 'atk3', dur: 0.3 });
        },
        cancel() { superOutro(G); mark.remove(); h.y = 0; },
      });
    },
  },

  raiga: {
    Q(G, h, { ang, s }) {
      face(h, h.x + sin(ang), h.z + cos(ang));
      act(h, {
        name: 'cast', dur: 0.26, fired: false,
        step(G, h) {
          if (this.fired || this.t < 0.1) return; this.fired = true;
          const dmg = skillDmg(h, 'Q');
          const p = spawnProjectile(G, {
            x: h.x + sin(ang), z: h.z + cos(ang), y: 1.3, ang, speed: s.speed, range: s.range, team: h.team, src: h, radius: 0.6,
            onHit(G, p, u) {
              damage(G, h, u, dmg, { type: 'skill', stun: 0.2 }); fx(G).hitSpark(u.x, 1.2, u.z, '#ffe14a', 1.2, 'spark'); sfx(G, 'thunder', u, { vol: 0.6 });
              let from = u; const hitSet = new Set([u]);
              for (let c = 0; c < s.chain; c++) {
                let nb = null, bd = 6;
                for (const o of G.units) { if (!o.alive || o.team === h.team || hitSet.has(o) || !targetable(G, o)) continue; const d = dist(o, from); if (d < bd) { bd = d; nb = o; } }
                if (!nb) break;
                hitSet.add(nb); const a = from, b = nb;
                fx(G).lightning({ x: a.x, y: 1.2, z: a.z }, { x: b.x, y: 1.2, z: b.z }, '#ffe14a');
                damage(G, h, b, dmg * 0.7, { type: 'skill', stun: 0.15 });
                from = nb;
              }
            },
          });
          p.vis = fx(G).orb('#ffe14a', 0.55, 'spark'); sfx(G, 'thunder', h, { vol: 0.4, pitch: 1.4 });
        },
      });
    },
    W(G, h, { ang, s }) {
      const dmg = skillDmg(h, 'W');
      sfx(G, 'dash', h, { pitch: 1.4 });
      dashAction(G, h, {
        ang, len: s.range, speed: 38,
        onContact: (u) => { rushAction(G, h, u, { n: s.hits, gap: 0.065, dmg, finisher: { knock: 12, stun: 0.4 }, color: '#ffe14a', sound: 'hitL' }); return true; },
      });
    },
    E(G, h, { px, pz, tx, tz, s }) {
      const u = pickNear(G, h, tx, tz, 3.5) || pickNear(G, h, px, pz, 3.5);
      if (u && dist(h, u) < s.range + 3) {
        const b = behind(h, u); blink(G, h, b.x, b.z, u);
        h.chain = 0; h.atkCd = 0; h.empowered = G.time + 2.5; h.target = u;
      } else { const p = { x: px, z: pz }; collide(p, h.radius); blink(G, h, p.x, p.z); }
      act(h, { name: 'vanish', dur: 0.1, unstoppable: true });
    },
    R(G, h, { s }) {
      const dmg = skillDmg(h, 'R');
      const list = [];
      for (const u of G.units) if (u.alive && u.team !== h.team && targetable(G, u) && u.kind !== 'tower' && u.kind !== 'core' && dist(u, h) < s.range) list.push(u);
      if (!list.length) return false;
      list.sort((a, b) => (b.kind === 'hero') - (a.kind === 'hero') || dist(a, h) - dist(b, h));
      const tg = list.slice(0, s.targets);
      superIntro(G, h, 'R');
      let i = 0, next = 0.3;
      const strikes = Math.max(6, tg.length);
      act(h, {
        name: 'rush', dur: 0.3 + strikes * 0.13 + 0.35, unstoppable: true,
        step(G, h, dt) {
          h.st.invuln = 0.2;
          if (this.t >= 0.3 && !this.go) { this.go = true; superOutro(G); G.emit('superFire', { h }); }
          if (i < strikes && this.t >= next) {
            let u = tg[i % tg.length];
            if (!u.alive) u = tg.find((x) => x.alive);
            if (!u) { this.t = this.dur; return; }
            const a = Math.random() * Math.PI * 2, d = u.radius + h.radius + 0.5;
            const ox = h.x, oz = h.z;
            h.x = u.x + sin(a) * d; h.z = u.z + cos(a) * d; face(h, u.x, u.z);
            fx(G).lightning({ x: ox, y: 1.0, z: oz }, { x: h.x, y: 1.0, z: h.z }, '#fff3a0');
            const last = i === strikes - 1;
            damage(G, h, u, dmg * (last ? 1.6 : 0.55), { type: last ? 'super' : 'skill', stun: 0.5, knock: last ? 14 : 0 });
            fx(G).hitSpark(u.x, 1.2, u.z, '#ffe14a', last ? 2 : 1.2, last ? 'heavy' : 'spark');
            fx(G).slash(u.x, u.z, a + Math.PI, '#fff3a0', 1.6);
            sfx(G, last ? 'thunder' : 'hitM', u);
            if (h === G.player) G.shake(last ? 0.9 : 0.3);
            h.anim.name = i % 2 ? 'atk1' : 'atk2'; h.anim.t = 0;
            i++; next += 0.13;
          }
        },
        end() { superOutro(G); }, cancel() { superOutro(G); },
      });
    },
  },
};

// 燎的殘影步：游標附近有敵人時繞背，否則瞬移到點
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
