// 六器鏢行：六器（截江刀、青鋒劍、白蠟長槍、鐵指虎、牛角弓、柳葉飛針）與背上的「六器匣」，全部程式建模。
//
// 兵器座標系（握把座標系，chars.js 依手骨量出）：+Y 沿握把指向兵器尖端（拳頭食指那側），
// +Z 是拳背／刃口方向，X = Y × Z。原點在握把中心。弓也是同一套：+Y 為上弓臂，弓弦在 −Z（朝向射手）。
// 六器匣座標系：原點在匣子中心，+Y 朝上，+Z 貼背（朝身體），−Z 是外面（銅鎖那面）。
import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { vertexColor, positionLocal, mx_noise_float, vec3 } from 'three/tsl';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const WEAPON_TYPES = ['BLADE', 'SWORD', 'SPEAR', 'FIST', 'BOW', 'THROWN'];

// ── 材質（全部用頂點色，四種表面） ──
const lacquerMat = new MeshStandardNodeMaterial({ roughness: 0.2, metalness: 0 });
// 黑漆木：極淡的縱向木紋
lacquerMat.colorNode = vertexColor().mul(mx_noise_float(positionLocal.mul(vec3(34, 2.2, 34))).mul(0.3).add(mx_noise_float(positionLocal.mul(vec3(140, 9, 140))).mul(0.08)).add(1));
const MATS = {
  steel: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.32 }),
  brass: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.4 }),
  matte: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0, roughness: 0.86 }),
  lacquer: lacquerMat,
};
lacquerMat.vertexColors = true;

const C = (hex) => new THREE.Color(hex);
const COL = {
  steel: C(0xb9c2c9), edge: C(0xeef2f3), ridge: C(0x8f9aa3), fuller: C(0x5d666e), iron: C(0x3c3e42), ironHi: C(0x6a6d72),
  brass: C(0xb08d48), brassDk: C(0x6e5527), cord: C(0x2a1c16), cordHi: C(0x4a3326), ray: C(0xd9d2bf),
  red: C(0xa52a1e), redDk: C(0x6e1712), wood: C(0xd4bf93), woodDk: C(0xa48b62), horn: C(0x2e2621), bark: C(0x7b5a39),
  string: C(0xe9e1cc), lacquer: C(0x3a271d), lacquerHi: C(0x4a3326), hole: C(0x070605), leather: C(0x4a2f1e), silk: C(0x9b2a22),
};

// ── 幾何收集器：依材質分組，最後每組合成一個 mesh ──
class Kit {
  constructor() {
    this.parts = { steel: [], brass: [], matte: [], lacquer: [] };
  }

  add(mat, geo, color, matrix) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.color) {
      const c = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i < c.length; i += 3) { c[i] = color.r; c[i + 1] = color.g; c[i + 2] = color.b; }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
    this.parts[mat].push(g);
    return this;
  }

  build() {
    const grp = new THREE.Group();
    for (const [k, list] of Object.entries(this.parts)) {
      if (!list.length) continue;
      const m = new THREE.Mesh(mergeGeos(list), MATS[k]);
      m.castShadow = true;
      m.frustumCulled = false;
      grp.add(m);
    }
    return grp;
  }
}

export function mergeGeos(list) {
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const out = {};
  for (const a of ['position', 'normal', 'color']) out[a] = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) {
    for (const a of ['position', 'normal', 'color']) out[a].set(g.attributes[a].array, o * 3);
    o += g.attributes.position.count;
  }
  const geo = new THREE.BufferGeometry();
  for (const a of ['position', 'normal', 'color']) geo.setAttribute(a, new THREE.BufferAttribute(out[a], 3));
  geo.computeBoundingSphere();
  return geo;
}

const M = () => new THREE.Matrix4();
const T = (x, y, z) => M().makeTranslation(x, y, z);
const R = (x, y, z) => M().makeRotationFromEuler(new THREE.Euler(x, y, z));
const TR = (x, y, z, rx = 0, ry = 0, rz = 0, s = 1) => M().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));

// 放樣：沿 y 的一串截面（截面點在 xz 平面）。截面每條邊是獨立的面帶：沿長度平滑、跨邊有稜線（刃線清楚）
// sec(t) → { y, pts: [[x, z], ...], ox?, oz? }；color(i, t) → THREE.Color（第 i 條邊）
function loft(stations, sec, color, { closed = true, capStart = false, capEnd = false } = {}) {
  const S = stations.map((t) => ({ t, ...sec(t) }));
  const n = S[0].pts.length;
  const pos = [], col = [];
  const P = (s, i) => {
    const p = s.pts[i % n];
    return [p[0] + (s.ox || 0), s.y, p[1] + (s.oz || 0)];
  };
  const edges = closed ? n : n - 1;
  for (let i = 0; i < edges; i++) {
    for (let k = 0; k < S.length - 1; k++) {
      const a = P(S[k], i), b = P(S[k], i + 1), c = P(S[k + 1], i + 1), d = P(S[k + 1], i);
      const ca = color(i, S[k].t), cc = color(i, S[k + 1].t);
      pos.push(...a, ...b, ...c, ...a, ...c, ...d);
      for (const cl of [ca, ca, cc, ca, cc, cc]) col.push(cl.r, cl.g, cl.b);
    }
  }
  const cap = (s, flip) => {
    const c = s.pts.reduce((acc, p) => [acc[0] + p[0] / n, acc[1] + p[1] / n], [0, 0]);
    const cen = [c[0] + (s.ox || 0), s.y, c[1] + (s.oz || 0)];
    for (let i = 0; i < n; i++) {
      const a = P(s, i), b = P(s, i + 1);
      if (flip) pos.push(...cen, ...b, ...a); else pos.push(...cen, ...a, ...b);
      const cl = color(i, s.t);
      for (let j = 0; j < 3; j++) col.push(cl.r, cl.g, cl.b);
    }
  };
  if (capStart) cap(S[0], true);
  if (capEnd) cap(S[S.length - 1], false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  smoothAlong(g);
  return g;
}

// 面帶內部同位置頂點共用法線（沿長度平滑），不同面帶不共用（保留稜線）
function smoothAlong(g) {
  g.computeVertexNormals();
  const p = g.attributes.position.array, nrm = g.attributes.normal.array;
  const key = (i) => `${p[i * 3].toFixed(5)},${p[i * 3 + 1].toFixed(5)},${p[i * 3 + 2].toFixed(5)}`;
  // 每 6 個頂點一個 quad；同一面帶（相同 quad 群）在建立時是連續的，用「法線夾角 < 40°」決定要不要共用
  const groups = new Map();
  const cnt = g.attributes.position.count;
  for (let i = 0; i < cnt; i++) {
    const k = key(i);
    let arr = groups.get(k);
    if (!arr) groups.set(k, (arr = []));
    arr.push(i);
  }
  const out = new Float32Array(nrm.length);
  const v = new THREE.Vector3(), w = new THREE.Vector3(), s = new THREE.Vector3();
  for (const arr of groups.values()) {
    for (const i of arr) {
      v.fromArray(nrm, i * 3);
      s.set(0, 0, 0);
      for (const j of arr) {
        w.fromArray(nrm, j * 3);
        if (v.dot(w) > 0.77) s.add(w);
      }
      s.normalize().toArray(out, i * 3);
    }
  }
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3));
}

// 迴轉體：profile = [[r, y], ...]
function lathe(profile, segs = 20) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), segs);
  return g;
}

// 沿曲線的管子（半徑可變）
function tube(points, radius, radial = 6, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed);
  const segs = Math.max(4, points.length * 3);
  const frames = curve.computeFrenetFrames(segs, closed);
  const pos = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const c = curve.getPointAt(t);
    const r = typeof radius === 'function' ? radius(t) : radius;
    const N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const cx = Math.cos(a), sx = Math.sin(a);
      pos.push(c.x + r * (cx * N.x + sx * B.x), c.y + r * (cx * N.y + sx * B.y), c.z + r * (cx * N.z + sx * B.z));
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// 纏柄：芯＋兩股反向螺旋的纏繩（菱形纏法）
function wrappedGrip(K, y0, y1, r0, r1, turns, coreCol = COL.ray, cordCol = COL.cord) {
  K.add('matte', lathe([[0, y0], [r0, y0], [(r0 + r1) / 2 + 0.0015, (y0 + y1) / 2], [r1, y1], [0, y1]], 16), coreCol);
  for (const dir of [1, -1]) {
    for (const ph of [0, Math.PI]) {
      const pts = [];
      const N = turns * 10;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const a = ph + dir * t * turns * Math.PI * 2;
        const r = (r0 + (r1 - r0) * t + 0.0015 * Math.sin(t * Math.PI)) + 0.0018;
        pts.push(new THREE.Vector3(Math.cos(a) * r, y0 + (y1 - y0) * t, Math.sin(a) * r));
      }
      K.add('matte', tube(pts, 0.0032, 5), dir > 0 ? cordCol : cordCol.clone().lerp(COL.cordHi, 0.5));
    }
  }
}

// 穗子：一束細絲從 (0, y, 0) 往 −Y 垂下
function tassel(K, at, len, spread, n, col, mat = 'matte', r0 = 0.0024) {
  const rnd = mulberry(7);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.4;
    const s = spread * (0.5 + rnd() * 0.5);
    const L = len * (0.82 + rnd() * 0.25);
    const pts = [];
    for (let k = 0; k <= 4; k++) {
      const t = k / 4;
      pts.push(new THREE.Vector3(at.x + Math.cos(a) * (0.003 + s * t * t * 0.8 + s * t * 0.2), at.y - L * t, at.z + Math.sin(a) * (0.003 + s * t)));
    }
    const c = col.clone().multiplyScalar(0.75 + rnd() * 0.4);
    K.add(mat, tube(pts, (t) => r0 * (1 - t * 0.7), 3), c);
  }
}

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 各兵器 ──
// 青鋒劍：菱形斷面雙刃直劍、如意形銅護手、纏柄、銅首、紅穗
function sword(K, { hiltOnly = false } = {}) {
  const yG = 0.09; // 護手底
  // 劍身
  if (!hiltOnly) {
    const L = 0.74;
    const st = [];
    for (let i = 0; i <= 24; i++) st.push(i / 24);
    K.add('steel', loft(st, (t) => {
      const y = yG + 0.028 + t * L;
      let w = 0.0175 - t * 0.0045;
      if (t > 0.9) w *= Math.sqrt(Math.max(0, (1 - t) / 0.1));
      const th = 0.0042 * (w / 0.0175) + 0.0006;
      return { y, pts: [[0, w], [th * 0.42, w * 0.6], [th, 0], [th * 0.42, -w * 0.6], [0, -w], [-th * 0.42, -w * 0.6], [-th, 0], [-th * 0.42, w * 0.6]] };
    }, (i) => (i % 4 === 0 || i % 4 === 3 ? COL.edge : COL.steel), { capStart: true }));
    // 劍身根部的銅鞘口（劍格上的護片）
  }
  // 護手：如意形，沿刃寬（Z）展開
  const sh = new THREE.Shape();
  sh.moveTo(-0.052, 0.004);
  sh.bezierCurveTo(-0.05, 0.02, -0.03, 0.016, -0.014, 0.02);
  sh.quadraticCurveTo(-0.004, 0.024, 0, 0.034);
  sh.quadraticCurveTo(0.004, 0.024, 0.014, 0.02);
  sh.bezierCurveTo(0.03, 0.016, 0.05, 0.02, 0.052, 0.004);
  sh.bezierCurveTo(0.044, -0.006, 0.03, -0.012, 0.012, -0.012);
  sh.quadraticCurveTo(0, -0.022, -0.012, -0.012);
  sh.bezierCurveTo(-0.03, -0.012, -0.044, -0.006, -0.052, 0.004);
  const guard = new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.0025, bevelSegments: 2, curveSegments: 10 });
  guard.translate(0, 0, -0.008);
  K.add('brass', guard, COL.brass, M().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0)).setPosition(0, yG, 0));
  // 柄
  K.add('brass', lathe([[0, yG - 0.004], [0.0125, yG - 0.004], [0.0135, yG - 0.012], [0.0125, yG - 0.02], [0, yG - 0.02]], 16), COL.brassDk);
  wrappedGrip(K, -0.085, yG - 0.02, 0.0118, 0.011, 6);
  // 劍首
  K.add('brass', lathe([[0, -0.085], [0.0125, -0.085], [0.016, -0.094], [0.018, -0.104], [0.014, -0.114], [0.007, -0.119], [0, -0.12]], 18), COL.brass);
  // 劍穗：穗繩環＋結＋流蘇
  K.add('matte', new THREE.TorusGeometry(0.009, 0.0022, 6, 14), COL.red, TR(0, -0.128, 0, 0, Math.PI / 2, 0));
  K.add('matte', new THREE.SphereGeometry(0.008, 10, 8), COL.red, T(0, -0.142, 0));
  K.add('brass', lathe([[0, -0.148], [0.006, -0.149], [0.0075, -0.156], [0.006, -0.162], [0, -0.163]], 10), COL.brassDk);
  tassel(K, new THREE.Vector3(0, -0.16, 0), 0.11, 0.022, 16, COL.red);
}

// 截江刀：單刃柳葉刀，刀背厚、血槽、刃口一條亮線，刀尖上挑；橢圓銅盤護手、纏柄、刀環掛紅綢
function blade(K, { hiltOnly = false } = {}) {
  const yG = 0.115;
  if (!hiltOnly) {
    const L = 0.72;
    const st = [];
    for (let i = 0; i <= 30; i++) st.push(i / 30);
    K.add('steel', loft(st, (t) => {
      const y = yG + 0.018 + t * L;
      let w = 0.034 + 0.01 * Math.sin(Math.min(1, t / 0.85) * Math.PI * 0.5) ; // 漸寬
      const curve = -0.05 * t * t; // 往刀背方向彎
      let edgeZ = w * 0.7, spineZ = -w * 0.3;
      if (t > 0.82) { // 刀尖：刃線往上挑，與刀背交會
        const k = (t - 0.82) / 0.18;
        edgeZ = w * 0.7 * (1 - k * k) - k * k * w * 0.3;
        spineZ = -w * 0.3 + k * k * 0.0;
        w *= 1;
      }
      const wd = edgeZ - spineZ;
      const th = 0.0042 * Math.max(0.15, 1 - Math.max(0, t - 0.82) / 0.2);
      const z = (f) => spineZ + wd * f;
      return {
        y, oz: curve,
        pts: [
          [th, z(0)], [th * 0.95, z(0.16)], [th * 0.55, z(0.21)], [th * 0.95, z(0.27)], [th * 0.85, z(0.62)], [0.0004, z(1)],
          [-0.0004, z(1)], [-th * 0.85, z(0.62)], [-th * 0.95, z(0.27)], [-th * 0.55, z(0.21)], [-th * 0.95, z(0.16)], [-th, z(0)],
        ],
      };
    }, (i) => {
      if (i === 4 || i === 6) return COL.edge; // 刃線
      if (i === 5) return COL.edge;
      if (i === 1 || i === 2 || i === 8 || i === 9) return COL.fuller; // 血槽
      if (i === 11) return COL.ridge; // 刀背
      return COL.steel;
    }, { capStart: true, capEnd: true }));
  }
  // 吞口（刀身與護手之間的銅套）
  K.add('brass', new RoundedBoxGeometry(0.012, 0.022, 0.04, 2, 0.003), COL.brass, T(0, yG + 0.006, -0.002));
  // 護手：橢圓盤
  const disc = lathe([[0, 0], [0.026, 0], [0.03, 0.003], [0.03, 0.009], [0.026, 0.012], [0, 0.012]], 28);
  K.add('brass', disc, COL.brass, M().compose(new THREE.Vector3(0, yG - 0.012, 0.004), new THREE.Quaternion(), new THREE.Vector3(0.75, 1, 1.25)));
}

function bladeHilt(K) {
  const yG = 0.115;
  K.add('brass', lathe([[0, yG - 0.012], [0.0135, yG - 0.012], [0.0145, yG - 0.02], [0, yG - 0.02]], 16), COL.brassDk);
  wrappedGrip(K, -0.105, yG - 0.02, 0.0128, 0.0118, 7, COL.redDk, COL.cord);
  K.add('brass', lathe([[0, -0.105], [0.0135, -0.105], [0.0125, -0.115], [0, -0.115]], 16), COL.brass);
  // 刀環
  K.add('brass', new THREE.TorusGeometry(0.022, 0.0042, 8, 26), COL.brass, TR(0, -0.137, 0, 0, Math.PI / 2, 0));
  // 紅綢
  for (const [dz, len, tw] of [[-0.006, 0.17, 0.4], [0.008, 0.13, -0.3]]) {
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      pts.push(new THREE.Vector3(Math.sin(t * 2.4) * 0.012 * tw, -0.158 - t * len, dz + t * t * 0.03 * Math.sign(tw)));
    }
    const ribbon = ribbonGeo(pts, 0.022, 0.012);
    K.add('matte', ribbon, COL.silk);
  }
  K.add('matte', new THREE.SphereGeometry(0.009, 10, 8), COL.silk, M().compose(new THREE.Vector3(0, -0.158, 0), new THREE.Quaternion(), new THREE.Vector3(1.3, 0.9, 1)));
}

// 帶狀布條（雙面）：沿點列，寬度在 X 方向
function ribbonGeo(pts, w0, w1) {
  const pos = [];
  const curve = new THREE.CatmullRomCurve3(pts);
  const N = 14;
  const P = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const c = curve.getPointAt(t);
    const w = (w0 + (w1 - w0) * t) / 2;
    P.push([[c.x - w, c.y, c.z], [c.x + w, c.y, c.z]]);
  }
  for (let i = 0; i < N; i++) {
    const [a, b] = P[i], [d, c] = P[i + 1];
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    pos.push(...a, ...c, ...b, ...a, ...d, ...c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// 白蠟長槍：白蠟桿、鐵鐏、銅箍、柳葉槍頭（菱形斷面）、紅纓
function spear(K, { headOnly = false } = {}) {
  const yS = 1.3; // 槍頭套筒底
  if (!headOnly) {
    // 桿：分段上色做木紋濃淡
    const shaft = new THREE.CylinderGeometry(0.0145, 0.0165, yS + 0.8, 12, 24, true);
    shaft.translate(0, (yS - 0.8) / 2, 0);
    const p = shaft.attributes.position;
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), a = Math.atan2(p.getZ(i), p.getX(i));
      const g = 0.5 + 0.5 * Math.sin(y * 9 + Math.sin(a * 2) * 1.3) * Math.sin(y * 3.1 + 1.7);
      const c = COL.wood.clone().lerp(COL.woodDk, g * 0.45);
      c.toArray(col, i * 3);
    }
    shaft.setAttribute('color', new THREE.BufferAttribute(col, 3));
    K.add('matte', shaft);
    // 鐏
    K.add('steel', lathe([[0, -0.97], [0.004, -0.96], [0.012, -0.86], [0.0175, -0.81], [0.0178, -0.8], [0, -0.8]], 12), COL.iron);
    // 握處纏麻繩
    for (let i = 0; i < 14; i++) K.add('matte', new THREE.TorusGeometry(0.0168, 0.0024, 5, 14), COL.cord, TR(0, -0.07 + i * 0.01, 0, Math.PI / 2, 0, 0));
  }
  // 槍頭套筒（銅箍）
  K.add('steel', lathe([[0.0165, yS - 0.02], [0.017, yS], [0.0145, yS + 0.06], [0.0118, yS + 0.1], [0.0105, yS + 0.115]], 14), COL.iron);
  for (const dy of [-0.012, 0.03]) K.add('brass', lathe([[0.0172, yS + dy], [0.0195, yS + dy + 0.004], [0.0195, yS + dy + 0.01], [0.0172, yS + dy + 0.014]], 16), COL.brass);
  // 槍頭
  const st = [];
  for (let i = 0; i <= 18; i++) st.push(i / 18);
  K.add('steel', loft(st, (t) => {
    const y = yS + 0.11 + t * 0.25;
    const w = 0.036 * Math.pow(Math.sin(Math.min(1, t * 1.05) * Math.PI * 0.9 + 0.12), 0.9) * (1 - t * 0.25) + 0.0004;
    const th = Math.max(0.0012, 0.009 * (1 - t) + 0.001);
    return { y, pts: [[0, w], [th * 0.35, w * 0.55], [th, 0], [th * 0.35, -w * 0.55], [0, -w], [-th * 0.35, -w * 0.55], [-th, 0], [-th * 0.35, w * 0.55]] };
  }, (i) => (i % 4 === 0 || i % 4 === 3 ? COL.edge : COL.steel), { capStart: true }));
  // 紅纓：從套筒口往四周散開下垂
  const rnd = mulberry(11);
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2 + rnd() * 0.3;
    const L = 0.17 + rnd() * 0.07;
    const sp = 0.05 + rnd() * 0.035;
    const pts = [];
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      const r = 0.016 + sp * Math.sin(t * Math.PI * 0.55);
      pts.push(new THREE.Vector3(Math.cos(a) * r, yS + 0.1 - t * L, Math.sin(a) * r));
    }
    K.add('matte', tube(pts, (t) => 0.0036 * (1 - t * 0.6), 3), COL.red.clone().multiplyScalar(0.7 + rnd() * 0.5));
  }
}

// 鐵指虎：四環一體，拳背四顆銅釘，掌心橫把
function fist(K) {
  const ringZ = 0.024;
  for (let i = 0; i < 4; i++) {
    const y = -0.033 + i * 0.022;
    K.add('steel', new THREE.TorusGeometry(0.0118, 0.0042, 8, 20), COL.iron, TR(0, y, ringZ - 0.004, 0, Math.PI / 2, 0));
    K.add('brass', new THREE.ConeGeometry(0.0065, 0.012, 6), COL.brass, TR(0, y, ringZ + 0.0135, Math.PI / 2, 0, 0));
  }
  // 拳背連板
  K.add('steel', new RoundedBoxGeometry(0.014, 0.092, 0.008, 2, 0.003), COL.ironHi, T(0, -0.0, ringZ + 0.006));
  // 掌心橫把與側板
  K.add('steel', tube([new THREE.Vector3(0, -0.05, 0.004), new THREE.Vector3(0, -0.02, -0.008), new THREE.Vector3(0, 0.02, -0.008), new THREE.Vector3(0, 0.05, 0.004)], 0.0075, 8), COL.iron);
  for (const s of [-1, 1]) K.add('steel', new RoundedBoxGeometry(0.01, 0.012, 0.034, 2, 0.003), COL.iron, T(0, s * 0.047, ringZ * 0.45));
}

// 牛角弓：反曲弓臂（腹面牛角深色、背面樺皮）、銅包握把、弓弭、弓弦
function bow(K, { stub = false } = {}) {
  const half = 0.66;
  const center = (yy) => {
    const a = Math.abs(yy);
    // 弓臂往射手側彎，近梢處平順地反曲（一階導數連續，不折角）
    const base = -0.21 * Math.pow(Math.min(a, 0.62) / 0.62, 1.6);
    const rec = a > 0.46 ? 0.085 * Math.pow((a - 0.46) / (half - 0.46), 2) : 0;
    return base + rec;
  };
  const st = [];
  const y0 = stub ? 0.4 : -half, y1 = half;
  const N = stub ? 12 : 40;
  for (let i = 0; i <= N; i++) st.push(y0 + (i / N) * (y1 - y0));
  K.add('matte', loft(st, (yy) => {
    const a = Math.abs(yy);
    const w = a < 0.06 ? 0.017 : 0.017 - (a - 0.06) * 0.012;
    const th = a < 0.07 ? 0.021 : Math.max(0.009, 0.016 - (a - 0.07) * 0.012);
    // 截面：背面（+Z 側）樺皮、腹面（−Z 側）牛角
    const pts = [];
    for (let k = 0; k < 10; k++) {
      const an = (k / 10) * Math.PI * 2;
      pts.push([Math.cos(an) * w, Math.sin(an) * th * 0.5]);
    }
    // 弓臂切線方向近似：截面不轉，只平移
    return { y: yy, pts, oz: center(yy) };
  }, (i) => (Math.sin((i / 10) * Math.PI * 2) > 0.05 ? COL.bark : COL.horn), { capStart: true, capEnd: true }));
  if (!stub) {
    // 握把：皮纏＋銅箍
    K.add('matte', lathe([[0.019, -0.07], [0.0205, -0.04], [0.021, 0.04], [0.019, 0.07]], 14), COL.leather, M().compose(new THREE.Vector3(0, 0, center(0)), new THREE.Quaternion(), new THREE.Vector3(1, 1, 0.75)));
    for (const yy of [-0.075, 0.075]) K.add('brass', lathe([[0.017, -0.006], [0.0205, -0.004], [0.0205, 0.004], [0.017, 0.006]], 16), COL.brass, M().compose(new THREE.Vector3(0, yy, center(yy)), new THREE.Quaternion(), new THREE.Vector3(1, 1, 0.8)));
  }
  // 弓弭（骨白）與弓弦
  const tipZ = center(half);
  for (const s of stub ? [1] : [1, -1]) {
    K.add('matte', new THREE.SphereGeometry(0.008, 8, 6), COL.ray, M().compose(new THREE.Vector3(0, s * (half + 0.004), tipZ), new THREE.Quaternion(), new THREE.Vector3(1, 1.6, 1)));
  }
  const sy0 = stub ? 0.4 : -half + 0.01;
  const sz = (yy) => tipZ + (Math.abs(yy) > half - 0.01 ? 0 : 0);
  K.add('matte', tube([new THREE.Vector3(0, sy0, sz(sy0) - 0.004), new THREE.Vector3(0, half - 0.01, tipZ - 0.004)], 0.0016, 4), COL.string);
}

// 柳葉飛針：三枚，指縫間扇開；尾端紅絲
function needles(K) {
  for (const [i, a] of [-0.22, 0, 0.22].entries()) {
    const m = TR(0, -0.01, 0.0 + i * 0.002, a, 0, 0);
    const st = [];
    for (let k = 0; k <= 10; k++) st.push(k / 10);
    K.add('steel', loft(st, (t) => {
      const y = -0.02 + t * 0.15;
      const leaf = t > 0.6 ? Math.sin(((t - 0.6) / 0.4) * Math.PI) * 0.0045 : 0;
      const r = 0.0016 * (1 - t * 0.4) + leaf;
      return { y, pts: [[0, r], [0.0012, 0], [0, -r], [-0.0012, 0]] };
    }, (k) => (k % 2 ? COL.edge : COL.steel), { capStart: true, capEnd: true }), null, m);
    const tail = [];
    for (let k = 0; k <= 4; k++) tail.push(new THREE.Vector3(Math.sin(k) * 0.003, -0.02 - k * 0.012, 0));
    K.add('matte', tube(tail, (t) => 0.0018 * (1 - t * 0.5), 3), COL.silk, m);
  }
}

// 箭：竹桿、鐵鏃朝下藏在格裡，露出三片白羽
function arrows(K, x, top, z) {
  const rnd = mulberry(5);
  for (let i = 0; i < 4; i++) {
    const ox = x + (i % 2 ? 0.014 : -0.014) + (rnd() - 0.5) * 0.008;
    const oz = z + (i < 2 ? -0.012 : 0.012);
    const tilt = (rnd() - 0.5) * 0.12;
    const m = TR(ox, top, oz, tilt, 0, (rnd() - 0.5) * 0.12);
    K.add('matte', new THREE.CylinderGeometry(0.0042, 0.0042, 0.16, 6), COL.wood, m.clone().multiply(T(0, 0.04, 0)));
    K.add('matte', new THREE.CylinderGeometry(0.0055, 0.0045, 0.012, 6), COL.redDk, m.clone().multiply(T(0, 0.075, 0)));
    for (let k = 0; k < 3; k++) {
      const vane = new THREE.BufferGeometry();
      const a = (k / 3) * Math.PI * 2 + i;
      const cx = Math.cos(a), cz = Math.sin(a);
      const p = [[0, 0.065], [0.016, 0.075], [0.014, 0.13], [0, 0.12]].map(([r, y]) => [cx * (r + 0.004), y, cz * (r + 0.004)]);
      vane.setAttribute('position', new THREE.Float32BufferAttribute([...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3], ...p[0], ...p[2], ...p[1], ...p[0], ...p[3], ...p[2]], 3));
      vane.computeVertexNormals();
      K.add('matte', vane, k ? COL.string : COL.red, m);
    }
  }
}

// 兵器手上那把
const heldCache = new Map();
export function makeWeapon(type) {
  let geoGroup = heldCache.get(type);
  if (!geoGroup) {
    const K = new Kit();
    if (type === 'SWORD') sword(K);
    else if (type === 'BLADE') { blade(K); bladeHilt(K); }
    else if (type === 'SPEAR') spear(K);
    else if (type === 'FIST') fist(K);
    else if (type === 'BOW') bow(K);
    else if (type === 'THROWN') needles(K);
    geoGroup = K.build();
    heldCache.set(type, geoGroup);
  }
  const g = geoGroup.clone();
  g.name = `weapon_${type}`;
  return g;
}

// ── 六器匣 ──
export const CASE = { W: 0.34, H: 0.54, D: 0.15 };
// 頂上六格：外排（−Z）與內排（+Z）各三格
const SLOT = {
  SPEAR: [0, -0.036], BOW: [0.108, -0.036], THROWN: [-0.108, -0.036],
  SWORD: [-0.108, 0.036], BLADE: [0.108, 0.036], FIST: [0, 0.036],
};
let caseGroup = null;
export function makeCase() {
  if (!caseGroup) {
    const { W, H, D } = CASE;
    const K = new Kit();
    K.add('lacquer', new RoundedBoxGeometry(W, H, D, 3, 0.012), COL.lacquer);
    // 腰線：兩道皮箍
    for (const y of [-0.13, 0.13]) {
      K.add('matte', new RoundedBoxGeometry(W + 0.008, 0.03, D + 0.008, 2, 0.006), COL.leather, T(0, y, 0));
      for (const s of [-1, 1]) {
        K.add('brass', new THREE.CylinderGeometry(0.0045, 0.0045, 0.004, 10), COL.brass, TR(s * 0.11, y, -D / 2 - 0.005, Math.PI / 2, 0, 0));
      }
    }
    // 八角包銅：三片 L 形片＋鉚釘
    const pl = 0.05, t = 0.003;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const cx = sx * (W / 2 - pl / 2 + 0.004), cy = sy * (H / 2 - pl / 2 + 0.004), cz = sz * (D / 2 - pl / 2 + 0.004);
      K.add('brass', new RoundedBoxGeometry(t, pl, pl, 1, 0.0012), COL.brass, T(sx * (W / 2 + t / 2), cy, cz));
      K.add('brass', new RoundedBoxGeometry(pl, t, pl, 1, 0.0012), COL.brass, T(cx, sy * (H / 2 + t / 2), cz));
      K.add('brass', new RoundedBoxGeometry(pl, pl, t, 1, 0.0012), COL.brass, T(cx, cy, sz * (D / 2 + t / 2)));
      for (const [px, py, pz] of [[sx * (W / 2 + t), cy, cz], [cx, cy, sz * (D / 2 + t)]]) {
        K.add('brass', new THREE.SphereGeometry(0.0042, 8, 6), COL.brassDk.clone().lerp(COL.brass, 0.6), T(px, py, pz));
      }
    }
    // 外面：銅鎖片＋鎖扣，上方刻一道橫線框
    const lock = new THREE.Shape();
    lock.absarc(0, 0, 0.034, 0, Math.PI * 2, false);
    const lockG = new THREE.ExtrudeGeometry(lock, { depth: 0.003, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.002, bevelSegments: 2, curveSegments: 24 });
    K.add('brass', lockG, COL.brass, TR(0, 0.0, -D / 2 - 0.002, Math.PI, 0, 0));
    K.add('brass', new RoundedBoxGeometry(0.018, 0.05, 0.008, 2, 0.003), COL.brassDk, T(0, -0.01, -D / 2 - 0.007));
    K.add('brass', new THREE.TorusGeometry(0.009, 0.0022, 6, 14), COL.brass, TR(0, 0.03, -D / 2 - 0.009, 0, 0, 0));
    // 匣面嵌板：細銅線框
    for (const y of [0.215, -0.215]) K.add('brass', new RoundedBoxGeometry(W - 0.07, 0.004, 0.003, 1, 0.001), COL.brassDk, T(0, y * 0.78, -D / 2 - 0.0015));
    for (const x of [-1, 1]) K.add('brass', new RoundedBoxGeometry(0.004, H * 0.66, 0.003, 1, 0.001), COL.brassDk, T(x * (W / 2 - 0.035), 0, -D / 2 - 0.0015));
    // 頂上：口沿與六格隔板、格內暗面
    K.add('lacquer', new RoundedBoxGeometry(W - 0.004, 0.01, D - 0.004, 1, 0.003), COL.lacquerHi, T(0, H / 2 + 0.002, 0));
    for (const [x, z] of Object.values(SLOT)) K.add('matte', new THREE.PlaneGeometry(0.09, 0.058), COL.hole, TR(x, H / 2 + 0.0075, z, -Math.PI / 2, 0, 0));
    for (const x of [-0.054, 0.054]) K.add('lacquer', new THREE.BoxGeometry(0.008, 0.016, D - 0.01), COL.lacquerHi, T(x, H / 2 + 0.006, 0));
    K.add('lacquer', new THREE.BoxGeometry(W - 0.01, 0.016, 0.008), COL.lacquerHi, T(0, H / 2 + 0.006, 0));
    for (const sx of [-1, 1]) K.add('lacquer', new THREE.BoxGeometry(0.008, 0.016, D - 0.01), COL.lacquerHi, T(sx * (W / 2 - 0.006), H / 2 + 0.006, 0));
    for (const sz of [-1, 1]) K.add('lacquer', new THREE.BoxGeometry(W - 0.01, 0.016, 0.008), COL.lacquerHi, T(0, H / 2 + 0.006, sz * (D / 2 - 0.006)));
    // 側面提環
    for (const sx of [-1, 1]) {
      K.add('brass', new THREE.TorusGeometry(0.016, 0.003, 6, 16), COL.brass, TR(sx * (W / 2 + 0.006), 0.17, 0, 0, Math.PI / 2, 0));
      K.add('brass', new RoundedBoxGeometry(0.004, 0.02, 0.026, 1, 0.0015), COL.brass, T(sx * (W / 2 + 0.002), 0.186, 0));
    }
    // 背面（貼身）：兩條背帶的掛扣
    for (const sx of [-1, 1]) for (const y of [0.22, -0.2]) K.add('matte', new RoundedBoxGeometry(0.04, 0.05, 0.01, 2, 0.003), COL.leather, T(sx * 0.1, y, D / 2 + 0.004));
    caseGroup = K.build();
  }
  const g = caseGroup.clone();
  g.name = 'sixfold_case';
  return g;
}

// 匣中的兵器：只露出柄或頭，插在各自的格子裡
const stowCache = new Map();
export function makeStowed(type) {
  let grp = stowCache.get(type);
  if (!grp) {
    const K = new Kit();
    const { H } = CASE;
    const [x, z] = SLOT[type];
    const top = H / 2 + 0.006;
    const sub = new Kit();
    const sub2 = K;
    let m;
    if (type === 'SWORD') { sword(sub, { hiltOnly: true }); m = TR(x, top - 0.09 + 0.13, z, 0, Math.PI / 2, -0.12); }
    else if (type === 'BLADE') { bladeHilt(sub); blade(sub, { hiltOnly: true }); m = TR(x, top - 0.105 + 0.17, z, 0, Math.PI / 2, 0.12); }
    else if (type === 'SPEAR') { spear(sub, { headOnly: true }); m = TR(x, top - 1.3 + 0.02, z, 0, Math.PI / 2, 0); }
    else if (type === 'BOW') {
      // 弓斜綁在匣子外面（弦朝外），格子裡插四支箭
      bow(sub);
      m = M().makeTranslation(0, -0.02, -CASE.D / 2 - 0.035).multiply(R(0, Math.PI, -0.95)).multiply(M().makeScale(0.85, 0.85, 0.85));
      arrows(sub2, x, top, z);
    }
    else if (type === 'THROWN') {
      // 針筒：銅口竹筒，露出三束紅絲
      sub.add('matte', lathe([[0, 0], [0.016, 0], [0.016, 0.07], [0.0185, 0.074], [0.0185, 0.082], [0, 0.082]], 16), COL.bark);
      sub.add('brass', lathe([[0.0165, 0.06], [0.019, 0.062], [0.019, 0.082], [0.0165, 0.084]], 16), COL.brass);
      for (const a of [0, 2.1, 4.2]) sub.add('matte', tube([new THREE.Vector3(Math.cos(a) * 0.006, 0.08, Math.sin(a) * 0.006), new THREE.Vector3(Math.cos(a) * 0.012, 0.1, Math.sin(a) * 0.012), new THREE.Vector3(Math.cos(a) * 0.02, 0.105, Math.sin(a) * 0.02)], 0.0024, 4), COL.silk);
      m = T(x, top - 0.05, z);
    } else if (type === 'FIST') { fist(sub); m = TR(x, top + 0.03, z, 0, 0, Math.PI / 2); }
    for (const [k, list] of Object.entries(sub.parts)) for (const g of list) K.parts[k].push(g.applyMatrix4(m));
    grp = K.build();
    stowCache.set(type, grp);
  }
  const g = grp.clone();
  g.name = `stowed_${type}`;
  return g;
}

