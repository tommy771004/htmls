// 風暴（SPEC §11）：階段表、縮圈、風暴牆（紫色雲霧著色器）、貼地發光邊緣、下一圈預覽、圈外每秒扣血、畫面色調與閃電。
import * as THREE from 'three';
import { lerp, damp, smoothstep } from './shared.js';

// [等待, 縮圈, 結束半徑, 每秒傷害]
const PHASES = [null, [70, 55, 300, 1], [50, 50, 170, 2], [45, 45, 95, 5], [30, 30, 50, 8], [25, 25, 22, 10], [15, 40, 0, 15]];
const WALL_BOTTOM = -30, WALL_H = 600, RING_N = 200;

const NOISE = `
float hash31(vec3 p){ p = fract(p*0.3183099 + vec3(0.71,0.113,0.419)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x), mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x), mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y), f.z); }
float fbm3(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++) { s += a*vn(p); p = p*2.03 + vec3(5.2,1.3,3.7); a *= 0.5; } return s/0.875; }
`;

const WALL_VS = 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
const WALL_FS = `uniform float uTime, uR; uniform vec3 uDeep, uMid, uHot; varying vec3 vP;
${NOISE}
void main(){
  vec2 xz = vP.xz * uR; float y = vP.y;
  float ang = atan(vP.x, vP.z);
  // 雲霧：緩慢旋轉上升的低頻噪聲
  float sw = uTime*0.035;
  vec2 rxz = vec2(xz.x*cos(sw)-xz.y*sin(sw), xz.x*sin(sw)+xz.y*cos(sw));
  float cl = fbm3(vec3(rxz*0.011, y*0.0075) + vec3(0.0, -uTime*0.07, uTime*0.02));
  // 垂直條紋：水平方向高頻、垂直方向極長
  float st = fbm3(vec3(xz*0.09, y*0.0035 - uTime*0.33));
  float st2 = vn(vec3(xz*0.31, y*0.012 - uTime*0.9));
  float streak = smoothstep(0.5, 0.92, st) * (0.55 + 0.45*st2);
  float g = exp(-max(y,0.0)*0.045);              // 地面發光
  float g2 = exp(-max(y,0.0)*0.012);
  float top = 1.0 - smoothstep(330.0, 560.0, y);
  vec3 col = mix(uDeep, uMid, smoothstep(0.2, 0.85, cl));
  col += uHot * streak * 0.55 + uHot * g * 1.1 + uMid * g2 * 0.35;
  float a = (0.34 + 0.46*cl + 0.34*streak + 0.5*g + 0.18*g2) * mix(0.55, 1.0, top);
  // 細小閃爍的電光
  float spark = smoothstep(0.93, 1.0, vn(vec3(xz*0.5, y*0.05 + uTime*2.0))) * 0.5;
  col += vec3(1.0,0.8,1.0)*spark; a += spark*0.4;
  gl_FragColor = vec4(col, clamp(a, 0.0, 0.94));
  #include <colorspace_fragment>
}`;
const PREVIEW_FS = `uniform float uTime; uniform vec3 uCol; varying vec3 vP;
void main(){
  float ang = atan(vP.x, vP.z);
  float dash = 0.5 + 0.5*sin(ang*90.0 + uTime*0.8);
  float h = vP.y;
  float a = (0.10 + 0.18*dash) * (1.0 - smoothstep(10.0, 150.0, h)) + exp(-max(h,0.0)*0.1)*0.35;
  gl_FragColor = vec4(uCol, a);
  #include <colorspace_fragment>
}`;
const RING_VS = 'attribute float aU; varying float vU; void main(){ vU = aU; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
const RING_FS = `uniform float uTime, uStr; uniform vec3 uCol; varying float vU;
void main(){
  float d = abs(vU - 0.5) * 2.0;
  float core = exp(-d*d*7.0), halo = exp(-d*2.2)*0.35;
  float pulse = 0.82 + 0.18*sin(uTime*4.0);
  gl_FragColor = vec4(mix(uCol, vec3(1.0), core*0.7), (core + halo) * pulse * uStr);
  #include <colorspace_fragment>
}`;

export class Storm {
  constructor(ctx) {
    this.ctx = ctx;
    this.center = new THREE.Vector2(0, 0); this.radius = 600;
    this.next = { center: new THREE.Vector2(0, 0), radius: 600 };
    this.from = { center: new THREE.Vector2(), radius: 600 };
    this.phase = 0; this.state = 'idle'; this.timeLeft = 0; this.active = false; this.dmg = 1; this.tick = 0;
    this.inside = true; this.tint = 0; this.phaseCount = 6; this.lightningT = 6; this.t = 0; this.camOutside = 0;
    this.group = new THREE.Group(); ctx.scene.add(this.group);
    // 風暴牆
    const wallGeo = new THREE.CylinderGeometry(1, 1, WALL_H, 128, 1, true).translate(0, WALL_BOTTOM + WALL_H / 2, 0);
    this.wallMat = new THREE.ShaderMaterial({
      transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false,
      uniforms: { uTime: { value: 0 }, uR: { value: 600 }, uDeep: { value: new THREE.Color('#4a14a8') }, uMid: { value: new THREE.Color('#b13cff') }, uHot: { value: new THREE.Color('#ff9bff') } },
      vertexShader: WALL_VS, fragmentShader: WALL_FS,
    });
    this.wall = new THREE.Mesh(wallGeo, this.wallMat);
    this.wall.frustumCulled = false; this.wall.renderOrder = 5; this.group.add(this.wall);
    // 下一圈預覽（白色虛線光牆）
    const pGeo = new THREE.CylinderGeometry(1, 1, 160, 128, 1, true).translate(0, 70, 0);
    this.prevMat = new THREE.ShaderMaterial({
      transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: this.wallMat.uniforms.uTime, uCol: { value: new THREE.Color('#ffffff') } }, vertexShader: WALL_VS, fragmentShader: PREVIEW_FS,
    });
    this.preview = new THREE.Mesh(pGeo, this.prevMat); this.preview.frustumCulled = false; this.preview.renderOrder = 6; this.preview.visible = false; this.group.add(this.preview);
    // 貼地發光環
    this.ringA = this._ring('#ff6bff', 9, 1.0);
    this.ringB = this._ring('#ffffff', 3.2, 0.9); this.ringB.mesh.visible = false;
    this.wall.visible = false; this.ringA.mesh.visible = false;
    this._ringFrame = 0;
  }
  _ring(color, width, str) {
    const idx = [];
    // 三排頂點（內、中、外）
    const p3 = new Float32Array((RING_N + 1) * 3 * 3), u3 = new Float32Array((RING_N + 1) * 3);
    for (let i = 0; i <= RING_N; i++) { u3[i * 3] = 0; u3[i * 3 + 1] = 0.5; u3[i * 3 + 2] = 1; }
    for (let i = 0; i < RING_N; i++) { const a = i * 3, b = (i + 1) * 3; idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p3, 3)); g.setAttribute('aU', new THREE.BufferAttribute(u3, 1)); g.setIndex(idx);
    const m = new THREE.ShaderMaterial({
      transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uTime: this.wallMat ? this.wallMat.uniforms.uTime : { value: 0 }, uCol: { value: new THREE.Color(color) }, uStr: { value: str } }, vertexShader: RING_VS, fragmentShader: RING_FS,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 7; this.group.add(mesh);
    return { mesh, pos: p3, width };
  }
  _fillRing(r, cx, cz, rad) {
    const T = this.ctx.terrain, p = r.pos, w = r.width;
    for (let i = 0; i <= RING_N; i++) {
      const a = (i / RING_N) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const x = cx + c * rad, z = cz + s * rad, y = Math.max(T.heightAt(x, z), 0) + 0.5, k = i * 9;
      p[k] = cx + c * Math.max(0, rad - w); p[k + 1] = y; p[k + 2] = cz + s * Math.max(0, rad - w);
      p[k + 3] = x; p[k + 4] = y; p[k + 5] = z;
      p[k + 6] = cx + c * (rad + w); p[k + 7] = y; p[k + 8] = cz + s * (rad + w);
    }
    r.mesh.geometry.attributes.position.needsUpdate = true;
  }
  reset() {
    this.center.set(0, 0); this.radius = 600; this.phase = 0; this.state = 'idle'; this.active = false; this.timeLeft = 0; this.dmg = 1; this.tick = 0;
    this.next.center.set(0, 0); this.next.radius = 600; this.tint = 0; this.lightningT = 6; this.inside = true;
    this.wall.visible = false; this.preview.visible = false; this.ringA.mesh.visible = false; this.ringB.mesh.visible = false;
    if (this.ctx.render) this.ctx.render.stormTint = 0;
  }
  start() { if (this.active) return; this.active = true; this._begin(1); }
  _begin(n) {
    this.phase = n; const P = PHASES[n]; this.dmg = P[3];
    this.from.center.copy(this.center); this.from.radius = this.radius;
    // 新圈圓心：落在目前圈內，盡量在陸地上
    const rng = this.ctx.rng, R = P[2];
    let best = null;
    for (let i = 0; i < 24; i++) {
      const a = rng() * Math.PI * 2, d = Math.max(0, this.radius - R) * Math.sqrt(rng());
      const x = this.center.x + Math.cos(a) * d, z = this.center.y + Math.sin(a) * d;
      const h = this.ctx.terrain.heightAt(x, z);
      if (h > 1 || i === 23) { best = [x, z]; break; }
    }
    this.next.center.set(best[0], best[1]); this.next.radius = R;
    this.state = 'waiting'; this.timeLeft = P[0];
    this._ringDirty = true;
    this.ctx.events.emit('stormPhase', { phase: n, state: 'waiting', endsAt: this.ctx.time.now + P[0] });
  }
  isOutside(x, z) { return Math.hypot(x - this.center.x, z - this.center.y) > this.radius; }
  distToSafe(x, z) { return Math.max(0, Math.hypot(x - this.center.x, z - this.center.y) - this.radius); }
  // 縮圈進度 0..1（等待中為 0）
  shrinkProgress() { const P = PHASES[this.phase]; return this.state === 'shrinking' && P ? 1 - Math.max(0, this.timeLeft) / P[1] : this.state === 'final' ? 1 : 0; }
  skip() { if (!this.active) return; this.timeLeft = 0.001; this.fixedUpdate(0.002); }
  setPhase(n) {
    if (!this.active) { this.active = true; }
    n = Math.max(1, Math.min(6, n | 0));
    const prev = PHASES[n - 1];
    this.radius = prev ? prev[2] : 600; this.center.set(this.center.x, this.center.y);
    this._begin(n);
  }
  fixedUpdate(dt) {
    if (!this.active) return;
    const P = PHASES[this.phase];
    this.timeLeft -= dt;
    if (this.state === 'waiting') {
      if (this.timeLeft <= 0) {
        this.state = 'shrinking'; this.timeLeft = P[1];
        this.ctx.events.emit('stormPhase', { phase: this.phase, state: 'shrinking', endsAt: this.ctx.time.now + P[1] });
      }
    } else if (this.state === 'shrinking') {
      const f = 1 - Math.max(0, this.timeLeft) / P[1];
      this.radius = lerp(this.from.radius, this.next.radius, f);
      this.center.lerpVectors(this.from.center, this.next.center, f);
      if (this.timeLeft <= 0) { this.radius = this.next.radius; this.center.copy(this.next.center); if (this.phase < 6) this._begin(this.phase + 1); else { this.state = 'final'; this.timeLeft = 0; } }
    }
    // 對戰已分出勝負：停止扣血（否則冠軍會在勝利畫面背後被風暴淘汰）
    if (this.ctx.match && this.ctx.match.over) return;
    // 圈外每秒扣血一次（只扣血，不扣盾）
    this.tick += dt;
    if (this.tick >= 1) {
      this.tick -= 1;
      for (const a of this.ctx.actors) {
        if (!a.alive || a.state === 'bus') continue;
        if (this.isOutside(a.pos.x, a.pos.z)) a.takeDamage(this.dmg, { ignoreShield: true, storm: true });
      }
    }
  }
  update(dt) {
    this.t += dt; const U = this.wallMat.uniforms; U.uTime.value = this.t;
    const c = this.ctx, on = this.active && this.radius < 590;
    this.wall.visible = on;
    if (on) {
      const r = Math.max(0.5, this.radius);
      U.uR.value = r; this.wall.scale.set(r, 1, r); this.wall.position.set(this.center.x, 0, this.center.y);
      // 貼地環：半徑改變時才重算（約每 3 幀）
      this._ringFrame++;
      if (this.state === 'shrinking' ? this._ringFrame % 3 === 0 : this._ringDirty || this._ringFrame % 30 === 0) { this._fillRing(this.ringA, this.center.x, this.center.y, r); }
      this.ringA.mesh.visible = true;
    } else this.ringA.mesh.visible = false;
    const showNext = this.active && (this.state === 'waiting' || this.state === 'shrinking') && this.next.radius > 0.5;
    this.preview.visible = showNext; this.ringB.mesh.visible = showNext;
    if (showNext) {
      const r = this.next.radius; this.preview.scale.set(r, 1, r); this.preview.position.set(this.next.center.x, 0, this.next.center.y);
      if (this._ringDirty || this._ringFrame % 45 === 0) { this._fillRing(this.ringB, this.next.center.x, this.next.center.y, r); }
    }
    this._ringDirty = false;
    const p = c.player;
    this.inside = !p || !this.active || !this.isOutside(p.pos.x, p.pos.z);
    // 畫面色調：依鏡頭是否在風暴內（平滑），交給 render.stormTint
    const cam = c.camera.position;
    const d = this.active ? Math.hypot(cam.x - this.center.x, cam.z - this.center.y) - this.radius : -999;
    const target = this.active && c.match.state !== 'menu' ? smoothstep(-4, 22, d) : 0;
    this.tint = damp(this.tint, target, 3.5, Math.max(dt, 1e-4));
    if (this.tint < 0.002) this.tint = 0;
    if (c.render) c.render.stormTint = this.tint;
    // 閃電：在風暴中隨機
    if (this.tint > 0.6) {
      this.lightningT -= dt;
      if (this.lightningT <= 0) {
        this.lightningT = 4 + Math.random() * 7;
        if (c.render && c.render.flash) c.render.flash(0xd9b8ff, 0.9);
        c.events.emit('lightning', { strength: 1 });
      }
    }
  }
}
