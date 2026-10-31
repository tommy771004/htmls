// 每個材質都有 TSL：node tools/tsl-check.mjs。src/tsl/ 沒有的鍵（名字＋defines 的形狀）只畫替代色並 console.error，
// 一般驗收只走得到部分地點，這裡照原本產生器（tools/gen-tsl.mjs，已刪）的路線：戶外白天／夜裡／雨夜各 14 個地塊與俯瞰、光格島、每個室內場館，
// 每個場景用 __nc.gfx.warm() 把看不到的物件與 gfxLate 的材質也建一次。__nc.gfx.gen()／miss()／err()／clash() 都要是空的
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(root, '../..');
const srv = createServer((q, s) => {
  const f = resolve(repo, '.' + decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(repo + sep) || !existsSync(f) || !statSync(f).isFile()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); s.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const { browser, page, log } = await open(`http://127.0.0.1:${srv.address().port}/web/260-neon-nightcity.html`, { w: 1280, h: 800, query: '?cops=0' });
const step = async (ms) => { await raf(page); await page.waitForTimeout(ms); await raf(page); };
let res;
try {
  await page.evaluate(() => {
    const nc = window.__nc;
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
  // 光格島（21-tron.js）：走近才下載近景，等它建好
  const tron = await page.evaluate(() => { const nc = window.__nc, t = nc.props && nc.props.tron; if (!t || !t.T) return false; const P = t.T.P; nc.camAt(); nc.walk(); t.tp((P.x0 + P.x1) / 2, P.z0 + 6, 0); return true; });
  if (tron) { for (let i = 0; i < 200 && !(await page.evaluate(() => window.__nc.props.tron.T.built)); i++) await page.waitForTimeout(250); await step(2500); await page.evaluate(() => window.__nc.gfx.warm(window.__nc.scene)); }
  else console.log('沒有光格島（下載失敗）');
  await page.evaluate(() => { window.__nc.camAt(); window.__nc.time(22 * 60); window.__nc.weather('clear', true); });
  const venues = await page.evaluate(() => Object.keys(window.__nc.venues ? window.__nc.venues() : {}));
  let nv = 0;
  for (const v of venues.length ? venues : ['club', 'bar', 'home', 'show', 'chrome', 'bank', 'clubB', 'metro', 'bunker', 'casino', 'casinoB', 'drain', 'loft', 'villa', 'office', 'mini', 'l16', 'i14', 'lr', 'pub', 'store']) {
    const ok = await page.evaluate(v => { try { window.__nc.enter(v); return true; } catch (e) { return false; } }, v);
    if (!ok) { console.log('進不去', v); continue; }
    nv++; await step(2200);
    await page.evaluate(() => { if (window.__scn) window.__nc.gfx.warm(window.__scn); try { window.__nc.exit(); } catch (e) {} });
  }
  await step(1500);
  await page.evaluate(() => window.__nc.gfx.warm(window.__nc.scene));
  res = await page.evaluate(() => { const g = window.__nc.gfx; return { names: g.names(), gen: g.gen(), miss: g.miss(), err: g.err(), clash: g.clash() }; });
  res.venues = nv; res.tron = tron; res.errors = [...log.pageerrors, ...log.errors];
} finally { await browser.close(); srv.close(); }
console.log(`${res.names} 個鍵（名字＋defines 形狀）、${res.venues} 個場館、光格島 ${res.tron ? '有' : '沒有'}`);
const bad = [...res.gen, ...res.miss.map(s => 'miss ' + s), ...res.err.map(s => 'err ' + s), ...res.clash, ...res.errors.map(s => 'ERROR ' + s)];
for (const s of bad.slice(0, 20)) console.log('  ✗', s.slice(0, 300));
console.log(bad.length ? `✗ ${bad.length} 個問題` : '✓ 每個材質都有 TSL，沒有錯誤');
process.exit(bad.length ? 1 : 0);
