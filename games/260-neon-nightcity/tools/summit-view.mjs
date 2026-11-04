// 峰頂觀景環（97-summit.js）的截圖與錯誤檢查：開頁 → __nc.summit.open() → 固定在幾個秒數各截一張，印出 console 錯誤、場景狀態與幀時間
// 最後走一次遊戲裡的流程：北嶺公園的纜車站 → 搭纜車上山（跳過）→ 場館 'summit' 在白天／黃昏／深夜／下雨各截一張、往前走 3 秒 → 搭纜車下山
// node tools/summit-view.mjs [輸出資料夾]；T="0,9,18,22,27,33,40"（秒）；SIZE="1440x900,390x844"；FPS=1 量 3 秒的幀時間
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(root, '../..');
const out = resolve(process.argv[2] || resolve(root, '.cache/summit-view'));
mkdirSync(out, { recursive: true });
const srv = createServer((q, s) => {
  const f = resolve(repo, '.' + decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(repo + sep) || !existsSync(f) || !statSync(f).isFile()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); s.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const times = (process.env.T || '0,9,18,22,27,33,40').split(',').map(Number);
let bad = 0;
for (const size of (process.env.SIZE || '1440x900,390x844').split(',')) {
  const [w, h] = size.split('x').map(Number), touch = w < 600;
  const { browser, page, log } = await open(`http://127.0.0.1:${srv.address().port}/web/260-neon-nightcity.html`, { w, h, touch });
  try {
    const t0 = Date.now();
    await page.click('#goSm');   // 開始畫面的按鈕（使用者手勢：聲音也一起開）
    await page.waitForFunction(() => window.__nc.summit.on && window.__nc.summit.frames > 3, null, { timeout: 120000 });
    console.log(size, '進場', ((Date.now() - t0) / 1000).toFixed(1), 's', JSON.stringify(await page.evaluate(() => window.__nc.summit.st())));
    // 運鏡路徑的淨空：每 0.05 秒取一點，離地形（高度場）與建築（環、平台、迴廊的外包體積）最近的距離
    console.log(size, '淨空', JSON.stringify(await page.evaluate(() => {
      const S = window.__nc.summit, D = S.dims; let mt = 1e9, mtT = 0, mb = 1e9, mbT = 0;
      for (let t = 0; t < 45; t += .05) {
        const [x, y, z] = S.path(t), c = y - S.H(x, z); if (c < mt) { mt = c; mtT = t; }
        const r = Math.hypot(x, z), th = Math.atan2(z, x), out = (v, a, b) => Math.max(a - v, v - b, 0);
        const ds = [Math.hypot(out(r, D.RI - 1.5, D.RO + 1.5), out(y, D.SOF - .5, D.RF + 1))];
        for (const P of [D.DECK, D.BALC]) { const da = Math.abs(((th - P.th + Math.PI * 3) % (Math.PI * 2)) - Math.PI); if (da < P.half + .03) ds.push(Math.hypot(out(r, D.RO, P.r1 + .5), out(y, P.bot - .3, P.top + 1.3))); }
        for (const [x0, x1] of [[D.xf - 6, -D.RO + 1], [D.RO - 1, D.ST.x - D.ST.hx]]) ds.push(Math.hypot(out(z, -2.8, 2.8), out(y, D.FL - 2, D.FL + 4.4), out(x, x0, x1)));
        const m = Math.min(...ds); if (m < mb) { mb = m; mbT = t; }
      }
      return { 地形: [+mt.toFixed(1), +mtT.toFixed(2)], 建築: [+mb.toFixed(1), +mbT.toFixed(2)], 迴廊西端: D.xf };
    })));
    if (process.env.FPS) {
      const ft = await page.evaluate(() => new Promise(r => { const a = []; let p = performance.now(); const f = n => { a.push(n - p); p = n; if (a.length < 180) requestAnimationFrame(f); else { a.sort((x, y) => x - y); r([a[90], a[162]].map(v => +v.toFixed(1))); } }; requestAnimationFrame(f); }));
      console.log(size, '幀時間 中位數／90%', ft.join(' / '), 'ms');
    }
    for (const t of times) {
      await page.evaluate(t => window.__nc.summit.seek(t), t);
      await page.waitForTimeout(500); await raf(page); await raf(page);
      await page.screenshot({ path: `${out}/${size}-${String(t).padStart(2, '0')}.png` });
    }
    console.log(size, JSON.stringify(await page.evaluate(() => window.__nc.summit.st())));
    // 一覽表：所有秒數縮小排成兩欄（看整段運鏡用）
    {
      const cols = w > h ? 2 : 4, cw = Math.round(1400 / cols), chh = Math.round(cw * h / w);
      const imgs = times.map(t => `<figure><img src="data:image/png;base64,${readFileSync(`${out}/${size}-${String(t).padStart(2, '0')}.png`).toString('base64')}"><figcaption>${t}s</figcaption></figure>`).join('');
      const p2 = await browser.newPage({ viewport: { width: cw * cols, height: 400 } });
      await p2.setContent(`<style>body{margin:0;background:#000;display:grid;grid-template-columns:repeat(${cols},${cw}px)}figure{margin:0;position:relative}img{width:${cw}px;height:${chh}px;display:block}figcaption{position:absolute;left:6px;top:4px;color:#fff;font:12px sans-serif}</style>${imgs}`);
      await p2.screenshot({ path: `${out}/${size}-sheet.png`, fullPage: true }); await p2.close();
    }
    await page.evaluate(() => window.__nc.summit.close());
    await page.waitForTimeout(900);
    const st = await page.evaluate(() => ({ on: window.__nc.summit.on, start: getComputedStyle(document.getElementById('start')).display }));
    console.log(size, '離開後', JSON.stringify(st));
    // 遊戲中從暫停選單進出：城市照常繼續（uTime 有在走、選單關著）
    await page.evaluate(() => window.__nc.start()); await page.waitForTimeout(1500);
    await page.evaluate(() => { window.__nc.menu.open('game'); }); await page.waitForTimeout(300);
    await page.evaluate(() => window.__nc.summit.open());
    await page.waitForFunction(() => window.__nc.summit.on && window.__nc.summit.frames > 400, null, { timeout: 60000 });
    const inG = await page.evaluate(() => ({ menu: window.__nc.menu.st.on, hud: getComputedStyle(document.getElementById('hud')).visibility, st: window.__nc.summit.st() }));
    await page.evaluate(() => window.__nc.summit.close()); await page.waitForTimeout(900);
    const t1 = await page.evaluate(() => window.__nc.menu.t()); await page.waitForTimeout(600); const t2 = await page.evaluate(() => window.__nc.menu.t());
    // 纜車上山的場館
    {
      const o = await page.evaluate(() => { const N = window.__nc, C = N.summit.cs; if (!C.on) return null; N.tp(C.out.x, C.out.z, C.out.yaw + Math.PI); return C.out; });
      if (!o) { bad++; console.log(size, '沒有城裡的纜車站（NPARK）'); }
      else {
        await page.waitForTimeout(800); const ctx = await page.evaluate(() => document.body.innerText.includes('搭纜車上山'));
        await page.evaluate(() => window.__nc.summit.ride());
        await page.waitForFunction(() => window.__nc.summit.on && window.__nc.summit.frames > 20, null, { timeout: 60000 });
        await page.evaluate(() => window.__nc.summit.close()); await page.waitForTimeout(1500);
        const a = await page.evaluate(() => window.__nc.summit.st());
        if (a.where !== 'summit' || a.on) bad++;
        const sky = {};
        for (const [n, m, wx] of [['day', 780, 'clear'], ['dusk', 1100, 'clear'], ['night', 120, 'clear'], ['rain', 780, 'rain']]) {
          await page.evaluate(([m, wx]) => { window.__nc.time(m); window.__nc.weather(wx); }, [m, wx]); await page.waitForTimeout(700); await raf(page); await raf(page);
          sky[n] = (await page.evaluate(() => window.__nc.summit.st().sky)).exp; await page.screenshot({ path: `${out}/${size}-venue-${n}.png` });
        }
        await page.evaluate(() => window.__nc.weather('clear'));
        await page.keyboard.down('KeyW'); await page.waitForTimeout(3000); await page.keyboard.up('KeyW');
        const wk = await page.evaluate(() => { const p = window.__nc.player; return window.__nc.summit.inWalk(p.x, p.z); });
        await page.evaluate(() => window.__nc.summit.down()); await page.waitForTimeout(1200);
        const b = await page.evaluate(() => window.__nc.summit.st());
        if (!ctx || !wk || b.where !== 'out' || b.audio) bad++;
        console.log(size, '纜車', JSON.stringify({ 站前提示: ctx, 到站: a.where, 曝光: sky, 走完仍在範圍內: wk, 下山後: b.where, 山上聲音關掉: !b.audio }));
      }
    }
    console.log(size, '遊戲中進出', JSON.stringify({ 進場時選單: inG.menu, HUD: inG.hud, 聲音: inG.st.audio, 來源數: inG.st.srcs, 離開後城市時間在走: t2 > t1 }));
  } finally {
    const errs = [...log.pageerrors, ...log.errors];
    if (errs.length) { bad++; console.log(size, '錯誤', errs.slice(0, 12)); }
    if (log.external.length) { bad++; console.log(size, '外部請求', log.external.slice(0, 5)); }
    await browser.close();
  }
}
srv.close();
console.log(bad ? '有問題' : '沒有錯誤', out);
process.exit(bad ? 1 : 0);
