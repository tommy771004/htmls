// 第五部曲（城市建築設施藍圖與魔鬼細節）的驗收：醫院（醫藥費、醫療包、救護車、員工電梯、屋頂直升機）、第九分局（逃生梯、屋頂直升機）、
// 拖吊場（扣車、贖車、翻鐵絲網、撞破柵門）、走得上去的屋頂與從屋頂跳下去、存檔第 9 版；
// 商業設施：便利店搶劫與第二台收銀機、能量飲料、提款機、酒、槍店（背心、擴充彈匣、射擊場、老闆反擊）、服飾店甩星、車身血跡與洗車、自動捲門；
// 立體停車場：四條坡道開上頂樓、頂樓超跑與「飛躍霓虹大道」跳台、降落傘包與跳車開傘、電梯、入口柵欄桿
// 用法：node tools/check-gta-v5.mjs [html]（預設 web/260-neon-nightcity.html）
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
  try { return await page.evaluate(fn, arg); } catch (e) { check(false, `執行失敗：${String(e.message || e).split('\n').slice(0, process.env.V5_STACK ? 8 : 1).join('\n    ')}`); return null; }
}
await page.evaluate(() => {
  window.__t = {
    step(n) { for (let i = 0; i < n; i++) window.__nc.step(1 / 60); },
    wait: ms => new Promise(r => setTimeout(r, ms)),
    // 停車場的設施座標：世界 → 相對街區西北角（V.w 的反函數；這一片有彎曲與剪切，用牛頓法迭代）
    gar(x, z) {
      const V = window.__nc.gta.v5; let p = [36, 31];
      for (let k = 0; k < 6; k++) {
        const o = V.w('gar', p[0], p[1]), ex = V.w('gar', p[0] + 1, p[1]), ez = V.w('gar', p[0], p[1] + 1), a = ex[0] - o[0], b = ez[0] - o[0], c = ex[1] - o[1], d = ez[1] - o[1], det = a * d - b * c, X = x - o[0], Z = z - o[1];
        p = [p[0] + (d * X - b * Z) / det, p[1] + (-c * X + a * Z) / det];
      }
      return p;
    },
    reset() { const N = window.__nc; N.gta.wanted.clear('reset'); N.gta.life.hp = 100; if (N.player.mode === 'drive') N.walk(); N.player.air3 = null; N.player.down = 0; N.gta.v5.V5.lad = null; },
  };
});

try {
  await page.evaluate(() => window.__nc.start());
  await page.waitForTimeout(800);

  const c1 = await sec('1. 設施街區', () => {
    const N = window.__nc, V = N.gta.v5, F = V.FAC;
    return { ids: Object.keys(F).join(','), h: F.hosp.L.map(L => +L.h.toFixed(1)), pd: +F.pd.L[0].h.toFixed(1), helis: V.V5.helis.map(h => h.v && h.v.name), lads: V.LADS.length, ghost: F.hosp.b && N.ways ? 1 : 1 };
  });
  if (c1) {
    check(c1.ids === 'hosp,pd,mall,gar', `醫院、分局、商店街與立體停車場四個街區（${c1.ids}）`);
    check(c1.h[0] > 10 && c1.h[1] > 30 && c1.pd > 15, `急診樓、主樓、分局的高度 ${c1.h.join('／')}／${c1.pd}`);
    check(c1.helis.length === 2 && c1.helis.every(Boolean), `屋頂停兩架直升機（${c1.helis.join('、')}）`);
  }

  const c2 = await sec('2. 醫藥費 5%（上限 $5,000）與繃帶', async () => {
    const N = window.__nc, G = N.gta, V = G.v5; __t.reset(); N.walk();
    const fees = [180000, 20000, 0].map(c => { N.motors.cash = c; return V.hospFee(); });
    N.motors.cash = 20000; V.V5.dieImp = false;
    const [x, z] = V.w('hosp', 30, -20); N.tp(x, z);
    G.die('wasted'); G.respawn();
    return { fees, cash: N.motors.cash, band: V.V5.band > 0, where: Math.hypot(N.player.x - G.hosp.x, N.player.z - G.hosp.z) };
  });
  if (c2) {
    check(c2.fees.join() === '5000,1000,0', `醫藥費 ${c2.fees.join('／')}`);
    check(c2.cash === 19000 && c2.where < 1, `在醫院門口醒來、扣 $1,000（剩 ${c2.cash}）`);
    check(c2.band, '出院帶著繃帶');
  }

  const c3 = await sec('3. 醫療包', () => {
    const N = window.__nc, V = N.gta.v5, M = V.V5.medkits[0]; __t.reset();
    N.gta.life.hp = 30; N.tp(M.m.position.x + 3, M.m.position.z); __t.step(2);
    N.player.x = M.m.position.x; N.player.z = M.m.position.z; __t.step(3);
    return { hp: N.gta.life.hp, gone: !M.m.visible, t: Math.round(M.t) };
  });
  if (c3) check(Math.floor(c3.hp) === 80 && c3.gone && c3.t > 80, `撿到醫療包 +50（${JSON.stringify(c3)}）`);

  const c4 = await sec('4. 員工電梯上屋頂、搭電梯下樓', async () => {
    const N = window.__nc, V = N.gta.v5, F = V.FAC.hosp; __t.reset();
    const [x, z] = V.w('hosp', ...F.elev.down); N.tp(x, z); __t.step(2);
    const t0 = N.ctx(); N.act(); await __t.wait(700); __t.step(2);
    const up = +N.player.y.toFixed(2);
    const [ux, uz] = V.w('hosp', ...F.elev.up); N.player.x = ux; N.player.z = uz; __t.step(2);
    const t1 = N.ctx(); N.act(); await __t.wait(700); __t.step(2);
    return { t0, t1, up, down: +N.player.y.toFixed(2), hy: F.L[1].h };
  });
  if (c4) check(c4.t0 && c4.t0.includes('員工電梯') && Math.abs(c4.up - c4.hy) < .05 && c4.t1 && c4.down < .5, `電梯 ${c4.t0} → y ${c4.up} → ${c4.t1} → y ${c4.down}`);

  const c5 = await sec('5. 逃生梯：爬上屋頂、往下滑', () => {
    const N = window.__nc, V = N.gta.v5, L = V.LADS[0]; __t.reset();
    const [x, z] = V.w('pd', L.x + L.nx * .5, L.z + L.nz * .5); N.tp(x, z, V.yaw('pd', Math.atan2(-L.nx, -L.nz))); __t.step(2);
    const t0 = N.ctx(); N.act();
    N.keys.KeyW = true; N.keys.ShiftLeft = true; let n = 0;
    while (V.V5.lad && n < 900) { __t.step(1); n++; }
    N.keys.KeyW = false; N.keys.ShiftLeft = false; __t.step(30);
    const top = { y: +N.player.y.toFixed(2), t: +(n / 60).toFixed(1) };
    const t1 = N.ctx(); N.act(); N.keys.KeyS = true; N.keys.ShiftLeft = true; n = 0;
    while (V.V5.lad && n < 900) { __t.step(1); n++; }
    N.keys.KeyS = false; N.keys.ShiftLeft = false;
    return { t0, t1, top, down: { y: +N.player.y.toFixed(2), t: +(n / 60).toFixed(1) }, h: L.y1 };
  });
  if (c5) {
    check(c5.t0 && c5.t0.includes('逃生梯') && Math.abs(c5.top.y - c5.h) < .05, `${c5.t0} → 站上屋頂 y ${c5.top.y}（Shift 加速 ${c5.top.t} 秒）`);
    check(c5.t1 && c5.down.y < .5 && c5.down.t < 3.2, `${c5.t1} → 滑下去 ${c5.down.t} 秒`);
  }

  const c6 = await sec('6. 從屋頂邊緣跳下去', () => {
    const N = window.__nc, V = N.gta.v5, F = V.FAC.pd, B = F.L.find(L => L.o.roof); __t.reset();
    const [x, z] = V.w('pd', 50, B.z1 - F.az - .9); N.tp(x, z); N.player.y = B.h; N.player.yaw = V.yaw('pd', 0); __t.step(10);
    const on = +N.player.y.toFixed(2), j = V.roofJump(), air = N.player.air3 && N.player.air3.kind;
    __t.reset(); return { on, j, air, h: B.h };
  });
  if (c6) check(Math.abs(c6.on - c6.h) < .05 && c6.j && c6.air === 'fall', `站在屋頂（y ${c6.on}）、從邊緣跳下去變成自由落體（${c6.air}）`);

  const c7 = await sec('7. 拖吊場：死在車上 → 車被拖走、不能叫車、付 $250 開門、開出去領回', async () => {
    const N = window.__nc, G = N.gta, V = G.v5, F = V.FAC.pd; __t.reset();
    N.motors.cash = 5000; N.motors.v5.imp = 0; N.drive(); __t.step(2);
    G.die('wasted'); G.respawn(); __t.step(2);
    const imp = N.motors.v5.imp;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyV' })); __t.step(2);
    const still = N.motors.v5.imp, cash0 = N.motors.cash;
    const b = F.booth, [bx, bz] = V.w('pd', F.yard.x0 - F.ax + (b.x0 + b.x1) / 2, F.yard.z0 - F.az - 1.2); N.tp(bx, bz); __t.step(2);
    const t0 = N.ctx(); N.act(); __t.step(2);
    return { imp, still, cash0, cash1: N.motors.cash, t0, gate: V.V5.imp.gateT > 0 };
  });
  if (c7) {
    check(c7.imp === 1 && c7.still === 1, '死在自己的車上，車被拖進拖吊場；按 V 叫車沒用');
    check(c7.t0 && c7.t0.includes('贖車') && c7.cash0 - c7.cash1 === 250 && c7.gate, `${c7.t0} → 扣 $250、柵門打開`);
  }

  const c8 = await sec('8. 開出拖吊場就領回', () => {
    const N = window.__nc, V = N.gta.v5, F = V.FAC.pd; __t.reset();
    N.drive(); const v = N.player.veh, inside = V.inYard(v.x, v.z);
    const [x, z] = V.w('pd', 22, 4); v.x = x; v.z = z; __t.step(3);
    return { inside, imp: N.motors.v5.imp };
  });
  if (c8) check(c8.inside && c8.imp === 0, `車原本在拖吊場裡、開出柵門後 imp = ${c8 && c8.imp}`);

  const c9 = await sec('9. 撞破柵門 → 2 星；翻鐵絲網', () => {
    const N = window.__nc, G = N.gta, V = G.v5, F = V.FAC.pd; __t.reset(); N.walk();
    V.impound(false); V.V5.imp.paid = 0; V.V5.imp.gateT = 0; V.V5.imp.broken = 0;
    N.drive(); const v = N.player.veh, gx = F.yard.x0 - F.ax + (F.gate.x0 + F.gate.x1) / 2;
    const s = N.Ws(F.ax + gx, F.yard.z0 + 3.2, Math.PI); v.x = s.x; v.z = s.z; v.yaw = s.yaw;
    for (let i = 0; i < 40 && !V.V5.imp.broken; i++) { v.vx = Math.sin(v.yaw) * 9; v.vz = Math.cos(v.yaw) * 9; __t.step(1); }
    const broken = V.V5.imp.broken > 0, stars = G.wanted.W.stars;
    __t.reset(); N.walk(); V.V5.imp.broken = 0; __t.step(2);
    // 翻網：站在拖吊場西邊網子外面、面向網子
    const [fx, fz] = V.w('pd', F.yard.x0 - F.ax + 8, F.yard.z1 - F.az + .5); N.tp(fx, fz, V.yaw('pd', Math.PI)); __t.step(2);
    const near = !!V.fenceNear(); N.keys.Space = false;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    __t.step(110);
    const over = V.inYard(N.player.x, N.player.z);
    __t.reset(); N.motors.v5.imp = 0; return { broken, stars, near, over };
  });
  if (c9) {
    check(c9.broken && c9.stars >= 2, `開車撞破柵門、通緝 ${c9.stars} 星`);
    check(c9.near && c9.over, `面向鐵絲網按空白鍵翻進拖吊場（${JSON.stringify(c9)}）`);
  }

  const c10 = await sec('10. 開走分局屋頂的警用直升機 → 2 星', () => {
    const N = window.__nc, G = N.gta, V = G.v5, H = V.V5.helis.find(h => h.kind === 'police'); __t.reset();
    N.tp(H.v.x + 2, H.v.z); N.player.y = H.v.y; __t.step(2);
    const t = N.ctx(); N.act(); __t.step(3);
    const out = { t, in: N.player.veh === H.v, stars: G.wanted.W.stars };
    __t.reset(); return out;
  });
  if (c10) check(c10.in && c10.stars >= 2, `${c10.t} → 通緝 ${c10.stars} 星`);

  const c11 = await sec('11. 存檔第 9 版', () => {
    const N = window.__nc; N.motors.v5.imp = 1; N.save ? N.save() : null;
    localStorage.removeItem('nc260.motors'); window.__nc.gta.phone && 0;
    const raw = (() => { try { N.gta.v5.impound(false); return JSON.parse(localStorage.getItem('nc260.motors')); } catch (e) { return null; } })();
    N.motors.v5.imp = 0; return raw && { v: raw.v, v5: raw.v5 };
  });
  if (c11) check(c11.v === 9 && c11.v5 && c11.v5.imp === 1, `存檔 v${c11.v}、v5 ${JSON.stringify(c11.v5)}`);

  const c12 = await sec('12. 便利店搶劫：威嚇條約 12 秒、朝貨架開槍加快、第二台收銀機、能量飲料', () => {
    const N = window.__nc, G = N.gta, V = G.v5, S = V.SHOP, C = V.STORE_CLERK, W = G.wanted.W; __t.reset(); N.enter('store'); __t.step(2);
    const face = (yaw = 0) => { N.player.x = C.x; N.player.z = C.z - 2.6; N.player.yaw = yaw; N.look(yaw, 0); };
    const fresh = () => { S.rob = null; S.closed = 0; S.reg2 = false; S.till = false; S.clerk.st = 'idle'; S.clerk.hp = 60; G.wanted.clear('reset'); };
    const until = (stop, max) => { let n = 0; while (!stop() && n < max) { face(); __t.step(1); n++; } return n; };
    G.weapon('pistol'); G.fill(); fresh(); face(); __t.step(20);
    const rnd = Math.random; Math.random = () => .9; G.aim(true); until(() => S.rob, 120); Math.random = rnd;   // .9 → 店員不抽槍
    const robbing = !!S.rob, armed = !!(S.rob && S.rob.armed), c0 = N.motors.cash;
    const slow = +(until(() => !S.rob, 60 * 20) / 60).toFixed(1), got = N.motors.cash - c0, stars = W.stars;
    G.aim(false); __t.step(2);
    N.player.x = V.STORE_REG2.x; N.player.z = V.STORE_REG2.z - .4; __t.step(1); const t2 = N.ctx(), c1 = N.motors.cash; N.act(); const reg = N.motors.cash - c1;
    N.player.x = V.STORE_FRIDGE.x; N.player.z = V.STORE_FRIDGE.z + .7; G.life.hp = 50; __t.step(1); const t3 = N.ctx(); N.act(); const hp = G.life.hp;
    // 朝貨架開槍：每 1.5 秒轉開身子打一發貨架再對回店員
    fresh(); face(); G.aim(true); Math.random = () => .9; until(() => S.rob, 120); Math.random = rnd; let n = 0, shelf = 0;
    while (S.rob && n < 60 * 20) {
      if (n % 90 === 0) { for (let i = 0; i < 8; i++) { face(1.4); __t.step(1); } G.fire(); for (let i = 0; i < 3; i++) { face(1.4); __t.step(1); } if (S.rob && S.rob.shootT > 1.5) shelf++; n += 11; }
      face(); __t.step(1); n++;
    }
    const fast = +(n / 60).toFixed(1);
    G.aim(false); fresh(); N.exit(); __t.step(2);
    return { robbing, armed, slow, got, stars, t2, reg, t3, hp, fast, shelf };
  });
  if (c12) {
    check(c12.robbing && !c12.armed && c12.slow > 11.5 && c12.slow < 13.5 && c12.got >= 800 && c12.got <= 2500 && c12.stars >= 2, `拿槍指著店員：${c12.slow} 秒搶到 $${c12.got}、通緝 ${c12.stars} 星`);
    check(c12.shelf >= 2 && c12.fast > 4 && c12.fast < 7, `朝貨架開 ${c12.shelf} 槍威嚇加快：${c12.fast} 秒`);
    check(c12.t2 && c12.t2.includes('第二台') && c12.reg >= 250 && c12.reg <= 700, `${c12.t2} → +$${c12.reg}`);
    check(c12.t3 && c12.t3.includes('能量飲料') && Math.floor(c12.hp) === 65, `${c12.t3.replace(/<[^>]+>/g, '')} → 生命 ${Math.floor(c12.hp)}`);
  }

  const c12b = await sec('13. 店員抽槍反擊、打倒店員後自己清空收銀機', () => {
    const N = window.__nc, G = N.gta, V = G.v5, S = V.SHOP, C = V.STORE_CLERK; __t.reset(); N.enter('store'); __t.step(2);
    const face = () => { N.player.x = C.x; N.player.z = C.z - 2.6; N.player.yaw = 0; N.look(0, 0); };
    S.rob = null; S.closed = 0; S.clerk.st = 'idle'; S.clerk.hp = 60; G.weapon('pistol'); G.fill(); G.life.armor = 0; face(); __t.step(10);
    const rnd = Math.random; Math.random = () => .1; G.aim(true); let n = 0; while (!S.rob && n++ < 120) { face(); __t.step(1); } Math.random = rnd;
    const armed = !!(S.rob && S.rob.armed); for (let i = 0; i < 60 * 3; i++) { face(); __t.step(1); }
    const st = S.clerk.st, hurt = 100 - Math.round(G.life.hp);
    for (let i = 0; i < 6 && S.clerk.st !== 'dead'; i++) { G.fire(); for (let k = 0; k < 20; k++) { face(); __t.step(1); } }
    const dead = S.clerk.st === 'dead', stars = G.wanted.W.stars; G.aim(false); __t.step(2);
    const T = N.gta.apt.APT.store.till; N.player.x = T.x; N.player.z = T.z; __t.step(1); const t = N.ctx(), c0 = N.motors.cash; N.act();
    const got = N.motors.cash - c0; S.closed = 0; S.clerk.st = 'idle'; S.till = S.reg2 = false; G.wanted.clear('reset'); G.life.hp = 100; N.exit(); __t.step(2);
    return { armed, st, hurt, dead, stars, t, got };
  });
  if (c12b) {
    check(c12b.armed && c12b.st === 'shoot' && c12b.hurt >= 18, `店員抽出霰彈槍（${c12b.st}）、三秒內打掉 ${c12b.hurt} 點生命`);
    check(c12b.dead && c12b.stars >= 1 && c12b.t && c12b.t.includes('清空') && c12b.got > 0, `打倒店員（通緝 ${c12b.stars} 星）→ ${c12b.t} +$${c12b.got}`);
  }

  const c13 = await sec('14. 提款機：拿槍指著提款的人約 1.5 秒交出錢', () => {
    const N = window.__nc, G = N.gta, V = G.v5, A = V.ATM_SPOTS[0]; __t.reset(); N.walk();
    A.st = 'use'; A.aim = 0; A.t = 0;
    const px = A.w.x - Math.sin(A.w.yaw) * 4, pz = A.w.z - Math.cos(A.w.yaw) * 4, yaw = Math.atan2(A.w.x - px, A.w.z - pz);
    N.tp(px, pz, yaw); N.look(yaw, 0); G.weapon('pistol'); G.fill(); __t.step(10); G.aim(true); const c0 = N.motors.cash; let n = 0;
    while (A.st !== 'flee' && n < 300) { N.player.yaw = yaw; N.look(yaw, 0); __t.step(1); n++; }
    const out = { st: A.st, t: +(n / 60).toFixed(1), got: N.motors.cash - c0, n: V.ATM_SPOTS.length };
    G.aim(false); G.wanted.clear('reset'); return out;
  });
  if (c13) check(c13.n >= 4 && c13.st === 'flee' && c13.t < 2.5 && c13.got >= 60 && c13.got <= 400, `${c13.n} 台提款機；${c13.t} 秒後交出 $${c13.got}`);

  const c14 = await sec('15. 酒：三杯之後畫面與走路會晃，慢慢退', () => {
    const N = window.__nc, V = N.gta.v5; __t.reset(); N.walk(); V.SHOP.drunk = 0; N.motors.cash = 5000;
    for (let i = 0; i < 3; i++) V.booze('bar');
    const d = V.SHOP.drunk, wob = N.post.wobble; __t.step(60);
    const d1 = V.SHOP.drunk; V.SHOP.drunk = 0; N.post.wobble = 0; return { d: +d.toFixed(2), d1: +d1.toFixed(3), wob, cash: N.motors.cash };
  });
  if (c14) check(c14.d === 1.2 && c14.d1 < c14.d && c14.d1 > 1.1 && c14.wob === 1 && c14.cash === 4964, `三杯 $36、酒意 ${c14.d}（畫面搖晃 ${c14.wob}），一秒後 ${c14.d1}`);

  const c15 = await sec('16. 槍店：防彈背心、擴充彈匣', () => {
    const N = window.__nc, G = N.gta, V = G.v5; __t.reset(); N.walk(); N.motors.cash = 20000; __t.step(2);
    const [x, z] = V.mallW(21, 13.6); N.tp(x, z, V.yaw('mall', 0)); __t.step(3);
    const t0 = N.ctx(); G.life.armor = 0; V.shopArmor(); N.pick(2); const armor = G.life.armor;
    const m0 = G.ARMS.smg.mag; V.shopMods(); const k = N.dialog.opts.findIndex(o => o.t.startsWith('衝鋒槍擴充彈匣')); N.pick(k); const m1 = G.ARMS.smg.mag, ext = N.motors.v5.ext.slice();
    N.closeDialog(); N.motors.v5.ext = []; V.extApply();
    return { t0, armor, m0, m1, ext, cash: N.motors.cash, back: G.ARMS.smg.mag };
  });
  if (c15) check(c15.t0 && c15.t0.includes('鐵砧') && c15.armor === 60 && c15.m1 === Math.round(c15.m0 * 1.5) && c15.ext.join() === 'smg' && c15.cash === 17800 && c15.back === c15.m0, `${c15.t0.replace(/<[^>]+>/g, '')} → 強化背心護甲 ${c15.armor}、衝鋒槍彈匣 ${c15.m0} → ${c15.m1}（付 $${20000 - c15.cash}）`);

  const c16 = await sec('17. 射擊場：場內開槍不算犯罪、打中立起來的標靶得分', async () => {
    const N = window.__nc, G = N.gta, V = G.v5, M = V.MALL, W = G.wanted.W; N.motors.cash = 5000; G.weapon('pistol'); G.fill();
    V.rangeStart(); await __t.wait(900); __t.step(2);
    const inRange = !!M.range; G.wanted.set(1); const h0 = W.heat; G.wanted.crime('shots'); const quiet = W.heat === h0; G.wanted.clear('reset');
    const T = M.targets[1]; M.range.cur = T; M.range.next = 99; T.up = 1; T.t = 9; __t.step(30);
    const [tx, tz] = V.mallW(T.x, T.z), ty = N.player.y + .2 + 1.45;
    // 準星就是鏡頭正中央：照射線和標靶的偏差修正鏡頭的水平角與俯仰（鏡頭被牆擠近時，鏡頭方向和 camState.yaw 會差一點）
    G.aim(true); __t.step(10); let yaw = N.player.yaw, pitch = 0, hit = false, ps = 0;
    for (let it = 0; it < 40 && !hit; it++) {
      N.camera.updateMatrixWorld(); const R = V.aimRay(), h = Math.hypot(tx - R.ox, tz - R.oz);
      hit = V.rayHitsCyl(R, tx, tz, ty - .3, ty + .3, .3); if (hit) break;
      const ey = Math.atan2(tx - R.ox, tz - R.oz) - Math.atan2(R.dx, R.dz), ep = Math.atan2(ty - R.oy, h) - Math.asin(R.dy);
      if (!ps && Math.abs(ep) > .01) { N.look(yaw, pitch + .05); __t.step(3); N.camera.updateMatrixWorld(); ps = Math.sign(V.aimRay().dy - R.dy) || 1; }
      yaw += Math.atan2(Math.sin(ey), Math.cos(ey)); pitch += ep * ps; N.player.yaw = yaw; N.look(yaw, pitch); __t.step(3);
    }
    const best = +pitch.toFixed(2);
    const s0 = M.range.score; if (hit) { G.fire(); for (let i = 0; i < 3; i++) { __t.step(1); N.camera.updateMatrixWorld(); } }
    const score = M.range.score - s0, down = !T.up;
    G.aim(false); V.rangeEnd(true); await __t.wait(900); __t.step(2);
    return { inRange, quiet, hit, best, score, down, back: !M.range, fee: 5000 - N.motors.cash };
  });
  if (c16) check(c16.inRange && c16.fee === 20 && c16.quiet && c16.hit && c16.score === 1 && c16.down && c16.back, `付 $${c16.fee} 進場、開槍不加熱度、瞄準標靶（俯仰 ${c16.best}）命中 ${c16.score}、離開回到櫃台`);

  const c17 = await sec('18. 槍店老闆：拿槍指著他就反擊', () => {
    const N = window.__nc, G = N.gta, V = G.v5, O = V.MALL.owner; __t.reset(); N.walk();
    const [x, z] = V.mallW(21, 10); N.tp(x, z); O.st = 'idle'; G.weapon('pistol'); G.fill(); G.life.armor = 0; __t.step(5);
    const yaw = Math.atan2(O.s.x - N.player.x, O.s.z - N.player.z); G.aim(true);
    for (let i = 0; i < 6; i++) { N.player.yaw = yaw; N.look(yaw, 0); __t.step(1); }
    const st = O.st; G.aim(false); const hp0 = G.life.hp;
    for (let i = 0; i < 180; i++) __t.step(1);
    const hurt = Math.round(hp0 - G.life.hp); O.st = 'idle'; G.wanted.clear('reset'); G.life.hp = 100; return { st, hurt };
  });
  if (c17) check(c17.st === 'hostile' && c17.hurt >= 12, `老闆 ${c17.st}、三秒內打掉 ${c17.hurt} 點生命`);

  const c18 = await sec('19. 縫線服飾：通緝中、警察沒看到時換裝少一星', () => {
    const N = window.__nc, G = N.gta, V = G.v5, A = G.apt; __t.reset(); N.walk(); N.motors.cash = 5000;
    const [x, z] = V.mallW(37.5, 11.6); N.tp(x, z); __t.step(2); const t0 = N.ctx();
    const id = G.crew.CREW[G.crew.crew.cur].id, cur = A.outfit[id] || 0;
    G.wanted.set(2); G.wanted.W.seen = false; V.clothesShop(); N.pick(cur ? 0 : 1);
    const st = G.wanted.W.stars, now = A.outfit[id]; G.wanted.clear('reset'); A.wear(cur); return { t0, st, cash: N.motors.cash, changed: now !== cur };
  });
  if (c18) check(c18.t0 && c18.t0.includes('縫線') && c18.st === 1 && c18.cash === 4850 && c18.changed, `${c18.t0.replace(/<[^>]+>/g, '')} → 換裝後通緝 ${c18.st} 星、付 $150`);

  const c19 = await sec('20. 撞人沾血、開久了沾泥；洗車隧道洗乾淨', () => {
    const N = window.__nc, V = N.gta.v5, F = V.FAC.mall; __t.reset(); N.motors.cash = 5000;
    N.drive(); const v = N.player.veh; v.blood = 0; V.v5Blood(v); V.v5Blood(v); v.dirt = .8; V.carGrime(v);
    const blood = +v.blood.toFixed(2), vis = !!(v.grime && v.grime.g.visible);
    const [x, z] = V.mallW((F.wash.x0 + F.wash.x1) / 2 - F.ax, F.wash.z0 - F.az - 3);
    v.x = x; v.z = z; v.yaw = V.yaw('mall', 0); v.vx = v.vz = 0; __t.step(3);
    const t0 = N.ctx(); N.act(); let n = 0, mid = 0;
    while (V.MALL.wash && n < 60 * 30) { __t.step(1); n++; if (n === 60 * 6) mid = +v.dirt.toFixed(2); }
    const out = { blood, vis, t0, mid, t: +(n / 60).toFixed(1), after: [v.blood, v.dirt], cash: N.motors.cash, hidden: !v.grime.g.visible };
    N.walk(); return out;
  });
  if (c19) {
    check(c19.blood === .7 && c19.vis, `撞兩個人車頭沾血 ${c19.blood}、貼花看得到`);
    check(c19.t0 && c19.t0.includes('洗車') && c19.mid < .8 && c19.after.join() === '0,0' && c19.cash === 4985 && c19.hidden && c19.t > 12 && c19.t < 17, `${c19.t0.replace(/<[^>]+>/g, '')} → 輸送帶 ${c19.t} 秒（半路泥巴 ${c19.mid}）洗乾淨、付 $15`);
  }

  const c20 = await sec('21. CHROME WORKS 自動捲門：自己的車開到門口、警察沒看到才開', () => {
    const N = window.__nc, G = N.gta, V = G.v5, S = V.SHOP.shutter; __t.reset(); N.drive(); const v = N.player.veh;
    const [x, z] = V.shutterAt(); v.x = x; v.z = z; v.vx = v.vz = 0;
    for (let i = 0; i < 120; i++) { v.x = x; v.z = z; v.vx = v.vz = 0; __t.step(1); }
    const open = +S.open.toFixed(2);
    G.wanted.set(2); for (let i = 0; i < 120; i++) { G.wanted.W.seen = true; v.x = x; v.z = z; v.vx = v.vz = 0; __t.step(1); }
    const shut = +S.open.toFixed(2); G.wanted.clear('reset'); for (let i = 0; i < 60; i++) __t.step(1); N.walk(); return { open, shut };
  });
  if (c20) check(c20.open > .9 && c20.shut < .1, `沒被看到時捲門打開 ${c20.open}、被看到時關上 ${c20.shut}`);

  const c21 = await sec('22. 立體停車場：四條坡道一層一層開上頂樓', () => {
    const N = window.__nc, V = N.gta.v5, PK = V.gar.PK; __t.reset(); N.drive(); const v = N.player.veh, out = [];
    for (let j = 0; j < 4; j++) {
      const [x, z] = V.w('gar', 17.5, 17.1); v.x = x; v.z = z; v.y = PK.Y(j); v.yaw = V.yaw('gar', Math.PI / 2); v.vx = v.vz = 0; v.hp = 2000; __t.step(2);
      let n = 0; while (__t.gar(v.x, v.z)[0] < 54 && n < 900) { N.keys.KeyW = Math.hypot(v.vx, v.vz) < 9; __t.step(1); n++; }
      N.keys.KeyW = false; __t.step(30); out.push(+(v.y - PK.Y(j + 1)).toFixed(2));
    }
    N.walk(); return out;
  });
  if (c21) check(c21.every(d => Math.abs(d) < .05), `每條坡道開到上一層的樓板（高度差 ${c21.join('／')}）`);

  const c22 = await sec('23. 頂樓的稀有超跑與「飛躍霓虹大道」跳台：飛過大道落進公園', () => {
    const N = window.__nc, G = N.gta, V = G.v5, PK = V.gar.PK; __t.reset();
    const [x, z] = V.w('gar', 30, 40.5); N.tp(x, z); N.player.y = PK.Y(4); __t.step(3);
    const car = PK.car && { name: PK.car.name, y: +PK.car.y.toFixed(2), at: __t.gar(PK.car.x, PK.car.z).map(q => +q.toFixed(1)) };
    const r = V.gar.ramp(), cash = N.motors.cash, n0 = G.stunt.stunt.n;
    const [ex, ez] = V.w('gar', 17, 38.4); N.player.x = ex; N.player.z = ez; __t.step(2);   // 走到超跑旁邊上車，從車位直接往東衝
    const enter = N.ctx(); N.act(); __t.step(2); const v = N.player.veh; if (!v || v !== PK.car) return { car, enter, y0: r && r.y0, fail: 'enter' };
    let n = 0, air = 0, top = 0; N.keys.KeyW = true;
    while (n < 900) { __t.step(1); n++; if (v.air) { air = 1; N.keys.KeyW = false; top = Math.max(top, v.y); } if (air && !v.air) break; }
    const land = __t.gar(v.x, v.z).map(q => +q.toFixed(1)), ly = +v.y.toFixed(2);
    N.keys.KeyW = false; __t.step(60); N.walk();
    return { car, enter, ly, y0: r && r.y0, air, top: +top.toFixed(1), land, n: G.stunt.stunt.n - n0, got: N.motors.cash - cash, done: N.motors.stunts.includes(r && r.i), total: G.stunt.RAMPS.length };
  });
  if (c22) {
    check(c22.car && Math.abs(c22.car.y - c22.y0) < .05 && Math.abs(c22.car.at[0] - 17) < .5 && Math.abs(c22.car.at[1] - 40.5) < 1.2, `頂樓停著稀有超跑 ${JSON.stringify(c22.car)}`);
    check(c22.air && c22.enter && c22.enter.includes('McLaren') && c22.top > c22.y0 + 1 && c22.land[0] > 80 && c22.ly < 1 && c22.n === 1 && c22.got > 0 && c22.done && c22.total === 21, `頂樓跳台起飛（最高 ${c22.top} m）、落在公園 ${c22.land}（${c22.enter}${c22.fail || ''}）、拿到 $${c22.got}（第 ${c22.total} 座跳台）`);
  }

  const c23 = await sec('24. 降落傘包：撿起來之後，開車飛在半空按 F 跳車開傘', () => {
    const N = window.__nc, G = N.gta, V = G.v5, PK = V.gar.PK; __t.reset(); V.V5.chute = 0;
    const [bx, bz] = V.w('gar', 55.5, 46); N.tp(bx, bz); N.player.y = PK.Y(4); __t.step(3);
    const got = V.V5.chute, hidden = !PK.bag.visible;
    N.drive(); const v = N.player.veh, r = V.gar.ramp(); v.x = r.x - r.dx * 37; v.z = r.z - r.dz * 37; v.y = PK.Y(4); v.yaw = r.yaw; v.vx = v.vz = 0; v.hp = 2000; __t.step(2);   // 順著跳台、助跑 27 m
    let n = 0; N.keys.KeyW = true; while (!v.air && n < 600) { __t.step(1); n++; } N.keys.KeyW = false; __t.step(20);
    const bail = V.gar.bail(), a3 = N.player.air3 && N.player.air3.kind, flying = !!v.air;
    n = 0; while (v.air && n < 600) { __t.step(1); n++; }
    return { got, hidden, bail, a3, flying, landed: !v.air, left: V.V5.chute, mode: N.player.mode };
  });
  if (c23) check(c23.got === 1 && c23.hidden && c23.bail && c23.a3 === 'fall' && c23.flying && c23.landed && c23.left === 0 && c23.mode === 'walk', `撿傘包 → 半空跳車（${c23.a3}），車自己飛完落地，傘用掉 ${JSON.stringify(c23)}`);

  const c24 = await sec('25. 停車場電梯、入口的柵欄桿一碰就斷', async () => {
    const N = window.__nc, V = N.gta.v5, PK = V.gar.PK; __t.reset(); N.player.air3 = null;
    const [x, z] = V.w('gar', ...PK.elev.down); N.tp(x, z); __t.step(2);
    const t0 = N.ctx(); N.act(); await __t.wait(700); __t.step(2); const up = +N.player.y.toFixed(2);
    const t1 = N.ctx(); N.act(); await __t.wait(700); __t.step(2); const down = +N.player.y.toFixed(2);
    N.drive(); const v = N.player.veh, B = PK.bars[1], [sx, sz] = V.w('gar', 4, 33); v.x = sx; v.z = sz; v.y = 0; v.yaw = V.yaw('gar', Math.PI / 2); v.vx = v.vz = 0; v.hp = 2000; __t.step(2);
    let n = 0, sp = 0; while (!(B.t > 0) && n < 300) { N.keys.KeyW = Math.hypot(v.vx, v.vz) < 4; __t.step(1); n++; sp = Math.hypot(v.vx, v.vz); }
    N.keys.KeyW = false; __t.step(2);
    const after = Math.hypot(v.vx, v.vz); __t.step(60); N.walk();
    return { t0, t1, up, down, roof: PK.Y(4), broke: B.t > 0, sp: +sp.toFixed(2), after: +after.toFixed(2), hp: v.hp, flew: +B.m.position.distanceTo(B.p).toFixed(1) };
  });
  if (c24) {
    check(c24.t0 && c24.t0.includes('頂樓') && Math.abs(c24.up - c24.roof) < .05 && c24.t1 && c24.down < .5, `電梯 ${c24.t0} → y ${c24.up} → ${c24.t1} → y ${c24.down}`);
    check(c24.broke && c24.hp === 2000 && c24.after > c24.sp * .8 && c24.flew > 1, `柵欄桿斷飛 ${c24.flew} m，車速 ${c24.sp} → ${c24.after}、不扣血`);
  }

  console.log('26. 主控台');
  check(log.pageerrors.length === 0, `沒有 uncaught exception（${log.pageerrors.slice(0, 2).join(' | ')}）`);
  check(log.errors.length === 0, `沒有 console.error（${log.errors.slice(0, 2).join(' | ')}）`);
} finally { await browser.close(); }
console.log(failed ? `\n${failed} 項沒過` : '\n全部通過');
process.exit(failed ? 1 : 0);
