// 鹽岬島的地形：美式海島，北邊岩山、穿過島中央的河、沿河的城鎮與橋。
// 固定的高度場（伺服器與前端共用，碰撞與畫面用同一份三角形）；只用整數雜湊與四則運算，跨引擎一致。
import { fbm, vnoise, clamp, lerp, smooth } from './rng.js';

export const EXT = 1260;          // 地圖半寬（公尺），海面延伸到此
export const CELL = 6;            // 高度場格距
export const N = Math.round((EXT * 2) / CELL) + 1;
export const SEA = 0;

// 命名地點：中心、半徑、類型；h 指定整地高度（null 依原地形）
export const TOWNS = [
  { id: 'fort', name: '鐵甲堡', en: 'FORT IRONCLAD', x: 70, z: -800, r: 95, kind: 'fort' },
  { id: 'air', name: '側風機場', en: 'CROSSWIND AIRFIELD', x: -560, z: -560, r: 160, kind: 'airfield' },
  { id: 'pine', name: '松嶺', en: 'PINECREST', x: -650, z: -190, r: 120, kind: 'pinecrest' },
  { id: 'city', name: '橋城', en: 'BRIDGE CITY', x: 60, z: -430, r: 165, kind: 'downtown' },
  { id: 'ranch', name: '草垛牧場', en: 'HAYSTACK RANCH', x: 380, z: -40, r: 120, kind: 'ranch' },
  { id: 'light', name: '燈塔角', en: 'LIGHTHOUSE POINT', x: 860, z: 90, r: 80, kind: 'cape' },
  { id: 'port', name: '橋港', en: 'BRIDGEPORT', x: -70, z: 20, r: 150, kind: 'suburb' },
  { id: 'foundry', name: '鑄造廠', en: 'FOUNDRY YARD', x: 580, z: 300, r: 120, kind: 'foundry' },
  { id: 'mill', name: '舊磨坊', en: 'OLD MILL', x: -310, z: 210, r: 75, kind: 'mill' },
  { id: 'farms', name: '溪畔農場', en: 'BROOK FARMS', x: -600, z: 380, r: 140, kind: 'farms' },
  { id: 'river', name: '河畔', en: 'RIVERSIDE', x: -40, z: 480, r: 125, kind: 'suburb2' },
  { id: 'docks', name: '沼澤碼頭', en: 'MARSH DOCKS', x: 430, z: 660, r: 125, kind: 'harbor', h: 3.2 },
  { id: 'resort', name: '海灣度假村', en: 'BAY RESORT', x: -470, z: 730, r: 110, kind: 'resort', h: 4 },
];

// 河：由北往南穿過橋城、橋港、河畔入海；w 為水面寬
export const RIVER = { w: 24, pts: [[-150, -1080], [-90, -820], [-40, -620], [-10, -430], [-40, -260], [-110, -120], [-140, 40], [-200, 170], [-230, 260], [-150, 380], [-70, 520], [-30, 700], [10, 1080]] };

// 道路折線
export const ROAD_LINES = [
  [[60, -430], [70, -620], [70, -800]],
  [[60, -430], [-180, -470], [-400, -540], [-560, -560]],
  [[-560, -560], [-640, -380], [-650, -190]],
  [[60, -430], [-20, -200], [-70, 20]],
  [[-650, -190], [-420, -60], [-70, 20]],
  [[-70, 20], [140, 0], [380, -40]],
  [[380, -40], [640, 40], [860, 90]],
  [[60, -430], [300, -260], [380, -40]],
  [[380, -40], [500, 160], [580, 300]],
  [[-70, 20], [-200, 120], [-310, 210]],
  [[-310, 210], [-460, 300], [-600, 380]],
  [[-70, 20], [-20, 250], [-40, 480]],
  [[-40, 480], [180, 560], [430, 660]],
  [[580, 300], [520, 480], [430, 660]],
  [[-600, 380], [-560, 560], [-470, 730]],
  [[-470, 730], [-260, 640], [-40, 480]],
];

function segDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az, wx = px - ax, wz = pz - az;
  const L = vx * vx + vz * vz;
  const t = L > 0 ? clamp((wx * vx + wz * vz) / L, 0, 1) : 0;
  const dx = px - (ax + vx * t), dz = pz - (az + vz * t);
  return [Math.sqrt(dx * dx + dz * dz), t];
}

// 海岸線半徑：用方向向量取雜訊，避免 atan2
function coastRadius(x, z) {
  const d = Math.sqrt(x * x + z * z) || 1;
  const nx = x / d, nz = z / d;
  let r = 940 + 80 * (vnoise(nx * 2.2 + 11, nz * 2.2 + 5, 3) - 0.5) * 2 + 30 * (vnoise(nx * 7 + 3, nz * 7 + 9, 4) - 0.5) * 2;
  const lob = (ax, az, w, amt) => { const dot = nx * ax + nz * az; return dot > w ? amt * ((dot - w) / (1 - w)) * ((dot - w) / (1 - w)) : 0; };
  r += lob(0.995, 0.1, 0.94, 70);
  r += lob(-0.7, -0.71, 0.9, 110);
  r += lob(0.0, -1.0, 0.95, 40);
  return r;
}

export function riverDist(x, z) {
  const P = RIVER.pts;
  let best = 1e9;
  for (let k = 0; k < P.length - 1; k++) {
    const [d] = segDist(x, z, P[k][0], P[k][1], P[k + 1][0], P[k + 1][1]);
    if (d < best) best = d;
  }
  return best;
}

function mountain(x, z) { const m1x = (x - 600) / 300, m1z = (z + 470) / 260; return 1 - (m1x * m1x + m1z * m1z); }

function baseHeight(x, z) {
  const d = Math.sqrt(x * x + z * z);
  const cr = coastRadius(x, z);
  const inland = smooth(cr + 30, cr - 150, d);
  let h = 5 + 18 * fbm(x / 420 + 7, z / 420 + 3, 4, 1) + 7 * fbm(x / 90, z / 90, 3, 9);
  const q1 = mountain(x, z);
  if (q1 > 0) h += 175 * q1 * q1 * (0.85 + 0.3 * fbm(x / 60, z / 60, 3, 41));
  const m2x = (x + 330) / 260, m2z = (z + 360) / 200, q2 = 1 - (m2x * m2x + m2z * m2z);
  if (q2 > 0) h += 60 * q2 * q2;
  const m3x = (x - 250) / 220, m3z = (z - 450) / 160, q3 = 1 - (m3x * m3x + m3z * m3z);
  if (q3 > 0) h += 30 * q3 * q3;
  const rd = riverDist(x, z);
  h = lerp(Math.min(h, 4 + rd * 0.05), h, smooth(40, 220, rd));
  const land = lerp(-14, h, inland);
  const cliff = q1 > 0 ? smooth(0, 0.25, q1) : 0;
  const beach = smooth(cr - 55, cr - 5, d) * inland * (1 - cliff);
  return lerp(land, Math.min(land, 1.6), beach * 0.85);
}

function townHeight(t) {
  if (t.h != null) return t.h;
  return Math.max(3, Math.round(baseHeight(t.x, t.z) * 10) / 10);
}

function densify(line, step = 6, chaikin = 2) {
  const pts = [];
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i], [bx, bz] = line[i + 1];
    const L = Math.sqrt((bx - ax) ** 2 + (bz - az) ** 2), n = Math.max(1, Math.ceil(L / step));
    for (let k = 0; k < n; k++) { const t = k / n; pts.push([ax + (bx - ax) * t, az + (bz - az) * t]); }
  }
  pts.push(line[line.length - 1]);
  let p = pts;
  for (let it = 0; it < chaikin; it++) {
    const q = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      q.push([p[i][0] * 0.75 + p[i + 1][0] * 0.25, p[i][1] * 0.75 + p[i + 1][1] * 0.25]);
      q.push([p[i][0] * 0.25 + p[i + 1][0] * 0.75, p[i][1] * 0.25 + p[i + 1][1] * 0.75]);
    }
    q.push(p[p.length - 1]); p = q;
  }
  return p;
}

export function buildTerrain() {
  for (const t of TOWNS) t.y = townHeight(t);
  const H = new Float32Array(N * N);
  const withTowns = (x, z) => {
    let h = baseHeight(x, z);
    for (const t of TOWNS) {
      const dx = x - t.x, dz = z - t.z, d = Math.sqrt(dx * dx + dz * dz);
      const f = smooth(t.r + 70, t.r, d);
      if (f > 0) h = lerp(h, t.y, f);
    }
    return h;
  };
  const river = { pts: densify(RIVER.pts, 8, 3).map(([x, z]) => [x, -0.6, z]), w: RIVER.w };
  const roads = ROAD_LINES.map((line) => {
    const p = densify(line);
    let ys = p.map(([x, z]) => Math.max(2.2, withTowns(x, z)));
    for (let it = 0; it < 6; it++) ys = ys.map((y, i) => { let s = 0, c = 0; for (let k = -6; k <= 6; k++) { const j = i + k; if (j >= 0 && j < ys.length) { s += ys[j]; c++; } } return s / c; });
    return { pts: p.map(([x, z], i) => [x, ys[i], z]), w: 7 };
  });
  const runway = { pts: [[-760, 0, -560], [-370, 0, -560]], w: 44, runway: true };
  for (const p of runway.pts) p[1] = TOWNS.find((t) => t.id === 'air').y;

  const D = new Float32Array(N * N).fill(1e9), RY = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = withTowns(-EXT + i * CELL, -EXT + j * CELL);
  const raster = (pts, R, cb) => {
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1];
      const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - R + EXT) / CELL)), i1 = Math.min(N - 1, Math.ceil((Math.max(a[0], b[0]) + R + EXT) / CELL));
      const j0 = Math.max(0, Math.floor((Math.min(a[2], b[2]) - R + EXT) / CELL)), j1 = Math.min(N - 1, Math.ceil((Math.max(a[2], b[2]) + R + EXT) / CELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const [d, t] = segDist(-EXT + i * CELL, -EXT + j * CELL, a[0], a[2], b[0], b[2]);
        cb(j * N + i, d, a[1] + (b[1] - a[1]) * t);
      }
    }
  };
  const R = 26;
  for (const rd of roads) raster(rd.pts, R, (c, d, y) => { if (d < D[c]) { D[c] = d; RY[c] = y; } });
  const ra = runway.pts[0], rb = runway.pts[1];
  for (let j = 0; j < N; j++) {
    const z = -EXT + j * CELL;
    for (let i = 0; i < N; i++) {
      const x = -EXT + i * CELL, c = j * N + i;
      let h = H[c];
      if (D[c] < R) h = lerp(h, RY[c] - 0.05, smooth(R, 7 * 0.5 + 3, D[c]));
      const [d] = segDist(x, z, ra[0], ra[2], rb[0], rb[2]);
      const f = smooth(60, 26, d); if (f > 0) h = lerp(h, ra[1], f);
      H[c] = h;
    }
  }
  // 最後才切河道：河床低於海平面，海面著色器自然把河填滿
  const RD = new Float32Array(N * N).fill(1e9);
  raster(river.pts, river.w + 24, (c, d) => { if (d < RD[c]) RD[c] = d; });
  const hw = river.w / 2;
  for (let c = 0; c < N * N; c++) {
    const d = RD[c];
    if (d > hw + 18) continue;
    const bed = d < hw ? -2.8 + (d / hw) * (d / hw) * 1.6 : lerp(-1.2, H[c], smooth(hw, hw + 18, d));
    H[c] = Math.min(H[c], bed);
  }
  for (let c = 0; c < N * N; c++) H[c] = Math.round(H[c] * 100) / 100;
  // 橋：道路穿過河道的那一段
  const bridges = [];
  for (const rd of roads) {
    let i0 = -1;
    rd.pts.forEach((p, i) => {
      const near = riverDist(p[0], p[2]) < hw + 8;
      if (near && i0 < 0) i0 = i;
      if (!near && i0 >= 0) { bridges.push(spanOf(rd.pts, i0, i - 1)); i0 = -1; }
    });
    if (i0 >= 0) bridges.push(spanOf(rd.pts, i0, rd.pts.length - 1));
  }
  return { H, roads, runway, river, bridges, riverDist };
}

function spanOf(pts, i0, i1) {
  const a = pts[Math.max(0, i0 - 1)], b = pts[Math.min(pts.length - 1, i1 + 1)];
  let y = 0; for (let i = i0; i <= i1; i++) y += pts[i][1];
  y = Math.max(a[1], b[1], y / (i1 - i0 + 1));
  return { ax: a[0], az: a[2], bx: b[0], bz: b[2], y, w: 9 };
}

// 與畫面一致的三角形內插（每格以 (i,j)-(i+1,j+1) 對角線切開）
export function heightAt(H, x, z) {
  const fx = (x + EXT) / CELL, fz = (z + EXT) / CELL;
  let i = Math.floor(fx), j = Math.floor(fz);
  if (i < 0 || j < 0 || i >= N - 1 || j >= N - 1) return -14;
  const u = fx - i, v = fz - j;
  const h00 = H[j * N + i], h10 = H[j * N + i + 1], h01 = H[(j + 1) * N + i], h11 = H[(j + 1) * N + i + 1];
  if (u > v) return h00 + (h10 - h00) * u + (h11 - h10) * v;
  return h00 + (h11 - h01) * u + (h01 - h00) * v;
}

export function coastAt(x, z) { return coastRadius(x, z); }
export { mountain };
