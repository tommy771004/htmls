// 靜態場景：道路、街區、建築、公園、會堂、沿海步道、沙灘、防波堤、觀景棧橋、浮標。
// 全部以 Builder 合併成少數幾個網格；店面招牌與升級擺設在 decor.js，會隨等級重建。
import * as THREE from 'three';
import { Builder, prng, T } from './geo.js';
const TBOX = T.box;
import {
  STACKS, STREETS_X, CORE_STREETS_X, AVES_Z, COAST_Z, ROAD_W, COAST_W, COLS, ROWS, SIDEWALK, PROM, SAND_Y, STAIRS_X, RAIL_Z,
  CITY_LOTS, APT_LOTS, PARK, HALL, PARKING, lotRect, BEACH, DECK_Y, HARBOR,
} from './layout.js';

export const PAL = {
  asphalt: '#566a68', asphalt2: '#4e615f', line: '#e8e0c4', yellow: '#d9b648', zebra: '#ece6d4',
  walk: '#ddd5bf', curb: '#c3bba4', lotPave: '#cfc7b0', grass: '#a6b278', grass2: '#97a56c', hedge: '#6f8a4f',
  trunk: '#6d5038', leaf: '#86a05a', leaf2: '#6f8c4c', palmTrunk: '#a0815a', frond: '#5e8a45',
  sand: '#e6d9b6', sand2: '#ddcfa6', prom: '#ddd5c0', promLine: '#cbc2ab', rail: '#2f4f3f', railTop: '#3b5d4b',
  rock: '#a7a49a', rock2: '#8f8c84', wood: '#b48a5c', wood2: '#9c7449', woodDark: '#7b5a3a',
  roof: '#425b5b', roofEdge: '#56625e', trim: '#efe5cc', glass: '#34474c', ac: '#d3d3c8', metal: '#7d8784', fence: '#a8653f',
  lampPole: '#2c3d36', red: '#c0503d', cream: '#f2e8cf', white: '#f4f1e6', orange: '#e0763a', teal: '#5e9a96',
};
// 建築外牆（磚紅、芥末黃、灰綠、霧藍、奶油、鼠尾草）
export const WALLS = ['#b0533d', '#9c4734', '#d2b157', '#c49c45', '#6f9fa6', '#5d8a93', '#7c9196', '#e0d3b5', '#8fa58a', '#a8604a'];

export function buildWorld(scene) {
  const S = new Builder();   // 一般靜態（投影＋受光）
  const D = new Builder();   // 地面標線等不投影的平面細節
  const G = new Builder();   // 暗窗
  const L = new Builder();   // 夜間會亮的窗
  const B = new Builder();   // 燈泡（自發光）
  const lamps = [];          // 路燈位置（夜間光暈）
  const rnd = prng(261);

  // ── 地面 ── 道路就是地面本身，街區是墊高的平台
  S.box(-420, -0.6, -330, 420, 0, 34, PAL.asphalt);
  ground(S, D, rnd);
  for (let i = 0; i < STREETS_X.length; i++) for (let j = 0; j < AVES_Z.length; j++) cityBlock(S, D, G, L, B, lamps, rnd, i, j);
  coreBlocks(S, D, G, L, B, lamps, rnd);
  roadMarks(D);
  promenade(S, D, B, lamps, rnd);
  beach(S, D, rnd);

  const matS = new THREE.MeshLambertMaterial({ vertexColors: true });
  const matD = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const matG = new THREE.MeshLambertMaterial({ vertexColors: true });
  const matL = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color('#000000') });
  const matB = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(0.8, 0.8, 0.78) });
  const mS = S.mesh(matS);
  const mD = D.mesh(matD, { cast: false });
  const mG = G.mesh(matG, { cast: false });
  const mL = L.mesh(matL, { cast: false });
  const mB = B.mesh(matB, { cast: false, receive: false });
  scene.add(mS, mD, mG, mL, mB);

  // 夜間路燈光暈：地面上的半透明圓
  const poolGeo = new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2);
  const poolMat = new THREE.MeshBasicMaterial({ color: '#ffd58a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, lamps.length);
  const m4 = new THREE.Matrix4();
  lamps.forEach((p, i) => pools.setMatrixAt(i, m4.compose(new THREE.Vector3(p[0], p[1] + 0.06, p[2]), new THREE.Quaternion(), new THREE.Vector3(4.2, 1, 4.2))));
  pools.frustumCulled = false;
  scene.add(pools);

  return {
    meshes: [mS, mD, mG, mL, mB],
    tris: [mS, mD, mG, mL, mB].reduce((t, m) => t + m.geometry.attributes.position.count / 3, 0),
    setNight(k) {
      // k：0 白天 → 1 深夜
      matL.emissive.setRGB(1.0 * k, 0.78 * k, 0.42 * k);
      matB.color.setRGB(0.8 + 0.2 * k, 0.8 + 0.2 * k, 0.78 + 0.1 * k);
      poolMat.opacity = 0.22 * k;
      pools.visible = k > 0.02;
    },
  };
}

// ───────────────────────── 地面 ─────────────────────────
function ground(S, D, rnd) {
  // 沿海道路南側的路緣
  D.box(-420, 0, 6.6, 420, 0.03, 7, PAL.curb);
}

function roadMarks(D) {
  const y = 0.03;
  // 南北向街道中線虛線
  for (const x of STREETS_X) {
    for (let z = -228; z < -8; z += 6) {
      if (AVES_Z.some((a) => Math.abs(z + 1.5 - a) < 7.5)) continue;
      D.box(x - 0.12, 0, z, x + 0.12, y, z + 3, PAL.line, true);
    }
  }
  // 東西向大道中線虛線
  for (const zA of AVES_Z) {
    for (let x = -300; x < 300; x += 6) {
      if (STREETS_X.some((s) => Math.abs(x + 1.5 - s) < 7.5)) continue;
      D.box(x, 0, zA - 0.12, x + 3, y, zA + 0.12, PAL.line, true);
    }
  }
  // 沿海道路：雙黃線＋兩側車道虛線
  for (let x = -420; x < 420; x += 40) {
    D.box(x, 0, -0.32, x + 40, y, -0.12, PAL.yellow, true);
    D.box(x, 0, 0.12, x + 40, y, 0.32, PAL.yellow, true);
  }
  for (const zl of [-3.5, 3.5]) for (let x = -420; x < 420; x += 7) D.box(x, 0, zl - 0.1, x + 3.4, y, zl + 0.1, PAL.line, true);
  // 斑馬線（核心區每個路口的四個方向）
  for (const x of CORE_STREETS_X) {
    for (const zA of [-84, -42, 0]) {
      const half = zA === 0 ? COAST_W / 2 : ROAD_W / 2;
      for (const sgn of [-1, 1]) {
        // 橫越大道的斑馬線（沿 x 排列的條紋，位於街區角落）
        for (const off of [-ROAD_W / 2 - 1.5, ROAD_W / 2 + 1.5]) {
          const xc = x + off;
          for (let k = -half + 0.6; k < half - 0.6; k += 1.2) D.box(xc - 1.3, 0, zA + k, xc + 1.3, y, zA + k + 0.6, PAL.zebra, true);
        }
        if (zA === 0 && sgn > 0) continue;
        // 橫越街道的斑馬線
        const zc = zA + sgn * (half + 1.5);
        for (let k = -ROAD_W / 2 + 0.6; k < ROAD_W / 2 - 0.6; k += 1.2) D.box(x + k, 0, zc - 1.3, x + k + 0.6, y, zc + 1.3, PAL.zebra, true);
      }
    }
  }
}

// ───────────────────────── 街區 ─────────────────────────
function slab(S, D, x0, z0, x1, z1) {
  S.box(x0, 0, z0, x1, 0.22, z1, PAL.walk);
  // 路緣與人行道磚縫
  D.box(x0, 0.22, z1 - 0.25, x1, 0.235, z1, PAL.curb, true);
  D.box(x1 - 0.25, 0.22, z0, x1, 0.235, z1, PAL.curb, true);
}

function parkingLot(S, D, ix0, iz0, ix1, iz1) {
  S.box(ix0, 0.22, iz0, ix1, 0.24, iz1, PAL.asphalt2);
  for (let x = ix0 + 2; x < ix1 - 1; x += 3.4) {
    D.box(x, 0.24, iz0 + 1, x + 0.12, 0.25, iz0 + 6, PAL.line, true);
    D.box(x, 0.24, iz1 - 6, x + 0.12, 0.25, iz1 - 1, PAL.line, true);
  }
  S.box(ix0, 0.22, iz0, ix1, 0.7, iz0 + 0.4, PAL.hedge);
  S.box(ix1 - 0.4, 0.22, iz0, ix1, 0.7, iz1, PAL.hedge);
}

function cityBlock(S, D, G, L, B, lamps, rnd, i, j) {
  // 背景街區：核心區以外，用比較簡單的建築填滿畫面
  const xs = STREETS_X, zs = AVES_Z;
  if (i + 1 >= xs.length) return;
  const x0 = xs[i] + ROAD_W / 2, x1 = xs[i + 1] - ROAD_W / 2;
  const z0 = zs[j] + ROAD_W / 2;
  const z1 = j + 1 < zs.length ? zs[j + 1] - ROAD_W / 2 : COAST_Z - COAST_W / 2;
  const core = i >= 3 && i <= 7 && j >= 3;
  if (core) return;
  slab(S, D, x0, z0, x1, z1);
  const ix0 = x0 + SIDEWALK, ix1 = x1 - SIDEWALK, iz0 = z0 + SIDEWALK, iz1 = z1 - SIDEWALK;
  if (i === PARKING.i && j === PARKING.j) {
    // 東區平面停車場：照樣抽一次亂數（丟掉結果），其他街區的建築才會和以前一樣
    const X = new Builder();
    if (rnd() >= 0.08) { lowBlock(X, X, X, rnd, ix0, iz0, ix1, iz1); streetFurniture(X, X, [], rnd, x0, z0, x1, z1); } else for (let k = 0; k < 5; k++) tree(X, ix0 + 3 + rnd() * (ix1 - ix0 - 6), 0.3, iz0 + 3 + rnd() * (iz1 - iz0 - 6), rnd);
    parkingLot(S, D, ix0, iz0, ix1, iz1);
    return;
  }
  // 偶爾是一塊小綠地
  if (rnd() < 0.08) {
    S.box(ix0, 0.22, iz0, ix1, 0.3, iz1, PAL.grass);
    for (let k = 0; k < 5; k++) tree(S, ix0 + 3 + rnd() * (ix1 - ix0 - 6), 0.3, iz0 + 3 + rnd() * (iz1 - iz0 - 6), rnd);
    return;
  }
  lowBlock(S, G, L, rnd, ix0, iz0, ix1, iz1);
  streetFurniture(S, B, lamps, rnd, x0, z0, x1, z1);
}

// 2–4 層的步登公寓：沿街一排（正面朝 +z），後排是後院，偶爾東北角再一棟
function lowBlock(S, G, L, rnd, ix0, iz0, ix1, iz1) {
  const fd = 11 + rnd() * 3;
  let x = ix0;
  let k = 0;
  while (x < ix1 - 4) {
    let w = 9 + rnd() * 7;
    if (ix1 - (x + w) < 7) w = ix1 - x;
    if (k > 0 && rnd() < 0.14) yard(S, rnd, x + 0.2, iz1 - fd, x + w - 0.2, iz1, true);
    else building(S, G, L, rnd, { x0: x + 0.2, x1: x + w - 0.2, z0: iz1 - fd, z1: iz1, floors: 2 + Math.floor(rnd() * 3), wall: WALLS[Math.floor(rnd() * WALLS.length)], fireEscape: rnd() < 0.5, simple: true });
    x += w;
    k++;
  }
  const bz0 = iz0, bz1 = iz1 - fd - 0.4;
  if (bz1 - bz0 < 4) return;
  if (rnd() < 0.55) {
    const bw = 10 + rnd() * 5;
    building(S, G, L, rnd, { x0: ix1 - bw, x1: ix1, z0: bz0, z1: bz1, floors: 2 + Math.floor(rnd() * 3), wall: WALLS[Math.floor(rnd() * WALLS.length)], simple: true, back: true });
    yard(S, rnd, ix0, bz0, ix1 - bw - 0.3, bz1);
  } else yard(S, rnd, ix0, bz0, ix1, bz1);
}

// 後院：草地、木圍籬、菜圃、樹，偶爾有野餐桌與陽傘
export function yard(S, rnd, x0, z0, x1, z1, street = false) {
  if (x1 - x0 < 2 || z1 - z0 < 2) return;
  S.box(x0, 0.22, z0, x1, 0.28, z1, rnd() < 0.5 ? PAL.grass : PAL.grass2);
  fence(S, x0, z1, x1, z1, street);
  fence(S, x1, z0, x1, z1);
  fence(S, x0, z0, x1, z0);
  fence(S, x0, z0, x0, z1);
  const W = x1 - x0, Dd = z1 - z0;
  const beds = Math.min(3, Math.floor(W / 3.5));
  for (let k = 0; k < beds; k++) {
    if (rnd() < 0.35) continue;
    const bx = x0 + 1.2 + k * 3.2, bz = z0 + 1.2 + rnd() * Math.max(0, Dd - 4.5);
    if (bx + 2.6 > x1 - 0.8) break;
    S.box(bx, 0.28, bz, bx + 2.6, 0.62, bz + 1.4, '#9c6a46');
    S.box(bx + 0.12, 0.62, bz + 0.12, bx + 2.48, 0.66, bz + 1.28, '#6f5236');
    for (let i = 0; i < 4; i++) S.ball(bx + 0.4 + i * 0.6, 0.62, bz + 0.7, 0.2, ['#7f9a55', '#d9b648', '#c8453c', '#e8e2d0'][(i + k) % 4], 0);
  }
  if (rnd() < 0.8) tree(S, x1 - 1.8 - rnd() * Math.max(0, W - 4), 0.28, z0 + 1.6 + rnd() * Math.max(0, Dd - 3.2), rnd);
  if (W > 7 && Dd > 5 && rnd() < 0.45) {
    const px = x0 + W * (0.3 + rnd() * 0.4), pz = z0 + Dd * 0.55;
    S.box(px - 1, 0.98, pz - 0.45, px + 1, 1.06, pz + 0.45, PAL.wood);
    for (const s of [-0.8, 0.8]) S.box(px - 1, 0.62, pz + s - 0.15, px + 1, 0.68, pz + s + 0.15, PAL.wood);
    S.cyl(px, 0.28, pz, 0.04, 2.3, PAL.white, 6);
    S.add(T.cone12, px, 2.25, pz, 2.6, 0.55, 2.6, 0, rnd() < 0.5 ? '#e0763a' : '#d9b648');
  }
}

function fence(S, x0, z0, x1, z1, gate = false) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 1.4));
  const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    if (gate && Math.abs(t - 0.5) < 0.12) continue;
    S.box(x - 0.06, 0.28, z - 0.06, x + 0.06, 1.15, z + 0.06, PAL.fence, true);
  }
  for (const y of [0.55, 0.98]) {
    if (alongX) {
      if (gate) {
        const m = (x0 + x1) / 2;
        S.box(x0, y, z0 - 0.04, m - len * 0.12, y + 0.08, z0 + 0.04, PAL.fence, true);
        S.box(m + len * 0.12, y, z0 - 0.04, x1, y + 0.08, z0 + 0.04, PAL.fence, true);
      } else S.box(x0, y, z0 - 0.04, x1, y + 0.08, z0 + 0.04, PAL.fence, true);
    } else S.box(x0 - 0.04, y, z0, x0 + 0.04, y + 0.08, z1, PAL.fence, true);
  }
}

function coreBlocks(S, D, G, L, B, lamps, rnd) {
  for (let c = 0; c < COLS.length; c++) {
    for (let r = 0; r < ROWS.length; r++) {
      const [x0, x1] = COLS[c], [z0, z1] = ROWS[r];
      slab(S, D, x0, z0, x1, z1);
      if (c === PARK[0] && r === PARK[1]) park(S, D, B, lamps, rnd, x0, z0, x1, z1);
      else if (c === HALL[0] && r === HALL[1]) hall(S, G, L, rnd, x0, z0, x1, z1);
      else {
        for (const side of ['W', 'E']) {
          const rr = lotRect(c, r, side);
          const isShop = Object.values(CITY_LOTS).some(([lc, lr, ls]) => lc === c && lr === r && ls === side);
          const seed = c * 7 + r * 3 + (side === 'E' ? 1 : 0);
          const wall = WALLS[(seed * 5 + 2) % WALLS.length];
          // 店面整棟由 decor.js 依等級畫（未開設是兩層樓店屋、開設後是剖面室內），後方留後院
          if (isShop) { backyard(S, rnd, rr.x0, rr.z0, rr.x1, rr.z0 + 4); continue; }
          // 住宅：沿街 3–4 層步登公寓，後面是有圍籬與菜圃的後院
          const floors = lotFloors(c, r, side, false);
          const bz0 = rr.z1 - 13;
          building(S, G, L, rnd, { x0: rr.x0, x1: rr.x1, z0: bz0, z1: rr.z1, floors, wall, fireEscape: true });
          yard(S, rnd, rr.x0, rr.z0, rr.x1, bz0 - 0.3);
        }
      }
      streetFurniture(S, B, lamps, rnd, x0, z0, x1, z1, true);
    }
  }
}

export const lotFloors = (c, r, side, isShop = true) => {
  const seed = c * 7 + r * 3 + (side === 'E' ? 1 : 0);
  if (isShop) return 2;
  // 疊樓店家的鏡頭前方（東側）鄰棟壓低成兩層，不擋住展開的樓層
  if (side === 'E' && STACKS.some((st) => st.key === `${c},${r},W`)) return 2;
  return 3 + (seed % 2);
};
export const GROUND_H = 3.6, FLOOR_H = 3.2;
export const roofY = (floors) => GROUND_H + (floors - 1) * FLOOR_H;

// 建築：正面 +z、側面 +x 有窗；屋頂有冷氣、天窗、樓梯間、水塔
export function building(S, G, L, rnd, o) {
  const { x0, x1, z0, z1, floors, wall } = o;
  const GH = GROUND_H, FH = FLOOR_H;
  const top = GH + (floors - 1) * FH;
  const trim = PAL.trim;
  S.box(x0, 0.22, z0, x1, top, z1, wall);
  // 簷口（帶齒飾）與樓層腰線
  S.box(x0 - 0.2, top - 0.45, z0, x1 + 0.2, top, z1 + 0.22, trim);
  for (let x = x0 + 0.3; x < x1 - 0.2; x += 0.7) S.box(x, top - 0.75, z1, x + 0.3, top - 0.45, z1 + 0.14, trim, true);
  for (let z = z0 + 0.3; z < z1 - 0.2; z += 0.7) S.box(x1, top - 0.75, z, x1 + 0.14, top - 0.45, z + 0.3, trim, true);
  S.box(x0, GH - 0.25, z1, x1 + 0.08, GH + 0.05, z1 + 0.14, trim, true);
  // 屋頂：深色平頂＋奶油色壓頂的女兒牆
  S.box(x0 + 0.35, top, z0 + 0.35, x1 - 0.35, top + 0.08, z1 - 0.35, PAL.roof);
  S.box(x0, top, z0, x1, top + 0.45, z0 + 0.35, wall);
  S.box(x0, top, z1 - 0.35, x1, top + 0.45, z1, wall);
  S.box(x0, top, z0, x0 + 0.35, top + 0.45, z1, wall);
  S.box(x1 - 0.35, top, z0, x1, top + 0.45, z1, wall);
  S.box(x0 - 0.05, top + 0.45, z1 - 0.4, x1 + 0.05, top + 0.58, z1 + 0.05, trim, true);
  S.box(x1 - 0.4, top + 0.45, z0 - 0.05, x1 + 0.05, top + 0.58, z1 + 0.05, trim, true);
  // 樓梯間小屋（奶油色牆、深色頂）
  {
    const hx = x0 + 1 + rnd() * Math.max(0.5, x1 - x0 - 4.5), hz = z0 + 1 + rnd() * Math.max(0.5, z1 - z0 - 4);
    S.box(hx, top, hz, hx + 2.2, top + 1.6, hz + 2, trim);
    S.box(hx - 0.1, top + 1.6, hz - 0.1, hx + 2.3, top + 1.75, hz + 2.1, PAL.roof);
  }
  const W = x1 - x0, Dd = z1 - z0;
  const nAc = 1 + Math.floor(rnd() * 3);
  for (let k = 0; k < nAc; k++) {
    const ax = x0 + 1.5 + rnd() * (W - 3.5), az = z0 + 1.5 + rnd() * (Dd - 3.5);
    S.box(ax, top + 0.08, az, ax + 1.4, top + 0.9, az + 1.1, PAL.ac);
    S.box(ax + 0.2, top + 0.9, az + 0.2, ax + 1.2, top + 0.95, az + 0.9, PAL.metal);
  }
  if (rnd() < 0.6) {
    const sx = x0 + 1 + rnd() * (W - 4), sz = z0 + 1 + rnd() * (Dd - 4);
    S.box(sx, top + 0.08, sz, sx + 2.2, top + 0.45, sz + 1.6, '#9cc1c4');
  }
  if (!o.simple && rnd() < 0.35) {
    // 紐約式水塔
    const tx = x0 + 2.5 + rnd() * (W - 5), tz = z0 + 2.5 + rnd() * (Dd - 5);
    for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) S.box(tx + dx - 0.1, top, tz + dz - 0.1, tx + dx + 0.1, top + 1.6, tz + dz + 0.1, PAL.woodDark);
    S.cyl(tx, top + 1.6, tz, 1.25, 2.2, PAL.wood2, 12);
    S.cone(tx, top + 3.8, tz, 1.35, 0.9, PAL.roof, 12);
  }
  if (rnd() < 0.5) S.box(x0 + 0.8, top, z0 + 0.8, x0 + 1.6, top + 1.4, z0 + 1.5, wall);

  // 窗戶
  const winW = 1.25, winH = 1.75, step = 2.55;
  const nx = Math.max(1, Math.floor((W - 1.4) / step));
  const nz = Math.max(1, Math.floor((Dd - 1.4) / step));
  const ox = x0 + (W - (nx - 1) * step) / 2, oz = z0 + (Dd - (nz - 1) * step) / 2;
  for (let f = 1; f < floors; f++) {
    const y = GH + (f - 1) * FH + 0.75;
    for (let k = 0; k < nx; k++) {
      const cx = ox + k * step;
      S.box(cx - winW / 2 - 0.16, y - 0.16, z1, cx + winW / 2 + 0.16, y + winH + 0.12, z1 + 0.1, trim, true);
      (rnd() < 0.42 ? L : G).box(cx - winW / 2, y, z1 + 0.02, cx + winW / 2, y + winH, z1 + 0.14, PAL.glass, true);
      S.box(cx - winW / 2 + 0.6, y, z1 + 0.05, cx - winW / 2 + 0.68, y + winH, z1 + 0.16, trim, true);
      S.box(cx - winW / 2 - 0.25, y - 0.32, z1, cx + winW / 2 + 0.25, y - 0.12, z1 + 0.28, trim, true);
      if (rnd() < 0.22) {
        // 窗台花箱
        S.box(cx - winW / 2 - 0.1, y - 0.12, z1 + 0.05, cx + winW / 2 + 0.1, y + 0.18, z1 + 0.42, '#8a5a3a', true);
        for (let i = 0; i < 3; i++) S.ball(cx - 0.45 + i * 0.45, y + 0.1, z1 + 0.26, 0.17, rnd() < 0.5 ? '#c8453c' : '#e2b84f');
      }
    }
    for (let k = 0; k < nz; k++) {
      const cz = oz + k * step;
      S.box(x1, y - 0.16, cz - winW / 2 - 0.16, x1 + 0.1, y + winH + 0.12, cz + winW / 2 + 0.16, trim, true);
      (rnd() < 0.42 ? L : G).box(x1 + 0.02, y, cz - winW / 2, x1 + 0.14, y + winH, cz + winW / 2, PAL.glass, true);
    }
  }
  // 一樓：店面是大片櫥窗（由 decor.js 加招牌／鐵捲門），住宅是門廊與窗
  if (o.shop) {
    const sx0 = x0 + 0.9, sx1 = x1 - 0.9;
    L.box(sx0, 0.5, z1 + 0.02, sx1, GH - 0.6, z1 + 0.12, '#3e5258', true);
    for (let x = sx0; x <= sx1 + 0.01; x += (sx1 - sx0) / 4) S.box(x - 0.09, 0.22, z1, x + 0.09, GH - 0.5, z1 + 0.2, PAL.trim, true);
    S.box(sx0, 0.22, z1, sx1, 0.55, z1 + 0.2, PAL.trim, true);
  } else if (!o.back) {
    // 步登公寓入口：門、深綠雨棚、門前階梯與扶手
    const cx = (x0 + x1) / 2 + (W > 11 ? 2.5 : 0);
    S.box(cx - 0.9, 0.7, z1, cx + 0.9, 3.0, z1 + 0.15, '#2f3f36', true);
    S.box(cx - 0.75, 0.85, z1 + 0.15, cx + 0.75, 2.85, z1 + 0.18, '#506a62', true);
    S.add(TBOX, cx, 2.95, z1 + 0.55, 2.4, 0.12, 1.2, 0, '#2f5a47', -0.25);
    S.box(cx - 1.2, 2.75, z1 + 1.05, cx + 1.2, 3.0, z1 + 1.15, '#2f5a47', true);
    for (let k = 0; k < 3; k++) S.box(cx - 1.1, 0.22, z1 + 0.15 + k * 0.32, cx + 1.1, 0.7 - k * 0.16, z1 + 1.3, PAL.walk, true);
    for (const sx of [-1.15, 1.15]) S.add(TBOX, cx + sx, 0.75, z1 + 0.7, 0.06, 0.06, 1.2, 0, PAL.lampPole, 0.4);
    for (let k = 0; k < nx; k++) {
      const wx = ox + k * step;
      if (Math.abs(wx - cx) < 2) continue;
      (rnd() < 0.3 ? L : G).box(wx - winW / 2, 1.1, z1 + 0.02, wx + winW / 2, 1.1 + winH, z1 + 0.14, PAL.glass, true);
      S.box(wx - winW / 2 - 0.16, 0.94, z1, wx + winW / 2 + 0.16, 1.1 + winH + 0.12, z1 + 0.1, trim, true);
    }
  }
  if (o.fireEscape && floors >= 3) fireEscape(S, x0, x1, z1, floors, GH, FH, nx, ox, step, rnd);
}

function fireEscape(S, x0, x1, z1, floors, GH, FH, nx, ox, step, rnd) {
  // 正面兩扇窗寬的鐵梯：每層平台＋欄杆＋斜梯
  const k = Math.min(nx - 1, 1 + Math.floor(rnd() * Math.max(1, nx - 2)));
  const cx = ox + (k - 0.5) * step;
  const w = step + 0.6;
  const c = '#2f4b3c';
  for (let f = 1; f < floors; f++) {
    const y = GH + (f - 1) * FH + 0.45;
    S.box(cx - w / 2, y, z1, cx + w / 2, y + 0.1, z1 + 1.0, c, true);
    S.box(cx - w / 2, y + 0.9, z1 + 0.92, cx + w / 2, y + 1.0, z1 + 1.0, c, true);
    for (let p = 0; p <= 4; p++) S.box(cx - w / 2 + p * (w / 4) - 0.04, y, z1 + 0.94, cx - w / 2 + p * (w / 4) + 0.04, y + 0.95, z1 + 1.0, c, true);
    S.add(TBOX, cx + w / 4, y + 0.1, z1 + 0.5, FH * 1.2, 0.08, 0.35, 0, c, 0, 0.95);
  }
}

function backyard(S, rnd, x0, z0, x1, z1) {
  // 店面後方的小院：木圍籬、菜圃或垃圾桶
  S.box(x0, 0.22, z0, x1, 0.26, z1, PAL.lotPave);
  if (rnd() < 0.5) {
    S.box(x0 + 1, 0.26, z0 + 0.8, x0 + 4, 0.55, z0 + 2.6, PAL.woodDark);
    S.box(x0 + 1.15, 0.55, z0 + 0.95, x0 + 3.85, 0.62, z0 + 2.45, '#6a8a45');
  } else {
    S.box(x0 + 1, 0.26, z0 + 1, x0 + 2.4, 1.4, z0 + 2.2, '#4f6b5a');
    S.box(x0 + 2.8, 0.26, z0 + 1, x0 + 4.2, 1.4, z0 + 2.2, '#5e7487');
  }
}

function streetFurniture(S, B, lamps, rnd, x0, z0, x1, z1, core = false) {
  const h = SIDEWALK / 2;
  // 南側人行道：行道樹與路燈交錯；東側也放幾棵
  const span = x1 - x0;
  const n = Math.max(2, Math.floor(span / 12));
  for (let k = 0; k < n; k++) {
    const x = x0 + (k + 0.5) * (span / n);
    if (k % 2 === 0) tree(S, x, 0.22, z1 - 0.9, rnd, true);
    else lamp(S, B, lamps, x, 0.22, z1 - 0.7);
  }
  const nz = Math.max(1, Math.floor((z1 - z0) / 14));
  for (let k = 0; k < nz; k++) {
    const z = z0 + (k + 0.5) * ((z1 - z0) / nz);
    if (k % 2 === 0) lamp(S, B, lamps, x1 - 0.7, 0.22, z);
    else tree(S, x1 - 0.9, 0.22, z, rnd, true);
  }
  if (core) {
    // 消防栓、垃圾桶、路牌
    S.cyl(x1 - 0.8, 0.22, z1 - 2.4, 0.18, 0.7, PAL.red, 6);
    S.box(x0 + 0.5, 0.22, z1 - 1.0, x0 + 1.1, 1.0, z1 - 0.4, '#3d5747');
    S.box(x1 - 0.85, 0.22, z1 - 0.85, x1 - 0.75, 3.2, z1 - 0.75, PAL.lampPole);
    S.box(x1 - 2.2, 2.7, z1 - 0.9, x1 - 0.8, 3.1, z1 - 0.7, '#2d5a45');
    S.box(x1 - 0.9, 2.2, z1 - 2.2, x1 - 0.7, 2.6, z1 - 0.8, '#2d5a45');
  }
}

export function tree(S, x, y, z, rnd, planter = false) {
  if (planter) S.box(x - 0.7, y, z - 0.7, x + 0.7, y + 0.18, z + 0.7, '#8d7a5e');
  S.cyl(x, y, z, 0.16, 2.2, PAL.trunk, 6);
  const c = rnd() < 0.5 ? PAL.leaf : PAL.leaf2;
  S.ball(x, y + 1.7, z, 1.15, c, 0);
  S.ball(x + 0.35, y + 2.5, z - 0.2, 0.8, c, 0);
}

export function lamp(S, B, lamps, x, y, z, tall = 4.2) {
  S.cyl(x, y, z, 0.09, tall, PAL.lampPole, 6);
  S.box(x - 0.08, y + tall - 0.1, z - 0.08, x + 0.5, y + tall, z + 0.08, PAL.lampPole);
  B.box(x + 0.25, y + tall - 0.35, z - 0.14, x + 0.6, y + tall - 0.1, z + 0.14, '#fff1c8');
  lamps.push([x + 0.4, y, z]);
}

export function palm(S, x, y, z, rnd, h = 6) {
  // 微彎的樹幹（幾段小圓柱）＋向外下垂的葉片
  const lean = (rnd() - 0.5) * 0.5;
  let px = x, py = y;
  const seg = 6;
  for (let k = 0; k < seg; k++) {
    const nx = x + lean * Math.pow((k + 1) / seg, 2) * 2;
    S.cyl((px + nx) / 2, py, z, 0.17 - k * 0.012, h / seg + 0.05, k % 2 ? PAL.palmTrunk : '#93744f', 6);
    px = nx;
    py += h / seg;
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + rnd() * 0.4;
    S.add(TBOX, px + Math.cos(a) * 1.0, py - 0.25, z + Math.sin(a) * 1.0, 2.4, 0.08, 0.5, -a, k % 2 ? PAL.frond : '#6f9a50', 0, -0.45);
  }
  S.ball(px, py - 0.35, z, 0.32, '#7a5d3c');
}

function bench(S, x, y, z, ry = 0) {
  const c = PAL.wood, f = '#3a4a42';
  const dx = Math.cos(ry), dz = -Math.sin(ry);
  S.add(TBOX, x, y + 0.42, z, 1.8, 0.08, 0.5, ry, c);
  S.add(TBOX, x - dz * 0.22, y + 0.5, z + dx * 0.22, 1.8, 0.4, 0.07, ry, c);
  for (const s of [-0.75, 0.75]) S.add(TBOX, x + dx * s, y, z + dz * s, 0.08, 0.45, 0.45, ry, f);
}

function park(S, D, B, lamps, rnd, x0, z0, x1, z1) {
  const ix0 = x0 + SIDEWALK, ix1 = x1 - SIDEWALK, iz0 = z0 + SIDEWALK, iz1 = z1 - SIDEWALK;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  S.box(ix0, 0.22, iz0, ix1, 0.32, iz1, PAL.grass);
  // 十字步道
  D.box(cx - 1.4, 0.32, iz0, cx + 1.4, 0.34, iz1, PAL.prom, true);
  D.box(ix0, 0.32, cz - 1.4, ix1, 0.34, cz + 1.4, PAL.prom, true);
  // 噴泉
  S.cyl(cx, 0.32, cz, 3.6, 0.55, PAL.trim, 12);
  S.cyl(cx, 0.32, cz, 3.1, 0.62, '#8fc9c4', 12);
  S.cyl(cx, 0.32, cz, 0.5, 1.6, PAL.trim, 8);
  S.cyl(cx, 1.9, cz, 1.2, 0.2, PAL.trim, 12);
  S.ball(cx, 2.1, cz, 0.45, '#cfeae6', 0);
  // 花圃與樹籬
  for (const [fx, fz] of [[ix0 + 5, iz0 + 5], [ix1 - 5, iz0 + 5], [ix0 + 5, iz1 - 5], [ix1 - 5, iz1 - 5]]) {
    S.cyl(fx, 0.32, fz, 1.6, 0.35, '#9c7f5c', 12);
    S.cyl(fx, 0.32, fz, 1.35, 0.5, '#d07a5a', 12);
    S.ball(fx, 0.75, fz, 0.6, '#e2b84f', 0);
  }
  S.box(ix0 + 0.4, 0.32, iz1 - 1.2, cx - 2.2, 1.0, iz1 - 0.4, PAL.hedge);
  S.box(cx + 2.2, 0.32, iz1 - 1.2, ix1 - 0.4, 1.0, iz1 - 0.4, PAL.hedge);
  for (let k = 0; k < 7; k++) {
    const tx = ix0 + 2 + rnd() * (ix1 - ix0 - 4), tz = iz0 + 2 + rnd() * (iz1 - iz0 - 6);
    if (Math.abs(tx - cx) < 5 && Math.abs(tz - cz) < 5) continue;
    if (Math.abs(tx - cx) < 2 || Math.abs(tz - cz) < 2) continue;
    tree(S, tx, 0.32, tz, rnd);
  }
  bench(S, cx - 6, 0.32, cz + 2.4, 0);
  bench(S, cx + 6, 0.32, cz - 2.4, 0);
  lamp(S, B, lamps, cx + 2, 0.32, cz + 5);
  lamp(S, B, lamps, cx - 2, 0.32, cz - 5);
}

function hall(S, G, L, rnd, x0, z0, x1, z1) {
  // 新古典市民會堂：寬台階、六根柱子、三角山牆
  const ix0 = x0 + SIDEWALK + 2, ix1 = x1 - SIDEWALK - 2, iz0 = z0 + SIDEWALK + 1, iz1 = z1 - SIDEWALK - 5;
  const white = '#ece6d6', shade = '#d9d1bd';
  S.box(ix0 - 1, 0.22, iz0, ix1 + 1, 1.2, iz1 + 4, shade);
  for (let k = 0; k < 4; k++) S.box(ix0 - 1, 0.22, iz1 + 1 + k * 0.75, ix1 + 1, 1.2 - k * 0.24, iz1 + 4, white);
  S.box(ix0, 1.2, iz0, ix1, 10.5, iz1 - 2, white);
  for (let k = 0; k < 6; k++) {
    const cx = ix0 + 1.5 + k * ((ix1 - ix0 - 3) / 5);
    S.cyl(cx, 1.2, iz1 - 0.6, 0.55, 8.2, '#f4efe2', 12);
    S.box(cx - 0.7, 9.3, iz1 - 1.3, cx + 0.7, 9.6, iz1 + 0.1, white);
  }
  S.box(ix0 - 0.3, 9.6, iz0, ix1 + 0.3, 10.8, iz1 + 0.3, white);
  S.add(TBOX, (ix0 + ix1) / 2, 10.8, iz1 - 0.2, ix1 - ix0 + 0.6, 0.3, 1.0, 0, shade);
  S.add(T.prism, (ix0 + ix1) / 2, 10.8, (iz0 + iz1) / 2, ix1 - ix0 + 0.6, 3.2, iz1 - iz0 + 0.6, Math.PI / 2, '#5d6b67');
  for (let k = 0; k < 5; k++) {
    const cx = ix0 + 3 + k * ((ix1 - ix0 - 6) / 4);
    L.box(cx - 0.9, 2.6, iz1 - 1.98, cx + 0.9, 7.2, iz1 - 1.88, PAL.glass, true);
  }
  // 側面窗
  for (let k = 0; k < 4; k++) {
    const cz = iz0 + 2.5 + k * ((iz1 - iz0 - 5) / 3);
    G.box(ix1 + 0.02, 3, cz - 0.8, ix1 + 0.12, 7.2, cz + 0.8, PAL.glass, true);
  }
  // 前廣場花壇
  for (const sx of [ix0 + 1.5, ix1 - 1.5]) {
    S.box(sx - 1.4, 0.22, iz1 + 4.4, sx + 1.4, 0.8, iz1 + 6.2, '#b9b19b');
    S.ball(sx, 0.8, iz1 + 5.3, 0.9, PAL.leaf2, 0);
  }
}

// ───────────────────────── 沿海步道 ─────────────────────────
function promenade(S, D, B, lamps, rnd) {
  const { z0, z1, y } = PROM;
  S.box(-420, 0, z0, 420, y, z1, PAL.prom);
  // 鋪面分隔線
  for (let x = -420; x < 420; x += 4) D.box(x, y, z0, x + 0.08, y + 0.012, z1, PAL.promLine, true);
  D.box(-420, y, z0 + 3.2, 420, y + 0.012, z0 + 3.3, PAL.promLine, true);
  // 護欄：深綠立柱＋兩道橫桿，在樓梯口與碼頭口斷開
  const gaps = [...STAIRS_X.map((x) => [x - 2.4, x + 2.4]), [BEACH.boat.deck.x0, BEACH.boat.deck.x1], [HARBOR.gateX - 7, HARBOR.gateX + 7]];
  const inGap = (x) => gaps.some(([a, b]) => x > a && x < b);
  for (let x = -260; x < 260; x += 2.5) {
    if (inGap(x) || inGap(x + 2.5)) continue;
    S.box(x - 0.07, y, RAIL_Z - 0.07, x + 0.07, y + 1.15, RAIL_Z + 0.07, PAL.rail);
    S.box(x, y + 1.05, RAIL_Z - 0.06, x + 2.5, y + 1.15, RAIL_Z + 0.06, PAL.railTop);
    S.box(x, y + 0.55, RAIL_Z - 0.04, x + 2.5, y + 0.62, RAIL_Z + 0.04, PAL.rail);
  }
  // 階梯
  for (const x of STAIRS_X) {
    for (let k = 0; k < 3; k++) S.box(x - 2.2, SAND_Y, z1 + k * 0.7, x + 2.2, y - (k + 1) * 0.11, z1 + (k + 1) * 0.7, PAL.prom);
  }
  // 棕櫚、路燈、長椅、垃圾桶、公車站
  for (let x = -252; x < 252; x += 16) {
    if (inGap(x)) continue;
    palm(S, x, y, z1 - 1.6, rnd, 5.2 + rnd() * 1.6);
    S.cyl(x, y, z1 - 1.6, 0.85, 0.25, '#b9b099', 12);
  }
  // 海港大門：穿過步道的車道
  D.box(HARBOR.gateX - 6, y, z0, HARBOR.gateX + 6, y + 0.015, z1, PAL.asphalt, true);
  D.box(HARBOR.gateX - 0.12, y + 0.015, z0, HARBOR.gateX + 0.12, y + 0.03, z1, PAL.yellow, true);
  for (let x = -244; x < 252; x += 16) {
    if (Math.abs(x - HARBOR.gateX) < 8) continue;
    lamp(S, B, lamps, x, y, z0 + 1.2, 4.6);
    if (!inGap(x + 4)) bench(S, x + 4, y, z1 - 1.2, 0);
  }
  // 公車站亭
  const bx = -40;
  S.box(bx - 3, y, z0 + 0.6, bx + 3, y + 0.1, z0 + 2.4, PAL.lampPole);
  for (const sx of [bx - 2.8, bx + 2.8]) S.box(sx - 0.08, y, z0 + 2.2, sx + 0.08, y + 2.7, z0 + 2.4, PAL.lampPole);
  S.box(bx - 3.1, y + 2.7, z0 + 0.4, bx + 3.1, y + 2.9, z0 + 2.6, '#2d5a45');
  S.box(bx - 2.6, y + 0.9, z0 + 2.22, bx + 2.6, y + 2.4, z0 + 2.3, '#9fc3c2');
  bench(S, bx, y, z0 + 1.6, 0);
}

// ───────────────────────── 沙灘與海上設施 ─────────────────────────
function beach(S, D, rnd) {
  const z0 = PROM.z1;
  S.box(-420, 0, z0, 420, SAND_Y, 44, PAL.sand);
  // 防波堤：一串大石塊斜插入海
  for (let k = 0; k < 34; k++) {
    const t = k / 33;
    const x = -126 + t * 26 + (rnd() - 0.5) * 2.5, z = 22 + t * 66 + (rnd() - 0.5) * 2.5;
    const s = 2.2 + rnd() * 1.6;
    S.add(T.ico, x, -0.8, z, s * 1.3, s, s * 1.15, rnd() * 6, rnd() < 0.5 ? PAL.rock : PAL.rock2);
    if (rnd() < 0.6) S.add(T.ico, x + (rnd() - 0.5) * 2.5, -0.5, z + (rnd() - 0.5) * 2.5, s * 0.8, s * 0.7, s * 0.8, rnd() * 6, PAL.rock2);
  }
  // 觀景棧橋與紅頂涼亭
  const px = -64;
  S.box(px - 2, 0.85, z0, px + 2, 1.05, 98, PAL.wood);
  for (let z = z0 + 4; z < 98; z += 5) {
    for (const sx of [px - 1.8, px + 1.8]) S.box(sx - 0.15, -2, z - 0.15, sx + 0.15, 0.85, z + 0.15, PAL.woodDark);
  }
  for (let z = z0; z < 96; z += 2.4) {
    S.box(px + 1.9, 1.05, z - 0.05, px + 2.0, 1.95, z + 0.05, PAL.rail);
    S.box(px - 2.0, 1.05, z - 0.05, px - 1.9, 1.95, z + 0.05, PAL.rail);
  }
  S.box(px + 1.9, 1.85, z0, px + 2.02, 1.95, 96, PAL.railTop);
  S.box(px - 2.02, 1.85, z0, px - 1.9, 1.95, 96, PAL.railTop);
  S.cyl(px, 0.85, 103, 7, 0.22, PAL.wood, 12);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    S.box(px + Math.cos(a) * 5.6 - 0.15, -2, 103 + Math.sin(a) * 5.6 - 0.15, px + Math.cos(a) * 5.6 + 0.15, 4.6, 103 + Math.sin(a) * 5.6 + 0.15, '#efe5cf');
  }
  S.add(T.cone8, px, 4.6, 103, 14.5, 3.4, 14.5, Math.PI / 8, '#c65a3f');
  S.add(T.cone8, px, 4.4, 103, 14.8, 0.3, 14.8, Math.PI / 8, '#a8462f');
  S.ball(px, 7.9, 103, 0.35, PAL.cream);
  // 租船碼頭的木平台與棧橋（平台在沙灘上，棧橋伸進海裡）
  const dk = BEACH.boat.deck, pr = BEACH.boat.pier;
  S.box(dk.x0, SAND_Y, dk.z0 + 0.1, dk.x1, DECK_Y, dk.z1, PAL.wood);
  for (let x = dk.x0 + 1.2; x < dk.x1; x += 1.2) D.box(x, DECK_Y, dk.z0 + 0.1, x + 0.06, DECK_Y + 0.01, dk.z1, PAL.wood2, true);
  S.box(pr.x - 2, DECK_Y - 0.25, pr.z0, pr.x + 2, DECK_Y, pr.z1, PAL.wood);
  for (let z = pr.z0; z < pr.z1; z += 1.1) D.box(pr.x - 2, DECK_Y, z, pr.x + 2, DECK_Y + 0.01, z + 0.06, PAL.wood2, true);
  for (let z = pr.z0 + 3; z <= pr.z1; z += 5) {
    for (const sx of [pr.x - 1.85, pr.x + 1.85]) {
      S.box(sx - 0.16, -2, z - 0.16, sx + 0.16, DECK_Y + 0.55, z + 0.16, PAL.woodDark);
    }
  }
  // 平台護欄（北側入口與棧橋口不封）
  for (let x = dk.x0; x <= dk.x1; x += 2) {
    if (Math.abs(x - pr.x) < 2.5) continue;
    S.box(x - 0.06, DECK_Y, dk.z1 - 0.12, x + 0.06, DECK_Y + 1.0, dk.z1, PAL.rail);
  }
  S.box(dk.x0, DECK_Y + 0.9, dk.z1 - 0.12, pr.x - 2.4, DECK_Y + 1.0, dk.z1, PAL.railTop);
  S.box(pr.x + 2.4, DECK_Y + 0.9, dk.z1 - 0.12, dk.x1, DECK_Y + 1.0, dk.z1, PAL.railTop);
  for (const sx of [dk.x0, dk.x1 - 0.12]) {
    for (let z = dk.z0 + 2; z < dk.z1; z += 2) S.box(sx, DECK_Y, z - 0.06, sx + 0.12, DECK_Y + 1.0, z + 0.06, PAL.rail);
    S.box(sx, DECK_Y + 0.9, dk.z0 + 1, sx + 0.12, DECK_Y + 1.0, dk.z1, PAL.railTop);
  }
  // 水上摩托車浮動碼頭
  const jd = BEACH.jetski.dock;
  S.box(jd.x - 1.4, -0.3, jd.z0, jd.x + 1.4, 0.38, jd.z1, '#c9c2ae');
  for (let z = jd.z0; z < jd.z1; z += 2) D.box(jd.x - 1.4, 0.38, z, jd.x + 1.4, 0.39, z + 0.08, '#a9a28f', true);
  S.box(jd.x - 1.2, SAND_Y, 36, jd.x + 1.2, 0.36, jd.z0, PAL.wood);
  // 救生員瞭望台
  const lx = 76, lz = 34;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) S.box(lx + dx - 0.12, SAND_Y, lz + dz - 0.12, lx + dx + 0.12, 3, lz + dz + 0.12, PAL.white);
  S.box(lx - 1.4, 3, lz - 1.4, lx + 1.4, 3.2, lz + 1.4, PAL.wood);
  S.box(lx - 1.2, 3.2, lz - 1.2, lx + 1.2, 5.0, lz + 1.2, PAL.red);
  S.box(lx - 1.6, 5.0, lz - 1.6, lx + 1.6, 5.25, lz + 1.6, PAL.white);
  S.add(TBOX, lx, 0.6, lz + 2.6, 0.6, 0.1, 4.5, 0, PAL.wood, -0.62);
  // 排球網
  const vx = -2, vz = 33;
  for (const sx of [-5, 5]) S.cyl(vx + sx, SAND_Y, vz, 0.08, 2.5, PAL.white, 6);
  S.box(vx - 5, 1.6, vz - 0.03, vx + 5, 2.4, vz + 0.03, '#e8e4d8');
  // 淋浴柱
  for (const sx of [-60, 30, 86]) {
    S.box(sx - 0.1, SAND_Y, 19.5, sx + 0.1, 2.6, 19.7, PAL.metal);
    S.box(sx - 0.1, 2.5, 19.5, sx + 0.5, 2.6, 19.7, PAL.metal);
  }
}

export { bench, TBOX };
