// 士兵：一個帶骨架的 SkinnedMesh。身體用放樣曲面（肩、肘、腰、膝的權重在兩根骨頭之間混合），裝備是綁在單一骨頭上的零件；
// 走跑蹲、舉槍、換彈是程序動畫（四肢用兩節 IK 直接擺骨頭），倒地改由 Verlet 布娃娃接手。
// 模型正面朝 -z（和 sim 的 yaw 定義一致）。
import * as THREE from 'three';
import { gridBox, ambientPatch } from './builder.js';
import { rifleLow } from './weapon.js';
import { C, mul } from './props.js';

const PI = Math.PI;
export const TEAM_LOOK = [
  { cloth: C('#2f3a44'), vest: C('#171e23'), gear: C('#222a30'), glow: new THREE.Color(0.2, 2.1, 1.95), css: '#48d6cc', sleeve: C('#2f3a44') },
  { cloth: C('#3d2f23'), vest: C('#3f1a12'), gear: C('#1a1614'), glow: new THREE.Color(2.6, 0.8, 0.14), css: '#ff7a33', sleeve: C('#3d2f23') },
];
const BOOT = C('#121314'), GLOVE = C('#18191b'), RUBBER = [0.012, 0.013, 0.015], WHITE = [1, 1, 1];
const UA = 0.29, FA = 0.27, TH = 0.45, SH = 0.44;
// 綁定姿勢（站直、手臂下垂）的骨頭位置
const HIP = 0.93, TOR = 1.0, SHX = 0.215, SHY = 0.45, HX = 0.1, HEAD = 0.56;
const BN = { pelvis: 0, torso: 1, head: 2, uaL: 3, faL: 4, uaR: 5, faR: 6, thL: 7, shL: 8, ftL: 9, thR: 10, shR: 11, ftR: 12 };

const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _e4 = new THREE.Euler(), _p4 = new THREE.Vector3(), _s4 = new THREE.Vector3();
// 帶蒙皮權重的幾何組裝器
class SkinGeo {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.si = []; this.sw = []; this.idx = []; }
  _w(w) { this.si.push(w[0], w.length > 2 ? w[2] : 0, 0, 0); this.sw.push(w[1], w.length > 2 ? w[3] : 0, 0, 0); }
  // 放樣：rings = [{ y, rx, rz, col, w:[骨頭, 權重, 骨頭, 權重], x, z, n }]，每一圈是 xz 平面上的（超）橢圓，n = 2 是橢圓、越大越方
  loft(rings, seg, o = {}) {
    const nr = rings.length, base = this.pos.length / 3, W = seg + 1, P = new Float32Array(nr * W * 3); let rmax = 0;
    for (let i = 0; i < nr; i++) {
      const r = rings[i], e = 2 / r.n; rmax = Math.max(rmax, r.rx, r.rz);
      for (let j = 0; j <= seg; j++) { const a = (j % seg) / seg * PI * 2, c = Math.cos(a), s = Math.sin(a), k = (i * W + j) * 3; P[k] = r.x + r.rx * Math.sign(c) * Math.pow(Math.abs(c), e); P[k + 1] = r.y; P[k + 2] = r.z + r.rz * Math.sign(s) * Math.pow(Math.abs(s), e); }
    }
    const urep = Math.max(2, Math.round(rmax * 6.28 * 5)), dir = Math.sign(rings[nr - 1].y - rings[0].y) || 1;
    for (let i = 0; i < nr; i++) {
      const r = rings[i], i0 = Math.max(0, i - 1), i1 = Math.min(nr - 1, i + 1);
      for (let j = 0; j <= seg; j++) {
        const j0 = (j - 1 + seg) % seg, j1 = (j + 1) % seg, a = (i * W + j0) * 3, b = (i * W + j1) * 3, c = (i0 * W + j % seg) * 3, d = (i1 * W + j % seg) * 3, k = (i * W + j) * 3;
        const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[d] - P[c], vy = P[d + 1] - P[c + 1], vz = P[d + 2] - P[c + 2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const ox = P[k] - r.x, oz = P[k + 2] - r.z;
        if (nx * ox + nz * oz < 0) { nx = -nx; ny = -ny; nz = -nz; }
        let l = Math.hypot(nx, ny, nz); if (l < 1e-9) { nx = ox; ny = 0; nz = oz; l = Math.hypot(nx, nz) || 1; }
        this.pos.push(P[k], P[k + 1], P[k + 2]); this.nor.push(nx / l, ny / l, nz / l); this.uv.push(j / seg * urep, r.y * 5); this.col.push(r.col[0], r.col[1], r.col[2]); this._w(r.w);
      }
    }
    const tri = (a, b, c) => { if (dir < 0) this.idx.push(base + a, base + b, base + c); else this.idx.push(base + a, base + c, base + b); };
    for (let i = 0; i < nr - 1; i++) for (let j = 0; j < seg; j++) { const a = i * W + j, b = a + 1, c = a + W, d = c + 1; tri(a, b, c); tri(b, d, c); }
    // 封口
    for (const [on, i, sy] of [[o.cap0, 0, -dir], [o.cap1, nr - 1, dir]]) {
      if (!on) continue; const r = rings[i], ci = this.pos.length / 3 - base;
      this.pos.push(r.x, r.y, r.z); this.nor.push(0, sy, 0); this.uv.push(0, r.y * 5); this.col.push(r.col[0], r.col[1], r.col[2]); this._w(r.w);
      for (let j = 0; j < seg; j++) { const a = i * W + j, b = a + 1; if (i === 0) tri(ci, b, a); else tri(ci, a, b); }
    }
    return this;
  }
  // 剛性零件：整個幾何綁在一根骨頭上
  part(g, bone, col, x, y, z, o = {}) {
    _e4.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ'); g.applyMatrix4(_m4.compose(_p4.set(x, y, z), _q4.setFromEuler(_e4), _s4.set(o.sx || 1, o.sy || 1, o.sz || 1)));
    const base = this.pos.length / 3, Pa = g.attributes.position, Na = g.attributes.normal, Ua = g.attributes.uv, w = [bone, 1];
    for (let i = 0; i < Pa.count; i++) { this.pos.push(Pa.getX(i), Pa.getY(i), Pa.getZ(i)); this.nor.push(Na.getX(i), Na.getY(i), Na.getZ(i)); this.uv.push(Ua ? Ua.getX(i) : 0, Ua ? Ua.getY(i) : 0); this.col.push(col[0], col[1], col[2]); this._w(w); }
    if (g.index) for (let i = 0; i < g.index.count; i++) this.idx.push(base + g.index.getX(i)); else for (let i = 0; i < Pa.count; i++) this.idx.push(base + i);
    return this;
  }
  box(bone, col, w, h, d, x, y, z, o = {}) { return this.part(gridBox(w, h, d, { r: o.r || 0, tess: 9, uvs: 0.2, lite: true }), bone, col, x, y, z, o); }
  sph(bone, col, r, x, y, z, o = {}) { return this.part(new THREE.SphereGeometry(r, o.ws || 12, o.hs || 8, 0, 6.2832, o.t0 || 0, o.tl || PI), bone, col, x, y, z, o); }
  cyl(bone, col, rt, rb, h, seg, x, y, z, o = {}) { return this.part(new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open), bone, col, x, y, z, o); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4)); g.setIndex(this.idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 2.2);
    return g;
  }
}
const R = (y, rx, rz, col, w, x = 0, z = 0, n = 2) => ({ y, rx, rz, col, w, x, z, n });
const fat = (rings, kx, kz = kx) => rings.map(r => ({ ...r, rx: r.rx * kx, rz: r.rz * kz })); // 整段加粗（衣服與裝備的份量）

let GEO = null;
function geos() {
  if (GEO) return GEO;
  GEO = [0, 1].map(t => {
    const L = TEAM_LOOK[t], G = new SkinGeo(), GL = new SkinGeo(), cl = L.cloth, dk = mul(cl, 0.62), vs = L.vest, gr = L.gear, hood = t === 1;
    const { pelvis: P, torso: T, head: H } = BN, neck = hood ? gr : mul(gr, 1.15);
    // ---- 軀幹：褲襠到脖子，腰部在骨盆與胸腔之間混合 ----
    G.loft([
      R(0.795, 0.06, 0.06, dk, [P, 1]), R(0.84, 0.152, 0.106, cl, [P, 1]), R(0.90, 0.174, 0.12, cl, [P, 1]), R(0.955, 0.170, 0.117, cl, [P, 0.8, T, 0.2]),
      R(1.01, 0.158, 0.11, dk, [P, 0.5, T, 0.5]), R(1.07, 0.154, 0.108, cl, [P, 0.2, T, 0.8]), R(1.16, 0.170, 0.116, cl, [T, 1]),
      R(1.28, 0.188, 0.128, cl, [T, 1], 0, -0.008), R(1.40, 0.194, 0.122, cl, [T, 1], 0, -0.004), R(1.465, 0.158, 0.106, cl, [T, 1]), R(1.505, 0.092, 0.084, cl, [T, 1]),
      R(1.54, 0.06, 0.064, neck, [T, 0.6, H, 0.4]), R(1.61, 0.056, 0.06, neck, [H, 1]),
    ], 18, { cap0: true });
    // 腰帶與腰包
    G.loft([R(0.945, 0.178, 0.124, gr, [P, 1], 0, 0, 2.6), R(0.985, 0.178, 0.124, gr, [P, 0.8, T, 0.2], 0, 0, 2.6)], 18);
    G.box(P, gr, 0.07, 0.11, 0.045, 0.185, 0.93, 0.0, { r: 0.014 }).box(P, gr, 0.085, 0.085, 0.045, -0.13, 0.955, 0.115, { r: 0.014 }).box(P, gr, 0.06, 0.035, 0.012, 0, 0.965, -0.126);
    // ---- 抗彈背心：比身體大一圈、偏方的殼，整件跟著胸腔 ----
    G.loft([
      R(1.075, 0.13, 0.10, vs, [T, 1], 0, -0.004, 3), R(1.085, 0.176, 0.136, vs, [T, 1], 0, -0.006, 3.4), R(1.20, 0.186, 0.146, vs, [T, 1], 0, -0.008, 3.4),
      R(1.33, 0.198, 0.152, vs, [T, 1], 0, -0.012, 3.2), R(1.42, 0.198, 0.142, vs, [T, 1], 0, -0.008, 3), R(1.452, 0.17, 0.118, vs, [T, 1], 0, -0.004, 2.6),
    ], 18);
    for (const s of [-1, 1]) G.box(T, vs, 0.062, 0.03, 0.23, s * 0.118, 1.492, 0.004, { r: 0.012 }); // 肩帶
    for (let i = -1; i <= 1; i++) { G.box(T, gr, 0.078, 0.125, 0.04, i * 0.092, 1.175, -0.168, { r: 0.012 }); G.box(T, mul(gr, 0.7), 0.05, 0.02, 0.044, i * 0.092, 1.245, -0.168); } // 彈匣袋
    G.box(T, gr, 0.15, 0.085, 0.03, 0.045, 1.36, -0.168, { r: 0.01 }).box(T, mul(gr, 1.4), 0.06, 0.1, 0.035, -0.115, 1.37, -0.165, { r: 0.01 }).cyl(T, RUBBER, 0.006, 0.006, 0.16, 5, -0.13, 1.5, -0.15);
    G.box(T, gr, 0.27, 0.33, 0.1, 0, 1.285, 0.195, { r: 0.035 }).box(T, vs, 0.19, 0.1, 0.05, 0, 1.13, 0.215, { r: 0.018 }).box(T, mul(gr, 0.7), 0.03, 0.3, 0.012, 0.09, 1.285, 0.248).box(T, mul(gr, 0.7), 0.03, 0.3, 0.012, -0.09, 1.285, 0.248);
    // ---- 手臂 ----
    for (const s of [-1, 1]) {
      const ua = s < 0 ? BN.uaL : BN.uaR, fa = s < 0 ? BN.faL : BN.faR, x = s * SHX;
      G.loft(fat([
        R(1.498, 0.022, 0.024, cl, [T, 0.5, ua, 0.5], x - s * 0.012), R(1.478, 0.056, 0.058, cl, [T, 0.45, ua, 0.55], x - s * 0.004), R(1.44, 0.066, 0.068, cl, [T, 0.2, ua, 0.8], x + s * 0.004),
        R(1.37, 0.06, 0.062, cl, [ua, 1], x), R(1.28, 0.053, 0.055, cl, [ua, 1], x), R(1.21, 0.048, 0.05, cl, [ua, 0.78, fa, 0.22], x), R(1.16, 0.046, 0.05, dk, [ua, 0.5, fa, 0.5], x, 0.003),
        R(1.11, 0.048, 0.05, cl, [ua, 0.22, fa, 0.78], x), R(1.04, 0.049, 0.051, cl, [fa, 1], x), R(0.95, 0.042, 0.044, cl, [fa, 1], x), R(0.906, 0.038, 0.04, dk, [fa, 1], x),
        R(0.903, 0.041, 0.043, GLOVE, [fa, 1], x), R(0.885, 0.04, 0.042, GLOVE, [fa, 1], x), R(0.86, 0.026, 0.044, GLOVE, [fa, 1], x), R(0.80, 0.022, 0.042, GLOVE, [fa, 1], x), R(0.775, 0.012, 0.03, GLOVE, [fa, 1], x),
      ], 1.2), 12, { cap0: true, cap1: true });
      G.box(fa, mul(GLOVE, 2.2), 0.014, 0.05, 0.08, x + s * 0.031, 0.835, 0, { r: 0.006 }); // 指節護片
      G.cyl(fa, GLOVE, 0.013, 0.011, 0.06, 6, x - s * 0.006, 0.845, -0.05, { rx: 0.5 });   // 拇指
      G.box(fa, gr, 0.094, 0.11, 0.04, x, 1.13, 0.05, { r: 0.016 });                        // 護肘
      G.box(ua, t ? vs : gr, 0.022, 0.085, 0.085, x + s * 0.068, 1.37, 0, { r: 0.01 });      // 臂章
    }
    // ---- 腿 ----
    for (const s of [-1, 1]) {
      const th = s < 0 ? BN.thL : BN.thR, sh = s < 0 ? BN.shL : BN.shR, ft = s < 0 ? BN.ftL : BN.ftR, x = s * HX;
      G.loft(fat([
        R(0.97, 0.05, 0.06, cl, [P, 1], x * 0.8), R(0.93, 0.082, 0.098, cl, [P, 0.7, th, 0.3], x * 0.95), R(0.87, 0.09, 0.104, cl, [P, 0.3, th, 0.7], x), R(0.77, 0.085, 0.096, cl, [th, 1], x),
        R(0.62, 0.072, 0.08, cl, [th, 1], x), R(0.52, 0.064, 0.07, cl, [th, 0.8, sh, 0.2], x), R(0.46, 0.061, 0.067, dk, [th, 0.5, sh, 0.5], x, -0.004), R(0.405, 0.06, 0.066, cl, [th, 0.2, sh, 0.8], x),
        R(0.33, 0.062, 0.07, cl, [sh, 1], x, 0.008), R(0.23, 0.052, 0.058, cl, [sh, 1], x, 0.004), R(0.175, 0.056, 0.062, dk, [sh, 1], x),
        R(0.17, 0.052, 0.058, BOOT, [sh, 1], x), R(0.07, 0.05, 0.057, BOOT, [sh, 1], x), R(0.02, 0.05, 0.058, BOOT, [sh, 0.5, ft, 0.5], x), R(-0.03, 0.048, 0.06, BOOT, [ft, 1], x, -0.01),
      ], 1.14, 1.18), 12, { cap0: true, cap1: true });
      G.box(th, mul(cl, 0.85), 0.03, 0.15, 0.12, x + s * 0.092, 0.6, 0.005, { r: 0.012 }); // 大腿口袋
      // 靴子：腳骨在腳踝，鞋底在骨頭下方 0.085
      G.box(ft, BOOT, 0.116, 0.085, 0.285, x, 0.02 - 0.044, -0.066, { r: 0.036 }).box(ft, [0.004, 0.004, 0.004], 0.12, 0.02, 0.29, x, 0.02 - 0.076, -0.066, { r: 0.008 }).box(ft, mul(BOOT, 1.8), 0.07, 0.012, 0.09, x, 0.02 + 0.0, -0.1, { rx: -0.5 });
      G.box(sh, gr, 0.112, 0.135, 0.05, x, 0.44, -0.07, { r: 0.022 }).box(sh, mul(gr, 0.7), 0.142, 0.02, 0.16, x, 0.40, 0); // 護膝與束帶
      if (s > 0) G.box(th, gr, 0.045, 0.17, 0.105, x + 0.115, 0.77, 0.0, { r: 0.014 }).box(th, mul(gr, 0.7), 0.215, 0.022, 0.235, x, 0.8, 0); // 腿掛槍套
    }
    // ---- 頭 ----
    const hy = 1.68; // 頭的中心（眼睛高度 1.62 上下）
    if (!hood) { // 先鋒：頭盔、護目鏡、通訊耳機
      G.sph(H, mul(gr, 1.25), 0.098, 0, hy, 0, { sy: 1.14, ws: 14, hs: 10 });
      G.sph(H, gr, 0.121, 0, hy + 0.028, 0.008, { sy: 0.9, sz: 1.09, tl: PI * 0.57, ws: 18, hs: 9 });
      G.loft([R(hy + 0.012, 0.124, 0.134, mul(gr, 0.75), [H, 1], 0, 0.008), R(hy + 0.0, 0.121, 0.131, mul(gr, 0.75), [H, 1], 0, 0.008)], 18); // 盔緣
      for (const s of [-1, 1]) { G.box(H, mul(gr, 0.7), 0.012, 0.026, 0.11, s * 0.121, hy + 0.045, 0.0).box(H, RUBBER, 0.036, 0.085, 0.07, s * 0.108, hy - 0.012, 0.004, { r: 0.016 }); }
      G.box(H, mul(gr, 0.7), 0.05, 0.04, 0.022, 0, hy + 0.1, -0.118, { r: 0.006 });                // 夜視鏡座
      G.box(H, RUBBER, 0.176, 0.056, 0.05, 0, hy + 0.006, -0.082, { r: 0.022 }).box(H, [0.03, 0.05, 0.055], 0.15, 0.036, 0.012, 0, hy + 0.006, -0.105, { r: 0.005 }); // 護目鏡
      G.box(H, vs, 0.12, 0.075, 0.06, 0, hy - 0.07, -0.062, { r: 0.026 });                         // 面巾
      G.cyl(H, RUBBER, 0.004, 0.004, 0.1, 5, -0.085, hy - 0.06, -0.06, { rx: PI / 2 - 0.3, ry: -0.5 }).sph(H, RUBBER, 0.012, -0.055, hy - 0.075, -0.1, { ws: 6, hs: 5 }); // 麥克風
      for (const s of [-1, 1]) GL.box(H, WHITE, 0.01, 0.03, 0.05, s * 0.128, hy + 0.068, -0.02);
      for (const s of [-1, 1]) GL.box(T, WHITE, 0.05, 0.01, 0.09, s * 0.118, 1.509, 0.0);
      GL.box(T, WHITE, 0.1, 0.02, 0.01, -0.06, 1.42, -0.166);
    } else { // 餘燼：兜帽、濾罐面罩
      G.sph(H, gr, 0.1, 0, hy, 0, { sy: 1.14, ws: 14, hs: 10 });
      G.sph(H, vs, 0.127, 0, hy + 0.02, 0.022, { sy: 1.06, sz: 1.05, tl: PI * 0.64, ws: 18, hs: 9, rx: 0.42 });
      G.loft([R(1.62, 0.112, 0.118, vs, [H, 1], 0, 0.02), R(1.555, 0.15, 0.13, vs, [T, 0.5, H, 0.5], 0, 0.014), R(1.50, 0.196, 0.136, mul(vs, 0.85), [T, 1], 0, 0.008), R(1.47, 0.205, 0.14, mul(vs, 0.8), [T, 1], 0, 0.006)], 18); // 披在肩上的兜帽下襬
      G.sph(H, RUBBER, 0.078, 0, hy - 0.022, -0.058, { sy: 1.16, sz: 0.74, ws: 14, hs: 9 });        // 面罩
      for (const s of [-1, 1]) G.cyl(H, [0.05, 0.045, 0.04], 0.03, 0.03, 0.014, 14, s * 0.037, hy + 0.012, -0.108, { rx: PI / 2, ry: s * -0.3 });
      G.cyl(H, [0.07, 0.055, 0.04], 0.036, 0.036, 0.055, 14, -0.035, hy - 0.075, -0.108, { rx: PI / 2 - 0.5, ry: 0.5 }).cyl(H, RUBBER, 0.03, 0.03, 0.02, 12, 0.03, hy - 0.07, -0.1, { rx: PI / 2 });
      for (const s of [-1, 1]) GL.cyl(H, WHITE, 0.022, 0.022, 0.006, 14, s * 0.0395, hy + 0.012, -0.1165, { rx: PI / 2, ry: s * -0.3 });
      GL.box(T, WHITE, 0.012, 0.16, 0.01, 0.142, 1.285, 0.248);
    }
    return { body: G.build(), glow: GL.build() };
  });
  return GEO;
}

// 布娃娃的點：0/1 髖、2/3 肩、4 頭、5/6 肘、7/8 手、9/10 膝、11/12 腳（左、右）
const RR = [0.12, 0.12, 0.13, 0.13, 0.115, 0.055, 0.055, 0.05, 0.05, 0.07, 0.07, 0.065, 0.065], KICK = [0.9, 0.9, 2.3, 2.3, 2.9, 1.5, 1.5, 1.1, 1.1, 0.4, 0.4, 0, 0];
const UPV = new THREE.Vector3(0, 1, 0), _X = new THREE.Vector3(), _Y = new THREE.Vector3(), _Z = new THREE.Vector3(), _mt = new THREE.Matrix4(), _mb = new THREE.Matrix4(), _qi = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _ql = new THREE.Quaternion(), _eu = new THREE.Euler(), _p3 = { x: 0, y: 0, z: 0 }, _o2 = { x: 0, z: 0 };
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _pole = new THREE.Vector3(), DOWN = new THREE.Vector3(0, -1, 0);
// 兩節 IK：root → target，長度 l1、l2，pole 指定關節彎向。結果寫進兩根骨頭（位置與朝向，骨頭原本朝 -y）。
function ik2(root, target, l1, l2, pole, m1, m2) {
  _a.subVectors(target, root); let d = _a.length(); const max = l1 + l2 - 0.005; if (d > max) { _a.multiplyScalar(max / d); d = max; } if (d < 0.05) d = 0.05;
  const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  _b.copy(_a).normalize(); _c.copy(pole).addScaledVector(_b, -pole.dot(_b)); if (_c.lengthSq() < 1e-6) _c.set(0, 0, -1); _c.normalize();
  _d.copy(root).addScaledVector(_b, x).addScaledVector(_c, h); // 關節
  m1.position.copy(root); m1.quaternion.setFromUnitVectors(DOWN, _c.subVectors(_d, root).normalize());
  _c.copy(root).add(_a); m2.position.copy(_d); m2.quaternion.setFromUnitVectors(DOWN, _c.sub(_d).normalize());
  return _d;
}

export class Soldier {
  constructor(e, Tx) {
    const t = e.team, G = geos()[t], L = TEAM_LOOK[t];
    this.e = e; this.group = new THREE.Group(); this.body = new THREE.Group(); this.group.add(this.body);
    const bone = (parent, x, y, z) => { const b = new THREE.Bone(); b.position.set(x, y, z); parent.add(b); return b; };
    this.pelvis = bone(this.body, 0, HIP, 0); this.torso = bone(this.body, 0, TOR, 0); this.head = bone(this.torso, 0, HEAD, 0);
    this.ua = [bone(this.torso, -SHX, SHY, 0), bone(this.torso, SHX, SHY, 0)]; this.fa = [bone(this.torso, -SHX, SHY - UA, 0), bone(this.torso, SHX, SHY - UA, 0)];
    this.th = [bone(this.body, -HX, HIP - 0.02, 0), bone(this.body, HX, HIP - 0.02, 0)]; this.sh = [bone(this.body, -HX, HIP - 0.02 - TH, 0), bone(this.body, HX, HIP - 0.02 - TH, 0)];
    this.ft = [bone(this.body, -HX, HIP - 0.02 - TH - SH, 0), bone(this.body, HX, HIP - 0.02 - TH - SH, 0)];
    // 骨頭順序要和 BN 一致；先把綁定姿勢的世界矩陣算好，Skeleton 才量得到正確的反矩陣
    this.group.updateMatrixWorld(true);
    this.skel = new THREE.Skeleton([this.pelvis, this.torso, this.head, this.ua[0], this.fa[0], this.ua[1], this.fa[1], this.th[0], this.sh[0], this.ft[0], this.th[1], this.sh[1], this.ft[1]]);
    this.mat = ambientPatch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84, metalness: 0, normalMap: Tx.fabric.normalMap, normalScale: new THREE.Vector2(0.55, 0.55), envMapIntensity: 0.5 }), 'probe');
    this.glow = new THREE.MeshBasicMaterial({ color: L.glow.clone() });
    const skin = (g, mat, shadow) => { const m = new THREE.SkinnedMesh(g, mat); m.frustumCulled = false; m.castShadow = shadow; m.receiveShadow = shadow; this.body.add(m); m.bind(this.skel, new THREE.Matrix4()); return m; };
    this.mesh = skin(G.body, this.mat, true); this.glowMesh = skin(G.glow, this.glow, false);
    const r = rifleLow(e.loadout); this.gun = new THREE.Mesh(r.geo, this.mat); this.gun.castShadow = true; this.torso.add(this.gun); this.gunInfo = r.info;
    this.phase = Math.random() * 6; this.flinch = 0; this.probeT = Math.random() * 0.2; this.rag = false; this.aim = 1; this.seed = Math.random();
    this.col = new THREE.Color(); this.muz = new THREE.Vector3();
  }
  // 槍口的世界座標
  muzzle(out) { return this.gun.localToWorld(out.set(0, 0.045, this.gunInfo.muzzleZ)); }
  update(dt, g, lights) {
    const e = this.e, grp = this.group, dead = !e.alive;
    this.probeT -= dt; if (this.probeT <= 0) { this.probeT = 0.18; if (this.rag) lights.probe(this.pelvis.position.x, 0.45, this.pelvis.position.z, this.col); else lights.probe(e.x, e.y + 1.1, e.z, this.col); this.mat.userData.uProbe.value.lerp(this.col, 0.6); }
    if (dead) { if (!this.rag) this._ragStart(); this._ragStep(dt, g.world); return; }
    if (this.rag) this._ragEnd();
    grp.position.set(e.x, e.y, e.z); grp.rotation.y = e.yaw;
    const cr = e.crouch;
    // 速度（局部）
    const sy = Math.sin(e.yaw), cy = Math.cos(e.yaw), lvx = e.vx * cy - e.vz * sy, lvz = e.vx * sy + e.vz * cy, sp = Math.hypot(lvx, lvz), mv = Math.min(1, sp / 4);
    this.phase += dt * (sp > 0.3 ? 2.2 + sp * 1.25 : 0);
    const run = e.sprint, hipY = HIP - 0.34 * cr - mv * 0.03 + Math.abs(Math.sin(this.phase)) * 0.035 * mv;
    this.flinch += (0 - this.flinch) * Math.min(1, dt * 9);
    this.pelvis.position.set(0, hipY, 0); this.pelvis.rotation.set(-cr * 0.2, Math.sin(this.phase) * 0.12 * mv, 0);
    const lean = cr * 0.34 + run * 0.3 + mv * 0.06, pitch = e.pitch;
    this.torso.position.set(0, hipY + 0.07, 0.0 + cr * 0.03); this.torso.rotation.set(pitch * 0.45 - lean - this.flinch * 0.25, -Math.sin(this.phase) * 0.1 * mv, Math.sin(this.phase) * 0.03 * mv);
    this.head.rotation.set(pitch * 0.35 + lean * 0.6, 0, 0);
    // 腿
    const ux = sp > 0.01 ? lvx / sp : 0, uz = sp > 0.01 ? lvz / sp : -1, stride = Math.min(0.42, sp * 0.085), lift = Math.min(0.16, sp * 0.04);
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1, ph = this.phase + i * PI, sw = Math.sin(ph), up = Math.max(0, Math.cos(ph));
      _a.set(s * HX, hipY - 0.02, 0);
      const spread = 0.11 + cr * 0.07;
      const tgt = new THREE.Vector3(s * spread + ux * sw * stride, 0.085 + up * lift * (sp > 0.3 ? 1 : 0), -0.02 + uz * sw * stride + cr * (i ? 0.16 : -0.18));
      _pole.set(s * (0.1 + cr * 0.25), 0, -1);
      ik2(_a.clone(), tgt, TH, SH, _pole, this.th[i], this.sh[i]);
      this.ft[i].position.copy(tgt); this.ft[i].rotation.set(up * 0.5 * mv * (uz < 0 ? 1 : -1), s * 0.12, 0);
    }
    // 槍與手（都在胸腔空間）
    const rel = e.reloadT > 0 ? 1 - e.reloadT / e.w.reload : -1, relK = rel >= 0 ? Math.sin(Math.min(1, rel * 1.2) * PI) : 0;
    this.aim += ((run > 0.5 ? 0 : 1) - this.aim) * Math.min(1, dt * 8); const am = this.aim;
    const gy = 0.385 - (1 - am) * 0.13 - relK * 0.05, gz = -0.27 + (1 - am) * 0.04, gx = 0.085 - (1 - am) * 0.03;
    this.gun.position.set(gx, gy, gz);
    this.gun.rotation.set(pitch * 0.55 * am - (1 - am) * 0.5 + relK * 0.5 - this.flinch * 0.15, (1 - am) * 0.75, (1 - am) * 0.3 - relK * 0.35, 'YXZ');
    this.gun.updateMatrix();
    const gp = (x, y, z, out) => out.set(x, y, z).applyMatrix4(this.gun.matrix);
    const hr = gp(0, -0.06, 0.04, new THREE.Vector3()), hl = gp(0, 0.01 - relK * 0.14, -0.27 + relK * 0.16, new THREE.Vector3());
    for (let i = 0; i < 2; i++) { const s = i ? 1 : -1; _a.set(s * SHX, SHY, 0); _pole.set(s * 0.9, -1, 0.5); ik2(_a.clone(), i ? hr : hl, UA, FA + 0.05, _pole, this.ua[i], this.fa[i]); }
  }
  hit() { this.flinch = 1; }
  // —— 倒地：Verlet 布娃娃。13 個點（髖、肩、頭、肘、手、膝、腳）＋距離約束，撞地板與場景的盒子；純演出，和模擬無關 ——
  _ragStart() {
    const e = this.e, grp = this.group, P = this.rp || (this.rp = new Float32Array(39)), Q = this.rq || (this.rq = new Float32Array(39));
    if (!this.rv) { this.rv = []; for (let i = 0; i < 13; i++) this.rv.push(new THREE.Vector3()); this.gv = new THREE.Vector3(); this.gq = new THREE.Quaternion(); }
    grp.updateMatrixWorld(true);
    const put = (i, v) => { P[i * 3] = v.x; P[i * 3 + 1] = Math.max(RR[i], v.y); P[i * 3 + 2] = v.z; }, wp = b => _a.setFromMatrixPosition(b.matrixWorld);
    for (let i = 0; i < 2; i++) { put(i, wp(this.th[i])); put(2 + i, wp(this.ua[i])); put(5 + i, wp(this.fa[i])); put(7 + i, this.fa[i].localToWorld(_a.set(0, -FA - 0.03, 0))); put(9 + i, wp(this.sh[i])); put(11 + i, wp(this.ft[i])); }
    put(4, this.head.localToWorld(_a.set(0, 0.12, 0)));
    const D = (i, j) => Math.hypot(P[i * 3] - P[j * 3], P[i * 3 + 1] - P[j * 3 + 1], P[i * 3 + 2] - P[j * 3 + 2]);
    const Cn = this.rc = [], st = (i, j, len, lo = 1, hi = 1) => { const d = len || D(i, j); Cn.push(i, j, d * lo, d * hi); }, mn = (i, j, d) => Cn.push(i, j, d, Infinity);
    st(0, 1); st(2, 3); st(0, 2); st(1, 3); st(0, 3); st(1, 2); st(4, 2); st(4, 3); st(4, 0, 0, 0.94, 1.03); st(4, 1, 0, 0.94, 1.03);
    for (let i = 0; i < 2; i++) { st(2 + i, 5 + i, UA); st(5 + i, 7 + i, FA + 0.03); st(i, 9 + i, TH); st(9 + i, 11 + i, SH); mn(11 + i, i, 0.3); mn(7 + i, 2 + i, 0.18); mn(9 + i, 2 + i, 0.4); mn(9 + i, 1 - i, 0.2); mn(5 + i, 3 - i, 0.24); mn(7 + i, 4, 0.16); mn(11 + i, 4, 0.5); }
    mn(9, 10, 0.15); mn(11, 12, 0.14); mn(7, 8, 0.1);
    // 初速：自己的速度＋子彈來向的推力（上半身推得多，腳幾乎不動）
    const sx = Math.sin(e.fallYaw || 0), sz = Math.cos(e.fallYaw || 0), h = this.rh = 1 / 120;
    for (let i = 0; i < 13; i++) { const k = KICK[i], o = i * 3; Q[o] = P[o] - ((e.vx || 0) * 0.6 + sx * k + (Math.random() - 0.5) * 0.7) * h; Q[o + 1] = P[o + 1] - (i === 4 ? 0.6 : 0) * h; Q[o + 2] = P[o + 2] - ((e.vz || 0) * 0.6 + sz * k + (Math.random() - 0.5) * 0.7) * h; }
    // 槍：脫手，自己掉到地上躺平
    const G = this.gun; _mt.copy(G.matrixWorld);
    grp.position.set(0, 0, 0); grp.rotation.set(0, 0, 0); this.body.position.set(0, 0, 0); this.body.rotation.set(0, 0, 0);
    grp.add(G); _mt.decompose(G.position, G.quaternion, G.scale);
    _a.set(0, 0, -1).applyQuaternion(G.quaternion); this.gq.setFromEuler(_eu.set(0, Math.atan2(-_a.x, -_a.z), (Math.random() < 0.5 ? -1 : 1) * PI / 2, 'YXZ'));
    this.gv.set(sx * 1.1 + (Math.random() - 0.5), 0.9, sz * 1.1 + (Math.random() - 0.5)); this.gs = false;
    this.rag = true; this.rs = false; this.rt = 0; this.rstill = 0; this._ragPose();
  }
  _ragEnd() { this.rag = false; const G = this.gun; this.torso.add(G); G.scale.set(1, 1, 1); for (let i = 0; i < 2; i++) this.ft[i].quaternion.identity(); }
  wake() { if (this.rag && this.rs) { this.rs = false; this.rstill = 0; this.rt = Math.min(this.rt, 5); } }
  _ragStep(dt, W) {
    if (dt <= 0) return;
    const G = this.gun, gv = this.gv;
    if (!this.gs) {
      gv.y -= 9.8 * dt; G.position.addScaledVector(gv, dt); W.resolve(G.position.x, G.position.z, 0.12, _o2);
      if (_o2.x !== G.position.x || _o2.z !== G.position.z) { G.position.x = _o2.x; G.position.z = _o2.z; gv.x *= -0.2; gv.z *= -0.2; }
      G.quaternion.slerp(this.gq, Math.min(1, dt * 7));
      if (G.position.y < 0.03) { G.position.y = 0.03; gv.y = Math.abs(gv.y) > 1.4 ? -gv.y * 0.22 : 0; gv.x *= 0.6; gv.z *= 0.6; if (gv.y === 0 && G.quaternion.angleTo(this.gq) < 0.01) { gv.set(0, 0, 0); G.quaternion.copy(this.gq); this.gs = true; } }
    }
    if (this.rs) return;
    const P = this.rp, Q = this.rq, Cn = this.rc, n = 2, h = Math.min(1 / 30, dt) / n; let k = h / this.rh, mv = 0; this.rh = h; this.rt += dt;
    for (let s = 0; s < n; s++) {
      for (let i = 0; i < 13; i++) {
        const o = i * 3, fl = P[o + 1] <= RR[i] + 0.004, d = fl ? 0.86 : 0.994;
        const vx = (P[o] - Q[o]) * k * d, vy = (P[o + 1] - Q[o + 1]) * k * 0.994 - 9.8 * h * h, vz = (P[o + 2] - Q[o + 2]) * k * d;
        Q[o] = P[o]; Q[o + 1] = P[o + 1]; Q[o + 2] = P[o + 2]; P[o] += vx; P[o + 1] += vy; P[o + 2] += vz;
        const v2 = (vx * vx + vy * vy + vz * vz) / (h * h); if (v2 > mv) mv = v2;
      }
      k = 1;
      for (let it = 0; it < 6; it++) {
        for (let c = 0; c < Cn.length; c += 4) {
          const a = Cn[c] * 3, b = Cn[c + 1] * 3, dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2], d = Math.hypot(dx, dy, dz) || 1e-5, t = d < Cn[c + 2] ? Cn[c + 2] : d > Cn[c + 3] ? Cn[c + 3] : d;
          if (t === d) continue; const f = (d - t) / d * 0.5; P[a] += dx * f; P[a + 1] += dy * f; P[a + 2] += dz * f; P[b] -= dx * f; P[b + 1] -= dy * f; P[b + 2] -= dz * f;
        }
        for (let i = 0; i < 13; i++) if (P[i * 3 + 1] < RR[i]) P[i * 3 + 1] = RR[i];
      }
      // 膝蓋只能往前彎、手肘只能往後彎：關節跑到錯的一側就推回「髖—腳」「肩—手」連線上
      const fx = -((P[4] - P[1]) * (P[8] - P[2] + P[11] - P[5]) * 0.5 - (P[5] - P[2]) * (P[7] - P[1] + P[10] - P[4]) * 0.5), fz = -((P[3] - P[0]) * (P[7] - P[1] + P[10] - P[4]) * 0.5 - (P[4] - P[1]) * (P[6] - P[0] + P[9] - P[3]) * 0.5);
      const fy = -((P[5] - P[2]) * (P[6] - P[0] + P[9] - P[3]) * 0.5 - (P[3] - P[0]) * (P[8] - P[2] + P[11] - P[5]) * 0.5), fl = Math.hypot(fx, fy, fz) || 1;
      for (let i = 0; i < 2; i++) for (const [r, j, e2, sg] of [[i, 9 + i, 11 + i, 1], [2 + i, 5 + i, 7 + i, -1]]) {
        const a = r * 3, b = j * 3, c = e2 * 3, dd = ((P[b] - (P[a] + P[c]) / 2) * fx + (P[b + 1] - (P[a + 1] + P[c + 1]) / 2) * fy + (P[b + 2] - (P[a + 2] + P[c + 2]) / 2) * fz) / fl * sg;
        if (dd < 0) { const q = -dd * sg * 0.6 / fl; P[b] += fx * q; P[b + 1] += fy * q; P[b + 2] += fz * q; }
      }
      for (let i = 0; i < 13; i++) { const o = i * 3; _p3.x = P[o]; _p3.y = P[o + 1]; _p3.z = P[o + 2]; if (W.push3(_p3, RR[i] * 0.85)) { P[o] = _p3.x; P[o + 1] = Math.max(RR[i], _p3.y); P[o + 2] = _p3.z; Q[o] += (P[o] - Q[o]) * 0.4; Q[o + 2] += (P[o + 2] - Q[o + 2]) * 0.4; } }
    }
    this.rstill = mv < 0.012 ? this.rstill + dt : 0; if (this.rstill > 0.5 || this.rt > 7) this.rs = true;
    this._ragPose();
  }
  _ragPose() {
    const P = this.rp, V = this.rv; for (let i = 0; i < 13; i++) V[i].set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
    const hm = _a.addVectors(V[0], V[1]).multiplyScalar(0.5), sm = _b.addVectors(V[2], V[3]).multiplyScalar(0.5); _Y.subVectors(sm, hm).normalize();
    const basis = (xa, xb, q) => { _X.subVectors(xb, xa); _Z.crossVectors(_X, _Y).normalize(); _X.crossVectors(_Y, _Z); q.setFromRotationMatrix(_mb.makeBasis(_X, _Y, _Z)); };
    basis(V[0], V[1], this.pelvis.quaternion); this.pelvis.position.copy(hm).addScaledVector(_Y, 0.02);
    basis(V[2], V[3], this.torso.quaternion); this.torso.position.copy(sm).addScaledVector(_Y, -SHY);
    const tq = this.torso.quaternion, pq = this.pelvis.quaternion;
    // 四肢：先轉到父節的空間再求「朝下 → 骨頭方向」的最小旋轉，扭轉才會跟著身體走
    const aim = (parentQ, from, to, out) => { _qi.copy(parentQ).invert(); return out.setFromUnitVectors(DOWN, _d.subVectors(to, from).normalize().applyQuaternion(_qi)); };
    _c.copy(this.torso.position).addScaledVector(_Y, HEAD); _qi.copy(tq).invert(); this.head.quaternion.setFromUnitVectors(UPV, _d.subVectors(V[4], _c).normalize().applyQuaternion(_qi));
    for (let i = 0; i < 2; i++) {
      const ua = this.ua[i], fa = this.fa[i], th = this.th[i], sh = this.sh[i];
      ua.position.set((i ? 1 : -1) * SHX, SHY, 0); aim(tq, V[2 + i], V[5 + i], ua.quaternion);
      _qw.multiplyQuaternions(tq, ua.quaternion); aim(_qw, V[5 + i], V[7 + i], _ql); fa.quaternion.multiplyQuaternions(ua.quaternion, _ql);
      _qi.copy(tq).invert(); fa.position.copy(V[5 + i]).sub(this.torso.position).applyQuaternion(_qi);
      th.position.copy(V[i]); aim(pq, V[i], V[9 + i], _ql); th.quaternion.multiplyQuaternions(pq, _ql);
      sh.position.copy(V[9 + i]); aim(th.quaternion, V[9 + i], V[11 + i], _ql); sh.quaternion.multiplyQuaternions(th.quaternion, _ql);
      this.ft[i].position.copy(V[11 + i]); this.ft[i].quaternion.copy(sh.quaternion);
    }
  }
  dispose() { this.mat.dispose(); this.glow.dispose(); this.gun.geometry.dispose(); this.skel.dispose(); }
}
