// 第三部曲（遺漏機制與碰撞範圍）的驗收：六圍、體力、消音器、潛水打撈、汽油與火、車身弱點、輪框起火、拋出車外與安全帶、
// 翻車回正、翻越、跳傘、計程車與逃票、搶劫同夥、日夜犯罪權重、撞斷路燈與消防栓、撬車警報、路人撲開
// 用法：node tools/check-gta-v3.mjs [html]（預設 web/260-neon-nightcity.html）
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = resolve(process.argv[2] || resolve(root, '../../web/260-neon-nightcity.html'));
let failed = 0;
function check(cond, msg) { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) failed++; }
const { browser, page, log } = await open(htmlPath, { w: 1280, h: 800 });
// 每一節各自跑：前一節出錯不擋後面
async function sec(title, fn, arg) {
  console.log(title);
  try { return await page.evaluate(fn, arg); } catch (e) { check(false, `執行失敗：${String(e.message || e).split('\n').slice(0, process.env.V3_STACK ? 8 : 1).join('\n    ')}`); return null; }
}
// 頁面裡共用的小工具
await page.evaluate(() => {
  window.__t = {
    step(n) { for (let i = 0; i < n; i++) window.__nc.step(1 / 60); },
    reset() { const N = window.__nc; N.gta.wanted.clear('reset'); N.gta.life.hp = 100; if (N.player.mode === 'drive') N.walk(); N.player.air3 = null; N.player.down = 0; },
  };
});

try {
  await page.evaluate(() => window.__nc.start());
  await page.waitForTimeout(800);

  const c1 = await sec('1. 六圍屬性', () => {
    const V = window.__nc.gta.v3, s = V.skills.find(o => Math.abs(o.sho / 100 - V.sk('sho')) < 1e-9), out = {};
    out.n = V.skills.length; out.keys = Object.keys(V.skills[0]).join(',');
    const r0 = V.skK.recoil, was = s.sho; s.sho = Math.floor(was); V.skUp('sho', 1.2);
    out.up = +(s.sho - Math.floor(was)).toFixed(2); out.recoil = [+r0.toFixed(3), +V.skK.recoil.toFixed(3)];
    s.sho = was; V.skUp('sho', 0);
    out.rows = V.skillRows().length;
    return out;
  });
  if (c1) {
    check(c1.n === 3 && c1.keys === 'sta,sho,str,stl,drv,lung', `三位主角各六項（${c1.keys}）`);
    check(c1.up === 1.2 && c1.recoil[1] < c1.recoil[0], `射擊升級後後座力變小 ${c1.recoil.join(' → ')}`);
    check(c1.rows === 7, `選單「角色能力」七列（${c1.rows}）`);
  }

  const c2 = await sec('2. 衝刺體力', () => {
    const N = window.__nc, V = N.gta.v3; __t.reset();
    V.stam.v = 0; V.stam.tired = true; __t.step(2);
    const tired = N.player.runK;
    V.stam.v = 1; V.stam.tired = false; __t.step(2);
    return { tired, back: N.player.runK };
  });
  if (c2) check(c2.tired === .74 && c2.back === 1, `喘的時候衝刺 ×0.74、恢復後 ×1（${c2.tired} → ${c2.back}）`);

  const c3 = await sec('3. 噪音圈與消音器', () => {
    const N = window.__nc, G = N.gta, V = G.v3; __t.reset();
    G.equip('pistol', true); G.arm.ammo.pistol.mag = 12; __t.step(40);
    G.shoot(); const loud = V.noise.shotR; __t.step(40);
    N.motors.gear.sil.push('pistol'); __t.step(2);
    G.shoot(); const quiet = V.noise.shotR;
    N.motors.gear.sil.splice(N.motors.gear.sil.indexOf('pistol'), 1); G.equip('fist', true); __t.step(2);
    return { loud, quiet };
  });
  if (c3) check(c3.loud === 60 && c3.quiet === 7, `槍聲半徑 ${c3.loud} m，裝消音器 ${c3.quiet} m`);

  const c4 = await sec('4. 潛水與打撈', () => {
    const N = window.__nc, V = N.gta.v3; __t.reset(); __t.step(1);
    const c = V.salv.list.find(o => !N.motors.gear.salv.includes(o.i));
    N.tp(c.x + 1, c.z + 1); __t.step(30);
    const swim = !!N.player.swim, d = V.diveToggle(), cash0 = N.motors.cash;
    __t.step(120);
    const got = N.motors.gear.salv.includes(c.i), br = V.breath.v, dk = N.player.diveK;
    V.diveToggle(); __t.step(60);
    return { n: V.salv.list.length, swim, d, got, br: +br.toFixed(2), dk: +dk.toFixed(2), cash: N.motors.cash - cash0, depth: +N.sea.depth(c.x, c.z).toFixed(1) };
  });
  if (c4) {
    check(c4.n === 8 && c4.depth > 4, `海裡 ${c4.n} 個貨櫃，第一個水深 ${c4.depth} m`);
    check(c4.swim && c4.d && c4.dk > .7, `游泳時按 Z 下潛（diveK ${c4.dk}）`);
    check(c4.got && c4.br < 1, `潛到貨櫃旁撈起（${c4.cash ? '現金 +' + c4.cash : '物資'}），閉氣條 ${c4.br}`);
  }

  const c5 = await sec('5. 汽油與延燒', () => {
    const N = window.__nc, C = N.gta.v3.chem; __t.reset();
    N.tpL(0, 0); __t.step(5);
    const x = N.player.x + 6, z = N.player.z;
    C.fuel.length = 0;
    for (let i = 0; i < 8; i++) C.drop(x + i * .45, z, 't');
    const lit0 = C.ignite(x, z, .3);
    __t.step(30);
    const lit = C.fuel.filter(f => f.fire > 0).length;
    __t.step(60 * 9);
    return { n: 8, lit0, lit, left: C.fuel.length };
  });
  if (c5) {
    check(c5.lit0 === 1 && c5.lit >= 6, `點燃一灘、半秒後延燒到 ${c5.lit} 灘`);
    check(c5.left === 0, `燒完就消失（剩 ${c5.left}）`);
  }

  const c6 = await sec('6. 車身弱點：左後油箱、擋風玻璃', () => {
    const N = window.__nc, C = N.gta.v3.chem; __t.reset();
    const world = (c, lx, lz) => { const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw); return [c.x + lx * fz + lz * fx, c.z - lx * fx + lz * fz]; };
    const px = N.player.x, pz = N.player.z, near = L => L.filter(c => Math.hypot(c.x - px, c.z - pz) < 200).sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz));
    const p = near(N.parked)[0], out = {};
    { const o = C.localOf(p, p.x, 0, p.z), [x, z] = world(p, o.W / 2 - .2, -o.L * .25); out.k1 = C.weakHit(p, 'car', x, .6, z, false); out.leak = C.leaks.has(p); out.k2 = C.weakHit(p, 'car', x, .6, z, false); out.det = !!p.det; }
    __t.step(30);
    out.burn = p.det ? { bail: !!p.det.bail, hp: Math.round(p.det.hp) } : null;
    const t = near(N.traffic)[0];
    { const o = C.localOf(t, t.x, 0, t.z), [x, z] = world(t, 0, o.L * .15); C.weakHit(t, 'car', x, 1.2, z, false); out.glass = t.det ? { dead: t.det.driverDead } : null; }
    __t.step(10);
    return out;
  });
  if (c6) {
    check(c6.k1 === 3 && c6.leak, `第一發打穿油箱：傷害 ×${c6.k1}、開始漏油`);
    check(c6.k2 === 3 && c6.det && c6.burn && c6.burn.bail, `第二發點著，車子起火（${JSON.stringify(c6.burn)}）`);
    check(c6.glass && c6.glass.dead === 1, '打穿擋風玻璃：駕駛中彈、車子失控滑行');
  }

  const c7 = await sec('7. 破胎磨輪框起火', () => {
    const N = window.__nc, G = N.gta; __t.reset(); N.drive();
    const v = N.player.veh; G.wreck.fix(v);
    const t = G.wreck.tires(v); G.wreck.shootTire(v, 0); G.wreck.shootTire(v, 0);
    v.rimH = 8.8;
    for (let i = 0; i < 40; i++) { v.vx = Math.sin(v.yaw) * 16; v.vz = Math.cos(v.yaw) * 16; N.step(1 / 60); }
    const out = { flat: !!G.wreck.tires(v)[0].flat, bail: !!v.bail, rim: +(v.rimH || 0).toFixed(1) };
    G.wreck.fix(v); v.vx = v.vz = 0; return out;
  });
  if (c7) check(c7.flat && c7.bail, `時速 58 拖著輪框跑，累積熱度到起火（${JSON.stringify(c7)}）`);

  const c8 = await sec('8. 拋出車外與安全帶', () => {
    const N = window.__nc, V = N.gta.v3; __t.reset(); N.gta.god.on = false;
    N.drive(); const v = N.player.veh, out = {};
    const hit = () => { for (let i = 0; i < 3; i++) { v.vx = Math.sin(v.yaw) * 26; v.vz = Math.cos(v.yaw) * 26; N.step(1 / 60); } v.vx = v.vz = 0; N.step(1 / 60); };
    __t.step(2); hit();
    out.ejected = N.player.mode === 'walk' && !!N.player.air3;
    for (let i = 0; i < 300 && N.player.air3; i++) N.step(1 / 60);
    out.landed = !N.player.air3; out.hp = Math.round(N.gta.life.hp);
    __t.reset(); N.drive(); __t.step(160);
    out.belt = V.crash.crash.belt; hit(); out.stay = N.player.mode === 'drive';
    __t.reset(); return out;
  });
  if (c8) {
    check(c8.ejected && c8.landed && c8.hp < 100, `沒繫安全帶以 94 km/h 正面急停：飛出車外、落地扣血（剩 ${c8.hp}）`);
    check(c8.belt && c8.stay, '停車兩秒自動繫上安全帶，同樣撞擊留在車上');
  }

  const c9 = await sec('9. 翻車後按住方向鍵翻回來', () => {
    const N = window.__nc; __t.reset(); N.drive(); const v = N.player.veh;
    v.roll = Math.PI; v.flipped = { t: 0, side: 0, push: 0 };
    N.keys.KeyD = true; __t.step(100); N.keys.KeyD = false;
    __t.step(300);
    const out = { flipped: !!v.flipped, roll: +Math.abs(Math.atan2(Math.sin(v.roll), Math.cos(v.roll))).toFixed(2), tumble: !!v.tumble };
    __t.reset(); return out;
  });
  if (c9) check(!c9.flipped && !c9.tumble && c9.roll < .2, `倒扣時按住 D 晃回正（${JSON.stringify(c9)}）`);

  const c10 = await sec('10. 翻越停著的車', () => {
    const N = window.__nc, V = N.gta.v3; __t.reset();
    const px = N.player.x, pz = N.player.z;
    const L = N.parked.filter(c => Math.hypot(c.x - px, c.z - pz) < 260).sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz));
    for (const c of L.slice(0, 12)) for (const s of [1, -1]) {
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), lx = fz * s, lz = -fx * s, w = 1.1;
      N.tp(c.x + lx * w * 1.5, c.z + lz * w * 1.5, Math.atan2(-lx, -lz)); __t.step(2);
      if (Math.hypot(N.player.x - (c.x + lx * w * 1.5), N.player.z - (c.z + lz * w * 1.5)) > .1) continue;
      if (!V.crash.tryVault()) continue;
      __t.step(70);
      const side = (N.player.x - c.x) * lx + (N.player.z - c.z) * lz;
      return { ok: true, side: +side.toFixed(2), y: +N.player.y.toFixed(2) };
    }
    return { ok: false };
  });
  if (c10) check(c10.ok && c10.side < -1, `翻過車頂落到另一側（${JSON.stringify(c10)}）`);

  const c11 = await sec('11. 自由落體與開傘', () => {
    const N = window.__nc, V = N.gta.v3; __t.reset(); N.tpL(0, 0); __t.step(2);
    N.player.y = 160; N.player.air3 = { kind: 'fall', vx: 0, vy: -1, vz: 0, t: 0 };
    __t.step(120); const vy = N.player.air3 && N.player.air3.vy;
    const opened = V.crash.open(); __t.step(240); const vy2 = N.player.air3 && N.player.air3.vy, vis = V.crash.chute.visible;
    for (let i = 0; i < 60 * 40 && N.player.air3; i++) N.step(1 / 60);
    const out = { vy: +(vy || 0).toFixed(1), opened, vy2: +(vy2 || 0).toFixed(1), vis, landed: !N.player.air3, hp: Math.round(N.gta.life.hp) };
    __t.reset(); return out;
  });
  if (c11) {
    check(c11.vy < -15 && c11.opened && c11.vis, `自由落體 ${c11.vy} m/s 後開傘`);
    check(c11.vy2 > -6 && c11.landed && c11.hp === 100, `傘下 ${c11.vy2} m/s、安全落地（生命 ${c11.hp}）`);
  }

  const c12 = await sec('12. 計程車與逃票', async () => {
    const N = window.__nc, V = N.gta.v3, out = {}; __t.reset(); N.tpL(0, 0); __t.step(2);
    const wait = ms => new Promise(r => setTimeout(r, ms));
    N.motors.cash = 50000; const x0 = N.player.x, z0 = N.player.z;
    V.taxiRide(); out.opts = N.dialog.opts.length; N.pick(0); await wait(1600);
    out.moved = Math.round(Math.hypot(N.player.x - x0, N.player.z - z0)); out.paid = 50000 - N.motors.cash;
    N.tpL(0, 0); await wait(200); N.motors.cash = 0; V.taxiRide(); N.pick(0); await wait(1600);
    out.stars = N.gta.wanted.W.stars;
    __t.reset(); N.motors.cash = 50000; return out;
  });
  if (c12) {
    check(c12.opts >= 3 && c12.paid > 30 && c12.moved > 10, `選目的地直接到（${c12.moved} m）、付車資 $${c12.paid}`);
    check(c12.stars === 1, `錢不夠就是逃票：通緝 ${c12.stars} 星`);
  }

  const c13 = await sec('13. 搶劫同夥', () => {
    const N = window.__nc, H = N.gta.v3.hire;
    H.set({ hacker: 'pixel', driver: 'nova', gunman: 'lu' });
    const lv0 = H.hireVal('hacker', 'hack'); N.motors.gear.hire.pixel = 2; const lv2 = H.hireVal('hacker', 'hack');
    const cuts = H.hireCuts(100000).map(r => r[1]);
    delete N.motors.gear.hire.pixel; H.set(null);
    return { lv0, lv2: +lv2.toFixed(3), cuts, none: H.hireCuts(100000).length };
  });
  if (c13) {
    check(c13.lv0 === .75 && c13.lv2 === 1.075, `菜鳥駭客破譯倍率 0.75，升到 Lv 2 往老手靠近一半（${c13.lv2}）`);
    check(c13.cuts.join() === '5000,10000,5000' && c13.none === 1, `三人分紅 ${c13.cuts.join('／')}、沒挑人照舊 Zero 一成`);
  }

  const c14 = await sec('14. 日夜犯罪權重', () => {
    const N = window.__nc, V = N.gta.v3, t0 = N.time();
    N.time(12 * 60); const day = [V.evW('truck', 1), V.evW('deal', 1), V.isNight()];
    N.time(23 * 60); const night = [V.evW('truck', 1), V.evW('deal', 1), V.isNight()];
    N.time(t0); return { day, night };
  });
  if (c14) check(c14.day.join() === '2,0.5,false' && c14.night.join() === '0.5,2,true', `白天運鈔車 ×2、晚上幫派交易 ×2（${JSON.stringify(c14)}）`);

  const c15 = await sec('15. 撞斷路燈與消防栓', () => {
    const N = window.__nc, B = N.gta.v3.brk, out = {}; __t.reset(); N.rain(0); N.wx.wet = 0;
    N.drive(); const v = N.player.veh;
    out.reg = B.init();
    for (const kind of ['lamp', 'hydrant']) {
      const t = B.nearest(v.x, v.z, kind), n0 = B.brk.n;
      // 從 12 m 外以 15 m/s 開過去（先把車擺到桿子後方、車頭對準）
      let a = Math.atan2(t.x - v.x, t.z - v.z); v.x = t.x - Math.sin(a) * 12; v.z = t.z - Math.cos(a) * 12; v.yaw = a;
      for (let i = 0; i < 60 && B.brk.n === n0; i++) { v.vx = Math.sin(a) * 15; v.vz = Math.cos(a) * 15; N.step(1 / 60); }
      out[kind] = { broke: B.brk.n > n0, moved: t.c.x > 1e6, speed: +Math.hypot(v.vx, v.vz).toFixed(1) };
      v.vx = v.vz = 0; __t.step(5);
    }
    out.geysers = B.brk.geysers.length; out.fallen = B.brk.fallen.length;
    __t.step(60); out.tilt = B.brk.fallen.every(f => f.a > 1);
    __t.reset(); return out;
  });
  if (c15) {
    check(c15.reg > 1000, `登錄 ${c15.reg} 根路燈與消防栓`);
    check(c15.lamp.broke && c15.lamp.moved && c15.lamp.speed > 12, `時速 54 撞斷路燈，車速只掉一點（${c15.lamp.speed} m/s）`);
    check(c15.hydrant.broke && c15.geysers === 1, '撞斷消防栓、噴出水柱');
    check(c15.fallen > 0 && c15.tilt, `${c15.fallen} 個部件倒下`);
  }

  const c16 = await sec('16. 撬車警報', () => {
    const N = window.__nc, V = N.gta.v3; __t.reset();
    const px = N.player.x, pz = N.player.z;
    const L = N.parked.filter(c => Math.hypot(c.x - px, c.z - pz) < 260).sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz));
    for (const c of L.slice(0, 10)) {
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
      N.tp(c.x + fz * 2, c.z - fx * 2, 0); __t.step(2);
      const ctx = N.ctx();
      if (!/撬車/.test(ctx || '')) continue;
      N.act(); __t.step(150);
      const out = { ctx, on: !!V.alarm.v, t: +V.alarm.t.toFixed(1), drive: N.player.mode };
      __t.step(60 * 8); out.off = !V.alarm.v;
      __t.reset(); return out;
    }
    return null;
  });
  check(c16 && c16.on && c16.t > 4 && c16.off, `撬路邊車響警報 8 秒（${JSON.stringify(c16)}）`);

  const c17 = await sec('17. 路人往車外側撲開', () => {
    const N = window.__nc, ps = N.pedState; __t.reset(); N.drive(); const v = N.player.veh;
    // 挑離玩家最近、正常走路的人（離太遠的人會被搬到別處，位置不準）
    let k = -1, bd = 1e9;
    ps.forEach((s, i) => { const q = N.peds.people[i], d = Math.hypot(q.x - v.x, q.z - v.z); if (!(s.down > 0) && !s.fsm && !(s.panic > 0) && d < bd) { bd = d; k = i; } });
    // 車子沿著人行道迎面開過來（衝上人行道）：先走幾幀量出路人走的方向，車擺在前方 9 m、偏 0.4 m
    const p = N.peds.people[k], xa = p.x, za = p.z; __t.step(6);
    const x0 = p.x, z0 = p.z, a = Math.atan2(xa - x0, za - z0); v.yaw = a; const fx = Math.sin(a), fz = Math.cos(a);
    v.x = x0 - fx * 9 + fz * .4; v.z = z0 - fz * 9 - fx * .4;
    // 開到路人原本的位置前 3 m（約 0.5 秒）：這時候人要已經離開車寬
    let dive = 0, side = 0;
    for (let i = 0; i < 30; i++) { v.vx = fx * 12; v.vz = fz * 12; N.step(1 / 60); dive = Math.max(dive, ps[k].dive || 0); side = (p.x - v.x) * fz - (p.z - v.z) * fx; }
    v.vx = v.vz = 0; __t.reset();
    return { dive: +dive.toFixed(2), side: +side.toFixed(2), down: !!(ps[k].down > 0), d: +bd.toFixed(1) };
  });
  if (c17) check(c17.dive > 0 && Math.abs(c17.side) > 1.3 && !c17.down, `車頭前方的人撲出車寬、沒被撞到（${JSON.stringify(c17)}）`);

  const c18 = await sec('18. 擦牆與正面撞牆', () => {
    // 珊瑚灘中間臨時放一面 30 m 長、沿世界 x 軸的牆（街上的樓牆前面有路燈、垃圾桶、路邊車，量不準）
    const N = window.__nc; __t.reset(); N.drive(); const v = N.player.veh, [x, z] = N.W(150, 862);
    const rm = N.gta.v3.wall(x - 5, z + 2, x + 30, z + 3), run = (deg) => {
      const r = deg * Math.PI / 180, hx = Math.cos(r), hz = Math.sin(r);
      v.x = x - hx * 2.4; v.z = z + 2 - .95 - 1.6 * Math.sin(r) - hz * 2.4; v.yaw = Math.atan2(hx, hz); v.y = N.sea.floor(v.x, v.z);
      N.gta.wreck.fix(v); N.gta.v3.crash.crash.belt = true; let sp = 0;
      for (let i = 0; i < 40; i++) { if (i < 4) { v.vx = hx * 22; v.vz = hz * 22; } N.step(1 / 60); sp = Math.hypot(v.vx, v.vz); }
      return +sp.toFixed(1);
    };
    const out = { scrape: run(14), head: run(85), mode: N.player.mode };
    rm(); v.vx = v.vz = 0; N.gta.wreck.fix(v); __t.reset(); return out;
  });
  check(c18 && c18.scrape > 12 && c18.head < 8, `以 14° 擦牆保住速度、85° 正面撞牆幾乎停下（${JSON.stringify(c18)}）`);

  console.log('19. 主控台');
  check(log.pageerrors.length === 0, `沒有 uncaught exception（${log.pageerrors.slice(0, 2).join(' | ')}）`);
  check(log.errors.length === 0, `沒有 console.error（${log.errors.slice(0, 2).join(' | ')}）`);
} finally { await browser.close(); }
console.log(failed ? `\n${failed} 項沒過` : '\n全部通過');
process.exit(failed ? 1 : 0);
