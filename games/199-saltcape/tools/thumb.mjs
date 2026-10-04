// 縮圖：離線練習中，在老街上空開傘的第三人稱畫面 → thumbs/199.jpg（640×400）
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { open, raf, serve } from './lib.mjs';
mkdirSync('dist', { recursive: true });
const srv = await serve();
const { browser, page } = await open(srv.url, { w: 1280, h: 800 });
await page.evaluate(() => window.__sc.solo('縮圖'));
await page.waitForFunction(() => window.__sc.G.match && window.__sc.match(), null, { timeout: 15000 });
await page.evaluate(() => { window.__sc.place(-105, 112, 2, 95); window.__sc.look(-0.86, -0.38); });
await page.waitForTimeout(1500);
await page.evaluate(() => { for (const id of ['hud', 'touch', 'banner']) document.getElementById(id)?.classList.add('hidden'); });
await page.waitForTimeout(400); await raf(page);
await page.screenshot({ path: 'dist/thumb.png' });
await browser.close(); await srv.close();
execSync('sips -s format jpeg -s formatOptions 82 -z 400 640 dist/thumb.png --out ../../thumbs/199.jpg');
console.log('ok');
