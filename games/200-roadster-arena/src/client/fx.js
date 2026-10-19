// 特效：煙霧（看向鏡頭的實例化方片，CPU 模擬）、地上的火焰胎痕（帶狀網格）、火花。
import {
  InstancedBufferGeometry, InstancedBufferAttribute, PlaneGeometry, Mesh, ShaderMaterial, Color, Vector3, BufferGeometry,
  Float32BufferAttribute, DynamicDrawUsage, AdditiveBlending, NormalBlending, MeshBasicMaterial, DoubleSide,
} from 'three';
import { canvasTex } from './parkview.js';

const smokeTex = () => canvasTex(128, 128, (x, w, h) => {
  const img = x.createImageData(w, h), d = img.data;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const dx = (i - 64) / 64, dy = (j - 64) / 64, r = Math.hypot(dx, dy);
    let n = 0, f = 1, a = 0.5;
    for (let o = 0; o < 4; o++) { n += a * (Math.sin(i * 0.11 * f + Math.sin(j * 0.07 * f) * 2) * Math.cos(j * 0.09 * f + i * 0.03 * f) * 0.5 + 0.5); f *= 2.1; a *= 0.5; }
    const al = Math.max(0, 1 - r) ** 1.6 * (0.55 + 0.45 * n);
    const k = (j * w + i) * 4;
    d[k] = d[k + 1] = d[k + 2] = 255; d[k + 3] = Math.min(255, al * 255);
  }
  x.putImageData(img, 0, 0);
}, { srgb: false });

export class Smoke {
  constructor(scene, max = 1600) {
    this.max = max;
    const base = new PlaneGeometry(1, 1);
    const g = this.geo = new InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute('position', base.attributes.position);
    g.setAttribute('uv', base.attributes.uv);
    this.aPos = new InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(DynamicDrawUsage);
    this.aSz = new InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(DynamicDrawUsage); // size, alpha, rot
    this.aCol = new InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(DynamicDrawUsage);
    g.setAttribute('iPos', this.aPos); g.setAttribute('iSz', this.aSz); g.setAttribute('iCol', this.aCol);
    g.instanceCount = 0;
    this.mat = new ShaderMaterial({
      transparent: true, depthWrite: false, blending: NormalBlending,
      uniforms: { map: { value: smokeTex() } },
      vertexShader: `attribute vec3 iPos; attribute vec3 iSz; attribute vec3 iCol; varying vec2 vUv; varying float vA; varying vec3 vC;
        void main(){
          vec4 mv = viewMatrix * vec4(iPos, 1.0);
          float c = cos(iSz.z), s = sin(iSz.z);
          vec2 p = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * iSz.x;
          mv.xy += p;
          vUv = uv; vA = iSz.y; vC = iCol;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vA; varying vec3 vC;
        void main(){ float a = texture2D(map, vUv).a * vA; if (a < 0.004) discard; gl_FragColor = vec4(vC, a); }`,
    });
    this.mesh = new Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.age = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max); this.a0 = new Float32Array(max);
    this.rot = new Float32Array(max); this.vr = new Float32Array(max); this.col = new Float32Array(max * 3);
    this.n = 0;
  }

  // 位置、速度、壽命、起始／結束大小、不透明度、亮度（線性）
  emit(x, y, z, vx, vy, vz, life, s0, s1, a, bright = 0.55, warm = 0) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.p.set([x, y, z], i * 3); this.v.set([vx, vy, vz], i * 3);
    this.life[i] = life; this.age[i] = 0; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a;
    this.rot[i] = Math.random() * 6.28; this.vr[i] = (Math.random() - 0.5) * 0.8;
    this.col.set([bright * (1 + warm * 0.3), bright * (1 + warm * 0.05), bright * (1 - warm * 0.2)], i * 3);
  }

  update(dt) {
    let n = this.n;
    const P = this.p, V = this.v;
    for (let i = 0; i < n; i++) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        n--;
        if (i !== n) {
          for (const arr of [this.life, this.age, this.s0, this.s1, this.a0, this.rot, this.vr]) arr[i] = arr[n];
          for (const arr of [P, V, this.col]) { arr[i * 3] = arr[n * 3]; arr[i * 3 + 1] = arr[n * 3 + 1]; arr[i * 3 + 2] = arr[n * 3 + 2]; }
        }
        i--;
        continue;
      }
      const drag = Math.exp(-dt * 1.6);
      V[i * 3] *= drag; V[i * 3 + 1] = V[i * 3 + 1] * drag + dt * 0.5; V[i * 3 + 2] *= drag;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
      if (P[i * 3 + 1] < 0.3) P[i * 3 + 1] = 0.3;
      this.rot[i] += this.vr[i] * dt;
    }
    this.n = n;
    const pos = this.aPos.array, sz = this.aSz.array, col = this.aCol.array;
    for (let i = 0; i < n; i++) {
      const t = this.age[i] / this.life[i];
      pos[i * 3] = P[i * 3]; pos[i * 3 + 1] = P[i * 3 + 1]; pos[i * 3 + 2] = P[i * 3 + 2];
      sz[i * 3] = this.s0[i] + (this.s1[i] - this.s0[i]) * Math.sqrt(t);
      sz[i * 3 + 1] = this.a0[i] * Math.min(1, t * 8) * (1 - t) * (1 - t);
      sz[i * 3 + 2] = this.rot[i];
      col[i * 3] = this.col[i * 3]; col[i * 3 + 1] = this.col[i * 3 + 1]; col[i * 3 + 2] = this.col[i * 3 + 2];
    }
    this.geo.instanceCount = n;
    this.aPos.needsUpdate = this.aSz.needsUpdate = this.aCol.needsUpdate = true;
  }
}

// 地上的火焰胎痕：每輪一條，點每 0.03 秒丟一個，1.4 秒淡出
export class FireTrail {
  constructor(scene, max = 120) {
    this.max = max;
    this.pts = [];
    const g = this.geo = new BufferGeometry();
    this.pos = new Float32Array(max * 2 * 3); this.al = new Float32Array(max * 2);
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3).setUsage(DynamicDrawUsage));
    g.setAttribute('alpha', new Float32BufferAttribute(this.al, 1).setUsage(DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < max - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    this.mesh = new Mesh(g, new ShaderMaterial({
      transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying float vA; void main(){ vec3 c = mix(vec3(1.4, 0.25, 0.04), vec3(3.2, 1.6, 0.45), vA * vA); gl_FragColor = vec4(c * vA, 1.0); }',
    }));
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.acc = 0;
  }
  // on：這一幀是否在噴；p：輪胎著地點；side：側向單位向量
  update(dt, on, p, side, width = 0.3) {
    this.acc += dt;
    for (const q of this.pts) q.age += dt;
    while (this.pts.length && this.pts[0].age > 1.4) this.pts.shift();
    if (on && this.acc > 0.025) {
      this.acc = 0;
      this.pts.push({ x: p.x, y: p.y + 0.04, z: p.z, sx: side.x * width, sz: side.z * width, age: 0, gap: false });
      if (this.pts.length > this.max) this.pts.shift();
    } else if (!on && this.pts.length && !this.pts[this.pts.length - 1].gap) {
      this.pts[this.pts.length - 1].gap = true;
    }
    const n = this.pts.length;
    for (let i = 0; i < this.max; i++) {
      const q = this.pts[Math.min(i, n - 1)];
      if (!q) { this.al[i * 2] = this.al[i * 2 + 1] = 0; continue; }
      this.pos.set([q.x - q.sx, q.y, q.z - q.sz, q.x + q.sx, q.y, q.z + q.sz], i * 6);
      const a = i < n ? Math.max(0, 1 - q.age / 1.4) : 0;
      const gapCut = i > 0 && this.pts[i - 1] && this.pts[i - 1].gap ? 0 : 1;
      this.al[i * 2] = this.al[i * 2 + 1] = a * gapCut;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.alpha.needsUpdate = true;
  }
}
