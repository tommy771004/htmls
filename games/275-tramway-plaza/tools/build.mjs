// 打包腳本：將 src/main.js 與 Three.js r187 (three / three/webgpu / three/tsl) 打包內嵌為單一 HTML 檔
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const minify = !process.argv.includes('--dev');
const outArg = process.argv.find((a) => a.startsWith('--out='));
const outFile = outArg ? resolve(process.cwd(), outArg.slice(6)) : resolve(root, '../../web/275-tramway-plaza.html');

const result = await build({
  entryPoints: [resolve(root, 'src/main.js')],
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
const template = readFileSync(resolve(root, 'src/index.html'), 'utf8');
if (!template.includes('<!--BUNDLE-->')) {
  throw new Error('src/index.html 缺少 <!--BUNDLE--> 佔位標記');
}

const full = template.replace('<!--BUNDLE-->', () => `<script type="module">${js}</script>`);
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, full, 'utf8');
const kb = (Buffer.byteLength(full) / 1024).toFixed(1);
console.log(`[build 275] ${outFile} (${kb} KB)`);
