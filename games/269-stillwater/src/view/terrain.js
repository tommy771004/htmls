// 地形：由高度格建網格，頂點色依生態區（草地、松林地被、花崗岩、苔崖）、坡度與高度（岸邊卵石、河床）決定；
// 平面著色的低多邊形，水下部分加焦散。另外輸出水深貼圖（半浮點）給河水著色器算深淺與岸邊白沫。
import * as THREE from 'three';
import { SAMPLES, nearest } from '../core/map.js';
import { vnoise, fbm, hash2 } from '../core/rng.js';
import { patchUnderwater } from './shared.js';

const C = (h) => new THREE.Color(h);
// 依控制點小數索引 u 的各區色票（五區之間平滑過渡）
const ZONE_U = [0, 2.9, 7.75, 11.6, 15.6, 18];
const PAL = [
  { grass: C('#8fae5a'), grass2: C('#a3b863'), shore: C('#c8b48c'), bed: C('#b2a07c'), rock: C('#8f8b80') },
  { grass: C('#86a656'), grass2: C('#9db35e'), shore: C('#bfae8a'), bed: C('#9c8f78'), rock: C('#8f8b80') },
  { grass: C('#6f7e4a'), grass2: C('#7d6c48'), shore: C('#a99a78'), bed: C('#857a66'), rock: C('#7c786f') },
  { grass: C('#74885a'), grass2: C('#8c8a78'), shore: C('#a7a197'), bed: C('#8a857a'), rock: C('#a39f95') },
  { grass: C('#6f8c5c'), grass2: C('#5f7a52'), shore: C('#9f9a8e'), bed: C('#6f6c64'), rock: C('#7d7a72') },
];
function palAt(u) {
  let z = 0;
  while (z < 4 && u > ZONE_U[z + 1]) z++;
  const a = PAL[z], b = PAL[Math.min(4, z + 1)];
  const edge = ZONE_U[z + 1];
  const t = z < 4 ? THREE.MathUtils.smoothstep(u, edge - 0.35, edge + 0.35) : 0;
  const o = {};
  for (const k of Object.keys(a)) o[k] = a[k].clone().lerp(b[k], t);
  return o;
}

export function buildTerrain(grid) {
  const { nx, nz, step, x0, z0, h } = grid;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3);
  const tmp = new THREE.Color();
  const cache = new Map();
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const o = j * nx + i, x = x0 + i * step, z = z0 + j * step;
    // 頂點略抖動（低多邊形手作感），岸線附近不抖以免露縫
    const jx = (hash2(i, j) - 0.5) * step * 0.35, jz = (hash2(j + 91, i) - 0.5) * step * 0.35;
    const y = h[o];
    pos[o * 3] = x + jx; pos[o * 3 + 1] = y; pos[o * 3 + 2] = z + jz;
    // 坡度
    const hl = h[j * nx + Math.max(0, i - 1)], hr = h[j * nx + Math.min(nx - 1, i + 1)];
    const hu = h[Math.max(0, j - 1) * nx + i], hd = h[Math.min(nz - 1, j + 1) * nx + i];
    const slope = Math.hypot(hr - hl, hd - hu) / (2 * step);
    const key = Math.round(SAMPLES.u[nearest(x, z).i] * 20);
    let P = cache.get(key);
    if (!P) { P = palAt(key / 20); cache.set(key, P); }
    const n = fbm(x * 0.09, z * 0.09, 2), n2 = vnoise(x * 0.4, z * 0.4);
    if (y < -0.15) {
      tmp.copy(P.bed).lerp(P.shore, n2 * 0.35);
      tmp.multiplyScalar(0.92 + n * 0.16 - Math.min(0.25, -y * 0.04));
    } else if (y < 0.55) {
      tmp.copy(P.shore).lerp(P.bed, 0.25 + n2 * 0.3);
      if (y > 0.25) tmp.lerp(P.grass, (y - 0.25) / 0.3);
    } else {
      tmp.copy(P.grass).lerp(P.grass2, THREE.MathUtils.smoothstep(n, 0.35, 0.7));
      const rocky = THREE.MathUtils.smoothstep(slope, 0.75, 1.3);
      tmp.lerp(P.rock, rocky);
      if (y > 10 && slope < 0.5) tmp.lerp(P.grass2, 0.4);        // 崖頂平台長苔
      tmp.multiplyScalar(0.93 + n2 * 0.14);
    }
    col[o * 3] = tmp.r; col[o * 3 + 1] = tmp.g; col[o * 3 + 2] = tmp.b;
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let k = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    // 交錯對角線，避免一整片同方向的三角形
    if ((i + j) & 1) { idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d; }
    else { idx[k++] = a; idx[k++] = c; idx[k++] = d; idx[k++] = a; idx[k++] = d; idx[k++] = b; }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  const mat = patchUnderwater(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 }), 0.15, 1);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

// 水深貼圖：R = 地形高度（公尺），半浮點、線性內插
export function heightTexture(grid) {
  const { nx, nz, h } = grid;
  const data = new Uint16Array(nx * nz);
  for (let i = 0; i < nx * nz; i++) data[i] = THREE.DataUtils.toHalfFloat(h[i]);
  const tex = new THREE.DataTexture(data, nx, nz, THREE.RedFormat, THREE.HalfFloatType);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}
