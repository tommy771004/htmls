// 山坡別墅區的照片材質：Poly Haven 的 CC0 材質（1K JPG，原檔在 gitignore 的 .cache/tex-src/ph/<id>/<id>_{diff,nor_gl,rough,ao}_1k.jpg）疊成兩張長條圖
// → assets/260/tex/vil_c.jpg（底色乘上 AO）與 vil_n.jpg（R、G 是 OpenGL 法線的 x、y，B 是粗糙度），每層 1024×1024、由上往下排。格式和 tools/tex.mjs 的 fac_c／fac_n 一樣，
// 但分開一組：立面那七層的原檔不在 .cache 裡也不用重壓。頁面（08-tex.js 的 VIL_LAYERS）以 http(s) 開啟時下載成 texture2D 陣列 uVilA、uVilN，
// 07-kitx.js 的 texMat 43–46（板模混凝土、木格柵、洞石、疊石）與 50（別墅區的山坡）取用。改這裡的清單要一起改 VIL_LAYERS。輸出有 commit，打包不需要它。借 197 的 sharp。
//   node tools/tex-vil.mjs
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sharp = createRequire(resolve(root, '../197-openworld/package.json'))('sharp');
const SRC = resolve(root, '.cache/tex-src/ph'), OUT = resolve(root, '../../assets/260/tex'), S = 1024;
// 和 08-tex.js 的 VIL_LAYERS 同順序：板模混凝土、雪松直紋木板、白砂岩（洞石牆）、疊石牆、乾土岩坡、稀疏草地、落葉、林地（苔與土）、碎石步道
const IDS = ['concrete_slab_wall', 'japanese_cedar_planks', 'white_sandstone_blocks_02', 'stacked_stone_wall', 'dry_ground_rocks', 'sparse_grass', 'forest_leaves_02', 'forest_ground_04', 'rocky_trail'];
mkdirSync(OUT, { recursive: true });

const raw = async (f, ch) => (await sharp(f).resize(S, S).removeAlpha().toColourspace(ch === 1 ? 'b-w' : 'srgb').raw().toBuffer());
const col = Buffer.alloc(S * S * 3 * IDS.length), nrm = Buffer.alloc(S * S * 3 * IDS.length);
for (const [k, id] of IDS.entries()) {
  // 檔名不一：底色有 diff／diffuse，粗糙度與 AO 有的是分開的、有的打包成 arm（R＝AO、G＝粗糙度），沒有 AO 就當 1
  const f = (...ks) => ks.map((k) => resolve(SRC, id, `${id}_${k}_1k.jpg`)).find(existsSync);
  const arm = f('arm'), c = await raw(f('diff', 'diffuse'), 3), n = await raw(f('nor_gl'), 3);
  const armB = arm && await sharp(arm).resize(S, S).removeAlpha().raw().toBuffer(), pick = (ch) => Buffer.from(Array.from({ length: S * S }, (_, i) => armB[i * 3 + ch]));
  const r = f('rough') ? await raw(f('rough'), 1) : pick(1), ao = f('ao') ? await raw(f('ao'), 1) : arm ? pick(0) : Buffer.alloc(S * S, 255);
  const o = k * S * S * 3;
  for (let i = 0; i < S * S; i++) {
    const a = .3 + .7 * ao[i] / 255;   // AO 只壓七成：縫裡暗、但不要黑成一條（同 tex.mjs）
    for (let j = 0; j < 3; j++) col[o + i * 3 + j] = Math.round(c[i * 3 + j] * a);
    nrm[o + i * 3] = n[i * 3]; nrm[o + i * 3 + 1] = n[i * 3 + 1]; nrm[o + i * 3 + 2] = r[i];
  }
  console.log(`${k} ${id}`);
}
for (const [name, buf] of [['vil_c', col], ['vil_n', nrm]]) {
  const out = resolve(OUT, `${name}.jpg`);
  await sharp(buf, { raw: { width: S, height: S * IDS.length, channels: 3 } }).jpeg({ quality: name === 'vil_n' ? 92 : 86, chromaSubsampling: name === 'vil_n' ? '4:4:4' : '4:2:0' }).toFile(out);
  console.log(`${out}: ${(statSync(out).size / 1024).toFixed(0)} KB`);
}
