// 驗收：無頭 Chrome 在 1440×900 與 390×844 下，用 ?auto=1 讓機器人把指定關卡打完。
// 檢查：未捕捉例外、console.error、外部網路請求、viewport meta、手機水平溢出，並截圖。
// node tools/accept.mjs [關卡清單=1-10] [--port 8280] [--shots 目錄]
// 需要在 repo 根目錄起 HTTP 伺服器：python3 -m http.server 8280
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const pi = args.indexOf('--page'); const PAGE = pi >= 0 ? args.splice(pi, 2)[1] : '280-cancel-anytime.html';
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const port = opt('--port', '8280');
const shots = opt('--shots', '/tmp/280-shots');
mkdirSync(shots, { recursive: true });
const spec = args.find(a => /^\d/.test(a)) || '1-10';
const levels = spec.includes('-') ? (([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i))(spec.split('-').map(Number)) : spec.split(',').map(Number);
const sizes = args.includes('--mobile-only') ? [[390, 844]] : args.includes('--desktop-only') ? [[1440, 900]] : [[1440, 900], [390, 844]];

const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
let fail = 0;
for (const [w, h] of sizes) {
  for (const lv of levels) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 500 ? 2 : 1, isMobile: w < 500, hasTouch: w < 500 });
    const page = await ctx.newPage();
    const errs = [], ext = [];
    page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
    page.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
    page.on('request', r => { const u = r.url(); if (!u.startsWith(`http://127.0.0.1:${port}`) && !u.startsWith('data:') && !u.startsWith('blob:')) ext.push(u); });
    const t0 = Date.now();
    await page.goto(`http://127.0.0.1:${port}/web/${PAGE}?lv=${lv}&auto=1&speed=4`, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${shots}/L${lv}-${w}-a.png` });
    let state = null;
    for (let i = 0; i < 240; i++) {
      state = await page.evaluate(() => { const r = window.__levelResult; return r ? { over: r.over, round: r.round, lv: r.lv, lost: window.__autoLost || 0 } : null; });
      if (state && state.over) break;
      if (i === 6) await page.screenshot({ path: `${shots}/L${lv}-${w}-b.png` });
      await page.waitForTimeout(1000);
    }
    const meta = await page.evaluate(() => !!document.querySelector('meta[name=viewport]'));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1);
    await page.screenshot({ path: `${shots}/L${lv}-${w}-c.png` });
    const ok = !errs.length && !ext.length && meta && !overflow && state && state.over;
    if (!ok) fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'} L${lv} ${w}×${h} ${state ? `over=${state.over} round=${state.round} lost=${state.lost}` : 'no state'} ${((Date.now() - t0) / 1000).toFixed(0)}s${meta ? '' : ' NO-VIEWPORT'}${overflow ? ' H-OVERFLOW' : ''}`);
    for (const e of errs.slice(0, 6)) console.log('   ', e);
    for (const e of ext.slice(0, 4)) console.log('    external:', e);
    await ctx.close();
  }
}
await browser.close();
process.exit(fail ? 1 : 0);
