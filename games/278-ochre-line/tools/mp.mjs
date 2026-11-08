// 連線對戰實測：同一個行程起靜態伺服器＋房間伺服器（server/ochre），開兩個無頭分頁走完
// 建房、輸入房號加入、選邊、開賽、位置同步、互射扣血、擊殺、購買、斷線由電腦接手、房主離開。
// node tools/mp.mjs [--page=dist/x.html] [--quick]（--quick 跳過 30 秒的斷線接手）[--shots=dir]
import http from 'node:http';
import { startServer, launch } from './lib/serve.mjs';
import { createOchre } from '../../../server/ochre/server.mjs';

const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1];
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// --page 的檔案掛在 /web/ 的網址上，素材的相對路徑 ../assets/278/ 才會對
const PAGE = '/web/278-ochre-line.html', QUICK = process.argv.includes('--quick'), SHOTS = arg('shots');
const GAME_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srv = await startServer(undefined, arg('page') ? { [PAGE]: resolve(GAME_DIR, arg('page')) } : {});
const ochre = createOchre({ origins: [srv.url] });
const wsSrv = http.createServer((q, r) => { r.writeHead(404); r.end(); });
wsSrv.on('upgrade', (q, s, h) => { if (!ochre.handleUpgrade(q, s, h)) s.destroy(); });
await new Promise(ok => wsSrv.listen(0, '127.0.0.1', ok));
const WS = `ws://127.0.0.1:${wsSrv.address().port}`;
const b = await launch();
const errs = [];
let fails = 0;
const check = (name, ok, info = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? '  ' + (typeof info === 'string' ? info : JSON.stringify(info)) : ''}`); };
async function page(tag) {
  const p = await b.newPage({ viewport: { width: 960, height: 600 } });
  p.on('pageerror', e => errs.push(`${tag}: ${e}`)); p.on('console', m => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); });
  await p.goto(`${srv.url}${PAGE}?server=${encodeURIComponent(WS)}`); await p.waitForFunction(() => window.__ol?.ready, null, { timeout: 180000 });
  return p;
}
const until = (p, fn, arg, ms = 15000) => p.waitForFunction(fn, arg, { timeout: ms, polling: 50 });
const wait = ms => new Promise(f => setTimeout(f, ms));

try {
  const A = await page('A'), B = await page('B');
  // 1. A 用畫面建房、選攻方
  await A.click('[data-tab=net]'); await A.fill('#n-name', '甲'); await A.click('#n-create');
  await until(A, () => __ol.NET.status === 'in');
  const code = await A.evaluate(() => __ol.NET.code);
  check('建房拿到六位數房號', /^\d{6}$/.test(code), code);
  await A.click('.n-side[data-side=atk]');
  // 2. B 輸入房號加入、選守方
  await B.click('[data-tab=net]'); await B.fill('#n-name', '乙'); await B.fill('#n-code', code); await B.click('#n-go');
  await until(B, () => __ol.NET.status === 'in' && __ol.NET.players.length === 2);
  await B.click('.n-side[data-side=def]');
  await until(A, () => __ol.NET.players.find(p => p.name === '乙')?.side === 'def');
  if (SHOTS) await A.screenshot({ path: `${SHOTS}/mp_lobby.png` });
  check('非房主沒有開始鈕', await B.evaluate(() => !document.querySelector('#n-start')));
  // 3. 開賽：兩邊都進場，名單 10 人、空位電腦補
  await A.click('#n-start');
  await until(A, () => __ol.SYNC.role === 'host' && __ol.G.me);
  await until(B, () => __ol.SYNC.role === 'client' && __ol.G.me && __ol.SYNC.rs > 0);
  const roster = await A.evaluate(() => __ol.G.agents.map(a => ({ n: a.name, t: a.team, bot: !!a.bot, remote: a.remote, me: a === __ol.G.me })));
  check('名單 10 人：1 主機、1 遠端、8 電腦', roster.length === 10 && roster.filter(r => r.bot).length === 8 && roster.filter(r => r.remote).length === 1, roster.map(r => `${r.t}${r.me ? '*' : r.remote ? 'R' : r.bot ? 'b' : ''}${r.n}`).join(' '));
  const sides = await B.evaluate(() => ({ me: __ol.G.me.team, name: __ol.G.me.name, host: __ol.G.agents.find(a => a.name === '甲')?.team }));
  check('客戶端：自己在守方、房主在攻方', sides.me === 1 && sides.host === 0, sides);
  // 4. 主機收掉電腦、拉長回合、跳過購買時間
  await A.evaluate(() => { const G = __ol.G; for (const a of G.agents) if (a.bot) { a.alive = false; a.y = a.py = -60; } G.time = 0.05; });
  await until(A, () => __ol.G.phase === 'live'); await A.evaluate(() => { __ol.G.time = 900; __ol.G.me.hp = 1e6; });
  await until(B, () => __ol.G.phase === 'live');
  check('客戶端跟著進入 live', true);
  // 5. 位置同步：找一條 10 m 的空巷，A 站一端、B 站另一端互相面對
  const lane = await A.evaluate(() => {
    const O = __ol, N = O.LAYOUT.nav.nodes;
    for (const n of N) for (let k = 0; k < 16; k++) { const th = k * Math.PI / 8, sx = Math.sin(th), cz = Math.cos(th); if ([0.5, 1.0, 1.4, 1.7].every(h => O.los(n.x, n.y + h, n.z, n.x + sx * 12, n.y + h, n.z + cz * 12))) return { x: n.x, y: n.y, z: n.z, th, sx, cz }; }
    return null;
  });
  const D = 8, bx = lane.x + lane.sx * D, bz = lane.z + lane.cz * D;
  await A.evaluate(L => __ol.teleport(L.x, L.y, L.z, L.th * 180 / Math.PI, 0), lane);
  await B.evaluate(([x, y, z, yaw]) => __ol.teleport(x, y, z, yaw, 0), [bx, lane.y, bz, (lane.th + Math.PI) * 180 / Math.PI]);
  await wait(600);
  const seenB = await A.evaluate(() => { const r = __ol.G.agents.find(a => a.remote); return [r.x, r.z]; });
  const seenA = await B.evaluate(() => { const r = __ol.G.agents.find(a => a.name === '甲'); return [r.x, r.z]; });
  check('主機看到客戶端的位置', Math.hypot(seenB[0] - bx, seenB[1] - bz) < 0.3, seenB);
  check('客戶端看到主機的位置', Math.hypot(seenA[0] - lane.x, seenA[1] - lane.z) < 0.3, seenA);
  if (SHOTS) { await B.evaluate(() => __ol.setClean(false)); await B.screenshot({ path: `${SHOTS}/mp_client_view.png` }); }
  // 6. 客戶端開槍打主機：客戶端判定命中、主機扣血
  await A.evaluate(() => { const t = __ol.G.agents.find(a => a.remote); t.primary = 'ar5'; });   // 主機那邊也要有這把槍，命中回報才會被接受
  const hp0 = await A.evaluate(() => __ol.G.me.hp);
  const shotB = await B.evaluate(async () => {
    const O = __ol, m = O.G.me, t = O.G.agents.find(a => a.name === '甲'), w = ms => new Promise(f => setTimeout(f, ms));
    O.giveWeapon('ar5'); await w(800); m.fireT = 0; let hits = 0;
    for (let i = 0; i < 4; i++) { m.burst = 0; const yaw = Math.atan2(t.x - m.x, t.z - m.z), pitch = Math.atan2(t.y + 1.25 - (m.y + m.eye), Math.hypot(t.x - m.x, t.z - m.z)); m.fireT = 0; const h0 = O.G.hitMark; O.shoot(yaw, pitch); if (O.G.hitMark > 0) hits++; await w(250); }
    return { hits, ammo: m.ammo.ar5 };
  });
  await wait(500);
  const hp1 = await A.evaluate(() => __ol.G.me.hp);
  check('客戶端的子彈讓主機扣血', hp1 < hp0, { hp0, hp1, ...shotB });
  // 7. 主機開槍打客戶端：主機判定、客戶端從快照看到血量與中彈方向
  const hb0 = await B.evaluate(() => __ol.G.me.hp);
  await A.evaluate(async () => {
    const O = __ol, m = O.G.me, t = O.G.agents.find(a => a.remote), w = ms => new Promise(f => setTimeout(f, ms));
    t.armor = 0; O.giveWeapon('ar5'); await w(800);
    for (let i = 0; i < 2; i++) { m.burst = 0; m.fireT = 0; O.shoot(Math.atan2(t.x - m.x, t.z - m.z), Math.atan2(t.y + 1.25 - (m.y + m.eye), Math.hypot(t.x - m.x, t.z - m.z))); await w(250); }
  });
  await wait(500);
  const hb1 = await B.evaluate(() => ({ hp: __ol.G.me.hp, dmgT: __ol.G.dmgT }));
  check('主機的子彈讓客戶端扣血', hb1.hp < hb0, { hb0, ...hb1 });
  // 8. 擊殺：主機把客戶端打死，客戶端看到自己陣亡、擊殺列
  await A.evaluate(async () => {
    const O = __ol, m = O.G.me, t = O.G.agents.find(a => a.remote), w = ms => new Promise(f => setTimeout(f, ms));
    t.hp = 5; t.armor = 0;
    for (let i = 0; i < 6 && t.alive; i++) { m.burst = 0; m.fireT = 0; O.shoot(Math.atan2(t.x - m.x, t.z - m.z), Math.atan2(t.y + 1.25 - (m.y + m.eye), Math.hypot(t.x - m.x, t.z - m.z))); await w(200); }
  });
  await until(B, () => !__ol.G.me.alive, null, 5000).catch(() => {});
  const dead = await B.evaluate(() => ({ alive: __ol.G.me.alive, feed: __ol.G.feed.map(f => `${f.killer}>${f.victim}`), deaths: __ol.G.me.deaths }));
  check('客戶端陣亡、擊殺列有這筆', !dead.alive && dead.feed.some(f => f === '甲>乙'), dead);
  // 9. 守方全滅 → 回合結束、下一回合客戶端復活並回到出生點
  await until(A, () => __ol.G.phase === 'post' || __ol.G.round === 2, null, 8000).catch(() => {});
  await until(B, () => __ol.G.round === 2 && __ol.G.me.alive, null, 15000).catch(() => {});
  const r2 = await B.evaluate(() => ({ round: __ol.G.round, alive: __ol.G.me.alive, score: __ol.G.score, hist: __ol.G.history.map(h => h.why), phase: __ol.G.phase }));
  check('下一回合客戶端復活、比分同步', r2.round === 2 && r2.alive && r2.score[0] === 1, r2);
  // 10. 購買：客戶端買 AR5，主機扣錢、客戶端拿到槍
  const buy = await B.evaluate(async () => { const O = __ol, m = O.G.me, w = ms => new Promise(f => setTimeout(f, ms)); m.money; const money0 = m.money; O.G.canBuy = true; const ok = O.buyNet?.('v11'); await w(800); return { money0, money1: m.money, primary: m.primary, cur: m.cur }; });
  check('客戶端購買：主機扣錢、拿到 V11', buy.primary === 'v11' && buy.money1 < buy.money0, buy);
  // 11. 斷線由電腦接手（30 秒）
  if (!QUICK) {
    await B.close();
    await until(A, () => __ol.G.agents.some(a => a.name !== '乙' && a.team === 1 && a.bot && a.i === __ol.G.agents.findIndex(x => x.i === a.i)) && !__ol.G.agents.some(a => a.remote), null, 45000).catch(() => {});
    const after = await A.evaluate(() => __ol.G.agents.map(a => `${a.name}${a.bot ? 'b' : a.remote ? 'R' : ''}`));
    check('客戶端斷線 30 秒後由電腦接手', !after.some(s => s.endsWith('R')), after);
  }
  // 12. 房主離開：另一個玩家回到房間
  const C = QUICK ? B : await page('C');
  if (!QUICK) {
    await C.click('[data-tab=net]'); await C.fill('#n-name', '丙'); await C.fill('#n-code', code); await C.click('#n-go');
    await until(C, () => __ol.NET.status === 'in');
    await C.click('.n-side[data-side=def]');
    await until(C, () => __ol.SYNC.role === 'client' && __ol.G.me, null, 10000);
    check('比賽中加入：接手守方的電腦席位', await C.evaluate(() => __ol.G.me.team === 1));
    await until(A, () => __ol.G.agents.some(a => a.remote), null, 5000).catch(() => {});
  }
  await A.evaluate(() => __ol.net.leave());
  await until(C, () => !__ol.SYNC.role, null, 8000).catch(() => {});
  const back = await C.evaluate(() => ({ role: __ol.SYNC.role, host: __ol.NET.isHost, phase: __ol.NET.phase, tab: document.querySelector('.pn.main')?.dataset.tab, err: document.querySelector('.n-err')?.textContent }));
  check('房主離開：其他人回到房間、成為新房主', !back.role && back.host && back.phase === 'lobby' && back.tab === 'net', back);
} catch (e) { check('流程跑完', false, String(e.stack || e).split('\n').slice(0, 4).join(' | ')); } finally {
  check('沒有頁面錯誤', !errs.length, errs.slice(0, 6));
  await b.close(); ochre.close(); wsSrv.close(); await srv.close();
  console.log(fails ? `未通過 ${fails} 項` : '全部通過');
  process.exit(fails ? 1 : 0);
}
