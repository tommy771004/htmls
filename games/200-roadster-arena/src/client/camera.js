// 追車鏡頭：車尾後上方，跟著車身的「上」慢慢轉（過迴圈、騎牆時畫面跟著翻），空中改看速度方向（翻轉時鏡頭不會跟著甩）。
import { PerspectiveCamera, Vector3, Quaternion } from 'three';

const _f = new Vector3(), _u = new Vector3(), _v = new Vector3(), _t = new Vector3(), _p = new Vector3();
const MODES = { chase: { dist: 7.4, h: 2.1, look: 1.0 }, far: { dist: 12.5, h: 3.8, look: 1.2 }, hood: { dist: -0.4, h: 1.05, look: 0.9 } };
export const CAM_MODES = Object.keys(MODES);

export class ChaseCam {
  constructor() {
    this.camera = new PerspectiveCamera(64, 1, 0.1, 6000);
    this.mode = 'chase';
    this.dir = new Vector3(0, 0, 1);
    this.up = new Vector3(0, 1, 0);
    this.pos = new Vector3();
    this.shakeT = 0; this.shakeK = 0;
    this.fov = 64;
    this.init = false;
  }

  cycle() { const i = CAM_MODES.indexOf(this.mode); this.mode = CAM_MODES[(i + 1) % CAM_MODES.length]; }
  shake(k) { this.shakeK = Math.max(this.shakeK, k); }
  snap() { this.init = false; }

  // p：車身位置；q：車身姿態；vel：速度；st：車輛狀態；focus：球鏡頭時要盯的點
  update(dt, p, q, vel, st, focus = null) {
    const M = MODES[this.mode] || MODES.chase;
    _f.set(0, 0, 1).applyQuaternion(q);
    _u.set(0, 1, 0).applyQuaternion(q);
    const sp = vel.length();
    const air = st.contacts === 0 && st.airTime > 0.2;
    // 想看的方向：球鏡頭是球；地面是車頭；空中且有速度時是速度方向（壓平一點）
    if (focus) { _t.copy(focus).sub(p); _t.y *= 0.35; if (_t.lengthSq() < 1) _t.copy(_f); _t.normalize(); }
    else if (air && sp > 6) { _t.copy(vel).normalize(); _t.y *= 0.55; _t.normalize(); }
    else _t.copy(_f);
    // 想要的「上」：貼地時是車頂方向，空中慢慢回到世界上方
    const wantUp = air || focus ? _v.set(0, 1, 0) : _v.copy(_u);
    if (!this.init) { this.dir.copy(_t); this.up.copy(wantUp); this.init = true; }
    const kd = 1 - Math.exp(-dt * (focus ? 7 : air ? 2.2 : 6));
    this.dir.lerp(_t, kd).normalize();
    this.up.lerp(wantUp, 1 - Math.exp(-dt * (air ? 1.4 : 4))).normalize();
    // 鏡頭的「後方」要和 up 垂直
    _t.copy(this.dir).addScaledVector(this.up, -this.dir.dot(this.up));
    if (_t.lengthSq() < 1e-4) _t.copy(_f);
    _t.normalize();
    const cam = this.camera;
    _p.copy(p).addScaledVector(_t, -M.dist).addScaledVector(this.up, M.h);
    if (this.mode === 'hood') _p.copy(p).addScaledVector(_f, 0.2).addScaledVector(_u, M.h);
    if (_p.y < 0.4) _p.y = 0.4;
    if (this.mode === 'hood') this.pos.copy(_p); else this.pos.lerp(_p, 1 - Math.exp(-dt * 18));
    cam.position.copy(this.pos);
    // 震動
    this.shakeK *= Math.exp(-dt * 5);
    this.shakeT += dt;
    if (this.shakeK > 0.001) {
      const s = this.shakeK;
      cam.position.x += Math.sin(this.shakeT * 73) * s * 0.18;
      cam.position.y += Math.sin(this.shakeT * 91 + 1) * s * 0.14;
    }
    cam.up.copy(this.up);
    const look = this.mode === 'hood' ? _v.copy(p).addScaledVector(_f, 20).addScaledVector(_u, 0.6) : _v.copy(p).addScaledVector(_t, 4).addScaledVector(this.up, M.look);
    cam.lookAt(look);
    const want = 62 + Math.min(22, sp * 0.24) + (st.boosting ? 5 : 0);
    this.fov += (want - this.fov) * Math.min(1, dt * 3);
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
  }
}
