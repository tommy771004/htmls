// 197 湖畔求生的三個 NPC（Quaternius 的 CC0 底模＋服裝＋髮型，197 的 tools/build-characters.py 組成）當路人：
// assets/197/models/q/npc_*.glb 和 260 的路人是同一副 65 根骨頭的骨架，不必重綁；這裡把每人的十幾個網格併成一個蒙皮網格、
// 各部位的貼圖拼成一張（40-people.js 的 scanGet 一人只吃一個 SkinnedMesh＋一張底色貼圖），再量化、meshopt 壓縮
// → assets/260/people/q_<name>.glb。輸出有 commit，打包不需要它。
//   node tools/q197-people.mjs
import { statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(resolve(root, '../197-openworld/package.json'));
const imp = (n) => import(pathToFileURL(req.resolve(n)).href);
const { NodeIO } = await imp('@gltf-transform/core');
const { ALL_EXTENSIONS } = await imp('@gltf-transform/extensions');
const { prune, dedup, quantize, meshopt } = await imp('@gltf-transform/functions');
const { MeshoptEncoder } = await imp('meshoptimizer');
const sharp = (await imp('sharp')).default;

const NPCS = ['camper', 'fisher', 'hiker'];
const CELL = 512, PAD = 4;   // 每張部位貼圖縮到 512，格子內縮 4 px，mipmap 不會吃到隔壁格
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

for (const name of NPCS) {
  const doc = await io.read(resolve(root, `../../assets/197/models/q/npc_${name}.glb`));
  const R = doc.getRoot(), nodes = R.listNodes().filter((n) => n.getMesh() && n.getSkin());
  const prims = nodes.flatMap((n) => n.getMesh().listPrimitives());
  // 同一張圖（內容相同）只放一格
  const cells = new Map(), cellOf = [];
  for (const p of prims) {
    const tex = p.getMaterial().getBaseColorTexture(), key = Buffer.from(tex.getImage()).toString('base64').slice(0, 4000) + tex.getImage().byteLength;
    if (!cells.has(key)) cells.set(key, { i: cells.size, img: tex.getImage() });
    cellOf.push(cells.get(key).i);
  }
  const cols = Math.ceil(Math.sqrt(cells.size)), rows = Math.ceil(cells.size / cols);
  const tiles = await Promise.all([...cells.values()].map(async (c) => ({
    input: await sharp(Buffer.from(c.img)).resize(CELL - PAD * 2, CELL - PAD * 2, { fit: 'fill' }).extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, extendWith: 'copy' }).toBuffer(),
    left: (c.i % cols) * CELL, top: Math.floor(c.i / cols) * CELL,
  })));
  const atlas = await sharp({ create: { width: cols * CELL, height: rows * CELL, channels: 3, background: '#808080' } }).composite(tiles).jpeg({ quality: 86 }).toBuffer();

  // 併成一個 primitive：位置、法線、UV（換到格子裡；眼睛的 UV 超出 0–1 就夾住）、骨頭編號與權重
  const pos = [], nor = [], uv = [], jo = [], we = [], idx = [];
  prims.forEach((p, k) => {
    const base = pos.length / 3, c = cellOf[k], cx = c % cols, cy = Math.floor(c / cols), s = (CELL - PAD * 2) / CELL;
    const A = (n) => p.getAttribute(n), P = A('POSITION'), N = A('NORMAL'), T = A('TEXCOORD_0'), J = A('JOINTS_0'), W = A('WEIGHTS_0');
    for (let i = 0; i < P.getCount(); i++) {
      pos.push(...P.getElement(i, [])); nor.push(...N.getElement(i, []));
      const [u, v] = T.getElement(i, []), cl = (x) => Math.min(1, Math.max(0, x));
      uv.push((cx + PAD / CELL + cl(u) * s) / cols, (cy + PAD / CELL + cl(v) * s) / rows);
      jo.push(...J.getElement(i, [])); we.push(...W.getElement(i, []));
    }
    const I = p.getIndices();
    for (let i = 0; i < I.getCount(); i++) idx.push(base + I.getScalar(i));
  });
  const buf = R.listBuffers()[0];
  const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buf);
  const img = doc.createTexture(`q_${name}`).setImage(new Uint8Array(atlas)).setMimeType('image/jpeg');
  const mat = doc.createMaterial(`q_${name}`).setBaseColorTexture(img).setRoughnessFactor(.8).setMetallicFactor(0);
  const prim = doc.createPrimitive().setMaterial(mat).setIndices(acc('SCALAR', new Uint32Array(idx)))
    .setAttribute('POSITION', acc('VEC3', new Float32Array(pos))).setAttribute('NORMAL', acc('VEC3', new Float32Array(nor)))
    .setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array(uv))).setAttribute('JOINTS_0', acc('VEC4', new Uint16Array(jo)))
    .setAttribute('WEIGHTS_0', acc('VEC4', new Float32Array(we)));
  const keep = nodes[0];
  keep.setName(`q_${name}_body`).setMesh(doc.createMesh(`q_${name}`).addPrimitive(prim));
  for (const n of nodes.slice(1)) n.dispose();
  await doc.transform(prune(), dedup(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  const out = resolve(root, `../../assets/260/people/q_${name}.glb`);
  await io.write(out, doc);
  console.log(`${out}: ${cells.size} 張貼圖 → ${cols * CELL}×${rows * CELL}，${pos.length / 3} 頂點，${(statSync(out).size / 1024).toFixed(0)} KB`);
}
