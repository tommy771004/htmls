// 投擲物：固定池，彈跳用 raycast。破片傷害、煙霧擋視線、閃光致盲。
import { G } from './state.js';
import { TMP_VEC3_A, TMP_VEC3_B } from '../core/tmp.js';
import { world, clear, hurt } from './weapons.js';
import { explosion, smokePuff, fx } from '../fx/particles.js';
import { play as sfx } from '../audio/sfx.js';

const N = 12, ng = [];
for (let i = 0; i < N; i++) ng.push({ on: false, kind: '', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0, owner: null });
export const smokes = []; for (let i = 0; i < 4; i++) smokes.push({ on: false, x: 0, y: 0, z: 0, t: 0, puff: 0 });

export function clearNades() { for (const n of ng) n.on = false; for (const s of smokes) s.on = false; }
export function throwNade(a, kind, yaw, pitch) {
  const cp = Math.cos(pitch), sp = 15;
  throwNadeAt(a, kind, a.x + Math.sin(yaw) * 0.4, a.y + a.eye - 0.1, a.z + Math.cos(yaw) * 0.4,
    Math.sin(yaw) * cp * sp + a.vx, Math.sin(pitch) * sp + 2.5 + a.vy * 0.5, Math.cos(yaw) * cp * sp + a.vz);
}
/** 從指定位置與初速丟出。連線時別人丟的投擲物用這個重演，每台機器各自模擬彈跳（傷害只有主機算）。 */
export function throwNadeAt(a, kind, x, y, z, vx, vy, vz) {
  const n = ng.find(g => !g.on); if (!n) return;
  n.on = true; n.kind = kind; n.owner = a; n.t = kind === 'smoke' ? 2 : 1.6;
  n.x = x; n.y = y; n.z = z; n.vx = vx; n.vy = vy; n.vz = vz;
  world.net?.nade(a, kind, x, y, z, vx, vy, vz);
}

const from = TMP_VEC3_A, to = TMP_VEC3_B;
function detonate(n) {
  n.on = false;
  if (n.kind === 'frag') {
    explosion(n.x, n.y, n.z); sfx('nade_explode', n.x, n.y, n.z);
    if (world.net?.client) return;   // 連線的客戶端：破片傷害由主機算
    for (const v of world.agents) {
      if (!v.alive) continue;
      const d = Math.hypot(v.x - n.x, v.y + 1 - n.y, v.z - n.z); if (d > 8) continue;
      if (!clear(n.x, n.y + 0.2, n.z, v.x, v.y + 1, v.z)) continue;
      const dmg = 98 * (1 - d / 8) ** 1.4 * (v.armor > 0 ? 0.6 : 1);
      if (v.team !== n.owner.team || v === n.owner) hurt(v, dmg, n.owner, 'frag', false, n.x, n.z);
    }
  } else if (n.kind === 'smoke') {
    const s = smokes.find(q => !q.on); sfx('smoke', n.x, n.y, n.z);
    if (s) { s.on = true; s.x = n.x; s.y = n.y; s.z = n.z; s.t = 16; s.puff = 0; }
  } else {
    sfx('flash', n.x, n.y, n.z);
    fx.fire.spawn(n.x, n.y, n.z, 0, 0, 0, 0.12, 2, 7, 1, 1, 1, 1);
    for (const v of world.agents) {
      if (!v.alive) continue;
      const d = Math.hypot(v.x - n.x, v.y + 1.6 - n.y, v.z - n.z); if (d > 22) continue;
      if (!clear(n.x, n.y + 0.2, n.z, v.x, v.y + v.eye, v.z)) continue;
      const fx0 = Math.sin(v.yaw), fz0 = Math.cos(v.yaw), dot = ((n.x - v.x) * fx0 + (n.z - v.z) * fz0) / (d || 1);
      const k = Math.max(0.25, (dot + 1) / 2) * (1 - d / 22);
      if (v === G.me) G.flash = Math.max(G.flash, Math.min(1.6, k * 3));
      else if (v.bot) v.bot.blind = Math.max(v.bot.blind, k * 4);
    }
  }
}

export function tickNades(dt) {
  for (let i = 0; i < N; i++) {
    const n = ng[i]; if (!n.on) continue;
    n.t -= dt; n.vy -= 15 * dt;
    const dx = n.vx * dt, dy = n.vy * dt, dz = n.vz * dt;
    from.copyFromFloats(n.x, n.y, n.z); to.copyFromFloats(n.x + dx * 1.2, n.y + dy * 1.2, n.z + dz * 1.2);
    const h = world.ctx.ray(from, to);
    if (h.hasHit) {
      const nx = h.hitNormalWorld.x, ny = h.hitNormalWorld.y, nz = h.hitNormalWorld.z, vn = n.vx * nx + n.vy * ny + n.vz * nz;
      n.vx = (n.vx - 1.5 * vn * nx) * 0.72; n.vy = (n.vy - 1.5 * vn * ny) * 0.55; n.vz = (n.vz - 1.5 * vn * nz) * 0.72;
      if (Math.abs(vn) > 2) sfx('nade_bounce', n.x, n.y, n.z);
    } else { n.x += dx; n.y += dy; n.z += dz; }
    fx.fire.spawn(n.x, n.y, n.z, 0, 0, 0, 0.03, 0.08, 0.08, 0.7, 0.7, 0.65, 0.35);
    if (n.t <= 0) detonate(n);
  }
  for (const s of smokes) {
    if (!s.on) continue;
    s.t -= dt; s.puff -= dt;
    if (s.t <= 0) { s.on = false; continue; }
    if (s.puff <= 0 && s.t > 2) { s.puff = 0.06; smokePuff(s.x, s.y, s.z); }
  }
}

/** 線段穿過煙霧就回 true。 */
export function smoked(ax, ay, az, bx, by, bz) {
  for (let i = 0; i < 4; i++) {
    const s = smokes[i]; if (!s.on) continue;
    const dx = bx - ax, dy = by - ay, dz = bz - az, l2 = dx * dx + dy * dy + dz * dz, t = Math.max(0, Math.min(1, ((s.x - ax) * dx + (s.y + 1 - ay) * dy + (s.z - az) * dz) / (l2 || 1)));
    const qx = ax + dx * t - s.x, qy = ay + dy * t - s.y - 1, qz = az + dz * t - s.z;
    if (qx * qx + qy * qy + qz * qz < 12) return true;
  }
  return false;
}
