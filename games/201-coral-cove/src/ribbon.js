// 釣線：每格固定像素寬、面向鏡頭的細帶（CPU 每幀更新固定大小的緩衝，不重建幾何）。
import * as THREE from 'three';

const t = new THREE.Vector3(), v = new THREE.Vector3(), s = new THREE.Vector3();
export class Ribbon {
  constructor(n, color, opacity = 1) {
    this.n = n;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 2 * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.mesh.visible = false;
  }
  // pts: Vector3 陣列（長度 n）；px：線寬（像素）
  update(pts, camera, px, viewH) {
    const k = (2 * Math.tan((camera.fov * Math.PI) / 360)) / viewH;
    for (let i = 0; i < this.n; i++) {
      const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(this.n - 1, i + 1)];
      t.subVectors(b, a).normalize();
      v.subVectors(camera.position, p);
      const dist = v.length();
      s.crossVectors(t, v).normalize().multiplyScalar(0.5 * px * k * dist);
      this.pos.set([p.x + s.x, p.y + s.y, p.z + s.z, p.x - s.x, p.y - s.y, p.z - s.z], i * 6);
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
}
