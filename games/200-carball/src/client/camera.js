// 鏡頭：球鎖定（車在畫面下方、鏡頭盯著球）、車尾（跟著車頭，開上牆會跟著翻）、自由（滑鼠／右搖桿繞車）。
import * as THREE from 'three';
import { arenaSDF, arenaNormal } from '../core/arena.js';

const WUP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3(), _q = new THREE.Quaternion();
const _fwd = new THREE.Vector3(), _up = new THREE.Vector3();

export const CAM_MODES = ['ball', 'car', 'free'];
export const CAM_NAMES = { ball: '球鎖定', car: '車尾', free: '自由視角' };

export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.mode = 'ball';
    this.fovH = 110;
    this.dist = 2.7;
    this.height = 1.0;
    this.refUp = new THREE.Vector3(0, 1, 0);
    this.refFwd = new THREE.Vector3(0, 0, 1);
    this.ballDir = new THREE.Vector3(0, 0, 1);
    this.pos = new THREE.Vector3(0, 3, -10);
    this.look = new THREE.Vector3();
    this.lookSm = new THREE.Vector3();
    this.freeYaw = 0; this.freePitch = 0.18;
    this.peekYaw = 0; this.peekPitch = 0;
    this.shake = 0;
    this.override = null;
  }

  setAspect(aspect) {
    const h = THREE.MathUtils.degToRad(this.fovH);
    let v = 2 * Math.atan(Math.tan(h / 2) / aspect);
    v = THREE.MathUtils.clamp(v, THREE.MathUtils.degToRad(48), THREE.MathUtils.degToRad(aspect < 1 ? 92 : 82));
    this.cam.fov = THREE.MathUtils.radToDeg(v);
    this.cam.aspect = aspect;
    this.cam.updateProjectionMatrix();
  }

  cycle() { this.mode = CAM_MODES[(CAM_MODES.indexOf(this.mode) + 1) % CAM_MODES.length]; this.freeYaw = 0; this.freePitch = 0.18; }

  update(dt, car, ballPos, look, mouse) {
    const cam = this.cam;
    if (this.override) {
      const o = this.override;
      this.pos.lerp(o.pos, o.snap ? 1 : 1 - Math.exp(-dt * (o.k || 6)));
      this.lookSm.lerp(o.look, o.snap ? 1 : 1 - Math.exp(-dt * (o.k || 6) * 1.5));
      o.snap = false;
      this.apply(dt);
      return;
    }
    const t = car.pos, q = car.quat;
    _q.set(q.x, q.y, q.z, q.w);
    _fwd.set(0, 0, 1).applyQuaternion(_q);
    _up.set(0, 1, 0).applyQuaternion(_q);
    // 參考座標：在地上跟著車頂（開上牆鏡頭會翻過去），離地後慢慢回正
    const targetUp = car.onGround && this.mode !== 'ball' ? _up : WUP;
    this.refUp.lerp(targetUp, 1 - Math.exp(-dt * (car.onGround ? 7 : 2.2))).normalize();
    // 車頭方向投影到參考平面上，加一點延遲（轉彎時看得到車側）
    _a.copy(_fwd).addScaledVector(this.refUp, -_fwd.dot(this.refUp));
    if (_a.lengthSq() < 0.05) _a.copy(car.vel).addScaledVector(this.refUp, -car.vel.dot(this.refUp));
    if (_a.lengthSq() > 1e-4) { _a.normalize(); this.refFwd.lerp(_a, 1 - Math.exp(-dt * 9)).normalize(); }
    // 偷看：放開就彈回
    this.peekYaw += ((look.x || 0) * 2.4 - this.peekYaw) * Math.min(1, dt * 8);
    this.peekPitch += ((look.y || 0) * 0.6 - this.peekPitch) * Math.min(1, dt * 8);

    let dir;   // 鏡頭看出去的水平方向
    if (this.mode === 'ball' && ballPos) {
      _b.set(ballPos.x - t.x, ballPos.y - t.y, ballPos.z - t.z);
      _c.copy(_b).addScaledVector(WUP, -_b.dot(WUP));
      if (_c.length() > 0.8) this.ballDir.lerp(_c.normalize(), 1 - Math.exp(-dt * 10)).normalize();
      dir = this.ballDir;
    } else {
      dir = this.refFwd;
    }
    _c.copy(dir);
    let pitch = 0;
    if (this.mode === 'free') {
      this.freeYaw -= (mouse[0] * 0.004 + (look.x || 0) * dt * 2.6);
      this.freePitch = THREE.MathUtils.clamp(this.freePitch + mouse[1] * 0.003 + (look.y || 0) * dt * 1.8, -0.35, 1.2);
      _c.applyAxisAngle(this.refUp, this.freeYaw);
      pitch = this.freePitch;
    } else {
      _c.applyAxisAngle(this.refUp, this.peekYaw);
      pitch = this.peekPitch;
    }
    const dist = this.mode === 'free' ? this.dist * 1.25 : this.dist;
    const h = this.height + Math.sin(pitch) * dist;
    _a.set(t.x, t.y, t.z).addScaledVector(_c, -dist * Math.cos(pitch)).addScaledVector(this.refUp, h);
    // 不讓鏡頭穿出牆
    const d = arenaSDF(_a.x, _a.y, _a.z);
    if (d < 0.35) { arenaNormal(_a.x, _a.y, _a.z, _n); _a.addScaledVector(_n, 0.35 - d); }
    this.pos.copy(_a);
    if (this.mode === 'ball' && ballPos) {
      // 看球，但仰角有上限，車子才不會完全掉出畫面
      _b.set(ballPos.x, ballPos.y, ballPos.z).sub(this.pos);
      const hor = Math.hypot(_b.x, _b.z), ang = Math.atan2(_b.y, hor);
      const lim = this.cam.aspect < 1 ? 0.8 : 0.95;
      if (ang > lim) _b.y = Math.tan(lim) * hor;
      const minAng = -0.5;
      if (ang < minAng) _b.y = Math.tan(minAng) * hor;
      // 直式螢幕視野上下很高，往下壓一點，天花板才不會佔掉半個畫面
      if (this.cam.aspect < 1) _b.y -= 0.14 * Math.hypot(_b.x, _b.z);
      this.look.copy(this.pos).add(_b.normalize().multiplyScalar(10));
    } else {
      this.look.set(t.x, t.y, t.z).addScaledVector(this.refUp, this.cam.aspect < 1 ? 0.25 : 0.55).addScaledVector(_c, 2.5);
    }
    this.lookSm.lerp(this.look, 1 - Math.exp(-dt * 16));
    this.apply(dt);
  }

  apply(dt) {
    const cam = this.cam;
    cam.position.copy(this.pos);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.5);
      const s = this.shake * this.shake * 0.35;
      cam.position.x += (Math.random() - 0.5) * s; cam.position.y += (Math.random() - 0.5) * s; cam.position.z += (Math.random() - 0.5) * s;
    }
    cam.up.copy(this.override ? WUP : this.refUp);
    cam.lookAt(this.lookSm);
  }
}
