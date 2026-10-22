// ═══ 第三階段：NeonPhone 手機（P 或右上角按鈕）：聯絡人服務、暗網軍火、快速存檔 ═══
// 第四階段加上霓虹證交所（股票清單→個股買賣）與天際置業（買資產、收保險箱），資料與規則在 69-market.js。
// 清單式介面（不是圖示九宮格），數字鍵選列、Esc／Backspace 返回。方向鍵在這個遊戲是開車與走路，所以不拿來操作手機。
// 聯絡人：駭客 Zero（消星 $500×星數²、冷卻 180 秒；雷達隱形 60 秒 $1,500，期間路人不報警）、
// 技工鐵手（把座駕送到身後 30 公尺的路上，免費、冷卻 60 秒）、鐵幕保全（空投彈藥箱 $1,200：全部彈藥補滿＋護甲；
// 傭兵小隊 $3,000：四人跟著你 3 分鐘，冷卻 4 分鐘，69-squads.js）。
// 冷卻與倒數都用真實時間（slowmo.raw）。快速存檔寫進 65-motors.js 的同一個存檔（nc260.motors 的 game 欄位）。
// 排在 69-gps 之後、69-police 之前：W、wantedClear 只在函式裡用。

const phone = { open: false, scr: 'home', who: 0, cd: { wipe: 0, ghost: 0, mech: 0, drop: 0, merc: 0 }, ghostT: 0, crates: [], msg: '', t: 0, html: '' };
const PH_SHOP = { pistol: 300, stun: 200, smg: 600, rifle: 900, shotgun: 500, sniper: 1200, rpg: 2500, minigun: 3000 };
const PH_ARMOR = 500, PH_THROW = 1500, PH_TRUCK = 1000, PH_GHOST = 1500, PH_DROP = 1200;
const wipeCost = () => 500 * W.stars * W.stars;
const secs = t => `${Math.ceil(t)} 秒`;

function pay(n) {
  if (motors.cash < n) { phoneMsg(`錢不夠，還差 ${money(n - motors.cash)}`); sfx.dry(); return false; }
  motors.cash -= n; saveMotors(); return true;
}
function phoneMsg(t) { phone.msg = t; phone.html = ''; }

// ─── 聯絡人 ───
const CONTACTS = [
  { name: 'Zero', role: '駭客', rows: () => [
    W.stars
      ? { t: '消除通緝紀錄', sub: phone.cd.wipe > 0 ? `冷卻中 · ${secs(phone.cd.wipe)}` : `目前 ${W.stars} 星`, val: money(wipeCost()), ok: phone.cd.wipe <= 0, fn: zeroWipe }
      : { t: '消除通緝紀錄', sub: '你現在沒被通緝', val: '', ok: false },
    { t: '雷達隱形 60 秒', sub: phone.ghostT > 0 ? `生效中 · 剩 ${secs(phone.ghostT)}` : '期間路人看到犯罪也不會報警', val: money(PH_GHOST), ok: phone.ghostT <= 0, fn: zeroGhost },
    { t: '標記運鈔車', sub: ev.truck ? '小地圖上已經有一台' : '叫一台鐵庫保全運鈔車開過附近', val: money(PH_TRUCK), ok: !ev.truck && !W.stars, fn: zeroTruck },
  ] },
  { name: '鐵手', role: '技工', rows: () => [
    { t: `送 ${kestrel.name} 過來`, sub: phone.cd.mech > 0 ? `冷卻中 · ${secs(phone.cd.mech)}` : '停在你身後 30 公尺的路上', val: '免費', ok: phone.cd.mech <= 0, fn: mechDeliver },
  ] },
  { name: '鐵幕保全', role: '傭兵', rows: () => [
    { t: '空投彈藥箱', sub: phone.cd.drop > 0 ? `準備中 · ${secs(phone.cd.drop)}` : '投在前方路上：彈藥全滿＋防彈衣', val: money(PH_DROP), ok: phone.cd.drop <= 0 && !phone.crates.length, fn: mercDrop },
    { t: '傭兵小隊（3 分鐘）', sub: SQ.merc ? `跟著你 · 合約剩 ${secs(Math.max(0, SQ.merc.t))}` : phone.cd.merc > 0 ? `下一組人 · ${secs(phone.cd.merc)}` : '四名傭兵開皮卡過來掩護你，你上車他們跟車', val: money(MERC_FEE), ok: !SQ.merc && phone.cd.merc <= 0, fn: mercCall },
  ] },
];
function zeroWipe() {
  if (player.where !== 'out' || !W.stars) return;
  if (!pay(wipeCost())) return;
  phone.cd.wipe = 180; wantedClear('phone');
  phoneMsg('Zero：資料庫改好了，警方系統裡沒有你這個人。'); sfx.pickup();
}
function zeroGhost() {
  if (!pay(PH_GHOST)) return;
  phone.ghostT = 60; W.reports.length = 0;
  phoneMsg('Zero：附近的報案專線我先截下來，六十秒。'); sfx.pickup(); toast('雷達隱形：60 秒內路人不會報警');
}
function zeroTruck() {
  if (player.where !== 'out') { phoneMsg('Zero：你先出門再說。'); return; }
  if (motors.cash < PH_TRUCK) { pay(PH_TRUCK); return; }
  if (!truckSpawn('zero')) { phoneMsg('Zero：附近路口都看得到你，等一下再叫。'); return; }
  pay(PH_TRUCK); phoneMsg('Zero：鐵庫的車隊排程我改了一台過來，藍點。');
}
// 存檔裡的世界座標夾回城市範圍內（在所在區或最近那一區的邏輯座標裡夾；區之間的縫與岬角照原位置）
function cityClamp(x, z) {
  if (capeAt(x, z) || !zoneAtW(x, z) && seamAt(x, z)) return [x, z];
  const zn = zoneOfW(x, z) || ZONES[0], [lx, lz] = toL(x, z, zn);
  return toW(clamp(lx, avX(zn.ni0) - HR, avX(zn.ni1) + HR), clamp(lz, stZ(zn.nj0) - HR, stZ(zn.nj1) + HR), zn);
}
function mechDeliver() {
  if (player.where !== 'out') { phoneMsg('鐵手：你人在室內，我開不進去。'); return; }
  if (player.mode === 'drive' && player.veh === kestrel) { phoneMsg('鐵手：你已經坐在它裡面了。'); return; }
  if (motors.test) { phoneMsg('鐵手：先把試駕車還回去。'); return; }
  motors.stowed = false; kestrel.g.visible = true;
  if (kestrel.dead) { kestrel.dead = 0; kestrel.burn = 0; kestrel.hp = 1000; }
  if (kestrel.flatBase) { kestrel.vmax = kestrel.flatBase.vmax; kestrel.grip = kestrel.flatBase.grip; kestrel.flatBase = null; kestrel.flat = 0; kestrel.hp = Math.max(kestrel.hp, 1000); }
  const q = player.mode === 'drive' ? player.veh : player, yaw = q.yaw;
  // 身後 30 m 最近的那段路，停在那一側的車道、車頭順著車流（離路口至少 8 m）
  const sp = rnLaneSpot(q.x - Math.sin(yaw) * 30, q.z - Math.cos(yaw) * 30, 8);
  kestrel.x = sp.x; kestrel.z = sp.z; kestrel.yaw = sp.yaw;
  kestrel.vx = kestrel.vz = 0; kestrel.y = 0; kestrel.yr = 0; kestrel.air = null; poseVehicle(kestrel);
  phone.cd.mech = 60; sfx.pickup();
  phoneMsg(`鐵手：${kestrel.name} 停在你後面了，鑰匙插著。`); toast(`${kestrel.name} 送到了`);
}
// 空投：從 40 公尺高掉下來，落點冒紅色信號煙；走過去撿
let crateGeo = null;
function mercDrop() {
  if (player.where !== 'out') { phoneMsg('鐵幕保全：室內沒辦法空投。'); return; }
  if (!pay(PH_DROP)) return;
  const q = player.mode === 'drive' ? player.veh : player;
  const r = roadPoint(q.x + Math.sin(q.yaw) * 8, q.z + Math.cos(q.yaw) * 8);
  if (!crateGeo) {
    const k = new Kit();
    k.box(0, .3, 0, .9, .6, .62, 0x3a4430, 2); k.box(0, .3, 0, .94, .08, .66, 0x22261e, 2); k.box(0, .61, 0, .5, .03, .3, 0xd9b42a, 2);
    k.box(-.3, .3, 0, .06, .64, .66, 0x22261e, 2); k.box(.3, .3, 0, .06, .64, .66, 0x22261e, 2);
    crateGeo = k.build();
  }
  const m = new T.Mesh(crateGeo, MAT.uber); m.position.set(r.x, 40, r.z); scene.add(m);
  phone.crates.push({ x: r.x, z: r.z, y: 40, m, t: 0 });
  phone.cd.drop = 30; sfx.pickup();
  phoneMsg('鐵幕保全：補給機已經在路上，看紅煙。'); toast('空投彈藥箱：看紅色信號煙');
}
function crateStep(dt) {
  for (const c of [...phone.crates]) {
    c.t += dt;
    c.y = Math.max(0, c.y - 9 * dt); c.m.position.y = c.y; c.m.rotation.y = c.y * .05;
    if (Math.random() < dt * 14) emit('smoke', c.x + .6, .3, c.z, { vy: 2.2, vx: (Math.random() - .5) * .6, vz: (Math.random() - .5) * .6, max: 2.4, s0: .4, s1: 2.2, drag: .6, a: .7, c: [1.5, .22, .18] });
    if (Math.random() < dt * 8) fxLights.push({ x: c.x + .6, y: .5, z: c.z, col: COL.boom, r: 9, i: 1.6, life: 0, max: .2 });
    const near = player.mode === 'walk' && !life.dead && Math.hypot(player.x - c.x, player.z - c.z) < 1.6;
    if (c.y === 0 && near) {
      for (const id of ARM_IDS) { const A = ARMS[id], a = arm.ammo[id]; if (A.gun) { a.mag = A.mag; a.res = A.res; } else if (A.throw) a.mag = A.n; }
      life.armor = 100; sfx.pickup(); toast('彈藥全部補滿、防彈衣換新');
    }
    if (c.y === 0 && near || c.t > 180) { scene.remove(c.m); phone.crates.splice(phone.crates.indexOf(c), 1); }
  }
}

// ─── 暗網軍火：防彈衣、各槍備彈補滿、投擲物（手榴彈與黏性炸彈一起）補滿，直接進背包；最多十列（數字鍵 1–9、0） ───
const THROWS = ARM_IDS.filter(id => ARMS[id].throw);
function shopRows() {
  const rows = [{ t: '防彈衣', sub: `護甲 ${Math.round(life.armor)} / 100`, val: life.armor >= 100 ? '已滿' : money(PH_ARMOR), ok: life.armor < 100, fn: () => { if (pay(PH_ARMOR)) { life.armor = 100; sfx.pickup(); phoneMsg('防彈衣已經換上。'); } } }];
  for (const id of ARM_IDS) {
    const A = ARMS[id], a = arm.ammo[id], p = PH_SHOP[id];
    if (!p) continue;
    const full = a.res >= A.res;
    rows.push({ t: `${A.name}彈藥`, sub: `備彈 ${a.res} / ${A.res}`, val: full ? '已滿' : money(p), ok: !full, fn: () => { if (!pay(p)) return; a.res = A.res; sfx.reload(); phoneMsg(`${A.name}彈藥已經放進背包。`); } });
  }
  const tFull = THROWS.every(id => arm.ammo[id].mag >= ARMS[id].n);
  rows.push({ t: '投擲物', sub: THROWS.map(id => `${ARMS[id].name} ${arm.ammo[id].mag}`).join(' · '), val: tFull ? '已滿' : money(PH_THROW), ok: !tFull, fn: () => { if (!pay(PH_THROW)) return; for (const id of THROWS) arm.ammo[id].mag = ARMS[id].n; sfx.reload(); phoneMsg('手榴彈與黏性炸彈補滿了。'); } });
  return rows;
}

// ─── 快速存檔：現金與車庫本來就即時存；這裡多存主角、任務、彈藥、位置、正在開的車（veh）與所在的安全屋（where） ───
// at：安全屋睡覺時存在門口（69-safehouse.js），人在室內也能存，讀檔時回到那間屋子裡。回傳有沒有存成
function quickSave(at) {
  if (heist.st !== 'off' && heist.st !== 'plan') { phoneMsg('搶劫進行中不能存檔。'); return false; }
  if (!at && player.where !== 'out' || W.stars || crew.sw || life.dead) { phoneMsg(W.stars ? '通緝中不能存檔。' : '要在戶外才能存檔。'); return false; }
  crewSave();
  const pos = at || (player.mode === 'drive' ? player.veh : player), v = !at && player.mode === 'drive' ? player.veh : null;
  // 座駕：自己的車（own）、路邊的機車（bike），或搶來的車流車型（TYPES 的名稱與塗裝）
  const vk = !v || v.dead ? null : v === kestrel ? 'own' : v === hanzo ? 'bike' : TYPES[v.type] && v.ins ? v.type : null;
  motors.game = {
    t: Date.now(), quest: quest.n, cur: crew.cur, min: clockSt.min, wx: wx.cur,
    veh: vk ? { k: vk, pal: vk === v.type ? v.ins.array[2] : 0 } : null, where: at && APT[player.where] ? player.where : null,
    st: crew.st.map((s, i) => ({ hp: Math.round(s.hp), armor: Math.round(s.armor), sp: Math.round(s.sp), x: +(i === crew.cur ? pos.x : s.x).toFixed(2), z: +(i === crew.cur ? pos.z : s.z).toFixed(2), yaw: +(i === crew.cur ? pos.yaw : s.yaw).toFixed(3) })),
    ammo: Object.fromEntries(ARM_IDS.filter(id => arm.ammo[id]).map(id => [id, [arm.ammo[id].mag, arm.ammo[id].res]])),
  };
  saveMotors(); sfx.pickup(); phoneMsg('存好了。');
  return true;
}
function quickLoad() {
  const g = motors.game;
  if (!g) return;
  if (heist.st !== 'off' && heist.st !== 'plan') { phoneMsg('搶劫進行中不能讀檔。'); return; }
  if (player.where !== 'out' || W.stars || crew.sw || life.dead || fading || motors.test) { phoneMsg(W.stars ? '通緝中不能讀檔。' : motors.test ? '試駕中不能讀檔。' : '在戶外才能讀檔。'); return; }
  closePhone();
  transition(() => {
    abilityOff();
    if (player.mode === 'drive') exitVehicle();
    squadClear();
    const f = (v, d) => Number.isFinite(v) ? v : d;
    g.st.forEach((s, i) => { const c = crew.st[i]; if (!c || !s) return; c.hp = clamp(f(s.hp, c.hp), 1, CREW[i].hp); c.armor = clamp(f(s.armor, c.armor), 0, 100); c.sp = clamp(f(s.sp, c.sp), 0, SP_MAX); [c.x, c.z] = cityClamp(f(s.x, c.x), f(s.z, c.z)); c.yaw = f(s.yaw, 0); c.where = 'out'; });
    for (const id in g.ammo) { const a = arm.ammo[id], A = ARMS[id]; if (!a || !Array.isArray(g.ammo[id])) continue; a.mag = clamp(g.ammo[id][0] | 0, 0, A.mag || A.n); a.res = clamp(g.ammo[id][1] | 0, 0, 9999); }
    if (QUEST[g.quest] && g.quest !== quest.n) setQuest(g.quest);
    if (Number.isFinite(g.min)) clockSt.min = clamp(g.min | 0, 0, 1439);
    if (WX[g.wx]) setWeather(g.wx, true);
    crewApply(clamp(g.cur, 0, CREW.length - 1));
    // 回到存檔時開的那台車上，或存檔的安全屋裡
    const s = crew.st[crew.cur], vk = g.veh && g.veh.k;
    if (vk === 'own' && !kestrel.dead) { motors.stowed = false; kestrel.g.visible = true; placeCarAt({ x: s.x, z: s.z, yaw: s.yaw }); enterVehicle(kestrel); }
    else if (vk === 'bike' && !hanzo.dead) { hanzo.x = s.x; hanzo.z = s.z; hanzo.yaw = s.yaw; hanzo.vx = hanzo.vz = 0; hanzo.y = groundH(s.x, s.z); poseVehicle(hanzo); enterVehicle(hanzo); }
    else if (vk && TYPES[vk] && !TYPES[vk].police) { const v = buildVeh(vk, s.x, s.z, s.yaw, 0, Math.random(), clamp(g.veh.pal | 0, 0, PAL.length)); v.y = groundH(v.x, v.z); jacked.push(v); poseVehicle(v); enterVehicle(v); }
    if (g.where && APT[g.where] && estOwned(g.where)) {
      aptLoad(g.where); setWhere(g.where);
      const sp = VENUES[g.where].spawn; player.x = sp.x; player.z = sp.z; player.yaw = sp.yaw; player.v = 0; camState.yaw = sp.yaw; camState.pitch = .12;
    }
    toast('已讀取快速存檔');
  });
}
const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? '剛剛' : m < 60 ? `${m} 分鐘前` : m < 1440 ? `${Math.round(m / 60)} 小時前` : `${Math.round(m / 1440)} 天前`; };
function saveRows() {
  const g = motors.game;
  return [
    { t: '存檔', sub: g ? `上次 ${ago(g.t)}` : '還沒有存檔', val: '', ok: true, fn: quickSave },
    { t: '讀取存檔', sub: g ? `${CREW[g.cur] ? CREW[g.cur].name : ''} · ${QUEST[g.quest] ? QUEST[g.quest].text : ''}` : '還沒有存檔', val: '', ok: !!g, fn: quickLoad },
  ];
}

// ─── 霓虹證交所（69-market.js）：清單 → 單一股票（買進、全部賣出） ───
function stockRows() {
  return STOCKS.map((s, i) => {
    const n = motors.stk.sh[s.id], c = chg(s.id), arrow = c > .05 ? '▲' : c < -.05 ? '▼' : '';
    return { t: `${s.id} ${s.name}`, sub: n ? `持有 ${n.toLocaleString('en-US')} 股 · 市值 ${money(n * motors.stk.px[s.id])}` : `${s.ind}${arrow ? ` · ${arrow}${Math.abs(c).toFixed(1)}%` : ''}`, val: fmtPx(motors.stk.px[s.id]), ok: true, fn: () => { phone.scr = 'stock'; phone.who = i; phone.msg = s.rival ? `破壞${s.tgt}會讓 ${s.id} 下跌、${s.rival} 上漲。` : `${STOCKS.find(o => o.rival === s.id).id} 的目標被破壞時，${s.id} 會上漲。`; } };
  });
}
function stockDetail() {
  const s = STOCKS[phone.who], n = motors.stk.sh[s.id], px = motors.stk.px[s.id], cost = motors.stk.cost[s.id];
  const pl = n ? n * px - cost : 0;
  const buy = amt => () => { const k = stockBuy(s.id, amt); if (k) { sfx.pickup(); phoneMsg(`買進 ${k.toLocaleString('en-US')} 股 ${s.id}，每股 ${fmtPx(px)}。`); } else phoneMsg('錢不夠買一股。'); };
  return [
    { t: '買進 $10,000', sub: `現價 ${fmtPx(px)}`, val: '', ok: motors.cash >= px, fn: buy(10000) },
    { t: '買進 $100,000', sub: `可用現金 ${money(motors.cash)}`, val: '', ok: motors.cash >= px, fn: buy(100000) },
    { t: '全部買進', sub: '用光身上的現金', val: '', ok: motors.cash >= px, fn: buy(motors.cash) },
    { t: '全部賣出', sub: n ? `${n.toLocaleString('en-US')} 股 · ${pl >= 0 ? '賺' : '賠'} ${money(Math.abs(pl))}` : '沒有持股', val: n ? money(n * px) : '', ok: n > 0, fn: () => { const got = stockSell(s.id); sfx.pickup(); phoneMsg(`賣出 ${s.id}，入帳 ${money(got)}。`); } },
  ];
}
// ─── 天際置業（69-market.js）：買資產、收保險箱 ───
function estateRows() {
  const rows = ESTATES.map(e => e.home
    ? estOwned(e.id)
      ? e.rate && motors.props.safe[e.id] >= 1
        ? { t: e.name, sub: `安全屋 · 保險箱 ${money(motors.props.safe[e.id])} / ${money(e.cap)}`, val: '收取', ok: true, fn: () => { const n = estCollect(e.id); phoneMsg(`收了 ${money(n)}。`); } }
        : { t: e.name, sub: `安全屋 · ${APT[e.id].dist}`, val: '導航', ok: true, fn: () => { const d = aptOut(e.id); gpsSet(d.x, d.z); phoneMsg(`已設定導航到${e.name}。`); } }
      : { t: e.name, sub: e.rate ? `安全屋 · 每遊戲小時收入 ${money(e.rate)}` : `安全屋 · 睡覺推進時間並存檔`, val: money(e.price), ok: motors.cash >= e.price, fn: () => { if (estBuy(e.id)) { sfx.pickup(); phoneMsg(`${e.name}現在是你的了，門口按 E 進去。`); } } }
    : estOwned(e.id)
    ? { t: e.name, sub: `保險箱 ${money(motors.props.safe[e.id])} / ${money(e.cap)} · 每小時 ${money(e.rate)}`, val: '收取', ok: motors.props.safe[e.id] >= 1, fn: () => { const n = estCollect(e.id); phoneMsg(`收了 ${money(n)}。`); } }
    : { t: e.name, sub: `每遊戲小時收入 ${money(e.rate)}`, val: money(e.price), ok: motors.cash >= e.price, fn: () => { if (estBuy(e.id)) { sfx.pickup(); phoneMsg(`${e.name}現在是你的了，收入會存進保險箱。`); } } });
  const total = ESTATES.reduce((a, e) => a + (estOwned(e.id) ? Math.floor(motors.props.safe[e.id]) : 0), 0);
  const biz = motors.props.own.filter(id => !ESTATES.find(e => e.id === id).home).length;
  if (biz > 1) rows.push({ t: '全部收取', sub: `${biz} 處資產`, val: total ? money(total) : '', ok: total >= 1, fn: () => { let n = 0; for (const id of motors.props.own) n += estCollect(id); phoneMsg(`一共收了 ${money(n)}。`); } });
  return rows;
}

// ─── 畫面 ───
function phoneRows() {
  if (phone.scr === 'stocks') return stockRows();
  if (phone.scr === 'stock') return stockDetail();
  if (phone.scr === 'estates') return estateRows();
  if (phone.scr === 'contacts') return CONTACTS.map((c, i) => ({ t: c.name, sub: c.role, val: '', ok: true, fn: () => { phone.scr = 'who'; phone.who = i; phone.msg = ''; } }));
  if (phone.scr === 'who') return CONTACTS[phone.who].rows();
  if (phone.scr === 'arms') return shopRows();
  if (phone.scr === 'save') return saveRows();
  return [
    { t: '聯絡人', sub: phone.ghostT > 0 ? `雷達隱形 · 剩 ${secs(phone.ghostT)}` : 'Zero、鐵手、鐵幕保全', val: '', ok: true, fn: () => { phone.scr = 'contacts'; phone.msg = ''; } },
    { t: '暗網軍火', sub: '彈藥、投擲物、防彈衣', val: '', ok: true, fn: () => { phone.scr = 'arms'; phone.msg = ''; } },
    { t: '霓虹證交所', sub: motors.stk && STOCKS.some(s => motors.stk.sh[s.id]) ? `持股市值 ${money(STOCKS.reduce((a, s) => a + motors.stk.sh[s.id] * motors.stk.px[s.id], 0))}` : '六檔股票，破壞對手的資產讓股價波動', val: '', ok: true, fn: () => { phone.scr = 'stocks'; phone.msg = ''; } },
    { t: '天際置業', sub: motors.props.own.length ? `${motors.props.own.length} 處資產 · 保險箱 ${money(ESTATES.reduce((a, e) => a + (estOwned(e.id) ? motors.props.safe[e.id] : 0), 0))}` : '買下夜店、酒吧、改裝廠或安全屋', val: '', ok: true, fn: () => { phone.scr = 'estates'; phone.msg = ''; } },
    { t: '快速存檔', sub: motors.game ? `上次 ${ago(motors.game.t)}` : '還沒有存檔', val: '', ok: true, fn: () => { phone.scr = 'save'; phone.msg = ''; } },
  ];
}
const PH_TITLE = { home: 'NeonPhone', contacts: '聯絡人', arms: '暗網軍火', save: '快速存檔', stocks: '霓虹證交所', estates: '天際置業' };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function drawPhone() {
  const rows = phone.rows = phoneRows();
  const title = phone.scr === 'who' ? `${CONTACTS[phone.who].name} <small>${CONTACTS[phone.who].role}</small>` : phone.scr === 'stock' ? `${STOCKS[phone.who].id} <small>${STOCKS[phone.who].name}</small>` : PH_TITLE[phone.scr];
  const html = `<div id="phHead"><h2>${title}</h2><button id="phBack">${phone.scr === 'home' ? '關閉' : '返回'}</button></div><ol>` +
    rows.map((r, i) => `<li><button data-i="${i}"${r.ok ? '' : ' disabled'}><kbd>${(i + 1) % 10}</kbd><span><b>${esc(r.t)}</b><small>${esc(r.sub)}</small></span><em>${esc(r.val)}</em></button></li>`).join('') +
    `</ol><p id="phMsg">${esc(phone.msg)}</p>`;
  if (html !== phone.html) { phone.html = html; $('phScr').innerHTML = html; }
  setText('phT', $('clock').textContent); setText('phCash', money(motors.cash));
}
function phonePick(i) {
  const r = phone.rows[i];
  if (!r || !r.ok || !r.fn) return;
  sfx.click(); r.fn();
  if (phone.open) drawPhone();
}
function phoneBack() {
  if (phone.scr === 'home') return closePhone();
  phone.scr = phone.scr === 'who' ? 'contacts' : phone.scr === 'stock' ? 'stocks' : 'home'; phone.msg = ''; drawPhone();
}
function openPhone() {
  if (phone.open || !started || life.dead || crew.sw || dlg.open) return;
  phone.open = true; phone.scr = 'home'; phone.msg = ''; phone.html = '';
  if (document.pointerLockElement) document.exitPointerLock?.();   // 讓滑鼠點得到清單
  drawPhone(); $('phone').classList.add('on'); $('phone').setAttribute('aria-hidden', 'false'); sfx.click();
}
function closePhone() {
  if (!phone.open) return;
  phone.open = false; $('phone').classList.remove('on'); $('phone').setAttribute('aria-hidden', 'true');
}
$('phScr').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'phBack') { sfx.click(); phoneBack(); } else phonePick(+b.dataset.i);
});
$('bPhone').addEventListener('click', () => { sfx.init(); if (phone.open) closePhone(); else openPhone(); });
// 99-main.js 的 onKey 在對話框之後、地圖之前先問這裡
function phoneKey(code) {
  if (code === 'KeyP') { if (phone.open) closePhone(); else openPhone(); return true; }
  if (!phone.open) return false;
  const n = /^Digit(\d)$/.exec(code);
  if (n) { phonePick((+n[1] + 9) % 10); return true; }
  if (code === 'Escape' || code === 'Backspace') { phoneBack(); return true; }
  return false;
}
function phoneUpdate() {
  const dt = slowmo.raw;
  for (const k in phone.cd) phone.cd[k] = Math.max(0, phone.cd[k] - dt);
  if (phone.ghostT > 0) { phone.ghostT -= dt; if (phone.ghostT <= 0) { phone.ghostT = 0; toast('雷達隱形結束'); } }
  crateStep(dt);
  if (phone.open && (life.dead || crew.sw)) closePhone();
  if (phone.open && (phone.t -= dt) <= 0) { phone.t = .25; drawPhone(); }
}

// 測試 API（window.__nc.gta.phone）
const phoneApi = { phone, open: openPhone, close: closePhone, pick: phonePick, back: phoneBack, key: phoneKey, save: quickSave, load: quickLoad, wipeCost: () => wipeCost() };
