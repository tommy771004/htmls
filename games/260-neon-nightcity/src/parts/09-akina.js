// ═══ 榛嶺（2026-10-28）：北嶺公園西北、灰鷺河東岸照真的榛名山做的一片山與一條山道 ═══
// 地形與路線是真的資料（09-akina-dem.js，tools/akina-dem.mjs 產生）：国土地理院 標高タイル的榛名山、OpenStreetMap 的群馬県道 33 號渋川松井田線——
// 從榛名湖的湖岸（28 號）上到ヤセオネ峠，再一路髮夾彎（五連ヘアピン）下到伊香保上面。整片照同一個比例 sc 縮小（水平、垂直一樣，坡度照真的），
// 轉成北嶺公園的座標框 NPARK.f（框的 x 是橫向、−z 朝山上，?zrot 轉過也對）：山道的低端（伊香保那一頭）接在公園西側，湖在最遠的那一頭。
// 地形疊在 10-city.js 的 hillH 上（akinaH，離山道與湖遠的地方、公園與鐵道橋外 110 m 內漸漸接回原本的地形），路由 10-city.js 的山路那一段最先開（akinaRoad），
// 湖面在 22-akina.js。這個檔排在 10-city.js 前面：這裡只有函式，NPARK、HILL 等到被呼叫的時候（hillH 第一次問高度）都已經建好
let AKINA = null;
// sc：縮小比例；lean：低端往湖的方向在框裡偏東多少（rad）；low：低端在框裡的位置；base：低端的世界高度；mouth、via：外緣路口與谷的經過點（框座標）
const AK_SPEC = { sc: .45, lean: .5, low: [-470, -800], base: 108, park: { x: 336, z: -644, ramp: 110 }, mouth: [-470, 260], via: [[-470, -150]] };
const akB64 = (s, C) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new C(u.buffer); };
function akinaInit() {
  if (AKINA || !NPARK) return AKINA;
  const S = AK_SPEC, f = NPARK.f, D = AK_DEM, g = akB64(D.d, Uint16Array), wt = akB64(D.w, Uint8Array), lk = new Uint8Array(g.length), lc = Math.round((D.lake - D.lo) / D.q), rxz = akB64(AK_ROAD.xz, Int16Array), ry = akB64(AK_ROAD.y, Uint16Array);
  const road = Array.from({ length: AK_ROAD.n }, (_, i) => [rxz[i * 2] / 4, rxz[i * 2 + 1] / 4, ry[i] * D.q + D.lo]), [lx, lz, hLow] = road[0];
  for (let i = 0; i < g.length; i++) if (!g[i]) { lk[i] = 255; g[i] = lc; }   // 0 是湖：記下來，高度換回湖面
  // 旋轉：真的「低端 → 湖心」對到框裡的 (sin lean, −cos lean)
  const LAKE = [-2000, 550], th = Math.atan2(-Math.cos(S.lean), Math.sin(S.lean)) - Math.atan2(LAKE[1] - lz, LAKE[0] - lx), c = Math.cos(th), s = Math.sin(th);
  const toL = (x, z) => { x -= lx; z -= lz; return [S.low[0] + S.sc * (x * c - z * s), S.low[1] + S.sc * (x * s + z * c)]; };
  const toR = (u, v) => { u = (u - S.low[0]) / S.sc; v = (v - S.low[1]) / S.sc; return [lx + u * c + v * s, lz - u * s + v * c]; };
  const yOf = h => S.base + (h - hLow) * S.sc;
  const cx = D.x0 + (D.nx - 1) * D.cell / 2, cz = D.z0 + (D.nz - 1) * D.cell / 2, [x, z] = toW(...toL(cx, cz), f);
  AKINA = { ...S, g, wt, lk, toL, toR, yOf, hLow, x, z, Rb: Math.hypot(D.nx, D.nz) * D.cell / 2 * S.sc, WL: yOf(D.lake + .25),
    rroad: road, mouth: toW(...S.mouth, f), via: S.via.map(([u, v]) => toW(u, v, f)), lakeR: toW(...toL(...LAKE), f) };
  // 谷接到山道的低端：最後一個經過點放在山道起點的反方向 90 m，谷底與山道在接頭同一個方向
  const [ax, az] = toW(...toL(lx, lz), f), [bx, bz] = toW(...toL(road[6][0], road[6][1]), f), l = Math.hypot(bx - ax, bz - az);
  AKINA.F = [ax, az]; AKINA.via.push([ax - (bx - ax) / l * 90, az - (bz - az) / l * 90]);
  AKINA.val = akValley(AKINA); AKINA.fine = 1;
  return AKINA;
}
// 真的平面座標（公尺）上的格子（地形、權重）：雙線性；de 是離裁切範圍邊界多遠（裡面是正的）
function akGrid(g, x, z, s = 1, n = AK_DEM.nx, m = AK_DEM.nz) {
  const D = AK_DEM, fx = clamp((x - D.x0) / (D.cell * s), 0, n - 1.001), fz = clamp((z - D.z0) / (D.cell * s), 0, m - 1.001), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  return (g[j * n + i] * (1 - u) + g[j * n + i + 1] * u) * (1 - v) + (g[(j + 1) * n + i] * (1 - u) + g[(j + 1) * n + i + 1] * u) * v;
}
const akRealH = (A, x, z) => akGrid(A.g, x, z) * AK_DEM.q + AK_DEM.lo;
function akDe(x, z) {
  const D = AK_DEM, x1 = D.x0 + (D.nx - 1) * D.cell, z1 = D.z0 + (D.nz - 1) * D.cell, dx = Math.min(x - D.x0, x1 - x), dz = Math.min(z - D.z0, z1 - z);
  return dx >= 0 && dz >= 0 ? Math.min(dx, dz) : -Math.hypot(Math.min(0, dx), Math.min(0, dz));
}
const akReal = (A, X, Z) => A.toR(...parkL(X, Z));
// 山腳下的沢：外緣到山道的低端原本是一片 60–130% 的陡坡，路爬不上去，所以照 via 的幾個點挖出一條谷（谷底 ±30 m 照縱斷面，往外 90 m 接回原本的坡），
// 谷底從外緣的路口（高 0.3 m）等坡爬到山道的低端（高 base），山道第一段就走谷底。點每 8 m 一個，akinaRoad 直接拿來用
function akValley(A) {
  const P = CITY_POLY, [vx, vz] = A.mouth;
  let E = null, bd = 1e9;
  for (let k = 0; k < P.length; k++) {
    const p = P[k], q = P[(k + 1) % P.length], ex = q[0] - p[0], ez = q[1] - p[1], t = clamp(((vx - p[0]) * ex + (vz - p[1]) * ez) / (ex * ex + ez * ez), 0, 1), x = p[0] + ex * t, z = p[1] + ez * t, d = Math.hypot(vx - x, vz - z);
    if (d < bd) { bd = d; E = [x, z]; }
  }
  const F = A.F, K = [E, E, ...A.via, F, F], dense = [];
  // Catmull-Rom 穿過每個點，先密取樣再照弧長每 8 m 取一點
  for (let i = 1; i < K.length - 2; i++) for (let j = 0; j < 40; j++) {
    const t = j / 40, [p0, p1, p2, p3] = [K[i - 1], K[i], K[i + 1], K[i + 2]], t2 = t * t, t3 = t2 * t;
    dense.push([0, 1].map(c => .5 * (2 * p1[c] + (p2[c] - p0[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (3 * p1[c] - p0[c] - 3 * p2[c] + p3[c]) * t3)));
  }
  dense.push(F);
  const pts = [[E[0], E[1], 0]];
  let acc = 0;
  for (let i = 1; i < dense.length; i++) {
    const a = dense[i - 1], b = dense[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let u = 8 - acc;
    while (u <= l) { pts.push([a[0] + (b[0] - a[0]) * u / l, a[1] + (b[1] - a[1]) * u / l, 0]); u += 8; }
    acc = l - (u - 8);
  }
  const L = (pts.length - 1) * 8;
  pts.forEach((p, i) => { p[2] = .3 + (A.base - .3) * i * 8 / L; });
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
  return { pts, L, bb: [x0 - 130, x1 + 130, z0 - 130, z1 + 130] };
}
// 離谷底中線多遠、那裡的谷底高度
function akValleyAt(V, X, Z) {
  const [x0, x1, z0, z1] = V.bb; if (X < x0 || X > x1 || Z < z0 || Z > z1) return null;
  const P = V.pts; let bd = 1e9, by = 0;
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], ex = b[0] - a[0], ez = b[1] - a[1], t = clamp(((X - a[0]) * ex + (Z - a[1]) * ez) / (ex * ex + ez * ez), 0, 1), d = Math.hypot(X - a[0] - ex * t, Z - a[1] - ez * t);
    if (d < bd) { bd = d; by = a[2] + (b[2] - a[2]) * t; }
  }
  return bd < 120 ? { d: bd, y: by } : null;
}
const akAng = (a, b) => ((a - b) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
// 公園與鐵道橋：框的 x 在 ±park.x、z 大於 park.z 的範圍裡不動，往外 ramp 公尺內漸漸疊上山
function akinaMask(X, Z) {
  const A = AKINA, [px, pz] = parkL(X, Z), dx = Math.max(0, Math.abs(px) - A.park.x), dz = Math.max(0, A.park.z - pz);
  return sm01(Math.hypot(dx, dz) / A.park.ramp);
}
// 山的世界高度（真的標高照比例換算；湖底比水面低 1.4 m：走進去水到腰，22-akina.js 的水面不透明）與權重（09-akina-dem.js 的權重格：順著山道與湖；再乘上公園外 110 m 的遮罩）；範圍外回傳 null
function akinaShape(X, Z) {
  const A = akinaInit(); if (!A) return null;
  const [x, z] = akReal(A, X, Z), de = akDe(x, z); if (de <= 0) return null;
  const h = akRealH(A, x, z);
  return { y: A.yOf(h) - 1.4 * sm01(akGrid(A.lk, x, z) / 255 * 2), w: akGrid(A.wt, x, z, AK_DEM.ws, AK_DEM.wnx, AK_DEM.wnz) / 255 * akinaMask(X, Z) };
}
// hillH 的最後一步（外緣的海陸權重與河谷之前）：照權重換成山的高度，再挖谷
function akinaH(X, Z, h) {
  const m = akinaShape(X, Z), A = AKINA; if (!A) return h;
  if (m && m.w > 0) h += (m.y - h) * m.w;
  const v = A.val && akValleyAt(A.val, X, Z);
  if (v) { const w = 1 - sm01((v.d - 30) / 90); h += (v.y - h) * w; }
  return h;
}
// 權重格（0–1，還沒乘公園的遮罩）
function akinaW(X, Z) { const A = akinaInit(); if (!A) return 0; const [x, z] = akReal(A, X, Z), D = AK_DEM; return akDe(x, z) > 0 ? akGrid(A.wt, x, z, D.ws, D.wnx, D.wnz) / 255 : 0; }
// 細網格：山的網格（每個粗三角形 44×100 m 左右）放不下真的地形與髮夾彎，所以權重大於 0 的三角形在 21-coast.js 另外切成 N×N（hillAkina），
// 頂點高度與 hillMeshRaw 都照這裡：權重 0.2 以上直接算 hillH，0.05 以下照粗網格的內插（權重 0 的接邊上和旁邊的粗三角形一樣高，不會裂）
function akinaFW(X, Z) { const A = AKINA; return A && A.fine ? sm01((akinaW(X, Z) - .05) / .15) : 0; }
function akinaFine(X, Z, hc) { const w = akinaFW(X, Z); return w > 0 ? hc + (hillH(X, Z) - hc) * w : hc; }
// 在山上：f = 1 是權重大於 0.02 的範圍；f > 1 是權重大於 0 的整片（細網格、石柱峰）；f < 1 是權重大於 f 的山心（10-city.js 的住宅不蓋）
function akinaIn(X, Z, f = 1) { const w = akinaW(X, Z); return f > 1 ? w > 0 : f < 1 ? w > f : w > .02; }
// 湖（DEM 裡連成一片的湖面格子，岸邊算進去一點）：樹、草、路都不擺
function akinaWet(X, Z) { const A = akinaInit(); if (!A) return false; const [x, z] = akReal(A, X, Z); return akDe(x, z) > 0 && akGrid(A.lk, x, z) > 40; }

// ─── 山道：谷（外緣的路口 → 低端）接上真的 33 號（低端 → 髮夾彎群 → ヤセオネ峠 → 湖岸），每 4 m 一點，縱斷面是 DEM 平滑過、坡度 ≤ 12% 的路面高。
// 和 10-city.js 一般的山路一樣是 [x, z, 路面高]：挖填、護欄、路燈、車流都照同一套。edgeR、hillOK、nearRoad 用不到（路是固定的，一般的山路照 nearRoad 避開它） ───
function akinaRoad() {
  const A = akinaInit(); if (!A || !A.val) return null;
  const f = NPARK.f, pts = A.val.pts.map(p => [p[0], p[1], p[2]]);
  for (let i = 1; i < A.rroad.length; i++) { const [x, z, h] = A.rroad[i], [X, Z] = toW(...A.toL(x, z), f); pts.push([X, Z, A.yOf(h)]); }
  pts.akina = 1;
  // OSM 的路段屬性（AK_ROAD.osm／jun，tools/akina-dem.mjs）：真的路第 j 點在 pts 的索引是 V + j。br：橋（10-city.js 不立護欄，22-akina.js 立高欄）、
  // calm：メロディーライン、gap：支路口那一側（±1，護欄、擋土牆、電線桿讓開）、seg：每段的 ref 與 maxspeed、jun：支路（世界座標的方向）
  const V = A.val.pts.length - 1, n = pts.length;
  pts.br = new Uint8Array(n); pts.calm = new Uint8Array(n); pts.gap = new Int8Array(n);
  pts.seg = AK_ROAD.osm.map(([i0, i1, ref, max, br, calm, lanes]) => ({ k0: V + i0, k1: V + i1, ref, max, br, calm, lanes }));
  for (const s of pts.seg) for (let k = s.k0; k <= s.k1; k++) { if (s.br) pts.br[k] = 1; if (s.calm) pts.calm[k] = 1; }
  pts.jun = AK_ROAD.jun.map(([i, a, hw, name]) => {
    const [x, z] = A.rroad[i], [X0, Z0] = toW(...A.toL(x, z), f), [X1, Z1] = toW(...A.toL(x + Math.cos(a) * 10, z + Math.sin(a) * 10), f), l = Math.hypot(X1 - X0, Z1 - Z0) || 1;
    const k = Math.min(n - 1, V + i), q = pts[Math.min(n - 1, k + 1)], p = pts[Math.max(0, k - 1)], tl = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, nx = -(q[1] - p[1]) / tl, nz = (q[0] - p[0]) / tl;
    const dx = (X1 - X0) / l, dz = (Z1 - Z0) / l, sd = dx * nx + dz * nz >= 0 ? 1 : -1, hwd = hw === 'primary' || hw === 'secondary' ? 3 : 2.4;
    for (let j = Math.max(0, k - 6); j <= Math.min(n - 1, k + 6); j++) pts.gap[j] = sd;
    return { k, dx, dz, sd, hw, hwd, name };
  });
  // 路邊（AK_ROAD.rail／obj，Overpass 的節點與 way）：rail 是 barrier=guard_rail（bit 1：sd +1 那一側、bit 2：−1；10-city.js 不看落差照樣立）；
  // obj 是 bus_stop／viewpoint（世界座標、在哪一側、離中線幾公尺）與 parking（外形，世界座標；akinaLot 判斷在不在裡面，樹不種、路邊留口）
  const rN = i => { const a = A.rroad[Math.max(0, i - 1)], b = A.rroad[Math.min(A.rroad.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l]; };
  const gN = k => { const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l]; };
  const wOf = (i, o) => { const [x, z] = A.rroad[i], [nx, nz] = rN(i); return toW(...A.toL(x + nx * o, z + nz * o), f); };
  const sdOf = (i, s) => { const k = V + i, [X, Z] = wOf(i, s * 5), [gx, gz] = gN(k); return (X - pts[k][0]) * gx + (Z - pts[k][1]) * gz >= 0 ? 1 : -1; };
  pts.rail = new Uint8Array(n);
  for (const [i0, i1, s] of AK_ROAD.rail || []) { const sd = sdOf((i0 + i1) >> 1, s); for (let k = V + i0; k <= Math.min(n - 2, V + i1); k++) pts.rail[k] |= sd > 0 ? 1 : 2; }
  pts.obj = (AK_ROAD.obj || []).map(([kind, i, o, name, poly]) => {
    const k = V + i, [X, Z] = wOf(i, o), [gx, gz] = gN(k), off = (X - pts[k][0]) * gx + (Z - pts[k][1]) * gz;
    const ring = []; for (let q = 0; q + 1 < poly.length; q += 2) ring.push(toW(...A.toL(poly[q], poly[q + 1]), f));
    return { kind, k, sd: off >= 0 ? 1 : -1, off: Math.abs(off), name, x: X, z: Z, ring };
  });
  AKINA.lots = pts.obj.filter(o => o.kind === 'park' && o.ring.length > 2);
  // 停車場接在路邊的那幾點（外形離路中線 7 m 內、OSM 沒畫護欄的那一側）當成路口：護欄、擋土牆、電線桿讓開
  for (const o of AKINA.lots) for (let k = Math.max(0, o.k - 40); k < Math.min(n, o.k + 40); k++) {
    const [gx, gz] = gN(k), bit = o.sd > 0 ? 1 : 2; if (pts.rail[k] & bit) continue;
    for (let u = 0; u <= 8; u += 1) { const x = pts[k][0] + gx * o.sd * (5.2 + u), z = pts[k][1] + gz * o.sd * (5.2 + u); if (akinaInLot(o, x, z)) { if (u <= 2) pts.gap[k] = o.sd; break; } }
  }
  pts.stats = { len: Math.round(pts.reduce((a, p, i) => i ? a + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0, 0)), val: A.val.pts.length, n: pts.length, top: Math.round(Math.max(...pts.map(p => p[2]))), lake: Math.round(A.WL) };
  AKINA.road = pts;
  return pts;
}
// 停車場（OSM amenity=parking）：點在外形裡（射線法）。akinaLot 給 10-city.js 的林子與 22-akina.js 用，沒有榛嶺回 false
function akinaInLot(o, x, z) {
  const r = o.ring; let c = false;
  for (let a = 0, b = r.length - 1; a < r.length; b = a++) if ((r[a][1] > z) !== (r[b][1] > z) && x < (r[b][0] - r[a][0]) * (z - r[a][1]) / (r[b][1] - r[a][1]) + r[a][0]) c = !c;
  return c;
}
function akinaLot(X, Z, m = 0) {   // m：外形往外再算幾公尺（樹冠不蓋到停車場上）
  if (!AKINA || !AKINA.lots) return false;
  for (const o of AKINA.lots) {
    if (!o.bb) o.bb = o.ring.reduce((b, [x, z]) => [Math.min(b[0], x), Math.min(b[1], z), Math.max(b[2], x), Math.max(b[3], z)], [1e9, 1e9, -1e9, -1e9]);
    if (X < o.bb[0] - m || Z < o.bb[1] - m || X > o.bb[2] + m || Z > o.bb[3] + m) continue;
    if (akinaInLot(o, X, Z) || m && (akinaInLot(o, X + m, Z) || akinaInLot(o, X - m, Z) || akinaInLot(o, X, Z + m) || akinaInLot(o, X, Z - m))) return true;
  }
  return false;
}
// 停車場的地面（10-city.js 的 HILL.carveH 最後套上）：外形裡是照原本地面（已經挖填過）最小平方擬合的斜平面，外面 6 m 內漸漸接回去。
// 擬合時本身會呼叫 hillMeshH → carveH → 這裡，用 o.fit 擋住遞迴（擬合用的是還沒整平的地面）
function akinaLotH(X, Z, h) {
  for (const o of AKINA.lots) {
    if (!o.bb) o.bb = o.ring.reduce((b, [x, z]) => [Math.min(b[0], x), Math.min(b[1], z), Math.max(b[2], x), Math.max(b[3], z)], [1e9, 1e9, -1e9, -1e9]);
    if (X < o.bb[0] - 6 || Z < o.bb[1] - 6 || X > o.bb[2] + 6 || Z > o.bb[3] + 6 || o.fit && !o.pl) continue;
    if (!o.pl) {
      o.fit = 1; let n = 0, sx = 0, sz = 0, sh = 0, sxx = 0, szz = 0, sxz = 0, sxh = 0, szh = 0;
      for (let x = o.bb[0]; x <= o.bb[2]; x += 1.5) for (let z = o.bb[1]; z <= o.bb[3]; z += 1.5) {
        if (!akinaInLot(o, x, z)) continue; const v = hillMeshH(x, z); if (!Number.isFinite(v)) continue;
        const u = x - o.bb[0], w = z - o.bb[1]; n++; sx += u; sz += w; sh += v; sxx += u * u; szz += w * w; sxz += u * w; sxh += u * v; szh += w * v;
      }
      if (n < 3) { o.pl = [h, 0, 0]; continue; }
      const mx = sx / n, mz = sz / n, mh = sh / n, cxx = sxx / n - mx * mx, czz = szz / n - mz * mz, cxz = sxz / n - mx * mz, cxh = sxh / n - mx * mh, czh = szh / n - mz * mh, dt = cxx * czz - cxz * cxz || 1;
      const b = (cxh * czz - czh * cxz) / dt, c = (czh * cxx - cxh * cxz) / dt; o.pl = [mh - b * mx - c * mz, b, c];
    }
    const p = o.pl[0] + o.pl[1] * (X - o.bb[0]) + o.pl[2] * (Z - o.bb[1]);
    if (akinaInLot(o, X, Z)) return p;
    let d = 1e9; const r = o.ring;
    for (let q = 0; q + 1 < r.length; q++) { const [ax, az] = r[q], [bx, bz] = r[q + 1], ex = bx - ax, ez = bz - az, t = Math.max(0, Math.min(1, ((X - ax) * ex + (Z - az) * ez) / (ex * ex + ez * ez || 1))); d = Math.min(d, Math.hypot(X - ax - ex * t, Z - az - ez * t)); }
    if (d < 6) { const t = d / 6, s = t * t * (3 - 2 * t); return p + (h - p) * s; }
  }
  return h;
}
// 髮夾彎：前後各 20 m 內轉了 75° 以上的點，回傳轉向（+1 是世界座標 atan2(z, x) 增加的那一邊，−1 相反），不是彎道回 0。照路算一次存起來
function akinaPin(R, k) {
  if (!R.pin) {
    const n = R.length, hd = new Float32Array(n), pin = R.pin = new Int8Array(n);
    for (let i = 0; i + 1 < n; i++) hd[i] = Math.atan2(R[i + 1][1] - R[i][1], R[i + 1][0] - R[i][0]);
    for (let i = 5; i + 6 < n; i++) { let t = 0; for (let j = i - 5; j < i + 5; j++) t += akAng(hd[j + 1], hd[j]); if (Math.abs(t) > 1.3) pin[i] = Math.sign(t); }
  }
  return R.pin[k] || 0;
}
// 髮夾彎外側的導向牌：路肩外 o 公尺一根柱子、一面 0.6 × 0.75 m 的黑底板朝路中間，板上兩道白色的箭頭（＞）指著轉彎的方向
function akinaChevron(rk, A, tx, tz, nx, nz, o, hp) {
  const x = A[0] + nx * o, z = A[1] + nz * o, y = hillMeshH(x, z); if (!Number.isFinite(y) || Math.abs(y - A[2]) > 2.5) return;
  const fx = -nx, fz = -nz, ry = Math.atan2(fx, fz), lx = Math.cos(ry), lz = -Math.sin(ry);   // 板的正面朝路、板面的 +x 在世界裡的方向
  const dir = Math.sign(tx * lx + tz * lz) || 1, yb = Math.max(y, A[2]) + 1.25;
  rk.box(x - fx * .05, yb - .62, z - fz * .05, .07, 1.25, .07, 0x6c7074, TX.galv, 0, ry, 0);
  rk.box(x, yb, z, .6, .75, .04, 0x101113, 2, 0, ry, 0);
  for (const s of [1, -1]) rk.box(x + fx * .025 + lx * dir * .02, yb + s * .13, z + fz * .025 + lz * dir * .02, .34, .09, .01, 0xf2f2ee, 2, 0, ry, s * dir * -.75);
}
// 10-city.js 的外緣山林：外緣這條邊往外種到多遠（平常 980 m；朝榛嶺的邊種到山的另一側）
function akinaSMax(a, b, Rk) {
  const A = akinaInit(); if (!A) return 980;
  const [cx, cz] = CITY_C, mx = (a[0] + b[0]) / 2 - cx, mz = (a[1] + b[1]) / 2 - cz, D = Math.hypot(A.x - cx, A.z - cz);
  const off = Math.abs(akAng(Math.atan2(mz, mx), Math.atan2(A.z - cz, A.x - cx)));
  return off < Math.asin(Math.min(1, A.Rb / D)) ? Math.max(980, D + A.Rb - Rk) : 980;
}
// 榛嶺闊葉樹的遠景（50-assets.js 呼叫）：拿 hill_homes.glb 的遠景楓樹 maple_lo，紅橘色的樹冠頂點色換成深淺不同的綠（照原本的明暗），整棵放大 1.15 倍（近景 broad 比 maple 大）
function akinaBroadLo(g0) {
  const g = g0.clone(), c = g.attributes.color; if (!c) return g;
  const G = [[.085, .14, .045], [.06, .11, .035], [.11, .16, .06]];
  for (let i = 0; i < c.count; i++) {
    const r = c.getX(i), gg = c.getY(i), b = c.getZ(i); if (r < gg * 1.3 + .02) continue;   // 樹幹（褐灰）不動
    const l = Math.min(1.6, (r + gg + b) / .9), k = G[i % 3];
    c.setXYZ(i, k[0] * l, k[1] * l, k[2] * l);
  }
  c.needsUpdate = true; g.scale(1.15, 1.15, 1.15); g.computeBoundingSphere(); g.name = 'broad_lo';
  return g;
}
