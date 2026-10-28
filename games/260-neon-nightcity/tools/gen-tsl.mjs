// 把執行期自動轉好的 TSL 寫成原始碼（src/tsl/）：之後 ?gfx=webgpu 直接取用，不必每次載入都轉譯（plans/260-webgpu.md 第 3 步）
// node tools/gen-tsl.mjs [--fresh]：無頭開 ?gfx=webgpu&tslgen=1（一律轉譯），走戶外（白天、夜裡、雨夜）與每個室內場館，
// 每個場景用 __nc.gfx.warm() 把看不到的物件的材質也轉一次，最後 __nc.gfx.dump() 寫成
//   src/tsl/lib.mjs（共用函式庫 GL_LIB，依 defines 的變體）、src/tsl/<材質名字>.mjs（各 defines 形狀）、src/tsl/index.mjs。
// 預設和上次產生的合併（這次沒走到的保留，執行期照雜湊判斷能不能用）；--fresh 只留這次的。改了 GLSL 要重跑，再 npm run build
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, unlinkSync, mkdirSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(root, '../..');
const outDir = resolve(root, 'src/tsl');
mkdirSync(outDir, { recursive: true });
const fresh = process.argv.includes('--fresh');
const srv = createServer((q, s) => {
  const f = resolve(repo, '.' + decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(repo + sep) || !existsSync(f) || !statSync(f).isFile()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); s.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const { browser, page, log } = await open(`http://127.0.0.1:${srv.address().port}/web/260-neon-nightcity.html?gfx=webgpu&tslgen=1`, { w: 1280, h: 800, query: '' });
const step = async (ms) => { await raf(page); await page.waitForTimeout(ms); await raf(page); };
let dump;
try {
  await page.evaluate(() => {
    const nc = window.__nc; if (nc.gfx.name !== 'webgpu') throw new Error('這台機器的無頭 Chrome 開不了 WebGPU');
    try { localStorage.removeItem('nc260.motors'); } catch (e) {}
    nc.start(); nc.menu.set('blur', 0);
    const R = nc.renderer, o = R.render.bind(R); R.render = (s, c) => { if (s.isScene && s.children.length > 5) window.__scn = s; return o(s, c); };   // 最後畫的場景（室內場館）
  });
  await page.waitForTimeout(4000);
  const nLots = await page.evaluate(() => window.__nc.city.lots.length);
  const pick = Array.from({ length: 14 }, (_, k) => Math.floor((k + .5) * nLots / 14));
  for (const [hour, wx] of [[15, 'clear'], [23, 'clear'], [21, 'rain']]) {
    await page.evaluate(([h, w]) => { window.__nc.time(h * 60); window.__nc.weather(w, true); }, [hour, wx]);
    for (const i of pick) { await page.evaluate(i => { const nc = window.__nc, L = nc.city.lots[i]; nc.camAt(); nc.walk(); nc.tpL((L.x0 + L.x1) / 2 + 6, (L.z0 + L.z1) / 2 + 6); }, i); await step(1200); }
    await page.evaluate(() => { const nc = window.__nc, c = nc.W(0, 0); nc.camAt(c[0], 260, c[1] + 300, c[0], 0, c[1]); }); await step(2500);
    await page.evaluate(() => window.__nc.gfx.warm(window.__nc.scene));
  }
  // 光格島（21-tron.js）：走近才下載近景，等它建好（光束、水池、光牆的材質）
  const tron = await page.evaluate(() => { const nc = window.__nc, t = nc.props && nc.props.tron; if (!t || !t.T) return false; const P = t.T.P; nc.camAt(); nc.walk(); t.tp((P.x0 + P.x1) / 2, P.z0 + 6, 0); return true; });
  if (tron) { for (let i = 0; i < 200 && !(await page.evaluate(() => window.__nc.props.tron.T.built)); i++) await page.waitForTimeout(250); await step(2500); await page.evaluate(() => window.__nc.gfx.warm(window.__nc.scene)); }
  else console.log('沒有光格島（以檔案開啟或下載失敗）');
  await page.evaluate(() => { window.__nc.camAt(); window.__nc.time(22 * 60); window.__nc.weather('clear', true); });
  const venues = await page.evaluate(() => Object.keys(window.__nc.venues ? window.__nc.venues() : {}));
  for (const v of venues.length ? venues : ['club', 'bar', 'home', 'show', 'chrome', 'bank', 'clubB', 'metro', 'bunker', 'casino', 'casinoB', 'drain', 'loft', 'villa', 'office', 'mini', 'l16', 'i14', 'lr', 'pub', 'store']) {
    const ok = await page.evaluate(v => { try { window.__nc.enter(v); return true; } catch (e) { return false; } }, v);
    if (!ok) { console.log('進不去', v); continue; }
    await step(2200);
    await page.evaluate(() => { if (window.__scn) window.__nc.gfx.warm(window.__scn); try { window.__nc.exit(); } catch (e) {} });
  }
  await step(1500);
  await page.evaluate(() => window.__nc.gfx.warm(window.__nc.scene));
  dump = await page.evaluate(() => ({ ...window.__nc.gfx.dump(), err: window.__nc.gfx.err(), clash: window.__nc.gfx.clash() }));
  for (const s of [...log.pageerrors, ...log.errors].slice(0, 8)) console.log('  ERROR', s.slice(0, 300));
} finally { await browser.close(); srv.close(); }
if (dump.err.length || dump.clash.length) { console.log('轉換失敗或撞名，不寫檔：', [...dump.err, ...dump.clash].join('\n  ')); process.exit(1); }

// 和上次的合併（同一個鍵用這次的）
const prev = { LIB: {}, MAT: {} };
if (!fresh && existsSync(resolve(outDir, 'index.mjs'))) Object.assign(prev, await import(pathToFileURL(resolve(outDir, 'index.mjs')).href + '?t=' + Date.now()));
const J = JSON.stringify, libs = new Map(), mats = new Map();
const dedent = s => { const L = s.split('\n'), n = Math.min(...L.filter(l => l.trim()).map(l => l.match(/^\s*/)[0].length)); return L.map(l => l.slice(n)).join('\n'); };
const fnSrc = f => dedent(String(f).replace(/^[^{]*\{\n?/, '').replace(/\n?\s*\}$/, ''));   // 上次的函式 → 本體字串（縮排還原，重跑不會越縮越深）
if (!fresh) {
  for (const [k, f] of Object.entries(prev.LIB)) libs.set(k, fnSrc(f));
  for (const [name, shapes] of Object.entries(prev.MAT)) for (const [shape, g] of Object.entries(shapes)) {
    if (!mats.has(name)) mats.set(name, new Map());
    mats.get(name).set(shape, { ...g, v: fnSrc(g.vertex), f: fnSrc(g.fragment) });
  }
}
const before = [...mats.values()].reduce((n, m) => n + m.size, 0);
for (const [k, src] of Object.entries(dump.libs)) libs.set(k, src);
for (const g of dump.mats) { if (!mats.has(g.name)) mats.set(g.name, new Map()); mats.get(g.name).set(g.shape, g); }

const HEAD = '// 自動產生（node tools/gen-tsl.mjs），不要手改：改 GLSL 之後重跑產生器\n';
const ind = s => s.split('\n').map(l => l ? '  ' + l : l).join('\n');
for (const f of readdirSync(outDir)) if (f.endsWith('.mjs')) unlinkSync(resolve(outDir, f));
writeFileSync(resolve(outDir, 'lib.mjs'), HEAD + '// 共用函式庫（00-core.js 的 GL_LIB）：鍵是它用到的 defines，make(TSL, E) 回傳函式與全域變數\nexport default {\n' +
  [...libs].map(([k, src]) => `${J(k)}: (TSL, E) => {\n${ind(src)}\n},\n`).join('') + '};\n');
const files = [];
for (const [name, shapes] of [...mats].sort(([a], [b]) => a.localeCompare(b))) {
  const file = `m-${name}.mjs`; files.push([name, file]);
  writeFileSync(resolve(outDir, file), HEAD + `// 材質 ${J(name)}：鍵是 defines 的形狀（有值的寫成 *），h 是產生時 GLSL 的雜湊\nexport default {\n` +
    [...shapes].sort(([a], [b]) => a.localeCompare(b)).map(([shape, g]) =>
      `${J(shape)}: {\n  h: ${J(g.h)}, lib: ${J(g.lib)}, libV: ${!!g.libV}, libF: ${!!g.libF},\n  uniforms: ${J(g.uniforms)},\n  varyings: ${J(g.varyings)},\n  attributes: ${J(g.attributes)},\n` +
      `  vertex: (TSL, E) => {\n${ind(ind(g.v))}\n  },\n  fragment: (TSL, E) => {\n${ind(ind(g.f))}\n  },\n},\n`).join('') + '};\n');
}
writeFileSync(resolve(outDir, 'index.mjs'), HEAD + '// 02-gfx.js 的 gfxAuto 照「材質名字＋defines 的形狀」取用，GLSL 的雜湊對不上就退回執行期轉譯（__nc.gfx.gen() 列出）\n' +
  "import LIB from './lib.mjs';\n" + files.map(([, f], i) => `import m${i} from './${f}';\n`).join('') +
  'export { LIB };\nexport const MAT = {\n' + files.map(([n], i) => `  ${J(n)}: m${i},\n`).join('') + '};\n');
const after = [...mats.values()].reduce((n, m) => n + m.size, 0);
console.log(`這次轉了 ${dump.mats.length} 個、函式庫 ${Object.keys(dump.libs).length} 個變體；合計 ${after} 個（上次 ${before}），${mats.size} 個名字 → ${outDir}`);
