// 粒子：加速噴射、撞球火花、落地塵、進球爆炸、擊毀碎片。兩組 Points（加亮與一般混色）共用同一套池。
import * as THREE from 'three';

class Pool {
  constructor(scene, n, additive) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n);
    this.grow = new Float32Array(n);
    this.drag = new Float32Array(n);
    this.grav = new Float32Array(n);
    this.next = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 400 } },
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA;
        uniform float uScale;
        void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = size * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA;
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d,d)*4.0; if (r > 1.0) discard;
          float a = vA * (1.0 - r) * (1.0 - r); gl_FragColor = vec4(vC, a); }`,
    });
    this.mat = m;
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 4 : 3;
    scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, r, g, b, size, life, opts = {}) {
    const i = this.next; this.next = (this.next + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
    this.size[i] = size; this.life[i] = life; this.max[i] = life;
    this.grow[i] = opts.grow ?? 0; this.drag[i] = opts.drag ?? 1.5; this.grav[i] = opts.grav ?? 0;
    this.alpha[i] = opts.alpha ?? 1;
    this.a0 = this.a0 || new Float32Array(this.n);
    this.a0[i] = opts.alpha ?? 1;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { if (this.alpha[i] !== 0) { this.alpha[i] = 0; this.size[i] = 0; } continue; }
      this.life[i] -= dt;
      const k = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt; this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.02 && this.grav[i] > 0) { this.pos[i * 3 + 1] = 0.02; this.vel[i * 3 + 1] *= -0.3; }
      this.size[i] += this.grow[i] * dt;
      const t = Math.max(0, this.life[i] / this.max[i]);
      this.alpha[i] = this.a0[i] * Math.min(1, t * 2.5);
    }
    for (const k of ['position', 'color', 'size', 'alpha']) this.geo.attributes[k].needsUpdate = true;
  }
}

export class FX {
  constructor(scene) {
    this.add = new Pool(scene, 2400, true);
    this.norm = new Pool(scene, 1600, false);
    this.rings = [];
    this.scene = scene;
    this.ringGeo = new THREE.SphereGeometry(1, 32, 16);
  }
  setScale(h, fovY) { const s = h / (2 * Math.tan(fovY / 2)); this.add.mat.uniforms.uScale.value = s; this.norm.mat.uniforms.uScale.value = s; }

  // 加速噴射：每幀從噴嘴往後噴
  boost(pos, back, carVel, team, supersonic) {
    const r = Math.random;
    for (let i = 0; i < 2; i++) {
      const s = 3 + r() * 3;
      this.add.emit(pos.x + (r() - 0.5) * 0.08, pos.y + (r() - 0.5) * 0.08, pos.z + (r() - 0.5) * 0.08,
        carVel.x * 0.6 + back.x * s + (r() - 0.5), carVel.y * 0.6 + back.y * s + (r() - 0.5), carVel.z * 0.6 + back.z * s + (r() - 0.5),
        1.0, 0.55 + r() * 0.2, 0.18, 0.13 + r() * 0.09, 0.16 + r() * 0.08, { drag: 3, grow: -0.5, alpha: 0.75 });
    }
    if (r() < 0.6) this.norm.emit(pos.x, pos.y, pos.z, carVel.x * 0.4 + back.x * 2, carVel.y * 0.4 + back.y * 2 + 0.3, carVel.z * 0.4 + back.z * 2,
      0.42, 0.4, 0.38, 0.22, 0.6 + r() * 0.4, { drag: 2, grow: 1.1, alpha: 0.22 });
    if (supersonic) {
      const c = team === 0 ? [0.95, 0.93, 0.88] : [1, 0.66, 0.24];
      this.add.emit(pos.x, pos.y + 0.1, pos.z, carVel.x * 0.9, carVel.y * 0.9, carVel.z * 0.9, c[0], c[1], c[2], 0.16, 0.35, { drag: 6, alpha: 0.7 });
    }
  }
  hit(p, power) {
    const n = Math.min(40, 6 + power * 1.2), r = Math.random;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, b = (r() - 0.3) * Math.PI, s = 2 + r() * power * 0.35;
      this.add.emit(p.x, p.y, p.z, Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s, Math.sin(a) * Math.cos(b) * s, 1, 0.9, 0.7, 0.12 + r() * 0.1, 0.3 + r() * 0.3, { drag: 2, grav: 6 });
    }
  }
  dust(p, n = 12) {
    const r = Math.random;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, s = 1 + r() * 2.5;
      this.norm.emit(p.x, 0.15, p.z, Math.cos(a) * s, 0.4 + r(), Math.sin(a) * s, 0.55, 0.52, 0.48, 0.5, 0.8 + r() * 0.5, { drag: 2.5, grow: 1.6, alpha: 0.4 });
    }
  }
  pad(p, big) {
    const r = Math.random, n = big ? 40 : 10;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, s = 1 + r() * (big ? 4 : 2);
      this.add.emit(p.x, (big ? 1 : 0.15) + r() * 0.3, p.z, Math.cos(a) * s, 1 + r() * 3, Math.sin(a) * s, 1, 0.68, 0.25, big ? 0.3 : 0.18, 0.5 + r() * 0.4, { drag: 2, grav: 4 });
    }
  }
  // 進球爆炸：白堊隊是粉白的石灰塵與白色火花，煤煙隊是黑煙與琥珀色火星
  goal(p, team) {
    const r = Math.random, soot = team === 1;
    for (let i = 0; i < 480; i++) {
      const a = r() * Math.PI * 2, b = (r() - 0.25) * Math.PI * 0.9, s = 6 + r() * 26;
      const w = r();
      const c = soot ? [1, 0.55 + w * 0.3, 0.15 + w * 0.2] : [0.92 + w * 0.08, 0.9 + w * 0.08, 0.84 + w * 0.12];
      this.add.emit(p.x, p.y, p.z, Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s, Math.sin(a) * Math.cos(b) * s,
        c[0], c[1], c[2], 0.2 + r() * 0.45, 0.8 + r() * 1.4, { drag: 1.6, grav: 3 });
    }
    const smoke = soot ? [0.07, 0.065, 0.06] : [0.86, 0.84, 0.8];
    for (let i = 0; i < (soot ? 260 : 180); i++) {
      const a = r() * Math.PI * 2, s = 3 + r() * 10;
      this.norm.emit(p.x, p.y, p.z, Math.cos(a) * s, (r() - 0.3) * 7, Math.sin(a) * s, smoke[0], smoke[1], smoke[2], 1.4, 1.8 + r() * 1.8, { drag: 1.2, grow: 3.2, alpha: soot ? 0.75 : 0.55 });
    }
    const m = soot
      ? new THREE.MeshBasicMaterial({ color: '#141210', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide })
      : new THREE.MeshBasicMaterial({ color: '#f1ece2', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(this.ringGeo, m);
    ring.position.copy(p);
    this.scene.add(ring);
    this.rings.push({ mesh: ring, t: 0, max: 0.9, size: 18, a0: m.opacity });
  }
  demo(p, color) {
    const r = Math.random;
    for (let i = 0; i < 160; i++) {
      const a = r() * Math.PI * 2, b = (r() - 0.2) * Math.PI, s = 3 + r() * 12;
      this.add.emit(p.x, p.y, p.z, Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s, Math.sin(a) * Math.cos(b) * s, color.r, color.g, color.b, 0.2 + r() * 0.3, 0.6 + r(), { drag: 1.5, grav: 6 });
    }
    for (let i = 0; i < 40; i++) this.norm.emit(p.x, p.y, p.z, (r() - 0.5) * 6, r() * 4, (r() - 0.5) * 6, 0.2, 0.19, 0.18, 1, 1.5 + r(), { drag: 1.5, grow: 2, alpha: 0.6 });
  }
  update(dt) {
    this.add.update(dt); this.norm.update(dt);
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      const k = r.t / r.max;
      r.mesh.scale.setScalar(0.5 + r.size * (1 - Math.pow(1 - k, 3)));
      r.mesh.material.opacity = r.a0 * (1 - k);
      if (k >= 1) { this.scene.remove(r.mesh); r.mesh.material.dispose(); this.rings.splice(i, 1); }
    }
  }
}
