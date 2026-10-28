
// ═══ VELOCE MOTORS 車行與 GARAGE 07 車庫：展示廳、車庫、買車／試駕／開車出庫／賣車、甩尾賺錢與存檔 ═══
ENV.home = { lampOn: 0, wet: 0, fogDen: .03, fog: 0x14181c, fogHi: 0x20262a, top: 0x6a767a, bot: 0x3a3a36 };
const money = n => '$' + Math.round(n).toLocaleString('en-US');
const carPrice = id => CARS[id].price;
const sellPrice = id => Math.round(CARS[id].price * .6 / 1000) * 1000;

// ─── 車庫存檔：現金、擁有的車、各車塗裝、目前開在街上的那台 ───
const MOTOR_KEY = 'nc260.motors';
const motors = { cash: 180000, owned: [STARTER], paint: {}, cur: STARTER, stowed: false, test: null, game: null, stunts: [], stk: null, props: null, ts: 0, side: { race: {}, win: [], surv: 0, turf: [], tale: {}, svb: {} }, skills: null, gear: null, v5: { imp: 0, ext: [] }, mods: {}, v6: { sellT: 0, exp: null, wipe: 0 }, v7: {}, story: null };
try {
  const d = JSON.parse(localStorage.getItem(MOTOR_KEY) || 'null');
  if (d && typeof d === 'object') {
    if (Number.isFinite(d.cash)) motors.cash = clamp(Math.round(d.cash), 0, 1e9);
    // 舊存檔裡程式建模的車（含原本的 Kestrel）已經下架：只留實車模型
    if (Array.isArray(d.owned)) motors.owned = [STARTER, ...d.owned.filter((id, i, a) => CARS[id] && CARS[id].glb && id !== STARTER && a.indexOf(id) === i)];
    if (d.paint && typeof d.paint === 'object') for (const id in d.paint) if (CARS[id] && CARS[id].glb && Number.isInteger(d.paint[id])) motors.paint[id] = d.paint[id];
    if (motors.owned.includes(d.cur)) motors.cur = d.cur;
    // 第 3 版：完成過的特技跳台（69-stunt.js）、股市（69-market.js 的 stkInit 再依代號補齊與檢查）、資產
    const num = (o, ok) => o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).filter(([, v]) => Number.isFinite(v) && ok(v))) : {};
    if (d.stk && typeof d.stk === 'object') motors.stk = { px: num(d.stk.px, v => v > 0 && v < 1e6), sh: num(d.stk.sh, v => v >= 0 && v < 1e9 && Number.isInteger(v)), cost: num(d.stk.cost, v => v >= 0 && v < 1e12) };
    if (d.props && typeof d.props === 'object') motors.props = { own: Array.isArray(d.props.own) ? d.props.own.filter(s => typeof s === 'string') : [], safe: num(d.props.safe, v => v >= 0 && v < 1e9), pause: num(d.props.pause, v => v > 0 && v < 1e14) };
    // 第 4 版：上次存檔的時間（69-market.js 補算關著遊戲期間的股價與資產收入）、資產防守失敗的停業時間（props.pause）
    if (Number.isFinite(d.ts) && d.ts > 0 && d.ts <= Date.now() + 6e4) motors.ts = d.ts;
    // 第 6 版：支線活動（69-side.js）：街頭賽最佳成績（秒）與贏過的賽道、生存模式最高波數（surv 是鐵灣貨場，svb 是後加的擂台）、拿下的幫派地盤、委託進度。這裡只檢查形狀，代號由各模組自己對照
    if (d.side && typeof d.side === 'object') {
      const S = d.side, ids = a => Array.isArray(a) ? a.filter((s, k) => typeof s === 'string' && s.length < 24 && a.indexOf(s) === k) : [];
      motors.side = { race: num(S.race, v => v > 0 && v < 3600), win: ids(S.win), surv: Number.isInteger(S.surv) ? clamp(S.surv, 0, 999) : 0, turf: ids(S.turf), tale: num(S.tale, v => Number.isInteger(v) && v >= 0 && v < 20), svb: num(S.svb, v => Number.isInteger(v) && v > 0 && v < 1000) };
    }
    // 第 7 版（69-v3-skills.js）：三位主角的六圍（0–100）、裝備 gear（消音器 sil、撈過的貨櫃 salv、搶劫同夥的經驗 hire）
    if (Array.isArray(d.skills) && (d.skills.length === 3 || d.skills.length === 5)) motors.skills = d.skills.map(s => s && typeof s === 'object' ? num(s, v => v >= 0 && v <= 100) : {});
    if (d.gear && typeof d.gear === 'object') {
      const G = d.gear, ids = a => Array.isArray(a) ? a.filter((s, k) => typeof s === 'string' && s.length < 24 && a.indexOf(s) === k) : [];
      motors.gear = { sil: ids(G.sil), salv: Array.isArray(G.salv) ? G.salv.filter((i, k, a) => Number.isInteger(i) && i >= 0 && i < 64 && a.indexOf(i) === k) : [], hire: num(G.hire, v => Number.isInteger(v) && v >= 0 && v < 100) };
    }
    // 第 9 版（69-v5-civic.js）：座駕在拖吊場（imp）、裝了擴充彈匣的槍（ext）
    if (d.v5 && typeof d.v5 === 'object') motors.v5 = { imp: d.v5.imp === 1 ? 1 : 0, ext: Array.isArray(d.v5.ext) ? d.v5.ext.filter((s, k, a) => typeof s === 'string' && s.length < 24 && a.indexOf(s) === k) : [] };   // ext：69-v5-shops.js 的擴充彈匣
    // 第 10 版（66-chrome.js）：每台車在 CHROME WORKS 裝的改裝套件 { 車: { 套件: 等級 } }；這裡只收物件，套件與等級由 66-chrome.js 的 modSanitize 檢查
    if (d.mods && typeof d.mods === 'object' && !Array.isArray(d.mods)) for (const id in d.mods) if (CARS[id] && CARS[id].glb && d.mods[id] && typeof d.mods[id] === 'object') motors.mods[id] = d.mods[id];
    // 第 11 版（69-v6-customs.js）：下次能賣街車的時間 sellT、今天的出口車單 exp（{ d: 第幾小時, list, done }）、黑市晶片抹除儀 wipe
    if (d.v6 && typeof d.v6 === 'object') {
      const E = d.v6.exp, ok = a => Array.isArray(a) ? a.filter((s, k) => typeof s === 'string' && s.length < 24 && a.indexOf(s) === k).slice(0, 3) : [];
      motors.v6 = { sellT: Number.isFinite(d.v6.sellT) && d.v6.sellT > 0 && d.v6.sellT < Date.now() + 36e5 ? d.v6.sellT : 0, wipe: d.v6.wipe === 1 ? 1 : 0,
        exp: E && typeof E === 'object' && Number.isInteger(E.d) && ok(E.list).length === 3 ? { d: E.d, list: ok(E.list), done: ok(E.done) } : null };
    }
    // 第 12 版（69-v7-*.js）：夜店 club、地堡 bunker、賭場 casino；這裡只收物件，各欄位由各模組開場時檢查範圍
    if (d.v7 && typeof d.v7 === 'object' && !Array.isArray(d.v7)) motors.v7 = Object.fromEntries(['club', 'bunker', 'casino'].filter(k => d.v7[k] && typeof d.v7[k] === 'object' && !Array.isArray(d.v7[k])).map(k => [k, d.v7[k]]));
    // 第 13 版（69-w0-story.js 主線《一手爛牌》）：這裡只收物件，任務代號、獎牌與旗標由 storyInit 檢查；沒有這個欄位的舊存檔由 storyInit 當成舊玩家（五位主角都能用）
    if (d.story && typeof d.story === 'object' && !Array.isArray(d.story)) motors.story = d.story;
    motors.old = !d.story;
    if (Array.isArray(d.stunts)) motors.stunts = d.stunts.filter((i, k, a) => Number.isInteger(i) && i >= 0 && i < RAMPS.length && a.indexOf(i) === k);
    // 第 2 版：手機快速存檔（69-phone.js）。舊存檔沒有這個欄位；讀檔時再逐項檢查範圍
    if (d.game && typeof d.game === 'object' && Array.isArray(d.game.st) && Number.isInteger(d.game.cur) && d.game.ammo && typeof d.game.ammo === 'object') motors.game = d.game;
    // 第 5 版：城市切成三區（05-zones.js）之後存的是世界座標；之前的存檔是方格座標（那時兩者一樣），讀進來換一次
    if (motors.game && !(d.v >= 5)) for (const s of motors.game.st) if (s && Number.isFinite(s.x) && Number.isFinite(s.z)) Object.assign(s, spotW({ x: s.x, z: s.z, yaw: Number.isFinite(s.yaw) ? s.yaw : 0 }));
    // 照 GTA V 地圖重排成十五片（05-zones.js）。第 5、6 版是舊三區（ZONES_V6）的世界座標：先換回邏輯座標，再用新的片換到世界；
    // 生成在邏輯座標裡沒變，所以多半還在同一條街上。落在拿掉的格子、水裡或外緣外（舊的外圍步道、岬角、東灣對岸）的，挪到最近的車道。
    // 第 7 版有兩種（兩條分支各自加的）：帶 skills／gear 欄位的是第三部曲那一支，位置還是舊三區；沒有的是重排那一支，已經換過。第 8 版兩者合併
    if (motors.game && d.v >= 5 && (d.v < 7 || d.v === 7 && 'skills' in d)) for (const s of motors.game.st) {
      if (!s || !Number.isFinite(s.x) || !Number.isFinite(s.z)) continue;
      const zo = ZONES_V6.find(zn => { const dx = s.x - zn.ox, dz = s.z - zn.oz, x = dx * zn.c - dz * zn.s, z = dx * zn.s + dz * zn.c; return x >= zn.x0 && x < zn.x1 && z >= zn.z0 && z < zn.z1; }) || ZONES_V6[0];
      const dx = s.x - zo.ox, dz = s.z - zo.oz, x = dx * zo.c - dz * zo.s, z = dx * zo.s + dz * zo.c, yaw = (Number.isFinite(s.yaw) ? s.yaw : 0) - zo.ry;
      let w = spotW({ x, z, yaw });
      if (cellDropped(Math.floor((x - X0) / P), Math.floor((z - Z0) / Q)) || !landW(w.x, w.z)) w = rnLaneSpot(w.x, w.z);
      s.x = +w.x.toFixed(2); s.z = +w.z.toFixed(2); s.yaw = +w.yaw.toFixed(3);
    }
    // 第 14 版：天樞島（2026-10-26），城中間加了島、四周的片往外推。第 8～13 版（和沒有 skills 的第 7 版）是之前十五片（05-zones.js 的 ZONES_V12）的世界座標：
    // 用舊的片（剛體＋彎曲）換回邏輯座標（不在任何一片裡的照最近那片），再用新的片換到世界；落在水裡、拿掉的格子的挪到最近的車道
    if (motors.game && (d.v >= 8 && d.v <= 13 || d.v === 7 && !('skills' in d))) for (const s of motors.game.st) {
      if (!s || !Number.isFinite(s.x) || !Number.isFinite(s.z)) continue;
      let best = null, bd = Infinity;
      for (const zo of ZONES_V12) { const [x, z] = zoneLocal(zo, s.x, s.z), q = Math.max(zo.x0 - x, x - zo.x1, 0) ** 2 + Math.max(zo.z0 - z, z - zo.z1, 0) ** 2; if (q < bd) { bd = q; best = [x, z, zo]; } }
      const [x, z, zo] = best;
      let w = spotW({ x, z, yaw: (Number.isFinite(s.yaw) ? s.yaw : 0) - zo.ry });
      if (cellDropped(Math.floor((x - X0) / P), Math.floor((z - Z0) / Q)) || !landW(w.x, w.z)) w = rnLaneSpot(w.x, w.z);
      s.x = +w.x.toFixed(2); s.z = +w.z.toFixed(2); s.yaw = +w.yaw.toFixed(3);
    }
  }
} catch (e) { /* 私密視窗或封鎖儲存空間：用預設值 */ }
const lastTs = motors.ts;   // saveMotors 會改寫 ts，先記下上次存檔的時間給 69-market.js
function saveMotors() {
  motors.ts = Date.now();
  try { localStorage.setItem(MOTOR_KEY, JSON.stringify({ v: 14, ts: motors.ts, cash: motors.cash, owned: motors.owned, paint: motors.paint, cur: motors.cur, game: motors.game, stunts: motors.stunts, stk: motors.stk, props: motors.props, side: motors.side, skills: motors.skills, gear: motors.gear, v5: motors.v5, mods: motors.mods, v6: motors.v6, v7: motors.v7, story: motors.story })); } catch (e) { /* 存不了就算了 */ }
}
function earn(n, why) {
  motors.cash += n; saveMotors();
  toast(`${why} +${money(n)}`);
  const el = $('cash'); el.classList.remove('up'); void el.offsetWidth; el.classList.add('up');
}
if (motors.cur !== STARTER || motors.paint[STARTER] != null) { applyCar(kestrel, motors.cur, motors.paint[motors.cur]); poseVehicle(kestrel); }
function placeCarAt(sp) {
  const v = kestrel;
  v.x = sp.x; v.z = sp.z; v.yaw = sp.yaw; v.vx = v.vz = v.yr = v.steer = 0; v.y = groundH(v.x, v.z); v.g.visible = true;
  rollClear(v);   // 68-roll.js
  poseVehicle(v);
}
// 規格：遊戲裡的極速（原廠極速 × 26-glb.js 的 TUNE.TOP_K），加速、煞車與抓地用五格評分（遊戲裡的加速度是街機手感，換成秒數會很怪），下一行是原廠數字
const dots = (v, lo, hi) => { const n = clamp(Math.round(1 + (v - lo) / (hi - lo) * 4), 1, 5); return '●'.repeat(n) + '○'.repeat(5 - n); };
const carStats = id => {
  const c = CARS[id], r = c.real;
  return `極速 ${Math.round(c.kmh || c.vmax * 3.6)} km/h · 加速 ${dots(c.eng, 10.5, 25)} · 煞車 ${dots(c.brk || 16, 13.8, 19.6)} · 抓地 ${dots(c.grip, 7.6, 11.8)}`
    + (r ? `\n原廠 ${r.ps} 匹 · ${r.kg.toLocaleString('en-US')} kg · 0–100 ${r.t100} 秒 · 極速 ${r.top} km/h` : '');
};

// 展示廳（三層樓、左右兩側展車、電梯）在 64-showroom.js

// ─── GARAGE 07：門在 z = 0，室內 x -9..9、z 0..GD、高 4.6 m；兩側各 GN 格、最裡面一格（共 2·GN+1 格，對應 CAR_ORDER） ───
const homeScene = new T.Scene();
const home = { boxes: [], circles: [], lights: [], baseN: 0, cars: new T.Group(), bayCars: [] };
const GN = Math.ceil((CAR_ORDER.length - 1) / 2), GD = 27 + (GN - 6) * 3.3, GK = GD - 27;   // GK：後牆區比原本 27 m 的車庫往後移的距離
const BAYS = [];
for (let n = 0; n < GN; n++) for (const s of [-1, 1]) BAYS.push({ x: s * 6.2, z: 4.6 + n * 3.3, yaw: -s * Math.PI / 2 });
BAYS.push({ x: 0, z: 24.2 + GK, yaw: Math.PI });
const bayOf = id => BAYS[CAR_ORDER.indexOf(id)];
{
  const k = new Kit(), B = home.boxes, S = homeScene, amber = 0xd89a2a;
  const wall = (x0, x1, z0, z1, h, col, mat = 26) => { k.box((x0 + x1) / 2, h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0, col, mat); B.push({ x0, x1, z0, z1 }); };
  // 環氧樹脂地板、車格線、天花板鋼樑與日光燈管
  k.box(0, -.05, GD / 2, 18.4, .1, GD + .4, 0x3c3f44, 33);
  for (let n = 0; n <= GN; n++) for (const s of [-1, 1]) k.box(s * 6.3, .003, 2.95 + n * 3.3, 5.4, .006, .1, amber, 2);
  for (const s of [-1, 1]) k.box(s * 3.65, .003, 2.95 + GN * 3.3 / 2, .1, .006, GN * 3.3, amber, 2);
  for (const s of [-1, 1]) for (let n = 0; n < GN; n++) k.box(s * 8.55, .06, 4.6 + n * 3.3, .14, .12, 1.8, 0xc8a02a, 15);
  k.box(0, 4.65, GD / 2, 18.4, .1, GD + .4, 0x2a2c30, 20);
  for (let z = 2; z < GD; z += 3) k.box(0, 4.42, z, 18, .3, .16, 0x2a2c30, 34);
  for (let z = 4; z < GD; z += 5) { k.box(0, 4.22, z, .14, .06, 2.6, 0xf0f6ff, 11); k.box(0, 4.27, z, .26, .05, 2.7, 0x2a2c30, 15); }
  for (const s of [-1, 1]) for (let z = 6.2; z < GD - 4; z += 6.6) { k.box(s * 6.2, 4.22, z, 2.4, .06, .12, 0xf0f6ff, 11); k.box(s * 6.2, 4.27, z, 2.5, .05, .24, 0x2a2c30, 15); }
  // 水泥磚牆、黃黑腰帶
  wall(-9.4, -9, 0, GD, 4.6, 0x5a5d61); wall(9, 9.4, 0, GD, 4.6, 0x5a5d61); wall(-9.4, 9.4, GD, GD + .4, 4.6, 0x55585c);
  for (const s of [-1, 1]) k.box(s * 8.97, 1.2, GD / 2, .04, .16, GD, 0xc8a02a, 2);
  for (let x = -8.6; x < 8.6; x += .8) k.box(x + .2, 1.2, GD - .03, .4, .16, .04, 0xc8a02a, 2);
  // 前牆與捲門（室內側）
  wall(-9.4, -3.2, -.4, 0, 4.6, 0x4a4d52); wall(3.2, 9.4, -.4, 0, 4.6, 0x4a4d52);
  B.push({ x0: -3.2, x1: 3.2, z0: -.6, z1: -.25 });
  for (let y = .15; y < 4.1; y += .24) k.box(0, y, -.2, 6.4, .2, .08, 0x80848a, 22);
  k.box(0, 4.3, -.2, 6.6, .5, .4, 0x2a2c30, 15);
  for (const s of [-1, 1]) k.box(s * 3.25, 2.2, -.15, .12, 4.4, .16, 0x2a2c30, 15);
  k.box(0, .9, -.1, .5, .06, .1, 0xd8dce2, 3);
  // 後牆：工作台、洞洞板與工具、紅色工具車、輪胎架、油桶、小冰箱
  k.box(-6.2, .9, 26.3 + GK, 4.2, .08, 1.1, 0x5a3a20, 23).box(-6.2, .45, 26.3 + GK, 4.0, .9, 1.0, 0x2a2c30, 34);
  k.box(-6.2, 2.4, 26.95 + GK, 4.2, 1.8, .04, 0x8a7a5a, 36);
  for (let i = 0; i < 9; i++) k.box(-7.9 + i * .42, 2.3 + (i % 3) * .3, 26.9 + GK, .05, .38 - (i % 2) * .1, .03, 0xb8bcc2, 3, 0, 0, (i % 3 - 1) * .3);
  for (const [x, w] of [[-3.6, .9], [-2.6, .9]]) { k.box(x, .55, 26.5 + GK, w * .95, 1.1, .6, 0xa8141a, 34); for (let d = 0; d < 4; d++) k.box(x, .2 + d * .24, 26.19 + GK, w * .85, .02, .02, 0xd8dce2, 3); }
  B.push({ x0: -8.4, x1: -2.1, z0: 25.7 + GK, z1: 27 + GK });
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) k.add(new T.TorusGeometry(.3, .12, 8, 18), 0x141414, 6, tf(6.4 + i * .82, .45 + j * .82, 26.4 + GK, 0, 0, 0));
  k.box(7.2, .02, 26.4 + GK, 2.8, .04, .6, 0x2a2c30, 15);
  for (const [x, z, c] of [[3.4, 26.3 + GK, 0x1c4a7a], [4.2, 26.4 + GK, 0x7a1c1c]]) k.cyl(x, .45, z, .3, .3, .9, 16, c, 21).cyl(x, .9, z, .3, .3, .02, 16, 0x1a1a1a, 15);
  B.push({ x0: 2.9, x1: 8.8, z0: 25.9 + GK, z1: 27 + GK });
  // 牆上的旗子與時鐘、入口旁的開關箱
  k.box(-8.94, 3.2, 8, .03, .9, 2.4, 0x14243a, 2).box(-8.93, 3.2, 8, .02, .12, 2.4, 0xd8a02a, 2);
  k.cyl(8.94, 3.2, 12, .35, .35, .04, 24, 0xe8e4dc, 10, 0, 0, Math.PI / 2).box(8.91, 3.25, 12, .02, .22, .03, 0x111111, 2).box(8.91, 3.2, 11.92, .02, .03, .16, 0x111111, 2);
  k.box(4, 1.4, .08, .5, .7, .14, 0x3a3d42, 15).box(4, 1.5, .16, .12, .12, .02, 0x40ff80, 11);
  S.add(new T.Mesh(k.build(), MAT.ux));   // 牆、地坪、天花板與工作台用 07-kitx.js 的程式紋理
  S.add(home.cars);
  home.baseN = home.circles.length;
}
// 最裡面那一格的雙柱升降機與旁邊的工具推車（http(s) 下走進車庫才下載，27-props.js）
propSwap('home', null, 'carlift', [{ x: 0, z: 24.2 + GK, ry: Math.PI / 2 }], homeScene,
  () => home.boxes.push({ x0: -2.1, x1: -1.45, z0: 23.7 + GK, z1: 24.7 + GK }, { x0: 1.45, x1: 2.1, z0: 23.7 + GK, z1: 24.7 + GK }));
propSwap('home', null, 'toolcart', [{ x: 2.3, z: 22.6 + GK, ry: -Math.PI / 2 }], homeScene,
  () => home.boxes.push({ x0: 1.8, x1: 2.8, z0: 22.25 + GK, z1: 22.95 + GK }));
home.lights.push(
  ...Array.from({ length: Math.ceil((GD - 4) / 5) }, (_, i) => ({ x: 0, y: 3.9, z: 4 + i * 5, col: lin(0xe8f2ff), r: 11, i: 2 })),
  { x: -6.2, y: 2.4, z: 25.6 + GK, col: lin(0xffd0a0), r: 5, i: 1 },
  ...Array.from({ length: Math.floor((GD - 8) / 16) + 1 }, (_, i) => 12.8 + i * 16).filter(z => z < GD - 4).flatMap(z => [-6.2, 6.2].map(x => ({ x, y: 3.8, z, col: lin(0xe8f2ff), r: 10, i: 1.2 }))),
);
// 車庫裡擺出擁有的車（目前開在街上的那台不在）
function rebuildGarage() {
  for (const m of home.cars.children) disposeKit(m);
  home.cars.clear(); home.bayCars.length = 0; home.circles.length = home.baseN;
  for (const id of motors.owned) {
    if (id === motors.cur && !motors.stowed) continue;
    const b = bayOf(id), m = carObject(id, motors.paint[id]);
    m.position.set(b.x, 0, b.z); m.rotation.y = b.yaw; home.cars.add(m);
    home.bayCars.push({ id, x: b.x, z: b.z });
    const L = CARS[id].len * .28;
    for (const s of [-1, 1]) home.circles.push({ x: b.x + Math.sin(b.yaw) * L * s, z: b.z + Math.cos(b.yaw) * L * s, r: CARS[id].w / 2 + .05, car: 1 });
  }
}
rebuildGarage();

VENUES.home = { scene: homeScene, data: home, spawn: { x: 0, z: 2.2, yaw: 0 }, name: 'GARAGE 07', toast: 'GARAGE 07 · 你的車庫', dist: '舊碼頭 · 8 St', ceil: 4.2, door: WP(HOME_X, HOME_Z), out: spotW({ x: HOME_X - 1.4, z: HOME_Z - 1.3, yaw: 0 }) };

// ─── 對話：看車、買車、試駕、業務、車庫 ───
const WHO_SELL = 'Vale · VELOCE MOTORS';
function carDialog(id) {
  const c = CARS[id], own = motors.owned.includes(id), short = c.price - motors.cash;
  const opts = [];
  if (own) opts.push({ t: '這台已經停在你的車庫了', fn: closeDialog });
  else if (short <= 0) opts.push({ t: `買下（${money(c.price)}）`, fn: () => confirmBuy(id) });
  else opts.push({ t: `還差 ${money(short)}`, fn: () => dialog(WHO_SELL, `${c.name} 要 ${money(c.price)}。你現在有 ${money(motors.cash)}。去街上甩幾圈尾再回來，這台車不會跑掉。`, [{ t: '試駕看看', fn: () => testDrive(id) }, { t: '好吧', fn: closeDialog }]) });
  opts.push({ t: '試駕 60 秒', fn: () => testDrive(id) }, { t: '再看看', fn: closeDialog });
  const snd = sfx.engCredit(id);   // 80-audio.js：這台車的引擎聲錄音出處（部分為 CC BY）
  dialog(`${c.name} · ${c.cls}`, `${c.tag}\n${money(c.price)} · ${carStats(id)}` + (c.credit ? `\n${c.credit}` : '') + (snd ? `\n${snd}` : ''), opts);
}
function confirmBuy(id) {
  const c = CARS[id];
  dialog(WHO_SELL, `${c.name}，${money(c.price)}，不含稅也不含罰單。確定嗎？`, [{ t: '刷卡', fn: () => buyCar(id) }, { t: '再想想', fn: closeDialog }]);
}
function buyCar(id) {
  const c = CARS[id];
  if (motors.cash < c.price || motors.owned.includes(id)) return closeDialog();
  const prev = kestrel.carId;
  motors.cash -= c.price; motors.owned.push(id); motors.cur = id; motors.stowed = false; saveMotors();
  applyCar(kestrel, id, motors.paint[id]); placeCarAt(DEAL_SPOT); rebuildGarage();
  sfx.pickup();
  dialog(WHO_SELL, `${c.name} 是你的了，車已經停在門口。` + (prev !== id ? `原本那台 ${CARS[prev].name}，我們會幫你送回 GARAGE 07。` : ''), [
    { t: '馬上開走', fn: () => { closeDialog(); exitVenue(() => { enterVehicle(kestrel); camState.yaw = kestrel.yaw; }); } },
    { t: '再逛一下', fn: closeDialog },
  ]);
}
function testDrive(id) {
  closeDialog();
  motors.test = { id, t: 60, live: false, prev: { id: kestrel.carId, paint: kestrel.paint, x: kestrel.x, z: kestrel.z, yaw: kestrel.yaw, stowed: motors.stowed } };
  motors.stowed = false;
  applyCar(kestrel, id); placeCarAt(DEAL_SPOT);
  exitVenue(() => { enterVehicle(kestrel); camState.yaw = kestrel.yaw; toast(`試駕 ${CARS[id].name}：60 秒，別撞壞`); });
}
function endTest(msg) {
  const tst = motors.test; motors.test = null;
  if (player.mode === 'drive' && player.veh === kestrel) exitVehicle();
  const p = tst.prev;
  applyCar(kestrel, p.id, p.paint);
  kestrel.x = p.x; kestrel.z = p.z; kestrel.yaw = p.yaw; kestrel.vx = kestrel.vz = 0; kestrel.y = p.x < 9000 ? groundH(p.x, p.z) : 0; rollClear(kestrel);
  motors.stowed = p.stowed; kestrel.g.visible = !p.stowed;
  poseVehicle(kestrel);
  toast(msg || '試駕結束，車行派人把車開回去了');
}
function talkSeller() {
  const n = motors.owned.length - 1;
  dialog(WHO_SELL, n ? `又見面了。你車庫裡已經有 ${n} 台我們的車，要不要湊滿一整排？` : '歡迎光臨。每一台都可以先試駕一分鐘，看上哪台跟我說。', [
    { t: '錢要怎麼賺？', fn: () => dialog(WHO_SELL, '這座城的有錢人都靠兩件事：甩尾跟人情。在街上拉手煞甩出一段漂亮的側滑，觀眾會打賞；幫 LAZARUS 那邊的人一個忙，也不會讓你白跑。', [{ t: '知道了', fn: closeDialog }]) },
    { t: '舊車可以收嗎？', fn: () => dialog(WHO_SELL, `可以，開回你的 GARAGE 07，在車旁跟我們聯絡，用牌價六成收。那台 AE86 除外，豆腐店的車我們不敢收。`, [{ t: '好', fn: closeDialog }]) },
    { t: '隨便看看', fn: closeDialog },
  ]);
}
function bayDialog(id) {
  const c = CARS[id];
  const opts = [{ t: '開出去', fn: () => driveOut(id) }];
  if (id !== STARTER) opts.push({ t: `賣回車行（${money(sellPrice(id))}）`, fn: () => dialog('GARAGE 07', `把 ${c.name} 用 ${money(sellPrice(id))} 賣回 VELOCE MOTORS？`, [{ t: '賣', fn: () => sellCar(id) }, { t: '不賣了', fn: closeDialog }]) });
  opts.push({ t: '離開', fn: closeDialog });
  dialog(`${c.name} · ${c.cls}`, `${c.tag}\n${carStats(id)}` + (c.credit ? `\n${c.credit}` : ''), opts);
}
function driveOut(id) {
  closeDialog();
  motors.cur = id; motors.stowed = false; saveMotors();
  exitVenue(() => {
    applyCar(kestrel, id, motors.paint[id]); placeCarAt(HOME_SPOT); rebuildGarage();
    enterVehicle(kestrel); camState.yaw = kestrel.yaw;
    toast(`${CARS[id].name} 開出車庫`);
  });
}
function sellCar(id) {
  if (id === STARTER || !motors.owned.includes(id) || (id === motors.cur && !motors.stowed)) return closeDialog();
  const v = sellPrice(id);
  motors.owned = motors.owned.filter(o => o !== id);
  if (motors.cur === id) { motors.cur = STARTER; applyCar(kestrel, STARTER, motors.paint[STARTER]); }
  delete motors.paint[id]; delete motors.mods[id];   // 改裝套件跟著車走（66-chrome.js）
  closeDialog(); rebuildGarage(); earn(v, `賣掉 ${CARS[id].name}`); sfx.click();
}
function stowCar() {
  const v = kestrel;
  exitVehicle();
  motors.stowed = true; saveMotors();
  v.g.visible = false; v.x = v.z = 9999; poseVehicle(v);
  rebuildGarage();
  enterVenue('home');
}
// 搶來或騎走的街頭車（26-glb.js 的 street）：開到門口停下按 E 就收進車庫，變成自己的車（烤漆照搬；街上那台收掉，68-gta.js 的 dropVehicle）
const streetId = v => v !== kestrel && !v.dead && (v.carId ? CARS[v.carId].street && v.carId : TYPES[v.type] && TYPES[v.type].street && v.type);   // 還沒換成實車的（以檔案開啟）用車流車型
function stowStreet() {
  const v = player.veh, id = streetId(v), palI = v.ins ? v.ins.array[2] : 0, paint = v.carId ? v.paint : CARS[id].paintable && palI ? PAL_HEX[palI - 1] : null;
  if (motors.owned.includes(id)) return toast(`車庫裡已經有一台 ${CARS[id].name}`);
  exitVehicle();
  motors.owned.push(id); if (Number.isInteger(paint)) motors.paint[id] = paint;
  saveMotors();
  dropVehicle(v);
  rebuildGarage();
  enterVenue('home');
  toast(`${CARS[id].name} 收進 GARAGE 07`);
}

// ─── 互動提示 ───
ctxHooks.push((p, near) => {
  if (p.mode === 'drive') {
    const v = p.veh;
    if (v === kestrel && !motors.test && Math.hypot(v.x - HOME_SPOT.x, v.z - HOME_SPOT.z) < 6 && Math.hypot(v.vx, v.vz) < 2) return { key: 'E', text: '停進車庫 <i>· GARAGE 07</i>', fn: stowCar };
    if (streetId(v) && Math.hypot(v.x - HOME_SPOT.x, v.z - HOME_SPOT.z) < 6 && Math.hypot(v.vx, v.vz) < 2) return { key: 'E', text: `收進車庫 <i>· ${CARS[streetId(v)].name}</i>`, fn: stowStreet };
    return null;
  }
  if (p.where === 'out') {
    if (near(DEAL_X, DEAL_Z + .6, 1.7)) return { key: 'E', text: '進入 VELOCE MOTORS', fn: () => enterVenue('show') };
    if (near(HOME_X, HOME_Z - .6, 2.2)) return { key: 'E', text: '打開車庫 <i>· GARAGE 07</i>', fn: () => { rebuildGarage(); enterVenue('home'); } };
  } else if (p.where === 'show') {
    const lv = VENUES.show.lv || 0;   // 64-showroom.js：三層樓，只看這一層的車
    if (!lv && near(0, .6, 1.5)) return { key: 'E', text: '回到街上', fn: () => exitVenue() };
    if (near(SV_LIFT.x, SV_LIFT.z, 1.8)) return { key: 'E', text: `搭電梯 <i>· 現在 ${lv + 1}F</i>`, fn: showLift };
    if (!lv && near(SELLER.x, SELLER.z - 2.3, 1.7)) return { key: 'E', text: '跟業務 Vale 說話', fn: talkSeller };
    let best = null, bd = 3.8;
    for (const c of show.cars) { if (c.lv !== lv) continue; const d = Math.hypot(p.x - c.x, p.z - c.z); if (d < bd) { bd = d; best = c; } }
    if (best) return { key: 'E', text: `看車 <i>· ${CARS[best.id].name} · ${money(CARS[best.id].price)}</i>`, fn: () => carDialog(best.id) };
  } else if (p.where === 'home') {
    if (near(0, .6, 1.5)) return { key: 'E', text: '回到街上', fn: () => exitVenue() };
    let best = null, bd = 3.4;
    for (const c of home.bayCars) { const d = Math.hypot(p.x - c.x, p.z - c.z); if (d < bd) { bd = d; best = c; } }
    if (best) return { key: 'E', text: `${CARS[best.id].name} <i>· 開出去或賣掉</i>`, fn: () => bayDialog(best.id) };
  }
  return null;
});

// ─── 每幀：轉盤、試駕倒數 ───
function updateMotors(dt, t) {
  if (glbWait.length && (player.where === 'show' || player.where === 'home' || player.where === 'casino')) glbWake(VENUES[player.where].scene);   // casino：轉台上的頭獎車（69-v7-casino.js）
  else if (glbWait.length && player.where === 'out' && Math.hypot(player.x - VENUES.show.door.x, player.z - VENUES.show.door.z) < 90) glbWake(scene);   // 車行門口的展示車
  // 這一批實車模型的下載進度
  const f = glbBatchFrac(), dl = $('dl');
  if (f == null) { dl.classList.remove('on'); hudCache.dl = -1; }
  else {
    const n = Math.floor(f * 100);
    if (hudCache.dl !== n) { hudCache.dl = n; $('dlPct').textContent = n + '%'; dl.style.setProperty('--p', n + '%'); dl.setAttribute('aria-valuenow', n); }
    dl.classList.add('on');
  }
  updateShow(dt, t);   // 64-showroom.js：轉台、電梯車廂、離開時回到一樓
  const tst = motors.test;
  if (tst) {
    if (!tst.live) { if (player.mode === 'drive' && player.veh === kestrel) tst.live = true; }
    else if (player.mode !== 'drive' || player.veh !== kestrel) endTest();
    else { tst.t -= dt; if (tst.t <= 0) endTest('試駕時間到，車行派人把車開回去了'); }
  }
}
// 甩尾賺錢：側滑夠大、速度夠快才算，越久倍率越高，撞到就歸零；試駕的車不算
const drift = { t: 0, pts: 0, cool: 0 };
function driftTick(dt, v, imp, kmh) {
  if (!v.isCar || motors.test) { drift.t = drift.pts = 0; return; }
  if (imp > 6 && drift.t > 0) { drift.t = drift.pts = 0; drift.cool = 0; toast('撞到了，這段甩尾不算'); return; }
  if (v.slip > 1 && kmh > 25) {
    drift.t += dt; drift.cool = .5;
    const mult = 1 + Math.min(drift.t, 6) * .3;
    drift.pts += v.slip * kmh * dt * 3 * mult;
    if (drift.t > .6) toast(`甩尾 ×${mult.toFixed(1)}　${money(drift.pts)}`);
  } else if (drift.t > 0) {
    drift.cool -= dt;
    if (drift.cool <= 0) { const n = Math.round(drift.pts / 10) * 10; if (drift.t > .8 && n > 0) earn(n, '甩尾打賞'); drift.t = drift.pts = 0; }
  }
}
