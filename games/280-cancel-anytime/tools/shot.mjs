// 截圖工具：node tools/shot.mjs <url> <out.png> [寬=1440] [高=900] [等待毫秒=2500] [截圖前在頁面執行的 JS]
// 會印出頁面的 console.error 與未捕捉例外。需先在 repo 根目錄起 HTTP 伺服器（python3 -m http.server <port>）。
// 寬度小於 500 時當成手機（觸控、DPR 2）。
import { chromium } from 'playwright-core';
const [url, out, w = 1440, h = 900, wait = 2500, js = ''] = process.argv.slice(2);
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const mob = +w < 500;
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(+wait);
if (js) { const r = await page.evaluate(js); if (r !== undefined) console.log('eval →', JSON.stringify(r)); await page.waitForTimeout(500); }
await page.screenshot({ path: out });
await browser.close();
console.log(errs.length ? errs.join('\n') : 'no errors');
