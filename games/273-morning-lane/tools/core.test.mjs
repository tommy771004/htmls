// 規則層測試（不需要瀏覽器）：node --test tools/core.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { BIKE, PAPER, POINTS, STREET } from '../src/core/config.js';
import { makeStreet } from '../src/core/street.js';
import { makeBike, stepBike } from '../src/core/bike.js';
import { launch, stepPaper } from '../src/core/paper.js';
import { makeLedger, scorePaper, scorePass } from '../src/core/score.js';
import { makeGame, step, DT, upcoming } from '../src/core/game.js';

const street = makeStreet({ seed: 1 });
const fly = (b, side, s = street) => { const p = launch(b, side); for (let i = 0; i < 300; i++) { const e = stepPaper(p, DT, s); if (e) return e; } return null; };

/** 對某個信箱，從 x0 以速度 v 騎過去，掃描出手位置，回傳會進信箱的出手範圍（公尺）與時間窗（秒） */
export function timingWindow(lot, x0, v) {
  let n = 0, first = null, last = null;
  for (let d = -4; d <= 4; d += 0.01) {
    const b = { x: x0, z: lot.mailbox.z + d, yaw: 0, v };
    const e = fly(b, lot.side);
    if (e && e.type === 'mailbox' && e.lot === lot.id) { n++; first ??= d; last = d; }
  }
  return { meters: n * 0.01, seconds: (n * 0.01) / v, lead: first == null ? null : (first + last) / 2 };
}

test('街道：兩側都有房子，第一戶是訂戶，不會連續四戶都不是訂戶', () => {
  const order = [...street.lots].sort((a, b) => b.z - a.z);
  assert.ok(street.lots.some((l) => l.side < 0) && street.lots.some((l) => l.side > 0));
  assert.equal(order[0].sub, true);
  let dry = 0;
  for (const l of order) { dry = l.sub ? 0 : dry + 1; assert.ok(dry <= 3); }
  for (const o of street.obstacles.filter((o) => o.kind === 'tree' || o.kind === 'pole'))
    for (const l of street.lots) if (Math.sign(l.mailbox.x) === Math.sign(o.x)) assert.ok(Math.abs(l.mailbox.z - o.z) >= 2 || Math.abs(l.mailbox.x - o.x) > 1);
});

test('腳踏車：巡航、加速到極速、轉向、被柵欄擋住', () => {
  const b = makeBike(0, 0);
  for (let i = 0; i < 60; i++) stepBike(b, {}, DT);
  assert.ok(Math.abs(b.z + BIKE.cruise) < 0.05, `1 秒巡航走 ${-b.z}`);
  for (let i = 0; i < 240; i++) stepBike(b, { accel: true }, DT);
  assert.ok(Math.abs(b.v - BIKE.max) < 1e-6);
  const c = makeBike(0, 0);
  for (let i = 0; i < 30; i++) stepBike(c, { steer: -1 }, DT);
  assert.ok(c.yaw < 0 && c.x < 0 && c.lean > 0);
  for (let i = 0; i < 600; i++) stepBike(c, { steer: -1 }, DT);
  assert.equal(c.x, -BIKE.xLimit);
});

test('腳踏車：撞到垃圾桶會被推開並掉速', () => {
  const b = makeBike(3.15, 0);
  const hit = (() => { for (let i = 0; i < 120; i++) { const h = stepBike(b, {}, DT, [{ x: 3.15, z: -3, r: 0.38, kind: 'bin' }]); if (h) return h; } })();
  assert.equal(hit.kind, 'bin');
  assert.ok(b.v < BIKE.cruise * 0.5);
});

test('報紙：兩個車道都丟得進同側信箱，量出時間窗', () => {
  const lot = street.lots.find((l) => l.side > 0 && l.sub);
  for (const [x0, v] of [[1.7, BIKE.cruise], [1.7, BIKE.max], [-1.7, BIKE.cruise], [3.0, BIKE.cruise]]) {
    const w = timingWindow(lot, x0, v);
    console.log(`  信箱時間窗 x0=${x0} v=${v}: ${w.meters.toFixed(2)} m＝${w.seconds.toFixed(3)} s，要在信箱前 ${w.lead?.toFixed(2)} m 出手`);
    assert.ok(w.seconds > 0.08, `x0=${x0} v=${v} 時間窗太窄`);
  }
});

test('報紙：從車道丟不到窗戶，從人行道丟得到', () => {
  const lot = street.lots.find((l) => l.side > 0 && l.windows.some((w) => w.y0 < 2));
  const win = lot.windows.find((w) => w.y0 < 2);
  const zc = (win.z0 + win.z1) / 2;
  const tryFrom = (x0) => { for (let d = -4; d <= 6; d += 0.05) { const e = fly({ x: x0, z: zc + d, yaw: 0, v: BIKE.cruise }, 1); if (e && e.type === 'window') return true; } return false; };
  assert.equal(tryFrom(1.7), false);
  assert.equal(tryFrom(6.2), true);
});

test('計分：信箱、門廊、連投、砸窗、漏送', () => {
  const L = makeLedger(street);
  const subs = street.lots.filter((l) => l.sub);
  const non = street.lots.find((l) => !l.sub);
  scorePaper(L, street, { type: 'mailbox', lot: subs[0].id });
  scorePaper(L, street, { type: 'yard', lot: subs[1].id });
  assert.equal(L.score, POINTS.mailbox + POINTS.doorstep + POINTS.streak);
  scorePaper(L, street, { type: 'mailbox', lot: subs[0].id });            // 同一戶不重複算
  assert.equal(L.delivered.size, 2);
  scorePaper(L, street, { type: 'window', lot: non.id });
  assert.equal(L.score, POINTS.mailbox + POINTS.doorstep + POINTS.streak + POINTS.badWindow);
  scorePass(L, street, -1e9);
  assert.equal(L.missed.size, subs.length - 2);
  assert.equal(L.streak, 0);
});

test('一整趟：自動駕駛在每個訂戶前出手，能騎完並送到大部分', () => {
  const g = makeGame({ seed: 1 });
  let guard = 0;
  while (g.mode === 'ride' && guard++ < 60 * 120) {
    const next = upcoming(g, 1)[0];
    const lead = 1.15;
    const want = next ? Math.sign(next.mailbox.x) * 1.7 : 1.7;
    const steer = Math.abs(g.bike.x - want) > 0.3 ? Math.sign(want - g.bike.x) * 0.6 : 0;
    const t = next && g.bike.z - next.mailbox.z < lead && g.bike.z - next.mailbox.z > lead - 0.2 && Math.sign(g.bike.x) === Math.sign(next.mailbox.x);
    step(g, { steer: t ? 0 : steer, accel: false, throw: t });
  }
  const s = g.events.find((e) => e.type === 'done').summary;
  console.log(`  一趟：${(g.t).toFixed(1)} s，訂戶 ${s.subs}，送到 ${s.delivered}（信箱 ${s.mailbox}），漏送 ${s.missed}，撞 ${s.bumps}，分數 ${s.score}`);
  assert.equal(g.mode, 'done');
  assert.ok(s.delivered >= s.subs * 0.6);
  assert.ok(PAPER.stock >= s.subs, '報紙份數要夠送每一戶');
});

// ── 會動的障礙、一週七天、結算、存檔 ──
import { HAZ } from '../src/core/config.js';
import { makeHazards, stepHazards, sprayDir } from '../src/core/hazards.js';
import { DAYS, dayConfig } from '../src/core/week.js';
import { settle } from '../src/core/settle.js';
import { freshSave, applyResult, nextWeek, loadSave, writeSave, SAVE_KEY } from '../src/core/save.js';

const dayStreet = (k) => { const d = dayConfig(k); return { d, s: makeStreet(d) }; };

test('狗：騎近就衝出來；巡航會被追上咬到，按住加速甩得掉，追不到就回家', () => {
  const { d, s } = dayStreet(3);
  const run = (accel) => {
    const H = makeHazards(s, { dogs: 1 }); const dog = H.dogs[0];
    const b = makeBike(dog.side * 2.2, dog.hz + HAZ.dogWake + 3); b.v = accel ? BIKE.max : BIKE.cruise;
    const ev = [];
    for (let i = 0; i < 60 * 20; i++) { stepBike(b, { accel }, DT); ev.push(...stepHazards(H, b, DT, i * DT).events.map((e) => e.type)); }
    return { ev, dog };
  };
  const slow = run(false), fast = run(true);
  assert.ok(slow.ev.includes('bark') && slow.ev.includes('bite'), `巡航：${slow.ev}`);
  assert.ok(fast.ev.includes('bark') && !fast.ev.includes('bite') && fast.ev.includes('giveup'), `加速：${fast.ev}`);
  assert.equal(fast.dog.state, 'home');
  assert.ok(d.dogs >= 1);
});

test('對向來車：從前方左側車道開來，騎士擋在車道上會煞停按喇叭，騎進去才算撞', () => {
  const s = makeStreet({ seed: 4, length: 344 });
  const H = makeHazards(s, { cars: 1 }); const c = H.cars[0];
  const b = makeBike(-1.85, c.trig - 0.5); b.v = 0;          // 停在對向車道上等車來
  const ev = [];
  for (let i = 0; i < 60 * 14; i++) { const r = stepHazards(H, b, DT, i * DT); ev.push(...r.events.map((e) => e.type)); }
  assert.ok(ev.includes('honk'), '要按喇叭');
  assert.ok(c.v < 0.01 && b.z - c.z > 2.25 && b.z - c.z < 2.25 + 7.5, `車要停在騎士前面（距離 ${(b.z - c.z).toFixed(2)}，速度 ${c.v}）`);
  // 往車騎過去 → 撞到 carMove
  let hit = null;
  for (let i = 0; i < 120 && !hit; i++) { const r = stepHazards(H, b, DT, i * DT); hit = stepBike(b, {}, DT, r.obstacles); }
  assert.equal(hit && hit.kind, 'carMove');
});

test('灑水器：水柱掃到騎士就濺水減速，最低降到巡航的 55%', () => {
  const s = makeStreet({ seed: 2, length: 280 });
  const g = makeGame({ ...dayConfig(1), sprinklers: 1, dogs: 0, cars: 0 });
  const sp = g.haz.sprinklers[0];
  // 把騎士放在水柱正中間（a = 0：正對馬路，2 m 遠）
  sp.phase = 0; g.t = 0;
  const dir = sprayDir(sp, 0);
  g.bike.x = sp.x + dir.x * 2; g.bike.z = sp.z + dir.z * 2 + 0.05; g.bike.v = BIKE.max;
  let splashed = false, minV = 99;
  for (let i = 0; i < 20; i++) { step(g, { accel: true }); splashed ||= g.events.some((e) => e.type === 'splash'); minV = Math.min(minV, g.bike.v); }
  assert.ok(splashed, '要有 splash 事件');
  assert.ok(minV < BIKE.max - 0.3, `穿過水柱速度要掉（最低 ${minV.toFixed(2)}）`);
  // 停在水柱裡（水柱不掃）：速度降到巡航的 55% 就不再掉
  const sweep = HAZ.sprSweep; HAZ.sprSweep = 0;
  for (let i = 0; i < 120; i++) { g.bike.x = sp.x + dir.x * 2; g.bike.z = sp.z + dir.z * 2; g.bike.yaw = 0; step(g, {}); }
  HAZ.sprSweep = sweep;
  assert.ok(Math.abs(g.bike.v - BIKE.cruise * 0.55) < 0.06, `下限 ${g.bike.v.toFixed(3)}`);
  assert.ok(s.lots.length > 0);
});

test('一週七天：每天的街都不一樣、越後面越長越難，週五六黃昏、週日凌晨', () => {
  assert.equal(DAYS.length, 7);
  const seeds = new Set(DAYS.map((d) => d.seed)); assert.equal(seeds.size, 7);
  for (let k = 1; k < 7; k++) {
    assert.ok(DAYS[k].length >= DAYS[k - 1].length);
    assert.ok(DAYS[k].dogs + DAYS[k].cars >= DAYS[k - 1].dogs + DAYS[k - 1].cars);
  }
  assert.deepEqual(DAYS.map((d) => d.time), ['morning', 'morning', 'morning', 'morning', 'dusk', 'dusk', 'night']);
  assert.ok(dayConfig(0, 4).subRatio > dayConfig(0, 0).subRatio && dayConfig(0, -4).subRatio < dayConfig(0, 0).subRatio);
  // 每一天都能用自動駕駛騎完（障礙不會把路堵死）
  for (let k = 0; k < 7; k++) {
    const g = makeGame(dayConfig(k));
    for (let i = 0; i < 60 * 120 && g.mode === 'ride'; i++) step(g, { accel: true, steer: Math.max(-1, Math.min(1, (0.5 - g.bike.x) * 0.8 - g.bike.yaw * 2)) });
    assert.equal(g.mode, 'done', `${DAYS[k].name} 要騎得完`);
  }
});

test('結算：星等、全勤獎金、訂戶增減', () => {
  const base = { score: 1000, subs: 10, delivered: 10, missed: 0, windows: 0, bumps: 0 };
  const a = settle(base);
  assert.deepEqual([a.stars, a.bonus, a.total, a.net], [3, 500, 1500, 2]);
  const b = settle({ ...base, delivered: 8, missed: 2 });
  assert.deepEqual([b.stars, b.bonus, b.lost, b.net], [2, 0, 2, -1]);
  const c = settle({ ...base, delivered: 4, missed: 6, windows: 3 });
  assert.deepEqual([c.stars, c.lost, c.sloppy], [0, 3, true]);
});

test('存檔：記結果、推進天數、七天後開新的一週；讀寫失敗不會丟例外', () => {
  let s = freshSave();
  for (let k = 0; k < 7; k++) s = applyResult(s, k, { total: 100 * (k + 1), stars: 2, net: 1, delivered: 8, subs: 10 });
  assert.equal(s.day, 7); assert.equal(s.weekDone, true); assert.equal(s.subsDelta, 6);
  // 重騎前一天：更新最佳，但不再推進天數與訂戶
  const r = applyResult(s, 2, { total: 9999, stars: 3, net: 2 });
  assert.equal(r.best[2], 9999); assert.equal(r.subsDelta, 6);
  const w = nextWeek(s); assert.deepEqual([w.week, w.day, w.results.length, w.best[6]], [2, 0, 0, 700]);
  const mem = new Map(); const st = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.ok(writeSave(s, st)); assert.deepEqual(loadSave(st), s);
  mem.set(SAVE_KEY, '{壞掉'); assert.deepEqual(loadSave(st), freshSave());
  const bad = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.deepEqual(loadSave(bad), freshSave()); assert.equal(writeSave(s, bad), false);
  assert.deepEqual(loadSave(null), freshSave());
});

// ── 任務與路上的元素 ──
import { ITEMS } from '../src/core/config.js';
import { evalMissions, MISSION_PTS } from '../src/core/missions.js';

test('報紙補給包：騎過去撿起來 +5 份（最多 25）、只能撿一次', () => {
  const g = makeGame({ ...dayConfig(0), dogs: 0, cars: 0, sprinklers: 0 });
  const it = g.street.bundles[0]; assert.ok(it, '週一有一包');
  g.stock = 12; g.bike.x = it.x; g.bike.z = it.z + 0.5;
  for (let i = 0; i < 30; i++) step(g, {});
  assert.equal(g.stock, 17); assert.ok(g.taken.has(it.id));
  g.taken.delete(it.id); g.stock = 23; g.bike.x = it.x; g.bike.z = it.z + 0.5;
  for (let i = 0; i < 30; i++) step(g, {});
  assert.equal(g.stock, ITEMS.stockMax);
});

test('跳台：騎上去起飛 +50，在空中飛過垃圾桶不會撞，落地', () => {
  const g = makeGame({ ...dayConfig(2), dogs: 0, cars: 0, sprinklers: 0 });
  const r = g.street.ramps[0]; assert.ok(r);
  // 跳台正前方放一個垃圾桶
  g.street.obstacles.push({ x: r.x, z: r.z - ITEMS.rampL / 2 - 1.6, r: 0.38, kind: 'bin' });
  g.bike.x = r.x; g.bike.z = r.z + 3; g.bike.v = BIKE.max;
  const ev = [];
  let maxY = 0;
  for (let i = 0; i < 120; i++) { step(g, { accel: true }); ev.push(...g.events.map((e) => e.type)); maxY = Math.max(maxY, g.bike.y); }
  assert.ok(ev.includes('jump') && ev.includes('touchdown'), ev.join());
  assert.ok(!ev.includes('bump'), '空中不會撞到垃圾桶');
  assert.ok(maxY > 0.6, `飛起來的高度 ${maxY.toFixed(2)}`);
  assert.equal(g.ledger.lines.filter((l) => l.kind === 'jump').length, 1);
});

test('金色信箱：每天一戶（週二起），送進信箱 ×3', () => {
  const s = makeStreet(dayConfig(1));
  const v = s.lots.filter((l) => l.vip);
  assert.equal(v.length, 1); assert.ok(v[0].sub);
  const L = makeLedger(s);
  scorePaper(L, s, { type: 'mailbox', lot: v[0].id });
  assert.equal(L.score, POINTS.mailbox * POINTS.vipMult); assert.equal(L.vip, true);
  assert.equal(makeStreet(dayConfig(0)).lots.filter((l) => l.vip).length, 0);
});

test('任務：計數型達標就完成；保持型犯規當下失敗、騎完沒犯規才完成', () => {
  const st = { mailbox: 3, best: 5, vip: false, bundles: 0, jumps: 1, escapes: 0, bites: 0, bumps: 0, windows: 0, wets: 0, missed: 0, stock: 8 };
  const specs = ['mailbox:6', 'streak:5', 'noBump', 'spare:5', 'escape'];
  let r = evalMissions(specs, st).map((m) => m.state);
  assert.deepEqual(r, ['open', 'done', 'open', 'open', 'open']);
  r = evalMissions(specs, { ...st, bumps: 1, bites: 1, stock: 2 }).map((m) => m.state);
  assert.deepEqual(r, ['open', 'done', 'fail', 'open', 'fail'], '剩報紙要騎完才判');
  r = evalMissions(specs, { ...st, mailbox: 6 }, true).map((m) => m.state);
  assert.deepEqual(r, ['done', 'done', 'done', 'done', 'fail']);
  const set = settle({ score: 1000, subs: 10, delivered: 10, missed: 0, windows: 0, bumps: 0 }, 0, evalMissions(specs, { ...st, mailbox: 6 }, true));
  assert.equal(set.mission, 4 * MISSION_PTS); assert.equal(set.total, 1000 + 500 + 4 * MISSION_PTS);
  // 存檔：任務完成過就一直算
  let sv = applyResult(freshSave(), 0, { ...set, missionsDone: ['noBump'] });
  sv = applyResult(sv, 0, { ...set, missionsDone: ['streak:5'] });
  assert.deepEqual(sv.results[0].missions.sort(), ['noBump', 'streak:5']);
});

test('每一天的任務都對得上那天有的元素（有任務要金色信箱，那天就要有）', () => {
  for (let k = 0; k < 7; k++) {
    const d = dayConfig(k), s = makeStreet(d);
    assert.equal(d.missions.length, 3);
    for (const m of d.missions) {
      const [id, n] = m.split(':');
      if (id === 'vip') assert.ok(s.lots.some((l) => l.vip), `${d.name} 要有金色信箱`);
      if (id === 'bundles') assert.ok(s.bundles.length >= +n, `${d.name} 補給包`);
      if (id === 'jumps') assert.ok(s.ramps.length >= +n, `${d.name} 跳台`);
      if (id === 'escape') assert.ok(d.dogs >= 1, `${d.name} 要有狗`);
      if (id === 'dry') assert.ok(d.sprinklers >= 1, `${d.name} 要有灑水器`);
      if (id === 'mailbox') assert.ok(s.lots.filter((l) => l.sub).length >= +n, `${d.name} 訂戶夠多`);
    }
    assert.equal(s.ramps.length, d.ramps); assert.equal(s.bundles.length, d.bundles);
  }
});

test('頂著停下來的來車：碰撞一直發生，但這台車只扣一次分', () => {
  const g = makeGame({ ...dayConfig(3), dogs: 0, sprinklers: 0, bundles: 0, ramps: 0 });
  const c = g.haz.cars[0];
  g.bike.x = -1.85; g.bike.z = c.trig - 0.1;
  let bumps = 0;
  for (let i = 0; i < 60 * 20 && g.mode === 'ride'; i++) { step(g, { accel: true }); bumps += g.events.filter((e) => e.type === 'bump').length; }
  const crash = g.ledger.lines.filter((l) => l.what === 'carMove');
  assert.ok(bumps > 1, `撞了 ${bumps} 次`);
  assert.equal(crash.length, 1);
});
