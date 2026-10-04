// 視野（戰爭迷霧的規則面，不碰 DOM）：每隊一張 2 公尺格的可見格，每 0.2 秒重算。
export const VGRID = 96, VCELL = 2, VHALF = 96;
const R = { hero: 14, minion: 9, tower: 12, core: 14, ward: 10 };

export function createVision() {
  return { grids: [new Uint8Array(VGRID * VGRID), new Uint8Array(VGRID * VGRID)], t: 0, on: true };
}
function stamp(g, x, z, r) {
  const cx = (x + VHALF) / VCELL, cz = (z + VHALF) / VCELL, rc = r / VCELL;
  const x0 = Math.max(0, Math.floor(cx - rc)), x1 = Math.min(VGRID - 1, Math.ceil(cx + rc));
  const z0 = Math.max(0, Math.floor(cz - rc)), z1 = Math.min(VGRID - 1, Math.ceil(cz + rc));
  const r2 = rc * rc;
  for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) { const dx = i + 0.5 - cx, dz = j + 0.5 - cz; if (dx * dx + dz * dz <= r2) g[j * VGRID + i] = 1; }
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
// 某隊是否看得到這個位置／單位（建築永遠可見）
export function seen(G, team, u) {
  if (!G.vision || !G.vision.on) return true;
  if (u.team === team || u.kind === 'tower' || u.kind === 'core') return true;
  const i = Math.floor((u.x + VHALF) / VCELL), j = Math.floor((u.z + VHALF) / VCELL);
  if (i < 0 || j < 0 || i >= VGRID || j >= VGRID) return false;
  return G.vision.grids[team][j * VGRID + i] === 1;
}
