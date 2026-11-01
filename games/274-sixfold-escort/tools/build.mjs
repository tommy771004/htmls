// 打包：src/main.js（含 three / three/webgpu / three/tsl，ESM）→ 內嵌進 src/index.html → ../../web/274-sixfold-escort.html
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const minify = !process.argv.includes('--dev');
const outArg = process.argv.find((a) => a.startsWith('--out='));
const outFile = outArg ? resolve(process.cwd(), outArg.slice(6)) : resolve(root, '../../web/274-sixfold-escort.html');

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
  throw new Error('src/index.html 缺少 <!--BUNDLE--> 佔位符');
}
const outDir = resolve(root, 'blender/out');
const glbs = existsSync(outDir) ? readdirSync(outDir).filter((f) => f.endsWith('.glb') && !f.startsWith('_')).sort() : [];
const assets = glbs.map((f) => `<script type="application/octet-stream" id="glb-${basename(f, '.glb')}">${gzipSync(readFileSync(resolve(outDir, f)), { level: 9 }).toString('base64')}</script>`).join('\n');
const full = template.replace('<!--BUNDLE-->', () => `${assets}\n<script type="module">${js}</script>`);
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, full, 'utf8');
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0);
console.log(`${outFile}: ${kb(full)} KB（程式 ${kb(js)} KB、人物模型 ${kb(assets)} KB：${glbs.join(' ') || '無'}）`);
