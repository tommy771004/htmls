// 開發用截圖：node tools/shot.mjs [w] [h] [--touch]
import { mkdirSync } from 'node:fs';
import { open } from './lib.mjs';
const a = process.argv.slice(2), w = +(a[0] || 1440), h = +(a[1] || 900), touch = a.includes('--touch');
const out = 'dist/shots'; mkdirSync(out, { recursive: true });
const { browser, page, log } = await open('../../web/198-ki-lanes.html', { w, h, touch });
const raf = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
const shot = async (n) => { await raf(); await page.screenshot({ path: `${out}/${w}-${n}.png` }); };
await page.waitForTimeout(1500); await shot('1-select');
await page.evaluate(() => window.__ki.start('goku', 1));
await page.waitForTimeout(800); await shot('2-start');
await page.evaluate(() => window.__ki.fastForward(40));
await page.waitForTimeout(600); await shot('3-lane');
const st = await page.evaluate(() => window.__ki.state());
console.log(JSON.stringify(st).slice(0, 900));
console.log('gpu', log.gpu, 'errors', log.pageerrors, log.errors.slice(0, 5), 'external', log.external);
await browser.close();
