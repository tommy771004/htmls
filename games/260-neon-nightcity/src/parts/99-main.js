
// ═══ 輸入、相機、燈光挑選、天氣、主迴圈與測試 API ═══
const keys = {};
const inp = { mx: 0, mz: 0, run: false, thr: 0, brk: 0, steer: 0, hb: false, nitro: false };
const camState = { yaw: 0, pitch: .14, dist: 3.6, far: 0, idle: 9, snap: true, pos: V3(), shake: 0, fov: 62 };
const nitro = { v: 1, on: false };
let started = false;
const touch = { jx: 0, jz: 0, look: null };

addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat || !started) return;
  sfx.init();
  onKey(e.code);
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
function onKey(code) {
  if (dlg.open) {
    const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }[code];
    if (n != null && dlg.opts[n]) { sfx.click(); dlg.opts[n].fn(); }
    if (code === 'Escape') closeDialog();
    return;
  }
  if (code === 'KeyM') { toggleMap(); return; }
  if (code === 'Escape') { toggleMap(false); return; }
  if ($('map').classList.contains('on')) return;
  if (code === 'KeyH') $('help').classList.toggle('on');
  if (code === 'KeyC') camState.far = (camState.far + 1) % 3;
  if (code === 'Digit1') teleport('club');
  if (code === 'Digit2') teleport('clubIn');
  if (code === 'Digit3') teleport('barIn');
  if (code === 'Digit4') teleport('garage');
  if (code === 'Digit5') teleport('dealer');
  if (code === 'Digit6') teleport('home');
  if (fading) return;
  const ctx = contextAction();
  if (code === 'KeyF') {
    if (player.mode === 'drive') { if (Math.hypot(player.veh.vx, player.veh.vz) < 4) exitVehicle(); else toast('先把車速降下來'); }
    else if (ctx && ctx.key === 'F') ctx.fn();
  }
  if (code === 'KeyE' && ctx && ctx.key === 'E') ctx.fn();
  if (code === 'KeyG' && player.mode === 'walk') toggleDance();
  if (code === 'KeyV' && player.mode === 'walk' && player.where === 'out') summonCar();
}
// V：把目前的座駕叫到最近的車道上並直接上車（停在車庫裡的也會開出來）
function summonCar() {
  motors.stowed = false; kestrel.g.visible = true;
  let bi = 0, bd = 1e9; for (let i = 0; i <= NX; i++) { const d = Math.abs(player.x - avX(i)); if (d < bd) { bd = d; bi = i; } }
  let bj = 0, be = 1e9; for (let j = 0; j <= NZ; j++) { const d = Math.abs(player.z - stZ(j)); if (d < be) { be = d; bj = j; } }
  if (bd < be) { const s = player.x < avX(bi) ? -1 : 1; kestrel.x = avX(bi) + s * LANE; kestrel.z = clamp(player.z, stZ(0) + 12, stZ(NZ) - 12); kestrel.yaw = s < 0 ? 0 : Math.PI; }
  else { const s = player.z < stZ(bj) ? -1 : 1; kestrel.z = stZ(bj) + s * LANE; kestrel.x = clamp(player.x, avX(0) + 12, avX(NX) - 12); kestrel.yaw = s > 0 ? Math.PI / 2 : -Math.PI / 2; }
  kestrel.vx = kestrel.vz = 0; kestrel.y = 0; poseVehicle(kestrel);
  enterVehicle(kestrel); camState.yaw = kestrel.yaw; camState.snap = true;
  toast(`${kestrel.name} 開過來了`);
}

// 滑鼠：點畫面鎖定游標；沒鎖定時拖曳也能轉
const cvs = R.domElement;
let drag = null;
cvs.addEventListener('click', () => { if (started && !isTouch && !dlg.open && !document.pointerLockElement) cvs.requestPointerLock?.(); });
document.addEventListener('pointerlockchange', () => $('capture').classList.toggle('off', !!document.pointerLockElement));
cvs.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') drag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointerup', e => { if (e.pointerType === 'mouse') drag = null; });
addEventListener('mousemove', e => {
  let dx = 0, dy = 0;
  if (document.pointerLockElement === cvs) { dx = e.movementX; dy = e.movementY; }
  else if (drag) { dx = e.clientX - drag.x; dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; }
  else return;
  look(dx, dy);
});
function look(dx, dy) {
  camState.yaw -= dx * .0024; camState.pitch = clamp(camState.pitch + dy * .0022, -.45, 1.15); camState.idle = 0;
}
// 觸控：左邊搖桿、右半邊拖曳環顧、按鈕對應按鍵
if (isTouch) {
  const joy = $('joy'), knob = $('joyK');
  let jid = null, jc = null;
  joy.addEventListener('pointerdown', e => { jid = e.pointerId; const r = joy.getBoundingClientRect(); jc = { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }; joy.setPointerCapture(jid); move(e); sfx.init(); });
  const move = e => { if (e.pointerId !== jid) return; let x = (e.clientX - jc.x) / jc.r, y = (e.clientY - jc.y) / jc.r; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } touch.jx = x; touch.jz = -y; knob.style.transform = `translate(${x * 34}px,${y * 34}px)`; };
  joy.addEventListener('pointermove', move);
  const end = e => { if (e.pointerId !== jid) return; jid = null; touch.jx = touch.jz = 0; knob.style.transform = ''; };
  joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
  cvs.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' && e.clientX > innerWidth * .4) { touch.look = { id: e.pointerId, x: e.clientX, y: e.clientY }; } });
  cvs.addEventListener('pointermove', e => { const l = touch.look; if (l && l.id === e.pointerId) { look((e.clientX - l.x) * 1.6, (e.clientY - l.y) * 1.2); l.x = e.clientX; l.y = e.clientY; } });
  const lend = e => { if (touch.look && touch.look.id === e.pointerId) touch.look = null; };
  cvs.addEventListener('pointerup', lend); cvs.addEventListener('pointercancel', lend);
  document.querySelectorAll('#tbtn button').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', e => { e.preventDefault(); sfx.init(); b.classList.add('act'); if (k === 'Space' || k === 'ShiftLeft') keys[k] = true; else onKey(k); });
    const up = () => { b.classList.remove('act'); if (k === 'Space' || k === 'ShiftLeft') keys[k] = false; };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
  });
}
$('bHelp').addEventListener('click', () => $('help').classList.toggle('on'));
$('bMute').addEventListener('click', () => { sfx.init(); sfx.setMuted(!sfx.muted); $('muteWave').style.opacity = sfx.muted ? .15 : 1; });
$('bMap').addEventListener('click', () => toggleMap());

function readInput() {
  const k = c => keys[c] ? 1 : 0;
  const frozen = dlg.open || fading || $('map').classList.contains('on');
  const f = (k('KeyW') || k('ArrowUp')) - (k('KeyS') || k('ArrowDown')) + touch.jz;
  const s = (k('KeyD') || k('ArrowRight')) - (k('KeyA') || k('ArrowLeft')) + touch.jx;
  inp.mx = frozen ? 0 : clamp(s, -1, 1); inp.mz = frozen ? 0 : clamp(f, -1, 1);
  inp.run = !!(keys.ShiftLeft || keys.ShiftRight);
  inp.thr = Math.max(0, inp.mz); inp.brk = Math.max(0, -inp.mz); inp.steer = -inp.mx;
  inp.hb = !frozen && !!keys.Space;
  inp.nitro = inp.run;
}

// ─── 相機 ───
const _ct = V3(), _cd = V3();
function rayBox(ox, oz, dx, dz, b) {
  let t0 = 0, t1 = 1;
  for (const [o, d, lo, hi] of [[ox, dx, b.x0, b.x1], [oz, dz, b.z0, b.z1]]) {
    if (Math.abs(d) < 1e-6) { if (o < lo || o > hi) return 1; continue; }
    let a = (lo - o) / d, c = (hi - o) / d; if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return 1;
  }
  return t0;
}
function updateCamera(dt, spd) {
  const p = player, inV = p.mode === 'drive';
  camState.idle += dt;
  let tx, ty, tz, dist;
  if (inV) {
    const v = p.veh;
    tx = v.x; ty = v.y + (v.isCar ? 1.15 : 1.3); tz = v.z;
    dist = (v.isCar ? 6.2 + (v.len - 4.4) * .7 : 4.6) + spd * .025 + [0, 1.8, -1.6][camState.far];
    if (camState.idle > 1.2) {
      const vf = v.vx * Math.sin(v.yaw) + v.vz * Math.cos(v.yaw);
      const want = vf < -1 ? v.yaw : v.yaw + clamp(v.yr * .18, -.3, .3);
      camState.yaw += wrapA(want - camState.yaw) * (1 - Math.exp(-3.2 * dt));
      camState.pitch = damp(camState.pitch, .13, 2, dt);
    }
  } else {
    tx = p.x; ty = p.y + 1.55; tz = p.z;
    dist = [3.4, 5.2, 2.4][camState.far];
    if (p.where !== 'out') dist = Math.min(dist, 3.2);
  }
  const cp = Math.cos(camState.pitch), sp = Math.sin(camState.pitch);
  _cd.set(Math.sin(camState.yaw) * cp, -sp, Math.cos(camState.yaw) * cp);
  const sx = inV ? 0 : .38;
  const rx = -Math.cos(camState.yaw), rz = Math.sin(camState.yaw);
  let wx = tx - _cd.x * dist + rx * sx, wz = tz - _cd.z * dist + rz * sx, wy = ty - _cd.y * dist;
  // 撞牆就把相機往角色拉近
  let tmin = 1;
  const ox = tx + rx * sx, oz = tz + rz * sx;
  for (const b of activeBoxes) {
    if (Math.max(b.x0 - ox, ox - b.x1, b.z0 - oz, oz - b.z1) > dist + 2) continue;
    const t = rayBox(ox, oz, wx - ox, wz - oz, { x0: b.x0 - .25, x1: b.x1 + .25, z0: b.z0 - .25, z1: b.z1 + .25 });
    if (t < tmin) tmin = t;
  }
  if (tmin < 1) { const t = Math.max(.12, tmin * .92); wx = ox + (wx - ox) * t; wz = oz + (wz - oz) * t; wy = ty + (wy - ty) * t; }
  const floor = (p.where === 'out' ? groundH(wx, wz) : 0) + .35;
  const ceil = p.where === 'out' ? 999 : VENUES[p.where].ceil;
  wy = clamp(wy, floor, ceil);
  if (camState.snap) camState.pos.set(wx, wy, wz);
  else { const k = 1 - Math.exp(-(inV ? 14 : 18) * dt); camState.pos.x += (wx - camState.pos.x) * k; camState.pos.y += (wy - camState.pos.y) * k; camState.pos.z += (wz - camState.pos.z) * k; }
  camera.position.copy(camState.pos);
  if (camState.shake > 0) { camState.shake = Math.max(0, camState.shake - dt * 2.5); const s = camState.shake * .15; camera.position.x += (Math.random() - .5) * s; camera.position.y += (Math.random() - .5) * s; }
  _ct.set(tx, ty + (inV ? .2 : 0), tz);
  U.uFocus.value.set(tx, ty, tz, inV ? 0 : 1);
  camera.lookAt(_ct.x + rx * sx * .6, _ct.y, _ct.z + rz * sx * .6);
  const fov = 62 + clamp(spd / 150, 0, 1) * 12 + (nitro.on ? 7 : 0);
  camState.fov = damp(camState.fov, fov, 4, dt);
  if (Math.abs(camera.fov - camState.fov) > .01) { camera.fov = camState.fov; camera.updateProjectionMatrix(); }
}

// ─── 每幀挑出離相機最近的幾盞燈送進 shader ───
const dynLights = [];
let lightPick = [], lightTick = 0;
function pickLights(t) {
  const L = [];
  const cx = camera.position.x, cz = camera.position.z;
  if (player.where === 'out') {
    if (lightTick-- <= 0) {
      lightTick = 6;
      lightPick = outLights.map(l => ({ l, d: (l.x - cx) ** 2 + (l.z - cz) ** 2 - l.r * l.r })).sort((a, b) => a.d - b.d).slice(0, NL).map(o => o.l);
    }
    dynLights.length = 0;
    const v = player.mode === 'drive' ? player.veh : kestrel.lights ? kestrel : null;
    if (v && v.lights) {
      const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), rx = -fz, rz = fx;
      for (const s of v.isCar ? [-1, 1] : [0]) dynLights.push({ x: v.x + fx * v.len * .5 + rx * s * .62, y: v.y + .7, z: v.z + fz * v.len * .5 + rz * s * .62, col: HEAD_COL, r: 34, i: v.isCar ? 3.2 : 4, dir: [fx, -.07, fz], cos: .84 });
    }
    const near = traffic.map(c => ({ c, d: (c.x - cx) ** 2 + (c.z - cz) ** 2 })).filter(o => o.d < 1600).sort((a, b) => a.d - b.d).slice(0, 3);
    for (const { c } of near) {
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), L2 = TYPES[c.type].len / 2;
      dynLights.push({ x: c.x + fx * L2, y: .8, z: c.z + fz * L2, col: HEAD_COL, r: 22, i: 2, dir: [fx, -.1, fz], cos: .8 });
      if (TYPES[c.type].police) dynLights.push({ x: c.x, y: 1.8, z: c.z, col: Math.sin(t * 12) > 0 ? POL_R : POL_B, r: 14, i: 2.2 });
    }
    const n = Math.max(0, NL - dynLights.length);
    L.push(...dynLights, ...lightPick.slice(0, n));
  } else {
    const VL = VENUES[player.where].data.lights;   // 車行、車庫的燈比 NL 多：挑離相機最近的
    L.push(...(VL.length <= NL ? VL : VL.map(l => ({ l, d: (l.x - cx) ** 2 + (l.z - cz) ** 2 - l.r * l.r })).sort((a, b) => a.d - b.d).slice(0, NL).map(o => o.l)));
  }
  for (let k = 0; k < NL; k++) {
    const l = L[k];
    if (!l) { U.uLP.value[k].set(0, -999, 0, 0); continue; }
    U.uLP.value[k].set(l.x, l.y, l.z, l.r);
    U.uLC.value[k].set(l.col.r ?? l.col.x, l.col.g ?? l.col.y, l.col.b ?? l.col.z, 0).multiplyScalar(l.i);
    if (l.dir) U.uLD.value[k].set(l.dir[0], l.dir[1], l.dir[2], l.cos); else U.uLD.value[k].set(0, -1, 0, -2);
  }
}
const HEAD_COL = lin(0xfff0d8), POL_R = lin(0xff1030), POL_B = lin(0x2050ff);

// ─── 天氣：雨勢慢慢起伏，偶爾打雷 ───
const weather = { next: 20 + Math.random() * 25, flash: [] };
function updateWeather(dt, t) {
  U.uRain.value = clamp(.62 + .3 * Math.sin(t * .021) + .1 * Math.sin(t * .067), .3, 1);
  weather.next -= dt;
  if (weather.next <= 0 && player.where === 'out') {
    weather.next = 28 + Math.random() * 40;
    weather.flash = [[0, .9], [.08, 0], [.16, .6], [.3, 0], [.42, .35], [.7, 0]].map(([d, v]) => [t + d, v]);
    sfx.thunder(1.2 + Math.random() * 2.5);
  }
  let f = U.uFlash.value;
  while (weather.flash.length && weather.flash[0][0] <= t) f = weather.flash.shift()[1];
  U.uFlash.value = player.where === 'out' ? Math.max(0, f - dt * 2 * (weather.flash.length ? 0 : 1)) : 0;
}

// ─── 主迴圈 ───
let last = performance.now(), T0 = last, frames = 0, fpsT = 0, fps = 60;
function step(dt) {
  const t = (performance.now() - T0) / 1000;
  U.uTime.value = t;
  U.uBeat.value = sfx.beat();
  readInput();
  let spd = 0;
  const out = player.where === 'out';
  if (out) {
    updateSignals(t);
    updateTraffic(dt, t);
    updatePeds(dt);
    holo.rotation.y = t * .35;
  } else if (player.where === 'club') updateClub(t, U.uBeat.value);
  if (player.mode === 'drive') {
    const v = player.veh;
    nitro.on = inp.nitro && inp.thr > 0 && nitro.v > .02;
    nitro.v = clamp(nitro.v + (nitro.on ? -.32 : .1) * dt, 0, 1);
    const vmax0 = v.vmax, eng0 = v.eng;
    if (nitro.on) { v.vmax *= 1.25; v.eng *= 1.6; }
    const r = driveVehicle(v, inp, dt);
    v.vmax = vmax0; v.eng = eng0;
    if (r.imp > 3) { sfx.impact(r.imp); camState.shake = Math.min(1, r.imp / 14); }
    spd = Math.abs(r.vF) * 3.6;
    driftTick(dt, v, r.imp, spd);
    if (!v.isCar) { me.anim(0, ANIM.ride, 0, 1); me.anim2(0, 0, 0); _o.position.set(0, 0, 0); placeRider(v); }
    sfx.update(dt, { where: player.where, dClub: Math.hypot(v.x - CLUB_X, v.z - CLUB_Z), dBar: Math.hypot(v.x - BAR_X, v.z - BAR_Z), rain: U.uRain.value, rpm: v.rpm, gear: typeof v.gear === 'number' ? v.gear : 1, thr: inp.thr, slip: v.slip, nitro: nitro.on });
  } else {
    nitro.on = false; nitro.v = clamp(nitro.v + .1 * dt, 0, 1);
    if (!dlg.open) updatePlayerWalk(inp, dt, camState.yaw);
    else { player.v = 0; updatePlayerWalk({ mx: 0, mz: 0, run: false }, dt, camState.yaw); }
    const dc = player.where === 'out' ? Math.hypot(player.x - CLUB_X, player.z - CLUB_Z) : 999;
    const db = player.where === 'out' ? Math.hypot(player.x - BAR_X, player.z - BAR_Z) : 999;
    sfx.update(dt, { where: player.where, dClub: dc, dBar: db, rain: U.uRain.value, rpm: 0, gear: 1, thr: 0, slip: 0, nitro: false });
  }
  updateMotors(dt, t);
  vehicles.forEach(poseVehicle);
  if (player.where === 'club' && quest.n === 4 && player.dance && Math.abs(player.x) < 6.2 && player.z > 12.8 && player.z < 25.2) {
    quest.danceT += dt;
    if (quest.danceT > 5) { setQuest(5); toast('Marlo 說得對，這裡的低音值得淋一場雨'); earn(250000, 'Juno 托人送來的謝禮'); }
  }
  updateWeather(dt, t);
  updateCamera(dt, spd);
  updateCrowds(curScene);
  // 雨絲依相機速度傾斜
  if (step.lastCam) rainU.uVel.value.subVectors(camera.position, step.lastCam).divideScalar(Math.max(dt, 1e-3)).clampLength(0, 40);
  (step.lastCam ||= V3()).copy(camera.position);
  pickLights(t);
  const ctx = started && !dlg.open && !fading ? contextAction() : null;
  const pr = $('prompt');
  if (ctx) { pr.classList.add('on'); setText('promptKey', ctx.key); if (hudCache.promptText !== ctx.text) { hudCache.promptText = ctx.text; $('promptText').innerHTML = ctx.text; } }
  else pr.classList.remove('on');
  updateHud(dt);
  renderFrame(dt, t);
}
// 騎機車時人物坐在座墊上、跟著車身壓車
function placeRider(v) {
  const m = new T.Matrix4().compose(V3(v.x, v.y, v.z), new T.Quaternion().setFromEuler(new T.Euler(v.pitch, v.yaw, v.lean, 'YXZ')), V3(1, 1, 1));
  m.multiply(new T.Matrix4().makeTranslation(0, v.seat ? v.seat[0] : .02, v.seat ? v.seat[1] : -.32));   // 實車機車的座位高低前後不同
  me.placeM(0, m);
  player.x = v.x; player.z = v.z;
}
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  step(dt);
  frames++; fpsT += dt; if (fpsT > .5) { fps = frames / fpsT; frames = 0; fpsT = 0; }
}

// ─── 開始 ───
setWhere('out');
setQuest(0);
camState.yaw = player.yaw = 0.35;
// 等座駕與路邊機車的實車模型下載完再開放進場（手機也一樣等）；以檔案開啟不下載。卡住超過 60 秒就先用替身進場，下載好再換
if (GLB_ON) {
  const want = [...new Set([kestrel.carId, hanzo.carId])].filter(id => CARS[id] && CARS[id].glb);
  await bootStep(BOOT.dl, '下載座駕的實車模型…');
  let fin = false; Promise.all(want.map(loadGLB)).then(() => { fin = true; });
  for (const t0 = performance.now(); !fin && performance.now() - t0 < 60000;) {
    bootProgress(BOOT.dl + (99 - BOOT.dl) * glbFrac(want));
    await new Promise(r => setTimeout(r, 100));
  }
}
bootProgress(100, '雨正在下。');
const go = $('go'); go.disabled = false;
go.textContent = '進入雨夜'; go.removeAttribute('role'); go.removeAttribute('aria-valuenow');
go.addEventListener('click', () => {
  started = true; sfx.init();
  $('start').classList.add('gone'); $('hud').classList.add('on'); $('touch').classList.add('on');
  setTimeout(() => { $('start').style.display = 'none'; }, 700);
  if (!isTouch) cvs.requestPointerLock?.();
  cvs.focus();
  toast('門禁：今晚 LAZARUS 只放名單上的人');
});
requestAnimationFrame(loop);

window.__nc = {
  ready: true, scene, camera, renderer: R, player, quest, traffic, vehicles, U, post, assets: assetReport,
  step: (dt = 1 / 60) => step(dt),
  start: () => go.click(),
  tp(x, z, yaw = player.yaw) { if (player.mode === 'drive') exitVehicle(); setWhere('out'); player.x = x; player.z = z; player.yaw = yaw; camState.yaw = yaw; camState.snap = true; },
  drive(name = 'kestrel') { const v = name === 'hanzo' ? hanzo : kestrel; if (player.mode === 'drive') exitVehicle(); setWhere('out'); enterVehicle(v); camState.yaw = v.yaw; camState.snap = true; },
  walk() { if (player.mode === 'drive') exitVehicle(); },
  enter(w) { if (player.mode === 'drive') exitVehicle(); const sp = VENUES[w].spawn; setWhere(w); player.x = sp.x; player.z = sp.z; player.yaw = sp.yaw; camState.yaw = sp.yaw; camState.snap = true; },
  exit() { const w = player.where; setWhere('out'); const o = VENUES[w].out; player.x = o.x; player.z = o.z; player.yaw = o.yaw; camState.snap = true; },
  look(yaw, pitch = camState.pitch, far = camState.far) { camState.yaw = yaw; camState.pitch = pitch; camState.far = far; camState.idle = 0; camState.snap = true; },
  setQuest, talk: { marlo: talkMarlo, juno: talkJuno }, dialog: dlg, closeDialog,
  spots: { bouncer: BOUNCER, clubDoor: { x: CLUB_X, z: CLUB_Z + .6 }, barDoor: { x: BAR_X - 4.6, z: BAR_Z + .6 }, juno: JUNO, floor: CLUB_FLOOR, garage: { x: GAR_X, z: GAR_Z + SW + 4 },
    dealerDoor: { x: DEAL_X, z: DEAL_Z + .6 }, homeDoor: { x: HOME_X, z: HOME_Z - .6 }, dealSpot: DEAL_SPOT, homeSpot: HOME_SPOT, showCars: show.cars.map(c => ({ id: c.id, x: c.x, z: c.z, yaw: c.yaw })), seller: SELLER },
  ctx() { const c = contextAction(); return c ? c.key + ' ' + c.text : null; },
  pick(n) { if (dlg.open && dlg.opts[n]) dlg.opts[n].fn(); return dlg.open; },
  rain(v) { U.uRain.value = v; }, flash() { weather.next = 0; },
  keys, inp, nitro, livery: cycleLivery,
  me, peds, pedState, crowd, ANIM, glb: glbReport, loadGLB: id => loadGLB(id), loadAllGLB: () => Promise.all(GLB_CARS.map(([id]) => loadGLB(id))),
  motors, cars: CARS, applyCar: (id, paint) => { applyCar(kestrel, id, paint); poseVehicle(kestrel); }, carInfo: id => carDialog(id), garageInfo: id => bayDialog(id), earn, garage: rebuildGarage, stow: stowCar, testDrive, driftTick, endTest: () => motors.test && endTest(),
  getStats: () => ({ fps: Math.round(fps), drawCalls: R.info.render.calls, triangles: R.info.render.triangles, mode: player.mode, where: player.where, quest: quest.n, pos: { x: +(player.mode === 'drive' ? player.veh.x : player.x).toFixed(2), z: +(player.mode === 'drive' ? player.veh.z : player.z).toFixed(2) }, scale: post.scale }),
};
