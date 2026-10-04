// WebAudio 即時合成：槍聲、腳步、運輸機、風聲、開傘、命中、毒圈。不載入音檔。
const SHOT = {
  p9: { f: 1400, q: 0.9, dur: 0.16, thump: 120, vol: 0.55 },
  smg: { f: 1700, q: 1.0, dur: 0.12, thump: 140, vol: 0.5 },
  ar: { f: 1000, q: 0.8, dur: 0.2, thump: 90, vol: 0.7 },
  sg: { f: 650, q: 0.6, dur: 0.38, thump: 70, vol: 0.95 },
  dmr: { f: 900, q: 0.7, dur: 0.32, thump: 80, vol: 0.85 },
  sr: { f: 700, q: 0.6, dur: 0.6, thump: 60, vol: 1.0 },
};

export function makeAudio() {
  let ctx = null, master, noiseBuf, windG, windF, droneG, droneO = [], stormG, stormF;
  const A = { volume: 0.7, ready: false };
  A.init = () => {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    master = ctx.createGain(); master.gain.value = A.volume; master.connect(ctx.destination);
    const len = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // 持續音：風、運輸機、毒圈
    const loop = (filterType, f) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = filterType; fl.frequency.value = f; const g = ctx.createGain(); g.gain.value = 0; s.connect(fl).connect(g).connect(master); s.start(); return [g, fl]; };
    [windG, windF] = loop('bandpass', 500);
    [stormG, stormF] = loop('lowpass', 260);
    droneG = ctx.createGain(); droneG.gain.value = 0; const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 420; droneG.connect(dl).connect(master);
    for (const f of [58, 58.7, 87.5, 117]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = 0.18; o.connect(g).connect(droneG); o.start(); droneO.push(o); }
    A.ready = true;
  };
  A.setVolume = (v) => { A.volume = v; if (master) master.gain.value = v; };
  const pan = (p) => { const n = ctx.createStereoPanner(); n.pan.value = Math.max(-1, Math.min(1, p)); return n; };
  function noiseBurst({ f, q, dur, vol, type = 'bandpass', p = 0, lp = 20000, delay = 0 }) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const l = ctx.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = lp;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(fl).connect(l).connect(g).connect(pan(p)).connect(master);
    s.start(t, Math.random() * 1.5, dur + 0.05);
  }
  function tone({ f, f2 = f, dur, vol, type = 'sine', p = 0, delay = 0 }) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(pan(p)).connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  // dist：公尺；p：左右 -1..1
  A.shot = (w, dist = 0, p = 0) => {
    const S = SHOT[w] || SHOT.ar;
    const fall = 1 / (1 + dist / 25), lp = dist > 60 ? 2200 : dist > 20 ? 6000 : 20000;
    noiseBurst({ f: S.f, q: S.q, dur: S.dur * (1 + dist / 200), vol: S.vol * fall, p, lp });
    tone({ f: S.thump, f2: 35, dur: 0.18, vol: S.vol * 0.9 * fall, p });
    if (dist > 80) noiseBurst({ f: 400, q: 0.5, dur: 0.7, vol: 0.15 * fall, p, lp: 900, delay: 0.08 });
  };
  A.dry = () => tone({ f: 1800, dur: 0.04, vol: 0.15, type: 'square' });
  A.step = (dist = 0, p = 0, surface = 0) => noiseBurst({ f: surface ? 2400 : 900, q: 1.2, dur: 0.06, vol: 0.14 / (1 + dist / 6), p, lp: 5000 });
  A.hit = (hs, armor) => { tone({ f: hs ? 1800 : 1100, f2: hs ? 2400 : 900, dur: 0.07, vol: 0.22, type: 'triangle' }); if (armor) tone({ f: 600, f2: 300, dur: 0.1, vol: 0.12, type: 'square' }); };
  A.kill = () => { tone({ f: 660, dur: 0.12, vol: 0.22, type: 'triangle' }); tone({ f: 990, dur: 0.18, vol: 0.2, type: 'triangle', delay: 0.08 }); };
  A.hurt = () => { tone({ f: 180, f2: 90, dur: 0.18, vol: 0.3, type: 'sawtooth' }); noiseBurst({ f: 400, q: 1, dur: 0.12, vol: 0.25 }); };
  A.armorBreak = () => { noiseBurst({ f: 3200, q: 2, dur: 0.25, vol: 0.35 }); tone({ f: 900, f2: 200, dur: 0.25, vol: 0.18, type: 'square' }); };
  A.reload = () => { tone({ f: 500, dur: 0.05, vol: 0.18, type: 'square' }); tone({ f: 320, dur: 0.06, vol: 0.2, type: 'square', delay: 0.5 }); tone({ f: 700, dur: 0.05, vol: 0.18, type: 'square', delay: 0.9 }); };
  A.pickup = () => { tone({ f: 520, dur: 0.06, vol: 0.18, type: 'triangle' }); tone({ f: 780, dur: 0.08, vol: 0.15, type: 'triangle', delay: 0.05 }); };
  A.plate = () => noiseBurst({ f: 2600, q: 0.7, dur: 0.5, vol: 0.25, type: 'highpass' });
  A.chute = () => { noiseBurst({ f: 300, q: 0.5, dur: 0.6, vol: 0.6, lp: 1200 }); tone({ f: 90, f2: 50, dur: 0.4, vol: 0.4 }); };
  A.land = () => { tone({ f: 110, f2: 40, dur: 0.25, vol: 0.45 }); noiseBurst({ f: 500, q: 0.6, dur: 0.2, vol: 0.3 }); };
  A.ui = () => tone({ f: 880, dur: 0.05, vol: 0.12, type: 'triangle' });
  A.storm = () => { tone({ f: 140, f2: 70, dur: 1.2, vol: 0.3, type: 'sawtooth' }); tone({ f: 210, f2: 105, dur: 1.2, vol: 0.2, type: 'sawtooth', delay: 0.15 }); };
  A.win = () => { [523, 659, 784, 1046].forEach((f, i) => tone({ f, dur: 0.4, vol: 0.18, type: 'triangle', delay: i * 0.12 })); };
  // 每格更新持續音：wind 0..1、drone 0..1、storm 0..1
  A.ambient = (wind, drone, storm) => {
    if (!ctx) return;
    const t = ctx.currentTime;
    windG.gain.setTargetAtTime(wind * 0.5, t, 0.2); windF.frequency.setTargetAtTime(350 + wind * 900, t, 0.3);
    droneG.gain.setTargetAtTime(drone * 0.35, t, 0.3);
    stormG.gain.setTargetAtTime(storm * 0.6, t, 0.3); stormF.frequency.setTargetAtTime(200 + storm * 200, t, 0.3);
  };
  return A;
}
