// 鹽岬島地圖：地形、命名城鎮、可進入的建築（牆、門、窗、樓梯、樓板）、樹、車與戰利品點。
// 所有碰撞體都是軸對齊方塊或直立圓柱；畫面直接用同一批方塊建模，兩者永遠對齊。
import { mulberry32, clamp, csin, ccos } from './rng.js';
import { buildTerrain, heightAt, TOWNS, EXT, CELL, N, coastAt } from './terrain.js';

export const MAT = {
  plaster: 0, plasterWarm: 1, plasterRose: 2, plasterSage: 3, concrete: 4, brick: 5, wood: 6, tile: 7,
  roof: 8, metal: 9, rust: 10, container: 11, stone: 12, trim: 13, salt: 14, car: 15, tank: 16, crate: 17, temple: 18, glass: 19, facade: 20,
};
export const MAT_COUNT = 21;
// 只供繪製的細節方塊種類（不進碰撞）
export const DK = { frame: 0, glass: 1, base: 2, wains: 3, lamp: 4, rad: 5, ac: 6, dark: 7, steel: 8, poster: 9 };

const WALL_T = 0.25;
const STEP_N = 13, STEP_RUN = 0.3;

// ---- 局部座標的建築收集器，完成後旋轉 90° 的倍數放到世界 ----
class Local {
  constructor() { this.boxes = []; this.cyls = []; this.loot = []; this.doors = []; this.deco = []; this.dboxes = []; this.glaze = false; }
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
    L.wallX(x0, x1, fwz, isG ? 0.05 : y - 0.25, yTop - (f === floors - 1 ? 0 : 0.25), t, m, fo.map((p) => [p[0], p[1], p[2] + (isG ? 0.1 : 0.25), p[3] + (isG ? 0.1 : 0.25)]), tint);
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
      L.wallZ(z0 + t, sideZ1, sx, isG ? 0.05 : y - 0.25, yTop - (f === floors - 1 ? 0 : 0.25), t, m, so.map((p) => [p[0], p[1], p[2] + (isG ? 0.1 : 0.25), p[3] + (isG ? 0.1 : 0.25)]), tint);
      sides.push([sx, so]);
    }
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
    // 室內家具：靠側牆或前牆內側，避開門、樓梯與隔間門
    const nF = w * d > 60 ? 2 : 1;
    for (let k = 0; k < nF; k++) {
      const kind = rnd();
      const fw = kind < 0.4 ? 1.6 : kind < 0.7 ? 0.9 : 1.0, fd = kind < 0.4 ? 0.8 : kind < 0.7 ? 0.45 : 2.0, fhh = kind < 0.4 ? 0.78 : kind < 0.7 ? 1.9 : 0.5;
      const side = rnd() < 0.5 ? -1 : 1;
      const fx = side < 0 ? ix0 + 0.05 + fw / 2 + (stairs ? 0 : 0) : ix1 - 0.05 - fw / 2;
      const fz = zS + 0.4 + fd / 2 + rnd() * Math.max(0, (iz1 - (isG ? A : 0)) - zS - fd - 1.2);
      if (fx - fw / 2 < sx0 + runL + 1.0 && fz - fd / 2 < zS + 0.3) continue;
      if (Math.abs(fx - doorX) < doorW / 2 + fw / 2 + 0.6 && fz + fd / 2 > (isG ? iz1 - A : iz1) - 1.4) continue;
      if (partition && Math.abs(fx - xp) < fw / 2 + 0.9) continue;
      L.box(fx - fw / 2, y, fz - fd / 2, fx + fw / 2, y + fhh, fz + fd / 2, kind < 0.7 ? MAT.wood : MAT.plaster);
      if (kind < 0.4 && rnd() < 0.5) L.loot.push([fx, y + fhh + 0.02, fz, 1]);
    }
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
    L.deco.push({ t: 'gable', x0: x0 - (alongX ? 0.35 : 0.45), z0: z0 - (alongX ? 0.45 : 0.35), x1: x1 + (alongX ? 0.35 : 0.45), z1: z1 + (alongX ? 0.45 : 0.35), y: roofY - 0.05, rise: rise + 0.1, ax: alongX ? 'x' : 'z', m });
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
      const cx = x1 - 1.3, cz = z1 - 1.3;
      L.box(cx - 0.7, roofY, cz - 0.7, cx + 0.7, roofY + 0.9, cz + 0.7, MAT.trim);
      L.cyls.push([cx, cz, 0.75, roofY + 0.9, roofY + 2.5, MAT.tank]);
    }
  }
  if (o.sign) L.deco.push({ t: 'sign', x: x0 + 0.6, z: z1 + 0.1, y: 0.15 + fh + 0.3, h: Math.min(fh * (floors - 1) + 0.6, 5.5), text: o.sign, c: o.signColor || 0 });
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
  L.box(x0, h, z0, x1, h + 0.3, z1, o.roofMat ?? MAT.rust);
  if (o.gable !== false) {
    // 低斜屋頂：碰撞用三段平台近似
    const rise = Math.min(2.4, d * 0.12);
    L.box(x0, h + 0.3, z0 + d * 0.2, x1, h + 0.3 + rise * 0.45, z1 - d * 0.2, o.roofMat ?? MAT.rust);
    L.box(x0, h + 0.3 + rise * 0.45, z0 + d * 0.38, x1, h + 0.3 + rise * 0.85, z1 - d * 0.38, o.roofMat ?? MAT.rust);
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
  L.box(x0, lob, z0, x1, h, z1, MAT.facade);
  L.box(x0 - 0.4, lob - 0.1, z0 - 0.4, x1 + 0.4, lob + 0.35, z1 + 0.4, MAT.concrete);
  L.wallX(x0, x1, z0 + 0.15, h, h + 1.1, 0.3, MAT.concrete); L.wallX(x0, x1, z1 - 0.15, h, h + 1.1, 0.3, MAT.concrete);
  L.wallZ(z0 + 0.3, z1 - 0.3, x0 + 0.15, h, h + 1.1, 0.3, MAT.concrete); L.wallZ(z0 + 0.3, z1 - 0.3, x1 - 0.15, h, h + 1.1, 0.3, MAT.concrete);
  L.box(-2.2, h, -2.2, 2.2, h + 3.2, 2.2, MAT.concrete);              // 機房
  for (let k = 0; k < 4; k++) { const ax = x0 + 2 + (k % 2) * (w - 4), az = z0 + 2 + Math.floor(k / 2) * (d - 4); L.dbox(ax - 0.7, h, az - 0.5, ax + 0.7, h + 1.0, az + 0.5, DK.ac); }
  L.loot.push([x0 + 4, h + 0.02, 0, 3], [x1 - 4, h + 0.02, 0, 2], [3, 0.19, 3, 1], [-3, 0.19, -3, 1]);
  L.doors.push([0, z1 + 0.8, 0, 1], [0, z0 - 0.8, 0, -1]);
}

function temple(L, rnd) {
  // 廟：紅柱、石階、燕尾脊屋頂（屋頂由前端繪製）
  const w = 15, d = 12, h = 5.2;
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
  L.box(x0 - 1.5, -1.6, z0 - 1.5, x1 + 1.5, 0.45, z1 + 2.5, MAT.stone);
  L.box(x0 - 1.5, 0.45, z1 + 1.2, x1 + 1.5, 0.45, z1 + 2.5, MAT.stone);
  L.box(-3, 0.05, z1 + 2.5, 3, 0.25, z1 + 3.4, MAT.stone);
  L.box(x0 + 0.3, 0.45, z0 + 0.3, x1 - 0.3, 0.55, z1 - 2.2, MAT.tile);
  const t = 0.35;
  L.wallX(x0 + 0.3, x1 - 0.3, z1 - 2.2, 0.55, h, t, MAT.temple, [[-1.5, 1.5, 0, 3.2], [-5.4, -3.6, 1.0, 2.6], [3.6, 5.4, 1.0, 2.6]]);
  L.wallX(x0 + 0.3, x1 - 0.3, z0 + 0.3 + t / 2, 0.55, h, t, MAT.temple, []);
  L.wallZ(z0 + 0.3 + t, z1 - 2.2 - t / 2, x0 + 0.3 + t / 2, 0.55, h, t, MAT.temple, [[-1.4, -0.2, 0, 2.4]]);
  L.wallZ(z0 + 0.3 + t, z1 - 2.2 - t / 2, x1 - 0.3 - t / 2, 0.55, h, t, MAT.temple, [[-1.4, -0.2, 0, 2.4]]);
  for (let k = 0; k < 6; k++) { const cx = x0 + 0.8 + (w - 1.6) * (k / 5); L.cyls.push([cx, z1 - 0.6, 0.28, 0.45, h, MAT.temple]); }
  L.box(x0 - 0.6, h, z0 - 0.6, x1 + 0.6, h + 0.5, z1 + 0.6, MAT.roof);
  L.box(-2.6, 0.55, z0 + 1.2, 2.6, 1.6, z0 + 2.4, MAT.wood);
  L.deco.push({ t: 'templeRoof', x0: x0 - 0.9, x1: x1 + 0.9, z0: z0 - 0.9, z1: z1 + 0.9, y: h + 0.5 });
  L.deco.push({ t: 'censer', x: 0, z: z1 + 4.5, y: 0.25 });
  L.loot.push([0, 1.62, z0 + 1.8, 3], [-4, 0.57, z0 + 3, 1], [4, 0.57, z0 + 3, 1]);
  L.doors.push([0, z1 + 4, 0, 1]);
}

// ---- 世界組裝 ----
export function buildMap() {
  const T = buildTerrain();
  const H = T.H;
  const rnd = mulberry32(19990127);
  const W = {
    H, roads: T.roads, runway: T.runway, towns: TOWNS,
    boxes: [], cyls: [], deco: [], loot: [], buildings: [], trees: [], rocks: [], pads: [], dboxes: [], boxBld: [],
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
    for (const c of L.cyls) { const [x, z] = tr(c[0], c[1]); W.cyls.push([x, z, c[2], c[3] + base, c[4] + base, c[5]]); }
    for (const p of L.loot) { const [x, z] = tr(p[0], p[2]); W.loot.push([x, p[1] + base, z, p[3]]); }
    const doors = L.doors.map((dd) => { const [x, z] = tr(dd[0], dd[1]); const [nx, nz] = tr(dd[2], dd[3]); return [x, z, nx - cx, nz - cz]; });
    for (const dc of L.deco) {
      const o = { ...dc, rot };
      if ('x' in dc) { const [x, z] = tr(dc.x, dc.z); o.x = x; o.z = z; }
      if (dc.ax) o.ax = (dc.ax === 'x') === (rot % 2 === 0) ? 'x' : 'z';
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
    if (!free(cx - ww / 2, cz - dd / 2, cx + ww / 2, cz + dd / 2, o.pad ?? 0.5)) return false;
    const { base } = o.base != null ? { base: o.base } : baseUnder(cx, cz, ww, dd);
    house(L, rnd, { mat: rnd.pick(PLASTERS), ...o });
    place(L, cx, cz, rot, base, { kind: 'house', floors: o.floors, ...meta });
    return true;
  }
  function addWarehouse(cx, cz, rot, o, meta) {
    const L = new Local();
    const ww = rot % 2 ? o.d : o.w, dd = rot % 2 ? o.w : o.d;
    if (!free(cx - ww / 2, cz - dd / 2, cx + ww / 2, cz + dd / 2, 1)) return false;
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

  for (const town of TOWNS) {
    const { x: cx, z: cz, y } = town;
    const meta = { town: town.id };
    if (town.kind === 'oldstreet') {
      const zA = cz - 26, zB = cz + 26, half = 5;
      pave(cx - 112, zA - half, cx + 112, zA + half, y, 0);
      pave(cx - 112, zB - half, cx + 112, zB + half, y, 0);
      const crossX = [-88, -44, 0, 44, 88].map((k) => cx + k);
      for (const xx of crossX) pave(xx - 4, cz - 70, xx + 4, cz + 70, y, 0);
      const rows = [
        { z: zA - half, face: 0, sign: -1 }, { z: zA + half, face: 2, sign: 1 },
        { z: zB - half, face: 0, sign: -1 }, { z: zB + half, face: 2, sign: 1 },
      ];
      const SIGNS = ['金義興', '鹽記', '春來', '老順發', '岬角冰', '萬昌', '福隆', '永豐', '海產', '茶行', '布莊', '藥房', '新美', '三和', '旅社', '米店', '鐘錶', '五金', '麵店', '照相'];
      for (const row of rows) {
        for (let b = 0; b < crossX.length - 1; b++) {
          let x = crossX[b] + 4.2;
          const xEnd = crossX[b + 1] - 4.2;
          const isPlaza = b === 1 && row.sign === 1 && row.z === zA + half || b === 1 && row.z === zB - half;
          if (isPlaza) continue;
          while (x < xEnd - 4.5) {
            const w = Math.min(xEnd - x, 5 + Math.floor(rnd() * 3));
            if (w < 4.5) break;
            const d = 11 + Math.floor(rnd() * 3), floors = 2 + (rnd() < 0.45 ? 1 : 0);
            const czH = row.sign < 0 ? row.z - d / 2 : row.z + d / 2;
            addHouse(x + w / 2, czH, row.face, {
              w, d, floors, arcade: true, mat: rnd.pick([MAT.plaster, MAT.plasterWarm, MAT.brick, MAT.plasterRose, MAT.plasterSage, MAT.brick]),
              party: ['w', 'e'], doorX: 0, roofAccess: rnd() < 0.35 && w >= 7, base: y, pad: -0.05,
              sign: rnd() < 0.7 ? rnd.pick(SIGNS) : null, signColor: rnd.int(0, 3), tank: rnd() < 0.7,
            }, meta);
            x += w;
          }
        }
      }
      // 中央廟埕
      const L = new Local(); temple(L, rnd); place(L, cx - 22, cz - 2, 0, y, { kind: 'temple', floors: 1, town: town.id });
      pave(cx - 40, zA + half, cx - 4, zB - half, y + 0.01, 1);
      for (const [px, pz] of [[cx - 36, cz - 14], [cx - 8, cz - 14], [cx - 36, cz + 14], [cx - 8, cz + 14]]) W.trees.push([px, y, pz, 2, 1.1]);
      for (let k = 0; k < 8; k++) addCar(cx - 100 + rnd() * 200, rnd() < 0.5 ? zA + (rnd() < 0.5 ? -2.4 : 2.4) : zB + (rnd() < 0.5 ? -2.4 : 2.4), true, y);
    } else if (town.kind === 'harbor') {
      pave(cx - 90, cz - 80, cx + 120, cz + 80, y, 2);
      const T2 = [0xa8452c, 0x3f6b6a, 0xc58a2c, 0x5a5f66, 0x7d3324, 0x2f4f5f, 0xd8cdb6];
      for (let k = 0; k < 4; k++) addWarehouse(cx - 55, cz - 60 + k * 38, 1, { w: 28, d: 17, h: 7.5, mat: MAT.metal, tint: rnd.pick([0xc9c2b0, 0xb5583a, 0x7e8b7f, 0xd2a65a]) }, meta);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 7; j++) {
        if (rnd() < 0.3) continue;
        addContainer(cx + 5 + i * 9, cz - 60 + j * 17, false, y, 1 + Math.floor(rnd() * 3), T2);
      }
      for (let k = 0; k < 3; k++) addHouse(cx - 20 + k * 22, cz + 70, 0, { w: 10, d: 8, floors: 2, mat: MAT.concrete, roofAccess: true }, meta);
      // 碼頭與起重機
      const qx = cx + 100;
      for (let k = 0; k < 2; k++) {
        const pz = cz - 40 + k * 70;
        W.boxes.push([qx, -10, pz - 7, qx + 70, y - 0.05, pz + 7, MAT.concrete, 0]);
        pave(qx, pz - 7, qx + 70, pz + 7, y - 0.05, 2);
        const kx = qx + 20, kz = pz;
        for (const [lx, lz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) W.boxes.push([kx + lx - 0.6, y - 0.05, kz + lz - 0.6, kx + lx + 0.6, y + 24, kz + lz + 0.6, MAT.metal, 0xc0562e]);
        W.boxes.push([kx - 6, y + 24, kz - 6, kx + 6, y + 26, kz + 6, MAT.metal, 0xc0562e]);
        W.deco.push({ t: 'boom', x: kx, z: kz, y: y + 26, len: 40 });
        W.loot.push([kx, y + 26.02, kz, 3]);
      }
    } else if (town.kind === 'cape') {
      addCyl(cx + 8, cz + 34, 3.4, 27, MAT.stone, null, { t: 'lighthouse' });
      W.loot.push([cx + 8, hAt(cx + 8, cz + 34) + 27.02, cz + 34, 3]);
      addHouse(cx - 6, cz + 18, 0, { w: 9, d: 7, floors: 1, mat: MAT.plaster, gable: true }, meta);
      for (let k = 0; k < 5; k++) { const a = k * 1.3; addHouse(cx - 40 + 70 * (k / 4), cz - 30 + 14 * csin(a), k % 2 ? 0 : 2, { w: 8 + rnd.int(0, 3), d: 7 + rnd.int(0, 2), floors: 1 + (rnd() < 0.5 ? 1 : 0), roofAccess: false, gable: true }, meta); }
    } else if (town.kind === 'pans') {
      // 鹽田：整片淺池格與堤
      for (let i = 0; i < 7; i++) for (let j = 0; j < 9; j++) {
        const px = cx - 150 + i * 21, pz = cz - 100 + j * 17;
        W.deco.push({ t: 'pan', x0: px, z0: pz, x1: px + 19, z1: pz + 15, y: y + 0.02, s: rnd() });
        occupied.push([px, pz, px + 19, pz + 15]);
      }
      for (let k = 0; k < 9; k++) { const x = cx - 150 + rnd() * 140, z = cz - 100 + rnd() * 150; addCyl(x, z, 2.6, 2.2, MAT.salt, y, { t: 'mound' }); }
      addWarehouse(cx + 40, cz - 40, 3, { w: 26, d: 15, h: 6.5, mat: MAT.plaster, roofMat: MAT.roof }, meta);
      for (let k = 0; k < 4; k++) addWarehouse(cx + 30 + (k % 2) * 30, cz + 10 + Math.floor(k / 2) * 30, k % 2 ? 1 : 3, { w: 12, d: 8, h: 4.2, mat: MAT.plasterWarm, roofMat: MAT.roof, gable: false }, meta);
      addHouse(cx + 70, cz - 70, 3, { w: 11, d: 9, floors: 2, mat: MAT.plaster, roofAccess: true }, meta);
      addHouse(cx + 75, cz + 70, 3, { w: 9, d: 8, floors: 1 }, meta);
    } else if (town.kind === 'kiln') {
      for (let k = 0; k < 4; k++) addCyl(cx - 45 + k * 26, cz - 30, 6.2, 11 + k % 2 * 2, MAT.stone, null, { t: 'kiln' });
      addCyl(cx + 62, cz - 32, 1.4, 26, MAT.brick, null, { t: 'chimney' });
      addWarehouse(cx + 30, cz + 20, 0, { w: 22, d: 14, h: 6, mat: MAT.concrete }, meta);
      for (let k = 0; k < 6; k++) addHouse(cx - 60 + (k % 3) * 22, cz + 18 + Math.floor(k / 3) * 22, k % 2 ? 0 : 2, { w: 8 + rnd.int(0, 2), d: 7 + rnd.int(0, 2), floors: 1 + (rnd() < 0.5 ? 1 : 0), roofAccess: false, gable: true }, meta);
      addHouse(cx + 70, cz + 50, 1, { w: 12, d: 9, floors: 2, mat: MAT.concrete, roofAccess: true }, meta);
      for (let k = 0; k < 40; k++) W.rocks.push([cx - 70 + rnd() * 140, 0, cz - 80 + rnd() * 30, 0.6 + rnd() * 1.4]);
    } else if (town.kind === 'airfield') {
      const ry = y;
      for (let k = 0; k < 3; k++) addWarehouse(cx - 140 + k * 70, cz - 75, 0, { w: 34, d: 26, h: 11, open: true, mat: MAT.metal, tint: 0xbab2a0, backDoor: false }, { ...meta, hangar: true });
      addHouse(cx + 40, cz + 70, 2, { w: 30, d: 13, floors: 2, mat: MAT.plaster, roofAccess: true }, meta);
      addHouse(cx + 90, cz + 66, 2, { w: 8, d: 8, floors: 4, mat: MAT.concrete, roofAccess: true, cab: true, tank: false }, meta);
      addCyl(cx - 140, cz + 70, 5, 6, MAT.tank, ry, { t: 'tank' });
      addCyl(cx - 125, cz + 70, 5, 6, MAT.tank, ry, { t: 'tank' });
      W.deco.push({ t: 'plane', x: cx - 40, z: cz - 30, y: ry });
      W.boxes.push([cx - 44, ry, cz - 31.5, cx - 36, ry + 3.4, cz - 28.5, MAT.metal, 0xd8d0bc]);
      for (let k = 0; k < 6; k++) W.loot.push([cx - 160 + rnd() * 300, ry + 0.02, cz - 40 + rnd() * 20, 0]);
    } else if (town.kind === 'refinery') {
      pave(cx - 80, cz - 70, cx + 80, cz + 70, y, 2);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) addCyl(cx - 40 + i * 32, cz - 30 + j * 34, 10, 13 + (i + j) % 2 * 3, MAT.tank, y, { t: 'tank', ladder: true });
      for (let k = 0; k < 5; k++) { const z = cz - 46 + k * 22; W.boxes.push([cx - 70, y + 1.2, z - 0.4, cx + 30, y + 2.0, z + 0.4, MAT.metal, 0x8a8a7e]); }
      addCyl(cx + 62, cz - 50, 1.2, 34, MAT.metal, y, { t: 'flare' });
      addHouse(cx + 55, cz + 20, 3, { w: 14, d: 10, floors: 3, mat: MAT.concrete, roofAccess: true }, meta);
      addWarehouse(cx + 50, cz + 55, 0, { w: 20, d: 14, h: 6, mat: MAT.metal, tint: 0xc0562e }, meta);
      addHouse(cx - 60, cz + 55, 0, { w: 10, d: 8, floors: 2, mat: MAT.plaster }, meta);
    } else if (town.kind === 'village') {
      for (let k = 0; k < 16; k++) {
        const a = rnd() * 6.283, r = 18 + rnd() * (town.r - 30);
        const hx = cx + ccos(a) * r, hz = cz + csin(a) * r;
        addHouse(hx, hz, rnd.int(0, 3), { w: 7 + rnd.int(0, 4), d: 6 + rnd.int(0, 3), floors: 1 + (rnd() < 0.45 ? 1 : 0), mat: rnd.pick([MAT.plaster, MAT.plaster, MAT.plasterWarm, MAT.stone]), roofAccess: false, gable: rnd() < 0.75, pad: 3 }, meta);
      }
      // 小教堂
      addHouse(cx, cz, 0, { w: 9, d: 16, floors: 1, fh: 6, mat: MAT.plaster, tank: false, gable: true, pad: 3 }, { ...meta, chapel: true });
      W.deco.push({ t: 'belfry', x: cx, z: cz + 8.6, y: hAt(cx, cz) + 6.2 });
      for (let k = 0; k < 160; k++) { const x = cx - 170 + rnd() * 340, z = cz - 150 + rnd() * 300; W.trees.push([x, 0, z, 0, 0.8 + rnd() * 0.6]); }
    } else if (town.kind === 'radar') {
      addCyl(cx, cz, 7, 4, MAT.concrete, null, { t: 'radome' });
      addHouse(cx - 22, cz + 10, 1, { w: 12, d: 8, floors: 2, mat: MAT.concrete, roofAccess: true }, meta);
      addHouse(cx + 22, cz + 14, 3, { w: 9, d: 7, floors: 1, mat: MAT.concrete }, meta);
      addCyl(cx + 10, cz - 20, 0.6, 30, MAT.metal, null, { t: 'mast' });
    } else if (town.kind === 'estate') {
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) addHouse(cx - 26 + i * 52, cz - 22 + j * 44, j ? 2 : 0, { w: 17, d: 11, floors: 4, mat: rnd.pick([MAT.plasterWarm, MAT.plasterSage, MAT.plaster]), roofAccess: true, base: y }, meta);
      pave(cx - 10, cz - 40, cx + 10, cz + 40, y, 2);
      for (let k = 0; k < 10; k++) addCar(cx - 7 + (k % 2) * 14, cz - 34 + Math.floor(k / 2) * 15, false, y);
      addHouse(cx, cz + 62, 0, { w: 12, d: 9, floors: 1, mat: MAT.concrete }, { ...meta, shop: true });
      // 辦公大樓群
      for (const [tx, tz, th] of [[cx + 72, cz - 38, 38], [cx + 74, cz + 14, 30], [cx - 66, cz + 30, 26]]) {
        const L = new Local(); tower(L, rnd, { w: 18, d: 16, h: th });
        if (free(tx - 9, tz - 8, tx + 9, tz + 8, 1)) place(L, tx, tz, 0, y, { kind: 'tower', floors: 1, town: town.id });
      }
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
    if (addHouse(x, z, side < 0 ? 1 : 3, { w: 8 + rnd.int(0, 3), d: 7 + rnd.int(0, 2), floors: 1 + (rnd() < 0.4 ? 1 : 0), roofAccess: false, gable: true, pad: 4, base }, { town: null })) farms++;
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
    const kind = h > 60 ? 1 : treeRnd() < 0.55 ? 0 : treeRnd() < 0.5 ? 1 : 3;
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
