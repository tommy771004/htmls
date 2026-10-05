// 地形與佈局的解析函數（不碰 three 場景）：海床高度、棧橋範圍、木樁、礁群位置、亂數。
export const PIER = { x: 0, y: 0.8, z: 6 };         // 棧橋原點（岸端中心、橋面頂）
export const DECK_Y = 0.8;
// 可走範圍以漁夫身體中心算，已扣掉約 0.2 m 的半身寬：護欄內側在 x ±0.99、平台邊緣 x ±3.0、z −12
export const WALK = { x0: -0.78, x1: 0.78, z0: -7.3, z1: 6 };      // 走道可走範圍（護欄內）
export const PLAT = { x0: -2.72, x1: 2.72, z0: -11.75, z1: -7.25 }; // 盡頭平台（護欄尾端柱在 z −7 附近）
// 平台上的道具位置（world.js 擺放、漁夫碰撞共用）
export const DECOR = {
  crate: { x: -2.3, z: -11.3, rot: 0.25, s: 1 },
  crate2: { x: -2.35, z: -10.55, rot: -0.1, s: 0.8 },
  // 東北角的地上有一捆盤繩（pier 模型，中心約 (2.25, −11.15)、外徑 0.24 m，繩頭繞到繫船柱），魚簍放在它南邊的空地
  creel: { x: 2.32, z: -10.4, rot: -2.4 },
};
const BODY = 0.2;
// 平台上的障礙（從 props.glb 的 pier 實測）：四角繫船柱、西側下水梯扶手、木箱、魚簍。
// 圓 {x,z,r} 或方 {x,z,hx,hz}，碰撞時再加上身體半寬。
export const OBST = [
  { x: -2.68, z: -7.32, r: 0.17 }, { x: 2.68, z: -7.32, r: 0.17 },
  { x: -2.68, z: -11.68, r: 0.17 }, { x: 2.68, z: -11.68, r: 0.17 },
  { x: -2.93, z: -9.52, hx: 0.17, hz: 0.36 },
  { x: DECOR.crate.x, z: DECOR.crate.z, r: 0.4 },
  { x: DECOR.crate2.x, z: DECOR.crate2.z, r: 0.33 },
  { x: DECOR.creel.x, z: DECOR.creel.z, r: 0.3 },
];
export function blocked(x, z, m = BODY) {
  for (const o of OBST) {
    if (o.r != null) { if (Math.hypot(x - o.x, z - o.z) < o.r + m) return true; }
    else if (Math.abs(x - o.x) < o.hx + m && Math.abs(z - o.z) < o.hz + m) return true;
  }
  return false;
}
export const BOAT = { x: 4.35, z: -9.6, yaw: Math.PI, len: 3.2, wid: 1.3 };
const ISLE = { x: 0, z: 20 };

export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// 礁群：中心、半徑、海床隆起高度
export const REEFS = [
  { x: -5.6, z: -1.8, r: 2.4, h: 0.3 },
  { x: 5.4, z: -2.6, r: 2.2, h: 0.3 },
  { x: -10.5, z: -4.8, r: 2.8, h: 0.5 },
  { x: -7.2, z: -11, r: 2.8, h: 0.6 },
  { x: 9.2, z: -13.6, r: 3.0, h: 0.6 },
  { x: -1.2, z: -17.6, r: 3.0, h: 0.75 },
  { x: 11.5, z: -5.6, r: 2.6, h: 0.5 },
  { x: -13.5, z: -15, r: 2.6, h: 0.55 },
];

function shoreR(th) {
  return 16.4 + 1.1 * Math.sin(3 * th + 0.6) + 0.6 * Math.sin(5 * th + 2.1) + 0.35 * Math.sin(9 * th + 0.3);
}
// 離岸距離（>0 在水裡），以島中心算
export function shoreDist(x, z) {
  const dx = x - ISLE.x, dz = z - ISLE.z;
  return Math.hypot(dx, dz) - shoreR(Math.atan2(dz, dx));
}
const KN = [[0, 0], [1.5, -0.55], [4, -1.25], [8, -1.6], [12, -2.15], [16, -2.55], [22, -3.35], [32, -3.6]];
function profile(d) {
  if (d <= 0) return 0;
  for (let i = 1; i < KN.length; i++) {
    if (d <= KN[i][0]) {
      const [d0, h0] = KN[i - 1], [d1, h1] = KN[i];
      const t = (d - d0) / (d1 - d0), s = t * t * (3 - 2 * t);
      return h0 + (h1 - h0) * s;
    }
  }
  return KN[KN.length - 1][1];
}

export function floorY(x, z) {
  const d = shoreDist(x, z);
  let y;
  if (d < 0) {
    const inland = Math.min(1, -d / 3);
    y = 0.95 * (1 - Math.exp(d / 2.2)) + 0.09 * Math.sin(x * 0.7 + 1.3) * Math.sin(z * 0.55) * inland;
  } else {
    y = profile(d);
    const rip = 0.045 * Math.sin(x * 1.25 + z * 0.45) + 0.035 * Math.sin(z * 1.05 - x * 0.62 + 1.7);
    y += rip * Math.min(1, d / 2);
    for (const r of REEFS) {
      const q = ((x - r.x) ** 2 + (z - r.z) ** 2) / (r.r * r.r);
      if (q < 6) y += r.h * Math.exp(-q * 1.2);
    }
    y = Math.min(y, -0.02 * Math.min(1, d));
  }
  // 平緩的過渡（岸線兩側連續）
  return y;
}

export function inWalk(x, z) { return x >= WALK.x0 && x <= WALK.x1 && z >= WALK.z0 && z <= WALK.z1; }
export function inPlat(x, z) { return x >= PLAT.x0 && x <= PLAT.x1 && z >= PLAT.z0 && z <= PLAT.z1; }
export function onDeck(x, z) { return inWalk(x, z) || inPlat(x, z); }
// 棧橋（含護欄外緣）與船的佔地，落點與魚都要避開
export function pierFoot(x, z, m = 0) {
  return (x >= -1.25 - m && x <= 1.25 + m && z >= -7 - m && z <= 6 + m) || (x >= -3.05 - m && x <= 3.05 + m && z >= -12.05 - m && z <= -7 + m);
}
export function boatFoot(x, z, m = 0) {
  return Math.abs(x - BOAT.x) <= BOAT.wid / 2 + m && Math.abs(z - BOAT.z) <= BOAT.len / 2 + m;
}
export function isWater(x, z, minDepth = 0.45) { return floorY(x, z) < -minDepth; }

// 預設木樁位置（GLB 存在時由 world.js 從模型頂點重新量出來）
export function defaultPiles() {
  const p = [];
  for (let z = 6; z >= -6; z -= 2) { p.push([-1.15, z], [1.15, z]); }
  for (const z of [-7.1, -9.5, -11.9]) for (const x of [-2.95, 0, 2.95]) p.push([x, z]);
  return p;
}
