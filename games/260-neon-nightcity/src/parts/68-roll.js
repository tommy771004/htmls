// ─── 翻車與堆疊 ───
// 30-vehicles.js 的車只貼地；這裡補一個簡化的翻滾：v.tumble 存在時 driveVehicle()（和 69-combat.js 沒人開的 coast）改走 rollStep()，
// 繞車身中心轉（poseVehicle 和跳台飛行同一個中心），落地彈跳、摩擦，轉慢之後停在最近的 0／±90°／180°。
// 正著停就照常開；側躺或倒扣（v.flipped）開不動：側躺時往起身那一側按住方向鍵 0.6 秒能把車推回來，倒扣 4 秒後起火（68-wreck.js 的起火階段）。
// 觸發：跳台落地翻車（69-stunt.js）、爆炸掀翻（69-combat.js 的 blast）、高速撞上別台車的側面（vehPairs）、高速撞上車流（車流車先脫離成臨時載具）。
// 堆疊：從上面落到別台車的車頂範圍內，地面高度改用那台車的車頂（surfaceH）；底下的車開走就掉下來，底下的車流車會停住。機車不翻。

const ROLL_H = .7;   // 翻轉中心離車底的高度（30-vehicles.js 的 poseVehicle 用同一個值）
const HALF_PI = Math.PI / 2;
// 車身在目前姿勢下，中心到最低點的距離：寬 w、高 2×ROLL_H、長 len 的盒子
function rollExt(v) {
  const cp = Math.abs(Math.cos(v.pitch));
  return cp * (v.w / 2 * Math.abs(Math.sin(v.roll)) + ROLL_H * Math.abs(Math.cos(v.roll))) + v.len / 2 * Math.abs(Math.sin(v.pitch));
}
// (x, z) 底下最高的車頂；roll.ref 記下是哪台（車流車要停住）
const roll = { ref: null };
function carTopAt(x, z, skip) {
  let top = -Infinity;
  roll.ref = null;
  const inside = (cx, cz, yaw, len, w) => {
    const fx = Math.sin(yaw), fz = Math.cos(yaw), dx = x - cx, dz = z - cz;
    return Math.abs(dx * fx + dz * fz) < len / 2 && Math.abs(dx * fz - dz * fx) < w / 2;
  };
  for (const v of vehicles) {
    if (v === skip || !v.isCar || v.fly || v.boat || v.g && !v.g.visible) continue;
    if (Math.abs(x - v.x) > 4 || Math.abs(z - v.z) > 4 || !inside(v.x, v.z, v.yaw, v.len, v.w)) continue;
    const t = v.y + ROLL_H + rollExt(v);
    if (t > top) { top = t; roll.ref = v; }
  }
  for (const L of [traffic, parked]) for (const c of L) {
    if (Math.abs(x - c.x) > 4 || Math.abs(z - c.z) > 4) continue;
    const ty = TYPES[c.type];
    if (!inside(c.x, c.z, c.yaw, ty.len, ty.w)) continue;
    const t = (c.y || groundH(c.x, c.z)) + (TRUCKS.includes(c.type) ? 2.4 : 1.45);   // c.y：快速道路橋面上的車流
    if (t > top) { top = t; roll.ref = c; }
  }
  return top;
}
// 車底該在的高度：地面，或從上面落到的車頂（車頂高過車底 0.35 m 以上就是撞上去，不是疊上去）
function surfaceH(v) {
  const g = deckAt(v.x, v.z, v.y) ?? groundH(v.x, v.z), t = carTopAt(v.x, v.z, v);   // 06-roads.js：快速道路的橋面
  v.onCar = t > g && t <= v.y + .35;
  if (!v.onCar) {
    v.uP = null;
    // 從車頂開下來：完全離開墊在下面的那台之前不和它碰撞（30-vehicles.js 的 vehicleCollide、69-combat.js 的 vehPairs）
    const u = v.under;
    if (u && Math.hypot(u.x - v.x, u.z - v.z) > (v.len + (u.len || TYPES[u.type].len)) / 2 + .3) v.under = null;
    return g;
  }
  const u = roll.ref;
  // 停在車頂上：跟著下面那台的位移與轉向走（它煞停前還會滑一段；從上面掉下來、還沒碰到車頂的不跟）
  if (v.y <= t + .05 && v.under === u && v.uP) { v.x += u.x - v.uP.x; v.z += u.z - v.uP.z; v.yaw += wrapA(u.yaw - v.uP.yaw); }
  v.uP = v.y <= t + .05 ? { x: u.x, z: u.z, yaw: u.yaw } : null;
  v.under = u;
  if (traffic.includes(u)) u.hit = Math.max(u.hit, .6);   // 車頂上有東西的車流車停住
  return t;
}
// 開始翻滾（已經在翻就疊加）：vy 往上的速度、rr 繞車身縱軸、pr 繞橫軸、yr 繞垂直軸（rad/s）
function rollStart(v, vy, rr, pr = 0, yr = 0) {
  if (!v.isCar || v.fly || v.boat || v.dead) return;
  if (v.tumble) { const R = v.tumble; R.vy = Math.max(R.vy, vy); R.rr += rr; R.pr += pr; R.yr += yr; return; }
  v.air = null; v.flipped = null; v.rampA = null;
  v.tumble = { vy, rr, pr, yr, t: 0 };
}
// 爆炸掀翻：k 是爆炸強度（0–1）；在車身左邊炸，車往右翻（roll 正）；在車尾炸，車尾翹起（pitch 正）
function rollKick(v, sx, sz, k) {
  if ((v.mass || 1600) > 3000) return;   // 裝甲車、貨車只推不翻
  const lx = Math.cos(v.yaw), lz = -Math.sin(v.yaw), fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  const s = (sx - v.x) * lx + (sz - v.z) * lz >= 0 ? 1 : -1, along = (v.x - sx) * fx + (v.z - sz) * fz;
  rollStart(v, 2.5 + 3.5 * k, s * (2 + 4 * k), clamp(along / 2, -1, 1) * 2 * k, (Math.random() - .5) * 2 * k);
}
// 被撞：dv 是這台車吸收的速度變化（m/s）、(nx, nz) 是被推的方向；從側面撞而且夠猛（min）才翻
function rollHit(v, dv, nx, nz, min = 13) {
  if (dv < min || !v.isCar || v.tumble || v.flipped || (v.mass || 1600) > 3000) return;
  const lat = nx * Math.cos(v.yaw) - nz * Math.sin(v.yaw);   // 往車身左邊推是正
  if (Math.abs(lat) < .7) return;
  const e = dv - min + 4;
  rollStart(v, e * .35, -Math.sign(lat) * e * .65);
}
// 高速撞上車流：車流車脫離成臨時載具（駕駛下車跑掉），吃一部分動量，夠猛就翻
function rollRam(v, c, rel, nx, nz) {
  if (!traffic.includes(c) && !parked.includes(c)) return;
  const had = traffic.includes(c), v2 = detachCar(c);
  if (had) { const lx = Math.cos(v2.yaw), lz = -Math.sin(v2.yaw); const k = spawnExtra(v2.x + lx * 1.4, v2.z + lz * 1.4, Math.atan2(lx, lz), lx * .4, lz * .4); extraSt[k].st = 'up'; extras.anim(k, ANIM.getup, -uTimeNow() - .6, 1); }
  const m1 = v.mass || 1600, m2 = v2.mass || 1600, k = m1 / (m1 + m2), dv = rel * k * 1.25;
  // 被推的方向照撞過來的車的行進方向（兩車圓心連線在斜角碰到時不準）
  const sp = Math.hypot(v.vx, v.vz); if (sp > 1) { nx = v.vx / sp; nz = v.vz / sp; }
  v2.vx += nx * dv; v2.vz += nz * dv;
  damageVeh(v2, rel * 14, v === player.veh);
  rollHit(v2, dv, nx, nz, 9);   // 停著或慢慢開的車流車被側面撞，比兩台都在跑的車容易翻
}
function rollSettle(v, tr, tp) {
  v.tumble = null;
  if (Math.abs(wrapA(tp)) > 1) { tr += Math.PI; v.yaw += Math.PI; }   // 前後翻了半圈 = 左右翻半圈再掉頭
  const r = wrapA(tr);
  v.pitch = 0; v.vx *= .3; v.vz *= .3;
  if (Math.abs(r) < .1) { v.roll = 0; v.flipped = null; }
  else {
    v.roll = r; v.vx = v.vz = 0;
    v.flipped = { t: 0, side: Math.abs(Math.abs(r) - HALF_PI) < .1 ? Math.sign(r) : 0, push: 0 };
    if (v === player.veh) toast(v.flipped.side ? '車子側翻了 · 往起身那一側按住方向鍵推回來，或按 F 下車' : '車子翻過來了 · 按住 A 或 D 翻回來，或按 F 下車');
  }
  v.y = surfaceH(v) - ROLL_H + rollExt(v);
}
// 翻滾中：重力、彈跳、摩擦，轉慢之後拉向最近的穩定姿勢（四個面之一著地、前後放平）
function rollStep(v, dt) {
  const R = v.tumble;
  R.t += dt; R.vy -= 9.8 * dt;
  v.x += v.vx * dt; v.z += v.vz * dt; v.y += R.vy * dt;
  v.roll += R.rr * dt; v.pitch += R.pr * dt; v.yaw += R.yr * dt;
  const imp = vehicleCollide(v, dt);
  const rest = surfaceH(v) - ROLL_H + rollExt(v);
  let hit = 0;
  if (v.y <= rest) {
    v.y = rest;
    if (R.vy < -1.5) {
      hit = -R.vy; R.vy *= -.3; R.rr *= .75; R.pr *= .6;
      if (Math.hypot(v.x - pX(), v.z - pZ()) < 60) { sfx.impact(Math.min(20, hit * 2)); sparks(v.x, v.y + .3, v.z, 8, 4); }
      damageVeh(v, hit * 18);
    } else R.vy = Math.max(R.vy, 0);
    const k = Math.exp(-1.8 * dt); v.vx *= k; v.vz *= k;
    R.yr *= Math.exp(-3 * dt); R.rr *= Math.exp(-.9 * dt); R.pr *= Math.exp(-1.6 * dt);
    const tr = Math.round(v.roll / HALF_PI) * HALF_PI, tp = Math.round(v.pitch / Math.PI) * Math.PI;
    if (Math.abs(R.rr) < 3) R.rr = damp(R.rr, (tr - v.roll) * 7, 6, dt);
    if (Math.abs(R.pr) < 3) R.pr = damp(R.pr, (tp - v.pitch) * 7, 6, dt);
    if (R.t > .4 && Math.abs(R.rr) < .25 && Math.abs(R.pr) < .25 && Math.abs(tr - v.roll) < .04 && Math.abs(tp - v.pitch) < .04 && R.vy < .5) rollSettle(v, tr, tp);
  }
  if (v.tumble && R.t > 8) rollSettle(v, Math.round(v.roll / HALF_PI) * HALF_PI, Math.round(v.pitch / Math.PI) * Math.PI);   // 保險：八秒還沒停就直接擺好
  v.spin += Math.hypot(v.vx, v.vz) * dt / (v.wr || .34);
  v.rpm = Math.max(.12, (v.rpm || 0) - dt);
  v.steer = damp(v.steer, 0, 4, dt); v.brakeOn = 0;
  return { imp: Math.max(imp, hit), vF: v.vx * Math.sin(v.yaw) + v.vz * Math.cos(v.yaw), aF: 0 };
}
// 側躺或倒扣：開不動；玩家側躺時往起身那一側按住方向鍵把車推回來；倒扣時按住左或右施加翻轉扭矩翻回來（69-v3-skills.js 的駕駛等級越高越快），放著不管 4 秒起火
function flipStep(v, inp, dt) {
  const F = v.flipped;
  F.t += dt;
  v.vx = v.vz = 0; v.rpm = .12; v.brakeOn = 0;
  v.y = damp(v.y, surfaceH(v) - ROLL_H + rollExt(v), 10, dt);   // 底下的車開走就掉下來
  if (F.side && inp) {
    // 69-stunt.js 的空中翻滾：方向鍵 steer 正 → 滾速負；roll 是 +90° 時往回滾要滾速負
    F.push = inp.steer * F.side > .5 ? F.push + dt : Math.max(0, F.push - dt);
    if (F.push > .6) { v.flipped = null; rollStart(v, 2.4, -F.side * 3.4); sfx.impact(6); return { imp: 0, vF: 0, aF: 0 }; }
  }
  if (!F.side && inp) {
    F.push = Math.abs(inp.steer) > .5 ? F.push + dt : Math.max(0, F.push - dt);
    if (Math.abs(inp.steer) > .5) { v.roll += Math.sign(inp.steer) * dt * .35; if (Math.random() < dt * 6) dust(v.x, v.y + .2, v.z, 1); }   // 先晃一晃
    if (F.push > 1.3 - .7 * sk('drv')) {
      // 翻回來：照騰空時間（上拋 4.1 m/s）算滾速，落地時差一點點轉正，剩下的交給 rollStep 落地後擺正（滾太快會一路滾到側躺）
      const dir = -Math.sign(inp.steer), tgt = Math.round((v.roll + dir * Math.PI) / (Math.PI * 2)) * Math.PI * 2;
      v.flipped = null; rollStart(v, 4.1, (tgt - v.roll) / (2 * 4.1 / 9.8) * .9); sfx.impact(8); return { imp: 0, vF: 0, aF: 0 };
    }
  }
  if (!F.side && F.t > 4 && !(F.push > 0) && !v.dead) { const want = hpLockOf(v) * STAGE.fire * .9; if (v.hp > want) damageVeh(v, v.hp - want); }
  return { imp: 0, vF: 0, aF: 0 };
}
// 沒人開的車（69-combat.js 的 coast 先問這裡）：翻滾、翻倒或疊在車頂上的車自己處理，回傳 true 表示處理過了
function rollIdle(v, dt) {
  if (v.tumble) { rollStep(v, dt); return true; }
  if (v.flipped) { flipStep(v, null, dt); return true; }
  if (v.onCar) v.y = damp(v.y, surfaceH(v), 12, dt);
  return false;
}
// 傳送、修車、換車：擺正
function rollClear(v) { v.tumble = v.flipped = v.under = v.uP = null; v.roll = v.pitch = 0; v.onCar = false; }
// 測試 API（window.__nc.gta.roll）
const rollApi = {
  get st() { const v = player.veh; return v && { tumble: !!v.tumble, flipped: v.flipped && { side: v.flipped.side, t: +v.flipped.t.toFixed(2) }, roll: +wrapA(v.roll).toFixed(2), pitch: +v.pitch.toFixed(2), y: +v.y.toFixed(2), onCar: !!v.onCar }; },
  kick: (v = player.veh, k = 1, side = 1) => rollKick(v, v.x + Math.cos(v.yaw) * side * 2, v.z - Math.sin(v.yaw) * side * 2, k),
  start: rollStart, hit: rollHit, top: carTopAt, surf: surfaceH, fix: v => wreckFix(v),
};
