// 特技場的規則：大迴圈的側向導引、加速墊、收集環、Free Ride 任務、Time Attack 的檢查點與計時。
// 只處理本機玩家的車；不碰 DOM。
import { Vector3 } from 'three';
import { RINGS, PADS, TA } from './park.js';
import { turbo, carAxes } from './car.js';
import { Tricks } from './tricks.js';

const _fwd = new Vector3(), _up = new Vector3(), _left = new Vector3();
const ease = (t) => t * t * (3 - 2 * t);
const dease = (t) => 6 * t * (1 - t);

// 大迴圈的出口往側邊錯開；車在迴圈面上時，依目前繞到的角度把橫向位置拉到軌道中線
export function loopProgress(park, car) {
  const piece = park.pieces.find((p) => p.loop);
  if (!piece) return null;
  const { F, loop } = piece;
  const p = car.body.translation();
  const fx = Math.sin(F.yaw), fz = Math.cos(F.yaw);
  const dx = p.x - F.x, dz = p.z - F.z;
  const sL = dx * fx + dz * fz, l = dx * fz - dz * fx, h = p.y;
  if (Math.abs(sL) > loop.R + 2 || h < 0.7 || h > loop.R * 2 + 2) return null;
  const a = Math.atan2(sL, loop.R - h);
  const t = a >= 0 ? a / (Math.PI * 2) : 1 + a / (Math.PI * 2);
  const target = -loop.shift * ease(t);
  if (Math.abs(l - target) > loop.hw + 3) return null;
  return { piece, t, l, target, sL, h };
}

export function loopAssist(park, car, dt) {
  const lp = loopProgress(park, car);
  if (!lp || car.state.contacts < 2) return lp;
  const { piece, t, l, target } = lp;
  const { F, loop } = piece;
  const v = car.body.linvel();
  const sp = Math.hypot(v.x, v.y, v.z);
  // 沿迴圈前進的速度換算成橫向速度，再加上拉回中線的修正
  const want = -loop.shift * dease(t) * sp / (Math.PI * 2 * loop.R) + (target - l) * 3;
  const lx = Math.cos(F.yaw), lz = -Math.sin(F.yaw);
  const cur = v.x * lx + v.z * lz;
  const k = 1 - Math.exp(-12 * dt);
  car.body.setLinvel({ x: v.x + lx * (want - cur) * k, y: v.y, z: v.z + lz * (want - cur) * k }, true);
  return lp;
}

// 加速墊：車開過去（離地 2 m 內、6×10 m 範圍）就補冷氣並推一把，同一塊 2 秒內不重複
export class Pads {
  constructor() { this.cool = PADS.map(() => 0); }
  update(car, dt, out) {
    const p = car.body.translation();
    for (let i = 0; i < PADS.length; i++) {
      this.cool[i] = Math.max(0, this.cool[i] - dt);
      const pd = PADS[i];
      const fx = Math.sin(pd.yaw), fz = Math.cos(pd.yaw);
      const dx = p.x - pd.x, dz = p.z - pd.z;
      const s = dx * fx + dz * fz, l = dx * fz - dz * fx;
      if (this.cool[i] <= 0 && Math.abs(s) < 5 && Math.abs(l) < 3.5 && p.y < 2.5) {
        this.cool[i] = 2;
        turbo(car, 45, 9);
        out.push({ type: 'pad', i });
      }
    }
  }
}

// 通過一個環：上一個 tick 與這個 tick 在環面兩側，且穿過點離中心不超過半徑
export function crossed(gate, prev, cur, slack = 1.15) {
  const [dx, dy, dz] = gate.dir;
  const a = (prev.x - gate.x) * dx + (prev.y - gate.y) * dy + (prev.z - gate.z) * dz;
  const b = (cur.x - gate.x) * dx + (cur.y - gate.y) * dy + (cur.z - gate.z) * dz;
  if (!(a < 0 && b >= 0)) return false;
  const t = a / (a - b);
  const x = prev.x + (cur.x - prev.x) * t - gate.x, y = prev.y + (cur.y - prev.y) * t - gate.y, z = prev.z + (cur.z - prev.z) * t - gate.z;
  return Math.hypot(x, y, z) <= gate.r * slack;
}

export const OBJECTIVES = [
  { id: 'launch', text: '1.1 秒內 0–60 mph', key: '按住 Shift＋W' },
  { id: 'semi', text: '飛越聯結車' },
  { id: 'lineup', text: '飛越整排車' },
  { id: 'kickflip', text: '落地一次 Kickflip', key: '起跳後馬上 Q／E' },
  { id: 'curl', text: '在 THE CURL 爬上 15 m' },
  { id: 'loop', text: '跑完大迴圈' },
  { id: 'wall', text: '騎牆 3 秒', key: 'F 切吸附 WALL' },
  { id: 'fly', text: '連續飛行 5 秒', key: '空中按住空白鍵' },
  { id: 'mph88', text: '衝上 88 mph' },
  { id: 'rings', text: '收集 6 個紅環' },
];

// Free Ride：分數、任務、收集環
export class FreeRide {
  constructor(park) {
    this.park = park;
    this.tricks = new Tricks();
    this.pads = new Pads();
    this.done = {};
    this.rings = RINGS.map(() => false);
    this.score = 0;
    this.t60 = null; this.wallT = 0; this.flyT = 0; this.flyGap = 0;
    this.loopMax = 0; this.loopHalf = false;
    this.overSemi = false; this.prev = null;
  }
  complete(id, out) {
    if (this.done[id]) return;
    this.done[id] = true;
    this.score += 500;
    out.push({ type: 'objective', id, text: OBJECTIVES.find((o) => o.id === id).text, count: Object.keys(this.done).length });
  }
  update(car, dt, out) {
    const s = car.state, p = car.body.translation();
    const cur = { x: p.x, y: p.y, z: p.z };
    const local = [];
    const lp = loopAssist(this.park, car, dt);
    this.pads.update(car, dt, local);
    const curl = s.onGround === false && s.groundN.y < 0.5 && Math.abs(p.x) < 24 && p.z > 140;
    this.tricks.update(car, dt, local, curl);
    for (const e of local) {
      out.push(e);
      if (e.type === 'landed' || e.type === 'drift') this.score += e.total || e.pts;
      if (e.type === 'landed' && e.tricks.includes('KICKFLIP')) this.complete('kickflip', out);
      if (e.type === 'speed88') this.complete('mph88', out);
      if (e.type === 'landOk') {
        if (this.overSemi) this.complete('semi', out);
        const L = this.tricks.launch;
        if (L && L.x > -110 && p.x < -158 && Math.abs(L.z + 60) < 14 && Math.abs(p.z + 60) < 16) this.complete('lineup', out);
      }
    }
    if (s.contacts >= 2) this.overSemi = false;
    if (s.contacts === 0 && p.x > 109 && p.x < 115 && p.z > 30 && p.z < 55 && p.y > 4.6) this.overSemi = true;
    // 0-60：從靜止開始計時
    if (s.speed < 0.6) this.t60 = s.input.throttle > 0 ? 0 : null;
    else if (this.t60 !== null) {
      this.t60 += dt;
      if (s.speed >= 26.82) { out.push({ type: 'sixty', t: this.t60 }); if (this.t60 < 1.1) this.complete('launch', out); this.t60 = null; }
      else if (this.t60 > 4) this.t60 = null;
    }
    if (s.contacts >= 2 && Math.abs(p.x) < 23 && p.z > 148 && p.z < 182 && p.y > 15) this.complete('curl', out);
    if (lp && s.contacts >= 2) {
      if (lp.t > 0.4 && lp.t < 0.6) this.loopHalf = true;
      if (this.loopHalf && lp.t > 0.9) this.complete('loop', out);
    } else if (!lp) this.loopHalf = false;
    if (s.contacts >= 3 && Math.abs(_upY(car)) < 0.4) { this.wallT += dt; if (this.wallT >= 3) this.complete('wall', out); } else this.wallT = 0;
    if (s.hovering) { this.flyT += dt; this.flyGap = 0; if (this.flyT >= 5) this.complete('fly', out); }
    else { this.flyGap += dt; if (this.flyGap > 0.35) this.flyT = 0; }
    for (let i = 0; i < RINGS.length; i++) {
      if (this.rings[i]) continue;
      const r = RINGS[i];
      if (Math.hypot(p.x - r.x, p.y - r.y, p.z - r.z) < r.r + 1) {
        this.rings[i] = true; this.score += 250;
        out.push({ type: 'ring', i, n: this.rings.filter(Boolean).length });
        if (this.rings.every(Boolean)) this.complete('rings', out);
      }
    }
    this.prev = cur;
  }
}

function _upY(car) { carAxes(car.body, undefined, _fwd, _up, _left); return _up.y; }

// Time Attack：倒數 → 計時 → 依序通過 5 個環與終點。記錄每個檢查點的分段時間與幽靈車軌跡
export const GHOST_HZ = 30;
export class TimeAttack {
  constructor(park) {
    this.park = park;
    this.tricks = new Tricks();
    this.pads = new Pads();
    this.reset();
  }
  reset() {
    this.phase = 'countdown'; this.count = 3; this.time = 0;
    this.next = 0; this.splits = []; this.prev = null;
    this.ghost = []; this.ghostAcc = 0; this.wrongT = 0; this.wrong = false;
    this.pads = new Pads();
  }
  get gates() { return [...TA.gates, TA.finish]; }
  respawnPoint() {
    if (this.next === 0) { const s = TA.start; return [s.x, s.z, s.yaw]; }
    return TA.gates[this.next - 1].respawn;
  }
  update(car, dt, out) {
    if (this.phase === 'countdown') {
      const before = Math.ceil(this.count);
      this.count -= dt;
      car.state.frozen = true;
      if (Math.ceil(this.count) !== before && this.count > 0) out.push({ type: 'count', n: Math.ceil(this.count) });
      if (this.count <= 0) { this.phase = 'run'; car.state.frozen = false; out.push({ type: 'go' }); }
      return;
    }
    if (this.phase !== 'run') return;
    car.state.frozen = false;
    this.time += dt;
    loopAssist(this.park, car, dt);
    this.pads.update(car, dt, out);
    const local = [];
    const p = car.body.translation();
    const curl = Math.abs(p.x) < 24 && p.z > 140;
    this.tricks.update(car, dt, local, curl);
    for (const e of local) if (e.type === 'landed' || e.type === 'drift' || e.type === 'trick' || e.type === 'speed88' || e.type === 'bail') out.push(e);
    const cur = { x: p.x, y: p.y, z: p.z };
    const gates = this.gates;
    if (this.prev && this.next < gates.length) {
      const g = gates[this.next];
      if (crossed(g, this.prev, cur)) {
        this.splits.push(this.time);
        this.next++;
        if (this.next >= gates.length) { this.phase = 'done'; out.push({ type: 'finish', time: this.time, splits: this.splits.slice() }); }
        else out.push({ type: 'gate', i: this.next - 1, time: this.time });
      }
    }
    // 逆向：速度往離下一個環遠的方向跑超過 1.5 秒
    if (this.next < gates.length) {
      const g = gates[this.next], v = car.body.linvel();
      const dx = g.x - p.x, dz = g.z - p.z, d = Math.hypot(dx, dz) || 1, sp = Math.hypot(v.x, v.z);
      const away = sp > 10 && (v.x * dx + v.z * dz) / (d * sp) < -0.6 && d > 60;
      this.wrongT = away ? this.wrongT + dt : 0;
      const w = this.wrongT > 1.5;
      if (w !== this.wrong) { this.wrong = w; out.push({ type: 'wrongway', on: w }); }
    }
    // 幽靈車：每秒 30 格，位置＋姿態
    this.ghostAcc += dt;
    while (this.ghostAcc >= 1 / GHOST_HZ) {
      this.ghostAcc -= 1 / GHOST_HZ;
      const r = car.body.rotation();
      this.ghost.push(p.x, p.y, p.z, r.x, r.y, r.z, r.w);
    }
    this.prev = cur;
  }
}

export function medalFor(time) {
  const m = TA.medals;
  if (time <= m.author) return 'author';
  if (time <= m.gold) return 'gold';
  if (time <= m.silver) return 'silver';
  if (time <= m.bronze) return 'bronze';
  return null;
}
