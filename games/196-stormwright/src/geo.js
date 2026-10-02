// 幾何小工具：BoxBatch（盒子合併成單一 BufferGeometry + vertex color）、實例化材質、幾何合併。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const FACES = [
  [[1, 0, 0], [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]]],
  [[-1, 0, 0], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]]],
  [[0, 1, 0], [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]]],
  [[0, -1, 0], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]],
  [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]],
  [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]],
];
export class BoxBatch {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.idx = []; this.n = 0; }
  // 以 (cx,cy,cz) 為中心的盒，半長 hx,hy,hz，繞 Y 轉 yaw（先 tilt 再 yaw）；color 可為 hex 或 THREE.Color
  add(cx, cy, cz, hx, hy, hz, color, yaw = 0, tiltX = 0) {
    const c = color.isColor ? color : new THREE.Color(color);
    const cs = Math.cos(yaw), sn = Math.sin(yaw), ct = Math.cos(tiltX), st = Math.sin(tiltX);
    for (const [nrm, vs] of FACES) {
      const base = this.n;
      for (const v of vs) {
        let x = v[0] * hx, y = v[1] * hy, z = v[2] * hz;
        let y2 = y * ct - z * st, z2 = y * st + z * ct; y = y2; z = z2;
        this.pos.push(cx + x * cs + z * sn, cy + y, cz - x * sn + z * cs);
        let ny = nrm[1] * ct - nrm[2] * st, nz = nrm[1] * st + nrm[2] * ct;
        this.nor.push(nrm[0] * cs + nz * sn, ny, -nrm[0] * sn + nz * cs);
        this.col.push(c.r, c.g, c.b); this.n++;
      }
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return this;
  }
  // 併入任意 BufferGeometry（需 position/normal，可有 color），套用 matrix，色彩乘 color
  addGeo(geo, matrix, color = null) {
    const g = geo.index ? geo.toNonIndexed() : geo, p = g.attributes.position, nn = g.attributes.normal, cc = g.attributes.color;
    const v = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(matrix), c = color ? (color.isColor ? color : new THREE.Color(color)) : null;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix); this.pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(nn, i).applyMatrix3(nm).normalize(); this.nor.push(v.x, v.y, v.z);
      const r = cc ? cc.getX(i) : 1, gg = cc ? cc.getY(i) : 1, b = cc ? cc.getZ(i) : 1;
      this.col.push(c ? r * c.r : r, c ? gg * c.g : gg, c ? b * c.b : b);
      this.idx.push(this.n++);
    }
    return this;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}
const _mats = {};
export function vcMat(rough = 0.85, metal = 0) {
  const k = rough + '_' + metal;
  return (_mats[k] ||= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: metal }));
}

// 共用時間 uniform（render.js 每幀更新）：風吹擺動、水面、風車都讀它
export const TIME = { value: 0 };
export const WIND = { value: new THREE.Vector2(1, 0.4) };

// 標記幾何：aTint=1 的頂點顏色乘上 instanceColor（例如蘑菇傘、樹冠），其餘保持頂點色
export function tinted(geo, tint) {
  const n = geo.attributes.position.count, a = new Float32Array(n).fill(tint);
  geo.setAttribute('aTint', new THREE.BufferAttribute(a, 1));
  return geo;
}
export function paint(geo, color) {
  const c = new THREE.Color(color), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (!geo.attributes.aTint) tinted(geo, 0);
  return geo;
}
export function merge(list) {
  const ready = list.map((g) => { const x = g.index ? g.toNonIndexed() : g; if (!x.attributes.aTint) tinted(x, 0); if (!x.attributes.color) paint(x, '#ffffff'); x.deleteAttribute('uv'); return x; });
  return mergeGeometries(ready, false);
}
// 實例化材質：頂點色 + instanceColor 依 aTint 混合；sway>0 時依高度做風吹擺動；grass 時尖端漸淡
export function instMat({ rough = 0.85, metal = 0, sway = 0, flat = false, emissive = 0, fadeNear = 0 } = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: metal, flatShading: flat });
  if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = 1; }
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = TIME; sh.uniforms.uWind = WIND;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aTint; uniform float uTime; uniform vec2 uWind;')
      .replace('#include <color_vertex>', `#if defined( USE_COLOR )
  vColor = vec4(color.rgb, 1.0);
  #ifdef USE_INSTANCING_COLOR
  vColor.rgb = mix(vColor.rgb, vColor.rgb * instanceColor.rgb, aTint);
  #endif
#endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  ${sway ? `{ vec3 ip = vec3(instanceMatrix[3].x, 0.0, instanceMatrix[3].z); float ph = ip.x * 0.37 + ip.z * 0.29;
    float s = sin(uTime * 1.7 + ph) + 0.5 * sin(uTime * 3.1 + ph * 1.7);
    float k = ${sway.toFixed(3)} * max(position.y, 0.0);
    transformed.x += s * k * uWind.x; transformed.z += s * k * uWind.y; }` : ''}`);
  };
  m.customProgramCacheKey = () => 'inst' + sway + flat + emissive;
  return m;
}
export const Z_MAT = new THREE.Matrix4().makeScale(0, 0, 0);
