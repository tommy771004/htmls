// 分區配置（plans/260-irregular-city.md 第二輪）：15 片、各片的剛體變換與彎曲（warp）、整座城的外緣、拿掉的街區。
//   node tools/check-zones.mjs           檢查（縫寬、反算精度、Jacobian、實體建築街區）並輸出預覽 dist/zones.svg
//   node tools/check-zones.mjs --write   另外寫出 src/parts/04-layout.js（遊戲讀這份，不在執行時排版）
// 座標：北 = −z。剛體和 05-zones.js 一樣 X = ox + x·c + z·s、Z = oz − x·s + z·c；彎曲在邏輯座標裡先做（見 warpL）。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const P = 72, Q = 62, HR = 8, NX = 20, NZ = 15, X0 = -180, Z0 = -155, OUT_D = 50;
const avX = i => X0 + i * P, stZ = j => Z0 + j * Q;
const CITY_X0 = avX(0) - HR, CITY_X1 = avX(NX) + HR, CITY_Z0 = stZ(0) - HR, CITY_Z1 = stZ(NZ) + HR, SHORE_Z = CITY_Z1 + OUT_D, QUAY_Z1 = SHORE_Z + 110;
const DEG = Math.PI / 180;

// 第一版同意的八區（ry 度、邏輯左上角錨點到世界）
const MACRO = {
  A: { ry: 0, wx: avX(0), wz: stZ(0), i0: 0, j0: 0 }, B: { ry: 22, wx: 466, wz: -175, i0: 8, j0: 0 }, C: { ry: -12, wx: 1085, wz: -105, i0: 13, j0: 0 },
  D: { ry: -22, wx: -212, wz: 326, i0: 0, j0: 7 }, E: { ry: 4, wx: 448, wz: 352, i0: 8, j0: 7 }, F: { ry: -18, wx: 952, wz: 372, i0: 13, j0: 7 },
  G: { ry: -34, wx: -262, wz: 636, i0: 0, j0: 11 }, H: { ry: -6, wx: 452, wz: 690, i0: 10, j0: 11 },
};
// 片：所屬的區、路口範圍、相對區的角度差 dr、彎曲強度 bend（0～1）
export const SUBS = [
  { key: 'A1', m: 'A', ni: [0, 5], nj: [0, 7], dr: 0, bend: .45, fixed: true, name: '舊城' },
  { key: 'A2', m: 'A', ni: [5, 8], nj: [0, 7], dr: 7, bend: .8, name: '冠石' },
  { key: 'B1', m: 'B', ni: [8, 13], nj: [0, 4], dr: 4, bend: 1, name: '光環北' },
  { key: 'B2', m: 'B', ni: [8, 13], nj: [4, 7], dr: -6, bend: 1, name: '光環南' },
  { key: 'C1', m: 'C', ni: [13, 17], nj: [0, 7], dr: 5, bend: 1, name: '灰石西' },
  { key: 'C2', m: 'C', ni: [17, 20], nj: [0, 7], dr: -9, bend: 1, name: '灰石東' },
  { key: 'D1', m: 'D', ni: [0, 4], nj: [7, 11], dr: 8, bend: 1, name: '楓林西' },
  { key: 'D2', m: 'D', ni: [4, 8], nj: [7, 11], dr: -6, bend: 1, name: '楓林東' },
  { key: 'E', m: 'E', ni: [8, 13], nj: [7, 11], dr: 0, bend: 1, name: '公園大道' },
  { key: 'F1', m: 'F', ni: [13, 17], nj: [7, 11], dr: 6, bend: 1, name: '琥珀西' },
  { key: 'F2', m: 'F', ni: [17, 20], nj: [7, 11], dr: -10, bend: 1, name: '琥珀東' },
  { key: 'G1', m: 'G', ni: [0, 5], nj: [11, 15], dr: 9, bend: .8, name: '珊瑚灘北' },
  { key: 'G2', m: 'G', ni: [5, 10], nj: [11, 15], dr: -5, bend: .8, name: '珊瑚灘南' },
  { key: 'H1', m: 'H', ni: [10, 15], nj: [11, 15], dr: 5, bend: .7, name: '錨灣西' },
  { key: 'H2', m: 'H', ni: [15, 20], nj: [11, 15], dr: -8, bend: .6, name: '錨灣東' },
];
// 快速道路經過的縫要寬一點
const WIDE = new Set(['A2/B1', 'A2/B2', 'B2/E', 'D2/E', 'G2/H1', 'C1/F1', 'E/F1', 'D2/G2']);
const GAP = 34, GAP_WIDE = 64;

// ── 彎曲：邏輯座標裡的平滑位移（和 05-zones.js 的 warpL 同一個公式），城外 160 m 內漸漸收掉 ──
// w = 1 + ½·sin…：dx = ax·sin(kz·z + p0) + sx·sin(kx·x + p1)；dz = az·sin(kx2·x + p2) + sz·sin(kz2·z + p3)
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function warpParams(u, n) {
  const Lx = avX(u.ni[1]) - avX(u.ni[0]), Lz = stZ(u.nj[1]) - stZ(u.nj[0]), b = u.bend;
  const lam = Math.min(900, Math.max(420, 1.2 * Math.max(Lx, Lz))), k = 2 * Math.PI / lam;
  const mx = 2 * Math.PI / (0.9 * Lx + 240), mz = 2 * Math.PI / (0.9 * Lz + 240);
  return {
    ax: b * .15 / k, kz: k, p0: hash(n * 4 + 1) * 6.283,         // 大道（沿 z）左右彎：斜率最多 ±0.2
    az: b * .14 / k, kx2: k * 1.13, p2: hash(n * 4 + 2) * 6.283,  // 街（沿 x）上下彎
    sx: b * .12 / mx, kx: mx, p1: hash(n * 4 + 3) * 6.283,        // 東西向的街區寬度忽寬忽窄 ±15%
    sz: b * .1 / mz, kz2: mz, p3: hash(n * 4 + 4) * 6.283,       // 南北向 ±12%
    // 扇形：大道往一端散開、街往一端收攏（直線但不平行），斜率最多 ±0.16（除以長邊的一半，兩個方向的導數都不超過 fa、fb）
    xc: (avX(u.ni[0]) + avX(u.ni[1])) / 2, zc: (stZ(u.nj[0]) + stZ(u.nj[1])) / 2, hm: Math.max(Lx, Lz) / 2,
    fa: b * .16 * (hash(n * 4 + 5) > .5 ? 1 : -1), fb: b * .14 * (hash(n * 4 + 6) > .5 ? 1 : -1),
  };
}
const TAPER = 160;
const smooth01 = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
// 城外的距離（邏輯座標，城市外框連外側步道、沙灘、碼頭）
const outD = (x, z) => Math.max(CITY_X0 - OUT_D - x, x - CITY_X1 - OUT_D, CITY_Z0 - OUT_D - z, z - QUAY_Z1, 0);
// 回傳 [x', z', j00, j01, j10, j11]（j 是 ∂(x', z')/∂(x, z)）
function warpJ(W, x, z) {
  const d = outD(x, z), t = 1 - smooth01(d / TAPER);
  const s0 = Math.sin(W.kz * z + W.p0), c0 = Math.cos(W.kz * z + W.p0), s1 = Math.sin(W.kx * x + W.p1), c1 = Math.cos(W.kx * x + W.p1);
  const s2 = Math.sin(W.kx2 * x + W.p2), c2 = Math.cos(W.kx2 * x + W.p2), s3 = Math.sin(W.kz2 * z + W.p3), c3 = Math.cos(W.kz2 * z + W.p3);
  const ux = x - W.xc, uz = z - W.zc;
  const dx = W.ax * s0 + W.sx * s1 + W.fa * ux * uz / W.hm, dz = W.az * s2 + W.sz * s3 + W.fb * ux * uz / W.hm;
  // 漸收的導數（數值，城外才有，用不到精確）
  let tx = 0, tz = 0;
  if (d > 0 && d < TAPER) { const e = .5; tx = ((1 - smooth01(outD(x + e, z) / TAPER)) - (1 - smooth01(outD(x - e, z) / TAPER))) / (2 * e); tz = ((1 - smooth01(outD(x, z + e) / TAPER)) - (1 - smooth01(outD(x, z - e) / TAPER))) / (2 * e); }
  return [x + dx * t, z + dz * t,
    1 + (W.sx * W.kx * c1 + W.fa * uz / W.hm) * t + dx * tx, (W.ax * W.kz * c0 + W.fa * ux / W.hm) * t + dx * tz,
    (W.az * W.kx2 * c2 + W.fb * uz / W.hm) * t + dz * tx, 1 + (W.sz * W.kz2 * c3 + W.fb * ux / W.hm) * t + dz * tz];
}
// 反算：給彎曲後的 (u, v) 求原本的 (x, z)（牛頓法）
function unwarp(W, u, v) {
  let x = u, z = v;
  for (let it = 0; it < 6; it++) {
    const [wx, wz, a, b, c, d] = warpJ(W, x, z), ex = wx - u, ez = wz - v;
    if (ex * ex + ez * ez < 1e-8) break;
    const det = a * d - b * c; x -= (d * ex - b * ez) / det; z -= (-c * ex + a * ez) / det;
  }
  return [x, z];
}

// ── 每片的變換 ──
const S = SUBS.map((u, n) => {
  const M = MACRO[u.m], mc = Math.cos(M.ry * DEG), ms = Math.sin(M.ry * DEG), x0 = avX(M.i0), z0 = stZ(M.j0);
  const mox = M.wx - (x0 * mc + z0 * ms), moz = M.wz - (-x0 * ms + z0 * mc);
  const lx0 = avX(u.ni[0]), lx1 = avX(u.ni[1]), lz0 = stZ(u.nj[0]), lz1 = stZ(u.nj[1]), lc = [(lx0 + lx1) / 2, (lz0 + lz1) / 2];
  const wc = [mox + lc[0] * mc + lc[1] * ms, moz - lc[0] * ms + lc[1] * mc];
  return { ...u, n, lx0, lx1, lz0, lz1, lc, wc, ry: M.ry + u.dr, W: warpParams(u, n) };
});
const place = u => {
  const c = Math.cos(u.ry * DEG), s = Math.sin(u.ry * DEG), [wx, wz] = warpJ(u.W, ...u.lc);
  // 片的中心（彎曲後）擺到 wc
  u.c = c; u.s = s; u.ox = u.wc[0] - (wx * c + wz * s); u.oz = u.wc[1] - (-wx * s + wz * c);
};
const toW = (u, x, z) => { const [a, b] = warpJ(u.W, x, z); return [u.ox + a * u.c + b * u.s, u.oz - a * u.s + b * u.c]; };
const toL = (u, X, Z) => { const dx = X - u.ox, dz = Z - u.oz; return unwarp(u.W, dx * u.c - dz * u.s, dx * u.s + dz * u.c); };
// 陸地外框（含外側步道、沙灘、碼頭）沿邊取樣成多邊形
const landRect = u => [u.ni[0] === 0 ? CITY_X0 - OUT_D : u.lx0 - HR, u.ni[1] === NX ? CITY_X1 + OUT_D : u.lx1 + HR, u.nj[0] === 0 ? CITY_Z0 - 30 : u.lz0 - HR, u.nj[1] === NZ ? (u.m === 'H' ? QUAY_Z1 : SHORE_Z + 58) : u.lz1 + HR];
function outline(u, [x0, x1, z0, z1], step = 24) {
  const pts = [], seg = (ax, az, bx, bz) => { const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step)); for (let k = 0; k < n; k++) pts.push(toW(u, ax + (bx - ax) * k / n, az + (bz - az) * k / n)); };
  seg(x0, z0, x1, z0); seg(x1, z0, x1, z1); seg(x1, z1, x0, z1); seg(x0, z1, x0, z0);
  return pts;
}
const landOf = u => outline(u, landRect(u));
// 岸線：南面只算到濱海步道外緣（沙灘與碼頭不算）；外緣在河與海那一側就是這條線（不往裡縮，棧橋與碼頭才接得上），縫裡的草地才不會蓋住沙灘
const shoreOf = u => { const r = landRect(u); if (u.nj[1] === NZ) r[3] = SHORE_Z; return outline(u, r); };

// ── 幾何 ──
const segDist = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t); };
const inPoly = (Pg, x, z) => { let c = false; for (let k = 0, m = Pg.length - 1; k < Pg.length; m = k++) { const [ax, az] = Pg[k], [bx, bz] = Pg[m]; if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) c = !c; } return c; };
const segX = (p, q, r, s) => { const d1x = q[0] - p[0], d1z = q[1] - p[1], d2x = s[0] - r[0], d2z = s[1] - r[1], den = d1x * d2z - d1z * d2x; if (Math.abs(den) < 1e-9) return false; const t = ((r[0] - p[0]) * d2z - (r[1] - p[1]) * d2x) / den, u = ((r[0] - p[0]) * d1z - (r[1] - p[1]) * d1x) / den; return t > 0 && t < 1 && u > 0 && u < 1; };
const bbox = A => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of A) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } return [x0, x1, z0, z1]; };
function polyDist(A, B) {
  const a = bbox(A), b = bbox(B), gap = Math.max(a[0] - b[1], b[0] - a[1], a[2] - b[3], b[2] - a[3]);
  if (gap > 200) return gap;
  for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) if (segX(A[i], A[(i + 1) % A.length], B[j], B[(j + 1) % B.length])) return -1;
  if (inPoly(B, ...A[0]) || inPoly(A, ...B[0])) return -1;
  let d = 1e9; for (const p of A) for (let j = 0; j < B.length; j++) d = Math.min(d, segDist(p, B[j], B[(j + 1) % B.length]));
  for (const p of B) for (let j = 0; j < A.length; j++) d = Math.min(d, segDist(p, A[j], A[(j + 1) % A.length]));
  return d;
}
const adj = (a, b) => (a.ni[1] === b.ni[0] || b.ni[1] === a.ni[0]) && Math.max(a.nj[0], b.nj[0]) < Math.min(a.nj[1], b.nj[1]) || (a.nj[1] === b.nj[0] || b.nj[1] === a.nj[0]) && Math.max(a.ni[0], b.ni[0]) < Math.min(a.ni[1], b.ni[1]);
const want = (a, b) => WIDE.has(a.key + '/' + b.key) || WIDE.has(b.key + '/' + a.key) ? GAP_WIDE : GAP;

// ── 擺放：先照區的變換，再把相鄰的片拉到目標縫寬（太近推開、太遠拉近），不相鄰的不能小於 32 m ──
for (const u of S) { place(u); u.home = [...u.wc]; u.L = landOf(u); }
const sep = (a, b, st) => {
  let vx = b.wc[0] - a.wc[0], vz = b.wc[1] - a.wc[1]; const l = Math.hypot(vx, vz); vx /= l; vz /= l;
  const fa = a.fixed ? 0 : b.fixed ? 2 : 1, fb = b.fixed ? 0 : a.fixed ? 2 : 1;
  if (fa) { a.wc = [a.wc[0] - vx * st * fa, a.wc[1] - vz * st * fa]; place(a); a.L = landOf(a); }
  if (fb) { b.wc = [b.wc[0] + vx * st * fb, b.wc[1] + vz * st * fb]; place(b); b.L = landOf(b); }
};
for (let it = 0; it < 700; it++) {
  for (const a of S) for (const b of S) {
    if (a.n >= b.n) continue;
    const d = polyDist(a.L, b.L);
    if (adj(a, b)) { const w = want(a, b), e = d < 0 ? -20 : d - w; if (Math.abs(e) > 3 && (it < 520 || e < 0)) sep(a, b, Math.max(-6, Math.min(6, -e * .25))); }
    else if (d < 32) sep(a, b, 3);
  }
  if (it < 520) for (const u of S) if (!u.fixed) { u.wc = [u.wc[0] + (u.home[0] - u.wc[0]) * .008, u.wc[1] + (u.home[1] - u.wc[1]) * .008]; place(u); u.L = landOf(u); }
}

// ── 整座城的外緣：從中心每 2° 量到各片陸地的最遠處；北、東靠山那一側用低頻起伏往內咬，河與海那一側（南～西）照岸線 ──
const ctr = S.reduce((a, u) => [a[0] + u.wc[0] / S.length, a[1] + u.wc[1] / S.length], [0, 0]);
const rayHit = (th, poly) => { const dx = Math.cos(th), dz = Math.sin(th); let best = 0; for (let k = 0; k < poly.length; k++) { const p = poly[k], q = poly[(k + 1) % poly.length], ex = q[0] - p[0], ez = q[1] - p[1], den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue; const t = ((p[0] - ctr[0]) * ez - (p[1] - ctr[1]) * ex) / den, u2 = ((p[0] - ctr[0]) * dz - (p[1] - ctr[1]) * dx) / den; if (t > 0 && u2 >= 0 && u2 <= 1) best = Math.max(best, t); } return best; };
const PLAN_CELLS = [[6, 2], [6, 1], [5, 1], [7, 1], [5, 2], [7, 2], [6, 3], [5, 0], [6, 0], [7, 3], [5, 3], ...Array.from({ length: 14 }, (_, k) => [9 + k % 4, 1 + Math.floor(k / 4)]),
  [11, 4], [12, 4], [9, 5], [15, 2], [18, 1], [16, 5], [19, 4], [14, 6], [1, 8], [5, 7], [3, 10], [7, 9], [8, 7], [12, 10], [9, 0], [10, 0], [11, 0], [12, 0], [10, 5], [11, 5], [12, 5],
  [9, 6], [10, 6], [11, 6], [12, 6], [5, 4], [6, 4], [7, 4], [10, 7], [9, 7], [9, 10], [11, 10], [17, 9], [14, 1], [17, 4], [19, 6], [16, 0], [18, 3], [13, 4]];
const coastAng = a => a >= 30 && a <= 235;   // z 朝南：90° 正南、180° 正西
const A1 = S.find(u => u.key === "A1"), CORE_PTS = [];
for (let i = 0; i <= 5; i++) for (let j = 0; j <= 5; j++) CORE_PTS.push(toW(A1, avX(i), stZ(j)));
// 實體建築街區（wholeBlocks 的 PLAN）也一定在外緣裡：它們的四角加進必含的點
const subOf = (i, j) => S.find(u => i >= u.ni[0] && i < u.ni[1] && j >= u.nj[0] && j < u.nj[1]);
for (const [i, j] of PLAN_CELLS) { const u = subOf(i, j); for (const [a, b] of [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]]) CORE_PTS.push(toW(u, avX(a), stZ(b))); }
let EDGE = [];
for (const u of S) u.SH = shoreOf(u);
const RAW = []; for (let a = 0; a < 360; a += 2) { let r = 0; for (const u of S) r = Math.max(r, rayHit(a * DEG, coastAng(a) ? u.SH : u.L)); RAW.push(r); }
for (let a = 0; a < 360; a += 2) {
  const th = a * DEG, k0 = a / 2; let r = RAW[k0];
  if (coastAng(a)) for (let d = -2; d <= 2; d++) r = Math.max(r, RAW[(k0 + d + 180) % 180] * Math.cos(d * 2 * DEG));
  const lobe = .5 + .35 * Math.sin(th * 3 + 1.1) + .15 * Math.sin(th * 5 + 2.3);
  let rr = coastAng(a) ? r : r - (90 + 210 * lobe) * Math.min(1, r / 700);
  for (const p of CORE_PTS) { const dx = p[0] - ctr[0], dz = p[1] - ctr[1], ang = Math.atan2(dz, dx), da = Math.abs(((ang - th) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); if (da < .12) rr = Math.max(rr, Math.hypot(dx, dz) + 25); }
  EDGE.push([ctr[0] + Math.cos(th) * rr, ctr[1] + Math.sin(th) * rr, coastAng(a) ? 1 : 0]);
}
for (let r = 0; r < 4; r++) EDGE = EDGE.map((p, k) => { const a = EDGE[(k + EDGE.length - 1) % EDGE.length], b = EDGE[(k + 1) % EDGE.length]; return [(a[0] + 2 * p[0] + b[0]) / 4, (a[1] + 2 * p[1] + b[1]) / 4, p[2]]; });
// 磨平之後，必含的點（舊城核心、實體建築街區）還是要在裡面：往外推到包住
EDGE = EDGE.map((p, k) => { const th = k * 2 * DEG; let rr = Math.hypot(p[0] - ctr[0], p[1] - ctr[1]); for (const q of CORE_PTS) { const dx = q[0] - ctr[0], dz = q[1] - ctr[1], da = Math.abs(((Math.atan2(dz, dx) - th) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); if (da < .06) rr = Math.max(rr, Math.hypot(dx, dz) + 20); } return [ctr[0] + Math.cos(th) * rr, ctr[1] + Math.sin(th) * rr, p[2]]; });
const ED = EDGE.map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]);

// ── 街區：四角（含人行道）都在外緣裡才留；舊城核心 5×5 不能拿掉 ──
const DROP = [];
for (const u of S) for (let i = u.ni[0]; i < u.ni[1]; i++) for (let j = u.nj[0]; j < u.nj[1]; j++) {
  if (i < 5 && j < 5) continue;
  const q = [toW(u, avX(i), stZ(j)), toW(u, avX(i + 1), stZ(j)), toW(u, avX(i + 1), stZ(j + 1)), toW(u, avX(i), stZ(j + 1)), toW(u, avX(i + .5), stZ(j)), toW(u, avX(i + 1), stZ(j + .5)), toW(u, avX(i + .5), stZ(j + 1)), toW(u, avX(i), stZ(j + .5))];
  if (!q.every(p => inPoly(ED, ...p))) DROP.push([i, j]);
}
const dropSet = new Set(DROP.map(c => c.join()));
const planHit = PLAN_CELLS.filter(c => dropSet.has(c.join()));

// ── 檢查 ──
let bad = 0;
const out = [];
for (const a of S) for (const b of S) if (a.n < b.n) {
  const d = polyDist(a.L, b.L);
  if (adj(a, b) || d < 60) { const ok = d >= 30; if (!ok) bad++; out.push(`${a.key}/${b.key} ${d < 0 ? '重疊' : Math.round(d) + ' m'}${ok ? '' : ' ✗'}`); }
}
console.log('縫寬：' + out.join('，'));
// 反算精度、Jacobian 行列式、局部轉角
let maxErr = 0, detMin = 9, detMax = 0, rotMax = 0;
for (const u of S) for (let x = avX(u.ni[0]) - 60; x <= avX(u.ni[1]) + 60; x += 9) for (let z = stZ(u.nj[0]) - 60; z <= stZ(u.nj[1]) + 60; z += 9) {
  const [X, Z] = toW(u, x, z), [bx, bz] = toL(u, X, Z); maxErr = Math.max(maxErr, Math.hypot(bx - x, bz - z));
  if (x < avX(u.ni[0]) - HR || x > avX(u.ni[1]) + HR || z < stZ(u.nj[0]) - HR || z > stZ(u.nj[1]) + HR) continue;   // 形變只看片裡面
  const [, , a, b, c, d] = warpJ(u.W, x, z), det = a * d - b * c; detMin = Math.min(detMin, det); detMax = Math.max(detMax, det);
  rotMax = Math.max(rotMax, Math.abs(Math.atan2(c, a)) / DEG, Math.abs(Math.atan2(b, d)) / DEG);
}
console.log(`反算誤差最大 ${(maxErr * 100).toFixed(3)} cm、Jacobian 行列式 ${detMin.toFixed(3)}～${detMax.toFixed(3)}、街道局部轉角最多 ${rotMax.toFixed(1)}°`);
if (maxErr > .01) bad++; if (detMin < .65 || detMax > 1.45) bad++;
console.log(`街區：拿掉 ${DROP.length} 塊（保留 ${NX * NZ - DROP.length}）；實體建築街區被拿掉 ${planHit.length} 處：${planHit.map(c => c.join(',')).join(' ')}`);
for (const u of S) console.log(`  ${u.key.padEnd(3)} ${u.name.padEnd(5, '　')} ry ${String(u.ry).padStart(4)}°  ox ${u.ox.toFixed(1).padStart(7)}  oz ${u.oz.toFixed(1).padStart(7)}  彎曲 ${Math.round(u.W.ax)}/${Math.round(u.W.az)} m  寬窄 ${Math.round(u.W.sx)}/${Math.round(u.W.sz)} m`);
console.log(bad ? `✗ ${bad} 項不合格` : '全部合格');

// ── 預覽 ──
{
  const pts = S.flatMap(u => u.L), [bx0, bx1, bz0, bz1] = bbox(pts).map((v, k) => v + [-200, 200, -200, 200][k]);
  const Wd = 1400, sc = Wd / (bx1 - bx0), Hd = Math.round((bz1 - bz0) * sc), tx = p => ((p[0] - bx0) * sc).toFixed(1) + ',' + ((p[1] - bz0) * sc).toFixed(1);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${Wd}" height="${Hd}" font-family="PingFang TC, sans-serif"><rect width="${Wd}" height="${Hd}" fill="#14294a"/>`;
  for (const u of S) s += `<polygon points="${u.L.map(tx).join(' ')}" fill="#6a5a3a" opacity=".5"/>`;   // 片的陸地（含沙灘、碼頭）
  s += `<polygon points="${ED.map(tx).join(' ')}" fill="#203d66" opacity=".85"/>`;
  for (let k = 0; k < ED.length; k++) { const q = ED[(k + 1) % ED.length]; s += `<line x1="${tx(ED[k]).split(',')[0]}" y1="${tx(ED[k]).split(',')[1]}" x2="${tx(q).split(',')[0]}" y2="${tx(q).split(',')[1]}" stroke="${EDGE[k][2] && EDGE[(k + 1) % ED.length][2] ? '#6ad0ff' : '#7a9a5a'}" stroke-width="3"/>`; }
  for (const u of S) {
    let g = '';
    for (let i = u.ni[0]; i < u.ni[1]; i++) for (let j = u.nj[0]; j < u.nj[1]; j++) {
      if (dropSet.has(i + ',' + j)) continue;
      const m = HR + 4, poly = outline(u, [avX(i) + m, avX(i + 1) - m, stZ(j) + m, stZ(j + 1) - m], 12);
      g += `<polygon points="${poly.map(tx).join(' ')}" fill="${PLAN_CELLS.some(c => c[0] === i && c[1] === j) ? '#4a6fa0' : '#3a5d8a'}"/>`;
    }
    s += g + `<text x="${tx(u.wc).split(',')[0]}" y="${tx(u.wc).split(',')[1]}" fill="#fff" font-size="16" text-anchor="middle" stroke="#0b1a2e" stroke-width="4" paint-order="stroke">${u.name}</text>`;
  }
  s += '</svg>';
  mkdirSync(resolve(HERE, '../dist'), { recursive: true });
  writeFileSync(resolve(HERE, '../dist/zones.svg'), s);
}

// ── 寫出 04-layout.js ──
if (process.argv.includes('--write')) {
  const f = v => +v.toFixed(5);
  const rows = S.map(u => `  { key: '${u.key}', name: '${u.name}', ni0: ${u.ni[0]}, ni1: ${u.ni[1]}, nj0: ${u.nj[0]}, nj1: ${u.nj[1]}, ry: ${f(u.ry * DEG)}, ox: ${f(u.ox)}, oz: ${f(u.oz)}, `
    + `W: { ${Object.entries(u.W).map(([k, v]) => `${k}: ${f(v)}`).join(', ')} } },`).join('\n');
  const js = `// ═══ 分區配置：由 tools/check-zones.mjs --write 產生，不要手改（改那支工具再重跑）═══
// 15 片的剛體變換（ry 弳度、ox、oz）與彎曲參數 W（05-zones.js 的 warpL），整座城的外緣 CITY_EDGE（世界座標），外緣外拿掉的街區 DROP_CELLS
const LAYOUT = [
${rows}
];
const CITY_EDGE = ${JSON.stringify(ED)};
// 外緣每個頂點臨水（1：河與海；0：北面與東面的山）；CITY_CTR 是量外緣的中心
const CITY_SHORE = ${JSON.stringify(EDGE.map(p => p[2]))};
const CITY_CTR = ${JSON.stringify(ctr.map(v => Math.round(v * 10) / 10))};
const DROP_CELLS = new Set(${JSON.stringify(DROP.map(c => c.join()))});
`;
  writeFileSync(resolve(HERE, '../src/parts/04-layout.js'), js);
  console.log('寫出 src/parts/04-layout.js');
}
