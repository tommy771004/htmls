// 角色移動與地圖碰撞（玩家、Bot 共用）。
// 沒用 Havok 的 PhysicsCharacterController：它每步內部會配置接觸點物件，違反 tick 零配置，
// 而且十個角色各一個太重。這裡對 layout 同一批盒子與楔形做解析解，槍彈與手雷仍走 Havok raycast。
import { COVER_DIMS, coverBase, wallPieces, rampHeight, SLAB } from '../map/query.js';

export const RADIUS = 0.35, STAND_H = 1.8, CROUCH_H = 1.25, STEP = 0.45, CELL = 4;
const G = 15, FRICTION = 5.2, ACCEL = 5.5, AIR_ACCEL = 1.2, STOP = 2.6, EPS = 0.001;

// 實體以 SoA 存放：cx cz hx hz cos sin y0 y1 kind(0 盒 1 圓 2 坡) ramp
const S = { n: 0, cx: null, cz: null, hx: null, hz: null, c: null, s: null, y0: null, y1: null, kind: null, ramp: [] };
let grid = null, gridN = 0, gx0 = 0, gz0 = 0, mark = null, stamp = 0;

export function initCollision(L) {
  const list = [];
  const add = (cx, cz, hx, hz, rot, y0, y1, kind = 0, ramp = -1) => list.push([cx, cz, hx, hz, Math.cos(rot), Math.sin(rot), y0, y1, kind, ramp]);
  for (const g of L.ground) add((g.x0 + g.x1) / 2, (g.z0 + g.z1) / 2, (g.x1 - g.x0) / 2, (g.z1 - g.z0) / 2, 0, g.y - SLAB, g.y);
  for (const b of L.blocks) add((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, (b.x1 - b.x0) / 2, (b.z1 - b.z0) / 2, 0, b.y0, b.y1);
  L.ramps.forEach((r, i) => { S.ramp[i] = r; add((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, (r.x1 - r.x0) / 2, (r.z1 - r.z0) / 2, 0, Math.min(r.y0, r.y1) - 0.3, Math.max(r.y0, r.y1), 2, i); });
  for (const w of L.walls) {
    const len = Math.hypot(w.bx - w.ax, w.bz - w.az), ux = (w.bx - w.ax) / len, uz = (w.bz - w.az) / len, alongX = Math.abs(ux) > 0.5;
    for (const q of wallPieces(w)) { const m = (q.s0 + q.s1) / 2, h = (q.s1 - q.s0) / 2; add(w.ax + ux * m, w.az + uz * m, alongX ? h : w.t / 2, alongX ? w.t / 2 : h, 0, q.y0, q.y1); }
  }
  for (const c of L.cover) {
    const d = COVER_DIMS[c.kind], y = coverBase(L, c), y1 = y + d.h * (c.stack || 1);
    if (d.r) add(c.x, c.z, d.r, d.r, 0, y, y1, 1); else add(c.x, c.z, d.w / 2, d.d / 2, (c.rot || 0) * Math.PI / 180, y, y1);
  }
  S.n = list.length;
  for (const [k, i] of [['cx', 0], ['cz', 1], ['hx', 2], ['hz', 3], ['c', 4], ['s', 5], ['y0', 6], ['y1', 7]]) S[k] = Float32Array.from(list, a => a[i]);
  S.kind = Int8Array.from(list, a => a[8]); S.rid = Int16Array.from(list, a => a[9]);
  // 均勻格：每格固定 64 槽
  gx0 = L.bounds.x0; gz0 = L.bounds.z0; gridN = Math.ceil((L.bounds.x1 - L.bounds.x0) / CELL);
  const CAP = 48; grid = new Int32Array(gridN * gridN * (CAP + 1)); mark = new Int32Array(S.n);
  for (let i = 0; i < S.n; i++) {
    const r = Math.hypot(S.hx[i], S.hz[i]) + RADIUS + 0.1;
    const i0 = Math.max(0, Math.floor((S.cx[i] - r - gx0) / CELL)), i1 = Math.min(gridN - 1, Math.floor((S.cx[i] + r - gx0) / CELL));
    const j0 = Math.max(0, Math.floor((S.cz[i] - r - gz0) / CELL)), j1 = Math.min(gridN - 1, Math.floor((S.cz[i] + r - gz0) / CELL));
    for (let a = i0; a <= i1; a++) for (let b = j0; b <= j1; b++) { const k = (b * gridN + a) * (CAP + 1); if (grid[k] < CAP) grid[k + 1 + grid[k]++] = i; }
  }
  S.CAP = CAP;
}

// 圓對旋轉矩形：回傳穿透深度，法線放模組變數
let nx = 0, nz = 0, cpx = 0, cpz = 0;
function circleBox(i, x, z, r) {
  const dx = x - S.cx[i], dz = z - S.cz[i];
  if (S.kind[i] === 1) { const d = Math.hypot(dx, dz), p = r + S.hx[i] - d; if (p <= 0) return 0; nx = d > EPS ? dx / d : 1; nz = d > EPS ? dz / d : 0; cpx = x - nx * r; cpz = z - nz * r; return p; }
  const c = S.c[i], s = S.s[i], lx = dx * c - dz * s, lz = dx * s + dz * c, hx = S.hx[i], hz = S.hz[i];
  const qx = Math.max(-hx, Math.min(hx, lx)), qz = Math.max(-hz, Math.min(hz, lz));
  const ex = lx - qx, ez = lz - qz, d2 = ex * ex + ez * ez;
  let ax, az, p;
  if (d2 > EPS * EPS) { const d = Math.sqrt(d2); if (d >= r) return 0; ax = ex / d; az = ez / d; p = r - d; }
  else { const px = hx - Math.abs(lx), pz = hz - Math.abs(lz); if (px < pz) { ax = Math.sign(lx) || 1; az = 0; p = px + r; } else { ax = 0; az = Math.sign(lz) || 1; p = pz + r; } }
  nx = ax * c + az * s; nz = -ax * s + az * c;
  cpx = S.cx[i] + qx * c + qz * s; cpz = S.cz[i] - qx * s + qz * c;
  return p;
}

function topAt(i, x, z) {
  if (S.kind[i] !== 2) return S.y1[i];
  return rampHeight(S.ramp[S.rid[i]], x, z);
}

/** 依 (x,z) 的鄰近格列舉實體。fn 不是閉包：用模組狀態，避免配置。 */
function eachBegin(x, z) {
  stamp++;
  const a = Math.floor((x - gx0) / CELL), b = Math.floor((z - gz0) / CELL);
  cellK = (a < 0 || b < 0 || a >= gridN || b >= gridN) ? -1 : (b * gridN + a) * (S.CAP + 1);
  cellI = 0;
}
let cellK = -1, cellI = 0;
function eachNext() {
  if (cellK < 0) return -1;
  const n = grid[cellK];
  while (cellI < n) { const i = grid[cellK + 1 + cellI++]; if (mark[i] !== stamp) { mark[i] = stamp; return i; } }
  return -1;
}

/** 腳下 y 以上 STEP 內最高的可站面。 */
export function floorAt(x, z, y, r = RADIUS * 0.8) {
  let best = -Infinity;
  eachBegin(x, z);
  for (let i = eachNext(); i >= 0; i = eachNext()) {
    if (circleBox(i, x, z, r) <= 0) continue;
    const t = S.kind[i] === 2 ? topAt(i, x, z) : S.y1[i];
    if (t <= y + STEP && t > best) best = t;
  }
  return best;
}

function collideXZ(a, h) {
  for (let it = 0; it < 3; it++) {
    let any = false;
    eachBegin(a.x, a.z);
    for (let i = eachNext(); i >= 0; i = eachNext()) {
      const y0 = S.y0[i]; if (y0 >= a.y + h - 0.02) continue;
      const p = circleBox(i, a.x, a.z, RADIUS); if (p <= 0) continue;
      const t = S.kind[i] === 2 ? topAt(i, cpx, cpz) : S.y1[i];
      if (t <= a.y + (a.ground ? STEP : 0.1)) continue;
      const dn = nx, dz = nz;
      a.x += dn * p; a.z += dz * p;
      const vn = a.vx * dn + a.vz * dz;
      if (vn < 0) { a.vx -= vn * dn; a.vz -= vn * dz; }
      any = true;
    }
    if (!any) break;
  }
}

/** a：{x,y,z,vx,vy,vz,ground,crouch,h}。wishX/Z 是世界座標單位方向乘強度 0..1，speed 是目標速度。 */
export function step(a, wishX, wishZ, speed, jump, dt) {
  const h = a.h;
  if (a.ground) {
    const sp = Math.hypot(a.vx, a.vz);
    if (sp > 0.01) { const drop = Math.max(sp, STOP) * FRICTION * dt, ns = Math.max(0, sp - drop) / sp; a.vx *= ns; a.vz *= ns; }
    else { a.vx = 0; a.vz = 0; }
  }
  const wl = Math.hypot(wishX, wishZ);
  if (wl > 1e-4) {
    const dx = wishX / wl, dz = wishZ / wl, want = speed * Math.min(1, wl), cur = a.vx * dx + a.vz * dz, add = want - cur;
    if (add > 0) { const acc = Math.min(add, (a.ground ? ACCEL : AIR_ACCEL) * want * dt * (a.ground ? 2.1 : 1)); a.vx += acc * dx; a.vz += acc * dz; }
  }
  if (jump && a.ground) { a.vy = Math.sqrt(2 * G * 1.1); a.ground = false; }
  if (!a.ground) a.vy -= G * dt;

  // 高速分段，防穿牆
  const sub = Math.hypot(a.vx, a.vz) * dt > RADIUS * 0.8 ? 2 : 1;
  for (let k = 0; k < sub; k++) { a.x += a.vx * dt / sub; a.z += a.vz * dt / sub; collideXZ(a, h); }
  const ny = a.y + a.vy * dt;
  const f = floorAt(a.x, a.z, Math.max(a.y, ny));
  if (a.vy <= 0 && f > -Infinity && ny <= f + (a.ground ? 0.28 : 0)) { a.y = f; a.vy = 0; a.ground = true; }
  else {
    a.ground = false;
    a.y = ny;
    if (a.vy > 0) { // 撞頭
      eachBegin(a.x, a.z);
      for (let i = eachNext(); i >= 0; i = eachNext()) if (S.y0[i] >= a.y + 0.3 && S.y0[i] < a.y + h && circleBox(i, a.x, a.z, RADIUS * 0.8) > 0) { a.y = S.y0[i] - h; a.vy = 0; break; }
    }
  }
  if (a.y < -24) a.fell = true;
}

/** 蹲起能否站直。 */
export function canStand(a) {
  eachBegin(a.x, a.z);
  for (let i = eachNext(); i >= 0; i = eachNext()) if (S.y0[i] > a.y + 0.5 && S.y0[i] < a.y + STAND_H && circleBox(i, a.x, a.z, RADIUS * 0.9) > 0) return false;
  return true;
}
