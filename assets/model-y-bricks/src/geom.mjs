// 世界座標下的零件幾何、接點配對、碰撞與組裝路徑檢查。設計程式（排組裝順序）與驗證程式共用。
import { partGeom } from './parts.mjs';
import { det3 } from './ldraw.mjs';

export const EPS = 0.4;          // 接觸容差（LDU）：重疊深度不超過此值視為貼合
export const STUD_H = 4, STUD_R = 6;
export const SWEEP_STEP = 2;     // 組裝路徑取樣間距（LDU），小於任何零件或凸點厚度

export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => { const l = len(a); return l ? scale(a, 1 / l) : a; };
export const r3 = (v) => v.map((x) => Math.round(x * 100) / 100);
const xf = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3], m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7], m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11]];
const xd = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2], m[4] * p[0] + m[5] * p[1] + m[6] * p[2], m[8] * p[0] + m[9] * p[1] + m[10] * p[2]];

export function makePiece(verts, normals, edges) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const v of verts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); }
  return { verts, normals, edges, lo, hi };
}
export const movePiece = (pc, d) => makePiece(pc.verts.map((v) => add(v, d)), pc.normals, pc.edges);
function projRange(verts, n) { let mn = Infinity, mx = -Infinity; for (const v of verts) { const e = dot(v, n); if (e < mn) mn = e; if (e > mx) mx = e; } return [mn, mx]; }

// 分離軸定理：回傳兩個凸體的重疊深度，≤ EPS 回傳 0
export function overlapDepth(A, B) {
  for (let k = 0; k < 3; k++) if (A.lo[k] > B.hi[k] - EPS || B.lo[k] > A.hi[k] - EPS) return 0;
  let depth = Infinity;
  const test = (n) => {
    const l = len(n); if (l < 1e-9) return true;
    const u = scale(n, 1 / l);
    const [a0, a1] = projRange(A.verts, u), [b0, b1] = projRange(B.verts, u);
    const o = Math.min(a1, b1) - Math.max(a0, b0);
    if (o <= EPS) return false;
    depth = Math.min(depth, o); return true;
  };
  for (const n of A.normals) if (!test(n)) return 0;
  for (const n of B.normals) if (!test(n)) return 0;
  for (const e of A.edges) for (const f of B.edges) if (!test(cross(e, f))) return 0;
  return depth;
}
export function studBox(p, up) {
  const a = Math.abs(up[0]) > 0.9 ? [0, 1, 0] : [1, 0, 0];
  const s1 = norm(cross(up, a)), s2 = norm(cross(up, s1));
  const verts = [];
  for (const h of [0, STUD_H]) for (const i of [-1, 1]) for (const j of [-1, 1]) verts.push(add(add(p, scale(up, h)), add(scale(s1, i * STUD_R), scale(s2, j * STUD_R))));
  return makePiece(verts, [up, s1, s2], [up, s1, s2]);
}
export const aabbHit = (a, b, pad = 0) => a.lo.every((v, k) => v < b.hi[k] + pad) && b.lo.every((v, k) => v < a.hi[k] + pad);

// 一個放好的零件：{ file, color, m(3×4) } → 世界座標幾何
export function worldPart(p, idx) {
  const g = partGeom(p.file);
  const m = p.m;
  const cols = [[m[0], m[4], m[8]], [m[1], m[5], m[9]], [m[2], m[6], m[10]]];
  const pure = cols.every((c, i) => Math.abs(len(c) - 1) < 1e-6 && cols.every((d, j) => i === j || Math.abs(dot(c, d)) < 1e-6)) && Math.abs(det3(m) - 1) < 1e-6;
  const pieces = g.pieces.map((pc) => makePiece(pc.verts.map((v) => xf(m, v)), pc.normals.map((n) => xd(m, n)), pc.edges.map((e) => xd(m, e))));
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const pc of pieces) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], pc.lo[k]); hi[k] = Math.max(hi[k], pc.hi[k]); }
  return {
    idx, id: g.id, color: p.color, step: p.step, g, pieces, lo, hi, pure,
    studs: g.studs.map((s) => ({ p: xf(m, s.p), up: norm(xd(m, s.up)) })),
    anti: g.antistuds.map((a) => ({ p: xf(m, a.p), dir: norm(xd(m, a.dir)) })),
    tech: g.technic.map((t) => ({ kind: t.kind, p: xf(m, t.p), axis: norm(xd(m, t.axis)), half: t.half, open: t.open ? norm(xd(m, t.open)) : null })),
  };
}

// 接點配對
const keyOf = (p) => r3(p).join(',');
const TECH_PAIRS = { axle: 'axlehole', pin: 'pinhole' };
export function findConnections(W) {
  const problems = [];
  const antiIndex = new Map();
  W.forEach((w) => w.anti.forEach((a, k) => { const key = keyOf(a.p); if (!antiIndex.has(key)) antiIndex.set(key, []); antiIndex.get(key).push({ w: w.idx, k }); }));
  const studConns = [];
  const studMate = W.map((w) => w.studs.map(() => null));
  const antiMate = W.map((w) => w.anti.map(() => null));
  W.forEach((w) => w.studs.forEach((s, k) => {
    for (const c of antiIndex.get(keyOf(s.p)) || []) {
      if (c.w === w.idx) continue;
      const a = W[c.w].anti[c.k];
      if (dot(a.dir, s.up) > -0.999) continue;
      if (antiMate[c.w][c.k] !== null) { problems.push({ kind: 'connection', msg: `凸點孔被兩個凸點同時佔用（零件 ${c.w}）` }); continue; }
      studMate[w.idx][k] = { w: c.w, k: c.k }; antiMate[c.w][c.k] = { w: w.idx, k };
      studConns.push({ a: w.idx, b: c.w, p: r3(s.p) });
      break;
    }
  }));
  const techConns = [];
  W.forEach((w) => w.tech.forEach((t) => {
    const want = TECH_PAIRS[t.kind]; if (!want) return;
    for (const v of W) {
      if (v.idx === w.idx) continue;
      for (const h of v.tech) {
        if (h.kind !== want || Math.abs(Math.abs(dot(t.axis, h.axis)) - 1) > 1e-6) continue;
        const d = sub(t.p, h.p); const along = dot(d, h.axis); const perp = len(sub(d, scale(h.axis, along)));
        if (perp > 0.1) continue;
        const overlap = Math.min(along + t.half, h.half) - Math.max(along - t.half, -h.half);
        if (overlap <= 0) continue;
        const need = 0.8 * Math.min(2 * t.half, 2 * h.half);
        const conn = { a: w.idx, b: v.idx, kind: t.kind + '→' + h.kind, overlap: +overlap.toFixed(2), need: +need.toFixed(2), open: h.open, ok: overlap >= need };
        techConns.push(conn);
        if (!conn.ok) problems.push({ kind: 'connection', msg: `科技接點插入深度不足：零件 ${w.idx} 插入零件 ${v.idx} 只有 ${conn.overlap} LDU（需 ${conn.need}）` });
      }
    }
  }));
  const techPair = new Set(techConns.filter((c) => c.ok).map((c) => Math.min(c.a, c.b) + '-' + Math.max(c.a, c.b)));
  const exempt = (i, j) => techPair.has(Math.min(i, j) + '-' + Math.max(i, j));
  return { studConns, studMate, antiMate, techConns, exempt, problems };
}

// 靜態碰撞：本體兩兩重疊，及沒插進凸點孔的凸點埋進別的零件
export function findCollisions(W, C) {
  const out = [];
  for (let i = 0; i < W.length; i++) for (let j = i + 1; j < W.length; j++) {
    if (!aabbHit(W[i], W[j]) || C.exempt(i, j)) continue;
    let d = 0;
    for (const pa of W[i].pieces) for (const pb of W[j].pieces) d = Math.max(d, overlapDepth(pa, pb));
    if (d > 0) out.push({ a: i, b: j, what: '本體', depth: +d.toFixed(2) });
  }
  W.forEach((w) => w.studs.forEach((s, k) => {
    if (C.studMate[w.idx][k]) return;
    const box = studBox(s.p, s.up);
    for (const v of W) {
      if (v.idx === w.idx || C.exempt(v.idx, w.idx) || !aabbHit(box, v)) continue;
      let d = 0; for (const pc of v.pieces) d = Math.max(d, overlapDepth(box, pc));
      if (d > 0) out.push({ a: w.idx, b: v.idx, what: '凸點埋入', depth: +d.toFixed(2) });
    }
  }));
  return out;
}

// 零件 w 在 placed（Set）已放好的情況下能不能裝上：回傳 { ok, dir, reason }
export function insertion(W, C, w, placed) {
  const dirs = [];
  w.anti.forEach((a, k) => { const m = C.antiMate[w.idx][k]; if (m && placed.has(m.w)) dirs.push(scale(W[m.w].studs[m.k].up, -1)); });
  w.studs.forEach((s, k) => { const m = C.studMate[w.idx][k]; if (m && placed.has(m.w)) dirs.push(s.up); });
  for (const c of C.techConns) {
    if (!c.ok) continue;
    if (c.a === w.idx && placed.has(c.b)) dirs.push(scale(c.open, -1));
    if (c.b === w.idx && placed.has(c.a)) dirs.push(c.open);
  }
  if (!dirs.length) return { ok: false, reason: 'none', msg: '放下時沒有接到任何已完成的零件' };
  const dir = dirs[0];
  if (dirs.some((d) => dot(d, dir) < 0.999)) return { ok: false, reason: 'conflict', msg: '接點要求不同的插入方向，無法裝上' };
  const matedStudOf = new Set();
  w.anti.forEach((a, k) => { const m = C.antiMate[w.idx][k]; if (m) matedStudOf.add(m.w + ':' + m.k); });
  const myFreeStuds = w.studs.filter((s, k) => !C.studMate[w.idx][k] || !placed.has(C.studMate[w.idx][k].w));
  const obstacles = [...placed].filter((i) => !C.exempt(i, w.idx)).map((i) => W[i]);
  const obstacleStuds = [];
  for (const o of obstacles) o.studs.forEach((s, k) => {
    const m = C.studMate[o.idx][k];
    if (m && placed.has(m.w)) return;
    if (matedStudOf.has(o.idx + ':' + k)) return;
    obstacleStuds.push({ o, box: studBox(s.p, s.up) });
  });
  const glo = [Infinity, Infinity, Infinity], ghi = [-Infinity, -Infinity, -Infinity];
  for (const o of obstacles) for (let k = 0; k < 3; k++) { glo[k] = Math.min(glo[k], o.lo[k]); ghi[k] = Math.max(ghi[k], o.hi[k]); }
  for (let t = SWEEP_STEP; t < 2000; t += SWEEP_STEP) {
    const off = scale(dir, -t);
    const mp = w.pieces.map((pc) => movePiece(pc, off));
    const me = { lo: [0, 1, 2].map((k) => Math.min(...mp.map((pc) => pc.lo[k]))), hi: [0, 1, 2].map((k) => Math.max(...mp.map((pc) => pc.hi[k]))) };
    if (me.lo.some((v, k) => v > ghi[k] + 10) || me.hi.some((v, k) => v < glo[k] - 10)) break;
    for (const o of obstacles) {
      if (!aabbHit(me, o)) continue;
      for (const pa of mp) for (const pb of o.pieces) if (overlapDepth(pa, pb) > 0) return { ok: false, dir, reason: 'path', msg: `在距定位 ${t} LDU 處撞到零件 ${o.idx}（${o.id}）` };
    }
    for (const { o, box } of obstacleStuds) if (aabbHit(me, box) && mp.some((pa) => overlapDepth(pa, box) > 0)) return { ok: false, dir, reason: 'path', msg: `在距定位 ${t} LDU 處撞到零件 ${o.idx}（${o.id}）的凸點` };
    for (const s of myFreeStuds) {
      const box = studBox(add(s.p, off), s.up);
      for (const o of obstacles) if (aabbHit(box, o) && o.pieces.some((pb) => overlapDepth(box, pb) > 0)) return { ok: false, dir, reason: 'path', msg: `在距定位 ${t} LDU 處凸點撞到零件 ${o.idx}（${o.id}）` };
    }
  }
  return { ok: true, dir };
}
