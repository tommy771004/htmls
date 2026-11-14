// 真實 3D 剛體與 Raycast 懸吊載具物理引擎（基於 cannon-es）
// 實作：四輪獨立懸吊、Pacejka 輪胎滑移與抓地力、動態重量轉移、防傾桿、空力下壓力與 AT/MT 變速箱

import {
  World,
  Body,
  Box,
  SAPBroadphase,
  Material,
  ContactMaterial,
  RaycastVehicle,
  Vec3,
  Quaternion
} from '../../../../vendor/cannon-es-0.20.0/cannon-es.js';
import { computeTireForces, SURFACE_TYPES } from './tires.js';

export class PhysicsWorld {
  constructor() {
    this.world = new World();
    this.world.gravity.set(0, -9.81, 0);
    this.world.broadphase = new SAPBroadphase(this.world);
    this.world.solver.iterations = 10;
    this.world.allowSleep = false;

    this.defaultMat = new Material('default');
    this.chassisMat = new Material('chassis');
    this.barrierMat = new Material('barrier');

    this.world.defaultContactMaterial = new ContactMaterial(this.defaultMat, this.defaultMat, {
      friction: 0.02,
      restitution: 0.05
    });
    this.world.addContactMaterial(
      new ContactMaterial(this.chassisMat, this.barrierMat, {
        friction: 0.08,
        restitution: 0.25
      })
    );
    this.world.addContactMaterial(
      new ContactMaterial(this.chassisMat, this.defaultMat, {
        friction: 0.05,
        restitution: 0.05
      })
    );

    this.staticBodies = [];
    this.surfaceResolver = null; // (x, z, hitBody) => surfaceId
  }

  clearTrackBodies() {
    for (const b of this.staticBodies) {
      this.world.removeBody(b);
    }
    this.staticBodies.length = 0;
  }

  addStaticBody(body, surfaceType = 'asphalt') {
    body.userData = { ...(body.userData || {}), surfaceType };
    this.world.addBody(body);
    this.staticBodies.push(body);
    return body;
  }
}

export class SimVehicle {
  constructor(physicsWorld, carSpec) {
    this.pw = physicsWorld;
    this.world = physicsWorld.world;
    this.spec = carSpec;
    this.p = carSpec.physics;

    // 建立車身剛體（重心高度降低以符合真實跑車低重心，並防止過路緣石翻車）
    const halfW = carSpec.visual.width * 0.46;
    const halfH = carSpec.visual.cabinHeight * 0.28;
    const halfL = carSpec.visual.length * 0.46;

    this.chassisBody = new Body({
      mass: this.p.mass,
      material: physicsWorld.chassisMat,
      linearDamping: 0.015,
      angularDamping: 0.38
    });
    // Shape offset 置於輪軸上方，避免重煞、直線加速抬頭或跳台斜坡時底盤 Box 直接刮地干擾懸吊
    this.chassisBody.addShape(new Box(new Vec3(halfW, halfH, halfL)), new Vec3(0, halfH + 0.12, 0));

    // 建立 cannon-es RaycastVehicle（+X 右、+Y 上、+Z 前）
    this.raycastVehicle = new RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2
    });

    const wheelRadius = carSpec.visual.wheelRadius;
    const halfTrack = this.p.trackWidth * 0.5;
    const halfWB = this.p.wheelbase * 0.5;
    const connY = 0.08;

    const baseWheelOpts = {
      radius: wheelRadius,
      directionLocal: new Vec3(0, -1, 0),
      axleLocal: new Vec3(1, 0, 0),
      suspensionStiffness: this.p.springStiffness,
      suspensionRestLength: this.p.suspensionTravel + 0.12,
      maxSuspensionTravel: this.p.suspensionTravel,
      dampingCompression: this.p.dampingCompression,
      dampingRelaxation: this.p.dampingRebound,
      maxSuspensionForce: this.p.mass * 9.81 * 3.5,
      rollInfluence: this.p.rollInfluence,
      frictionSlip: this.p.tireGrip
    };

    // 0: Front-Left, 1: Front-Right, 2: Rear-Left, 3: Rear-Right
    const wheelPositions = [
      new Vec3(halfTrack, connY, halfWB),   // 0: FL (在 +Z 為車頭的座標系中，左側為 +X、右側為 -X)
      new Vec3(-halfTrack, connY, halfWB),  // 1: FR
      new Vec3(halfTrack, connY, -halfWB),  // 2: RL
      new Vec3(-halfTrack, connY, -halfWB)  // 3: RR
    ];

    for (let i = 0; i < 4; i++) {
      this.raycastVehicle.addWheel({
        ...baseWheelOpts,
        chassisConnectionPointLocal: wheelPositions[i].clone(),
        isFrontWheel: i < 2
      });
    }

    // 覆寫 updateFriction：保留 cannon-es 的 castRay 與 updateSuspension，並以我們的 Pacejka + 重量轉移模型取代預設簡化摩擦
    this.raycastVehicle.updateFriction = (dt) => {
      this._updateCustomTireDynamics(dt);
    };

    this.raycastVehicle.addToWorld(this.world);

    // 變速箱與引擎狀態
    this.transmission = 'AT'; // 'AT' | 'MT'
    this.gear = 1;            // -1 = R, 0 = N, 1..6
    this.rpm = this.p.idleRpm;
    this.boostBar = 0;
    this.shiftCooldown = 0;
    this.limiterActive = false;
    this.limiterPhase = 0;
    this.prevThrottle = 0;
    this.backfireTimer = 0;

    // 操控輸入與濾波狀態
    this.steerAngle = 0;
    this.throttle = 0;
    this.brake = 0;
    this.handbrake = false;

    // 動態重量轉移與姿態回饋
    this.prevVelLocal = new Vec3();
    this.longG = 0;
    this.latG = 0;
    this.bodyPitch = 0; // 正值：加速車尾下沉；負值：重煞車頭下沉
    this.bodyRoll = 0;  // 過彎側傾角 (rad)
    this.speedKmh = 0;
    this.forwardSpeedMs = 0;
    this.lateralSpeedMs = 0;
    this.slipAngleDeg = 0;
    this.maxWheelSlip = 0;
    this.dominantSurface = 'asphalt';
    this.onCurb = false;
    this.airborne = false;

    // 事件佇列（供音效與視覺特效消費）
    this.events = {
      bov: 0,
      backfire: 0,
      shift: 0,
      collision: 0
    };

    // 四輪即時遙測資料
    this.wheels = [0, 1, 2, 3].map((i) => ({
      index: i,
      isFront: i < 2,
      inContact: true,
      compression: 0.25,
      normalLoad: (this.p.mass * 9.81) * 0.25,
      slipRatio: 0,
      slipAngle: 0,
      combinedSlip: 0,
      surface: 'asphalt',
      omega: 0,
      rotation: 0,
      steering: 0,
      contactPoint: new Vec3(),
      contactNormal: new Vec3(0, 1, 0)
    }));

    // 碰撞偵測
    this._onCollide = (e) => {
      if (!e || !e.contact) return;
      const impact = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (impact > 1.8) {
        this.events.collision = Math.max(this.events.collision, Math.min(1.0, impact / 18));
      }
    };
    this.chassisBody.addEventListener('collide', this._onCollide);
  }

  destroy() {
    this.chassisBody.removeEventListener('collide', this._onCollide);
    this.raycastVehicle.removeFromWorld(this.world);
  }

  reset(position, yawRad = 0) {
    this.chassisBody.position.set(position.x, position.y + 0.65, position.z);
    this.chassisBody.velocity.set(0, 0, 0);
    this.chassisBody.angularVelocity.set(0, 0, 0);
    this.chassisBody.force.set(0, 0, 0);
    this.chassisBody.torque.set(0, 0, 0);
    this.chassisBody.quaternion.setFromAxisAngle(new Vec3(0, 1, 0), yawRad);

    this.gear = 1;
    this.rpm = this.p.idleRpm;
    this.boostBar = 0;
    this.steerAngle = 0;
    this.longG = 0;
    this.latG = 0;
    this.bodyPitch = 0;
    this.bodyRoll = 0;
    this.speedKmh = 0;
    this.forwardSpeedMs = 0;
    this.lateralSpeedMs = 0;
    this.slipAngleDeg = 0;
    this.maxWheelSlip = 0;
    this.prevVelLocal.set(0, 0, 0);

    for (let i = 0; i < 4; i++) {
      this.wheels[i].omega = 0;
      this.wheels[i].rotation = 0;
      this.wheels[i].slipRatio = 0;
      this.wheels[i].slipAngle = 0;
      this.wheels[i].combinedSlip = 0;
      this.raycastVehicle.wheelInfos[i].rotation = 0;
      this.raycastVehicle.wheelInfos[i].steering = 0;
    }
  }

  setTransmission(mode) {
    if (mode === 'AT' || mode === 'MT') {
      this.transmission = mode;
      if (mode === 'AT' && this.gear === 0) this.gear = 1;
    }
  }

  toggleTransmission() {
    this.setTransmission(this.transmission === 'AT' ? 'MT' : 'AT');
    return this.transmission;
  }

  shiftUp() {
    if (this.shiftCooldown > 0) return false;
    const maxGear = this.p.gearRatios.length;
    if (this.gear < maxGear) {
      const prevGear = this.gear;
      this.gear = this.gear === -1 ? 1 : this.gear + 1;
      this.shiftCooldown = 0.14;
      this.events.shift = 1;
      if (prevGear >= 1 && this.spec.audio.hasTurbo && this.boostBar > 0.38) {
        this.events.bov = Math.max(this.events.bov, this.boostBar);
        this.boostBar *= 0.45;
      }
      return true;
    }
    return false;
  }

  shiftDown() {
    if (this.shiftCooldown > 0) return false;
    if (this.gear > -1) {
      if (this.gear === 1 && this.forwardSpeedMs > 4.5) return false; // 高速前進時不直接退入 R 檔
      this.gear = this.gear === 1 ? -1 : this.gear - 1;
      if (this.transmission === 'MT' && this.gear === 0) {
        // MT 可經 N 或直接退檔，為流暢街機體驗若在行進中退到 1 以下保持 1 檔，低速才進 R
        if (this.forwardSpeedMs > 2.5) this.gear = 1;
      }
      this.shiftCooldown = 0.14;
      this.events.shift = -1;
      // 退檔補油與排氣回火
      if (this.gear >= 1 && this.rpm > this.p.redlineRpm * 0.55) {
        this.rpm = Math.min(this.p.maxRpm * 0.96, this.rpm * 1.24);
        if (this.rpm > this.p.redlineRpm * 0.70) {
          this.events.backfire = Math.max(this.events.backfire, 0.85);
          this.backfireTimer = 0.22;
        }
      }
      return true;
    }
    return false;
  }

  /**
   * 引擎扭力曲線（依 RPM 雙段拋物線內插，模擬真實自然進氣與渦輪引擎出力特性）
   */
  _evalEngineTorque(rpm) {
    const { idleRpm, peakTorqueRpm, redlineRpm, maxRpm, engineTorqueNm } = this.p;
    const clampedRpm = Math.max(idleRpm, Math.min(maxRpm, rpm));
    let factor = 0.65;
    if (clampedRpm <= peakTorqueRpm) {
      const t = (clampedRpm - idleRpm) / Math.max(1, peakTorqueRpm - idleRpm);
      factor = 0.62 + 0.38 * Math.sin(t * Math.PI * 0.5);
    } else if (clampedRpm <= redlineRpm) {
      const t = (clampedRpm - peakTorqueRpm) / Math.max(1, redlineRpm - peakTorqueRpm);
      factor = 1.0 - 0.14 * (t * t);
    } else {
      const t = (clampedRpm - redlineRpm) / Math.max(1, maxRpm - redlineRpm);
      factor = Math.max(0.1, 0.86 * (1 - t));
    }
    // 渦輪增壓額外扭力加成
    const turboBonus = this.spec.audio.hasTurbo ? 1.0 + this.boostBar * 0.12 : 1.0;
    return engineTorqueNm * factor * turboBonus;
  }

  /**
   * 每物理步進更新輸入、引擎轉速、自動換檔與空力，接著推進 world.step
   */
  step(dt, input) {
    const rawSteer = Math.max(-1, Math.min(1, input.steer || 0));
    let rawThrottle = Math.max(0, Math.min(1, input.throttle || 0));
    let rawBrake = Math.max(0, Math.min(1, input.brake || 0));
    this.handbrake = !!input.handbrake;

    if (this.shiftCooldown > 0) this.shiftCooldown = Math.max(0, this.shiftCooldown - dt);
    if (this.backfireTimer > 0) this.backfireTimer = Math.max(0, this.backfireTimer - dt);

    // AT 模式下自動支援 S 鍵倒車與 W 鍵前進切換
    if (this.transmission === 'AT') {
      if (this.gear >= 1 && rawBrake > 0.1 && rawThrottle < 0.05 && this.forwardSpeedMs < 0.8) {
        this.gear = -1;
      } else if (this.gear === -1 && rawThrottle > 0.1 && this.forwardSpeedMs > -0.8) {
        this.gear = 1;
      }
      if (this.gear === -1) {
        // 在 R 檔時，若按 S (rawBrake) 視為倒車油門，按 W (rawThrottle) 視為煞車
        if (rawBrake > 0.05 && rawThrottle < 0.05) {
          rawThrottle = rawBrake;
          rawBrake = 0;
        } else if (rawThrottle > 0.05 && this.forwardSpeedMs < -0.5) {
          rawBrake = rawThrottle;
          rawThrottle = 0;
        }
      }
    }

    this.throttle = rawThrottle;
    this.brake = rawBrake;

    // 速度感應漸進式轉向輔助 + 甩尾反打輔助（Counter-steer Assist）
    const speedNorm = Math.min(1.0, Math.abs(this.speedKmh) / 260);
    const speedSteerScale = 1.0 - speedNorm * 0.52;
    const targetSteer = rawSteer * this.p.maxSteerRad * speedSteerScale;

    // 輕微車尾滑移自動反打輔助（讓手把與鍵盤都能做出順暢可控的甩尾）
    let counterSteer = 0;
    if (this.forwardSpeedMs > 6.0 && Math.abs(this.lateralSpeedMs) > 1.2) {
      const bodySlip = Math.atan2(-this.lateralSpeedMs, this.forwardSpeedMs);
      counterSteer = Math.max(-0.22, Math.min(0.22, bodySlip * 0.35));
    }

    const desiredSteer = Math.max(-this.p.maxSteerRad, Math.min(this.p.maxSteerRad, targetSteer + counterSteer));
    const steerRate = 7.5;
    this.steerAngle += (desiredSteer - this.steerAngle) * Math.min(1, steerRate * dt);

    // Ackermann 幾何近似：內側輪轉角略大於外側輪
    const ackermann = 0.08;
    const flSteer = this.steerAngle * (this.steerAngle > 0 ? 1 + ackermann : 1 - ackermann);
    const frSteer = this.steerAngle * (this.steerAngle < 0 ? 1 + ackermann : 1 - ackermann);
    this.raycastVehicle.setSteeringValue(flSteer, 0);
    this.raycastVehicle.setSteeringValue(frSteer, 1);

    // 推進 cannon-es 物理世界（使用單步精確推進，避免 accumulator 浮點誤差跳幀）
    this.world.step(Math.min(1 / 30, Math.max(1 / 240, dt)));
  }

  /**
   * 在 RaycastVehicle.updateFriction 階段執行：
   * 此時 castRay 與 updateSuspension 已經算完四輪 suspensionForce
   */
  _updateCustomTireDynamics(dt) {
    const chassis = this.chassisBody;
    const wheelInfos = this.raycastVehicle.wheelInfos;
    const wheelRadius = this.spec.visual.wheelRadius;

    // 1. 取得車體座標系速度與G值（計算動態重量轉移）
    const velLocal = new Vec3();
    chassis.vectorToLocalFrame(chassis.velocity, velLocal);
    // 在車體座標系中：+Z 為車頭前進方向，+X 為車身左側（因為 +Y Cross +Z = +X）
    // 注意：右側方向為 -X
    const fwdSpeed = velLocal.z;
    const rightSpeed = -velLocal.x;
    this.forwardSpeedMs = fwdSpeed;
    this.lateralSpeedMs = rightSpeed;
    this.speedKmh = fwdSpeed * 3.6;

    const accelZ = (fwdSpeed - this.prevVelLocal.z) / Math.max(0.005, dt);
    const prevRight = -this.prevVelLocal.x;
    const accelRight = (rightSpeed - prevRight) / Math.max(0.005, dt);
    this.prevVelLocal.copy(velLocal);

    // 低通濾波 G 值，避免單幀突波
    this.longG += ((accelZ / 9.81) - this.longG) * Math.min(1, dt * 10);
    this.latG += ((accelRight / 9.81) - this.latG) * Math.min(1, dt * 10);

    // 計算車身視覺與物理俯仰（Pitch）與側傾（Roll）
    const targetPitch = Math.max(-0.075, Math.min(0.075, this.longG * 0.032));
    const targetRoll = Math.max(-0.095, Math.min(0.095, this.latG * 0.038));
    this.bodyPitch += (targetPitch - this.bodyPitch) * Math.min(1, dt * 12);
    this.bodyRoll += (targetRoll - this.bodyRoll) * Math.min(1, dt * 12);

    // 整體車身側滑角
    this.slipAngleDeg = Math.abs(fwdSpeed) > 2.0 ? (Math.atan2(rightSpeed, Math.abs(fwdSpeed)) * 180) / Math.PI : 0;

    // 2. 空氣動力下壓力（Aerodynamic Downforce）與風阻（Aerodynamic Drag）
    const speedSq = fwdSpeed * fwdSpeed + rightSpeed * rightSpeed;
    const downforceN = 0.5 * 1.225 * this.p.downforceCoeff * speedSq;
    const dragN = 0.5 * 1.225 * this.p.dragCoeff * speedSq;

    if (speedSq > 0.5) {
      const worldUp = new Vec3(0, 1, 0);
      chassis.vectorToWorldFrame(worldUp, worldUp);
      const dfForce = worldUp.scale(-downforceN);
      chassis.applyForce(dfForce);

      const dragForce = chassis.velocity.clone();
      dragForce.normalize();
      dragForce.scale(-dragN, dragForce);
      chassis.applyForce(dragForce);
    }

    // 3. 防傾桿（Anti-Roll Bar）：平衡左右輪懸吊行程差，抑制過路緣石翻車
    this._applyAntiRollBar(wheelInfos[0], wheelInfos[1], dt);
    this._applyAntiRollBar(wheelInfos[2], wheelInfos[3], dt);

    // 4. 變速箱與引擎轉速耦合
    const ratios = this.p.gearRatios;
    const currentGearRatio = this.gear === -1 ? this.p.reverseRatio : this.gear >= 1 ? ratios[this.gear - 1] : 0;
    const totalRatio = currentGearRatio * this.p.finalDrive;

    // 由驅動輪平均轉速反推引擎轉速
    const wheelLinearSpeed = Math.abs(fwdSpeed);
    const wheelRpm = (wheelLinearSpeed / (2 * Math.PI * wheelRadius)) * 60;
    const coupledRpm = Math.abs(totalRatio) > 0.01 ? wheelRpm * Math.abs(totalRatio) : this.p.idleRpm;

    let targetRpm = Math.max(this.p.idleRpm, coupledRpm);
    if (this.gear === 0 || Math.abs(fwdSpeed) < 2.2) {
      // 空檔或起步半離合狀態下，油門可拉高轉速
      targetRpm = Math.max(targetRpm, this.p.idleRpm + this.throttle * (this.p.redlineRpm - this.p.idleRpm) * 0.78);
    } else if (this.handbrake && this.throttle > 0.2) {
      targetRpm = Math.max(targetRpm, this.p.idleRpm + this.throttle * (this.p.redlineRpm - this.p.idleRpm) * 0.88);
    }

    this.rpm += (targetRpm - this.rpm) * Math.min(1, dt * 18);

    // 自動變速箱（AT）換檔邏輯
    if (this.transmission === 'AT' && this.shiftCooldown <= 0 && this.gear >= 1) {
      const upshiftRpm = this.p.redlineRpm * 0.92;
      const downshiftRpm = this.p.redlineRpm * 0.44;
      if (this.rpm >= upshiftRpm && this.gear < ratios.length && !this.airborne) {
        this.shiftUp();
      } else if (this.rpm <= downshiftRpm && this.gear > 1 && fwdSpeed > 3.0) {
        this.shiftDown();
      }
    }

    // 紅線斷油保護（Rev Limiter）
    if (this.rpm >= this.p.redlineRpm) {
      this.limiterPhase += dt * 18;
      this.limiterActive = Math.sin(this.limiterPhase * Math.PI * 2) > 0;
      this.rpm = Math.min(this.p.maxRpm, this.p.redlineRpm + (this.limiterActive ? -140 : 90));
    } else {
      this.limiterActive = false;
    }

    // 渦輪增壓值（Boost）、洩壓閥（BOV）與排氣回火（Backfire）
    if (this.spec.audio.hasTurbo) {
      const rpmFactor = Math.max(0, (this.rpm - 2200) / Math.max(1000, this.p.redlineRpm - 2200));
      const targetBoost = this.throttle * Math.min(1.0, rpmFactor * 1.25) * this.spec.audio.maxBoostBar;
      const boostRate = targetBoost > this.boostBar ? 4.2 : 7.5;
      this.boostBar += (targetBoost - this.boostBar) * Math.min(1, dt * boostRate);

      // 高增壓突然收油門觸發 BOV 洩壓閥音效
      if (this.prevThrottle > 0.65 && this.throttle < 0.15 && this.boostBar > 0.42) {
        this.events.bov = Math.max(this.events.bov, this.boostBar);
      }
    } else {
      this.boostBar = 0;
    }

    // 高轉速收油門觸發排氣管回火（Pop & Bang）
    if (this.prevThrottle > 0.6 && this.throttle < 0.12 && this.rpm > this.p.redlineRpm * 0.72) {
      this.events.backfire = Math.max(this.events.backfire, 0.9);
      this.backfireTimer = 0.25;
    }
    this.prevThrottle = this.throttle;

    // 5. 計算引擎輸出至驅動輪之總驅動力與引擎煞車
    const activeThrottle = this.limiterActive ? 0.0 : this.throttle;
    const engineTorque = this._evalEngineTorque(this.rpm) * activeThrottle;
    const drivelineEfficiency = 1.15;
    let totalDriveForce = (engineTorque * totalRatio * drivelineEfficiency) / wheelRadius;

    // 鬆油門時的引擎煞車牽引力（Engine Braking）
    if (activeThrottle < 0.05 && Math.abs(fwdSpeed) > 1.5 && this.gear !== 0) {
      const engineBrake = -Math.sign(fwdSpeed) * (this.rpm / this.p.redlineRpm) * Math.abs(totalRatio) * 85;
      totalDriveForce += engineBrake;
    }

    // 依驅動方式分配前後軸扭力（FWD / RWD / AWD）
    let frontDriveShare = 0;
    let rearDriveShare = 0;
    if (this.spec.drivetrain === 'FWD') {
      frontDriveShare = 1.0;
    } else if (this.spec.drivetrain === 'RWD') {
      rearDriveShare = 1.0;
    } else {
      // AWD: 40% 前 / 60% 後偏後驅運動化四驅設定
      frontDriveShare = 0.40;
      rearDriveShare = 0.60;
    }

    // 6. 動態重量轉移計算（Weight Transfer）
    const totalWeight = this.p.mass * 9.81 + downforceN;
    const longTransfer = (this.p.mass * accelZ * this.p.cgHeight) / this.p.wheelbase;
    const latTransfer = (this.p.mass * accelRight * this.p.cgHeight) / this.p.trackWidth;

    let numGrounded = 0;
    let maxSlip = 0;
    let curbContact = false;
    let primarySurface = 'asphalt';

    // 7. 逐輪計算 Pacejka 縱向與側向力並施加至車體剛體
    for (let i = 0; i < 4; i++) {
      const wInfo = wheelInfos[i];
      const wState = this.wheels[i];
      const isFront = i < 2;
      const isLeft = i % 2 === 0;

      wState.inContact = wInfo.isInContact;
      wState.steering = wInfo.steering;

      // 懸吊壓縮比 0..1
      const restLen = wInfo.suspensionRestLength;
      const curLen = wInfo.suspensionLength;
      wState.compression = Math.max(0, Math.min(1, (restLen - curLen) / Math.max(0.05, wInfo.maxSuspensionTravel)));

      if (!wInfo.isInContact) {
        wState.normalLoad = 0;
        wState.slipRatio = 0;
        wState.slipAngle = 0;
        wState.combinedSlip = 0;
        wInfo.rotation += wState.omega * dt;
        wState.rotation = wInfo.rotation;
        continue;
      }

      numGrounded++;
      const hitPoint = wInfo.raycastResult.hitPointWorld;
      const hitNormal = wInfo.raycastResult.hitNormalWorld;
      wState.contactPoint.copy(hitPoint);
      wState.contactNormal.copy(hitNormal);

      // 判定該輪所在路面材質
      let surfaceId = wInfo.raycastResult.body?.userData?.surfaceType || 'asphalt';
      if (this.pw.surfaceResolver) {
        surfaceId = this.pw.surfaceResolver(hitPoint.x, hitPoint.z, wInfo.raycastResult.body, surfaceId);
      }
      wState.surface = surfaceId;
      if (surfaceId === 'curb') curbContact = true;
      if (surfaceId !== 'asphalt') primarySurface = surfaceId;

      // 路緣石高頻微震動回饋
      const surfSpec = SURFACE_TYPES[surfaceId] || SURFACE_TYPES.asphalt;
      if (surfSpec.bumpAmp > 0 && Math.abs(fwdSpeed) > 3.0) {
        const rumblePhase = (hitPoint.x * 3.7 + hitPoint.z * 3.7) * 2.5;
        const bumpImpulse = Math.sin(rumblePhase) * surfSpec.bumpAmp * this.p.mass * Math.min(1, Math.abs(fwdSpeed) / 25);
        const relPos = hitPoint.vsub(chassis.position);
        chassis.applyImpulse(new Vec3(0, bumpImpulse, 0), relPos);
      }

      // 綜合懸吊力與動態重量轉移計算該輪垂直載荷
      const staticShare = isFront ? this.p.frontWeightBias * 0.5 : (1 - this.p.frontWeightBias) * 0.5;
      const longShift = isFront ? -longTransfer * 0.5 : longTransfer * 0.5;
      // 右轉時 accelRight < 0，左側輪（外輪）載荷增加
      const latShift = isLeft ? -latTransfer * 0.5 : latTransfer * 0.5;
      const dynamicLoad = Math.max(150, totalWeight * staticShare + longShift + latShift);
      const normalLoad = Math.max(150, wInfo.suspensionForce * 0.65 + dynamicLoad * 0.35);
      wState.normalLoad = normalLoad;

      // 計算輪胎座標系下的縱向與側向速度
      const wheelTrans = this.raycastVehicle.getWheelTransformWorld(i);
      const wheelRight = new Vec3(-1, 0, 0); // 右側單位向量
      wheelTrans.vectorToWorldFrame(wheelRight, wheelRight);
      // 投影至地面法線平面
      const proj = wheelRight.dot(hitNormal);
      wheelRight.vsub(hitNormal.scale(proj), wheelRight);
      wheelRight.normalize();

      const wheelFwd = new Vec3();
      hitNormal.cross(wheelRight, wheelFwd);
      wheelFwd.normalize();

      const contactVel = new Vec3();
      chassis.getVelocityAtWorldPoint(hitPoint, contactVel);
      const vLong = contactVel.dot(wheelFwd);
      const vLat = contactVel.dot(wheelRight);

      // 驅動力與煞車力分配（前煞車佔 64%、後煞車佔 36%）
      const wheelDrive = (isFront ? frontDriveShare : rearDriveShare) * 0.5 * totalDriveForce;
      const wheelBrake = this.brake * this.p.brakeForce * (isFront ? 0.32 : 0.18);

      // 更新輪胎角速度 omega
      const freeRollingOmega = vLong / wheelRadius;
      if (!isFront && this.handbrake) {
        wState.omega = 0;
      } else if (Math.abs(wheelDrive) > 50 && activeThrottle > 0.1) {
        const slipBoost = (wheelDrive / Math.max(800, normalLoad)) * 4.5;
        wState.omega = freeRollingOmega + slipBoost;
      } else {
        wState.omega = freeRollingOmega;
      }

      // 計算 Pacejka 輪胎力
      const tireRes = computeTireForces({
        normalLoad,
        vLong,
        vLat,
        wheelOmega: wState.omega,
        wheelRadius,
        driveForce: wheelDrive,
        brakeForce: wheelBrake,
        isHandbrake: this.handbrake,
        baseTireGrip: this.p.tireGrip,
        lateralStiffness: this.p.lateralStiffness,
        surfaceId,
        offroadFactor: this.p.offroadFactor,
        isRear: !isFront,
        oversteerFactor: this.p.oversteerFactor,
        throttle: activeThrottle
      });

      wState.slipRatio = tireRes.slipRatio;
      wState.slipAngle = tireRes.slipAngle;
      wState.combinedSlip = tireRes.combinedSlip;
      if (tireRes.combinedSlip > maxSlip) maxSlip = tireRes.combinedSlip;

      // 將輪胎縱向力與側向力轉為剛體衝量（使用 rollInfluence 控制側傾力臂，杜絕翻車）
      const relPos = hitPoint.vsub(chassis.position);
      chassis.vectorToLocalFrame(relPos, relPos);
      relPos.y *= wInfo.rollInfluence * 0.35;
      chassis.vectorToWorldFrame(relPos, relPos);

      const impulse = new Vec3();
      wheelFwd.scale(tireRes.fx * dt, impulse);
      const latImpulse = wheelRight.scale(tireRes.fy * dt);
      impulse.vadd(latImpulse, impulse);

      chassis.applyImpulse(impulse, relPos);

      // 更新輪胎滾動角度（注意我們的車輪局部 +X 向左，因此前進時繞 +X 旋轉為正）
      wInfo.deltaRotation = (wState.omega * dt);
      wInfo.rotation += wInfo.deltaRotation;
      wState.rotation = wInfo.rotation;
    }

    this.airborne = numGrounded === 0;
    this.maxWheelSlip = maxSlip;
    this.onCurb = curbContact;
    this.dominantSurface = curbContact ? 'curb' : primarySurface;

    // 空中姿態微幅穩定阻尼，確保飛躍跳台落地平穩帥氣
    if (this.airborne) {
      chassis.angularVelocity.x *= 0.985;
      chassis.angularVelocity.z *= 0.985;
    }
  }

  _applyAntiRollBar(wheelL, wheelR, dt) {
    if (!wheelL.isInContact && !wheelR.isInContact) return;
    const travelL = wheelL.isInContact ? wheelL.suspensionRestLength - wheelL.suspensionLength : 0;
    const travelR = wheelR.isInContact ? wheelR.suspensionRestLength - wheelR.suspensionLength : 0;
    const diff = travelL - travelR;
    const antiRollForce = diff * this.p.antiRollStiffness;
    if (Math.abs(antiRollForce) < 1) return;

    const upWorld = new Vec3(0, 1, 0);
    this.chassisBody.vectorToWorldFrame(upWorld, upWorld);
    const impL = upWorld.scale(-antiRollForce * dt);
    const impR = upWorld.scale(antiRollForce * dt);

    const relL = wheelL.chassisConnectionPointWorld.vsub(this.chassisBody.position);
    const relR = wheelR.chassisConnectionPointWorld.vsub(this.chassisBody.position);
    this.chassisBody.applyImpulse(impL, relL);
    this.chassisBody.applyImpulse(impR, relR);
  }
}
