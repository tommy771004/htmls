// Sketchfab 角色模型（blender/glb_heroes.py 轉好的 ../assets/198/<id>.glb）：開場先載入，載到的英雄改用 GLB 網格，
// 綁到遊戲自己的骨架（關節位置照 GLB 量出的 ki_joints）。以檔案開啟或載不到時退回程式建模的 models-baked.js，不報錯。
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const GLB = {};
globalThis.__GLB = GLB; // 驗收與除錯用（tools/accept.mjs --http 檢查有沒有載到）
export const GLB_IDS = ['vegeta'];
const BASE = globalThis.KI_ASSETS || '../assets/198/'; // 開發工具（tools/viewer.mjs）從別的路徑開頁時會先設 KI_ASSETS

export async function loadGlbHeroes(ids = GLB_IDS) {
  if (typeof location === 'undefined' || location.protocol === 'file:') return GLB;
  const loader = new GLTFLoader();
  await Promise.all(ids.map(async (id) => {
    try {
      const res = await fetch(BASE + id + '.glb');
      if (!res.ok) return;
      const gltf = await loader.parseAsync(await res.arrayBuffer(), BASE);
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
    } catch (_) { /* 載不到就用程式建模 */ }
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
