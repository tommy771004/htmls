// 河水：只在地形低於水面附近的格子建網格（沒有重疊，透明度一致）；著色器依水深貼圖做深淺漸層與透明度、
// 沿水流方向捲動的波紋法線（flow map 兩相位交替）、陽光閃點、岸邊／巨石邊的卡通白沫、急流白沫條紋、
// 船身邊的白沫與漣漪圈（浮標、點水、划槳、釣點魚群都丟漣漪進來）。另有瀑布水幕與崖頂溪口。
import * as THREE from 'three';
import { current, FALLS, BOUNDS } from '../core/map.js';
import { U } from './shared.js';

export const MAX_RIPPLES = 24;

export function buildWater(grid, heightTex) {
  const step = 3;
  const nx = Math.floor((BOUNDS.x1 - BOUNDS.x0) / step) + 1, nz = Math.floor((BOUNDS.z1 - BOUNDS.z0) / step) + 1;
  const pos = [], flow = [], index = [];
  const vid = new Int32Array(nx * nz).fill(-1);
  const wet = (i, j) => grid.sample(BOUNDS.x0 + i * step, BOUNDS.z0 + j * step) < 0.6;
  const vert = (i, j) => {
    const o = j * nx + i;
    if (vid[o] >= 0) return vid[o];
    const x = BOUNDS.x0 + i * step, z = BOUNDS.z0 + j * step;
    vid[o] = pos.length / 3;
    pos.push(x, 0, z);
    const [vx, vz] = current(x, z);
    flow.push(vx, vz);
    return vid[o];
  };
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    if (!(wet(i, j) || wet(i + 1, j) || wet(i, j + 1) || wet(i + 1, j + 1))) continue;
    const a = vert(i, j), b = vert(i + 1, j), c = vert(i, j + 1), d = vert(i + 1, j + 1);
    index.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 2));
  geo.setIndex(index);
  geo.computeBoundingSphere();

  const ripples = Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -99, 0));
  const uniforms = {
    ...U,
    uHeight: { value: heightTex },
    uBounds: { value: new THREE.Vector4(BOUNDS.x0, BOUNDS.z0, BOUNDS.x1 - BOUNDS.x0, BOUNDS.z1 - BOUNDS.z0) },
    uBoat: { value: new THREE.Vector4(0, 0, 0, 0) },   // x, z, yaw, 速度
    uRipples: { value: ripples },
    uLamp: { value: new THREE.Vector4(0, 0, 0, 0) },   // 船頭提燈：x, z, 強度
    ...THREE.UniformsLib.fog,
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, fog: true,
    vertexShader: /* glsl */`
      attribute vec2 aFlow;
      varying vec3 vW; varying vec2 vFlow;
      #include <fog_pars_vertex>
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz; vFlow = aFlow;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uHeight; uniform vec4 uBounds; uniform float uTime; uniform float uDusk;
      uniform vec3 uWaterShallow; uniform vec3 uWaterMid; uniform vec3 uWaterDeep;
      uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyCol;
      uniform vec4 uBoat; uniform vec4 uRipples[${MAX_RIPPLES}]; uniform vec4 uLamp;
      varying vec3 vW; varying vec2 vFlow;
      #include <fog_pars_fragment>
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
      float waves(vec2 p) { return vn(p) * 0.6 + vn(p * 2.3 + 7.1) * 0.3 + vn(p * 5.1 - 3.3) * 0.1; }
      float depthAt(vec2 xz) { vec2 uv = (xz - uBounds.xy) / uBounds.zw; return -texture2D(uHeight, uv).r; }
      void main() {
        float depth = depthAt(vW.xz);
        if (depth < -0.08) discard;
        float spd = length(vFlow);
        // flow map：兩個相位交替，避免紋理被拉長
        float T = uTime * 0.5;
        float p1 = fract(T), p2 = fract(T + 0.5);
        float wgt = abs(1.0 - 2.0 * p1);
        vec2 fl = vFlow * 2.2 + vec2(0.05, 0.03);
        vec2 q = vW.xz * 0.55;
        float w1 = waves(q - fl * p1), w2 = waves(q - fl * p2 + 0.37);
        float wv = mix(w1, w2, wgt);
        float e = 0.35;
        float wx = mix(waves(q + vec2(e, 0) - fl * p1), waves(q + vec2(e, 0) - fl * p2 + 0.37), wgt) - wv;
        float wz = mix(waves(q + vec2(0, e) - fl * p1), waves(q + vec2(0, e) - fl * p2 + 0.37), wgt) - wv;
        // 漣漪圈
        float ring = 0.0; vec2 rg = vec2(0.0);
        for (int i = 0; i < ${MAX_RIPPLES}; i++) {
          vec4 r = uRipples[i];
          float age = uTime - r.z;
          if (age < 0.0 || age > 2.6) continue;
          vec2 dv = vW.xz - r.xy; float d = length(dv);
          float rad = age * (0.9 + r.w * 0.6);
          float band = exp(-pow((d - rad) * 7.0 / (1.0 + age), 2.0)) * (1.0 - age / 2.6) * r.w;
          ring = max(ring, band);
          rg += normalize(dv + 1e-4) * band;
        }
        vec3 n = normalize(vec3(-wx * (1.6 + spd) - rg.x * 0.9, 1.0, -wz * (1.6 + spd) - rg.y * 0.9));
        // 深淺色與透明度
        vec3 col = mix(uWaterShallow, uWaterMid, smoothstep(0.15, 1.8, depth));
        col = mix(col, uWaterDeep, smoothstep(1.8, 5.5, depth));
        float alpha = mix(0.22, 0.86, smoothstep(0.0, 3.0, depth));
        alpha = mix(alpha, 0.95, smoothstep(3.0, 6.0, depth));
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
        col = mix(col, uSkyCol, fres * 0.55 + 0.06);
        vec3 R = reflect(-uSunDir, n);
        float sp = pow(max(dot(R, V), 0.0), 120.0);
        col += uSunCol * sp * 1.4;
        alpha = max(alpha, sp * 0.8);
        // 岸邊與巨石邊的白沫（卡通邊）
        float fn = vn(vW.xz * 1.4 + vec2(uTime * 0.25, -uTime * 0.2)) * 0.55 + vn(vW.xz * 3.1 - uTime * 0.3) * 0.45;
        float shore = 1.0 - smoothstep(0.02, 0.42, depth);
        float foam = step(0.62, fn * 0.5 + shore * 0.85) * smoothstep(0.0, 0.08, depth + 0.06);
        float edge = step(0.82, shore + fn * 0.15);
        // 急流：沿水流拉長的白沫條紋
        if (spd > 0.45) {
          vec2 dir = vFlow / spd; vec2 side = vec2(-dir.y, dir.x);
          vec2 sp2 = vec2(dot(vW.xz, side) * 1.6, dot(vW.xz, dir) * 0.25 + uTime * spd * 0.55);
          float st = vn(sp2) * vn(sp2 * 2.1 + 3.0);
          float streak = smoothstep(0.34, 0.5, st) * smoothstep(0.45, 1.0, spd) * smoothstep(0.25, 0.75, vn(vW.xz * 0.35 + uTime * 0.05));
          col = mix(col, vec3(0.93, 0.96, 0.94), streak * 0.75);
          alpha = max(alpha, streak * 0.8);
        }
        // 船身邊：船速越快白沫越多
        vec2 bd = vW.xz - uBoat.xy; float cy = cos(uBoat.z), sy = sin(uBoat.z);
        vec2 bl = vec2(bd.x * cy - bd.y * sy, bd.x * sy + bd.y * cy);
        float be = length(bl / vec2(0.72, 1.86));
        float hull = exp(-pow((be - 1.08) * 7.0, 2.0)) * smoothstep(0.35, 1.6, uBoat.w);
        hull *= smoothstep(-0.9, 0.6, bl.y / 1.86);                 // 船頭與兩舷前段，船尾交給尾跡粒子
        foam = max(foam, step(0.55, hull * (0.25 + fn * 1.1)));
        col = mix(col, vec3(0.96, 0.98, 0.95), max(foam, edge * 0.85));
        alpha = max(alpha, max(foam, edge) * 0.92);
        alpha = max(alpha, ring * 0.25);
        col += ring * 0.16;
        // 黃昏：船頭提燈在水面的暖色倒影
        if (uLamp.z > 0.0) {
          float ld = length(vW.xz - uLamp.xy);
          col += vec3(1.0, 0.72, 0.38) * uLamp.z * exp(-ld * ld * 0.35) * (0.5 + wv * 0.8);
        }
        gl_FragColor = vec4(col, alpha);
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  mesh.name = 'water';
  let next = 0;
  const api = {
    mesh, uniforms,
    ripple(x, z, strength = 1) { ripples[next].set(x, z, U.uTime.value, strength); next = (next + 1) % MAX_RIPPLES; },
    setBoat(x, z, yaw, speed) { uniforms.uBoat.value.set(x, z, yaw, speed); },
  };
  return api;
}

// 瀑布：從崖頂溪口落下的水幕（往下捲動的白沫條紋），加上崖頂的一段溪流
export function buildFalls() {
  const g = new THREE.Group();
  const W = FALLS.width, H = FALLS.top + 0.4;
  const geo = new THREE.PlaneGeometry(W, H, 12, 16);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) + H / 2;        // 0（底）～H（頂）
    const t = 1 - y / H;
    p.setXYZ(i, p.getX(i) * (1 + t * 0.25), y, -Math.pow(1 - t, 2) * 0.0 + t * t * 2.2 - 0.6);
  }
  geo.computeVertexNormals();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uWaterShallow: U.uWaterShallow, ...THREE.UniformsLib.fog },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
    vertexShader: `varying vec2 vUv; varying float vY;\n#include <fog_pars_vertex>\nvoid main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition; vY = position.y;\n#include <fog_vertex>\n}`,
    fragmentShader: `uniform float uTime; uniform vec3 uWaterShallow; varying vec2 vUv; varying float vY;\n#include <fog_pars_fragment>\n
      float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.7); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 q = vec2(vUv.x * 18.0, vUv.y * 3.0 + uTime * 1.6);
        float s = vn(q) * 0.6 + vn(q * 2.7 + 5.0) * 0.4;
        float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
        vec3 col = mix(uWaterShallow * 1.1, vec3(0.95, 0.98, 0.97), smoothstep(0.35, 0.7, s));
        float a = (0.55 + s * 0.4) * edge;
        a *= smoothstep(0.0, 0.6, vY + 0.2);
        gl_FragColor = vec4(col, a);
        #include <fog_fragment>
      }`,
  });
  const sheet = new THREE.Mesh(geo, mat);
  sheet.position.set(FALLS.x, 0, FALLS.z + 0.8);
  sheet.renderOrder = 2;
  g.add(sheet);
  // 崖頂溪流
  const top = new THREE.Mesh(new THREE.PlaneGeometry(W + 1, 40).rotateX(-Math.PI / 2), mat.clone());
  top.material.uniforms = { ...mat.uniforms };
  top.position.set(FALLS.x, FALLS.top - 0.02, FALLS.z - 19.5);
  top.renderOrder = 2;
  g.add(top);
  g.name = 'falls';
  return g;
}
