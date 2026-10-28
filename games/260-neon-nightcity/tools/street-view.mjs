// 街道設施截圖：站在人行道上沿街看（白天），檢查程式建模的物體
// node tools/street-view.mjs [輸出資料夾]；STREET="地塊序,..."
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(root, '../..');
const out = resolve(process.argv[2] || resolve(root, '.cache/street-view'));
mkdirSync(out, { recursive: true });
const srv = createServer((q, s) => {
  const f = resolve(repo, '.' + decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(repo + sep) || !existsSync(f) || !statSync(f).isFile()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); s.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const { browser, page, log } = await open(`http://127.0.0.1:${srv.address().port}/web/260-neon-nightcity.html`, { w: 1280, h: 800 });
try {
  await page.evaluate(() => { try { localStorage.removeItem('nc260.motors'); } catch (e) {} window.__nc.start(); window.__nc.menu.set('blur', 0); });
  await page.waitForTimeout(4000);
  const ids = (process.env.STREET || '30,210,480,760,1020,1400').split(',').map(Number);
  for (const i of ids) {
    for (const [tag, side] of [['a', 1], ['b', -1]]) {
      await page.evaluate(([i, side]) => {
        const nc = window.__nc, L = nc.city.lots[i];
        for (const id of ['hud', 'touch', 'toast', 'prompt', 'marker']) { const el = document.getElementById(id); if (el) el.style.visibility = 'hidden'; }
        nc.time(15 * 60); nc.weather('clear', true);
        const cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2, [nx, nz] = L.axis === 'z' ? [0, L.face] : [L.face, 0], [tx, tz] = [nz, -nx];
        const hw = (L.axis === 'z' ? L.z1 - L.z0 : L.x1 - L.x0) / 2;
        // 人行道中間（離牆 2.5 m）沿街看，稍微偏向馬路
        const px = cx + nx * (hw + 2.5), pz = cz + nz * (hw + 2.5);
        nc.walk(); nc.tpL(px - tx * side * 30, pz - tz * side * 30);
        const e = nc.W(px, pz), t = nc.W(px + tx * side * 20 + nx * 3, pz + tz * side * 20 + nz * 3);
        nc.camAt(e[0], 1.7, e[1], t[0], 1.2, t[1]);
      }, [i, side]);
      await page.waitForTimeout(600); await raf(page);
      await page.evaluate(() => window.__nc.fac && window.__nc.fac.sync && window.__nc.fac.sync());
      await page.waitForTimeout(1500); await raf(page);
      await page.screenshot({ path: `${out}/${i}-${tag}.png` });
    }
  }
  console.log('errors', log.errors.slice(0, 5), log.pageerrors.slice(0, 5));
} finally { await browser.close(); srv.close(); }
