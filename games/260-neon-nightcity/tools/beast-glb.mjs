// 海獸模型（21-rigbeast.js）：MightyPinecone 的 Turtle Kaiju（Sketchfab，CC BY 4.0）→ assets/260/beast/turtle_kaiju.glb
//   node tools/beast-glb.mjs          來源 .cache/beast/turtle-kaiju.glb（gitignore；Sketchfab 的 glb 下載，4K 貼圖）
//   DEBUG=1 另外輸出 .cache/beast/weights.glb（頂點色＝骨頭：頭紅、顎黃、左右手綠／青、左右腳藍／紫），用 Blender 看權重
// 處理：攤平節點變換、轉成「頭朝 +z、y 朝上、腳底在 y = 0」、縮放到 BEAST_H 公尺高；
// 原檔沒有骨架：照部位寫一個 _BONE 屬性（x＝骨頭編號 1..7、y＝權重 0..1，其餘是 0 號身體），頁面在頂點著色器裡轉（m-beast.mjs）；
// 關節位置（模型座標，公尺）寫在場景根節點的 extras.joints；貼圖縮到 2048 轉 WebP（底色、法線、ORM 三張）。
import { createRequire } from 'node:module';
import { mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(resolve(root, '../197-openworld/package.json'));
const imp = (n) => import(pathToFileURL(req.resolve(n)).href);
const { NodeIO } = await imp('@gltf-transform/core');
const { ALL_EXTENSIONS } = await imp('@gltf-transform/extensions');
const { prune, textureCompress } = await imp('@gltf-transform/functions');
const sharp = (await imp('sharp')).default;

const SRC = resolve(root, '.cache/beast/turtle-kaiju.glb');
const OUT = resolve(root, '../../assets/260/beast');
const BEAST_H = 60;   // 站直（原檔的駝背姿勢）時頭頂離腳底幾公尺
const TEX = 2048;

// 原檔在 Blender 裡的座標（X 右、Y 往頭、Z 上；高 2.52）量出來的關節。頁面的模型座標是 (−X, Z, Y)·S，再往後挪 Z0
const Z0 = .05;
const J = {   // [X, Y, Z]（Blender）
  head: [0, .42, 1.88],    // 脖子根：殼前緣上方
  jaw: [0, 1.62, 1.36],    // 下顎的鉸鏈：嘴角後面
  armR: [.5, .55, 1.6], armL: [-.5, .55, 1.6],   // 肩
  legR: [.66, -.05, .78], legL: [-.66, -.05, .78],   // 髖
};
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// 每個頂點（Blender 座標）→ [骨頭, 權重]；1 頭、2 顎、3 右手、4 左手、5 右腳、6 左腳
function bone(X, Y, Z) {
  const ax = Math.abs(X), sx = X > 0 ? 0 : 1;
  // 手：殼前緣外側、肩以下（手臂從殼裡伸出來，肩那一段慢慢接到身體）
  const arm = ss(.36, .46, ax) * ss(.42, .68, Y) * (1 - ss(1.72, 1.86, Z)) * ss(.3, .45, Z);
  if (arm > 0) return [3 + sx, arm];
  // 腳：殼下緣以下、前後在腿柱的範圍
  const leg = ss(.26, .36, ax) * (1 - ss(.5, .74, Z)) * ss(-.52, -.4, Y) * (1 - ss(.36, .5, Y));
  if (leg > 0) return [5 + sx, leg];
  // 顎：頭的前段、嘴線以下
  const jaw = ss(1.5, 1.66, Y) * (1 - ss(1.27, 1.37, Z - (Y - 1.62) * .1)) * (1 - ss(.36, .44, ax));
  if (jaw > .02) return [2, jaw];
  // 頭與脖子：殼前緣往前、手臂之間
  const head = ss(.36, .62, Y) * (1 - ss(.38, .48, ax)) * ss(1.05, 1.25, Z) * (1 - ss(1.95, 2.08, Z) * (1 - ss(.55, .72, Y)));   // 殼前緣上方翹起的那一塊不跟著頭
  if (head > 0) return [1, head];
  return [0, 0];
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(SRC);
const R = doc.getRoot();
const node = R.listNodes().find(n => n.getMesh());
const W = node.getWorldMatrix();
const prim = node.getMesh().listPrimitives()[0];
const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), Tg = prim.getAttribute('TANGENT');
const n = P.getCount();
// glTF 世界 (x, y, z) = Blender (X, Z, −Y)；頁面 = (−X, Z, Y) = (−x, y, −z)：繞 y 轉 180°
let ymin = Infinity, ymax = -Infinity;
const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), tan = new Float32Array(n * 4), bw = new Float32Array(n * 2);
const mul = (m, v, w) => [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * w, m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * w, m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * w];
const nrm = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
for (let i = 0; i < n; i++) {
  const g = mul(W, P.getElement(i, []), 1);
  ymin = Math.min(ymin, g[1]); ymax = Math.max(ymax, g[1]);
  pos.set([-g[0], g[1], -g[2]], i * 3);
  const gn = nrm(mul(W, N.getElement(i, []), 0)); nor.set([-gn[0], gn[1], -gn[2]], i * 3);
  const t4 = Tg.getElement(i, []), gt = nrm(mul(W, t4, 0)); tan.set([-gt[0], gt[1], -gt[2], t4[3]], i * 4);
  bw.set(bone(g[0], -g[2], g[1]), i * 2);
}
const S = BEAST_H / (ymax - ymin);
for (let i = 0; i < n; i++) { pos[i * 3] *= S; pos[i * 3 + 1] = (pos[i * 3 + 1] - ymin) * S; pos[i * 3 + 2] = (pos[i * 3 + 2] + Z0) * S; }
// 鏡像兩次（x 與 z）＝轉 180°，繞向不變；det(W) 若是負的（原檔有鏡像）要翻
const det = W[0] * (W[5] * W[10] - W[9] * W[6]) - W[4] * (W[1] * W[10] - W[9] * W[2]) + W[8] * (W[1] * W[6] - W[5] * W[2]);
if (det < 0) { const ix = prim.getIndices().getArray(); for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } }
P.setArray(pos); N.setArray(nor); Tg.setArray(tan);
const buf = R.listBuffers()[0];
prim.setAttribute('_BONE', doc.createAccessor('bone').setType('VEC2').setArray(bw).setBuffer(buf));
for (const nd of R.listNodes()) nd.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
const joints = Object.fromEntries(Object.entries(J).map(([k, [X, Y, Z]]) => [k, [-X * S, (Z - ymin) * S, (Y + Z0) * S].map(v => +v.toFixed(3))]));
R.listScenes()[0].setExtras({ joints, h: +((ymax - ymin) * S).toFixed(2), src: 'Turtle Kaiju by MightyPinecone (CC BY 4.0)' });
const cnt = [0, 0, 0, 0, 0, 0, 0]; for (let i = 0; i < n; i++) if (bw[i * 2 + 1] > .5) cnt[bw[i * 2]]++;
console.log('頂點', n, '縮放', S.toFixed(3), '高', ((ymax - ymin) * S).toFixed(1), 'm；各骨頭頂點數（權重 > .5）', cnt.join(' '), '\n關節', JSON.stringify(joints));

if (process.env.DEBUG) {
  const COL = [[.5, .5, .5], [1, .1, .1], [1, .9, .1], [.1, 1, .1], [.1, .9, .9], [.1, .2, 1], [.7, .1, 1]];
  const c = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { const b = bw[i * 2], w = bw[i * 2 + 1]; for (let k = 0; k < 3; k++) c[i * 4 + k] = COL[0][k] + (COL[b][k] - COL[0][k]) * w; c[i * 4 + 3] = 1; }
  const d2 = await io.readBinary(await io.writeBinary(doc));
  const p2 = d2.getRoot().listMeshes()[0].listPrimitives()[0];
  p2.setAttribute('COLOR_0', d2.createAccessor().setType('VEC4').setArray(c).setBuffer(d2.getRoot().listBuffers()[0]));
  await io.write(resolve(root, '.cache/beast/weights.glb'), d2);
}

await doc.transform(prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEX, TEX], quality: 88 }));
mkdirSync(OUT, { recursive: true });
const out = resolve(OUT, 'turtle_kaiju.glb');
await io.write(out, doc);
console.log(out, (statSync(out).size / 1048576).toFixed(2), 'MB');
