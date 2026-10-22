
// ═══ HUD：任務卡、羅盤與街名、地區天氣時間、旋轉小地圖、目標標記、速度表、全區地圖 ═══
// 北方 = -z；地圖上 px = x、py = z。heading 以順時針角度表示，0 為北。
// 地圖涵蓋對岸、海與灰鷗島；每公尺 1.5 px（小地圖另外放大回原本的比例）。底圖是世界座標（MAP_X0、MAP_Z0 是各區換過去的外接框），
// 每區用 canvas 的變換照邏輯座標畫原本的矩形，並裁在區的範圍內
const MAP_L = { x0: FAR_BANK_X - 40, x1: EAST_BANK_X + 40, z0: NPARK.walk.z0 - 40, z1: ISLE.z1 + 40 };   // 北邊含北嶺公園   // 邏輯座標的範圍
const MAP_BB = (() => {
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const zn of ZONES) for (const [x, z] of rectW(Math.max(zn.x0, MAP_L.x0), Math.min(zn.x1, MAP_L.x1), Math.max(zn.z0, MAP_L.z0), Math.min(zn.z1, MAP_L.z1), zn)) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  return { x0, x1, z0, z1 };
})();
const MAP_X0 = MAP_BB.x0, MAP_Z0 = MAP_BB.z0, MAP_S = 1.5, MINI_K = 2 / MAP_S;
const mapImg = document.createElement('canvas');
mapImg.width = Math.ceil((MAP_BB.x1 - MAP_X0) * MAP_S); mapImg.height = Math.ceil((MAP_BB.z1 - MAP_Z0) * MAP_S);
// 把 canvas 的座標設成區 zn 的邏輯座標（1 單位 = 1 m），世界座標原點在 (x0, z0)、每公尺 s px
const zoneCtx = (c, zn, x0, z0, s) => c.setTransform(s * zn.c, -s * zn.s, s * zn.s, s * zn.c, s * (zn.ox - x0), s * (zn.oz - z0));
mapImg.getContext('2d').fillStyle = '#14202a'; mapImg.getContext('2d').fillRect(0, 0, mapImg.width, mapImg.height);   // 水
// 對岸與東灣對岸依南北兩段跟著岸這邊的區（21-coast.js 的 FAR_PARTS、EAST_PARTS），不裁在區的範圍內
{
  const c = mapImg.getContext('2d');
  for (const P of FAR_PARTS) { const z0 = Math.max(P.z0, MAP_L.z0 - 2000), z1 = Math.min(P.z1, MAP_L.z1 + 2000); c.save(); zoneCtx(c, P.zn, MAP_X0, MAP_Z0, MAP_S); c.fillStyle = '#22252a'; c.fillRect(MAP_L.x0 - 2000, z0, FAR_BANK_X - MAP_L.x0 + 2000, z1 - z0); c.restore(); }
  for (const P of EAST_PARTS) { const z0 = Math.max(P.z0, CITY_CZ - 850), z1 = Math.min(P.z1, CITY_CZ + 850); if (z1 > z0) { c.save(); zoneCtx(c, P.zn, MAP_X0, MAP_Z0, MAP_S); c.fillStyle = '#22252a'; c.fillRect(EAST_BANK_X, z0, 2000, z1 - z0); c.restore(); } }
}
// 北嶺公園（10-city.js 的 NPARK，A 區邏輯座標）：圍籬範圍的草地、門的通道、步道與觀景台、管理站；px 是一個像素的長度
function parkMap(c, px, grass, gate, trail) {
  const W = NPARK.walk, L = NPARK.look, C = NPARK.cabin;
  c.fillStyle = grass; c.fillRect(W.x0, W.z0, W.x1 - W.x0, W.z1 - W.z0);
  c.fillStyle = gate; c.fillRect(NPARK.gx - NPARK.gw, CITY_Z0 - OUT_D, 2 * NPARK.gw, OUT_D);
  c.strokeStyle = trail; c.lineWidth = Math.max(2.6, 2.2 * px); c.lineJoin = c.lineCap = 'round';
  c.beginPath(); NPARK.trail.forEach(([x, z], n) => n ? c.lineTo(x, z) : c.moveTo(x, z)); c.stroke();
  c.fillStyle = trail; c.fillRect(L.x0, L.z0, L.x1 - L.x0, L.z1 - L.z0); c.fillRect(C.x - 4, C.z - 3, 8, 6);
}
// 每區的地塊與縫裡的塔樓（10-city.js 的 seam）；p 是一個像素的長度
function mapLot(c, L, px, col) { c.fillStyle = col; c.fillRect(L.x0 + px, L.z0 + px, L.x1 - L.x0 - 2 * px, L.z1 - L.z0 - 2 * px); }
const lotCol = L => L.special ? '#5a3a52' : L.style === 3 ? '#1b1e24' : '#202329';
for (const zn of ZONES) {
  const c = mapImg.getContext('2d'), px = 1 / MAP_S;
  c.save(); zoneCtx(c, zn, MAP_X0, MAP_Z0, MAP_S);
  c.beginPath(); c.rect(Math.max(zn.x0, MAP_L.x0), Math.max(zn.z0, MAP_L.z0), Math.min(zn.x1, MAP_L.x1) - Math.max(zn.x0, MAP_L.x0), Math.min(zn.z1, MAP_L.z1) - Math.max(zn.z0, MAP_L.z0)); c.clip();
  const X = x => x, Z = z => z;
  const rect = (r, col) => { c.fillStyle = col; c.fillRect(r.x0, r.z0, r.x1 - r.x0, r.z1 - r.z0); };
  rect({ x0: CITY_X0 - OUT_D, x1: CITY_X1 + OUT_D, z0: MAP_L.z0, z1: CITY_Z0 - OUT_D }, '#1b2019');   // 樓牆後面的山
  rect({ x0: CITY_X0 - OUT_D, x1: CITY_X1 + OUT_D, z0: CITY_Z0 - OUT_D, z1: SHORE_Z }, '#2a2d33');   // 濱海步道
  rect({ x0: CITY_X0, x1: CITY_X1, z0: CITY_Z0 - OUT_D, z1: CITY_Z1 }, '#4a4e56');
  if (zn === ZONES[0]) parkMap(c, px, '#26321f', '#3a3d42', '#8a7050');   // 北嶺公園
  rect({ ...BEACH, z1: BEACH.z0 + BEACH.len * SEA_Y / -BEACH.drop }, '#6a5e46');
  rect(QUAY, '#3a3d42'); rect(BRIDGE, '#4a4e56'); rect(ISLE, '#26321f');
  for (const r of PIERS) rect(r, '#5a4632');
  for (const b of blocks) { if (b.outer) continue; c.fillStyle = '#2a2d33'; c.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0); }
  for (const L of lots) if (L.zn === zn && !L.seam) mapLot(c, L, px, lotCol(L));
  c.strokeStyle = 'rgba(255,190,90,.35)'; c.lineWidth = px;
  for (let i = zn.ni0; i <= zn.ni1; i++) { c.beginPath(); c.moveTo(X(avX(i)), Z(stZ(zn.nj0))); c.lineTo(X(avX(i)), Z(stZ(zn.nj1))); c.stroke(); }
  for (let j = zn.nj0; j <= zn.nj1; j++) { c.beginPath(); c.moveTo(X(avX(zn.ni0)), Z(stZ(j))); c.lineTo(X(avX(zn.ni1)), Z(stZ(j))); c.stroke(); }
  c.restore();
}
// 區之間的縫（世界座標）：整塊先塗成路面（邊界路外側那半條），再蓋上草地（岬角也是）與連接道路。P 把世界座標換成畫布座標，k 是每公尺幾 px。
// 地圖上北面的山蓋住樓牆背後，所以 A／B 之間那條縫只畫到樓牆背面（SEAM 的北端在山裡）
const MAP_SEAM = (() => {
  const [zA, zB] = ZONES, xm = avX(zA.ni1), zb = CITY_Z0 - OUT_D;
  const pts = [SEAM.pts[0], toW(xm, zb, zA), toW(xm, zb, zB), ...SEAM.pts.slice(-5)], road = [1, 0, 1, ...SEAM.road.slice(-5)];
  return { pts, inn: polyInset(pts, road.map(r => r ? HR - .5 : 0)) };
})();
function drawSeams(c, P, k, road, park, line) {
  const path = (pts, close) => { c.beginPath(); pts.forEach(([x, z], n) => { const [a, b] = P(x, z); if (n) c.lineTo(a, b); else c.moveTo(a, b); }); if (close) c.closePath(); };
  c.fillStyle = road; path(MAP_SEAM.pts, true); c.fill();
  c.fillStyle = park; path(MAP_SEAM.inn, true); c.fill();
  for (const h of CAPES) { path(h.pts, true); c.fill(); }   // 岬角（10-city.js）
  c.lineJoin = 'round'; c.lineCap = 'butt';
  c.strokeStyle = road; c.lineWidth = 2 * HR * k;
  for (const e of RN.edges) if (e.kind === 'c') { path(e.pts); c.stroke(); }
  if (line) { c.strokeStyle = line; c.lineWidth = 1; for (const e of RN.edges) if (e.kind === 'c') { path(e.pts); c.stroke(); } }
}
drawSeams(mapImg.getContext('2d'), (x, z) => [(x - MAP_X0) * MAP_S, (z - MAP_Z0) * MAP_S], MAP_S, '#4a4e56', '#26321f', 'rgba(255,190,90,.35)');
for (const L of lots) if (L.seam) { const c = mapImg.getContext('2d'); c.save(); zoneCtx(c, L.zn, MAP_X0, MAP_Z0, MAP_S); mapLot(c, L, 1 / MAP_S, lotCol(L)); c.restore(); }
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
function streetName(X, Z) {
  const [x, z] = toL(X, Z);
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
  gpsMini(mctx, P2, zoom);   // 導航路線（69-gps.js）
  for (const v of VENUE_PINS) { const [x, y] = P2(v.x, v.z); mctx.fillStyle = v.col; mctx.beginPath(); mctx.arc(x, y, 5 / zoom * 1.4, 0, 7); mctx.fill(); }
  for (const v of vehicles) if (v !== player.veh) { const [x, y] = P2(v.x, v.z); mctx.fillStyle = '#e9e5dc'; mctx.fillRect(x - 3, y - 3, 6, 6); }
  mctx.fillStyle = 'rgba(255,215,90,.75)';
  for (const c of traffic) { const [x, y] = P2(c.x, c.z); if (Math.abs(x) < 140 && Math.abs(y) < 140) mctx.fillRect(x - 1.5, y - 1.5, 3, 3); }
  if (player.where === 'out') policeMini(mctx, P2, zoom);   // 警車、警員、直升機、視線錐（69-police.js）
  evMini(mctx, P2, zoom);   // 運鈔車藍點與錢袋（69-events.js）
  if (player.where === 'out') squadMini(mctx, P2, zoom);   // 幫派紅點、傭兵綠點、被盯上的資產（69-squads.js）
  if (player.where === 'out') sideMini(mctx, P2, zoom);   // 街頭賽對手、生存模式、幫派地盤（69-side.js）
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
    setText('stName', streetName(px, pz));
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
  else if (k === 'clubIn') { if (quest.n >= 3) { if (player.mode === 'drive') exitVehicle(); enterVenue('club'); } else { go(CLUB_X - 3, CLUB_Z + 4.5, Math.PI); toast('還沒上名單，先到門口'); } }
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
