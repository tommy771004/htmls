// 縮圖：漁夫站在棧橋盡頭、浮標漂在水上、魚游近麵包，水下看得到珊瑚、魚群與焦散。
// 1280×800 截圖後縮成 ../../thumbs/201.jpg（640×400）。node tools/thumb.mjs [x z yaw power]
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { open, raf } from './lib.mjs';
mkdirSync('dist', { recursive: true });
const [x = 0.9, z = -11.3, yaw = Math.PI * 1.08, power = 0.32] = process.argv.slice(2).map(Number);
const { browser, page } = await open('../../web/201-coral-cove.html', { w: 1280, h: 800 });
try {
  await page.waitForTimeout(900);
  await page.evaluate(([x, z, yaw, power]) => { const c = window.__cc; c.start(); c.hud(false); c.place(x, z, yaw); c.cast(power); }, [x, z, yaw, power]);
  await page.waitForFunction(() => window.__cc.state().phase === 'wait');
  // 等一條魚游到餌旁邊
  await page.evaluate(() => window.__cc.timeScale(2.5));
  await page.waitForFunction(() => { const s = window.__cc.state(); const f = s.fish.find((q) => q.state === 'interest'); return f && Math.hypot(f.x - s.bob.x, f.z - s.bob.z) < 1.3; }, null, { timeout: 30000 }).catch(() => {});
  await page.evaluate(() => { window.__cc.timeScale(1); window.__cc.cam('hero'); });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__cc.timeScale(0.0001));
  await page.waitForTimeout(200); await raf(page);
  await page.screenshot({ path: 'dist/thumb-full.png' });
} finally { await browser.close(); }
execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '-z', '400', '640', 'dist/thumb-full.png', '--out', '../../thumbs/201.jpg'], { stdio: 'ignore' });
console.log('thumbs/201.jpg');
