// ─── 車損細節（neon_nightcity_gta_v_2.md 第一節）：損壞階段、單顆輪胎、撞人的傷害與擊飛 ───
// 冒煙與起火的粒子仍在 68-gta.js 的 vehDamage；這裡管每個階段對車子本身的影響

// 起火後的 AI 車：沒人踩油門，輕輕帶著煞車滑到停
const BAIL_INP = { thr: 0, brk: .25, steer: 0, hb: false };
// 耐久上限：車流造的車（buildVeh）之後會被各模組改 hp（運鈔車 2600、搶劫逃亡車 2400…），所以第一次受損或第一次檢查時才把當時的 hp 當上限
function hpLockOf(v) {
  if (!v.hpLock) { v.hpLock = 1; v.hpMax = Math.max(1, v.hp > 0 ? v.hp : v.hpMax || HP); }
  return v.hpMax || HP;
}
function wreckStage(v, k, dt) {
  const mine = v === player.veh;
  // 60%：車窗碎掉（一次）
  if (k < STAGE.glass && !v.glass) {
    v.glass = 1;
    glassBurst(v.x, v.y + (v.isCar ? 1.15 : .9), v.z);
    if (Math.hypot(v.x - pX(), v.z - pZ()) < 40) sfx.glass();
  }
  // 30%：動力只剩七成五，偶爾熄火半秒到一秒
  if (k < STAGE.black) {
    if (v.stall > 0) { v.stall -= dt; if (v.stall <= 0 && mine) sfx.engineOn(v); }   // 熄火結束：重新發動（引擎聲原本熄了就不會回來）
    else if (Math.random() < dt * .12) { v.stall = .5 + Math.random() * .7; if (mine) { sfx.engineOff(); toast('引擎熄火了一下'); } }
    v.engK = v.stall > 0 ? 0 : .75;
  } else { v.engK = 1; v.stall = 0; }
  // 12%：起火，駕駛跳車（玩家自己決定要不要下車）
  if (k < STAGE.fire && !v.bail) {
    v.bail = 1;
    if (mine) toast('車子起火了 · 快按 F 下車');
    else bailOut(v);
  }
}
// 車上的 AI 都下車：警察、幫派／傭兵小隊（運鈔車與賽車的駕駛沒有人物，車子停下就好）
function bailOut(v) {
  if (v.unit) { crewOut(v.unit); return; }
  const c = SQ.cars.find(c => c.v === v);
  if (c) unload(c);
}
// 修車（叫車、技師送車）：耐久、車窗、引擎、輪胎都回到新的
function wreckFix(v) {
  hpLockOf(v);
  v.dead = 0; v.burn = 0; v.hp = v.hpMax;
  v.glass = 0; v.engK = 1; v.stall = 0; v.bail = 0; v.axle = 0; v.axleYr = 0;   // axle：69-v6-customs.js 撞歪的輪軸
  tireFix(v); rollClear(v);   // 68-roll.js：翻倒的車也擺正
}

// ─── 單顆輪胎（第一節第 4 點）：每顆 50 點，子彈打到輪胎附近就扣那一顆；破一顆極速 ×(1 − 0.15)、抓地少一截，車頭往破的那側偏 ───
const TIRE_HP = 50;
// 輪胎的車身局部座標（+x = 車子的左邊、+z = 車頭）：有輪子物件就照輪子擺的位置，搶來的車流車沒有，照車寬車長估
function tireList(v) {
  if (v.tires) return v.tires;
  const W = v.w ?? TYPES[v.type].w, L = v.len ?? TYPES[v.type].len, bike = v.isCar === false;
  const at = v.wheels && v.wheels.length ? v.wheels.map(w => ({ x: w.piv.position.x, z: w.piv.position.z, front: !!w.front, w }))
    : bike ? [{ x: 0, z: L * .36, front: true }, { x: 0, z: -L * .36, front: false }]
    : [1, -1].flatMap(s => [{ x: s * W * .41, z: L * .32, front: true }, { x: s * W * .41, z: -L * .32, front: false }]);
  return (v.tires = at.map(t => ({ ...t, hp: TIRE_HP, flat: 0 })));
}
const tireName = (v, t) => v.isCar === false ? (t.front ? '前輪' : '後輪') : (t.x > 0 ? '左' : '右') + (t.front ? '前輪' : '後輪');
// 打到的點在哪一顆輪胎上（半徑 .55 m、離地 .8 m 以內）
function tireAt(ref, x, y, z) {
  if (y - (ref.y || 0) > .8 || ref.boat || ref.fly || ref.bpTires) return null;   // bpTires：防彈輪胎（69-heist2.js），子彈打在車身
  const dx = x - ref.x, dz = z - ref.z, c = Math.cos(ref.yaw), s = Math.sin(ref.yaw);
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  let best = null, bd = .55;
  for (const t of tireList(ref)) { const d = Math.hypot(lx - t.x, lz - t.z); if (d < bd) { bd = d; best = t; } }
  return best;
}
// 子彈打到輪胎：回傳 true 表示這發算在輪胎上（車身不再扣血）；車流與路邊車先脫離成臨時載具，駕駛跳車
function tireShot(ref, x, y, z, dmg, mine) {
  const t0 = tireAt(ref, x, y, z);
  if (!t0) return false;
  let v = ref;
  if (!vehicles.includes(ref)) {
    const had = traffic.includes(ref);
    v = detachCar(ref);
    if (had) { const lx = Math.cos(v.yaw), lz = -Math.sin(v.yaw); spawnExtra(v.x + lx * 1.4, v.z + lz * 1.4, Math.atan2(lx, lz), lx * .4, lz * .4); }
  }
  if (mine) v.byP = uTimeNow();
  const t = v === ref ? t0 : tireList(v)[tireList(ref).indexOf(t0)];   // 脫離後的車照同樣的車寬車長估輪胎，順序一樣
  if (!t || t.flat) return true;
  t.hp -= dmg;
  if (t.hp <= 0) tireBurst(v, t);
  return true;
}
function tireBurst(v, t, quiet = false) {
  t.flat = 1; t.hp = 0;
  if (t.w && t.w.piv.userData.y0 == null) { t.w.piv.userData.y0 = t.w.piv.position.y; t.w.piv.position.y -= .07; }   // 輪框貼近地面
  tireApply(v);
  if (quiet) return;
  const c = Math.cos(v.yaw), s = Math.sin(v.yaw), wx = v.x + t.x * c + t.z * s, wz = v.z - t.x * s + t.z * c;
  sparks(wx, v.y + .3, wz, 10, 4); dust(wx, v.y + .2, wz, 3);
  if (Math.hypot(wx - pX(), wz - pZ()) < 60) sfx.impact(6);
  if (v === player.veh) toast(`${tireName(v, t)}爆胎了`);
}
// 依破掉的輪胎重算：極速 ×(1 − 0.15·N)、抓地按破胎比例最多少 55%、偏轉力矩（前輪拖得比後輪重）、車身下沉
function tireApply(v) {
  const T = tireList(v), F = T.filter(t => t.flat), n = F.length;
  v.flatBase ??= { vmax: v.vmax, grip: v.grip };
  v.flat = n;
  v.vmax = v.flatBase.vmax * Math.max(.3, 1 - .15 * n);
  v.grip = v.flatBase.grip * (1 - .55 * n / T.length);
  let pull = 0, sR = 0, sP = 0;
  for (const t of F) { const side = Math.sign(t.x); pull += side * (t.front ? .26 : .16); sR -= side * .035; sP += t.front ? .022 : -.022; }
  v.flatYr = v.isCar === false ? 0 : pull; v.sagR = sR; v.sagP = sP;
}
// 換車：新的輪胎（不還原極速，因為 applyCar 剛照新車設好）
function tireReset(v) {
  if (v.tires) for (const t of v.tires) if (t.w && t.w.piv.userData.y0 != null) { t.w.piv.position.y = t.w.piv.userData.y0; t.w.piv.userData.y0 = null; }
  v.tires = null; v.flatBase = null; v.flat = 0; v.flatYr = 0; v.sagR = 0; v.sagP = 0;
}
// 修車：極速與抓地回到破胎前
function tireFix(v) {
  if (v.flatBase) { v.vmax = v.flatBase.vmax; v.grip = v.flatBase.grip; }
  tireReset(v);
}

// ─── 開車撞人（第一節第 5 點）：傷害 D = 1.8·v²，8 m/s（D ≈ 115）以上致命；擊飛速度 = 1.15·v車，往上 min(12, .45·|v|) ───
const RAM_K = 1.8, RAM_KILL = 115;
// 回傳 true：撞死了（算 kill）；false：撞倒後幾秒爬起來逃跑（算 assault）
function pedRam(k, v, sp) {
  const ps = pedState[k];
  if (!ps || ps.down > 0) return false;
  const D = RAM_K * sp * sp, dead = D >= RAM_KILL;
  knockPed(k, v.vx / sp, v.vz / sp);
  const p = peds.people[k], base = groundH(p.x, p.z) > 0 ? .15 : 0;
  ps.dpos[0] = p.x; ps.dpos[1] = p.z;   // 從被撞的位置飛出去（knockPed 預設往前挪了 .6 m）
  ps.fly = { vx: v.vx * 1.15, vz: v.vz * 1.15, vy: Math.min(12, .45 * sp), y: base, spin: 0 };
  if (!dead) { ps.down = 3.5 + Math.min(3, sp * .3); ps.stun = 1; }   // 沒死：落地躺一下，爬起來逃跑（40-people.js 的 stun 流程）
  if (dead && sp > 14) blood(p.x, 1, p.z);
  v5Blood(v);   // 69-v5-shops.js：車頭沾血
  return dead;
}
function wreckUpdate(dt) {
  for (const ps of pedState) {
    const f = ps.fly;
    if (!f) continue;
    if (!(ps.down > 0)) { ps.fly = null; continue; }
    f.vy -= 9.8 * dt; f.y += f.vy * dt;
    const r = collideCircle(ps.dpos[0] + f.vx * dt, ps.dpos[1] + f.vz * dt, .3, false);
    if (Math.abs(r.x - ps.dpos[0] - f.vx * dt) + Math.abs(r.z - ps.dpos[1] - f.vz * dt) > 1e-3) { f.vx *= -.3; f.vz *= -.3; }   // 撞牆彈回來
    ps.dpos[0] = r.x; ps.dpos[1] = r.z;
    const base = groundH(r.x, r.z) > 0 ? .15 : 0;
    if (f.y <= base) {
      f.y = base;
      if (f.vy < -3) { f.vy *= -.25; f.vx *= .5; f.vz *= .5; dust(r.x, base + .1, r.z, 2); }   // 落地彈一下
      else { f.vy = 0; const kf = Math.exp(-6 * dt); f.vx *= kf; f.vz *= kf; if (Math.hypot(f.vx, f.vz) < .2) ps.fly = null; }   // 在地上滑到停
    }
  }
}

// 測試 API（window.__nc.gta.wreck）：tools/check-gta-v2.mjs 用
gtaApi.wreck = {
  VCLASS, STAGE, BOOM_R, TIRE_HP, vmaxFor,
  tires: v => tireList(v).map(t => ({ x: t.x, z: t.z, front: t.front, hp: t.hp, flat: t.flat })),
  // 第 i 顆輪胎的世界座標（離地 .35 m），拿來對準射擊
  tirePos(v, i) { const t = tireList(v)[i], c = Math.cos(v.yaw), s = Math.sin(v.yaw); return { x: v.x + t.x * c + t.z * s, y: (v.y || 0) + .35, z: v.z - t.x * s + t.z * c }; },
  shootTire(v, i, dmg = 28) { const p = this.tirePos(v, i); return tireShot(v, p.x, p.y, p.z, dmg, true); },
  fix: v => wreckFix(v), hpMax: v => hpLockOf(v),
  RAM_K, RAM_KILL,
  // 讓第 k 個路人被車 v 以 sp m/s 撞到（不檢查距離）
  ram(k, sp) { const v = player.veh || vehicles[0]; v.vx = Math.sin(v.yaw) * sp; v.vz = Math.cos(v.yaw) * sp; return pedRam(k, v, sp); },
  ped: k => { const ps = pedState[k]; return { down: ps.down, fly: ps.fly && { ...ps.fly }, x: ps.dpos && ps.dpos[0], z: ps.dpos && ps.dpos[1] }; },
};
