// 小工具：把許多帶頂點色的基本形狀併成一個幾何（角色、槍）。
import * as THREE from 'three';
import { gridBox } from './builder.js';
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
export class Geo {
  constructor(wear = null) { this.list = []; this.wear = wear; } // wear：{ ao, k, col }（col 省略＝把原色調亮）
  add(g, x, y, z, col, o = {}) {
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'YXZ'); _q.setFromEuler(_e); _s.set(o.sx || 1, o.sy || 1, o.sz || 1);
    // 磨損：倒角面（法線同時有兩個軸的分量）露出較亮的底材。要在套用擺放矩陣之前用零件自己的軸判斷
    const n = g.attributes.position.count, W = this.wear, bev = W && o.bev, N0 = g.attributes.normal, edge = bev ? new Uint8Array(n) : null;
    if (bev) for (let i = 0; i < n; i++) { const ax = Math.abs(N0.getX(i)), ay = Math.abs(N0.getY(i)), az = Math.abs(N0.getZ(i)); edge[i] = bev === 'x' ? (ax > 0.2 && ax < 0.95) : bev === 'z' ? (az > 0.2 && az < 0.95) : ((ax > 0.28) + (ay > 0.28) + (az > 0.28) >= 2); }
    g.applyMatrix4(_m.compose(_p.set(x, y, z), _q, _s));
    const c = new Float32Array(n * 3), N = g.attributes.normal;
    for (let i = 0; i < n; i++) {
      let r = col[0], gg = col[1], b = col[2];
      if (W) { // 朝下的面與凹處壓暗（便宜的環境遮蔽）
        const ny = N.getY(i), t = Math.max(0, Math.min(1, (ny + 0.7) / 1.2)), ao = W.ao + (1 - W.ao) * t * t * (3 - 2 * t); r *= ao; gg *= ao; b *= ao;
        if (edge && edge[i]) { if (W.col) { r += (W.col[0] - r) * W.k; gg += (W.col[1] - gg) * W.k; b += (W.col[2] - b) * W.k; } else { r *= 1 + W.k; gg *= 1 + W.k; b *= 1 + W.k; } }
      }
      c[i * 3] = r; c[i * 3 + 1] = gg; c[i * 3 + 2] = b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); this.list.push(g); return this;
  }
  box(w, h, d, x, y, z, col, o = {}) { return this.add(gridBox(w, h, d, { r: o.r || 0, tess: 9, uvs: 0.2 }), x, y, z, col, o.r ? { ...o, bev: 'box' } : o); }
  cyl(rt, rb, h, seg, x, y, z, col, o = {}) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open), x, y, z, col, o); }
  sph(r, x, y, z, col, o = {}) { return this.add(new THREE.SphereGeometry(r, o.ws || 10, o.hs || 7, 0, 6.2832, o.t0 || 0, o.tl || Math.PI), x, y, z, col, o); }
  build() { return mergeGeos(this.list); }
  get empty() { return !this.list.length; }
}
export function mergeGeos(list) {
  let nv = 0, ni = 0; for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3).fill(1), idx = new (nv > 65535 ? Uint32Array : Uint16Array)(ni); let vo = 0, io = 0;
  for (const g of list) {
    const n = g.attributes.position.count; pos.set(g.attributes.position.array, vo * 3); if (g.attributes.normal) nor.set(g.attributes.normal.array, vo * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2); if (g.attributes.color) col.set(g.attributes.color.array, vo * 3);
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.getX(i) + vo; else for (let i = 0; i < n; i++) idx[io++] = vo + i;
    vo += n;
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); out.setAttribute('color', new THREE.BufferAttribute(col, 3)); out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

// ---------- 曲面工具：讓零件有弧度，而不是一塊塊倒角方盒 ----------
const PI2 = Math.PI * 2;
// 依夾角平滑法線：同一個位置上、面法線夾角小於 deg 的三角形共用一個法線（依面積加權，大平面保持平、弧面與倒角變得圓滑），超過的保留稜線
export function smooth(g, deg = 40) {
  const s = g.index ? g.toNonIndexed() : g, P = s.attributes.position.array, n = P.length / 3, ct = Math.cos(deg * Math.PI / 180);
  const F = new Float32Array(n * 3), U = new Float32Array(n * 3), N = new Float32Array(n * 3), map = new Map();
  for (let i = 0; i < n; i += 3) {
    const a = i * 3, ux = P[a + 3] - P[a], uy = P[a + 4] - P[a + 1], uz = P[a + 5] - P[a + 2], vx = P[a + 6] - P[a], vy = P[a + 7] - P[a + 1], vz = P[a + 8] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
    for (let k = 0; k < 3; k++) { const b = a + k * 3; F[b] = nx; F[b + 1] = ny; F[b + 2] = nz; U[b] = nx / l; U[b + 1] = ny / l; U[b + 2] = nz / l; }
  }
  for (let i = 0; i < n; i++) { const k = Math.round(P[i * 3] * 2e4) + ',' + Math.round(P[i * 3 + 1] * 2e4) + ',' + Math.round(P[i * 3 + 2] * 2e4); const b = map.get(k); if (b) b.push(i); else map.set(k, [i]); }
  for (const b of map.values()) for (const i of b) {
    let x = 0, y = 0, z = 0; const ux = U[i * 3], uy = U[i * 3 + 1], uz = U[i * 3 + 2];
    for (const j of b) if (ux * U[j * 3] + uy * U[j * 3 + 1] + uz * U[j * 3 + 2] >= ct) { x += F[j * 3]; y += F[j * 3 + 1]; z += F[j * 3 + 2]; }
    const l = Math.hypot(x, y, z); if (l > 1e-12) { N[i * 3] = x / l; N[i * 3 + 1] = y / l; N[i * 3 + 2] = z / l; } else { N[i * 3] = ux; N[i * 3 + 1] = uy; N[i * 3 + 2] = uz; }
  }
  s.setAttribute('normal', new THREE.BufferAttribute(N, 3)); return s;
}
// 多邊形導圓角：pts = [[a, b, r?]…]（r 省略用 r0，0 = 保留尖角）。每個角換成一段圓弧，回傳加密後的點
export function fillet(pts, r0, seg = 4) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i + n - 1) % n], c = pts[(i + 1) % n], r = p[2] ?? r0;
    let ux = a[0] - p[0], uy = a[1] - p[1], vx = c[0] - p[0], vy = c[1] - p[1]; const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy); ux /= lu; uy /= lu; vx /= lv; vy /= lv;
    const th = Math.acos(Math.max(-1, Math.min(1, ux * vx + uy * vy))), ph = Math.PI - th; // th：兩邊的夾角；ph：轉過的角度
    if (!(r > 0) || ph < 0.12 || th < 0.05) { out.push([p[0], p[1]]); continue; }
    const t = Math.min(r / Math.tan(th / 2), lu * 0.48, lv * 0.48), k = Math.max(1, Math.round(seg * ph / (Math.PI / 2)));
    const x0 = p[0] + ux * t, y0 = p[1] + uy * t, x1 = p[0] + vx * t, y1 = p[1] + vy * t, bl = Math.hypot(ux + vx, uy + vy), cd = t / Math.cos(th / 2), cx = p[0] + (ux + vx) / bl * cd, cy = p[1] + (uy + vy) / bl * cd, sp = Math.sin(ph);
    for (let j = 0; j <= k; j++) { const s = j / k, w0 = Math.sin((1 - s) * ph) / sp, w1 = Math.sin(s * ph) / sp; out.push([cx + (x0 - cx) * w0 + (x1 - cx) * w1, cy + (y0 - cy) * w0 + (y1 - cy) * w1]); }
  }
  return out;
}
export const circle = (cx, cy, r, n = 20, a0 = 0, a1 = PI2) => { const o = [], full = a1 - a0 >= PI2 - 1e-6, m = full ? n : n + 1; for (let i = 0; i < m; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0]); } return o; };
// 車削：pts = [[h, r]…]（h 遞增），繞 z 軸轉一圈；h 相同、r 不同的相鄰兩點是端面
export function latheGeo(pts, seg = 16, deg = 32) {
  const n = pts.length, W = seg + 1, pos = new Float32Array(n * W * 3), uv = new Float32Array(n * W * 2), idx = []; let rm = 0, len = 0;
  for (const p of pts) rm = Math.max(rm, p[1]); const ur = Math.max(1, Math.round(rm * PI2 * 5 * 4));
  for (let i = 0; i < n; i++) { if (i) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); for (let j = 0; j <= seg; j++) { const a = j / seg * PI2, k = i * W + j; pos[k * 3] = Math.cos(a) * pts[i][1]; pos[k * 3 + 1] = Math.sin(a) * pts[i][1]; pos[k * 3 + 2] = pts[i][0]; uv[k * 2] = j / seg * ur; uv[k * 2 + 1] = len * 20; } }
  for (let i = 0; i < n - 1; i++) { const r0 = pts[i][1], r1 = pts[i + 1][1]; for (let j = 0; j < seg; j++) { const a = i * W + j, b = a + 1, c = a + W, d = c + 1; if (r0 > 1e-9) idx.push(a, b, c); if (r1 > 1e-9) idx.push(b, d, c); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
  return smooth(g, deg);
}
// 彎管：path = [[x, y, z, r]…]，Catmull-Rom 通過各點、半徑一起內插，兩端半球封口。o.up 固定截面方向、o.w／o.e 是沿 up／垂直 up 的壓扁比例（織帶、護弓）
const _t = new THREE.Vector3(), _n = new THREE.Vector3(), _b = new THREE.Vector3(), _pp = new THREE.Vector3();
export function tubeGeo(path, seg = 8, o = {}) {
  const sub = o.sub || 4, np = path.length, curve = new THREE.CatmullRomCurve3(path.map(p => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal'), m = (np - 1) * sub + 1, cap = o.cap === false ? [] : [0.5, 0.86, 0.995];
  const C = [], T = [], Rr = []; for (let i = 0; i < m; i++) { const u = i / (m - 1), f = u * (np - 1), i0 = Math.min(np - 2, Math.floor(f)), k = f - i0; C.push(curve.getPoint(u)); T.push(curve.getTangent(u).normalize()); Rr.push(path[i0][3] + (path[i0 + 1][3] - path[i0][3]) * k); }
  const rings = []; // { c, t, r }
  for (let k = cap.length - 1; k >= 0; k--) rings.push({ c: C[0].clone().addScaledVector(T[0], -Rr[0] * cap[k]), t: T[0], r: Rr[0] * Math.sqrt(1 - cap[k] * cap[k]) });
  for (let i = 0; i < m; i++) rings.push({ c: C[i], t: T[i], r: Rr[i] });
  for (let k = 0; k < cap.length; k++) rings.push({ c: C[m - 1].clone().addScaledVector(T[m - 1], Rr[m - 1] * cap[k]), t: T[m - 1], r: Rr[m - 1] * Math.sqrt(1 - cap[k] * cap[k]) });
  const nr = rings.length, W = seg + 1, pos = new Float32Array(nr * W * 3), uv = new Float32Array(nr * W * 2), idx = [], w = o.w || 1, e = o.e || 1; let len = 0;
  if (o.up) _n.set(o.up[0], o.up[1], o.up[2]); else { _t.copy(rings[0].t); _n.set(Math.abs(_t.y) < 0.9 ? 0 : 1, Math.abs(_t.y) < 0.9 ? 1 : 0, 0); }
  for (let i = 0; i < nr; i++) {
    const q = rings[i]; _t.copy(q.t); if (o.up) _n.set(o.up[0], o.up[1], o.up[2]); _n.addScaledVector(_t, -_n.dot(_t)); if (_n.lengthSq() < 1e-8) _n.set(_t.y, _t.z, _t.x).addScaledVector(_t, -_t.dot(_pp.set(_t.y, _t.z, _t.x))); _n.normalize(); _b.crossVectors(_t, _n);
    if (i) len += q.c.distanceTo(rings[i - 1].c);
    for (let j = 0; j <= seg; j++) { const a = j / seg * PI2, cs = Math.cos(a) * q.r * w, sn = Math.sin(a) * q.r * e, k = i * W + j; pos[k * 3] = q.c.x + _n.x * cs + _b.x * sn; pos[k * 3 + 1] = q.c.y + _n.y * cs + _b.y * sn; pos[k * 3 + 2] = q.c.z + _n.z * cs + _b.z * sn; uv[k * 2] = j / seg * 2; uv[k * 2 + 1] = len * 20; }
  }
  for (let i = 0; i < nr - 1; i++) for (let j = 0; j < seg; j++) { const a = i * W + j, b = a + 1, c = a + W, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
  return smooth(g, o.deg || 70);
}
