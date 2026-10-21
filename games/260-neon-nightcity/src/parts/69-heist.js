// ═══ 第四階段：大型搶劫《中央霓虹銀行》 ═══
// 流程（heist.st）：
//   plan  Vance 公寓門口的計畫板付 $10,000 籌備費，選潛行（贓款上限 $2,000,000）或強攻（$2,500,000）
//   setup 前置：偷舊碼頭路邊的黑色鑽機廂型車（上車即 2 星），甩掉警察後開回 Jax 的舊碼頭倉庫（安全屋）
//   go    到 10 St 的中央霓虹銀行門口按 E，換成 Vance 進大廳
//   lobby 大廳：8 名人質，威懾條每秒掉 7%，瞄準時回升、開槍大幅回升；掉到 0 行員按警報（潛行就變強攻）。15 秒後 Jax 裝好 C4
//   c4    按 G 引爆金庫門
//   drill 走到金庫門口按 E 裝鋁熱鑽機：潛行而且沒有警報就留在大廳顧人質 40 秒；
//         強攻（或已經響警報）換成 Jax 到銀行門口，4 星守 60 秒
//   escape 換成背著錢袋的 Vance 從正門出來（強攻 5 星、潛行 2 星），走到 120 m 外的逃亡車；每受 10 點傷害掉 $15,000
//   drive 上逃亡車後換成 Kael 駕駛，甩掉通緝、開進安全屋的黃圈 → HEIST PASSED：扣掉中彈損失與 Zero 10% 抽成後入帳
// 任何階段 WASTED／BUSTED 就失敗，回到 go（籌備與前置保留）。
// 排在 69-gps 之後、69-market 之前；W、wantedApi 等後面的東西只在函式裡用。

ENV.bank = { lampOn: 0, wet: 0, fogDen: .018, fog: 0x1a1612, fogHi: 0x2a2218, top: 0x8a7a62, bot: 0x3a3026 };
const BANK = { x: 0, z: stZ(4) - HR - SW };   // 10 St 南側立面，門朝 +z
const PLAN = { x: CREW[0].home.x, z: CREW[0].home.z };
const SAFE = { x: CREW[2].home.x, z: CREW[2].home.z - SW * .5 - HR + LANE };   // Jax 倉庫門前的車道
const VAN_AT = { x: avX(0) + PARK, z: stZ(1) + 30, yaw: Math.PI };
const CAR_AT = { x: avX(4) + PARK, z: stZ(4) + 30, yaw: Math.PI };
const HEIST_FEE = 10000, TAKE = { smart: 2000000, loud: 2500000 }, ZERO_CUT = .1;
const heist = { st: 'off', how: null, t: 0, intim: 100, alarm: false, take: 0, loss: 0, hpPrev: 0, van: null, car: null, mag: 0, warned: 0, objSmall: '' };

// ─── 銀行大廳（室內場景）：大理石地板、櫃台、金庫圓門、人質 ───
const bankScene = new T.Scene();
const bank = { boxes: [], circles: [], lights: [] };
const VAULT = { x: 0, z: 20 };
let vaultDoor = null;
{
  const k = new Kit(), B = bank.boxes, cream = 0x8e8574, stone = 0x6e6658;
  const wall = (x0, x1, z0, z1, h, col) => { k.box((x0 + x1) / 2, h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0, col, 2); B.push({ x0, x1, z0, z1 }); };
  k.box(0, -.05, 11, 18.4, .1, 22.4, 0xb4ab9a, 10);
  for (let x = -8; x <= 8; x += 2) k.box(x, .003, 11, .04, .006, 22, 0x8a8070, 10);
  k.box(0, 5.25, 11, 18.4, .1, 22.4, 0x2a241c, 2);
  wall(-9.4, -9, 0, 22, 5.2, cream); wall(9, 9.4, 0, 22, 5.2, cream);
  wall(-9.4, -1.6, -.4, 0, 5.2, stone); wall(1.6, 9.4, -.4, 0, 5.2, stone); k.box(0, 4.4, -.2, 3.2, 1.6, .4, stone, 2);
  // 金庫牆與圓門（門另外一個 mesh，炸開時轉開）
  wall(-9.4, -1.7, 20, 20.6, 5.2, 0x4e4a44); wall(1.7, 9.4, 20, 20.6, 5.2, 0x4e4a44); k.box(0, 4.1, 20.3, 3.4, 2.2, .6, 0x4e4a44, 2);
  k.cyl(0, 1.5, 20.32, 1.6, 1.6, .5, 28, 0x3a3c40, 15, Math.PI / 2);
  // 金庫裡：一疊疊現金
  k.box(0, -.05, 22.5, 6, .1, 4, 0x3a3630, 2); wall(-3.4, 3.4, 24.4, 24.8, 5.2, 0x4e4a44); wall(-3.4, -3, 20.6, 24.4, 5.2, 0x4e4a44); wall(3, 3.4, 20.6, 24.4, 5.2, 0x4e4a44);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) k.box(-2 + i * .8, .3 + j * .32, 23.6, .6, .28, .6, 0x5e7a52, 2);
  // 櫃台（玻璃隔板）、柱子、吊燈
  k.box(0, .55, 12.5, 14, 1.1, .8, 0x4a3020, 10).box(0, 1.12, 12.5, 14.2, .06, .9, 0x2a1a10, 10);
  for (let x = -6; x <= 6; x += 3) k.box(x, 1.75, 12.5, 2.8, 1.2, .03, 0x9ab0b4, 1);
  B.push({ x0: -7, x1: 7, z0: 12.1, z1: 12.9 });
  for (const x of [-5.5, 5.5]) for (const z of [4.5, 9]) { k.cyl(x, 2.6, z, .38, .42, 5.2, 16, 0xa89e8a, 10); bank.circles.push({ x, z, r: .45 }); }
  for (const z of [4, 8.5, 16]) { k.cyl(0, 4.7, z, .5, .5, .08, 16, 0xffe2a0, 11); bank.lights.push({ x: 0, y: 4.4, z, col: lin(0xffd8a0), r: 11, i: 1.6 }); }
  bank.lights.push({ x: 0, y: 3, z: 22, col: lin(0xa0ffb0), r: 5, i: .9 }, { x: -7, y: 3.6, z: 18, col: lin(0xffd8a0), r: 7, i: .8 }, { x: 7, y: 3.6, z: 18, col: lin(0xffd8a0), r: 7, i: .8 });
  bankScene.add(new T.Mesh(k.build(), MAT.uber));
  const d = new Kit();
  d.cyl(0, 0, 0, 1.45, 1.45, .45, 28, 0x8a8d92, 15, Math.PI / 2);
  for (let i = 0; i < 6; i++) d.box(Math.cos(i) * .7, Math.sin(i) * .7, -.28, .1, .5, .06, 0xc8a02a, 15, 0, 0, i);
  d.cyl(0, 0, -.3, .3, .3, .12, 16, 0xc8a02a, 15, Math.PI / 2);
  vaultDoor = new T.Group(); const dm = new T.Mesh(d.build(), MAT.uber); dm.position.set(1.45, 0, 0); vaultDoor.add(dm);
  vaultDoor.position.set(-1.45, 1.5, 20.0); bankScene.add(vaultDoor);
  bank.boxes.push({ x0: -1.6, x1: 1.6, z0: 19.6, z1: 20.1, door: 1 });
}
const hostages = crowd(8);
{
  const rc = rng(2024), spots = [[-6, 7], [-3.5, 6], [-1, 8], [2, 6.5], [4.5, 8], [6.5, 6], [-4.5, 10], [3.5, 10.5]];
  spots.forEach(([x, z], k) => { hostages.look(k, { r: rc, glowI: 0 }); hostages.place(k, x, 0, z, Math.PI + (rc() - .5)); hostages.anim(k, ANIM.idle, rc() * 10, 1); bank.circles.push({ x, z, r: .35 }); });
  hostages.flush(); bankScene.add(hostages.mesh);
}
VENUES.bank = { scene: bankScene, data: bank, spawn: { x: 0, z: 1.6, yaw: 0 }, name: '中央霓虹銀行', toast: '中央霓虹銀行', dist: '中城 · 10 St', ceil: 5.2, door: { x: BANK.x, z: BANK.z }, out: { x: BANK.x, z: BANK.z + 1.4, yaw: 0 } };

// ─── 銀行門面：石造門廊、金色門、招牌（Canvas 寫字） ───
{
  const k = new Kit(), z = BANK.z, x = BANK.x;
  k.box(x, 3.2, z + .25, 9, 6.4, .5, 0x6e6658, 2);
  for (const s of [-1, 1]) for (const c of [1.9, 3.7]) k.cyl(x + s * c, 2.3, z + .75, .32, .36, 4.6, 14, 0xa89e8a, 10);
  k.box(x, 4.85, z + .8, 9.2, .5, 1.1, 0x8e8574, 2).box(x, 5.3, z + .7, 9.6, .3, 1.3, 0x5a5448, 2);
  k.box(x, 1.4, z + .52, 2.4, 2.8, .06, 0x2a2016, 10).box(x, 1.4, z + .56, 2.1, 2.5, .03, 0xc8a02a, 15);
  for (const s of [-1, 1]) k.box(x + s * 3, .08, z + 1.3, 1.4, .16, 1.2, 0x5a5448, 2);
  scene.add(new T.Mesh(k.build(), MAT.uber));
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 128;
  const c = cv.getContext('2d'); c.fillStyle = '#1a140c'; c.fillRect(0, 0, 1024, 128);
  c.fillStyle = '#f0d58a'; c.font = '600 58px "Avenir Next Condensed","DIN Condensed","Arial Narrow",system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('CENTRAL NEON BANK · 中央霓虹銀行', 512, 66);
  const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 4;
  const sign = new T.Mesh(new T.PlaneGeometry(8, 1), new T.MeshBasicMaterial({ map: tx, toneMapped: false }));
  sign.position.set(x, 4.85, z + 1.36); scene.add(sign);
  outLights.push({ x, y: 4.2, z: z + 2.4, col: lin(0xffd890), r: 9, i: 1.4 });
}

// ─── 任務目標與 HUD ───
function heistMark() {
  const s = heist.st;
  if (s === 'setup') return heist.van && player.veh === heist.van ? { name: '安全屋', x: SAFE.x, y: 1.5, z: SAFE.z, where: 'out' } : heist.van ? { name: '鑽機廂型車', x: heist.van.x, y: 2.4, z: heist.van.z, where: 'out' } : null;
  if (s === 'go') return { name: '中央霓虹銀行', x: BANK.x, y: 2.6, z: BANK.z + 1, where: 'out' };
  if (s === 'lobby' || s === 'c4') return { name: '金庫', x: VAULT.x, y: 2, z: VAULT.z - .4, where: 'bank' };
  if (s === 'drill') return player.where === 'bank' ? { name: '金庫', x: VAULT.x, y: 2, z: VAULT.z - .4, where: 'bank' } : { name: '銀行門口', x: BANK.x, y: 2.6, z: BANK.z + 2, where: 'out' };
  if (s === 'escape') return heist.car ? { name: '逃亡車', x: heist.car.x, y: 2, z: heist.car.z, where: 'out' } : null;
  if (s === 'drive') return { name: '安全屋', x: SAFE.x, y: 1.5, z: SAFE.z, where: 'out' };
  return null;
}
// 90-hud.js 與 69-gps.js 用這個取代 QUEST[quest.n].mk()
function missionMark() { return heist.st !== 'off' && heist.st !== 'plan' ? heistMark() : QUEST[quest.n].mk(); }
const HEIST_TEXT = {
  setup: () => heist.van && player.veh === heist.van ? '把鑽機廂型車開回舊碼頭倉庫' + (W.stars ? '（先甩掉警察）' : '') : '前置：偷走舊碼頭的鑽機廂型車',
  go: () => '到中央霓虹銀行門口',
  lobby: () => `壓住大廳的人質（瞄準他們）· Jax 正在裝 C4`,
  c4: () => '按 G 引爆金庫門',
  drill: () => player.where === 'bank' ? (heist.t > 0 && heist.drilling ? '鑽機運作中：繼續壓住人質' : '到金庫門口按 E 裝鋁熱鑽機') : '以 Jax 守住銀行門口',
  escape: () => '帶著錢袋走到逃亡車',
  drive: () => W.stars ? '甩掉警察' : '開回舊碼頭倉庫分贓',
};
const narrowHud = matchMedia('(max-width:640px)');
function heistHud() {
  const o = $('obj'), on = heist.st !== 'off' && heist.st !== 'plan';
  o.classList.toggle('heist', on);
  if (!on) return;
  setText('objText', HEIST_TEXT[heist.st]());
  let bar = -1, num = '';
  if (player.where === 'bank' && (heist.st === 'lobby' || heist.st === 'c4' || heist.st === 'drill')) { bar = heist.intim; num = heist.drilling ? `威懾 · 鑽機 ${Math.ceil(heist.t)} 秒` : '威懾'; }
  else if (heist.st === 'drill') { bar = 100 * heist.t / 60; num = `守住 ${Math.ceil(heist.t)} 秒`; }
  else if (heist.st === 'lobby') num = '';
  if (heist.st === 'escape' || heist.st === 'drive') num = `贓款 ${money(heist.take - heist.loss)}`;
  const sub = $('objSub');
  sub.classList.toggle('bar', bar >= 0);
  if (bar >= 0) sub.style.setProperty('--v', clamp(bar, 0, 100).toFixed(1) + '%');
  sub.classList.toggle('low', bar >= 0 && bar < 30 && player.where === 'bank');
  setText('objNum', num);
  // 窄螢幕：任務框不能長高（會壓到現金那一列），計時條貼在框底、數字改寫在上面的小標
  const si = o.querySelector('small i'), sv = '· ' + (narrowHud.matches && num ? num : `中央霓虹銀行${heist.how === 'smart' ? '（潛行）' : '（強攻）'}`);
  if (si && si.textContent !== sv) si.textContent = sv;
}
function heistStage(s, t = 0) {
  heist.st = s; heist.t = t; heist.warned = 0;
  if (s !== 'off' && s !== 'plan') { if (!heist.objSmall) heist.objSmall = $('obj').querySelector('small').innerHTML; $('obj').querySelector('small').innerHTML = `搶劫 <i>· 中央霓虹銀行${heist.how === 'smart' ? '（潛行）' : '（強攻）'}</i>`; }
  else if (heist.objSmall) { $('obj').querySelector('small').innerHTML = heist.objSmall; heist.objSmall = ''; setText('objText', QUEST[quest.n].text); }
  const o = $('obj'); o.classList.remove('flash'); void o.offsetWidth; o.classList.add('flash');
  gps.t = 0;
}

// ─── 計畫板與各階段的互動 ───
ctxHooks.push((p, near) => {
  if (p.where === 'bank') {
    if (heist.st === 'drill' && !heist.drilling && near(VAULT.x, VAULT.z - 1, 1.8)) return { key: 'E', text: '安裝鋁熱鑽機', fn: drillStart };
    return null;
  }
  if (p.mode !== 'walk' || p.where !== 'out') return null;
  if (near(PLAN.x, PLAN.z, 2) && (heist.st === 'off' || heist.st === 'plan')) return { key: 'E', text: '看計畫板 <i>· 中央霓虹銀行</i>', fn: planBoard };
  if (heist.st === 'go' && near(BANK.x, BANK.z + 1, 2)) return { key: 'E', text: '開始搶劫 <i>· 中央霓虹銀行</i>', fn: bankEnter };
  if (heist.st === 'escape' && heist.car && !heist.car.dead && near(heist.car.x, heist.car.z, 3.4)) return { key: 'F', text: '上逃亡車 <i>· 換 Kael 開</i>', fn: getawayEnter };
  return null;
});
function planBoard() {
  const who = 'Vance 的計畫板';
  if (W.stars) return dialog(who, '外面還有警察在找你，先處理掉再來。');
  dialog(who, `中央霓虹銀行，10 St。金庫裡的現金最多兩百五十萬。籌備費 ${money(HEIST_FEE)}，Zero 抽一成。\n潛行：壓住人質不讓警報響，出來只有 2 星，但上限兩百萬。\n強攻：炸門、守門口、5 星突圍，上限兩百五十萬。`, [
    { t: `潛行（${money(HEIST_FEE)}）`, fn: () => planGo('smart') },
    { t: `強攻（${money(HEIST_FEE)}）`, fn: () => planGo('loud') },
    { t: '再想想', fn: closeDialog },
  ]);
}
function planGo(how) {
  closeDialog();
  if (motors.cash < HEIST_FEE) { toast(`籌備費不夠，還差 ${money(HEIST_FEE - motors.cash)}`); return; }
  motors.cash -= HEIST_FEE; saveMotors();
  heist.how = how; heist.alarm = false; heist.loss = 0; heist.take = 0;
  spawnVan(); heistStage('setup');
  toast('前置：鑽機廂型車停在舊碼頭（地圖黃點）');
}
// 換人、進出銀行都走淡出；正在淡出（別的轉場）就稍後再試，期間計時暫停
function heistFade(fn) {
  if (heist.busy) return;
  heist.busy = true;
  const go = () => { if (fading) { setTimeout(go, 80); return; } transition(() => { heist.busy = false; fn(); }); };
  go();
}
function clearSpot(x, z, r) { for (const c of [...parked]) if (Math.hypot(c.x - x, c.z - z) < r) dropVehicle(detachCar(c)); }
function spawnVan() {
  if (heist.van && !heist.van.dead && vehicles.includes(heist.van)) return;
  clearSpot(VAN_AT.x, VAN_AT.z, 7);
  const v = heist.van = buildVeh('shvan', VAN_AT.x, VAN_AT.z, VAN_AT.yaw, 0, .37, 4, 'heist');   // PAL[3] 黑色
  v.name = '鑽機廂型車'; v.y = groundH(v.x, v.z); heist.vanHot = false; poseVehicle(v);
}
function bankEnter() {
  if (W.stars) { toast('通緝中進不去：先甩掉警察'); return; }
  heistFade(() => {
    const s = crew.st[0]; s.x = BANK.x; s.z = BANK.z + 1.4; s.yaw = 0;
    crewLoad(0);
    setWhere('bank');
    const sp = VENUES.bank.spawn; player.x = sp.x; player.z = sp.z; player.yaw = sp.yaw; camState.yaw = sp.yaw; camState.pitch = .12;
    arm.ammo.pistol.mag = ARMS.pistol.mag; equip('pistol', true);
    heist.intim = 100; heist.mag = arm.ammo.pistol.mag; vaultDoor.rotation.y = 0; vaultDoor.userData.open = 0;
    const b = bank.boxes.find(o => o.door); b.x0 = -1.6; b.x1 = 1.6;
    heistStage('lobby', 15);
    toast('所有人趴下！');
  });
}
function blowVault() {
  heistStage('drill');
  vaultDoor.userData.open = 1;
  const b = bank.boxes.find(o => o.door); b.x0 = b.x1 = -99;
  sfx.boom(4); camState.shake = 1; life.flash = .6;
  if (heist.how === 'loud') heist.alarm = true;
  toast('金庫門炸開了');
}
function drillStart() {
  sfx.reload();
  if (heist.alarm) { holdStart(); return; }
  heist.t = 40; heist.drilling = true; toast('鑽機開始運作：40 秒內別讓人質按警報');
}
// 強攻或響了警報：換成 Jax 到門口守 60 秒（4 星）
function holdStart() {
  heist.drilling = true; heist.t = 60;
  heistFade(() => {
    const s = crew.st[2]; s.x = BANK.x + 2.5; s.z = BANK.z + 3; s.yaw = 0;
    crewLoad(2);
    heistGear(); equip('rifle', true);
    heist.t = 60; heistStage('drill', 60);
    wantedApi.set(4);
    toast('警察包圍銀行了：Jax 守住門口 60 秒');
  });
}
function heistGear() { for (const id of ARM_IDS) { const A = ARMS[id], a = arm.ammo[id]; if (A.gun) { a.mag = A.mag; a.res = A.res; } else if (A.throw) a.mag = A.n; } life.armor = 100; }
// 錢裝好了：換成背錢袋的 Vance 從正門出來
function escapeStart() {
  heistFade(() => {
    heist.drilling = false; heist.take = TAKE[heist.how];
    const s = crew.st[0]; s.x = BANK.x - 1.5; s.z = BANK.z + 1.6; s.yaw = 0;
    crewLoad(0); heistGear(); equip('smg', true);
    clearSpot(CAR_AT.x, CAR_AT.z, 7);
    const v = heist.car = buildVeh('tiara', CAR_AT.x, CAR_AT.z, CAR_AT.yaw, 0, .61, 2, 'heist');
    v.name = '逃亡車 · Tiara GT'; v.vmax = 47; v.eng = 13; v.hp = 2400; v.y = groundH(v.x, v.z); poseVehicle(v);
    heistStage('escape');
    heist.hpPrev = life.hp + life.armor;
    wantedApi.set(heist.alarm ? 5 : 2);
    toast(`贓款 ${money(heist.take)}：走到逃亡車（每受 10 點傷害掉 $15,000）`);
  });
}
function getawayEnter() {
  const v = heist.car;
  heistFade(() => {
    const s = crew.st[1]; s.x = v.x; s.z = v.z; s.yaw = v.yaw;
    crewLoad(1); enterVehicle(v);
    heistStage('drive');
    toast('Kael 開車：甩掉警察，回舊碼頭倉庫');
  });
}
function heistFail(why) {
  heist.busy = false;
  if (heist.car) { if (player.veh !== heist.car && vehicles.includes(heist.car)) dropVehicle(heist.car); heist.car = null; }
  heist.drilling = false;
  heistStage('go');
  toast(`搶劫失敗（${why}）：回銀行門口再來一次`);
}
function heistPass() {
  const take = heist.take, loss = Math.min(heist.loss, take), cut = Math.round((take - loss) * ZERO_CUT), net = take - loss - cut;
  heistStage('off');
  if (heist.car) { exitVehicle(); heist.car = null; }
  motors.cash += net; saveMotors();
  $('hpRows').innerHTML = [['總搶奪金額', money(take)], ['中彈耗損扣除', '−' + money(loss)], ['駭客 Zero 分紅（10%）', '−' + money(cut)], ['最終實得淨利', money(net)], ['三位主角各得', money(Math.floor(net / 3))]].map(([a, b], i) => `<dt${i === 3 ? ' class="net"' : ''}>${a}</dt><dd${i === 3 ? ' class="net"' : ''}>${b}</dd>`).join('');
  $('heistDone').classList.add('on'); heist.doneT = 7; sfx.ability(true);
}

// 99-main.js 的 onKey：G 引爆金庫門
function heistKey(code) {
  if ($('heistDone').classList.contains('on')) { if (heist.doneT < 6) { $('heistDone').classList.remove('on'); } return true; }
  if (code === 'KeyG' && heist.st === 'c4' && player.where === 'bank') { blowVault(); return true; }
  return false;
}
$('heistDone').addEventListener('click', () => $('heistDone').classList.remove('on'));

function heistUpdate(dt) {
  if (heist.doneT > 0 && (heist.doneT -= slowmo.raw) <= 0) $('heistDone').classList.remove('on');
  if (vaultDoor.userData.open && vaultDoor.rotation.y > -1.9) vaultDoor.rotation.y -= dt * 1.4;
  const s = heist.st;
  if (s === 'off' || s === 'plan' || heist.busy) return heistHud();
  if (life.dead && s !== 'setup') { heistFail(life.dead === 'busted' ? '被捕' : '陣亡'); return heistHud(); }
  if (s === 'setup') {
    const v = heist.van;
    if (!v || v.dead) { toast('鑽機廂型車毀了，換一台'); spawnVan(); }
    else if (player.veh === v) {
      if (!heist.vanHot) { heist.vanHot = true; wantedApi.set(2); toast('有人報警了：甩掉 2 星，再開回倉庫'); }
      if (Math.hypot(v.x - SAFE.x, v.z - SAFE.z) < 7) {
        if (W.stars) { if (!heist.warned) { heist.warned = 1; toast('先甩掉警察，別把他們帶回倉庫'); } }
        else if (Math.hypot(v.vx, v.vz) < 3) { exitVehicle(); dropVehicle(v); heist.van = null; heistStage('go'); toast('鑽機到手：去中央霓虹銀行'); }
      }
    }
  }
  // 大廳：威懾條（瞄準時回升、開槍大幅回升），人質依威懾程度趴下或站起來
  if (player.where === 'bank' && (s === 'lobby' || s === 'c4' || s === 'drill')) {
    const a = arm.ammo[arm.sel], mag = a ? a.mag : 0;
    if (a && mag < heist.mag && ARMS[arm.sel].gun) heist.intim += 35;
    heist.mag = mag;
    heist.intim = clamp(heist.intim + (gta.aiming ? 28 : -7) * dt, 0, 100);
    if (heist.intim <= 0 && !heist.alarm) { heist.alarm = true; sfx.busted(); toast('有行員按下了桌底警報'); if (s === 'drill' && heist.drilling) holdStart(); }
    hostages.people.forEach((p, k) => hostages.anim(k, heist.intim > 40 || k % 3 ? ANIM.kneel : ANIM.idle, k * 1.3, 1));
  }
  if (s === 'lobby' && (heist.t -= dt) <= 0) { heistStage('c4'); toast('Jax：C4 裝好了，按 G'); }
  if (s === 'drill' && heist.drilling && (heist.t -= dt) <= 0) escapeStart();
  if (s === 'escape') {
    const hp = life.hp + life.armor;
    if (hp < heist.hpPrev) heist.loss += (heist.hpPrev - hp) * 1500;
    heist.hpPrev = hp;
    if (heist.car && heist.car.dead) { heist.car = null; heistFail('逃亡車毀了'); }
  }
  if (s === 'drive') {
    const v = player.veh;
    if (player.mode !== 'drive' || !v) { /* 下車了：再上任何一台車都行 */ }
    else if (Math.hypot(v.x - SAFE.x, v.z - SAFE.z) < 8) {
      if (W.stars) { if (!heist.warned) { heist.warned = 1; toast('先甩掉警察，別把他們帶回倉庫'); } }
      else if (Math.hypot(v.vx, v.vz) < 4) heistPass();
    } else heist.warned = 0;
  }
  heistHud();
}

// 測試 API（window.__nc.gta.heist）
const heistApi = { heist, BANK, PLAN, SAFE, VAN_AT, CAR_AT, go: planGo, stage: heistStage, enter: bankEnter, blow: blowVault, drill: drillStart, escape: escapeStart, getaway: getawayEnter, pass: heistPass };
