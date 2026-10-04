// 縮圖：擺好一個空中射門的瞬間（球鎖定鏡頭、加速火焰），1280×800 截圖後縮成 thumbs/200.jpg（640×400）
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { open, raf } from './lib.mjs';
mkdirSync('dist', { recursive: true });
const { browser, page } = await open('../../web/200-carball.html', { w: 1280, h: 800 });
try {
  await page.waitForTimeout(800);
  await page.evaluate(() => { const c = window.__cb; c.start('match', 'pro'); });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const c = window.__cb; c.play(); c.freezeAI(); c.cam('ball');
    c.place('ai', 4, 0.2, 43, 0, 0, 0, Math.PI + 0.3);
    c.place('car', -3.2, 1.4, 21, 1.2, 4.2, 15, 0.2);
    c.place('ball', -0.5, 4.2, 28.5, 0.6, 2.2, 13);
    c.sim.cars[0].state.boost = 64;
    document.getElementById('lockHint').classList.add('hidden');
    c.game.bannerT = 0; c.game.lastCount = 0; document.getElementById('banner').classList.add('hidden');
  });
  await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(260);
  await page.evaluate(() => { window.__cb.timeScale(0.0001); document.getElementById('banner').classList.add('hidden'); });
  await page.waitForTimeout(200); await raf(page);
  await page.screenshot({ path: 'dist/thumb-full.png' });
  await page.keyboard.up('ShiftLeft');
} finally { await browser.close(); }
execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '-z', '400', '640', 'dist/thumb-full.png', '--out', '../../thumbs/200.jpg'], { stdio: 'ignore' });
console.log('thumbs/200.jpg');
