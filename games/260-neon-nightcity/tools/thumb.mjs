// 產生作品集縮圖 thumbs/260.jpg（640×400）：雨夜的 9 St，座駕（AE86 實車模型）停在 LAZARUS 門口，排隊的人和濕地倒影
// 以本機 HTTP 開頁，實車模型才會下載（以檔案開啟只有程式建模的替身）
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(root, '../..');
const thumbPath = resolve(root, '../../thumbs/260.jpg');
const png = thumbPath.replace(/\.jpg$/, '.png');
// 可用環境變數微調構圖：THUMB="車 x 偏移,車 z 偏移,車 yaw,相機 yaw,相機 pitch,遠近 0–2"
const [dx, dz, vyaw, cyaw, cpitch, far] = (process.env.THUMB || '10,8.9,1.57,-3.5,.05,0').split(',').map(Number);

const srv = createServer((q, s) => {
  const f = resolve(repo, '.' + decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(repo + sep) || !existsSync(f) || !statSync(f).isFile()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); s.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const { browser, page } = await open(`http://127.0.0.1:${srv.address().port}/web/260-neon-nightcity.html`, { w: 1280, h: 800 });
try {
  await page.evaluate(() => { try { localStorage.removeItem('nc260.motors'); } catch (e) {} window.__nc.start(); });
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
  await browser.close(); srv.close();
}
execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '-z', '400', '640', png, '--out', thumbPath], { stdio: 'ignore' });
execFileSync('rm', [png]);
console.log(`縮圖：${thumbPath}`);
