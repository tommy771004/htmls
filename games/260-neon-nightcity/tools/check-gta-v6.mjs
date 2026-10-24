// 第六部曲（大型改裝車廠，neon_nightcity_gta_v_neon_mega_customs.md）的驗收：
// 13 大改裝的面板與公式、修車估價、進廠規則（通緝與警察視線、太燙手的贓車）、噴漆換牌消星、拔槍關店與重新營業、鋼瓶連環爆炸、
// 液壓、防撞鏟、歪軸、保險與重建費、點火與遙控炸彈、銷贓與出口車單、收購車廠與客戶委託、2 樓私人車庫、存檔第 11 版
// 用法：node tools/check-gta-v6.mjs [html]（預設 web/260-neon-nightcity.html）
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
  try { return await page.evaluate(fn, arg); } catch (e) { check(false, `執行失敗：${String(e.message || e).split('\n').slice(0, process.env.V6_STACK ? 8 : 1).join('\n    ')}`); return null; }
}
const waitWhere = w => page.waitForFunction(w => window.__nc.getStats().where === w, w, { timeout: 30000, polling: 100 });
await page.evaluate(() => {
  window.__t = {
    step(n) { for (let i = 0; i < n; i++) window.__nc.step(1 / 60); },
    reset() { const N = window.__nc; N.gta.wanted.clear('reset'); N.gta.life.hp = 100; if (N.player.mode === 'drive') N.walk(); N.player.down = 0; },
    // 開自己的車停到改裝廠門口
    pad(v) { const N = window.__nc; v = v || N.vehicles[0]; if (N.player.veh !== v) { if (N.player.mode === 'drive') N.walk(); N.drive(); } const p = N.chrome.pad(); v.x = p.x; v.z = p.z; v.yaw = p.yaw; v.vx = v.vz = 0; __t.step(1); return N.ctx(); },
  };
});

try {
  await page.evaluate(() => window.__nc.start());
  await page.waitForTimeout(800);

  const c1 = await sec('1. 13 大改裝的公式（規格書第四節）', () => {
    const N = window.__nc, C = N.chrome, id = 'ae86', S0 = C.stats(id, {}), st = m => C.stats(id, m);
    return {
      cats: C.CATS.map(c => c.name), eng: [1, 2, 3, 4].map(n => +(st({ eng: n }).eng / S0.eng).toFixed(3)), top4: +(st({ eng: 4 }).kmh / S0.kmh).toFixed(4),
      tur: +(st({ tur: 1 }).eng / S0.eng).toFixed(3), brk: [1, 2, 3].map(n => +(st({ brk: n }).brk / S0.brk).toFixed(2)), spl: [1, 2].map(n => +(st({ spl: n }).grip - S0.grip).toFixed(2)),
      arm: [1, 3, 5].map(n => +(st({ arm: n }).hp / S0.hp).toFixed(2)), shift: [0, 1, 2, 3].map(n => st({ trn: n }).shift), rev: st({ trn: 3 }).rev, cog: st({ sus: 4 }).cog,
    };
  });
  if (c1) {
    check(c1.cats.length === 13, `13 大類（${c1.cats.join('、')}）`);
    check(c1.eng.join() === '1.08,1.16,1.24,1.32' && c1.top4 === 1.05, `EMS 加速 ×${c1.eng.join('／')}、4 級極速 ×${c1.top4}`);
    check(c1.tur === 1.22 && c1.brk.join() === '1.12,1.24,1.36', `渦輪加速 ×${c1.tur}、煞車 ×${c1.brk.join('／')}`);
    check(c1.spl.join() === '0.3,0.6' && c1.arm.join() === '1.2,1.6,2', `尾翼 μ +0.03／+0.06（grip +${c1.spl.join('／')}）、裝甲耐久 ×${c1.arm.join('／')}`);
    check(c1.shift.join() === '0.35,0.25,0.15,0.08' && c1.rev === 1.45 && c1.cog === .7, `換檔延遲 ${c1.shift.join('→')} 秒、倒車 ×${c1.rev}、降低 4 階重心 ×${c1.cog}`);
  }

  const c2 = await sec('2. 開進去、改裝面板、鏡頭錨點、修車估價', async () => {
    const N = window.__nc, C = N.chrome, v = N.vehicles[0], M = N.motors; __t.reset();
    M.cash = 500000; delete M.mods.ae86;
    const ctx = __t.pad(); N.act();
    for (let i = 0; i < 40 && N.getStats().where !== 'chrome'; i++) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, 800));
    N.player.x = C.CHROME_CAR.x + 2.6; N.player.z = C.CHROME_CAR.z; __t.step(1); const ctx2 = N.ctx(); N.act();
    const rows = C.panel().rows.map(r => r.name);
    const cam = {}; for (const [k, n] of [['排氣管與喇叭', 'rear'], ['引擎調校', 'engine'], ['輪胎與燒胎煙', 'wheel'], ['擾流尾翼', 'wing']]) { C.choose(k); cam[k] = C.panel().cam; C.key('Escape'); }
    const c0 = M.cash, e0 = v.eng; C.choose('引擎調校'); C.choose('EMS 改裝 2 級'); const ems = [+(v.eng / e0).toFixed(3), c0 - M.cash]; C.key('Escape');
    // 受損：其他類別鎖住、修車估價照公式
    v.hp = v.hpMax * .3; v.glass = 1; v.axle = 1; C.close(); N.act();
    const locked = C.panel().rows.filter(r => r.off).length, P = C.repairParts(), cost = C.repairCost();
    C.choose('修復載具'); const fixed = v.hp === v.hpMax && !v.glass && !v.axle;
    C.close();
    return { ctx, where: N.getStats().where, ctx2, rows, cam, ems, locked, P, cost, fixed };
  });
  if (c2) {
    check(/開進 CHROME WORKS/.test(c2.ctx || '') && c2.where === 'chrome' && /改裝/.test(c2.ctx2 || ''), `門口開進改裝廠、走到馬力機旁改裝（${c2.ctx2}）`);
    check(c2.rows.length === 14 && c2.rows[13] === '開車離開', `面板 13 類＋開車離開`);
    check(c2.cam['排氣管與喇叭'] === 'rear' && c2.cam['引擎調校'] === 'engine' && c2.cam['輪胎與燒胎煙'] === 'wheel' && c2.cam['擾流尾翼'] === 'wing', `鏡頭錨點 ${JSON.stringify(c2.cam)}`);
    check(c2.ems[0] === 1.16 && c2.ems[1] === 5000, `EMS 2 級：加速 ×${c2.ems[0]}、付 ${c2.ems[1]}`);
    const want = Math.round(300 * .7 + 35 * 6 + 80 * 4 + 150);
    check(c2.locked === 13 && c2.cost === want && c2.fixed, `受損時其他 13 類鎖住、估價 ${c2.cost}（公式 ${want}：${JSON.stringify(c2.P)}）、修好`);
  }

  const c3 = await sec('3. 烤漆材質、車牌、通緝中躲進來換牌消星', async () => {
    const N = window.__nc, C = N.chrome, v = N.vehicles[0], M = N.motors, G = N.gta;
    N.act();
    C.choose('烤漆與車牌'); C.choose('烤漆材質'); C.choose('消光漆'); const pf = M.mods.ae86.pf; C.key('Escape');
    C.choose('車牌'); C.choose('自訂車牌…'); const typed = C.plateIn('JAXKILLS'); const plate = v.plate; C.key('Escape'); C.key('Escape');
    C.choose('開車離開');
    for (let i = 0; i < 40 && N.getStats().where !== 'out'; i++) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, 300));
    G.wanted.set(2); G.wanted.W.seen = true; G.wanted.W.visT = 99; const ctxSeen = __t.pad();
    G.wanted.W.seen = false; G.wanted.W.visT = 99; const ctxHide = __t.pad(); N.act();
    for (let i = 0; i < 40 && N.getStats().where !== 'chrome'; i++) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, 500));
    G.wanted.W.seen = false; N.player.x = C.CHROME_CAR.x + 2.6; N.player.z = C.CHROME_CAR.z; __t.step(1); N.act();
    C.choose('烤漆與車牌'); C.choose('車牌'); C.choose('隨機新車牌');
    const stars = G.wanted.W.stars; C.close();
    return { pf, typed, plate, ctxSeen, ctxHide, stars };
  });
  if (c3) {
    check(c3.pf === 2 && c3.typed && c3.plate === 'JAXKILLS', `消光漆（pf ${c3.pf}）、自訂車牌 ${c3.plate}`);
    check(/捲門鎖死/.test(c3.ctxSeen || '') && /躲進/.test(c3.ctxHide || ''), `被看到時捲門鎖死、甩開視線可以躲進來（${c3.ctxSeen} → ${c3.ctxHide}）`);
    check(c3.stars === 0, `在店裡換牌消星（${c3.stars} 星）`);
  }

  const c4 = await sec('4. 拔槍關店、鋼瓶、重新營業', () => {
    const N = window.__nc, V = N.gta.v6, C = N.chrome;
    N.gta.god.on = true;
    V.violence(); const close = V.V6.closeT, mode = V.V6.fight.mode;
    __t.step(60);
    const staff = C.st.staff.map(s => s.st);
    const block = V.doorBlock(N.vehicles[0]);
    V.reopen(); const cyl = V.CYL.map(c => c.on); V.cylinder(0); const cyl2 = V.CYL.map(c => c.on), close2 = V.V6.closeT;
    V.reopen(); N.gta.god.on = false;
    return { close, mode, staff, block, cyl, cyl2, close2 };
  });
  if (c4) {
    check(c4.close === 120 && /^(flee|fight)$/.test(c4.mode), `暴力事件：歇業 ${c4.close} 秒（${c4.mode === 'flee' ? '店員報警逃走' : '強尼與學徒反擊'}：${c4.staff.join('、')}）`);
    check(/歇業/.test(c4.block), `歇業時捲門不開（${c4.block}）`);
    check(c4.cyl.join() === '1,1' && c4.cyl2[0] === 0 && c4.close2 > 0, `打中鋼瓶爆炸、算暴力事件（${c4.cyl2.join()}）`);
  }

  const c5 = await sec('5. 歇業倒數：離開 300 m 以上累計 120 秒', () => {
    const N = window.__nc, V = N.gta.v6;
    V.violence(); N.exit(); __t.step(2);
    const p = N.chrome.pad(); N.tp(p.x + 340, p.z); __t.step(1);
    V.V6.closeT = 1; __t.step(70);
    return { open: V.V6.closeT, staff: N.chrome.st.staff.map(s => s.st) };
  });
  if (c5) check(c5.open === 0 && c5.staff.every(s => s === 'work'), `遠離後重新營業（${c5.staff.join('、')}）`);

  const c6 = await sec('6. 液壓：切換高低、彈跳 1.2 m', () => {
    const N = window.__nc, V = N.gta.v6, M = N.motors, v = N.vehicles[0]; __t.reset();
    M.mods.ae86 = { ...(M.mods.ae86 || {}), sus: 5 }; N.drive(); N.chrome.apply();
    const p = N.chrome.pad(); v.x = p.x; v.z = p.z; v.vx = v.vz = 0; __t.step(1);
    V.hydra.tap(); __t.step(40); const hi = V.hydra.st.hi, y = +v.hydY.toFixed(2);
    V.hydra.hop(); __t.step(1); const air = !!v.air, vy = v.air ? +(v.air.vy + 9.8 / 60).toFixed(2) : 0; __t.step(90);
    return { hydra: v.hydra, hi, y, air, vy, landed: !v.air };
  });
  if (c6) check(c6.hydra && c6.hi === 1 && c6.y > .2 && c6.air && Math.abs(c6.vy * c6.vy / (2 * 9.8) - 1.2) < .1 && c6.landed, `液壓升到 ${c6.y} m、彈跳初速 ${c6.vy} m/s（${(c6.vy * c6.vy / 19.6).toFixed(2)} m）並落地`);

  const c7 = await sec('7. 防撞鏟、歪軸、保險', () => {
    const N = window.__nc, V = N.gta.v6, M = N.motors, v = N.vehicles[0]; __t.reset();
    M.mods.ae86 = { ...(M.mods.ae86 || {}), bmp: 3 }; N.drive(); N.chrome.apply();
    const B = V.steal(); N.walk();
    // 自己的車正對 B、時速 40 衝過去
    v.x = B.x - Math.sin(B.yaw) * 4; v.z = B.z - Math.cos(B.yaw) * 4; v.yaw = B.yaw; v.vx = Math.sin(v.yaw) * 11; v.vz = Math.cos(v.yaw) * 11;
    V.plow(v, B); const tumble = !!B.tumble, flat = B.tires ? B.tires.filter(t => t.front && t.flat).length : 0;
    // 歪軸：讓亂數一定中
    const rnd = Math.random; Math.random = () => 0;
    N.drive(); v.vx = v.vz = 0; V.V6.prevSp = 20; __t.step(1); Math.random = rnd;
    const axle = V.axle(), yr = v.axleYr;
    // 保險
    delete M.mods.ae86.ins; const reb = V.rebuild('ae86'); M.mods.ae86.ins = 1; const ded = V.deduct('ae86');
    N.walk(); N.gta.explode(v); const msg = document.getElementById('toast').textContent; const c0 = M.cash; const ok = V.claim(); const paid = c0 - M.cash;
    return { tumble, flat, axle, yr, reb, ded, msg, ok, paid };
  });
  if (c7) {
    check(c7.tumble && c7.flat === 2, `尖刺鏟正面撞車：對方被鏟起、前輪扎破 ${c7.flat} 顆`);
    check(c7.axle === 1 && Math.abs(c7.yr) > .1, `重撞撞歪輪軸（${c7.axle}、偏 ${c7.yr.toFixed(2)}）`);
    check(c7.reb >= 2500 && c7.ded > 0 && c7.ded < c7.reb && /磐石互保/.test(c7.msg) && c7.ok && c7.paid === c7.ded, `沒保險重建費 ${c7.reb}、投保後自付額 ${c7.ded}（付 ${c7.paid}）`);
  }

  const c8 = await sec('8. 炸彈：點火炸彈的偷車賊、手機遙控', async () => {
    const N = window.__nc, V = N.gta.v6, M = N.motors, v = N.vehicles[0]; __t.reset();
    M.mods.ae86 = { ...(M.mods.ae86 || {}), bomb: 1 };
    const p = N.chrome.pad(); N.drive(); window.__nc.gta.wreck.fix(v); v.dead = 0; N.chrome.apply(); v.x = p.x; v.z = p.z; v.vx = v.vz = 0; __t.step(1);
    const bomb1 = v.bomb; N.walk(); N.tp(p.x + 30, p.z); V.park(9); __t.step(2);
    const bait = V.bait(); let blew = false;
    if (bait) { bait.x = v.x + 1; bait.z = v.z; for (let i = 0; i < 60; i++) { __t.step(1); if (v.dead) { blew = true; break; } } }
    const after = M.mods.ae86 && M.mods.ae86.bomb;
    // 遙控
    window.__nc.gta.wreck.fix(v); v.dead = 0; M.mods.ae86 = { ...(M.mods.ae86 || {}), bomb: 2 }; N.chrome.apply(); v.g.visible = true;
    V.detonate(); await new Promise(r => setTimeout(r, 700));
    return { bomb1, bait: !!bait, blew, after: after || 0, remote: !!v.dead };
  });
  if (c8) {
    check(c8.bomb1 === 1 && c8.bait && c8.blew && !c8.after, `點火炸彈：偷車賊上鉤、上車就炸、炸彈用掉`);
    check(c8.remote, '手機遙控炸彈引爆');
  }

  const c9 = await sec('9. 銷贓：出口車單 ×2.5、一般街車冷卻 15 分鐘、太燙手的超跑', async () => {
    const N = window.__nc, V = N.gta.v6, M = N.motors; __t.reset(); window.__nc.gta.wreck.fix(N.vehicles[0]); N.vehicles[0].dead = 0;
    M.v6.sellT = 0; const E = V.exp();
    const B = V.steal(E.list[0]) || V.steal(); const exp = E.list.includes(B.type);
    const q = V.quote(B); const ctx = __t.pad(B); N.act();
    for (let i = 0; i < 40 && N.getStats().where !== 'chrome'; i++) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, 500));
    const c0 = M.cash; V.sell(); const paid = M.cash - c0, cd = M.v6.sellT > Date.now();
    N.exit(); await new Promise(r => setTimeout(r, 900));
    // 超跑：值 > 10 萬就不收
    const fake = { carId: 'p1', type: null, name: 'P1' }, hot = V.hot(fake);
    M.props.own.includes('chrome') || M.props.own.push('chrome'); M.v6.wipe = 1; const hot2 = V.hot(fake); M.v6.wipe = 0;
    return { type: B.type, val: V.value(B), exp, q, ctx, paid, cd, hot, hot2 };
  });
  if (c9) {
    check(/工位 4/.test(c9.ctx || '') && c9.paid === c9.q.pay && c9.paid > 0, `${c9.type} 開進工位 4 賣掉 ${c9.paid}（市價 ${c9.val}${c9.exp ? '、出口車單 ×2.5' : ''}）`);
    check(c9.exp ? !c9.cd && c9.q.pay === Math.round(c9.val * .1 * 2.5 / 10) * 10 : c9.cd, c9.exp ? '出口車單不算冷卻' : '賣完一般街車進入冷卻');
    check(c9.hot && !c9.hot2, '超過 $100,000 的贓車太燙手；買下車廠並裝晶片抹除儀就收');
  }

  const c10 = await sec('10. 收購車廠：老闆 Kael 全免；客戶委託改裝與外送', async () => {
    const N = window.__nc, V = N.gta.v6, M = N.motors, C = N.chrome; __t.reset();
    M.props.own.includes('chrome') || M.props.own.push('chrome');
    const free = V.free(); const c0 = M.cash;
    V.offer(); const J = V.job();
    // 走進去（門口按 E）
    N.walk(); V.walkIn();
    for (let i = 0; i < 40 && N.getStats().where !== 'chrome'; i++) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, 500));
    N.player.x = C.BAY1.x + 2.6; N.player.z = C.BAY1.z; __t.step(1); const ctx = N.ctx();
    V.openJob(); const rows = C.panel().rows.map(r => r.name); C.choose('修復載具');
    for (const r of J.req) { if (r.k === 'fix') continue; if (r.k === 'pc') J.paint = r.n; else J.m[r.k] = r.n; }
    const ok = V.reqOk(); const paidMods = c0 - M.cash; C.close(); V.jobDone();
    for (let i = 0; i < 40 && N.getStats().where !== 'out'; i++) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, 500));
    const v = N.player.veh, inJob = v === J.v; v.hp -= 20; __t.step(3); const bonus = J.bonus;
    v.x = J.dest.x; v.z = J.dest.z; v.vx = v.vz = 0; const c1 = M.cash; __t.step(5);
    return { free, req: J.req.length, ctx, rows: rows.length, ok, paidMods, inJob, bonus, paid: M.cash - c1, done: !V.job() };
  });
  if (c10) {
    check(c10.free, 'Kael 買下車廠後修車改裝全免');
    check(/客戶/.test(c10.ctx || '') && c10.req >= 4 && c10.ok && c10.paidMods === 0, `工位 1 的客戶車照清單改好（${c10.req} 項、你付 ${c10.paidMods}）`);
    check(c10.inJob && c10.bonus === 8500 && c10.paid === 25000 + 8500 && c10.done, `外送：擦撞一次扣 1,500、交車拿 ${c10.paid}`);
  }

  const c11 = await sec('11. 2 樓私人車庫與存檔第 11 版', async () => {
    const N = window.__nc, V = N.gta.v6, M = N.motors; __t.reset();
    if (!M.owned.includes('r34')) M.owned.push('r34');
    V.walkIn();
    for (let i = 0; i < 40 && N.getStats().where !== 'chrome'; i++) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, 500));
    V.stairs(true); await new Promise(r => setTimeout(r, 900));
    const y = N.player.y, priv = V.priv(); V.take('r34');
    const car = N.vehicles[0].carId, parked = N.chrome.st.parked;
    const save = JSON.parse(localStorage.getItem('nc260.motors'));
    return { y, priv, car, parked, v: save.v, v6: !!save.v6, pl: save.mods.ae86 && save.mods.ae86.pl };
  });
  if (c11) {
    check(c11.y === 4.8 && c11.priv.includes('r34'), `走樓梯上 2 樓（${c11.y} m）、私人車庫有 ${c11.priv.join('、')}`);
    check(c11.car === 'r34' && c11.parked, '挑一台開到馬力機上');
    check(c11.v === 11 && c11.v6 && c11.pl === 'JAXKILLS', `存檔第 ${c11.v} 版（v6、車牌 ${c11.pl}）`);
  }

  const errs = log.pageerrors.concat(log.errors.filter(e => !/favicon|ERR_FILE_NOT_FOUND/.test(e)));
  check(!errs.length, `沒有錯誤${errs.length ? '：' + errs.slice(0, 3).join(' | ') : ''}`);
} finally {
  await browser.close();
  console.log(failed ? `✗ ${failed} 項沒過` : '✓ 全部通過');
  process.exit(failed ? 1 : 0);
}
