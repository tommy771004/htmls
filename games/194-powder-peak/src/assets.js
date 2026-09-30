// 程式化低多邊形模型（取代 Rodin MCP）。所有模型 = 單一 BufferGeometry（position/normal/color），
// 共用一個 vertex-color Lambert 材質 → 可直接 InstancedMesh。模型在 local space 面向 -Z，原點在底部中心。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { config } from './config.js';
import { mulberry32, hash2, rampProfile } from './shared.js';

const C = { ...config.assets }; // 預設值唯一來源是 config.js

export const PALETTE = {
  snow: 0xf4f8fc,
  snowShade: 0xdfe9f4,
  snowBlue: 0xcbdcee,
  pine: 0x1f5a45,
  pineLight: 0x2a6a50,
  pineUnder: 0x143a30,
  trunk: 0x5e3a22,
  wood: 0x96623b,
  woodDark: 0x7a4c2c,
  woodLight: 0xac7548,
  rock: 0x7f8b9d,
  rockDark: 0x677386,
  rockLight: 0x94a0b1,
  banner: 0x9c1f2b,
  bannerDark: 0x7a1621,
  emblem: 0xf0dcb8,
  gold: 0xd9a441,
  helmet: 0x7d858f,
  helmetDark: 0x535a64,
  horn: 0xf1e6cf,
  hornTip: 0xcdbd98,
  beard: 0xe0692c,
  beardDark: 0xbd4f1f,
  skin: 0xf2b48e,
  nose: 0xe68f76,
  eye: 0x2a1d17,
  coat: 0x8e2c24,
  coatDark: 0x6c211c,
  leather: 0x5a3a24,
  belt: 0x3c2517,
  fur: 0xf2ece2,
  furShade: 0xdcd1c1,
  glove: 0x6b4428,
  boot: 0x80502d,
  sole: 0x33231a,
  trousers: 0x6e5443,
  ski: 0xd8322f,
  skiDark: 0xa82424,
  skiStripe: 0xf6f1e4,
  skiBase: 0x3a3f47,
  binding: 0x2e3238,
  pole: 0xbcc5cf,
  grip: 0x26282c,
  metal: 0x8b939c,
  cloud: 0xffffff,
  cloudUnder: 0xd6e2f1,
  mountainSnow: 0xeef4fb,
  mountainShade: 0xdce7f3,
  mountainRock: 0xbccbdd,
  marker: 0xe8542a,
};

// ---------- 小工具 ----------
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _n = new THREE.Vector3();
const _m = new THREE.Vector3();
const _col = new THREE.Color();
const _mat = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

// 依面法線 hash 決定亮度擾動：同平面的三角形（同一個 quad）顏色一致，色塊乾淨
function faceShade(nx, ny, nz, seed) {
  const h = hash2(Math.round(nx * 40) * 131 + Math.round(ny * 40), Math.round(nz * 40) + seed * 7, 977);
  return 1 + (h - 0.5) * 2 * C.faceVary;
}

// 對 geometry 套 位移/旋轉/縮放
function xf(g, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  _e.set(r[0], r[1], r[2]);
  _q.setFromEuler(_e);
  const sv = typeof s === 'number' ? V(s, s, s) : V(s[0], s[1], s[2]);
  _mat.compose(V(p[0], p[1], p[2]), _q, sv);
  g.applyMatrix4(_mat);
  return g;
}

// 依位置 hash 擾動頂點（相同位置的頂點位移相同 → 接縫不裂開）
function jitter(g, amt, seed = 0, ax = [1, 1, 1]) {
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ix = Math.round(x * 997), iy = Math.round(y * 997), iz = Math.round(z * 997);
    const k = ix * 7919 + iy * 104729;
    pos.setXYZ(
      i,
      x + (hash2(k, iz, seed + 11) - 0.5) * 2 * amt * ax[0],
      y + (hash2(k, iz, seed + 23) - 0.5) * 2 * amt * ax[1],
      z + (hash2(k, iz, seed + 37) - 0.5) * 2 * amt * ax[2],
    );
  }
  return g;
}

// primitive → non-indexed、只留 position/normal/color，逐面上色。
// color 可為 hex 或 (outColor, centroid, normal) => void
function paint(geom, color, seed = 0) {
  const g = geom.index ? geom.toNonIndexed() : geom;
  const src = g.attributes.position;
  const posArr = new Float32Array(src.count * 3);
  for (let i = 0; i < src.count; i++) {
    posArr[i * 3] = src.getX(i);
    posArr[i * 3 + 1] = src.getY(i);
    posArr[i * 3 + 2] = src.getZ(i);
  }
  const colArr = new Float32Array(src.count * 3);
  const cen = V();
  const nrm = V();
  const isFn = typeof color === 'function';
  for (let t = 0; t < src.count; t += 3) {
    const o = t * 3;
    _a.set(posArr[o + 3] - posArr[o], posArr[o + 4] - posArr[o + 1], posArr[o + 5] - posArr[o + 2]);
    _b.set(posArr[o + 6] - posArr[o], posArr[o + 7] - posArr[o + 1], posArr[o + 8] - posArr[o + 2]);
    nrm.crossVectors(_a, _b);
    if (nrm.lengthSq() > 1e-20) nrm.normalize();
    cen.set(
      (posArr[o] + posArr[o + 3] + posArr[o + 6]) / 3,
      (posArr[o + 1] + posArr[o + 4] + posArr[o + 7]) / 3,
      (posArr[o + 2] + posArr[o + 5] + posArr[o + 8]) / 3,
    );
    if (isFn) color(_col, cen, nrm);
    else _col.set(color);
    const k = faceShade(nrm.x, nrm.y, nrm.z, seed);
    for (let v = 0; v < 3; v++) {
      colArr[o + v * 3] = _col.r * k;
      colArr[o + v * 3 + 1] = _col.g * k;
      colArr[o + v * 3 + 2] = _col.b * k;
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  out.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  out.computeVertexNormals();
  return out;
}

// 自訂三角形建構器（直接產生 non-indexed + color）
class Mesher {
  constructor(seed = 0) {
    this.p = [];
    this.c = [];
    this.seed = seed;
  }
  // out：若給定，確保法線朝向遠離 out 點
  tri(a, b, c, col, out) {
    _a.subVectors(b, a);
    _b.subVectors(c, a);
    _n.crossVectors(_a, _b);
    if (out) {
      _m.copy(a).add(b).add(c).multiplyScalar(1 / 3).sub(out);
      if (_n.dot(_m) < 0) {
        const t = b;
        b = c;
        c = t;
        _n.negate();
      }
    }
    if (_n.lengthSq() > 1e-20) _n.normalize();
    this.p.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    _col.set(col);
    const k = faceShade(_n.x, _n.y, _n.z, this.seed);
    for (let i = 0; i < 3; i++) this.c.push(_col.r * k, _col.g * k, _col.b * k);
  }
  quad(a, b, c, d, col, out) {
    this.tri(a, b, c, col, out);
    this.tri(a, c, d, col, out);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeVertexNormals();
    return g;
  }
}

function merge(list) {
  const g = mergeGeometries(list, false);
  if (!g) throw new Error('assets: mergeGeometries failed');
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

function triCount(g) {
  return g.index ? g.index.count / 3 : g.attributes.position.count / 3;
}

// 以 a→b 為軸的圓柱（r0 在 a 端，r1 在 b 端）
function limb(a, b, r0, r1, seg = 6, open = false) {
  const dir = V().subVectors(b, a);
  const len = dir.length();
  dir.normalize();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, open);
  _q.setFromUnitVectors(V(0, 1, 0), dir);
  _mat.compose(V().addVectors(a, b).multiplyScalar(0.5), _q, V(1, 1, 1));
  g.applyMatrix4(_mat);
  return g;
}

function ico(r, detail, p, s = [1, 1, 1], jit = 0, seed = 0) {
  const g = xf(new THREE.IcosahedronGeometry(r, detail), p, [0, 0, 0], s);
  return jit ? jitter(g, jit, seed) : g;
}

// 左右鏡像（non-indexed：翻 x 並交換頂點順序維持繞序）
function mirrorX(g) {
  const out = g.clone();
  const p = out.attributes.position;
  const c = out.attributes.color;
  for (let i = 0; i < p.count; i++) p.setX(i, -p.getX(i));
  for (let t = 0; t < p.count; t += 3) {
    for (const attr of [p, c]) {
      const x = attr.getX(t + 1), y = attr.getY(t + 1), z = attr.getZ(t + 1);
      attr.setXYZ(t + 1, attr.getX(t + 2), attr.getY(t + 2), attr.getZ(t + 2));
      attr.setXYZ(t + 2, x, y, z);
    }
  }
  out.computeVertexNormals();
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

// 雪面色：朝下/側面的面偏藍
function snowFn(out, cen, n) {
  if (n.y > 0.55) out.set(PALETTE.snow);
  else if (n.y > 0.05) out.set(PALETTE.snowShade);
  else out.set(PALETTE.snowBlue);
}

// ---------- 松樹 ----------
function buildPine(variant) {
  const specs = [
    { tiers: 4, h: 7.2, r: 2.3, n: 8, trunkH: 1.3 },
    { tiers: 5, h: 10.2, r: 2.9, n: 7, trunkH: 1.6 },
    { tiers: 3, h: 6.0, r: 2.5, n: 8, trunkH: 1.1 },
  ];
  const sp = specs[variant];
  const rng = mulberry32(C.seed + variant * 101);
  const m = new Mesher(variant + 1);
  const parts = [];

  // 樹幹
  parts.push(paint(xf(new THREE.CylinderGeometry(0.2, 0.3, sp.trunkH + 1.0, 6, 1, true), [0, (sp.trunkH + 1.0) / 2 - 0.3, 0]), PALETTE.trunk, 3));

  const n = sp.n;
  const top = sp.h;
  const base = sp.trunkH;
  const span = top - base;
  for (let k = 0; k < sp.tiers; k++) {
    const f = k / sp.tiers;
    const y0 = base + span * f * 0.86 - (k === 0 ? 0 : 0.1);
    const H = k === sp.tiers - 1 ? top - y0 : span * (1.55 / sp.tiers) + 0.25;
    const R = sp.r * (1 - f * 0.72) * (0.95 + rng() * 0.1);
    const rot = rng() * Math.PI * 2;
    const apex = V((rng() - 0.5) * 0.08, y0 + H, (rng() - 0.5) * 0.08);
    const green = k % 2 === 0 ? PALETTE.pine : PALETTE.pineLight;
    const rim = [];
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.3;
      const r = R * (0.88 + rng() * 0.24);
      rim.push(V(Math.sin(a) * r, y0 + (rng() - 0.5) * 0.14, Math.cos(a) * r));
    }
    const axisLow = V(0, y0 - H, 0);
    const underC = V(0, y0 + H * 0.3, 0);
    for (let i = 0; i < n; i++) {
      const p0 = rim[i], p1 = rim[(i + 1) % n];
      m.tri(apex, p0, p1, green, axisLow);
      m.tri(underC, p1, p0, PALETTE.pineUnder, V(0, y0 + H * 2, 0));
    }
    // 雪殼：apex → 鋸齒邊（偶數=垂下的雪舌，奇數=縮回），外推 e，再加一圈裙邊做厚度
    const e = 0.1 + R * 0.03;
    const shellRim = [];
    const skirtRim = [];
    for (let i = 0; i < 2 * n; i++) {
      const j = i >> 1;
      const edge = i % 2 === 0 ? rim[j] : V().addVectors(rim[j], rim[(j + 1) % n]).multiplyScalar(0.5);
      const fr = i % 2 === 0 ? 0.74 + rng() * 0.16 : 0.46 + rng() * 0.1;
      const onSurf = V().lerpVectors(apex, edge, fr);
      const out = V(onSurf.x, 0, onSurf.z).normalize();
      shellRim.push(onSurf.clone().addScaledVector(out, e).add(V(0, e * 0.8, 0)));
      skirtRim.push(V().lerpVectors(apex, edge, Math.min(1, fr + 0.05)).addScaledVector(out, 0.01));
    }
    const shellApex = apex.clone().add(V(0, e * 1.6, 0));
    for (let i = 0; i < 2 * n; i++) {
      const a = shellRim[i], b = shellRim[(i + 1) % (2 * n)];
      m.tri(shellApex, a, b, PALETTE.snow, axisLow);
      const c = skirtRim[(i + 1) % (2 * n)], d = skirtRim[i];
      const cy = (a.y + b.y + c.y + d.y) / 4;
      m.quad(a, b, c, d, PALETTE.snowBlue, V(0, cy + 0.2, 0));
    }
  }
  parts.push(m.build());
  return merge(parts);
}

// ---------- 岩石 ----------
function buildRock(variant) {
  const specs = [
    { w: 1.6, h: 1.2, d: 1.35, detail: 1, poly: 'ico' },
    { w: 2.2, h: 1.65, d: 1.8, detail: 1, poly: 'ico' },
    { w: 1.25, h: 1.1, d: 1.1, detail: 0, poly: 'dodeca' },
  ];
  const sp = specs[variant];
  const parts = [];
  const mk = (w, h, d, p, detail, poly, seed, snowLine) => {
    let g = poly === 'dodeca' ? new THREE.DodecahedronGeometry(0.5, detail) : new THREE.IcosahedronGeometry(0.5, detail);
    jitter(g, 0.07, seed);
    xf(g, [p[0], p[1] + h / 2, p[2]], [0, seed * 0.7, 0], [w, h, d]);
    const top = p[1] + h;
    const bottom = p[1];
    return paint(g, (out, cen, n) => {
      const hy = (cen.y - bottom) / (top - bottom);
      if (n.y > 0.42 && hy > snowLine) out.set(n.y > 0.8 ? PALETTE.snow : PALETTE.snowShade);
      else if (n.y < -0.2) out.set(PALETTE.rockDark);
      else out.set(n.x + n.z > 0.3 ? PALETTE.rockLight : PALETTE.rock);
    }, seed);
  };
  const sink = -0.18;
  parts.push(mk(sp.w, sp.h, sp.d, [0, sink, 0], sp.detail, sp.poly, variant + 5, 0.38));
  if (variant === 2) {
    parts.push(mk(0.55, 0.4, 0.5, [0.62, sink, 0.25], 1, 'ico', 9, 0.4));
  }
  if (variant === 1) {
    parts.push(mk(0.7, 0.45, 0.6, [-0.95, sink, 0.35], 0, 'ico', 13, 0.3));
  }
  return merge(parts);
}

// ---------- 柵欄 ----------
function buildFencePost() {
  const parts = [];
  const post = xf(new THREE.CylinderGeometry(0.12, 0.135, 1.6, 6, 1, true), [0, 0.5, 0], [0, 0.3, 0]);
  jitter(post, 0.012, 3, [1, 0, 1]);
  parts.push(paint(post, (o, c, n) => o.set(n.x > 0.3 || n.z < -0.6 ? PALETTE.woodLight : PALETTE.wood), 2));
  const cap = new THREE.LatheGeometry([V(0.165, 1.24), V(0.17, 1.3), V(0.12, 1.38), V(0.0, 1.41)], 6, 0.3);
  jitter(cap, 0.01, 4, [1, 1, 1]);
  parts.push(paint(cap, snowFn, 5));
  return merge(parts);
}

function buildFenceRail() {
  const parts = [];
  const rails = [
    { y: 0.52, col: PALETTE.wood },
    { y: 0.98, col: PALETTE.woodDark },
  ];
  for (const r of rails) {
    parts.push(paint(xf(new THREE.BoxGeometry(0.09, 0.16, 1), [0, r.y, -0.5]), (o, c, n) => o.set(n.y > 0.5 ? PALETTE.woodLight : r.col), 6));
    parts.push(paint(xf(new THREE.BoxGeometry(0.12, 0.05, 1), [0, r.y + 0.1, -0.5]), snowFn, 7));
  }
  return merge(parts);
}

// ---------- 旗門桿 ----------
// 旗幟掛在 +X 側、正反兩面都有圖騰。右側旗桿請繞 Y 轉 π 讓旗子朝賽道內。
function buildGatePole() {
  const parts = [];
  parts.push(paint(xf(new THREE.CylinderGeometry(0.06, 0.075, 3.35, 6), [0, 3.35 / 2 - 0.25, 0]), PALETTE.woodDark, 8));
  parts.push(paint(xf(new THREE.ConeGeometry(0.09, 0.2, 6), [0, 3.2, 0]), PALETTE.gold, 9));
  parts.push(paint(xf(new THREE.IcosahedronGeometry(0.075, 0), [0, 3.08, 0]), PALETTE.gold, 10));
  // 橫桿 + 雪
  parts.push(paint(xf(new THREE.BoxGeometry(0.8, 0.07, 0.07), [0.38, 2.95, 0]), PALETTE.wood, 11));
  parts.push(paint(xf(new THREE.BoxGeometry(0.72, 0.035, 0.09), [0.42, 3.0, 0]), snowFn, 12));

  const m = new Mesher(13);
  const x0 = 0.12, x1 = 0.74, xm = (x0 + x1) / 2;
  const yT = 2.9, yB = 1.62, yP = 1.36;
  const t = 0.018;
  const outline = [V(x0, yT), V(x1, yT), V(x1, yB), V(xm, yP), V(x0, yB)];
  for (const s of [1, -1]) {
    const z = s * t;
    const P = (v) => V(v.x, v.y, z);
    const outRef = V(xm, (yT + yB) / 2, -s);
    m.quad(P(outline[0]), P(outline[1]), P(outline[2]), P(outline[4]), PALETTE.banner, outRef);
    m.tri(P(outline[4]), P(outline[2]), P(outline[3]), PALETTE.banner, outRef);
    // 頂部金色飾帶
    const zz = s * (t + 0.004);
    m.quad(V(x0, yT - 0.04, zz), V(x1, yT - 0.04, zz), V(x1, yT - 0.11, zz), V(x0, yT - 0.11, zz), PALETTE.gold, outRef);
    // 山形圖騰：粗 Λ + 小內峰
    const cy = 2.1, pk = 2.62, w = 0.21, th = 0.085;
    const L0 = V(xm - w, cy, zz), L1 = V(xm - w + th * 1.3, cy, zz);
    const T0 = V(xm, pk, zz), T1 = V(xm, pk - th * 1.9, zz);
    const R0 = V(xm + w, cy, zz), R1 = V(xm + w - th * 1.3, cy, zz);
    m.quad(L0, L1, T1, T0, PALETTE.emblem, outRef);
    m.quad(T0, T1, R1, R0, PALETTE.emblem, outRef);
    m.tri(V(xm - 0.07, cy + 0.02, zz), V(xm + 0.07, cy + 0.02, zz), V(xm, cy + 0.2, zz), PALETTE.emblem, outRef);
    m.quad(V(x0 + 0.05, 1.9, zz), V(x1 - 0.05, 1.9, zz), V(x1 - 0.05, 1.85, zz), V(x0 + 0.05, 1.85, zz), PALETTE.emblem, outRef);
  }
  // 旗幟邊緣厚度
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    const ctr = V(xm, (yT + yB) / 2, 0);
    m.quad(V(a.x, a.y, t), V(b.x, b.y, t), V(b.x, b.y, -t), V(a.x, a.y, -t), PALETTE.bannerDark, ctr);
  }
  // 掛環
  parts.push(m.build());
  for (const x of [x0 + 0.08, x1 - 0.08]) {
    parts.push(paint(xf(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 4, 1, true), [x, 2.92, 0]), PALETTE.gold, 14));
  }
  return merge(parts);
}

// ---------- 雲 ----------
function buildCloud() {
  const blobs = [
    [0, 4.2, 0, 6.2, 1],
    [-6.8, 3.0, 0.6, 4.6, 1],
    [6.6, 3.2, -0.5, 5.0, 1],
    [-11.5, 2.1, 0.2, 3.0, 0],
    [11.8, 2.2, 0.4, 3.1, 0],
    [-2.8, 7.2, 0.6, 3.6, 0],
  ];
  const parts = [];
  const floor = 1.2;
  blobs.forEach(([x, y, z, r, d], i) => {
    const g = ico(r, d, [x, y, z], [1, 0.72, 0.85], r * 0.06, 20 + i);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const yy = p.getY(k);
      if (yy < floor) p.setY(k, floor - (floor - yy) * 0.12);
    }
    parts.push(paint(g, (o, c, n) => o.set(n.y < -0.35 ? PALETTE.cloudUnder : n.y < 0.2 ? 0xeef3fa : PALETTE.cloud), 30 + i));
  });
  const g = merge(parts);
  g.translate(0, -1.0, 0);
  return g;
}

// ---------- 遠山 ----------
// 附圖的地平線是圓潤的雪丘（大而平滑的低多邊形圓頂），不是尖山：幾個壓扁的半球疊成一群。
function buildMountain() {
  const rng = mulberry32(C.seed + 777);
  const parts = [];
  const dome = (cx, cz, H, R, seg, rings, seed) => {
    const g = new THREE.SphereGeometry(1, seg, rings, rng() * Math.PI, Math.PI * 2, 0, Math.PI / 2);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
      const f = Math.min(1, Math.hypot(x, z));
      // 鐘形剖面：頂部圓、山腳平緩收進地面（半球的下緣太陡，遠看像岩壁）
      const bell = Math.pow(Math.max(0, 1 - f * f), 1.6);
      const h = hash2(Math.round(x * 97) * 131 + Math.round(z * 97), Math.round(y * 97), seed);
      const edge = y < 0.02;
      const rr = edge ? 1.12 : 1 + (h - 0.5) * 0.14;
      p.setXYZ(k, cx + x * R * rr, edge ? -40 : H * bell * (1 + (h - 0.5) * 0.06), cz + z * R * rr);
    }
    const out = paint(g, (o, c, n) => o.set(n.y > 0.8 ? PALETTE.mountainSnow : n.y > 0.5 ? PALETTE.mountainShade : PALETTE.mountainRock), seed);
    // 平滑法線（解析鐘形曲面）：色塊仍是逐面，但光影柔和 → 附圖那種圓潤雪丘
    const q = out.attributes.position;
    const nrm = out.attributes.normal;
    for (let k = 0; k < q.count; k++) {
      const dx = q.getX(k) - cx, dz = q.getZ(k) - cz;
      const r = Math.hypot(dx, dz);
      const fr = Math.min(0.999, r / R);
      const dydr = r > 1e-3 ? (H * 1.6 * Math.pow(1 - fr * fr, 0.6) * 2 * fr) / R : 0;
      _n.set((dydr * dx) / Math.max(r, 1e-3), 1, (dydr * dz) / Math.max(r, 1e-3)).normalize();
      nrm.setXYZ(k, _n.x, _n.y, _n.z);
    }
    parts.push(out);
  };
  dome(0, 0, 120, 320, 16, 5, 41);
  dome(-300, 80, 85, 240, 12, 4, 42);
  dome(310, 60, 95, 250, 12, 4, 43);
  dome(-130, -130, 70, 190, 10, 4, 44);
  dome(160, -160, 60, 170, 10, 4, 45);
  return merge(parts);
}

// ---------- 跳台 ----------
function buildRamp(width, length, height) {
  const m = new Mesher(50);
  const N = C.rampSegments;
  const hw = width / 2;
  const bottom = -0.5;
  const band = 0.12;
  const topY = (s) => height * rampProfile(s / length);
  const ctr = V(0, height * 0.3 - 0.6, -length * 0.5);
  for (let i = 0; i < N; i++) {
    const s0 = (i / N) * length, s1 = ((i + 1) / N) * length;
    const y0 = topY(s0), y1 = topY(s1);
    // 頂面：兩側木邊條 + 中間雪面（壓雪紋交錯），最後一段唇口警示色
    const trim = Math.min(0.3, width * 0.08);
    const lip = i === N - 1;
    const cols = [
      [-hw, -hw + trim, PALETTE.woodLight],
      [-hw + trim, 0, lip ? PALETTE.marker : i % 2 ? PALETTE.snow : 0xe6eef8],
      [0, hw - trim, lip ? PALETTE.marker : i % 2 ? PALETTE.snow : 0xe6eef8],
      [hw - trim, hw, PALETTE.woodLight],
    ];
    for (const [xa, xb, col] of cols) {
      m.quad(V(xa, y0, -s0), V(xb, y0, -s0), V(xb, y1, -s1), V(xa, y1, -s1), col, V(0, -10, -length / 2));
    }
    // 側面：上緣雪帶 + 木板（依段落交錯色）
    const wood = i % 2 === 0 ? PALETTE.wood : PALETTE.woodDark;
    for (const x of [-hw, hw]) {
      const o = V(0, (y0 + y1) / 2 - 0.3, -(s0 + s1) / 2);
      m.quad(V(x, y0, -s0), V(x, y1, -s1), V(x, y1 - band, -s1), V(x, y0 - band, -s0), PALETTE.snowShade, o);
      m.quad(V(x, y0 - band, -s0), V(x, y1 - band, -s1), V(x, bottom, -s1), V(x, bottom, -s0), wood, o);
    }
  }
  // 唇口面 + 前緣面
  const h = topY(length);
  m.quad(V(-hw, h, -length), V(hw, h, -length), V(hw, h - band, -length), V(-hw, h - band, -length), PALETTE.snowShade, ctr);
  m.quad(V(-hw, h - band, -length), V(hw, h - band, -length), V(hw, bottom, -length), V(-hw, bottom, -length), PALETTE.woodDark, ctr);
  m.quad(V(-hw, 0, 0), V(hw, 0, 0), V(hw, bottom, 0), V(-hw, bottom, 0), PALETTE.woodDark, ctr);
  // 唇口橫梁（貼在唇口面上，不改變頂面）
  const parts = [m.build()];
  parts.push(paint(xf(new THREE.BoxGeometry(width + 0.1, 0.16, 0.1), [0, h - band - 0.1, -length - 0.05]), PALETTE.woodLight, 51));
  // 唇口兩側標示竿
  for (const sx of [-1, 1]) {
    const x = sx * (hw + 0.25);
    const pole = new THREE.CylinderGeometry(0.035, 0.04, h + 1.3, 5);
    xf(pole, [x, (h + 1.3) / 2 - 0.4, -length + 0.15]);
    parts.push(paint(pole, (o, c) => o.set(Math.floor((c.y + 0.4) / 0.3) % 2 === 0 ? PALETTE.marker : PALETTE.snow), 52));
  }
  return merge(parts);
}

// ---------- 滑雪者 ----------
function buildSkierGeoms() {
  const P = PALETTE;
  const G = {};

  // torso（local 原點 = hips）
  {
    const parts = [];
    const coat = new THREE.LatheGeometry(
      [V(0.275, -0.22), V(0.25, -0.05), V(0.24, 0.12), V(0.255, 0.3), V(0.22, 0.44), V(0.12, 0.53), V(0.0, 0.555)],
      8,
    );
    xf(coat, [0, 0, 0], [0, Math.PI / 8, 0], [1, 1, 0.8]);
    parts.push(paint(coat, (o, c, n) => o.set(c.y < 0.02 ? P.coatDark : P.coat), 60));
    parts.push(paint(jitter(xf(new THREE.CylinderGeometry(0.285, 0.295, 0.1, 9, 1, true), [0, -0.19, 0], [0, 0, 0], [1, 1, 0.84]), 0.014, 61), P.fur, 61));
    parts.push(paint(xf(new THREE.CylinderGeometry(0.258, 0.258, 0.08, 8, 1, true), [0, 0.02, 0], [0, Math.PI / 8, 0], [1, 1, 0.82]), P.belt, 62));
    parts.push(paint(xf(new THREE.BoxGeometry(0.1, 0.075, 0.03), [0, 0.02, -0.215]), P.gold, 63));
    // 毛領
    parts.push(paint(jitter(xf(new THREE.TorusGeometry(0.165, 0.092, 5, 9), [0, 0.49, 0.0], [Math.PI / 2, 0, 0], [1, 1, 0.9]), 0.016, 64), (o, c, n) => o.set(n.y < -0.2 ? P.furShade : P.fur), 64));
    // 肩部毛皮
    for (const sx of [-1, 1]) parts.push(paint(ico(0.1, 0, [sx * 0.2, 0.45, 0.01], [1.25, 0.75, 1.1], 0.012, 65 + sx), P.fur, 65));
    // 背後圓盾
    const shield = xf(new THREE.CylinderGeometry(0.22, 0.22, 0.045, 10), [0, 0.25, 0.225], [Math.PI / 2 - 0.12, 0, 0]);
    parts.push(paint(shield, (o, c, n) => {
      if (Math.abs(n.z) > 0.8) {
        const ang = Math.atan2(c.x, c.y - 0.25);
        const w = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 10 + 0.5) % 2;
        o.set(w ? P.wood : P.woodDark); // 木盾（附圖角色背面以棕色皮革 / 毛皮為主，紅白圖騰太搶眼）
      } else o.set(P.metal);
    }, 66));
    parts.push(paint(ico(0.06, 0, [0, 0.25, 0.26], [1, 1, 0.7]), P.metal, 67));
    // 斜背帶
    parts.push(paint(xf(new THREE.BoxGeometry(0.06, 0.62, 0.02), [0.0, 0.25, -0.2], [0.12, 0, 0.72]), P.leather, 68));
    G.torso = merge(parts);
  }

  // head（local 原點 = 脖子，torso 內 y=0.55）
  {
    const parts = [];
    parts.push(paint(ico(0.15, 1, [0, 0.17, -0.01], [1, 1.05, 1]), P.skin, 70));
    parts.push(paint(ico(0.048, 0, [0, 0.14, -0.158]), P.nose, 71));
    for (const sx of [-1, 1]) {
      parts.push(paint(xf(new THREE.BoxGeometry(0.032, 0.042, 0.02), [sx * 0.056, 0.185, -0.142]), P.eye, 72));
      parts.push(paint(xf(new THREE.BoxGeometry(0.075, 0.028, 0.035), [sx * 0.06, 0.222, -0.14], [0, 0, sx * -0.2]), P.beardDark, 73));
    }
    // 頭盔
    parts.push(paint(xf(new THREE.SphereGeometry(0.175, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2), [0, 0.235, 0], [0, 0, 0], [1, 0.95, 1.03]), P.helmet, 74));
    parts.push(paint(xf(new THREE.CylinderGeometry(0.182, 0.182, 0.05, 9, 1, true), [0, 0.24, 0], [0, 0, 0], [1, 1, 1.03]), P.helmetDark, 75));
    parts.push(paint(xf(new THREE.BoxGeometry(0.03, 0.11, 0.025), [0, 0.2, -0.176]), P.helmetDark, 76));
    parts.push(paint(xf(new THREE.BoxGeometry(0.035, 0.03, 0.34), [0, 0.4, 0], [0, 0, 0]), P.helmetDark, 77));
    // 頭盔上的橘色鬃冠（附圖角色背影最醒目的剪影）
    for (let i = 0; i < 6; i++) {
      const phi = -0.45 + i * 0.38; // 從額頂一路到後腦，背後看得到一排橘色尖刺
      const h = 0.15 - Math.abs(i - 2) * 0.012;
      const ny = Math.cos(phi), nz = Math.sin(phi);
      const r = 0.168 + h * 0.4;
      parts.push(paint(xf(new THREE.ConeGeometry(0.05, h, 5), [0, 0.235 + ny * r, nz * r], [phi, 0, 0], [1.0, 1, 0.9]), i % 2 ? P.beardDark : P.beard, 89));
    }
    // 牛角
    for (const sx of [-1, 1]) {
      const pts = [V(sx * 0.15, 0.3, 0), V(sx * 0.255, 0.33, -0.01), V(sx * 0.32, 0.42, -0.02), V(sx * 0.335, 0.53, -0.02)];
      const rad = [0.05, 0.04, 0.026, 0.004];
      for (let i = 0; i < 3; i++) {
        parts.push(paint(limb(pts[i], pts[i + 1], rad[i], rad[i + 1], 6, i === 0), i === 2 ? P.hornTip : P.horn, 78));
      }
      parts.push(paint(ico(rad[1], 0, [pts[1].x, pts[1].y, pts[1].z]), P.horn, 79));
    }
    // 後腦頭髮 + 辮子
    parts.push(paint(ico(0.16, 1, [0, 0.1, 0.055], [1.06, 0.82, 0.92], 0.018, 80), P.beard, 80));
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        parts.push(paint(ico(0.045 - i * 0.004, 0, [sx * (0.085 + i * 0.01), 0.0 - i * 0.075, 0.14 + i * 0.012], [1, 1.2, 1]), i % 2 ? P.beardDark : P.beard, 81 + i));
      }
      parts.push(paint(ico(0.028, 0, [sx * 0.11, -0.2, 0.18]), P.leather, 84));
    }
    // 大鬍子
    parts.push(paint(ico(0.155, 1, [0, -0.035, -0.1], [1.12, 1.0, 0.8], 0.018, 85), P.beard, 85));
    parts.push(paint(ico(0.115, 0, [0, -0.17, -0.12], [1.0, 1.25, 0.8], 0.012, 86), P.beardDark, 86));
    for (const sx of [-1, 1]) {
      parts.push(paint(ico(0.085, 0, [sx * 0.12, 0.05, -0.06], [1, 1.2, 1], 0.01, 87), P.beard, 87));
      parts.push(paint(ico(0.062, 0, [sx * 0.058, 0.098, -0.165], [1.5, 0.55, 0.8], 0, 88), P.beardDark, 88));
    }
    G.head = merge(parts);
  }

  // armL（local 原點 = 左肩，外側 = -X）
  const hand = V(-0.05, -0.4, -0.31);
  {
    const parts = [];
    const elbow = V(-0.055, -0.27, -0.03);
    const wrist = V(-0.05, -0.37, -0.24);
    parts.push(paint(ico(0.085, 0, [0, 0, 0]), P.coat, 90));
    parts.push(paint(limb(V(0, 0, 0), elbow, 0.078, 0.07, 7, true), P.coat, 91));
    parts.push(paint(ico(0.07, 0, [elbow.x, elbow.y, elbow.z]), P.coatDark, 92));
    parts.push(paint(limb(elbow, wrist, 0.068, 0.062, 7, true), P.coat, 93));
    const cuffA = V().lerpVectors(elbow, wrist, 0.82);
    const cuffB = V().lerpVectors(elbow, wrist, 1.08);
    parts.push(paint(jitter(limb(cuffA, cuffB, 0.086, 0.084, 7), 0.01, 94), P.fur, 94));
    parts.push(paint(ico(0.068, 0, [hand.x, hand.y, hand.z], [1, 1.1, 1.2], 0.006, 95), P.glove, 95));
    parts.push(paint(ico(0.03, 0, [hand.x + 0.05, hand.y + 0.03, hand.z - 0.03]), P.glove, 96));
    G.armL = merge(parts);
  }
  G.hand = hand;

  // poleL（local 原點 = 手心握點）
  {
    const parts = [];
    const d = V(-0.08, -0.8, 0.6).normalize();
    const top = V(0, 0.09, 0);
    const gripEnd = d.clone().multiplyScalar(0.1);
    const tip = d.clone().multiplyScalar(1.18);
    parts.push(paint(limb(top, gripEnd, 0.022, 0.02, 5), P.grip, 97));
    parts.push(paint(limb(gripEnd, tip, 0.012, 0.009, 5, true), P.pole, 98));
    const bc = d.clone().multiplyScalar(1.07);
    parts.push(paint(limb(bc.clone().addScaledVector(d, -0.008), bc.clone().addScaledVector(d, 0.008), 0.05, 0.05, 6), P.ski, 99));
    parts.push(paint(limb(tip, tip.clone().addScaledVector(d, 0.04), 0.009, 0.001, 4, true), P.grip, 100));
    G.poleL = merge(parts);
  }

  // thigh（local 原點 = 髖關節）
  {
    const parts = [];
    parts.push(paint(limb(V(0, 0.03, 0), V(0, -0.45, 0), 0.1, 0.086, 7, true), P.trousers, 101));
    for (const y of [-0.22, -0.36]) parts.push(paint(xf(new THREE.CylinderGeometry(0.095, 0.097, 0.03, 7, 1, true), [0, y, 0]), P.leather, 102));
    G.thigh = merge(parts);
  }
  // shin + boot（local 原點 = 膝，腳底在 y=-0.45）
  {
    const parts = [];
    parts.push(paint(ico(0.084, 0, [0, 0, 0]), P.trousers, 103));
    parts.push(paint(limb(V(0, 0, 0), V(0, -0.22, 0), 0.082, 0.082, 7, true), P.trousers, 104));
    parts.push(paint(xf(new THREE.CylinderGeometry(0.1, 0.105, 0.22, 8, 1, true), [0, -0.3, 0]), P.boot, 105));
    parts.push(paint(jitter(xf(new THREE.CylinderGeometry(0.12, 0.118, 0.075, 8), [0, -0.195, 0]), 0.012, 106), (o, c, n) => o.set(n.y < -0.5 ? P.furShade : P.fur), 106));
    parts.push(paint(xf(new THREE.BoxGeometry(0.15, 0.1, 0.27), [0, -0.38, -0.07]), P.boot, 107));
    parts.push(paint(ico(0.078, 0, [0, -0.385, -0.19], [1, 0.72, 1.1]), P.boot, 108));
    parts.push(paint(xf(new THREE.BoxGeometry(0.16, 0.035, 0.34), [0, -0.4325, -0.075]), P.sole, 109));
    parts.push(paint(xf(new THREE.BoxGeometry(0.165, 0.03, 0.05), [0, -0.33, -0.05]), P.leather, 110));
    G.shin = merge(parts);
  }
  // ski（local 原點 = 雪板底面中心）
  {
    const parts = [];
    const ski = new THREE.BoxGeometry(0.1, 0.03, 1.7, 3, 1, 9);
    ski.translate(0, 0.015, 0);
    const p = ski.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i);
      let y = p.getY(i);
      if (z < -0.5) {
        const t = (-z - 0.5) / 0.35;
        y += 0.13 * t * t;
      } else if (z > 0.66) {
        const t = (z - 0.66) / 0.19;
        y += 0.03 * t * t;
      }
      p.setY(i, y);
    }
    parts.push(paint(ski, (o, c, n) => {
      if (n.y > 0.3) o.set(Math.abs(c.x) < 0.017 ? P.skiStripe : P.ski);
      else if (n.y < -0.3) o.set(P.skiBase);
      else o.set(P.skiDark);
    }, 111));
    parts.push(paint(xf(new THREE.BoxGeometry(0.085, 0.022, 0.3), [0, 0.041, -0.06]), P.binding, 112));
    parts.push(paint(xf(new THREE.BoxGeometry(0.075, 0.04, 0.07), [0, 0.05, 0.13]), P.metal, 113));
    parts.push(paint(xf(new THREE.BoxGeometry(0.075, 0.035, 0.05), [0, 0.048, -0.25]), P.metal, 114));
    G.ski = merge(parts);
  }
  return G;
}

// ---------- 對外 ----------
export function createAssets() {
  const vc = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  vc.name = 'vc';
  // snow / wood：同樣吃 vertex color（幾何必須帶 color attribute），各自一份方便個別調整
  const snow = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  snow.name = 'snow';
  const wood = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  wood.name = 'wood';
  // 不吃 vertex color 的純色版本（給沒有 color attribute 的幾何用）
  const snowSolid = new THREE.MeshLambertMaterial({ color: PALETTE.snow, flatShading: true });
  snowSolid.name = 'snowSolid';
  // 遠景（山、雲）用：不受霧影響
  const distant = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: false });
  distant.name = 'distant';

  const geometries = {
    pine: [buildPine(0), buildPine(1), buildPine(2)],
    rock: [buildRock(0), buildRock(1), buildRock(2)],
    fencePost: buildFencePost(),
    fenceRail: buildFenceRail(),
    gatePole: buildGatePole(),
    cloud: buildCloud(),
    mountain: buildMountain(),
  };

  let skierGeoms = null;
  let skierTris = null;

  function createRamp(width, length, height) {
    const mesh = new THREE.Mesh(buildRamp(width, length, height), vc);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'ramp';
    mesh.userData = { width, length, height };
    return mesh;
  }

  function createSkier() {
    if (!skierGeoms) skierGeoms = buildSkierGeoms();
    const G = skierGeoms;
    const mk = (geo, name) => {
      const mesh = new THREE.Mesh(geo, vc);
      mesh.castShadow = true;
      mesh.name = name;
      return mesh;
    };
    const grp = (name, x = 0, y = 0, z = 0) => {
      const g = new THREE.Group();
      g.name = name;
      g.position.set(x, y, z);
      return g;
    };
    if (!G.armR) {
      G.armR = mirrorX(G.armL);
      G.poleR = mirrorX(G.poleL);
    }

    const root = grp('skier');
    const body = grp('body');
    const hips = grp('hips', 0, 0.95, 0);
    const torso = grp('torso');
    const head = grp('head', 0, 0.55, 0);
    const armL = grp('armL', -0.26, 0.45, 0);
    const armR = grp('armR', 0.26, 0.45, 0);
    const poleL = grp('poleL', G.hand.x, G.hand.y, G.hand.z);
    const poleR = grp('poleR', -G.hand.x, G.hand.y, G.hand.z);
    const thighL = grp('thighL', -0.13, 0, 0);
    const thighR = grp('thighR', 0.13, 0, 0);
    const shinL = grp('shinL', 0, -0.45, 0);
    const shinR = grp('shinR', 0, -0.45, 0);
    const skiL = grp('skiL', -0.13, 0, 0);
    const skiR = grp('skiR', 0.13, 0, 0);

    root.add(body);
    body.add(hips, skiL, skiR);
    hips.add(torso, thighL, thighR);
    torso.add(mk(G.torso, 'torsoMesh'), head, armL, armR);
    head.add(mk(G.head, 'headMesh'));
    armL.add(mk(G.armL, 'armLMesh'), poleL);
    armR.add(mk(G.armR, 'armRMesh'), poleR);
    poleL.add(mk(G.poleL, 'poleLMesh'));
    poleR.add(mk(G.poleR, 'poleRMesh'));
    thighL.add(mk(G.thigh, 'thighLMesh'), shinL);
    thighR.add(mk(G.thigh, 'thighRMesh'), shinR);
    const bootL = mk(G.shin, 'bootL');
    const bootR = mk(G.shin, 'bootR');
    shinL.add(bootL);
    shinR.add(bootR);
    skiL.add(mk(G.ski, 'skiLMesh'));
    skiR.add(mk(G.ski, 'skiRMesh'));

    const rig = { body, hips, torso, head, armL, armR, poleL, poleR, thighL, shinL, thighR, shinR, skiL, skiR };
    return { root, rig };
  }

  function triangleReport() {
    const r = {};
    geometries.pine.forEach((g, i) => (r['pine' + i] = triCount(g)));
    geometries.rock.forEach((g, i) => (r['rock' + i] = triCount(g)));
    r.fencePost = triCount(geometries.fencePost);
    r.fenceRail = triCount(geometries.fenceRail);
    r.gatePole = triCount(geometries.gatePole);
    r.cloud = triCount(geometries.cloud);
    r.mountain = triCount(geometries.mountain);
    const t = config.terrain || {};
    const rw = (t.rampHalfWidth || 3.2) * 2;
    const rl = Array.isArray(t.rampLength) ? t.rampLength[0] : 9;
    const rh = Array.isArray(t.rampHeight) ? t.rampHeight[0] : 1.6;
    r.ramp = triCount(buildRamp(rw, rl, rh));
    if (skierTris == null) {
      skierTris = 0;
      createSkier().root.traverse((o) => {
        if (o.isMesh) skierTris += triCount(o.geometry);
      });
    }
    r.skier = skierTris;
    return r;
  }

  return {
    materials: { vc, snow, wood, snowSolid, distant },
    geometries,
    palette: PALETTE,
    createRamp,
    createSkier,
    triangleReport,
  };
}
