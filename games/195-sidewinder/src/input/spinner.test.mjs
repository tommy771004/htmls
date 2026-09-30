// 輸入純邏輯自測：node --test src/input/spinner.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpinnerFilter, SPINNER_DEFAULTS } from './spinner.js';
import { rampSteer, combine, RAMP } from './keyboard.js';
import { readPad, deadzone, createPadTracker, REPEAT } from './gamepad.js';
import { sanitize, INPUT_DEFAULTS } from './settings.js';
import { createInput } from './index.js';

const DT = 1 / 60;
const btn = (pressed, value = pressed ? 1 : 0) => ({ pressed, value });
function pad({ axes = [0, 0, 0, 0], on = {}, idx = 0, id = 'pad' } = {}) {
  const buttons = Array.from({ length: 17 }, (_, i) => (i in on ? (typeof on[i] === 'number' ? btn(on[i] > 0.5, on[i]) : btn(!!on[i])) : btn(false)));
  return { index: idx, id, connected: true, axes, buttons };
}

test('速率模式：持續轉動有轉向，停手後回 0', () => {
  const s = { ...SPINNER_DEFAULTS, mode: 'rate', sensitivity: 400 };
  const f = createSpinnerFilter(() => s);
  let v = 0;
  for (let i = 0; i < 20; i++) { f.feed(20); v = f.poll(DT); } // 1200 計數/秒，滿舵 1600
  assert.ok(v > 0.6 && v <= 1, `steer ${v}`);
  for (let i = 0; i < 3; i++) v = f.poll(DT);
  assert.ok(Math.abs(v) < 0.2, `停手 3 幀後 ${v}`);
  for (let i = 0; i < 3; i++) v = f.poll(DT);
  assert.equal(v, 0, '停手約 0.1 秒歸零');
});

test('速率模式：轉更快轉向更大、夾在 ±1、反向為負', () => {
  const s = { ...SPINNER_DEFAULTS, mode: 'rate' };
  const run = (dx) => { const f = createSpinnerFilter(() => s); let v = 0; for (let i = 0; i < 30; i++) { f.feed(dx); v = f.poll(DT); } return v; };
  const slow = run(3), fast = run(12), huge = run(500), neg = run(-12);
  assert.ok(slow < fast, `${slow} < ${fast}`);
  assert.equal(huge, 1);
  assert.ok(neg < 0 && Math.abs(neg + fast) < 1e-9);
});

test('速率模式：短平滑窗抹平事件叢集（一幀有一幀沒）', () => {
  const f = createSpinnerFilter(() => ({ ...SPINNER_DEFAULTS, mode: 'rate' }));
  const vals = [];
  for (let i = 0; i < 60; i++) { if (i % 2 === 0) f.feed(16); vals.push(f.poll(DT)); }
  const tail = vals.slice(30);
  const spread = Math.max(...tail) - Math.min(...tail);
  assert.ok(spread < 0.35, `抖動 ${spread}`);
  assert.ok(Math.min(...tail) > 0.1);
});

test('位置模式：累積到滿舵夾住，停手慢慢回中', () => {
  const s = { ...SPINNER_DEFAULTS, mode: 'position', sensitivity: 400 };
  const f = createSpinnerFilter(() => s);
  f.feed(200);
  assert.ok(Math.abs(f.poll(DT) - 0.5) < 1e-9);
  f.feed(1000);
  assert.equal(f.poll(DT), 1);
  f.feed(-100);
  assert.ok(Math.abs(f.poll(DT) - 0.75) < 1e-9, '夾住後反轉立即回應');
  let v = f.poll(DT);
  assert.ok(v > 0.7, '回中是緩慢的');
  for (let i = 0; i < 60 * 3; i++) v = f.poll(DT);
  assert.ok(v < 0.05 && v >= 0, `3 秒後 ${v}`);
});

test('反向設定翻轉輸出；切換模式會重置', () => {
  const s = { ...SPINNER_DEFAULTS, mode: 'position', sensitivity: 100, invert: true };
  const f = createSpinnerFilter(() => s);
  f.feed(50);
  assert.equal(f.poll(DT), -0.5);
  s.mode = 'rate';
  assert.equal(f.poll(DT), 0);
});

test('鍵盤爬升：按住約 0.24 秒滿舵，放開回中，反向先快速過零', () => {
  let v = 0, t = 0;
  while (v < 1) { v = rampSteer(v, 1, DT); t += DT; }
  assert.ok(Math.abs(t - 1 / RAMP.rise) < 2 * DT, `滿舵時間 ${t}`);
  v = rampSteer(v, 0, DT);
  assert.ok(v < 1 && v > 0.8);
  let n = 0;
  while (v > 0) { v = rampSteer(v, 0, DT); n++; }
  assert.equal(v, 0);
  assert.ok(n < 9);
  v = 1;
  v = rampSteer(v, -1, 0.05);
  assert.ok(Math.abs(v - (1 - RAMP.cross * 0.05)) < 1e-9);
  assert.equal(rampSteer(-1, -1, DT), -1);
  assert.equal(rampSteer(0.3, 1, 0), 0.3);
});

test('合併：steer 取絕對值最大（保留正負），油門煞車取最大，氮氣 OR', () => {
  const c = combine([{ steer: 0.3, throttle: 1 }, { steer: -0.8, brake: 0.4 }, { steer: 0.1, nitro: true }, null]);
  assert.deepEqual(c, { steer: -0.8, throttle: 1, brake: 0.4, nitro: true });
});

test('手把：死區重新縮放、十字鍵覆蓋搖桿、RT 類比與按鈕對應', () => {
  assert.equal(deadzone(0.1, 0.15), 0);
  assert.ok(Math.abs(deadzone(0.575, 0.15) - 0.5) < 1e-9);
  assert.equal(deadzone(-1, 0.15), -1);
  let r = readPad(pad({ axes: [0.575, 0], on: { 7: 0.4 } }));
  assert.ok(Math.abs(r.steer - 0.5) < 1e-9);
  assert.equal(r.throttle, 0.4);
  assert.equal(r.brake, 0);
  assert.equal(r.active, true);
  r = readPad(pad({ axes: [0.9, 0], on: { 14: 1, 0: 1, 6: 1, 5: 1 } }));
  assert.equal(r.steer, -1);
  assert.equal(r.throttle, 1);
  assert.equal(r.brake, 1);
  assert.equal(r.nitro, true);
  r = readPad(pad({ on: { 1: 1, 2: 1 } }));
  assert.equal(r.brake, 1);
  assert.equal(r.nitro, true);
  r = readPad(pad({ on: { 7: 0.03 } }));
  assert.equal(r.throttle, 0, '扳機微小殘值歸零');
  assert.equal(r.active, false);
});

test('手把選單：邊緣觸發一次、長按自動連發、A/B/Start', () => {
  const tr = createPadTracker();
  const held = [pad({ on: { 13: 1 } })];
  let out = tr.update(held, DT);
  assert.deepEqual(out.menu, ['down']);
  out = tr.update(held, DT);
  assert.deepEqual(out.menu, []);
  let count = 0;
  for (let t = 0; t < REPEAT.first + REPEAT.every * 3 + 0.01; t += DT) count += tr.update(held, DT).menu.length;
  assert.ok(count >= 3 && count <= 5, `連發 ${count}`);
  tr.update([pad()], DT);
  out = tr.update([pad({ on: { 0: 1, 9: 1 } })], DT);
  assert.deepEqual(out.menu.sort(), ['confirm', 'menu']);
  out = tr.update([pad({ on: { 1: 1 }, axes: [0.8, 0] })], DT);
  assert.deepEqual(out.menu.sort(), ['back', 'right']);
  // 搖桿遲滯：從 0.8 降到 0.5 仍算按住，不重觸發
  out = tr.update([pad({ axes: [0.5, 0] })], DT);
  assert.deepEqual(out.menu, []);
});

test('多支手把：最近有動作的那支成為目前手把；拔掉後退回剩下的', () => {
  const tr = createPadTracker();
  let out = tr.update([pad({ idx: 0, id: 'A' }), pad({ idx: 1, id: 'B', on: { 7: 1 } })], DT);
  assert.equal(out.id, 'B');
  assert.equal(out.input.throttle, 1);
  out = tr.update([pad({ idx: 0, id: 'A', on: { 0: 1 } }), pad({ idx: 1, id: 'B', on: { 7: 1 } })], DT);
  assert.equal(out.id, 'B', '目前手把仍在用時不搶');
  out = tr.update([pad({ idx: 0, id: 'A', axes: [-1, 0] }), pad({ idx: 1, id: 'B' })], DT);
  assert.equal(out.id, 'A');
  assert.equal(out.input.steer, -1);
  out = tr.update([null, pad({ idx: 1, id: 'B' })], DT);
  assert.equal(out.id, 'B');
  out = tr.update([], DT);
  assert.equal(out.input, null);
});

test('設定驗證', () => {
  const s = sanitize({ spinnerMode: 'x', spinnerSensitivity: '9999', spinnerInvert: 1, padDeadzone: -1, touch: 'on' });
  assert.equal(s.spinnerMode, INPUT_DEFAULTS.spinnerMode);
  assert.equal(s.spinnerSensitivity, 5000);
  assert.equal(s.spinnerInvert, false);
  assert.equal(s.padDeadzone, 0);
  assert.equal(s.touch, 'on');
});

test('沒有 DOM／Gamepad／Pointer Lock 時 createInput 也能跑，feed 會改變轉向與來源', () => {
  const inp = createInput({});
  assert.equal(inp.source(), 'keyboard');
  assert.deepEqual(inp.poll(DT), { steer: 0, throttle: 0, brake: 0, nitro: false });
  for (let i = 0; i < 10; i++) { inp.spinner.feed(-15); inp.poll(DT); }
  assert.ok(inp.spinner.value() < -0.2);
  assert.ok(inp.last().steer < -0.2);
  assert.equal(inp.source(), 'spinner');
  inp.spinner.settings.mode = 'position';
  assert.equal(inp.settings().spinnerMode, 'position');
  inp.spinner.feed(inp.spinner.settings.sensitivity);
  assert.equal(inp.poll(DT).steer, 1);
  assert.deepEqual(inp.gamepads(), []);
  assert.equal(inp.spinner.isLocked(), false);
  const off = inp.onMenu(() => {});
  off();
  inp.destroy();
});
