// 車流與行人。車沿車道行駛、在路口用貝茲曲線轉彎、跟車與紅燈停等；行人沿人行道繞街廓、偶爾過斑馬線。
import { CAR_MODELS } from './world.js';
import { clamp, mulberry32, pick } from './math.js';

const CAR_COLORS = [0xe9ecef, 0x22262b, 0x8b97a3, 0x9b1c1c, 0x1f3a63, 0x6b7f5a, 0xc9b98f, 0x7fb0c8, 0x4a4e55, 0xb64a2f];
export const LIGHT_CYCLE = 30;

// 紅綠燈：回傳該軸向是否可通行（'green' | 'yellow' | 'red'）
export function signalState(axis, t) {
  const p = t % LIGHT_CYCLE;
  const zGreen = p < 13;
  const zYellow = p >= 13 && p < 15;
  const xGreen = p >= 15 && p < 28;
  const xYellow = p >= 28;
  if (axis === 'z') return zGreen ? 'green' : zYellow ? 'yellow' : 'red';
  return xGreen ? 'green' : xYellow ? 'yellow' : 'red';
}

function lanes(world, axis, line) {
  const K = world.K;
  if (axis === 'z') return K.avW >= 20 ? [2.5, 6.0] : [K.avW / 4];
  const w = world.streetW(line);
  return [Math.min(2.2, w / 4)];
}

export class Traffic {
  constructor(world, seed = 7) {
    this.world = world;
    this.rnd = mulberry32(seed);
    this.cars = [];
    this.peds = [];
    this.nextId = 1;
    this.t = 0;
    this.enabled = world.K.grid && world.K.traffic > 0;
  }

  roadOk(axis, line, s) {
    const W = this.world;
    const K = W.K;
    if (axis === 'z') {
      if (!W.avenueExists(line) || W.avenueClass(line) === 'path') return false;
      return W.terrain(line * K.PX, s) > 0.4 || W.kind !== 'hills';
    }
    if (W.isCanalLine(line)) return false;
    const i = Math.floor(s / K.PX);
    return W.streetExists(i, line);
  }

  pos(axis, line, s, lane, dir) {
    const K = this.world.K;
    if (axis === 'z') return { x: line * K.PX - dir * lane, z: s };
    return { x: s, z: line * K.PZ + dir * lane };
  }

  spawnCar(px, pz, far) {
    const W = this.world;
    const K = W.K;
    const r = this.rnd;
    const axis = r() < 0.55 ? 'z' : 'x';
    const ang = r() * Math.PI * 2;
    const dist = far ? 150 + r() * 80 : 20 + r() * 160;
    const tx = px + Math.cos(ang) * dist;
    const tz = pz + Math.sin(ang) * dist;
    const line = axis === 'z' ? Math.round(tx / K.PX) : Math.round(tz / K.PZ);
    const s = axis === 'z' ? tz : tx;
    if (!this.roadOk(axis, line, s)) return;
    const L = lanes(W, axis, line);
    const lane = pick(r, L);
    const dir = r() < 0.5 ? 1 : -1;
    const p = this.pos(axis, line, s, lane, dir);
    if (Math.hypot(p.x - px, p.z - pz) < 14) return;
    for (const c of this.cars) if (Math.hypot(c.x - p.x, c.z - p.z) < 9) return;
    const taxi = W.kind === 'metro' && r() < 0.42;
    const model = taxi ? 'taxi' : pick(r, CAR_MODELS.filter((m) => m !== 'taxi'));
    const cruise = axis === 'z' ? 11 + r() * 4 : 8 + r() * 3;
    this.cars.push({
      id: this.nextId++, axis, line, lane, dir, s, speed: cruise * 0.7, cruise, model,
      color: taxi ? 0xf4c531 : pick(r, CAR_COLORS), x: p.x, z: p.z, y: W.groundAt(p.x, p.z), yaw: 0, turn: null, wheel: 0,
      brake: false,
    });
  }

  spawnPed(px, pz) {
    const W = this.world;
    const K = W.K;
    const r = this.rnd;
    const ang = r() * Math.PI * 2;
    const dist = 12 + r() * 90;
    const i = Math.floor((px + Math.cos(ang) * dist) / K.PX);
    const j = Math.floor((pz + Math.sin(ang) * dist) / K.PZ);
    const use = W.cellUse(i, j);
    if (use === 'water' || use === 'beach') return;
    const b = W.blockRect(i, j);
    const inset = Math.min(W.K.walk * 0.55, 2.4);
    const rect = { x0: b.x0 + inset, z0: b.z0 + inset, x1: b.x1 - inset, z1: b.z1 - inset };
    const per = 2 * (rect.x1 - rect.x0 + rect.z1 - rect.z0);
    const ped = {
      id: this.nextId++, i, j, rect, per, u: r() * per, dir: r() < 0.5 ? 1 : -1, speed: 1.1 + r() * 0.5,
      x: 0, z: 0, y: 0, yaw: 0, phase: r() * 10, look: Math.floor(r() * 6), cross: null,
    };
    this.placePed(ped);
    if (Math.hypot(ped.x - px, ped.z - pz) < 6) return;
    this.peds.push(ped);
  }

  placePed(p) {
    const R = p.rect;
    const w = R.x1 - R.x0;
    const d = R.z1 - R.z0;
    let u = ((p.u % p.per) + p.per) % p.per;
    let x;
    let z;
    let yaw;
    if (u < w) {
      x = R.x0 + u; z = R.z0; yaw = Math.PI / 2;
    } else if ((u -= w) < d) {
      x = R.x1; z = R.z0 + u; yaw = Math.PI;
    } else if ((u -= d) < w) {
      x = R.x1 - u; z = R.z1; yaw = -Math.PI / 2;
    } else {
      u -= w;
      x = R.x0; z = R.z1 - u; yaw = 0;
    }
    // yaw：0 = 朝北（-z）；沿 +x 走為 -π/2… 這裡統一用 atan2(dx, -dz)
    if (p.dir < 0) yaw += Math.PI;
    p.x = x;
    p.z = z;
    p.yaw = yaw;
  }

  update(dt, player) {
    this.t += dt;
    if (!this.enabled) {
      this.cars.length = 0;
      return;
    }
    const W = this.world;
    const K = W.K;
    const px = player.x;
    const pz = player.z;
    const R = 260;
    // 補車、補行人
    const wantCars = K.traffic;
    for (let k = 0; k < 3 && this.cars.length < wantCars; k++) this.spawnCar(px, pz, this.cars.length > wantCars * 0.6);
    for (let k = 0; k < 3 && this.peds.length < K.peds; k++) this.spawnPed(px, pz);
    this.cars = this.cars.filter((c) => Math.hypot(c.x - px, c.z - pz) < R * 1.25);
    this.peds = this.peds.filter((p) => Math.hypot(p.x - px, p.z - pz) < 140);

    for (const c of this.cars) this.stepCar(c, dt, player);
    for (const p of this.peds) this.stepPed(p, dt, player);
  }

  stepCar(c, dt, player) {
    const W = this.world;
    const K = W.K;
    let target = c.cruise;
    // 前車與玩家
    const fx = c.turn ? Math.sin(c.yaw) : c.axis === 'x' ? c.dir : 0;
    const fz = c.turn ? -Math.cos(c.yaw) : c.axis === 'z' ? c.dir : 0;
    let gap = 99;
    for (const o of this.cars) {
      if (o === c) continue;
      const dx = o.x - c.x;
      const dz = o.z - c.z;
      const ahead = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && side < 1.6) gap = Math.min(gap, ahead);
    }
    if (player && player.mode !== 'plane') {
      const dx = player.x - c.x;
      const dz = player.z - c.z;
      const ahead = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && side < 2.0 && Math.abs(player.y - c.y) < 3) gap = Math.min(gap, ahead - 1);
    }
    if (gap < 18) target = Math.min(target, Math.max(0, (gap - 7) * 1.2));
    // 紅燈：在路口停止線前停下
    if (!c.turn) {
      const pitch = c.axis === 'z' ? K.PZ : K.PX;
      const nextCross = c.dir > 0 ? Math.ceil(c.s / pitch) * pitch : Math.floor(c.s / pitch) * pitch;
      const crossHalf = c.axis === 'z' ? W.streetW(Math.round(nextCross / pitch)) / 2 : K.avW / 2;
      const stopAt = nextCross - c.dir * (crossHalf + 2.5);
      const toStop = (stopAt - c.s) * c.dir;
      const sig = W.kind === 'canal' || W.kind === 'town' ? 'green' : signalState(c.axis, this.t);
      if (sig !== 'green' && toStop > 0 && toStop < 22) target = Math.min(target, Math.max(0, toStop - 1) * 0.9);
      c.waiting = target < 0.5;
    }
    const acc = target > c.speed ? 3.2 : 7.5;
    c.speed += clamp(target - c.speed, -acc * dt, acc * dt);
    c.brake = target < c.speed - 0.5 || c.speed < 0.3;
    const ds = c.speed * dt;
    c.wheel += ds / 0.35;

    if (c.turn) {
      const T = c.turn;
      T.t += ds / T.len;
      if (T.t >= 1) {
        c.axis = T.axis;
        c.line = T.line;
        c.lane = T.lane;
        c.dir = T.dir;
        c.s = T.s;
        c.turn = null;
      } else {
        const t = T.t;
        const a = (1 - t) * (1 - t);
        const b = 2 * (1 - t) * t;
        const d = t * t;
        c.x = a * T.p0.x + b * T.p1.x + d * T.p2.x;
        c.z = a * T.p0.z + b * T.p1.z + d * T.p2.z;
        const tx = 2 * (1 - t) * (T.p1.x - T.p0.x) + 2 * t * (T.p2.x - T.p1.x);
        const tz = 2 * (1 - t) * (T.p1.z - T.p0.z) + 2 * t * (T.p2.z - T.p1.z);
        c.yaw = Math.atan2(tx, -tz);
        c.y = W.groundAt(c.x, c.z);
        return;
      }
    }
    const pitch = c.axis === 'z' ? K.PZ : K.PX;
    const prevS = c.s;
    c.s += ds * c.dir;
    // 到達路口入口時決定轉彎
    const nextCross = c.dir > 0 ? Math.ceil(prevS / pitch) * pitch : Math.floor(prevS / pitch) * pitch;
    const crossLine = Math.round(nextCross / pitch);
    const crossAxis = c.axis === 'z' ? 'x' : 'z';
    const crossHalf = c.axis === 'z' ? W.streetW(crossLine) / 2 : K.avW / 2;
    const entry = nextCross - c.dir * crossHalf;
    if ((prevS - entry) * c.dir < 0 && (c.s - entry) * c.dir >= 0) {
      const r = this.rnd();
      const opts = [];
      for (const nd of [1, -1]) {
        const probe = (c.axis === 'z' ? c.line * K.PX : c.line * K.PZ) + nd * 20;
        if (this.roadOk(crossAxis, crossLine, probe)) opts.push(nd);
      }
      const straightOk = this.roadOk(c.axis, c.line, nextCross + c.dir * pitch * 0.5);
      let choice = 0;
      if (!straightOk && opts.length) choice = pick(this.rnd, opts);
      else if (opts.length && r < 0.35) choice = pick(this.rnd, opts);
      else if (!straightOk) {
        c.dir *= -1; // 死路就迴轉
        return;
      }
      if (choice !== 0) {
        const L = lanes(W, crossAxis, crossLine);
        const nlane = L[0];
        const p0 = this.pos(c.axis, c.line, entry, c.lane, c.dir);
        const mainLine = c.axis === 'z' ? c.line * K.PX : c.line * K.PZ;
        const exitS = mainLine + choice * (c.axis === 'z' ? K.avW / 2 : this.world.streetW(c.line) / 2);
        const p2 = this.pos(crossAxis, crossLine, exitS, nlane, choice);
        const p1 = c.axis === 'z' ? { x: p0.x, z: p2.z } : { x: p2.x, z: p0.z };
        const len = Math.hypot(p1.x - p0.x, p1.z - p0.z) + Math.hypot(p2.x - p1.x, p2.z - p1.z);
        c.turn = { p0, p1, p2, len: Math.max(1, len * 0.8), t: 0, axis: crossAxis, line: crossLine, lane: nlane, dir: choice, s: exitS };
        return;
      }
    }
    const p = this.pos(c.axis, c.line, c.s, c.lane, c.dir);
    c.x = p.x;
    c.z = p.z;
    c.y = W.groundAt(c.x, c.z);
    c.yaw = c.axis === 'z' ? (c.dir > 0 ? Math.PI : 0) : c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  stepPed(p, dt, player) {
    const W = this.world;
    if (p.cross) {
      const C = p.cross;
      C.t += (p.speed * dt) / C.len;
      p.x = C.x0 + (C.x1 - C.x0) * Math.min(1, C.t);
      p.z = C.z0 + (C.z1 - C.z0) * Math.min(1, C.t);
      p.yaw = Math.atan2(C.x1 - C.x0, -(C.z1 - C.z0));
      if (C.t >= 1) {
        p.i = C.i;
        p.j = C.j;
        p.rect = C.rect;
        p.per = C.per;
        p.u = C.u;
        p.cross = null;
      }
    } else {
      // 被玩家擋住就停
      const blocked = player && Math.hypot(player.x - p.x, player.z - p.z) < 1.3;
      if (!blocked) p.u += p.dir * p.speed * dt;
      p.stopped = blocked;
      const R = p.rect;
      const w = R.x1 - R.x0;
      const d = R.z1 - R.z0;
      const corners = [0, w, w + d, 2 * w + d];
      const prevU = p.u - p.dir * p.speed * dt;
      for (let k = 0; k < 4; k++) {
        const cu = corners[k];
        const a = ((prevU % p.per) + p.per) % p.per;
        const b = ((p.u % p.per) + p.per) % p.per;
        const crossed = p.dir > 0 ? a < cu && b >= cu && b - a < 5 : a > cu && b <= cu && a - b < 5;
        if (crossed && this.rnd() < 0.3) this.startCross(p, k);
      }
      if (!p.cross) this.placePed(p);
    }
    p.y = W.groundAt(p.x, p.z);
    p.phase += dt * p.speed * (p.stopped ? 0 : 1);
  }

  startCross(p, corner) {
    const W = this.world;
    const R = p.rect;
    const cx = corner === 0 || corner === 3 ? R.x0 : R.x1;
    const cz = corner === 0 || corner === 1 ? R.z0 : R.z1;
    // 沿行進方向過街到隔壁街廓
    const horizontal = this.rnd() < 0.5;
    let ni = p.i;
    let nj = p.j;
    if (horizontal) ni += cx === R.x0 ? -1 : 1;
    else nj += cz === R.z0 ? -1 : 1;
    const use = W.cellUse(ni, nj);
    if (use === 'water' || use === 'beach') return;
    if (!horizontal && W.isCanalLine(cz === R.z0 ? p.j : p.j + 1)) return;
    const b = W.blockRect(ni, nj);
    const inset = Math.min(W.K.walk * 0.55, 2.4);
    const rect = { x0: b.x0 + inset, z0: b.z0 + inset, x1: b.x1 - inset, z1: b.z1 - inset };
    const tx = horizontal ? (cx === R.x0 ? rect.x1 : rect.x0) : cx;
    const tz = horizontal ? cz : cz === R.z0 ? rect.z1 : rect.z0;
    const w = rect.x1 - rect.x0;
    const d = rect.z1 - rect.z0;
    let u;
    if (tz === rect.z0) u = tx - rect.x0;
    else if (tx === rect.x1) u = w + (tz - rect.z0);
    else if (tz === rect.z1) u = w + d + (rect.x1 - tx);
    else u = 2 * w + d + (rect.z1 - tz);
    p.cross = { x0: p.x, z0: p.z, x1: tx, z1: tz, len: Math.max(1, Math.hypot(tx - p.x, tz - p.z)), t: 0, i: ni, j: nj, rect, per: 2 * (w + d), u };
  }
}
