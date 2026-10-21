// 打包：src/boot.js → main.js（含 three）→ 內嵌進 src/index.html。
// 預設輸出 ../../web/198-ki-lanes.html（只有主模型會這樣打）；--out=<資料夾> 輸出 <資料夾>/index.html；--dev 不壓縮。
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const minify = !process.argv.includes('--dev');
const outArg = process.argv.find((a) => a.startsWith('--out='));
const outFile = outArg ? resolve(root, outArg.slice(6), 'index.html') : resolve(root, '../../web/198-ki-lanes.html');

// assets/198 各 GLB 的大小寫進頁面（glb.js 的 KI_GLB_BYTES），開場載入進度用它估總量
const assets = resolve(root, '../../assets/198');
const glbBytes = Object.fromEntries(readdirSync(assets).filter((f) => f.endsWith('.glb')).map((f) => [f.slice(0, -4), statSync(resolve(assets, f)).size]));

const result = await build({
  entryPoints: [resolve(root, 'src/boot.js')], bundle: true, format: 'iife', target: 'es2020', minify,
  define: { KI_GLB_BYTES: JSON.stringify(glbBytes) },
  sourcemap: false, write: false, legalComments: 'none', logLevel: 'warning',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const template = readFileSync(resolve(root, 'src/index.html'), 'utf8');
if (!template.includes('<!--BUNDLE-->')) throw new Error('src/index.html 缺少 <!--BUNDLE--> 佔位符');
// 程式切成約 256 KB 一段、放在不執行的 <script type="text/x-ki"> 裡，每段後面接一行回報進度：
// 頁面還在下載時，src/index.html 的載入層就能照實際收到的位元組數前進；最後一段到齊再接起來執行
const CHUNK = 256 * 1024, parts = [];
for (let i = 0; i < js.length; ) {
  let j = Math.min(js.length, i + CHUNK);
  if (j < js.length && /[\ud800-\udbff]/.test(js[j - 1])) j++; // 不切開代理對
  parts.push(js.slice(i, j)); i = j;
}
const glbTotal = Object.values(glbBytes).reduce((a, b) => a + b, 0);
const chunks = parts.map((p, i) => `<script type="text/x-ki" class="kiPart">${p}</script><script>__kiBoot.page(${(i + 1) / parts.length})</script>`).join('\n');
const run = `<script>(function () { var h = document.querySelectorAll('script.kiPart'), s = document.createElement('script'), t = ''; for (var i = 0; i < h.length; i++) { t += h[i].textContent; h[i].remove(); } s.textContent = t; document.body.appendChild(s); })();</script>`;
const full = template.replace('<!--BUNDLE-->', () => `<script>__kiBoot.weigh(${Buffer.byteLength(js)}, ${glbTotal})</script>\n${chunks}\n${run}`);
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, full, 'utf8');
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0);
console.log(`${outFile}: ${kb(full)} KB（bundle ${kb(js)} KB）`);
