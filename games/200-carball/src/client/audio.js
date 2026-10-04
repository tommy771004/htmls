// 音效：全部 WebAudio 即時合成。混凝土大廳的殘響用產生的脈衝響應做捲積。
export class Audio {
  constructor() {
    this.ctx = null;
    this.volume = 0.7;
  }

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);
    // 大廳殘響
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.impulse(2.6, 2.4);
    this.verbGain = ctx.createGain();
    this.verbGain.gain.value = 0.32;
    this.verb.connect(this.verbGain).connect(this.master);
    this.dry = ctx.createGain();
    this.dry.connect(this.master);
    this.noiseBuf = this.makeNoise(2);
    this.engines = [this.makeEngine(0), this.makeEngine(1)];
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

  impulse(sec, decay) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        // 前段有幾個早期反射，後段指數衰減
        const early = i < ctx.sampleRate * 0.08 && Math.random() < 0.004 ? 0.8 : 0;
        d[i] = ((Math.random() * 2 - 1) * Math.pow(1 - t, decay) + early) * 0.6;
      }
    }
    return b;
  }

  makeNoise(sec) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  out(gain, wet = 0.3) {
    const g = this.ctx.createGain();
    g.gain.value = gain;
    g.connect(this.dry);
    if (wet > 0) { const w = this.ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(this.verb); }
    return g;
  }

  // 引擎：鋸齒波＋次諧波過低通，音高跟車速；加速時疊一層噴射噪音
  makeEngine(team) {
    const ctx = this.ctx;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'square';
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; f.Q.value = 2;
    const g = ctx.createGain(); g.gain.value = 0;
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    o1.connect(f); o2.connect(f); f.connect(g);
    const dest = this.out(team === 0 ? 0.11 : 0.07, 0.15);
    if (panner) { g.connect(panner); panner.connect(dest); } else g.connect(dest);
    o1.start(); o2.start();
    const n = ctx.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 900; nf.Q.value = 0.7;
    const ng = ctx.createGain(); ng.gain.value = 0;
    n.connect(nf).connect(ng);
    if (panner) ng.connect(panner); else ng.connect(dest);
    n.start();
    return { o1, o2, f, g, ng, nf, panner, boost: 0 };
  }

  // 每幀更新引擎聲：speed（m/s）、油門、是否加速、與鏡頭的距離與左右
  engine(i, speed, throttle, boosting, dist, pan, onGround) {
    if (!this.ctx) return;
    const e = this.engines[i], t = this.ctx.currentTime;
    const base = 46 + speed * 5.2 + Math.abs(throttle) * 14;
    e.o1.frequency.setTargetAtTime(base, t, 0.05);
    e.o2.frequency.setTargetAtTime(base * 0.5, t, 0.05);
    e.f.frequency.setTargetAtTime(380 + speed * 45 + Math.abs(throttle) * 300, t, 0.08);
    const att = 1 / (1 + dist * 0.12);
    e.g.gain.setTargetAtTime((0.25 + Math.abs(throttle) * 0.5 + speed * 0.02) * att * (onGround ? 1 : 0.7), t, 0.08);
    e.ng.gain.setTargetAtTime(boosting ? 0.5 * att : 0, t, boosting ? 0.03 : 0.12);
    e.nf.frequency.setTargetAtTime(700 + speed * 40, t, 0.1);
    if (e.panner) e.panner.pan.setTargetAtTime(Math.max(-0.8, Math.min(0.8, pan)), t, 0.1);
  }

  quiet() { if (!this.ctx) return; for (const e of this.engines) { e.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); e.ng.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); } }

  thump(power, dist = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const v = Math.min(1, power / 30) / (1 + dist * 0.06);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(150 + power * 3, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.22);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9 * v + 0.05, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(this.out(0.8, 0.5)); o.start(t); o.stop(t + 0.4);
    this.noise(0.05, 2400, 0.6 * v, 0.4);
  }

  noise(dur, freq, gain, wet = 0.3, type = 'bandpass', q = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.out(1, wet));
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  jump() { this.noise(0.18, 600, 0.25, 0.2, 'lowpass'); }
  flip() { this.noise(0.25, 1400, 0.22, 0.25, 'bandpass', 0.8); }
  land(v) { this.noise(0.14, 300, Math.min(0.5, 0.15 + v * 0.2), 0.3, 'lowpass'); }
  pad(big) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const notes = big ? [523, 784, 1046] : [880];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t + i * 0.05); g.gain.exponentialRampToValueAtTime(big ? 0.18 : 0.07, t + i * 0.05 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.05 + 0.25);
      o.connect(g).connect(this.out(1, 0.4)); o.start(t + i * 0.05); o.stop(t + i * 0.05 + 0.3);
    });
  }
  bump() { this.noise(0.2, 180, 0.6, 0.4, 'lowpass'); this.noise(0.08, 3200, 0.2, 0.2); }
  beep(high) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = high ? 1046 : 523;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + (high ? 0.5 : 0.18));
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400;
    o.connect(f).connect(g).connect(this.out(1, 0.5)); o.start(t); o.stop(t + 0.6);
  }
  // 進球：低頻爆炸＋兩音汽笛
  goal() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(28, t + 1.2);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    o.connect(g).connect(this.out(0.9, 0.6)); o.start(t); o.stop(t + 1.6);
    this.noise(1.4, 500, 0.9, 0.7, 'lowpass');
    for (const [f, d] of [[311, 0.3], [415, 0.3]]) {
      for (let k = 0; k < 2; k++) {
        const h = ctx.createOscillator(); h.type = 'sawtooth'; h.frequency.value = f * (k ? 1.005 : 1);
        const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 1400;
        const hg = ctx.createGain(); hg.gain.setValueAtTime(0.0001, t + d); hg.gain.exponentialRampToValueAtTime(0.06, t + d + 0.08); hg.gain.setValueAtTime(0.06, t + d + 1.3); hg.gain.exponentialRampToValueAtTime(0.0001, t + d + 1.9);
        h.connect(hf).connect(hg).connect(this.out(1, 0.6)); h.start(t + d); h.stop(t + d + 2);
      }
    }
  }
  demo() { this.noise(0.9, 400, 0.9, 0.6, 'lowpass'); this.thump(30); }
  whistle() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 2900;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 38; const lg = ctx.createGain(); lg.gain.value = 120; lfo.connect(lg).connect(o.frequency);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.setValueAtTime(0.12, t + 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    o.connect(g).connect(this.out(1, 0.6)); o.start(t); lfo.start(t); o.stop(t + 1.2); lfo.stop(t + 1.2);
  }
}
