// 紐柏林賽道（北環＋GP）的地形、賽道與周邊 → src/parts/09-nbr-dem.js（內嵌，執行時不連網）；擺法與分工見 plans/260-nurburgring.md
// 來源：地形是 AWS Terrain Tiles（Mapzen terrarium 編碼 PNG，s3.amazonaws.com/elevation-tiles-prod/terrarium/14/x/y.png，x 8505–8512、y 5528–5534），
//         原始資料的出處照 tilezen/joerd 的 attribution（歐洲這一帶是 SRTM 與 EU-DEM 等，見 CREDITS）
//       賽道與周邊是 OpenStreetMap（© OpenStreetMap contributors，ODbL）：
//         raceway.json：Overpass `way["highway"="raceway"](50.31,6.90,50.39,7.02); out geom;`（含 nodes）
//         area.json：Overpass 同一個 bbox 的 building、highway、landuse／natural／leisure、waterway、barrier 的 way 與 relation，out geom
// 用法：node tools/nbr-dem.mjs <terrarium 瓦片資料夾（t_X_Y.png）> <raceway.json> <area.json>
// 平面座標：原點 50.35N 6.96E，x 往東、z 往南（公尺），真實方位（轉 180° 與平移在 09-nbr.js）。
// 地形裁成 CROP、每 CELL 公尺一格，高度存成 (h − LO) / Q 的 uint16；土地利用是 LU_CELL 一格的類別（RLE）；
// 賽道中心線每 4 m 一點（x、z × 2 的 int16），照行車方向（OSM 的北環是反的），縱斷面照 DEM 前後 60 m 平均（Q 編碼）
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
const [tdir, racef, areaf] = process.argv.slice(2);
const LAT0 = 50.35, LON0 = 6.96, KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KZ = 110574;
const CROP = { x0: -3400, x1: 3800, z0: -3950, z1: 4200 }, CELL = 20, LO = 250, Q = .01, STEP = 4, LU_CELL = 10;
// ─── terrarium PNG（8 位元 RGB／RGBA，五種濾波）→ 高度 = R·256 + G + B/256 − 32768 ───
function png(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG');
  let i = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (i < buf.length) {
    const n = buf.readUInt32BE(i), t = buf.toString('latin1', i + 4, i + 8), c = buf.subarray(i + 8, i + 8 + n); i += 12 + n;
    if (t === 'IHDR') { w = c.readUInt32BE(0); h = c.readUInt32BE(4); ct = c[9]; if (c[8] !== 8 || c[12]) throw new Error('只支援 8 位元、不交錯'); }
    else if (t === 'IDAT') idat.push(c); else if (t === 'IEND') break;
  }
  const bpp = { 2: 3, 6: 4 }[ct], raw = inflateSync(Buffer.concat(idat)), st = w * bpp, px = new Uint8Array(h * st);
  for (let y = 0, o = 0; y < h; y++) {
    const f = raw[o++], L = y * st, U = L - st;
    for (let x = 0; x < st; x++) {
      const a = x >= bpp ? px[L + x - bpp] : 0, b = y ? px[U + x] : 0, c = y && x >= bpp ? px[U + x - bpp] : 0;
      let p = 0;
      if (f === 1) p = a; else if (f === 2) p = b; else if (f === 3) p = (a + b) >> 1;
      else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[L + x] = (raw[o++] + p) & 255;
    }
  }
  const out = new Float32Array(w * h);
  for (let k = 0; k < w * h; k++) out[k] = px[k * bpp] * 256 + px[k * bpp + 1] + px[k * bpp + 2] / 256 - 32768;
  return out;
}
const T = new Map();
for (const f of readdirSync(tdir)) { const m = /^t_(\d+)_(\d+)\.png$/.exec(f); if (m) T.set(m[1] + ',' + m[2], png(readFileSync(join(tdir, f)))); }
const px = (X, Y) => { const t = T.get(Math.floor(X / 256) + ',' + Math.floor(Y / 256)); return t ? t[(Y % 256) * 256 + X % 256] : null; };
function H(x, z) {
  const lon = LON0 + x / KX, lat = LAT0 - z / KZ, r = lat * Math.PI / 180;
  const fx = (lon + 180) / 360 * 2 ** 14 * 256 - .5, fy = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** 14 * 256 - .5;
  const X = Math.floor(fx), Y = Math.floor(fy), u = fx - X, v = fy - Y, q = [px(X, Y), px(X + 1, Y), px(X, Y + 1), px(X + 1, Y + 1)];
  if (q.some(a => a === null)) return null;
  return (q[0] * (1 - u) + q[1] * u) * (1 - v) + (q[2] * (1 - u) + q[3] * u) * v;
}
const nx = Math.round((CROP.x1 - CROP.x0) / CELL) + 1, nz = Math.round((CROP.z1 - CROP.z0) / CELL) + 1, G = new Uint16Array(nx * nz);
let hlo = 1e9, hhi = -1e9;
for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
  const h = H(CROP.x0 + i * CELL, CROP.z0 + j * CELL); if (h === null) throw new Error(`DEM 缺 ${i},${j}`);
  G[j * nx + i] = Math.round((h - LO) / Q); hlo = Math.min(hlo, h); hhi = Math.max(hhi, h);
}
const P = g => [(g.lon - LON0) * KX, -(g.lat - LAT0) * KZ];
const plen = p => p.reduce((s, q, k) => k ? s + Math.hypot(q[0] - p[k - 1][0], q[1] - p[k - 1][1]) : 0, 0);
const rdp = (p, eps) => {   // Douglas–Peucker
  if (p.length < 3) return p;
  const [a, b] = [p[0], p[p.length - 1]], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
  let m = 0, k = 0; for (let i = 1; i < p.length - 1; i++) { const d = Math.abs((p[i][0] - a[0]) * dz - (p[i][1] - a[1]) * dx) / L; if (d > m) { m = d; k = i; } }
  return m > eps ? [...rdp(p.slice(0, k + 1), eps).slice(0, -1), ...rdp(p.slice(k), eps)] : [a, b];
};
const ring = (g, eps) => { let k = 0, m = 0; g.forEach((q, i) => { const d = Math.hypot(q[0] - g[0][0], q[1] - g[0][1]); if (d > m) { m = d; k = i; } }); return k ? [...rdp(g.slice(0, k + 1), eps).slice(0, -1), ...rdp(g.slice(k), eps).slice(0, -1)] : [g[0]]; };   // 封閉環（頭尾同點）：從離起點最遠那點切成兩段
const area2 = p => { let s = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; s += p[i][0] * q[1] - q[0] * p[i][1]; } return s / 2; };
// ─── 賽道：raceway 的 way 串成圈（北環＝最大的元件裡最長的簡單環，GP＝第二大的）───
const RW = JSON.parse(readFileSync(racef, 'utf8')).elements.filter(e => e.type === 'way' && e.geometry).map(e => ({ id: e.id, nodes: e.nodes, name: (e.tags || {}).name || '', pit: (e.tags || {}).raceway === 'pitlane', pts: e.geometry.map(P) }));
const adj = new Map(), add = (n, w) => { if (!adj.has(n)) adj.set(n, []); adj.get(n).push(w); };
for (const w of RW) { add(w.nodes[0], w); add(w.nodes[w.nodes.length - 1], w); w.L = plen(w.pts); }
function longestLoop(ws) {
  const ids = new Set(ws.map(w => w.id)); let best = { L: 0, path: null };
  const dfs = (start, node, path, used, L) => {
    for (const w of adj.get(node) || []) {
      if (!ids.has(w.id) || used.has(w.id)) continue;
      const fwd = w.nodes[0] === node, other = fwd ? w.nodes[w.nodes.length - 1] : w.nodes[0];
      if (other === start && L + w.L > best.L) best = { L: L + w.L, path: [...path, [w, fwd]] };
      if (path.length > 120) continue;
      used.add(w.id); dfs(start, other, [...path, [w, fwd]], used, L + w.L); used.delete(w.id);
    }
  };
  let n = 0; for (const s of new Set(ws.map(w => w.nodes[0]))) { if (n++ > 6) break; dfs(s, s, [], new Set(), 0); }
  const pts = [];
  for (const [w, f] of best.path) { const q = f ? w.pts : [...w.pts].reverse(); for (let k = pts.length ? 1 : 0; k < q.length; k++) pts.push([...q[k], w.name]); }
  return pts;
}
const par = new Map(), fnd = a => { while (par.get(a) !== a) a = par.get(a); return a; };
for (const w of RW) for (const n of [w.nodes[0], w.nodes[w.nodes.length - 1]]) if (!par.has(n)) par.set(n, n);
for (const w of RW) { const a = fnd(w.nodes[0]), b = fnd(w.nodes[w.nodes.length - 1]); if (a !== b) par.set(b, a); }
const comp = new Map(); for (const w of RW) { const r = fnd(w.nodes[0]); if (!comp.has(r)) comp.set(r, []); comp.get(r).push(w); }
const cs = [...comp.values()].sort((a, b) => b.reduce((s, w) => s + w.L, 0) - a.reduce((s, w) => s + w.L, 0));
function loopOut(raw, sm, rot) {
  const flip = area2(raw) < 0, pts = flip ? [...raw].reverse() : raw;   // 兩條都是順時針跑（x 東 z 南的座標裡面積為正）；DFS 串出來的方向不一定
  const S = [pts[0]]; let acc = 0;   // 每 STEP 公尺重取樣（名字跟著那一段）
  for (let k = 1; k < pts.length; k++) {
    let [px0, pz0] = pts[k - 1]; const [qx, qz] = pts[k], nm = flip ? pts[k - 1][2] : pts[k][2]; let l = Math.hypot(qx - px0, qz - pz0);
    while (acc + l >= STEP) { const t = (STEP - acc) / l; px0 += (qx - px0) * t; pz0 += (qz - pz0) * t; S.push([px0, pz0, nm]); l = Math.hypot(qx - px0, qz - pz0); acc = 0; }
    acc += l;
  }
  if (Math.hypot(S[S.length - 1][0] - S[0][0], S[S.length - 1][1] - S[0][1]) < STEP * .6) S.pop();
  const n = S.length, k0 = ((rot(S) % n) + n) % n, R = [...S.slice(k0), ...S.slice(0, k0)];   // 起點：起終點線
  const Y = R.map(([x, z]) => H(x, z)), Ys = Y.map((_, k) => { let s = 0; for (let d = -sm; d <= sm; d++) s += Y[(k + d + n) % n]; return s / (2 * sm + 1); });
  const xz = new Int16Array(n * 2), y = new Uint16Array(n), names = [];
  R.forEach((p, k) => { xz[k * 2] = Math.round(p[0] * 2); xz[k * 2 + 1] = Math.round(p[1] * 2); y[k] = Math.round((Ys[k] - LO) / Q); if (p[2] !== (names.length ? names[names.length - 1][1] : null)) names.push([k, p[2]]); });
  let gMax = 0; for (let k = 0; k < n; k++) gMax = Math.max(gMax, Math.abs(Ys[(k + 6) % n] - Ys[(k - 6 + n) % n]) / (12 * STEP));
  console.log('track', n * STEP, 'm', n, 'pts', 'y', Math.round(Math.min(...Ys)), Math.round(Math.max(...Ys)), 'grade', (gMax * 100).toFixed(1) + '%', names.filter(a => a[1]).map(a => a[1]).slice(0, 8).join(' → '));
  return { xz, y, names: names.filter(a => a[1]) };
}
// 北環的起點放在 T13（接 GP 那一端）；GP 的起點是起終點直線上離維修道（Boxengasse，raceway=pitlane 最長那條）中點最近的那一點
const nsRaw = longestLoop(cs[0]), gpRaw = longestLoop(cs[1]);
const nameAt = (S, re, last) => { let k = -1; S.forEach((p, i) => { if (re.test(p[2] || '') && (last || k < 0)) k = i; }); return k; };
const NS = loopOut(nsRaw, 15, S => nameAt(S, /^T13$/, false));
const PIT = RW.filter(w => w.pit).sort((a, b) => b.L - a.L)[0].pts, pitL = plen(PIT);
const pitMid = (() => { let a = 0; for (let k = 1; k < PIT.length; k++) { const l = Math.hypot(PIT[k][0] - PIT[k - 1][0], PIT[k][1] - PIT[k - 1][1]); if (a + l >= pitL / 2) { const t = (pitL / 2 - a) / l; return [PIT[k - 1][0] + (PIT[k][0] - PIT[k - 1][0]) * t, PIT[k - 1][1] + (PIT[k][1] - PIT[k - 1][1]) * t]; } a += l; } })();
const GP = loopOut(gpRaw, 15, S => { let k = 0, m = 1e9; S.forEach((p, i) => { const d = Math.hypot(p[0] - pitMid[0], p[1] - pitMid[1]); if (d < m) { m = d; k = i; } }); return k; });
// ─── 周邊（area.json）───
const D = JSON.parse(readFileSync(areaf, 'utf8')).elements;
const inCrop = p => p.some(([x, z]) => x > CROP.x0 && x < CROP.x1 && z > CROP.z0 && z < CROP.z1);
function lvl(t) {
  for (const k of ['height', 'building:height']) { const v = parseFloat(String(t[k] || '').replace('m', '')); if (v > 0) return v; }
  const l = parseFloat(t['building:levels']); if (l > 0) return l * 3.2 + (t['roof:shape'] && t['roof:shape'] !== 'flat' ? 2 : 0);
  return null;
}
const BK = { grandstand: 0, house: 1, detached: 1, residential: 1, semidetached_house: 1, farm: 1, apartments: 1, garage: 2, garages: 2, shed: 2, roof: 2, carport: 2, hut: 2, industrial: 3, warehouse: 3, commercial: 3, retail: 3, hotel: 3, church: 4, chapel: 4, castle: 5, ruins: 5, tower: 6 };
const BH = [14, 8, 3.2, 9, 14, 12, 18, 7];   // 沒標高度時照種類估：看台、住家、車庫棚子、工商旅館、教堂、城堡、塔、其他
const bld = [];
const pushB = (g, t) => {
  if (g.length < 4 || !inCrop(g)) return;
  let p = ring(g, .4); if (p.length < 3 || Math.abs(area2(p)) < 12) return;
  if (area2(p) < 0) p = p.reverse();   // 統一成 x 東 z 南的「順時針」
  const k = BK[t.building] ?? (t.building === 'yes' && /tribüne|tribune/i.test(t.name || '') ? 0 : 7);
  bld.push({ p, k, h: Math.min(60, Math.round((lvl(t) ?? BH[k]) * 2) / 2) });
};
const RK = { motorway: 0, trunk: 0, primary: 0, secondary: 1, tertiary: 1, unclassified: 2, residential: 2, living_street: 2, service: 3 };
const roads = [], rails = [];
// 土地利用的類別：0 草地（預設）、1 森林、2 農地、3 住宅與村子、4 工商與停車、5 鋪面（停車場、維修區、賽道附屬的鋪面）、6 水
const LUK = { forest: 1, wood: 1, farmland: 2, orchard: 2, vineyard: 2, residential: 3, village_green: 3, allotments: 3, industrial: 4, commercial: 4, retail: 4, construction: 4, parking: 5, apron: 5, water: 6, reservoir: 6, basin: 6, grass: 0, meadow: 0, grassland: 0, heath: 0, scrub: 1 };
const lu = [];
const pushA = (g, k, t) => {
  const c = LUK[k] ?? (t.surface === 'asphalt' || t.surface === 'paved' || t.area === 'yes' && t.highway ? 5 : null); if (c == null || g.length < 4 || !inCrop(g)) return;
  lu.push({ p: ring(g, 1.5), c, a: Math.abs(area2(g)) });
};
for (const e of D) {
  const t = e.tags || {};
  if (e.type === 'way' && e.geometry) {
    const g = e.geometry.filter(Boolean).map(P); if (g.length < 2) continue;
    if (t.building) pushB(g, t);
    else if (t.highway && RK[t.highway] !== undefined && t.area !== 'yes') { if (inCrop(g)) roads.push({ p: rdp(g, .8), k: RK[t.highway], br: t.bridge ? 1 : 0, tu: t.tunnel ? 1 : 0, n: t.name || t.ref || '' }); }
    else if (t.barrier === 'guard_rail') { if (inCrop(g)) rails.push(rdp(g, .3)); }
    else if (t.waterway !== undefined && t.waterway !== 'riverbank') { }
    else pushA(g, t.landuse || t.natural || t.leisure || t.amenity || t.aeroway, t);
  } else if (e.type === 'relation') {
    const k = t.landuse || t.natural || t.leisure || t.amenity;
    for (const m of e.members || []) if (m.role === 'outer' && m.geometry) { const g = m.geometry.filter(Boolean).map(P); if (t.building) pushB(g, t); else pushA(g, k, t); }
  }
}
// 土地利用柵格：大的先畫、小的蓋上去（森林裡的空地、村子裡的停車場）
const lnx = Math.round((CROP.x1 - CROP.x0) / LU_CELL), lnz = Math.round((CROP.z1 - CROP.z0) / LU_CELL), LUG = new Uint8Array(lnx * lnz);
lu.sort((a, b) => b.a - a.a);
for (const { p, c } of lu) {
  let z0 = 1e9, z1 = -1e9; for (const q of p) { z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); }
  const j0 = Math.max(0, Math.floor((z0 - CROP.z0) / LU_CELL)), j1 = Math.min(lnz - 1, Math.ceil((z1 - CROP.z0) / LU_CELL));
  for (let j = j0; j <= j1; j++) {
    const z = CROP.z0 + (j + .5) * LU_CELL, xs = [];
    for (let i = 0, n = p.length; i < n; i++) { const a = p[i], b = p[(i + 1) % n]; if ((a[1] > z) !== (b[1] > z)) xs.push(a[0] + (z - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) { const i0 = Math.max(0, Math.ceil((xs[k] - CROP.x0) / LU_CELL - .5)), i1 = Math.min(lnx - 1, Math.floor((xs[k + 1] - CROP.x0) / LU_CELL - .5)); for (let i = i0; i <= i1; i++) LUG[j * lnx + i] = c; }
  }
}
const rle = []; for (let k = 0; k < LUG.length;) { let n = 1; while (k + n < LUG.length && LUG[k + n] === LUG[k] && n < 255) n++; rle.push(LUG[k], n); k += n; }
// ─── 編碼：折線與多邊形都是 x、z × 2 的 int16，接在一起，另存每條的點數（uint16）───
const b64 = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
const pack = list => { const n = list.reduce((s, p) => s + p.length, 0), xz = new Int16Array(n * 2), cnt = new Uint16Array(list.length); let o = 0; list.forEach((p, i) => { cnt[i] = p.length; for (const q of p) { xz[o++] = Math.round(Math.max(-16000, Math.min(16000, q[0] * 2))); xz[o++] = Math.round(Math.max(-16000, Math.min(16000, q[1] * 2))); } }); return { n: b64(cnt), xz: b64(xz) }; };
const track = L => ({ xz: b64(L.xz), y: b64(L.y), names: L.names });
const BP = pack(bld.map(b => b.p)), RP = pack(roads.map(r => r.p)), GR = pack(rails);
const out = `// 自動產生（tools/nbr-dem.mjs），不要手改。
// 地形：AWS Terrain Tiles（Mapzen terrarium）加工；賽道、道路、建築、土地利用、護欄：© OpenStreetMap contributors（ODbL）
// 平面座標原點 50.35N 6.96E，x 東、z 南（公尺，真實方位；09-nbr.js 轉 180° 擺到機場南面）。地形每 ${CELL} m 一格，高度 = 值 × ${Q} + ${LO}；
// 賽道每 ${STEP} m 一點（x、z × 2 的 int16，行車方向，第 0 點是起終點），縱斷面同地形的編碼；土地利用 ${LU_CELL} m 一格（類別、連續格數）成對的 RLE
const NBR_DEM = { x0: ${CROP.x0}, z0: ${CROP.z0}, cell: ${CELL}, nx: ${nx}, nz: ${nz}, lo: ${LO}, q: ${Q}, d: '${b64(G)}' };
const NBR_TRACK = { step: ${STEP}, ns: ${JSON.stringify(track(NS))}, gp: ${JSON.stringify(track(GP))}, pit: ${JSON.stringify(pack([rdp(PIT, .2)]).xz)} };
const NBR_LU = { cell: ${LU_CELL}, nx: ${lnx}, nz: ${lnz}, rle: '${b64(new Uint8Array(rle))}' };
const NBR_OSM = {
  bld: { ...${JSON.stringify(BP)}, k: '${b64(new Uint8Array(bld.map(b => b.k)))}', h: '${b64(new Uint8Array(bld.map(b => Math.round(b.h * 4))))}' },
  road: { ...${JSON.stringify(RP)}, k: '${b64(new Uint8Array(roads.map(r => r.k | r.br << 2 | r.tu << 3)))}' },
  rail: ${JSON.stringify(GR)},
};
`;
writeFileSync(new URL('../src/parts/09-nbr-dem.js', import.meta.url), out);
console.log('dem', nx, 'x', nz, 'h', hlo.toFixed(1), hhi.toFixed(1), '| bld', bld.length, '| road', roads.length, '| rail', rails.length, '| lu', lu.length, 'rle', rle.length / 2, '|', (out.length / 1024).toFixed(0), 'KB');
