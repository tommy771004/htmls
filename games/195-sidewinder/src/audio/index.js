// 音訊：匯流排（master／music／sfx／engine → 壓縮器）、預設合成音效與音樂、掛點 API（window.Sidewinder.audio）。
// AudioContext 只在 unlock()（第一次使用者手勢）時建立；沒有 WebAudio 時 API 仍可呼叫、on() 掛點照樣觸發。
import { SFX } from './synth.js';
import { createTruckVoice } from './engine.js';
import { createMusic } from './music.js';
import { eventName, ALL_NAMES, UI_NAMES, ST } from './events.js';

const BUSES = ['master', 'music', 'sfx', 'engine'];
const SLOTS = ['title', 'race', 'garage'];
// 畫面 → 音樂槽（結果畫面沿用車庫曲）
// 暫停沿用比賽曲目（音樂不斷），但引擎、打滑、氮氣等持續音會停（見 setScreen）
const SCREEN_SLOT = { title: 'title', race: 'race', pause: 'race', garage: 'garage', results: 'garage' };
const RATE_LIMIT = 0.05;   // 同名音效最短間隔（秒）
const MAX_VOICES = 20;     // 同時單發音效上限
// 只對玩家卡車發聲的事件（AI 的圈數、完賽不出聲）
const PLAYER_ONLY = new Set(['lap', 'finish', 'final_lap', 'overtake', 'pickup']);

export function createAudio() {
  const hasWin = typeof window !== 'undefined';
  const AC = hasWin ? (window.AudioContext || window.webkitAudioContext) : null;
  let ctx = null;
  let bus = null;           // {master, music, sfx, engine, comp}
  let music = null;
  let musicTimer = 0;
  const vol = { master: 0.9, music: 0.5, sfx: 0.85, engine: 0.6 };
  let muted = false;
  try { if (hasWin && /[?&]mute=1\b/.test(window.location.search)) muted = true; } catch { /* 忽略 */ }

  const listeners = new Map();                 // 名稱（或 '*'）→ Set<fn>
  const custom = new Map();                    // 名稱 → fn | AudioBuffer
  const musicSrc = { title: 'synth', race: 'synth', garage: 'synth' }; // 'synth' | AudioBuffer | null | {pending}
  const lastPlayed = new Map();
  let voices = 0;
  let screen = 'title';
  let truckVoices = [];
  let enginesOn = false;

  // ── 圖 ──
  function build() {
    if (ctx || !AC) return !!ctx;
    try {
      ctx = new AC({ latencyHint: 'interactive' });
    } catch {
      try { ctx = new AC(); } catch { ctx = null; return false; }
    }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    const master = ctx.createGain();
    master.connect(comp).connect(ctx.destination);
    bus = { comp, master };
    for (const b of ['music', 'sfx', 'engine']) {
      bus[b] = ctx.createGain();
      bus[b].connect(master);
    }
    applyVolumes(true);
    music = createMusic(ctx, bus.music);
    // 解碼先前以 URL 指定、還在等 context 的音樂
    for (const s of SLOTS) if (musicSrc[s] && musicSrc[s].bytes) decodeInto(s, musicSrc[s].bytes);
    musicTimer = setInterval(() => { try { music.tick(); } catch { /* 忽略 */ } }, 50);
    if (hasWin && window.document) {
      window.document.addEventListener('visibilitychange', onVis);
    }
    if (SCREEN_SLOT[screen]) startMusic(SCREEN_SLOT[screen]);
    return true;
  }

  function onVis() {
    if (!ctx) return;
    try {
      if (window.document.hidden) ctx.suspend();
      else ctx.resume();
    } catch { /* 忽略 */ }
  }

  function applyVolumes(now) {
    if (!bus) return;
    const t = ctx.currentTime;
    const set = (p, v) => (now ? (p.value = v) : p.setTargetAtTime(v, t, 0.03));
    set(bus.master.gain, muted ? 0 : vol.master);
    set(bus.music.gain, vol.music);
    set(bus.sfx.gain, vol.sfx);
    set(bus.engine.gain, vol.engine);
  }

  function unlock() {
    if (!build()) return false;
    try {
      if (ctx.state !== 'running') {
        const r = ctx.resume();
        if (r && r.catch) r.catch(() => {});
      }
    } catch { /* 忽略 */ }
    return true;
  }

  // ── 音樂 ──
  function startMusic(slot) {
    if (!music) return;
    if (!slot) { music.stop(); return; }
    const src = musicSrc[slot];
    const playable = src === 'synth' || (src && typeof src.getChannelData === 'function') ? src : null;
    music.play(slot, playable);
  }

  function decodeInto(slot, bytes) {
    if (!ctx) return;
    const token = musicSrc[slot];
    const done = (buf) => {
      if (musicSrc[slot] !== token) return; // 期間又被換掉
      musicSrc[slot] = buf;
      if (SCREEN_SLOT[screen] === slot) startMusic(slot);
    };
    try {
      const r = ctx.decodeAudioData(bytes.slice(0), done, () => {});
      if (r && r.then) r.then(done, () => {});
    } catch { /* 格式不支援：維持靜音 */ }
  }

  // source：AudioBuffer、URL 字串、null（這一槽靜音）、undefined 或 'default'（恢復預設合成曲）
  function setMusic(slot, source) {
    if (!SLOTS.includes(slot)) return false;
    if (source === undefined || source === 'default') musicSrc[slot] = 'synth';
    else if (source === null) musicSrc[slot] = null;
    else if (typeof source === 'string') {
      // 只有 API 使用者提供網址時才發出請求
      const token = { url: source, bytes: null };
      musicSrc[slot] = token;
      if (typeof fetch === 'function') {
        fetch(source)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
          .then((ab) => {
            if (musicSrc[slot] !== token) return;
            token.bytes = ab;
            if (ctx) decodeInto(slot, ab);
          })
          .catch(() => { if (musicSrc[slot] === token) musicSrc[slot] = null; });
      }
    } else if (source && typeof source.getChannelData === 'function') musicSrc[slot] = source;
    else return false;
    if (SCREEN_SLOT[screen] === slot) startMusic(slot);
    return true;
  }

  // ── 單發音效 ──
  function play(name, params = {}) {
    if (!ctx || !bus || muted) return false;
    if (ctx.state !== 'running') return false;
    const t = ctx.currentTime;
    const key = params.ai ? name + ':ai' : name;
    const last = lastPlayed.get(key);
    if (last !== undefined && t - last < RATE_LIMIT) return false;
    if (voices >= MAX_VOICES) return false;
    const def = custom.has(name) ? custom.get(name) : SFX[name];
    if (!def) return false;
    lastPlayed.set(key, t);
    const g = ctx.createGain();
    g.gain.value = params.gain != null ? params.gain : 1;
    let node = g;
    if (params.pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, params.pan));
      g.connect(p);
      node = p;
    }
    node.connect(bus.sfx);
    let dur = 1;
    try {
      if (typeof def === 'function') {
        const r = def(ctx, g, params);
        if (typeof r === 'number' && r > 0) dur = r;
      } else if (def && typeof def.getChannelData === 'function') {
        const s = ctx.createBufferSource();
        s.buffer = def;
        s.connect(g);
        s.start(t);
        dur = def.duration;
      }
    } catch { /* 自訂音效出錯不影響遊戲 */ }
    voices++;
    setTimeout(() => {
      voices = Math.max(0, voices - 1);
      try { node.disconnect(); } catch { /* 忽略 */ }
    }, (dur + 0.3) * 1000);
    return true;
  }

  function fire(name, payload) {
    const run = (set, ...args) => {
      if (!set) return;
      for (const fn of [...set]) {
        try { fn(...args); } catch (err) { setTimeout(() => { throw err; }); }
      }
    };
    run(listeners.get(name), payload);
    run(listeners.get('*'), name, payload);
  }

  // core 事件（或 UI 字串事件）→ 掛點 + 預設音效。opts.silent：只觸發 on() 掛點、不發聲（快轉收尾用）
  let lastState = null;
  function handleEvents(events, core, opts) {
    if (!events || !events.length) return;
    const silent = !!(opts && opts.silent);
    let s = null;
    try { s = core && core.state ? core.state() : lastState; } catch { s = lastState; }
    for (const ev of events) {
      if (!ev) continue;
      const name = eventName(ev.type);
      if (!name) continue;
      const truck = ev.truck | 0;
      const payload = { truck, a: +ev.a || 0, b: +ev.b || 0 };
      fire(name, payload);
      if (silent) continue;
      if (UI_NAMES.includes(name)) { play(name, payload); continue; }
      const player = isPlayer(s, truck);
      if (PLAYER_ONLY.has(name) && !player) continue;
      const opt = { ...payload };
      // AI 的聲音較小並依位置左右聲像
      if (!player && s && name !== 'countdown' && name !== 'go') {
        opt.gain = screen === 'race' ? 0.5 : 0.35;
        opt.pan = panFor(s, truck);
        opt.ai = true;
      } else if (screen !== 'race' && (name === 'countdown' || name === 'go')) {
        opt.gain = 0.5;
      }
      play(name, opt);
    }
  }

  function isPlayer(s, k) {
    if (!s || s.length < ST.TRUCK0 + ST.STRIDE * (k + 1)) return k === 0 && screen === 'race';
    return k === 0 && !(s[ST.TRUCK0 + ST.STRIDE * k + ST.IS_AI] > 0.5);
  }

  function panFor(s, k) {
    const n = Math.min(4, (s[ST.TRUCKS] | 0) || 4);
    const px = (i) => s[ST.TRUCK0 + ST.STRIDE * i + ST.X] || 0;
    let ref;
    if (isPlayer(s, 0)) ref = px(0);
    else { ref = 0; for (let i = 0; i < n; i++) ref += px(i); ref /= n; }
    return Math.max(-0.8, Math.min(0.8, (px(k) - ref) / 36));
  }

  // ── 引擎持續音 ──
  function engines(on) {
    if (on === enginesOn) return;
    enginesOn = on;
    if (!on) { for (const v of truckVoices) v.stop(); truckVoices = []; }
  }

  function update(core, dt, scr) {
    if (scr && scr !== screen) setScreen(scr);
    let s = null;
    try { s = core && core.state ? core.state() : null; } catch { s = null; }
    if (s) lastState = s;
    const phase = s ? s[ST.PHASE] | 0 : 0;
    const want = !!(ctx && s && ctx.state === 'running' && (screen === 'race' || screen === 'title') && phase >= 1);
    engines(want);
    if (!want) return;
    const n = Math.min(4, (s[ST.TRUCKS] | 0) || 4);
    while (truckVoices.length < n) truckVoices.push(createTruckVoice(ctx, bus.engine));
    const attract = screen !== 'race';
    for (let k = 0; k < n; k++) {
      const player = isPlayer(s, k);
      const level = attract ? 0.16 : player ? 0.62 : 0.2;
      truckVoices[k].set(s, k, { level, pan: player ? 0 : panFor(s, k) });
    }
  }

  // 任何畫面名都接受：race／title 以外停掉引擎；沒有對應音樂槽的畫面（暫停、賽道介紹…）沿用目前曲目
  function setScreen(scr) {
    if (typeof scr !== 'string' || !scr) return;
    screen = scr;
    if (scr !== 'race' && scr !== 'title') engines(false);
    const slot = SCREEN_SLOT[scr];
    if (music && slot && music.current() !== slot) startMusic(slot);
  }

  // ── 對外掛點（window.Sidewinder.audio）──
  const api = {
    events: ALL_NAMES.slice(),
    on(name, fn) {
      if (typeof fn !== 'function') return () => {};
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
      return () => api.off(name, fn);
    },
    off(name, fn) {
      const set = listeners.get(name);
      if (set) set.delete(fn);
    },
    // fn(ctx, destination, {truck, a, b}) 或 AudioBuffer；傳 null 恢復預設
    registerSfx(name, fnOrBuffer) {
      if (fnOrBuffer == null) { custom.delete(name); return true; }
      if (typeof fnOrBuffer === 'function' || typeof fnOrBuffer.getChannelData === 'function') {
        custom.set(name, fnOrBuffer);
        return true;
      }
      return false;
    },
    setMusic,
    setVolume(b, v) {
      if (!BUSES.includes(b)) return false;
      vol[b] = Math.max(0, Math.min(1, +v || 0));
      applyVolumes(false);
      return true;
    },
    getVolume: (b) => (BUSES.includes(b) ? vol[b] : undefined),
    mute(m = true) { muted = !!m; applyVolumes(false); return muted; },
    isMuted: () => muted,
    // 直接播放（UI 音效由 app 呼叫：ui_move／ui_confirm／ui_back／purchase），同時觸發 on() 掛點
    play(name, params = {}) {
      const payload = { truck: params.truck | 0, a: +params.a || 0, b: +params.b || 0 };
      fire(name, payload);
      return play(name, { ...payload, gain: params.gain, pan: params.pan });
    },
    context: () => ctx,
    state: () => (ctx ? ctx.state : 'none'),
  };

  return {
    unlock,
    handleEvents,
    update,
    setScreen,
    api,
    destroy() {
      engines(false);
      if (music) music.stop();
      if (musicTimer) clearInterval(musicTimer);
      if (hasWin && window.document) window.document.removeEventListener('visibilitychange', onVis);
      try { if (ctx) ctx.close(); } catch { /* 忽略 */ }
      ctx = null; bus = null; music = null;
    },
  };
}
