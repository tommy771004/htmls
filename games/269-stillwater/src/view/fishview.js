// 魚：55 種魚的網格（長 1 m、頭朝 +Z）共用一個材質，擺尾在頂點著色器做（沿身體的波，越往尾越大），
// 水下依深度染成水色並帶焦散；牠們在河水之後畫（不被水面再蓋一層），水底有軟陰影。
// 釣點的魚群、隨處漫游的魚、上鉤的魚都用這裡的 InstancedMesh 池。
import * as THREE from 'three';
import { gltf, report } from './assets.js';
import { UNDERWATER_GLSL, U } from './shared.js';
import { byId } from '../core/fishdb.js';

const geos = {};
function fishGeo(id) {
  if (geos[id]) return geos[id];
  const key = 'f' + String(id).padStart(2, '0');
  const n = gltf.fish && gltf.fish.scene.getObjectByName(key);
  let g;
  if (n) {
    const m = n.isMesh ? n : n.getObjectByProperty('isMesh', true);
    g = m.geometry.clone();
    if (!n.isMesh) { n.updateWorldMatrix(true, true); m.updateWorldMatrix(true, false); g.applyMatrix4(new THREE.Matrix4().copy(n.matrixWorld).invert().multiply(m.matrixWorld)); }
    if (!g.attributes.color) { const c = new Float32Array(g.attributes.position.count * 3).fill(0.6); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
  } else {
    report.placeholders.add(key);
    g = new THREE.ConeGeometry(0.14, 1, 6).rotateX(Math.PI / 2);
    const c = new Float32Array(g.attributes.position.count * 3);
    const col = new THREE.Color().setHSL((id * 0.137) % 1, 0.35, 0.45);
    for (let i = 0; i < c.length; i += 3) { c[i] = col.r; c[i + 1] = col.g; c[i + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  if (g.index) g = g.toNonIndexed();
  g.computeVertexNormals();
  geos[id] = g;
  return g;
}

// 擺尾與水下染色。aSwim：x 相位、y 頻率、z 振幅（instanced）；單一網格用 uSwim
function swimMaterial(instanced, underwater = true) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.5, metalness: 0, side: THREE.DoubleSide });
  m.userData.uSwim = { value: new THREE.Vector4(0, 9, 0.12, 0) };
  m.userData.uGlow = { value: 0 };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, { uSwim: m.userData.uSwim, uGlow: m.userData.uGlow });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform vec4 uSwim; varying vec3 vWorldU;
        ${instanced ? 'attribute vec4 aSwim;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec4 sw = ${instanced ? 'aSwim' : 'uSwim'};
          float tail = smoothstep(0.32, -0.5, position.z);
          float wave = sin(uTime * sw.y + sw.x - position.z * 6.5);
          transformed.x += wave * sw.z * (0.06 + tail * 0.94);
          transformed.x -= sin(uTime * sw.y + sw.x) * sw.z * 0.25 * smoothstep(0.1, 0.5, position.z); }`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vWorldU = (modelMatrix * ${instanced ? 'instanceMatrix *' : ''} vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldU; uniform float uGlow;\n' + UNDERWATER_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
        ${underwater ? 'diffuseColor.rgb = underwater(diffuseColor.rgb, vWorldU, 0.5, 0.45);' : ''}`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uGlow;');
  };
  m.customProgramCacheKey = () => 'swim' + instanced + underwater;
  return m;
}

// 每個魚種一個 InstancedMesh 池
const POOL_CAP = 20;
export function createFishPools(scene) {
  const pools = new Map();
  const shadowGeo = new THREE.CircleGeometry(0.5, 14).rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x0c2422, transparent: true, opacity: 0.22, depthWrite: false });
  shadowMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vC;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvC = position.xz * 2.0;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vC;').replace('#include <opaque_fragment>', 'diffuseColor.a *= smoothstep(1.0, 0.2, length(vC));\n#include <opaque_fragment>');
  };
  const shadows = new THREE.InstancedMesh(shadowGeo, shadowMat, 400);
  shadows.count = 0; shadows.renderOrder = 0; shadows.frustumCulled = false;
  scene.add(shadows);
  function pool(id) {
    let p = pools.get(id);
    if (p) return p;
    const geo = fishGeo(id).clone();
    const swim = new THREE.InstancedBufferAttribute(new Float32Array(POOL_CAP * 4), 4);
    geo.setAttribute('aSwim', swim);
    const mesh = new THREE.InstancedMesh(geo, swimMaterial(true), POOL_CAP);
    mesh.count = 0; mesh.renderOrder = 3; mesh.frustumCulled = false;
    mesh.material.transparent = true;   // 排進透明佇列，在水面之後畫
    scene.add(mesh);
    p = { mesh, swim, used: 0 };
    pools.set(id, p);
    return p;
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  return {
    // 每幀先 begin()，再對每條魚 put()，最後 end()
    begin() { for (const p of pools.values()) p.used = 0; shadows.count = 0; },
    put(id, x, y, z, yaw, pitch, scale, phase, freq, amp, bedY) {
      const p = pool(id);
      if (p.used >= POOL_CAP) return;
      e.set(pitch, yaw, 0); q.setFromEuler(e); sc.setScalar(scale); ps.set(x, y, z);
      m4.compose(ps, q, sc);
      p.mesh.setMatrixAt(p.used, m4);
      p.swim.setXYZW(p.used, phase, freq, amp, 0);
      p.used++;
      if (bedY != null && shadows.count < 400 && y < -0.05) {
        const s = scale * (0.55 + Math.min(1.5, (y - bedY)) * 0.12);
        e.set(0, yaw, 0); q.setFromEuler(e); sc.set(s * 0.55, 1, s); ps.set(x, bedY + 0.04, z);
        m4.compose(ps, q, sc);
        shadows.setMatrixAt(shadows.count++, m4);
      }
    },
    end() {
      for (const p of pools.values()) { p.mesh.count = p.used; p.mesh.instanceMatrix.needsUpdate = true; p.swim.needsUpdate = true; }
      shadows.instanceMatrix.needsUpdate = true;
    },
  };
}

// 單一條魚（上鉤的魚、舉起來的魚、圖鑑與魚卡的肖像）
export function fishMesh(id, { underwater = true } = {}) {
  const m = new THREE.Mesh(fishGeo(id), swimMaterial(false, underwater));
  m.castShadow = !underwater;
  m.renderOrder = 3;
  if (underwater) m.material.transparent = true;
  const f = byId(id);
  m.scale.setScalar(displayLen(f));
  return m;
}
// 畫面上的體長：小魚稍微放大，俯視時才看得到
export const displayLen = (f, mult = 1) => Math.max(0.2, (f.len / 100) * mult * (f.len < 30 ? 1.35 : 1.08));
