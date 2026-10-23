// 第五部曲（城市建築設施藍圖與魔鬼細節）的驗收：醫院（醫藥費、醫療包、救護車、員工電梯、屋頂直升機）、第九分局（逃生梯、屋頂直升機）、
// 拖吊場（扣車、贖車、翻鐵絲網、撞破柵門）、走得上去的屋頂與從屋頂跳下去、存檔第 9 版
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
    check(c1.ids === 'hosp,pd', `醫院與分局兩個街區（${c1.ids}）`);
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
    const [x, z] = V.w('pd', L.x, L.z - .5); N.tp(x, z, V.yaw('pd', 0)); __t.step(2);
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
    const N = window.__nc, V = N.gta.v5, F = V.FAC.pd, B = F.L[0]; __t.reset();
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

  console.log('12. 主控台');
  check(log.pageerrors.length === 0, `沒有 uncaught exception（${log.pageerrors.slice(0, 2).join(' | ')}）`);
  check(log.errors.length === 0, `沒有 console.error（${log.errors.slice(0, 2).join(' | ')}）`);
} finally { await browser.close(); }
console.log(failed ? `\n${failed} 項沒過` : '\n全部通過');
process.exit(failed ? 1 : 0);
