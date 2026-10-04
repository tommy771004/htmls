// 鹽岬島的地形：固定的高度場（伺服器與前端共用，碰撞與畫面用同一份三角形）。
import { fbm, vnoise, clamp, lerp, smooth } from './rng.js';

export const EXT = 1260;          // 地圖半寬（公尺），海面延伸到此
export const CELL = 6;            // 高度場格距
export const N = Math.round((EXT * 2) / CELL) + 1;
export const SEA = 0;

// 命名地點：中心、半徑與整地高度（h 為 null 代表依原地形決定）
export const TOWNS = [
  { id: 'old', name: '老街', en: 'OLD STREET', x: -20, z: 40, r: 150, kind: 'oldstreet' },
  { id: 'harbor', name: '鹽港', en: 'SALT HARBOR', x: 770, z: 130, r: 130, kind: 'harbor', h: 3.2 },
  { id: 'cape', name: '燈塔岬', en: 'LIGHTHOUSE CAPE', x: 90, z: 905, r: 85, kind: 'cape' },
  { id: 'pans', name: '曬鹽場', en: 'SALT PANS', x: -735, z: 250, r: 150, kind: 'pans', h: 2.6 },
  { id: 'kiln', name: '石灰窯', en: 'LIME KILNS', x: 60, z: -600, r: 105, kind: 'kiln' },
  { id: 'air', name: '機場', en: 'AIRFIELD', x: -600, z: -470, r: 160, kind: 'airfield' },
  { id: 'refinery', name: '煉油廠', en: 'REFINERY', x: 560, z: 640, r: 120, kind: 'refinery', h: 4 },
  { id: 'olive', name: '橄欖村', en: 'OLIVE VILLAGE', x: -470, z: 660, r: 120, kind: 'village' },
  { id: 'radar', name: '鷹嘴雷達站', en: 'EAGLE RADAR', x: 470, z: -560, r: 55, kind: 'radar' },
  { id: 'estate', name: '新村', en: 'NEW ESTATE', x: 330, z: 250, r: 85, kind: 'estate' },
];

// 道路折線（端點附近會整地）
export const ROAD_LINES = [
  [[-20, 40], [180, 110], [330, 250], [470, 190], [770, 130]],
  [[-20, 40], [-200, 120], [-420, 200], [-735, 250]],
  [[-20, 40], [10, 300], [60, 560], [90, 905]],
  [[-20, 40], [30, -200], [60, -600]],
  [[60, -600], [-200, -560], [-430, -470], [-610, -470]],
  [[-610, -470], [-700, -220], [-735, 250]],
  [[-735, 250], [-640, 480], [-470, 660]],
  [[-470, 660], [-250, 700], [60, 760], [90, 905]],
  [[90, 905], [330, 760], [560, 640]],
  [[560, 640], [640, 400], [770, 130]],
  [[770, 130], [700, -200], [560, -420], [470, -560]],
  [[60, -600], [260, -560], [470, -560]],
  [[330, 250], [460, 430], [560, 640]],
];

// 海岸線半徑：用方向向量取雜訊，避免 atan2
function coastRadius(x, z) {
  const d = Math.sqrt(x * x + z * z) || 1;
  const nx = x / d, nz = z / d;
  let r = 930 + 110 * (vnoise(nx * 2.2 + 11, nz * 2.2 + 5, 3) - 0.5) * 2 + 40 * (vnoise(nx * 7 + 3, nz * 7 + 9, 4) - 0.5) * 2;
  // 南端燈塔岬與西北機場的陸塊
  const lob = (ax, az, w, amt) => { const dot = nx * ax + nz * az; return dot > w ? amt * ((dot - w) / (1 - w)) * ((dot - w) / (1 - w)) : 0; };
  r += lob(0.1, 0.995, 0.93, 120);
  r += lob(-0.79, -0.61, 0.9, 160);
  r += lob(0.98, 0.17, 0.95, 40);
  return r;
}

function baseHeight(x, z) {
  const d = Math.sqrt(x * x + z * z);
  const cr = coastRadius(x, z);
  const inland = smooth(cr + 30, cr - 160, d); // 0 海上 → 1 內陸
  let h = 4 + 26 * fbm(x / 420 + 7, z / 420 + 3, 4, 1) + 9 * fbm(x / 90, z / 90, 3, 9);
  // 東北的鷹嘴山與北側丘陵
  const m1x = (x - 480) / 330, m1z = (z + 540) / 300, q1 = 1 - (m1x * m1x + m1z * m1z);
  if (q1 > 0) h += 120 * q1 * q1;
  const m2x = (x + 120) / 380, m2z = (z + 300) / 260, q2 = 1 - (m2x * m2x + m2z * m2z);
  if (q2 > 0) h += 34 * q2 * q2;
  const m3x = (x + 380) / 260, m3z = (z - 620) / 200, q3 = 1 - (m3x * m3x + m3z * m3z);
  if (q3 > 0) h += 30 * q3 * q3;
  // 西岸的鹽田平原壓低
  const fx = (x + 720) / 260, fz = (z - 230) / 360, qf = 1 - (fx * fx + fz * fz);
  if (qf > 0) h = lerp(h, 2.6, smooth(0, 0.5, qf));
  const land = lerp(-14, h, inland);
  // 海岸沙灘帶
  const beach = smooth(cr - 60, cr - 5, d) * inland;
  return lerp(land, Math.min(land, 1.6), beach * 0.85);
}

function townHeight(t) {
  if (t.h != null) return t.h;
  return Math.max(3, Math.round(baseHeight(t.x, t.z) * 10) / 10);
}

function segDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az, wx = px - ax, wz = pz - az;
  const L = vx * vx + vz * vz;
  const t = L > 0 ? clamp((wx * vx + wz * vz) / L, 0, 1) : 0;
  const dx = px - (ax + vx * t), dz = pz - (az + vz * t);
  return [Math.sqrt(dx * dx + dz * dz), t];
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
  // 道路：沿線取樣、平滑、限坡度
  const roads = ROAD_LINES.map((line) => {
    const pts = [];
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, az] = line[i], [bx, bz] = line[i + 1];
      const L = Math.sqrt((bx - ax) ** 2 + (bz - az) ** 2), n = Math.max(1, Math.ceil(L / 6));
      for (let k = 0; k < n; k++) { const t = k / n; pts.push([ax + (bx - ax) * t, az + (bz - az) * t]); }
    }
    pts.push(line[line.length - 1]);
    // Chaikin 兩次讓轉角變圓
    let p = pts;
    for (let it = 0; it < 2; it++) {
      const q = [p[0]];
      for (let i = 0; i < p.length - 1; i++) {
        q.push([p[i][0] * 0.75 + p[i + 1][0] * 0.25, p[i][1] * 0.75 + p[i + 1][1] * 0.25]);
        q.push([p[i][0] * 0.25 + p[i + 1][0] * 0.75, p[i][1] * 0.25 + p[i + 1][1] * 0.75]);
      }
      q.push(p[p.length - 1]); p = q;
    }
    let ys = p.map(([x, z]) => Math.max(1.2, withTowns(x, z)));
    for (let it = 0; it < 6; it++) ys = ys.map((y, i) => { let s = 0, c = 0; for (let k = -6; k <= 6; k++) { const j = i + k; if (j >= 0 && j < ys.length) { s += ys[j]; c++; } } return s / c; });
    return { pts: p.map(([x, z], i) => [x, ys[i], z]), w: 7 };
  });
  const runway = { pts: [[-800, 0, -470], [-400, 0, -470]], w: 44, runway: true };
  for (const p of runway.pts) p[1] = TOWNS.find((t) => t.id === 'air').y;

  // 先算原始地形，再把每格最近的道路（逐線段光柵化）壓平
  const D = new Float32Array(N * N).fill(1e9), RY = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = withTowns(-EXT + i * CELL, -EXT + j * CELL);
  const R = 26;
  for (const rd of roads) {
    const P = rd.pts;
    for (let k = 0; k < P.length - 1; k++) {
      const a = P[k], b = P[k + 1];
      const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - R + EXT) / CELL)), i1 = Math.min(N - 1, Math.ceil((Math.max(a[0], b[0]) + R + EXT) / CELL));
      const j0 = Math.max(0, Math.floor((Math.min(a[2], b[2]) - R + EXT) / CELL)), j1 = Math.min(N - 1, Math.ceil((Math.max(a[2], b[2]) + R + EXT) / CELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const [d, t] = segDist(-EXT + i * CELL, -EXT + j * CELL, a[0], a[2], b[0], b[2]);
        const c = j * N + i;
        if (d < D[c]) { D[c] = d; RY[c] = a[1] + (b[1] - a[1]) * t; }
      }
    }
  }
  const ra = runway.pts[0], rb = runway.pts[1];
  for (let j = 0; j < N; j++) {
    const z = -EXT + j * CELL;
    for (let i = 0; i < N; i++) {
      const x = -EXT + i * CELL, c = j * N + i;
      let h = H[c];
      if (D[c] < R) h = lerp(h, RY[c] - 0.05, smooth(R, 7 * 0.5 + 3, D[c]));
      const [d] = segDist(x, z, ra[0], ra[2], rb[0], rb[2]);
      const f = smooth(60, 26, d); if (f > 0) h = lerp(h, ra[1], f);
      H[c] = Math.round(h * 100) / 100;
    }
  }
  return { H, roads, runway };
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
