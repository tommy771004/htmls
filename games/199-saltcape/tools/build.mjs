// 打包：src/client/main.js（含 three 與共用規則）→ 內嵌進 src/index.html → ../../web/199-saltcape.html
// --dev 不壓縮；--out=<檔案> 改輸出位置
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const minify = !process.argv.includes('--dev');
const outArg = process.argv.find((a) => a.startsWith('--out='));
const outFile = outArg ? resolve(process.cwd(), outArg.slice(6)) : resolve(root, '../../web/199-saltcape.html');
const result = await build({
  entryPoints: [resolve(root, 'src/client/main.js')], bundle: true, format: 'iife', target: 'es2020', minify,
  sourcemap: false, write: false, legalComments: 'none', logLevel: 'warning',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const template = readFileSync(resolve(root, 'src/index.html'), 'utf8');
if (!template.includes('<!--BUNDLE-->')) throw new Error('src/index.html 缺少 <!--BUNDLE--> 佔位符');
const full = template.replace('<!--BUNDLE-->', () => `<script>${js}</script>`);
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, full, 'utf8');
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0);
console.log(`${outFile}: ${kb(full)} KB（bundle ${kb(js)} KB）`);
