// 水面：跟著攝影機的格網平面，頂點用 core/weather.js 的同一組 WAVES 位移（船的浮沉與畫面一致），
// 片段著色以菲涅耳混合天空色與水色，浪尖與岸邊加白沫，夜間反射路燈的暖色。
import * as THREE from 'three';
import { WAVES } from '../core/weather.js';

const VS = `
uniform float uTime; uniform float uAmp; uniform vec3 uOrigin;
varying vec3 vW; varying vec3 vN; varying float vCrest;
${WAVES.map((w, k) => `const vec4 W${k} = vec4(${w.dx.toFixed(3)}, ${w.dz.toFixed(3)}, ${w.k.toFixed(3)}, ${w.w.toFixed(3)});\nconst float A${k} = ${w.a.toFixed(3)};`).join('\n')}
void main(){
  vec3 p = position + uOrigin;
  float h = 0.0; float dx = 0.0; float dz = 0.0;
  ${WAVES.map((w, k) => `{ float ph = (W${k}.x * p.x + W${k}.y * p.z) * W${k}.z + uTime * W${k}.w;
    h += A${k} * sin(ph); dx += A${k} * cos(ph) * W${k}.x * W${k}.z; dz += A${k} * cos(ph) * W${k}.y * W${k}.z; }`).join('\n  ')}
  h *= uAmp; dx *= uAmp; dz *= uAmp;
  p.y += h;
  vCrest = h / max(uAmp, 0.01);
  vN = normalize(vec3(-dx, 1.0, -dz));
  vW = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const FS = `
uniform vec3 uSky; uniform vec3 uHorizon; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSunDir; uniform vec3 uSunCol;
uniform vec3 uFogCol; uniform float uFogNear; uniform float uFogFar; uniform float uNight; uniform float uTime; uniform float uAmp; uniform vec4 uDry;
varying vec3 vW; varying vec3 vN; varying float vCrest;
float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5); }
float vn(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
void main(){
  if (vW.x > uDry.x && vW.x < uDry.z && vW.z > uDry.y && vW.z < uDry.w) discard; // 低於海平面的陸上凹地（滑板碗池）
  vec3 V = normalize(cameraPosition - vW);
  // 細波：兩層卷動雜訊擾動法線
  vec2 q = vW.xz * 0.35;
  float n1 = vn(q + uTime * vec2(0.3, 0.2)) - 0.5;
  float n2 = vn(q * 2.3 - uTime * vec2(0.25, 0.4)) - 0.5;
  vec3 N = normalize(vN + vec3(n1, 0.0, n2) * 0.22);
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uHorizon, uSky, clamp(R.y * 1.6, 0.0, 1.0));
  vec3 base = mix(uDeep, uShallow, 0.35 + 0.3 * n1);
  vec3 col = mix(base, sky, clamp(fres, 0.0, 1.0));
  float spec = pow(max(dot(R, uSunDir), 0.0), 220.0) * (1.0 - uNight);
  col += uSunCol * spec * 3.0;
  // 夜間：城市燈光的暖色反射
  col += vec3(1.0, 0.7, 0.4) * uNight * 0.06 * smoothstep(0.2, 0.5, vn(vW.xz * 0.08));
  // 浪花
  float foam = smoothstep(0.62, 0.9, vCrest + n1 * 0.4) * smoothstep(0.4, 1.2, uAmp);
  col = mix(col, vec3(0.92, 0.95, 0.97) * (1.0 - uNight * 0.8), foam * 0.7);
  float d = length(vW - cameraPosition);
  col = mix(col, uFogCol, smoothstep(uFogNear, uFogFar, d));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export class Water {
  constructor(scene) {
    // 中央密、外圍疏：兩層同心網格
    const near = new THREE.PlaneGeometry(400, 400, 160, 160);
    near.rotateX(-Math.PI / 2);
    const far = new THREE.PlaneGeometry(60000, 60000, 60, 60);
    far.rotateX(-Math.PI / 2);
    this.u = {
      uTime: { value: 0 }, uAmp: { value: 0.4 }, uOrigin: { value: new THREE.Vector3() },
      uSky: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
      uDeep: { value: new THREE.Color(0x0d3b52) }, uShallow: { value: new THREE.Color(0x2a7d8c) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) },
      uFogCol: { value: new THREE.Color() }, uFogNear: { value: 200 }, uFogFar: { value: 2000 }, uNight: { value: 0 }, uDry: { value: new THREE.Vector4(1, 1, -1, -1) },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: this.u });
    this.near = new THREE.Mesh(near, mat);
    // 外圈往下壓一點，避免與近處網格的 z-fighting
    const farU = { ...this.u, uOrigin: { value: new THREE.Vector3() }, uAmp: { value: 0 } };
    this.farU = farU;
    this.far = new THREE.Mesh(far, new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: farU }));
    for (const m of [this.near, this.far]) {
      m.frustumCulled = false;
      m.receiveShadow = false;
      scene.add(m);
    }
    this.near.renderOrder = 1;
  }

  update({ dry, level, amp, t, cam, sky, sunDir, sunCol, fogCol, fogNear, fogFar, night, kind }) {
    const on = level > -900;
    this.near.visible = on;
    this.far.visible = on && kind !== 'canal';
    if (!on) return;
    const U = this.u;
    if (dry) U.uDry.value.set(dry.x0, dry.z0, dry.x1, dry.z1);
    else U.uDry.value.set(1, 1, -1, -1);
    const sx = Math.round(cam.x / 2.5) * 2.5;
    const sz = Math.round(cam.z / 2.5) * 2.5;
    U.uOrigin.value.set(sx, level, sz);
    this.farU.uOrigin.value.set(Math.round(cam.x / 150) * 150, level - 0.35, Math.round(cam.z / 150) * 150);
    U.uTime.value = t;
    U.uAmp.value = amp;
    U.uSky.value.copy(sky.zenith);
    U.uHorizon.value.copy(sky.horizon);
    U.uSunDir.value.copy(sunDir);
    U.uSunCol.value.copy(sunCol);
    U.uFogCol.value.copy(fogCol);
    U.uFogNear.value = fogNear;
    U.uFogFar.value = fogFar;
    U.uNight.value = night;
    if (kind === 'canal') {
      U.uDeep.value.setHex(0x22332c);
      U.uShallow.value.setHex(0x3f5a4b);
    } else {
      U.uDeep.value.setHex(0x0b3a52);
      U.uShallow.value.setHex(0x26808e);
    }
    // 近處網格只在 400m 內；在高空時改由遠網格負責
    this.near.visible = cam.y - level < 600;
  }
}
