// 音效：全部用 WebAudio 即時合成（不載入音檔）。第一次按「出發」時解鎖 AudioContext；M 鍵靜音。
let ctx = null, out = null, muted = false;
const noiseBuf = () => { const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; };
let NB = null;

export function unlock() {
  try {
    if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); out = ctx.createGain(); out.gain.value = 0.5; out.connect(ctx.destination); NB = noiseBuf(); }
    if (ctx.state === 'suspended') ctx.resume();
  } catch { ctx = null; }
}
export function toggleMute() { muted = !muted; if (out) out.gain.value = muted ? 0 : 0.5; return muted; }

// 小積木：音調（可滑音）＋包絡、帶通雜訊
function tone(type, f0, f1, t0, dur, vol, dest = out) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(t0, dur, vol, type, f0, f1 = f0, q = 1) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = NB; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(out); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
}

const SFX = {
  throw: (t) => noise(t, 0.22, 0.35, 'bandpass', 900, 2600, 1.2),
  mailbox: (t) => { tone('triangle', 1320, 1300, t, 0.5, 0.25); tone('sine', 2110, 2090, t, 0.35, 0.12); noise(t, 0.05, 0.3, 'highpass', 3000); },
  doorstep: (t) => { noise(t, 0.12, 0.5, 'lowpass', 500, 200); tone('sine', 140, 90, t, 0.12, 0.3); },
  window: (t) => { noise(t, 0.5, 0.45, 'highpass', 2500, 5000); for (let k = 0; k < 6; k++) tone('sine', 2500 + Math.random() * 3000, 2400, t + k * 0.03 + Math.random() * 0.03, 0.18, 0.06); },
  bump: (t) => { noise(t, 0.15, 0.6, 'lowpass', 700, 150); tone('sine', 110, 60, t, 0.18, 0.4); },
  bark: (t) => { for (const d of [0, 0.17]) { tone('sawtooth', 520, 300, t + d, 0.11, 0.18); noise(t + d, 0.08, 0.2, 'bandpass', 900, 600, 3); } },
  honk: (t) => { tone('square', 392, 392, t, 0.28, 0.09); tone('square', 494, 494, t, 0.28, 0.08); tone('square', 392, 392, t + 0.34, 0.18, 0.08); tone('square', 494, 494, t + 0.34, 0.18, 0.07); },
  splash: (t) => noise(t, 0.4, 0.35, 'bandpass', 1800, 700, 0.7),
  bundle: (t) => [523, 659, 784].forEach((f, i) => tone('triangle', f, f, t + i * 0.06, 0.16, 0.16)),
  jump: (t) => { tone('triangle', 300, 700, t, 0.25, 0.16); noise(t, 0.12, 0.25, 'lowpass', 600, 300); },
  touchdown: (t) => { noise(t, 0.1, 0.5, 'lowpass', 400, 120); tone('sine', 90, 55, t, 0.12, 0.3); },
  mission: (t) => [784, 988, 1175, 1568].forEach((f, i) => tone('sine', f, f, t + i * 0.08, 0.3, 0.14)),
  fail: (t) => { tone('triangle', 330, 220, t, 0.3, 0.14); tone('triangle', 262, 175, t + 0.12, 0.35, 0.12); },
  bell: (t) => { for (const d of [0, 0.16]) { tone('sine', 2100, 2100, t + d, 0.5, 0.14); tone('sine', 3350, 3350, t + d, 0.3, 0.06); } },
  done: (t) => [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, t + i * 0.1, 0.4, 0.15)),
};

export function play(name) {
  if (!ctx || muted || !SFX[name]) return;
  try { SFX[name](ctx.currentTime + 0.005); } catch { /* 音效失敗不影響遊戲 */ }
}

/** 遊戲事件 → 音效 */
export function onEvent(e) {
  if (e.type === 'land') play(e.hit === 'mailbox' ? 'mailbox' : e.hit === 'window' ? 'window' : e.hit === 'wall' || e.hit === 'yard' || e.hit === 'fence' ? 'doorstep' : null);
  else if (e.type === 'mission') play(e.m.state === 'done' ? 'mission' : 'fail');
  else if (e.type === 'bump') play(e.what === 'dog' ? 'bark' : 'bump');
  else play(e.type);
}
