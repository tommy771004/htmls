// 榛嶺的地形與山道資料 → src/parts/09-akina-dem.js（內嵌，執行時不連網）
// 來源：國土地理院 標高タイル（DEM10B，z14 文字瓦片 cyberjapandata.gsi.go.jp/xyz/dem/14/x/y.txt，x 14511–14514、y 6405–6408）
//       OpenStreetMap（© OpenStreetMap contributors，ODbL）的群馬県道 33 號 渋川松井田線 ＋ 28 號 高崎東吾妻線 湖岸那一段（Overpass 抓 highway 的 way，out geom）
//       路邊物件（選用的第三個參數）：同一個 OSM，Overpass 抓 bbox 36.4524,138.8459,36.5089,138.9324 的節點（highway=bus_stop／street_lamp／traffic_signals／stop／crossing…、
//       traffic_sign、power=pole／tower、tourism=viewpoint、amenity=parking…）與 way（barrier=guard_rail／retaining_wall／fence、amenity=parking、power=line…），out geom；
//       這一帶 OSM 沒有路燈、交通標誌與電線桿的節點，用到的只有 guard_rail、bus_stop、viewpoint、parking（fence 離路太遠）
// 用法：node tools/akina-dem.mjs <DEM 瓦片資料夾> <overpass.json> [<overpass 路邊物件.json>]
// 平面座標：原點 36.48N 138.89E，x 往東、z 往南（公尺）。地形裁成 CROP 的範圍，每 CELL 公尺一格，高度存成 (h − LO) / Q 的 uint16；
// 山道從湖邊（28 號的湖岸路口）順著 33 號經ヤセオネ峠、五連ヘアピン下到 LOW 那一點（伊香保上面最後一個髮夾彎出來），每 4 m 一點，縱斷面照 DEM 平滑、坡度 ≤ 12%
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const [gdir, osm, objf] = process.argv.slice(2);
const LAT0 = 36.48, LON0 = 138.89, KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KZ = 110574;
const CROP = { x0: -3950, x1: 3800, z0: -3200, z1: 3050 }, CELL = 15, LO = 500, Q = .05, STEP = 4;
// ─── DEM ───
const T = new Map();
for (const f of readdirSync(gdir)) {
  const m = /^dem_14_(\d+)_(\d+)\.txt$/.exec(f); if (!m) continue;
  T.set(m[1] + ',' + m[2], readFileSync(join(gdir, f), 'utf8').trim().split('\n').map(l => l.split(',').map(v => v === 'e' || v === '' ? null : +v)));
}
const px = (X, Y) => { const t = T.get(Math.floor(X / 256) + ',' + Math.floor(Y / 256)); return t ? t[Y % 256][X % 256] : null; };
function H(x, z) {
  const lon = LON0 + x / KX, lat = LAT0 - z / KZ, r = lat * Math.PI / 180;
  const fx = (lon + 180) / 360 * 2 ** 14 * 256 - .5, fy = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** 14 * 256 - .5;
  const X = Math.floor(fx), Y = Math.floor(fy), u = fx - X, v = fy - Y, q = [px(X, Y), px(X + 1, Y), px(X, Y + 1), px(X + 1, Y + 1)];
  if (q.some(a => a === null)) return null;
  return (q[0] * (1 - u) + q[1] * u) * (1 - v) + (q[2] * (1 - u) + q[3] * u) * v;
}
const nx = Math.round((CROP.x1 - CROP.x0) / CELL) + 1, nz = Math.round((CROP.z1 - CROP.z0) / CELL) + 1, G = new Uint16Array(nx * nz);
for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
  const h = H(CROP.x0 + i * CELL, CROP.z0 + j * CELL); if (h === null) throw new Error(`DEM 缺 ${i},${j}`);
  G[j * nx + i] = Math.round((h - LO) / Q);
}
// ─── 山道 ───
const D = JSON.parse(readFileSync(osm, 'utf8')), W = new Map(D.elements.map(e => [e.id, e]));
const P = g => [(g.lon - LON0) * KX, -(g.lat - LAT0) * KZ];
// 湖岸（28 號）→ 33 號一路到伊香保；way 的方向不一定，接頭照端點
const ORDER = [77893070, 197294652, 77893073, 197294653, 405586761, 405586760, 691869703, 691869704, 691869698, 691869699, 214799973, 405586759, 214798503];
let pts = [], wid = [];   // wid：每個原始頂點屬於哪一條 way（那一點到下一點的段）
for (const id of ORDER) {
  let g = W.get(id).geometry.map(P);
  if (!pts.length) { const n = W.get(ORDER[1]).geometry.map(P), d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]); if (Math.min(d(g[0], n[0]), d(g[0], n[n.length - 1])) < 1) g.reverse(); }
  else {
    const e = pts[pts.length - 1], d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (d(e, g[g.length - 1]) < d(e, g[0])) g.reverse();
    if (d(e, g[0]) > 1) throw new Error(`way ${id} 接不上（${d(e, g[0]).toFixed(1)} m）`);
    g = g.slice(1);
  }
  if (pts.length) wid[pts.length - 1] = id;
  for (let k = 0; k < g.length; k++) wid[pts.length + k] = id;
  pts.push(...g);
}
const res = [pts[0]], rw = [wid[0]];
for (let i = 1, acc = 0; i < pts.length; i++) {
  const a = pts[i - 1], b = pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]); let u = STEP - acc;
  for (; u <= l; u += STEP) { res.push([a[0] + (b[0] - a[0]) * u / l, a[1] + (b[1] - a[1]) * u / l]); rw.push(wid[i - 1]); }
  acc = l - (u - STEP);
}
// LOW：伊香保上面、最後一個髮夾彎出來的那一點（湖岸起算約 9.8 km）；路倒過來，從 LOW 往湖邊
const LOWI = res.findIndex(p => Math.hypot(p[0] - 2070, p[1] + 1965) < 6);
if (LOWI < 0) throw new Error('找不到 LOW');
const road = res.slice(0, LOWI + 1).reverse(), roadW = rw.slice(0, LOWI + 1).reverse();
let y = road.map(p => H(...p));
for (let it = 0; it < 6; it++) y = y.map((v, i) => { let s = 0, n = 0; for (let k = -7; k <= 7; k++) { const w = y[i + k]; if (w !== undefined) { s += w; n++; } } return s / n; });   // 60 m 的移動平均（DEM 在路上是 10 m 格，有樹、有挖方）
// 坡度照存檔後（x、z 取到 0.25 m）的點距算，留 0.5% 給高度取到 Q 的誤差：遊戲裡每段都 ≤ 12%
const RX = new Int16Array(road.length * 2), RY = new Uint16Array(road.length);
road.forEach((p, i) => { RX[i * 2] = Math.round(p[0] * 4); RX[i * 2 + 1] = Math.round(p[1] * 4); });
const gmax = i => .115 * Math.hypot(RX[i * 2] - RX[i * 2 - 2], RX[i * 2 + 1] - RX[i * 2 - 1]) / 4;
for (let i = 1; i < y.length; i++) y[i] = Math.min(Math.max(y[i], y[i - 1] - gmax(i)), y[i - 1] + gmax(i));
for (let i = y.length - 2; i >= 0; i--) y[i] = Math.min(Math.max(y[i], y[i + 1] - gmax(i + 1)), y[i + 1] + gmax(i + 1));
road.forEach((p, i) => { RY[i] = Math.round((y[i] - LO) / Q); });
// 取整以後點距短的段（轉角的弦）還是可能超過，直接在整數上往前一點收：每段最多差 floor(12% × 點距 / Q)
for (let it = 0, bad = 1; bad && it < 20; it++) {
  bad = 0;
  for (let i = 1; i < road.length; i++) { const m = Math.floor(.12 * gmax(i) / .115 / Q), d = RY[i] - RY[i - 1]; if (Math.abs(d) > m) { RY[i] = RY[i - 1] + Math.sign(d) * m; bad++; } }
  for (let i = road.length - 2; i >= 0; i--) { const m = Math.floor(.12 * gmax(i + 1) / .115 / Q), d = RY[i] - RY[i + 1]; if (Math.abs(d) > m) { RY[i] = RY[i + 1] + Math.sign(d) * m; bad++; } }
}
let gq = 0; for (let i = 1; i < road.length; i++) gq = Math.max(gq, Math.abs(RY[i] - RY[i - 1]) * Q / (Math.hypot(RX[i * 2] - RX[i * 2 - 2], RX[i * 2 + 1] - RX[i * 2 - 1]) / 4));
console.log(`存檔後最大坡度 ${(gq * 100).toFixed(2)}%`);
const lakeLv = H(-2000, 550), lake = lakeLv;
// 湖面：DEM 的榛名湖是一片平的 1085 m；從湖心往外找連在一起、和湖心一樣高（±5 cm）的格子，存成 0（遊戲裡當湖，高度換回湖面）
{
  const i0 = Math.round((-2000 - CROP.x0) / CELL), j0 = Math.round((550 - CROP.z0) / CELL), q = [[i0, j0]], code = Math.round((lake - LO) / Q), seen = new Uint8Array(nx * nz);
  while (q.length) {
    const [i, j] = q.pop(); if (i < 0 || j < 0 || i >= nx || j >= nz || seen[j * nx + i]) continue; seen[j * nx + i] = 1;
    if (Math.abs(G[j * nx + i] - code) > 1) continue;
    G[j * nx + i] = 0; q.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]);
  }
  let n = 0; for (const v of G) if (!v) n++; console.log(`湖 ${n} 格（${(n * CELL * CELL / 1e6).toFixed(2)} km²）`);
}
// 權重（uint8，0–255，每 WS 格取一格＝45 m）：離山道 400 m（真的公尺）內、湖岸 250 m 內是 1，再往外 1300／1250 m 降到 0；裁切邊上 250 m 也降到 0。
// 遊戲裡照這張把真的地形疊到原本的地形上：山的輪廓順著路與湖，外面 1.3 km（遊戲裡 580 m）慢慢降回原本的山坡，不是一塊方形的台地、也不會在邊上變成一道牆
const WS = 3, wnx = Math.floor((nx - 1) / WS) + 1, wnz = Math.floor((nz - 1) / WS) + 1, WT = new Uint8Array(wnx * wnz), segs = [];
for (let i = 0; i + 8 < road.length; i += 8) segs.push([road[i], road[i + 8]]);
segs.push([road[road.length - 9], road[road.length - 1]]);
const wet = []; for (let j = 0; j < nz; j += 2) for (let i = 0; i < nx; i += 2) if (!G[j * nx + i]) wet.push([CROP.x0 + i * CELL, CROP.z0 + j * CELL]);
const sm = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
for (let j = 0; j < wnz; j++) for (let i = 0; i < wnx; i++) {
  const x = CROP.x0 + i * WS * CELL, z = CROP.z0 + j * WS * CELL;
  let dr = 1e9; for (const [a, b] of segs) { const ex = b[0] - a[0], ez = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / (ex * ex + ez * ez))); dr = Math.min(dr, Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t)); }
  let dl = 1e9; if (dr > 400) for (const [a, b] of wet) { dl = Math.min(dl, Math.hypot(x - a, z - b)); if (dl < 250) break; }
  const de = Math.min(x - CROP.x0, CROP.x1 - x, z - CROP.z0, CROP.z1 - z);
  WT[j * wnx + i] = Math.round(255 * Math.max(sm((1700 - dr) / 1300), sm((1500 - dl) / 1250)) * sm(de / 250));
}
// ─── OSM 的路段屬性（遊戲裡照這些擺橋的高欄、速限與県道的標誌、支路）：way 換了就是一段，記起點與終點的索引（路已經倒過來，從低端往湖） ───
const SEGS = [];
for (let i = 0; i < road.length; i++) {
  const id = roadW[i], t = W.get(id).tags || {}, L = SEGS[SEGS.length - 1];
  if (L && L.id === id) { L.i1 = i; continue; }
  SEGS.push({ id, i0: i, i1: i, ref: t.ref || '', max: +t.maxspeed || 0, bridge: t.bridge === 'yes' ? 1 : 0, calm: t.traffic_calming ? 1 : 0, lanes: +t.lanes || 0 });
}
// 支路：不在 ORDER 裡的 highway way，有端點或頂點落在山道 2 m 內（OSM 的道路共用節點）→ 路口的索引、支路往外的方向（真的平面，弧度）、種類與名字
const JUN = [], ON = new Set(ORDER);
for (const e of D.elements) {
  if (ON.has(e.id) || !e.tags || !e.tags.highway || !e.geometry) continue;
  const g = e.geometry.map(P);
  for (let q = 0; q < g.length; q++) {
    let bi = -1, bd = 2;
    for (let i = 0; i < road.length; i++) { const d = Math.hypot(road[i][0] - g[q][0], road[i][1] - g[q][1]); if (d < bd) { bd = d; bi = i; } }
    if (bi < 0) continue;
    const nb = g[q > 0 ? q - 1 : q + 1] || g[q], ang = Math.atan2(nb[1] - g[q][1], nb[0] - g[q][0]);
    if (!JUN.some(j => Math.abs(j.i - bi) < 4 && Math.abs(((j.a - ang + 9.42) % 6.283) - 3.14) < .3)) JUN.push({ i: bi, a: +ang.toFixed(3), hw: e.tags.highway, name: e.tags.name || '', id: e.id });
    if (q === 0 || q === g.length - 1) continue;   // 路從中間穿過：另一邊也是一條支路
    const nb2 = g[q + 1], a2 = Math.atan2(nb2[1] - g[q][1], nb2[0] - g[q][0]);
    if (!JUN.some(j => Math.abs(j.i - bi) < 4 && Math.abs(((j.a - a2 + 9.42) % 6.283) - 3.14) < .3)) JUN.push({ i: bi, a: +a2.toFixed(3), hw: e.tags.highway, name: e.tags.name || '', id: e.id });
  }
}
JUN.sort((a, b) => a.i - b.i);
console.log(`OSM 路段 ${SEGS.length}（橋 ${SEGS.filter(s => s.bridge).map(s => s.i0 + '–' + s.i1).join('、') || '無'}；速限 ${[...new Set(SEGS.map(s => s.max))].join('/')}），支路 ${JUN.length}：${JUN.map(j => j.i + ' ' + j.hw).join('、')}`);
// 路邊物件（第三個參數：Overpass 下載的節點與 way，© OpenStreetMap contributors）：投影到山道上，記索引與離中線的距離（真的平面，+ 是法線 (−tz, tx) 那一側）。
// rail：barrier=guard_rail 每 2 m 取一點，離中線 18 m 內的點照側邊連成 [起點, 終點, ±1]；obj：bus_stop／viewpoint（節點）、parking／fence（way，存外形）離路 30 m 內的
const RAIL = [], OBJ = [];
if (objf) {
  const O = JSON.parse(readFileSync(objf, 'utf8')).elements;
  const near = (x, z) => {
    let b = { d: 1e9 };
    for (let i = 0; i + 1 < road.length; i++) {
      const [ax, az] = road[i], [bx, bz] = road[i + 1], ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez || 1, t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / L2));
      const dx = x - ax - ex * t, dz = z - az - ez * t, d = Math.hypot(dx, dz);
      if (d < b.d) { const L = Math.sqrt(L2); b = { d, i: t < .5 ? i : i + 1, s: (dx * -ez + dz * ex) / L >= 0 ? 1 : -1 }; }
    }
    return b;
  };
  const r4 = v => Math.round(v * 4) / 4;
  let rl = 0, rin = 0, out = 0;
  for (const e of O) {
    const t = e.tags || {};
    if (t.barrier === 'guard_rail' && e.geometry) {
      const g = e.geometry.map(P); let run = null;
      for (let q = 1; q < g.length; q++) {
        const [ax, az] = g[q - 1], [bx, bz] = g[q], l = Math.hypot(bx - ax, bz - az); rl += l;
        for (let u = 0; u < l; u += 2) {
          const n = near(ax + (bx - ax) * u / l, az + (bz - az) * u / l);
          if (n.d > 18) { if (run) RAIL.push(run); run = null; continue; }
          rin += Math.min(2, l - u);
          if (run && run[2] === n.s && Math.abs(n.i - run[3]) < 6) { run[0] = Math.min(run[0], n.i); run[1] = Math.max(run[1], n.i); run[3] = n.i; }
          else { if (run) RAIL.push(run); run = [n.i, n.i, n.s, n.i]; }
        }
      }
      if (run) RAIL.push(run);
      continue;
    }
    const kind = t.highway === 'bus_stop' ? 'bus' : t.tourism === 'viewpoint' ? 'view' : t.amenity === 'parking' && e.type === 'way' ? 'park' : t.barrier === 'fence' && e.geometry ? 'fence' : '';
    if (!kind) continue;
    const g = e.type === 'node' ? [P(e)] : e.geometry.map(P), ns = g.map(p => near(...p)), m = ns.reduce((a, b) => b.d < a.d ? b : a);
    if (m.d > 30) { out++; continue; }
    OBJ.push([kind, m.i, +(m.d * m.s).toFixed(1), t.name || '', e.type === 'node' ? [] : g.flatMap(p => [r4(p[0]), r4(p[1])])]);
  }
  RAIL.sort((a, b) => a[0] - b[0]); OBJ.sort((a, b) => a[1] - b[1]);
  for (let a = 0; a < RAIL.length; a++) { RAIL[a].length = 3; for (let b = a + 1; b < RAIL.length && RAIL[b][0] <= RAIL[a][1] + 3; b++) if (RAIL[b][2] === RAIL[a][2]) { RAIL[a][1] = Math.max(RAIL[a][1], RAIL[b][1]); RAIL.splice(b--, 1); } }   // 同一側重疊或只差 12 m 的併成一段
  console.log(`OSM 路邊：護欄 ${rl.toFixed(0)} m（山道 18 m 內 ${rin.toFixed(0)} m，${RAIL.length} 段），物件 ${OBJ.length}：${OBJ.map(o => o[0] + ' ' + o[1] + (o[3] ? ' ' + o[3] : '')).join('、')}；離路太遠 ${out}`);
}
const b64 = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
const out = `// 自動產生（tools/akina-dem.mjs），不要手改。
// 地形：国土地理院 標高タイル（DEM10B）加工；山道與路邊物件：© OpenStreetMap contributors（ODbL）群馬県道 33 號・28 號
// 平面座標原點 36.48N 138.89E，x 東、z 南（公尺）。地形每 ${CELL} m 一格，高度 = 值 × ${Q} + ${LO}（0 是榛名湖，湖面 lake）；山道每 ${STEP} m 一點（x、z × 4 的 int16），縱斷面同地形的編碼
const AK_DEM = { x0: ${CROP.x0}, z0: ${CROP.z0}, cell: ${CELL}, nx: ${nx}, nz: ${nz}, lo: ${LO}, q: ${Q}, lake: ${lake.toFixed(2)},
  d: '${b64(G)}',
  ws: ${WS}, wnx: ${wnx}, wnz: ${wnz}, w: '${b64(WT)}' };
const AK_ROAD = { step: ${STEP}, n: ${road.length},
  xz: '${b64(RX)}',
  y: '${b64(RY)}',
  osm: ${JSON.stringify(SEGS.map(s => [s.i0, s.i1, s.ref, s.max, s.bridge, s.calm, s.lanes]))},   // [起點, 終點, ref, maxspeed, bridge, traffic_calming, lanes]
  jun: ${JSON.stringify(JUN.map(j => [j.i, j.a, j.hw, j.name]))},   // 支路 [索引, 往外的方向, highway, name]
  rail: ${JSON.stringify(RAIL)},   // barrier=guard_rail [起點, 終點, 側（真的平面法線 (−tz, tx) 為 +1）]
  obj: ${JSON.stringify(OBJ)} };   // [bus／view／park／fence, 索引, 離中線（公尺，帶側）, name, 外形 x,z…（真的平面）]
`;
writeFileSync(new URL('../src/parts/09-akina-dem.js', import.meta.url), out);
console.log(`DEM ${nx}×${nz}，湖面 ${lake.toFixed(2)} m，山道 ${road.length} 點（${(road.length * STEP / 1000).toFixed(2)} km，低端 ${y[0].toFixed(1)} m → 湖邊 ${y[y.length - 1].toFixed(1)} m），${(out.length / 1024).toFixed(0)} KB`);
