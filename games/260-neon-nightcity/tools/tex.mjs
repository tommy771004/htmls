// 程式立面與屋頂的照片材質：ambientCG 的 CC0 材質（1K-JPG，原檔解壓在 gitignore 的 .cache/tex-src/<id>/）疊成兩張長條圖
// → assets/260/tex/fac_c.jpg（底色乘上 AO）與 fac_n.jpg（R、G 是 OpenGL 法線的 x、y，B 是粗糙度），每層 1024×1024、由上往下排。
// 頁面（08-tex.js）以 http(s) 開啟時下載，拆成 texture2D 陣列（uFacA、uFacN）；層的順序與每層代表的公尺數寫在 08-tex.js 的 FAC_LAYERS，
// 改這裡的清單要一起改。輸出有 commit，打包不需要它。借 197 的 sharp。
//   node tools/tex.mjs
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sharp = createRequire(resolve(root, '../197-openworld/package.json'))('sharp');
const SRC = resolve(root, '.cache/tex-src'), OUT = resolve(root, '../../assets/260/tex'), S = 1024;
// 和 08-tex.js 的 FAC_LAYERS 同順序：舊紅磚、褐磚、舊混凝土、粗灰泥、龜裂瀝青（平屋頂）、陶筒瓦、石板瓦
const IDS = ['Bricks097', 'Bricks094', 'Concrete035', 'Plaster003', 'Asphalt026C', 'RoofingTiles014B', 'RoofingTiles003'];
mkdirSync(OUT, { recursive: true });

const raw = async (f, ch) => (await sharp(f).resize(S, S).removeAlpha().toColourspace(ch === 1 ? 'b-w' : 'srgb').raw().toBuffer());
const col = Buffer.alloc(S * S * 3 * IDS.length), nrm = Buffer.alloc(S * S * 3 * IDS.length);
for (const [k, id] of IDS.entries()) {
  const f = (s) => resolve(SRC, id, `${id}_1K-JPG_${s}.jpg`);
  const c = await raw(f('Color'), 3), n = await raw(f('NormalGL'), 3), r = await raw(f('Roughness'), 1);
  const ao = existsSync(f('AmbientOcclusion')) ? await raw(f('AmbientOcclusion'), 1) : null;
  const o = k * S * S * 3;
  for (let i = 0; i < S * S; i++) {
    const a = ao ? .3 + .7 * ao[i] / 255 : 1;   // AO 只壓七成：縫裡暗、但不要黑成一條
    for (let j = 0; j < 3; j++) col[o + i * 3 + j] = Math.round(c[i * 3 + j] * a);
    nrm[o + i * 3] = n[i * 3]; nrm[o + i * 3 + 1] = n[i * 3 + 1]; nrm[o + i * 3 + 2] = r[i];
  }
  console.log(`${k} ${id}${ao ? '（含 AO）' : ''}`);
}
for (const [name, buf] of [['fac_c', col], ['fac_n', nrm]]) {
  const out = resolve(OUT, `${name}.jpg`);
  await sharp(buf, { raw: { width: S, height: S * IDS.length, channels: 3 } }).jpeg({ quality: name === 'fac_n' ? 92 : 86, chromaSubsampling: name === 'fac_n' ? '4:4:4' : '4:2:0' }).toFile(out);
  console.log(`${out}: ${(statSync(out).size / 1024).toFixed(0)} KB`);
}
