// 雲梯城寨（blender/enclave.py 程序化產生的網格與貼圖）→ assets/260/enclave/enclave.glb
//   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/enclave.py   （先產生 .cache/enclave/mesh.* 與 tex/）
//   node tools/enclave-glb.mjs
// 每個樓群一個節點（lot0…lot7、street：門樓與路燈），每種材質一個 primitive；座標是 10-city.js 的 ENC.f 框座標（Y 朝上）。
// 頂點屬性：POSITION、NORMAL、TEXCOORD_0（有貼圖的材質）、COLOR_0（線性、8 位元）、_WIN（每棟樓的窗燈亂數，26-glb.js 的 vWin）；
// 粗糙度、金屬度與自發光每種材質一個值，28-enclave.js 載入後補成 _pbr／_emi（8 位元，不放進檔案）。
// 材質：conc（混凝土）、win（窗：metallicRoughness 放窗燈遮罩 R＝玻璃、G＝窗號，26-glb.js 的 USE_WINMAP）、tin（鐵皮）、
// rail／cage／cloth（alpha 遮罩、雙面）、misc（只有頂點色）、emi（霓虹與燈，頂點色就是發光色）
import { createRequire } from 'node:module';
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(resolve(root, '../197-openworld/package.json'));
const imp = (n) => import(pathToFileURL(req.resolve(n)).href);
const { NodeIO, Document } = await imp('@gltf-transform/core');
const { ALL_EXTENSIONS, EXTTextureWebP } = await imp('@gltf-transform/extensions');
const { prune, dedup, weld, meshopt } = await imp('@gltf-transform/functions');
const { MeshoptEncoder } = await imp('meshoptimizer');
const sharp = (await imp('sharp')).default;

const SRC = resolve(root, '.cache/enclave'), OUT = resolve(root, '../../assets/260/enclave');
const meta = JSON.parse(readFileSync(resolve(SRC, 'mesh.json'), 'utf8')), bin = readFileSync(resolve(SRC, 'mesh.bin'));
// 每種材質：貼圖、是否 alpha 遮罩（雙面）
const MAT = {
  conc: { tex: 'conc' }, win: { tex: 'win', win: 'winm' }, tin: { tex: 'tin' },
  rail: { tex: 'rail', mask: 1 }, cage: { tex: 'cage', mask: 1 }, cloth: { tex: 'cloth', mask: 1 },
  misc: {}, emi: {},
};
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await MeshoptEncoder.ready;
const doc = new Document(); const buf = doc.createBuffer();
const acc = (arr, type, norm) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buf).setNormalized(!!norm);
const webp = async (name, { alpha = false, lossless = false } = {}) => {
  let img = sharp(resolve(SRC, 'tex', name + '.png'));
  if (!alpha) img = img.removeAlpha();
  return new Uint8Array(await img.webp(lossless ? { lossless: true } : { quality: 84, alphaQuality: 100 }).toBuffer());
};
const mats = {};
for (const [k, o] of Object.entries(MAT)) {
  const m = doc.createMaterial(k).setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(1);
  if (o.tex) m.setBaseColorTexture(doc.createTexture(o.tex).setImage(await webp(o.tex, { alpha: !!o.mask })).setMimeType('image/webp'));
  if (o.win) m.setMetallicRoughnessTexture(doc.createTexture(o.win).setImage(await webp(o.win, { lossless: true })).setMimeType('image/webp'));
  if (o.mask) m.setAlphaMode('MASK').setAlphaCutoff(.5).setDoubleSided(true);
  mats[k] = m;
}
doc.createExtension(EXTTextureWebP).setRequired(true);
const scene = doc.createScene('enclave'), nodes = {};
let tris = 0, verts = 0;
for (const g of meta.groups) {
  const n = g.n, i = g.i; let o = g.off;
  const take = (C, k) => { const a = new C(bin.buffer.slice(bin.byteOffset + o, bin.byteOffset + o + k * C.BYTES_PER_ELEMENT)); o += k * C.BYTES_PER_ELEMENT; return a; };
  const P = take(Float32Array, n * 3), N = take(Float32Array, n * 3), U = take(Float32Array, n * 2), C = take(Float32Array, n * 4), W = take(Float32Array, n);
  take(Float32Array, n);   // lit：只有 Cycles 用（窗燈），遊戲的窗燈是 26-glb.js 依窗號亂數
  const I = take(Uint32Array, i);
  for (let k = 1; k < n * 2; k += 2) U[k] = 1 - U[k];   // Blender 的 v 朝上，glTF 朝下
  const C8 = new Uint8Array(n * 4); for (let k = 0; k < n * 4; k++) C8[k] = Math.round(Math.min(1, Math.max(0, C[k])) * 255);
  const prim = doc.createPrimitive().setMaterial(mats[g.mat]).setIndices(acc(I, 'SCALAR'))
    .setAttribute('POSITION', acc(P, 'VEC3')).setAttribute('NORMAL', acc(N, 'VEC3')).setAttribute('COLOR_0', acc(C8, 'VEC4', true)).setAttribute('_WIN', acc(W, 'SCALAR'));
  if (MAT[g.mat].tex) prim.setAttribute('TEXCOORD_0', acc(U, 'VEC2'));
  if (!nodes[g.group]) { nodes[g.group] = doc.createNode(g.group).setMesh(doc.createMesh(g.group)); scene.addChild(nodes[g.group]); }
  nodes[g.group].getMesh().addPrimitive(prim);
  tris += i / 3; verts += n;
}
await doc.transform(dedup(), weld(), prune({ keepAttributes: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
const file = resolve(OUT, 'enclave.glb');
await io.write(file, doc);
const wv = doc.getRoot().listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((b, p) => b + p.getAttribute('POSITION').getCount(), 0), 0);
console.log(`enclave.glb：${Object.keys(nodes).length} 個節點、${tris} 面、${verts} 頂點（合併後 ${wv}）、${Math.round(statSync(file).size / 1024)} KB`);
