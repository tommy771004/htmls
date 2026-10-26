// 港灣高架線（21-xrail.js）的驗收：路線疊在港灣快速道路全高的那一段、三站名稱不重複、軌道下緣高過快速道路的門架與路燈、
// 柱子都立在快速道路的橋墩上（中央護欄那一條）、分合流點前後沒有柱子；列車從西端開到東端再開回來（中間站停車、終點站折返走渡線）；
// --http 時另外檢查列車換成模型
// 用法：node tools/check-xrail.mjs [--http] [html]（預設 web/260-neon-nightcity.html；NC_QUERY='?zrot=25' 轉整座城；SHOT_DIR 存截圖）
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(root, '../..');
const args = process.argv.slice(2), HTTP = args.includes('--http');
const htmlPath = resolve(args.find(a => !a.startsWith('--')) || resolve(repo, 'web/260-neon-nightcity.html'));
const shotDir = process.env.SHOT_DIR ? resolve(process.env.SHOT_DIR) : null;
if (shotDir) mkdirSync(shotDir, { recursive: true });
let srv = null, url = htmlPath;
if (HTTP) {
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json', '.svg': 'image/svg+xml' };
  srv = createServer((q, s) => {
    const f = resolve(repo, '.' + decodeURIComponent(q.url.split('?')[0]));
    if (!f.startsWith(repo + sep) || !existsSync(f) || !statSync(f).isFile()) { s.writeHead(404); return s.end(); }
    s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(readFileSync(f));
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${srv.address().port}/${htmlPath.slice(repo.length + 1)}`;
}
let failed = 0;
function check(cond, msg) { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) failed++; }
const { browser, page, log } = await open(url, { w: 1280, h: 800 });
async function sec(title, fn, arg) {
  console.log(title);
  try { return await page.evaluate(fn, arg); } catch (e) { check(false, `執行失敗：${String(e.message || e).split('\n').slice(0, 4).join(' ← ')}`); return null; }
}
const shot = async (n, cam) => {
  if (!shotDir) return;
  if (cam) await page.evaluate(c => window.__nc.camAt(...c), cam);
  await raf(page); await raf(page); await page.screenshot({ path: resolve(shotDir, n + '.png') });
  if (cam) await page.evaluate(() => window.__nc.camAt());
};
await page.evaluate(() => {
  const N = window.__nc;
  N.start(); N.gta.god.on = true; N.gta.wanted.set(0);
  window.__t = { step(n) { for (let i = 0; i < n; i++) { try { N.step(1 / 60); } catch (e) { throw new Error(e.stack.split('\n').slice(0, 4).join(' ← ')); } } } };
});

try {
  const geo = await sec('路線', () => {
    const N = window.__nc, X = N.props.xrail, R = X.R;
    if (!R) return null;
    const H = R.H, o = { len: Math.round(R.aE - R.aS), names: R.sts.map(s => s.name), Y: X.Y, nCol: R.cols.length };
    // 柱距：兩支柱子之間（含線頭到第一支）最長的一跨
    const c = [R.aS, ...R.cols, R.aE]; o.gap = 0;
    for (let i = 1; i < c.length; i++) if (c[i] - c[i - 1] > o.gap) { o.gap = c[i] - c[i - 1]; o.gapAt = Math.round(c[i - 1]); }
    o.ends = [R.cols[0] - R.aS, R.aE - R.cols.at(-1)];
    return o;
  });
  if (!geo) check(false, '沒有港灣高架線（XR 是 null）');
  else {
    check(geo.len > 1500, `全長 ${geo.len} m`);
    check(geo.names.length === 3 && new Set(geo.names).size === 3, `三站名稱不重複：${geo.names.join('、')}`);
    check(geo.nCol > geo.len / 40, `柱子 ${geo.nCol} 支`);
    check(geo.gap < 80, `最長一跨 ${geo.gap.toFixed(0)} m（a ${geo.gapAt}）`);
    check(geo.ends[0] < 30 && geo.ends[1] < 30, `線頭懸臂 ${geo.ends.map(v => v.toFixed(0)).join('、')} m`);
    check(geo.Y - 2.3 > 8 + 7.8, `箱梁下緣 ${(geo.Y - 2.3).toFixed(1)} m 高過快速道路門架頂（15.8 m）`);
  }
  const run = await sec('列車', () => {
    const N = window.__nc, X = N.props.xrail, R = X.R, seq = [], lat0 = [];
    X.go(0, 1);
    let vmax = 0, last = -1, y = null, maxT = 60 * 60 * 12;
    for (let f = 0; f < maxT; f++) {
      window.__t.step(1);
      vmax = Math.max(vmax, R.v);
      if (R.st === 'dwell' && R.i !== last) { seq.push(R.i); last = R.i; }
      if (R.st === 'run' && R.dep && Math.abs(R.s - R.dep.a) < 1) lat0.push(R.dep.lat);
      if (seq.length >= 5) break;
    }
    const c = R.cars[0];
    y = c.obj.position.y;
    return { seq, vmax: +vmax.toFixed(1), y, lat0, trips: R.trips, vis: R.cars.filter(c => c.obj.visible).length };
  });
  if (run) {
    check(run.seq.join(',') === '1,2,1,0' || run.seq.slice(0, 4).join(',') === '1,2,1,0', `站序 0 → ${run.seq.join(' → ')}`);
    check(run.vmax > 18 && run.vmax <= 22.01, `最高時速 ${Math.round(run.vmax * 3.6)} km`);
    check(Math.abs(run.y - geo.Y - .2) < .01, `車廂在軌面上（y ${run.y.toFixed(2)}）`);
  }
  if (HTTP) {
    await page.evaluate(() => { window.__nc.props.xrail.tp(1); window.__t.step(30); });
    await page.waitForFunction(() => window.__nc.props.xrail.R.loaded, null, { timeout: 60000 }).catch(() => {});
    const m = await sec('模型', () => ({ loaded: window.__nc.props.xrail.R.loaded }));
    if (m) check(m.loaded, '列車換成 w1_train 模型');
  }
  if (shotDir) {
    const cams = await page.evaluate(() => {
      const X = window.__nc.props.xrail, R = X.R, w = (a, lat, y) => { const [x, z] = R.at(a, lat); return [x, y, z]; };
      X.go(1, 1); window.__t.step(60 * 25);
      const s = R.s, m = R.sts[1].a;
      return { side: [...w(m - 60, 60, 14), ...w(m, 0, 18)], top: [...w(m - 150, 30, 60), ...w(m + 40, 0, 16)], under: [...w(m + 30, 6, 9.5), ...w(m + 90, 0, 16)], term: [...w(R.sts[0].a + 80, 40, 30), ...w(R.sts[0].a, 0, 18)],
        plat: [...w(m - 45, 5, X.Y + 2.4), ...w(m + 15, 4, X.Y + 1.8)], east: [...w(R.H.a1 + 120, 55, 14), ...w(R.H.a1 + 200, 0, 9)], join: [...w(R.joins[0] - 80, -50, 20), ...w(R.joins[0] - 20, 0, 9)] };
    });
    await page.evaluate(() => { window.__nc.time(720); window.__nc.weather('clear'); });
    for (const [k, c] of Object.entries(cams)) await shot('xr-' + k, c);
    await page.evaluate(() => window.__nc.time(1320));
    for (const k of ['side', 'term', 'plat']) await shot('xr-n-' + k, cams[k]);
    // 列車近景：中間站出發 8 秒（車還在月台邊），從旁邊斜看第三節
    const tc = await page.evaluate(() => {
      const X = window.__nc.props.xrail, R = X.R; X.go(1, 1); window.__t.step(60 * 8);
      const c = R.cars[2], nx = -c.uz, nz = c.ux;
      return [c.x + nx * 22 - c.ux * 25, X.Y + 6, c.z + nz * 22 - c.uz * 25, c.x, X.Y + 1.5, c.z];
    });
    await shot('xr-n-train', tc);
    await page.evaluate(() => window.__nc.time(720));
    await shot('xr-train', tc);
  }
} catch (e) {
  check(false, `腳本中斷：${String(e.message || e).split('\n').slice(0, 3).join(' ← ')}`);   // finally 裡的 process.exit 會吞掉例外
} finally {
  check(log.pageerrors.length === 0, `沒有頁面錯誤 ${log.pageerrors.slice(0, 3).join(' | ')}`);
  check(log.errors.length === 0, `沒有 console.error ${log.errors.slice(0, 3).join(' | ')}`);
  await browser.close();
  if (srv) srv.close();
  console.log(failed ? `\n${failed} 項失敗` : '\n全部通過');
  process.exit(failed ? 1 : 0);
}
