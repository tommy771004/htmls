// 音效：全部用 Web Audio 即時合成（雜訊、振盪器、濾波器、程式生成的殘響），沒有任何音檔。
export class Sound {
  constructor() { this.ctx = null; this.vol = 0.8; this.lx = 0; this.lz = 0; this.lyaw = 0; this.muted = false; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : this.vol;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.18;
    this.master.connect(comp); comp.connect(c.destination);
    // 白雜訊
    const nb = this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // 殘響：指數衰減的雜訊脈衝響應（越後面越悶）
    const len = (c.sampleRate * 2.2) | 0, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const a = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { const t = i / len, k = 0.25 + 0.7 * (1 - t); lp += (Math.random() * 2 - 1 - lp) * k * 0.5; a[i] = lp * Math.pow(1 - t, 2.6) * (i < 400 ? i / 400 : 1); } }
    this.rev = c.createConvolver(); this.rev.buffer = ir; const rg = c.createGain(); rg.gain.value = 0.55; this.rev.connect(rg); rg.connect(this.master);
    this._ambience();
  }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : v, this.ctx.currentTime, 0.05); }
  setMuted(m) { this.muted = m; this.setVolume(this.vol); }
  listener(x, z, yaw) { this.lx = x; this.lz = z; this.lyaw = yaw; }
  // 距離與左右聲道
  _sp(x, z, ref = 7) {
    if (x === undefined) return { g: 1, pan: 0, d: 0 };
    const dx = x - this.lx, dz = z - this.lz, d = Math.hypot(dx, dz) || 0.001, pan = (dx * Math.cos(this.lyaw) - dz * Math.sin(this.lyaw)) / d;
    return { g: 1 / (1 + Math.pow(d / ref, 1.5)), pan: Math.max(-1, Math.min(1, pan)) * Math.min(1, d / 2), d };
  }
  _out(sp, wet = 0) {
    const c = this.ctx, g = c.createGain(); g.gain.value = sp.g; let node = g;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = sp.pan; g.connect(p); node = p; }
    node.connect(this.master); if (wet > 0) { const w = c.createGain(); w.gain.value = wet; node.connect(w); w.connect(this.rev); }
    return g;
  }
  _noise(dst, t, dur, peak, type, f, q = 0.7, f2) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dst); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
  }
  _tone(dst, t, dur, peak, type, f, f2, attack = 0.002) {
    const c = this.ctx, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dst); o.start(t); o.stop(t + dur + 0.02);
  }
  shot(o) { // { x, z, own, sup, occ }
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime, sp = o.own ? { g: 1, pan: 0.08, d: 0 } : this._sp(o.x, o.z, o.sup ? 3 : 11);
    if (sp.g < 0.012) return; const far = Math.min(1, sp.d / 30), occ = o.occ ? 0.4 : 1, dst = this._out(sp, o.sup ? 0.15 : 0.5 + far * 0.4), pv = 0.92 + Math.random() * 0.16;
    if (o.sup) {
      this._noise(dst, t, 0.07, 0.55 * occ, 'bandpass', 1500 * pv, 0.8); this._noise(dst, t, 0.12, 0.25 * occ, 'highpass', 3200); this._tone(dst, t, 0.05, 0.3 * occ, 'sine', 210, 90); this._tone(dst, t + 0.004, 0.02, 0.12, 'square', 1200 * pv, 500);
    } else {
      const lp = (o.own ? 5200 : 6000 / (1 + sp.d / 9)) * occ;
      this._noise(dst, t, 0.13, 1.0 * occ, 'lowpass', lp * pv, 0.6, lp * 0.25); this._tone(dst, t, 0.1, 0.95 * occ, 'sine', 170 * pv, 44);
      if (!o.occ) this._noise(dst, t, 0.035, 0.5 * (1 - far * 0.7), 'highpass', 2600);
      this._noise(dst, t + 0.01, 0.42, 0.22, 'bandpass', 620, 0.6, 240); if (o.own) this._tone(dst, t + 0.006, 0.018, 0.1, 'square', 940, 420);
    }
  }
  reload(stage, x, z, own) {
    if (!this.ctx) return; const t = this.ctx.currentTime, dst = this._out(own ? { g: 0.9, pan: 0.1 } : this._sp(x, z, 3), 0.08);
    if (stage === 0) { this._noise(dst, t + 0.22, 0.03, 0.4, 'bandpass', 2600, 2); this._noise(dst, t + 0.28, 0.09, 0.2, 'bandpass', 900, 1, 500); this._tone(dst, t + 0.22, 0.03, 0.12, 'square', 520, 300); }
    else if (stage === 1) { this._noise(dst, t, 0.04, 0.5, 'bandpass', 1500, 1.5); this._tone(dst, t, 0.06, 0.3, 'sine', 240, 120); this._noise(dst, t + 0.05, 0.02, 0.3, 'highpass', 3500); }
    else { this._noise(dst, t, 0.03, 0.5, 'bandpass', 2200, 2); this._tone(dst, t, 0.03, 0.18, 'square', 700, 380); this._noise(dst, t + 0.09, 0.035, 0.6, 'bandpass', 1800, 1.6); this._tone(dst, t + 0.09, 0.05, 0.3, 'sine', 300, 140); }
  }
  dry() { if (!this.ctx) return; const t = this.ctx.currentTime, d = this._out({ g: 0.7, pan: 0.1 }); this._noise(d, t, 0.02, 0.4, 'highpass', 3000); this._tone(d, t, 0.02, 0.15, 'square', 1400, 900); }
  step(x, z, own, hard, loud) {
    if (!this.ctx) return; const t = this.ctx.currentTime, sp = own ? { g: 0.5 * loud, pan: (Math.random() - 0.5) * 0.3 } : this._sp(x, z, 3.5); if (!own) sp.g *= loud; if (sp.g < 0.02) return; const d = this._out(sp, 0.12);
    if (hard) { this._noise(d, t, 0.03, 0.28, 'bandpass', 1500 + Math.random() * 500, 1.2); this._tone(d, t, 0.06, 0.3, 'sine', 120, 60); }
    else { this._noise(d, t, 0.08, 0.3, 'lowpass', 420 + Math.random() * 120, 0.5); this._tone(d, t, 0.06, 0.18, 'sine', 90, 50); }
  }
  impact(x, z, kind) {
    if (!this.ctx) return; const sp = this._sp(x, z, 5); if (sp.g < 0.03) return; const t = this.ctx.currentTime, d = this._out(sp, 0.25), r = Math.random();
    if (kind === 'body') { this._noise(d, t, 0.06, 0.5, 'lowpass', 700, 0.5); this._tone(d, t, 0.07, 0.3, 'sine', 150, 70); }
    else if (kind === 'glass') { this._noise(d, t, 0.2, 0.4, 'highpass', 4200); this._tone(d, t, 0.15, 0.12, 'sine', 3100 + r * 900, 2200); }
    else if (kind === 'metal') { this._tone(d, t, 0.22, 0.2, 'triangle', 1800 + r * 1400, 1500 + r * 800); this._noise(d, t, 0.03, 0.4, 'highpass', 3000); }
    else { this._noise(d, t, 0.07, 0.5, 'bandpass', 900 + r * 900, 0.8); this._tone(d, t, 0.05, 0.22, 'sine', 220, 90); if (r > 0.82) this._tone(d, t + 0.01, 0.35, 0.07, 'sine', 2400 + r * 1500, 900); }
  }
  // 燈泡被打破：玻璃碎裂＋短促的電弧聲
  lampPop(x, z, dead) {
    if (!this.ctx) return; const sp = this._sp(x, z, 6); if (sp.g < 0.02) return; const t = this.ctx.currentTime, d = this._out(sp, 0.35), r = Math.random();
    this._noise(d, t, 0.035, 0.7, 'highpass', 3600); this._noise(d, t + 0.01, 0.3, 0.3, 'highpass', 5200);
    for (let i = 0; i < 4; i++) this._tone(d, t + 0.02 + i * 0.045 * (0.6 + Math.random()), 0.09, 0.07, 'sine', 3800 + Math.random() * 3200, 3000 + Math.random() * 1500);
    if (dead) { this._tone(d, t, 0.07, 0.22, 'sawtooth', 110 + r * 30, 55); this._noise(d, t + 0.03, 0.12, 0.25, 'bandpass', 2400, 6, 900); }
  }
  // 家具垮掉。kind：wood / metal / soft / pot / piano
  smash(x, z, kind, size = 0.7) {
    if (!this.ctx) return; const sp = this._sp(x, z, 8); if (sp.g < 0.02) return; sp.g *= 0.6 + size * 0.6; const t = this.ctx.currentTime, d = this._out(sp, 0.45), R = Math.random;
    this._noise(d, t, 0.5, 0.5, 'lowpass', 420, 0.6, 90); this._tone(d, t, 0.22, 0.6, 'sine', 95, 38);
    if (kind === 'metal') { for (let i = 0; i < 4; i++) { const f = 500 + R() * 1900; this._tone(d, t + i * 0.05 * R(), 0.5 + R() * 0.4, 0.14, 'triangle', f, f * 0.97); } this._noise(d, t, 0.08, 0.6, 'highpass', 2400); }
    else if (kind === 'soft') { this._noise(d, t, 0.3, 0.6, 'lowpass', 600, 0.5, 160); for (let i = 0; i < 3; i++) this._noise(d, t + 0.04 + i * 0.07 * R(), 0.05, 0.3, 'bandpass', 500 + R() * 500, 1.5); }
    else if (kind === 'pot') { this._noise(d, t, 0.06, 0.7, 'highpass', 1800); for (let i = 0; i < 5; i++) this._tone(d, t + 0.02 + i * 0.04 * R(), 0.1, 0.1, 'sine', 1400 + R() * 2200, 1100 + R() * 800); }
    else { // 木頭：劈裂聲＋幾下木板落地
      this._noise(d, t, 0.09, 0.9, 'bandpass', 1100 + R() * 500, 0.9, 500); this._noise(d, t + 0.015, 0.05, 0.6, 'highpass', 2600);
      for (let i = 0; i < 6; i++) { const tt = t + 0.08 + i * 0.07 + R() * 0.06; this._noise(d, tt, 0.04, 0.3 * (1 - i * 0.12), 'bandpass', 500 + R() * 900, 2.5); this._tone(d, tt, 0.05, 0.14, 'sine', 170 + R() * 160, 90); }
    }
    if (kind === 'piano') for (const f of [55, 61.7, 87.3, 116.5, 185, 277.2, 311.1]) { this._tone(d, t + R() * 0.05, 2.6, 0.11, 'triangle', f * 2, f * 1.985, 0.004); this._tone(d, t + R() * 0.05, 1.8, 0.05, 'sine', f * 4, f * 3.97, 0.004); }
  }
  pianoNote(x, z) {
    if (!this.ctx) return; const sp = this._sp(x, z, 6); if (sp.g < 0.03) return; const t = this.ctx.currentTime, d = this._out(sp, 0.5), f = 110 * Math.pow(2, ((Math.random() * 30) | 0) / 12);
    this._tone(d, t, 1.4, 0.2, 'triangle', f, f * 0.998, 0.003); this._tone(d, t, 0.8, 0.07, 'sine', f * 2.01, f * 2, 0.003); this._noise(d, t, 0.03, 0.3, 'bandpass', 1400, 1.5);
  }
  tink(x, z) { if (!this.ctx) return; const sp = this._sp(x, z, 2.5); if (sp.g < 0.04) return; const t = this.ctx.currentTime, d = this._out(sp, 0.2), f = 3600 + Math.random() * 1800; this._tone(d, t, 0.09, 0.09, 'sine', f, f * 0.96); this._tone(d, t + 0.07 + Math.random() * 0.05, 0.07, 0.05, 'sine', f * 1.12, f * 1.06); }
  hit(head, kill) { if (!this.ctx) return; const t = this.ctx.currentTime, d = this._out({ g: 0.5, pan: 0 }); this._tone(d, t, 0.045, 0.3, 'square', head ? 2300 : 1500, head ? 1900 : 1200); if (head) this._tone(d, t + 0.03, 0.09, 0.2, 'sine', 3300, 3100); if (kill) { this._tone(d, t + 0.05, 0.16, 0.24, 'triangle', 880, 870); this._tone(d, t + 0.11, 0.25, 0.22, 'triangle', 1320, 1310); } }
  hurt() { if (!this.ctx) return; const t = this.ctx.currentTime, d = this._out({ g: 0.8, pan: 0 }); this._noise(d, t, 0.12, 0.6, 'lowpass', 380, 0.6); this._tone(d, t, 0.14, 0.5, 'sine', 110, 46); }
  // 櫃檯服務鈴：回合開始
  bell(times = 1) { if (!this.ctx) return; const d = this._out({ g: 0.5, pan: 0 }, 0.6); for (let i = 0; i < times; i++) { const t = this.ctx.currentTime + i * 0.24; for (const [f, g] of [[2093, 0.3], [4186 * 0.993, 0.12], [5588, 0.08], [3136, 0.06]]) this._tone(d, t, 1.4, g, 'sine', f, f * 0.999); this._noise(d, t, 0.012, 0.25, 'highpass', 5000); } }
  stinger(win) { if (!this.ctx) return; const t = this.ctx.currentTime, d = this._out({ g: 0.45, pan: 0 }, 0.7), notes = win ? [196, 246.9, 293.7, 392] : [196, 233.1, 277.2, 185]; notes.forEach((f, i) => { this._tone(d, t + i * 0.09, 1.6, 0.16, 'sawtooth', f, f, 0.04); this._tone(d, t + i * 0.09, 1.6, 0.12, 'sine', f * 2, f * 2, 0.04); }); this._tone(d, t, 1.8, 0.3, 'sine', win ? 98 : 92.5, win ? 98 : 87); }
  ui(k) { if (!this.ctx) return; const t = this.ctx.currentTime, d = this._out({ g: 0.35, pan: 0 }); if (k === 'hover') this._tone(d, t, 0.03, 0.12, 'sine', 1900, 1700); else if (k === 'key') { for (let i = 0; i < 3; i++) this._tone(d, t + i * 0.035, 0.08, 0.1, 'sine', 3000 + Math.random() * 2500, 2600 + Math.random() * 1500); } else { this._noise(d, t, 0.03, 0.3, 'bandpass', 1400, 2); this._tone(d, t, 0.05, 0.16, 'sine', 420, 300); } }
  thunder(strength = 1) { if (!this.ctx) return; const t = this.ctx.currentTime, d = this._out({ g: 0.8 * strength, pan: (Math.random() - 0.5) * 0.8 }, 0.5); this._noise(d, t, 0.25, 0.5, 'lowpass', 900, 0.5, 200); this._noise(d, t + 0.1, 3.4, 0.7, 'lowpass', 240, 0.6, 50); this._noise(d, t + 0.8, 2.2, 0.35, 'lowpass', 120, 0.8, 40); }
  creak() { if (!this.ctx) return; const t = this.ctx.currentTime, d = this._out({ g: 0.22, pan: (Math.random() - 0.5) * 1.6 }, 0.8), f = 240 + Math.random() * 300; this._tone(d, t, 0.5 + Math.random() * 0.4, 0.06, 'sawtooth', f, f * (0.7 + Math.random() * 0.5), 0.1); this._noise(d, t, 0.4, 0.05, 'bandpass', f * 3, 6); }
  _ambience() {
    const c = this.ctx, loop = (type, f, q, g) => { const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const gn = c.createGain(); gn.gain.value = g; s.connect(fl); fl.connect(gn); gn.connect(this.master); s.start(); return { fl, gn }; };
    this.rain = loop('bandpass', 2600, 0.4, 0.035); this.rain2 = loop('highpass', 6000, 0.5, 0.012); this.wind = loop('bandpass', 320, 2.2, 0.03);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07; const lg = c.createGain(); lg.gain.value = 160; lfo.connect(lg); lg.connect(this.wind.fl.frequency); lfo.start();
    for (const [f, g] of [[55, 0.02], [110.4, 0.008], [164.6, 0.003]]) { const o = c.createOscillator(); o.frequency.value = f; const gn = c.createGain(); gn.gain.value = g; o.connect(gn); gn.connect(this.master); o.start(); }
  }
  // 靠近窗戶雨聲變大
  setRain(k) { if (this.rain) { this.rain.gn.gain.setTargetAtTime(0.02 + k * 0.07, this.ctx.currentTime, 0.4); this.rain2.gn.gain.setTargetAtTime(0.006 + k * 0.03, this.ctx.currentTime, 0.4); } }
}
