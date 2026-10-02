// 特效：曳光、槍口火光＋點光、彈殼、依材質的彈著、彈孔貼花、採集碎屑、建造煙塵／崩塌碎片、護盾破裂、弱點圓盤、寶箱閃光。
// 全部使用預先配置的池：Points（軟粒子／星芒／圓環）×2、InstancedMesh（碎片、曳光、貼花）；熱路徑零配置。
// 公開 API：puff(p,color,n,speed)（舊介面，world 在用）、tracer(from,to,color)、sparkle(pos,color,n,radius)、
//   burst(pos,color,n,speed,size)、ring(pos,color,s0,s1,life)、debris(...)；debug：fx.hold = true 凍結壽命（驗收截圖用）。
import * as THREE from 'three';

const rnd = Math.random;
const _c = new THREE.Color(), _m4 = new THREE.Matrix4(), _pv = new THREE.Vector3(), _sv = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _q2 = new THREE.Quaternion(), _Z = new THREE.Vector3(0, 0, 1), _N = new THREE.Vector3(), _D = new THREE.Vector3(), _T = new THREE.Vector3();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

// 表面材質顏色
const DIRT = [0xb08a5a, 0x9a7548, 0xc29a68], GRASS = [0x6fbf3f, 0x8fd24f, 0x9a7548], SAND = [0xf0dca0, 0xe4c88a], ROCKC = [0xa9a39a, 0xc2bcb2, 0x8f9aa6];
const WOOD = [0xd9a063, 0xb87a3c, 0xe8bf86], STONEC = [0xa8b4c4, 0x8896aa, 0xc4ccd8], METALC = [0xdfe6ee, 0xaeb8c4, 0x8d99a6];
const pick = (a) => a[(rnd() * a.length) | 0];

const VERT = `attribute vec4 aColor; attribute float aSize; attribute float aRot; attribute float aShape;
uniform float uScale; varying vec4 vC; varying float vRot; varying float vShape;
void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uScale / max(0.3, -mv.z), 0.0, 220.0); vC = aColor; vRot = aRot; vShape = aShape; }`;
const FRAG = `varying vec4 vC; varying float vRot; varying float vShape;
void main(){
  if (vC.a < 0.004) discard;
  vec2 p = (gl_PointCoord - 0.5) * 2.0; p.y = -p.y;
  float cs = cos(vRot), sn = sin(vRot); p = vec2(cs*p.x - sn*p.y, sn*p.x + cs*p.y);
  float r = length(p); if (r > 1.0) discard;
  float a;
  if (vShape < 0.5) a = pow(clamp(1.0 - r, 0.0, 1.0), 1.6);
  else if (vShape < 1.5) {
    float core = exp(-r*r*9.0), ang = atan(p.y, p.x), f = clamp(1.0 - r, 0.0, 1.0);
    a = clamp(core + pow(abs(cos(2.0*ang)), 16.0) * f + 0.5 * pow(abs(cos(2.0*ang + 1.5708)), 40.0) * f, 0.0, 1.5);
  } else if (vShape < 2.5) { float d = (r - 0.8) / 0.13; a = exp(-d*d); }
  else a = pow(clamp(1.0 - r, 0.0, 1.0), 1.15);
  gl_FragColor = vec4(vC.rgb, vC.a * a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// ---- Points 粒子池 ----
class PointPool {
  constructor(max, additive, uScale, order) {
    this.max = max; this.cur = 0; this.alive = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max); this.rot = new Float32Array(max); this.shape = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.age = new Float32Array(max).fill(1e9);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max); this.a0 = new Float32Array(max); this.rgb = new Float32Array(max * 3);
    this.grav = new Float32Array(max); this.drag = new Float32Array(max); this.spin = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    const attr = (name, arr, n) => { const a = new THREE.BufferAttribute(arr, n); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(name, a); return a; };
    this.aPos = attr('position', this.pos, 3); this.aCol = attr('aColor', this.col, 4); this.aSize = attr('aSize', this.size, 1); this.aRot = attr('aRot', this.rot, 1); this.aShape = attr('aShape', this.shape, 1);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: uScale }, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Points(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = order;
  }
  // 粒子：位置、速度、壽命、起訖大小（公尺）、rgb、起始 alpha、形狀(0 軟點 1 星芒 2 圓環 3 實心軟邊)、重力、阻力、旋轉、自轉
  add(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, shape = 0, grav = 0, drag = 0, rot = 0, spin = 0) {
    const i = this.cur; this.cur = (i + 1) % this.max;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z; this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.life[i] = life; this.age[i] = 0; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a;
    this.rgb[i3] = r; this.rgb[i3 + 1] = g; this.rgb[i3 + 2] = b; this.shape[i] = shape; this.grav[i] = grav; this.drag[i] = drag; this.rot[i] = rot; this.spin[i] = spin;
    this.size[i] = s0; const i4 = i * 4; this.col[i4] = r; this.col[i4 + 1] = g; this.col[i4 + 2] = b; this.col[i4 + 3] = a;
    this.dirty = true;
  }
  update(dt) {
    let n = 0;
    for (let i = 0; i < this.max; i++) {
      const age = this.age[i], life = this.life[i];
      if (age >= life) continue;
      n++;
      const na = age + dt, i3 = i * 3, i4 = i * 4;
      this.age[i] = na;
      if (na >= life) { this.col[i4 + 3] = 0; continue; }
      const t = na / life;
      if (dt > 0) {
        const dr = Math.max(0, 1 - this.drag[i] * dt);
        this.vel[i3] *= dr; this.vel[i3 + 1] = this.vel[i3 + 1] * dr - this.grav[i] * dt; this.vel[i3 + 2] *= dr;
        this.pos[i3] += this.vel[i3] * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * dt; this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
        this.rot[i] += this.spin[i] * dt;
      }
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      const k = 1 - t, fa = this.a0[i] * k * Math.min(1, 0.3 + na * 60);
      this.col[i4] = this.rgb[i3]; this.col[i4 + 1] = this.rgb[i3 + 1]; this.col[i4 + 2] = this.rgb[i3 + 2]; this.col[i4 + 3] = fa;
    }
    if (n > 0 || this.alive > 0 || this.dirty) { this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = this.aRot.needsUpdate = this.aShape.needsUpdate = true; }
    this.alive = n; this.dirty = false;
  }
}

// ---- 實例化碎片池（方塊） ----
class DebrisPool {
  constructor(max, geo, mat) {
    this.max = max; this.cur = 0; this.alive = 0;
    this.mesh = new THREE.InstancedMesh(geo, mat, max); this.mesh.frustumCulled = false; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < max; i++) { this.mesh.setMatrixAt(i, ZERO); this.mesh.setColorAt(i, _c.setRGB(1, 1, 1)); }
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3); this.r = new Float32Array(max * 3); this.w = new Float32Array(max * 3); this.s = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.age = new Float32Array(max).fill(1e9); this.grav = new Float32Array(max); this.gy = new Float32Array(max); this.bounce = new Float32Array(max);
  }
  // sx,sy,sz：方塊三軸尺寸；gy：地面高度（-1e9 表示無地面）
  add(x, y, z, vx, vy, vz, life, sx, sy, sz, hex, grav = 14, gy = -1e9, bounce = 0.35, spin = 10, lum = 1) {
    const i = this.cur; this.cur = (i + 1) % this.max; const i3 = i * 3;
    this.p[i3] = x; this.p[i3 + 1] = y; this.p[i3 + 2] = z; this.v[i3] = vx; this.v[i3 + 1] = vy; this.v[i3 + 2] = vz;
    this.r[i3] = rnd() * 6.28; this.r[i3 + 1] = rnd() * 6.28; this.r[i3 + 2] = rnd() * 6.28;
    this.w[i3] = (rnd() - 0.5) * spin; this.w[i3 + 1] = (rnd() - 0.5) * spin; this.w[i3 + 2] = (rnd() - 0.5) * spin;
    this.s[i3] = sx; this.s[i3 + 1] = sy; this.s[i3 + 2] = sz;
    this.life[i] = life; this.age[i] = 0; this.grav[i] = grav; this.gy[i] = gy; this.bounce[i] = bounce;
    _c.setHex(hex); this.mesh.setColorAt(i, _c.multiplyScalar(lum)); this.mesh.instanceColor.needsUpdate = true;
  }
  update(dt) {
    let n = 0;
    for (let i = 0; i < this.max; i++) {
      const age = this.age[i], life = this.life[i];
      if (age >= life) continue;
      n++;
      const na = age + dt, i3 = i * 3; this.age[i] = na;
      if (na >= life) { this.mesh.setMatrixAt(i, ZERO); continue; }
      if (dt > 0) {
        this.v[i3 + 1] -= this.grav[i] * dt;
        this.p[i3] += this.v[i3] * dt; this.p[i3 + 1] += this.v[i3 + 1] * dt; this.p[i3 + 2] += this.v[i3 + 2] * dt;
        if (this.p[i3 + 1] < this.gy[i]) {
          this.p[i3 + 1] = this.gy[i]; this.v[i3 + 1] = Math.abs(this.v[i3 + 1]) * this.bounce[i];
          this.v[i3] *= 0.6; this.v[i3 + 2] *= 0.6; this.w[i3] *= 0.5; this.w[i3 + 1] *= 0.5; this.w[i3 + 2] *= 0.5;
        }
        this.r[i3] += this.w[i3] * dt; this.r[i3 + 1] += this.w[i3 + 1] * dt; this.r[i3 + 2] += this.w[i3 + 2] * dt;
      }
      const t = na / life, sh = t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1;   // 末段縮小消失
      _q.setFromEuler(_e.set(this.r[i3], this.r[i3 + 1], this.r[i3 + 2]));
      _m4.compose(_pv.set(this.p[i3], this.p[i3 + 1], this.p[i3 + 2]), _q, _sv.set(this.s[i3] * sh, this.s[i3 + 1] * sh, this.s[i3 + 2] * sh));
      this.mesh.setMatrixAt(i, _m4);
    }
    if (n > 0 || this.alive > 0) this.mesh.instanceMatrix.needsUpdate = true;
    this.alive = n;
  }
}

function decalTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  r.addColorStop(0, 'rgba(10,10,14,0.95)'); r.addColorStop(0.35, 'rgba(24,22,26,0.85)'); r.addColorStop(0.62, 'rgba(60,52,50,0.38)'); r.addColorStop(1, 'rgba(60,52,50,0)');
  g.fillStyle = r; g.beginPath();
  for (let i = 0; i < 14; i++) { const a = (i / 14) * 6.283, rr = 22 + ((i * 7) % 5) * 2.2; g.lineTo(32 + Math.cos(a) * rr, 32 + Math.sin(a) * rr); }
  g.closePath(); g.fill();
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); g.globalCompositeOperation = 'destination-in';
  const m = g.createRadialGradient(32, 32, 4, 32, 32, 31); m.addColorStop(0, '#fff'); m.addColorStop(0.7, '#fff'); m.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = m; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Fx {
  constructor(ctx) {
    this.ctx = ctx; this.hold = false; this.time = 0;
    const scene = ctx.scene;
    this.uScale = { value: 800 };
    this.soft = new PointPool(220, false, this.uScale, 4);   // 煙塵／水花（一般混合）
    this.glow = new PointPool(320, true, this.uScale, 5);    // 火花／閃光／圓環／星芒（加法混合）
    scene.add(this.soft.mesh, this.glow.mesh);
    this.deb = new DebrisPool(300, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    scene.add(this.deb.mesh);

    // 曳光：InstancedMesh（0..47 一般、48..55 彈道子彈拖尾）
    this.TN = 56; this.PROJ0 = 48;
    this.trM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), this.TN);
    this.trM.frustumCulled = false; this.trM.renderOrder = 6; this.trM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < this.TN; i++) { this.trM.setMatrixAt(i, ZERO); this.trM.setColorAt(i, _c.setRGB(1, 1, 1)); }
    scene.add(this.trM);
    this.tr = []; for (let i = 0; i < 48; i++) this.tr.push({ on: false, s: new THREE.Vector3(), d: new THREE.Vector3(), total: 0, head: 0, speed: 500, len: 6, w: 0.03 });
    this.ti = 0;

    // 彈孔貼花
    this.decalTex = decalTexture();
    this.DN = 48;
    this.decM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.decalTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), this.DN);
    this.decM.frustumCulled = false; this.decM.renderOrder = 3; this.decM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < this.DN; i++) this.decM.setMatrixAt(i, ZERO);
    scene.add(this.decM);
    this.dec = []; for (let i = 0; i < this.DN; i++) this.dec.push({ on: false, age: 0, owner: null, pos: new THREE.Vector3(), q: new THREE.Quaternion(), size: 0.2 });
    this.di = 0; this.decFrame = 0;

    // 弱點圓盤
    this.weakMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 } }, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform float uT; varying vec2 vU;
void main(){ float r = length(vU-0.5)*2.0; if (r>1.0) discard;
  float pulse = 0.5+0.5*sin(uT*7.0);
  float core = smoothstep(0.34,0.26,r);
  float ring = exp(-pow((r-(0.62+0.06*pulse))/0.07,2.0));
  float glow = exp(-r*2.6)*0.55;
  vec3 c = mix(vec3(0.05,0.45,1.0), vec3(0.45,0.85,1.0), clamp(core*1.1+ring*0.4,0.0,1.0));
  gl_FragColor = vec4(c, clamp(core*0.95+ring*0.95+glow*0.55,0.0,1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    });
    this.weakMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), this.weakMat); this.weakMesh.visible = false; this.weakMesh.renderOrder = 7; this.weakMesh.frustumCulled = false;
    scene.add(this.weakMesh);

    // 槍口閃光燈：固定數量、永遠在場景中（用 intensity 控制，避免光源數變動導致 shader 重編）
    this.lights = []; this.li = 0;
    const nl = ctx.quality === 'low' ? 0 : ctx.quality === 'medium' ? 1 : 2;
    for (let i = 0; i < nl; i++) { const l = new THREE.PointLight(0xffb458, 0, 14, 2); l.castShadow = false; scene.add(l); this.lights.push({ l, t: 1, life: 0.07, peak: 0 }); }

    const ev = ctx.events;
    ev.on('shot', (e) => this._onShot(e));
    ev.on('impact', (e) => this._onImpact(e));
    ev.on('harvest', (e) => this._onHarvest(e));
    ev.on('buildPlaced', ({ piece }) => piece && piece.center && this._buildDust(piece));
    ev.on('buildDestroyed', ({ piece }) => piece && piece.center && this._buildBreak(piece));
    ev.on('shieldBreak', (e) => this._shieldBreak(e));
    ev.on('matchState', ({ state }) => { if (state === 'bus') this.clear(); });
  }
  clear() {
    for (const p of [this.soft, this.glow]) { p.age.fill(1e9); p.col.fill(0); p.dirty = true; }
    this.deb.age.fill(1e9); for (let i = 0; i < this.deb.max; i++) this.deb.mesh.setMatrixAt(i, ZERO); this.deb.mesh.instanceMatrix.needsUpdate = true;
    for (const t of this.tr) t.on = false;
    for (let i = 0; i < this.DN; i++) { this.dec[i].on = false; this.decM.setMatrixAt(i, ZERO); } this.decM.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < this.TN; i++) this.trM.setMatrixAt(i, ZERO); this.trM.instanceMatrix.needsUpdate = true;
  }
  _near(p, r) { return this.ctx.camera.position.distanceToSquared(p) < r * r; }
  _gy(x, z) { return Math.max(this.ctx.terrain.heightAt(x, z), 0); }

  // ---------- 舊介面 ----------
  // 煙塵＋碎屑（world 在用：樹倒、岩石碎裂）
  puff(p, color = 0xffffff, n = 6, speed = 3) {
    _c.setHex(color); const gy = this._gy(p.x, p.z);
    this.soft.add(p.x, p.y, p.z, 0, speed * 0.15, 0, 0.55, 0.4, 1.3 + n * 0.05, _c.r, _c.g, _c.b, 0.55, 3, 1.5);
    for (let i = 0; i < n; i++) {
      const s = 0.05 + rnd() * 0.1;
      this.deb.add(p.x, p.y, p.z, (rnd() - 0.5) * speed, rnd() * speed * 0.8, (rnd() - 0.5) * speed, 0.55 + rnd() * 0.3, s, s, s, color, 12, gy, 0.3, 14);
    }
  }
  tracer(from, to, color = 0xfff2b0, len = 6, speed = 520, width = 0.03) {
    const total = from.distanceTo(to); if (total < 0.5) return;
    const i = this.ti++ % this.tr.length, t = this.tr[i];
    t.on = true; t.s.copy(from); t.d.copy(to).sub(from).divideScalar(total); t.total = total; t.head = 0; t.len = len; t.speed = speed;
    t.w = width;
    _c.setHex(color).multiplyScalar(2.2); this.trM.setColorAt(i, _c); this.trM.instanceColor.needsUpdate = true;
  }
  // 圓環（擴散）與一般閃光
  ring(p, color = 0xffffff, s0 = 0.4, s1 = 1.6, life = 0.3, a = 1) { _c.setHex(color); this.glow.add(p.x, p.y, p.z, 0, 0, 0, life, s0, s1, _c.r * 1.5, _c.g * 1.5, _c.b * 1.5, a, 2); }
  flash(p, color = 0xffffff, size = 0.6, life = 0.08, shape = 1) { _c.setHex(color); this.glow.add(p.x, p.y, p.z, 0, 0, 0, life, size, size * 1.15, _c.r * 1.6, _c.g * 1.6, _c.b * 1.6, 1, shape, 0, 0, rnd() * 6.28); }
  // 向四周的火花（加法）
  burst(p, color = 0xffd75a, n = 8, speed = 4, size = 0.08, life = 0.5, grav = 8) {
    _c.setHex(color);
    for (let i = 0; i < n; i++) {
      const th = rnd() * 6.283, ph = Math.acos(2 * rnd() - 1), sp = speed * (0.4 + rnd() * 0.8);
      this.glow.add(p.x, p.y, p.z, Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp, life * (0.6 + rnd() * 0.7), size, size * 0.3, _c.r * 1.8, _c.g * 1.8, _c.b * 1.8, 1, 0, grav, 0.8);
    }
  }
  // 寶箱／稀有物閃光：緩緩上升的小星芒
  sparkle(p, color = 0xffd75a, n = 2, radius = 0.6) {
    _c.setHex(color);
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.283, r = Math.sqrt(rnd()) * radius;
      this.glow.add(p.x + Math.cos(a) * r, p.y + rnd() * 0.5, p.z + Math.sin(a) * r, (rnd() - 0.5) * 0.3, 0.7 + rnd() * 0.9, (rnd() - 0.5) * 0.3, 0.8 + rnd() * 0.7, 0.16 + rnd() * 0.18, 0.03, _c.r * 1.6, _c.g * 1.6, _c.b * 1.6, 1, 1, 0, 0.3, rnd() * 6.28, (rnd() - 0.5) * 4);
    }
  }
  debris(x, y, z, vx, vy, vz, life, sx, sy, sz, hex, grav, gy, bounce, spin) { this.deb.add(x, y, z, vx, vy, vz, life, sx, sy, sz, hex, grav, gy, bounce, spin); }

  // ---------- 事件 ----------
  _onShot({ actor, weapon, from, to, projectile, ends }) {
    const cam = this.ctx.camera.position;
    if (from.distanceToSquared(cam) > 260 * 260 && to.distanceToSquared(cam) > 260 * 260) return;
    const pl = actor.isPlayer;
    const sniper = weapon === 'sniper', pump = weapon === 'pump';
    if (!projectile) {
      const col = pl ? 0xfff0a8 : 0xffc58a, len = weapon === 'smg' || weapon === 'pistol' ? 4.5 : 7;
      if (pump && ends && ends.length > 1) for (let i = 0; i < ends.length; i++) this.tracer(from, ends[i], col, 3.5, 420, 0.022);
      else this.tracer(from, to, col, len, 520, 0.03);
    }
    // 槍口火光：星芒 + 柔光 + 幾點火星
    if (from.distanceToSquared(cam) < 120 * 120) {
      const s = sniper ? 1.7 : pump ? 1.6 : weapon === 'smg' ? 0.85 : 1.05;
      this.glow.add(from.x, from.y, from.z, 0, 0, 0, 0.06, s, s * 0.8, 2.6, 1.9, 0.8, 1, 1, 0, 0, rnd() * 6.28);
      this.glow.add(from.x, from.y, from.z, 0, 0, 0, 0.1, s * 1.3, s * 1.8, 1.8, 1.0, 0.3, 0.8, 0);
      _D.copy(to).sub(from); const dl = _D.length() || 1; _D.divideScalar(dl);
      for (let i = 0; i < 3; i++) { const sp = 9 + rnd() * 7; this.glow.add(from.x, from.y, from.z, _D.x * sp + (rnd() - 0.5) * 3, _D.y * sp + (rnd() - 0.5) * 3, _D.z * sp + (rnd() - 0.5) * 3, 0.1 + rnd() * 0.06, 0.07, 0.02, 2.2, 1.4, 0.5, 1, 0, 0.5); }
      const L = this.lights.length ? this.lights[pl ? 0 : (this.li++ % this.lights.length)] : null;
      if (L && (pl || from.distanceToSquared(cam) < 45 * 45)) { L.l.position.copy(from); L.t = 0; L.peak = (sniper ? 70 : pump ? 60 : 38) * (pl ? 1 : 0.7); L.life = sniper ? 0.1 : 0.07; }
    }
    // 彈殼（步槍／衝鋒槍／手槍）
    if ((weapon === 'ar' || weapon === 'smg' || weapon === 'pistol') && from.distanceToSquared(cam) < 55 * 55) {
      const yw = actor.yaw, rx = Math.cos(yw), rz = -Math.sin(yw), fx = -Math.sin(yw), fz = -Math.cos(yw), sp = 2 + rnd() * 1.5, gy = actor.pos.y;
      this.deb.add(from.x - fx * 0.3, from.y - 0.04, from.z - fz * 0.3, rx * sp + fx * 0.4 + actor.vel.x * 0.5, 2.2 + rnd() * 1.2, rz * sp + fz * 0.4 + actor.vel.z * 0.5, 1.3, 0.016, 0.016, 0.05, 0xe8b04a, 16, gy, 0.35, 40, 1.4);
    }
  }
  _onImpact(e) {
    const p = e.point; if (!p) return;
    const cam = this.ctx.camera.position, d2 = cam.distanceToSquared(p);
    if (d2 > 170 * 170) return;
    const heavy = e.weapon === 'pump' ? 0.4 : 1;   // 霰彈十顆彈丸，每顆減量
    if (e.normal) _N.copy(e.normal); else _N.set(0, 1, 0);
    const s = e.surface, x = p.x, y = p.y, z = p.z;
    if (e.actor) { this._flesh(e, heavy); return; }
    if (e.kind === 'terrain' || s === 'grass' || s === 'sand' || s === 'rock' || s === 'dirt' || s === 'water') this._terrain(e, s, heavy);
    else if (s === 'metal') this._metal(x, y, z, heavy);
    else if (s === 'stone') this._stone(x, y, z, heavy);
    else this._wood(x, y, z, heavy);
    // 貼花：只有建材與場景物件（非地形、非水）
    if (e.weapon !== 'pickaxe' && e.normal && e.kind !== 'terrain' && s !== 'water' && this.decFrame < 5) { this.decFrame++; this._decal(p, e.normal, e.owner, e.weapon); }
  }
  _terrain(e, s, k) {
    const p = e.point, n = _N;
    if (s === 'water') {
      this.soft.add(p.x, p.y + 0.1, p.z, 0, 1.2, 0, 0.5, 0.3, 1.1, 0.9, 0.97, 1, 0.55, 3, 2.5);
      this.glow.add(p.x, p.y + 0.05, p.z, 0, 0, 0, 0.4, 0.3, 1.6, 0.9, 1, 1, 0.8, 2);
      return;
    }
    const pal = s === 'sand' ? SAND : s === 'rock' ? ROCKC : s === 'grass' ? GRASS : DIRT;
    const col = pick(pal); _c.setHex(s === 'grass' ? 0x9a8a5a : col);
    this.soft.add(p.x, p.y + 0.05, p.z, n.x * 0.8, 0.8, n.z * 0.8, 0.65, 0.5, 1.7, _c.r, _c.g, _c.b, 0.6, 3, 1.8);
    const gy = p.y - 0.05, cnt = Math.ceil(4 * k);
    for (let i = 0; i < cnt; i++) { const sz = 0.03 + rnd() * 0.06; this.deb.add(p.x, p.y + 0.03, p.z, n.x * 2 + (rnd() - 0.5) * 3, 2 + rnd() * 2.5, n.z * 2 + (rnd() - 0.5) * 3, 0.5 + rnd() * 0.3, sz, sz, sz, pick(pal), 13, gy, 0.3, 14); }
  }
  _wood(x, y, z, k) {
    _c.setHex(0xe8c898); this.soft.add(x, y, z, 0, 0.5, 0, 0.4, 0.2, 0.7, _c.r, _c.g, _c.b, 0.35, 3, 2);
    const cnt = Math.ceil(5 * k);
    for (let i = 0; i < cnt; i++) this.deb.add(x, y, z, _N.x * 2.5 + (rnd() - 0.5) * 3.5, (rnd() - 0.3) * 3.5, _N.z * 2.5 + (rnd() - 0.5) * 3.5, 0.55, 0.02, 0.02, 0.1 + rnd() * 0.08, pick(WOOD), 11, -1e9, 0, 22);
  }
  _stone(x, y, z, k) {
    _c.setHex(0xc8ced8); this.soft.add(x, y, z, 0, 0.4, 0, 0.45, 0.25, 0.9, _c.r, _c.g, _c.b, 0.4, 3, 2);
    this.glow.add(x, y, z, 0, 0, 0, 0.07, 0.3, 0.2, 1.6, 1.5, 1.3, 1, 0);
    const cnt = Math.ceil(5 * k);
    for (let i = 0; i < cnt; i++) { const sz = 0.025 + rnd() * 0.05; this.deb.add(x, y, z, _N.x * 3 + (rnd() - 0.5) * 4, (rnd() - 0.3) * 4, _N.z * 3 + (rnd() - 0.5) * 4, 0.5, sz, sz, sz, pick(STONEC), 14, -1e9, 0, 16); }
  }
  _metal(x, y, z, k) {
    this.glow.add(x, y, z, 0, 0, 0, 0.06, 0.55, 0.4, 2.4, 1.9, 1.0, 1, 1, 0, 0, rnd() * 6.28);
    const cnt = Math.ceil(7 * k);
    for (let i = 0; i < cnt; i++) {
      const sp = 3 + rnd() * 5;
      this.glow.add(x, y, z, _N.x * sp + (rnd() - 0.5) * 5, (rnd() - 0.2) * 4 + _N.y * sp, _N.z * sp + (rnd() - 0.5) * 5, 0.2 + rnd() * 0.25, 0.07, 0.02, 2.4, 1.5 + rnd() * 0.5, 0.45, 1, 0, 11, 0.5);
    }
    _c.setHex(0xcfd6de); this.soft.add(x, y, z, 0, 0.3, 0, 0.35, 0.15, 0.55, _c.r, _c.g, _c.b, 0.25, 3, 2);
  }
  _flesh(e, k) {
    const p = e.point, shield = e.surface === 'shield', head = e.head;
    if (shield) {
      this.soft.add(p.x, p.y, p.z, 0, 0, 0, 0.3, 0.5, 1.3, 0.1, 0.45, 1.0, 0.7, 3);
      this.glow.add(p.x, p.y, p.z, 0, 0, 0, 0.28, 0.5, 1.5, 0.3, 1.0, 2.6, 1, 2);
      this.glow.add(p.x, p.y, p.z, 0, 0, 0, 0.1, 0.6, 0.8, 0.6, 1.4, 2.4, 1, 1, 0, 0, rnd() * 6.28);
      this.burst(p, 0x4aa8ff, Math.ceil(7 * k), 3.2, 0.07, 0.4, 5);
    } else {
      // 紫白色命中霧
      this.soft.add(p.x, p.y, p.z, 0, 0.2, 0, 0.32, 0.45, 1.25, 0.6, 0.2, 0.95, 0.75, 3);
      this.glow.add(p.x, p.y, p.z, 0, 0.3, 0, 0.22, 0.3, 1.0, 1.5, 0.7, 2.4, 0.9, 0, 0, 1);
      this.glow.add(p.x, p.y, p.z, 0, 0, 0, 0.08, 0.6, 0.8, 2.4, 1.9, 2.6, 1, 1, 0, 0, rnd() * 6.28);
      this.burst(p, 0xc070ff, Math.ceil(6 * k), 3, 0.06, 0.4, 6);
    }
    if (head) { this.glow.add(p.x, p.y, p.z, 0, 0, 0, 0.14, 0.8, 1.3, 2.6, 2.2, 0.6, 1, 1, 0, 0, rnd() * 6.28); this.ring(p, 0xffe14d, 0.3, 1.4, 0.25); }
    if (e.killed) this.burst(p, shield ? 0x8ad0ff : 0xe0a0ff, 6, 4, 0.08, 0.5, 5);
  }
  _decal(p, n, owner, weapon) {
    const i = this.di++ % this.DN, d = this.dec[i];
    d.on = true; d.age = 0; d.owner = owner && owner.kind === 'build' ? owner : null;
    d.pos.copy(p).addScaledVector(n, 0.015);
    _q.setFromUnitVectors(_Z, n); const roll = rnd() * 6.28; _q.multiply(_q2.setFromAxisAngle(_Z, roll)); d.q.copy(_q);
    d.size = weapon === 'sniper' ? 0.34 : weapon === 'pump' ? 0.16 : weapon === 'smg' ? 0.17 : weapon === 'pistol' ? 0.2 : 0.22;
    _m4.compose(d.pos, d.q, _sv.setScalar(d.size)); this.decM.setMatrixAt(i, _m4); this.decM.instanceMatrix.needsUpdate = true;
  }
  _onHarvest(e) {
    const p = e.point; if (!p || !this._near(p, 120)) return;
    const m = e.material, tree = e.owner && e.owner.kind === 'tree';
    const pal = m === 'wood' ? WOOD : m === 'stone' ? STONEC : METALC, gy = this._gy(p.x, p.z);
    const n = e.normal || _N.set(0, 1, 0);
    const cnt = e.weakPoint ? 11 : 6;
    for (let i = 0; i < cnt; i++) {
      const sz = 0.05 + rnd() * 0.07, long = m === 'wood' && rnd() < 0.6;
      this.deb.add(p.x, p.y, p.z, n.x * 2 + (rnd() - 0.5) * 4, 1.5 + rnd() * 3, n.z * 2 + (rnd() - 0.5) * 4, 0.7 + rnd() * 0.3, long ? 0.035 : sz, long ? 0.035 : sz, long ? 0.17 : sz, pick(pal), 12, gy, 0.3, 18);
    }
    if (tree) { const gp = [0x58d44a, 0x7fe05a, 0x3fb04a]; for (let i = 0; i < 5; i++) this.deb.add(p.x, p.y + 1.5 + rnd() * 1.5, p.z, (rnd() - 0.5) * 3, rnd() * 1.5, (rnd() - 0.5) * 3, 1.1, 0.12, 0.02, 0.12, pick(gp), 3, gy, 0, 8); }
    if (m === 'metal') this.burst(p, 0xffc860, 6, 4, 0.06, 0.3, 10);
    if (e.weakPoint) {
      this.glow.add(p.x, p.y, p.z, 0, 0, 0, 0.18, 0.9, 1.7, 0.6, 1.5, 2.5, 1, 1, 0, 0, rnd() * 6.28);
      this.ring(p, 0x6fd8ff, 0.4, 2.2, 0.35); this.burst(p, 0x6fd8ff, 10, 4, 0.07, 0.5, 4);
    }
  }
  _buildDust(piece) {
    const c = piece.center, mat = piece.mat, lvl = piece.type === 'floor' ? 0 : 1.75;
    const by = c.y - lvl, pal = mat === 'metal' ? 0xdfe6ee : mat === 'stone' ? 0xc4ccd8 : 0xeedcb8; _c.setHex(pal);
    if (!this._near(c, 110)) return;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * 6.283 + rnd() * 0.5, r = 1.2 + rnd() * 0.9;
      this.soft.add(c.x + Math.cos(a) * r, by + 0.15, c.z + Math.sin(a) * r, Math.cos(a) * 1.2, 0.5 + rnd() * 0.5, Math.sin(a) * 1.2, 0.7 + rnd() * 0.3, 0.5, 1.7, _c.r, _c.g, _c.b, 0.5, 3, 1.4);
    }
    this.burst(_pv.set(c.x, c.y, c.z), 0x7fd8ff, 6, 3.5, 0.07, 0.45, 2);
    this.ring(_pv.set(c.x, by + 0.1, c.z), 0x9fe4ff, 0.8, 3.4, 0.3, 0.8);
  }
  _buildBreak(piece) {
    const c = piece.center, mat = piece.mat; if (!this._near(c, 150)) return;
    const pal = mat === 'metal' ? METALC : mat === 'stone' ? STONEC : WOOD, gy = this._gy(c.x, c.z);
    for (let i = 0; i < 16; i++) {
      const sz = 0.1 + rnd() * 0.22, lng = mat === 'wood' && rnd() < 0.5;
      this.deb.add(c.x + (rnd() - 0.5) * 3, c.y + (rnd() - 0.5) * 2.5, c.z + (rnd() - 0.5) * 3, (rnd() - 0.5) * 7, 1 + rnd() * 5, (rnd() - 0.5) * 7, 1.5, lng ? 0.08 : sz, sz, lng ? 0.5 : sz, pick(pal), 15, gy, 0.3, 12);
    }
    _c.setHex(mat === 'metal' ? 0xcfd6de : mat === 'stone' ? 0xb8c0cc : 0xdcc9a4);
    for (let i = 0; i < 7; i++) this.soft.add(c.x + (rnd() - 0.5) * 3, c.y + (rnd() - 0.5) * 2, c.z + (rnd() - 0.5) * 3, (rnd() - 0.5) * 2, 0.6 + rnd(), (rnd() - 0.5) * 2, 0.9 + rnd() * 0.4, 1.2, 3.4, _c.r, _c.g, _c.b, 0.5, 3, 1.2);
    if (mat === 'metal') this.burst(_pv.set(c.x, c.y, c.z), 0xffc860, 8, 5, 0.07, 0.4, 10);
  }
  _shieldBreak({ actor }) {
    if (!actor || !this._near(actor.pos, 140)) return;
    const x = actor.pos.x, y = actor.pos.y + 1.0, z = actor.pos.z, gy = this._gy(x, z);
    _pv.set(x, y, z);
    this.ring(_pv, 0x6cc8ff, 0.9, 3.8, 0.4); this.ring(_pv, 0xffffff, 0.5, 2.4, 0.25);
    this.glow.add(x, y, z, 0, 0, 0, 0.16, 1.2, 2.2, 0.7, 1.5, 2.6, 1, 1, 0, 0, rnd() * 6.28);
    this.burst(_pv, 0x4aa8ff, 14, 6, 0.09, 0.55, 3);
    for (let i = 0; i < 10; i++) { const th = rnd() * 6.283, sp = 2 + rnd() * 3; this.deb.add(x, y + (rnd() - 0.5) * 0.8, z, Math.cos(th) * sp, 1 + rnd() * 3, Math.sin(th) * sp, 0.9, 0.09, 0.09, 0.02, 0x8ad8ff, 9, gy, 0.2, 14, 1.6); }
  }

  // ---------- 每幀 ----------
  update(dt) {
    const step = this.hold ? 0 : dt;
    this.time += step; this.decFrame = 0;
    const cam = this.ctx.camera;
    this.uScale.value = this.ctx.renderer.domElement.height / (2 * Math.tan(cam.fov * Math.PI / 360));
    this.soft.update(step); this.glow.update(step); this.deb.update(step);
    // 曳光
    let dirty = false;
    for (let i = 0; i < this.tr.length; i++) {
      const t = this.tr[i]; if (!t.on) continue;
      t.head += t.speed * step;
      const tail = t.head - t.len;
      if (tail >= t.total) { t.on = false; this.trM.setMatrixAt(i, ZERO); dirty = true; continue; }
      const h = Math.min(t.head, t.total), tl = Math.max(0, tail), L = h - tl;
      _q.setFromUnitVectors(_Z, t.d);
      _pv.copy(t.s).addScaledVector(t.d, (h + tl) * 0.5);
      const w = Math.max(t.w, cam.position.distanceTo(_pv) * 0.0032);   // 讓遠處曳光在螢幕上仍有約 2 px 寬
      _m4.compose(_pv, _q, _sv.set(w, w, Math.max(0.05, L)));
      this.trM.setMatrixAt(i, _m4); dirty = true;
    }
    // 彈道子彈拖尾
    const projs = this.ctx.combat && this.ctx.combat.projectiles;
    if (projs) for (let k = 0; k < 8; k++) {
      const p = projs[k], i = this.PROJ0 + k;
      if (p && p.active && p.travel > 1) {
        _D.copy(p.vel).normalize(); const L = Math.min(18, p.travel + 1);
        _q.setFromUnitVectors(_Z, _D);
        _pv.copy(p.pos).addScaledVector(_D, -L * 0.5); const w = Math.max(0.07, cam.position.distanceTo(_pv) * 0.0036);
        _m4.compose(_pv, _q, _sv.set(w, w, L));
        this.trM.setMatrixAt(i, _m4); _c.setRGB(2.4, 2.0, 1.2); this.trM.setColorAt(i, _c); this.trM.instanceColor.needsUpdate = true; p._shown = true; dirty = true;
      } else if (p && p._shown) { p._shown = false; this.trM.setMatrixAt(i, ZERO); dirty = true; }
    }
    if (dirty) this.trM.instanceMatrix.needsUpdate = true;
    // 貼花淡出
    let dd = false;
    for (let i = 0; i < this.DN; i++) {
      const d = this.dec[i]; if (!d.on) continue;
      d.age += step;
      if (d.age > 24 || (d.owner && d.owner.dead)) { d.on = false; this.decM.setMatrixAt(i, ZERO); dd = true; continue; }
      if (d.age > 20) { _m4.compose(d.pos, d.q, _sv.setScalar(d.size * (1 - (d.age - 20) / 4))); this.decM.setMatrixAt(i, _m4); dd = true; }
    }
    if (dd) this.decM.instanceMatrix.needsUpdate = true;
    // 槍口光
    for (const L of this.lights) { if (L.t < 1) { L.t += step / L.life; L.l.intensity = L.peak * Math.max(0, 1 - L.t); } else L.l.intensity = 0; }
    // 弱點圓盤
    const wk = this.ctx.combat && this.ctx.combat.weakPoint;
    if (wk && wk.active) {
      const m = this.weakMesh; m.visible = true;
      _q.setFromUnitVectors(_Z, wk.normal); m.quaternion.copy(_q);
      m.position.copy(wk.point).addScaledVector(wk.normal, 0.04);
      this.weakMat.uniforms.uT.value = this.time; const sc = 0.9 + 0.1 * Math.sin(this.time * 7); m.scale.setScalar(sc);
    } else this.weakMesh.visible = false;
  }
}
