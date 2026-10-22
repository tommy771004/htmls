
// ═══ 全區地圖（M）：GTA 式暫停地圖 ═══
// 每次重畫都用向量畫（深灰街廓、淺灰道路、海與對岸），可以滾輪／雙指縮放、拖曳平移；地點以圖示（MAP_ICON 的 SVG 路徑）標出，
// 右側圖例按類別列出（點一下跳到那一類的下一個），左上是選中地點的資訊卡（設導航點、可以的話直接傳送），
// 左下是比例尺與游標所在的地名／街名。點道路設定導航點（69-gps.js），再點一次取消。
const bigmap = $('bigmap'), mctx2 = bigmap.getContext('2d');
const MAP_ICON = {
  club: 'M9 18a3 3 0 1 1-2-2.83V5l11-2v12.5a3 3 0 1 1-2-2.83V6.3L9 7.6z',
  bar: 'M4 4h16l-7 8v6h4v2H7v-2h4v-6z',
  chrome: 'M21 7a5 5 0 0 1-6.6 4.7l-7.7 7.7a2 2 0 0 1-2.8-2.8l7.7-7.7A5 5 0 0 1 17 3l-3 3 1 3 3 1z',
  car: 'M2.5 16v-3.5l2.2-1.2L7 7h9.5l3.2 4.3 1.8.9V16h-2a2.2 2.2 0 0 1-4.4 0H8.9a2.2 2.2 0 0 1-4.4 0z',
  garage: 'M2 10l10-6.5L22 10v10h-3.2v-8.5H5.2V20H2zm5 3h10v2H7zm0 3.2h10v2H7z',
  safe: 'M12 2.5l9.5 8.5h-3v9h-4.3v-6h-4.4v6H5.5v-9h-3z',
  bank: 'M3 9l9-5 9 5v1.5H3zm1.5 3h3v6h-3zm6 0h3v6h-3zm6 0h3v6h-3zM3 19.5h18V21H3z',
  pd: 'M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z',
  hosp: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  ramp: 'M2.5 19L12 5l9.5 14h-4.6L12 11.6 7.1 19z',
  ramen: 'M2.5 11h19c0 4.7-4.3 8.5-9.5 8.5S2.5 15.7 2.5 11zM8 9.4 9.8 3h1.4L9.6 9.4zm4.2 0L13.4 3h1.4l-.9 6.4z',
  mission: 'M12 2a7 7 0 0 1 7 7c0 5.3-7 13-7 13S5 14.3 5 9a7 7 0 0 1 7-7zm0 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
};
const iconPath = {};
for (const [k, d] of Object.entries(MAP_ICON)) iconPath[k] = new Path2D(d);
const iconSvg = (k, col, txt) => txt
  ? `<svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="19" text-anchor="middle" font-size="19" font-weight="800" font-family="system-ui" fill="${col}">${txt}</text></svg>`
  : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${MAP_ICON[k]}" fill="${col}"/></svg>`;
// 圖例的類別與順序
const MAP_CAT = [
  { id: 'mission', name: '任務目標', col: '#ffcc4d', icon: 'mission' },
  { id: 'car', name: '我的座駕', col: '#62e6d8', icon: 'car' },
  { id: 'crew', name: '主角', col: '#ece8e0' },
  { id: 'club', name: '夜店', col: '#ff3fa0', icon: 'club' },
  { id: 'bar', name: '酒吧', col: '#ffa040', icon: 'bar' },
  { id: 'chrome', name: '改裝廠', col: '#2cf2d8', icon: 'chrome' },
  { id: 'dealer', name: '車行', col: '#ffcf6a', icon: 'car' },
  { id: 'garage', name: '車庫', col: '#ff8a3a', icon: 'garage' },
  { id: 'safe', name: '安全屋', col: '#ece8e0', icon: 'safe' },
  { id: 'bank', name: '銀行', col: '#6ad08a', icon: 'bank' },
  { id: 'pd', name: '警察局', col: '#6aa0ff', icon: 'pd' },
  { id: 'hosp', name: '醫院', col: '#ff5a5a', icon: 'hosp' },
  { id: 'ramen', name: '拉麵攤', col: '#ff7a52', icon: 'ramen' },
  { id: 'ramp', name: '特技跳台', col: '#d9b42a', icon: 'ramp' },
];
const MAP_CATS = Object.fromEntries(MAP_CAT.map(c => [c.id, c]));
const estOf = id => ESTATES.find(e => e.id === id);
// 目前所有的地點（開地圖時重建：擁有狀態、座駕位置、任務目標會變）
function mapBlips() {
  const B = [], add = (cat, o) => B.push({ cat, ...o });
  const mk = missionMark();
  if (mk && mk.where === 'out') add('mission', { name: mk.name, x: mk.x, z: mk.z, type: '任務', desc: $('objText')?.textContent || '' });
  if (!motors.stowed && !kestrel.dead) add('car', { name: kestrel.name, x: kestrel.x, z: kestrel.z, type: '座駕', desc: '停在路邊的座駕；按 V 可以叫到身邊。', tp: 'car' });
  CREW.forEach((c, i) => { if (i !== crew.cur) add('crew', { name: `${c.name}（${c.zh}）`, txt: c.name[0], col: c.col, x: crew.st[i].x, z: crew.st[i].z, type: c.role, desc: `${c.home.name}附近。按 Q 開角色轉盤切換過去。` }); });
  const est = (id, base) => { const e = estOf(id); if (!e) return base; const own = estOwned(id); return { ...base, own, rows: [['產權', own ? '已擁有' : `待售 ${money(e.price)}`], ...(e.rate ? [['收入', `${money(e.rate)}／遊戲小時`]] : [])] }; };
  add('club', est('lazarus', { name: 'LAZARUS', ...WP(CLUB_X, CLUB_Z + 2), type: '夜店', desc: '9 St 的夜店。今晚只放名單上的人進去。', tp: 'club' }));
  add('bar', est('afterglow', { name: 'AFTERGLOW', ...WP(BAR_X - 4.6, BAR_Z + 2), type: '酒吧', desc: '7 St 的酒吧，調酒師 Juno 在吧台後面。', tp: 'barIn' }));
  add('chrome', est('chrome', { name: 'CHROME WORKS', ...WP(GAR_X, GAR_Z + 4), type: '改裝廠', desc: '把車停進門口的停車格可以換塗裝。', tp: 'garage' }));
  add('dealer', { name: 'VELOCE MOTORS', ...WP(DEAL_X, DEAL_Z + 2), type: '車行', desc: '29 台實車模型，可以看規格、試駕或買下。', tp: 'dealer' });
  add('garage', { name: 'GARAGE 07', ...WP(HOME_X, HOME_Z - 2), type: '私人車庫', desc: '買來的車停在這裡；開著座駕停在門口按 E 停進去。', tp: 'home' });
  for (const id of APT_IDS) { const a = APT[id]; add('safe', est(id, { name: a.name, x: a.doorW.x, z: a.doorW.z, type: '安全屋', desc: `${a.dist}。買下後可以進去睡覺存檔（時間推進 6 小時）。` })); }
  add('bank', { name: '中央霓虹銀行', ...WP(BANK.x, BANK.z + 2), type: '銀行', desc: '金庫在大廳後面。搶劫從手機的搶劫行動開始籌備。' });
  add('pd', { name: PD.name, x: PD.x, z: PD.z, type: '警察局', desc: 'BUSTED 之後在這裡交保釋金出來。' });
  add('hosp', { name: HOSP.name, x: HOSP.x, z: HOSP.z, type: '醫院', desc: 'WASTED 之後在這裡出院。' });
  for (const o of ramenSpots) add('ramen', { name: '路邊拉麵攤', ...WP(o.x, o.z), type: '小吃', desc: '霓虹區人行道上的拉麵攤。' });
  for (const r of RAMPS) { const done = motors.stunts.includes(r.i); add('ramp', { name: `特技跳台 #${r.i + 1}`, x: r.x, z: r.z, type: '特技跳台', done, rows: [['狀態', done ? '已完成' : '未完成（首次加倍獎金）']], desc: '加速衝上跳台，落地前在空中翻滾可以拿加成。' }); }
  return B;
}

// ─── 視角與狀態 ───
const MV = { cx: 0, cz: 0, zoom: 1, tx: 0, tz: 0, tzoom: 1, dirty: true, blips: [], sel: -1, hover: -1, mx: -1, my: -1, raf: 0, ptr: new Map(), drag: null, pinch: null, t: 0 };
// MAP_LB 是邏輯座標的範圍（各區照它畫），MAP_BOUNDS 是換到世界座標的外接框（平移、縮放的限制）
const MAP_LB = { x0: FAR_BANK_X - 40, x1: EAST_BANK_X + 40, z0: stZ(0) - 120, z1: ISLE.z1 + 40 };
const MAP_BOUNDS = (() => {
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const zn of ZONES) for (const [x, z] of rectW(Math.max(zn.x0, MAP_LB.x0), Math.min(zn.x1, MAP_LB.x1), Math.max(zn.z0, MAP_LB.z0), Math.min(zn.z1, MAP_LB.z1), zn)) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  return { x0, x1, z0, z1 };
})();
const mapDpr = () => Math.min(devicePixelRatio || 1, 2);
function mapFitZoom() { const r = bigmap.getBoundingClientRect(); return Math.min(r.width / (MAP_BOUNDS.x1 - MAP_BOUNDS.x0), r.height / (MAP_BOUNDS.z1 - MAP_BOUNDS.z0)); }
const MAP_ZMAX = 7;
// 中心限制在「畫面邊緣不超出世界範圍」；整張圖比畫面小時置中
function mapClampView() {
  const r = bigmap.getBoundingClientRect(), B = MAP_BOUNDS;
  MV.tzoom = clamp(MV.tzoom, mapFitZoom(), MAP_ZMAX);
  const hw = r.width / 2 / MV.tzoom, hh = r.height / 2 / MV.tzoom;
  MV.tx = B.x1 - B.x0 > hw * 2 ? clamp(MV.tx, B.x0 + hw, B.x1 - hw) : (B.x0 + B.x1) / 2;
  MV.tz = B.z1 - B.z0 > hh * 2 ? clamp(MV.tz, B.z0 + hh, B.z1 - hh) : (B.z0 + B.z1) / 2;
}
// 螢幕（CSS px，相對畫布左上）⇄ 世界
const mapToWorld = (sx, sy) => { const r = bigmap.getBoundingClientRect(); return { x: MV.cx + (sx - r.width / 2) / MV.zoom, z: MV.cz + (sy - r.height / 2) / MV.zoom }; };
function mapZoomAt(f, sx, sy) {
  const r = bigmap.getBoundingClientRect();
  if (sx === undefined) { sx = r.width / 2; sy = r.height / 2; }
  const w = { x: MV.tx + (sx - r.width / 2) / MV.tzoom, z: MV.tz + (sy - r.height / 2) / MV.tzoom };
  MV.tzoom = clamp(MV.tzoom * f, mapFitZoom(), MAP_ZMAX);
  MV.tx = w.x - (sx - r.width / 2) / MV.tzoom; MV.tz = w.z - (sy - r.height / 2) / MV.tzoom;
  mapClampView(); MV.dirty = true;
}
const mapPlayer = () => player.where === 'out' ? (player.mode === 'drive' ? player.veh : player) : VENUES[player.where].door;

// 地區名稱：每個街區中心依 district() 分組取平均，海與對岸另外加
const MAP_LABELS = (() => {
  const g = new Map();
  for (const b of blocks) {
    if (b.outer) continue;
    const x = (b.x0 + b.x1) / 2, z = (b.z0 + b.z1) / 2, d = district(x, z);
    const o = g.get(d) || { x: 0, z: 0, n: 0 }; o.x += x; o.z += z; o.n++; g.set(d, o);
  }
  const L = [...g].map(([d, o]) => ({ zh: d.split(' ')[0], en: d.replace(/^\S+ /, '').toUpperCase(), x: o.x / o.n, z: o.z / o.n }));
  L.push({ zh: '灰鷗島', en: 'GULL ISLAND', x: (ISLE.x0 + ISLE.x1) / 2, z: (ISLE.z0 + ISLE.z1) / 2 },
    { zh: '灰鷺河', en: 'HERON RIVER', x: (FAR_BANK_X + CITY_X0 - OUT_D) / 2, z: CITY_CZ, water: 1 },
    { zh: '東灣', en: 'EAST BAY', x: (EAST_BANK_X + CITY_X1 + OUT_D) / 2, z: CITY_CZ, water: 1 },
    { zh: '舊港城', en: 'OLD HARBOUR', x: EAST_BANK_X + 140, z: CITY_CZ - 220 },
    { zh: '倫敦城', en: 'LONDON CITY', x: FAR_BANK_X - 200, z: CITY_CZ - 220 });
  return L.map(o => ({ ...o, ...WP(o.x, o.z) }));   // 上面是邏輯座標，畫的時候用世界座標
})();

// ─── 繪製 ───
const MAPC = { water: '#1d2a33', land: '#202020', far: '#1b1d1e', road: '#8a8a8a', walk: '#3c3c3c', block: '#191919', lot: '#272727', lotEdge: '#323232', park: '#243022', beach: '#4a4333', quay: '#2a2a2a', pier: '#4a3d2e', isle: '#222b1e' };
function mapDraw() {
  const c = mctx2, r = bigmap.getBoundingClientRect(), dpr = mapDpr();
  const W = Math.max(2, Math.round(r.width * dpr)), H = Math.max(2, Math.round(r.height * dpr));
  if (bigmap.width !== W || bigmap.height !== H) { bigmap.width = W; bigmap.height = H; }
  const k = MV.zoom * dpr, X = x => (x - MV.cx) * k + W / 2, Z = z => (z - MV.cz) * k + H / 2;
  const rect = (x0, x1, z0, z1, col) => { c.fillStyle = col; c.fillRect(X(x0), Z(z0), (x1 - x0) * k, (z1 - z0) * k); };
  const vx0 = MV.cx - W / 2 / k - 20, vx1 = MV.cx + W / 2 / k + 20, vz0 = MV.cz - H / 2 / k - 20, vz1 = MV.cz + H / 2 / k + 20;
  const vis = (x0, x1, z0, z1) => x1 > vx0 && x0 < vx1 && z1 > vz0 && z0 < vz1;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = MAPC.water; c.fillRect(0, 0, W, H);
  // 每區用 canvas 的變換照邏輯座標畫（1 單位 = 1 m，px 是一個螢幕像素的長度），裁在區的範圍內；
  // 看得到的範圍（vis）是畫面四角換到區裡的外接框
  for (const zn of ZONES) {
    c.save();
    c.setTransform(k * zn.c, -k * zn.s, k * zn.s, k * zn.c, k * (zn.ox - MV.cx) + W / 2, k * (zn.oz - MV.cz) + H / 2);
    const px = 1 / k, cs = [[vx0, vz0], [vx1, vz0], [vx1, vz1], [vx0, vz1]].map(([x, z]) => toL(x, z, zn));
    const lx0 = Math.min(...cs.map(q => q[0])), lx1 = Math.max(...cs.map(q => q[0])), lz0 = Math.min(...cs.map(q => q[1])), lz1 = Math.max(...cs.map(q => q[1]));
    const vis = (x0, x1, z0, z1) => x1 > lx0 && x0 < lx1 && z1 > lz0 && z0 < lz1;
    const rect = (x0, x1, z0, z1, col) => { c.fillStyle = col; c.fillRect(x0, z0, x1 - x0, z1 - z0); };
    const B = { x0: Math.max(zn.x0, MAP_LB.x0 - 3000), x1: Math.min(zn.x1, MAP_LB.x1 + 3000), z0: Math.max(zn.z0, MAP_LB.z0 - 3000), z1: Math.min(zn.z1, MAP_LB.z1 + 3000) };
    c.beginPath(); c.rect(B.x0, B.z0, B.x1 - B.x0, B.z1 - B.z0); c.clip();
    // 對岸、城外的濱海步道、碼頭、沙灘、棧橋、橋與島
    rect(MAP_LB.x0 - 2000, FAR_BANK_X, MAP_LB.z0 - 2000, MAP_LB.z1 + 2000, MAPC.far);
    rect(EAST_BANK_X, MAP_LB.x1 + 2000, CITY_CZ - 850, CITY_CZ + 850, MAPC.far);
    rect(CITY_X0 - OUT_D, CITY_X1 + OUT_D, CITY_Z0 - OUT_D, SHORE_Z, MAPC.walk);
    rect(MAP_LB.x0 - 2000, MAP_LB.x1 + 2000, MAP_LB.z0 - 2000, CITY_Z0 - OUT_D, MAPC.far);   // 北面的山
    rect(BEACH.x0, BEACH.x1, BEACH.z0, BEACH.z0 + BEACH.len * SEA_Y / -BEACH.drop, MAPC.beach);
    rect(QUAY.x0, QUAY.x1, QUAY.z0, QUAY.z1, MAPC.quay);
    for (const p of PIERS) rect(p.x0, p.x1, p.z0, p.z1, MAPC.pier);
    rect(ISLE.x0, ISLE.x1, ISLE.z0, ISLE.z1, MAPC.isle);
    rect(BRIDGE.x0, BRIDGE.x1, BRIDGE.z0, BRIDGE.z1, MAPC.road);
    // 城市：整片先塗成道路，再蓋上街區（人行道）與地塊（建築）
    rect(CITY_X0, CITY_X1, CITY_Z0, CITY_Z1, MAPC.road);
    for (const b of blocks) {
      if (!vis(b.x0, b.x1, b.z0, b.z1)) continue;
      if (b.outer) { rect(b.x0, b.x1, b.z0, b.z1, b.outer === 's' ? MAPC.block : MAPC.walk); continue; }   // 北面（-z）是樓牆，其他三面是濱海步道
      rect(b.x0, b.x1, b.z0, b.z1, MAPC.walk);
      rect(b.x0 + SW, b.x1 - SW, b.z0 + SW, b.z1 - SW, b.park ? MAPC.park : MAPC.block);
      if (b.park && k > .9) {   // 燈籠公園的十字步道
        const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
        rect(cx - 1.8, cx + 1.8, b.z0 + SW, b.z1 - SW, '#3a3a33'); rect(b.x0 + SW, b.x1 - SW, cz - 1.8, cz + 1.8, '#3a3a33');
      }
    }
    const edge = k > 1.3;
    c.lineWidth = Math.max(1, k * .35) * px; c.strokeStyle = MAPC.lotEdge;
    if (k > .8) for (const L of lots) {   // 拉遠時只畫街廓，不畫一棟棟的地塊
      if (!vis(L.x0, L.x1, L.z0, L.z1)) continue;
      c.fillStyle = L.special ? '#3a2a36' : MAPC.lot;
      c.fillRect(L.x0 + px, L.z0 + px, L.x1 - L.x0 - 2 * px, L.z1 - L.z0 - 2 * px);
      if (edge) c.strokeRect(L.x0 + px, L.z0 + px, L.x1 - L.x0 - 2 * px, L.z1 - L.z0 - 2 * px);
    }
    // 車道中線（放大時）
    if (k > 2.4) {
      c.strokeStyle = 'rgba(40,40,40,.55)'; c.lineWidth = Math.max(1, k * .2) * px; c.setLineDash([3, 3]);
      c.beginPath();
      for (let i = zn.ni0; i <= zn.ni1; i++) { c.moveTo(avX(i), stZ(zn.nj0) - HR); c.lineTo(avX(i), stZ(zn.nj1) + HR); }
      for (let j = zn.nj0; j <= zn.nj1; j++) { c.moveTo(avX(zn.ni0) - HR, stZ(j)); c.lineTo(avX(zn.ni1) + HR, stZ(j)); }
      c.stroke(); c.setLineDash([]);
    }
    c.restore();
  }
  // 地名：拉遠時是區名，拉近時是街名
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.shadowColor = 'rgba(0,0,0,.85)'; c.shadowBlur = 4 * dpr;
  if (MV.zoom < 1.9) {
    const a = clamp((1.9 - MV.zoom) / .5, 0, 1);
    for (const L of MAP_LABELS) {
      if (!vis(L.x - 200, L.x + 200, L.z - 60, L.z + 60)) continue;
      c.fillStyle = L.water ? `rgba(150,180,200,${.7 * a})` : `rgba(236,232,224,${.85 * a})`;
      c.font = `700 ${15 * dpr}px ${getComputedStyle(document.body).getPropertyValue('--cond') || 'system-ui'}`;
      c.fillText(L.zh, X(L.x), Z(L.z) - 7 * dpr);
      if (MV.zoom < .7) continue;   // 拉很遠時只留中文區名
      c.font = `600 ${10 * dpr}px system-ui`; c.fillStyle = L.water ? `rgba(150,180,200,${.55 * a})` : `rgba(236,232,224,${.6 * a})`;
      c.fillText(L.en, X(L.x), Z(L.z) + 8 * dpr);
    }
  }
  if (MV.zoom > 1.5) {
    const a = clamp((MV.zoom - 1.5) / .5, 0, 1);
    c.fillStyle = `rgba(20,20,20,${.9 * a})`; c.shadowBlur = 0; c.font = `700 ${Math.min(11, 5 + MV.zoom * 1.6) * dpr}px system-ui`;
    // 街名沿著路的方向：區的邏輯 x 軸在畫面上的角度是 −ry
    for (const zn of ZONES) {
      for (let i = zn.ni0; i <= zn.ni1; i++) for (let j = zn.nj0; j < zn.nj1; j++) {
        const [x, z] = toW(avX(i), (stZ(j) + stZ(j + 1)) / 2, zn);
        if (!vis(x, x, z, z) || (j % 2 && MV.zoom < 3)) continue;
        c.save(); c.translate(X(x), Z(z)); c.rotate(-Math.PI / 2 - zn.ry); c.fillText(AVE[i].toUpperCase(), 0, 0); c.restore();
      }
      for (let j = zn.nj0; j <= zn.nj1; j++) for (let i = zn.ni0; i < zn.ni1; i++) {
        const [x, z] = toW((avX(i) + avX(i + 1)) / 2, stZ(j), zn);
        if (!vis(x, x, z, z) || (i % 2 && MV.zoom < 3)) continue;
        c.save(); c.translate(X(x), Z(z)); c.rotate(-zn.ry); c.fillText(STR[j].toUpperCase(), 0, 0); c.restore();
      }
    }
  }
  c.shadowBlur = 0;
  // 導航路線、運鈔車、幫派與傭兵（各模組的大地圖函式，尺寸除以 s 所以傳 1/dpr）
  const s = 1 / dpr;
  gpsBig(c, X, Z, s);
  evBig(c, X, Z, s);
  squadBig(c, X, Z, s);
  // 地點圖示
  const sz = (MV.zoom > 2.5 ? 24 : 20) * dpr;
  MV.blips.forEach((b, i) => {
    if (!vis(b.x, b.x, b.z, b.z)) return;
    if (b.cat === 'ramp' && MV.zoom < .9 && i !== MV.sel) return;   // 拉很遠時跳台太密，只畫選中的
    const x = X(b.x), y = Z(b.z), col = b.col || MAP_CATS[b.cat].col, sel = i === MV.sel;
    if (sel) {
      const pr = sz * (.85 + .1 * Math.sin(performance.now() / 180));
      c.fillStyle = 'rgba(236,232,224,.18)'; c.beginPath(); c.arc(x, y, pr, 0, 7); c.fill();
      c.strokeStyle = '#ece8e0'; c.lineWidth = 2 * dpr; c.stroke();
    }
    c.save(); c.translate(x, y);
    if (b.txt) {
      c.font = `800 ${sz * .82}px system-ui`; c.lineWidth = 3 * dpr; c.strokeStyle = 'rgba(0,0,0,.85)'; c.strokeText(b.txt, 0, 1); c.fillStyle = col; c.fillText(b.txt, 0, 1);
    } else {
      const f = sz / 24; c.scale(f, f); c.translate(-12, -12);
      const p = iconPath[MAP_CATS[b.cat].icon];
      c.lineWidth = 3.2; c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineJoin = 'round'; c.stroke(p);
      c.fillStyle = b.cat === 'safe' ? (b.own ? '#7ee08a' : '#9a9a9a') : b.cat === 'ramp' && b.done ? 'rgba(217,180,42,.5)' : col; c.fill(p);
    }
    c.restore();
    if (i === MV.hover && !sel) {
      c.font = `600 ${12 * dpr}px system-ui`; c.textAlign = 'left';
      const t = b.name, w = c.measureText(t).width + 12 * dpr;
      c.fillStyle = 'rgba(10,11,13,.86)'; c.fillRect(x + sz * .7, y - 10 * dpr, w, 20 * dpr);
      c.fillStyle = '#ece8e0'; c.fillText(t, x + sz * .7 + 6 * dpr, y); c.textAlign = 'center';
    }
  });
  // 自己：白色箭頭，指向面朝的方向
  const me = mapPlayer(), yaw = player.where === 'out' ? (player.mode === 'drive' ? player.veh.yaw : player.yaw) : 0;
  c.save(); c.translate(X(me.x), Z(me.z)); c.rotate(-yaw + Math.PI);
  c.beginPath(); c.moveTo(0, -11 * dpr); c.lineTo(8 * dpr, 9 * dpr); c.lineTo(0, 5 * dpr); c.lineTo(-8 * dpr, 9 * dpr); c.closePath();
  c.lineWidth = 3 * dpr; c.strokeStyle = 'rgba(0,0,0,.8)'; c.stroke(); c.fillStyle = '#ffffff'; c.fill();
  c.restore();
  // 游標十字線（滑鼠）
  if (MV.mx >= 0 && !isTouch) {
    c.strokeStyle = 'rgba(236,232,224,.32)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, MV.my * dpr + .5); c.lineTo(W, MV.my * dpr + .5); c.moveTo(MV.mx * dpr + .5, 0); c.lineTo(MV.mx * dpr + .5, H); c.stroke();
  }
  // 比例尺、游標所在地名
  const steps = [25, 50, 100, 200, 250, 500, 1000, 2000];
  const d = steps.find(m => m * MV.zoom >= 70) || 2000;
  $('mapBar').style.width = `${Math.round(d * MV.zoom)}px`;
  setText('mapScaleT', d >= 1000 ? `${d / 1000} km` : `${d} m`);
  const w = MV.mx >= 0 && !isTouch ? mapToWorld(MV.mx, MV.my) : { x: MV.cx, z: MV.cz };
  setText('mapLoc', mapPlaceName(w.x, w.z));
}
function mapPlaceName(X, Z) {   // 世界座標；底下的範圍判斷在所在區的邏輯座標
  const [x, z] = toL(X, Z), d = district(x, z), zh = d.split(' ')[0];
  if (x > EAST_BANK_X) return '舊港城 · 東灣對岸';
  if (x < FAR_BANK_X) return '倫敦城 · 灰鷺河對岸';
  const inCity = x > CITY_X0 - 6 && x < CITY_X1 + 6 && z > CITY_Z0 - 6 && z < CITY_Z1 + 6;
  if (!inCity) return x < CITY_X0 - OUT_D ? '灰鷺河' : x > CITY_X1 + OUT_D ? '東灣' : z > SHORE_Z && !(z > ISLE.z0 && x > ISLE.x0 && x < ISLE.x1) && !(x > QUAY.x0 && z < QUAY.z1) && !(x > BRIDGE.x0 && x < BRIDGE.x1) && !(x < BEACH.x1 && z < BEACH.z0 + 30) ? '外海' : zh;
  return `${zh} / ${streetName(X, Z)}`;
}

// ─── 資訊卡與圖例 ───
function mapCard() {
  const el = $('mapCard'), b = MV.blips[MV.sel];
  if (!b) { el.classList.remove('on'); return; }
  const cat = MAP_CATS[b.cat], col = b.col || cat.col, me = mapPlayer();
  const dist = Math.hypot(b.x - me.x, b.z - me.z);
  const rows = [['類型', b.type], ['地區', districtW(b.x, b.z).split(' ')[0]], ['距離', dist > 1000 ? `${(dist / 1000).toFixed(2)} km` : `${Math.round(dist)} m`], ...(b.rows || [])];
  const canTp = b.tp && !W.stars && !fading;
  el.style.setProperty('--mc', col);
  el.innerHTML = `<header>${iconSvg(cat.icon, col, b.txt)}<h3>${b.name}<small>${cat.name}</small></h3></header><dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>${b.desc ? `<p>${b.desc}</p>` : ''}<div class="acts"><button data-a="wp"><kbd>Enter</kbd>${gps.wp && Math.hypot(gps.wp.x - b.x, gps.wp.z - b.z) < 3 ? '取消導航點' : '設為導航點'}</button>${b.tp ? `<button data-a="tp"${canTp ? '' : ' disabled'}><kbd>T</kbd>${canTp ? '傳送' : '通緝中不能傳送'}</button>` : ''}</div>`;
  el.classList.add('on');
  el.querySelectorAll('button').forEach(bt => bt.addEventListener('click', () => { sfx.click(); bt.dataset.a === 'tp' ? mapTp() : mapWp(); }));
}
function mapLegend() {
  const el = $('mapLegend'), cur = MV.blips[MV.sel];
  const cats = MAP_CAT.filter(c => MV.blips.some(b => b.cat === c.id));
  el.innerHTML = cats.map(c => { const n = MV.blips.filter(b => b.cat === c.id).length, first = MV.blips.find(b => b.cat === c.id); return `<button data-c="${c.id}" class="${cur && cur.cat === c.id ? 'sel' : ''}"><span>${c.name}</span><em>${n > 1 ? n : ''}</em>${iconSvg(c.icon, first.col || c.col, first.txt)}</button>`; }).join('')
    + `<div id="mapIdx"><span>${MV.sel >= 0 ? MV.sel + 1 : 0}/${MV.blips.length}</span><svg viewBox="0 0 12 16" aria-hidden="true"><path d="M6 1 11 6H1zM6 15 1 10h10z" fill="#ece8e0"/></svg></div>`;
  el.querySelectorAll('button').forEach(bt => bt.addEventListener('click', () => {
    sfx.click();
    const list = MV.blips.map((b, i) => [b, i]).filter(([b]) => b.cat === bt.dataset.c);
    const at = list.findIndex(([, i]) => i === MV.sel);
    mapSelect(list[(at + 1) % list.length][1], true);
  }));
  const s = el.querySelector('.sel'); if (s) s.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function mapSelect(i, fly) {
  MV.sel = i;
  const b = MV.blips[i];
  if (b && fly) { MV.tx = b.x; MV.tz = b.z; MV.tzoom = Math.max(MV.tzoom, 1.4); mapClampView(); }
  mapCard(); mapLegend(); MV.dirty = true;
}
function mapWp() {
  const b = MV.blips[MV.sel]; if (!b) return;
  if (gps.wp && Math.hypot(gps.wp.x - b.x, gps.wp.z - b.z) < 3) gpsClear(); else gpsSet(b.x, b.z);
  gps.t = 0; gpsUpdate(); mapCard(); MV.dirty = true;
}
function mapTp() {
  const b = MV.blips[MV.sel];
  if (!b || !b.tp || W.stars || fading) return;
  teleport(b.tp);
}

// ─── 開關與互動 ───
function toggleMap(on = !$('map').classList.contains('on')) {
  $('map').classList.toggle('on', on);
  if (!on) { cancelAnimationFrame(MV.raf); MV.raf = 0; MV.ptr.clear(); MV.drag = MV.pinch = null; return; }
  if (document.pointerLockElement) document.exitPointerLock();
  MV.blips = mapBlips();
  const me = mapPlayer();
  MV.cx = MV.tx = me.x; MV.cz = MV.tz = me.z; MV.zoom = MV.tzoom = 1.25; mapClampView(); MV.zoom = MV.tzoom;
  MV.sel = MV.blips.findIndex(b => b.cat === 'mission'); MV.hover = -1; MV.mx = -1;
  mapCard(); mapLegend();
  MV.dirty = true;
  const tick = () => {
    if (!$('map').classList.contains('on')) return;
    MV.raf = requestAnimationFrame(tick);
    // WASD 平移、平滑跟到目標視角
    const r = bigmap.getBoundingClientRect(), pan = 9 / MV.tzoom;
    const dx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), dz = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0);
    if (dx || dz) { MV.tx += dx * pan; MV.tz += dz * pan; mapClampView(); }
    const kk = .25;
    const moving = Math.abs(MV.tx - MV.cx) * MV.zoom > .3 || Math.abs(MV.tz - MV.cz) * MV.zoom > .3 || Math.abs(MV.tzoom / MV.zoom - 1) > .002;
    if (moving) { MV.cx += (MV.tx - MV.cx) * kk; MV.cz += (MV.tz - MV.cz) * kk; MV.zoom *= Math.pow(MV.tzoom / MV.zoom, kk); MV.dirty = true; }
    else if (MV.cx !== MV.tx || MV.zoom !== MV.tzoom) { MV.cx = MV.tx; MV.cz = MV.tz; MV.zoom = MV.tzoom; MV.dirty = true; }
    MV.t += 1;
    if (MV.dirty || MV.sel >= 0 || MV.t % 15 === 0) { MV.dirty = false; mapDraw(); }
    if (r.width < 2) MV.dirty = true;
  };
  tick();
}
function mapHit(sx, sy) {
  let best = -1, bd = (isTouch ? 22 : 15) ** 2;
  MV.blips.forEach((b, i) => {
    if (b.cat === 'ramp' && MV.zoom < .9) return;
    const r = bigmap.getBoundingClientRect(), x = (b.x - MV.cx) * MV.zoom + r.width / 2, y = (b.z - MV.cz) * MV.zoom + r.height / 2;
    const d = (x - sx) ** 2 + (y - sy) ** 2; if (d < bd) { bd = d; best = i; }
  });
  return best;
}
function mapClick(sx, sy) {
  const hit = mapHit(sx, sy);
  if (hit >= 0) { sfx.click(); mapSelect(hit, false); return; }
  const { x, z } = mapToWorld(sx, sy);
  { const zn = zoneAtW(x, z), [lx, lz] = toL(x, z, zn); if (!zn || lx < avX(zn.ni0) - HR || lx > avX(zn.ni1) + HR || lz < stZ(zn.nj0) - HR || lz > stZ(zn.nj1) + HR) return; }
  if (gps.wp && Math.hypot(gps.wp.x - x, gps.wp.z - z) < 14 / Math.max(.5, MV.zoom)) gpsClear(); else gpsSet(x, z);
  gps.t = 0; gpsUpdate(); mapCard(); MV.dirty = true;
}
const mapLocal = e => { const r = bigmap.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
bigmap.addEventListener('pointerdown', e => {
  bigmap.setPointerCapture(e.pointerId);
  const [x, y] = mapLocal(e);
  MV.ptr.set(e.pointerId, { x, y });
  if (MV.ptr.size === 1) MV.drag = { x, y, tx: MV.tx, tz: MV.tz, moved: 0 };
  if (MV.ptr.size === 2) { const [a, b] = [...MV.ptr.values()]; MV.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: MV.tzoom }; if (MV.drag) MV.drag.moved = 99; }
});
bigmap.addEventListener('pointermove', e => {
  const [x, y] = mapLocal(e);
  if (e.pointerType === 'mouse') { MV.mx = x; MV.my = y; const h = mapHit(x, y); if (h !== MV.hover) MV.hover = h; MV.dirty = true; }
  if (!MV.ptr.has(e.pointerId)) return;
  MV.ptr.set(e.pointerId, { x, y });
  if (MV.pinch && MV.ptr.size >= 2) {
    const [a, b] = [...MV.ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    const f = MV.pinch.z * d / Math.max(1, MV.pinch.d) / MV.tzoom;
    mapZoomAt(f, (a.x + b.x) / 2, (a.y + b.y) / 2); MV.cx = MV.tx; MV.cz = MV.tz; MV.zoom = MV.tzoom;
  } else if (MV.drag) {
    const dx = x - MV.drag.x, dy = y - MV.drag.y;
    MV.drag.moved = Math.max(MV.drag.moved, Math.hypot(dx, dy));
    if (MV.drag.moved > 5) {
      bigmap.classList.add('grab');
      MV.tx = MV.drag.tx - dx / MV.tzoom; MV.tz = MV.drag.tz - dy / MV.tzoom; mapClampView();
      MV.cx = MV.tx; MV.cz = MV.tz; MV.dirty = true;
    }
  }
});
const mapUp = e => {
  if (!MV.ptr.has(e.pointerId)) return;
  const [x, y] = mapLocal(e);
  MV.ptr.delete(e.pointerId);
  if (MV.ptr.size < 2) MV.pinch = null;
  if (MV.ptr.size === 0) {
    if (MV.drag && MV.drag.moved <= 5 && e.type === 'pointerup') mapClick(x, y);
    MV.drag = null; bigmap.classList.remove('grab');
  }
};
bigmap.addEventListener('pointerup', mapUp); bigmap.addEventListener('pointercancel', mapUp);
bigmap.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { MV.mx = -1; MV.hover = -1; MV.dirty = true; } });
bigmap.addEventListener('wheel', e => { e.preventDefault(); const [x, y] = mapLocal(e); mapZoomAt(Math.exp(-e.deltaY * .0016), x, y); }, { passive: false });
$('mapX').addEventListener('click', () => { sfx.click(); toggleMap(false); });
// 地圖開著時的按鍵（99-main.js 的 onKey 先問這裡）
function mapKey(code) {
  if (!$('map').classList.contains('on')) return false;
  if (code === 'ArrowUp' || code === 'ArrowDown') {
    const n = MV.blips.length; if (!n) return true;
    sfx.click(); mapSelect(((MV.sel < 0 ? (code === 'ArrowUp' ? 0 : -1) : MV.sel) + (code === 'ArrowUp' ? -1 : 1) + n) % n, true); return true;
  }
  if (code === 'Enter' || code === 'NumpadEnter') { mapWp(); return true; }
  if (code === 'KeyT') { mapTp(); return true; }
  if (code === 'Equal' || code === 'NumpadAdd' || code === 'KeyE' || code === 'PageUp') { mapZoomAt(1.35); return true; }
  if (code === 'Minus' || code === 'NumpadSubtract' || code === 'KeyQ' || code === 'PageDown') { mapZoomAt(1 / 1.35); return true; }
  if (code === 'KeyC') { const me = mapPlayer(); MV.tx = me.x; MV.tz = me.z; mapClampView(); MV.dirty = true; return true; }
  const n = { Digit1: 'club', Digit2: 'clubIn', Digit3: 'barIn', Digit4: 'garage', Digit5: 'dealer', Digit6: 'home' }[code];
  if (n) { teleport(n); return true; }
  return false;
}
const mapApi = { MV, blips: () => MV.blips, select: i => mapSelect(i, true), key: mapKey, zoom: f => mapZoomAt(f), click: mapClick };
