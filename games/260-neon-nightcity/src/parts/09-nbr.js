// ═══ 紐柏林賽道（plans/260-nurburgring.md）：灰鷺角機場島南面的 1:1 真實地形，北環（Nordschleife 20.7 km）＋GP（5.1 km）。
// 資料是 09-nbr-dem.js（tools/nbr-dem.mjs 產生）；這裡只有函式與解碼，畫面在 22-nbr.js。座標全在 SEA_FR（10-city.js，?zrot 跟著轉）：
// 真實座標（x 東、z 南）轉 180° 擺到 x = NBR_OX − 真實 x、z = NBR_OZ − 真實 z，GP 在北邊對著機場；高度減 NBR_BASE（Adenau 谷底約 +5 m、GP 約 +280–330 m）。
// 地形本體北緣到機場島南緣（AIR.isl.z1）之間是 2 km 的引道坡（唯一人造的地形：從機場的 0 m 照 smoothstep 升到本體北緣的高度，疊緩丘），
// 本體與引道坡外 NBR_SK 公尺是降到海床（−8）的海崖。地形、賽道整平都先算進 8 m 一格的網格 NBR.H（第一次問高度時才算），
// 地面（nbrDeck）與網格（22-nbr.js）照同一組格子與對角線，站上去才貼著畫出來的坡 ═══
const NBR_ON = !/[?&]nbr=0\b/.test(location.search);
const NBR_OX = -4100, NBR_OZ = 6800, NBR_BASE = 290, NBR_SK = 600, NBR_G = 8, NBR_SEA = -8;
const NBR_HW = { ns: 4.6, gp: 6.6, pit: 5, road: 4 };   // 半路寬：北環約 9 m（起點附近更寬）、GP 12–14 m、維修道、進場路
// 進場路（SEA_FR 座標）：機場島航廈前路的東端往南，沿島的東緣（跑道東端外 90 m）到南岸，上引道坡往西南斜爬，大折返往東南接到 GP 最北端的彎外（終點照 GP 那一點另算）
const NBR_ROAD = [[-1040, 92], [-1040, 640], [-1300, 900], [-3600, 2000]], NBR_GRADE = .085;
const nbB64 = (s, C) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new C(u.buffer); };
const NBR = NBR_ON ? (() => {
  const D = NBR_DEM, g = nbB64(D.d, Uint16Array), rx1 = D.x0 + (D.nx - 1) * D.cell, rz1 = D.z0 + (D.nz - 1) * D.cell;
  const core = { x0: NBR_OX - rx1, x1: NBR_OX - D.x0, z0: NBR_OZ - rz1, z1: NBR_OZ - D.z0 };
  // 賽道：每 4 m 一點 [x, z, y]（SEA_FR 座標），行車方向照真實（轉 180° 不改繞行方向）
  const loop = (T, hw, closed, key) => {
    const xz = nbB64(T.xz, Int16Array), n = xz.length / 2, p = [];
    const y = T.y ? nbB64(T.y, Uint16Array) : null;
    for (let k = 0; k < n; k++) p.push([NBR_OX - xz[k * 2] / 2, NBR_OZ - xz[k * 2 + 1] / 2, y ? y[k] * D.q + D.lo - NBR_BASE : 0]);
    return { key, p, hw, closed, names: T.names || [] };
  };
  const ns = loop(NBR_TRACK.ns, NBR_HW.ns, true, 'ns'), gp = loop(NBR_TRACK.gp, NBR_HW.gp, true, 'gp'), pit = loop({ xz: NBR_TRACK.pit }, NBR_HW.pit, false, 'pit');
  pit.yFrom = gp;
  // 進場路：折點加上 GP 最北端外 (hw + 1) m 那一點，Chaikin 三次、每 4 m 重取樣；縱斷面在 nbrGrid 照地形算
  let gn = gp.p[0]; for (const q of gp.p) if (q[1] < gn[1]) gn = q;
  const [lx, lz] = NBR_ROAD[NBR_ROAD.length - 1], gl = Math.hypot(lx - gn[0], lz - gn[1]);
  let R = [...NBR_ROAD, [gn[0] + (lx - gn[0]) / gl * (gp.hw + 1), gn[1] + (lz - gn[1]) / gl * (gp.hw + 1)]];
  for (let it = 0; it < 3; it++) { const Q = [R[0]]; for (let k = 0; k + 1 < R.length; k++) { const a = R[k], b = R[k + 1]; if (k) Q.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25]); if (k + 2 < R.length) Q.push([a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); } Q.push(R[R.length - 1]); R = Q; }
  const rp = [[...R[0], 0]]; let acc = 0;
  for (let k = 1; k < R.length; k++) { let [px, pz] = R[k - 1]; const [qx, qz] = R[k]; let l = Math.hypot(qx - px, qz - pz); while (acc + l >= 4) { const t = (4 - acc) / l; px += (qx - px) * t; pz += (qz - pz) * t; rp.push([px, pz, 0]); l = Math.hypot(qx - px, qz - pz); acc = 0; } acc += l; }
  rp.push([...R[R.length - 1], 0]);
  const road = { key: 'road', p: rp, hw: NBR_HW.road, closed: false, names: [], yEnd: gn[2], isl: rp.filter(q => q[1] < 640).length };
  return { D, g, core, ns, gp, pit, road, tracks: [ns, gp, pit, road], x0: core.x0 - NBR_SK, x1: core.x1 + NBR_SK, z1: core.z1 + NBR_SK, H: null, TY: null };
})() : null;
// 世界座標 → SEA_FR
const nbrL = (X, Z) => toL(X, Z, SEA_FR);
// DEM（真實座標，雙線性，超出範圍夾到邊上）減 NBR_BASE
function nbrDem(rx, rz) {
  const D = NBR.D, fx = clamp((rx - D.x0) / D.cell, 0, D.nx - 1.001), fz = clamp((rz - D.z0) / D.cell, 0, D.nz - 1.001), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, G = NBR.g, k = j * D.nx + i;
  return ((G[k] * (1 - u) + G[k + 1] * u) * (1 - v) + (G[k + D.nx] * (1 - u) + G[k + D.nx + 1] * u) * v) * D.q + D.lo - NBR_BASE;
}
// 引道坡：機場島南緣（z0）到本體北緣（core.z0）；t 那一排陸地的東西兩緣從機場島的寬度展開到本體的寬度
const nbrApron = () => ({ z0: AIR.isl.z1, z1: NBR.core.z0, x0: AIR.isl.x0, x1: AIR.isl.x1 });
const nbrApX = (A, z) => { const s = sm01((z - A.z0) / (A.z1 - A.z0)), C = NBR.core; return [A.x0 + (C.x0 - A.x0) * s, A.x1 + (C.x1 - A.x1) * s]; };
// 陸地範圍裡（本體或引道坡）一點的地形高度（沒整平賽道）
function nbrInH(x, z) {
  const C = NBR.core;
  if (z >= C.z0) return nbrDem(NBR_OX - x, NBR_OZ - z);
  const A = nbrApron(), t = clamp((z - A.z0) / (A.z1 - A.z0), 0, 1), E = nbrDem(NBR_OX - x, NBR_OZ - C.z0);
  const k = t * (1 - t) * 4;   // 緩丘：中段最明顯，兩端（機場、本體）歸零
  return E * t * t * t * (t * (t * 6 - 15) + 10) + k * (9 * Math.sin(x * .011 + z * .004) * Math.sin(z * .009 - x * .003 + 1.3) + 4 * Math.sin(x * .027 - z * .019 + 2.2));
}
// 離陸地範圍多遠（0 是在裡面），與範圍裡最近的那一點
function nbrOut(x, z) {
  const C = NBR.core, A = nbrApron();
  const cx = clamp(x, C.x0, C.x1), cz = clamp(z, C.z0, C.z1), dc = Math.hypot(x - cx, z - cz);
  const az = clamp(z, A.z0, A.z1), [ax0, ax1] = nbrApX(A, az), ax = clamp(x, ax0, ax1), da = Math.hypot(x - ax, z - az);
  return dc <= da ? [dc, cx, cz] : [da, ax, az];
}
// 沒整平賽道的地形：範圍外 NBR_SK 公尺照 smoothstep 降到海床
function nbrTerr(x, z) {
  const [d, px, pz] = nbrOut(x, z), h = nbrInH(px, pz);
  return d <= 0 ? h : h + (NBR_SEA - h) * sm01(d / NBR_SK);
}
// 進場路的縱斷面：地形前後 60 m 平均，機場島上那段是 0、終點是 GP 那一點的高度；再來回兩趟把每 4 m 的高差壓在 NBR_GRADE 以內（頭尾不動）
function nbrRoadY(T) {
  const P = T.p, n = P.length, h = P.map((q, k) => k < T.isl ? 0 : nbrTerr(q[0], q[1]));
  for (let k = 0; k < n; k++) { let s = 0, c = 0; for (let d = -15; d <= 15; d++) { const j = clamp(k + d, 0, n - 1); s += h[j]; c++; } P[k][2] = k < T.isl ? 0 : s / c; }
  P[n - 1][2] = T.yEnd;
  for (let it = 0; it < 4; it++) {
    for (let k = T.isl; k < n - 1; k++) { const l = Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]) * NBR_GRADE; P[k][2] = clamp(P[k][2], P[k - 1][2] - l, P[k - 1][2] + l); }
    for (let k = n - 2; k >= T.isl; k--) { const l = Math.hypot(P[k][0] - P[k + 1][0], P[k][1] - P[k + 1][1]) * NBR_GRADE; P[k][2] = clamp(P[k][2], P[k + 1][2] - l, P[k + 1][2] + l); }
  }
}
// 8 m 網格（整平過賽道）：第一次用到時才算。賽道每一段把附近的格點蓋成路面高度（路面 −0.15，路肩外 30 m 照 smoothstep 接回地形）
function nbrGrid() {
  if (NBR.H) return NBR;
  const t0 = performance.now(), A = nbrApron(), x0 = NBR.x0, z0 = A.z0, nx = Math.ceil((NBR.x1 - x0) / NBR_G) + 1, nz = Math.ceil((NBR.z1 - z0) / NBR_G) + 1;
  const H = new Float32Array(nx * nz), TD = new Float32Array(nx * nz).fill(1e9), TY = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) H[j * nx + i] = nbrTerr(x0 + i * NBR_G, z0 + j * NBR_G);
  const BL = 30, BW = 160;   // 坡腳：至少 BL 公尺，挖填深的地方照深度 × 1.7 放寬（約 30°），最寬 BW
  for (const T of NBR.tracks) {
    const P = T.p, n = P.length, R = T.hw + (T === NBR.road ? BW : BL + 10);   // 賽道的縱斷面照地形平滑過，只有進場路挖填得深
    if (T.yFrom) for (const q of P) { let m = 1e9; for (const g of T.yFrom.p) { const d = (g[0] - q[0]) ** 2 + (g[1] - q[1]) ** 2; if (d < m) { m = d; q[2] = g[2]; } } }   // 維修道沒有縱斷面：照 GP 最近那一點（起終點直線旁）
    if (T === NBR.road) nbrRoadY(T);
    for (let k = 0; k < (T.closed ? n : n - 1); k++) {
      const a = P[k], b = P[(k + 1) % n], ex = b[0] - a[0], ez = b[1] - a[1], L2 = ex * ex + ez * ez || 1;
      const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - R - x0) / NBR_G)), i1 = Math.min(nx - 1, Math.ceil((Math.max(a[0], b[0]) + R - x0) / NBR_G));
      const j0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - R - z0) / NBR_G)), j1 = Math.min(nz - 1, Math.ceil((Math.max(a[1], b[1]) + R - z0) / NBR_G));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const X = x0 + i * NBR_G, Z = z0 + j * NBR_G, t = clamp(((X - a[0]) * ex + (Z - a[1]) * ez) / L2, 0, 1), d = Math.hypot(X - a[0] - ex * t, Z - a[1] - ez * t) - T.hw, v = j * nx + i;
        if (d < TD[v]) { TD[v] = d; TY[v] = a[2] + (b[2] - a[2]) * t; }
      }
    }
  }
  for (let v = 0; v < nx * nz; v++) { const w = Math.min(BW, Math.max(BL, Math.abs(H[v] - TY[v]) * 1.7)); if (TD[v] < w) { const k = sm01((TD[v] - 1) / (w - 1)); H[v] = TY[v] - .15 + (H[v] - TY[v] + .15) * k; } }
  Object.assign(NBR, { H, TD, nx, nz, gx0: x0, gz0: z0, ms: Math.round(performance.now() - t0) });
  return NBR;
}
// SEA_FR 座標在網格範圍裡（本體、引道坡、海崖）
// 外框裡還要離陸地 NBR_SK 以內（外框的東南角蓋到城南的沙灘，那裡照城市的海床）
const nbrInL = (x, z) => NBR && x > NBR.x0 && x < NBR.x1 && z > AIR.isl.z1 && z < NBR.z1 && nbrOut(x, z)[0] < NBR_SK;
// 網格上的高度（兩個三角形，對角線從 (i, j) 到 (i+1, j+1)，和 22-nbr.js 的網格一樣）
function nbrMeshL(x, z) {
  const N = nbrGrid(), fx = (x - N.gx0) / NBR_G, fz = (z - N.gz0) / NBR_G, i = clamp(Math.floor(fx), 0, N.nx - 2), j = clamp(Math.floor(fz), 0, N.nz - 2), u = clamp(fx - i, 0, 1), v = clamp(fz - j, 0, 1), H = N.H, k = j * N.nx + i;
  return u >= v ? H[k] + (H[k + 1] - H[k]) * u + (H[k + N.nx + 1] - H[k + 1]) * v : H[k] + (H[k + N.nx] - H[k]) * v + (H[k + N.nx + 1] - H[k + N.nx]) * u;
}
// 賽道路面（SEA_FR）：離中心線 hw + pad 以內回傳 { y, T, k }（T 哪一條、k 第幾段），否則 null
function nbrTrackL(x, z, pad = 0) {
  const N = nbrGrid(), i = Math.round((x - N.gx0) / NBR_G), j = Math.round((z - N.gz0) / NBR_G);
  if (i < 0 || j < 0 || i >= N.nx || j >= N.nz || N.TD[j * N.nx + i] > 12 + pad) return null;
  let best = null;
  for (const T of NBR.tracks) {
    const P = T.p, n = P.length;
    for (let k = 0; k < (T.closed ? n : n - 1); k++) {
      const a = P[k]; if (Math.abs(a[0] - x) > 30 || Math.abs(a[1] - z) > 30) continue;
      const b = P[(k + 1) % n], ex = b[0] - a[0], ez = b[1] - a[1], t = clamp(((x - a[0]) * ex + (z - a[1]) * ez) / (ex * ex + ez * ez || 1), 0, 1), d = Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t);
      if (d <= T.hw + pad && (!best || d < best.d)) best = { d, y: a[2] + (b[2] - a[2]) * t, T, k };
    }
  }
  return best;
}
// 世界座標：在紐柏林的陸地上（水面以上）；nbrIn 含海崖外圈（水深照網格）
const nbrIn = (X, Z) => { if (!NBR) return false; const [x, z] = nbrL(X, Z); return nbrInL(x, z); };
const nbrH = (X, Z) => { const [x, z] = nbrL(X, Z); const t = nbrTrackL(x, z); return t ? t.y : nbrMeshL(x, z); };
const nbrLandW = (X, Z) => nbrIn(X, Z) && nbrH(X, Z) > SEA_Y;
// DECKS 的一項（22-nbr.js 登錄）：機場島上照機場（null）
// 維修區大樓（24-nbr-pit.js）：維修道最長的那段直線（OSM 的維修樓沿著它），GP 的另一側。沿線 t（從那段的起點量）t0..t1 是 n 間 BW 寬的車間，
// 離中心線 f0（車間門口，前面是 7 m 的工作車道）到 f1（後牆）；n 是往車間那一側的法向。23-nbr-road.js 的路、24-nbr-bld.js 的 OSM 建築、50-nbr.js 的樹都避開
let NBR_PB;
function nbrPitBld() {
  if (NBR_PB !== undefined) return NBR_PB;
  const P = NBR.pit.p; let k0 = -1, L = 0;
  for (let k = 0; k + 1 < P.length; k++) { const l = Math.hypot(P[k + 1][0] - P[k][0], P[k + 1][1] - P[k][1]); if (l > L) { L = l; k0 = k; } }
  if (L < 120) return (NBR_PB = null);
  const A = P[k0], B = P[k0 + 1], ux = (B[0] - A[0]) / L, uz = (B[1] - A[1]) / L, mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2;
  let bd = 1e9, side = 1;   // GP 在左手邊（(−uz, ux) 那側）是 1
  for (const q of NBR.gp.p) { const d = Math.hypot(q[0] - mx, q[1] - mz); if (d < bd) { bd = d; side = Math.sign(-uz * (q[0] - mx) + ux * (q[1] - mz)) || 1; } }
  const BW = 12, t0 = 24, n = Math.floor((L - 3 - t0) / BW), hw = NBR.pit.hw;
  return (NBR_PB = { k0, A, B, L, ux, uz, nx: uz * side, nz: -ux * side, BW, t0, n, t1: t0 + n * BW, f0: hw + 7, f1: hw + 25 });
}
// (x, z)（SEA_FR）在維修區大樓的範圍裡（往外擴 pad）
function nbrPitIn(x, z, pad = 0) {
  const B = nbrPitBld(); if (!B) return false;
  const dx = x - B.A[0], dz = z - B.A[1], t = dx * B.ux + dz * B.uz, o = dx * B.nx + dz * B.nz;
  return t > B.t0 - pad && t < B.t1 + pad && o > B.f0 - pad && o < B.f1 + pad;
}
function nbrDeck(X, Z) {
  if (!NBR) return null;
  const [x, z] = nbrL(X, Z);
  if (!nbrInL(x, z) || airLandL(x, z)) return null;
  const t = nbrTrackL(x, z, .3);
  return t ? t.y : nbrMeshL(x, z);
}
