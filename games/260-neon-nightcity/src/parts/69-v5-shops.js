// ═══ 第五部曲之二：商業設施（neon_nightcity_gta_v3.md「城市建築設施藍圖」一之 2）═══
// BODEGA 夜貓便利店的搶劫（拿槍指著店員：威嚇條約 12 秒、朝貨架開槍 ×2.5 約 5 秒；$800–2,500；22% 的店員抽出霰彈槍；第二台收銀機）、
// 冰櫃的能量飲料（$2 +15 生命）、街邊提款機與在提款機前被搶的路人、酒吧與夜店的酒（喝多了走路與開車會晃）、
// CHROME WORKS 的自動捲門（自己的車開到門口 6 m 內、警察沒看到才開）。
// 便利店的座標是場館自己的（69-safehouse.js 的 APT.store），提款機與捲門在生成時用邏輯座標。

const ROB_RATE = .08, ROB_SHOOT_K = 2.5, ROB_MIN = 800, ROB_MAX = 2500, ROB_ARMED = .22, ROB_REG2 = [250, 700], ROB_CLOSED = 300;
const DRINK_PRICE = 2, DRINK_HP = 15, ATM_MUG = [60, 400], ATM_AIM_T = 1.2, BOOZE = { pub: 8, club: 15, bar: 12 };
const SHOP = { rob: null, closed: 0, reg2: false, clerk: null, mag: -1, drunk: 0, atms: [], shutter: null };

// ─── 進度條（和下載實車模型的 #dl 同一種樣式）───
function v5Bar(label, p) {
  const e = $('v5bar'); if (!e) return;
  if (label === null) { e.classList.remove('on'); return; }
  e.classList.add('on'); $('v5barT').textContent = label; $('v5barP').textContent = Math.round(p * 100) + '%';
  e.style.setProperty('--p', (p * 100).toFixed(1) + '%'); e.setAttribute('aria-valuenow', Math.round(p * 100));
}

// ═══ BODEGA：店員站在結帳台後面 ═══
const STORE_CLERK = { x: 1, z: 3.35, yaw: Math.PI }, STORE_REG2 = { x: -2.3, z: 1.95 }, STORE_FRIDGE = { x: 4, z: .6 };
function clerkInit() {
  const V = VENUES.store; if (!V || SHOP.clerk) return;
  const cr = crowd(1); cr.look(0, { r: rng(2601), female: true, coat: 0 });
  cr.anim(0, ANIM.idle, 0, 1, 0); cr.place(0, STORE_CLERK.x, 0, STORE_CLERK.z, STORE_CLERK.yaw); cr.flush();
  V.scene.add(cr.mesh); V.data.circles.push({ x: STORE_CLERK.x, z: STORE_CLERK.z, r: .3 });
  SHOP.clerk = { cr, st: 'idle', t: 0, hp: 60, shotT: 2 };
  // 冰櫃把手上的能量飲料燈箱、第二台收銀機
  const k = new Kit();
  k.box(STORE_FRIDGE.x, 1.95, STORE_FRIDGE.z, .5, .22, .04, 0x30ff9a, 8).box(STORE_REG2.x, 1.12, STORE_REG2.z + .55, .42, .2, .36, 0x2a2c30, 2).box(STORE_REG2.x, 1.3, STORE_REG2.z + .45, .3, .2, .03, 0x6ad0ff, 8);
  V.scene.add(new T.Mesh(k.build(), MAT.uber));
}
const clerkP = () => SHOP.clerk.cr.people[0];
function clerkAnim(id, ph = uTimeNow(), sp = 1) { const c = SHOP.clerk; c.cr.anim(0, id, ph, sp, 0); c.cr.place(0, STORE_CLERK.x, 0, STORE_CLERK.z, STORE_CLERK.yaw); c.cr.flush(); }
// 玩家拿槍對著店員（身體朝向和店員方向差 0.35 rad 以內、7 m 內）
function aimAtClerk() {
  if (player.where !== 'store' || !gta.aiming || !ARMS[arm.sel].gun) return false;
  const dx = STORE_CLERK.x - player.x, dz = STORE_CLERK.z - player.z;
  return Math.hypot(dx, dz) < 7 && Math.abs(wrapA(Math.atan2(dx, dz) - player.yaw)) < .35;
}
function robStart() {
  const c = SHOP.clerk;
  SHOP.rob = { bar: 0, shootT: 0, alarm: false, armed: Math.random() < ROB_ARMED, t: 0 };
  c.st = SHOP.rob.armed ? 'draw' : 'hands'; c.t = 0;
  clerkAnim(c.st === 'hands' ? ANIM.handsUp : ANIM.idle);
  toast(SHOP.rob.armed ? '店員的手往櫃台底下摸……' : '店員舉起雙手：「別開槍！錢給你！」');
}
function robDone() {
  const n = Math.round(ROB_MIN + Math.random() * (ROB_MAX - ROB_MIN));
  motors.cash += n; saveMotors(); sfx.pickup();
  toast(`店員把收銀機的錢全倒進袋子 · +${money(n)}`);
  addHeat(CRIME.assault, 2);
  SHOP.rob = null; SHOP.reg2 = true; SHOP.closed = ROB_CLOSED; SHOP.clerk.st = 'cower'; clerkAnim(ANIM.kneel);
  v5Bar(null);
}
function clerkDown() {
  const c = SHOP.clerk; c.st = 'dead'; c.t = 0;
  clerkAnim(ANIM.die, uTimeNow(), 1);
  addHeat(CRIME.kill, 1);   // crime() 只管戶外：店裡的槍聲直接算熱度
  if (SHOP.rob) { SHOP.rob = null; v5Bar(null); }
  SHOP.reg2 = true; SHOP.closed = ROB_CLOSED; SHOP.till = true;
  toast('店員倒下了 · 收銀機沒人顧');
}
function storeStep(dt) {
  const c = SHOP.clerk; if (!c) return;
  if (SHOP.closed > 0 && (SHOP.closed -= dt) <= 0 && player.where !== 'store') { c.st = 'idle'; c.hp = 60; SHOP.reg2 = false; SHOP.till = false; clerkAnim(ANIM.idle); }
  if (player.where !== 'store') { if (SHOP.rob) { SHOP.rob = null; v5Bar(null); } SHOP.mag = -1; return; }
  // 開槍：看彈匣少了一發；對著店員就是打中，其他算打貨架（威嚇加快）
  const A = arm.ammo[arm.sel], mag = ARMS[arm.sel].gun && A ? A.mag : -1;
  const fired = SHOP.mag >= 0 && mag >= 0 && mag < SHOP.mag; SHOP.mag = mag;
  if (fired && c.st !== 'dead') {
    if (aimAtClerk()) { c.hp -= ARMS[arm.sel].dmg || 30; if (c.hp <= 0) { clerkDown(); return; } }
    else if (SHOP.rob) { SHOP.rob.shootT = 2; sfx.glassBreak(); }
  }
  if (c.st === 'dead' || SHOP.closed > 0 && !SHOP.rob) return;
  const R = SHOP.rob;
  if (!R) { if (aimAtClerk() && !life.dead) robStart(); return; }
  R.t += dt; R.shootT -= dt;
  if (R.armed) {   // 抽出霰彈槍：每 1.3 秒一發，直到被打倒或你跑出去
    c.t += dt;
    if (c.st === 'draw' && c.t > 1.2) { c.st = 'shoot'; c.shotT = .6; clerkAnim(ANIM.aimIdle); toast('店員抽出一把霰彈槍！'); }
    if (c.st === 'shoot' && (c.shotT -= dt) <= 0) { c.shotT = 1.3; sfx.shot(); hurtPlayer(18, player.x - STORE_CLERK.x, player.z - STORE_CLERK.z); if (!R.alarm) { R.alarm = true; addHeat(CRIME.shots, 1); } }
    v5Bar('店員反抗', 0);
    return;
  }
  if (!aimAtClerk()) { R.bar = Math.max(0, R.bar - dt * .04); }
  else R.bar += dt * ROB_RATE * (R.shootT > 0 ? ROB_SHOOT_K : 1);
  if (R.bar > .5 && !R.alarm) { R.alarm = true; addHeat(0, 1); toast('店員偷偷踩了櫃台下的警鈴'); }
  v5Bar('威嚇店員', Math.min(1, R.bar));
  if (R.bar >= 1) robDone();
}
function buyDrink() {
  if (motors.cash < DRINK_PRICE) { toast('連兩塊錢都沒有'); return; }
  motors.cash -= DRINK_PRICE; saveMotors(); sfx.pickup();
  const n = Math.min(DRINK_HP, life.max - life.hp); life.hp += n;
  toast(`冰櫃的能量飲料 · ${money(DRINK_PRICE)} · 生命 +${Math.round(n)}`);
}
function reg2Open() {
  if (!SHOP.reg2) return;
  SHOP.reg2 = false; const n = Math.round(ROB_REG2[0] + Math.random() * (ROB_REG2[1] - ROB_REG2[0]));
  motors.cash += n; saveMotors(); sfx.punch && sfx.punch(); sfx.pickup(); toast(`撬開第二台收銀機 · +${money(n)}`);
  addHeat(CRIME.assault);
}
function tillGrab() {
  if (!SHOP.till) return;
  SHOP.till = false; const n = Math.round(ROB_MIN * .6 + Math.random() * (ROB_MAX - ROB_MIN) * .5);
  motors.cash += n; saveMotors(); sfx.pickup(); toast(`自己清空收銀機 · +${money(n)}`);
}

// ═══ 提款機：牆邊的機台，有時有人在提款；拿槍指著他 1.2 秒，或手上有武器時走近按 E，錢包就交出來 ═══
const ATM_SPOTS = [];
{
  const st = APT.store.door, bk = BANK;
  ATM_SPOTS.push({ x: st.x + 2.8, z: st.z, yaw: 0, name: 'BODEGA 門口' });
  ATM_SPOTS.push({ x: bk.x + 5.2, z: bk.z, yaw: 0, name: '中央霓虹銀行' });
  if (FAC.hosp) ATM_SPOTS.push({ x: FAC.hosp.ax + 12.5, z: FAC.hosp.az + 41, yaw: -Math.PI / 2, name: '醫院急診樓' });
  if (FAC.pd) ATM_SPOTS.push({ x: FAC.pd.ax + 59.5, z: FAC.pd.az + 42, yaw: Math.PI / 2, name: '第九分局' });
  const k = new Kit();
  for (const A of ATM_SPOTS) {
    const fx = Math.sin(A.yaw), fz = Math.cos(A.yaw), x = A.x + fx * .3, z = A.z + fz * .3;
    A.zn = zoneAtL(x, z);
    k.box(x, .85, z, .74, 1.7, .52, 0x30343a, 2, 0, A.yaw).box(x + fx * .265, 1.28, z + fz * .265, .5, .34, .02, 0x40b8ff, 8, 0, A.yaw)
      .box(x + fx * .29, .98, z + fz * .29, .36, .05, .16, 0x9aa0a6, 3, -.5, A.yaw).box(x, 1.78, z, .8, .14, .56, 0x0f6a3a, 8, 0, A.yaw);
    colliders.push({ x0: x - .42, x1: x + .42, z0: z - .42, z1: z + .42, zn: A.zn });
    outLights.push({ x: x + fx * .6, y: 1.6, z: z + fz * .6, col: lin(0x60c0ff), r: 3.5, i: .6 });
  }
  if (ATM_SPOTS.length) cityAdd(new T.Mesh(k.build(), MAT.uber), ATM_SPOTS[0].zn);
}
const atmPeds = crowd(ATM_SPOTS.length);
function atmInit() {
  ATM_SPOTS.forEach((A, i) => {
    const fx = Math.sin(A.yaw), fz = Math.cos(A.yaw), s = spotW({ x: A.x + fx * 1.05, z: A.z + fz * 1.05, yaw: A.yaw + Math.PI }, A.zn);
    A.w = s; A.k = i; A.st = Math.random() < .6 ? 'use' : 'gone'; A.t = 0; A.aim = 0;
    atmPeds.look(i, { r: rng(2700 + i) });
    atmPlace(A);
  });
  atmPeds.flush(); scene.add(atmPeds.mesh);
}
function atmPlace(A) {
  const p = atmPeds.people[A.k], s = A.w;
  if (A.st === 'gone') { atmPeds.place(A.k, s.x, -50, s.z, s.yaw); return; }
  const y = groundH(s.x, s.z);
  if (A.st === 'use') { atmPeds.anim(A.k, ANIM.idle, A.k * 1.7, 1, 0); atmPeds.place(A.k, s.x, y, s.z, s.yaw); }
  else if (A.st === 'hands') { atmPeds.anim(A.k, ANIM.handsUp, uTimeNow(), 1, 0); atmPeds.place(A.k, s.x, y, s.z, A.face ?? s.yaw); }
  else if (A.st === 'flee') { atmPeds.anim(A.k, ANIM.run, A.t * 1.4, 1, 0); atmPeds.place(A.k, A.fx, groundH(A.fx, A.fz), A.fz, A.fy); }
  void p;
}
function atmMug(A) {
  const n = Math.round(ATM_MUG[0] + Math.random() * (ATM_MUG[1] - ATM_MUG[0]));
  motors.cash += n; saveMotors(); sfx.pickup(); toast(`提款的人交出剛領的錢 · +${money(n)}`);
  crime('assault', A.w.x, A.w.z);
  A.st = 'flee'; A.t = 0; A.fx = A.w.x; A.fz = A.w.z; A.fy = Math.atan2(A.w.x - player.x, A.w.z - player.z);
}
function atmStep(dt) {
  for (const A of ATM_SPOTS) {
    if (!A.w) continue;
    const d = Math.hypot(pX() - A.w.x, pZ() - A.w.z);
    if (A.st === 'gone' || A.st === 'use') {   // 人不在附近時換班：有人來提款或走掉
      if (d > 45 && (A.t += dt) > 20) { A.t = 0; A.st = Math.random() < .6 ? 'use' : 'gone'; atmPlace(A); }
    }
    if (A.st === 'use' && player.mode === 'walk' && player.where === 'out' && gta.aiming && ARMS[arm.sel].gun && d < 9) {
      const a = Math.abs(wrapA(Math.atan2(A.w.x - player.x, A.w.z - player.z) - player.yaw));
      if (a < .3) { A.aim += dt; if (A.aim > .25) { A.st = 'hands'; A.face = Math.atan2(player.x - A.w.x, player.z - A.w.z); atmPlace(A); } }
    } else if (A.st === 'use') A.aim = 0;
    if (A.st === 'hands') { A.aim += dt; if (A.aim >= ATM_AIM_T) atmMug(A); else if (!gta.aiming) { A.st = 'use'; A.aim = 0; atmPlace(A); } }
    if (A.st === 'flee') {
      A.t += dt; A.fx += Math.sin(A.fy) * 5 * dt; A.fz += Math.cos(A.fy) * 5 * dt; atmPlace(A);
      if (A.t > 4) { A.st = 'gone'; A.t = 0; atmPlace(A); }
    }
  }
}

// ═══ 酒：喝多了（post.wobble 是畫面搖晃，酒意 SHOP.drunk 讓走路與方向盤跟著飄）═══
function booze(where) {
  const p = BOOZE[where] || 10;
  if (motors.cash < p) { toast('錢不夠喝一杯'); return; }
  motors.cash -= p; saveMotors(); sfx.glass();
  SHOP.drunk = Math.min(1.6, SHOP.drunk + .4); post.wobble = Math.max(post.wobble, Math.min(1, SHOP.drunk));
  toast(SHOP.drunk > 1 ? `又一杯（${money(p)}）· 地板開始傾斜了` : `一杯 ${money(p)} · 酒意 ${Math.round(SHOP.drunk / 1.6 * 100)}%`);
}
function drunkStep(dt) {
  if (SHOP.drunk <= 0) return;
  SHOP.drunk = Math.max(0, SHOP.drunk - dt / 150);
  post.wobble = Math.max(post.wobble, Math.min(1, SHOP.drunk) * .8);
  const k = Math.min(1, SHOP.drunk), t = uTimeNow();
  if (player.mode === 'walk' && player.v > .3 && !V5.lad && !player.air3) player.yaw += (Math.sin(t * 1.1) + Math.sin(t * 2.7) * .5) * .9 * k * dt;
  if (player.mode === 'drive' && player.veh && !player.veh.fly) { const v = player.veh, sp = Math.hypot(v.vx, v.vz); if (sp > 2) v.yaw += (Math.sin(t * .8) + Math.sin(t * 2.1) * .4) * .22 * k * dt; }
}

// ═══ CHROME WORKS 的自動捲門：自己的車開到門口 6 m 內、警察沒看到才捲上去 ═══
{
  const k = new Kit(), w = 10.2, h = 3.7;
  for (let y = .12; y < h; y += .24) k.box(0, y, 0, w, .2, .06, 0x6c7176, 15).box(0, y + .11, .02, w, .03, .05, 0x3a3e42, 15);
  k.box(0, h - .05, .05, w, .12, .1, 0x2cf2d8, 8);
  const m = new T.Mesh(k.build(), MAT.uber); m.position.set(GAR_X, 0, GAR_Z + .16); cityAdd(m, zoneAtL(GAR_X, GAR_Z));
  // 捲門後面的車庫：立面上畫的是關著的鐵捲門，門捲起來時用一片暗的室內（天花板燈條、舉升機）蓋住它
  const ik = new T.Mesh(new Kit().box(0, h / 2, 0, w, h, .04, 0x0d0e11, 2).box(0, .02, .3, w, .04, .6, 0x1c1e22, 2)
    .box(-2.6, h - .3, .03, 3, .06, .04, 0xd8f0ff, 8).box(2.6, h - .3, .03, 3, .06, .04, 0xd8f0ff, 8)
    .box(-1.2, .9, .05, .14, 1.8, .06, 0x2a2c30, 15).box(1.2, .9, .05, .14, 1.8, .06, 0x2a2c30, 15).box(0, 1.5, .06, 2.6, .1, .06, 0xf0a020, 15).build(), MAT.uber);
  ik.position.set(GAR_X, 0, GAR_Z + .08); ik.visible = false; cityAdd(ik, zoneAtL(GAR_X, GAR_Z));
  // 門頂的旋轉警示黃燈（燈罩裡一片反光板，轉起來掃一圈）
  const bc = new T.Mesh(new Kit().cyl(0, .12, 0, .12, .12, .24, 12, 0xffa020, 11).box(.06, .12, 0, .02, .18, .16, 0xfff2c0, 8).build(), MAT.uber);
  bc.position.set(GAR_X + w / 2 - .4, h + .1, GAR_Z + .3); cityAdd(bc, zoneAtL(GAR_X, GAR_Z));
  SHOP.shutter = { m, ik, open: 0, msgT: 0, bc };
}
function shutterStep(dt) {
  const S = SHOP.shutter; if (!S) return;
  const v = player.mode === 'drive' ? player.veh : null, [gx, gz] = toW(GAR_X, GAR_Z + SW + 4);
  const near = v && !v.fly && !v.boat && Math.hypot(v.x - gx, v.z - gz) < 6;   // 紅外線感應區：門前 6 m（偷來的車與機車也開得進去，66-chrome.js）
  const why = near ? v6DoorBlock(v) : '';   // 69-v6-customs.js：歇業、警察看得到、太燙手的贓車、坦克
  const want = near && !why ? 1 : 0;
  if (near && why && (S.msgT -= dt) <= 0) { S.msgT = 6; toast(why); }
  if (want !== S.want) { S.want = want; if (want) sfx.hiss(); sfx.door(); }
  S.open = clamp(S.open + (want ? 1 : -1) * dt / 1.2, 0, 1);   // 氣壓閥一聲，1.2 秒內升起
  S.m.scale.y = 1 - S.open * .92; S.m.position.y = S.open * 3.4;
  S.ik.visible = S.open > .02;
  S.spin = (near || (S.open > .01 && S.open < .99)) ? (S.spin || 0) + dt * 9 : 0;   // 門頂的警示黃燈：開門時轉
  if (S.bc) { S.bc.rotation.y = S.spin; S.bc.visible = true; }
}

// ─── 互動提示（便利店裡、提款機、酒吧）───
ctxHooks.unshift(p => {
  if (p.mode !== 'walk') return null;
  const nr = (x, z, r) => Math.hypot(p.x - x, p.z - z) < r;
  if (p.where === 'store') {
    if (SHOP.till && nr(APT.store.till.x, APT.store.till.z, 1.6)) return { key: 'E', text: '清空收銀機', fn: tillGrab };
    if (SHOP.reg2 && nr(STORE_REG2.x, STORE_REG2.z, 1.5)) return { key: 'E', text: '撬開第二台收銀機', fn: reg2Open };
    if (nr(STORE_FRIDGE.x, STORE_FRIDGE.z, 1.4)) return { key: 'E', text: `能量飲料 <i>· ${money(DRINK_PRICE)} 生命 +${DRINK_HP}</i>`, fn: buyDrink };
    if (SHOP.closed > 0 && SHOP.clerk && SHOP.clerk.st !== 'idle' && nr(APT.store.till.x, APT.store.till.z, 1.6)) return { key: 'E', text: '結帳台 <i>· 沒有人</i>', fn: () => toast(SHOP.clerk.st === 'dead' ? '店員倒在櫃台後面' : '店員縮在櫃台後面發抖') };
    return null;
  }
  if (p.where === 'pub' && nr(APT.pub.bar.x, APT.pub.bar.z, 1.6)) return { key: 'E', text: `點一杯黑啤酒 <i>· ${money(BOOZE.pub)}</i>`, fn: () => booze('pub') };
  if (p.where === 'club' && nr(-8.6, 12.5, 2.2)) return { key: 'E', text: `點一杯 <i>· ${money(BOOZE.club)}</i>`, fn: () => booze('club') };
  if (p.where !== 'out') return null;
  for (const A of ATM_SPOTS) {
    if (!A.w) continue;
    const [ax, az] = toW(A.x + Math.sin(A.yaw) * .9, A.z + Math.cos(A.yaw) * .9, A.zn);
    if (A.st === 'use' && arm.sel !== 'fist' && nr(A.w.x, A.w.z, 1.7)) return { key: 'E', text: '搶提款的人', fn: () => { A.face = Math.atan2(player.x - A.w.x, player.z - A.w.z); atmMug(A); } };
    if (A.st !== 'use' && nr(ax, az, 1.1)) return { key: 'E', text: '提款機', fn: () => toast(`餘額 ${money(motors.cash)} · 錢都帶在身上，提款機只是看看`) };
  }
  return null;
});
function v5ShopKey(code) { return false; }
function v5ShopUpdate(dt) {
  if (!SHOP.init) { SHOP.init = true; clerkInit(); atmInit(); }
  storeStep(dt); atmStep(dt); drunkStep(dt); shutterStep(dt); mallStep(dt);
}
Object.assign(gtaApi.v5, { SHOP, ATM_SPOTS, robStart, robDone, clerkDown, aimAtClerk, buyDrink, reg2Open, booze, atmMug, STORE_CLERK, STORE_REG2, STORE_FRIDGE });
// ═══ 楓林里商店街（10-city.js 的 FAC.mall）：鐵砧槍械、射擊場、縫線服飾、泡泡洗車隧道 ═══
// 設施座標相對街區西北角（facW 換成世界）。槍店的店面往後退 3 m，騎樓下是櫃台與老闆；射擊場在店後面，從櫃台付錢進去。
const ARMOR_TIERS = [['輕型背心', 20, 250], ['標準背心', 40, 500], ['強化背心', 60, 1000], ['重型背心', 80, 1800], ['頂級防彈衣', 100, 2500]];
const AMMO_P = { pistol: 60, smg: 120, rifle: 180, shotgun: 140, sniper: 220, rpg: 900, grenade: 300, molotov: 200, sticky: 400, petrol: 120 };
const EXT_IDS = ['pistol', 'smg', 'rifle', 'shotgun'], EXT_PRICE = 1200, EXT_K = 1.5, RANGE_FEE = 20, RANGE_T = 30, WASH_FEE = 15, WASH_V = 2, OUTFIT_PRICE = 150;
const MALL = { owner: null, range: null, wash: null, best: 0, targets: [], brushes: [], spray: [] };
const mallW = (x, z) => facW(FAC.mall, x, z);
if (!Array.isArray(motors.v5.ext)) motors.v5.ext = [];
for (const id of ARM_IDS) ARMS[id].mag0 = ARMS[id].mag;
const extApply = () => { for (const id of EXT_IDS) if (ARMS[id]) ARMS[id].mag = motors.v5.ext.includes(id) ? Math.round(ARMS[id].mag0 * EXT_K) : ARMS[id].mag0; };
extApply();
if (FAC.mall) {
  const F = FAC.mall, k = new Kit(), z = F.L[0].zn, ax = F.ax, az = F.az, G = F.L[0], C = F.L[1];
  const fb = new Kit(), fg = new Kit();   // 模型版會換掉的程式建模：fb 是服飾店的正面與燈箱櫥窗、射擊位隔板，fg 是槍架上的替身；模型下載好就藏起來
  // ─ 槍店：騎樓（屋頂、兩根柱子）、櫃台、後牆的槍架與燈條
  k.box(ax + 21.25, 3.45, az + 14, 17.5, .2, 3, 0x1c1e22, 2);
  for (const x of [13, 29.5]) k.box(ax + x, 1.7, az + 12.8, .3, 3.4, .3, 0x2a2c30, 15);
  // 櫃台：木頭底座、金屬框、上半截是玻璃展示櫃（紅絨布上擺手槍，模型版才有）；後牆是深色洞洞板與三排掛架
  k.box(ax + 21, .4, az + 14.6, 10, .8, .6, 0x3a2c22, 2).box(ax + 21, .81, az + 14.6, 9.9, .02, .56, 0x5a1a1e, 2);
  for (const [x, w] of [[16.02, .04], [25.98, .04], [21, .04]]) k.box(ax + x, .96, az + 14.6, w, .32, .6, 0x8a8e92, 3);
  for (const s of [-1, 1]) k.box(ax + 21, 1.13, az + 14.6 + s * .3, 10.04, .025, .04, 0x8a8e92, 3);
  k.box(ax + 21.25, 2.2, az + 15.46, 15.6, 2.2, .04, 0x23252a, 2);
  for (let x = 14.5; x < 28.5; x += 1.4) for (const y of [1.6, 2.2, 2.8]) k.box(ax + x, y, az + 15.42, .9, .07, .1, 0x15161a, 15);
  for (let x = 14.5; x < 28.5; x += 1.4) for (const y of [1.6, 2.2, 2.8]) fg.box(ax + x - .2, y + .06, az + 15.4, .12, .14, .08, 0x5a3a26, 2);
  k.box(ax + 21.25, 3.3, az + 15.4, 16, .06, .06, 0xffa040, 8);
  // ─ 射擊場：三面 3.2 m 的水泥牆、射擊位的雨遮與隔板、地上的距離線、標靶的沙堆
  const R = F.range, rx0 = R.x0 - ax, rx1 = R.x1 - ax, rz0 = R.z0 - az, rz1 = R.z1 - az;
  k.box(ax + (rx0 + rx1) / 2, .17, az + (rz0 + rz1) / 2, rx1 - rx0, .04, rz1 - rz0, 0x5a5448, 2);
  for (const [x0, x1, z0, z1] of [[rx0, rx0 + .4, rz0, rz1], [rx1 - .4, rx1, rz0, rz1], [rx0, rx1, rz1 - .4, rz1]]) {
    k.box(ax + (x0 + x1) / 2, 1.6, az + (z0 + z1) / 2, x1 - x0, 3.2, z1 - z0, 0x8a8478, 2);
    colliders.push({ x0: ax + x0, x1: ax + x1, z0: az + z0, z1: az + z1, hy: 3.2, zn: z });
  }
  k.box(ax + (rx0 + rx1) / 2, 2.9, az + rz0 + 2.2, rx1 - rx0, .15, 4.4, 0x2a2c30, 2);
  for (let x = rx0 + 3.5; x < rx1 - 1; x += 3.4) fb.box(ax + x, 1.2, az + rz0 + 2.6, .06, 1.6, 1.4, 0x6a6e72, 2);
  for (const d of [10, 15, 20]) k.box(ax + (rx0 + rx1) / 2, .2, az + rz0 + 2.6 + d, rx1 - rx0 - 1, .01, .08, 0xe8e4d8, 2);
  k.box(ax + (rx0 + rx1) / 2, .6, az + rz1 - 1.4, rx1 - rx0 - 1, 1, 1.4, 0x8a7350, 2);
  // ─ 服飾店：二樓的店往後退（10-city.js 的 FAC.mall），前面是一層樓的店面（z 12.9–20.3）：屋頂與兩側牆一直都有；
  // 正面在模型版是 jungle_jim 的兩間維多利亞式店面（玻璃後面擺假人與掛衣架），程式建模是一整片牆加兩扇燈箱櫥窗
  k.box(ax + 37.5, 4.98, az + 16.7, 12.7, .14, 7.4, 0x2a2826, 2);
  for (const x of [31.2, 43.8]) k.box(ax + x, 2.45, az + 16.6, .24, 4.9, 7.4, 0x5a3e34, 2);
  colliders.push({ x0: ax + 31.1, x1: ax + 43.9, z0: az + 12.9, z1: az + 20.3, hy: 5.05, zn: z });
  fb.box(ax + 37.5, 2.45, az + 12.95, 12.4, 4.9, .1, 0x4a3a32, 2);
  for (const x of [34, 41]) fb.box(ax + x, 1.6, az + 12.87, 4.2, 2.4, .08, 0xfff0e0, 11);
  // ─ 停車場：柏油與停車格
  const P0 = F.lot;
  k.box((P0.x0 + P0.x1) / 2, .165, (P0.z0 + P0.z1) / 2, P0.x1 - P0.x0, .03, P0.z1 - P0.z0, 0x2c2e31, 2);
  for (let x = P0.x0 + 1.5; x < P0.x1; x += 2.8) k.box(x, .185, P0.z1 - 2.6, .08, .01, 5, 0xd8d4c4, 2);
  // ─ 洗車隧道：兩側波浪板牆、屋頂、入口的拱門與燈箱、地上的導軌
  const Wsh = F.wash, wx0 = Wsh.x0 - ax, wx1 = Wsh.x1 - ax, wz0 = Wsh.z0 - az, wz1 = Wsh.z1 - az, wc = (wx0 + wx1) / 2;
  for (const [x0, x1] of [[wx0, wx0 + .4], [wx1 - .4, wx1]]) {
    for (let zz = wz0; zz < wz1 - .01; zz += .5) k.box(ax + (x0 + x1) / 2, 2.2, az + zz + .25, x1 - x0, 4.4, .46, (zz / .5) % 2 ? 0xd0d4d8 : 0xb8bcc2, 2);
    colliders.push({ x0: ax + x0, x1: ax + x1, z0: az + wz0, z1: az + wz1, hy: 4.4, zn: z });
  }
  k.box(ax + wc, 4.5, az + (wz0 + wz1) / 2, wx1 - wx0 + .4, .2, wz1 - wz0, 0x2a5a8a, 2);
  for (const zz of [wz0, wz1]) k.box(ax + wc, 4.75, az + zz, wx1 - wx0 + .6, .5, .3, 0x1a3a6a, 2);
  for (const s of [-1, 1]) k.box(ax + wc + s * 1.1, .19, az + (wz0 + wz1) / 2, .12, .05, wz1 - wz0 + 8, 0x8a8e92, 3);
  k.box(ax + wx0 - .9, 1.1, az + wz0 - 1.6, .3, 2.2, .3, 0x30343a, 15).box(ax + wx0 - .72, 1.35, az + wz0 - 1.6, .06, .5, .36, 0x6ad0ff, 8);
  colliders.push({ x0: ax + wx0 - 1.1, x1: ax + wx0 - .7, z0: az + wz0 - 1.8, z1: az + wz0 - 1.4, zn: z });
  cityAdd(new T.Mesh(k.build(), MAT.uber), z);
  cityAdd(MALL.fb = new T.Mesh(fb.build(), MAT.uber), z); cityAdd(MALL.fg = new T.Mesh(fg.build(), MAT.uber), z);
  // 店裡的陳設（模型版才擺：程式建模的正面是一整片牆）：櫥窗裡穿衣服的假人、後牆的胡桃木層架與一疊疊摺好的衣服
  { const mk = new Kit(), PAL = [0x2a3a5a, 0xc8b89a, 0x8a2a2a, 0x3a5a3a, 0xe8e2d8, 0x1a1a1a, 0x6a7a9a, 0xb07a4a];
    [32.7, 36.3, 40.6, 42.8].forEach((x, i) => mk.cyl(ax + x, .1, az + 13.75, .22, .22, .06, 14, 0x2a2a2a, 3).cyl(ax + x, .7, az + 13.75, .025, .025, 1.2, 6, 0x8a8e92, 3)
      .cyl(ax + x, 1.25, az + 13.75, .15, .19, .75, 12, PAL[i * 3 % 8], 2).cyl(ax + x, 1.72, az + 13.75, .1, .1, .22, 10, 0xe8e2d8, 2));
    let n = 0;
    for (const [x0, x1] of [[31.6, 37.4], [37.7, 43.6]]) {
      mk.box(ax + (x0 + x1) / 2, 1.75, az + 19.95, x1 - x0 - .3, 3.5, .08, 0x3a2a22, 2);
      for (const y of [.8, 1.4, 2, 2.6]) {
        mk.box(ax + (x0 + x1) / 2, y, az + 19.72, x1 - x0 - .6, .04, .42, 0x6a4a36, 2);
        for (let x = x0 + .6; x < x1 - .5; x += .48) mk.box(ax + x, y + .02 + .06 * (1 + n % 2), az + 19.72, .36, .12 * (1 + n % 2), .3, PAL[n++ * 5 % 8], 2);
      }
    }
    cityAdd(MALL.mann = new T.Mesh(mk.build(), MAT.uber), z); MALL.mann.visible = false; }
  { const g = new T.Mesh(new T.BoxGeometry(9.9, .3, .56), new T.MeshBasicMaterial({ color: 0x9ab8c4, transparent: true, opacity: .1, depthWrite: false }));
    v5Put(F, g, 21, .97, 14.6, 0); }
  // 櫃台的碰撞（人站在騎樓下、櫃台外面）
  colliders.push({ x0: ax + 16, x1: ax + 26, z0: az + 14.3, z1: az + 14.95, hy: 1.15, zn: z });
  // 招牌
  const put = (m, x, y, zz, ry) => v5Put(F, m, x, y, zz, ry);
  put(v5Sign([['鐵砧槍械', .46, '#ffb35a', .4], ['IRONCLAD ARMS · 射擊場', .24, '#e8e0d0', .8]], 8, 1.7, { bg: '#16171a', edge: '#ffb35a', dim: 0xffffff }), 21.25, 5.4, 15.42, Math.PI);
  put(v5Sign([['縫線服飾', .44, '#1a1a1a', .38], ['STITCHLINE', .3, '#6a5040', .78]], 6, 1.6, { bg: '#f4ece0', dim: 0xf0f0f0 }), 37.5, 5.85, 12.95, Math.PI);
  put(v5Sign([['泡泡隧道 洗車', .4, '#ffffff', .38], [`SUDS TUNNEL · ${money(WASH_FEE)}`, .3, '#bfe6ff', .78]], wx1 - wx0, 1.4, { bg: '#1a4a8a', edge: '#7ad0ff', dim: 0xffffff }), wc, 5.65, wz0 - .17, Math.PI);
  put(v5Sign([['射擊位', .5, '#f0e8d8', .5]], 3, .6, { bg: '#2a2c30' }), (rx0 + rx1) / 2, 2.6, rz0 + .2, 0);
  v5Light(F, 21, 3.2, 13.8, 0xffc890, 9, 1.1); v5Light(F, 37.5, 2.6, 11.4, 0xfff0e0, 8, .9); v5Light(F, wc, 4, wz0 + 3, 0x9ad8ff, 10, 1); v5Light(F, wc, 4, wz1 - 3, 0x9ad8ff, 10, 1);
  v5Light(F, (rx0 + rx1) / 2, 2.7, rz0 + 2, 0xfff0d8, 10, 1);
  for (const x of [34.5, 40.6]) v5Light(F, x, 3.8, 16.2, 0xfff0d8, 7, .9);   // 服飾店裡
  // 會動的東西：標靶（9 個，軸在底部，倒下時躺平）、刷子（兩側直立 2 組、上方橫的 1 支）、水霧
  for (const d of [10, 15, 20]) for (const s of [-1, 0, 1]) {
    const tk = new Kit(); tk.box(0, .6, 0, .08, 1.2, .08, 0x5a4a3a, 2);
    for (const [r, c] of [[.42, 0xf0ece0], [.3, 0x1a1a1a], [.18, 0xf0ece0], [.08, 0xd82a2a]]) tk.cyl(0, 1.45, 0, r, r, .03 + (.42 - r) * .05, 18, c, 2, Math.PI / 2);
    const m = new T.Mesh(tk.build(), MAT.uber); m.position.set(ax + (rx0 + rx1) / 2 + s * 4.5, .2, az + rz0 + 2.6 + d); m.rotation.x = -Math.PI / 2; cityAdd(m, z);
    MALL.targets.push({ m, x: (rx0 + rx1) / 2 + s * 4.5, z: rz0 + 2.6 + d, up: 0, t: 0 });
  }
  for (const [x, zz, hz] of [[wc - 2.1, 10, 0], [wc + 2.1, 10, 0], [wc - 2.1, 15, 0], [wc + 2.1, 15, 0], [wc, 19, 1]]) {
    const bk = new Kit();
    if (hz) { bk.cyl(0, 0, 0, .1, .1, 5.4, 8, 0x8a8e92, 3, 0, 0, Math.PI / 2); for (let a = 0; a < 10; a++) bk.box(0, Math.cos(a * .63) * .35, Math.sin(a * .63) * .35, 5.2, .5, .08, a % 2 ? 0x2a7ad8 : 0xd83a7a, 2, a * .63); }
    else { bk.cyl(0, 0, 0, .08, .08, 3.4, 8, 0x8a8e92, 3); for (let a = 0; a < 10; a++) bk.box(Math.cos(a * .63) * .4, 0, Math.sin(a * .63) * .4, .09, 3, .55, a % 2 ? 0x2a7ad8 : 0xffd23a, 2, 0, -a * .63); }
    const m = new T.Mesh(bk.build(), MAT.uber); m.position.set(ax + x, hz ? 2.6 : 1.9, az + wz0 + zz); cityAdd(m, z);
    MALL.brushes.push({ m, hz, z: wz0 + zz });
  }
  { const sk = new Kit(); for (let i = 0; i < 14; i++) sk.box((i % 7 - 3) * .75, 3.6 - Math.floor(i / 7) * .3, (i * .37) % 1 - .5, .5, .9, .02, 0xcfe8ff, 11, .3, i);
    const m = new T.Mesh(sk.build(), new T.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: .35, depthWrite: false })); m.position.set(ax + wc, 0, az + wz0 + 6); m.visible = false; cityAdd(m, z); MALL.spray.push(m); }
}
// ─── 模型版（只在 http(s)）：走近商店街 160 m 內才下載 v5shop.glb（服飾店店面、掛衣架、吊靶、射擊位）與武器模型（槍牆、展示櫃）───
const _mm = new T.Matrix4(), _mq = new T.Quaternion(), _me = new T.Euler();
// 同一材質的部件合併成一個網格：o = { it, x, y, z（設施座標）, ry, rz（先繞 z 再繞 y）}
function v5Merge(F, list) {
  const by = new Map();
  for (const o of list) {
    _me.set(0, o.ry || 0, o.rz || 0, 'YZX'); _mm.compose(V3(F.ax + o.x, o.y, F.az + o.z), _mq.setFromEuler(_me), V3(1, 1, 1));
    for (const p of o.it.parts) { if (!by.has(p.mat)) by.set(p.mat, []); by.get(p.mat).push(p.geo.clone().applyMatrix4(_mm)); }
  }
  for (const [mat, geos] of by) {
    const g = mergeGeometries(geos); for (const x of geos) x.dispose(); if (!g) continue;
    const m = new T.Mesh(g, mat); m.matrixAutoUpdate = false; m.userData.noTess = 1; cityAdd(m, facZn(F));
  }
}
// 槍牆三排（由上往下）：照模型長度由左往右排到牆尾；展示櫃裡橫躺的手槍、衝鋒槍與手榴彈
const GUN_ROWS = [[2.8, ['sniper', 'rifle', 'shotgun', 'rifle', 'sniper', 'shotgun', 'rifle', 'rpg', 'rifle']],
  [2.2, ['rifle', 'smg', 'shotgun', 'launcher', 'smg', 'rifle', 'minigun', 'smg', 'shotgun', 'smg']],
  [1.6, ['smg', 'pistol', 'pistol', 'katana', 'pistol', 'smg', 'bat', 'pistol', 'pistol', 'smg', 'baton', 'pistol', 'pistol']]];
const CASE_ROW = ['pistol', 'grenade', 'pistol', 'smg', 'pistol', 'c4', 'pistol', 'pistol', 'grenade', 'smg', 'pistol', 'gas', 'pistol', 'pistol', 'smg', 'pistol'];
function mallGlb() {
  const F = FAC.mall; MALL.glb = 1;
  return Promise.all([loadProps('v5shop'), loadProps('arms')]).then(([S, A]) => {
    if (S) {
      v5Put(F, propObject(S.front, 0, 0, 0), 37.5, 0, 13, Math.PI);
      v5Merge(F, [[33, 16.6, 'rackA'], [35.9, 18.6, 'rackB'], [39.9, 16.6, 'rackB'], [42.4, 18.6, 'rackA']].map(([x, zz, id]) => ({ it: S[id], x, y: .07, z: zz, ry: Math.PI / 2 })));
      const R = F.range, cx = (R.x0 + R.x1) / 2 - F.ax, rz0 = R.z0 - F.az;
      v5Merge(F, [-2, -1, 0, 1, 2].map(i => ({ it: S.booth, x: cx + i * 1.9, y: .19, z: rz0 + 4.5 })));
      const pk = new Kit(); for (const s of [-1, 1]) pk.box(s * .64, .99, 0, .05, 1.98, .05, 0x3a3c40, 3); pk.box(0, 1.98, 0, 1.36, .05, .05, 0x3a3c40, 3);
      const posts = pk.build();
      for (const t of MALL.targets) { t.m.geometry.dispose(); t.m.geometry = posts; t.m.add(propObject(S.target, 0, .95, 0, Math.PI)); }
      MALL.mann.visible = true; MALL.fb.visible = false;
    }
    if (A) {
      const list = [];
      for (const [y, ids] of GUN_ROWS) {
        let x = 13.9;
        for (const id of ids) {
          const it = A[id]; if (!it) continue;
          if (x + it.d > 28.6) break;
          list.push({ it, x: x + it.d / 2, y: y - .02 + it.h / 2, z: 15.36 - it.w / 2, ry: Math.PI / 2 }); x += it.d + .28;
        }
      }
      CASE_ROW.forEach((id, i) => { const it = A[id]; if (!it) return; const lie = id !== 'grenade' && id !== 'gas';
        list.push({ it, x: 16.5 + i * .6, y: .82 + (lie ? it.w : it.h) / 2, z: 14.6 + (i % 2 ? .09 : -.09), ry: Math.PI / 2 + (i % 3 - 1) * .25, rz: lie ? Math.PI / 2 : 0 }); });
      v5Merge(F, list); MALL.fg.visible = false;
    }
  });
}
// 店面前的路邊車位清掉（洗車隧道的進出口與槍店騎樓前）：30-vehicles.js 的 facParked 之後呼叫
function mallParkClear() {
  const F = FAC.mall; if (!F) return;
  const wc = (F.wash.x0 + F.wash.x1) / 2;
  for (let i = parked.length - 1; i >= 0; i--) { const p = parked[i]; if (Math.abs(p.x - wc) < 9 && (Math.abs(p.z - F.az) < 8 || Math.abs(p.z - (F.az + Q)) < 8)) parked.splice(i, 1); }
}

// ─── 槍店老闆：櫃台後面；你在附近拿槍指著他或開槍，他抽槍反擊 ───
const OWNER_AT = [21, 15.05];
function ownerInit() {
  if (!FAC.mall) return;
  const cr = crowd(1); cr.look(0, { r: rng(2611), female: false, coat: 1 }); scene.add(cr.mesh);
  const s = spotW({ x: FAC.mall.ax + OWNER_AT[0], z: FAC.mall.az + OWNER_AT[1], yaw: Math.PI }, facZn(FAC.mall));
  MALL.owner = { cr, s, st: 'idle', hp: 120, shotT: 1, closed: 0 };
  ownerPose();
}
function ownerPose() {
  const O = MALL.owner, s = O.s, y = groundH(s.x, s.z);
  if (O.st === 'dead') O.cr.anim(0, ANIM.die, O.t0 || 0, 1, 0);
  else O.cr.anim(0, O.st === 'hostile' ? ANIM.aimIdle : ANIM.cross, uTimeNow(), 1, 0);
  O.cr.place(0, s.x, y, s.z, O.st === 'hostile' ? Math.atan2(pX() - s.x, pZ() - s.z) : s.yaw); O.cr.flush();
}
// 槍口的射線離某一點（世界座標，人的中心線 y0–y1）多近
function rayHitsCyl(R, x, z, y0, y1, r) {
  const px = x - R.ox, pz = z - R.oz, hd = Math.hypot(R.dx, R.dz) || 1e-6, t = (px * R.dx + pz * R.dz) / (hd * hd);
  if (t < 0) return false;
  const cx = R.ox + R.dx * t, cz = R.oz + R.dz * t, y = R.oy + R.dy * t;
  return Math.hypot(cx - x, cz - z) < r && y > y0 && y < y1;
}
function ownerStep(dt, fired) {
  const O = MALL.owner; if (!O) return;
  const s = O.s, d = Math.hypot(pX() - s.x, pZ() - s.z);
  if (O.st === 'dead') { if ((O.closed -= dt) <= 0 && d > 120) { O.st = 'idle'; O.hp = 120; ownerPose(); } return; }
  if (fired && player.mode === 'walk' && rayHitsCyl(aimRay(), s.x, s.z, groundH(s.x, s.z), groundH(s.x, s.z) + 1.85, .4)) {
    O.hp -= ARMS[arm.sel].dmg || 30;
    if (O.hp <= 0) { O.st = 'dead'; O.t0 = uTimeNow(); O.closed = 300; ownerPose(); crime('kill', s.x, s.z); toast('槍店老闆倒下了 · 鐵砧槍械今天不營業'); return; }
  }
  const threat = !MALL.range && player.mode === 'walk' && d < 16 && (fired || gta.aiming && ARMS[arm.sel].gun && Math.abs(wrapA(Math.atan2(s.x - player.x, s.z - player.z) - player.yaw)) < .3);
  if (O.st === 'idle' && threat) { O.st = 'hostile'; toast('老闆從櫃台下抽出一把手槍：「在我店裡？你找錯地方了。」'); }
  if (O.st === 'hostile') {
    if (d > 40 || life.dead) { O.st = 'idle'; ownerPose(); return; }
    if ((O.shotT -= dt) <= 0) { O.shotT = .9; sfx.shot(); crime('shots', s.x, s.z); if (Math.random() < Math.max(.25, 1 - d / 30)) hurtPlayer(12, pX() - s.x, pZ() - s.z); }
  }
  if (d < 60) ownerPose();
}
function gunShop() {
  if (!MALL.owner || MALL.owner.st !== 'idle') return;
  dialog('鐵砧槍械 · 櫃台', `老闆把雙手撐在玻璃櫃上：「要什麼？」\n身上有 ${money(motors.cash)}，護甲 ${Math.round(life.armor)}。`, [
    { t: '彈藥', fn: shopAmmo }, { t: '防彈背心', fn: shopArmor }, { t: '配件（消音器、擴充彈匣）', fn: shopMods },
    { t: `射擊場（${money(RANGE_FEE)}・${RANGE_T} 秒）`, fn: () => { closeDialog(); rangeStart(); } }, { t: '離開', fn: closeDialog },
  ]);
}
const v5Pay = n => { if (motors.cash < n) { toast(`現金不夠，還差 ${money(n - motors.cash)}`); return false; } motors.cash -= n; saveMotors(); return true; };
function shopAmmo() {
  const ids = ARM_IDS.filter(id => (ARMS[id].gun || ARMS[id].throw) && AMMO_P[id]).slice(0, 8);
  dialog('鐵砧槍械 · 彈藥', '補滿備彈（投擲物補滿數量）。', [...ids.map(id => {
    const A = ARMS[id], a = arm.ammo[id], full = A.gun ? a.res >= A.res : a.mag >= A.n;
    return { t: `${A.name}${full ? '（已滿）' : ` · ${money(AMMO_P[id])}`}`, fn: () => { if (full || !v5Pay(AMMO_P[id])) return; if (A.gun) a.res = A.res; else a.mag = A.n; sfx.reload(); toast(`${A.name}的彈藥補滿了`); shopAmmo(); } };
  }), { t: '返回', fn: gunShop }]);
}
function shopArmor() {
  dialog('鐵砧槍械 · 防彈背心', `目前護甲 ${Math.round(life.armor)}。換上比較好的背心就補到那一級。`, [...ARMOR_TIERS.map(([n, a, p]) => ({
    t: `${n}（護甲 ${a}）· ${money(p)}`, fn: () => { if (life.armor >= a) { toast('你身上的已經比這件好了'); return; } if (!v5Pay(p)) return; life.armor = a; sfx.pickup(); toast(`穿上${n} · 護甲 ${a}`); shopArmor(); },
  })), { t: '返回', fn: gunShop }]);
}
function shopMods() {
  const rows = [
    ...SIL_IDS.map(id => ({ t: `${ARMS[id].name}消音器${silOn(id) ? '（已裝）' : ` · ${money(SIL_PRICE)}`}`, fn: () => { if (silOn(id) || !v5Pay(SIL_PRICE)) return; motors.gear.sil.push(id); saveMotors(); silFit(id); sfx.reload(); toast(`${ARMS[id].name}裝上消音器`); shopMods(); } })),
    ...EXT_IDS.map(id => { const has = motors.v5.ext.includes(id); return { t: `${ARMS[id].name}擴充彈匣${has ? '（已裝）' : ` · ${money(EXT_PRICE)}`}`, fn: () => { if (has || !v5Pay(EXT_PRICE)) return; motors.v5.ext.push(id); saveMotors(); extApply(); sfx.reload(); toast(`${ARMS[id].name}換上擴充彈匣 · ${ARMS[id].mag} 發`); shopMods(); } }; }),
  ];
  dialog('鐵砧槍械 · 配件', '消音器讓槍聲只傳 7 m；擴充彈匣多五成容量。', [...rows.slice(0, 8), { t: '返回', fn: gunShop }]);
}

// ─── 射擊場：30 秒，標靶隨機立起 2.2 秒，打中一個 1 分 ───
function rangeStart() {
  if (!FAC.mall || MALL.range) return;
  if (!ARMS[arm.sel].gun) { toast('先在手上拿一把槍（Tab 武器轉盤）'); return; }
  if (!v5Pay(RANGE_FEE)) return;
  transition(() => {
    const R = FAC.mall.range, s = spotW({ x: (R.x0 + R.x1) / 2, z: R.z0 + 3.6, yaw: 0 }, facZn(FAC.mall));
    player.x = s.x; player.z = s.z; player.y = groundH(s.x, s.z); player.yaw = s.yaw; camState.yaw = s.yaw; camState.snap = true;
    MALL.range = { t: RANGE_T, score: 0, next: 1, cur: null };
    toast(`射擊場 · ${RANGE_T} 秒 · 右鍵瞄準、左鍵射擊`);
  });
}
function rangeEnd(quit) {
  const G = MALL.range; MALL.range = null; v5Bar(null);
  for (const t of MALL.targets) { t.up = 0; }
  const n = G.score, best = n > MALL.best; if (best) MALL.best = n;
  if (!quit) { skUp('sho', n * .15); toast(`射擊場結束 · 命中 ${n}${best ? '（新紀錄）' : `（最佳 ${MALL.best}）`}${n ? ` · 射擊 +${(n * .15).toFixed(1)}` : ''}`); }
  transition(() => { const [x, z] = mallW(21, 12.6); player.x = x; player.z = z; player.y = groundH(x, z); player.yaw = facY(FAC.mall, Math.PI); camState.yaw = player.yaw; camState.snap = true; });
}
function rangeStep(dt, fired) {
  for (const t of MALL.targets) { t.k = damp(t.k || 0, t.up, 10, dt); t.m.rotation.x = -Math.PI / 2 * (1 - t.k); }
  const G = MALL.range; if (!G) return;
  if (life.dead || player.mode !== 'walk') { MALL.range = null; v5Bar(null); for (const t of MALL.targets) t.up = 0; return; }
  G.t -= dt; v5Bar(`射擊場 · 命中 ${G.score}`, Math.max(0, G.t / RANGE_T));
  if (G.cur && (G.cur.t -= dt) <= 0) { G.cur.up = 0; G.cur = null; G.next = .4; }
  if (!G.cur && (G.next -= dt) <= 0) { const list = MALL.targets; G.cur = list[Math.floor(Math.random() * list.length)]; G.cur.up = 1; G.cur.t = 2.2; }
  if (fired && G.cur && G.cur.k > .8) {
    const [x, z] = mallW(G.cur.x, G.cur.z), R = aimRay(), y = groundH(x, z) + .2 + 1.45;
    if (rayHitsCyl(R, x, z, y - .45, y + .45, .45)) { G.score++; sfx.click(); G.cur.up = 0; G.cur = null; G.next = .5; }
  }
  if (G.t <= 0) rangeEnd(false);
}
// 69-police.js 的 crime() 問這裡：射擊場裡開槍不算犯罪
function v5Quiet(kind) { return kind === 'shots' && !!MALL.range; }

// ─── 縫線服飾：換一套衣服；通緝中、警察沒看到時換裝，少一顆星 ───
function clothesShop() {
  const i = crew.cur, c = CREW[i], O = OUTFITS[c.id], cur = outfitOf(c);
  dialog('縫線服飾 · STITCHLINE', `店員遞來一疊衣服。現在穿的是「${O[cur].name}」，換一套 ${money(OUTFIT_PRICE)}。${W.stars ? '\n（通緝中：警察沒看到你的時候換裝，可以甩掉一顆星。）' : ''}`, [
    ...O.flatMap((o, k) => !outfitOk(o) ? [] : [{ t: k === cur ? `${o.name}（現在穿的）` : `${o.name} · ${money(OUTFIT_PRICE)}`, fn: () => {
      closeDialog(); if (k === cur || !v5Pay(OUTFIT_PRICE)) return;
      outfitApply(i, k, true); sfx.pickup();
      if (W.stars > 0 && !W.seen) { const n = W.stars - 1; wantedApi.set(n); toast(`${c.name} 換上${o.name} · 警察認不出你了（通緝 ${n} 星）`); }
      else toast(`${c.name} 換上${o.name}${W.stars ? ' · 警察正看著你，換了也沒用' : ''}`);
    } }]),
    { t: '算了', fn: closeDialog },
  ]);
}

// ─── 泡泡洗車：車開到入口 E 付 $15，車被輸送帶拉過隧道，泥巴與血跡洗掉 ───
const washIn = v => { const F = FAC.mall; if (!F) return false; const [x, z] = toL(v.x, v.z, facZn(F)), W0 = F.wash; return x > W0.x0 + .6 && x < W0.x1 - .6 && z > W0.z0 - 7 && z < W0.z0 + 1.5; };
function washStart(v) {
  if (!v5Pay(WASH_FEE)) return;
  MALL.wash = { v, z: FAC.mall.wash.z0 - 3, done: false };
  sfx.door(); toast('排檔打到空檔，輸送帶把車拉進去……');
}
function washStep(dt) {
  const G = MALL.wash, F = FAC.mall;
  const on = !!G;
  for (const B of MALL.brushes) { const near = on && Math.abs(G.z - B.z - F.az) < 4; B.spin = damp(B.spin || 0, near ? 9 : on ? 1.5 : 0, 3, dt); if (B.spin > .01) { if (B.hz) B.m.rotation.x += B.spin * dt; else B.m.rotation.y += B.spin * dt; } }
  for (const m of MALL.spray) { m.visible = on && G.z < F.wash.z0 + 12; if (m.visible) m.material.opacity = .25 + Math.random() * .2; }
  if (!G) return;
  const v = G.v;
  if (player.veh !== v || v.dead) { MALL.wash = null; return; }
  G.z += WASH_V * dt;
  const wc = (F.wash.x0 + F.wash.x1) / 2, s = spotW({ x: wc, z: G.z, yaw: 0 }, facZn(F));
  v.x = s.x; v.z = s.z; v.yaw = s.yaw; v.vx = v.vz = v.yr = 0; v.y = groundH(s.x, s.z);
  if (G.z > F.wash.z0 + 4 && G.z < F.wash.z1 - 4) { v.dirt = Math.max(0, (v.dirt || 0) - dt * .12); v.blood = Math.max(0, (v.blood || 0) - dt * .12); carGrime(v); }
  if (G.z >= F.wash.z1 + 2) { v.dirt = v.blood = 0; v.bloodRep = false; carGrime(v); MALL.wash = null; sfx.pickup(); toast('洗好了：車身亮得反光'); }
}

// ─── 車身的泥巴與血跡：開久了沾泥（下雨沾得快），撞到人沾血；路人看到車頭有血會報警 ───
const GRIME_TX = (() => {
  const mk = (draw) => { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; draw(cv.getContext('2d')); const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return t; };
  const R = rng(4242);
  return {
    blood: mk(c => { for (let i = 0; i < 70; i++) { const x = 128 + (R() - .5) * 220, y = 30 + R() * 90, r = 2 + R() * 14; c.fillStyle = `rgba(${90 + R() * 40 | 0},6,8,${.55 + R() * .4})`; c.beginPath(); c.ellipse(x, y, r, r * (.4 + R()), R() * 3, 0, 7); c.fill(); if (R() < .4) c.fillRect(x - 1, y, 2, 10 + R() * 24); } }),
    dirt: mk(c => { const g = c.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(70,52,34,0)'); g.addColorStop(.5, 'rgba(70,52,34,.45)'); g.addColorStop(1, 'rgba(60,44,28,.95)'); c.fillStyle = g; c.fillRect(0, 0, 256, 128); for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(${50 + R() * 30 | 0},${38 + R() * 20 | 0},24,${R() * .6})`; c.fillRect(R() * 256, 50 + R() * 78, 2 + R() * 6, 2 + R() * 4); } }),
  };
})();
function carGrime(v) {
  const host = v.body || v.g; if (!host) return;
  if (!v.grime) {
    if (!(v.dirt > .02 || v.blood > .02)) return;
    const mat = tx => new T.MeshBasicMaterial({ map: tx, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, side: T.DoubleSide });
    const L = v.len || 4.5, Wd = v.w || 1.8, g = new T.Group();
    const front = new T.Mesh(new T.PlaneGeometry(Wd * .85, .55), mat(GRIME_TX.blood)); front.position.set(0, .62, L / 2 - .02); g.add(front);
    const dm = mat(GRIME_TX.dirt), dirt = [];
    for (const s of [-1, 1]) { const m = new T.Mesh(new T.PlaneGeometry(L * .86, .5), dm); m.position.set(s * (Wd / 2 + .01), .38, 0); m.rotation.y = s * Math.PI / 2; g.add(m); dirt.push(m); }
    const rear = new T.Mesh(new T.PlaneGeometry(Wd * .8, .45), dm); rear.position.set(0, .4, -L / 2 + .02); rear.rotation.y = Math.PI; g.add(rear);
    host.add(g); v.grime = { g, front, dm };
  }
  v.grime.front.material.opacity = Math.min(1, (v.blood || 0) * 1.2);
  v.grime.dm.opacity = Math.min(.9, (v.dirt || 0));
  v.grime.g.visible = (v.blood || 0) > .02 || (v.dirt || 0) > .02;
}
// 68-wreck.js 的 pedRam 撞到人時呼叫
function v5Blood(v) { if (!v || v !== player.veh) return; v.blood = Math.min(1, (v.blood || 0) + .35); carGrime(v); }
function grimeStep(dt) {
  const v = player.mode === 'drive' ? player.veh : null;
  if (!v || v.fly || v.boat) return;
  const sp = Math.hypot(v.vx, v.vz);
  if (sp > 1 && !MALL.wash) { v.dirt = Math.min(1, (v.dirt || 0) + sp * dt * (wx.wet > .3 ? .0012 : .0003)); if (((v.gT = (v.gT || 0) + dt)) > .5) { v.gT = 0; carGrime(v); } }
  // 車頭有血、車慢下來、附近 10 m 有路人：看 2.5 秒就報警（洗掉之前只報一次）
  if (v.blood > .3 && !v.bloodRep && sp < 4 && W.stars === 0) {
    const near = peds.people.some((p, k) => pedState[k] && !(pedState[k].down > 0) && Math.hypot(p.x - v.x, p.z - v.z) < 10);
    v.bloodT = near ? (v.bloodT || 0) + dt : 0;
    if (v.bloodT > 2.5) { v.bloodRep = true; addHeat(CRIME.assault, 1); toast('路人盯著車頭的血跡，拿起手機報警了 · 去洗車吧'); }
  }
}

// ─── 商店街的互動提示（步行：槍店櫃台、服飾店；開車：洗車入口）───
ctxHooks.unshift(p => {
  const F = FAC.mall; if (!F || p.where !== 'out') return null;
  if (p.mode === 'drive') {
    const v = p.veh;
    if (!MALL.wash && v && v.isCar && !v.fly && !v.boat && Math.hypot(v.vx, v.vz) < 2.5 && washIn(v)) return { key: 'E', text: `洗車 <i>· ${money(WASH_FEE)}${(v.dirt || 0) + (v.blood || 0) > .05 ? '' : ' · 車其實還算乾淨'}</i>`, fn: () => washStart(v) };
    return null;
  }
  if (p.mode !== 'walk') return null;
  if (MALL.range) { const [x, z] = mallW((F.range.x0 + F.range.x1) / 2 - F.ax, F.range.z0 - F.az + 3.6); if (Math.hypot(p.x - x, p.z - z) < 3) return { key: 'E', text: '離開射擊場', fn: () => rangeEnd(true) }; return null; }
  const O = MALL.owner, [gx, gz] = mallW(21, 13.6), [cx, cz] = mallW(37.5, 11.6);
  if (Math.hypot(p.x - gx, p.z - gz) < 2.6) return O && O.st === 'idle' ? { key: 'E', text: '鐵砧槍械 <i>· 彈藥、背心、配件、射擊場</i>', fn: gunShop } : { key: 'E', text: '鐵砧槍械 <i>· 沒人顧店</i>', fn: () => toast(O && O.st === 'hostile' ? '老闆正拿槍指著你' : '櫃台後面沒有人') };
  if (Math.hypot(p.x - cx, p.z - cz) < 2.4) return { key: 'E', text: `縫線服飾 <i>· 換裝 ${money(OUTFIT_PRICE)}</i>`, fn: clothesShop };
  return null;
});
function mallStep(dt) {
  if (!MALL.init) { MALL.init = true; ownerInit(); }
  if (GLB_ON && !MALL.glb && FAC.mall) { const [x, z] = mallW(37, 30); if (Math.hypot(pX() - x, pZ() - z) < 160) mallGlb(); }
  const A = arm.ammo[arm.sel], mag = ARMS[arm.sel].gun && A ? A.mag : -1, fired = MALL.mag >= 0 && mag >= 0 && mag < MALL.mag && player.where === 'out';
  MALL.mag = mag;
  ownerStep(dt, fired); rangeStep(dt, fired); washStep(dt); grimeStep(dt);
}
// 選址用：每個街區的區名、特殊地塊、換成模型的地塊數與地圖上的興趣點（邏輯座標的街區 i, j）
gtaApi.v5.blockInfo = () => {
  const pts = mapBlips().map(b => ({ c: b.cat, n: b.name, l: toL(b.x, b.z) }));
  return blocks.filter(b => !b.outer && !b.plaza).map(b => {
    const x0 = avX(b.i), z0 = stZ(b.j), inB = ([x, z]) => x > x0 - 4 && x < x0 + P + 4 && z > z0 - 4 && z < z0 + Q + 4;
    return { i: b.i, j: b.j, d: district(x0 + 36, z0 + 31), sp: lots.filter(L => L.b === b && L.special).map(L => L.special), glb: lots.filter(L => L.b === b && L.glb).length, poi: pts.filter(p => inB(p.l)).map(p => p.c + ':' + p.n) };
  });
};
Object.assign(gtaApi.v5, { MALL, mallGlb, gunShop, shopAmmo, shopArmor, shopMods, rangeStart, rangeEnd, clothesShop, washStart, washIn, carGrime, v5Blood, extApply, mallW, rayHitsCyl, aimRay, shutterAt: () => toW(GAR_X, GAR_Z + SW + 4) });
