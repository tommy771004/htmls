// 雲梯城寨（28-enclave.js、10-city.js 的 ENC）的驗收：平台、中庭、人行道的地面高度與地名；樓擋人、穿堂底下走得過去；
// 平台三面的高牆擋住、城市外緣在主街前開口（從城裡走進主街）；路燈進了路燈表、點光數；--http 時另外檢查模型換掉替身
// 用法：node tools/check-enclave.mjs [--http] [html]（預設 web/260-neon-nightcity.html；NC_QUERY='?zrot=25' 轉整座城；SHOT_DIR 存截圖）
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
const { browser, page, log } = await open(url, { w: 1280, h: 800, query: process.env.NC_QUERY || '' });
async function sec(title, fn, arg) {
  console.log(title);
  try { return await page.evaluate(fn, arg); } catch (e) { check(false, `執行失敗：${String(e.message || e).split('\n').slice(0, 4).join(' ← ')}`); return null; }
}
const shot = async (n, cam) => {
  if (!shotDir) return;
  await page.evaluate(c => window.__nc.camAt(...c), cam);
  await raf(page); await raf(page); await page.screenshot({ path: resolve(shotDir, n + '.png') });
  await page.evaluate(() => window.__nc.camAt());
};
await page.evaluate(() => {
  const N = window.__nc;
  N.start(); N.gta.god.on = true; N.gta.wanted.set(0);
  window.__t = { step(n) { for (let i = 0; i < n; i++) { try { N.step(1 / 60); } catch (e) { throw new Error(e.stack.split('\n').slice(0, 4).join(' ← ')); } } } };
});

try {
  const geo = await sec('地面與地名', () => {
    const E = window.__nc.enc; if (!E) return null;
    const S = E.S, o = {};
    const g = (x, z) => +E.ground(...E.W(x, z)).toFixed(3);
    o.street = g(0, -100); o.cross = g(100, -128);
    const L = S.lots[0], c = L.court;
    o.court = g((c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2);
    o.walk = g(L.x0 + 1, (L.z0 + L.z1) / 2);
    o.apron = g(40, -40);
    o.slope = [g(S.pad.x0 - 30, -120), g(S.pad.x1 + 30, -120), g(60, S.pad.z0 - 30)];
    o.name = E.district(...E.W(0, -100)); o.place = E.place(...E.W(0, -100));
    o.lights = E.on.lights; o.blds = E.on.blds; o.nBlds = S.blds.length; o.tris = E.tris;
    return o;
  });
  if (geo) {
    check(Math.abs(geo.street) < .02 && Math.abs(geo.cross) < .02 && Math.abs(geo.apron) < .02, `街與門前廣場的地面是 0（${geo.street}、${geo.cross}、${geo.apron}）`);
    check(Math.abs(geo.court) < .02 && Math.abs(geo.walk - .15) < .02, `中庭 ${geo.court}、人行道 ${geo.walk}`);
    check(geo.slope.every(h => h > 2), `平台外是往上的切坡 ${JSON.stringify(geo.slope)}`);
    check(/雲梯城寨/.test(geo.name) && geo.place === '雲梯城寨 / 雲梯街', `地名 ${geo.name}、地圖 ${geo.place}`);
    check(geo.blds === geo.nBlds && geo.lights > 100, `${geo.blds} 棟樓有碰撞盒、${geo.lights} 盞點光`);
    check(geo.tris && geo.tris.tris > 1000, `山的網格在平台與切坡細分 ${JSON.stringify(geo.tris)}`);
  }

  const col = await sec('碰撞', () => {
    const N = window.__nc, E = N.enc, S = E.S, P = S.pad, push = (x, z, y = 0) => { const [X, Z] = E.W(x, z), o = N.col.collide(X, Z, .32, y); return Math.hypot(o.x - X, o.z - Z); };
    const o = {};
    const b = S.blds.find(b => !b.pas), bp = S.blds.find(b => b.pas && (b.pas.side === 's' || b.pas.side === 'n'));
    o.bld = push((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
    const p = bp.pas; o.pass = push((p.x0 + p.x1) / 2, (bp.z0 + bp.z1) / 2); o.passUp = push((p.x0 + p.x1) / 2, (bp.z0 + bp.z1) / 2, 6);
    o.walls = [push(P.x0 - .3, -120), push(P.x1 + .3, -120), push(60, P.z0 - .3)];
    o.open = []; for (let z = -60; z < 14; z += 2) o.open.push(push(0, z));
    return o;
  });
  if (col) {
    check(col.bld > 1, `樓擋人（推出 ${col.bld.toFixed(1)} m）`);
    check(col.pass < .01 && col.passUp > 1, `穿堂底下走得過去（${col.pass.toFixed(2)}），上面的樓層擋著（${col.passUp.toFixed(1)}）`);
    check(col.walls.every(d => d > .1), `平台兩側與後面有牆 ${JSON.stringify(col.walls.map(d => +d.toFixed(2)))}`);
    check(col.open.every(d => d < .01), `主街到城裡一路沒有牆（最大 ${Math.max(...col.open).toFixed(2)} m）`);
  }

  // 從城裡（框的 z = +20）往主街跑 30 秒
  const walk = await sec('從城裡走進主街', () => {
    const N = window.__nc, E = N.enc, [x, z] = E.W(1.5, 20), [x2, z2] = E.W(1.5, -80);
    N.tp(x, z, Math.atan2(x2 - x, z2 - z)); window.__t.step(30);
    return 1;
  });
  if (walk) {
    await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');   // 走路每秒不到 2 m，用跑的
    await page.evaluate(() => window.__t.step(60 * 30));
    await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
    const w = await sec('走到', () => { const N = window.__nc, E = N.enc, p = N.player, [x, z] = E.L(p.x, p.z); return { x: +x.toFixed(1), z: +z.toFixed(1), y: +p.y.toFixed(2) }; });
    if (w) check(w.z < -60 && Math.abs(w.x) < 6, `走過門樓進了主街 ${JSON.stringify(w)}`);
  }

  if (HTTP) {
    await page.evaluate(() => { const N = window.__nc, E = N.enc; N.tp(...E.W(0, -100)); window.__t.step(30); });
    await page.waitForFunction(() => window.__nc.enc.on.glb > 0 || window.__nc.enc.on.failed, null, { timeout: 90000 }).catch(() => {});
    await page.evaluate(() => window.__t.step(5));
    const m = await sec('模型', () => ({ ...window.__nc.enc.on }));
    if (m) check(m.glb > 30 && !m.failed && !m.proxy, `模型換掉替身 ${JSON.stringify(m)}`);
  }
  if (shotDir) {
    const cams = await page.evaluate(() => { const E = window.__nc.enc, w = (x, y, z) => { const [X, Z] = E.W(x, z); return [X, y, Z]; }; return { over: [...w(4, 74, -214), ...w(12, 0, -66)], street: [...w(3, 2.2, -104), ...w(0, 5, -190)], gate: [...w(2, 3, -30), ...w(0, 6, -120)] }; });
    for (const [k, c] of Object.entries(cams)) await shot('enc-' + k, c);
  }
} catch (e) {
  check(false, `腳本中斷：${String(e.message || e).split('\n').slice(0, 3).join(' ← ')}`);
} finally {
  check(log.pageerrors.length === 0, `沒有頁面錯誤 ${log.pageerrors.slice(0, 3).join(' | ')}`);
  check(log.errors.length === 0, `沒有 console.error ${log.errors.slice(0, 3).join(' | ')}`);
  await browser.close();
  if (srv) srv.close();
  console.log(failed ? `\n${failed} 項失敗` : '\n全部通過');
  process.exit(failed ? 1 : 0);
}
