// 視野（戰爭迷霧的規則面，不碰 DOM）：每隊一張 2 公尺格的可見格，每 0.2 秒重算。
// 樹叢與岩石擋住視線；草叢裡的格子只有站在同一叢裡、或貼身的敵人看得到；眼提供額外視野；
// 從暗處出手的單位會短暫現形。
import { OBSTACLES, BUSHES, bushAt } from './map.js';

export const VGRID = 96, VCELL = 2, VHALF = 96;
const R = { hero: 14, minion: 9, tower: 12, core: 14, ward: 10 };
const N = VGRID * VGRID;

// 擋視線的格（障礙物中心區）與每格所屬草叢
// （延後到第一次建立視野時才算，避開 map.js ↔ fog.js ↔ vision.js 的循環載入）
const block = new Uint8Array(N), bushCell = new Uint8Array(N);
let built = false;
function buildGrids() {
  built = true;
  for (let j = 0; j < VGRID; j++) for (let i = 0; i < VGRID; i++) {
    const x = i * VCELL - VHALF + 1, z = j * VCELL - VHALF + 1;
    for (const o of OBSTACLES) if (Math.hypot(x - o.x, z - o.z) < o.r - 0.4) { block[j * VGRID + i] = 1; break; }
    bushCell[j * VGRID + i] = bushAt(x, z);
  }
}

export function createVision() {
  if (!built) buildGrids();
  return { grids: [new Uint8Array(N), new Uint8Array(N)], t: 0, on: true };
}
// 格狀視線：從 (ci,cj) 走到 (ti,tj)，途中遇到擋視線格就看不到
function los(ci, cj, ti, tj) {
  let x = ci, y = cj; const dx = Math.abs(ti - ci), dy = Math.abs(tj - cj), sx = ci < ti ? 1 : -1, sy = cj < tj ? 1 : -1;
  let err = dx - dy;
  while (x !== ti || y !== tj) {
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
    if ((x !== ti || y !== tj) && block[y * VGRID + x]) return false;
  }
  return true;
}
function stamp(g, x, z, r) {
  const cx = (x + VHALF) / VCELL, cz = (z + VHALF) / VCELL, rc = r / VCELL;
  const ci = Math.min(VGRID - 1, Math.max(0, Math.floor(cx))), cj = Math.min(VGRID - 1, Math.max(0, Math.floor(cz)));
  const myBush = bushCell[cj * VGRID + ci];
  const x0 = Math.max(0, Math.floor(cx - rc)), x1 = Math.min(VGRID - 1, Math.ceil(cx + rc));
  const z0 = Math.max(0, Math.floor(cz - rc)), z1 = Math.min(VGRID - 1, Math.ceil(cz + rc));
  const r2 = rc * rc;
  for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) {
    const k = j * VGRID + i; if (g[k]) continue;
    const dx = i + 0.5 - cx, dz = j + 0.5 - cz, d2 = dx * dx + dz * dz;
    if (d2 > r2) continue;
    const b = bushCell[k];
    if (b && b !== myBush && d2 > 1.6) continue; // 草叢外看不進草叢
    if (d2 > 2 && !los(ci, cj, i, j)) continue;
    g[k] = 1;
  }
}
export function updateVision(G, dt) {
  const V = G.vision; V.t -= dt; if (V.t > 0) return; V.t = 0.2;
  for (const g of V.grids) g.fill(0);
  for (const u of G.units) {
    if (!u.alive || u.team > 1) continue;
    const r = (R[u.kind] || 8) + (u.kind === 'hero' ? u.visionBonus || 0 : 0);
    stamp(V.grids[u.team], u.x, u.z, r);
  }
}
const cellOf = (x, z) => { const i = Math.floor((x + VHALF) / VCELL), j = Math.floor((z + VHALF) / VCELL); return i < 0 || j < 0 || i >= VGRID || j >= VGRID ? -1 : j * VGRID + i; };
export function inBush(u) { const k = cellOf(u.x, u.z); return k >= 0 ? bushCell[k] : 0; }
// 某隊是否看得到這個單位（建築永遠可見；眼只有帶戰鬥力探測器的敵方英雄在附近才看得到）
export function seen(G, team, u) {
  if (!G.vision || !G.vision.on) return true;
  if (u.team === team || u.kind === 'tower' || u.kind === 'core') return true;
  if (u.kind === 'ward') return G.heroes.some((h) => h.alive && h.team === team && h.detect > 0 && Math.hypot(h.x - u.x, h.z - u.z) < 9);
  if (u.reveal > G.time) return true;
  const k = cellOf(u.x, u.z);
  return k >= 0 && G.vision.grids[team][k] === 1;
}
export const visionGrid = { block, bushCell };
