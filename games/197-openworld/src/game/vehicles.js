import * as THREE from 'three';
import { clamp, damp, lerp } from '../core/noise.js';
import { WORLD_SIZE, WATER_LEVEL } from '../world/terrain.js';
import { EYE_HEIGHT, FLOAT_LEVEL, PLAYER_RADIUS } from './player.js';
import { mergeStatic } from '../core/merge.js';

const LIMIT = WORLD_SIZE / 2 - 12;
const srgb = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = { x: 0, z: 0 };

/** 所有載具共用：座位視角（第一人稱）與追尾視角（V 切換） */
class Vehicle {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.yaw = 0;
    this.speed = 0;
    this.driver = null;
    this.thirdPerson = false;
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.seat = new THREE.Vector3(0, 1, 0);
    this.chase = { back: 7, up: 2.6 };
  }

  get position() {
    return this.group.position;
  }

  distanceTo(pos) {
    return Math.hypot(pos.x - this.group.position.x, pos.z - this.group.position.z);
  }

  enter(player) {
    this.driver = player;
    player.vehicle = this;
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.collider.enabled = false;
  }

  /**
   * 找一個不卡住的下車點；子類別覆寫 exitCandidates。
   * @returns {boolean} 是否找到理想落點（船：false 代表附近沒有岸，只能落水）
   */
  exit() {
    const player = this.driver;
    const { terrain, colliders } = this.game;
    let chosen = null;
    let landed = false;
    for (const [lx, lz] of this.exitCandidates()) {
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      _p.x = this.group.position.x + lx * cos + lz * sin;
      _p.z = this.group.position.z - lx * sin + lz * cos;
      const y = terrain.getHeight(_p.x, _p.z);
      this.collider.enabled = true;
      const blocked = colliders.resolve({ x: _p.x, z: _p.z }, PLAYER_RADIUS, y);
      if (!blocked && this.acceptExit(y)) {
        chosen = { x: _p.x, z: _p.z, y };
        landed = true;
        break;
      }
      if (!chosen) chosen = { x: _p.x, z: _p.z, y };
    }
    this.collider.enabled = true;
    player.vehicle = null;
    player.pos.set(chosen.x, Math.max(chosen.y, FLOAT_LEVEL), chosen.z);
    player.vel.set(0, 0, 0);
    player.yaw = this.yaw + this.lookYaw;
    player.pitch = 0;
    this.driver = null;
    this.thirdPerson = false;
    return landed;
  }

  acceptExit() {
    return true;
  }

  syncCollider() {
    this.collider.x = this.group.position.x;
    this.collider.z = this.group.position.z;
    this.collider.yaw = this.yaw;
  }

  updateCamera(dt, input, camera) {
    const player = this.driver;
    this.lookYaw = clamp(this.lookYaw - input.mouseDX * player.sensitivity, -2.7, 2.7);
    this.lookPitch = clamp(this.lookPitch - input.mouseDY * player.sensitivity, -1.2, 1.2);
    if (input.hit('KeyV')) this.thirdPerson = !this.thirdPerson;

    if (!this.thirdPerson) {
      camera.position.copy(this.seat).applyMatrix4(this.group.matrixWorld);
      _q.setFromEuler(_e.set(this.lookPitch, this.lookYaw, 0, 'YXZ'));
      camera.quaternion.copy(this.group.quaternion).multiply(_q);
    } else {
      const yaw = this.yaw + this.lookYaw;
      const pitch = clamp(0.28 - this.lookPitch, 0.05, 1.3);
      const d = this.chase.back;
      const target = _v.copy(this.group.position);
      target.y += this.chase.up * 0.5;
      camera.position.set(
        target.x + Math.sin(yaw) * Math.cos(pitch) * d,
        target.y + Math.sin(pitch) * d,
        target.z + Math.cos(yaw) * Math.cos(pitch) * d,
      );
      const floor = Math.max(this.game.terrain.getHeight(camera.position.x, camera.position.z), WATER_LEVEL) + 0.4;
      if (camera.position.y < floor) camera.position.y = floor;
      camera.lookAt(target);
    }
    if (Math.abs(camera.fov - 70) > 0.05) {
      camera.fov = damp(camera.fov, 70, 6, dt);
      camera.updateProjectionMatrix();
    }
  }
}

// ---------------------------------------------------------------- 車

const WHEELBASE = 2.5;
const TRACK = 1.7;
const WHEEL_R = 0.4;
const MAX_FWD = 24;
const MAX_REV = 7;

export class Car extends Vehicle {
  constructor(game, x, z, yaw) {
    super(game);
    this.name = '越野車';
    this.yaw = yaw;
    this.steer = 0;
    this.pitch = 0;
    this.roll = 0;
    this.seat.set(-0.42, 1.52, 0.35);
    this.chase = { back: 7.5, up: 2.8 };
    this.#build();
    this.group.position.set(x, game.terrain.getHeight(x, z), z);
    this.collider = game.colliders.addDynamicBox(1.0, 2.05, 0);
    this.#settle(1);
    game.scene.add(this.group);
  }

  #build() {
    // PBR 材質：烤漆帶一點金屬反光、橡膠全霧面、鋼件會反射天空
    const L = (r, g, b, roughness, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color: srgb(r, g, b), roughness, metalness, ...extra });
    const paint = L(0.33, 0.4, 0.23, 0.48, 0.35);
    const paintDark = L(0.24, 0.3, 0.17, 0.55, 0.3);
    const black = L(0.07, 0.07, 0.08, 0.6, 0.3);
    const rubber = L(0.05, 0.05, 0.055, 0.95);
    const steel = L(0.62, 0.64, 0.67, 0.32, 0.9);
    const leather = L(0.3, 0.2, 0.13, 0.78);
    const glass = L(0.75, 0.88, 0.92, 0.05, 0.6, { transparent: true, opacity: 0.22 });
    const add = (geo, mat, x, y, z, shadow = true, parent = this.group) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = shadow;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const C = (r, len, seg = 12) => new THREE.CylinderGeometry(r, r, len, seg);

    // ---- 底盤與車斗（開頂吉普，第一人稱視野才不會被車頂擋住）----
    add(B(1.3, 0.14, 3.8), black, 0, 0.52, 0);
    add(B(1.72, 0.08, 2.4), paintDark, 0, 0.68, 0.55);
    // 側板分三段，中間留出低矮的門檻
    for (const sx of [-1, 1]) {
      add(B(0.07, 0.52, 0.5), paint, sx * 0.86, 0.98, -0.42);
      add(B(0.07, 0.2, 0.85), paint, sx * 0.86, 0.82, 0.25);
      add(B(0.07, 0.52, 1.1), paint, sx * 0.86, 0.98, 1.2);
      add(B(0.02, 0.4, 1.0), paintDark, sx * 0.9, 0.98, 1.2, false); // 飾條
      // 輪拱：前後各一片平葉子板＋斜切的前緣
      add(B(0.46, 0.05, 1.05), paint, sx * 0.98, 0.9, -1.25);
      add(B(0.46, 0.05, 0.3), paint, sx * 0.98, 0.83, -1.86).rotation.x = 0.5;
      add(B(0.3, 0.05, 1.0), paint, sx * 1.02, 0.9, 1.25);
      add(B(0.06, 0.1, 0.16), black, sx * 0.97, 1.28, -0.62, false); // 後視鏡
      add(C(0.012, 0.16, 5), black, sx * 0.93, 1.2, -0.62, false).rotation.z = sx * 0.9;
    }
    add(B(1.72, 0.52, 0.07), paint, 0, 0.98, 1.74); // 尾門
    add(B(1.5, 0.03, 0.02), paintDark, 0, 1.1, 1.78, false);

    // ---- 引擎蓋與車頭 ----
    const hood = B(1.42, 0.4, 1.3);
    const hp = hood.attributes.position;
    for (let i = 0; i < hp.count; i++) {
      // 前緣往下收、兩側略為內縮，做出吉普的梯形車頭
      if (hp.getZ(i) < 0) {
        hp.setX(i, hp.getX(i) * 0.9);
        if (hp.getY(i) > 0) hp.setY(i, hp.getY(i) - 0.07);
      }
    }
    hood.computeVertexNormals();
    add(hood, paint, 0, 0.95, -1.3);
    add(B(0.04, 0.02, 1.2), paintDark, 0, 1.135, -1.28, false); // 引擎蓋中線
    for (const sx of [-1, 1]) add(B(0.05, 0.03, 0.09), black, sx * 0.55, 1.14, -1.0, false); // 扣環
    add(B(1.72, 0.34, 0.14), paint, 0, 1.05, -0.66); // 前圍板
    add(B(1.3, 0.44, 0.05), paint, 0, 0.92, -1.96);
    for (let i = -3; i <= 3; i++) add(B(0.06, 0.3, 0.02), black, i * 0.1, 0.93, -1.99, false); // 水箱護罩
    const lampMat = new THREE.MeshBasicMaterial({ color: srgb(1, 0.96, 0.8) });
    this.lampMat = lampMat;
    for (const sx of [-1, 1]) {
      const lamp = add(C(0.105, 0.05, 14), lampMat, sx * 0.5, 0.97, -1.99, false);
      lamp.rotation.x = Math.PI / 2;
      const ring = add(new THREE.TorusGeometry(0.11, 0.016, 5, 16), steel, sx * 0.5, 0.97, -2.01, false);
      ring.name = 'lamp-ring';
      add(B(0.1, 0.06, 0.03), new THREE.MeshBasicMaterial({ color: srgb(0.9, 0.5, 0.1) }), sx * 0.76, 0.86, -1.98, false); // 方向燈
      add(B(0.14, 0.14, 0.04), new THREE.MeshBasicMaterial({ color: srgb(0.7, 0.05, 0.05) }), sx * 0.7, 0.98, 1.79, false); // 尾燈
    }
    add(B(1.9, 0.13, 0.13), steel, 0, 0.56, -2.08); // 保險桿
    add(B(1.9, 0.13, 0.13), steel, 0, 0.56, 2.0);
    for (const sx of [-1, 1]) add(B(0.1, 0.2, 0.08), black, sx * 0.45, 0.6, -2.13, false); // 拖車鉤座

    // ---- 擋風玻璃與防滾架 ----
    const screen = new THREE.Group();
    screen.position.set(0, 1.22, -0.66);
    screen.rotation.x = -0.22;
    this.group.add(screen);
    add(B(1.6, 0.56, 0.02), glass, 0, 0.3, 0, false, screen);
    for (const sx of [-1, 1]) add(B(0.035, 0.6, 0.035), black, sx * 0.82, 0.3, 0, true, screen);
    add(B(1.67, 0.035, 0.035), black, 0, 0.6, 0, true, screen);
    add(B(1.67, 0.035, 0.035), black, 0, 0.0, 0, false, screen);
    for (const sx of [-1, 1]) {
      add(C(0.035, 1.05, 8), black, sx * 0.8, 1.6, 1.2);
      const brace = add(C(0.028, 0.75, 8), black, sx * 0.8, 1.45, 1.52);
      brace.rotation.x = 0.85;
    }
    add(C(0.035, 1.6, 8), black, 0, 2.12, 1.2).rotation.z = Math.PI / 2;

    // ---- 內裝 ----
    add(B(1.5, 0.22, 0.1), black, 0, 1.05, -0.56, false); // 儀表板
    for (const gx of [-0.52, -0.32]) {
      const gauge = add(C(0.05, 0.02, 12), new THREE.MeshBasicMaterial({ color: srgb(0.85, 0.85, 0.8) }), gx, 1.08, -0.505, false);
      gauge.rotation.x = Math.PI / 2;
    }
    for (const sx of [-0.42, 0.42]) {
      add(B(0.48, 0.12, 0.5), leather, sx, 0.82, 0.45);
      add(B(0.48, 0.58, 0.1), leather, sx, 1.14, 0.74).rotation.x = 0.12;
      add(B(0.24, 0.16, 0.08), leather, sx, 1.52, 0.8, false);
    }
    add(B(1.5, 0.12, 0.45), leather, 0, 0.82, 1.35); // 後排長椅
    add(C(0.02, 0.5, 6), black, 0.02, 0.92, 0.1, false).rotation.x = -0.3; // 排檔桿
    add(new THREE.SphereGeometry(0.035, 8, 6), black, 0.02, 1.16, 0.03, false);
    const column = add(C(0.02, 0.4, 6), black, -0.42, 0.98, -0.42, false);
    column.rotation.x = 1.12;
    this.wheelSteer = new THREE.Group();
    this.wheelSteer.position.set(-0.42, 1.08, -0.26);
    this.wheelSteer.rotation.x = -0.45;
    this.group.add(this.wheelSteer);
    add(new THREE.TorusGeometry(0.15, 0.016, 6, 20), black, 0, 0, 0, false, this.wheelSteer);
    for (let i = 0; i < 3; i++) {
      const spoke = add(B(0.02, 0.15, 0.012), black, 0, 0, 0, false, this.wheelSteer);
      spoke.geometry.translate(0, 0.075, 0);
      spoke.rotation.z = (i / 3) * Math.PI * 2;
    }

    // ---- 輪胎：胎面＋輪框＋輪轂蓋；備胎掛在尾門 ----
    const tire = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.3, 18).rotateZ(Math.PI / 2);
    const rim = new THREE.CylinderGeometry(0.24, 0.24, 0.31, 14).rotateZ(Math.PI / 2);
    const cap = new THREE.CylinderGeometry(0.09, 0.09, 0.34, 8).rotateZ(Math.PI / 2);
    const lug = B(0.33, 0.07, 0.42);
    const makeWheel = () => {
      const g = new THREE.Group();
      add(tire, rubber, 0, 0, 0, true, g);
      add(rim, steel, 0, 0, 0, false, g);
      add(cap, paintDark, 0, 0, 0, false, g);
      // 幾塊突出的胎紋，轉動時才看得出輪子在滾
      for (let i = 0; i < 6; i++) {
        const tread = add(lug, rubber, 0, 0, 0, false, g);
        tread.rotation.x = (i / 6) * Math.PI;
        tread.scale.set(0.96, 1, 1.96);
      }
      return g;
    };
    this.wheels = [];
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const pivot = new THREE.Group();
      pivot.position.set((sx * TRACK) / 2, WHEEL_R, (sz * WHEELBASE) / 2);
      const w = makeWheel();
      pivot.add(w);
      this.group.add(pivot);
      this.wheels.push({ pivot, mesh: w, front: sz < 0 });
    }
    const spare = makeWheel();
    spare.position.set(0, 1.08, 1.96);
    spare.rotation.y = Math.PI / 2;
    this.group.add(spare);

    mergeStatic(this.group); // 一百多個零件 → 每種材質一個 mesh

    // 頭燈：一直留在場景裡只調 intensity，避免開關燈時重編 shader
    this.headlight = new THREE.SpotLight(srgb(1, 0.95, 0.82), 0, 70, 0.55, 0.5, 1.4);
    this.headlight.position.set(0, 1.0, -1.9);
    this.headlight.target.position.set(0, 0.2, -14);
    this.group.add(this.headlight, this.headlight.target);
    this.lightsOn = false;
  }

  exitCandidates() {
    return [[-1.75, 0.3], [1.75, 0.3], [0, 3.0], [-1.75, 1.6], [1.75, -1.2], [0, -3.2]];
  }

  /** 依四輪下方的地形高度決定車身高度與俯仰／側傾 */
  #settle(k) {
    const t = this.game.terrain;
    const p = this.group.position;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const h = (lx, lz) => t.getHeight(p.x + lx * cos + lz * sin, p.z - lx * sin + lz * cos);
    const hw = TRACK / 2;
    const hl = WHEELBASE / 2;
    const fl = h(-hw, -hl);
    const fr = h(hw, -hl);
    const rl = h(-hw, hl);
    const rr = h(hw, hl);
    const pitch = Math.atan2((fl + fr - rl - rr) / 2, WHEELBASE);
    const roll = Math.atan2((fr + rr - fl - rl) / 2, TRACK);
    this.pitch = lerp(this.pitch, pitch, k);
    this.roll = lerp(this.roll, roll, k);
    p.y = lerp(p.y, (fl + fr + rl + rr) / 4, k);
    this.slope = pitch;
    this.group.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
    this.group.updateMatrixWorld(true);
  }

  update(dt, input, env) {
    const driven = !!this.driver && this.game.active;
    const throttle = driven ? input.axis('KeyS', 'KeyW') : 0;
    const steerIn = driven ? input.axis('KeyD', 'KeyA') : 0;
    const brake = (driven && input.down('Space')) || !this.driver;
    const p = this.group.position;
    const terrain = this.game.terrain;

    if (throttle > 0) this.speed += (this.speed < 0 ? 24 : 12 * (1 - this.speed / MAX_FWD)) * dt;
    else if (throttle < 0) this.speed -= (this.speed > 0 ? 24 : 7 * (1 + this.speed / MAX_REV)) * dt;
    this.speed -= this.speed * 0.3 * dt;
    if (throttle === 0) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 1.6 * dt);
    if (brake) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 26 * dt);
    this.speed -= 9.8 * Math.sin(this.slope ?? 0) * dt * 0.85; // 上坡吃力、下坡加速

    const depth = terrain.waterDepth(p.x, p.z);
    if (depth > 0.45) this.speed *= Math.exp(-dt * 2.2 * Math.min(depth - 0.45, 1.5));

    const ratio = Math.min(Math.abs(this.speed) / MAX_FWD, 1);
    this.steer = damp(this.steer, steerIn * lerp(0.55, 0.14, ratio), 7, dt);
    this.yaw += (this.speed / WHEELBASE) * Math.tan(this.steer) * dt;

    if (Math.abs(this.speed) > 0.01) {
      const fx = -Math.sin(this.yaw);
      const fz = -Math.cos(this.yaw);
      const nx = clamp(p.x + fx * this.speed * dt, -LIMIT, LIMIT);
      const nz = clamp(p.z + fz * this.speed * dt, -LIMIT, LIMIT);
      const aheadX = nx + fx * Math.sign(this.speed) * 1.8;
      const aheadZ = nz + fz * Math.sign(this.speed) * 1.8;
      const tooDeep = terrain.waterDepth(aheadX, aheadZ) > 0.6 && terrain.waterDepth(aheadX, aheadZ) > depth;
      const tooSteep = terrain.getNormal(aheadX, aheadZ).y < 0.5 && terrain.getHeight(aheadX, aheadZ) > p.y + 0.5;
      if (tooDeep || tooSteep) {
        this.speed *= -0.15;
      } else {
        _p.x = nx;
        _p.z = nz;
        // 車身用前後兩個圓近似，撞到樹／石頭就推開並掉速
        let hit = false;
        for (const off of [-1.15, 1.15]) {
          const c = { x: _p.x + fx * off, z: _p.z + fz * off };
          const bx = c.x;
          const bz = c.z;
          if (this.game.colliders.resolve(c, 1.0, p.y, this.collider)) {
            _p.x += c.x - bx;
            _p.z += c.z - bz;
            hit = true;
          }
        }
        if (hit) this.speed *= Math.exp(-dt * 9);
        p.x = _p.x;
        p.z = _p.z;
      }
    }

    this.#settle(1 - Math.exp(-12 * dt));
    this.syncCollider();
    this.collider.top = p.y + 1.25;

    const spin = (this.speed * dt) / WHEEL_R;
    for (const w of this.wheels) {
      w.mesh.rotation.x -= spin;
      if (w.front) w.pivot.rotation.y = this.steer;
    }
    this.wheelSteer.rotation.z = this.steer * 2.2;

    if (driven && input.hit('KeyL')) this.lightsOn = !this.lightsOn;
    const want = this.lightsOn ? 1 : 0;
    this.headlight.intensity = damp(this.headlight.intensity, want * 260, 10, dt);
    this.lampMat.color.setScalar(0.25 + 0.75 * want);
  }
}

// ---------------------------------------------------------------- 船

export class Boat extends Vehicle {
  constructor(game, model, x, z, yaw) {
    super(game);
    this.name = '小船';
    this.yaw = yaw;
    this.yawVel = 0;
    this.rowPhase = 0;
    this.t = 0;
    this.draft = 0.2; // 吃水
    const size = model.userData.size;
    this.size = size;
    this.seat.set(0, size.y * 0.55 + 0.72, size.z * 0.07);
    this.chase = { back: 7, up: 2.2 };
    this.group.add(model);
    this.#buildOars(size);
    this.group.position.set(x, WATER_LEVEL - this.draft, z);
    this.group.rotation.set(0, yaw, 0, 'YXZ');
    this.collider = game.colliders.addDynamicBox(size.x / 2, size.z / 2, WATER_LEVEL + size.y - this.draft);
    this.syncCollider();
    game.scene.add(this.group);
    this.group.updateMatrixWorld(true);
  }

  #buildOars(size) {
    const wood = new THREE.MeshLambertMaterial({ color: srgb(0.62, 0.48, 0.3) });
    const shaft = new THREE.CylinderGeometry(0.025, 0.025, 2.5, 6);
    shaft.rotateZ(Math.PI / 2);
    const blade = new THREE.BoxGeometry(0.55, 0.16, 0.025);
    this.oars = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * size.x * 0.46, size.y * 0.95, size.z * 0.05);
      const s = new THREE.Mesh(shaft, wood);
      s.position.x = side * 0.75;
      const b = new THREE.Mesh(blade, wood);
      b.position.x = side * 1.85;
      s.castShadow = b.castShadow = true;
      pivot.add(s, b);
      this.group.add(pivot);
      this.oars.push({ pivot, side });
    }
  }

  exitCandidates() {
    const out = [];
    for (const r of [1.7, 2.6, 3.6, 4.6]) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        out.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
    }
    return out;
  }

  /** 優先找可以站的岸邊；找不到就落水（exit 會退回第一個候選點） */
  acceptExit(y) {
    return y > WATER_LEVEL - 0.7;
  }

  #afloat(x, z) {
    const t = this.game.terrain;
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const half = this.size.z * 0.42;
    return (
      t.waterDepth(x, z) > 0.4 &&
      t.waterDepth(x + fx * half, z + fz * half) > 0.3 &&
      t.waterDepth(x - fx * half, z - fz * half) > 0.3
    );
  }

  update(dt, input, env) {
    this.t += dt;
    const driven = !!this.driver && this.game.active;
    const throttle = driven ? input.axis('KeyS', 'KeyW') : 0;
    const turn = driven ? input.axis('KeyD', 'KeyA') : 0;
    const p = this.group.position;

    // 划槳：一下一下的推力，而不是等速前進
    let power = 0;
    if (throttle !== 0 || turn !== 0) {
      this.rowPhase += dt * 3.4;
      power = Math.max(0, Math.sin(this.rowPhase));
    }
    this.speed += throttle * power * (throttle > 0 ? 6.2 : 3.6) * dt;
    this.speed -= this.speed * 0.6 * dt;
    this.speed = clamp(this.speed, -2.2, 4.6);
    this.yawVel = damp(this.yawVel, turn * (0.5 + 0.12 * Math.abs(this.speed)), 2.5, dt);
    this.yaw += this.yawVel * dt;

    if (Math.abs(this.speed) > 0.005) {
      const nx = clamp(p.x - Math.sin(this.yaw) * this.speed * dt, -LIMIT, LIMIT);
      const nz = clamp(p.z - Math.cos(this.yaw) * this.speed * dt, -LIMIT, LIMIT);
      _p.x = nx;
      _p.z = nz;
      const bumped = this.game.colliders.resolve(_p, this.size.x * 0.55, WATER_LEVEL, this.collider);
      if (this.#afloat(_p.x, _p.z)) {
        p.x = _p.x;
        p.z = _p.z;
        if (bumped) this.speed *= Math.exp(-dt * 6);
      } else {
        this.speed *= -0.25; // 擱淺：輕輕彈回
      }
    }

    const chop = 0.6 + env.wind.strength;
    p.y = WATER_LEVEL - this.draft + Math.sin(this.t * 1.3) * 0.03 * chop;
    const pitch = Math.sin(this.t * 1.1 + 1) * 0.015 * chop + power * Math.sign(throttle) * 0.02;
    const roll = Math.sin(this.t * 0.9) * 0.025 * chop + this.yawVel * 0.05;
    this.group.rotation.set(pitch, this.yaw, roll, 'YXZ');
    this.group.updateMatrixWorld(true);
    this.syncCollider();

    const sweep = Math.sin(this.rowPhase);
    const dip = Math.cos(this.rowPhase);
    for (const o of this.oars) {
      const dir = turn !== 0 && throttle === 0 ? -o.side * turn : throttle || 1;
      o.pivot.rotation.y = o.side * sweep * 0.55 * dir;
      o.pivot.rotation.z = -o.side * (0.3 + 0.14 * dip);
    }
  }
}

export { EYE_HEIGHT };
