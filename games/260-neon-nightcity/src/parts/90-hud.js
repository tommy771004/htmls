
// ═══ HUD：任務卡、羅盤與街名、地區天氣時間、旋轉小地圖、目標標記、速度表、全區地圖 ═══
// 北方 = -z；地圖上 px = x、py = z。heading 以順時針角度表示，0 為北。
// 地圖涵蓋對岸、海與灰鷗島；每公尺 1.5 px（小地圖另外放大回原本的比例）。底圖全部是世界座標：
// 片裡的街區與地塊照邏輯矩形取點換到世界座標（彎曲的片邊上每 12 m 取一點），路面是路網（06-roads.js）每條邊的折線描粗
const MAP_BB = (() => {
  const B = { x0: CITY_BB.x0 - 60, x1: CITY_BB.x1 + 60, z0: CITY_BB.z0 - 60, z1: CITY_BB.z1 + 60 };
  const add = ([x, z]) => { B.x0 = Math.min(B.x0, x - 40); B.x1 = Math.max(B.x1, x + 40); B.z0 = Math.min(B.z0, z - 40); B.z1 = Math.max(B.z1, z + 40); };
  rectW(ISLE.x0, ISLE.x1, ISLE.z0, ISLE.z1).forEach(add);
  add(toW(FAR_BANK_X - 120, Math.min(FAR_Z1, CITY_Z0), FAR_ZN));
  if (RAIL) for (const [x, z] of RAIL.pts) add(toW(x, z, RAIL_ZN));   // 北嶺鐵道橋連兩端的隧道
  return B;
})();
const MAP_X0 = MAP_BB.x0, MAP_Z0 = MAP_BB.z0, MAP_S = 1.5, MINI_K = 2 / MAP_S;
// 邏輯矩形換成世界座標的多邊形：彎曲的片每條邊每 seg 公尺取一點（矩形小於 seg 時只取四個角）
function rectPolyW(x0, x1, z0, z1, zn = zoneAtL((x0 + x1) / 2, (z0 + z1) / 2), seg = 12) {
  if (!zn || !zn.W) return rectW(x0, x1, z0, z1, zn);
  const nx = Math.max(1, Math.ceil((x1 - x0) / seg)), nz = Math.max(1, Math.ceil((z1 - z0) / seg)), P = [];
  for (let k = 0; k < nx; k++) P.push(toW(x0 + (x1 - x0) * k / nx, z0, zn));
  for (let k = 0; k < nz; k++) P.push(toW(x1, z0 + (z1 - z0) * k / nz, zn));
  for (let k = nx; k > 0; k--) P.push(toW(x0 + (x1 - x0) * k / nx, z1, zn));
  for (let k = nz; k > 0; k--) P.push(toW(x0, z0 + (z1 - z0) * k / nz, zn));
  return P;
}
const polyBB = P => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } return [x0, x1, z0, z1]; };
// 地圖要畫的形狀（世界座標，開場算一次）：外緣外的地形是 8 m 一格的點陣（hillH 高於水面的是陸地，越高越亮），
// 城外的沙灘、碼頭、棧橋、島與橋，街區（外圈人行道、裡面的街廓或公園）與地塊
const MAP_GEO = (() => {
  const S = 8, x0 = MAP_X0 - 1500, z0 = MAP_Z0 - 1500, nx = Math.ceil((MAP_BB.x1 + 1500 - x0) / S), nz = Math.ceil((MAP_BB.z1 + 1500 - z0) / S);
  const ter = document.createElement('canvas'); ter.width = nx; ter.height = nz;
  const tc = ter.getContext('2d'), img = tc.createImageData(nx, nz), d = img.data;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const X = x0 + (i + .5) * S, Z = z0 + (j + .5) * S;
    if (inCity(X, Z)) continue;
    const h = hillH(X, Z);
    if (h <= SEA_Y) continue;
    const t = Math.min(1, h / 320), o = (j * nx + i) * 4;
    d[o] = 34 + 22 * t; d[o + 1] = 37 + 22 * t; d[o + 2] = 42 + 18 * t; d[o + 3] = 255;
  }
  tc.putImageData(img, 0, 0);
  const shape = (r, zn) => { const pts = rectPolyW(r.x0, r.x1, r.z0, r.z1, zn); return { pts, bb: polyBB(pts) }; };
  const coast = [
    { ...shape({ ...BEACH, z0: BEACH.z0 - INLAND, z1: BEACH.z0 + BEACH.len * SEA_Y / -BEACH.drop }), c: 'beach' },
    { ...shape(QUAY), c: 'quay' }, ...PIERS.map(r => ({ ...shape(r), c: 'pier' })), { ...shape(ISLE), c: 'isle' }, { ...shape(BRIDGE), c: 'road' },
  ];
  const blk = blocks.map(b => { const zn = zoneAtL((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2), o = shape(b, zn); return { ...o, park: b.park, plaza: !!b.plaza, inn: rectPolyW(b.x0 + SW, b.x1 - SW, b.z0 + SW, b.z1 - SW, zn), b, zn }; });
  const lot = lots.map(L => { const pts = rectW(L.x0, L.x1, L.z0, L.z1, L.zn); return { pts, bb: polyBB(pts), L }; });
  return { ter, tx0: x0, tz0: z0, tS: S, coast, blk, lot };
})();
const lotCol = L => L.special ? '#5a3a52' : L.style === 3 ? '#1b1e24' : '#202329';
// 畫整座城（底圖與全區地圖共用）：P 把世界座標換成畫布座標，k 是每公尺幾 px，C 是配色，vis(bb) 決定要不要畫，
// lot 是地塊的顏色（null 不畫地塊），line 是路中心線（null 不畫）
// 北嶺公園（10-city.js 的 NPARK，公園自己的座標框）：圍籬範圍、步道、觀景台與管理站，換成世界座標的多邊形
const MAP_PARK = (() => {
  const W = NPARK.walk, L = NPARK.look, C = NPARK.cabin, w = (x, z) => toW(x, z, NPARK.f), walk = [];
  for (let i = 0; i <= 40; i++) { const x = W.x0 + (W.x1 - W.x0) * i / 40; walk.push(w(x, NPARK.edgeZ(x))); }
  walk.push(w(W.x1, W.z0), w(W.x0, W.z0));
  const box = (x0, x1, z0, z1) => [w(x0, z0), w(x1, z0), w(x1, z1), w(x0, z1)];
  return { walk, trail: NPARK.trail.map(([x, z]) => w(x, z)), look: box(L.x0, L.x1, L.z0, L.z1), cabin: box(C.x - 4, C.x + 4, C.z - 3, C.z + 3) };
})();
// 北嶺鐵道（21-rail.js 的 RAIL）：露天的一段（平台與橋）和兩端的隧道分開，隧道畫虛線
// 港灣高架線（21-xrail.js）：中心線每 8 m 一點與三站的位置
const MAP_XR = XR ? { pts: Array.from({ length: Math.ceil((XR.aE - XR.aS) / 8) + 1 }, (_, i) => XR.at(Math.min(XR.aE, XR.aS + i * 8)).slice(0, 2)), sts: XR.sts.map(s => [s.x, s.z]) } : null;
const MAP_RAIL = RAIL ? (() => {
  const V = VIADUCT, [w, e] = V.ends, open = [], tun = [[], []];
  for (const [x, z] of RAIL.pts) {
    const ew = V.frame(w, x, z)[0], ee = V.frame(e, x, z)[0], t = ew > (w.port.kind === 'rock' ? w.port.in : V.A) ? 0 : ee > (e.port.kind === 'rock' ? e.port.in : V.A) ? 1 : -1, p = toW(x, z, RAIL_ZN);
    if (t < 0) open.push(p); else tun[t].push(p);
  }
  tun[0].push(open[0]); tun[1].unshift(open[open.length - 1]);
  return { open, tun };
})() : null;
// 灰鷺角國際機場（21-air.js，SEA_FR 座標框）：島、堤道、跑道、滑行道、機坪與航廈（世界座標的多邊形）
const MAP_AIR = AIR_L ? (() => {
  const L = AIR_L, r = (x0, x1, z0, z1) => [airW(x0, z0), airW(x1, z0), airW(x1, z1), airW(x0, z1)], R = L.rwy, W = L.twy, A = L.apron, I = L.I;
  return { isl: r(I.x0, I.x1, I.z0, I.z1), road: AIR.road.map(([x, z]) => airW(x, z)), hw: AIR.hw, rwy: r(R.x0, R.x1, R.z - R.hw, R.z + R.hw),
    twy: [r(W.x0 - W.hw, W.x1 + W.hw, W.z - W.hw, W.z + W.hw), ...L.links.map(([x, z0, z1]) => r(x - W.hw, x + W.hw, z0, z1))],
    apron: [r(A.x0, A.x1, A.z0, A.z1), r(L.land.x0, L.land.x1, L.land.z0, L.land.z1), r(L.plaza.x0, L.plaza.x1, L.plaza.z0, L.plaza.z1), r(L.park.x0, L.park.x1, L.park.z0, L.park.z1)],
    bld: [r(L.term.x - 85, L.term.x + 85, L.term.z - 55, L.term.z + 55), r(L.hangar.x - 57, L.hangar.x + 57, L.hangar.z - 38, L.hangar.z + 38), r(L.tower.x - 9, L.tower.x + 9, L.tower.z - 9, L.tower.z + 9)] };
})() : null;
// 機場不在預先畫好的小地圖底圖（mapImg）裡（底圖會寬兩倍多），底圖、全區地圖與小地圖都即時用向量畫
function airMapDraw(c, P, k, C) {
  if (!MAP_AIR) return;
  const M = MAP_AIR, path = (pts, close) => { c.beginPath(); pts.forEach(([x, z], n) => { const [a, b] = P(x, z); if (n) c.lineTo(a, b); else c.moveTo(a, b); }); if (close) c.closePath(); };
  c.fillStyle = C.grass; path(M.isl, true); c.fill();
  c.strokeStyle = C.road; c.lineWidth = 2 * M.hw * k; c.lineJoin = c.lineCap = 'round'; path(M.road); c.stroke();
  c.fillStyle = C.walk; for (const p of M.apron) { path(p, true); c.fill(); }
  c.fillStyle = C.road; for (const p of M.twy) { path(p, true); c.fill(); } path(M.rwy, true); c.fill();
  c.fillStyle = C.block; for (const p of M.bld) { path(p, true); c.fill(); }
}
function drawCity(c, P, k, C, vis, lot, line) {
  const path = (pts, close) => { c.beginPath(); pts.forEach(([x, z], n) => { const [a, b] = P(x, z); if (n) c.lineTo(a, b); else c.moveTo(a, b); }); if (close) c.closePath(); };
  const G = MAP_GEO, [tx, tz] = P(G.tx0, G.tz0);
  c.imageSmoothingEnabled = true; c.drawImage(G.ter, tx, tz, G.ter.width * G.tS * k, G.ter.height * G.tS * k);
  c.fillStyle = C.grass; path(CITY_POLY, true); c.fill();   // 外緣裡面：片之間的空地是草地
  for (const s of G.coast) if (vis(s.bb)) { c.fillStyle = C[s.c]; path(s.pts, true); c.fill(); }
  { const K = MAP_PARK; c.fillStyle = C.park; path(K.walk, true); c.fill(); c.strokeStyle = C.trail || '#8a7050'; c.lineWidth = Math.max(1.4, 2.6 * k); c.lineJoin = c.lineCap = 'round'; path(K.trail); c.stroke(); c.fillStyle = C.trail || '#8a7050'; path(K.look, true); c.fill(); path(K.cabin, true); c.fill(); }   // 北嶺公園
  airMapDraw(c, P, k, C);
  if (MAP_RAIL) {   // 鐵道：深色道床上一條淺色軌線，隧道是虛線
    const R = MAP_RAIL, lw = Math.max(1.2, 2.2 * k);
    c.lineJoin = c.lineCap = 'round'; c.strokeStyle = C.railBed || '#15171b'; c.lineWidth = lw * 2.4; path(R.open); c.stroke();
    c.strokeStyle = C.rail || '#9aa0aa'; c.lineWidth = lw; path(R.open); c.stroke();
    c.setLineDash([lw * 2.5, lw * 2]); c.lineCap = 'butt'; c.lineWidth = lw * .9; for (const t of R.tun) { path(t); c.stroke(); } c.setLineDash([]);
  }
  c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = C.road; c.lineWidth = 2 * HR * k;
  for (const e of RN.edges) { path(e.pts); c.stroke(); }
  for (const s of G.blk) {
    if (!vis(s.bb)) continue;
    c.fillStyle = C.walk; path(s.pts, true); c.fill();
    if (s.plaza) continue;   // 廣場：整塊是鋪面
    c.fillStyle = s.park ? C.park : C.block; path(s.inn, true); c.fill();
  }
  c.strokeStyle = C.road; c.lineWidth = 2 * HR * k;
  for (const e of RN.edges) if (e.kind === 'd') { path(e.pts); c.stroke(); }   // 斜的大道蓋在廣場上
  c.strokeStyle = C.fwy || '#b08a3a'; c.lineWidth = 2 * HR * k;
  for (const e of RN.edges) if (e.kind === 'f') { c.lineWidth = 2 * (e.hw || HR) * k; path(e.pts); c.stroke(); }   // 快速道路（GTA 地圖的黃色；匝道窄一點）
  if (MAP_XR) {   // 港灣高架線：疊在快速道路上，畫法同鐵道，三站是淺色方塊
    const lw = Math.max(1.2, 2.2 * k), q = Math.max(3, 5 * k);
    c.lineJoin = c.lineCap = 'round'; c.strokeStyle = C.railBed || '#15171b'; c.lineWidth = lw * 2.4; path(MAP_XR.pts); c.stroke();
    c.strokeStyle = C.rail || '#9aa0aa'; c.lineWidth = lw; path(MAP_XR.pts); c.stroke();
    c.fillStyle = C.rail || '#9aa0aa'; c.strokeStyle = C.railBed || '#15171b'; c.lineWidth = lw * .8;
    for (const [x, z] of MAP_XR.sts) { const [a, b] = P(x, z); c.fillRect(a - q / 2, b - q / 2, q, q); c.strokeRect(a - q / 2, b - q / 2, q, q); }
  }
  if (lot) for (const s of G.lot) if (vis(s.bb)) { c.fillStyle = lot(s.L); path(s.pts, true); c.fill(); }
  if (line) { c.strokeStyle = line; c.lineWidth = 1; for (const e of RN.edges) { path(e.pts); c.stroke(); } }
}
const MINI_C = { grass: '#26321f', walk: '#2a2d33', block: '#2a2d33', park: '#26321f', road: '#4a4e56', beach: '#6a5e46', quay: '#3a3d42', pier: '#5a4632', isle: '#26321f' };
const mapImg = document.createElement('canvas');
mapImg.width = Math.ceil((MAP_BB.x1 - MAP_X0) * MAP_S); mapImg.height = Math.ceil((MAP_BB.z1 - MAP_Z0) * MAP_S);
{
  const c = mapImg.getContext('2d');
  c.fillStyle = '#14202a'; c.fillRect(0, 0, mapImg.width, mapImg.height);   // 水
  drawCity(c, (x, z) => [(x - MAP_X0) * MAP_S, (z - MAP_Z0) * MAP_S], MAP_S,
    MINI_C,
    () => true, lotCol, 'rgba(255,190,90,.35)');
}
const VENUE_PINS = [
  { name: 'LAZARUS', ...WP(CLUB_X, CLUB_Z + 2), col: '#ff3fa0' },
  { name: 'AFTERGLOW', ...WP(BAR_X - 4.6, BAR_Z + 2), col: '#ffa040' },
  { name: 'CHROME WORKS', ...WP(GAR_X, GAR_Z + 4), col: '#2cf2d8' },
  { name: 'VELOCE MOTORS', ...WP(DEAL_X, DEAL_Z + 2), col: '#ffcf6a' },
  { name: 'GARAGE 07', ...WP(HOME_X, HOME_Z - 2), col: '#ff8a3a' },
];
const mini = $('mini'), mctx = mini.getContext('2d');
const cmp = $('cmp'), cctx = cmp.getContext('2d');
const DIRN = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const headingOf = (dx, dz) => ((180 - Math.atan2(dx, dz) * 180 / Math.PI) % 360 + 360) % 360;
const dirName = h => DIRN[Math.round(h / 45) % 8];
// 世界座標 → 所在區的邏輯座標，再照方格找最近的大道與街
// 天樞島（邏輯 x ≥ 8000，大道 i = 114–120、街 j = 1–9）照曼哈頓下城的街名；片之間的彎路（連接道路）依路段給名字
const ISLE_AVE = ['Greenwich St', 'Trinity Pl', 'Broadway', 'Nassau St', 'William St', 'Pearl St', 'Water St'];
const ISLE_STR = ['Chambers St', 'Warren St', 'Murray St', 'Vesey St', 'Fulton St', 'John St', 'Maiden Ln', 'Pine St', 'Wall St'];
const ISLE_CURVE = ['Exchange Pl', 'Beaver St', 'Stone St', 'Whitehall St', 'Cedar St', 'Liberty St', 'Rector St', 'Bridge St', 'Old Slip', 'Hanover Sq'];
let isleConn = null;
function isleStreet(X, Z, x, z) {
  const zn = zoneAtW(X, Z);
  if (zn && zn.isle) {
    let bi = 114, bd = 1e9; for (let i = 114; i <= 120; i++) { const d = Math.abs(x - avX(i)); if (d < bd) { bd = d; bi = i; } }
    let bj = 1, be = 1e9; for (let j = 1; j <= 9; j++) { const d = Math.abs(z - stZ(j)); if (d < be) { be = d; bj = j; } }
    if (bd < 13 && be < 13) return `${ISLE_AVE[bi - 114]} · ${ISLE_STR[bj - 1]}`;
    if (bd < 13 || be < 13) return bd < be ? ISLE_AVE[bi - 114] : ISLE_STR[bj - 1];
  }
  isleConn ||= RN.edges.filter(e => e.kind === 'c' && e.pts.some(([px, pz]) => inPoly(LAKE_P, px, pz)));
  let best = null, bd = (HR + 6) ** 2;
  for (const e of isleConn) for (const [px, pz] of e.pts) { const d = (px - X) ** 2 + (pz - Z) ** 2; if (d < bd) { bd = d; best = e; } }
  if (best) return best.bridge ? `${ISLE_CURVE[best.id % ISLE_CURVE.length]} Bridge` : ISLE_CURVE[best.id % ISLE_CURVE.length];
  return null;
}
function streetName(X, Z, Y) {
  if (Y === undefined || deckTop(X, Z) === null || deckAt(X, Z, Y) !== null) for (const F of FWY) if (F.edges) for (const e of F.edges) for (const p of e.pts) if (Math.abs(p[0] - X) < HR + 2 && Math.abs(p[1] - Z) < HR + 2) return F.name;   // 快速道路（世界座標，點每 4 m 一個；在橋下就照地面的路名）
  const [x, z] = toL(X, Z);
  { const p = plazaAt(x, z); if (p && plazaD(x, z) < HR + SW) return p.D.name; }   // 廣場裡斜的大道（06-roads.js）
  if (inPoly(LAKE_P, X, Z)) { const n = isleStreet(X, Z, x, z); if (n) return n; }
  if (x < CITY_X0 - 6 || x > CITY_X1 + 6 || z > CITY_Z1 + 6 || z < CITY_Z0 - 6) return district(x, z).replace(/^\S+ /, '');   // 格網外（海邊、島、河濱）沒有街名，顯示地名
  let bi = 0, bd = 1e9; for (let i = 0; i <= NX; i++) { const d = Math.abs(x - avX(i)); if (d < bd) { bd = d; bi = i; } }
  let bj = 0, be = 1e9; for (let j = 0; j <= NZ; j++) { const d = Math.abs(z - stZ(j)); if (d < be) { be = d; bj = j; } }
  if (bd < 13 && be < 13) return `${AVE[bi]} · ${STR[bj]}`;
  return bd < be ? AVE[bi] : STR[bj];
}
const hudCache = {};
const setText = (id, t) => { if (hudCache[id] !== t) { hudCache[id] = t; $(id).textContent = t; } };
const _pv = V3();
function drawCompass(h, mk, wp) {
  const W = cmp.width, H = cmp.height; cctx.clearRect(0, 0, W, H);
  const span = 150, px = d => W / 2 + d / span * W;
  cctx.strokeStyle = 'rgba(236,232,224,.5)'; cctx.lineWidth = 2;
  cctx.beginPath(); cctx.ellipse(W / 2, H * 3.1, W * .52, H * 2.7, 0, Math.PI * 1.17, Math.PI * 1.83); cctx.stroke();
  cctx.font = `600 ${H * .34}px system-ui`; cctx.textAlign = 'center'; cctx.textBaseline = 'middle';
  for (let a = 0; a < 360; a += 15) {
    let d = ((a - h + 540) % 360) - 180; if (Math.abs(d) > span / 2) continue;
    const x = px(d), y = H * .42 + (d / span) ** 2 * H * .9;
    if (a % 45 === 0) { cctx.fillStyle = a === 0 ? '#ffae57' : 'rgba(236,232,224,.9)'; cctx.fillText(DIRN[a / 45], x, y - H * .02); }
    else { cctx.fillStyle = 'rgba(236,232,224,.45)'; cctx.fillRect(x - 1, y - H * .06, 2, H * .14); }
  }
  for (const [a, col] of [[wp, GPS_WP], [mk, '#ffae57']]) {
    if (a == null) continue;
    let d = ((a - h + 540) % 360) - 180; d = clamp(d, -span / 2, span / 2);
    const x = px(d), y = H * .82 + (d / span) ** 2 * H * .5;
    cctx.fillStyle = col; cctx.beginPath(); cctx.arc(x, y, H * .1, 0, 7); cctx.fill();
  }
  cctx.fillStyle = 'rgba(236,232,224,.95)'; cctx.beginPath(); cctx.moveTo(W / 2 - 6, 2); cctx.lineTo(W / 2 + 6, 2); cctx.lineTo(W / 2, 10); cctx.fill();
}
function drawMini(px, pz, yaw, mk) {
  const W = mini.width, R2 = W / 2;
  mctx.save(); mctx.clearRect(0, 0, W, W);
  mctx.beginPath(); mctx.arc(R2, R2, R2 - 2, 0, 7); mctx.clip();
  mctx.fillStyle = '#1a1c21'; mctx.fillRect(0, 0, W, W);
  const zoom = (player.mode === 'drive' ? .9 : 1.5) * MINI_K;
  mctx.translate(R2, R2); mctx.rotate(yaw - Math.PI); mctx.scale(zoom, zoom);
  mctx.drawImage(mapImg, -(px - MAP_X0) * MAP_S, -(pz - MAP_Z0) * MAP_S);
  const P2 = (x, z) => [(x - px) * MAP_S, (z - pz) * MAP_S];
  if (MAP_AIR && (px < MAP_X0 + 400 || pz < MAP_Z0 + 400)) airMapDraw(mctx, P2, MAP_S, MINI_C);   // 機場（底圖外面）
  gpsMini(mctx, P2, zoom);   // 導航路線（69-gps.js）
  for (const v of VENUE_PINS) { const [x, y] = P2(v.x, v.z); mctx.fillStyle = v.col; mctx.beginPath(); mctx.arc(x, y, 5 / zoom * 1.4, 0, 7); mctx.fill(); }
  v6Mini(mctx, P2, zoom);   // 69-v6-customs.js：改裝廠歇業的紅色鎖頭
  v7Mini(mctx, P2, zoom);   // 69-v7-*.js：地堡、賭場、夜店鬧事的藍點
  for (const v of vehicles) if (v !== player.veh) { const [x, y] = P2(v.x, v.z); mctx.fillStyle = '#e9e5dc'; mctx.fillRect(x - 3, y - 3, 6, 6); }
  mctx.fillStyle = 'rgba(255,215,90,.75)';
  for (const c of traffic) { const [x, y] = P2(c.x, c.z); if (Math.abs(x) < 140 && Math.abs(y) < 140) mctx.fillRect(x - 1.5, y - 1.5, 3, 3); }
  if (player.where === 'out') policeMini(mctx, P2, zoom);   // 警車、警員、直升機、視線錐（69-police.js）
  evMini(mctx, P2, zoom);   // 運鈔車藍點與錢袋（69-events.js）
  if (player.where === 'out') squadMini(mctx, P2, zoom);   // 幫派紅點、傭兵綠點、被盯上的資產（69-squads.js）
  if (player.where === 'out') sideMini(mctx, P2, zoom);   // 街頭賽對手、生存模式、幫派地盤（69-side.js）
  if (player.where === 'out') { salvMini(mctx, P2); noiseMini(mctx, P2, zoom); }   // 水下貨櫃的聲納、噪音圈（69-v3-skills.js）
  mctx.restore();
  // 目標：在圓內就畫點，超出就貼在圓周
  if (mk && mk.where === 'out') {
    let dx = (mk.x - px) * MAP_S * zoom, dz = (mk.z - pz) * MAP_S * zoom;
    const a = yaw - Math.PI, ca = Math.cos(a), sa = Math.sin(a);
    let x = dx * ca - dz * sa, y = dx * sa + dz * ca;
    const d = Math.hypot(x, y), lim = R2 - 10;
    if (d > lim) { x *= lim / d; y *= lim / d; }
    mctx.strokeStyle = '#ffae57'; mctx.lineWidth = 3; mctx.beginPath(); mctx.arc(R2 + x, R2 + y, 7, 0, 7); mctx.stroke();
    mctx.fillStyle = '#ffae57'; mctx.beginPath(); mctx.arc(R2 + x, R2 + y, 3, 0, 7); mctx.fill();
  }
  // 玩家箭頭
  mctx.fillStyle = '#ffffff'; mctx.beginPath(); mctx.moveTo(R2, R2 - 11); mctx.lineTo(R2 + 8, R2 + 8); mctx.lineTo(R2, R2 + 4); mctx.lineTo(R2 - 8, R2 + 8); mctx.closePath(); mctx.fill();
  mctx.strokeStyle = 'rgba(236,232,224,.25)'; mctx.lineWidth = 3; mctx.beginPath(); mctx.arc(R2, R2, R2 - 2, 0, 7); mctx.stroke();
}
function updateHud(dt) {
  const p = player, inV = p.mode === 'drive';
  const px = inV ? p.veh.x : p.x, pz = inV ? p.veh.z : p.z;
  const yawView = camState.yaw;
  const h = headingOf(Math.sin(yawView), Math.cos(yawView));
  const mk = missionMark();   // 69-heist.js：搶劫進行中換成搶劫目標
  const mkVisible = mk && mk.where === p.where;
  let mkH = null;
  if (mkVisible) mkH = headingOf(mk.x - (p.where === 'out' ? px : p.x), mk.z - (p.where === 'out' ? pz : p.z));
  const wpH = gps.wp && p.where === 'out' ? headingOf(gps.wp.x - px, gps.wp.z - pz) : null;
  drawCompass(h, mkH, wpH);
  if (p.where === 'out') {
    setText('stName', streetName(px, pz, p.mode === 'drive' && p.veh ? p.veh.y : p.y));
    setText('district', districtW(px, pz));
  } else {
    setText('stName', VENUES[p.where].name);
    setText('district', VENUES[p.where].dist);
  }
  setText('stHead', `${dirName(h)} ${Math.round(h)}°`);
  clockSt.acc += dt;
  if (clockSt.acc > 2.5) { clockSt.acc = 0; clockSt.min = (clockSt.min + 1) % 1440; }
  setText('clock', `${String(Math.floor(clockSt.min / 60)).padStart(2, '0')}:${String(clockSt.min % 60).padStart(2, '0')}`);
  drawMini(px, pz, p.where === 'out' ? yawView : yawView, p.where === 'out' ? mk : null);
  // 目標標記
  const m = $('marker');
  if (mkVisible) {
    _pv.set(mk.x, mk.y, mk.z).project(camera);
    let sx = (_pv.x * .5 + .5) * innerWidth, sy = (-_pv.y * .5 + .5) * innerHeight;
    const behind = _pv.z > 1;
    if (behind) { sx = innerWidth - sx; sy = innerHeight - 60; }
    const pad = 70, edge = behind || sx < pad || sx > innerWidth - pad || sy < pad + 40 || sy > innerHeight - pad;
    sx = clamp(sx, pad, innerWidth - pad); sy = clamp(sy, pad + 40, innerHeight - pad);
    m.style.display = 'flex';
    m.style.transform = `translate(${sx}px,${sy}px) translate(-50%,-100%)`;
    m.classList.toggle('edge', edge);
    setText('mkName', mk.name);
    const d = Math.hypot(mk.x - (p.where === 'out' ? px : p.x), mk.z - (p.where === 'out' ? pz : p.z));
    setText('mkDist', fmtDist(d));
  } else m.style.display = 'none';
  // 速度表
  $('speedo').classList.toggle('on', inV);
  if (inV) {
    const v = p.veh, kmh = Math.round(Math.abs(v.vx * Math.sin(v.yaw) + v.vz * Math.cos(v.yaw)) * 3.6);
    setText('spd', String(IMPERIAL() ? Math.round(kmh * .621371) : kmh)); setText('gear', String(v.gear)); setText('vehName', motors.test && v === kestrel ? `試駕 ${v.name} · ${Math.ceil(motors.test.t)}s` : v.name);
    const r = $('rpm').firstElementChild; r.style.width = `${Math.round(v.rpm * 100)}%`; r.classList.toggle('hi', v.rpm > .86);
    const nb = $('nitro').firstElementChild; nb.style.width = `${Math.round(nitro.v * 100)}%`;
  }
  setText('cash', money(motors.cash));
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('on'); }
}
// ─── 傳送（全區地圖的資訊卡與數字鍵；地圖本身在 91-map.js）───
function teleport(k) {
  toggleMap(false);
  const go = (lx, lz, lyaw) => {   // 參數是邏輯座標（門口的位置）
    const { x, z, yaw } = spotW({ x: lx, z: lz, yaw: lyaw });
    const fn = () => {
      if (player.mode === 'drive') exitVehicle();
      setWhere('out'); player.x = x; player.z = z; player.yaw = yaw; player.v = 0; camState.yaw = yaw; camState.snap = true;
    };
    player.where === 'out' ? transition(fn) : transition(fn);
  };
  if (k === 'club') go(CLUB_X - 3, CLUB_Z + 4.5, Math.PI);
  else if (k === 'clubIn') { if (questIn()) { if (player.mode === 'drive') exitVehicle(); enterVenue('club'); } else { go(CLUB_X - 3, CLUB_Z + 4.5, Math.PI); toast('還沒上名單，先到門口'); } }
  else if (k === 'barIn') { if (player.mode === 'drive') exitVehicle(); enterVenue('bar'); }
  else if (k === 'garage') go(GAR_X - 4, GAR_Z + 3, Math.PI);
  else if (k === 'dealer') go(DEAL_X - 2.5, DEAL_Z + 3.4, Math.PI);
  else if (k === 'home') go(HOME_X + 2.5, HOME_Z - 3.4, 0);
  else if (k === 'car') {
    if (motors.stowed) { toast(`${kestrel.name} 停在 GARAGE 07 裡，按 V 叫出來`); return; }
    const fn = () => { if (player.mode === 'drive') exitVehicle(); setWhere('out'); player.x = kestrel.x + Math.cos(kestrel.yaw) * 1.6; player.z = kestrel.z - Math.sin(kestrel.yaw) * 1.6; player.yaw = kestrel.yaw; camState.yaw = kestrel.yaw; };
    transition(fn);
  }
}
