// 靜態碰撞：只用 layout 的盒子與楔形（路線與視距都是在這些形狀上驗過的），合併成一個 Havok mesh shape。
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { PhysicsBody } from '@babylonjs/core/Physics/v2/physicsBody.js';
import { PhysicsShapeMesh } from '@babylonjs/core/Physics/v2/physicsShape.js';
import { PhysicsMotionType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin.js';
import { PhysicsRaycastResult } from '@babylonjs/core/Physics/physicsRaycastResult.js';
import { coverBase, wallPieces, COVER_DIMS, SLAB } from './query.js';

/** 彈著面材質（ctx.surf[三角形] → 0 石 1 灰泥 2 木 3 金屬 4 沙），決定彈孔、碎屑與聲音。 */
export const SURF = { stone: 0, plaster: 1, wood: 2, metal: 3, sand: 4 };
const COVER_SURF = { crate1: 2, crate125: 2, crate2: 2, mil: 2, cart: 2, barrel: 3, sandbag: 4 };
export function buildCollision(ctx, L) {
  const p = [], ix = [], surf = [];
  const tag = (code) => { while (surf.length < ix.length / 3) surf.push(code); };   // 剛加進去的三角形都標成 code
  const hex = (c) => { const n = p.length / 3; for (const v of c) p.push(...v); return n; };
  const bx = (cx, cz, hx, hz, rot, y0, y1) => {
    const c = Math.cos(rot), s = Math.sin(rot), C = (a, b, y) => [cx + a * c + b * s, y, cz - a * s + b * c];
    const n = hex([C(-hx, -hz, y0), C(hx, -hz, y0), C(hx, hz, y0), C(-hx, hz, y0), C(-hx, -hz, y1), C(hx, -hz, y1), C(hx, hz, y1), C(-hx, hz, y1)]);
    for (const [a, b, d, e] of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) ix.push(n + a, n + b, n + d, n + a, n + d, n + e);
  };
  const aabb = (x0, z0, x1, z1, y0, y1) => bx((x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2, 0, y0, y1);
  for (const g of L.ground) { aabb(g.x0, g.z0, g.x1, g.z1, g.y - SLAB, g.y); tag(g.mat === 'sand' ? 4 : 0); }
  for (const b of L.blocks) { aabb(b.x0, b.z0, b.x1, b.z1, b.y0, b.y1); tag(b.style === 'plaster' || b.style === 'whitewash' ? 1 : 0); }
  for (const r of L.ramps) {
    const xAxis = r.dir[1] === 'x', neg = r.dir[0] === '-';
    const lo = neg ? r.y1 : r.y0, hi = neg ? r.y0 : r.y1, base = Math.min(lo, hi) - 0.3;
    const P = (a, b, y) => { const A = a ? (xAxis ? r.x1 : r.z1) : (xAxis ? r.x0 : r.z0), B = b ? (xAxis ? r.z1 : r.x1) : (xAxis ? r.z0 : r.x0); return xAxis ? [A, y, B] : [B, y, A]; };
    const n = hex([P(0, 0, base), P(1, 0, base), P(1, 1, base), P(0, 1, base), P(0, 0, lo), P(1, 0, hi), P(1, 1, hi), P(0, 1, lo)]);
    for (const [a, b, d, e] of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) ix.push(n + a, n + b, n + d, n + a, n + d, n + e);
    tag(0);
  }
  for (const w of L.walls) {
    const len = Math.hypot(w.bx - w.ax, w.bz - w.az), ux = (w.bx - w.ax) / len, uz = (w.bz - w.az) / len, alongX = Math.abs(ux) > 0.5;
    for (const q of wallPieces(w)) {
      const m = (q.s0 + q.s1) / 2, h = (q.s1 - q.s0) / 2;
      bx(w.ax + ux * m, w.az + uz * m, alongX ? h : w.t / 2, alongX ? w.t / 2 : h, 0, q.y0, q.y1);
    }
    tag(w.style === 'plaster' ? 1 : 0);
  }
  for (const c of L.cover) {
    const d = COVER_DIMS[c.kind], y = coverBase(L, c), y1 = y + d.h * (c.stack || 1);
    if (d.r) { for (const a of [0, 0.785]) bx(c.x, c.z, d.r * 0.92, d.r * 0.92, a, y, y1); }
    else bx(c.x, c.z, d.w / 2, d.d / 2, (c.rot || 0) * Math.PI / 180, y, y1);
    tag(COVER_SURF[c.kind] ?? 0);
  }
  ctx.surf = Uint8Array.from(surf);
  const m = new Mesh('collide', ctx.scene), v = new VertexData();
  v.positions = new Float32Array(p); v.indices = new Uint32Array(ix); v.normals = new Float32Array(p.length);
  v.applyToMesh(m, false);
  const body = new PhysicsBody(m, PhysicsMotionType.STATIC, false, ctx.scene);
  const shape = new PhysicsShapeMesh(m, ctx.scene);
  body.shape = shape;
  ctx.collideShape = shape;
  m.setEnabled(false);          // 只給物理用，不進快照
  const hit = new PhysicsRaycastResult();
  ctx.ray = (from, to) => { ctx.plugin.raycast(from, to, hit); return hit; };
  return m;
}
