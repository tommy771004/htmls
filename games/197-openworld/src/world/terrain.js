import * as THREE from 'three';
import { createNoise2D, fbm, smoothstep, lerp, clamp } from '../core/noise.js';

export const WORLD_SIZE = 1200; // 地形邊長（公尺）
export const WATER_LEVEL = 0;
export const SEED = 20261002;

const SEGMENTS = 256;
const CELL = WORLD_SIZE / SEGMENTS;
const HALF = WORLD_SIZE / 2;

// 營地：地形會被壓平，玩家出生點、營火、床都在這裡
export const CAMP = { x: 0, z: 0, r: 13, height: 2.6 };

// 固定挖出的湖，確保營地旁一定有可以划船的水域
export const LAKES = [
  { x: 72, z: -34, r: 62, depth: 7 },
  { x: -220, z: 170, r: 88, depth: 10 },
  { x: 190, z: 270, r: 52, depth: 6 },
  { x: -160, z: -260, r: 72, depth: 8 },
];

const nBase = createNoise2D(SEED);
const nDetail = createNoise2D(SEED + 1);
const nMask = createNoise2D(SEED + 2);
const nRidge = createNoise2D(SEED + 3);
const nShore = createNoise2D(SEED + 4);

/** 解析式高度函式（只在建 heightmap 時用，執行期一律查 heightmap） */
function rawHeight(x, z) {
  let h = 9 + fbm(nBase, x * 0.0022, z * 0.0022, 5) * 26 + nDetail(x * 0.012, z * 0.012) * 1.5;

  // 山脈：低頻遮罩 × ridged noise
  const mask = smoothstep(0.05, 0.6, nMask(x * 0.0012 + 50, z * 0.0012 - 20));
  const ridge = 1 - Math.abs(nRidge(x * 0.0042, z * 0.0042));
  h += mask * ridge * ridge * 48;

  // 營地壓平
  const dc = Math.hypot(x - CAMP.x, z - CAMP.z);
  h = lerp(h, CAMP.height, 1 - smoothstep(CAMP.r, CAMP.r + 16, dc));

  // 湖盆
  const warp = 1 + 0.16 * nShore(x * 0.018, z * 0.018);
  for (const lake of LAKES) {
    const t = (Math.hypot(x - lake.x, z - lake.z) / lake.r) * warp;
    if (t < 1.5) {
      const target = Math.min(-lake.depth * (1 - t * t), 1.4);
      h = lerp(h, target, 1 - smoothstep(0.9, 1.5, t));
    }
  }

  // 島嶼外緣沉入海中
  const d = Math.hypot(x, z) / HALF;
  h = lerp(h, -16, smoothstep(0.7, 0.97, d));
  return h;
}

const _n = new THREE.Vector3();

export class Terrain {
  /** @param surface buildTerrainSurface() 的回傳值 */
  constructor(surface) {
    const n = SEGMENTS + 1;
    this.surface = surface;
    this.size = WORLD_SIZE;
    this.heights = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        this.heights[j * n + i] = rawHeight(-HALF + i * CELL, -HALF + j * CELL);
      }
    }
    this.mesh = this.#buildMesh();
  }

  /** 與 render mesh 三角形完全一致的高度（a-c-b / b-c-d，對角線 b–c） */
  getHeight(x, z) {
    const n = SEGMENTS + 1;
    const gx = clamp((x + HALF) / CELL, 0, SEGMENTS - 1e-4);
    const gz = clamp((z + HALF) / CELL, 0, SEGMENTS - 1e-4);
    const i = Math.floor(gx);
    const j = Math.floor(gz);
    const fx = gx - i;
    const fz = gz - j;
    const k = j * n + i;
    const ha = this.heights[k];
    const hb = this.heights[k + 1];
    const hc = this.heights[k + n];
    const hd = this.heights[k + n + 1];
    if (fx + fz <= 1) return ha + (hb - ha) * fx + (hc - ha) * fz;
    return hd + (hc - hd) * (1 - fx) + (hb - hd) * (1 - fz);
  }

  getNormal(x, z, out = _n) {
    const e = 1.2;
    const hx = this.getHeight(x + e, z) - this.getHeight(x - e, z);
    const hz = this.getHeight(x, z + e) - this.getHeight(x, z - e);
    return out.set(-hx, 2 * e, -hz).normalize();
  }

  waterDepth(x, z) {
    return WATER_LEVEL - this.getHeight(x, z);
  }

  /** 這個位置長草／樹的適合度 0..1 */
  fertility(x, z) {
    const h = this.getHeight(x, z);
    if (h < 0.9 || h > 46) return 0;
    const ny = this.getNormal(x, z).y;
    if (ny < 0.62) return 0;
    const camp = smoothstep(8, 11, Math.hypot(x - CAMP.x, z - CAMP.z));
    return smoothstep(0.9, 2.2, h) * (1 - smoothstep(38, 46, h)) * smoothstep(0.62, 0.78, ny) * camp;
  }

  /** 沿射線步進找地形交點，回傳距離或 -1 */
  raycast(origin, dir, maxDist) {
    let prev = 0;
    const step = 0.75;
    for (let t = step; t <= maxDist; t += step) {
      const x = origin.x + dir.x * t;
      const y = origin.y + dir.y * t;
      const z = origin.z + dir.z * t;
      if (y <= this.getHeight(x, z)) {
        let lo = prev;
        let hi = t;
        for (let k = 0; k < 6; k++) {
          const mid = (lo + hi) / 2;
          const my = origin.y + dir.y * mid;
          if (my <= this.getHeight(origin.x + dir.x * mid, origin.z + dir.z * mid)) hi = mid;
          else lo = mid;
        }
        return hi;
      }
      prev = t;
    }
    return -1;
  }

  #buildMesh() {
    const n = SEGMENTS + 1;
    const pos = new Float32Array(n * n * 3);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        pos[k * 3] = -HALF + i * CELL;
        pos[k * 3 + 1] = this.heights[k];
        pos[k * 3 + 2] = -HALF + j * CELL;
      }
    }
    const index = new Uint32Array(SEGMENTS * SEGMENTS * 6);
    let q = 0;
    for (let j = 0; j < SEGMENTS; j++) {
      for (let i = 0; i < SEGMENTS; i++) {
        const a = j * n + i;
        const b = a + 1;
        const c = a + n;
        const d = c + 1;
        index[q++] = a; index[q++] = c; index[q++] = b;
        index[q++] = b; index[q++] = c; index[q++] = d;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    geo.computeVertexNormals();

    // 依高度與坡度算出各種地表的權重（岩石／沙／泥土／雪，其餘是草地）。
    // 顏色來自貼圖；頂點色只留一點大尺度的色偏，讓草地不會整片同一個綠。
    const normals = geo.attributes.normal.array;
    const colors = new Float32Array(n * n * 3);
    const splat = new Float32Array(n * n * 4);
    const nTint = createNoise2D(SEED + 9);
    const nDry = createNoise2D(SEED + 10);
    const nPatch = createNoise2D(SEED + 11);
    const nForest = createNoise2D(SEED + 101);
    for (let k = 0; k < n * n; k++) {
      const x = pos[k * 3];
      const h = pos[k * 3 + 1];
      const z = pos[k * 3 + 2];
      const ny = normals[k * 3 + 1];

      const rock = Math.max(1 - smoothstep(0.52, 0.72, ny), smoothstep(40, 52, h) * 0.8);
      const sand = 1 - smoothstep(0.7, 1.9, h);
      const snow = smoothstep(58, 68, h) * smoothstep(0.6, 0.8, ny);
      const dirt = (1 - smoothstep(7, 12, Math.hypot(x - CAMP.x, z - CAMP.z))) * 0.85;
      // 草地上零星的裸土斑塊；樹多的地方（與 scatter 用同一張森林密度圖）地面偏土
      const patch = smoothstep(0.5, 0.82, nPatch(x * 0.021, z * 0.021) * 0.5 + 0.5) * 0.55;
      const forest = smoothstep(0.58, 0.85, nForest(x * 0.0045, z * 0.0045) * 0.5 + 0.5) * 0.5;
      const wDirt = Math.max(dirt, Math.max(patch, forest) * (1 - sand) * (1 - rock));
      const wRock = rock * (1 - snow) * (1 - wDirt);
      const wSand = sand * (1 - wRock) * (1 - wDirt);
      splat[k * 4] = wRock;
      splat[k * 4 + 1] = wSand;
      splat[k * 4 + 2] = wDirt;
      splat[k * 4 + 3] = snow * (1 - wDirt);

      // 色偏：偏黃的乾草區與偏深的濕潤區交錯
      const tint = nTint(x * 0.008, z * 0.008) * 0.5 + 0.5;
      const dry = smoothstep(0.15, 0.7, nDry(x * 0.0035 + 9, z * 0.0035));
      colors[k * 3] = 0.78 + tint * 0.22 + dry * 0.16;
      colors[k * 3 + 1] = 0.84 + tint * 0.2 + dry * 0.02;
      colors[k * 3 + 2] = 0.78 + tint * 0.18 - dry * 0.12;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSplat', new THREE.BufferAttribute(splat, 4));

    const tex = this.surface;
    this.uniforms = {
      tGrass: { value: tex.grass },
      tRock: { value: tex.rock },
      tSand: { value: tex.sand },
      tDirt: { value: tex.dirt },
      uGrassTint: { value: tex.grassTint },
      tNormA: { value: tex.normalA },
      tRockN: { value: tex.rockNormal },
      tCaustics: { value: tex.caustics },
      uTime: { value: 0 },
      uCaustic: { value: 0 },
    };
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    mat.defines = tex.caustics ? { USE_CAUSTICS: '' } : {};
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 aSplat;\nvarying vec4 vSplat;\nvarying vec3 vWorldPos;\nvarying vec3 vWorldN;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplat = aSplat;\nvWorldPos = position;\nvWorldN = normal;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          /* glsl */ `#include <common>
          uniform sampler2D tGrass;
          uniform sampler2D tRock;
          uniform sampler2D tSand;
          uniform sampler2D tDirt;
          uniform vec4 uGrassTint;
          uniform sampler2D tNormA;
          uniform sampler2D tRockN;
          uniform sampler2D tCaustics;
          uniform float uTime;
          uniform float uCaustic;
          varying vec4 vSplat;
          varying vec3 vWorldPos;
          varying vec3 vWorldN;
          vec2 gNormalFlat;
          vec2 gNormalRock;
          float gRockSide;`,
        )
        .replace(
          '#include <map_fragment>',
          /* glsl */ `
          vec2 gp = vWorldPos.xz;
          float viewDist = length(vViewPosition);
          float farT = smoothstep(16.0, 75.0, viewDist);
          float wGrass = max(1.0 - vSplat.x - vSplat.y - vSplat.z - vSplat.w, 0.0);
          // 分支裡取樣貼圖時 mip 的導數會不連續，所以先在分支外算好再用 textureGrad
          vec2 dgx = dFdx(gp);
          vec2 dgy = dFdy(gp);
          vec3 albedo = vec3(0.9, 0.92, 0.96) * vSplat.w;
          gNormalFlat = vec2(0.0);
          gNormalRock = vec2(0.0);
          gRockSide = 0.0;
          float nFade = 1.0 - smoothstep(45.0, 150.0, viewDist) * 0.75;

          if (wGrass > 0.004) {
            // 草地：近處高頻、遠處改取大尺度，藏住貼圖的重複感；照片偏草皮的鮮綠，壓低飽和度
            vec3 grass = mix(textureGrad(tGrass, gp * 0.21, dgx * 0.21, dgy * 0.21).rgb,
                             textureGrad(tGrass, gp * 0.033, dgx * 0.033, dgy * 0.033).rgb, farT * 0.8);
            float gl = dot(grass, vec3(0.3, 0.59, 0.11));
            grass = mix(vec3(gl), grass, uGrassTint.w) * uGrassTint.rgb;
            albedo += grass * wGrass;
          }
          vec4 nA = textureGrad(tNormA, gp * 0.21, dgx * 0.21, dgy * 0.21);
          gNormalFlat = ((nA.rg * 2.0 - 1.0) * wGrass * 0.9 + (nA.ba * 2.0 - 1.0) * (vSplat.y + vSplat.z)) * nFade;

          if (vSplat.x > 0.004) {
            // 岩石在陡坡上：依法線朝向選 XY 或 ZY 投影，避免貼圖被拉長
            vec3 an = abs(normalize(vWorldN));
            gRockSide = smoothstep(0.35, 0.65, an.x / (an.x + an.z + 1e-4));
            vec2 uvXY = vWorldPos.xy * 0.19;
            vec2 uvZY = vWorldPos.zy * 0.19;
            vec2 dXYx = dFdx(uvXY); vec2 dXYy = dFdy(uvXY);
            vec2 dZYx = dFdx(uvZY); vec2 dZYy = dFdy(uvZY);
            vec3 rock = mix(textureGrad(tRock, uvXY, dXYx, dXYy).rgb, textureGrad(tRock, uvZY, dZYx, dZYy).rgb, gRockSide);
            // 遠處的岩壁收斂成平均色，避免貼圖重複排成一條條橫紋（掃描岩石的平均約 sRGB(79,76,69)）
            rock = mix(rock, vec3(0.085, 0.08, 0.068), farT * 0.65);
            albedo += rock * vSplat.x;
            vec2 rn = mix(textureGrad(tRockN, uvXY, dXYx, dXYy).rg, textureGrad(tRockN, uvZY, dZYx, dZYy).rg, gRockSide);
            gNormalRock = (rn * 2.0 - 1.0) * vSplat.x * nFade * 1.25;
          }
          if (vSplat.y > 0.004) albedo += textureGrad(tSand, gp * 0.31, dgx * 0.31, dgy * 0.31).rgb * vSplat.y;
          if (vSplat.z > 0.004) albedo += textureGrad(tDirt, gp * 0.27, dgx * 0.27, dgy * 0.27).rgb * vSplat.z;

          // 大尺度明暗（岩石貼圖的 alpha 是低頻 noise）
          float macro = textureGrad(tRock, gp * 0.0047, dgx * 0.0047, dgy * 0.0047).a;
          albedo *= 0.72 + macro * 0.56;

          // 水線附近與水下的地面是濕的：顏色變深
          float wet = 1.0 - smoothstep(-0.15, 0.45, vWorldPos.y);
          albedo *= mix(1.0, 0.55, wet);

          #ifdef USE_CAUSTICS
            if (vWorldPos.y < 0.05) {
              // 淺水處的水底焦散：兩層反向流動的紋理相乘
              float under = (1.0 - smoothstep(-0.5, 0.02, vWorldPos.y)) * exp(max(vWorldPos.y, -20.0) * 0.35);
              float c1 = textureGrad(tCaustics, gp * 0.16 + vec2(uTime * 0.021, uTime * 0.013), dgx * 0.16, dgy * 0.16).r;
              float c2 = textureGrad(tCaustics, gp * 0.21 - vec2(uTime * 0.017, -uTime * 0.019), dgx * 0.21, dgy * 0.21).r;
              albedo *= 1.0 + c1 * c2 * under * uCaustic * 9.0;
            }
          #endif
          diffuseColor.rgb *= albedo;`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          /* glsl */ `#include <normal_fragment_maps>
          {
            vec3 wn = inverseTransformDirection(normal, viewMatrix);
            wn.xz += gNormalFlat;
            // 岩石法線的 u 方向在世界座標是 X 或 Z（依投影面），v 方向是 Y
            wn += vec3(gNormalRock.x * (1.0 - gRockSide), gNormalRock.y, gNormalRock.x * gRockSide);
            normal = normalize((viewMatrix * vec4(normalize(wn), 0.0)).xyz);
          }`,
        );
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'terrain';
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    return mesh;
  }

  /** 高度圖貼圖（R = 公尺），水面 shader 用它算水深 */
  get heightTexture() {
    if (!this._heightTex) {
      const n = SEGMENTS + 1;
      // half float 在 WebGL2 一定能線性過濾（full float 需要額外 extension）
      const half = new Uint16Array(this.heights.length);
      for (let i = 0; i < half.length; i++) half[i] = THREE.DataUtils.toHalfFloat(this.heights[i]);
      const tex = new THREE.DataTexture(half, n, n, THREE.RedFormat, THREE.HalfFloatType);
      tex.minFilter = tex.magFilter = THREE.LinearFilter;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.needsUpdate = true;
      this._heightTex = tex;
    }
    return this._heightTex;
  }
}

export const HEIGHTMAP_SIZE = SEGMENTS + 1;

const srgb = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);

export const TERRAIN_COLORS = {
  grassA: srgb(0.30, 0.43, 0.16),
  grassB: srgb(0.40, 0.50, 0.20),
  sand: srgb(0.78, 0.71, 0.52),
  mud: srgb(0.33, 0.31, 0.24),
  rock: srgb(0.52, 0.5, 0.47),
  snow: srgb(0.93, 0.95, 0.97),
  dirt: srgb(0.42, 0.34, 0.24),
};
