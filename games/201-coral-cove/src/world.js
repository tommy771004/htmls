// 場景：低多邊形海床、棧橋、船（含繫船繩）、木箱、魚簍、沙灘植物、珊瑚礁群、海草、貝殼海星，與水面用的深度貼圖。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { floorY, shoreDist, rng, REEFS, PIER, BOAT, DECOR, pierFoot, boatFoot, defaultPiles } from './terrain.js';
import { getStatic, getSeaweed, findClip, shadowify } from './assets.js';
import { patchUnderwater } from './underwater.js';

const SAND = new THREE.Color('#f2dfb8'), WET = new THREE.Color('#e3c595'), SUB = new THREE.Color('#ead7ad'), DEEP = new THREE.Color('#dccaa0');
function floorColor(c, ya) {
  if (ya > 0.32) c.copy(SAND); else if (ya > 0.02) c.copy(WET).lerp(SAND, Math.max(0, (ya - 0.02) / 0.3) ** 2);
  else if (ya > -1.2) c.copy(WET).lerp(SUB, Math.min(1, -ya / 0.6)); else c.copy(SUB).lerp(DEEP, Math.min(1, (-ya - 1.2) / 2.2));
  return c;
}

// 礁石與珊瑚的障礙（fish.js 用來避開與限制高度）：{ x, z, r＝佔地半徑, top＝頂高, y＝底高 }
export const REEF_OBST = [];
// 水面著色器要的資料（water.js 讀）：木樁／梯腳 [x, z, 半徑]，船身吃水線的半寬表
export const WATER_FX = { piles: [], hull: null };

// ---- 海床 ----
// 內圈細格（分塊，視錐剔除才有效）＋外圈 8 m 粗格。外圈格點 X = −164 + 8i、Z = −168 + 8j，
// 內圈四邊都落在格點線上；內圈邊界的頂點不抖動、高度取兩個外圈格點之間的線性內插，
// 兩塊網格在接縫上是同一條折線，不會有縫或高低差。內圈涵蓋整座島（南岸約 z 38.5）以外。
const FLOOR = { x0: -44, x1: 44, z0: -48, z1: 56 };
const CO = 8, OX = -164, OZ = -168, ONX = 41, ONZ = 42;
function edgeLerp(fixed, v, o, alongX) {
  const k = Math.floor((v - o) / CO), a = o + k * CO, t = (v - a) / CO;
  const f = (u) => (alongX ? floorY(u, fixed) : floorY(fixed, u));
  return t < 1e-6 ? f(a) : f(a) * (1 - t) + f(a + CO) * t;
}
function buildFloor(step, seed, tiles) {
  const nx = Math.round((FLOOR.x1 - FLOOR.x0) / step), nz = Math.round((FLOOR.z1 - FLOOR.z0) / step);
  const sx = (FLOOR.x1 - FLOOR.x0) / nx, sz = (FLOOR.z1 - FLOOR.z0) / nz, r = rng(seed);
  const H = new Float32Array((nx + 1) * (nz + 1) * 3), J = new Float32Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const edge = i === 0 || i === nx || j === 0 || j === nz;
    const jx = (r() - 0.5) * sx * 0.45, jz = (r() - 0.5) * sz * 0.45, jy = (r() - 0.5) * 0.05;
    const x = FLOOR.x0 + i * sx + (edge ? 0 : jx), z = FLOOR.z0 + j * sz + (edge ? 0 : jz);
    let y;
    if (i === 0 || i === nx) y = edgeLerp(x, z, OZ, false);
    else if (j === 0 || j === nz) y = edgeLerp(z, x, OX, true);
    else y = floorY(x, z) + jy;
    const k = j * (nx + 1) + i;
    H[k * 3] = x; H[k * 3 + 1] = y; H[k * 3 + 2] = z; J[k] = r();
  }
  const T = tiles, buckets = Array.from({ length: T * T }, () => ({ pos: [], col: [] }));
  const c = new THREE.Color();
  const tri = (bk, a, b, d) => {
    floorColor(c, (H[a * 3 + 1] + H[b * 3 + 1] + H[d * 3 + 1]) / 3).multiplyScalar(0.97 + J[a] * 0.06);
    for (const k of [a, b, d]) { bk.pos.push(H[k * 3], H[k * 3 + 1], H[k * 3 + 2]); bk.col.push(c.r, c.g, c.b); }
  };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const bk = buckets[Math.floor((j * T) / nz) * T + Math.floor((i * T) / nx)];
    const a = j * (nx + 1) + i, b = a + 1, d = a + nx + 1, e = d + 1;
    if ((i + j) % 2) { tri(bk, a, d, b); tri(bk, b, d, e); } else { tri(bk, a, d, e); tri(bk, a, e, b); }
  }
  return buckets.map((bk) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(bk.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(bk.col, 3));
    g.computeVertexNormals();
    return g;
  });
}
function buildOuterFloor(seed) {
  const r = rng(seed), pos = [], col = [], c = new THREE.Color();
  const Y = [];
  for (let j = 0; j <= ONZ; j++) for (let i = 0; i <= ONX; i++) Y.push(floorY(OX + i * CO, OZ + j * CO));
  const P = (i, j) => [OX + i * CO, Y[j * (ONX + 1) + i], OZ + j * CO];
  for (let j = 0; j < ONZ; j++) for (let i = 0; i < ONX; i++) {
    const x0 = OX + i * CO, z0 = OZ + j * CO;
    if (x0 >= FLOOR.x0 && x0 + CO <= FLOOR.x1 && z0 >= FLOOR.z0 && z0 + CO <= FLOOR.z1) continue;
    const a = P(i, j), b = P(i + 1, j), d = P(i, j + 1), e = P(i + 1, j + 1);
    const v = 0.97 + r() * 0.06;
    for (const t of (i + j) % 2 ? [[a, d, b], [b, d, e]] : [[a, d, e], [a, e, b]]) {
      floorColor(c, (t[0][1] + t[1][1] + t[2][1]) / 3).multiplyScalar(v);
      for (const p of t) { pos.push(...p); col.push(c.r, c.g, c.b); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// 從棧橋模型的頂點量出木樁位置（水面下的頂點依 xz 分群）
function measurePiles(pier) {
  const pts = [];
  pier.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  pier.traverse((o) => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i += 1) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      if (v.y < -1.2) pts.push([v.x, v.z]);
    }
  });
  const cells = new Map();
  for (const [x, z] of pts) {
    const k = Math.round(x / 0.6) + ',' + Math.round(z / 0.6);
    const c = cells.get(k) || { x: 0, z: 0, n: 0 }; c.x += x; c.z += z; c.n++; cells.set(k, c);
  }
  const out = [];
  for (const c of cells.values()) {
    const p = [c.x / c.n, c.z / c.n];
    if (!out.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.5)) out.push(p);
  }
  return out;
}

// ---- 合批 ----
// 把一個物件（含子網格、多材質）烘成「頂點色＝材質底色」的非索引幾何，依材質的 side 分開。
// rel：世界→合批座標的矩陣（null＝世界座標）。所有靜態材質都只有底色與相近的粗糙度，烘成頂點色不會改變外觀。
const _m = new THREE.Matrix4();
function bakeParts(root, rel, out = { 0: [], 2: [] }) {
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const total = geo.attributes.position.count;
    const groups = Array.isArray(o.material) && o.geometry.groups.length ? o.geometry.groups : [{ start: 0, count: total, materialIndex: 0 }];
    _m.copy(o.matrixWorld); if (rel) _m.premultiply(rel);
    for (const gr of groups) {
      const m = ms[gr.materialIndex] || ms[0];
      const s = gr.start, n = Math.min(gr.count, total - s);
      if (n <= 0) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(geo.attributes.position.array.slice(s * 3, (s + n) * 3), 3));
      if (geo.attributes.normal) g.setAttribute('normal', new THREE.BufferAttribute(geo.attributes.normal.array.slice(s * 3, (s + n) * 3), 3));
      else g.computeVertexNormals();
      const base = m.color || new THREE.Color(1, 1, 1), vc = m.vertexColors && geo.attributes.color, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        col[i * 3] = base.r * (vc ? vc.getX(s + i) : 1); col[i * 3 + 1] = base.g * (vc ? vc.getY(s + i) : 1); col[i * 3 + 2] = base.b * (vc ? vc.getZ(s + i) : 1);
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.applyMatrix4(_m);
      out[m.side === THREE.DoubleSide ? 2 : 0].push(g);
    }
  });
  return out;
}
const bakedMats = {};
// hue＝false：水下不保留高彩度底色的色相（木頭類，見 underwater.js）
function bakedMat(side, rough = 0.9, hue = true) {
  const k = side + ':' + rough + ':' + hue;
  if (!bakedMats[k]) {
    bakedMats[k] = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: rough, metalness: 0, side: side === 2 ? THREE.DoubleSide : THREE.FrontSide });
    patchUnderwater(bakedMats[k], { hue });
  }
  return bakedMats[k];
}
// 一個物件烘成單一網格（全部 DoubleSide 的道具用，例如棧橋、魚簍）
function bakeOne(root, mat, rel) {
  const parts = bakeParts(root, rel);
  const list = [...parts[0], ...parts[2]];
  const mesh = new THREE.Mesh(list.length ? mergeGeometries(list) : new THREE.BufferGeometry(), mat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
// 靜態礁石、珊瑚與植物：依 CELL m 的空間格子 × side 合批。每格一個網格、包圍球只涵蓋那一格，
// 主畫面與陰影相機都能剔除畫面外的格子。
const CELL = 10;
function mergeStatics(group, items) {
  const cells = new Map();
  for (const o of items) {
    const key = Math.floor(o.position.x / CELL) + ',' + Math.floor(o.position.z / CELL);
    if (!cells.has(key)) cells.set(key, { 0: [], 2: [] });
    bakeParts(o, null, cells.get(key));
  }
  for (const [key, parts] of cells) {
    for (const side of [0, 2]) {
      if (!parts[side].length) continue;
      const mesh = new THREE.Mesh(mergeGeometries(parts[side]), bakedMat(side));
      mesh.name = 'statics_' + key + '_' + side;
      mesh.castShadow = true; mesh.receiveShadow = true;
      group.add(mesh);
    }
  }
}

// ---- 船 ----
// 船身的斷面表（和 blender/props.py build_boat() 的 KEY 相同）：s＝0 船頭、1 船尾板；半寬、龍骨高、舷緣高（船本地 y）
const HULL_L = 3.14;
const HULL_KEY = [[0.0, 0.03, -0.04, 0.44], [0.08, 0.23, -0.16, 0.36], [0.2, 0.44, -0.25, 0.3], [0.35, 0.575, -0.29, 0.265],
  [0.5, 0.62, -0.3, 0.25], [0.65, 0.61, -0.3, 0.255], [0.8, 0.575, -0.285, 0.27], [0.92, 0.53, -0.265, 0.29], [1.0, 0.48, -0.24, 0.31]];
// 某斷面在高度 h 的船殼半寬（props.py section() 的輪廓：舷緣→龍骨五個點）
function hullHalf(w, d, g, h) {
  const prof = [[w, g], [0.93 * w, g + (d - g) * 0.45], [0.72 * w, d + 0.07], [0.36 * w, d + 0.012], [0, d]];
  if (h >= g) return w;
  for (let i = 0; i < prof.length - 1; i++) {
    const [x0, y0] = prof[i], [x1, y1] = prof[i + 1];
    if (h <= y0 && h >= y1) return x0 + (x1 - x0) * ((y0 - h) / Math.max(1e-6, y0 - y1));
  }
  return 0;
}
// 船艙口遮罩：船本地 y＝h 的船殼內輪廓，只寫深度不寫顏色，排在不透明物件之後、水面之前，
// 水面在船艙裡被深度測試擋掉，船起伏時也跟著船走（h 高於起伏與搖晃時的水面）。
function hullCap(h, inset) {
  const right = [];
  for (let k = 0; k <= 24; k++) {
    const s = k / 24;
    let a = HULL_KEY[0], b = HULL_KEY[1];
    for (let i = 0; i < HULL_KEY.length - 1; i++) if (s >= HULL_KEY[i][0] && s <= HULL_KEY[i + 1][0]) { a = HULL_KEY[i]; b = HULL_KEY[i + 1]; break; }
    const t = (s - a[0]) / (b[0] - a[0]);
    const w = a[1] + (b[1] - a[1]) * t, d = a[2] + (b[2] - a[2]) * t, g = a[3] + (b[3] - a[3]) * t;
    const lz = HULL_L / 2 - s * HULL_L - (k === 24 ? -inset : k === 0 ? inset : 0);
    right.push([Math.max(0.004, hullHalf(w, d, g, h) - inset), lz]);
  }
  return capGeo(right, h);
}
// right：船頭→船尾的 [半寬, 本地 z]，左右鏡射成一個多邊形，放在船本地 y＝h
function capGeo(right, h) {
  const shape = new THREE.Shape();
  const pts = [...right.map(([x, z]) => [x, z]), ...right.slice().reverse().map(([x, z]) => [-x, z])];
  // Shape 在 xy 平面；之後轉到 xz（y→−z），所以這裡用 (x, −z)
  shape.moveTo(pts[0][0], -pts[0][1]);
  for (const [x, z] of pts.slice(1)) shape.lineTo(x, -z);
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2); g.translate(0, h, 0);
  return g;
}

// 佔位船（沒有 props.glb）：量所有頂點在船本地 xz 的凸包，回傳 z 範圍與某 z 的左右緣（x 最小／最大）。
// 水面遮罩與船邊浪沫都照它建，不能套 GLB 的船殼表（佔位船比較短、船尾是圓的，套了會凸出船外）
function measureHull(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), m = new THREE.Matrix4(), v = new THREE.Vector3(), pts = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position;
    m.multiplyMatrices(inv, o.matrixWorld);
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m); pts.push([v.x, v.z]); }
  });
  if (pts.length < 3) return null;
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const chain = (list) => { const c = []; for (const p of list) { while (c.length >= 2 && cross(c[c.length - 2], c[c.length - 1], p) <= 0) c.pop(); c.push(p); } return c.slice(0, -1); };
  const poly = [...chain(pts), ...chain(pts.slice().reverse())];
  let z0 = Infinity, z1 = -Infinity;
  for (const [, z] of poly) { z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const span = (z) => {
    let a = Infinity, b = -Infinity;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      if (Math.min(p[1], q[1]) > z || Math.max(p[1], q[1]) < z) continue;
      const t = q[1] === p[1] ? 0 : (z - p[1]) / (q[1] - p[1]);
      const x = p[0] + (q[0] - p[0]) * t; a = Math.min(a, x); b = Math.max(b, x);
    }
    return b >= a ? [a, b] : null;
  };
  return { z0, z1, span };
}

// 繫船繩：固定段數的細管，每幀依兩端重算頂點（不重建幾何）
function makeRope(segs, sides, radius, mat) {
  const n = segs + 1, pos = new Float32Array(n * sides * 3), idx = [];
  for (let i = 0; i < segs; i++) for (let k = 0; k < sides; k++) {
    const a = i * sides + k, b = i * sides + ((k + 1) % sides), c = a + sides, d = b + sides;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setIndex(idx);
  const mesh = new THREE.Mesh(g, mat);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  const P = Array.from({ length: n }, () => new THREE.Vector3()), T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  mesh.userData.update = (a, b, sag) => {
    for (let i = 0; i < n; i++) { const t = i / segs; P[i].lerpVectors(a, b, t); P[i].y -= sag * 4 * t * (1 - t); }
    for (let i = 0; i < n; i++) {
      T.subVectors(P[Math.min(segs, i + 1)], P[Math.max(0, i - 1)]).normalize();
      N.crossVectors(T, up).normalize(); B.crossVectors(N, T);
      for (let k = 0; k < sides; k++) {
        const ang = (k / sides) * Math.PI * 2, cs = Math.cos(ang) * radius, sn = Math.sin(ang) * radius, o = (i * sides + k) * 3;
        pos[o] = P[i].x + N.x * cs + B.x * sn; pos[o + 1] = P[i].y + N.y * cs + B.y * sn; pos[o + 2] = P[i].z + N.z * cs + B.z * sn;
      }
    }
    g.attributes.position.needsUpdate = true;
    g.computeVertexNormals();
  };
  return mesh;
}

// 各礁石／珊瑚的佔地半徑與高度（reef.glb 包圍盒的頂點離原點最遠的水平距離，縮放前；模型會隨機旋轉，所以取最大值）
const FOOT = { coral_branch: 0.37, coral_brain: 0.41, coral_fan: 0.56, coral_tube: 0.37, coral_plate: 0.49, rock_a: 0.74, rock_b: 0.55, rock_c: 0.33 };
const HEIGHT = { coral_branch: 0.7, coral_brain: 0.4, coral_fan: 0.9, coral_tube: 0.5, coral_plate: 0.4, rock_a: 0.8, rock_b: 0.7, rock_c: 0.36 };
const hitsObst = (x, z, rad, k = 1) => REEF_OBST.some((o) => Math.hypot(o.x - x, o.z - z) < (o.r + rad) * k);

export function buildWorld(scene, { mobile }) {
  const world = { mixers: [], piles: [], statics: new THREE.Group(), updaters: [] };
  REEF_OBST.length = 0;
  scene.add(world.statics);
  // 海床
  const floorMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true });
  patchUnderwater(floorMat);
  world.floor = new THREE.Group(); scene.add(world.floor);
  for (const g of buildFloor(mobile ? 4 / 3 : 1, 7, 4)) {
    const m = new THREE.Mesh(g, floorMat); m.receiveShadow = true; world.floor.add(m);
  }
  const outer = new THREE.Mesh(buildOuterFloor(8), floorMat); outer.receiveShadow = true; world.floor.add(outer);

  // 棧橋（＋平台上的木箱與吐司）烘成一個網格
  const pier = getStatic('props', 'pier');
  pier.position.set(PIER.x, PIER.y, PIER.z);
  world.piles = pier.userData.fromGLB ? measurePiles(pier) : defaultPiles();
  if (world.piles.length < 6) world.piles = defaultPiles();
  const D = DECOR;
  const crate = getStatic('props', 'crate'); crate.position.set(D.crate.x, PIER.y, D.crate.z); crate.rotation.y = D.crate.rot;
  const crate2 = getStatic('props', 'crate'); crate2.position.set(D.crate2.x, PIER.y, D.crate2.z); crate2.rotation.y = D.crate2.rot; crate2.scale.setScalar(D.crate2.s);
  const loaf = getStatic('props', 'bread_loaf'); loaf.position.set(D.crate.x, PIER.y + 0.6, D.crate.z); loaf.rotation.y = 0.9;
  const propMat = bakedMat(2, 0.85, false);
  const deck = new THREE.Group(); deck.add(pier, crate, crate2, loaf);
  world.pier = bakeOne(deck, propMat, null); world.pier.name = 'pier_baked';
  scene.add(world.pier);
  const creelSrc = getStatic('props', 'creel');
  const creel = new THREE.Group(); creel.name = 'creel';
  creel.add(bakeOne(creelSrc, propMat, null));
  creel.position.set(D.creel.x, PIER.y, D.creel.z); creel.rotation.y = D.creel.rot;
  scene.add(creel);
  world.creel = creel;
  // 木樁與梯腳給水面畫浪沫（梯子在西側平台外緣，props.py 的 y 15.22／15.82）
  WATER_FX.piles = world.piles.map(([x, z]) => [x, z, 0.12]);
  for (const z of [15.22, 15.82]) WATER_FX.piles.push([PIER.x - 3.06, PIER.z - z, 0.045]);

  // 船（平台東側，緩慢上下起伏）：烘成一個網格；船艙是乾的，只有船殼外側吃水的部分有焦散與水下染色
  const boatSrc = getStatic('props', 'boat');
  const dryInv = { value: new THREE.Matrix4() };
  const boatMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
  patchUnderwater(boatMat, { dry: dryInv });
  const boat = new THREE.Group(); boat.name = 'boat';
  boat.add(bakeOne(boatSrc, boatMat, null));
  // 船艙口遮罩與船邊浪沫的吃水線輪廓：GLB 船照 HULL_KEY；佔位船照量到的凸包（佔位船殼是直立的擠出牆，
  // 遮罩在 y＝0.1 只要比外緣內縮一點點就在船殼裡，不會凸出船外；縮太多反而在內牆邊漏出一條水面與浪沫）
  const ph = boatSrc.userData.fromGLB ? null : measureHull(boatSrc);
  let capG = null;
  if (boatSrc.userData.fromGLB) capG = hullCap(0.1, 0.006);
  else if (ph && ph.z1 - ph.z0 > 0.6) {
    const IN = 0.02, right = [];
    for (let k = 0; k <= 24; k++) {
      const z = ph.z1 - IN - (k / 24) * (ph.z1 - ph.z0 - 2 * IN), sp = ph.span(z);
      right.push([sp ? Math.max(0.004, Math.min(-sp[0], sp[1]) - IN) : 0.004, z]);
    }
    capG = capGeo(right, 0.1);
  }
  if (capG) {
    const cap = new THREE.Mesh(capG, new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide }));
    cap.name = 'boat_watercap'; cap.renderOrder = 4; cap.castShadow = false; cap.receiveShadow = false;
    boat.add(cap);
  }
  boat.position.set(BOAT.x, 0, BOAT.z); boat.rotation.y = BOAT.yaw;
  scene.add(boat);
  world.boat = boat;
  if (boatSrc.userData.fromGLB) WATER_FX.hull = { L: HULL_L, s: HULL_KEY.map((k) => k[0]), w: HULL_KEY.map((k) => hullHalf(k[1], k[2], k[3], 0)) };
  else if (ph) {
    // water.js 的 hullDist 以船原點為中心、船頭在 +z：取對稱的長度，船身外的斷面給負半寬（不畫浪沫）
    const L = 2 * Math.max(ph.z1, -ph.z0), S = [0, 0.08, 0.2, 0.35, 0.5, 0.65, 0.8, 0.92, 1];
    WATER_FX.hull = { L, s: S, w: S.map((t) => { const sp = ph.span(L / 2 - t * L); return sp ? Math.max(-sp[0], sp[1]) : -0.3; }) };
  }
  // 繫船繩：船首繩環（船本地 (0, 0.36, 1.62)）→ 平台東北角繫船柱（world (2.68, −11.68)，上圈繩約橋面上 0.16 m）
  const ropeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.69, 0.51, 0.23), roughness: 0.85, metalness: 0, flatShading: true });
  const rope = makeRope(16, 5, 0.019, ropeMat); rope.name = 'boat_rope';
  scene.add(rope);
  world.rope = rope;
  const RING = new THREE.Vector3(0, 0.36, 1.62), POST = new THREE.Vector3(2.68, PIER.y + 0.15, -11.68);
  const ra = new THREE.Vector3(), rb = new THREE.Vector3();
  world.updaters.push((t) => {
    boat.position.y = Math.sin(t * 0.9) * 0.035 - 0.01;
    boat.rotation.z = Math.sin(t * 0.7 + 1) * 0.025;
    boat.rotation.x = Math.sin(t * 0.55) * 0.015;
    boat.updateMatrixWorld(true);
    dryInv.value.copy(boat.matrixWorld).invert();
    ra.copy(RING).applyMatrix4(boat.matrixWorld);
    // 繩子從繫船柱朝船那一側的柱面出來
    const dx = ra.x - POST.x, dz = ra.z - POST.z, dl = Math.hypot(dx, dz) || 1;
    rb.set(POST.x + (dx / dl) * 0.13, POST.y, POST.z + (dz / dl) * 0.13);
    rope.userData.update(rb, ra, 0.08 + 0.02 * Math.sin(t * 0.9));
  });
  world.updaters[world.updaters.length - 1](0);

  // 靜態物件：依空間格子合批
  const batch = [];
  const place = (file, name, x, z, y, rot, s) => {
    const o = getStatic(file, name);
    o.position.set(x, y ?? floorY(x, z), z); o.rotation.y = rot; o.scale.setScalar(s);
    batch.push(o); return o;
  };
  const r = rng(201);
  // 沙灘：椰子樹、草叢、貝殼
  const palms = [[-7.5, 11.5], [6.2, 12.4], [-2.8, 14.5], [11.5, 15.5], [-12.5, 15], [3, 18.5]];
  palms.forEach(([x, z], i) => place('reef', 'palm', x, z, floorY(x, z) - 0.05, r() * 6.28, 0.85 + r() * 0.3));
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = 4 + r() * 11;
    const x = Math.cos(a) * d, z = 20 + Math.sin(a) * d * 0.9;
    if (shoreDist(x, z) > -1.2 || (Math.abs(x) < 1.6 && z < 8)) continue;
    place('reef', 'grass', x, z, undefined, r() * 6.28, 0.8 + r() * 0.7);
  }
  for (let i = 0; i < 26; i++) {
    const x = (r() - 0.5) * 30, z = -2 + r() * 14;
    const d = shoreDist(x, z);
    if (d < -3.5 || d > 2.5 || pierFoot(x, z, 0.3)) continue;
    const nm = r() < 0.55 ? 'shell' : 'starfish', rot = r() * 6.28, s = 0.9 + r() * 0.6;
    if (!mobile || i % 2) place('reef', nm, x, z, undefined, rot, s);
  }
  // 珊瑚礁群（避開棧橋與船；物件間距依各自的佔地半徑×縮放，不互相穿插）
  const kinds = ['coral_branch', 'coral_brain', 'coral_fan', 'coral_tube', 'coral_plate', 'coral_branch', 'coral_tube'];
  world.reefSpots = [];
  const decor = [];
  // 手機版礁群密度約七成、沙灘與礁邊的小擺設減半（三角形與陰影 pass 都少）
  const dens = mobile ? 3 : 4.2;
  for (const rf of REEFS) {
    const n = Math.round(rf.r * dens);
    const spots = [];
    for (let k = 0, tries = 0; k < n && tries < 160; tries++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rf.r;
      const x = rf.x + Math.cos(a) * d, z = rf.z + Math.sin(a) * d;
      const name = r() < 0.22 ? ['rock_a', 'rock_b', 'rock_c'][Math.floor(r() * 3)] : kinds[Math.floor(r() * kinds.length)];
      let s = 0.75 + r() * 0.6;
      const rot = r() * 6.28;
      const y = floorY(x, z);
      if (y + HEIGHT[name] * s > -0.35) s = Math.max(0.35, (-0.35 - y) / HEIGHT[name]);
      const rad = FOOT[name] * s;
      if (pierFoot(x, z, Math.max(0.6, rad + 0.25)) || boatFoot(x, z, Math.max(0.5, rad + 0.2)) || hitsObst(x, z, rad)) continue;
      place('reef', name, x, z, y - 0.03, rot, s);
      REEF_OBST.push({ x, z, r: rad, top: y - 0.03 + HEIGHT[name] * s, y, name });
      spots.push([x, z]); k++;
    }
    world.reefSpots.push(...spots);
    // 礁邊的貝殼海星（不要放在礁石裡）
    for (let k = 0; k < 3; k++) {
      const a = r() * 6.28, d = rf.r * (0.6 + r() * 0.6), x = rf.x + Math.cos(a) * d, z = rf.z + Math.sin(a) * d;
      const nm = r() < 0.5 ? 'starfish' : 'shell', s = 1 + r() * 0.5;
      const rot = r() * 6.28;
      if (!pierFoot(x, z, 0.3) && !hitsObst(x, z, 0.12, 1) && (!mobile || k !== 1)) decor.push(['reef', nm, x, z, undefined, rot, s]);
    }
  }
  // 零星礁石（也不和礁群重疊）
  for (let i = 0; i < (mobile ? 12 : 18); i++) {
    const x = (r() - 0.5) * 50, z = -30 + r() * 30;
    const rot = r() * 6.28, s = 0.6 + r() * 0.6, name = ['rock_a', 'rock_b', 'rock_c'][i % 3], rad = FOOT[name] * s;
    if (pierFoot(x, z, 1 + rad) || boatFoot(x, z, 1 + rad) || floorY(x, z) > -1 || hitsObst(x, z, rad)) continue;
    const y = floorY(x, z) - 0.05;
    place('reef', name, x, z, y, rot, s);
    REEF_OBST.push({ x, z, r: rad, top: y + HEIGHT[name] * s, y, name });
  }
  for (const a of decor) place(...a);
  mergeStatics(world.statics, batch);
  world.reefObst = REEF_OBST;
  world.staticItems = batch;   // 合批前的各個物件（共用幾何，不在場景裡），測試用來量礁石與魚的穿插

  // 海草（各株錯開相位；不長在礁石裡）
  const weedSpots = [];
  for (const rf of REEFS) for (let k = 0; k < 3; k++) {
    const a = r() * 6.28, d = rf.r * (0.5 + r() * 0.7);
    weedSpots.push([rf.x + Math.cos(a) * d, rf.z + Math.sin(a) * d]);
  }
  for (let i = 0; i < 10; i++) weedSpots.push([(r() < 0.5 ? -1 : 1) * (2 + r() * 8), -1 + r() * 2.5]);
  const nWeed = mobile ? 16 : 34;
  let wc = 0;
  const sph = new THREE.Sphere();
  for (const [x, z] of weedSpots) {
    if (wc >= nWeed) break;
    const y = floorY(x, z);
    const rr = r(), rs = r(), rp = r(), rt = r();
    if (y > -0.7 || pierFoot(x, z, 0.4) || boatFoot(x, z, 0.4) || hitsObst(x, z, 0.2, 1)) continue;
    const { obj, clips } = getSeaweed();
    const s = Math.min(0.75 + rs * 0.6, (-y - 0.2) / 1.2);
    obj.position.set(x, y - 0.02, z); obj.rotation.y = rr * 6.28; obj.scale.setScalar(Math.max(0.35, s));
    shadowify(obj, true, true); scene.add(obj);
    // shadowify 把蒙皮網格設成不剔除；給一個涵蓋擺動範圍的固定包圍球，畫面外與陰影範圍外的海草就不畫
    obj.updateMatrixWorld(true);
    obj.traverse((o) => { if (o.isSkinnedMesh) { o.computeBoundingSphere(); sph.copy(o.boundingSphere); sph.radius = sph.radius * 1.4 + 0.1; o.boundingSphere = sph.clone(); o.frustumCulled = true; } });
    const clip = findClip(clips, 'seaweed_sway');
    if (clip) {
      const m = new THREE.AnimationMixer(obj); const a = m.clipAction(clip); a.play(); a.time = rp * clip.duration; a.timeScale = 0.8 + rt * 0.4;
      world.mixers.push(m);
    }
    wc++;
  }

  world.depthTex = buildDepthTexture();
  world.update = (dt, t) => { for (const m of world.mixers) m.update(dt); for (const u of world.updaters) u(t, dt); };
  return world;
}

// 水面用的深度貼圖：R＝水深/4 m。涵蓋整座島與南岸外的淺水（著色器在範圍外沿用邊緣值，不會跳色）。
// 木樁與船身的浪沫改在水面著色器裡直接算（WATER_FX），不再用這張 0.36 m 一格的貼圖。
export const DEPTH_BOX = { x0: -56, z0: -56, size: 116 };
function buildDepthTexture() {
  const N = 320, data = new Uint8Array(N * N * 4);
  const { x0, z0, size } = DEPTH_BOX;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = x0 + ((i + 0.5) / N) * size, z = z0 + ((j + 0.5) / N) * size;
    const dep = Math.max(0, -floorY(x, z));
    const k = (j * N + i) * 4;
    data[k] = Math.min(255, Math.round((dep / 4) * 255));
    data[k + 1] = 0; data[k + 2] = 0; data[k + 3] = 255;
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}
