// 天空：漸層 + 太陽光暈 + 卡通積雲（實例化、緩慢漂移）。由 render.js 建立。
import * as THREE from 'three';
import { mulberry32 } from './shared.js';
import { merge, tinted } from './geo.js';

export const SUN_DIR = new THREE.Vector3(0.52, 0.5, 0.46).normalize();
export const SKY = {
  top: new THREE.Color('#1d74e6'), mid: new THREE.Color('#62b8f7'), hor: new THREE.Color('#d6eefc'), fog: new THREE.Color('#bfe1f6'),
  // 風暴紫
  sTop: new THREE.Color('#2c1768'), sMid: new THREE.Color('#5b3aa6'), sHor: new THREE.Color('#9a78d8'), sFog: new THREE.Color('#7a55b8'),
};

export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uSun: { value: SUN_DIR }, uTop: { value: SKY.top.clone() }, uMid: { value: SKY.mid.clone() }, uHor: { value: SKY.hor.clone() },
      uGlow: { value: new THREE.Color('#ffd9a0') }, uK: { value: 0 },
    },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uSun,uTop,uMid,uHor,uGlow; uniform float uK; varying vec3 vD;
void main(){
  vec3 d = normalize(vD); float h = clamp(d.y,0.0,1.0);
  vec3 c = mix(uHor, uMid, smoothstep(0.0,0.22,h)); c = mix(c, uTop, smoothstep(0.18,0.85,h));
  float s = max(dot(d, normalize(uSun)),0.0);
  float glow = pow(s,6.0)*0.32 + pow(s,40.0)*0.35;
  c += uGlow * glow * (1.0 - uK*0.8);
  // 太陽盤（HDR，讓 bloom 抓到）
  c += vec3(1.0,0.96,0.82) * smoothstep(0.9988,0.9995,s) * 6.0 * (1.0 - uK);
  // 地平線下一律用地平線色，避免下半球露出
  if (d.y < 0.0) c = uHor;
  gl_FragColor = vec4(c,1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), mat);
  mesh.renderOrder = -10; mesh.frustumCulled = false;
  return { mesh, mat };
}

// 卡通積雲：幾顆壓扁的球疊成一團，底面平，頂白、底淡藍灰
function cloudGeo(seed) {
  const r = mulberry32(seed), parts = [];
  const n = 5 + r.int(3);
  for (let i = 0; i < n; i++) {
    const rad = 14 + r() * 14 * (1 - Math.abs(i - n / 2) / n);
    const g = new THREE.IcosahedronGeometry(rad, 2);
    const p = g.attributes.position, col = new Float32Array(p.count * 3);
    for (let k = 0; k < p.count; k++) {
      let y = p.getY(k); if (y < 0) { y *= 0.22; p.setY(k, y); }
      const t = Math.max(0, Math.min(1, (y + rad * 0.2) / (rad * 1.1)));
      col[k * 3] = 0.98 + 0.34 * t; col[k * 3 + 1] = 1.04 + 0.28 * t; col[k * 3 + 2] = 1.2 + 0.16 * t;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.translate((i - n / 2) * 20 + (r() - 0.5) * 8, rad * 0.35 - 6, (r() - 0.5) * 18);
    g.computeVertexNormals();
    parts.push(g);
  }
  return merge(parts);
}
export function makeClouds(scene) {
  const group = new THREE.Group(); group.frustumCulled = false;
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
  const r = mulberry32(77), meshes = [];
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), E = new THREE.Euler();
  for (let v = 0; v < 3; v++) {
    const count = 14, im = new THREE.InstancedMesh(cloudGeo(30 + v * 11), mat, count);
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2, d = 260 + r() * 800, y = 150 + r() * 130, s = 0.9 + r() * 1.5;
      M.compose(V.set(Math.cos(a) * d, y, Math.sin(a) * d), Q.setFromEuler(E.set(0, r() * 6.28, 0)), S.set(s * 1.6, s, s * 1.2));
      im.setMatrixAt(i, M);
    }
    im.frustumCulled = false; im.matrixAutoUpdate = false; im.renderOrder = -5;
    group.add(im); meshes.push(im);
  }
  scene.add(group);
  return { group, mat };
}
