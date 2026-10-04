// 鹽岬島地圖：地形、命名城鎮、可進入的建築（牆、門、窗、樓梯、樓板）、樹、車與戰利品點。
// 所有碰撞體都是軸對齊方塊或直立圓柱；畫面直接用同一批方塊建模，兩者永遠對齊。
import { mulberry32, clamp, csin, ccos } from './rng.js';
import { buildTerrain, heightAt, TOWNS, EXT, CELL, N, coastAt, RIVER, mountain } from './terrain.js';

export const MAT = {
  plaster: 0, plasterWarm: 1, plasterRose: 2, plasterSage: 3, concrete: 4, brick: 5, wood: 6, tile: 7,
  roof: 8, metal: 9, rust: 10, container: 11, stone: 12, trim: 13, salt: 14, car: 15, tank: 16, crate: 17, temple: 18, glass: 19, facade: 20, siding: 21, hidden: 22, invis: 23,
};
export const MAT_COUNT = 24;
// 只供繪製的細節方塊種類（不進碰撞）
export const DK = { frame: 0, glass: 1, base: 2, wains: 3, lamp: 4, rad: 5, ac: 6, dark: 7, steel: 8, poster: 9, corn: 10, found: 11, brick: 12, fence: 13 };

const WALL_T = 0.25;
const STEP_N = 13, STEP_RUN = 0.3;

// ---- 局部座標的建築收集器，完成後旋轉 90° 的倍數放到世界 ----
class Local {
  constructor() { this.boxes = []; this.cyls = []; this.loot = []; this.doors = []; this.deco = []; this.dboxes = []; this.open = []; this.glaze = false; this.out = 0; this.floor = 0; }
  box(x0, y0, z0, x1, y1, z1, m, c = 0) {
    if (x1 - x0 < 0.01 || y1 - y0 < 0.01 || z1 - z0 < 0.01) return;
    this.boxes.push([Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), m, c]);
  }
  dbox(x0, y0, z0, x1, y1, z1, k, c = 0) {
    if (Math.abs(x1 - x0) < 0.004 || Math.abs(y1 - y0) < 0.004 || Math.abs(z1 - z0) < 0.004) return;
    this.dboxes.push([Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), k, c]);
  }
  // 門窗框與玻璃：沿 x 的牆（ax='x'）或沿 z 的牆（ax='z'），u 為沿牆座標、w 為牆中心線
  frame(ax, a, b, w, y0, lo, hi, t) {
    // 外牆的門窗位置與朝外法線（給前端擺鐵窗、遮雨棚、門片等外觀模組）
    if (this.out) {
      const u = (a + b) / 2, y = y0 + (lo + hi) / 2, f = w + this.out * t / 2;
      this.open.push([...(ax === 'x' ? [u, y, f, 0, this.out] : [f, y, u, this.out, 0]), b - a, hi - lo, lo > 0.3 ? 0 : 1, this.floor]);
    }
    const ft = 0.07, fd = t / 2 + 0.025;
    const B = (u0, v0, d0, u1, v1, d1, k) => (ax === 'x' ? this.dbox(u0, v0, w + d0, u1, v1, w + d1, k) : this.dbox(w + d0, v0, u0, w + d1, v1, u1, k));
    B(a, y0 + lo, -fd, a + ft, y0 + hi, fd, DK.frame);
    B(b - ft, y0 + lo, -fd, b, y0 + hi, fd, DK.frame);
    B(a, y0 + hi - ft, -fd, b, y0 + hi, fd, DK.frame);
    if (lo > 0.3) {
      B(a - 0.05, y0 + lo - 0.03, -fd - 0.04, b + 0.05, y0 + lo + 0.04, fd + 0.04, DK.frame);
      B(a + ft, y0 + lo + 0.04, -0.012, b - ft, y0 + hi - ft, 0.012, DK.glass);
      if (b - a > 1.25) B((a + b) / 2 - 0.03, y0 + lo, -0.035, (a + b) / 2 + 0.03, y0 + hi, 0.035, DK.frame);
      B(a + ft, y0 + lo + (hi - lo) * 0.62, -0.03, b - ft, y0 + lo + (hi - lo) * 0.62 + 0.05, 0.03, DK.frame);
    }
  }
  // 室內踢腳板與腰牆：face 為牆內面座標，dir 為房間在哪一側（+1／-1），避開門窗
  trim(ax, u0, u1, face, dir, y, openings) {
    const bands = [[0, 0.1, 0.022, DK.base], [0.1, 0.92, 0.01, DK.wains]];
    for (const [lo, hi, th, k] of bands) {
      const cuts = openings.filter((o) => o[2] < hi && o[3] > lo && o[1] > u0 && o[0] < u1).sort((p, q) => p[0] - q[0]);
      let u = u0;
      const put = (a, b) => { if (b - a < 0.05) return; if (ax === 'x') this.dbox(a, y + lo, face, b, y + hi, face + dir * th, k); else this.dbox(face, y + lo, a, face + dir * th, y + hi, b, k); };
      for (const o of cuts) { put(u, o[0]); u = Math.max(u, o[1]); }
      put(u, u1);
    }
  }
  // 沿 x 方向的牆（z 為牆中心線），openings: [a, b, lo, hi]（a,b 為 x 座標；lo,hi 為相對 y0 高度）
  wallX(x0, x1, z, y0, y1, t, m, openings = [], c = 0) {
    const ops = openings.filter((o) => o[1] > x0 && o[0] < x1).sort((a, b) => a[0] - b[0]);
    let x = x0;
    for (const [a, b, lo, hi] of ops) {
      this.box(x, y0, z - t / 2, a, y1, z + t / 2, m, c);
      if (lo > 0) this.box(a, y0, z - t / 2, b, y0 + lo, z + t / 2, m, c);
      if (y0 + hi < y1) this.box(a, y0 + hi, z - t / 2, b, y1, z + t / 2, m, c);
      if (this.glaze) this.frame('x', a, b, z, y0, lo, hi, t);
      x = b;
    }
    this.box(x, y0, z - t / 2, x1, y1, z + t / 2, m, c);
  }
  wallZ(z0, z1, x, y0, y1, t, m, openings = [], c = 0) {
    const ops = openings.filter((o) => o[1] > z0 && o[0] < z1).sort((a, b) => a[0] - b[0]);
    let z = z0;
    for (const [a, b, lo, hi] of ops) {
      this.box(x - t / 2, y0, z, x + t / 2, y1, a, m, c);
      if (lo > 0) this.box(x - t / 2, y0, a, x + t / 2, y0 + lo, b, m, c);
      if (y0 + hi < y1) this.box(x - t / 2, y0 + hi, a, x + t / 2, y1, b, m, c);
      if (this.glaze) this.frame('z', a, b, x, y0, lo, hi, t);
      z = b;
    }
    this.box(x - t / 2, y0, z, x + t / 2, y1, z1, m, c);
  }
  // 矩形樓板扣掉一個洞
  slab(x0, z0, x1, z1, y0, y1, m, hole) {
    if (!hole) { this.box(x0, y0, z0, x1, y1, z1, m); return; }
    const [hx0, hz0, hx1, hz1] = hole;
    this.box(x0, y0, z0, hx0, y1, z1, m);
    this.box(hx1, y0, z0, x1, y1, z1, m);
    this.box(hx0, y0, z0, hx1, y1, hz0, m);
    this.box(hx0, y0, hz1, hx1, y1, z1, m);
  }
}

function windowsAlong(a, b, spacing, width, lo, hi, avoid = [], skip = 0, rnd) {
  const out = [], L = b - a, n = Math.floor((L - 0.8) / spacing);
  for (let k = 0; k < n; k++) {
    const c = a + (L / n) * (k + 0.5);
    const o = [c - width / 2, c + width / 2, lo, hi];
    if (avoid.some(([p, q]) => o[1] > p - 0.4 && o[0] < q + 0.4)) continue;
    if (skip && rnd() < skip) continue;
    out.push(o);
  }
  return out;
}

const WIN = (o) => [o[0], o[1], 0.95, 2.15];

// 家具尺寸（與 tools/build-furniture.py 一致）：寬（x）、高、深（z）、要不要碰撞、背面朝向（z：-Z 靠牆；x：-X 靠牆）
export const FURN = {
  bed: [2.0, 0.55, 1.5, 1, 'x'], sofa: [1.9, 0.85, 0.85, 1, 'z'], dining: [1.4, 0.75, 1.66, 1, 'z'], bookcase: [1.0, 1.9, 0.35, 1, 'z'],
  wardrobe: [1.2, 2.0, 0.6, 1, 'z'], kitchen: [2.0, 0.9, 0.6, 1, 'z'], fridge: [0.7, 1.8, 0.7, 1, 'z'], tvstand: [1.6, 0.5, 0.45, 1, 'z'],
  desk: [1.2, 0.75, 1.0, 1, 'z'], rack: [2.0, 2.0, 0.6, 1, 'z'], boxes: [0.9, 0.9, 0.7, 1, 'z'], plant: [0.5, 1.0, 0.5, 0, 'z'],
};
// 在房間矩形內沿牆擺家具；o = { x0, x1, z0, z1, y, sets, avoid: [[x0,z0,x1,z1]…] }
function furnish(L, r, o) {
  const placed = [...o.avoid];
  const hit = (a) => placed.some((b) => a[2] > b[0] && a[0] < b[2] && a[3] > b[1] && a[1] < b[3]);
  const area = (o.x1 - o.x0) * (o.z1 - o.z0);
  const n = Math.min(8, 2 + Math.floor(area / 18) + Math.floor(r() * 2));
  const want = o.sets.slice().sort(() => r() - 0.5);
  const extra = o.extra || ['boxes', 'plant', 'bookcase', 'boxes'];
  while (want.length < n) want.push(extra[Math.floor(r() * extra.length)]);
  want.length = Math.min(want.length, n);
  for (const k of want) {
    const [fw, fh, fd, solid, back] = FURN[k];
    // 牆：0 前牆（物件背面朝 +z）、1 左牆、2 右牆
    for (let tries = 0; tries < 10; tries++) {
      const wall = Math.floor(r() * 3);
      let w = fw, d = fd, yaw;
      if (wall === 0) yaw = Math.PI; else if (wall === 1) yaw = -Math.PI / 2; else yaw = Math.PI / 2;
      if (back === 'x') yaw += Math.PI / 2;
      const across = (wall === 0) === (back === 'z');   // 物件的寬是否沿著 x
      if (!across) { w = fd; d = fw; }
      let cx, cz;
      if (wall === 0) { cz = o.z1 - d / 2; cx = o.x0 + w / 2 + r() * Math.max(0, o.x1 - o.x0 - w); }
      else { cx = wall === 1 ? o.x0 + w / 2 : o.x1 - w / 2; cz = o.z0 + d / 2 + r() * Math.max(0, o.z1 - o.z0 - d); }
      const rect = [cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2];
      if (rect[0] < o.x0 - 0.01 || rect[2] > o.x1 + 0.01 || rect[1] < o.z0 - 0.01 || rect[3] > o.z1 + 0.01 || hit(rect)) continue;
      placed.push([rect[0] - 0.25, rect[1] - 0.25, rect[2] + 0.25, rect[3] + 0.25]);
      if (solid) L.box(rect[0], o.y, rect[1], rect[2], o.y + fh, rect[3], MAT.hidden);
      L.deco.push({ t: 'furn', k, x: cx, z: cz, y: o.y, yaw });
      if ((k === 'dining' || k === 'desk' || k === 'tvstand') && r() < 0.5) L.loot.push([cx, o.y + fh + 0.02, cz, 1]);
      break;
    }
  }
}

// 透天厝／街屋／公寓：f 層、可選騎樓、樓梯折返上樓與屋頂樓梯間
function house(L, rnd, o) {
  const { w, d, floors } = o, fh = o.fh || 3.2, t = WALL_T, m = o.mat ?? MAT.plaster, tint = o.tint || 0;
  const A = o.arcade ? 2.4 : 0;
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
  const ix0 = x0 + t, ix1 = x1 - t, iz0 = z0 + t, iz1 = z1 - t;
  const runL = STEP_N * STEP_RUN, rise = fh / STEP_N;
  const sx0 = ix0 + 1.0;
  const stairs = floors > 1 || o.roofAccess;
  const zS = iz0 + 2.2;
  const roofAccess = !!o.roofAccess && w >= runL + 3.2;
  const flights = floors - 1 + (roofAccess ? 1 : 0);
  const floorM = o.floorMat ?? (rnd() < 0.5 ? MAT.wood : MAT.tile);
  // 地基與一樓地坪
  L.box(x0 - 0.1, -1.6, z0 - 0.1, x1 + 0.1, 0.05, z1 + 0.1, MAT.concrete);
  L.box(ix0, 0.05, iz0, ix1, 0.15, iz1 - A, floorM);
  if (A) L.box(x0, 0.05, z1 - A, x1, 0.12, z1, MAT.tile);
  const doorX = o.doorX ?? (w > 7 ? x0 + w * 0.68 : 0);
  const doorW = o.arcade ? 2.2 : 1.2;
  const front = [[doorX - doorW / 2, doorX + doorW / 2, 0, 2.3]];
  const hasBack = o.backDoor ?? (w * d > 70 && rnd() < 0.6);
  const backX = x1 - 1.6;
  const stairSpan = stairs ? [[sx0 - 1.0, sx0 + runL + 1.0]] : [];
  const xp = sx0 + runL + 1.0 + Math.max(0, (ix1 - (sx0 + runL + 1.0))) * 0.45;
  const partition = w >= 10 && d >= 7 && ix1 - xp > 2.2;
  const partDoor = zS + 0.4 + rnd() * Math.max(0.1, (iz1 - A) - zS - 2.2);
  const dr = mulberry32(Math.floor(rnd() * 4294967296)); // 細節用的亂數，不影響碰撞配置
  L.glaze = true;

  for (let f = 0; f < floors; f++) {
    const y = 0.15 + f * fh, yTop = y + fh;
    const isG = f === 0;
    // 正面牆
    const fwz = isG ? z1 - A - t / 2 : z1 - t / 2;
    const fo = isG ? front : windowsAlong(x0 + 0.5, x1 - 0.5, o.arcade ? 2.4 : 2.8, o.arcade ? 1.6 : 1.2, 0.95, 2.3, [], 0, rnd);
    if (isG && !o.arcade) fo.push(...windowsAlong(x0 + 0.5, x1 - 0.5, 2.8, 1.2, 0.95, 2.15, front, 0.3, rnd));
    if (isG && o.arcade && w > 6) fo.push(...windowsAlong(x0 + 0.5, x1 - 0.5, 2.6, 1.4, 0.9, 2.2, front, 0, rnd));
    L.floor = f; L.out = 1;
    L.wallX(x0, x1, fwz, isG ? 0.05 : y - 0.25, yTop - (f === floors - 1 ? 0 : 0.25), t, m, fo.map((p) => [p[0], p[1], p[2] + (isG ? 0.1 : 0.25), p[3] + (isG ? 0.1 : 0.25)]), tint);
    L.out = -1;
    // 背面牆
    const bo = [];
    if (isG && hasBack) bo.push([backX - 0.6, backX + 0.6, 0, 2.3]);
    bo.push(...windowsAlong(x0 + 0.5, x1 - 0.5, 3, 1.1, 0.95, 2.15, [...stairSpan, ...bo.map((b) => [b[0], b[1]])], 0.25, rnd));
    L.wallX(x0, x1, z0 + t / 2, isG ? 0.05 : y - 0.25, yTop - (f === floors - 1 ? 0 : 0.25), t, m, bo.map((p) => [p[0], p[1], p[2] + (isG ? 0.1 : 0.25), p[3] + (isG ? 0.1 : 0.25)]), tint);
    // 側牆
    const sideZ1 = isG ? z1 - A - t : z1 - t;
    const sides = [];
    for (const sx of [x0 + t / 2, x1 - t / 2]) {
      const so = o.party && o.party.includes(sx < 0 ? 'w' : 'e') ? [] : windowsAlong(z0 + 0.6, sideZ1 - 0.4, 3, 1.1, 0.95, 2.15, sx < 0 && stairs ? [[iz0, zS + 0.3]] : [], 0.3, rnd);
      L.out = sx < 0 ? -1 : 1;
      L.wallZ(z0 + t, sideZ1, sx, isG ? 0.05 : y - 0.25, yTop - (f === floors - 1 ? 0 : 0.25), t, m, so.map((p) => [p[0], p[1], p[2] + (isG ? 0.1 : 0.25), p[3] + (isG ? 0.1 : 0.25)]), tint);
      sides.push([sx, so]);
    }
    L.out = 0;
    // 室內：踢腳板、腰牆、吸頂燈、窗下暖氣片；室外：窗下冷氣機
    const rel = (list) => list; // 開口高度本來就是相對樓地板
    L.trim('x', ix0, ix1, fwz - t / 2, -1, y, rel(fo));
    L.trim('x', ix0, ix1, z0 + t, 1, y, rel(bo));
    for (const [sx, so] of sides) L.trim('z', z0 + t, sideZ1, sx < 0 ? x0 + t : x1 - t, sx < 0 ? 1 : -1, y, rel(so));
    const lampZ = (zS + (isG ? iz1 - A : iz1)) / 2;
    const lampY = yTop - (f === floors - 1 ? 0.25 : 0.25);
    for (const lx of partition ? [(ix0 + xp) / 2 + 1, (xp + ix1) / 2] : [(ix0 + ix1) / 2 + (stairs ? 1.2 : 0)]) L.dbox(lx - 0.55, lampY - 0.04, lampZ - 0.14, lx + 0.55, lampY, lampZ + 0.14, DK.lamp);
    for (const [sx, so] of sides) for (const wv of so) if (dr() < 0.45) { const fx = sx < 0 ? x0 + t : x1 - t, dd = sx < 0 ? 1 : -1; L.dbox(fx, y + 0.18, wv[0] + 0.1, fx + dd * 0.09, y + 0.72, wv[1] - 0.1, DK.rad); }
    if (!isG && !o.cab) for (const [list, face, dd] of [[fo, z1, 1], [bo, z0, -1]]) for (const wv of list) {
      if (wv[2] < 0.5 || dr() > 0.3) continue;
      const cx = (wv[0] + wv[1]) / 2;
      L.dbox(cx - 0.4, y + 0.1, face, cx + 0.4, y + 0.66, face + dd * 0.34, DK.ac);
      L.dbox(cx - 0.36, y + 0.04, face, cx - 0.32, y + 0.1, face + dd * 0.36, DK.steel); L.dbox(cx + 0.32, y + 0.04, face, cx + 0.36, y + 0.1, face + dd * 0.36, DK.steel);
    }
    // 隔間
    if (partition) L.wallZ(zS, iz1 - (isG ? A : 0), xp, y, yTop - 0.25, 0.16, m, [[partDoor, partDoor + 1.2, 0, 2.2]], tint);
    // 樓梯（第 f 段：從 f 樓到 f+1 樓／屋頂）
    if (f < flights) {
      const lane = f % 2, dir = lane === 0 ? 1 : -1;
      const lz0 = iz0 + lane * 1.1, lz1 = lz0 + 1.1;
      for (let k = 0; k < STEP_N; k++) {
        const top = y + (k + 1) * rise;
        const a = dir > 0 ? sx0 + k * STEP_RUN : sx0 + runL - (k + 1) * STEP_RUN;
        L.box(a, y, lz0, a + STEP_RUN, top, lz1, MAT.concrete);
      }
    }
    // 上一層樓板（或屋頂）
    const holeOf = (fl) => {
      if (fl >= flights) return null;
      const lane = fl % 2, lz0 = iz0 + lane * 1.1;
      return lane === 0 ? [sx0 + runL * 0.25, lz0, sx0 + runL, lz0 + 1.1] : [sx0, lz0, sx0 + runL * 0.75, lz0 + 1.1];
    };
    const hole = holeOf(f);
    const top = f === floors - 1;
    if (!top) {
      L.slab(ix0, iz0, ix1, iz1, yTop - 0.25, yTop, floorM, hole);
      if (isG && A) L.box(x0, yTop - 0.25, z1 - A - t, x1, yTop, z1, MAT.concrete);
    } else {
      L.slab(x0, z0, x1, z1, yTop - 0.25, yTop, MAT.concrete, hole);
    }
    // 樓梯洞旁的欄杆
    if (hole) {
      const lane = f % 2;
      const nextHasFlight = f + 1 < flights && (f + 1) % 2 !== lane;
      const ry = yTop;
      if (lane === 1) L.box(hole[0], ry, zS - 0.04, hole[2], ry + 1.0, zS + 0.04, MAT.trim);
      else if (!nextHasFlight && !(top && roofAccess)) L.box(hole[0], ry, iz0 + 1.06, hole[2], ry + 1.0, iz0 + 1.14, MAT.trim);
    }
    // 室內家具（外觀是 Blender 模型，碰撞用隱形方塊）：沿側牆與前牆找空位
    furnish(L, dr, {
      x0: ix0 + 0.04, x1: ix1 - 0.04, z0: zS + 0.35, z1: (isG ? iz1 - A : iz1) - 0.04, y,
      sets: isG ? ['sofa', 'tvstand', 'dining', 'kitchen', 'fridge', 'bookcase', 'plant'] : ['bed', 'wardrobe', 'desk', 'bookcase', 'plant', 'boxes'],
      avoid: [
        ...(isG ? [[doorX - doorW / 2 - 0.5, (isG ? iz1 - A : iz1) - 1.3, doorX + doorW / 2 + 0.5, iz1 + 1]] : []),
        ...(isG && hasBack ? [[backX - 1.1, iz0 - 1, backX + 1.1, iz0 + 1.4]] : []),
        ...(partition ? [[xp - 0.6, zS, xp + 0.6, iz1]] : []),
        [sx0 - 1.2, iz0 - 1, sx0 + runL + 1.2, zS + 0.35],
      ],
      partX: partition ? xp : null,
    });
    // 戰利品點
    const nL = 1 + (isG ? 1 : 0) + Math.floor(rnd() * (w * d > 90 ? 3 : 2));
    for (let k = 0; k < nL; k++) {
      const lx = ix0 + 0.7 + rnd() * (ix1 - ix0 - 1.4);
      const lz = zS + 0.7 + rnd() * Math.max(0.1, iz1 - (isG ? A : 0) - zS - 1.4);
      L.loot.push([lx, y + 0.02, lz, 1]);
    }
  }
  // 騎樓柱
  if (A) {
    const n = Math.max(1, Math.round(w / 4));
    for (let k = 0; k <= n; k++) {
      const cx = x0 + 0.25 + (w - 0.5) * (k / n);
      L.box(cx - 0.22, 0.12, z1 - 0.45, cx + 0.22, 0.15 + fh - 0.25, z1 - 0.01, o.pillar ?? MAT.trim);
    }
  }
  const roofY = 0.15 + floors * fh;
  // 屋頂：女兒牆、樓梯間或塔台、雨水塔
  if (o.cab) {
    const ch = 2.8;
    const ops = (a, b) => windowsAlong(a + 0.3, b - 0.3, 1.6, 1.3, 0.9, 2.4, [], 0, rnd);
    const doorL = flights % 2 === 1 ? 1 : 0; // 最後一段的方向決定抵達端
    L.wallX(x0, x1, z0 + 0.1, roofY, roofY + ch, 0.2, MAT.trim, ops(x0, x1));
    L.wallX(x0, x1, z1 - 0.1, roofY, roofY + ch, 0.2, MAT.trim, ops(x0, x1));
    L.wallZ(z0 + 0.2, z1 - 0.2, x0 + 0.1, roofY, roofY + ch, 0.2, MAT.trim, ops(z0, z1));
    L.wallZ(z0 + 0.2, z1 - 0.2, x1 - 0.1, roofY, roofY + ch, 0.2, MAT.trim, ops(z0, z1));
    L.box(x0 - 0.4, roofY + ch, z0 - 0.4, x1 + 0.4, roofY + ch + 0.3, z1 + 0.4, MAT.concrete);
    L.deco.push({ t: 'cabglass', x0, z0, x1, z1, y: roofY + 0.9, h: 1.5 });
    void doorL;
    L.loot.push([0, roofY + 0.02, (zS + z1) / 2, 2]);
  } else if (o.gable) {
    // 斜屋頂：畫面是兩坡加屋簷，碰撞以兩段平台近似
    const alongX = w >= d, span = alongX ? d : w;
    const rise = Math.min(2.6, span * 0.3);
    for (const [k0, k1] of [[0.22, 0.4], [0.38, 0.78]]) {
      if (alongX) L.box(x0, roofY + (k0 === 0.22 ? 0 : rise * 0.4), z0 + d * k0, x1, roofY + rise * k1, z1 - d * k0, MAT.roof);
      else L.box(x0 + w * k0, roofY + (k0 === 0.22 ? 0 : rise * 0.4), z0, x1 - w * k0, roofY + rise * k1, z1, MAT.roof);
    }
    L.deco.push({ t: 'gable', x0: x0 - (alongX ? 0.35 : 0.45), z0: z0 - (alongX ? 0.45 : 0.35), x1: x1 + (alongX ? 0.35 : 0.45), z1: z1 + (alongX ? 0.45 : 0.35), y: roofY - 0.05, rise: rise + 0.1, ax: alongX ? 'x' : 'z', m, c: o.endColor || tint, rm: o.roofTint || 0 });
    if (dr() < 0.4) L.dbox(x1 - 1.6, roofY + rise * 0.55, -0.15, x1 - 1.0, roofY + rise + 0.9, 0.35, DK.dark);
  } else {
    const ph = 0.8;
    // 屋頂冷氣主機與天線
    for (let k = 0; k < 1 + Math.floor(dr() * 3); k++) { const ax = x0 + 1.2 + dr() * (w - 2.4), az = z1 - 1.1 - dr() * Math.min(2, d * 0.3); L.dbox(ax - 0.45, roofY, az - 0.35, ax + 0.45, roofY + 0.7, az + 0.35, DK.ac); }
    if (dr() < 0.35) { const ax = x0 + 0.8; L.dbox(ax - 0.03, roofY, z1 - 0.8, ax + 0.03, roofY + 3.2, z1 - 0.74, DK.steel); L.dbox(ax - 0.5, roofY + 2.6, z1 - 0.8, ax + 0.5, roofY + 2.64, z1 - 0.76, DK.steel); }
    if (roofAccess) {
      const lane = (flights - 1) % 2, dir = lane === 0 ? 1 : -1;
      const hx0 = sx0 - 1.25, hx1 = sx0 + runL + 1.25, hz1 = zS + 0.3;
      const door = dir > 0 ? [sx0 + runL + 0.05, sx0 + runL + 1.15, 0, 2.2] : [sx0 - 1.15, sx0 - 0.05, 0, 2.2];
      L.wallX(hx0, hx1, hz1 - 0.1, roofY, roofY + 2.6, 0.2, m, [door], tint);
      L.wallZ(z0 + 0.0, hz1 - 0.2, hx0 + 0.1, roofY, roofY + 2.6, 0.2, m, [], tint);
      L.wallZ(z0 + 0.0, hz1 - 0.2, hx1 - 0.1, roofY, roofY + 2.6, 0.2, m, [], tint);
      L.wallX(hx0, hx1, z0 + 0.1, roofY, roofY + 2.6, 0.2, m, [], tint);
      L.box(hx0 - 0.15, roofY + 2.6, z0 - 0.1, hx1 + 0.15, roofY + 2.8, hz1 + 0.15, MAT.concrete);
      // 女兒牆避開樓梯間
      L.wallX(hx1, x1, z0 + 0.1, roofY, roofY + ph, 0.2, m, [], tint);
      L.wallX(x0, hx0, z0 + 0.1, roofY, roofY + ph, 0.2, m, [], tint);
      if (rnd() < 0.5) L.loot.push([(hx1 + x1) / 2 > x1 - 1 ? 0 : x1 - 1.6, roofY + 0.02, z1 - 1.6, 2]);
    } else {
      L.wallX(x0, x1, z0 + 0.1, roofY, roofY + ph, 0.2, m, [], tint);
    }
    L.wallX(x0, x1, z1 - 0.1, roofY, roofY + ph, 0.2, m, [], tint);
    L.wallZ(z0 + 0.2, z1 - 0.2, x0 + 0.1, roofY, roofY + ph, 0.2, m, [], tint);
    L.wallZ(z0 + 0.2, z1 - 0.2, x1 - 0.1, roofY, roofY + ph, 0.2, m, [], tint);
    if (o.tank !== false && rnd() < 0.65) {
      // 屋頂水塔：碰撞是整座的圓柱，外觀由前端的 Blender 模型（不鏽鋼筒＋鐵架）負責
      const cx = x1 - 1.3, cz = z1 - 1.3;
      L.cyls.push([cx, cz, 0.72, roofY, roofY + 2.4, MAT.tank]);
      L.deco.push({ t: 'roofTank', x: cx, z: cz, y: roofY });
    }
  }
  if (o.sign) L.deco.push({ t: 'sign', x: x0 + 0.6, z: z1 + 0.1, y: 0.15 + fh + 0.3, h: Math.min(fh * (floors - 1) + 0.6, 5.5), text: o.sign, c: o.signColor || 0 });
  // 店面橫招牌（市中心一樓）
  if (o.hsign) L.deco.push({ t: 'hsign', x: doorX, z: z1 + 0.14, y: 2.62, w: Math.min(w - 1, 5.5), text: o.hsign, c: o.signColor || 0 });
  // 外觀不再只是方塊：樓層間的線腳、女兒牆壓頂、轉角柱、地基腰帶、煙囪
  if (o.cornice) {
    for (let f = 1; f <= floors; f++) {
      const yy = 0.15 + f * fh - (f === floors ? 0 : 0.25), th = f === floors ? 0.32 : 0.16, pr = f === floors ? 0.16 : 0.07;
      L.dbox(x0 - pr, yy - th, z1, x1 + pr, yy, z1 + pr, DK.corn); L.dbox(x0 - pr, yy - th, z0 - pr, x1 + pr, yy, z0, DK.corn);
      L.dbox(x0 - pr, yy - th, z0, x0, yy, z1, DK.corn); L.dbox(x1, yy - th, z0, x1 + pr, yy, z1, DK.corn);
    }
    if (!o.gable) { L.dbox(x0 - 0.12, roofY + 0.8, z0 - 0.12, x1 + 0.12, roofY + 0.92, z0 + 0.32, DK.corn); L.dbox(x0 - 0.12, roofY + 0.8, z1 - 0.32, x1 + 0.12, roofY + 0.92, z1 + 0.12, DK.corn); L.dbox(x0 - 0.12, roofY + 0.8, z0, x0 + 0.32, roofY + 0.92, z1, DK.corn); L.dbox(x1 - 0.32, roofY + 0.8, z0, x1 + 0.12, roofY + 0.92, z1, DK.corn); }
  }
  if (o.trim !== false) {
    const tk = 0.1, top = roofY + (o.gable ? 0 : 0.8);
    for (const [cx2, cz2] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) L.dbox(cx2 - tk, 0.05, cz2 - tk, cx2 + tk, top, cz2 + tk, o.cornice ? DK.corn : DK.frame);
    L.dbox(x0 - 0.06, 0.05, z0 - 0.06, x1 + 0.06, 0.45, z0, DK.found); L.dbox(x0 - 0.06, 0.05, z1, x1 + 0.06, 0.45, z1 + 0.06, DK.found);
    L.dbox(x0 - 0.06, 0.05, z0, x0, 0.45, z1, DK.found); L.dbox(x1, 0.05, z0, x1 + 0.06, 0.45, z1, DK.found);
  }
  if (o.chimney) { const ccx = x0 + w * 0.22, ccz = z0 + d * 0.3; L.dbox(ccx - 0.4, roofY - 0.2, ccz - 0.35, ccx + 0.4, roofY + Math.min(2.6, d * 0.3) + 1.1, ccz + 0.35, DK.brick); L.dbox(ccx - 0.48, roofY + Math.min(2.6, d * 0.3) + 1.1, ccz - 0.43, ccx + 0.48, roofY + Math.min(2.6, d * 0.3) + 1.25, ccz + 0.43, DK.corn); }
  // 斜屋頂的簷溝與落水管
  if (o.gable) {
    const alongX = w >= d;
    if (alongX) for (const ez of [z0 - 0.42, z1 + 0.28]) { L.dbox(x0 - 0.3, roofY - 0.2, ez, x1 + 0.3, roofY - 0.04, ez + 0.14, DK.corn); for (const ex of [x0 + 0.12, x1 - 0.22]) L.dbox(ex, 0.15, ez < z0 ? z0 - 0.12 : z1 + 0.02, ex + 0.1, roofY - 0.1, ez < z0 ? z0 - 0.02 : z1 + 0.12, DK.corn); }
    else for (const ex of [x0 - 0.42, x1 + 0.28]) { L.dbox(ex, roofY - 0.2, z0 - 0.3, ex + 0.14, roofY - 0.04, z1 + 0.3, DK.corn); for (const ez of [z0 + 0.12, z1 - 0.22]) L.dbox(ex < x0 ? x0 - 0.12 : x1 + 0.02, 0.15, ez, ex < x0 ? x0 - 0.02 : x1 + 0.12, roofY - 0.1, ez + 0.1, DK.corn); }
  }
  // 公寓：門前兩階台階、側面的鐵製消防梯、屋頂木造水塔
  if (o.cornice && !o.arcade) {
    L.dbox(doorX - 0.95, -0.6, z1, doorX + 0.95, 0.15, z1 + 0.75, DK.found);
    L.dbox(doorX - 0.95, -0.6, z1 + 0.75, doorX + 0.95, -0.02, z1 + 1.15, DK.found);
  }
  if (o.cornice && !o.gable && floors >= 3 && dr() < 0.6) {
    const zc = (z0 + z1) / 2, hl = Math.min(2.2, d / 2 - 1.2), ox = x1, dep = 1.15;
    for (let f = 1; f < floors; f++) {
      const y = 0.15 + f * fh - 0.08;
      L.dbox(ox, y - 0.06, zc - hl, ox + dep, y, zc + hl, DK.dark);
      L.dbox(ox + dep - 0.05, y + 0.9, zc - hl, ox + dep, y + 0.96, zc + hl, DK.dark);
      L.dbox(ox + 0.02, y + 0.9, zc - hl - 0.05, ox + dep, y + 0.96, zc - hl, DK.dark);
      L.dbox(ox + 0.02, y + 0.9, zc + hl, ox + dep, y + 0.96, zc + hl + 0.05, DK.dark);
      for (let q = 0; q <= 8; q++) { const zz = zc - hl + (2 * hl) * q / 8; L.dbox(ox + dep - 0.04, y, zz - 0.02, ox + dep, y + 0.9, zz + 0.02, DK.dark); }
      // 往上一層的斜梯（踏板＋兩側梯樑）
      if (f < floors - 1) {
        const n = 9;
        for (let q = 0; q < n; q++) { const t = (q + 0.5) / n, zz = zc - hl * 0.8 + hl * 1.6 * t, yy = y + fh * t; L.dbox(ox + 0.2, yy - 0.03, zz - 0.1, ox + 0.75, yy, zz + 0.1, DK.dark); }
        for (const sx of [0.16, 0.75]) for (let q = 0; q < 6; q++) { const t0 = q / 6, t1 = (q + 1) / 6; L.dbox(ox + sx, y + fh * t0, zc - hl * 0.8 + hl * 1.6 * t0, ox + sx + 0.04, y + fh * t1, zc - hl * 0.8 + hl * 1.6 * t1, DK.dark); }
      }
    }
  }
  if (o.cornice && !o.gable && floors >= 4 && dr() < 0.45) {
    const cx = x0 + 2.2, cz = z0 + 2.2;
    L.cyls.push([cx, cz, 1.25, roofY, roofY + 6.4, MAT.tank]);
    L.deco.push({ t: 'wtower', x: cx, z: cz, y: roofY });
  }
  L.doors.push([doorX, z1 + 0.6, 0, 1]);
  if (hasBack) L.doors.push([backX, z0 - 0.6, 0, -1]);
  return roofY;
}

function warehouse(L, rnd, o) {
  const { w, d } = o, h = o.h || 7, t = 0.3, m = o.mat ?? MAT.metal;
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
  L.glaze = true;
  L.box(x0 - 0.2, -1.6, z0 - 0.2, x1 + 0.2, 0.15, z1 + 0.2, MAT.concrete);
  const dw = o.open ? w - 3 : Math.min(5, w * 0.35), dh = o.open ? h - 1.2 : Math.min(5, h - 1.5);
  const door = [[-dw / 2, dw / 2, 0, dh]];
  const hi = (a, b) => windowsAlong(a + 1, b - 1, 4, 2.2, h - 2.6, h - 1.2, [], 0, rnd);
  L.wallX(x0, x1, z1 - t / 2, 0.15, h, t, m, [...door, ...(o.open ? [] : hi(x0, -dw / 2 - 1)), ...(o.open ? [] : hi(dw / 2 + 1, x1))], o.tint || 0);
  L.wallX(x0, x1, z0 + t / 2, 0.15, h, t, m, o.backDoor === false ? hi(x0, x1) : [[x0 + 2, x0 + 3.4, 0, 2.3], ...hi(x0 + 4, x1)], o.tint || 0);
  for (const sx of [x0 + t / 2, x1 - t / 2]) L.wallZ(z0 + t, z1 - t, sx, 0.15, h, t, m, [[-0.7, 0.7, 0, 2.3], ...hi(z0, -1.5), ...hi(1.5, z1)], o.tint || 0);
  L.box(x0, h, z0, x1, h + 0.3, z1, o.roofMat ?? MAT.metal);
  if (o.gable !== false) {
    // 低斜屋頂：碰撞用三段平台近似
    const rise = Math.min(2.4, d * 0.12);
    L.box(x0, h + 0.3, z0 + d * 0.2, x1, h + 0.3 + rise * 0.45, z1 - d * 0.2, o.roofMat ?? MAT.metal);
    L.box(x0, h + 0.3 + rise * 0.45, z0 + d * 0.38, x1, h + 0.3 + rise * 0.85, z1 - d * 0.38, o.roofMat ?? MAT.metal);
    L.deco.push({ t: 'gable', x0: x0 - 0.3, z0: z0 - 0.4, x1: x1 + 0.3, z1: z1 + 0.4, y: h + 0.25, rise: rise * 1.12 + 0.1, ax: 'x', m, c: o.tint || 0, rmat: o.roofMat ?? MAT.metal, rm: 0 });
  }
  // 貨箱掩體
  const nC = Math.floor(w * d / 60);
  for (let k = 0; k < nC; k++) {
    const cx = x0 + 2 + rnd() * (w - 4), cz = z0 + 2 + rnd() * (d - 6);
    if (Math.abs(cx) < dw / 2 + 1 && cz > z1 - 5) continue;
    const s = 1.2, stack = 1 + Math.floor(rnd() * 2.2);
    L.box(cx - s, 0.15, cz - s / 2 - 0.1, cx + s, 0.15 + s * stack, cz + s / 2 + 0.1, MAT.crate);
    if (rnd() < 0.4) L.loot.push([cx, 0.15 + s * stack + 0.02, cz, 2]);
  }
  const nL = 2 + Math.floor(rnd() * 3);
  for (let k = 0; k < nL; k++) L.loot.push([x0 + 1.5 + rnd() * (w - 3), 0.17, z0 + 1.5 + rnd() * (d - 3), 1]);
  if (!o.open) furnish(L, mulberry32(Math.floor(rnd() * 1e9)), { x0: x0 + t + 0.05, x1: x1 - t - 0.05, z0: z0 + t + 1.6, z1: z1 - t - 0.05, y: 0.15, sets: ['rack', 'rack', 'rack', 'boxes', 'boxes'], avoid: [[-dw / 2 - 1, z1 - 4, dw / 2 + 1, z1 + 1], [x0 - 1, -1.5, x0 + 1.5, 1.5], [x1 - 1.5, -1.5, x1 + 1, 1.5]] });
  L.doors.push([0, z1 + 0.8, 0, 1]);
  L.doors.push([x0 + 2.7, z0 - 0.8, 0, -1]);
  return h;
}

// 辦公大樓：一樓是玻璃大廳可進入，上面是實心的帷幕牆量體，屋頂可空降
function tower(L, rnd, o) {
  const { w, d, h } = o, t = 0.3, lob = 4.6;
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
  L.box(x0 - 0.2, -1.6, z0 - 0.2, x1 + 0.2, 0.15, z1 + 0.2, MAT.concrete);
  L.box(x0 + t, 0.05, z0 + t, x1 - t, 0.17, z1 - t, MAT.tile);
  L.glaze = true;
  const bays = (a, b) => { const out = [], n = Math.floor((b - a) / 3.2); for (let k = 0; k < n; k++) { const c = a + (b - a) * (k + 0.5) / n; out.push([c - 1.3, c + 1.3, k === Math.floor(n / 2) ? 0 : 0.5, 3.8]); } return out; };
  L.wallX(x0, x1, z1 - t / 2, 0.15, lob, t, MAT.concrete, bays(x0 + 1, x1 - 1));
  L.wallX(x0, x1, z0 + t / 2, 0.15, lob, t, MAT.concrete, bays(x0 + 1, x1 - 1));
  L.wallZ(z0 + t, z1 - t, x0 + t / 2, 0.15, lob, t, MAT.concrete, bays(z0 + 1, z1 - 1));
  L.wallZ(z0 + t, z1 - t, x1 - t / 2, 0.15, lob, t, MAT.concrete, bays(z0 + 1, z1 - 1));
  L.glaze = false;
  L.box(-2.5, 0.17, -1.5, 2.5, 1.1, 1.5, MAT.wood);                 // 接待櫃台
  for (const [cx, cz] of [[x0 + 3, z0 + 3], [x1 - 3, z0 + 3], [x0 + 3, z1 - 3], [x1 - 3, z1 - 3]]) L.box(cx - 0.4, 0.17, cz - 0.4, cx + 0.4, lob, cz + 0.4, MAT.concrete);
  // 高樓在約 2/3 高度退縮一圈（退縮平台可空降），頂部有壓頂與機房，立面有垂直鋁鰭
  const sb = h > 34 ? 2.2 : 0, h1 = sb ? Math.round(h * 0.66) : h;
  const parapet = (a0, b0, a1, b1, y) => { L.wallX(a0, a1, b0 + 0.15, y, y + 1.1, 0.3, MAT.concrete); L.wallX(a0, a1, b1 - 0.15, y, y + 1.1, 0.3, MAT.concrete); L.wallZ(b0 + 0.3, b1 - 0.3, a0 + 0.15, y, y + 1.1, 0.3, MAT.concrete); L.wallZ(b0 + 0.3, b1 - 0.3, a1 - 0.15, y, y + 1.1, 0.3, MAT.concrete); };
  L.box(x0, lob, z0, x1, h1, z1, MAT.facade);
  L.box(x0 - 0.4, lob - 0.1, z0 - 0.4, x1 + 0.4, lob + 0.35, z1 + 0.4, MAT.concrete);
  const tx0 = x0 + sb, tz0 = z0 + sb, tx1 = x1 - sb, tz1 = z1 - sb;
  if (sb) { L.box(tx0, h1, tz0, tx1, h, tz1, MAT.facade); L.box(x0 - 0.2, h1 - 0.1, z0 - 0.2, x1 + 0.2, h1 + 0.25, z1 + 0.2, MAT.concrete); parapet(x0, z0, x1, z1, h1 + 0.25); L.loot.push([x0 + 1.1, h1 + 0.27, 0, 2]); }
  L.box(tx0 - 0.3, h - 0.1, tz0 - 0.3, tx1 + 0.3, h + 0.2, tz1 + 0.3, MAT.concrete);
  parapet(tx0, tz0, tx1, tz1, h);
  L.box(-2.2, h, -2.2, 2.2, h + 3.2, 2.2, MAT.concrete);              // 機房
  for (let k = 0; k < 4; k++) { const ax = tx0 + 2 + (k % 2) * (tx1 - tx0 - 4), az = tz0 + 2 + Math.floor(k / 2) * (tz1 - tz0 - 4); L.dbox(ax - 0.7, h, az - 0.5, ax + 0.7, h + 1.0, az + 0.5, DK.ac); }
  L.dbox(1.4, h + 3.2, 1.4, 1.5, h + 9, 1.5, DK.steel);               // 天線
  const fins = (a0, a1, b, nb, y0, y1) => { const n = Math.floor((a1 - a0) / 3.1); for (let k = 1; k < n; k++) { const a = a0 + (a1 - a0) * k / n; if (nb === 'z0' || nb === 'z1') L.dbox(a - 0.07, y0, nb === 'z0' ? b - 0.32 : b, a + 0.07, y1, nb === 'z0' ? b : b + 0.32, DK.steel); else L.dbox(nb === 'x0' ? b - 0.32 : b, y0, a - 0.07, nb === 'x0' ? b : b + 0.32, y1, a + 0.07, DK.steel); } };
  fins(x0, x1, z0, 'z0', lob + 0.35, h1 - 0.1); fins(x0, x1, z1, 'z1', lob + 0.35, h1 - 0.1); fins(z0, z1, x0, 'x0', lob + 0.35, h1 - 0.1); fins(z0, z1, x1, 'x1', lob + 0.35, h1 - 0.1);
  if (sb) { fins(tx0, tx1, tz0, 'z0', h1 + 0.25, h - 0.1); fins(tx0, tx1, tz1, 'z1', h1 + 0.25, h - 0.1); fins(tz0, tz1, tx0, 'x0', h1 + 0.25, h - 0.1); fins(tz0, tz1, tx1, 'x1', h1 + 0.25, h - 0.1); }
  L.loot.push([tx0 + 3, h + 0.22, 0, 3], [tx1 - 3, h + 0.22, 0, 2], [3, 0.19, 3, 1], [-3, 0.19, -3, 1]);
  L.doors.push([0, z1 + 0.8, 0, 1], [0, z0 - 0.8, 0, -1]);
}

// ---- 世界組裝 ----
export function buildMap() {
  const T = buildTerrain();
  const H = T.H;
  const rnd = mulberry32(19990127);
  const W = {
    H, roads: T.roads, runway: T.runway, towns: TOWNS,
    boxes: [], cyls: [], deco: [], loot: [], buildings: [], trees: [], rocks: [], pads: [], dboxes: [], boxBld: [], openings: [], grids: [],
  };
  const hAt = (x, z) => heightAt(H, x, z);
  const roadD = (x, z) => {
    let best = 1e9;
    for (const rd of W.roads) for (let k = 0; k < rd.pts.length - 1; k++) {
      const a = rd.pts[k], b = rd.pts[k + 1];
      if (Math.abs(x - a[0]) > 60 && Math.abs(x - b[0]) > 60) continue;
      if (Math.abs(z - a[2]) > 60 && Math.abs(z - b[2]) > 60) continue;
      const vx = b[0] - a[0], vz = b[2] - a[2], L2 = vx * vx + vz * vz;
      const t = clamp(((x - a[0]) * vx + (z - a[2]) * vz) / L2, 0, 1);
      const dx = x - a[0] - vx * t, dz = z - a[2] - vz * t;
      best = Math.min(best, Math.sqrt(dx * dx + dz * dz));
    }
    return best;
  };
  W.roadD = roadD;
  const occupied = []; // [x0,z0,x1,z1]
  const free = (x0, z0, x1, z1, pad = 1) => !occupied.some((r) => x1 + pad > r[0] && x0 - pad < r[2] && z1 + pad > r[1] && z0 - pad < r[3]);

  // 把局部建築放到世界；rot 0..3（0：正面朝 +z／南）
  function place(L, cx, cz, rot, base, meta = {}) {
    const tr = (x, z) => rot === 0 ? [cx + x, cz + z] : rot === 1 ? [cx + z, cz - x] : rot === 2 ? [cx - x, cz - z] : [cx - z, cz + x];
    let bx0 = 1e9, bz0 = 1e9, bx1 = -1e9, bz1 = -1e9, top = 0;
    const firstBox = W.boxes.length;
    for (const b of L.boxes) {
      const [ax, az] = tr(b[0], b[2]), [cx2, cz2] = tr(b[3], b[5]);
      const nb = [Math.min(ax, cx2), b[1] + base, Math.min(az, cz2), Math.max(ax, cx2), b[4] + base, Math.max(az, cz2), b[6], b[7]];
      W.boxes.push(nb);
      if (b[1] > -0.5) { bx0 = Math.min(bx0, nb[0]); bz0 = Math.min(bz0, nb[2]); bx1 = Math.max(bx1, nb[3]); bz1 = Math.max(bz1, nb[5]); top = Math.max(top, b[4]); }
    }
    for (const b of L.dboxes) {
      const [ax, az] = tr(b[0], b[2]), [cx2, cz2] = tr(b[3], b[5]);
      W.dboxes.push([Math.min(ax, cx2), b[1] + base, Math.min(az, cz2), Math.max(ax, cx2), b[4] + base, Math.max(az, cz2), b[6], b[7]]);
    }
    const bIdx = W.buildings.length;
    for (const o of L.open) {
      const [x, z] = tr(o[0], o[2]), [nx, nz] = tr(o[3], o[4]);
      W.openings.push([x, o[1] + base, z, nx - cx, nz - cz, o[5], o[6], o[7], bIdx, o[8]]);
    }
    for (const c of L.cyls) { const [x, z] = tr(c[0], c[1]); W.cyls.push([x, z, c[2], c[3] + base, c[4] + base, c[5]]); }
    for (const p of L.loot) { const [x, z] = tr(p[0], p[2]); W.loot.push([x, p[1] + base, z, p[3]]); }
    const doors = L.doors.map((dd) => { const [x, z] = tr(dd[0], dd[1]); const [nx, nz] = tr(dd[2], dd[3]); return [x, z, nx - cx, nz - cz]; });
    for (const dc of L.deco) {
      const o = { ...dc, rot };
      if ('x' in dc) { const [x, z] = tr(dc.x, dc.z); o.x = x; o.z = z; }
      if (dc.ax) o.ax = (dc.ax === 'x') === (rot % 2 === 0) ? 'x' : 'z';
      if (dc.yaw != null) o.yaw = dc.yaw + rot * Math.PI / 2;
      if ('x0' in dc) { const [a0, b0] = tr(dc.x0, dc.z0), [a1, b1] = tr(dc.x1, dc.z1); o.x0 = Math.min(a0, a1); o.z0 = Math.min(b0, b1); o.x1 = Math.max(a0, a1); o.z1 = Math.max(b0, b1); }
      o.y = (dc.y || 0) + base;
      W.deco.push(o);
    }
    if (bx0 < 1e9) {
      occupied.push([bx0, bz0, bx1, bz1]);
      W.buildings.push({ x0: bx0, z0: bz0, x1: bx1, z1: bz1, y: base, top: base + top, doors, ...meta });
      for (let i = firstBox; i < W.boxes.length; i++) W.boxBld[i] = W.buildings.length - 1;
    }
  }
  const baseUnder = (cx, cz, w, d) => {
    let mn = 1e9, mx = -1e9;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) { const h = hAt(cx + sx * w / 2, cz + sz * d / 2); mn = Math.min(mn, h); mx = Math.max(mx, h); }
    return { base: Math.round((mx + 0.02) * 100) / 100, flat: mx - mn };
  };
  const PLASTERS = [MAT.plaster, MAT.plaster, MAT.plasterWarm, MAT.plasterRose, MAT.plasterSage];
  function addHouse(cx, cz, rot, o, meta) {
    const L = new Local();
    const ww = rot % 2 ? o.d : o.w, dd = rot % 2 ? o.w : o.d;
    if (!freeR(cx - ww / 2, cz - dd / 2, cx + ww / 2, cz + dd / 2, o.pad ?? 0.5)) return false;
    const { base } = o.base != null ? { base: o.base } : baseUnder(cx, cz, ww, dd);
    house(L, rnd, { mat: rnd.pick(PLASTERS), ...o });
    place(L, cx, cz, rot, base, { kind: 'house', floors: o.floors, ...meta });
    return true;
  }
  function addWarehouse(cx, cz, rot, o, meta) {
    const L = new Local();
    const ww = rot % 2 ? o.d : o.w, dd = rot % 2 ? o.w : o.d;
    if (!freeR(cx - ww / 2, cz - dd / 2, cx + ww / 2, cz + dd / 2, 1)) return false;
    const { base } = o.base != null ? { base: o.base } : baseUnder(cx, cz, ww, dd);
    warehouse(L, rnd, o);
    place(L, cx, cz, rot, base, { kind: 'warehouse', floors: 1, ...meta });
    return true;
  }
  const addCyl = (x, z, r, h, m, base = null, extra) => {
    const b = base ?? Math.min(hAt(x - r, z), hAt(x + r, z), hAt(x, z - r), hAt(x, z + r), hAt(x, z));
    W.cyls.push([x, z, r, b - 1, b + h, m]);
    occupied.push([x - r, z - r, x + r, z + r]);
    if (extra) W.deco.push({ ...extra, x, z, y: b, r, h });
  };
  const addContainer = (x, z, along, base, stack, tint) => {
    for (let s = 0; s < stack; s++) {
      const hw = along ? 3.05 : 1.22, hd = along ? 1.22 : 3.05;
      W.boxes.push([x - hw, base + s * 2.6, z - hd, x + hw, base + (s + 1) * 2.6 - 0.02, z + hd, MAT.container, tint[(s * 7 + Math.floor(x)) % tint.length]]);
    }
    occupied.push([x - 3.1, z - 3.1, x + 3.1, z + 3.1]);
  };
  const addCar = (x, z, alongX, base) => {
    const tint = rnd.pick([0xb8482e, 0xd9cfb8, 0x3c4a3e, 0x9a8a68, 0x2e2a26, 0x6b7b80, 0xc79a3a]);
    const hw = alongX ? 2.1 : 0.9, hd = alongX ? 0.9 : 2.1;
    W.boxes.push([x - hw, base + 0.3, z - hd, x + hw, base + 1.05, z + hd, MAT.car, tint]);
    const cw = alongX ? 1.1 : 0.82, cd = alongX ? 0.82 : 1.1, off = 0.3;
    W.boxes.push([x - cw - (alongX ? off : 0), base + 1.05, z - cd - (alongX ? 0 : off), x + cw - (alongX ? off : 0), base + 1.6, z + cd - (alongX ? 0 : off), MAT.glass, tint]);
    W.deco.push({ t: 'wheels', x, z, y: base, along: alongX ? 1 : 0 });
    if (rnd() < 0.35) W.loot.push([x + (alongX ? 0 : 1.6), base + 0.02, z + (alongX ? 1.6 : 0), 0]);
  };
  const pave = (x0, z0, x1, z1, y, kind = 0) => W.pads.push([x0, z0, x1, z1, y, kind]);

  // 橋：沿道路每 2 公尺一塊隱形方塊當橋面（前端另畫橋面與欄杆）
  W.bridges = T.bridges;
  for (const b of T.bridges) {
    // 斜橋：軸對齊方塊的聯集會比橋面寬，依角度把方塊縮到聯集寬約等於橋寬
    const dx = b.bx - b.ax, dz = b.bz - b.az, L2 = Math.sqrt(dx * dx + dz * dz), n = Math.ceil(L2 / 2), hw = (b.w / 2) * L2 / (Math.abs(dx) + Math.abs(dz));
    for (let k = 0; k <= n; k++) {
      const px = b.ax + (b.bx - b.ax) * k / n, pz = b.az + (b.bz - b.az) * k / n;
      W.boxes.push([px - hw, b.y - 1.4, pz - hw, px + hw, b.y + 0.05, pz + hw, MAT.invis, 0]);
      occupied.push([px - hw - 2, pz - hw - 2, px + hw + 2, pz + hw + 2]);
    }
  }
  // 河道兩側不蓋房子
  const riverOK = (x0, z0, x1, z1) => {
    const hw = RIVER.w / 2 + 4;
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [(x0 + x1) / 2, (z0 + z1) / 2]]) if (T.riverDist(x, z) < hw) return false;
    return true;
  };
  const freeR = (x0, z0, x1, z1, pad = 1) => free(x0, z0, x1, z1, pad) && riverOK(x0 - pad, z0 - pad, x1 + pad, z1 + pad);
  // 街道：柏油路面＋兩側人行道（墊高 0.15，有路緣碰撞）
  const street = (x0, z0, x1, z1, y, alongX, side = 2.6) => {
    // 切成 6 公尺一段，靠近河道的段落跳過（過河只走真正的橋）
    const len = alongX ? x1 - x0 : z1 - z0, n = Math.ceil(len / 6);
    let run0 = -1;
    const flush = (k0, k1) => {
      const a = (alongX ? x0 : z0) + len * k0 / n, b = (alongX ? x0 : z0) + len * k1 / n;
      const [sx0, sz0, sx1, sz1] = alongX ? [a, z0, b, z1] : [x0, a, x1, b];
      pave(sx0, sz0, sx1, sz1, y, 0);
      if (alongX) for (const [c, e] of [[z0 - side, z0], [z1, z1 + side]]) { pave(a, c, b, e, y + 0.15, 2); W.boxes.push([a, y - 0.3, c, b, y + 0.15, e, MAT.invis, 0]); }
      else for (const [c, e] of [[x0 - side, x0], [x1, x1 + side]]) { pave(c, a, e, b, y + 0.15, 2); W.boxes.push([c, y - 0.3, a, e, y + 0.15, b, MAT.invis, 0]); }
    };
    for (let k = 0; k <= n; k++) {
      let ok = k < n;
      if (ok) { const a = (alongX ? x0 : z0) + len * k / n, b = (alongX ? x0 : z0) + len * (k + 1) / n; ok = alongX ? riverOK(a, z0 - side, b, z1 + side) : riverOK(x0 - side, a, x1 + side, b); }
      if (ok && run0 < 0) run0 = k;
      if (!ok && run0 >= 0) { flush(run0, k); run0 = -1; }
    }
  };
  const SIDING = [0xf4f2ec, 0xc9dbe6, 0xf0e2b8, 0xd3e0c9, 0xd8d8d4, 0xe8cfc8, 0xb7c7d6, 0xe9e4d4];
  // 美式住宅：木壁板、斜屋頂、門廊（kit）、煙囪
  const suburbHouse = (x, z, rot, y, meta, big = false) => addHouse(x, z, rot, {
    w: 8 + rnd.int(0, big ? 5 : 3), d: 7 + rnd.int(0, 2), floors: 1 + (rnd() < 0.55 ? 1 : 0), gable: true, chimney: rnd() < 0.6,
    mat: rnd() < 0.78 ? MAT.siding : MAT.brick, tint: rnd.pick(SIDING), roofTint: rnd.pick([0x9c9ca2, 0xb39a86, 0x8e9aa8, 0xaaa294, 0x7f7f86]), base: y, pad: 1.2, tank: false,
  }, meta);
  const brickBlock = (x, z, rot, y, meta, floors = 3 + rnd.int(0, 1), hsign = null) => addHouse(x, z, rot, {
    w: 14 + rnd.int(0, 4), d: 11 + rnd.int(0, 2), floors, mat: rnd() < 0.7 ? MAT.brick : MAT.plasterWarm, cornice: true, roofAccess: true, base: y, pad: 1, tank: false, hsign, signColor: rnd.int(0, 3),
  }, meta);
  const barn = (x, z, rot, y, meta) => {
    const L = new Local(), w = 16, d = 11, h = 5.4;
    const ww = rot % 2 ? d : w, dd = rot % 2 ? w : d;
    if (!freeR(x - ww / 2, z - dd / 2, x + ww / 2, z + dd / 2, 1.5)) return;
    warehouse(L, rnd, { w, d, h, mat: MAT.siding, tint: 0xb3412f, roofMat: MAT.metal, gable: false });
    const rise = d * 0.36;
    L.box(-w / 2, h + 0.3, -d * 0.28, w / 2, h + 0.3 + rise * 0.45, d * 0.28, MAT.invis);
    L.box(-w / 2, h + 0.3 + rise * 0.45, -d * 0.12, w / 2, h + 0.3 + rise * 0.85, d * 0.12, MAT.invis);
    L.deco.push({ t: 'gable', x0: -w / 2 - 0.3, z0: -d / 2 - 0.4, x1: w / 2 + 0.3, z1: d / 2 + 0.4, y: h + 0.2, rise, ax: 'x', m: MAT.siding, c: 0xb3412f, rmat: MAT.metal, rm: 0xb8babb });
    place(L, x, z, rot, y, { kind: 'warehouse', floors: 1, ...meta });
  };
  const silo = (x, z, y) => addCyl(x, z, 3, 15, MAT.metal, y, { t: 'tank', silo: 1 });
  const hay = (x, z) => { const y = hAt(x, z); W.cyls.push([x, z, 0.75, y - 0.2, y + 1.3, -3]); W.deco.push({ t: 'hay', x, z, y, a: rnd() * 3 }); };
  const fence = (x0, z0, x1, z1) => { // 白色木柵欄（只供繪製），每根柱子貼地
    const dx = x1 - x0, dz = z1 - z0, n = Math.max(1, Math.round(Math.sqrt(dx * dx + dz * dz) / 2.4));
    let px0 = x0, pz0 = z0, py0 = hAt(x0, z0);
    for (let k = 0; k <= n; k++) {
      const px = x0 + dx * k / n, pz = z0 + dz * k / n, py = hAt(px, pz);
      if (T.riverDist(px, pz) < RIVER.w / 2 + 2) { px0 = px; pz0 = pz; py0 = py; continue; }
      W.dboxes.push([px - 0.06, py - 0.1, pz - 0.06, px + 0.06, py + 1.05, pz + 0.06, DK.fence, 0]);
      if (k > 0) for (const ry of [0.38, 0.8]) { const yy = (py0 + py) / 2 + ry; W.dboxes.push([Math.min(px0, px) - 0.03, yy, Math.min(pz0, pz) - 0.03, Math.max(px0, px) + 0.03, yy + 0.08, Math.max(pz0, pz) + 0.03, DK.fence, 0]); }
      for (let q = 1; q < 6 && k > 0; q++) { const qx = px0 + (px - px0) * q / 6, qz = pz0 + (pz - pz0) * q / 6, qy = py0 + (py - py0) * q / 6; W.dboxes.push([qx - 0.04, qy, qz - 0.04, qx + 0.04, qy + 0.95, qz + 0.04, DK.fence, 0]); }
      px0 = px; pz0 = pz; py0 = py;
    }
  };
  // 城鎮裡的樹：不能種在建築、街道或河道上
  const plant = (x, z, kind, sc) => { if (free(x - 1, z - 1, x + 1, z + 1, 0.5) && T.riverDist(x, z) >= RIVER.w / 2 + 3) W.trees.push([x, 0, z, kind, sc]); };
  const SHOPS = ['咖啡館', '洗衣店', '藥局', '五金行', '披薩', '書店', '銀行', '理髮廳', '餐館', '花店', '雜貨店', '酒吧', '當鋪', '戲院'];

  for (const town of TOWNS) {
    const { x: cx, z: cz, y } = town;
    const meta = { town: town.id };
    if (town.kind === 'downtown') {
      // 橋城市中心：12 公尺街道的棋盤、玻璃帷幕高樓與紅磚中高樓
      const xs = [-110, -70, -30, 10, 50, 90, 130, 170, 210], zs = [-150, -105, -60, -15, 30, 75, 120];
      W.grids.push([cx + xs[0] - 9, cz + zs[0] - 9, cx + xs[xs.length - 1] + 9, cz + zs[zs.length - 1] + 9]);
      for (const zz of zs) street(cx + xs[0], cz + zz - 6, cx + xs[xs.length - 1], cz + zz + 6, y, true);
      for (const xx of xs) street(cx + xx - 6, cz + zs[0], cx + xx + 6, cz + zs[zs.length - 1], y, false);
      for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
        const bx = cx + (xs[i] + xs[i + 1]) / 2, bz = cz + (zs[j] + zs[j + 1]) / 2;
        const dc = Math.sqrt((bx - cx - 50) ** 2 + (bz - cz + 15) ** 2);
        const r = rnd();
        if (dc < 95 && r < 0.6) {
          const L = new Local(), th = 26 + Math.floor(rnd() * (dc < 50 ? 55 : 30)), tw2 = 17 + rnd.int(0, 5), td = 15 + rnd.int(0, 5);
          if (freeR(bx - tw2 / 2, bz - td / 2, bx + tw2 / 2, bz + td / 2, 1)) { tower(L, rnd, { w: tw2, d: td, h: th }); place(L, bx, bz, rnd.int(0, 1) * 2, y, { kind: 'tower', floors: 1, ...meta }); }
        } else if (r < 0.93) {
          // 一個街廓放兩棟中高樓，面向南北兩條街
          for (const side of [-1, 1]) brickBlock(bx + (rnd() - 0.5) * 6, bz + side * 9.5, side < 0 ? 2 : 0, y, meta, 3 + rnd.int(0, 3), rnd() < 0.7 ? rnd.pick(SHOPS) : null);
        } else if (riverOK(bx - 13, bz - 13, bx + 13, bz + 13)) {
          pave(bx - 13, bz - 13, bx + 13, bz + 13, y + 0.01, 1);
          for (let k = 0; k < 4; k++) plant(bx - 8 + (k % 2) * 16, bz - 8 + Math.floor(k / 2) * 16, 2, 1);
        }
      }
      for (let k = 0; k < 28; k++) { const zz = cz + rnd.pick(zs) + (rnd() < 0.5 ? -3.5 : 3.5), xx = cx + xs[0] + 10 + rnd() * (xs[xs.length - 1] - xs[0] - 20); if (riverOK(xx - 3, zz - 2, xx + 3, zz + 2) && free(xx - 2.2, zz - 1, xx + 2.2, zz + 1, 0.2)) addCar(xx, zz, true, y); }
    } else if (town.kind === 'suburb' || town.kind === 'suburb2') {
      // 郊區：棋盤街道、兩側住宅（院子、柵欄、行道樹），中心幾棟紅磚公寓
      const xs = [-130, -78, -26, 26, 78, 130], zs = [-120, -72, -24, 24, 72, 120];
      W.grids.push([cx - 140, cz - 130, cx + 140, cz + 130]);
      for (const zz of zs) street(cx - 140, cz + zz - 4.5, cx + 140, cz + zz + 4.5, y, true, 2);
      for (const xx of xs) street(cx + xx - 4.5, cz - 130, cx + xx + 4.5, cz + 130, y, false, 2);
      for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
        const x0 = cx + xs[i] + 7, x1 = cx + xs[i + 1] - 7, z0 = cz + zs[j] + 7, z1 = cz + zs[j + 1] - 7;
        const dcen = Math.sqrt(((x0 + x1) / 2 - cx) ** 2 + ((z0 + z1) / 2 - cz) ** 2);
        if (dcen > town.r + 10) continue;
        const central = dcen < 50 && town.kind === 'suburb';
        if (central && rnd() < 0.7) { brickBlock((x0 + x1) / 2, z0 + 8, 2, y, meta, 3, rnd() < 0.5 ? rnd.pick(SHOPS) : null); brickBlock((x0 + x1) / 2, z1 - 8, 0, y, meta, 2 + rnd.int(0, 1), rnd.pick(SHOPS)); continue; }
        // 上下兩排，各 2～3 戶
        const n = (x1 - x0) > 36 ? 3 : 2;
        for (let k = 0; k < n; k++) {
          const hx = x0 + (x1 - x0) * (k + 0.5) / n;
          if (suburbHouse(hx, z0 + 6, 2, y, meta)) { if (rnd() < 0.6) fence(hx - 7, z0 + 13, hx + 7, z0 + 13); }
          if (suburbHouse(hx, z1 - 6, 0, y, meta)) { if (rnd() < 0.6) fence(hx - 7, z1 - 13, hx + 7, z1 - 13); }
          if (rnd() < 0.5) plant(hx + 5, z0 - 1.5, 2, 0.8 + rnd() * 0.3);
          if (rnd() < 0.35 && riverOK(hx - 8, z1 + 2, hx - 3, z1 + 5)) addCar(hx - 5.5, z1 + 3.2, true, y);
        }
      }
    } else if (town.kind === 'ranch' || town.kind === 'farms') {
      // 牧場：紅穀倉、筒倉、農舍、草捆、柵欄
      const steads = town.kind === 'ranch' ? [[0, 0]] : [[-60, -50], [55, -30], [-20, 60]];
      for (const [ox, oz] of steads) {
        const fx = cx + ox, fz = cz + oz;
        barn(fx - 14, fz - 12, 0, y, meta);
        silo(fx + 6, fz - 22, y); if (rnd() < 0.7) silo(fx + 13, fz - 22, y);
        addHouse(fx + 18, fz + 14, 2, { w: 11, d: 9, floors: 2, gable: true, chimney: true, mat: MAT.siding, tint: rnd.pick([0xf4f2ec, 0xf0e2b8, 0xd8d8d4]), roofTint: 0x9c9ca2, pad: 2, tank: false }, meta);
        for (let k = 0; k < 10; k++) hay(fx - 30 + rnd() * 40, fz + 10 + rnd() * 30);
        fence(fx - 40, fz - 40, fx + 40, fz - 40); fence(fx - 40, fz - 40, fx - 40, fz + 40);
        if (town.kind === 'ranch') {
          addWarehouse(fx - 40, fz + 30, 1, { w: 14, d: 9, h: 4.5, mat: MAT.metal, tint: 0xc9c2b0 }, meta); barn(fx + 40, fz - 50, 1, y, meta);
          addWarehouse(fx + 52, fz + 20, 0, { w: 20, d: 10, h: 4.2, mat: MAT.siding, tint: 0x8c3a2a, roofMat: MAT.metal }, meta);
          for (let k = 0; k < 4; k++) addHouse(fx - 70 + k * 22, fz + 70, 2, { w: 9, d: 8, floors: 1, gable: true, chimney: true, mat: MAT.siding, tint: rnd.pick(SIDING), roofTint: 0xb39a86, pad: 2, tank: false }, meta);
          silo(fx + 66, fz - 10, y); silo(fx + 66, fz - 2, y);
        }
      }
    } else if (town.kind === 'pinecrest') {
      // 松嶺：松林裡的木屋
      for (let k = 0; k < 16; k++) {
        const a = rnd() * 6.283, r = 12 + rnd() * (town.r - 20), hx = cx + ccos(a) * r, hz = cz + csin(a) * r;
        addHouse(hx, hz, rnd.int(0, 3), { w: 7 + rnd.int(0, 3), d: 6 + rnd.int(0, 2), floors: 1 + (rnd() < 0.3 ? 1 : 0), gable: true, chimney: rnd() < 0.8, mat: MAT.siding, tint: rnd.pick([0x8a6a4e, 0x7c5f45, 0x9b7b5c, 0x6e5a48]), roofTint: 0x8a9086, pad: 4, tank: false }, meta);
      }
      for (let k = 0; k < 220; k++) { const x = cx - 180 + rnd() * 360, z = cz - 170 + rnd() * 340; plant(x, z, 4, 0.9 + rnd() * 0.7); }
    } else if (town.kind === 'fort') {
      // 鐵甲堡：四面高牆、兩座城門、角樓、碉堡、營舍
      const L = new Local(), w = 120, d = 96, h = 6, t = 1.4;
      L.box(-w / 2, -1.5, -d / 2, w / 2, 0.15, d / 2, MAT.concrete);
      L.wallX(-w / 2, w / 2, d / 2 - t / 2, 0.15, h, t, MAT.concrete, [[-5, 5, 0, 4.6]]);
      L.wallX(-w / 2, w / 2, -d / 2 + t / 2, 0.15, h, t, MAT.concrete, [[-5, 5, 0, 4.6]]);
      L.wallZ(-d / 2 + t, d / 2 - t, -w / 2 + t / 2, 0.15, h, t, MAT.concrete);
      L.wallZ(-d / 2 + t, d / 2 - t, w / 2 - t / 2, 0.15, h, t, MAT.concrete);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const tx = sx * (w / 2 - 3), tz = sz * (d / 2 - 3);
        L.box(tx - 3.2, 0.15, tz - 3.2, tx + 3.2, 9, tz + 3.2, MAT.concrete);
        L.wallX(tx - 3.6, tx + 3.6, tz - 3.5, 9, 10.2, 0.3, MAT.concrete); L.wallX(tx - 3.6, tx + 3.6, tz + 3.5, 9, 10.2, 0.3, MAT.concrete);
        L.wallZ(tz - 3.35, tz + 3.35, tx - 3.5, 9, 10.2, 0.3, MAT.concrete); L.wallZ(tz - 3.35, tz + 3.35, tx + 3.5, 9, 10.2, 0.3, MAT.concrete);
        L.loot.push([tx, 9.02, tz, 3]);
      }
      // 牆頂走道
      L.box(-w / 2 + t, h - 0.15, d / 2 - t - 1.4, w / 2 - t, h, d / 2 - t, MAT.concrete);
      L.box(-w / 2 + t, h - 0.15, -d / 2 + t, w / 2 - t, h, -d / 2 + t + 1.4, MAT.concrete);
      for (let k = 0; k < 5; k++) { const bx = -40 + k * 20, bz = -10 + (k % 2) * 24; L.box(bx - 3, 0.15, bz - 2, bx + 3, 1.6, bz + 2, MAT.concrete); L.loot.push([bx, 1.62, bz, 2]); }
      for (let k = 0; k < 8; k++) L.box(-30 + k * 8, 0.15, 36, -26 + k * 8, 1.1, 37.2, MAT.crate);
      addHouse(cx - 30, cz - 20, 0, { w: 22, d: 10, floors: 2, mat: MAT.concrete, cornice: true, roofAccess: true, tank: false }, meta);
      addHouse(cx + 32, cz - 18, 0, { w: 14, d: 12, floors: 3, mat: MAT.concrete, cornice: true, roofAccess: true, tank: false }, meta);
      for (let k = 0; k < 6; k++) addContainer(cx + 20 + (k % 3) * 9, cz + 20 + Math.floor(k / 3) * 8, false, y, 1 + (k % 2), [0x4f5a3a, 0x5c5440, 0x3d4436]);
      place(L, cx, cz, 0, y, { kind: 'warehouse', floors: 1, town: town.id });
      W.buildings[W.buildings.length - 1].doors = [[cx, cz + d / 2 + 2, 0, 1], [cx, cz - d / 2 - 2, 0, -1]];
    } else if (town.kind === 'mill') {
      // 舊磨坊：河邊石造磨坊＋水車，周圍木屋
      const mx = cx + 52, mz = cz - 20;
      addHouse(mx, mz, 3, { w: 12, d: 9, floors: 2, gable: true, chimney: true, mat: MAT.stone, roofTint: 0xb39a86, pad: 1, tank: false }, meta);
      W.deco.push({ t: 'wheel', x: mx - 6.4, z: mz, y: hAt(mx, mz) + 0.5 });
      for (let k = 0; k < 7; k++) { const a = rnd() * 6.283, r = 20 + rnd() * 45; suburbHouse(cx + ccos(a) * r - 20, cz + csin(a) * r, rnd.int(0, 3), null, meta); }
    } else if (town.kind === 'resort') {
      // 海灣度假村：白色旅館（陽台）、泳池、沙灘傘、平房
      for (let k = 0; k < 3; k++) addHouse(cx - 50 + k * 42, cz - 40, 0, { w: 28, d: 12, floors: 4, mat: MAT.plaster, cornice: true, roofAccess: true, base: y, tank: false }, { ...meta, resort: true });
      pave(cx - 30, cz - 18, cx + 30, cz + 8, y + 0.01, 2);
      pave(cx - 18, cz - 12, cx + 18, cz + 2, y + 0.03, 3);
      for (let k = 0; k < 6; k++) addHouse(cx - 70 + k * 28, cz + 34, 2, { w: 8, d: 7, floors: 1, gable: true, mat: MAT.siding, tint: rnd.pick([0xf4f2ec, 0xc9dbe6, 0xf0e2b8]), roofTint: 0xc09a7c, pad: 1, base: y, tank: false }, meta);
      for (let k = 0; k < 14; k++) W.deco.push({ t: 'umbrella', x: cx - 80 + rnd() * 160, z: cz + 60 + rnd() * 30, y: hAt(cx, cz + 70), c: rnd.int(0, 3) });
      for (let k = 0; k < 24; k++) plant(cx - 100 + rnd() * 200, cz - 70 + rnd() * 130, 0, 0.9 + rnd() * 0.4);
    } else if (town.kind === 'harbor') {
      pave(cx - 90, cz - 80, cx + 120, cz + 80, y, 2);
      const T2 = [0xa8452c, 0x3f6b6a, 0xc58a2c, 0x5a5f66, 0x7d3324, 0x2f4f5f, 0xd8cdb6];
      for (let k = 0; k < 4; k++) addWarehouse(cx - 55, cz - 60 + k * 38, 1, { w: 28, d: 17, h: 7.5, mat: MAT.metal, tint: rnd.pick([0xc9c2b0, 0xb5583a, 0x7e8b7f, 0xd2a65a]) }, meta);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 7; j++) { if (rnd() < 0.3) continue; addContainer(cx + 5 + i * 9, cz - 60 + j * 17, false, y, 1 + Math.floor(rnd() * 3), T2); }
      for (let k = 0; k < 3; k++) addHouse(cx - 20 + k * 22, cz + 70, 0, { w: 10, d: 8, floors: 2, mat: MAT.siding, tint: rnd.pick(SIDING), cornice: true, roofAccess: true, tank: false }, meta);
      const qz = cz + 100;
      for (let k = 0; k < 2; k++) {
        const px = cx - 40 + k * 80;
        W.boxes.push([px - 7, -10, qz, px + 7, y - 0.05, qz + 70, MAT.concrete, 0]);
        pave(px - 7, qz, px + 7, qz + 70, y - 0.05, 2);
        const kx = px, kz = qz + 20;
        for (const [lx, lz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) W.boxes.push([kx + lx - 0.6, y - 0.05, kz + lz - 0.6, kx + lx + 0.6, y + 24, kz + lz + 0.6, MAT.metal, 0xc0562e]);
        W.boxes.push([kx - 6, y + 24, kz - 6, kx + 6, y + 26, kz + 6, MAT.metal, 0xc0562e]);
        W.deco.push({ t: 'boom', x: kx, z: kz, y: y + 26, len: 40 });
        W.loot.push([kx, y + 26.02, kz, 3]);
      }
    } else if (town.kind === 'cape') {
      addCyl(cx + 30, cz + 8, 3.4, 27, MAT.stone, null, { t: 'lighthouse' });
      W.loot.push([cx + 30, hAt(cx + 30, cz + 8) + 27.02, cz + 8, 3]);
      addHouse(cx + 14, cz - 6, 1, { w: 9, d: 7, floors: 1, mat: MAT.siding, tint: 0xf4f2ec, gable: true, chimney: true, tank: false }, meta);
      for (let k = 0; k < 5; k++) suburbHouse(cx - 50 + 14 * k, cz - 40 + (k % 2) * 60, k % 2 ? 0 : 2, null, meta);
    } else if (town.kind === 'airfield') {
      const ry = y;
      for (let k = 0; k < 3; k++) addWarehouse(cx - 140 + k * 70, cz - 75, 0, { w: 34, d: 26, h: 11, open: true, mat: MAT.metal, tint: 0xbab2a0, backDoor: false }, { ...meta, hangar: true });
      addHouse(cx + 40, cz + 70, 2, { w: 30, d: 13, floors: 2, mat: MAT.concrete, cornice: true, roofAccess: true, tank: false }, meta);
      addHouse(cx + 90, cz + 66, 2, { w: 8, d: 8, floors: 4, mat: MAT.concrete, roofAccess: true, cab: true, tank: false }, meta);
      addCyl(cx - 140, cz + 70, 5, 6, MAT.tank, ry, { t: 'tank' });
      addCyl(cx - 125, cz + 70, 5, 6, MAT.tank, ry, { t: 'tank' });
      W.deco.push({ t: 'plane', x: cx - 40, z: cz - 30, y: ry });
      W.boxes.push([cx - 44, ry, cz - 31.5, cx - 36, ry + 3.4, cz - 28.5, MAT.metal, 0xd8d0bc]);
      for (let k = 0; k < 6; k++) W.loot.push([cx - 160 + rnd() * 300, ry + 0.02, cz - 40 + rnd() * 20, 0]);
    } else if (town.kind === 'foundry') {
      pave(cx - 80, cz - 70, cx + 80, cz + 70, y, 2);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) addCyl(cx - 40 + i * 32, cz - 30 + j * 34, 10, 13 + (i + j) % 2 * 3, MAT.tank, y, { t: 'tank', ladder: true });
      for (let k = 0; k < 5; k++) { const z = cz - 46 + k * 22; W.boxes.push([cx - 70, y + 1.2, z - 0.4, cx + 30, y + 2.0, z + 0.4, MAT.metal, 0x8a8a7e]); }
      for (let k = 0; k < 3; k++) addCyl(cx + 50 + k * 9, cz - 52, 1.6, 30 + k * 4, MAT.brick, y, { t: 'chimney' });
      addHouse(cx + 55, cz + 20, 3, { w: 14, d: 10, floors: 3, mat: MAT.brick, cornice: true, roofAccess: true, tank: false }, meta);
      addWarehouse(cx + 50, cz + 55, 0, { w: 22, d: 14, h: 7, mat: MAT.metal, tint: 0xc0562e }, meta);
      addWarehouse(cx - 55, cz + 52, 0, { w: 26, d: 16, h: 8, mat: MAT.brick }, meta);
    }
  }
  // 路邊散落的農舍
  let farms = 0;
  for (let tries = 0; tries < 400 && farms < 22; tries++) {
    const rd = rnd.pick(W.roads), p = rnd.pick(rd.pts);
    const side = rnd() < 0.5 ? -1 : 1;
    const x = p[0] + side * (14 + rnd() * 10), z = p[2] + (rnd() - 0.5) * 20;
    if (TOWNS.some((t) => Math.sqrt((t.x - x) ** 2 + (t.z - z) ** 2) < t.r + 50)) continue;
    const { base, flat } = baseUnder(x, z, 12, 10);
    if (flat > 2.5 || base < 2) continue;
    if (riverOK(x - 8, z - 8, x + 8, z + 8) && addHouse(x, z, side < 0 ? 1 : 3, { w: 8 + rnd.int(0, 3), d: 7 + rnd.int(0, 2), floors: 1 + (rnd() < 0.4 ? 1 : 0), roofAccess: false, gable: true, chimney: rnd() < 0.6, pad: 4, base, mat: MAT.siding, tint: rnd.pick(SIDING), roofTint: 0x9c9ca2, tank: false }, { town: null })) farms++;
  }
  // 樹與岩石
  const treeRnd = mulberry32(4401);
  for (let k = 0; k < 9000 && W.trees.length < 2300; k++) {
    const x = (treeRnd() - 0.5) * 2 * 1000, z = (treeRnd() - 0.5) * 2 * 1000;
    const d = Math.sqrt(x * x + z * z), cr = coastAt(x, z);
    if (d > cr - 70) continue;
    const h = hAt(x, z);
    if (h < 2.5) continue;
    if (TOWNS.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < (t.r + 10) ** 2) && treeRnd() < 0.92) continue;
    if (roadD(x, z) < 9) continue;
    if (!free(x - 1, z - 1, x + 1, z + 1, 1)) continue;
    if (T.riverDist(x, z) < RIVER.w / 2 + 3) continue;
    const kind = h > 55 ? 4 : h < 9 ? 0 : treeRnd() < 0.5 ? 2 : treeRnd() < 0.6 ? 4 : 3;
    W.trees.push([x, 0, z, kind, 0.75 + treeRnd() * 0.6]);
  }
  for (let k = 0; k < 2000 && W.rocks.length < 320; k++) {
    const x = (treeRnd() - 0.5) * 2000, z = (treeRnd() - 0.5) * 2000;
    const d = Math.sqrt(x * x + z * z), cr = coastAt(x, z);
    if (d > cr - 20 || roadD(x, z) < 8) continue;
    if (TOWNS.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < (t.r + 20) ** 2)) continue;
    W.rocks.push([x, 0, z, 0.8 + treeRnd() * (hAt(x, z) > 50 ? 3 : 1.8)]);
  }
  for (const t of W.trees) {
    t[1] = hAt(t[0], t[2]);
    if (t[3] !== 3) W.cyls.push([t[0], t[2], 0.3 * t[4], t[1] - 0.5, t[1] + 3 * t[4], -1]);
  }
  for (const r of W.rocks) { r[1] = hAt(r[0], r[2]); W.cyls.push([r[0], r[2], r[3] * 0.9, r[1] - 1, r[1] + r[3] * 0.9, -2]); }
  // 戶外戰利品：路邊與城鎮空地
  const lootRnd = mulberry32(777);
  for (const town of TOWNS) {
    for (let k = 0; k < 18; k++) {
      const a = lootRnd() * 6.283, r = lootRnd() * town.r;
      const x = town.x + ccos(a) * r, z = town.z + csin(a) * r;
      if (!free(x - 0.5, z - 0.5, x + 0.5, z + 0.5, 0.6)) continue;
      W.loot.push([x, hAt(x, z) + 0.02, z, 0]);
    }
  }
  for (const pad of W.pads) void pad;
  finalize(W);
  return W;
}

// ---- 碰撞網格 ----
export const GRID = 8;
const GN = Math.ceil((EXT * 2) / GRID);
function finalize(W) {
  const nb = W.boxes.length;
  W.B = new Float32Array(nb * 6);
  W.BM = new Uint8Array(nb);
  W.BT = new Uint32Array(nb);
  W.boxes.forEach((b, i) => { for (let k = 0; k < 6; k++) W.B[i * 6 + k] = b[k]; W.BM[i] = b[6]; W.BT[i] = b[7] || 0; });
  const nc = W.cyls.length;
  W.C = new Float32Array(nc * 5);
  W.cyls.forEach((c, i) => { for (let k = 0; k < 5; k++) W.C[i * 5 + k] = c[k]; });
  const cells = new Map();
  const add = (key, v) => { let a = cells.get(key); if (!a) cells.set(key, (a = [])); a.push(v); };
  const ci = (x) => clamp(Math.floor((x + EXT) / GRID), 0, GN - 1);
  for (let i = 0; i < nb; i++) {
    const B = W.B;
    for (let gx = ci(B[i * 6]); gx <= ci(B[i * 6 + 3]); gx++) for (let gz = ci(B[i * 6 + 2]); gz <= ci(B[i * 6 + 5]); gz++) add(gz * GN + gx, i);
  }
  for (let i = 0; i < nc; i++) {
    const C = W.C, x = C[i * 5], z = C[i * 5 + 1], r = C[i * 5 + 2];
    for (let gx = ci(x - r); gx <= ci(x + r); gx++) for (let gz = ci(z - r); gz <= ci(z + r); gz++) add(gz * GN + gx, -1 - i);
  }
  W.cells = cells;
  W.GN = GN;
  W.stamp = new Uint32Array(nb + nc);
  W.stampN = 1;
}

let cached = null;
export function getMap() { return cached || (cached = buildMap()); }
export { heightAt, EXT, CELL, N };
