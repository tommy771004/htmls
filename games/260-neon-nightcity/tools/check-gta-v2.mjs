// neon_nightcity_gta_v_2.md 補完項目的驗收：車輛級距、損壞階段、單顆輪胎、撞人、警察戰術、搶劫 B 線與駭客小遊戲、榴彈發射器、逃脫載具
// 用法：node tools/check-gta-v2.mjs [html]（預設 web/260-neon-nightcity.html）
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = resolve(process.argv[2] || resolve(root, '../../web/260-neon-nightcity.html'));
let failed = 0;
function check(cond, msg) { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) failed++; }
const ev = (page, fn, arg) => page.evaluate(fn, arg);

const { browser, page, log } = await open(htmlPath, { w: 1280, h: 800 });
try {
  await ev(page, () => window.__nc.start());
  await page.waitForTimeout(800);

  console.log('1. 車輛級距');
  const c1 = await ev(page, () => {
    const N = window.__nc, W = N.gta.wreck, k = N.vehicles[0];
    // 照級距表的加速度與極速算出的 vmax 參數，代回推力＝阻力，終端速度要等於表上的 km/h
    const term = Object.fromEntries(Object.entries(W.VCLASS).map(([id, C]) => {
      const vm = W.vmaxFor(C.kmh, C.acc);
      let lo = 0, hi = vm;
      for (let i = 0; i < 60; i++) { const v = (lo + hi) / 2; if (C.acc * (1 - (v / vm) ** 2) > .12 * v + .35) lo = v; else hi = v; }
      return [id, Math.round(lo * 3.6)];
    }));
    return { term, cls: k.cls, mass: k.mass, hpMax: k.hpMax, hb: +k.hbGrip.toFixed(2) };
  });
  for (const [id, kmh] of Object.entries(c1.term)) check(true, `${id} 終端速度 ${kmh} km/h`);
  check(Object.entries(c1.term).every(([id, kmh]) => Math.abs(kmh - { super: 240, muscle: 205, sedan: 180, bike: 225, heavy: 130, police: 215, tank: 75 }[id]) <= 1), '終端速度和級距表一致');
  check(c1.cls && c1.mass > 0 && c1.hpMax > 0, `座駕有級距：${JSON.stringify(c1)}`);

  console.log('2. 損壞階段');
  const c2 = await ev(page, () => {
    const N = window.__nc, W = N.gta.wreck, v = N.vehicles[0], H = W.hpMax(v), out = {};
    N.drive();
    v.hp = H * .65; N.step(1 / 60); out.glass = v.glass;
    v.hp = H * .35; for (let i = 0; i < 30; i++) N.step(1 / 60); out.engK = v.engK;
    v.hp = H * .1; N.step(1 / 60); out.bail = v.bail;
    const h0 = v.hp; for (let i = 0; i < 60; i++) N.step(1 / 60); out.burn = +(h0 - v.hp).toFixed(1);
    W.fix(v); out.fixed = { hp: v.hp === v.hpMax, glass: v.glass, bail: v.bail, engK: v.engK };
    out.R = W.BOOM_R;
    return out;
  });
  check(c2.glass === 1, '70% 以下車窗碎掉');
  check(c2.engK === .75 || c2.engK === 0, `40% 以下動力 ×0.75 或熄火（engK ${c2.engK}）`);
  check(c2.bail === 1, '15% 以下起火');
  check(c2.burn > 20 && c2.burn < 30, `起火每秒扣約 25（實際 ${c2.burn}）`);
  check(c2.fixed.hp && !c2.fixed.glass && !c2.fixed.bail && c2.fixed.engK === 1, `修車全部回復 ${JSON.stringify(c2.fixed)}`);
  check(c2.R === 12, '爆炸半徑 12 m');

  console.log('3. 單顆輪胎');
  const c3 = await ev(page, () => {
    const N = window.__nc, W = N.gta.wreck, v = N.vehicles[0], out = {};
    W.fix(v);
    const vm0 = v.vmax, t = W.tires(v), i = t.findIndex(o => o.front && o.x > 0);
    out.n = t.length;
    W.shootTire(v, i); out.after1 = W.tires(v)[i].hp;
    W.shootTire(v, i); out.flat = W.tires(v)[i].flat;
    out.vk = +(v.vmax / vm0).toFixed(3); out.pull = v.flatYr; out.sag = [v.sagR, v.sagP];
    W.fix(v); out.back = v.vmax === vm0 && !v.flat;
    return out;
  });
  check(c3.n === 4, `四顆輪胎（${c3.n}）`);
  check(c3.after1 === 22, `一發 28 傷害後剩 22（${c3.after1}）`);
  check(c3.flat === 1 && c3.vk === .85, `第二發爆胎，極速 ×0.85（${c3.vk}）`);
  check(c3.pull > 0 && c3.sag[0] < 0, `往破胎側偏、車身傾斜 ${JSON.stringify(c3)}`);
  check(c3.back, '修車輪胎回復');

  console.log('4. 開車撞人');
  const c4 = await ev(page, () => {
    const N = window.__nc, W = N.gta.wreck, ps = N.pedState;
    const pick = () => ps.findIndex(s => !(s.down > 0) && !s.out && !s.fsm);
    const a = pick(), slow = W.ram(a, 6), fa = W.ped(a);
    const b = pick(), fast = W.ram(b, 15), fb = W.ped(b);
    let top = 0; for (let i = 0; i < 240; i++) { N.step(1 / 60); top = Math.max(top, (W.ped(b).fly || { y: 0 }).y); }
    const land = W.ped(b);
    return { slow, fast, vy: fb.fly.vy, vh: Math.hypot(fb.fly.vx, fb.fly.vz), slowDown: fa.down, top: +top.toFixed(2), landed: !land.fly, moved: +Math.hypot(land.x - fb.x, land.z - fb.z).toFixed(1) };
  });
  check(!c4.slow && c4.fast, `6 m/s（D=${(1.8 * 36).toFixed(0)}）撞倒、15 m/s（D=${(1.8 * 225).toFixed(0)}）撞死`);
  check(Math.abs(c4.vy - 6.75) < .01 && Math.abs(c4.vh - 17.25) < .01, `擊飛速度：水平 ${c4.vh}（1.15×15）、往上 ${c4.vy}（.45×15）`);
  check(c4.top > 1.5 && c4.landed && c4.moved > 3, `飛起 ${c4.top} m、落地、滑出 ${c4.moved} m`);

  console.log('5. 警察戰術');
  const c5a = await ev(page, () => {
    const N = window.__nc, G = N.gta, P = N.vehicles[0];
    G.god.on = true;
    N.drive(); G.wanted.set(2);
    const c = Math.cos(P.yaw), s = Math.sin(P.yaw);
    P.vx = Math.sin(P.yaw) * 20; P.vz = Math.cos(P.yaw) * 20;
    // 一台警車在左後方
    const lx = 2.2, lz = -P.len - 3;
    const u = G.wanted.unit(null, { x: P.x + lx * c + lz * s, z: P.z - lx * s + lz * c, yaw: P.yaw });
    u.state = 'chase'; u.drive = true;
    const aim = G.tac.pitAim(u), side = u.pit, qx = aim[0] - P.vx * .35 - P.x, qz = aim[1] - P.vz * .35 - P.z, ax = qx * c - qz * s, az = qx * s + qz * c;   // 扣掉往前的提前量
    // 警車車頭貼上玩家左後角
    const ox = u.pit * P.w / 2, oz = -P.len * .38, cx = P.x + ox * c + oz * s, cz = P.z - ox * s + oz * c;
    u.v.x = cx - Math.sin(u.v.yaw) * u.v.len * .5; u.v.z = cz - Math.cos(u.v.yaw) * u.v.len * .5;
    const y0 = P.yaw; N.step(1 / 60);
    const spin = !!P.pitSpin;
    for (let i = 0; i < 50; i++) N.step(1 / 60);
    const out = { side, aimLocal: [+ax.toFixed(2), +az.toFixed(2)], spin, dyaw: +(P.yaw - y0).toFixed(2) };
    G.wanted.set(0); N.walk();
    return out;
  });
  check(c5a.side === 1 && c5a.aimLocal[0] > 0 && c5a.aimLocal[1] < 0, `PIT 瞄準左後角（車身座標 ${c5a.aimLocal}）`);
  check(c5a.spin && c5a.dyaw > 1, `推到後車頭扭轉 ${c5a.dyaw} rad`);

  const c5b = await ev(page, () => {
    const N = window.__nc, G = N.gta;
    G.god.on = false; G.life.hp = 100; G.life.armor = 0;
    G.tac.gas(N.player.x, N.player.z, 'cop');
    for (let i = 0; i < 150; i++) N.step(1 / 60);
    const el = document.getElementById('gasFx');
    const out = { hp: G.life.hp, k: +G.tac.GAS.k.toFixed(2), op: el && +el.style.opacity };
    G.tac.GAS.clouds.length = 0; G.life.hp = 100; G.god.on = true;
    for (let i = 0; i < 200; i++) N.step(1 / 60);
    out.after = el && +el.style.opacity;
    return out;
  });
  check(c5b.hp < 95 && c5b.hp > 80, `站在催淚瓦斯裡 2.5 秒生命剩 ${c5b.hp}`);
  check(c5b.k > .8 && c5b.op > .8 && c5b.after < .1, `畫面泛起灰綠 ${c5b.op}，離開後消退 ${c5b.after}`);

  const c5c = await ev(page, async () => {
    const N = window.__nc, G = N.gta, out = { seq: [] };
    G.wanted.set(4);
    const h = G.tac.rap(); out.spawned = !!h;
    if (!h) return out;
    for (let i = 0; i < 60 * 40 && G.tac.TAC.rap; i++) {
      N.step(1 / 60);
      const s = G.tac.rapState();
      if (s && out.seq[out.seq.length - 1] !== s.st) out.seq.push(s.st);
      if (s && s.st === 'hover' && out.hoverY == null) out.hoverY = +(s.y - s.hy).toFixed(1);
      if (s && s.roping) out.roping = Math.max(out.roping || 0, s.roping);
      if (s && s.landed >= 4) { out.landed = s.landed; break; }
    }
    // 落地的特警被玩家丟的瓦斯嗆到
    const cops = G.tac.cops().filter(c => c.swat && !c.rope && c.state !== 'down');
    if (cops[0]) { G.tac.gas(cops[0].x, cops[0].z, 'player'); for (let i = 0; i < 60; i++) N.step(1 / 60); out.stun = G.tac.cops().some(c => c.stun > 0); }
    // 擊落
    G.tac.rapHit(5000);
    for (let i = 0; i < 60 * 8 && G.tac.TAC.rap; i++) N.step(1 / 60);
    out.gone = !G.tac.TAC.rap;
    G.tac.GAS.clouds.length = 0;
    return out;
  });
  check(c5c.spawned && c5c.seq.join('>') === 'in>hover>out' || c5c.seq.join('>') === 'in>hover', `垂降直升機 ${c5c.seq.join(' → ')}`);
  check(c5c.roping >= 1 && c5c.landed >= 4, `四名特警沿繩子滑下（同時在繩上最多 ${c5c.roping}、落地 ${c5c.landed}）`);
  check(c5c.stun, '玩家的催淚瓦斯讓特警動不了');
  check(c5c.gone, '直升機被打下來');

  const c5d = await ev(page, () => {
    const N = window.__nc, G = N.gta;
    G.wanted.set(4); G.tac.TAC.gasT = 0; G.tac.TAC.still = 5;
    let n = 0;
    for (let i = 0; i < 60 * 6; i++) { N.step(1 / 60); n = Math.max(n, G.tac.GAS.clouds.filter(g => g.by === 'cop').length); if (n) break; }
    G.wanted.set(0); G.tac.GAS.clouds.length = 0;
    return { n, cops: G.tac.cops().length };
  });
  check(c5d.n >= 1, `四星時警員往躲著不動的玩家丟催淚瓦斯（場上警員 ${c5d.cops}）`);

  console.log('6. 路障距離');
  const c6 = await ev(page, () => {
    const N = window.__nc, G = N.gta, P = N.vehicles[0], d = [];
    N.drive(); G.wanted.set(3);
    // 站在路口、車頭沿著一段路
    for (let k = 0; k < 24; k++) {
      const n = N.roads.nodes[(k * 37) % N.roads.nodes.length], o = n.out[0];
      if (!o) continue;
      const m = o.dir === 1 ? o.e.b : o.e.a;
      P.x = n.x; P.z = n.z; P.yaw = Math.atan2(m.x - n.x, m.z - n.z);
      P.vx = Math.sin(P.yaw) * 15; P.vz = Math.cos(P.yaw) * 15;
      for (const b of [...G.wanted.W.blocks]) G.wanted.W.blocks.length = 0;
      const b = G.wanted.roadblock();
      if (b) d.push(Math.round(Math.hypot(b.x - P.x, b.z - P.z)));
    }
    G.wanted.set(0); N.walk();
    return d;
  });
  const avg = c6.reduce((a, b) => a + b, 0) / (c6.length || 1);
  check(c6.length >= 5 && c6.every(d => d >= 70 && d <= 200) && Math.abs(avg - 150) < 35, `路障在前方 ${c6.join('、')} m（平均 ${avg.toFixed(0)}，目標 150）`);

  console.log('9. 榴彈發射器');
  const c9 = await ev(page, async () => {
    const N = window.__nc, G = N.gta;
    G.fill(); G.equip('launcher'); N.look(N.player.yaw, .25);
    for (let i = 0; i < 10; i++) N.step(1 / 60);
    G.state.fireT = 0; G.shoot();
    const kinds = G.proj.map(p => p.kind);
    let boom = false;
    for (let i = 0; i < 180; i++) { N.step(1 / 60); if (!G.proj.some(p => p.kind === 'gl')) { boom = true; break; } }
    // 雙手握點（69-tactics.js 的 GUN_HOLD.launcher：右手握把、左手直立前握把、槍托抵肩）
    G.aim(true); await new Promise(r => setTimeout(r, 700));
    const ik = G.held()?.ik; G.aim(false);
    return { kinds, boom, mag: G.arm.ammo.launcher.mag, ik };
  });
  check(c9.kinds.includes('gl'), `發射榴彈（場上投射物 ${c9.kinds}）`);
  check(c9.boom && c9.mag === 5, `落地爆炸、彈匣剩 ${c9.mag}`);
  check(c9.ik && Math.max(c9.ik.r, c9.ik.l) < .03, `瞄準時雙手握在 M32 上（手腕離握點 ${JSON.stringify(c9.ik)} m）`);

  console.log('7. 前置 B：劫持鎮暴裝甲車');
  const c7 = await ev(page, async () => {
    const N = window.__nc, G = N.gta, H = G.heist, h = H.heist, wait = ms => new Promise(r => setTimeout(r, ms)), out = {};
    G.god.on = true; N.motors.cash = 50000; G.wanted.clear('reset');
    H.go('loud');
    const van = h.van; N.tp(van.x + 2.6, van.z, 0); N.act(); await wait(300);
    van.x = H.SAFE.x; van.z = H.SAFE.z + 2; van.vx = van.vz = 0; G.wanted.clear('reset');
    await wait(1800);
    out.st = h.st; out.cur = G.crew.crew.cur; out.sel = G.arm.sel; out.esc = H.escorts().length; out.enf = !!H.enf(); out.mark = H.mark()?.name;
    // 催淚瓦斯丟在押車特警中間：第一次倒下癱瘓 14 秒，沒人站著就不會呼叫支援
    // 三個人站在裝甲車旁、一個在護送警車旁：兩罐同時丟
    const e = H.escorts(), cx = (e[0].x + e[1].x + e[2].x) / 3, cz = (e[0].z + e[1].z + e[2].z) / 3;
    N.tp(cx + 14, cz, -Math.PI / 2); G.tac.gas(cx, cz, 'player'); G.tac.gas(e[3].x, e[3].z, 'player'); await wait(2000);
    out.stun = H.escorts().map(o => Math.round(o.stun));
    await wait(2000);
    out.called = h.escCalled; out.starsGas = G.wanted.W.stars;
    // 搶裝甲車：3 星，GPS 指向 CHROME WORKS
    const v = H.enf(); N.tp(v.x + 2.4, v.z, 0); out.ctxEnf = N.ctx(); N.act();
    for (let i = 0; i < 30 && G.wanted.W.stars < 3; i++) await wait(100);
    out.inEnf = N.player.veh === v; out.stars = G.wanted.W.stars; out.mark2 = H.mark()?.name;
    // 開到 CHROME WORKS 門口：被看到時不能改裝，甩開視線後改裝
    const d = H.garDoor(); v.x = d.x; v.z = d.z; v.vx = v.vz = 0;
    G.wanted.W.seen = true; out.ctxSeen = N.ctx();
    G.wanted.W.seen = false; out.ctxRefit = N.ctx(); N.act(); await wait(1600);
    out.st2 = h.st; out.ready = h.enfReady; out.stars2 = G.wanted.W.stars; out.left = H.escorts().length + (H.enf() ? 1 : 0);
    return out;
  });
  check(c7.st === 'setupB' && c7.cur === 2 && c7.sel === 'stun', `前置 A 交車後換 Jax 進前置 B（${c7.st}、角色 ${c7.cur}、${c7.sel}）`);
  check(c7.enf && c7.esc === 4 && c7.mark === 'NCPD 移防車隊', `車隊與 4 名押車特警就位（${c7.esc} 人、標記 ${c7.mark}）`);
  check(c7.stun.every(t => t >= 10), `瓦斯放倒的特警癱瘓 14 秒（${c7.stun.join('、')}）`);
  check(!c7.called && c7.starsGas === 0, `全部放倒就不會呼叫支援（星級 ${c7.starsGas}）`);
  check(/鎮暴裝甲車/.test(c7.ctxEnf || '') && c7.inEnf && c7.stars >= 3 && c7.mark2 === 'CHROME WORKS', `搶到裝甲車 3 星、指向改車廠（${c7.ctxEnf}、${c7.inEnf}、${c7.stars} 星、${c7.mark2}）`);
  check(/甩開視線/.test(c7.ctxSeen || '') && /防彈輪胎/.test(c7.ctxRefit || ''), `被看到不能改裝、甩開後可以（${c7.ctxSeen} → ${c7.ctxRefit}）`);
  check(c7.st2 === 'go' && c7.ready && c7.stars2 === 0 && c7.left === 0, `改裝完成回到 go、通緝清掉、車隊收掉（${c7.st2}）`);

  console.log('8. 金庫破譯 · 11. 潛行警報 4 星');
  const c8 = await ev(page, async () => {
    const N = window.__nc, G = N.gta, H = G.heist, h = H.heist, X = H.HACK, wait = ms => new Promise(r => setTimeout(r, ms)), out = {};
    const vault = async how => {
      G.wanted.clear('reset'); h.how = how; h.alarm = false; h.drilling = false;
      H.stage('lobby'); N.enter('bank'); N.step(1 / 60); H.blow(); await wait(1900);
    };
    await vault('smart');
    out.open = X.on; out.vis = getComputedStyle(document.getElementById('hack')).display; out.st = h.st;
    const i0 = h.intim; await wait(1000); out.intim = [Math.round(i0), Math.round(h.intim)];
    N.keys.KeyW = true; N.step(1 / 60); N.keys.KeyW = false; out.walk = N.inp.mz;
    const r0 = X.rows[0], f0 = r0.f; H.hackInput(f0 < 6 ? 'f+' : 'f-'); out.fChange = r0.f !== f0;
    H.hackSolve(); await wait(2600);
    out.ok = X.rows.map(r => r.ok); out.st2 = h.st; out.where = N.player.where; out.stars = G.wanted.W.stars;
    // 逾時：潛行觸發警報，直接 4 星，改用鑽機（Jax 守門 60 秒）
    await vault('smart'); out.open2 = X.on;
    X.t = .05; await wait(400);
    out.alarm = h.alarm; out.starsLate = G.wanted.W.stars;
    await wait(1600); out.lateSt = h.st; out.lateT = Math.round(h.t); out.lateCur = G.crew.crew.cur;
    // 強攻（炸門就響警報）破譯成功：只守 30 秒
    await vault('loud'); H.hackSolve(); await wait(3200);
    out.loud = { st: h.st, t: Math.round(h.t), holdT: h.holdT, drilling: h.drilling, cur: G.crew.crew.cur };
    // E：直接改裝鋁熱鑽機
    await vault('smart'); H.hackInput('drill'); out.drill = { on: X.on, drilling: h.drilling, t: Math.round(h.t) };
    G.wanted.clear('reset');
    return out;
  });
  check(c8.open && c8.vis === 'block' && c8.st === 'drill', `金庫門炸開後自動開啟破譯介面（${c8.vis}）`);
  check(c8.intim[1] >= c8.intim[0] - 1, `破譯時 Kael 壓住人質，威懾不掉（${c8.intim.join(' → ')}）`);
  check(c8.walk === 0 && c8.fChange, '破譯時 WASD 調波形、角色不會走');
  check(c8.ok.every(Boolean) && c8.st2 === 'escape' && c8.where === 'out' && c8.stars === 2, `潛行沒響警報破譯成功直接開金庫出來（${c8.st2}、${c8.stars} 星）`);
  check(c8.open2 && c8.alarm && c8.starsLate === 4, `潛行逾時觸發警報、立刻 4 星（${c8.starsLate} 星）`);
  check(c8.lateSt === 'drill' && c8.lateT >= 55 && c8.lateCur === 2, `逾時後裝鑽機、Jax 守門 ${c8.lateT} 秒`);
  check(c8.loud.st === 'drill' && c8.loud.holdT === 30 && c8.loud.t <= 30 && c8.loud.t >= 26 && c8.loud.cur === 2, `強攻破譯成功只守 30 秒（${JSON.stringify(c8.loud)}）`);
  check(!c8.drill.on && c8.drill.drilling, `按 E 改裝鋁熱鑽機（${JSON.stringify(c8.drill)}）`);

  console.log('10. 逃亡載具與武裝直升機');
  const c10 = await ev(page, async () => {
    const N = window.__nc, G = N.gta, H = G.heist, h = H.heist, S = G.gunship, wait = ms => new Promise(r => setTimeout(r, ms)), out = {};
    const step = (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) N.step(dt); };
    G.wanted.clear('reset'); h.how = 'loud'; h.enfReady = true; h.alarm = true;
    H.stage('drill'); N.enter('bank'); H.escape(); await wait(1600);
    const car = h.car, heli = H.heli();
    out.car = { type: car.type, bp: !!car.bpTires, dis: !!car.disguise, hp: car.hp };
    out.heli = !!heli && Math.hypot(heli.x - S.HELIPAD.x, heli.z - S.HELIPAD.z) < 1;
    out.model = heli && { name: heli.name, len: +heli.len.toFixed(1), rotor: heli.rotor.geometry.attributes.position.count };
    out.tire = G.wreck.shootTire(car, 0);
    H.getaway(); await wait(1600);
    out.drive = { st: h.st, amb: h.amb, in: N.player.veh === car, mark: H.mark()?.name };
    await wait(4200);
    out.tanks = G.wanted.W.units.filter(u => u.kind === 'tank' && u.heist).length;
    // 登機、起飛
    N.tp(heli.x + 3.5, heli.z, 0); out.ctx = N.ctx(); N.act(); await wait(200);
    out.inHeli = N.player.veh === heli; out.mark2 = H.mark()?.name;
    const g0 = heli.y; N.keys.Space = true; step(200); N.keys.Space = false;
    out.climb = +(heli.y - g0).toFixed(1);
    out.touchFly = document.querySelector('#tbtn button[data-k="Space"]').textContent;
    N.keys.KeyW = true; step(120); N.keys.KeyW = false;
    out.speed = +Math.hypot(heli.vx, heli.vz).toFixed(1); out.pitch = +heli.pitch.toFixed(3);
    // 半空按 F 不能下機
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyF' }));
    out.stillIn = N.player.veh === heli;
    // 火箭莢
    S.fire(); out.rockets = G.proj.filter(p => p.kind === 'rocket').length; out.rk = S.GS.rk;
    // 撞樓：在低空對著一棟高樓衝過去，停在牆外、機身受損
    let tgt = null;
    for (let r = 20; r < 140 && !tgt; r += 4) for (let a = 0; a < 6.28 && !tgt; a += .2) { const x = heli.x + Math.sin(a) * r, z = heli.z + Math.cos(a) * r; if (S.roofH(x, z) > 25) tgt = { x, z, a }; }
    if (tgt) {
      heli.x = tgt.x - Math.sin(tgt.a) * 18; heli.z = tgt.z - Math.cos(tgt.a) * 18; heli.y = Math.max(2, N.gta.gunship.roofH(heli.x, heli.z) + 3); heli.yaw = tgt.a;
      heli.vx = Math.sin(tgt.a) * 20; heli.vz = Math.cos(tgt.a) * 20; heli.vy = 0;
      const hp0 = heli.hp; step(120);
      out.wall = { inside: S.roofH(heli.x, heli.z) > heli.y + .6, dmg: Math.round(hp0 - heli.hp) };
    }
    // 降落在貨場黃圈：還在半空不算，落地才過關
    G.wanted.clear('reset');
    heli.x = H.YARD.x; heli.z = H.YARD.z; heli.y = 12; heli.vx = heli.vz = heli.vy = 0; step(60);
    out.hover = h.st;
    N.keys.ShiftLeft = true; step(240); N.keys.ShiftLeft = false; heli.vx = heli.vz = 0; G.wanted.clear('reset'); await wait(600);
    out.land = { st: h.st, done: document.getElementById('heistDone').classList.contains('on'), alt: +(heli.y - S.roofH(heli.x, heli.z)).toFixed(1) };
    if (N.player.veh) N.walk();
    out.after = { enf: N.vehicles.includes(car), heli: S.GS.list.length };
    // 再搶一次：停機坪換一架新的，不會疊兩架
    h.how = 'loud'; h.enfReady = true; const car2 = H.getawayCar(), h2 = H.heli();
    out.again = { heli: S.GS.list.length, pad: Math.hypot(h2.x - S.HELIPAD.x, h2.z - S.HELIPAD.z) < 1, touch: document.querySelector('#tbtn button[data-k="Space"]').textContent };
    S.drop(h2); N.vehicles.splice(N.vehicles.indexOf(car2), 1); car2.g.removeFromParent(); h.car = null;
    return out;
  });
  check(c10.car.type === 'md84' && c10.car.bp && c10.car.dis && c10.heli, `強攻逃亡車是改裝裝甲車、河濱停機坪有直升機（${JSON.stringify(c10.car)}）`);
  check(c10.model && c10.model.len > 13 && /沙隼/.test(c10.model.name), `直升機是 traffic.glb 的 AH-64（${JSON.stringify(c10.model)}）`);
  check(c10.tire === false, '防彈輪胎打不破');
  check(c10.drive.st === 'drive' && c10.drive.in && c10.drive.amb === 0 && c10.tanks === 0 && c10.drive.mark === '武裝直升機', `上車後指向直升機、沒有戰車封路（${JSON.stringify(c10.drive)}、戰車 ${c10.tanks}）`);
  check(/登機/.test(c10.ctx || '') && c10.inHeli && c10.mark2 === '貨櫃安全屋', `登機（${c10.ctx}）後指向貨櫃安全屋`);
  check(c10.climb > 5 && c10.touchFly === '爬升', `Space 爬升 ${c10.climb} m、觸控按鈕「${c10.touchFly}」`);
  check(c10.speed > 10 && c10.pitch > .05, `W 前進 ${c10.speed} m/s、機身前傾 ${c10.pitch}`);
  check(c10.stillIn, '半空按 F 不會下機');
  check(c10.rockets > 0 && c10.rk === 15, `左右火箭莢發射（場上火箭 ${c10.rockets}、剩 ${c10.rk}）`);
  check(c10.wall && !c10.wall.inside && c10.wall.dmg > 0, `撞樓停在牆外、機身受損 ${JSON.stringify(c10.wall)}`);
  check(!c10.after.enf && c10.after.heli === 1 && c10.again.heli === 1 && c10.again.pad, `結算後收掉裝甲車、下一輪停機坪只有一架新的（${JSON.stringify(c10.after)} ${JSON.stringify(c10.again)}）`);
  check(c10.again.touch === '手煞', `下機後觸控按鈕標籤換回來（${c10.again.touch}）`);
  check(c10.hover === 'drive' && c10.land.st === 'off' && c10.land.done, `在黃圈上空不算、降落才 HEIST PASSED（${c10.hover} → ${JSON.stringify(c10.land)}）`);

  check(!log.pageerrors.length, `沒有 uncaught exception ${log.pageerrors.slice(0, 3).join(' | ')}`);
  check(!log.errors.length, `沒有 console.error ${log.errors.slice(0, 3).join(' | ')}`);
} finally {
  await browser.close();
}
console.log(failed ? `✗ ${failed} 項失敗` : '✓ 全部通過');
process.exit(failed ? 1 : 0);
