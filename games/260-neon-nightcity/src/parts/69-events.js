// ═══ 第四階段：藍點隨機事件：鐵庫保全運鈔車 ═══
// 沒被通緝、在戶外時每 2.5–4 分鐘（真實時間）從看不到的路口開出一台，沿路網（69-gps.js 的 routeTo）在城裡繞；小地圖閃藍點。
// 用黏性炸彈、手榴彈或火箭炸後車門（後方 4 m 內爆炸）→ 停車、掉三袋現金，立刻 3 星；整台炸毀也會掉錢但燒掉四成。
// 搶過或炸毀都會讓 69-market.js 的 IVLT（鐵庫保全）股價重挫、競爭對手 SNTL 上漲。Zero 的「標記運鈔車」直接叫一台出來。
// 排在 69-crew 之後、69-gps 之前：routeTo、spawnSpot、addHeat、stockShock 只在函式裡用。

const ev = { truck: null, t: 150, bags: [] };   // TRUCK_PAL 是 30-vehicles.js 的 PAL 索引 +1（0 是原色）：6 = 深綠
const TRUCK_PAL = 6, TRUCK_NAME = '鐵庫保全運鈔車', EV_BLUE = '#5aa9ff';
function truckSpawn(why) {
  if (ev.truck) return false;
  const sp = spawnSpot(110, 200);
  if (!sp) return false;
  const v = buildVeh('shvan', sp.x, sp.z, sp.yaw, 8, Math.random(), TRUCK_PAL, 'cash');
  v.name = TRUCK_NAME; v.hp = 2600; v.mass = 3800; v.vmax = 22; v.eng = 7.5; v.y = groundH(v.x, v.z);
  const tk = ev.truck = { v, route: null, k: 1, state: 'drive', t: 0, stuck: 0, rev: 0, cash: 18000 + Math.round(Math.random() * 22) * 1000 };
  truckRoute(tk); poseVehicle(v);
  toast(why === 'zero' ? 'Zero：運鈔車位置傳到你小地圖上了（藍點）' : '附近有運鈔車經過（小地圖藍點）');
  return true;
}
// 隨便挑一個 150–400 m 外的路口當目的地（城市 20×15，不設上限會開到一公里外）
function truckRoute(tk) {
  const v = tk.v, c = [];
  for (let i = 0; i <= NX; i++) for (let j = 0; j <= NZ; j++) { const d = Math.hypot(avX(i) - v.x, stZ(j) - v.z); if (d > 150 && d < 400) c.push([avX(i), stZ(j)]); }
  const [tx, tz] = c[Math.floor(Math.random() * c.length)];
  tk.route = routeTo(v.x, v.z, tx, tz); tk.k = 1;
}
function truckDrive(tk, dt) {
  const v = tk.v;
  if (player.veh === v) { tk.state = 'taken'; return; }   // 玩家自己開走了
  if (tk.state !== 'drive' || v.dead) { if (!v.dead) driveVehicle(v, { thr: 0, brk: 1, steer: 0, hb: false }, dt); return; }
  if (tk.k >= tk.route.length) truckRoute(tk);
  // 目標點往行車方向的右側（這座城市靠右行駛）偏一條車道
  const [ax, az] = tk.route[tk.k - 1], [bx, bz] = tk.route[tk.k];
  const L = Math.hypot(bx - ax, bz - az) || 1, dx = (bx - ax) / L, dz = (bz - az) / L;
  const tx = bx - dz * LANE, tz = bz + dx * LANE;
  if (Math.hypot(tx - v.x, tz - v.z) < 7) { tk.k++; return truckDrive(tk, 0); }
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), vF = v.vx * fx + v.vz * fz;
  const da = wrapA(Math.atan2(tx - v.x, tz - v.z) - v.yaw), ad = Math.abs(da);
  let steer = clamp(da * 2.4, -1, 1), thr = 1, brk = 0;
  const want = ad > 1.1 ? 6 : ad > .45 ? 10 : 17;
  if (vF > want + 1.5) { thr = 0; brk = clamp((vF - want) / 7, .35, 1); }
  if (tk.rev > 0) { tk.rev -= dt; thr = 0; brk = 1; steer = -Math.sign(da) || 1; }
  else if (thr > .3 && Math.abs(vF) < 1.2) { tk.stuck += dt; if (tk.stuck > 1.5) { tk.rev = 1.2; tk.stuck = 0; } }
  else tk.stuck = 0;
  driveVehicle(v, { thr, brk, steer, hb: false }, dt);
  v.lights = 1;
}
// 69-combat.js 的 blast() 每次爆炸都問這裡：炸在後車門 4 m 內就打開
function evBlast(x, z, r, mine) {
  const tk = ev.truck;
  if (!tk || tk.state === 'open' || tk.v.dead) return;
  const v = tk.v, bx = v.x - Math.sin(v.yaw) * v.len / 2, bz = v.z - Math.cos(v.yaw) * v.len / 2;
  if (Math.hypot(x - bx, z - bz) < Math.max(4, r * .5)) truckOpen(tk, 1, mine);
}
function truckOpen(tk, k, mine) {
  const v = tk.v;
  tk.state = 'open';
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), rx = -fz, rz = fx, n = 3, each = Math.round(tk.cash * k / n / 100) * 100;
  for (let s = 0; s < n; s++) {
    const x = v.x - fx * (v.len / 2 + 1.2 + s * .7) + rx * (s - 1) * 1.1, z = v.z - fz * (v.len / 2 + 1.2 + s * .7) + rz * (s - 1) * 1.1;
    ev.bags.push({ x, z, amt: each, t: 0, m: bagMesh(x, z) });
  }
  sparks(v.x - fx * v.len / 2, 1.2, v.z - fz * v.len / 2, 30, 6);
  if (mine) addHeat(CRIME.explode, 3);   // 搶運鈔車：直接 3 星
  stockShock('IVLT');
  toast(k < 1 ? '運鈔車炸毀了，燒剩的錢袋掉在路上' : '後車門炸開了：撿錢袋');
}
let bagGeo = null;
function bagMesh(x, z) {
  if (!bagGeo) {
    const k = new Kit();
    k.box(0, .2, 0, .56, .4, .36, 0x3c4a3a, 2); k.box(0, .41, 0, .3, .06, .14, 0x22261e, 2); k.box(0, .2, .185, .2, .12, .01, 0xd9b42a, 10);
    bagGeo = k.build();
  }
  const m = new T.Mesh(bagGeo, MAT.uber); m.position.set(x, groundH(x, z), z); m.rotation.y = Math.random() * 6.3; scene.add(m);
  return m;
}
function evUpdate() {
  const dt = slowmo.raw * slowmo.k, out = player.where === 'out';
  const tk = ev.truck;
  if (tk) {
    tk.t += dt;
    truckDrive(tk, dt);
    if (tk.v.dead && tk.state !== 'open') truckOpen(tk, .6, !!tk.v.byP);
    // 太遠、開太久沒人理，或搶完人走遠了：收掉
    const d = Math.hypot(tk.v.x - pX(), tk.v.z - pZ());
    if (d > 320 || tk.state === 'drive' && tk.t > 300 && d > 120 || tk.state === 'open' && !ev.bags.length && d > 80) {
      if (player.veh !== tk.v) { const i = vehicles.indexOf(tk.v); if (i >= 0) vehicles.splice(i, 1); scene.remove(tk.v.g); tk.v.g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }
      ev.truck = null; ev.t = 150 + Math.random() * 90;
    }
  } else if (out && !W.stars && started && !life.dead && (ev.t -= slowmo.raw) <= 0) { if (!truckSpawn()) ev.t = 20; }
  for (const b of [...ev.bags]) {
    b.t += dt; b.m.rotation.y += dt * .6;
    if (player.mode === 'walk' && !life.dead && out && Math.hypot(player.x - b.x, player.z - b.z) < 1.4) { earn(b.amt, '運鈔車錢袋'); b.t = 999; }
    if (b.t > 150) { scene.remove(b.m); ev.bags.splice(ev.bags.indexOf(b), 1); }
  }
}
// 小地圖（90-hud.js 的 drawMini 在警力之後呼叫）：運鈔車閃藍點、錢袋綠點
function evMini(ctx, P2, zoom) {
  const tk = ev.truck;
  if (tk && tk.state === 'drive' && Math.sin(uTimeNow() * 6) > -.4) { const [x, y] = P2(tk.v.x, tk.v.z); ctx.fillStyle = EV_BLUE; ctx.beginPath(); ctx.arc(x, y, 8 / zoom, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#7fe08a';
  for (const b of ev.bags) { const [x, y] = P2(b.x, b.z); ctx.beginPath(); ctx.arc(x, y, 4 / zoom, 0, 7); ctx.fill(); }
}
function evBig(c, X, Z, s) {
  const tk = ev.truck;
  if (tk && tk.state === 'drive') { c.fillStyle = EV_BLUE; c.beginPath(); c.arc(X(tk.v.x), Z(tk.v.z), 8 / s, 0, 7); c.fill(); }
}

// 測試 API（window.__nc.gta.ev）
const evApi = { ev, spawn: why => truckSpawn(why), open: () => ev.truck && truckOpen(ev.truck, 1, true) };
