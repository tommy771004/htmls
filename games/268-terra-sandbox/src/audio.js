// TERRA（268）WebAudio 即時合成：環境（風、雨、城市底噪）、引擎（車、船、飛機）、滑板輪聲與招式音效。
// 第一次使用者操作後才建立 AudioContext。

let ctx = null;
let muted = false;
let amb = null;

function ensureCtx() {
  if (muted) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function unlockAudio() {
  const c = ensureCtx();
  if (c && !amb) amb = buildAmbience(c);
}

export function isMuted() {
  return muted;
}

export function setMuted(v) {
  muted = !!v;
  if (ctx) {
    if (muted) ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  }
  return muted;
}

function noiseBuffer(c, sec = 2) {
  const b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02; // 棕噪
    d[i] = w * 0.5 + last * 3.5;
  }
  return b;
}

function loopNoise(c, buf, type, freq, q) {
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.value = 0;
  src.connect(f).connect(g).connect(c.destination);
  src.start();
  return { f, g };
}

function buildAmbience(c) {
  const buf = noiseBuffer(c);
  const wind = loopNoise(c, buf, 'bandpass', 400, 0.6);
  const rain = loopNoise(c, buf, 'highpass', 2500, 0.3);
  const city = loopNoise(c, buf, 'lowpass', 280, 0.5);
  const roll = loopNoise(c, buf, 'bandpass', 900, 1.2);
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  const osc2 = c.createOscillator();
  osc2.type = 'square';
  const ef = c.createBiquadFilter();
  ef.type = 'lowpass';
  ef.frequency.value = 600;
  const eg = c.createGain();
  eg.gain.value = 0;
  osc.connect(ef);
  osc2.connect(ef);
  ef.connect(eg).connect(c.destination);
  osc.start();
  osc2.start();
  return { wind, rain, city, roll, osc, osc2, ef, eg };
}

// 每幀呼叫（內部節流）
export function updateAmbience(s) {
  if (!amb || !ctx || muted) return;
  const t = ctx.currentTime;
  const set = (p, v) => p.setTargetAtTime(v, t, 0.25);
  const out = s.indoor ? 0.25 : 1;
  set(amb.wind.g.gain, Math.min(0.16, 0.012 + s.wind * 0.0028) * out);
  set(amb.wind.f.frequency, 260 + s.wind * 14 + Math.sin(t * 0.7) * 60);
  set(amb.rain.g.gain, s.rain * 0.09 * out);
  set(amb.city.g.gain, s.city * 0.05 * out);
  set(amb.roll.g.gain, s.roll * 0.07);
  set(amb.roll.f.frequency, s.snow ? 3200 : 700 + s.rollSp * 40);
  const e = s.engine;
  if (e) {
    if (e.kind === 'shuttle') {
      // 火箭：低頻轟鳴（引擎聲壓低、濾波打開，靠風聲的噪音層撐出厚度）
      set(amb.osc.frequency, 28 + e.rpm * 14);
      set(amb.osc2.frequency, 19 + e.rpm * 6);
      set(amb.ef.frequency, 160 + e.rpm * 520);
      set(amb.eg.gain, e.rpm * 0.12);
      set(amb.wind.g.gain, Math.min(0.2, e.rpm * 0.2) * out);
      set(amb.wind.f.frequency, 180 + e.rpm * 260);
      return;
    }
    const base = e.kind === 'plane' ? 70 : e.kind === 'boat' ? 48 : 38;
    set(amb.osc.frequency, base + e.rpm * (e.kind === 'plane' ? 90 : 110));
    set(amb.osc2.frequency, (base + e.rpm * 100) * 0.5);
    set(amb.ef.frequency, 300 + e.rpm * 900);
    set(amb.eg.gain, 0.035 + e.rpm * 0.03);
  } else set(amb.eg.gain, 0);
}

function tone(c, type, f0, f1, dur, vol, delay = 0) {
  const now = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, now);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + dur);
  g.gain.setValueAtTime(vol, now);
  g.gain.exponentialRampToValueAtTime(0.0008, now + dur);
  o.connect(g).connect(c.destination);
  o.start(now);
  o.stop(now + dur + 0.02);
}

function burst(c, dur, vol, freq, type = 'bandpass', delay = 0) {
  const now = c.currentTime + delay;
  const b = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const s = c.createBufferSource();
  s.buffer = b;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = vol;
  s.connect(f).connect(g).connect(c.destination);
  s.start(now);
}

export function playSfx(kind = 'click') {
  const c = ensureCtx();
  if (!c) return;
  switch (kind) {
    case 'click':
      tone(c, 'triangle', 680, 420, 0.08, 0.05);
      break;
    case 'mode':
      tone(c, 'triangle', 520, 880, 0.1, 0.05);
      break;
    case 'trick':
      [523.25, 659.25, 783.99].forEach((f, i) => tone(c, 'sine', f, f, 0.14, 0.05, i * 0.045));
      break;
    case 'pop':
      burst(c, 0.07, 0.5, 1800);
      tone(c, 'square', 220, 90, 0.06, 0.04);
      break;
    case 'land':
      burst(c, 0.12, 0.6, 500, 'lowpass');
      break;
    case 'grind':
      burst(c, 0.25, 0.25, 3200);
      break;
    case 'bump':
      burst(c, 0.18, 0.7, 300, 'lowpass');
      break;
    case 'crash':
      burst(c, 0.6, 0.9, 400, 'lowpass');
      burst(c, 0.3, 0.4, 2400, 'bandpass', 0.05);
      break;
    case 'shutter':
      burst(c, 0.04, 0.5, 4000);
      burst(c, 0.05, 0.4, 2500, 'bandpass', 0.09);
      break;
    case 'thunder':
      burst(c, 2.2, 1.0, 140, 'lowpass', 0.4 + Math.random() * 1.2);
      break;
    case 'door':
      tone(c, 'sine', 880, 660, 0.18, 0.04);
      tone(c, 'sine', 660, 660, 0.25, 0.03, 0.12);
      break;
    default:
      tone(c, 'triangle', 600, 500, 0.08, 0.04);
  }
}
