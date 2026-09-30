// 打包：core/（Rust → WASM）＋ blender/out/（賽道、模型、貼圖）＋ src/（esbuild）→ 單檔 web/195-sidewinder.html。
// 資產先 gzip（level 9）再 base64，以 window.__SW_ASSETS 注入在 bundle 前面；地面貼圖直接用 data:image/jpeg。
// --out=資料夾：改輸出 <資料夾>/index.html 並複製 public/_headers（Cloudflare Pages 用）。
// --dev：不壓縮。--skip-cargo：不跑 cargo，直接用現有的 .wasm。
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, constants as zc } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const dev = argv.includes('--dev');
const skipCargo = argv.includes('--skip-cargo');
const outArg = argv.find((a) => a.startsWith('--out='));
const outDir = outArg ? resolve(root, outArg.slice(6)) : null;
const outFile = outDir ? resolve(outDir, 'index.html') : resolve(root, '../../web/195-sidewinder.html');

const rel = (p) => relative(process.cwd(), p) || '.';
function fail(msg) {
  console.error(`\n[build] 失敗：${msg}`);
  process.exit(1);
}

const P = {
  core: resolve(root, 'core'),
  wasmDir: resolve(root, 'core/target/wasm32-unknown-unknown/release'),
  wasm: resolve(root, 'core/target/wasm32-unknown-unknown/release/sidewinder_core.wasm'),
  meshes: resolve(root, 'blender/out/meshes.bin'),
  tracks: [0, 1, 2, 3].map((n) => resolve(root, `blender/out/track_${n}.bin`)),
  albedo: [0, 1, 2, 3].map((n) => resolve(root, `blender/out/track_${n}.jpg`)),
  entry: resolve(root, 'src/main.js'),
  template: resolve(root, 'src/index.html'),
  headers: resolve(root, 'public/_headers'),
};

// 1. Rust → WASM
if (!skipCargo) {
  if (!existsSync(resolve(P.core, 'Cargo.toml'))) fail(`找不到 ${rel(P.core)}/Cargo.toml（core 還沒建立？可用 --skip-cargo 沿用現有 wasm）`);
  console.log('[build] cargo build --release --target wasm32-unknown-unknown');
  const r = spawnSync('cargo', ['build', '--release', '--target', 'wasm32-unknown-unknown'], { cwd: P.core, stdio: 'inherit' });
  if (r.error) fail(`無法執行 cargo：${r.error.message}（需要 Rust 與 wasm32-unknown-unknown target：rustup target add wasm32-unknown-unknown）`);
  if (r.status !== 0) fail(`cargo build 結束碼 ${r.status}`);
}

// 2. 檢查輸入（一次列出全部缺漏）
const missing = [P.wasm, P.meshes, ...P.tracks, ...P.albedo, P.entry, P.template].filter((p) => !existsSync(p));
if (missing.length) {
  let hint = '';
  if (missing.includes(P.wasm) && existsSync(P.wasmDir)) {
    const found = readdirSync(P.wasmDir).filter((f) => f.endsWith('.wasm'));
    hint = `\n  ${rel(P.wasmDir)} 內現有：${found.join(', ') || '（沒有 .wasm）'}（crate 名稱要是 sidewinder_core）`;
  }
  if (missing.some((p) => p.includes('/blender/out/'))) hint += '\n  賽道與模型：npm run assets（Blender headless）';
  fail(`缺少輸入檔：\n  ${missing.map(rel).join('\n  ')}${hint}`);
}

// 3. 資產：gzip + base64；檔頭先做最基本的檢查，完整格式檢查見 tools/check-assets.mjs
function magic(buf, m, file) {
  const got = buf.subarray(0, 4).toString('latin1');
  if (got !== m) fail(`${rel(file)} 檔頭是 "${got}"，應為 "${m}"`);
}
const sizes = [];
function pack(file, name) {
  const raw = readFileSync(file);
  const gz = gzipSync(raw, { level: zc.Z_BEST_COMPRESSION });
  const b64 = gz.toString('base64');
  sizes.push([name, raw.length, gz.length, b64.length]);
  return { raw, b64 };
}
const wasm = pack(P.wasm, 'core.wasm');
if (wasm.raw.readUInt32BE(0) !== 0x0061736d) fail(`${rel(P.wasm)} 不是 WebAssembly 檔`);
const meshes = pack(P.meshes, 'meshes.bin');
magic(meshes.raw, 'SWMS', P.meshes);
const tracks = P.tracks.map((f, n) => {
  const t = pack(f, `track_${n}.bin`);
  magic(t.raw, 'SWTK', f);
  return t.b64;
});
const albedo = P.albedo.map((f, n) => {
  const raw = readFileSync(f);
  if (!(raw[0] === 0xff && raw[1] === 0xd8 && raw[2] === 0xff)) fail(`${rel(f)} 不是 JPEG`);
  const b64 = raw.toString('base64');
  sizes.push([`track_${n}.jpg`, raw.length, raw.length, b64.length + 23]);
  return 'data:image/jpeg;base64,' + b64;
});
const assets = { v: 1, wasm: wasm.b64, meshes: meshes.b64, tracks, albedo };
const assetsTag = `<script>window.__SW_ASSETS=${JSON.stringify(assets).replace(/<\//g, '<\\/')}</script>`;

// 4. esbuild：JS 與 import 進來的 CSS 分成兩個輸出（outdir 只是虛擬路徑，不會寫檔）
let result;
try {
  result = await build({
    entryPoints: [P.entry],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    minify: !dev,
    sourcemap: false,
    write: false,
    outdir: resolve(root, '.esbuild-out'),
    legalComments: 'none',
    charset: 'utf8',
    logLevel: 'warning',
  });
} catch (e) {
  fail(`esbuild：${e.message.split('\n')[0]}`);
}
const jsOut = result.outputFiles.find((f) => f.path.endsWith('.js'));
const cssOut = result.outputFiles.filter((f) => f.path.endsWith('.css'));
if (!jsOut) fail('esbuild 沒有產出 .js');
const js = jsOut.text.replace(/<\/script/gi, '<\\/script');
const css = cssOut.map((f) => f.text).join('\n').replace(/<\/style/gi, '<\\/style');

// 5. 樣板替換（用函式當 replacer，避免 bundle 裡的 $& 之類被解讀）
let html = readFileSync(P.template, 'utf8');
for (const ph of ['<!--ASSETS-->', '<!--BUNDLE-->']) if (!html.includes(ph)) fail(`${rel(P.template)} 缺少 ${ph} 佔位符`);
if (!/<meta[^>]+name=["']viewport["']/i.test(html)) console.warn('[build] 警告：樣板沒有 viewport meta');
if (css) {
  if (!/<\/head>/i.test(html)) fail(`${rel(P.template)} 沒有 </head>，無法插入 <style>`);
  html = html.replace(/<\/head>/i, () => `<style>${css}</style>\n</head>`);
}
html = html.replace('<!--ASSETS-->', () => assetsTag);
html = html.replace('<!--BUNDLE-->', () => `<script>${js}</script>`);

// 6. 輸出
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, html, 'utf8');
if (outDir) {
  if (!existsSync(P.headers)) fail(`找不到 ${rel(P.headers)}`);
  copyFileSync(P.headers, resolve(outDir, '_headers'));
}

const kb = (n) => (n / 1024).toFixed(1).padStart(8);
console.log(`\n${'資產'.padEnd(14)}${'原始 KB'.padStart(9)}${'gzip KB'.padStart(9)}${'內嵌 KB'.padStart(9)}`);
for (const [n, a, b, c] of sizes) console.log(`${n.padEnd(16)}${kb(a)} ${kb(b)} ${kb(c)}`);
const bytes = (s) => Buffer.byteLength(s);
console.log(`${'bundle.js'.padEnd(16)}${kb(bytes(js))}`);
if (css) console.log(`${'style.css'.padEnd(16)}${kb(bytes(css))}`);
console.log(`\n${rel(outFile)}：${(bytes(html) / 1024 / 1024).toFixed(2)} MB${dev ? '（--dev 未壓縮）' : ''}`);
if (outDir) console.log(`${rel(resolve(outDir, '_headers'))}：已複製`);
