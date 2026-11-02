// 69-gunship.js 的 AH-64D（Muhamad Mirza Arrafi，Sketchfab，CC BY 4.0）：原檔 .cache/raw/ah64d.glb 依材質合併，旋翼和機身在同一個網格裡。
// 這裡照相連元件的位置切成機身（Object_N）、主旋翼（rotor_Object_N）、尾旋翼（tail_Object_N），寫出 .cache/raw/ah64d_split.glb 給 tools/traffic.mjs 烘。
// 判斷用的轂心與尺寸是原檔座標（機頭 +x、上 +y、主旋翼轂 x .264 z 0、尾旋翼轂 x -1.056 y .076），換別的模型要重量
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(root + '/../197-openworld/package.json');
const imp = n => import(pathToFileURL(req.resolve(n)).href);
const { NodeIO } = await imp('@gltf-transform/core');
const { ALL_EXTENSIONS } = await imp('@gltf-transform/extensions');
const { compactPrimitive, prune } = await imp('@gltf-transform/functions');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(root + '/.cache/raw/ah64d.glb');
const HUB = [.264, 0], TR = [-1.056, .076];
const kind = C => {
  const c = C.a.map((q, k) => (q + C.b[k]) / 2), s = C.a.map((q, k) => C.b[k] - q), mx = Math.max(...s), n = C.tris.length;
  if (n === 33 && mx > .8) return 'rotor';   // 主旋翼的四片槳葉
  if (C.a[1] >= .09 && C.b[1] <= .195 && Math.hypot(c[0] - HUB[0], c[2] - HUB[1]) < .075) return 'rotor';   // 轂頭（槳葉夾、變距桿、旋轉的斜盤）
  if (n === 10 && mx > .14 && mx < .18 && c[0] < -.9) return 'tail';   // 尾旋翼的四片槳葉
  if (Math.hypot(c[0] - TR[0], c[1] - TR[1]) < .035 && c[2] > -.13 && c[2] < -.03 && mx < .1) return 'tail';   // 尾旋翼轂
  return 'body';
};
const cnt = { body: 0, rotor: 0, tail: 0 };
for (const n of [...doc.getRoot().listNodes()]) {
  const m = n.getMesh(); if (!m) continue;
  if (/^Object_(2|4)$/.test(n.getName())) { n.setMesh(null); continue; }   // 浮貼的貼花片（頂點色畫不出來）
  const W = n.getWorldMatrix(), parent = n.getParentNode(), extra = { rotor: null, tail: null };
  for (const p of [...m.listPrimitives()]) {
    const P = p.getAttribute('POSITION'), I = p.getIndices(), nv = P.getCount(), v = [], wp = new Float64Array(nv * 3);
    for (let i = 0; i < nv; i++) { P.getElement(i, v); wp[i*3] = W[0]*v[0]+W[4]*v[1]+W[8]*v[2]+W[12]; wp[i*3+1] = W[1]*v[0]+W[5]*v[1]+W[9]*v[2]+W[13]; wp[i*3+2] = W[2]*v[0]+W[6]*v[1]+W[10]*v[2]+W[14]; }
    const key = i => `${Math.round(wp[i*3]*2e4)},${Math.round(wp[i*3+1]*2e4)},${Math.round(wp[i*3+2]*2e4)}`;
    const id = new Map(), rep = new Int32Array(nv); for (let i = 0; i < nv; i++) { const k = key(i); if (!id.has(k)) id.set(k, i); rep[i] = id.get(k); }
    const par = new Int32Array(nv).map((_, i) => i), f = x => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
    const nt = I.getCount() / 3, ix = t => [I.getScalar(t*3), I.getScalar(t*3+1), I.getScalar(t*3+2)];
    for (let t = 0; t < nt; t++) { const [a, b, c] = ix(t).map(q => rep[q]); par[f(a)] = f(b); par[f(b)] = f(c); }
    const g = new Map();
    for (let t = 0; t < nt; t++) { const r = f(rep[ix(t)[0]]); if (!g.has(r)) g.set(r, { tris: [], a: [1e9,1e9,1e9], b: [-1e9,-1e9,-1e9] }); const C = g.get(r); C.tris.push(t); for (const q of ix(t)) for (let k = 0; k < 3; k++) { C.a[k] = Math.min(C.a[k], wp[q*3+k]); C.b[k] = Math.max(C.b[k], wp[q*3+k]); } }
    const out = { body: [], rotor: [], tail: [] };
    for (const C of g.values()) { const k = kind(C); cnt[k] += C.tris.length; for (const t of C.tris) out[k].push(...ix(t)); }
    const mk = arr => doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(arr)).setBuffer(I.getBuffer());
    for (const k of ['rotor', 'tail']) if (out[k].length) {
      if (!extra[k]) { extra[k] = doc.createNode(k + '_' + n.getName()).setMesh(doc.createMesh(k + '_' + m.getName())).setMatrix(n.getMatrix()); (parent || doc.getRoot().listScenes()[0]).addChild(extra[k]); }
      extra[k].getMesh().addPrimitive(p.clone().setIndices(mk(out[k])));
    }
    if (out.body.length) p.setIndices(mk(out.body)); else m.removePrimitive(p);
  }
}
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) compactPrimitive(p);
await doc.transform(prune());
await io.write(root + '/.cache/raw/ah64d_split.glb', doc);
console.log(cnt, doc.getRoot().listNodes().filter(n => n.getMesh()).map(n => n.getName()).join(' '));
