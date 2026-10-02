// 碰撞世界（SPEC §7）：有向盒 + 斜坡 + 地形；8 m 空間雜湊。
import * as THREE from 'three';
import { clamp } from './shared.js';
import { WORLD } from './config.js';

const CELL = 8, STEP = 0.55, SNAP = 0.5;
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // 斜坡上坡方向 -Z,+X,+Z,-X

export class Physics {
  constructor(ctx) {
    this.ctx = ctx;
    this.cols = new Map();
    this.hash = new Map();
    this.nextId = 1;
    this.stamp = 0;
    this._near = [];
    this._g = { y: 0, normal: new THREE.Vector3(0, 1, 0), colliderId: null };
    this._r = { pos: null, vel: null, grounded: false, groundNormal: this._g.normal, hitWall: false, ceiling: false };
    this._n = new THREE.Vector3();
  }
  // ---- 登錄 ----
  addBox({ cx, cy, cz, hx, hy, hz, yaw = 0, owner = null, solid = true, kind = 'box' }) {
    const c = { id: this.nextId++, type: 'box', cx, cy, cz, hx, hy, hz, yaw, cos: Math.cos(yaw), sin: Math.sin(yaw), owner, solid, kind, stamp: 0 };
    return this._insert(c);
  }
  addRamp({ cx, cz, y0, size, rise, dir, thickness = 0.25, owner = null }) {
    const c = { id: this.nextId++, type: 'ramp', cx, cz, y0, size, rise, dir, thickness, owner, solid: true, kind: 'ramp', stamp: 0 };
    c.ux = DIRS[dir][0]; c.uz = DIRS[dir][1];
    return this._insert(c);
  }
  _insert(c) {
    this._bounds(c);
    this.cols.set(c.id, c);
    this._hashAdd(c);
    return c.id;
  }
  _bounds(c) {
    if (c.type === 'box') {
      const ex = Math.abs(c.cos) * c.hx + Math.abs(c.sin) * c.hz, ez = Math.abs(c.sin) * c.hx + Math.abs(c.cos) * c.hz;
      c.x0 = c.cx - ex; c.x1 = c.cx + ex; c.z0 = c.cz - ez; c.z1 = c.cz + ez; c.ymin = c.cy - c.hy; c.ymax = c.cy + c.hy;
    } else {
      const h = c.size / 2;
      c.x0 = c.cx - h; c.x1 = c.cx + h; c.z0 = c.cz - h; c.z1 = c.cz + h; c.ymin = c.y0 - c.thickness; c.ymax = c.y0 + c.rise;
      // 射線用 OBB：中心、三軸、半長
      const len = Math.hypot(c.size, c.rise), th = Math.atan2(c.rise, c.size), ct = Math.cos(th), st = Math.sin(th);
      const ux = c.ux, uz = c.uz, sx = -uz, sz = ux; // 側向
      const ay = [-st * ux, ct, -st * uz], hp = c.thickness * ct / 2;
      c.ob = { cx: c.cx - ay[0] * hp, cy: c.y0 + c.rise / 2 - ay[1] * hp, cz: c.cz - ay[2] * hp, ax: [sx, 0, sz], ay, az: [ct * ux, st, ct * uz], h: [c.size / 2, hp, len / 2] };
    }
  }
  _hashKeys(c, fn) {
    const i0 = Math.floor(c.x0 / CELL), i1 = Math.floor(c.x1 / CELL), k0 = Math.floor(c.z0 / CELL), k1 = Math.floor(c.z1 / CELL);
    for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) fn(i * 100003 + k);
  }
  _hashAdd(c) { this._hashKeys(c, (key) => { let a = this.hash.get(key); if (!a) this.hash.set(key, (a = [])); a.push(c); }); }
  _hashDel(c) { this._hashKeys(c, (key) => { const a = this.hash.get(key); if (a) { const i = a.indexOf(c); if (i >= 0) a.splice(i, 1); } }); }
  remove(id) { const c = this.cols.get(id); if (!c) return; this._hashDel(c); this.cols.delete(id); }
  update(id, p) {
    const c = this.cols.get(id); if (!c) return;
    this._hashDel(c); Object.assign(c, p);
    if (c.type === 'box') { c.cos = Math.cos(c.yaw); c.sin = Math.sin(c.yaw); }
    this._bounds(c); this._hashAdd(c);
  }
  // 收集 [x0,x1]×[z0,z1] 附近的碰撞體（去重）
  _collect(x0, x1, z0, z1, out) {
    out.length = 0; const st = ++this.stamp;
    const i0 = Math.floor(x0 / CELL), i1 = Math.floor(x1 / CELL), k0 = Math.floor(z0 / CELL), k1 = Math.floor(z1 / CELL);
    for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) {
      const a = this.hash.get(i * 100003 + k); if (!a) continue;
      for (const c of a) if (c.stamp !== st) { c.stamp = st; out.push(c); }
    }
    return out;
  }
  queryBox(min, max) {
    const o = this._collect(min.x, max.x, min.z, max.z, []);
    return o.filter((c) => c.x1 >= min.x && c.x0 <= max.x && c.z1 >= min.z && c.z0 <= max.z && c.ymax >= min.y && c.ymin <= max.y).map((c) => c.id);
  }
  // ---- 表面 ----
  rampSurface(c, x, z) {
    const t = clamp(((x - c.cx) * c.ux + (z - c.cz) * c.uz + c.size / 2) / c.size, 0, 1);
    return c.y0 + c.rise * t;
  }
  // 圓（x,z,r）與碰撞體的水平最近點。回傳 [qx, qz, top, bottom]，無重疊回傳 null
  _contact(c, x, z, r, o) {
    if (c.type === 'box') {
      const dx = x - c.cx, dz = z - c.cz;
      const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
      const qx = clamp(lx, -c.hx, c.hx), qz = clamp(lz, -c.hz, c.hz);
      const ex = lx - qx, ez = lz - qz, d2 = ex * ex + ez * ez;
      if (d2 >= r * r) return false;
      o.top = o.hiTop = c.ymax; o.bottom = c.ymin;
      let nlx, nlz, push;
      if (d2 > 1e-10) { const d = Math.sqrt(d2); nlx = ex / d; nlz = ez / d; push = r - d; }
      else {
        const px = c.hx - Math.abs(lx), pz = c.hz - Math.abs(lz);
        if (px < pz) { nlx = lx >= 0 ? 1 : -1; nlz = 0; push = px + r; } else { nlx = 0; nlz = lz >= 0 ? 1 : -1; push = pz + r; }
      }
      o.nx = nlx * c.cos + nlz * c.sin; o.nz = -nlx * c.sin + nlz * c.cos; o.push = push;
      return true;
    }
    // 斜坡：換到斜坡局部座標 (u 沿上坡、v 側向)，分別取「最近點 / 最高點 / 最低點」的板面高度
    const hs = c.size / 2, dx = x - c.cx, dz = z - c.cz;
    const u = dx * c.ux + dz * c.uz, v = -dx * c.uz + dz * c.ux;
    const uq = clamp(u, -hs, hs), vq = clamp(v, -hs, hs);
    const eu = u - uq, ev = v - vq, d2 = eu * eu + ev * ev;
    if (d2 >= r * r) return false;
    const surf = (uu) => c.y0 + c.rise * ((uu + hs) / c.size);
    const w = Math.sqrt(Math.max(0, r * r - ev * ev));
    const uLow = Math.max(-hs, u - w), uHigh = Math.min(hs, u + w);
    o.top = surf(uq); o.hiTop = surf(Math.max(uHigh, uq)); o.bottom = surf(Math.min(uLow, uq)) - c.thickness;
    if (d2 > 1e-10) {
      const d = Math.sqrt(d2), lx = eu / d, lz = ev / d; // 局部單位法線 → 世界
      o.nx = lx * c.ux - lz * c.uz; o.nz = lx * c.uz + lz * c.ux; o.push = r - d;
    } else {
      // 圓心在斜板上方：淨空不足時沿上坡方向推到「頭剛好過得去」的位置（站在板上走路不會觸發）
      const need = o.feet + o.h + c.thickness;
      const ub = ((need - c.y0) / c.rise) * c.size - hs;
      o.nx = c.ux; o.nz = c.uz; o.push = Math.max(0, Math.min(c.size, ub + w - u));
    }
    return true;
  }
  groundHeight(x, z, feetY, radius = 0.38) {
    const g = this._g;
    let best = Math.max(this.ctx.terrain.heightAt(x, z), -1), id = null;
    const nrm = this._n.set(0, 1, 0);
    this.ctx.terrain.normalAt(x, z, nrm);
    const near = this._collect(x - radius, x + radius, z - radius, z + radius, this._near);
    const o = this._o || (this._o = {});
    for (const c of near) {
      if (!c.solid) continue;
      if (!this._contact(c, x, z, radius, o)) continue;
      if (o.top <= feetY + STEP && o.top > best - 1e-4 && (id === null || o.top > best)) {
        best = o.top; id = c.id;
        if (c.type === 'ramp') { const th = Math.atan2(c.rise, c.size); nrm.set(-Math.sin(th) * c.ux, Math.cos(th), -Math.sin(th) * c.uz); } else nrm.set(0, 1, 0);
      }
    }
    g.y = best; g.colliderId = id; g.normal.copy(nrm);
    return g;
  }
  // 移動膠囊：pos、vel 就地修改。vel.y 由呼叫端先加重力。wasGrounded 讓下坡貼地。
  // 高速（俯衝 70 m/s、衝刺撞牆）自動切成多個子步（每步水平 ≤ 0.24 m、垂直 ≤ 0.45 m），避免穿過薄牆／地板。
  moveCapsule(pos, vel, dt, radius, height, wasGrounded = false) {
    const hd = Math.hypot(vel.x, vel.z) * dt, vd = Math.abs(vel.y) * dt;
    const n = Math.min(14, Math.max(1, Math.ceil(Math.max(hd / 0.24, vd / 0.45))));
    if (n === 1) return this._moveStep(pos, vel, dt, radius, height, wasGrounded);
    const sub = dt / n; let hit = false, ceil = false, g = wasGrounded, R = null;
    for (let i = 0; i < n; i++) { R = this._moveStep(pos, vel, sub, radius, height, g); hit = hit || R.hitWall; ceil = ceil || R.ceiling; g = R.grounded; }
    R.hitWall = hit; R.ceiling = ceil;
    return R;
  }
  _moveStep(pos, vel, dt, radius, height, wasGrounded) {
    const R = this._r; R.pos = pos; R.vel = vel; R.hitWall = false; R.ceiling = false;
    const T = this.ctx.terrain;
    const ox = pos.x, oy = pos.y, oz = pos.z;
    let nx = ox + vel.x * dt, nz = oz + vel.z * dt;
    const o = this._o || (this._o = {});
    // 地形坡度限制（約 50°）
    const hd = Math.hypot(nx - ox, nz - oz);
    if (hd > 1e-6) {
      const lim = oy + STEP + hd * 1.2;
      if (T.heightAt(nx, nz) > lim) {
        if (T.heightAt(nx, oz) <= oy + STEP + Math.abs(nx - ox) * 1.2) { nz = oz; vel.z = 0; }
        else if (T.heightAt(ox, nz) <= oy + STEP + Math.abs(nz - oz) * 1.2) { nx = ox; vel.x = 0; }
        else { nx = ox; nz = oz; vel.x = vel.z = 0; }
        R.hitWall = true;
      }
    }
    // 水平：推出碰撞體
    const near = this._collect(nx - radius - 0.1, nx + radius + 0.1, nz - radius - 0.1, nz + radius + 0.1, this._near);
    for (let it = 0; it < 3; it++) {
      let moved = false;
      for (const c of near) {
        if (!c.solid) continue;
        o.feet = oy; o.h = height;
        if (!this._contact(c, nx, nz, radius, o)) continue;
        if (o.hiTop <= oy + STEP || o.bottom >= oy + height - 0.02 || o.push <= 0) continue;
        nx += o.nx * (o.push + 1e-4); nz += o.nz * (o.push + 1e-4);
        const vn = vel.x * o.nx + vel.z * o.nz;
        if (vn < 0) { vel.x -= vn * o.nx; vel.z -= vn * o.nz; }
        R.hitWall = true; moved = true;
      }
      if (!moved) break;
    }
    const b = WORLD.bound;
    nx = clamp(nx, -b, b); nz = clamp(nz, -b, b);
    // 垂直
    let vy = vel.y, ny = oy + vy * dt, grounded = false;
    const g = this.groundHeight(nx, nz, oy, radius);
    if (vy <= 0) {
      if (ny <= g.y + 1e-4 || (wasGrounded && ny - g.y <= SNAP)) { ny = g.y; vy = 0; grounded = true; }
    } else if (g.y > ny) { ny = g.y; }
    if (vy > 0) {
      let ceil = Infinity;
      for (const c of near) {
        if (!c.solid) continue;
        if (!this._contact(c, nx, nz, radius, o)) continue;
        if (o.bottom >= oy + height - 0.05 && o.bottom < ny + height && o.bottom < ceil) ceil = o.bottom;
      }
      if (ceil < Infinity) { ny = ceil - height; vy = 0; R.ceiling = true; }
    }
    pos.set(nx, ny, nz); vel.y = vy; R.grounded = grounded;
    return R;
  }
  // 新蓋的地板／斜坡蓋住角色時，把角色抬到板面（Fortnite 式）。成功回傳 true。
  liftOnto(colId, pos, r, h, vel) {
    const c = this.cols.get(colId); if (!c) return false;
    const o = this._o || (this._o = {}); o.feet = pos.y; o.h = h;
    if (!this._contact(c, pos.x, pos.z, r, o)) return false;
    if (o.top > pos.y + 0.02 && o.top <= pos.y + 3.8 && o.bottom < pos.y + h) { pos.y = o.top; if (vel && vel.y < 0) vel.y = 0; return true; }
    return false;
  }
  // 兩點之間視線是否暢通（地形、建材、房屋、樹石都會擋）。a、b 為 {x,y,z}。
  lineOfSight(a, b, opts = {}) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz);
    if (d < 0.05) return true;
    const dir = this._ld || (this._ld = new THREE.Vector3());
    dir.set(dx / d, dy / d, dz / d);
    return !this.raycast(a, dir, d - 0.08, opts);
  }
  overlapsCapsule(x, y, z, r, h) {
    const o = this._o || (this._o = {});
    for (const c of this._collect(x - r, x + r, z - r, z + r, [])) {
      if (!c.solid || !this._contact(c, x, z, r, o)) continue;
      if (o.top > y + 0.05 && o.bottom < y + h) return true;
    }
    return false;
  }
  // ---- 射線 ----
  raycast(origin, dir, maxDist, opts = {}) {
    const ox = origin.x, oy = origin.y, oz = origin.z, dx = dir.x, dy = dir.y, dz = dir.z;
    let best = null, bd = maxDist;
    // 格走訪（2D DDA）
    const st = ++this.stamp;
    let ci = Math.floor(ox / CELL), ck = Math.floor(oz / CELL);
    const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(CELL / dx) : Infinity, tdz = dz !== 0 ? Math.abs(CELL / dz) : Infinity;
    let tmx = dx !== 0 ? ((dx > 0 ? (ci + 1) * CELL - ox : ox - ci * CELL) / Math.abs(dx)) : Infinity;
    let tmz = dz !== 0 ? ((dz > 0 ? (ck + 1) * CELL - oz : oz - ck * CELL) / Math.abs(dz)) : Infinity;
    let t = 0, guard = 0;
    while (t < bd && guard++ < 200) {
      const a = this.hash.get(ci * 100003 + ck);
      if (a) for (const c of a) {
        if (c.stamp === st) continue; c.stamp = st;
        if (!c.solid && opts.solidOnly) continue;
        if (opts.ignoreOwner && c.owner === opts.ignoreOwner) continue;
        const h = c.type === 'box' ? this._rayBox(c, ox, oy, oz, dx, dy, dz, bd) : this._rayRamp(c, ox, oy, oz, dx, dy, dz, bd);
        if (h && h.dist < bd) { bd = h.dist; best = h; best.colliderId = c.id; best.owner = c.owner; best.kind = c.kind; }
      }
      if (tmx < tmz) { t = tmx; tmx += tdx; ci += sx; } else { t = tmz; tmz += tdz; ck += sz; }
    }
    if (!opts.skipTerrain) {
      const th = this._rayTerrain(ox, oy, oz, dx, dy, dz, bd);
      if (th && th.dist < bd) { best = th; }
    }
    return best;
  }
  _rayBox(c, ox, oy, oz, dx, dy, dz, maxD) {
    // 轉到盒的局部座標
    const rx = ox - c.cx, rz = oz - c.cz;
    const lox = rx * c.cos - rz * c.sin, loz = rx * c.sin + rz * c.cos, loy = oy - c.cy;
    const ldx = dx * c.cos - dz * c.sin, ldz = dx * c.sin + dz * c.cos;
    const r = slab(lox, loy, loz, ldx, dy, ldz, c.hx, c.hy, c.hz, maxD);
    if (!r) return null;
    const nl = r.n; // 局部法線 [x,y,z]
    const nx = nl[0] * c.cos + nl[2] * c.sin, nz = -nl[0] * c.sin + nl[2] * c.cos;
    return { point: new THREE.Vector3(ox + dx * r.t, oy + dy * r.t, oz + dz * r.t), normal: new THREE.Vector3(nx, nl[1], nz), dist: r.t };
  }
  _rayRamp(c, ox, oy, oz, dx, dy, dz, maxD) {
    const b = c.ob, rx = ox - b.cx, ry = oy - b.cy, rz = oz - b.cz;
    const dot = (a, x, y, z) => a[0] * x + a[1] * y + a[2] * z;
    const r = slab(dot(b.ax, rx, ry, rz), dot(b.ay, rx, ry, rz), dot(b.az, rx, ry, rz), dot(b.ax, dx, dy, dz), dot(b.ay, dx, dy, dz), dot(b.az, dx, dy, dz), b.h[0], b.h[1], b.h[2], maxD);
    if (!r) return null;
    const n = r.n, wx = b.ax[0] * n[0] + b.ay[0] * n[1] + b.az[0] * n[2], wy = b.ax[1] * n[0] + b.ay[1] * n[1] + b.az[1] * n[2], wz = b.ax[2] * n[0] + b.ay[2] * n[1] + b.az[2] * n[2];
    return { point: new THREE.Vector3(ox + dx * r.t, oy + dy * r.t, oz + dz * r.t), normal: new THREE.Vector3(wx, wy, wz), dist: r.t };
  }
  _rayTerrain(ox, oy, oz, dx, dy, dz, maxD) {
    const T = this.ctx.terrain;
    const H = (x, z) => Math.max(T.heightAt(x, z), 0);
    let t = 0, prevT = 0;
    let gap = oy - H(ox, oz);
    if (gap <= 0) return { point: new THREE.Vector3(ox, H(ox, oz), oz), normal: new THREE.Vector3(0, 1, 0), dist: 0, colliderId: null, owner: null, kind: 'terrain' };
    while (t < maxD) {
      prevT = t;
      t += clamp(gap * 0.6, 0.75, 6);
      if (t > maxD) t = maxD;
      const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
      gap = y - H(x, z);
      if (gap <= 0) {
        let a = prevT, b = t;
        for (let i = 0; i < 7; i++) { const m = (a + b) / 2; if (oy + dy * m - H(ox + dx * m, oz + dz * m) > 0) a = m; else b = m; }
        const px = ox + dx * b, pz = oz + dz * b;
        const n = new THREE.Vector3(); T.normalAt(px, pz, n);
        return { point: new THREE.Vector3(px, H(px, pz), pz), normal: n, dist: b, colliderId: null, owner: null, kind: 'terrain' };
      }
      if (t >= maxD) break;
      // 射線往上飛離島嶼高度上限 → 不可能再打到
      if (dy > 0 && y > 60) break;
    }
    return null;
  }
}

// 軸對齊盒的 slab 測試（局部座標），回傳 {t, n}
function slab(ox, oy, oz, dx, dy, dz, hx, hy, hz, maxD) {
  let tmin = 0, tmax = maxD;
  const o = [ox, oy, oz], d = [dx, dy, dz], h = [hx, hy, hz];
  let n = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) { if (Math.abs(o[i]) > h[i]) return null; continue; }
    let t1 = (-h[i] - o[i]) / d[i], t2 = (h[i] - o[i]) / d[i];
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
    if (t1 > tmin) { tmin = t1; n = [0, 0, 0]; n[i] = d[i] > 0 ? -1 : 1; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (tmin <= 0) { return null; } // 起點在盒內不算命中
  return { t: tmin, n };
}
