// 赭線 OCHRE LINE 打包：src/ → ../../web/278-ochre-line.html（JS 與 Havok wasm 內嵌，素材留在 assets/278/）
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dev = process.argv.includes('--dev') || process.argv.includes('--count');
const count = process.argv.includes('--count');
const outArg = process.argv.find(a => a.startsWith('--out='));
const out = outArg ? resolve(root, outArg.slice(6)) : resolve(root, '../../web/278-ochre-line.html');

// 新槍清單每次重掃：多個 agent 同時烘焙時 index.json 可能被較舊的掃描蓋掉，打包前補回來
try { execFileSync('node', [resolve(here, 'guns-manifest.mjs')], { stdio: 'inherit' }); } catch (e) { console.warn('guns-manifest 失敗，沿用現有 index.json：' + e.message); }

const res = await build({
  entryPoints: [resolve(root, 'src/main.js')],
  bundle: true, write: false, format: 'iife', target: 'es2022',
  minify: !dev, legalComments: 'none', logLevel: 'error',
  loader: { '.wasm': 'dataurl' },
  plugins: count ? [{ name: 'alloc-count', setup(b) {  // 驗收用：在數學類別建構子裡計數
    b.onLoad({ filter: /Maths[\\/]math\.(vector|color)(\.pure)?\.js$/ }, a => {
      let src = readFileSync(a.path, 'utf8');
      src = src.replace(/(export class (Vector2|Vector3|Vector4|Quaternion|Matrix|Color3|Color4)\b[^{]*\{[\s\S]*?constructor\([^)]*\)\s*\{)/g, (m, h, n) => `${h} if (globalThis.__alloc?.on) { globalThis.__alloc.${n} = (globalThis.__alloc.${n} || 0) + 1; (globalThis.__allocStacks ??= []).push(new Error('${n}').stack.split('\\n').slice(2, 7).join(' <- ')); }`);
      return { contents: src, loader: 'js' };
    });
  } }] : [],
  define: { 'import.meta.url': '"http://local/"', __DEV__: dev ? 'true' : 'false' },
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = readFileSync(resolve(root, 'src/index.html'), 'utf8').replace('/*__BUNDLE__*/', () => js);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`${out}  ${(html.length / 1048576).toFixed(2)} MB`);
