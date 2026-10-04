// 地圖：路線、塔位、障礙物、地面繪製、地形與植被。
import * as THREE from 'three';
import { MAP, BASE, FOUNTAIN, TEAM_COLOR, CAMPS } from './config.js';
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

// 障礙物（圓）：樹叢與岩石，避開路線、河道與基地
export const OBSTACLES = [];
{
  const R = rng(198);
  const ok = (x, z, r) => {
    if (Math.abs(x) > 86 - r || Math.abs(z) > 86 - r) return false;
    if (distToLanes(x, z) < 6.2 + r) return false;
    if (riverDist(x, z) < 6.5 + r) return false;
    for (const b of BASE) if (Math.hypot(x - b[0], z - b[1]) < 24 + r) return false;
    for (const c of CAMPS) if (Math.hypot(x - c.x, z - c.z) < (c.boss ? 11 : 7.5) + r) return false;
    for (const o of OBSTACLES) if (Math.hypot(x - o.x, z - o.z) < o.r + r + 3.2) return false;
    return true;
  };
  for (let gx = -84; gx <= 84; gx += 5) for (let gz = -84; gz <= 84; gz += 5) {
    const x = gx + (R() - 0.5) * 4, z = gz + (R() - 0.5) * 4, r = 1.6 + R() * 2.8;
    if (R() < 0.82 && ok(x, z, r)) OBSTACLES.push({ x, z, r, kind: R() < 0.72 ? 'trees' : 'rock', seed: (R() * 1e6) | 0 });
  }
}

// 把圓推出障礙物與地圖邊界；回傳是否有碰撞
export function collide(p, radius) {
  let hit = false;
  for (const o of OBSTACLES) {
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
  for (const o of OBSTACLES) if (distToSeg(o.x, o.z, { x: ax, z: az }, { x: bx, z: bz }) < o.r + pad) return true;
  return false;
}
export function walkable(x, z, radius) { const p = { x, z }; return !collide(p, radius); }

/* ---------------- 地面貼圖 ---------------- */
const TEX_HALF = 130;
let TEX_PX = 2048;
const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
function insideObstacle(x, z, pad = 0) { for (const o of OBSTACLES) if (Math.hypot(x - o.x, z - o.z) < o.r + pad) return true; return false; }

function paintGround() {
  const c = document.createElement('canvas'); c.width = c.height = TEX_PX;
  const g = c.getContext('2d'), R = rng(7);
  const S = TEX_PX / (TEX_HALF * 2);
  const X = (x) => (x + TEX_HALF) * S, Z = (z) => (z + TEX_HALF) * S;
  const blob = (x, z, r, inner, outer) => { const gr = g.createRadialGradient(X(x), Z(z), 0, X(x), Z(z), r * S); gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.beginPath(); g.arc(X(x), Z(z), r * S, 0, Math.PI * 2); g.fill(); };
  g.fillStyle = '#5c9a3b'; g.fillRect(0, 0, TEX_PX, TEX_PX);
  // 大面積的草地色塊（暖黃綠草甸／冷綠樹蔭），讓地面有低頻起伏
  for (let i = 0; i < 260; i++) {
    const x = (R() * 2 - 1) * TEX_HALF, z = (R() * 2 - 1) * TEX_HALF, r = 8 + R() * 22;
    const warm = R() < 0.5;
    blob(x, z, r, warm ? 'rgba(150,170,70,.22)' : 'rgba(40,95,50,.22)', 'rgba(0,0,0,0)');
  }
  // 草地筆觸：野區偏深、路邊偏亮
  for (let i = 0; i < (TEX_PX > 2048 ? 42000 : 22000); i++) {
    const x = (R() * 2 - 1) * TEX_HALF, z = (R() * 2 - 1) * TEX_HALF;
    const dl = distToLanes(x, z), edge = Math.max(Math.abs(x), Math.abs(z));
    const jungle = ss(8, 22, dl), out = ss(90, 98, edge);
    const h = 92 + (R() - 0.5) * 22 - jungle * 8 + out * 10, s = 46 + R() * 16 - jungle * 4, l = 40 + (R() - 0.5) * 10 - jungle * 9 - out * 8;
    g.fillStyle = `hsla(${h},${s}%,${l}%,${0.3 + R() * 0.35})`;
    g.save(); g.translate(X(x), Z(z)); g.rotate(R() * Math.PI);
    g.beginPath(); g.ellipse(0, 0, (0.8 + R() * 2.4) * S, (0.3 + R() * 0.8) * S, 0, 0, Math.PI * 2); g.fill(); g.restore();
  }
  // 外圍岩壁帶與台地林床
  for (let i = 0; i < 9000; i++) {
    const x = (R() * 2 - 1) * TEX_HALF, z = (R() * 2 - 1) * TEX_HALF, e = Math.max(Math.abs(x), Math.abs(z));
    if (e < 90 || riverDist(x, z) < 8) continue;
    const cliff = e < 97;
    g.fillStyle = cliff ? `hsla(${28 + R() * 12},${12 + R() * 10}%,${36 + R() * 14}%,.7)` : `hsla(${100 + R() * 30},${30 + R() * 15}%,${22 + R() * 10}%,.55)`;
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
      for (let k = 0; k < 2; k++) {
        g.strokeStyle = k ? 'rgba(176,150,98,.38)' : 'rgba(120,120,60,.25)'; g.lineWidth = (k ? 2.2 : 3.6) * S;
        g.beginPath(); g.moveTo(X(best.x), Z(best.z));
        const mx = (best.x + cp.x) / 2 + (R() - 0.5) * 8, mz = (best.z + cp.z) / 2 + (R() - 0.5) * 8;
        g.quadraticCurveTo(X(mx), Z(mz), X(cp.x), Z(cp.z)); g.stroke();
      }
    }
  }
  // 障礙物底下的環境遮蔽
  for (const o of OBSTACLES) blob(o.x + 0.6, o.z - 0.4, o.r * 1.7 + 1.2, 'rgba(18,36,14,.55)', 'rgba(18,36,14,0)');
  // 河岸：沙、濕泥、河床
  const band = (w, col) => {
    g.strokeStyle = col; g.lineWidth = w * S * 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(X(-TEX_HALF), Z(-TEX_HALF)); g.lineTo(X(TEX_HALF), Z(TEX_HALF)); g.stroke();
  };
  band(10.2, 'rgba(120,140,70,.45)'); band(9.3, '#cdb67d'); band(7.8, '#a69466'); band(7.0, '#6f7f55'); band(6.4, '#3d6a66');
  for (let i = 0; i < 2600; i++) { // 河岸卵石
    const t = (R() * 2 - 1) * TEX_HALF * 1.3, side = R() < 0.5 ? -1 : 1, off = (6.6 + R() * 2.8) * side;
    const x = t / Math.SQRT2 + off / Math.SQRT2, z = t / Math.SQRT2 - off / Math.SQRT2;
    g.fillStyle = `hsl(${30 + R() * 14},${10 + R() * 12}%,${58 + R() * 18}%)`;
    g.beginPath(); g.ellipse(X(x), Z(z), (0.12 + R() * 0.25) * S, (0.08 + R() * 0.16) * S, R() * 3, 0, Math.PI * 2); g.fill();
  }
  // 路線：外緣草被踩禿、深色邊、泥土層
  const lanes = (w, col, jit, n = 1) => {
    for (let k = 0; k < n; k++) for (const p of LANES) {
      g.strokeStyle = col; g.lineWidth = (w + (R() - 0.5) * jit) * S;
      g.beginPath(); p.forEach((q, i) => (i ? g.lineTo : g.moveTo).call(g, X(q.x + (R() - 0.5) * jit), Z(q.z + (R() - 0.5) * jit))); g.stroke();
    }
  };
  lanes(15, 'rgba(150,160,80,.35)', 2.5, 2);
  lanes(12, 'rgba(110,120,58,.5)', 1.5, 2);
  lanes(11, 'rgba(92,70,40,.55)', 0.8, 1);
  lanes(10.2, '#b8955c', 1.0, 1);
  lanes(9, '#c9a76a', 1.4, 2);
  lanes(5, 'rgba(214,186,128,.45)', 2.5, 2);
  // 路面石板與邊緣碎石
  for (const p of LANES) {
    const L = polyLen(p);
    for (let d = 0; d < L; d += 0.9) {
      const q = pointAlong(p, d), q2 = pointAlong(p, d + 0.5), dx = q2.x - q.x, dz = q2.z - q.z, l = Math.hypot(dx, dz) || 1;
      for (let k = 0; k < 4; k++) {
        if (R() < 0.5) continue;
        const ox = (R() - 0.5) * 7.5, oz = (R() - 0.5) * 7.5, s = 0.32 + R() * 0.42;
        g.fillStyle = `hsl(${34 + R() * 10},${20 + R() * 12}%,${58 + R() * 10}%)`;
        g.strokeStyle = 'rgba(90,66,38,.35)'; g.lineWidth = 0.08 * S;
        g.save(); g.translate(X(q.x + ox), Z(q.z + oz)); g.rotate(R() * 3);
        g.beginPath(); for (let v = 0; v < 5; v++) { const a = (v / 5) * Math.PI * 2, rr = s * (0.75 + R() * 0.4) * S; (v ? g.lineTo : g.moveTo).call(g, Math.cos(a) * rr, Math.sin(a) * rr); }
        g.closePath(); g.fill(); g.stroke(); g.restore();
      }
      for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
        const off = (4.6 + R() * 1.4) * side, along = (R() - 0.5) * 0.9;
        const x = q.x - (dz / l) * off + (dx / l) * along, z = q.z + (dx / l) * off + (dz / l) * along;
        g.fillStyle = `hsla(${32 + R() * 10},${14 + R() * 10}%,${R() < 0.5 ? 34 + R() * 10 : 62 + R() * 12}%,.85)`;
        g.beginPath(); g.ellipse(X(x), Z(z), (0.08 + R() * 0.16) * S, (0.06 + R() * 0.1) * S, R() * 3, 0, Math.PI * 2); g.fill();
      }
    }
  }
  // 基地：石砌平台與隊伍色紋
  BASE.forEach((b, team) => {
    const cx = X(b[0]), cz = Z(b[1]);
    blob(b[0], b[1], 27, 'rgba(40,36,24,.35)', 'rgba(40,36,24,0)');
    g.fillStyle = '#b3a487'; g.beginPath(); g.arc(cx, cz, 23.4 * S, 0, Math.PI * 2); g.fill();
    for (let ring = 0; ring < 7; ring++) {
      const r0 = (4 + ring * 2.9) * S, n = 10 + ring * 7;
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * Math.PI * 2 + ring * 0.3, a1 = ((k + 0.92) / n) * Math.PI * 2 + ring * 0.3;
        g.fillStyle = `hsl(${38 + R() * 8},${14 + R() * 10}%,${64 + R() * 12}%)`;
        g.beginPath(); g.arc(cx, cz, r0 + 2.7 * S, a0, a1); g.arc(cx, cz, r0, a1, a0, true); g.closePath(); g.fill();
        if (R() < 0.25) { g.fillStyle = 'rgba(90,110,60,.35)'; g.beginPath(); g.arc(cx + Math.cos(a1) * (r0 + 1.35 * S), cz + Math.sin(a1) * (r0 + 1.35 * S), 0.35 * S, 0, Math.PI * 2); g.fill(); }
      }
    }
    g.strokeStyle = TEAM_COLOR[team]; g.globalAlpha = 0.75; g.lineWidth = 0.7 * S;
    g.beginPath(); g.arc(cx, cz, 15.6 * S, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 0.35 * S; g.beginPath(); g.arc(cx, cz, 17 * S, 0, Math.PI * 2); g.stroke();
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * 15.6 * S, cz + Math.sin(a) * 15.6 * S); g.lineTo(cx + Math.cos(a + 0.12) * 17 * S, cz + Math.sin(a + 0.12) * 17 * S); g.stroke(); }
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(80,66,44,.6)'; g.lineWidth = 0.4 * S; g.beginPath(); g.arc(cx, cz, 23.2 * S, 0, Math.PI * 2); g.stroke();
    const f = FOUNTAIN[team];
    g.fillStyle = '#d7cfb9'; g.beginPath(); g.arc(X(f[0]), Z(f[1]), 6 * S, 0, Math.PI * 2); g.fill();
  });
  // 野怪營地：踩平的泥地與一圈平石；大猿的河中石場
  for (const cp of CAMPS) {
    const R0 = cp.boss ? 9.5 : 5;
    blob(cp.x, cp.z, R0 + 2.5, 'rgba(60,48,26,.45)', 'rgba(60,48,26,0)');
    if (!cp.boss) { blob(cp.x, cp.z, R0, 'rgba(150,124,82,.9)', 'rgba(150,124,82,.35)'); }
    else { blob(cp.x, cp.z, R0 + 0.5, 'rgba(196,176,128,.95)', 'rgba(170,150,104,.6)'); blob(cp.x, cp.z, R0 - 3.2, 'rgba(110,118,96,.7)', 'rgba(110,118,96,0)'); }
    const n = cp.boss ? 34 : 16;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + R() * 0.1, rr = R0 + (R() - 0.5) * 0.4, sz = (cp.boss ? 0.9 : 0.55) + R() * 0.3;
      g.fillStyle = `hsl(${32 + R() * 10},${10 + R() * 10}%,${54 + R() * 14}%)`; g.strokeStyle = 'rgba(60,48,30,.5)'; g.lineWidth = 0.1 * S;
      g.save(); g.translate(X(cp.x + Math.cos(a) * rr), Z(cp.z + Math.sin(a) * rr)); g.rotate(a);
      g.beginPath(); g.ellipse(0, 0, sz * S, sz * 0.62 * S, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore();
    }
    for (let k = 0; k < (cp.boss ? 120 : 40); k++) { // 爪痕、碎石
      const a = R() * 6.28, d = Math.sqrt(R()) * R0 * 0.9;
      g.fillStyle = `rgba(${70 + R() * 40},${58 + R() * 30},${38 + R() * 20},.5)`;
      g.fillRect(X(cp.x + Math.cos(a) * d), Z(cp.z + Math.sin(a) * d), (0.1 + R() * 0.3) * S, (0.1 + R() * 0.15) * S);
    }
  }
  // 草點與成簇的小花
  for (let i = 0; i < (TEX_PX > 2048 ? 16000 : 8000); i++) {
    const x = (R() * 2 - 1) * TEX_HALF, z = (R() * 2 - 1) * TEX_HALF;
    if (distToLanes(x, z) < 5.6 || riverDist(x, z) < 6 || BASE.some((b) => Math.hypot(x - b[0], z - b[1]) < 24)) continue;
    g.fillStyle = `hsla(${78 + R() * 34},55%,${48 + R() * 18}%,.7)`;
    g.fillRect(X(x), Z(z), 0.1 * S, (0.3 + R() * 0.35) * S);
  }
  const FLOWER = ['#f4e7b0', '#f2b8a0', '#fff6e0', '#f6d36a', '#e9a6c0'];
  for (let i = 0; i < 520; i++) {
    const cx = (R() * 2 - 1) * 88, cz = (R() * 2 - 1) * 88;
    if (distToLanes(cx, cz) < 6.5 || riverDist(cx, cz) < 7 || insideObstacle(cx, cz, 0.3) || BASE.some((b) => Math.hypot(cx - b[0], cz - b[1]) < 25)) continue;
    const colr = FLOWER[(R() * FLOWER.length) | 0], n = 6 + ((R() * 14) | 0);
    for (let k = 0; k < n; k++) {
      const a = R() * 6.28, d = R() * 1.6;
      g.fillStyle = colr; g.beginPath(); g.arc(X(cx + Math.cos(a) * d), Z(cz + Math.sin(a) * d), (0.1 + R() * 0.08) * S, 0, Math.PI * 2); g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { tex, canvas: c };
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
  const { tex, canvas } = paintGround();
  // 地面
  const seg = quality > 0 ? 260 : 150;
  const geo = new THREE.PlaneGeometry(TEX_HALF * 2, TEX_HALF * 2, seg, seg); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const gmat = new THREE.MeshLambertMaterial({ map: tex });
  // 細節雜訊：以世界座標平鋪，放大時地面不會糊成一片；陡坡（岩壁）改成岩石色
  const detail = detailTexture();
  gmat.onBeforeCompile = (sh) => {
    sh.uniforms.uDetail = { value: detail };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWxz; varying float vSlope;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWxz = (modelMatrix * vec4(transformed, 1.0)).xz; vSlope = 1.0 - normal.y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uDetail; varying vec2 vWxz; varying float vSlope;')
      .replace('#include <map_fragment>', `#include <map_fragment>
 vec4 dA = texture2D(uDetail, vWxz * 0.19), dB = texture2D(uDetail, vWxz * 0.047 + 0.37), dC = texture2D(uDetail, vWxz * 0.9);
 diffuseColor.rgb *= 0.8 + 0.26 * dA.r + 0.14 * dB.r;
 float grassy = smoothstep(0.02, 0.12, diffuseColor.g - diffuseColor.r);
 diffuseColor.rgb *= 1.0 + (dC.g - 0.5) * 0.16 * grassy;
 float cliff = smoothstep(0.35, 0.7, vSlope);
 vec3 rockC = mix(vec3(0.42, 0.37, 0.31), vec3(0.58, 0.52, 0.44), dA.r) * (0.85 + 0.3 * dB.r);
 diffuseColor.rgb = mix(diffuseColor.rgb, rockC, cliff);`);
  };
  patchFog(gmat);
  gmat.customProgramCacheKey = () => 'ground-detail-fog';
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

function mergeGeo(list) {
  // 簡易合併（全部轉成非索引並串接 position/normal，若有 color 也一起）
  let n = 0; const ni = list.map((g) => { const x = g.index ? g.toNonIndexed() : g; n += x.attributes.position.count; return x; });
  const hasCol = ni.every((g) => g.attributes.color);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), colr = hasCol ? new Float32Array(n * 3) : null; let o = 0;
  for (const g of ni) { g.computeVertexNormals(); pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (colr) colr.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (colr) out.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  return out;
}
export { mergeGeo, toon, insideObstacle };
