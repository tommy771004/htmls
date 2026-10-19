// 產生作品集縮圖 thumbs/260.jpg（640×400）：雨夜的 9 St，Kestrel 停在 LAZARUS 門口，排隊的人和濕地倒影
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = resolve(root, '../../web/260-neon-nightcity.html');
const thumbPath = resolve(root, '../../thumbs/260.jpg');
const png = thumbPath.replace(/\.jpg$/, '.png');
// 可用環境變數微調構圖：THUMB="車 x 偏移,車 z 偏移,車 yaw,相機 yaw,相機 pitch,遠近 0–2"
const [dx, dz, vyaw, cyaw, cpitch, far] = (process.env.THUMB || '10,8.9,1.57,-3.5,.05,0').split(',').map(Number);

const { browser, page } = await open(htmlPath, { w: 1280, h: 800 });
try {
  await page.evaluate(() => window.__nc.start());
  await page.waitForTimeout(800);
  await page.evaluate(([dx, dz, vyaw, cyaw, cpitch, far]) => {
    const nc = window.__nc, d = nc.spots.clubDoor;
    for (const id of ['hud', 'touch', 'toast', 'prompt', 'marker']) { const el = document.getElementById(id); if (el) el.style.visibility = 'hidden'; }
    nc.drive();
    const v = nc.player.veh;
    v.x = d.x + dx; v.z = d.z + dz; v.yaw = vyaw; v.vx = v.vz = 0;
    nc.rain(.85);
    nc.look(v.yaw + cyaw, cpitch, far);
  }, [dx, dz, vyaw, cyaw, cpitch, far]);
  await page.waitForTimeout(1500);
  // 開車時相機閒置一秒多會自動轉回車後，拍照前再擺一次
  await page.evaluate(([cyaw, cpitch, far]) => { const nc = window.__nc; nc.look(nc.player.veh.yaw + cyaw, cpitch, far); }, [cyaw, cpitch, far]);
  await raf(page);
  await page.screenshot({ path: png });
} finally {
  await browser.close();
}
execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '-z', '400', '640', png, '--out', thumbPath], { stdio: 'ignore' });
execFileSync('rm', [png]);
console.log(`縮圖：${thumbPath}`);
