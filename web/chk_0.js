
(function(){
  const $ = s => document.querySelector(s);
  const cv = $('#crt'), tube = $('#tube'), knobsEl = $('#knobs'), presetsEl = $('#presets');
  if (!cv || !tube || !knobsEl || !presetsEl) return;
  const ctx = cv.getContext('2d'); if (!ctx) return;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // graticule
  const g = $('#grat');
  if (g){
    let s = '';
    for (let i = 1; i < 10; i++){ const p = i*10; s += `<line x1="${p}" y1="0" x2="${p}" y2="100" ${i===5?'stroke-opacity=".75"':''}/><line x1="0" y1="${p}" x2="100" y2="${p}" ${i===5?'stroke-opacity=".75"':''}/>`; }
    for (let i = 1; i < 50; i++){ const p = i*2; if (p % 10) s += `<line x1="${p}" y1="49" x2="${p}" y2="51"/><line x1="49" y1="${p}" x2="51" y2="${p}"/>`; }
    g.innerHTML = s;
  }

  const S = {fx: 2, fy: 3, phase: 90, amp: 80, persist: 82, base: 110, tri: false, drift: true, audio: false};
  const KN = [
    {k:'fx', l:'Freq X', min:1, max:9, step:1, fmt:v => '×' + v},
    {k:'fy', l:'Freq Y', min:1, max:9, step:1, fmt:v => '×' + v},
    {k:'phase', l:'Phase', min:0, max:360, step:5, fmt:v => Math.round(v) + '°'},
    {k:'amp', l:'Gain', min:10, max:100, step:2, fmt:v => Math.round(v) + '%'},
    {k:'persist', l:'Persist', min:20, max:97, step:1, fmt:v => Math.round(v)},
    {k:'base', l:'Base', min:55, max:330, step:5, fmt:v => Math.round(v) + ' Hz'}
  ];
  const kUpd = {};
  KN.forEach(k => {
    const w = document.createElement('div'); w.className = 'kn';
    let ticks = ''; for (let i = 0; i <= 10; i++){ const a = (-135 + i*27) * Math.PI/180; ticks += `<line x1="${50 + 40*Math.sin(a)}" y1="${50 - 40*Math.cos(a)}" x2="${50 + (i%5?44:47)*Math.sin(a)}" y2="${50 - (i%5?44:47)*Math.cos(a)}" stroke="#9fb0ac" stroke-width="${i%5?1:1.8}"/>`; }
    w.innerHTML = `<div class="dial"><svg class="scale" viewBox="0 0 100 100" aria-hidden="true">${ticks}</svg><button class="knob" role="slider" aria-label="${k.l}" aria-valuemin="${k.min}" aria-valuemax="${k.max}"></button></div><label>${k.l}</label><output></output>`;
    knobsEl.appendChild(w);
    const kb = w.querySelector('.knob'), out = w.querySelector('output');
    const upd = () => { const v = S[k.k], t = (v - k.min)/(k.max - k.min); kb.style.setProperty('--a', (-135 + t*270) + 'deg'); out.textContent = k.fmt(v); kb.setAttribute('aria-valuenow', String(v)); };
    kUpd[k.k] = upd;
    let acc = 0, drag = null;
    const set = v => { const nv = Math.min(k.max, Math.max(k.min, Math.round(v / k.step) * k.step)); if (nv !== S[k.k]){ S[k.k] = nv; upd(); changed(k.k); } };
    kb.addEventListener('pointerdown', e => { drag = e.clientY; acc = S[k.k]; try { kb.setPointerCapture(e.pointerId); } catch(_){} e.preventDefault(); });
    kb.addEventListener('pointermove', e => { if (drag === null) return; acc += (drag - e.clientY) * (k.max - k.min) / 200; drag = e.clientY; set(acc); });
    const end = () => { drag = null; }; kb.addEventListener('pointerup', end); kb.addEventListener('pointercancel', end);
    kb.addEventListener('wheel', e => { e.preventDefault(); set(S[k.k] - Math.sign(e.deltaY) * k.step); }, {passive:false});
    kb.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight'){ e.preventDefault(); e.stopPropagation(); set(S[k.k] + k.step); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft'){ e.preventDefault(); e.stopPropagation(); set(S[k.k] - k.step); }
    });
    upd();
  });

  const PRE = [[1,1,90],[1,2,0],[2,3,90],[3,4,45],[3,2,0],[5,4,90],[4,5,30],[5,6,60]];
  const pBtns = PRE.map((p, i) => {
    const b = document.createElement('button'); b.className = 'pb'; b.textContent = p[0] + ':' + p[1];
    b.setAttribute('aria-label', `preset ${p[0]} to ${p[1]}, phase ${p[2]} degrees`);
    b.addEventListener('click', () => preset(i));
    presetsEl.appendChild(b); return b;
  });
  function preset(i){
    const p = PRE[i]; S.fx = p[0]; S.fy = p[1]; S.phase = p[2]; drift = 0;
    ['fx','fy','phase'].forEach(k => kUpd[k] && kUpd[k]());
    pBtns.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
    changed('preset');
  }
  function readouts(){
    const set = (id, t) => { const el = $(id); if (el) el.textContent = t; };
    const gcd = (a, b) => b ? gcd(b, a % b) : a, d = gcd(S.fx, S.fy);
    set('#rx', (S.base*S.fx).toFixed(1) + ' Hz'); set('#ry', (S.base*S.fy).toFixed(1) + ' Hz');
    set('#rr', (S.fx/d) + ' : ' + (S.fy/d)); set('#rp', Math.round((S.phase + drift*180/Math.PI) % 360) + '°');
  }
  function changed(k){
    if (k !== 'amp' && k !== 'persist') pBtns.forEach((b, j) => b.setAttribute('aria-pressed', String(PRE[j][0] === S.fx && PRE[j][1] === S.fy && PRE[j][2] === S.phase)));
    // fx / fy / preset change the X:Y phase relation, so the oscillators restart aligned; other knobs just retune
    if (k === 'fx' || k === 'fy' || k === 'preset') restartOsc(); else syncAudio();
    readouts();
    if (reduce && W) still();
  }

  // ---------- audio ----------
  let ac = null, ox = null, oy = null, gain = null, merger = null;
  function wave(ph){ // PeriodicWave with a phase offset (radians); triangle uses odd harmonics
    const N = S.tri ? 16 : 2, re = new Float32Array(N), im = new Float32Array(N);
    for (let n = 1; n < N; n++){
      let a = 0;
      if (!S.tri) a = n === 1 ? 1 : 0;
      else if (n % 2) a = (8/(Math.PI*Math.PI)) * ((((n-1)/2) % 2) ? -1 : 1) / (n*n);
      re[n] = a * Math.sin(n*ph); im[n] = a * Math.cos(n*ph);
    }
    return ac.createPeriodicWave(re, im, {disableNormalization: true});
  }
  function startAudio(){
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      merger = ac.createChannelMerger(2);
      gain = ac.createGain(); gain.gain.value = 0;
      merger.connect(gain).connect(ac.destination);
      startOsc(ac.currentTime + .03);
      drift = 0; // screen and oscillators both start from S.phase
      gain.gain.setTargetAtTime(.12 * S.amp/100, ac.currentTime, .05);
    } catch(e){ ac = null; S.audio = false; }
  }
  function startOsc(at){
    ox = ac.createOscillator(); oy = ac.createOscillator();
    ox.connect(merger, 0, 0); oy.connect(merger, 0, 1);
    syncAudio(true);
    ox.start(at); oy.start(at);
  }
  // a new ratio restarts both oscillators in phase and resets the on-screen drift,
  // so what you hear keeps matching the figure (a quick gain dip hides the restart click)
  function restartOsc(){
    if (!ac || !ox || !oy || !gain) return;
    const now = ac.currentTime, at = now + .03, x = ox, y = oy;
    gain.gain.setTargetAtTime(0, now, .006);
    try { x.stop(at); y.stop(at); } catch(e){}
    startOsc(at);
    gain.gain.setTargetAtTime(.12 * S.amp/100, at, .02);
    drift = 0;
  }
  function stopAudio(){
    if (!ac || !gain) return;
    const g0 = gain, x = ox, y = oy; g0.gain.setTargetAtTime(0, ac.currentTime, .03);
    setTimeout(() => { try { x.stop(); y.stop(); } catch(e){} }, 200);
    ox = oy = gain = null;
  }
  function syncAudio(init){
    if (!ac || !ox || !oy) return;
    const t = ac.currentTime;
    const detune = S.drift ? .12/(2*Math.PI) : 0; // Hz — lets the figure rotate slowly, audibly beating
    ox.frequency.setTargetAtTime(S.base*S.fx + detune, t, init ? 0 : .02);
    oy.frequency.setTargetAtTime(S.base*S.fy, t, init ? 0 : .02);
    try { ox.setPeriodicWave(wave(S.phase*Math.PI/180)); oy.setPeriodicWave(wave(0)); } catch(e){}
    if (gain && !init) gain.gain.setTargetAtTime(.12 * S.amp/100, t, .05);
  }
  const bind = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', () => fn(el)); };
  function toggleAudio(){
    S.audio = !S.audio; const el = $('#snd'); if (el) el.setAttribute('aria-pressed', String(S.audio));
    const lamp = $('#lamp'), lbl = $('#snd-lbl');
    if (S.audio){ startAudio(); } else stopAudio();
    if (lamp) lamp.classList.toggle('off', !S.audio); if (lbl) lbl.textContent = S.audio ? 'audio on' : 'audio off';
  }
  bind('#snd', toggleAudio);
  bind('#wave', el => { S.tri = !S.tri; el.setAttribute('aria-pressed', String(S.tri)); syncAudio(); });
  bind('#drift', el => { S.drift = !S.drift; el.setAttribute('aria-pressed', String(S.drift)); syncAudio(); });
  document.addEventListener('keydown', e => {
    if (e.target && e.target.classList && e.target.classList.contains('knob') && e.key.startsWith('Arrow')) return;
    if (/^[1-8]$/.test(e.key)) preset(+e.key - 1);
    else if (e.key === 's' || e.key === 'S') toggleAudio();
  });

  // ---------- CRT ----------
  let W = 0, dpr = 1, T = 0, drift = 0, last = performance.now(), lastRead = 0;
  function size(){ const r = tube.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1); W = r.width; cv.width = Math.round(W*dpr); cv.height = Math.round(W*dpr); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.fillStyle = '#021010'; ctx.fillRect(0,0,W,W); }
  const tri = x => { const p = ((x/(2*Math.PI)) % 1 + 1) % 1; return p < .25 ? p*4 : p < .75 ? 2 - p*4 : p*4 - 4; };
  const f = x => S.tri ? tri(x) : Math.sin(x);
  function pt(t){ const A = S.amp/100 * W*.42, ph = S.phase*Math.PI/180 + drift; return [W/2 + A*f(S.fx*t + ph), W/2 - A*f(S.fy*t)]; }
  function frame(now){
    const dt = Math.min(.1, (now - last)/1000); last = now;
    if (S.drift) drift += dt * .12;
    // phosphor fade
    ctx.globalCompositeOperation = 'source-over';
    const tau = .04 + Math.pow(S.persist/100, 3) * 1.6; ctx.fillStyle = `rgba(2,16,16,${(1 - Math.exp(-dt/tau)).toFixed(4)})`; ctx.fillRect(0,0,W,W);
    // beam
    const speed = 2*Math.PI * 2.6; const t0 = T, t1 = T + speed*dt; T = t1 % (2*Math.PI*1000);
    const N = Math.max(120, Math.round(900*dt*10));
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [w, a] of [[6, .06], [2.6, .22], [1.1, .85]]){
      ctx.strokeStyle = `rgba(98,255,240,${a})`; ctx.lineWidth = w; ctx.beginPath();
      for (let i = 0; i <= N; i++){ const [x, y] = pt(t0 + (t1 - t0)*i/N); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
    const [bx, by] = pt(t1);
    const gr = ctx.createRadialGradient(bx, by, 0, bx, by, 9); gr.addColorStop(0, 'rgba(230,255,252,.35)'); gr.addColorStop(1, 'rgba(98,255,240,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(bx, by, 9, 0, 6.3); ctx.fill();
    if (now - lastRead > 250){ lastRead = now; readouts(); }
    raf = (!document.hidden) ? requestAnimationFrame(frame) : 0;
  }
  function still(){ // reduced motion: draw complete figure once
    ctx.fillStyle = '#021010'; ctx.fillRect(0,0,W,W); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(98,255,240,.8)'; ctx.lineWidth = 1.4; ctx.beginPath();
    for (let i = 0; i <= 2000; i++){ const [x, y] = pt(i/2000*2*Math.PI); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
  }
  let raf = 0;
  size(); addEventListener('resize', () => { size(); if (reduce) still(); });
  if (reduce){ still(); } else raf = requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !raf && !reduce){ last = performance.now(); raf = requestAnimationFrame(frame); } });
  preset(2);
  if (reduce) still();
})();
