// 自動駕駛（測試用 / 平衡評估代理）：取樣式路線規劃。
// 每隔幾個物理步，列舉一組「目標航向 × 保持時間」候選，用簡化的轉向模型（與 player 相同的轉向率 / 慣性 / 抓地延遲）
// 往前推演 planHorizon 秒，依「撞障礙 / 出柵欄 / 漏旗門 / 歪上跳台」計成本，取最低者執行。
// 只用 terrain 的公開查詢（upcomingGates / rampsNear / queryObstacles / centerX / halfWidth），不偷看地形內部的理想路線。
import { config as globalConfig } from './config.js';
import { clamp, lerp, angleDiff, mulberry32 } from './shared.js';

const LOCAL_DEFAULTS = globalConfig.bot; // 預設值唯一來源是 config.js（這裡不再重複寫數值）

export class Bot {
  constructor(terrain, config) {
    this.terrain = terrain;
    this.cfg = config || globalConfig;
    this.out = { steer: 0, crouch: false, jump: false };
    this._wps = [];
    this.reset();
  }

  reset() {
    // 每次重設都重讀 config：評估平衡時在執行中改 __game.config.bot（例如 aimNoise）要在下一局 / 下一次 simulate 生效
    this.C = { ...LOCAL_DEFAULTS, ...(this.cfg.bot || {}) };
    this.P = this.cfg.player || {};
    this.radius = this.P.radius || 0.45;
    this._rng = mulberry32(12345);
    this._goal = null;
    this._tick = 0;
    this._minClear = 0;
    this._jumpCooldown = 3;
    this._crouching = false;
    this._nextWpT = Infinity;
    this._noise = 0;
    this.debug = { tx: 0, tz: 0, mode: 'idle', cost: 0 };
  }

  _turnRate(v) {
    const P = this.P;
    return lerp(P.turnRateLow || 2.1, P.turnRateHigh || 1.05, clamp(v / (P.turnSpeedRef || 32), 0, 1));
  }

  _courseYaw(z) {
    const T = this.terrain;
    return Math.atan2(T.centerX(z - 3) - T.centerX(z + 3), 6);
  }

  update(dt, player) {
    const C = this.C, out = this.out;
    out.steer = 0;
    out.crouch = false;
    out.jump = false;
    if (!player || player.state === 'ready' || player.state === 'crashed') {
      this._goal = null;
      this.debug.mode = player ? player.state : 'idle';
      return out;
    }
    if (this._jumpCooldown > 0) this._jumpCooldown -= dt;
    if (!player.grounded) {
      // 空中：不轉向（player 會自動讓 heading 對齊速度），快落地前蹲低吸收衝擊
      out.crouch = player.airTime > 0.2;
      this._goal = null;
      this.debug.mode = 'air';
      return out;
    }
    const px = player.position.x, pz = player.position.z;
    const v = player.velocity;
    const speed = Math.max(Math.hypot(v.x, v.z), 4);
    const heading = player.heading;
    const rate = this._turnRate(speed);

    // 在跳台上：對正跳台軸線直到唇口
    const r = this._onRamp(px, pz);
    if (r) {
      const l = (px - r.x) * r.cy + (pz - r.z0) * r.sy;
      const goal = r.yaw - clamp(0.12 * l, -0.12, 0.12);
      out.steer = clamp((C.headingGain * angleDiff(goal, heading)) / rate, -1, 1);
      out.crouch = true;
      this._goal = null;
      this.debug.mode = 'ramp';
      return out;
    }

    const every = Math.max(C.planEvery, Math.round(C.reactionTime / Math.max(dt, 1e-4)));
    if (C.aimNoise > 0) {
      const a = Math.exp(-dt / 0.6);
      this._noise = this._noise * a + C.aimNoise * Math.sqrt(1 - a * a) * 1.7 * (this._rng() + this._rng() - 1);
    }
    if (this._goal === null || ++this._tick >= every) {
      this._tick = 0;
      this._plan(px, pz, heading, player.omega || 0, Math.atan2(v.x, -v.z), speed, rate);
    }
    const steer = clamp((C.headingGain * angleDiff(this._goal + this._noise, heading)) / rate, -1, 1);
    out.steer = steer;

    const busy = this._minClear < 2.5;
    const lim = C.crouchBelowSpeed + (this._crouching ? 1.5 : -1.5);
    this._crouching = !busy && Math.abs(steer) < 0.35 && speed < lim && player.skid < 0.4;
    out.crouch = this._crouching;

    // 偶爾原地跳（測試滯空）：前方 2.2 s 內沒有旗門 / 跳台、路線淨空
    if (this._jumpCooldown <= 0 && this._nextWpT > 2.2 && this._minClear > 3 && Math.abs(steer) < 0.25 && speed > 8 &&
        this._rng() < C.jumpChancePerSec * dt) {
      out.jump = true;
      this._jumpCooldown = 4;
    }
    return out;
  }

  _rampAxis(r) {
    if (r.cy === undefined) return { cy: 1, sy: 0, yaw: 0 };
    return r;
  }

  _onRamp(px, pz) {
    const ramps = this.terrain.rampsNear ? this.terrain.rampsNear(pz, 15) : null;
    for (let i = 0; ramps && i < ramps.length; i++) {
      const r = ramps[i];
      const a = this._rampAxis(r);
      const dx = px - r.x, dz = pz - r.z0;
      const s = dx * a.sy - dz * a.cy;
      const l = dx * a.cy + dz * a.sy;
      if (s > -0.5 && s < r.len && Math.abs(l) < r.halfWidth + 0.8) {
        return { x: r.x, z0: r.z0, cy: a.cy, sy: a.sy, yaw: a.yaw || 0 };
      }
    }
    return null;
  }

  // 前方航點（旗門、跳台起點），依 z 由近到遠
  _collectWaypoints(pz, range) {
    const T = this.terrain;
    const wps = this._wps;
    wps.length = 0;
    const gates = T.upcomingGates ? T.upcomingGates(pz - 0.3, range) : null;
    for (let i = 0; gates && i < gates.length; i++) {
      const g = gates[i];
      if (g.z >= pz - 0.3) continue;
      wps.push({ kind: 'gate', z: g.z, x: 0.5 * (g.xLeft + g.xRight), half: 0.5 * (g.xRight - g.xLeft) - this.C.gateEdgeMargin });
    }
    const ramps = T.rampsNear ? T.rampsNear(pz - range * 0.5, range * 0.5) : null;
    for (let i = 0; ramps && i < ramps.length; i++) {
      const r = ramps[i];
      if (r.z0 >= pz - 0.5) continue;
      const a = this._rampAxis(r);
      wps.push({
        kind: 'ramp', z: r.z0, x: r.x, half: r.halfWidth - 0.7, wall: r.halfWidth + 1.8,
        yaw: a.yaw || 0, sy: a.sy, cy: a.cy, lipZ: r.z1,
      });
    }
    wps.sort((a, b) => b.z - a.z);
    return wps;
  }

  // 航點的瞄準點：跳台瞄軸線上起點前 6 m（先對正）
  _aim(wp, x, z, out) {
    if (wp.kind === 'ramp' && z - wp.z > 9) {
      out.x = wp.x - 6 * wp.sy;
      out.z = wp.z + 6 * wp.cy;
    } else {
      out.x = wp.x;
      out.z = wp.z;
    }
    return out;
  }

  _plan(px, pz, heading, omega, velYaw, speed, rate) {
    const C = this.C, T = this.terrain;
    const H = C.planHorizon;
    const reach = speed * H + 12;
    const wps = this._collectWaypoints(pz, Math.max(reach + 60, 120));
    const cyaw = this._courseYaw(pz);
    const fx = Math.sin(cyaw), fz = -Math.cos(cyaw);
    const obs = T.queryObstacles(px + fx * reach * 0.5, pz + fz * reach * 0.5, reach * 0.5 + 8);
    const margin = C.obstacleMargin + speed * C.marginPerSpeed;

    const w0 = wps.length ? wps[0] : null;
    const aim = { x: 0, z: 0 };
    if (w0) this._aim(w0, px, pz, aim);
    else { aim.z = pz - Math.max(20, speed * 1.5); aim.x = T.centerX(aim.z); }
    const bearing = Math.atan2(aim.x - px, -(aim.z - pz));
    this._nextWpT = w0 ? (pz - w0.z) / speed : Infinity;

    const ctx = { px, pz, h: heading, w: omega, vy: velYaw, v: speed, rate, wps, obs, PR: this.radius, margin, H };
    let best = Infinity, bestGoal = bearing, bestClear = 0;
    const offs = C.headingOffsets;
    const prev = this._goal;
    for (let hi = 0; hi < C.holdTimes.length; hi++) {
      const hold = C.holdTimes[hi];
      for (let k = 0; k < offs.length * 2 - 1; k++) {
        const o = k < offs.length ? offs[k] : -offs[k - offs.length + 1];
        const goal = cyaw + clamp(angleDiff(bearing + o, cyaw), -C.maxHeadingOffCourse, C.maxHeadingOffCourse);
        const res = this._rollout(ctx, goal, hold);
        let cost = res.cost;
        if (prev !== null) cost += 4 * Math.abs(angleDiff(goal, prev));
        if (cost < best) { best = cost; bestGoal = goal; bestClear = res.minClear; }
      }
    }
    this._goal = bestGoal;
    this._minClear = bestClear;
    this.debug.cost = best;
    this.debug.tx = px + Math.sin(bestGoal) * 20;
    this.debug.tz = pz - Math.cos(bestGoal) * 20;
    this.debug.mode = best > 2000 ? 'avoid' : best > C.gateMissCost * 0.8 ? 'miss' : w0 && w0.kind === 'ramp' ? 'toRamp' : 'plan';
  }

  _rollout(ctx, goal0, hold) {
    const C = this.C, T = this.terrain, P = this.P;
    const dt = C.planDt;
    const n = Math.ceil(ctx.H / dt);
    const kW = 1 - Math.exp(-(P.turnResponse || 6.5) * dt);
    const kV = 1 - Math.exp(-C.gripModel * dt);
    const wps = ctx.wps, obs = ctx.obs, v = ctx.v, rate = ctx.rate;
    const aim = { x: 0, z: 0 };
    let x = ctx.px, z = ctx.pz, h = ctx.h, w = ctx.w, vy = ctx.vy;
    let wi = 0;
    let cost = 0;
    let minClear = 99;
    let lockYaw = null;   // 上了跳台：航向鎖定到飛行結束
    let lockUntil = 0;
    for (let k = 1; k <= n; k++) {
      const t = k * dt;
      if (lockYaw !== null && z < lockUntil) lockYaw = null;
      if (lockYaw !== null) {
        h = lockYaw;
        vy = lockYaw;
        w = 0;
      } else {
        let goal = goal0;
        if (t > hold) {
          // 保持時間過後朝下一個航點（沒有就沿賽道中心往前）
          if (wi < wps.length) this._aim(wps[wi], x, z, aim);
          else { aim.z = z - 25; aim.x = T.centerX(aim.z); }
          const cy = this._courseYaw(z);
          goal = cy + clamp(angleDiff(Math.atan2(aim.x - x, -(aim.z - z)), cy), -C.maxHeadingOffCourse, C.maxHeadingOffCourse);
        }
        const wGoal = clamp(C.headingGain * angleDiff(goal, h), -rate, rate);
        w += (wGoal - w) * kW;
        h += w * dt;
        vy += angleDiff(h, vy) * kV;
      }
      const nx = x + v * Math.sin(vy) * dt;
      const nz = z - v * Math.cos(vy) * dt;
      const sx = nx - x, sz = nz - z;
      // 障礙（線段最近距離）；跳台 / 空中段略過（飛越）
      if (lockYaw === null) {
        const sl2 = sx * sx + sz * sz || 1e-9;
        let dead = false;
        for (let i = 0; i < obs.length; i++) {
          const o = obs[i];
          const ox = o.x - x, oz = o.z - z;
          const u = clamp((ox * sx + oz * sz) / sl2, 0, 1);
          const ex = ox - u * sx, ez = oz - u * sz;
          const c = Math.sqrt(ex * ex + ez * ez) - o.r - ctx.PR;
          if (c < minClear) minClear = c;
          if (c < 0.15) { cost += 5000 * (1.2 - 0.4 * t / ctx.H); dead = true; break; }
          if (c < ctx.margin) { const q = 1 - c / ctx.margin; cost += 30 * q * q; }
        }
        if (dead) break;
      }
      // 柵欄
      const ex2 = Math.abs(nx - T.centerX(nz)) - (T.halfWidth(nz) - C.fenceMargin);
      if (ex2 > 0) cost += 40 * ex2;
      // 航點穿越
      while (wi < wps.length && nz <= wps[wi].z) {
        const wp = wps[wi];
        const f = (z - wp.z) / Math.max(z - nz, 1e-6);
        const e = Math.abs(x + sx * f - wp.x);
        if (wp.kind === 'gate') {
          if (e > wp.half) cost += C.gateMissCost + 30 * (e - wp.half);
          else cost += 10 * (e / Math.max(wp.half, 0.5)) ** 2;
        } else if (e <= wp.half) {
          cost += 200 * Math.max(0, Math.abs(angleDiff(vy, wp.yaw)) - 0.06);
          lockYaw = wp.yaw;
          lockUntil = wp.lipZ - v * 1.6 * wp.cy;
        } else if (e < wp.wall) {
          cost += 3000; // 撞跳台側邊 / 歪一半上去
        } else {
          cost += C.rampSkipCost;
        }
        wi++;
      }
      x = nx;
      z = nz;
    }
    // 終端：朝下一個航點的方位誤差 + 剩下距離內轉不過去的側移
    if (cost < 5000) {
      if (wi < wps.length) this._aim(wps[wi], x, z, aim);
      else { aim.z = z - 30; aim.x = T.centerX(aim.z); }
      const br = Math.atan2(aim.x - x, -(aim.z - z));
      const has = wi < wps.length;
      cost += 12 * Math.abs(angleDiff(vy, br)) * (has ? 1 : 0.4);
      if (has) {
        const dz = Math.max(z - aim.z, 1);
        const need = Math.abs(aim.x - x) - (dz * dz) / (2 * (v / rate) * 1.2);
        if (need > 0) cost += 20 * need;
      }
    }
    return { cost, minClear };
  }
}
