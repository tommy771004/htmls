// WebAudio 即時合成音效：沒有任何取樣檔。
// audio.init() 可在使用者手勢之前呼叫（只建立 context）；第一次 pointerdown/keydown 時呼叫 audio.resume()。
// play(name, {vol, pan, pitch, dist, dur}) 回傳 null，或（'beam'、'beamCharge'、'recall'）回傳 { stop() }。
// 任何情況（沒有 AudioContext、尚未 resume）都不會丟例外。

const NAMES = ['hitL', 'hitM', 'hitH', 'blast', 'beamCharge', 'beam', 'dash', 'vanish', 'explode', 'freeze', 'thunder', 'slam',
  'tower', 'towerHit', 'towerDown', 'minionDie', 'heroDie', 'levelUp', 'ki', 'kiFull', 'spark', 'recall', 'respawn', 'select',
  'victory', 'defeat', 'ui'];

const E = 0.0001;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// 建立一套合成器，掛在任何 BaseAudioContext 上（即時或 OfflineAudioContext 都可）
export function createSynth(ctx, destination) {
  const noiseBuf = (() => {
    const len = Math.floor(ctx.sampleRate * 2), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let s = 12345;
    for (let i = 0; i < len; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x3fffffff) - 1; }
    return b;
  })();
  const curves = {};
  const curve = (k) => {
    if (curves[k]) return curves[k];
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
    return (curves[k] = c);
  };

  // 主幹：sfx / music → master → 壓縮 → 限幅 → 輸出
  const master = ctx.createGain(); master.gain.value = 0.8;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.18;
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
  const post = ctx.createGain(); post.gain.value = 0.9;
  master.connect(comp); comp.connect(lim); lim.connect(post); post.connect(destination);
  const sfx = ctx.createGain(); sfx.gain.value = 1; sfx.connect(master);
  const mus = ctx.createGain(); mus.gain.value = 0.22; mus.connect(master);

  // ---------- 基本元件 ----------
  const gain = (out, v = 1) => { const g = ctx.createGain(); g.gain.value = v; g.connect(out); return g; };
  // 包絡：t 起點、a 起音、peak 峰值、d 衰減長度（指數衰減到靜音）
  const env = (g, t, a, peak, d) => {
    const p = g.gain; p.setValueAtTime(E, t); p.linearRampToValueAtTime(peak, t + a); p.exponentialRampToValueAtTime(E, t + a + d);
    return t + a + d;
  };
  const osc = (type, f0, out, t, end, f1, glide) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + (glide || end - t));
    o.connect(out); o.start(t); o.stop(end + 0.05); return o;
  };
  const noise = (out, t, end, rate = 1) => {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = rate;
    s.connect(out); s.start(t, Math.random() * 1.5); s.stop(end + 0.05); return s;
  };
  const filt = (type, f, out, q = 0.8) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.connect(out); return b; };
  const shaper = (out, k) => { const w = ctx.createWaveShaper(); w.curve = curve(k); w.oversample = '2x'; w.connect(out); return w; };

  // 單一聲部：衰減到底的音（tone）與噪音（burst）
  const tone = (out, t, type, f0, f1, glide, a, peak, d) => { const g = gain(out, 0); const end = env(g, t, a, peak, d); osc(type, f0, g, t, end, f1, glide); return end; };
  const burst = (out, t, ftype, f, q, a, peak, d, f1, rate) => {
    const g = gain(out, 0); const end = env(g, t, a, peak, d); const b = filt(ftype, f, g, q);
    if (f1) b.frequency.exponentialRampToValueAtTime(f1, end); noise(b, t, end, rate); return end;
  };

  // 可停止的持續音：回傳 { stop }，stop 時 0.15 秒淡出
  const holdable = (g, nodes, endAt) => {
    let done = false;
    return {
      stop() {
        if (done) return; done = true;
        try {
          const t = ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(E, g.gain.value), t);
          g.gain.exponentialRampToValueAtTime(E, t + 0.15);
          for (const n of nodes) { try { n.stop(t + 0.2); } catch (e) { /* 已停止 */ } }
        } catch (e) { /* context 已關閉 */ }
      },
      get ended() { return done || ctx.currentTime > endAt; },
    };
  };

  // ---------- 音色 ----------
  // 每個函式 (out, t, p, o) → { end, handle? }；p 為音高倍率
  const S = {
    hitL(out, t, p) {
      const e1 = tone(out, t, 'sine', 190 * p, 62 * p, 0.07, 0.002, 1.1, 0.09);
      const e2 = burst(out, t, 'bandpass', 2600 * p, 1.2, 0.001, 0.85, 0.045);
      tone(out, t, 'square', 1200 * p, 500 * p, 0.02, 0.001, 0.08, 0.02);
      return { end: Math.max(e1, e2) };
    },
    hitM(out, t, p) {
      const d = shaper(gain(out, 0.8), 3);
      const e1 = tone(d, t, 'sine', 150 * p, 46 * p, 0.12, 0.002, 0.85, 0.15);
      const e2 = burst(out, t, 'bandpass', 1700 * p, 1, 0.001, 0.65, 0.08, 700);
      burst(out, t, 'highpass', 4500, 0.7, 0.001, 0.3, 0.025);
      return { end: Math.max(e1, e2) };
    },
    hitH(out, t, p) {
      const d = shaper(gain(out, 0.75), 8);
      const e1 = tone(d, t, 'sine', 120 * p, 30 * p, 0.25, 0.003, 1, 0.3);
      tone(d, t, 'triangle', 240 * p, 60 * p, 0.12, 0.002, 0.35, 0.12);
      const e2 = burst(out, t, 'lowpass', 3500, 0.7, 0.002, 0.8, 0.18, 400);
      burst(out, t, 'highpass', 3800, 0.8, 0.001, 0.45, 0.035);
      return { end: Math.max(e1, e2) };
    },
    blast(out, t, p) {
      burst(out, t, 'bandpass', 450 * p, 2.2, 0.06, 0.45, 0.14, 2600 * p);
      const e1 = tone(out, t + 0.12, 'sine', 320 * p, 80 * p, 0.12, 0.002, 0.65, 0.14);
      const e2 = burst(out, t + 0.12, 'lowpass', 2200, 0.7, 0.002, 0.5, 0.12, 300);
      return { end: Math.max(e1, e2) };
    },
    beamCharge(out, t, p, o) {
      const dur = o.dur || 0.55, end = t + dur;
      const g = gain(out, 0); g.gain.setValueAtTime(E, t); g.gain.linearRampToValueAtTime(0.42, end); g.gain.exponentialRampToValueAtTime(E, end + 0.12);
      const trem = gain(g, 0.6); const lfo = ctx.createOscillator(); lfo.frequency.setValueAtTime(10, t); lfo.frequency.linearRampToValueAtTime(26, end);
      const lfoG = ctx.createGain(); lfoG.gain.value = 0.4; lfo.connect(lfoG); lfoG.connect(trem.gain); lfo.start(t); lfo.stop(end + 0.2);
      const lp = filt('lowpass', 300, trem, 6); lp.frequency.exponentialRampToValueAtTime(3500, end);
      const a = osc('sawtooth', 110 * p, lp, t, end + 0.12, 440 * p, dur);
      const b = osc('sawtooth', 111.5 * p, lp, t, end + 0.12, 446 * p, dur);
      const n = noise(filt('bandpass', 2000, gain(g, 0.25), 1.5), t, end + 0.12);
      return { end: end + 0.15, handle: holdable(g, [a, b, n, lfo], end + 0.12) };
    },
    beam(out, t, p, o) {
      const dur = o.dur || 1.2, end = t + dur;
      const g = gain(out, 0); g.gain.setValueAtTime(E, t); g.gain.linearRampToValueAtTime(0.75, t + 0.05);
      g.gain.setValueAtTime(0.75, Math.max(t + 0.05, end - 0.25)); g.gain.exponentialRampToValueAtTime(E, end);
      const lp = filt('lowpass', 1300, g, 2.5);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 6.5; const lg = ctx.createGain(); lg.gain.value = 500;
      lfo.connect(lg); lg.connect(lp.frequency); lfo.start(t); lfo.stop(end + 0.05);
      const nodes = [lfo, noise(lp, t, end, 0.9)];
      const sl = filt('lowpass', 900, shaper(gain(g, 0.3), 4), 1);
      for (const det of [0.99, 1, 1.013]) nodes.push(osc('sawtooth', 78 * p * det, sl, t, end));
      nodes.push(osc('sine', 40 * p, gain(g, 0.6), t, end));
      return { end: end + 0.05, handle: holdable(g, nodes, end) };
    },
    dash(out, t, p) {
      const g = gain(out, 0); const end = env(g, t, 0.05, 0.55, 0.22);
      const b = filt('bandpass', 600 * p, g, 2.2);
      b.frequency.exponentialRampToValueAtTime(3200 * p, t + 0.1); b.frequency.exponentialRampToValueAtTime(700 * p, end);
      noise(b, t, end);
      return { end };
    },
    vanish(out, t, p) {
      tone(out, t, 'sine', 800 * p, 3400 * p, 0.07, 0.003, 0.35, 0.06);
      burst(out, t, 'highpass', 6000, 0.7, 0.001, 0.4, 0.008);
      const e = tone(out, t + 0.08, 'sine', 2400 * p, 900 * p, 0.05, 0.002, 0.2, 0.06);
      return { end: e };
    },
    explode(out, t, p) {
      const d = shaper(gain(out, 0.8), 6);
      const e1 = tone(d, t, 'sine', 95 * p, 28 * p, 0.4, 0.004, 1, 0.45);
      const e2 = burst(out, t, 'lowpass', 2600, 0.6, 0.005, 0.85, 0.7, 260);
      burst(out, t + 0.03, 'bandpass', 900, 1, 0.01, 0.35, 0.4, 200);
      return { end: Math.max(e1, e2) };
    },
    freeze(out, t, p) {
      let end = t;
      for (const [r, a, d] of [[1, 0.28, 0.9], [2.76, 0.18, 0.6], [5.4, 0.12, 0.4], [8.93, 0.06, 0.25]]) {
        const g = gain(out, 0); const e = env(g, t, 0.003, a, d);
        const car = osc('sine', 1500 * p * r, g, t, e);
        const mod = ctx.createOscillator(); mod.frequency.value = 1500 * p * r * 1.41; const mg = ctx.createGain();
        mg.gain.setValueAtTime(900 * r, t); mg.gain.exponentialRampToValueAtTime(10, e);
        mod.connect(mg); mg.connect(car.frequency); mod.start(t); mod.stop(e + 0.05);
        end = Math.max(end, e);
      }
      const sg = gain(out, 0); const e2 = env(sg, t + 0.02, 0.05, 0.22, 0.6);
      const trem = ctx.createOscillator(); trem.frequency.value = 22; const tg = ctx.createGain(); tg.gain.value = 0.12;
      trem.connect(tg); tg.connect(sg.gain); trem.start(t); trem.stop(e2 + 0.05);
      noise(filt('highpass', 6500, sg, 0.7), t, e2, 1.3);
      return { end: Math.max(end, e2) };
    },
    thunder(out, t, p) {
      let end = t;
      for (let i = 0; i < 6; i++) {
        const tt = t + Math.random() * 0.16;
        end = Math.max(end, burst(out, tt, 'highpass', 2500 + Math.random() * 3000, 0.8, 0.001, 0.55 - i * 0.05, 0.03 + Math.random() * 0.04));
      }
      tone(shaper(gain(out, 0.6), 10), t, 'square', 60 * p, 40 * p, 0.2, 0.001, 0.25, 0.15);
      end = Math.max(end, burst(out, t + 0.05, 'lowpass', 260, 0.8, 0.08, 0.9, 1.1, 90, 0.6));
      return { end };
    },
    slam(out, t, p) {
      const d = shaper(gain(out, 0.85), 5);
      const e1 = tone(d, t, 'sine', 75 * p, 24 * p, 0.45, 0.003, 1, 0.55);
      let end = e1;
      for (let i = 0; i < 5; i++) end = Math.max(end, burst(out, t + 0.04 + i * 0.07 + Math.random() * 0.03, 'bandpass', 700 + Math.random() * 900, 1.2, 0.003, 0.42 - i * 0.06, 0.09));
      burst(out, t, 'lowpass', 1800, 0.6, 0.003, 0.6, 0.25, 200);
      return { end };
    },
    tower(out, t, p) {
      const b = filt('bandpass', 1400 * p, gain(out, 1), 3);
      tone(b, t, 'square', 1500 * p, 220 * p, 0.18, 0.002, 0.5, 0.2);
      const e = tone(out, t, 'sine', 600 * p, 1300 * p, 0.12, 0.002, 0.3, 0.16);
      return { end: e };
    },
    towerHit(out, t, p) {
      tone(out, t, 'square', 420 * p, null, 0, 0.001, 0.18, 0.16);
      tone(out, t, 'square', 1130 * p, null, 0, 0.001, 0.1, 0.12);
      const e = burst(out, t, 'bandpass', 3000, 1.5, 0.001, 0.4, 0.06);
      return { end: Math.max(e, t + 0.2) };
    },
    towerDown(out, t, p) {
      const d = shaper(gain(out, 0.85), 6);
      tone(d, t, 'sine', 70 * p, 22 * p, 0.8, 0.005, 1, 0.9);
      let end = t + 1;
      for (let i = 0; i < 14; i++) end = Math.max(end, burst(out, t + i * 0.1 + Math.random() * 0.06, 'lowpass', 600 + Math.random() * 1600, 0.7, 0.01, 0.5 * (1 - i / 16), 0.18 + Math.random() * 0.15, 150));
      burst(out, t, 'lowpass', 400, 0.7, 0.05, 0.6, 1.6, 80, 0.5);
      return { end: Math.max(end, t + 1.7) };
    },
    minionDie(out, t, p) {
      const e1 = burst(out, t, 'bandpass', 900 * p, 1.2, 0.004, 0.35, 0.18, 280);
      const e2 = tone(out, t, 'sine', 420 * p, 140 * p, 0.15, 0.002, 0.2, 0.15);
      return { end: Math.max(e1, e2) };
    },
    heroDie(out, t, p) {
      const lp = filt('lowpass', 2000, gain(out, 1), 1); lp.frequency.exponentialRampToValueAtTime(300, t + 0.7);
      tone(lp, t, 'sawtooth', 420 * p, 70 * p, 0.7, 0.01, 0.45, 0.75);
      tone(lp, t, 'sawtooth', 424 * p, 71 * p, 0.7, 0.01, 0.3, 0.75);
      const e = tone(shaper(gain(out, 0.7), 5), t, 'sine', 90 * p, 30 * p, 0.5, 0.004, 0.9, 0.6);
      return { end: Math.max(e, t + 0.8) };
    },
    levelUp(out, t, p) {
      let end = t;
      [1047, 1319, 1568, 2093].forEach((f, i) => { end = Math.max(end, tone(out, t + i * 0.085, 'triangle', f * p, null, 0, 0.004, 0.32, 0.28)); });
      for (let i = 0; i < 6; i++) tone(out, t + 0.3 + i * 0.04, 'sine', (3000 + Math.random() * 2500) * p, null, 0, 0.002, 0.07, 0.12);
      return { end: Math.max(end, t + 0.6) };
    },
    ki(out, t, p) {
      tone(out, t, 'sine', 1600 * p, null, 0, 0.002, 0.22, 0.06);
      const e = tone(out, t + 0.02, 'triangle', 2400 * p, null, 0, 0.002, 0.12, 0.07);
      return { end: e };
    },
    kiFull(out, t, p) {
      tone(out, t, 'triangle', 1319 * p, null, 0, 0.004, 0.25, 0.25);
      const e = tone(out, t + 0.09, 'triangle', 1976 * p, null, 0, 0.004, 0.25, 0.4);
      burst(out, t + 0.09, 'highpass', 7000, 0.7, 0.02, 0.12, 0.35);
      return { end: e };
    },
    spark(out, t, p) {
      const d = shaper(gain(out, 0.8), 5);
      tone(d, t, 'sine', 80 * p, 30 * p, 0.4, 0.003, 0.9, 0.5);
      const g = gain(out, 0); const end = env(g, t, 0.15, 0.6, 0.85);
      const b = filt('bandpass', 300 * p, g, 1.6); b.frequency.exponentialRampToValueAtTime(2000 * p, t + 0.8); noise(b, t, end);
      const sl = filt('lowpass', 1200, gain(g, 0.5), 1);
      osc('sawtooth', 55 * p, sl, t, end, 110 * p, 0.6); osc('sawtooth', 55.6 * p, sl, t, end, 111 * p, 0.6);
      return { end };
    },
    recall(out, t, p, o) {
      const dur = o.dur || 4, end = t + dur;
      const g = gain(out, 0); g.gain.setValueAtTime(E, t); g.gain.linearRampToValueAtTime(0.28, t + 0.4);
      g.gain.setValueAtTime(0.28, end - 0.3); g.gain.exponentialRampToValueAtTime(E, end);
      const trem = gain(g, 0.7); const lfo = ctx.createOscillator(); lfo.frequency.value = 7; const lg = ctx.createGain(); lg.gain.value = 0.3;
      lfo.connect(lg); lg.connect(trem.gain); lfo.start(t); lfo.stop(end + 0.05);
      const nodes = [lfo];
      for (const f of [880, 1320, 1760]) nodes.push(osc('sine', f * p, trem, t, end, f * p * 1.5, dur));
      nodes.push(noise(filt('highpass', 7000, gain(g, 0.35), 0.7), t, end, 1.2));
      // 逐漸變密的亮點
      for (let i = 0; i < 18; i++) {
        const tt = t + dur * Math.sqrt(i / 18);
        tone(g, tt, 'sine', (2500 + Math.random() * 2500) * p, null, 0, 0.002, 0.18, 0.1);
      }
      return { end: end + 0.05, handle: holdable(g, nodes, end) };
    },
    respawn(out, t, p) {
      burst(out, t, 'bandpass', 300, 1.5, 0.25, 0.4, 0.2, 2500);
      let end = t;
      [523, 659, 784].forEach((f) => { end = Math.max(end, tone(out, t + 0.25, 'triangle', f * p, null, 0, 0.01, 0.2, 0.6)); });
      return { end };
    },
    select(out, t, p) {
      tone(out, t, 'triangle', 660 * p, null, 0, 0.003, 0.3, 0.09);
      const e = tone(out, t + 0.07, 'triangle', 990 * p, null, 0, 0.003, 0.3, 0.18);
      return { end: e };
    },
    victory(out, t, p) {
      const seq = [[392, 0, 0.14], [523, 0.15, 0.14], [659, 0.3, 0.14], [784, 0.45, 0.35], [659, 0.82, 0.12], [784, 0.96, 0.9]];
      let end = t;
      for (const [f, dt, d] of seq) {
        end = Math.max(end, tone(out, t + dt, 'square', f * p, null, 0, 0.005, 0.12, d));
        tone(out, t + dt, 'triangle', f * p * 0.5, null, 0, 0.005, 0.2, d);
      }
      for (const f of [523, 659, 784, 1047]) end = Math.max(end, tone(out, t + 0.96, 'triangle', f * p, null, 0, 0.01, 0.14, 1.1));
      tone(shaper(gain(out, 0.6), 4), t + 0.96, 'sine', 90, 40, 0.3, 0.003, 0.6, 0.4);
      return { end };
    },
    defeat(out, t, p) {
      let end = t;
      [[440, 0], [415, 0.32], [392, 0.64], [311, 0.96]].forEach(([f, dt], i) => {
        const lp = filt('lowpass', 1800 - i * 300, gain(out, 1), 0.7);
        end = Math.max(end, tone(lp, t + dt, 'triangle', f * p, null, 0, 0.02, 0.3, i === 3 ? 1.2 : 0.4));
        tone(lp, t + dt, 'sawtooth', f * p * 0.5, null, 0, 0.02, 0.06, i === 3 ? 1.2 : 0.4);
      });
      return { end };
    },
    ui(out, t, p) {
      const e = tone(out, t, 'sine', 900 * p, 700 * p, 0.03, 0.002, 0.18, 0.035);
      return { end: e };
    },
  };

  // 播放：每次建一條 gain(音量×距離) → panner → sfx；結束後斷開
  function voice(name, o = {}, at) {
    const fn = S[name]; if (!fn) return null;
    const t = at != null ? at : ctx.currentTime + 0.005;
    const v = clamp((o.vol == null ? 1 : o.vol) * (o.dist == null ? 1 : clamp(o.dist, 0, 1)), 0, 1.5);
    if (v <= 0.001) return null;
    const vg = ctx.createGain(); vg.gain.value = v;
    let tail = vg;
    if (o.pan && ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = clamp(o.pan, -1, 1); vg.connect(pn); tail = pn; }
    tail.connect(sfx);
    const r = fn(vg, t, clamp(o.pitch || 1, 0.25, 4), o);
    return { vg, tail, end: r.end, handle: r.handle || null };
  }

  // ---------- 音樂：太鼓式節奏＋低音持續音（lookahead 排程）----------
  const BPM = 96, STEP = 60 / BPM / 4;
  // 16 步：1 = 大鼓、2 = 小太鼓、3 = 鼓邊
  const PATS = [
    [1, 0, 0, 3, 0, 0, 2, 0, 1, 0, 3, 0, 2, 0, 3, 3],
    [1, 0, 3, 0, 1, 0, 2, 0, 1, 3, 0, 3, 2, 0, 2, 3],
    [1, 0, 0, 3, 2, 0, 1, 0, 1, 0, 3, 0, 2, 2, 3, 0],
    [1, 3, 0, 1, 2, 0, 3, 0, 1, 0, 1, 3, 2, 3, 2, 2],
  ];
  const drum = (k, t) => {
    if (k === 1) { tone(mus, t, 'sine', 95, 42, 0.18, 0.003, 0.9, 0.32); burst(mus, t, 'lowpass', 600, 0.7, 0.002, 0.3, 0.08); }
    else if (k === 2) { tone(mus, t, 'sine', 190, 110, 0.08, 0.002, 0.5, 0.14); burst(mus, t, 'bandpass', 1200, 1, 0.002, 0.3, 0.07); }
    else if (k === 3) { burst(mus, t, 'highpass', 3500, 1, 0.001, 0.22, 0.03); tone(mus, t, 'square', 800, null, 0, 0.001, 0.04, 0.02); }
  };
  let drone = null, timer = null, nextT = 0, step = 0;
  function musicOn() {
    if (timer) return;
    const t = ctx.currentTime + 0.05;
    const g = gain(mus, 0); g.gain.setValueAtTime(E, t); g.gain.linearRampToValueAtTime(0.35, t + 2);
    const lp = filt('lowpass', 260, g, 1.2);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.12; const lg = ctx.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(lp.frequency); lfo.start(t);
    const oscs = [lfo];
    for (const f of [55, 55.4, 82.4]) { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.connect(lp); o.start(t); oscs.push(o); }
    drone = { g, oscs };
    nextT = t; step = 0;
    const tick = () => {
      try {
        while (nextT < ctx.currentTime + 0.12) {
          const bar = Math.floor(step / 16), pat = PATS[Math.floor(bar / 2) % PATS.length];
          const k = pat[step % 16]; if (k) drum(k, nextT);
          nextT += STEP; step++;
        }
      } catch (e) { /* context 關閉 */ }
    };
    tick(); timer = setInterval(tick, 25);
  }
  function musicOff() {
    if (timer) { clearInterval(timer); timer = null; }
    if (drone) {
      const t = ctx.currentTime, d = drone; drone = null;
      try { d.g.gain.cancelScheduledValues(t); d.g.gain.setValueAtTime(Math.max(E, d.g.gain.value), t); d.g.gain.exponentialRampToValueAtTime(E, t + 0.6); for (const o of d.oscs) o.stop(t + 0.7); } catch (e) { /* ignore */ }
    }
  }

  return { voice, master, musicOn, musicOff, names: NAMES };
}

// ---------- 對外單例 ----------
let ctx = null, synth = null, masterVol = 0.8, isMuted = false, musicWanted = false, active = 0;
const recent = new Map();
const MAX_VOICES = 64;
const PRIORITY = new Set(['levelUp', 'victory', 'defeat', 'heroDie', 'towerDown', 'beam', 'spark', 'recall', 'select', 'ui', 'kiFull']);

function ensure() {
  if (synth) return true;
  try {
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return false;
    ctx = new AC({ latencyHint: 'interactive' });
    synth = createSynth(ctx, ctx.destination);
    synth.master.gain.value = isMuted ? 0 : masterVol;
    return true;
  } catch (e) { ctx = null; synth = null; return false; }
}
function throttled(name) {
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  let arr = recent.get(name);
  if (!arr) recent.set(name, (arr = []));
  while (arr.length && now - arr[0] > 100) arr.shift();
  if (arr.length >= 12) return true;
  arr.push(now); return false;
}

export const audio = {
  names: NAMES,
  init() { ensure(); },
  resume() {
    if (!ensure()) return;
    try {
      if (ctx.state === 'suspended') { const p = ctx.resume(); if (p && p.then) p.then(() => { if (musicWanted) synth.musicOn(); }).catch(() => {}); }
      else if (musicWanted) synth.musicOn();
    } catch (e) { /* ignore */ }
  },
  play(name, opts) {
    try {
      if (!synth || !ctx || ctx.state !== 'running' || isMuted) return null;
      if (throttled(name)) return null;
      if (active >= MAX_VOICES && !PRIORITY.has(name)) return null;
      const v = synth.voice(name, opts || {});
      if (!v) return null;
      active++;
      const ms = Math.max(50, (v.end - ctx.currentTime) * 1000 + 150);
      let freed = false;
      const free = () => { if (freed) return; freed = true; active--; try { v.tail.disconnect(); } catch (e) { /* ignore */ } };
      const tm = setTimeout(free, ms);
      if (v.handle) {
        const h = v.handle;
        return { stop() { h.stop(); clearTimeout(tm); setTimeout(free, 300); }, get ended() { return h.ended; } };
      }
      return null;
    } catch (e) { return null; }
  },
  setMaster(v) {
    masterVol = clamp(+v || 0, 0, 1);
    try { if (synth && !isMuted) synth.master.gain.setTargetAtTime(masterVol, ctx.currentTime, 0.02); } catch (e) { /* ignore */ }
  },
  music(on) {
    musicWanted = !!on;
    try {
      if (!synth || !ctx) return;
      if (musicWanted && ctx.state === 'running') synth.musicOn(); else if (!musicWanted) synth.musicOff();
    } catch (e) { /* ignore */ }
  },
  get muted() { return isMuted; },
  toggleMute() {
    isMuted = !isMuted;
    try { if (synth) synth.master.gain.setTargetAtTime(isMuted ? 0 : masterVol, ctx.currentTime, 0.02); } catch (e) { /* ignore */ }
    return isMuted;
  },
  get context() { return ctx; },
};
