// 地圖資料的查詢：和 tools/check-layout.mjs 的解讀一致。
export const SLAB = 0.3;
export const COVER_DIMS = {
  crate1: { w: 1, d: 1, h: 1 }, crate125: { w: 1.25, d: 1.25, h: 1.25 }, crate2: { w: 1.4, d: 1.4, h: 1.4 },
  mil: { w: 1.8, d: 1, h: 1.1 }, barrel: { r: 0.32, h: 0.95 }, cart: { w: 2.6, d: 1.5, h: 1.3 },
  well: { r: 1, h: 1 }, stone: { w: 1.2, d: 1.2, h: 0.9 }, planter: { w: 1.6, d: 0.7, h: 0.8 },
  sandbag: { w: 1.8, d: 0.6, h: 0.75 }, sundial: { r: 3, h: 0.9 }, gnomon: { w: 0.6, d: 3.2, h: 4.4 },
};

export function rampHeight(r, x, z) {
  const xAxis = r.dir[1] === 'x';
  let t = ((xAxis ? x : z) - (xAxis ? r.x0 : r.z0)) / ((xAxis ? r.x1 : r.z1) - (xAxis ? r.x0 : r.z0));
  if (r.dir[0] === '-') t = 1 - t;
  t = Math.min(1, Math.max(0, t));
  return r.y0 + (r.y1 - r.y0) * t;
}

export function coverBase(L, c) {
  if (typeof c.y === 'number') return c.y;
  let y = -Infinity;
  for (const g of L.ground) if (c.x >= g.x0 && c.x <= g.x1 && c.z >= g.z0 && c.z <= g.z1 && g.y > y) y = g.y;
  for (const r of L.ramps) if (c.x >= r.x0 && c.x <= r.x1 && c.z >= r.z0 && c.z <= r.z1) y = Math.max(y, rampHeight(r, c.x, c.z));
  return y === -Infinity ? 0 : y;
}

/** 牆的實體片段：s 沿 a→b（兩端各延伸 t/2）。hole 的片段擋身體但看得穿。 */
export function wallPieces(w) {
  const len = Math.hypot(w.bx - w.ax, w.bz - w.az);
  const ops = [...(w.openings || [])].sort((p, q) => p.at - q.at);
  const out = [];
  let cur = -w.t / 2;
  for (const o of ops) {
    const a = o.at - o.w / 2, b = o.at + o.w / 2, sill = o.sill || 0;
    if (a > cur + 1e-3) out.push({ s0: cur, s1: a, y0: w.y0, y1: w.y1 });
    if (sill > 0) out.push({ s0: a, s1: b, y0: w.y0, y1: w.y0 + sill });
    if (w.y0 + sill + o.h < w.y1) out.push({ s0: a, s1: b, y0: w.y0 + sill + o.h, y1: w.y1, lintel: o });
    if (o.kind === 'window' || sill > 0) out.push({ s0: a, s1: b, y0: w.y0 + sill, y1: Math.min(w.y1, w.y0 + sill + o.h), hole: true });
    cur = b;
  }
  if (cur < len + w.t / 2 - 1e-3) out.push({ s0: cur, s1: len + w.t / 2, y0: w.y0, y1: w.y1 });
  return out;
}
