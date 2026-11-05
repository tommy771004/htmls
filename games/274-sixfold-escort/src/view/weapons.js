// 六器鏢行：六器（截江刀、青鋒劍、白蠟長槍、鐵指虎、牛角弓、柳葉飛針）與背上的「六器匣」。
//
// 兵器本體是外部模型 blender/out/arms.glb（tools/models.json 的 arms 群組，pack-models.mjs 已轉成下面的握把座標系並定好尺寸），
// 打包時 gzip＋base64 內嵌成 <script id="glb-arms">；chars.js 的 loadActors() 會先 await loadArms()。
// 紅纓、劍穗、刀綢、鐏、飛針尾絲、箭與六器匣本身仍是程式建模。
//   截江刀 arm_dao（宋刀，0.95 m）｜青鋒劍 arm_jian（宋劍，0.95 m）｜白蠟長槍 arm_spear（2.2 m，原檔尾端的第二個槍頭已裁掉）
//   鐵指虎 arm_fist（0.11 m，雙手各一）｜牛角弓 arm_bow（1.2 m）＋箭筒 arm_quiver（掛在匣側）｜柳葉飛針 arm_knife（飛刀壓細縮短，三枚扇開）
//
// 兵器座標系（握把座標系，chars.js 依手骨量出）：+Y 沿握把指向兵器尖端（拳頭食指那側），
// +Z 是拳背／刃口方向，X = Y × Z。原點在握把中心。弓也是同一套：+Y 為上弓臂，弓弦在 −Z（朝向射手）。
// makeWeapon 回傳的 Group 與底下每個 mesh 都是單位矩陣（模型節點的位移縮放已烘進 Float32 幾何）：
// chars.js 的 introHold 直接寫 Group 的 quaternion，scene.js 的鍛器流光殼直接拿 mesh.geometry 套外殼。
// 六器匣座標系：原點在匣子中心，+Y 朝上，+Z 貼背（朝身體），−Z 是外面（銅鎖那面），+X 是人物左手側。
import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { vertexColor, positionLocal, mx_noise_float, vec3 } from 'three/tsl';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const WEAPON_TYPES = ['BLADE', 'SWORD', 'SPEAR', 'FIST', 'BOW', 'THROWN'];

// ── 程式建模零件的材質（全部用頂點色，四種表面） ──
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

// ── 外部模型（arms.glb） ──
// 各件在握把座標系裡量出來的位置（pack-models 之後，tools/models.json 改了 fit 要重量）
const DAO = { pommel: -0.181, guard: 0.056 }; // 刀首底、護手（宋刀柄長 0.24 m，握在靠護手那半）
const JIAN = { pommel: -0.114, guard: 0.044 };
const SPEAR = { butt: -0.77, tassel: 0.715 }; // 尾端套筒底（接鐏）、紅纓掛點（槍頭套筒上的箍；刃根在 0.83）
const STOW_SINK = 0.34, STOW_TILT = -0.2; // 匣中長槍下沉量、往 +X（人物左肩）斜的角度
const BOW_Z = -0.095; // 弓把在模型 +Z 0.095（弓臂往射手側彎），平移到握把軸上
// 指虎：指環那排在 +Z（出拳方向）。握把原點在握拳的指圈中間，FIST_Z 把指環推到近節指骨上；
// FIST_X 往手背那側移，讓打擊面落在指根關節下方。左右手握把座標系的 X 對手掌是鏡像，左手用 −FIST_X
const FIST_Z = -0.022;
const FIST_X = -0.022;
// 柳葉飛針：飛刀壓細（刃寬 ×0.32、厚 ×0.6）縮短 ×0.75，三枚沿 X 軸扇開
const NEEDLE_S = [0.6, 0.75, 0.32];
const NEEDLE_FAN = [-0.22, 0, 0.22];

let ARMS = null;
let armsLoading = null;
export function loadArms() {
  if (armsLoading) return armsLoading;
  armsLoading = (async () => {
    const el = document.getElementById('glb-arms');
    if (!el) throw new Error('缺少內嵌的兵器模型 #glb-arms');
    const bin = Uint8Array.from(atob(el.textContent.trim()), (c) => c.charCodeAt(0));
    const ab = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    const gltf = await new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej));
    gltf.scene.updateMatrixWorld(true);
    // 材質組態統一成「底色＋ORM」：沒有 ORM 的件掛一張共用的 1×1 白圖（係數照舊），
    // 全部兵器共用同一支著色器（SwiftShader 開場編譯一支燈光齊全的 PBR 著色器就要秒級）
    const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    white.needsUpdate = true;
    const unify = (m) => {
      if (m.userData.armUnified) return;
      m.userData.armUnified = true;
      m.normalMap = null;
      m.aoMap = null;
      m.emissiveMap = null;
      if (!m.roughnessMap) m.roughnessMap = white;
      if (!m.metalnessMap) m.metalnessMap = m.roughnessMap;
      m.vertexColors = false;
      m.side = THREE.DoubleSide;
      m.needsUpdate = true;
    };
    const lib = {};
    for (const root of gltf.scene.children) {
      if (!root.name.startsWith('m_')) continue;
      const inv = root.matrixWorld.clone().invert();
      const parts = [];
      root.traverse((o) => {
        if (!o.isMesh) return;
        unify(o.material);
        const g = floatGeo(o.geometry);
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
        parts.push({ geo: g, mat: o.material });
      });
      lib[root.name.slice(2)] = parts;
    }
    ARMS = lib;
  })();
  return armsLoading;
}

// KHR_mesh_quantization 的 Int16／Int8 屬性轉成 Float32（applyMatrix4 才不會把小數寫進整數陣列）
function floatGeo(src) {
  const g = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv']) {
    const a = src.attributes[k];
    if (!a) continue;
    const n = a.itemSize;
    const arr = new Float32Array(a.count * n);
    for (let i = 0; i < a.count; i++) {
      arr[i * n] = a.getX(i);
      if (n > 1) arr[i * n + 1] = a.getY(i);
      if (n > 2) arr[i * n + 2] = a.getZ(i);
    }
    g.setAttribute(k, new THREE.BufferAttribute(arr, n));
  }
  if (src.index) g.setIndex(new THREE.BufferAttribute(Uint32Array.from(src.index.array), 1));
  return g;
}

// 只留三角形質心 y（握把座標系，套 m 之前）符合 keep 的部分：匣中只露出柄或槍頭
function cutTris(geo, keep) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position;
  const tris = [];
  for (let t = 0; t < p.count; t += 3) if (keep((p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3)) tris.push(t);
  if (!tris.length) return null;
  const out = new THREE.BufferGeometry();
  for (const [k, a] of Object.entries(g.attributes)) {
    const n = a.itemSize;
    const arr = new Float32Array(tris.length * 3 * n);
    tris.forEach((t, j) => arr.set(a.array.subarray(t * n, (t + 3) * n), j * 3 * n));
    out.setAttribute(k, new THREE.BufferAttribute(arr, n));
  }
  return out;
}

// 一件模型 → 每個材質一個 mesh。ms：一或多個矩陣（多個時同材質合併成一個 mesh，例如三枚飛針）
function armMeshes(id, ms = [null], keep = null) {
  if (!ARMS) throw new Error('先 await loadArms()');
  const parts = ARMS[id];
  if (!parts) throw new Error(`兵器模型缺少 m_${id}`);
  const out = [];
  for (const { geo, mat } of parts) {
    const list = [];
    for (const m of [].concat(ms)) {
      const g = keep ? cutTris(geo, keep) : geo.clone();
      if (!g) continue;
      if (m) g.applyMatrix4(m);
      list.push(g); // 同一件來源，裁切與否全部一致（全有 index 或全沒有），mergeGeometries 才合得起來
    }
    if (!list.length) continue;
    const g = list.length > 1 ? mergeGeometries(list) : list[0];
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    out.push(mesh);
  }
  return out;
}

export const armsLoaded = () => !!ARMS;

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

// ── 程式補的配件 ──
// 劍穗：穗繩環＋結＋流蘇，掛在劍首下
function swordTassel(K, y) {
  K.add('matte', new THREE.TorusGeometry(0.009, 0.0022, 6, 14), COL.red, TR(0, y - 0.008, 0, 0, Math.PI / 2, 0));
  K.add('matte', new THREE.SphereGeometry(0.008, 10, 8), COL.red, T(0, y - 0.022, 0));
  K.add('brass', lathe([[0, y - 0.028], [0.006, y - 0.029], [0.0075, y - 0.036], [0.006, y - 0.042], [0, y - 0.043]], 10), COL.brassDk);
  tassel(K, new THREE.Vector3(0, y - 0.04, 0), 0.11, 0.022, 16, COL.red);
}

// 刀綢：刀首下兩條紅綢
function daoSilk(K, y) {
  for (const [dz, len, tw] of [[-0.006, 0.17, 0.4], [0.008, 0.13, -0.3]]) {
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      pts.push(new THREE.Vector3(Math.sin(t * 2.4) * 0.012 * tw, y - 0.012 - t * len, dz + t * t * 0.03 * Math.sign(tw)));
    }
    K.add('matte', ribbonGeo(pts, 0.022, 0.012), COL.silk);
  }
  K.add('matte', new THREE.SphereGeometry(0.009, 10, 8), COL.silk, M().compose(new THREE.Vector3(0, y - 0.008, 0), new THREE.Quaternion(), new THREE.Vector3(1.3, 0.9, 1)));
}

// 紅纓：從槍頭套筒的箍往四周散開下垂
function spearTassel(K, y) {
  const rnd = mulberry(11);
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2 + rnd() * 0.3;
    const L = 0.17 + rnd() * 0.07;
    const sp = 0.05 + rnd() * 0.035;
    const pts = [];
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      const r = 0.02 + sp * Math.sin(t * Math.PI * 0.55);
      pts.push(new THREE.Vector3(Math.cos(a) * r, y - t * L, Math.sin(a) * r));
    }
    K.add('matte', tube(pts, (t) => 0.0036 * (1 - t * 0.6), 3), COL.red.clone().multiplyScalar(0.7 + rnd() * 0.5));
  }
}

// 鐏：槍尾的鐵尖
function spearButt(K, y) {
  K.add('steel', lathe([[0, y - 0.075], [0.004, y - 0.068], [0.011, y - 0.03], [0.0165, y - 0.004], [0.017, y], [0, y]], 12), COL.iron);
}

function needleMatrices() {
  const s = new THREE.Vector3(...NEEDLE_S);
  return NEEDLE_FAN.map((a, i) => M().compose(new THREE.Vector3(0, 0.006, i * 0.002), new THREE.Quaternion().setFromEuler(new THREE.Euler(a, 0, 0)), s));
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

// ── 手上那把 ──
function buildHeld(type, left) {
  const grp = new THREE.Group();
  const K = new Kit();
  let meshes;
  if (type === 'BLADE') { meshes = armMeshes('arm_dao'); daoSilk(K, DAO.pommel); }
  else if (type === 'SWORD') { meshes = armMeshes('arm_jian'); swordTassel(K, JIAN.pommel); }
  else if (type === 'SPEAR') { meshes = armMeshes('arm_spear'); spearTassel(K, SPEAR.tassel); spearButt(K, SPEAR.butt); }
  else if (type === 'FIST') meshes = armMeshes('arm_fist', [T(left ? -FIST_X : FIST_X, 0, FIST_Z)]);
  else if (type === 'BOW') meshes = armMeshes('arm_bow', [T(0, 0, BOW_Z)]);
  else if (type === 'THROWN') {
    const ms = needleMatrices();
    meshes = armMeshes('arm_knife', ms);
    // 尾端紅絲：從飛針尾環往下飄
    for (const m of ms) {
      const tail = [];
      for (let k = 0; k <= 4; k++) tail.push(new THREE.Vector3(Math.sin(k) * 0.003, -0.022 - k * 0.012, 0));
      const p = new THREE.Vector3(), q = new THREE.Quaternion();
      m.decompose(p, q, new THREE.Vector3());
      K.add('matte', tube(tail, (t) => 0.0018 * (1 - t * 0.5), 3), COL.silk, M().compose(p, q, new THREE.Vector3(1, 1, 1)));
    }
  }
  for (const m of meshes || []) grp.add(m);
  for (const m of [...K.build().children]) grp.add(m);
  return grp;
}

const heldCache = new Map();
// left：左手那一份（目前只有鐵指虎左右不同）
export function makeWeapon(type, { left = false } = {}) {
  const key = left && type === 'FIST' ? 'FIST_L' : type;
  let tpl = heldCache.get(key);
  if (!tpl) {
    tpl = buildHeld(type, key === 'FIST_L');
    heldCache.set(key, tpl);
  }
  const g = tpl.clone();
  g.name = `weapon_${type}`;
  return g;
}

// ── 六器匣 ──
// 箭筒掛在匣子右側（人物右手那邊，−X），插四支箭。模型 0.29×0.45×0.19 m（含背帶），底在 y=0；
// 繞 Y 轉 180°：背帶（模型 −X）貼匣、小袋（模型 +Z）朝外；tilt 讓筒口略往外（−X）斜
// 縮 0.85（0.38 m 高）、往外（−Z）挪 3 cm：正面看不會從肩膀旁邊凸出一大截
const QUIVER = { x: -0.235, y: -0.2, z: -0.03, tilt: -0.12, ry: Math.PI, h: 0.45, s: 0.85 };
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
    // 箭筒（外部模型）＋筒裡四支箭
    const QK = new Kit();
    const qm = M().makeTranslation(QUIVER.x, QUIVER.y, QUIVER.z).multiply(R(0, QUIVER.ry, QUIVER.tilt)).multiply(M().makeScale(QUIVER.s, QUIVER.s, QUIVER.s));
    const mouth = new THREE.Vector3(0, QUIVER.h - 0.03, 0).applyMatrix4(qm);
    arrows(QK, 0, 0, 0);
    const am = M().makeTranslation(mouth.x, mouth.y, mouth.z).multiply(R(0, QUIVER.ry, QUIVER.tilt));
    for (const [k, list] of Object.entries(QK.parts)) for (const g of list) K.parts[k].push(g.applyMatrix4(am));
    caseGroup = K.build();
    for (const m of armMeshes('arm_quiver', [qm])) caseGroup.add(m);
  }
  const g = caseGroup.clone();
  g.name = 'sixfold_case';
  return g;
}

// 匣中的兵器：只露出柄或槍頭，插在各自的格子裡
// 刀劍：刃朝下插進格子、柄朝上（繞 Z 轉 180°），刃面沿匣寬（X）；護手落在格口上方一點，格子下面的刃身裁掉
function sheathMatrix(guard, x, z, tilt) {
  const top = CASE.H / 2 + 0.006;
  return M().makeTranslation(x, top + 0.012, z).multiply(R(0, 0, tilt)).multiply(R(0, Math.PI / 2, 0)).multiply(R(0, 0, Math.PI)).multiply(T(0, -guard, 0));
}

const stowCache = new Map();
export function makeStowed(type) {
  let grp = stowCache.get(type);
  if (!grp) {
    grp = new THREE.Group();
    const K = new Kit();
    const { H } = CASE;
    const [x, z] = SLOT[type];
    const top = H / 2 + 0.006;
    let meshes = [];
    if (type === 'SWORD' || type === 'BLADE') {
      // 柄朝上，劍穗／刀綢從朝上的柄首往下垂（在匣座標系裡另建，不跟著翻）
      const [id, P, tilt] = type === 'SWORD' ? ['arm_jian', JIAN, -0.1] : ['arm_dao', DAO, 0.1];
      const m = sheathMatrix(P.guard, x, z, tilt);
      meshes = armMeshes(id, [m], (y) => y < P.guard + 0.2);
      const head = new THREE.Vector3(0, P.pommel, 0).applyMatrix4(m);
      const sub = new Kit();
      if (type === 'SWORD') swordTassel(sub, 0.004);
      else daoSilk(sub, 0.004);
      for (const [k, list] of Object.entries(sub.parts)) for (const g of list) K.parts[k].push(g.applyMatrix4(T(head.x, head.y, head.z)));
    } else if (type === 'SPEAR') {
      // 槍頭朝上，往匣裡沉 STOW_SINK（槍頭 0.56 m，整支露出會高過頭頂近 0.4 m），往人物左肩斜一點避開後腦；
      // 紅纓不綁在套筒（已沉進匣裡）而是掛在格口那一截刃上，露出的槍尖只比頭頂高約 5 cm
      const at = SPEAR.tassel + STOW_SINK;
      const m = M().makeTranslation(x, top + 0.03, z).multiply(R(0, 0, STOW_TILT)).multiply(R(0, Math.PI / 2, 0)).multiply(T(0, -at, 0));
      meshes = armMeshes('arm_spear', [m], (y) => y > at - 0.32);
      const sub = new Kit();
      spearTassel(sub, at);
      for (const [k, list] of Object.entries(sub.parts)) for (const g of list) K.parts[k].push(g.applyMatrix4(m));
    } else if (type === 'BOW') {
      // 弓斜綁在匣子外面，格子裡插四支箭
      const m = M().makeTranslation(0, -0.02, -CASE.D / 2 - 0.035).multiply(R(0, Math.PI, -0.95)).multiply(M().makeScale(0.9, 0.9, 0.9)).multiply(T(0, 0, BOW_Z));
      meshes = armMeshes('arm_bow', [m]);
      arrows(K, x, top, z);
    } else if (type === 'THROWN') {
      // 針筒：銅口竹筒，露出三束紅絲
      const sub = new Kit();
      sub.add('matte', lathe([[0, 0], [0.016, 0], [0.016, 0.07], [0.0185, 0.074], [0.0185, 0.082], [0, 0.082]], 16), COL.bark);
      sub.add('brass', lathe([[0.0165, 0.06], [0.019, 0.062], [0.019, 0.082], [0.0165, 0.084]], 16), COL.brass);
      for (const a of [0, 2.1, 4.2]) sub.add('matte', tube([new THREE.Vector3(Math.cos(a) * 0.006, 0.08, Math.sin(a) * 0.006), new THREE.Vector3(Math.cos(a) * 0.012, 0.1, Math.sin(a) * 0.012), new THREE.Vector3(Math.cos(a) * 0.02, 0.105, Math.sin(a) * 0.02)], 0.0024, 4), COL.silk);
      const m = T(x, top - 0.05, z);
      for (const [k, list] of Object.entries(sub.parts)) for (const g of list) K.parts[k].push(g.applyMatrix4(m));
    } else if (type === 'FIST') {
      // 指虎立在格子裡：指環孔朝外（兵器 X → 匣 −Z）、長邊沿匣寬，指環那側朝上露出格口
      const m = M().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0)).setPosition(x, top - 0.004, z);
      meshes = armMeshes('arm_fist', [m]);
    }
    for (const mm of meshes) grp.add(mm);
    for (const mm of [...K.build().children]) grp.add(mm);
    // 匣中兵器只露出一小截：不投影（六器匣本身照投），省下陰影那一趟的 draw call（外部模型一種材質一個 mesh，比程式建模多）
    grp.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    stowCache.set(type, grp);
  }
  const g = grp.clone();
  g.name = `stowed_${type}`;
  return g;
}
