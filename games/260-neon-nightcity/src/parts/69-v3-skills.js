// ═══ 第三部曲（遺漏機制與碰撞）之一：六圍屬性、衝刺體力、潛行噪音圈與消音器、潛水閉氣與水下打撈 ═══
// 規格書的數字大多遺失，這裡挑的值都集中在 SK_* 常數（README「第三部曲」一節有列）。
// 六圍每位主角各自一份（0–100），寫進存檔第 7 版的 skills；消音器、撈過的貨櫃寫進 gear（65-motors.js 讀檔時檢查形狀）。
// 排在所有 69 之後、70 之前：頂層不能碰 post、camState、keys、inp、started（只在函式裡用）。

const SKILLS = [
  { k: 'sta', n: '體力', d: '衝刺、游泳時慢慢升級。決定全速衝刺多久會喘不過氣（喘的時候還硬跑會扣血），滿級可以一直跑。' },
  { k: 'sho', n: '射擊', d: '命中、擊倒與爆頭時升級。降低後座力與散布、縮短換彈時間（滿級少 35%）。' },
  { k: 'str', n: '力量', d: '徒手與近戰武器打中人時升級。提高近戰傷害，減少摔落、飛出車外與跳傘落地的傷害。' },
  { k: 'stl', n: '潛行', d: '蹲著移動、背後偷襲時升級。縮小走路與蹲行時小地圖上的噪音圈，蹲行更快。' },
  { k: 'drv', n: '駕駛', d: '高速行駛、擦身而過與跳台騰空時升級。騰空時的翻滾與俯仰控制更靈活，翻車後翻回來更快。' },
  { k: 'lung', n: '肺活量', d: '潛水時升級。水下閉氣從 30 秒延長到 120 秒。' },
];
const SK_KEYS = SKILLS.map(s => s.k);
// 三位主角的起始值：Vance 退休特工（射擊、潛行）、Kael 地下車手（駕駛）、Jax 軍火走私（力量、體力）
const SK_BASE = [
  { sta: 40, sho: 65, str: 40, stl: 60, drv: 35, lung: 35 },
  { sta: 45, sho: 35, str: 35, stl: 35, drv: 70, lung: 40 },
  { sta: 60, sho: 50, str: 70, stl: 25, drv: 40, lung: 30 },
  { sta: 55, sho: 40, str: 60, stl: 50, drv: 35, lung: 40 },   // 主線雙主角（69-w0-story.js）：Rosa 地下擂台出身（力量、潛行）
  { sta: 55, sho: 60, str: 50, stl: 35, drv: 50, lung: 35 },   // Dane 退伍兵（射擊）
];
const SK_RUN_T = [8, 48];        // 衝刺體力：0 級 8 秒、99 級 48 秒，100 級無限
const SK_TIRED_K = .74;          // 喘的時候衝刺速度 ×0.74（4.6 → 3.4 m/s）
const SK_TIRED_HP = 1.5;         // 喘的時候還按著衝刺：每秒扣 1.5 生命（扣到 20 為止）
const SK_BREATH = [30, 120];     // 閉氣秒數
const SK_DROWN = 8;              // 沒氣之後每秒扣 8 生命
const NOISE = { crouch: 3.5, walk: 9, run: 18, swim: 6, shot: 60, sil: 7, blast: 110 };   // 噪音圈半徑（m）
const SIL_IDS = ['pistol', 'smg', 'rifle', 'sniper'], SIL_PRICE = 1800;
const PETROL_PRICE = 400;        // 汽油桶補滿（69-v3-chem.js）

// 存檔：motors.skills 是五個物件（第 13 版以前是三個）；舊存檔沒有就用起始值
const skills = SK_BASE.map((b, i) => {
  const s = motors.skills && motors.skills[i];
  return Object.fromEntries(SK_KEYS.map(k => [k, s && Number.isFinite(s[k]) ? clamp(s[k], 0, 100) : b[k]]));
});
motors.skills = skills;
motors.gear ||= { sil: [], salv: [], hire: {} };
const sk = k => skills[crew.cur][k] / 100;
// 依六圍換算的倍率（每幀 skApply 更新，69-combat.js 開槍、換彈、近戰讀；69-stunt.js 的空中操控讀）
const skK = { recoil: 1, spread: 1, rel: 1, melee: 1, take: 1, air: 1, noise: 1, crouch: 1 };
function skApply() {
  const s = sk('sho'), t = sk('str'), q = sk('stl');
  skK.recoil = 1.3 - .7 * s; skK.spread = 1.15 - .35 * s; skK.rel = 1 - .35 * s;
  skK.melee = .8 + .55 * t; skK.take = 1.2 - .55 * t;
  skK.air = 1 + .5 * Math.max(0, sk('drv') - .4);   // 只加不減：起始等級的手感和原本一樣（跳台的翻滾一圈照原本的操控量）
  skK.noise = 1.2 - .6 * q; skK.crouch = 1 + .35 * q;
}
skApply();

// 升級：小數慢慢累積，跨過整數時提示（同一項 6 秒內只提示一次），存檔最多 8 秒一次
const skTip = {}, skSaveT = { t: 0, dirty: false };
function skUp(k, n) {
  const s = skills[crew.cur], was = s[k];
  if (was >= 100 || !(n > 0)) return;
  s[k] = Math.min(100, was + n);
  if (Math.floor(s[k]) > Math.floor(was)) {
    skApply(); skSaveT.dirty = true;
    const now = uTimeNow(), S = SKILLS.find(o => o.k === k);
    if (!(skTip[k] > now - 6)) { skTip[k] = now; toast(`${CREW[crew.cur].name} 的${S.n}提升了 · ${Math.floor(s[k])}`); }
  }
}
// 其他模組的事件：kill(爆頭, 近戰)、hit（子彈打中人）、melee（近戰打中）、near（擦身而過）
function skillEvent(kind, a, b) {
  if (kind === 'kill') { skUp('sho', b ? 0 : a ? .8 : .3); if (b) skUp('str', .5); if (b && !W.stars && player.crouch) skUp('stl', .8); }
  else if (kind === 'hit') skUp('sho', .05);
  else if (kind === 'melee') skUp('str', .2);
  else if (kind === 'near') skUp('drv', .25);
}

// ─── 衝刺體力 ───
const stam = { v: 1, tired: false, acc: { sta: 0, stl: 0, drv: 0, air: 0, lung: 0 } };
function stamStep(dt) {
  const k = sk('sta'), sprint = player.mode === 'walk' && inp.run && player.v > 3 && !player.swim;
  const swimHard = player.swim && inp.run && player.v > 1.5;
  if ((sprint || swimHard) && k < 1) {
    const T = lerp(SK_RUN_T[0], SK_RUN_T[1], k);
    stam.v = Math.max(0, stam.v - dt / T);
    if (stam.v <= 0) stam.tired = true;
  } else stam.v = Math.min(1, stam.v + dt / (stam.tired ? 6 : 3.5));
  if (stam.tired && stam.v > .35) stam.tired = false;
  player.runK = stam.tired ? SK_TIRED_K : 1;
  if (stam.tired && sprint && life.hp > 20 && !godMode.on) life.hp = Math.max(20, life.hp - SK_TIRED_HP * dt);
  // 升級：衝刺 18 秒、游泳 25 秒各 +1
  if (sprint) stam.acc.sta += dt / 18; else if (player.swim && player.v > .5) stam.acc.sta += dt / 25;
  if (player.crouch && player.v > .4) stam.acc.stl += dt / 25;
  const v = player.mode === 'drive' && player.veh;
  if (v && !v.fly && !v.boat && Math.hypot(v.vx, v.vz) > 110 / 3.6) stam.acc.drv += dt / 25;
  if (v && v.air) stam.acc.air += dt / 5;
  if (player.dive) stam.acc.lung += dt / 6;
  for (const [k, sk0] of [['sta', 'sta'], ['stl', 'stl'], ['drv', 'drv'], ['air', 'drv'], ['lung', 'lung']]) if (stam.acc[k] >= 1) { stam.acc[k] -= 1; skUp(sk0, 1); }
}

// ─── 噪音圈：腳步、引擎、槍聲與爆炸（小地圖上的淡藍色圓）。警察與幫派在圈裡就「聽到」 ───
const noise = { r: 0, peak: 0, shotR: NOISE.shot };
function noiseAdd(r) { noise.peak = Math.max(noise.peak, r); }
function noiseStep(dt) {
  let base = 0;
  if (player.where !== 'out' || life.dead) base = 0;
  else if (player.mode === 'drive') { const v = player.veh; base = v.boat || v.fly ? 30 : clamp(8 + Math.hypot(v.vx, v.vz) * .5, 8, 34); }
  else if (player.dive) base = 0;
  else if (player.swim) base = player.v > .3 ? NOISE.swim : 0;
  else if (player.v > .25) base = (player.crouch ? NOISE.crouch : player.v > 3 ? NOISE.run : NOISE.walk) * skK.noise;
  noise.peak = Math.max(0, noise.peak - dt * 45);
  const want = Math.max(base, noise.peak);
  noise.r = want > noise.r ? want : damp(noise.r, want, 3, dt);
  // 圈碰到站著聊天的幫派（69-squads.js 的 calm）：整群醒過來
  if (noise.r > 2 && player.where === 'out') for (const f of SQ.f) if (f.on && f.calm && !f.lurk && Math.hypot(f.x - pX(), f.z - pZ()) < noise.r * .8) wakeGroup(f.grp);
}
function noiseMini(c, P2, zoom) {
  if (noise.r < 1.5) return;
  const [x, y] = P2(pX(), pZ()), r = noise.r * MAP_S;
  c.fillStyle = 'rgba(120,170,255,.16)'; c.strokeStyle = 'rgba(150,195,255,.55)'; c.lineWidth = 1.5 / zoom;
  c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.stroke();
}

// ─── 消音器：手槍、衝鋒槍、步槍、狙擊槍各一支，裝上後槍聲半徑 7 m、槍口火光變小 ───
const silOn = id => motors.gear.sil.includes(id);
const silGeo = {};
function silFit(id) {
  const h = myGun[id]; if (!h) return;
  const ud = h.userData;
  if (!silOn(id)) { if (ud.sil) ud.sil.visible = false; return; }
  if (ud.sil && ud.inner.children.includes(ud.sil)) { ud.sil.visible = true; return; }   // swapGlb 換模型時會清掉 inner
  const A = ARMS[id], m = A.muzzle, L = id === 'pistol' ? .13 : .18;
  ud.sil = new T.Mesh(silGeo[id] ||= new Kit().cyl(m[0], m[1], m[2] + L / 2 - .01, .019, .019, L, 10, 0x1b1c1f, 15, Math.PI / 2).build(), MAT.uber);
  ud.inner.add(ud.sil);
}
function gearRows() {
  const rows = SIL_IDS.map(id => {
    const A = ARMS[id], has = silOn(id);
    return { t: `${A.name}消音器`, sub: has ? '已經裝上 · 槍聲只傳 7 m' : '槍聲半徑 60 m → 7 m，警察與幫派在圈外聽不到', val: has ? '已裝' : money(SIL_PRICE), ok: !has, fn: () => { if (!pay(SIL_PRICE)) return; motors.gear.sil.push(id); saveMotors(); sfx.reload(); phoneMsg(`${A.name}的消音器裝好了。`); } };
  });
  const a = arm.ammo.petrol, full = a.mag >= ARMS.petrol.n;
  rows.push({ t: '汽油桶', sub: `剩 ${a.mag}% · 按住開火倒出一條油線，開槍或爆炸點燃`, val: full ? '已滿' : money(PETROL_PRICE), ok: !full, fn: () => { if (!pay(PETROL_PRICE)) return; a.mag = ARMS.petrol.n; sfx.reload(); phoneMsg('汽油桶裝滿了，在武器轉盤的投擲物格。'); } });
  return rows;
}

// ─── 潛水：游泳時按 Z 下潛、再按一次浮上來；水下警察看不到、子彈打不到，閉氣用完開始扣血 ───
const breath = { v: 1 };
const DIVE_D = 2.4;   // 下潛深度（m，從游泳的高度往下）
function diveToggle() {
  if (!player.swim || player.mode !== 'walk' || life.dead) return false;
  player.dive = !player.dive;
  sfx.splash(player.dive ? .7 : .4);
  if (player.dive) { toast(`下潛 · 水下警察看不到你 · 閉氣 ${Math.round(lerp(SK_BREATH[0], SK_BREATH[1], sk('lung')))} 秒 · 再按 Z 浮上來`); waterSplash(player.x, player.z, .5); }
  return true;
}
function diveStep(dt) {
  if (player.dive && (!player.swim || player.mode !== 'walk' || life.dead)) player.dive = false;
  player.diveK = damp(player.diveK || 0, player.dive ? 1 : 0, 2.2, dt);
  if (player.dive) {
    breath.v = Math.max(0, breath.v - dt / lerp(SK_BREATH[0], SK_BREATH[1], sk('lung')));
    if (breath.v <= 0 && !godMode.on) { life.hp -= SK_DROWN * dt; life.hurtT = 0; if (life.hp <= 0) { life.hp = 0; die('wasted'); } }
    if (Math.random() < dt * 3) emit('smoke', player.x + (Math.random() - .5) * .4, SEA_Y + .02, player.z + (Math.random() - .5) * .4, { vy: .2, max: .6, s0: .05, s1: .12, a: .5, c: [.8, .9, 1] });   // 水面冒泡
  } else breath.v = Math.min(1, breath.v + dt / 3);
  document.body.classList.toggle('dive', (player.diveK || 0) > .5);
}

// ─── 水下打撈：海裡沉著八個走私貨櫃，潛到 3.5 m 內就撈起來（現金、重武器彈藥、防彈衣）；水面會冒泡 ───
const SALV_LOOT = [
  { n: '一箱黑錢', cash: 12000 }, { n: '火箭彈', ammo: ['rpg', 4] }, { n: '一箱黑錢', cash: 8000 }, { n: '榴彈', ammo: ['launcher', 12] },
  { n: '企業走私的金條', cash: 25000 }, { n: '軍用防彈衣', armor: 1 }, { n: '轉管機槍彈鏈', ammo: ['minigun', 500] }, { n: '一箱黑錢', cash: 15000 },
];
const salv = { list: null, bubT: 0 };
function salvInit() {
  const r = rng(7707), list = [];
  // 繞著各個碼頭找水深 4 m 以上、彼此相隔 60 m 的點；找不到就放寬間距、換下一個碼頭，八個一定都放得下
  for (let i = 0; i < SALV_LOOT.length; i++) {
    for (let k = 0; k < 600 && list.length === i; k++) {
      const S = BOAT_SPOTS[(i + Math.floor(k / 150)) % BOAT_SPOTS.length], sep = k < 300 ? 60 : 25;
      const a = r() * 6.283, d = 30 + r() * 170, x = S.x + Math.sin(a) * d, z = S.z + Math.cos(a) * d;
      if (waterDepth(x, z) > 4 && list.every(o => Math.hypot(o.x - x, o.z - z) > sep)) list.push({ i, x, z });
    }
  }
  salv.list = list;
}
function salvStep(dt) {
  if (!salv.list) salvInit();
  if (player.where !== 'out') return;
  const got = motors.gear.salv, px = pX(), pz = pZ();
  salv.bubT -= dt;
  for (const c of salv.list) {
    if (got.includes(c.i)) continue;
    const d = Math.hypot(c.x - px, c.z - pz);
    if (salv.bubT <= 0 && d < 160) for (let j = 0; j < 3; j++) emit('smoke', c.x + (Math.random() - .5) * 1.2, SEA_Y + .02, c.z + (Math.random() - .5) * 1.2, { vy: .15, max: 1.1, s0: .06, s1: .2, a: .55, c: [.75, .85, .95] });
    if (player.dive && player.diveK > .7 && Math.hypot(c.x - player.x, c.z - player.z) < 3.5) salvTake(c);
  }
  if (salv.bubT <= 0) salv.bubT = .5;
}
function salvTake(c) {
  const L = SALV_LOOT[c.i];
  motors.gear.salv.push(c.i);
  if (L.cash) earn(L.cash, `撈起${L.n}`);
  else { if (L.ammo) arm.ammo[L.ammo[0]].res += L.ammo[1]; if (L.armor) life.armor = 100; saveMotors(); toast(`撈起${L.n}（還剩 ${SALV_LOOT.length - motors.gear.salv.length} 個貨櫃）`); }
  sfx.pickup();
}
function salvMini(c, P2) {
  if (!salv.list || !(player.swim || player.mode === 'drive' && player.veh.boat)) return;
  c.strokeStyle = 'rgba(120,230,255,.7)'; c.lineWidth = 1.2;
  for (const o of salv.list) {
    if (motors.gear.salv.includes(o.i) || Math.hypot(o.x - pX(), o.z - pZ()) > 45) continue;   // 聲納：45 m 內才看得到
    const [x, y] = P2(o.x, o.z); c.beginPath(); c.arc(x, y, 3.5, 0, 7); c.stroke();
  }
}

// ─── 每幀（99-main.js 在 gtaUpdate 之後呼叫）：體力、噪音、潛水、打撈、消音器、存檔 ───
function skillsUpdate(dt) {
  stamStep(dt); noiseStep(dt); diveStep(dt); salvStep(dt);
  for (const id of SIL_IDS) silFit(id);
  skSaveT.t -= dt;
  if (skSaveT.dirty && skSaveT.t <= 0) { skSaveT.dirty = false; skSaveT.t = 8; saveMotors(); }
  const sb = $('staBar'), bb = $('brBar');
  sb.style.setProperty('--v', `${(stam.v * 100).toFixed(1)}%`); sb.classList.toggle('on', stam.v < .995 && player.mode === 'walk'); sb.classList.toggle('low', stam.tired);
  bb.style.setProperty('--v', `${(breath.v * 100).toFixed(1)}%`); bb.classList.toggle('on', breath.v < .995); bb.classList.toggle('low', breath.v < .2);
}
// Esc 選單「遊戲 › 角色能力」（95-menu.js）
function skillRows() {
  const s = skills[crew.cur];
  return [
    { n: `${CREW[crew.cur].name} ${CREW[crew.cur].zh}`, info: CREW[crew.cur].role },
    ...SKILLS.map(S => ({ n: S.n, val: `<span class="mnNum"><em>${Math.floor(s[S.k])}</em><b class="mnBar" style="--v:${s[S.k].toFixed(1)}%"></b></span>`, act: () => {}, d: S.d })),
  ];
}
// 測試 API（window.__nc.gta.v3）
Object.assign(gtaApi.v3, { chem: chemApi, skills, skK, sk, skUp, stam, noise, breath, salv, SALV_LOOT, silOn, gearRows, diveToggle, skillRows });
