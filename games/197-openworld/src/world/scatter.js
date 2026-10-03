import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, createNoise2D, clamp, lerp } from '../core/noise.js';
import { WORLD_SIZE, CAMP, SEED } from './terrain.js';
import { LAYER_NO_REFLECT } from './environment.js';
import { buildBark, buildRockMaterialMaps, tintToMean } from './surface.js';
import { makeBroadleafAtlas, makeNeedleAtlas, buildBroadleafTree, buildConiferTree, buildShrub } from './foliage.js';

const CHUNK = 150; // 每塊各自一個 InstancedMesh，讓 frustum culling 有效
const LOD_DISTANCE = 185; // 超過這個距離的區塊改用低面數版本
const SHRUB_DISTANCE = 150;
const _c = new THREE.Color();
const _c2 = new THREE.Color();
const srgb = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

const WIND_PARS = '#include <common>\nuniform float uTime;\nuniform float uWind;\nuniform vec2 uWindDir;';
/** 植被的風：整棵樹緩慢擺動，越高擺越大；flutter > 0 時葉片再疊一層細碎的抖動 */
const windChunk = (sway, flutter) => /* glsl */ `#include <begin_vertex>
  #ifdef USE_INSTANCING
    vec3 treePos = instanceMatrix[3].xyz;
    float h = max(transformed.y, 0.0);
    float phase = treePos.x * 0.21 + treePos.z * 0.17;
    float gust = sin(uTime * 0.9 + phase) + 0.5 * sin(uTime * 2.3 + phase * 1.7);
    float amount = uWind * ${sway.toFixed(4)} * h * h * (0.45 + 0.4 * gust);
    transformed.xz += uWindDir * amount;
    float flutter = sin(uTime * 5.3 + transformed.x * 2.7 + transformed.y * 3.1 + transformed.z * 2.3 + phase);
    transformed += normal * flutter * uWind * ${flutter.toFixed(4)};
  #endif`;

function withWind(mat, wind, sway, flutter, key) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.(shader, renderer);
    Object.assign(shader.uniforms, wind);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', WIND_PARS).replace('#include <begin_vertex>', windChunk(sway, flutter));
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}

/** 葉片卡材質：alpha test、雙面但不翻轉法線（法線是「樹冠往外」的方向，不是卡片的面） */
function leafMaterial(map, wind, sway, key, tint = [0.6, 0.66, 0.5]) {
  const mat = new THREE.MeshLambertMaterial({ map, alphaTest: 0.42, side: THREE.DoubleSide, vertexColors: true });
  mat.color.setRGB(tint[0], tint[1], tint[2]); // 受光後會乘上約 2 倍的光量，底色要壓低才不會過亮
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      '#include <normal_fragment_begin>\nnormal = normalize(vNormal);',
    );
  };
  withWind(mat, wind, sway, 0.035, key);
  // 陰影也要依葉子的形狀鏤空，不然地上會是一張張方形的影子
  const depth = withWind(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.42 }), wind, sway, 0.035, key + '-depth');
  return { mat, depth };
}

function woodMaterial(bark, wind, sway, key) {
  const mat = new THREE.MeshLambertMaterial({ map: bark.map, normalMap: bark.normalMap, vertexColors: true });
  mat.normalScale.set(1.2, 1.2);
  return withWind(mat, wind, sway, 0, key);
}

/** 石頭材質：用世界座標做多平面投影貼岩石貼圖，不管石頭怎麼縮放旋轉紋理都不會被拉長 */
function rockMaterial(photos) {
  const maps = buildRockMaterialMaps(photos);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.tRock = { value: maps.map };
    shader.uniforms.tRockN = { value: maps.normalMap };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRockPos;\nvarying vec3 vRockN;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vRockPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          vRockN = normalize(mat3(modelMatrix * instanceMatrix) * objectNormal);
        #else
          vRockPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vRockN = normalize(mat3(modelMatrix) * objectNormal);
        #endif`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tRock;\nuniform sampler2D tRockN;\nvarying vec3 vRockPos;\nvarying vec3 vRockN;\nvec2 gRockPert;\nfloat gRockSide;\nfloat gRockTop;')
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
        vec3 an = abs(normalize(vRockN));
        gRockSide = smoothstep(0.35, 0.65, an.x / (an.x + an.z + 1e-4));
        gRockTop = smoothstep(0.55, 0.8, an.y);
        vec2 uvA = vRockPos.xy * 0.42;
        vec2 uvB = vRockPos.zy * 0.42;
        vec2 uvT = vRockPos.xz * 0.42;
        vec3 rc = mix(mix(texture2D(tRock, uvA).rgb, texture2D(tRock, uvB).rgb, gRockSide), texture2D(tRock, uvT).rgb, gRockTop);
        diffuseColor.rgb *= rc * 1.9;
        vec2 rn = mix(mix(texture2D(tRockN, uvA).rg, texture2D(tRockN, uvB).rg, gRockSide), texture2D(tRockN, uvT).rg, gRockTop);
        gRockPert = (rn * 2.0 - 1.0) * 1.3;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
        {
          vec3 wn = inverseTransformDirection(normal, viewMatrix);
          vec3 side = vec3(gRockPert.x * (1.0 - gRockSide), gRockPert.y, gRockPert.x * gRockSide);
          wn += mix(side, vec3(gRockPert.x, 0.0, gRockPert.y), gRockTop);
          normal = normalize((viewMatrix * vec4(normalize(wn), 0.0)).xyz);
        }`,
      );
  };
  return mat;
}

function rockGeometry(detail) {
  const geo = new THREE.IcosahedronGeometry(1, detail);
  const noise = createNoise2D(555);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    // 低頻決定整體輪廓、高頻做出稜角；底部壓扁讓石頭「坐」在地上
    const k = 1 + 0.3 * noise(x * 1.2 + y, z * 1.2 - y) + 0.12 * noise(x * 3.3 + y * 2, z * 3.3) + 0.04 * noise(x * 8, z * 8 + y * 6);
    p.setXYZ(i, x * k, y * k * (y < 0 ? 0.45 : 0.78), z * k);
  }
  geo.computeVertexNormals();
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const n = noise(p.getX(i) * 2.5 + 7, p.getZ(i) * 2.5 + y * 2) * 0.5 + 0.5;
    // 底部（貼地、潮濕）偏暗，頂面帶一點苔綠
    const c = mix3([0.55, 0.52, 0.48], [1.0, 0.99, 0.96], clamp(0.45 + y * 0.6, 0, 1));
    const m = mix3(c, [0.62, 0.78, 0.45], clamp((y - 0.3) * 1.8, 0, 1) * n * 0.55);
    _c.setRGB(m[0], m[1], m[2]);
    col[i * 3] = _c.r;
    col[i * 3 + 1] = _c.g;
    col[i * 3 + 2] = _c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/**
 * 把掃描模型的一個部件擺正：水平最長邊縮放成 width（null 保留原尺寸）、水平置中、底部往下埋 sink × 高度。
 * far（遠景幾何）套用同一組變換，近遠切換時才不會跳動。
 */
function fitScan(part, far, { width = null, sink = 0 } = {}) {
  const box = part.geometry.boundingBox;
  const size = box.getSize(new THREE.Vector3());
  const k = width ? width / Math.max(size.x, size.z) : 1;
  const m = new THREE.Matrix4()
    .makeScale(k, k, k)
    .multiply(new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y - size.y * sink, -(box.min.z + box.max.z) / 2));
  const material = part.material;
  if (!material.alphaTest) material.side = THREE.FrontSide; // 實心的岩石、樹幹不需要畫背面；蕨類葉片卡保留雙面
  return { near: part.geometry.clone().applyMatrix4(m), far: far ? far.clone().applyMatrix4(m) : null, material, size: size.multiplyScalar(k) };
}

function buildInstanced(scene, geometry, material, items, { castShadow = false, depthMaterial = null, layer = null } = {}) {
  const out = new Map();
  const byChunk = new Map();
  for (const it of items) {
    const k = Math.floor(it.x / CHUNK) + ':' + Math.floor(it.z / CHUNK);
    let list = byChunk.get(k);
    if (!list) byChunk.set(k, (list = []));
    list.push(it);
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const e = new THREE.Euler();
  for (const [key, list] of byChunk) {
    const mesh = new THREE.InstancedMesh(geometry, material, list.length);
    list.forEach((it, i) => {
      p.set(it.x, it.y, it.z);
      q.setFromEuler(e.set(it.tiltX ?? 0, it.yaw, it.tiltZ ?? 0));
      s.set(it.sx, it.sy, it.sz);
      mesh.setMatrixAt(i, m.compose(p, q, s));
      mesh.setColorAt(i, it.tint ? _c2.copy(it.tint) : _c2.setScalar(it.shade));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    if (depthMaterial) mesh.customDepthMaterial = depthMaterial;
    if (layer != null) mesh.layers.set(layer);
    mesh.computeBoundingSphere();
    scene.add(mesh);
    out.set(key, mesh);
  }
  return out;
}

/**
 * 林地的掃描模型：樹樁、倒木與蕨類，都擺在樹的附近。缺檔的種類就略過。
 * 用獨立的亂數序列，有沒有這些模型都不影響樹與石頭的位置。
 */
function scatterForestFloor(scene, terrain, colliders, scans, trees, register) {
  const rand = mulberry32(SEED + 300);
  const stumps = [];
  const trunks = [];
  const ferns = [];
  const nearTree = (min, max) => {
    const t = trees[Math.floor(rand() * trees.length)];
    const a = rand() * Math.PI * 2;
    const d = min + rand() * (max - min);
    return { x: t.x + Math.cos(a) * d, z: t.z + Math.sin(a) * d };
  };
  const clear = (x, z, r) => Math.hypot(x - CAMP.x, z - CAMP.z) > CAMP.r + r && terrain.getHeight(x, z) > 0.4;

  if (scans.stump && trees.length) {
    for (let i = 0; i < 110; i++) {
      const { x, z } = nearTree(2.2, 6);
      if (!clear(x, z, 4)) continue;
      const s = 1.0 + rand() * 0.45;
      const h = terrain.getHeight(x, z);
      stumps.push({ x, y: h, z, yaw: rand() * Math.PI * 2, sx: s, sy: s * (0.85 + rand() * 0.3), sz: s, shade: 0.85 + rand() * 0.25 });
      colliders.addCircle(x, z, 0.38 * s, h + 0.5 * s);
    }
  }
  if (scans.trunk && trees.length) {
    for (let i = 0; i < 80 && trunks.length < 55; i++) {
      const { x, z } = nearTree(3, 9);
      if (!clear(x, z, 6)) continue;
      const s = 1.35 + rand() * 0.6;
      const yaw = rand() * Math.PI * 2;
      // 原木長軸是模型的 X：順著坡度抬起一端（Euler XYZ 先繞 Z 轉，再繞 Y 轉向）
      const half = 1.5 * s;
      const dx = Math.cos(yaw) * half;
      const dz = -Math.sin(yaw) * half;
      const h0 = terrain.getHeight(x - dx, z - dz);
      const h1 = terrain.getHeight(x + dx, z + dz);
      if (Math.abs(h1 - h0) > 1.6) continue;
      const h = (h0 + h1) / 2;
      trunks.push({ x, y: h - 0.04, z, yaw, sx: s, sy: s, sz: s, tiltZ: Math.atan2(h1 - h0, half * 2), shade: 0.85 + rand() * 0.25 });
      for (const t of [-0.6, 0, 0.6]) colliders.addCircle(x + dx * t, z + dz * t, 0.2 * s, h + 0.3 * s);
    }
  }
  if (scans.fern && trees.length) {
    for (let i = 0; i < 420; i++) {
      const { x, z } = nearTree(0.8, 5);
      if (!clear(x, z, 3)) continue;
      const s = 1.4 + rand() * 0.8;
      ferns.push({ x, y: terrain.getHeight(x, z) - 0.02, z, yaw: rand() * Math.PI * 2, sx: s, sy: s * (0.85 + rand() * 0.3), sz: s, shade: 0.8 + rand() * 0.3 });
    }
  }

  const place = (scan, items, opts, distance) => {
    if (!items.length) return;
    const kind = fitScan(scan.parts[0], scan.far?.[0], opts);
    register(
      [buildInstanced(scene, kind.near, kind.material, items, { castShadow: true, layer: LAYER_NO_REFLECT })],
      kind.far ? buildInstanced(scene, kind.far, kind.material, items, { layer: LAYER_NO_REFLECT }) : null,
      distance,
    );
  };
  // 原始尺寸：樹樁含根部約 1.4 公尺寬、倒木約 3 公尺長、蕨類 0.2–0.4 公尺高（個體縮放再放大成林地的尺度）
  if (scans.stump) place(scans.stump, stumps, { sink: 0.06 }, 110);
  if (scans.trunk) place(scans.trunk, trunks, { sink: 0.18 }, 110);
  if (scans.fern && ferns.length) {
    // 四株大小不同的蕨類併成一叢（一個 InstancedMesh、一次 draw call）；很矮又多，只在近處畫、不投影
    const OFFSETS = [[0, 0, 0], [0.42, 0.14, 1.9], [-0.2, 0.38, 3.6], [0.25, -0.34, 5.1]];
    const parts = scans.fern.parts.map((part, k) => {
      const fit = fitScan(part, null, { sink: 0.04 });
      const [ox, oz, yaw] = OFFSETS[k % OFFSETS.length];
      return fit.near.applyMatrix4(new THREE.Matrix4().makeRotationY(yaw).setPosition(ox, 0, oz));
    });
    const clump = mergeGeometries(parts);
    register([buildInstanced(scene, clump, scans.fern.parts[0].material, ferns, { layer: LAYER_NO_REFLECT })], null, 120);
  }
  return { stumps, trunks, ferns };
}

/** 樹、灌木與石頭：只放一次，之後只有風的 uniform 與 LOD 切換會動 */
export function scatterWorld(scene, terrain, colliders, photos = {}, scans = {}) {
  const rand = mulberry32(SEED + 100);
  const forest = createNoise2D(SEED + 101);
  const half = WORLD_SIZE / 2;
  const conifers = [];
  const broadleaves = [];
  const shrubs = [];
  const rocks = [];
  const tints = [srgb(1, 1, 1), srgb(1, 0.97, 0.86), srgb(0.9, 1, 0.9), srgb(1, 0.92, 0.78)];

  for (let i = 0; i < 5200; i++) {
    const x = (rand() * 2 - 1) * half * 0.93;
    const z = (rand() * 2 - 1) * half * 0.93;
    const f = terrain.fertility(x, z);
    const density = forest(x * 0.0045, z * 0.0045) * 0.5 + 0.5;
    const roll = rand();
    const kind = rand();
    const scale = 0.8 + rand() * 0.75;
    const yaw = rand() * Math.PI * 2;
    const shade = 0.85 + rand() * 0.3;
    const tintRoll = rand();
    if (f < 0.35 || roll > density * density * 1.25) continue;
    if (Math.hypot(x - CAMP.x, z - CAMP.z) < CAMP.r + 6) continue;
    const y = terrain.getHeight(x, z) - 0.15;
    const conifer = kind < 0.35 + (y > 22 ? 0.5 : 0);
    const tint = tints[Math.floor(tintRoll * tints.length)].clone().multiplyScalar(shade);
    const tree = { x, y, z, yaw, sx: scale, sy: scale * (0.9 + rand() * 0.25), sz: scale, shade, tint };
    (conifer ? conifers : broadleaves).push(tree);
    colliders.addCircle(x, z, 0.3 * scale, y + (conifer ? 9 : 6) * tree.sy);
  }

  for (let i = 0; i < 2600; i++) {
    const x = (rand() * 2 - 1) * half * 0.92;
    const z = (rand() * 2 - 1) * half * 0.92;
    const s = 0.7 + rand() * 0.9;
    const yaw = rand() * Math.PI * 2;
    const shade = 0.8 + rand() * 0.35;
    const roll = rand();
    const f = terrain.fertility(x, z);
    const density = forest(x * 0.0045 + 3, z * 0.0045) * 0.5 + 0.5;
    if (f < 0.4 || roll > 0.15 + density * 0.7) continue;
    if (Math.hypot(x - CAMP.x, z - CAMP.z) < CAMP.r + 3) continue;
    shrubs.push({ x, y: terrain.getHeight(x, z) - 0.03, z, yaw, sx: s, sy: s * (0.8 + rand() * 0.4), sz: s, shade });
  }

  for (let i = 0; i < 420; i++) {
    const x = (rand() * 2 - 1) * half * 0.9;
    const z = (rand() * 2 - 1) * half * 0.9;
    const s = 0.35 + rand() * rand() * 2.6;
    const yaw = rand() * Math.PI * 2;
    const sy = 0.7 + rand() * 0.6;
    const shade = 0.85 + rand() * 0.3;
    const tiltX = (rand() - 0.5) * 0.5;
    const tiltZ = (rand() - 0.5) * 0.5;
    const h = terrain.getHeight(x, z);
    if (h < -1.5 || Math.hypot(x - CAMP.x, z - CAMP.z) < CAMP.r + 3) continue;
    rocks.push({ x, y: h + s * 0.05, z, yaw, sx: s, sy: s * sy, sz: s * (0.8 + rand() * 0.4), shade, tiltX, tiltZ });
    if (s > 0.8) colliders.addCircle(x, z, s * 0.8, h + s * sy * 0.6);
  }

  const wind = { uTime: { value: 0 }, uWind: { value: 0.3 }, uWindDir: { value: new THREE.Vector2(1, 0) } };
  const broadAtlas = makeBroadleafAtlas(photos);
  const needleAtlas = makeNeedleAtlas(photos);
  // 闊葉照片平均約 sRGB(114,143,71)，直接用會是一片亮黃綠；壓到夏季樹冠的深綠（受光後約亮一倍）
  const broadTint = photos.leaves ? tintToMean(photos.leaves.image, [60, 84, 34]).toArray() : [0.6, 0.66, 0.5];
  const leafTint = { broad: broadTint, conifer: photos.conifer ? [0.62, 0.66, 0.6] : [0.6, 0.66, 0.5] };
  const lods = [];
  const centre = (key) => key.split(':').map((n) => (Number(n) + 0.5) * CHUNK);
  const register = (high, low, distance) => {
    for (const key of high[0].keys()) {
      const [cx, cz] = centre(key);
      lods.push({ high: high.map((m) => m.get(key)), low: low ? low.get(key) : null, cx, cz, distance });
    }
  };

  // 每個樹種：近景 = 樹幹（樹皮貼圖＋法線）＋葉片卡；遠景 = 併成一個 mesh 的低面數版
  const species = [
    { items: broadleaves, build: buildBroadleafTree, atlas: broadAtlas, bark: 'oak', sway: 0.0055, seed: 41, key: 'broad' },
    { items: conifers, build: buildConiferTree, atlas: needleAtlas, bark: 'pine', sway: 0.0024, seed: 42, key: 'conifer' },
  ];
  for (const sp of species) {
    const leaf = leafMaterial(sp.atlas, wind, sp.sway, sp.key + '-leaf', leafTint[sp.key]);
    const wood = woodMaterial(buildBark(sp.bark, photos), wind, sp.sway, sp.key + '-wood');
    const hi = sp.build(sp.seed, false);
    const lo = sp.build(sp.seed, true);
    register(
      [
        buildInstanced(scene, hi.wood, wood, sp.items, { castShadow: true }),
        buildInstanced(scene, hi.leaves, leaf.mat, sp.items, { castShadow: true, depthMaterial: leaf.depth }),
      ],
      buildInstanced(scene, lo.leaves, leaf.mat, sp.items),
      LOD_DISTANCE,
    );
  }

  // 灌木與石頭很矮，倒影裡幾乎看不到，不進水面反射 pass
  const shrubLeaf = leafMaterial(broadAtlas, wind, 0.05, 'shrub-leaf', leafTint.broad);
  register([buildInstanced(scene, buildShrub(43), shrubLeaf.mat, shrubs, { layer: LAYER_NO_REFLECT })], null, SHRUB_DISTANCE);
  const rockMat = rockMaterial(photos);
  if (scans.rockSmall && scans.rockLarge) {
    // 有掃描岩石就換掉程序生成的：小的用風化石塊，大的用岩塊；寬度對齊程序石頭（約 2 公尺 × 個體縮放）
    const kinds = [fitScan(scans.rockSmall.parts[0], scans.rockSmall.far?.[0], { width: 2, sink: 0.25 }), fitScan(scans.rockLarge.parts[0], scans.rockLarge.far?.[0], { width: 2, sink: 0.2 })];
    kinds.forEach((kind, i) => {
      // 掃描岩石偏亮偏黃（砂岩色），在強環境光下近乎發白；拉到跟地形岩壁相近的灰褐
      if (kind.material.map?.image) kind.material.color.copy(tintToMean(kind.material.map.image, [92, 84, 70]));
      const items = rocks.filter((r) => (r.sx >= 1.05) === (i === 1));
      register(
        [buildInstanced(scene, kind.near, kind.material, items, { castShadow: true, layer: LAYER_NO_REFLECT })],
        buildInstanced(scene, kind.far ?? kind.near, kind.material, items, { layer: LAYER_NO_REFLECT }),
        110,
      );
    });
  } else {
    register(
      [buildInstanced(scene, rockGeometry(2), rockMat, rocks, { castShadow: true, layer: LAYER_NO_REFLECT })],
      buildInstanced(scene, rockGeometry(0), rockMat, rocks, { layer: LAYER_NO_REFLECT }),
      110,
    );
  }
  const forestFloor = scatterForestFloor(scene, terrain, colliders, scans, [...broadleaves, ...conifers], register);

  return {
    trees: conifers.length + broadleaves.length,
    bushes: shrubs.length,
    rocks: rocks.length,
    // 除錯與截圖用：各類擺放位置
    spots: { conifers, broadleaves, shrubs, rocks, ...forestFloor },
    update(dt, env, camPos) {
      for (const lod of lods) {
        const near = Math.hypot(lod.cx - camPos.x, lod.cz - camPos.z) < lod.distance;
        for (const m of lod.high) m.visible = near;
        if (lod.low) lod.low.visible = !near;
      }
      wind.uTime.value += dt;
      wind.uWind.value = env.wind.strength;
      wind.uWindDir.value.copy(env.wind.dir);
    },
  };
}
