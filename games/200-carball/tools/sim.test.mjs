// 手感與規則的數值測試（node --test tools/sim.test.mjs）：數值對照 Rocket League 公開常數換算成公尺
import test from 'node:test';
import assert from 'node:assert/strict';
import R from '@dimforge/rapier3d-compat';
import { Sim } from '../src/core/sim.js';
import { Bot } from '../src/core/ai.js';
import { ARENA } from '../src/core/const.js';

await R.init();

// 開好一個可以直接操作的對局：不倒數、對手停在角落
function setup() {
  const sim = new Sim(R, { kickoff: 4, seed: 1 });
  sim.phase = 'play';
  for (const c of sim.cars) c.state.frozen = false;
  sim.placeCar(sim.cars[1], -30, 0.17, 35, 0);
  sim.placeBall(-25, 0.92, 30);
  const car = sim.cars[0];
  const run = (sec, f) => { const n = Math.round(sec * 120); for (let i = 0; i < n; i++) { if (f) f(i / 120); sim.step(); } };
  return { sim, car, run };
}
const yOf = (c) => c.body.translation().y;

test('靜止時四輪著地、離地高度約 0.15 m', () => {
  const { car, run } = setup();
  run(1);
  assert.equal(car.state.contacts, 4);
  assert.ok(Math.abs(yOf(car) - 0.15) < 0.03, `y=${yOf(car)}`);
});

test('只踩油門最高約 14.1 m/s，加速後封頂 23 m/s', () => {
  const { sim, car, run } = setup();
  sim.placeCar(car, 0, 0.2, -45, 0);
  car.state.input.throttle = 1;
  run(4);
  assert.ok(car.state.speed > 13.5 && car.state.speed < 14.6, `throttle ${car.state.speed}`);
  car.state.boost = 100; car.state.input.boost = true;
  run(2.5);
  assert.ok(car.state.speed > 22.8 && car.state.speed <= 23.001, `boost ${car.state.speed}`);
});

test('單跳約 2.5 m、二段跳約 5 m', () => {
  const { sim, car, run } = setup();
  sim.placeCar(car, 0, 0.2, 0, 0); run(0.6);
  let top = 0;
  car.state.input.jump = true;
  run(1.6, (t) => { top = Math.max(top, yOf(car)); if (t > 0.3) car.state.input.jump = false; });
  assert.ok(top > 2.2 && top < 2.8, `single ${top}`);
  run(1);
  top = 0;
  run(2, (t) => { top = Math.max(top, yOf(car)); const k = Math.round(t * 120); car.state.input.jump = k < 24 || (k > 30 && k < 34); });
  assert.ok(top > 4.6 && top < 5.6, `double ${top}`);
});

test('前翻增加約 5 m/s，翻完輪子朝下落地', () => {
  const { sim, car, run } = setup();
  sim.placeCar(car, 0, 0.2, -30, 0); run(0.5);
  car.state.input.throttle = 1; run(1.2);
  const v0 = car.state.speed;
  const inp = car.state.input;
  inp.jump = true; run(0.1); inp.jump = false; run(0.08);
  inp.pitch = -1; inp.jump = true; run(0.05); inp.jump = false; run(0.25);
  assert.ok(car.state.hasFlipped);
  assert.ok(car.state.speed - v0 > 4, `dodge +${car.state.speed - v0}`);
  inp.pitch = 0; inp.throttle = 0;
  run(2.5);
  const r = car.body.rotation();
  assert.ok(1 - 2 * (r.x * r.x + r.z * r.z) > 0.9, '落地時輪子朝下');
});

test('側翻、後翻也都輪子朝下落地', () => {
  for (const [pitch, yaw] of [[0, 1], [0, -1], [1, 0], [-0.7, 0.7]]) {
    const { sim, car, run } = setup();
    sim.placeCar(car, 0, 0.2, -30, 0); run(0.5);
    const inp = car.state.input;
    inp.throttle = 1; run(1);
    inp.jump = true; run(0.1); inp.jump = false; run(0.08);
    inp.pitch = pitch; inp.yaw = yaw; inp.jump = true; run(0.05); inp.jump = false; inp.pitch = 0; inp.yaw = 0;
    run(2.5);
    const r = car.body.rotation();
    assert.ok(1 - 2 * (r.x * r.x + r.z * r.z) > 0.9 && car.state.onGround, `pitch ${pitch} yaw ${yaw}`);
  }
});

test('開上側牆：彎道不掉速（只剩重力造成的減速），在牆上四輪貼牆', () => {
  const { sim, car, run } = setup();
  sim.placeCar(car, 25, 0.2, -20, 1.17); run(0.5);
  car.state.input.throttle = 1;
  let vBefore = 0, wall = null;
  run(3, () => {
    const t = car.body.translation();
    if (t.x > 37 && t.x < 37.3 && !vBefore) vBefore = car.state.speed;
    if (!wall && t.y > 3.5) wall = { v: car.state.speed, y: t.y, c: car.state.contacts };
  });
  assert.ok(wall, '有開上牆');
  const expect = Math.sqrt(vBefore * vBefore - 2 * 6.5 * wall.y);
  assert.ok(wall.v > expect - 1.2, `wall ${wall.v} vs ${expect}`);
  assert.ok(wall.c >= 3);
});

test('車頭以 20 m/s 撞靜止的球，球速 ≥ 26 m/s、略往上飛', () => {
  const { sim, car, run } = setup();
  sim.placeBall(0, 0.9125, 0);
  sim.placeCar(car, 0, 0.15, -6, 0, { x: 0, y: 0, z: 20 });
  car.state.input.throttle = 1;
  let best = { s: 0 };
  run(0.8, () => { const v = sim.ball.body.linvel(); const s = Math.hypot(v.x, v.y, v.z); if (s > best.s) best = { s, y: v.y }; });
  assert.ok(best.s >= 26, `ball ${best.s}`);
  assert.ok(best.y > 0, '球往上');
});

test('兩端球門都能進球，計分給對的隊', () => {
  for (const [dir, team] of [[1, 0], [-1, 1]]) {
    const { sim, run } = setup();
    sim.placeBall(3, 2, dir * 40, 0, 1, dir * 16);
    const goals = [];
    run(3, () => { for (const e of sim.drainEvents()) if (e.type === 'goal') goals.push(e.team); });
    assert.deepEqual(goals, [team]);
    assert.equal(sim.score[team], 1);
  }
});

test('翻車後按跳躍可以翻正', () => {
  const { sim, car, run } = setup();
  sim.placeCar(car, 0, 0.45, 0, 0, null, { x: 0, y: 0, z: 1, w: 0 });   // 繞 Z 轉 180°，車頂朝下
  run(1);
  assert.equal(car.state.contacts, 0);
  car.state.input.jump = true; run(0.05); car.state.input.jump = false; run(1.6);
  const r = car.body.rotation();
  assert.ok(1 - 2 * (r.x * r.x + r.z * r.z) > 0.9);
  assert.ok(car.state.onGround);
});

test('時間到且平手進延長賽，延長賽進球就結束', () => {
  const sim = new Sim(R, { kickoff: 4, autoKickoff: true });
  sim.phase = 'play'; for (const c of sim.cars) c.state.frozen = false;
  sim.clock = 0.05;
  const ev = [];
  for (let i = 0; i < 120; i++) { sim.step(); ev.push(...sim.drainEvents().map((e) => e.type)); }
  assert.ok(ev.includes('overtime'));
  assert.ok(sim.overtime);
  sim.phase = 'play';
  sim.placeBall(0, 2, ARENA.B - 3, 0, 0, 15);
  for (let i = 0; i < 400; i++) { sim.step(); ev.push(...sim.drainEvents().map((e) => e.type)); }
  assert.ok(ev.includes('goal') && ev.includes('over'));
});

test('AI 對 AI 一分鐘：球與車都不會跑出場外', () => {
  const sim = new Sim(R, { autoKickoff: true, seed: 3 });
  const bots = [new Bot(sim, sim.cars[0], 'allstar'), new Bot(sim, sim.cars[1], 'pro')];
  let out = 0, hits = 0;
  for (let i = 0; i < 120 * 60; i++) {
    for (const b of bots) b.update(1 / 120);
    sim.step();
    for (const e of sim.drainEvents()) if (e.type === 'hit') hits++;
    if (sim.phase !== 'play') continue;
    const p = sim.ball.body.translation();
    if (p.y < 0.5 || p.y > ARENA.H || Math.abs(p.x) > ARENA.A + 0.1) out++;
    for (const c of sim.cars) { const t = c.body.translation(); if (c.state.demolished <= 0 && (t.y < -0.3 || Math.abs(t.x) > ARENA.A + 0.1)) out++; }
  }
  assert.equal(out, 0);
  assert.ok(hits > 5, `hits ${hits}`);
});
