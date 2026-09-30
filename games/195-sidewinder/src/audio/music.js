// 預設背景音樂：合成的沙漠搖滾循環（貝斯 + 撥弦主奏 + 鼓機），可被 AudioBuffer 取代。
// 以前瞻排程（約 0.2 秒）送出音符；切換曲目時交叉淡入淡出。
import { noiseBuffer } from './synth.js';

const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const midi = (n) => {
  const m = /^([A-G]#?)(-?\d)$/.exec(n);
  return m ? NOTE[m[1]] + 12 * (+m[2] + 1) : null;
};
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const seq = (s) => s.trim().split(/\s+/).map((t) => (t === '.' ? null : midi(t)));
const hits = (s) => s.replace(/\s+/g, '').split('').map((c) => (c === 'x' ? 1 : c === 'o' ? 0.55 : c === 'O' ? 2 : 0));

// 每首 4 小節、64 個十六分音符
export const SONGS = {
  // 比賽：132 BPM，E 小調五聲的低音弦撥弦 riff（twang）
  race: {
    bpm: 132, swing: 0,
    bass: seq(`
      E2 . E2 . . . E2 . G2 . . A2 . . G2 .   E2 . E2 . . . E2 . D2 . . D2 . E2 . .
      A1 . A1 . . . A1 . C2 . . D2 . . C2 .   B1 . B1 . . . B1 . D2 . . D#2 . E2 . .`),
    lead: seq(`
      E3 . . G3 . A3 . . B3 . A3 . G3 . E3 .   . . D3 . E3 . . . G3 . E3 . D3 . B2 .
      A3 . . C4 . D4 . . E4 . D4 . C4 . A3 .   B3 . . . A3 . B3 . D#4 . . . E4 . . .`),
    kick: hits('x.....x.x.....x. x.....x.x...x... x.....x.x.....x. x.....x.x.x.x.x.'),
    snare: hits('....x.......x... ....x.......x... ....x.......x... ....x.......x.oo'),
    hat: hits('x.x.x.x.x.x.x.O. x.x.x.x.x.x.x.O. x.x.x.x.x.x.x.O. x.x.x.x.x.x.x.x.'),
    leadVol: 0.2, bassVol: 0.32,
  },
  // 標題：120 BPM，空曠一點的慢板 + 彈簧殘響
  title: {
    bpm: 120, swing: 0,
    bass: seq(`
      E2 . . . . . . . E2 . . . B1 . . .   C2 . . . . . . . C2 . . . D2 . . .
      E2 . . . . . . . E2 . . . G2 . . .   A1 . . . . . . . B1 . . . B1 . . .`),
    lead: seq(`
      B3 . . . . . E4 . . . D4 . B3 . . .   G3 . . . . . . . A3 . . . B3 . . .
      B3 . . . . . E4 . . . G4 . F#4 . . .   E4 . . . D4 . . . B3 . . . . . . .`),
    kick: hits('x.........x..... x.........x..... x.........x..... x.........x.x...'),
    snare: hits('....o.......x... ....o.......x... ....o.......x... ....o.......x.xx'),
    hat: hits('x.o.x.o.x.o.x.o. x.o.x.o.x.o.x.o. x.o.x.o.x.o.x.o. x.o.x.o.x.o.x.o.'),
    leadVol: 0.18, bassVol: 0.3,
  },
  // 車庫：120 BPM 搖擺感，走路貝斯
  garage: {
    bpm: 120, swing: 0.28,
    bass: seq(`
      E2 . . . G#2 . . . B2 . . . C#3 . . .   B2 . . . G#2 . . . E2 . . . B1 . . .
      A1 . . . C#2 . . . E2 . . . F#2 . . .   B1 . . . D#2 . . . F#2 . . . B1 . . .`),
    lead: seq(`
      . . . . . . B3 . . . . . G#3 . E3 .   . . . . . . . . . . . . . . . .
      . . . . . . C#4 . . . . . A3 . E3 .   . . . . F#3 . . . A3 . . . B3 . . .`),
    kick: hits('x.......x....... x.......x....... x.......x....... x.......x.......'),
    snare: hits('....o.......o... ....o.......o... ....o.......o... ....o.......o.o.'),
    hat: hits('x.x.x.x.x.x.x.x. x.x.x.x.x.x.x.x. x.x.x.x.x.x.x.x. x.x.x.x.x.x.x.x.'),
    leadVol: 0.16, bassVol: 0.3,
  },
};

function kick(ctx, dest, t, v) {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(130, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.55 * v, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + 0.32);
}

function snare(ctx, dest, t, v) {
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.28 * v, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  n.connect(bp).connect(g).connect(dest);
  n.start(t, Math.random()); n.stop(t + 0.18);
  const o = ctx.createOscillator(); o.type = 'triangle';
  o.frequency.setValueAtTime(210, t);
  o.frequency.exponentialRampToValueAtTime(150, t + 0.06);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.16 * v, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  o.connect(og).connect(dest);
  o.start(t); o.stop(t + 0.1);
}

function hat(ctx, dest, t, v) {
  const open = v > 1.5;
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx);
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
  const g = ctx.createGain();
  const d = open ? 0.22 : 0.035;
  g.gain.setValueAtTime(0.09 * Math.min(1, v), t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  n.connect(hp).connect(g).connect(dest);
  n.start(t, Math.random()); n.stop(t + d + 0.02);
}

// 貝斯：鋸齒 + 低通撥弦包絡
function bass(ctx, dest, t, m, dur, vol) {
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.value = hz(m);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
  lp.frequency.setValueAtTime(900, t);
  lp.frequency.exponentialRampToValueAtTime(180, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp).connect(g).connect(dest);
  o.start(t); o.stop(t + dur + 0.02);
}

// 主奏：低音弦 twang = 撥弦時音高先高一點再落回，濾波快速關閉
function lead(ctx, dest, t, m, dur, vol) {
  const f = hz(m);
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(f * 1.03, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
  const o2 = ctx.createOscillator(); o2.type = 'square';
  o2.frequency.value = f * 1.004;
  const o2g = ctx.createGain(); o2g.gain.value = 0.3;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 5;
  lp.frequency.setValueAtTime(3400, t);
  lp.frequency.exponentialRampToValueAtTime(500, t + dur * 0.8);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp); o2.connect(o2g).connect(lp);
  lp.connect(g).connect(dest);
  o.start(t); o.stop(t + dur + 0.02);
  o2.start(t); o2.stop(t + dur + 0.02);
}

export function createMusic(ctx, dest) {
  // 主奏送進短回授延遲（slapback），做出沙漠吉他的彈簧味
  const slots = new Map(); // slot → { gain, kind:'synth'|'buffer', src, step, next, song }
  let active = null;

  function makeSlot(name) {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(dest);
    const dly = ctx.createDelay(1);
    dly.delayTime.value = 0.118;
    const fb = ctx.createGain(); fb.gain.value = 0.28;
    const wet = ctx.createGain(); wet.gain.value = 0.3;
    dly.connect(fb).connect(dly);
    dly.connect(wet).connect(g);
    const s = { name, gain: g, delay: dly, kind: null, src: null, step: 0, next: 0, song: null };
    slots.set(name, s);
    return s;
  }

  function stopSlot(s, fade = 0.5) {
    const t = ctx.currentTime;
    s.gain.gain.cancelScheduledValues(t);
    s.gain.gain.setTargetAtTime(0, t, fade / 3);
    if (s.src) { try { s.src.stop(t + fade + 0.1); } catch { /* 忽略 */ } s.src = null; }
    s.kind = null;
  }

  // source：'synth'（預設合成）、AudioBuffer、null（靜音）
  function play(name, source) {
    if (active && active.name !== name) stopSlot(active);
    let s = slots.get(name) || makeSlot(name);
    if (active === s) stopSlot(s, 0.25);
    active = s;
    if (source == null) return;
    const t = ctx.currentTime;
    s.gain.gain.cancelScheduledValues(t);
    s.gain.gain.setValueAtTime(s.gain.gain.value, t);
    s.gain.gain.setTargetAtTime(1, t + 0.05, 0.15);
    if (source === 'synth') {
      s.kind = 'synth';
      s.song = SONGS[name] || SONGS.race;
      s.step = 0;
      s.next = t + 0.08;
    } else {
      s.kind = 'buffer';
      const b = ctx.createBufferSource();
      b.buffer = source;
      b.loop = true;
      b.connect(s.gain);
      b.start(t + 0.05);
      s.src = b;
    }
  }

  function tick() {
    const s = active;
    if (!s || s.kind !== 'synth') return;
    const song = s.song;
    const stepDur = 60 / song.bpm / 4;
    const horizon = ctx.currentTime + 0.2;
    // 分頁在背景太久：跳過補不回來的音符
    if (s.next < ctx.currentTime - 0.1) s.next = ctx.currentTime + 0.02;
    while (s.next < horizon) {
      const i = s.step % 64;
      const t = s.next + (i % 2 === 1 ? song.swing * stepDur : 0);
      if (song.kick[i]) kick(ctx, s.gain, t, song.kick[i]);
      if (song.snare[i]) snare(ctx, s.gain, t, song.snare[i]);
      if (song.hat[i]) hat(ctx, s.gain, t, song.hat[i]);
      const bm = song.bass[i];
      if (bm != null) bass(ctx, s.gain, t, bm, stepDur * 1.8, song.bassVol);
      const lm = song.lead[i];
      if (lm != null) {
        const g = ctx.createGain(); g.gain.value = 1;
        g.connect(s.gain); g.connect(s.delay);
        lead(ctx, g, t, lm, stepDur * 2.6, song.leadVol);
      }
      s.step++;
      s.next += stepDur;
    }
  }

  return {
    play,
    tick,
    stop() { if (active) stopSlot(active); active = null; },
    current: () => (active ? active.name : null),
  };
}
