// 檢查 GLB 內容：節點樹、網格頂點數、骨架、動畫（名稱、長度、通道數）與包圍盒。
// node tools/glbinfo.mjs blender/out/fisher.glb [--tree]
import { readFileSync } from 'node:fs';
const file = process.argv[2];
const buf = readFileSync(file);
const jsonLen = buf.readUInt32LE(12);
const g = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
const bin = buf.subarray(20 + jsonLen + 8);
const acc = (i) => g.accessors[i];
const kb = (buf.length / 1024).toFixed(0);
console.log(`${file}  ${kb} KB  nodes=${g.nodes.length} meshes=${(g.meshes || []).length} skins=${(g.skins || []).length} materials=${(g.materials || []).length}`);
const verts = (m) => m.primitives.reduce((s, p) => s + acc(p.attributes.POSITION).count, 0);
const tris = (m) => m.primitives.reduce((s, p) => s + (p.indices != null ? acc(p.indices).count / 3 : 0), 0);
const roots = g.scenes[g.scene || 0].nodes;
const tree = process.argv.includes('--tree');
const walk = (i, d) => {
  const n = g.nodes[i];
  const mesh = n.mesh != null ? g.meshes[n.mesh] : null;
  const bbox = mesh ? mesh.primitives.map((p) => acc(p.attributes.POSITION)).reduce((b, a) => ({ min: b.min.map((v, k) => Math.min(v, a.min[k])), max: b.max.map((v, k) => Math.max(v, a.max[k])) }), { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] }) : null;
  const isBone = (g.skins || []).some((s) => s.joints.includes(i));
  if (tree || !isBone || d === 0)
    console.log(`${'  '.repeat(d)}${n.name}${isBone ? ' [bone]' : ''}${mesh ? `  mesh ${verts(mesh)}v ${tris(mesh)}t mats=${mesh.primitives.map((p) => g.materials?.[p.material]?.name).join(',')} bbox ${bbox.min.map((v) => v.toFixed(2))}..${bbox.max.map((v) => v.toFixed(2))}${n.skin != null ? ' skinned' : ''}` : ''}${n.translation ? ` @${n.translation.map((v) => v.toFixed(2))}` : ''}`);
  (n.children || []).forEach((c) => walk(c, d + 1));
};
roots.forEach((r) => walk(r, 0));
for (const s of g.skins || []) console.log(`skin joints=${s.joints.length}: ${s.joints.map((j) => g.nodes[j].name).join(' ')}`);
for (const a of g.animations || []) {
  const t = Math.max(...a.samplers.map((s) => acc(s.input).max[0]));
  const targets = new Set(a.channels.map((c) => g.nodes[c.target.node].name));
  console.log(`anim ${a.name}  ${t.toFixed(2)}s  channels=${a.channels.length}  nodes=${[...targets].join(',')}`);
}
