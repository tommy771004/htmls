// 外部 CC0 素材（../assets/199/）：掃描貼圖、天空、士兵、車輛與道具。
// 任何一項載入失敗都只是退回程序生成的版本，不丟例外、不寫 console.error（以檔案開啟時就是這樣）。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

export const BASE = new URL('../assets/199/', location.href).href;
export const TEX_NAMES = ['brick', 'plaster', 'wall', 'concrete', 'concrete2', 'asphalt', 'paving', 'wood', 'tile', 'metal', 'rust', 'roof',
  'grass', 'grassdirt', 'dirt', 'rock', 'sand', 'facade', 'bark', 'siding'];

export function loadAssets(onProgress) {
  const A = { tex: {}, nrm: {}, sky: null, env: null, soldier: null, cars: {}, props: {}, leaves: null, ok: false };
  if (location.protocol === 'file:') return Promise.resolve(A);
  const mgr = new THREE.LoadingManager();
  let total = 0, done = 0;
  const tick = () => { done++; onProgress?.(done / Math.max(1, total)); };
  const texLoader = new THREE.TextureLoader(mgr);
  const tex = (url, srgb = true) => { total++; return new Promise((res) => texLoader.load(BASE + url, (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; tick(); res(t); }, undefined, () => { tick(); res(null); })); };
  const gltf = new GLTFLoader(mgr);
  const model = (url) => { total++; return new Promise((res) => gltf.load(BASE + url, (g) => { tick(); res(g); }, undefined, () => { tick(); res(null); })); };
  const hdr = () => { total++; return new Promise((res) => new HDRLoader(mgr).load(BASE + 'sky/env.hdr', (t) => { tick(); res(t); }, undefined, () => { tick(); res(null); })); };
  const jobs = [];
  for (const n of TEX_NAMES) {
    jobs.push(tex(`tex/${n}.webp`).then((t) => { A.tex[n] = t; }));
    jobs.push(tex(`tex/${n}_n.webp`, false).then((t) => { A.nrm[n] = t; }));
  }
  jobs.push(Promise.all([tex('tex/leaves.webp'), tex('tex/leaves_a.webp', false)]).then(([c, a]) => { if (c && a) A.leaves = mergeAlpha(c, a); }));
  jobs.push(tex('sky/sky.jpg').then((t) => { if (t) { t.mapping = THREE.EquirectangularReflectionMapping; A.sky = t; } }));
  jobs.push(hdr().then((t) => { if (t) { t.mapping = THREE.EquirectangularReflectionMapping; A.env = t; } }));
  jobs.push(model('models/soldier.glb').then((g) => { A.soldier = g; }));
  jobs.push(model('models/kit.glb').then((g) => { A.kit = g?.scene || null; }));
  jobs.push(model('models/guns.glb').then((g) => { A.guns = g?.scene || null; }));
  jobs.push(model('models/furniture.glb').then((g) => { A.furniture = g?.scene || null; }));
  for (const c of ['sedan', 'hatchback-sports', 'van', 'suv', 'taxi', 'truck', 'police']) jobs.push(model(`cars/${c}.glb`).then((g) => { if (g) A.cars[c] = g.scene; }));
  for (const p of ['old_military_crate', 'metal_jerrycan_green', 'power_box_01']) jobs.push(model(`props/${p}/${p}_1k.gltf`).then((g) => { if (g) A.props[p] = g.scene; }));
  return Promise.all(jobs).then(() => { A.ok = !!(A.tex.brick && A.sky); return A; });
}

// 樹葉：顏色圖＋透明度圖合成一張帶 alpha 的貼圖
function mergeAlpha(c, a) {
  const w = c.image.width, h = c.image.height;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const x = cv.getContext('2d');
  x.drawImage(a.image, 0, 0, w, h);
  const ad = x.getImageData(0, 0, w, h).data;
  x.drawImage(c.image, 0, 0, w, h);
  const img = x.getImageData(0, 0, w, h);
  for (let i = 0; i < ad.length; i += 4) img.data[i + 3] = ad[i];
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
