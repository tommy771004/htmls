// 有號距離場（SDF）建模工具：以平滑聯集組合基本形，再用 surface nets 網格化，
// 法線取自距離場梯度、頂點色取自最近的基本形、凹處以距離場估算遮蔽（AO），讓身體是連續的有機曲面。
import * as THREE from 'three';

/* ---------------- 向量小工具（純數字，避免配置物件） ---------------- */
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// 旋轉：Euler → 逆旋轉 3x3（把世界點轉到基本形的局部座標）
function invRot(r) {
  if (!r || (!r[0] && !r[1] && !r[2])) return null;
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(r[0], r[1], r[2])).invert().elements;
  return [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
}

/* ---------------- 基本形 ---------------- */
// 每個基本形：{ d(x,y,z), lo:[3], hi:[3], color, mat, k, sub }
export function sphere(c, r) {
  return { d: (x, y, z) => len3(x - c[0], y - c[1], z - c[2]) - r, lo: [c[0] - r, c[1] - r, c[2] - r], hi: [c[0] + r, c[1] + r, c[2] + r] };
}
// 橢球（近似距離；r 為三軸半徑，rot 為 Euler）
export function ellip(c, r, rot) {
  const R = invRot(rot), mr = Math.max(r[0], r[1], r[2]);
  return {
    d: (x, y, z) => {
      let px = x - c[0], py = y - c[1], pz = z - c[2];
      if (R) { const a = R[0] * px + R[1] * py + R[2] * pz, b = R[3] * px + R[4] * py + R[5] * pz, e = R[6] * px + R[7] * py + R[8] * pz; px = a; py = b; pz = e; }
      const k0 = len3(px / r[0], py / r[1], pz / r[2]);
      const k1 = len3(px / (r[0] * r[0]), py / (r[1] * r[1]), pz / (r[2] * r[2]));
      return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(r[0], r[1], r[2]);
    },
    lo: [c[0] - mr, c[1] - mr, c[2] - mr], hi: [c[0] + mr, c[1] + mr, c[2] + mr],
  };
}
// 圓錐膠囊：a 端半徑 ra、b 端半徑 rb（iq 的 round cone）
export function cone(a, b, ra, rb) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz, rr = ra - rb, a2 = l2 - rr * rr, il2 = 1 / l2;
  const m = Math.max(ra, rb);
  return {
    d: (x, y, z) => {
      const pax = x - a[0], pay = y - a[1], paz = z - a[2];
      const yv = pax * bax + pay * bay + paz * baz, zz = yv - l2;
      const qx = pax * l2 - bax * yv, qy = pay * l2 - bay * yv, qz = paz * l2 - baz * yv;
      const x2 = qx * qx + qy * qy + qz * qz, y2 = yv * yv * l2, z2 = zz * zz * l2;
      const kk = Math.sign(rr) * rr * rr * x2;
      if (Math.sign(zz) * a2 * z2 > kk) return Math.sqrt(x2 + z2) * il2 - rb;
      if (Math.sign(yv) * a2 * y2 < kk) return Math.sqrt(x2 + y2) * il2 - ra;
      return (Math.sqrt(x2 * a2 * il2) + yv * rr) * il2 - ra;
    },
    lo: [Math.min(a[0], b[0]) - m, Math.min(a[1], b[1]) - m, Math.min(a[2], b[2]) - m],
    hi: [Math.max(a[0], b[0]) + m, Math.max(a[1], b[1]) + m, Math.max(a[2], b[2]) + m],
  };
}
// 圓角方塊：h 為半尺寸、r 為圓角
export function rbox(c, h, r, rot) {
  const R = invRot(rot), mr = len3(h[0] + r, h[1] + r, h[2] + r);
  return {
    d: (x, y, z) => {
      let px = x - c[0], py = y - c[1], pz = z - c[2];
      if (R) { const a = R[0] * px + R[1] * py + R[2] * pz, b = R[3] * px + R[4] * py + R[5] * pz, e = R[6] * px + R[7] * py + R[8] * pz; px = a; py = b; pz = e; }
      const qx = Math.abs(px) - h[0], qy = Math.abs(py) - h[1], qz = Math.abs(pz) - h[2];
      return len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
    },
    lo: [c[0] - mr, c[1] - mr, c[2] - mr], hi: [c[0] + mr, c[1] + mr, c[2] + mr],
  };
}
// 圓環（環在 xz 平面，可旋轉）
export function torus(c, R0, r, rot) {
  const Rm = invRot(rot), m = R0 + r;
  return {
    d: (x, y, z) => {
      let px = x - c[0], py = y - c[1], pz = z - c[2];
      if (Rm) { const a = Rm[0] * px + Rm[1] * py + Rm[2] * pz, b = Rm[3] * px + Rm[4] * py + Rm[5] * pz, e = Rm[6] * px + Rm[7] * py + Rm[8] * pz; px = a; py = b; pz = e; }
      const qx = Math.hypot(px, pz) - R0; return Math.hypot(qx, py) - r;
    },
    lo: [c[0] - m, c[1] - m, c[2] - m], hi: [c[0] + m, c[1] + m, c[2] + m],
  };
}
// 半空間（n 指向「外」，點 p0 在平面上）；常和 sub 一起用來切平
export function plane(p0, n, extent = 1) {
  const l = len3(n[0], n[1], n[2]), nx = n[0] / l, ny = n[1] / l, nz = n[2] / l;
  return { d: (x, y, z) => (x - p0[0]) * nx + (y - p0[1]) * ny + (z - p0[2]) * nz, lo: [p0[0] - extent, p0[1] - extent, p0[2] - extent], hi: [p0[0] + extent, p0[1] + extent, p0[2] + extent], inf: true };
}
// 自訂區域（多半當塗色區用）：fn 回傳有號距離，lo/hi 為大致邊界
export function region(fn, lo = [-9, -9, -9], hi = [9, 9, 9]) { return { d: fn, lo, hi }; }
// 二次貝茲曲線上的尖錐（髮束、尾巴）：分成 n 節 round cone
export function strand(p0, p1, p2, r0, r1, n = 3) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1], u * u * p0[2] + 2 * u * t * p1[2] + t * t * p2[2]]);
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const ra = r0 + (r1 - r0) * Math.pow(i / n, 0.85), rb = r0 + (r1 - r0) * Math.pow((i + 1) / n, 0.85);
    out.push(cone(pts[i], pts[i + 1], ra, rb));
  }
  return out;
}

/* ---------------- 組合 ---------------- */
// 一個部件：基本形清單＋顏色。opts: { color, mat(0 布/膚、1 髮、2 亮面、3 眼), k(與前面的平滑半徑), sub(挖掉), cut(切平) }
export class Body {
  constructor() { this.prims = []; }
  add(prim, color, opts = {}) {
    const list = Array.isArray(prim) ? prim : [prim];
    for (const p of list) { p.color = new THREE.Color(color); p.hex = p.color.getHex(); p.mat = opts.mat || 0; p.k = opts.k ?? 0.02; p.sub = !!opts.sub; p.inter = !!opts.inter; p.paint = !!opts.paint; p.bias = opts.bias || 0; this.prims.push(p); }
    return this;
  }
  // want：要顏色時傳入，回傳最近的兩種顏色（以分數比較：形狀基本形用距離、塗色區用區域距離）
  eval(x, y, z, want) {
    let acc = 1e9;
    for (const p of this.prims) {
      if (p.paint) continue;
      if (!p.inf) {
        const dx = Math.max(p.lo[0] - x, 0, x - p.hi[0]), dy = Math.max(p.lo[1] - y, 0, y - p.hi[1]), dz = Math.max(p.lo[2] - z, 0, z - p.hi[2]);
        const lb = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (!p.sub && !p.inter && lb > acc + p.k) continue;
        if (p.sub && lb > p.k - acc) continue;
      }
      const d = p.d(x, y, z);
      if (p.sub) acc = smax(acc, -d, p.k);
      else if (p.inter) acc = smax(acc, d, p.k);
      else acc = acc === 1e9 ? d : smin(acc, d, p.k);
    }
    if (!want) return acc;
    // 顏色：形狀基本形的分數 = 它的距離 − 合成後的距離（擁有這塊表面的基本形約為 0），塗色區用區域距離
    let s1 = 1e9, s2 = 1e9, p1 = null, p2 = null;
    const cand = (p, sc) => {
      if (p1 && p.hex === p1.hex) { if (sc < s1) { s1 = sc; p1 = p; } return; }
      if (sc < s1) { if (p1) { s2 = s1; p2 = p1; } s1 = sc; p1 = p; return; }
      if (p2 && p.hex === p2.hex) { if (sc < s2) { s2 = sc; p2 = p; } return; }
      if (sc < s2) { s2 = sc; p2 = p; }
    };
    for (const p of this.prims) {
      if (p.sub || p.inter) continue;
      if (p.paint) { cand(p, p.d(x, y, z) + p.bias); continue; }
      if (!p.inf) {
        const dx = Math.max(p.lo[0] - x, 0, x - p.hi[0]), dy = Math.max(p.lo[1] - y, 0, y - p.hi[1]), dz = Math.max(p.lo[2] - z, 0, z - p.hi[2]);
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) - acc > s2) continue;
      }
      cand(p, p.d(x, y, z) - acc);
    }
    want.p = p1; want.q = p2; want.s1 = s1; want.s2 = s2;
    return acc;
  }
}
export function smin(a, b, k) { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
export function smax(a, b, k) { return -smin(-a, -b, k); }

/* ---------------- surface nets 網格化 ---------------- */
// opts: { cell, pad, paint(x,y,z, nx,ny,nz, color, prim) → 修改 color、可回傳 mat }
export function meshBody(body, opts = {}) {
  const cell = opts.cell || 0.015;
  // 邊界：所有非挖除基本形的盒子聯集
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (const p of body.prims) if (!p.sub && !p.inf && !p.inter && !p.paint) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p.lo[i]); hi[i] = Math.max(hi[i], p.hi[i]); }
  for (let i = 0; i < 3; i++) { lo[i] -= cell * 2; hi[i] += cell * 2; }
  const nx = Math.ceil((hi[0] - lo[0]) / cell) + 1, ny = Math.ceil((hi[1] - lo[1]) / cell) + 1, nz = Math.ceil((hi[2] - lo[2]) / cell) + 1;
  const F = new Float32Array(nx * ny * nz);
  const id3 = (i, j, k) => (k * ny + j) * nx + i;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) F[id3(i, j, k)] = body.eval(lo[0] + i * cell, lo[1] + j * cell, lo[2] + k * cell);
  // 每個跨零的格子放一個頂點
  const vIndex = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cid = (i, j, k) => (k * (ny - 1) + j) * (nx - 1) + i;
  const verts = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8), cp = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let neg = 0;
    for (let c = 0; c < 8; c++) { const v = F[id3(i + cp[c][0], j + cp[c][1], k + cp[c][2])]; cv[c] = v; if (v < 0) neg++; }
    if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of E) {
      const va = cv[a], vb = cv[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      sx += cp[a][0] + (cp[b][0] - cp[a][0]) * t; sy += cp[a][1] + (cp[b][1] - cp[a][1]) * t; sz += cp[a][2] + (cp[b][2] - cp[a][2]) * t; n++;
    }
    vIndex[cid(i, j, k)] = verts.length / 3;
    verts.push(lo[0] + (i + sx / n) * cell, lo[1] + (j + sy / n) * cell, lo[2] + (k + sz / n) * cell);
  }
  // 面：每條跨零的格線，由共用它的四個格子組成四邊形
  const idx = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) { const t = b; b = d; d = t; }
    // 取較短的對角線
    const ax = verts[a * 3], ay = verts[a * 3 + 1], az = verts[a * 3 + 2], cx = verts[c * 3], cy = verts[c * 3 + 1], cz = verts[c * 3 + 2];
    const bx = verts[b * 3], by = verts[b * 3 + 1], bz = verts[b * 3 + 2], dx = verts[d * 3], dy = verts[d * 3 + 1], dz = verts[d * 3 + 2];
    if (len3(ax - cx, ay - cy, az - cz) <= len3(bx - dx, by - dy, bz - dz)) idx.push(a, b, c, a, c, d); else idx.push(a, b, d, b, c, d);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const s0 = F[id3(i, j, k)] < 0, s1 = F[id3(i + 1, j, k)] < 0; if (s0 === s1) continue;
    quad(vIndex[cid(i, j - 1, k - 1)], vIndex[cid(i, j, k - 1)], vIndex[cid(i, j, k)], vIndex[cid(i, j - 1, k)], !s0);
  }
  for (let k = 1; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const s0 = F[id3(i, j, k)] < 0, s1 = F[id3(i, j + 1, k)] < 0; if (s0 === s1) continue;
    quad(vIndex[cid(i - 1, j, k - 1)], vIndex[cid(i - 1, j, k)], vIndex[cid(i, j, k)], vIndex[cid(i, j, k - 1)], !s0);
  }
  for (let k = 0; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const s0 = F[id3(i, j, k)] < 0, s1 = F[id3(i, j, k + 1)] < 0; if (s0 === s1) continue;
    quad(vIndex[cid(i - 1, j - 1, k)], vIndex[cid(i, j - 1, k)], vIndex[cid(i, j, k)], vIndex[cid(i - 1, j, k)], !s0);
  }
  // 頂點：投影回曲面、法線、顏色、遮蔽
  const nv = verts.length / 3;
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), colB = new Float32Array(nv * 3), mat = new Float32Array(nv * 2), edge = new Float32Array(nv), ao = new Float32Array(nv);
  const e = cell * 0.5, want = { p: null }, c = new THREE.Color(), c2 = new THREE.Color(), cpc = new THREE.Color();
  for (let v = 0; v < nv; v++) {
    let x = verts[v * 3], y = verts[v * 3 + 1], z = verts[v * 3 + 2];
    for (let it = 0; it < 2; it++) {
      const f = body.eval(x, y, z);
      const gx = body.eval(x + e, y, z) - body.eval(x - e, y, z), gy = body.eval(x, y + e, z) - body.eval(x, y - e, z), gz = body.eval(x, y, z + e) - body.eval(x, y, z - e);
      const g2 = (gx * gx + gy * gy + gz * gz) / (4 * e * e);
      if (g2 < 1e-6) break;
      const s = f / g2 / (2 * e);
      const mx = clamp(s * gx, -cell, cell), my = clamp(s * gy, -cell, cell), mz = clamp(s * gz, -cell, cell);
      x -= mx; y -= my; z -= mz;
    }
    let gx = body.eval(x + e, y, z) - body.eval(x - e, y, z), gy = body.eval(x, y + e, z) - body.eval(x, y - e, z), gz = body.eval(x, y, z + e) - body.eval(x, y, z - e);
    const gl = len3(gx, gy, gz) || 1; gx /= gl; gy /= gl; gz /= gl;
    body.eval(x, y, z, want);
    // 顏色對：依色碼排序，邊界值 = A 分數 − B 分數（< 0 取 A）；片段著色器據此畫出銳利的色塊邊界
    let pa = want.p, pb = want.q, e0 = -1;
    if (pa && pb) { if (pb.hex < pa.hex) { const t = pa; pa = pb; pb = t; e0 = pa === want.p ? want.s1 - want.s2 : want.s2 - want.s1; } else e0 = want.s1 - want.s2; }
    else pb = pa;
    c.copy(pa ? pa.color : WHITE); c2.copy(pb ? pb.color : WHITE);
    let m = pa ? pa.mat : 0, m2 = pb ? pb.mat : 0;
    if (opts.paint) {
      const near = want.p; cpc.copy(near ? near.color : WHITE);
      const r = opts.paint(x, y, z, gx, gy, gz, cpc, near);
      if (!cpc.equals(near ? near.color : WHITE) || r !== undefined) { c.copy(cpc); c2.copy(cpc); m = m2 = r !== undefined ? r : (near ? near.mat : 0); e0 = -1; }
    }
    // 遮蔽：沿法線往外取樣，距離場小於取樣距離表示附近有其他曲面
    let occ = 0;
    for (const [dd, w] of AO_STEPS) occ += w * Math.max(0, dd - body.eval(x + gx * dd, y + gy * dd, z + gz * dd)) / dd;
    pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
    nor[v * 3] = gx; nor[v * 3 + 1] = gy; nor[v * 3 + 2] = gz;
    col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
    colB[v * 3] = c2.r; colB[v * 3 + 1] = c2.g; colB[v * 3 + 2] = c2.b;
    mat[v * 2] = m; mat[v * 2 + 1] = m2; edge[v] = e0; ao[v] = clamp(1 - occ * 1.25, 0, 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aColB', new THREE.BufferAttribute(colB, 3));
  g.setAttribute('aMat', new THREE.BufferAttribute(mat, 2));
  g.setAttribute('aEdge', new THREE.BufferAttribute(edge, 1));
  g.setAttribute('aAO', new THREE.BufferAttribute(ao, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
const WHITE = new THREE.Color(0xffffff);
const AO_STEPS = [[0.012, 0.45], [0.03, 0.35], [0.06, 0.2]];

/* ---------------- 動畫質感材質 ---------------- */
// 自帶光照：右上暖色主光、清楚的明暗交界、柔和第三階、冷色邊緣光、髮絲高光帶、亮面點高光、臉部貼花。
const VS = `
attribute vec2 aMat; attribute float aAO; attribute vec3 aColB; attribute float aEdge;
varying vec3 vCol; varying vec3 vColB; varying vec2 vMat; varying float vEdge; varying float vAO; varying vec3 vN; varying vec3 vV; varying vec3 vObj; varying vec3 vObjN;
#include <common>
void main(){
  vCol = color; vColB = aColB; vMat = aMat; vEdge = aEdge; vAO = aAO; vObj = position; vObjN = normal;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const FS = `
uniform vec3 uKey; uniform vec3 uKeyCol; uniform vec3 uShadeCol; uniform vec3 uRimCol; uniform float uFlash;
uniform sampler2D uFace; uniform float uHasFace; uniform vec4 uFaceRect;
varying vec3 vCol; varying vec3 vColB; varying vec2 vMat; varying float vEdge; varying float vAO; varying vec3 vN; varying vec3 vV; varying vec3 vObj; varying vec3 vObjN;
void main(){
  vec3 N = normalize(vN), V = normalize(vV), L = normalize(uKey);
  float fw = max(fwidth(vEdge), 1e-4);
  float kb = smoothstep(-fw, fw, vEdge);
  vec3 base = mix(vCol, vColB, kb);
  float mt = mix(vMat.x, vMat.y, step(0.5, kb));
  // 臉部貼花（正面半球，以物件座標平面投影）
  if (uHasFace > 0.5) {
    vec2 uv = (vObj.xy - uFaceRect.xy) / uFaceRect.zw + 0.5;
    if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
      vec4 t = texture2D(uFace, uv);
      float m = smoothstep(0.12, 0.42, normalize(vObjN).z) * t.a;
      base = mix(base, t.rgb, m);
    }
  }
  float ndl = dot(N, L);
  float ao = vAO;
  // 遮蔽把明暗交界往亮部推：凹處更早進入陰影
  float lit = smoothstep(-0.03, 0.04, ndl - (1.0 - ao) * 0.32);
  float top = smoothstep(0.55, 0.62, ndl) * ao;
  vec3 shade = base * uShadeCol;
  vec3 c = mix(shade, base * uKeyCol, lit);
  c += base * top * 0.1;
  c *= mix(0.8, 1.0, smoothstep(0.1, 0.7, ao));
  // 冷色邊緣光（只在輪廓）
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  c += uRimCol * rim * (0.35 + 0.3 * lit) * ao;
  vec3 H = normalize(L + V);
  float nh = max(dot(N, H), 0.0);
  // 髮：一道銳利的高光帶
  // 髮：沿頭形的一圈光澤帶（動畫髮常見的環狀高光）
  if (mt > 0.5 && mt < 1.5) { float ny = N.y; c += mix(base, vec3(1.0), 0.55) * smoothstep(0.5, 0.56, ny) * (1.0 - smoothstep(0.7, 0.76, ny)) * 0.45 * (0.4 + 0.6 * lit) * smoothstep(0.3, 0.6, ao); }
  // 亮面（盔甲、圓頂）：小而銳利的點高光
  if (mt > 1.5 && mt < 2.5) c += vec3(1.0) * smoothstep(0.955, 0.97, nh) * 0.6;
  // 發光（眼、能量）
  if (mt > 2.5) c = base * 1.2;
  c = mix(c, vec3(1.0), uFlash);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const KEY_DIR = new THREE.Vector3(0.52, 0.8, 0.3).normalize(); // 右上、略偏鏡頭側
export function heroMaterial(faceTex = null, faceRect = null) {
  return new THREE.ShaderMaterial({
    vertexShader: VS, fragmentShader: FS, vertexColors: true,
    uniforms: {
      uKey: { value: KEY_DIR }, uKeyCol: { value: new THREE.Color(1.08, 1.0, 0.92) }, uShadeCol: { value: new THREE.Color(0.58, 0.56, 0.72) },
      uRimCol: { value: new THREE.Color(0.55, 0.72, 0.95) }, uFlash: { value: 0 },
      uFace: { value: faceTex }, uHasFace: { value: faceTex ? 1 : 0 }, uFaceRect: { value: new THREE.Vector4(...(faceRect || [0, 0, 1, 1])) },
    },
  });
}
