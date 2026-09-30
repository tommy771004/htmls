// 打包：src/main.js（含 three）→ 內嵌進 src/index.html → web/194-powder-peak.html（單檔，網站 commit 的就是這個檔案）。
// --out=資料夾：改輸出到 <資料夾>/index.html（例如 --out=dist 給本機試玩或效能測試用）。
// --artifact：另外輸出 artifact.html（去掉 html/head/body 外殼，給 Artifact 發布用）。
// --dev：不壓縮。
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const minify = !process.argv.includes('--dev');
const outArg = process.argv.find((a) => a.startsWith('--out='));
const outFile = outArg
  ? resolve(root, outArg.slice(6), 'index.html')
  : resolve(root, '../../web/194-powder-peak.html');

const result = await build({
  entryPoints: [resolve(root, 'src/main.js')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify,
  sourcemap: false,
  write: false,
  legalComments: 'none',
  logLevel: 'warning',
});

const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const template = readFileSync(resolve(root, 'src/index.html'), 'utf8');
if (!template.includes('<!--BUNDLE-->')) throw new Error('src/index.html 缺少 <!--BUNDLE--> 佔位符');

const full = template.replace('<!--BUNDLE-->', () => `<script>${js}</script>`);
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, full, 'utf8');

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0);
let msg = `${outFile}: ${kb(full)} KB（bundle ${kb(js)} KB）`;

if (process.argv.includes('--artifact')) {
  // Artifact 版：head 內容（去掉 charset / viewport meta）+ body 內容，不含 html/head/body 標籤
  const head = (full.match(/<head[^>]*>([\s\S]*?)<\/head>/i) || [, ''])[1]
    .replace(/<meta[^>]*charset[^>]*>/gi, '')
    .replace(/<meta[^>]*name=["']viewport["'][^>]*>/gi, '');
  const body = (full.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [, ''])[1];
  const titleMatch = head.match(/<title>[\s\S]*?<\/title>/i);
  const headRest = titleMatch ? head.replace(titleMatch[0], '') : head;
  const artifact = `${titleMatch ? titleMatch[0] : ''}\n${headRest.trim()}\n${body.trim()}\n`;
  const artifactFile = resolve(dirname(outFile), 'artifact.html');
  writeFileSync(artifactFile, artifact, 'utf8');
  msg += `，artifact.html ${kb(artifact)} KB`;
}
console.log(msg);
