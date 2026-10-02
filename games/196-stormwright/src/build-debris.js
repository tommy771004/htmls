// 建材破碎碎片：一個 InstancedMesh（單次繪製）環形池，簡單重力＋地形反彈。
import * as THREE from 'three';
import { DEBRIS_COLORS } from './build-tex.js';

const CAP = 360;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();

export class Debris {
  constructor(ctx, parent) {
    this.ctx = ctx;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.8 }), CAP);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
    this.mesh.frustumCulled = false; this.mesh.castShadow = true; this.mesh.count = 0;
    parent.add(this.mesh);
    this.p = Array.from({ length: CAP }, () => ({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, wx: 0, wy: 0, wz: 0, s: 0.3, t: 0, life: 2, bounces: 0 }));
    this.next = 0; this.active = 0;
  }
  // 在 center 為中心、尺寸 size 的範圍噴出 n 塊碎片；from 為衝擊點（碎片往外飛）
  burst(center, size, matIdx, n, from) {
    const pal = DEBRIS_COLORS[matIdx] || DEBRIS_COLORS[0];
    for (let i = 0; i < n; i++) {
      const d = this.p[this.next]; const idx = this.next; this.next = (this.next + 1) % CAP;
      d.on = true; d.t = 0; d.life = 1.6 + Math.random() * 1.4; d.bounces = 0;
      d.x = center.x + (Math.random() - 0.5) * size.x; d.y = center.y + (Math.random() - 0.5) * size.y; d.z = center.z + (Math.random() - 0.5) * size.z;
      let ox = d.x - (from ? from.x : center.x), oz = d.z - (from ? from.z : center.z); const l = Math.hypot(ox, oz) || 1; ox /= l; oz /= l;
      const sp = 1.5 + Math.random() * 4.5;
      d.vx = ox * sp + (Math.random() - 0.5) * 2; d.vz = oz * sp + (Math.random() - 0.5) * 2; d.vy = 1 + Math.random() * 4.5;
      d.rx = Math.random() * 6; d.ry = Math.random() * 6; d.rz = Math.random() * 6;
      d.wx = (Math.random() - 0.5) * 14; d.wy = (Math.random() - 0.5) * 14; d.wz = (Math.random() - 0.5) * 14;
      d.s = 0.12 + Math.random() * 0.3 * (matIdx === 2 ? 0.8 : 1);
      _c.setHex(pal[(Math.random() * pal.length) | 0]); this.mesh.setColorAt(idx, _c);
    }
    this.mesh.instanceColor.needsUpdate = true;
    this.active = CAP;
  }
  update(dt) {
    if (!this.active) return;
    const T = this.ctx.terrain; let any = false, hi = 0;
    for (let i = 0; i < CAP; i++) {
      const d = this.p[i];
      if (!d.on) { if (i < this.mesh.count) { _m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, _m); } continue; }
      d.t += dt;
      if (d.t >= d.life) { d.on = false; _m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, _m); continue; }
      any = true; hi = i + 1;
      d.vy -= 20 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      const gy = Math.max(T.heightAt(d.x, d.z), 0) + d.s * 0.5;
      if (d.y < gy) {
        d.y = gy;
        if (d.bounces < 2 && d.vy < -1.5) { d.vy = -d.vy * 0.38; d.vx *= 0.6; d.vz *= 0.6; d.bounces++; } else { d.vy = 0; d.vx *= 0.8; d.vz *= 0.8; d.wx *= 0.7; d.wy *= 0.7; d.wz *= 0.7; }
      }
      d.rx += d.wx * dt; d.ry += d.wy * dt; d.rz += d.wz * dt;
      const k = d.life - d.t < 0.4 ? (d.life - d.t) / 0.4 : 1;
      _e.set(d.rx, d.ry, d.rz); _q.setFromEuler(_e); _s.setScalar(d.s * k); _p.set(d.x, d.y, d.z);
      _m.compose(_p, _q, _s); this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.count = Math.max(hi, 0);
    this.mesh.instanceMatrix.needsUpdate = true;
    if (!any) { this.active = 0; this.mesh.count = 0; }
  }
  clear() { for (const d of this.p) d.on = false; this.mesh.count = 0; this.active = 0; }
}
