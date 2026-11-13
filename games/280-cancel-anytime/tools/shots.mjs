// 批次截圖＋效能：node tools/shots.mjs <輸出目錄> [--page 280-cancel-anytime.html] [--levels 1-10] [--sizes 1440x900,390x844] [--wait 9000] [--q "speed=1"] [--preview]
// 每關用 ?auto=1 讓機器人開打後截一張，並印出三角形數、draw call、rAF 平均幀時間（需要 &vdbg=1 的 window.__view）。
// --preview 另外拍 tools/preview.html 的 units / props 兩頁。需先在 repo 根目錄 python3 -m http.server 8280。
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const out = args[0] && !args[0].startsWith('--') ? args[0] : '/tmp/280-shots';
const PAGE = opt('--page', '280-cancel-anytime.html'), port = opt('--port', '8280');
const spec = opt('--levels', '1-10');
const levels = spec.includes('-') ? (([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i))(spec.split('-').map(Number)) : spec.split(',').map(Number);
const sizes = opt('--sizes', '1440x900,390x844').split(',').map(s => s.split('x').map(Number));
const wait = +opt('--wait', '9000'), extra = opt('--q', 'speed=1');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const jobs = [];
for (const [w, h] of sizes) for (const lv of levels) jobs.push(async () => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 500 ? 2 : 1, isMobile: w < 500, hasTouch: w < 500 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/web/${PAGE}?lv=${lv}&auto=1&vdbg=1&${extra}`, { waitUntil: 'load' });
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/L${lv}-${w}.png` });
  const info = await page.evaluate(() => new Promise(res => {
    const V = window.__view; if (!V) return res(null);
    const r = V.renderer.info.render; let n = 0, t0 = performance.now();
    const f = () => { if (++n < 60) requestAnimationFrame(f); else res({ tris: r.triangles, calls: r.calls, ms: +((performance.now() - t0) / 60).toFixed(2), stats: V.stats ? V.stats() : null }); };
    requestAnimationFrame(f);
  }));
  console.log(`L${lv} ${w}x${h}`, JSON.stringify(info), errs.length ? 'ERR ' + errs.slice(0, 3).join(' | ') : '');
  await ctx.close();
});
if (args.includes('--preview')) for (const set of ['units', 'props']) jobs.push(async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/games/280-cancel-anytime/tools/preview.html?set=${set}`, { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${out}/preview-${set}.png` });
  console.log('preview', set, errs.length ? 'ERR ' + errs.slice(0, 3).join(' | ') : 'ok');
  await page.close();
});
// 一次三個分頁，避免搶 GPU 讓幀時間失真太多
for (let i = 0; i < jobs.length; i += 3) await Promise.all(jobs.slice(i, i + 3).map(j => j()));
await browser.close();
