// WebAudio 即時合成：海浪、城市底噪、海鷗、雨聲、港口機械聲、船笛、收銀叮噹、購買音效。第一次點擊後才啟動。
export function createAudio() {
  let ctx = null, master = null, waves = null, city = null, rain = null, dock = null, on = true;
  let lastHorn = -99;
  let lastCoin = 0, gullT = 4;
  const noiseBuf = (c, brown) => {
    const b = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  };
  function loop(buf, type, freq, q = 0.7) {
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = 0;
    s.connect(f).connect(g).connect(master);
    s.start();
    return { g, f };
  }
  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = on ? 0.8 : 0;
    master.connect(ctx.destination);
    const white = noiseBuf(ctx, false), brown = noiseBuf(ctx, true);
    waves = loop(brown, 'lowpass', 700);
    city = loop(brown, 'lowpass', 180);
    rain = loop(white, 'highpass', 2400);
    dock = loop(brown, 'bandpass', 95, 2.2);
  }
  function blip(freq, t0, dur, vol, type = 'sine', slide = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  function gull() {
    const t = ctx.currentTime;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) {
      const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      const t0 = t + k * 0.22;
      o.type = 'triangle';
      o.frequency.setValueAtTime(1500 + Math.random() * 300, t0);
      o.frequency.exponentialRampToValueAtTime(900, t0 + 0.2);
      lfo.frequency.value = 38;
      lg.gain.value = 80;
      lfo.connect(lg).connect(o.frequency);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.035, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
      o.connect(g).connect(master);
      o.start(t0); lfo.start(t0);
      o.stop(t0 + 0.24); lfo.stop(t0 + 0.24);
    }
  }
  return {
    start,
    setOn(v) {
      on = v;
      if (master) master.gain.setTargetAtTime(v ? 0.8 : 0, ctx.currentTime, 0.1);
    },
    coin(amount) {
      if (!ctx || !on) return;
      const now = ctx.currentTime;
      if (now - lastCoin < 0.09) return;
      lastCoin = now;
      const big = amount >= 3000;
      blip(1318, now, 0.12, big ? 0.07 : 0.045);
      blip(1976, now + 0.06, big ? 0.3 : 0.18, big ? 0.06 : 0.035);
      if (big) blip(2637, now + 0.12, 0.35, 0.04);
    },
    buy() {
      if (!ctx || !on) return;
      const t = ctx.currentTime;
      [523, 659, 784, 1047].forEach((f, i) => blip(f, t + i * 0.07, 0.25, 0.06, 'triangle'));
    },
    // 貨櫃船靠港的低音船笛：兩個略微走音的鋸齒波疊在一起，低通濾掉刺耳的泛音
    horn() {
      if (!ctx || !on) return;
      const t = ctx.currentTime;
      if (t - lastHorn < 6) return;
      lastHorn = t;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 520;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.07, t + 0.12);
      g.gain.setValueAtTime(0.07, t + 1.1);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
      f.connect(g).connect(master);
      for (const hz of [98, 98.9, 147]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz;
        o.connect(f);
        o.start(t);
        o.stop(t + 1.8);
      }
    },
    deny() {
      if (!ctx || !on) return;
      blip(220, ctx.currentTime, 0.18, 0.05, 'square', 0.7);
    },
    // beach：鏡頭靠近海灘的程度 0–1；day：白天 0–1
    // port：鏡頭靠近海港的程度 0–1
    update(dt, { beach, port = 0, day, rainK, speed }) {
      if (!ctx) return;
      const t = ctx.currentTime;
      const swell = 0.6 + 0.4 * Math.sin(t * 0.85) * Math.sin(t * 0.31 + 1);
      waves.g.gain.setTargetAtTime((0.05 + 0.2 * beach) * swell, t, 0.3);
      waves.f.frequency.setTargetAtTime(420 + 520 * swell, t, 0.3);
      city.g.gain.setTargetAtTime(0.05 + 0.1 * (1 - beach) * (0.4 + 0.6 * day), t, 0.5);
      rain.g.gain.setTargetAtTime(0.09 * rainK, t, 0.6);
      dock.g.gain.setTargetAtTime(0.09 * port * (speed > 0 ? 1 : 0.3), t, 0.5);
      gullT -= dt;
      if (gullT <= 0) {
        gullT = 5 + Math.random() * 10;
        if (on && day > 0.5 && beach > 0.3 && rainK < 0.3 && speed > 0) gull();
      }
    },
  };
}
