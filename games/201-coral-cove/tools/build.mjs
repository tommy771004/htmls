// 打包：src/main.js（含 three）→ 內嵌進 src/index.html → ../../web/201-coral-cove.html
// blender/out/*.glb（底線開頭的除外）以 gzip＋base64 放進 <script type="application/octet-stream" id="glb-名稱">，
// 頁面用 DecompressionStream 解開再交給 GLTFLoader.parse。--dev 不壓縮；--out=<檔案> 改輸出位置
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const minify = !process.argv.includes('--dev');
const outArg = process.argv.find((a) => a.startsWith('--out='));
const outFile = outArg ? resolve(process.cwd(), outArg.slice(6)) : resolve(root, '../../web/201-coral-cove.html');

const result = await build({
  entryPoints: [resolve(root, 'src/main.js')], bundle: true, format: 'iife', target: 'es2020', minify,
  sourcemap: false, write: false, legalComments: 'none', logLevel: 'warning',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const outDir = resolve(root, 'blender/out');
const glbs = existsSync(outDir) ? readdirSync(outDir).filter((f) => f.endsWith('.glb') && !f.startsWith('_')).sort() : [];
let assetKB = 0;
const assets = glbs.map((f) => {
  const b64 = gzipSync(readFileSync(resolve(outDir, f)), { level: 9 }).toString('base64');
  assetKB += b64.length / 1024;
  return `<script type="application/octet-stream" id="glb-${basename(f, '.glb')}">${b64}</script>`;
}).join('\n');
const template = readFileSync(resolve(root, 'src/index.html'), 'utf8');
for (const k of ['<!--BUNDLE-->', '<!--ASSETS-->']) if (!template.includes(k)) throw new Error(`src/index.html 缺少 ${k} 佔位符`);
const full = template.replace('<!--ASSETS-->', () => assets).replace('<!--BUNDLE-->', () => `<script>${js}</script>`);
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, full, 'utf8');
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0);
console.log(`${outFile}: ${kb(full)} KB（程式 ${kb(js)} KB、模型 ${assetKB.toFixed(0)} KB：${glbs.join(' ') || '無'}）`);
