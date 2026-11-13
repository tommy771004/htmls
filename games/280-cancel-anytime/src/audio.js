// 280 絕命免運費 · CANCEL ANYTIME —— 音效與背景音樂，全部用 WebAudio 即時合成（不載入任何音檔）。
// 匯出 SFX = { init(), play(name, opts), music(theme|null), intensity(0–1), duck(秒), voice(key, 音節數, opts), setMuted(bool), get muted }
// - init()：必須由使用者手勢（click / keydown）呼叫；可重複呼叫。可選參數 init(externalCtx) 給 OfflineAudioContext 測音量用。
// - 尚未 init 或瀏覽器不支援時，所有方法都是 no-op，永不 throw。
// - 模組頂層不建立任何 AudioNode；全部在 init() 之後才建。
/* global window, OfflineAudioContext */

let ctx = null;          // AudioContext（或測試用 OfflineAudioContext）
let offline = false;
let out = null;          // 靜音閘（master）
let sfxBus = null, musicBus = null;
let noiseBuf = null, shaperCurve = null;
let mutedFlag = false;
let pendingTheme = null; // init 之前呼叫 music() 時先記下，init 後自動開始
let track = null;        // 目前播放的音樂軌
let PK = 1;              // play() 期間的音高倍率（opts.pitch）
const lastPlay = Object.create(null);

const POST = 0.7;        // 壓縮器自動補償增益後再壓回來，讓 SFX 峰值約 -6 dBFS
const MUSIC_GAIN = 0.12;

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];

function alive() {
  return !!ctx && (offline || ctx.state === 'running');
}

// ───────────────────────── 基本合成元件 ─────────────────────────

function envDecay(p, t, peak, a, dur) {
  p.setValueAtTime(0.0001, t);
  p.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
  p.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, a + 0.01));
}
function envHold(p, t, peak, a, hold, rel) {
  const h = Math.max(hold, a + 0.002);
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(Math.max(peak, 0.0002), t + a);
  p.setValueAtTime(Math.max(peak, 0.0002), t + h);
  p.exponentialRampToValueAtTime(0.0001, t + h + Math.max(rel, 0.01));
}
function filt(type, f, Q = 1) {
  const fl = ctx.createBiquadFilter();
  fl.type = type; fl.frequency.value = f; fl.Q.value = Q;
  return fl;
}
// 振盪器音：o = { type, f, f1, glide, g, a, dur | hold+rel, det, lp/hp/bp, Q, fe, vib, vibRate }
function tone(t, o, dest) {
  const type = o.type || 'sine';
  const F = (o.f || 440) * PK;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(F, t);
  if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1 * PK), t + (o.glide || o.dur || 0.2));
  if (o.det) osc.detune.value = o.det;
  let node = osc, fl = null;
  if (o.lp || o.hp || o.bp) {
    fl = filt(o.lp ? 'lowpass' : o.hp ? 'highpass' : 'bandpass', o.lp || o.hp || o.bp, o.Q || 1);
    if (o.fe) {
      fl.frequency.setValueAtTime(o.lp || o.hp || o.bp, t);
      fl.frequency.exponentialRampToValueAtTime(o.fe, t + (o.fglide || o.dur || o.hold || 0.2));
    }
    osc.connect(fl); node = fl;
  }
  const gn = ctx.createGain();
  const g = o.g == null ? 0.3 : o.g, a = o.a || 0.004;
  let end;
  if (o.hold != null) { envHold(gn.gain, t, g, a, o.hold, o.rel || 0.08); end = t + Math.max(o.hold, a) + (o.rel || 0.08); }
  else { const dur = o.dur || 0.2; envDecay(gn.gain, t, g, a, dur); end = t + Math.max(dur, a + 0.01); }
  node.connect(gn); gn.connect(dest);
  if (o.vib) {
    const l = ctx.createOscillator(), lg = ctx.createGain();
    l.frequency.value = o.vibRate || 6; lg.gain.value = o.vib * F;
    l.connect(lg); lg.connect(osc.frequency);
    l.start(t); l.stop(end + 0.05);
  }
  osc.start(t); osc.stop(end + 0.05);
  return osc;
}
// 噪音：o = { type, f, f1, glide, Q, g, a, dur | hold+rel }
function noise(t, o, dest) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf; src.loop = true;
  const f = o.f || 1000;
  const fl = filt(o.type || 'bandpass', f, o.Q || 1);
  if (o.f1) { fl.frequency.setValueAtTime(f, t); fl.frequency.exponentialRampToValueAtTime(o.f1, t + (o.glide || o.dur || o.hold || 0.2)); }
  const gn = ctx.createGain();
  const g = o.g == null ? 0.3 : o.g, a = o.a || 0.002;
  let end;
  if (o.hold != null) { envHold(gn.gain, t, g, a, o.hold, o.rel || 0.1); end = t + Math.max(o.hold, a) + (o.rel || 0.1); }
  else { const dur = o.dur || 0.2; envDecay(gn.gain, t, g, a, dur); end = t + Math.max(dur, a + 0.01); }
  src.connect(fl); fl.connect(gn); gn.connect(dest);
  src.start(t, Math.random() * 1.5); src.stop(end + 0.05);
  return gn;
}
// 低頻顫音（調變某個 AudioParam）
function lfo(param, t, dur, rate, depth, type = 'sine') {
  const l = ctx.createOscillator(), lg = ctx.createGain();
  l.type = type; l.frequency.value = rate; lg.gain.value = depth;
  l.connect(lg); lg.connect(param);
  l.start(t); l.stop(t + dur + 0.05);
}
// 鐘聲：非諧波泛音疊加
function bell(t, f, g, dur, dest, parts = [1, 2, 2.76, 5.4]) {
  const gs = [1, 0.5, 0.35, 0.18, 0.12];
  parts.forEach((p, i) => tone(t, { f: f * p, g: g * (gs[i] || 0.1), a: 0.002, dur: dur * (1 - i * 0.17) }, dest));
}
// 銅管和弦
function brass(t, notes, hold, g, dest, rel = 0.25) {
  notes.forEach(m => {
    const f = mtof(m);
    tone(t, { type: 'sawtooth', f, g: g, a: 0.03, hold, rel, lp: 900, fe: 2600, fglide: 0.12, det: -6 }, dest);
    tone(t, { type: 'sawtooth', f, g: g * 0.7, a: 0.03, hold, rel, lp: 1800, det: 7 }, dest);
  });
}
function thud(t, g, dest, f = 140, f1 = 40, dur = 0.35) {
  tone(t, { f, f1, glide: dur * 0.6, g, a: 0.002, dur }, dest);
}
function cymbal(t, g, dur, dest) {
  noise(t, { type: 'highpass', f: 5200, g, a: 0.002, dur }, dest);
  noise(t, { type: 'bandpass', f: 9000, Q: 0.6, g: g * 0.6, a: 0.002, dur: dur * 0.6 }, dest);
}

// ───────────────────────── 音效表 ─────────────────────────
// 每個函式 (t, o) => void；o 是這次播放的輸出節點。各音效自身峰值約 0.6–1.0，經 sfxBus/壓縮後約 -6 dBFS。
const FX = {
  dice(t, o) { // d20 在托盤裡滾動：越滾越慢
    noise(t, { type: 'lowpass', f: 700, g: 0.12, a: 0.02, dur: 0.6 }, o);
    let tt = t;
    const gaps = [0, 0.06, 0.055, 0.08, 0.06, 0.1, 0.12, 0.16];
    gaps.forEach((gp, i) => {
      tt += gp * rnd(0.8, 1.2);
      const v = 1 - i * 0.08;
      noise(tt, { type: 'bandpass', f: rnd(2400, 4600), Q: 5, g: 0.55 * v, dur: 0.035 }, o);
      tone(tt, { type: 'triangle', f: rnd(1100, 1800), g: 0.14 * v, dur: 0.045 }, o);
    });
  },
  select(t, o) {
    tone(t, { type: 'square', f: 660, g: 0.12, dur: 0.06, lp: 3000 }, o);
    tone(t + 0.055, { type: 'square', f: 990, g: 0.12, dur: 0.09, lp: 3000 }, o);
  },
  click(t, o) {
    tone(t, { type: 'triangle', f: 1400, f1: 900, g: 0.22, dur: 0.035 }, o);
    noise(t, { type: 'highpass', f: 4000, g: 0.12, dur: 0.015 }, o);
  },
  hover(t, o) {
    tone(t, { f: 1900, g: 0.05, dur: 0.035 }, o);
  },
  step(t, o) {
    noise(t, { type: 'lowpass', f: 500, g: 0.3, dur: 0.06 }, o);
    tone(t, { f: rnd(110, 140), f1: 60, g: 0.18, dur: 0.06 }, o);
  },
  turn(t, o) { // 輪到你：三音上行鈴
    [76, 79, 84].forEach((m, i) => bell(t + i * 0.09, mtof(m), 0.2, 0.6, o, [1, 2, 3]));
  },
  hit(t, o) {
    noise(t, { type: 'lowpass', f: 1400, f1: 300, g: 0.6, dur: 0.14 }, o);
    thud(t, 0.6, o, 170, 50, 0.18);
    tone(t, { type: 'square', f: 220, f1: 110, g: 0.12, dur: 0.06, lp: 1200 }, o);
  },
  miss(t, o) { // 揮空的咻
    noise(t, { type: 'bandpass', f: 350, f1: 2600, glide: 0.18, Q: 2.5, g: 0.45, a: 0.12, dur: 0.34 }, o);
  },
  crit(t, o) { // FREEDOM CRIT：老鷹尖嘯 + 銅管爆發 + 定音鼓 + 鈸
    tone(t, { type: 'sawtooth', f: 2900, f1: 1700, glide: 0.45, g: 0.18, a: 0.02, dur: 0.5, hp: 1200, vib: 0.03, vibRate: 22 }, o);
    tone(t + 0.04, { type: 'square', f: 3400, f1: 2100, glide: 0.4, g: 0.07, a: 0.02, dur: 0.42, bp: 2600, Q: 3, vib: 0.04, vibRate: 30 }, o);
    const tb = t + 0.38;
    brass(tb, [60, 64, 67, 72], 0.55, 0.075, o, 0.4);
    thud(tb, 0.55, o, 110, 45, 0.6);
    cymbal(tb, 0.22, 1.2, o);
  },
  fumble(t, o) { // 悲傷長號 wah wah wah waaah
    const notes = [62, 61, 60, 59], lens = [0.34, 0.34, 0.34, 1.1];
    let tt = t;
    notes.forEach((m, i) => {
      const f = mtof(m) / 2, L = lens[i];
      const osc = tone(tt, { type: 'sawtooth', f, g: 0.3, a: 0.04, hold: L - 0.06, rel: 0.1, lp: 380, fe: 1300, fglide: L * 0.5, vib: i === 3 ? 0.025 : 0, vibRate: 5 }, o);
      if (i === 3) osc.frequency.setTargetAtTime(f * 0.94 * PK, tt + 0.5, 0.3);
      tt += L;
    });
  },
  siren(t, o) { // 救護車 wee-woo ×2（約 1.5 s）
    const osc = ctx.createOscillator(); osc.type = 'triangle';
    const hi = 960 * PK, lo = 740 * PK, seg = 0.375;
    osc.frequency.setValueAtTime(hi, t);
    for (let i = 1; i < 4; i++) {
      const f = i % 2 ? lo : hi;
      osc.frequency.setValueAtTime(i % 2 ? hi : lo, t + i * seg - 0.03);
      osc.frequency.linearRampToValueAtTime(f, t + i * seg);
    }
    const gn = ctx.createGain();
    envHold(gn.gain, t, 0.38, 0.05, 1.4, 0.12);
    const fl = filt('lowpass', 2800);
    osc.connect(fl); fl.connect(gn); gn.connect(o);
    osc.start(t); osc.stop(t + 1.6);
  },
  ko(t, o) { // 卡通昏倒：下滑音 + 倒地
    tone(t, { type: 'triangle', f: 700, f1: 90, glide: 0.65, g: 0.3, a: 0.01, dur: 0.7, vib: 0.06, vibRate: 9 }, o);
    thud(t + 0.66, 0.6, o, 120, 40, 0.4);
    noise(t + 0.66, { type: 'lowpass', f: 500, g: 0.4, dur: 0.25 }, o);
    [0, 0.12, 0.24].forEach((d, i) => bell(t + 0.75 + d, 2200 + i * 300, 0.06, 0.25, o, [1, 2.4]));
  },
  boom(t, o) {
    noise(t, { type: 'lowpass', f: 1600, f1: 110, glide: 1.0, g: 0.75, a: 0.004, dur: 1.3 }, o);
    thud(t, 0.75, o, 90, 28, 0.9);
    for (let i = 0; i < 7; i++) noise(t + 0.1 + rnd(0, 0.7), { type: 'bandpass', f: rnd(1200, 3000), Q: 3, g: 0.12, dur: 0.03 }, o);
  },
  ignite(t, o) { // 火焰 whoomp
    noise(t, { type: 'lowpass', f: 180, f1: 2200, glide: 0.12, g: 0.6, a: 0.07, dur: 0.6 }, o);
    tone(t, { f: 60, f1: 120, glide: 0.12, g: 0.4, a: 0.05, dur: 0.4 }, o);
    for (let i = 0; i < 5; i++) noise(t + 0.15 + i * rnd(0.05, 0.1), { type: 'bandpass', f: rnd(1500, 3500), Q: 4, g: 0.1, dur: 0.025 }, o);
  },
  zap(t, o) {
    const osc = tone(t, { type: 'sawtooth', f: 400, g: 0.2, a: 0.003, dur: 0.38, bp: 1500, Q: 0.8 }, o);
    for (let i = 1; i < 20; i++) osc.frequency.setValueAtTime(rnd(90, 1700) * PK, t + i * 0.018);
    for (let i = 0; i < 10; i++) noise(t + i * 0.035 + rnd(0, 0.02), { type: 'highpass', f: 3500, g: 0.28, dur: 0.02 }, o);
  },
  toxic(t, o) { // 毒氣嘶嘶 + 冒泡
    noise(t, { type: 'bandpass', f: 3200, Q: 0.7, g: 0.32, a: 0.12, hold: 0.7, rel: 0.4 }, o);
    const osc = tone(t, { type: 'sawtooth', f: 75, g: 0.18, a: 0.05, hold: 0.6, rel: 0.2, lp: 300 }, o);
    lfo(osc.frequency, t, 0.85, 11, 18 * PK);
    for (let i = 0; i < 5; i++) tone(t + 0.1 + i * 0.13, { f: rnd(300, 600), f1: rnd(700, 1100), g: 0.08, dur: 0.06 }, o);
  },
  splat(t, o) {
    noise(t, { type: 'lowpass', f: 1800, f1: 260, g: 0.65, dur: 0.28 }, o);
    tone(t, { f: 320, f1: 60, g: 0.4, dur: 0.22 }, o);
    for (let i = 0; i < 4; i++) tone(t + 0.18 + i * rnd(0.06, 0.12), { f: rnd(700, 1300), f1: rnd(250, 400), g: 0.08, dur: 0.07 }, o);
  },
  crash(t, o) { // 玻璃金屬吊燈墜落
    [311, 467, 653, 902].forEach(f => tone(t, { type: 'square', f: f * rnd(0.97, 1.03), g: 0.05, dur: 0.7, lp: 4000 }, o));
    noise(t, { type: 'highpass', f: 2800, g: 0.45, dur: 0.9 }, o);
    noise(t, { type: 'lowpass', f: 900, g: 0.4, dur: 0.25 }, o);
    for (let i = 0; i < 14; i++) tone(t + rnd(0, 0.7), { type: 'triangle', f: rnd(2600, 7000), g: 0.07, dur: rnd(0.06, 0.2) }, o);
  },
  geyser(t, o) { // 汽水噴發：氣泡嘶嘶 + 上衝
    const g = noise(t, { type: 'highpass', f: 3800, g: 0.28, a: 0.05, hold: 1.1, rel: 0.4 }, o);
    lfo(g.gain, t, 1.5, 17, 0.1, 'square');
    noise(t, { type: 'bandpass', f: 250, f1: 3200, glide: 0.5, Q: 1.5, g: 0.45, a: 0.15, dur: 0.8 }, o);
    for (let i = 0; i < 16; i++) tone(t + rnd(0, 1.2), { f: rnd(700, 1500), f1: rnd(1600, 2600), g: 0.06, dur: 0.04 }, o);
  },
  hammer(t, o) { // 巨型金屬重擊
    [170, 271, 413, 589, 811, 1130].forEach((f, i) => tone(t, { type: i < 2 ? 'square' : 'sine', f, g: i < 2 ? 0.08 : 0.12, dur: 1.0 - i * 0.1, lp: 3500 }, o));
    thud(t, 0.7, o, 100, 35, 0.5);
    noise(t, { type: 'bandpass', f: 2500, Q: 0.8, g: 0.5, dur: 0.08 }, o);
  },
  drone(t, o) { // 外送無人機嗡嗡飛來 + 落地
    const g = ctx.createGain(); g.gain.value = 0.7; g.connect(o);
    lfo(g.gain, t, 1.0, 32, 0.25);
    [180, 184, 361].forEach((f, i) => tone(t, { type: 'sawtooth', f, f1: f * 0.88, glide: 1.0, g: i === 2 ? 0.05 : 0.11, a: 0.25, hold: 0.85, rel: 0.12, lp: 1400 }, g));
    thud(t + 0.95, 0.55, o, 130, 45, 0.3);
    noise(t + 0.95, { type: 'lowpass', f: 700, g: 0.4, dur: 0.15 }, o);
  },
  refund(t, o) { // 收銀機 cha-ching
    noise(t, { type: 'bandpass', f: 1800, Q: 2, g: 0.35, dur: 0.05 }, o);
    noise(t + 0.05, { type: 'lowpass', f: 900, g: 0.3, dur: 0.08 }, o);
    bell(t + 0.1, 2093, 0.22, 0.5, o);
    bell(t + 0.2, 2637, 0.26, 0.9, o);
    for (let i = 0; i < 6; i++) tone(t + 0.22 + i * 0.045, { type: 'triangle', f: rnd(4000, 6500), g: 0.05, dur: 0.06 }, o);
  },
  gaslight(t, o) { // 故障的通知音：走音、結巴、錯位
    const seq = [[0, 1568], [0.1, 1620], [0.22, 2093], [0.26, 2093], [0.3, 2093], [0.46, 1480]];
    seq.forEach(([d, f], i) => {
      tone(t + d, { f, f1: i === 5 ? f * 0.6 : 0, glide: 0.2, g: 0.18, dur: 0.14 }, o);
      tone(t + d, { f: f * 2.01, g: 0.05, dur: 0.08 }, o);
    });
    for (let i = 0; i < 4; i++) tone(t + rnd(0.05, 0.5), { type: 'square', f: rnd(250, 900), g: 0.06, dur: 0.025 }, o);
  },
  heal(t, o) { // 閃亮上行
    [72, 76, 79, 84, 88, 91, 96].forEach((m, i) => tone(t + i * 0.055, { type: 'triangle', f: mtof(m), g: 0.13, dur: 0.4 }, o));
    for (let i = 0; i < 8; i++) tone(t + rnd(0.05, 0.6), { f: rnd(3000, 6000), g: 0.04, dur: 0.12 }, o);
  },
  eat(t, o) { // 咔滋咔滋 + 吞
    [0, 0.17, 0.34].forEach(d => {
      for (let i = 0; i < 5; i++) noise(t + d + i * 0.016 + rnd(0, 0.01), { type: 'bandpass', f: rnd(1300, 3200), Q: 1.5, g: 0.38, dur: 0.025 }, o);
      noise(t + d, { type: 'lowpass', f: 400, g: 0.25, dur: 0.06 }, o);
    });
    tone(t + 0.55, { f: 380, f1: 160, g: 0.3, dur: 0.12 }, o);
  },
  tele(t, o) {
    noise(t, { type: 'bandpass', f: 300, f1: 4200, glide: 0.28, Q: 3, g: 0.4, a: 0.1, dur: 0.32 }, o);
    tone(t + 0.28, { f: 380, f1: 1500, glide: 0.06, g: 0.35, dur: 0.09 }, o);
  },
  stealth(t, o) { // 悶住的「噓」
    const m = filt('lowpass', 1600); m.connect(o);
    noise(t, { type: 'bandpass', f: 3400, Q: 0.9, g: 0.5, a: 0.12, hold: 0.35, rel: 0.25 }, m);
  },
  slam(t, o) { // 地面重擊
    thud(t, 0.8, o, 95, 28, 0.7);
    noise(t, { type: 'lowpass', f: 420, g: 0.6, dur: 0.5 }, o);
    for (let i = 0; i < 8; i++) noise(t + 0.05 + rnd(0, 0.35), { type: 'bandpass', f: rnd(900, 2200), Q: 2, g: 0.12, dur: 0.03 }, o);
  },
  vape(t, o) { // 噗——一口煙
    noise(t, { type: 'bandpass', f: 600, f1: 1500, glide: 0.4, Q: 1, g: 0.45, a: 0.05, dur: 0.55 }, o);
    noise(t + 0.02, { type: 'highpass', f: 5000, g: 0.06, a: 0.05, dur: 0.4 }, o);
  },
  tackle(t, o) { // 美式足球擒抱 + 觀眾「喔～」
    thud(t, 0.7, o, 120, 45, 0.3);
    noise(t, { type: 'lowpass', f: 700, g: 0.55, dur: 0.2 }, o);
    noise(t, { type: 'bandpass', f: 2200, Q: 2, g: 0.3, dur: 0.04 }, o);
    const tc = t + 0.15, bp = filt('bandpass', 480, 2.5), cg = ctx.createGain();
    envHold(cg.gain, tc, 0.5, 0.18, 0.75, 0.4); bp.connect(cg); cg.connect(o);
    for (let i = 0; i < 6; i++) {
      const f = rnd(160, 320) * PK, osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, tc);
      osc.frequency.linearRampToValueAtTime(f * 1.2, tc + 0.35);
      osc.frequency.linearRampToValueAtTime(f * 0.92, tc + 1.15);
      const vg = ctx.createGain(); vg.gain.value = 0.12;
      osc.connect(vg); vg.connect(bp); osc.start(tc); osc.stop(tc + 1.25);
    }
    noise(tc, { type: 'bandpass', f: 600, Q: 1, g: 0.08, a: 0.2, hold: 0.7, rel: 0.4 }, o);
  },
  clang(t, o) { // 鍋鏟敲擊
    [850, 1373, 2214, 3168, 4400].forEach((f, i) => tone(t, { f: f * rnd(0.99, 1.01), g: 0.16 - i * 0.02, dur: 0.55 - i * 0.07 }, o));
    noise(t, { type: 'highpass', f: 3000, g: 0.25, dur: 0.02 }, o);
  },
  ding(t, o) { // 摔角鐘 DING DING DING
    [0, 0.24, 0.48].forEach(d => {
      bell(t + d, 1250, 0.3, 0.7, o, [1, 2.0, 2.76, 4.1]);
      noise(t + d, { type: 'highpass', f: 3500, g: 0.15, dur: 0.02 }, o);
    });
  },
  win(t, o) { // 勝利號角
    const seq = [[0, 67, 0.1], [0.13, 72, 0.1], [0.26, 76, 0.1], [0.39, 79, 0.28], [0.72, 76, 0.1], [0.85, 79, 0.8]];
    seq.forEach(([d, m, h]) => brass(t + d, [m], h, 0.13, o, 0.15));
    brass(t + 0.85, [60, 64, 67], 0.8, 0.05, o, 0.4);
    thud(t + 0.85, 0.45, o, 110, 45, 0.5);
    cymbal(t + 0.85, 0.18, 1.3, o);
  },
  lose(t, o) { // 下行失敗
    [[0, 67], [0.28, 63], [0.56, 60]].forEach(([d, m]) => tone(t + d, { type: 'triangle', f: mtof(m), g: 0.3, a: 0.01, hold: 0.22, rel: 0.1 }, o));
    tone(t + 0.85, { type: 'triangle', f: mtof(55), f1: mtof(43), glide: 0.9, g: 0.32, a: 0.02, hold: 0.8, rel: 0.3, vib: 0.02, vibRate: 5 }, o);
    tone(t + 0.85, { type: 'sawtooth', f: mtof(43), f1: mtof(31), glide: 0.9, g: 0.08, a: 0.02, hold: 0.8, rel: 0.3, lp: 500 }, o);
  },
  loot(t, o) { // 拿到道具
    [72, 76, 79, 84].forEach((m, i) => tone(t + i * 0.06, { type: 'square', f: mtof(m), g: 0.1, dur: 0.12, lp: 3500 }, o));
    [84, 88, 91].forEach(m => tone(t + 0.25, { type: 'triangle', f: mtof(m), g: 0.1, dur: 0.6 }, o));
    for (let i = 0; i < 5; i++) tone(t + 0.27 + i * 0.06, { f: rnd(3500, 6000), g: 0.04, dur: 0.1 }, o);
  },
  check(t, o) { // 擲骰前的鼓滾（約 0.8 s，越滾越密越大聲）
    let tt = t, gap = 0.065, i = 0;
    while (tt < t + 0.8) {
      const v = 0.15 + (tt - t) * 0.4;
      noise(tt, { type: 'bandpass', f: 1900, Q: 0.8, g: v * rnd(0.85, 1.1), dur: 0.06 }, o);
      tone(tt, { type: 'triangle', f: 190, g: v * 0.3, dur: 0.04 }, o);
      tt += gap; gap = Math.max(0.026, gap * 0.94); i++;
    }
  },
  checkWin(t, o) {
    noise(t, { type: 'bandpass', f: 2000, Q: 1, g: 0.4, dur: 0.08 }, o);
    brass(t + 0.04, [67, 72, 76], 0.12, 0.08, o, 0.1);
    brass(t + 0.2, [72, 76, 79, 84], 0.45, 0.07, o, 0.35);
    cymbal(t + 0.2, 0.2, 1.0, o);
  },
  checkFail(t, o) { // 低沉 bwomp-bwomp
    tone(t, { type: 'sawtooth', f: mtof(50), f1: mtof(48), glide: 0.25, g: 0.3, a: 0.02, hold: 0.22, rel: 0.08, lp: 600 }, o);
    tone(t + 0.32, { type: 'sawtooth', f: mtof(46), f1: mtof(40), glide: 0.5, g: 0.3, a: 0.02, hold: 0.45, rel: 0.2, lp: 500 }, o);
    thud(t + 0.32, 0.35, o, 90, 40, 0.35);
  },
  round(t, o) { // 新回合
    noise(t, { type: 'bandpass', f: 200, f1: 3000, glide: 0.4, Q: 1.5, g: 0.4, a: 0.2, dur: 0.5 }, o);
    tone(t, { f: 220, f1: 880, glide: 0.45, g: 0.12, a: 0.1, dur: 0.5 }, o);
    thud(t + 0.42, 0.4, o, 100, 45, 0.35);
  },
  notify(t, o) { // 手機推播
    tone(t, { f: mtof(88), g: 0.22, dur: 0.12 }, o);
    tone(t, { f: mtof(88) * 2.98, g: 0.04, dur: 0.06 }, o);
    tone(t + 0.1, { f: mtof(95), g: 0.22, dur: 0.25 }, o);
    tone(t + 0.1, { f: mtof(95) * 2.98, g: 0.04, dur: 0.1 }, o);
  },
  x(t, o) { // 關掉彈出廣告
    tone(t, { f: 950, f1: 280, glide: 0.06, g: 0.35, dur: 0.07 }, o);
    noise(t, { type: 'highpass', f: 3000, g: 0.15, dur: 0.015 }, o);
  },
};
// 同名音效最短間隔（秒），避免 hover/step 狂刷時堆疊節點
const MIN_GAP = { hover: 0.05, step: 0.06, click: 0.03 };
// 各音效的響度校正（以離線渲染量測峰值後調整：大招約 -6 dBFS、一般命中約 -10、UI 約 -18）
const LEVEL = { dice: 2.2, select: 1.8, click: 2.2, hover: 1.6, step: 2, hit: 2.4, miss: 2, splat: 1.8, vape: 2,
  x: 2, heal: 1.6, stealth: 1.8, tackle: 1.6, clang: 1.7, gaslight: 1.4, loot: 1.3, notify: 1.4, eat: 1.3, check: 1.3 };

// ───────────────────────── 現場觀眾與角色碎念（全部即時合成） ─────────────────────────
// 人聲用鋸齒波過兩個共振峰（母音），一群人就是很多把音高、起音時間都錯開的人聲疊在噪音底上。
const VOW = { a: [800, 1250], e: [520, 1800], i: [320, 2300], o: [480, 880], u: [350, 720] };
function vox(t, f, f1, dur, g, vw, dest, a = 0.03, type = 'sawtooth') {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(30, f * PK), t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, f1 * PK), t + dur);
  const gn = ctx.createGain();
  envHold(gn.gain, t, g, Math.min(a, dur * 0.4), dur * 0.6, dur * 0.4);
  const b1 = filt('bandpass', vw[0], 5), b2 = filt('bandpass', vw[1], 7), g2 = ctx.createGain();
  g2.gain.value = 0.6;
  osc.connect(b1); osc.connect(b2); b1.connect(gn); b2.connect(g2); g2.connect(gn); gn.connect(dest);
  osc.start(t); osc.stop(t + dur + 0.1);
}
// 一群人的「哇——」底噪
function crowdBed(t, dur, g, dest, f = 950) {
  const a = Math.min(0.22, dur * 0.3);
  noise(t, { type: 'bandpass', f, Q: 0.9, g, a, hold: dur * 0.55, rel: dur * 0.45 }, dest);
  noise(t, { type: 'bandpass', f: f * 2.4, Q: 1.2, g: g * 0.5, a, hold: dur * 0.5, rel: dur * 0.4 }, dest);
}
// 掌聲：一顆一顆的拍手，前段密、後段疏
function claps(t, dur, n, g, dest) {
  for (let i = 0; i < n; i++) {
    const k = Math.pow(Math.random(), 1.5);
    noise(t + k * dur, { type: 'bandpass', f: rnd(900, 2600), Q: 1.4, g: g * rnd(0.45, 1), a: 0.001, dur: rnd(0.012, 0.03) }, dest);
  }
}
function whoos(t, n, span, g, dest) {
  for (let i = 0; i < n; i++) {
    const f = rnd(330, 620), d = rnd(0.35, 0.7);
    vox(t + rnd(0, span), f, f * rnd(1.35, 1.7), d, g * rnd(0.6, 1), Math.random() < 0.6 ? VOW.u : VOW.o, dest, 0.05);
  }
}
function whistle(t, g, dest) {
  const f = rnd(1900, 2500);
  tone(t, { f, f1: f * 1.35, glide: 0.12, g, a: 0.01, hold: 0.28, rel: 0.12, vib: 0.012, vibRate: 9 }, dest);
}
Object.assign(FX, {
  cheer(t, o) { // 觀眾歡呼（爆擊、復活）
    crowdBed(t, 1.5, 0.26, o);
    whoos(t + 0.03, 6, 0.35, 0.08, o);
    claps(t + 0.15, 1.3, 34, 0.13, o);
    if (Math.random() < 0.6) whistle(t + rnd(0.2, 0.6), 0.035, o);
  },
  cheerBig(t, o) { // 全場起立（擊倒魔王、過關）
    crowdBed(t, 3, 0.32, o);
    crowdBed(t + 0.5, 2.6, 0.2, o, 700);
    whoos(t + 0.03, 10, 1.1, 0.085, o);
    claps(t + 0.2, 2.9, 80, 0.14, o);
    whistle(t + 0.35, 0.04, o); whistle(t + 1.1, 0.035, o);
  },
  applause(t, o) { // 一陣掌聲（擊倒小兵）
    crowdBed(t, 0.9, 0.08, o, 1500);
    claps(t, 1.1, 42, 0.15, o);
  },
  ooh(t, o) { // 「喔——」好痛（我方吃爆擊）
    crowdBed(t, 0.8, 0.08, o, 520);
    for (let i = 0; i < 7; i++) { const f = rnd(140, 330); vox(t + rnd(0, 0.09), f, f * rnd(0.84, 0.93), rnd(0.6, 0.85), 0.085, Math.random() < 0.5 ? VOW.o : VOW.u, o, 0.07); }
  },
  aww(t, o) { // 「啊……」惋惜（我方倒地、敗北）
    for (let i = 0; i < 7; i++) { const f = rnd(170, 360); vox(t + rnd(0, 0.12), f, f * rnd(0.68, 0.78), rnd(0.8, 1.1), 0.08, VOW.a, o, 0.09); }
    crowdBed(t, 0.9, 0.05, o, 600);
  },
  laugh(t, o) { // 罐頭笑聲（大失敗、尬聊破局）
    crowdBed(t, 1.2, 0.05, o, 1100);
    for (let v = 0; v < 7; v++) {
      const f = rnd(150, 400), gap = rnd(0.12, 0.17), n = 4 + (Math.random() * 4 | 0), t0 = t + rnd(0, 0.28);
      for (let j = 0; j < n; j++) {
        const ff = f * (1 - j * 0.045);
        vox(t0 + j * gap, ff * 1.08, ff * 0.86, gap * 0.62, 0.075 * (1 - j * 0.09), j % 3 === 2 ? VOW.e : VOW.a, o, 0.008);
      }
    }
  },
  gasp(t, o) { // 倒抽一口氣（魔王登場）
    noise(t, { type: 'highpass', f: 1800, f1: 5200, glide: 0.3, g: 0.16, a: 0.2, dur: 0.34 }, o);
    for (let i = 0; i < 4; i++) { const f = rnd(260, 420); vox(t + rnd(0, 0.05), f, f * 1.3, 0.26, 0.04, VOW.i, o, 0.12); }
  },
  bossSting(t, o) { // 魔王登場：定音鼓滾奏＋低銅管＋鈸
    for (let i = 0; i < 9; i++) thud(t + 0.62 * (1 - Math.pow(1 - i / 9, 1.8)), 0.16 + i * 0.03, o, 96, 62, 0.16);
    noise(t, { type: 'highpass', f: 4200, g: 0.1, a: 0.6, dur: 0.66 }, o);
    brass(t + 0.66, [36, 43, 48, 51], 0.9, 0.085, o, 0.5);
    thud(t + 0.66, 0.6, o, 120, 38, 0.7);
    cymbal(t + 0.66, 0.2, 1.6, o);
    tone(t + 0.66, { type: 'sawtooth', f: mtof(24), g: 0.2, a: 0.01, hold: 0.9, rel: 0.5, lp: 260 }, o);
  },
});
Object.assign(MIN_GAP, { cheer: 0.7, cheerBig: 1.5, applause: 0.5, ooh: 0.6, aww: 0.8, laugh: 0.9, gasp: 0.5 });
Object.assign(LEVEL, { cheer: 1.5, cheerBig: 1.7, applause: 3.2, ooh: 2.6, aww: 2.6, laugh: 3.6, gasp: 1.6, bossSting: 1.5 });

// 角色碎念：一串音節（音高亂跳的短母音），每個角色有自己的音域、音色和語速。不是真的語音，只給個性。
const VOICES = {
  chad: { f: 104, wave: 'sawtooth', rate: 0.088, vows: 'aou', range: 5, g: 1.6 },                  // 低沉健身哥
  karen: { f: 325, wave: 'sawtooth', rate: 0.066, vows: 'aei', range: 9, g: 1.3 },                 // 尖銳連珠砲
  dale: { f: 148, wave: 'square', rate: 0.105, vows: 'aeo', range: 4, rasp: 0.6, g: 1.2 },         // 沙啞慢吞吞
  doge: { f: 212, wave: 'triangle', rate: 0.074, vows: 'iue', range: 6, g: 1.8 },                  // 悶悶的
  boss: { f: 78, wave: 'sawtooth', rate: 0.115, vows: 'aou', range: 4, rasp: 0.35, g: 1.6 },
  foe: { f: 190, wave: 'square', rate: 0.07, vows: 'eia', range: 7, g: 0.6 },
};
function babble(t, v, n, dest, o = {}) {
  const pm = o.pitch > 0 ? +o.pitch : 1, g = 0.3 * (v.g || 1);
  let tt = t;
  for (let i = 0; i < n; i++) {
    const last = i === n - 1;
    const semi = Math.floor(Math.random() * (v.range + 1)) - v.range * 0.4 + (o.excl ? i * 1.3 : last ? -2.5 : 0);
    const f = v.f * pm * Math.pow(2, semi / 12);
    const d = v.rate * rnd(0.8, 1.25) * (last ? 1.7 : 1);
    vox(tt, f, f * (o.excl ? 1.12 : rnd(0.93, 1.05)), d, g, VOW[pick(v.vows)], dest, 0.008, v.wave);
    if (v.rasp || Math.random() < 0.45) noise(tt, { type: 'highpass', f: 2600, g: 0.035 + (v.rasp || 0) * 0.05, a: 0.001, dur: 0.028 }, dest);
    tt += d * rnd(0.95, 1.12) + (!last && Math.random() < 0.14 ? v.rate * 0.9 : 0);
  }
  return tt - t;
}

// ───────────────────────── 樂器（背景音樂用） ─────────────────────────
// (t, midi, 長度秒, 音量, 輸出)
const INST = {
  pluck(t, m, d, v, o) { // 鄉村吉他撥弦：往上推的 twang
    const f = mtof(m);
    tone(t, { type: 'sawtooth', f: f * 0.95, f1: f, glide: 0.05, g: v, a: 0.003, dur: Math.min(d, 0.7) + 0.12, lp: 3200, fe: 650 }, o);
  },
  banjo(t, m, d, v, o) {
    const f = mtof(m);
    tone(t, { type: 'triangle', f, g: v, dur: 0.22 }, o);
    tone(t, { type: 'square', f: f * 2, g: v * 0.18, dur: 0.12, lp: 3000 }, o);
  },
  ep(t, m, d, v, o) { // 電鋼琴
    const f = mtof(m);
    tone(t, { f, g: v, a: 0.008, dur: Math.min(d + 0.25, 1.4) }, o);
    tone(t, { f: f * 2, g: v * 0.25, a: 0.004, dur: 0.3 }, o);
  },
  piano(t, m, d, v, o) { // 走音酒館鋼琴
    const f = mtof(m), dur = Math.min(d, 0.7) + 0.25;
    tone(t, { type: 'triangle', f, g: v * 0.6, det: -14, dur }, o);
    tone(t, { type: 'triangle', f, g: v * 0.6, det: 14, dur }, o);
    tone(t, { f: f * 2, g: v * 0.2, dur: dur * 0.5 }, o);
  },
  accordion(t, m, d, v, o) {
    const f = mtof(m);
    tone(t, { type: 'square', f, g: v * 0.6, det: -7, a: 0.02, hold: d * 0.85, rel: 0.06, lp: 1700 }, o);
    tone(t, { type: 'square', f, g: v * 0.6, det: 7, a: 0.02, hold: d * 0.85, rel: 0.06, lp: 1700 }, o);
  },
  organ(t, m, d, v, o) {
    const f = mtof(m);
    [[1, 1], [2, 0.5], [3, 0.25], [4, 0.12]].forEach(([h, g]) => tone(t, { f: f * h, g: v * g, a: 0.03, hold: d * 0.95, rel: 0.15 }, o));
  },
  drip(t, m, d, v, o) {
    const f = mtof(m);
    tone(t, { f: f * 2, f1: f, glide: 0.035, g: v, a: 0.002, dur: 0.35 }, o);
  },
  pad(t, m, d, v, o) {
    const f = mtof(m);
    tone(t, { type: 'sawtooth', f, g: v, det: -9, a: 0.25, hold: d, rel: 0.35, lp: 1000 }, o);
    tone(t, { type: 'sawtooth', f, g: v, det: 9, a: 0.25, hold: d, rel: 0.35, lp: 1000 }, o);
  },
  sq(t, m, d, v, o) {
    tone(t, { type: 'square', f: mtof(m), g: v, a: 0.005, hold: d * 0.85, rel: 0.06, lp: 2400 }, o);
  },
  sax(t, m, d, v, o) {
    tone(t, { type: 'sawtooth', f: mtof(m), g: v, a: 0.05, hold: d * 0.9, rel: 0.12, lp: 1300, Q: 2, vib: 0.012, vibRate: 5 }, o);
  },
  brass(t, m, d, v, o) {
    brass(t, [m], d * 0.8, v, o, 0.12);
  },
  gtr(t, m, d, v, o) { // 破音吉他（共用 waveshaper 曲線）
    const f = mtof(m), end = t + d * 0.9 + 0.08;
    const sh = ctx.createWaveShaper(); sh.curve = shaperCurve;
    const fl = filt('lowpass', 2600), gn = ctx.createGain();
    envHold(gn.gain, t, v, 0.005, d * 0.9, 0.08);
    sh.connect(fl); fl.connect(gn); gn.connect(o);
    [0, 6].forEach(det => {
      const osc = ctx.createOscillator(); osc.type = 'sawtooth';
      osc.frequency.value = f; osc.detune.value = det;
      const pre = ctx.createGain(); pre.gain.value = 0.6;
      osc.connect(pre); pre.connect(sh); osc.start(t); osc.stop(end + 0.05);
    });
  },
  bassP(t, m, d, v, o) {
    const f = mtof(m), dur = Math.min(d, 0.55) + 0.06;
    tone(t, { type: 'triangle', f, g: v, dur }, o);
    tone(t, { f, g: v * 0.6, dur }, o);
  },
  tuba(t, m, d, v, o) {
    tone(t, { type: 'sawtooth', f: mtof(m), g: v, a: 0.012, hold: Math.min(d * 0.6, 0.25), rel: 0.08, lp: 420 }, o);
  },
  sub(t, m, d, v, o) {
    const f = mtof(m);
    tone(t, { f, g: v, a: 0.02, hold: d * 0.9, rel: 0.1 }, o);
    tone(t, { type: 'triangle', f: f * 2, g: v * 0.2, a: 0.02, hold: d * 0.9, rel: 0.1, lp: 400 }, o);
  },
  sawbass(t, m, d, v, o) {
    tone(t, { type: 'sawtooth', f: mtof(m), g: v, a: 0.004, dur: Math.min(d, 0.3) + 0.05, lp: 900, fe: 220, Q: 4 }, o);
  },
};
function kick(t, v, o) { tone(t, { f: 150, f1: 45, glide: 0.12, g: v, a: 0.002, dur: 0.3 }, o); }
function snare(t, v, o) {
  noise(t, { type: 'bandpass', f: 1800, Q: 0.7, g: v, dur: 0.15 }, o);
  tone(t, { type: 'triangle', f: 200, f1: 150, g: v * 0.45, dur: 0.08 }, o);
}
function hat(t, v, o) { noise(t, { type: 'highpass', f: 7000, g: v, dur: 0.04 }, o); }

// ───────────────────────── 主題曲譜 ─────────────────────────
// div：每拍幾格（4 = 16 分音符，3 = 12/8 三連音感）。prog：每小節 [低音根音, [和弦音...]]。
// bass/chord/k/s/h：每小節一個 pattern 字串，'.' 表示延續、其他字元是觸發。
// bass 字元：R 根音、3 大三度、m 小三度、4、5、6、7（小七）、O 高八度。
// chord：x 短和弦、X 延音和弦、a 琶音（逐音）。k/s/h：x 正常、o 輕。
// mel：[整段第幾格, midi, 長度格數]。fx：可選的主題特效（每格呼叫）。
const BOFF = { R: 0, '3': 4, m: 3, '4': 5, '5': 7, '6': 9, '7': 10, O: 12 };
const THEMES = {
  menu: {
    bpm: 100, div: 4, ib: 'bassP', ic: 'ep', il: 'pluck', vb: 0.5, vc: 0.09, vl: 0.2,
    prog: [[36, [59, 64, 67]], [33, [60, 64, 67]], [38, [60, 65, 69]], [31, [59, 65, 67]]],
    bass: 'R.....5...R.....', chord: '..x.....x.x.....',
    k: 'x.......x.......', s: '....o.......o...', h: 'o.o.o.o.o.o.o.o.',
    mel: [[0, 72, 2], [2, 74, 2], [4, 76, 4], [10, 79, 2], [12, 76, 4], [16, 72, 8],
      [32, 74, 2], [34, 76, 2], [36, 77, 4], [42, 76, 2], [44, 74, 4], [48, 71, 8]],
  },
  desert: { // 鄉村 twang
    bpm: 112, div: 4, ib: 'bassP', ic: 'pluck', il: 'pluck', vb: 0.55, vc: 0.08, vl: 0.2,
    prog: [[43, [55, 59, 62]], [48, [55, 60, 64]], [50, [54, 57, 62]], [43, [55, 59, 62]]],
    bass: 'R.......5.......', chord: '....x.......x...',
    k: 'x.......x.......', s: '....o.......o...', h: '..o...o...o...o.',
    mel: [[0, 74, 2], [2, 71, 2], [4, 74, 4], [8, 76, 2], [10, 74, 2], [12, 71, 4],
      [16, 72, 2], [18, 71, 2], [20, 69, 4], [24, 67, 8],
      [32, 74, 2], [34, 76, 2], [36, 78, 4], [40, 79, 2], [42, 78, 2], [44, 76, 4],
      [48, 74, 4], [52, 71, 4], [56, 67, 8]],
  },
  swamp: { // 沼澤藍草：班鳩琴琶音 + 手風琴藍調
    bpm: 92, div: 4, ib: 'bassP', ic: 'banjo', il: 'accordion', vb: 0.55, vc: 0.1, vl: 0.13,
    prog: [[40, [64, 68, 71]], [45, [64, 69, 73]], [40, [64, 68, 71]], [47, [63, 66, 71]]],
    bass: 'R...5...R...5...', chord: 'a.a.a.a.a.a.a.a.',
    k: 'x.......x.......', s: '....o.......o...', h: '',
    mel: [[0, 64, 6], [6, 67, 2], [8, 69, 4], [12, 67, 4], [16, 64, 8],
      [32, 71, 4], [36, 69, 4], [40, 67, 4], [44, 64, 4], [48, 62, 4], [52, 64, 12]],
    fx(tr, t, st) { // 青蛙呱呱
      if (st === 30) [0, 0.1].forEach(d => tone(t + d, { type: 'square', f: 170, f1: 120, glide: 0.07, g: 0.12, dur: 0.08, lp: 700 }, tr.g));
    },
  },
  parking: { // 賣場電梯音樂
    bpm: 88, div: 4, ib: 'bassP', ic: 'ep', il: 'ep', vb: 0.45, vc: 0.09, vl: 0.22,
    prog: [[41, [57, 60, 64]], [38, [53, 57, 60]], [43, [53, 58, 62]], [36, [52, 55, 58]]],
    bass: 'R.....5.R.....5.', chord: 'x.......x...x...',
    k: 'o.........o.....', s: '....o.......o...', h: 'o.o.o.o.o.o.o.o.',
    mel: [[0, 72, 6], [6, 69, 2], [8, 72, 8], [16, 74, 6], [22, 72, 2], [24, 70, 8],
      [32, 69, 4], [36, 70, 4], [40, 72, 8], [48, 67, 16]],
  },
  suburb: { // 郊區除草機波卡
    bpm: 132, div: 4, ib: 'tuba', ic: 'accordion', il: 'accordion', vb: 0.5, vc: 0.05, vl: 0.12,
    prog: [[36, [52, 55, 60]], [43, [53, 55, 59]], [43, [53, 55, 59]], [36, [52, 55, 60]]],
    bass: 'R...5...R...5...', chord: '..x...x...x...x.',
    k: 'x...x...x...x...', s: '..o...o...o...o.', h: '',
    mel: [[0, 72, 2], [2, 76, 2], [4, 79, 2], [6, 76, 2], [8, 72, 4], [12, 67, 4],
      [16, 71, 2], [18, 74, 2], [20, 77, 2], [22, 74, 2], [24, 71, 4], [28, 67, 4],
      [32, 74, 2], [34, 77, 2], [36, 79, 2], [38, 77, 2], [40, 74, 4], [44, 71, 4],
      [48, 72, 4], [52, 67, 4], [56, 72, 8]],
    fx(tr, t, st) { // 遠處的除草機嗡嗡聲
      if (st === 0) {
        const L = tr.sd * 32;
        tone(t, { type: 'sawtooth', f: 52, g: 0.06, a: 0.5, hold: L, rel: 0.6, lp: 260 }, tr.g);
        tone(t, { type: 'sawtooth', f: 53.3, g: 0.05, a: 0.5, hold: L, rel: 0.6, lp: 260 }, tr.g);
      }
    },
  },
  temple: { // 管風琴
    bpm: 66, div: 4, ib: 'organ', ic: 'organ', il: 'organ', vb: 0.22, vc: 0.06, vl: 0.12,
    prog: [[38, [62, 65, 69]], [34, [62, 65, 70]], [43, [62, 67, 70]], [45, [61, 64, 69]]],
    bass: 'R...............', chord: 'X...............',
    k: 'x...............', s: '', h: '', vk: 0.35,
    mel: [[0, 74, 4], [4, 77, 4], [8, 76, 4], [12, 74, 4], [16, 77, 8], [24, 74, 8],
      [32, 79, 4], [36, 77, 4], [40, 76, 4], [44, 74, 4], [48, 73, 16]],
    echo: [0.45, 0.3, 0.35],
  },
  sewer: { // 滴水合成器
    bpm: 80, div: 4, ib: 'sub', ic: 'pad', il: 'drip', vb: 0.45, vc: 0.035, vl: 0.22,
    prog: [[33, [57, 60, 64]], [29, [57, 60, 65]], [38, [57, 62, 65]], [40, [56, 59, 64]]],
    bass: 'R.......R...5...', chord: 'X...............',
    k: 'o.........o.....', s: '', h: '......o.......o.',
    mel: [[0, 81, 2], [3, 76, 2], [6, 84, 2], [12, 79, 2], [19, 77, 2], [22, 81, 2], [28, 72, 2],
      [32, 74, 2], [35, 77, 2], [38, 81, 2], [44, 86, 2], [50, 80, 2], [54, 76, 2], [58, 83, 2]],
    echo: [0.375, 0.42, 0.5],
    fx(tr, t, st) { // 隨機水滴
      if (st % 16 === 8 && Math.random() < 0.7) INST.drip(t + rnd(0, tr.sd * 6), pick([88, 91, 93, 96]), 0.2, 0.1, tr.lead);
    },
  },
  bbq: { // 酒館 honky-tonk
    bpm: 140, div: 4, ib: 'bassP', ic: 'piano', il: 'piano', vb: 0.5, vc: 0.08, vl: 0.2,
    prog: [[33, [57, 61, 64]], [38, [57, 62, 66]], [40, [56, 62, 64]], [33, [57, 61, 64]]],
    bass: 'R...5...R...5...', chord: '..x...x...x...x.',
    k: 'x.......x.......', s: '....x.......x...', h: 'o.o.o.o.o.o.o.o.',
    mel: [[0, 76, 2], [2, 78, 2], [4, 81, 4], [8, 78, 2], [10, 76, 2], [12, 73, 4],
      [16, 74, 2], [18, 78, 2], [20, 81, 4], [24, 78, 4], [28, 74, 4],
      [32, 76, 2], [34, 80, 2], [36, 83, 4], [40, 80, 2], [42, 76, 2], [44, 74, 4],
      [48, 73, 2], [50, 76, 2], [52, 81, 8]],
  },
  diner: { // 點唱機 doo-wop（12/8）
    bpm: 76, div: 3, ib: 'bassP', ic: 'ep', il: 'sax', vb: 0.5, vc: 0.045, vl: 0.13,
    prog: [[36, [60, 64, 67]], [33, [60, 64, 69]], [29, [60, 65, 69]], [31, [59, 62, 67]]],
    bass: 'R..5..O..5..', chord: 'xxxxxxxxxxxx',
    k: 'x.....x.....', s: '...x.....x..', h: 'o..o..o..o..',
    mel: [[0, 76, 6], [6, 74, 3], [9, 72, 3], [12, 72, 6], [18, 69, 6],
      [24, 69, 6], [30, 72, 3], [33, 74, 3], [36, 74, 12]],
  },
  rooftop: { // 合成器浪潮
    bpm: 100, div: 4, ib: 'sawbass', ic: 'pad', il: 'sq', vb: 0.4, vc: 0.04, vl: 0.1,
    prog: [[33, [57, 60, 64]], [29, [57, 60, 65]], [36, [55, 60, 64]], [31, [55, 59, 62]]],
    bass: 'R.O.R.O.R.O.R.O.', chord: 'X...............',
    k: 'x...x...x...x...', s: '....x.......x...', h: '..o...o...o...o.',
    mel: [[0, 69, 2], [2, 72, 2], [4, 76, 2], [6, 79, 6], [12, 76, 4],
      [16, 77, 2], [18, 76, 2], [20, 72, 4], [24, 69, 8],
      [32, 72, 2], [34, 76, 2], [36, 79, 2], [38, 84, 6], [44, 79, 4],
      [48, 83, 4], [52, 79, 4], [56, 74, 8]],
    echo: [0.3, 0.32, 0.35],
  },
  stage: { // 體育場搖滾
    bpm: 132, div: 4, ib: 'sawbass', ic: 'gtr', il: 'sq', vb: 0.4, vc: 0.055, vl: 0.1,
    prog: [[28, [40, 47, 52]], [28, [40, 47, 52]], [26, [38, 45, 50]], [33, [45, 52, 57]]],
    bass: 'R.R.R.R.R.R.R.R.', chord: 'x.x.x.x.x.x.x.x.',
    k: 'x.....x.x.......', s: '....x.......x...', h: 'o.o.o.o.o.o.o.o.',
    mel: [[0, 76, 4], [4, 79, 2], [6, 81, 2], [8, 83, 4], [12, 81, 4],
      [16, 79, 2], [18, 81, 2], [20, 79, 2], [22, 76, 10],
      [32, 76, 4], [36, 79, 2], [38, 81, 2], [40, 86, 4], [44, 83, 4], [48, 81, 4], [52, 79, 4], [56, 76, 8]],
    fx(tr, t, st) { // 觀眾歡呼
      if (st === 0) noise(t, { type: 'bandpass', f: 900, Q: 0.5, g: 0.06, a: 0.8, hold: 2.2, rel: 1.2 }, tr.g);
    },
  },
  boss: { // 頭目戰
    bpm: 144, div: 4, ib: 'sawbass', ic: 'brass', il: 'sq', vb: 0.45, vc: 0.04, vl: 0.1,
    prog: [[36, [60, 63, 67]], [36, [60, 63, 67]], [32, [60, 63, 68]], [31, [59, 62, 67]]],
    bass: 'R.RR.RR.R.RR.R7.', chord: 'x.....x.....x...',
    k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'oooooooooooooooo',
    mel: [[0, 72, 3], [3, 75, 3], [6, 79, 4], [10, 78, 2], [12, 79, 4],
      [16, 72, 3], [19, 75, 3], [22, 80, 6], [28, 79, 4],
      [32, 80, 3], [35, 79, 3], [38, 75, 4], [42, 72, 2], [44, 75, 4], [48, 74, 4], [52, 71, 4], [56, 67, 8]],
  },
};

function patLen(p, s) { let n = 1; while (s + n < p.length && p[s + n] === '.') n++; return n; }

// 配樂分層：mood 0–1。0.5 是曲子原本的樣子；往下鼓組變輕、高頻收起來（佈陣、開場），
// 往上疊一層「火熱層」（每格 hi-hat、二四拍拍手、反拍八度低音）並把速度推快一點（殘局、魔王半血、隊友倒地）。
let mood = 0.5;
function applyMood(tr, fast) {
  if (!tr || tr.dead) return;
  const now = ctx.currentTime, tc = fast ? 0.02 : 0.45, k = mood;
  const lo = Math.min(1, k * 2);
  tr.drum.gain.setTargetAtTime(0.2 + 0.8 * lo, now, tc);
  tr.lead.gain.setTargetAtTime(0.5 + 0.5 * lo, now, tc);
  tr.hot.gain.setTargetAtTime(k > 0.5 ? Math.min(1, (k - 0.5) * 2.2) : 0, now, tc);
  tr.lp.frequency.setTargetAtTime(k < 0.5 ? Math.max(600, 240 * Math.pow(75, lo)) : 18000, now, tc);   // 0.3 → 約 3.2 kHz
  tr.mix.gain.setTargetAtTime(0.85 + 0.45 * k, now, tc);
  tr.rate = 1 + 0.06 * Math.max(0, k - 0.6) / 0.4;
}
function clap(t, v, o) {
  noise(t - 0.012, { type: 'bandpass', f: 1500, Q: 1.3, g: v * 0.5, a: 0.001, dur: 0.012 }, o);
  noise(t, { type: 'bandpass', f: 1400, Q: 1.1, g: v, a: 0.001, dur: 0.11 }, o);
}

function startTrack(name) {
  const def = THEMES[name];
  if (!def) return null;
  const now = ctx.currentTime;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(1, now + 0.9);
  const lp = filt('lowpass', 18000, 0.5), mix = ctx.createGain();
  g.connect(lp); lp.connect(mix); mix.connect(musicBus);
  const lead = ctx.createGain(); lead.connect(g);
  const drum = ctx.createGain(); drum.connect(g);
  const hot = ctx.createGain(); hot.gain.value = 0; hot.connect(g);
  if (def.echo) {
    const [dt, fb, wet] = def.echo;
    const dl = ctx.createDelay(1.5), fg = ctx.createGain(), wg = ctx.createGain(), lp = filt('lowpass', 2200);
    dl.delayTime.value = dt; fg.gain.value = fb; wg.gain.value = wet;
    lead.connect(dl); dl.connect(lp); lp.connect(fg); fg.connect(dl); lp.connect(wg); wg.connect(g);
  }
  const mel = new Map();
  def.mel.forEach(([s, m, l]) => mel.set(s, [m, l]));
  const tr = { name, def, g, lead, drum, hot, lp, mix, rate: 1, arp2: 0, mel, step: 0, arp: 0, next: now + 0.1, sd: 60 / def.bpm / def.div, timer: 0, dead: false };
  applyMood(tr, true);
  tr.timer = setInterval(() => tick(tr), 100);
  tick(tr);
  return tr;
}
function stopTrack(tr, fade = 0.9) {
  if (!tr || tr.dead) return;
  tr.dead = true;
  clearInterval(tr.timer);
  try {
    const now = ctx.currentTime;
    tr.g.gain.cancelScheduledValues(now);
    tr.g.gain.setValueAtTime(tr.g.gain.value, now);
    tr.g.gain.linearRampToValueAtTime(0, now + fade);
  } catch (e) { /* ignore */ }
  setTimeout(() => { try { tr.g.disconnect(); tr.lp.disconnect(); tr.mix.disconnect(); } catch (e) { /* ignore */ } }, (fade + 1.5) * 1000);
}
function tick(tr) {
  try {
    if (!ctx || tr.dead || !alive()) return;
    const now = ctx.currentTime;
    if (tr.next < now - 0.2) tr.next = now + 0.05; // 分頁被節流後重新對齊，不補播
    while (tr.next < now + 0.3) {
      schedStep(tr, tr.next);
      tr.next += tr.sd / tr.rate; tr.step++;
    }
  } catch (e) { /* 音樂出錯也不影響遊戲 */ }
}
function schedStep(tr, t) {
  const d = tr.def, spb = d.div * 4, L = spb * d.prog.length;
  const st = tr.step % L, bar = (st / spb) | 0, s = st % spb, sd = tr.sd;
  const [root, chord] = d.prog[bar];
  const bc = d.bass[s];
  if (bc && BOFF[bc] != null) INST[d.ib](t, root + BOFF[bc], patLen(d.bass, s) * sd, d.vb, tr.g);
  const cc = d.chord[s];
  if (cc === 'a') {
    const m = chord[tr.arp++ % chord.length];
    INST[d.ic](t, m, sd * 2, d.vc * 2.2, tr.g);
  } else if (cc === 'x' || cc === 'X') {
    const len = cc === 'X' ? patLen(d.chord, s) * sd : sd * 1.6;
    chord.forEach(m => INST[d.ic](t, m, len, d.vc, tr.g));
  }
  if (d.k && d.k[s] && d.k[s] !== '.') kick(t, (d.vk || 0.55) * (d.k[s] === 'o' ? 0.5 : 1), tr.drum);
  if (d.s && d.s[s] && d.s[s] !== '.') snare(t, 0.22 * (d.s[s] === 'o' ? 0.45 : 1), tr.drum);
  if (d.h && d.h[s] && d.h[s] !== '.') hat(t, 0.07 * (d.h[s] === 'o' ? 0.6 : 1), tr.drum);
  if (mood > 0.5) { // 火熱層（音量由 tr.hot 控制，淡入淡出）
    const beat = s % d.div === 0, bi = (s / d.div) | 0;
    hat(t, beat ? 0.12 : 0.075, tr.hot);
    if (beat && bi % 2 === 1) clap(t, 0.36, tr.hot);
    if (s % d.div === (d.div >> 1)) INST[d.ib](t, root + 12, sd * 0.9, d.vb * 0.8, tr.hot);
    if (!beat) INST.pluck(t, chord[tr.arp2++ % chord.length] + 12, sd, 0.075, tr.hot);   // 反拍的和弦音琶音，把節奏推起來
    if (beat && bi === 0 && bar % 2 === 0) cymbal(t, 0.07, 0.6, tr.hot);
  }
  const n = tr.mel.get(st);
  if (n) INST[d.il](t, n[0], n[1] * sd, d.vl, tr.lead);
  if (d.fx) d.fx(tr, t, st);
}

// ───────────────────────── 對外 API ─────────────────────────
export const SFX = {
  init(external) {
    try {
      if (ctx) {
        if (!offline && ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(() => {});
        return true;
      }
      let c = external;
      if (!c) {
        const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
        if (!AC) return false;
        c = new AC({ latencyHint: 'interactive' });
      }
      const isOff = typeof OfflineAudioContext !== 'undefined' && c instanceof OfflineAudioContext;
      // 共用白噪音（2 秒，循環使用）
      const len = Math.floor(c.sampleRate * 2);
      const nb = c.createBuffer(1, len, c.sampleRate), data = nb.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      // 破音曲線
      const curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 4); }
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -8; comp.knee.value = 4; comp.ratio.value = 12;
      comp.attack.value = 0.003; comp.release.value = 0.15;
      const o = c.createGain(); o.gain.value = mutedFlag ? 0 : POST;
      const sb = c.createGain(); sb.gain.value = 0.9;
      const mb = c.createGain(); mb.gain.value = MUSIC_GAIN;
      sb.connect(comp); mb.connect(comp); comp.connect(o); o.connect(c.destination);
      ctx = c; offline = isOff; out = o; sfxBus = sb; musicBus = mb; noiseBuf = nb; shaperCurve = curve;
      if (!offline && c.state === 'suspended' && c.resume) c.resume().catch(() => {});
      if (pendingTheme && !offline) { const th = pendingTheme; pendingTheme = null; SFX.music(th); }
      return true;
    } catch (e) {
      ctx = null;
      return false;
    }
  },

  play(name, opts = {}) {
    try {
      const fx = FX[name];
      if (!fx || !alive()) return;
      const now = ctx.currentTime;
      const gap = MIN_GAP[name];
      if (gap && lastPlay[name] != null && now - lastPlay[name] < gap) return;
      lastPlay[name] = now;
      const o = opts || {};
      const node = ctx.createGain();
      node.gain.value = (LEVEL[name] || 1) * (o.vol == null ? 1 : Math.max(0, Math.min(2, +o.vol || 0)));
      let dest = sfxBus;
      if (o.pan && ctx.createStereoPanner) {
        const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, +o.pan || 0));
        p.connect(sfxBus); dest = p;
      }
      node.connect(dest);
      PK = o.pitch > 0 ? +o.pitch : 1;
      if (name === 'step' || name === 'hit' || name === 'click') PK *= rnd(0.94, 1.06);
      fx(now + 0.005 + Math.max(0, +o.delay || 0), node);
    } catch (e) {
      /* 音效失敗不影響遊戲 */
    } finally {
      PK = 1;
    }
  },

  music(theme) {
    try {
      const name = theme && THEMES[theme] ? theme : null;
      if (!ctx) { pendingTheme = name; return; }
      if (offline) return;
      if (track && !track.dead && track.name === name) return;
      if (track) { stopTrack(track); track = null; }
      if (name) track = startTrack(name);
    } catch (e) { /* ignore */ }
  },

  // 配樂強度 0–1（見 applyMood）
  intensity(k) {
    try {
      const v = Math.max(0, Math.min(1, +k || 0));
      if (Math.abs(v - mood) < 0.02) return;
      mood = v;
      if (ctx && !offline && track && !track.dead) applyMood(track, false);
    } catch (e) { /* ignore */ }
  },
  // 慢動作、魔王登場時把配樂壓下去 sec 秒
  duck(sec = 1.2, depth = 0.3) {
    try {
      if (!ctx || offline || !musicBus) return;
      const now = ctx.currentTime, g = musicBus.gain;
      g.cancelScheduledValues(now);
      g.setTargetAtTime(MUSIC_GAIN * depth, now, 0.05);
      g.setTargetAtTime(MUSIC_GAIN, now + sec, 0.35);
    } catch (e) { /* ignore */ }
  },
  // 角色碎念 n 個音節。key：英雄 key、'boss' 或任意敵人 key（依 key 換音高）。回傳長度（秒）
  voice(key, n = 5, opts = {}) {
    try {
      if (!alive()) return 0;
      const o = opts || {};
      let v = VOICES[key], pm = o.pitch > 0 ? +o.pitch : 1;
      if (!v) {
        v = o.boss ? VOICES.boss : VOICES.foe;
        let h = 0; for (const ch of String(key || '')) h = (h * 31 + ch.charCodeAt(0)) & 0xffff;
        pm *= 0.72 + (h % 9) / 12;
      }
      const node = ctx.createGain();
      node.gain.value = 1.5 * (o.vol == null ? 1 : Math.max(0, Math.min(2, +o.vol || 0)));
      node.connect(sfxBus);
      return babble(ctx.currentTime + 0.01 + Math.max(0, +o.delay || 0), v, Math.max(1, Math.min(16, n | 0)), node, { pitch: pm, excl: !!o.excl });
    } catch (e) { return 0; }
  },

  setMuted(b) {
    mutedFlag = !!b;
    try {
      if (!ctx || !out) return;
      const now = ctx.currentTime;
      out.gain.cancelScheduledValues(now);
      out.gain.setTargetAtTime(mutedFlag ? 0 : POST, now, 0.03);
    } catch (e) { /* ignore */ }
  },

  get muted() { return mutedFlag; },
};

export default SFX;
