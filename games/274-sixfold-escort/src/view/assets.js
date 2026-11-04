// 六器鏢行 — 匯入模型庫：解內嵌的 <script id="glb-arch|nature|relics|props|goods">（gzip＋base64，build.mjs 產生），
// 依節點名 m_<id> 建索引（tools/models.json；正面朝 +Z、y=0 著地、x/z 置中）。兵器（glb-arms）歸 weapons.js，這裡不讀。
//
// getModel(id)：回傳一份 clone（幾何與材質共用，userData.sharedGeo，scene.js 換圖時不會 dispose）。
// 擺場景用 Batch：同一張圖裡同一件模型擺幾次都只算一個 draw call——每次擺放把矩陣烤進幾何、同材質合併成一個 mesh。
//   const b = new Batch(); b.add('barrel', x, y, z, ry, s); …; group.add(b.build());
// 材質一律換成 kit.js 的 sceneryMaterial：貼近鏡頭點狀溶解、擋在鏡頭與主角之間挖視線圓錐；whole 的件（枯樹、雕像）整件溶掉。陰影照投。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { sceneryMaterial } from './kit.js';

export const MODEL_GROUPS = ['arch', 'nature', 'relics', 'props', 'goods'];

const LIB = new Map(); // id → { node, size: [w,h,d], parts: [{ geo, mat, local }] }
let loading = null;

async function parseGroup(name) {
  // 註：ATLAS_GROUPS 在下面宣告；parseGroup 只在 loadSceneModels 之後才跑
  const el = document.getElementById(`glb-${name}`);
  if (!el) return 0;
  const bin = Uint8Array.from(atob(el.textContent.trim()), (c) => c.charCodeAt(0));
  const ab = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const gltf = await new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej));
  el.textContent = ''; // 解完就放掉 base64 字串
  let n = 0;
  for (const node of gltf.scene.children) {
    if (!node.name.startsWith('m_')) continue;
    const id = node.name.slice(2);
    node.position.set(0, 0, 0);
    node.rotation.set(0, 0, 0);
    node.scale.set(1, 1, 1);
    node.updateMatrixWorld(true);
    const parts = [];
    node.traverse((o) => {
      if (!o.isMesh) return;
      for (const [i, mat] of [].concat(o.material).entries()) {
        let geo = floatGeometry(o.geometry);
        if (Array.isArray(o.material)) geo = subGeometry(geo, i);
        parts.push({ geo, mat, local: o.matrixWorld.clone(), atlas: ATLAS_GROUPS.has(name) && atlasable(geo, mat) });
      }
    });
    const box = new THREE.Box3().setFromObject(node);
    const size = node.userData?.size || box.getSize(new THREE.Vector3()).toArray();
    LIB.set(id, { node, size, box, parts, group: name });
    n++;
  }
  return n;
}

// ── 小件貼圖拼圖集 ──
// 道具與貨品一件一張貼圖、一個材質：市集擺二三十種就是二三十個 draw call（再加陰影 pass）。
// 只有底色貼圖、UV 落在 0..1 的件，擺場景時把用到的貼圖拼成一張圖集（每格最大 ATLAS_CELL px），共用一個材質，UV 改指圖集；
// 材質的底色係數改成頂點色。有法線／粗糙度貼圖、鏤空或半透明的件照舊單獨畫。
const ATLAS_GROUPS = new Set(['props', 'goods']);
const ATLAS_CELL = 256;
const _uv = new THREE.Vector3();
function atlasable(geo, mat) {
  if (!mat.map || mat.normalMap || mat.roughnessMap || mat.metalnessMap || mat.aoMap || mat.emissiveMap || mat.alphaMap) return false;
  if (mat.transparent || mat.alphaTest > 0 || !geo.attributes.uv || !mat.map.image?.width) return false;
  const t = mat.map;
  t.updateMatrix();
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    _uv.set(uv.getX(i), uv.getY(i), 1).applyMatrix3(t.matrix);
    if (_uv.x < -0.002 || _uv.x > 1.002 || _uv.y < -0.002 || _uv.y > 1.002) return false;
  }
  return true;
}

const atlasCache = new Map(); // 用到的貼圖 uuid 清單 → { tex, rect: Map(uuid → [x, y, w, h]（0..1）) }
// textures：[{ t, dim }]，dim 是用這張貼圖的件的最大邊長（公尺）：半公尺以下的小東西一格 128 px 就夠
function atlasFor(textures) {
  const key = textures.map((x) => x.t.uuid).sort().join(',');
  if (atlasCache.has(key)) return atlasCache.get(key);
  // 依格子大小由大到小、逐列排（shelf packing）；放不下就把圖集加寬或加高一倍
  const cells = textures.map(({ t, dim }) => ({ t, s: Math.min(dim < 0.55 || LOW_TEX ? 128 : ATLAS_CELL, THREE.MathUtils.floorPowerOfTwo(Math.max(t.image.width, t.image.height))) }))
    .sort((a, b) => b.s - a.s);
  let W = 256, H = 256;
  const place = () => {
    let x = 0, y = 0, rowH = 0;
    for (const c of cells) {
      if (x + c.s > W) { x = 0; y += rowH; rowH = 0; }
      if (y + c.s > H) return false;
      c.x = x; c.y = y; x += c.s; rowH = Math.max(rowH, c.s);
    }
    return true;
  };
  while (!place()) { if (H < W) H *= 2; else W *= 2; }
  const A = `${W}x${H}`;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  // 每格先鋪滿整格、再把貼圖縮進內縮 pad px 的範圍：外圈 pad px 是邊緣顏色的延伸，mipmap 取樣不會吃到隔壁格
  const pad = 3;
  const rect = new Map();
  for (const c of cells) {
    ctx.drawImage(c.t.image, c.x, c.y, c.s, c.s);
    ctx.drawImage(c.t.image, c.x + pad, c.y + pad, c.s - pad * 2, c.s - pad * 2);
    rect.set(c.t.uuid, [(c.x + pad) / W, (c.y + pad) / H, (c.s - pad * 2) / W, (c.s - pad * 2) / H]);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.flipY = false; // 跟 glTF 貼圖一樣，uv (0,0) 在左上
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  const out = { tex, rect, size: A, bytes: W * H * 4 * (4 / 3), mat: null };
  out.mat = sceneryMaterial(new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.78, metalness: 0, name: `atlas${A}` }));
  out.matWhole = null;
  atlasCache.set(key, out);
  return out;
}

// 打包時位置、法線、UV 量化成 int16／int8（KHR_mesh_quantization，反量化的縮放在節點矩陣上）。
// 烤矩陣前先轉回 float，不然 applyMatrix4 會把超出 ±1 的值夾掉
function floatGeometry(geo) {
  const out = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(geo.attributes)) {
    if (a.array instanceof Float32Array && !a.isInterleavedBufferAttribute && !a.normalized) { out.setAttribute(name, a); continue; }
    const n = a.count, k = a.itemSize, arr = new Float32Array(n * k);
    for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) arr[i * k + j] = a.getComponent(i, j);
    out.setAttribute(name, new THREE.BufferAttribute(arr, k));
  }
  if (geo.index) out.setIndex(geo.index);
  for (const g of geo.groups) out.addGroup(g.start, g.count, g.materialIndex);
  return out;
}

function subGeometry(geo, i) {
  const g = geo.groups.find((x) => x.materialIndex === i);
  const out = geo.clone();
  out.clearGroups();
  if (g && out.index) out.setIndex(Array.from(out.index.array.slice(g.start, g.start + g.count)));
  return out;
}

// 手機（觸控為主的裝置）：模型貼圖一律縮到 512 以內、圖集每格 128，解碼後的貼圖記憶體約剩四分之一
export const LOW_TEX = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const TEX_CAP = LOW_TEX ? 512 : 4096;

async function capTextures() {
  const jobs = [];
  const seen = new Set();
  for (const rec of LIB.values()) for (const p of rec.parts) for (const k of TEX_KEYS) {
    const t = p.mat[k];
    if (!t || seen.has(t.uuid)) continue;
    seen.add(t.uuid);
    const img = t.image;
    if (!img?.width || Math.max(img.width, img.height) <= TEX_CAP) continue;
    const f = TEX_CAP / Math.max(img.width, img.height);
    jobs.push(createImageBitmap(img, { resizeWidth: Math.round(img.width * f), resizeHeight: Math.round(img.height * f), resizeQuality: 'medium' }).then((bmp) => {
      img.close?.();
      t.image = bmp;
      t.needsUpdate = true;
    }).catch(() => {}));
  }
  await Promise.all(jobs);
}
const TEX_KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'];

// 只解一次。回傳 Promise<件數>
export function loadSceneModels() {
  if (loading) return loading;
  loading = Promise.all(MODEL_GROUPS.map(parseGroup)).then(async (ns) => {
    if (LOW_TEX) await capTextures();
    return ns.reduce((a, b) => a + b, 0);
  });
  return loading;
}

// 換圖時把這張圖（與大堂）沒用到的模型貼圖、圖集從 GPU 釋放；之後再用到會自動重新上傳（圖檔還在記憶體裡）
export function releaseUnusedTextures(roots) {
  const keep = new Set();
  for (const r of roots) r?.traverse((o) => {
    if (o.isMesh) for (const m of [].concat(o.material)) for (const k of TEX_KEYS) if (m[k]) keep.add(m[k].uuid);
  });
  const drop = (t) => { if (t && !keep.has(t.uuid)) t.dispose(); };
  for (const rec of LIB.values()) for (const p of rec.parts) for (const k of TEX_KEYS) drop(p.mat[k]);
  for (const a of atlasCache.values()) drop(a.tex);
}

// 模型庫的貼圖在記憶體裡的總量（解碼後 RGBA8，不含 mipmap）
export function libraryTextureMB() {
  const seen = new Set();
  let bytes = 0;
  for (const rec of LIB.values()) for (const p of rec.parts) for (const k of TEX_KEYS) {
    const t = p.mat[k];
    if (!t || seen.has(t.uuid)) continue;
    seen.add(t.uuid);
    bytes += (t.image?.width || 0) * (t.image?.height || 0) * 4;
  }
  return bytes / (1024 * 1024);
}

export const hasModel = (id) => LIB.has(id);
export const modelSize = (id) => LIB.get(id)?.size || [1, 1, 1];

// ── 材質快取：同一張原始材質 × 是否整件溶解 ──
const matCache = new Map();
function matFor(src, whole) {
  const key = `${src.uuid}:${whole ? 1 : 0}`;
  let m = matCache.get(key);
  if (!m) {
    m = sceneryMaterial(src, { whole });
    matCache.set(key, m);
  }
  return m;
}

// 單件 clone（展示、少量擺放）。幾何共用、不要 dispose
export function getModel(id, { whole = false, shadow = true } = {}) {
  const rec = LIB.get(id);
  if (!rec) return null;
  const g = new THREE.Group();
  g.name = `model:${id}`;
  for (const p of rec.parts) {
    const m = new THREE.Mesh(p.geo, matFor(p.mat, whole));
    m.matrixAutoUpdate = false;
    m.matrix.copy(p.local);
    m.castShadow = shadow;
    m.receiveShadow = true;
    m.userData.sharedGeo = true;
    m.userData.see = true;
    g.add(m);
  }
  return g;
}

// ── 擺放批次 ──
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
export class Batch {
  constructor(name = 'models') {
    this.name = name;
    this.items = [];
    this.missing = new Set();
  }

  // ry 繞 y 轉（模型正面 +Z），s 等比或 [sx, sy, sz]；opts：{ rx, rz, whole, shadow }
  add(id, x, y, z, ry = 0, s = 1, opts = {}) {
    const rec = LIB.get(id);
    if (!rec) { this.missing.add(id); return null; }
    _e.set(opts.rx || 0, ry, opts.rz || 0);
    _q.setFromEuler(_e);
    const sc = Array.isArray(s) ? _s.set(...s) : _s.setScalar(s);
    const M = new THREE.Matrix4().compose(_v.set(x, y, z), _q, sc);
    const big = Math.max(...rec.size) * (Array.isArray(s) ? Math.max(...s) : s);
    this.items.push({ id, M, whole: !!opts.whole, shadow: opts.shadow ?? big > 1.2 });
    return this.worldBox(id, M);
  }

  // 該件擺好之後的世界 AABB（給 colliders／MAP_BLOCKERS 參考）
  worldBox(id, M) {
    return LIB.get(id).box.clone().applyMatrix4(M);
  }

  build() {
    const grp = new THREE.Group();
    grp.name = this.name;
    const bins = new Map(); // material.uuid:whole:shadow → { mat, geos }
    // 這一批用到、可以拼圖集的貼圖
    const atlasTex = new Map();
    for (const it of this.items) {
      const rec = LIB.get(it.id);
      const dim = Math.max(...rec.size) * it.M.getMaxScaleOnAxis();
      for (const p of rec.parts) {
        if (!p.atlas) continue;
        const e = atlasTex.get(p.mat.map.uuid);
        atlasTex.set(p.mat.map.uuid, { t: p.mat.map, dim: Math.max(dim, e?.dim || 0) });
      }
    }
    const atlas = atlasTex.size > 1 ? atlasFor([...atlasTex.values()]) : null;
    for (const it of this.items) {
      const rec = LIB.get(it.id);
      let tree = null;
      if (it.whole) {
        const sp = rec.box.clone().applyMatrix4(it.M).getBoundingSphere(new THREE.Sphere());
        tree = [sp.center.x, sp.center.y, sp.center.z, sp.radius * 0.8];
      }
      for (const p of rec.parts) {
        const useAtlas = atlas && p.atlas;
        const key = `${useAtlas ? 'atlas' : p.mat.uuid}:${it.whole ? 1 : 0}:${it.shadow ? 1 : 0}`;
        let b = bins.get(key);
        if (!b) {
          const mat = useAtlas ? (it.whole ? (atlas.matWhole ||= sceneryMaterial(atlas.mat, { whole: true })) : atlas.mat) : matFor(p.mat, it.whole);
          bins.set(key, (b = { mat, shadow: it.shadow, geos: [] }));
        }
        const g = useAtlas ? atlasGeometry(p, atlas) : p.geo.clone();
        g.applyMatrix4(_m.multiplyMatrices(it.M, p.local));
        if (tree) {
          const n = g.attributes.position.count;
          const a = new Float32Array(n * 4);
          for (let i = 0; i < n; i++) a.set(tree, i * 4);
          g.setAttribute('tree', new THREE.BufferAttribute(a, 4));
        }
        b.geos.push(g);
      }
    }
    for (const b of bins.values()) {
      const geo = b.geos.length === 1 ? b.geos[0] : mergeGeometries(normalize(b.geos), false);
      if (!geo) continue;
      for (const g of b.geos) if (g !== geo) g.dispose();
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, b.mat);
      mesh.castShadow = b.shadow;
      mesh.receiveShadow = true;
      mesh.userData.see = true;
      mesh.name = `${this.name}:${b.mat.name || 'mat'}`;
      grp.add(mesh);
    }
    if (this.missing.size) console.warn(`缺少模型：${[...this.missing].join(' ')}`);
    return grp;
  }
}

// 圖集用的幾何：UV 套原貼圖的變換後改指圖集那一格，底色係數寫成頂點色，其餘屬性（tangent、uv1…）丟掉
function atlasGeometry(p, atlas) {
  const src = p.geo;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', src.attributes.position.clone());
  if (src.attributes.normal) g.setAttribute('normal', src.attributes.normal.clone());
  else { g.setAttribute('normal', src.attributes.position.clone()); }
  if (src.index) g.setIndex(src.index.clone());
  const t = p.mat.map;
  const [rx, ry, rw, rh] = atlas.rect.get(t.uuid);
  const uv = src.attributes.uv;
  const out = new Float32Array(uv.count * 2);
  for (let i = 0; i < uv.count; i++) {
    _uv.set(uv.getX(i), uv.getY(i), 1).applyMatrix3(t.matrix);
    out[i * 2] = rx + THREE.MathUtils.clamp(_uv.x, 0, 1) * rw;
    out[i * 2 + 1] = ry + THREE.MathUtils.clamp(_uv.y, 0, 1) * rh;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(out, 2));
  const c = p.mat.color || new THREE.Color(1, 1, 1);
  const col = new Float32Array(uv.count * 3);
  for (let i = 0; i < uv.count; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!src.attributes.normal) g.computeVertexNormals();
  return g;
}

// mergeGeometries 要求屬性一致：同材質的件都來自同一份幾何，只有 index 有無可能不同
function normalize(list) {
  const indexed = list.some((g) => g.index);
  return list.map((g) => (indexed && !g.index ? g.setIndex([...Array(g.attributes.position.count).keys()]) : g));
}
