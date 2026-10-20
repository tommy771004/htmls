// 縮圖：下午的蜿蜒中游，小船在外彎釣點下錨、漁夫正在收線，淺灘看得到焦散、蘆葦與魚群。
// 1280×800 截圖後縮成 ../../thumbs/269.jpg（640×400）。node tools/thumb.mjs [釣點 時鐘分鐘 鏡頭距離]
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { open, raf } from './lib.mjs';
mkdirSync('dist', { recursive: true });
const [spot = 3, clock = 980, dist = 21] = process.argv.slice(2).map(Number);
const { browser, page } = await open('../../web/269-stillwater.html', { w: 1280, h: 800 });
try {
  await page.waitForTimeout(900);
  await page.evaluate(([k, clock, dist]) => { const s = window.__st; s.start(); s.unlockAll(); s.hud(false); s.setTime(clock); s.toSpot(k, 3.5); s.zoom(dist); }, [spot, clock, dist]);
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__st.act('act', true));
  await page.evaluate(() => window.__st.act('act', false));
  await page.evaluate(() => window.__st.timeScale(3));
  await page.waitForFunction(() => window.__st.state().phase === 'bite', null, { timeout: 40000 });
  await page.evaluate(() => { window.__st.timeScale(1); window.__st.act('act', true); });
  // 收線到一半、魚在掙扎時拍
  await page.waitForFunction(() => { const s = window.__st.state(); if (s.tension > 70) window.__st.act('act', false); else window.__st.act('act', true); return s.phase === 'reel' && s.progress > 55; }, null, { timeout: 40000, polling: 50 });
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__st.timeScale(0.0001));
  await page.waitForTimeout(200); await raf(page);
  await page.screenshot({ path: 'dist/thumb-full.png' });
} finally { await browser.close(); }
execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '-z', '400', '640', 'dist/thumb-full.png', '--out', '../../thumbs/269.jpg'], { stdio: 'ignore' });
console.log('thumbs/269.jpg');
