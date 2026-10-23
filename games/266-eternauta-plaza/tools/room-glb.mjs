// 室內場景改用網格：把 Sketchfab 原檔（.cache/sketchfab/）合成一個 GLB，座標換成場景的局部座標。
// splat 從低面數貼圖模型烘出來一定會糊，室內近看的東西直接畫原本的網格比較清楚；廣場仍是 splat。
//   node tools/room-glb.mjs [id]   → assets/266/<id>.glb
// 每個 part：src 原檔、origin 原檔裡的場景原點（和 room-col.mjs 一致）、drop 拿掉的節點、
// mat 依材質名改貼圖：flat 換素色（真實站名、品牌包裝）、blur 模糊（看得出真實地名的小字）；
// metal 壓低金屬度上限（頁面沒有環境貼圖，金屬面只會照到點光，整台車會是黑的）。
import { createRequire } from 'node:module';
import { statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(resolve(root, '../197-openworld/package.json'));
const imp = (n) => import(pathToFileURL(req.resolve(n)).href);
const { NodeIO } = await imp('@gltf-transform/core');
const { ALL_EXTENSIONS } = await imp('@gltf-transform/extensions');
const { metalRough, mergeDocuments, prune, dedup, textureCompress, meshopt } = await imp('@gltf-transform/functions');
const { MeshoptEncoder } = await imp('meshoptimizer');
const sharp = (await imp('sharp')).default;

const SF = resolve(root, '.cache/sketchfab');
const OUT = resolve(root, '../../assets/266');

export const ROOMS = {
  metro: [
    { src: 'lowpoly_berlin_u-bahn_station.glb', origin: [0, 1.1, 0], drop: /^Object_3$/, mat: {
      SIGNS: { flat: [0.55, 0.56, 0.55] },            // 站名牌、路線標誌
      vendingmachine: { flat: [0.16, 0.17, 0.19] },   // 販賣機裡的零食包裝
      checker: { blur: 14 }, 'checker.001': { blur: 14 }, // 零食貨架（真實品牌）
      'checker.002': { blur: 6 },                     // 發車資訊板的真實終點站
      'checker.003': { blur: 6 },                     // 海報
      Ticket: { blur: 2.5 },                          // 售票機上的小字
    } },
    { src: 'subway_car.glb', origin: [8.695, 1.3, 41.92], drop: /^Object_[67]$/, metal: 0.15 }, // 拿掉車門，車廂走得進去
  ],
};

const lin = c => Math.pow(c, 2.2);

async function part(io, p) {
  const doc = await io.read(resolve(SF, p.src));
  await doc.transform(metalRough());
  const R = doc.getRoot();
  for (const n of R.listNodes()) if (p.drop?.test(n.getName())) n.dispose();
  for (const m of R.listMaterials()) {
    if (p.metal != null) m.setMetallicFactor(Math.min(m.getMetallicFactor(), p.metal));
    const op = p.mat?.[m.getName()]; if (!op) continue;
    if (op.flat) {
      m.setBaseColorTexture(null).setBaseColorFactor([...op.flat.map(lin), 1]);
      m.setEmissiveTexture(null).setEmissiveFactor([0, 0, 0]);
    }
    if (op.blur) for (const t of [m.getBaseColorTexture(), m.getEmissiveTexture()]) {
      if (t) t.setImage(new Uint8Array(await sharp(Buffer.from(t.getImage())).blur(op.blur).png().toBuffer())).setMimeType('image/png');
    }
  }
  // 原檔的根節點掛到一個平移 -origin 的新節點下，原本的軸向轉換照舊
  const scene = R.listScenes()[0], top = doc.createNode(p.src.replace(/\.glb$/, '')).setTranslation(p.origin.map(x => -x));
  for (const c of scene.listChildren()) { scene.removeChild(c); top.addChild(c); }
  scene.addChild(top);
  return doc;
}

async function build(id) {
  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  const parts = ROOMS[id];
  const doc = await part(io, parts[0]);
  for (const p of parts.slice(1)) {
    const map = mergeDocuments(doc, await part(io, p));
    const [main, ...rest] = doc.getRoot().listScenes();
    for (const s of rest) { for (const c of s.listChildren()) { s.removeChild(c); main.addChild(c); } s.dispose(); }
    void map;
  }
  doc.getRoot().setDefaultScene(doc.getRoot().listScenes()[0]);
  for (const b of doc.getRoot().listBuffers().slice(1)) b.dispose();
  const buf = doc.getRoot().listBuffers()[0];
  for (const a of doc.getRoot().listAccessors()) a.setBuffer(buf);
  await doc.transform(
    prune(), dedup(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 82, resize: [1024, 1024] }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  doc.getRoot().getAsset().extras = { source: parts.map(p => p.src) };
  const out = resolve(OUT, id + '.glb');
  await io.write(out, doc);
  console.log(id, (statSync(out).size / 1e6).toFixed(2), 'MB');
}

for (const id of process.argv[2] ? [process.argv[2]] : Object.keys(ROOMS)) await build(id);
