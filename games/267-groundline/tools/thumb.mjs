// 縮圖：擷取停機坪航廈、5 座空橋、多架客機與穿梭中的地勤車輛，輸出 640×400 的 ../../thumbs/267.jpg
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = resolve(root, '../../web/267-groundline.html');
const distDir = resolve(root, 'dist');
const outThumb = resolve(root, '../../thumbs/267.jpg');
mkdirSync(distDir, { recursive: true });

const { browser, page } = await open(html, { w: 1280, h: 800 });
try {
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    // 推進少許時間讓地勤車沿黃線車道穿梭，並選擇 G3 中央登機門航班，拉近等角視角突顯弧形玻璃航廈、空橋與飛機
    window.__gl.step(1.2);
    window.__gl.selectFlight('SL-103');
    const sc = window.__gl.scene;
    sc.controls.target.set(2, 1.5, -5);
    sc.camera.position.set(24, 54, 72);
    sc.controls.update();
    sc.syncScene(performance.now());
  });
  await page.waitForTimeout(400);
  await raf(page);
  const fullPng = resolve(distDir, 'thumb-full.png');
  await page.screenshot({ path: fullPng });
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '84', '-z', '400', '640', fullPng, '--out', outThumb], { stdio: 'ignore' });
  console.log('thumbs/267.jpg');
} finally {
  await browser.close();
}
