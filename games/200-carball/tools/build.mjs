// 打包：src/client/main.js（含 three、Rapier 與 core）→ 內嵌進 src/index.html → ../../web/200-carball.html
// Rapier 的 WASM 原本以 base64 寫在 JS 裡（4 MB），這裡改成 gzip 後的 base64 另外放，瀏覽器用 DecompressionStream 解開。
// --dev 不壓縮；--out=<檔案> 改輸出位置
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const minify = !process.argv.includes('--dev');
const outArg = process.argv.find((a) => a.startsWith('--out='));
const outFile = outArg ? resolve(process.cwd(), outArg.slice(6)) : resolve(root, '../../web/200-carball.html');
const rapierDir = resolve(root, 'node_modules/@dimforge/rapier3d-compat');

const stripWasm = {
  name: 'strip-rapier-wasm',
  setup(b) {
    b.onLoad({ filter: /rapier3d-compat[\\/].*rapier\.mjs$/ }, (args) => {
      const src = readFileSync(args.path, 'utf8');
      const re = /[A-Za-z_$][\w$]*\.toByteArray\("AGFzbQ[A-Za-z0-9+/=]*"\)\.buffer/;
      if (!re.test(src)) throw new Error('找不到 Rapier 內嵌的 WASM，版本可能變了');
      return { contents: src.replace(re, 'globalThis.__RAPIER_WASM__'), loader: 'js' };
    });
  },
};

const result = await build({
  entryPoints: [resolve(root, 'src/client/main.js')], bundle: true, format: 'iife', target: 'es2020', minify,
  sourcemap: false, write: false, legalComments: 'none', logLevel: 'warning', plugins: [stripWasm],
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const wasm = readFileSync(resolve(rapierDir, 'dist/rapier_wasm3d_bg.wasm'));
const wasmB64 = gzipSync(wasm, { level: 9 }).toString('base64');
const template = readFileSync(resolve(root, 'src/index.html'), 'utf8');
for (const k of ['<!--BUNDLE-->', '<!--WASM-->']) if (!template.includes(k)) throw new Error(`src/index.html 缺少 ${k} 佔位符`);
const full = template.replace('<!--WASM-->', () => wasmB64).replace('<!--BUNDLE-->', () => `<script>${js}</script>`);
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, full, 'utf8');
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0);
console.log(`${outFile}: ${kb(full)} KB（程式 ${kb(js)} KB、WASM ${kb(wasmB64)} KB）`);
