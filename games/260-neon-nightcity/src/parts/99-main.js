
// ═══ 輸入、相機、燈光挑選、天氣、主迴圈與測試 API ═══
const CLUB_W = WP(CLUB_X, CLUB_Z), BAR_W = WP(BAR_X, BAR_Z);   // 音效的距離用世界座標
cityWorld();   // 10-city.js：生成都跑完了，碰撞表、光源表與錨點一次換成世界座標（05-zones.js 的區）
W2.boot();     // 27-props.js：配電箱與加油機要等船位（31-boats.js）宣告好才擺
const keys = {};
const inp = { mx: 0, mz: 0, run: false, thr: 0, brk: 0, steer: 0, hb: false, nitro: false };
const camState = { yaw: 0, pitch: .14, dist: 3.6, far: SET.camFar, idle: 9, snap: true, pos: V3(), shake: 0, fov: 62 };
const nitro = { v: 1, on: false };
let started = false;
const touch = { jx: 0, jz: 0, look: null };

addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
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
  if (taleKey(code)) return;    // 69-tale.js：委託完成的電話過場
  if (phoneKey(code)) return;   // 69-phone.js：P 開關手機，開著時數字鍵選列、Esc 返回
  if (heistKey(code)) return;   // 69-heist.js：G 引爆金庫門、關掉結算畫面
  if (mapKey(code)) return;     // 91-map.js：地圖開著時的選擇、縮放與導航點
  if (code === 'KeyM') { toggleMap(); return; }
  if (code === 'Escape') { if ($('map').classList.contains('on')) toggleMap(false); else menuOpen(); return; }   // 95-menu.js：暫停與設定選單
  if ($('map').classList.contains('on')) return;
  if (gtaKey(code)) return;
  if (code === 'KeyH') $('help').classList.toggle('on');
  if (code === 'KeyC') { SET.camFar = camState.far = (camState.far + 1) % 3; setSave(); }   // 和 Esc 選單的「預設鏡頭距離」同一個值
  if (code === 'Digit1') teleport('club');
  if (code === 'Digit2') teleport('clubIn');
  if (code === 'Digit3') teleport('barIn');
  if (code === 'Digit4') teleport('garage');
  if (code === 'Digit5') teleport('dealer');
  if (code === 'Digit6') teleport('home');
  if (fading) return;
  const ctx = contextAction();
  if (code === 'KeyF') {
    if (player.mode === 'drive') { if (player.veh.fly && player.veh.y - groundH(player.veh.x, player.veh.z) > 1.5) toast('先降落到地面'); else if (Math.hypot(player.veh.vx, player.veh.vz) < 4) exitVehicle(); else toast('先把車速降下來'); }   // 69-gunship.js：直升機在半空或屋頂上不能下
    else if (ctx && ctx.key === 'F') ctx.fn();
  }
  if (code === 'KeyE' && ctx && ctx.key === 'E') ctx.fn();
  if (code === 'KeyG' && player.mode === 'walk') toggleDance();
  if (code === 'KeyV' && player.mode === 'walk' && player.where === 'out') summonCar();
}
// V：把目前的座駕叫到最近的車道上並直接上車（停在車庫裡的也會開出來）
function summonCar() {
  motors.stowed = false; kestrel.g.visible = true;
  if (kestrel.dead) toast(`${kestrel.name} 修好送過來了`);
  if (kestrel.dead || kestrel.flat) wreckFix(kestrel);   // 68-wreck.js：耐久、車窗、引擎、輪胎
  const sp = rnLaneSpot(player.x, player.z, 8);   // 06-roads.js：最近那段路靠玩家這一側的車道
  kestrel.x = sp.x; kestrel.z = sp.z; kestrel.yaw = sp.yaw;
  kestrel.vx = kestrel.vz = 0; kestrel.y = 0; kestrel.air = null; poseVehicle(kestrel);
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
function look(dx, dy, sens = SET.sens) {
  if (arm.wheel.open) { wheelMove(dx, dy); return; }   // 武器轉盤開著：滑鼠移動選格（69-combat.js）
  if (crew.wheel.open) { crewWheelMove(dx, dy); return; }   // 角色轉盤（69-crew.js）
  const k = camera.fov / SET.fov * sens * (gta.aimK > .5 ? SET.aimSens : 1);   // 狙擊鏡放大時降低靈敏度；靈敏度與反轉 Y 軸在 Esc 選單
  camState.yaw -= dx * .0024 * k; camState.pitch = clamp(camState.pitch + dy * .0022 * k * (SET.invY ? -1 : 1), -.45, 1.15); camState.idle = 0;
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
  cvs.addEventListener('pointermove', e => { const l = touch.look; if (l && l.id === e.pointerId) { look((e.clientX - l.x) * 1.6, (e.clientY - l.y) * 1.2, SET.touchSens); l.x = e.clientX; l.y = e.clientY; } });
  const lend = e => { if (touch.look && touch.look.id === e.pointerId) touch.look = null; };
  cvs.addEventListener('pointerup', lend); cvs.addEventListener('pointercancel', lend);
  document.querySelectorAll('#tbtn button').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', e => { e.preventDefault(); sfx.init(); b.classList.add('act'); if (k === 'Space' || k === 'ShiftLeft') keys[k] = true; else if (k === 'Fire') triggerDown(); else onKey(k); });
    const up = () => { b.classList.remove('act'); if (k === 'Space' || k === 'ShiftLeft') keys[k] = false; if (k === 'Fire') triggerUp(); };
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
// 線段 (ox, oz) → (ox + dx, oz + dz) 第一次碰到盒（往外擴 pad）的比例 t（0–1，碰不到是 1）；盒有所屬的區就換到區的框裡算（t 不變）
function rayBox(ox, oz, dx, dz, b, pad = 0) {
  if (b.f) { [ox, oz] = toL(ox, oz, b.f); [dx, dz] = dirL(b.f, dx, dz); }
  let t0 = 0, t1 = 1;
  for (const [o, d, lo, hi] of [[ox, dx, b.x0 - pad, b.x1 + pad], [oz, dz, b.z0 - pad, b.z1 + pad]]) {
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
    tx = v.x; ty = v.y + (v.fly ? 1.8 : v.isCar ? 1.15 : 1.3); tz = v.z;
    dist = (v.fly ? 13 : v.isCar ? 6.2 + (v.len - 4.4) * .7 : v.boat ? 7.4 + (v.len - 6) * .6 : 4.6) + spd * .025 + [0, 1.8, -1.6][camState.far];
    if (SET.recenter && camState.idle > 1.2) {
      const vf = v.vx * Math.sin(v.yaw) + v.vz * Math.cos(v.yaw);
      const want = vf < -1 ? v.yaw : v.yaw + clamp(v.yr * .18, -.3, .3);
      camState.yaw += wrapA(want - camState.yaw) * (1 - Math.exp(-3.2 * dt));
      camState.pitch = damp(camState.pitch, v.fly ? .24 : .13, 2, dt);
    }
  } else {
    tx = p.x; ty = p.swim ? SEA_Y + .75 : p.y + 1.55 - (p.crouchK || 0) * .5; tz = p.z;
    dist = [3.4, 5.2, 2.4][camState.far];
    if (p.where !== 'out') dist = Math.min(dist, 3.2);
    dist = lerp(dist, 1.75, gta.aimK);   // 瞄準：拉近成越肩視角（69-combat.js）
    dist = lerp(dist, .05, arm.zoomK); ty += arm.zoomK * .1;   // 狙擊鏡：鏡頭進到眼睛
  }
  const cp = Math.cos(camState.pitch), sp = Math.sin(camState.pitch);
  _cd.set(Math.sin(camState.yaw) * cp, -sp, Math.cos(camState.yaw) * cp);
  const sx = inV ? 0 : (.38 + gta.aimK * .3) * (1 - arm.zoomK);
  const rx = -Math.cos(camState.yaw), rz = Math.sin(camState.yaw);
  let wx = tx - _cd.x * dist + rx * sx, wz = tz - _cd.z * dist + rz * sx, wy = ty - _cd.y * dist;
  // 撞牆就把相機往角色拉近
  let tmin = 1;
  const ox = tx + rx * sx, oz = tz + rz * sx;
  for (const b of boxesNear(ox, oz, dist + 2)) {
    if (b.low) continue;   // 岸邊擋牆不擋相機
    if (boxGap(b, ox, oz) > dist + 2) continue;
    const t = rayBox(ox, oz, wx - ox, wz - oz, b, .25);
    if (t < tmin) tmin = t;
  }
  if (tmin < 1) { const t = Math.max(.12, tmin * .92); wx = ox + (wx - ox) * t; wz = oz + (wz - oz) * t; wy = ty + (wy - ty) * t; }
  // 室內：有第二層的安全屋（69-safehouse.js）地板跟著所在的層，天花板依位置（夾層下比較低，相機與角色兩處取低的）
  const V = p.where === 'out' ? null : VENUES[p.where];
  const floor = (V ? V.lvY || 0 : Math.max(seaFloor(wx, wz), SEA_Y)) + .35;
  const ceil = !V ? 999 : V.ceilAt ? Math.min(V.ceilAt(wx, wz), V.ceilAt(tx, tz)) : V.ceil;
  wy = clamp(wy, floor, ceil);
  if (camState.snap) camState.pos.set(wx, wy, wz);
  else { const k = 1 - Math.exp(-(inV ? 14 : 18) * dt); camState.pos.x += (wx - camState.pos.x) * k; camState.pos.y += (wy - camState.pos.y) * k; camState.pos.z += (wz - camState.pos.z) * k; }
  camera.position.copy(camState.pos);
  if (camState.shake > 0) { camState.shake = Math.max(0, camState.shake - dt * 2.5); const s = camState.shake * .15 * SET.shake; camera.position.x += (Math.random() - .5) * s; camera.position.y += (Math.random() - .5) * s; }
  _ct.set(tx, ty + (inV ? .2 : 0), tz);
  U.uFocus.value.set(tx, ty, tz, inV ? 0 : 1);
  camera.lookAt(_ct.x + rx * sx * .6, _ct.y, _ct.z + rz * sx * .6);
  const fov = lerp(SET.fov + clamp(spd / 150, 0, 1) * 12 + (nitro.on ? 7 : 0) - gta.aimK * 12, 13, arm.zoomK);
  camState.fov = arm.zoomK > .02 ? fov : damp(camState.fov, fov, 4, dt);
  if (Math.abs(camera.fov - camState.fov) > .01) { camera.fov = camState.fov; camera.updateProjectionMatrix(); }
  if (camState.over) { const o = camState.over; camera.position.set(o[0], o[1], o[2]); camera.lookAt(o[3], o[4], o[5]); }   // __nc.camAt：截圖用的固定相機
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
    const near = atm.lamp < .2 ? [] : traffic.map(c => ({ c, d: (c.x - cx) ** 2 + (c.z - cz) ** 2 })).filter(o => o.d < 1600).sort((a, b) => a.d - b.d).slice(0, 3);   // 白天車流不開大燈
    for (const { c } of near) {
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), L2 = TYPES[c.type].len / 2;
      dynLights.push({ x: c.x + fx * L2, y: .8, z: c.z + fz * L2, col: HEAD_COL, r: 22, i: 2, dir: [fx, -.1, fz], cos: .8 });
      if (TYPES[c.type].police) dynLights.push({ x: c.x, y: 1.8, z: c.z, col: Math.sin(t * 12) > 0 ? POL_R : POL_B, r: 14, i: 2.2 });
    }
    dynLights.push(...policeLights(t));   // 警車閃燈、直升機探照燈（69-police.js）
    // 爆炸、起火與槍口閃光（68-gta.js），亮度隨時間衰減
    for (const l of fxLights.slice(-3)) dynLights.push({ x: l.x, y: l.y, z: l.z, col: l.col, r: l.r, i: l.i * (1 - l.life / l.max) });
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

// ─── 主迴圈 ───
let last = performance.now(), T0 = last, frames = 0, fpsT = 0, fps = 60;
function step(dt) {
  const t = (performance.now() - T0) / 1000;
  U.uTime.value = t;
  U.uBeat.value = sfx.beat();
  readInput();
  gtaPre(dt);
  let spd = 0;
  const out = player.where === 'out';
  if (out) {
    updateSignals(t);
    updateTraffic(dt, t);
    updatePeds(dt);
    holo.rotation.y = t * .35;
    coastUpdate(t, dt);
    boatsUpdate(dt);
    wakeUpdate(dt);
  } else if (player.where === 'club') updateClub(t, U.uBeat.value);
  if (player.mode === 'drive') {
    const v = player.veh;
    nitro.on = inp.nitro && inp.thr > 0 && nitro.v > .02 && !v.fly;   // 直升機的 Shift 是下降
    nitro.v = clamp(nitro.v + (nitro.on ? -.32 : .1) * dt, 0, 1);
    const vmax0 = v.vmax, eng0 = v.eng;
    if (nitro.on) { v.vmax *= 1.25; v.eng *= 1.6; }
    const grip0 = v.grip; if (abil.drive) { v.grip *= 2.5; v.stK = 1.8; }   // Kael 的極限反射駕駛（69-crew.js）
    if (player.where === 'out') { v.grip *= 1 - .3 * wx.wet; v.brkK = 1 - .2 * wx.wet; }   // 濕路面（28-sky.js 的 wx.wet）：側向抓地少三成、煞車距離變長
    const r = v.fly ? flyHeli(v, inp, dt) : v.boat ? driveBoat(v, inp, dt) : v.air ? stuntFly(v, inp, dt) : driveVehicle(v, inp, dt);   // 31-boats.js：船；69-stunt.js：跳台斜面與飛行
    if (!v.air && !v.boat && !v.fly && !v.tumble && !v.flipped) stuntGround(v, r.vF);
    v.vmax = vmax0; v.eng = eng0; v.grip = grip0; v.stK = 1; v.brkK = 1;
    if (r.imp > 3) { sfx.impact(r.imp); camState.shake = Math.min(1, r.imp / 14); }
    gta.lastImp = r.imp;
    spd = Math.abs(r.vF) * 3.6;
    driftTick(dt, v, r.imp, spd);
    if (!v.isCar) { me.anim(0, ANIM.ride, 0, 1); me.anim2(0, 0, 0); _o.position.set(0, 0, 0); placeRider(v); }
    driveByPlace(v);   // 69-combat.js：車內射擊時手伸出車窗
    sfx.update(dt, { where: player.where, dClub: Math.hypot(v.x - CLUB_W.x, v.z - CLUB_W.z), dBar: Math.hypot(v.x - BAR_W.x, v.z - BAR_W.z), rain: U.uRain.value, rpm: v.rpm, gear: typeof v.gear === 'number' ? v.gear : 1, thr: inp.thr, slip: v.slip, nitro: nitro.on });
  } else {
    nitro.on = false; nitro.v = clamp(nitro.v + .1 * dt, 0, 1);
    if (!dlg.open) updatePlayerWalk(inp, dt, camState.yaw);
    else { player.v = 0; updatePlayerWalk({ mx: 0, mz: 0, run: false }, dt, camState.yaw); }
    const dc = player.where === 'out' ? Math.hypot(player.x - CLUB_W.x, player.z - CLUB_W.z) : 999;
    const db = player.where === 'out' ? Math.hypot(player.x - BAR_W.x, player.z - BAR_W.z) : 999;
    sfx.update(dt, { where: player.where, dClub: dc, dBar: db, rain: U.uRain.value, rpm: 0, gear: 1, thr: 0, slip: 0, nitro: false });
  }
  updateMotors(dt, t);
  updateWeather(dt, t);   // 28-sky.js：時間與天氣決定天空、霧與燈（要在 gtaUpdate 前，換角色的雲霧過場才蓋得過去）
  gtaUpdate(dt);
  if (out) policeUpdate(dt);
  vehicles.forEach(poseVehicle);
  if (player.where === 'club' && quest.n === 4 && player.dance && Math.abs(player.x) < 6.2 && player.z > 12.8 && player.z < 25.2) {
    quest.danceT += dt;
    if (quest.danceT > 5) { setQuest(5); toast('Marlo 說得對，這裡的低音值得淋一場雨'); earn(250000, 'Juno 托人送來的謝禮'); }
  }
  updateCamera(dt, spd);
  updateCrowds(curScene);
  gtaLate();
  // 雨絲依相機速度傾斜
  if (step.lastCam) rainU.uVel.value.subVectors(camera.position, step.lastCam).divideScalar(Math.max(dt, 1e-3)).clampLength(0, 40);
  (step.lastCam ||= V3()).copy(camera.position);
  pickLights(t);
  if (player.where === 'out') occUpdate();   // 28-sky.js：車與行人在地上的陰影
  if (player.where === 'out') { distCull(camera.position.x, camera.position.z); instUpdate(camera.position.x, camera.position.z); bldUpdate(); coastModelsUpdate(); w1Update(); }   // 遠處的立面、建築與設施不畫；走近才下載的建築組
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
  if (menu.on) { T0 += now - last; last = now; menuIdle(); return; }   // 95-menu.js：暫停時世界停住（uTime 也不走），只在改了畫面設定時重畫
  if (SET.fps && now - last < 1000 / SET.fps - 2) return;   // 幀率上限
  const raw = Math.min(.05, (now - last) / 1000); last = now;
  // 子彈時間（武器轉盤、WASTED／BUSTED）：遊戲時間放慢，uTime 也跟著慢（T0 往後推）
  slowmo.raw = raw;
  const sw = Math.min(slowmo.want, slowmo.ab, slowmo.st);   // 轉盤／死亡、特殊能力、特技跳台取最慢的
  slowmo.k = damp(slowmo.k, sw, sw < slowmo.k ? 14 : 5, raw);
  if (Math.abs(slowmo.k - 1) < .002) slowmo.k = 1;
  T0 += raw * 1000 * (1 - slowmo.k);
  const dt = raw * slowmo.k;
  step(dt);
  frames++; fpsT += dt; if (fpsT > .5) { fps = frames / fpsT; frames = 0; fpsT = 0; }
}

// ─── 開始 ───
setWhere('out');
setQuest(0);
camState.yaw = player.yaw = 0.35;
// 等座駕與路邊機車的實車模型、街上的實體建築與拉麵攤下載完再開放進場（手機也一樣等）；以檔案開啟不下載。
// 卡住超過 60 秒就先用替身進場，下載好再換
if (GLB_ON) {
  const cars = [...new Set([kestrel.carId, hanzo.carId])].filter(id => CARS[id] && CARS[id].glb);
  const want = [...cars, ...bldSets.map(s => 'p:' + s), ...(ramenSpots.length ? ['p:ramen'] : [])];
  await bootStep(BOOT.dl, '下載座駕與街區建築的模型…');
  let fin = false; Promise.all([...cars.map(loadGLB), bldReady, ramenReady]).then(() => { fin = true; });
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
  // 95-menu.js：Esc 選單（st 狀態、SET 設定值、set(k, v) 改設定、key(code) 模擬選單按鍵、rt() 渲染目標、t() 著色器時間）
  menu: { st: menu, SET, open: menuOpen, close: menuClose, set: (k, v) => menuSet(k, v), key: c => menuKey(c), rt: () => ({ w: rtScene.width, h: rtScene.height, samples: rtScene.samples, scale: post.scale }), detail: () => ({ k: detail.k, v: detail.v, dist: detailK() }), t: () => U.uTime.value },
  ready: true, scene, camera, renderer: R, player, quest, traffic, parked, vehicles, U, post, boat: boatApi, seam: { path: SEAM_PATH, sites: SEAM_SITES }, ways: { fwy: FWY, ramps: FWY_RAMPS, diag: DIAG, plaza: () => { const B = blocks.filter(b => b.plaza); return { blocks: B.length, lots: lots.filter(L => L.b && L.b.plaza).length, road: B.reduce((a, b) => a + groundHL((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2), 0), walk: B.filter(b => groundHL(b.x1 - SW - 3, b.z0 + SW + 3) > 0 || groundHL(b.x0 + SW + 3, b.z1 - SW - 3) > 0).length }; } }, assets: assetReport, props: { bld: bldPlace, ramen: ramenSpots, w1: W1_SITES, coast: { models: COAST_MODELS, ISLE, FAR_BANK_X, EAST_BANK_X } }, gta: Object.assign(gtaApi, combatApi, { wanted: wantedApi, crew: crewApi, gps: gpsApi, phone: phoneApi, stunt: stuntApi, ev: evApi, squad: squadApi, market: marketApi, heist: heistApi, apt: aptApi, roll: rollApi, side: sideApi, race: raceApi, turf: turfApi, surv: survApi, tale: taleApi }),
  step: (dt = 1 / 60) => step(dt),
  start: () => go.click(),
  tp(x, z, yaw = player.yaw) { if (player.mode === 'drive') exitVehicle(); setWhere('out'); player.x = x; player.z = z; player.y = spawnY(x, z); player.yaw = yaw; camState.yaw = yaw; camState.snap = true; },   // 傳送到快速道路上（最近的路是快速道路）：站在橋面
  // 邏輯座標（方格；spots 裡的門口、sea 的矩形、APT 的 door 都是）：換成世界座標再傳送，朝向一起轉
  // 截圖用：相機固定在世界座標 (px, py, pz) 看向 (tx, ty, tz)；camAt() 還原
  camAt(...o) { camState.over = o.length ? o : null; },
  tpL(x, z, yaw = 0) { const s = spotW({ x, z, yaw }); this.tp(s.x, s.z, s.yaw); },
  W: (x, z) => toW(x, z), L: (x, z) => toL(x, z), Ws: (x, z, yaw = 0) => spotW({ x, z, yaw }), zones: ZONES, roads: RN, capes: CAPES, shore: SHORE, ladders: LADDERS,
  drive(name = 'kestrel') { const v = name === 'hanzo' ? hanzo : kestrel; if (player.mode === 'drive') exitVehicle(); setWhere('out'); enterVehicle(v); camState.yaw = v.yaw; camState.snap = true; },
  walk() { if (player.mode === 'drive') exitVehicle(); },
  enter(w) { if (player.mode === 'drive') exitVehicle(); const sp = VENUES[w].spawn; setWhere(w); player.x = sp.x; player.z = sp.z; player.yaw = sp.yaw; camState.yaw = sp.yaw; camState.snap = true; },
  exit() { const w = player.where; setWhere('out'); const o = VENUES[w].out; player.x = o.x; player.z = o.z; player.yaw = o.yaw; camState.snap = true; },
  look(yaw, pitch = camState.pitch, far = camState.far) { camState.yaw = yaw; camState.pitch = pitch; camState.far = Math.max(0, Math.min(2, Math.round(far))) || 0; camState.idle = 0; camState.snap = true; },
  setQuest, talk: { marlo: talkMarlo, juno: talkJuno }, dialog: dlg, closeDialog,
  // 門口與人物是邏輯座標（用 tpL）；dealSpot、homeSpot 是車停的位置，世界座標
  spots: { bouncer: BOUNCER, clubDoor: { x: CLUB_X, z: CLUB_Z + .6 }, barDoor: { x: BAR_X - 4.6, z: BAR_Z + .6 }, juno: JUNO, floor: CLUB_FLOOR, garage: { x: GAR_X, z: GAR_Z + SW + 4 },
    dealerDoor: { x: DEAL_X, z: DEAL_Z + .6 }, homeDoor: { x: HOME_X, z: HOME_Z - .6 }, dealSpot: DEAL_SPOT, homeSpot: HOME_SPOT, showCars: show.cars.map(c => ({ id: c.id, x: c.x, z: c.z, yaw: c.yaw })), seller: SELLER },
  ctx() { const c = contextAction(); return c ? c.key + ' ' + c.text : null; },
  act() { const c = contextAction(); if (c) c.fn(); return c ? c.text : null; },   // 直接執行目前的互動提示
  pick(n) { if (dlg.open && dlg.opts[n]) dlg.opts[n].fn(); return dlg.open; },
  // 天氣與時間（28-sky.js）：rain(v) 依雨量挑最接近的天氣並立刻套用；weather(id, snap)；time(分鐘)
  rain(v) { setWeather(v > .85 ? 'storm' : v > .45 ? 'rain' : v > .12 ? 'drizzle' : 'overcast', true); wx.rain = v; }, flash() { wx.next = 0; wx.force = true; },
  weather(id, snap = true) { setWeather(id, snap); return wx.cur; }, time(min) { if (Number.isFinite(min)) { clockSt.min = ((min | 0) % 1440 + 1440) % 1440; clockSt.acc = 0; } return clockSt.min; }, wx, atm, map: mapApi, sea: { depth: waterDepth, floor: seaFloor, BEACH, QUAY, ISLE, SEA_Y, sites: ISLE_SITES, foot: isleFoot, walks: BANK_WALKS, ferry: FERRY }, park: { ...NPARK, h: parkH, W: parkW, L: parkL, district: (x, z) => districtW(x, z) },
  keys, inp, nitro, livery: cycleLivery,
  me, peds, pedState, crowd, ANIM, club, glb: glbReport, loadGLB: id => loadGLB(id), loadAllGLB: () => Promise.all(GLB_CARS.map(([id]) => loadGLB(id))),
  motors, cars: CARS, applyCar: (id, paint) => { applyCar(kestrel, id, paint); poseVehicle(kestrel); }, carInfo: id => carDialog(id), garageInfo: id => bayDialog(id), earn, garage: rebuildGarage, stow: stowCar, testDrive, driftTick, endTest: () => motors.test && endTest(),
  getStats: () => ({ fps: Math.round(fps), drawCalls: R.info.render.calls, triangles: R.info.render.triangles, mode: player.mode, where: player.where, quest: quest.n, pos: { x: +(player.mode === 'drive' ? player.veh.x : player.x).toFixed(2), z: +(player.mode === 'drive' ? player.veh.z : player.z).toFixed(2) }, scale: post.scale }),
};
