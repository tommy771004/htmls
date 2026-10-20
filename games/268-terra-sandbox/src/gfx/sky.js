// 天空與天氣視覺：漸層天穹＋太陽／月亮、卡通積雲、星空、極光、雨絲／雪花、閃電、
// 遠方的雷暴雲塔、颶風眼牆與龍捲風漏斗。全部跟著攝影機，距離依天氣系統的真實方位與公里數換算。
import * as THREE from 'three';
import { lerp, clamp, mulberry32 } from '../core/math.js';

const C = (h) => new THREE.Color(h);

export function skyColors(sunEl, cover) {
  const day = clamp((sunEl + 0.05) / 0.35, 0, 1);
  const golden = clamp(1 - Math.abs(sunEl - 0.06) / 0.16, 0, 1);
  const zenith = C(0x060a18).lerp(C(0x2f74d0), day);
  const horizon = C(0x121a30).lerp(C(0xb9d7f1), day).lerp(C(0xf3a35e), golden * 0.75);
  const gray = C(0x8c949c).multiplyScalar(0.25 + day * 0.75);
  zenith.lerp(gray, cover * 0.85);
  horizon.lerp(gray.clone().multiplyScalar(1.12), cover * 0.8);
  const sun = C(0xfff3dc).lerp(C(0xffa060), golden);
  return { zenith, horizon, sun, day, golden };
}

const SKY_VS = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const SKY_FS = `
uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uMoonDir;
uniform float uCover; uniform float uNight; uniform float uFlash; uniform float uSpace; uniform float uDip;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -1.0, 1.0);
  float t = pow(clamp(h, 0.0, 1.0), 0.45);
  vec3 col = mix(uHorizon, uZenith, t);
  col = mix(col, uHorizon * 0.82, smoothstep(0.0, -0.25, h));
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunCol * (pow(sd, 6.0) * 0.28 + pow(sd, 64.0) * 0.6) * (1.0 - uCover * 0.85) * (1.0 - uNight);
  col += uSunCol * smoothstep(0.9993, 0.9997, sd) * 6.0 * (1.0 - uCover * 0.95) * step(-0.05, uSunDir.y);
  float md = max(dot(d, uMoonDir), 0.0);
  col += vec3(0.85, 0.9, 1.0) * smoothstep(0.99955, 0.9998, md) * 2.0 * uNight * (1.0 - uCover);
  col += vec3(0.6, 0.7, 0.9) * pow(md, 40.0) * 0.08 * uNight;
  col += vec3(0.75, 0.8, 1.0) * uFlash * 0.6;
  // 高空：天空轉黑，只剩地平線（下沉 uDip）上方一道藍色大氣層
  if (uSpace > 0.0) {
    float lit = clamp(uSunDir.y * 3.0 + 0.6, 0.08, 1.0);
    float band = exp(-max(h + uDip, 0.0) / 0.018) * step(-uDip - 0.02, h);
    vec3 sp = vec3(0.3, 0.55, 1.0) * band * lit + vec3(1.0, 0.5, 0.2) * band * exp(-abs(uSunDir.y) * 12.0) * 0.5;
    sp += uSunCol * smoothstep(0.9993, 0.9997, sd) * 8.0 + uSunCol * pow(sd, 400.0) * 0.6;
    col = mix(col, sp, uSpace);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export class Sky {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.uniforms = {
      uZenith: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
      uSunCol: { value: new THREE.Color() },
      uCover: { value: 0 },
      uNight: { value: 0 },
      uFlash: { value: 0 },
      uSpace: { value: 0 },
      uDip: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 16), mat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    this.group.add(this.dome);
    // 給環境貼圖用的天空場景
    this.envScene = new THREE.Scene();
    this.envDome = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), mat);
    this.envScene.add(this.envDome);
    this.groundDisc = new THREE.Mesh(new THREE.CircleGeometry(90, 24), new THREE.MeshBasicMaterial({ color: 0x55585c }));
    this.groundDisc.rotation.x = -Math.PI / 2;
    this.groundDisc.position.y = -6;
    this.envScene.add(this.groundDisc);
    this.buildStars();
    this.buildAurora();
    this.clouds = new Clouds(this.group);
    this.precip = new Precip(this.group);
    this.storms = new Storms(this.group);
    this.tornado = new Tornado(this.group);
    this.bolt = new Bolt(this.group);
  }

  buildStars() {
    const rnd = mulberry32(77);
    const n = 2600;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) {
      const u = rnd() * 2 - 1;
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      pos.set([Math.cos(a) * r * 4500, Math.abs(u) * 4500 - 200, Math.sin(a) * r * 4500], k * 3);
      const b = 0.4 + rnd() * 0.6;
      const warm = rnd();
      col.set([b * (0.85 + warm * 0.15), b * 0.9, b * (1.05 - warm * 0.15)], k * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.starMat = new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false });
    this.stars = new THREE.Points(g, this.starMat);
    this.stars.renderOrder = -9;
    this.stars.frustumCulled = false;
    this.group.add(this.stars);
  }

  buildAurora() {
    this.auroraU = { uTime: { value: 0 }, uAlpha: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.auroraU,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      fog: false,
      vertexShader: `varying vec2 vUv; uniform float uTime;
        void main(){ vUv = uv; vec3 p = position; p.z += sin(p.x*0.0016 + uTime*0.15)*260.0 + sin(p.x*0.0041 - uTime*0.23)*90.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }`,
      fragmentShader: `varying vec2 vUv; uniform float uTime; uniform float uAlpha;
        void main(){ float band = smoothstep(0.0,0.25,vUv.y) * (1.0 - smoothstep(0.35,1.0,vUv.y));
        float rays = 0.55 + 0.45*sin(vUv.x*180.0 + uTime*0.6 + sin(vUv.x*31.0)*3.0);
        vec3 c = mix(vec3(0.15,1.0,0.55), vec3(0.65,0.3,1.0), smoothstep(0.35,0.95,vUv.y));
        gl_FragColor = vec4(c * band * rays * uAlpha * 0.9, 1.0); }`,
    });
    this.aurora = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(7000, 900, 120, 1), mat);
      m.position.set(k * 300 - 300, 1300 + k * 120, -2600 - k * 400);
      this.aurora.add(m);
    }
    this.aurora.visible = false;
    this.group.add(this.aurora);
  }

  // info：{ sunEl, sunAz, moonEl, moonAz, local（天氣取樣）, lat, t, camera, flash }
  update(info, dt) {
    const { sunEl, sunAz, local, camera } = info;
    const cover = local.cover;
    const sc = skyColors(sunEl, cover);
    const U = this.uniforms;
    U.uZenith.value.copy(sc.zenith);
    U.uHorizon.value.copy(sc.horizon);
    U.uSunCol.value.copy(sc.sun);
    U.uSunDir.value.set(Math.sin(sunAz) * Math.cos(sunEl), Math.sin(sunEl), -Math.cos(sunAz) * Math.cos(sunEl));
    U.uMoonDir.value.set(Math.sin(info.moonAz) * Math.cos(info.moonEl), Math.sin(info.moonEl), -Math.cos(info.moonAz) * Math.cos(info.moonEl));
    U.uCover.value = cover;
    U.uNight.value = 1 - sc.day;
    U.uFlash.value = info.flash;
    const space = info.space || 0;
    U.uSpace.value = space;
    U.uDip.value = info.dip || 0;
    this.group.position.copy(camera.position);
    this.starMat.opacity = Math.max(clamp((1 - sc.day) * (1 - cover * 1.1) * 1.2, 0, 1), space);
    this.stars.rotation.y = info.t * 0.002;
    const auroraOn = Math.abs(info.lat) > 47 && sc.day < 0.15 && cover < 0.65;
    this.auroraU.uAlpha.value = lerp(this.auroraU.uAlpha.value, auroraOn ? 1 : 0, Math.min(1, dt * 0.5));
    this.aurora.visible = this.auroraU.uAlpha.value > 0.01;
    this.auroraU.uTime.value = info.t;
    if (info.lat < 0) this.aurora.rotation.y = Math.PI;
    // 高過雲層後，近地的雲、雨雪、雷暴與龍捲風都不畫（改由地球貼圖的雲層表現）
    const low = (info.alt || 0) < 2200;
    this.clouds.mesh.visible = low;
    if (!low) {
      for (const o of [this.precip.rain, this.precip.snow, this.storms.mesh, this.tornado.group, this.bolt.line]) o.visible = false;
      return sc;
    }
    this.storms.mesh.visible = true;
    this.clouds.update(info, sc, dt);
    this.precip.update(info, dt);
    this.storms.update(info, sc);
    this.tornado.update(info, sc, dt);
    this.bolt.update(info, dt);
    return sc;
  }
}

// ── 卡通積雲：每朵雲由多顆球組成，球體以 InstancedMesh 一次畫完 ──
const CLOUD_VS = `
varying vec3 vN; varying vec3 vW; varying float vH;
attribute float aShade;
varying float vShade;
void main(){
  vec4 w = modelMatrix * instanceMatrix * vec4(position,1.0);
  vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  vW = w.xyz; vShade = aShade; vH = position.y;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const CLOUD_FS = `
uniform vec3 uSunDir; uniform vec3 uLit; uniform vec3 uShadow; uniform vec3 uFogCol; uniform vec3 uCam;
uniform float uFogFar; uniform float uFlash;
varying vec3 vN; varying vec3 vW; varying float vShade; varying float vH;
void main(){
  float l = dot(normalize(vN), uSunDir);
  float k = smoothstep(-0.35, 0.75, l) * 0.8 + 0.2 * smoothstep(-0.2, 0.9, vN.y);
  vec3 c = mix(uShadow, uLit, k * vShade);
  c += uLit * pow(1.0 - abs(dot(normalize(vN), normalize(uCam - vW))), 3.0) * 0.18;
  c += vec3(0.8,0.85,1.0) * uFlash;
  float d = length(vW.xz - uCam.xz);
  c = mix(c, uFogCol, smoothstep(uFogFar * 0.35, uFogFar, d));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

class Clouds {
  constructor(parent) {
    this.N = 90;
    this.per = 11;
    const max = this.N * this.per;
    const geo = new THREE.IcosahedronGeometry(1, 3);
    const shade = new Float32Array(max);
    for (let i = 0; i < max; i++) shade[i] = 0.82 + ((i * 7919) % 100) / 550;
    geo.setAttribute('aShade', new THREE.InstancedBufferAttribute(shade, 1));
    this.u = {
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uLit: { value: new THREE.Color(1, 1, 1) },
      uShadow: { value: new THREE.Color(0.6, 0.68, 0.8) },
      uFogCol: { value: new THREE.Color() },
      uCam: { value: new THREE.Vector3() },
      uFogFar: { value: 6000 },
      uFlash: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: CLOUD_VS, fragmentShader: CLOUD_FS, uniforms: this.u, fog: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -5;
    // 每朵雲的形狀（相對中心的球列表）
    const rnd = mulberry32(2681);
    this.defs = [];
    for (let c = 0; c < this.N; c++) {
      const puffs = [];
      const size = 70 + rnd() * 130;
      for (let p = 0; p < this.per; p++) {
        const a = rnd() * Math.PI * 2;
        const r = rnd() * size * 0.75;
        const base = p < 5;
        const s = size * (base ? 0.35 + rnd() * 0.2 : 0.3 + rnd() * 0.3);
        puffs.push({ x: Math.cos(a) * r, y: base ? s * 0.25 : size * 0.18 + rnd() * size * 0.35, z: Math.sin(a) * r * 0.7, sx: s * 1.15, sy: s * (base ? 0.55 : 0.85), sz: s });
      }
      this.defs.push({ x: (rnd() - 0.5) * 9000, z: (rnd() - 0.5) * 9000, puffs, thr: rnd(), alt: rnd() * 220, size });
    }
    this.drift = 0;
    this.m = new THREE.Matrix4();
    parent.add(this.mesh);
  }

  update(info, sc, dt) {
    const { local, camera, cloudBase } = info;
    const U = this.u;
    U.uSunDir.value.set(Math.sin(info.sunAz) * Math.cos(info.sunEl), Math.max(0.05, Math.sin(info.sunEl)), -Math.cos(info.sunAz) * Math.cos(info.sunEl)).normalize();
    const storm = clamp(local.rain * 0.8 + local.thunder * 0.4, 0, 1);
    const day = sc.day;
    U.uLit.value.copy(C(0xffffff).lerp(C(0xffc89a), sc.golden * 0.6).multiplyScalar(0.12 + day * 0.95)).lerp(C(0x8a9097).multiplyScalar(0.2 + day * 0.6), storm);
    U.uShadow.value.copy(C(0x8fa3c0).multiplyScalar(0.1 + day * 0.75)).lerp(C(0x4a5058).multiplyScalar(0.2 + day * 0.5), storm);
    U.uFogCol.value.copy(sc.horizon);
    U.uCam.value.copy(camera.position);
    U.uFlash.value = info.flash * 0.6;
    this.drift += dt * local.wind * info.timeScaleVis;
    const wx = Math.sin(local.windDir);
    const wz = Math.cos(local.windDir);
    const cover = local.cover;
    const span = 9000;
    let i = 0;
    const cam = camera.position;
    // 雲在世界座標（扣掉 Sky group 跟隨攝影機的平移）
    for (const d of this.defs) {
      const vis = d.thr < cover * 1.15;
      let x = d.x + wx * this.drift;
      let z = d.z + wz * this.drift;
      x = ((((x - cam.x) % span) + span * 1.5) % span) - span / 2;
      z = ((((z - cam.z) % span) + span * 1.5) % span) - span / 2;
      const grow = vis ? clamp((cover * 1.15 - d.thr) * 4, 0.25, 1) * (0.8 + storm * 0.9) : 0;
      const y = cloudBase + d.alt - cam.y + (storm > 0.5 ? -80 : 0);
      for (const p of d.puffs) {
        this.m.makeScale(p.sx * grow + 0.001, p.sy * grow * (1 + storm * 0.6) + 0.001, p.sz * grow + 0.001);
        this.m.setPosition(x + p.x * (0.6 + grow * 0.4), y + p.y * grow, z + p.z * (0.6 + grow * 0.4));
        this.mesh.setMatrixAt(i++, this.m);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ── 雨與雪 ──
class Precip {
  constructor(parent) {
    this.n = 4000;
    const pos = new Float32Array(this.n * 6);
    this.p = new Float32Array(this.n * 3);
    const rnd = mulberry32(5);
    for (let k = 0; k < this.n; k++) this.p.set([(rnd() - 0.5) * 90, rnd() * 50, (rnd() - 0.5) * 90], k * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xbcd0e0, transparent: true, opacity: 0.45, depthWrite: false }));
    this.rain.frustumCulled = false;
    parent.add(this.rain);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.n * 3), 3));
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 32, 32);
    this.snow = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.16, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, color: 0xffffff }));
    this.snow.frustumCulled = false;
    parent.add(this.snow);
    this.rnd = rnd;
  }

  update(info, dt) {
    const L = info.local;
    const amt = L.rain;
    const snow = L.snow;
    const indoor = info.indoor;
    const n = indoor ? 0 : Math.floor(this.n * clamp(amt, 0, 1));
    this.rain.visible = n > 0 && !snow;
    this.snow.visible = n > 0 && snow;
    if (!n) return;
    const wx = Math.sin(L.windDir) * Math.min(L.wind, 30) * 0.35;
    const wz = Math.cos(L.windDir) * Math.min(L.wind, 30) * 0.35;
    const vy = snow ? 1.6 : 24;
    const P = this.p;
    const cv = info.camVel || { x: 0, z: 0 };
    for (let k = 0; k < n; k++) {
      const i = k * 3;
      P[i] += (wx * (snow ? 0.6 : 1) + (snow ? Math.sin(info.t * 1.3 + k) * 0.6 : 0) - cv.x) * dt;
      P[i + 1] -= vy * dt;
      P[i + 2] += (wz * (snow ? 0.6 : 1) - cv.z) * dt;
      if (P[i + 1] < -12) P[i + 1] += 50;
      if (P[i] > 45) P[i] -= 90;
      if (P[i] < -45) P[i] += 90;
      if (P[i + 2] > 45) P[i + 2] -= 90;
      if (P[i + 2] < -45) P[i + 2] += 90;
    }
    if (snow) {
      const a = this.snow.geometry.attributes.position.array;
      a.set(P.subarray(0, n * 3));
      this.snow.geometry.setDrawRange(0, n);
      this.snow.geometry.attributes.position.needsUpdate = true;
    } else {
      const a = this.rain.geometry.attributes.position.array;
      const sx = wx * 0.03;
      const sz = wz * 0.03;
      for (let k = 0; k < n; k++) {
        const i = k * 3;
        const o = k * 6;
        a[o] = P[i];
        a[o + 1] = P[i + 1];
        a[o + 2] = P[i + 2];
        a[o + 3] = P[i] - sx;
        a[o + 4] = P[i + 1] + 0.75;
        a[o + 5] = P[i + 2] - sz;
      }
      this.rain.geometry.setDrawRange(0, n * 2);
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
  }
}

// ── 遠方雷暴與颶風：用同一組大球 InstancedMesh 堆出雲塔、砧狀雲頂與眼牆 ──
class Storms {
  constructor(parent) {
    this.max = 900;
    const geo = new THREE.IcosahedronGeometry(1, 2);
    this.mat = new THREE.MeshLambertMaterial({ color: 0x8a9098, fog: false });
    this.u = { uFogCol: { value: new THREE.Color() }, uDark: { value: new THREE.Color(0x3b4048) } };
    this.mat.onBeforeCompile = (sh) => {
      sh.uniforms.uFogCol = this.u.uFogCol;
      sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n');
    };
    this.mesh = new THREE.InstancedMesh(geo, this.mat, this.max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = -4;
    this.m = new THREE.Matrix4();
    this.rnd = mulberry32(9);
    this.jit = Array.from({ length: this.max }, () => [this.rnd(), this.rnd(), this.rnd(), this.rnd()]);
    parent.add(this.mesh);
  }

  update(info, sc) {
    const near = info.local.nearby || [];
    const cam = info.camera.position;
    let i = 0;
    const put = (x, y, z, s, sy = s) => {
      if (i >= this.max) return;
      this.m.makeScale(s, sy, s);
      this.m.setPosition(x, y - cam.y, z);
      this.mesh.setMatrixAt(i++, this.m);
    };
    this.mat.color.copy(C(0x9aa1aa).multiplyScalar(0.15 + sc.day * 0.85)).lerp(sc.horizon, 0.25);
    for (const n of near) {
      const c = n.cell;
      const km = n.km;
      if (c.kind === 'front') continue;
      const ang = n.bearing;
      const dx = Math.sin(ang);
      const dz = -Math.cos(ang);
      if (c.kind === 'storm') {
        if (km > 160) continue;
        const dist = Math.min(km * 1000, 4200);
        const cx = dx * dist;
        const cz = dz * dist;
        const sc2 = km < 4 ? 1 : 1.6;
        // 雲塔＋砧狀雲頂
        for (let k = 0; k < 22; k++) {
          const j = this.jit[i % this.max];
          const h = k / 22;
          put(cx + (j[0] - 0.5) * 500 * sc2, 700 + h * 1500, cz + (j[1] - 0.5) * 500 * sc2, (260 + j[2] * 160) * sc2 * (1 - h * 0.3));
        }
        for (let k = 0; k < 16; k++) {
          const j = this.jit[i % this.max];
          const a = (k / 16) * Math.PI * 2;
          put(cx + Math.cos(a) * 900 * sc2 * (0.6 + j[0] * 0.5), 2300 + j[1] * 120, cz + Math.sin(a) * 900 * sc2 * (0.6 + j[0] * 0.5), 420 * sc2, 140 * sc2);
        }
        // 低垂的雲底與雨幕
        for (let k = 0; k < 10; k++) {
          const j = this.jit[i % this.max];
          put(cx + (j[0] - 0.5) * 900, 520 + j[1] * 60, cz + (j[2] - 0.5) * 900, 380, 110);
        }
      } else if (c.kind === 'hurricane') {
        if (km > c.radius * 2.2) continue;
        // 眼牆：以颶風中心為圓心的一圈雲牆；在外面時只畫面向玩家那一側
        const eye = n.cell.radius * 0.12;
        const R = Math.max(eye, 30) * 1000;
        const cxW = dx * km * 1000;
        const czW = dz * km * 1000;
        const inside = km < c.radius * 0.35;
        const segs = 120;
        for (let k = 0; k < segs; k++) {
          const a = (k / segs) * Math.PI * 2;
          const wx = cxW + Math.cos(a) * R;
          const wz = czW + Math.sin(a) * R;
          const d = Math.hypot(wx, wz);
          if (d > 9000 && !inside) continue;
          const f = Math.min(1, 4200 / d);
          const j = this.jit[(k * 3) % this.max];
          for (let l = 0; l < 4; l++) put(wx * f, 500 + l * 650, wz * f, (420 + j[l % 3] * 200) * (1 - l * 0.12) * Math.max(0.5, f));
        }
      }
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ── 龍捲風漏斗 ──
class Tornado {
  constructor(parent) {
    this.u = { uTime: { value: 0 }, uCol: { value: new THREE.Color(0x5b5651) } };
    const pts = [];
    for (let k = 0; k <= 30; k++) {
      const v = k / 30;
      pts.push(new THREE.Vector2(6 + Math.pow(v, 2.4) * 210 + v * 18, v * 620));
    }
    const geo = new THREE.LatheGeometry(pts, 40);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      vertexShader: `varying vec2 vUv; varying float vY; uniform float uTime;
        void main(){ vUv = uv; vec3 p = position; vY = p.y;
          float sway = sin(p.y*0.006 + uTime*0.7)*40.0*(p.y/620.0) + sin(uTime*1.3)*12.0;
          p.x += sway; p.z += cos(p.y*0.005 + uTime*0.5)*30.0*(p.y/620.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }`,
      fragmentShader: `varying vec2 vUv; varying float vY; uniform float uTime; uniform vec3 uCol;
        void main(){ float s = 0.55 + 0.45*sin(vUv.x*6.2831*5.0 - uTime*6.0 + vUv.y*14.0);
          float a = (0.55 + 0.35*s) * smoothstep(0.0,0.05,vUv.y) * (1.0 - smoothstep(0.85,1.0,vUv.y)*0.6);
          gl_FragColor = vec4(uCol * (0.7 + 0.4*s), a);
          #include <colorspace_fragment>
        }`,
    });
    this.funnel = new THREE.Mesh(geo, mat);
    this.group = new THREE.Group();
    this.group.add(this.funnel);
    // 地面碎片雲
    const n = 900;
    const pos = new Float32Array(n * 3);
    this.deb = [];
    const rnd = mulberry32(3);
    for (let k = 0; k < n; k++) this.deb.push({ a: rnd() * Math.PI * 2, r: 10 + rnd() * 70, y: rnd() * 60, s: 0.8 + rnd() });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.debris = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x5a4a3a, size: 1.6, transparent: true, opacity: 0.85, depthWrite: false }));
    this.group.add(this.debris);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(900, 700, 120, 32), new THREE.MeshLambertMaterial({ color: 0x3e4249 }));
    wall.position.y = 650;
    this.group.add(wall);
    this.group.visible = false;
    parent.add(this.group);
  }

  update(info, sc, dt) {
    const T = info.local.tornado;
    if (!T || T.km > 9) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    const d = T.km * 1000;
    const cam = info.camera.position;
    const x = Math.sin(T.bearing) * d;
    const z = -Math.cos(T.bearing) * d;
    const gy = info.groundAt(cam.x + x, cam.z + z);
    this.group.position.set(x, gy - cam.y, z);
    this.u.uTime.value = info.t;
    this.u.uCol.value.copy(C(0x6a6259).multiplyScalar(0.25 + sc.day * 0.75));
    const a = this.debris.geometry.attributes.position.array;
    for (let k = 0; k < this.deb.length; k++) {
      const p = this.deb[k];
      p.a += dt * (2.5 + 60 / p.r);
      p.y += dt * (6 + p.s * 4);
      if (p.y > 90) p.y = 0;
      a[k * 3] = Math.cos(p.a) * p.r * (1 + p.y / 120);
      a[k * 3 + 1] = p.y;
      a[k * 3 + 2] = Math.sin(p.a) * p.r * (1 + p.y / 120);
    }
    this.debris.geometry.attributes.position.needsUpdate = true;
  }
}

// ── 閃電 ──
class Bolt {
  constructor(parent) {
    this.line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xf4f0ff, fog: false }));
    this.line.visible = false;
    this.line.frustumCulled = false;
    parent.add(this.line);
    this.ttl = 0;
    this.rnd = mulberry32(11);
  }

  update(info, dt) {
    if (info.newFlash && info.flashPos) {
      const r = this.rnd;
      const cam = info.camera.position;
      const x0 = Math.cos(info.flashPos.a) * info.flashPos.d;
      const z0 = Math.sin(info.flashPos.a) * info.flashPos.d;
      const pts = [];
      let x = x0;
      let z = z0;
      const top = 900 - cam.y;
      const bot = info.groundAt(cam.x + x0, cam.z + z0) - cam.y;
      for (let k = 0; k <= 24; k++) {
        const y = top + ((bot - top) * k) / 24;
        x += (r() - 0.5) * 70;
        z += (r() - 0.5) * 70;
        pts.push(new THREE.Vector3(x, y, z));
      }
      this.line.geometry.setFromPoints(pts);
      this.ttl = 0.18;
    }
    this.ttl -= dt;
    this.line.visible = this.ttl > 0;
  }
}
