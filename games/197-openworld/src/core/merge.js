import { Mesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * 把同一個父節點底下、材質相同的靜態 Mesh 合併成一個，降低 draw call。
 * 只合併「同父」的 Mesh，所以關節（Group）仍可各自旋轉做動畫。
 * 之後還要單獨操作的 Mesh 請先設 userData.keep = true。
 */
export function mergeStatic(root) {
  const parents = [];
  root.traverse((o) => {
    if (!o.isMesh && o.children.length > 1) parents.push(o);
  });
  for (const parent of parents) {
    const buckets = new Map();
    for (const c of parent.children) {
      if (!c.isMesh || c.isInstancedMesh || c.isSkinnedMesh) continue;
      if (Array.isArray(c.material) || c.children.length || c.userData.keep) continue;
      const key = c.material.uuid + (c.castShadow ? ':s' : ':n') + ':' + c.layers.mask;
      let list = buckets.get(key);
      if (!list) buckets.set(key, (list = []));
      list.push(c);
    }
    for (const list of buckets.values()) {
      if (list.length < 2) continue;
      const withUv = list.every((m) => m.geometry.attributes.uv);
      const withColor = list.every((m) => m.geometry.attributes.color);
      const geos = list.map((m) => {
        m.updateMatrix();
        let geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        for (const name of Object.keys(geo.attributes)) {
          const keep = name === 'position' || name === 'normal' || (name === 'uv' && withUv) || (name === 'color' && withColor);
          if (!keep) geo.deleteAttribute(name);
        }
        if (!geo.attributes.normal) geo.computeVertexNormals();
        geo.applyMatrix4(m.matrix);
        return geo;
      });
      const merged = mergeGeometries(geos);
      if (!merged) continue; // attribute 組合不一致就保持原狀
      const first = list[0];
      const mesh = new Mesh(merged, first.material);
      mesh.castShadow = first.castShadow;
      mesh.receiveShadow = first.receiveShadow;
      mesh.layers.mask = first.layers.mask;
      mesh.frustumCulled = first.frustumCulled;
      for (const m of list) parent.remove(m);
      parent.add(mesh);
    }
  }
  return root;
}
