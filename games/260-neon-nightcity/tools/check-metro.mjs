// 地鐵（69-v9-metro.js）的驗收：三個入口的提示與進站、列車週期（進站 → 停站開門 → 出站、每三班一班 2 號軌快車）、
// 車門旁選目的地（選的時候車門不關）、搭到下一站下車、從那一站的出口出站回到街上；--http 時另外檢查模型換掉替身、商標貼圖換成原創的
// 用法：node tools/check-metro.mjs [--http] [html]（預設 web/260-neon-nightcity.html；NC_QUERY='?zrot=25' 轉整座城）
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
const shot = async (n) => { if (shotDir) { await raf(page); await page.screenshot({ path: resolve(shotDir, n + '.png') }); } };
await page.evaluate(() => {
  const N = window.__nc;
  N.start(); N.gta.god.on = true; N.gta.wanted.set(0);
  window.__t = { step(n) { for (let i = 0; i < n; i++) { try { N.step(1 / 60); } catch (e) { throw new Error(e.stack.split('\n').slice(0, 4).join(' ← ')); } } } };
});

try {
  const gates = await sec('街上的入口', () => {
    const N = window.__nc, T = window.__t, M = N.gta.metro, o = { st: M.stations.map(s => s.name), ctx: [], blips: 0 };
    for (const s of M.stations) {
      const [x, z] = N.W(s.front.x, s.front.z);
      N.tp(x, z, s.ry + Math.PI); T.step(2);
      o.ctx.push(N.ctx());
    }
    return o;
  });
  if (gates) {
    check(gates.st.length === 3 && new Set(gates.st).size === 3, `三個站、站名不重複 ${gates.st.join('、')}`);
    check(gates.ctx.every((c, i) => c && c.includes('進地鐵站') && c.includes(gates.st[i])), `每個入口前出現「E 進地鐵站 · 站名」 ${JSON.stringify(gates.ctx)}`);
  }
  if (gates) await shot('gate');

  await sec('進站', () => { const N = window.__nc, M = N.gta.metro, s = M.stations[0]; const [x, z] = N.W(s.front.x, s.front.z); N.tp(x, z, s.ry + Math.PI); window.__t.step(2); N.act(); });
  await page.waitForFunction(() => window.__nc.player.where === 'metro', null, { timeout: 8000 }).catch(() => {});
  const inside = await sec('月台', () => {
    const N = window.__nc, M = N.gta.metro;
    return { where: N.player.where, ctx: N.ctx(), st: M.MT.st, name: M.stations[M.MT.st].name };
  });
  if (inside) {
    check(inside.where === 'metro', `按 E 進到月台 ${inside.where}`);
    check(inside.ctx && inside.ctx.includes('出站') && inside.ctx.includes(inside.name), `出口走廊出現「E 出站 · 站名」 ${inside.ctx}`);
  }

  if (HTTP) {
    // 模型：月台、車廂與車門換掉替身；車廂廣告圖集是原創的（material_ads），貼花圖集擦掉了真實站名（JoinedDecals_clean）
    await page.waitForFunction(() => { let n = 0; window.__nc.gta.metro.scene.traverse(o => { const t = o.material && o.material.uniforms && o.material.uniforms.uMap && o.material.uniforms.uMap.value; if (t && t.name === 'material_ads') n++; }); return n > 0; }, null, { timeout: 30000 }).catch(() => {});
    const mdl = await sec('模型與貼圖', () => {
      const tex = new Set(); let meshes = 0;
      window.__nc.gta.metro.scene.traverse(o => { if (!o.isMesh) return; meshes++; const t = o.material && o.material.uniforms && o.material.uniforms.uMap && o.material.uniforms.uMap.value; if (t && t.name) tex.add(t.name); });
      return { meshes, tex: [...tex] };
    });
    if (mdl) {
      check(mdl.tex.includes('material_ads'), `車廂與月台的廣告是原創圖集 material_ads（${mdl.meshes} 個網格）`);
      check(mdl.tex.includes('JoinedDecals_clean') && !mdl.tex.includes('JoinedDecals'), '貼花圖集是擦掉站名與路線標的版本');
    }
  }

  const cyc = await sec('列車週期', () => {
    const N = window.__nc, T = window.__t, M = N.gta.metro, MT = M.MT, o = {};
    N.player.x = 0; N.player.z = 4.5;
    M.phase('in'); T.step(1);
    o.in = M.state(); o.vis = MT.trains[0].root.visible;
    T.step(Math.round(60 * (M.T.IN + 2.5)));
    o.stop = M.state();
    o.doorX = MT.trains[0].cars[0].dr.position.x;
    T.step(Math.round(60 * (M.T.DWELL)));
    o.out = M.state();
    // 每三班一班 2 號軌快車，在 1 號軌出站後開過去
    MT.n = 1; MT.t = M.T.IN + M.T.DWELL + 3; T.step(1);
    o.exp = { x: MT.trains[1].x, vis: MT.trains[1].root.visible };
    MT.n = 2; T.step(1); o.exp2 = MT.trains[1].root.visible;
    return o;
  });
  if (cyc) {
    check(cyc.in.ph === 'in' && cyc.in.x > 0 && cyc.vis, `列車從東邊進站 ${JSON.stringify(cyc.in)}`);
    check(cyc.stop.ph === 'stop' && cyc.stop.open > .95 && cyc.doorX > .5, `停站開門（車門滑開 ${cyc.doorX.toFixed(2)} m）`);
    check(cyc.out.ph === 'out' && cyc.out.open === 0, `時間到關門出站 ${cyc.out.ph}`);
    check(cyc.exp.vis && Math.abs(cyc.exp.x) < 140 && !cyc.exp2, `每三班一班 2 號軌快車開過月台 ${JSON.stringify(cyc.exp)}`);
  }

  const board = await sec('車門旁選目的地', () => {
    const N = window.__nc, T = window.__t, M = N.gta.metro, MT = M.MT, o = {};
    MT.n = 0; M.phase('stop'); T.step(60 * 2);
    M.atDoor(0, 1); T.step(1);
    o.ctx = N.ctx();
    N.act(); T.step(1);
    o.dlg = !!N.dialog.open && MT.hold;
    // 選的時候車門不關：時鐘停在關門前
    T.step(60 * 20);
    o.held = M.state();
    return o;
  });
  if (board) {
    check(board.ctx && board.ctx.includes('上車'), `車門開著時站到門邊出現「E 上車 · 選目的地」 ${board.ctx}`);
    check(board.dlg && board.held.ph === 'stop' && board.held.open > .5, `選目的地的時候車門不關 ${JSON.stringify(board.held)}`);
  }
  if (board) await shot('board');

  const ride = await sec('搭到下一站', () => {
    const N = window.__nc, T = window.__t, M = N.gta.metro, MT = M.MT, o = {};
    N.closeDialog(); T.step(1);
    if (!MT.ride) { M.phase('stop'); T.step(60 * 2); M.atDoor(0, 1); T.step(1); o.go = M.go(1); }
    o.riding = !!MT.ride && !!N.player.ride;
    T.step(60 * 4);
    o.mid = { x: +MT.trains[0].x.toFixed(1), px: +N.player.x.toFixed(1) };
    return o;
  });
  if (ride) check(ride.riding, `上車後跟著列車開出 ${JSON.stringify(ride.mid)}`);
  if (ride) await shot('ride');
  // 淡出換站走的是 transition（真實時間），每一小段讓瀏覽器跑一下
  for (let k = 0; k < 50; k++) {
    const done = await page.evaluate(() => { window.__t.step(30); const M = window.__nc.gta.metro; return !M.MT.ride && M.MT.st === 1; }).catch(() => false);
    if (done) break;
    await page.waitForTimeout(40);
  }
  const arr = await sec('下車', () => {
    const N = window.__nc, M = N.gta.metro, MT = M.MT;
    return { st: MT.st, ride: !!MT.ride, pride: !!N.player.ride, z: +N.player.z.toFixed(2), name: M.stations[MT.st].name, rides: MT.stats.rides, where: N.player.where };
  });
  if (arr) {
    check(arr.st === 1 && !arr.ride && !arr.pride, `到了 ${arr.name}，開門下車 ${JSON.stringify(arr)}`);
    check(arr.z > 2 && arr.z < 4 && arr.where === 'metro', `下車站在月台上（z ${arr.z}）`);
  }
  if (arr) await shot('arrived');

  await sec('出站', () => { const N = window.__nc, M = N.gta.metro; N.player.x = M.EXIT.x0 + 1.6; N.player.z = M.EXIT.z0 + 1.2; window.__t.step(1); N.act(); });
  await page.waitForFunction(() => window.__nc.player.where === 'out', null, { timeout: 8000 }).catch(() => {});
  const out = await sec('回到街上', () => {
    const N = window.__nc, M = N.gta.metro, s = M.stations[1], [x, z] = N.W(s.front.x, s.front.z);
    return { where: N.player.where, d: +Math.hypot(N.player.x - x, N.player.z - z).toFixed(2) };
  });
  if (out) check(out.where === 'out' && out.d < 3, `從 ${arr ? arr.name : '下一站'} 的出口出來（離入口 ${out.d} m）`);
} finally {
  check(log.pageerrors.length === 0, `沒有頁面錯誤 ${log.pageerrors.slice(0, 3).join(' | ')}`);
  check(log.errors.length === 0, `沒有 console.error ${log.errors.slice(0, 3).join(' | ')}`);
  await browser.close();
  if (srv) srv.close();
  console.log(failed ? `\n${failed} 項失敗` : '\n全部通過');
  process.exit(failed ? 1 : 0);
}
