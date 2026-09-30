// 粒子特效：雪板噴雪、落地/摔倒/撞擊雪塵、旗門閃光、攝影機周圍飄雪。
import * as THREE from 'three';
import { config } from './config.js';
import { clamp } from './shared.js';

const LOCAL_DEFAULTS = config.effects; // 預設值唯一來源是 config.js（這裡不再重複寫數值）

const VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute float aTint;
uniform float uScale;
uniform float uNearFade;
uniform float uMaxSize;
varying float vAlpha;
varying float vTint;
#include <fog_pars_vertex>
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float dz = -mvPosition.z;
  vAlpha = aAlpha * smoothstep(uNearFade * 0.35, uNearFade, dz);
  vTint = aTint;
  gl_PointSize = aAlpha > 0.0 ? clamp(aSize * uScale / max(dz, 0.01), 1.0, uMaxSize) : 0.0;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uGold;
varying float vAlpha;
varying float vTint;
#include <fog_pars_fragment>
void main() {
  vec2 c = gl_PointCoord - 0.5;
  vec3 col;
  float a;
  if (vTint > 0.5) {
    // 旗門閃光：硬邊菱形，四個三角面不同亮度（低多邊形「刻面」感，不是柔邊光斑）
    float dd = (abs(c.x) + abs(c.y)) * 2.0;
    a = (1.0 - smoothstep(0.86, 1.0, dd)) * vAlpha;
    if (a < 0.01) discard;
    float facet = (c.x < 0.0 ? 0.0 : 1.0) + (c.y < 0.0 ? 0.0 : 2.0); // 0..3
    col = uGold * (0.78 + 0.1 * facet);
  } else {
    float d = length(c) * 2.0;
    a = (1.0 - smoothstep(0.35, 1.0, d)) * vAlpha;
    if (a < 0.01) discard;
    // 上亮下暗一點，讓白雪背景上也看得到
    col = mix(uColorA, uColorB, clamp(0.5 + c.y * 1.4 + d * 0.3, 0.0, 1.0));
  }
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

function makeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uScale: { value: 400 },
        uMaxSize: { value: 64 },
        uNearFade: { value: 1.6 },
        uColorA: { value: new THREE.Color(0xffffff) },
        uColorB: { value: new THREE.Color(0xb9cfe8) },
        uGold: { value: new THREE.Color(0xffd35a) },
      },
    ]),
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    fog: true,
  });
}

const _v2 = new THREE.Vector2();
const _camDir = new THREE.Vector3();
const _camPos = new THREE.Vector3();

function rand(a, b) {
  return a + Math.random() * (b - a);
}

export class Effects {
  // terrain（可省略，之後用 setTerrain 補）：提供 heightAt(x, z)，粒子會停在雪面上
  constructor(scene, cfg = config, terrain = null) {
    const C = (this.C = { ...LOCAL_DEFAULTS, ...((cfg && cfg.effects) || {}) });
    this.scene = scene;
    this.terrain = terrain;

    // --- 噴雪粒子池（ring buffer）---
    // 粒子總數上限 = maxParticles（噴雪池 + 飄雪合計；SPEC 粒子 ≤ 1500）
    const N = (this.N = Math.max(64, (C.maxParticles | 0) - Math.max(0, C.ambientFlakes | 0)));
    this.pos = new Float32Array(N * 3);
    this.vel = new Float32Array(N * 3);
    this.size = new Float32Array(N);
    this.alpha = new Float32Array(N);
    this.tint = new Float32Array(N);
    this.life = new Float32Array(N);    // 剩餘壽命
    this.maxLife = new Float32Array(N);
    this.size0 = new Float32Array(N);
    this.alpha0 = new Float32Array(N);
    this.grav = new Float32Array(N);    // 每顆重力倍率
    this.settled = new Uint8Array(N);   // 已停在雪面上
    this.head = 0;
    this.high = 0;
    this.emitAcc = 0;
    this.lastVx = 0;
    this.lastVy = 0;
    this.lastVz = 0;

    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    this.aTint = new THREE.BufferAttribute(this.tint, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos);
    geo.setAttribute('aSize', this.aSize);
    geo.setAttribute('aAlpha', this.aAlpha);
    geo.setAttribute('aTint', this.aTint);
    geo.setDrawRange(0, 0);
    this.material = makeMaterial();
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    this.points.name = 'snowSpray';
    this.points.onBeforeRender = this._onBeforeRender.bind(this);
    scene.add(this.points);

    // --- 飄雪 ---
    const F = (this.F = Math.max(0, C.ambientFlakes | 0));
    this.fPos = new Float32Array(Math.max(1, F) * 3);
    this.fVel = new Float32Array(Math.max(1, F) * 3);
    this.fPhase = new Float32Array(Math.max(1, F));
    const fSize = new Float32Array(Math.max(1, F));
    const fAlpha = new Float32Array(Math.max(1, F));
    const fTint = new Float32Array(Math.max(1, F));
    for (let i = 0; i < F; i++) {
      fSize[i] = rand(C.flakeSize[0], C.flakeSize[1]);
      fAlpha[i] = C.flakeAlpha * rand(0.55, 1);
      this.fVel[i * 3] = rand(-0.25, 0.25);
      this.fVel[i * 3 + 1] = -rand(C.flakeFall[0], C.flakeFall[1]);
      this.fVel[i * 3 + 2] = rand(-0.25, 0.25);
      this.fPhase[i] = Math.random() * Math.PI * 2;
    }
    const fgeo = new THREE.BufferGeometry();
    this.fAttr = new THREE.BufferAttribute(this.fPos, 3).setUsage(THREE.DynamicDrawUsage);
    fgeo.setAttribute('position', this.fAttr);
    fgeo.setAttribute('aSize', new THREE.BufferAttribute(fSize, 1));
    fgeo.setAttribute('aAlpha', new THREE.BufferAttribute(fAlpha, 1));
    fgeo.setAttribute('aTint', new THREE.BufferAttribute(fTint, 1));
    fgeo.setDrawRange(0, F);
    this.flakeMaterial = makeMaterial();
    this.flakeMaterial.uniforms.uNearFade.value = 2.5;
    this.flakes = new THREE.Points(fgeo, this.flakeMaterial);
    this.flakes.frustumCulled = false;
    this.flakes.renderOrder = 11;
    this.flakes.name = 'ambientFlakes';
    this.flakes.visible = F > 0;
    this.flakes.onBeforeRender = this._onBeforeRender.bind(this);
    scene.add(this.flakes);
    this.flakesSeeded = false;
    this.time = 0;
  }

  // 依畫布高度與 FOV 換算點大小（世界公尺 → 像素）
  _onBeforeRender(renderer, scene, camera, geometry, material) {
    renderer.getDrawingBufferSize(_v2);
    let scale = _v2.y * 0.5;
    if (camera.isPerspectiveCamera) scale /= Math.tan((camera.fov * Math.PI) / 360) * (camera.zoom ? 1 / camera.zoom : 1);
    material.uniforms.uScale.value = scale;
    material.uniforms.uMaxSize.value = Math.max(4, _v2.y * this.C.maxPointScreen);
  }

  setTerrain(terrain) {
    this.terrain = terrain || null;
  }

  _ground(x, z) {
    const t = this.terrain;
    return t && t.heightAt ? t.heightAt(x, z) : -Infinity;
  }

  reset() {
    this.life.fill(0);
    this.alpha.fill(0);
    this.size.fill(0);
    this.head = 0;
    this.high = 0;
    this.emitAcc = 0;
    this.points.geometry.setDrawRange(0, 0);
    this.aAlpha.needsUpdate = true;
    this.aSize.needsUpdate = true;
    this.settled.fill(0);
    this.flakesSeeded = false;
  }

  _spawn(x, y, z, vx, vy, vz, life, size, alpha, tint, grav) {
    const i = this.head;
    this.head = (i + 1) % this.N;
    if (i + 1 > this.high) this.high = i + 1;
    const k = i * 3;
    this.pos[k] = x;
    this.pos[k + 1] = y;
    this.pos[k + 2] = z;
    this.vel[k] = vx;
    this.vel[k + 1] = vy;
    this.vel[k + 2] = vz;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size0[i] = size;
    this.alpha0[i] = alpha;
    this.size[i] = size;
    this.alpha[i] = 0;
    this.tint[i] = tint;
    this.grav[i] = grav;
    this.settled[i] = 0;
  }

  burst(kind, position) {
    if (!position) return;
    const px = position.x || 0;
    const py = position.y || 0;
    const pz = position.z || 0;
    const ivx = this.lastVx * 0.35;
    const ivz = this.lastVz * 0.35;
    let n;
    let out;
    let up;
    let sz;
    let life;
    let tint = 0;
    let grav = 1;
    let yOff = 0.1;
    let spread = 0.6;
    switch (kind) {
      case 'crash':
        n = 110; out = [2.5, 7]; up = [1.5, 5]; sz = [0.3, 0.7]; life = [0.7, 1.4]; spread = 0.9;
        break;
      case 'hit':
        n = 45; out = [1.5, 4.5]; up = [0.5, 3]; sz = [0.25, 0.55]; life = [0.6, 1.2]; yOff = 1.0; spread = 0.8;
        break;
      case 'gate':
        // main 在兩根旗桿的旗幟高度各呼叫一次：小顆硬邊金色菱形，留在旗門原地（不跟著角色往鏡頭飛）
        n = 9; out = [0.6, 2.0]; up = [0.8, 2.6]; sz = [0.08, 0.14]; life = [0.45, 0.8]; tint = 1; grav = 0.35; yOff = 0; spread = 0.25;
        break;
      case 'landHard':
        n = 80; out = [3, 7]; up = [1, 3.5]; sz = [0.3, 0.65]; life = [0.6, 1.2];
        break;
      case 'land':
      default:
        n = 50; out = [2.5, 5.5]; up = [0.8, 2.6]; sz = [0.25, 0.5]; life = [0.5, 1.0];
        break;
    }
    const inherit = kind === 'gate' ? 0 : 1;
    for (let j = 0; j < n; j++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(out[0], out[1]);
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      this._spawn(
        px + ca * spread * Math.random(),
        py + yOff + Math.random() * 0.3,
        pz + sa * spread * Math.random(),
        ca * s + ivx * inherit,
        rand(up[0], up[1]),
        sa * s + ivz * inherit,
        rand(life[0], life[1]),
        rand(sz[0], sz[1]),
        kind === 'gate' ? 1 : rand(0.6, 0.95),
        tint,
        grav,
      );
    }
  }

  update(dt, player, camera) {
    dt = clamp(dt || 0, 0, 0.1);
    this.time += dt;
    const C = this.C;
    if (player) this._emitSpray(dt, player);
    this._simulate(dt);
    const cam = camera && camera.isCamera ? camera : camera && camera.camera && camera.camera.isCamera ? camera.camera : null;
    if (cam && this.F > 0) this._updateFlakes(dt, cam);
  }

  _emitSpray(dt, p) {
    const C = this.C;
    const v = p.velocity;
    this.lastVx = v.x;
    this.lastVy = v.y;
    this.lastVz = v.z;
    const state = p.state;
    const onSnow = p.grounded && state !== 'air' && state !== 'ready';
    const speed = Math.sqrt(v.x * v.x + v.z * v.z);
    if (!onSnow || speed < C.sprayMinSpeed) {
      this.emitAcc = 0;
      return;
    }
    const skid = clamp(p.skid || 0, 0, 1);
    const crashed = state === 'crashed';
    let rate = speed * C.sprayPerSpeed + skid * speed * C.sprayPerSkid;
    if (crashed) rate = speed * C.sprayPerSpeed * 2.5;
    this.emitAcc += rate * dt;
    let count = Math.floor(this.emitAcc);
    this.emitAcc -= count;
    if (count <= 0) return;
    if (count > 60) count = 60;

    const h = p.heading || 0;
    const fx = Math.sin(h);
    const fz = -Math.cos(h);
    const rx = Math.cos(h);
    const rz = Math.sin(h);
    const pos = p.position;
    // 側向速度方向 = 雪被刮出去的方向（轉彎外側）
    const lat = v.x * rx + v.z * rz;
    const latSign = lat > 0.3 ? 1 : lat < -0.3 ? -1 : 0;
    const inh = C.sprayInherit;
    for (let j = 0; j < count; j++) {
      const side = j & 1 ? 1 : -1;
      const tail = rand(0.55, 0.85);
      const x = pos.x + rx * 0.13 * side - fx * tail;
      const z = pos.z + rz * 0.13 * side - fz * tail;
      const y = Math.max(pos.y + 0.06, this._ground(x, z) + C.groundOffset);
      const ls = latSign !== 0 ? latSign : Math.random() < 0.5 ? -1 : 1;
      const kick = C.sprayLateralKick * (0.15 + skid) * rand(0.4, 1.1);
      const up = C.sprayUpKick * (0.35 + skid * 0.9) * rand(0.5, 1.2);
      const sp = 0.6 + skid * 0.6;
      const vx = v.x * inh + rx * ls * kick + (Math.random() - 0.5) * sp;
      const vy = v.y * inh + up;
      const vz = v.z * inh + rz * ls * kick + (Math.random() - 0.5) * sp;
      const sz = rand(C.spraySize[0], C.spraySize[1]) * (0.8 + skid * 0.5);
      const life = rand(C.sprayLife[0], C.sprayLife[1]);
      this._spawn(x, y, z, vx, vy, vz, life, sz, rand(0.45, 0.8) * (0.55 + 0.45 * skid), 0, 1);
    }
  }

  _simulate(dt) {
    const C = this.C;
    const pos = this.pos;
    const vel = this.vel;
    const dragK = Math.exp(-C.drag * dt);
    const g = C.gravity * dt;
    const hasGround = !!(this.terrain && this.terrain.heightAt);
    const settleK = Math.exp(-C.settleFriction * dt);
    const gOff = C.groundOffset;
    const settled = this.settled;
    let high = 0;
    for (let i = 0; i < this.high; i++) {
      let life = this.life[i];
      if (life <= 0) {
        if (this.alpha[i] !== 0) {
          this.alpha[i] = 0;
          this.size[i] = 0;
        }
        continue;
      }
      life -= dt;
      this.life[i] = life;
      if (life <= 0) {
        this.alpha[i] = 0;
        this.size[i] = 0;
        continue;
      }
      high = i + 1;
      const k = i * 3;
      if (settled[i]) {
        // 停在雪面：沿地面滑一點點後停住（高度每幀重新貼地）
        vel[k] *= settleK;
        vel[k + 2] *= settleK;
        pos[k] += vel[k] * dt;
        pos[k + 2] += vel[k + 2] * dt;
        pos[k + 1] = this._ground(pos[k], pos[k + 2]) + gOff;
      } else {
        vel[k] *= dragK;
        vel[k + 1] = vel[k + 1] * dragK - g * this.grav[i];
        vel[k + 2] *= dragK;
        pos[k] += vel[k] * dt;
        pos[k + 1] += vel[k + 1] * dt;
        pos[k + 2] += vel[k + 2] * dt;
        // 旗門金色閃光（grav < 1）飄在空中不落地；其餘碰到雪面就停住並縮短壽命
        if (hasGround && vel[k + 1] < 0 && this.grav[i] >= 1) {
          const gy = this._ground(pos[k], pos[k + 2]) + gOff;
          if (pos[k + 1] <= gy) {
            pos[k + 1] = gy;
            vel[k + 1] = 0;
            settled[i] = 1;
            if (life > C.settleLife) {
              // 保持目前的淡出進度（t）連續：按比例縮短 maxLife
              const r = C.settleLife / life;
              life = C.settleLife;
              this.life[i] = life;
              this.maxLife[i] *= r;
            }
          }
        }
      }
      const t = 1 - life / this.maxLife[i]; // 0 → 1
      const fadeIn = t < 0.08 ? t / 0.08 : 1;
      const fadeOut = 1 - t;
      let a = this.alpha0[i] * fadeIn * fadeOut * Math.sqrt(fadeOut);
      if (this.tint[i] > 0) a *= 0.75 + 0.25 * Math.sin(this.time * 30 + i * 1.7); // 閃爍
      this.alpha[i] = a;
      this.size[i] = this.tint[i] > 0 ? this.size0[i] : this.size0[i] * (1 + t * 1.1); // 金色閃光不放大
    }
    this.high = high;
    this.points.geometry.setDrawRange(0, high);
    if (high > 0) {
      this.aPos.needsUpdate = true;
      this.aAlpha.needsUpdate = true;
      this.aSize.needsUpdate = true;
      this.aTint.needsUpdate = true;
    }
  }

  _updateFlakes(dt, cam) {
    const C = this.C;
    const F = this.F;
    const fb = C.flakeBox;
    const bx = fb[0], by = fb[1], bz = fb[2];
    cam.getWorldPosition(_camPos);
    cam.getWorldDirection(_camDir);
    const cx = _camPos.x + _camDir.x * C.flakeAhead;
    const cy = _camPos.y + _camDir.y * C.flakeAhead * 0.3;
    const cz = _camPos.z + _camDir.z * C.flakeAhead;
    const p = this.fPos;
    const v = this.fVel;
    if (!this.flakesSeeded) {
      for (let i = 0; i < F; i++) {
        p[i * 3] = cx + (Math.random() - 0.5) * bx;
        p[i * 3 + 1] = cy + (Math.random() - 0.5) * by;
        p[i * 3 + 2] = cz + (Math.random() - 0.5) * bz;
      }
      this.flakesSeeded = true;
    }
    const t = this.time;
    const hx = bx * 0.5;
    const hy = by * 0.5;
    const hz = bz * 0.5;
    const hasGround = !!(this.terrain && this.terrain.heightAt);
    const parity = (this._flakeParity = ((this._flakeParity || 0) + 1) & 3);
    for (let i = 0; i < F; i++) {
      const k = i * 3;
      const ph = this.fPhase[i];
      let x = p[k] + (v[k] + Math.sin(t * 0.9 + ph) * 0.35) * dt;
      let y = p[k + 1] + v[k + 1] * dt;
      let z = p[k + 2] + (v[k + 2] + Math.cos(t * 0.7 + ph) * 0.35) * dt;
      // 以盒子中心環繞
      let d = x - cx;
      if (d < -hx) x += bx * Math.ceil((-hx - d) / bx);
      else if (d > hx) x -= bx * Math.ceil((d - hx) / bx);
      d = y - cy;
      if (d < -hy) y += by * Math.ceil((-hy - d) / by);
      else if (d > hy) y -= by * Math.ceil((d - hy) / by);
      d = z - cz;
      if (d < -hz) z += bz * Math.ceil((-hz - d) / bz);
      else if (d > hz) z -= bz * Math.ceil((d - hz) / bz);
      // 落到雪面下 → 回到盒子頂端（不然陡坡上一大半飄雪埋在地裡看不到）；每幀只檢查 1/4（heightAt 不便宜，飄雪每幀只落 ~2 cm）
      if (hasGround && ((i + parity) & 3) === 0 && y < this._ground(x, z)) y = cy + hy;
      p[k] = x;
      p[k + 1] = y;
      p[k + 2] = z;
    }
    this.fAttr.needsUpdate = true;
  }
}
