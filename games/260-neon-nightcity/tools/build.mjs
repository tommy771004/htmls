// 打包：src/parts/*.js 依檔名順序串成一個 ES 模組（共用頂層變數）→ esbuild 連同 three 打包 → 內嵌進 src/index.html
// → ../../web/260-neon-nightcity.html。blender/out/ 裡用到的 GLB 以 gzip＋base64 放進
// <script type="application/octet-stream" id="glb-名稱">，頁面執行時用 DecompressionStream 解壓後交給 GLTFLoader。
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const minify = !process.argv.includes('--dev');
const outArg = process.argv.find((a) => a.startsWith('--out='));
const outFile = outArg ? resolve(process.cwd(), outArg.slice(6)) : resolve(root, '../../web/260-neon-nightcity.html');
const GLBS = ['interior_props', 'street_props', 'people', 'traffic'];   // 人物：blender/people.py；車流：tools/traffic.mjs

const partsDir = resolve(root, 'src/parts');
const parts = readdirSync(partsDir).filter((f) => f.endsWith('.js')).sort();
const source = parts.map((f) => `// ── ${f} ──\n` + readFileSync(resolve(partsDir, f), 'utf8')).join('\n');

const result = await build({
  stdin: { contents: source, resolveDir: partsDir, sourcefile: 'parts.js', loader: 'js' },
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify,
  sourcemap: false,
  write: false,
  legalComments: 'none',
  logLevel: 'warning',
});

const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
let assetKB = 0;
const assets = GLBS.map((n) => {
  const b64 = gzipSync(readFileSync(resolve(root, 'blender/out', n + '.glb')), { level: 9 }).toString('base64');
  assetKB += b64.length / 1024;
  return `<script type="application/octet-stream" id="glb-${n}">${b64}</script>`;
}).join('\n');

const template = readFileSync(resolve(root, 'src/index.html'), 'utf8');
for (const k of ['<!--BUNDLE-->', '<!--ASSETS-->']) {
  if (!template.includes(k)) throw new Error(`src/index.html 缺少 ${k} 佔位符`);
}
const full = template.replace('<!--ASSETS-->', () => assets).replace('<!--BUNDLE-->', () => `<script type="module">${js}</script>`);
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, full, 'utf8');
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0);
console.log(`${outFile}: ${kb(full)} KB（程式 ${kb(js)} KB、模型 ${assetKB.toFixed(0)} KB：${GLBS.join(' ')}；parts ${parts.length} 個）`);
