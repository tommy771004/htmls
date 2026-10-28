// 繪圖後端對照：同幾個鏡頭位置在 ?gfx=webgl 與 ?gfx=webgpu 各截一張，印出錯誤、警告、還沒改寫的材質（__nc.gfx.miss()）與自動轉換失敗的（err()）
// node tools/gfx-view.mjs [輸出資料夾]；GFX="webgl,webgpu"（可加 webgpu-gl）；SPOT="地塊序,..."；HOUR=15；PRE="頁面裡的運算式"；每個鏡頭也印 3 秒的幀時間
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(root, '../..');
const out = resolve(process.argv[2] || resolve(root, '.cache/gfx-view'));
mkdirSync(out, { recursive: true });
const srv = createServer((q, s) => {
  const f = resolve(repo, '.' + decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(repo + sep) || !existsSync(f) || !statSync(f).isFile()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); s.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const spots = (process.env.SPOT || '210,480,1020').split(',').map(Number), hour = +(process.env.HOUR || 15);
for (const gfx of (process.env.GFX || 'webgl,webgpu').split(',')) {
  const { browser, page, log } = await open(`http://127.0.0.1:${srv.address().port}/web/260-neon-nightcity.html?gfx=${gfx}`, { w: 1280, h: 800 });
  try {
    await page.evaluate(() => { try { localStorage.removeItem('nc260.motors'); } catch (e) {} window.__nc.start(); window.__nc.menu.set('blur', 0); });
    await page.waitForTimeout(4000);
    if (process.env.PRE) console.log(gfx, 'PRE', JSON.stringify(await page.evaluate(process.env.PRE)));   // 截圖前先在頁面裡跑一段（實驗用）
    for (const i of spots) for (const [tag, up] of [['st', 0], ['up', 1]]) {
      await page.evaluate(([i, up, hour]) => {
        const nc = window.__nc, L = nc.city.lots[i];
        for (const id of ['hud', 'touch', 'toast', 'prompt', 'marker']) { const el = document.getElementById(id); if (el) el.style.visibility = 'hidden'; }
        nc.time(hour * 60); nc.weather('clear', true);
        const cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2, [nx, nz] = L.axis === 'z' ? [0, L.face] : [L.face, 0], [tx, tz] = [nz, -nx];
        const hw = (L.axis === 'z' ? L.z1 - L.z0 : L.x1 - L.x0) / 2, px = cx + nx * (hw + 2.5), pz = cz + nz * (hw + 2.5);
        nc.walk(); nc.tpL(px - tx * 30, pz - tz * 30);
        const e = up ? nc.W(px + nx * 25 + tx * 25, pz + nz * 25 + tz * 25) : nc.W(px, pz), t = up ? nc.W(cx, cz) : nc.W(px + tx * 20 + nx * 3, pz + tz * 20 + nz * 3);
        nc.camAt(e[0], up ? 28 : 1.7, e[1], t[0], up ? 6 : 1.2, t[1]);
      }, [i, up, hour]);
      await page.waitForTimeout(800); await raf(page);
      await page.waitForTimeout(1500); await raf(page);
      await page.screenshot({ path: `${out}/${i}-${tag}-${gfx}.png` });
      // 幀時間：連續 3 秒的 requestAnimationFrame 間隔（無頭 Chrome 不鎖 60 Hz 時才有比較意義，取中位數與 90 百分位）
      const ft = await page.evaluate(() => new Promise(r => { const d = []; let t0 = performance.now(); const f = t => { d.push(t - t0); t0 = t; if (d.length < 400 && d.reduce((a, b) => a + b, 0) < 3000) requestAnimationFrame(f); else { d.sort((a, b) => a - b); r([d[d.length >> 1], d[Math.floor(d.length * .9)], d.length].map(x => +x.toFixed(2))); } }; requestAnimationFrame(f); }));
      console.log(`  ${i}-${tag} frame ms p50/p90/n`, ft.join(' / '));
    }
    const g = await page.evaluate(() => { const g = window.__nc.gfx; return { name: g.name, ported: g.ported(), auto: g.auto && g.auto(), miss: g.miss(), err: g.err ? g.err() : [] }; });
    console.log(gfx, JSON.stringify({ name: g.name, ported: g.ported, auto: g.auto, miss: g.miss.length, err: g.err.length, gpu: log.gpu }));
    for (const s of g.miss) console.log('  miss', s.slice(0, 160));
    for (const s of g.err) console.log('  err ', s.slice(0, 200));
    for (const s of [...log.pageerrors, ...log.errors].slice(0, 12)) console.log('  ERROR', s.slice(0, 300));
    for (const s of log.warns.slice(0, 8)) console.log('  warn', s.slice(0, 200));
  } finally { await browser.close(); }
}
srv.close();
