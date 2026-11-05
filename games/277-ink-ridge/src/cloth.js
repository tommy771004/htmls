// Verlet 布料：格點粒子＋距離約束＋球體碰撞。固定點每步重新貼到骨架上的錨點。
// ring=true 時左右兩欄相連成筒（衣襬）。
import * as THREE from 'three';

export class Cloth {
  /**
   * @param {number} cols
   * @param {number} rows
   * @param {(c:number, r:number) => THREE.Vector3} rest 初始位置（世界座標）
   * @param {(c:number, out:THREE.Vector3) => void} anchor 第 0 列的錨點（世界座標），每步呼叫
   */
  constructor({ cols, rows, ring = false, rest, anchor, material, damping = 0.985, bend = true, stretch = 1.0 }) {
    this.cols = cols; this.rows = rows; this.ring = ring; this.anchor = anchor; this.damping = damping; this.rest = rest;
    this.gScale = 1; this.upDrag = 1; this.maxRise = Infinity; // 往上衝的阻尼、最高可高過錨點多少
    const n = cols * rows;
    this.p = new Float32Array(n * 3); this.q = new Float32Array(n * 3);
    this.spheres = [];
    this.floorY = -Infinity;
    this.wind = new THREE.Vector3();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const v = rest(c, r), i = (r * cols + c) * 3;
      this.p[i] = this.q[i] = v.x; this.p[i + 1] = this.q[i + 1] = v.y; this.p[i + 2] = this.q[i + 2] = v.z;
    }
    const con = [];
    const idx = (c, r) => r * cols + ((c + cols) % cols);
    const add = (a, b, k = 1) => {
      const ax = this.p[a * 3] - this.p[b * 3], ay = this.p[a * 3 + 1] - this.p[b * 3 + 1], az = this.p[a * 3 + 2] - this.p[b * 3 + 2];
      con.push(a, b, Math.hypot(ax, ay, az) * stretch, k);
    };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (c + 1 < cols || ring) add(idx(c, r), idx(c + 1, r));
      if (r + 1 < rows) add(idx(c, r), idx(c, r + 1));
      if (r + 1 < rows && (c + 1 < cols || ring)) { add(idx(c, r), idx(c + 1, r + 1), 0.5); add(idx(c + 1, r), idx(c, r + 1), 0.5); }
      if (bend && r + 2 < rows) add(idx(c, r), idx(c, r + 2), 0.35);
    }
    this.con = new Float32Array(con);
    // 網格
    const g = new THREE.BufferGeometry();
    const vc = ring ? cols + 1 : cols;
    this.vc = vc;
    const pos = new Float32Array(vc * rows * 3), uv = new Float32Array(vc * rows * 2);
    const ind = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < vc; c++) {
      uv[(r * vc + c) * 2] = c / (vc - 1); uv[(r * vc + c) * 2 + 1] = 1 - r / (rows - 1);
      if (r + 1 < rows && c + 1 < vc) { const a = r * vc + c, b = a + 1, d = a + vc, e = d + 1; ind.push(a, d, b, b, d, e); }
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(ind);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this._a = new THREE.Vector3();
    this.sync();
  }

  /** 重新鋪回初始形狀（換模型、身體比例變了的時候） */
  reset() {
    const { cols, rows, p, q } = this;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const v = this.rest(c, r), i = (r * cols + c) * 3;
      p[i] = q[i] = v.x; p[i + 1] = q[i + 1] = v.y; p[i + 2] = q[i + 2] = v.z;
    }
  }

  /** 把整塊布瞬移（重生、傳送） */
  shift(dx, dy, dz) {
    for (let i = 0; i < this.p.length; i += 3) { this.p[i] += dx; this.q[i] += dx; this.p[i + 1] += dy; this.q[i + 1] += dy; this.p[i + 2] += dz; this.q[i + 2] += dz; }
  }

  step(dt, gravity = -9.8) {
    const { p, q, cols, rows, con } = this;
    const d = this.damping, g2 = gravity * this.gScale * dt * dt, ud = this.upDrag;
    const wx = this.wind.x * dt * dt, wy = this.wind.y * dt * dt, wz = this.wind.z * dt * dt;
    const a = this._a;
    for (let c = 0; c < cols; c++) { this.anchor(c, a); const i = c * 3; p[i] = q[i] = a.x; p[i + 1] = q[i + 1] = a.y; p[i + 2] = q[i + 2] = a.z; }
    for (let i = cols * 3; i < p.length; i += 3) {
      const vx = (p[i] - q[i]) * d, vz = (p[i + 2] - q[i + 2]) * d;
      let vy = (p[i + 1] - q[i + 1]) * d; if (vy > 0) vy *= ud;
      q[i] = p[i]; q[i + 1] = p[i + 1]; q[i + 2] = p[i + 2];
      const flut = 0.6 + 0.8 * ((i * 0.618) % 1);
      p[i] += vx + wx * flut; p[i + 1] += vy + g2 + wy * flut; p[i + 2] += vz + wz * flut;
    }
    for (let it = 0; it < 5; it++) {
      for (let k = 0; k < con.length; k += 4) {
        const A = con[k] * 3, Bi = con[k + 1] * 3, rest = con[k + 2], s = con[k + 3];
        const dx = p[Bi] - p[A], dy = p[Bi + 1] - p[A + 1], dz = p[Bi + 2] - p[A + 2];
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const diff = ((len - rest) / len) * s;
        const pa = A < cols * 3, pb = Bi < cols * 3;
        if (pa && pb) continue;
        const wa = pa ? 0 : pb ? 1 : 0.5, wb = pb ? 0 : pa ? 1 : 0.5;
        p[A] += dx * diff * wa; p[A + 1] += dy * diff * wa; p[A + 2] += dz * diff * wa;
        p[Bi] -= dx * diff * wb; p[Bi + 1] -= dy * diff * wb; p[Bi + 2] -= dz * diff * wb;
      }
      for (const sp of this.spheres) {
        const r2 = sp.r * sp.r;
        for (let i = cols * 3; i < p.length; i += 3) {
          const dx = p[i] - sp.c.x, dy = p[i + 1] - sp.c.y, dz = p[i + 2] - sp.c.z;
          const l2 = dx * dx + dy * dy + dz * dz;
          if (l2 < r2 && l2 > 1e-10) { const l = Math.sqrt(l2), k2 = sp.r / l; p[i] = sp.c.x + dx * k2; p[i + 1] = sp.c.y + dy * k2; p[i + 2] = sp.c.z + dz * k2; }
        }
      }
    }
    if (this.maxRise < Infinity) {
      let top = -Infinity; for (let c = 0; c < cols; c++) top = Math.max(top, p[c * 3 + 1]);
      const lim = top + this.maxRise;
      for (let i = cols * 3 + 1; i < p.length; i += 3) if (p[i] > lim) { p[i] = lim; if (q[i] > lim) q[i] = lim; }
    }
    if (this.floorY > -1e8) for (let i = cols * 3 + 1; i < p.length; i += 3) if (p[i] < this.floorY) { p[i] = this.floorY; q[i] = this.floorY; }
    void rows;
  }

  sync() {
    const pos = this.geo.attributes.position.array, { p, cols, rows, vc } = this;
    for (let r = 0; r < rows; r++) for (let c = 0; c < vc; c++) {
      const s = (r * cols + (c % cols)) * 3, o = (r * vc + c) * 3;
      pos[o] = p[s]; pos[o + 1] = p[s + 1]; pos[o + 2] = p[s + 2];
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
  }
}
