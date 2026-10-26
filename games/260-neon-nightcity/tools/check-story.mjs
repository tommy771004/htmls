// 主線《一手爛牌》（69-w0-story.js）的驗收：新存檔從序章開始、操作羅莎；每一關用 __nc.story.skip() 一步步跳完，
// 檢查步驟都走得到、報酬與獎牌、首次完成的獎勵（戴恩解鎖、掃描器、E34 收進車庫）、轉盤鎖定、腳鐐超出範圍加星；兩種尺寸各截一張圖。
// 另外開一頁不帶 story（lib.mjs 預設 story=0）：照舊的「門禁」開場、五人都能切換。
// 用法：node tools/check-story.mjs [html]（預設 web/260-neon-nightcity.html）；SHOT=目錄 另存截圖
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { open } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = resolve(process.argv[2] || resolve(root, '../../web/260-neon-nightcity.html'));
const shotDir = process.env.SHOT || '';
if (shotDir) mkdirSync(shotDir, { recursive: true });
let failed = 0;
const FROM = process.env.FROM || 'P-1';
function check(cond, msg) { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) failed++; }
const helpers = () => {
  window.__t = {
    step(n) { for (let i = 0; i < n; i++) window.__nc.step(1 / 60); },
    // 一關跑到底：每一步先讓它跑一下（過場、傳送），再 skip；回傳走過的步驟
    sleep: ms => new Promise(r => setTimeout(r, ms)),
    // 黑場（60-venues.js 的 transition）是真實時間的 setTimeout：等它跑完
    async settle() { for (let i = 0; i < 20 && (document.getElementById('fade').classList.contains('on') || window.__nc.story.state().fading); i++) { await __t.sleep(120); __t.step(2); } },
    async run(id, max = 160) {
      const N = window.__nc, St = N.story, seen = [];
      for (let i = 0; i < max; i++) {
        await __t.settle();
        const s = St.state();
        if (!s.act || s.act.id !== id) break;
        if (seen[seen.length - 1] !== `${s.act.k}:${s.act.type}`) seen.push(`${s.act.k}:${s.act.type}`);
        __t.step(40);
        await __t.settle();
        const s2 = St.state();
        if (s2.act && s2.act.k === s.act.k) St.skip();
        __t.step(10);
        if (N.dialog.open) N.closeDialog();
      }
      __t.step(30);
      return seen;
    },
    dismiss() { const el = document.getElementById('heistDone'); el.classList.remove('on'); },
  };
};

async function pass(page, sec, id, extra) {
  return sec(`${id}`, async ([id, extra]) => {
    const N = window.__nc, St = N.story;
    __t.dismiss();
    const cash0 = N.motors.cash;
    if (!St.state().act || St.state().act.id !== id) St.go(id);
    await __t.settle(); __t.step(40);
    const steps = await __t.run(id);
    const s = St.state();
    return { steps, done: s.done.includes(id), m: s.m, cur: s.cur, pay: N.motors.cash - cash0, medal: s.medal[id], cast: s.cast, flags: s.flags, owned: N.motors.owned.slice(), retry: s.retry,
      x: extra === 'mon' ? St.mon() : null };
  }, [id, extra]);
}

for (const [w, h] of [[1440, 900], [390, 844]]) {
  console.log(`── ${w}×${h} ──`);
  const { browser, page, log } = await open(htmlPath, { w, h, touch: w < 600, query: '?story=1' });
  async function sec(title, fn, arg) {
    console.log(title);
    try { return await page.evaluate(fn, arg); } catch (e) { check(false, `執行失敗：${String(e.message || e).split('\n')[0]}`); return null; }
  }
  await page.evaluate(helpers);
  try {
    const b = await sec('開場：新存檔從序章開始、操作羅莎，其他人鎖著', () => {
      const N = window.__nc, St = N.story;
      const before = { quest: N.quest.n, cur: St.state().cur, obj: document.getElementById('objText').textContent };
      N.start(); __t.step(60);
      const s = St.state();
      return { ...before, act: s.act && s.act.id, card: s.card, kael: St.avail(1), dane: St.avail(St.DANE), rosa: St.avail(St.ROSA), why: St.why(1), title: document.getElementById('stCardT').textContent };
    });
    if (b) {
      check(b.cur === 'rosa' && b.quest === 6, `開場操作 ${b.cur}、門禁停在第 ${b.quest} 步（等 3-1）`);
      check(b.act === 'P-1' && b.card, `按進場直接開始 P-1，字卡「${b.title}」`);
      check(!b.kael && !b.dane && b.rosa, `序章只能操作羅莎（凱爾：${b.why}）`);
    }
    if (shotDir) await page.screenshot({ path: `${shotDir}/story-card-${w}.png` });
    // FROM=2-1：從這一關開始（前面的算完成）；預設跑完整條主線
    const all = await page.evaluate(() => window.__nc.story.ORDER.filter(id => window.__nc.story.M[id]));
    const order = all.slice(Math.max(0, all.indexOf(FROM)));
    const R = {};
    for (const id of order) {
      R[id] = await pass(page, sec, id, id === 'P-2' ? 'mon' : '');
      const r = R[id];
      if (!r) continue;
      check(r.done, `${id} 完成（${r.steps.join(' ')}），下一關 ${r.m}，報酬 $${r.pay.toLocaleString('en-US')}${r.medal != null ? `、獎牌 ${r.medal}` : ''}`);
      if (id === 'P-2' && shotDir) await page.screenshot({ path: `${shotDir}/story-p2-${w}.png` });
    }
    if (R['P-2']) check(R['P-2'].owned.includes('e34') && R['P-2'].pay >= 20000, `P-2：E34 收進車庫、報酬 ≥ $20,000`);
    if (R['1-1']) check(R['1-1'].cast.dane === 1 && R['1-1'].cur === 'dane', `1-1：操作戴恩、完成後戴恩解鎖`);
    if (R['1-3']) check(R['1-3'].flags.scan === 1 && R['1-3'].pay === 0, '1-3：劇情任務不給錢，解鎖警用掃描器');
    if (R['1-4']) check(R['1-4'].done && R['1-4'].pay >= 50000, `1-4：搶 BODEGA、甩掉警察（$${R['1-4'] && R['1-4'].pay}）`);
    if (R['2-3']) check(R['2-3'].flags.drive === 1 && R['2-3'].pay >= 100000, `2-3：炸開運鈔車、拿到硬碟（$${R['2-3'].pay}）`);
    if (R['2-4']) check(R['2-4'].cast.kael === 1, '2-4：躲進排水道、凱爾解鎖');
    if (R['2-6']) check(R['2-6'].flags.boat === 1 && R['2-6'].pay >= 200000, `2-6：追上霍利斯的快艇（$${R['2-6'].pay}）`);
    if (R['3-1']) check(R['3-1'].pay >= 20000 && R['3-1'].pay <= 30000 && R['3-1'].flags.vip === 1, `3-1：門禁照主線發錢（$${R['3-1'].pay}，不是 $250,000）`);
    if (R['3-5']) check(R['3-5'].flags.mv === 1 && R['3-5'].flags.fame >= 40, `3-5：MV 上片、名氣 ${R['3-5'].flags.fame}`);
    if (R['3-7']) check(R['3-7'].flags.home2 === 1, '3-7：買下安全屋');
    if (R['4-3']) check(R['4-3'].flags.monitor === 0, '4-3：腳鐐解除');
    if (R['4-4']) check(R['4-4'].flags.enf === 1 && R['4-4'].pay >= 200000, `4-4：搶到鎮暴裝甲車（$${R['4-4'].pay}）`);
    if (R['4-5']) check(R['4-5'].flags.bank === 1 && R['4-5'].pay >= 1000000, `4-5：搶完銀行，分贓加獎牌 $${R['4-5'].pay}`);
    if (R['5-2']) check(R['5-2'].cast.vance === 1 && R['5-2'].pay === 0, '5-2：劇情任務，范斯可以切換');
    if (R['5-3']) check(R['5-3'].flags.hangar === 1 && R['5-3'].pay >= 400000, `5-3：跳上貨機、落地撿回現金（$${R['5-3'].pay}）`);
    if (R['5-4']) check(R['5-4'].flags.heli === 1 && R['5-4'].pay >= 400000, `5-4：吊貨櫃撞穿工地、拿回證物箱（$${R['5-4'].pay}）`);
    if (R['5-6']) check(R['5-6'].cast.jax === 1 && R['5-6'].pay >= 200000, `5-6：賈克斯可以切換（$${R['5-6'].pay}）`);
    if (R['F-1']) check(R['F-1'].pay >= 2000000, `F-1：賭場金庫得手，金庫加獎牌 $${R['F-1'].pay}`);
    if (R['F-2']) check(R['F-2'].pay >= 400000, `F-2：雙人跳、甩掉 4 星（$${R['F-2'].pay}）`);
    if (R['F-3']) check(R['F-3'].m === 'F-4A' && R['F-3'].flags.route === 'A' && R['F-3'].pay === 0, `F-3：選了 ${R['F-3'].flags.route}，下一關 ${R['F-3'].m}`);
    if (R['F-4A']) check(R['F-4A'].m === 'end' && R['F-4A'].flags.end === 'A' && ['dane', 'vance', 'kael', 'jax'].every(k => R['F-4A'].cast[k] === 1), `F-4A：結局 A、下一關 ${R['F-4A'].m}、五人都能切換`);
    if (R['F-4B']) check(R['F-4B'].m === 'end' && R['F-4B'].flags.end === 'B' && R['F-4B'].flags.fame === 100, `F-4B：結局 B、下一關 ${R['F-4B'].m}、名氣 ${R['F-4B'].flags.fame}`);
    // 照搶案分贓算的任務（4-5、F-1）重玩時搶案本身照樣付錢，只看主線自己發的
    const split = await page.evaluate(() => Object.keys(window.__nc.story.M).filter(id => window.__nc.story.M[id].split));
    const rid = order.find(id => R[id] && R[id].pay > 0 && !split.includes(id));
    const re = rid && await sec('重玩：同樣的獎牌不再發錢', async id => {
      const N = window.__nc, St = N.story, cash0 = N.motors.cash;
      __t.dismiss(); St.go(id); await __t.settle(); __t.step(40); await __t.run(id);
      return { pay: N.motors.cash - cash0, m: St.state().m };
    }, rid);
    if (re) check(re.pay === 0, `重玩 ${rid}（已是金牌）不再發錢（$${re.pay}）`);
    // 跳步驟驗不到的：AI 真的會動
    const mech = all.includes('3-7') && await sec('第二～五章的機制：運鈔車、跳窗、快艇、門禁、籠子、MV、搶案、貨機、吊掛', async () => {
      const N = window.__nc, St = N.story, o = {};
      const toS = async (id, type) => { const St = window.__nc.story; __t.dismiss(); St.go(id); await __t.settle(); __t.step(40);
        for (let i = 0; i < 20; i++) { await __t.settle(); const s = St.state(); if (!s.act || s.act.type === type) break; St.skip(); __t.step(20); if (N.dialog.open) N.closeDialog(); }
        await __t.settle(); return St.act(); };
      // 2-2：運鈔車照路線開 20 秒，玩家每秒跟到車後 30 m（不會跟丟也不會起疑）
      let a = await toS('2-2', 'tail');
      if (a && a.truck) { const tk = a.truck, v = tk.v, x0 = v.x, z0 = v.z; for (let i = 0; i < 20; i++) { __t.step(60); if (v.dead) break; N.player.x = v.x - Math.sin(v.yaw) * 30; N.player.z = v.z - Math.cos(v.yaw) * 30; } o.truck = { moved: Math.round(Math.hypot(v.x - x0, v.z - z0)), sp: +Math.hypot(v.vx, v.vz).toFixed(1), route: tk.route ? tk.route.length : 0, type: St.state().act && St.state().act.type, retry: St.state().retry }; }
      a = await toS('2-5', 'away');
      if (a) { __t.step(180); o.win = { air: !!N.player.air3, hp: N.gta.life ? N.gta.life.hp : null, type: St.state().act && St.state().act.type, foes: a.motel ? 1 : 0 }; }
      a = await toS('2-6', 'chase');
      if (a && a.boat) { const v = a.boat, p0 = Math.hypot(v.x - N.player.x, v.z - N.player.z); __t.step(480); o.boat = { d0: Math.round(p0), d1: Math.round(Math.hypot(v.x - (N.player.veh || N.player).x, v.z - (N.player.veh || N.player).z)), sp: +Math.hypot(v.vx, v.vz).toFixed(1), type: St.state().act && St.state().act.type }; }
      // 3-1：真的走一次門禁（Marlo → Juno → Marlo），絨布繩撤開
      const pick = t => { const b = [...document.querySelectorAll('#dlgOpts button')].find(b => b.textContent.includes(t)); if (b) b.click(); return !!b; };
      a = await toS('3-1', 'quest');
      if (a) { const q = [N.quest.n]; N.talk.marlo(); pick('要怎樣才能上名單'); pick('記住了'); q.push(N.quest.n); N.talk.juno(); pick('我只想進去聽一場'); pick('收下火柴盒'); q.push(N.quest.n); N.talk.marlo(); pick('謝了'); q.push(N.quest.n); if (N.dialog.open) N.closeDialog(); o.door = q; }
      // 3-3：籠子在、對手在籠子裡，走出去會被推回來
      a = await toS('3-3', 'fight');
      if (a && a.cage) { const c = a.cage, P = N.player; P.x = c.x + 9; P.z = c.z; __t.step(3); o.cage = { d: +Math.hypot(P.x - c.x, P.z - c.z).toFixed(2), type: St.state().act && St.state().act.type }; }
      // 4-5：搶案的角色表換成羅莎、凱爾、戴恩，大廳是塞拉斯與娜迪亞；收尾後還原
      a = await toS('4-5', 'heist');
      if (a) { const H = N.gta.heist; o.h45 = { st: H.heist.st, who: H.heist.who && H.heist.who.join() }; St.fail('測試'); __t.step(5); if (N.dialog.open) N.closeDialog(); o.h45.after = H.heist.st; o.h45.who2 = H.heist.who || null; }
      // 3-5：檢查點路線與時間
      a = await toS('3-5', 'cp');
      if (a && a.cur) o.cp = { n: a.cur.pts ? a.cur.pts.length : 0, lim: a.cur.lim };
      // 5-3：貨機沿跑道往西滑跑；車貼著後貨艙門、速度對上就跳過去；之後從空中落下
      a = await toS('5-3', 'plane');
      if (a && a.car) {
        const P = N.props.air.P, x0 = P.x; __t.step(900);
        o.plane = { st: P.st, dx: Math.round(x0 - P.x), v: +P.v.toFixed(1), drive: N.player.veh === a.car };
        const v = a.car; for (let i = 0; i < 60; i++) { const d = St.ch5.planeDoor(); v.x = d.x; v.z = d.z; v.vx = d.vx; v.vz = d.vz; __t.step(1); }
        o.plane.after = St.state().act && St.state().act.type; o.plane.st2 = P.st;
      }
      a = await toS('5-3', 'sky');
      if (a) { const y0 = N.player.y; __t.step(120); o.sky = { kind: N.player.air3 && N.player.air3.kind, fell: Math.round(y0 - N.player.y), h: Math.round(y0) }; }
      // 5-4：走到直升機旁按 F 登機，停在貨櫃正上方就掛上；飛走時貨櫃跟著（不超過繩長）
      a = await toS('5-4', 'sling');
      if (a && a.heli && a.sling) {
        const h = a.heli, S = a.sling; N.tp(h.x + 3, h.z, 0); __t.step(2); o.sling = { ctx: N.ctx() }; N.act(); __t.step(5); o.sling.in = N.player.veh === h;
        h.x = S.x; h.z = S.z; h.y = S.y + 10; h.vx = h.vz = h.vy = 0; __t.step(30); o.sling.on = S.on;
        for (let i = 0; i < 90; i++) { h.x += .25; h.vx = 15; __t.step(1); }
        o.sling.d = +Math.hypot(h.x - S.x, h.y - 1.2 - S.y, h.z - S.z).toFixed(1); o.sling.moved = Math.round(Math.hypot(S.x - h.x + 22.5, S.z - h.z)); o.sling.type = St.state().act && St.state().act.type;
      }
      return o;
    });
    if (mech) {
      check(mech.door && mech.door.join() === '0,1,2,3', `3-1 門禁一步步走：quest ${mech.door && mech.door.join(' → ')}`);
      check(mech.cage && mech.cage.d < 5 && mech.cage.type === 'fight', `3-3 籠子把人推回圈內（離中心 ${mech.cage && mech.cage.d} m）`);
      if (mech.h45) check(mech.h45.st === 'go' && mech.h45.who && mech.h45.who.split(',').length === 3 && mech.h45.after === 'off' && !mech.h45.who2, `4-5 搶案從銀行門口開始、失敗後收掉（${JSON.stringify(mech.h45)}）`);
      if (mech.plane) check(mech.plane.dx > 100 && mech.plane.drive && mech.plane.after !== 'plane' && mech.plane.st2 === 'roll', `5-3 貨機滑跑 15 秒 ${mech.plane.dx} m、貼著艙門就跳上去（${JSON.stringify(mech.plane)}）`);
      if (mech.sky) check(mech.sky.kind === 'fall' && mech.sky.fell > 20 && mech.sky.h > 300, `5-3 從 ${mech.sky.h} m 自由落體（2 秒掉了 ${mech.sky.fell} m）`);
      if (mech.sling) check(/登機/.test(mech.sling.ctx || '') && mech.sling.in && mech.sling.on && mech.sling.d <= 12.6 && mech.sling.type === 'smash', `5-4 登機、掛上貨櫃、飛走時貨櫃跟著（${JSON.stringify(mech.sling)}）`);
      check(mech.cp && mech.cp.n >= 4 && mech.cp.lim > 30, `3-5 MV 的檢查點 ${mech.cp && mech.cp.n} 個、限時 ${mech.cp && mech.cp.lim} 秒`);
      check(mech.truck && mech.truck.moved > 20 && (mech.truck.type === 'tail' || mech.truck.type === 'truck'), `2-2 的運鈔車 20 秒開了 ${mech.truck && mech.truck.moved} m（> 20 m：車流裡會停紅燈，卡住的話是 0；當下時速 ${mech.truck && Math.round(mech.truck.sp * 3.6)}，還在跟車：${mech.truck && mech.truck.type}${mech.truck && mech.truck.retry ? '；失敗：' + JSON.stringify(mech.truck.retry) : ''}）`);
      check(mech.win && !mech.win.air && mech.win.type === 'away', `2-5 跳窗落地、在逃（${JSON.stringify(mech.win)}）`);
      check(mech.boat && mech.boat.sp > 3, `2-6 霍利斯的快艇在跑（${JSON.stringify(mech.boat)}）`);
    }
    // 終章：跳步驟驗不到的
    const fin = all.includes('F-4B') && await sec('終章的機制：雙人跳、塔頂直播與六星、重玩 F-3 改走另一條路', async () => {
      const N = window.__nc, St = N.story, o = {};
      const toS = async (id, type) => { __t.dismiss(); St.go(id); await __t.settle(); __t.step(40);
        for (let i = 0; i < 20; i++) { await __t.settle(); const s = St.state(); if (!s.act || s.act.type === type) break; St.skip(); __t.step(20); if (N.dialog.open) N.closeDialog(); }
        await __t.settle(); return St.act(); };
      const life = () => N.gta.life.hp + N.gta.life.armor;
      // F-2 上樓：打完樓下的人進頂層公寓（69-safehouse 的 loft 場館），按 E 上夾層、走到西側窗邊才接到陽台
      let a = await toS('F-2', 'loft');
      if (a) { const A = N.gta.apt, p0 = A.APT.loft.up.path[0]; o.loft = { where: N.player.where, t: Math.round(a.cur.t) };
        N.player.x = p0[0]; N.player.z = p0[2]; __t.step(5); A.climb('loft', 1); for (let i = 0; i < 400 && N.player.ride; i++) __t.step(5);
        o.loft.y = +N.player.y.toFixed(2); N.player.x = -1.4; N.player.z = -2.4; __t.step(20); await __t.settle(); o.loft.next = St.state().act && St.state().act.type; }
      // F-2：從樓頂的高度跳下去，落進泳池不扣血
      a = await toS('F-2', 'leap');
      if (a) { const hp0 = life(); for (let i = 0; i < 80 && !a.leapDone; i++) { __t.step(10); if (a.leapHold && a.leapHold.out) await new Promise(r => setTimeout(r, 150)); }
        await new Promise(r => setTimeout(r, 300)); const L = a.leap;   // 黑場淡出完（fading 期間 transition 不會動）
        o.leap = { done: a.leapDone, hurt: hp0 - life(), d: a.leapMiss ?? -1, h: L ? Math.round(L.y0 - L.wy) : 0, roof: !!(L && L.roof), balc: !!(L && L.balc), down: L ? Math.round(L.by - N.player.y) : 0, air: !!N.player.air3, type: St.state().act && St.state().act.type }; }
      // F-4A：聯邦專機停在交帳點西邊的草地，帶五個碰撞圓；任務收尾收掉
      a = await toS('F-4A', 'run');
      if (a) { const J = St.fin.jet(), d0 = N.col.dynMore.length; St.fail('測試'); __t.step(5); if (N.dialog.open) N.closeDialog(); N.gta.wanted.clear('reset');
        o.jet = { ...J, gone: d0 - N.col.dynMore.length, after: St.fin.jet() }; }
      // F-4B：站在 202 m 的屋頂上不掉下去；六星（第六顆星亮著），直升機飛在屋頂以上
      a = await toS('F-4B', 'stream');
      if (a) { __t.step(600); const W = N.gta.wanted.W, el = document.getElementById('wanted');
        o.roof = { y: Math.round(N.player.y), deck: St.fin.towerRoof().y, stars: W.stars, six: el.classList.contains('six') && el.children[5].classList.contains('lit'), heli: W.heli && !W.heli.fall ? Math.round(W.heli.y) : null, p: +((a.cur && a.cur.p) || 0).toFixed(3), type: St.state().act && St.state().act.type };
        // 塔頂的步兵：第一波 18 秒後從直梯上來，站在 202 m 的樓板上；瞄準開槍打得到
        __t.step(600); const fs = St.fin.roofFoes(); o.roof.foes = fs.length; o.roof.fy = fs.length ? Math.max(...fs.map(f => Math.abs(f.y - o.roof.deck))) : -1;
        if (fs.length) { const f = fs[0], hp0 = f.hp, P = N.player; N.gta.equip('rifle', true); __t.step(30);
          for (let i = 0; i < 12; i++) { const g = St.fin.roofFoes()[0]; if (!g) break; N.camAt(P.x, P.y + 1.6, P.z, g.x, g.y + 1.2, g.z); __t.step(2); N.gta.shoot(); __t.step(8); }
          N.camAt(); const g = St.fin.roofFoes(); o.roof.hit = g.length < fs.length || (g[0] ? g[0].hp < hp0 : true); }
        St.fail('測試'); __t.step(5); if (N.dialog.open) N.closeDialog(); N.gta.wanted.clear('reset'); o.roof.six2 = W.six || 0; }
      // 重玩 F-3（主線已經走完）選 B：下一關換成 F-4B
      St.st().m = 'end'; St.st().retry = null; St.fin.start('F-3'); await __t.settle();
      for (let i = 0; i < 40; i++) { await __t.settle(); const s = St.state(); if (!s.act) break;
        if (s.act.type === 'choose') { __t.step(5); const b = [...document.querySelectorAll('#dlgOpts button')].find(b => b.textContent.includes('B · ')); if (b) b.click(); } else St.skip();
        __t.step(20); }
      __t.dismiss();
      o.re = { m: St.state().m, route: St.state().flags.route, rows: St.fin.phone().length, repT: St.fin.repT(), posters: St.fin.posters() };
      // 母親家：買回房子（扣 $480,000、播過場），片尾台詞跟著換
      const H = St.fin.house, A0 = H.lines().A[0];
      N.motors.cash = Math.max(N.motors.cash, H.P + 1000); const c0 = N.motors.cash;
      o.house = { ok: H.buy() };
      for (let i = 0; i < 20; i++) { await __t.settle(); const s = St.state(); if (!s.act) break; St.skip(); __t.step(20); if (N.dialog.open) N.closeDialog(); }
      __t.dismiss();
      Object.assign(o.house, { paid: c0 - N.motors.cash, flag: St.state().flags.house, again: H.buy(), line: H.lines().A[0] !== A0, act: !!St.state().act });
      return o;
    });
    if (fin) {
      const L = fin.leap, R2 = fin.roof, E = fin.re, Lo = fin.loft, Jt = fin.jet;
      check(Lo && Lo.where === 'loft' && Lo.t > 50 && Math.abs(Lo.y - 3.85) < .05 && Lo.next === 'card', `F-2 上樓：進了頂層公寓、倒數 ${Lo && Lo.t} 秒、旋轉樓梯上到夾層 ${Lo && Lo.y} m、走到窗邊接下一步 ${Lo && Lo.next}`);
      check(Jt && Jt.dyn === 5 && Jt.gone === 5 && Jt.after === null, `F-4A：聯邦專機停在交帳點旁（${Jt && Math.round(Jt.x)}, ${Jt && Math.round(Jt.z)}），五個碰撞圓、收尾收掉（${JSON.stringify(Jt)}）`);
      check(L && L.done && L.hurt <= 0 && L.d >= 0 && L.d < 1.5 && L.h >= 12 && L.balc && (!L.roof || L.down > 4), `F-2：從陽台 ${L && L.h} m 跳下來落進${L && L.roof ? '隔壁樓頂的' : ''}泳池、沒扣血，再帶到樓下（${JSON.stringify(L)}）`);
      check(R2 && Math.abs(R2.y - R2.deck) < 2 && R2.stars === 6 && R2.six && (R2.heli === null || R2.heli > R2.deck) && R2.p > .05 && R2.six2 === 0 && R2.foes >= 1 && R2.fy >= 0 && R2.fy < .5 && R2.hit, `F-4B：塔頂 ${R2 && R2.y} m 守著、六星、直升機 ${R2 && R2.heli} m、上傳 ${R2 && Math.round(R2.p * 100)}%、爬上來的步兵 ${R2 && R2.foes} 個站在樓板上、打得到（${JSON.stringify(R2)}）`);
      check(E.m === 'F-4B' && E.route === 'B', `重玩 F-3 改選 B：下一關 ${E.m}`);
      const Hs = fin.house;
      check(Hs && Hs.ok && Hs.paid === 480000 && Hs.flag === 1 && !Hs.again && Hs.line && !Hs.act, `母親家：買回房子扣 $${Hs && Hs.paid}、過場播完、不能再買、片尾台詞換了（${JSON.stringify(Hs)}）`);
      check(E.rows >= 30 && E.repT === 1.5 && E.posters >= 5, `手機「主線任務」${E.rows} 列、結局 B 報警 ${E.repT} 秒、通緝海報 ${E.posters} 塊`);
    }
    const mon = await sec('腳鐐：羅莎走出範圍，30 秒後加 1 星', () => {
      const N = window.__nc, St = N.story;
      __t.dismiss(); N.gta.wanted.clear('reset');
      St.go('1-5', false); St.st().flags.monitor = 1;   // 跑過 4-3 的話腳鐐已經解了，這裡裝回去
      if (St.state().cur !== 'rosa') N.gta.crew.load(St.ROSA);
      const f = St.far(); N.tp(f.x, f.z); __t.step(30);
      const m0 = St.mon(), chip = document.getElementById('stChipT').textContent;
      __t.step(60 * 32);
      return { m0, chip, stars: N.gta.wanted.W ? N.gta.wanted.W.stars : null, m1: St.mon(), cur: St.state().cur };
    });
    if (mon) check(mon.m0.on && mon.m0.d > 380 && (mon.stars === null || mon.stars >= 1), `離國宅 ${mon.m0.d} m：「${mon.chip}」→ 通緝 ${mon.stars} 星`);
  } catch (e) { check(false, String(e.message || e)); }
  check(!log.pageerrors.length, `沒有頁面錯誤${log.pageerrors.length ? '：' + log.pageerrors.slice(0, 3).join(' | ') : ''}`);
  check(!log.errors.length, `沒有 console.error${log.errors.length ? '：' + log.errors.slice(0, 3).join(' | ') : ''}`);
  await browser.close();
}

{
  console.log('── story=0（lib.mjs 預設）──');
  const { browser, page, log } = await open(htmlPath, { w: 1280, h: 800 });
  const r = await page.evaluate(() => { const N = window.__nc; N.start(); for (let i = 0; i < 30; i++) N.step(1 / 60); return { quest: N.quest.n, on: N.story.on(), act: !!N.story.act(), all: [0, 1, 2, 3, 4].every(i => N.story.avail(i)), obj: document.getElementById('objText').textContent }; });
  check(r.quest === 0 && !r.on && !r.act && r.all, `照舊的開場：「${r.obj}」、主線關掉、五人都能切換`);
  check(!log.pageerrors.length && !log.errors.length, `沒有錯誤${[...log.pageerrors, ...log.errors].slice(0, 3).join(' | ')}`);
  await browser.close();
}
console.log(failed ? `✗ ${failed} 項沒過` : '✓ 全部通過');
process.exit(failed ? 1 : 0);
