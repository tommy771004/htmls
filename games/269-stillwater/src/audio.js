// 音效：全部用 WebAudio 即時合成。環境音（水流、急流、瀑布轟鳴、早上的鳥、下午的風、黃昏的蟲鳴）
// 依船的位置與時段混音；動作音（划槳入水、拋竿、浮標、咬鉤、收線棘輪、張力吱嘎、斷線、魚簍、燈樁鈴聲）。
let ctx = null, master = null, muted = false;
let noiseBuf = null;
const amb = {};

function noise() {
  if (noiseBuf) return noiseBuf;
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let b = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.6 + b * 2.2; }
  return noiseBuf;
}
function loopNoise(type, freq, q, gain) {
  const src = ctx.createBufferSource(); src.buffer = noise(); src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.value = gain;
  src.connect(f).connect(g).connect(master);
  src.start();
  return { src, f, g };
}
function burst({ type = 'bandpass', freq = 1200, q = 1, dur = 0.2, gain = 0.3, sweep = 0, at = 0 }) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource(); src.buffer = noise();
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
  f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
}
function tone({ freq = 440, to = 0, dur = 0.3, gain = 0.2, type = 'sine', at = 0, attack = 0.01 }) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
}

export const audio = {
  get muted() { return muted; },
  unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);
    amb.water = loopNoise('lowpass', 520, 0.5, 0.05);
    amb.rapids = loopNoise('bandpass', 900, 0.6, 0);
    amb.falls = loopNoise('lowpass', 300, 0.4, 0);
    amb.wind = loopNoise('bandpass', 420, 0.8, 0);
    amb.birdT = 0; amb.cricketT = 0;
  },
  setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05); },
  suspend(on) { if (ctx) on ? ctx.suspend() : ctx.resume(); },
  // 每幀：rapids 0～1、falls 0～1、時段權重 [am, pm, dusk]
  ambient(dt, { rapids, falls, w, speed }) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    amb.water.g.gain.setTargetAtTime(0.04 + speed * 0.02, now, 0.3);
    amb.rapids.g.gain.setTargetAtTime(rapids * 0.16, now, 0.4);
    amb.falls.g.gain.setTargetAtTime(falls * 0.32, now, 0.5);
    amb.wind.g.gain.setTargetAtTime(w[1] * 0.025 + 0.008, now, 1);
    amb.wind.f.frequency.setTargetAtTime(380 + Math.sin(now * 0.3) * 120, now, 1);
    // 早上：鳥鳴（快速上滑的短音串）
    amb.birdT -= dt;
    if (amb.birdT <= 0) {
      amb.birdT = 1.5 + Math.random() * 4;
      if (Math.random() < w[0] * 0.9 + w[1] * 0.3) {
        const base = 2200 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) tone({ freq: base * (1 + Math.random() * 0.2), to: base * (1.25 + Math.random() * 0.3), dur: 0.07 + Math.random() * 0.05, gain: 0.025, type: 'sine', at: i * 0.11 });
      }
    }
    // 黃昏：蟲鳴（高頻顫音）
    amb.cricketT -= dt;
    if (amb.cricketT <= 0) {
      amb.cricketT = 0.5 + Math.random() * 0.9;
      if (Math.random() < w[2]) for (let i = 0; i < 3; i++) tone({ freq: 4300 + Math.random() * 200, dur: 0.035, gain: 0.012, type: 'triangle', at: i * 0.06 });
    }
  },
  stroke(power = 1) { burst({ type: 'bandpass', freq: 700, q: 0.9, dur: 0.32, gain: 0.12 * power, sweep: 0.5 }); burst({ type: 'lowpass', freq: 320, q: 0.7, dur: 0.25, gain: 0.08 * power, at: 0.05 }); },
  bump() { tone({ freq: 120, to: 70, dur: 0.25, gain: 0.25, type: 'triangle' }); burst({ freq: 400, dur: 0.15, gain: 0.1 }); },
  whoosh() { burst({ type: 'bandpass', freq: 1600, q: 1.4, dur: 0.45, gain: 0.12, sweep: 0.35 }); },
  plop(v = 1) { tone({ freq: 520, to: 180, dur: 0.12, gain: 0.18 * v }); burst({ freq: 1800, q: 1, dur: 0.12, gain: 0.07 * v }); },
  nibble(v = 1) { tone({ freq: 880, to: 560, dur: 0.06, gain: 0.08 * v }); },
  bite() { tone({ freq: 360, to: 110, dur: 0.22, gain: 0.25 }); burst({ freq: 1400, q: 0.8, dur: 0.35, gain: 0.18, sweep: 0.4 }); },
  hook() { burst({ type: 'highpass', freq: 2500, q: 0.6, dur: 0.12, gain: 0.12 }); tone({ freq: 300, to: 600, dur: 0.12, gain: 0.08, type: 'triangle' }); },
  perfect() { [784, 988, 1319].forEach((f, i) => tone({ freq: f, dur: 0.5, gain: 0.08, type: 'triangle', at: i * 0.06 })); burst({ freq: 3000, q: 2, dur: 0.4, gain: 0.05 }); },
  splash(v = 1) { burst({ freq: 900, q: 0.7, dur: 0.4, gain: 0.16 * v, sweep: 0.4 }); },
  creak() { tone({ freq: 190, to: 230, dur: 0.18, gain: 0.05, type: 'sawtooth' }); },
  snap() { tone({ freq: 1600, to: 300, dur: 0.12, gain: 0.2, type: 'square' }); burst({ type: 'highpass', freq: 3000, dur: 0.1, gain: 0.2 }); },
  landed() { burst({ freq: 700, q: 0.8, dur: 0.5, gain: 0.2, sweep: 0.5 }); [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.6, gain: 0.07, type: 'triangle', at: 0.15 + i * 0.08 })); },
  creel() { burst({ type: 'bandpass', freq: 2400, q: 3, dur: 0.08, gain: 0.07 }); burst({ type: 'bandpass', freq: 1900, q: 3, dur: 0.08, gain: 0.06, at: 0.1 }); },
  chime() { [659, 988, 1319].forEach((f, i) => tone({ freq: f, dur: 1.6, gain: 0.06, type: 'sine', at: i * 0.12, attack: 0.005 })); },
  ui() { tone({ freq: 660, dur: 0.05, gain: 0.04, type: 'triangle' }); },
  reward() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, dur: 0.9, gain: 0.06, type: 'triangle', at: i * 0.09 })); },
  // 收線的棘輪聲：按住時依張力加快
  reel(on, tension) {
    if (!ctx) return;
    amb.reelT = (amb.reelT || 0) - 1 / 60;
    if (on && amb.reelT <= 0) { amb.reelT = 0.06 - tension * 0.00025; burst({ type: 'bandpass', freq: 3200 + tension * 10, q: 4, dur: 0.025, gain: 0.05 }); }
  },
};
