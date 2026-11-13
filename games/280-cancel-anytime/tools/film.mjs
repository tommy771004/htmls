// 連拍：node tools/film.mjs <url> <輸出前綴> [張數=8] [間隔毫秒=350] [開始前等待=3000] [寬=1440] [高=900]
// 用來檢查演出鏡頭、轉場這類隨時間變化的畫面。會印出 console.error。
import { chromium } from 'playwright-core';
const [url, out, n = 8, gap = 350, pre = 3000, w = 1440, h = 900] = process.argv.slice(2);
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +w < 500 ? 2 : 1 });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(+pre);
for (let i = 0; i < +n; i++) { await page.screenshot({ path: `${out}-${i}.png` }); await page.waitForTimeout(+gap); }
await browser.close();
console.log(errs.length ? errs.join('\n') : 'no errors');
