// 打包：src/main.js（含 three）→ 內嵌進 src/index.html → ../../web/261-bayfront-empire.html
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dev = process.argv.includes('--dev');
const outArg = process.argv.find((a) => a.startsWith('--out='));
const outFile = outArg ? resolve(process.cwd(), outArg.slice(6)) : resolve(root, '../../web/261-bayfront-empire.html');

const result = await build({
  entryPoints: [resolve(root, 'src/main.js')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: !dev,
  write: false,
  legalComments: 'none',
  logLevel: 'warning',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const template = readFileSync(resolve(root, 'src/index.html'), 'utf8');
if (!template.includes('<!--BUNDLE-->')) throw new Error('src/index.html 缺少 <!--BUNDLE--> 佔位符');
const html = template.replace('<!--BUNDLE-->', () => `<script>${js}</script>`);
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, html, 'utf8');
console.log(`${outFile}: ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB（程式 ${(Buffer.byteLength(js) / 1024).toFixed(0)} KB）`);
