// ═══ 第七部曲：LAZARUS 夜店帝國（使用者提供的 neon_nightcity_gta_v_1.md 第一節）═══
// 夜店本體（舞池、DJ 台、吧台、卡座、舞池人群）在 60-venues.js；這裡加上：
//   1 樓：全像 DJ 台光環、舞池的節奏小遊戲（舞池上按 E 開始，跟著 128 BPM 的拍子按空白鍵或滑鼠左鍵；連擊讓倍率 1× → 4×，
//         命中加體力（69-v3-skills.js 的 sta），你是老闆的話也加人氣）、吧台的酒單（啤酒 $5、香檳 $500、馬克白威士忌 $350）、
//         男女洗手間（鬧事事件）、西牆的冷凍庫貨梯（老闆才能用）、東牆的後門。
//   2 樓（夾層 MEZ7 = 3.6 m，樓梯在東南角）：玻璃 VIP 區（人氣 80% 以上才拉開紅絨繩）、中間的公共酒廊、老闆辦公室
//         （電腦：DJ 預約、技術員分派、概況；牆上的隱藏保險箱最多 $250,000，滿了卡德會傳訊息叫你回來按 E 收）。
//   B1–B5（另一個場館 clubB）：B1 是武裝廂型車車庫、五台技術員終端機與管理電腦；B2–B5 是倉庫，貨箱照庫存擺上貨架。
//   人氣 P ∈ [0, 100]：每遊戲日（= 真實 1 小時，90-hud.js 的時鐘；規格書寫 48 分鐘，本作的一天是 60 分鐘）掉 5%；
//         保險箱每日收入 = round(1500 + 48500 × (P / 100)²)，照秒平均存進去；P < 20 舞池幾乎沒人。
//   鬧事（保全主管卡德 Kade 傳訊息，小地圖在夜店門口標藍點）：A 洗手間吐了一地的醉漢或騷擾酒保的客人，按 E 過場丟進後門的垃圾子母車
//         → 人氣 +25、$10,000；B 卡座旁昏倒的富豪，按 E 扛上夜店的禮車送聖瑪格麗特醫院急診：超過 28 m/s 或撞擊會扣「心率穩定度」，
//         扣到 0 任務失敗，送到一樣是人氣 +25、$10,000。
//   馬克白威士忌：喝了搖晃幾秒後倒地，醒來是 6 小時後、宿醉模糊 15 秒、只剩內衣，隨機丟在五處之一：
//         霓峰塔塔吊吊臂末端、北嶺鐵道橋中段（電聯車 80 m 外開過來）、霓虹堡軍事基地的停機坪（4 星）、灰石國宅的垃圾子母車裡（滿身泥巴）、
//         北嶺山坡上「NEON CITY」地標大字的頂上（附降落傘與一個空酒瓶）。
//   技術員與貨物：五位技術員（第一位免費，之後每位 $15,000），各自分派一種貨（價值／每箱秒數／上限）：
//         南美進口貨 $20,000/120/10、貨運與船運 $10,000/70/50、運動用品 $5,000/40/100（要先買下地堡，69-v7-bunker.js）、
//         醫藥研究 $8,500/60/20、現金製造 $3,500/30/40。
//   全部出售：開夜梟改裝廂型車（車頂 .50 雙聯裝砲塔跟著滑鼠轉 360°、左鍵開火；E 往車後丟感應地雷），送到買家那裡；
//         洗錢仲介抽 10%，最多 $100,000。廂型車被炸掉貨就沒了。
// 存檔在 motors.v7.club（nc260.motors 第 12 版）：pop、hired、job、goods、gT、dj、djDay、full；關遊戲期間照時間補算（最多 24 小時）。
// 排在 69-v7-casino 之後、70 之前：頂層不能用 keys、camState、post 等 99／70 才宣告的東西（函式裡可以）。

const V7C = { beat: null, trouble: null, troubleT: 240 + Math.random() * 120, drink: null, hang: 0, under: 0, sell: null, mines: [], saveT: 0, crowdN: -1, lv: 0 };
const CLUB_DAY = GAME_HOUR * 24, POP_DECAY = 5, SAFE_BASE = 1500, SAFE_K = 48500, SAFE_CAP = 250000;
const TROUBLE_POP = 25, TROUBLE_PAY = 10000, TYCOON_VMAX = 28, VIP_POP = 80, EMPTY_POP = 20;
const BEAT_PERFECT = .12, BEAT_GOOD = .25, LAUNDER_K = .1, LAUNDER_CAP = 100000, MINE_N = 12, TECH_FEE = 15000, TECH_N = 5;
const DJ_FEE = 10000, DJ_POP = 10, MEZ7 = 3.6;
const GOODS = [
  { id: 'coke', name: '南美進口貨', what: '高純度古柯鹼精煉', unit: 20000, t: 120, cap: 10, lv: 1, col: 0xe8e4d8 },
  { id: 'cargo', name: '貨運與船運', what: '企業走私科技晶片', unit: 10000, t: 70, cap: 50, lv: 2, col: 0x3a6ab0 },
  { id: 'sport', name: '運動用品', what: '地下地堡軍火武器', unit: 5000, t: 40, cap: 100, lv: 3, col: 0x4a5a32, need: 'bunker' },
  { id: 'pharma', name: '醫藥研究', what: '合成冰毒化學品', unit: 8500, t: 60, cap: 20, lv: 1, col: 0x40c0d0 },
  { id: 'cash', name: '現金製造', what: '高仿真聚合物假鈔', unit: 3500, t: 30, cap: 40, lv: 4, col: 0x3a8a4a },
];
const GOOD = Object.fromEntries(GOODS.map(g => [g.id, g]));
const DJS = [
  { name: 'DJ 薇拉・赫茲', col: 0xff3fa0 },
  { name: '雙子低頻 Twin Sub', col: 0x2cf2d8 },
  { name: '鐵肺 Ironlung', col: 0xffae57 },
  { name: 'MC 雨夜詩人', col: 0x7a2cff },
];
const KADE = '卡德（LAZARUS 保全主管）';
ENV.clubB = { lampOn: 0, wet: 0, fogDen: .02, fog: 0x101418, fogHi: 0x182028, top: 0x5a6470, bot: 0x202428 };
motors.v7 ||= {};
{
  const c = motors.v7.club && typeof motors.v7.club === 'object' ? motors.v7.club : {};
  c.pop = c.pop == null || !Number.isFinite(+c.pop) ? 60 : clamp(+c.pop, 0, 100);   // 新存檔從 60% 開始
  c.hired = clamp(Math.floor(+c.hired) || 0, 0, TECH_N);
  c.job = Array.from({ length: TECH_N }, (_, i) => (Array.isArray(c.job) && GOOD[c.job[i]]) ? c.job[i] : null);
  const g = c.goods && typeof c.goods === 'object' ? c.goods : {};
  c.goods = Object.fromEntries(GOODS.map(o => [o.id, clamp(Math.floor(+g[o.id]) || 0, 0, o.cap)]));
  c.gT = Array.from({ length: TECH_N }, (_, i) => Array.isArray(c.gT) ? Math.max(0, +c.gT[i] || 0) : 0);
  c.dj = clamp(Math.floor(+c.dj) || 0, 0, DJS.length - 1); c.djDay = Math.floor(+c.djDay) || -1; c.full = c.full ? 1 : 0;
  motors.v7.club = c;
}
const v7CS = () => motors.v7.club;
const clubOwned = () => estOwned('lazarus');
const clubDaily = (P = v7CS().pop) => Math.round(SAFE_BASE + SAFE_K * (P / 100) ** 2);
const goodsValue = () => GOODS.reduce((s, g) => s + v7CS().goods[g.id] * g.unit, 0);
const goodsCount = () => GOODS.reduce((s, g) => s + v7CS().goods[g.id], 0);
const launderFee = v => Math.min(Math.round(v * LAUNDER_K), LAUNDER_CAP);
const goodOk = g => !g.need || (g.need === 'bunker' && bunkerOwned());   // 69-v7-bunker.js
function v7Sms(who, text) { toast(`簡訊 · ${who}：${text}`); sfx.beep(); setTimeout(() => sfx.beep(), 140); }

// ─── 收入、人氣與生產（每秒；關遊戲期間的補算也走這裡） ───
function clubTick(dt) {
  const C = v7CS();
  if (!clubOwned()) return;
  if (!paused('lazarus')) {
    const S = motors.props.safe;
    S.lazarus = Math.min(SAFE_CAP, (S.lazarus || 0) + clubDaily() * dt / CLUB_DAY);
    if (S.lazarus >= SAFE_CAP && !C.full) { C.full = 1; if (started) v7Sms(KADE, `老闆，辦公室的保險箱滿了（${money(SAFE_CAP)}），再不收錢就進不去了。回來按 E 收一下。`); }
  }
  C.pop = Math.max(0, C.pop - POP_DECAY * dt / CLUB_DAY);
  for (let i = 0; i < C.hired; i++) {
    const g = GOOD[C.job[i]]; if (!g || !goodOk(g)) continue;
    C.gT[i] += dt;
    while (C.gT[i] >= g.t) { if (C.goods[g.id] >= g.cap) { C.gT[i] = g.t; break; } C.goods[g.id]++; C.gT[i] -= g.t; }
  }
}
// 關遊戲期間（65-motors.js 的 lastTs）：一分鐘一步補算，最多 24 小時
{
  const sec = Math.min(86400, Math.max(0, (Date.now() - (+lastTs || Date.now())) / 1000));
  if (sec > 60 && clubOwned()) {
    const s0 = motors.props.safe.lazarus || 0, g0 = goodsCount();
    for (let t = 0; t < sec; t += 60) clubTick(Math.min(60, sec - t));
    V7C.offline = { sec, cash: Math.floor((motors.props.safe.lazarus || 0) - s0), crates: goodsCount() - g0 };
  }
}

// ─── 1 樓的新東西：洗手間、樓梯間、冷凍庫貨梯、後門、全像 DJ 光環 ───
const club2 = { boxes: [], circles: [], lights: [] };
const V7_MEZ_LIGHTS = [];
const V7_FREEZER = { x: -11.2, z: 23.2 }, V7_BACK = { x: 11.2, z: 25.4 }, V7_STAIR0 = { x: 8.9, z: 1.2 }, V7_STAIR1 = { x: 10.7, z: 6.2 };
const V7_SAFE = { x: 5.2, z: .7 }, V7_DESK = { x: 6.9, z: 3.0 }, V7_VIP_DOOR = { x0: -8, x1: -6.4 }, V7_OFF_DOOR = { x0: 5.4, x1: 7.0 };
{
  const k = new Kit(), B = club.boxes;
  const wall = (x0, x1, z0, z1, h, col = 0x16141a, mat = 2, y0 = 0, list = B) => { k.box((x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0, col, mat); if (list) list.push({ x0, x1, z0, z1 }); };
  // 洗手間（西側夾層下方）：女廁 x −12..−7.2、男廁 x −7.2..−2.4，門口在 z 6.4 那道牆上
  wall(-12, -10.6, 6.4, 6.6, 3.2); wall(-9.2, -5.6, 6.4, 6.6, 3.2); wall(-4.2, -2.4, 6.4, 6.6, 3.2); wall(-2.4, -2.0, 6, 6.6, 3.2);
  wall(-7.3, -7.1, 0, 6.4, 3.2, 0x2a2a30);
  k.box(-9.9, 2.9, 6.62, 1.2, .3, .02, 0xff3fa0, 8).box(-4.9, 2.9, 6.62, 1.2, .3, .02, 0x2cf2d8, 8);   // 門楣燈條（洋紅＝女廁、青＝男廁）
  for (const x of [-11, -9.4, -8]) { k.box(x, .4, .45, .55, .8, .7, 0xe8e8ec, 10); B.push({ x0: x - .3, x1: x + .3, z0: 0, z1: .85 }); }   // 馬桶與洗手台
  for (const x of [-6.2, -4.8, -3.4]) { k.box(x, .45, .45, .55, .9, .7, 0xe8e8ec, 10); B.push({ x0: x - .3, x1: x + .3, z0: 0, z1: .85 }); }
  for (const s of [-1, 1]) k.box(s < 0 ? -9.6 : -4.8, 1.6, .05, 3.2, 1.2, .04, 0x9ab0c0, 1);   // 鏡子
  k.box(-7.2, .02, 3.2, 9.6, .04, 6.4, 0x2a2e36, 10);   // 地磚
  // 樓梯間（東側夾層下方）：往 +z 爬升，頂端接 2 樓走道
  B.push({ x0: 9.6, x1: 11.8, z0: .2, z1: 5.4 });
  for (let i = 0; i < 12; i++) k.box(10.7, (i + .5) * .3, .4 + i * .4, 2.2, .3, .4, 0x1e1c22, 10);
  k.box(9.62, 1.8, 2.8, .05, .05, 5.2, 0xff3fa0, 8);
  // 夾層樓板（z 0–7.2，樓梯口 x 9.6–11.8、z .2–5 開洞）與門口通道上的補板
  for (const [x0, x1, z0, z1] of [[-12, 9.6, 0, 7.2], [11.8, 12, 0, 7.2], [9.6, 11.8, 5.0, 7.2], [9.6, 11.8, 0, .2]]) k.box((x0 + x1) / 2, 3.45, (z0 + z1) / 2, x1 - x0, .3, z1 - z0, 0x0b0a0e, 2);
  k.box(0, 7.2 + .02, 7.22, 24, .04, .04, 0x7a2cff, 8);
  // 冷凍庫貨梯（西牆）：不鏽鋼門、黃黑警示框
  k.box(-11.94, 1.3, 23.2, .1, 2.6, 2.2, 0xa8b0b8, 3).box(-11.9, 2.7, 23.2, .08, .2, 2.5, 0xffc020, 11).box(-11.9, 1.3, 22.02, .08, 2.6, .12, 0xffc020, 11).box(-11.9, 1.3, 24.38, .08, 2.6, .12, 0xffc020, 11);
  k.box(-11.88, 1.4, 23.2, .04, .06, 1.9, 0x30ff90, 8);
  // 後門（東牆）：鐵門與出口綠燈
  k.box(11.94, 1.15, 25.4, .1, 2.3, 1.4, 0x3a3c40, 15).box(11.88, 2.55, 25.4, .04, .22, .7, 0x30ff70, 8);
  // 全像 DJ 光環：舞台前三圈
  for (const [r, y] of [[2.6, 1.2], [3.2, 2.4], [2.2, 3.5]]) k.cyl(0, y, 28.6, r, r, .05, 48, 0x2cf2d8, 8);
  // ─── 2 樓 ───
  const L1 = club2.boxes;
  for (const b of [{ x0: -12.4, x1: -12, z0: 0, z1: 32 }, { x0: 12, x1: 12.4, z0: 0, z1: 32 }, { x0: -12.4, x1: 12.4, z0: -.4, z1: 0 }]) L1.push(b);
  wall(-12, 12, 7.2, 7.4, 1.1, 0x9ab8d0, 1, MEZ7, L1);   // 玻璃護欄
  // VIP（x −12..−3.2）：整面玻璃隔間，門口 x −8..−6.4 是紅絨繩
  wall(-12, -8, 5.0, 5.2, 2.9, 0xa0b8d8, 1, MEZ7, L1); wall(-6.4, -3.2, 5.0, 5.2, 2.9, 0xa0b8d8, 1, MEZ7, L1);
  wall(-3.4, -3.2, 0, 5.2, 2.9, 0x241a2a, 2, MEZ7, L1);
  // 老闆辦公室（x 3.2..9.4），門口 x 5.4–7.0
  wall(3.2, 3.4, 0, 5.2, 2.9, 0x241a2a, 2, MEZ7, L1); wall(3.4, 5.4, 5.0, 5.2, 2.9, 0x2a2026, 2, MEZ7, L1); wall(7.0, 9.4, 5.0, 5.2, 2.9, 0x2a2026, 2, MEZ7, L1);
  wall(9.4, 9.6, 0, 5.2, 2.9, 0x2a2026, 2, MEZ7, L1);
  L1.push({ x0: 9.6, x1: 12, z0: 0, z1: 5.0 });   // 樓梯口
  k.box(10.7, MEZ7 + .5, 5.0, 2.2, 1, .05, 0x9ab8d0, 1);
  // VIP 內裝：沙發、桌子、香檳桶
  for (const x of [-10.6, -6.4]) { k.box(x, MEZ7 + .3, .7, 2.6, .6, 1.1, 0x5a0a2a, 2).box(x, MEZ7 + .85, .3, 2.6, .9, .3, 0x5a0a2a, 2); L1.push({ x0: x - 1.3, x1: x + 1.3, z0: 0, z1: 1.3 }); }
  for (const x of [-10.6, -6.4]) { k.box(x, MEZ7 + .35, 2.3, 1.2, .7, .7, 0x111014, 10).cyl(x + .3, MEZ7 + .85, 2.3, .12, .1, .3, 12, 0xc0c4c8, 3); L1.push({ x0: x - .6, x1: x + .6, z0: 1.95, z1: 2.65 }); }
  k.box(-7.2, MEZ7 + 2.6, .05, 9.4, .06, .04, 0xffae57, 8);
  // 公共酒廊：高腳桌
  for (const x of [-1.6, 1.6]) { k.cyl(x, MEZ7 + .55, 6.4, .35, .35, .04, 16, 0x222024, 10).cyl(x, MEZ7 + .28, 6.4, .05, .05, .55, 8, 0x2a2c30, 15); L1.push({ x0: x - .38, x1: x + .38, z0: 6.0, z1: 6.8 }); }
  // 辦公室：辦公桌、電腦螢幕、牆上的畫（後面是保險箱）、監視器牆
  k.box(V7_DESK.x, MEZ7 + .38, 2.1, 2.2, .76, .9, 0x2a1a12, 10).box(V7_DESK.x, MEZ7 + .98, 1.85, .9, .5, .04, 0x40c8ff, 11);
  L1.push({ x0: V7_DESK.x - 1.1, x1: V7_DESK.x + 1.1, z0: 1.65, z1: 2.55 });
  k.box(V7_SAFE.x, MEZ7 + 1.5, .06, 1.1, .8, .04, 0xb08040, 2).box(V7_SAFE.x, MEZ7 + 1.5, .085, .95, .65, .01, 0x2a4a5a, 2);
  for (let i = 0; i < 6; i++) k.box(8.2 + (i % 2) * .8 - .4, MEZ7 + 1.3 + Math.floor(i / 2) * .5, .06, .7, .42, .03, i % 3 ? 0x3080a0 : 0x40c0ff, 11);
  clubScene.add(new T.Mesh(k.build(), MAT.uber));
  // 2 樓的燈（世界座標就是夜店的室內座標）
  V7_MEZ_LIGHTS.push({ x: -7.2, y: MEZ7 + 2.4, z: 2.4, col: lin(0xff6ab0), r: 7, i: 1.1 }, { x: 6.4, y: MEZ7 + 2.4, z: 2.4, col: lin(0xffd8a0), r: 6, i: 1 }, { x: 0, y: MEZ7 + 2.4, z: 6, col: lin(0x7a2cff), r: 7, i: .8 });
}
// 會開關的門（VIP 的紅絨繩、辦公室的門鎖）：碰撞盒放進 / 拿出 2 樓的清單
const v7Doors = { vip: { x0: V7_VIP_DOOR.x0, x1: V7_VIP_DOOR.x1, z0: 5.0, z1: 5.2 }, off: { x0: V7_OFF_DOOR.x0, x1: V7_OFF_DOOR.x1, z0: 5.0, z1: 5.2 } };
const v7Rope = (() => { const k = new Kit(); k.cyl(-8, MEZ7 + .5, 5.1, .05, .05, 1, 8, 0xd0b060, 3).cyl(-6.4, MEZ7 + .5, 5.1, .05, .05, 1, 8, 0xd0b060, 3).box(-7.2, MEZ7 + .85, 5.1, 1.6, .06, .06, 0xa01030, 2); const m = new T.Mesh(k.build(), MAT.uber); clubScene.add(m); return m; })();
const v7OffDoor = (() => { const k = new Kit(); k.box(6.2, MEZ7 + 1.1, 5.1, 1.6, 2.2, .06, 0x3a2a20, 10).box(6.85, MEZ7 + 1.1, 5.04, .05, .2, .04, 0xd0b060, 3); const m = new T.Mesh(k.build(), MAT.uber); clubScene.add(m); return m; })();
function v7DoorSync() {
  const L = club2.boxes, vipOpen = clubOwned() || v7CS().pop > VIP_POP, offOpen = clubOwned();
  for (const [b, open] of [[v7Doors.vip, vipOpen], [v7Doors.off, offOpen]]) { const i = L.indexOf(b); if (open && i >= 0) L.splice(i, 1); else if (!open && i < 0) L.push(b); }
  v7Rope.visible = !vipOpen; v7OffDoor.visible = !offOpen;
  if (player.where === 'club' && VENUES.club.lv === 1) colDirty();
}
// 夜店變成兩層：60-venues.js 的 club 是 1 樓，club2 是夾層
Object.assign(VENUES.club, { lvs: [club, club2], lv: 0, lvY: 0, ceilAt: (x, z) => VENUES.club.lv === 0 && z < 7.4 ? 3.1 : 6.6 });
function clubLevel(k) {
  const V = VENUES.club; V.lv = k; V.lvY = k ? MEZ7 : 0; V.data = V.lvs[k];
  if (player.where === 'club') { activeBoxes = V.data.boxes; activeCircles = V.data.circles; colDirty(); player.y = V.lvY; }
}
function clubStairs(up) {
  if (up && !clubOwned() && v7CS().pop <= 0) {}   // 2 樓的公共酒廊誰都能上去
  transition(() => {
    clubLevel(up ? 1 : 0);
    const S = up ? V7_STAIR1 : V7_STAIR0;
    player.x = S.x; player.z = S.z; player.yaw = up ? -Math.PI / 2 : Math.PI; player.v = 0; player.dance = 0;
    camState.yaw = player.yaw; camState.pitch = .12;
    toast(up ? 'LAZARUS 2 樓 · VIP 區與酒廊' : 'LAZARUS 1 樓');
  });
}
// 2 樓的客人：VIP 沙發上的四位、靠在玻璃護欄看舞池的兩位
const club2People = crowd(6);
{
  const rc = rng(7707);
  [[ANIM.sit, -11.2, .9, Math.PI], [ANIM.sit, -10, .9, Math.PI], [ANIM.sit, -6.9, .9, Math.PI], [ANIM.talk, -5.2, 3.2, -1.2], [ANIM.idle, -2.4, 6.7, 0], [ANIM.talk, 2.6, 6.7, .3]].forEach(([a, x, z, yaw], k) => {
    club2People.look(k, { r: rc, glowI: rc() < .4 ? 1.6 : 0 });
    club2People.anim(k, a, rc() * 10, 1, 0); club2People.place(k, x, MEZ7 + (a === ANIM.sit ? -.3 : 0), z + (a === ANIM.sit ? .45 : 0), yaw);
    if (a !== ANIM.sit) club2.circles.push({ x, z, r: .32 });
  });
  club2People.flush(); clubScene.add(club2People.mesh);
}
// 舞池的人數跟著人氣（只在你是老闆時；P < 20 只剩三個人）
const v7Dancers = (() => { const C = club.circles.filter(c => c.dancer), cr = club.people; return club.dancers.map((k, i) => ({ k, c: C[i], x: cr.people[k].x, z: cr.people[k].z, yaw: cr.people[k].yaw })); })();
function v7CrowdSync() {
  const N = v7Dancers.length, P = v7CS().pop;
  const n = !clubOwned() ? N : P < EMPTY_POP ? Math.min(3, N) : Math.round(N * (.35 + .65 * P / 100));
  if (n === V7C.crowdN) return;
  V7C.crowdN = n;
  v7Dancers.forEach((d, i) => { const on = i < n; club.people.place(d.k, d.x, on ? 0 : -60, d.z, d.yaw); if (d.c) d.c.r = on ? .3 : 0; });
  club.people.flush();
  if (player.where === 'club') colDirty();
}

// ─── B1–B5：武裝廂型車車庫、技術員終端機與倉庫 ───
const clubBScene = new T.Scene();
const CB_N = 5, CB_DY = 6, CB_H = 4.2, CB_LIFT = { x: -10.4, z: 3.5 };
const CB_TERM = [6, 10, 14, 18, 22].map(z => ({ x: 12.4, z })), CB_PC = { x: -8.6, z: 9.2 }, CB_VAN = { x: 2, z: 17 };
const clubBLv = Array.from({ length: CB_N }, (_, k) => ({ boxes: [], circles: [], lights: [], y: -k * CB_DY }));
const cbCrates = {};
{
  const k = new Kit();
  clubBLv.forEach((L, i) => {
    const y = L.y, B = L.boxes;
    const wall = (x0, x1, z0, z1, h = CB_H, col = 0x30343a, mat = 2) => { k.box((x0 + x1) / 2, y + h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0, col, mat); B.push({ x0, x1, z0, z1 }); };
    k.box(0, y - .05, 15, 28.4, .1, 30.4, i ? 0x2a2c2e : 0x26282c, 10).box(0, y + CB_H + .05, 15, 28.4, .1, 30.4, 0x1a1c1e, 2);
    wall(-14.4, -14, 0, 30); wall(14, 14.4, 0, 30); wall(-14.4, 14.4, -.4, 0); wall(-14.4, 14.4, 30, 30.4);
    for (let z = 4; z < 30; z += 6) k.box(0, y + CB_H - .1, z, 20, .06, .3, 0xe8f4ff, 11);   // 日光燈
    for (let x = -12; x <= 12; x += 6) k.box(x, y + .01, 15, .12, .01, 28, 0xffc020, 11);   // 地上的黃線
    // 貨梯（每層西南角）
    k.box(-12.5, y + 1.3, 3.5, .1, 2.6, 2.4, 0xa8b0b8, 3).box(-12.45, y + 2.75, 3.5, .08, .2, 2.6, 0xffc020, 11);
    B.push({ x0: -14, x1: -12.4, z0: 2, z1: 5 });
    L.lights.push({ x: 0, y: y + 3.6, z: 8, col: lin(0xe0ecff), r: 16, i: 1.1 }, { x: 0, y: y + 3.6, z: 22, col: lin(0xe0ecff), r: 16, i: 1.1 }, { x: -11, y: y + 2.6, z: 3.5, col: lin(0xffc020), r: 5, i: .8 });
    if (i === 0) {
      // B1：武裝廂型車（車頂雙聯裝砲塔）、五台技術員終端、管理電腦
      const vx = CB_VAN.x, vz = CB_VAN.z;
      k.box(vx, y + 1.25, vz, 2.1, 1.9, 5.4, 0x1a1c20, 0).box(vx, y + 1.55, vz + 2.25, 1.9, .7, .8, 0x6a8090, 1);
      for (const [dx, dz] of [[-1, -1.8], [1, -1.8], [-1, 1.8], [1, 1.8]]) k.cyl(vx + dx, y + .38, vz + dz, .38, .38, .3, 14, 0x0c0c0e, 2, 0, 0, Math.PI / 2);
      k.cyl(vx, y + 2.3, vz - .4, .45, .55, .3, 16, 0x2a2c30, 15).box(vx - .14, y + 2.5, vz + .4, .08, .08, 1.4, 0x111214, 15).box(vx + .14, y + 2.5, vz + .4, .08, .08, 1.4, 0x111214, 15);
      k.box(vx, y + .02, vz, 4.2, .01, 7.4, 0x7a2cff, 8);
      L.circles.push({ x: vx, z: vz - 1.6, r: 1.25 }, { x: vx, z: vz + 1.6, r: 1.25 });
      for (const T0 of CB_TERM) { k.box(T0.x + .7, y + .38, T0.z, .9, .76, 1.6, 0x2a2c30, 10).box(T0.x + 1.1, y + 1.05, T0.z, .04, .5, .8, 0x40ff9a, 11); B.push({ x0: T0.x + .25, x1: 14, z0: T0.z - .8, z1: T0.z + .8 }); }
      k.box(CB_PC.x - .2, y + .38, CB_PC.z, 1.6, .76, .9, 0x2a2c30, 10).box(CB_PC.x - .2, y + 1.05, CB_PC.z - .35, .9, .5, .04, 0x40c8ff, 11);
      B.push({ x0: CB_PC.x - 1, x1: CB_PC.x + .6, z0: CB_PC.z - .45, z1: CB_PC.z + .45 });
      L.lights.push({ x: vx, y: y + 3, z: vz, col: lin(0x7a2cff), r: 8, i: .9 });
    } else {
      // 倉庫：兩排貨架（東西向），貨箱照庫存擺
      for (const z of [10, 20]) for (const x0 of [-9, 2]) {
        k.box(x0 + 3.5, y + 1.6, z, 7, .06, 1.4, 0x6a4a2a, 10).box(x0 + 3.5, y + .02, z, 7, .04, 1.4, 0x6a4a2a, 10);
        for (const dx of [0, 3.5, 7]) for (const dz of [-.65, .65]) k.box(x0 + dx, y + 1.6, z + dz, .08, 3.2, .08, 0xff7a20, 15);
        k.box(x0 + 3.5, y + 3.2, z, 7, .06, 1.4, 0x6a4a2a, 10);
        B.push({ x0: x0 - .1, x1: x0 + 7.1, z0: z - .75, z1: z + .75 });
      }
    }
  });
  clubBScene.add(new T.Mesh(k.build(), MAT.uber));
  // 貨箱：每種貨一個 InstancedMesh（上限就是容量），數量照庫存
  const slots = [];
  for (const z of [10, 20]) for (const x0 of [-9, 2]) for (const sy of [.06, 1.66]) for (let i = 0; i < 6; i++) for (const dz of [-.35, .35]) slots.push([x0 + .6 + i * 1.16, sy, z + dz]);
  const byLv = {};
  for (const g of GOODS) {
    const lv = g.lv, base = byLv[lv] || 0; byLv[lv] = base + g.cap;
    const kk = new Kit(); kk.box(0, .3, 0, .9, .6, .6, g.col, g.id === 'cash' ? 10 : 2).box(0, .61, 0, .92, .02, .62, 0x1a1c1e, 2);
    const m = new T.InstancedMesh(kk.build(), MAT.uber, g.cap);
    for (let i = 0; i < g.cap; i++) { const s = slots[(base + i) % slots.length], st = Math.floor((base + i) / slots.length); _o.position.set(s[0], clubBLv[lv].y + s[1] + st * .62, s[2]); _o.rotation.set(0, 0, 0); _o.scale.setScalar(1); _o.updateMatrix(); m.setMatrixAt(i, _o.matrix); }
    m.count = 0; m.computeBoundingSphere(); m.frustumCulled = false; clubBScene.add(m); cbCrates[g.id] = m;
  }
}
// 技術員：坐在終端機前（雇了才出現）
const cbTechs = crowd(TECH_N);
{
  const rc = rng(5151);
  CB_TERM.forEach((T0, k) => { cbTechs.look(k, { r: rc, glowI: 0 }); cbTechs.anim(k, ANIM.interact, rc() * 10, 1, 0); cbTechs.place(k, T0.x - .1, -60, T0.z, Math.PI / 2); });
  cbTechs.flush(); clubBScene.add(cbTechs.mesh);
}
function cbSync() {
  const C = v7CS();
  for (const g of GOODS) cbCrates[g.id].count = C.goods[g.id];
  CB_TERM.forEach((T0, k) => cbTechs.place(k, T0.x - .1, k < C.hired ? 0 : -60, T0.z, Math.PI / 2));
  cbTechs.flush();
}
VENUES.clubB = { scene: clubBScene, data: clubBLv[0], lvs: clubBLv, lv: 0, lvY: 0, spawn: { x: CB_LIFT.x, z: CB_LIFT.z, yaw: Math.PI / 2 }, name: 'LAZARUS B1', toast: 'LAZARUS B1 · 車庫與技術員', dist: '霓虹區 · 9 St 地下', ceil: CB_H - .3,
  door: VENUES.club.door, out: VENUES.club.out, ceilAt: () => VENUES.clubB.lvY + CB_H - .3 };
function clubBLevel(k) {
  const V = VENUES.clubB; V.lv = k; V.lvY = clubBLv[k].y; V.data = clubBLv[k]; V.name = `LAZARUS B${k + 1}`;
  if (player.where === 'clubB') { activeBoxes = V.data.boxes; activeCircles = V.data.circles; colDirty(); player.y = V.lvY; }
}
// 貨梯：1 樓的冷凍庫門 ↔ B1–B5
function v7Lift() {
  if (!clubOwned()) { toast('冷凍庫的門鎖著 · 老闆才有鑰匙'); sfx.dry(); return; }
  const here = player.where === 'clubB' ? VENUES.clubB.lv : -1;
  const opts = [{ t: here < 0 ? '1 樓 · 夜店（現在這層）' : '1 樓 · 夜店', fn: () => { closeDialog(); if (here >= 0) v7LiftTo(-1); } }];
  for (let k = 0; k < CB_N; k++) opts.push({ t: `B${k + 1} · ${k ? `倉庫（${GOODS.filter(g => g.lv === k).map(g => g.name).join('、')}）` : '車庫與技術員'}${k === here ? '（現在這層）' : ''}`, fn: () => { closeDialog(); if (k !== here) v7LiftTo(k); } });
  opts.push({ t: '算了', fn: closeDialog });
  dialog('冷凍庫貨梯', `庫存 ${goodsCount()} 箱 · 價值 ${money(goodsValue())}`, opts);
}
function v7LiftTo(k) {
  transition(() => {
    if (k < 0) {
      setWhere('club'); clubLevel(0);
      player.x = V7_FREEZER.x + .9; player.z = V7_FREEZER.z; player.yaw = Math.PI / 2;
    } else {
      clubBLevel(k); setWhere('clubB'); clubBLevel(k); cbSync();
      player.x = CB_LIFT.x; player.z = CB_LIFT.z; player.yaw = Math.PI / 2;
    }
    player.v = 0; player.dance = 0; camState.yaw = player.yaw; camState.pitch = .12;
    toast(k < 0 ? 'LAZARUS 1 樓' : VENUES.clubB.name + (k ? ' · 倉庫' : ' · 車庫與技術員'));
  });
}

// ─── 吧台的酒單 ───
function v7Bar() {
  const buy = (n, fn) => () => { closeDialog(); if (motors.cash < n) { toast(`錢不夠（${money(n)}）`); sfx.dry(); return; } motors.cash -= n; saveMotors(); sfx.glass(); fn(); };
  dialog('LAZARUS 吧台', '酒保擦著杯子：「今晚喝點什麼？」', [
    { t: `啤酒（${money(5)}）`, fn: buy(5, () => { post.wobble = Math.max(post.wobble, .6); toast('冰啤酒，剛好。'); }) },
    { t: `香檳（${money(500)}）`, fn: buy(500, () => { post.wobble = Math.max(post.wobble, .9); toast('開香檳！整個吧台都在看你'); if (clubOwned()) v7Pop(1); }) },
    { t: `馬克白威士忌（${money(350)}）`, fn: buy(350, v7Macbeth) },
    { t: '不用了', fn: closeDialog },
  ]);
}
function v7Pop(n) { const C = v7CS(); C.pop = clamp(C.pop + n, 0, 100); V7C.crowdN = -1; }

// ─── 舞池的節奏小遊戲 ───
{ const el = document.createElement('div'); el.id = 'v7beat'; el.innerHTML = '<i></i><b></b><small></small><em></em>'; $('hud').append(el); }
function v7BeatStart() {
  if (player.mode !== 'walk') return;
  V7C.beat = { combo: 0, mult: 1, hits: 0, miss: 0, score: 0, last: -9, lastB: -9, rate: '', rateT: 0 };
  player.dance = 1 + Math.floor(Math.random() * DANCES.length); player.v = 0;
  toast('跟著拍子按空白鍵或滑鼠左鍵 · 連擊加倍率 · 走開就結束');
}
function v7BeatEnd() {
  const B = V7C.beat; if (!B) return;
  V7C.beat = null; $('v7beat').classList.remove('on');
  if (player.dance) player.dance = 0;
  if (B.hits) toast(`舞池結算 · 命中 ${B.hits} 拍 · 最高倍率 ${B.best || 1}× · ${B.score.toLocaleString('en-US')} 分`);
}
function v7BeatHit() {
  const B = V7C.beat; if (!B) return false;
  const b = sfx.beat(), n = Math.round(b), e = Math.abs(b - n);
  if (n === B.last) return true;   // 同一拍按兩次不算
  B.last = n;
  if (e > BEAT_GOOD) { B.combo = 0; B.mult = 1; B.miss++; B.rate = '沒踩到'; B.rateT = .5; sfx.dry(); return true; }
  B.combo++; B.hits++; B.mult = Math.min(4, 1 + Math.floor(B.combo / 8)); B.best = Math.max(B.best || 1, B.mult);
  const perfect = e <= BEAT_PERFECT;
  B.score += (perfect ? 20 : 10) * B.mult; B.rate = perfect ? '完美' : '不錯'; B.rateT = .5; B.lastB = n;
  skUp('sta', (perfect ? .05 : .03) * B.mult);   // 69-v3-skills.js：體力
  if (clubOwned()) v7Pop(.04 * B.mult);
  sfx.click();
  return true;
}
function v7BeatStep(dt) {
  const B = V7C.beat, el = $('v7beat');
  if (!B) return;
  const p = player;
  if (p.where !== 'club' || VENUES.club.lv !== 0 || !p.dance || Math.abs(p.x) > 6.2 || p.z < 12.8 || p.z > 25.2) return v7BeatEnd();
  const b = sfx.beat(), ph = b - Math.floor(b);
  if (B.combo && b - B.lastB > 1.6) { B.combo = 0; B.mult = 1; B.rate = '斷拍'; B.rateT = .5; }   // 整整一拍沒按：連擊歸零
  B.rateT -= dt;
  el.classList.add('on');
  el.style.setProperty('--p', ph.toFixed(3));
  const h = `${B.mult}×|${B.combo} 連擊|${B.rateT > 0 ? B.rate : ''}|${B.score.toLocaleString('en-US')}`;
  if (el.dataset.h !== h) { el.dataset.h = h; const [a, c, r, s] = h.split('|'); el.children[1].textContent = a; el.children[2].textContent = c; el.children[3].textContent = r || s; }
}

// ─── 鬧事事件（卡德傳訊息、小地圖藍點） ───
const v7Bad = crowd(1);
v7Bad.look(0, { r: rng(4242), female: false, glowI: 0 }); v7Bad.place(0, 0, -60, 0, 0); v7Bad.flush(); clubScene.add(v7Bad.mesh);
const v7BadMark = (() => { const m = neonRing(0x3a8aff, .7); m.rotation.x = Math.PI / 2; m.visible = false; clubScene.add(m); return m; })();
const TROUBLES = [
  { id: 'vomit', kind: 'A', x: -5.2, z: 3.2, yaw: Math.PI, anim: ANIM.kneel, sms: '男廁有個 VIP 喝掛了，吐得到處都是，客人都在抱怨。', ctx: '把吐滿地的醉漢拖出去' },
  { id: 'harass', kind: 'A', x: -8.3, z: 11.2, yaw: -Math.PI / 2, anim: ANIM.punch, sms: '吧台有個客人一直騷擾酒保，我的人勸不動他。', ctx: '把騷擾酒保的客人拖出去' },
  { id: 'tycoon', kind: 'B', x: 8.4, z: 19, yaw: Math.PI / 2, anim: ANIM.die, sms: '卡座那邊有個大老闆昏倒了，臉色發青，得馬上送醫院！', ctx: '扛起昏倒的富豪 · 送醫院' },
];
function v7TroubleStart(id) {
  const T0 = TROUBLES.find(o => o.id === id) || TROUBLES[Math.floor(Math.random() * TROUBLES.length)];
  V7C.trouble = { ...T0, t: 360 };
  v7Bad.look(0, { r: rng(Math.floor(Math.random() * 1e6)), female: false, glowI: 0, coat: T0.kind === 'B' ? 1 : undefined });
  v7Bad.anim(0, T0.anim, T0.anim === ANIM.die ? -uTimeNow() - 9 : Math.random() * 10, 1, 0);
  v7Bad.place(0, T0.x, 0, T0.z, T0.yaw); v7Bad.flush();
  v7BadMark.position.set(T0.x, .06, T0.z); v7BadMark.visible = true;
  v7Sms(KADE, T0.sms + (T0.kind === 'A' ? '（藍點）' : ' 小地圖藍點。'));
}
function v7TroubleClear() {
  V7C.trouble = null; v7Bad.place(0, 0, -60, 0, 0); v7Bad.flush(); v7BadMark.visible = false;
  V7C.troubleT = 240 + Math.random() * 120;
}
function v7TroubleReward(how) {
  v7Pop(TROUBLE_POP); earn(TROUBLE_PAY, how);
  toast(`LAZARUS 人氣 +${TROUBLE_POP}% · 現在 ${Math.round(v7CS().pop)}%`);
}
function v7TroubleA() {
  const T0 = V7C.trouble; if (!T0) return;
  transition(() => {
    v7TroubleClear();
    player.x = V7_BACK.x - 1; player.z = V7_BACK.z; player.yaw = Math.PI / 2; camState.yaw = -Math.PI / 2; camState.pitch = .1;
    sfx.punch(); setTimeout(() => sfx.impact(6), 300);
    toast(T0.id === 'vomit' ? '你和卡德一人抓一邊，把醉漢從後門扔進垃圾子母車' : '你揪著他的衣領穿過舞池，後門一開，直接丟進垃圾子母車');
    v7TroubleReward('LAZARUS 鬧事處理');
  });
}
function v7TroubleB() {
  const T0 = V7C.trouble; if (!T0) return;
  if (side.act) return toast(`${side.act.name}還沒結束`);
  transition(() => {
    v7TroubleClear();
    setWhere('out'); clubLevel(0);
    const o = VENUES.club.out, sp = rnLaneSpot(o.x, o.z, 6);
    const v = buildVeh('tiara', sp.x, sp.z, sp.yaw, 0, 7, 0, 'club');
    v.name = 'LAZARUS 禮車'; v.y = groundH(v.x, v.z); poseVehicle(v);
    player.x = sp.x + Math.cos(sp.yaw) * 2; player.z = sp.z - Math.sin(sp.yaw) * 2;
    enterVehicle(v); camState.yaw = v.yaw; camState.pitch = .1;
    const J = { v, st: 100, hp0: v.hp, sp0: 0 };
    gpsSet(HOSP.x, HOSP.z);
    sideStart({
      kind: 'tycoon', name: '富豪送醫', label: '<b>LAZARUS</b> 富豪送醫',
      step(dt) {
        if (!v || v.dead) return this.fail('禮車毀了');
        if (player.veh !== v && Math.hypot(pX() - v.x, pZ() - v.z) > 40) return this.fail('把昏倒的富豪丟在路上');
        const sp = Math.hypot(v.vx, v.vz);
        if (sp > TYCOON_VMAX) J.st -= (sp - TYCOON_VMAX) * 1.6 * dt;
        if (J.hp0 - v.hp >= 4 || J.sp0 - sp > 7) { J.st -= 14; sfx.impact(4); toast('撞到了！富豪的心率又亂了'); }
        J.hp0 = v.hp; J.sp0 = sp;
        J.st = Math.min(100, J.st + 1.2 * dt);   // 開得穩會慢慢回穩
        if (J.st <= 0) return this.fail('富豪心跳停止了');
        if (Math.hypot(v.x - HOSP.x, v.z - HOSP.z) < 14 && sp < 3) {
          if (player.veh === v) exitVehicle();
          sideEnd(); heistVehGone(v);
          v7TroubleReward('富豪平安送到急診');
          sideDone('送醫完成', `${HOSP.name}急診室收下了富豪`, [['心率穩定度', `${Math.round(J.st)}%`], ['人氣', `+${TROUBLE_POP}%`], ['報酬', money(TROUBLE_PAY)]], 2);
        }
      },
      hud() { return { text: `把富豪送到${HOSP.name}急診 · 別超過 ${Math.round(TYCOON_VMAX * 3.6)} km/h`, bar: J.st, num: `心率 ${Math.round(J.st)}%`, low: J.st < 30 }; },
      mark() { return { name: HOSP.name, x: HOSP.x, y: 2.2, z: HOSP.z, where: 'out' }; },
      fail(why) { toast(`送醫失敗：${why}`); sideEnd(); heistVehGone(v); v7Pop(-5); },
      clear() { gpsClear(); },
    });
    toast(`富豪在後座 · 開穩一點送到${HOSP.name}`);
  });
}
function v7TroubleStep(dt) {
  const T0 = V7C.trouble;
  if (T0) { if ((T0.t -= dt) <= 0) { v7TroubleClear(); v7Pop(-5); v7Sms(KADE, '算了，那個麻煩我們自己處理掉了。客人看到了，人氣掉了一點。'); } return; }
  if (!clubOwned() || !started || side.act || W.stars || life.dead || heist.st !== 'off') return;
  if ((V7C.troubleT -= dt) <= 0) v7TroubleStart();
}

// ─── 馬克白威士忌：斷片、醒在五處之一 ───
const v7Dump = (() => {
  // 灰石國宅（城東的老國宅區）巷口的垃圾子母車：邏輯座標
  const x = avX(17) + 30, z = stZ(3) + 10.3, zn = zoneAtL(x, z), k = new Kit();
  k.box(x, .65, z, 2.0, 1.3, 1.2, 0x2a5a3a, 15).box(x, 1.33, z - .1, 2.05, .06, 1.0, 0x1a3a26, 2).box(x, .02, z + .7, 2.2, .02, .5, 0x3a2a18, 2);
  cityAdd(new T.Mesh(k.build(), MAT.uber), zn);
  addBoxL({ x0: x - 1, x1: x + 1, z0: z - .6, z1: z + .6, zn, hy: 1.3 });
  return { x, z: z + 1.1, zn };
})();
// 北嶺山坡上的 NEON CITY 地標大字：公園框的座標（−z 往山上），觀景台再往上 40 m
const v7Letters = (() => {
  const L = NPARK.look, cx = L.cx, cz = L.cz - 40, txt = ['NEON', 'CITY'], G = {
    N: ['10001', '11001', '10101', '10011', '10001'], E: ['11111', '10000', '11110', '10000', '11111'], O: ['01110', '10001', '10001', '10001', '01110'],
    C: ['01111', '10000', '10000', '10000', '01111'], I: ['111', '010', '010', '010', '111'], T: ['11111', '00100', '00100', '00100', '00100'], Y: ['10001', '01010', '00100', '00100', '00100'] };
  const px = 1.6, gap = 1.6, word = 4.8;
  const cols = txt.map(w => [...w].reduce((s, ch) => s + G[ch][0].length * px + gap, -gap));
  const total = cols[0] + word + cols[1];
  let base = Infinity; for (let x = -total / 2; x <= total / 2; x += 2) base = Math.min(base, parkH(cx + x, cz));
  const top = base + 5 * px * 2 + 1;   // 字高 16 m，底下再墊 1 m 的混凝土座
  const k = new Kit(), rects = [];
  k.box(cx, base + .5, cz, total + 2, 1.2, 1.6, 0x5a5650, 2);
  let x0 = cx - total / 2;
  txt.forEach((w, wi) => {
    for (const ch of w) {
      const g = G[ch], n = g[0].length;
      for (let r = 0; r < 5; r++) for (let c = 0; c < n; c++) if (g[r][c] === '1') {
        const bx = x0 + c * px + px / 2, by = base + 1 + (4 - r) * px * 2 + px;
        k.box(bx, by, cz, px, px * 2, 1.2, 0xf0ece2, 2);
        if (r === 0) rects.push([bx - px / 2, bx + px / 2]);
      }
      k.box(x0 + n * px / 2, top + .02, cz - .62, n * px, .06, .04, 0xff3fa0, 8);
      x0 += n * px + gap;
    }
    x0 += word - gap;
  });
  const m = new T.Mesh(k.build(), MAT.uber); cityAdd(m, NPARK.f);
  colliders.push({ x0: cx - total / 2 - 1, x1: cx + total / 2 + 1, z0: cz - .8, z1: cz + .8, zn: NPARK.f, hy: top });
  // 字的頂端走得上去（每個字母最上面那一排）；69-v5-civic.js 的 roofJump 讓你從邊上跳下去開傘
  const segs = []; for (const [a, b] of rects) { const s = segs[segs.length - 1]; if (s && a - s[1] < .05) s[1] = b; else segs.push([a, b]); }
  for (const [a, b] of segs) v5Roof(null, { x0: a, x1: b, z0: cz - .6, z1: cz + .6, h: top, zn: NPARK.f });
  const mid = segs[Math.floor(segs.length / 2)];
  return { x: (mid[0] + mid[1]) / 2, z: cz, y: top, segs };
})();
const BLACKOUT = [
  { id: 'crane', name: '霓峰塔塔吊的吊臂末端', ok: () => CR.on, at() { const [x, z] = gtaApi.v5.crane.jib(-73.5, 0); return { x, z, y: CR_JIB, yaw: Math.PI / 2 }; } },
  { id: 'rail', name: '北嶺鐵道橋的正中間', ok: () => !!RAIL, at() { const R = RAIL, [x, z, ux, uz] = R.at(R.len / 2), [X, Z] = toW(x, z, RAIL_ZN); return { x: X, z: Z, y: R.D, yaw: Math.atan2(ux, uz) + Math.PI, after() { R.state = 'run'; R.dir = 1; R.s = R.len / 2 - 80; R.horned = false; setTimeout(() => sfx.trainHorn(1), 600); toast('……鐵軌在震動。電聯車從隧道那頭開過來了！'); } }; } },
  { id: 'fort', name: '霓虹堡軍事基地的停機坪', ok: () => true, at() { const p = fortPad(); return { ...p, after() { wantedApi.set(4); toast('霓虹堡衛兵：「入侵者！停機坪上有人！」'); } }; } },
  { id: 'dump', name: '灰石國宅的垃圾子母車', ok: () => true, at() { const [x, z] = toW(v7Dump.x, v7Dump.z, v7Dump.zn); return { x, z, y: 0, yaw: Math.PI, after() { V7C.mud = 1; toast('你從一堆垃圾裡爬出來，滿身泥巴'); } }; } },
  { id: 'sign', name: '北嶺山坡 NEON CITY 地標大字的頂上', ok: () => true, at() { const [x, z] = toW(v7Letters.x, v7Letters.z, NPARK.f); return { x, z, y: v7Letters.y, yaw: Math.PI, after() { toast('你站在 NEON CITY 的字上，背著一具降落傘，手裡握著空酒瓶 · 走到邊上按空白鍵跳下去開傘'); } }; } },
];
function v7Macbeth(forceId) {
  if (V7C.drink) return;
  toast('馬克白威士忌，一口乾了……');
  post.wobble = Math.max(post.wobble, 1.4);
  V7C.drink = { t: 0, st: 'sway', id: typeof forceId === 'string' ? forceId : null };
  v7BeatEnd();
}
function v7DrinkStep(dt) {
  const D = V7C.drink; if (!D) return;
  D.t += dt;
  if (D.st === 'sway') { post.wobble = Math.max(post.wobble, 1.2 + D.t * .4); if (D.t > 3.5) { D.st = 'down'; D.t = 0; player.down = 99; player.downPh = -uTimeNow(); player.gotUp = 0; player.kx = player.kz = 0; player.dance = 0; sfx.impact(3); } return; }
  if (D.st === 'down' && D.t > 1.8 && !fading) {
    D.st = 'move';
    const pool = BLACKOUT.filter(b => b.ok() && (!D.id || b.id === D.id)), B = pool[Math.floor(Math.random() * pool.length)] || BLACKOUT[3];
    transition(() => {
      if (player.mode === 'drive') exitVehicle();
      clubLevel(0); setWhere('out');
      const S = B.at();
      player.x = S.x; player.z = S.z; player.y = S.y; player.yaw = S.yaw; player.v = 0; player.air3 = null;
      camState.yaw = S.yaw; camState.pitch = .15;
      clockSt.min = (clockSt.min + 360) % 1440;
      V7C.under = 240; v7Underwear(true);
      player.down = 1.2; player.downPh = -uTimeNow() - 1.4;
      V7C.hang = 15; V7C.drink = null; V7C.last = B.id;
      toast(`……頭好痛。六個小時過去了。你在${B.name}醒來，身上只剩內衣`);
      if (S.after) S.after();
    });
  }
}
function v7Underwear(on) {
  const c = CREW[crew.cur].look;
  if (on) me.look(0, { r: rng(9), ...c, top: c.skin, coat: 0, bot: lin(0xe8e6e0), shoe: c.skin, glowI: 0, skirt: 0, hat: 0 });
  else me.look(0, { r: rng(9), ...c });
  if (!on) V7C.mud = 0;
}

// ─── 辦公室：保險箱、電腦（DJ、技術員、概況） ───
function v7Safe() {
  if (!clubOwned()) return toast('牆上的畫歪了一點……後面好像有東西');
  const n = Math.floor(motors.props.safe.lazarus || 0);
  if (n < 1) return toast('保險箱是空的');
  estCollect('lazarus'); v7CS().full = 0; sfx.pickup();
}
function v7Pc() {
  if (!clubOwned()) return toast('電腦鎖著');
  const C = v7CS(), day = Math.floor(Date.now() / (CLUB_DAY * 1000));
  dialog('LAZARUS · 老闆電腦', `人氣 ${C.pop.toFixed(1)}% · 每日收入 ${money(clubDaily())} · 保險箱 ${money(Math.floor(motors.props.safe.lazarus || 0))}／${money(SAFE_CAP)}\n今晚的 DJ：${DJS[C.dj].name} · 技術員 ${C.hired}／${TECH_N} · 地下室庫存 ${goodsCount()} 箱（${money(goodsValue())}）`, [
    { t: C.djDay === day ? `預約 DJ（今天已經換過）` : `預約 DJ（${money(DJ_FEE)} · 人氣 +${DJ_POP}%）`, fn: () => { closeDialog(); if (C.djDay !== day) v7DjMenu(); else toast('今天已經換過 DJ 了，明天再說'); } },
    { t: '技術員分派', fn: () => { closeDialog(); v7TechMenu(); } },
    { t: '離開', fn: closeDialog },
  ]);
}
function v7DjMenu() {
  const C = v7CS();
  dialog('預約 DJ', '今晚誰上台？', [...DJS.map((d, i) => ({ t: i === C.dj ? `${d.name}（現在的）` : d.name, fn: () => {
    closeDialog(); if (i === C.dj) return;
    if (motors.cash < DJ_FEE) { toast('錢不夠'); sfx.dry(); return; }
    motors.cash -= DJ_FEE; C.dj = i; C.djDay = Math.floor(Date.now() / (CLUB_DAY * 1000)); v7Pop(DJ_POP); saveMotors(); sfx.pickup();
    toast(`${d.name} 今晚駐場 · 人氣 +${DJ_POP}%`);
  } })), { t: '算了', fn: closeDialog }]);
}
function v7TechMenu() {
  const C = v7CS(), opts = [];
  for (let i = 0; i < C.hired; i++) { const g = GOOD[C.job[i]]; opts.push({ t: `技術員 ${i + 1}：${g ? `${g.name}（${C.goods[g.id]}／${g.cap}）` : '閒著'}`, fn: () => { closeDialog(); v7TechJob(i); } }); }
  if (C.hired < TECH_N) { const fee = C.hired ? TECH_FEE : 0; opts.push({ t: `雇用技術員 ${C.hired + 1}（${fee ? money(fee) : '免費'}）`, fn: () => { closeDialog(); if (motors.cash < fee) { toast('錢不夠'); sfx.dry(); return; } motors.cash -= fee; C.hired++; saveMotors(); cbSync(); sfx.pickup(); toast(`雇了技術員 ${C.hired} · 到電腦分派他做哪種貨`); v7TechJob(C.hired - 1); } }); }
  opts.push({ t: '返回', fn: () => { closeDialog(); v7Pc(); } });
  dialog('技術員分派', '每位技術員負責一種貨，庫存滿了就停工。', opts);
}
function v7TechJob(i) {
  const C = v7CS();
  dialog(`技術員 ${i + 1}`, '要他負責哪一種貨？', [
    ...GOODS.map(g => ({ t: `${g.name}（${g.what}）· ${money(g.unit)}／箱 · ${g.t} 秒一箱 · 上限 ${g.cap}${goodOk(g) ? '' : ' · 要先買下地堡'}`, fn: () => { closeDialog(); if (!goodOk(g)) return toast('運動用品的貨源是地堡：先在天際置業買下北嶺地堡'); C.job[i] = g.id; C.gT[i] = 0; saveMotors(); toast(`技術員 ${i + 1} 開始做${g.name}`); } })),
    { t: '閒著', fn: () => { closeDialog(); C.job[i] = null; saveMotors(); } },
  ]);
}
// B1 的管理電腦：庫存、全部出售
function v7Stock() {
  if (!clubOwned()) return;
  const C = v7CS(), val = goodsValue(), fee = launderFee(val);
  dialog('LAZARUS B1 · 物流管理', GOODS.map(g => `${g.name} ${C.goods[g.id]}／${g.cap} 箱 · ${money(C.goods[g.id] * g.unit)}`).join('\n') + `\n合計 ${money(val)} · 洗錢仲介抽成 ${money(fee)}（10%，最多 ${money(LAUNDER_CAP)}）`, [
    { t: val ? `全部出售（實拿 ${money(val - fee)}）` : '全部出售（倉庫是空的）', fn: () => { closeDialog(); if (val) v7SellStart(); } },
    { t: '離開', fn: closeDialog },
  ]);
}

// ─── 全部出售：夜梟改裝廂型車（車頂砲塔、感應地雷） ───
function v7Turret() {
  const k = new Kit();
  k.cyl(0, 0, 0, .55, .6, .25, 18, 0x2a2c30, 15).box(0, .35, -.1, .7, .45, .8, 0x1a1c20, 15);
  for (const s of [-1, 1]) k.box(s * .16, .4, .75, .07, .07, 1.3, 0x0e0f10, 15).box(s * .16, .4, 1.42, .1, .1, .08, 0x2a2c30, 3);
  const g = new T.Group(), m = new T.Mesh(k.build(), MAT.uber); g.add(m); g.userData.gun = m; return g;
}
// Danish337 的 Armored Van（props/v7van.glb，5 × 3.37 × 3.23 m 的卡通比例）：以 http(s) 開啟時蓋掉 shvan 的車身，
// 壓成 2.4 × 4.5 m、車頂 2.3 m，車長車寬跟著改（碰撞與輪距照新的算）；砲塔移到箱型車廂頂上。下載失敗就留著 shvan
function v7VanBody(v) {
  if (!GLB_ON) return;
  loadProps('v7van').then(items => {
    if (!items || !items.van || v.dead || !v.g.parent) return;
    const o = propObject(items.van, 0, 0, 0), sx = 2.4 / 3.37, sy = 2.3 / 3.23, sz = 4.5 / 5;
    o.scale.set(sx, sy, sz); v.body.children[0].visible = false; v.body.add(o);
    v.len = 4.5; v.w = 2.4; v.rad = v.w / 2 + .05; v.off = v.len * .28; v.wb = v.len * .58;
    if (v.tur) v.tur.position.set(0, 2.32, -.6);
  });
}
const v7MineGeo = (() => { const k = new Kit(); k.cyl(0, .06, 0, .28, .32, .12, 14, 0x2a2c30, 15).cyl(0, .14, 0, .05, .05, .04, 8, 0xff2020, 8); return k.build(); })();
function v7SellStart() {
  const why = side.act ? `${side.act.name}還沒結束` : W.stars ? '先甩掉警察' : heist.st !== 'off' && heist.st !== 'plan' ? '搶劫進行中' : '';
  if (why) return toast(why);
  const C = v7CS(), val = goodsValue(), fee = launderFee(val), n = goodsCount();
  transition(() => {
    setWhere('out'); clubLevel(0); clubBLevel(0);
    const o = VENUES.club.out, sp = rnLaneSpot(o.x, o.z, 6);
    const v = buildVeh('shvan', sp.x, sp.z, sp.yaw, 0, 3, 1, 'club');
    v.name = '夜梟改裝廂型車'; v.hp *= 3; v.hpMax = v.hp; v.armorK = .5; v.y = groundH(v.x, v.z);
    const tur = v7Turret(); tur.position.set(0, 2.25, -.4); v.g.add(tur); v.tur = tur; v7VanBody(v);
    poseVehicle(v); enterVehicle(v); camState.yaw = v.yaw; camState.pitch = .1;
    // 買家：500–1100 m 外的路口
    const cand = RN.nodes.filter(nd => { const d = Math.hypot(nd.x - v.x, nd.z - v.z); return d > 500 && d < 1100; });
    const nd = cand[Math.floor(Math.random() * cand.length)] || RN.nodes[0], dest = rnLaneSpot(nd.x, nd.z, 8);
    const S = V7C.sell = { v, val, fee, n, dest, t: 0, mines: MINE_N, fireT: 0, chased: false, goods: { ...C.goods } };
    for (const g of GOODS) C.goods[g.id] = 0;   // 貨裝上車了：車毀了就沒了
    saveMotors(); cbSync();
    gpsSet(dest.x, dest.z);
    sideStart({
      kind: 'clubsell', name: 'LAZARUS 出貨', label: '<b>LAZARUS</b> 出貨',
      step(dt) {
        S.t += dt;
        if (!v || v.dead) return this.fail('廂型車被炸了，貨全沒了');
        if (player.veh !== v && Math.hypot(pX() - v.x, pZ() - v.z) > 80) return this.fail('把廂型車丟下了');
        if (!S.chased && S.t > 10) { S.chased = true; if (gangChase('LAZARUS 的貨', 2)) v7Sms(KADE, `${GANG_NAME}盯上這批貨了，用車頂的砲塔招呼他們，E 往後丟地雷。`); }
        if (Math.hypot(v.x - dest.x, v.z - dest.z) < 12 && Math.hypot(v.vx, v.vz) < 3) {
          const pay = val - fee;
          if (player.veh === v) exitVehicle();
          sideEnd(); heistVehGone(v); V7C.sell = null;
          earn(pay, `LAZARUS 出貨 ${n} 箱`);
          sideDone('出貨完成', '買家收下了整批貨', [['貨值', money(val)], ['洗錢仲介抽成', `−${money(fee)}`], ['箱數', `${n} 箱`], ['實拿', money(pay)]], 3);
        }
      },
      hud() { const hp = v.hpMax ? v.hp / v.hpMax * 100 : 100; return { text: `把貨送到買家那裡 · 左鍵砲塔、E 地雷（剩 ${S.mines}）`, bar: hp, num: money(val - fee), low: hp < 30 }; },
      mark() { return { name: '買家', x: dest.x, y: 2.2, z: dest.z, where: 'out' }; },
      fail(why) { toast(`出貨失敗：${why}`); sideEnd(); if (v && !v.dead) heistVehGone(v); V7C.sell = null; },
      clear() { gpsClear(); },
    });
    toast(`夜梟改裝廂型車載著 ${n} 箱貨 · 滑鼠轉砲塔、左鍵開火、E 往後丟地雷`);
  });
}
// 砲塔：每幀跟著鏡頭轉，按住左鍵連發（69-combat.js 的 triggerDown 先問 v7Trigger）
function v7TurretStep(dt) {
  const S = V7C.sell; if (!S) return;
  const v = S.v, tur = v.tur; if (!tur) return;
  tur.rotation.y = camState.yaw - v.yaw;
  tur.userData.gun.rotation.x = -clamp(camState.pitch - .1, -.3, .5);
  S.fireT -= dt;
  if (player.veh !== v || !arm.trig || S.fireT > 0 || life.dead) return;
  S.fireT = .085;
  const R = aimRay(), hit = castRay(R, 320, v);
  const a = camState.yaw, mx = v.x + Math.sin(a) * 1.5, mz = v.z + Math.cos(a) * 1.5, my = (v.y || 0) + 2.65;
  const x = R.ox + R.dx * hit.t, y = R.oy + R.dy * hit.t, z = R.oz + R.dz * hit.t;
  tracer(mx, my, mz, x, y, z, 1.3); muzzleFx(mx, my, mz, 1.3); sfx.gun(1, 2);
  camState.shake = Math.max(camState.shake, .15);
  hitWith(hit, R, 46, 'player', 1.6, 0);
}
function v7Mine() {
  const S = V7C.sell; if (!S || S.mines <= 0) return;
  const v = S.v, bx = v.x - Math.sin(v.yaw) * (v.len / 2 + .8), bz = v.z - Math.cos(v.yaw) * (v.len / 2 + .8);
  const m = new T.Mesh(v7MineGeo, MAT.uber); m.position.set(bx, groundH(bx, bz), bz); scene.add(m);
  V7C.mines.push({ x: bx, z: bz, m, t: 0 }); S.mines--; sfx.bounce();
}
function v7MineStep(dt) {
  for (let i = V7C.mines.length - 1; i >= 0; i--) {
    const M = V7C.mines[i]; M.t += dt;
    let boom = M.t > 120;
    if (M.t > 1.2 && !boom) {
      for (const v of vehicles) if (!v.dead && v !== (V7C.sell && V7C.sell.v) && v !== kestrel && Math.hypot(v.x - M.x, v.z - M.z) < 3.2) { boom = true; break; }
      if (!boom) for (const c of traffic) if (Math.hypot(c.x - M.x, c.z - M.z) < 3) { boom = true; break; }
    }
    if (boom) { if (M.t <= 120) blast(M.x, .4, M.z, 6.5, 320, 'player', V7C.sell && V7C.sell.v); M.m.removeFromParent(); V7C.mines.splice(i, 1); }
  }
}
// 69-combat.js 的 triggerDown：砲塔與舞池節奏小遊戲吃掉左鍵
function v7Trigger() {
  if (V7C.sell && player.mode === 'drive' && player.veh === V7C.sell.v) return true;
  if (V7C.beat) { v7BeatHit(); return true; }
  return false;
}

// ─── 互動提示 ───
ctxHooks.push((p, near) => {
  if (p.mode === 'drive') { const S = V7C.sell; return S && p.veh === S.v && S.mines > 0 ? { key: 'E', text: `投放感應地雷 <i>· 剩 ${S.mines}</i>`, fn: v7Mine } : null; }
  if (p.where === 'club') {
    const lv = VENUES.club.lv, T0 = V7C.trouble;
    if (lv === 0) {
      if (T0 && near(T0.x, T0.z, 1.8)) return { key: 'E', text: T0.ctx, fn: T0.kind === 'A' ? v7TroubleA : v7TroubleB };
      if (near(V7_STAIR0.x, V7_STAIR0.z, 1.5)) return { key: 'E', text: '上二樓 <i>· VIP 區、酒廊、辦公室</i>', fn: () => clubStairs(true) };
      if (near(V7_FREEZER.x + .5, V7_FREEZER.z, 1.6)) return { key: 'E', text: clubOwned() ? '冷凍庫貨梯 <i>· 地下 B1–B5</i>' : '冷凍庫 <i>· 員工專用</i>', fn: v7Lift };
      if (near(V7_BACK.x - .5, V7_BACK.z, 1.4)) return { key: 'E', text: '從後門出去', fn: exitVenue };
      if (near(-8.6, 12.5, 2.2)) return { key: 'E', text: '吧台 <i>· 啤酒、香檳、馬克白威士忌</i>', fn: v7Bar };
      if (!V7C.beat && Math.abs(p.x) < 6 && p.z > 13 && p.z < 25 && !V7C.drink) return { key: 'E', text: '節奏挑戰 <i>· 跟著拍子按空白鍵</i>', fn: v7BeatStart };
      if (V7C.beat) return { key: 'E', text: '結束節奏挑戰', fn: v7BeatEnd };
    } else {
      if (near(V7_STAIR1.x, V7_STAIR1.z, 1.5)) return { key: 'E', text: '下樓', fn: () => clubStairs(false) };
      if (near(V7_SAFE.x, V7_SAFE.z + .3, 1.3)) return { key: 'E', text: clubOwned() ? `牆上的保險箱 <i>· ${money(Math.floor(motors.props.safe.lazarus || 0))}</i>` : '牆上的畫', fn: v7Safe };
      if (near(V7_DESK.x, V7_DESK.z + .3, 1.4)) return { key: 'E', text: clubOwned() ? '老闆電腦 <i>· DJ、技術員</i>' : '電腦', fn: v7Pc };
      if (!clubOwned() && near(-7.2, 5.6, 1.4) && v7CS().pop <= VIP_POP) return { key: 'E', text: 'VIP 區 <i>· 拉著紅絨繩</i>', fn: () => toast(`保鑣：「今晚的 VIP 只開給人氣滿檔的時候（${VIP_POP}% 以上）。」`) };
      if (!clubOwned() && near(6.2, 5.6, 1.4)) return { key: 'E', text: '辦公室 <i>· 鎖著</i>', fn: () => toast('門上寫著：老闆辦公室，閒人勿進') };
    }
  } else if (p.where === 'clubB') {
    if (near(CB_LIFT.x, CB_LIFT.z, 1.6)) return { key: 'E', text: '貨梯', fn: v7Lift };
    if (VENUES.clubB.lv === 0) {
      if (near(CB_PC.x, CB_PC.z + .6, 1.4)) return { key: 'E', text: `物流管理電腦 <i>· ${goodsCount()} 箱 · ${money(goodsValue())}</i>`, fn: v7Stock };
      for (let i = 0; i < v7CS().hired; i++) { const T0 = CB_TERM[i]; if (near(T0.x - .8, T0.z, 1.2)) { const g = GOOD[v7CS().job[i]]; return { key: 'E', text: `技術員 ${i + 1} <i>· ${g ? g.name : '閒著'}</i>`, fn: () => v7TechJob(i) }; } }
      if (near(CB_VAN.x - 1.6, CB_VAN.z, 1.6)) return { key: 'E', text: '夜梟改裝廂型車 <i>· 出貨用</i>', fn: v7Stock };
    }
  }
  return null;
});

// ─── 每幀（99-main.js 的 step） ───
function v7ClubUpdate(dt) {
  clubTick(dt);
  v7DoorSync();
  v7CrowdSync();
  v7TroubleStep(dt);
  v7BeatStep(dt);
  v7DrinkStep(dt);
  v7TurretStep(dt);
  v7MineStep(dt);
  if (player.where !== 'club' && VENUES.club.lv) clubLevel(0);
  if (player.where === 'club') {
    // 1 樓加上 DJ 光環、冷凍庫、洗手間的燈；2 樓看得到 1 樓的燈
    const dj = lin(DJS[v7CS().dj].col), b = sfx.beat(), k = .7 + .3 * Math.exp(-(b % 1) * 3);
    club.lights.push({ x: 0, y: 2.4, z: 28.6, col: dj, r: 8, i: 1.4 * k }, { x: -10.6, y: 2.4, z: 23.2, col: lin(0x80ffc0), r: 4, i: .6 }, { x: -7.2, y: 2.8, z: 3, col: lin(0xd0e0ff), r: 6, i: .7 });
    club2.lights.length = 0; club2.lights.push(...V7_MEZ_LIGHTS, ...club.lights);
    if (V7C.trouble) v7BadMark.scale.setScalar(1 + .15 * Math.sin(uTimeNow() * 6));
  }
  if (V7C.hang > 0) { V7C.hang = Math.max(0, V7C.hang - dt); post.wobble = Math.max(post.wobble, V7C.hang / 15 * .9); }
  if (V7C.under > 0) { V7C.under -= dt; if (V7C.under <= 0 || (player.where !== 'out' && !V7C.drink)) { V7C.under = 0; v7Underwear(false); } }
  if ((V7C.saveT += dt) > 10) { V7C.saveT = 0; if (clubOwned()) saveMotors(); }
}
function v7ClubKey(code) {
  if (code === 'Space' && V7C.beat) { v7BeatHit(); return true; }
  return false;
}
// 小地圖：鬧事的藍點、出貨的買家
function v7ClubMini(ctx, P2, zoom) {
  if (V7C.trouble) {
    const d = VENUES.club.door, [x, y] = P2(d.x, d.z), s = 1 / zoom, pulse = 1 + .25 * Math.sin(uTimeNow() * 5);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = '#3a8aff'; ctx.beginPath(); ctx.arc(0, 0, 6 * pulse, 0, 6.283); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
  }
}
cbSync(); v7DoorSync();

// ═══ 第七部曲的入口：99-main.js 的 step 呼叫 v7Update、69-combat.js 的 gtaKey 最先問 v7Key、90-hud.js 的小地圖呼叫 v7Mini ═══
function v7Update(dt) {
  v7BunkerUpdate(dt); v7CasinoUpdate(dt); v7ClubUpdate(dt);
  V7FX.blur = V7C.hang / 15;
  V7FX.therm = V7B.therm && thermOk() && arm.zoomK > .5 ? 1 : 0;
}
function v7Key(code) { return v7CasinoKey(code) || v7ClubKey(code) || mkKey(code); }
function v7Mini(ctx, P2, zoom) { v7BunkerMini(ctx, P2, zoom); v7CasinoMini(ctx, P2, zoom); v7ClubMini(ctx, P2, zoom); }

// 測試 API（window.__nc.gta.v7；node tools/check-gta-v7.mjs）
gtaApi.v7 = {
  FX: V7FX, key: v7Key,
  club: {
    V7C, GOODS, DJS, st: v7CS, owned: clubOwned, daily: clubDaily, tick: clubTick, pop: n => { v7CS().pop = clamp(n, 0, 100); V7C.crowdN = -1; v7CrowdSync(); }, crowdN: () => V7C.crowdN,
    level: clubLevel, stairs: clubStairs, lift: v7LiftTo, sync: cbSync, value: goodsValue, count: goodsCount, fee: launderFee,
    beat: { start: v7BeatStart, hit: v7BeatHit, end: v7BeatEnd, st: () => V7C.beat }, trouble: { start: v7TroubleStart, st: () => V7C.trouble, a: v7TroubleA, b: v7TroubleB, clear: v7TroubleClear },
    macbeth: v7Macbeth, drinkStep: v7DrinkStep, last: () => V7C.last, under: () => V7C.under, spots: BLACKOUT.map(b => b.id), drink: () => V7C.drink, hang: () => V7C.hang, sell: v7SellStart, selling: () => V7C.sell, mine: v7Mine, mines: () => V7C.mines.length,
    safe: () => motors.props.safe.lazarus || 0, dj: v7DjMenu, techJob: (i, id) => { v7CS().job[i] = id; },
  },
  bunker: {
    V7B, AMMO: AMMO7, RESEARCH, st: v7BS, owned: bunkerOwned, tick: bunkerTick, unl: resUnl, door: () => BUNK.on && bunkerDoorW(), fort: FORT, inFort, fortPad,
    enter: () => bunkerEnter(null), exit: bunkerExit, sup: bunkerSupStart, supSt: () => V7B.sup, sell: bunkerSellStart, selling: () => V7B.sell,
    mk: id => mkOf(id), ammo: id => mkAmmo(id), cycle: mkCycle, therm: () => V7B.therm, thermOk, heat: (out = new Float32Array(800)) => heatPts(pX(), pZ(), out, 160),
  },
  casino: {
    CAS, APPS: CAS_APPS, TGT: CAS_TGT, WHEEL, st: v7KS, on: () => CASX.on, door: () => CASX.on && casW(CAS_DOOR.x, CAS_DOOR.z), w: (x, z) => casW(x, z), enter: casEnter,
    spin: wheelSpin, ready: wheelReady, wheelStep, SLOT_SYM, SLOT_STRIP, hstep: dt => CAS.h && casHeistStep(CAS.h, dt), gs: () => casGS, bj: { start: bjStart, val: bjVal }, tcp: { rank: tcpRank, start: tcpStart }, slot: slotSpin, track: trackRun, deck, rl: { spin: rlSpin, step: rlStep, BETS: RL_BETS, st: () => CAS.rl }, vault: () => casBDoors.m1.a, vdoor: casDoor,
    plan: casPlan, h: () => CAS.h, breach: how => CAS.h && casBreach(CAS.h, how), card: casCard, gate: casGateAct, daily: casDailyAct, leave: casLeave, alarm: () => CAS.h && casAlarm(CAS.h),
    guards: () => casGS.map(g => ({ x: g.x, z: g.z, st: g.st })), takedown: i => casTakedown(casGS[i]), end: casHeistEnd, doors: () => Object.fromEntries(Object.entries(casBDoors).map(([k, d]) => [k, d.open])),
  },
};
