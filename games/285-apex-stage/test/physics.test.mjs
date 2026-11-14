// 單元測試：驗證五級性能車款規格、Pacejka 輪胎摩擦圓物理模型、以及 Cannon-es 剛體懸吊載具動態

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Body, Box, Vec3 } from '../../../vendor/cannon-es-0.20.0/cannon-es.js';
import {
  CAR_CLASSES,
  CARS,
  PAINT_PRESETS,
  getCarsByClass,
  getCarById
} from '../src/physics/cars.js';
import { computeTireForces, SURFACE_TYPES } from '../src/physics/tires.js';
import { PhysicsWorld, SimVehicle } from '../src/physics/vehicle.js';

test('D / C / B / A / S 五級性能分級與 10 款原創車輛規格完整且涵蓋 FWD / RWD / AWD', () => {
  assert.deepEqual(CAR_CLASSES, ['D', 'C', 'B', 'A', 'S']);
  assert.equal(CARS.length, 10);

  for (const cid of CAR_CLASSES) {
    const list = getCarsByClass(cid);
    assert.ok(list.length >= 2, `Class ${cid} should have at least 2 cars`);
    for (const car of list) {
      assert.ok(car.hp > 100);
      assert.ok(car.weightKg >= 800);
      assert.ok(['FWD', 'RWD', 'AWD'].includes(car.drivetrain));
      assert.ok(car.stats.speed > 0 && car.stats.speed <= 100);
      assert.ok(car.stats.handling > 0 && car.stats.handling <= 100);
      assert.ok(car.physics.gearRatios.length >= 5);
    }
  }

  const drivetrains = new Set(CARS.map((c) => c.drivetrain));
  assert.ok(drivetrains.has('FWD'));
  assert.ok(drivetrains.has('RWD'));
  assert.ok(drivetrains.has('AWD'));
  assert.ok(PAINT_PRESETS.length >= 8);
});

test('Pacejka 輪胎物理模型正確計算縱向推進、側滑角回復力、手煞車鎖死與砂石路面抓地折減', () => {
  // 1. 純加速正向滑移
  const accelRes = computeTireForces({
    normalLoad: 3500,
    vLong: 20,
    vLat: 0,
    wheelOmega: 70,
    wheelRadius: 0.32,
    driveForce: 2800,
    brakeForce: 0,
    isHandbrake: false,
    baseTireGrip: 1.25,
    lateralStiffness: 11.5,
    surfaceId: 'asphalt',
    offroadFactor: 0.65,
    isRear: true,
    oversteerFactor: 0.3,
    throttle: 1.0
  });
  assert.ok(accelRes.fx > 1500, 'Should produce positive forward tractive force');
  assert.ok(Math.abs(accelRes.fy) < 1e-6);

  // 2. 過彎側滑（向右側滑 vLat > 0 時應產生向左回復力 fy < 0）
  const cornerRes = computeTireForces({
    normalLoad: 3500,
    vLong: 25,
    vLat: 4.5,
    wheelOmega: 78,
    wheelRadius: 0.32,
    driveForce: 0,
    brakeForce: 0,
    isHandbrake: false,
    baseTireGrip: 1.25,
    lateralStiffness: 11.5,
    surfaceId: 'asphalt',
    offroadFactor: 0.65,
    isRear: false,
    oversteerFactor: 0.3,
    throttle: 0.0
  });
  assert.ok(cornerRes.slipAngle > 0.15);
  assert.ok(cornerRes.fy < -1500, 'Lateral force should oppose positive lateral slip velocity');

  // 3. 拉起手煞車應顯著降低後輪橫向抓地力以觸發慣性甩尾
  const ebrakeRes = computeTireForces({
    normalLoad: 3500,
    vLong: 25,
    vLat: 4.5,
    wheelOmega: 0,
    wheelRadius: 0.32,
    driveForce: 0,
    brakeForce: 0,
    isHandbrake: true,
    baseTireGrip: 1.25,
    lateralStiffness: 11.5,
    surfaceId: 'asphalt',
    offroadFactor: 0.65,
    isRear: true,
    oversteerFactor: 0.3,
    throttle: 0.0
  });
  assert.ok(Math.abs(ebrakeRes.fy) < Math.abs(cornerRes.fy) * 0.55, 'Handbrake should reduce rear lateral grip');
  assert.ok(ebrakeRes.combinedSlip >= 1.0);

  // 4. 砂石路面抓地力低於柏油路，但拉力車高 offroadFactor 具備越野抓地優勢
  assert.ok(SURFACE_TYPES.gravel.grip < SURFACE_TYPES.asphalt.grip);
  const gravelRoadCar = computeTireForces({
    normalLoad: 3500,
    vLong: 18,
    vLat: 3.0,
    wheelOmega: 60,
    wheelRadius: 0.32,
    driveForce: 3200,
    brakeForce: 0,
    isHandbrake: false,
    baseTireGrip: 1.2,
    lateralStiffness: 11.0,
    surfaceId: 'gravel',
    offroadFactor: 0.45,
    isRear: true,
    oversteerFactor: 0.2,
    throttle: 0.8
  });
  const gravelRallyCar = computeTireForces({
    normalLoad: 3500,
    vLong: 18,
    vLat: 3.0,
    wheelOmega: 60,
    wheelRadius: 0.32,
    driveForce: 3200,
    brakeForce: 0,
    isHandbrake: false,
    baseTireGrip: 1.2,
    lateralStiffness: 11.0,
    surfaceId: 'gravel',
    offroadFactor: 0.96,
    isRear: true,
    oversteerFactor: 0.2,
    throttle: 0.8
  });
  assert.ok(gravelRallyCar.effectiveGrip > gravelRoadCar.effectiveGrip, 'Rally car should have higher effective grip on gravel');
});

test('SimVehicle 與 Cannon-es 剛體世界：四輪懸吊接地、加速升檔、急煞俯仰與過彎側傾動態', () => {
  const pw = new PhysicsWorld();
  const groundBody = new Body({ mass: 0, material: pw.defaultMat });
  groundBody.addShape(new Box(new Vec3(500, 1.0, 500)), new Vec3(0, -1.0, 0));
  pw.addStaticBody(groundBody, 'asphalt');

  const s220 = getCarById('akagi-s220');
  const vehicle = new SimVehicle(pw, s220);
  vehicle.reset(new THREE.Vector3(0, 0.35, 0), 0);

  // 先靜置 30 步讓懸吊穩定貼地
  for (let i = 0; i < 30; i++) {
    vehicle.step(1 / 60, { steer: 0, throttle: 0, brake: 0, handbrake: false });
  }
  assert.ok(vehicle.wheels.every((w) => w.inContact), 'All 4 wheels should be in contact with ground');
  assert.ok(vehicle.wheels.every((w) => w.compression > 0.05), 'Suspension should be compressed under vehicle weight');

  // 全油門直線加速 3.5 秒（210 步）
  for (let i = 0; i < 210; i++) {
    vehicle.step(1 / 60, { steer: 0, throttle: 1.0, brake: 0, handbrake: false });
  }
  assert.ok(vehicle.speedKmh > 78, `Expected speed > 78 km/h after 3.5s full throttle, got ${vehicle.speedKmh.toFixed(1)}`);
  assert.ok(vehicle.gear >= 2, `Expected automatic upshift to >= gear 2, got gear ${vehicle.gear}`);
  assert.ok(vehicle.boostBar > 0.3, 'Turbo boost should build under full throttle');

  // 急收油門並重踩煞車：應觸發 BOV 洩壓事件，且重心前移造成車頭下沉（前輪負載 > 後輪負載，bodyPitch < 0）
  let bovTriggered = false;
  for (let i = 0; i < 25; i++) {
    vehicle.step(1 / 60, { steer: 0, throttle: 0, brake: 1.0, handbrake: false });
    if (vehicle.events.bov > 0) bovTriggered = true;
  }
  assert.ok(bovTriggered, 'Sudden throttle lift after boost should trigger BOV event');
  const frontLoad = vehicle.wheels[0].normalLoad + vehicle.wheels[1].normalLoad;
  const rearLoad = vehicle.wheels[2].normalLoad + vehicle.wheels[3].normalLoad;
  assert.ok(frontLoad > rearLoad, `Braking weight transfer should load front wheels (${frontLoad} > ${rearLoad})`);
  assert.ok(vehicle.bodyPitch < -0.005, 'Braking should produce negative nose-down pitch');

  // 高速左轉過彎：車身應產生側傾（bodyRoll）但防傾桿保持穩定不翻車
  for (let i = 0; i < 60; i++) {
    vehicle.step(1 / 60, { steer: 0.75, throttle: 0.7, brake: 0, handbrake: false });
  }
  assert.ok(Math.abs(vehicle.bodyRoll) > 0.005, 'Cornering should produce measurable body roll');
  assert.ok(!vehicle.airborne, 'Anti-roll bar and CG stability should prevent rollover on flat asphalt');

  vehicle.destroy();
});
