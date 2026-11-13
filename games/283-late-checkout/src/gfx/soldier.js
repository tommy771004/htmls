// 士兵：一個帶骨架的 SkinnedMesh。身體用放樣曲面（肩、肘、腰、膝的權重在兩根骨頭之間混合），裝備是綁在單一骨頭上的零件；
// 走跑蹲、舉槍、換彈是程序動畫（四肢用兩節 IK 直接擺骨頭），倒地改由 Verlet 布娃娃接手。
// 模型正面朝 -z（和 sim 的 yaw 定義一致）。
import * as THREE from 'three';
import { gridBox, ambientPatch } from './builder.js';
import { rifleLow } from './weapon.js';
import { latheGeo, tubeGeo } from './geo.js';
import { C, mul } from './props.js';

const PI = Math.PI;
export const TEAM_LOOK = [
  { cloth: C('#2f3a44'), vest: C('#222b32'), gear: C('#353f47'), glow: new THREE.Color(0.2, 2.1, 1.95), css: '#48d6cc', sleeve: C('#2f3a44') },
  { cloth: C('#372f28'), vest: C('#2f1f1b'), gear: C('#2c2622'), glow: new THREE.Color(2.6, 0.8, 0.14), css: '#ff7a33', sleeve: C('#372f28') },
];
const hd = (c, r) => [c[0], c[1], c[2], r]; // 第 4 個分量是粗糙度：布料 0.92（預設）、硬殼／皮革／橡膠較光滑，同時決定皺褶法線貼圖要不要套用
const BOOT = hd(C('#121314'), 0.5), GLOVE = hd(C('#18191b'), 0.72), RUBBER = [0.012, 0.013, 0.015, 0.36], WHITE = [1, 1, 1];
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
        this.pos.push(P[k], P[k + 1], P[k + 2]); this.nor.push(nx / l, ny / l, nz / l); this.uv.push(j / seg * urep, r.y * 5); this.col.push(r.col[0], r.col[1], r.col[2], r.col[3] ?? 0.92); this._w(r.w);
      }
    }
    const tri = (a, b, c) => { if (dir < 0) this.idx.push(base + a, base + b, base + c); else this.idx.push(base + a, base + c, base + b); };
    for (let i = 0; i < nr - 1; i++) for (let j = 0; j < seg; j++) { const a = i * W + j, b = a + 1, c = a + W, d = c + 1; tri(a, b, c); tri(b, d, c); }
    // 封口
    for (const [on, i, sy] of [[o.cap0, 0, -dir], [o.cap1, nr - 1, dir]]) {
      if (!on) continue; const r = rings[i], ci = this.pos.length / 3 - base;
      this.pos.push(r.x, r.y, r.z); this.nor.push(0, sy, 0); this.uv.push(0, r.y * 5); this.col.push(r.col[0], r.col[1], r.col[2], r.col[3] ?? 0.92); this._w(r.w);
      for (let j = 0; j < seg; j++) { const a = i * W + j, b = a + 1; if (i === 0) tri(ci, b, a); else tri(ci, a, b); }
    }
    return this;
  }
  // 剛性零件：整個幾何綁在一根骨頭上
  part(g, bone, col, x, y, z, o = {}) {
    _e4.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ'); g.applyMatrix4(_m4.compose(_p4.set(x, y, z), _q4.setFromEuler(_e4), _s4.set(o.sx || 1, o.sy || 1, o.sz || 1)));
    const base = this.pos.length / 3, Pa = g.attributes.position, Na = g.attributes.normal, Ua = g.attributes.uv, w = [bone, 1];
    for (let i = 0; i < Pa.count; i++) { this.pos.push(Pa.getX(i), Pa.getY(i), Pa.getZ(i)); this.nor.push(Na.getX(i), Na.getY(i), Na.getZ(i)); this.uv.push(Ua ? Ua.getX(i) : 0, Ua ? Ua.getY(i) : 0); this.col.push(col[0], col[1], col[2], col[3] ?? 0.92); this._w(w); }
    if (g.index) for (let i = 0; i < g.index.count; i++) this.idx.push(base + g.index.getX(i)); else for (let i = 0; i < Pa.count; i++) this.idx.push(base + i);
    return this;
  }
  box(bone, col, w, h, d, x, y, z, o = {}) { return this.part(gridBox(w, h, d, { r: o.r || 0, tess: 9, uvs: 0.2, lite: true }), bone, col, x, y, z, o); }
  sph(bone, col, r, x, y, z, o = {}) { return this.part(new THREE.SphereGeometry(r, o.ws || 12, o.hs || 8, 0, 6.2832, o.t0 || 0, o.tl || PI), bone, col, x, y, z, o); }
  cyl(bone, col, rt, rb, h, seg, x, y, z, o = {}) { return this.part(new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open), bone, col, x, y, z, o); }
  // 一次性的環境遮蔽：把身體當成一串球，頂點朝著別的球就壓暗（腋下、胯下、手臂內側、裝備底下）；朝下的面再暗一點
  occlude(balls) {
    const P = this.pos, N = this.nor, Cc = this.col, n = P.length / 3;
    for (let i = 0; i < n; i++) {
      const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2], nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2]; let occ = 0;
      for (let b = 0; b < balls.length; b += 4) {
        const dx = balls[b] - px, dy = balls[b + 1] - py, dz = balls[b + 2] - pz, d2 = dx * dx + dy * dy + dz * dz, c = nx * dx + ny * dy + nz * dz; if (c <= 0) continue;
        const r = balls[b + 3]; occ += c / Math.sqrt(d2) * Math.min(1, r * r / d2);
      }
      const ao = (1 - Math.min(0.5, occ * 0.36)) * (ny < 0 ? 1 + ny * 0.2 : 1);
      Cc[i * 4] *= ao; Cc[i * 4 + 1] *= ao; Cc[i * 4 + 2] *= ao;
    }
    return this;
  }
  // 併頂點：彎管與車削件是展開的三角形，位置、法線、uv、顏色、骨頭都相同的頂點合成一個（蒙皮的頂點數少三到四倍）
  weld() {
    const n = this.pos.length / 3, map = new Map(), re = new Uint32Array(n), q = v => Math.round(v * 4096); let m = 0;
    const P = this.pos, N = this.nor, U = this.uv, Cc = this.col, SI = this.si, SW = this.sw;
    for (let i = 0; i < n; i++) {
      const k = q(P[i * 3]) + ',' + q(P[i * 3 + 1]) + ',' + q(P[i * 3 + 2]) + ',' + Math.round(N[i * 3] * 24) + ',' + Math.round(N[i * 3 + 1] * 24) + ',' + Math.round(N[i * 3 + 2] * 24) + ',' + q(U[i * 2]) + ',' + q(U[i * 2 + 1]) + ',' + q(Cc[i * 4]) + ',' + q(Cc[i * 4 + 3]) + ',' + SI[i * 4] + ',' + SI[i * 4 + 1] + ',' + Math.round(SW[i * 4] * 64);
      let j = map.get(k);
      if (j === undefined) { j = m++; map.set(k, j); if (j !== i) { for (let c = 0; c < 3; c++) { P[j * 3 + c] = P[i * 3 + c]; N[j * 3 + c] = N[i * 3 + c]; } U[j * 2] = U[i * 2]; U[j * 2 + 1] = U[i * 2 + 1]; for (let c = 0; c < 4; c++) { Cc[j * 4 + c] = Cc[i * 4 + c]; SI[j * 4 + c] = SI[i * 4 + c]; SW[j * 4 + c] = SW[i * 4 + c]; } } }
      re[i] = j;
    }
    P.length = N.length = m * 3; U.length = m * 2; Cc.length = SI.length = SW.length = m * 4; for (let i = 0; i < this.idx.length; i++) this.idx[i] = re[this.idx[i]];
    return this;
  }
  build() {
    this.weld(); const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 4)); // rgb＋粗糙度
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
    const { pelvis: P, torso: T, head: H } = BN, neck = hood ? gr : mul(gr, 1.15), grH = hd(gr, 0.5), web = hd(mul(gr, 0.78), 0.8), SOLE = [0.004, 0.004, 0.004, 0.6];
    const tube = (bone, col, path, seg = 6, o) => G.part(tubeGeo(path, seg, o), bone, col, 0, 0, 0);
    const band = (bone, col, y0, y1, rx, rz, x = 0, z = 0, n = 2, seg = 16) => G.loft([R(y1, rx, rz, col, [bone, 1], x, z, n), R((y0 + y1) / 2, rx * 1.012, rz * 1.012, col, [bone, 1], x, z, n), R(y0, rx, rz, col, [bone, 1], x, z, n)], seg); // 一圈織帶／束帶
    // ---- 軀幹：褲襠到脖子，腰部在骨盆與胸腔之間混合；臀部往後、胸口往前 ----
    G.loft([
      R(0.795, 0.06, 0.06, dk, [P, 1]), R(0.84, 0.152, 0.108, cl, [P, 1], 0, 0.008), R(0.90, 0.174, 0.124, cl, [P, 1], 0, 0.01), R(0.955, 0.170, 0.117, cl, [P, 0.8, T, 0.2], 0, 0.004),
      R(1.01, 0.158, 0.11, dk, [P, 0.5, T, 0.5]), R(1.07, 0.154, 0.108, cl, [P, 0.2, T, 0.8]), R(1.16, 0.170, 0.116, cl, [T, 1]),
      R(1.28, 0.188, 0.128, cl, [T, 1], 0, -0.008), R(1.40, 0.194, 0.122, cl, [T, 1], 0, -0.004), R(1.465, 0.158, 0.106, cl, [T, 1]), R(1.505, 0.092, 0.084, cl, [T, 1]),
      R(1.54, 0.06, 0.064, neck, [T, 0.6, H, 0.4]), R(1.61, 0.056, 0.06, neck, [H, 1]),
    ], 22, { cap0: true });
    // 腰帶、帶扣與腰包
    G.loft([R(0.99, 0.176, 0.123, gr, [P, 0.8, T, 0.2], 0, 0.004, 2.5), R(0.983, 0.181, 0.128, gr, [P, 0.8, T, 0.2], 0, 0.004, 2.5), R(0.95, 0.181, 0.128, gr, [P, 1], 0, 0.004, 2.5), R(0.943, 0.176, 0.123, gr, [P, 1], 0, 0.004, 2.5)], 22);
    G.box(P, grH, 0.062, 0.04, 0.014, 0, 0.966, -0.128, { r: 0.007 });
    G.box(P, gr, 0.07, 0.115, 0.05, 0.188, 0.925, 0.0, { r: 0.022 }).box(P, mul(gr, 0.75), 0.074, 0.04, 0.054, 0.188, 0.972, 0.0, { r: 0.018 });       // 側腰包與掀蓋
    G.box(P, gr, 0.09, 0.09, 0.05, -0.13, 0.95, 0.118, { r: 0.022 }).box(P, mul(gr, 0.75), 0.094, 0.034, 0.054, -0.13, 0.99, 0.118, { r: 0.016 });     // 後腰包
    G.part(latheGeo([[0, 0.026], [0.006, 0.034], [0.07, 0.034], [0.078, 0.028], [0.086, 0.016], [0.1, 0.016], [0.1, 0]], 12), P, hd(mul(gr, 1.2), 0.45), 0.15, 0.905, 0.12, { rx: -PI / 2 }); // 水壺
    // ---- 抗彈背心：貼身的殼，前後各一塊圓角防彈板，側面三道織帶 ----
    G.loft([
      R(1.07, 0.13, 0.10, vs, [T, 1], 0, -0.004, 2.6), R(1.085, 0.178, 0.138, vs, [T, 1], 0, -0.006, 2.9), R(1.20, 0.187, 0.147, vs, [T, 1], 0, -0.008, 2.9),
      R(1.33, 0.198, 0.152, vs, [T, 1], 0, -0.012, 2.8), R(1.42, 0.198, 0.142, vs, [T, 1], 0, -0.008, 2.7), R(1.452, 0.17, 0.118, vs, [T, 1], 0, -0.004, 2.4),
    ], 22);
    G.box(T, mul(vs, 1.12), 0.25, 0.2, 0.03, 0, 1.345, -0.15, { r: 0.015 }).box(T, mul(vs, 1.12), 0.27, 0.3, 0.03, 0, 1.28, 0.132, { r: 0.015 });
    for (const y of [1.105, 1.15, 1.195]) band(T, web, y, y + 0.026, 0.1905, 0.15, 0, -0.008, 2.9, 22);
    for (const s of [-1, 1]) tube(T, vs, [[s * 0.118, 1.4, -0.132, 0.03], [s * 0.118, 1.478, -0.085, 0.03], [s * 0.118, 1.506, 0.004, 0.03], [s * 0.118, 1.478, 0.09, 0.03], [s * 0.118, 1.41, 0.13, 0.03]], 8, { up: [0, 1, 0.01], w: 0.5, e: 1.05, sub: 3 }); // 肩帶：一條扁帶繞過肩膀
    for (let i = -1; i <= 1; i++) { // 彈匣袋：圓角袋身、掀蓋、露出的彈匣底
      G.box(T, gr, 0.076, 0.12, 0.044, i * 0.09, 1.17, -0.166, { r: 0.018 }).box(T, mul(gr, 0.72), 0.08, 0.05, 0.048, i * 0.09, 1.222, -0.166, { r: 0.018 });
      G.sph(T, hd(mul(gr, 1.6), 0.4), 0.006, i * 0.09, 1.205, -0.192, { ws: 6, hs: 5 });
    }
    G.box(T, gr, 0.15, 0.085, 0.034, 0.045, 1.36, -0.172, { r: 0.016 }); tube(T, mul(gr, 1.5), [[-0.022, 1.385, -0.19, 0.0025], [0.112, 1.385, -0.19, 0.0025]], 5); // 胸前雜物袋與拉鍊
    G.box(T, hd(mul(gr, 1.4), 0.55), 0.058, 0.105, 0.036, -0.115, 1.365, -0.168, { r: 0.012 });                                                       // 無線電
    tube(T, RUBBER, [[-0.132, 1.41, -0.16, 0.0045], [-0.134, 1.5, -0.152, 0.004], [-0.142, 1.585, -0.125, 0.0032]], 6, { sub: 3 });
    // 背包：圓鼓鼓的包身、頂上捲著的睡墊、下袋、兩條背帶
    G.box(T, gr, 0.27, 0.32, 0.11, 0, 1.275, 0.2, { r: 0.055 });
    tube(T, mul(gr, 1.25), [[-0.118, 1.462, 0.19, 0.041], [0.118, 1.462, 0.19, 0.041]], 12, { sub: 1 });
    for (const s of [-1, 1]) tube(T, mul(gr, 0.7), [[s * 0.07, 1.42, 0.2, 0.007], [s * 0.07, 1.468, 0.238, 0.007], [s * 0.07, 1.5, 0.19, 0.007]], 6, { up: [1, 0, 0], w: 2.2, sub: 3 });
    G.box(T, vs, 0.19, 0.1, 0.06, 0, 1.135, 0.222, { r: 0.028 }).box(T, mul(vs, 0.8), 0.194, 0.036, 0.064, 0, 1.175, 0.222, { r: 0.018 });
    for (const s of [-1, 1]) tube(T, mul(gr, 0.7), [[s * 0.09, 1.42, 0.252, 0.006], [s * 0.09, 1.28, 0.258, 0.006], [s * 0.09, 1.14, 0.25, 0.006]], 6, { up: [1, 0, 0], w: 2.4, sub: 2 });
    // ---- 手臂：三角肌、肘部擠出來的皺褶、束緊的袖口；手是握拳的手套 ----
    for (const s of [-1, 1]) {
      const ua = s < 0 ? BN.uaL : BN.uaR, fa = s < 0 ? BN.faL : BN.faR, x = s * SHX;
      G.loft(fat([
        R(1.498, 0.022, 0.024, cl, [T, 0.5, ua, 0.5], x - s * 0.012), R(1.478, 0.056, 0.058, cl, [T, 0.45, ua, 0.55], x - s * 0.004), R(1.44, 0.068, 0.07, cl, [T, 0.2, ua, 0.8], x + s * 0.006),
        R(1.39, 0.064, 0.066, cl, [ua, 1], x + s * 0.004), R(1.33, 0.056, 0.059, cl, [ua, 1], x), R(1.27, 0.052, 0.055, cl, [ua, 1], x, -0.002), R(1.225, 0.0485, 0.051, cl, [ua, 0.85, fa, 0.15], x),
        R(1.2, 0.051, 0.053, cl, [ua, 0.72, fa, 0.28], x), R(1.18, 0.0465, 0.049, dk, [ua, 0.6, fa, 0.4], x), R(1.16, 0.05, 0.053, cl, [ua, 0.5, fa, 0.5], x, 0.004), R(1.14, 0.046, 0.049, dk, [ua, 0.4, fa, 0.6], x),
        R(1.118, 0.0505, 0.052, cl, [ua, 0.25, fa, 0.75], x), R(1.07, 0.052, 0.053, cl, [fa, 1], x), R(1.0, 0.047, 0.048, cl, [fa, 1], x), R(0.94, 0.041, 0.043, cl, [fa, 1], x),
        R(0.922, 0.043, 0.045, cl, [fa, 1], x), R(0.908, 0.038, 0.04, dk, [fa, 1], x),
        R(0.905, 0.041, 0.043, GLOVE, [fa, 1], x), R(0.885, 0.039, 0.041, GLOVE, [fa, 1], x), R(0.866, 0.031, 0.044, GLOVE, [fa, 1], x), R(0.84, 0.026, 0.047, GLOVE, [fa, 1], x), R(0.82, 0.023, 0.046, GLOVE, [fa, 1], x), R(0.806, 0.016, 0.04, GLOVE, [fa, 1], x),
      ], 1.2), 14, { cap0: true, cap1: true });
      band(fa, mul(GLOVE, 1.6), 0.884, 0.898, 0.052, 0.054, x, 0, 2, 14);                                   // 手套腕帶
      for (let i = 0; i < 4; i++) { const z = -0.039 + i * 0.026, k = i === 3 ? 0.86 : 1; // 四指：往掌心勾
        tube(fa, GLOVE, [[x, 0.822, z, 0.0125 * k], [x - s * 0.004, 0.792, z, 0.0122 * k], [x - s * 0.02, 0.77 + (1 - k) * 0.06, z, 0.0115 * k], [x - s * 0.037, 0.784, z, 0.0105 * k], [x - s * 0.04, 0.806, z, 0.0092 * k]], 6, { sub: 2 }); }
      tube(fa, GLOVE, [[x - s * 0.006, 0.868, -0.046, 0.0145], [x - s * 0.016, 0.842, -0.062, 0.0135], [x - s * 0.034, 0.818, -0.056, 0.0112]], 6, { sub: 2 });                 // 拇指
      tube(fa, hd(mul(GLOVE, 2.2), 0.45), [[x + s * 0.033, 0.835, -0.044, 0.008], [x + s * 0.036, 0.838, 0, 0.0095], [x + s * 0.033, 0.835, 0.044, 0.008]], 6, { up: [s, 0, 0], w: 0.6, e: 1.6, sub: 2 }); // 指節護片
      G.sph(fa, grH, 0.066, x, 1.135, 0.04, { sx: 0.82, sy: 1.05, sz: 0.52, ws: 12, hs: 8 });               // 護肘：一片弧形的殼
      band(fa, mul(gr, 0.7), 1.165, 1.181, 0.061, 0.064, x, 0, 2, 14); band(fa, mul(gr, 0.7), 1.09, 1.106, 0.063, 0.064, x, 0, 2, 14);
      G.sph(ua, hd(t ? vs : gr, 0.6), 0.058, x + s * 0.046, 1.37, 0, { sx: 0.5, sy: 0.95, sz: 0.92, ws: 12, hs: 8 }); // 臂章底下的肩甲
    }
    // ---- 腿：大腿前側與小腿肚鼓起、膝蓋的皺褶、紮進靴筒的褲腳 ----
    for (const s of [-1, 1]) {
      const th = s < 0 ? BN.thL : BN.thR, sh = s < 0 ? BN.shL : BN.shR, ft = s < 0 ? BN.ftL : BN.ftR, x = s * HX;
      G.loft(fat([
        R(0.97, 0.05, 0.06, cl, [P, 1], x * 0.8), R(0.93, 0.082, 0.098, cl, [P, 0.7, th, 0.3], x * 0.95, 0.004), R(0.87, 0.091, 0.106, cl, [P, 0.3, th, 0.7], x, 0.004), R(0.79, 0.088, 0.1, cl, [th, 1], x, -0.004),
        R(0.7, 0.08, 0.09, cl, [th, 1], x, -0.006), R(0.61, 0.071, 0.079, cl, [th, 1], x, -0.004), R(0.545, 0.065, 0.071, cl, [th, 0.85, sh, 0.15], x), R(0.515, 0.068, 0.073, cl, [th, 0.75, sh, 0.25], x),
        R(0.49, 0.062, 0.068, dk, [th, 0.6, sh, 0.4], x), R(0.465, 0.066, 0.071, cl, [th, 0.5, sh, 0.5], x, -0.006), R(0.44, 0.061, 0.066, dk, [th, 0.4, sh, 0.6], x), R(0.41, 0.063, 0.068, cl, [th, 0.2, sh, 0.8], x),
        R(0.35, 0.064, 0.072, cl, [sh, 1], x, 0.01), R(0.29, 0.06, 0.068, cl, [sh, 1], x, 0.01), R(0.23, 0.053, 0.059, cl, [sh, 1], x, 0.004), R(0.196, 0.057, 0.063, cl, [sh, 1], x), R(0.178, 0.053, 0.059, dk, [sh, 1], x),
        R(0.175, 0.055, 0.061, BOOT, [sh, 1], x), R(0.165, 0.056, 0.062, BOOT, [sh, 1], x), R(0.07, 0.05, 0.057, BOOT, [sh, 1], x), R(0.045, 0.05, 0.058, BOOT, [sh, 0.5, ft, 0.5], x, -0.004),
      ], 1.14, 1.18), 16, { cap0: true });
      // 靴子：由上往下一層層的鞋形切片（腳骨在腳踝，鞋底在骨頭下方 0.085）
      G.loft([
        R(0.05, 0.057, 0.069, BOOT, [sh, 0.4, ft, 0.6], x, -0.006, 2.1), R(0.022, 0.056, 0.078, BOOT, [ft, 1], x, -0.018, 2.2), R(0.002, 0.056, 0.1, BOOT, [ft, 1], x, -0.038, 2.3), R(-0.016, 0.057, 0.124, BOOT, [ft, 1], x, -0.056, 2.9),
        R(-0.034, 0.059, 0.137, BOOT, [ft, 1], x, -0.064, 3.3), R(-0.047, 0.06, 0.14, BOOT, [ft, 1], x, -0.064, 3.4), R(-0.049, 0.0635, 0.144, SOLE, [ft, 1], x, -0.064, 3.5), R(-0.066, 0.062, 0.1425, SOLE, [ft, 1], x, -0.064, 3.5),
      ], 16, { cap1: true });
      for (let k = 0; k < 4; k++) { const y = -0.004 + k * 0.014, z = -0.128 + k * 0.019; tube(ft, mul(BOOT, 2.2), [[x - 0.03, y - 0.006, z + 0.004, 0.0035], [x, y + 0.004, z, 0.0035], [x + 0.03, y - 0.006, z + 0.004, 0.0035]], 5, { sub: 2 }); } // 鞋帶
      G.box(th, mul(cl, 0.85), 0.036, 0.15, 0.12, x + s * 0.092, 0.6, 0.005, { r: 0.018 }).box(th, mul(cl, 0.7), 0.04, 0.05, 0.126, x + s * 0.092, 0.662, 0.005, { r: 0.018 }); // 大腿口袋與袋蓋
      G.sph(th, hd(mul(cl, 1.5), 0.5), 0.006, x + s * 0.112, 0.648, 0.005, { ws: 6, hs: 5 });
      // 護膝：弧形軟墊＋硬殼，上下兩條束帶
      G.sph(sh, hd(mul(gr, 0.85), 0.75), 0.082, x, 0.44, -0.048, { sx: 0.84, sy: 1.02, sz: 0.56, ws: 14, hs: 9 }).sph(sh, hd(mul(gr, 1.25), 0.38), 0.058, x, 0.446, -0.074, { sx: 0.86, sy: 0.96, sz: 0.5, ws: 12, hs: 8 });
      band(sh, mul(gr, 0.7), 0.392, 0.412, 0.0745, 0.082, x, 0, 2, 16); band(sh, mul(gr, 0.7), 0.482, 0.5, 0.078, 0.086, x, 0, 2, 16);
      if (s > 0) { // 腿掛槍套與手槍握把
        G.box(th, grH, 0.048, 0.17, 0.105, x + 0.115, 0.765, 0.0, { r: 0.024 }).box(th, [0.02, 0.02, 0.022, 0.5], 0.03, 0.075, 0.046, x + 0.118, 0.87, 0.028, { r: 0.014, rx: 0.3 });
        band(th, mul(gr, 0.7), 0.79, 0.812, 0.105, 0.122, x, 0, 2, 16); band(th, mul(gr, 0.7), 0.71, 0.73, 0.097, 0.112, x, 0, 2, 16);
      }
    }
    // ---- 頭 ----
    const hy = 1.68, arc = (a0, a1, n, rx, rz, y, r, z0 = 0) => { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([Math.sin(a) * rx, y, z0 - Math.cos(a) * rz, r]); } return o; }; // 繞著頭的一段弧（0 = 正前方）
    if (!hood) { // 先鋒：頭盔、護目鏡、通訊耳機
      G.sph(H, mul(gr, 1.25), 0.098, 0, hy, 0, { sy: 1.14, ws: 16, hs: 12 });
      G.sph(H, hd(gr, 0.46), 0.121, 0, hy + 0.028, 0.008, { sy: 0.9, sz: 1.09, tl: PI * 0.57, ws: 24, hs: 12 });
      G.loft([R(hy + 0.016, 0.1215, 0.132, hd(mul(gr, 0.75), 0.5), [H, 1], 0, 0.008), R(hy + 0.008, 0.126, 0.1365, hd(mul(gr, 0.75), 0.5), [H, 1], 0, 0.008), R(hy - 0.002, 0.1225, 0.133, hd(mul(gr, 0.75), 0.5), [H, 1], 0, 0.008)], 24); // 盔緣
      for (const s of [-1, 1]) {
        tube(H, hd(mul(gr, 0.7), 0.5), [[s * 0.115, hy + 0.052, -0.07, 0.006], [s * 0.1235, hy + 0.047, 0.004, 0.0065], [s * 0.116, hy + 0.052, 0.076, 0.006]], 6, { up: [0, 1, 0], w: 2, sub: 3 }); // 側軌
        G.sph(H, RUBBER, 0.047, s * 0.106, hy - 0.014, 0.006, { sx: 0.5, sy: 1.0, sz: 0.82, ws: 12, hs: 8 });  // 耳罩
      }
      G.box(H, hd(mul(gr, 0.7), 0.5), 0.05, 0.042, 0.024, 0, hy + 0.098, -0.117, { r: 0.011, rx: 0.3 });        // 夜視鏡座
      tube(H, mul(gr, 0.6), arc(1.0, PI * 2 - 1.0, 9, 0.127, 0.139, hy + 0.03, 0.0045, 0.008), 5, { up: [0, 1, 0], w: 3.2, sub: 2 }); // 護目鏡帶子繞過盔後
      tube(H, RUBBER, arc(-1.12, 1.12, 6, 0.094, 0.1, hy + 0.006, 0.019), 8, { up: [0, 1, 0], w: 1.55, e: 0.8, sub: 3 });            // 護目鏡框：沿著臉彎
      tube(H, [0.03, 0.05, 0.055, 0.1], arc(-0.8, 0.8, 5, 0.096, 0.108, hy + 0.006, 0.0125), 8, { up: [0, 1, 0], w: 1.6, e: 0.55, sub: 3 }); // 鏡片
      G.sph(H, vs, 0.072, 0, hy - 0.058, -0.044, { sx: 1.0, sy: 0.82, sz: 0.92, ws: 14, hs: 9 });               // 面巾
      tube(H, mul(gr, 0.6), [[-0.1, hy - 0.015, 0.0, 0.0045], [-0.074, hy - 0.098, -0.03, 0.0045], [0, hy - 0.128, -0.058, 0.0045], [0.074, hy - 0.098, -0.03, 0.0045], [0.1, hy - 0.015, 0.0, 0.0045]], 5, { sub: 3 }); // 下巴帶
      tube(H, RUBBER, [[-0.104, hy - 0.03, -0.012, 0.004], [-0.098, hy - 0.07, -0.058, 0.004], [-0.062, hy - 0.078, -0.098, 0.004]], 5, { sub: 3 }); G.sph(H, RUBBER, 0.012, -0.055, hy - 0.077, -0.103, { ws: 8, hs: 6, sx: 1.3 }); // 麥克風
      for (const s of [-1, 1]) GL.box(H, WHITE, 0.01, 0.03, 0.05, s * 0.128, hy + 0.068, -0.02);
      for (const s of [-1, 1]) GL.box(T, WHITE, 0.05, 0.01, 0.09, s * 0.118, 1.522, 0.0);
      GL.box(T, WHITE, 0.1, 0.02, 0.01, -0.06, 1.42, -0.166);
    } else { // 餘燼：兜帽、濾罐面罩
      G.sph(H, gr, 0.1, 0, hy, 0, { sy: 1.14, ws: 16, hs: 12 });
      G.sph(H, vs, 0.127, 0, hy + 0.02, 0.022, { sy: 1.06, sz: 1.05, tl: PI * 0.64, ws: 24, hs: 12, rx: 0.42 });
      G.loft([R(1.62, 0.112, 0.118, vs, [H, 1], 0, 0.02), R(1.585, 0.134, 0.126, vs, [H, 0.75, T, 0.25], 0, 0.018), R(1.555, 0.15, 0.13, vs, [T, 0.5, H, 0.5], 0, 0.014), R(1.525, 0.178, 0.134, mul(vs, 0.9), [T, 0.8, H, 0.2], 0, 0.01), R(1.50, 0.198, 0.137, mul(vs, 0.85), [T, 1], 0, 0.008), R(1.47, 0.207, 0.141, mul(vs, 0.8), [T, 1], 0, 0.006)], 22); // 披在肩上的兜帽下襬
      { const rim = []; for (let i = 0; i <= 10; i++) { const a = -2.6 + 5.2 * i / 10; rim.push([Math.sin(a) * 0.097, hy + 0.012 + Math.cos(a) * 0.112, -0.062 - Math.cos(a) * 0.022 + Math.abs(Math.sin(a)) * 0.03, 0.013]); } tube(H, mul(vs, 0.82), rim, 6, { sub: 2 }); } // 兜帽開口的捲邊
      G.sph(H, RUBBER, 0.078, 0, hy - 0.022, -0.058, { sy: 1.16, sz: 0.74, ws: 18, hs: 12 }).sph(H, RUBBER, 0.042, 0, hy - 0.064, -0.096, { sx: 1.05, sy: 0.9, sz: 0.8, ws: 12, hs: 8 }); // 面罩與口鼻罩
      for (const s of [-1, 1]) G.part(latheGeo([[0, 0.028], [0.006, 0.0325], [0.012, 0.0325], [0.0145, 0.028], [0.0145, 0]], 16), H, [0.05, 0.045, 0.04, 0.35], s * 0.037, hy + 0.012, -0.1, { rx: PI, ry: s * -0.3 }); // 鏡框
      G.part(latheGeo([[0, 0.026], [0.006, 0.036], [0.02, 0.036], [0.022, 0.0335], [0.026, 0.0335], [0.028, 0.036], [0.042, 0.036], [0.044, 0.0335], [0.048, 0.0335], [0.05, 0.036], [0.058, 0.036], [0.062, 0.03], [0.062, 0]], 16), H, [0.07, 0.055, 0.04, 0.4], -0.028, hy - 0.064, -0.092, { rx: 0.467, ry: 3.545 }); // 濾罐
      G.part(latheGeo([[0, 0.026], [0.012, 0.03], [0.02, 0.03], [0.022, 0.024], [0.022, 0]], 14), H, RUBBER, 0.032, hy - 0.07, -0.102, { rx: PI, ry: -0.35 });                                 // 呼氣閥
      tube(H, RUBBER, [[0.07, hy + 0.0, -0.05, 0.006], [0.098, hy + 0.002, 0.0, 0.006], [0.085, hy + 0.004, 0.06, 0.006]], 5, { up: [0, 1, 0], w: 2.2, sub: 2 }); tube(H, RUBBER, [[-0.07, hy + 0.0, -0.05, 0.006], [-0.098, hy + 0.002, 0.0, 0.006], [-0.085, hy + 0.004, 0.06, 0.006]], 5, { up: [0, 1, 0], w: 2.2, sub: 2 }); // 面罩頭帶
      for (const s of [-1, 1]) GL.cyl(H, WHITE, 0.022, 0.022, 0.006, 14, s * 0.0395, hy + 0.012, -0.1165, { rx: PI / 2, ry: s * -0.3 });
      GL.box(T, WHITE, 0.012, 0.16, 0.01, 0.142, 1.285, 0.262);
    }
    // 遮蔽用的球（綁定姿勢）：軀幹、頭、背包、彈匣袋、兩臂、兩腿、護膝
    const balls = [0, 0.9, 0, 0.16, 0, 1.05, 0, 0.15, 0, 1.2, 0.01, 0.17, 0, 1.34, 0.01, 0.185, 0, 1.45, 0, 0.15, 0, hy, 0, 0.125, 0, 1.28, 0.2, 0.13, 0, 1.18, -0.165, 0.07];
    for (const sd of [-1, 1]) { for (const y of [1.4, 1.28, 1.16, 1.04, 0.92]) balls.push(sd * SHX * 1.03, y, 0, 0.066); for (const y of [0.85, 0.7, 0.55, 0.4, 0.25, 0.1]) balls.push(sd * HX * 1.05, y, 0, y > 0.5 ? 0.09 : 0.068); balls.push(sd * HX, 0.44, -0.06, 0.06); }
    return { body: G.occlude(balls).build(), glow: GL.build() };
  });
  return GEO;
}

// 布娃娃的點：0/1 髖、2/3 肩、4 頭、5/6 肘、7/8 手、9/10 膝、11/12 腳（左、右）
const RR = [0.12, 0.12, 0.13, 0.13, 0.115, 0.055, 0.055, 0.05, 0.05, 0.07, 0.07, 0.065, 0.065], IW = [0.45, 0.45, 0.45, 0.45, 0.9, 1.3, 1.3, 1.7, 1.7, 1.0, 1.0, 1.3, 1.3], KICK = [0.9, 0.9, 2.3, 2.3, 2.9, 1.5, 1.5, 1.1, 1.1, 0.4, 0.4, 0, 0];
const BLADE = 0.6;
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

// 身體材質的補丁：頂點色 alpha＝粗糙度；硬殼（alpha 低）不套皺褶法線。接在 ambientPatch 後面
// 另外把探針的均勻環境光改成「主光方向（uKey）的半蘭伯特＋上亮下暗」：只有均勻環境光時，圓的東西看起來也是平的
function skinPatch(mat, skin = true) {
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = function (sh) {
    base.call(this, sh); sh.uniforms.uKey = this.userData.uKey;
    sh.fragmentShader = sh.fragmentShader.replace('uniform vec3 uProbe;', 'uniform vec3 uProbe; uniform vec3 uKey;')
      .replace('vec3 bakeL = uProbe;', 'vec3 wn = inverseTransformDirection(normal, viewMatrix); float ks = length(uKey), kf = 0.5 + 0.5 * dot(wn, uKey / max(ks, 1e-4));\nvec3 bakeL = uProbe * (0.86 + 0.2 * wn.y) * mix(1.0, 0.42 + 1.3 * kf * kf, min(1.0, ks * 1.15));');
    if (skin) sh.fragmentShader = sh.fragmentShader
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * vColor.a, 0.05, 1.0);')
      .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * smoothstep(0.55, 0.85, vColor.a);'));
  };
  mat.customProgramCacheKey = () => skin ? 'amb-probe-skin' : 'amb-probe-key';
  return mat;
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
    this.mat = skinPatch(ambientPatch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map: Tx.cloth.map, normalMap: Tx.cloth.normalMap, normalScale: new THREE.Vector2(1.0, 1.0), envMapIntensity: 0.6, color: new THREE.Color(1.25, 1.25, 1.25) }), 'probe')); this.mat.userData.uKey = { value: new THREE.Vector3(0, 0.3, 0) };
    this.glow = new THREE.MeshBasicMaterial({ color: L.glow.clone() });
    const skin = (g, mat, shadow) => { const m = new THREE.SkinnedMesh(g, mat); m.frustumCulled = false; m.castShadow = shadow; m.receiveShadow = shadow; this.body.add(m); m.bind(this.skel, new THREE.Matrix4()); return m; };
    this.mesh = skin(G.body, this.mat, true); this.glowMesh = skin(G.glow, this.glow, false);
    // 槍用自己的材質（半金屬、較光滑），探針光和身體共用同一個 uniform
    this.gunMat = skinPatch(ambientPatch(new THREE.MeshStandardMaterial({ vertexColors: true, color: new THREE.Color(0.4, 0.4, 0.42), roughness: 0.42, metalness: 0.5, envMapIntensity: 0.9 }), 'probe'), false); this.gunMat.userData.uProbe = this.mat.userData.uProbe; this.gunMat.userData.uKey = this.mat.userData.uKey;
    this.head.rotation.order = 'YXZ'; this.reach = [0, 0];
    const r = rifleLow(e.loadout); this.gun = new THREE.Mesh(r.geo, this.gunMat); this.gun.castShadow = true; this.torso.add(this.gun); this.gunInfo = r.info;
    this.phase = Math.random() * 6; this.flinch = 0; this.probeT = Math.random() * 0.2; this.rag = false; this.aim = 1; this.seed = Math.random();
    this.col = new THREE.Color(); this.muz = new THREE.Vector3(); this.keyT = new THREE.Vector3(0, 0.3, 0);
  }
  // 槍口的世界座標
  muzzle(out) { return this.gun.localToWorld(out.set(0, 0.045, this.gunInfo.muzzleZ)); }
  update(dt, g, lights) {
    const e = this.e, grp = this.group, dead = !e.alive;
    this.probeT -= dt; if (this.probeT <= 0) { this.probeT = 0.18; if (this.rag) lights.probe(this.pelvis.position.x, 0.45, this.pelvis.position.z, this.col, this.keyT); else lights.probe(e.x, e.y + 1.1, e.z, this.col, this.keyT); this.mat.userData.uProbe.value.lerp(this.col, 0.6); }
    this.mat.userData.uKey.value.lerp(this.keyT, Math.min(1, dt * 5));
    if (dead) { if (!this.rag) this._ragStart(); this._ragStep(dt, g.world); return; }
    if (this.rag) this._ragEnd();
    grp.position.set(e.x, e.y, e.z); grp.rotation.y = e.yaw;
    const cr = e.crouch;
    // 速度（局部）
    const sy = Math.sin(e.yaw), cy = Math.cos(e.yaw), lvx = e.vx * cy - e.vz * sy, lvz = e.vx * sy + e.vz * cy, sp = Math.hypot(lvx, lvz), mv = Math.min(1, sp / 4);
    this.phase += dt * (sp > 0.3 ? 2.2 + sp * 1.25 : 0);
    const run = e.sprint, hipY = HIP - 0.34 * cr - mv * 0.03 + Math.abs(Math.sin(this.phase)) * 0.035 * mv;
    this.flinch += (0 - this.flinch) * Math.min(1, dt * 9);
    this.pelvis.position.set(0, hipY, 0); const B = BLADE * (1 - run * 0.6); // 持槍時身體側過去（左肩在前），衝刺時轉正一些
    this.pelvis.rotation.set(-cr * 0.2, -B * 0.5 + Math.sin(this.phase) * 0.12 * mv, 0);
    const lean = cr * 0.34 + run * 0.3 + mv * 0.06, pitch = e.pitch;
    this.torso.position.set(0, hipY + 0.07, 0.0 + cr * 0.03); this.torso.rotation.set(pitch * 0.45 - lean - this.flinch * 0.25, -B - Math.sin(this.phase) * 0.1 * mv, Math.sin(this.phase) * 0.03 * mv);
    this.head.rotation.set(pitch * 0.35 + lean * 0.6 + 0.1 * this.aim, B * 0.92, -0.1 * this.aim); // 頭轉回正前方，稍微歪向槍托
    // 腿
    const ux = sp > 0.01 ? lvx / sp : 0, uz = sp > 0.01 ? lvz / sp : -1, stride = Math.min(0.42, sp * 0.085), lift = Math.min(0.16, sp * 0.04);
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1, ph = this.phase + i * PI, sw = Math.sin(ph), up = Math.max(0, Math.cos(ph));
      _a.set(s * HX, hipY - 0.02, 0);
      const spread = 0.11 + cr * 0.07;
      const tgt = new THREE.Vector3(s * spread + ux * sw * stride, 0.085 + up * lift * (sp > 0.3 ? 1 : 0), -0.02 + uz * sw * stride + cr * (i ? 0.16 : -0.18) + (i ? 0.09 : -0.09) * (1 - mv) * (1 - cr)); // 站定時左腳在前
      _pole.set(s * (0.1 + cr * 0.25), 0, -1);
      ik2(_a.clone(), tgt, TH, SH, _pole, this.th[i], this.sh[i]);
      this.ft[i].position.copy(tgt); this.ft[i].rotation.set(up * 0.5 * mv * (uz < 0 ? 1 : -1), i ? -0.12 - B * 0.45 : 0.1, 0);
    }
    // 槍與手（都在胸腔空間）
    const rel = e.reloadT > 0 ? 1 - e.reloadT / e.w.reload : -1, relK = rel >= 0 ? Math.sin(Math.min(1, rel * 1.2) * PI) : 0;
    this.aim += ((run > 0.5 ? 0 : 1) - this.aim) * Math.min(1, dt * 8); const am = this.aim;
    // 槍托抵在右肩窩，槍在胸腔空間裡往左偏 B：身體側過去了，槍仍指向正前方。位置由「槍托這一點固定在肩上」反推
    this.gun.rotation.set(pitch * 0.55 * am - (1 - am) * 0.55 + relK * 0.4 - this.flinch * 0.15, B + (1 - am) * 0.45, (1 - am) * 0.25 - relK * 0.3, 'YXZ');
    _b.set(0, 0, 0.31).applyQuaternion(this.gun.quaternion);
    this.gun.position.set(0.165 - (1 - am) * 0.03, 0.435 - (1 - am) * 0.1 - relK * 0.04, -0.075).sub(_b);
    this.gun.updateMatrix();
    const gp = (x, y, z, out) => out.set(x, y, z).applyMatrix4(this.gun.matrix);
    const hr = gp(0, -0.06, 0.04, new THREE.Vector3()), hl = gp(0, 0.005 - relK * 0.14, -0.24 + relK * 0.14, new THREE.Vector3());
    for (let i = 0; i < 2; i++) { // 手肘朝下、微微往外，不要橫著撐開
      const sd = i ? 1 : -1, tg = i ? hr : hl; _a.set(sd * SHX, SHY, 0); this.reach[i] = _a.distanceTo(tg);
      if (i) _pole.set(0.55, -1, 0.35); else _pole.set(-0.25, -1, 0.1);
      ik2(_a.clone(), tg, UA, FA + 0.05, _pole, this.ua[i], this.fa[i]);
    }
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
    this.rsn = this.rsn || new Float32Array(39); this.rsn.set(P); this.rwin = 0;
    this.rag = true; this.rs = false; this.rt = 0; this.rstill = 0; this.slip = 0; this.nudge = 0; this.nsign = Math.random() < 0.5 ? -1 : 1; this.sup = 0; this._ragPose();
  }
  _ragEnd() { this.rag = false; const G = this.gun; this.torso.add(G); G.scale.set(1, 1, 1); for (let i = 0; i < 2; i++) this.ft[i].quaternion.identity(); }
  wake() { if (this.rag && this.rs) { this.rs = false; this.rstill = 0; this.rwin = 0; this.nudge = 0; this.rt = Math.min(this.rt, 1); } } // rt 要壓到「加重阻尼」的門檻以下，不然掉不下來
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
    const calm = this.rt > 3.5 && this.slip < 0 ? 0.9 : 1; // 躺了一陣子還在抖（卡在家具縫裡）就加重阻尼讓它停
    for (let s = 0; s < n; s++) {
      for (let i = 0; i < 13; i++) {
        const o = i * 3, fl = P[o + 1] <= RR[i] + 0.004 || (this.sup >> i & 1), d = (fl ? (this.slip > 0 ? 0.975 : 0.86) : 0.994) * calm;
        let vx = (P[o] - Q[o]) * k * d, vy = (P[o + 1] - Q[o + 1]) * k * 0.994 * calm - 9.8 * h * h, vz = (P[o + 2] - Q[o + 2]) * k * d;
        const vl = Math.hypot(vx, vy, vz); if (vl > 0.09) { const c = 0.09 / vl; vx *= c; vy *= c; vz *= c; } // 一步最多走 9 cm，才不會穿牆
        Q[o] = P[o]; Q[o + 1] = P[o + 1]; Q[o + 2] = P[o + 2]; P[o] += vx; P[o + 1] += vy; P[o + 2] += vz;
        const v2 = (vx * vx + vy * vy + vz * vz) / (h * h); if (v2 > mv) mv = v2;
      }
      k = 1;
      for (let it = 0; it < 6; it++) {
        for (let c = 0; c < Cn.length; c += 4) {
          const a = Cn[c] * 3, b = Cn[c + 1] * 3, dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2], d = Math.hypot(dx, dy, dz) || 1e-5, t = d < Cn[c + 2] ? Cn[c + 2] : d > Cn[c + 3] ? Cn[c + 3] : d;
          if (t === d) continue; const wa = IW[Cn[c]], wb = IW[Cn[c + 1]], f = (d - t) / d / (wa + wb), fa = f * wa, fb = f * wb; P[a] += dx * fa; P[a + 1] += dy * fa; P[a + 2] += dz * fa; P[b] -= dx * fb; P[b + 1] -= dy * fb; P[b + 2] -= dz * fb;
        }
        for (let i = 0; i < 13; i++) if (P[i * 3 + 1] < RR[i]) P[i * 3 + 1] = RR[i];
      }
      // 關節角度限制，都在身體座標（X 右、Y 沿脊椎往頭、F 正面）裡判斷，超過就把關節的下一節推回界線上
      let Xx = P[3] - P[0] + P[9] - P[6], Xy = P[4] - P[1] + P[10] - P[7], Xz = P[5] - P[2] + P[11] - P[8], Yx = P[6] - P[0] + P[9] - P[3], Yy = P[7] - P[1] + P[10] - P[4], Yz = P[8] - P[2] + P[11] - P[5];
      let l = Math.hypot(Yx, Yy, Yz) || 1; Yx /= l; Yy /= l; Yz /= l; l = Xx * Yx + Xy * Yy + Xz * Yz; Xx -= Yx * l; Xy -= Yy * l; Xz -= Yz * l; l = Math.hypot(Xx, Xy, Xz) || 1; Xx /= l; Xy /= l; Xz /= l;
      const Fx = Yy * Xz - Yz * Xy, Fy = Yz * Xx - Yx * Xz, Fz = Yx * Xy - Yy * Xx;
      // mvp：連上一步的位置一起移，只改位置、不會變成速度灌進去（否則腿會被甩上天）
      const mvp = (o, ax, ay, az, q) => { P[o] += ax * q; P[o + 1] += ay * q; P[o + 2] += az * q; Q[o] += ax * q; Q[o + 1] += ay * q; Q[o + 2] += az * q; };
      // turn：把骨頭（方向 d）朝 (ax,ay,az) 轉回界線內。只取垂直於骨頭的分量＝繞著關節轉，沿骨頭方向推只會被長度約束拉回來；
      // 軀幹四個點依質量比往反方向退，整個人的重心不變，才不會在地上「爬」。一步最多 2 cm。
      const turn = (j, j2, dx, dy, dz, ax, ay, az, viol, len, sd) => {
        let k = ax * dx + ay * dy + az * dz, tx = ax - dx * k, ty = ay - dy * k, tz = az - dz * k, tl = Math.hypot(tx, ty, tz);
        if (tl < 0.3) { k = (Xx * dx + Xy * dy + Xz * dz) * sd; tx += (Xx * sd - dx * k) * 0.6; ty += (Xy * sd - dy * k) * 0.6; tz += (Xz * sd - dz * k) * 0.6; tl = Math.hypot(tx, ty, tz); if (tl < 1e-4) return; } // 幾乎正對著界線反方向：從外側繞過去
        const q = Math.min(0.02, viol * len * 0.35) / tl, c = -q * (1 / IW[j / 3] + 0.7 / IW[j2 / 3]) * 0.1125;
        mvp(j, tx, ty, tz, q); mvp(j2, tx, ty, tz, q * 0.7); for (let t = 0; t < 12; t += 3) mvp(t, tx, ty, tz, c);
      };
      for (let i = 0; i < 2; i++) {
        const sd = i ? 1 : -1;
        for (let limb = 0; limb < 2; limb++) { // 0＝腿（髖→膝→腳）、1＝手（肩→肘→手）
          const r = (limb ? 2 + i : i) * 3, j = (limb ? 5 + i : 9 + i) * 3, e2 = (limb ? 7 + i : 11 + i) * 3, len = limb ? UA : TH;
          let dx = P[j] - P[r], dy = P[j + 1] - P[r + 1], dz = P[j + 2] - P[r + 2]; const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
          const cf = dx * Fx + dy * Fy + dz * Fz, cy = dx * Yx + dy * Yy + dz * Yz, cx = (dx * Xx + dy * Xy + dz * Xz) * sd;
          if (limb === 0) {
            if (cy > 0.4) turn(j, e2, dx, dy, dz, -Yx, -Yy, -Yz, cy - 0.4, len, sd);                          // 大腿往上抬不超過約 115°
            else if (cf < -0.3) turn(j, e2, dx, dy, dz, Fx, Fy, Fz, -0.3 - cf, len, sd);                      // 大腿往後伸不超過約 17°
            if (cx < -0.25) turn(j, e2, dx, dy, dz, Xx * sd, Xy * sd, Xz * sd, -0.25 - cx, len, sd);          // 兩腿不交叉
            else if (cx > 0.7) turn(j, e2, dx, dy, dz, -Xx * sd, -Xy * sd, -Xz * sd, cx - 0.7, len, sd);      // 外展不超過約 45°
          } else {
            if (cf < -0.55) turn(j, e2, dx, dy, dz, Fx, Fy, Fz, -0.55 - cf, len, sd);                         // 上臂往後不超過約 35°
            if (cx < -0.55) turn(j, e2, dx, dy, dz, Xx * sd, Xy * sd, Xz * sd, -0.55 - cx, len, sd);          // 上臂不穿過胸口
          }
          // 膝蓋只能往前彎、手肘只能往後彎：關節跑到錯的一側就推回「髖—腳」「肩—手」連線上
          const sg = limb ? -1 : 1, dd = ((P[j] - (P[r] + P[e2]) / 2) * Fx + (P[j + 1] - (P[r + 1] + P[e2 + 1]) / 2) * Fy + (P[j + 2] - (P[r + 2] + P[e2 + 2]) / 2) * Fz) * sg;
          if (dd < -0.05) { const q = (-0.05 - dd) * sg * 0.5, // 留 5 cm 的餘裕：平躺時膝、肘本來就比髖、肩貼地
            c = -q / IW[j / 3] / (1 / IW[r / 3] + 1 / IW[e2 / 3]); mvp(j, Fx, Fy, Fz, q); mvp(r, Fx, Fy, Fz, c); mvp(e2, Fx, Fy, Fz, c); }
        }
      }
      this.sup = 0;
      for (let i = 0; i < 13; i++) { const o = i * 3; _p3.x = P[o]; _p3.y = P[o + 1]; _p3.z = P[o + 2]; if (W.push3(_p3, RR[i] * 0.85)) { if (_p3.y > P[o + 1] + 1e-4) this.sup |= 1 << i; P[o] = _p3.x; P[o + 1] = Math.max(RR[i], _p3.y); P[o + 2] = _p3.z; Q[o] += (P[o] - Q[o]) * 0.4; Q[o + 2] += (P[o + 2] - Q[o + 2]) * 0.4; } }
    }
    this.slip -= dt;
    // 靜止判定看「0.35 秒內姿勢淨位移」而不是瞬間速度：關節限制頂著重力時位置不動，但 Verlet 的速度項不會是零
    this.rwin += dt;
    if (this.rwin >= 0.35) { const S = this.rsn; let dm = 0; for (let i = 0; i < 39; i++) { const d = Math.abs(P[i] - S[i]); if (d > dm) dm = d; S[i] = P[i]; } this.rstill = dm < (this.rt < 3 ? 0.006 : 0.02) ? this.rstill + this.rwin : 0; /* 3 秒後還在慢慢滑的也算停 */ this.rwin = 0; }
    // 跪著或半站著撐住不倒（髖部離地、底下又沒有家具托著）看起來很假：往身體側面推一把讓它躺下，最多推 5 次，左右輪流
    const hipY = (P[1] + P[4]) / 2, propped = hipY > 0.22 && !(this.sup & 3);
    if (propped && this.nudge < 5 && this.slip < -0.25 && (this.rstill > 0 || mv < 0.25 || this.rt > 1.6)) {
      let ax = P[3] - P[0], az = P[5] - P[2]; const al = Math.hypot(ax, az); if (al < 0.05) { ax = 1; az = 0; } else { ax /= al; az /= al; }
      const sg = (this.nudge++ & 1 ? -1 : 1) * this.nsign, h2 = this.rh;
      for (let i = 0; i < 5; i++) { const o = i * 3, v = (i < 2 ? 1.5 : i < 4 ? 2.4 : 2.7) * sg; Q[o] -= ax * v * h2; Q[o + 2] -= az * v * h2; }
      this.slip = 0.7; this.rstill = 0; this.rt = Math.min(this.rt, 4);
    }
    if ((this.rstill >= 0.35 && !(propped && this.nudge < 5)) || this.rt > 6.5) { this.rs = true; Q.set(P); }
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
  dispose() { this.mat.dispose(); this.gunMat.dispose(); this.glow.dispose(); this.skel.dispose(); /* 槍的幾何是 rifleLow 的共用快取，不在這裡釋放 */ }
}
