// 截圖工具：node tools/shot.mjs <url> <out.png> [寬=1440] [高=900] [等待毫秒=2500]
// 會印出頁面的 console.error 與未捕捉例外。需先在 repo 根目錄起 HTTP 伺服器（python3 -m http.server <port>）。
import { chromium } from 'playwright-core';
const [url, out, w = 1440, h = 900, wait = 2500] = process.argv.slice(2);
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(+wait);
await page.screenshot({ path: out });
await browser.close();
console.log(errs.length ? errs.join('\n') : 'no errors');
