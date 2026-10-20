// 真實地圖世界：OpenStreetMap 的建物、道路、水域、綠地、樹、路燈與店家，加上 Terrarium 高程。
// 資料由 tools/fetch-osm.mjs 預先烘焙成 data/osm/<id>.json（座標 0.1 公尺整數差分），頁面以 gzip＋base64 內嵌，
// 啟動時解開後 registerOsm()。OsmWorld 的介面與 World 相同（terrain、groundAt、waterAt、surfaceAt、generateChunk），
// 畫面、碰撞、交通與小地圖都讀它；資料範圍外只有地形（邊長 2×half 公尺的正方形以外）。
// 建物：接近矩形的以最小外接矩形為「局部座標系」（正面 = 局部北側，朝向最近的道路），沿用程序建物的外觀、門與室內；
// 不規則的以多邊形擠出，不能進入。
import { CAR_COLORS, CURB, FLOOR_H, GROUND_H, PAL, SHOPS, World } from './world.js';
import { clamp, hash2, lerp, mulberry32, pick } from './math.js';

const REG = new Map();
const DECODED = new Map();
export function registerOsm(id, json) {
  REG.set(id, json);
  DECODED.delete(id);
}
export function hasOsm(id) {
  return REG.has(id);
}
export function osmData(id) {
  if (!DECODED.has(id)) DECODED.set(id, decodeOsm(REG.get(id)));
  return DECODED.get(id);
}

export const OSM_ATTRIB = '© OpenStreetMap 貢獻者（ODbL）· 高程：Terrarium（AWS Terrain Tiles）';
export const CHUNK = 100;
export const ROAD_Y = 0.07; // 路面比地形高一點（人行道 0.04、標線 0.09）

// 道路類別：n 給小地圖與交通、w 預設路寬、walk 人行道寬、drive 是否有車流
export const RC = [
  { n: 'trunk', w: 15, walk: 0, drive: 1, speed: 17 },
  { n: 'trunk', w: 14, walk: 3, drive: 1, speed: 14 },
  { n: 'primary', w: 12, walk: 3.2, drive: 1, speed: 12 },
  { n: 'secondary', w: 10, walk: 3, drive: 1, speed: 11 },
  { n: 'tertiary', w: 9, walk: 2.6, drive: 1, speed: 10 },
  { n: 'residential', w: 7.5, walk: 2.2, drive: 1, speed: 8 },
  { n: 'living', w: 5.5, walk: 0, drive: 1, speed: 5 },
  { n: 'service', w: 4.5, walk: 0, drive: 0, speed: 5 },
  { n: 'pedestrian', w: 6, walk: 0, drive: 0, speed: 0 },
  { n: 'path', w: 2.4, walk: 0, drive: 0, speed: 0 },
  { n: 'cycleway', w: 2.2, walk: 0, drive: 0, speed: 0 },
];
// 綠地類別（與 fetch-osm.mjs 的 GREEN 對應）
export const GC = ['park', 'garden', 'pitch', 'playground', 'cemetery', 'forest', 'sand', 'parking', 'pier', 'pool'];

// ── 幾何工具 ──
function undelta(a, scale = 0.1) {
  const out = new Float64Array(a.length);
  let x = 0;
  let z = 0;
  for (let k = 0; k < a.length; k += 2) {
    x += a[k];
    z += a[k + 1];
    out[k] = x * scale;
    out[k + 1] = z * scale;
  }
  return out;
}
export function inRing(r, x, z) {
  let inside = false;
  const n = r.length;
  for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
    const zi = r[i + 1];
    const zj = r[j + 1];
    if (zi > z !== zj > z && x < ((r[j] - r[i]) * (z - zi)) / (zj - zi) + r[i]) inside = !inside;
  }
  return inside;
}
export function inPoly(rings, x, z) {
  if (!inRing(rings[0], x, z)) return false;
  for (let k = 1; k < rings.length; k++) if (inRing(rings[k], x, z)) return false;
  return true;
}
function ringArea(r) {
  let a = 0;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) a += (r[j] + r[i]) * (r[j + 1] - r[i + 1]);
  return a / 2;
}
function aabb(r) {
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (let k = 0; k < r.length; k += 2) {
    x0 = Math.min(x0, r[k]);
    x1 = Math.max(x1, r[k]);
    z0 = Math.min(z0, r[k + 1]);
    z1 = Math.max(z1, r[k + 1]);
  }
  return { x0, z0, x1, z1 };
}
// 點到線段：回傳距離、參數 t 與最近點
export function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const L2 = dx * dx + dz * dz || 1e-9;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / L2, 0, 1);
  const qx = ax + dx * t;
  const qz = az + dz * t;
  return { d: Math.hypot(px - qx, pz - qz), t, qx, qz };
}
// 最小外接矩形（凸包旋轉卡尺）：中心、方向角（局部 x 軸 = (cos, sin)）、半寬半深
function obb(r) {
  const pts = [];
  for (let k = 0; k < r.length; k += 2) pts.push([r[k], r[k + 1]]);
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const p of pts) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
    lo.push(p);
  }
  const up = [];
  for (let k = pts.length - 1; k >= 0; k--) {
    const p = pts[k];
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
    up.push(p);
  }
  const hull = lo.slice(0, -1).concat(up.slice(0, -1));
  let best = null;
  for (let k = 0; k < hull.length; k++) {
    const a = hull[k];
    const b = hull[(k + 1) % hull.length];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    let u0 = Infinity;
    let u1 = -Infinity;
    let v0 = Infinity;
    let v1 = -Infinity;
    for (const [x, z] of hull) {
      const u = x * c + z * s;
      const v = -x * s + z * c;
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
      v0 = Math.min(v0, v);
      v1 = Math.max(v1, v);
    }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area) {
      const um = (u0 + u1) / 2;
      const vm = (v0 + v1) / 2;
      best = { area, ang, hw: (u1 - u0) / 2, hd: (v1 - v0) / 2, cx: um * c - vm * s, cz: um * s + vm * c };
    }
  }
  return best;
}

// 均勻格子索引
class Grid {
  constructor(cell) {
    this.cell = cell;
    this.m = new Map();
    this.stamp = 0;
  }
  add(x0, z0, x1, z1, item) {
    const c = this.cell;
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) {
      for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
        const k = i * 100003 + j;
        let a = this.m.get(k);
        if (!a) this.m.set(k, (a = []));
        a.push(item);
      }
    }
  }
  query(x0, z0, x1, z1, fn) {
    const c = this.cell;
    const st = ++this.stamp;
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) {
      for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
        const a = this.m.get(i * 100003 + j);
        if (!a) continue;
        for (const it of a) {
          if (it._q === st) continue;
          it._q = st;
          if (fn(it) === false) return;
        }
      }
    }
  }
}
const ckey = (x, z) => `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
function bucket(map, key, v) {
  let a = map.get(key);
  if (!a) map.set(key, (a = []));
  a.push(v);
}

// ── 解碼 ──
export function decodeOsm(J) {
  const D = { id: J.id, lat: J.lat, lon: J.lon, half: J.half, sea: J.sea, flat: J.flat, skate: J.skate, names: J.names, cats: J.cats };
  const N = undelta(J.nodes);
  D.N = N;
  const deg = new Uint16Array(N.length / 2);
  const drv = new Uint16Array(N.length / 2);
  D.roads = J.roads.map(([cls, flags, lanes, wdm, name, idx], ri) => {
    const C = RC[cls];
    let w = wdm ? wdm / 10 : lanes ? lanes * 3.2 + (cls >= 2 && cls <= 5 ? 1.6 : 0) : C.w;
    w = clamp(w, 1.8, 26);
    const ix = Int32Array.from(idx);
    for (let k = 0; k < ix.length; k++) {
      deg[ix[k]] += k === 0 || k === ix.length - 1 ? 1 : 2;
      if (C.drive || cls === 7) drv[ix[k]] += k === 0 || k === ix.length - 1 ? 1 : 2;
    }
    return { i: ri, cls, oneway: !!(flags & 1), bridge: !!(flags & 2), lanes, w, name: J.names[name] || '', idx: ix };
  });
  D.deg = deg;
  D.drv = drv;
  D.sig = new Set(J.sig);
  // 道路切成 ≤ 20 公尺的小段：每段只由中點所在的圖磚負責畫，碰撞與查詢走格子索引
  D.pieces = [];
  D.pGrid = new Grid(24);
  D.pChunk = new Map();
  for (const r of D.roads) {
    const walk = RC[r.cls].walk;
    for (let k = 0; k + 1 < r.idx.length; k++) {
      const a = r.idx[k];
      const b = r.idx[k + 1];
      const ax = N[a * 2];
      const az = N[a * 2 + 1];
      const bx = N[b * 2];
      const bz = N[b * 2 + 1];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 0.05) continue;
      const n = Math.max(1, Math.ceil(L / 20));
      for (let s = 0; s < n; s++) {
        const p = {
          r, k, x0: ax + ((bx - ax) * s) / n, z0: az + ((bz - az) * s) / n, x1: ax + ((bx - ax) * (s + 1)) / n, z1: az + ((bz - az) * (s + 1)) / n,
          first: s === 0 ? a : -1, last: s === n - 1 ? b : -1,
        };
        D.pieces.push(p);
        const e = r.w / 2 + walk + 1;
        D.pGrid.add(Math.min(p.x0, p.x1) - e, Math.min(p.z0, p.z1) - e, Math.max(p.x0, p.x1) + e, Math.max(p.z0, p.z1) + e, p);
        bucket(D.pChunk, ckey((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2), p);
      }
    }
  }
  // 節點（路口圓盤、號誌）依位置分到圖磚
  D.nChunk = new Map();
  for (let k = 0; k < N.length / 2; k++) if (deg[k] >= 2) bucket(D.nChunk, ckey(N[k * 2], N[k * 2 + 1]), k);
  // 每個節點連到的道路（交通圖、號誌方向）
  D.nodeRoads = new Map();
  for (const r of D.roads) {
    for (let k = 0; k < r.idx.length; k++) {
      const n = r.idx[k];
      if (!D.nodeRoads.has(n)) D.nodeRoads.set(n, []);
      D.nodeRoads.get(n).push([r, k]);
    }
  }

  // 建物
  D.blds = J.bld.map(([h, mh, lv, type, col, name, roof, ring], k) => {
    const r = undelta(ring);
    const bb = aabb(r);
    let cx = 0;
    let cz = 0;
    for (let q = 0; q < r.length; q += 2) {
      cx += r[q];
      cz += r[q + 1];
    }
    cx /= r.length / 2;
    cz /= r.length / 2;
    return { k, ring: r, ...bb, cx, cz, h: h / 10, mh: mh / 10, lv, type, col, name: J.names[name] || '', roof, area: Math.abs(ringArea(r)), obj: null };
  });
  D.bGrid = new Grid(32);
  D.bChunk = new Map();
  for (const b of D.blds) {
    D.bGrid.add(b.x0, b.z0, b.x1, b.z1, b);
    bucket(D.bChunk, ckey(b.cx, b.cz), b.k);
  }

  // 面
  const polys = (arr) => arr.map((rings) => {
    const R = rings.map((q) => undelta(q));
    return { rings: R, ...aabb(R[0]), area: Math.abs(ringArea(R[0])) };
  });
  D.water = polys(J.water);
  D.green = J.green.map(([cls, ...rings]) => ({ cls: GC[cls] || 'park', ...polys([rings])[0] }));
  D.wGrid = new Grid(48);
  for (const w of D.water) D.wGrid.add(w.x0, w.z0, w.x1, w.z1, w);
  D.gGrid = new Grid(48);
  for (const g of D.green) D.gGrid.add(g.x0, g.z0, g.x1, g.z1, g);
  D.wChunk = new Map();
  D.gChunk = new Map();
  const spread = (map, it) => {
    for (let i = Math.floor(it.x0 / CHUNK); i <= Math.floor(it.x1 / CHUNK); i++) for (let j = Math.floor(it.z0 / CHUNK); j <= Math.floor(it.z1 / CHUNK); j++) bucket(map, `${i},${j}`, it);
  };
  for (const w of D.water) spread(D.wChunk, w);
  for (const g of D.green) spread(D.gChunk, g);

  // 點
  const pts = (a, map) => {
    const P = undelta(a);
    for (let k = 0; k < P.length; k += 2) bucket(map, ckey(P[k], P[k + 1]), [P[k], P[k + 1]]);
    return P.length / 2;
  };
  D.tChunk = new Map();
  D.lChunk = new Map();
  D.nTrees = pts(J.trees, D.tChunk);
  D.nLamps = pts(J.lamps, D.lChunk);
  D.pois = J.pois.map(([x, z, c, n]) => ({ x: x / 10, z: z / 10, cat: J.cats[c], name: J.names[n] }));
  D.poiGrid = new Grid(32);
  for (const p of D.pois) D.poiGrid.add(p.x, p.z, p.x, p.z, p);

  // 高程
  if (J.dem) {
    const raw = typeof atob === 'function' ? Uint8Array.from(atob(J.dem.h), (c) => c.charCodeAt(0)) : Uint8Array.from(Buffer.from(J.dem.h, 'base64'));
    const q = new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2);
    const H = new Float32Array(q.length);
    let v = 0;
    for (let k = 0; k < q.length; k++) {
      v += q[k];
      H[k] = v / 10;
    }
    let sum = 0;
    for (let k = 0; k < H.length; k++) sum += H[k];
    D.dem = { n: J.dem.n, step: J.dem.step, x0: J.dem.x0, base: J.dem.base, H, c: ((J.dem.n - 1) * J.dem.step) / 2, mean: sum / H.length };
  } else D.dem = null;
  return D;
}

// 店家種類 → 室內家具用的 SHOPS id
function shopKind(cat, seed) {
  const c = cat || '';
  if (/cafe|coffee|tea/.test(c)) return 'cafe';
  if (/bakery|pastry|confection|chocolate|ice_cream/.test(c)) return 'bakery';
  if (/books|stationery|newsagent/.test(c)) return 'books';
  if (/supermarket|convenience|greengrocer|grocery|alcohol|wine|beverages|deli|organic/.test(c)) return 'grocery';
  if (/pizza|italian/.test(c)) return 'pizza';
  if (/laundry|dry_cleaning/.test(c)) return 'laundry';
  if (/pharmacy|chemist|optician|medical/.test(c)) return 'pharmacy';
  if (/bicycle/.test(c)) return 'bike';
  if (/music|video|record|electronics/.test(c)) return 'records';
  if (/ramen|japanese|noodle|sushi|asian|chinese|thai|korean|vietnamese|taiwanese/.test(c)) return 'ramen';
  if (/art|gallery|frame|antiques|craft|gift/.test(c)) return 'gallery';
  if (/surf|sports|outdoor/.test(c)) return 'surf';
  if (/florist|garden/.test(c)) return 'flower';
  if (/restaurant|fast_food|butcher|bar|pub|burger|sandwich|bank/.test(c)) return 'deli';
  return pick(mulberry32(seed), ['gallery', 'books', 'records', 'grocery', 'flower']);
}

const FLOORS_DEFAULT = { metro: [5, 12], canal: [3, 5], hills: [2, 4], town: [1, 2], beach: [1, 3] };

function bspline(t) {
  const t2 = t * t;
  const t3 = t2 * t;
  const u = 1 - t;
  return [(u * u * u) / 6, (3 * t3 - 6 * t2 + 4) / 6, (-3 * t3 + 3 * t2 + 3 * t + 1) / 6, t3 / 6];
}

export class OsmWorld extends World {
  constructor(place, D) {
    super(place);
    this.osm = D;
    this.K = { ...this.K, grid: false, osm: true };
    this.chunkW = CHUNK;
    this.chunkD = CHUNK;
    this.origin = { lat: D.lat, lon: D.lon };
    this.skateRect = D.skate ? { x0: D.skate[0], z0: D.skate[1], x1: D.skate[2], z1: D.skate[3] } : null;
    this.waterY = D.sea ? 0 : D.flat && D.water.length ? -1.8 : -999;
    this.bcache = new Map();
  }

  // ── 地形 ──
  terrain(x, z) {
    const d = this.osm.dem;
    if (!d) return 0;
    // 三次 B 樣條：比雙線性平滑（沒有格線上的折角），路面、人行道與地面各自線性內插時才不會互相穿出
    const fx = clamp((x - d.x0) / d.step, 0, d.n - 1.001);
    const fz = clamp((z - d.x0) / d.step, 0, d.n - 1.001);
    const a = Math.floor(fx);
    const b = Math.floor(fz);
    const H = d.H;
    const n = d.n;
    const wx = bspline(fx - a);
    const wz = bspline(fz - b);
    let h = 0;
    for (let j = 0; j < 4; j++) {
      const row = clamp(b + j - 1, 0, n - 1) * n;
      let s = 0;
      for (let i = 0; i < 4; i++) s += H[row + clamp(a + i - 1, 0, n - 1)] * wx[i];
      h += s * wz[j];
    }
    // 資料範圍外：邊緣的值不往外拉成條紋，海岸地點的低地沉到海底、內陸淡到平均高度
    const out = Math.max(Math.abs(x - d.x0 - d.c), Math.abs(z - d.x0 - d.c)) - d.c;
    if (out > 0) h = lerp(h, this.osm.sea ? (h < 2 ? -25 : h) : d.mean, clamp(out / 300, 0, 1));
    return h;
  }
  inSkate(x, z) {
    const s = this.skateRect;
    return !!s && x > s.x0 + 4 && x < s.x1 - 4 && z > s.z0 + 4 && z < s.z1 - 4;
  }
  inWater(x, z) {
    let hit = false;
    this.osm.wGrid.query(x, z, x, z, (w) => {
      if (x >= w.x0 && x <= w.x1 && z >= w.z0 && z <= w.z1 && inPoly(w.rings, x, z)) {
        hit = true;
        return false;
      }
      return true;
    });
    return hit;
  }
  // 最近的道路小段（含路寬內判定）
  roadAt(x, z, pad = 0, filter = null) {
    let best = null;
    let bd = Infinity;
    this.osm.pGrid.query(x, z, x, z, (p) => {
      if (filter && !filter(p.r)) return;
      const q = segDist(x, z, p.x0, p.z0, p.x1, p.z1);
      const lim = p.r.w / 2 + pad;
      if (q.d < lim && q.d - lim < bd) {
        bd = q.d - lim;
        best = { p, ...q };
      }
    });
    return best;
  }
  bridgeAt(x, z) {
    const h = this.roadAt(x, z, 0.4, (r) => r.bridge);
    return h ? 0.45 : null;
  }

  groundAt(x, z) {
    const t = this.terrain(x, z);
    if (this.skateRect && this.inSkate(x, z)) return t + CURB + this.skateOffset(x, z);
    if (this.osm.flat && this.waterY > -900 && this.inWater(x, z)) {
      const br = this.bridgeAt(x, z);
      return br !== null ? br : this.waterY - 2.7;
    }
    return t + ROAD_Y;
  }

  waterAt(x, z) {
    if (this.waterY < -900) return null;
    if (this.osm.flat) return this.inWater(x, z) && this.bridgeAt(x, z) === null ? this.waterY : null;
    return this.terrain(x, z) < this.waterY ? this.waterY : null;
  }

  greenAt(x, z) {
    let g = null;
    this.osm.gGrid.query(x, z, x, z, (it) => {
      if (x >= it.x0 && x <= it.x1 && z >= it.z0 && z <= it.z1 && inPoly(it.rings, x, z)) {
        g = it;
        return false;
      }
      return true;
    });
    return g;
  }

  surfaceAt(x, z) {
    if (this.waterAt(x, z) !== null && this.groundAt(x, z) < this.waterY) return 'water';
    if (this.skateRect && this.inSkate(x, z)) return 'concrete';
    const r = this.roadAt(x, z);
    if (r) return RC[r.p.r.cls].drive || r.p.r.cls === 7 ? 'road' : 'walk';
    if (this.osm.sea && this.terrain(x, z) < 1.2) return 'sand';
    const g = this.greenAt(x, z);
    if (g) return g.cls === 'sand' ? 'sand' : g.cls === 'parking' || g.cls === 'pier' ? 'road' : 'grass';
    return this.kind === 'town' ? 'grass' : 'walk';
  }

  // 出生點：離原點最近的車道旁人行道
  spawnPoint(at) {
    if (this.skateRect && at && this.inSkate(at.x, at.z)) return at;
    let best = null;
    for (const p of this.osm.pieces) {
      if (!RC[p.r.cls].drive) continue;
      const q = segDist(0, 0, p.x0, p.z0, p.x1, p.z1);
      if (!best || q.d < best.q.d) best = { p, q };
    }
    if (!best) return at || { x: 0, z: 0, yaw: 0 };
    const { p, q } = best;
    const L = Math.hypot(p.x1 - p.x0, p.z1 - p.z0) || 1;
    const dx = (p.x1 - p.x0) / L;
    const dz = (p.z1 - p.z0) / L;
    const off = p.r.w / 2 + Math.max(1.4, RC[p.r.cls].walk * 0.6);
    for (const side of [1, -1]) {
      const x = q.qx - dz * off * side;
      const z = q.qz + dx * off * side;
      if (!this.buildingAt(x, z, 0.6)) return { x, z, yaw: Math.atan2(dx, -dz) };
    }
    return { x: q.qx, z: q.qz, yaw: Math.atan2(dx, -dz) };
  }

  // ── 建物 ──
  buildingAt(x, z, pad = 0) {
    let hit = null;
    this.osm.bGrid.query(x - pad, z - pad, x + pad, z + pad, (b) => {
      if (x < b.x0 - pad || x > b.x1 + pad || z < b.z0 - pad || z > b.z1 + pad) return true;
      if (inRing(b.ring, x, z)) {
        hit = b;
        return false;
      }
      if (pad > 0) {
        const r = b.ring;
        for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
          if (segDist(x, z, r[j], r[j + 1], r[i], r[i + 1]).d < pad) {
            hit = b;
            return false;
          }
        }
      }
      return true;
    });
    return hit;
  }
  buildingsNear(x, z, rad) {
    const out = [];
    this.osm.bGrid.query(x - rad, z - rad, x + rad, z + rad, (b) => {
      if (x > b.x0 - rad && x < b.x1 + rad && z > b.z0 - rad && z < b.z1 + rad) out.push(this.building(b.k));
    });
    return out;
  }
  findBuilding(id) {
    for (const b of this.bcache.values()) if (b.id === id) return b;
    return null;
  }

  building(k) {
    let b = this.bcache.get(k);
    if (b) return b;
    const D = this.osm;
    const src = D.blds[k];
    const kind = this.kind;
    const rnd = mulberry32((this.seed * 7919 + k * 2654435761) >>> 0);
    const r = src.ring;
    const fh = FLOOR_H[kind] || 3.2;
    const gh = GROUND_H[kind] || 3.6;
    let lo = Infinity;
    let hi = -Infinity;
    for (let q = 0; q < r.length; q += 2) {
      const h = this.terrain(r[q], r[q + 1]);
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
    const base = lo - 0.6;
    const floor0 = hi + ROAD_Y;
    const [f0, f1] = FLOORS_DEFAULT[kind] || [2, 4];
    let floors = src.lv || (src.h ? Math.max(1, Math.round((src.h - gh) / fh) + 1) : 0);
    if (!floors) {
      floors = src.type === 5 ? 1 : src.type === 0 ? Math.min(f1, 2) : f0 + Math.floor(rnd() * (f1 - f0 + 1));
      if (kind === 'metro' && src.area > 1500) floors += Math.floor(rnd() * 10);
    }
    floors = clamp(floors, 1, 120);
    const height = src.h ? floor0 - base + Math.max(2.4, src.h) : floor0 - base + gh + (floors - 1) * fh;
    // 外觀
    let style;
    if (kind === 'metro') style = floors > 24 ? (rnd() < 0.6 ? 'glass' : 'stone') : floors > 9 ? (rnd() < 0.55 ? 'stone' : this.place.id === 'taipei' ? 'stucco' : 'brick') : this.place.id === 'taipei' ? (rnd() < 0.5 ? 'stucco' : 'stone') : rnd() < 0.6 ? 'brick' : 'stone';
    else if (kind === 'canal') style = rnd() < 0.18 ? 'plaster' : 'canal';
    else if (kind === 'town') style = src.type === 0 || src.type === 5 ? 'siding' : src.type === 4 ? 'stone' : 'brick';
    else style = 'stucco';
    const palette = kind === 'beach' ? PAL.beach : style === 'plaster' ? [0xe8e2d4, 0xd8d3c5, 0x3b4a45, 0xefe9da] : PAL[style];
    const color = src.col || pick(rnd, palette);
    const o = obb(r);
    const fill = src.area / Math.max(1, 4 * o.hw * o.hd);
    const rect = fill > 0.84 && Math.min(o.hw, o.hd) > 1.8 && src.mh < 2;
    b = {
      id: `${this.place.id}:osm:${k}`, osm: true, k, seed: (this.seed * 31 + k * 131) >>> 0,
      x0: src.x0, z0: src.z0, x1: src.x1, z1: src.z1, poly: r, name: src.name,
      floors, floorH: fh, groundH: gh, base, floor0, height, minH: src.mh,
      style, color, trim: pick(rnd, [0xffffff, 0xf3eee3, 0x8a3b2e, 0x2f4858]), roof: 'flat', roofProps: [],
      shop: null, door: null, frame: null, rect,
    };
    b.parts = [{ x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1, top: height }];
    // 店家：多邊形內（或 4 公尺內）有名字的 shop／amenity
    let poi = null;
    D.poiGrid.query(src.x0 - 4, src.z0 - 4, src.x1 + 4, src.z1 + 4, (p) => {
      if (!poi && inRing(r, p.x, p.z)) poi = p;
    });
    if (poi) {
      const sid = shopKind(poi.cat, b.seed);
      const S = SHOPS.find((s) => s.id === sid) || SHOPS[0];
      b.shop = { ...S, name: poi.name };
    }
    if (rect) this.frameBuilding(b, o, rnd);
    this.bcache.set(k, b);
    return b;
  }

  // 局部座標系：選面向道路的一側當正面（局部北側），寫入沿用程序建物外觀與室內需要的欄位
  frameBuilding(b, o, rnd) {
    const kind = this.kind;
    const sides = [
      { s: 'n', nx: Math.sin(o.ang), nz: -Math.cos(o.ang), half: o.hd, along: o.hw, rot: 0 },
      { s: 's', nx: -Math.sin(o.ang), nz: Math.cos(o.ang), half: o.hd, along: o.hw, rot: Math.PI },
      { s: 'e', nx: Math.cos(o.ang), nz: Math.sin(o.ang), half: o.hw, along: o.hd, rot: Math.PI / 2 },
      { s: 'w', nx: -Math.cos(o.ang), nz: -Math.sin(o.ang), half: o.hw, along: o.hd, rot: -Math.PI / 2 },
    ];
    const roadNear = (x, z) => {
      let d = Infinity;
      this.osm.pGrid.query(x - 30, z - 30, x + 30, z + 30, (p) => {
        if (p.r.cls >= 9) return;
        d = Math.min(d, segDist(x, z, p.x0, p.z0, p.x1, p.z1).d - p.r.w / 2);
      });
      return d;
    };
    for (const sd of sides) sd.d = roadNear(o.cx + sd.nx * sd.half, o.cz + sd.nz * sd.half) - (sd.along > 3 ? 0 : 6);
    const front = sides.reduce((a, c) => (c.d < a.d ? c : a));
    const ang = o.ang + front.rot;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const hw = front.s === 'n' || front.s === 's' ? o.hw : o.hd;
    const hd = front.s === 'n' || front.s === 's' ? o.hd : o.hw;
    b.frame = { cx: o.cx, cz: o.cz, c, s, ang, hw, hd };
    b.front = 'n';
    // 轉角：左右兩側也臨路
    const sideOf = (lx, lz) => roadNear(o.cx + lx * c - lz * s, o.cz + lx * s + lz * c);
    const wD = sideOf(-hw - 0.5, 0);
    const eD = sideOf(hw + 0.5, 0);
    b.corner = wD < 6 ? 'w' : eD < 6 ? 'e' : null;
    b.door = { ...this.toWorld(b, 0, -hd), side: 'n' };
    const narrow = hw * 2 < 11;
    if (kind === 'canal') b.roof = narrow && b.floors <= 6 ? pick(rnd, ['gable', 'step', 'neck', 'gable', 'bell']) : 'flat';
    else if (kind === 'town') {
      b.roof = b.style === 'siding' ? (rnd() < 0.5 ? 'hip' : 'gablex') : 'flat';
      b.roofColor = pick(rnd, [0x4a4f57, 0x6b4f3f, 0x3e4a5a, 0x5c5f63]);
      b.porch = b.style === 'siding' && b.floors <= 2 && hw > 3.5 && rnd() < 0.6;
    } else if (kind === 'hills') {
      b.roof = narrow && b.floors <= 3 && rnd() < 0.3 ? 'gablex' : 'flat';
      b.bay = b.floors >= 2 && narrow && rnd() < 0.7;
      b.stoop = rnd() < 0.4;
    } else if (kind === 'metro') {
      b.stoop = b.style === 'brick' && b.floors < 8 && rnd() < 0.5;
      const top = { x0: -hw, x1: hw, z0: -hd, z1: hd };
      if ((b.style === 'brick' || b.style === 'stone') && b.floors < 24 && rnd() < 0.4) b.roofProps.push({ type: 'watertower', x: lerp(top.x0, top.x1, 0.3 + rnd() * 0.4), z: lerp(top.z0, top.z1, 0.3 + rnd() * 0.4) });
      if (rnd() < 0.6) b.roofProps.push({ type: 'hvac', x: lerp(top.x0, top.x1, 0.25 + rnd() * 0.5), z: lerp(top.z0, top.z1, 0.25 + rnd() * 0.5) });
      if (b.floors > 40 && rnd() < 0.5) b.roofProps.push({ type: 'antenna', x: 0, z: 0 });
    } else if (kind === 'beach' && rnd() < 0.5) b.roofProps.push({ type: 'hvac', x: 0, z: 0 });
    if (kind === 'canal') b.stoop = rnd() < 0.35;
    // 正面被隔壁建物擋住或離路太遠（街廓內側）：沒有門、台階與凸窗
    let blocked = front.d > 14 || [-0.6, 0, 0.6].some((u) => {
      const q = this.toWorld(b, u * hw, -hd - 2.5);
      const o2 = this.buildingAt(q.x, q.z, 0);
      return o2 && o2.k !== b.k;
    });
    // 坡地：門前人行道比一樓地板低時補一段台階，太陡就不開門
    if (!blocked && !this.osm.flat) {
      const q = this.toWorld(b, 0, -hd - 1.2);
      const gy = this.terrain(q.x, q.z) + ROAD_Y;
      const drop = b.floor0 - gy;
      if (drop > 2.6) blocked = true;
      else if (drop > 0.35) {
        b.stoop = true;
        b.stoopY = gy;
      }
    }
    if (blocked) {
      b.door = null;
      b.stoop = false;
      b.bay = false;
      b.porch = false;
    }
  }
  // 滑板場範圍內的步道不畫（場地本身是程序生成的）
  skatePieces(ps) {
    const sk = this.skateRect;
    if (!sk) return ps;
    return ps.filter((p) => {
      if (p.r.cls < 8) return true;
      const x = (p.x0 + p.x1) / 2;
      const z = (p.z0 + p.z1) / 2;
      return !(x > sk.x0 && x < sk.x1 && z > sk.z0 && z < sk.z1);
    });
  }
  skateNodes(ns) {
    const sk = this.skateRect;
    if (!sk) return ns;
    const N = this.osm.N;
    return ns.filter((n) => !(N[n * 2] > sk.x0 && N[n * 2] < sk.x1 && N[n * 2 + 1] > sk.z0 && N[n * 2 + 1] < sk.z1));
  }
  toWorld(b, lx, lz) {
    const f = b.frame;
    return { x: f.cx + lx * f.c - lz * f.s, z: f.cz + lx * f.s + lz * f.c };
  }

  // ── 圖磚 ──
  generateChunk(i, j) {
    const D = this.osm;
    const key = `${i},${j}`;
    const c = {
      key, i, j, x0: i * CHUNK, z0: j * CHUNK, x1: (i + 1) * CHUNK, z1: (j + 1) * CHUNK, use: 'osm',
      layers: { transportation: [], building: [], water: [], park: [], landuse: [], poi: [] },
      props: {
        lamps: [], trees: [], palms: [], pines: [], tlights: [], hydrants: [], benches: [], parked: [],
        boats: [], bikes: [], rocks: [], railings: [], hedges: [], lifeguard: [], towers: [], ship: [],
      },
      osm: { pieces: this.skatePieces(D.pChunk.get(key) || []), nodes: this.skateNodes(D.nChunk.get(key) || []), water: D.wChunk.get(key) || [], green: D.gChunk.get(key) || [] },
    };
    const L = c.layers;
    const P = c.props;
    const rnd = mulberry32((this.seed * 7919 + i * 92821 + j * 68917) >>> 0);
    for (const k of D.bChunk.get(key) || []) {
      const b = this.building(k);
      L.building.push(b);
      if (b.shop) L.poi.push({ x: b.door ? b.door.x : D.blds[k].cx, z: b.door ? b.door.z : D.blds[k].cz, name: b.shop.name, type: b.shop.id, building: b.id });
    }
    for (const p of c.osm.pieces) L.transportation.push({ x0: p.x0, z0: p.z0, x1: p.x1, z1: p.z1, w: p.r.w, cls: RC[p.r.cls].n, osm: true });
    for (const w of c.osm.water) L.water.push(w);
    for (const g of c.osm.green) L.park.push(g);
    if (this.skateRect && i === 0 && j === 0) {
      L.landuse.push({ ...this.skateRect, cls: 'skatepark' });
      L.poi.push({ x: (this.skateRect.x0 + this.skateRect.x1) / 2, z: (this.skateRect.z0 + this.skateRect.z1) / 2, name: '海濱滑板公園', type: 'skate' });
    }
    this.chunkProps(c, rnd);
    return c;
  }

  // 街道家具：OSM 的樹與路燈，其餘沿路程序擺放（以圖磚種子固定）
  chunkProps(c, rnd) {
    const D = this.osm;
    const P = c.props;
    const kind = this.kind;
    const free = (x, z, pad) => !this.buildingAt(x, z, pad) && !this.roadAt(x, z, 0.6) && this.waterAt(x, z) === null && !(this.skateRect && this.inSkate(x, z));
    const palmy = kind === 'beach';
    const sk = this.skateRect;
    const inSk = (x, z) => sk && x > sk.x0 - 1 && x < sk.x1 + 1 && z > sk.z0 - 1 && z < sk.z1 + 1;
    for (const [x, z] of D.tChunk.get(c.key) || []) {
      if (inSk(x, z)) continue;
      if (palmy && rnd() < 0.6) P.palms.push({ x, z, h: 9 + rnd() * 6 });
      else P.trees.push({ x, z, h: 6 + rnd() * 4, kind: kind === 'canal' ? 'elm' : kind === 'town' ? 'oak' : 'street' });
    }
    for (const [x, z] of D.lChunk.get(c.key) || []) {
      if (inSk(x, z)) continue;
      const r = this.roadAt(x, z, 8);
      let rot = 0;
      if (r) rot = Math.atan2(r.qx - x, r.qz - z);
      P.lamps.push({ x, z, rot, kind: kind === 'canal' ? 'lantern' : 'cobra' });
    }
    const genLamps = D.nLamps < 150;
    // 沿路：路燈、停放車輛、消防栓、行道樹（郊區）、棕櫚（海濱）
    for (const p of c.osm.pieces) {
      const r = p.r;
      const C = RC[r.cls];
      if (!C.drive || r.bridge) continue;
      const L = Math.hypot(p.x1 - p.x0, p.z1 - p.z0);
      if (L < 4) continue;
      const dx = (p.x1 - p.x0) / L;
      const dz = (p.z1 - p.z0) / L;
      const prr = mulberry32(hash2(r.i, p.k * 64 + Math.round(p.x0), 77) * 4294967296);
      const nearJ = (x, z) => {
        for (const n of [r.idx[p.k], r.idx[p.k + 1]]) if (D.drv[n] >= 3 && Math.hypot(D.N[n * 2] - x, D.N[n * 2 + 1] - z) < r.w / 2 + 9) return true;
        return false;
      };
      for (const side of [1, -1]) {
        const rx = -dz * side;
        const rz = dx * side;
        const curb = r.w / 2;
        if (genLamps && C.walk && prr() < 0.55) {
          const t = prr() * L;
          const x = p.x0 + dx * t + rx * (curb + 0.7);
          const z = p.z0 + dz * t + rz * (curb + 0.7);
          if (free(x, z, 0.4)) P.lamps.push({ x, z, rot: Math.atan2(-rx, -rz), kind: kind === 'canal' ? 'lantern' : 'cobra' });
        }
        const parkP = { metro: 0.25, canal: 0.3, hills: 0.55, town: 0.35, beach: 0.45 }[kind] ?? 0.3;
        if (r.cls >= 3 && r.cls <= 5 && r.w >= 6 && prr() < parkP) {
          for (let t = 3 + prr() * 2; t < L - 3; t += 6.2 + prr() * 1.5) {
            if (prr() < 0.35) continue;
            const x = p.x0 + dx * t + rx * (curb - 1.15);
            const z = p.z0 + dz * t + rz * (curb - 1.15);
            if (nearJ(x, z) || this.buildingAt(x, z, 1.2)) continue;
            P.parked.push({ x, z, rot: Math.atan2(dx * side, dz * side), model: pick(prr, ['sedan', 'suv', 'hatch', 'pickup', 'van', 'sedan']), color: pick(prr, CAR_COLORS) });
          }
        }
        if ((kind === 'metro' || kind === 'town') && C.walk && prr() < 0.12) {
          const x = p.x0 + dx * L * 0.5 + rx * (curb + 0.6);
          const z = p.z0 + dz * L * 0.5 + rz * (curb + 0.6);
          if (free(x, z, 0.3)) P.hydrants.push({ x, z });
        }
        if (palmy && C.walk && prr() < 0.5) {
          const x = p.x0 + dx * L * 0.3 + rx * (curb + 1.2);
          const z = p.z0 + dz * L * 0.3 + rz * (curb + 1.2);
          if (free(x, z, 1)) P.palms.push({ x, z, h: 10 + prr() * 6 });
        }
        if (kind === 'town' && r.cls === 5 && prr() < 0.6) {
          const x = p.x0 + dx * L * prr() + rx * (curb + 2.5 + prr() * 6);
          const z = p.z0 + dz * L * prr() + rz * (curb + 2.5 + prr() * 6);
          if (free(x, z, 2)) P.trees.push({ x, z, h: 8 + prr() * 5, kind: 'oak' });
        }
      }
    }
    // 號誌：每個號誌節點對每條進入的車道立一支
    for (const n of c.osm.nodes) {
      if (!D.sig.has(n)) continue;
      const nx = D.N[n * 2];
      const nz = D.N[n * 2 + 1];
      let k = 0;
      for (const [r, at] of D.nodeRoads.get(n) || []) {
        if (!RC[r.cls].drive || k >= 4) continue;
        for (const dir of [-1, 1]) {
          const o = at + dir;
          if (o < 0 || o >= r.idx.length) continue;
          const m = r.idx[o];
          const L = Math.hypot(D.N[m * 2] - nx, D.N[m * 2 + 1] - nz) || 1;
          const ux = (D.N[m * 2] - nx) / L; // 由路口往外
          const uz = (D.N[m * 2 + 1] - nz) / L;
          // 進入路口的車（往 -u 開）靠右：右側是 (uz, -ux)
          const rx = uz;
          const rz = -ux;
          if (r.oneway && dir > 0) continue; // 單行道只有從前一個節點駛入
          const back = Math.max(4, r.w * 0.5 + 2.5);
          const x = nx + ux * back + rx * (r.w / 2 + 0.9);
          const z = nz + uz * back + rz * (r.w / 2 + 0.9);
          P.tlights.push({ x, z, osm: true, arm: [-rx, -rz], face: [ux, uz], reach: Math.min(r.w * 0.6, 6), axis: Math.abs(ux) > Math.abs(uz) ? 'x' : 'z' });
          k++;
        }
      }
    }
    // 公園與綠地：樹與長椅；郊區的空地也種樹
    for (const g of c.osm.green) {
      const dens = { park: 160, garden: 120, forest: 45, cemetery: 220 }[g.cls];
      if (!dens) continue;
      const x0 = Math.max(c.x0, g.x0);
      const x1 = Math.min(c.x1, g.x1);
      const z0 = Math.max(c.z0, g.z0);
      const z1 = Math.min(c.z1, g.z1);
      if (x1 <= x0 || z1 <= z0) continue;
      const n = Math.min(60, Math.round(((x1 - x0) * (z1 - z0)) / dens));
      for (let q = 0; q < n; q++) {
        const x = lerp(x0, x1, rnd());
        const z = lerp(z0, z1, rnd());
        if (!inPoly(g.rings, x, z) || !free(x, z, 2)) continue;
        if (palmy) P.palms.push({ x, z, h: 9 + rnd() * 6 });
        else P.trees.push({ x, z, h: 7 + rnd() * 6, kind: rnd() < 0.5 ? 'oak' : 'elm' });
      }
      if (g.cls === 'park' && rnd() < 0.6) {
        const x = lerp(x0, x1, 0.5);
        const z = lerp(z0, z1, 0.5);
        if (inPoly(g.rings, x, z) && free(x, z, 1)) P.benches.push({ x, z, rot: rnd() * Math.PI });
      }
    }
    if (kind === 'town') {
      for (let q = 0; q < 24; q++) {
        const x = lerp(c.x0, c.x1, rnd());
        const z = lerp(c.z0, c.z1, rnd());
        if (Math.abs(x) > D.half || Math.abs(z) > D.half) continue;
        if (free(x, z, 3) && !this.roadAt(x, z, 3)) P.trees.push({ x, z, h: 8 + rnd() * 6, kind: 'oak' });
      }
    }
    // 運河：沿岸停泊的船屋
    if (kind === 'canal' && this.waterY > -900) {
      for (const w of c.osm.water) {
        const r = w.rings[0];
        for (let a = 0, b = r.length - 2; a < r.length; b = a, a += 2) {
          const ax = r[b];
          const az = r[b + 1];
          const bx = r[a];
          const bz = r[a + 1];
          const mx = (ax + bx) / 2;
          const mz = (az + bz) / 2;
          if (mx < c.x0 || mx >= c.x1 || mz < c.z0 || mz >= c.z1) continue;
          const L = Math.hypot(bx - ax, bz - az);
          if (L < 18) continue;
          const dx = (bx - ax) / L;
          const dz = (bz - az) / L;
          // 往水裡的法線：環的方向不固定，直接測試
          let ix = -dz;
          let iz = dx;
          if (!inPoly(w.rings, mx + ix, mz + iz)) {
            ix = -ix;
            iz = -iz;
          }
          let t = 3 + rnd() * 4;
          while (t < L - 14) {
            const len = 14 + rnd() * 9;
            if (t + len > L - 2) break;
            const x = ax + dx * (t + len / 2) + ix * 2.7;
            const z = az + dz * (t + len / 2) + iz * 2.7;
            if (rnd() < 0.6 && this.waterAt(x, z) !== null && this.waterAt(x + ix * 2.2, z + iz * 2.2) !== null && !this.roadAt(x, z, 10, (rr) => rr.bridge)) {
              P.boats.push({
                x, z, len, w: 4.2 + rnd() * 0.6, ang: Math.atan2(dz, dx), kind: rnd() < 0.75 ? 'houseboat' : 'sloop',
                color: pick(rnd, [0x41604d, 0x1f3044, 0x23282c, 0x7a2a22, 0x2f4f6f, 0x5b6b3d, 0x8a7f6a]), roof: pick(rnd, [0x2a2f33, 0x6b4e3b, 0x8c8c86]),
              });
            }
            t += len + 2 + rnd() * 6;
          }
        }
      }
    }
  }
}

// 建物局部座標 ↔ 世界座標（沒有 frame 的程序建物原樣通過）
export function toLocal(b, x, z) {
  const f = b.frame;
  if (!f) return { x, z };
  const dx = x - f.cx;
  const dz = z - f.cz;
  return { x: dx * f.c + dz * f.s, z: -dx * f.s + dz * f.c };
}
export function toWorldPt(b, x, z) {
  const f = b.frame;
  if (!f) return { x, z };
  return { x: f.cx + x * f.c - z * f.s, z: f.cz + x * f.s + z * f.c };
}
export function toWorldDir(b, x, z) {
  const f = b.frame;
  if (!f) return { x, z };
  return { x: x * f.c - z * f.s, z: x * f.s + z * f.c };
}
// 室內用：大樓只生成臨街的一個單位（寬、深 16 公尺以內），不然整棟飯店會變成一個大廳
export function interiorView(b) {
  const v = localView(b);
  if (!b.frame) return v;
  if (b._unit) return b._unit;
  const hw = Math.min(v.x1, 8);
  const z1 = Math.min(v.z1, v.z0 + 16);
  b._unit = hw === v.x1 && z1 === v.z1 ? v : { ...v, x0: -hw, x1: hw, z1, parts: [{ x0: -hw, z0: v.z0, x1: hw, z1, top: b.height }] };
  return b._unit;
}
// 給室內生成與程序外觀用的「局部版」建物：矩形在原點、門在局部座標
export function localView(b) {
  const f = b.frame;
  if (!f) return b;
  if (b._local) return b._local;
  const v = { ...b, x0: -f.hw, x1: f.hw, z0: -f.hd, z1: f.hd, frame: null, poly: null, src: b };
  v.parts = [{ x0: -f.hw, z0: -f.hd, x1: f.hw, z1: f.hd, top: b.height }];
  v.door = { x: 0, z: -f.hd, side: 'n' };
  b._local = v;
  return v;
}
