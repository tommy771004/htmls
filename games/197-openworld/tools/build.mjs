// 打包：src/main.js（含 three）與 src/ui/hud.css → 內嵌進 src/index.html，輸出 ../../web/197-openworld.html。
// 模型與貼圖不內嵌，執行時從 ../assets/197/ 讀取；--dev 不壓縮。
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const minify = !process.argv.includes('--dev');
const outFile = resolve(root, '../../web/197-openworld.html');

const result = await build({
  entryPoints: [resolve(root, 'src/main.js')], bundle: true, format: 'iife', target: 'es2022', minify,
  // DRACOLoader 在模組頂層用 import.meta.url 組解碼器網址；iife 沒有 import.meta，改以頁面網址代替（素材都沒用 Draco，不會真的去抓）
  define: { 'import.meta.env.BASE_URL': '"../assets/197/"', 'import.meta.url': 'document.baseURI' },
  sourcemap: false, write: false, legalComments: 'none', logLevel: 'warning',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
if (js.includes('import.meta')) throw new Error('打包結果仍有 import.meta，素材路徑會失效');
const css = readFileSync(resolve(root, 'src/ui/hud.css'), 'utf8');
const template = readFileSync(resolve(root, 'src/index.html'), 'utf8');
for (const mark of ['<!--STYLE-->', '<!--BUNDLE-->']) {
  if (!template.includes(mark)) throw new Error(`src/index.html 缺少 ${mark} 佔位符`);
}
const full = template
  .replace('<!--STYLE-->', () => `<style>\n${css}</style>`)
  .replace('<!--BUNDLE-->', () => `<script>${js}</script>`);
writeFileSync(outFile, full, 'utf8');
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0);
console.log(`${outFile}: ${kb(full)} KB（bundle ${kb(js)} KB）`);
