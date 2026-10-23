// 室內場景改用網格：把 Sketchfab 原檔（.cache/sketchfab/）合成一個 GLB，座標換成場景的局部座標。
// splat 從低面數貼圖模型烘出來一定會糊，室內近看的東西直接畫原本的網格比較清楚；廣場仍是 splat。
//   node tools/room-glb.mjs [id]   → assets/266/<id>.glb
// 每個 part：src 原檔、origin 原檔裡的場景原點（和 room-col.mjs 一致）、drop 拿掉的節點、
// mat 依材質名改貼圖：flat 換素色（真實站名、品牌包裝）、blur 模糊（看得出真實地名的小字）；
// cut 是原檔座標的盒子 [x0, x1, y0, y1, z0, z1]，重心落在裡面的三角形整個拿掉；
// matRe 是 [正規式, 動作] 的陣列，一次套到一批材質（便利店幾十張商品包裝照片）；
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
  // 便利店：借 260 處理過的 apt_store.glb（Pasha 的 Convenience store 2，已裁掉停車場、換成公尺，材質色烘在 COLOR_0；解開 meshopt 成 apt_store_plain.glb）。
  // 原檔地板在 y = 0.3、門在西牆 (-5.33, -3.7)：門洞裡減面減碎的門框和飲料機剪掉，頁面補一片暗色門板。貨架上的商品包裝、飲料機與冰箱都是真實品牌的照片：招牌與飲料標誌換素色，包裝模糊成色塊
  store: [
    { src: 'apt_store_plain.glb', origin: [0, 0.3, 0], cut: [[-6.2, -5.3, -1, 4, -5.15, -2.45], [-5.4, 1.5, 2.5, 3.25, -6.345, -5.9]], mat: { // 第二個盒子：北牆冰箱上方連鎖店的立體字標誌
      IMG_0272: { flat: [0.78, 0.76, 0.72] },                       // 店招（真實連鎖店名）
      pepsi_machine_logo: { flat: [0.1, 0.16, 0.36] }, pepsi_spout_label: { flat: [0.1, 0.16, 0.36] }, diet_pepsi_spout_label: { flat: [0.55, 0.58, 0.62] },
      material_3: { flat: [0.42, 0.07, 0.06] }, material_4: { flat: [0.42, 0.07, 0.06] }, // 汽水機面板
      material_7: { flat: [0.5, 0.1, 0.08] }, material_8: { flat: [0.1, 0.4, 0.2] }, material_9_10: { flat: [0.25, 0.12, 0.4] }, // 汽水機的小標籤
      'PJ-BJ336_29ptec_G_20120828175227': { flat: [0.04, 0.05, 0.07] }, // 電視畫面（真實品牌的應用程式圖示）
      material_5: { blur: 10 }, material_5_6: { blur: 10 }, material_68: { blur: 8 }, material_9: { blur: 6 },
      material_1: { blur: 5 },                                       // 冰箱裡的飲料照片
      material_1_2: { blur: 6 }, 'muhlen-EU-2480-yazar-kasa-para-cekmecesi-1_2': { blur: 4 }, material_12: { blur: 3 }, material_13: { blur: 3 },
    }, matRe: [[/^260x260-/, { blur: 7 }]] },                       // 零食包裝
  ],
};

const lin = c => Math.pow(c, 2.2);

async function part(io, p) {
  const doc = await io.read(resolve(SF, p.src));
  await doc.transform(metalRough());
  const R = doc.getRoot();
  for (const n of R.listNodes()) if (p.drop?.test(n.getName())) n.dispose();
  for (const m of R.listMeshes()) for (const q of m.listPrimitives()) for (const k of q.listSemantics()) if (k.startsWith('_')) q.setAttribute(k, null); // 260 自訂的 _PBR／_EMI 頁面用不到
  if (p.cut) for (const n of R.listNodes()) {
    const mesh = n.getMesh(); if (!mesh) continue; const W = n.getWorldMatrix(), e = [];
    const wp = i => { const [x, y, z] = e; return [W[0] * x + W[4] * y + W[8] * z + W[12], W[1] * x + W[5] * y + W[9] * z + W[13], W[2] * x + W[6] * y + W[10] * z + W[14]]; };
    for (const q of mesh.listPrimitives()) {
      const pos = q.getAttribute('POSITION'), idx = q.getIndices(); if (!idx) continue;
      const keep = [];
      for (let i = 0; i < idx.getCount(); i += 3) {
        const c = [0, 0, 0]; for (let j = 0; j < 3; j++) { pos.getElement(idx.getScalar(i + j), e); wp().forEach((v, k) => c[k] += v / 3); }
        if (!p.cut.some(([x0, x1, y0, y1, z0, z1]) => c[0] > x0 && c[0] < x1 && c[1] > y0 && c[1] < y1 && c[2] > z0 && c[2] < z1)) keep.push(idx.getScalar(i), idx.getScalar(i + 1), idx.getScalar(i + 2));
      }
      if (!keep.length) { mesh.removePrimitive(q); q.dispose(); } // 整塊都在盒子裡
      else if (keep.length < idx.getCount()) idx.setArray(new (idx.getArray().constructor)(keep));
    }
  }
  for (const m of R.listMaterials()) {
    if (p.metal != null) m.setMetallicFactor(Math.min(m.getMetallicFactor(), p.metal));
    const op = p.mat?.[m.getName()] || p.matRe?.find(([re]) => re.test(m.getName()))?.[1]; if (!op) continue;
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
