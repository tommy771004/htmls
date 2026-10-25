// 第九部曲 AI（69-v9-ai.js）的驗收：E 打招呼與挑釁、槍聲打斷對話、目擊路人舉手機拍照（拍完才報案、被嚇跑就取消）、
// 燒胎時有人拍、警察攔民車徵用（沒有警笛）、車門掩護（躲到警車另一側輪流探身）、甩掉通緝後的便衣尾隨（跟住、看到犯罪就 2 星、跟丟放棄）
// 用法：node tools/check-ai.mjs [html]（預設 web/260-neon-nightcity.html）
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = resolve(process.argv[2] || resolve(root, '../../web/260-neon-nightcity.html'));
let failed = 0;
function check(cond, msg) { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) failed++; }
const { browser, page, log } = await open(htmlPath, { w: 1280, h: 800 });
async function sec(title, fn, arg) {
  console.log(title);
  try { return await page.evaluate(fn, arg); } catch (e) { check(false, `執行失敗：${String(e.message || e).split('\n').slice(0, 4).join(' ← ')}`); return null; }
}
await page.evaluate(() => {
  const N = window.__nc;
  N.gta.god.on = true;
  window.__t = {
    step(n, fn) { for (let i = 0; i < n; i++) { if (fn) fn(i); try { N.step(1 / 60); } catch (e) { throw new Error(e.stack.split('\n').slice(0, 4).join(' ← ')); } } },
    keys(o) { for (const k of ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space', 'KeyF']) N.keys[k] = !!o[k]; },
    calm() { N.gta.wanted.set(0); N.gta.ai.tailDrop(); N.gta.wanted.W.spawnT = 999; N.gta.wanted.W.bangT = -99; },   // bangT：槍聲是真實時間，快轉時前一段的槍聲還算剛響
    // 找一個在走路的路人，把玩家放到他身邊 d 公尺（站在人行道上同一側）
    nearPed(d = 1.6, skip = []) {
      N.walk();
      for (let k = 0; k < N.pedState.length; k++) {
        const ps = N.pedState[k], p = N.peds.people[k];
        if (skip.includes(k) || ps.out || ps.down > 0 || ps.fsm || ps.panic > 0) continue;
        const o = N.col.collide(p.x + d, p.z, .32);
        if (Math.hypot(o.x - p.x - d, o.z - p.z) > .05) continue;
        N.tp(p.x + d, p.z, -Math.PI / 2); N.step(1 / 60);
        return k;
      }
      return -1;
    },
  };
});

try {
  const talk = await sec('E 打招呼、挑釁', () => {
    const N = window.__nc, T = window.__t, A = N.gta.ai, o = {};
    T.calm();
    const k = T.nearPed(1.6); o.k = k;
    if (k < 0) return o;
    N.pedState[k].tough = false;
    o.ctx0 = N.ctx();
    N.act(); T.step(2);
    o.greet = A.ped(k).fsm; o.say0 = A.says().slice();
    T.step(60);
    o.say1 = A.says().slice(); o.ctx1 = N.ctx();
    const r = Math.random; Math.random = () => .9;   // 不是跑開的那一半：跟上來嗆
    N.act(); Math.random = r; T.step(2);
    o.heckle = A.ped(k).fsm;
    N.player.x += 6; T.step(90);   // 走開：他跟上來
    const p = A.ped(k); o.follow = +Math.hypot(p.x - N.player.x, p.z - N.player.z).toFixed(1);
    T.step(60 * 9); o.after = A.ped(k).fsm;
    // 脾氣差的：挑釁就動手
    const k2 = T.nearPed(1.6, [k]); o.k2 = k2;
    if (k2 >= 0) { N.pedState[k2].tough = true; N.gta.ai.greet(k2); T.step(30); N.gta.ai.heckle(k2); T.step(2); o.tough = A.ped(k2).fsm; N.pedState[k2].fsm = null; N.pedState[k2].tough = false; }
    // 對話中聽到槍聲：跑開
    const k3 = T.nearPed(1.6, [k, k2]); o.k3 = k3;
    if (k3 >= 0) { N.gta.ai.greet(k3); T.step(10); N.gta.wanted.crime('shots', N.player.x + 30, N.player.z); T.step(3); o.bang = { fsm: A.ped(k3).fsm, panic: N.pedState[k3].panic > 0 }; }
    T.calm();
    return o;
  });
  if (talk) {
    check(talk.k >= 0 && /打招呼/.test(talk.ctx0 || ''), `走到路人旁邊出現「E 打招呼」 ${talk.ctx0}`);
    check(talk.greet === 'talk' && talk.say0.length === 1, `按 E：路人停下來、頭上出現自己的話 ${JSON.stringify(talk.say0)}`);
    check(talk.say1.length === 2 && /挑釁/.test(talk.ctx1 || ''), `路人回一句，提示換成「E 挑釁」 ${JSON.stringify(talk.say1)} ${talk.ctx1}`);
    check(talk.heckle === 'heckle' && talk.follow < 4, `挑釁（不是跑開的那一半）：跟上來嗆，離玩家 ${talk.follow} m`);
    check(talk.after === null, `嗆 8 秒後回去走路 ${talk.after}`);
    check(talk.tough === 'fight', `脾氣差的被挑釁就動手 ${talk.tough}`);
    check(talk.bang && talk.bang.fsm === null && talk.bang.panic, `對話中聽到槍聲就跑開 ${JSON.stringify(talk.bang)}`);
  }

  const snap = await sec('目擊路人拍照', async () => {
    const N = window.__nc, T = window.__t, A = N.gta.ai, W = N.gta.wanted.W, o = {};
    T.calm();
    // 玩家站在路人 9 m 外犯罪
    const k = T.nearPed(9); if (k < 0) return o;
    const s0 = A.stats.snap;
    N.gta.wanted.crime('jack', N.player.x, N.player.z);
    T.step(30);
    o.started = A.stats.snap - s0; o.reports = W.reports.length; o.fsm = A.ped(k).fsm;
    o.phone = A.ai.phones.some(h => h.visible);
    T.step(120);
    o.done = A.stats.snapDone > 0; o.starsMid = W.stars;
    // 報案的 3 秒是真實時間（69-police.js 的 W.reports 用 uTimeNow）：真的等 3 秒
    await new Promise(r => setTimeout(r, 3200)); T.step(3);
    o.stars = W.stars;
    // 再一次：拍完之前把拍的人撞倒，報案取消
    T.calm();
    const k2 = T.nearPed(9, [k]); if (k2 < 0) return o;
    const sc0 = A.stats.snapScared;
    N.gta.wanted.crime('jack', N.player.x, N.player.z);
    T.step(20);
    const r = A.ai.reps[A.ai.reps.length - 1];
    o.ks = r ? r.ks.length : 0;
    if (r) for (const j of r.ks) N.gta.v8.knock(j);
    T.step(5);
    o.scared = A.stats.snapScared - sc0; o.rep2 = W.reports.length;
    await new Promise(r => setTimeout(r, 3200)); T.step(3); o.stars2 = W.stars; o.heat2 = W.heat;
    T.calm();
    return o;
  });
  if (snap) {
    check(snap.started >= 1 && snap.reports === 1 && snap.fsm === 'snap', `犯罪：附近的路人舉手機（${snap.started} 人），報案排著 ${JSON.stringify({ r: snap.reports, fsm: snap.fsm })}`);
    check(snap.phone, '手上有手機');
    check(snap.done && snap.starsMid === 0, `2.4 秒拍完、還沒報案 ${JSON.stringify({ done: snap.done, stars: snap.starsMid })}`);
    check(snap.stars >= 1, `3 秒後報案成立 ${snap.stars} 星`);
    check(snap.ks >= 1 && snap.scared === 1 && snap.rep2 === 0 && snap.stars2 === 0 && snap.heat2 === 0, `拍的人在拍完前被撞倒：報案取消 ${JSON.stringify({ ks: snap.ks, scared: snap.scared, rep: snap.rep2, stars: snap.stars2, heat: snap.heat2 })}`);
  }

  const fun = await sec('燒胎時路人拍照', () => {
    const N = window.__nc, T = window.__t, A = N.gta.ai, o = {};
    T.calm();
    const k = T.nearPed(1.6); if (k < 0) return o;
    // 把車放到離這個路人最近的路口中央（路口通常比較空）
    const p = N.peds.people[k];
    let nd = null, bd = 1e9; for (const n of N.roads.nodes) { const d = Math.hypot(n.x - p.x, n.z - p.z); if (d > 10 && d < bd && !n.y) { bd = d; nd = n; } }
    N.drive(); const v = N.player.veh; N.gta.wreck.fix(v);
    v.x = nd.x; v.z = nd.z; v.vx = v.vz = 0; v.yr = 0; v.y = 0;
    const s0 = A.stats.snap;
    T.keys({ KeyW: true, Space: true }); T.step(60 * 6); T.keys({});
    o.burn = A.stats.snap - s0; o.d = +bd.toFixed(1);
    o.crime = N.gta.wanted.W.reports.length;
    T.calm();
    return o;
  });
  if (fun) check(fun.burn >= 1 && fun.crime === 0, `原地燒胎：${fun.burn} 個路人掏手機拍（不報案），路口離人 ${fun.d} m`);

  const jack = await sec('警察攔民車徵用', () => {
    const N = window.__nc, T = window.__t, A = N.gta.ai, Wt = N.gta.wanted, W = Wt.W, o = {};
    T.calm();
    // 找一台在路上開的民車，旁邊放一台停著的警車，等警員下車後把警車從出勤名單拿掉（警員沒車可開）
    N.drive();
    const tc = N.traffic.find(c => !/cop|md84|ambulance|fire|tow/.test(c.type) && !c.turn && !(c.y > 1) && c.v > 3);
    if (!tc) return o;
    const fx = Math.sin(tc.yaw), fz = Math.cos(tc.yaw), rx = fz, rz = -fx;
    Wt.set(2); W.spawnT = 999;
    const u = Wt.unit('car', { x: tc.x + rx * 9 - fx * 6, z: tc.z + rz * 9 - fz * 6, yaw: tc.yaw });
    const v = N.player.veh; v.x = tc.x - fx * 40; v.z = tc.z - fz * 40; v.yaw = tc.yaw; v.vx = v.vz = 0; v.y = 0;
    T.step(20);
    o.out = A.cops().filter(c => c.unit === W.units.indexOf(u)).length;
    W.units.splice(W.units.indexOf(u), 1);
    for (const c of Wt.W.cops) if (c.on) { c.x = tc.x + rx * 6; c.z = tc.z + rz * 6; }
    // 玩家車停在 40 m 外（開車模式），民車慢慢停下來
    const j0 = A.stats.jack;
    let saw = false;
    T.step(60 * 10, () => { if (A.cops().some(c => c.jack)) saw = true; if (A.stats.jack > j0) return; });
    o.saw = saw; o.jack = A.stats.jack - j0;
    const q = A.units().find(x => x.jack);
    o.unit = q || null; o.siren = A.sirenNear();
    T.calm();
    return o;
  });
  if (jack) {
    check(jack.out >= 1 && jack.saw, `警員下車、沒車可開時跑去攔民車 ${JSON.stringify({ out: jack.out, saw: jack.saw })}`);
    check(jack.jack >= 1 && jack.unit && jack.unit.quiet, `把駕駛拖下來、開那台車追（停下來就放警員下車） ${JSON.stringify(jack.unit)}`);
    check(jack.siren === 999, `徵用車沒有警笛 sirenNear=${jack.siren}`);
  }

  const cover = await sec('車門掩護', () => {
    const N = window.__nc, T = window.__t, A = N.gta.ai, Wt = N.gta.wanted, W = Wt.W, o = {};
    T.calm();
    // 玩家站在路口，警車停在 20 m 外的路上
    const n = N.roads.nodes.find(x => !x.y && x.out.length >= 3 && Math.hypot(x.x - N.player.x, x.z - N.player.z) < 600) || N.roads.nodes[0];
    const e = n.out[0].e, m = e.a === n ? e.b : e.a, L = Math.hypot(m.x - n.x, m.z - n.z), ux = (m.x - n.x) / L, uz = (m.z - n.z) / L;
    N.tp(n.x, n.z, 0);
    Wt.set(2); W.spawnT = 999;
    const yaw = Math.atan2(uz, -ux);   // 車身橫在路上，側面對著玩家
    const u = Wt.unit('car', { x: n.x + ux * 20, z: n.z + uz * 20, yaw });
    T.step(60 * 4);
    const cs = A.cops().filter(c => c.unit === W.units.indexOf(u));
    o.n = cs.length; o.covers = cs.map(c => c.cover);
    const sp = A.coverSpot(u.v, N.player.x, N.player.z);
    o.off = cs.map(c => +Math.hypot(c.x - sp[0], c.z - sp[1]).toFixed(2));
    // 掩護點在車子離玩家較遠的那一側
    o.far = Math.hypot(sp[0] - N.player.x, sp[1] - N.player.z) > Math.hypot(u.v.x - N.player.x, u.v.z - N.player.z);
    o.hold = !!u.hold;
    const seen = new Set(); T.step(60 * 4, () => { for (const c of A.cops()) if (c.cover) seen.add(c.cover); });
    o.phases = [...seen];
    // 玩家衝到 4 m 內：離開掩護
    N.player.x = u.v.x + (N.player.x - u.v.x) * .2; N.player.z = u.v.z + (N.player.z - u.v.z) * .2; T.step(3);
    o.left = A.cops().filter(c => c.unit === W.units.indexOf(u)).map(c => c.cover);
    T.calm();
    return o;
  });
  if (cover) {
    check(cover.n >= 1 && cover.covers.every(c => c), `警員下車後進入掩護 ${JSON.stringify(cover.covers)}`);
    check(cover.far && cover.off.every(d => d < .8), `躲在警車離玩家較遠的那一側 ${JSON.stringify(cover.off)}`);
    check(cover.hold, '警車在掩護期間不開走（hold）');
    check(cover.phases.includes('down') && cover.phases.includes('up'), `蹲下與探身輪流 ${JSON.stringify(cover.phases)}`);
    check(cover.left.every(c => !c), `玩家衝到 6 m 內就離開掩護 ${JSON.stringify(cover.left)}`);
  }

  const tail = await sec('便衣尾隨', () => {
    const N = window.__nc, T = window.__t, A = N.gta.ai, Wt = N.gta.wanted, W = Wt.W, o = {};
    T.calm();
    const n = N.roads.nodes.find(x => !x.y && x.out.length >= 3) || N.roads.nodes[0];
    N.tp(n.x, n.z, 0); N.drive(); const v = N.player.veh; v.x = n.x; v.z = n.z; v.vx = v.vz = 0; v.y = 0;
    o.start = A.tail(3);
    o.d0 = A.tailSt() && A.tailSt().d;
    T.step(60 * 25);
    const s = A.tailSt(); o.d1 = s && +s.d.toFixed(1); o.sirens = A.sirenNear();
    // 被它看到犯罪：直接 2 星，便衣車加入追捕
    Wt.crime('jack', v.x, v.z); T.step(2);
    o.stars = W.stars; o.unit = A.units().find(x => x.tail) || null;
    T.calm();
    // 再來一次：玩家跑到 400 m 外，8 秒後放棄
    A.tail(3); T.step(30);
    v.x += 420; T.step(60 * 9);
    const s2 = A.tailSt(); o.gave = !s2 || s2.leave;
    T.calm();
    return o;
  });
  if (tail) {
    check(tail.start && tail.d0 > 60, `甩掉通緝後便衣車從 ${tail.d0 && tail.d0.toFixed(0)} m 外出現`);
    check(tail.d1 > 12 && tail.d1 < 60 && tail.sirens === 999, `25 秒後跟在 ${tail.d1} m 外、沒有警笛`);
    check(tail.stars >= 2 && tail.unit && tail.unit.quiet, `被便衣車看到犯罪：直接 ${tail.stars} 星，便衣車加入追捕`);
    check(tail.gave, '跟丟 8 秒就放棄');
  }

  const vg = await sec('切換角色小劇場', () => {
    const N = window.__nc, T = window.__t, A = N.gta.ai, V = N.gta.vig, C = N.gta.crew, o = {};
    T.calm(); T.nearPed(30); N.walk();
    const to = (C.crew.cur + 1) % 3;
    C.sw(to); T.step(60 * 2.4);
    o.cur = C.crew.cur === to; o.on = !!V.st.on; o.anim = N.player.anim === (V.st.on && V.st.on.V.anim); o.says = A.says().slice();
    T.keys({ KeyW: true }); T.step(10); T.keys({});
    o.moved = V.st.on === null && !N.player.vig;
    // 有配角的那一齣（Kael 跟技師吵架）
    V.st.last = {}; const r = Math.random; Math.random = () => 0; V.start(1); Math.random = r;
    T.step(Math.ceil(60 * (V.SAY + 1.6)));
    o.npc = !!V.st.npc; o.says2 = A.says().slice();
    T.keys({ KeyW: true }); T.step(10); T.keys({});
    o.leave = !!(V.st.npc && V.st.npc.leave);
    V.end();
    return o;
  });
  if (vg) {
    check(vg.cur && vg.on && vg.anim, `Q 換人：降落時那位主角在做自己的事 ${JSON.stringify({ cur: vg.cur, on: vg.on, anim: vg.anim })}`);
    check(vg.says.length >= 1, `頭上一句台詞 ${JSON.stringify(vg.says)}`);
    check(vg.moved, '一動就結束');
    check(vg.npc && vg.says2.length >= 2, `有配角的那一齣：配角回話 ${JSON.stringify(vg.says2)}`);
    check(vg.leave, '結束後配角走開');
  }
} finally {
  check(log.pageerrors.length === 0, `沒有頁面錯誤 ${log.pageerrors.slice(0, 3).join(' | ')}`);
  await browser.close();
  console.log(failed ? `\n${failed} 項失敗` : '\n全部通過');
  process.exit(failed ? 1 : 0);
}
