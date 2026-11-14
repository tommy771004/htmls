// 「不影響畫面」的修正驗證：幾個固定視角暫停（Esc 選單開著、藏起來），同一幀分別在 ON／OFF 下畫，逐像素比對，順便交錯量凍結的整幀時間。
//   ON='__nc.instCl.en = true' OFF='__nc.instCl.en = false' node tools/lossless.mjs
// 環境變數：CIV=1 有路人與車流（預設 0，畫面才固定）；ON／OFF 是在頁面裡執行的 JS（N 是 __nc），VIEWS 只跑哪幾個（逗號分隔），ROUNDS 凍結量幾輪（預設 6，0 不量），HTML 換建置，Q 加網址參數，
// STAT 是每個視角畫完後要回報的式子（例如 '__nc.instCl.n'）。差異 > 2/255 的像素數就是「影響畫面」，0 才算過；SHOTS=1 存 ON／OFF 截圖到 .cache/lossless/
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromePath, GPU_ARGS } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), repo = resolve(root, '../..');
const HTML = process.env.HTML || 'web/260-neon-nightcity.html', ON = process.env.ON, OFF = process.env.OFF, ROUNDS = +(process.env.ROUNDS ?? 6);
// EVAL＝JS 檔：每個視角暫停後在頁面裡跑（async 函式本體，N 是 __nc），印出回傳值；沒給 ON／OFF 時只跑這個（查某個視角的狀態）
const EVAL = process.env.EVAL ? readFileSync(resolve(process.env.EVAL), 'utf8') : null;
if ((!ON || !OFF) && !EVAL) { console.error('要給 ON 與 OFF（頁面裡的 JS），或 EVAL'); process.exit(2); }
const ONLY = process.env.VIEWS ? process.env.VIEWS.split(',') : null, OUT = resolve(root, '.cache/lossless');
// 視角：路口節點、鏡頭離玩家的水平距離與高度、看的高度、時間（分）、天氣、Esc 選單設定
const VIEWS = [
  { id: 'street', node: 260, r: 9, h: 2.2, ly: 1.2, t: 1320, wx: 'rain' },
  { id: 'mid', node: 40, r: 26, h: 10, ly: 1.2, t: 1320, wx: 'rain' },
  { id: 'high', node: 120, r: 160, h: 140, ly: 0, t: 1320, wx: 'rain' },
  { id: 'day', node: 333, r: 10, h: 2, ly: 1.2, t: 780, wx: 'clear' },
  { id: 'planar', node: 500, r: 8, h: 2, ly: 1, t: 1290, wx: 'rain', set: { ssr: 0 } },   // 平面倒影那一趟也要對
  { id: 'up', node: 777, r: 6, h: 1.4, ly: 30, t: 1320, wx: 'clear' },   // 仰頭看樓頂與天空
];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json', '.mp3': 'audio/mpeg', '.png': 'image/png', '.jpg': 'image/jpeg' };
const srv = createServer((q, s) => {
  const f = resolve(repo, '.' + decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(repo + sep) || !existsSync(f) || !statSync(f).isFile()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, executablePath: chromePath(), args: GPU_ARGS });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage(), dp = await ctx.newPage();
const errs = []; page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); }); page.on('pageerror', e => errs.push(String(e.message)));
await page.goto(`http://127.0.0.1:${srv.address().port}/${HTML}?perf=1&gpu=high&story=0&civ=${process.env.CIV ?? 0}${process.env.Q || ''}`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__nc && window.__nc.ready, null, { timeout: 300000, polling: 300 });
await page.evaluate(() => { const N = __nc; N.start(); N.menu.set('fps', 0); N.menu.set('pauseBlur', false); N.menu.set('grain', false); N.menu.set('eye', false); N.menu.set('taa', 0); });   // 時間抗鋸齒每幀偏移，同一幀畫兩次不會逐像素相同
const diff = (x, y) => dp.evaluate(async ({ x, y }) => {
  const ld = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
  const [A, B] = await Promise.all([ld(x), ld(y)]), c = new OffscreenCanvas(A.width, A.height), g = c.getContext('2d');
  g.drawImage(A, 0, 0); const da = g.getImageData(0, 0, A.width, A.height).data; g.drawImage(B, 0, 0); const db = g.getImageData(0, 0, A.width, A.height).data;
  let n = 0, mx = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (let i = 0; i < da.length; i += 4) { const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2])); if (d > 2) { n++; const p = i / 4, x = p % A.width, y = (p - x) / A.width; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } if (d > mx) mx = d; }
  return { px: n, max: mx, box: n ? [x0, y0, x1, y1] : null };
}, { x: 'data:image/png;base64,' + x.toString('base64'), y: 'data:image/png;base64,' + y.toString('base64') });
if (process.env.SHOTS) mkdirSync(OUT, { recursive: true });
let fail = 0;
for (const V of VIEWS) {
  if (ONLY && !ONLY.includes(V.id)) continue;
  await page.evaluate(async V => {
    const N = __nc; N.menu.close(); document.getElementById('menu').style.visibility = '';
    window.__llS = {}; for (const [k, v] of Object.entries(V.set || {})) { window.__llS[k] = N.menu.SET[k]; N.menu.set(k, v); }
    const nodes = N.roads.nodes.filter(n => n.out.length >= 3 && !n.out.some(o => o.e.kind === 'f')), nd = nodes[V.node % nodes.length];
    N.time(V.t); N.weather(V.wx); N.tp(nd.x, nd.z, .7);
    await new Promise(r => setTimeout(r, 6000));
    const P = { x: N.player.x, y: N.player.y || 0, z: N.player.z }, a = 2.3; let run = true;
    const cm = () => { if (!run) return; N.camAt(P.x + Math.sin(a) * V.r, P.y + V.h, P.z + Math.cos(a) * V.r, P.x, P.y + V.ly, P.z); requestAnimationFrame(cm); }; cm();
    // 串流、分幀載入都停了再暫停
    const t0 = performance.now(); while (performance.now() - t0 < 10000 && N.perf.busy()) await new Promise(r => setTimeout(r, 200));
    await new Promise(r => setTimeout(r, 2000));
    N.menu.open(); document.getElementById('menu').style.visibility = 'hidden'; run = false;
    const pe = document.getElementById('perf'); if (pe) pe.style.visibility = 'hidden';   // ?perf=1 的面板會更新數字
  }, V);
  if (EVAL) {
    // PROF=1：跑 EVAL 時錄 CPU，印自身時間前 25 名（ms，整段合計）
    const cdp = process.env.PROF ? await ctx.newCDPSession(page) : null;
    if (cdp) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start'); }
    console.log(V.id, JSON.stringify(await page.evaluate(src => (new Function('N', 'return (async () => {' + src + '\n})()'))(__nc), EVAL)));
    if (cdp) {
      const { profile } = await cdp.send('Profiler.stop'), byId = new Map(profile.nodes.map(n => [n.id, n])), us = new Map();
      profile.samples.forEach((id, k) => { const n = byId.get(id), key = `${n.callFrame.functionName || '(anon)'}:${n.callFrame.lineNumber}`; us.set(key, (us.get(key) || 0) + (profile.timeDeltas[k] || 0)); });
      console.log([...us].filter(([k]) => !/^\((idle|program|root|garbage)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `  ${(v / 1000).toFixed(1).padStart(7)} ${k}`).join('\n'));
      await cdp.detach();
    }
    if (!ON || !OFF) continue;
  }
  const shot = async js => { await page.evaluate(async js => { const N = __nc; (new Function('N', js))(N); for (let i = 0; i < 6; i++) { N.menu.st.redraw = true; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); } }, js); return page.screenshot(); };
  // 有些東西隔幀才更新（暫停時一張截圖前後畫的幀數奇偶不一定），所以照 OFF OFF ON ON OFF OFF 拍，只比同奇偶的：1↔3、2↔4 是 ON／OFF 的差，1↔5、2↔6 是雜訊
  const a = await shot(OFF), a1 = await shot(OFF), b = await shot(ON), b1 = await shot(ON), stat = process.env.STAT ? await page.evaluate(s => String((new Function('return ' + s))()), process.env.STAT) : '', a2 = await shot(OFF), a3 = await shot(OFF);
  const worse = (x, y) => x.px >= y.px ? x : y;
  const d = worse(await diff(a, b), await diff(a1, b1)), noise = worse(await diff(a, a2), await diff(a1, a3));
  if (process.env.SHOTS) { writeFileSync(resolve(OUT, `${V.id}-off.png`), a); writeFileSync(resolve(OUT, `${V.id}-on.png`), b); }
  let t = '';
  if (ROUNDS > 0) {
    const fr = await page.evaluate(async ({ ON, OFF, ROUNDS }) => { const N = __nc, f = js => () => (new Function('N', js))(N); return N.perf.frozen(ROUNDS, [f(OFF), f(ON), f(OFF)]); }, { ON, OFF, ROUNDS });
    const off = (fr[0].gpu + fr[2].gpu) / 2;
    t = ` 整幀 OFF ${off.toFixed(1)} ON ${fr[1].gpu.toFixed(1)} ms（${(fr[1].gpu - off).toFixed(1)}，兩次 OFF 差 ${Math.abs(fr[0].gpu - fr[2].gpu).toFixed(1)}）送出 ${((fr[0].sub + fr[2].sub) / 2).toFixed(1)}→${fr[1].sub.toFixed(1)} draw ${fr[0].draws}→${fr[1].draws} 三角形 ${(fr[0].tris / 1e6).toFixed(2)}→${(fr[1].tris / 1e6).toFixed(2)} M`;
  }
  const ok = d.px <= noise.px * 1.3 + 5;   // 暫停時仍可能有少數像素在動（兩次 OFF 的差），不超過它就算一樣
  if (!ok) fail++;
  console.log(`${ok ? '✓' : '✗'} ${V.id} 差 ${d.px} px（最大 ${d.max}${d.box ? '，範圍 ' + d.box.join(',') : ''}）雜訊 ${noise.px} px${noise.box ? '（' + noise.box.join(',') + '）' : ''}${stat ? ' ' + stat : ''}${t}`);
  await page.evaluate(({ V, OFF }) => { const N = __nc; (new Function('N', OFF))(N); for (const [k, v] of Object.entries(window.__llS || {})) N.menu.set(k, v); }, { V, OFF });
}
console.log(`錯誤 ${errs.length}${errs.length ? '：' + errs.slice(0, 3).join(' | ') : ''}`);
await browser.close(); srv.close();
process.exit(fail || errs.length ? 1 : 0);
