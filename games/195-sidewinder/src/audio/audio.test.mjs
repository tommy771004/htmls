// 音訊自測：node --test src/audio/audio.test.mjs
// 1) 沒有 WebAudio 時所有 API 不丟錯、on() 掛點照樣觸發；2) 用假 AudioContext 跑過每個合成音效、引擎與音樂排程。
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudio } from './index.js';
import { SFX } from './synth.js';
import { SONGS, createMusic } from './music.js';
import { EVENT_NAMES, ALL_NAMES } from './events.js';

// ── 假 WebAudio：記錄呼叫、檢查參數是有限數值 ──
function makeFakeCtx() {
  const stats = { nodes: 0, started: 0, bad: [] };
  const param = (v = 0) => {
    const p = { value: v };
    for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime', 'cancelScheduledValues']) {
      p[m] = (val, t, c) => {
        for (const x of [val, t, c]) if (x !== undefined && !Number.isFinite(x)) stats.bad.push(`${m}(${val},${t},${c})`);
        if (m === 'exponentialRampToValueAtTime' && !(val > 0)) stats.bad.push(`exp ramp to ${val}`);
        return p;
      };
    }
    return p;
  };
  const node = (extra = {}) => {
    stats.nodes++;
    const n = {
      connect: (d) => d, disconnect() {},
      gain: param(1), frequency: param(440), Q: param(1), pan: param(0), delayTime: param(0),
      threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(),
      type: '', ...extra,
    };
    return n;
  };
  const src = () => node({
    start(t, o) { stats.started++; if (t !== undefined && !Number.isFinite(t)) stats.bad.push('start ' + t); if (o !== undefined && !Number.isFinite(o)) stats.bad.push('offset ' + o); },
    stop(t) { if (t !== undefined && !Number.isFinite(t)) stats.bad.push('stop ' + t); },
    buffer: null, loop: false,
  });
  const ctx = {
    currentTime: 1, sampleRate: 8000, state: 'running', destination: node(),
    createGain: () => node(), createBiquadFilter: () => node(), createStereoPanner: () => node(),
    createDynamicsCompressor: () => node(), createDelay: () => node(),
    createOscillator: src, createBufferSource: src,
    createBuffer: (ch, len, sr) => ({ length: len, sampleRate: sr, duration: len / sr, getChannelData: () => new Float32Array(len) }),
    resume: () => Promise.resolve(), suspend: () => Promise.resolve(), close: () => Promise.resolve(),
    decodeAudioData: () => Promise.resolve(null),
  };
  return { ctx, stats };
}

function fakeState({ aiPlayer = false } = {}) {
  const s = new Float32Array(176);
  s[0] = 2; s[4] = 4;
  for (let k = 0; k < 4; k++) {
    const b = 16 + 32 * k;
    s[b] = -20 + k * 12; s[b + 25] = 0.2 * k + 0.1; s[b + 26] = k === 1 ? 0.8 : 0;
    s[b + 19] = k === 2 ? 1 : 0; s[b + 16] = k; s[b + 28] = k === 0 && !aiPlayer ? 0 : 1;
  }
  return s;
}

test('沒有 WebAudio：每個 API 都能呼叫，不丟錯、不輸出', () => {
  const out = [];
  const orig = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = (...a) => out.push(a);
  try {
    const au = createAudio();
    const got = [];
    const off = au.api.on('wall_hit', (p) => got.push(p));
    const all = [];
    au.api.on('*', (name) => all.push(name));
    assert.equal(au.unlock(), false);
    au.handleEvents([{ type: 8, truck: 0, a: 1, b: 0 }, { type: 'ui_confirm', truck: 0, a: 0, b: 0 }, { type: 99 }]);
    assert.deepEqual(got, [{ truck: 0, a: 1, b: 0 }]);
    assert.deepEqual(all, ['wall_hit', 'ui_confirm']);
    off();
    au.handleEvents([{ type: 8, truck: 0, a: 1, b: 0 }]);
    assert.equal(got.length, 1);
    au.update(null, 0.016, 'title');
    au.update({ state: () => fakeState() }, 0.016, 'race');
    au.setScreen('garage');
    assert.equal(au.api.registerSfx('splash', () => {}), true);
    assert.equal(au.api.registerSfx('splash', null), true);
    assert.equal(au.api.setMusic('race', null), true);
    assert.equal(au.api.setMusic('race'), true);
    assert.equal(au.api.setMusic('nope', null), false);
    assert.equal(au.api.setVolume('music', 2), true);
    assert.equal(au.api.getVolume('music'), 1);
    assert.equal(au.api.mute(true), true);
    assert.equal(au.api.play('purchase'), false);
    assert.equal(au.api.state(), 'none');
    au.destroy();
  } finally {
    Object.assign(console, orig);
  }
  assert.deepEqual(out, []);
});

test('事件表涵蓋 SPEC §5 的 14 種事件與 UI 事件', () => {
  assert.equal(Object.keys(EVENT_NAMES).length, 15);
  for (const n of ALL_NAMES) assert.equal(typeof SFX[n], 'function', n);
});

test('每個合成音效在假 context 上產生有效排程', () => {
  const { ctx, stats } = makeFakeCtx();
  for (const [name, fn] of Object.entries(SFX)) {
    for (const p of [{ truck: 0, a: 0, b: 0 }, { truck: 1, a: 1, b: 2 }, { truck: 0, a: 20, b: 40000 }]) {
      const r = fn(ctx, ctx.createGain(), p);
      assert.ok(typeof r === 'number' && r > 0, name);
    }
  }
  assert.deepEqual(stats.bad, []);
  assert.ok(stats.started > 50);
});

test('音樂：每首 4 小節 64 步、音符都有解析、排程不出錯', () => {
  for (const [k, s] of Object.entries(SONGS)) {
    for (const part of ['bass', 'lead', 'kick', 'snare', 'hat']) assert.equal(s[part].length, 64, `${k}.${part}`);
    assert.ok(s.bpm >= 118 && s.bpm <= 140);
    assert.ok(s.bass.some((m) => m != null) && s.lead.some((m) => m != null));
    assert.ok(![...s.bass, ...s.lead].some((m) => m !== null && !Number.isFinite(m)), `${k} 音名`);
  }
  const { ctx, stats } = makeFakeCtx();
  const m = createMusic(ctx, ctx.createGain());
  m.play('race', 'synth');
  for (let i = 0; i < 100; i++) { ctx.currentTime += 0.05; m.tick(); }
  assert.equal(m.current(), 'race');
  m.play('garage', { getChannelData() {}, duration: 3 });
  m.play('title', null);
  m.stop();
  assert.deepEqual(stats.bad, []);
});

test('假 context：unlock、事件、引擎、切畫面與掛點全流程', async () => {
  const { ctx, stats } = makeFakeCtx();
  const timers = [];
  globalThis.window = {
    AudioContext: function () { return ctx; },
    location: { search: '' },
    document: { hidden: false, addEventListener() {}, removeEventListener() {} },
  };
  try {
    const au = createAudio();
    const hits = [];
    au.api.on('truck_hit', (p) => hits.push(p));
    let customRan = 0;
    au.api.registerSfx('mud', (c, dest, p) => { customRan++; assert.equal(p.truck, 2); return 0.1; });
    assert.equal(au.unlock(), true);
    assert.equal(au.api.state(), 'running');
    const core = { state: () => fakeState() };
    au.setScreen('race');
    au.update(core, 1 / 60, 'race');
    au.handleEvents([
      { type: 1, truck: 0, a: 3, b: 0 }, { type: 2, truck: 0, a: 0, b: 0 },
      { type: 7, truck: 1, a: 0.7, b: 0 }, { type: 6, truck: 2, a: 0, b: 0 },
      { type: 11, truck: 3, a: 1, b: 0 },
    ], core);
    assert.deepEqual(hits, [{ truck: 1, a: 0.7, b: 0 }]);
    assert.equal(customRan, 1);
    // 同名音效節流
    assert.equal(au.api.play('ui_move'), true);
    assert.equal(au.api.play('ui_move'), false);
    ctx.currentTime += 0.1;
    assert.equal(au.api.play('ui_move'), true);
    for (let i = 0; i < 30; i++) { ctx.currentTime += 1 / 60; au.update(core, 1 / 60, 'race'); }
    au.update(core, 1 / 60, 'garage');
    au.update({ state: () => fakeState({ aiPlayer: true }) }, 1 / 60, 'title');
    au.api.setVolume('engine', 0.3);
    au.api.mute(false);
    au.destroy();
    assert.deepEqual(stats.bad, []);
  } finally {
    delete globalThis.window;
    for (const t of timers) clearTimeout(t);
  }
});
