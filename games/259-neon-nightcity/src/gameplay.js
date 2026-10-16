// Third-person Cyberpunk driving & on-foot character exploration controller
// Supports:
// - Driving physics (acceleration, braking/reverse, speed-sensitive steering, handbrake drift, nitro boost)
// - Wheel spin & front wheel steering visual animation + chassis pitch/roll suspension
// - Headlight spotlights + dynamic underglow point light + customizable livery colors
// - Seamless Exit/Enter vehicle (F key) & Summon vehicle (V key)
// - Third-person on-foot movement (Walk, Sprint, Dance groove/hype toggle, Venue E interactions)
// - Collision resolution against city buildings & venue walls with open doorway passages
// - Smooth camera follow that automatically ducks inside enterable buildings (PULSE Club, AFTERGLOW Bar, CHROME WORKS Garage)

import * as THREE from 'three';
import { CITY_HALF } from './city.js';

export const CAR_LIVERIES = [
  { name: '電馭青 // CYAN', hex: 0x00f0ff, accent: '#00f0ff' },
  { name: '霓虹桃 // MAGENTA', hex: 0xff1e8a, accent: '#ff1e8a' },
  { name: '高壓黃 // CYBER YELLOW', hex: 0xffe600, accent: '#ffe600' },
  { name: '生化綠 // BIO ACID', hex: 0x00ff9d, accent: '#00ff9d' },
  { name: '幻影紫 // PHANTOM VIOLET', hex: 0x9b4dff, accent: '#9b4dff' },
];

export class GameplayController {
  constructor(scene, camera, assets, city, soundscape, onToast) {
    this.scene = scene;
    this.camera = camera;
    this.assets = assets;
    this.city = city;
    this.soundscape = soundscape;
    this.onToast = onToast || (() => {});

    // Input state
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      brake: false,
      sprint: false,
    };

    // Mode: 'driving' | 'walking'
    this.mode = 'driving';
    this.liveryIndex = 0;

    // --- Spawn Player Vehicle ---
    this.carGroup = new THREE.Group();
    this.carGroup.name = 'PlayerVehicle';
    this.carMesh = assets.cloneModel('vehicles', 'player_car');
    this.carGroup.add(this.carMesh);

    // Find wheel children for steering & rolling
    this.wheels = {
      FL: this.carMesh.getObjectByName('wheel_FL'),
      FR: this.carMesh.getObjectByName('wheel_FR'),
      RL: this.carMesh.getObjectByName('wheel_RL'),
      RR: this.carMesh.getObjectByName('wheel_RR'),
    };
    this.wheelSpin = 0;

    // Underglow & headlight point lights
    this.underglowLight = new THREE.PointLight(0x00f0ff, 5.5, 11, 1.6);
    this.underglowLight.position.set(0, 0.28, 0);
    this.carGroup.add(this.underglowLight);

    this.headlightGlow = new THREE.PointLight(0xd8f8ff, 6.5, 22, 1.5);
    this.headlightGlow.position.set(0, 0.75, 2.6);
    this.carGroup.add(this.headlightGlow);

    // Initial car transform on Neon Central Avenue (z = -30), facing East (+X -> yaw = Math.PI/2)
    this.carPos = new THREE.Vector3(-8, 0, -26.5);
    this.carYaw = Math.PI / 2;
    this.carSpeed = 0; // m/s
    this.carSteer = 0;
    this.carVelX = 0;
    this.carVelZ = 0;
    this.boostEnergy = 1.0;
    this.drifting = false;
    this.boosting = false;

    this.carGroup.position.copy(this.carPos);
    this.carGroup.rotation.y = this.carYaw;
    scene.add(this.carGroup);

    // --- Spawn Player Character (for walking mode) ---
    this.playerChar = assets.spawnCharacter({
      paletteIndex: 0,
      clip: 'idle',
      timeScale: 1.0,
    });
    this.playerPos = new THREE.Vector3(-8, 0, -24.0);
    this.playerYaw = 0;
    this.playerSpeed = 0;
    this.dancing = false;
    this.danceStyle = 'dance_groove';
    this.playerChar.root.visible = false;
    scene.add(this.playerChar.root);

    // Camera state
    this.camPos = new THREE.Vector3(-16, 4.2, -26.5);
    this.camLook = new THREE.Vector3(-4, 1.2, -26.5);
    this.camOrbitYawOffset = 0;
    this.camOrbitPitchOffset = 0;

    // Active status
    this.currentDistrict = city.getDistrictAt(this.carPos.x, this.carPos.z);
    this.insideVenue = null;
    this.nearVenue = null;
    this.canEnterCar = false;
    this.interactionPrompt = '';
    this.drinksOrdered = 0;
  }

  get activePos() {
    return this.mode === 'driving' ? this.carPos : this.playerPos;
  }

  get activeYaw() {
    return this.mode === 'driving' ? this.carYaw : this.playerYaw;
  }

  get speedKmh() {
    return this.mode === 'driving' ? this.carSpeed * 3.6 : this.playerSpeed * 3.6;
  }

  toggleVehicleMode() {
    if (this.mode === 'driving') {
      // Exit vehicle to left side (or right side if blocked)
      const sideX = Math.cos(this.carYaw) * 2.35;
      const sideZ = -Math.sin(this.carYaw) * 2.35;
      let exitX = this.carPos.x + sideX;
      let exitZ = this.carPos.z + sideZ;
      if (this.checkCollision(exitX, exitZ, 0.45)) {
        exitX = this.carPos.x - sideX;
        exitZ = this.carPos.z - sideZ;
      }
      this.playerPos.set(exitX, 0, exitZ);
      this.playerYaw = this.carYaw;
      this.carSpeed *= 0.25;
      this.mode = 'walking';
      this.dancing = false;
      this.playerChar.root.position.copy(this.playerPos);
      this.playerChar.root.rotation.y = this.playerYaw;
      this.playerChar.root.visible = true;
      this.playerChar.play('idle', 0.15);
      this.soundscape.playSFX('door');
      this.onToast('已下車步行 — 可走進夜店與酒吧大門探索 (按 F 返回座駕 / V 召喚座駕)');
    } else {
      // Check distance to car
      const dist = Math.hypot(this.playerPos.x - this.carPos.x, this.playerPos.z - this.carPos.z);
      if (dist <= 6.5) {
        this.enterCar();
      } else {
        this.summonCar();
      }
    }
  }

  enterCar() {
    this.mode = 'driving';
    this.dancing = false;
    this.playerChar.root.visible = false;
    this.soundscape.playSFX('door');
    this.onToast('已啟動 QUADRA V-TECH 電馭跑車');
  }

  summonCar() {
    if (this.insideVenue) {
      this.onToast('請先走出建築物外再召喚座駕');
      return;
    }
    const fwdX = Math.sin(this.playerYaw);
    const fwdZ = Math.cos(this.playerYaw);
    let targetX = this.playerPos.x + fwdX * 3.8;
    let targetZ = this.playerPos.z + fwdZ * 3.8;
    if (this.checkCollision(targetX, targetZ, 1.3)) {
      targetX = this.playerPos.x;
      targetZ = this.playerPos.z;
    }
    this.carPos.set(targetX, 0, targetZ);
    this.carYaw = this.playerYaw;
    this.carSpeed = 0;
    this.carVelX = 0;
    this.carVelZ = 0;
    this.carGroup.position.copy(this.carPos);
    this.carGroup.rotation.y = this.carYaw;
    this.enterCar();
    this.onToast('已透過神經網路召喚座駕並登車');
  }

  toggleDance() {
    if (this.mode !== 'walking') {
      this.onToast('下車步行時才可跳舞 (按 F 下車)');
      return;
    }
    if (!this.dancing) {
      this.dancing = true;
      this.danceStyle = this.insideVenue && this.insideVenue.id === 'nightclub' ? 'dance_hype' : 'dance_groove';
      this.playerChar.play(this.danceStyle, 0.2);
      this.onToast('進入律動熱舞模式 🕺 (移動或再按 G 結束)');
    } else {
      this.dancing = false;
      this.playerChar.play('idle', 0.2);
    }
  }

  cycleCarLivery() {
    this.liveryIndex = (this.liveryIndex + 1) % CAR_LIVERIES.length;
    const liv = CAR_LIVERIES[this.liveryIndex];
    this.underglowLight.color.setHex(liv.hex);
    this.soundscape.playSFX('paint');
    this.onToast(`車體霓虹底燈已切換：${liv.name}`);
    return liv;
  }

  triggerContextAction() {
    if (this.insideVenue) {
      if (this.insideVenue.id === 'nightclub') {
        this.dancing = true;
        this.danceStyle = this.danceStyle === 'dance_hype' ? 'dance_groove' : 'dance_hype';
        this.playerChar.play(this.danceStyle, 0.18);
        this.soundscape.playSFX('drink');
        this.onToast('在 PULSE 脈衝夜店舞池與人群共舞！');
        return;
      }
      if (this.insideVenue.id === 'bar') {
        this.drinksOrdered++;
        this.soundscape.playSFX('drink');
        const drinks = ['「銀翼之淚」合成琴酒', '「神經連結」藍光龍舌蘭', '「餘燼特調」煙燻威士忌'];
        const dName = drinks[(this.drinksOrdered - 1) % drinks.length];
        this.onToast(`向酒保點了一杯 ${dName} 🍸 (體力與專注恢復)`);
        return;
      }
      if (this.insideVenue.id === 'garage') {
        this.cycleCarLivery();
        return;
      }
    }
    // Outside: if walking near car, enter car; if driving, cycle underglow livery
    if (this.mode === 'walking' && this.canEnterCar) {
      this.enterCar();
    } else {
      this.cycleCarLivery();
    }
  }

  teleportTo(x, z, yaw = 0, mode = 'driving') {
    this.carPos.set(x, 0, z);
    this.carYaw = yaw;
    this.carSpeed = 0;
    this.carVelX = 0;
    this.carVelZ = 0;
    this.carGroup.position.copy(this.carPos);
    this.carGroup.rotation.y = this.carYaw;

    this.playerPos.set(x, 0, z);
    this.playerYaw = yaw;
    this.playerChar.root.position.copy(this.playerPos);
    this.playerChar.root.rotation.y = this.playerYaw;

    if (mode === 'walking') {
      this.mode = 'walking';
      this.playerChar.root.visible = true;
      this.playerChar.play('idle', 0.1);
      // Park car slightly outside on street
      this.carPos.set(x, 0, -25.5);
      this.carGroup.position.copy(this.carPos);
    } else {
      this.mode = 'driving';
      this.playerChar.root.visible = false;
    }

    // Snap camera immediately close to target
    const fwdX = Math.sin(yaw);
    const fwdZ = Math.cos(yaw);
    this.camPos.set(x - fwdX * 7, 3.2, z - fwdZ * 7);
    this.camLook.set(x + fwdX * 2, 1.3, z + fwdZ * 2);
  }

  checkCollision(x, z, radius) {
    if (Math.abs(x) > CITY_HALF - 2 || Math.abs(z) > CITY_HALF - 2) {
      return true;
    }
    for (const box of this.city.colliders) {
      if (
        x + radius > box.x0 &&
        x - radius < box.x1 &&
        z + radius > box.z0 &&
        z - radius < box.z1
      ) {
        return true;
      }
    }
    return false;
  }

  resolveMovement(currX, currZ, nextX, nextZ, radius) {
    let rx = nextX;
    let rz = nextZ;
    if (!this.checkCollision(rx, rz, radius)) {
      return { x: rx, z: rz, hit: false };
    }
    // Try sliding along X only
    if (!this.checkCollision(nextX, currZ, radius)) {
      return { x: nextX, z: currZ, hit: true };
    }
    // Try sliding along Z only
    if (!this.checkCollision(currX, nextZ, radius)) {
      return { x: currX, z: nextZ, hit: true };
    }
    return { x: currX, z: currZ, hit: true };
  }

  update(dt) {
    const clampedDt = Math.min(dt, 0.05);

    if (this.mode === 'driving') {
      this.updateDriving(clampedDt);
    } else {
      this.updateWalking(clampedDt);
    }

    // Update district & venue presence
    const pos = this.activePos;
    this.currentDistrict = this.city.getDistrictAt(pos.x, pos.z);
    this.insideVenue = this.city.getVenueAt(pos.x, pos.z);
    this.nearVenue = !this.insideVenue ? this.city.getNearbyVenue(pos.x, pos.z, 13) : null;

    const distToCar = Math.hypot(this.playerPos.x - this.carPos.x, this.playerPos.z - this.carPos.z);
    this.canEnterCar = this.mode === 'walking' && distToCar <= 5.5;

    // Build contextual interaction prompt
    if (this.insideVenue) {
      if (this.insideVenue.id === 'nightclub') {
        this.interactionPrompt = '[E / G] 在霓虹舞池熱舞   [F] 走出夜店登車';
      } else if (this.insideVenue.id === 'bar') {
        this.interactionPrompt = '[E] 向酒保點賽博調酒   [G] 隨音樂搖擺';
      } else if (this.insideVenue.id === 'garage') {
        this.interactionPrompt = '[E] 改裝座駕霓虹底燈塗裝';
      }
    } else if (this.mode === 'driving') {
      if (this.nearVenue) {
        this.interactionPrompt = `靠近 ${this.nearVenue.name} — 按 [F] 下車步行進入`;
      } else {
        this.interactionPrompt = '[F] 下車步行探索   [Space] 甩尾   [Shift] 氮氣加速   [E] 切換底燈';
      }
    } else {
      if (this.canEnterCar) {
        this.interactionPrompt = '[F] 登上座駕駕駛   [G] 街頭熱舞';
      } else if (this.nearVenue) {
        this.interactionPrompt = `直接走進霓虹拱門進入 ${this.nearVenue.name}   [V] 召喚座駕`;
      } else {
        this.interactionPrompt = '[V] 召喚座駕至身邊   [Shift] 衝刺   [G] 跳舞';
      }
    }

    this.updateCamera(clampedDt);
  }

  updateDriving(dt) {
    const accelInput = (this.keys.forward ? 1 : 0) - (this.keys.backward ? 1 : 0);
    const steerInput = (this.keys.left ? 1 : 0) - (this.keys.right ? 1 : 0);
    this.drifting = this.keys.brake;
    this.boosting = this.keys.sprint && this.boostEnergy > 0.08 && accelInput > 0;

    if (this.boosting) {
      this.boostEnergy = Math.max(0, this.boostEnergy - dt * 0.35);
    } else {
      this.boostEnergy = Math.min(1, this.boostEnergy + dt * 0.18);
    }

    const maxForward = this.boosting ? 42 : 31; // ~151 km/h boost, ~112 km/h normal
    const maxReverse = -13;
    const accelRate = this.boosting ? 28 : 18;
    const brakeRate = 34;

    if (accelInput > 0) {
      const rate = this.carSpeed < 0 ? brakeRate : accelRate;
      this.carSpeed = Math.min(maxForward, this.carSpeed + rate * dt);
    } else if (accelInput < 0) {
      const rate = this.carSpeed > 0 ? brakeRate : 12;
      this.carSpeed = Math.max(maxReverse, this.carSpeed - rate * dt);
    } else {
      // Natural road drag
      const drag = this.drifting ? 16 : 7.5;
      if (Math.abs(this.carSpeed) < drag * dt) {
        this.carSpeed = 0;
      } else {
        this.carSpeed -= Math.sign(this.carSpeed) * drag * dt;
      }
    }

    if (this.drifting && Math.abs(this.carSpeed) > 2) {
      this.carSpeed *= Math.max(0, 1 - 1.1 * dt);
    }

    // Smooth steering angle
    const targetSteer = steerInput * 0.52;
    this.carSteer += (targetSteer - this.carSteer) * Math.min(1, dt * 11);

    // Turn yaw rate scales with speed
    const speedFactor = Math.min(1, Math.abs(this.carSpeed) / 6.5);
    const dirSign = this.carSpeed >= -0.1 ? 1 : -1;
    const driftMultiplier = this.drifting ? 1.55 : 1.0;
    this.carYaw += this.carSteer * speedFactor * dirSign * 2.15 * driftMultiplier * dt;

    // Velocity vector with lateral grip (lower grip during handbrake drift)
    const fwdX = Math.sin(this.carYaw);
    const fwdZ = Math.cos(this.carYaw);
    const targetVx = fwdX * this.carSpeed;
    const targetVz = fwdZ * this.carSpeed;
    const grip = this.drifting ? 3.5 : 11.0;
    this.carVelX += (targetVx - this.carVelX) * Math.min(1, grip * dt);
    this.carVelZ += (targetVz - this.carVelZ) * Math.min(1, grip * dt);

    const nextX = this.carPos.x + this.carVelX * dt;
    const nextZ = this.carPos.z + this.carVelZ * dt;

    // Prevent driving inside pedestrian-only nightclub or bar (garage is drive-in friendly!)
    const resolved = this.resolveMovement(this.carPos.x, this.carPos.z, nextX, nextZ, 1.15);
    this.carPos.x = resolved.x;
    this.carPos.z = resolved.z;
    if (resolved.hit) {
      this.carSpeed *= 0.45;
      this.carVelX *= 0.45;
      this.carVelZ *= 0.45;
    }

    this.carGroup.position.copy(this.carPos);
    this.carGroup.rotation.y = this.carYaw;

    // Chassis body roll & pitch
    this.carMesh.rotation.z = -this.carSteer * (this.carSpeed / 32) * 0.14;
    this.carMesh.rotation.x = accelInput > 0 ? -0.022 : accelInput < 0 ? 0.025 : 0;

    // Animate 4 wheels (spin + front steering)
    this.wheelSpin += (this.carSpeed / 0.34) * dt;
    if (this.wheels.FL) {
      this.wheels.FL.rotation.set(this.wheelSpin, this.carSteer * 0.75, 0, 'YXZ');
    }
    if (this.wheels.FR) {
      this.wheels.FR.rotation.set(this.wheelSpin, this.carSteer * 0.75, 0, 'YXZ');
    }
    if (this.wheels.RL) {
      this.wheels.RL.rotation.x = this.wheelSpin;
    }
    if (this.wheels.RR) {
      this.wheels.RR.rotation.x = this.wheelSpin;
    }
  }

  updateWalking(dt) {
    const moveZ = (this.keys.forward ? 1 : 0) - (this.keys.backward ? 1 : 0);
    const turnX = (this.keys.left ? 1 : 0) - (this.keys.right ? 1 : 0);

    // Turn character with A/D or Left/Right
    if (turnX !== 0) {
      this.playerYaw += turnX * 2.8 * dt;
    }

    if (moveZ !== 0) {
      if (this.dancing) this.dancing = false;
      const isSprinting = this.keys.sprint && moveZ > 0;
      const walkSpeed = isSprinting ? 7.2 : moveZ > 0 ? 4.2 : 2.6;
      this.playerSpeed = walkSpeed;

      const dir = moveZ > 0 ? 1 : -1;
      const nextX = this.playerPos.x + Math.sin(this.playerYaw) * walkSpeed * dir * dt;
      const nextZ = this.playerPos.z + Math.cos(this.playerYaw) * walkSpeed * dir * dt;
      const resolved = this.resolveMovement(this.playerPos.x, this.playerPos.z, nextX, nextZ, 0.38);
      this.playerPos.x = resolved.x;
      this.playerPos.z = resolved.z;

      this.playerChar.play(isSprinting ? 'run' : 'walk', 0.16);
    } else {
      this.playerSpeed = 0;
      if (this.dancing) {
        this.playerChar.play(this.danceStyle, 0.2);
      } else {
        this.playerChar.play('idle', 0.18);
      }
    }

    this.playerChar.root.position.copy(this.playerPos);
    this.playerChar.root.rotation.y = this.playerYaw;
    this.playerChar.mixer.update(dt);
  }

  updateCamera(dt) {
    const pos = this.activePos;
    const yaw = this.activeYaw + this.camOrbitYawOffset;
    const fwdX = Math.sin(yaw);
    const fwdZ = Math.cos(yaw);

    let dist = 7.4;
    let height = 2.85 + this.camOrbitPitchOffset;
    let lookAhead = 3.2;
    let lookHeight = 1.15;

    if (this.mode === 'driving') {
      const spdFactor = Math.min(1, Math.abs(this.carSpeed) / 35);
      dist = 6.8 + spdFactor * 1.45 + (this.boosting ? 0.65 : 0);
      height = 2.55 + spdFactor * 0.35 + this.camOrbitPitchOffset;
      lookAhead = 3.8;
      lookHeight = 0.95;
    } else {
      // Walking camera: pull closer & duck ceiling when inside a venue
      if (this.insideVenue) {
        dist = 3.6;
        height = 2.15 + this.camOrbitPitchOffset * 0.5;
        lookAhead = 2.0;
        lookHeight = 1.42;
      } else {
        dist = 4.6;
        height = 2.35 + this.camOrbitPitchOffset;
        lookAhead = 2.2;
        lookHeight = 1.45;
      }
    }

    const desiredX = pos.x - fwdX * dist;
    const desiredY = Math.max(0.9, height);
    const desiredZ = pos.z - fwdZ * dist;

    const lerpRate = Math.min(1, dt * 9.5);
    this.camPos.x += (desiredX - this.camPos.x) * lerpRate;
    this.camPos.y += (desiredY - this.camPos.y) * lerpRate;
    this.camPos.z += (desiredZ - this.camPos.z) * lerpRate;

    const targetLookX = pos.x + fwdX * lookAhead;
    const targetLookY = lookHeight;
    const targetLookZ = pos.z + fwdZ * lookAhead;

    this.camLook.x += (targetLookX - this.camLook.x) * Math.min(1, dt * 13);
    this.camLook.y += (targetLookY - this.camLook.y) * Math.min(1, dt * 13);
    this.camLook.z += (targetLookZ - this.camLook.z) * Math.min(1, dt * 13);

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }
}
