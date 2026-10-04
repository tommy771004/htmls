// 地圖：路線、塔位、障礙物、地面繪製、地形與植被。
import * as THREE from 'three';
import { MAP, BASE, FOUNTAIN, TEAM_COLOR, CAMPS, DRAGON } from './config.js';
import { patchFog, fogUniforms } from './fog.js';
import { buildProps } from './map-props.js';

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const TOP = [[-70, 58], [-73, 12], [-72, -48], [-63, -63], [-48, -72], [12, -73], [58, -70]];
const MID = [[-58, 58], [58, -58]];
const BOT = TOP.map(([x, z]) => [-x, -z]).reverse();
// LANES[i] = 從青隊（team 0）往赤隊的路點；赤隊使用反向
export const LANES = [TOP, MID, BOT].map((pts) => pts.map(([x, z]) => ({ x, z })));
export const LANE_NAMES = ['上路', '中路', '下路'];
export function lanePath(lane, team) { return team === 0 ? LANES[lane] : LANES[lane].slice().reverse(); }

function polyLen(p) { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z); return L; }
export function pointAlong(p, d) {
  for (let i = 1; i < p.length; i++) {
    const l = Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z);
    if (d <= l) { const k = d / l; return { x: p[i - 1].x + (p[i].x - p[i - 1].x) * k, z: p[i - 1].z + (p[i].z - p[i - 1].z) * k, seg: i }; }
    d -= l;
  }
  const e = p[p.length - 1]; return { x: e.x, z: e.z, seg: p.length - 1 };
}
export function distToSeg(px, pz, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, L = dx * dx + dz * dz;
  let t = L ? ((px - a.x) * dx + (pz - a.z) * dz) / L : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - a.x - dx * t, pz - a.z - dz * t);
}
export function distToLane(px, pz, lane) { const p = LANES[lane]; let d = 1e9; for (let i = 1; i < p.length; i++) d = Math.min(d, distToSeg(px, pz, p[i - 1], p[i])); return d; }
export function distToLanes(px, pz) { return Math.min(distToLane(px, pz, 0), distToLane(px, pz, 1), distToLane(px, pz, 2)); }
export function nearestLane(px, pz) { let b = 0, bd = 1e9; for (let i = 0; i < 3; i++) { const d = distToLane(px, pz, i); if (d < bd) { bd = d; b = i; } } return b; }
// 路線上離 (px,pz) 最近點的弧長
export function laneProgress(path, px, pz) {
  let best = 1e9, bestD = 0, acc = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
    let t = ((px - a.x) * dx + (pz - a.z) * dz) / (L * L); t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(px - a.x - dx * t, pz - a.z - dz * t);
    if (d < best) { best = d; bestD = acc + t * L; }
    acc += L;
  }
  return bestD;
}
export const riverDist = (x, z) => Math.abs(x - z) / Math.SQRT2;

// 建築：每路外塔、內塔（各隊），主堡
export const STRUCTURES = [];
for (let team = 0; team < 2; team++) {
  for (let lane = 0; lane < 3; lane++) {
    const p = lanePath(lane, team), L = polyLen(p);
    const fr = lane === 1 ? [0.2, 0.39] : [0.16, 0.37];
    ['inner', 'outer'].forEach((tier, k) => {
      const q = pointAlong(p, L * fr[k]);
      STRUCTURES.push({ id: `t${team}${lane}${tier[0]}`, kind: 'tower', tier, team, lane, x: q.x, z: q.z });
    });
  }
  STRUCTURES.push({ id: `core${team}`, kind: 'core', team, x: BASE[team][0], z: BASE[team][1] });
}

// 高度：河道下凹；地圖外圍是一圈岩壁（約 91～96 陡升），岩壁上是林地台地；河道出口處岩壁斷開成峽谷
export function heightAt(x, z) {
  const r = riverDist(x, z);
  let h = 0;
  if (r < 9) { const k = 1 - r / 9; h -= 0.75 * k * k * (3 - 2 * k); }
  const e = Math.max(Math.abs(x), Math.abs(z)) - 91;
  if (e > 0) {
    const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
    const gap = ss(6, 15, r);
    let c = ss(0, 4.5, e) * 6.5 + Math.max(0, e - 6) * 0.07 + (Math.sin(x * 0.21 + z * 0.07) * 0.5 + Math.cos(z * 0.17 - x * 0.05) * 0.5) * ss(3, 9, e) * 0.9;
    h += c * gap - (1 - gap) * Math.min(e, 6) * 0.04;
  }
  return h;
}

// 障礙物（圓）：石牆與樹叢岩石。先產生草叢，再在下方鋪障礙物（避開草叢）
export const OBSTACLES = [];

// 草叢：路邊與河岸的高草，站進去的單位只有同一叢裡（或貼身）的敵人看得到。兩隊點對稱、公平。
export const BUSHES = [];
{
  const R = rng(7777);
  const free = (x, z, r) => {
    if (Math.abs(x) > 85 || Math.abs(z) > 85) return false;
    for (const o of OBSTACLES) if (Math.hypot(x - o.x, z - o.z) < o.r + r + 0.6) return false;
    for (const b of BASE) if (Math.hypot(x - b[0], z - b[1]) < 26 + r) return false;
    for (const c of CAMPS) if (Math.hypot(x - c.x, z - c.z) < (c.boss ? 10 : 6) + r) return false;
    if (Math.hypot(x - DRAGON.pit.x, z - DRAGON.pit.z) < 10 + r) return false;
    for (const s of STRUCTURES) if (Math.hypot(x - s.x, z - s.z) < 7 + r) return false;
    for (const b of BUSHES) if (Math.hypot(x - b.x, z - b.z) < b.r + r + 4) return false;
    return true;
  };
  const tryAdd = (x, z, r) => {
    if (x > z - 1) return false; // 只在青隊半邊挑，再點對稱到赤隊半邊
    if (!free(x, z, r) || !free(-x, -z, r)) return false;
    BUSHES.push({ x, z, r }); BUSHES.push({ x: -x, z: -z, r }); return true;
  };
  // 路邊：沿三條路兩側 6～8 公尺
  for (const p of LANES) {
    const L = polyLen(p);
    for (let d = 14; d < L - 14; d += 7 + R() * 5) {
      const a = pointAlong(p, d), b = pointAlong(p, d + 1), dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
      const side = R() < 0.5 ? -1 : 1, off = 7.2 + R() * 1.6, r = 2.2 + R() * 1.1;
      if (!tryAdd(a.x - (dz / l) * off * side, a.z + (dx / l) * off * side, r)) tryAdd(a.x + (dz / l) * off * side, a.z - (dx / l) * off * side, r);
    }
  }
  // 河岸：沿河道兩側
  for (let t = -70; t <= 70; t += 7 + R() * 5) {
    const off = 7.5 + R() * 2, r = 2.3 + R() * 1;
    tryAdd(t - off / Math.SQRT2, t + off / Math.SQRT2, r);
  }
  BUSHES.forEach((b, i) => { b.id = i + 1; });
}

// 石牆：仿推塔遊戲的叢林，沿路線內側、河道兩岸與野怪營地外圍鋪連續的岩牆（折線密集取樣成互相重疊的圓，
// 碰撞、尋路與視線都沿用圓的邏輯）。只設計青隊半邊（z > x），再點對稱到赤隊。被草叢、塔下廣場、營地、
// 神龍坑或路線擋到的取樣點直接略過，所以牆會在草叢與路口自然斷開成缺口。
{
  const R = rng(4198);
  const clear = (x, z, r) => {
    if (Math.abs(x) > 86 - r || Math.abs(z) > 86 - r) return false;
    if (distToLanes(x, z) < 7.2 + r) return false;
    if (riverDist(x, z) < 6.5 + r) return false;
    for (const b of BASE) if (Math.hypot(x - b[0], z - b[1]) < 24 + r) return false;
    for (const c of CAMPS) if (Math.hypot(x - c.x, z - c.z) < (c.boss ? 11 : 7.5) + r) return false;
    if (Math.hypot(x - DRAGON.pit.x, z - DRAGON.pit.z) < 11 + r) return false;
    for (const s of STRUCTURES) if (Math.hypot(x - s.x, z - s.z) < (s.kind === 'core' ? 24 : 7.2) + r) return false;
    for (const b of BUSHES) if (Math.hypot(x - b.x, z - b.z) < b.r + r + 0.5) return false;
    return true;
  };
  const both = (x, z, r) => clear(x, z, r) && clear(-x, -z, r);
  let wid = 0;
  const wall = (pts) => {
    wid++;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 1.1);
      for (let k = i === 1 ? 0 : 1; k <= n; k++) {
        const t = k / n, x = ax + (bx - ax) * t + (R() - 0.5) * 0.5, z = az + (bz - az) * t + (R() - 0.5) * 0.5, r = 1.75 + R() * 0.45;
        if (!both(x, z, r)) continue;
        const seed = (R() * 1e6) | 0;
        OBSTACLES.push({ x, z, r, kind: 'wall', wall: wid, seed }, { x: -x, z: -z, r, kind: 'wall', wall: -wid, seed: seed + 1 });
      }
    }
  };
  const arc = (cx, cz, rad, a0, a1) => { const pts = []; for (let a = a0; a <= a1 + 0.1; a += 12) pts.push([cx + Math.cos(a * Math.PI / 180) * rad, cz + Math.sin(a * Math.PI / 180) * rad]); return pts; };
  // 西側叢林（青隊上路與中路之間）
  wall([[-58, -42], [-58.5, -25]]); wall([[-58, -12], [-57.5, 3]]); wall([[-58, 13], [-56, 34]]); // 沿上路內側（缺口對準恐龍營地與中段）
  wall([[-44, -2], [-37, 5]]);                                            // 野區中央的短牆
  wall([[-46, 32], [-30, 16], [-14, 0], [-6, -8]]);                       // 沿中路
  wall([[-60, -46], [-52, -38]]); wall([[-22, -8], [-10, 4]]);            // 沿河岸（神龍坑與中央路口留空）
  wall(arc(-48, -18, 9.6, 20, 150)); wall(arc(-48, -18, 9.6, 215, 285));  // 恐龍營地：朝上路與河道開口
  // 南側叢林（青隊下路與中路之間）
  wall([[-30, 58], [-13, 58.5]]); wall([[-4, 58], [11, 57.5]]); wall([[24, 58.5], [42, 58]]); // 沿下路內側（缺口對準機器人營地與中段）
  wall([[-14, 42], [-6, 35]]);                                            // 野區中央的短牆
  wall([[-36, 50], [-20, 34], [-4, 18], [2, 12]]);                        // 沿中路
  wall([[6, 20], [18, 32]]); wall([[44, 58], [50, 64]]);                  // 沿河岸（大猿石場留空）
  wall(arc(18, 48, 9.6, 110, 300)); wall(arc(18, 48, 9.6, 350, 430));    // 機器人營地：朝下路與河道開口
  // 其餘空地：零散的樹叢與大岩石（也點對稱），彼此與石牆之間留出通道
  const ok = (x, z, r) => {
    if (!both(x, z, r)) return false;
    for (const o of OBSTACLES) if (Math.hypot(x - o.x, z - o.z) < o.r + r + 2.8) return false;
    return true;
  };
  for (const [x, z, r, kind] of [[-46, 10, 3.8, 'rock'], [-30, 4, 3.4, 'trees'], [-8, 40, 3.8, 'trees'], [8, 30, 3.4, 'rock'], [34, 50, 3.5, 'trees'], [-40, -4, 3.3, 'trees']]) {
    if (ok(x, z, r)) { const seed = (R() * 1e6) | 0; OBSTACLES.push({ x, z, r, kind, seed }, { x: -x, z: -z, r, kind, seed: seed + 1 }); }
  }
  for (let gx = -84; gx <= 84; gx += 6) for (let gz = -84; gz <= 84; gz += 6) {
    const x = gx + (R() - 0.5) * 4, z = gz + (R() - 0.5) * 4, r = 1.6 + R() * 2.4, roll = R(), kind = R() < 0.7 ? 'trees' : 'rock', seed = (R() * 1e6) | 0;
    if (z <= x + 1 || roll > 0.7 || !ok(x, z, r)) continue;
    OBSTACLES.push({ x, z, r, kind, seed }, { x: -x, z: -z, r, kind, seed: seed + 1 });
  }
}
export function bushAt(x, z) { for (const b of BUSHES) if ((x - b.x) ** 2 + (z - b.z) ** 2 < b.r * b.r) return b.id; return 0; }

// 把圓推出障礙物與地圖邊界；回傳是否有碰撞
// 障礙物的空間格（8 公尺）：每格存與「格子外擴 3 公尺」重疊的圓，點查詢只看一格，框查詢看涵蓋的格
const OG = 8, ON = 24, OHALF = 96, OPAD = 3;
let ogrid = null, ostamp = 0;
function obsGrid() {
  if (ogrid) return ogrid;
  ogrid = Array.from({ length: ON * ON }, () => []);
  for (const o of OBSTACLES) {
    const i0 = Math.max(0, Math.floor((o.x - o.r - OPAD + OHALF) / OG)), i1 = Math.min(ON - 1, Math.floor((o.x + o.r + OPAD + OHALF) / OG));
    const j0 = Math.max(0, Math.floor((o.z - o.r - OPAD + OHALF) / OG)), j1 = Math.min(ON - 1, Math.floor((o.z + o.r + OPAD + OHALF) / OG));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) ogrid[j * ON + i].push(o);
  }
  return ogrid;
}
const ocell = (x, z) => { const i = Math.max(0, Math.min(ON - 1, Math.floor((x + OHALF) / OG))), j = Math.max(0, Math.min(ON - 1, Math.floor((z + OHALF) / OG))); return obsGrid()[j * ON + i]; };
// 框內（含外擴）可能碰到的障礙物，不重複
export function obstaclesNear(x0, z0, x1, z1) {
  const g = obsGrid(), out = [];
  const i0 = Math.max(0, Math.floor((Math.min(x0, x1) + OHALF) / OG)), i1 = Math.min(ON - 1, Math.floor((Math.max(x0, x1) + OHALF) / OG));
  const j0 = Math.max(0, Math.floor((Math.min(z0, z1) + OHALF) / OG)), j1 = Math.min(ON - 1, Math.floor((Math.max(z0, z1) + OHALF) / OG));
  if (i0 === i1 && j0 === j1) return g[j0 * ON + i0];
  ostamp++;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (const o of g[j * ON + i]) if (o._s !== ostamp) { o._s = ostamp; out.push(o); }
  return out;
}
export function collide(p, radius) {
  let hit = false;
  for (const o of (radius <= OPAD ? ocell(p.x, p.z) : obstaclesNear(p.x - radius, p.z - radius, p.x + radius, p.z + radius))) {
    const dx = p.x - o.x, dz = p.z - o.z, rr = o.r + radius, d2 = dx * dx + dz * dz;
    if (d2 < rr * rr) { const d = Math.sqrt(d2) || 1e-4; p.x = o.x + (dx / d) * rr; p.z = o.z + (dz / d) * rr; hit = true; }
  }
  const lim = 88 - radius;
  if (p.x < -lim) { p.x = -lim; hit = true; } if (p.x > lim) { p.x = lim; hit = true; }
  if (p.z < -lim) { p.z = -lim; hit = true; } if (p.z > lim) { p.z = lim; hit = true; }
  return hit;
}
// 線段是否穿過障礙物（給 AI 與瞬移判斷視線）
export function blocked(ax, az, bx, bz, pad = 0) {
  const a = { x: ax, z: az }, b = { x: bx, z: bz };
  for (const o of obstaclesNear(ax - pad, az - pad, bx + pad, bz + pad)) if (distToSeg(o.x, o.z, a, b) < o.r + pad) return true;
  return false;
}
export function walkable(x, z, radius) { const p = { x, z }; return !collide(p, radius); }

/* ---------------- 地面貼圖 ---------------- */
// 畫布只負責大範圍的配色（草地明暗、泥土路、河岸、營地、陰影），石板、廣場、筆觸與碎石在 shader 裡依世界座標畫，
// 拉近也不會糊。另一張小遮罩的紅色通道標出路上哪裡鋪石板。
const TEX_HALF = 130;
let TEX_PX = 2048;
const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
function insideObstacle(x, z, pad = 0) { for (const o of OBSTACLES) if (Math.hypot(x - o.x, z - o.z) < o.r + pad) return true; return false; }

// 廣場：塔下、基地與大猿石場；shader 用環狀石板鋪
export const PLAZAS = [
  ...STRUCTURES.filter((s) => s.kind === 'tower').map((s) => ({ x: s.x, z: s.z, r: 6.6, kind: 0 })),
  ...BASE.map((b, team) => ({ x: b[0], z: b[1], r: 23.4, kind: 1 + team })),
  ...CAMPS.filter((c) => c.boss).map((c) => ({ x: c.x, z: c.z, r: 10.5, kind: 3 })),
  { x: DRAGON.pit.x, z: DRAGON.pit.z, r: 10.5, kind: 3 },
];

function paintGround() {
  const c = document.createElement('canvas'); c.width = c.height = TEX_PX;
  const g = c.getContext('2d'), R = rng(7);
  const S = TEX_PX / (TEX_HALF * 2);
  const X = (x) => (x + TEX_HALF) * S, Z = (z) => (z + TEX_HALF) * S;
  const blob = (x, z, r, inner, outer, gg = g) => { const gr = gg.createRadialGradient(X(x), Z(z), 0, X(x), Z(z), r * S); gr.addColorStop(0, inner); gr.addColorStop(1, outer); gg.fillStyle = gr; gg.beginPath(); gg.arc(X(x), Z(z), r * S, 0, Math.PI * 2); gg.fill(); };
  g.fillStyle = '#6f9243'; g.fillRect(0, 0, TEX_PX, TEX_PX);
  // 低頻明暗：陽光下偏暖黃綠、樹蔭偏冷藍綠；野區整體壓暗
  for (let i = 0; i < 340; i++) {
    const x = (R() * 2 - 1) * TEX_HALF, z = (R() * 2 - 1) * TEX_HALF, r = 7 + R() * 20;
    const warm = R() < 0.55 - ss(10, 26, distToLanes(x, z)) * 0.25;
    blob(x, z, r, warm ? 'rgba(176,182,84,.26)' : 'rgba(38,92,72,.28)', 'rgba(0,0,0,0)');
  }
  for (let i = 0; i < 5200; i++) {
    const x = (R() * 2 - 1) * TEX_HALF, z = (R() * 2 - 1) * TEX_HALF, j = ss(9, 24, distToLanes(x, z));
    if (j < 0.2) continue;
    blob(x, z, 2 + R() * 3, `rgba(30,70,52,${0.1 * j})`, 'rgba(0,0,0,0)');
  }
  // 筆刷：短而方向一致的塗抹，像手繪背景
  for (let i = 0; i < 16000; i++) {
    const x = (R() * 2 - 1) * TEX_HALF, z = (R() * 2 - 1) * TEX_HALF;
    const jungle = ss(8, 22, distToLanes(x, z)), out = ss(90, 98, Math.max(Math.abs(x), Math.abs(z)));
    const h = 84 + (R() - 0.5) * 26 + jungle * 22, s = 34 + R() * 18 - jungle * 6, l = 38 + (R() - 0.5) * 14 - jungle * 8 - out * 8;
    g.fillStyle = `hsla(${h},${s}%,${l}%,${0.18 + R() * 0.25})`;
    g.save(); g.translate(X(x), Z(z)); g.rotate(-0.55 + (R() - 0.5) * 0.5);
    g.beginPath(); g.ellipse(0, 0, (1.2 + R() * 2.6) * S, (0.25 + R() * 0.5) * S, 0, 0, Math.PI * 2); g.fill(); g.restore();
  }
  // 外圍岩壁帶與台地林床
  for (let i = 0; i < 9000; i++) {
    const x = (R() * 2 - 1) * TEX_HALF, z = (R() * 2 - 1) * TEX_HALF, e = Math.max(Math.abs(x), Math.abs(z));
    if (e < 90 || riverDist(x, z) < 8) continue;
    const cliff = e < 97;
    g.fillStyle = cliff ? `hsla(${30 + R() * 12},${12 + R() * 10}%,${40 + R() * 14}%,.7)` : `hsla(${110 + R() * 30},${26 + R() * 12}%,${22 + R() * 10}%,.55)`;
    g.fillRect(X(x), Z(z), (0.6 + R() * 1.4) * S, (0.4 + R() * 1.0) * S);
  }
  // 通往野怪營地的踩踏小徑
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const cp of CAMPS) {
    if (cp.boss) continue;
    for (let lane = 0; lane < 3; lane++) {
      const p = LANES[lane]; let best = null, bd = 1e9;
      for (let d = 0; d < polyLen(p); d += 2) { const q = pointAlong(p, d), dd = Math.hypot(q.x - cp.x, q.z - cp.z); if (dd < bd) { bd = dd; best = q; } }
      if (bd > 46) continue;
      const mx = (best.x + cp.x) / 2 + (R() - 0.5) * 8, mz = (best.z + cp.z) / 2 + (R() - 0.5) * 8;
      for (let k = 0; k < 3; k++) {
        g.strokeStyle = ['rgba(120,118,62,.3)', 'rgba(150,118,74,.55)', 'rgba(186,150,98,.45)'][k]; g.lineWidth = [4.2, 2.6, 1.4][k] * S;
        g.beginPath(); g.moveTo(X(best.x), Z(best.z)); g.quadraticCurveTo(X(mx), Z(mz), X(cp.x), Z(cp.z)); g.stroke();
      }
    }
  }
  // 障礙物底下的環境遮蔽
  for (const o of OBSTACLES) blob(o.x + 0.6, o.z - 0.4, o.r * 1.7 + 1.4, 'rgba(16,34,22,.6)', 'rgba(16,34,22,0)');
  // 河岸：沙、濕泥、河床
  const band = (w, col) => {
    g.strokeStyle = col; g.lineWidth = w * S * 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(X(-TEX_HALF), Z(-TEX_HALF)); g.lineTo(X(TEX_HALF), Z(TEX_HALF)); g.stroke();
  };
  band(10.4, 'rgba(120,136,72,.45)'); band(9.4, '#bfa979'); band(7.9, '#9c8a62'); band(7.0, '#6a7854'); band(6.4, '#3c6466');
  for (let i = 0; i < 2600; i++) { // 河岸卵石
    const t = (R() * 2 - 1) * TEX_HALF * 1.3, side = R() < 0.5 ? -1 : 1, off = (6.6 + R() * 2.8) * side;
    const x = t / Math.SQRT2 + off / Math.SQRT2, z = t / Math.SQRT2 - off / Math.SQRT2;
    g.fillStyle = `hsl(${30 + R() * 14},${10 + R() * 12}%,${58 + R() * 18}%)`;
    g.beginPath(); g.ellipse(X(x), Z(z), (0.12 + R() * 0.25) * S, (0.08 + R() * 0.16) * S, R() * 3, 0, Math.PI * 2); g.fill();
  }
  // 草叢底下的深色地面
  for (const b of BUSHES) blob(b.x, b.z, b.r + 1.4, 'rgba(26,64,40,.55)', 'rgba(26,64,40,0)');
  // 路線：沿路疊圓，邊緣不規則；外圈踩禿的草、深色土緣、泥土、中央被走亮的土
  const along = (fn, step = 0.7) => { for (const p of LANES) { const L = polyLen(p); for (let d = 0; d < L; d += step) fn(pointAlong(p, d)); } };
  const dots = (r0, jr, col, jit) => { g.fillStyle = col; along((q) => { const r = (r0 + (R() - 0.5) * jr) * S; g.beginPath(); g.arc(X(q.x + (R() - 0.5) * jit), Z(q.z + (R() - 0.5) * jit), r, 0, Math.PI * 2); g.fill(); }); };
  dots(7.4, 1.8, 'rgba(150,152,84,.05)', 1.5);
  dots(5.9, 1.4, 'rgba(98,78,46,.16)', 1.2);
  dots(5.3, 1.2, '#a88b62', 1.0);
  dots(4.4, 1.6, 'rgba(196,160,108,.22)', 1.6);
  dots(2.6, 1.6, 'rgba(214,184,132,.12)', 2.2);
  // 路緣的草舌與碎土：讓邊緣像筆刷收尾
  along((q) => {
    for (let k = 0; k < 2; k++) {
      const a = R() * 6.28, d = 4.6 + R() * 1.4, x = q.x + Math.cos(a) * d, z = q.z + Math.sin(a) * d;
      if (distToLanes(x, z) < 4.2) continue;
      g.fillStyle = R() < 0.6 ? `hsla(${80 + R() * 16},${30 + R() * 10}%,${36 + R() * 8}%,.7)` : 'rgba(150,118,80,.5)';
      g.save(); g.translate(X(x), Z(z)); g.rotate(a); g.beginPath(); g.ellipse(0, 0, (0.5 + R() * 1.1) * S, (0.2 + R() * 0.3) * S, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
  }, 1.1);
  // 廣場底色：石板間的土，外圈一點陰影
  for (const p of PLAZAS) {
    blob(p.x, p.z, p.r + 2.4, 'rgba(60,46,28,.38)', 'rgba(60,46,28,0)');
    blob(p.x, p.z, p.r + 0.4, 'rgba(150,124,88,1)', 'rgba(150,124,88,.6)');
  }
  // 基地泉水
  BASE.forEach((b, team) => { const f = FOUNTAIN[team]; g.fillStyle = '#d7cfb9'; g.beginPath(); g.arc(X(f[0]), Z(f[1]), 6 * S, 0, Math.PI * 2); g.fill(); });
  // 野怪營地：踩平的泥地與一圈平石
  for (const cp of CAMPS) {
    if (cp.boss) continue;
    const R0 = 5;
    blob(cp.x, cp.z, R0 + 2.5, 'rgba(60,48,26,.45)', 'rgba(60,48,26,0)');
    blob(cp.x, cp.z, R0, 'rgba(160,128,86,.95)', 'rgba(150,124,82,.35)');
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2 + R() * 0.1, rr = R0 + (R() - 0.5) * 0.4, sz = 0.55 + R() * 0.3;
      g.fillStyle = `hsl(${32 + R() * 10},${10 + R() * 10}%,${58 + R() * 14}%)`; g.strokeStyle = 'rgba(60,48,30,.5)'; g.lineWidth = 0.1 * S;
      g.save(); g.translate(X(cp.x + Math.cos(a) * rr), Z(cp.z + Math.sin(a) * rr)); g.rotate(a);
      g.beginPath(); g.ellipse(0, 0, sz * S, sz * 0.62 * S, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore();
    }
  }
  // 成簇的小花（只在路邊與野區空地）
  const FLOWER = ['#f4e7b0', '#f2b8a0', '#fff6e0', '#f6d36a', '#e9a6c0'];
  for (let i = 0; i < 420; i++) {
    const cx = (R() * 2 - 1) * 88, cz = (R() * 2 - 1) * 88;
    if (distToLanes(cx, cz) < 6.5 || riverDist(cx, cz) < 7 || insideObstacle(cx, cz, 0.3) || BASE.some((b) => Math.hypot(cx - b[0], cz - b[1]) < 25)) continue;
    const colr = FLOWER[(R() * FLOWER.length) | 0], n = 5 + ((R() * 12) | 0);
    for (let k = 0; k < n; k++) {
      const a = R() * 6.28, d = R() * 1.6;
      g.fillStyle = colr; g.beginPath(); g.arc(X(cx + Math.cos(a) * d), Z(cz + Math.sin(a) * d), (0.08 + R() * 0.07) * S, 0, Math.PI * 2); g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;

  // 鋪石遮罩：沿路成片的石板，片與片之間露出泥土
  const M = 1024, mc = document.createElement('canvas'); mc.width = mc.height = M;
  const mg = mc.getContext('2d'), MS = M / (TEX_HALF * 2), MX = (x) => (x + TEX_HALF) * MS;
  mg.fillStyle = '#000'; mg.fillRect(0, 0, M, M);
  for (const p of LANES) {
    const L = polyLen(p);
    for (let d = 4; d < L - 4; d += 3 + R() * 6) {
      if (R() < 0.35) continue;
      const q = pointAlong(p, d), len = 2 + R() * 6;
      if (riverDist(q.x, q.z) < 8) continue;
      for (let k = 0; k < len; k += 1.2) {
        const s = pointAlong(p, d + k), r = (2.6 + R() * 2.2) * MS;
        const gr = mg.createRadialGradient(MX(s.x), MX(s.z), 0, MX(s.x), MX(s.z), r);
        gr.addColorStop(0, 'rgba(255,0,0,1)'); gr.addColorStop(0.6, 'rgba(255,0,0,.8)'); gr.addColorStop(1, 'rgba(255,0,0,0)');
        mg.fillStyle = gr; mg.beginPath(); mg.arc(MX(s.x + (R() - 0.5) * 2), MX(s.z + (R() - 0.5) * 2), r, 0, Math.PI * 2); mg.fill();
      }
    }
  }
  const mask = new THREE.CanvasTexture(mc); mask.minFilter = THREE.LinearFilter; mask.generateMipmaps = false;
  return { tex, canvas: c, mask };
}

function detailTexture() {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), R = rng(99);
  g.fillStyle = '#808080'; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 2600; i++) {
    const x = R() * N, y = R() * N, v = (R() * 120 + 70) | 0;
    g.fillStyle = `rgba(${v},${v},${v},.35)`;
    g.save(); g.translate(x, y); g.rotate(R() * 3);
    for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { g.beginPath(); g.ellipse(dx, dy, 1 + R() * 5, 0.6 + R() * 2, 0, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
  // 第二層：細草刃紋（綠通道）
  const d = g.getImageData(0, 0, N, N);
  for (let i = 0; i < 9000; i++) {
    const x = (R() * N) | 0, y = (R() * N) | 0, len = 2 + (R() * 4) | 0, v = R() < 0.5 ? 60 : 200;
    for (let k = 0; k < len; k++) { const j = (((y + k) % N) * N + x) * 4 + 1; d.data[j] = v; }
  }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

/* ---------------- 3D 場景 ---------------- */
let gradMap;
export function toonGradient() {
  if (gradMap) return gradMap;
  const d = new Uint8Array([90, 170, 255]);
  gradMap = new THREE.DataTexture(d, 3, 1, THREE.RedFormat); gradMap.minFilter = gradMap.magFilter = THREE.NearestFilter; gradMap.needsUpdate = true;
  return gradMap;
}
const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...extra });

export function buildMap(scene, quality = 1) {
  const group = new THREE.Group(); scene.add(group);
  TEX_PX = quality > 0 ? 4096 : 2048;
  const { tex, canvas, mask } = paintGround();
  // 地面
  const seg = quality > 0 ? 260 : 150;
  const geo = new THREE.PlaneGeometry(TEX_HALF * 2, TEX_HALF * 2, seg, seg); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const gmat = new THREE.MeshLambertMaterial({ map: tex });
  // 依世界座標畫細節：筆刷草地、土裡的碎石、路上的不規則石板（Voronoi）、廣場的環狀石板與星芒刻紋；陡坡（岩壁）改成岩石色
  const detail = detailTexture();
  const plazaU = Array.from({ length: 16 }, (_, i) => { const p = PLAZAS[i]; return p ? new THREE.Vector4(p.x, p.z, p.r, p.kind) : new THREE.Vector4(1e4, 1e4, 0, 0); });
  const sunXZ = new THREE.Vector2(38, -22).normalize();
  const teamLin = TEAM_COLOR.map((c) => new THREE.Color(c));
  gmat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uDetail: { value: detail }, uMask: { value: mask }, uPlaza: { value: plazaU }, uSun: { value: sunXZ }, uTeam: { value: teamLin } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWxz; varying float vSlope;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWxz = (modelMatrix * vec4(transformed, 1.0)).xz; vSlope = 1.0 - normal.y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D uDetail, uMask; uniform vec4 uPlaza[16]; uniform vec2 uSun; uniform vec3 uTeam[2];
varying vec2 vWxz; varying float vSlope;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 h22(vec2 p){ float n = h21(p); return vec2(n, h21(p + n * 17.13)); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
// Voronoi：回傳最近格的編號與中心、到邊界的距離與朝向邊界的法線
void vor(vec2 p, float sc, out vec2 cid, out vec2 cpos, out float edge, out vec2 en){
  vec2 q = p / sc, i = floor(q), f = fract(q), mr = vec2(0), mg = vec2(0); float md = 8.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(x, y), r = g + .12 + .76 * h22(i + g) - f; float d = dot(r, r); if (d < md) { md = d; mr = r; mg = g; } }
  md = 8.; en = vec2(1, 0);
  for (int y = -${quality > 0 ? 2 : 1}; y <= ${quality > 0 ? 2 : 1}; y++) for (int x = -${quality > 0 ? 2 : 1}; x <= ${quality > 0 ? 2 : 1}; x++) {
    vec2 g = mg + vec2(x, y), r = g + .12 + .76 * h22(i + g) - f;
    if (dot(mr - r, mr - r) > 1e-5) { vec2 n = normalize(r - mr); float d = dot(.5 * (mr + r), n); if (d < md) { md = d; en = n; } }
  }
  cid = i + mg; cpos = p + mr * sc; edge = md * sc;
}
// 一塊石板：色差、斑駁、邊緣苔、受光倒角、裂紋、填縫
vec3 slab(vec3 under, vec2 cid, float edge, vec2 en, vec2 p, float tint){
  float hv = h21(cid + .7);
  vec3 s = mix(vec3(.50, .45, .34), vec3(.62, .57, .45), hv) * mix(vec3(1.), vec3(1.05, 1., .9), h21(cid + 3.1));
  s *= .86 + .22 * vn(p * 1.6 + hv * 9.) + .08 * vn(p * 6. + hv * 3.);
  float moss = (1. - smoothstep(.0, .35, edge)) * smoothstep(.45, .7, vn(p * .8 + cid));
  s = mix(s, vec3(.17, .24, .09), moss * .55);
  s = mix(s, s * vec3(.9, .95, 1.08), tint);
  float t = 1. - smoothstep(0., .16, edge), lit = dot(en, uSun);
  s *= 1. + t * lit * .5;
  if (h21(cid + 5.3) < .3) { float cr = abs(vn(p * 1.2 + hv * 20.) - .5); s *= mix(1., .45, 1. - smoothstep(.006, .024, cr)); }
  vec3 grout = under * .45;
  return mix(s, grout, 1. - smoothstep(.03, .075, edge));
}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
 vec4 dA = texture2D(uDetail, vWxz * 0.19), dB = texture2D(uDetail, vWxz * 0.047 + 0.37);
 vec3 col = diffuseColor.rgb;
 float grassy = smoothstep(-0.03, 0.03, col.g - col.r);
 vec2 P = vWxz;
 // 草：方向一致的筆觸 + 大塊光斑（暖黃綠／冷藍綠）
 vec2 rp = mat2(.85, -.53, .53, .85) * P;
 float st = vn(rp * vec2(.9, 4.6)) * .55 + vn(rp * vec2(2.1, 10.) + 7.) * .3 + vn(rp * vec2(4., 22.) + 3.) * .15;
 float dap = vn(P * .085) * .62 + vn(P * .21 + 3.) * .38;
 vec3 g = col * mix(vec3(.78, .94, 1.04), vec3(1.14, 1.08, .78), smoothstep(.3, .74, dap)) * (.8 + .4 * st);
 g *= 1. + (dA.r - .5) * .18;
 // 土：顆粒、深色斑、碎石
 vec3 d = col * (.88 + .2 * vn(P * 2.3) + .1 * vn(P * 9.)) * (.9 + .2 * dB.r);
 { vec2 ci, cp, en2; float e; vor(P, .55, ci, cp, e, en2); float pr = h21(ci + 9.1);
   if (pr < .1) { float r = length(P - cp); float k = 1. - smoothstep(.05 + pr * .5, .08 + pr * .6, r); vec3 pc = mix(vec3(.42, .38, .3), vec3(.64, .6, .5), h21(ci)); pc *= 1. + dot(normalize(P - cp + 1e-4), uSun) * .25; d = mix(d, pc, k); d *= 1. - .35 * (1. - k) * (1. - smoothstep(.1, .3, length(P - cp - uSun * .06))) * step(r, .3); } }
 col = mix(d, g, grassy);
 // 廣場：環狀石板
 float inPlaza = 0.;
 for (int k = 0; k < 16; k++) {
   vec4 Q = uPlaza[k]; vec2 rel = P - Q.xy; float r = length(rel);
   if (r < Q.z) {
     inPlaza = 1.;
     float a = atan(rel.y, rel.x), r0 = Q.w > .5 && Q.w < 2.5 ? 3.2 : 1.5, rw = Q.w > .5 && Q.w < 2.5 ? 2.0 : 1.45;
     vec2 dir = rel / max(r, 1e-4), tg = vec2(-dir.y, dir.x);
     vec2 ci; float e; vec2 en;
     if (r < r0) { ci = vec2(-1., float(k)); e = r0 - r; en = dir; }
     else {
       float ri = floor((r - r0) / rw), fr = (r - r0) / rw - ri;
       float n = max(8., floor(6.2832 * (r0 + (ri + .5) * rw) / 2.1));
       float u = a / 6.2832 * n + h21(vec2(ri, k)) * 4., fu = fract(u);
       ci = vec2(ri, floor(u)) + float(k) * 37.;
       float eR = min(fr, 1. - fr) * rw, eA = min(fu, 1. - fu) * 6.2832 * r / n;
       e = min(eR, eA); en = eR < eA ? (fr < .5 ? -dir : dir) : (fu < .5 ? -tg : tg);
     }
     float rim = smoothstep(Q.z - 2.6, Q.z, r);
     if (h21(ci + 2.2) > rim * .85) col = slab(col, ci, e, en, P, 0.);
     // 中央圓石的星芒刻紋，沿放射線延伸到外圈
     float spokes = Q.w > .5 && Q.w < 2.5 ? 12. : 8.;
     float sa = abs(fract(a / 6.2832 * spokes + .5) - .5) / spokes * 6.2832 * r;
     float reach = Q.w > .5 && Q.w < 2.5 ? Q.z * .62 : Q.z * .8;
     float w = .09 * (1. - smoothstep(r0 * .3, reach, r)) + .02;
     float groove = (1. - smoothstep(w, w + .03, sa)) * step(r, reach) * step(.35, r);
     col = mix(col, col * .5, groove * .75);
     col *= 1. + (1. - smoothstep(w + .02, w + .08, sa)) * (1. - groove) * step(r, reach) * .12 * sign(dot(tg, uSun) * (fract(a / 6.2832 * spokes + .5) - .5));
     float ring = abs(r - r0) ; col = mix(col, col * .55, (1. - smoothstep(.05, .1, ring)));
     if (Q.w > .5 && Q.w < 2.5) { vec3 tc = Q.w < 1.5 ? uTeam[0] : uTeam[1]; float ib = 1. - smoothstep(.22, .3, abs(r - 15.9)); col = mix(col, tc * (.75 + .25 * vn(P * 3.)), ib * .85); }
     break;
   }
 }
 // 路上的不規則石板：遮罩決定哪幾塊在
 if (inPlaza < .5) {
   vec2 ci, cp, en; float e; vor(P, 2.3, ci, cp, e, en);
   vec2 mu = (cp + 130.) / 260.; float m = texture2D(uMask, vec2(mu.x, 1. - mu.y)).r;
   if (m > .35 + h21(ci + 1.3) * .5) col = slab(col, ci, e, en, P, 0.);
 }
 diffuseColor.rgb = col;
 float cliff = smoothstep(0.35, 0.7, vSlope);
 vec3 rockC = mix(vec3(0.42, 0.37, 0.31), vec3(0.58, 0.52, 0.44), dA.r) * (0.85 + 0.3 * dB.r);
 diffuseColor.rgb = mix(diffuseColor.rgb, rockC, cliff);`);
  };
  patchFog(gmat);
  gmat.customProgramCacheKey = () => 'ground-slabs-fog-' + quality;
  const ground = new THREE.Mesh(geo, gmat);
  ground.receiveShadow = true; group.add(ground);

  // 河水：岸邊漸淺、流動泡沫線、細碎反光；迷霧手動套用
  const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 12.4, 200, 1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uFog: fogUniforms.uFog, uFogOn: fogUniforms.uFogOn },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `varying vec2 vUv; varying vec3 vW; uniform float uTime; uniform sampler2D uFog; uniform float uFogOn;
      float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
      void main(){
        float e = abs(vUv.y-.5)*2.;
        float along = (vW.x + vW.z) * .7071, t = uTime;
        vec2 p = vec2(along, (vW.x - vW.z) * .7071);
        float r = n(p*.35 + vec2(t*.55, 0.))*.6 + n(p*.8 - vec2(t*.9, t*.2))*.4;
        vec3 deep = vec3(.07,.27,.33), mid = vec3(.15,.42,.45), shal = vec3(.38,.6,.52);
        vec3 c = mix(deep, mid, smoothstep(.0,.55,e + (r-.5)*.15));
        c = mix(c, shal, smoothstep(.55,.9,e));
        float flow = smoothstep(.66,.8, n(vec2(along*.22 - t*.7, p.y*1.6))) * (1. - e);
        c += vec3(.45,.7,.68) * flow * .16;
        float foamLine = smoothstep(.78,.86,e + (n(vec2(along*1.3 - t*.8, 3.))-.5)*.12) * (1. - smoothstep(.9,1.,e)*.35);
        float foam = foamLine * smoothstep(.35,.6, n(vec2(along*2. - t*1.5, e*6.)));
        c = mix(c, vec3(.9,.95,.9), foam*.85);
        float glint = smoothstep(.985,1., n(p*2.4 + vec2(t*1.1,-t*.4)) * n(p*3.7 - vec2(t*.5, t*.9)) * 1.75) * (1.-e);
        c += vec3(1.,.97,.85) * glint * .45;
        float vis = mix(1., texture2D(uFog, (vW.xz + 96.) / 192.).r, uFogOn);
        float l = dot(c, vec3(.3,.59,.11));
        c = mix(mix(vec3(l), c, .45) * vec3(.46,.5,.6), c, smoothstep(.05,.95,vis));
        gl_FragColor = vec4(c, mix(.8,.96,foam) * (1.-smoothstep(.96,1.,e)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  water.rotation.x = -Math.PI / 2; water.rotation.z = -Math.PI / 4; water.position.y = -0.32; water.renderOrder = 1;
  group.add(water);

  const props = buildProps(group, quality, { toon, mergeGeo });

  return { group, ground, water, groundCanvas: canvas, update(t) { water.material.uniforms.uTime.value = t; props.update(t); } };
}

function mergeGeo(list, keepNormals = false) {
  // 簡易合併（全部轉成非索引並串接 position/normal，若有 color 也一起）；keepNormals 保留來源的平滑法線
  let n = 0; const ni = list.map((g) => { const x = g.index ? g.toNonIndexed() : g; n += x.attributes.position.count; return x; });
  const hasCol = ni.every((g) => g.attributes.color);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), colr = hasCol ? new Float32Array(n * 3) : null; let o = 0;
  for (const g of ni) { if (!keepNormals || !g.attributes.normal) g.computeVertexNormals(); pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (colr) colr.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (colr) out.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  return out;
}
export { mergeGeo, toon, insideObstacle };
