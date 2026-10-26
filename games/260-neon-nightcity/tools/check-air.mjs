// 灰鷺角國際機場（21-air.js、10-city.js 的 AIR）的驗收：島與堤道是陸地、外面是海、地名；外緣在堤道接口沒有擋牆（從楓林西開車沿堤道開上島）；
// 島邊的矮牆擋住走路的人、梯子前的缺口游得上岸；停在梯子旁的船；客機的起降循環（滑行 → 往西起飛爬升 → 進場降落 → 滑回機位）；
// --http 時另外檢查模型換掉替身
// 用法：node tools/check-air.mjs [--http] [html]（預設 web/260-neon-nightcity.html；NC_QUERY='?zrot=25' 轉整座城；SHOT_DIR 存截圖）
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
  const geo = await sec('地理', () => {
    const N = window.__nc, A = N.props.air, L = A.L, I = L.I, R = A.AIR.road, o = {};
    const W = (x, z) => A.W(x, z), cx = (I.x0 + I.x1) / 2, cz = (I.z0 + I.z1) / 2;
    o.center = A.landW(...W(cx, cz));
    o.sea = [[cx, I.z0 - 30], [cx, I.z1 + 30], [I.x0 - 30, cz], [I.x1 + 30, cz + 200]].map(([x, z]) => !A.landW(...W(x, z)));
    const m = R[R.length >> 1]; o.road = A.landW(...W(m[0], m[1])); o.roadSide = !A.landW(...W(m[0], m[1] + 40));
    o.name = A.district(...W(cx, cz));
    o.ladder = N.ladders.some(l => Math.hypot(l.x - W(L.ladder.x, L.ladder.z)[0], l.z - W(L.ladder.x, L.ladder.z)[1]) < 1);
    o.boat = N.boat.BOAT_SPOTS.some(s => s.where === A.AIR.name);
    o.len = Math.round(R.reduce((a, p, i) => i ? a + Math.hypot(p[0] - R[i - 1][0], p[1] - R[i - 1][1]) : 0, 0));
    return o;
  });
  if (geo) {
    check(geo.center && geo.sea.every(Boolean), `島是陸地、四周 30 m 外是海 ${JSON.stringify(geo.sea)}`);
    check(geo.road && geo.roadSide, `堤道是陸地（長 ${geo.len} m），旁邊是海`);
    check(geo.name === '灰鷺角國際機場', `地名 ${geo.name}`);
    check(geo.ladder && geo.boat, '東緣有梯子、旁邊停一艘船');
  }

  // 從楓林西的街口開上堤道：每 0.1 秒把車頭對準堤道中線前方 16 m（偏右 3 m 的車道），全油門
  const drv = await sec('開車上島', () => {
    const N = window.__nc, A = N.props.air, R = A.AIR.road.map(([x, z]) => A.W(x, z));
    N.drive(); const v = N.player.veh;
    const C = N.gta.v3 && N.gta.v3.crash && N.gta.v3.crash.crash; if (C) Object.assign(C, { veh: v, car: v.carId, belt: true, still: 0 });
    const [x0, z0] = R[0], [x1, z1] = R[2], l = Math.hypot(x1 - x0, z1 - z0);
    v.x = x0 - (z1 - z0) / l * 3; v.z = z0 + (x1 - x0) / l * 3; v.yaw = Math.atan2(x1 - x0, z1 - z0); v.vx = v.vz = 0; if (N.gta.wreck) N.gta.wreck.fix(v);
    window.__drv = { R, cum: R.map(() => 0), maxOff: 0 }; for (let i = 1; i < R.length; i++) window.__drv.cum[i] = window.__drv.cum[i - 1] + Math.hypot(R[i][0] - R[i - 1][0], R[i][1] - R[i - 1][1]);
    return { x: v.x, z: v.z };
  });
  await page.keyboard.down('KeyW');
  let res = null;
  for (let t = 0; t < 600 && !res?.done; t++) {
    res = await page.evaluate(() => {
      const N = window.__nc, v = N.player.veh, D = window.__drv, A = N.props.air;
      if (!v) return { done: 1, lost: 1, mode: N.player.mode };
      let best = 1e9, u = 0;
      for (let k = 1; k < D.R.length; k++) { const [ax, az] = D.R[k - 1], [bx, bz] = D.R[k], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((v.x - ax) * dx + (v.z - az) * dz) / (dx * dx + dz * dz))), d = Math.hypot(v.x - ax - dx * t, v.z - az - dz * t); if (d < best) { best = d; u = D.cum[k - 1] + Math.hypot(dx, dz) * t; } }
      const at = w => { let k = 1; while (k < D.R.length - 1 && D.cum[k] < w) k++; const p = D.R[k - 1], q = D.R[k], L = D.cum[k] - D.cum[k - 1] || 1, f = Math.min(1, (w - D.cum[k - 1]) / L), hx = (q[0] - p[0]) / L, hz = (q[1] - p[1]) / L; return [p[0] + (q[0] - p[0]) * f - hz * 3, p[1] + (q[1] - p[1]) * f + hx * 3]; };
      const end = D.cum[D.cum.length - 1];
      if (u < end - 5) D.maxOff = Math.max(D.maxOff, best);
      if (u < end - 5) { const [tx, tz] = at(Math.min(end, u + 16)), yaw = Math.atan2(tx - v.x, tz - v.z), sp = Math.hypot(v.vx, v.vz); v.yaw = yaw; v.vx = Math.sin(yaw) * sp; v.vz = Math.cos(yaw) * sp; }
      window.__t.step(6);
      const [lx, lz] = A.L2(v.x, v.z);
      return { done: lx < A.L.I.x1 - 40 ? 1 : 0, u: Math.round(u), off: +D.maxOff.toFixed(1), y: +v.y.toFixed(2), sp: +Math.hypot(v.vx, v.vz).toFixed(1), lx: Math.round(lx), lz: Math.round(lz), sink: v.sink || 0, dead: !!v.dead };
    });
  }
  await page.keyboard.up('KeyW');
  if (drv && res) check(res.done && !res.lost && res.off < 6 && Math.abs(res.y) < .6 && !res.dead, `從楓林西沿堤道開上島（${JSON.stringify(res)}）`);
  await shot('cause');

  const walk = await sec('島邊的矮牆', () => {
    const N = window.__nc, A = N.props.air, I = A.L.I, p = N.player;
    const [ax, az] = A.W(-2000, I.z0 + 4), [bx, bz] = A.W(-2000, I.z0 - 10);   // 往北（SEA_FR 的 −z）走
    N.tp(ax, az, Math.atan2(bx - ax, bz - az));
    return { y: p.y };
  });
  await page.keyboard.down('KeyW');
  await page.evaluate(() => window.__t.step(180));
  await page.keyboard.up('KeyW');
  const wall = await sec('擋住', () => { const N = window.__nc, A = N.props.air, p = N.player, [lx, lz] = A.L2(p.x, p.z); return { lz: +lz.toFixed(2), z0: A.L.I.z0, swim: !!p.swim, y: +p.y.toFixed(2) }; });
  if (walk && wall) check(!wall.swim && wall.lz > wall.z0 - .2 && Math.abs(wall.y) < .3, `走到北緣被矮牆擋住，沒掉進海裡（z ${wall.lz}，島緣 ${wall.z0}）`);

  // 從海裡游到東緣的梯子：按住 W 朝梯子游，爬上岸
  await sec('梯子', () => {
    const N = window.__nc, A = N.props.air, L = A.L, p = N.player, [x, z] = A.W(L.ladder.x + 5, L.ladder.z), [bx, bz] = A.W(L.ladder.x - 3, L.ladder.z);
    N.tp(x, z, Math.atan2(bx - x, bz - z)); window.__t.step(20);
  });
  await page.keyboard.down('KeyW');
  await page.evaluate(() => window.__t.step(360));
  await page.keyboard.up('KeyW');
  const lad = await sec('上岸', () => { const N = window.__nc, A = N.props.air, p = N.player, [lx] = A.L2(p.x, p.z); return { lx: +lx.toFixed(1), x1: A.L.I.x1, swim: !!p.swim, y: +p.y.toFixed(2) }; });
  if (lad) check(!lad.swim && lad.lx < lad.x1 && lad.y > -.3, `從東緣的梯子游上岸（x ${lad.lx}，島緣 ${lad.x1}）`);

  // 客機：從遠端機位滑出去 → 往西起飛 → 消失 → 從西邊進場、著陸、滑回機位
  const fly = await sec('客機起降', () => {
    const N = window.__nc, A = N.props.air, P = A.P, T = window.__t, o = { seq: [] };
    const [sx, sz] = A.W(A.L.stand.x, A.L.stand.z); N.tp(sx + 60, sz - 40, 0);
    const log = () => { if (o.seq[o.seq.length - 1] !== P.st) o.seq.push(P.st); };
    A.set('park', .1);
    for (let i = 0; i < 60 * 600 && !(o.seq.includes('in') && P.st === 'park'); i++) {
      T.step(1); log();
      if (P.st === 'roll') { o.maxY = Math.max(o.maxY || 0, P.y); o.minX = Math.min(o.minX ?? 0, P.x); }
      if (P.st === 'final' && o.y0 == null) o.y0 = +P.y.toFixed(1);
      if (P.st === 'rollout' && o.td == null) o.td = Math.round(P.x);
      if (P.st === 'out' && P.d > 100 && o.taxi == null) o.taxi = { v: +P.v.toFixed(1), y: P.y };
    }
    o.end = { st: P.st, x: Math.round(P.x), z: Math.round(P.z) };
    o.vis = P.planes.filter(p => p.g.visible).length;
    o.cur = P.cur;
    return o;
  });
  if (fly) {
    check(['out', 'line', 'roll', 'gone', 'final', 'rollout', 'in', 'park'].every(s => fly.seq.includes(s)), `走完一輪起降 ${fly.seq.join(' → ')}`);
    check(fly.taxi && fly.taxi.v > 3 && fly.taxi.y === 0, `滑行 ${JSON.stringify(fly.taxi)}`);
    check(fly.maxY > 300, `往西起飛爬升到 ${Math.round(fly.maxY)} m`);
    check(fly.y0 > 150 && Math.abs(fly.td - -3080) < 5, `從 ${fly.y0} m 高進場、在跑道西端著陸（x ${fly.td}）`);
    check(fly.end.st === 'park' && fly.vis === 1, `滑回遠端機位 ${JSON.stringify(fly.end)}，換成另一型客機 ${fly.cur}`);
  }

  if (HTTP) {
    await page.evaluate(() => { const N = window.__nc, A = N.props.air; N.tp(...A.W(-1500, 60), 0); window.__t.step(40); });
    await page.waitForFunction(() => window.__nc.props.air.M.items, null, { timeout: 60000 }).catch(() => {});
    await page.evaluate(() => window.__t.step(5));
    const mdl = await sec('模型', () => { const A = window.__nc.props.air; return { items: A.M.items ? Object.keys(A.M.items) : null, proxies: A.M.proxies.length, body: A.P.planes.map(p => p.body.children[0] && p.body.children[0].isGroup) }; });
    if (mdl) check(mdl.items && mdl.items.length === 7 && mdl.proxies === 0 && mdl.body.every(Boolean), `模型換掉替身（${(mdl.items || []).join('、')}；客機 ${JSON.stringify(mdl.body)}）`);
  }
  if (shotDir) {
    const cams = await page.evaluate(() => {
      const A = window.__nc.props.air, w = (x, y, z) => { const [X, Z] = A.W(x, z); return [X, y, Z]; };
      return { over: [...w(-900, 420, 900), ...w(-2000, 0, 300)], apron: [...w(-1760, 40, 330), ...w(-1950, 8, 200)], city: [...w(-560, 30, 470), ...w(-2100, 20, 300)], rwy: [...w(-1400, 25, 560), ...w(-2600, 0, 470)] };
    });
    for (const [k, c] of Object.entries(cams)) await shot('air-' + k, c);
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
