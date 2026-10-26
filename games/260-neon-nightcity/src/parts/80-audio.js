
// ═══ 聲音：雨、城市低頻、引擎、甩尾、夜店 128 BPM 與酒吧 84 BPM 音樂，全部即時合成 ═══
const sfx = (() => {
  let ac = null, out, master, musicG, ambG, noiseBuf, rainG, rainF, cityG, eng = null, skidG, clubBus, clubF, barBus, barF, sched = null;
  const st = { muted: false, duck: false, hidden: false, clubT0: 0, barT0: 0, nextClub: 0, nextBar: 0, clubStep: 0, barStep: 0, where: 'out', dClub: 999, dBar: 999 };
  const CLUB_BPM = 128, BAR_BPM = 84;
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
  // ─── 真實錄音（tools/sfx.mjs → assets/260/sfx/，Freesound 的 CC0 錄音）：只在 http(s) 下載；以檔案開啟、下載失敗或還沒解碼完時，各音效退回下面的合成音 ───
  // 生命週期：單發音在解碼時就裁好長度、最後 35% 淡到無聲，播完 onended 立刻斷線；同名的音有同時發聲上限，超過時最舊的 30 ms 內收掉。
  // 循環音（引擎、甩尾、警笛、旋翼）只在需要時建立，音量歸零 0.4 s 後就停掉來源，不在背景空轉。
  const REC_ON = /^https?:$/.test(location.protocol), REC_DIR = '../assets/260/sfx/';
  const rec = { one: {}, loop: {}, last: {}, live: {}, gapT: {}, gapK: {}, n: 0, fail: [], ready: false, man: null, eng: {}, engSt: {} };
  const CAP = { pistol: 6, smg: 8, rifle: 8, shotgun: 4, sniper: 3, silenced: 6, explode: 3, crash: 3, bump: 3, body: 3, step: 2, punch: 3, horn: 3 };
  const GAP = { crash: .12, bump: .07, body: .06, bodyfall: .3, glass: .1, splash: .15, horn: .2 };   // 同名的音最短間隔（碰撞每幀都可能回報），間隔內只讓更大聲的蓋過去
  const recBytes = !REC_ON ? null : fetch(REC_DIR + 'sfx.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error('sfx.json ' + r.status)))).then((man) => {
    const files = new Set([...Object.values(man.one).flat().map((v) => v[0]), ...Object.values(man.loop).map((v) => v[0])]);
    return Promise.all([...files].map((f) => fetch(REC_DIR + f).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => [f, b], () => [f, null]))).then((bs) => ({ man, bs }));
  }).catch((e) => { rec.fail.push(String(e.message || e)); return null; });
  // 單聲道、裁到 [o, o+d]、峰值正規化到 0.9；開頭 3 ms 淡入（從中間切也不會爆音），最後 35% 以平方曲線淡到 0
  function recSlice(b, o, d) {
    const sr = b.sampleRate, i0 = Math.max(0, Math.round(o * sr)), n = Math.max(1, Math.min(b.length - i0, Math.round(d * sr)));
    const out = ac.createBuffer(1, n, sr), y = out.getChannelData(0);
    for (let c = 0; c < b.numberOfChannels; c++) { const x = b.getChannelData(c); for (let i = 0; i < n; i++) y[i] += x[i0 + i] / b.numberOfChannels; }
    let pk = 1e-4; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(y[i]));
    const g = .9 / pk, fi = Math.round(.003 * sr), fo = Math.round(n * .35);
    for (let i = 0; i < n; i++) { let e = g; if (i < fi) e *= i / fi; const r = n - i; if (r < fo) e *= (r / fo) ** 2; y[i] *= e; }
    return out;
  }
  // 無縫循環：多讀 80 ms，和開頭做等功率交叉淡化；RMS 正規化到 0.25，各層引擎的音量才對得起來
  function recLoopBuf(b, o, d) {
    const sr = b.sampleRate, i0 = Math.round(o * sr), xf = Math.round(.08 * sr), n = Math.min(Math.round(d * sr), b.length - i0 - xf);
    const out = ac.createBuffer(1, n, sr), y = out.getChannelData(0);
    for (let c = 0; c < b.numberOfChannels; c++) {
      const x = b.getChannelData(c);
      for (let i = 0; i < n; i++) { let v = x[i0 + i]; if (i < xf) { const w = i / xf; v = v * Math.sqrt(w) + x[i0 + n + i] * Math.sqrt(1 - w); } y[i] += v / b.numberOfChannels; }
    }
    let e = 0; for (let i = 0; i < n; i++) e += y[i] * y[i];
    const g = .25 / Math.max(1e-4, Math.sqrt(e / n)); for (let i = 0; i < n; i++) y[i] *= g;
    return out;
  }
  async function recLoad() {
    const got = await recBytes; if (!got || !ac) return;
    const bufs = {};
    await Promise.all(got.bs.map(async ([f, b]) => { if (!b) { rec.fail.push(f); return; } try { bufs[f] = await ac.decodeAudioData(b); } catch (e) { rec.fail.push(f); } }));
    for (const [k, vs] of Object.entries(got.man.one)) { const l = vs.filter((v) => bufs[v[0]]).map(([f, o, d]) => recSlice(bufs[f], o, d)); if (l.length) rec.one[k] = l; }
    for (const [k, [f, o, d]] of Object.entries(got.man.loop)) if (bufs[f]) rec.loop[k] = recLoopBuf(bufs[f], o, d);
    rec.man = got.man; rec.ready = true;
  }
  // 各引擎型式的轉速層（sfx.json 的 eng）：開到那一型的車才下載它的幾個小檔，下載解碼完之前先用通用的引擎錄音
  function engLoad(fam) {
    const L = rec.man && rec.man.eng && rec.man.eng[fam];
    if (!L || rec.engSt[fam]) return;
    rec.engSt[fam] = 'load';
    Promise.all(L.map(([f, o, d, hz]) => fetch(REC_DIR + f).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(f + ' ' + r.status)))).then((b) => ac.decodeAudioData(b)).then((b) => ({ b: recLoopBuf(b, o, d), f: hz }))))
      .then((ls) => { rec.eng[fam] = ls; rec.engSt[fam] = 'ok'; }, (e) => { rec.engSt[fam] = 'fail'; rec.fail.push(String(e.message || e)); });
  }
  // 播一個錄音變體（不連續重複同一個、音高 ±4% 隨機）；回傳 false 表示沒有錄音，呼叫端改用合成音
  function rplay(name, { k = 1, rate = 1, bus = master, t = 0, pan = 0, lp = 0 } = {}) {
    const vs = rec.one[name]; if (!vs || !ac || !(k > .005)) return !!vs;
    const now = ac.currentTime, t0 = Math.max(now, t || now);
    if (GAP[name] && !t) { if (now - (rec.gapT[name] || -9) < GAP[name] && k <= rec.gapK[name]) return true; rec.gapT[name] = now; rec.gapK[name] = k; }
    if (rec.n > 40 && k < .25) return true;   // 太多聲音同時響時丟掉小聲的
    let i = Math.floor(Math.random() * vs.length); if (vs.length > 1 && i === rec.last[name]) i = (i + 1) % vs.length; rec.last[name] = i;
    const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = vs[i]; s.playbackRate.value = rate * (1 + (Math.random() - .5) * .08); g.gain.value = k;
    let node = s;
    if (lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
    if (pan) { const p = ac.createStereoPanner(); p.pan.value = pan; node.connect(p); node = p; }
    node.connect(g); g.connect(bus); s.start(t0); rec.n++;
    const live = rec.live[name] || (rec.live[name] = []), v = { s, g };
    live.push(v);
    while (live.length > (CAP[name] || 4)) { const o = live.shift(); o.g.gain.setTargetAtTime(0, now, .008); try { o.s.stop(now + .03); } catch (e) {} }
    s.onended = () => { rec.n--; g.disconnect(); const j = live.indexOf(v); if (j >= 0) live.splice(j, 1); };
    return true;
  }
  // 循環音的來源：要用時才建，k 歸零 0.4 s 後停掉（lp 給遠處的警笛悶住）
  function rloop(name, bus = master) {
    const b = rec.loop[name]; if (!b) return null;
    const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = b; s.loop = true; g.gain.value = 0;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 20000;
    s.connect(f); f.connect(g); g.connect(bus); s.start(ac.currentTime, Math.random() * b.duration);
    return { s, g, f, idle: 0 };
  }
  function lset(L, k, dt, tc = .08) {
    if (!L) return L;
    L.g.gain.setTargetAtTime(k, ac.currentTime, tc);
    if (k > .002) { L.idle = 0; return L; }
    if ((L.idle += dt) < .4) return L;
    try { L.s.stop(); } catch (e) {} L.g.disconnect(); return null;
  }
  // 一段固定長度的循環音（遠處經過的警笛）：淡入、持續、淡出，到點停
  function rlong(name, dur, k, { bus = ambG, pan = 0, lp = 0 } = {}) {
    const b = rec.loop[name]; if (!b || !ac) return false;
    const t = ac.currentTime + .05, s = ac.createBufferSource(), g = ac.createGain(), p = ac.createStereoPanner(), f = ac.createBiquadFilter();
    s.buffer = b; s.loop = true; f.type = 'lowpass'; f.frequency.value = lp || 20000; p.pan.value = pan;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(k, t + dur * .3); g.gain.setValueAtTime(k, t + dur * .55); g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(f); f.connect(p); p.connect(g); g.connect(bus); s.start(t, Math.random() * b.duration); s.stop(t + dur + .02);
    s.onended = () => g.disconnect();
    return true;
  }
  const camD = (o) => (o && typeof o.x === 'number' ? Math.hypot(o.x - camera.position.x, o.z - camera.position.z) : 0);
  function outGain() { return st.muted || st.hidden && SET.muteBlur ? 0 : .8 * SET.vMaster * (st.duck ? .25 : 1); }
  function mix() {
    if (!ac) return;
    const t = ac.currentTime;
    out.gain.setTargetAtTime(outGain(), t, .05); master.gain.setTargetAtTime(SET.vSfx, t, .05);
    musicG.gain.setTargetAtTime(SET.vMusic, t, .05); ambG.gain.setTargetAtTime(SET.vAmb, t, .05);
    // 暫停選單打開時 step 不跑、update 不會被呼叫：甩尾、警笛、旋翼直接收掉（關掉選單後 update／loops 需要時再建）
    if (st.duck) {
      for (const k of ["skid", "wail", "yelp", "heli"]) if (st[k]) { const L = st[k]; st[k] = null; L.g.gain.setTargetAtTime(0, t, .02); try { L.s.stop(t + .1); } catch (e) {} }
      if (st.sir) { st.sir.g.gain.setTargetAtTime(0, t, .02); st.sir.hg.gain.setTargetAtTime(0, t, .02); }
    }
  }
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    // 匯流排（95-menu.js 的音量）：master 是音效，音樂（夜店、酒吧）與環境（雨、城市低頻）各一條，最後匯到 out 做總音量、靜音與暫停壓低
    out = ac.createGain(); out.gain.value = outGain();
    master = ac.createGain(); master.gain.value = SET.vSfx; musicG = ac.createGain(); musicG.gain.value = SET.vMusic; ambG = ac.createGain(); ambG.gain.value = SET.vAmb;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
    master.connect(out); musicG.connect(out); ambG.connect(out); out.connect(comp); comp.connect(ac.destination);
    noiseBuf = mkNoise();
    // 雨：兩層濾波噪音，一層沙沙聲、一層高頻的滴答
    rainF = ac.createBiquadFilter(); rainF.type = 'lowpass'; rainF.frequency.value = 7000;
    rainG = ac.createGain(); rainG.gain.value = 0;
    const r1 = noiseSrc(), hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 450;
    r1.connect(hp); hp.connect(rainF);
    const r2 = noiseSrc(), bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = .8;
    const r2g = ac.createGain(); r2g.gain.value = .5; r2.playbackRate.value = .7;
    r2.connect(bp); bp.connect(r2g); r2g.connect(rainF);
    rainF.connect(rainG); rainG.connect(ambG);
    r1.start(); r2.start();
    // 城市低頻
    const cb = brown(), cl = ac.createBiquadFilter(); cl.type = 'lowpass'; cl.frequency.value = 220;
    cityG = ac.createGain(); cityG.gain.value = 0;
    cb.connect(cl); cl.connect(cityG); cityG.connect(ambG); cb.start();
    // 甩尾
    const sk = noiseSrc(), skf = ac.createBiquadFilter(); skf.type = 'bandpass'; skf.frequency.value = 1150; skf.Q.value = 3;
    skidG = ac.createGain(); skidG.gain.value = 0; sk.connect(skf); skf.connect(skidG); skidG.connect(master); sk.start();
    // 音樂匯流排：牆外時用低通悶住
    clubF = ac.createBiquadFilter(); clubF.type = 'lowpass'; clubF.frequency.value = 300;
    clubBus = ac.createGain(); clubBus.gain.value = 0; clubBus.connect(clubF); clubF.connect(musicG);
    barF = ac.createBiquadFilter(); barF.type = 'lowpass'; barF.frequency.value = 800;
    barBus = ac.createGain(); barBus.gain.value = 0; barBus.connect(barF); barF.connect(musicG);
    st.clubT0 = ac.currentTime + .1; st.nextClub = st.clubT0; st.barT0 = ac.currentTime + .1; st.nextBar = st.barT0;
    sched = setInterval(schedule, 25);
    ambientLoop();
    recLoad();
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
    if (!ac || st.where !== 'out' || st.duck) return;   // 暫停選單開著時不放
    const t = ac.currentTime + .05;
    // 有錄音時：遠處的喇叭悶在低通後面，偶爾一台警車在幾條街外經過（6 s 淡入淡出，到點就停）
    if (Math.random() < .7 ? rplay('horn', { k: .1 + Math.random() * .08, lp: 900, pan: Math.random() * 1.6 - .8, bus: ambG }) : rlong('sirenWail', 6, .05, { pan: Math.random() * 1.6 - .8, lp: 1400 })) return;
    if (Math.random() < .7) {
      const f = 330 + Math.random() * 120, g = ac.createGain(), p = ac.createStereoPanner(); p.pan.value = Math.random() * 2 - 1;
      for (const k of [1, 1.26]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f * k; const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900; o.connect(fl); fl.connect(g); o.start(t); o.stop(t + .5); }
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.03, t + .02); g.gain.setValueAtTime(.03, t + .35); g.gain.exponentialRampToValueAtTime(0.0001, t + .5);
      g.connect(p); p.connect(ambG);
    } else {
      const o = ac.createOscillator(), g = ac.createGain(), p = ac.createStereoPanner(); p.pan.value = Math.random() * 2 - 1;
      o.type = 'triangle';
      for (let k = 0; k < 8; k++) { o.frequency.setValueAtTime(650, t + k * .7); o.frequency.linearRampToValueAtTime(1150, t + k * .7 + .35); o.frequency.linearRampToValueAtTime(650, t + k * .7 + .7); }
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.025, t + 1.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 5.6);
      o.connect(g); g.connect(p); p.connect(ambG); o.start(t); o.stop(t + 5.7);
    }
  }
  // 引擎錄音：汽車是 idle／low／med／high 四層轉速循環，依轉速交叉淡化、各層在自己的中心轉速附近變調；機車用機車怠速加高兩層的汽車錄音再調高
  const ENG_CAR = [['engIdle', .12, 1], ['engLow', .4, 1], ['engMed', .7, 1], ['engHigh', 1, 1]];
  const ENG_BIKE = [['bikeIdle', .12, 1], ['engMed', .55, 1.3], ['engHigh', 1, 1.35]];
  // 每台實車的引擎型式 → tools/sfx.mjs 的 ENG（每層 [錄音, 這段的基頻 Hz]）與看車對話裡的出處。
  // 沒列的用上面的通用錄音：RX-7（找不到可用授權的轉子引擎錄音）、哈雷的 V 型雙缸、搶來的車流車；電動車沒有引擎，用合成的馬達與逆變器聲
  const ENG_FAM = {
    bmw: ['e92 m3c m4wb m3gtr m3t24 m4gt3 e34 m4csl csl3 m5f90', 'BMW M6／M3 實錄 · Kinoton（CC0）、ikbenraar（CC BY 4.0）'],
    jdm6: ['supra r34 r35 nsx scg p9x8', '渦輪六缸底盤動力計實錄 · editboy23（CC0），怠速借 BMW M6 · Kinoton（CC0）'],
    flat6: ['gt3rs gt3r p930 rwb', 'Porsche 911 水平對臥六缸實錄 · jerry.berumen（CC BY 4.0）、mharo、mmplisskin（CC0）'],
    fer8: ['f40 sf90 p1 f8 f488c senna r8', 'Ferrari 360 V8 實錄 · PritzProductions（CC0）'],
    us8: ['chall charger police zr1 mosler c63dtm slk55 spano spano8 gt500 viper ramtrx g63 lc200 rr06', 'Dodge Challenger SRT V8 實錄 · JorisDJN（CC0）'],
    v12: ['svj sc20 c110 s65 ghost', 'Lamborghini Murciélago V12 實錄 · cheesepuff（CC0）'],
    i4: ['ae86 evo190 giulietta camry evo6', 'Alfa Romeo Brera 四缸實錄 · marksayer（CC0）'],
    bike4: ['s1krr s1krr19 zx6r v4 r6 z1000', 'Kawasaki ZX-6R／Ninja 四缸實錄 · Sclolex、Hurry_Joe33（CC0）'],
    ev: ['evija nevera energ', '電動車沒有引擎，馬達聲為即時合成'],
  };
  const ENG_OF = {}; for (const [k, [ids]] of Object.entries(ENG_FAM)) for (const id of ids.split(' ')) ENG_OF[id] = k;
  // 排氣管對引擎聲的影響：[音量, 音高]（66-chrome.js 的排氣管等級，sfx.exhaust 設定）
  const EXH = [[1, 1], [1.12, 1.05], [1.3, .97], [1.5, .92]];
  function startEngine(v, quiet) {
    if (!ac) return;
    if (eng) stopEngine(true);
    const fam = ENG_OF[v.carId];
    if (fam === 'ev') {
      // 電動車：馬達基頻（正弦）加 1.5 倍的逆變器嘯聲（三角波經帶通），音高跟車速走、不跟檔位；發動是兩聲提示音
      const o1 = ac.createOscillator(), o2 = ac.createOscillator(), bp = ac.createBiquadFilter(), g = ac.createGain();
      o1.type = 'sine'; o2.type = 'triangle'; bp.type = 'bandpass'; bp.Q.value = 2.5; g.gain.value = 0;
      o1.connect(g); o2.connect(bp); bp.connect(g); g.connect(master); o1.start(); o2.start();
      if (!quiet) { const t = ac.currentTime; tone(t, master, 'sine', 660, .03, .01, .16); tone(t + .12, master, 'sine', 990, .028, .01, .22); }
      eng = { ev: true, o1, o2, bp, g, car: true, v };
      return;
    }
    const fs = fam && rec.eng[fam];
    if (fs) {
      // 這一型的錄音：每層是一段穩定轉速的錄音（engMix 決定誰出聲、變調多少）
      const g = ac.createGain(); g.gain.value = 0; g.connect(master);
      const layers = fs.map(({ b, f }) => { const s = ac.createBufferSource(), lg = ac.createGain(); s.buffer = b; s.loop = true; lg.gain.value = 0; s.connect(lg); lg.connect(g); s.start(ac.currentTime, Math.random() * b.duration); return { s, lg, f }; });
      if (!quiet) rplay('engStart', { k: .45, rate: v.isCar ? 1 : 1.3 });
      g.gain.setTargetAtTime(1, ac.currentTime + (quiet ? 0 : .35), .12);
      eng = { rec: true, fam, top: fs[fs.length - 1].f * 1.35, g, layers, car: v.isCar, v };
      return;
    }
    if (fam) engLoad(fam);
    const set = v.isCar ? ENG_CAR : ENG_BIKE;
    if (set.every(([n]) => rec.loop[n])) {
      const g = ac.createGain(); g.gain.value = 0; g.connect(master);
      const layers = set.map(([n, c, m]) => { const s = ac.createBufferSource(), lg = ac.createGain(); s.buffer = rec.loop[n]; s.loop = true; lg.gain.value = 0; s.connect(lg); lg.connect(g); s.start(ac.currentTime, Math.random() * s.buffer.duration); return { s, lg, c, m }; });
      if (!quiet) rplay('engStart', { k: .45, rate: v.isCar ? 1 : 1.3 });
      g.gain.setTargetAtTime(1, ac.currentTime + (quiet ? 0 : .35), .12);
      eng = { rec: true, g, layers, car: v.isCar, v, want: fam };
      return;
    }
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), fl = ac.createBiquadFilter(), g = ac.createGain();
    o1.type = 'sawtooth'; o2.type = v.isCar ? 'square' : 'sawtooth'; fl.type = 'lowpass'; fl.frequency.value = 500; fl.Q.value = 2;
    g.gain.value = 0;
    o1.connect(fl); o2.connect(fl); fl.connect(g); g.connect(master); o1.start(); o2.start();
    eng = { o1, o2, fl, g, car: v.isCar, v, want: fam };
  }
  // 分型錄音的混音：轉速（怠速 0.12～紅線 1）指數對應到 [最低層的基頻, 最高層 ×1.35]，排氣管（pm）再整體升降音高；
  // 只有夾住目標基頻的兩層出聲（等功率交叉淡化），各自變調到目標音高。回傳每層 [權重, 播放速率]
  function engMix(rpm, pm = 1) {
    const Ls = eng.layers, F = Ls[0].f * Math.pow(eng.top / Ls[0].f, clamp((rpm - .12) / .88, 0, 1)) * pm;
    let j = 0; while (j < Ls.length - 1 && F > Ls[j + 1].f) j++;
    const u = j < Ls.length - 1 ? clamp(Math.log(F / Ls[j].f) / Math.log(Ls[j + 1].f / Ls[j].f), 0, 1) : 0;
    return Ls.map((L, i) => [i === j ? Math.cos(u * Math.PI / 2) : i === j + 1 ? Math.sin(u * Math.PI / 2) : 0, clamp(F / L.f, .4, 2.5)]);
  }
  // 熄火：錄音版 0.12 s 收掉、0.3 s 停來源，換車時（swap）不放熄火聲
  function stopEngine(swap) {
    if (!eng) return; const e = eng; eng = null; const t = ac.currentTime;
    if (e.rec) { e.g.gain.setTargetAtTime(0, t, .04); for (const L of e.layers) L.s.stop(t + .3); setTimeout(() => e.g.disconnect(), 400); if (!swap) rplay('engStop', { k: .35, rate: e.car ? 1 : 1.3 }); return; }
    e.g.gain.setTargetAtTime(0, t, .1); e.o1.stop(t + .5); e.o2.stop(t + .5);
  }
  return {
    init,
    get ready() { return !!ac; },
    // 驗收用：錄音解碼好了沒、有哪些、失敗的檔案、同時發聲數、哪些循環音的來源還開著
    get rec() { return { on: REC_ON, ready: rec.ready, one: Object.keys(rec.one), loop: Object.keys(rec.loop), fail: rec.fail.slice(), voices: rec.n, eng: eng ? (eng.ev ? "ev" : eng.rec ? "rec" : "synth") : null, fam: eng ? eng.fam || null : null, want: eng ? eng.want || null : null, engSets: { ...rec.engSt }, loops: ["skid", "wail", "yelp", "heli"].filter((k) => st[k]) }; },
    // 看車對話（65-motors.js）：這台車的引擎聲出處；沒有對應型式的回 null
    engCredit: (id) => (ENG_OF[id] ? '引擎聲：' + ENG_FAM[ENG_OF[id]][1] + (ENG_OF[id] === 'ev' ? '' : ' · Freesound') : null),
    // 驗收用：目前這台分型錄音的車在某個轉速下每層的 [基頻, 權重, 播放速率]
    engMix: (rpm) => (eng && eng.fam ? engMix(rpm).map(([w, r], i) => [eng.layers[i].f, +w.toFixed(3), +r.toFixed(3)]) : null),
    play: (name, o) => rplay(name, o),
    // 每段錄音的長度與 RMS（dB）：檢查裁切點沒有落在無聲的地方
    stats() { const db = (b) => { const y = b.getChannelData(0); let e = 0; for (let i = 0; i < y.length; i++) e += y[i] * y[i]; return +(10 * Math.log10(e / y.length + 1e-12)).toFixed(1); }; const o = {}; for (const [k, vs] of Object.entries(rec.one)) o[k] = vs.map((b) => [+b.duration.toFixed(2), db(b)]); for (const [k, b] of Object.entries(rec.loop)) o[k] = [[+b.duration.toFixed(2), db(b)]]; return o; },
    beat() { return (now() - (ac ? st.clubT0 : 0)) * CLUB_BPM / 60; },
    setMuted(m) { st.muted = m; mix(); },
    // 95-menu.js：音量滑桿、暫停時壓低（duck）、切到別的分頁時靜音（hidden）
    mix(o) { if (o) Object.assign(st, o); mix(); },
    get muted() { return st.muted; },
    update(dt, s) {
      if (!ac) return;
      const t = ac.currentTime;
      st.where = s.where; st.dClub = s.dClub; st.dBar = s.dBar;
      const out = s.where === 'out';
      rainG.gain.setTargetAtTime((out ? .42 : s.where === 'bar' ? .1 : .025) * s.rain, t, .3);   // 雨停了就安靜
      rainF.frequency.setTargetAtTime(out ? 7000 : 500, t, .2);
      cityG.gain.setTargetAtTime(out ? .14 : .02, t, .5);
      clubBus.gain.setTargetAtTime(s.where === 'club' ? .75 : out ? clamp(1 - s.dClub / 55, 0, 1) * .45 : 0, t, .25);
      clubF.frequency.setTargetAtTime(s.where === 'club' ? 16000 : 260 + clamp(1 - s.dClub / 20, 0, 1) * 500, t, .25);
      barBus.gain.setTargetAtTime(s.where === 'bar' ? .8 : out ? clamp(1 - s.dBar / 22, 0, 1) * .3 : 0, t, .25);
      barF.frequency.setTargetAtTime(s.where === 'bar' ? 9000 : 700, t, .25);
      if (eng && !eng.rec && !eng.ev && rec.ready && (eng.car ? ENG_CAR : ENG_BIKE).every(([n]) => rec.loop[n])) startEngine(eng.v, true);   // 上車時錄音還沒解碼完：解碼好就換掉合成引擎
      if (eng && eng.want) { engLoad(eng.want); if (rec.eng[eng.want]) startEngine(eng.v, true); }   // 這一型的轉速層下載好了就換上（下載失敗就一直用通用錄音）
      if (eng && eng.fam) {
        const X = EXH[st.exh || 0], vol = (.3 + s.thr * .2 + (s.nitro ? .08 : 0)) * X[0] * (s.eg ?? 1);
        engMix(s.rpm, X[1]).forEach(([w, rate], i) => { const L = eng.layers[i]; L.lg.gain.setTargetAtTime(w * vol, t, .06); L.s.playbackRate.setTargetAtTime(rate, t, .05); });
      } else if (eng && eng.rec) {
        const r = clamp(s.rpm, 0, 1), X = EXH[st.exh || 0], vol = (.3 + s.thr * .2 + (s.nitro ? .08 : 0)) * X[0] * (s.eg ?? 1);   // eg：68-vdetail.js 下車沒熄火的車，照距離變小聲
        for (const L of eng.layers) {
          const w = Math.max(0, 1 - Math.abs(r - L.c) / .3);
          L.lg.gain.setTargetAtTime(w * vol, t, .06);
          L.s.playbackRate.setTargetAtTime(clamp(1 + (r - L.c) * .9, .78, 1.4) * L.m * X[1], t, .05);
        }
      } else if (eng && eng.ev) {
        const v = eng.v, k = clamp(Math.hypot(v.vx || 0, v.vz || 0) / (v.vmax || 80), 0, 1), f = 120 + k * 1700;
        eng.o1.frequency.setTargetAtTime(f, t, .08); eng.o2.frequency.setTargetAtTime(f * 1.5, t, .08); eng.bp.frequency.setTargetAtTime(f * 1.5, t, .08);
        eng.g.gain.setTargetAtTime((.008 + s.thr * .035 * (.3 + k) + k * .012) * (s.eg ?? 1), t, .1);
      } else if (eng) {
        const base = eng.car ? 38 : 52, f = base + s.rpm * (eng.car ? 120 : 160) * (1 + s.gear * .06);
        eng.o1.frequency.setTargetAtTime(f, t, .05); eng.o2.frequency.setTargetAtTime(f * (eng.car ? .5 : 1.01), t, .05);
        eng.fl.frequency.setTargetAtTime(300 + s.thr * 1400 + s.rpm * 900, t, .06);
        eng.g.gain.setTargetAtTime((.05 + s.thr * .07 + s.rpm * .04 + (s.nitro ? .04 : 0)) * EXH[st.exh || 0][0] * (s.eg ?? 1), t, .08);
      }
      // loops() 只在戶外由 policeUpdate 呼叫：進室內或停止呼叫超過 0.25 s，警笛與旋翼照樣收掉
      if (t - (st.loopT || 0) > .25) {
        st.wail = lset(st.wail, 0, dt, .05); st.yelp = lset(st.yelp, 0, dt, .05); st.heli = lset(st.heli, 0, dt, .05);
        if (st.sir) { st.sir.g.gain.setTargetAtTime(0, t, .05); st.sir.hg.gain.setTargetAtTime(0, t, .05); }
      }
      // 甩尾：錄音的輪胎尖叫循環，滑移停了 0.4 s 內就停掉來源；音高隨滑移量略升
      const sk = clamp((s.slip - 2.5) / 6, 0, 1);
      if (rec.loop.skid) {
        skidG.gain.setTargetAtTime(0, t, .05);
        if (sk > 0 && !st.skid) st.skid = rloop('skid');
        if (st.skid) { st.skid.s.playbackRate.setTargetAtTime(.9 + sk * .25, t, .1); st.skid = lset(st.skid, sk * .5, dt, .04); }
      } else skidG.gain.setTargetAtTime(sk * .16, t, .05);
    },
    engineOn(v) { startEngine(v); },
    // 66-chrome.js 的排氣管：0 原廠、1 鈦合金雙出（亮一點）、2 側排管（大聲）、3 直通管（最大聲、低沉）
    exhaust(n) { st.exh = n | 0; },
    // 回火：幾聲短促的爆裂（直通管幾乎每次放油門都有）
    pop(k = 1) { if (!ac) return; const t = ac.currentTime; for (let i = 0; i < 2 + (k * 3 | 0); i++) { const d = i * (.05 + Math.random() * .06); nz(t + d, master, 'bandpass', 700 + Math.random() * 900, 1.2, .22 * k, .05); tone(t + d, master, 'sine', 70 + Math.random() * 30, .12 * k, .002, .06); } },
    // 渦輪洩壓閥：高頻的「啾——」口哨加上一陣氣聲
    bov() { if (!ac) return; const t = ac.currentTime; const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(2900, t); o.frequency.exponentialRampToValueAtTime(1500, t + .32); env(g, t, .01, .05, .32); o.connect(g); g.connect(master); o.start(t); o.stop(t + .4); nz(t, master, 'bandpass', 2600, 1.4, .12, .35); },
    // 改裝喇叭：0 原廠、1 氣動喇叭（低沉雙音）、2 音樂喇叭（一段旋律）、3 警笛喇叭（短促 yelp）
    hornT(n) {
      if (!ac) return; const t = ac.currentTime;
      if (!n) { this.horn(); return; }
      if (n === 1) { for (const f of [185, 233]) tone(t, master, 'square', f, .05, .02, .9, 900, 700); return; }
      if (n === 2) { [392, 523, 659, 784, 659, 784].forEach((f, i) => tone(t + i * .13, master, 'square', f, .04, .005, .14, 1800)); return; }
      const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(650, t);
      for (let i = 0; i < 3; i++) { o.frequency.linearRampToValueAtTime(1500, t + i * .22 + .11); o.frequency.linearRampToValueAtTime(650, t + i * .22 + .22); }
      env(g, t, .01, .05, .66); const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 2400; o.connect(fl); fl.connect(g); g.connect(master); o.start(t); o.stop(t + .7);
    },
    // 氣壓閥「嘶——」：捲門、液壓
    hiss(k = 1) { if (!ac) return; const t = ac.currentTime; nz(t, master, 'highpass', 3200, .6, .12 * k, .45); tone(t + .38, master, 'sine', 90, .08 * k, .002, .1); },
    // 炸彈的急促嗶嗶聲（0.5 秒）
    bombBeep() { if (!ac) return; const t = ac.currentTime; for (let i = 0; i < 5; i++) tone(t + i * .1, master, 'square', 2200, .05, .001, .05); },
    engineOff() { stopEngine(); },
    step(run, indoor) { if (!ac) return; if (rplay('step', { k: run ? .3 : .2, lp: indoor ? 2400 : 0, rate: run ? 1.05 : 1 })) return; const t = ac.currentTime; nz(t, master, 'bandpass', indoor ? 600 : 1400, 1, run ? .1 : .06, indoor ? .06 : .09); if (!indoor) nz(t + .01, master, 'highpass', 4000, .5, .03, .12); },
    // 北嶺鐵道橋的列車（21-rail.js）：兩音的電聯車汽笛；行駛聲是一條一直開著的低頻噪音，k 是遠近（0 關掉）、clack 是過軌縫的節奏
    trainHorn(k) { if (!ac || !(k > .01)) return; if (rplay('trainHorn', { k: .6 * k })) return; const t = ac.currentTime, g = ac.createGain(); for (const [f, d] of [[311, 0], [392, 0], [311, .55], [392, .55]]) { const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = f; const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1100; o.connect(fl); fl.connect(g); o.start(t + d); o.stop(t + d + .42); } g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.05 * k, t + .04); g.gain.setValueAtTime(.05 * k, t + .9); g.gain.exponentialRampToValueAtTime(.0001, t + 1.05); g.connect(master); },
    trainRun(k, clack) {
      if (!ac) return;
      if (!st.train) { const b = brown(), f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260; const g = ac.createGain(); g.gain.value = 0; b.connect(f); f.connect(g); g.connect(master); b.start(); st.train = { g, f, last: 0 }; }
      const t = ac.currentTime; st.train.g.gain.setTargetAtTime(.22 * k, t, .25); st.train.f.frequency.setTargetAtTime(180 + 260 * k, t, .3);
      if (clack && k > .05 && t - st.train.last > .08) { st.train.last = t; nz(t, master, 'bandpass', 900, 2, .05 * k, .06); nz(t + .11, master, 'bandpass', 760, 2, .04 * k, .06); }
    },
    // 喇叭依離鏡頭的距離衰減，遠的悶一點
    horn(c) { if (!ac) return; const hd = camD(c); if (rplay('horn', { k: .5 * clamp(1 - hd / 110, .08, 1), lp: hd > 35 ? 2200 : 0 })) return; const t = ac.currentTime; const g = ac.createGain(); for (const k of [1, 1.25]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 370 * k; const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1400; o.connect(fl); fl.connect(g); o.start(t); o.stop(t + .45); } g.gain.setValueAtTime(.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + .45); g.connect(master); },
    // 碰撞：kind 'body'＝人撞到東西或摔落（肉身悶響，重的再加倒地聲）、'ped'＝車撞人（肉身＋車身）；沒給 kind 是車／物件的金屬碰撞，k ≥ 9 用重撞、≥ 16 加碎玻璃
    impact(k, kind) {
      if (!ac) return;
      if (kind) { if (rplay('body', { k: clamp(k / 9, .3, 1) })) { if (kind === 'ped') rplay('bump', { k: clamp(k / 14, .2, .6) }); if (k > 9) rplay('bodyfall', { k: .55 }); return; } }
      else if (rplay(k >= 9 ? 'crash' : 'bump', { k: clamp(k / (k >= 9 ? 18 : 8), .12, 1) })) { if (k >= 16) rplay('glass', { k: .35 }); return; }
      const t = ac.currentTime; nz(t, master, 'lowpass', 500, 1, clamp(k / 12, .05, .5), .3); kick(t, master);
    },
    splash(k = 1) { if (!ac) return; if (rplay('splash', { k: .25 + .55 * k, rate: 1.15 - .25 * k })) return; const t = ac.currentTime; nz(t, master, 'lowpass', 900 + 900 * k, .7, .05 + .2 * k, .25 + .45 * k); nz(t + .03, master, 'highpass', 2600, .6, .03 + .07 * k, .2 + .3 * k); },
    door() { if (!ac) return; if (rplay('door', { k: .6 })) return; const t = ac.currentTime; nz(t, master, 'lowpass', 300, 1, .2, .25); tone(t + .05, master, 'sine', 90, .2, .005, .2); },
    doorCar(car) { if (!ac) return; if (rplay('doorCar', { k: .6, rate: car ? 1 : 1.25 })) return; const t = ac.currentTime; nz(t, master, 'lowpass', car ? 700 : 1500, 1, .15, .12); },
    click() { if (!ac) return; tone(ac.currentTime, master, 'sine', 880, .05, .002, .06); },
    rope() { if (!ac) return; const t = ac.currentTime; tone(t, master, 'triangle', 660, .06, .005, .3); tone(t + .12, master, 'triangle', 990, .05, .005, .4); },
    pickup() { if (!ac) return; const t = ac.currentTime; [784, 988, 1175].forEach((f, i) => tone(t + i * .08, master, 'sine', f, .06, .005, .3)); },
    glass() { if (!ac) return; const t = ac.currentTime; tone(t, master, 'sine', 2400, .05, .002, .5); tone(t + .02, master, 'sine', 3150, .03, .002, .4); },
    spray() { if (!ac) return; nz(ac.currentTime, master, 'highpass', 3000, .5, .1, .7); },
    // 68-gta.js：槍聲（尖峰＋低頻＋街道回音）、爆炸（依距離）、碎玻璃、空膛、換彈、出拳
    shot() { if (!ac) return; if (rplay('pistol', { k: .7 })) return; const t = ac.currentTime; nz(t, master, 'highpass', 1400, .7, .55, .09); nz(t, master, 'lowpass', 900, .8, .3, .45); const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(48, t + .12); env(g, t, .001, .6, .16); o.connect(g); g.connect(master); o.start(t); o.stop(t + .2); nz(t + .14, master, 'bandpass', 700, .6, .06, .5); },
    // 爆炸：聲音照距離延遲到達、遠的衰減並悶住；錄音裁在 2 s 內淡完，不留長尾
    boom(d = 0) { if (!ac) return; const t = ac.currentTime + d / 340, k = clamp(1 - d / 140, .12, 1); if (rplay('explode', { k: .95 * k, t: d > 3 ? t : 0, lp: d > 40 ? 500 + 3000 * k : 0, rate: .95 })) return; const s = noiseSrc(false), fl = ac.createBiquadFilter(), g = ac.createGain(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(900, t); fl.frequency.exponentialRampToValueAtTime(90, t + 1.6); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.9 * k, t + .02); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8); s.playbackRate.value = .6; s.connect(fl); fl.connect(g); g.connect(master); s.start(t); s.stop(t + 3); const o = ac.createOscillator(), og = ac.createGain(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(28, t + .6); env(og, t, .004, .9 * k, .8); o.connect(og); og.connect(master); o.start(t); o.stop(t + 1); for (let i = 0; i < 6; i++) nz(t + .2 + Math.random() * 1.2, master, 'bandpass', 500 + Math.random() * 900, 1, .08 * k, .15); },
    glassBreak() { if (!ac) return; if (rplay('glass', { k: .55 })) return; const t = ac.currentTime; nz(t, master, 'highpass', 2500, .7, .35, .3); for (let i = 0; i < 7; i++) tone(t + Math.random() * .25, master, 'sine', 2600 + Math.random() * 3800, .05, .001, .15 + Math.random() * .2); },
    zap() { if (!ac) return; const t = ac.currentTime; for (let i = 0; i < 5; i++) tone(t + i * .045, master, 'sawtooth', 1100 + i * 170, .07, .002, .04); nz(t, master, 'highpass', 4200, 1, .16, .25); },
    dry() { if (!ac) return; if (rplay('dry', { k: .5 })) return; tone(ac.currentTime, master, 'square', 1900, .04, .001, .03); },
    reload() { if (!ac) return; if (rplay('reload', { k: .55 })) return; const t = ac.currentTime; nz(t, master, 'bandpass', 2400, 2, .12, .05); tone(t + .02, master, 'square', 900, .03, .001, .04); nz(t + .75, master, 'bandpass', 1800, 2, .16, .06); tone(t + .78, master, 'square', 1300, .04, .001, .05); },
    punch() { if (!ac) return; if (rplay('punch', { k: .85 })) return; const t = ac.currentTime; nz(t, master, 'lowpass', 420, 1, .35, .14); tone(t, master, 'sine', 95, .3, .002, .12); },
    whoosh() { if (!ac) return; const t = ac.currentTime; const s = noiseSrc(false), fl = ac.createBiquadFilter(), g = ac.createGain(); fl.type = 'bandpass'; fl.Q.value = 2; fl.frequency.setValueAtTime(1400, t); fl.frequency.exponentialRampToValueAtTime(350, t + .2); env(g, t, .02, .12, .2); s.connect(fl); fl.connect(g); g.connect(master); s.start(t); s.stop(t + .3); },
    thunder(d) { if (!ac) return; if (rplay('thunder', { k: .7, t: ac.currentTime + d, bus: ambG, lp: 2500 })) return; const t = ac.currentTime + d; const s = noiseSrc(false), fl = ac.createBiquadFilter(), g = ac.createGain(); fl.type = 'lowpass'; fl.frequency.value = 160; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.5, t + .15); g.gain.exponentialRampToValueAtTime(0.0001, t + 4); s.playbackRate.value = .5; s.connect(fl); fl.connect(g); g.connect(ambG); s.start(t); s.stop(t + 4.2); },
    // 69-combat.js／69-police.js：各種槍聲（k 音量、f 音色：1 手槍、.7 衝鋒槍、1.3 步槍、2 霰彈、2.6 狙擊、.5 機槍）、火箭、受傷、WASTED／BUSTED
    gun(k = 1, f = 1) {
      if (!ac || k < .02) return;
      // 錄音：f 對到槍種（.3 以下是消音器），遠處的槍聲（k 小）悶在低通後面
      const kind = f <= .35 ? 'silenced' : f >= 2.4 ? 'sniper' : f >= 1.8 ? 'shotgun' : f >= 1.15 ? 'rifle' : f <= .55 ? 'rifle' : f <= .8 ? 'smg' : 'pistol';
      if (rplay(kind, { k: (kind === 'silenced' ? 2.6 : .75) * k, rate: f <= .55 && kind === 'rifle' ? 1.08 : 1, lp: k < .6 ? 1200 + k * 7000 : 0 })) return;
      const t = ac.currentTime, lo = f >= 2 ? 1.6 : 1;
      nz(t, master, 'highpass', 1600 / lo, .7, .5 * k, .05 + f * .025); nz(t, master, 'lowpass', 1100 / lo, .8, .32 * k, .2 + f * .14);
      const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(160 / lo, t); o.frequency.exponentialRampToValueAtTime(44, t + .1 + f * .03); env(g, t, .001, .55 * k * Math.min(1.4, f), .12 + f * .05); o.connect(g); g.connect(master); o.start(t); o.stop(t + .4);
      if (f >= 1) nz(t + .12, master, 'bandpass', 500, .6, .12 * k * f, .5 + f * .35);   // 街道回音
    },
    launch() { if (!ac) return; if (rplay('rocket', { k: .7 })) return; const t = ac.currentTime; nz(t, master, 'lowpass', 600, .7, .45, .35); const s = noiseSrc(false), fl = ac.createBiquadFilter(), g = ac.createGain(); fl.type = 'bandpass'; fl.Q.value = 1.5; fl.frequency.setValueAtTime(2200, t); fl.frequency.exponentialRampToValueAtTime(600, t + .9); env(g, t, .01, .25, .9); s.connect(fl); fl.connect(g); g.connect(master); s.start(t); s.stop(t + 1); },
    hurt() { if (!ac) return; if (rplay('body', { k: .75, rate: .9 })) return; const t = ac.currentTime; tone(t, master, 'sine', 70, .45, .002, .18); nz(t, master, 'lowpass', 300, 1, .2, .1); },
    // 69-combat.js 的 hitWith：子彈打中人（肉身悶響）、車與直升機（金屬，偶爾跳彈）、地面與牆（偶爾跳彈）；60 m 外聽不到，只有錄音版（合成音時照舊無聲）
    bulletHit(kind, x, z) {
      if (!ac || !kind || kind === 'prop') return;
      const k = clamp(1 - Math.hypot(x - camera.position.x, z - camera.position.z) / 60, 0, 1); if (k < .05) return;
      if (/^(ped|cop|fighter|extra|fn)$/.test(kind)) rplay('body', { k: .4 * k, rate: 1.25 });
      else if (/^(car|veh|heli|rap|ebox)$/.test(kind)) { rplay('bump', { k: .28 * k, rate: 1.5 }); if (Math.random() < .3) rplay('ricochet', { k: .2 * k }); }
      else if (Math.random() < .25) rplay('ricochet', { k: .15 * k, lp: 6000 });
    },
    bounce() { if (!ac) return; if (rplay('ricochet', { k: .18, rate: 1.3, lp: 5000 })) return; const t = ac.currentTime; tone(t, master, 'triangle', 1500 + Math.random() * 400, .05, .001, .06); },
    beep() { if (!ac) return; tone(ac.currentTime, master, 'square', 1760, .03, .001, .05); },
    wasted() { if (!ac) return; const t = ac.currentTime; kick(t, master); tone(t, master, 'sine', 196, .25, .01, 2.2, 900, 120); tone(t + .05, master, 'sine', 98, .3, .01, 2.6); },
    // 69-crew.js：特殊能力啟動（低頻下沉＋心跳般的悶響）與關閉、切換角色時往上衝的風聲
    ability(on) { if (!ac) return; const t = ac.currentTime; if (on) { kick(t, master); tone(t, master, 'sine', 220, .22, .01, .9, 1800, 160); nz(t, master, 'lowpass', 900, .7, .18, .7); } else tone(t, master, 'sine', 110, .16, .01, .45, 300, 1600); },
    swoosh(up) { if (!ac) return; const t = ac.currentTime; const s = noiseSrc(false), fl = ac.createBiquadFilter(), g = ac.createGain(); fl.type = 'bandpass'; fl.Q.value = 1.2; fl.frequency.setValueAtTime(up ? 300 : 2200, t); fl.frequency.exponentialRampToValueAtTime(up ? 2400 : 260, t + .9); env(g, t, .25, .3, .7); s.connect(fl); fl.connect(g); g.connect(master); s.start(t); s.stop(t + 1.1); },
    busted() { if (!ac) return; const t = ac.currentTime; for (const d of [0, .32]) { kick(t + d, master); tone(t + d, master, 'square', 130, .07, .005, .25, 700, 200); } },
    // 持續音：警笛（n 台、最近的距離）與直升機旋翼（距離），每幀更新
    loops(siren, sd, heli, hd) {
      if (!ac) return;
      const t = ac.currentTime, lt = st.loopT || t; st.loopT = t;
      // 錄音：遠處是 wail、30 m 內換成 yelp（交叉淡化），遠的警笛悶住；沒有警車或直升機時 0.4 s 內停掉來源
      if (rec.loop.sirenWail && rec.loop.sirenYelp && rec.loop.heli) {
        const dt = Math.min(.1, t - lt);
        const k = siren ? clamp(1 - sd / 160, 0, 1) ** 2 * .5 : 0, y = clamp((40 - sd) / 15, 0, 1);
        if (k * (1 - y) > 0 && !st.wail) st.wail = rloop('sirenWail');
        if (k * y > 0 && !st.yelp) st.yelp = rloop('sirenYelp');
        if (st.wail) st.wail.f.frequency.setTargetAtTime(1500 + 14000 * k, t, .2);
        st.wail = lset(st.wail, k * (1 - y), dt, .12); st.yelp = lset(st.yelp, k * y, dt, .12);
        const hk = heli ? clamp(1 - hd / 220, 0, 1) ** 1.5 * .8 : 0;
        if (hk > 0 && !st.heli) st.heli = rloop('heli');
        if (st.heli) st.heli.f.frequency.setTargetAtTime(600 + 12000 * hk, t, .2);
        st.heli = lset(st.heli, hk, dt, .2);
        if (st.sir) { st.sir.g.gain.setTargetAtTime(0, t, .05); st.sir.hg.gain.setTargetAtTime(0, t, .05); }
        return;
      }
      if (!st.sir) {
        const g = ac.createGain(); g.gain.value = 0; const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 2400; g.connect(fl); fl.connect(master);
        const o = ac.createOscillator(); o.type = 'sawtooth'; const o2 = ac.createOscillator(); o2.type = 'square'; o2.detune.value = 9;
        const og = ac.createGain(); og.gain.value = .5; o.connect(g); o2.connect(og); og.connect(g); o.start(); o2.start();
        const hg = ac.createGain(); hg.gain.value = 0; const hs = brown(), hf = ac.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 260;
        const am = ac.createGain(); am.gain.value = 0; const lfo = ac.createOscillator(); lfo.frequency.value = 17; const lg = ac.createGain(); lg.gain.value = .9; lfo.connect(lg); lg.connect(am.gain); lfo.start();
        hs.connect(hf); hf.connect(am); am.connect(hg); hg.connect(master); hs.start();
        st.sir = { g, o, o2, hg };
      }
      const S = st.sir, k = siren ? clamp(1 - sd / 160, 0, 1) : 0;
      // 兩段式：慢速上下滑的 wail，近距離改成急促的 yelp
      const ph = (t * (sd < 30 ? 3.2 : .55)) % 1, f = 620 + 560 * (sd < 30 ? (ph < .5 ? ph * 2 : 2 - ph * 2) : Math.sin(ph * Math.PI));
      S.o.frequency.setTargetAtTime(f, t, .02); S.o2.frequency.setTargetAtTime(f * 1.005, t, .02);
      S.g.gain.setTargetAtTime(k * k * .09, t, .1);
      S.hg.gain.setTargetAtTime(heli ? clamp(1 - hd / 220, 0, 1) ** 1.5 * .55 : 0, t, .2);
    },
  };
})();
