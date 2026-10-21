// Sketchfab 角色模型（blender/glb_heroes.py 轉好的 ../assets/198/<id>.glb）：開場先載入，載到的英雄改用 GLB 網格，
// 綁到遊戲自己的骨架（關節位置照 GLB 量出的 ki_joints）。以檔案開啟或載不到時退回程式建模的 models-baked.js，不報錯。
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const GLB = {};
globalThis.__GLB = GLB; // 驗收與除錯用（tools/accept.mjs --http 檢查有沒有載到）
export const GLB_IDS = ['goku', 'vegeta', 'trunks', 'piccolo', 'frieza', 'a18', 'naruto', 'sasuke', 'sakura', 'luffy', 'zoro', 'sanji', 'nami'];
// 賽亞人的髮色（貼圖 sRGB 值＋容差）：超級賽亞人時著色器把接近這個顏色的部分換成金色
export const HAIR_KEY = { goku: [0.125, 0.125, 0.125, 0.11], vegeta: [0.17, 0.17, 0.17, 0.11], trunks: [0.45, 0.41, 0.6, 0.26] };
const BASE = globalThis.KI_ASSETS || '../assets/198/'; // 開發工具（tools/viewer.mjs）從別的路徑開頁時會先設 KI_ASSETS

// 各 GLB 的位元組數由 tools/build.mjs 在打包時寫入：伺服器有壓縮（Content-Encoding）或沒給 Content-Length 時，進度照這個估
const SIZE = typeof KI_GLB_BYTES !== 'undefined' ? KI_GLB_BYTES : {};

// 邊下載邊數位元組（不支援串流的環境直接整包讀）
async function readBody(res, onBytes) {
  if (!res.body || !res.body.getReader) return res.arrayBuffer();
  const reader = res.body.getReader(), chunks = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); n += value.length; onBytes(n);
  }
  const out = new Uint8Array(n);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out.buffer;
}

// onProgress(p, id, ok)：p 是 0～1 的整體進度（下載佔九成、解析完成補足）；某名英雄載完或失敗時帶上 id 與成敗
export async function loadGlbHeroes(ids = GLB_IDS, onProgress = null) {
  if (typeof location === 'undefined' || location.protocol === 'file:') return GLB;
  const loader = new GLTFLoader();
  const want = {}, frac = {};
  for (const id of ids) { want[id] = SIZE[id] || 6e5; frac[id] = 0; }
  const report = (id, ok) => {
    if (!onProgress) return;
    let a = 0, b = 0;
    for (const k of ids) { a += frac[k] * want[k]; b += want[k]; }
    onProgress(a / b, id, ok);
  };
  await Promise.all(ids.map(async (id) => {
    let ok = false;
    try {
      const res = await fetch(BASE + id + '.glb');
      if (!res.ok) return;
      const len = +res.headers.get('content-length');
      if (len > 0 && !res.headers.get('content-encoding')) want[id] = len;
      const buf = await readBody(res, (n) => { frac[id] = 0.9 * Math.min(1, n / want[id]); report(); });
      const gltf = await loader.parseAsync(buf, BASE);
      let joints = null, height = 0;
      const parts = [];
      gltf.scene.traverse((o) => {
        if (o.userData && o.userData.ki_joints) { joints = JSON.parse(o.userData.ki_joints); height = o.userData.ki_height || 0; }
        if (o.isSkinnedMesh) parts.push({ geometry: o.geometry, names: o.skeleton.bones.map((b) => b.name), map: o.material.map || null, alpha: o.material.alphaTest || (o.material.transparent ? 0.5 : 0) });
      });
      if (!joints || !parts.length) return;
      // 有些模型的 UV 落在 0～1 之外（原檔靠重複貼圖），一律改成重複取樣
      for (const p of parts) if (p.map) { p.map.colorSpace = THREE.SRGBColorSpace; p.map.wrapS = p.map.wrapT = THREE.RepeatWrapping; p.map.anisotropy = 4; p.map.needsUpdate = true; }
      GLB[id] = { joints, height, parts };
      ok = true;
    } catch (_) { /* 載不到就用程式建模 */ } finally { frac[id] = 1; report(id, ok); }
  }));
  return GLB;
}

// GLB 的蒙皮索引（GLB 自己的骨頭順序）換成遊戲骨架 bones 的順序；補上英雄材質要的頂點屬性
export function glbGeometry(part, bones) {
  if (part.ready) return part.geometry;
  const g = part.geometry, n = g.attributes.position.count;
  const idx = new Map(bones.map((b, i) => [b.name, i]));
  const remap = part.names.map((nm) => (idx.has(nm) ? idx.get(nm) : 0));
  const si = g.attributes.skinIndex, out = new Uint16Array(n * 4);
  for (let i = 0; i < n * 4; i++) out[i] = remap[si.array[i]];
  g.setAttribute('skinIndex', new THREE.BufferAttribute(out, 4));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  g.setAttribute('aMat', new THREE.BufferAttribute(new Float32Array(n), 1));
  g.setAttribute('aAO', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
  g.setAttribute('aOl', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
  g.computeBoundingSphere();
  part.ready = true;
  return g;
}

// 擺動鏈的錐管（GLB 沒有、仍用遊戲骨鏈驅動的部件，例如弗利沙的尾巴）：在綁定姿勢沿鏈逐節放圓環，
// 第 i 圈綁第 i 節（節與節之間的圈兩節各半），尾端收成尖。座標是 root 的局部座標
export function chainTube(segs, len, radii, bones, root, color, sides = 10) {
  const idx = new Map(bones.map((b, i) => [b, i]));
  const n = segs.length, P = [], inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  for (let i = 0; i < n; i++) P.push(new THREE.Vector3().setFromMatrixPosition(segs[i].matrixWorld).applyMatrix4(inv));
  P.push(new THREE.Vector3(0, -len, 0).applyMatrix4(segs[n - 1].matrixWorld).applyMatrix4(inv));
  const pos = [], nrm = [], si = [], sw = [], uv = [], index = [];
  const t = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), up = new THREE.Vector3(0, 0, 1);
  for (let r = 0; r <= n; r++) {
    t.subVectors(P[Math.min(r + 1, n)], P[Math.max(r - 1, 0)]).normalize();
    a.crossVectors(t, up); if (a.lengthSq() < 1e-6) a.set(1, 0, 0); a.normalize(); b.crossVectors(a, t);
    const rad = r < n ? radii[r] : radii[n - 1] * 0.25;
    const b0 = idx.get(segs[Math.max(r - 1, 0)]), b1 = idx.get(segs[Math.min(r, n - 1)]);
    for (let k = 0; k < sides; k++) {
      const ang = (k / sides) * Math.PI * 2, c = Math.cos(ang), s = Math.sin(ang);
      const nx = a.x * c + b.x * s, ny = a.y * c + b.y * s, nz = a.z * c + b.z * s;
      pos.push(P[r].x + nx * rad, P[r].y + ny * rad, P[r].z + nz * rad); nrm.push(nx, ny, nz);
      si.push(b0, b1, 0, 0); sw.push(r > 0 && r < n ? 0.5 : 1, r > 0 && r < n ? 0.5 : 0, 0, 0); uv.push(k / sides, r / n);
    }
  }
  for (let r = 0; r < n; r++) for (let k = 0; k < sides; k++) {
    const p = r * sides + k, q = r * sides + ((k + 1) % sides);
    index.push(p, p + sides, q, q, p + sides, q + sides);
  }
  const g = new THREE.BufferGeometry(), m = pos.length / 3;
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  const col = new Float32Array(m * 3); for (let i = 0; i < m; i++) col.set(color, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aMat', new THREE.BufferAttribute(new Float32Array(m), 1));
  g.setAttribute('aAO', new THREE.BufferAttribute(new Float32Array(m).fill(1), 1));
  g.setAttribute('aOl', new THREE.BufferAttribute(new Float32Array(m).fill(1), 1));
  g.setIndex(index);
  g.computeBoundingSphere();
  return g;
}
