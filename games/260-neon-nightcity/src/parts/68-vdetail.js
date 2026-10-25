// ─── 車輛細節：短按／長按 F、原地燒胎與甜甜圈、濕沙卡軸、泡水 ───
// 30-vehicles.js 的 driveVehicle 每一步先問 vdPre（燒胎、甜甜圈、卡軸改寫前進速度與轉向，沙地的阻力），落地高度交給 vdWater（下水、沉車）；
// 99-main.js 的 F 在車上時交給 vdKeyF，每幀 vdUpdate（F 的長短按、下車不熄火的引擎、燒胎煙、沉車逼玩家下車）

const VD_HOLD_T = .45;              // 按住 F 這麼久才算長按：下車不熄火（大燈亮著、引擎聲留著，回來上車不用重新發動）
const VD_IDLE_R = 60;               // 不熄火的車：走遠超過這個距離（或進室內、上別台車）就自己熄掉
const BURN_V = 3;                   // 車速低於這個值（m/s）拉手煞催油：原地燒胎；打方向是甜甜圈（繞前軸轉）
const DONUT_YR = 2.3;               // 甜甜圈的轉速（rad/s）
const LAUNCH_T = 1, LAUNCH_V = 7;   // 燒胎 1 秒以上、油門不放只放手煞：彈射起步（m/s）
const SAND_DRY = 36, SAND_D1 = 56;  // 沙灘從岸邊量起：36 m 以內是乾沙，36–56 m 是濕沙（水線在 48 m）
const SAND_KMH = 14, SAND_T = 1.4;  // 濕沙上低於這個時速催油（或倒車）這麼久：輪子刨進沙裡卡住
const ROCK_N = 3, ROCK_T = 4;       // 卡住後 4 秒內前後換向 3 次搖出來
const ROCK_V = 4.5, ROCK_COOL = 4;  // 搖出來的那一下的速度，和之後幾秒內不會再陷
const FLOOD_D = .45, FLOOD_BIKE = .35, FLOOD_T = 2, FLOOD_NOW = .8;   // 水深超過門檻撐 2 秒（或一下子超過 0.8 m）：引擎進水熄火
const SINK_D = 1, SINK_T = 1.5, SINK_V = 1.2;   // 水深超過 1 m：車廂進水，1.5 秒後玩家被迫下車游泳；比地面深的地方以 1.2 m/s 沉下去
const FLOOD_INP = { thr: 0, brk: 0, steer: 0, hb: false };
const vd = { f: null, idle: null, puffT: 0, burnT: 0, donut: 0, dYaw: 0, sandT: 0, smokeT: 0, sinkT: 0 };

// 沙灘上從岸邊量起的距離（不在沙灘那一條上是 -1）：和 10-city.js 的 groundH 一樣先換到最近那一片的邏輯座標
function vdBeachD(X, Z) {
  const zn = zoneAtW(X, Z);
  if (!zn && inCity(X, Z)) return -1;
  const [x, z] = zoneLocal(zn || zoneNearW(X, Z), X, Z);
  return x >= BEACH.x0 && x <= BEACH.x1 && z > BEACH.z0 ? z - BEACH.z0 : -1;
}

// driveVehicle 一開始（vF 是這一步加速前的前進速度）：沙地阻力寫在 v.vdK／v.vdDrag，回傳要改寫的速度與轉向（沒有就是 null）
function vdPre(v, inp, dt, vF) {
  v.vdK = 1; v.vdDrag = 0; v.burnout = 0;
  if (v !== player.veh) return null;   // AI 的車也走 driveVehicle：不能動到玩家的計時
  if (player.where !== 'out' || v.flood) { vd.burnT = 0; return null; }
  const d = vdBeachD(v.x, v.z), kmh = Math.abs(vF) * 3.6, mz = inp.thr - inp.brk;
  if (d >= 0) {   // 沙地：乾沙吃掉一點動力，濕沙吃掉大半、低速時特別黏
    const wet = d >= SAND_DRY && d <= SAND_D1;
    v.vdK = wet ? .4 : .7; v.vdDrag = wet ? lerp(5, 3, clamp(Math.abs(vF) / 10, 0, 1)) : 1.2;
    if (wet && !v.stuck && !(vd.cool > 0) && mz && kmh < SAND_KMH) {
      if ((vd.sandT += dt) > SAND_T) { v.stuck = { t: 0, dir: Math.sign(mz), at: [], off: 0 }; vd.sandT = 0; toast('輪子陷進濕沙了 · W／S 前後交替搖出來'); }
    } else vd.sandT = Math.max(0, vd.sandT - dt);
  } else { vd.sandT = 0; if (v.stuck) v.stuck = null; }
  // 卡軸：輪子空轉，車身只隨著搖車前後晃一點點
  if (v.stuck) {
    const s = v.stuck; s.t += dt;
    if (mz && Math.sign(mz) !== s.dir) { s.dir = Math.sign(mz); s.at.push(s.t); }
    s.at = s.at.filter(t => t > s.t - ROCK_T);
    if (s.at.length >= ROCK_N) { v.stuck = null; vd.cool = ROCK_COOL; toast('搖出來了'); return { vF: s.dir * ROCK_V }; }
    const w = clamp(mz * .8, (-.25 - s.off) / dt, (.25 - s.off) / dt); s.off += w * dt;
    return { vF: w, vR: 0, slip: mz ? 6 : 0, spin: mz * 30, rpm: mz ? .88 : .2 };
  }
  // 原地燒胎：手煞拉著、油門踩到底；打方向就繞著前軸甩成甜甜圈
  if (inp.hb && inp.thr > 0 && Math.abs(vF) < BURN_V) {
    v.burnout = 1; vd.burnT += dt;
    const yr = damp(v.yr || 0, inp.steer * DONUT_YR, 4, dt);
    if (inp.steer) {
      vd.dYaw += yr * dt;
      if (Math.abs(vd.dYaw) >= Math.PI * 2) { vd.dYaw -= Math.sign(vd.dYaw) * Math.PI * 2; vd.donut++; toast(`甜甜圈 ×${vd.donut}`); }
    }
    return { vF: 0, vR: 0, yr, piv: !!inp.steer, slip: 7, spin: 60, rpm: .95 };
  }
  const t = vd.burnT; vd.burnT = 0; vd.donut = 0; vd.dYaw = 0;
  if (t >= LAUNCH_T && inp.thr > 0 && !inp.hb) return { min: LAUNCH_V };   // 燒熱的胎彈射起步
  return null;
}

// driveVehicle 算完地面高度 gh 之後：在水裡時回傳車身的新高度（沒下水回傳 null，照原本的 damp）
// 每台在 driveVehicle 裡跑的車都算（被追進海裡的警車一樣會熄火），船與直升機不走 driveVehicle
function vdWater(v, dt, gh) {
  if (v === player.veh && player.where !== 'out') return null;
  const f = seaFloor(v.x, v.z), d = SEA_Y - f;
  if (d <= .05 || deckAt(v.x, v.z, v.y) != null) { v.wetIn = 0; v.floodT = 0; return null; }   // 橋面（06-roads.js 的 deckAt）上不算下水
  const sp = Math.hypot(v.vx, v.vz), mine = v === player.veh;
  if (!v.wetIn && sp > 4) { waterSplash(v.x, v.z, clamp(sp / 12, .5, 1.5)); if (Math.hypot(v.x - pX(), v.z - pZ()) < 60) sfx.splash(clamp(sp / 14, .3, 1)); }
  v.wetIn = 1;
  // 水的阻力（越深越重），開著走的時候車頭推出水花
  const k = Math.exp(-.9 * Math.min(d, 1.5) * dt); v.vx *= k; v.vz *= k;
  if (sp > 1.5 && d < 1.6 && (v.wakeT = (v.wakeT || 0) - dt) <= 0) {
    v.wakeT = .09;
    const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), L = (v.len || 4) * .5;
    wakeAdd(v.x + fx * L, v.z + fz * L, -v.vz * .08, v.vx * .08, .8, 2 + sp * .15, 2.2, 0, clamp(sp / 10, .3, .9));
    emit('spray', v.x + fx * L, SEA_Y + .1, v.z + fz * L, { vx: fx * sp * .4 + (Math.random() - .5) * 2, vy: 1.5 + sp * .15, vz: fz * sp * .4 + (Math.random() - .5) * 2, max: .7, s0: .2, s1: .6, grav: 9, drag: .6, a: .6, sea: 1 });
  }
  // 引擎進水
  if (!v.flood) {
    if (d > (v.isCar ? FLOOD_D : FLOOD_BIKE)) v.floodT = (v.floodT || 0) + dt; else v.floodT = 0;
    if (v.floodT >= FLOOD_T || d > FLOOD_NOW) {
      v.flood = 1; v.lights = 0; v.stuck = null;
      if (mine) { sfx.engineOff(); toast('引擎進水熄火了 · 修車才發得動（V 叫車會送一台修好的）'); }   // AI 的車一樣換成 FLOOD_INP，滑到停
    }
  }
  // 比地面深的地方（groundH 不知道海底）：慢慢沉到海底
  const tgt = Math.min(gh, f);
  return tgt < v.y - .02 ? Math.max(tgt, v.y - SINK_V * dt) : damp(v.y, tgt, 18, dt);
}

// 99-main.js 的 F：車速夠慢、在地面上才會走到這裡。先記下按下的時間，放開或按滿 VD_HOLD_T 再決定
function vdKeyF() {
  const v = player.veh;
  if (v.boat || v.fly || v.flood) { exitVehicle(); return; }
  vd.f = { t: 0, v };
}
// 60-venues.js 的 enterVehicle：上的是剛才沒熄火的那台，引擎聲還在就不重新發動
function vdIdleTake(v) {
  if (vd.idle !== v) return false;
  vd.idle = null; return true;
}
// 60-venues.js 的 exitVehicle：長按 F 下車
function vdIdleLeave(v) { if (vd.idle && vd.idle !== v) vd.idle.lights = 0; vd.idle = v; vd.puffT = 0; v.lights = 1; }
// 99-main.js 步行時的引擎聲：不熄火的車照距離變小聲
const vdIdleGain = () => vd.idle ? clamp(1 - Math.hypot(vd.idle.x - pX(), vd.idle.z - pZ()) / 45, 0, 1) ** 1.5 * .8 : 1;

function vdUpdate(dt) {
  vd.cool = (vd.cool || 0) - dt;
  // F：放開是短按（下車熄火），按滿是長按（下車不熄火）
  const f = vd.f;
  if (f) {
    if (player.mode !== 'drive' || player.veh !== f.v) vd.f = null;
    else if (!keys.KeyF) { vd.f = null; exitVehicle(); }
    else if ((f.t += dt) >= VD_HOLD_T) { vd.f = null; exitVehicle(false, true); toast('下車 · 引擎沒熄（按住 F 下車）'); }
  }
  // 沒熄火的車：排氣管冒白煙，走遠、進室內、上別台車、車壞了就熄掉
  const iv = vd.idle;
  if (iv) {
    const far = Math.hypot(iv.x - pX(), iv.z - pZ()) > VD_IDLE_R;
    if (player.mode === 'drive' || player.where !== 'out' || far || iv.dead || iv.flood || iv === kestrel && motors.stowed) {
      vd.idle = null; iv.lights = 0;
      if (player.mode !== 'drive') sfx.engineOff();
    } else if ((vd.puffT -= dt) <= 0) {
      vd.puffT = .35 + Math.random() * .2;
      const fx = Math.sin(iv.yaw), fz = Math.cos(iv.yaw), L = (iv.len || 4) * .5 + .1;
      emit('smoke', iv.x - fx * L - fz * .35, (iv.y || 0) + .3, iv.z - fz * L + fx * .35, { vx: -fx * .6, vy: .35, vz: -fz * .6, max: 1.1, s0: .08, s1: .45, drag: 1.4, a: .22 });
    }
  }
  const v = player.mode === 'drive' ? player.veh : null;
  // 燒胎煙：座駕的燒胎煙在 69-v6-customs.js（改裝的顏色），搶來的車在這裡冒
  if (v && v.burnout && v !== kestrel && (vd.smokeT -= dt) <= 0) {
    vd.smokeT = .05;
    const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
    for (const s of [-1, 1]) emit('smoke', v.x - fx * v.len * .32 - fz * s * v.w * .4, .25, v.z - fz * v.len * .32 + fx * s * v.w * .4, { vx: (Math.random() - .5) * .8, vy: .5 + Math.random() * .4, vz: (Math.random() - .5) * .8, max: 1.4 + Math.random() * .6, s0: .3, s1: 1.8, drag: 1.2, a: .42, c: SMOKE_COL[0] });
  }
  // 沉車：水深過車廂撐 SINK_T 秒，玩家被逼下車（40-people.js 從海底浮上來游泳）
  if (v && v.flood && !v.boat && !v.fly && player.where === 'out' && waterDepth(v.x, v.z) > SINK_D) {
    if ((vd.sinkT += dt) >= SINK_T) { vd.sinkT = 0; exitVehicle(); toast('車子沉了 · 游上岸'); }
  } else vd.sinkT = 0;
}

// 測試 API（window.__nc.gta.vd）：st 是狀態（f／idle／burnT／donut），beach(X, Z) 是沙灘上從岸邊量起的距離，keyF() 模擬在車上按下 F，summon() 是步行時的 V（叫車，泡水的車會修好）
gtaApi.vd = { st: vd, beach: vdBeachD, keyF: () => vdKeyF(), summon: () => summonCar(), SAND_DRY, SAND_D1, FLOOD_D, SINK_D, VD_HOLD_T };
