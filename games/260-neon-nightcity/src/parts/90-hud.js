
// ═══ HUD：任務卡、羅盤與街名、地區天氣時間、旋轉小地圖、目標標記、速度表、全區地圖 ═══
// 北方 = -z；地圖上 px = x、py = z。heading 以順時針角度表示，0 為北。
const MAP_X0 = avX(0) - 60, MAP_Z0 = stZ(0) - 60, MAP_S = 2;
const mapImg = document.createElement('canvas');
mapImg.width = Math.ceil((avX(NX) + 60 - MAP_X0) * MAP_S); mapImg.height = Math.ceil((stZ(NZ) + 60 - MAP_Z0) * MAP_S);
{
  const c = mapImg.getContext('2d');
  const X = x => (x - MAP_X0) * MAP_S, Z = z => (z - MAP_Z0) * MAP_S;
  c.fillStyle = '#4a4e56'; c.fillRect(0, 0, mapImg.width, mapImg.height);
  for (const b of blocks) { c.fillStyle = '#2a2d33'; c.fillRect(X(b.x0), Z(b.z0), (b.x1 - b.x0) * MAP_S, (b.z1 - b.z0) * MAP_S); }
  for (const L of lots) {
    c.fillStyle = L.special ? '#5a3a52' : L.style === 3 ? '#1b1e24' : '#202329';
    c.fillRect(X(L.x0) + 1, Z(L.z0) + 1, (L.x1 - L.x0) * MAP_S - 2, (L.z1 - L.z0) * MAP_S - 2);
  }
  c.strokeStyle = 'rgba(255,190,90,.35)'; c.lineWidth = 1;
  for (let i = 0; i <= NX; i++) { c.beginPath(); c.moveTo(X(avX(i)), Z(stZ(0))); c.lineTo(X(avX(i)), Z(stZ(NZ))); c.stroke(); }
  for (let j = 0; j <= NZ; j++) { c.beginPath(); c.moveTo(X(avX(0)), Z(stZ(j))); c.lineTo(X(avX(NX)), Z(stZ(j))); c.stroke(); }
}
const VENUE_PINS = [
  { name: 'LAZARUS', x: CLUB_X, z: CLUB_Z + 2, col: '#ff3fa0' },
  { name: 'AFTERGLOW', x: BAR_X - 4.6, z: BAR_Z + 2, col: '#ffa040' },
  { name: 'CHROME WORKS', x: GAR_X, z: GAR_Z + 4, col: '#2cf2d8' },
  { name: 'VELOCE MOTORS', x: DEAL_X, z: DEAL_Z + 2, col: '#ffcf6a' },
  { name: 'GARAGE 07', x: HOME_X, z: HOME_Z - 2, col: '#ff8a3a' },
];
const mini = $('mini'), mctx = mini.getContext('2d');
const cmp = $('cmp'), cctx = cmp.getContext('2d');
const DIRN = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const headingOf = (dx, dz) => ((180 - Math.atan2(dx, dz) * 180 / Math.PI) % 360 + 360) % 360;
const dirName = h => DIRN[Math.round(h / 45) % 8];
function streetName(x, z) {
  let bi = 0, bd = 1e9; for (let i = 0; i <= NX; i++) { const d = Math.abs(x - avX(i)); if (d < bd) { bd = d; bi = i; } }
  let bj = 0, be = 1e9; for (let j = 0; j <= NZ; j++) { const d = Math.abs(z - stZ(j)); if (d < be) { be = d; bj = j; } }
  if (bd < 13 && be < 13) return `${AVE[bi]} · ${STR[bj]}`;
  return bd < be ? AVE[bi] : STR[bj];
}
const clockSt = { min: 2 * 60 + 14, acc: 0 };
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
  const zoom = player.mode === 'drive' ? .9 : 1.5;
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
    setText('district', district(px, pz));
  } else {
    setText('stName', VENUES[p.where].name);
    setText('district', VENUES[p.where].dist);
  }
  setText('stHead', `${dirName(h)} ${Math.round(h)}°`);
  clockSt.acc += dt;
  if (clockSt.acc > 2.5) { clockSt.acc = 0; clockSt.min = (clockSt.min + 1) % 1440; }
  setText('clock', `${String(Math.floor(clockSt.min / 60)).padStart(2, '0')}:${String(clockSt.min % 60).padStart(2, '0')}`);
  setText('wxText', U.uRain.value > .8 ? '大雨' : U.uRain.value > .45 ? '雨' : '小雨');
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
    setText('mkDist', `${Math.round(d)} m`);
  } else m.style.display = 'none';
  // 速度表
  $('speedo').classList.toggle('on', inV);
  if (inV) {
    const v = p.veh, kmh = Math.round(Math.abs(v.vx * Math.sin(v.yaw) + v.vz * Math.cos(v.yaw)) * 3.6);
    setText('spd', String(kmh)); setText('gear', String(v.gear)); setText('vehName', motors.test && v === kestrel ? `試駕 ${v.name} · ${Math.ceil(motors.test.t)}s` : v.name);
    const r = $('rpm').firstElementChild; r.style.width = `${Math.round(v.rpm * 100)}%`; r.classList.toggle('hi', v.rpm > .86);
    const nb = $('nitro').firstElementChild; nb.style.width = `${Math.round(nitro.v * 100)}%`;
  }
  setText('cash', money(motors.cash));
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('on'); }
}
// ─── 全區地圖（M）：點地點傳送 ───
const bigmap = $('bigmap');
function drawBigMap() {
  const c = bigmap.getContext('2d');
  const W = bigmap.width, H = bigmap.height, s = Math.min(W / mapImg.width, H / mapImg.height);
  c.clearRect(0, 0, W, H);
  c.save(); c.translate((W - mapImg.width * s) / 2, (H - mapImg.height * s) / 2); c.scale(s, s);
  c.drawImage(mapImg, 0, 0);
  const X = x => (x - MAP_X0) * MAP_S, Z = z => (z - MAP_Z0) * MAP_S;
  gpsBig(c, X, Z, s);
  stuntBig(c, X, Z, s);   // 特技跳台（69-stunt.js）
  evBig(c, X, Z, s);
  c.font = `600 ${13 / s}px system-ui`; c.textAlign = 'left'; c.textBaseline = 'middle';
  for (const v of VENUE_PINS) { c.fillStyle = v.col; c.beginPath(); c.arc(X(v.x), Z(v.z), 7 / s, 0, 7); c.fill(); c.fillStyle = '#ece8e0'; c.fillText(v.name, X(v.x) + 11 / s, Z(v.z)); }
  c.fillStyle = 'rgba(236,232,224,.55)'; c.font = `500 ${10 / s}px system-ui`; c.textAlign = 'center';
  for (let i = 0; i <= NX; i++) c.fillText(AVE[i], X(avX(i)), Z(stZ(0)) - 14 / s);
  for (let j = 0; j <= NZ; j++) c.fillText(STR[j], X(avX(0)) - 30 / s, Z(stZ(j)));
  const p = player.where === 'out' ? (player.mode === 'drive' ? player.veh : player) : VENUES[player.where].door;
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(X(p.x), Z(p.z), 6 / s, 0, 7); c.fill();
  c.restore();
}
function toggleMap(on = !$('map').classList.contains('on')) {
  $('map').classList.toggle('on', on);
  if (on) { const r = bigmap.getBoundingClientRect(); bigmap.width = r.width * 2; bigmap.height = r.height * 2; drawBigMap(); if (document.pointerLockElement) document.exitPointerLock(); }
}
function teleport(k) {
  toggleMap(false);
  const go = (x, z, yaw) => {
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
document.querySelectorAll('#mapList button').forEach(b => b.addEventListener('click', () => { sfx.click(); teleport(b.dataset.t); }));
