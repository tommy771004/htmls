// 連線實測：起本機伺服器，開兩個瀏覽器分頁。第一個從選單點「快速配對」拿到房號，第二個用分享網址（?room=）加入；
// 檢查在線人數、兩邊都看得到對方的車、開球、碰球換球權、進球兩邊同步計分，最後上傳一筆計時賽成績到世界排行榜。
// node tools/mp.mjs（截圖輸出到 dist/mp-*.png）
import { mkdirSync } from 'node:fs';
import { open, raf, serve } from './lib.mjs';

mkdirSync('dist', { recursive: true });
let fail = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fail++; };
const wait = (page, fn, ms = 15000, arg) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const srv = await serve();
const pages = [];
try {
  const A = await open(srv.url, { w: 960, h: 600 });
  pages.push(A);
  const a = A.page;
  ok(await wait(a, () => window.__rsa.lobby.live && /\d/.test(document.getElementById('onlineN').textContent)), 'A 連上大廳');
  await a.click('#modes button[data-mode=league]');
  ok(await a.evaluate(() => !document.querySelector('#lobby [data-act=quick]').disabled), '線上時可以快速配對');
  await a.click('#lobby [data-act=quick]');
  ok(await wait(a, () => window.__rsa.match && window.__rsa.match.myId != null), 'A 進房（熱身）');
  const code = await a.evaluate(() => window.__rsa.match.code);
  ok(/^[A-Z2-9]{5}$/.test(code) && a.url().includes(`room=${code}`), `網址帶房號 ${code}`);
  const B = await open(srv.url, { w: 960, h: 600, query: `?room=${code}` });
  pages.push(B);
  const b = B.page;
  ok(await wait(b, () => window.__rsa.match && window.__rsa.match.myId != null), 'B 用分享網址加入同一房');
  ok(await wait(a, () => document.getElementById('onlineN').textContent === '2', 8000), 'A 的在線人數變成 2');
  const ids = { a: await a.evaluate(() => window.__rsa.match.myId), b: await b.evaluate(() => window.__rsa.match.myId) };
  const teams = await Promise.all([a, b].map((p) => p.evaluate(() => window.__rsa.match.me.team)));
  ok(teams[0] !== teams[1], `分到不同隊（${teams}）`);
  ok(await wait(a, () => window.__rsa.match.lg.phase === 'kickoff' || window.__rsa.match.lg.phase === 'play', 5000), '兩人到齊開新比賽');
  ok(await wait(a, () => window.__rsa.match.lg.phase === 'play', 6000) && await wait(b, () => window.__rsa.match.lg.phase === 'play', 2000), '倒數後兩邊都開球');
  ok(await wait(a, (id) => window.__rsa.match.lg.remotes.has(id), 4000, ids.b) && await wait(b, (id) => window.__rsa.match.lg.remotes.has(id), 4000, ids.a), '兩邊都看得到對方的車');
  // A 全速衝向中場的球
  const z0 = await b.evaluate((id) => window.__rsa.match.lg.remotes.get(id).body.translation().z, ids.a);
  await a.evaluate(() => { window.__rsa.auto = { throttle: 1, boost: true }; });
  ok(await wait(b, (id) => window.__rsa.match.owner === id, 6000, ids.a), '碰球後 B 看到球權交給 A');
  await a.evaluate(() => { window.__rsa.auto = null; });
  const z1 = await b.evaluate((id) => window.__rsa.match.lg.remotes.get(id).body.translation().z, ids.a);
  ok(Math.abs(z1 - z0) > 10, `B 看到 A 的車移動 ${Math.abs(z1 - z0).toFixed(1)} m`);
  await raf(b); await b.screenshot({ path: 'dist/mp-touch.png' });
  // 有球權的 A 把球送進門：伺服器檢查位置後加分，兩邊同步
  await a.evaluate(() => { const L = window.__rsa.match.lg; L.placeBall(0, 6, 82, 0, 0, 30); });
  const sum = () => Number(document.getElementById('lgS0').textContent) + Number(document.getElementById('lgS1').textContent);
  ok(await wait(a, sum, 5000) && await wait(b, sum, 3000), '進球兩邊同步計分');
  await b.waitForTimeout(400); await raf(b); await b.screenshot({ path: 'dist/mp-goal.png' });
  ok(await wait(b, () => window.__rsa.match.lg.phase === 'kickoff', 6000), '進球後重新開球');
  // 排行榜：從 B 上傳一筆成績，A 的世界紀錄看得到
  const r = await b.evaluate(() => window.__rsa.lobby.submit('Ben', 61.25, [9, 18, 27, 36, 45, 61.25]));
  ok(r && r.ok && r.rank === 1, `上傳成績（第 ${r && r.rank} 名）`);
  await a.evaluate(() => { window.__rsa.go('menu'); window.__rsa.openSheet('board'); });
  ok(await wait(a, () => /Ben/.test(document.getElementById('boardTable').textContent), 4000), '世界排行榜看得到新成績');
  await raf(a); await a.screenshot({ path: 'dist/mp-board.png' });
  ok(await wait(b, (id) => !window.__rsa.match.lg.remotes.has(id) && !window.__rsa.match.roster.has(id), 4000, ids.a), 'A 離房後 B 那邊移除 A 的車');
  for (const [n, P] of [['A', A], ['B', B]]) {
    ok(!P.log.pageerrors.length, `${n} 沒有 uncaught exception ${P.log.pageerrors.join(' | ')}`);
    ok(!P.log.errors.length, `${n} 沒有 console.error ${P.log.errors.join(' | ').slice(0, 300)}`);
    ok(!P.log.external.length, `${n} 沒有外部請求 ${P.log.external.join(' ')}`);
  }
} finally {
  for (const P of pages) await P.browser.close();
  await srv.close();
}
if (fail) { console.log(`${fail} 項未通過`); process.exit(1); }
console.log('全部通過');
