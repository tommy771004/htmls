// 划艇物理（不碰 DOM／three）：2D 平面上的慣性推進、線性水阻、龍骨側阻、轉向角阻尼、水流漂移與岸邊／巨石碰撞。
// 推力跟著槳的相位：只有拉槳段（φ < 0.45）才推船，所以速度會隨每一槳一頓一頓地前進。
// yaw：船頭方向 = (sin yaw, cos yaw)（three 的 rotation.y），yaw 增加 = 往左（逆時針）轉。
export const STROKE_T = 1.2;     // 一槳週期（秒），和 SPEC 的划槳公式一致
export const DRIVE = 0.45;

export const OAR_REST = { sweep: 20, lift: -12 };   // 不划、釣魚、單邊轉向時停住的那支槳
export function oarPose(phi, active = true) {
  // 回傳 { sweep, lift }（度），見 SPEC「划槳公式」（和 blender/rowing.py 一致）
  if (!active) return { ...OAR_REST };
  const ease = (s) => 0.5 - 0.5 * Math.cos(Math.PI * s);
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  if (phi < DRIVE) return { sweep: 38 + (-20 - 38) * ease(phi / DRIVE), lift: -18 };
  const s = (phi - DRIVE) / (1 - DRIVE);
  let lift = -10;
  if (s < 0.12) lift = -18 + 8 * ss(0, 0.12, s);
  else if (s > 0.88) lift = -10 - 8 * ss(0.88, 1, s);
  return { sweep: -20 + (38 + 20) * ease(s), lift };
}

export function createBoat(x, z, yaw) {
  return {
    x, z, yaw, vx: 0, vz: 0, w: 0, phi: 0.6, mode: 'idle', dir: 1, thrust: 0, pitch: 0, roll: 0,
    bump: 0, speed: 0, strokes: 0, rodMult: 1,
  };
}

// input：{ fwd: -1|0|1, turn: -1|0|1 }；world：{ sample(x,z), current(x,z) → [vx,vz], obstacles: [{x,z,r}] }
// 回傳本幀事件（'stroke' 入水、'bump' 擦岸）
export function stepBoat(b, input, world, dt) {
  const ev = [];
  const fwd = input.fwd || 0, turn = input.turn || 0;
  // 划槳模式：前進／倒划都用雙槳，原地轉向只划單邊（左轉划右舷的 Oar_R）
  let mode = 'idle', dir = 1;
  if (fwd) { mode = turn > 0 ? 'rowR+' : turn < 0 ? 'rowL+' : 'row'; dir = fwd; }
  else if (turn) mode = turn > 0 ? 'row_R' : 'row_L';
  b.mode = mode; b.dir = dir;
  const prev = b.phi;
  if (mode !== 'idle') b.phi = (b.phi + (dt / STROKE_T) * dir + 1) % 1;
  else if (b.phi < DRIVE || b.phi > 0.9) b.phi = (b.phi + dt / STROKE_T) % 1;    // 停手時把這一槳收完
  const inDrive = b.phi < DRIVE;
  if (mode !== 'idle' && ((dir > 0 && prev > 0.9 && b.phi < 0.1) || (dir < 0 && prev > DRIVE && b.phi <= DRIVE))) { b.strokes++; ev.push('stroke'); }

  const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
  const prof = inDrive && mode !== 'idle' ? Math.sin(Math.PI * (b.phi / DRIVE)) : 0;
  let thrust = 0, torque = 0;
  const F = 4.5;
  if (mode === 'row') thrust = F * prof * dir;
  else if (mode === 'rowR+' || mode === 'rowL+') { thrust = F * 0.85 * prof * dir; torque = (mode === 'rowR+' ? 1 : -1) * 2.4 * prof; }
  else if (mode === 'row_R' || mode === 'row_L') { thrust = F * 0.25 * prof; torque = (mode === 'row_R' ? 1 : -1) * 3.6 * prof; }
  b.thrust = thrust;

  // 相對水流的速度：龍骨方向阻力小、側向阻力大
  const [cx, cz] = world.current(b.x, b.z);
  const rx = b.vx - cx, rz = b.vz - cz;
  const along = rx * fx + rz * fz, side = rx * fz - rz * fx;
  const dAlong = 0.32 + 0.05 * Math.abs(along), dSide = 2.6;
  const aAlong = thrust - dAlong * along, aSide = -dSide * side;
  b.vx += (fx * aAlong + fz * aSide) * dt;
  b.vz += (fz * aAlong - fx * aSide) * dt;
  // 轉向：槳的力矩＋往前划時的舵效，角速度阻尼
  b.w += (torque - 1.6 * b.w) * dt;
  b.yaw += b.w * dt;
  b.x += b.vx * dt; b.z += b.vz * dt;

  // 碰撞：船身 5 個點的水深太淺就往深處推
  const pts = [[0, 1.55], [0, -1.55], [0.58, 0.3], [-0.58, 0.3], [0, 0]];
  let hit = 0;
  for (const [lx, lz] of pts) {
    const px = b.x + lx * Math.cos(b.yaw) + lz * fx, pz = b.z - lx * Math.sin(b.yaw) + lz * fz;
    const h = world.sample(px, pz);
    if (h > -0.32) {
      const e = 0.6;
      const gx = world.sample(px + e, pz) - world.sample(px - e, pz), gz = world.sample(px, pz + e) - world.sample(px, pz - e);
      const gl = Math.hypot(gx, gz) || 1, nx = -gx / gl, nz = -gz / gl;   // 指向較深處
      const pen = Math.min(0.5, (h + 0.32) * 0.9 + 0.02);
      b.x += nx * pen; b.z += nz * pen;
      const vn = b.vx * nx + b.vz * nz;
      if (vn < 0) { b.vx -= vn * nx * 1.4; b.vz -= vn * nz * 1.4; hit = Math.max(hit, -vn); }
    }
  }
  for (const o of world.obstacles || []) {
    const dx = b.x - o.x, dz = b.z - o.z, d = Math.hypot(dx, dz), R = o.r + 0.75;
    if (d < R && d > 1e-4) {
      const nx = dx / d, nz = dz / d;
      b.x = o.x + nx * R; b.z = o.z + nz * R;
      const vn = b.vx * nx + b.vz * nz;
      if (vn < 0) { b.vx -= vn * nx * 1.5; b.vz -= vn * nz * 1.5; hit = Math.max(hit, -vn); }
    }
  }
  if (hit > 0.35 && b.bump <= 0) { ev.push('bump'); b.bump = 0.5; }
  b.bump -= dt;

  b.speed = Math.hypot(b.vx - cx, b.vz - cz);
  b.ground = Math.hypot(b.vx, b.vz);
  // 外觀：划槳時船頭微幅俯仰（±2.5°）、轉彎側傾（±4°）
  const tp = -thrust / F * 2.5 * (dir < 0 ? -1 : 1);
  b.pitch += (tp - b.pitch) * Math.min(1, dt * 5);
  const tr = Math.max(-4, Math.min(4, -b.w * Math.max(0.6, along) * 4.5));
  b.roll += (tr - b.roll) * Math.min(1, dt * 3);
  return ev;
}
