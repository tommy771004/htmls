// 建置腳本：使用 esbuild 將 Three.js、Cannon-es 與 src/entry.js 打包並內嵌至 src/template.html，
// 產出零外部網路依賴的單檔 web/285-apex-stage.html。

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outHtml = path.resolve(root, '../../web/285-apex-stage.html');

const result = await esbuild.build({
  entryPoints: [path.join(root, 'src/entry.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  write: false,
  legalComments: 'none'
});

const js = result.outputFiles[0].text;
const tpl = fs.readFileSync(path.join(root, 'src/template.html'), 'utf8');

// 使用 function replacement 避免壓縮後 JS 中的 $& 等特殊序列被誤解析
const html = tpl.replace('/*BUNDLE*/', () => js.trim());

fs.mkdirSync(path.dirname(outHtml), { recursive: true });
fs.writeFileSync(outHtml, html);

const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
console.log(`Built ${outHtml} (${kb} KB)`);
