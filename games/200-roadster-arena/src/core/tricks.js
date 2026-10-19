// 特技判定：空中依車身座標累積俯仰／偏航／滾轉，轉滿就跳出招式名稱；落地輪子朝下才入帳，翻車就作廢。
// 甩尾依側滑角×速度累積分數。不碰 DOM。
import { Vector3 } from 'three';
import { carAxes } from './car.js';

const _q = { x: 0, y: 0, z: 0, w: 1 };
const _fwd = new Vector3(), _up = new Vector3(), _left = new Vector3(), _w = new Vector3();
const TAU = Math.PI * 2;

export const TRICK_PTS = { FLIP: 1000, ROLL: 900, KICKFLIP: 1200, SPIN360: 700, SPIN180: 300 };

export class Tricks {
  constructor() { this.reset(); this.total = 0; }
  reset() {
    this.air = false; this.pitch = 0; this.yaw = 0; this.roll = 0;
    this.nP = 0; this.nY = 0; this.nR = 0;
    this.list = []; this.pending = 0; this.mult = 1;
    this.airT = 0; this.launch = null; this.drift = 0; this.driftT = 0;
    this.speedArmed = true;
  }

  // 每個 tick 呼叫；out 推入要顯示的事件
  update(car, dt, out, launchedFromCurl = false) {
    const s = car.state, b = car.body;
    carAxes(b, undefined, _fwd, _up, _left);
    const av = b.angvel(); _w.set(av.x, av.y, av.z);
    const p = b.translation();
    // 輪子短暫離地（過迴圈、壓過接縫）不算騰空：離地超過 0.15 秒才開始算招式，但旋轉從離地那一刻累積
    if (s.contacts === 0 && !s.autoflip) {
      if (!this.air && !this.pre) {
        this.pre = true; this.preT = 0; this.pitch = this.yaw = this.roll = 0; this.nP = this.nY = this.nR = 0;
        this.list = []; this.pending = 0; this.mult = 1; this.airT = 0;
        this.launch = { x: p.x, y: p.y, z: p.z, curl: launchedFromCurl, jumpAge: s.sinceJump };
        this.maxY = p.y;
      }
      this.airT += dt;
      if (p.y > this.maxY) this.maxY = p.y;
      this.pitch += _w.dot(_left) * dt;
      this.yaw += _w.dot(_up) * dt;
      this.roll += _w.dot(_fwd) * dt;
      if (!this.air) { if (this.airT < 0.15) return; this.air = true; }
      const P = Math.floor(Math.abs(this.pitch) / (TAU * 0.92));
      if (P > this.nP) {
        this.nP = P;
        this.add(this.pitch > 0 ? 'FRONTFLIP' : 'BACKFLIP', TRICK_PTS.FLIP, out);
      }
      const Rn = Math.floor(Math.abs(this.roll) / (TAU * 0.9));
      if (Rn > this.nR) {
        this.nR = Rn;
        const kick = this.launch.jumpAge < 0.3 && this.airT < 1.8;
        this.add(kick ? 'KICKFLIP' : 'BARREL ROLL', kick ? TRICK_PTS.KICKFLIP : TRICK_PTS.ROLL, out);
      }
      const Y = Math.floor(Math.abs(this.yaw) / (Math.PI * 0.94));
      if (Y > this.nY) {
        this.nY = Y;
        const deg = Y * 180;
        this.add(String(deg), deg >= 360 ? TRICK_PTS.SPIN360 * (deg / 360) : TRICK_PTS.SPIN180, out);
      }
    } else if (s.contacts >= 2 && !this.air) {
      this.pre = false;
    } else if (this.air && s.contacts >= 2) {
      this.air = false; this.pre = false;
      const upright = _up.dot(s.groundN) > 0.5;
      const airT = this.airT;
      const dist = Math.hypot(p.x - this.launch.x, p.z - this.launch.z);
      if (upright) {
        let bonus = 0;
        const lines = [];
        if (this.launch.curl && this.maxY - this.launch.y > 30) {
          const h = Math.round(this.maxY);
          bonus += h * 110;
          lines.push({ name: `CURL LAUNCH ${h}M`, pts: h * 110 });
        } else if (airT > 2.6) {
          const pts = Math.round(airT * 420 + dist * 6);
          bonus += pts;
          lines.push({ name: 'HUGE AIR', pts });
        } else if (airT > 1.2) {
          const pts = Math.round(airT * 150);
          bonus += pts;
          lines.push({ name: 'AIR', pts });
        }
        const total = Math.round((this.pending + bonus) * Math.max(1, this.list.length));
        if (total > 0) {
          this.total += total;
          out.push({ type: 'landed', total, mult: Math.max(1, this.list.length), air: airT, dist, tricks: this.list.slice(), lines });
        }
        out.push({ type: 'landOk', air: airT, dist, tricks: this.list.slice() });
      } else if (airT > 0.6) {
        out.push({ type: 'bail', lost: this.pending });
      }
      this.list = []; this.pending = 0; this.mult = 1;
    }
    // 甩尾分數
    if (s.drifting && s.speed > 12 && Math.abs(s.slip) > 0.2) {
      this.drift += Math.abs(s.slip) * s.speed * dt * 9;
      this.driftT += dt;
    } else if (!s.drifting && this.drift > 0) {
      if (this.drift > 120 && this.driftT > 0.6) {
        const pts = Math.round(this.drift / 50) * 50;
        this.total += pts;
        out.push({ type: 'drift', pts, t: this.driftT });
      }
      this.drift = 0; this.driftT = 0;
    }
    // 88 MPH
    const mph = s.speed * 2.2369;
    if (mph >= 88 && this.speedArmed) { this.speedArmed = false; out.push({ type: 'speed88' }); }
    if (mph < 70) this.speedArmed = true;
  }

  add(name, pts, out) {
    this.list.push(name);
    this.pending += pts;
    out.push({ type: 'trick', name, pts, mult: this.list.length });
  }
}
