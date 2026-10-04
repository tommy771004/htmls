// 規則層測試：地圖決定性、整場 AI 對戰跑完、毒圈 8 階段、防加速、命中與護甲。
// node --test games/199-saltcape/tools/sim.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMap, getMap } from '../src/core/map.js';
import { Match, MODE } from '../src/core/sim.js';
import { botName } from '../src/core/bots.js';
import { BITS, STORM } from '../src/core/rules.js';
import { groundAt } from '../src/core/physics.js';

const W = getMap();
const roster = (n, humans = 0) => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: botName(i), bot: i >= humans }));

test('地圖每次生成都一樣（伺服器與瀏覽器靠這點對齊碰撞）', () => {
  const W2 = buildMap();
  assert.equal(W2.boxes.length, W.boxes.length);
  assert.equal(W2.buildings.length, W.buildings.length);
  let a = 0, b = 0;
  for (let i = 0; i < W.B.length; i += 97) { a += W.B[i]; b += W2.B[i]; }
  assert.equal(a, b);
  assert.equal(W.towns.length, 10);
  assert.ok(W.buildings.length > 120, `建築 ${W.buildings.length} 棟`);
});

test('48 人 AI 對戰會跑完並產生唯一勝者', () => {
  const m = new Match({ W, seed: 11, roster: roster(48) });
  let phases = new Set();
  while (!m.over && m.time < 900) { m.step(); phases.add(m.storm.phase); }
  assert.ok(m.over, '對局結束');
  assert.equal(m.alive().length, 1);
  assert.ok(m.winner > 0);
  assert.equal(m.standings()[0].id, m.winner);
  assert.ok(m.elims.length === 47);
  assert.ok(phases.size >= 3, `經過 ${phases.size} 個毒圈階段`);
});

test('毒圈 8 階段逐步縮小，最後一圈半徑為 0', () => {
  assert.equal(STORM.length, 8);
  for (let i = 1; i < STORM.length; i++) assert.ok(STORM[i].r < STORM[i - 1].r && STORM[i].dps >= STORM[i - 1].dps);
  assert.equal(STORM[7].r, 0);
  const m = new Match({ W, seed: 3, roster: roster(2) });
  for (const p of m.players) { p.mode = MODE.SPECT; }
  m.players[0].mode = MODE.GROUND; m.players[1].mode = MODE.GROUND; // 只看毒圈
  m.players[0].ai = null; m.players[1].ai = null; m.players[0].bot = m.players[1].bot = false;
  m.out.set(1, []); m.out.set(2, []); m.queue.set(1, []); m.queue.set(2, []);
  for (let k = 0; k < 30 * 560 && m.storm.phase < 8; k++) { m.step(); for (const p of m.players) { p.hp = 100; } }
  assert.equal(m.storm.phase, 8);
  assert.ok(m.storm.cur.r < 0.01);
});

test('圈外持續扣血、護甲擋子彈但不擋毒', () => {
  const m = new Match({ W, seed: 5, roster: roster(3, 1) });
  const p = m.byId.get(1);
  Object.assign(p, { mode: MODE.GROUND, x: 0, z: 0, y: 30, ar: 100 });
  m.storm.cur = { x: 900, z: 900, r: 10 };
  m.damage(p, 5, null, 'storm');
  assert.equal(p.ar, 100); assert.equal(p.hp, 95);
  const q = m.byId.get(2);
  m.damage(p, 60, q, 'ar');
  assert.equal(p.ar, 40); assert.equal(p.hp, 95);
});

test('灌大量輸入也不能比 30 Hz 跑得快', () => {
  const m = new Match({ W, seed: 9, roster: roster(2, 1) });
  const p = m.byId.get(1);
  const x = -60, z = 14;
  Object.assign(p, { mode: MODE.GROUND, x, z, y: groundAt(W, x, z, 40), og: 1 });
  for (const b of m.players) if (b.bot) b.mode = MODE.DEAD;
  m.queueInput(1, Array.from({ length: 30 }, (_, i) => ({ s: i + 1, b: BITS.FWD, y: Math.PI / 2, p: 0 })));
  for (let k = 0; k < 10; k++) { m.queueInput(1, Array.from({ length: 30 }, (_, i) => ({ s: 31 + k * 30 + i, b: BITS.FWD, y: Math.PI / 2, p: 0 }))); m.step(); }
  // 10 tick × 每 tick 最多 1 筆（加上桶裡 6 筆）× 走路 4.8 m/s
  const moved = Math.hypot(p.x - x, p.z - z);
  assert.ok(moved < 16 * 4.8 / 30 + 0.2, `10 tick 只移動了 ${moved.toFixed(2)} 公尺`);
});

test('爆頭比打身體痛，射擊穿不過牆', () => {
  const m = new Match({ W, seed: 2, roster: roster(2, 2) });
  const a = m.byId.get(1), b = m.byId.get(2);
  const y = groundAt(W, -60, 14, 40);
  Object.assign(a, { mode: MODE.GROUND, x: -60, z: 14, y, og: 1 });
  Object.assign(b, { mode: MODE.GROUND, x: -60, z: 2, y, og: 1, ar: 0 });
  // 朝胸口開槍
  const dc = (b.y + 1.1) - (a.y + 1.62), Lc = Math.hypot(12, dc);
  m.fire(a, 'ar', 0, [[0, dc / Lc, -12 / Lc]], { vt: m.tick });
  const body = 100 - b.hp;
  b.hp = 100;
  // 瞄頭
  const dy = (b.y + 1.62) - (a.y + 1.62);
  const L = Math.hypot(12, dy);
  m.fire(a, 'ar', 0, [[0, dy / L, -12 / L]], { vt: m.tick });
  const head = 100 - b.hp;
  assert.ok(body > 20 && head > body, `身體 ${body.toFixed(0)}、頭 ${head.toFixed(0)}`);
  // 隔著建築：把 b 放到街屋另一側
  b.hp = 100; Object.assign(b, { x: -76, z: -30 });
  Object.assign(a, { x: -76, z: 14 });
  m.fire(a, 'ar', 0, [[0, 0, -1]], { vt: m.tick });
  assert.equal(b.hp, 100);
});

test('射手步槍與狙擊槍的子彈會飛行並下墜', () => {
  const m = new Match({ W, seed: 4, roster: roster(2, 2) });
  const a = m.byId.get(1), b = m.byId.get(2);
  const y = groundAt(W, -780, -470, 40);
  Object.assign(a, { mode: MODE.GROUND, x: -780, z: -470, y, og: 1 });
  Object.assign(b, { mode: MODE.SPECT, x: 0, z: 0 });
  const hits = [];
  const orig = m.emitNear.bind(m);
  m.emitNear = (x, z, R, ev, ex) => { if (ev.e === 'pi') hits.push(ev.at); return orig(x, z, R, ev, ex); };
  m.fire(a, 'sr', 0, [[1, 0, 0]], { vt: m.tick });
  assert.equal(hits.length, 0, '開火當下不會立刻命中');
  assert.equal(m.proj.length, 1);
  for (let k = 0; k < 60 && !hits.length; k++) m.stepProjectiles(), m.tick++;
  assert.equal(hits.length, 1, '子彈最後落地');
  const dist = hits[0][0] - a.x;
  // 從 1.62 公尺高水平射出：落地距離約 vel × √(2h/g) ≈ 365 公尺
  assert.ok(dist > 300 && dist < 430, `落地距離 ${dist.toFixed(0)} 公尺`);
});
