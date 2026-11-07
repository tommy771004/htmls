#!/usr/bin/env node
// 列出 glb 的節點樹、三角形數、外框與貼圖大小。node tools/glb-info.mjs <檔案>...
import { readFileSync, statSync } from 'node:fs';
const CT = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array, 5122: Int16Array, 5120: Int8Array };
for (const f of process.argv.slice(2)) {
  const b = readFileSync(f), jl = b.readUInt32LE(12), J = JSON.parse(b.slice(20, 20 + jl).toString()), bin = b.slice(20 + jl + 8);
  console.log('==', f, (statSync(f).size / 1e6).toFixed(2), 'MB nodes', J.nodes.length, 'meshes', J.meshes?.length, 'mats', J.materials?.length, 'images', J.images?.length, 'ext', J.extensionsUsed);
  for (const n of (J.scenes[0].nodes)) walk(n, 0);
  function walk(i, d) {
    const n = J.nodes[i]; let s = ''.padStart(d * 2) + n.name;
    if (n.mesh !== undefined) { const m = J.meshes[n.mesh]; let tri = 0, v = 0; const lo = [9, 9, 9], hi = [-9, -9, -9];
      for (const p of m.primitives) { const a = J.accessors[p.attributes.POSITION]; v += a.count; tri += (p.indices !== undefined ? J.accessors[p.indices].count : a.count) / 3; for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], a.min[k]); hi[k] = Math.max(hi[k], a.max[k]); } }
      s += ` prim=${m.primitives.length} mat=${m.primitives.map(p => J.materials?.[p.material]?.name)} tri=${tri} v=${v} attrs=${Object.keys(m.primitives[0].attributes)} lo=${lo.map(x => x.toFixed(3))} hi=${hi.map(x => x.toFixed(3))}`; }
    if (n.translation) s += ' t=' + n.translation.map(x => +x.toFixed(4));
    if (n.rotation) s += ' r=' + n.rotation.map(x => +x.toFixed(3));
    if (n.scale) s += ' s=' + n.scale.map(x => +x.toFixed(3));
    console.log(s);
    for (const c of n.children ?? []) walk(c, d + 1);
  }
  if (J.images) for (const im of J.images) { const bv = J.bufferViews[im.bufferView]; console.log('  img', im.name, im.mimeType, (bv.byteLength / 1e3).toFixed(0) + 'KB'); }
}
