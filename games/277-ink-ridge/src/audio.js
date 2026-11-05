// WebAudio 即時合成：山風、腳步、跳、落地、抓邊、翻上、拔刀、鐘、門、燈籠、過關。
export function makeAudio() {
  let ac = null, master = null, wind = null, noiseBuf = null;
  const ok = () => !!ac && ac.state === 'running';

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.7; master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let b = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.5 + b * 2.5; }
    // 山風：濾波噪音＋慢速起伏
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const lp = ac.createBiquadFilter(); lp.type = 'bandpass'; lp.frequency.value = 420; lp.Q.value = 0.6;
    const g = ac.createGain(); g.gain.value = 0.05;
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.09; const lg = ac.createGain(); lg.gain.value = 0.035; lfo.connect(lg); lg.connect(g.gain);
    const lfo2 = ac.createOscillator(); lfo2.frequency.value = 0.05; const lg2 = ac.createGain(); lg2.gain.value = 220; lfo2.connect(lg2); lg2.connect(lp.frequency);
    src.connect(lp); lp.connect(g); g.connect(master); src.start(); lfo.start(); lfo2.start();
    wind = { g, lp };
  }

  function noise(dur, { f = 1200, q = 0.8, type = 'bandpass', vol = 0.3, attack = 0.005, sweep = 0 } = {}) {
    if (!ok()) return;
    const t = ac.currentTime;
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 1;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (sweep) fl.frequency.exponentialRampToValueAtTime(Math.max(40, f * sweep), t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(fl); fl.connect(g); g.connect(master); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  function tone(freq, dur, { type = 'sine', vol = 0.2, attack = 0.004, at = 0, detune = 0 } = {}) {
    if (!ok()) return;
    const t = ac.currentTime + at;
    const o = ac.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune;
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }

  return {
    init,
    get running() { return ok(); },
    setWind(k) { if (wind) wind.g.gain.setTargetAtTime(0.04 + k * 0.05, ac.currentTime, 0.5); },
    step(k = 1) { noise(0.09, { f: 700 + Math.random() * 300, q: 1.2, vol: 0.09 * k + 0.03 }); },
    jump() { noise(0.22, { f: 900, q: 0.7, vol: 0.12, sweep: 2.2, attack: 0.03 }); },
    land(k = 1) { noise(0.25, { f: 260, q: 0.9, vol: 0.22 * k + 0.06, type: 'lowpass' }); },
    grab() { noise(0.12, { f: 500, q: 1.4, vol: 0.18 }); noise(0.3, { f: 1800, q: 0.5, vol: 0.05, attack: 0.02 }); },
    climb() { noise(0.35, { f: 600, q: 0.8, vol: 0.12, attack: 0.05, sweep: 1.6 }); },
    swish() { noise(0.2, { f: 2600, q: 2.5, vol: 0.13, sweep: 0.4, attack: 0.03 }); },
    bell(pitch = 1) {
      // 銅鐘：不諧和泛音、長衰減
      const f = 196 * pitch;
      for (const [m, v, d] of [[0.5, 0.18, 6], [1, 0.22, 5], [1.19, 0.12, 3.5], [1.56, 0.09, 3], [2.0, 0.08, 2.4], [2.74, 0.05, 1.6], [3.76, 0.03, 1.0]]) tone(f * m, d, { vol: v, attack: 0.003, detune: (Math.random() - 0.5) * 6 });
      noise(0.08, { f: 3000, q: 1, vol: 0.12 });
    },
    creak() { if (!ok()) return; const t = ac.currentTime; const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(48, t + 1.8);
      const fl = ac.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 500; fl.Q.value = 4; const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.2); g.gain.linearRampToValueAtTime(0, t + 1.9);
      o.connect(fl); fl.connect(g); g.connect(master); o.start(t); o.stop(t + 2); },
    lantern() { for (const [i, f] of [587, 880].entries()) tone(f, 1.4, { vol: 0.08, at: i * 0.09, type: 'triangle' }); },
    splash() { noise(0.5, { f: 900, q: 0.5, vol: 0.28, sweep: 0.3 }); noise(0.9, { f: 240, q: 0.8, vol: 0.2, type: 'lowpass', attack: 0.02 }); },
    crack() { for (let i = 0; i < 4; i++) { if (!ok()) return; tone(1800 + Math.random() * 1600, 0.05, { vol: 0.09, at: i * 0.045, type: 'square' }); } noise(0.3, { f: 3200, q: 1.5, vol: 0.14 }); },
    tick() { noise(0.04, { f: 3800, q: 3, vol: 0.06 }); },
    grind() { noise(0.34, { f: 180, q: 0.9, vol: 0.14, attack: 0.05 }); },
    thud() { noise(0.2, { f: 170, q: 0.8, vol: 0.3, type: 'lowpass' }); tone(70, 0.3, { vol: 0.2 }); },
    fall() { noise(1.1, { f: 1400, q: 0.6, vol: 0.12, sweep: 0.25, attack: 0.1 }); },
    finish() { const sc = [294, 330, 392, 440, 587, 659]; sc.forEach((f, i) => { tone(f, 1.8, { vol: 0.09, at: i * 0.16, type: 'triangle' }); tone(f * 2, 0.6, { vol: 0.03, at: i * 0.16 }); }); },
  };
}
