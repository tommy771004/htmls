// 海上鑽油平台（21-rig.js）的截圖與錯誤檢查：開頁 → 開始遊戲 → 傳送到平台旁的海上 → 幾個固定機位（平台局部座標）各截一張，印出 console 錯誤與 __nc.rig.st()
// node tools/rig-view.mjs [輸出資料夾]；SIZE="1440x900,390x844"；ONLY="far,deck" 只拍這幾個機位；T=分鐘 覆寫所有機位的時間；FPS=1 量 3 秒的幀時間
// 海獸（21-rigbeast.js）：開場先 hold 住不讓牠自己出來；有 K 時先等模型下載好；K="10,22,40,66" 跳到那幾秒，從平台甲板與海面兩個機位各拍一張（beast-秒-deck／sea），BCAMS="名字:dx:dz:高,…" 再多幾個機位（海獸位置往平台局部 x、z 偏移），KT=分鐘 是拍海獸時的時間
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(root, '../..');
const out = resolve(process.argv[2] || resolve(root, '.cache/rig-view'));
mkdirSync(out, { recursive: true });
// 機位：眼睛（局部 x, 世界 y, 局部 z）→ 看的點（局部 x, 世界 y, 局部 z）、時間（分鐘）
const VIEWS = {
  far: [[-260, 30, 210], [0, 30, 0], 1380],
  low: [[-95, 2.5, 75], [-10, 22, 0], 1380],
  tug: [[-80, 9, 70], [-58, 1, 46], 1380],
  deck: [[-55, 52, -40], [8, 28, 4], 1380],
  flare: [[10, 40, 40], [50, 55, -37], 1380],
  dusk: [[-230, 45, -160], [0, 25, 0], 1110],
  day: [[-200, 25, 180], [0, 25, 0], 720],
  legDay: [[-40, 4, 42], [-16, 4, 14], 660],
  deckDay: [[-30, 34, -32], [6, 23, 2], 780],
  sideDay: [[60, 20, 60], [8, 16, 4], 900],
};
const only = process.env.ONLY && process.env.ONLY.split(',');
const srv = createServer((q, s) => {
  const f = resolve(repo, '.' + decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(repo + sep) || !existsSync(f) || !statSync(f).isFile()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); s.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
let bad = 0;
for (const size of (process.env.SIZE || '1440x900,390x844').split(',')) {
  const [w, h] = size.split('x').map(Number), touch = w < 600;
  const { browser, page, log } = await open(`http://127.0.0.1:${srv.address().port}/web/260-neon-nightcity.html`, { w, h, touch });
  try {
    await page.evaluate(() => { try { localStorage.removeItem('nc260.motors'); } catch (e) {} window.__nc.start(); window.__nc.menu.set('blur', 0); });
    await page.waitForTimeout(3000);
    await page.evaluate(() => { const nc = window.__nc, [x, z] = nc.rig.W(-90, -70); nc.rig.beast.hold(); nc.tp(x, z); for (const id of ['hud', 'touch', 'toast', 'prompt', 'marker']) { const el = document.getElementById(id); if (el) el.style.visibility = 'hidden'; } });
    for (const [name, [e, t, min]] of Object.entries(VIEWS)) {
      if (only && !only.includes(name)) continue;
      await page.evaluate(([e, t, min]) => {
        const nc = window.__nc, [ex, ez] = nc.rig.W(e[0], e[2]), [tx, tz] = nc.rig.W(t[0], t[2]);
        nc.time(min); nc.weather('clear', true); nc.camAt(ex, e[1], ez, tx, t[1], tz);
      }, [e, t, process.env.T ? +process.env.T : min]);
      await page.waitForTimeout(1500); await raf(page); await raf(page);
      await page.screenshot({ path: `${out}/${size}-${name}.png` });
    }
    console.log(size, JSON.stringify(await page.evaluate(() => window.__nc.rig.st())));
    const ks = (process.env.K || '').split(',').filter(Boolean).map(Number);
    if (ks.length) console.log(size, '海獸模型', await page.evaluate(() => window.__nc.rig.beast.load()), JSON.stringify(await page.evaluate(() => window.__nc.rig.beast.st())));
    for (const sec of ks) {
      const st = await page.evaluate(([sec, min]) => { const nc = window.__nc, B = nc.rig.beast; nc.time(min); nc.weather('clear', true); B.seek(sec); return B.st(); }, [sec, +(process.env.KT || 1380)]);
      console.log(size, 'beast', sec, JSON.stringify(st));
      for (const [nm, off, h] of [['deck', null, 26], ['sea', [55, 70], 4], ...(process.env.BCAMS || '').split(',').filter(Boolean).map(c => { const [n, dx, dz, hh] = c.split(':'); return [n, [+dx, +dz], +hh]; })]) {
        await page.evaluate(([nm, off, h]) => { const nc = window.__nc, B = nc.rig.beast.B, [tx, tz] = [B.x, B.z], [ex, ez] = off ? nc.rig.W(B.lx + off[0], B.lz + off[1]) : nc.rig.W(10, 30); nc.camAt(ex, h, ez, tx, Math.max(B.y + 40, -1), tz); }, [nm, off, h]);
        await page.waitForTimeout(700); await raf(page); await raf(page);
        await page.screenshot({ path: `${out}/${size}-beast-${sec}-${nm}.png` });
      }
    }
    if (process.env.FPS) {
      const ft = await page.evaluate(() => new Promise(r => { const a = []; let p = performance.now(); const f = n => { a.push(n - p); p = n; if (a.length < 180) requestAnimationFrame(f); else { a.sort((x, y) => x - y); r([a[90], a[162]].map(v => +v.toFixed(1))); } }; requestAnimationFrame(f); }));
      console.log(size, '幀時間 中位數／90%', ft.join(' / '), 'ms');
    }
    const g = await page.evaluate(() => { const g = window.__nc.gfx; return { miss: g.miss && g.miss(), err: g.err && g.err() }; });
    if ((g.miss && g.miss.length) || (g.err && g.err.length)) { console.log(size, 'gfx', JSON.stringify(g).slice(0, 600)); bad++; }
  } catch (e) { console.log(size, '失敗', e.message); bad++; }
  const errs = [...log.pageerrors, ...log.errors];
  console.log(size, 'GPU', log.gpu, '錯誤', errs.length, errs.slice(0, 8).join('\n  '));
  if (errs.length) bad++;
  await browser.close();
}
srv.close();
process.exit(bad ? 1 : 0);
