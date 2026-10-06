// 音效：開場時以樣本級合成（sfx-dsp.js）預先算好每種音色的數個變體，播放時隨機挑一個、微調音高與音量，避免單調；
// 另有程式產生的殘響、角色喊招語音（VOICEVOX 離線合成、內嵌在 voices.js）與太鼓＋箏的對戰配樂。
// audio.init() 可在使用者手勢之前呼叫（只建立 context 並在背景算音色）；第一次 pointerdown/keydown 時呼叫 audio.resume()。
// play(name, {vol, pan, pitch, dist, dur}) 回傳 null，或（'beam'、'beamCharge'、'recall'）回傳 { stop() }。
// say(heroId, line, {vol, pan}) 播角色語音（line：atk、hurt、Q、W、E、R、spark、die、win、ready）。
// 任何情況（沒有 AudioContext、尚未 resume、音色還沒算好）都不會丟例外。
import { dsp, RECIPES, MUSIC_RECIPES, KOTO_SCALE, koto } from './sfx-dsp.js';
import { VOICES } from './voices.js';

const NAMES = Object.keys(RECIPES);
const VARIANTS = { hitL: 5, hitM: 5, hitH: 4, swing: 5, slash: 3, blast: 4, explode: 3, dash: 3, vanish: 3, towerHit: 4, minionDie: 4, tower: 3, ui: 3, select: 3, ki: 3 };
const LOOP_GAIN = { beam: 0.8, beamCharge: 0.5, recall: 0.32 };
const E = 0.0001;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

let ctx = null, masterVol = 0.8, isMuted = false, musicWanted = false, active = 0;
let master, sfxBus, revSend, musBus, voxBus, duck;
const bank = {};      // name → [AudioBuffer]
const loops = {};     // name → bool
const mbank = {};     // 音樂單音
let kotoBank = [];
const vbank = {};     // heroId → line → [AudioBuffer]
let ready = false, building = false;
const recent = new Map();
const MAX_VOICES = 64;
const PRIORITY = new Set(['levelUp', 'victory', 'defeat', 'heroDie', 'towerDown', 'beam', 'spark', 'recall', 'select', 'ui', 'kiFull']);

function toBuffer(data) {
  let pk = 0; for (let i = 0; i < data.length; i++) pk = Math.max(pk, Math.abs(data[i]));
  if (pk > 0.95) { const g = 0.95 / pk; for (let i = 0; i < data.length; i++) data[i] *= g; }
  const b = ctx.createBuffer(1, data.length, ctx.sampleRate);
  b.getChannelData(0).set(data);
  return b;
}
// 程式產生的殘響（雙聲道、指數衰減的噪音，前段稀疏模擬早期反射）
function impulse(sec = 1.6) {
  const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c); let s = 977 + c * 131;
    for (let i = 0; i < len; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const t = i / ctx.sampleRate, w = (s / 4294967296) * 2 - 1;
      d[i] = w * Math.exp(-t / 0.42) * (t < 0.03 ? (i % 37 === 0 ? 3 : 0.2) : 1) * 0.5;
    }
  }
  return b;
}

function buildGraph() {
  master = ctx.createGain(); master.gain.value = isMuted ? 0 : masterVol;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.06;
  master.connect(comp); comp.connect(lim); lim.connect(ctx.destination);
  // 語音說話時把音效與配樂壓低一點（ducking）
  duck = ctx.createGain(); duck.gain.value = 1; duck.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(duck);
  const conv = ctx.createConvolver(); conv.buffer = impulse();
  revSend = ctx.createGain(); revSend.gain.value = 0.16; revSend.connect(conv);
  const revOut = ctx.createGain(); revOut.gain.value = 0.55; conv.connect(revOut); revOut.connect(duck);
  sfxBus.connect(revSend);
  musBus = ctx.createGain(); musBus.gain.value = 0.32; musBus.connect(duck); musBus.connect(revSend);
  voxBus = ctx.createGain(); voxBus.gain.value = 1.05; voxBus.connect(master);
  const vrev = ctx.createGain(); vrev.gain.value = 0.12; voxBus.connect(vrev); vrev.connect(conv);
}

// 背景分批算音色：每批一個音色，讓出主執行緒
function buildBank() {
  if (building) return; building = true;
  const jobs = [];
  NAMES.forEach((name, ni) => {
    const k = VARIANTS[name] || 2;
    jobs.push(() => {
      bank[name] = [];
      for (let v = 0; v < k; v++) {
        const r = RECIPES[name](dsp(ctx.sampleRate, ni * 101 + v * 7 + 1));
        bank[name].push(toBuffer(r.data));
        loops[name] = !!r.loop;
      }
    });
  });
  Object.keys(MUSIC_RECIPES).forEach((name, ni) => jobs.push(() => { mbank[name] = [0, 1, 2].map((v) => toBuffer(MUSIC_RECIPES[name](dsp(ctx.sampleRate, 900 + ni * 31 + v)))); }));
  jobs.push(() => { kotoBank = KOTO_SCALE.map((f, i) => toBuffer(koto(dsp(ctx.sampleRate, 700 + i), f))); });
  // 語音：base64 MP3 → decodeAudioData（非同步）
  jobs.push(() => {
    for (const hid in VOICES) {
      vbank[hid] = {};
      for (const line in VOICES[hid]) {
        vbank[hid][line] = [];
        for (const b64 of VOICES[hid][line]) {
          try {
            const bin = atob(b64), u = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
            const p = ctx.decodeAudioData(u.buffer, (buf) => vbank[hid][line].push(buf), () => {});
            if (p && p.catch) p.catch(() => {});
          } catch (e) { /* 這一句不播 */ }
        }
      }
    }
  });
  let i = 0;
  const step = () => {
    const t0 = performance.now();
    try { while (i < jobs.length && performance.now() - t0 < 12) jobs[i++](); } catch (e) { i++; }
    if (i < jobs.length) setTimeout(step, 0);
    else { ready = true; if (musicWanted && ctx.state === 'running') musicOn(); }
  };
  setTimeout(step, 0);
}

function ensure() {
  if (ctx) return true;
  try {
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return false;
    ctx = new AC({ latencyHint: 'interactive' });
    buildGraph();
    buildBank();
    return true;
  } catch (e) { ctx = null; return false; }
}
function throttled(name, per = 12) {
  const now = performance.now();
  let arr = recent.get(name);
  if (!arr) recent.set(name, (arr = []));
  while (arr.length && now - arr[0] > 100) arr.shift();
  if (arr.length >= per) return true;
  arr.push(now); return false;
}

// 一次播放：source → gain(音量) → pan → bus
function start(buf, bus, { vol = 1, pan = 0, rate = 1, loop = false, when = 0 } = {}) {
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = loop; src.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(g);
  let tail = g;
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); tail = p; }
  tail.connect(bus);
  const t = when || ctx.currentTime + 0.003;
  src.start(t);
  return { src, g, tail, t };
}
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ---------------- 配樂：太鼓節奏＋箏的即興句（都節音階），lookahead 排程 ---------------- */
const BPM = 100, STEP = 60 / BPM / 4;
// 16 步：o 大太鼓、n 長胴、s 締太鼓、r 鼓邊、k 鉦
const PATS = [
  'o...n..s o.n.s.r.',
  'o..sn.s. o.s.n.ss',
  'o...n.r. o..ono.s',
  'o.s.n.s. o.sno.ns',
  'o..ro..r n.n.osss',
  'o...k...n...k..s.',
].map((p) => p.replace(/ /g, ''));
let timer = null, nextT = 0, step = 0, phrase = [];
function hit(k, t, vel) {
  const map = { o: 'odaiko', n: 'nagado', s: 'shime', r: 'rim', k: 'kane' };
  const b = mbank[map[k]]; if (!b) return;
  const s = start(pick(b), musBus, { vol: vel * (k === 'o' ? 0.95 : k === 'n' ? 0.75 : k === 'k' ? 0.4 : 0.55), rate: 1 + (Math.random() - 0.5) * 0.03, when: t, pan: k === 's' ? -0.25 : k === 'k' ? 0.3 : 0 });
  s.src.onended = () => { try { s.tail.disconnect(); } catch (e) { /* ignore */ } };
}
function newPhrase(bar) {
  // 兩小節一句：5～8 個音、多半級進，偶爾跳進，句尾落在主音或屬音
  const out = [], len = 5 + Math.floor(Math.random() * 4);
  let idx = 5 + Math.floor(Math.random() * 3);
  let pos = 0;
  for (let i = 0; i < len && pos < 30; i++) {
    out.push([pos, idx]);
    pos += [2, 2, 3, 4, 4, 6][Math.floor(Math.random() * 6)];
    idx = clamp(idx + [-2, -1, -1, 1, 1, 2, 3][Math.floor(Math.random() * 7)], 2, KOTO_SCALE.length - 1);
  }
  if (out.length) out[out.length - 1][1] = Math.random() < 0.6 ? 5 : 7;
  return out.map(([p, k]) => [bar * 16 + p, k]);
}
function musicOn() {
  if (timer || !ready) return;
  nextT = ctx.currentTime + 0.1; step = 0; phrase = [];
  const tick = () => {
    try {
      // 背景分頁的 setInterval 會被節流到每秒一次：落後的拍子直接跳過，不要全部擠在同一刻補打
      if (nextT < ctx.currentTime) { const skip = Math.ceil((ctx.currentTime - nextT) / STEP); nextT += skip * STEP; step += skip; }
      while (nextT < ctx.currentTime + 0.15) {
        const bar = Math.floor(step / 16), sec = Math.floor(bar / 4) % PATS.length, pat = PATS[sec];
        const k = pat[step % 16];
        const accent = step % 4 === 0 ? 1 : 0.75;
        if (k && k !== '.') hit(k, nextT, accent * (0.85 + Math.random() * 0.2));
        if (step % 32 === 0 && bar % 4 !== 3) phrase = Math.random() < 0.75 ? newPhrase(bar) : [];
        for (const [p, ki] of phrase) if (p === step && kotoBank[ki]) { const s = start(kotoBank[ki], musBus, { vol: 0.42, when: nextT, pan: 0.15 }); s.src.onended = () => { try { s.tail.disconnect(); } catch (e) { /* ignore */ } }; }
        nextT += STEP; step++;
      }
    } catch (e) { /* context 關閉 */ }
  };
  tick(); timer = setInterval(tick, 30);
}
function musicOff() { if (timer) { clearInterval(timer); timer = null; } }

/* ---------------- 語音 ---------------- */
const speaking = new Map(); // heroId → { src, g, until }
let duckUntil = 0;

export const audio = {
  names: NAMES,
  init() { ensure(); },
  resume() {
    if (!ensure()) return;
    try {
      if (ctx.state === 'suspended') { const p = ctx.resume(); if (p && p.then) p.then(() => { if (musicWanted) musicOn(); }).catch(() => {}); }
      else if (musicWanted) musicOn();
    } catch (e) { /* ignore */ }
  },
  play(name, opts = {}) {
    try {
      if (!ctx || !ready || ctx.state !== 'running' || isMuted) return null;
      const arr = bank[name]; if (!arr || !arr.length) return null;
      if (throttled(name)) return null;
      if (active >= MAX_VOICES && !PRIORITY.has(name)) return null;
      const v = clamp((opts.vol == null ? 1 : opts.vol) * (opts.dist == null ? 1 : clamp(opts.dist, 0, 1)), 0, 1.5);
      if (v <= 0.001) return null;
      const loop = loops[name];
      const rate = clamp((opts.pitch || 1) * (loop ? 1 : 1 + (Math.random() - 0.5) * 0.08), 0.25, 4);
      const s = start(pick(arr), sfxBus, { vol: loop ? 0 : v * (0.9 + Math.random() * 0.2), pan: opts.pan || 0, rate, loop });
      active++;
      let freed = false;
      const free = () => { if (freed) return; freed = true; active--; try { s.tail.disconnect(); } catch (e) { /* ignore */ } };
      if (!loop) { s.src.onended = free; return null; }
      // 循環音：淡入，到期或 stop 時淡出
      const g = s.g.gain, t = s.t, peak = v * (LOOP_GAIN[name] || 0.6), dur = opts.dur;
      g.setValueAtTime(E, t); g.exponentialRampToValueAtTime(peak, t + (name === 'beamCharge' ? Math.min(0.5, dur || 0.5) : 0.06));
      if (name === 'beamCharge') { s.src.playbackRate.setValueAtTime(0.75 * rate, t); s.src.playbackRate.linearRampToValueAtTime(1.35 * rate, t + (dur || 0.6)); }
      let done = false;
      const stop = (at) => {
        if (done) return; done = true;
        try { const tt = at || ctx.currentTime; g.cancelScheduledValues(tt); g.setValueAtTime(Math.max(E, g.value), tt); g.exponentialRampToValueAtTime(E, tt + 0.18); s.src.stop(tt + 0.25); } catch (e) { /* ignore */ }
        setTimeout(free, ((at ? at - ctx.currentTime : 0) + 0.4) * 1000);
      };
      if (dur) stop(t + dur);
      return { stop: () => stop(), get ended() { return done; } };
    } catch (e) { return null; }
  },
  // 角色語音：同一角色一次只說一句（新的打斷舊的，除非舊的優先度較高還沒說完）
  say(heroId, line, opts = {}) {
    try {
      if (!ctx || !ready || ctx.state !== 'running' || isMuted) return false;
      const arr = vbank[heroId] && vbank[heroId][line]; if (!arr || !arr.length) return false;
      const pri = { R: 3, spark: 3, die: 3, win: 3, Q: 2, W: 2, E: 2, ready: 2, atk: 1, hurt: 1 }[line] || 1;
      const now = ctx.currentTime, cur = speaking.get(heroId);
      if (cur && now < cur.until) {
        if (cur.pri > pri) return false;
        try { cur.g.gain.setTargetAtTime(0, now, 0.02); cur.src.stop(now + 0.1); } catch (e) { /* ignore */ }
      }
      if (line === 'atk' || line === 'hurt') { if (throttled('vox:' + heroId, 1)) return false; }
      const buf = pick(arr);
      const v = clamp(opts.vol == null ? 1 : opts.vol, 0, 1.4);
      const s = start(buf, voxBus, { vol: v, pan: opts.pan || 0, rate: 1 + (Math.random() - 0.5) * 0.03 });
      s.src.onended = () => { try { s.tail.disconnect(); } catch (e) { /* ignore */ } };
      speaking.set(heroId, { src: s.src, g: s.g, until: now + buf.duration, pri });
      // 主角或近處的大招：壓低其他聲音
      if (v > 0.6 && pri >= 2) {
        const until = now + buf.duration;
        duck.gain.cancelScheduledValues(now); duck.gain.setTargetAtTime(0.55, now, 0.03);
        duckUntil = Math.max(duckUntil, until);
        duck.gain.setTargetAtTime(1, duckUntil, 0.12);
      }
      return true;
    } catch (e) { return false; }
  },
  setMaster(v) {
    masterVol = clamp(+v || 0, 0, 1);
    try { if (master && !isMuted) master.gain.setTargetAtTime(masterVol, ctx.currentTime, 0.02); } catch (e) { /* ignore */ }
  },
  music(on) {
    musicWanted = !!on;
    try {
      if (!ctx) return;
      if (musicWanted && ctx.state === 'running') musicOn(); else if (!musicWanted) musicOff();
    } catch (e) { /* ignore */ }
  },
  get muted() { return isMuted; },
  toggleMute() {
    isMuted = !isMuted;
    try { if (master) master.gain.setTargetAtTime(isMuted ? 0 : masterVol, ctx.currentTime, 0.02); } catch (e) { /* ignore */ }
    return isMuted;
  },
  get ready() { return ready; },
  get context() { return ctx; },
};
