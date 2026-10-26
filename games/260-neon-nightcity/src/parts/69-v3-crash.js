// ═══ 第三部曲之三：撞擊與騰空（飛出擋風玻璃與安全帶、機車摔車、高速子步防穿模、翻越矮牆與停著的車、從直升機跳傘） ═══
// 玩家在空中（被拋出去、自由落體、開傘）時 player.air3 有值，40-people.js 的 updatePlayerWalk 交給 airStep。
// 規格書的門檻數字遺失，這裡用 CR_* 常數（README「第三部曲」一節）。

const CR_EJECT_DV = 20;     // 汽車正面撞擊：一幀內前進方向少了 20 m/s 以上（約 72 km/h）就飛出擋風玻璃
const CR_EJECT_V0 = 19;     // 而且撞之前時速要在 68 km/h 以上
const CR_BIKE_DV = 10;      // 機車：任何方向一幀內速度變化 10 m/s 以上，騎士摔出去
const CR_BELT_T = 2;        // 上車後停著 2 秒繫好安全帶（之後撞車不會飛出去；機車沒有）
const SKY_MIN = 22;         // 直升機離地 22 m 以上按 F 跳傘
const SKY_TERM = 52, CHUTE_VY = -5.2, CHUTE_FAST = -9, CHUTE_SP = 8.5;   // 自由落體終端速度、開傘後的下降速度（按 Shift 精準降落較快）、滑翔速度

// ─── 子步：一幀走超過半個車身半徑就切成幾步算（時速 300 在 30 fps 一幀 2.8 m，會穿過路燈、柱子與薄牆） ───
function driveSub(v, inp, dt) {
  breakSweep(v, dt);
  const n = Math.min(5, Math.ceil(Math.hypot(v.vx, v.vz) * dt / (v.rad * .5)) || 1);
  if (n <= 1) return driveVehicle(v, inp, dt);
  let r, imp = 0;
  for (let i = 0; i < n; i++) { r = driveVehicle(v, inp, dt / n); imp = Math.max(imp, r.imp); if (v.tumble || v.air || v.flipped) break; }
  r.imp = imp; return r;
}

// ─── 安全帶與撞擊拋出 ───
const crash = { pvx: 0, pvz: 0, veh: null, car: null, still: 0, belt: false };
function crashStep(dt) {
  const v = player.mode === 'drive' ? player.veh : null;
  if (!v || v.fly || v.boat || player.where !== 'out') { crash.veh = null; return; }
  if (crash.veh !== v || crash.car !== v.carId) { crash.veh = v; crash.car = v.carId; crash.still = 0;   // 同一台座駕換了車型（applyCar）也從頭量，不沿用上一台的速度
    crash.belt = false; crash.pvx = v.vx; crash.pvz = v.vz; return; }
  if (!crash.belt && v.isCar) {
    crash.still = Math.hypot(v.vx, v.vz) < 1 ? crash.still + dt : 0;
    if (crash.still > CR_BELT_T) { crash.belt = true; toast('繫好安全帶了'); sfx.click(); }
  }
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), v0 = crash.pvx * fx + crash.pvz * fz;
  const dvx = crash.pvx - v.vx, dvz = crash.pvz - v.vz, dF = dvx * fx + dvz * fz, dv = Math.hypot(dvx, dvz);
  crash.pvx = v.vx; crash.pvz = v.vz;
  if (v.tumble || v.air || life.dead) return;
  if (v.isCar && !v.armored && !crash.belt && v0 > CR_EJECT_V0 && dF > CR_EJECT_DV) ejectPlayer(v, v0, dF, true);
  else if (!v.isCar && dv > CR_BIKE_DV) ejectPlayer(v, Math.hypot(crash.pvx, crash.pvz) + dv, dv, false);
}
function ejectPlayer(v, v0, dv, car) {
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  if (car) glassBurst(v.x + fx * v.len * .35, v.y + 1.2, v.z + fz * v.len * .35);
  exitVehicle();
  const sp = clamp(v0 * .55, 7, 22);
  player.x = v.x + fx * (car ? v.len * .5 + .4 : .8); player.z = v.z + fz * (car ? v.len * .5 + .4 : .8);
  const r = collideCircle(player.x, player.z, .32, false); player.x = r.x; player.z = r.z;
  player.y = v.y + (car ? 1.1 : 1);
  player.air3 = { kind: 'eject', vx: fx * sp, vy: clamp(dv * .25, 3, 7), vz: fz * sp, dmg: (dv - 6) * 3.2, t: 0 };
  player.yaw = v.yaw; player.down = 99; player.downPh = -uTimeNow(); player.gotUp = 0; player.kx = player.kz = 0;
  gta.aiming = false; sfx.impact(18); camState.shake = 1;
  toast(car ? '撞得太猛，人從擋風玻璃飛了出去（停車兩秒會自動繫上安全帶）' : '摔車了');
}

// ─── 空中：被拋出去、自由落體、開傘滑翔 ───
const chute = (() => {
  const k = new Kit();
  for (let i = 0; i < 7; i++) {   // 七片拱起的傘翼，紅白相間
    const a = (i - 3) * .2, x = Math.sin(a) * 3.6, y = Math.cos(a) * 1.4 - 1.4;
    k.box(x, y, 0, 1.06, .1, 2.3, i % 2 ? 0xe9e5dc : 0xc8402c, 2, 0, 0, -a * 1.6);
  }
  for (const s of [-1, 1]) for (const z of [-.9, .9]) k.box(s * 1.8, -2.1, z * .6, .02, 3.6, .02, 0x777777, 2, 0, 0, s * .45);   // 傘繩
  const m = new T.Mesh(k.build(), MAT.uber); m.visible = false; scene.add(m); return m;
})();
function skyBail() {
  const v = player.veh, alt = v.y - Math.max(groundH(v.x, v.z), roofH(v.x, v.z));
  if (alt < SKY_MIN) return false;
  const vx = v.vx, vz = v.vz, y = v.y;
  exitVehicle();
  player.x = v.x + Math.cos(v.yaw) * 1.6; player.z = v.z - Math.sin(v.yaw) * 1.6; player.y = y - .5;
  player.air3 = { kind: 'fall', vx, vy: -1, vz, t: 0 };
  sfx.swoosh(false);
  toast('自由落體 · 按 F 或空白鍵開傘，WASD 控制方向');
  return true;
}
function chuteOpen() {
  const A = player.air3;
  if (!A || A.kind !== 'fall' || A.t < .4) return false;
  A.kind = 'chute'; A.vy = Math.max(A.vy, -14); sfx.whoosh(); camState.shake = .4;
  toast('開傘 · A／D 轉向、W 加速下降、S 減速、按住 Shift 精準降落');
  return true;
}
function airFloor(x, z) {
  const g = groundH(x, z), w = waterDepth(x, z) > 0 ? SEA_Y : -1e9;
  return Math.max(g, w);
}
function airStep(inp, dt, camYaw) {
  const A = player.air3;
  A.t += dt;
  const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -fz, rz = fx;
  if (A.kind === 'eject') { A.vy -= 9.8 * dt; }
  else if (A.kind === 'fall') {
    A.vy = Math.max(-SKY_TERM, A.vy - 9.8 * dt);
    const ax = (fx * inp.mz + rx * inp.mx) * 7, az = (fz * inp.mz + rz * inp.mx) * 7;   // 往鏡頭方向俯衝
    A.vx = (A.vx + ax * dt) * Math.exp(-.35 * dt); A.vz = (A.vz + az * dt) * Math.exp(-.35 * dt);
    if (Math.abs(inp.mx) + Math.abs(inp.mz) > .1) player.yaw += wrapA(Math.atan2(A.vx, A.vz) - player.yaw) * (1 - Math.exp(-4 * dt));
  } else {   // 開傘：沿著面向滑翔
    player.yaw -= inp.mx * 1.25 * dt;
    const sp = CHUTE_SP * (inp.mz > 0 ? 1.35 : inp.mz < 0 ? .55 : 1), want = inp.run ? CHUTE_FAST : inp.mz > 0 ? -7 : inp.mz < 0 ? -3.6 : CHUTE_VY;
    A.vy = damp(A.vy, want, 1.6, dt);
    A.vx = damp(A.vx, Math.sin(player.yaw) * sp, 1.2, dt); A.vz = damp(A.vz, Math.cos(player.yaw) * sp, 1.2, dt);
  }
  let x = player.x + A.vx * dt, z = player.z + A.vz * dt, y = player.y + A.vy * dt;
  if (A.land && y < A.land.y) { player.x = x; player.z = z; player.y = A.land.y; return A.land.fn(); }   // 指定的落點（69-w5-fin.js 雙人跳的泳池）：比屋頂、地面先接住
  // 樓：高度圖比人高就擋住水平移動；開傘時落在屋頂上順著滑出去（屋頂沒有走路的地面）
  const roof = roofH(x, z), floor = airFloor(x, z);
  if (roof > y + .2 && roof > floor + 1.5) { x = player.x; z = player.z; A.vx *= -.2; A.vz *= -.2; }
  else if (roof > floor + 1.5 && y < roof + .3) {
    if (A.kind === 'chute') { y = roof + .3; A.vy = Math.max(A.vy, 0); }
    else { player.x = x; player.z = z; player.y = roof; return airLand(A, -A.vy, true); }
  }
  // 地面附近才擋路燈、車與牆（樓的高度上面已經用高度圖擋了；在屋頂上空時碰撞盒會把人推出樓的範圍，卡在屋簷）
  if (y < floor + 2.2) { const r = collideCircle(x, z, .32, false); x = r.x; z = r.z; }
  player.x = x; player.z = z; player.y = y;
  if (y <= floor) { player.y = floor; return airLand(A, -A.vy, false); }
  // 姿勢與傘
  const anim = A.kind === 'eject' ? ANIM.die : A.kind === 'fall' ? ANIM.swimIdle : ANIM.handsUp;
  me.anim(0, anim, A.kind === 'eject' ? player.downPh : -uTimeNow(), 1); me.anim2(0, 0, 0);
  me.place(0, player.x, player.y, player.z, player.yaw); me.flush();
  chute.visible = A.kind === 'chute';
  if (chute.visible) { chute.position.set(player.x, player.y + 5.6, player.z); chute.rotation.set(0, player.yaw + Math.PI / 2, 0); }
}
function airLand(A, vy, roof) {
  player.air3 = null; chute.visible = false;
  const water = waterDepth(player.x, player.z) > 0;
  if (roof && A.kind !== 'chute') { die('wasted'); return; }
  if (water) { sfx.splash(1); waterSplash(player.x, player.z, 1.2); player.down = 0; player.anim = -1; return; }
  let dmg = A.kind === 'eject' ? A.dmg : A.kind === 'chute' ? (vy > 8 ? (vy - 8) * 6 : 0) : (vy - 9) * 6;
  dmg *= skK.take;
  sfx.impact(Math.min(20, vy * 1.4), 'body'); dust(player.x, player.y + .1, player.z, 6);
  if (A.kind === 'chute' && dmg <= 0) { player.down = 0; player.anim = -1; toast('漂亮落地'); return; }
  player.down = A.kind === 'chute' ? 1.4 : 2.6; player.downPh = -uTimeNow(); player.gotUp = 0; player.kx = A.vx * .3; player.kz = A.vz * .3;
  if (dmg > 0) hurtPlayer(dmg);
}

// ─── 翻越：走路時按空白鍵，前方 1 m 內的矮牆、護欄或停著的車（厚度 2.6 m 以內）翻過去 ───
const vault = { on: null };
function insideBox(b, x, z) { const [lx, lz] = b.f ? toL(x, z, b.f) : [x, z]; return lx > b.x0 && lx < b.x1 && lz > b.z0 && lz < b.z1; }
function carAtPt(x, z) {
  for (const c of [...parked, ...traffic]) {
    if (traffic.includes(c) && c.v > .5) continue;
    const dx = x - c.x, dz = z - c.z, fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    if (Math.abs(dx * fz - dz * fx) < TYPES[c.type].w / 2 && Math.abs(dx * fx + dz * fz) < TYPES[c.type].len / 2) return c;
  }
  for (const v of vehicles) {
    if (v === player.veh || Math.hypot(v.vx, v.vz) > .5 || v.fly || v.boat) continue;
    const dx = x - v.x, dz = z - v.z, fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
    if (Math.abs(dx * fz - dz * fx) < v.w / 2 && Math.abs(dx * fx + dz * fz) < v.len / 2) return v;
  }
  return null;
}
function vaultTry() {
  if (player.mode !== 'walk' || player.where !== 'out' || player.swim || player.down > 0 || vault.on || player.air3 || gta.jack) return false;
  const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
  // 前方 0.3–1.1 m 先碰到障礙：矮牆（low）或停著的車；再往前找到出口（障礙後面 0.5 m 是空地）
  let what = null, y = 1, s0 = 0;
  for (let s = .3; s <= 1.1 && !what; s += .1) {
    const x = player.x + fx * s, z = player.z + fz * s;
    const b = boxesNear(x, z, .1).find(o => insideBox(o, x, z));
    if (b) { if (!b.low) return false; what = b; s0 = s; }
    else { const c = carAtPt(x, z); if (c) { what = c; s0 = s; y = c.type && TRUCKS.includes(c.type) ? 2.4 : 1.5; } }
  }
  if (!what) return false;
  let s1 = 0;
  for (let s = s0; s <= s0 + 2.6; s += .1) { const x = player.x + fx * s, z = player.z + fz * s; if (!(what.x0 != null ? insideBox(what, x, z) : carAtPt(x, z) === what)) { s1 = s + .5; break; } }
  if (!s1) { toast('太厚了，翻不過去'); return true; }
  const tx = player.x + fx * s1, tz = player.z + fz * s1, r = collideCircle(tx, tz, .32, false, true);
  if (Math.hypot(r.x - tx, r.z - tz) > .25) return false;
  vault.on = { t: 0, T: .45 + s1 * .12, x0: player.x, z0: player.z, x1: tx, z1: tz, y0: player.y, h: y + .2 };
  player.crouch = false; sfx.whoosh(); skUp('sta', .1);
  return true;
}
function vaultStep(dt) {
  const V = vault.on; if (!V) return false;
  V.t += dt; const u = clamp(V.t / V.T, 0, 1);
  player.x = lerp(V.x0, V.x1, u); player.z = lerp(V.z0, V.z1, u);
  const gy = groundH(player.x, player.z);
  player.y = lerp(V.y0, gy, u) + Math.sin(u * Math.PI) * V.h;
  me.anim(0, ANIM.run, -uTimeNow() + V.t, 1); me.anim2(0, 0, 0);
  me.place(0, player.x, player.y, player.z, player.yaw); me.flush();
  if (u >= 1) { vault.on = null; player.anim = -1; }
  return true;
}

// ─── 按鍵（69-combat.js 的 gtaKey 最前面問這裡） ───
function crashKey(code) {
  if (player.air3) { if ((code === 'KeyF' || code === 'Space') && chuteOpen()) return true; return code === 'KeyF' || code === 'Space'; }
  if (code === 'Space' && player.mode === 'walk' && vaultTry()) return true;
  return false;
}
function crashUpdate(dt) {
  crashStep(dt);
  if (player.air3 && (player.mode !== 'walk' || life.dead)) { player.air3 = null; chute.visible = false; if (!life.dead) player.down = 0; }   // 還在空中就上了車：拋出時的 down = 99 不清掉會一直躺著
}
const crashApi = { crash, vault, chute, eject: (dv = 26) => { const v = player.veh; if (!v) return false; crash.belt = false; ejectPlayer(v, 25, dv, v.isCar); return true; }, bail: skyBail, open: chuteOpen, tryVault: vaultTry, sub: driveSub };
