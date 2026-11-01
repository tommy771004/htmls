// 倒影螢幕大小剔除的前後對照：同一幀（Esc 選單暫停、選單藏起來、只重畫）分別用 reflCull.px = 0 與 PXS 截圖，算像素差與差異熱圖。
//   OUTDIR=... PXS=2,3 HTML=web/260-neon-nightcity.html node tools/reflshots.mjs
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromePath, GPU_ARGS } from './lib.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), repo = resolve(root, '../..');
const OUT = process.env.OUTDIR || resolve(root, '.cache/reflshots'); mkdirSync(OUT, { recursive: true });
const PXS = (process.env.PXS || '2,3').split(',').map(Number);
const srv = createServer((q, s) => { const f = resolve(repo, '.' + decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(repo + sep) || !existsSync(f) || !statSync(f).isFile()) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': extname(f) === '.html' ? 'text/html; charset=utf-8' : 'application/octet-stream' }); s.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, executablePath: chromePath(), args: GPU_ARGS });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('pageerror', e.message, (e.stack || '').split('\n').slice(0, 6).join(' | ')));
await page.goto(`http://127.0.0.1:${srv.address().port}/${process.env.HTML || 'web/260-neon-nightcity.html'}?gpu=high&civ=0&story=0`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__nc && window.__nc.ready, null, { timeout: 300000, polling: 300 });
await page.evaluate(() => { __nc.start(); __nc.menu.set('pauseBlur', false); });
await page.waitForTimeout(4000);
const diffPage = await ctx.newPage();
async function diff(a, b, name) {
  return diffPage.evaluate(async ({ a, b }) => {
    const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
    const [A, B] = await Promise.all([load(a), load(b)]);
    const w = A.width, h = A.height, c = new OffscreenCanvas(w, h), x = c.getContext('2d');
    x.drawImage(A, 0, 0); const da = x.getImageData(0, 0, w, h).data; x.drawImage(B, 0, 0); const db = x.getImageData(0, 0, w, h).data;
    const out = x.createImageData(w, h); let n2 = 0, n8 = 0, n24 = 0, sum = 0, mx = 0;
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
      sum += d; if (d > mx) mx = d; if (d > 2) n2++; if (d > 8) n8++; if (d > 24) n24++;
      const v = Math.min(255, d * 8); out.data[i] = v; out.data[i + 1] = v * .35; out.data[i + 2] = 0; out.data[i + 3] = 255;
      if (d <= 2) { const g = (da[i] + da[i + 1] + da[i + 2]) / 12; out.data[i] = out.data[i + 1] = out.data[i + 2] = g; }
    }
    x.putImageData(out, 0, 0);
    const blob = await c.convertToBlob({ type: 'image/png' }), buf = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode(...buf.subarray(i, i + 32768));
    const N = w * h;
    return { mean: +(sum / N).toFixed(3), max: mx, pct2: +(n2 / N * 100).toFixed(3), pct8: +(n8 / N * 100).toFixed(3), pct24: +(n24 / N * 100).toFixed(3), png: btoa(s) };
  }, { a: 'data:image/png;base64,' + a.toString('base64'), b: 'data:image/png;base64,' + b.toString('base64') });
}
const SHOTS = [];
// 戰場：battle.mjs 的路網節點挑法，取幾個；兩個視角：觀戰（高 10 m 繞場）與街上平視（1.7 m，看著濕路面）
const locs = await page.evaluate(() => { const nodes = __nc.roads.nodes.filter(nd => nd.out.length >= 3 && !nd.out.some(o => o.e.kind === 'f')); return [40, 260, 777].map(i => { const n = nodes[i % nodes.length]; return { x: n.x, z: n.z, a: (i * .37) % 6.28 }; }); });
for (const [li, L] of locs.entries()) {
  await page.evaluate(async L => {
    const N = __nc, G = N.gta; N.menu.close(); G.squad.clear(); G.wanted.clear('reset'); G.god.on = true; N.time(1320); N.weather('rain');
    const fx = Math.sin(L.a), fz = Math.cos(L.a); N.tp(L.x - fx * 16, L.z - fz * 16, L.a); N.camAt();
    await new Promise(r => setTimeout(r, 7000));
    for (let j = 0; j < 7; j++) G.squad.spawn('gang', L.x + fx * 20 + fz * (j - 3) * 2.6, L.z + fz * 20 - fx * (j - 3) * 2.6, 'smg');
    for (let j = 0; j < 6; j++) G.squad.spawn('merc', L.x - fx * 8 + fz * (j - 2.5) * 2.4, L.z - fz * 8 - fx * (j - 2.5) * 2.4, 'rifle');
    G.wanted.set(3);
    await new Promise(r => setTimeout(r, 4000));
  }, L);
  const views = await page.evaluate(L => { const fx = Math.sin(L.a), fz = Math.cos(L.a), y0 = __nc.player.y || 0, cx = L.x + fx * 6, cz = L.z + fz * 6;
    return { spect: [cx + Math.sin(L.a + 2.3) * 26, y0 + 10, cz + Math.cos(L.a + 2.3) * 26, cx, y0 + 1.2, cz], street: [L.x - fx * 30, y0 + 1.7, L.z - fz * 30, L.x + fx * 30, y0 + .6, L.z + fz * 30] }; }, L);
  for (const [vn, v] of Object.entries(views)) {
    // 相機要在暫停前擺好（暫停時 loop 不跑相機），grain 關掉（每次重畫顆粒都不一樣）
    await page.evaluate(async v => { const N = __nc; N.menu.close(); N.menu.set('grain', false); N.menu.set('eye', false); N.camAt(...v); await new Promise(r => setTimeout(r, 600)); N.menu.open(); document.getElementById('menu').style.visibility = 'hidden'; }, v);
    const shot = async px => {
      const n = await page.evaluate(async ({ px }) => { const N = __nc; N.reflCull.px = px;
        for (let k = 0; k < 4; k++) { N.menu.st.redraw = true; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }
        return N.renderer.info.render.drawCalls; }, { px });
      return { n, png: await page.screenshot({ type: 'png' }) };
    };
    const base = await shot(0), name = `L${li}-${vn}`;
    writeFileSync(`${OUT}/${name}-before.png`, base.png);
    // 同一幀重畫兩次的差（雜訊底線：雨、閃爍等依時間的東西在暫停時也不動，應該是 0）
    const again = await shot(0), noise = await diff(base.png, again.png);
    for (const px of PXS) {
      const s = await shot(px), d = await diff(base.png, s.png);
      writeFileSync(`${OUT}/${name}-after-px${px}.png`, s.png);
      writeFileSync(`${OUT}/${name}-diff-px${px}.png`, Buffer.from(d.png, 'base64'));
      SHOTS.push({ name, px, draws: `${base.n} → ${s.n}`, noise: { mean: noise.mean, pct2: noise.pct2 }, mean: d.mean, max: d.max, pct2: d.pct2, pct8: d.pct8, pct24: d.pct24 });
      console.log(JSON.stringify(SHOTS.at(-1)));
    }
    await page.evaluate(() => { __nc.reflCull.px = 0; document.getElementById('menu').style.visibility = ''; __nc.menu.close(); });
  }
  await page.evaluate(() => __nc.camAt());
}
writeFileSync(`${OUT}/summary.json`, JSON.stringify(SHOTS, null, 1));
await browser.close(); srv.close();
