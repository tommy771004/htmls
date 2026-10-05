// 音效：WebAudio 即時合成，第一次使用者手勢後才啟動。
// 靜音（M）只把總音量歸零；暫停與分頁隱藏時 suspend 整個 AudioContext（連海浪底噪與背景音樂一起停）。
const PENTA = [392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];   // G 大調五聲音階（G A C D E G A）

export class Audio {
  constructor() { this.ctx = null; this.on = false; this.muted = false; this.paused = false; this.musicAt = 0; this.mStep = 0; this.mNote = 2; }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended' && !this.paused) this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.7; this.master.connect(c.destination);
    // 背景音樂另一條音量（很輕），也接在總音量後面，靜音時一起關
    this.music = c.createGain(); this.music.gain.value = 0.55; this.music.connect(this.master);
    // 白噪音緩衝
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let b = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = w * 0.5 + b * 3; }
    this.noise = buf;
    // 海浪底噪：低通噪音＋慢速起伏
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    const g = c.createGain(); g.gain.value = 0.08;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.11; const lg = c.createGain(); lg.gain.value = 0.05;
    lfo.connect(lg); lg.connect(g.gain);
    const lfo2 = c.createOscillator(); lfo2.frequency.value = 0.07; const lg2 = c.createGain(); lg2.gain.value = 260;
    lfo2.connect(lg2); lg2.connect(lp.frequency);
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(); lfo.start(); lfo2.start();
    this.musicAt = c.currentTime + 1.5;
    this.on = true;
    if (this.paused) c.suspend();
  }
  // ── 開關 ──
  setMuted(m) {
    this.muted = !!m;
    if (this.master) { const t = this.ctx.currentTime; this.master.gain.cancelScheduledValues(t); this.master.gain.setTargetAtTime(this.muted ? 0 : 0.7, t, 0.04); }
  }
  setPaused(p) {
    this.paused = !!p;
    if (!this.ctx) return;
    if (p) this.ctx.suspend(); else { this.ctx.resume(); this.musicAt = Math.max(this.musicAt, this.ctx.currentTime + 0.3); }
  }
  // ── 合成工具 ──
  nz(t0, dur, f0, f1, q, vol, type = 'bandpass', out = this.master) {
    const c = this.ctx; if (!c) return;
    const s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 1;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.03, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
  }
  tone(t0, dur, f0, f1, vol, type = 'sine', out = this.master) {
    const c = this.ctx; if (!c) return;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t0); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  get t() { return this.ctx ? this.ctx.currentTime : 0; }
  get live() { return !!this.ctx && !this.paused; }
  // ── 釣魚 ──
  whoosh() { if (!this.live) return; this.nz(this.t, 0.42, 600, 3200, 1.4, 0.22); }
  splash(big = 1, at = 0) { if (!this.live) return; const t = this.t + at; this.nz(t, 0.35 * big, 2400, 400, 0.8, 0.22 * big, 'lowpass'); this.tone(t, 0.12, 520, 180, 0.12 * big); this.nz(t + 0.05, 0.25, 1800, 900, 2, 0.05); }
  plip() { if (!this.live) return; const t = this.t; this.tone(t, 0.09, 900, 520, 0.07); this.nz(t, 0.08, 3000, 1500, 3, 0.03); this.bubble(0.05); }
  bite() { if (!this.live) return; const t = this.t; this.splash(0.8); this.tone(t + 0.02, 0.18, 330, 140, 0.16, 'triangle'); this.tone(t + 0.12, 0.12, 880, 880, 0.06, 'square'); this.tone(t + 0.22, 0.14, 1175, 1175, 0.06, 'square'); }
  hookSnd() { if (!this.live) return; this.nz(this.t, 0.18, 900, 4000, 1.2, 0.18); }
  click(rate = 1) { if (!this.live) return; const t = this.t; this.nz(t, 0.025, 4200 * rate, 3800 * rate, 6, 0.08); this.tone(t, 0.02, 1800, 1500, 0.03, 'square'); }
  snap() { if (!this.live) return; const t = this.t; this.tone(t, 0.5, 900, 120, 0.16, 'sawtooth'); this.nz(t, 0.12, 5000, 2000, 2, 0.2); }
  slip() { if (!this.live) return; const t = this.t; this.tone(t, 0.3, 300, 160, 0.1, 'triangle'); this.splash(0.5); }
  // 收竿捲回：捲線器快速喀喀聲（越捲越快）＋線劃過水面的沙沙聲
  reelIn(dur = 0.55) {
    if (!this.live) return;
    const t = this.t;
    for (let s = 0, k = 0; s < dur; k++) { const r = 1 + s / dur * 0.35; this.nz(t + s, 0.02, 4400 * r, 3900 * r, 6, 0.06); this.tone(t + s, 0.018, 1900 * r, 1600 * r, 0.022, 'square'); s += 0.055 - Math.min(0.025, k * 0.0025); }
    this.nz(t, dur * 0.8, 1200, 3200, 0.9, 0.035);
  }
  bubble(at = 0) { if (!this.live) return; const t = this.t + at, f = 380 + Math.random() * 320; this.tone(t, 0.09 + Math.random() * 0.05, f, f * 2.6, 0.045); }
  // ── 魚簍 ──
  jingle() {
    if (!this.live) return;
    const t = this.t, notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    notes.forEach((f, i) => { const s = t + i * 0.11 + (i > 3 ? 0.06 : 0); this.tone(s, 0.5, f, f, 0.12); this.tone(s, 0.18, f * 3.99, f * 3.99, 0.025); this.tone(s, 0.08, f * 9.1, f * 9.1, 0.012); });
  }
  // 魚落進竹簍：竹編的悶響＋濕濕的一甩
  creel() {
    if (!this.live) return;
    const t = this.t;
    this.tone(t, 0.14, 210, 110, 0.16, 'triangle');
    this.nz(t, 0.12, 1600, 700, 1.6, 0.12);
    this.nz(t + 0.06, 0.18, 2600, 900, 1.2, 0.05, 'lowpass');
    this.tone(t + 0.1, 0.08, 330, 240, 0.05, 'triangle');
  }
  // 魚簍滿了的結算：一段比釣起更長的小曲（上行琶音＋終止和弦）
  fanfare() {
    if (!this.live) return;
    const t = this.t;
    const mel = [[392, 0], [523.25, 0.14], [659.25, 0.28], [783.99, 0.42], [659.25, 0.62], [783.99, 0.76], [1046.5, 0.96]];
    mel.forEach(([f, s]) => { this.tone(t + s, 0.42, f, f, 0.11); this.tone(t + s, 0.16, f * 3.99, f * 3.99, 0.02); });
    for (const f of [523.25, 659.25, 783.99, 1046.5]) { this.tone(t + 1.2, 1.4, f, f, 0.06, 'triangle'); }
    this.tone(t + 1.2, 1.6, 261.63, 261.63, 0.08);
  }
  // 放回大海：一串水泡往上冒＋輕輕的水聲
  release() {
    if (!this.live) return;
    this.splash(0.6);
    for (let i = 0; i < 9; i++) this.bubble(0.12 + i * 0.09 + Math.random() * 0.05);
    this.splash(0.35, 0.5);
  }
  // ── 介面與腳步 ──
  ui(open = true) { if (!this.live) return; const t = this.t; this.tone(t, 0.06, open ? 760 : 980, open ? 1040 : 700, 0.05, 'triangle'); this.nz(t, 0.04, 3000, 2400, 2, 0.025); }
  // 腳步：木棧橋是低沉的「咚」加木板的咔，沙灘是軟的沙沙聲
  step(deck = true) {
    if (!this.live) return;
    const t = this.t, v = 0.85 + Math.random() * 0.3;
    if (deck) { this.tone(t, 0.09, 150 * v, 85, 0.07, 'triangle'); this.nz(t, 0.05, 1100 * v, 600, 2.2, 0.035); }
    else this.nz(t, 0.11, 900 * v, 500, 0.7, 0.03, 'lowpass');
  }
  // ── 背景音樂：很輕的五聲音階撥弦，每幀由 main.js 呼叫，提前 0.3 s 排程 ──
  tick() {
    if (!this.live || !this.on) return;
    const c = this.ctx;
    while (this.musicAt < c.currentTime + 0.3) {
      const s = this.musicAt, k = this.mStep++ % 16;
      if (k % 2 === 0 || Math.random() < 0.3) {
        this.mNote = Math.max(0, Math.min(PENTA.length - 1, this.mNote + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
        const f = PENTA[this.mNote] / 2;
        this.tone(s, 0.9, f, f, 0.035, 'triangle', this.music);
        this.tone(s, 0.25, f * 2, f * 2, 0.008, 'sine', this.music);
      }
      if (k === 0 || k === 8) { const r = [196, 220, 261.63][Math.floor(Math.random() * 3)] / 2; this.tone(s, 1.8, r, r, 0.03, 'sine', this.music); }
      this.musicAt += k === 15 ? 1.6 : 0.42;   // 每句之後停一下
    }
  }
}
