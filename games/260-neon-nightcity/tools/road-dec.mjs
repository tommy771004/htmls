// 路面貼花：ambientCG 的 CC0 掃描（龜裂與補丁 AsphaltDamageSet001、圓形人孔蓋 ManholeCover006、路邊排水格柵 Grate002；
// 原檔解壓在 gitignore 的 .cache/tex-src/<id>/）拼成兩張 2048×1024 的圖 → assets/260/tex/road_dec_c.webp（底色＋不透明度）、
// road_dec_n.webp（R、G 是 OpenGL 法線的 x、y，B 是粗糙度，A 同不透明度），和 road_dec.json（每一塊在圖上的範圍與實際尺寸）。
// 版面：左半 1024² 是龜裂補丁組（依不透明度切成一塊塊，json 的 pieces），右上兩格各 512²：人孔蓋、排水格柵。
// 頁面（27-props.js 下載柏油貼圖的地方）以 http(s) 開啟時下載，10-city.js 的 ROAD_FS 照 json 取用（ASPH_U.uDec*）。輸出有 commit，打包不需要它。借 197 的 sharp。
//   node tools/road-dec.mjs
import { writeFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sharp = createRequire(resolve(root, '../197-openworld/package.json'))('sharp');
const SRC = resolve(root, '.cache/tex-src'), OUT = resolve(root, '../../assets/260/tex');
const W = 2048, H = 1024;
// 每格：原檔、在圖上的位置與大小（像素）、整格代表幾公尺（龜裂組沒有標尺寸，照一塊補丁 1–3 m 抓）
const CELLS = [
  { id: 'AsphaltDamageSet001', res: '2K-JPG', ext: 'jpg', x: 0, y: 0, s: 1024, m: 4.2 },
  { id: 'ManholeCover006', res: '1K-PNG', ext: 'png', x: 1024, y: 0, s: 512, m: .8 },   // ambientCG 標 80 cm
  { id: 'Grate002', res: '1K-PNG', ext: 'png', x: 1536, y: 0, s: 512, m: .75 },
];
const img = async (c, map, ch) => {
  const f = resolve(SRC, c.id, `${c.id}_${c.res}_${map}.${c.ext}`);
  let p = sharp(f).resize(c.s, c.s).removeAlpha();
  p = ch === 1 ? p.toColourspace('b-w') : p.toColourspace('srgb');
  return p.raw().toBuffer();
};
const col = Buffer.alloc(W * H * 4), nrm = Buffer.alloc(W * H * 4);
const json = { size: [W, H], pieces: [], manhole: null, grate: null };
for (const c of CELLS) {
  const C = await img(c, 'Color', 3), N = await img(c, 'NormalGL', 3), Rg = await img(c, 'Roughness', 1), A = await img(c, 'Opacity', 1);
  let ao = null; try { ao = await img(c, 'AmbientOcclusion', 1); } catch (e) { /* 龜裂組沒有 AO */ }
  for (let y = 0; y < c.s; y++) for (let x = 0; x < c.s; x++) {
    const i = y * c.s + x, o = ((c.y + y) * W + c.x + x) * 4, a = ao ? .35 + .65 * ao[i] / 255 : 1;
    for (let j = 0; j < 3; j++) col[o + j] = Math.round(C[i * 3 + j] * a);
    col[o + 3] = A[i];
    nrm[o] = N[i * 3]; nrm[o + 1] = N[i * 3 + 1]; nrm[o + 2] = Rg[i]; nrm[o + 3] = A[i];
  }
  // 範圍：不透明度 > 0.5 的外框（龜裂組先在 128² 上找連通的塊，每塊一個外框，太小的不要）
  const rect = (x0, y0, x1, y1) => { const px = c.m / c.s; return { uv: [(c.x + x0) / W, (c.y + y0) / H, (c.x + x1) / W, (c.y + y1) / H], m: [+((x1 - x0) * px).toFixed(3), +((y1 - y0) * px).toFixed(3)] }; };
  if (c.id === 'AsphaltDamageSet001') {
    const G = 128, k = c.s / G, lab = new Int32Array(G * G).fill(-1), on = (x, y) => A[(Math.floor((y + .5) * k)) * c.s + Math.floor((x + .5) * k)] > 128;
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
      if (lab[y * G + x] >= 0 || !on(x, y)) continue;
      const st = [[x, y]], b = [x, y, x, y]; let n = 0; lab[y * G + x] = json.pieces.length;
      while (st.length) {
        const [px, py] = st.pop(); n++;
        b[0] = Math.min(b[0], px); b[1] = Math.min(b[1], py); b[2] = Math.max(b[2], px); b[3] = Math.max(b[3], py);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          const qx = px + dx, qy = py + dy;
          if (qx < 0 || qy < 0 || qx >= G || qy >= G || lab[qy * G + qx] >= 0 || !on(qx, qy)) continue;
          lab[qy * G + qx] = json.pieces.length; st.push([qx, qy]);
        }
      }
      if (n > 40) json.pieces.push(rect(Math.max(0, b[0] - 1) * k, Math.max(0, b[1] - 1) * k, Math.min(G, b[2] + 2) * k, Math.min(G, b[3] + 2) * k));
      else json.pieces.push(null);
    }
    json.pieces = json.pieces.filter(Boolean).sort((a, b) => b.m[0] * b.m[1] - a.m[0] * a.m[1]);
  } else {
    let x0 = c.s, y0 = c.s, x1 = 0, y1 = 0;
    for (let y = 0; y < c.s; y++) for (let x = 0; x < c.s; x++) if (A[y * c.s + x] > 128) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1); }
    json[c.id === 'Grate002' ? 'grate' : 'manhole'] = rect(x0, y0, x1, y1);
  }
  console.log(c.id, c.id === 'AsphaltDamageSet001' ? `${json.pieces.length} 塊` : '');
}
json.pieces = json.pieces.slice(0, 8);   // ROAD_FS 的 uDecP[8]
for (const [name, buf] of [['road_dec_c', col], ['road_dec_n', nrm]]) {
  const out = resolve(OUT, `${name}.webp`);
  await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: name === 'road_dec_n' ? 90 : 84, alphaQuality: 90, effort: 5 }).toFile(out);
  console.log(`${out}: ${(statSync(out).size / 1024).toFixed(0)} KB`);
}
writeFileSync(resolve(OUT, 'road_dec.json'), JSON.stringify(json));
console.log(JSON.stringify(json));
