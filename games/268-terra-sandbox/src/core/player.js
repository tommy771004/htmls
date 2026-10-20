// 玩家與載具：步行（跑、衝刺、跳、游泳、攀上岸）、滑板／雪板（推進、刻滑、豚跳、翻板、磨桿、碗池飛出）、
// 單車、吉普車、螺旋槳飛機、快艇，以及吊椅纜車與進入建物室內。
import { collideBuildings } from './stream.js';
import { collideInterior, generateInterior } from './interior.js';
import { LIFT, SKATE, bowlSD, liftPoint } from './world.js';
import { clamp, lerp, wrapAngle } from './math.js';
import { waveHeight } from './weather.js';
import { createShuttle, setupPad, shuttleBusy, stepShuttle } from './shuttle.js';

export const MODES = [
  { id: 'walk', name: '步行', key: '1' },
  { id: 'board', name: '滑板', snowName: '雪板', key: '2' },
  { id: 'bike', name: '單車', key: '3' },
  { id: 'car', name: '吉普車', key: '4' },
  { id: 'plane', name: '螺旋槳飛機', key: '5' },
  { id: 'boat', name: '快艇', key: '6' },
  { id: 'shuttle', name: '太空梭', key: '7' },
];

const G = 20;
const STEP_UP = 0.62;

export function createPlayer() {
  return {
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, sp: 0, mode: 'walk', grounded: true,
    anim: 'idle', phase: 0, lean: 0, crouch: 0, bob: 0,
    board: { flip: 0, spin: 0, grab: 0, trick: null, grind: null, score: 0, combo: [], airT: 0, bail: 0, last: '' },
    car: { steer: 0, model: 'jeep', color: 0xd7c37a, pitch: 0, roll: 0, wheel: 0 },
    plane: { pitch: 0, roll: 0, throttle: 0.7, flying: false, prop: 0, crash: 0 },
    boat: { pitch: 0, roll: 0 },
    shuttle: createShuttle(),
    lift: null,
    inside: null,
    swim: false,
    stats: { dist: 0, maxSp: 0, air: 0, tricks: 0 },
    events: [],
  };
}

export function emptyInput() {
  return { mx: 0, my: 0, camYaw: 0, sprint: false, crouch: false, jump: false, jumpPressed: false, use: false, throttleUp: false, throttleDown: false };
}

export function spawnPlayer(p, world, at) {
  p.x = at.x;
  p.z = at.z;
  p.y = world.groundAt(at.x, at.z);
  p.yaw = at.yaw || 0;
  p.vx = p.vy = p.vz = 0;
  p.sp = 0;
  p.lift = null;
  p.inside = null;
  p.swim = false;
  p.grounded = true;
  p.plane.flying = false;
  p.shuttle.phase = 'off';
  if (world.kind === 'ocean') {
    p.mode = 'boat';
    p.y = 0;
  } else if (p.mode === 'boat' || p.mode === 'plane' || p.mode === 'shuttle') p.mode = 'walk';
}

function emit(p, type, text, extra) {
  p.events.push({ type, text, ...extra });
}

// 切換載具；回傳失敗原因字串或 null
export function setMode(p, mode, env) {
  const W = env.world;
  if (p.inside && mode !== 'walk') return '先走出室內';
  if (p.lift) return '纜車上不能換';
  if (mode === p.mode) return null;
  if (p.mode === 'shuttle' && shuttleBusy(p)) return p.shuttle.phase === 'orbit' ? '在軌道上：按 E 返回地面' : '太空梭飛行中無法切換';
  if (mode === 'shuttle' && W.kind === 'ocean') return '外海沒有地方架發射台';
  if (W.kind === 'ocean' && mode !== 'boat' && mode !== 'plane') return '外海只能開船或飛機';
  if (mode === 'boat') {
    const spot = nearestWater(W, p.x, p.z);
    if (!spot) return '附近沒有水域';
    p.x = spot.x;
    p.z = spot.z;
    p.yaw = spot.yaw ?? p.yaw;
    p.y = W.waterY;
    p.sp = 0;
  }
  if (mode === 'plane') {
    const g = W.groundAt(p.x, p.z);
    // 起飛高度：高於附近最高的建物
    let top = 0;
    if (env.streamer) for (const b of env.streamer.buildingsNear(p.x, p.z, 160)) top = Math.max(top, b.base + b.height - g);
    p.y = Math.max(g, W.waterY) + Math.max(140, top + 70);
    p.sp = 46;
    p.plane.pitch = 0.05;
    p.plane.roll = 0;
    p.plane.throttle = 0.75;
    p.plane.flying = true;
  } else if (p.mode === 'plane' || p.mode === 'boat' || p.mode === 'shuttle') {
    // 從空中或水上切回地面載具：落到最近的地面
    if (p.mode === 'boat') {
      const land = nearestLand(W, p.x, p.z);
      if (land) {
        p.x = land.x;
        p.z = land.z;
      }
    }
    p.y = W.groundAt(p.x, p.z);
    p.vy = 0;
  }
  if (mode === 'car' && p.mode !== 'car') {
    p.car.model = 'jeep';
    p.car.color = 0xd7c37a;
  }
  if (p.mode === 'shuttle') p.shuttle.phase = 'off';
  p.mode = mode;
  if (mode === 'shuttle') setupPad(p, W);
  p.sp = mode === 'plane' || mode === 'shuttle' ? p.sp : p.mode === 'boat' ? 0 : Math.min(Math.abs(p.sp), 4);
  p.board.grind = null;
  p.board.bail = 0;
  return null;
}

export function nearestWater(W, x, z) {
  if (W.kind === 'ocean') return { x, z };
  if (W.waterY < -900) return null;
  if (W.kind === 'canal') {
    const K = W.K;
    let j = Math.round(z / K.PZ);
    if (!W.isCanalLine(j)) j += z > j * K.PZ ? 1 : -1;
    let i = Math.floor(x / K.PX);
    return { x: i * K.PX + K.PX / 2, z: j * K.PZ, yaw: Math.PI / 2 };
  }
  for (let r = 10; r < 900; r += 10) {
    for (let a = 0; a < 16; a++) {
      const px = x + Math.cos((a / 16) * Math.PI * 2) * r;
      const pz = z + Math.sin((a / 16) * Math.PI * 2) * r;
      if (W.terrain(px, pz) < W.waterY - 1.5) return { x: px, z: pz };
    }
  }
  return null;
}
function nearestLand(W, x, z) {
  if (W.kind === 'ocean') return null;
  if (W.kind === 'canal') {
    const K = W.K;
    const j = Math.round(z / K.PZ);
    return { x, z: j * K.PZ + (z > j * K.PZ ? 1 : -1) * (K.canalW / 2 + 2.5) };
  }
  for (let r = 4; r < 900; r += 6) {
    for (let a = 0; a < 16; a++) {
      const px = x + Math.cos((a / 16) * Math.PI * 2) * r;
      const pz = z + Math.sin((a / 16) * Math.PI * 2) * r;
      if (W.groundAt(px, pz) > W.waterY + 0.3) return { x: px, z: pz };
    }
  }
  return null;
}

// ── 主步進 ──
export function stepPlayer(p, inp, dt, env) {
  dt = Math.min(dt, 0.05);
  const px = p.x;
  const pz = p.z;
  const busy = !!(p.inside || p.lift);
  if (p.lift) stepLift(p, inp, dt, env);
  else if (p.inside) stepInterior(p, inp, dt, env);
  else {
    switch (p.mode) {
      case 'board':
        stepBoard(p, inp, dt, env);
        break;
      case 'bike':
        stepWheeled(p, inp, dt, env, 'bike');
        break;
      case 'car':
        stepWheeled(p, inp, dt, env, 'car');
        break;
      case 'plane':
        stepPlane(p, inp, dt, env);
        break;
      case 'boat':
        stepBoat(p, inp, dt, env);
        break;
      case 'shuttle':
        stepShuttle(p, inp, dt, env, emit);
        break;
      default:
        stepWalk(p, inp, dt, env);
    }
  }
  const moved = Math.hypot(p.x - px, p.z - pz);
  if (moved < 50) p.stats.dist += moved;
  p.stats.maxSp = Math.max(p.stats.maxSp, Math.abs(p.sp));
  if (inp.use && !busy && !p.inside && !p.lift && p.mode !== 'shuttle') tryUse(p, env);
}

function camVectors(yaw) {
  return { fx: Math.sin(yaw), fz: -Math.cos(yaw), rx: Math.cos(yaw), rz: Math.sin(yaw) };
}

function tryUse(p, env) {
  const W = env.world;
  // 1) 纜車
  if (W.kind === 'ski' && (p.mode === 'walk' || p.mode === 'board')) {
    const bx = LIFT.x - LIFT.gauge;
    const bz = LIFT.zBase - 4;
    if (Math.hypot(p.x - bx, p.z - bz) < 9) {
      const len = LIFT.zBase - LIFT.zTop;
      const n = Math.floor((2 * len) / LIFT.spacing);
      const base = ((env.t * LIFT.speed) / (2 * len)) % 1;
      // 找下一張剛到站的椅子
      let best = 0;
      let bestD = 9;
      for (let k = 0; k < n; k++) {
        const u = (base + k / n) % 1;
        const d = u < 0.5 ? u : 9;
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      }
      p.lift = { chair: best, n };
      emit(p, 'toast', `搭上${LIFT.name}`);
      return;
    }
  }
  // 2) 接手路上的車
  if (p.mode === 'walk' && env.traffic) {
    for (const c of env.traffic.cars) {
      if (Math.hypot(c.x - p.x, c.z - p.z) < 3.6) {
        env.traffic.cars.splice(env.traffic.cars.indexOf(c), 1);
        p.mode = 'car';
        p.car.model = c.model;
        p.car.color = c.color;
        p.x = c.x;
        p.z = c.z;
        p.yaw = c.yaw;
        p.sp = c.speed;
        emit(p, 'toast', `接手一台${carName(c.model)}`);
        return;
      }
    }
  }
  // 3) 進入建物
  if (p.mode === 'walk' && env.streamer) {
    for (const b of env.streamer.buildingsNear(p.x, p.z, 3)) {
      if (Math.hypot(b.door.x - p.x, b.door.z - p.z) < 2.6) {
        enterBuilding(p, b, 0);
        emit(p, 'toast', `走進${b.shop ? b.shop.name : '建物門廳'}`);
        return;
      }
    }
  }
}

export function carName(m) {
  return { sedan: '轎車', taxi: '計程車', suv: '休旅車', pickup: '皮卡', van: '廂型車', hatch: '掀背車', jeep: '吉普車' }[m] || '車';
}

export function enterBuilding(p, b, floor) {
  const layout = generateInterior(b, floor);
  p.inside = { id: b.id, b, floor, layout };
  const inward = { n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] }[b.door.side] || [0, 1];
  if (floor === 0) {
    p.x = b.door.x + inward[0] * 1.3;
    p.z = b.door.z + inward[1] * 1.3;
    p.yaw = Math.atan2(inward[0], -inward[1]);
  } else if (layout.stairs) {
    const s = layout.stairs;
    p.x = (s.x0 + s.x1) / 2;
    p.z = (s.z0 + s.z1) / 2 + (s.z0 > (layout.z0 + layout.z1) / 2 ? -s.z1 + s.z0 - 0.6 : s.z1 - s.z0 + 0.6) * 0.5;
  }
  p.y = layout.y;
  p.vy = 0;
  p.sp = 0;
}

function stepInterior(p, inp, dt, env) {
  const L = p.inside.layout;
  const { fx, fz, rx, rz } = camVectors(inp.camYaw);
  let dx = fx * inp.my + rx * inp.mx;
  let dz = fz * inp.my + rz * inp.mx;
  const m = Math.hypot(dx, dz);
  const spd = inp.sprint ? 3.6 : 2.2;
  if (m > 0.01) {
    dx /= Math.max(1, m);
    dz /= Math.max(1, m);
    p.yaw = turnToward(p.yaw, Math.atan2(dx, -dz), dt * 10);
  }
  p.vx = lerp(p.vx, dx * spd, Math.min(1, dt * 12));
  p.vz = lerp(p.vz, dz * spd, Math.min(1, dt * 12));
  let nx = p.x + p.vx * dt;
  let nz = p.z + p.vz * dt;
  // 從店門走出去
  const ex = L.exit;
  if (ex) {
    const out = { n: nz < L.z0, s: nz > L.z1, w: nx < L.x0, e: nx > L.x1 }[ex.side];
    const along = ex.side === 'n' || ex.side === 's' ? Math.abs(nx - ex.x) : Math.abs(nz - ex.z);
    if (out && along < 0.8) {
      exitBuilding(p);
      return;
    }
  }
  const c = collideInterior(L, nx, nz, 0.3);
  p.x = c.x;
  p.z = c.z;
  p.y = L.y;
  p.sp = Math.hypot(p.vx, p.vz);
  p.anim = p.sp > 2.6 ? 'run' : p.sp > 0.3 ? 'walk' : 'idle';
  p.phase += dt * p.sp * 1.6;
  if (inp.use) {
    const s = L.stairs;
    if (s && p.x > s.x0 - 0.8 && p.x < s.x1 + 0.8 && p.z > s.z0 - 0.8 && p.z < s.z1 + 0.8) {
      const b = p.inside.b;
      let f = p.inside.floor + (inp.crouch ? -1 : 1);
      if (f >= b.floors) f = 0;
      if (f < 0) f = b.floors - 1;
      enterBuilding(p, b, f);
      emit(p, 'toast', `${f === 0 ? '一樓' : `${f + 1} 樓`} · ${p.inside.layout.rooms.length} 個空間`);
    } else if (ex && Math.hypot(p.x - ex.x, p.z - ex.z) < 2.2) exitBuilding(p);
  }
}

export function exitBuilding(p) {
  const b = p.inside.b;
  const out = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[b.door.side] || [0, -1];
  p.x = b.door.x + out[0] * 1.4;
  p.z = b.door.z + out[1] * 1.4;
  p.y = b.floor0;
  p.yaw = Math.atan2(out[0], -out[1]);
  p.inside = null;
  emit(p, 'toast', '回到街上');
}

function turnToward(a, b, k) {
  return a + wrapAngle(b - a) * Math.min(1, k);
}

// 地面跟隨＋重力＋階梯；回傳是否著地
function verticalStep(p, dt, ground) {
  const predicted = p.y + p.vy * dt - 0.5 * G * dt * dt;
  if (p.grounded && predicted >= ground - 0.35 && p.vy <= 0.5) {
    // 貼地
    p.vy = clamp((ground - p.y) / dt, -12, 12);
    p.y = ground;
    return true;
  }
  if (predicted <= ground) {
    p.y = ground;
    const landV = p.vy;
    p.vy = 0;
    p.grounded = true;
    p.landV = landV;
    return true;
  }
  p.y = predicted;
  p.vy -= G * dt;
  p.grounded = false;
  return false;
}

function blocked(env, x, z, r, y) {
  return collideBuildings(env.streamer, x, z, r, y);
}

function stepWalk(p, inp, dt, env) {
  const W = env.world;
  const { fx, fz, rx, rz } = camVectors(inp.camYaw);
  let dx = fx * inp.my + rx * inp.mx;
  let dz = fz * inp.my + rz * inp.mx;
  const m = Math.min(1, Math.hypot(dx, dz));
  if (m > 0.01) {
    const l = Math.hypot(dx, dz);
    dx /= l;
    dz /= l;
  }
  const water = W.waterAt(p.x, p.z);
  const groundHere = W.groundAt(p.x, p.z);
  p.swim = water !== null && groundHere < water - 1.2 && p.y < water - 0.6;
  const target = p.swim ? 1.6 : inp.crouch ? 1.6 : inp.sprint ? 7.4 : 4.3;
  const acc = p.grounded || p.swim ? 16 : 3.5;
  p.vx += clamp(dx * m * target - p.vx, -acc * dt, acc * dt);
  p.vz += clamp(dz * m * target - p.vz, -acc * dt, acc * dt);
  let nx = p.x + p.vx * dt;
  let nz = p.z + p.vz * dt;
  const g2 = W.groundAt(nx, nz);
  if (!p.swim && g2 > p.y + STEP_UP && p.grounded) {
    nx = p.x;
    nz = p.z;
    p.vx *= 0.2;
    p.vz *= 0.2;
  }
  const col = blocked(env, nx, nz, 0.38, p.y);
  nx = col.x;
  nz = col.z;
  p.x = nx;
  p.z = nz;
  const sp = Math.hypot(p.vx, p.vz);
  if (sp > 0.2) p.yaw = turnToward(p.yaw, Math.atan2(p.vx, -p.vz), dt * 11);
  p.sp = sp;
  if (p.swim) {
    p.y = lerp(p.y, water - 0.95, Math.min(1, dt * 4));
    p.vy = 0;
    p.grounded = false;
    p.anim = 'swim';
    p.phase += dt * 2.2;
    // 攀上岸：前方 1.2m 內地面高於水面
    const ax = p.x + Math.sin(p.yaw) * 1.2;
    const az = p.z - Math.cos(p.yaw) * 1.2;
    const ga = W.groundAt(ax, az);
    if ((inp.jumpPressed || m > 0.5) && ga > water - 0.4 && ga < water + 3.2 && (inp.jumpPressed || ga < water + 0.6)) {
      p.x = ax;
      p.z = az;
      p.y = ga;
      p.grounded = true;
      p.swim = false;
      emit(p, 'toast', '攀上岸');
    }
    return;
  }
  if (p.grounded && inp.jumpPressed) {
    p.vy = 6.6;
    p.grounded = false;
    p.y += 0.02;
  }
  const g = W.groundAt(p.x, p.z);
  const was = p.grounded;
  verticalStep(p, dt, g);
  if (!was && p.grounded && p.landV < -14) emit(p, 'toast', '重重落地');
  p.anim = !p.grounded ? (p.vy > 0 ? 'jump' : 'fall') : sp > 5.6 ? 'sprint' : sp > 2.4 ? 'run' : sp > 0.25 ? 'walk' : inp.crouch ? 'crouch' : 'idle';
  p.phase += dt * (sp * 1.45 + (sp > 0.25 ? 0.6 : 0));
}

function gradAt(W, x, z) {
  const e = 0.35;
  return {
    gx: (W.groundAt(x + e, z) - W.groundAt(x - e, z)) / (2 * e),
    gz: (W.groundAt(x, z + e) - W.groundAt(x, z - e)) / (2 * e),
  };
}

const TRICKS = {
  ollie: '豚跳 Ollie',
  kickflip: '尖翻 Kickflip',
  heelflip: '跟翻 Heelflip',
  shuv: '轉板 Shove-it',
  indy: '抓板 Indy',
  grind: '磨桿 50-50',
  air: '碗池飛出',
  spin: '空中轉體',
};

function stepBoard(p, inp, dt, env) {
  const W = env.world;
  const B = p.board;
  const snow = W.kind === 'ski';
  const surf = W.surfaceAt(p.x, p.z);
  if (B.bail > 0) {
    B.bail -= dt;
    p.sp *= Math.pow(0.15, dt);
    p.anim = 'bail';
    const g = W.groundAt(p.x, p.z);
    verticalStep(p, dt, g);
    p.x += Math.sin(p.yaw) * p.sp * dt;
    p.z -= Math.cos(p.yaw) * p.sp * dt;
    return;
  }
  // 磨桿中
  if (B.grind) {
    const R = B.grind;
    p.sp = Math.max(1.5, p.sp - dt * 0.6);
    R.s += p.sp * dt * R.dir;
    if (R.s < 0 || R.s > R.len || inp.jumpPressed) {
      B.grind = null;
      p.grounded = false;
      p.vy = inp.jumpPressed ? 4.6 : 0.5;
      addTrick(p, 'grind');
    } else {
      p.x = R.x0 + R.ux * R.s;
      p.z = R.z0 + R.uz * R.s;
      p.y = R.h;
      p.anim = 'grind';
      return;
    }
  }
  const heading = { x: Math.sin(p.yaw), z: -Math.cos(p.yaw) };
  if (p.grounded) {
    // 刻滑轉向
    const turnRate = (snow ? 1.9 : 2.5) / (1 + Math.abs(p.sp) * 0.05);
    p.yaw += inp.mx * turnRate * dt * (p.sp < 0 ? -1 : 1);
    p.lean = lerp(p.lean, -inp.mx * clamp(Math.abs(p.sp) / 8, 0, 1) * 0.45, Math.min(1, dt * 6));
    // 推進與煞車
    const maxPush = snow ? 4 : 8.8;
    if (inp.my > 0.2 && p.sp < maxPush && !inp.crouch) {
      p.sp += (snow ? 2.2 : 5.2) * dt;
      p.pushT = (p.pushT || 0) + dt;
    } else p.pushT = 0;
    if (inp.my < -0.2) p.sp -= Math.sign(p.sp) * Math.min(Math.abs(p.sp), (snow ? 9 : 6.5) * dt);
    // 坡度加速
    const { gx, gz } = gradAt(W, p.x, p.z);
    const along = gx * heading.x + gz * heading.z;
    const k = 1 / Math.sqrt(1 + gx * gx + gz * gz);
    p.sp -= G * 0.55 * along * k * dt;
    // 摩擦
    let mu = snow ? 0.06 : 0.16;
    if (surf === 'grass' || surf === 'sand') mu = 4.5;
    if (snow && Math.abs(inp.mx) > 0.6) mu += 0.6; // 刻滑掉速
    p.sp -= Math.sign(p.sp) * Math.min(Math.abs(p.sp), (mu + (snow ? 0.0035 : 0.009) * p.sp * p.sp) * dt);
    p.sp = clamp(p.sp, -7, snow ? 30 : 16);
    p.vx = heading.x * p.sp;
    p.vz = heading.z * p.sp;
    if (inp.jumpPressed) {
      p.vy = Math.max(p.vy, 0) + (inp.crouch ? 6.4 : 5.4);
      p.y += 0.04;
      p.grounded = false;
      B.trick = 'ollie';
      B.flip = 0;
      B.spin = 0;
      B.airT = 0;
      B.spun = 0;
    }
  } else {
    // 空中：翻板與轉體
    B.airT += dt;
    if (inp.mxPressed && !B.flipping) {
      B.flipping = inp.mxPressed;
      B.trick = inp.mxPressed > 0 ? 'kickflip' : 'heelflip';
    }
    if (inp.myPressed && inp.myPressed < 0 && !B.shuving) {
      B.shuving = true;
      B.trick = 'shuv';
    }
    if (B.flipping) {
      B.flip += B.flipping * dt * 15;
      if (Math.abs(B.flip) >= Math.PI * 2) {
        B.flip = 0;
        B.flipping = 0;
        B.done = B.trick;
      }
    }
    if (B.shuving) {
      B.spin += dt * 14;
      if (B.spin >= Math.PI) {
        B.spin = 0;
        B.shuving = false;
        B.done = 'shuv';
      }
    }
    B.grab = inp.crouch ? Math.min(1, B.grab + dt * 6) : Math.max(0, B.grab - dt * 6);
    if (B.grab > 0.8) B.grabbed = true;
    // 轉體
    const spinIn = inp.mx * 5.5 * dt;
    if (!B.flipping) {
      p.yaw += spinIn;
      B.spun = (B.spun || 0) + Math.abs(spinIn);
    }
    // 找扶手／矮牆磨桿
    if (W.kind === 'beach' && p.vy < 0) {
      for (const r of SKATE.rails) {
        const ux = r.x1 - r.x0;
        const uz = r.z1 - r.z0;
        const len = Math.hypot(ux, uz);
        const t = ((p.x - r.x0) * ux + (p.z - r.z0) * uz) / (len * len);
        if (t < 0.02 || t > 0.98) continue;
        const cx = r.x0 + ux * t;
        const cz = r.z0 + uz * t;
        const h = W.terrain(cx, cz) + 0.16 + r.h;
        if (Math.hypot(p.x - cx, p.z - cz) < 0.45 && p.y > h - 0.2 && p.y < h + 0.5) {
          const dir = Math.sign(p.vx * ux + p.vz * uz) || 1;
          B.grind = { x0: r.x0, z0: r.z0, ux: ux / len, uz: uz / len, len, s: t * len, h, dir };
          p.sp = Math.max(2.5, Math.abs(p.vx * ux + p.vz * uz) / len);
          p.yaw = Math.atan2(dir * ux, -dir * uz);
          p.vy = 0;
          B.flipping = 0;
          return;
        }
      }
    }
  }

  let nx = p.x + p.vx * dt;
  let nz = p.z + p.vz * dt;
  const col = blocked(env, nx, nz, 0.4, p.y);
  if (col.hit) {
    p.sp *= -0.25;
    p.vx *= -0.25;
    p.vz *= -0.25;
  }
  nx = col.x;
  nz = col.z;
  const gNew = W.groundAt(nx, nz);
  if (p.grounded && gNew > p.y + STEP_UP) {
    // 撞到路緣以外的高牆
    p.sp *= -0.2;
    nx = p.x;
    nz = p.z;
  }
  // 水裡：落水就變成步行游泳
  const water = W.waterAt(nx, nz);
  if (water !== null && gNew < water - 1.2 && p.y < water) {
    p.mode = 'walk';
    p.x = nx;
    p.z = nz;
    emit(p, 'toast', '連人帶板掉進水裡');
    return;
  }
  const wasGround = p.grounded;
  const preVy = p.vy;
  p.x = nx;
  p.z = nz;
  verticalStep(p, dt, gNew);
  // 碗池邊緣飛出：把往外的水平速度轉成垂直，讓人在牆上方騰空再落回碗內
  if (wasGround && !p.grounded && W.kind === 'beach' && preVy > 2.2) {
    for (const b of SKATE.bowls) {
      const sd = bowlSD(b, p.x, p.z);
      if (Math.abs(sd) < 0.9) {
        const e = 0.2;
        const nxv = bowlSD(b, p.x + e, p.z) - bowlSD(b, p.x - e, p.z);
        const nzv = bowlSD(b, p.x, p.z + e) - bowlSD(b, p.x, p.z - e);
        const l = Math.hypot(nxv, nzv) || 1;
        const vn = (p.vx * nxv + p.vz * nzv) / l;
        if (vn > 0) {
          p.vx -= (nxv / l) * vn * 1.12;
          p.vz -= (nzv / l) * vn * 1.12;
          p.vy = Math.max(p.vy, vn * 0.92);
          B.trick = 'air';
          B.airT = 0;
          B.lipAir = true;
        }
      }
    }
  }
  if (!wasGround && p.grounded) land(p, inp);
  if (!p.grounded) {
    p.anim = B.grab > 0.5 ? 'grab' : 'air';
    p.stats.air += dt;
  } else p.anim = p.pushT > 0 ? 'push' : inp.crouch ? 'crouchride' : 'ride';
  p.phase += dt * (p.pushT > 0 ? 3.2 : 1);
}

function land(p, inp) {
  const B = p.board;
  const sp = Math.hypot(p.vx, p.vz);
  if (sp > 0.6) {
    const vyaw = Math.atan2(p.vx, -p.vz);
    // 落地方向與板子方向差太多：調頭（fakie）或摔倒
    const diff = Math.abs(wrapAngle(vyaw - p.yaw));
    if (diff > Math.PI * 0.62) {
      p.yaw = vyaw;
      p.sp = sp;
    } else if (diff > 0.9 && !B.lipAir) {
      bail(p, '落地沒對準');
      return;
    } else {
      p.yaw = vyaw;
      p.sp = sp;
    }
  }
  if (B.flipping || B.shuving) {
    bail(p, '翻板沒轉完');
    return;
  }
  if (p.landV < -15) {
    bail(p, '落差太大');
    return;
  }
  const done = [];
  if (B.done) done.push(B.done);
  if (B.grabbed) done.push('indy');
  if (B.lipAir) done.push('air');
  if ((B.spun || 0) > 2.6) done.push('spin');
  if (!done.length && B.trick === 'ollie' && B.airT > 0.35) done.push('ollie');
  for (const t of done) addTrick(p, t, t === 'spin' ? `${Math.round(((B.spun * 180) / Math.PI) / 180) * 180}°` : '');
  B.done = null;
  B.grabbed = false;
  B.lipAir = false;
  B.trick = null;
  B.spun = 0;
  B.flip = 0;
  B.spin = 0;
}

function addTrick(p, id, extra = '') {
  const B = p.board;
  const pts = { ollie: 50, kickflip: 150, heelflip: 150, shuv: 100, indy: 120, grind: 200, air: 180, spin: 160 }[id] || 50;
  B.score += pts;
  p.stats.tricks++;
  B.last = `${TRICKS[id]}${extra ? ' ' + extra : ''}`;
  emit(p, 'trick', `${B.last}  +${pts}`);
}

function bail(p, why) {
  const B = p.board;
  B.bail = 1.1;
  B.flipping = 0;
  B.shuving = false;
  B.done = null;
  B.flip = 0;
  B.spin = 0;
  emit(p, 'toast', `摔倒了 · ${why}`);
}

function stepWheeled(p, inp, dt, env, kind) {
  const W = env.world;
  const C = p.car;
  const isCar = kind === 'car';
  const maxF = isCar ? (inp.sprint ? 42 : 33) : inp.sprint ? 12 : 8.5;
  const accel = isCar ? 9 : 4;
  C.steer = lerp(C.steer, inp.mx, Math.min(1, dt * (isCar ? 5 : 7)));
  if (p.grounded) {
    if (inp.my > 0.1) p.sp += (p.sp < 0 ? 16 : accel * inp.my * (1 - Math.max(0, p.sp) / (maxF * 1.05))) * dt;
    else if (inp.my < -0.1) p.sp -= (p.sp > 0.5 ? 15 : isCar ? 5 : 2.5) * dt;
    const { gx, gz } = gradAt(W, p.x, p.z);
    const hx = Math.sin(p.yaw);
    const hz = -Math.cos(p.yaw);
    p.sp -= G * 0.5 * (gx * hx + gz * hz) * dt;
    const drag = (isCar ? 0.35 : 0.25) + (isCar ? 0.0018 : 0.006) * p.sp * p.sp;
    p.sp -= Math.sign(p.sp) * Math.min(Math.abs(p.sp), drag * dt);
    p.sp = clamp(p.sp, isCar ? -8 : -2, maxF);
    const wb = isCar ? 2.7 : 1.1;
    const steerA = C.steer * (isCar ? 0.55 : 0.7) / (1 + Math.abs(p.sp) * (isCar ? 0.035 : 0.04));
    p.yaw += (p.sp / wb) * Math.tan(steerA) * dt;
    p.vx = Math.sin(p.yaw) * p.sp;
    p.vz = -Math.cos(p.yaw) * p.sp;
    if (!isCar && inp.jumpPressed) {
      p.vy = 3.8;
      p.grounded = false;
      p.y += 0.03;
    }
  }
  let nx = p.x + p.vx * dt;
  let nz = p.z + p.vz * dt;
  const col = blocked(env, nx, nz, isCar ? 1.3 : 0.5, p.y + 0.3);
  if (col.hit && Math.abs(p.sp) > 3) {
    emit(p, 'bump', isCar ? '撞上建物' : '');
    p.sp *= -0.25;
  } else if (col.hit) p.sp *= 0.5;
  nx = col.x;
  nz = col.z;
  // 撞到車流或行人
  if (env.traffic) {
    for (const c of env.traffic.cars) {
      const d = Math.hypot(c.x - nx, c.z - nz);
      if (d < (isCar ? 3.4 : 2.4) && Math.abs(c.y - p.y) < 2) {
        const ax = (nx - c.x) / (d || 1);
        const az = (nz - c.z) / (d || 1);
        nx = c.x + ax * (isCar ? 3.4 : 2.4);
        nz = c.z + az * (isCar ? 3.4 : 2.4);
        if (Math.abs(p.sp) > 6) emit(p, 'bump', '擦撞');
        p.sp *= 0.4;
      }
    }
    for (const q of env.traffic.peds) {
      if (Math.hypot(q.x - nx, q.z - nz) < 1.6 && Math.abs(p.sp) > 1) {
        p.sp *= 0.1;
        nx = p.x;
        nz = p.z;
      }
    }
  }
  const gNew = W.groundAt(nx, nz);
  if (p.grounded && gNew > p.y + (isCar ? 0.9 : 0.5)) {
    p.sp *= -0.2;
    nx = p.x;
    nz = p.z;
  }
  const water = W.waterAt(nx, nz);
  if (water !== null && gNew < water - 1.0) {
    p.mode = 'walk';
    p.x = nx;
    p.z = nz;
    p.y = water - 0.3;
    emit(p, 'toast', isCar ? '吉普車沉進水裡了…改用游的' : '連車掉進水裡');
    return;
  }
  p.x = nx;
  p.z = nz;
  const wasGround = p.grounded;
  verticalStep(p, dt, gNew);
  if (!wasGround && p.grounded && p.landV < -9) emit(p, 'bump', '重落地');
  // 車身俯仰與側傾
  const hx = Math.sin(p.yaw);
  const hz = -Math.cos(p.yaw);
  const L = isCar ? 1.5 : 0.6;
  const front = W.groundAt(p.x + hx * L, p.z + hz * L);
  const back = W.groundAt(p.x - hx * L, p.z - hz * L);
  const left = W.groundAt(p.x - hz * 0.9, p.z + hx * 0.9);
  const right = W.groundAt(p.x + hz * 0.9, p.z - hx * 0.9);
  C.pitch = lerp(C.pitch, Math.atan2(front - back, 2 * L), Math.min(1, dt * 10));
  C.roll = lerp(C.roll, isCar ? Math.atan2(left - right, 1.8) : -C.steer * clamp(p.sp / 8, 0, 1) * 0.35, Math.min(1, dt * 8));
  C.wheel += (p.sp * dt) / (isCar ? 0.42 : 0.34);
  p.anim = isCar ? 'drive' : 'bike';
  p.phase += dt * Math.abs(p.sp) * (isCar ? 0 : 1.1);
}

function stepPlane(p, inp, dt, env) {
  const W = env.world;
  const P = p.plane;
  if (P.crash > 0) {
    P.crash -= dt;
    if (P.crash <= 0) {
      p.y = Math.max(W.groundAt(p.x, p.z), W.waterY) + 120;
      p.sp = 42;
      P.pitch = 0;
      P.roll = 0;
      P.flying = true;
      emit(p, 'toast', '重新升空');
    }
    return;
  }
  if (inp.throttleUp || inp.sprint) P.throttle = Math.min(1, P.throttle + dt * 0.6);
  if (inp.throttleDown || inp.crouch) P.throttle = Math.max(0, P.throttle - dt * 0.6);
  P.pitch = clamp(P.pitch + inp.my * 1.05 * dt, -1.1, 1.1);
  if (Math.abs(inp.my) < 0.1) P.pitch *= 1 - dt * 0.15;
  P.roll = clamp(P.roll + inp.mx * 1.8 * dt, -1.25, 1.25);
  if (Math.abs(inp.mx) < 0.1) P.roll *= 1 - dt * 1.1;
  const sp = Math.max(p.sp, 1);
  p.yaw += ((9.8 * Math.tan(P.roll)) / Math.max(sp, 18)) * dt;
  // 失速時機頭下壓
  if (p.sp < 24) P.pitch -= (24 - p.sp) * 0.02 * dt;
  p.sp += (P.throttle * 15 - 0.0034 * p.sp * p.sp - 9.8 * Math.sin(P.pitch)) * dt;
  p.sp = clamp(p.sp, 0, 92);
  const cp = Math.cos(P.pitch);
  p.vx = Math.sin(p.yaw) * cp * p.sp;
  p.vz = -Math.cos(p.yaw) * cp * p.sp;
  let lift = Math.sin(P.pitch) * p.sp;
  if (p.sp < 22) lift -= (22 - p.sp) * 0.8;
  p.vy = lift;
  p.x += p.vx * dt;
  p.z += p.vz * dt;
  p.y += p.vy * dt;
  const g = Math.max(W.groundAt(p.x, p.z), W.waterY);
  P.prop += dt * (10 + P.throttle * 50);
  const hitB = collideBuildings(env.streamer, p.x, p.z, 4, p.y).hit;
  if (p.y < g + 1.6 || hitB) {
    if (!hitB && Math.abs(P.roll) < 0.35 && P.pitch > -0.3 && p.sp < 45 && W.waterAt(p.x, p.z) === null) {
      // 降落滑行
      p.y = g + 1.6;
      p.sp *= 1 - dt * 0.8;
      P.pitch = Math.max(P.pitch, 0);
      if (p.sp < 3) {
        emit(p, 'toast', '平安降落');
        p.mode = 'walk';
        p.y = g;
        p.sp = 0;
      }
    } else {
      P.crash = 2.2;
      p.sp = 0;
      emit(p, 'crash', hitB ? '飛機撞上大樓' : '墜機了');
    }
  }
  p.anim = 'fly';
}

function stepBoat(p, inp, dt, env) {
  const W = env.world;
  const B = p.boat;
  const max = inp.sprint ? 30 : 21;
  if (inp.my > 0.1) p.sp += 7 * inp.my * (1 - Math.max(0, p.sp) / (max * 1.05)) * dt;
  else if (inp.my < -0.1) p.sp -= (p.sp > 0 ? 9 : 3) * dt;
  p.sp -= Math.sign(p.sp) * Math.min(Math.abs(p.sp), (0.6 + 0.012 * p.sp * p.sp) * dt);
  p.sp = clamp(p.sp, -5, max);
  p.yaw += inp.mx * clamp(Math.abs(p.sp) / 6, 0.15, 1) * 0.9 * dt * Math.sign(p.sp || 1);
  const nx = p.x + Math.sin(p.yaw) * p.sp * dt;
  const nz = p.z - Math.cos(p.yaw) * p.sp * dt;
  const water = W.waterAt(nx, nz);
  const g = W.groundAt(nx, nz);
  if (water === null || g > water - 0.7) {
    p.sp *= -0.3;
    emit(p, 'bump', '');
  } else {
    p.x = nx;
    p.z = nz;
  }
  const amp = env.seaAmp ?? 0.4;
  const t = env.t;
  const hx = Math.sin(p.yaw);
  const hz = -Math.cos(p.yaw);
  const h = waveHeight(p.x, p.z, t, amp);
  const hf = waveHeight(p.x + hx * 2.5, p.z + hz * 2.5, t, amp);
  const hb = waveHeight(p.x - hx * 2.5, p.z - hz * 2.5, t, amp);
  const hl = waveHeight(p.x - hz, p.z + hx, t, amp);
  const hr = waveHeight(p.x + hz, p.z - hx, t, amp);
  p.y = W.waterY + h + 0.1;
  B.pitch = lerp(B.pitch, Math.atan2(hf - hb, 5) + clamp(p.sp / 30, 0, 1) * 0.12, Math.min(1, dt * 5));
  B.roll = lerp(B.roll, Math.atan2(hl - hr, 2) - inp.mx * clamp(p.sp / 20, 0, 1) * 0.2, Math.min(1, dt * 5));
  p.anim = 'drive';
  p.grounded = true;
}

function stepLift(p, inp, dt, env) {
  const W = env.world;
  const L = p.lift;
  const len = LIFT.zBase - LIFT.zTop;
  const u = (((env.t * LIFT.speed) / (2 * len) + L.chair / L.n) % 1 + 1) % 1;
  const pt = liftPoint(W, u);
  p.x = pt.x;
  p.z = pt.z + 0.3;
  p.y = pt.y - 2.35;
  p.yaw = 0;
  p.anim = 'sit';
  p.sp = LIFT.speed;
  if (inp.jumpPressed) {
    p.lift = null;
    p.vy = 0;
    p.grounded = false;
    emit(p, 'toast', '從吊椅跳下');
    return;
  }
  if (u > 0.5 - 18 / (2 * len) || !pt.up) {
    p.lift = null;
    p.x = LIFT.x - 7;
    p.z = LIFT.zTop + 16;
    p.y = W.groundAt(p.x, p.z);
    p.mode = 'board';
    p.yaw = Math.PI;
    p.sp = 0;
    p.grounded = true;
    emit(p, 'toast', '抵達山頂站 · 換上雪板');
  }
}
