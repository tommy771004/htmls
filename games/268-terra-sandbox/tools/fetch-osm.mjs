// 預先烘焙真實地圖：OpenStreetMap（Overpass API，ODbL）＋ Terrarium 高程圖磚（AWS Terrain Tiles），
// 每個精選地點取以原點為中心、邊長 2×half 公尺的範圍，量化成 data/osm/<id>.json（打包時 gzip＋base64 內嵌）。
// 原始回應快取在 .cache/（gitignore）；只改編碼規則時加 --offline 直接重編，不再連網。
//   node tools/fetch-osm.mjs [id…] [--offline]
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { PLACES } from '../src/core/places.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = resolve(root, '.cache');
const OUT = resolve(root, 'data/osm');
const UA = 'terra268-prebake/1.0 (single-file demo; one-off download)';
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];

// half：涵蓋半徑（公尺）；sea：海平面在 y = 0（沿海）；flat：不用 DEM（阿姆斯特丹低於海平面、雜訊大）
export const OSM_CFG = {
  nyc: { half: 800 },
  ams: { half: 750, flat: true },
  sf: { half: 800, sea: true },
  // 威尼斯滑板公園在 OSM 沒有畫成面：取海濱步道在 Market／Windward 兩路口中點、往海灘側 70 公尺
  venice: { half: 750, sea: true, skate: [33.98679, -118.47451] },
  taipei: { half: 800 },
  kirkwood: { half: 800 },
};
const DEM_STEP = 8;
const DEM_Z = 15;

const args = process.argv.slice(2);
const offline = args.includes('--offline');
const ids = args.filter((a) => !a.startsWith('--'));
const todo = ids.length ? ids : Object.keys(OSM_CFG);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const M_LAT = 111320;

function bbox(lat, lon, half) {
  const dLat = (half + 60) / M_LAT;
  const dLon = (half + 60) / (M_LAT * Math.cos((lat * Math.PI) / 180));
  return [lat - dLat, lon - dLon, lat + dLat, lon + dLon];
}

async function overpass(q) {
  for (let round = 0; round < 4; round++) {
    for (const url of MIRRORS) {
      try {
        const res = await fetch(url, { method: 'POST', headers: { 'User-Agent': UA, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent(q)}` });
        const txt = await res.text();
        if (res.ok && txt.trimStart().startsWith('{')) return JSON.parse(txt);
        console.warn(`  ${url} → ${res.status}`);
      } catch (e) {
        console.warn(`  ${url} → ${e.message}`);
      }
    }
    await sleep(8000 * (round + 1));
  }
  throw new Error('Overpass 全部鏡像都失敗');
}

async function fetchOsm(id, lat, lon, half) {
  const file = resolve(CACHE, `osm/${id}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  if (offline) throw new Error(`${id}：沒有快取，不能 --offline`);
  const [s, w, n, e] = bbox(lat, lon, half).map((v) => v.toFixed(6));
  const q = `[out:json][timeout:180][bbox:${s},${w},${n},${e}];
(
  way[building];
  relation[building][type=multipolygon];
  way[highway];
  way[natural~"^(water|beach|sand|wood|scrub|grassland|bay)$"];
  relation[natural~"^(water|bay)$"];
  way[waterway~"^(canal|river|riverbank|dock)$"];
  relation[waterway=riverbank];
  way[water];
  way[leisure~"^(park|garden|pitch|playground|golf_course|swimming_pool|dog_park|skatepark)$"];
  relation[leisure~"^(park|garden)$"];
  way[landuse~"^(grass|forest|recreation_ground|meadow|village_green|cemetery)$"];
  way[amenity=parking];
  way[man_made=pier];
  node[natural=tree];
  node[highway~"^(traffic_signals|street_lamp)$"];
  node[shop][name];
  node[amenity~"^(cafe|restaurant|fast_food|bar|pub|bank|pharmacy|ice_cream|bicycle_rental)$"][name];
);
out body geom qt;`;
  console.log(`  Overpass ${id} …`);
  const j = await overpass(q);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(j));
  return j;
}

// ── Terrarium PNG（8 位元 RGB／RGBA，非交錯）──
function decodePng(buf) {
  let p = 8;
  let w = 0;
  let h = 0;
  let ct = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      if (data[8] !== 8 || data[12] !== 0) throw new Error('只支援 8 位元非交錯 PNG');
      ct = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 0;
  if (!bpp) throw new Error(`不支援的 PNG 色彩類型 ${ct}`);
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(w * h * bpp);
  const stride = w * bpp;
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - b);
        const pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + x] = v & 255;
    }
  }
  return { w, h, bpp, px: out };
}

const tiles = new Map();
async function tile(x, y) {
  const k = `${x}/${y}`;
  if (tiles.has(k)) return tiles.get(k);
  const file = resolve(CACHE, `dem/${DEM_Z}/${x}/${y}.png`);
  if (!existsSync(file)) {
    if (offline) throw new Error(`缺少高程圖磚 ${k}`);
    const res = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${DEM_Z}/${x}/${y}.png`, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`高程圖磚 ${k} → ${res.status}`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  const t = decodePng(readFileSync(file));
  tiles.set(k, t);
  return t;
}
async function elevation(lat, lon) {
  const n = 2 ** DEM_Z;
  const fx = ((lon + 180) / 360) * n * 256;
  const r = (lat * Math.PI) / 180;
  const fy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n * 256;
  const px = Math.floor(fx - 0.5);
  const py = Math.floor(fy - 0.5);
  const tx = fx - 0.5 - px;
  const ty = fy - 0.5 - py;
  const at = async (X, Y) => {
    const t = await tile(Math.floor(X / 256), Math.floor(Y / 256));
    const i = ((Y & 255) * 256 + (X & 255)) * t.bpp;
    return t.px[i] * 256 + t.px[i + 1] + t.px[i + 2] / 256 - 32768;
  };
  const a = await at(px, py);
  const b = await at(px + 1, py);
  const c = await at(px, py + 1);
  const d = await at(px + 1, py + 1);
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

// ── 編碼 ──
const RCLS = { motorway: 0, motorway_link: 0, trunk: 1, trunk_link: 1, primary: 2, primary_link: 2, secondary: 3, secondary_link: 3, tertiary: 4, tertiary_link: 4, residential: 5, unclassified: 5, road: 5, living_street: 6, service: 7, pedestrian: 8, footway: 9, path: 9, steps: 9, track: 9, bridleway: 9, cycleway: 10 };
const BTYPE = { house: 0, detached: 0, semidetached_house: 0, terrace: 1, apartments: 1, residential: 1, dormitory: 1, commercial: 2, retail: 2, office: 2, hotel: 2, supermarket: 2, industrial: 3, warehouse: 3, church: 4, cathedral: 4, chapel: 4, school: 4, university: 4, college: 4, public: 4, civic: 4, government: 4, hospital: 4, museum: 4, train_station: 4, garage: 5, garages: 5, shed: 5, carport: 5, roof: 5, hut: 5, kiosk: 5 };
const GREEN = { park: 0, garden: 1, pitch: 2, playground: 3, golf_course: 0, dog_park: 3, skatepark: 2, grass: 1, village_green: 1, recreation_ground: 0, meadow: 1, cemetery: 4, forest: 5, wood: 5, scrub: 1, grassland: 1, beach: 6, sand: 6, parking: 7, pier: 8, swimming_pool: 9 };
const NAMED_COLORS = { white: 0xf2f0ea, black: 0x2a2a2a, grey: 0x9a9a9a, gray: 0x9a9a9a, red: 0xa0463a, brown: 0x7a5236, beige: 0xd9c9a8, yellow: 0xe3cf7a, tan: 0xc8ab84, cream: 0xefe5cc, pink: 0xe2aaa6, blue: 0x7f98b8, green: 0x7f9a74, orange: 0xd98a4a, maroon: 0x6e2f2a };

function num(v) {
  if (v == null) return null;
  const m = /^\s*(-?[\d.]+)\s*(m|ft|'|)?/.exec(String(v).split(';')[0]);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? (m[2] === 'ft' || m[2] === "'" ? n * 0.3048 : n) : null;
}
function colour(v) {
  if (!v) return 0;
  const s = String(v).trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return parseInt(s.slice(1), 16);
  if (/^#[0-9a-f]{3}$/.test(s)) return parseInt(s.slice(1).split('').map((c) => c + c).join(''), 16);
  return NAMED_COLORS[s] || 0;
}
// Douglas–Peucker（公尺）
function simplify(pts, eps, closed) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop();
    let best = -1;
    let bd = eps;
    const [ax, az] = pts[a];
    const [bx, bz] = pts[b];
    const dx = bx - ax;
    const dz = bz - az;
    const L = Math.hypot(dx, dz) || 1e-9;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dz - (pts[i][1] - az) * dx) / L;
      if (d > bd) {
        bd = d;
        best = i;
      }
    }
    if (best > 0) {
      keep[best] = 1;
      st.push([a, best], [best, b]);
    }
  }
  const out = pts.filter((_, i) => keep[i]);
  return closed && out.length < 3 ? pts : out;
}
// 多重多邊形：把成員折線頭尾相接成環
function joinRings(lines) {
  const rings = [];
  const pool = lines.filter((l) => l.length > 1).map((l) => l.slice());
  while (pool.length) {
    let cur = pool.shift();
    let guard = 0;
    while (guard++ < 500) {
      const [hx, hz] = cur[0];
      const [tx, tz] = cur[cur.length - 1];
      if (Math.hypot(hx - tx, hz - tz) < 0.05) break;
      const k = pool.findIndex((l) => Math.hypot(l[0][0] - tx, l[0][1] - tz) < 0.05 || Math.hypot(l[l.length - 1][0] - tx, l[l.length - 1][1] - tz) < 0.05);
      if (k < 0) break;
      let l = pool.splice(k, 1)[0];
      if (Math.hypot(l[0][0] - tx, l[0][1] - tz) >= 0.05) l = l.reverse();
      cur = cur.concat(l.slice(1));
    }
    if (cur.length >= 4) rings.push(cur);
  }
  return rings;
}
const area = (r) => {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return a / 2;
};
// 差分編碼（0.1 公尺整數）
function enc(pts) {
  const out = [];
  let px = 0;
  let pz = 0;
  for (const [x, z] of pts) {
    const qx = Math.round(x * 10);
    const qz = Math.round(z * 10);
    out.push(qx - px, qz - pz);
    px = qx;
    pz = qz;
  }
  return out;
}

function compile(id, place, cfg, raw) {
  let origin = { lat: place.lat, lon: place.lon };
  const proj = (lat, lon) => [(lon - origin.lon) * M_LAT * Math.cos((origin.lat * Math.PI) / 180), (origin.lat - lat) * M_LAT];
  const half = cfg.half;
  const lim = half + 60;
  const els = raw.elements;
  // 威尼斯：讓真實的滑板公園落在遊戲滑板設施（街廓 (0,0)）的中心
  let skateRect = null;
  if (cfg.skate) {
    const sk = els.find((e) => e.type === 'way' && e.tags && e.tags.leisure === 'skatepark' && e.geometry);
    const g = sk ? sk.geometry : [{ lat: cfg.skate[0], lon: cfg.skate[1] }];
    {
      const lat = g.reduce((a, p) => a + p.lat, 0) / g.length;
      const lon = g.reduce((a, p) => a + p.lon, 0) / g.length;
      const K = { PX: 110, PZ: 84, avW: 15, stW: 12 };
      const cx = (K.avW / 2 + K.PX - K.avW / 2) / 2;
      const cz = (K.stW / 2 + K.PZ - K.stW / 2) / 2;
      origin = { lat: lat + cz / M_LAT, lon: lon - cx / (M_LAT * Math.cos((lat * Math.PI) / 180)) };
      skateRect = [K.avW / 2 - 4, K.stW / 2 - 4, K.PX - K.avW / 2 + 4, K.PZ - K.stW / 2 + 4];
      console.log(`  滑板公園${sk ? `「${sk.tags.name || ''}」` : '（預設位置）'} → 原點移到 ${origin.lat.toFixed(6)}, ${origin.lon.toFixed(6)}`);
    }
  }
  const inSkate = (pts) => {
    if (!skateRect) return false;
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const cz = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    return cx > skateRect[0] && cx < skateRect[2] && cz > skateRect[1] && cz < skateRect[3];
  };
  const names = [];
  const nameIdx = new Map();
  const nm = (t) => {
    const s = (t && (t['name:zh-Hant'] || t['name:zh-TW'] || (id === 'taipei' ? t['name:zh'] : null) || t.name)) || '';
    if (!s) return -1;
    if (!nameIdx.has(s)) {
      nameIdx.set(s, names.length);
      names.push(s);
    }
    return nameIdx.get(s);
  };
  const near = (pts) => pts.some(([x, z]) => Math.abs(x) < lim && Math.abs(z) < lim);
  const geom = (g) => g.map((p) => proj(p.lat, p.lon));

  // 道路與節點
  const nodeIdx = new Map();
  const nodes = [];
  const roads = [];
  const skipFoot = new Set(['sidewalk', 'crossing', 'traffic_island']);
  for (const e of els) {
    if (e.type !== 'way' || !e.tags || !e.tags.highway || !e.geometry) continue;
    const t = e.tags;
    const cls = RCLS[t.highway];
    if (cls == null || t.area === 'yes' || t.tunnel === 'yes' || t.tunnel === 'building_passage' || t.indoor === 'yes') continue;
    if (cls >= 9 && (skipFoot.has(t.footway) || skipFoot.has(t.path))) continue;
    if (t.access === 'private' && cls === 7) continue;
    const pts = geom(e.geometry);
    if (!near(pts) || pts.length < 2) continue;
    if (cls >= 8 && inSkate(pts)) continue;
    const idx = [];
    for (let k = 0; k < pts.length; k++) {
      const nid = e.nodes[k];
      if (!nodeIdx.has(nid)) {
        nodeIdx.set(nid, nodes.length);
        nodes.push(pts[k]);
      }
      const ni = nodeIdx.get(nid);
      if (idx[idx.length - 1] !== ni) idx.push(ni);
    }
    if (idx.length < 2) continue;
    let flags = 0;
    if (t.oneway === 'yes' || t.oneway === '1' || t.junction === 'roundabout' || cls === 0) flags |= 1;
    if (t.oneway === '-1') {
      flags |= 1;
      idx.reverse();
    }
    if (t.bridge && t.bridge !== 'no') flags |= 2;
    const lanes = Math.round(num(t.lanes) || 0);
    const width = num(t.width) || 0;
    roads.push([cls, flags, lanes, Math.round(width * 10), nm(t), idx]);
  }
  const sig = [];
  for (const e of els) {
    if (e.type === 'node' && e.tags && e.tags.highway === 'traffic_signals' && nodeIdx.has(e.id)) sig.push(nodeIdx.get(e.id));
  }

  // 建物
  const bld = [];
  const pushB = (rings, t) => {
    for (const r0 of rings) {
      let r = r0;
      if (Math.hypot(r[0][0] - r[r.length - 1][0], r[0][1] - r[r.length - 1][1]) < 0.05) r = r.slice(0, -1);
      r = simplify([...r, r[0]], 0.25, true).slice(0, -1);
      if (r.length < 3 || !near(r) || inSkate(r)) continue;
      const a = area(r);
      if (Math.abs(a) < 10) continue;
      if (a < 0) r.reverse();
      const h = num(t.height);
      const lv = num(t['building:levels']);
      const mh = num(t.min_height) || (num(t['building:min_level']) || 0) * 3.2;
      const type = BTYPE[t.building] ?? 6;
      if (t.building === 'roof' && !mh) continue;
      const roof = { gabled: 1, hipped: 2, pyramidal: 2, gambrel: 1, mansard: 2 }[t['roof:shape']] || 0;
      bld.push([Math.round((h || 0) * 10), Math.round(mh * 10), Math.round(lv || 0), type, colour(t['building:colour']), nm(t), roof, enc(r)]);
    }
  };
  for (const e of els) {
    if (!e.tags || !e.tags.building || e.tags.building === 'no') continue;
    if (e.type === 'way' && e.geometry) pushB([geom(e.geometry)], e.tags);
    else if (e.type === 'relation' && e.members) pushB(joinRings(e.members.filter((m) => m.role === 'outer' && m.geometry).map((m) => geom(m.geometry))), e.tags);
  }

  // 面：水域與綠地（外環＋內環）
  const polys = (e) => {
    if (e.type === 'way' && e.geometry) {
      const r = geom(e.geometry);
      return Math.hypot(r[0][0] - r[r.length - 1][0], r[0][1] - r[r.length - 1][1]) < 0.05 ? [[r]] : [];
    }
    if (e.type !== 'relation' || !e.members) return [];
    const outer = joinRings(e.members.filter((m) => m.role === 'outer' && m.geometry).map((m) => geom(m.geometry)));
    const inner = joinRings(e.members.filter((m) => m.role === 'inner' && m.geometry).map((m) => geom(m.geometry)));
    return outer.map((o) => [o, ...inner.filter((i) => inRing(o, i[0][0], i[0][1]))]);
  };
  const water = [];
  const green = [];
  const ring = (r) => {
    let q = r;
    if (Math.hypot(q[0][0] - q[q.length - 1][0], q[0][1] - q[q.length - 1][1]) < 0.05) q = q.slice(0, -1);
    q = simplify([...q, q[0]], 0.4, true).slice(0, -1);
    return enc(q);
  };
  for (const e of els) {
    const t = e.tags;
    if (!t || t.building) continue;
    const isWater = t.natural === 'water' || t.natural === 'bay' || t.waterway === 'riverbank' || t.waterway === 'dock' || (t.water && t.natural !== 'wetland') || t.leisure === 'swimming_pool';
    const gk = t.leisure || t.landuse || t.natural || (t.amenity === 'parking' ? 'parking' : t.man_made === 'pier' ? 'pier' : null);
    for (const pg of polys(e)) {
      const pts = pg[0];
      if (pts.length < 4 || !near(pts)) continue;
      if (Math.abs(area(pts)) < 20) continue;
      if (isWater && t.leisure !== 'swimming_pool') water.push(pg.map(ring));
      else if (gk && GREEN[gk] != null && !(skateRect && inSkate(pts) && Math.abs(area(pts)) < 9000)) green.push([GREEN[gk], ...pg.map(ring)]);
    }
  }

  // 點：樹、路燈、店家
  const trees = [];
  const lamps = [];
  const pois = [];
  const cats = [];
  const catIdx = new Map();
  for (const e of els) {
    if (e.type !== 'node' || !e.tags) continue;
    const [x, z] = proj(e.lat, e.lon);
    if (Math.abs(x) > lim || Math.abs(z) > lim) continue;
    const t = e.tags;
    if (t.natural === 'tree') trees.push([x, z]);
    else if (t.highway === 'street_lamp') lamps.push([x, z]);
    else if (t.shop || t.amenity) {
      const c = t.shop ? `shop=${t.shop}` : `amenity=${t.amenity}${t.cuisine ? `;${t.cuisine.split(';')[0]}` : ''}`;
      if (!catIdx.has(c)) {
        catIdx.set(c, cats.length);
        cats.push(c);
      }
      const n = nm(t);
      if (n >= 0) pois.push([Math.round(x * 10), Math.round(z * 10), catIdx.get(c), n]);
    }
  }

  return {
    origin,
    data: {
      v: 1, id, lat: +origin.lat.toFixed(7), lon: +origin.lon.toFixed(7), half, sea: !!cfg.sea, flat: !!cfg.flat,
      skate: skateRect, names, cats,
      nodes: enc(nodes), sig, roads, bld, water, green,
      trees: enc(trees), lamps: enc(lamps), pois,
    },
  };
}
function inRing(r, x, z) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    if (r[i][1] > z !== r[j][1] > z && x < ((r[j][0] - r[i][0]) * (z - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) inside = !inside;
  }
  return inside;
}

async function dem(origin, half, sea) {
  const ext = half + 120;
  const n = Math.ceil((2 * ext) / DEM_STEP) + 1;
  const x0 = -((n - 1) * DEM_STEP) / 2;
  const H = new Float64Array(n * n);
  const cosl = Math.cos((origin.lat * Math.PI) / 180);
  for (let b = 0; b < n; b++) {
    for (let a = 0; a < n; a++) {
      const x = x0 + a * DEM_STEP;
      const z = x0 + b * DEM_STEP;
      H[b * n + a] = await elevation(origin.lat - z / M_LAT, origin.lon + x / (M_LAT * cosl));
    }
  }
  // 輕微平滑（城市的高程來源混有建物與雜訊）
  const S = new Float64Array(n * n);
  for (let b = 0; b < n; b++) {
    for (let a = 0; a < n; a++) {
      let s = 0;
      let w = 0;
      for (let db = -1; db <= 1; db++) {
        for (let da = -1; da <= 1; da++) {
          const aa = Math.min(n - 1, Math.max(0, a + da));
          const bb = Math.min(n - 1, Math.max(0, b + db));
          const k = da === 0 && db === 0 ? 4 : da === 0 || db === 0 ? 2 : 1;
          s += H[bb * n + aa] * k;
          w += k;
        }
      }
      S[b * n + a] = s / w;
    }
  }
  const mid = (n - 1) / 2;
  const base = sea ? 0 : Math.round(S[Math.round(mid) * n + Math.round(mid)]);
  const q = new Int16Array(n * n);
  let prev = 0;
  for (let k = 0; k < n * n; k++) {
    const v = Math.round((S[k] - base) * 10);
    q[k] = v - prev;
    prev = v;
  }
  return { step: DEM_STEP, n, x0, base, h: Buffer.from(q.buffer).toString('base64') };
}

mkdirSync(OUT, { recursive: true });
for (const id of todo) {
  const place = PLACES.find((p) => p.id === id);
  const cfg = OSM_CFG[id];
  if (!place || !cfg) throw new Error(`沒有這個地點：${id}`);
  console.log(`${id}：${place.name}`);
  const raw = await fetchOsm(id, place.lat, place.lon, cfg.half);
  const { origin, data } = compile(id, place, cfg, raw);
  data.dem = cfg.flat ? null : await dem(origin, cfg.half, cfg.sea);
  const txt = JSON.stringify(data);
  writeFileSync(resolve(OUT, `${id}.json`), txt);
  console.log(`  建物 ${data.bld.length} · 道路 ${data.roads.length} · 節點 ${data.nodes.length / 2} · 號誌 ${data.sig.length} · 水域 ${data.water.length} · 綠地 ${data.green.length} · 樹 ${data.trees.length / 2} · 店家 ${data.pois.length} → ${(txt.length / 1024).toFixed(0)} KB`);
}
