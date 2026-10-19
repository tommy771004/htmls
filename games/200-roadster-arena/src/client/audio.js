// 音效：WebAudio 即時合成，沒有任何音檔。電動馬達的嗚嗚聲（兩組振盪器隨轉速升降）、逆變器的高頻、
// 輪胎尖叫（帶通雜訊）、風切、冷氣噴口的嘶聲，以及各種一次性的提示音。第一次按鍵或點擊後才啟動。
export class Sound {
  constructor() { this.ctx = null; this.vol = 0.7; this.loops = null; }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.vol;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    // 一秒的白雜訊，循環使用
    const len = ctx.sampleRate;
    const buf = this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.buildLoops();
  }

  setVolume(v) { this.vol = v; if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }

  noise() { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; return s; }

  buildLoops() {
    const ctx = this.ctx;
    const bus = this.loopBus = ctx.createGain(); bus.gain.value = 0; bus.connect(this.master);
    // 馬達：鋸齒＋三角波，經低通
    const m1 = ctx.createOscillator(); m1.type = 'sawtooth';
    const m2 = ctx.createOscillator(); m2.type = 'triangle';
    const mlp = ctx.createBiquadFilter(); mlp.type = 'lowpass'; mlp.frequency.value = 900; mlp.Q.value = 3;
    const mg = ctx.createGain(); mg.gain.value = 0;
    m1.connect(mlp); m2.connect(mlp); mlp.connect(mg).connect(bus);
    // 逆變器高頻
    const inv = ctx.createOscillator(); inv.type = 'sine';
    const ig = ctx.createGain(); ig.gain.value = 0;
    inv.connect(ig).connect(bus);
    // 輪胎
    const tn = this.noise(); const tbp = ctx.createBiquadFilter(); tbp.type = 'bandpass'; tbp.frequency.value = 1500; tbp.Q.value = 4;
    const tg = ctx.createGain(); tg.gain.value = 0;
    tn.connect(tbp).connect(tg).connect(bus);
    // 風
    const wn = this.noise(); const wlp = ctx.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 400;
    const wg = ctx.createGain(); wg.gain.value = 0;
    wn.connect(wlp).connect(wg).connect(bus);
    // 冷氣噴口
    const hn = this.noise(); const hhp = ctx.createBiquadFilter(); hhp.type = 'highpass'; hhp.frequency.value = 2400;
    const hpk = ctx.createBiquadFilter(); hpk.type = 'peaking'; hpk.frequency.value = 5200; hpk.gain.value = 8;
    const hg = ctx.createGain(); hg.gain.value = 0;
    hn.connect(hhp).connect(hpk).connect(hg).connect(bus);
    for (const s of [m1, m2, inv, tn, wn, hn]) s.start();
    this.loops = { m1, m2, mlp, mg, inv, ig, tbp, tg, wlp, wg, hg, hpk };
  }

  // 每幀：依車輛狀態調整持續音。active=false 時淡出（選單、暫停）
  drive(st, active) {
    if (!this.loops) return;
    const L = this.loops, t = this.ctx.currentTime, k = 0.06;
    this.loopBus.gain.setTargetAtTime(active ? 1 : 0, t, 0.15);
    if (!active || !st) return;
    const sp = st.speed;
    const thr = Math.abs(st.input ? st.input.throttle : 0);
    const f = 48 + sp * 7.5;
    L.m1.frequency.setTargetAtTime(f, t, k);
    L.m2.frequency.setTargetAtTime(f * 2.01, t, k);
    L.mlp.frequency.setTargetAtTime(500 + sp * 30 + thr * 600, t, k);
    L.mg.gain.setTargetAtTime(0.025 + thr * 0.05 + Math.min(0.04, sp * 0.0008), t, k);
    L.inv.frequency.setTargetAtTime(1800 + sp * 55, t, k);
    L.ig.gain.setTargetAtTime(thr * 0.007 + (sp > 2 ? 0.003 : 0), t, k);
    const slip = st.contacts >= 2 ? Math.min(1, Math.abs(st.slip || 0) * 2.5) * Math.min(1, sp / 12) : 0;
    const burn = st.contacts >= 2 && st.input && st.input.handbrake && thr > 0.5 && sp < 6 ? 0.8 : 0;
    L.tg.gain.setTargetAtTime(Math.max(slip, burn) * 0.09, t, 0.05);
    L.tbp.frequency.setTargetAtTime(1200 + slip * 700, t, 0.1);
    L.wg.gain.setTargetAtTime(Math.min(0.16, sp * sp * 0.00006), t, 0.1);
    L.wlp.frequency.setTargetAtTime(300 + sp * 22, t, 0.1);
    const gas = st.boosting ? 0.11 : st.hovering ? 0.08 : 0;
    L.hg.gain.setTargetAtTime(gas, t, 0.03);
    L.hpk.frequency.setTargetAtTime(st.hovering ? 3600 : 5200, t, 0.05);
  }

  tone(freq, dur, { type = 'sine', vol = 0.12, slide = 0, delay = 0, attack = 0.005 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  burst(dur, { freq = 800, type = 'lowpass', vol = 0.2, q = 1, delay = 0 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  play(name, k = 1) {
    if (!this.ctx) return;
    switch (name) {
      case 'click': this.tone(1400, 0.05, { type: 'square', vol: 0.03 }); break;
      case 'move': this.tone(900, 0.04, { type: 'square', vol: 0.02 }); break;
      case 'land': this.burst(0.25, { freq: 160, vol: Math.min(0.5, 0.12 + k * 0.03) }); this.tone(70, 0.2, { vol: Math.min(0.3, 0.05 + k * 0.015), slide: 0.6 }); break;
      case 'jump': this.burst(0.18, { freq: 3500, type: 'highpass', vol: 0.07 }); break;
      case 'pad': this.tone(500, 0.35, { type: 'sawtooth', vol: 0.05, slide: 3 }); this.burst(0.4, { freq: 4000, type: 'highpass', vol: 0.08 }); break;
      case 'ring': this.tone(1318, 0.5, { vol: 0.08 }); this.tone(1976, 0.6, { vol: 0.06, delay: 0.06 }); break;
      case 'trick': this.tone(880, 0.18, { type: 'triangle', vol: 0.06 }); this.tone(1320, 0.25, { type: 'triangle', vol: 0.05, delay: 0.05 }); break;
      case 'landed': this.tone(660, 0.2, { type: 'triangle', vol: 0.07 }); this.tone(990, 0.3, { type: 'triangle', vol: 0.06, delay: 0.07 }); this.tone(1320, 0.4, { type: 'triangle', vol: 0.05, delay: 0.14 }); break;
      case 'bail': this.tone(160, 0.4, { type: 'sawtooth', vol: 0.06, slide: 0.5 }); break;
      case 'objective': this.tone(784, 0.25, { vol: 0.08 }); this.tone(1175, 0.45, { vol: 0.08, delay: 0.12 }); break;
      case 'count': this.tone(660, 0.18, { type: 'square', vol: 0.05 }); break;
      case 'go': this.tone(1320, 0.45, { type: 'square', vol: 0.06 }); break;
      case 'gate': this.tone(1046, 0.16, { type: 'triangle', vol: 0.08 }); this.tone(1568, 0.3, { type: 'triangle', vol: 0.07, delay: 0.08 }); break;
      case 'finish': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.6, { type: 'triangle', vol: 0.07, delay: i * 0.09 })); break;
      case 'hit': this.burst(0.2, { freq: 260, vol: Math.min(0.5, 0.15 + k * 0.012) }); this.tone(110, 0.18, { vol: Math.min(0.25, 0.06 + k * 0.006), slide: 0.7 }); break;
      case 'goal':
        for (const [f, d] of [[220, 0], [277, 0], [330, 0], [440, 0.25]]) this.tone(f, 1.6, { type: 'sawtooth', vol: 0.035, delay: d, attack: 0.05 });
        this.burst(2.2, { freq: 1200, type: 'bandpass', vol: 0.14, q: 0.6, delay: 0.1 });
        break;
      case 'wrong': this.tone(300, 0.25, { type: 'square', vol: 0.04 }); break;
    }
  }
}
