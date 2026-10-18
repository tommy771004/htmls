// 產生作品集縮圖 thumbs/261.jpg（640×400）：正午的海灘、碼頭與出航的船
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, '../../thumbs/261.jpg');
const tmp = resolve(root, 'tools/.thumb.png');
const { browser, page } = await open(resolve(root, '../../web/261-bayfront-empire.html'), { w: 1280, h: 800, query: '?auto=legacy' });
try {
  await page.evaluate(() => {
    __bf.ui.closeModal();
    __bf.buyAll(3);
    __bf.setTime(11.2);
    __bf.setWeather('sunny');
    __bf.fast(40, 1);
    __bf.setWeather('sunny');
    __bf.look(-6, 30, 92);
    document.getElementById('toasts').style.display = 'none';
    document.querySelector('.questbar').style.display = 'none';
  });
  await page.waitForTimeout(1200);
  await raf(page);
  await page.screenshot({ path: tmp });
  try {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-vf', 'scale=640:400', '-q:v', '3', out]);
  } catch {
    // 沒有 ffmpeg 時用 macOS 內建的 sips
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80', '-z', '400', '640', tmp, '--out', out], { stdio: 'ignore' });
  }
  console.log('已輸出', out);
} finally {
  await browser.close();
}
