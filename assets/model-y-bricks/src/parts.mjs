// 零件幾何表：每個零件的碰撞體（保守凸體）、上方凸點（公）、下方凸點孔（母）與科技接點。
// 凸點位置一律從 LDraw 網格裡的 stud 原始檔讀出；碰撞體多數由網格自動推導（包圍盒或側面輪廓凸包），
// 少數結構複雜的零件手工定義，並由 checkCoverage() 比對 LDraw 網格，確認碰撞體完整包住真實零件。
import { walk, partInfo, loadFile, normName } from './ldraw.mjs';

// 支援的零件。shape：
//   box    = 本體包圍盒
//   prismX = 側面（z-y 平面）輪廓凸包沿 x 擠出，用於朝 -z 下斜的斜面／曲面磚
//   prismY = 俯視（x-z 平面）輪廓凸包沿 y 擠出，用於圓角板、圓角磚
//   custom = 手工碰撞體（見 CUSTOM）
// bl = BrickLink 目錄編號，rb = Rebrickable 編號（兩者不同時分開寫）
export const CATALOG = {
  '3024':  { name: 'Plate 1 x 1', zh: '1×1 薄板', shape: 'box' },
  '3023':  { name: 'Plate 1 x 2', zh: '1×2 薄板', shape: 'box' },
  '3623':  { name: 'Plate 1 x 3', zh: '1×3 薄板', shape: 'box' },
  '3710':  { name: 'Plate 1 x 4', zh: '1×4 薄板', shape: 'box' },
  '78329': { name: 'Plate 1 x 5', zh: '1×5 薄板', shape: 'box' },
  '3666':  { name: 'Plate 1 x 6', zh: '1×6 薄板', shape: 'box' },
  '3460':  { name: 'Plate 1 x 8', zh: '1×8 薄板', shape: 'box' },
  '4477':  { name: 'Plate 1 x 10', zh: '1×10 薄板', shape: 'box' },
  '3022':  { name: 'Plate 2 x 2', zh: '2×2 薄板', shape: 'box' },
  '3021':  { name: 'Plate 2 x 3', zh: '2×3 薄板', shape: 'box' },
  '3020':  { name: 'Plate 2 x 4', zh: '2×4 薄板', shape: 'box' },
  '3795':  { name: 'Plate 2 x 6', zh: '2×6 薄板', shape: 'box' },
  '3034':  { name: 'Plate 2 x 8', zh: '2×8 薄板', shape: 'box' },
  '3832':  { name: 'Plate 2 x 10', zh: '2×10 薄板', shape: 'box' },
  '2445':  { name: 'Plate 2 x 12', zh: '2×12 薄板', shape: 'box' },
  '3031':  { name: 'Plate 4 x 4', zh: '4×4 薄板', shape: 'box' },
  '3032':  { name: 'Plate 4 x 6', zh: '4×6 薄板', shape: 'box' },
  '3035':  { name: 'Plate 4 x 8', zh: '4×8 薄板', shape: 'box' },
  '3030':  { name: 'Plate 4 x 10', zh: '4×10 薄板', shape: 'box' },
  '3029':  { name: 'Plate 4 x 12', zh: '4×12 薄板', shape: 'box' },
  '3958':  { name: 'Plate 6 x 6', zh: '6×6 薄板', shape: 'box' },
  '3036':  { name: 'Plate 6 x 8', zh: '6×8 薄板', shape: 'box' },
  '3033':  { name: 'Plate 6 x 10', zh: '6×10 薄板', shape: 'box' },
  '3028':  { name: 'Plate 6 x 12', zh: '6×12 薄板', shape: 'box' },
  '3456':  { name: 'Plate 6 x 14', zh: '6×14 薄板', shape: 'box' },
  '3027':  { name: 'Plate 6 x 16', zh: '6×16 薄板', shape: 'box' },
  '41539': { name: 'Plate 8 x 8', zh: '8×8 薄板', shape: 'box' },
  '3005':  { name: 'Brick 1 x 1', zh: '1×1 磚', shape: 'box' },
  '3004':  { name: 'Brick 1 x 2', zh: '1×2 磚', shape: 'box' },
  '3622':  { name: 'Brick 1 x 3', zh: '1×3 磚', shape: 'box' },
  '3010':  { name: 'Brick 1 x 4', zh: '1×4 磚', shape: 'box' },
  '3009':  { name: 'Brick 1 x 6', zh: '1×6 磚', shape: 'box' },
  '3008':  { name: 'Brick 1 x 8', zh: '1×8 磚', shape: 'box' },
  '3003':  { name: 'Brick 2 x 2', zh: '2×2 磚', shape: 'box' },
  '3002':  { name: 'Brick 2 x 3', zh: '2×3 磚', shape: 'box' },
  '3001':  { name: 'Brick 2 x 4', zh: '2×4 磚', shape: 'box' },
  '2456':  { name: 'Brick 2 x 6', zh: '2×6 磚', shape: 'box' },
  '3070b': { name: 'Tile 1 x 1 with Groove', zh: '1×1 平滑片', shape: 'box' },
  '3069b': { name: 'Tile 1 x 2 with Groove', zh: '1×2 平滑片', shape: 'box' },
  '63864': { name: 'Tile 1 x 3', zh: '1×3 平滑片', shape: 'box' },
  '2431':  { name: 'Tile 1 x 4 with Groove', zh: '1×4 平滑片', shape: 'box' },
  '6636':  { name: 'Tile 1 x 6 with Groove', zh: '1×6 平滑片', shape: 'box' },
  '4162':  { name: 'Tile 1 x 8 with Groove', zh: '1×8 平滑片', shape: 'box' },
  '3068b': { name: 'Tile 2 x 2 with Groove', zh: '2×2 平滑片', shape: 'box' },
  '26603': { name: 'Tile 2 x 3', zh: '2×3 平滑片', shape: 'box' },
  '87079': { name: 'Tile 2 x 4 with Groove', zh: '2×4 平滑片', shape: 'box' },
  '69729': { name: 'Tile 2 x 6', zh: '2×6 平滑片', shape: 'box' },
  '2412b': { name: 'Tile Special 1 x 2 Grille with Bottom Groove', zh: '1×2 格柵平滑片', shape: 'box' },
  '3040b': { name: 'Slope 45 2 x 1', zh: '45° 2×1 斜面磚', shape: 'prismX', bl: '3040' },
  '3039':  { name: 'Slope 45 2 x 2', zh: '45° 2×2 斜面磚', shape: 'prismX' },
  '3037':  { name: 'Slope 45 2 x 4', zh: '45° 2×4 斜面磚', shape: 'prismX' },
  '3298':  { name: 'Slope 33 3 x 2', zh: '33° 3×2 斜面磚', shape: 'prismX' },
  '4286':  { name: 'Slope 33 3 x 1', zh: '33° 3×1 斜面磚', shape: 'prismX' },
  '54200': { name: 'Slope 30 1 x 1 x 2/3', zh: '30° 1×1 起司斜面', shape: 'prismX' },
  '85984': { name: 'Slope 30 1 x 2 x 2/3', zh: '30° 1×2 斜面', shape: 'prismX' },
  '11477': { name: 'Slope, Curved 2 x 1 No Studs', zh: '2×1 曲面磚', shape: 'prismX' },
  '15068': { name: 'Slope, Curved 2 x 2 x 2/3', zh: '2×2 曲面磚', shape: 'prismX' },
  '93606': { name: 'Slope, Curved 4 x 2 No Studs', zh: '4×2 曲面磚', shape: 'prismX' },
  '50950': { name: 'Slope, Curved 3 x 1 No Studs', zh: '3×1 曲面磚', shape: 'prismX' },
  '24309': { name: 'Slope, Curved 3 x 2 No Studs', zh: '3×2 曲面磚', shape: 'prismX' },
  '88930': { name: 'Slope, Curved 2 x 4 x 2/3 No Studs', zh: '2×4 低曲面磚', shape: 'prismX' },
  '25269': { name: 'Tile, Round 1 x 1 Quarter', zh: '1×1 四分之一圓片', shape: 'prismY' },
  '3668':  { name: 'Brick, Modified 2 x 6 x 1 1/3 with Axle Holes', zh: '2×6 輪軸磚', shape: 'custom' },
  '3749':  { name: 'Technic, Axle Pin without Friction Ridges', zh: '科技軸銷', shape: 'custom' },
  '72206p01': { name: 'Wheel 24 x 12 with Black Tire', zh: '24×12 輪圈含輪胎', shape: 'custom', rb: '72206', bl: '72206c01' },
};

// 手工碰撞體（零件本身座標，單位 LDU）。box = [x0,y0,z0,x1,y1,z1]；poly = 沿指定軸擠出的凸多邊形
function circumPoly(r, n, rot = Math.PI / n) {
  const R = r / Math.cos(Math.PI / n); const pts = [];
  for (let i = 0; i < n; i++) { const a = rot + (i * 2 * Math.PI) / n; pts.push([R * Math.cos(a), R * Math.sin(a)]); }
  return pts;
}
const CUSTOM = {
  // 兩端 1×2×1⅓ 側磚（含軸孔，軸銷插入處以接點規則檢查）＋中間下沉的 2×4 板
  '3668': { pieces: [
    { box: [40, 0, -20, 60, 32, 20] }, { box: [-60, 0, -20, -40, 32, 20] }, { box: [-40, 24, -20, 40, 32, 20] },
  ], antistuds: [],
    technic: [
      { kind: 'axlehole', p: [50, 10, 0], axis: [1, 0, 0], half: 10, open: [1, 0, 0] },
      { kind: 'axlehole', p: [-50, 10, 0], axis: [1, 0, 0], half: 10, open: [-1, 0, 0] },
    ] },
  // 軸銷：x -20..-2.5 是十字軸，-2.5..2 是擋環，2..19.5 是銷
  '3749': { pieces: [
    { box: [-20, -7.2, -7.2, -2.5, 7.2, 7.2] }, { box: [-2.5, -8.2, -8.2, 2, 8.2, 8.2] }, { box: [2, -6.2, -6.2, 19.5, 6.2, 6.2] },
  ], antistuds: [],
    technic: [
      { kind: 'axle', p: [-10, 0, 0], axis: [1, 0, 0], half: 10 },
      { kind: 'pin', p: [10.75, 0, 0], axis: [1, 0, 0], half: 8.75 },
    ] },
  // 輪子：外接 24 邊形的柱體（半徑 30），z -14..16；銷孔在輪轂中心，開口朝 +z
  '72206p01': { pieces: [{ poly: circumPoly(30, 24), axis: 'z', from: -14, to: 16 }], antistuds: [],
    technic: [{ kind: 'pinhole', p: [0, 0, 7], axis: [0, 0, 1], half: 9, open: [0, 0, 1] }] },
};

// ---- 凸多面體（SAT 用）：{ verts, normals, edges } ----
function boxPiece([x0, y0, z0, x1, y1, z1]) {
  const verts = [];
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) verts.push([x, y, z]);
  return { verts, normals: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], edges: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] };
}
// poly: 2D 點 (u,v)；axis 'x' → (u,v)=(z,y)，'y' → (x,z)，'z' → (x,y)
function prismPiece(poly, axis, from, to) {
  const map = axis === 'x' ? (u, v, w) => [w, v, u] : axis === 'y' ? (u, v, w) => [u, w, v] : (u, v, w) => [u, v, w];
  const verts = [];
  for (const [u, v] of poly) { verts.push(map(u, v, from)); verts.push(map(u, v, to)); }
  const ax = map(0, 0, 1);
  const normals = [ax], edges = [ax];
  for (let i = 0; i < poly.length; i++) {
    const [u0, v0] = poly[i], [u1, v1] = poly[(i + 1) % poly.length];
    const du = u1 - u0, dv = v1 - v0; const L = Math.hypot(du, dv);
    if (L < 1e-9) continue;
    edges.push(map(du / L, dv / L, 0));
    normals.push(map(dv / L, -du / L, 0));
  }
  return { verts, normals, edges };
}
function hull2d(points) {
  const pts = [...new Map(points.map((p) => [p[0].toFixed(3) + ',' + p[1].toFixed(3), p])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-9) lower.pop(); lower.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-9) upper.pop(); upper.push(p); }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

// 零件本體（不含凸點）的三角形頂點與邊中點，用來推導碰撞體與檢查覆蓋
function bodySamples(file) {
  const pts = [];
  walk(file, (k, d) => {
    if (k !== 'tri') return;
    const P = d.pts;
    for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; pts.push(a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]); }
    const c = [0, 1, 2].map((k2) => P.reduce((s, q) => s + q[k2], 0) / P.length); pts.push(c);
  }, { skipStuds: true });
  return pts;
}

// 零件編號 → LDraw 檔名（LDraw 改過編號的，照 ~Moved to 指到新檔）
export function ldrawFileFor(id) {
  const c = CATALOG[id];
  let f = (c && c.ldraw) || id + '.dat';
  for (let i = 0; i < 3; i++) {
    const t = loadFile(f).title;
    const m = /^~Moved to\s+(\S+)/i.exec(t);
    if (!m) break;
    f = m[1].toLowerCase() + '.dat';
  }
  return normName(f);
}
const byFile = new Map();
export function idForFile(file) {
  if (!byFile.size) for (const id of Object.keys(CATALOG)) byFile.set(ldrawFileFor(id), id);
  return byFile.get(normName(file));
}

const geomCache = new Map();
export function partGeom(file) {
  file = normName(file);
  if (geomCache.has(file)) return geomCache.get(file);
  const id = idForFile(file);
  if (!id) throw new Error('零件不在幾何表：' + file);
  const cat = CATALOG[id];
  const info = partInfo(file);
  const { lo, hi } = info;
  const studs = info.studs.map((s) => ({ p: s.pos, up: s.up }));
  let pieces, antistuds, technic = [];
  if (cat.shape === 'custom') {
    const c = CUSTOM[id];
    pieces = c.pieces.map((p) => (p.box ? boxPiece(p.box) : prismPiece(p.poly, p.axis, p.from, p.to)));
    antistuds = c.antistuds; technic = c.technic || [];
  } else {
    if (cat.shape === 'box') pieces = [boxPiece([lo[0], lo[1], lo[2], hi[0], hi[1], hi[2]])];
    else if (cat.shape === 'prismX') pieces = [prismPiece(hull2d(bodySamples(file).map((p) => [p[2], p[1]])), 'x', lo[0], hi[0])];
    else if (cat.shape === 'prismY') pieces = [prismPiece(hull2d(bodySamples(file).map((p) => [p[0], p[2]])), 'y', lo[1], hi[1])];
    // 底面每一格都是凸點孔（磚、板、平滑片、斜面磚的標準底部）
    antistuds = [];
    for (let x = lo[0] + 10; x < hi[0]; x += 20) for (let z = lo[2] + 10; z < hi[2]; z += 20) antistuds.push({ p: [snap(x), hi[1], snap(z)], dir: [0, 1, 0] });
  }
  const g = { id, file, title: info.title, lo, hi, studs, antistuds, technic, pieces };
  geomCache.set(file, g);
  return g;
}
const snap = (v) => Math.round(v * 2) / 2;

function inside(piece, p, tol) {
  // 凸多面體：對每個分離軸，點的投影要落在頂點投影範圍內（對擠出體與盒子足夠嚴格：軸就是全部面法向量）
  for (const n of piece.normals) {
    const d = p[0] * n[0] + p[1] * n[1] + p[2] * n[2];
    let mn = Infinity, mx = -Infinity;
    for (const v of piece.verts) { const e = v[0] * n[0] + v[1] * n[1] + v[2] * n[2]; if (e < mn) mn = e; if (e > mx) mx = e; }
    if (d < mn - tol || d > mx + tol) return false;
  }
  return true;
}
// 覆蓋檢查：真實網格的每個取樣點都要落在某個碰撞體內，碰撞判定才是保守（不會漏判）
export function checkCoverage(file, tol = 0.35) {
  const g = partGeom(file);
  const pts = bodySamples(file);
  let miss = 0, worst = null;
  for (const p of pts) {
    if (g.pieces.some((pc) => inside(pc, p, tol))) continue;
    miss++; if (!worst) worst = p;
  }
  return { samples: pts.length, miss, worst };
}
