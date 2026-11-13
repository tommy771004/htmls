// 碰撞世界：AABB 格網、射線、圓形推擠、尋路格、A*、掩體候選點。純邏輯。
import { BOUNDS, H, TALL } from './map.js';

const CS = 1.0;      // 射線格網
const NS = 0.5;      // 尋路格
const NAV_R = 0.3;   // 尋路淨空半徑

export class World {
  constructor(map) {
    this.map = map;
    const B = map.boxes, n = B.length;
    this.n = n;
    this.b = new Float32Array(n * 6);
    this.noOcc = new Uint8Array(n);
    this.low = new Uint8Array(n);  // 會擋人走路
    this.dead = new Uint8Array(n); // 被打壞的家具：不再擋子彈、視線與走路
    for (let i = 0; i < n; i++) {
      const q = B[i]; this.b.set([q.x0, q.y0, q.z0, q.x1, q.y1, q.z1], i * 6);
      this.noOcc[i] = q.noOcc ? 1 : 0;
      this.low[i] = q.y0 < 1.3 && q.y1 > 0.3 ? 1 : 0;
    }
    this.gw = Math.ceil((BOUNDS.x1 - BOUNDS.x0) / CS); this.gh = Math.ceil((BOUNDS.z1 - BOUNDS.z0) / CS);
    this.cells = Array.from({ length: this.gw * this.gh }, () => []);
    for (let i = 0; i < n; i++) {
      const q = B[i];
      const cx0 = Math.max(0, Math.floor((q.x0 - BOUNDS.x0) / CS)), cx1 = Math.min(this.gw - 1, Math.floor((q.x1 - BOUNDS.x0) / CS));
      const cz0 = Math.max(0, Math.floor((q.z0 - BOUNDS.z0) / CS)), cz1 = Math.min(this.gh - 1, Math.floor((q.z1 - BOUNDS.z0) / CS));
      for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) this.cells[cz * this.gw + cx].push(i);
    }
    this.stamp = new Int32Array(n); this.stampId = 0;
    this.hit = { t: Infinity, box: -1, nx: 0, ny: 0, nz: 0 };
    this._buildNav();
    this._buildCover();
  }

  // 射線：回傳最近命中的 t（沒有則 Infinity），細節在 this.hit。light=true 時忽略玻璃（給光照烘焙用）。
  raycast(ox, oy, oz, dx, dy, dz, maxT, light) {
    const hit = this.hit; let best = maxT; hit.box = -1; hit.t = Infinity;
    // 地板
    if (dy < 0 && oy > 0) { const t = -oy / dy; if (t < best) { best = t; hit.box = -2; hit.nx = 0; hit.ny = 1; hit.nz = 0; } }
    // 天花板
    if (dy > 0) {
      let t = oy < H ? (H - oy) / dy : -1, done = false;
      if (t >= 0 && t < best) {
        const px = ox + dx * t, pz = oz + dz * t;
        const z = this.map.zoneAt(px, pz);
        if (z && z.h <= H) { best = t; hit.box = -3; hit.nx = 0; hit.ny = -1; hit.nz = 0; done = true; }
        else if (!z) done = true;
      }
      if (!done) {
        const hl = this.map.zones[0].h; t = (hl - oy) / dy;
        if (t >= 0 && t < best) {
          const px = ox + dx * t, pz = oz + dz * t;
          if (px > TALL.x0 && px < TALL.x1 && pz > TALL.z0 && pz < TALL.z1) { best = t; hit.box = -3; hit.nx = 0; hit.ny = -1; hit.nz = 0; }
        }
      }
    }
    const b = this.b, gw = this.gw, gh = this.gh, stamp = this.stamp, sid = ++this.stampId;
    let cx = Math.floor((ox - BOUNDS.x0) / CS), cz = Math.floor((oz - BOUNDS.z0) / CS);
    const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const idx = 1 / dx, idy = 1 / dy, idz = 1 / dz;
    let tMaxX = dx !== 0 ? ((BOUNDS.x0 + (cx + (dx > 0 ? 1 : 0)) * CS) - ox) * idx : Infinity;
    let tMaxZ = dz !== 0 ? ((BOUNDS.z0 + (cz + (dz > 0 ? 1 : 0)) * CS) - oz) * idz : Infinity;
    const tDX = dx !== 0 ? CS * Math.abs(idx) : Infinity, tDZ = dz !== 0 ? CS * Math.abs(idz) : Infinity;
    let tCell = 0;
    for (let guard = 0; guard < 200; guard++) {
      if (cx < 0 || cz < 0 || cx >= gw || cz >= gh) break;
      const list = this.cells[cz * gw + cx];
      for (let k = 0; k < list.length; k++) {
        const i = list[k]; if (stamp[i] === sid) continue; stamp[i] = sid;
        if (this.dead[i] || (light && this.noOcc[i])) continue;
        const o = i * 6;
        let t0 = 0, t1 = best, ax = -1, tt0, tt1;
        // x
        if (dx !== 0) { tt0 = (b[o] - ox) * idx; tt1 = (b[o + 3] - ox) * idx; if (tt0 > tt1) { const s = tt0; tt0 = tt1; tt1 = s; } if (tt0 > t0) { t0 = tt0; ax = 0; } if (tt1 < t1) t1 = tt1; if (t0 > t1) continue; }
        else if (ox < b[o] || ox > b[o + 3]) continue;
        if (dy !== 0) { tt0 = (b[o + 1] - oy) * idy; tt1 = (b[o + 4] - oy) * idy; if (tt0 > tt1) { const s = tt0; tt0 = tt1; tt1 = s; } if (tt0 > t0) { t0 = tt0; ax = 1; } if (tt1 < t1) t1 = tt1; if (t0 > t1) continue; }
        else if (oy < b[o + 1] || oy > b[o + 4]) continue;
        if (dz !== 0) { tt0 = (b[o + 2] - oz) * idz; tt1 = (b[o + 5] - oz) * idz; if (tt0 > tt1) { const s = tt0; tt0 = tt1; tt1 = s; } if (tt0 > t0) { t0 = tt0; ax = 2; } if (tt1 < t1) t1 = tt1; if (t0 > t1) continue; }
        else if (oz < b[o + 2] || oz > b[o + 5]) continue;
        if (t0 < best) {
          best = t0; hit.box = i;
          hit.nx = ax === 0 ? -sx : 0; hit.ny = ax === 1 ? (dy > 0 ? -1 : 1) : 0; hit.nz = ax === 2 ? -sz : 0;
          if (ax < 0) { hit.nx = -dx; hit.ny = -dy; hit.nz = -dz; } // 起點在盒內
        }
      }
      if (tMaxX < tMaxZ) { tCell = tMaxX; tMaxX += tDX; cx += sx; } else { tCell = tMaxZ; tMaxZ += tDZ; cz += sz; }
      if (tCell > best) break;
    }
    hit.t = best < maxT ? best : Infinity;
    return hit.t;
  }
  // 兩點之間是否被擋住
  blocked(ax, ay, az, bx, by, bz, light) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.hypot(dx, dy, dz);
    if (d < 1e-4) return false;
    return this.raycast(ax, ay, az, dx / d, dy / d, dz / d, d - 0.02, light) < Infinity;
  }

  // 球（半徑 r）對所有盒做 3D 推擠，直接改寫 p.x/y/z，回傳有沒有被推動。只給演出用（布娃娃），不影響模擬。
  push3(p, r) {
    const b = this.b, gw = this.gw; let hit = false;
    const cx0 = Math.max(0, Math.floor((p.x - r - BOUNDS.x0) / CS)), cx1 = Math.min(gw - 1, Math.floor((p.x + r - BOUNDS.x0) / CS));
    const cz0 = Math.max(0, Math.floor((p.z - r - BOUNDS.z0) / CS)), cz1 = Math.min(this.gh - 1, Math.floor((p.z + r - BOUNDS.z0) / CS));
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
      const list = this.cells[cz * gw + cx];
      for (let k = 0; k < list.length; k++) {
        const i = list[k]; if (this.dead[i]) continue; const o = i * 6;
        const qx = p.x < b[o] ? b[o] : p.x > b[o + 3] ? b[o + 3] : p.x, qy = p.y < b[o + 1] ? b[o + 1] : p.y > b[o + 4] ? b[o + 4] : p.y, qz = p.z < b[o + 2] ? b[o + 2] : p.z > b[o + 5] ? b[o + 5] : p.z;
        const ex = p.x - qx, ey = p.y - qy, ez = p.z - qz, d2 = ex * ex + ey * ey + ez * ez;
        if (d2 >= r * r) continue;
        if (d2 > 1e-10) { const d = Math.sqrt(d2), f = (r - d) / d; p.x += ex * f; p.y += ey * f; p.z += ez * f; }
        else { // 球心在盒內：往最近的面推出去（不往下推）
          const l = p.x - b[o], rr = b[o + 3] - p.x, t = p.z - b[o + 2], bb = b[o + 5] - p.z, u = b[o + 4] - p.y, m = Math.min(l, rr, t, bb, u);
          if (m === u) p.y = b[o + 4] + r; else if (m === l) p.x = b[o] - r; else if (m === rr) p.x = b[o + 3] + r; else if (m === t) p.z = b[o + 2] - r; else p.z = b[o + 5] + r;
        }
        hit = true;
      }
    }
    return hit;
  }

  // 圓（半徑 r）對矮於 1.3 m 的盒做推擠，回寫 out.x / out.z
  resolve(x, z, r, out) {
    const b = this.b, gw = this.gw;
    for (let it = 0; it < 3; it++) {
      const cx0 = Math.max(0, Math.floor((x - r - BOUNDS.x0) / CS)), cx1 = Math.min(gw - 1, Math.floor((x + r - BOUNDS.x0) / CS));
      const cz0 = Math.max(0, Math.floor((z - r - BOUNDS.z0) / CS)), cz1 = Math.min(this.gh - 1, Math.floor((z + r - BOUNDS.z0) / CS));
      let moved = false;
      for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
        const list = this.cells[cz * gw + cx];
        for (let k = 0; k < list.length; k++) {
          const i = list[k]; if (!this.low[i] || this.dead[i]) continue; const o = i * 6;
          const px = x < b[o] ? b[o] : x > b[o + 3] ? b[o + 3] : x, pz = z < b[o + 2] ? b[o + 2] : z > b[o + 5] ? b[o + 5] : z;
          let ex = x - px, ez = z - pz; const d2 = ex * ex + ez * ez;
          if (d2 >= r * r) continue;
          if (d2 > 1e-10) { const d = Math.sqrt(d2), p = (r - d) / d; x += ex * p; z += ez * p; }
          else { // 圓心在盒內：往最近的面推出去
            const l = x - b[o], rr = b[o + 3] - x, t = z - b[o + 2], bb = b[o + 5] - z, m = Math.min(l, rr, t, bb);
            if (m === l) x = b[o] - r; else if (m === rr) x = b[o + 3] + r; else if (m === t) z = b[o + 2] - r; else z = b[o + 5] + r;
          }
          moved = true;
        }
      }
      if (!moved) break;
    }
    out.x = x; out.z = z;
  }

  // ---------- 尋路 ----------
  _buildNav() {
    const nw = this.nw = Math.round((BOUNDS.x1 - BOUNDS.x0) / NS), nh = this.nh = Math.round((BOUNDS.z1 - BOUNDS.z0) / NS);
    this.walk = new Uint8Array(nw * nh); this.zoneOf = new Int8Array(nw * nh).fill(-1);
    for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) {
      const q = this.map.zoneAt(BOUNDS.x0 + (i + 0.5) * NS, BOUNDS.z0 + (j + 0.5) * NS); if (!q) continue;
      this.zoneOf[j * nw + i] = q.idx; this._walkCell(i, j);
    }
    const N = nw * nh;
    this.g = new Float32Array(N); this.f = new Float32Array(N); this.from = new Int32Array(N); this.state = new Int32Array(N); this.runId = 0;
    this.heap = new Int32Array(N * 4);
  }
  _walkCell(i, j) {
    const c = j * this.nw + i; if (this.zoneOf[c] < 0) return;
    const x = BOUNDS.x0 + (i + 0.5) * NS, z = BOUNDS.z0 + (j + 0.5) * NS, o = this._wo || (this._wo = { x: 0, z: 0 });
    this.resolve(x, z, NAV_R, o);
    this.walk[c] = Math.abs(o.x - x) < 1e-6 && Math.abs(o.z - z) < 1e-6 ? 1 : 0;
  }
  // 家具被打壞（或回合開始復原）：開關碰撞，並重算它腳下那一圈尋路格
  setDead(i, dead) {
    if (this.dead[i] === (dead ? 1 : 0)) return; this.dead[i] = dead ? 1 : 0;
    const o = i * 6, b = this.b, m = NAV_R + NS;
    const i0 = Math.max(0, Math.floor((b[o] - m - BOUNDS.x0) / NS)), i1 = Math.min(this.nw - 1, Math.floor((b[o + 3] + m - BOUNDS.x0) / NS));
    const j0 = Math.max(0, Math.floor((b[o + 2] - m - BOUNDS.z0) / NS)), j1 = Math.min(this.nh - 1, Math.floor((b[o + 5] + m - BOUNDS.z0) / NS));
    for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) this._walkCell(k, j);
  }
  reviveAll() { for (let i = 0; i < this.n; i++) if (this.dead[i]) this.setDead(i, false); }
  cellOf(x, z) { const i = Math.floor((x - BOUNDS.x0) / NS), j = Math.floor((z - BOUNDS.z0) / NS); return (i < 0 || j < 0 || i >= this.nw || j >= this.nh) ? -1 : j * this.nw + i; }
  cellX(c) { return BOUNDS.x0 + ((c % this.nw) + 0.5) * NS; }
  cellZ(c) { return BOUNDS.z0 + (Math.floor(c / this.nw) + 0.5) * NS; }
  walkable(x, z) { const c = this.cellOf(x, z); return c >= 0 && this.walk[c] === 1; }
  // 最近的可走格
  nearest(x, z) {
    const c0 = this.cellOf(x, z); if (c0 >= 0 && this.walk[c0]) return c0;
    const i0 = Math.floor((x - BOUNDS.x0) / NS), j0 = Math.floor((z - BOUNDS.z0) / NS);
    let best = -1, bd = 1e9;
    for (let r = 1; r < 8 && best < 0; r++) for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) {
      if (i < 0 || j < 0 || i >= this.nw || j >= this.nh) continue; const c = j * this.nw + i; if (!this.walk[c]) continue;
      const d = (this.cellX(c) - x) ** 2 + (this.cellZ(c) - z) ** 2; if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  // 直線可走（沿線取樣）
  walkLine(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.2);
    for (let i = 1; i <= n; i++) { const t = i / n; if (!this.walkable(ax + (bx - ax) * t, az + (bz - az) * t)) return false; }
    return true;
  }
  // A*：zoneCost（Float32Array，依區域加權）可省略。回傳 [[x,z],...]（已拉直）或 null
  path(ax, az, bx, bz, zoneCost) {
    const s = this.nearest(ax, az), e = this.nearest(bx, bz); if (s < 0 || e < 0) return null;
    const nw = this.nw, nh = this.nh, walk = this.walk, g = this.g, f = this.f, from = this.from, st = this.state, heap = this.heap;
    const run = (this.runId += 2); // st==run：open；st==run+1：closed
    const ex = e % nw, ez = (e / nw) | 0;
    let hn = 0;
    const push = c => { let i = hn++; heap[i] = c; while (i > 0) { const p = (i - 1) >> 1; if (f[heap[p]] <= f[heap[i]]) break; const t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p; } };
    const pop = () => { const top = heap[0]; const last = heap[--hn]; if (hn > 0) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < hn && f[heap[l]] < f[heap[m]]) m = l; if (r < hn && f[heap[r]] < f[heap[m]]) m = r; if (m === i) break; const t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m; } } return top; };
    g[s] = 0; f[s] = 0; from[s] = -1; st[s] = run; push(s);
    let found = false;
    while (hn > 0) {
      const c = pop(); if (st[c] === run + 1) continue; st[c] = run + 1;
      if (c === e) { found = true; break; }
      const ci = c % nw, cj = (c / nw) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= nw || nj >= nh) continue;
        const nc = nj * nw + ni; if (!walk[nc] || st[nc] === run + 1) continue;
        if (di && dj && (!walk[cj * nw + ni] || !walk[nj * nw + ci])) continue;
        let step = (di && dj) ? 0.7071 : 0.5; if (zoneCost) step *= zoneCost[this.zoneOf[nc]] || 1;
        const ng = g[c] + step;
        if (st[nc] !== run || ng < g[nc]) {
          g[nc] = ng; from[nc] = c; st[nc] = run;
          const hx = Math.abs(ni - ex), hz = Math.abs(nj - ez);
          f[nc] = ng + 0.5 * (Math.max(hx, hz) + 0.4142 * Math.min(hx, hz)); push(nc);
        }
      }
      if (hn > heap.length - 16) break;
    }
    if (!found) return null;
    const raw = []; for (let c = e; c >= 0; c = from[c]) raw.push(c); raw.reverse();
    // 拉直
    const out = []; let i = 0; let px = this.cellX(raw[0]), pz = this.cellZ(raw[0]);
    while (i < raw.length - 1) {
      let j = Math.min(raw.length - 1, i + 24);
      for (; j > i + 1; j--) if (this.walkLine(px, pz, this.cellX(raw[j]), this.cellZ(raw[j]))) break;
      px = this.cellX(raw[j]); pz = this.cellZ(raw[j]); out.push([px, pz]); i = j;
    }
    out.len = g[e];
    return out;
  }

  // ---------- 掩體候選 ----------
  _buildCover() {
    const pts = []; const map = this.map;
    const add = (x, z, low) => { if (this.walkable(x, z) && !pts.some(p => Math.abs(p.x - x) < 0.45 && Math.abs(p.z - z) < 0.45)) pts.push({ x, z, low }); };
    for (const q of map.boxes) {
      if (!q.cover) continue; const low = q.y1 < 1.35, m = 0.5;
      const cx = (q.x0 + q.x1) / 2, cz = (q.z0 + q.z1) / 2;
      const nx = Math.max(1, Math.round((q.x1 - q.x0) / 1.4)), nz = Math.max(1, Math.round((q.z1 - q.z0) / 1.4));
      for (let i = 0; i < nx; i++) { const x = q.x0 + (i + 0.5) * (q.x1 - q.x0) / nx; add(x, q.z0 - m, low); add(x, q.z1 + m, low); }
      for (let i = 0; i < nz; i++) { const z = q.z0 + (i + 0.5) * (q.z1 - q.z0) / nz; add(q.x0 - m, z, low); add(q.x1 + m, z, low); }
      void cx; void cz;
    }
    for (const o of map.openings) { // 門邊
      if (o.k === 'window') continue;
      for (const side of [-1, 1]) for (const e of [-1, 1]) {
        const along = o.at + e * (o.w / 2 + 0.55), off = side * 0.62;
        if (o.axis === 'x') add(along, o.c + off, 0); else add(o.c + off, along, 0);
      }
    }
    this.cover = pts;
  }
}
