// 第七部曲（夜店、賭場、地堡，neon_nightcity_gta_v_1.md）的驗收：
// LAZARUS 人氣與保險箱公式、技術員生產、洗錢抽成、舞池倍率、鬧事 A、馬克白斷片；
// 霓鑽賭場 1 樓禁武器、轉盤機率、老虎機回報、21 點計分、金庫劫案（雙卡 1.5 秒、氣閘、柵門、金條負重、毒氣、5 星鎖定）；
// 北嶺地堡的物資、生產與研究公式、市中心出貨 ×1.5、Mk II 彈種、攔截軍火列車（貨運編成）；存檔第 12 版
// 用法：node tools/check-gta-v7.mjs [html]（預設 web/260-neon-nightcity.html）。
// 每次 step 都會畫一幀，軟體繪圖很慢，所以這裡大多直接呼叫規則函式，只在必要時推進幾幀
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
  try { return await page.evaluate(fn, arg); } catch (e) { check(false, `執行失敗：${String(e.message || e).split('\n').slice(0, process.env.V7_STACK ? 8 : 1).join('\n    ')}`); return null; }
}
await page.evaluate(() => {
  window.__t = {
    wait: ms => new Promise(r => setTimeout(r, ms)),
    // 轉場是 setTimeout，軟體繪圖一幀好幾秒會把它拖住：輪詢到條件成立而且淡出結束（淡出中再轉場會被 transition 忽略），最多 60 秒
    async until(fn, ms = 60000) { for (const t0 = Date.now(); Date.now() - t0 < ms;) { if (fn() && !document.getElementById('fade').classList.contains('on')) return true; await new Promise(r => setTimeout(r, 100)); } return false; },
    reset() { const N = window.__nc; N.gta.wanted.clear('reset'); N.gta.life.hp = 100; N.gta.life.dead = false; if (N.player.mode === 'drive') N.walk(); N.player.down = 0; N.closeDialog(); },
    own(id) { const P = window.__nc.motors.props; if (!P.own.includes(id)) P.own.push(id); },
  };
});

try {
  await page.evaluate(() => window.__nc.start());
  await page.waitForTimeout(800);

  const c1 = await sec('1. LAZARUS：每日收入、人氣衰退、保險箱上限、技術員與洗錢抽成', () => {
    const N = window.__nc, C = N.gta.v7.club, M = N.motors; __t.reset(); __t.own('lazarus');
    const S = C.st(), daily = [0, 20, 50, 100].map(P => C.daily(P));
    M.props.safe.lazarus = 0; S.pop = 60; delete M.props.pause.lazarus;
    const day = N.gameHour * 24, d60 = C.daily(60);
    C.tick(day);
    const safe1 = Math.round(M.props.safe.lazarus), pop1 = +S.pop.toFixed(2);
    M.props.safe.lazarus = 249990; S.full = 0; C.tick(day);
    const capped = M.props.safe.lazarus, full = S.full;
    C.pop(10); const empty = C.crowdN(); C.pop(90); const busy = C.crowdN();
    S.hired = 2; S.job = ['coke', 'cash', null, null, null]; S.gT = [0, 0, 0, 0, 0]; S.goods.coke = 0; S.goods.cash = 0;
    C.tick(241);
    const made = [S.goods.coke, S.goods.cash];
    S.goods.cash = 40; C.tick(31); const capCash = S.goods.cash;
    return { daily, d60, safe1, pop1, capped, full, empty, busy, made, capCash, fee: [C.fee(300000), C.fee(2000000)], goods: C.GOODS.length };
  });
  if (c1) {
    check(c1.daily.join() === '1500,3440,13625,50000', `每日 1500 + 48500·(P/100)²：${c1.daily.join('／')}`);
    check(Math.abs(c1.safe1 - c1.d60) <= 1 && c1.pop1 === 55, `一整天保險箱 +${c1.safe1}（P 60 → ${c1.d60}）、人氣 60 → ${c1.pop1}%`);
    check(c1.capped === 250000 && c1.full === 1, `保險箱上限 $250,000、滿了傳簡訊（${c1.capped}）`);
    check(c1.empty <= 3 && c1.busy > c1.empty, `人氣 < 20% 舞池剩 ${c1.empty} 人、90% 有 ${c1.busy} 人`);
    check(c1.made.join() === '2,8' && c1.capCash === 40, `技術員：古柯鹼 120 秒一箱、假鈔 30 秒一箱（${c1.made.join('／')}），庫存滿了停工`);
    check(c1.fee.join() === '30000,100000' && c1.goods === 5, `洗錢抽成 10%、最多 $100,000（${c1.fee.join('／')}）`);
  }

  const c2 = await sec('2. 舞池節奏倍率（128 BPM、1–4×）與鬧事 A', async () => {
    const N = window.__nc, C = N.gta.v7.club, M = N.motors; __t.reset();
    N.enter('club'); C.level(0); N.player.x = 0; N.player.z = 18;
    C.beat.start();
    const real = N.sfx.beat; let b = 100;
    N.sfx.beat = () => b;
    const mult = [];
    for (let i = 0; i < 26; i++) { b += 1; C.beat.hit(); mult.push(C.beat.st().mult); }
    b += 1.5; C.beat.hit(); const miss = C.beat.st().mult;
    N.sfx.beat = real; C.beat.end();
    C.pop(40); const cash0 = M.cash;
    C.trouble.start('vomit'); C.trouble.a();
    await __t.until(() => !C.trouble.st() && M.cash > cash0);
    return { m8: mult[6], m9: mult[7], max: Math.max(...mult), last: mult[25], miss, pop: Math.round(C.st().pop), paid: M.cash - cash0, tr: !!C.trouble.st() };
  });
  if (c2) {
    check(c2.m8 === 1 && c2.m9 === 2 && c2.max === 4 && c2.last === 4, `連擊每 8 拍升一級，最高 4×（第 7 拍 ${c2.m8}×、第 8 拍 ${c2.m9}×、最高 ${c2.max}×）`);
    check(c2.miss === 1, '沒踩到拍子倍率歸零');
    check(c2.pop >= 65 && c2.paid === 10000 && !c2.tr, `鬧事 A：人氣 +25%（${c2.pop}%）、報酬 $${c2.paid}`);
  }

  const c3 = await sec('3. 馬克白威士忌：斷片醒在五處之一', async () => {
    const N = window.__nc, C = N.gta.v7.club; __t.reset();
    N.enter('club'); C.level(0); N.player.x = -8; N.player.z = 10;
    C.macbeth('dump'); C.drinkStep(4); C.drinkStep(2);
    await __t.until(() => C.last() === 'dump' && N.player.where === 'out');
    return { spots: C.spots, last: C.last(), where: N.player.where, under: C.under(), hang: C.hang() };
  });
  if (c3) {
    check(c3.spots.length === 5, `斷片地點 ${c3.spots.length} 處（${c3.spots.join('、')}）`);
    check(c3.last === 'dump' && c3.where === 'out' && c3.under > 0 && c3.hang > 0, `醒在 ${c3.last}、身上只剩內衣、宿醉模糊`);
  }

  const c4 = await sec('4. 北嶺地堡：物資、生產與研究、市中心 ×1.5、Mk II', async () => {
    const N = window.__nc, B = N.gta.v7.bunker, M = N.motors; __t.reset(); __t.own('bunker');
    const S = B.st(); S.S = 100; S.stock = 0; S.alpha = 1; S.ri = 0; S.res = 0; S.buyT = 0;
    B.tick(100); const prod = [Math.round(S.S * 100) / 100, Math.round(S.stock)];
    S.alpha = 0; S.S = 100; B.tick(100); const res = +S.res.toFixed(2);
    S.alpha = .5; S.S = 100; S.res = 0; S.stock = 0; B.tick(100); const half = [Math.round(S.stock), +S.res.toFixed(2)];
    S.S = 0; S.buyT = 180; B.tick(90); const fill = +S.S.toFixed(1);
    S.stock = 1.04e6; S.S = 100; S.alpha = 1; B.tick(100); const cap = S.stock;
    const unl0 = ['inc', 'hp', 'exp', 'ap', 'fmj', 'thermal'].map(B.unl);
    S.ri = 0; S.res = 99.9; S.alpha = 0; S.S = 100; B.tick(1); const ri = S.ri;
    // 市中心出貨
    N.enter('bunker'); S.stock = 400000;
    B.sell(1.5); await __t.until(() => B.selling());
    const sell = B.selling(), val = sell && sell.val, where = N.player.where;
    if (sell) N.gta.side.side.act.fail('驗收');
    // Mk II：升級狙擊槍、熱成像要研究
    S.mk.sniper = 1; S.rounds.inc = 120; S.rounds.exp = 40; S.rounds.hp = 0; S.ri = 0; S.sel.sniper = '';
    N.gta.equip('sniper', true);
    B.cycle(); const a1 = S.sel.sniper; B.cycle(); const a2 = S.sel.sniper;
    S.ri = 4; B.cycle(); const a3 = S.sel.sniper; S.sel.sniper = '';
    const heat = B.heat();
    return { prod, res, half, fill, cap, unl0, ri, val, where, a: [a1, a2, a3], mk: B.mk('sniper'), sup: B.door() ? 1 : 0, fort: B.fort.on ? 1 : 0, heat };
  });
  if (c4) {
    check(c4.prod.join() === '85,210000', `全力生產 100 秒：物資 −0.15/s（剩 ${c4.prod[0]}%）、庫存 +2100/s（${c4.prod[1]}）`);
    check(c4.res === 45 && c4.half.join() === '105000,22.5', `全力研究 100 秒 +${c4.res}%、各半 ${c4.half.join(' / ')}`);
    check(c4.fill === 36.5 && c4.cap === 1050000, `買的物資 3 分鐘補滿（90 秒：+50% − 用掉 13.5% = ${c4.fill}%）、庫存上限 $1,050,000`);
    check(c4.unl0.join() === 'true,true,false,false,false,false' && c4.ri === 1, '燃燒彈與空尖彈預設解鎖，研究依序解開爆裂、穿甲、全金屬、熱成像');
    check(c4.val === 600000 && c4.where === 'out', `市中心買家 ×1.5（$400,000 → $${c4.val}）`);
    check(c4.mk && c4.a.join() === 'inc,,exp', `Mk II 狙擊槍 B 鍵切換彈種（研究前跳過爆裂彈，研究後可選：${c4.a.map(a => a || '普通').join('→')}）`);
    check(c4.sup && c4.fort && c4.heat > 0, `地堡防爆門（${c4.sup}）與霓虹堡（${c4.fort}）都在城裡、熱成像抓到 ${c4.heat} 個熱源`);
  }

  const c4b = await sec('4b. 攔截軍火列車：叫的是貨運列車，打斷平車掛鉤、最後一箱掉在橋面上', async () => {
    const N = window.__nc, B = N.gta.v7.bunker, r = N.props.rail, R = r.R; __t.reset();
    if (!R) return { skip: 1 };
    R.state = 'wait'; R.tw = 1e9; r.go(1, R.len, 'pax'); R.state = 'wait'; R.tw = 1e9;   // 先停在洞裡、編成是電聯車
    __t.own('bunker'); N.enter('bunker'); await __t.until(() => N.player.where === 'bunker');   // 補給要在地堡裡的電腦接（exitVenue 走出來）
    B.sup('train'); await __t.until(() => B.supSt() && B.supSt().goal && N.player.where === 'out');
    const S = B.supSt(); N.tp(S.goal.x, S.goal.z); B.supStep(1 / 60);
    const kind = R.kind, run = R.state;
    R.s = R.len / 2 + R.trainL / 2; R.speed = 0; B.supStep(1 / 60);
    const tail = S.tail ? [...S.tail] : null, fl = R.cars[R.cars.length - 1], c0 = fl.cargo.filter(o => o.visible).length;
    // 從旁邊 10 m 朝最後一節的掛鉤水平開三槍（69-combat 的 shoot 每發子彈都呼叫 trainShot）
    const ray = tail && { ox: tail[0] + 10, oy: R.D + 1.5, oz: tail[1], dx: -1, dy: 0, dz: 0 };
    for (let i = 0; i < 3 && ray; i++) B.trainShot(ray);
    const st = S.st, c1 = fl.cargo.filter(o => o.visible).length, crate = S.crate && Math.hypot(S.crate.x - tail[0], S.crate.z - tail[1]);
    const A = N.gta.side.side.act; if (A && A.kind === 'bunkersup') A.fail('驗收結束');
    R.speed = 17; R.state = 'wait'; R.tw = 30;
    return { kind, run, tail: !!tail, c0, c1, st, crate };
  });
  if (c4b && !c4b.skip) {
    check(c4b.kind === 'frt' && c4b.run === 'run', `走近鐵道橋叫來的是貨運列車（${c4b.kind}／${c4b.run}）`);
    check(c4b.tail && c4b.st === 'crate' && c4b.c0 === 4 && c4b.c1 === 3 && c4b.crate < .01, `三槍打斷掛鉤：平車的貨箱 ${c4b.c0} → ${c4b.c1}、掉在橋面上（${c4b.st}）`);
  }

  const c5 = await sec('5. 霓鑽賭場：1 樓禁武器、轉盤、老虎機、21 點、輪盤', async () => {
    const N = window.__nc, K = N.gta.v7.casino, M = N.motors; __t.reset();
    N.gta.equip('pistol', true);
    N.tp(K.door().x, K.door().z); K.enter(); await __t.until(() => N.player.where === 'casino');
    const where = N.player.where, sel = N.gta.arm.sel;
    const W = K.WHEEL, cnt = { car: W.filter(w => w.car).length, big: W.filter(w => w.cash || w.chips >= 25000).length, myst: W.filter(w => w.myst).length };
    cnt.misc = W.length - cnt.car - cnt.big - cnt.myst;
    // 老虎機的理論回報
    const L = K.SLOT_STRIP.length, p = s => K.SLOT_STRIP.filter(x => x === s).length / L;
    let rtp = 0; for (const [s, , k] of K.SLOT_SYM) rtp += p(s) ** 3 * k;
    const c = p('櫻'); rtp += 3 * c * (1 - c) ** 2 * 1 + 3 * c * c * (1 - c) * 2;
    const dia = K.SLOT_SYM.find(s => s[0] === '◆')[2];
    // 轉盤：一天一次，強制轉到頭獎
    K.st().wheel = 0; M.owned = M.owned.filter(id => id !== 'evija');
    const r0 = K.ready(); K.spin(); const r1 = K.ready();
    K.CAS.spin.i = 0; K.wheelStep(6);
    const car = M.owned.includes('evija');
    const bj = [[{ r: 1 }, { r: 13 }], [{ r: 1 }, { r: 1 }, { r: 9 }], [{ r: 13 }, { r: 12 }, { r: 5 }]].map(K.bj.val);
    const tcp = [[{ r: 2, s: 0 }, { r: 3, s: 0 }, { r: 4, s: 0 }], [{ r: 9, s: 0 }, { r: 9, s: 1 }, { r: 9, s: 2 }], [{ r: 2, s: 0 }, { r: 7, s: 0 }, { r: 11, s: 0 }], [{ r: 5, s: 1 }, { r: 5, s: 0 }, { r: 11, s: 2 }]].map(h => K.tcp.rank(h).cat);
    // 美式輪盤：38 格，每一種押法的回報都是 36/38；強制開出 7（紅、單、第一打）
    const nums = [-1, ...Array.from({ length: 37 }, (_, i) => i)];
    const rl = K.rl.BETS.map(b => nums.filter(b.hit).length * (b.k + 1) / 38);
    const chips0 = K.st().chips; K.rl.spin(0, 100, 7); K.rl.step(3.1); const red = K.st().chips - chips0;
    K.rl.spin(3, 100, -1); K.rl.step(3.1); const zz = K.st().chips - chips0 - red; N.closeDialog();
    N.exit();
    return { where, sel, cnt, rtp: +rtp.toFixed(3), dia, r0, r1, car, bj, tcp, rl: [Math.min(...rl), Math.max(...rl)].map(v => +v.toFixed(4)), red, zz, nRl: K.rl.BETS.length };
  });
  if (c5) {
    check(c5.where === 'casino' && c5.sel === 'fist', `進 1 樓武器自動收起（${c5.sel}）`);
    check(c5.cnt.car === 1 && c5.cnt.big === 4 && c5.cnt.myst === 2 && c5.cnt.misc === 13, `轉盤 20 格：車 1、現金／大額籌碼 4、神秘 2、其他 13`);
    check(c5.r0 && !c5.r1 && c5.car, '一天轉一次，頭獎把展示台的車停進車庫');
    check(c5.dia === 1000 && c5.rtp > .85 && c5.rtp < 1, `三顆鑽石 1000 倍，理論回報 ${(c5.rtp * 100).toFixed(1)}%`);
    check(c5.bj.join() === '21,21,25', `21 點計分（A 可當 1 或 11）：${c5.bj.join('／')}`);
    check(c5.rl[0] === c5.rl[1] && Math.abs(c5.rl[0] - 36 / 38) < 1e-4, `輪盤 ${c5.nRl} 種押法的回報都是 36/38（${(c5.rl[0] * 100).toFixed(2)}%）`);
    check(c5.red === 200 && c5.zz === 0, `輪盤開出 7 押紅拿回 ${c5.red}；開出 00 押雙拿回 ${c5.zz}`);
    check(c5.tcp[0] === 5 && c5.tcp[1] === 4 && c5.tcp[2] === 2 && c5.tcp[3] === 1, `三張牌撲克牌型：同花順 > 三條 > 同花 > 一對（${c5.tcp.join('／')}）`);
  }

  const c6 = await sec('6. 金庫劫案 B：EMP、雙卡 1.5 秒、氣閘、柵門、金條負重、毒氣與 5 星', async () => {
    const N = window.__nc, K = N.gta.v7.casino, M = N.motors, life = N.gta.life; __t.reset();
    M.cash = Math.max(M.cash, 200000); K.st().tgt = 'gold';
    N.enter('bar'); const cash0 = M.cash;
    K.plan('B'); await __t.until(() => N.player.where === 'out');
    const H = K.h(), prep = cash0 - M.cash, go = H && H.st, w0 = N.player.where;
    K.breach(); await __t.until(() => N.player.where === 'casinoB');
    const w1 = N.player.where, emp = Math.round(K.CAS.emp), timer = K.APPS.B.time;
    K.gs().forEach((g, i) => K.takedown(i));   // 全部無聲制伏，別讓警衛開槍干擾計時
    K.card(0); K.hstep(1.6); const fail1 = H.cardFail, m0a = K.doors().m0;
    K.card(0); K.hstep(.5); K.card(1); const m0b = K.doors().m0;
    N.player.x = 0; N.player.z = 25; K.hstep(.05); const mant = H.mant > 0 && !K.doors().m0;
    K.hstep(3.1); const st = H.st, t0 = H.timer;
    // 柵門：破解指紋鎖 3 秒、拿金條 4 秒
    for (let i = 0; i < 4; i++) { K.gate(i); K.hstep(3.1); K.gate(i); K.hstep(4.1); }
    const bag = H.bag.val, load = N.player.loadK, jump = K.st && N.gta.v7.key('Space');
    // 15 秒警告 → 毒氣
    H.timer = 15.2; K.hstep(.5); H.timer = .3; K.hstep(.5);
    const gas = H.gas, lock5 = K.CAS.lock5;
    life.hp = 100; life.armor = 100; K.hstep(1); const hp = +life.hp.toFixed(1), armor = life.armor;
    K.leave(); await __t.until(() => H.st === 'escape');
    const esc = H.st, stars = N.gta.wanted.W.stars;
    const c1 = M.cash, done0 = K.st().done;
    K.end(true);
    return { prep, go, w0, w1, emp, timer, fail1, m0a, m0b, mant, st, t0, bag, load, jump, gas, lock5, hp, armor, esc, stars, paid: M.cash - c1, done: K.st().done - done0, h: !!K.h(), loadAfter: N.player.loadK };
  });
  if (c6) {
    check(c6.prep === 35000 && c6.go === 'go' && c6.w0 === 'out', `付準備費 $${c6.prep}、出發去賭場`);
    check(c6.w1 === 'casinoB' && c6.emp > 50, `垂降到 B1、EMP 停電 ${c6.emp} 秒`);
    check(c6.fail1 === 1 && !c6.m0a && c6.m0b, '第二張卡超過 1.5 秒就逾時，兩張都刷才開氣閘外門');
    check(c6.mant && c6.st === 'vault' && c6.t0 > c6.timer - 4 && c6.t0 < c6.timer, `氣閘外門關上 3 秒後開內門、金庫倒數 ${c6.t0} 秒`);
    check(c6.bag === Math.round(2585000 / 6) * 4 && c6.load === .68 && c6.jump === true, `四堆金條 $${c6.bag}，金條過半 速度 ×${c6.load}、不能跳`);
    check(c6.gas === 1 && c6.lock5 === 90, '時間到釋放神經毒氣、通緝鎖 5 星 90 秒');
    check(c6.hp === 88 && c6.armor === 100, `毒氣每秒 −12 HP、無視護甲（HP ${c6.hp}、護甲 ${c6.armor}）`);
    check(c6.esc === 'escape' && c6.stars === 5, `毒氣後出來是 ${c6.stars} 星`);
    check(c6.paid === c6.bag && c6.done === 1 && !c6.h && c6.loadAfter === 1, `得手 $${c6.paid}、負重解除`);
  }

  const c7 = await sec('7. 金庫劫案 C：重型護甲、一進去就是警報', async () => {
    const N = window.__nc, K = N.gta.v7.casino, M = N.motors, life = N.gta.life; __t.reset();
    M.cash = Math.max(M.cash, 200000); N.enter('bar');
    K.plan('C'); await __t.until(() => N.player.where === 'out');
    life.armor = 0; K.breach('blast'); await __t.until(() => N.player.where === 'casinoB');
    const H = K.h(), r = { armor: life.armor, k: H.armorK, alarm: H.alarm, where: N.player.where, time: K.APPS.C.time, A: K.APPS.A.time };
    K.end(false); await __t.until(() => N.player.where === 'out');
    r.out = N.player.where; r.h = !!K.h();
    return r;
  });
  if (c7) {
    check(c7.armor === 100 && c7.k === .55 && c7.alarm && c7.where === 'casinoB', '炸開下水道：護甲補滿、子彈 ×0.55、警報大作');
    check(c7.time === 85 && c7.A === 150 && c7.out === 'out' && !c7.h, `金庫時限 A ${c7.A} 秒、C ${c7.time} 秒，放棄後回到街上`);
  }

  const c8 = await sec('8. 存檔第 12 版', () => {
    const N = window.__nc, V = N.gta.v7;
    V.club.st().pop = 42; V.casino.st().chips = 1234; V.bunker.st().stock = 777;
    N.earn(0, '驗收存檔');
    const s = JSON.parse(localStorage.getItem('nc260.motors'));
    return { v: s.v, keys: Object.keys(s.v7 || {}).sort().join(), pop: s.v7.club.pop, chips: s.v7.casino.chips, stock: s.v7.bunker.stock };
  });
  if (c8) check(c8.v === 12 && c8.keys === 'bunker,casino,club' && c8.pop === 42 && c8.chips === 1234 && c8.stock === 777, `存檔第 ${c8.v} 版（v7：${c8.keys}）`);

  const errs = log.pageerrors.concat(log.errors.filter(e => !/favicon|ERR_FILE_NOT_FOUND/.test(e)));
  check(!errs.length, `沒有錯誤${errs.length ? '：' + errs.slice(0, 3).join(' | ') : ''}`);
} finally {
  await browser.close();
  console.log(failed ? `✗ ${failed} 項沒過` : '✓ 全部通過');
  process.exit(failed ? 1 : 0);
}
