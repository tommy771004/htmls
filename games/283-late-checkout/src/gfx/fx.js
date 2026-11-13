// 戰鬥特效：彈孔貼花、彈殼、曳光彈、塵煙與火花、槍口火光與瞬間點光源、腳下陰影、空氣中的塵埃。全部走物件池。
import * as THREE from 'three';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _n = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1), _c = new THREE.Color();
const PVS = `attribute vec4 aCol; attribute float aSize; varying vec4 vCol; uniform float uScale;
void main(){ vCol = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / max(0.05, -mv.z); gl_Position = projectionMatrix * mv; }`;
const PFS = `varying vec4 vCol; uniform sampler2D tMap; void main(){ vec4 t = texture2D(tMap, gl_PointCoord); gl_FragColor = vec4(vCol.rgb, vCol.a * t.a); }`;

class Particles {
  constructor(n, tex, additive) {
    this.n = n; this.i = 0; this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 4); this.size = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n).fill(1); this.s0 = new Float32Array(n); this.s1 = new Float32Array(n); this.a0 = new Float32Array(n); this.grav = new Float32Array(n); this.drag = new Float32Array(n);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4)); g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({ vertexShader: PVS, fragmentShader: PFS, uniforms: { tMap: { value: tex }, uScale: { value: 600 } }, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.mesh = new THREE.Points(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = additive ? 9 : 8;
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, grav, drag) {
    const i = this.i; this.i = (i + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.max[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a; this.grav[i] = grav; this.drag[i] = drag; this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.size[i] = 0; continue; }
      this.life[i] -= dt; const t = 1 - Math.max(0, this.life[i]) / this.max[i], k = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt; this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.01) { this.pos[i * 3 + 1] = 0.01; this.vel[i * 3 + 1] *= -0.3; }
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t; this.col[i * 4 + 3] = this.a0[i] * (1 - t) * (1 - t);
    }
    const g = this.mesh.geometry; g.attributes.position.needsUpdate = true; g.attributes.aCol.needsUpdate = true; g.attributes.aSize.needsUpdate = true;
  }
}

export class FX {
  constructor(scene, Tx, lights) {
    this.scene = scene; this.lights = lights; this.onTink = null;
    // 彈孔
    this.NH = 320; this.hi = 0; this.howner = new Int16Array(320).fill(-1); // 每個彈孔打在哪件家具上（家具壞了要一起消失）
    this.holes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: Tx.hole, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), this.NH);
    this.holes.frustumCulled = false; this.holes.renderOrder = 2; _m.makeScale(0, 0, 0); for (let i = 0; i < this.NH; i++) this.holes.setMatrixAt(i, _m); scene.add(this.holes);
    // 粒子
    this.dust = new Particles(420, Tx.smoke, false); this.spark = new Particles(260, Tx.soft, true); scene.add(this.dust.mesh, this.spark.mesh);
    // 曳光彈
    this.NT = 40; this.tr = Array.from({ length: this.NT }, () => ({ t: 0, ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: 0, len: 0, d: 0 }));
    this.tpos = new Float32Array(this.NT * 6); this.tcol = new Float32Array(this.NT * 6); const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(this.tpos, 3)); tg.setAttribute('color', new THREE.BufferAttribute(this.tcol, 3));
    this.tracers = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); this.tracers.frustumCulled = false; this.tracers.renderOrder = 9; scene.add(this.tracers); this.ti = 0;
    // 彈殼
    this.NS = 48; this.si = 0; this.sh = Array.from({ length: this.NS }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), b: 0 }));
    this.shells = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0048, 0.0052, 0.03, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), this.NS); this.shells.frustumCulled = false; this.shells.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.NS * 3).fill(0.4), 3);
    _m.makeScale(0, 0, 0); for (let i = 0; i < this.NS; i++) this.shells.setMatrixAt(i, _m); scene.add(this.shells);
    // 槍口火光（給 bot）與瞬間點光源
    this.flashes = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: Tx.flash, color: new THREE.Color(3, 2.2, 1.3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.visible = false; m.renderOrder = 9; m.userData.t = 0; scene.add(m); return m; }); this.fi = 0;
    this.pl = Array.from({ length: 3 }, () => { const l = new THREE.PointLight(0xffb469, 0, 11, 2); l.userData.t = 0; scene.add(l); return l; }); this.pli = 0;
    // 腳下陰影
    this.NB = 10; this.blobs = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: Tx.blob, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), this.NB); this.blobs.frustumCulled = false; this.blobs.renderOrder = 1; scene.add(this.blobs);
    // 空氣中的塵埃（跟著相機循環）
    const NM = 220, mp = new Float32Array(NM * 3), ms = new Float32Array(NM); for (let i = 0; i < NM; i++) { mp[i * 3] = Math.random() * 10; mp[i * 3 + 1] = Math.random() * 3.2; mp[i * 3 + 2] = Math.random() * 10; ms[i] = Math.random(); }
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mp, 3)); mg.setAttribute('aSeed', new THREE.BufferAttribute(ms, 1));
    this.motes = new THREE.Points(mg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uCam: { value: new THREE.Vector3() }, uFwd: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color(0.3, 0.2, 0.1) }, uTorch: { value: 0 }, uScale: { value: 600 }, tMap: { value: Tx.soft } },
      vertexShader: `attribute float aSeed; uniform float uT; uniform vec3 uCam; uniform vec3 uFwd; uniform float uTorch; uniform float uScale; varying float vA;
        void main(){ vec3 p = position + vec3(sin(uT * 0.21 + aSeed * 40.0) * 0.4 + uT * 0.05, sin(uT * 0.13 + aSeed * 17.0) * 0.3 - uT * 0.012, cos(uT * 0.17 + aSeed * 29.0) * 0.4);
          p.xz = mod(p.xz - uCam.xz + 5.0, 10.0) - 5.0 + uCam.xz; p.y = mod(p.y, 3.2) + 0.05;
          vec3 d = p - uCam; float dist = length(d); float cone = smoothstep(0.9, 0.985, dot(d / dist, uFwd));
          vA = (0.25 + cone * uTorch * 2.2) * smoothstep(0.3, 1.2, dist) * smoothstep(5.0, 3.0, dist);
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = (0.012 + aSeed * 0.016) * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: 'varying float vA; uniform vec3 uCol; uniform sampler2D tMap; void main(){ gl_FragColor = vec4(uCol, vA * texture2D(tMap, gl_PointCoord).a); }' }));
    this.motes.frustumCulled = false; this.motes.renderOrder = 7; scene.add(this.motes);
    this.pc = new THREE.Color();
  }
  hole(x, y, z, nx, ny, nz, size = 0.1, owner = -1) {
    _n.set(nx, ny, nz); _q.setFromUnitVectors(Z, _n); _q2.setFromAxisAngle(Z, Math.random() * 6.28); _q.multiply(_q2); const s = size * (0.75 + Math.random() * 0.5);
    _m.compose(_p.set(x + nx * 0.004, y + ny * 0.004, z + nz * 0.004), _q, _s.set(s, s, 1)); this.holes.setMatrixAt(this.hi, _m); this.howner[this.hi] = owner; this.hi = (this.hi + 1) % this.NH; this.holes.instanceMatrix.needsUpdate = true;
  }
  dropHoles(owner) { _m.makeScale(0, 0, 0); for (let i = 0; i < this.NH; i++) if (this.howner[i] === owner) { this.howner[i] = -1; this.holes.setMatrixAt(i, _m); } this.holes.instanceMatrix.needsUpdate = true; }
  // 燈被打中：玻璃碎片與電火花；dead 時多一團煙
  lampBurst(x, y, z, dead) {
    const R = Math.random;
    for (let i = 0; i < (dead ? 16 : 8); i++) { const a = R() * 6.28, sp = 1 + R() * 3.5; this.spark.emit(x, y, z, Math.cos(a) * sp, 0.5 + R() * 2.5, Math.sin(a) * sp, 0.25 + R() * 0.5, 0.04, 0.008, 5, 3.2, 1.2, 1, 9, 1.2); }
    for (let i = 0; i < 6; i++) this.dust.emit(x, y, z, (R() - 0.5) * 2.4, R() * 1.5, (R() - 0.5) * 2.4, 0.5 + R() * 0.5, 0.025, 0.012, 0.75, 0.8, 0.85, 1, 9, 0.5);
    if (dead) for (let i = 0; i < 4; i++) this.dust.emit(x, y, z, (R() - 0.5) * 0.5, 0.3 + R() * 0.4, (R() - 0.5) * 0.5, 1.2 + R() * 0.8, 0.1, 0.5 + R() * 0.3, 0.2, 0.19, 0.18, 0.4, -0.2, 1.2);
  }
  // 家具垮掉時揚起的灰塵
  breakBurst(b, h) {
    const R = Math.random, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, c = this.lights.probe(cx, Math.min(1.2, h * 0.5) + 0.2, cz, this.pc), l = Math.min(1.1, 0.2 + (c.r + c.g + c.b) * 0.9);
    for (let i = 0; i < 22; i++) { const x = b.x0 + R() * (b.x1 - b.x0), z = b.z0 + R() * (b.z1 - b.z0), dx = x - cx, dz = z - cz; this.dust.emit(x, 0.1 + R() * h * 0.8, z, dx * 1.6 + (R() - 0.5), 0.2 + R() * 0.9, dz * 1.6 + (R() - 0.5), 1.1 + R() * 1.3, 0.25, 1.0 + R() * 0.9, 0.5 * l, 0.45 * l, 0.38 * l, 0.42, 0.15, 1.6); }
    for (let i = 0; i < 14; i++) { const a = R() * 6.28, sp = 1.5 + R() * 3; this.dust.emit(cx, h * 0.5, cz, Math.cos(a) * sp, 1 + R() * 2.5, Math.sin(a) * sp, 0.6 + R() * 0.5, 0.035, 0.02, 0.4 * l, 0.3 * l, 0.2 * l, 1, 9, 0.5); }
  }
  // 命中反應。kind：sim 給的命中物種類
  impact(x, y, z, nx, ny, nz, kind, floorKind, owner = -1) {
    const c = this.lights.probe(x + nx * 0.1, y + ny * 0.1, z + nz * 0.1, this.pc), l = Math.min(1.2, 0.25 + (c.r + c.g + c.b) * 0.9), R = Math.random;
    if (kind === 'body') { for (let i = 0; i < 6; i++) this.dust.emit(x, y, z, nx * 1.2 + (R() - 0.5) * 1.6, 0.4 + R() * 1.2, nz * 1.2 + (R() - 0.5) * 1.6, 0.35 + R() * 0.25, 0.05, 0.22, 0.22 * l, 0.012 * l, 0.01 * l, 0.75, 5, 3); return; }
    if (kind === 'none') return;
    if (kind === 'lamp') return; // 由 lampBurst 處理
    let dc = [0.62, 0.58, 0.5], sparks = 0, n = 7, size = 0.1;
    if (kind === 'floor') { if (floorKind === 'marble') { sparks = 4; dc = [0.7, 0.68, 0.62]; } else if (floorKind === 'wood' || floorKind === 'parquet') dc = [0.42, 0.3, 0.2]; else { dc = [0.3, 0.14, 0.12]; size = 0.07; } }
    else if (kind === 'glass') { dc = [0.8, 0.86, 0.9]; sparks = 3; size = 0.16; }
    else if (kind === 'cabinet' || kind === 'cart' || kind === 'hcart' || kind === 'stool') { sparks = 7; n = 3; dc = [0.4, 0.4, 0.4]; }
    else if (kind === 'sofa' || kind === 'armchair' || kind === 'bed' || kind === 'sheet' || kind === 'booth') { dc = [0.75, 0.72, 0.66]; size = 0.07; n = 9; }
    else if (kind !== 'wall' && kind !== 'ceil' && kind !== 'bath' && kind !== 'column' && kind !== 'balcony') dc = [0.4, 0.27, 0.17];
    this.hole(x, y, z, nx, ny, nz, size, owner);
    for (let i = 0; i < n; i++) { const sp = 0.6 + R() * 1.8; this.dust.emit(x, y, z, nx * sp + (R() - 0.5) * 1.3, ny * sp + (R() - 0.5) * 1.3 + 0.3, nz * sp + (R() - 0.5) * 1.3, 0.5 + R() * 0.7, 0.06, 0.4 + R() * 0.35, dc[0] * l, dc[1] * l, dc[2] * l, 0.5, 0.6, 2.6); }
    for (let i = 0; i < 4; i++) { const sp = 2 + R() * 3; this.dust.emit(x, y, z, nx * sp + (R() - 0.5) * 3, ny * sp + (R() - 0.5) * 3 + 1, nz * sp + (R() - 0.5) * 3, 0.5 + R() * 0.4, 0.03, 0.02, dc[0] * l * 0.8, dc[1] * l * 0.8, dc[2] * l * 0.8, 1, 9, 0.6); }
    for (let i = 0; i < sparks; i++) { const sp = 3 + R() * 5; this.spark.emit(x, y, z, nx * sp + (R() - 0.5) * 4, ny * sp + (R() - 0.5) * 4 + 1, nz * sp + (R() - 0.5) * 4, 0.12 + R() * 0.25, 0.035, 0.008, 4, 2.2, 0.8, 1, 9, 1); }
  }
  tracer(ox, oy, oz, hx, hy, hz) {
    const d = Math.hypot(hx - ox, hy - oy, hz - oz); if (d < 2.5) return; const t = this.tr[this.ti]; this.ti = (this.ti + 1) % this.NT;
    t.ox = ox; t.oy = oy; t.oz = oz; t.dx = (hx - ox) / d; t.dy = (hy - oy) / d; t.dz = (hz - oz) / d; t.len = d; t.d = 1.5; t.t = 1;
  }
  shell(p, right, up, fwd, lum) {
    const s = this.sh[this.si]; s.life = 5; s.p.copy(p); s.v.copy(right).multiplyScalar(1.6 + Math.random() * 0.9).addScaledVector(up, 1.4 + Math.random() * 0.8).addScaledVector(fwd, -0.3 + Math.random() * 0.6);
    s.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); s.w.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30); s.b = 0;
    const l = Math.max(0.12, Math.min(1, lum)); this.shells.setColorAt(this.si, _c.setRGB(0.95 * l, 0.68 * l, 0.26 * l)); this.shells.instanceColor.needsUpdate = true; this.si = (this.si + 1) % this.NS;
  }
  flash(pos, scale, withLight) {
    const m = this.flashes[this.fi]; this.fi = (this.fi + 1) % this.flashes.length; m.position.copy(pos); m.scale.setScalar(scale * (0.8 + Math.random() * 0.5)); m.userData.roll = Math.random() * 6.28; m.visible = true; m.userData.t = 0.05;
    if (withLight) this.light(pos, 14);
  }
  light(pos, I) { const l = this.pl[this.pli]; this.pli = (this.pli + 1) % this.pl.length; l.position.copy(pos); l.intensity = I; l.userData.t = 0.055; }
  update(dt, camera, soldiers, time, torch) {
    this.dust.update(dt); this.spark.update(dt);
    const scale = camera.userData.pxScale || 600; this.dust.mat.uniforms.uScale.value = scale; this.spark.mat.uniforms.uScale.value = scale;
    // 曳光
    for (let i = 0; i < this.NT; i++) {
      const t = this.tr[i], o = i * 6;
      if (t.t <= 0) { for (let k = 0; k < 6; k++) this.tpos[o + k] = 0; continue; }
      t.d += dt * 260; const a = Math.min(t.d, t.len), b = Math.max(0, a - 7);
      this.tpos[o] = t.ox + t.dx * b; this.tpos[o + 1] = t.oy + t.dy * b; this.tpos[o + 2] = t.oz + t.dz * b; this.tpos[o + 3] = t.ox + t.dx * a; this.tpos[o + 4] = t.oy + t.dy * a; this.tpos[o + 5] = t.oz + t.dz * a;
      this.tcol[o] = 0.3; this.tcol[o + 1] = 0.18; this.tcol[o + 2] = 0.06; this.tcol[o + 3] = 3.5; this.tcol[o + 4] = 2.4; this.tcol[o + 5] = 1.1;
      if (b >= t.len - 0.01) t.t = 0;
    }
    this.tracers.geometry.attributes.position.needsUpdate = true; this.tracers.geometry.attributes.color.needsUpdate = true;
    // 彈殼
    for (let i = 0; i < this.NS; i++) {
      const s = this.sh[i]; if (s.life <= 0) continue; s.life -= dt;
      if (s.b < 3) { s.v.y -= 9.8 * dt; s.p.addScaledVector(s.v, dt); s.r.x += s.w.x * dt; s.r.y += s.w.y * dt; s.r.z += s.w.z * dt;
        if (s.p.y < 0.012) { s.p.y = 0.012; s.b++; s.v.y *= -0.38; s.v.x *= 0.55; s.v.z *= 0.55; s.w.multiplyScalar(0.5); if (s.b === 1 && this.onTink) this.onTink(s.p); if (s.b >= 3) { s.r.x = Math.PI / 2; s.r.z = 0; } } }
      const k = s.life < 0.5 ? s.life * 2 : 1; _m.compose(s.p, _q.setFromEuler(s.r), _s.set(k, k, k)); this.shells.setMatrixAt(i, _m);
    }
    this.shells.instanceMatrix.needsUpdate = true;
    for (const m of this.flashes) { if (!m.visible) continue; m.userData.t -= dt; if (m.userData.t <= 0) m.visible = false; else { m.quaternion.copy(camera.quaternion); m.rotateZ(m.userData.roll); } }
    for (const l of this.pl) { if (l.intensity <= 0) continue; l.userData.t -= dt; if (l.userData.t <= 0) l.intensity = 0; }
    // 腳下陰影
    let bi = 0;
    for (const s of soldiers) { if (!s.group.visible) continue; const e = s.e, k = e.alive ? 1 : 1.5; _m.compose(s.rag ? _p.set(s.torso.position.x, 0.012, s.torso.position.z) : _p.set(e.x, 0.012, e.z), _q.identity(), _s.set(0.95 * k, 1, 0.95 * k)); this.blobs.setMatrixAt(bi++, _m); }
    this.blobs.count = bi; this.blobs.instanceMatrix.needsUpdate = true;
    const u = this.motes.material.uniforms; u.uT.value = time; u.uCam.value.copy(camera.position); camera.getWorldDirection(u.uFwd.value); u.uTorch.value = torch ? 1 : 0; u.uScale.value = scale;
    this.lights.probe(camera.position.x, camera.position.y, camera.position.z, this.pc); u.uCol.value.lerp(_c.setRGB(0.04 + this.pc.r * 0.5, 0.035 + this.pc.g * 0.5, 0.03 + this.pc.b * 0.5), 0.1);
  }
  clear() { this.howner.fill(-1); _m.makeScale(0, 0, 0); for (let i = 0; i < this.NH; i++) this.holes.setMatrixAt(i, _m); this.holes.instanceMatrix.needsUpdate = true; for (const s of this.sh) s.life = 0; for (let i = 0; i < this.NS; i++) this.shells.setMatrixAt(i, _m); }
}
