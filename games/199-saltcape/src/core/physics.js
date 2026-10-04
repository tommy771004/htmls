// 碰撞查詢與射線：軸對齊方塊、直立圓柱與地形。伺服器裁定與前端預測共用。
import { heightAt, EXT, GRID } from './map.js';

export const PR = 0.34;        // 玩家半徑
export const STEP = 0.55;      // 可直接跨上的高度
export const WATER_FLOOR = -1.25;

function cellIndex(W, x) { const i = Math.floor((x + EXT) / GRID); return i < 0 ? 0 : i >= W.GN ? W.GN - 1 : i; }

// 列出與矩形範圍重疊格子內的碰撞體（每個只回報一次）
export function near(W, x0, z0, x1, z1, fn) {
  const s = ++W.stampN === 0xffffffff ? (W.stamp.fill(0), (W.stampN = 1)) : W.stampN;
  const nb = W.BM.length;
  for (let gz = cellIndex(W, z0); gz <= cellIndex(W, z1); gz++) for (let gx = cellIndex(W, x0); gx <= cellIndex(W, x1); gx++) {
    const list = W.cells.get(gz * W.GN + gx);
    if (!list) continue;
    for (const v of list) {
      const key = v >= 0 ? v : nb - 1 - v;
      if (W.stamp[key] === s) continue;
      W.stamp[key] = s;
      fn(v);
    }
  }
}

export function terrainAt(W, x, z) {
  const h = heightAt(W.H, x, z);
  return h < WATER_FLOOR ? WATER_FLOOR : h;
}

// 腳下最高的可站表面（只考慮不高於 yFeet + up 的頂面）
export function groundAt(W, x, z, yFeet, r = PR, up = STEP) {
  let g = terrainAt(W, x, z);
  const lim = yFeet + up, rr = r * 0.75;
  const B = W.B, C = W.C;
  near(W, x - r, z - r, x + r, z + r, (v) => {
    if (v >= 0) {
      const o = v * 6, top = B[o + 4];
      if (top > lim || top <= g) return;
      const cx = x < B[o] ? B[o] : x > B[o + 3] ? B[o + 3] : x;
      const cz = z < B[o + 2] ? B[o + 2] : z > B[o + 5] ? B[o + 5] : z;
      if ((x - cx) ** 2 + (z - cz) ** 2 < rr * rr) g = top;
    } else {
      const o = (-1 - v) * 5, top = C[o + 4];
      if (top > lim || top <= g) return;
      const R = C[o + 2] + rr;
      if ((x - C[o]) ** 2 + (z - C[o + 1]) ** 2 < R * R) g = top;
    }
  });
  return g;
}

// 把圓柱體玩家推出牆外；回傳是否碰撞
export function resolveXZ(p, W, height, stepOk) {
  const B = W.B, C = W.C;
  let hit = false;
  for (let it = 0; it < 3; it++) {
    let moved = false;
    const y0 = p.y + (stepOk ? STEP : 0.05), y1 = p.y + height;
    near(W, p.x - PR - 0.1, p.z - PR - 0.1, p.x + PR + 0.1, p.z + PR + 0.1, (v) => {
      if (v >= 0) {
        const o = v * 6;
        if (B[o + 4] <= y0 || B[o + 1] >= y1) return;
        const cx = p.x < B[o] ? B[o] : p.x > B[o + 3] ? B[o + 3] : p.x;
        const cz = p.z < B[o + 2] ? B[o + 2] : p.z > B[o + 5] ? B[o + 5] : p.z;
        let dx = p.x - cx, dz = p.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= PR * PR) return;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2), push = PR - d;
          p.x += (dx / d) * push; p.z += (dz / d) * push;
        } else {
          // 圓心已在方塊內：沿最淺的軸推出
          const pl = p.x - B[o], pr = B[o + 3] - p.x, pb = p.z - B[o + 2], pf = B[o + 5] - p.z;
          const m = Math.min(pl, pr, pb, pf);
          if (m === pl) p.x = B[o] - PR; else if (m === pr) p.x = B[o + 3] + PR; else if (m === pb) p.z = B[o + 2] - PR; else p.z = B[o + 5] + PR;
        }
        moved = hit = true;
      } else {
        const o = (-1 - v) * 5;
        if (C[o + 4] <= y0 || C[o + 3] >= y1) return;
        const dx = p.x - C[o], dz = p.z - C[o + 1], R = C[o + 2] + PR;
        const d2 = dx * dx + dz * dz;
        if (d2 >= R * R) return;
        const d = Math.sqrt(d2) || 1e-6;
        p.x = C[o] + (dx / d) * R; p.z = C[o + 1] + (dz / d) * R;
        moved = hit = true;
      }
    });
    if (!moved) break;
  }
  return hit;
}

// 頭頂的天花板高度（超過 maxUp 視為無）
export function ceilingAt(W, x, z, yFeet, height) {
  let c = Infinity;
  const B = W.B, rr = PR * 0.9;
  near(W, x - PR, z - PR, x + PR, z + PR, (v) => {
    if (v < 0) return;
    const o = v * 6, bot = B[o + 1];
    if (bot < yFeet + height - 0.6 || bot >= c) return;
    const cx = x < B[o] ? B[o] : x > B[o + 3] ? B[o + 3] : x;
    const cz = z < B[o + 2] ? B[o + 2] : z > B[o + 5] ? B[o + 5] : z;
    if ((x - cx) ** 2 + (z - cz) ** 2 < rr * rr) c = bot;
  });
  return c;
}

// 射線打世界：回傳命中距離（無則 maxT）。以 2D DDA 走碰撞格。
export function raycastWorld(W, ox, oy, oz, dx, dy, dz, maxT, out) {
  let best = maxT, kind = 0;
  const B = W.B, C = W.C;
  const s = ++W.stampN === 0xffffffff ? (W.stamp.fill(0), (W.stampN = 1)) : W.stampN;
  const nb = W.BM.length;
  const test = (v) => {
    const key = v >= 0 ? v : nb - 1 - v;
    if (W.stamp[key] === s) return;
    W.stamp[key] = s;
    if (v >= 0) {
      const o = v * 6;
      let t0 = 0, t1 = best;
      for (let a = 0; a < 3; a++) {
        const oa = a === 0 ? ox : a === 1 ? oy : oz, da = a === 0 ? dx : a === 1 ? dy : dz;
        const lo = B[o + a], hi = B[o + 3 + a];
        if (Math.abs(da) < 1e-9) { if (oa < lo || oa > hi) return; continue; }
        let ta = (lo - oa) / da, tb = (hi - oa) / da;
        if (ta > tb) { const tt = ta; ta = tb; tb = tt; }
        if (ta > t0) t0 = ta; if (tb < t1) t1 = tb;
        if (t0 > t1) return;
      }
      if (t0 < best) { best = t0; kind = 1; }
    } else {
      const o = (-1 - v) * 5;
      const px = ox - C[o], pz = oz - C[o + 1], r = C[o + 2];
      const a = dx * dx + dz * dz;
      if (a < 1e-12) return;
      const b = px * dx + pz * dz, c = px * px + pz * pz - r * r;
      const disc = b * b - a * c;
      if (disc < 0) return;
      let t = (-b - Math.sqrt(disc)) / a;
      if (t < 0) t = c < 0 ? 0 : (-b + Math.sqrt(disc)) / a;
      if (t < 0 || t >= best) return;
      const y = oy + dy * t;
      if (y < C[o + 3] || y > C[o + 4]) return;
      best = t; kind = 2;
    }
  };
  // DDA
  let x = ox, z = oz;
  let gx = Math.floor((x + EXT) / GRID), gz = Math.floor((z + EXT) / GRID);
  const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
  const hl = Math.sqrt(dx * dx + dz * dz) || 1e-9;
  const tdx = Math.abs(dx) > 1e-9 ? GRID / Math.abs(dx) : Infinity, tdz = Math.abs(dz) > 1e-9 ? GRID / Math.abs(dz) : Infinity;
  let tmx = Math.abs(dx) > 1e-9 ? ((dx > 0 ? (gx + 1) * GRID - EXT - x : x - (gx * GRID - EXT)) / Math.abs(dx)) : Infinity;
  let tmz = Math.abs(dz) > 1e-9 ? ((dz > 0 ? (gz + 1) * GRID - EXT - z : z - (gz * GRID - EXT)) / Math.abs(dz)) : Infinity;
  let t = 0;
  void hl;
  for (let guard = 0; guard < 600; guard++) {
    if (gx >= 0 && gz >= 0 && gx < W.GN && gz < W.GN) {
      const list = W.cells.get(gz * W.GN + gx);
      if (list) for (const v of list) test(v);
    }
    if (best <= t) break;
    if (tmx < tmz) { t = tmx; tmx += tdx; gx += stepX; } else { t = tmz; tmz += tdz; gz += stepZ; }
    if (t > best) break;
  }
  // 地形：沿射線步進再二分
  const tt = raycastTerrain(W, ox, oy, oz, dx, dy, dz, best);
  if (tt < best) { best = tt; kind = 3; }
  if (out) out.kind = kind;
  return best;
}

export function raycastTerrain(W, ox, oy, oz, dx, dy, dz, maxT) {
  const stepL = 2.5;
  let prevT = 0, prevD = oy - heightAt(W.H, ox, oz);
  if (prevD < 0) return 0;
  for (let t = stepL; t < maxT + stepL; t += stepL) {
    const tc = Math.min(t, maxT);
    const y = oy + dy * tc, d = y - heightAt(W.H, ox + dx * tc, oz + dz * tc);
    if (d < 0) {
      let a = prevT, b = tc;
      for (let k = 0; k < 8; k++) { const m = (a + b) / 2; if (oy + dy * m - heightAt(W.H, ox + dx * m, oz + dz * m) < 0) b = m; else a = m; }
      return a;
    }
    prevT = tc; prevD = d;
    if (tc >= maxT) break;
  }
  void prevD;
  return Infinity;
}

// 兩點間視線是否暢通
export function lineClear(W, ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (L < 1e-6) return true;
  return raycastWorld(W, ax, ay, az, dx / L, dy / L, dz / L, L) >= L - 0.05;
}
