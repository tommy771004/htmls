// 動態視覺回饋系統：即時地面黑色胎痕（Skidmarks）、體積感輪胎白煙 / 砂石塵土粒子、
// 車庫 360 度金屬聚光燈展示台，以及三模式動態視角攝影機（Chase / Hood / Bumper Cam + FOV 速度感）

import * as THREE from 'three';
import { SURFACE_TYPES } from '../physics/tires.js';

/**
 * 即時地面黑色胎痕系統（Ring-Buffer Ribbon Mesh）
 */
export class SkidmarkSystem {
  constructor(scene, maxSegments = 1600) {
    this.scene = scene;
    this.maxSegments = maxSegments;
    this.head = 0;

    const vertCount = maxSegments * 4;
    const idxCount = maxSegments * 6;
    this.positions = new Float32Array(vertCount * 3);
    this.colors = new Float32Array(vertCount * 4);
    const indices = new Uint32Array(idxCount);

    for (let i = 0; i < maxSegments; i++) {
      const v = i * 4;
      const k = i * 6;
      indices[k] = v;
      indices[k + 1] = v + 1;
      indices[k + 2] = v + 2;
      indices[k + 3] = v + 1;
      indices[k + 4] = v + 3;
      indices[k + 5] = v + 2;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 4));
    this.geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    this.material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);

    this.lastWheelPos = [null, null, null, null];
  }

  clear() {
    this.positions.fill(0);
    this.colors.fill(0);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.lastWheelPos = [null, null, null, null];
  }

  update(simVehicle) {
    if (!simVehicle) return;
    let dirty = false;

    const rightLocal = new THREE.Vector3(1, 0, 0);
    const carQuat = new THREE.Quaternion(
      simVehicle.chassisBody.quaternion.x,
      simVehicle.chassisBody.quaternion.y,
      simVehicle.chassisBody.quaternion.z,
      simVehicle.chassisBody.quaternion.w
    );
    const rightWorld = rightLocal.applyQuaternion(carQuat).normalize();
    const halfWidth = (simVehicle.spec.visual.wheelWidth || 0.25) * 0.45;

    for (let i = 0; i < 4; i++) {
      const w = simVehicle.wheels[i];
      const slipThreshold = w.surface === 'grass' || w.surface === 'dirt' || w.surface === 'gravel' ? 0.28 : 0.34;

      if (!w.inContact || w.combinedSlip < slipThreshold || Math.abs(simVehicle.speedKmh) < 6) {
        this.lastWheelPos[i] = null;
        continue;
      }

      const cur = new THREE.Vector3(
        w.contactPoint.x + w.contactNormal.x * 0.025,
        w.contactPoint.y + w.contactNormal.y * 0.025,
        w.contactPoint.z + w.contactNormal.z * 0.025
      );

      const prev = this.lastWheelPos[i];
      if (prev) {
        const dist = prev.distanceTo(cur);
        if (dist > 0.14 && dist < 3.0) {
          this._addSegment(prev, cur, rightWorld, halfWidth, w.combinedSlip, w.surface);
          this.lastWheelPos[i] = cur.clone();
          dirty = true;
        }
      } else {
        this.lastWheelPos[i] = cur.clone();
      }
    }

    if (dirty) {
      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.attributes.color.needsUpdate = true;
    }
  }

  _addSegment(p0, p1, right, hw, slip, surface) {
    const idx = this.head;
    this.head = (this.head + 1) % this.maxSegments;

    const vBase = idx * 12;
    const cBase = idx * 16;

    // 4 corners: p0-hw, p0+hw, p1-hw, p1+hw
    this.positions[vBase] = p0.x - right.x * hw;
    this.positions[vBase + 1] = p0.y - right.y * hw;
    this.positions[vBase + 2] = p0.z - right.z * hw;

    this.positions[vBase + 3] = p0.x + right.x * hw;
    this.positions[vBase + 4] = p0.y + right.y * hw;
    this.positions[vBase + 5] = p0.z + right.z * hw;

    this.positions[vBase + 6] = p1.x - right.x * hw;
    this.positions[vBase + 7] = p1.y - right.y * hw;
    this.positions[vBase + 8] = p1.z - right.z * hw;

    this.positions[vBase + 9] = p1.x + right.x * hw;
    this.positions[vBase + 10] = p1.y + right.y * hw;
    this.positions[vBase + 11] = p1.z + right.z * hw;

    const isOffroad = surface === 'gravel' || surface === 'dirt' || surface === 'grass';
    const r = isOffroad ? 0.22 : 0.06;
    const g = isOffroad ? 0.16 : 0.06;
    const b = isOffroad ? 0.11 : 0.07;
    const alpha = Math.min(0.82, (slip - 0.25) * 0.78);

    for (let k = 0; k < 4; k++) {
      this.colors[cBase + k * 4] = r;
      this.colors[cBase + k * 4 + 1] = g;
      this.colors[cBase + k * 4 + 2] = b;
      this.colors[cBase + k * 4 + 3] = alpha;
    }
  }
}

/**
 * 體積感輪胎白煙與越野砂石塵土粒子系統
 */
export class TireParticleSystem {
  constructor(scene, maxCount = 180) {
    this.scene = scene;
    this.maxCount = maxCount;
    this.particles = [];
    this.cursor = 0;

    const puffGeo = new THREE.IcosahedronGeometry(0.28, 1);
    this.group = new THREE.Group();
    this.scene.add(this.group);

    for (let i = 0; i < maxCount; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xeeeeee,
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(puffGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.particles.push({
        mesh,
        mat,
        active: false,
        age: 0,
        life: 0.8,
        vx: 0,
        vy: 0,
        vz: 0,
        startScale: 0.4,
        endScale: 2.2
      });
    }
  }

  spawn(x, y, z, vx, vy, vz, colorHex, intensity = 1) {
    const p = this.particles[this.cursor];
    this.cursor = (this.cursor + 1) % this.maxCount;

    p.active = true;
    p.age = 0;
    p.life = 0.55 + Math.random() * 0.45;
    p.vx = vx + (Math.random() - 0.5) * 1.8;
    p.vy = vy + 0.65 + Math.random() * 0.9;
    p.vz = vz + (Math.random() - 0.5) * 1.8;
    p.startScale = 0.35 + intensity * 0.25;
    p.endScale = 1.45 + intensity * 1.25;

    p.mesh.position.set(x, y + 0.12, z);
    p.mesh.scale.setScalar(p.startScale);
    p.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    p.mesh.visible = true;
    p.mat.color.setHex(colorHex);
    p.mat.opacity = Math.min(0.55, 0.22 + intensity * 0.28);
  }

  update(dt, simVehicle) {
    if (simVehicle) {
      const speedAbs = Math.abs(simVehicle.speedKmh);
      for (let i = 0; i < 4; i++) {
        const w = simVehicle.wheels[i];
        if (!w.inContact) continue;
        const surf = SURFACE_TYPES[w.surface] || SURFACE_TYPES.asphalt;
        const isSliding = w.combinedSlip > 0.36 && speedAbs > 10;
        const isOffroadDust = surf.isOffroad && speedAbs > 18;

        if (isSliding || isOffroadDust) {
          const intensity = isSliding ? Math.min(1.2, w.combinedSlip) : Math.min(0.85, speedAbs / 120);
          if (Math.random() < (isSliding ? 0.85 : 0.48)) {
            this.spawn(
              w.contactPoint.x,
              w.contactPoint.y,
              w.contactPoint.z,
              -simVehicle.chassisBody.velocity.x * 0.18,
              0.4,
              -simVehicle.chassisBody.velocity.z * 0.18,
              surf.dustColor,
              intensity
            );
          }
        }
      }
    }

    for (let i = 0; i < this.maxCount; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      const t = p.age / p.life;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy *= 0.97;
      const s = p.startScale + (p.endScale - p.startScale) * Math.sin(t * Math.PI * 0.5);
      p.mesh.scale.setScalar(s);
      p.mat.opacity = (1 - t) * 0.42;
    }
  }
}

/**
 * 車庫 360 度金屬聚光燈展示台（Showroom Turntable）
 */
export function buildGarageShowroom(scene) {
  const group = new THREE.Group();

  // 展間深色反射地板
  const floorGeo = new THREE.CircleGeometry(28, 64);
  floorGeo.rotateX(-Math.PI * 0.5);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0e1116,
    metalness: 0.65,
    roughness: 0.26
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true;
  group.add(floor);

  // 旋轉金屬展示圓台（Turntable Platform）
  const turntable = new THREE.Group();
  const baseGeo = new THREE.CylinderGeometry(3.45, 3.65, 0.16, 64);
  const baseMat = new THREE.MeshPhysicalMaterial({
    color: 0x222730,
    metalness: 0.85,
    roughness: 0.22,
    clearcoat: 0.6
  });
  const baseMesh = new THREE.Mesh(baseGeo, baseMat);
  baseMesh.position.y = 0.08;
  baseMesh.receiveShadow = true;
  turntable.add(baseMesh);

  // 電光橘與電光藍雙發光邊環
  const ringGeo = new THREE.RingGeometry(3.32, 3.44, 64);
  ringGeo.rotateX(-Math.PI * 0.5);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xff5500, side: THREE.DoubleSide });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.position.y = 0.163;
  turntable.add(ringMesh);

  const innerRingGeo = new THREE.RingGeometry(2.55, 2.60, 64);
  innerRingGeo.rotateX(-Math.PI * 0.5);
  const innerRingMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide });
  const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
  innerRing.position.y = 0.163;
  turntable.add(innerRing);

  // 上方環形攝影棚柔光燈架（Light Halo）
  const haloGeo = new THREE.TorusGeometry(3.6, 0.06, 12, 64);
  haloGeo.rotateX(Math.PI * 0.5);
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xfff4e8 });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.position.y = 4.2;
  group.add(halo);

  // 4 根斜切背景光柱營造 90 年代 Gran Turismo / Ridge Racer 車庫氛圍
  const pillarGeo = new THREE.BoxGeometry(0.28, 5.5, 0.28);
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x181c24, metalness: 0.7, roughness: 0.3 });
  const stripGeo = new THREE.BoxGeometry(0.06, 4.8, 0.06);
  const stripMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + 0.5;
    const dist = 8.5;
    const pGroup = new THREE.Group();
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    const strip = new THREE.Mesh(stripGeo, i % 2 === 0 ? stripMat : innerRingMat);
    strip.position.z = -0.15;
    pGroup.add(pillar, strip);
    pGroup.position.set(Math.sin(ang) * dist, 2.75, Math.cos(ang) * dist);
    pGroup.lookAt(0, 2.75, 0);
    group.add(pGroup);
  }

  group.add(turntable);
  scene.add(group);

  return {
    group,
    turntable,
    ringMat
  };
}

/**
 * 駕駛攝影機控制器：支援追尾（Chase）、引擎蓋（Hood）、保險桿（Bumper）三種視角與動態 FOV
 */
export class DrivingCameraController {
  constructor(camera) {
    this.camera = camera;
    this.modes = ['CHASE', 'HOOD', 'BUMPER'];
    this.modeIndex = 0;

    this.currentPos = new THREE.Vector3(0, 3, -7);
    this.currentLook = new THREE.Vector3(0, 1, 5);
    this.smoothYaw = 0;
    this.initialized = false;
  }

  get mode() {
    return this.modes[this.modeIndex];
  }

  cycleMode() {
    this.modeIndex = (this.modeIndex + 1) % this.modes.length;
    return this.mode;
  }

  resetToVehicle(simVehicle) {
    this.initialized = false;
    this.update(1 / 60, simVehicle);
  }

  update(dt, simVehicle) {
    if (!simVehicle) return;
    const pos = simVehicle.chassisBody.position;
    const quat = simVehicle.chassisBody.quaternion;
    const threeQuat = new THREE.Quaternion(quat.x, quat.y, quat.z, quat.w);
    const carPos = new THREE.Vector3(pos.x, pos.y, pos.z);

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(threeQuat);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(threeQuat);
    const right = new THREE.Vector3(-1, 0, 0).applyQuaternion(threeQuat);

    const speedAbs = Math.abs(simVehicle.speedKmh);
    const speedRatio = Math.min(1.0, speedAbs / 300);

    // 隨車速動態微調 FOV（58° -> 75°）營造強烈高速延伸感
    const baseFov = this.mode === 'BUMPER' ? 66 : this.mode === 'HOOD' ? 62 : 58;
    const targetFov = baseFov + speedRatio * 16;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 8);
    this.camera.updateProjectionMatrix();

    // 高速、壓路緣石與越野路面細微車身震動
    const curbShake = simVehicle.onCurb ? 0.026 : 0;
    const speedShake = speedRatio * 0.012;
    const shakeAmp = (curbShake + speedShake) * Math.min(1, speedAbs / 30);
    const shakeX = (Math.random() - 0.5) * shakeAmp;
    const shakeY = (Math.random() - 0.5) * shakeAmp;

    const L = simVehicle.spec.visual.length;
    const H = simVehicle.spec.visual.cabinHeight;

    if (this.mode === 'CHASE') {
      // 追尾視角：帶平滑彈簧跟隨與甩尾橫移視線預判
      const vel = simVehicle.chassisBody.velocity;
      const horizSpeed = Math.hypot(vel.x, vel.z);
      const moveDir = horizSpeed > 3.5
        ? new THREE.Vector3(vel.x / horizSpeed, 0, vel.z / horizSpeed)
        : new THREE.Vector3(forward.x, 0, forward.z).normalize();

      // 混合車頭方向與實際運動方向，使甩尾時能清楚看到車身側滑角度
      const blendDir = new THREE.Vector3()
        .copy(forward)
        .multiplyScalar(0.58)
        .addScaledVector(moveDir, 0.42)
        .normalize();

      const camDist = 5.6 + speedRatio * 0.65;
      const camHeight = 1.95 + H * 0.25;
      const desiredPos = new THREE.Vector3()
        .copy(carPos)
        .addScaledVector(blendDir, -camDist)
        .add(new THREE.Vector3(shakeX, camHeight + shakeY, 0));

      const desiredLook = new THREE.Vector3()
        .copy(carPos)
        .addScaledVector(forward, 3.8)
        .add(new THREE.Vector3(0, 0.75, 0));

      if (!this.initialized) {
        this.currentPos.copy(desiredPos);
        this.currentLook.copy(desiredLook);
        this.initialized = true;
      } else {
        const posLerp = Math.min(1, dt * 11.5);
        const lookLerp = Math.min(1, dt * 16.0);
        this.currentPos.lerp(desiredPos, posLerp);
        this.currentLook.lerp(desiredLook, lookLerp);
      }

      this.camera.position.copy(this.currentPos);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(this.currentLook);
    } else if (this.mode === 'HOOD') {
      // 引擎蓋視角（Hood Cam）
      const hoodPos = new THREE.Vector3()
        .copy(carPos)
        .addScaledVector(forward, L * 0.08)
        .addScaledVector(up, H * 0.72 + shakeY * 0.6)
        .addScaledVector(right, shakeX * 0.6);

      const hoodLook = new THREE.Vector3()
        .copy(hoodPos)
        .addScaledVector(forward, 18.0)
        .addScaledVector(up, -0.6);

      this.camera.position.copy(hoodPos);
      this.camera.up.copy(up);
      this.camera.lookAt(hoodLook);
    } else {
      // 保險桿貼地視角（Bumper Cam）
      const bumperPos = new THREE.Vector3()
        .copy(carPos)
        .addScaledVector(forward, L * 0.48)
        .addScaledVector(up, 0.36 + shakeY * 0.5)
        .addScaledVector(right, shakeX * 0.5);

      const bumperLook = new THREE.Vector3()
        .copy(bumperPos)
        .addScaledVector(forward, 22.0)
        .addScaledVector(up, -0.2);

      this.camera.position.copy(bumperPos);
      this.camera.up.copy(up);
      this.camera.lookAt(bumperLook);
    }
  }
}
