// ═══ 第四階段：霓虹證交所（股市）與天際置業（可購買資產） ═══
// 股市：三組死對頭企業。每分鐘（真實時間）隨機 ±1% 並向基準價回歸（半衰期 10 分鐘）；
// 玩家破壞 A 企業的實體目標時 A 價 ×max(0.2, 1 − δ + ε)、B 價 ×(1 + 0.85δ + ε)，δ = 0.08，價格限制在基準的 0.2–3.5 倍。
//   鐵庫保全 IVLT（運鈔車，69-events.js）↔ 哨衛防務 SNTL；凡托超跑 VNTR（Milano 與 Tiara GT 被你炸毀）↔ 蛟重工 MZCH；
//   流明電訊 LMNT（路邊的藍色電訊箱，射擊、爆炸或開車撞爛；爛掉時會炸開）↔ 脈線科技 PLSW。
// 資產：LAZARUS、AFTERGLOW、CHROME WORKS 三處可以從手機買下，每遊戲小時（150 秒）把收入存進各自的保險箱（有上限），從手機收取。
// 股價、持股與資產都跟現金一樣即時寫進 nc260.motors（存檔第 3 版的 stk、props 欄位）。
// 關著遊戲的期間（第 4 版的 ts 到現在，最多算 24 小時）開場時補算：股價照同樣的規則回歸與漂移，資產照遊戲時間累積收入。
// 資產防守失敗（69-squads.js）會停業 10 分鐘：props.pause 記著停到什麼時候（真實時間），期間不累積收入。
// 排在 69-heist 之後、69-phone 之前；頂層只用到 68 以前的東西（rayHooks、boxesN、boxesMs）。

const STOCKS = [
  { id: 'IVLT', name: '鐵庫保全', ind: '保全', base: 84, rival: 'SNTL', tgt: '鐵庫保全運鈔車' },
  { id: 'SNTL', name: '哨衛防務', ind: '保全', base: 61 },
  { id: 'VNTR', name: '凡托超跑', ind: '車廠', base: 142, rival: 'MZCH', tgt: '路上的 Milano 與 Tiara GT' },
  { id: 'MZCH', name: '蛟重工', ind: '車廠', base: 97 },
  { id: 'LMNT', name: '流明電訊', ind: '電信', base: 38, rival: 'PLSW', tgt: '路邊的藍色電訊箱' },
  { id: 'PLSW', name: '脈線科技', ind: '電信', base: 23 },
];
const STK = Object.fromEntries(STOCKS.map(s => [s.id, s]));
const VNTR_TYPES = ['milano', 'tiara'], SHOCK = .08;
const mk = { t: 60, prev: {} };
// motors.stk = { px: {id: 價}, sh: {id: 股數}, cost: {id: 總成本} }（65-motors.js 讀檔時檢查過）
function stkInit() {
  const s = motors.stk ||= { px: {}, sh: {}, cost: {} };
  for (const st of STOCKS) { if (!(s.px[st.id] > 0)) s.px[st.id] = st.base; s.sh[st.id] ||= 0; s.cost[st.id] ||= 0; mk.prev[st.id] = s.px[st.id]; }
}
const eps = () => (Math.random() * 2 - 1) * .01;
const pxClamp = (id, p) => clamp(p, STK[id].base * .2, STK[id].base * 3.5);
function stockShock(id) {
  const A = STK[id], px = motors.stk.px;
  if (!A || !A.rival) return;
  if (uTimeNow() - (mk.newsT || -99) > 60) { mk.newsT = uTimeNow(); news.unshift({ h: `${A.name}的${A.tgt.replace(/^路上的|^路邊的/, '')}遭破壞，股價重挫`, b: `${A.rival} ${STK[A.rival].name}應聲上漲。`, when: clockTxt() }); }
  px[id] = pxClamp(id, px[id] * Math.max(.2, 1 - SHOCK + eps()));
  px[A.rival] = pxClamp(A.rival, px[A.rival] * (1 + .85 * SHOCK + eps()));
  saveMotors();
}
function stockTick() {
  const px = motors.stk.px, k = 1 - Math.pow(.5, 1 / 10);
  for (const s of STOCKS) { mk.prev[s.id] = px[s.id]; px[s.id] = pxClamp(s.id, (px[s.id] + (s.base - px[s.id]) * k) * (1 + eps())); }
  saveMotors();
}
function stockBuy(id, amt) {
  const s = motors.stk, p = s.px[id], n = Math.floor(Math.min(amt, motors.cash) / p);
  if (n < 1) return 0;
  motors.cash -= n * p; s.sh[id] += n; s.cost[id] += n * p; saveMotors();
  return n;
}
function stockSell(id) {
  const s = motors.stk, n = s.sh[id];
  if (!n) return 0;
  const got = n * s.px[id];
  motors.cash += got; s.sh[id] = 0; s.cost[id] = 0; saveMotors();
  return got;
}
const fmtPx = p => '$' + p.toFixed(2);
const chg = id => { const a = mk.prev[id], b = motors.stk.px[id]; return a ? (b - a) / a * 100 : 0; };

// ─── 流明電訊的藍色電訊箱（20-props.js 的 boxesN）：生命 60，爛掉時火花＋小爆炸，可能連鎖 ───
const boxHp = boxesN.map(() => 60);
rayHooks.push((R, hit) => {
  for (let k = 0; k < boxesN.length; k++) {
    const b = boxesN[k];
    if (boxHp[k] <= 0 || Math.abs(b.x - R.ox) > 120 || Math.abs(b.z - R.oz) > 120) continue;
    hit(rayCyl(R, b.x, b.z, .5, .15, 1.3), 'ebox', k);
  }
});
const _bm = new T.Matrix4().makeScale(0, 0, 0);
function boxHit(k, dmg, mine) {
  if (boxHp[k] <= 0) return;
  const b = boxesN[k];
  boxHp[k] -= dmg; sparks(b.x, .9, b.z, 8, 3);
  if (boxHp[k] > 0) return;
  for (const m of boxesMs) instSet(m, k, _bm);
  const ci = circles.findIndex(c => c.x === b.x && c.z === b.z); if (ci >= 0) { circles.splice(ci, 1); colDirty(); }
  sparks(b.x, .8, b.z, 40, 7);
  blast(b.x, .6, b.z, 4, 70, mine ? 'player' : null);
  if (mine) stockShock('LMNT');
}
function boxBlast(x, z, r, mine) {
  for (let k = 0; k < boxesN.length; k++) if (boxHp[k] > 0 && Math.hypot(boxesN[k].x - x, boxesN[k].z - z) < r * .6) boxHit(k, 999, mine);
}
// 開車撞：時速 30 以上擦到就爛
function boxRam(v) {
  const sp = Math.hypot(v.vx, v.vz);
  if (sp < 8) return;
  for (let k = 0; k < boxesN.length; k++) if (boxHp[k] > 0 && Math.hypot(boxesN[k].x - v.x, boxesN[k].z - v.z) < v.w / 2 + .6) boxHit(k, 999, true);
}
// 68-gta.js 的 explode() 呼叫：你炸掉的凡托車款
function marketExplode(v, mine) { if (mine && VNTR_TYPES.includes(v.type)) stockShock('VNTR'); }

// ─── 天際置業：資產 ───
const ESTATES = [
  { id: 'lazarus', name: 'LAZARUS 夜店', price: 250000, rate: 0, cap: 250000, def: 9600, blurb: '保險箱每日 $1,500–$50,000（照人氣）' },   // 69-v7-club.js：保險箱收入照人氣算（每日 1500 + 48500 × (P/100)²），上限 $250,000
  { id: 'bunker', name: '北嶺地堡', price: 1150000, rate: 0, cap: 0, blurb: '軍火製造與 Mk II 研究' },   // 69-v7-bunker.js：收入是出貨，不進保險箱
  { id: 'afterglow', name: 'AFTERGLOW 酒吧', price: 120000, rate: 1100, cap: 22000 },
  { id: 'chrome', name: 'CHROME WORKS 改裝廠', price: 350000, rate: 1700, cap: 34000 },   // 69-v6-customs.js：門口的待售告示牌也能買；老闆 Kael 修車改裝全免、接客戶委託
  // 安全屋（69-safehouse.js）：買了可以進去睡覺存檔；不在家時短租出去，租金照售價約 0.16%／遊戲小時存進保險箱（進門時自動收下，或用手機收）
  { id: 'loft', name: '冠石頂層公寓', price: 380000, rate: 600, cap: 12000, home: true },
  { id: 'villa', name: '雲杉坡崖邊別墅', price: 600000, rate: 950, cap: 19000, home: true },
  // 第三輪：島上辦公室的收入是生意（在辦公桌或手機收），其他三間一樣是短租
  { id: 'office', name: '灰鷗島辦公室', price: 520000, rate: 900, cap: 18000, home: true },
  { id: 'mini', name: '楓林里迷你閣樓', price: 160000, rate: 260, cap: 5200, home: true },
  { id: 'l16', name: '琥珀和室 Loft', price: 340000, rate: 540, cap: 10800, home: true },
  { id: 'i14', name: '公園大道白色大宅', price: 480000, rate: 760, cap: 15200, home: true },
  { id: 'lr', name: '珊瑚灘清水模公寓', price: 220000, rate: 350, cap: 7000, home: true },
];
const GAME_HOUR = 60 * MIN_SEC;   // 28-sky.js 的時鐘：遊戲裡一分鐘 = MIN_SEC 秒（一小時 100 秒）
// motors.props = { own: [id], safe: {id: 金額} }
function estInit() { const p = motors.props ||= { own: [], safe: {} }; p.pause ||= {}; for (const id in p.pause) if (p.pause[id] < Date.now()) delete p.pause[id]; p.own = p.own.filter((id, i, a) => ESTATES.some(e => e.id === id) && a.indexOf(id) === i); for (const e of ESTATES) p.safe[e.id] = Math.min(e.cap, p.safe[e.id] || 0); }
const estOwned = id => motors.props.own.includes(id);
function estBuy(id) {
  const e = ESTATES.find(o => o.id === id);
  if (!e || estOwned(id) || motors.cash < e.price) return false;
  motors.cash -= e.price; motors.props.own.push(id); motors.props.safe[id] = 0; saveMotors();
  return true;
}
function estCollect(id) {
  const n = Math.floor(motors.props.safe[id] || 0);
  if (n < 1) return 0;
  motors.props.safe[id] = 0; earn(n, `${ESTATES.find(o => o.id === id).name}收入`);
  return n;
}
const paused = id => motors.props.pause[id] > Date.now();
const gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += Math.random(); return (u - 3) / Math.SQRT1_2; };
function marketOffline(ts, now = Date.now()) {
  const min = Math.min(1440, (now - ts) / 60000);
  if (!(ts > 0) || !(min >= 1)) return null;
  const px = motors.stk.px, k = Math.pow(.5, min / 10), n = Math.min(min, 60);
  for (const s of STOCKS) { mk.prev[s.id] = px[s.id]; px[s.id] = pxClamp(s.id, (s.base + (px[s.id] - s.base) * k) * Math.exp(gauss() * .01 * Math.sqrt(n))); }
  const P = motors.props, sec = min * 60;
  let cash = 0;
  for (const e of ESTATES) {
    if (!estOwned(e.id) || !e.rate) continue;
    const off = P.pause[e.id] > ts ? Math.min(sec, (P.pause[e.id] - ts) / 1000) : 0;   // 停業的那段不算
    const add = Math.min(e.cap - P.safe[e.id], e.rate * Math.max(0, sec - off) / GAME_HOUR);
    if (add > 0) { P.safe[e.id] += add; cash += add; }
  }
  saveMotors();
  return { min, cash: Math.floor(cash) };
}
// ─── 霓虹新聞台（手機的「新聞」）：這次開遊戲以來的大事（搶劫、運鈔車、懸賞、地盤……由各檔 newsAdd），
// 加上關掉遊戲那段時間的新聞：依離開多久挑 1–4 則，股票新聞會真的讓股價跳動（只活在這次開遊戲，不寫進存檔） ───
const news = [];
const clockTxt = () => { const m = Math.floor(clockSt.min); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
function newsAdd(h, b = '', when = null) {
  news.unshift({ h, b, when: when || clockTxt() });
  if (news.length > 30) news.length = 30;
  if (started && !when) toast(`霓虹新聞台：${h}`);
}
const OFF_NEWS = [
  { h: '鐵庫保全運鈔車隊加派護衛', b: '連續幾起劫案之後，鐵庫保全宣布每台車多一名武裝押運員，股價走高。', st: ['IVLT', .05] },
  { h: '哨衛防務拿下市府監控合約', b: '全市路口攝影機的維護交給哨衛防務，為期五年。', st: ['SNTL', .07] },
  { h: '凡托超跑召回兩千台新車', b: '油路設計瑕疵，車主可到原廠免費更換。', st: ['VNTR', -.08] },
  { h: '蛟重工琥珀工業區新廠動工', b: '新廠預計明年投產，帶來八百個工作機會。', st: ['MZCH', .06] },
  { h: '流明電訊大停線，客服專線被打爆', b: '中城與光環廣場一帶斷線將近兩小時。', st: ['LMNT', -.07] },
  { h: '脈線科技發表新一代通訊晶片', b: '發表會門票秒殺，盤後股價大漲。', st: ['PLSW', .08] },
  { h: '凡托超跑新車款預購破紀錄', b: '全新雙門跑車開放預購，三天內訂滿一年產能。', st: ['VNTR', .06] },
  { h: '哨衛防務高層涉嫌圍標', b: '檢方搜索總部，帶走多箱文件。', st: ['SNTL', -.06] },
  { h: '灰鷗大橋夜間封閉檢修', b: '拉索例行檢查，凌晨一點到五點單向管制。' },
  { h: '燈籠公園夜市延長營業', b: '週末攤位開到凌晨兩點，紅燈籠步道人潮不斷。' },
  { h: '第九分局取締霓虹區街頭賽車', b: '昨夜攔下十四輛改裝車，警方呼籲別在市區飆車。' },
  { h: '錨灣港貨櫃量創新高', b: '貨櫃船排隊進港，岸橋三班制運轉。' },
  { h: '北嶺國家公園初雪', b: '山區低溫，前往步道請注意結冰路段。' },
  { h: '赤蠍幫火拼波及路人', b: '警方加強楓林里與琥珀工業區的巡邏。' },
];
function newsOffline(min) {
  if (!(min >= 1)) return 0;
  const n = Math.min(4, 1 + Math.floor(min / 90)), pool = OFF_NEWS.slice(), px = motors.stk.px;
  for (let i = 0; i < n && pool.length; i++) {
    const e = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    if (e.st) { const [id, d] = e.st; px[id] = pxClamp(id, px[id] * (1 + d + eps())); }
    news.push({ h: e.h, b: e.b, when: '離線期間' });
  }
  saveMotors();
  return n;
}
stkInit(); estInit();
mk.away = marketOffline(lastTs); mk.awayT = 4;
if (mk.away) mk.away.news = newsOffline(mk.away.min);
const awayText = m => m < 60 ? `${Math.round(m)} 分鐘` : m < 1440 ? `${Math.round(m / 60)} 小時` : '一整天';
function marketUpdate(dt) {
  // 開場 4 秒後告訴玩家離開期間的變化（有持股或資產才說）
  if (mk.away && started && (mk.awayT -= slowmo.raw) <= 0) {
    const a = mk.away, sh = STOCKS.some(s => motors.stk.sh[s.id] > 0);
    mk.away = null;
    if (a.cash || sh || a.news) toast(`離開了${awayText(a.min)}${a.cash ? `：資產保險箱多了 ${money(a.cash)}` : ''}${sh ? `${a.cash ? '，' : '：'}股價也動了` : ''}${a.news ? `（手機「新聞」有 ${a.news} 則）` : ''}`);
  }
  if ((mk.t -= slowmo.raw) <= 0) { mk.t = 60; stockTick(); }
  for (const e of ESTATES) if (estOwned(e.id) && !paused(e.id)) motors.props.safe[e.id] = Math.min(e.cap, motors.props.safe[e.id] + e.rate * dt / GAME_HOUR);
  if (player.mode === 'drive' && player.where === 'out') boxRam(player.veh);
}

// 測試 API（window.__nc.gta.market）
const marketApi = { STOCKS, ESTATES, mk, news, newsAdd, newsOffline, offline: ms => marketOffline(Date.now() - ms), shock: stockShock, tick: stockTick, buy: stockBuy, sell: stockSell, estBuy, estCollect, boxHp, boxHit, boxes: boxesN, boxMs: () => boxesMs.length };
