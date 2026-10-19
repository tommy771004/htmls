
// ═══ 聲音：雨、城市低頻、引擎、甩尾、夜店 124 BPM 與酒吧 84 BPM 音樂，全部即時合成 ═══
const sfx = (() => {
  let ac = null, master, noiseBuf, rainG, rainF, cityG, eng = null, skidG, clubBus, clubF, barBus, barF, sched = null;
  const st = { muted: false, clubT0: 0, barT0: 0, nextClub: 0, nextBar: 0, clubStep: 0, barStep: 0, where: 'out', dClub: 999, dBar: 999 };
  const CLUB_BPM = 124, BAR_BPM = 84;
  const t0perf = performance.now();
  function now() { return ac ? ac.currentTime : (performance.now() - t0perf) / 1000; }
  function mkNoise() {
    const b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function noiseSrc(loop = true) { const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = loop; return s; }
  function brown() {
    const b = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate), d = b.getChannelData(0); let l = 0;
    for (let i = 0; i < d.length; i++) { l = (l + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; }
    const s = ac.createBufferSource(); s.buffer = b; s.loop = true; return s;
  }
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ac.createGain(); master.gain.value = st.muted ? 0 : .8;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ac.destination);
    noiseBuf = mkNoise();
    // 雨：兩層濾波噪音，一層沙沙聲、一層高頻的滴答
    rainF = ac.createBiquadFilter(); rainF.type = 'lowpass'; rainF.frequency.value = 7000;
    rainG = ac.createGain(); rainG.gain.value = 0;
    const r1 = noiseSrc(), hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 450;
    r1.connect(hp); hp.connect(rainF);
    const r2 = noiseSrc(), bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = .8;
    const r2g = ac.createGain(); r2g.gain.value = .5; r2.playbackRate.value = .7;
    r2.connect(bp); bp.connect(r2g); r2g.connect(rainF);
    rainF.connect(rainG); rainG.connect(master);
    r1.start(); r2.start();
    // 城市低頻
    const cb = brown(), cl = ac.createBiquadFilter(); cl.type = 'lowpass'; cl.frequency.value = 220;
    cityG = ac.createGain(); cityG.gain.value = 0;
    cb.connect(cl); cl.connect(cityG); cityG.connect(master); cb.start();
    // 甩尾
    const sk = noiseSrc(), skf = ac.createBiquadFilter(); skf.type = 'bandpass'; skf.frequency.value = 1150; skf.Q.value = 3;
    skidG = ac.createGain(); skidG.gain.value = 0; sk.connect(skf); skf.connect(skidG); skidG.connect(master); sk.start();
    // 音樂匯流排：牆外時用低通悶住
    clubF = ac.createBiquadFilter(); clubF.type = 'lowpass'; clubF.frequency.value = 300;
    clubBus = ac.createGain(); clubBus.gain.value = 0; clubBus.connect(clubF); clubF.connect(master);
    barF = ac.createBiquadFilter(); barF.type = 'lowpass'; barF.frequency.value = 800;
    barBus = ac.createGain(); barBus.gain.value = 0; barBus.connect(barF); barF.connect(master);
    st.clubT0 = ac.currentTime + .1; st.nextClub = st.clubT0; st.barT0 = ac.currentTime + .1; st.nextBar = st.barT0;
    sched = setInterval(schedule, 25);
    ambientLoop();
  }
  // ─── 夜店：四拍大鼓、反拍開鈸、拍手、Acid 貝斯、和弦鋪底、後段琶音 ───
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  const BASS = [0, 0, 12, 0, 0, 0, 12, 3, 0, 0, 12, 0, 7, 0, 12, 10];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function kick(t, bus) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .14); env(g, t, .002, .9, .35); o.connect(g); g.connect(bus); o.start(t); o.stop(t + .4); }
  function nz(t, bus, type, f, q, peak, d) { const s = noiseSrc(false), fl = ac.createBiquadFilter(), g = ac.createGain(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; env(g, t, .002, peak, d); s.connect(fl); fl.connect(g); g.connect(bus); s.start(t, Math.random()); s.stop(t + d + .05); }
  function tone(t, bus, type, f, peak, a, d, lp = 0, lpEnd = 0) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f;
    let out = o;
    if (lp) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 7; fl.frequency.setValueAtTime(lp, t); fl.frequency.exponentialRampToValueAtTime(lpEnd || lp, t + a + d); o.connect(fl); out = fl; }
    env(g, t, a, peak, d); out.connect(g); g.connect(bus); o.start(t); o.stop(t + a + d + .05);
  }
  function clubStep(step, t) {
    const s16 = step % 16, bar = Math.floor(step / 16);
    if (s16 % 4 === 0) kick(t, clubBus);
    if (s16 === 4 || s16 === 12) nz(t, clubBus, 'bandpass', 1600, 1.2, .35, .16);
    if (s16 % 4 === 2) nz(t, clubBus, 'highpass', 7000, .7, .18, .09);
    else nz(t, clubBus, 'highpass', 9000, .7, .05, .03);
    const root = [45, 41, 36, 43][Math.floor(bar / 2) % 4];
    const bn = BASS[s16];
    if (s16 % 4 !== 0) tone(t, clubBus, 'sawtooth', mtof(root + bn), .22, .004, .14, 900 + 700 * Math.sin(bar * .7 + s16 * .3), 160);
    if (s16 === 0 && bar % 2 === 0) for (const n of CHORDS[Math.floor(bar / 2) % 4]) for (const det of [-6, 6]) {
      const o = ac.createOscillator(), g = ac.createGain(), fl = ac.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = det; fl.type = 'lowpass'; fl.frequency.value = 1300;
      const dur = 2 * 4 * 60 / CLUB_BPM;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(.035, t + .4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(fl); fl.connect(g); g.connect(clubBus); o.start(t); o.stop(t + dur + .05);
    }
    if (bar % 16 >= 8) { const ch = CHORDS[Math.floor(bar / 2) % 4]; tone(t, clubBus, 'square', mtof(ch[s16 % 3] + 12 * (1 + (s16 >> 3 & 1))), .05, .003, .09, 2400, 800); }
  }
  // ─── 酒吧：Rhodes 和弦、刷鼓、低音提琴 ───
  const BCH = [[50, 53, 57, 60, 64], [43, 47, 53, 57, 64], [48, 52, 55, 59, 62], [45, 49, 55, 57, 64]];
  function rhodes(t, f, peak, d) {
    const o = ac.createOscillator(), m = ac.createOscillator(), mg = ac.createGain(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = f; m.frequency.value = f * 2; mg.gain.value = f * .6;
    m.connect(mg); mg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + .01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(barBus); o.start(t); m.start(t); o.stop(t + d + .05); m.stop(t + d + .05);
  }
  function barStep(step, t) {
    const s8 = step % 8, bar = Math.floor(step / 8);
    const ch = BCH[bar % 4];
    if (s8 === 0) ch.slice(1).forEach((n, i) => rhodes(t + i * .012, mtof(n), .05, 2.6));
    if (s8 === 5) ch.slice(2).forEach((n, i) => rhodes(t + i * .01, mtof(n + 12), .025, 1.2));
    if (s8 % 2 === 0) tone(t, barBus, 'triangle', mtof(ch[0] - 12 + [0, 7, 12, 10][s8 / 2]), .22, .01, .45);
    if (s8 === 2 || s8 === 6) nz(t, barBus, 'bandpass', 2500, .5, .07, .22);
    nz(t + (s8 % 2 ? .05 : 0), barBus, 'highpass', 6000, .5, .025, .06);
  }
  function schedule() {
    if (!ac) return;
    const ahead = ac.currentTime + .14;
    const clubOn = st.where === 'club' || (st.where === 'out' && st.dClub < 70);
    const barOn = st.where === 'bar' || (st.where === 'out' && st.dBar < 40);
    const cs = 60 / CLUB_BPM / 4, bs = 60 / BAR_BPM / 2;
    while (st.nextClub < ahead) { if (clubOn) clubStep(st.clubStep, st.nextClub); st.clubStep++; st.nextClub += cs; }
    while (st.nextBar < ahead) { if (barOn) barStep(st.barStep, st.nextBar); st.barStep++; st.nextBar += bs; }
  }
  // 遠處喇叭與警笛
  function ambientLoop() {
    setTimeout(ambientLoop, 4000 + Math.random() * 9000);
    if (!ac || st.where !== 'out') return;
    const t = ac.currentTime + .05;
    if (Math.random() < .7) {
      const f = 330 + Math.random() * 120, g = ac.createGain(), p = ac.createStereoPanner(); p.pan.value = Math.random() * 2 - 1;
      for (const k of [1, 1.26]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f * k; const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900; o.connect(fl); fl.connect(g); o.start(t); o.stop(t + .5); }
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.03, t + .02); g.gain.setValueAtTime(.03, t + .35); g.gain.exponentialRampToValueAtTime(0.0001, t + .5);
      g.connect(p); p.connect(master);
    } else {
      const o = ac.createOscillator(), g = ac.createGain(), p = ac.createStereoPanner(); p.pan.value = Math.random() * 2 - 1;
      o.type = 'triangle';
      for (let k = 0; k < 8; k++) { o.frequency.setValueAtTime(650, t + k * .7); o.frequency.linearRampToValueAtTime(1150, t + k * .7 + .35); o.frequency.linearRampToValueAtTime(650, t + k * .7 + .7); }
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.025, t + 1.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 5.6);
      o.connect(g); g.connect(p); p.connect(master); o.start(t); o.stop(t + 5.7);
    }
  }
  function startEngine(v) {
    if (!ac) return;
    if (eng) stopEngine();
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), fl = ac.createBiquadFilter(), g = ac.createGain();
    o1.type = 'sawtooth'; o2.type = v.isCar ? 'square' : 'sawtooth'; fl.type = 'lowpass'; fl.frequency.value = 500; fl.Q.value = 2;
    g.gain.value = 0;
    o1.connect(fl); o2.connect(fl); fl.connect(g); g.connect(master); o1.start(); o2.start();
    eng = { o1, o2, fl, g, car: v.isCar };
  }
  function stopEngine() { if (!eng) return; const e = eng; eng = null; const t = ac.currentTime; e.g.gain.setTargetAtTime(0, t, .15); e.o1.stop(t + .8); e.o2.stop(t + .8); }
  return {
    init,
    get ready() { return !!ac; },
    beat() { return (now() - (ac ? st.clubT0 : 0)) * CLUB_BPM / 60; },
    setMuted(m) { st.muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : .8, ac.currentTime, .05); },
    get muted() { return st.muted; },
    update(dt, s) {
      if (!ac) return;
      const t = ac.currentTime;
      st.where = s.where; st.dClub = s.dClub; st.dBar = s.dBar;
      const out = s.where === 'out';
      rainG.gain.setTargetAtTime(out ? .3 * (.4 + s.rain) : s.where === 'bar' ? .06 : .015, t, .3);
      rainF.frequency.setTargetAtTime(out ? 7000 : 500, t, .2);
      cityG.gain.setTargetAtTime(out ? .14 : .02, t, .5);
      clubBus.gain.setTargetAtTime(s.where === 'club' ? .75 : out ? clamp(1 - s.dClub / 55, 0, 1) * .45 : 0, t, .25);
      clubF.frequency.setTargetAtTime(s.where === 'club' ? 16000 : 260 + clamp(1 - s.dClub / 20, 0, 1) * 500, t, .25);
      barBus.gain.setTargetAtTime(s.where === 'bar' ? .8 : out ? clamp(1 - s.dBar / 22, 0, 1) * .3 : 0, t, .25);
      barF.frequency.setTargetAtTime(s.where === 'bar' ? 9000 : 700, t, .25);
      if (eng) {
        const base = eng.car ? 38 : 52, f = base + s.rpm * (eng.car ? 120 : 160) * (1 + s.gear * .06);
        eng.o1.frequency.setTargetAtTime(f, t, .05); eng.o2.frequency.setTargetAtTime(f * (eng.car ? .5 : 1.01), t, .05);
        eng.fl.frequency.setTargetAtTime(300 + s.thr * 1400 + s.rpm * 900, t, .06);
        eng.g.gain.setTargetAtTime(.05 + s.thr * .07 + s.rpm * .04 + (s.nitro ? .04 : 0), t, .08);
      }
      skidG.gain.setTargetAtTime(clamp((s.slip - 2.5) / 6, 0, 1) * .16, t, .05);
    },
    engineOn(v) { startEngine(v); },
    engineOff() { stopEngine(); },
    step(run, indoor) { if (!ac) return; const t = ac.currentTime; nz(t, master, 'bandpass', indoor ? 600 : 1400, 1, run ? .1 : .06, indoor ? .06 : .09); if (!indoor) nz(t + .01, master, 'highpass', 4000, .5, .03, .12); },
    horn(c) { if (!ac) return; const t = ac.currentTime; const g = ac.createGain(); for (const k of [1, 1.25]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 370 * k; const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1400; o.connect(fl); fl.connect(g); o.start(t); o.stop(t + .45); } g.gain.setValueAtTime(.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + .45); g.connect(master); },
    impact(k) { if (!ac) return; const t = ac.currentTime; nz(t, master, 'lowpass', 500, 1, clamp(k / 12, .05, .5), .3); kick(t, master); },
    door() { if (!ac) return; const t = ac.currentTime; nz(t, master, 'lowpass', 300, 1, .2, .25); tone(t + .05, master, 'sine', 90, .2, .005, .2); },
    doorCar(car) { if (!ac) return; const t = ac.currentTime; nz(t, master, 'lowpass', car ? 700 : 1500, 1, .15, .12); },
    click() { if (!ac) return; tone(ac.currentTime, master, 'sine', 880, .05, .002, .06); },
    rope() { if (!ac) return; const t = ac.currentTime; tone(t, master, 'triangle', 660, .06, .005, .3); tone(t + .12, master, 'triangle', 990, .05, .005, .4); },
    pickup() { if (!ac) return; const t = ac.currentTime; [784, 988, 1175].forEach((f, i) => tone(t + i * .08, master, 'sine', f, .06, .005, .3)); },
    glass() { if (!ac) return; const t = ac.currentTime; tone(t, master, 'sine', 2400, .05, .002, .5); tone(t + .02, master, 'sine', 3150, .03, .002, .4); },
    spray() { if (!ac) return; nz(ac.currentTime, master, 'highpass', 3000, .5, .1, .7); },
    thunder(d) { if (!ac) return; const t = ac.currentTime + d; const s = noiseSrc(false), fl = ac.createBiquadFilter(), g = ac.createGain(); fl.type = 'lowpass'; fl.frequency.value = 160; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.5, t + .15); g.gain.exponentialRampToValueAtTime(0.0001, t + 4); s.playbackRate.value = .5; s.connect(fl); fl.connect(g); g.connect(master); s.start(t); s.stop(t + 4.2); },
  };
})();
