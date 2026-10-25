// ═══ 第七部曲：北嶺地堡、霓虹堡軍事基地與 Mk II 武器（使用者提供的 neon_nightcity_gta_v_1.md 第三節）═══
// 地堡：灰石國宅北端 (16,0) 的街區（霓虹堡 (15,0) 的隔壁），北嶺山腳下一座長草的土丘，南面是開得進去的防爆門（開車停到門口按 E；走路也能進）。
//   裡面分三區：A 製造（CNC 機台、輸送帶、成品木箱）、B 研究（實驗桌與螢幕）、C Mk II 工作台（武器架）。
//   物資 S ∈ [0, 100]：管理電腦 $75,000 買物資（3 分鐘後補滿）或出補給任務 +40：
//     攔截軍火列車（北嶺鐵道橋上，打斷最後一節車廂的掛鉤，貨箱掉在橋面上）、搶錨灣港幫派的化學品卡車、從霓虹堡偷一台坦克。
//   消耗 0.15／秒；庫存 += α × $2,100 × dt（上限 $1,050,000）；研究 += (1 − α) × 0.45% × dt；α ∈ {0, 0.5, 1}（全力生產／平衡／全力研究在電腦選）。
//   出貨：開地堡軍火卡車送到買家；送到冠石金融區（市中心）的買家 ×1.5（庫存滿 $1,575,000）。
// Mk II（工作台升級手槍、衝鋒槍、突擊步槍與狙擊槍，B 鍵切換彈種，各彈種有自己的發數，打完退回普通彈）：
//   爆裂彈（黃，40 發，R = 4.5 m、衝量 J = 28000 N·s，直升機與警車一發報銷）、燃燒彈（橘，120 發，必定點燃，中彈的人丟下武器打滾 6 秒、每秒 −18 HP）、
//   穿甲彈（深藍，240 發，無視護甲）、全金屬被甲彈（洋紅，240 發，打穿防彈玻璃，打引擎與尾旋翼 ×2.5）、空尖彈（綠，180 發，打沒護甲的 ×1.65、把人打退）。
//   燃燒彈與空尖彈一開始就能買，爆裂彈、穿甲彈、全金屬被甲彈與熱成像瞄準鏡要研究解鎖（研究依序解鎖，每項 100%）。
//   重型狙擊槍 Mk II 的熱成像瞄準鏡：開鏡時按 E 切換（70-render.js 的熱源層：深藍紫背景，人與熱引擎發橘白光，看穿煙、樹葉與薄牆）。
// 霓虹堡（Fort Neon，灰石國宅北端 (15,0) 的整個街區）：鐵絲網圍牆、機棚、塔台、停機坪的武裝直升機、坦克；走進圍牆裡直接 4 星。
// 存檔在 motors.v7.bunker（nc260.motors 第 12 版）。排在 69-v6-customs 之後、69-v7-casino 之前：頂層不能用 keys、camState、post（函式裡可以）。

// 第七部曲共用的畫面效果（70-render.js 的合成 pass 讀 uFx7）：therm 熱成像、gas 神經毒氣、blur 宿醉模糊、nv 夜視鏡
const V7FX = { therm: 0, gas: 0, blur: 0, nv: 0 };
// 熱成像的熱源：人（軀幹）與引擎（世界座標 x, y, z, 半徑 m, 強度）；70-render.js 投影到畫面上，不做深度測試（看穿牆與樹葉）
function heatPts(cx, cz, out, max) {
  let n = 0;
  const add = (x, y, z, r, k) => { if (n >= max || Math.hypot(x - cx, z - cz) > 260) return; out[n * 5] = x; out[n * 5 + 1] = y; out[n * 5 + 2] = z; out[n * 5 + 3] = r; out[n * 5 + 4] = k; n++; };
  for (const c of W.cops) if (c.on) add(c.x, (c.y || 0) + 1.1, c.z, .55, c.state === 'down' ? .5 : 1);
  for (const f of SQ.f) if (f.on) add(f.x, (f.y || 0) + 1.1, f.z, .55, f.state === 'down' ? .5 : 1);
  for (let k = 0; k < PED_N; k++) { const p = peds.people[k]; add(p.x, (p.y || 0) + 1.1, p.z, .55, pedState[k] && pedState[k].down > 0 ? .5 : .9); }
  for (const v of vehicles) if (!v.dead && v.g.visible && v !== player.veh) add(v.x + Math.sin(v.yaw) * 1.2, (v.y || 0) + .8, v.z + Math.cos(v.yaw) * 1.2, .9, Math.min(1, .4 + Math.hypot(v.vx, v.vz) / 20));
  for (const c of traffic) add(c.x, .8, c.z, .9, .8);
  return n;
}
const V7B = { buyT: 0, sup: null, sell: null, parked: null, burn: [], fortT: 0, therm: false, crates: null, saveT: 0 };
const SUP_COST = 75000, SUP_FILL = 180, SUP_MISSION = 40, SUP_USE = .15, STOCK_RATE = 2100, STOCK_CAP = 1050000, RES_RATE = .45, CITY_K = 1.5;
const BUNKER_PRICE = 1150000, ALPHAS = [[1, '全力生產'], [.5, '生產與研究各半'], [0, '全力研究']];
const MK_ARMS = { pistol: 25000, smg: 40000, rifle: 60000, sniper: 95000 }, MK_DMG = 1.15;
const AMMO7 = [
  { id: 'exp', name: '爆裂彈', col: '#ffd23a', n: 40, price: 12000, lock: 1, R: 4.5, J: 28000 },
  { id: 'inc', name: '燃燒彈', col: '#ff8a2a', n: 120, price: 6000, lock: 0, burn: 6, dps: 18 },
  { id: 'ap', name: '穿甲彈', col: '#3a5aff', n: 240, price: 7000, lock: 1 },
  { id: 'fmj', name: '全金屬被甲彈', col: '#ff3ad0', n: 240, price: 7000, lock: 1, veh: 2.5 },
  { id: 'hp', name: '空尖彈', col: '#40e070', n: 180, price: 5000, lock: 0, soft: 1.65 },
];
const AMMO = Object.fromEntries(AMMO7.map(a => [a.id, a]));
const RESEARCH = [['exp', '爆裂彈'], ['ap', '穿甲彈'], ['fmj', '全金屬被甲彈'], ['thermal', '熱成像瞄準鏡']];
ENV.bunker = { lampOn: 0, wet: 0, fogDen: .008, fog: 0x2a2c2a, fogHi: 0x343630, top: 0x9aa098, bot: 0x3a3c38, post: { exp: 1.02, thr: 1.8, bloom: .35, knee: 1.0, range: .85 } };
motors.v7 ||= {};
{
  const b = motors.v7.bunker && typeof motors.v7.bunker === 'object' ? motors.v7.bunker : {};
  b.S = clamp(+b.S || 0, 0, 100); b.stock = clamp(+b.stock || 0, 0, STOCK_CAP); b.res = clamp(+b.res || 0, 0, 100);
  b.ri = clamp(Math.floor(+b.ri) || 0, 0, RESEARCH.length); b.alpha = [0, .5, 1].includes(b.alpha) ? b.alpha : 1; b.buyT = Math.max(0, +b.buyT || 0);
  const mk = b.mk && typeof b.mk === 'object' ? b.mk : {}; b.mk = Object.fromEntries(Object.keys(MK_ARMS).map(id => [id, mk[id] ? 1 : 0]));
  const rn = b.rounds && typeof b.rounds === 'object' ? b.rounds : {}; b.rounds = Object.fromEntries(AMMO7.map(a => [a.id, clamp(Math.floor(+rn[a.id]) || 0, 0, a.n * 4)]));
  const se = b.sel && typeof b.sel === 'object' ? b.sel : {}; b.sel = Object.fromEntries(Object.keys(MK_ARMS).map(id => [id, AMMO[se[id]] ? se[id] : '']));
  motors.v7.bunker = b;
}
const v7BS = () => motors.v7.bunker;
const bunkerOwned = () => estOwned('bunker');
const resUnl = id => id === 'inc' || id === 'hp' || RESEARCH.findIndex(r => r[0] === id) < v7BS().ri;
function bunkerTick(dt) {
  const B = v7BS();
  if (!bunkerOwned()) return;
  if (B.buyT > 0) { const k = Math.min(dt, B.buyT); B.S = Math.min(100, B.S + 100 * k / SUP_FILL); B.buyT -= k; }
  if (B.S <= 0) return;
  const use = Math.min(B.S, SUP_USE * dt), k = use / (SUP_USE * dt);
  B.S -= use;
  B.stock = Math.min(STOCK_CAP, B.stock + B.alpha * STOCK_RATE * dt * k);
  if (B.ri < RESEARCH.length) {
    B.res += (1 - B.alpha) * RES_RATE * dt * k;
    if (B.res >= 100) { B.res = 0; const [, n] = RESEARCH[B.ri++]; if (started) v7Sms('地堡研究員', `研究完成：${n}。到 Mk II 工作台看看。`); }
  }
}
{
  const sec = Math.min(86400, Math.max(0, (Date.now() - (+lastTs || Date.now())) / 1000));
  if (sec > 60 && bunkerOwned()) for (let t = 0; t < sec; t += 60) bunkerTick(Math.min(60, sec - t));
}

// ═══ 霓虹堡軍事基地（FAC.fort）═══
const FORT = { on: false };
if (FAC.fort) {
  // k：一直留著的（機棚地上的黃框、停機坪）；f：程式替身，以 http(s) 開啟時換成 tools/props.mjs 的 fort 組（Sketchfab 模型），碰撞照舊
  const F = FAC.fort, k = new Kit(), f = new Kit(), X = x => F.ax + x, Z = z => F.az + z, zn = facZn(F), M = FORT.lists = {};
  const put = (id, x, z, ry = 0, o = {}) => (M[id] || (M[id] = [])).push({ x: X(x), z: Z(z), ry, zn, ...o });
  FORT.on = true; FORT.F = F;
  // 圍牆：鐵絲網（上面一排刺絲），南面中間是大門（x 30–38）；模型每片 4.15 m，照每段的長度均分、沿 x 縮放
  const fence = (x0, x1, z0, z1) => {
    f.box(X((x0 + x1) / 2), 1.6, Z((z0 + z1) / 2), Math.max(.08, x1 - x0), 3.2, Math.max(.08, z1 - z0), 0x8a9098, 15); v5Box(F, x0, x1, z0, z1);
    const alongX = x1 - x0 > z1 - z0, L = alongX ? x1 - x0 : z1 - z0, n = Math.ceil(L / 4.15);
    for (let i = 0; i < n; i++) { const t = (i + .5) / n; put('fence', alongX ? x0 + L * t : (x0 + x1) / 2, alongX ? (z0 + z1) / 2 : z0 + L * t, alongX ? 0 : Math.PI / 2, { sx: L / n / 4.15 }); }
  };
  fence(12.5, 12.7, 12.5, 49.5); fence(59.3, 59.5, 12.5, 49.5); fence(12.5, 59.5, 12.5, 12.7); fence(12.5, 30, 49.3, 49.5); fence(38, 59.5, 49.3, 49.5);
  for (let x = 13; x < 59.5; x += 3) for (const z of [12.6, 49.4]) if (z < 40 || x < 30 || x > 38) f.box(X(x), 3.35, Z(z), .06, .3, .06, 0x5a5e62, 15);
  f.box(X(12.6), 3.3, Z(31), .3, .2, 37, 0x5a5e62, 15).box(X(59.4), 3.3, Z(31), .3, .2, 37, 0x5a5e62, 15);
  // 大門：崗亭、兩支對開的柵欄桿、混凝土護欄（v5works 的紐澤西護欄）、門內兩道沙包牆
  f.box(X(28.6), 1.4, Z(47.6), 2.4, 2.8, 2.4, 0x6a7058, 2).box(X(28.6), 2.9, Z(47.6), 2.8, .2, 2.8, 0x3a3e34, 2).box(X(28.6), 1.7, Z(48.82), 2, .9, .04, 0x8ab0c8, 1);
  v5Box(F, 27.3, 29.9, 46.3, 48.9); put('booth', 28.6, 47.6, 0);
  f.box(X(34), 1.1, Z(49.2), 8, .12, .12, 0xd02020, 2);
  put('boom', 32.1, 49.2, Math.PI / 2); put('boom', 35.9, 49.2, -Math.PI / 2);
  for (const x of [30.4, 37.6]) { f.box(X(x), .45, Z(51.4), .7, .9, 3.8, 0xb0aca0, 2); v5Box(F, x - .35, x + .35, 49.5, 53.3); put('jersey', x, 51.4, 0); }   // 模型長邊沿 z
  for (const [x, z, ry] of [[22, 45.5, 0], [44, 45.5, 0], [19.4, 22.6, 0]]) { f.box(X(x), .5, Z(z), 4.6, 1, .74, 0x8a7a58, 2); v5Box(F, x - 2.3, x + 2.3, z - .37, z + .37, { hy: 1 }); put('sandbag', x, z, ry); }
  // 機棚：半圓拱棚（16 × 25 m、高 9.5 m），南北兩端敞開，坦克從南面開出去；碰撞只有兩側的拱腳
  for (const s of [-1, 1]) f.box(X(48 + s * 7.7), 2.4, Z(26.5), .4, 4.8, 25, 0x5a6050, 2);
  for (const [y, w] of [[5.2, 15], [7.8, 11.6], [9.3, 6]]) f.box(X(48), y, Z(26.5), w, .3, 25, 0x4a5044, 2);
  k.box(X(48), .03, Z(26), 12, .02, 10, 0xffd23a, 11);
  v5Box(F, 40, 40.8, 14, 39, { hy: 6 }); v5Box(F, 55.2, 56, 14, 39, { hy: 6 });
  for (const z of [14, 38.6]) { v5Box(F, 40.8, 44.4, z, z + .4, { hy: 8 }); v5Box(F, 51.6, 55.2, z, z + .4, { hy: 8 }); }   // 兩端的端牆（中間 7 m 寬的門洞）
  put('hangar', 48, 26.5, 0);
  // 塔台：鋼架崗哨塔（12 m，樓梯在東側）；碰撞是四支塔腳
  f.box(X(16.5), 5.5, Z(16.5), 3.6, 11, 3.6, 0x8a8a7a, 2).box(X(16.5), 10.4, Z(16.5), 5, 2.4, 5, 0x3a5a6a, 1).box(X(16.5), 11.8, Z(16.5), 5.6, .4, 5.6, 0x2a2e2a, 2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const [cx, cz] = facW(F, 16.42 + sx * 1.9, 16.5 + sz * 1.9); circles.push({ x: cx, z: cz, r: .3, w: 1 }); }
  put('tower', 16.5, 16.5, 0);
  // 停機坪與油桶、彈藥箱堆（靠東牆，不擋坦克從機棚開到大門的路）
  v5Pad(F, 24, 36, 0, k);
  for (let i = 0; i < 6; i++) { const x = 54.6 + (i % 3) * .8, z = 46.2 + Math.floor(i / 3) * .8; f.cyl(X(x), .55, Z(z), .32, .32, 1.1, 12, 0x3a5a2a, 2); put('drum', x, z, i * 1.7); }
  for (let i = 0; i < 8; i++) { const z = 41.4 + (i % 4) * 1.55, y = Math.floor(i / 4) * .63; f.box(X(57.6), y + .31, Z(z), .93, .62, 1.5, 0x4a5a32, 2); put('crate', 57.6, z, Math.PI / 2, { y }); }
  v5Box(F, 54.2, 56.6, 45.8, 47.4); v5Box(F, 57.1, 58.1, 40.6, 47.4, { hy: 1.3 });
  // 探照燈：v5works 的拖車燈塔（替身是燈柱）
  for (const [x, z, ry] of [[14.5, 47.5, .8], [57.5, 38, -1.6], [58, 14.5, -2.4]]) { f.cyl(X(x), 2, Z(z), .12, .14, 4, 8, 0x5a5e62, 15).box(X(x), 4.1, Z(z), .6, .4, .6, 0xf0f0e0, 11); v5Light(F, x, 4, z, 0xf0f0d8, 26, 1.6); put('ltower', x, z, ry); }
  FORT.fb = cityAdd(new T.Mesh(f.build(), MAT.uber), zn);
  cityAdd(new T.Mesh(k.build(), MAT.uber), facZn(F));
  v5Put(F, v5Sign([['霓虹堡 FORT NEON', .4, '#f2f0e0', .36], ['軍事禁區 · 擅入者格殺勿論', .24, '#ff4a3a', .76]], 7, 1.7, { bg: '#2a3424', edge: '#d0c890', dim: 0xd8d8d8 }), 26.2, 2.4, 49.8, 0);
  V5.helis.push({ F, x: 24, z: 36, y: .1, yaw: Math.PI / 2, v: null, gone: 0 });   // 69-v5-civic.js 生成：武裝直升機（kind 不給就是 69-gunship 的砲艇）
  FORT.tankAt = { x: 48, z: 24, yaw: Math.PI };
}
// 霓虹堡的模型（tools/props.mjs 的 fort 組；紐澤西護欄與燈塔借 v5works 組）：兩組都下載好才換掉替身 FORT.fb
if (FORT.on && GLB_ON) Promise.all([loadProps('fort'), loadProps('v5works')]).then(([it, wk]) => {
  if (!it || !wk) return;
  const M = FORT.lists, R = 320;
  for (const id of ['fence', 'booth', 'boom', 'sandbag', 'hangar', 'tower', 'drum', 'crate']) {
    const ms = it[id] ? w2Inst(it[id], M[id], id === 'hangar' || id === 'tower' ? 0 : LY.NOREFL, R) : [];
    // 鐵絲網：貼圖縮小後鐵絲的 alpha 被平均掉，遠一點就整片不見；門檻壓低（26-glb.js 的 MASK_CUT）
    if (id === 'fence') for (const m of ms) { const o = m.material; m.material = new T.ShaderMaterial({ uniforms: o.uniforms, vertexShader: o.vertexShader, fragmentShader: o.fragmentShader, defines: { ...o.defines, MASK_CUT: '.12' }, side: o.side }); }
  }
  for (const o of M.jersey) { o.sx = .7 / wk.jersey.w; o.sy = .85 / wk.jersey.h; }   // 斷面壓成和碰撞一樣的 0.7 × 0.85 m
  w2Inst(wk.jersey, M.jersey, 0, R); w2Inst(wk.ltower, M.ltower, 0, R);
  w2Drop(FORT.fb); FORT.glb = 1;
}).catch(e => console.warn('fort', e));
function fortPad() { const F = FORT.F; if (!F) return { ...spotW(HOME_SPOT), y: 0 }; const [x, z] = facW(F, 21, 36); return { x, z, y: 0, yaw: Math.PI / 2 }; }
const inFort = (X, Z) => { if (!FORT.on) return false; const F = FORT.F, [x, z] = toL(X, Z, facZn(F)); return x > F.ax + 12.7 && x < F.ax + 59.3 && z > F.az + 12.7 && z < F.az + 49.3; };
function fortStep(dt) {
  if (!FORT.on || player.where !== 'out' || life.dead) return;
  if (FORT.tank === undefined && cityIsWorld) { FORT.tank = null; }
  // 坦克停在機棚裡：人離開 150 m 以上而且坦克不在了就補一台
  const [tx, tz] = facW(FORT.F, FORT.tankAt.x, FORT.tankAt.z), far = Math.hypot(pX() - tx, pZ() - tz);
  const T0 = FORT.tank;
  if ((!T0 || T0.dead || !vehicles.includes(T0)) && far > 150 && far < 900 && !(V7B.sup && V7B.sup.v === T0)) {
    const v = FORT.tank = buildVeh('tank', tx, tz, facY(FORT.F, FORT.tankAt.yaw), 0, 2, 0, 'fort'); v.name = '霓虹堡主力坦克'; v.y = 0; poseVehicle(v);
  }
  if (inFort(pX(), pZ())) { if ((V7B.fortT -= dt) <= 0 && W.stars < 4) { V7B.fortT = 20; wantedApi.set(4); toast('霓虹堡：「入侵者闖進軍事禁區！」 · 4 星'); } }
  else V7B.fortT = 0;
}

// ═══ 地堡入口（FAC.bunker）═══
const BUNK = { on: false };
if (FAC.bunker) {
  const F = FAC.bunker, k = new Kit(), X = x => F.ax + x, Z = z => F.az + z;
  BUNK.on = true; BUNK.F = F;
  // 長草的土丘（一層層往上收）與混凝土門框，門朝南
  for (let i = 0; i < 4; i++) k.box(X(36), .9 + i * 1.6, Z(26 - i * .6), 40 - i * 7, 1.8, 26 - i * 4.4, i % 2 ? 0x3a5a2a : 0x34522a, 2);
  v5Box(F, 16, 56, 13, 39, { hy: 6.4 });
  k.box(X(36), 3.4, Z(40), 14, 6.8, 2.4, 0x8a8a84, 2).box(X(36), 2.6, Z(41.25), 9.6, 5.2, .1, 0x2a2c2a, 15);
  for (let i = 0; i < 10; i++) k.box(X(31.6 + i * .98), 2.6, Z(41.32), .49, 5.1, .02, i % 2 ? 0x1a1a1a : 0xffc020, 11);   // 黃黑警示條
  k.box(X(36), 5.7, Z(41.4), 9, .25, .1, 0xff3a2a, 8);
  // 門框東段的人員門（裝飾，不開）：走近 300 m 內才下載 bunker.glb 的 bk_door，替身是一塊門板
  const kd = new Kit(); kd.box(0, 1.3, 0, 1.85, 2.6, .28, 0x8a8c88, 15).box(-.5, 1.25, .16, .5, .5, .06, 0x6a4a3a, 15);
  BUNK.pd = { x: 41.9, z: 41.35, fb: v5Put(F, new T.Mesh(kd.build(), MAT.uber), 41.9, 0, 41.35, 0), st: 0 };
  v5Box(F, 29, 43, 38.8, 41.3);
  k.box(X(36), .02, Z(45), 10, .02, 7, 0x3a3a38, 10);
  for (const x of [29.5, 42.5]) { k.box(X(x), .5, Z(44), .5, 1, .5, 0xffc020, 11); v5Box(F, x - .25, x + .25, 43.75, 44.25); }
  cityAdd(new T.Mesh(k.build(), MAT.uber), facZn(F));
  v5Put(F, v5Sign([['北嶺地堡', .44, '#e8e4d0', .38], ['NORTHRIDGE BUNKER · 私人產業', .22, '#c8b870', .76]], 5, 1.3, { bg: '#20241c', edge: '#8a8460' }), 45, 2.2, 41.4, 0);
  v5Light(F, 36, 6.4, 42, 0xffd8a0, 14, 1.4);
  BUNK.door = { x: X(36), z: Z(45) };
}
function estDoor(id) { return id === 'bunker' && BUNK.on ? bunkerDoorW() : null; }   // 69-phone.js 的天際置業：沒有保險箱的資產按了導航
const bunkerDoorW = () => { const [x, z] = facW(BUNK.F, 36, 45); return { x, z }; };
const bunkerPadW = () => { const [x, z] = facW(BUNK.F, 36, 47); return { x, z, yaw: facY(BUNK.F, 0) }; };

// ─── 地堡內部（場館 'bunker'）───
const bunkerScene = new T.Scene();
const bunk = { boxes: [], circles: [], lights: [] };
const BK_PC = { x: -2, z: 7 }, BK_BENCH = { x: 20, z: 21 }, BK_EXIT = { x: 0, z: 1.2 }, BK_RES = { x: 1, z: 20 };
const BK_CNC = [[-27, 8], [-21, 8], [-15, 8]], BK_MILL = [[-27, 20], [-21, 20]], BK_LATHE = [[-15.4, 20], [-11.6, 20]], BK_PDOOR = { x: 7 };
{
  const k = new Kit(), B = bunk.boxes;
  const wall = (x0, x1, z0, z1, h = 7, col = 0x5a5c58, mat = 2) => { k.box((x0 + x1) / 2, h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0, col, mat); B.push({ x0, x1, z0, z1 }); };
  k.box(0, -.05, 14, 64.4, .1, 28.4, 0x5a5c58, 10);
  for (let x = -30; x <= 30; x += 4) k.box(x, 7.05, 14, 2.2, .3, 28, 0x3a3c3a, 2);   // 天花板的拱肋
  k.box(0, 7.3, 14, 64.4, .2, 28.4, 0x2a2c2a, 2);
  wall(-32.4, -32, 0, 28); wall(32, 32.4, 0, 28); wall(-32.4, 32.4, 28, 28.4); wall(-32.4, -4.6, -.4, 0); wall(4.6, 32.4, -.4, 0);
  k.box(0, 3.4, -.3, 9.2, 6.8, .2, 0x2a2c2a, 15);
  for (let i = 0; i < 10; i++) k.box(-4.4 + i * .98, 3.2, -.18, .49, 6.4, .02, i % 2 ? 0x1a1a1a : 0xffc020, 11);
  for (let x = -28; x <= 28; x += 8) k.box(x, 6.8, 14, 6, .08, .4, 0xf0f4e8, 11);
  // 區域地線與招牌色帶
  for (const [x0, x1, c] of [[-31, -9, 0xffc020], [-7, 9, 0x40c8ff], [11, 31, 0xff4a3a]]) { k.box((x0 + x1) / 2, .015, 27, x1 - x0, .01, .3, c, 11); k.box((x0 + x1) / 2, 5.6, 27.85, x1 - x0, .5, .06, c, 11); }
  // A 製造：CNC 機台、輸送帶
  // 機台以 http(s) 開啟時換成 bunker.glb 的模型（bk_cnc 2.69 × 1.25 m、bk_mill 1.19 × 1.06 m、bk_lathe 車銑複合機 1.94 × 0.87 m，操作面朝 −z），程式建模是替身
  const kc = new Kit(), km = new Kit(), kl = new Kit();
  for (const [x, z] of BK_CNC) { kc.box(x, 1.3, z, 2.7, 2.6, 1.25, 0x6a7a80, 10).box(x, 1.5, z - .64, 1.4, .9, .04, 0x40c8ff, 1).box(x + 1, 2.7, z, .4, .2, .4, 0xff4020, 9); B.push({ x0: x - 1.35, x1: x + 1.35, z0: z - .63, z1: z + .63 }); }
  for (const [x, z] of BK_MILL) { km.box(x, .5, z, 1.1, 1, 1, 0x4a6a4a, 10).box(x, 1.5, z + .3, .4, 1.2, .4, 0x4a6a4a, 10).box(x, 1.7, z - .1, .5, .4, .5, 0xd0d4d8, 10); B.push({ x0: x - .6, x1: x + .6, z0: z - .55, z1: z + .55 }); }
  for (const [x, z] of BK_LATHE) { kl.box(x, .35, z, 1.9, .7, .7, 0xd8dcdc, 10).box(x - .65, 1.1, z + .1, .5, .8, .5, 0xd8dcdc, 10).box(x - .3, 1.42, z + .1, 1.3, .2, .5, 0xd8dcdc, 10).box(x - .85, 1.2, z + .15, .3, .5, .3, 0x1a1a1c, 15); B.push({ x0: x - .97, x1: x + .97, z0: z - .44, z1: z + .44 }); }
  // 南牆上（防爆門東邊）的人員門：bunker_door 模型，替身是一塊門板
  const kd = new Kit(); kd.box(BK_PDOOR.x, 1.3, .14, 1.85, 2.6, .28, 0x8a8c88, 15).box(BK_PDOOR.x - .5, 1.25, .3, .5, .5, .06, 0x6a4a3a, 15);
  B.push({ x0: BK_PDOOR.x - .92, x1: BK_PDOOR.x + .92, z0: 0, z1: .3 });
  for (const [kk, id, L] of [[kc, 'bk_cnc', BK_CNC], [km, 'bk_mill', BK_MILL], [kl, 'bk_lathe', BK_LATHE], [kd, 'bk_door', [[BK_PDOOR.x, .145]]]]) {
    const fb = new T.Mesh(kk.build(), MAT.uber); bunkerScene.add(fb);
    propSwap('bunker', fb, id, L.map(([x, z]) => ({ x, z })), bunkerScene, null, 'bunker');
  }
  k.box(-17, .55, 14, 18, .25, 1.2, 0x2a2c2e, 15).box(-17, .7, 14, 18, .04, 1, 0x1a1a1a, 2);
  B.push({ x0: -26, x1: -8, z0: 13.4, z1: 14.6 });
  // B 研究：實驗桌、螢幕牆
  for (const z of [16, 22]) { k.box(BK_RES.x, .46, z, 6, .92, 1.6, 0xd8dce0, 10); for (let i = 0; i < 3; i++) k.box(BK_RES.x - 2 + i * 2, 1.25, z - .3, .9, .6, .04, 0x40ff9a, 11); B.push({ x0: BK_RES.x - 3, x1: BK_RES.x + 3, z0: z - .8, z1: z + .8 }); }
  for (let i = 0; i < 6; i++) k.box(-4 + i * 1.6, 3.2, 27.9, 1.5, .9, .04, i % 2 ? 0x40c8ff : 0x30a0d0, 11);
  // 管理電腦
  k.box(BK_PC.x, .4, BK_PC.z, 2, .8, .9, 0x3a3c3e, 10).box(BK_PC.x, 1.05, BK_PC.z + .3, 1.1, .55, .04, 0x40c8ff, 11);
  B.push({ x0: BK_PC.x - 1, x1: BK_PC.x + 1, z0: BK_PC.z - .45, z1: BK_PC.z + .45 });
  // C Mk II 工作台與武器架
  k.box(BK_BENCH.x, .48, BK_BENCH.z, 4, .96, 1.4, 0x5a3a22, 10).box(BK_BENCH.x, 1.0, BK_BENCH.z, 1.6, .06, .14, 0x101012, 15);
  B.push({ x0: BK_BENCH.x - 2, x1: BK_BENCH.x + 2, z0: BK_BENCH.z - .7, z1: BK_BENCH.z + .7 });
  for (let i = 0; i < 8; i++) k.box(14 + i * 2.2, 2.2, 27.8, .14, 1.4, .1, 0x1a1a1c, 15).box(14 + i * 2.2, 1.4, 27.75, 1.6, .06, .2, 0x5a3a22, 10);
  for (const [x, z] of [[26, 8], [26, 14]]) { k.box(x, .9, z, 4, 1.8, 2, 0x4a5a32, 2); B.push({ x0: x - 2, x1: x + 2, z0: z - 1, z1: z + 1 }); }
  bunkerScene.add(new T.Mesh(k.build(), MAT.uber));
  bunk.lights.push({ x: -20, y: 6, z: 14, col: lin(0xffe0b0), r: 22, i: 1.3 }, { x: 0, y: 6, z: 14, col: lin(0xd8f0ff), r: 22, i: 1.2 }, { x: 20, y: 6, z: 14, col: lin(0xffe8d0), r: 22, i: 1.3 }, { x: 0, y: 4, z: 2, col: lin(0xffc020), r: 8, i: 1 });
  // 成品木箱：照庫存擺（每箱 $35,000）
  const kk = new Kit(); kk.box(0, .45, 0, 1.4, .9, 1, 0x4a5a32, 2).box(0, .91, 0, 1.42, .03, 1.02, 0x2a3220, 2);
  const m = V7B.crates = new T.InstancedMesh(kk.build(), MAT.uber, 30);
  for (let i = 0; i < 30; i++) { _o.position.set(-29 + (i % 6) * 1.6, Math.floor(i / 18) * .94, 24.5 - Math.floor((i % 18) / 6) * 1.2); _o.rotation.set(0, 0, 0); _o.scale.setScalar(1); _o.updateMatrix(); m.setMatrixAt(i, _o.matrix); }
  m.count = 0; m.computeBoundingSphere(); m.frustumCulled = false; bunkerScene.add(m);
  B.push({ x0: -30, x1: -20, z0: 21.4, z1: 25.2 });
}
// 地堡的人：技工與研究員
{
  const cr = crowd(5), rc = rng(1919);
  [[ANIM.interact, -27, 6.4, Math.PI], [ANIM.interact, -15, 6.4, Math.PI], [ANIM.interact, BK_RES.x - 1, 14.9, 0], [ANIM.cross, BK_RES.x + 2.2, 23.2, Math.PI], [ANIM.interact, BK_BENCH.x, BK_BENCH.z + 1.1, Math.PI]].forEach(([a, x, z, yaw], i) => {
    cr.look(i, { r: rc, glowI: 0 }); cr.anim(i, a, rc() * 10, 1, 0); cr.place(i, x, 0, z, yaw); bunk.circles.push({ x, z, r: .32 });
  });
  cr.flush(); bunkerScene.add(cr.mesh);
}
VENUES.bunker = { scene: bunkerScene, data: bunk, spawn: { x: 0, z: 3, yaw: 0 }, name: '北嶺地堡', toast: '北嶺地堡', dist: '灰石國宅 · 北嶺山腳', ceil: 6.6,
  door: BUNK.on ? bunkerDoorW() : WP(0, 0), out: BUNK.on ? { ...bunkerPadW(), z: bunkerPadW().z } : spotW(HOME_SPOT) };
function bunkerSync() { if (V7B.crates) V7B.crates.count = Math.min(30, Math.ceil(v7BS().stock / 35000)); }
function bunkerEnter(v) {
  if (!bunkerOwned()) return bunkerBuy();
  if (v) {
    if (v.fly || v.boat) return toast('防爆門開不進去這種東西');
    exitVehicle(); v.vx = v.vz = 0; v.g.visible = false; v.x = v.z = 9999; poseVehicle(v); V7B.parked = v;
  }
  enterVenue('bunker', () => { bunkerSync(); if (V7B.sup && V7B.sup.st === 'carry') bunkerSupDrop(); });
}
function bunkerExit() {
  exitVenue(() => {
    const v = V7B.parked; V7B.parked = null;
    if (!v || v.dead || !vehicles.includes(v)) return;
    const p = bunkerPadW(); v.x = p.x; v.z = p.z; v.yaw = p.yaw; v.vx = v.vz = v.yr = 0; v.y = groundH(v.x, v.z); v.g.visible = true; rollClear(v); poseVehicle(v);
    enterVehicle(v); camState.yaw = v.yaw;
  });
}
function bunkerBuy() {
  dialog('天際置業 · 待售', `北嶺地堡：防爆門、製造區、研究區與 Mk II 工作台，一口價 ${money(BUNKER_PRICE)}。\n買下之後：管理電腦買物資或出補給任務，選生產或研究；LAZARUS 的技術員也能做運動用品。`, [
    { t: motors.cash >= BUNKER_PRICE ? `買下（${money(BUNKER_PRICE)}）` : `錢不夠（還差 ${money(BUNKER_PRICE - motors.cash)}）`, fn: () => { closeDialog(); if (estBuy('bunker')) { sfx.pickup(); toast('北嶺地堡現在是你的了 · 開到防爆門前按 E'); } } },
    { t: '再說', fn: closeDialog },
  ]);
}

// ─── 管理電腦 ───
function bunkerPc() {
  const B = v7BS(), r = RESEARCH[B.ri];
  dialog('北嶺地堡 · 管理電腦', `物資 ${B.S.toFixed(0)}%${B.buyT > 0 ? `（運送中，${Math.ceil(B.buyT)} 秒補滿）` : ''} · 庫存 ${money(Math.floor(B.stock))}／${money(STOCK_CAP)}\n${r ? `研究：${r[1]} ${B.res.toFixed(1)}%` : '研究全部完成'} · 模式：${ALPHAS.find(a => a[0] === B.alpha)[1]}`, [
    { t: B.buyT > 0 ? '物資運送中' : `買物資（${money(SUP_COST)} · 3 分鐘補滿）`, fn: () => { closeDialog(); if (B.buyT > 0 || B.S >= 100) return toast(B.S >= 100 ? '物資是滿的' : '物資還在路上'); if (motors.cash < SUP_COST) { toast('錢不夠'); sfx.dry(); return; } motors.cash -= SUP_COST; B.buyT = SUP_FILL * (1 - B.S / 100); saveMotors(); sfx.pickup(); toast('物資卡車上路了，3 分鐘內補滿'); } },
    { t: `補給任務（+${SUP_MISSION}%）`, fn: () => { closeDialog(); bunkerSupMenu(); } },
    { t: '切換模式', fn: () => { closeDialog(); dialog('地堡模式', '物資分給生產還是研究？', [...ALPHAS.map(([a, n]) => ({ t: (a === B.alpha ? '● ' : '') + n, fn: () => { closeDialog(); B.alpha = a; saveMotors(); toast(`地堡：${n}`); } })), { t: '返回', fn: closeDialog }]); } },
    { t: B.stock >= 1 ? `出貨（本地 ${money(Math.floor(B.stock))} · 市中心 ${money(Math.floor(B.stock * CITY_K))}）` : '出貨（沒有庫存）', fn: () => { closeDialog(); if (B.stock >= 1) bunkerSellMenu(); } },
    { t: '離開', fn: closeDialog },
  ]);
}
function bunkerSupMenu() {
  const opts = [
    ...(RAIL ? [{ t: '攔截軍火列車 · 北嶺鐵道橋', fn: () => { closeDialog(); bunkerSupStart('train'); } }] : []),
    { t: '搶幫派的化學品卡車 · 錨灣港', fn: () => { closeDialog(); bunkerSupStart('port'); } },
    ...(FORT.on ? [{ t: '從霓虹堡偷一台坦克 · 4 星', fn: () => { closeDialog(); bunkerSupStart('fort'); } }] : []),
    { t: '算了', fn: closeDialog },
  ];
  dialog('補給任務', '把物資弄回地堡的防爆門前。', opts);
}
// ─── 補給任務 ───
function bunkerSupStart(kind) {
  if (!BUNK.on) return toast('地堡不在這座城裡');
  const why = side.act ? `${side.act.name}還沒結束` : W.stars ? '先甩掉警察' : heist.st !== 'off' && heist.st !== 'plan' ? '搶劫進行中' : '';
  if (why) return toast(why);
  const S = V7B.sup = { kind, st: 'go', t: 0, v: null, crate: null, dest: bunkerDoorW() };
  exitVenue(() => {
    if (kind === 'train') {
      const R = RAIL, [x, z] = R.at(R.len / 2), [X, Z] = toW(x, z, RAIL_ZN); S.goal = { x: X, z: Z };
      v7Sms('地堡研究員', '霓虹堡的軍火列車會經過北嶺鐵道橋。打斷最後一節車廂的掛鉤，貨箱會掉在橋面上。');
    } else if (kind === 'port') {
      S.ref = WP(avX(15) + 36, stZ(13) + 31);   // 錨灣港
      const nd = RN.nodes.reduce((b, n) => { const d = Math.hypot(n.x - S.ref.x, n.z - S.ref.z); return !b || d < b.d ? { n, d } : b; }, null).n, sp = rnLaneSpot(nd.x, nd.z, 8);
      const v = S.v = buildVeh('lct', sp.x, sp.z, sp.yaw, 0, 5, 2, 'sup'); v.name = '赤蠍幫化學品卡車'; v.y = groundH(v.x, v.z); poseVehicle(v);
      fRoom(3);
      for (let i = 0; i < 3; i++) { const a = i * 2.1, f = fSpawn('gang', v.x + Math.cos(a) * 4, v.z + Math.sin(a) * 4, a, { gun: i ? 'pistol' : 'smg' }); if (f) f.grp = 'sup'; }
      S.goal = { x: v.x, z: v.z };
      v7Sms('地堡研究員', `${GANG_NAME}在錨灣港有一台化學品卡車，旁邊有人看著。搶過來開回地堡。`);
    } else {
      const v = FORT.tank && !FORT.tank.dead && vehicles.includes(FORT.tank) ? FORT.tank : (FORT.tank = buildVeh('tank', ...facW(FORT.F, FORT.tankAt.x, FORT.tankAt.z), facY(FORT.F, FORT.tankAt.yaw), 0, 2, 0, 'fort'));
      v.name = '霓虹堡主力坦克'; poseVehicle(v); S.v = v; S.goal = { x: v.x, z: v.z };
      v7Sms('地堡研究員', '霓虹堡的機棚裡停著一台坦克。拆下來的零件夠我們用好一陣子。進去就是 4 星，動作快。');
    }
    gpsSet(S.goal.x, S.goal.z);
    sideStart(bunkerSupAct(S));
  });
}
function bunkerSupAct(S) {
  return {
    kind: 'bunkersup', name: '地堡補給', label: '<b>北嶺地堡</b> 補給',
    step(dt) {
      S.t += dt;
      const D = S.dest;
      if (S.kind === 'train') {
        const R = RAIL;
        // 軍火列車是 21-rail.js 的貨運編成：走近了就叫一班（電聯車還在跑就等它進洞）
        if (S.st === 'go' && Math.hypot(pX() - S.goal.x, pZ() - S.goal.z) < 260 && (R.state !== 'run' || R.kind !== 'frt')) { if (R.state !== 'run') railStart(1, 'frt'); else R.want = 'frt'; }
        if (S.st === 'go' && R.state === 'run' && R.kind === 'frt') { const [x, z] = R.at(R.s - R.dir * (R.trainL - 3)); S.tail = toW(x, z, RAIL_ZN); } else if (S.st === 'go') S.tail = null;
        if (S.st === 'crate' && player.mode === 'walk' && Math.hypot(pX() - S.crate.x, pZ() - S.crate.z) < 1.6) { S.st = 'carry'; S.crate.m.removeFromParent(); sfx.pickup(); toast('扛起軍火貨箱 · 送回北嶺地堡'); gpsSet(D.x, D.z); }
        if (S.st === 'carry' && Math.hypot(pX() - D.x, pZ() - D.z) < 14) return bunkerSupDone();
      } else {
        const v = S.v;
        if (!v || v.dead) return this.fail(S.kind === 'fort' ? '坦克被打爛了' : '卡車被炸了');
        if (player.veh === v && S.st === 'go') { S.st = 'drive'; gpsSet(D.x, D.z); toast('開回北嶺地堡的防爆門前'); }
        if (S.st === 'drive' && Math.hypot(v.x - D.x, v.z - D.z) < 14 && Math.hypot(v.vx, v.vz) < 3) return bunkerSupDone();
      }
    },
    hud() { return { text: S.kind === 'train' ? (S.st === 'go' ? '打斷軍火列車最後一節的掛鉤' : S.st === 'crate' ? '撿起掉在橋面上的貨箱' : '把貨箱送回北嶺地堡') : S.st === 'go' ? (S.kind === 'fort' ? '到霓虹堡的機棚偷坦克' : '搶下幫派的化學品卡車') : '開回北嶺地堡', bar: -1, num: `物資 ${Math.round(v7BS().S)}%` }; },
    mark() { const p = S.kind === 'train' ? (S.st === 'go' ? (S.tail ? { x: S.tail[0], z: S.tail[1] } : S.goal) : S.st === 'crate' ? S.crate : S.dest) : S.st === 'go' ? S.v : S.dest; return { name: '補給', x: p.x, y: 2.4, z: p.z, where: 'out' }; },
    fail(why) { toast(`補給失敗：${why}`); sideEnd(); bunkerSupClear(); },
    clear() { gpsClear(); },
  };
}
function bunkerSupDone() {
  const S = V7B.sup, B = v7BS();
  if (S.v && player.veh === S.v) exitVehicle();
  if (S.v && S.kind !== 'fort') heistVehGone(S.v);
  if (S.kind === 'fort' && S.v) { heistVehGone(S.v); FORT.tank = null; }
  sideEnd(); V7B.sup = null;
  B.S = Math.min(100, B.S + SUP_MISSION); saveMotors(); sfx.pickup();
  sideDone('補給完成', '物資卸進地堡了', [['物資', `+${SUP_MISSION}%`], ['現在', `${Math.round(B.S)}%`]], 0);
}
function bunkerSupDrop() { if (V7B.sup && V7B.sup.st === 'carry') bunkerSupDone(); }
function bunkerSupClear() {
  const S = V7B.sup; V7B.sup = null; if (!S) return;
  if (S.crate && S.crate.m) S.crate.m.removeFromParent();
  if (S.v && S.kind === 'port' && !S.v.dead && player.veh !== S.v) heistVehGone(S.v);
}
// 列車：打中最後一節車廂（69-combat.js 的 shoot 呼叫 v7Shot）
function bunkerTrainShot(R) {
  const S = V7B.sup; if (!S || S.kind !== 'train' || S.st !== 'go' || !S.tail || RAIL.state !== 'run' || RAIL.kind !== 'frt') return;
  if (!rayHitsCyl(R, S.tail[0], S.tail[1], RAIL.D, RAIL.D + 4.2, 2.2)) return;
  S.hits = (S.hits || 0) + 1; sparks(S.tail[0], RAIL.D + 1.2, S.tail[1], 8, 3);
  if (S.hits < 3) return;
  S.st = 'crate';
  const fl = RAIL.cars[RAIL.cars.length - 1], cg = fl.cargo && fl.cargo[0];   // 平車的車頭朝行進方向，cargo[0] 是最後面那一箱，藏起來、掉在橋面上
  if (cg) cg.visible = false;
  let m;
  if (cg && !cg.isMesh) { m = cg.clone(); m.visible = true; m.rotation.set(0, Math.random() * 6.28, 0); }
  else { const k = new Kit(); k.box(0, .45, 0, 1.4, .9, 1, 0x4a5a32, 2).box(0, .91, 0, 1.42, .03, 1.02, 0x2a3220, 2); m = new T.Mesh(k.build(), MAT.uber); }
  m.position.set(S.tail[0], RAIL.D, S.tail[1]); scene.add(m);
  S.crate = { x: S.tail[0], z: S.tail[1], m };
  sfx.impact(10); toast('掛鉤斷了！貨箱掉在橋面上');
}
// ─── 出貨 ───
function bunkerSellMenu() {
  const B = v7BS();
  dialog('地堡出貨', '開地堡的軍火卡車送到買家那裡；卡車被炸掉貨就沒了。', [
    { t: `本地買家（${money(Math.floor(B.stock))}）`, fn: () => { closeDialog(); bunkerSellStart(1); } },
    { t: `冠石金融區的買家（×${CITY_K} · ${money(Math.floor(B.stock * CITY_K))}）`, fn: () => { closeDialog(); bunkerSellStart(CITY_K); } },
    { t: '算了', fn: closeDialog },
  ]);
}
function bunkerSellStart(K) {
  if (!BUNK.on) return toast('地堡不在這座城裡');
  const why = side.act ? `${side.act.name}還沒結束` : W.stars ? '先甩掉警察' : heist.st !== 'off' && heist.st !== 'plan' ? '搶劫進行中' : '';
  if (why) return toast(why);
  const B = v7BS(), val = Math.floor(B.stock * K);
  exitVenue(() => {
    if (V7B.parked) { const v = V7B.parked, p = bunkerPadW(); V7B.parked = null; v.x = p.x - Math.cos(p.yaw) * 5; v.z = p.z + Math.sin(p.yaw) * 5; v.yaw = p.yaw; v.vx = v.vz = 0; v.y = groundH(v.x, v.z); v.g.visible = true; poseVehicle(v); }
    const p = bunkerPadW(), sp = rnLaneSpot(p.x, p.z, 6);
    const v = buildVeh('md84', sp.x, sp.z, sp.yaw, 0, 4, 0, 'sup'); v.name = '地堡軍火卡車'; v.hp *= 1.5; v.hpMax = v.hp; v.y = groundH(v.x, v.z); poseVehicle(v);
    enterVehicle(v); camState.yaw = v.yaw;
    let dest;
    if (K > 1) { const c = WP(avX(6) + 36, stZ(2) + 31), nd = RN.nodes.reduce((b, n) => { const d = Math.hypot(n.x - c.x, n.z - c.z); return !b || d < b.d ? { n, d } : b; }, null).n; dest = rnLaneSpot(nd.x, nd.z, 8); }
    else { const c = RN.nodes.filter(n => { const d = Math.hypot(n.x - v.x, n.z - v.z); return d > 350 && d < 750; }), nd = c[Math.floor(Math.random() * c.length)] || RN.nodes[0]; dest = rnLaneSpot(nd.x, nd.z, 8); }
    const stock0 = B.stock; B.stock = 0; saveMotors(); bunkerSync();
    const S = V7B.sell = { v, val, K, dest, t: 0, chased: false };
    gpsSet(dest.x, dest.z);
    sideStart({
      kind: 'bunkersell', name: '地堡出貨', label: '<b>北嶺地堡</b> 出貨',
      step(dt) {
        S.t += dt;
        if (!v || v.dead) return this.fail('軍火卡車被炸了，貨全沒了');
        if (player.veh !== v && Math.hypot(pX() - v.x, pZ() - v.z) > 80) return this.fail('把卡車丟下了');
        if (!S.chased && S.t > 15) { S.chased = true; gangChase('地堡的軍火', K > 1 ? 3 : 2); }
        if (Math.hypot(v.x - dest.x, v.z - dest.z) < 12 && Math.hypot(v.vx, v.vz) < 3) {
          if (player.veh === v) exitVehicle();
          sideEnd(); heistVehGone(v); V7B.sell = null;
          earn(val, K > 1 ? '地堡軍火 · 市中心買家' : '地堡軍火 · 本地買家');
          sideDone('出貨完成', K > 1 ? '冠石金融區的買家收下了整車軍火' : '本地買家收下了整車軍火', [['庫存', money(Math.floor(stock0))], ['倍率', `×${K}`], ['實拿', money(val)]], 2);
        }
      },
      hud() { const hp = v.hpMax ? v.hp / v.hpMax * 100 : 100; return { text: '把軍火送到買家那裡', bar: hp, num: money(val), low: hp < 30 }; },
      mark() { return { name: '買家', x: dest.x, y: 2.2, z: dest.z, where: 'out' }; },
      fail(why) { toast(`出貨失敗：${why}`); sideEnd(); if (v && !v.dead) heistVehGone(v); V7B.sell = null; },
      clear() { gpsClear(); },
    });
    toast(`地堡軍火卡車 · 送到買家那裡就拿 ${money(val)}`);
  });
}

// ═══ Mk II 工作台與特殊彈藥 ═══
function mkOf(id) { return !!(MK_ARMS[id] && v7BS().mk[id]); }
function mkAmmo(id) { const B = v7BS(), t = mkOf(id) && B.sel[id]; return t && B.rounds[t] > 0 && resUnl(t) ? AMMO[t] : null; }
function bunkerBench() {
  const B = v7BS(), opts = [];
  for (const [id, price] of Object.entries(MK_ARMS)) {
    if (!B.mk[id]) opts.push({ t: `升級 ${ARMS[id].name} Mk II（${money(price)}${id === 'sniper' ? ' · 重型狙擊槍，可裝熱成像' : ''}）`, fn: () => { closeDialog(); if (motors.cash < price) { toast('錢不夠'); sfx.dry(); return; } motors.cash -= price; B.mk[id] = 1; saveMotors(); sfx.reload(); toast(`${ARMS[id].name} Mk II · 傷害 ×${MK_DMG} · B 鍵切換彈種`); } });
  }
  opts.push({ t: '買特殊彈藥', fn: () => { closeDialog(); bunkerAmmo(); } });
  opts.push({ t: '離開', fn: closeDialog });
  const done = Object.keys(MK_ARMS).filter(id => B.mk[id]).map(id => ARMS[id].name);
  dialog('Mk II 工作台', `已升級：${done.length ? done.join('、') : '還沒有'} · 熱成像瞄準鏡 ${resUnl('thermal') ? (B.mk.sniper ? '已裝（狙擊開鏡按 E）' : '已解鎖（先升級狙擊槍）') : '要研究解鎖'}`, opts);
}
function bunkerAmmo() {
  const B = v7BS();
  dialog('Mk II 特殊彈藥', AMMO7.map(a => `${a.name} ${B.rounds[a.id]} 發${resUnl(a.id) ? '' : '（要研究解鎖）'}`).join(' · '), [
    ...AMMO7.map(a => ({ t: `${a.name} ×${a.n}（${money(a.price)}）${resUnl(a.id) ? '' : ' · 未解鎖'}`, fn: () => { closeDialog(); if (!resUnl(a.id)) return toast(`${a.name}要先在地堡研究`); if (motors.cash < a.price) { toast('錢不夠'); sfx.dry(); return; } motors.cash -= a.price; B.rounds[a.id] = Math.min(a.n * 4, B.rounds[a.id] + a.n); saveMotors(); sfx.reload(); toast(`${a.name} +${a.n} 發`); } })),
    { t: '返回', fn: () => { closeDialog(); bunkerBench(); } },
  ]);
}
// B：切換目前這把 Mk II 的彈種（普通 → 解鎖而且有子彈的特殊彈）
function mkCycle() {
  const id = arm.sel, B = v7BS();
  if (!mkOf(id)) { toast(MK_ARMS[id] ? `${ARMS[id].name}還不是 Mk II · 到北嶺地堡的工作台升級` : '這把槍沒有 Mk II'); return; }
  const list = ['', ...AMMO7.filter(a => resUnl(a.id) && B.rounds[a.id] > 0).map(a => a.id)];
  B.sel[id] = list[(list.indexOf(B.sel[id]) + 1) % list.length];
  sfx.reload(); toast(`${ARMS[id].name} Mk II · ${B.sel[id] ? `${AMMO[B.sel[id]].name}（${B.rounds[B.sel[id]]} 發）` : '普通彈'}`);
  saveMotors();
}
// 69-combat.js 的 shoot：戶外每一發都先問這裡；回傳 true 就不走原本的 hitWith
function mkHit(hit, R, A, id) {
  const am = mkAmmo(id), dmg = A.dmg * abil.out * (mkOf(id) ? MK_DMG : 1);
  if (!mkOf(id)) return false;
  if (!am) { hitWith(hit, R, dmg, 'player', A.head, A.stun); return true; }
  const B = v7BS(); B.rounds[am.id]--;
  if (B.rounds[am.id] <= 0) { B.sel[id] = ''; toast(`${am.name}打完了 · 換回普通彈`); }
  const x = R.ox + R.dx * hit.t, y = R.oy + R.dy * hit.t, z = R.oz + R.dz * hit.t, K = hit.kind;
  if (am.id === 'exp') {
    if (K === 'heli') { heliHit(1e6, true); }
    else if (K === 'veh' && hit.ref.police) explode(hit.ref);
    else if (K === 'car' && TYPES[hit.ref.type] && TYPES[hit.ref.type].police) { const v = damageCar(hit.ref, 1e6, true); if (v) explode(v); }
    else hitWith(hit, R, dmg, 'player', A.head, 0);
    blast(x, y, z, am.R, 140, 'player', null);
    if (K === 'veh' && !hit.ref.dead) { const v = hit.ref, m = v.mass || 1600; v.vx += R.dx * am.J / m; v.vz += R.dz * am.J / m; }
    return true;
  }
  if (am.id === 'inc') { hitWith(hit, R, dmg, 'player', A.head, 0); mkIgnite(hit, R, x, y, z); return true; }
  if (am.id === 'ap') { hitWith(hit, R, dmg * (K === 'cop' || K === 'fighter' ? 1.35 : 1.1), 'player', A.head, 0); return true; }
  if (am.id === 'fmj') {
    if (K === 'veh') { sparks(x, y, z, 6, 3); damageVeh(hit.ref, dmg * VEH_K * am.veh, true, true); return true; }
    if (K === 'car') { sparks(x, y, z, 6, 3); const v = damageCar(hit.ref, dmg * VEH_K * am.veh, true); if (v) damageVeh(v, 0, true); return true; }
    if (K === 'heli') { sparks(x, y, z, 8, 4); heliHit(dmg * am.veh, true); return true; }
    if (K === 'prop' || K === 'wall') {   // 打穿防彈玻璃與薄牆：在後面再打一次
      if (K === 'prop') hit.ref(x, y, z, dmg, R, true);
      const R2 = { ox: x + R.dx * .4, oy: y + R.dy * .4, oz: z + R.dz * .4, dx: R.dx, dy: R.dy, dz: R.dz }, h2 = castRay(R2, A.range * .5);
      if (h2.kind) hitWith(h2, R2, dmg * .8, 'player', A.head, 0);
      else hitWith(hit, R, dmg, 'player', A.head, 0);
      return true;
    }
    hitWith(hit, R, dmg, 'player', A.head, 0); return true;
  }
  if (am.id === 'hp') {
    const soft = K === 'ped' || K === 'extra' || (K === 'fighter' && hit.ref.team === 'gang');
    hitWith(hit, R, dmg * (soft ? am.soft : 1), 'player', A.head, 0);
    if (K === 'ped' && pedState[hit.ref] && !(pedState[hit.ref].down > 0)) knockPed(hit.ref, R.dx, R.dz);
    if (K === 'fighter') { hit.ref.kx = R.dx * 3; hit.ref.kz = R.dz * 3; }
    return true;
  }
  return false;
}
// 燃燒彈：中彈的人丟下武器打滾 6 秒，每秒 −18 HP
function mkIgnite(hit, R, x, y, z) {
  const K = hit.kind, A = AMMO.inc;
  chemIgnite(x, z, .8);
  if (K !== 'ped' && K !== 'cop' && K !== 'fighter') return;
  if (V7B.burn.some(b => b.ref === hit.ref && b.kind === K)) return;
  V7B.burn.push({ kind: K, ref: hit.ref, t: A.burn, dx: R.dx, dz: R.dz, tick: 0 });
  if (K === 'ped') stunPed(hit.ref, A.burn, R.dx, R.dz);
  else if (K === 'cop') stunCop(hit.ref, A.burn);
  else { hit.ref.stunT = A.burn; hit.ref.stunPh = -uTimeNow(); }
}
function mkBurnStep(dt) {
  for (let i = V7B.burn.length - 1; i >= 0; i--) {
    const b = V7B.burn[i]; b.t -= dt; b.tick += dt;
    const p = b.kind === 'ped' ? peds.people[b.ref] : b.ref, x = p.x, z = p.z, y = (p.y || 0) + .5;
    if (Math.random() < dt * 40) emit('fire', x + (Math.random() - .5) * .5, y, z + (Math.random() - .5) * .5, { vy: 1.4, max: .5, s0: .35, s1: .15, drag: 1 });
    if (b.tick >= .5) {
      b.tick -= .5; const n = AMMO.inc.dps * .5;
      if (b.kind === 'ped') hitPed(b.ref, n, b.dx, b.dz, true, x, y, z);
      else if (b.kind === 'cop') copHit(b.ref, n, b.dx, b.dz, true);
      else fHit(b.ref, n, b.dx, b.dz, true);
    }
    if (b.t <= 0 || (b.kind !== 'ped' && !b.ref.on)) V7B.burn.splice(i, 1);
  }
}
// 熱成像：重型狙擊槍 Mk II 開鏡時（70-render.js 讀 V7B.therm）
const thermOk = () => mkOf('sniper') && resUnl('thermal') && arm.sel === 'sniper' && gta.aiming;
function mkKey(code) {
  if (code === 'KeyB' && player.mode === 'walk' && ARMS[arm.sel].gun) { mkCycle(); return true; }
  if (code === 'KeyE' && thermOk()) { V7B.therm = !V7B.therm; sfx.click(); toast(V7B.therm ? '熱成像：開' : '熱成像：關'); return true; }
  return false;
}
// 彈種的小標示（右下角彈藥數旁）
{ const el = document.createElement('div'); el.id = 'v7mk'; $('hud').append(el); }
function mkHud() {
  const el = $('v7mk'), id = arm.sel, on = player.mode === 'walk' && mkOf(id);
  el.classList.toggle('on', on);
  if (!on) return;
  const am = mkAmmo(id), h = `${ARMS[id].name} Mk II · ${am ? `<b style="color:${am.col}">${am.name}</b> ${v7BS().rounds[am.id]}` : '普通彈'}${V7B.therm && thermOk() ? ' · <b style="color:#ffb060">熱成像</b>' : ''}`;
  if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
}

// ─── 互動與每幀 ───
ctxHooks.push((p, near) => {
  if (p.where === 'out' && BUNK.on) {
    const d = BUNK.door, pad = Math.hypot(p.x - toW(d.x, d.z)[0], p.z - toW(d.x, d.z)[1]);
    if (p.mode === 'drive' && pad < 7 && Math.hypot(p.veh.vx, p.veh.vz) < 3 && !(V7B.sup && p.veh === V7B.sup.v) && !(V7B.sell && p.veh === V7B.sell.v)) return { key: 'E', text: bunkerOwned() ? '開進北嶺地堡' : `北嶺地堡 <i>· 待售 ${money(BUNKER_PRICE)}</i>`, fn: () => bunkerEnter(p.veh) };
    if (p.mode === 'walk' && near(d.x, d.z - 2.4, 2.4)) return { key: 'E', text: bunkerOwned() ? '走進北嶺地堡' : `北嶺地堡 <i>· 待售 ${money(BUNKER_PRICE)}</i>`, fn: () => bunkerEnter(null) };
  }
  if (p.where !== 'bunker') return null;
  if (near(BK_EXIT.x, BK_EXIT.z, 1.8)) return { key: 'E', text: V7B.parked ? `開 ${V7B.parked.name} 出去` : '出去', fn: bunkerExit };
  if (near(BK_PC.x, BK_PC.z - .8, 1.4)) return { key: 'E', text: `管理電腦 <i>· 物資 ${Math.round(v7BS().S)}%</i>`, fn: bunkerPc };
  if (near(BK_BENCH.x, BK_BENCH.z - 1.2, 1.6)) return { key: 'E', text: 'Mk II 工作台', fn: bunkerBench };
  if (near(BK_RES.x, 19, 2)) { const B = v7BS(), r = RESEARCH[B.ri]; return { key: 'E', text: r ? `研究：${r[1]} <i>· ${B.res.toFixed(1)}%</i>` : '研究全部完成', fn: () => toast(r ? `研究員：「${r[1]}做到 ${B.res.toFixed(1)}%。物資多分一點給研究會快一些。」` : '研究員：「能做的都做完了。」') }; }
  return null;
});
function v7BunkerUpdate(dt) {
  bunkerTick(dt);
  const PD = BUNK.pd;
  if (PD && !PD.st && GLB_ON && player.where === 'out') {
    const [x, z] = facW(BUNK.F, PD.x, PD.z);
    if (Math.hypot(pX() - x, pZ() - z) < 300) {
      PD.st = 1;
      loadProps('bunker').then(items => { if (!items || !items.bk_door) return; PD.fb.visible = false; v5Put(BUNK.F, propObject(items.bk_door, 0, 0, 0), PD.x, 0, PD.z, 0); });
    }
  }
  fortStep(dt);
  mkBurnStep(dt);
  mkHud();
  if (V7B.therm && !thermOk()) V7B.therm = false;
  if (player.where === 'bunker') bunkerSync();
  if ((V7B.saveT += dt) > 15) { V7B.saveT = 0; if (bunkerOwned()) saveMotors(); }
}
function v7BunkerMini(ctx, P2, zoom) {
  if (!BUNK.on || !bunkerOwned()) return;
  const d = bunkerDoorW(), [x, y] = P2(d.x, d.z), s = 1 / zoom;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = '#c8b870'; ctx.fillRect(-5, -4, 10, 8); ctx.fillStyle = '#20241c'; ctx.fillRect(-3, -1, 6, 5); ctx.restore();
}
