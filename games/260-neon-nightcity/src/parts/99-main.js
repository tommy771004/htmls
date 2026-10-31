
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
  if (cwKey(code)) return;   // 66-chrome.js 的改裝面板
  if (dlg.open) {
    const n = /^Digit\d$/.test(code) ? (+code[5] + 9) % 10 : null;   // 1–9、0 是第 10 個選項（66-chrome.js 的改裝選單）
    if (n != null && dlg.opts[n]) { sfx.click(); dlg.opts[n].fn(); }
    if (code === 'Escape') closeDialog();
    return;
  }
  if (storyKey(code)) return;   // 69-w0-story.js：主線的字幕與字卡
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
    if (player.mode === 'drive') { if (player.veh.fly && player.veh.y - groundH(player.veh.x, player.veh.z) > 1.5) { if (!skyBail()) toast(`先降落到地面（離地 ${SKY_MIN} m 以上可以跳傘）`); } else if (Math.hypot(player.veh.vx, player.veh.vz) < KIN.jump) vdKeyF(); else if (!jumpOut(player.veh)) toast('先把車速降下來'); }   // jumpOut：69-kinema.js 的跳車；69-gunship.js：直升機在半空或屋頂上不能下
    else if (ctx && ctx.key === 'F') ctx.fn();
  }
  if (code === 'KeyE' && ctx && ctx.key === 'E') ctx.fn();
  if (code === 'KeyG' && player.mode === 'walk') toggleDance();
  if (code === 'KeyV' && player.mode === 'walk' && player.where === 'out') summonCar();
}
// V：把目前的座駕叫到最近的車道上並直接上車（停在車庫裡的也會開出來）
function summonCar() {
  if (motors.v5.imp) { toast(`${kestrel.name} 在${PD.name}的拖吊場 · 付罰金贖回，或翻牆偷出來`); return; }   // 69-v5-civic.js
  if (!v6Claim()) return;   // 69-v6-customs.js：燒毀的座駕要付保險自付額或原廠重建費
  motors.stowed = false; kestrel.g.visible = true;
  if (kestrel.dead || kestrel.flood) toast(`${kestrel.name} 修好送過來了`);
  if (kestrel.dead || kestrel.flat || kestrel.flood || kestrel.stuck) wreckFix(kestrel);   // 68-vdetail.js：泡水、陷在沙裡   // 68-wreck.js：耐久、車窗、引擎、輪胎
  const sp = rnLaneSpot(player.x, player.z, 8);   // 06-roads.js：最近那段路靠玩家這一側的車道
  kestrel.x = sp.x; kestrel.z = sp.z; kestrel.yaw = sp.yaw;
  kestrel.vx = kestrel.vz = 0; kestrel.y = 0; kestrel.air = null; poseVehicle(kestrel);
  enterVehicle(kestrel); camState.yaw = kestrel.yaw; camState.snap = true;
  toast(`${kestrel.name} 開過來了`);
}

// 滑鼠：點畫面鎖定游標；沒鎖定時拖曳也能轉
const cvs = R.domElement;
let drag = null;
// requestPointerLock 在新版 Chrome 回傳 Promise，不能鎖（iframe、無頭）時會 reject，接住免得變成未捕捉例外
const lockPtr = () => cvs.requestPointerLock?.()?.catch?.(() => {});
cvs.addEventListener('click', () => { if (started && !isTouch && !dlg.open && !document.pointerLockElement) lockPtr(); });
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
    b.addEventListener('pointerdown', e => { e.preventDefault(); sfx.init(); b.classList.add('act'); if (k === 'Space' || k === 'ShiftLeft') { keys[k] = true; if (k === 'Space' && started && player.mode === 'walk') onKey(k); } else if (k === 'Fire') triggerDown(); else onKey(k); });
    const up = () => { b.classList.remove('act'); if (k === 'Space' || k === 'ShiftLeft') keys[k] = false; if (k === 'Fire') triggerUp(); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
  });
}
$('bHelp').addEventListener('click', () => $('help').classList.toggle('on'));
$('bMute').addEventListener('click', () => { sfx.init(); sfx.setMuted(!sfx.muted); $('muteWave').style.opacity = sfx.muted ? .15 : 1; });
$('bMap').addEventListener('click', () => toggleMap());

function readInput(dt) {
  const k = c => keys[c] ? 1 : 0;
  const frozen = dlg.open || fading || $('map').classList.contains('on');
  const f = (k('KeyW') || k('ArrowUp')) - (k('KeyS') || k('ArrowDown')) + touch.jz;
  const s = (k('KeyD') || k('ArrowRight')) - (k('KeyA') || k('ArrowLeft')) + touch.jx;
  inp.mx = frozen ? 0 : clamp(s, -1, 1); inp.mz = frozen ? 0 : clamp(f, -1, 1);
  inp.run = !!(keys.ShiftLeft || keys.ShiftRight);
  pedal(dt, Math.max(0, inp.mz), Math.max(0, -inp.mz), -inp.mx);
  inp.hb = !frozen && !!keys.Space;
  inp.nitro = inp.run;
}
// 油門、煞車、方向盤（2026-10-31）：鍵盤只有 0／1，照目標值以固定速率爬升，輕點一下只打一點方向、踩一點煞車。
// 方向盤：打的速度隨車速變慢（PEDAL.st 是靜止與 40 m/s 時每秒走幾成），回正與反打比較快；煞車一踩先咬住 BRK_BITE 再往上加。
// 觸控搖桿本來就是類比值，照樣爬升；SET.steerK 是設定選單的「轉向反應」倍率。
// 低於 0.02 直接歸零：vdPre 與 driveVehicle 用 !inp.steer、!inp.thr 判斷放開，殘值會讓甜甜圈與停車的判斷一直成立
const PEDAL = { st: [5.2, 2.4], back: 8, thrUp: 4.5, thrDn: 9, brkUp: 4, brkDn: 10 }, BRK_BITE = .3;
const pedalS = { thr: 0, brk: 0, steer: 0 };
function pedal(dt, thr, brk, steer) {
  const v = player.mode === 'drive' && player.veh && !player.veh.air && !player.veh.tumble && !player.veh.flipped ? player.veh : null, k = SET.steerK;   // 跳台飛行中的翻滾（69-stunt.js）與側翻推回（68-roll.js）照按鍵直接給
  const go = (c, w, up, dn) => { const r = (Math.abs(w) > Math.abs(c) && Math.sign(w) * Math.sign(c) >= 0 ? up : dn) * dt; c = c + clamp(w - c, -r, r); return Math.abs(c) < .02 && !w ? 0 : c; };
  if (!v || !dt) { pedalS.thr = thr; pedalS.brk = brk; pedalS.steer = steer; }
  else {
    const spd = Math.hypot(v.vx, v.vz), up = lerp(PEDAL.st[0], PEDAL.st[1], clamp(spd / 40, 0, 1)) * k;
    pedalS.steer = go(pedalS.steer, steer, up, Math.max(up, PEDAL.back * k));
    pedalS.thr = go(pedalS.thr, thr, PEDAL.thrUp, PEDAL.thrDn);
    if (brk && pedalS.brk < BRK_BITE) pedalS.brk = Math.min(brk, BRK_BITE);
    pedalS.brk = go(pedalS.brk, brk, PEDAL.brkUp, PEDAL.brkDn);
  }
  inp.thr = pedalS.thr; inp.brk = pedalS.brk; inp.steer = pedalS.steer;
}

// ─── 相機 ───
const _ct = V3(), _cd = V3();
// 線段 (ox, oz) → (ox + dx, oz + dz) 第一次碰到盒（往外擴 pad）的比例 t（0–1，碰不到是 1）；盒有所屬的區就換到區的框裡算（t 不變）
function rayBox(ox, oz, dx, dz, b, pad = 0) {
  if (b.f) { [ox, oz] = toL(ox, oz, b.f); if (b.f.I) { const I = b.f.I; [dx, dz] = [I[0] * dx + I[1] * dz, I[2] * dx + I[3] * dz]; } else [dx, dz] = dirL(b.f, dx, dz); }   // 仿射框：方向照線性換算，t 才不變
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
    // 69-v3-crash.js 的空中：拉遠；開傘時看向人與傘之間、鏡頭跟著滑翔方向
    if (p.air3) {
      dist = p.air3.kind === 'chute' ? 12 : 7.5;
      if (p.air3.kind === 'chute') { ty += 2.6; camState.yaw += wrapA(p.yaw - camState.yaw) * (1 - Math.exp(-1.5 * dt)); camState.pitch = damp(camState.pitch, .22, 2, dt); }
    }
  }
  const cp = Math.cos(camState.pitch), sp = Math.sin(camState.pitch);
  _cd.set(Math.sin(camState.yaw) * cp, -sp, Math.cos(camState.yaw) * cp);
  const sx = inV ? 0 : (.38 + gta.aimK * .3) * (1 - arm.zoomK);
  const rx = -Math.cos(camState.yaw), rz = Math.sin(camState.yaw);
  let wx = tx - _cd.x * dist + rx * sx, wz = tz - _cd.z * dist + rz * sx, wy = ty - _cd.y * dist;
  // 撞牆就把相機往角色拉近
  let tmin = 1;
  const ox = tx + rx * sx, oz = tz + rz * sx;
  for (const b of p.air3 && p.air3.kind !== 'eject' ? [] : boxesNear(ox, oz, dist + 2)) {   // 跳傘時不拉近：樓的盒子沒有高度，飛在屋頂上空也會被拉近
    if (b.low) continue;   // 岸邊擋牆不擋相機
    if (b.hy !== undefined && Math.min(ty, wy) > b.hy + .3) continue;   // 站在屋頂上（69-v5-civic.js）：比樓頂高的相機不被那棟樓擋
    if (b.ly != null && Math.max(ty, wy) < b.ly - .3) continue;   // 樓上那一層的牆（69-v5-garage.js 的立體停車場）
    if (boxGap(b, ox, oz) > dist + 2) continue;
    const t = rayBox(ox, oz, wx - ox, wz - oz, b, .25);
    if (t < tmin) tmin = t;
  }
  if (tmin < 1) { const t = Math.max(.12, tmin * .92); wx = ox + (wx - ox) * t; wz = oz + (wz - oz) * t; wy = ty + (wy - ty) * t; }
  // 室內：有第二層的安全屋（69-safehouse.js）地板跟著所在的層，天花板依位置（夾層下比較低，相機與角色兩處取低的）
  const V = p.where === 'out' ? null : VENUES[p.where];
  let wk = null; if (!V) { wk = walkCam(wx, wz, inV ? p.veh.y : p.y, Math.max(seaFloor(wx, wz), SEA_Y)); wx = wk[2]; wz = wk[3]; }   // 北嶺鐵道橋的橋面與隧道（20-walk.js）
  const floor = (V ? V.lvY || 0 : wk[0]) + .35;
  const ceil = !V ? wk[1] : V.ceilAt ? Math.min(V.ceilAt(wx, wz), V.ceilAt(tx, tz)) : V.ceil;
  wy = clamp(wy, floor, ceil);
  if (camState.snap) camState.pos.set(wx, wy, wz);
  else { const k = 1 - Math.exp(-(inV ? 14 : 18) * dt); camState.pos.x += (wx - camState.pos.x) * k; camState.pos.y += (wy - camState.pos.y) * k; camState.pos.z += (wz - camState.pos.z) * k; }
  camera.position.copy(camState.pos);
  if (camState.shake > 0) { camState.shake = Math.max(0, camState.shake - dt * 2.5); const s = camState.shake * .15 * SET.shake; camera.position.x += (Math.random() - .5) * s; camera.position.y += (Math.random() - .5) * s; }
  _ct.set(tx, ty + (inV ? .2 : 0), tz);
  U.uFocus.value.set(tx, ty, tz, inV ? 0 : 1);
  camera.lookAt(_ct.x + rx * sx * .6, _ct.y, _ct.z + rz * sx * .6);
  const fov = lerp(SET.fov + clamp(spd / 150, 0, 1) * 12 + (nitro.on ? 7 : 0) - gta.aimK * 12, 13 / scopeK(), arm.zoomK);   // scopeK：塔吊上的狙擊鏡倍率（69-v5-tower.js）
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
      for (const s of v.isCar ? [-1, 1] : [0]) dynLights.push({ x: v.x + fx * v.len * .5 + rx * s * .62, y: v.y + .7, z: v.z + fz * v.len * .5 + rz * s * .62, col: v.headCol || HEAD_COL, r: 34, i: v.isCar ? 3.2 : 4, dir: [fx, -.07, fz], cos: .84 });   // headCol：66-chrome.js 的氙氣／黃金大燈
    }
    dynLights.push(...v6Lights(t));   // 69-v6-customs.js：底盤霓虹、改裝廠門頂的旋轉警示燈
    const near = atm.lamp < .2 ? [] : traffic.map(c => ({ c, d: (c.x - cx) ** 2 + (c.z - cz) ** 2 })).filter(o => o.d < 1600).sort((a, b) => a.d - b.d).slice(0, 3);   // 白天車流不開大燈
    for (const { c } of near) {
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), L2 = TYPES[c.type].len / 2;
      dynLights.push({ x: c.x + fx * L2, y: .8, z: c.z + fz * L2, col: HEAD_COL, r: 22, i: 2, dir: [fx, -.1, fz], cos: .8 });
      if (TYPES[c.type].police) dynLights.push({ x: c.x, y: 1.8, z: c.z, col: Math.sin(t * 12) > 0 ? POL_R : POL_B, r: 14, i: 2.2 });
    }
    dynLights.push(...policeLights(t));   // 警車閃燈、直升機探照燈（69-police.js）
    dynLights.push(...railLights());   // 北嶺鐵道橋的列車頭燈（21-rail.js）
    dynLights.push(...xrLights());     // 港灣高架線的列車頭燈（21-xrail.js）
    dynLights.push(...villaLights());  // 山坡別墅入夜後的房間燈（69-villa.js）
    // 爆炸、起火與槍口閃光（68-gta.js），亮度隨時間衰減
    for (const l of fxLights.slice(-3)) dynLights.push({ x: l.x, y: l.y, z: l.z, col: l.col, r: l.r, i: l.i * (1 - l.life / l.max) });
    const n = Math.max(0, NL - dynLights.length);
    L.push(...dynLights, ...lightPick.slice(0, n));
  } else {
    const VL = VENUES[player.where].data.lights.filter(l => l.i > 0);   // 車行、車庫的燈比 NL 多：挑離相機最近的（亮度 0 的動態燈不佔位置）
    L.push(...(VL.length <= NL ? VL : VL.map(l => ({ l, d: (l.x - cx) ** 2 + (l.z - cz) ** 2 - l.r * l.r })).sort((a, b) => a.d - b.d).slice(0, NL).map(o => o.l)));
  }
  for (let k = 0; k < NL; k++) {
    const l = L[k];
    if (!l) { v4set(U.uLP.value, k, 0, -999, 0, 0); continue; }
    v4set(U.uLP.value, k, l.x, l.y, l.z, l.r);
    const i = l.i * (chrome.dim && player.where === 'chrome' && !l.keep ? .4 : 1);   // 66-chrome.js 的 L：主照明調暗 60%
    v4set(U.uLC.value, k, (l.col.r ?? l.col.x) * i, (l.col.g ?? l.col.y) * i, (l.col.b ?? l.col.z) * i, 0);
    if (l.dir) v4set(U.uLD.value, k, l.dir[0], l.dir[1], l.dir[2], l.cos); else v4set(U.uLD.value, k, 0, -1, 0, -2);
  }
}
const HEAD_COL = lin(0xfff0d8), POL_R = lin(0xff1030), POL_B = lin(0x2050ff);

// ─── 主迴圈 ───
let last = performance.now(), T0 = last, frames = 0, fpsT = 0, fps = 60;
function step(dt) {
  const t = (performance.now() - T0) / 1000;
  U.uTime.value = t;
  U.uBeat.value = sfx.beat();
  readInput(dt);
  v6Input(inp);   // 69-v6-customs.js：按住 X 的液壓單輪起伏
  gtaPre(dt);
  let spd = 0;
  const out = player.where === 'out';
  if (out) {
    updateSignals(t);
    updateTraffic(dt, t);
    updatePeds(dt);
    if (HILL_TRAF.on) HILL_TRAF.update(dt);   // 41-hill.js：山路上的車流、散步的人
    holo.rotation.y = t * .35;
    coastUpdate(t, dt);
    railUpdate(dt);   // 北嶺鐵道橋的列車（21-rail.js）
    tronUpdate(dt);   // 光格島的近景、車流與光速機車（21-tron.js）
    airUpdate(dt);    // 灰鷺角國際機場的客機起降與模型下載（21-air.js）
    xrUpdate(dt);     // 港灣高架線的列車（21-xrail.js）
    boatsUpdate(dt);
    seaUpdate(dt);    // 渡輪、拖船與水警艇（31-sea.js）
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
    const r = v.fly ? flyHeli(v, inp, dt) : v.boat ? driveBoat(v, inp, dt) : v.air ? stuntFly(v, inp, dt) : driveSub(v, inp, dt);   // driveSub：69-v3-crash.js 高速時切子步   // 31-boats.js：船；69-stunt.js：跳台斜面與飛行
    if (!v.air && !v.boat && !v.fly && !v.tumble && !v.flipped) stuntGround(v, r.vF);
    v.vmax = vmax0; v.eng = eng0; v.grip = grip0; v.stK = 1; v.brkK = 1;
    if (r.imp > 3) { sfx.impact(r.imp); camState.shake = Math.min(1, r.imp / 14); }
    gta.lastImp = r.imp;
    spd = Math.abs(r.vF) * 3.6;
    driftTick(dt, v, r.imp, spd);
    if (!v.isCar) { me.anim(0, ANIM.ride, 0, 1); me.anim2(0, 0, 0); _o.position.set(0, 0, 0); placeRider(v); }
    driveByPlace(v);   // 69-combat.js：車內射擊時手伸出車窗
    sfx.update(dt, { where: player.where, dClub: Math.hypot(v.x - CLUB_W.x, v.z - CLUB_W.z), dBar: Math.hypot(v.x - BAR_W.x, v.z - BAR_W.z), rain: U.uRain.value, rpm: v.rpm, gear: typeof v.gear === 'number' ? v.gear : 1, thr: inp.thr, slip: Math.max(v.slip, (v.push || 0) * 4), nitro: nitro.on });
  } else {
    nitro.on = false; nitro.v = clamp(nitro.v + .1 * dt, 0, 1);
    if (!dlg.open) updatePlayerWalk(inp, dt, camState.yaw);
    else { player.v = 0; updatePlayerWalk({ mx: 0, mz: 0, run: false }, dt, camState.yaw); }
    const dc = player.where === 'out' ? Math.hypot(player.x - CLUB_W.x, player.z - CLUB_W.z) : 999;
    const db = player.where === 'out' ? Math.hypot(player.x - BAR_W.x, player.z - BAR_W.z) : 999;
    sfx.update(dt, { where: player.where, dClub: dc, dBar: db, rain: U.uRain.value, rpm: CW.open ? chrome.rev : vd.idle ? .14 : 0, eg: vdIdleGain(), gear: 1, thr: CW.open && chrome.revOn ? 1 : 0, slip: 0, nitro: false });   // 66-chrome.js：改裝面板裡原地轟油門
  }
  updateMotors(dt, t);
  updateChrome(dt);   // 66-chrome.js：改裝廠裡的展示車與離場時把車停回門口
  vdUpdate(dt);   // 68-vdetail.js：F 的短按／長按、沒熄火的車、燒胎煙、沉車
  v6Update(dt);   // 69-v6-customs.js：歇業倒數、炸彈、液壓、回火與燒胎煙、歪軸、客戶委託
  v7Update(dt);   // 69-v7-*.js：地堡與霓虹堡、賭場與金庫搶劫、夜店（人氣、保險箱、鬧事、出貨）
  updateWeather(dt, t);   // 28-sky.js：時間與天氣決定天空、霧與燈（要在 gtaUpdate 前，換角色的雲霧過場才蓋得過去）
  gtaUpdate(dt);
  v3Update(dt);   // 69-v3-*：第三部曲的六圍、化學反應、撞擊與跳傘、計程車
  v5Update(dt);   // 69-v5-*：第五部曲的公共設施（醫院、分局與拖吊場、外牆鐵梯）
  v8Update(dt);   // 69-v8-civic.js：消防與救護派遣、拖吊車
  aiUpdate(dt);   // 69-v9-ai.js：便衣尾隨、拍照的手機、頭上的對白
  vigUpdate(dt);   // 69-v9-switch.js：切換角色的小劇場
  mtUpdate(dt);   // 69-v9-metro.js：地鐵的列車週期與乘車
  if (out) policeUpdate(dt);
  vehicles.forEach(poseVehicle);
  if (player.where === 'club' && quest.n === 4 && player.dance && Math.abs(player.x) < 6.2 && player.z > 12.8 && player.z < 25.2) {
    quest.danceT += dt;
    if (quest.danceT > 5) { setQuest(5); toast('Marlo 說得對，這裡的低音值得淋一場雨'); if (!storyOn()) earn(250000, 'Juno 托人送來的謝禮'); }   // 主線開著時是 3-1，照主線的報酬表發
  }
  updateCamera(dt, spd);
  updateCrowds(curScene);
  gtaLate();
  // 雨絲依相機速度傾斜
  if (step.lastCam) rainU.uVel.value.subVectors(camera.position, step.lastCam).divideScalar(Math.max(dt, 1e-3)).clampLength(0, 40);
  (step.lastCam ||= V3()).copy(camera.position);
  pickLights(t);
  if (player.where === 'out') occUpdate();   // 28-sky.js：車與行人在地上的陰影
  if (player.where === 'out') { distCull(camera.position.x, camera.position.z); instUpdate(camera.position.x, camera.position.z); forestMap(camera.position.x, camera.position.z); bldUpdate(); coastModelsUpdate(); w1Update(); }   // 遠處的立面、建築與設施不畫；走近才下載的建築組
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
  frameBegin(now);   // 70-render.js：整幀 CPU 計時（依幀時調整、96-perf.js 的面板）
  step(dt);
  frames++; fpsT += dt; if (fpsT > .5) { fps = frames / fpsT; frames = 0; fpsT = 0; }
  hudPerf(now);   // 90-hud.js：時間區塊左邊的 FPS 與 ms
}

// ─── 開始 ───
setWhere('out');
setQuest(storyBoot());   // 69-w0-story.js：主線開著時，新存檔操作羅莎、門禁等到 3-1
storyObj();
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
// 先把場景裡看得到的材質編好：有 KHR_parallel_shader_compile 時驅動在背景編，進度條不會凍住（Windows 的 Direct3D 後端編得特別久），
// 進場第一幀也不用再停下來連結程式
// （count 0 的實例與空幾何平常在 70-render.js 的視錐測試就剔掉，WebGPU 的 compileAsync 也走視錐測試：編的時候放行，之後有實例才不會現編）
{ const t0 = performance.now(); fogCull.empty = false; await Promise.race([R.compileAsync(scene, camera).catch(() => {}), new Promise(r => setTimeout(r, 15000))]); fogCull.empty = true; GPU.compileMs = Math.round(performance.now() - t0); }
bootProgress(100, '雨正在下。');
const go = $('go'); go.disabled = false;
go.textContent = '進入雨夜'; go.removeAttribute('role'); go.removeAttribute('aria-valuenow');
go.addEventListener('click', () => {
  started = true; sfx.init(); warmGo();   // 27-props.js：進場後背景載入每幀只佔 6 ms、走近才下載的道具先傳貼圖
  $('start').classList.add('gone'); $('hud').classList.add('on'); $('touch').classList.add('on');
  setTimeout(() => { $('start').style.display = 'none'; }, 700);
  if (!isTouch) lockPtr();
  cvs.focus();
  if (!storyGo()) toast('門禁：今晚 LAZARUS 只放名單上的人');   // 69-w0-story.js：新存檔直接進序章
});
requestAnimationFrame(loop);

window.__nc = {
  gameHour: GAME_HOUR,   // 69-market.js：一遊戲小時是幾秒真實時間（28-sky.js 的 MIN_SEC × 60）
  viewCull,   // 20-props.js：遠景樹只送鏡頭看得到的方向（en = false 關掉比對）
  reflOcc,   // 70-render.js 遠景樹進不進倒影的遮擋查詢：reflOcc.en = false 關掉比對，skip 是現在的狀態、n 是收到幾次結果
  fogCull,   // 70-render.js 全進霧裡的物件不畫：fogCull.en = false 關掉比對（也關掉 20-props.js 遠景樹的霧外剔除）
  enc: ENC && { on: ENC_ON, f: ENC.f, pad: ENC.pad, W: (x, z) => toW(x, z, ENC.f), L: (X, Z) => encL(X, Z), ground: (X, Z) => groundH(X, Z), district: (X, Z) => districtW(X, Z), place: (X, Z) => mapPlaceName(X, Z), tris: HILL.encTris, S: ENC.S },   // 28-enclave.js 雲梯城寨（框座標換世界座標、模型與替身的狀態）
  hillMouths: () => HILL.mouths, hillRoads: () => HILL.paths, hillConn: () => HILL_CONN.map(C => ({ pts: C.pts, lamp: C.lamp || null, e: C.e.id, akina: !!C.P.akina })).concat([HILL_CONN.stat]),   // 12-hillmouth.js 的連接路（最後一項是統計） akina: () => AKINA && { x: AKINA.x, z: AKINA.z, WL: AKINA.WL, F: AKINA.F, lake: AKINA.lake, walls: AKINA.walls, osm: AKINA.osm, road: AKINA.road ? AKINA.road.stats : null, tris: HILL.akinaTris, at: (X, Z) => ({ s: akinaShape(X, Z), real: akReal(AKINA, X, Z), h: hillMeshH(X, Z), wet: akinaWet(X, Z) }) },   // 09-akina.js：中心、湖面高、山道、細網格、某一點的山
  hillTraf: () => ({ cars: HILL_TRAF.cars.map(c => ({ r: c.r, s: +c.s.toFixed(1), dir: c.dir, v: +c.v.toFixed(1), x: c.x, y: c.y, z: c.z, out: c.out, fade: c.fade, type: c.type })), walkers: HILL_TRAF.walkers.map(w => ({ r: w.r, s: +w.s.toFixed(1), x: w.x, y: w.y, z: w.z, pause: w.pause })), residents: HILL_TRAF.residents }), cityC: CITY_C,
  villa: { VILLA, deck: hillDeck, where: villaWhere, local: villaLocal, world: villaWorld, st: () => ({ inK: villaSt.inK, wet: U.uWet.value, sun: U.uSunCol.value.r, lights: villaLights().length }), push: (x, z, y, r = .32) => { colY = y; const o = collideCircle(x, z, r, false, true); colY = 0; return o; },
    near: (x, z, r = .5) => boxesNear(x, z, r).filter(b => boxGap(b, x, z) < r).map(b => ({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, ly: b.ly, hy: b.hy, villa: b.villa, f: !!b.zn, ry: b.zn && b.zn.ry })).concat(circlesNear(x, z, r).filter(c => Math.hypot(c.x - x, c.z - z) < c.r + r).map(c => ({ circle: 1, x: c.x, z: c.z, r: c.r, hy: c.hy, car: !!c.car }))) },   // 29-villa.js 山坡別墅的地面、碰撞與出售的那幾棟
  hillHomes: HILL_HOMES,   // 10-city.js 山坡住宅的位置（世界座標，v 是 hill_homes.glb 的型號；HILL.homes 是路與房子的數量）
  gfx: gfxApi,   // 02-gfx.js：繪圖後端（webgl／webgpu）、還沒改寫成 TSL 的材質 miss()
  // 95-menu.js：Esc 選單（st 狀態、SET 設定值、set(k, v) 改設定、key(code) 模擬選單按鍵、rt() 渲染目標、t() 著色器時間）
  menu: { st: menu, SET, open: menuOpen, close: menuClose, set: (k, v) => menuSet(k, v), key: c => menuKey(c), rt: () => ({ w: rtScene.width, h: rtScene.height, samples: rtScene.samples, scale: post.scale }), detail: () => ({ k: detail.k, v: detail.v, dist: detailK() }), t: () => U.uTime.value },
  story: storyApi,   // 69-w0-story.js：主線（go(id)、state()、skip()）
  ready: true, city: { blocks, lots, bldPlace }, gpu: GPU, reflFar: m => { reflFarT = m; },   // 街區與地塊（挑設施街區、驗收用）；顯示卡分級（00-core.js）與倒影遠平面（70-render.js，null 照等級）
  scene, camera, renderer: R, player, quest, traffic, parked, vehicles, U, post, boat: boatApi, seam: { path: SEAM_PATH, sites: SEAM_SITES }, ways: { fwy: FWY, ramps: FWY_RAMPS, diag: DIAG, plaza: () => { const B = blocks.filter(b => b.plaza); return { blocks: B.length, lots: lots.filter(L => L.b && L.b.plaza).length, road: B.reduce((a, b) => a + groundHL((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2), 0), walk: B.filter(b => groundHL(b.x1 - SW - 3, b.z0 + SW + 3) > 0 || groundHL(b.x0 + SW + 3, b.z1 - SW - 3) > 0).length }; } }, assets: assetReport, props: { bld: bldPlace, ramen: ramenSpots, clutter, wallAcs, downpipes, weeds, lampBlobs, streaks, signHits, vend: VEND, vendBin: VEND_BIN, w1: W1_SITES, viaduct: VIADUCT, rail: railApi, tron: tronApi, air: airApi, xrail: xrApi, coast: { models: COAST_MODELS, ISLE, FAR_BANK_X, EAST_BANK_X, FAR_SITES } }, gta: Object.assign(gtaApi, combatApi, { wanted: wantedApi, crew: crewApi, gps: gpsApi, phone: phoneApi, stunt: stuntApi, ev: evApi, squad: squadApi, market: marketApi, heist: heistApi, apt: aptApi, roll: rollApi, side: sideApi, story: storyApi, race: raceApi, turf: turfApi, surv: survApi, tale: taleApi }),
  step: (dt = 1 / 60) => step(dt),
  perf: perfApi,   // 96-perf.js：效能面板（?perf=1）、stats()、stalls()、route() 固定路線量測
  // 碰撞：靜態盒（世界 AABB 是 bx0…；有 f 的盒 x0…z1 是 f 框裡的座標）、圓柱、每幀重建的圓；collide(x, z, r, y) 照玩家走路的方式推一次（空氣牆稽核用）
  col: { colliders, circles, dynCircles, dynMore, toW: (x, z, f) => toW(x, z, f), toL: (x, z, f) => toL(x, z, f), collide(x, z, r = .32, y = 0) { colY = y; const o = collideCircle(x, z, r, false, true); colY = 0; return o; } },
  sfx,   // 80-audio.js：sfx.rec 是真實錄音的載入狀態、正在響的聲音數與循環音
  start: () => go.click(),
  tp(x, z, yaw = player.yaw) { if (player.mode === 'drive') exitVehicle(); setWhere('out'); player.x = x; player.z = z; player.y = spawnY(x, z); player.yaw = yaw; camState.yaw = yaw; camState.snap = true; },   // 傳送到快速道路上（最近的路是快速道路）：站在橋面
  // 邏輯座標（方格；spots 裡的門口、sea 的矩形、APT 的 door 都是）：換成世界座標再傳送，朝向一起轉
  // 截圖用：相機固定在世界座標 (px, py, pz) 看向 (tx, ty, tz)；camAt() 還原
  camAt(...o) { camState.over = o.length ? o : null; },
  // 程式立面的細模（09-mass.js、10-city.js 的 facLod）：stats 看建了幾個街區、幾個三角形；sync 依目前鏡頭位置一次建完
  kit: KIT_N,   // 00-core.js：Kit.box 的方塊數與其中自動倒角的數量
  tex: () => ({ fac: facTex.st, vil: vilTex.st }),   // 照片材質的下載狀態（08-tex.js：0 還沒開始、1 下載中、2 好了、-1 失敗）
  forest: (x, z) => x !== undefined ? HILL_FOREST.probe(x, z) : ({ ...HILL_FOREST.n, karst: KARST.length, k: KARST.slice(0, 8).map(t => [t.x | 0, t.y | 0, t.z | 0, +t.s.toFixed(1)]), fmap: FM.builds }),   // 外緣山林（10-city.js）、石柱峰（21-coast.js）、山林樹冠圖重畫次數（22-hmap.js）
  fac: { stats: () => ({ ...fac, r: SET.fac }), sync() { facLod(camera.position.x, camera.position.z, 1e9); return { ...fac }; }, blk: facBlk },
  tpL(x, z, yaw = 0) { const s = spotW({ x, z, yaw }); this.tp(s.x, s.z, s.yaw); },
  wear: WEAR_SHOPS,   // 12-wearshops.js、69-wear.js：服裝店與衣服
  W: (x, z) => toW(x, z), L: (x, z) => toL(x, z), Ws: (x, z, yaw = 0) => spotW({ x, z, yaw }), zones: ZONES, roads: RN, capes: CAPES, shore: SHORE, ladders: LADDERS,
  drive(name = 'kestrel') { const v = name === 'hanzo' ? hanzo : kestrel; if (player.mode === 'drive') exitVehicle(); setWhere('out'); enterVehicle(v); camState.yaw = v.yaw; camState.snap = true; },
  walk() { if (player.mode === 'drive') exitVehicle(); },
  enter(w) { if (player.mode === 'drive') exitVehicle(); const sp = VENUES[w].spawn; setWhere(w); player.x = sp.x; player.z = sp.z; player.yaw = sp.yaw; camState.yaw = sp.yaw; camState.snap = true; },
  exit() { const w = player.where; setWhere('out'); const o = VENUES[w].out; player.x = o.x; player.z = o.z; player.yaw = o.yaw; camState.snap = true; },
  look(yaw, pitch = camState.pitch, far = camState.far) { camState.yaw = yaw; camState.pitch = pitch; camState.far = Math.max(0, Math.min(2, Math.round(far))) || 0; camState.idle = 0; camState.snap = true; },
  setQuest, talk: { marlo: talkMarlo, juno: talkJuno }, dialog: dlg, closeDialog,
  // 門口與人物是邏輯座標（用 tpL）；dealSpot、homeSpot 是車停的位置，世界座標
  spots: { bouncer: BOUNCER, clubDoor: { x: CLUB_X, z: CLUB_Z + .6 }, barDoor: { x: BAR_X - 4.6, z: BAR_Z + .6 }, juno: JUNO, floor: CLUB_FLOOR, garage: { x: GAR_X, z: GAR_Z + SW + 4 },
    dealerDoor: { x: DEAL_X, z: DEAL_Z + .6 }, homeDoor: { x: HOME_X, z: HOME_Z - .6 }, dealSpot: DEAL_SPOT, homeSpot: HOME_SPOT, showCars: show.cars.map(c => ({ id: c.id, x: c.x, z: c.z, yaw: c.yaw, lv: c.lv })), seller: SELLER },
  showLevel: k => showLevel(k), showLift: () => showLift(),   // 64-showroom.js 的三層展示廳
  ctx() { const c = contextAction(); return c ? c.key + ' ' + c.text : null; },
  act() { const c = contextAction(); if (c) c.fn(); return c ? c.text : null; },   // 直接執行目前的互動提示
  pick(n) { if (dlg.open && dlg.opts[n]) dlg.opts[n].fn(); return dlg.open; },
  // 66-chrome.js 的改裝廠：套件表、效果、原廠規格；pad() 是門口停車格（世界座標）
  chrome: { CATS, GRP, MOD_FX, CAR_REAL, TUNE, CRASH, STAGE, st: chrome, CHROME_CAR, BAY1, BAY4, JOHNNY, ROOK, STAIR, PRIV, pad: () => chromePad(), stats: (id, m) => modStats(id, m), apply: () => modApply(kestrel), repairCost: () => repairCost(kestrel), repairParts: () => repairParts(kestrel), plate: id => plateOf(id || kestrel.carId), dlg: () => ({ open: dlg.open, who: $('dlgWho').textContent, text: $('dlgText').textContent, opts: dlg.opts.map(o => o.t) }),
    // 改裝面板：panel() 目前的層與清單、open()／close()、key(code) 照鍵盤操作、choose(名稱) 選那一列（例如 choose('引擎') 再 choose('EMS 改裝 2 級')）
    panel: () => ({ open: CW.open, path: CW.path.slice(), cat: CW.path[0] || null, sel: CW.sel, cam: CW.cam, title: $('cwTitle').textContent, rows: CW.rows.map(r => ({ name: r.name, val: r.val, off: !!r.off })), desc: $('cwDesc').textContent, note: $('cwNote').textContent }), open: () => cwOpen(), close: () => cwClose(), key: c => cwKey(c), plateIn: (txt) => { if (!CW.typing) return false; $('cwPlateIn').value = txt; cwPlateDone(true); return true; }, dim: on => cwDim(on), rev: () => chrome.rev,
    choose(name) { const i = CW.rows.findIndex(r => r.name === name); if (i < 0) return false; CW.sel = i; cwPick(); return true; } },
  // 天氣與時間（28-sky.js）：rain(v) 依雨量挑最接近的天氣並立刻套用；weather(id, snap)；time(分鐘)
  rain(v) { setWeather(v > .85 ? 'storm' : v > .45 ? 'rain' : v > .12 ? 'drizzle' : 'overcast', true); wx.rain = v; }, flash() { wx.next = 0; wx.force = true; },
  weather(id, snap = true) { setWeather(id, snap); return wx.cur; }, time(min) { if (Number.isFinite(min)) { clockSt.min = ((min | 0) % 1440 + 1440) % 1440; clockSt.acc = 0; } return clockSt.min; }, wx, atm, map: mapApi, sea: { depth: waterDepth, floor: seaFloor, BEACH, QUAY, ISLE, SEA_Y, sites: ISLE_SITES, foot: isleFoot, walks: BANK_WALKS, ferry: FERRY }, park: { ...NPARK, h: parkH, raw: parkRawH, W: parkW, L: parkL, district: (x, z) => districtW(x, z) },
  keys, inp, nitro, livery: cycleLivery,
  me, peds, pedState, crowd, ANIM, club, glb: glbReport, loadGLB: id => loadGLB(id), loadAllGLB: () => Promise.all(GLB_CARS.map(([id]) => loadGLB(id))),
  motors, cars: CARS, applyCar: (id, paint) => { applyCar(kestrel, id, paint); poseVehicle(kestrel); }, carInfo: id => carDialog(id), garageInfo: id => bayDialog(id), earn, garage: rebuildGarage, stow: stowCar, testDrive, driftTick, endTest: () => motors.test && endTest(),
  getStats: () => ({ fps: Math.round(fps), drawCalls: R.info.render.calls, triangles: R.info.render.triangles, mode: player.mode, where: player.where, quest: quest.n, pos: { x: +(player.mode === 'drive' ? player.veh.x : player.x).toFixed(2), z: +(player.mode === 'drive' ? player.veh.z : player.z).toFixed(2) }, scale: post.scale }),
};
