// 六器鏢行 — 程式建模工具：依「表面材質」收集幾何、合併成少數幾個 mesh（每種材質一個 draw call），
// 頂點色帶每件零件的細微色差。全部場景、怪物、偃甲、大堂都用這一套。
//
// 用法：const k = new Kit(); k.box('wood', 0x6b4c30, w, h, d, T(x, y, z, rx, ry, rz)); …; const g = k.build();
// 矩陣小工具 T(x, y, z, rx, ry, rz, sx, sy, sz)：先縮放、再旋轉（XYZ 歐拉角）、再平移。
import * as THREE from 'three';
import { MeshStandardNodeMaterial, MeshPhysicalNodeMaterial, MeshBasicNodeMaterial } from 'three/webgpu';
import {
  Fn, uniform, float, vec3, vertexColor, positionLocal, positionWorld, normalView, positionViewDirection,
  dot, max, pow, mix, sin, time, smoothstep, mx_noise_float, clamp, length, bool, attribute, fract,
} from 'three/tsl';

// ── 矩陣 ──
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
export function T(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz));
}
export const mul = (...ms) => ms.reduce((a, b) => a.multiply(b), new THREE.Matrix4());

// ── 可重現亂數（同一張地圖每次長得一樣） ──
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// ── 共用材質（頂點色 × 細噪點，邊緣一點天光色的邊緣光） ──
// uRim：地圖切換時改成天際色，讓物件輪廓帶一點大氣色，不是描黑邊。
export const uRim = uniform(new THREE.Color(0x9fb4b8));
export const uRimK = uniform(0.22);

function rimNode(k = 1) {
  const ndv = max(float(0.0), dot(normalView, positionViewDirection));
  return uRim.mul(pow(float(1).sub(ndv), float(3.2)).mul(uRimK).mul(k));
}

function surface({ rough = 0.85, metal = 0, grain = 0.12, scale = 3.0, stretch = null, rim = 1, side = THREE.FrontSide, wind = 0, emissive = null } = {}) {
  const m = new MeshStandardNodeMaterial({ roughness: rough, metalness: metal, side });
  m.vertexColors = true;
  const p = stretch ? positionLocal.mul(vec3(...stretch)) : positionLocal.mul(scale);
  const n1 = mx_noise_float(p);
  const n2 = mx_noise_float(p.mul(4.7));
  m.colorNode = vertexColor().mul(float(1).add(n1.mul(grain)).add(n2.mul(grain * 0.45)));
  const rn = rimNode(rim);
  m.emissiveNode = emissive ? vertexColor().mul(emissive).add(rn) : rn;
  if (wind > 0) {
    // 枝葉隨風：高度越高擺得越大（幾何以世界座標合併，positionLocal 就是世界座標）
    m.positionNode = Fn(() => {
      const h = max(positionLocal.y.sub(0.4), 0.0);
      const ph = positionLocal.x.mul(0.35).add(positionLocal.z.mul(0.27));
      const sway = sin(time.mul(1.6).add(ph)).mul(0.5).add(sin(time.mul(2.9).add(ph.mul(1.7))).mul(0.25));
      return positionLocal.add(vec3(sway.mul(h).mul(wind), 0, sway.mul(h).mul(wind * 0.6)));
    })();
  }
  // 貼鏡頭的道具（兵器架、柵欄、岩塊、矮牆）用點狀溶掉，不要變成橫過畫面的黑楔。
  // 追尾鏡頭離地至少約 2.4 m，地面不會被溶到；開場大堂 uSeeOn＝0 時不作用。
  m.maskNode = nearKeep();
  m.maskShadowNode = bool(true);
  return m;
}

// 離鏡頭很近的片段由實轉空（世界座標雜湊做點狀遮罩，比噪點便宜）。
// 溶解半徑 r0＝max(2.3 m, 鏡頭到主角距離 × 0.35)，從 r0 到 0.56·r0 漸空：鏡頭拉遠時（手機、上機）半徑跟著放大，
// 但仍小於鏡頭離地高度（1.35 + 距離 × sin(俯角 ≥ 0.32) > 0.35 × 距離，距離 ≤ 28），地面不會被溶到。
function nearFade() {
  const r0 = max(float(2.3), length(uSeeFocus.sub(uSeeCam)).mul(0.35));
  return smoothstep(r0, r0.mul(0.56), length(positionWorld.sub(uSeeCam))).mul(uSeeOn);
}
function stipple() {
  return fract(sin(dot(positionWorld.mul(7.3), vec3(12.9898, 78.233, 45.164))).mul(43758.5453));
}
// 視線圓錐：鏡頭到主角胸口之間、會蓋住主角的片段（屋簷、門樓、攤篷、匯入的建築）挖空。
// 圓錐頂點在鏡頭、在主角處半徑 uSeeR（站立 1.3 m、上機放大），所以地面、主角腳邊與主角背後的牆都不會被挖。
// 主角前方 1 m 內不算（t 接近 L 時漸弱），貼著主角的東西照常遮擋。
export const uSeeR = uniform(1.3);
function losFade() {
  const ab = uSeeFocus.sub(uSeeCam);
  const L = max(length(ab), float(1e-3));
  const dir = ab.div(L);
  const ap = positionWorld.sub(uSeeCam);
  const t = dot(ap, dir);
  const perp = length(ap.sub(dir.mul(t)));
  const rc = uSeeR.mul(max(t, 0.0)).div(L);
  return smoothstep(rc, rc.mul(0.55), perp).mul(smoothstep(L.sub(0.4), L.sub(1.1), t)).mul(smoothstep(0.0, 0.6, t)).mul(uSeeOn);
}
// Kit 合併的 mesh 共用 MAT：只有地圖場景（userData.see）才挖視線圓錐，怪物、偃甲、大堂不挖
const uSeeObj = uniform(0).onObjectUpdate(({ object }) => (object?.userData?.see ? 1 : 0));
// 整棟溶解（門樓這類鏡頭常卡在後面的建築）：scene.js 每幀判斷「鏡頭→主角」線段有沒有穿過那棟的盒子，
// 把 0..1 寫進 mesh.userData.fade（見 scenery.js 的 fadeGroups），這裡整件點狀溶掉。
const uObjFade = uniform(0).onObjectUpdate(({ object }) => object?.userData?.fade || 0);
function sceneFade() {
  return max(max(nearFade(), losFade().mul(uSeeObj)), uObjFade);
}
function nearKeep() {
  return stipple().greaterThanEqual(sceneFade().mul(1.02));
}

// ── 路邊樹透視：整棵樹擋在鏡頭與主角之間（或貼著鏡頭）時，用噪點溶掉整棵樹（只溶畫面，陰影照投） ──
// 每個頂點帶 tree 屬性 (cx, cy, cz, R)：所屬那棵樹的包圍球（Kit.tag 設定，見 scenery.js 的 willow）。
// scene.js 每幀更新 uSeeCam（鏡頭位置）、uSeeFocus（主角胸口）、uSeeOn（開場大堂時關掉）。
export const uSeeCam = uniform(new THREE.Vector3(0, 10, 10));
export const uSeeFocus = uniform(new THREE.Vector3(0, 1.2, 0));
export const uSeeOn = uniform(1);
function seeThrough(m) {
  const tc = attribute('tree', 'vec4');
  const C = tc.xyz, R = tc.w;
  const ab = uSeeFocus.sub(uSeeCam);
  const L2 = max(dot(ab, ab), float(1e-4));
  const tRaw = dot(C.sub(uSeeCam), ab).div(L2);
  const t = clamp(tRaw, 0.0, 1.0);
  const d = length(C.sub(uSeeCam.add(ab.mul(t))));
  // 擋線：樹的包圍球碰到「鏡頭→主角」線段（主角背後的樹不算）
  const block = smoothstep(R.add(1.4), R.add(0.2), d).mul(smoothstep(float(1.02), float(0.9), tRaw));
  // 貼鏡頭：樹離鏡頭比主角一半距離還近
  const near = smoothstep(R.add(length(ab).mul(0.55)), R.add(length(ab).mul(0.3)), length(C.sub(uSeeCam)));
  const fade = max(max(block, near).mul(uSeeOn).mul(R.greaterThan(0.0).select(float(1), float(0))), sceneFade());
  const n = mx_noise_float(positionWorld.mul(2.7)).mul(0.5).add(0.5);
  m.maskNode = n.greaterThanEqual(fade.mul(1.08));
  m.maskShadowNode = bool(true);
  return m;
}

// ── 匯入模型（glb）的材質：沿用原本的貼圖與 PBR 參數，換成節點材質並接上同一套透視溶解 ──
// whole：幾何帶 tree 屬性（那件的包圍球），擋在鏡頭與主角之間時整件溶掉（樹、雕像）；否則只挖視線圓錐。
// 一律只溶畫面、陰影照投。
export function sceneryMaterial(src, { whole = false } = {}) {
  const m = src.isMeshPhysicalMaterial ? new MeshPhysicalNodeMaterial() : new MeshStandardNodeMaterial();
  m.copy(src);
  m.name = src.name;
  if (!src.emissiveMap) m.emissiveNode = rimNode(0.6);
  if (whole) seeThrough(m);
  else {
    const n = mx_noise_float(positionWorld.mul(2.7)).mul(0.5).add(0.5);
    m.maskNode = n.greaterThanEqual(sceneFade().mul(1.08));
    m.maskShadowNode = bool(true);
  }
  return m;
}

export const MAT = {
  wood: surface({ rough: 0.78, grain: 0.22, stretch: [2.5, 14, 2.5] }),
  woodDark: surface({ rough: 0.62, grain: 0.1, stretch: [3, 18, 3] }), // 黑漆木
  stone: surface({ rough: 0.93, grain: 0.2, scale: 1.6 }),
  earth: surface({ rough: 0.97, grain: 0.26, stretch: [1.2, 5, 1.2] }), // 夯土：橫向層理
  cloth: surface({ rough: 0.95, grain: 0.08, scale: 9, side: THREE.DoubleSide }),
  bronze: surface({ rough: 0.42, metal: 0.62, grain: 0.18, scale: 5, rim: 0.7 }), // 金屬度不拉滿：夜裡環境暗，全金屬會變成黑剪影
  iron: surface({ rough: 0.52, metal: 0.75, grain: 0.14, scale: 6, rim: 0.4 }),
  leaf: surface({ rough: 0.85, grain: 0.25, scale: 2.2, side: THREE.DoubleSide, wind: 0.05 }),
  reed: surface({ rough: 0.9, grain: 0.15, scale: 3, side: THREE.DoubleSide, wind: 0.09 }),
  canopyWood: seeThrough(surface({ rough: 0.78, grain: 0.22, stretch: [2.5, 14, 2.5] })), // 路邊樹的幹與枝：跟樹冠一起透視
  canopy: seeThrough(surface({ rough: 0.85, grain: 0.25, scale: 2.2, side: THREE.DoubleSide, wind: 0.05 })), // 路邊樹冠：擋鏡頭時透視

  glow: (() => {
    const m = new MeshBasicNodeMaterial();
    m.vertexColors = true;
    m.colorNode = vertexColor().mul(float(1.0).add(sin(time.mul(2.3).add(positionLocal.x.mul(1.3).add(positionLocal.z))).mul(0.06)));
    return m;
  })(),
  paper: surface({ rough: 0.9, grain: 0.05, scale: 6, side: THREE.DoubleSide, emissive: 0.85 }), // 燈籠紙：自發光
};
// 材質是否投影（燈光、紙面不投影）
const NO_SHADOW = new Set(['glow', 'paper']);

export function makeSurface(opts) {
  return surface(opts);
}

// ── 幾何收集器 ──
const _c = new THREE.Color();
export class Kit {
  constructor(seed = 7) {
    this.parts = {};
    this.r = rng(seed);
  }

  // jitter：零件之間的明暗差（0.06 ＝ ±6%）
  add(mat, geo, color, matrix, jitter = 0.05) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
    if (this.tag) {
      // 路邊樹：每個頂點記下所屬那棵樹的包圍球，給 seeThrough 材質判斷要不要溶掉
      const n = g.attributes.position.count;
      const a = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) a.set(this.tag, i * 4);
      g.setAttribute('tree', new THREE.BufferAttribute(a, 4));
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.color) {
      _c.set(color);
      const j = 1 + (this.r() * 2 - 1) * jitter;
      const n = g.attributes.position.count;
      const c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { c[i * 3] = _c.r * j; c[i * 3 + 1] = _c.g * j; c[i * 3 + 2] = _c.b * j; }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    (this.parts[mat] || (this.parts[mat] = [])).push(g);
    geo !== g && geo.dispose?.();
    return this;
  }

  box(mat, color, w, h, d, m, jitter) { return this.add(mat, new THREE.BoxGeometry(w, h, d), color, m, jitter); }
  cyl(mat, color, rt, rb, h, seg, m, jitter, open = false) { return this.add(mat, new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), color, m, jitter); }
  sphere(mat, color, r, ws, hs, m, jitter) { return this.add(mat, new THREE.SphereGeometry(r, ws, hs), color, m, jitter); }
  cone(mat, color, r, h, seg, m, jitter) { return this.add(mat, new THREE.ConeGeometry(r, h, seg), color, m, jitter); }
  torus(mat, color, r, t, rs, ts, arc, m, jitter) { return this.add(mat, new THREE.TorusGeometry(r, t, rs, ts, arc), color, m, jitter); }

  // 兩點之間的圓柱（繩、桿、連桿）
  rod(mat, color, a, b, r, seg = 6, jitter) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const len = A.distanceTo(B);
    const g = new THREE.CylinderGeometry(r, r, len, seg, 1, false);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    const m = new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    return this.add(mat, g, color, m, jitter);
  }

  // 旋轉體：pts = [[r, y], …]
  lathe(mat, color, pts, seg, m, jitter) {
    return this.add(mat, new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), color, m, jitter);
  }

  // 擠出平面形狀（齒輪、匾額外框…），沿 +z 擠出 depth，再置中
  extrude(mat, color, shape, depth, m, jitter, bevel = 0) {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 10 });
    g.translate(0, 0, -depth / 2);
    return this.add(mat, g, color, m, jitter);
  }

  // 另一個 Kit 整包併進來（套矩陣）
  merge(other, m) {
    for (const [k, list] of Object.entries(other.parts)) {
      for (const g of list) {
        const c = g.clone();
        if (m) c.applyMatrix4(m);
        (this.parts[k] || (this.parts[k] = [])).push(c);
      }
    }
    return this;
  }

  // see：地圖場景用，擋在鏡頭與主角之間的部分挖視線圓錐（kit.js 的 losFade）
  build({ shadow = true, receive = true, name = '', see = false } = {}) {
    const grp = new THREE.Group();
    grp.name = name;
    for (const [k, list] of Object.entries(this.parts)) {
      if (!list.length) continue;
      const m = new THREE.Mesh(mergeGeos(list), MAT[k] || MAT.wood);
      m.castShadow = shadow && !NO_SHADOW.has(k);
      m.receiveShadow = receive;
      m.name = `${name}:${k}`;
      if (see) m.userData.see = true;
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
  const tree = list.some((g) => g.attributes.tree) ? new Float32Array(n * 4) : null; // 沒標的零件 R＝0，永遠不溶
  let o = 0;
  for (const g of list) {
    for (const a of ['position', 'normal', 'color']) out[a].set(g.attributes[a].array, o * 3);
    if (tree && g.attributes.tree) tree.set(g.attributes.tree.array, o * 4);
    o += g.attributes.position.count;
  }
  const geo = new THREE.BufferGeometry();
  for (const a of ['position', 'normal', 'color']) geo.setAttribute(a, new THREE.BufferAttribute(out[a], 3));
  if (tree) geo.setAttribute('tree', new THREE.BufferAttribute(tree, 4));
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

// ── 常用形狀 ──
// 齒輪輪廓（外齒 n 枚、可帶輪輻孔）
export function gearShape(rOut, rIn, teeth, { hole = 0, spokes = 0, rim = 0.18 } = {}) {
  const s = new THREE.Shape();
  const N = teeth * 4;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const ph = i % 4;
    const r = ph === 1 || ph === 2 ? rOut : rIn;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  if (spokes > 0) {
    const rr = rIn * (1 - rim);
    const hub = Math.max(hole * 1.9, rIn * 0.24);
    const w = rIn * 0.07; // 輪輻半寬
    for (let k = 0; k < spokes; k++) {
      const b0 = (k / spokes) * Math.PI * 2, b1 = ((k + 1) / spokes) * Math.PI * 2;
      const p = new THREE.Path();
      p.absarc(0, 0, rr, b0 + w / rr, b1 - w / rr, false);
      p.absarc(0, 0, hub, b1 - w / hub, b0 + w / hub, true);
      p.closePath();
      s.holes.push(p);
    }
  }
  if (hole > 0) {
    const h = new THREE.Path();
    h.absarc(0, 0, hole, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  return s;
}

// 中式屋頂（歇山簡化）：屋脊沿 x，簷口兩端起翹。回傳 BufferGeometry（單面加厚成兩層）
export function roofGeo(len, depth, rise, { curl = 0.35, overhang = 0.6, seg = 10 } = {}) {
  const L = len / 2 + overhang, D = depth / 2 + overhang;
  const pos = [];
  const pt = (u, v) => {
    // u ∈ [-1,1] 沿屋脊，v ∈ [0,1] 從屋脊到簷口
    const x = u * L;
    const z = v * D;
    const sag = Math.pow(v, 1.6) * 0.18 * rise; // 屋面內凹
    const end = Math.pow(Math.abs(u), 6) * curl * Math.pow(v, 2); // 四角起翹
    const y = rise * (1 - v) - sag + end + Math.pow(Math.abs(u), 8) * curl * 0.4;
    return [x, y, z];
  };
  for (const sd of [1, -1]) {
    for (let i = 0; i < seg; i++) {
      for (let j = 0; j < seg / 2; j++) {
        const u0 = -1 + (2 * i) / seg, u1 = -1 + (2 * (i + 1)) / seg;
        const v0 = j / (seg / 2), v1 = (j + 1) / (seg / 2);
        const a = pt(u0, v0), b = pt(u1, v0), c = pt(u1, v1), d = pt(u0, v1);
        for (const p of [a, b, c, d]) p[2] *= sd;
        if (sd > 0) pos.push(...a, ...d, ...c, ...a, ...c, ...b);
        else pos.push(...a, ...b, ...c, ...a, ...c, ...d);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// 屋瓦的瓦壟：在屋面上鋪一條條半圓筒（回傳要加進 Kit 的 [geo, matrix] 陣列，用同一張 pt 函式）
export function roofRidges(len, depth, rise, { curl = 0.35, overhang = 0.6, step = 0.32 } = {}) {
  const L = len / 2 + overhang, D = depth / 2 + overhang;
  const out = [];
  for (const sd of [1, -1]) {
    for (let x = -L + step / 2; x < L; x += step) {
      const u = x / L;
      const pts = [];
      for (let k = 0; k <= 6; k++) {
        const v = k / 6;
        const sag = Math.pow(v, 1.6) * 0.18 * rise;
        const end = Math.pow(Math.abs(u), 6) * curl * Math.pow(v, 2);
        const y = rise * (1 - v) - sag + end + Math.pow(Math.abs(u), 8) * curl * 0.4;
        pts.push(new THREE.Vector3(x, y + 0.03, v * D * sd));
      }
      out.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 6, 0.05, 4, false));
    }
  }
  return out;
}

// 平面上的字（匾額、招牌、旗面）：回傳 CanvasTexture
export function textTexture(text, { w = 512, h = 160, bg = '#1d1814', fg = '#d8b866', font = '"Songti TC","STSong","Noto Serif TC",serif', weight = 700, border = '#b08d48', vertical = false, size = 0.62 } = {}) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  if (bg) { c.fillStyle = bg; c.fillRect(0, 0, w, h); }
  if (border) {
    c.strokeStyle = border; c.lineWidth = Math.max(4, h * 0.05);
    c.strokeRect(c.lineWidth, c.lineWidth, w - c.lineWidth * 2, h - c.lineWidth * 2);
    c.lineWidth = Math.max(1.5, h * 0.012);
    c.strokeRect(h * 0.09, h * 0.09, w - h * 0.18, h - h * 0.18);
  }
  c.fillStyle = fg;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const chars = [...text];
  if (vertical) {
    const fs = Math.min(w * size, (h * 0.86) / chars.length);
    c.font = `${weight} ${fs}px ${font}`;
    chars.forEach((ch, i) => c.fillText(ch, w / 2, h * 0.07 + fs * (i + 0.5) + (h * 0.86 - fs * chars.length) / 2));
  } else {
    const fs = Math.min(h * size, (w * 0.84) / chars.length);
    c.font = `${weight} ${fs}px ${font}`;
    const gap = (w * 0.84) / chars.length;
    chars.forEach((ch, i) => c.fillText(ch, w * 0.08 + gap * (i + 0.5), h / 2 + fs * 0.04));
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// 鏢旗：三角旗、鋸齒火焰邊，旗面一個字。回傳平面幾何（x 從旗桿往外 0..len，y 置中）與貼圖
export function pennantTexture(char = '鏢', { bg = '#b23a24', edge = '#e0b24a', fg = '#f4ead2' } = {}) {
  const w = 256, h = 160;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, w, h);
  // 鋸齒邊（上下兩緣）
  c.fillStyle = edge;
  c.beginPath();
  c.moveTo(0, 0);
  const teeth = 9;
  for (let i = 0; i <= teeth; i++) {
    const x = (i / teeth) * (w - 10);
    const yTop = (x / w) * (h / 2) ;
    c.lineTo(x, yTop - (i % 2 ? 10 : 0));
  }
  c.lineTo(w, h / 2);
  for (let i = teeth; i >= 0; i--) {
    const x = (i / teeth) * (w - 10);
    const yBot = h - (x / w) * (h / 2);
    c.lineTo(x, yBot + (i % 2 ? 10 : 0));
  }
  c.closePath();
  c.fill();
  c.fillStyle = bg;
  c.beginPath();
  c.moveTo(0, 10); c.lineTo(w - 24, h / 2); c.lineTo(0, h - 10);
  c.closePath();
  c.fill();
  c.fillStyle = fg;
  c.font = `700 ${h * 0.42}px "Songti TC","STSong","Noto Serif TC",serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(char, w * 0.3, h / 2 + 4);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 單一貼圖平面材質（匾額、旗面），帶一點風擺
export function decalMaterial(tex, { wave = 0, alphaTest = 0.4, emissive = 0 } = {}) {
  const m = new MeshStandardNodeMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide, alphaTest });
  if (emissive) m.emissiveNode = vec3(emissive, emissive * 0.8, emissive * 0.55);
  // 掛在門樓上的匾額、旗面跟著那棟一起溶（userData.fade），貼近鏡頭時也點狀溶掉
  m.maskNode = stipple().greaterThanEqual(max(nearFade(), uObjFade).mul(1.02));
  m.maskShadowNode = bool(true);
  if (wave > 0) {
    m.positionNode = Fn(() => {
      const x = max(positionLocal.x, 0.0);
      const s = sin(time.mul(3.1).sub(x.mul(4.0))).mul(x).mul(wave);
      return positionLocal.add(vec3(0, s.mul(0.25), s));
    })();
  }
  return m;
}

// 世界座標的噪聲色斑（用於地面附近的物件褪色）
export function smoothMask(a, b, v) {
  return smoothstep(float(a), float(b), v);
}
export { mix };
