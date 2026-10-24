// ═══ 第七部曲：霓鑽賭場酒店與金庫大劫案（使用者提供的 neon_nightcity_gta_v_1.md 第二節）═══
// 光環廣場 (8,4) 的 FAC.casino：西北、東北兩座塔樓與 2 層的裙樓。裙樓南面是大門與運鈔車卸貨口，屋頂是 RF 泳池與停機坪（東牆的鐵梯上去），
// 西邊人行道上有一個雨水下水道的鐵蓋（強攻路線從這裡炸開）。
// 1 樓（場館 'casino'）：禁止攜帶武器。幸運轉盤（20 格各 18°，一天一次）、展示台上的頭獎跑車、兌換櫃台（$1 = 1 籌碼）、
//   21 點、三張牌撲克、美式輪盤（0 與 00）、Inside Track 賽馬、吃角子老虎（最多押 2,500，三顆鑽石 1000 倍）。
//   大廳是 props/cas_hall.glb（Katydid 的 Gameready Casino scene，Sketchfab Standard），門口兩張輪盤桌與 B1 的三道金庫門是 props/casino.glb
//   （CC BY 4.0），都是走進 1 樓／B1 才下載；以檔案開啟或下載失敗時留著程式建模的替身（每種一個網格，propSwap 換掉時藏起來）。
// B1（場館 'casinoB'，只有搶劫時進得去）：保全室的雙讀卡機（1.5 秒內刷兩張）、雙門氣閘、主金庫（6 道指紋鎖／鋁熱劑柵門）、日間金庫、運鈔車卸貨口。
// 計畫板在 AFTERGLOW 後面的街機角落：三種路線（A 偽裝保全、B 屋頂垂降、C 下水道強攻）與隨機目標（現金／名畫／金條／鑽石）。
//   A：從卸貨口以保全身分進去，不拿槍指人、不開槍就沒人管你；金庫時限 150 秒。
//   B：停機坪的通風井垂降，EMP 讓整層停電 60 秒（夜視鏡），蹲著從背後按 E 無聲制伏警衛；攝影機或被發現的屍體會觸發警報，時限 135 秒。
//   C：炸開下水道或開重型車撞進去，重型護甲＋鋁熱劑燒柵門，一進去就是警報，時限 85 秒。
//   金庫時限從進金庫開始算；剩 15 秒紅燈閃、嗶嗶叫，歸零還在 B1 → 釋放神經毒氣（畫面發綠扭曲、每秒 −12 HP 無視護甲、出去就是 5 星而且鎖住）。
//   名畫一幅割 6 秒、其他一堆 4 秒；袋子裡金條佔一半以上 → 走路 ×0.68、不能翻越。
// 存檔在 motors.v7.casino（籌碼、轉盤日期、計畫）。排在 69-v7-bunker 之後、69-v7-club 之前：頂層不能用 keys、camState、post。

const CAS = { spin: null, race: null, slot: null, rl: null, h: null, emp: 0, lock5: 0, saveT: 0 };
const CAS_DAY = GAME_HOUR * 24, SLOT_MAX = 2500, WHEEL_N = 20, PODIUM = 'evija', CHIP_BUY = [1000, 10000, 100000];
const KEY_WIN = 1.5, MANT_T = 3, GAS_WARN = 15, GAS_DPS = 12, LOCK5_T = 90, EMP_T = 60, GOLD_K = .68, ART_T = 6, PILE_T = 4, FINGER_T = 3, THERM_T = 4;
const CAS_APPS = {
  A: { name: '偽裝保全', prep: 45000, time: 150, stars: 2, desc: '從運鈔車卸貨口以保全身分進去；別拿槍指人、別開槍' },
  B: { name: '屋頂垂降', prep: 35000, time: 135, stars: 3, desc: '停機坪的通風井垂降，EMP 停電 60 秒；蹲著從背後按 E 無聲制伏，攝影機與屍體會觸發警報' },
  C: { name: '下水道強攻', prep: 25000, time: 85, stars: 4, desc: '炸開下水道（或開重型車撞進去），重型護甲與鋁熱劑；一進去就是警報' },
};
const CAS_TGT = {
  cash: { name: '現金', val: 2115000, col: 0x5ac85a },
  art: { name: '名畫', val: 2350000, col: 0xc89a5a },
  gold: { name: '金條', val: 2585000, col: 0xffc830 },
  dia: { name: '鑽石', val: 3290000, col: 0x9ae8ff },
};
ENV.casino = { lampOn: 0, wet: 0, fogDen: .012, fog: 0x2a1c20, fogHi: 0x3a2a26, top: 0x8a6a52, bot: 0x3a2420, post: { exp: 1.05, thr: 1.6, bloom: .7, knee: 1.1, range: 1.1 } };
ENV.casinoB = { lampOn: 0, wet: 0, fogDen: .01, fog: 0x1c2024, fogHi: 0x24282c, top: 0x6a7480, bot: 0x2a2e34, post: { exp: 1.0, thr: 1.8, bloom: .4, knee: 1.0, range: .9 } };
{
  const c = motors.v7.casino && typeof motors.v7.casino === 'object' ? motors.v7.casino : {};
  c.chips = Math.max(0, Math.floor(+c.chips) || 0); c.wheel = +c.wheel || 0; c.won = +c.won || 0;
  c.tgt = CAS_TGT[c.tgt] ? c.tgt : ''; c.app = CAS_APPS[c.app] ? c.app : ''; c.done = Math.max(0, Math.floor(+c.done) || 0); c.daily = +c.daily || 0;
  motors.v7.casino = c;
}
const v7KS = () => motors.v7.casino;
const gameClock = () => Date.now() / 1000;   // 轉盤與日間金庫：遊戲日 = GAME_HOUR × 24 秒的真實時間

// ═══ 外觀（FAC.casino）═══
const CASX = { on: false };
if (FAC.casino) {
  const F = FAC.casino, Pd = F.L[2], k = new Kit(), X = x => F.ax + x, Z = z => F.az + z, hy = Pd.h;
  CASX.on = true; CASX.F = F; CASX.h = hy;
  // 大門雨遮與金色門框、旋轉門
  k.box(X(36), 4.6, Z(51.2), 16, .35, 3.4, 0x1a1418, 2).box(X(36), 4.38, Z(51.2), 15.6, .06, 3.2, 0xfff0c8, 11);
  for (const x of [28.6, 43.4]) k.cyl(X(x), 2.2, Z(52.6), .18, .18, 4.4, 12, 0xd8b048, 15);
  k.box(X(36), 2, Z(49.62), 6, 4, .1, 0x2a2018, 1).box(X(36), 4.1, Z(49.66), 6.4, .2, .12, 0xd8b048, 15);
  k.box(X(36), .02, Z(51.4), 8, .02, 4, 0x8a1424, 10);   // 紅地毯
  // 運鈔車卸貨口（東南角）：捲門、黃色防撞柱
  k.box(X(54), 2.2, Z(49.62), 5, 4.4, .1, 0x6a6e72, 3).box(X(54), 4.6, Z(49.66), 5.4, .3, .12, 0xffc020, 11);
  for (const x of [51.2, 56.8]) { k.cyl(X(x), .5, Z(50.6), .14, .14, 1, 10, 0xffc020, 11); v5Box(F, x - .15, x + .15, 50.45, 50.75); }
  // 屋頂：RF 泳池（池子當成實心，走不進去）、躺椅、停機坪、垂降用的通風井
  k.box(X(23), hy + .25, Z(40), 14.4, .5, 12.4, 0xe8e4dc, 10).box(X(23), hy + .45, Z(40), 13.6, .1, 11.6, 0x30c8e8, 11);
  for (let i = 0; i < 5; i++) k.box(X(17 + i * 3), hy + .25, Z(47.4), .8, .3, 1.9, 0xf0f0f0, 10);
  v5Pad(F, 48, 40, hy, k);
  k.box(X(40), hy + .7, Z(34), 2, 1.4, 2, 0x8a8e92, 15).box(X(40), hy + 1.45, Z(34), 2.2, .1, 2.2, 0x5a5e62, 15);
  v5Roof(F, Pd, [[X(15.8), X(30.2), Z(33.8), Z(46.2)], [X(39), X(41), Z(33), Z(35)]]);
  v5Ladder(F, 59.5, 44, 1, 0, hy, [57.6, 44], k);
  // 下水道的鐵蓋（西邊人行道）
  k.cyl(X(10.5), .03, Z(31), .9, .9, .05, 18, 0x2a2c2e, 15).box(X(10.5), .065, Z(31), 1.4, .02, .12, 0x1a1a1a, 15);
  // 塔樓頂的鑽石燈
  for (const [x, z, y] of [[21.25, 21.25, F.L[0].h], [50.75, 21.25, F.L[1].h]]) { k.add(new T.OctahedronGeometry(3.2, 0), 0x9ae8ff, 8, tf(X(x), y + 4, Z(z))); v5Light(F, x, y + 4, z, 0x9ae8ff, 40, 2.2); }
  cityAdd(new T.Mesh(k.build(), MAT.uber), facZn(F));
  v5Put(F, v5Sign([['NEON DIAMOND', .46, '#fff4d8', .4], ['霓鑽賭場酒店 · CASINO & RESORT', .2, '#e8c060', .78]], 16, 2.6, { bg: '#1a0c14', edge: '#e8c060', dim: 0xffffff }), 36, hy - 2.4, 49.72, 0);
  v5Put(F, v5Sign([['卸貨區 · 運鈔車專用', .34, '#1a1a1a', .5]], 4, .7, { bg: '#ffc020' }), 54, 5.2, 49.72, 0);
  v5Light(F, 36, 4, 52, 0xffe0a0, 16, 2); v5Light(F, 36, hy - 2.4, 51, 0xffd890, 18, 1.4); v5Light(F, 48, hy + 1, 40, 0xfff0c0, 12, .8);
}
const casW = (x, z) => { const [X, Z] = facW(CASX.F, x, z); return { x: X, z: Z }; };
const CAS_DOOR = { x: 36, z: 50.6 }, CAS_DOCK = { x: 54, z: 50.6 }, CAS_SEWER = { x: 10.5, z: 31 }, CAS_SHAFT = { x: 40, z: 35.6 };
const casL = p => ({ x: CASX.F.ax + p.x, z: CASX.F.az + p.z });   // ctxHooks 的 near 用邏輯座標

// ═══ 1 樓：賭場大廳（場館 'casino'）═══
// 大廳是 Katydid 的 Gameready Casino scene（props/cas_hall.glb，12.3 × 25.8 m、高 5.1 m），位置都照模型量：
//   門口牆在 z 0（大門畫在牆上，x 0）；進門是兩排背靠背的吃角子老虎（機台在 z 4.75–5.63 與 8.5–9.38，每排兩面各 12 台、前面有高腳凳），
//   中間是大廳自己的輪盤桌、西牆是吧台（兌換櫃台），裡面 6 張半月形牌桌圍著荷官區（兩根木柱），最裡面一段（z 21.8–25.2）放幸運轉盤、
//   Inside Track 與員工通道；頭獎跑車的轉台在輪盤桌東邊，門口兩側是 casino.glb 的兩張輪盤桌（cs_rl、cs_rl2）。
//   以檔案開啟或下載失敗時是照同一套位置的程式建模（hallFb）。
const casScene = new T.Scene();
const cas = { boxes: [], circles: [], lights: [] };
const CS_W = 6.16, CS_D = 25.82, CS_H = 5.1;
const CS_CASH = { x: -3.1, z: 12.9 }, CS_WHEEL = { x: 0, z: 24.4 }, CS_POD = { x: 3.95, z: 13 }, CS_TRACK = { x: -4.25, z: 23.4 }, CS_STAFF = { x: 6.1, z: 23.6 };
// 牌桌：半月形，弧的圓心 (x, z)、半徑 1.1，玩家坐在 f 那一側（−1 南、+1 北）的 7 張椅子上（椅子在半徑 1.49 的圓上，CS_SEATS 是角度），
// 直邊在 z − f × .16，荷官站在直邊外面的荷官區
const CS_TABLES = [[-3.9, 17.44, -1, 'bj'], [0, 17.44, -1, 'tcp'], [3.9, 17.44, -1, 'bj'], [-3.9, 20.11, 1, 'tcp'], [0, 20.11, 1, 'bj'], [3.9, 20.11, 1, 'bj']].map(([x, z, f, k]) => ({ x, z, f, k }));
const CS_BJ = CS_TABLES.filter(t => t.k === 'bj'), CS_TCP = CS_TABLES.filter(t => t.k === 'tcp');
const CS_SEATS = [-1.48, -.98, -.49, 0, .49, .98, 1.48];
const csSeat = (t, a) => ({ x: t.x + Math.sin(a) * 1.49, z: t.z + t.f * Math.cos(a) * 1.49, yaw: t.f < 0 ? -a : Math.PI + a });
// 吃角子老虎：兩排（z0 是機台南面），每排兩面；s 是人站的地方（高腳凳），f 是那一面朝哪邊
const CS_BANKS = [4.75, 8.5], CS_SX = [-4.19, -3.59, -2.99, -2.39, -1.79, -1.19, 1.21, 1.81, 2.41, 3.01, 3.61, 4.21];
const CS_SLOTS = CS_BANKS.flatMap(z0 => CS_SX.flatMap(x => [{ x, z: z0 - .53, f: -1 }, { x, z: z0 + 1.41, f: 1 }]));
// 輪盤桌：長邊沿 x，玩家站南邊（−z）、荷官在北邊；m 是 casino.glb 的物件（null 是大廳模型裡的那張），w／d 是桌面大小，
// wx 是轉輪在哪一端，y 是模型墊高（cs_rl2 只有桌面，放在台座上）
const CS_RL = [{ x: .02, z: 12.92, m: null, w: 2.33, d: 1.13, wx: -1, y: 0 }, { x: -3.6, z: 2.2, m: 'cs_rl', w: 2.7, d: 1.86, wx: -1, y: 0 }, { x: 3.6, z: 2.3, m: 'cs_rl2', w: 2.8, d: 1.16, wx: 1, y: .78 }];
const casWheel = new T.Group(), casPod = new T.Group();
{
  const k = new Kit(), kh = new Kit(), B = cas.boxes;
  const box = (x0, x1, z0, z1) => B.push({ x0, x1, z0, z1 });
  // ─── 大廳的碰撞（模型與替身共用）：牆、兩排機台、吧台、輪盤桌、牌桌、荷官區的木柱、牆邊的壁柱 ───
  box(-CS_W - .4, -CS_W, 0, CS_D); box(CS_W, CS_W + .4, 0, CS_D); box(-CS_W, CS_W, -.4, 0); box(-CS_W, CS_W, CS_D, CS_D + .4);
  for (const z0 of CS_BANKS) { box(-4.5, -.88, z0, z0 + .88); box(.9, 4.52, z0, z0 + .88); }
  box(-CS_W, -4.03, 11.05, 14.78);
  for (const t of CS_TABLES) { cas.circles.push({ x: t.x, z: t.z, r: 1.12 }); box(t.x - 1.1, t.x + 1.1, Math.min(t.z, t.z - t.f * .18), Math.max(t.z, t.z - t.f * .18)); }
  for (const s of [-1, 1]) { box(s < 0 ? -2.3 : 1.58, s < 0 ? -1.58 : 2.3, 18.5, 19.03); box(s < 0 ? -3.08 : 2.43, s < 0 ? -2.43 : 3.08, 25.2, CS_D); box(s < 0 ? -CS_W : 5.4, s < 0 ? -5.4 : CS_W, 3.3, 4); box(s < 0 ? -CS_W : 5.4, s < 0 ? -5.4 : CS_W, 21.8, 22.55); }
  // 吊燈（模型的燈籠吊燈沿兩側）與牌桌上的燈
  for (const x of [-3.3, 3.3]) for (const z of [3, 8, 13, 18.8, 23.5]) cas.lights.push({ x, y: 2.6, z, col: lin(0xffe0b0), r: 9, i: .75 });   // 掛在吊燈下面：放在燈體裡會把水晶片照成一片白
  for (const t of CS_TABLES) cas.lights.push({ x: t.x, y: 3.2, z: t.z, col: lin(0xfff0c8), r: 4.5, i: .9 });
  // ─── 替身：照模型的位置用程式建模（以檔案開啟或 cas_hall.glb 下載失敗時看到的）───
  kh.box(0, -.05, CS_D / 2, CS_W * 2 + .8, .1, CS_D + .8, 0x2a1414, 10).box(0, CS_H + .05, CS_D / 2, CS_W * 2 + .8, .1, CS_D + .8, 0xe8d4a8, 10);
  for (const [x, z, w, d] of [[-CS_W - .2, CS_D / 2, .4, CS_D], [CS_W + .2, CS_D / 2, .4, CS_D], [0, -.2, CS_W * 2, .4], [0, CS_D + .2, CS_W * 2, .4]]) kh.box(x, CS_H / 2, z, w, CS_H, d, 0xc89a68, 10).box(x, .5, z, w + .06, 1, d + .06, 0x7a4a2a, 10);
  kh.box(0, 1.3, .03, 1.7, 2.6, .06, 0x6a3a24, 10).box(-.4, 1.6, .07, .55, .8, .02, 0xffd890, 11).box(.4, 1.6, .07, .55, .8, .02, 0xffd890, 11);
  for (const s of [-1, 1]) for (const z of [-.5, 1]) kh.box(s * 1.6, 2.4, z < 0 ? .1 : CS_D - .1, 1, 3.6, .1, 0x9a1428, 10);
  for (const z0 of CS_BANKS) for (const x0 of [-2.69, 2.71]) {
    kh.box(x0, .5, z0 + .44, 3.6, 1, .88, 0x5a3a28, 10);
    for (let i = 0; i < 6; i++) {
      const x = x0 - 1.5 + i * .6;
      for (const f of [-1, 1]) { const zf = f < 0 ? z0 + .18 : z0 + .7; kh.box(x, 1, zf, .55, 1.9, .36, 0x1a1a1e, 10).box(x, 1.2, zf + f * .19, .42, .38, .02, 0x60c8ff, 11).box(x, 1.75, zf + f * .19, .42, .2, .02, 0xffb040, 11); }
    }
  }
  for (const s of CS_SLOTS) kh.cyl(s.x, .38, s.z, .2, .2, .08, 10, 0xc02848, 10).cyl(s.x, .19, s.z, .03, .12, .38, 6, 0xc8c8c8, 15);
  kh.box(-5.1, .55, 12.92, 2.1, 1.1, 3.7, 0x8a6a4a, 10).box(-4.3, 1.12, 12.92, .6, .06, 3.73, 0xd8b890, 10).box(-6.0, 2, 12.92, .3, 2.4, 2.6, 0x5a3a24, 10);
  for (let i = 0; i < 6; i++) kh.cyl(-3.58, .7, 11.42 + i * .6, .19, .19, .08, 10, 0xc02848, 10).cyl(-3.58, .35, 11.42 + i * .6, .03, .03, .7, 6, 0x2a2a2a, 15);
  for (const t of CS_TABLES) {
    const t0 = kh.pos.length;
    kh.add(new T.CylinderGeometry(1.1, 1.1, .08, 28, 1, false, Math.PI / 2, Math.PI), 0x3a3a3e, 10, tf(0, .82, 0)).add(new T.CylinderGeometry(.95, .95, .02, 28, 1, false, Math.PI / 2, Math.PI), 0x1a8a4a, 10, tf(0, .86, 0))
      .box(0, .82, .09, 2.2, .08, .18, 0x3a3a3e, 10).box(0, .4, 0, 1.4, .8, .6, 0x2a2a2e, 10);
    for (let i = t0; i < kh.pos.length; i += 3) { if (t.f > 0) { kh.pos[i] = -kh.pos[i]; kh.pos[i + 2] = -kh.pos[i + 2]; } kh.pos[i] += t.x; kh.pos[i + 2] += t.z; }
    for (const a of CS_SEATS) { const c = csSeat(t, a); kh.box(c.x, .5, c.z, .42, .1, .42, 0x2a2a30, 10).box(c.x - Math.sin(c.yaw) * .2, .95, c.z - Math.cos(c.yaw) * .2, .42, .9, .06, 0x2a2a30, 10, 0, c.yaw); }
  }
  for (const x of [-1.94, 1.94]) kh.box(x, CS_H / 2, 18.77, .72, CS_H, .53, 0x8a5a38, 10);
  for (const x of [-2.75, 2.75]) kh.box(x, CS_H / 2, 25.5, .65, CS_H, .62, 0x8a5a38, 10);
  for (const x of [-3.3, 3.3]) for (const z of [3, 8, 13, 18.8, 23.5]) kh.box(x, 4.4, z, .5, .7, .5, 0x1a1a1a, 10).box(x, 4.3, z, .3, .4, .3, 0xffe0a0, 11);
  const hallFb = new T.Mesh(kh.build(), MAT.uber); casScene.add(hallFb);
  propSwap('casino', hallFb, 'hall', [{ x: 0, z: 0 }], casScene, null, 'cas_hall');
  // ─── 不在大廳模型裡的：門口兩張輪盤桌（casino.glb）、頭獎轉台、幸運轉盤、Inside Track、員工通道 ───
  for (const R of CS_RL) {
    box(R.x - R.w / 2, R.x + R.w / 2, R.z - R.d / 2, R.z + R.d / 2);
    cas.lights.push({ x: R.x, y: 3.2, z: R.z, col: lin(0xfff0c8), r: 5, i: 1 });
    const kr = R.m ? new Kit() : kh, y = R.y || .82;
    if (R.y) k.box(R.x, R.y / 2, R.z, R.w - .4, R.y, R.d - .36, 0x2a1418, 10).box(R.x, R.y - .02, R.z, R.w - .3, .04, R.d - .26, 0xd8b048, 15);
    else for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kr.cyl(R.x + sx * (R.w / 2 - .25), .41, R.z + sz * (R.d / 2 - .25), .03, .03, .82, 6, 0xb08a38, 15);
    kr.box(R.x, y + .04, R.z, R.w, .08, R.d, 0x3a1a10, 10).box(R.x + R.wx * -.35, y + .085, R.z, R.w - 1.2, .01, R.d - .2, 0x0e5a3a, 10);
    kr.cyl(R.x + R.wx * (R.w / 2 - .5), y + .12, R.z, .42, .42, .1, 24, 0x5a3418, 10).cyl(R.x + R.wx * (R.w / 2 - .5), y + .17, R.z, .34, .3, .02, 24, 0x8a1424, 10).cyl(R.x + R.wx * (R.w / 2 - .5), y + .22, R.z, .03, .05, .12, 8, 0xd8b048, 15);
    if (!R.m) continue;
    const fb = new T.Mesh(kr.build(), MAT.uber); casScene.add(fb);
    propSwap('casino', fb, R.m, [{ x: R.x, y: R.y, z: R.z }], casScene, null, 'casino');
  }
  // Inside Track：後牆的螢幕與兩張座位
  k.box(CS_TRACK.x, 2.5, CS_D - .06, 2.3, 1.4, .1, 0x0a0a0a, 2).box(CS_TRACK.x, 2.5, CS_D - .12, 2.1, 1.2, .02, 0x40ff9a, 11);
  for (const dx of [-.6, .6]) { k.box(CS_TRACK.x + dx, .45, CS_TRACK.z, .9, .1, .9, 0x6a1020, 10).box(CS_TRACK.x + dx, .8, CS_TRACK.z + .42, .9, .7, .08, 0x6a1020, 10); cas.circles.push({ x: CS_TRACK.x + dx, z: CS_TRACK.z, r: .5 }); }
  cas.lights.push({ x: CS_TRACK.x, y: 3, z: CS_D - 1, col: lin(0x40ff9a), r: 5, i: .9 });
  // 幸運轉盤的台座（後牆正中，兩根木柱之間）、員工通道（東牆）
  k.box(CS_WHEEL.x, .3, 25.05, 3.6, .6, 1.3, 0x2a1418, 10).box(CS_WHEEL.x, .62, 25.05, 3.7, .04, 1.4, 0xd8b048, 15);
  box(-1.8, 1.8, 24.4, 25.7);
  k.box(CS_STAFF.x, 1.3, CS_STAFF.z, .1, 2.6, 1.6, 0x5a5e62, 3).box(CS_STAFF.x - .02, 2.8, CS_STAFF.z, .08, .3, 2, 0xff4030, 11);
  // 頭獎轉台（輪盤桌東邊；轉台在 casPod）
  k.cyl(CS_POD.x, .1, CS_POD.z, 2.05, 2.15, .2, 40, 0x1a1418, 15);
  cas.circles.push({ x: CS_POD.x, z: CS_POD.z, r: 2.15 });
  cas.lights.push({ x: CS_POD.x, y: 4.4, z: CS_POD.z, col: lin(0xffffff), r: 6, i: 1.4 }, { x: 0, y: 4, z: 24, col: lin(0xffc860), r: 6, i: 1.1 });
  casScene.add(new T.Mesh(k.build(), MAT.uber));
  // 幸運轉盤：20 格、每格 18°，指針在正上方；第 0 格是頭獎跑車（天花板 5.1 m，縮成半徑 1.6 m）
  const kw = new Kit(), cols = [0xd8b048, 0x8a1424, 0x1a4a8a, 0x2a2a2a, 0x8a1424, 0x1a6a3a, 0x8a1424, 0x2a2a2a, 0x1a4a8a, 0x8a1424, 0x1a6a3a, 0x2a2a2a, 0x8a1424, 0x1a4a8a, 0x2a2a2a, 0x8a1424, 0x1a6a3a, 0x2a2a2a, 0x8a1424, 0x1a4a8a];
  for (let i = 0; i < WHEEL_N; i++) { const a = i / WHEEL_N * Math.PI * 2; kw.add(new T.CylinderGeometry(2.4, 2.4, .12, 3, 1, false, a - Math.PI / WHEEL_N, Math.PI * 2 / WHEEL_N), cols[i], i ? 2 : 8, tf(0, 0, 0)); }
  kw.cyl(0, .08, 0, .35, .35, .1, 16, 0xd8b048, 15);
  const wm = new T.Mesh(kw.build(), MAT.uber); wm.rotation.x = Math.PI / 2; casWheel.add(wm);
  casWheel.scale.setScalar(.66); casWheel.position.set(CS_WHEEL.x, 2.95, 25.25); casScene.add(casWheel);
  const kp = new Kit(); kp.box(0, 0, 0, .18, .36, .08, 0xffffff, 8); const pm = new T.Mesh(kp.build(), MAT.uber); pm.position.set(CS_WHEEL.x, 4.72, 25.15); casScene.add(pm);
  // 頭獎跑車：轉台上的程式建模替身（實車模型要到車行才看得到），縮成 0.82 才轉得開
  const car = new T.Mesh(carKit(PODIUM).build(), MAT.uber); car.scale.setScalar(.82); casPod.add(car);
  const kt = new Kit(); kt.cyl(0, .01, 0, 1.92, 1.92, .08, 40, 0x2a2a30, 15); kt.cyl(0, -.01, 0, 2, 2, .06, 40, 0xd8b048, 8);   // 金色只露出外圈 casPod.add(new T.Mesh(kt.build(), MAT.uber));
  car.position.y = .05; casPod.position.set(CS_POD.x, .21, CS_POD.z); casScene.add(casPod);
}
// 1 樓的人：荷官、酒保、客人與門口的保全
{
  const P0 = [
    ...CS_TABLES.map(t => [ANIM.idle, t.x, t.z - t.f * .55, t.f < 0 ? Math.PI : 0, 1]),
    [ANIM.idle, -5.0, CS_CASH.z, Math.PI / 2, 1],
    ...CS_RL.map(R => [ANIM.idle, R.x + R.wx * .4, R.z + R.d / 2 + .45, Math.PI, 1]),
    ...[[CS_TABLES[0], 3], [CS_TABLES[2], 1], [CS_TABLES[4], 5], [CS_TABLES[3], 2]].map(([t, i]) => { const c = csSeat(t, CS_SEATS[i]); return [ANIM.sit, c.x, c.z, c.yaw, 0]; }),
    ...[CS_SLOTS[4], CS_SLOTS[17], CS_SLOTS[31]].map(s => [ANIM.interact, s.x, s.z, s.f < 0 ? 0 : Math.PI, 0]),
    [ANIM.talk, 4.6, 16.2, -1, 0], [ANIM.cross, -1.6, 1.4, 0, 2], [ANIM.cross, 1.6, 1.4, 0, 2],
  ];
  const cr = crowd(P0.length), rc = rng(8484);
  P0.forEach(([a, x, z, yaw, role], i) => {
    cr.look(i, role === 1 ? { r: rc, top: 0xf0f0f0, bot: 0x111114, glowI: 0 } : role === 2 ? { r: rc, top: 0x18181c, bot: 0x18181c, female: false, glowI: 0 } : { r: rc, glowI: rc() < .3 ? 1.2 : 0 });
    cr.anim(i, a, rc() * 10, 1, 0); cr.place(i, x, a === ANIM.sit ? -.3 : 0, z, yaw);
    if (a !== ANIM.sit) cas.circles.push({ x, z, r: .3 });
  });
  cr.flush(); casScene.add(cr.mesh);
}
VENUES.casino = { scene: casScene, data: cas, spawn: { x: 0, z: 1.3, yaw: 0 }, name: 'NEON DIAMOND', toast: '霓鑽賭場 · 1 樓禁止攜帶武器', dist: '公園大道 · 霓鑽賭場酒店', ceil: 4.8,
  door: CASX.on ? casW(CAS_DOOR.x, CAS_DOOR.z) : WP(0, 0), out: CASX.on ? { ...casW(CAS_DOOR.x, CAS_DOOR.z + 1.2), yaw: facY(CASX.F, 0) } : spotW(HOME_SPOT) };

// ═══ B1：保全室、氣閘與金庫（場館 'casinoB'）═══
const casBScene = new T.Scene();
const casB = { boxes: [], circles: [], lights: [] };
const CB2 = {
  dock: { x: 16, z: 1.6 }, rap: { x: -14, z: 4 }, sewer: { x: -18.2, z: 10 },
  cards: [{ x: -6.4, z: 14.6 }, { x: -2, z: 14.6 }], daily: { x: 8, z: 18.6 },
  mant0: { z0: 21.8, z1: 22.2 }, mant1: { z0: 27.8, z1: 28.2 }, vault: { x0: -10, x1: 10, z0: 28.2, z1: 43 },
};
const CB_VR = 1.78, CB_VY = 1.95, CB_VH = { x: -1.95, z: 28.3 }, CB_VA = -1.6;
// 氣閘外門 m0 也是圓門（casino.glb 的 cs_m0，圓門板半徑 1.61 m）：鉸鏈柱在西邊，開門時往氣閘走廊裡轉、貼著西牆
const CB_M0 = { r: 1.64, y: 1.72, hx: -1.563, hz: 21.95 };
// 日間金庫的門是 2.4 m 見方的混凝土門板（cs_daily，厚 0.56 m，轉輪朝大廳）：鉸鏈在東邊門口的正面，往大廳那側開
const CB_DAILY = { x0: 6.8, x1: 9.2, z: 14.85 };
const CB_GATES = [[-9, 31.5], [-9, 35.5], [-9, 39.5], [9, 31.5], [9, 35.5], [9, 39.5]].map(([x, z]) => ({ x, z, s: Math.sign(x) }));
const CB_CAMS = [{ x: -19.6, z: 2, yaw: .8 }, { x: 19.6, z: 8, yaw: -1.2 }, { x: -19.6, z: 20, yaw: 1.6 }, { x: 0, z: 21.6, yaw: Math.PI }];
const CB_GUARDS = [[[-12, 7], [-4, 7]], [[6, 5], [6, 13]], [[-10, 19], [-10, 13]], [[3, 20.6], [13, 20.6]], [[-6, 34], [6, 34]], [[16, 10], [16, 18]]];
const casBDoors = {};
const casBGate = [], casBPile = [];
{
  const k = new Kit(), B = casB.boxes;
  const wall = (x0, x1, z0, z1, h = 4.4, col = 0x4a4e54, mat = 2) => { k.box((x0 + x1) / 2, h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0, col, mat); B.push({ x0, x1, z0, z1 }); };
  k.box(0, -.05, 22, 40.4, .1, 44.4, 0x3a3e44, 10).box(0, 4.45, 22, 40.4, .1, 44.4, 0x24282c, 2);
  wall(-20.4, -20, 0, 44); wall(20, 20.4, 0, 44); wall(-20.4, 20.4, -.4, 0); wall(-20.4, 20.4, 43, 43.4);
  for (let z = 4; z < 43; z += 6) for (const x of [-12, 0, 12]) { k.box(x, 4.35, z, 3, .06, .3, 0xe8f4ff, 11); }
  casB.lights.push(...[[-12, 6], [0, 6], [12, 6], [-12, 16], [12, 16], [0, 34], [0, 40]].map(([x, z]) => ({ x, y: 3.8, z, col: lin(0xe0ecff), r: 14, i: 1.1, i0: 1.1 })));
  // 卸貨口（捲門）、垂降井、下水道牆
  k.box(CB2.dock.x, 2, .05, 5, 4, .1, 0x6a6e72, 3).box(CB2.dock.x, 4.1, .1, 5.4, .2, .1, 0xffc020, 11);
  k.box(CB2.rap.x, 4.3, CB2.rap.z, 2.2, .2, 2.2, 0x1a1a1a, 15);
  k.box(-19.9, 1.4, CB2.sewer.z, .1, 2.8, 2.6, 0x5a4a3a, 2);
  // 保全室（西邊）：控制台、兩台讀卡機、螢幕牆
  wall(-12, -11.6, 11, 19); wall(-12, 0, 18.6, 19); wall(-12, -4.5, 11, 11.4); wall(-.4, 0, 11, 18.6);
  k.box(-4.2, .5, 15.6, 6, 1, 1, 0x2a2c30, 10); B.push({ x0: -7.2, x1: -1.2, z0: 15.1, z1: 16.1 });
  for (const c of CB2.cards) k.box(c.x, 1.25, c.z + .55, .3, .4, .1, 0x2a2c30, 15).box(c.x, 1.3, c.z + .49, .16, .1, .02, 0xff3a2a, 11);
  for (let i = 0; i < 6; i++) k.box(-10 + i * 1.6, 2.6, 18.55, 1.4, .8, .04, 0x40c8ff, 11);
  // 日間金庫（東邊的小房間）
  wall(5, 5.4, 15, 21); wall(5, 11, 20.6, 21); wall(10.6, 11, 15, 21); wall(5, 6.8, 15, 15.4); wall(9.2, 11, 15, 15.4);
  k.box(8, 1, 19.8, 4, 2, .8, 0x7a7e82, 3);
  // 氣閘：走廊 x −2..2、z 22..28，兩道門
  wall(-12, -2, 21.8, 22.2); wall(2, 20, 21.8, 22.2); wall(-2.4, -2, 22.2, 27.8); wall(2, 2.4, 22.2, 27.8);
  wall(-10.4, -2, 27.8, 28.2); wall(2, 10.4, 27.8, 28.2);
  // 兩道氣閘門那一段牆都是圓形門框（內門：洞的半徑 CB_VR、圓心離地 CB_VY；外門照 CB_M0）
  for (const [z, r, y] of [[27.8, CB_VR, CB_VY], [21.8, CB_M0.r, CB_M0.y]]) {
    const fr = new T.Shape([new T.Vector2(-2, 0), new T.Vector2(2, 0), new T.Vector2(2, 4.4), new T.Vector2(-2, 4.4)]);
    fr.holes.push(new T.Path().absarc(0, y, r, 0, Math.PI * 2, false));
    k.add(new T.ExtrudeGeometry(fr, { depth: .4, bevelEnabled: false, curveSegments: 20 }), 0x4a4e54, 2, tf(0, 0, z));
    k.add(new T.TorusGeometry(r, .06, 6, 40), 0xd0d4d8, 15, tf(0, y, z - .02));
  }
  // 日間金庫門口上方的過樑
  k.box((CB_DAILY.x0 + CB_DAILY.x1) / 2, 3.4, 15.2, CB_DAILY.x1 - CB_DAILY.x0, 2, .4, 0x4a4e54, 2);
  // 主金庫：牆、6 道柵門與後面的貨
  wall(-10.4, -10, 28.2, 43); wall(10, 10.4, 28.2, 43);
  for (let x = -9.6; x <= 9.6; x += 1.6) k.box(x, 2.2, 42.9, .06, 4.4, .1, 0x8a8e92, 15);
  casBScene.add(new T.Mesh(k.build(), MAT.uber));
  // 會開的門都是繞鉸鏈轉的門板（piv 是鉸鏈，ang 是全開的角度）：關著擋門口（b），開著的門板也擋路（ob）
  // 以 http(s) 開啟時換成 casino.glb 的模型（at：模型在鉸鏈座標裡的位置），程式建模是替身
  const swing = (id, hx, hz, ang, kv, model, at, b, ob) => {
    const piv = new T.Group(); piv.position.set(hx, 0, hz); casBScene.add(piv);
    const m = new T.Mesh(kv.build(), MAT.uber); piv.add(m);
    casBDoors[id] = { m, piv, ang, a: 0, b, ob, open: false };
    B.push(b);
    propSwap('casinoB', m, model, [at], piv, null, 'casino');
  };
  // 外門 m0：圓門板＋西邊的鉸鏈柱＋東邊的鍵盤，開門時往走廊裡轉 −1.6、貼著西牆
  const k0 = new Kit(), m0x = -CB_M0.hx, m0z = 21.74 - CB_M0.hz;
  k0.cyl(m0x, CB_M0.y, m0z + .21, 1.6, 1.6, .26, 40, 0x7a7e84, 3, Math.PI / 2, 0, 0).cyl(m0x, CB_M0.y, m0z + .02, .5, .5, .1, 24, 0xb0b4b8, 15, Math.PI / 2, 0, 0)
    .cyl(0, CB_M0.y, 0, .1, .1, 3, 10, 0x3a3c40, 15).box(m0x + 2.05, CB_M0.y, m0z - .05, .8, .8, .2, 0x2a2c30, 15).box(m0x + 2.05, CB_M0.y + .1, m0z - .16, .4, .3, .02, 0x40c8ff, 11);
  swing('m0', CB_M0.hx, CB_M0.hz, -1.6, k0, 'cs_m0', { x: m0x, y: CB_M0.y, z: m0z },
    { x0: -2, x1: 2, z0: 21.8, z1: 22.2 }, { x0: -1.75, x1: -1.2, z0: 22.2, z1: 26 });
  // 內門 m1：圓形金庫門，鉸鏈在西邊（CB_VH），開門時往金庫裡轉 CB_VA
  const kv = new Kit(), lx = -CB_VH.x, lz = 28 - CB_VH.z;
  kv.cyl(lx, CB_VY, lz, CB_VR - .04, CB_VR - .04, .5, 40, 0x8a9096, 3, Math.PI / 2, 0, 0).cyl(lx, CB_VY, lz - .3, .55, .55, .12, 24, 0xb0b4b8, 15, Math.PI / 2, 0, 0)
    .box(lx, CB_VY, lz - .38, 1.6, .08, .08, 0xd0d4d8, 15).box(lx, CB_VY, lz - .38, .08, 1.6, .08, 0xd0d4d8, 15).box(.1, CB_VY, lz, .3, 3.2, .5, 0x5a5e62, 3);
  swing('m1', CB_VH.x, CB_VH.z, CB_VA, kv, 'cs_vault', { x: lx, z: lz },
    { x0: -2, x1: 2, z0: 27.8, z1: 28.2 }, { x0: CB_VH.x - .75, x1: CB_VH.x + .75, z0: 28.2, z1: CB_VH.z + 4 });
  // 日間金庫：鉸鏈在東邊門口的正面（CB_DAILY.x1, CB_DAILY.z），往大廳那側轉 −1.6
  const kd = new Kit(), dw = CB_DAILY.x1 - CB_DAILY.x0;
  kd.box(-dw / 2, dw / 2, .28, dw, dw, .56, 0x8a8a86, 2).cyl(-dw / 2, dw / 2, -.01, .75, .75, .04, 32, 0x6a6e72, 3, Math.PI / 2, 0, 0)
    .add(new T.TorusGeometry(.32, .035, 6, 20), 0xc0c4c8, 15, tf(-dw / 2, dw / 2, -.3));
  swing('daily', CB_DAILY.x1, CB_DAILY.z, -1.6, kd, 'cs_daily', { x: -dw / 2, z: 0 },
    { x0: CB_DAILY.x0, x1: CB_DAILY.x1, z0: 15, z1: 15.4 }, { x0: CB_DAILY.x1 - .6, x1: CB_DAILY.x1 + .45, z0: CB_DAILY.z - dw - .05, z1: CB_DAILY.z });
  // 柵門與貨堆
  for (const [i, G] of CB_GATES.entries()) {
    const kg = new Kit(); for (let j = -2; j <= 2; j++) kg.box(0, 1.4, j * .4, .06, 2.8, .06, 0xb0b4b8, 15); kg.box(0, 2.8, 0, .1, .1, 2, 0xb0b4b8, 15).box(0, 1.4, 1.1, .1, .3, .2, 0x40ff9a, 11);
    const gm = new T.Mesh(kg.build(), MAT.uber); gm.position.set(G.x - G.s * .8, 0, G.z); casBScene.add(gm); casBGate[i] = gm;
    const b = { x0: G.x - G.s * .8 - .1, x1: G.x - G.s * .8 + .1, z0: G.z - 1, z1: G.z + 1 }; if (b.x0 > b.x1) [b.x0, b.x1] = [b.x1, b.x0]; G.b = b; B.push(b);
    B.push({ x0: Math.min(G.x, G.x - G.s * .7), x1: Math.max(G.x, G.x - G.s * .7) + .01, z0: G.z - 1.05, z1: G.z - .95 }, { x0: Math.min(G.x, G.x - G.s * .7), x1: Math.max(G.x, G.x - G.s * .7) + .01, z0: G.z + .95, z1: G.z + 1.05 });
    const pile = new T.Group(); pile.position.set(G.x - G.s * .1, 0, G.z); casBScene.add(pile); casBPile[i] = pile;
  }
  // 攝影機
  const kc = new Kit(); for (const c of CB_CAMS) kc.box(c.x, 3.6, c.z, .3, .22, .5, 0xe0e0e0, 15, 0, c.yaw).box(c.x + Math.sin(c.yaw) * .26, 3.6, c.z + Math.cos(c.yaw) * .26, .12, .12, .04, 0xff2020, 8, 0, c.yaw);
  casBScene.add(new T.Mesh(kc.build(), MAT.uber));
}
// 貨堆的樣子照目標換（現金推車、畫框、金條、鑽石展示盒）
function casPileBuild(tgt) {
  const c = CAS_TGT[tgt].col;
  casBPile.forEach(p => {
    p.clear(); const k = new Kit();
    if (tgt === 'cash') { k.box(0, .5, 0, .8, .8, 1.4, 0x8a8e92, 15); for (let i = 0; i < 6; i++) k.box(0, .95 + i * .12, 0, .7, .11, 1.3, c, 10); }
    else if (tgt === 'art') { k.box(0, 1.5, 0, .06, 1.4, 1.1, 0xb08a38, 15).box(0, 1.5, 0, .04, 1.2, .9, [0x3a5a8a, 0x8a3a2a, 0x3a6a3a][Math.floor(Math.random() * 3)], 10); }
    else if (tgt === 'gold') { k.box(0, .4, 0, .9, .8, 1.4, 0x5a5e62, 15); for (let i = 0; i < 12; i++) k.box((i % 2 - .5) * .36, .85 + Math.floor(i / 6) * .1, (i % 6 - 2.5) * .2, .3, .09, .16, c, 8); }
    else { k.box(0, .5, 0, .7, 1, .7, 0x2a2c30, 10).box(0, 1.12, 0, .6, .24, .6, 0xc8e8ff, 1); for (let i = 0; i < 5; i++) k.add(new T.OctahedronGeometry(.07, 0), c, 8, tf((i - 2) * .1, 1.08, 0)); }
    p.add(new T.Mesh(k.build(), MAT.uber)); p.visible = true;
  });
}
// B1 的警衛
const casGuards = crowd(CB_GUARDS.length);
const casGS = CB_GUARDS.map(([a, b], i) => ({ i, a, b, x: a[0], z: a[1], yaw: 0, u: 0, dir: 1, st: 'idle', hp: 100, shotT: 1, seen: 0, t: 0 }));
{
  const rc = rng(6262);
  casGS.forEach(g => { casGuards.look(g.i, { r: rc, top: 0x1a1c24, bot: 0x1a1c24, female: false, glowI: 0 }); casGuards.anim(g.i, ANIM.walk, rc() * 10, 1, 0); casGuards.place(g.i, g.x, 0, g.z, 0); });
  casGuards.flush(); casBScene.add(casGuards.mesh);
  casGS.forEach(g => { g.c = { x: g.x, z: g.z, r: .32 }; casB.circles.push(g.c); });
}
VENUES.casinoB = { scene: casBScene, data: casB, spawn: { x: CB2.dock.x, z: 3, yaw: 0 }, name: 'NEON DIAMOND B1', toast: '霓鑽賭場 B1', dist: '公園大道 · 霓鑽賭場酒店地下', ceil: 4.2,
  door: CASX.on ? casW(CAS_DOCK.x, CAS_DOCK.z) : WP(0, 0), out: CASX.on ? { ...casW(CAS_DOCK.x, CAS_DOCK.z + 2), yaw: facY(CASX.F, 0) } : spotW(HOME_SPOT) };
function casDoor(id, open) {
  const D = casBDoors[id]; if (D.open === open) return;
  D.open = open;
  const i = casB.boxes.indexOf(D.b);
  if (open && i >= 0) casB.boxes.splice(i, 1); else if (!open && i < 0) casB.boxes.push(D.b);
  if (D.ob) { const j = casB.boxes.indexOf(D.ob); if (open && j < 0) casB.boxes.push(D.ob); else if (!open && j >= 0) casB.boxes.splice(j, 1); }
  if (player.where === 'casinoB') colDirty();
  sfx.door();
}
function casGate(i, open) {
  const G = CB_GATES[i], j = casB.boxes.indexOf(G.b);
  casBGate[i].visible = !open;
  if (open && j >= 0) casB.boxes.splice(j, 1); else if (!open && j < 0) casB.boxes.push(G.b);
  if (player.where === 'casinoB') colDirty();
}

// ═══ 1 樓的遊戲 ═══
function casEnter() {
  if (ARMS[arm.sel].gun || !ARMS[arm.sel].fist) equip('fist', true);
  enterVenue('casino', () => toast('霓鑽賭場 · 1 樓禁止攜帶武器（武器先收起來了）'));
}
function casCashier() {
  const C = v7KS();
  dialog('霓鑽賭場 · 兌換櫃台', `籌碼 ${C.chips.toLocaleString()} · 現金 ${money(motors.cash)} · $1 = 1 籌碼`, [
    ...CHIP_BUY.map(n => ({ t: `買 ${n.toLocaleString()} 籌碼（${money(n)}）`, fn: () => { closeDialog(); if (motors.cash < n) { toast('錢不夠'); sfx.dry(); return; } motors.cash -= n; C.chips += n; saveMotors(); sfx.pickup(); toast(`籌碼 +${n.toLocaleString()}`); } })),
    { t: C.chips ? `全部兌回現金（${money(C.chips)}）` : '沒有籌碼可以兌換', fn: () => { closeDialog(); if (!C.chips) return; const n = C.chips; C.chips = 0; earn(n, '霓鑽賭場籌碼兌現'); } },
    { t: '離開', fn: closeDialog },
  ]);
}
// 押注：沒籌碼就提醒去櫃台
function casBet(title, text, bets, fn) {
  const C = v7KS();
  if (C.chips < bets[0]) { toast(`籌碼不夠（最少 ${bets[0].toLocaleString()}）· 先到西邊的兌換櫃台`); sfx.dry(); return; }
  dialog(title, `${text}\n籌碼 ${C.chips.toLocaleString()}`, [...bets.filter(b => b <= C.chips).map(b => ({ t: `押 ${b.toLocaleString()}`, fn: () => { closeDialog(); C.chips -= b; fn(b); } })), { t: '離開', fn: closeDialog }]);
}
const casPay = (n, why) => { const C = v7KS(); C.chips += n; C.won += n; saveMotors(); if (n > 0) { sfx.pickup(); toast(`${why} · 籌碼 +${n.toLocaleString()}`); } };
// 撲克牌
const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
function deck() { const d = []; for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) d.push({ r, s }); for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } return d; }
const cardS = c => RANKS[c.r - 1] + SUITS[c.s], handS = h => h.map(cardS).join(' ');
function bjVal(h) { let v = 0, a = 0; for (const c of h) { v += c.r === 1 ? 11 : Math.min(10, c.r); if (c.r === 1) a++; } while (v > 21 && a) { v -= 10; a--; } return v; }
// 21 點：莊家停在 17（軟 17 也停），黑傑克 3:2，可以加倍（多押一次、只再拿一張）
function bjStart(bet) {
  const d = deck(), G = { d, bet, me: [d.pop(), d.pop()], dl: [d.pop(), d.pop()] };
  if (bjVal(G.me) === 21 || bjVal(G.dl) === 21) return bjEnd(G);
  bjTurn(G);
}
function bjTurn(G) {
  const C = v7KS(), opts = [{ t: '要牌', fn: () => { closeDialog(); G.me.push(G.d.pop()); if (bjVal(G.me) > 21) bjEnd(G); else bjTurn(G); } }, { t: '停牌', fn: () => { closeDialog(); bjEnd(G); } }];
  if (G.me.length === 2 && C.chips >= G.bet) opts.push({ t: `加倍（再押 ${G.bet.toLocaleString()}）`, fn: () => { closeDialog(); C.chips -= G.bet; G.bet *= 2; G.me.push(G.d.pop()); bjEnd(G); } });
  dialog('21 點', `你：${handS(G.me)}（${bjVal(G.me)}）\n莊家：${cardS(G.dl[0])} 🂠 · 押注 ${G.bet.toLocaleString()}`, opts);
}
function bjEnd(G) {
  const me = bjVal(G.me), bj = me === 21 && G.me.length === 2, dbj = bjVal(G.dl) === 21 && G.dl.length === 2;
  if (me <= 21 && !bj) while (bjVal(G.dl) < 17) G.dl.push(G.d.pop());
  const dl = bjVal(G.dl);
  let pay = 0, res;
  if (bj && !dbj) { pay = Math.floor(G.bet * 2.5); res = '黑傑克！賠 3:2'; }
  else if (me > 21) res = '爆了';
  else if (dbj && !bj) res = '莊家黑傑克';
  else if (dl > 21 || me > dl) { pay = G.bet * 2; res = dl > 21 ? '莊家爆了，你贏' : '你贏'; }
  else if (me === dl) { pay = G.bet; res = '平手，退回押注'; }
  else res = '莊家贏';
  casPay(pay, '21 點');
  dialog('21 點', `你：${handS(G.me)}（${me}）\n莊家：${handS(G.dl)}（${dl}）\n${res}${pay ? ` · 拿回 ${pay.toLocaleString()}` : ''}`, [
    { t: '再來一局', fn: () => { closeDialog(); casBet('21 點', '荷官洗好牌了。', [500, 2500, 10000, 50000], bjStart); } }, { t: '離開', fn: closeDialog }]);
}
// 三張牌撲克：先下底注看牌，再決定跟注（同額）或棄牌；莊家 Q 高以上才算成局
function tcpRank(h) {
  let v = h.map(c => c.r === 1 ? 14 : c.r).sort((a, b) => b - a);
  const fl = h.every(c => c.s === h[0].s);
  let st = v[0] - v[1] === 1 && v[1] - v[2] === 1;
  if (!st && v[0] === 14 && v[1] === 3 && v[2] === 2) { st = true; v = [3, 2, 1]; }
  const tr = v[0] === v[2], pr = !tr && (v[0] === v[1] || v[1] === v[2]);
  if (pr) { const p = v[1], k = v[0] === v[1] ? v[2] : v[0]; v = [p, p, k]; }
  const cat = st && fl ? 5 : tr ? 4 : st ? 3 : fl ? 2 : pr ? 1 : 0;
  return { cat, s: cat * 1e6 + v[0] * 1e4 + v[1] * 100 + v[2], hi: v[0] };
}
const TCP_NAME = ['高牌', '一對', '同花', '順子', '三條', '同花順'], TCP_BONUS = [0, 0, 0, 1, 4, 5];
function tcpStart(ante) {
  const d = deck(), me = [d.pop(), d.pop(), d.pop()], dl = [d.pop(), d.pop(), d.pop()], r = tcpRank(me), C = v7KS();
  const fold = () => { closeDialog(); casPay(0, ''); dialog('三張牌撲克', `棄牌。莊家是 ${handS(dl)}（${TCP_NAME[tcpRank(dl).cat]}）`, [{ t: '再來一局', fn: () => { closeDialog(); casBet('三張牌撲克', '先下底注。', [500, 2500, 10000], tcpStart); } }, { t: '離開', fn: closeDialog }]); };
  dialog('三張牌撲克', `你的牌：${handS(me)}（${TCP_NAME[r.cat]}）· 底注 ${ante.toLocaleString()}`, [
    { t: C.chips >= ante ? `跟注（再押 ${ante.toLocaleString()}）` : '籌碼不夠跟注', fn: () => {
      closeDialog(); if (C.chips < ante) return fold();
      C.chips -= ante;
      const q = tcpRank(dl), qual = q.cat > 0 || q.hi >= 12, bonus = ante * TCP_BONUS[r.cat];
      let pay = bonus, res;
      if (!qual) { pay += ante * 2 + ante; res = '莊家不成局：底注 1 賠 1，跟注退回'; }
      else if (r.s > q.s) { pay += ante * 4; res = '你贏：底注與跟注都 1 賠 1'; }
      else if (r.s === q.s) { pay += ante * 2; res = '平手，退回'; }
      else res = '莊家贏';
      casPay(pay, '三張牌撲克');
      dialog('三張牌撲克', `你：${handS(me)}（${TCP_NAME[r.cat]}）\n莊家：${handS(dl)}（${TCP_NAME[q.cat]}）\n${res}${bonus ? ` · 底注獎金 ${bonus.toLocaleString()}` : ''}${pay ? ` · 拿回 ${pay.toLocaleString()}` : ''}`, [
        { t: '再來一局', fn: () => { closeDialog(); casBet('三張牌撲克', '先下底注。', [500, 2500, 10000], tcpStart); } }, { t: '離開', fn: closeDialog }]);
    } },
    { t: '棄牌', fn: fold },
  ]);
}
// 吃角子老虎：32 格輪帶（鑽石只有 1 格），三顆鑽石 1000 倍，返還率約 94%
const SLOT_SYM = [['◆', 1, 1000], ['7', 2, 100], ['BAR', 3, 50], ['鈴', 4, 25], ['瓜', 5, 15], ['李', 6, 10], ['櫻', 7, 5], ['—', 4, 0]];
const SLOT_STRIP = SLOT_SYM.flatMap(([s, n]) => Array(n).fill(s));
function slotSpin(bet) {
  const r = [0, 1, 2].map(() => SLOT_STRIP[Math.floor(Math.random() * SLOT_STRIP.length)]);
  const three = r[0] === r[1] && r[1] === r[2] ? SLOT_SYM.find(s => s[0] === r[0])[2] : 0, ch = r.filter(s => s === '櫻').length;
  const k = three || (ch === 2 ? 2 : ch === 1 ? 1 : 0);
  CAS.slot = { r, t: 0, bet, k };
  sfx.click();
}
function slotStep(dt) {
  const S = CAS.slot; if (!S) return;
  S.t += dt;
  const el = $('v7cas'), shown = S.r.map((s, i) => S.t < .6 + i * .45 ? SLOT_STRIP[Math.floor(Math.random() * SLOT_STRIP.length)] : s);
  el.classList.add('on'); el.innerHTML = `<b>吃角子老虎</b><div class="reels">${shown.map(s => `<i>${s}</i>`).join('')}</div><small>押 ${S.bet.toLocaleString()}</small>`;
  if (S.t < 2) return;
  CAS.slot = null; el.classList.remove('on');
  const pay = S.bet * S.k;
  if (S.k >= 1000) toast('三顆鑽石！頭獎 1000 倍');
  casPay(pay, `吃角子老虎 ${S.r.join(' ')}${S.k ? ` · ${S.k} 倍` : ''}`);
  if (!pay) toast(`吃角子老虎 ${S.r.join(' ')} · 沒中`);
  dialog('吃角子老虎', `${S.r.join('  ')}\n${pay ? `中了 ${S.k} 倍 · ${pay.toLocaleString()} 籌碼` : '沒中'}`, [{ t: '再拉一次', fn: () => { closeDialog(); casBet('吃角子老虎', '三顆鑽石 1000 倍、三個 7 是 100 倍、櫻桃一顆就退本。', [100, 500, SLOT_MAX], slotSpin); } }, { t: '離開', fn: closeDialog }]);
}
// 美式輪盤：38 格（0、00、1–36），押紅黑／單雙／大小 1 賠 1、一打 2 賠 1、單號 35 賠 1（0 和 00 只能押單號）
const RL_RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const RL_BETS = [
  { t: '紅', k: 1, hit: n => RL_RED.has(n) }, { t: '黑', k: 1, hit: n => n > 0 && !RL_RED.has(n) },
  { t: '單', k: 1, hit: n => n > 0 && n % 2 === 1 }, { t: '雙', k: 1, hit: n => n > 0 && n % 2 === 0 },
  { t: '1–18', k: 1, hit: n => n >= 1 && n <= 18 }, { t: '19–36', k: 1, hit: n => n >= 19 },
  { t: '第一打 1–12', k: 2, hit: n => n >= 1 && n <= 12 }, { t: '第二打 13–24', k: 2, hit: n => n >= 13 && n <= 24 }, { t: '第三打 25–36', k: 2, hit: n => n >= 25 },
  { t: '單號 0', k: 35, hit: n => n === 0 }, { t: '單號 00', k: 35, hit: n => n === -1 }, { t: '單號 17', k: 35, hit: n => n === 17 },
];
const rlName = n => n === -1 ? '00' : String(n), rlCol = n => n <= 0 ? '綠' : RL_RED.has(n) ? '紅' : '黑';
function rlMenu() {
  dialog('美式輪盤', '先選押哪裡，再下注。0 和 00 出來時，紅黑、單雙、大小與一打都算輸。', [
    ...RL_BETS.map((b, i) => ({ t: `${b.t}（${b.k} 賠 1）`, fn: () => { closeDialog(); casBet('美式輪盤', `押 ${b.t}，${b.k} 賠 1。`, [100, 1000, 5000, 25000], bet => rlSpin(i, bet)); } })),
    { t: '離開', fn: closeDialog },
  ]);
}
// n：-1 是 00；沒給就隨機
function rlSpin(pick, bet, n = Math.floor(Math.random() * 38) - 1) {
  CAS.rl = { pick, bet, n, t: 0 };
  sfx.click();
}
function rlStep(dt) {
  const S = CAS.rl; if (!S) return;
  S.t += dt;
  const el = $('v7cas'), m = S.t < 2.4 ? Math.floor(Math.random() * 38) - 1 : S.n;
  el.classList.add('on'); el.innerHTML = `<b>美式輪盤</b><div class="reels"><i>${rlName(m)}</i></div><small>押 ${RL_BETS[S.pick].t} · ${S.bet.toLocaleString()}</small>`;
  if (S.t < 3) return;
  CAS.rl = null; el.classList.remove('on');
  const B0 = RL_BETS[S.pick], win = B0.hit(S.n), pay = win ? S.bet * (B0.k + 1) : 0;
  casPay(pay, `美式輪盤 ${rlName(S.n)}${rlCol(S.n)}`);
  if (!pay) toast(`美式輪盤 ${rlName(S.n)}${rlCol(S.n)} · 沒中`);
  dialog('美式輪盤', `開出 ${rlName(S.n)}（${rlCol(S.n)}）\n${pay ? `押 ${B0.t} 中了 · 拿回 ${pay.toLocaleString()} 籌碼` : `押 ${B0.t} · 沒中`}`, [{ t: '再押一次', fn: () => { closeDialog(); rlMenu(); } }, { t: '離開', fn: closeDialog }]);
}
// Inside Track：六匹馬、賠率 1–30 倍，勝率照賠率倒數
const HORSES = ['夜航星', '鐵鬃', '霓虹閃電', '老碼頭', '紅棗泥', '灰鷗'];
function trackStart() {
  const odds = HORSES.map(() => [1, 2, 3, 5, 8, 12, 20, 30][Math.floor(Math.random() * 8)]);
  dialog('Inside Track', `今晚的賠率：\n${HORSES.map((h, i) => `${i + 1}. ${h} · ${odds[i]} 賠 1`).join('\n')}`, [
    ...HORSES.map((h, i) => ({ t: `押 ${h}（${odds[i]} 賠 1）`, fn: () => { closeDialog(); casBet('Inside Track', `押 ${h}，${odds[i]} 賠 1。`, [100, 1000, 5000, 10000], b => trackRun(i, odds, b)); } })),
    { t: '離開', fn: closeDialog },
  ]);
}
function trackRun(pick, odds, bet) {
  const w = odds.map(o => 1 / (o + 1)), sum = w.reduce((a, b) => a + b, 0);
  let u = Math.random() * sum, win = 0; while (u > w[win]) { u -= w[win]; win++; }
  CAS.race = { pick, odds, bet, win, t: 0, p: HORSES.map(() => 0), sp: HORSES.map((_, i) => i === win ? 1.06 : .86 + Math.random() * .16) };
  sfx.click();
}
function trackStep(dt) {
  const R = CAS.race; if (!R) return;
  R.t += dt;
  R.p = R.p.map((p, i) => Math.min(1, p + dt / 7 * R.sp[i] * (.85 + .3 * Math.abs(Math.sin(R.t * 2.3 + i)))));
  if (R.t > 6.4) R.p[R.win] = Math.max(R.p[R.win], Math.min(1, R.p[R.win] + dt * .6));
  const el = $('v7cas'); el.classList.add('on');
  el.innerHTML = `<b>Inside Track</b>${HORSES.map((h, i) => `<div class="lane${i === R.pick ? ' me' : ''}"><span>${h}</span><em style="--p:${(R.p[i] * 100).toFixed(1)}%"></em></div>`).join('')}`;
  if (R.p[R.win] < 1) return;
  CAS.race = null; el.classList.remove('on');
  const pay = R.win === R.pick ? R.bet * (R.odds[R.pick] + 1) : 0;
  casPay(pay, `Inside Track · ${HORSES[R.win]} 跑第一`);
  if (!pay) toast(`Inside Track · ${HORSES[R.win]} 跑第一，你押的是 ${HORSES[R.pick]}`);
}
// 幸運轉盤：一個遊戲日轉一次；20 格：0 頭獎跑車、1–4 現金或籌碼、5–6 神秘獎、其他 13 格是小獎
const WHEEL = [
  { n: '頭獎跑車', car: 1 }, { n: '$20,000', cash: 20000 }, { n: '25,000 籌碼', chips: 25000 }, { n: '$40,000', cash: 40000 }, { n: '50,000 籌碼', chips: 50000 },
  { n: '神秘獎', myst: 1 }, { n: '神秘獎', myst: 1 },
  ...[2500, 5000, 7500, 10000, 15000, 2500, 5000, 7500, 10000, 2500, 5000, 7500, 15000].map(n => ({ n: `${n.toLocaleString()} 籌碼`, chips: n })),
];
const wheelReady = () => gameClock() - v7KS().wheel >= CAS_DAY;
function wheelSpin() {
  if (CAS.spin) return;
  if (!wheelReady()) { toast(`幸運轉盤一天只能轉一次 · 再等 ${Math.ceil((CAS_DAY - (gameClock() - v7KS().wheel)) / GAME_HOUR)} 遊戲小時`); sfx.dry(); return; }
  const i = Math.floor(Math.random() * WHEEL_N);
  v7KS().wheel = gameClock(); saveMotors();
  const a0 = casWheel.rotation.z % (Math.PI * 2);
  CAS.spin = { i, t: 0, a0, a1: a0 + Math.PI * 2 * 6 + ((i / WHEEL_N * Math.PI * 2 - a0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) };
  sfx.click(); toast('幸運轉盤轉起來了……');
}
function wheelStep(dt) {
  const S = CAS.spin; if (!S) { casPod.rotation.y += dt * .25; return; }
  S.t += dt; const u = Math.min(1, S.t / 5.5), e = 1 - Math.pow(1 - u, 3);
  casWheel.rotation.z = S.a0 + (S.a1 - S.a0) * e;
  casPod.rotation.y += dt * .25;
  if (u < 1) return;
  CAS.spin = null;
  const W0 = WHEEL[S.i], C = v7KS();
  if (W0.car) {
    if (!motors.owned.includes(PODIUM)) { motors.owned.push(PODIUM); saveMotors(); sfx.pickup(); toast(`頭獎！${CARS[PODIUM].name}（${money(CARS[PODIUM].price)}）· 已經停進 GARAGE 07`); }
    else { C.chips += 100000; saveMotors(); toast('頭獎！車庫裡已經有這台了 · 改送 100,000 籌碼'); }
  }
  else if (W0.cash) earn(W0.cash, '霓鑽賭場幸運轉盤');
  else if (W0.chips) { C.chips += W0.chips; saveMotors(); sfx.pickup(); toast(`幸運轉盤 · ${W0.n}`); }
  else {
    const r = Math.floor(Math.random() * 3);
    if (r === 0) { life.armor = 100; toast('神秘獎：一件全新的防彈背心'); }
    else if (r === 1) { for (const id in arm.ammo) if (ARMS[id].gun) arm.ammo[id].res = Math.max(arm.ammo[id].res, (ARMS[id].mag || 0) * 6); toast('神秘獎：所有槍的彈藥補滿'); }
    else earn(15000, '幸運轉盤神秘獎');
    sfx.pickup();
  }
}

// ═══ 金庫大劫案 ═══
function casBoard() {
  const C = v7KS(), H = CAS.h;
  if (H) return toast(`霓鑽賭場的搶劫進行中 · ${H.stName || ''}`);
  if (!C.tgt) { C.tgt = Object.keys(CAS_TGT)[Math.floor(Math.random() * 4)]; saveMotors(); }
  const T0 = CAS_TGT[C.tgt];
  dialog('計畫板 · 霓鑽賭場金庫', `踩點結果：金庫今天放的是 ${T0.name}（約 ${money(T0.val)}）。\n挑一條路線，付準備費（裝備、制服、EMP 或炸藥），然後到賭場去。`, [
    ...Object.entries(CAS_APPS).map(([id, A]) => ({ t: `${id} · ${A.name}（準備費 ${money(A.prep)} · 金庫 ${A.time} 秒）`, fn: () => { closeDialog(); dialog(`${id} · ${A.name}`, `${A.desc}。\n準備費 ${money(A.prep)}，你身上有 ${money(motors.cash)}。`, [
      { t: motors.cash >= A.prep ? '就這麼辦' : '錢不夠', fn: () => { closeDialog(); if (motors.cash >= A.prep) casPlan(id); } }, { t: '再想想', fn: closeDialog }]); } })),
    { t: '離開', fn: closeDialog },
  ]);
}
function casPlan(app) {
  const why = sideBusy() || (CASX.on ? '' : '賭場不在這座城裡');
  if (why && why !== '現在不行') return toast(why);
  const C = v7KS(), A = CAS_APPS[app];
  if (!CAS_TGT[C.tgt]) C.tgt = Object.keys(CAS_TGT)[Math.floor(Math.random() * 4)];   // 沒踩點（上一次得手後清掉了）就現在決定
  motors.cash -= A.prep; C.app = app; saveMotors(); sfx.pickup();
  const H = CAS.h = { app, tgt: C.tgt, st: 'go', t: 0, timer: A.time, alarm: app === 'C', gas: 0, bag: { val: 0, gold: 0 }, gates: CB_GATES.map(() => ({ st: 'shut' })), card: 0, cardT: 0, mant: 0, work: null, daily: false, warn: 0, beepT: 0 };
  H.entry = app === 'A' ? CAS_DOCK : app === 'B' ? { x: 59.5, z: 44 } : CAS_SEWER;
  exitVenue(() => {
    const p = casW(H.entry.x, H.entry.z); gpsSet(p.x, p.z);
    v7Sms('Kade', app === 'A' ? '保全制服放在卸貨口旁邊的貨櫃裡。換好衣服從捲門進去。' : app === 'B' ? '東牆有鐵梯上裙樓屋頂，通風井在停機坪西邊。EMP 我來按。' : '炸藥裝好了。西邊人行道的下水道鐵蓋，炸開就是 B1 的牆。');
    sideStart(casAct(H));
  });
}
function casAct(H) {
  const A = CAS_APPS[H.app];
  return {
    kind: 'casino', name: '霓鑽賭場搶劫', label: `<b>霓鑽賭場</b> 金庫 · ${A.name}`,
    step(dt) { casHeistStep(H, dt); },
    hud() {
      if (H.st === 'go') return { text: H.app === 'A' ? '到賭場東南角的運鈔車卸貨口' : H.app === 'B' ? '爬上裙樓屋頂，到停機坪旁的通風井' : '到賭場西邊人行道的下水道鐵蓋', bar: -1, num: CAS_TGT[H.tgt].name };
      if (H.st === 'in') return { text: H.card ? '1.5 秒內刷第二張卡！' : H.mant ? '氣閘：等外門關上' : !casBDoors.m0.open ? '保全室：兩台讀卡機 1.5 秒內都要刷' : '穿過氣閘進主金庫', bar: H.alarm ? 100 : -1, num: H.alarm ? '警報' : H.app === 'B' && CAS.emp > 0 ? `EMP ${Math.ceil(CAS.emp)}` : '', low: H.alarm };
      if (H.st === 'vault') return { text: H.work ? H.work.name : `打開柵門拿${CAS_TGT[H.tgt].name} · ${money(H.bag.val)}`, bar: H.timer / A.time * 100, num: H.timer > 0 ? `${Math.ceil(H.timer)} 秒` : '毒氣', low: H.timer < GAS_WARN };
      return { text: W.stars ? '甩掉警察，把贓物送回 AFTERGLOW 後巷' : '把贓物送回 AFTERGLOW 後巷', bar: -1, num: money(H.bag.val) };
    },
    mark() {
      if (H.st === 'go') { const p = casW(H.entry.x, H.entry.z); return { name: '霓鑽賭場', x: p.x, y: 2.4, z: p.z, where: 'out' }; }
      if (H.st === 'escape') { const d = casDrop(); return { name: 'AFTERGLOW', x: d.x, y: 2.2, z: d.z, where: 'out' }; }
      return null;
    },
    fail(why) { toast(`霓鑽賭場搶劫失敗：${why}`); casHeistEnd(false); },
    clear() { gpsClear(); },
  };
}
const casDrop = () => VENUES.bar.out;
function casBreach(H, how) {
  H.st = 'in'; H.t = 0;
  if (H.app === 'C') { life.armor = 100; H.armorK = .55; toast('重型護甲穿好了 · 子彈只剩一半威力'); }
  if (H.app === 'B') CAS.emp = EMP_T;
  casGuardsReset(H);
  casPileBuild(H.tgt);
  for (let i = 0; i < 6; i++) casGate(i, false);
  casDoor('m0', false); casDoor('m1', false); casDoor('daily', false);
  const sp = H.app === 'A' ? { x: CB2.dock.x, z: 3, yaw: 0 } : H.app === 'B' ? { x: CB2.rap.x, z: CB2.rap.z, yaw: 0 } : { x: CB2.sewer.x + 1, z: CB2.sewer.z, yaw: Math.PI / 2 };
  VENUES.casinoB.spawn = sp;
  if (player.mode === 'drive') { const v = player.veh; exitVehicle(); H.ram = v; }
  enterVenue('casinoB', () => {
    if (H.app === 'A') toast('保全制服穿好了 · 別拿槍指人、別開槍');
    else if (H.app === 'B') toast('垂降到 B1 · EMP 停電 60 秒，夜視鏡開著');
    else { toast(how === 'ram' ? '撞穿下水道的牆！警報大作' : '炸開下水道的牆！警報大作'); sfx.boom(10); }
    if (H.alarm) casAlarm(H, true);
  });
}
function casGuardsReset(H) {
  casGS.forEach(g => { g.st = 'idle'; g.hp = 100; g.x = g.a[0]; g.z = g.a[1]; g.u = 0; g.dir = 1; g.shotT = 1 + Math.random(); g.seen = 0; g.c.r = .32; casGuards.anim(g.i, ANIM.walk, Math.random() * 10, 1, 0); });
}
function casAlarm(H, quiet) {
  if (H.alarm && !quiet) return;
  H.alarm = true;
  if (H.st === 'vault') H.timer = Math.min(H.timer, GAS_WARN);
  casGS.forEach(g => { if (g.st !== 'down') { g.st = 'alert'; casGuards.anim(g.i, ANIM.aimIdle, 0, 1, 0); } });
  if (!quiet) { toast('警報！警衛全部拔槍了'); sfx.busted(); }
}
// B1 的每幀：警衛、攝影機、讀卡機、氣閘、金庫計時與毒氣
function casHeistStep(H, dt) {
  H.t += dt;
  if (H.st === 'go') {
    if (player.mode === 'drive' && H.app === 'C' && player.where === 'out') {
      const v = player.veh, p = casW(CAS_SEWER.x, CAS_SEWER.z), sp = Math.hypot(v.vx, v.vz);
      if (Math.hypot(v.x - p.x, v.z - p.z) < 7 && sp > 9 && (v.mass || 1500) > 2600) casBreach(H, 'ram');
    }
    return;
  }
  if (H.st === 'escape') {
    if (CAS.lock5 > 0) { CAS.lock5 -= dt; if (W.stars < 5) wantedApi.set(5); }
    const d = casDrop();
    if (player.where === 'out' && !W.stars && Math.hypot(pX() - d.x, pZ() - d.z) < 12) casHeistEnd(true);
    return;
  }
  if (player.where !== 'casinoB') return;
  CAS.emp = Math.max(0, CAS.emp - dt);
  if (H.card && (H.cardT -= dt) <= 0) { H.card = 0; H.cardFail = (H.cardFail || 0) + 1; toast(H.cardFail >= 3 ? '讀卡失敗三次：保全系統鎖住了' : '太慢了：第一張卡逾時'); sfx.dry(); if (H.cardFail >= 3) casAlarm(H); }
  if (H.mant) { H.mant -= dt; if (H.mant <= 0) { H.mant = 0; casDoor('m1', true); casVaultIn(H); } }
  else if (casBDoors.m0.open && !casBDoors.m1.open && player.z > 22.6 && player.z < 27.4 && Math.abs(player.x) < 1.8) { casDoor('m0', false); H.mant = MANT_T; toast('氣閘：外門關上了 · 3 秒後開內門'); }
  // 工作中（駭指紋鎖、燒鋁熱劑、拿貨）：離開 1.6 m 就中斷
  const W0 = H.work;
  if (W0) {
    if (Math.hypot(player.x - W0.x, player.z - W0.z) > 1.8) { H.work = null; toast('中斷了'); }
    else if ((W0.t += dt) >= W0.T) { H.work = null; W0.done(); }
  }
  if (H.st === 'vault') {
    const was = H.timer; H.timer -= dt;
    if (H.timer <= GAS_WARN && was > GAS_WARN) { toast('金庫時限剩 15 秒！'); sfx.busted(); }
    if (H.timer <= 0 && was > 0) { H.gas = 1; CAS.lock5 = LOCK5_T; toast('神經毒氣釋放了！快出去！'); casAlarm(H); }
  }
  if (H.timer <= GAS_WARN && H.st === 'vault' && H.timer > 0 && (H.beepT -= dt) <= 0) { H.beepT = .5; sfx.beep(); }
  if (H.gas && !life.dead) { life.hp -= GAS_DPS * dt; life.hurtT = 0; if (life.hp <= 0) { life.hp = 0; die('wasted'); } }
  casGuardStep(H, dt);
  // 金條：袋子裡一半以上是金條就走不快、不能翻越
  player.loadK = H.bag.val > 0 && H.bag.gold / H.bag.val > .5 ? GOLD_K : 1;
}
function casVaultIn(H) { H.st = 'vault'; H.timer = H.alarm ? Math.min(CAS_APPS[H.app].time, GAS_WARN + 20) : CAS_APPS[H.app].time; toast(`主金庫 · ${CAS_APPS[H.app].time} 秒後釋放神經毒氣`); }
// 警衛：巡邏 → 發現（A：拿槍指人或開槍；B：正面 9 m 內、蹲著 4 m；屍體 8 m 內）→ 全體警戒開槍
function casGuardStep(H, dt) {
  const me = { x: player.x, z: player.z }, crouch = player.crouch;
  for (const g of casGS) {
    if (g.st === 'down') continue;
    const dx = me.x - g.x, dz = me.z - g.z, d = Math.hypot(dx, dz), face = Math.abs(wrapA(Math.atan2(dx, dz) - g.yaw)) < .9;
    if (g.st === 'idle') {
      const [a, b] = [g.a, g.b], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      g.u += g.dir * dt * 1.1 / L; if (g.u > 1 || g.u < 0) { g.u = clamp(g.u, 0, 1); g.dir *= -1; }
      g.x = a[0] + (b[0] - a[0]) * g.u; g.z = a[1] + (b[1] - a[1]) * g.u; g.yaw = Math.atan2((b[0] - a[0]) * g.dir, (b[1] - a[1]) * g.dir);
      let see = false;
      if (H.app === 'A') see = d < 9 && gta.aiming && Math.abs(wrapA(Math.atan2(-dx, -dz) - player.yaw)) < .4;
      else if (H.app === 'B') see = face && d < (crouch ? 4 : 9) && !(CAS.emp > 0 && d > 3);
      for (const o of casGS) if (o.st === 'down' && !o.found && Math.hypot(o.x - g.x, o.z - g.z) < 8) { o.found = true; if (H.app !== 'A') { toast('警衛發現了倒在地上的同事'); see = true; } }
      if (see) { g.seen += dt * (d < 4 ? 3 : 1.5); if (g.seen > .6) casAlarm(H); } else g.seen = Math.max(0, g.seen - dt);
    } else if (g.st === 'alert') {
      g.yaw = Math.atan2(dx, dz);
      if ((g.shotT -= dt) <= 0) {
        g.shotT = .7 + Math.random() * .5;
        sfx.gun(.6, 1); muzzleFx(g.x + Math.sin(g.yaw) * .5, 1.4, g.z + Math.cos(g.yaw) * .5, .6);
        if (d < 24 && Math.random() < (crouch ? .3 : .45) * (d < 8 ? 1.4 : 1)) hurtPlayer(9 * (H.armorK || 1), g.x, g.z);
      }
    }
    g.c.x = g.x; g.c.z = g.z;
    casGuards.place(g.i, g.x, 0, g.z, g.yaw);
  }
  // 攝影機：EMP 過後看得到你就報警（A 穿制服不算）
  if (H.app === 'B' && !H.alarm && CAS.emp <= 0) for (const c of CB_CAMS) { if (c.dead) continue; const dx = player.x - c.x, dz = player.z - c.z; if (Math.hypot(dx, dz) < 11 && Math.abs(wrapA(Math.atan2(dx, dz) - c.yaw)) < .6) { toast('被攝影機拍到了'); casAlarm(H); break; } }
  casGuards.flush();
}
// 69-combat.js 的 shoot：在 B1 開槍
function casinoShot(R, dmg) {
  const H = CAS.h; if (!H) return;
  if (H.app !== 'C' && !silOn(arm.sel)) casAlarm(H);
  let best = null, bt = 40;
  for (const g of casGS) if (g.st !== 'down') { const t = rayCyl(R, g.x, g.z, .34, .1, 1.95); if (t < bt) { bt = t; best = g; } }
  for (const c of CB_CAMS) if (!c.dead) { const t = rayCyl(R, c.x, c.z, .3, 3.4, 3.8); if (t < bt) { bt = t; best = c; } }
  if (!best) return;
  if (best.yaw !== undefined && best.i === undefined) { best.dead = true; sparks(best.x, 3.6, best.z, 8, 3); return; }
  best.hp -= dmg * (R.oy + R.dy * bt > 1.55 ? 2.5 : 1);
  if (best.hp <= 0) casGuardDown(best, R.dx, R.dz);
  else if (best.st === 'idle') casAlarm(H);
}
function casGuardDown(g, fx = 0, fz = 1) {
  g.st = 'down'; g.c.r = 0; g.downT = uTimeNow();
  casGuards.anim(g.i, ANIM.die, -uTimeNow(), 1); casGuards.place(g.i, g.x, 0, g.z, Math.atan2(-fx, -fz)); casGuards.flush();
}
// B：蹲著從背後按 E 無聲制伏
function casTakedownOk(g) { const dx = player.x - g.x, dz = player.z - g.z; return g.st === 'idle' && Math.hypot(dx, dz) < 1.8 && Math.abs(wrapA(Math.atan2(dx, dz) - g.yaw)) > 2.1; }
function casTakedown(g) { casGuardDown(g, Math.sin(player.yaw), Math.cos(player.yaw)); sfx.impact(3); toast('無聲制伏 · 別讓別人看到屍體'); }
// 讀卡機：先刷一台，1.5 秒內刷另一台
function casCard(i) {
  const H = CAS.h;
  if (!H.card) { H.card = i + 1; H.cardT = KEY_WIN; sfx.beep(); toast('嗶 · 1.5 秒內刷另一台！'); return; }
  if (H.card === i + 1) return;
  H.card = 0; sfx.pickup(); toast('兩張卡都刷過了 · 氣閘外門打開'); casDoor('m0', true);
}
function casWork(H, x, z, T, name, done) { H.work = { x, z, T, t: 0, name, done }; sfx.click(); }
function casGateAct(i) {
  const H = CAS.h, G = CB_GATES[i], S = H.gates[i];
  if (S.st === 'shut') return casWork(H, player.x, player.z, H.app === 'C' ? THERM_T : FINGER_T, H.app === 'C' ? '鋁熱劑燒穿柵門鎖…' : '破解指紋鎖…', () => { S.st = 'open'; casGate(i, true); if (H.app === 'C') sparks(G.x - G.s * .8, 1.4, G.z, 14, 3); toast('柵門打開了'); });
  if (S.st === 'open') {
    const T0 = CAS_TGT[H.tgt];
    return casWork(H, player.x, player.z, H.tgt === 'art' ? ART_T : PILE_T, H.tgt === 'art' ? '割下畫布…' : `把${T0.name}裝進袋子…`, () => {
      S.st = 'empty'; casBPile[i].visible = false;
      const n = Math.round(T0.val / CB_GATES.length); H.bag.val += n; if (H.tgt === 'gold') H.bag.gold += n;
      sfx.pickup(); toast(`+${money(n)} · 袋子裡 ${money(H.bag.val)}${H.tgt === 'gold' && H.bag.gold / H.bag.val > .5 ? ' · 金條好重' : ''}`);
    });
  }
}
function casDailyAct() {
  const H = CAS.h, C = v7KS();
  if (!casBDoors.daily.open) return casWork(H, player.x, player.z, H.app === 'C' ? THERM_T : FINGER_T, '打開日間金庫…', () => casDoor('daily', true));
  if (H.daily) return;
  if (gameClock() - C.daily < CAS_DAY) { H.daily = true; toast('日間金庫今天已經空了'); return; }
  casWork(H, player.x, player.z, PILE_T, '掃光日間金庫…', () => { H.daily = true; C.daily = gameClock(); const n = 40000 + Math.round(Math.random() * 50) * 1000; H.bag.val += n; sfx.pickup(); toast(`日間金庫 +${money(n)}`); });
}
function casLeave() {
  const H = CAS.h;
  if (!H.bag.val) { dialog('卸貨口', '袋子是空的，現在走就白來了。', [{ t: '還是走', fn: () => { closeDialog(); casExit(H); } }, { t: '回去', fn: closeDialog }]); return; }
  casExit(H);
}
function casExit(H) {
  exitVenue(() => {
    H.st = 'escape'; H.work = null;
    const st = H.gas ? 5 : H.alarm ? Math.max(CAS_APPS[H.app].stars, 3) : CAS_APPS[H.app].stars;
    wantedApi.set(st);
    if (H.gas) CAS.lock5 = LOCK5_T;
    const p = casW(CAS_DOCK.x + 4, CAS_DOCK.z + 4), sp = rnLaneSpot(p.x, p.z, 6);
    const v = H.car = buildVeh('shvan', sp.x, sp.z, sp.yaw, 0, 7, 0, 'heist'); v.name = '逃亡廂型車'; v.y = groundH(v.x, v.z); poseVehicle(v);
    const d = casDrop(); gpsSet(d.x, d.z);
    toast(H.bag.val ? `出來了 · 逃亡車在卸貨口旁邊 · ${st} 星${H.gas ? '（鎖住 90 秒）' : ''}` : '出來了 · 什麼都沒拿到');
    if (!H.bag.val) casHeistEnd(false);
  });
}
function casHeistEnd(ok) {
  const H = CAS.h; if (!H) return;
  CAS.h = null; CAS.emp = 0; player.loadK = 1;
  if (side.act && side.act.kind === 'casino') sideEnd();
  if (H.car && !H.car.dead && player.veh !== H.car) heistVehGone(H.car);
  const C = v7KS();
  if (ok) {
    earn(H.bag.val, '霓鑽賭場金庫');
    C.done++; C.tgt = ''; C.app = ''; saveMotors();
    sideDone('霓鑽賭場金庫', `${CAS_APPS[H.app].name} · ${CAS_TGT[H.tgt].name}`, [['金庫', money(H.bag.val)], ['準備費', money(-CAS_APPS[H.app].prep)], ['時間', fmtT(H.t)], ['實拿', money(H.bag.val)]], 3);
  } else { C.app = ''; saveMotors(); }
  if (player.where === 'casinoB' && !life.dead) exitVenue();
}

// ═══ 互動、按鍵與每幀 ═══
ctxHooks.push((p, near) => {
  const H = CAS.h;
  if (p.where === 'bar' && p.mode === 'walk' && near(-6.3, 10.2, 1.4)) return { key: 'E', text: H ? '計畫板 <i>· 霓鑽賭場（進行中）</i>' : `計畫板 <i>· 霓鑽賭場金庫${v7KS().done ? ` · 已得手 ${v7KS().done} 次` : ''}</i>`, fn: casBoard };
  if (p.where === 'out' && CASX.on) {
    if (H && H.st === 'go') {
      if (H.app === 'A' && p.mode === 'walk' && near(casL(CAS_DOCK).x, casL(CAS_DOCK).z, 2.4)) return { key: 'E', text: '換上保全制服，從卸貨口進去', fn: () => casBreach(H) };
      if (H.app === 'B' && p.mode === 'walk' && p.y > CASX.h - 1 && near(casL(CAS_SHAFT).x, casL(CAS_SHAFT).z, 1.8)) return { key: 'E', text: '從通風井垂降', fn: () => casBreach(H) };
      if (H.app === 'C' && p.mode === 'walk' && near(casL(CAS_SEWER).x, casL(CAS_SEWER).z, 2.2)) return { key: 'E', text: '炸開下水道 <i>· 或開重型車撞進去</i>', fn: () => { const q = casW(CAS_SEWER.x, CAS_SEWER.z); fireball(q.x, .4, q.z, 1); casBreach(H, 'blast'); } };
    }
    if (p.mode === 'walk' && near(casL(CAS_DOOR).x, casL(CAS_DOOR).z - .6, 2.2)) return { key: 'E', text: '走進霓鑽賭場 <i>· 1 樓禁止攜帶武器</i>', fn: casEnter };
    return null;
  }
  if (p.where === 'casino') {
    if (near(0, .8, 1.6)) return { key: 'E', text: '出去', fn: () => exitVenue() };
    if (near(CS_CASH.x, CS_CASH.z, 1.6)) return { key: 'E', text: `兌換櫃台 <i>· 籌碼 ${v7KS().chips.toLocaleString()}</i>`, fn: casCashier };
    if (near(CS_WHEEL.x, CS_WHEEL.z - .8, 1.4)) return { key: 'E', text: wheelReady() ? '轉幸運轉盤 <i>· 今天的一次</i>' : '幸運轉盤 <i>· 明天再來</i>', fn: wheelSpin };
    if (near(CS_POD.x, CS_POD.z - 2.6, 1.1)) return { key: 'E', text: `頭獎：${CARS[PODIUM].name}`, fn: () => toast(`${CARS[PODIUM].name} · ${money(CARS[PODIUM].price)} · 幸運轉盤轉到金色那一格就是你的`) };
    for (const t of CS_BJ) if (near(t.x, t.z + t.f * 1.95, 1.1)) return { key: 'E', text: '21 點', fn: () => casBet('21 點', '黑傑克 3:2，莊家停在 17。', [500, 2500, 10000, 50000], bjStart) };
    for (const t of CS_TCP) if (near(t.x, t.z + t.f * 1.95, 1.1)) return { key: 'E', text: '三張牌撲克', fn: () => casBet('三張牌撲克', '先下底注；莊家 Q 高以上才成局。', [500, 2500, 10000], tcpStart) };
    for (const R of CS_RL) if (near(R.x, R.z - R.d / 2 - .7, 1.5)) return { key: 'E', text: '美式輪盤 <i>· 0 與 00</i>', fn: () => { if (!CAS.rl) rlMenu(); } };
    for (const s of CS_SLOTS) if (near(s.x, s.z, .3)) return { key: 'E', text: '吃角子老虎 <i>· 最多押 2,500</i>', fn: () => { if (!CAS.slot) casBet('吃角子老虎', '三顆鑽石 1000 倍、三個 7 是 100 倍、櫻桃一顆就退本。', [100, 500, SLOT_MAX], slotSpin); } };
    if (near(CS_TRACK.x, CS_TRACK.z - .8, 1.3)) return { key: 'E', text: 'Inside Track 賽馬', fn: () => { if (!CAS.race) trackStart(); } };
    if (near(CS_STAFF.x - .8, CS_STAFF.z, 1.2)) return { key: 'E', text: '員工通道 <i>· 閒人勿進</i>', fn: () => toast('門鎖著 · 金庫在 B1，計畫板在 AFTERGLOW') };
    return null;
  }
  if (p.where !== 'casinoB' || !H) return null;
  if (near(CB2.dock.x, CB2.dock.z, 2)) return { key: 'E', text: `從卸貨口出去 <i>· ${money(H.bag.val)}</i>`, fn: casLeave };
  if (H.app === 'B') for (const g of casGS) if (casTakedownOk(g)) return { key: 'E', text: '無聲制伏', fn: () => casTakedown(g) };
  if (!casBDoors.m0.open) for (const [i, c] of CB2.cards.entries()) if (near(c.x, c.z, 1)) return { key: 'E', text: H.card === i + 1 ? '已刷卡' : '刷卡', fn: () => casCard(i) };
  if (near(CB2.daily.x, 14.2, 1.2) || casBDoors.daily.open && near(CB2.daily.x, 18.6, 1.2)) return { key: 'E', text: casBDoors.daily.open ? '日間金庫' : `打開日間金庫${H.app === 'C' ? '（鋁熱劑）' : '（指紋鎖）'}`, fn: casDailyAct };
  if (H.st === 'vault') for (const [i, G] of CB_GATES.entries()) {
    const S = H.gates[i]; if (S.st === 'empty') continue;
    const x = S.st === 'shut' ? G.x - G.s * 1.5 : G.x - G.s * .7;
    if (near(x, G.z, 1.1)) return { key: 'E', text: S.st === 'shut' ? (H.app === 'C' ? '鋁熱劑燒柵門' : '破解指紋鎖') : H.tgt === 'art' ? '割畫' : `拿${CAS_TGT[H.tgt].name}`, fn: () => { if (!H.work) casGateAct(i); } };
  }
  return null;
});
// 計畫板（AFTERGLOW 西牆、街機旁邊）
{
  const m = v5Sign([['霓鑽賭場', .3, '#e8c060', .3], ['金庫計畫', .22, '#f0e8d8', .62]], 1.6, 1, { bg: '#1c1a14', edge: '#8a7040' });
  m.position.set(-6.94, 1.7, 10.2); m.rotation.y = Math.PI / 2; barScene.add(m);
}
{ const el = document.createElement('div'); el.id = 'v7cas'; $('hud').append(el); }
function v7CasinoKey(code) {
  if (code === 'Space' && (player.loadK ?? 1) < 1 && player.mode === 'walk') { toast('金條太重了，跳不起來'); return true; }
  return false;
}
function v7CasinoUpdate(dt) {
  if (player.where === 'casino') { wheelStep(dt); slotStep(dt); trackStep(dt); rlStep(dt); }
  else if (CAS.slot || CAS.race || CAS.rl) { CAS.slot = CAS.race = CAS.rl = null; $('v7cas').classList.remove('on'); }
  for (const V of Object.values(casBDoors)) {
    const a = V.open ? Math.min(1, V.a + dt / 2.2) : Math.max(0, V.a - dt / 1.6);
    if (a !== V.a) { V.a = a; V.piv.rotation.y = V.ang * (a * a * (3 - 2 * a)); }
  }
  const H = CAS.h;
  // 夜視鏡（B 停電時）：燈暗下來
  const dark = H && player.where === 'casinoB' && CAS.emp > 0;
  for (const L of casB.lights) if (L.i0) L.i = dark ? L.i0 * .06 : L.i0;
  V7FX.nv = dark ? 1 : 0;
  V7FX.gas = H && H.gas && player.where === 'casinoB' ? 1 : Math.max(0, V7FX.gas - dt * .5);
  if (H && H.st === 'vault' && H.timer < GAS_WARN && H.timer > 0 && player.where === 'casinoB') post.hurt = Math.max(post.hurt, .5 + .5 * Math.sin(uTimeNow() * 12));
  if (!H && player.loadK !== 1) player.loadK = 1;
  if ((CAS.saveT += dt) > 20) { CAS.saveT = 0; saveMotors(); }
}
function v7CasinoMini(ctx, P2, zoom) {
  if (!CASX.on) return;
  const d = casW(CAS_DOOR.x, CAS_DOOR.z), [x, y] = P2(d.x, d.z), s = 1 / zoom;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#9ae8ff'; ctx.fillRect(-4, -4, 8, 8); ctx.restore();
}
