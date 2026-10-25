// 排水道（69-v9-drain.js）的驗收：擋牆上的排水口（游泳靠近才出現提示）與兩個人孔的位置和提示、進去的出生點、
// 箱涵裡走得通（從排水口走到東端檢查井不被擋）、走私包（撿起來入帳、包不見、冷卻期間不能再撿）、從人孔爬出去回到街上（站在人行道、面向馬路）、
// 游出排水口回到水裡；--http 時另外檢查箱涵與檢查井換成模型
// 用法：node tools/check-drain.mjs [--http] [html]（預設 web/260-neon-nightcity.html；NC_QUERY='?zrot=25' 轉整座城）
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
// 走 transition（真實時間）的進出：每一小段讓瀏覽器跑一下，等到淡入結束（淡出中按 E 會被 transition 忽略）
async function until(fn, n = 60) {
  for (let k = 0; k < n; k++) {
    if (await page.evaluate(fn).catch(() => false) && await page.evaluate(() => !document.getElementById('fade').classList.contains('on'))) return true;
    await page.evaluate(() => window.__t.step(10)).catch(() => {});
    await page.waitForTimeout(50);
  }
  return false;
}

try {
  const ents = await sec('入口', () => {
    const N = window.__nc, T = window.__t, D = N.gta.drain, o = { ents: D.ents.map(e => ({ kind: e.kind, name: e.name })), ctx: [] };
    const e = D.ents[0], [fx, fz] = D.at(0);
    // 排水口：岸上站在擋牆邊不出現，游到口前才出現
    N.tp(e.X - e.nx * 2, e.Z - e.nz * 2, e.ry); T.step(2);
    o.dry = N.ctx(); o.drySwim = N.player.swim;
    N.tp(fx, fz, e.ry + Math.PI); T.step(2);
    o.swim = N.player.swim; o.ctx.push(N.ctx());
    for (let i = 1; i < D.ents.length; i++) { const [x, z] = D.at(i); N.tp(x, z, 0); T.step(2); o.ctx.push(N.ctx()); }
    o.d = D.ents.slice(1).map((h, i) => { const [x, z] = D.at(i + 1); return Math.round(Math.hypot(x - e.X, z - e.Z)); });
    return o;
  });
  if (ents) {
    check(ents.ents.length === 3 && ents.ents[0].kind === 'mouth' && ents.ents.slice(1).every(e => e.kind === 'hole'), `一個排水口、兩個人孔 ${ents.ents.map(e => e.name).join('、')}`);
    check(new Set(ents.ents.map(e => e.name)).size === 3, '入口名稱不重複');
    check(!ents.drySwim && !(ents.dry || '').includes('排水道'), `岸上不出現進排水道的提示 ${ents.dry}`);
    check(ents.swim && (ents.ctx[0] || '').includes('進排水道'), `游到排水口前出現「E 進排水道」 ${ents.ctx[0]}`);
    check(ents.ctx.slice(1).every(c => (c || '').includes('掀開人孔蓋')), `站上人孔出現「E 掀開人孔蓋」 ${JSON.stringify(ents.ctx.slice(1))}`);
    check(ents.d.every(d => d >= 60 && d <= 320), `人孔離排水口 70–300 m ${ents.d.join('、')} m`);
  }
  if (ents) await shot('mouth');

  await sec('從排水口進去', () => { const N = window.__nc, D = N.gta.drain, e = D.ents[0], [fx, fz] = D.at(0); N.tp(fx, fz, e.ry + Math.PI); window.__t.step(2); N.act(); });
  await until(() => window.__nc.player.where === 'drain');
  const inside = await sec('箱涵裡', () => {
    const N = window.__nc, D = N.gta.drain, p = N.player, o = { where: p.where, x: +p.x.toFixed(2), z: +p.z.toFixed(2), ctx: N.ctx() };
    // 往東走到底：箱涵的牆不擋路，東端檢查井的端牆擋住
    p.yaw = Math.PI / 2; p.z = 0;
    let x0 = p.x;
    for (let k = 0; k < 60 * 40; k++) { p.x += 0.08; N.step(1 / 60); if (p.x < x0 + 0.02) break; x0 = p.x; }
    o.end = +p.x.toFixed(1); o.chA = D.X.chA;
    return o;
  });
  if (inside) {
    check(inside.where === 'drain' && Math.abs(inside.z) < 1 && inside.x > 1 && inside.x < 4, `按 E 游進箱涵口 (${inside.x}, ${inside.z})`);
    check((inside.ctx || '').includes('游出去'), `口裡出現「E 游出去」 ${inside.ctx}`);
    check(inside.end > inside.chA[0] && inside.end < inside.chA[1] + .2, `箱涵一路走到東端檢查井（停在 x ${inside.end}，井在 ${inside.chA.map(v => v.toFixed(1)).join('–')}）`);
  }
  if (inside) await shot('tunnel');

  if (HTTP) {
    await page.waitForFunction(() => { let n = 0; window.__nc.gta.drain.scene.traverse(o => { const t = o.isMesh && o.material && o.material.uniforms && o.material.uniforms.uMap && o.material.uniforms.uMap.value; if (t) n++; }); return n >= 20; }, null, { timeout: 30000 }).catch(() => {});
    const mdl = await sec('模型', () => {
      let tex = 0, groups = 0;
      const S = window.__nc.gta.drain.scene;
      S.traverse(o => { const t = o.isMesh && o.material && o.material.uniforms && o.material.uniforms.uMap && o.material.uniforms.uMap.value; if (t) tex++; });
      for (const c of S.children) if (c.isGroup) groups++;
      return { tex, groups };
    });
    // 箱涵 8 段＋排水口 1 段＋兩個檢查井（地面 2、側牆 12、端牆：B 兩面各 2 柱 3 層＋開口上 2 層、A 一面同樣＋封閉端 3 層）
    if (mdl) check(mdl.groups >= 40 && mdl.tex >= 40, `箱涵與檢查井換成模型（${mdl.groups} 件、${mdl.tex} 個貼圖網格）`);
  }

  const stash = await sec('走私包', () => {
    const N = window.__nc, T = window.__t, D = N.gta.drain, p = N.player, o = {};
    D.resetStash(); p.x = D.DR.stash.x - .9; p.z = D.DR.stash.z + .3; T.step(1);
    o.ctx = N.ctx(); o.vis = D.DR.bag.visible;
    const c0 = D.DR.stats.cash; N.act(); T.step(1);
    o.got = D.DR.stats.cash - c0; o.vis2 = D.DR.bag.visible; o.ctx2 = N.ctx();
    return o;
  });
  if (stash) {
    check(stash.vis && (stash.ctx || '').includes('走私包'), `東端檢查井角落的走私包出現「E 撿起」 ${stash.ctx}`);
    check(stash.got === 1800 && !stash.vis2 && !(stash.ctx2 || '').includes('走私包'), `撿起入帳 $${stash.got}、包不見、冷卻中不能再撿`);
  }

  const lad = await sec('爬梯', () => {
    const N = window.__nc, T = window.__t, D = N.gta.drain, e = D.ents[2], p = N.player;
    p.x = e.exitAt[0]; p.z = e.exitAt[1] - .4; T.step(1);
    const c = N.ctx(); N.act(); return { ctx: c, name: e.name };
  });
  if (lad) check((lad.ctx || '').includes('爬上去') && lad.ctx.includes(lad.name), `東端檢查井的爬梯出現「E 爬上去 · ${lad.name}」 ${lad.ctx}`);
  await until(() => window.__nc.player.where === 'out');
  const up = await sec('回到街上', () => {
    const N = window.__nc, D = N.gta.drain, p = N.player, [x, z] = D.at(2), e = D.ents[2];
    // 面向馬路：人孔的 ry 朝街區裡，出來的方向和它相反
    const [fx, fz] = N.W(e.x - Math.sin(e.ry) * 3, e.z - Math.cos(e.ry) * 3), dir = Math.atan2(fx - x, fz - z);
    const dy = Math.atan2(Math.sin(p.yaw - dir), Math.cos(p.yaw - dir));
    return { where: p.where, d: +Math.hypot(p.x - x, p.z - z).toFixed(2), swim: !!p.swim, dy: +Math.abs(dy).toFixed(2) };
  });
  if (up) {
    check(up.where === 'out' && up.d < 2 && !up.swim, `從人孔爬出來站在旁邊（離人孔 ${up.d} m）`);
    check(up.dy < .3, `出來面向馬路（偏 ${up.dy} rad）`);
  }
  if (up) await shot('street');

  // 從人孔下去，走回排水口游出去
  await sec('從人孔下去', () => { const N = window.__nc, D = N.gta.drain, [x, z] = D.at(1); N.tp(x, z, 0); window.__t.step(2); N.act(); });
  await until(() => window.__nc.player.where === 'drain');
  const down = await sec('中間檢查井', () => {
    const N = window.__nc, D = N.gta.drain, p = N.player, ch = D.X.chB;
    return { where: p.where, inB: p.x > ch[0] && p.x < ch[1], ctx: N.ctx(), name: D.ents[1].name };
  });
  if (down) check(down.where === 'drain' && down.inB && (down.ctx || '').includes(down.name), `近的人孔通到中間的檢查井，爬梯旁出現「E 爬上去 · ${down.name}」`);
  if (down) await shot('chamber');
  await sec('游出去', () => { const N = window.__nc, D = N.gta.drain, e = D.ents[0], p = N.player; p.x = e.exitAt[0] + .3; p.z = e.exitAt[1]; window.__t.step(1); N.act(); });
  await until(() => window.__nc.player.where === 'out');
  const back = await sec('回到河裡', () => {
    const N = window.__nc, D = N.gta.drain, e = D.ents[0], p = N.player;
    window.__t.step(30);
    return { where: p.where, swim: !!p.swim, d: +Math.hypot(p.x - e.X, p.z - e.Z).toFixed(1) };
  });
  if (back) check(back.where === 'out' && back.swim && back.d > 4 && back.d < 12, `游出排水口回到河裡（離擋牆 ${back.d} m，游泳 ${back.swim}）`);
} finally {
  check(log.pageerrors.length === 0, `沒有頁面錯誤 ${log.pageerrors.slice(0, 3).join(' | ')}`);
  check(log.errors.length === 0, `沒有 console.error ${log.errors.slice(0, 3).join(' | ')}`);
  await browser.close();
  if (srv) srv.close();
  console.log(failed ? `\n${failed} 項失敗` : '\n全部通過');
  process.exit(failed ? 1 : 0);
}
