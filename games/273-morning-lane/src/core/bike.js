// 腳踏車運動學：速度、車頭角度、傾角，加上和障礙物的碰撞。不用物理引擎，手感全在 BIKE 參數裡。
// yaw = 0 朝 −z（往前），正值往右（+x）。
import { BIKE } from './config.js';

export function makeBike(x = 1.7, z = -2) {
  return { x, z, yaw: 0, v: BIKE.cruise, lean: 0, pedal: 0, steer: 0, bumpT: 0, y: 0, vy: 0, air: false };
}

const approach = (a, b, d) => (a < b ? Math.min(a + d, b) : Math.max(a - d, b));

/** 前進一步。inp = { steer: −1..1, accel: bool }。回傳這一步撞到的障礙物（沒有就是 null） */
export function stepBike(b, inp, dt, obstacles = [], C = BIKE) {
  const target = inp.accel ? C.max : C.cruise;
  b.v = approach(b.v, target, (b.v < target ? C.accel : C.coast) * dt);
  const k = Math.min(1, Math.max(0, (b.v - C.cruise) / (C.max - C.cruise)));
  const rate = C.yawRate + (C.yawRateHi - C.yawRate) * k;
  const st = Math.max(-1, Math.min(1, inp.steer || 0));
  b.steer = st;
  if (st) b.yaw += st * rate * dt;
  else b.yaw = approach(b.yaw, 0, C.yawReturn * dt);
  b.yaw = Math.max(-C.yawMax, Math.min(C.yawMax, b.yaw));
  b.x += Math.sin(b.yaw) * b.v * dt;
  b.z -= Math.cos(b.yaw) * b.v * dt;
  if (Math.abs(b.x) > C.xLimit) {             // 柵欄擋住：貼著滑、車頭被推回正
    b.x = Math.sign(b.x) * C.xLimit;
    b.yaw = approach(b.yaw, 0, C.yawReturn * 2 * dt);
  }
  b.lean += ((-st * C.lean * (0.35 + 0.65 * b.v / C.max)) - b.lean) * Math.min(1, dt * 7);
  b.pedal += b.v * dt / 0.75;                  // 曲柄轉角（輪周約 2.1 m、齒比約 1.8）
  b.bumpT = Math.max(0, b.bumpT - dt);
  let hit = null;
  for (const o of obstacles) {
    let dx, dz, pen;
    if (o.r != null) {
      dx = b.x - o.x; dz = b.z - o.z;
      const d = Math.hypot(dx, dz), min = o.r + C.radius;
      if (d >= min) continue;
      pen = min - d; dx /= d || 1; dz /= d || 1;
    } else {
      const cx = Math.max(o.x - o.hw, Math.min(o.x + o.hw, b.x)), cz = Math.max(o.z - o.hd, Math.min(o.z + o.hd, b.z));
      dx = b.x - cx; dz = b.z - cz;
      const d = Math.hypot(dx, dz);
      if (d >= C.radius) continue;
      if (d < 1e-6) { dx = 0; dz = 1; pen = C.radius; } else { pen = C.radius - d; dx /= d; dz /= d; }
    }
    b.x += dx * pen; b.z += dz * pen;
    if (b.bumpT === 0) { b.v *= C.bumpSpeed; b.bumpT = 0.6; hit = o; }
  }
  return hit;
}
