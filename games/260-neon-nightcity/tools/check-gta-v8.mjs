// 第八部曲（城市勤務）的驗收：消防派遣（照路網開到火場、停車、水砲滅火、開走）、玩家開消防水箱車噴水、
// 救護派遣（傷者躺著等、到場扶起來）、拖吊車（掛上、拖著走、拖進拖吊場放下拿獎金）
// 用法：node tools/check-gta-v8.mjs [html]（預設 web/260-neon-nightcity.html）
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
  try { return await page.evaluate(fn, arg); } catch (e) { check(false, `執行失敗：${String(e.message || e).split('\n')[0]}`); return null; }
}
await page.evaluate(() => {
  window.__nc.gta.v8.CIV.on = true;   // lib.mjs 開頁時帶 civ=0（別的驗收不要派遣），這裡要測的就是派遣
  window.__t = {
    step(n) { for (let i = 0; i < n; i++) window.__nc.step(1 / 60); },
    reset() { const N = window.__nc; N.gta.wanted.clear('reset'); N.gta.life.hp = 100; if (N.player.mode === 'drive') N.walk(); N.player.air3 = null; },
    // 離玩家 r 公尺內、兩條路以上的路口（站在路口旁邊，派遣車照路網開得到）
    node(r0 = 0, r1 = 1e9) {
      const N = window.__nc, p = N.player;
      return N.roads.nodes.filter(n => n.out.length >= 3 && !n.y).map(n => ({ n, d: Math.hypot(n.x - p.x, n.z - p.z) })).filter(o => o.d > r0 && o.d < r1).sort((a, b) => a.d - b.d)[0].n;
    },
  };
});

try {
  await page.evaluate(() => window.__nc.start());
  await page.waitForTimeout(800);

  const c1 = await sec('1. 消防派遣：車子燒起來 5 秒後消防水箱車與指揮車出動，到場用水砲滅火再開走', () => {
    const N = window.__nc, V = N.gta.v8;
    __t.reset();
    const n = __t.node();
    N.tp(n.x + 6, n.z + 6); __t.step(2);
    const w = V.wreck(n.x - 4, n.z - 4), lit = w.dead ? 1 : 0;
    V.rush(); __t.step(2);
    const F = V.CIV.fire;
    if (!F) return { lit, spawned: false };
    const types = [F.truck && F.truck.v.type, F.chief && F.chief.v.type];
    const d0 = Math.hypot(F.truck.v.x - F.x, F.truck.v.z - F.z);
    let n1 = 0;
    for (; n1 < 60 * 60 && F.truck && F.truck.state === 'drive'; n1++) __t.step(1);
    const park = F.truck && F.truck.state, d1 = F.truck ? Math.hypot(F.truck.v.x - F.x, F.truck.v.z - F.z) : -1;
    const burning = V.fireSpots(F.x, F.z, 15).length;
    let n2 = 0;
    for (; n2 < 60 * 30 && V.fireSpots(F.x, F.z, 15).length; n2++) __t.step(1);
    const left = V.fireSpots(F.x, F.z, 15).length;
    __t.step(60 * 5);
    return { lit, spawned: true, types, d0: Math.round(d0), t1: +(n1 / 60).toFixed(1), park, d1: +d1.toFixed(1), burning, t2: +(n2 / 60).toFixed(1), left, leave: F.truck ? F.truck.state : 'gone', siren: N.gta.v8.CIV.fire ? 1 : 0 };
  });
  if (c1) {
    check(c1.lit && c1.spawned, '炸掉一台車、殘骸燒起來，消防出動');
    if (c1.spawned) {
      check(c1.types[0] === 'firetruck' && c1.types[1] === 'fire_chief', `派出 ${c1.types.join('＋')}`);
      check(c1.park === 'park' && c1.d1 < 26, `從 ${c1.d0} m 外開 ${c1.t1} 秒到場、停在火場 ${c1.d1} m`);
      check(c1.burning > 0, `到場時殘骸還在燒（等消防車時不自己熄，${c1.burning} 處）`);
      check(c1.left === 0 && c1.t2 < 20, `水砲 ${c1.t2} 秒滅火`);
      check(c1.leave === 'leave' || c1.leave === 'gone', `滅完火開走（${c1.leave}）`);
    }
  }

  const c2 = await sec('2. 玩家開消防水箱車：開火鍵往準星方向噴水滅火、不能車窗射擊', () => {
    const N = window.__nc, V = N.gta.v8, C = N.gta;
    __t.reset();
    if (V.CIV.fire) { for (const k of ['truck', 'chief']) if (V.CIV.fire[k]) V.CIV.fire[k].state = 'leave'; }
    const n = __t.node();
    N.tp(n.x, n.z); __t.step(2);
    const yaw = N.player.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw);
    const v = V.spawn('firetruck', n.x, n.z, yaw); v.water = 1;
    V.enter(v); __t.step(30);
    const tx = v.x + fx * 13, tz = v.z + fz * 13;
    V.fire(tx, tz);
    N.look(yaw, .42); __t.step(5);
    const before = V.fireSpots(tx, tz, 4).length;
    C.arm.trig = true; let k = 0;
    for (; k < 60 * 8 && V.fireSpots(tx, tz, 4).length; k++) __t.step(1);
    C.arm.trig = false;
    const after = V.fireSpots(tx, tz, 4).length;
    const db = C.canDriveBy('pistol');
    N.walk(); C.kin.drop(v);
    return { before, after, t: +(k / 60).toFixed(1), db, spray: +V.CIV.sprayT.toFixed(1) };
  });
  if (c2) {
    check(c2.before > 0 && c2.after === 0, `車頭前 13 m 的火 ${c2.before} 處 → ${c2.after}（噴了 ${c2.t} 秒）`);
    check(c2.db === false, '開消防水箱車時不能車窗射擊（開火鍵是水砲）');
  }

  const c3 = await sec('3. 救護派遣：路人倒地 6 秒後救護車到場、傷者在那之前不會自己爬起來', () => {
    const N = window.__nc, V = N.gta.v8;
    __t.reset();
    const n = __t.node(40);
    N.tp(n.x, n.z); __t.step(10);
    const k = V.nearPed(n.x, n.z);
    if (k < 0) return null;
    V.knock(k); V.rush(); __t.step(2);
    const A = V.CIV.amb;
    if (!A) return { k, spawned: false, p: V.ped(k) };
    const type = A.tk.v.type;
    let i = 0;
    for (; i < 60 * 60 && A.tk.state === 'drive'; i++) __t.step(1);
    const mid = V.ped(k), park = A.tk.state, d = Math.hypot(A.tk.v.x - mid.x, A.tk.v.z - mid.z);
    __t.step(60 * 6);
    return { k, spawned: true, type, t: +(i / 60).toFixed(1), park, d: +d.toFixed(1), downMid: +mid.down.toFixed(1), downEnd: V.ped(k).down, st: A.tk.state, healed: V.CIV.done.amb };
  });
  if (c3) {
    check(c3.spawned && c3.type === 'ambulance', `救護車出動（${c3.type}）`);
    if (c3.spawned) {
      check(c3.park === 'park' && c3.d < 26, `${c3.t} 秒到場、停在傷者 ${c3.d} m`);
      check(c3.downMid > 0, `救護車到場時傷者還躺著（down ${c3.downMid}）`);
      check(c3.downEnd <= 0 && c3.healed >= 1, `扶起 ${c3.healed} 人、救護車開走（${c3.st}）`);
    }
  }

  const c4 = await sec('4. 拖吊車：掛上車尾的車、拖著走、拖進拖吊場放下拿 $350', () => {
    const N = window.__nc, V = N.gta.v8, V5 = N.gta.v5, F = V5.FAC.pd;
    __t.reset();
    const n = __t.node();
    N.tp(n.x, n.z); __t.step(2);
    const yaw = N.player.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw);
    const T = V.spawn('tow', n.x, n.z, yaw), c = V.spawn('compact', 0, 0, yaw);
    const hx = T.x - fx * (T.len / 2 + .35), hz = T.z - fz * (T.len / 2 + .35);
    c.x = hx - fx * (c.len / 2 + 1); c.z = hz - fz * (c.len / 2 + 1); __t.step(1);
    V.enter(T); __t.step(10);
    const tgt = V.towTarget(T);
    V.hook();
    const hooked = !!V.CIV.tow && V.CIV.tow.v === c;
    // 往前拖 3 秒（維持車速）
    for (let i = 0; i < 180; i++) { T.vx = fx * 8; T.vz = fz * 8; __t.step(1); }
    const gap = Math.hypot(c.x - (T.x - Math.sin(T.yaw) * (T.len / 2 + .35)), c.z - (T.z - Math.cos(T.yaw) * (T.len / 2 + .35))) - c.len / 2;
    const moved = Math.hypot(c.x - hx, c.z - hz);
    // 搬到拖吊場中間放下
    const [yx, yz] = V5.w('pd', (F.yard.x0 + F.yard.x1) / 2 - F.ax, (F.yard.z0 + F.yard.z1) / 2 - F.az);
    T.x = yx; T.z = yz; T.vx = T.vz = 0; __t.step(5);
    const inY = V5.inYard(c.x, c.z), cash0 = N.motors.cash;
    V.drop();
    __t.step(2);
    const gone = !N.vehicles.includes(c), paid = N.motors.cash - cash0;
    N.walk(); N.gta.kin.drop(T);
    return { tgt: !!tgt, hooked, moved: +moved.toFixed(1), gap: +gap.toFixed(2), inY, paid, gone };
  });
  if (c4) {
    check(c4.tgt && c4.hooked, '倒車到車頭前按 E 掛上');
    check(c4.moved > 10 && Math.abs(c4.gap) < .6, `被拖的車跟著走 ${c4.moved} m、離拖桿 ${c4.gap} m`);
    check(c4.inY && c4.paid === 350 && c4.gone, `拖進拖吊場（${c4.inY}）放下：拿到 $${c4.paid}、車收走（${c4.gone}）`);
  }
} catch (e) {
  check(false, String(e.message || e));
}
check(!log.pageerrors.length, `沒有頁面錯誤${log.pageerrors.length ? '：' + log.pageerrors.slice(0, 3).join(' | ') : ''}`);
check(!log.errors.length, `沒有 console.error${log.errors.length ? '：' + log.errors.slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(failed ? `✗ ${failed} 項沒過` : '✓ 全部通過');
process.exit(failed ? 1 : 0);
