// AI 對手：預測球路找能趕上的攔截點，從球後方對準對方球門推進；球往自己門口跑就回防。
// 輸出和玩家一樣的輸入結構，物理上不作弊。
import { Vector3, Quaternion } from 'three';
import { ARENA, BALL, GRAVITY, CAR } from './const.js';
import { arenaSDF, arenaNormal } from './arena.js';

export const LEVELS = {
  rookie: { name: '新手', react: 0.36, boost: 0, jump: false, dodge: false, aerial: false, cap: 0.75, kcap: 0.75, aim: 4 },
  pro: { name: '職業', react: 0.15, boost: 0.3, jump: true, dodge: true, aerial: false, cap: 0.92, kcap: 0.92, aim: 1.2 },
  allstar: { name: '全明星', react: 0.06, boost: 0.6, jump: true, dodge: true, aerial: false, cap: 1, kcap: 0.88, aim: 0.35 },
};

const PRED_DT = 1 / 60, PRED_N = 240;
const _n = new Vector3(), _q = new Quaternion(), _l = new Vector3(), _f = new Vector3(), _u = new Vector3(), _left = new Vector3();

// 球路預測：重力、阻力、對距離場反彈。回傳 [x,y,z,vx,vy,vz] × N
export function predictBall(p, v, out = new Float32Array(PRED_N * 6), n = PRED_N) {
  let x = p.x, y = p.y, z = p.z, vx = v.x, vy = v.y, vz = v.z;
  const drag = Math.pow(1 - BALL.DRAG, PRED_DT);
  for (let i = 0; i < n; i++) {
    vy -= GRAVITY * PRED_DT;
    vx *= drag; vy *= drag; vz *= drag;
    x += vx * PRED_DT; y += vy * PRED_DT; z += vz * PRED_DT;
    const d = arenaSDF(x, y, z);
    if (d < BALL.R) {
      arenaNormal(x, y, z, _n);
      x += _n.x * (BALL.R - d); y += _n.y * (BALL.R - d); z += _n.z * (BALL.R - d);
      const vn = vx * _n.x + vy * _n.y + vz * _n.z;
      if (vn < 0) {
        vx -= 1.6 * vn * _n.x; vy -= 1.6 * vn * _n.y; vz -= 1.6 * vn * _n.z;
        const k = Math.max(0.6, 1 - 0.35 * 1.6 * -vn / (Math.hypot(vx, vy, vz) + 1e-3));
        const vn2 = vx * _n.x + vy * _n.y + vz * _n.z;
        vx = _n.x * vn2 + (vx - _n.x * vn2) * k; vy = _n.y * vn2 + (vy - _n.y * vn2) * k; vz = _n.z * vn2 + (vz - _n.z * vn2) * k;
      }
    }
    const o = i * 6;
    out[o] = x; out[o + 1] = y; out[o + 2] = z; out[o + 3] = vx; out[o + 4] = vy; out[o + 5] = vz;
  }
  return out;
}

export class Bot {
  constructor(sim, car, level = 'pro') {
    this.sim = sim; this.car = car;
    this.setLevel(level);
    this.pred = new Float32Array(PRED_N * 6);
    this.think = 0;
    this.target = new Vector3();
    this.mode = 'chase';
    this.seq = null;        // 跳躍、翻滾的按鍵序列
    this.stuck = 0;
    this.unstick = 0;
    this.wobble = Math.random() * 10;
  }

  setLevel(level) { this.levelKey = level; this.L = LEVELS[level] || LEVELS.pro; }

  update(dt) {
    const sim = this.sim, car = this.car, s = car.state, inp = s.input, L = this.L;
    if (sim.phase !== 'play' && sim.phase !== 'kickoff') { inp.throttle = 0; inp.boost = false; inp.jump = false; inp.steer = 0; return; }
    if (s.demolished > 0) return;
    const own = car.team === 0 ? -1 : 1;     // 自家球門在 Z 的哪一側
    const b = sim.ball.body, bp = b.translation(), bv = b.linvel();
    const t = car.body.translation(), v = car.body.linvel();
    const r = car.body.rotation();
    _q.set(r.x, r.y, r.z, r.w);
    _f.set(0, 0, 1).applyQuaternion(_q); _u.set(0, 1, 0).applyQuaternion(_q); _left.set(1, 0, 0).applyQuaternion(_q);
    const speed = Math.hypot(v.x, v.y, v.z);
    this.wobble += dt;

    // 按鍵序列優先（跳躍、翻滾進行中）
    if (this.seq) {
      const step = this.seq[0];
      step.t -= dt;
      Object.assign(inp, step.in);
      if (step.t <= 0) { this.seq.shift(); if (!this.seq.length) this.seq = null; }
      if (!s.onGround) this.airControl(inp, step.aim);
      return;
    }

    // 重新規劃（反應延遲）
    this.think -= dt;
    if (this.think <= 0 || sim.phase === 'kickoff') {
      this.think = L.react;
      this.plan(own, bp, bv, t, v, speed);
    }

    if (!s.onGround && s.contacts === 0) {
      inp.throttle = 1; inp.boost = false; inp.jump = false;
      this.airControl(inp, null);
      // 倒在地上：跳一下翻正
      if (arenaSDF(t.x, t.y, t.z) < 0.55 && _u.y < 0.3 && speed < 2) inp.jump = Math.floor(this.wobble * 4) % 2 === 0;
      return;
    }
    inp.pitch = 0; inp.roll = 0; inp.jump = false;

    // 卡住脫困
    if (inp.throttle > 0 && speed < 1.2 && sim.phase === 'play') this.stuck += dt; else this.stuck = Math.max(0, this.stuck - dt * 2);
    if (this.stuck > 1.2) { this.unstick = 0.8; this.stuck = 0; }
    if (this.unstick > 0) {
      this.unstick -= dt;
      inp.throttle = -1; inp.steer = Math.sin(this.wobble) > 0 ? 1 : -1; inp.boost = false; inp.slide = false;
      return;
    }

    if (sim.phase === 'kickoff') { inp.throttle = 0; inp.boost = false; inp.steer = 0; return; }
    this.driveTo(this.target, inp, speed, this.mode === 'retreat' || this.mode === 'kickoff' || this.urgent);

    // 出手：地面球翻滾加力、半空球跳起來頂
    const dx = bp.x - t.x, dy = bp.y - t.y, dz = bp.z - t.z;
    const fd = dx * _f.x + dy * _f.y + dz * _f.z, ld = dx * _left.x + dy * _left.y + dz * _left.z, ud = dx * _u.x + dy * _u.y + dz * _u.z;
    const near = 2.2 + speed * 0.16;
    const shotOk = this.mode !== 'retreat' && fd > 0 && fd < near && Math.abs(ld) < 1.3;
    if (this.mode === 'kickoff' && L.dodge && fd > 0 && fd < 4.5 + speed * 0.12 && Math.abs(ld) < 1.5 && speed > 12) {
      this.seq = [{ t: 0.07, in: { jump: true, throttle: 1, boost: true, pitch: 0 } }, { t: 0.05, in: { jump: false, boost: true } }, { t: 0.05, in: { jump: true, pitch: -1, yaw: 0, roll: 0 } }, { t: 0.7, in: { jump: false, pitch: -1, boost: false } }];
      return;
    }
    if (shotOk && L.jump && ud > 1.3 && ud < 3.6) {
      const hold = ud > 2.5 ? 0.2 : 0.1;
      const seq = [{ t: hold, in: { jump: true, throttle: 1, boost: false, pitch: 0, yaw: 0, roll: 0 } }, { t: 0.06, in: { jump: false } }];
      if (ud > 2.8) seq.push({ t: 0.05, in: { jump: true } }, { t: 0.5, in: { jump: false } });
      else if (L.dodge) seq.push({ t: 0.05, in: { jump: true, pitch: -1, yaw: Math.max(-1, Math.min(1, -ld * 0.8)) } }, { t: 0.6, in: { jump: false, pitch: 0, yaw: 0 } });
      this.seq = seq;
      return;
    }
    if (shotOk && L.dodge && ud < 1.3 && speed > 9 && fd < 1.6 + speed * 0.1 && fd > 1.2) {
      const side = Math.max(-1, Math.min(1, -ld * 0.9));
      this.seq = [{ t: 0.06, in: { jump: true, throttle: 1, pitch: 0 } }, { t: 0.05, in: { jump: false } }, { t: 0.05, in: { jump: true, pitch: -1, yaw: side } }, { t: 0.65, in: { jump: false, pitch: 0, yaw: 0 } }];
      return;
    }
    // 空中球：全明星會起飛
    if (L.aerial && this.aerialSpot && s.boost > 30 && s.onGround && _u.y > 0.9) {
      const a = this.aerialSpot;
      const hx = a.x - t.x, hz = a.z - t.z, hd = Math.hypot(hx, hz);
      const ang = Math.abs(Math.atan2(hx * _left.x + hz * _left.z, hx * _f.x + hz * _f.z));
      if (ang < 0.25 && hd < a.y * 1.6 + 4 && a.y > 4) {
        this.seq = [{ t: 0.2, in: { jump: true, boost: true, throttle: 1 } }, { t: 0.05, in: { jump: false, boost: true } }, { t: 0.05, in: { jump: true, boost: true } }, { t: Math.min(2.2, a.t), in: { jump: false, boost: true }, aim: a }];
      }
    }
  }

  plan(own, bp, bv, t, v, speed) {
    const L = this.L, sim = this.sim, s = this.car.state;
    predictBall(bp, bv, this.pred);
    const oppZ = -own * (ARENA.B + 2);
    this.urgent = false;
    this.aerialSpot = null;
    // 開球：直衝球心
    if (sim.phase === 'kickoff' || (Math.abs(bp.x) < 0.1 && Math.abs(bp.z) < 0.1 && Math.hypot(bv.x, bv.z) < 0.1)) {
      this.mode = 'kickoff';
      this.target.set(bp.x, 0, bp.z + own * 0.6);
      return;
    }
    // 自己在球的錯誤一側，而球在自家半場或正往自家球門飛：回防
    let danger = false;
    for (let i = 0; i < 180; i += 6) {
      const z = this.pred[i * 6 + 2], x = this.pred[i * 6];
      if (z * own > ARENA.B - 1 && Math.abs(x) < ARENA.GW + 1) { danger = true; break; }
    }
    const goalSide = (t.z - bp.z) * own > 0;
    const ballOurHalf = bp.z * own > 0;
    if (!goalSide && (danger || ballOurHalf)) {
      this.mode = 'retreat';
      this.urgent = true;
      // 繞到遠柱回防，不從球前面穿過
      const side = bp.x > 0 ? -1 : 1;
      this.target.set(side * ARENA.GW * 0.7, 0, own * (ARENA.B - 3));
      return;
    }
    // 找最早能趕上的攔截點
    const reach = L.jump ? 3.4 : 1.5;
    const maxV = s.boost > 15 && L.boost > 0.5 ? CAR.MAX_SPEED : CAR.DRIVE_CAP * L.cap;
    let chosen = -1;
    for (let i = 6; i < PRED_N; i += 3) {
      const o = i * 6, x = this.pred[o], y = this.pred[o + 1], z = this.pred[o + 2];
      const tt = (i + 1) * PRED_DT;
      if (L.aerial && !this.aerialSpot && y > 4 && y < 14 && tt > 0.9) {
        const hd = Math.hypot(x - t.x, z - t.z);
        if (hd < 22 && (z - t.z) * -own > -3) this.aerialSpot = { x, y, z, t: tt };
      }
      if (y > reach + BALL.R) continue;
      const d = Math.hypot(x - t.x, z - t.z);
      const ang = Math.abs(Math.atan2((x - t.x) * _left.x + (z - t.z) * _left.z, (x - t.x) * _f.x + (z - t.z) * _f.z));
      const eta = d / Math.max(6, Math.min(maxV, (speed + maxV) * 0.5)) + ang * 0.35 + 0.1;
      if (eta <= tt) { chosen = i; break; }
    }
    if (chosen < 0) chosen = PRED_N - 1;
    this.arriveT = (chosen + 1) * PRED_DT;
    const o = chosen * 6;
    const aim = this.aimPoint(this.pred[o], this.pred[o + 2], oppZ, own);
    this.target.set(aim.x, 0, aim.z);
    this.mode = 'chase';
    // 球在自家半場而且離門很近，搶第一時間
    if (bp.z * own > ARENA.B * 0.45) this.urgent = true;
  }

  // 攔截點：球後方、沿著射門線的一點；離球越近這點越貼近球，最後直接穿過球心
  aimPoint(x, z, oppZ, own) {
    const goalX = Math.max(-ARENA.GW + 1.5, Math.min(ARENA.GW - 1.5, x * 0.2)) + Math.sin(this.wobble * 0.7) * this.L.aim;
    let dx = goalX - x, dz = oppZ - z;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    const t = this.car.body.translation();
    const cd = Math.hypot(x - t.x, z - t.z);
    // 車在球的前方（比球更靠近對方球門）：先從側邊繞到球後方
    const ahead = (t.x - x) * dx + (t.z - z) * dz;
    const back = Math.min(7, cd * 0.38);
    let ax = x - dx * back, az = z - dz * back;
    if (ahead > -0.5) {
      const side = Math.sign((t.x - x) * dz - (t.z - z) * dx) || 1;
      ax = x - dx * 4 + dz * side * 3.5; az = z - dz * 4 - dx * side * 3.5;
    }
    const lim = ARENA.A - 2;
    return { x: Math.max(-lim, Math.min(lim, ax)), z: Math.max(-ARENA.B + 1, Math.min(ARENA.B - 1, az)) };
  }

  driveTo(target, inp, speed, hurry) {
    const t = this.car.body.translation(), s = this.car.state, L = this.L;
    const dx = target.x - t.x, dy = target.y - t.y, dz = target.z - t.z;
    const fz = dx * _f.x + dy * _f.y + dz * _f.z, lx = dx * _left.x + dy * _left.y + dz * _left.z;
    const ang = Math.atan2(lx, fz);
    const dist = Math.hypot(dx, dz);
    let steer = Math.max(-1, Math.min(1, -ang * 3.2));
    let throttle = this.mode === 'kickoff' ? (L.kcap ?? L.cap) : L.cap;
    // 控制到達時間：照「剩下的時間」算出想要的車速，太快就收油，免得提早衝過攔截點
    let want = CAR.MAX_SPEED;
    if (this.mode === 'chase' && !hurry) {
      this.arriveT = Math.max(0.05, (this.arriveT ?? 1) - 1 / 120);
      want = Math.max(6, dist / this.arriveT + 2);
      if (speed > want + 2) throttle = Math.abs(ang) < 0.5 ? -0.25 : 0;
      else if (speed > want) throttle = 0.2;
    }
    // 目標在正後方又很近：倒車
    if (Math.abs(ang) > 2.4 && dist < 7 && speed < 6) { throttle = -1; steer = -Math.sign(steer) || 1; }
    inp.steer = steer;
    inp.throttle = throttle;
    inp.slide = Math.abs(ang) > 1.6 && speed > 7 && s.onGround;
    // 只有離目標夠遠才加速；貼近球時全速衝過頭反而打不準
    const wantBoost = dist > (hurry ? 10 : 16) && want > speed + 3 && Math.random() < L.boost * 1.5;
    inp.boost = wantBoost && Math.abs(ang) < 0.3 && speed < CAR.MAX_SPEED - 0.3 && s.boost > 0 && _u.y > 0.5;
    inp.yaw = steer;
  }

  // 空中姿態：沒有目標就把輪子轉回朝下；有目標就讓車頭對準
  airControl(inp, aim) {
    const t = this.car.body.translation();
    const w = this.car.body.angvel();
    const pr = -(w.x * _left.x + w.y * _left.y + w.z * _left.z), yr = -(w.x * _u.x + w.y * _u.y + w.z * _u.z), rr = w.x * _f.x + w.y * _f.y + w.z * _f.z;
    if (this.car.state.flipping) return;
    if (aim) {
      // 目標方向（補償重力往上抬一點）
      const dx = aim.x - t.x, dy = aim.y - t.y + 1.5, dz = aim.z - t.z;
      const fz = dx * _f.x + dy * _f.y + dz * _f.z, lx = dx * _left.x + dy * _left.y + dz * _left.z, uy = dx * _u.x + dy * _u.y + dz * _u.z;
      inp.pitch = clamp(Math.atan2(uy, fz) * 3 - pr * 0.35);
      inp.yaw = clamp(-Math.atan2(lx, fz) * 3 - yr * 0.35);
      inp.roll = clamp(-_left.y * 2 - rr * 0.3);
      inp.boost = fz > 0 && Math.abs(Math.atan2(Math.hypot(lx, uy), fz)) < 0.5;
      return;
    }
    inp.pitch = clamp(-_f.y * 3 - pr * 0.4);
    inp.roll = clamp(-_left.y * 3 - rr * 0.3 + (_u.y < 0 ? 1 : 0));
    inp.yaw = 0;
  }
}

const clamp = (x) => Math.max(-1, Math.min(1, x));
