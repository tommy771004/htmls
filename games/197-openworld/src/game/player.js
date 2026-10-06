import * as THREE from 'three';
import { clamp, damp, lerp } from '../core/noise.js';
import { WORLD_SIZE, WATER_LEVEL } from '../world/terrain.js';

export const EYE_HEIGHT = 1.65;
const RADIUS = 0.35;
const WALK = 4.3;
const RUN = 7.6;
const SWIM = 2.6;
const GRAVITY = 22;
const JUMP = 7.4;
// 游泳時腳的最高位置：眼睛剛好露出水面 0.3 m
const FLOAT_LEVEL = WATER_LEVEL - (EYE_HEIGHT - 0.3);
const LIMIT = WORLD_SIZE / 2 - 8;

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _wish = new THREE.Vector3();
const _n = new THREE.Vector3();

export class Player {
  constructor(camera, terrain, colliders) {
    this.camera = camera;
    this.terrain = terrain;
    this.colliders = colliders;
    this.pos = new THREE.Vector3(); // 腳底位置
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = true;
    this.swimming = false;
    this.headUnderwater = false;
    this.vehicle = null;
    this.sensitivity = 0.0022;
    this.bob = 0;
    this.moveSpeed = 0;
    this.kick = 0; // 射擊後座造成的鏡頭上抬
    this.exhausted = false;

    this.health = 100;
    this.stamina = 100;
    this.hunger = 100;
    this.oxygen = 100;
    this.onDeath = null;
  }

  teleport(x, z, yaw = this.yaw) {
    this.pos.set(x, Math.max(this.terrain.getHeight(x, z), FLOAT_LEVEL), z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
  }

  look(input) {
    this.yaw -= input.mouseDX * this.sensitivity;
    this.pitch = clamp(this.pitch - input.mouseDY * this.sensitivity, -1.5, 1.5);
  }

  damage(amount) {
    this.health = Math.max(0, this.health - amount);
    this.hurtFlash = 1;
    if (this.health <= 0) this.onDeath?.();
  }

  groundAt(x, z, feetY) {
    return Math.max(this.terrain.getHeight(x, z), this.colliders.supportHeight(x, z, feetY));
  }

  update(dt, input, active) {
    if (active) this.look(input);
    this.#vitals(dt, input);
    if (this.vehicle) return;

    const f = active ? input.axis('KeyS', 'KeyW') : 0;
    const s = active ? input.axis('KeyA', 'KeyD') : 0;
    const moving = f !== 0 || s !== 0;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    _fwd.set(-sin, 0, -cos);
    _right.set(cos, 0, -sin);

    const pos = this.pos;
    const vel = this.vel;
    let ground = this.groundAt(pos.x, pos.z, pos.y);

    // 水深超過胸口就開始游泳
    const wasSwimming = this.swimming;
    this.swimming = ground < FLOAT_LEVEL + 0.15 && pos.y < FLOAT_LEVEL + 0.15;
    if (this.swimming && !wasSwimming) vel.y *= 0.25;

    const wantRun = active && input.down('ShiftLeft') && moving && !this.exhausted;

    if (this.swimming) {
      this.onGround = false;
      const speed = wantRun ? SWIM * 1.45 : SWIM;
      _wish.set(0, 0, 0).addScaledVector(_fwd, f).addScaledVector(_right, s);
      if (_wish.lengthSq() > 1) _wish.normalize();
      _wish.multiplyScalar(speed);
      // 已經潛入水中、或明顯往上／下看時，前進方向才帶垂直分量
      const submerged = pos.y < FLOAT_LEVEL - 0.25;
      let vy = 0;
      if (f !== 0 && (submerged || Math.abs(this.pitch) > 0.4)) {
        vy = Math.sin(this.pitch) * f * speed;
        const h = Math.cos(this.pitch);
        _wish.x = (_fwd.x * f * h + _right.x * s) * speed;
        _wish.z = (_fwd.z * f * h + _right.z * s) * speed;
      }
      if (active && input.down('Space')) vy += 2.6;
      if (active && (input.down('KeyC') || input.down('ControlLeft'))) vy -= 2.6;
      if (Math.abs(vy) < 0.05 && pos.y < FLOAT_LEVEL) vy = 0.7; // 浮力
      vel.x = damp(vel.x, _wish.x, 4, dt);
      vel.z = damp(vel.z, _wish.z, 4, dt);
      vel.y = damp(vel.y, vy, 5, dt);
      pos.addScaledVector(vel, dt);
      this.#collide();
      if (pos.y > FLOAT_LEVEL) {
        pos.y = FLOAT_LEVEL;
        vel.y = Math.min(vel.y, 0);
      }
    } else {
      const depth = WATER_LEVEL - pos.y;
      const wade = depth > 0.3 ? lerp(1, 0.55, clamp((depth - 0.3) / 0.9, 0, 1)) : 1;
      const speed = (wantRun ? RUN : WALK) * wade;
      _wish.set(0, 0, 0).addScaledVector(_fwd, f).addScaledVector(_right, s);
      if (_wish.lengthSq() > 1) _wish.normalize();
      _wish.multiplyScalar(speed);

      if (this.onGround) {
        // 太陡的坡：往下滑，且不能往上走
        this.terrain.getNormal(pos.x, pos.z, _n);
        const onTerrain = pos.y - this.terrain.getHeight(pos.x, pos.z) < 0.1;
        if (onTerrain && _n.y < 0.64) {
          const len = Math.hypot(_n.x, _n.z) || 1;
          const dx = _n.x / len;
          const dz = _n.z / len;
          const uphill = -(_wish.x * dx + _wish.z * dz);
          if (uphill > 0) {
            _wish.x += dx * uphill;
            _wish.z += dz * uphill;
          }
          const slide = (0.64 - _n.y) * 34;
          _wish.x += dx * slide;
          _wish.z += dz * slide;
        }
      }
      const accel = this.onGround ? 13 : 2.2;
      vel.x = damp(vel.x, _wish.x, accel, dt);
      vel.z = damp(vel.z, _wish.z, accel, dt);

      if (this.onGround && active && input.hit('Space') && this.stamina > 6) {
        vel.y = JUMP;
        this.onGround = false;
        this.stamina -= 6;
      }
      vel.y -= GRAVITY * dt;
      const wasGrounded = this.onGround;
      pos.addScaledVector(vel, dt);
      this.#collide();
      ground = this.groundAt(pos.x, pos.z, pos.y + 0.1);
      // 下坡時貼地，避免每一步都小小騰空
      const snap = wasGrounded && vel.y <= 0 && pos.y - ground < 0.45;
      if (pos.y <= ground || snap) {
        // 先落地再扣血：摔死時 onDeath 會把人傳回營地，之後不能再用舊位置的地面高度蓋掉
        const impact = wasGrounded ? 0 : -vel.y;
        pos.y = ground;
        vel.y = 0;
        this.onGround = true;
        if (impact > 15) this.damage((impact - 15) * 5);
      } else {
        this.onGround = false;
      }
    }

    const floor = this.groundAt(pos.x, pos.z, pos.y + 0.1);
    if (pos.y < floor) pos.y = floor;

    this.moveSpeed = Math.hypot(vel.x, vel.z);
    this.running = wantRun && this.moveSpeed > WALK * 0.8;
    if (this.onGround && this.moveSpeed > 0.3) this.bob += dt * this.moveSpeed * 1.75;
  }

  /** 先做水平碰撞再查地面：比腳高的方盒會把人推開，比腳低的才當成可站立面 */
  #collide() {
    const pos = this.pos;
    this.colliders.resolve(pos, RADIUS, pos.y);
    pos.x = clamp(pos.x, -LIMIT, LIMIT);
    pos.z = clamp(pos.z, -LIMIT, LIMIT);
  }

  #vitals(dt, input) {
    const draining = this.running && !this.vehicle;
    if (draining) this.stamina -= (this.swimming ? 9 : 13) * dt;
    else this.stamina += (this.swimming ? 4 : 11) * dt;
    this.stamina = clamp(this.stamina, 0, 100);
    if (this.stamina <= 1) this.exhausted = true;
    else if (this.stamina > 25) this.exhausted = false;

    this.hunger = Math.max(0, this.hunger - 0.11 * dt * (draining ? 2 : 1));
    if (this.hunger <= 0) this.damage(1.2 * dt);
    else if (this.hunger > 35 && this.health < 100) this.health = Math.min(100, this.health + 0.9 * dt);

    this.headUnderwater = this.camera.position.y < WATER_LEVEL - 0.02;
    if (this.headUnderwater) {
      this.oxygen = Math.max(0, this.oxygen - 4.5 * dt);
      if (this.oxygen <= 0) this.damage(11 * dt);
    } else {
      this.oxygen = Math.min(100, this.oxygen + 30 * dt);
    }
    this.hurtFlash = Math.max(0, (this.hurtFlash ?? 0) - dt * 1.5);
    this.kick = damp(this.kick, 0, 9, dt);
  }

  /** 徒步時的相機；在載具上由載具接手 */
  updateCamera(dt) {
    const cam = this.camera;
    const bobAmp = this.onGround ? Math.min(this.moveSpeed / WALK, 1.4) * 0.035 : 0;
    cam.position.set(
      this.pos.x + Math.cos(this.yaw) * Math.cos(this.bob) * bobAmp * 0.6,
      this.pos.y + EYE_HEIGHT + Math.sin(this.bob * 2) * bobAmp,
      this.pos.z - Math.sin(this.yaw) * Math.cos(this.bob) * bobAmp * 0.6,
    );
    if (this.swimming) cam.position.y += Math.sin(performance.now() * 0.002) * 0.035;
    cam.rotation.set(clamp(this.pitch + this.kick, -1.55, 1.55), this.yaw, 0, 'YXZ');
    const fov = this.running ? 76 : 70;
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov = damp(cam.fov, fov, 6, dt);
      cam.updateProjectionMatrix();
    }
  }
}

export { FLOAT_LEVEL, RADIUS as PLAYER_RADIUS };
