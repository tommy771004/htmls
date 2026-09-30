// 滑雪者：物理（切平面重力、慣性轉向、側滑/刻滑、空中、落地判定、摔倒、碰撞）+ 動作動畫。
import * as THREE from 'three';
import { config as globalConfig } from './config.js';
import { clamp, lerp, smoothstep, damp, angleDiff } from './shared.js';

const LOCAL_DEFAULTS = globalConfig.player; // 預設值唯一來源是 config.js（這裡不再重複寫數值）

const G_UP = new THREE.Vector3(0, 1, 0);
const _n = new THREE.Vector3();
const _n2 = new THREE.Vector3();
const _f = new THREE.Vector3();
const _r = new THREE.Vector3();
const _t = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fw = new THREE.Vector3();
const _rt = new THREE.Vector3();
const _bk = new THREE.Vector3();
const _m4 = new THREE.Matrix4();

const RIG_KEYS = ['body', 'hips', 'torso', 'head', 'armL', 'armR', 'poleL', 'poleR', 'thighL', 'shinL', 'thighR', 'shinR', 'skiL', 'skiR'];
const LEG = 0.45;

export class Player {
  constructor(scene, assets, terrain, config) {
    this.cfg = config || globalConfig;
    this.P = { ...LOCAL_DEFAULTS, ...(this.cfg.player || {}) };
    this.terrain = terrain;

    const sk = assets && typeof assets.createSkier === 'function' ? assets.createSkier() : fallbackSkier();
    this.mesh = new THREE.Group();
    this.mesh.name = 'player';
    this.mesh.add(sk.root);
    this.rig = sk.rig || {};
    for (const k of RIG_KEYS) if (!this.rig[k]) this.rig[k] = new THREE.Group();
    this.rig.body.rotation.order = 'YXZ';
    const r = this.rig;
    this._base = {
      hipsY: r.hips.position.y || 0.95,
      hipsZ: r.hips.position.z,
      skiLX: r.skiL.position.x || -0.13,
      skiRX: r.skiR.position.x || 0.13,
      bodyY: r.body.position.y,
    };
    if (scene) scene.add(this.mesh);

    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.groundNormal = new THREE.Vector3(0, 1, 0);
    this._upS = new THREE.Vector3(0, 1, 0);
    this._cooldowns = new Map();
    this.reset(0, 0);
  }

  get speed() {
    return this.velocity.length();
  }

  reset(x = 0, z = 0) {
    this.P = { ...LOCAL_DEFAULTS, ...(this.cfg.player || {}) }; // 重讀 config：執行中調的物理參數在下一局生效
    const t = this.terrain;
    this.position.set(x, t.heightAt(x, z), z);
    this.velocity.set(0, 0, 0);
    this.heading = 0;
    this.omega = 0;
    this.grounded = true;
    this.state = 'ready';
    this.crouch = 0;
    this.boost = 1;
    this.airTime = 0;
    this.skid = 0;
    this.invulnerable = 0;
    this.wobble = 0;
    this.time = 0;
    this._skidF = 0;
    this._coyote = 0;
    this._jumpBuf = 0;
    this._crashT = 0;
    this._crashSide = 1;
    this._fenceT = 0;
    this._hitT = 0;
    this._wobbleT = 0;
    this._landComp = 0;
    this._polePhase = 0;
    this._lean = 0;
    this._crouchVis = 0;
    this._tuck = 0;
    this._armsOut = 0;
    this._cooldowns.clear();
    t.normalAt(x, z, this.groundNormal);
    this._upS.copy(this.groundNormal);
    this.mesh.visible = true;
    this._pose(0, 0);
  }

  // 由 main 在 LET'S RIDE 時呼叫：'ready' → 'riding'
  start() {
    if (this.state === 'ready') {
      this.state = 'riding';
      this.grounded = true;
    }
  }

  // 過旗門等外部回充
  addBoost(amount) {
    this.boost = clamp(this.boost + amount, 0, 1);
  }

  update(dt, input) {
    const ev = [];
    const P = this.P;
    let steer = 0, crouchIn = false, wantJump = false;
    if (input) {
      steer = clamp(+input.steer || 0, -1, 1);
      crouchIn = !!input.crouch;
      wantJump = typeof input.consumeJump === 'function' ? input.consumeJump() : !!input.jump;
    }
    this.time += dt;
    this.crouch = damp(this.crouch, crouchIn && this.state !== 'crashed' ? 1 : 0, P.crouchResponse, dt);

    if (this.state === 'ready') {
      const p = this.position;
      p.y = this.terrain.heightAt(p.x, p.z);
      this.terrain.normalAt(p.x, p.z, this.groundNormal);
      this._animate(dt, 0);
      return ev;
    }

    if (this.invulnerable > 0) this.invulnerable = Math.max(0, this.invulnerable - dt);
    if (this._fenceT > 0) this._fenceT -= dt;
    if (this._hitT > 0) this._hitT -= dt;
    if (this._wobbleT > 0) this._wobbleT -= dt;
    // 跳躍緩衝：落地前一瞬間按 Space 不會被吃掉，著地第一步就起跳
    if (this._jumpBuf > 0) this._jumpBuf -= dt;
    if (this.state === 'crashed') this._jumpBuf = 0;

    if (this.state === 'crashed') this._stepCrashed(dt, ev);
    else if (this.grounded) this._stepGround(dt, steer, crouchIn, wantJump, ev);
    else this._stepAir(dt, steer, wantJump, ev);

    if (this.state !== 'ready') {
      this._obstacles(ev);
      this._fence(dt, ev);
    }
    this._animate(dt, steer);
    return ev;
  }

  // ---------------------------------------------------------------- 著地
  _stepGround(dt, steer, crouchIn, wantJump, ev) {
    const P = this.P, T = this.terrain;
    const pos = this.position, v = this.velocity;
    const n = T.normalAt(pos.x, pos.z, _n);
    this.groundNormal.copy(n);

    // 轉向慣性
    const vnPre = v.dot(n);
    const tSpeed = Math.sqrt(Math.max(0, v.lengthSq() - vnPre * vnPre));
    let rate = lerp(P.turnRateLow, P.turnRateHigh, clamp(tSpeed / P.turnSpeedRef, 0, 1));
    rate *= lerp(1, P.crouchTurnScale, this.crouch);
    if (this._wobbleT > 0) rate *= 0.6;
    this.omega = damp(this.omega, steer * rate, P.turnResponse, dt);
    this.heading = angleDiff(this.heading + this.omega * dt, 0);

    // 板子前進 / 右方（切平面）
    const sh = Math.sin(this.heading), ch = Math.cos(this.heading);
    _f.set(sh, 0, -ch);
    _f.addScaledVector(n, -_f.dot(n)).normalize();
    _r.crossVectors(_f, n); // = 右

    // 重力（完整；法向分量由貼地處理吃掉）
    v.y -= P.gravity * dt;

    // 蹲低推力 + boost
    const spPre = Math.sqrt(Math.max(0, v.lengthSq() - v.dot(n) ** 2));
    let thrust = P.crouchThrust * this.crouch * clamp(1 - spPre / P.crouchThrustFade, 0, 1);
    // 站姿低速撐杖（配合 idlePole 動畫）：起步不會慢吞吞，速度一上來就沒效果
    thrust += P.poleThrust * (1 - this.crouch) * clamp(1 - spPre / P.poleThrustFade, 0, 1);
    if (crouchIn && this.boost > 0) {
      thrust += P.boostThrust * this.crouch;
      this.boost = Math.max(0, this.boost - P.boostDrain * dt);
    } else if (!crouchIn) {
      // 只在放開蹲低時被動回充（原本「空槽仍按著」會每一步回充→下一步又用掉，等於永久半推力）
      this.boost = Math.min(1, this.boost + P.boostRegen * dt);
    }
    v.addScaledVector(_f, thrust * dt);

    // 分解
    const vn = v.dot(n);
    let vf = v.dot(_f);
    let vl = v.dot(_r);
    const sp = Math.sqrt(vf * vf + vl * vl);

    // 側滑程度
    const absVl = Math.abs(vl);
    const latTerm = smoothstep(0.5, 1.5, absVl / P.skidLateralRef);
    const turnTerm = smoothstep(P.skidTurnLoadLow, P.skidTurnLoadHigh, Math.abs(this.omega) * sp);
    this._skidF = damp(this._skidF, Math.max(latTerm, turnTerm), P.skidResponse, dt);
    const grip = lerp(P.grip, P.gripSkidFloor, this._skidF);

    // 抓地：側向速度指數衰減；被吃掉的部分依刻滑效率轉成前進
    if (absVl > 1e-6) {
      const vlNew = vl * Math.exp(-grip * dt);
      const slip2 = (vl * vl) / (sp * sp + 1e-9);
      // 撞擊後短暫恢復期：側向速度幾乎全數轉回前進（撞了會慢，但不會被卡死在樹前）
      // 刻滑效率：小側滑角（板刃咬住雪、像軌道）幾乎不損失；側滑角越大越像煞車
      const slipA = Math.asin(Math.min(1, Math.sqrt(slip2)));
      const ceBase = lerp(P.carveEfficiencyLow, P.carveEfficiency, smoothstep(P.carveSlipLow, P.carveSlipHigh, slipA));
      const ce = this._hitT > 0 ? 0.95 : Math.max(0, ceBase * (1 - P.brakeWhenPerpendicular * slip2) * (1 - 0.5 * this._skidF));
      const ideal = Math.sqrt(vf * vf + vl * vl - vlNew * vlNew);
      const gain = ideal - Math.abs(vf);
      const sgn = vf < 0 ? -1 : 1;
      vf = sgn * (Math.abs(vf) + ce * gain);
      vl = vlNew;
    }

    // 摩擦 + 空氣阻力（只減速不反向）
    let s2 = Math.sqrt(vf * vf + vl * vl);
    if (s2 > 1e-6) {
      const k = lerp(P.dragStand, P.dragCrouch, this.crouch);
      const dec = (P.snowFriction * P.gravity * Math.max(0, n.y) + k * s2 * s2) * dt;
      let ns = Math.max(0, s2 - dec);
      if (ns > P.maxSpeed) ns = P.maxSpeed;
      const sc = ns / s2;
      vf *= sc; vl *= sc; s2 = ns;
    }
    v.set(0, 0, 0).addScaledVector(_f, vf).addScaledVector(_r, vl).addScaledVector(n, vn);

    const vis = clamp(Math.max(this._skidF, absVl / (P.skidLateralRef * 1.5)), 0, 1) * smoothstep(1, 5, s2);
    this.skid = damp(this.skid, vis, 10, dt);

    // 移動
    const px = pos.x, pz = pos.z;
    pos.addScaledVector(v, dt);
    const h = T.heightAt(pos.x, pos.z);
    const gap = pos.y - h;
    if (gap < -P.stepUpMax) {
      // 撞到跳台側壁之類的高牆：退回並吸收水平速度
      pos.x = px; pos.z = pz;
      pos.y = T.heightAt(px, pz);
      v.x *= -0.3;
      v.multiplyScalar(0.7);
    } else if (gap <= 0) {
      pos.y = h;
      const n2 = T.normalAt(pos.x, pos.z, _n2);
      const d = v.dot(n2);
      if (d < 0) v.addScaledVector(n2, -d);
    } else if (gap > P.airborneEpsilon) {
      this._takeoff(ev);
      if (wantJump) this._jumpBuf = P.jumpBuffer || 0; // 起飛那一步按的 → 下一步用 coyote 起跳
      return;
    } else {
      // 腿部吸收：輕微下壓貼地
      v.addScaledVector(n, -P.stickAccel * dt);
    }

    if (wantJump || this._jumpBuf > 0) this._jump(ev);
  }

  _takeoff(ev) {
    this._capLaunch(this.P.launchNormalMax);
    this.state = 'air';
    this.grounded = false;
    this.airTime = 0;
    this._coyote = this.P.coyoteTime;
    ev.push({ type: 'takeoff' });
  }

  // 騰空瞬間相對「前方落地坡」的法向速度上限（高速過跳台 / 唇口起跳不會飛到必摔）
  _capLaunch(cap) {
    const P = this.P, v = this.velocity;
    const hs = Math.hypot(v.x, v.z);
    if (hs <= 1) return;
    const k = P.launchProbe / hs;
    const nb = this.terrain.normalAt(this.position.x + v.x * k, this.position.z + v.z * k, _n2);
    const vn = v.dot(nb);
    if (vn > cap) v.addScaledVector(nb, cap - vn);
  }

  _jump(ev) {
    this.velocity.addScaledVector(this.groundNormal, this.P.jumpSpeed);
    this._capLaunch(this.P.launchNormalMax + this.P.lipJumpBonus);
    this.state = 'air';
    this.grounded = false;
    this.airTime = 0;
    this._coyote = 0;
    this._jumpBuf = 0;
    ev.push({ type: 'jump' });
  }

  // ---------------------------------------------------------------- 空中
  _stepAir(dt, steer, wantJump, ev) {
    const P = this.P, T = this.terrain;
    const pos = this.position, v = this.velocity;

    if ((wantJump || this._jumpBuf > 0) && this._coyote > 0) {
      this._coyote = 0;
      this._jumpBuf = 0;
      this.velocity.addScaledVector(this.groundNormal, P.jumpSpeed);
      this._capLaunch(P.launchNormalMax + P.lipJumpBonus);
      ev.push({ type: 'jump' });
    } else if (wantJump) {
      this._jumpBuf = P.jumpBuffer || 0;
    }
    this._coyote -= dt;

    v.y -= P.gravity * dt;
    const s = v.length();
    if (s > 1e-6) v.multiplyScalar(Math.max(0, 1 - P.airDrag * s * dt));

    this.omega = damp(this.omega, steer * P.airSpinRate, P.airSpinResponse, dt);
    let hdg = this.heading + this.omega * dt;
    const hs = Math.hypot(v.x, v.z);
    if (Math.abs(steer) < 0.05 && hs > 2) {
      const vy = Math.atan2(v.x, -v.z);
      hdg += angleDiff(vy, hdg) * (1 - Math.exp(-P.airAlignRate * dt));
    }
    this.heading = angleDiff(hdg, 0);

    this.airTime += dt;
    this.boost = Math.min(1, this.boost + P.boostAirPerSec * dt);
    this.skid = damp(this.skid, 0, 8, dt);
    this._skidF = damp(this._skidF, 0, 8, dt);

    pos.addScaledVector(v, dt);
    const h = T.heightAt(pos.x, pos.z);
    if (pos.y <= h) this._land(h, ev);
  }

  _land(h, ev) {
    const P = this.P, T = this.terrain;
    const pos = this.position, v = this.velocity;
    pos.y = h;
    const n = T.normalAt(pos.x, pos.z, _n);
    this.groundNormal.copy(n);
    // 落在跳台斜面上：撞擊以「原本雪坡」的法線計（跳台面迎著來車，用它的法線算會把正常的平地跳
    // 誤判成重摔 —— 實測在引導門起跳、落在跳台上坡面，撞擊 15.6 > 15 摔倒）；速度仍投影到跳台面
    let nImp = n;
    if (T._rampAdd && T._rampAdd(pos.x, pos.z) > 0.05) {
      const e = 0.3;
      nImp = _n2.set(
        -(T.groundHeight(pos.x + e, pos.z) - T.groundHeight(pos.x - e, pos.z)) / (2 * e), 1,
        -(T.groundHeight(pos.x, pos.z + e) - T.groundHeight(pos.x, pos.z - e)) / (2 * e)).normalize();
    }
    const impact = Math.max(0, -v.dot(nImp));
    const hs = Math.hypot(v.x, v.z);
    const velYaw = Math.atan2(v.x, -v.z);
    const misalign = hs < 2 ? 0 : Math.abs(angleDiff(this.heading, velYaw));
    const bonus = P.crouchImpactBonus * this.crouch;
    const micro = this.airTime < P.microAirTime;
    const angScale = micro ? 1.6 : 1;

    // 去除撞入地面的法向速度
    const d = v.dot(n);
    if (d < 0) v.addScaledVector(n, -d);

    this.grounded = true;
    this.state = 'riding';
    this._landComp = clamp(impact / P.landCrashImpact, 0.15, 1);

    const crashImpact = impact > P.landCrashImpact + bonus;
    const crashAngle = misalign > P.landCrashAngle * angScale;
    if (crashImpact || crashAngle) {
      this._startCrash('landing', ev, crashAngle ? 'misalign' : 'impact', { impact, misalign });
      return;
    }
    const wob = impact > P.landWobbleImpact + bonus || (!micro && misalign > P.landWobbleAngle);
    if (wob) {
      v.multiplyScalar(P.wobbleSpeedKeep);
      if (hs >= 2) this.heading = angleDiff(velYaw + angleDiff(this.heading, velYaw) * 0.4, 0);
      this._wobbleT = P.wobbleDuration;
      this.omega *= 0.3;
    }
    ev.push({ type: 'land', airTime: this.airTime, quality: wob ? 'wobble' : 'clean', impact, misalign });
  }

  // ---------------------------------------------------------------- 摔倒
  _startCrash(reason, ev, cause, extra) {
    this.state = 'crashed';
    this._crashT = 0;
    this._crashSide = this.omega > 0.05 ? 1 : this.omega < -0.05 ? -1 : (Math.random() < 0.5 ? -1 : 1);
    this.velocity.multiplyScalar(this.P.crashSpeedKeep);
    this.omega = 0;
    this._wobbleT = 0;
    this.skid = 1;
    const e = { type: 'crash', reason };
    if (cause) e.cause = cause;
    if (extra) Object.assign(e, extra);
    ev.push(e);
  }

  _stepCrashed(dt, ev) {
    const P = this.P, T = this.terrain;
    const pos = this.position, v = this.velocity;
    this._crashT += dt;
    this.skid = damp(this.skid, 0, 2, dt);
    v.y -= P.gravity * dt;
    if (this.grounded) {
      const n = T.normalAt(pos.x, pos.z, _n);
      const vn = v.dot(n);
      _t.copy(v).addScaledVector(n, -vn);
      const s = _t.length();
      if (s > 1e-6) {
        const ns = Math.max(0, s - P.crashFriction * P.gravity * Math.max(0, n.y) * dt);
        _t.multiplyScalar(ns / s);
      }
      v.copy(_t).addScaledVector(n, vn);
    }
    pos.addScaledVector(v, dt);
    const h = T.heightAt(pos.x, pos.z);
    if (pos.y <= h) {
      pos.y = h;
      const n2 = T.normalAt(pos.x, pos.z, _n2);
      const d = v.dot(n2);
      if (d < 0) v.addScaledVector(n2, -d);
      this.grounded = true;
    } else if (pos.y > h + 0.3) {
      this.grounded = false;
    }
    if (this._crashT >= P.crashDuration) this._respawn(ev);
  }

  _respawn(ev) {
    const P = this.P, T = this.terrain;
    const z = this.position.z;
    const x = T.centerX(z);
    this.position.set(x, T.heightAt(x, z), z);
    const dx = T.centerX(z - 2) - x;
    this.heading = Math.atan2(dx, 2);
    const n = T.normalAt(x, z, _n);
    this.groundNormal.copy(n);
    _f.set(Math.sin(this.heading), 0, -Math.cos(this.heading));
    _f.addScaledVector(n, -_f.dot(n)).normalize();
    this.velocity.copy(_f).multiplyScalar(P.respawnSpeed);
    this.state = 'riding';
    this.grounded = true;
    this.omega = 0;
    this.skid = 0;
    this._skidF = 0;
    this._wobbleT = 0;
    this._landComp = 0;
    this.invulnerable = P.respawnInvulnerable;
    this._cooldowns.clear();
    this._upS.copy(n);
    ev.push({ type: 'recovered' });
  }

  // ---------------------------------------------------------------- 碰撞
  _obstacles(ev) {
    if (this.invulnerable > 0) return;
    const P = this.P, T = this.terrain;
    const pos = this.position, v = this.velocity;
    const list = T.queryObstacles(pos.x, pos.z, P.radius + 2);
    if (!list || list.length === 0) return;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (pos.y > o.top) continue;
      let dx = pos.x - o.x, dz = pos.z - o.z;
      const minD = o.r + P.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 >= minD * minD) continue;
      let d = Math.sqrt(d2);
      if (d < 1e-4) {
        const hs = Math.hypot(v.x, v.z);
        if (hs > 1e-4) { dx = -v.x / hs; dz = -v.z / hs; } else { dx = 1; dz = 0; }
        d = 1;
      }
      const nx = dx / d, nz = dz / d;
      pos.x = o.x + nx * minD;
      pos.z = o.z + nz * minD;
      const vDotN = v.x * nx + v.z * nz;
      if (vDotN >= 0) continue;

      const until = this._cooldowns.get(o.id);
      if (this.state === 'crashed' || (until !== undefined && until > this.time)) {
        v.x -= vDotN * nx; v.z -= vDotN * nz;
        continue;
      }
      const pre = v.length();
      const hs = Math.hypot(v.x, v.z);
      const headOn = -vDotN / Math.max(hs, 1e-4);
      this._setCooldown(o.id);
      if (pre > P.obstacleCrashSpeed && headOn > Math.cos(P.obstacleHeadOnAngle)) {
        v.x -= 1.3 * vDotN * nx; v.z -= 1.3 * vDotN * nz;
        this._startCrash('obstacle', ev, null, { obstacle: o });
        return;
      }
      // 擦撞 / 側彈：水平速度改沿障礙切線方向，保留 keep 比例 + 少量反彈
      const keep = lerp(P.hitGlancingKeep, P.hitSpeedKeep, smoothstep(0.15, 0.6, headOn));
      let tx = v.x - vDotN * nx, tz = v.z - vDotN * nz;
      let tl = Math.hypot(tx, tz);
      if (tl < 0.2 * hs) {
        // 幾乎正面：往 heading 較接近的那一側偏
        const fx = Math.sin(this.heading), fz = -Math.cos(this.heading);
        const s1 = -nz * fx + nx * fz;
        tx = s1 >= 0 ? -nz : nz; tz = s1 >= 0 ? nx : -nx; tl = 1;
      }
      const tang = hs * keep, back = -vDotN * P.hitRestitution * keep;
      const nhx = (tx / tl) * tang + nx * back, nhz = (tz / tl) * tang + nz * back;
      const ratio = Math.hypot(nhx, nhz) / Math.max(hs, 1e-4);
      v.x = nhx; v.z = nhz; v.y *= ratio;
      // 空中擦撞：速度被轉成切線方向，但空中 heading 只以 airAlignRate 慢慢對齊 →
      // 0.3 s 後落地側滑角 70～107° 必摔（擦撞只該扣速度）。身體跟著被撞偏：heading 直接轉大部分過去
      if (!this.grounded && Math.hypot(nhx, nhz) > 1) {
        const vy = Math.atan2(nhx, -nhz);
        this.heading = angleDiff(this.heading + angleDiff(vy, this.heading) * P.airHitAlign, 0);
      }
      this._hitT = 0.4;
      this._skidF = 0;
      this.omega *= 0.3;
      ev.push({ type: 'hit', obstacle: o });
    }
  }

  _setCooldown(id) {
    const m = this._cooldowns;
    if (m.size > 24) {
      for (const [k, t] of m) if (t <= this.time) m.delete(k);
    }
    m.set(id, this.time + this.P.hitCooldown);
  }

  _fence(dt, ev) {
    const P = this.P, T = this.terrain;
    const pos = this.position, v = this.velocity;
    const cx = T.centerX(pos.z);
    const lim = T.halfWidth(pos.z) - P.fenceMargin;
    const u = pos.x - cx;
    if (Math.abs(u) <= lim) return;
    const s = u > 0 ? 1 : -1;
    pos.x = cx + s * lim;
    if (this.grounded) {
      const h = T.heightAt(pos.x, pos.z);
      if (pos.y < h) pos.y = h;
    }
    const dcx = T.centerX(pos.z - 1) - cx;
    const inv = 1 / Math.sqrt(1 + dcx * dcx);
    const mx = inv, mz = dcx * inv;
    const vm = v.x * mx + v.z * mz;
    if (vm * s > 0) {
      const k = 1 + P.fenceBounce;
      v.x -= k * vm * mx;
      v.z -= k * vm * mz;
    }
    v.multiplyScalar(Math.pow(P.fenceSpeedKeepPerSec, dt));
    // 板頭朝柵欄 → 慢慢轉成與柵欄平行（不然會一直磨柵欄）
    if (this.grounded && this.state === 'riding') {
      const courseYaw = Math.atan2(dcx, 1);
      const into = (Math.sin(this.heading) * mx - Math.cos(this.heading) * mz) * s;
      if (into > 0) {
        const e = angleDiff(courseYaw, this.heading);
        const step = P.fenceSteerAway * dt;
        this.heading = angleDiff(this.heading + clamp(e, -step, step), 0);
        if (this.omega * s > 0) this.omega *= 0.5;
      }
    }
    if (this._fenceT <= 0 && this.state !== 'crashed') {
      this._fenceT = 0.5;
      ev.push({ type: 'fence' });
    }
  }

  // ---------------------------------------------------------------- 動畫
  _animate(dt, steer) {
    const P = this.P, v = this.velocity;
    const speed = v.length();
    const air = !this.grounded && this.state === 'air';
    const crashed = this.state === 'crashed';

    // 姿態：地面法線（著地）或依速度微俯仰（空中）
    const sh = Math.sin(this.heading), ch = Math.cos(this.heading);
    if (air) {
      const hs = Math.hypot(v.x, v.z);
      const a = clamp(Math.atan2(v.y, Math.max(hs, 1)) * 0.35, -0.5, 0.4);
      _up.set(-sh * 0, Math.cos(a), 0).addScaledVector(_bk.set(-sh, 0, ch), Math.sin(a));
    } else {
      _up.copy(this.groundNormal);
    }
    this._upS.lerp(_up, 1 - Math.exp(-(air ? 5 : 12) * dt)).normalize();
    _fw.set(sh, 0, -ch);
    _fw.addScaledVector(this._upS, -_fw.dot(this._upS)).normalize();
    _rt.crossVectors(_fw, this._upS);
    _bk.copy(_fw).negate();
    _m4.makeBasis(_rt, this._upS, _bk);
    this.mesh.quaternion.setFromRotationMatrix(_m4);
    this.mesh.position.copy(this.position);

    this.mesh.visible = this.invulnerable > 0 ? Math.floor(this.invulnerable * 12) % 2 === 0 : true;

    // 平滑量
    const riding = this.state === 'riding' && this.grounded;
    const leanT = riding ? clamp(Math.atan2(this.omega * speed, P.gravity), -P.leanMax, P.leanMax) : air ? clamp(this.omega * 0.08, -0.2, 0.2) : 0;
    this._lean = damp(this._lean, leanT, 8, dt);
    this._tuck = damp(this._tuck, air ? 1 : 0, air ? 7 : 10, dt);
    this._armsOut = damp(this._armsOut, air ? 1 : 0, 6, dt);
    this._landComp = damp(this._landComp, 0, 5, dt);
    this._crouchVis = damp(this._crouchVis, this.crouch, 12, dt);
    const wob = this._wobbleT > 0 ? Math.min(1, this._wobbleT / Math.max(1e-3, P.wobbleDuration)) : 0;
    this.wobble = wob;
    const idlePole = (this.state === 'ready' || (riding && speed < P.poleThrustFade * 0.85 && this.crouch < 0.3)) ? 1 : 0;
    if (idlePole) this._polePhase += dt * (this.state === 'ready' ? 1.6 : 3.2);
    this._pose(dt, wob, idlePole, crashed, speed);
    this._groundClamp(dt, crashed);
  }

  // 摔倒翻滾時，身體以雪板底面為樞紐側躺 → 部分身體 / 雪板會埋進雪面（verifier 量到最深 0.86 m）。
  // 用各 mesh 的凸包近似點（26 個方向的極值頂點）量到地面切平面的最低距離，不夠就沿法線把 body 抬起來。
  _groundClamp(dt, crashed) {
    const r = this.rig;
    let need = 0;
    if (crashed) {
      if (!this._probes) this._probes = buildProbes(this.mesh);
      this.mesh.updateMatrixWorld(true);
      const n = this.groundNormal, p = this.position;
      let minD = Infinity;
      for (const pr of this._probes) {
        const mw = pr.obj.matrixWorld;
        for (const v of pr.pts) {
          _t.copy(v).applyMatrix4(mw);
          const d = (_t.x - p.x) * n.x + (_t.y - p.y) * n.y + (_t.z - p.z) * n.z;
          if (d < minD) minD = d;
        }
      }
      need = Math.max(0, 0.02 - minD);
    }
    // 往上立刻、往下平滑（避免一幀跳動）
    this._clampLift = need > (this._clampLift || 0) ? need : damp(this._clampLift || 0, need, 20, dt);
    if (this._clampLift > 1e-4) r.body.position.y += this._clampLift;
  }

  _pose(dt, wob = 0, idlePole = 0, crashed = false, speed = 0) {
    const r = this.rig, P = this.P, b = this._base;
    const t = this.time || 0;

    // 腿：以髖部下降量解出大腿/小腿角度（小腿前傾 0.7×大腿角）
    const hit = this._hitT > 0 ? this._hitT / 0.4 : 0;
    const bend = clamp(Math.max(this._crouchVis, this._tuck * 0.75) + this._landComp * 0.55 + hit * 0.3 + wob * 0.2, 0, 1.2);
    let drop = P.crouchHipDrop * bend;
    if (this._tuck > 0.01) drop += 0.08 * this._tuck;
    const th = solveThigh(clamp((0.9 - drop) / LEG, 0.6, 2));
    const phi = th * 0.7;
    const hipBack = LEG * (Math.sin(th) - Math.sin(phi));
    r.hips.position.y = b.hipsY - drop;
    r.hips.position.z = b.hipsZ + hipBack;
    // 空中收腿時膝蓋再往前一點
    const tuckExtra = this._tuck * 0.25;
    r.thighL.rotation.x = r.thighR.rotation.x = th + tuckExtra;
    r.shinL.rotation.x = r.shinR.rotation.x = -(th + phi) - tuckExtra * 0.6;
    r.torso.rotation.x = -(0.12 + 0.6 * bend * 0.85 + hipBack * 0.6);

    // 身體傾斜 + 不穩搖晃
    let roll = -this._lean + wob * Math.sin(t * 13) * 0.28;
    let pitch = 0, yaw = 0, bodyY = 0;
    let splay = 0;
    if (crashed) {
      const ct = this._crashT, D = P.crashDuration;
      const fall = smoothstep(0, 0.35, ct);
      const up = smoothstep(D - 0.45, D, ct);
      const k = fall * (1 - up);
      roll = this._crashSide * 1.45 * k;
      pitch = -0.35 * k + Math.sin(ct * 9) * 0.12 * (1 - smoothstep(0, 0.8, ct)) * (1 - up);
      yaw = this._crashSide * 1.6 * (1 - Math.exp(-3 * ct)) * (1 - up);
      bodyY = 0.35 * Math.sin(Math.min(ct / 0.45, 1) * Math.PI) * (1 - up);
      splay = k;
    }
    r.body.rotation.set(pitch, yaw, roll);
    r.body.position.y = b.bodyY + bodyY;

    // 頭：看向轉彎內側
    r.head.rotation.y = clamp(-this.omega * 0.18, -0.4, 0.4);
    r.head.rotation.x = 0.1 * bend;

    // 手臂
    const out = this._armsOut;
    let armX = lerp(0.05, 0.3, this._crouchVis) * (1 - out) + 0.1 * out;
    let armZL = -(0.08 + 0.75 * out);
    let armZR = 0.08 + 0.75 * out;
    let armXL = armX, armXR = armX;
    if (idlePole) {
      const s = Math.sin(this._polePhase);
      armXL = armXR = 0.1 + 0.4 * s;
    }
    if (wob > 0) {
      armXL = Math.sin(t * 16) * 1.4 * wob + armX * (1 - wob);
      armXR = Math.sin(t * 16 + Math.PI) * 1.4 * wob + armX * (1 - wob);
      armZL -= 0.6 * wob;
      armZR += 0.6 * wob;
    }
    if (crashed) {
      armZL -= 1.0 * splay; armZR += 1.0 * splay;
      armXL += 0.8 * splay; armXR -= 0.5 * splay;
    }
    r.armL.rotation.set(armXL, 0, armZL);
    r.armR.rotation.set(armXR, 0, armZR);
    // 雪杖尖維持朝後下方
    r.poleL.rotation.x = -armXL * 0.6;
    r.poleR.rotation.x = -armXR * 0.6;

    // 雪板
    const spread = 0.015 + 0.03 * this._tuck + 0.04 * wob;
    r.skiL.position.x = b.skiLX - spread;
    r.skiR.position.x = b.skiRX + spread;
    const wobSki = wob * Math.sin(t * 11) * 0.12;
    r.skiL.rotation.y = 0.55 * splay + wobSki;
    r.skiR.rotation.y = -0.35 * splay - wobSki;
    r.thighL.rotation.z = -0.3 * splay;
    r.thighR.rotation.z = 0.3 * splay;
  }
}

// 摔倒貼地用的探測點：每個 mesh（雪杖除外，細長且允許插進雪裡）取 26 個方向的極值頂點（凸包近似）
function buildProbes(root) {
  const dirs = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) if (x || y || z) dirs.push(new THREE.Vector3(x, y, z).normalize());
  const out = [];
  root.traverse((o) => {
    if (!o.isMesh || /pole/i.test(o.name) || !o.geometry || !o.geometry.attributes.position) return;
    const a = o.geometry.attributes.position;
    const idx = new Set();
    for (const d of dirs) {
      let best = -Infinity, bi = 0;
      for (let i = 0; i < a.count; i++) {
        const dd = a.getX(i) * d.x + a.getY(i) * d.y + a.getZ(i) * d.z;
        if (dd > best) { best = dd; bi = i; }
      }
      idx.add(bi);
    }
    out.push({ obj: o, pts: [...idx].map((i) => new THREE.Vector3(a.getX(i), a.getY(i), a.getZ(i))) });
  });
  return out;
}

// cos θ + cos(0.7θ) = c 之解（c ∈ [0.6, 2]）
function solveThigh(c) {
  if (c >= 2) return 0;
  let lo = 0, hi = 1.5;
  for (let i = 0; i < 14; i++) {
    const m = (lo + hi) * 0.5;
    if (Math.cos(m) + Math.cos(0.7 * m) > c) lo = m; else hi = m;
  }
  return (lo + hi) * 0.5;
}

function fallbackSkier() {
  const root = new THREE.Group();
  const rig = {};
  for (const k of RIG_KEYS) rig[k] = new THREE.Group();
  rig.hips.position.y = 0.95;
  rig.skiL.position.x = -0.13;
  rig.skiR.position.x = 0.13;
  root.add(rig.body);
  rig.body.add(rig.hips, rig.skiL, rig.skiR);
  rig.hips.add(rig.torso, rig.thighL, rig.thighR);
  rig.torso.add(rig.head, rig.armL, rig.armR);
  rig.armL.add(rig.poleL);
  rig.armR.add(rig.poleR);
  rig.thighL.add(rig.shinL);
  rig.thighR.add(rig.shinR);
  return { root, rig };
}
