// 打包：src/parts/*.js 依檔名順序串成一個 ES 模組（共用頂層變數）→ esbuild 連同 three 打包 → 內嵌進 src/index.html
// → ../../web/260-neon-nightcity.html。blender/out/ 裡用到的 GLB 以 gzip＋base64 放進
// <script type="application/octet-stream" id="glb-名稱">，頁面執行時用 DecompressionStream 解壓後交給 GLTFLoader。
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const minify = !process.argv.includes('--dev');
const outArg = process.argv.find((a) => a.startsWith('--out='));
const outFile = outArg ? resolve(process.cwd(), outArg.slice(6)) : resolve(root, '../../web/260-neon-nightcity.html');
const GLBS = ['interior_props', 'street_props', 'people', 'wear', 'traffic', 'hill_homes'];   // 人物：blender/people.py；衣服：blender/wear.py；車流：tools/traffic.mjs；山坡住宅：blender/hill_homes.py

const partsDir = resolve(root, 'src/parts');
const parts = readdirSync(partsDir).filter((f) => f.endsWith('.js')).sort();
// 山坡別墅的平面（tools/villa-plan.mjs 產生的 blender/out/villa_walls.json）精簡後放在最前面當 VILLA_PLAN：
// 每型 { name, lv: [{ L, z, h, w: [[x0, y0, x1, y1, 種類, 開口]], d: [[x, y, 寬, 種類, 軸]], r: [[x0, x1, y0, y1, 種類, 名稱]] }], st: 樓梯,
//   o: 戶外 [[層, 種類, x0, x1, y0, y1]]（villa_plans.json 的 outdoor）, f: [[層, 家具, x, y, 朝向, 寬縮放, 深縮放, 佔地 [x0, x1, y0, y1]]],
//   dr: 會動的門扇（blender/out/villa_doors.json，hill_homes.py 寫的） }（Blender 座標，+y 朝路）
const villaDoors = JSON.parse(readFileSync(resolve(root, 'blender/out/villa_doors.json'), 'utf8'));   // hill_homes.py 建的會動的門扇（格式見那個檔）
const villaSpec = JSON.parse(readFileSync(resolve(root, 'blender/villa_plans.json'), 'utf8')).villas;
const r3 = (v) => typeof v === 'number' ? Math.round(v * 1000) / 1000 : Array.isArray(v) ? v.map(r3) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, r3(x)])) : v;
const villa = Object.fromEntries(Object.entries(JSON.parse(readFileSync(resolve(root, 'blender/out/villa_walls.json'), 'utf8'))).map(([k, v]) => [k, r3({
  name: villaSpec[k].name,
  lv: v.levels.map((l) => ({ L: l.L, z: l.z, h: l.h, w: l.walls.map((s) => [s.a[0], s.a[1], s.b[0], s.b[1], s.t, s.open || 0]), d: l.doors.map((d) => [d.x, d.y, d.w, d.kind, d.ax]),
    r: l.rooms.map((r) => [...r.r, r.kind, r.name]) })),
  st: v.stairs, o: villaSpec[k].outdoor || [], f: (v.furn || []).map((f) => [f.L, f.id, f.x, f.y, f.face, f.sx, f.sy, f.r]), dr: villaDoors[k] || [],
})]));
const source = `// ── villa_walls.json ──\nconst VILLA_PLAN = ${JSON.stringify(villa)};\n` + parts.map((f) => `// ── ${f} ──\n` + readFileSync(resolve(partsDir, f), 'utf8')).join('\n');

const result = await build({
  stdin: { contents: source, resolveDir: partsDir, sourcefile: 'parts.js', loader: 'js' },
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
let assetKB = 0;
const assets = GLBS.map((n) => {
  const b64 = gzipSync(readFileSync(resolve(root, 'blender/out', n + '.glb')), { level: 9 }).toString('base64');
  assetKB += b64.length / 1024;
  return `<script type="application/octet-stream" id="glb-${n}">${b64}</script>`;
}).join('\n');

const template = readFileSync(resolve(root, 'src/index.html'), 'utf8');
for (const k of ['<!--BUNDLE-->', '<!--ASSETS-->']) {
  if (!template.includes(k)) throw new Error(`src/index.html 缺少 ${k} 佔位符`);
}
const full = template.replace('<!--ASSETS-->', () => assets).replace('<!--BUNDLE-->', () => `<script type="module">${js}</script>`);
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, full, 'utf8');
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0);
console.log(`${outFile}: ${kb(full)} KB（程式 ${kb(js)} KB、模型 ${assetKB.toFixed(0)} KB：${GLBS.join(' ')}；parts ${parts.length} 個）`);
