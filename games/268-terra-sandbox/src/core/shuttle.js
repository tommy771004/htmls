// 太空梭：發射台倒數 → 升空（重力轉向、助推器分離）→ 主引擎關閉、外部燃料箱分離、進入軌道 →
// 軌道上沿大圓移動（地面軌跡用經緯度記錄）→ 再入大氣層 → 落到軌跡下方的新地點滑翔降落。
// 時間尺度壓縮成遊戲節奏：約 70 秒入軌、再入 20 秒，加速度與真實值無關。
import { clamp, lerp, wrapAngle, localToLatLon } from './math.js';
import { collideBuildings } from './stream.js';

export const EARTH_R = 6371000;
export const ORBIT_ALT = 112000;
export const ORBIT_V = 7800;
export const MLP_H = 8; // 行動發射平台高度：箭體座在平台頂
const FREEZE_ALT = 4000; // 高於此高度時平面座標凍結，改以經緯度推進
const SRB_SEP = 26; // 升空後幾秒助推器分離

export function createShuttle() {
  return { phase: 'off', t: 0, T: 0, padX: 0, padY: 0, padZ: 0, alt: 0, vUp: 0, vH: 0, tilt: 0, heading: 0, heading0: 0, srb: true, et: true, lat: 0, lon: 0, warp: 1, heat: 0, thrust: 0, count: 0, sepT: -1, etT: -1, entry: null, roll: 0 };
}

// 在玩家目前的位置架起發射台
export function setupPad(p, W) {
  const S = p.shuttle;
  const g = W.groundAt(p.x, p.z);
  Object.assign(S, createShuttle(), { phase: 'pad', padX: p.x, padY: g, padZ: p.z, heading: p.yaw, heading0: p.yaw });
  p.y = g + MLP_H;
  p.sp = 0;
  p.vx = p.vy = p.vz = 0;
}

export function shuttleBusy(p) {
  const ph = p.shuttle.phase;
  return ph === 'ascent' || ph === 'orbit' || ph === 'reentry';
}

// 太空梭的地面軌跡點（平面座標凍結後改用經緯度）
export function shuttleLatLon(p, place) {
  const S = p.shuttle;
  if (p.mode === 'shuttle' && (S.phase === 'ascent' || S.phase === 'orbit' || S.phase === 'reentry') && S.alt > FREEZE_ALT) return { lat: S.lat, lon: S.lon };
  return localToLatLon(place, p.x, p.z);
}

// 大圓前進 d 公尺（航向：0 = 北、順時針）
function advance(S, d) {
  const toR = Math.PI / 180;
  const la = S.lat * toR;
  const lo = S.lon * toR;
  const th = S.heading;
  const dl = d / EARTH_R;
  const la2 = Math.asin(Math.sin(la) * Math.cos(dl) + Math.cos(la) * Math.sin(dl) * Math.cos(th));
  const lo2 = lo + Math.atan2(Math.sin(th) * Math.sin(dl) * Math.cos(la), Math.cos(dl) - Math.sin(la) * Math.sin(la2));
  // 新位置的航向：從新點看回舊點的方位角 + π
  const back = Math.atan2(Math.sin(lo - lo2) * Math.cos(la), Math.cos(la2) * Math.sin(la) - Math.sin(la2) * Math.cos(la) * Math.cos(lo - lo2));
  S.heading = wrapAngle(back + Math.PI);
  S.lat = la2 / toR;
  S.lon = ((((lo2 / toR) + 540) % 360) + 360) % 360 - 180;
}

export function stepShuttle(p, inp, dt, env, emit) {
  const S = p.shuttle;
  const W = env.world;
  S.t += dt;
  switch (S.phase) {
    case 'pad':
      p.anim = 'sit';
      if (inp.jumpPressed || inp.my > 0.5) {
        S.phase = 'count';
        S.count = 6;
        emit(p, 'toast', 'T-6 · 主引擎點火程序');
      }
      break;
    case 'count': {
      const before = Math.ceil(S.count);
      S.count -= dt;
      const now = Math.ceil(S.count);
      if (now < before && now > 0) emit(p, 'count', `T-${now}`);
      S.thrust = S.count < 3.5 ? clamp((3.5 - S.count) / 0.8, 0, 0.55) : 0;
      if (S.count <= 0) {
        S.phase = 'ascent';
        S.T = 0;
        S.thrust = 1;
        emit(p, 'liftoff', '升空！');
      }
      break;
    }
    case 'ascent':
      ascent(p, inp, dt, env, emit);
      break;
    case 'orbit':
      orbit(p, inp, dt, emit);
      break;
    case 'reentry':
      reentry(p, inp, dt, emit);
      break;
    case 'glide':
      glide(p, inp, dt, env, emit);
      break;
    default:
  }
  void W;
}

function ascent(p, inp, dt, env, emit) {
  const S = p.shuttle;
  S.T += dt;
  // 推力（遊戲化）：助推器階段較猛，分離後主引擎持續加速
  const a = S.srb ? 26 + S.T * 2.4 : Math.min(190, 40 + (S.T - SRB_SEP) * 4.2);
  // 重力轉向：越高越傾向水平；W/S 微調姿態，A/D 改變發射方位
  const prog = Math.pow(clamp((S.alt - 250) / 70000, 0, 1), 0.55) * 1.5;
  S.tilt = clamp(prog + inp.my * -0.12, 0, 1.52);
  S.heading = wrapAngle(S.heading + inp.mx * 0.25 * dt);
  const gEff = 9.8 * (1 - Math.min(1, (S.vH / ORBIT_V) ** 2));
  S.vUp += (a * Math.cos(S.tilt) - gEff - S.vUp * 0.002) * dt;
  S.vH += a * Math.sin(S.tilt) * dt;
  // 接近軌道高度時把爬升率收斂到 0（圓化）
  if (S.alt > ORBIT_ALT * 0.8) S.vUp = lerp(S.vUp, (ORBIT_ALT - S.alt) * 0.05, Math.min(1, dt * 1.2));
  S.alt += S.vUp * dt;
  if (S.alt < 0) {
    S.alt = 0;
    S.vUp = 0;
  }
  S.thrust = 1;
  const d = S.vH * dt;
  if (S.alt < FREEZE_ALT) {
    p.x += Math.sin(S.heading) * d;
    p.z -= Math.cos(S.heading) * d;
    const ll = localToLatLon(env.place || { lat: 0, lon: 0 }, p.x, p.z);
    S.lat = ll.lat;
    S.lon = ll.lon;
  } else advance(S, d * (EARTH_R / (EARTH_R + S.alt)));
  p.y = S.padY + MLP_H + S.alt;
  p.yaw = S.heading;
  p.sp = Math.hypot(S.vUp, S.vH);
  if (S.srb && S.T > SRB_SEP) {
    S.srb = false;
    S.sepT = S.t;
    emit(p, 'sep', '固體火箭助推器分離');
  }
  if (S.vH >= ORBIT_V && S.alt > ORBIT_ALT * 0.92) {
    S.vH = ORBIT_V;
    S.phase = 'orbit';
    S.et = false;
    S.etT = S.t;
    S.thrust = 0;
    emit(p, 'orbit', '主引擎關閉 · 外部燃料箱分離 · 進入軌道');
  }
  p.anim = 'sit';
}

function orbit(p, inp, dt, emit) {
  const S = p.shuttle;
  S.vUp = lerp(S.vUp, (ORBIT_ALT - S.alt) * 0.1, Math.min(1, dt));
  S.alt += S.vUp * dt;
  S.warp = inp.sprint ? 40 : 1;
  S.heading = wrapAngle(S.heading + inp.mx * 0.08 * dt);
  S.roll = lerp(S.roll, inp.mx * 0.4, Math.min(1, dt * 2));
  advance(S, S.vH * S.warp * dt * (EARTH_R / (EARTH_R + S.alt)));
  p.y = S.padY + MLP_H + S.alt;
  p.yaw = S.heading;
  p.sp = S.vH;
  S.thrust = 0;
  if (inp.use) {
    S.phase = 'reentry';
    S.T = 0;
    S.entry = { alt: S.alt, vH: S.vH };
    emit(p, 'toast', '離軌點火 · 再入大氣層');
  }
  p.anim = 'sit';
}

const ENTRY_T = 20;
const GLIDE_ALT = 1500;
function reentry(p, inp, dt, emit) {
  const S = p.shuttle;
  S.T += dt;
  const u = clamp(S.T / ENTRY_T, 0, 1);
  const k = 1 - Math.pow(1 - u, 1.6);
  S.alt = lerp(S.entry.alt, 6000, k);
  S.vH = lerp(S.entry.vH, 160, Math.pow(u, 0.8));
  S.vUp = -(S.entry.alt - 6000) / ENTRY_T;
  S.heat = Math.sin(Math.PI * clamp((u - 0.08) / 0.75, 0, 1)) ** 1.5;
  S.heading = wrapAngle(S.heading + inp.mx * 0.12 * dt);
  S.roll = lerp(S.roll, Math.sin(S.T * 0.5) * 0.7 * (1 - u), Math.min(1, dt * 2)); // 減速用的 S 形翻滾
  advance(S, S.vH * dt * (EARTH_R / (EARTH_R + S.alt)));
  p.y = S.padY + MLP_H + S.alt;
  p.yaw = S.heading;
  p.sp = S.vH;
  if (u >= 1) {
    S.heat = 0;
    S.phase = 'landing';
    // 交給 main：換到軌跡下方的地點，再呼叫 startGlide
    emit(p, 'reentry', '', { lat: S.lat, lon: S.lon });
  }
  p.anim = 'sit';
}

// 換到新地點後從低空開始滑翔（沒有動力）
export function startGlide(p, W) {
  const S = p.shuttle;
  p.mode = 'shuttle';
  S.phase = 'glide';
  S.heat = 0;
  S.thrust = 0;
  S.srb = false;
  S.et = false;
  const g = Math.max(W.groundAt(p.x, p.z), W.waterY);
  p.y = g + GLIDE_ALT;
  p.sp = 125;
  p.plane.pitch = -0.28;
  p.plane.roll = 0;
  p.plane.crash = 0;
  p.vy = 0;
}

function glide(p, inp, dt, env, emit) {
  const W = env.world;
  const P = p.plane;
  const S = p.shuttle;
  P.pitch = clamp(P.pitch + inp.my * 0.8 * dt, -0.95, 0.45);
  if (Math.abs(inp.my) < 0.1) P.pitch = lerp(P.pitch, -0.22, dt * 0.15);
  P.roll = clamp(P.roll + inp.mx * 1.5 * dt, -1.1, 1.1);
  if (Math.abs(inp.mx) < 0.1) P.roll *= 1 - dt * 1.1;
  const sp = Math.max(p.sp, 1);
  p.yaw = wrapAngle(p.yaw + ((9.8 * Math.tan(P.roll)) / Math.max(sp, 40)) * dt);
  const ground = Math.max(W.groundAt(p.x, p.z), W.waterY);
  const rolling = p.y <= ground + 2.6 && S.rollout;
  if (!rolling) {
    p.sp += (-0.00045 * p.sp * p.sp - 9.8 * Math.sin(P.pitch)) * dt;
    p.sp = clamp(p.sp, 0, 160);
  }
  const cp = Math.cos(P.pitch);
  p.vx = Math.sin(p.yaw) * cp * p.sp;
  p.vz = -Math.cos(p.yaw) * cp * p.sp;
  let vy = Math.sin(P.pitch) * p.sp;
  if (p.sp < 70) vy -= (70 - p.sp) * 0.5; // 太慢就掉
  p.x += p.vx * dt;
  p.z += p.vz * dt;
  p.y += vy * dt;
  const g = Math.max(W.groundAt(p.x, p.z), W.waterY);
  const hitB = collideBuildings(env.streamer, p.x, p.z, 6, p.y).hit;
  if (p.y < g + 2.6 || hitB) {
    const wet = W.waterAt(p.x, p.z) !== null && W.groundAt(p.x, p.z) < W.waterY - 0.5;
    if (wet) {
      emit(p, 'crash', '濺落海面 · 改搭快艇');
      p.mode = 'boat';
      p.y = W.waterY;
      p.sp = 0;
      S.phase = 'off';
      return;
    }
    if (!hitB && Math.abs(P.roll) < 0.4 && P.pitch > -0.35 && p.sp < 140) {
      // 主輪著地 → 減速傘滾行
      if (!S.rollout) emit(p, 'toast', '主輪著地 · 放出減速傘');
      S.rollout = true;
      p.y = g + 2.6;
      P.pitch = lerp(P.pitch, 0, dt * 2);
      P.roll *= 1 - dt * 4;
      p.sp = Math.max(0, p.sp - (6 + p.sp * 0.12) * dt);
      if (p.sp < 2) {
        emit(p, 'toast', '太空梭平安降落');
        land(p, W);
      }
    } else {
      emit(p, 'crash', hitB ? '太空梭撞上大樓' : '硬著陸');
      land(p, W);
    }
  }
  S.alt = p.y - g;
  p.anim = 'sit';
}

function land(p, W) {
  p.mode = 'walk';
  p.shuttle.phase = 'off';
  p.shuttle.rollout = false;
  p.x += Math.cos(p.yaw) * 8;
  p.z += Math.sin(p.yaw) * 8;
  p.y = W.groundAt(p.x, p.z);
  p.sp = 0;
  p.vy = 0;
  p.grounded = true;
}

// 測試與除錯：直接放到軌道上
export function jumpToOrbit(p, lat, lon) {
  const S = p.shuttle;
  if (p.mode !== 'shuttle' || S.phase === 'off') return;
  Object.assign(S, { phase: 'orbit', alt: ORBIT_ALT, vUp: 0, vH: ORBIT_V, tilt: Math.PI / 2, srb: false, et: false, lat, lon, thrust: 0, sepT: -1, etT: -1 });
  p.y = S.padY + MLP_H + S.alt;
}
