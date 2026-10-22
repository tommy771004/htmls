// ═══ 第四階段：霓虹證交所（股市）與天際置業（可購買資產） ═══
// 股市：三組死對頭企業。每分鐘（真實時間）隨機 ±1% 並向基準價回歸（半衰期 10 分鐘）；
// 玩家破壞 A 企業的實體目標時 A 價 ×max(0.2, 1 − δ + ε)、B 價 ×(1 + 0.85δ + ε)，δ = 0.08，價格限制在基準的 0.2–3.5 倍。
//   鐵庫保全 IVLT（運鈔車，69-events.js）↔ 哨衛防務 SNTL；凡托超跑 VNTR（Milano 與 Tiara GT 被你炸毀）↔ 蛟重工 MZCH；
//   流明電訊 LMNT（路邊的藍色電訊箱，射擊、爆炸或開車撞爛；爛掉時會炸開）↔ 脈線科技 PLSW。
// 資產：LAZARUS、AFTERGLOW、CHROME WORKS 三處可以從手機買下，每遊戲小時（150 秒）把收入存進各自的保險箱（有上限），從手機收取。
// 股價、持股與資產都跟現金一樣即時寫進 nc260.motors（存檔第 3 版的 stk、props 欄位）。
// 排在 69-heist 之後、69-phone 之前；頂層只用到 68 以前的東西（rayHooks、boxesN、boxesMesh）。

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
    hit(rayCyl(R, b.x, b.z, .32, .15, 1.3), 'ebox', k);
  }
});
const _bm = new T.Matrix4().makeScale(0, 0, 0);
function boxHit(k, dmg, mine) {
  if (boxHp[k] <= 0) return;
  const b = boxesN[k];
  boxHp[k] -= dmg; sparks(b.x, .9, b.z, 8, 3);
  if (boxHp[k] > 0) return;
  instSet(boxesMesh, k, _bm);
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
  { id: 'lazarus', name: 'LAZARUS 夜店', price: 250000, rate: 2400, cap: 48000 },
  { id: 'afterglow', name: 'AFTERGLOW 酒吧', price: 120000, rate: 1100, cap: 22000 },
  { id: 'chrome', name: 'CHROME WORKS 改裝廠', price: 180000, rate: 1700, cap: 34000 },
  // 安全屋（69-safehouse.js）：沒有收入，買了可以進去睡覺存檔
  { id: 'loft', name: '冠石頂層公寓', price: 380000, rate: 0, cap: 0, home: true },
  { id: 'villa', name: '雲杉坡崖邊別墅', price: 600000, rate: 0, cap: 0, home: true },
  // 第三輪：島上辦公室是安全屋，也有收入（在辦公桌或手機收）；其他三間只是安全屋
  { id: 'office', name: '灰鷗島辦公室', price: 520000, rate: 900, cap: 18000, home: true },
  { id: 'mini', name: '楓林里迷你閣樓', price: 160000, rate: 0, cap: 0, home: true },
  { id: 'l16', name: '琥珀和室 Loft', price: 340000, rate: 0, cap: 0, home: true },
  { id: 'i14', name: '公園大道白色大宅', price: 480000, rate: 0, cap: 0, home: true },
];
const GAME_HOUR = 150;   // 90-hud.js 的時鐘：遊戲裡一分鐘 = 2.5 秒
// motors.props = { own: [id], safe: {id: 金額} }
function estInit() { const p = motors.props ||= { own: [], safe: {} }; p.own = p.own.filter((id, i, a) => ESTATES.some(e => e.id === id) && a.indexOf(id) === i); for (const e of ESTATES) p.safe[e.id] = Math.min(e.cap, p.safe[e.id] || 0); }
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
stkInit(); estInit();
function marketUpdate(dt) {
  if ((mk.t -= slowmo.raw) <= 0) { mk.t = 60; stockTick(); }
  for (const e of ESTATES) if (estOwned(e.id)) motors.props.safe[e.id] = Math.min(e.cap, motors.props.safe[e.id] + e.rate * dt / GAME_HOUR);
  if (player.mode === 'drive' && player.where === 'out') boxRam(player.veh);
}

// 測試 API（window.__nc.gta.market）
const marketApi = { STOCKS, ESTATES, mk, shock: stockShock, tick: stockTick, buy: stockBuy, sell: stockSell, estBuy, estCollect, boxHp, boxHit };
