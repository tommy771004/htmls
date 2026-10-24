// ═══ 第六部曲：大型改裝車廠的機制（使用者提供的 neon_nightcity_gta_v_neon_mega_customs.md）═══
// 廠房、13 大改裝與改裝面板在 66-chrome.js；這裡是規格書第二、三、六、七節的機制：
//   進廠規則（第二節第 1 點）：沒通緝照常進；通緝中被警察看到捲門鎖死、強尼大吼；脫離視線（星星閃爍）可以躲進來，噴漆或換牌就消星。
//            坦克、直升機、船進不來；街上偷來、市價超過 $100,000 的超跑「太燙手」，除非你買下車廠又裝了黑市晶片抹除儀。
//   拔槍關店（第二節第 3 點）：在店裡拿槍瞄準或開槍：改裝鎖死、「修車廠已暫時關閉」；一半機率店員報警逃走（1 星），一半機率強尼拿霰彈槍、
//            兩個學徒拿管鉗圍上來。小地圖的改裝廠加上紅色鎖頭，捲門拉下，你離開 300 m 以上累計 120 秒才重新營業。
//            店裡的氧氣乙炔鋼瓶被打中會連環爆炸（同樣算暴力事件）。
//   歪軸（第三節）：撞得夠猛（一幀內速度掉 9 m/s 以上）有 35% 機率撞歪一側輪軸（裝甲減少 75%），車子往那邊偏；修車才會好。
//   保險（第六節第 1 點）：投保全額險（車價 10%）的座駕燒毀後，打給磐石互保（或按 V／叫鐵手強尼送車）只付車價 1.5% 的自付額；
//            沒保險的不會永久報銷（座駕只有一台），改成付車價 12%（至少 $2,500）的原廠重建費。
//   炸彈（第六節第 2 點）：點火炸彈：停好車走遠（15 m 以上 8 秒），一個偷車賊會走過去開車門，發動的瞬間嗶嗶嗶 0.5 秒後整台車炸掉；
//            你自己上車不會炸。遙控炸彈：手機 → 鐵手強尼 → 引爆車載炸彈。炸完炸彈就用掉了。
//   液壓（第六節第 3 點）：開著裝了液壓的車按一下 X 升到最高或降到貼地，按住 X 放開彈跳 1.2 m，按住 X 加 W／A／S／D 單輪起伏（慢速時）。
//            X 原本是特殊能力：開著液壓車時改用 Caps Lock。
//   銷贓（第七節第 1 點）：偷來的車開進工位 4：回收價 = 市價 10% × 車況（至少 20%），之後要等 15 分鐘（真實時間）才能再賣下一台；
//            黑板上每天（遊戲裡一天 = 真實一小時）三款出口車單，完好（耐久 90% 以上）交車 ×2.5 而且不算冷卻。警車、救護車、運鈔車不收。
//   收購與委託（第七節第 2 點）：門口的待售告示牌或手機的天際置業 $350,000 買下；老闆 Kael 自己開進來，修車與改裝全部免費。
//            買下後每 6–9 分鐘強尼會傳訊息：工位 1 頂高機上有客戶的車，照右上角的清單改好、開到客戶家（黃色 GPS）。
//            基本報酬 $25,000，完美駕駛紅利 $10,000 每擦撞一次扣 $1,500。
// 存檔在 motors.v6（nc260.motors 第 11 版）：sellT 下次能賣街車的時間、exp 今天的出口車單、wipe 黑市晶片抹除儀。
// 排在 69-v5-tower 之後、70 之前：頂層不能用 keys、camState 等 99 才宣告的東西（函式裡可以）。

const V6 = { closeT: 0, fight: null, mag: -1, aimT: 0, bait: null, fuse: null, park: 0, hyd: { t: -1, hi: 0, y: 0, p: 0, r: 0 }, prevThr: 0, prevGear: 1, prevSp: 0, smokeT: 0, jobT: 300 + Math.random() * 120, job: null, blast: [] };
const V6_CLOSE_T = 120, V6_CLOSE_R = 300, HOT_PRICE = 100000, SELL_CD = 15 * 60 * 1000, EXPORT_K = 2.5, EXPORT_HP = .9;
const SHOP_PRICE = 350000, WIPE_PRICE = 150000, TRACKER = 2000, INS_DED = .015, REBUILD = .12, REBUILD_MIN = 2500;
const JOB_BASE = 25000, JOB_PERFECT = 10000, JOB_SCRAPE = 1500, AXLE_DV = 9, AXLE_P = .35;
// 街上車流的市價（黑市回收價是 10%）；null 是不收的（警車、救護車、運鈔車、坦克）
const TYPE_VALUE = {
  fh_taxi: 18000, canyon_taxi: 18000, e34: 22000, evo190: 26000, negotiator: 30000, milano: 65000, kiri: 38000, carter: 45000, compact: 16000, urban: 28000, tiara: 85000,
  shvan: 26000, lct: 34000, conquer: 30000, fvan: 22000, fh: 40000, il: 42000, grc_sedan: 14000, grc_stepvan: 24000, grc_mailvan: 22000,
  fh_cop: null, il_cop: null, urban_cop: null, ambulance: null, md84: null, tank: null,
};
const EXPORT_POOL = Object.keys(TYPE_VALUE).filter(k => TYPE_VALUE[k]);
{ const el = document.createElement('div'); el.id = 'v6job'; el.setAttribute('aria-live', 'polite'); $('hud').append(el); }   // 客戶委託的清單與交車獎金（右上角）
const JOB_DEST = ['villa', 'i14', 'l16', 'loft'];
const JOB_WHO = ['冠石的對沖基金經理', '雲杉坡的唱片製作人', '公園大道的整形名醫', '光環區的加密幣新貴', '琥珀和室的老派收藏家'];
motors.v6 ||= {};
{ const v = motors.v6; v.sellT = +v.sellT || 0; v.wipe = v.wipe ? 1 : 0; if (!v.exp || !Array.isArray(v.exp.list)) v.exp = null; }

// ─── 共用 ───
const v6Owned = () => estOwned('chrome');
const v6Free = () => v6Owned() && CREW[crew.cur].id === 'kael';   // 老闆 Kael 本人：修車與改裝全免
function v6Value(v) {
  if (v.carId && CARS[v.carId] && v !== kestrel) return CARS[v.carId].price || 50000;
  if (v.type) return TYPE_VALUE[v.type] === undefined ? 25000 : TYPE_VALUE[v.type];
  return 25000;
}
const v6Hot = v => v !== kestrel && (v6Value(v) || 0) > HOT_PRICE && !(v6Owned() && motors.v6.wipe);
// 進不去的原因（空字串是可以進）：69-v5-shops.js 的捲門也問這裡
function v6DoorBlock(v) {
  if (V6.closeT > 0) return 'CHROME WORKS 暫時歇業中（先前的暴力事件）';
  if (v.fly || v.boat || (v.type && TYPES[v.type] && TYPES[v.type].tank)) return '此工位無法容納重型軍用裝甲或飛行載具！';
  if (W.stars > 0 && W.seen) return '無法在警方目擊下進入改裝車廠！';
  if (heist.enf && v === heist.enf) return '';   // 69-heist2.js 強攻前置 B 的鎮暴裝甲車：門口改裝
  if (v6Hot(v)) return '強尼：「老兄，這台頂級超跑太燙手了，全城都在追蹤它的晶片，我不敢碰！」';
  if (v !== kestrel && v.type && TYPE_VALUE[v.type] === null) return 'Rook：「警車、救護車跟運鈔車？我這裡不收，開走。」';
  return '';
}
// 66-chrome.js 的 chromeCtx（車停在門口 6 m 內、慢下來時）
function v6EnterCheck(v) {
  const why = v6DoorBlock(v);
  if (why) return { key: 'E', text: `${W.stars > 0 && W.seen ? '捲門鎖死' : '進不去'} <i>· ${why.replace(/^[^：]*：/, '').slice(0, 22)}</i>`, fn: () => { toast(why); if (W.stars > 0 && W.seen) toast('強尼：「喂！別把 NCPD 條子引到我店裡來！先甩開他們再說！」'); } };
  if (v === kestrel) return { key: 'E', text: W.stars ? '躲進 CHROME WORKS <i>· 噴漆或換牌甩掉通緝</i>' : '開進 CHROME WORKS <i>· 改裝與調校</i>', fn: () => chromeEnter(v) };
  return { key: 'E', text: `開進 CHROME WORKS 工位 4 <i>· 銷贓、追蹤器、噴漆</i>`, fn: () => chromeEnter(v) };
}
// 強尼的開場白：依車況（第二節第 2 點）
function v6GreetText(v) {
  const k = v.hpMax ? v.hp / v.hpMax : 1;
  if (k < .4) return '「天啊，她這次又是哪裡出毛病了？你是剛開著她穿過戰區嗎？這得花上不少功夫。」';
  if (k < .85) return '「看來路上不太平靜啊，要先幫你把鈑金敲平嗎？」';
  return '「全夜之城最頂尖的技工今天能為您效勞什麼？」';
}
function v6Greet() {
  toast('強尼：' + v6GreetText(kestrel));
  if (W.stars) toast(W.seen ? '警察還盯著你' : '捲門放下了：噴漆或換牌就能甩掉通緝');
  else if (!motors.mods[kestrel.carId]) toast('走到車旁按 E 打開改裝面板');
}

// ─── 工位 4：偷來的車（銷贓、追蹤器、噴漆換牌、修車） ───
function v6StolenIn(v) {
  const S = chrome.stolen = { v, val: v6Value(v) };
  v.vx = v.vz = 0; v.g.visible = false; v.x = v.z = 9999; poseVehicle(v);
  let m;
  if (v.carId && CARS[v.carId]) m = carObject(v.carId, v.paint);
  else { const src = v.body.children[0]; m = new T.InstancedMesh(src.geometry, v.mat, 1); m.setMatrixAt(0, new T.Matrix4()); m.computeBoundingSphere(); }
  m.position.set(BAY4.x, .05, BAY4.z); m.rotation.y = BAY4.yaw; chromeScene.add(m); S.show = m;
  const L0 = chromeLv[0]; S.circ = [-1, 1].map(s => ({ x: BAY4.x + s * (v.len || 4.6) * .28, z: BAY4.z, r: (v.w || 1.9) / 2 + .1, car: 1 }));
  L0.circles.push(...S.circ);
  chromeLevel(0); chromeShow();
  enterVenue('chrome', () => { player.x = BAY4.x - 3.2; player.z = BAY4.z - 2.2; player.yaw = 0; toast('Rook：「好貨。開到秤上，我看看值多少。」'); v6BoardSync(); });
}
function v6StolenClear() {
  const S = chrome.stolen; if (!S) return;
  if (S.show) { S.show.removeFromParent(); if (S.show.isGroup) disposeKit(S.show); }
  const L = chromeLv[0].circles; for (const c of S.circ || []) { const i = L.indexOf(c); if (i >= 0) L.splice(i, 1); }
  if (player.where === 'chrome') colDirty();
}
function v6StolenOut() {
  const S = chrome.stolen; v6StolenClear(); chrome.stolen = null;
  if (!S || S.gone) return;
  const v = S.v, p = chromePad();
  v.x = p.x; v.z = p.z; v.yaw = p.yaw + Math.PI; v.vx = v.vz = v.yr = 0; v.y = groundH(v.x, v.z); v.g.visible = true;
  rollClear(v); poseVehicle(v);
}
// 賣掉或登記之後，那台車從街上消失：路邊機車回到原位（換一台新的），車流車收掉，其他（停車場的 P1）藏起來
function v6StolenGone() {
  const S = chrome.stolen, v = S.v;
  S.gone = true; v6StolenClear(); chrome.stolen = null;
  if (v === hanzo) { const p = spotW(HANZO_SPOT); wreckFix(hanzo); hanzo.x = p.x; hanzo.z = p.z; hanzo.yaw = p.yaw; hanzo.vx = hanzo.vz = 0; hanzo.y = groundH(p.x, p.z); hanzo.g.visible = true; poseVehicle(hanzo); }
  else if (jacked.includes(v)) dropVehicle(v);
  else { v.g.visible = false; v.dead = 1; }
}
// 今天的出口車單（遊戲裡一天 = 真實一小時）
function v6Exp() {
  const d = Math.floor(Date.now() / 3600000), E = motors.v6.exp;
  if (E && E.d === d) return E;
  const r = rng(d * 7919 + 13), pool = EXPORT_POOL.slice(), list = [];
  while (list.length < 3) list.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  motors.v6.exp = { d, list, done: [] }; saveMotors();
  return motors.v6.exp;
}
function v6BoardSync() { const E = v6Exp(); boardDraw(E.list, E.done); }
function v6SellQuote(v) {
  const E = v6Exp(), hp = v.hpMax ? clamp(v.hp / v.hpMax, 0, 1) : 1, exp = !!v.type && E.list.includes(v.type) && !E.done.includes(v.type);
  const base = (v6Value(v) || 0) * .1, pay = Math.round(base * Math.max(.2, hp) * (exp && hp >= EXPORT_HP ? EXPORT_K : 1) / 10) * 10;
  return { pay, exp, ok: exp && hp >= EXPORT_HP, hp };
}
function v6Sell() {
  const S = chrome.stolen; if (!S) return closeDialog();
  const v = S.v, Q = v6SellQuote(v), wait = motors.v6.sellT - Date.now();
  if (!Q.ok && wait > 0) { dialog('Rook · 工位 4', `「上一台的車籍還在洗。${Math.ceil(wait / 60000)} 分鐘後再來，或者開一台黑板上的車來。」`, [{ t: '好', fn: closeDialog }]); return; }
  closeDialog();
  if (Q.ok) { motors.v6.exp.done.push(v.type); v6BoardSync(); }
  else motors.v6.sellT = Date.now() + SELL_CD;
  const name = v.name;
  v6StolenGone();
  earn(Q.pay, Q.ok ? `【每日懸賞車單達成】已交付 ${name}` : `已將 ${name} 拆解銷贓`);
  sfx.reload();
}
// 衛星追蹤器：只有車行目錄裡的實車（路邊的機車、停車場的 P1）能登記到你名下，送進 GARAGE 07
function v6Track() {
  const S = chrome.stolen, v = S && S.v, id = v && v.carId;
  closeDialog();
  if (!id || !CARS[id] || !CARS[id].glb) { toast('Rook：「車流的車晶片洗不成你的名字，只能拆了賣。」'); return; }
  if (motors.owned.includes(id)) { toast(`你車庫裡已經有一台 ${CARS[id].name}`); return; }
  if (motors.cash < TRACKER) { toast(`錢不夠：衛星追蹤器要 ${money(TRACKER)}`); return; }
  motors.cash -= TRACKER; motors.owned.push(id); if (v.paint != null) motors.paint[id] = v.paint; saveMotors();
  v6StolenGone(); rebuildGarage && rebuildGarage(); v6PrivBuild();
  sfx.pickup(); toast(`已登記為你的私人載具：${CARS[id].name}（停進 GARAGE 07 與樓上的私人車庫）`);
}
function v6StolenTalk() {
  const S = chrome.stolen, v = S.v, Q = v6SellQuote(v), E = v6Exp(), wait = motors.v6.sellT - Date.now();
  const opts = [{ t: `出售載具（${money(Q.pay)}${Q.ok ? ' · 出口懸賞 ×2.5' : ''}）`, fn: v6Sell }];
  if (v.carId && CARS[v.carId] && CARS[v.carId].glb) opts.push({ t: `安裝衛星追蹤器（${money(TRACKER)}）`, fn: v6Track });
  if (W.stars) opts.push({ t: `噴漆換牌、甩掉通緝（${money(RESPRAY)}）`, fn: () => { closeDialog(); if (W.seen) return toast('警察還盯著這台車'); if (motors.cash < RESPRAY) return toast('錢不夠噴漆'); motors.cash -= RESPRAY; saveMotors(); wantedClear('respray'); W.lastVeh = null; sfx.spray(); toast('已完成全新烤漆，NCPD 通緝星數已全數消除！'); } });
  if (needFix(v)) opts.push({ t: `修車（${money(repairCost(v, v.carId || STARTER))}）`, fn: () => { closeDialog(); const c = repairCost(v, v.carId || STARTER); if (motors.cash < c) return toast('錢不夠修車'); motors.cash -= c; saveMotors(); wreckFix(v); v.axle = 0; v.axleYr = 0; sfx.reload(); toast('修好了'); } });
  opts.push({ t: '先不要', fn: closeDialog });
  const exp = Q.exp ? (Q.ok ? '黑板上的車，完好交車拿 2.5 倍。' : `黑板上的車，可惜車況只剩 ${Math.round(Q.hp * 100)}%，懸賞要完好的。`) : `今天黑板上要的是：${E.list.map(n => TYPE_NAME[n] || n).join('、')}。`;
  dialog('Rook · 工位 4 黑市拆解', `「${v.name}，市價大概 ${money(S.val)}。我出一成，照車況打折。」\n${exp}${!Q.ok && wait > 0 ? `\n上一台還在洗車籍：${Math.ceil(wait / 60000)} 分鐘後才能再賣街車。` : ''}`, opts);
}

// ─── 拔槍關店（第二節第 3 點）與鋼瓶爆炸 ───
const V6_CYL = [{ x: -7.4, z: 2.6, on: 1 }, { x: 7.6, z: 10.8, on: 1 }];
function v6ShopStep(dt) {
  const F = V6.fight;
  // 開槍：看彈匣少了一發；拿槍瞄準店員或開槍就是暴力事件
  const A = arm.ammo[arm.sel], gun = ARMS[arm.sel].gun, mag = gun && A ? A.mag : -1;
  const fired = V6.mag >= 0 && mag >= 0 && mag < V6.mag; V6.mag = mag;
  if (fired) {
    const R = aimRay();
    for (const c of V6_CYL) if (c.on && rayHitsCyl(R, c.x, c.z, 0, 1.6, .45)) v6Cylinder(c);
    if (F) for (const s of chrome.staff) if (s.st !== 'down' && s.st !== 'gone' && rayHitsCyl(R, s.x, s.z, 0, 1.9, .45)) { s.hp -= ARMS[arm.sel].dmg || 30; if (s.hp <= 0) v6StaffDown(s); }
  }
  V6.aimT = gta.aiming && gun && VENUES.chrome.lv === 0 ? V6.aimT + dt : 0;
  if (!F && (fired || V6.aimT > .35)) v6Violence();
  if (V6.fight) v6FightStep(dt);
  for (const b of V6.blast) { b.t -= dt; b.L.i = Math.max(0, b.t) * 6; }
  V6.blast = V6.blast.filter(b => { if (b.t > 0) return true; const L = chromeLv[0].lights, i = L.indexOf(b.L); if (i >= 0) L.splice(i, 1); return false; });
}
function v6Violence() {
  if (V6.fight) return;
  cwClose(); closeDialog();
  V6.closeT = V6_CLOSE_T; V6.fight = { mode: Math.random() < .5 ? 'flee' : 'fight', alarm: false };
  toast('修車廠已暫時關閉 (Neon Customs Closed)');
  for (const s of chrome.staff) { s.st = V6.fight.mode === 'flee' ? 'flee' : s.i === 0 ? 'draw' : 'melee'; s.t = 0; s.hp = s.i === 0 ? 120 : 80; }
  if (V6.fight.mode === 'flee') { toast('店員丟下板手往後面跑，邊跑邊報警'); addHeat(CRIME.aim, 1); V6.fight.alarm = true; }
  else toast('強尼從工作檯底下抽出一把泵動式霰彈槍，兩個學徒抄起管鉗！');
}
function v6StaffDown(s) {
  s.st = 'down'; chrome.people.anim(s.i, ANIM.die, -uTimeNow(), 1);
  addHeat(CRIME.assault); sfx.hurt();
}
function v6FightStep(dt) {
  const P = chrome.people, F = V6.fight;
  for (const s of chrome.staff) {
    if (s.st === 'down' || s.st === 'gone') continue;
    s.t += dt;
    const dx = player.x - s.x, dz = player.z - s.z, d = Math.hypot(dx, dz) || 1, up = VENUES.chrome.lv === 0 && !life.dead;
    if (s.st === 'flee') {   // 跑到後面的工具牆，消失（從後門出去報警）
      const tx = -1.4, tz = CD - 1.6, ex = tx - s.x, ez = tz - s.z, e = Math.hypot(ex, ez);
      if (e < .6) { s.st = 'gone'; P.place(s.i, 0, -60, 0, 0); continue; }
      const r = collideCircle(s.x + ex / e * 4.6 * dt, s.z + ez / e * 4.6 * dt, .3, false); s.x = r.x; s.z = r.z; s.yaw = Math.atan2(ex, ez);
      P.anim(s.i, ANIM.run, s.t, 1); P.place(s.i, s.x, 0, s.z, s.yaw); continue;
    }
    s.yaw = Math.atan2(dx, dz);
    if (s.st === 'draw') { P.anim(s.i, ANIM.aimIdle, s.t, 1); if (s.t > 1.2) { s.st = 'shoot'; s.shotT = .5; } }
    else if (s.st === 'shoot') {
      P.anim(s.i, ANIM.aimIdle, s.t, 1);
      if (up && (s.shotT -= dt) <= 0 && d < 30) { s.shotT = 1.3; sfx.shot(); hurtPlayer(16, dx / d, dz / d); if (!F.alarm) { F.alarm = true; addHeat(CRIME.shots, 1); } }
    } else if (s.st === 'melee') {
      if (d > 1.2 && up) { const r = collideCircle(s.x + dx / d * 3.4 * dt, s.z + dz / d * 3.4 * dt, .3, false); s.x = r.x; s.z = r.z; P.anim(s.i, ANIM.run, s.t, 1); }
      else { P.anim(s.i, ANIM.swing, s.t, 1); if (up && (s.hitT = (s.hitT || 0) - dt) <= 0) { s.hitT = .9; hurtPlayer(9, dx / d, dz / d); sfx.punch(); } }
    }
    P.place(s.i, s.x, 0, s.z, s.yaw);
  }
}
// 店員回到崗位（重新營業時）
function v6StaffReset() {
  V6.fight = null;
  const P = chrome.people;
  for (const s of chrome.staff) { Object.assign(s, { x: s.x0, z: s.z0, yaw: s.yaw0, st: 'work', hp: 80, t: 0 }); P.anim(s.i, s.a, Math.random() * 9, 1); P.place(s.i, s.x, 0, s.z, s.yaw); }
}
// 氧氣乙炔鋼瓶：打中就炸（5 m 內扣血、店員倒下），0.6 秒後另一組跟著炸（連環）
function v6Cylinder(c) {
  if (!c.on) return;
  c.on = 0;
  sfx.boom(0); camState.shake = Math.max(camState.shake, 1);
  const L = { x: c.x, y: 1.2, z: c.z, col: lin(0xff8a30), r: 14, i: 6, keep: 1 }; chromeLv[0].lights.push(L); V6.blast.push({ L, t: 1 });
  const d = Math.hypot(player.x - c.x, player.z - c.z);
  if (d < 5 && VENUES.chrome.lv === 0) hurtPlayer(70 * (1 - d / 5) + 10, (player.x - c.x) / (d || 1), (player.z - c.z) / (d || 1));
  for (const s of chrome.staff) if (s.st !== 'down' && s.st !== 'gone' && Math.hypot(s.x - c.x, s.z - c.z) < 5) v6StaffDown(s);
  if (!V6.fight) v6Violence();
  addHeat(CRIME.blast);
  for (const o of V6_CYL) if (o.on) setTimeout(() => { if (player.where === 'chrome') v6Cylinder(o); }, 600);
}
// 歇業倒數：玩家離開 300 m 以上才算（第二節第 3 點）
function v6CloseStep(dt) {
  if (V6.closeT <= 0) return;
  const [gx, gz] = toW(GAR_X, GAR_Z);
  if (player.where !== 'chrome' && Math.hypot(pX() - gx, pZ() - gz) > V6_CLOSE_R) V6.closeT -= dt;
  if (V6.closeT <= 0) { V6.closeT = 0; v6StaffReset(); for (const c of V6_CYL) c.on = 1; toast('CHROME WORKS 重新營業了'); }
}

// ─── 保險與送車（99-main.js 的 summonCar、69-phone.js 的鐵手強尼都問這裡） ───
const v6Insured = id => !!modsOf(id).ins;
const v6Deduct = id => Math.round((CARS[id].price || 50000) * INS_DED / 10) * 10;
const v6Rebuild = id => Math.max(REBUILD_MIN, Math.round((CARS[id].price || 50000) * REBUILD / 10) * 10);
// 燒毀的座駕送修：有保險付自付額，沒保險付原廠重建費；回傳 false 是錢不夠
function v6Claim() {
  if (!kestrel.dead) return true;
  const id = kestrel.carId, ins = v6Insured(id), n = ins ? v6Deduct(id) : v6Rebuild(id);
  if (motors.cash < n) { toast(`${ins ? '磐石互保自付額' : '原廠重建費'} ${money(n)}，錢不夠`); return false; }
  motors.cash -= n; saveMotors();
  toast(ins ? `【磐石互保】已扣除自付額 ${money(n)}，您的改裝愛車已全新修復並送達附近街道！` : `${kestrel.name} 沒保險：原廠重建費 ${money(n)}`);
  return true;
}
function v6WreckMsg(v) {
  if (v6Insured(v.carId)) return `您的私人載具已損毀，請撥打磐石互保申請理賠（自付額 ${money(v6Deduct(v.carId))}）。`;
  return `${v.name} 燒毀了 · 沒保險，按 V 送修要付原廠重建費 ${money(v6Rebuild(v.carId))}`;
}

// ─── 炸彈 ───
function v6BombStep(dt) {
  const v = kestrel, b = v.bomb;
  if (V6.fuse) { V6.fuse.t -= dt; if (V6.fuse.t <= 0) { const f = V6.fuse; V6.fuse = null; v6BombGo(f.v, '點火引爆炸彈'); } return; }
  // 點火炸彈的誘餌：車停在戶外、你沒坐在裡面、走開 15 m 以上 8 秒，就有偷車賊上鉤
  const parkedOut = b === 1 && !v.dead && player.where === 'out' && v.g.visible && v.x < 9000 && !motors.stowed && player.veh !== v;
  V6.park = parkedOut && Math.hypot(pX() - v.x, pZ() - v.z) > 15 ? V6.park + dt : 0;
  if (V6.bait && (!V6.bait.on || V6.bait.bait !== v)) V6.bait = null;
  if (!parkedOut && V6.bait) { const f = V6.bait; f.bait = null; fFree(f); V6.bait = null; }
  if (parkedOut && !V6.bait && V6.park > 8) {
    const a = Math.random() * Math.PI * 2, f = fSpawn('thief', v.x + Math.sin(a) * 26, v.z + Math.cos(a) * 26, a + Math.PI);
    if (f) { f.bait = v; V6.bait = f; }
  }
}
// 偷車賊（69-squads.js 的 fStep 交給這裡）：走到車門邊、上車、發動 → 嗶嗶嗶
function v6BaitStep(f, dt) {
  const v = f.bait, p = fighters.people[f.k];
  if (!v || v.dead) { f.bait = null; fFree(f); return; }
  const d = Math.hypot(v.x - f.x, v.z - f.z);
  if (d < 2.2) { fFree(f); V6.bait = null; V6.fuse = { v, t: .5 }; sfx.doorCar(true); sfx.bombBeep(); return; }
  const nav = fNav(f, v.x, v.z, dt), tx = nav ? nav[0] : v.x, tz = nav ? nav[1] : v.z, dx = tx - f.x, dz = tz - f.z, dn = Math.hypot(dx, dz) || 1;
  const r = collideCircle(f.x + dx / dn * 2.2 * dt, f.z + dz / dn * 2.2 * dt, .32, false); f.x = r.x; f.z = r.z;
  f.yaw = Math.atan2(dx, dz); p.aimK = 0;
  fighters.anim(f.k, ANIM.walk, f.ph += dt, 1); fighters.place(f.k, f.x, fGround(f), f.z, f.yaw);
}
function v6BombGo(v, what) {
  const id = v.carId, m = { ...modsOf(id) }; delete m.bomb;
  if (Object.keys(m).length) motors.mods[id] = m; else delete motors.mods[id];
  v.bomb = 0; saveMotors();
  v.byP = uTimeNow(); explode(v);
  toast(`${what}引爆了`);
}
function v6Detonate() {
  const v = kestrel;
  if (v.bomb !== 2 || v.dead || motors.stowed || v.x > 9000) { phoneMsg('強尼：車上沒有遙控炸彈，或車不在街上。'); return; }
  phoneMsg('強尼：……嗶。'); sfx.bombBeep(); setTimeout(() => v6BombGo(v, '手機遙控炸彈'), 500);
}

// ─── 液壓（X）與改裝喇叭（H）：69-combat.js 的 gtaKey 最先問 ───
function v6Key(code) {
  const v = player.mode === 'drive' ? player.veh : null;
  if (!v || v !== kestrel) return false;
  if (code === 'KeyX' && v.hydra && !v.air && !v.tumble && !v.flipped) { V6.hyd.t = uTimeNow(); V6.hyd.dance = false; return true; }
  if (code === 'KeyH' && v.hornT) { sfx.hornT(v.hornT); return true; }
  return false;
}
// 讀輸入之後（99-main.js 的 step）：按住 X 而且慢速時，W／A／S／D 改成單輪起伏，不開車
function v6Input(inp) {
  const v = player.mode === 'drive' ? player.veh : null, H = V6.hyd;
  if (!v || v !== kestrel || !v.hydra || H.t < 0) return;
  if (!keys.KeyX) {   // 放開：短按切換高低，長按彈跳
    const held = uTimeNow() - H.t; H.t = -1;
    if (H.dance) return;
    if (held < .28) { H.hi = H.hi ? 0 : 1; sfx.hiss(.8); toast(H.hi ? '液壓：升到最高' : '液壓：降到貼地'); }
    else if (!v.air) { const vy = Math.sqrt(2 * 9.8 * 1.2); v.air = { vy, t: 0, x0: v.x, z0: v.z, h: v.y, yaw0: v.yaw, qual: false, r: { broken: false }, rr: 0, pr: 0, rolls: 0, flips: 0 }; v.y += .05; sfx.hiss(1.2); sfx.impact(4); }
    return;
  }
  if (Math.hypot(v.vx, v.vz) < 3 && (inp.thr || inp.brk || inp.steer)) {
    H.dance = true;
    H.p = (inp.thr ? -.09 : 0) + (inp.brk ? .09 : 0); H.r = inp.steer * .08;
    inp.thr = inp.brk = 0; inp.steer = 0;
  }
}
function v6HydStep(dt) {
  const v = kestrel, H = V6.hyd;
  if (!v.hydra) { v.hydY = v.hydP = v.hydR = 0; H.hi = 0; return; }
  const dancing = H.t >= 0 && H.dance;
  if (!dancing) { H.p = damp(H.p, 0, 6, dt); H.r = damp(H.r, 0, 6, dt); }
  v.hydY = damp(v.hydY || 0, H.hi ? .22 : -.08, 10, dt); v.hydP = damp(v.hydP || 0, H.p, 12, dt); v.hydR = damp(v.hydR || 0, H.r, 12, dt);
}

// ─── 開車時的改裝效果：排氣聲、回火、洩壓閥、燒胎彩煙、歪軸 ───
function v6DriveStep(dt) {
  const v = player.mode === 'drive' ? player.veh : null;
  sfx.exhaust(v === kestrel ? modsOf(v.carId).exh || 0 : 0);
  if (!v || v !== kestrel || player.where !== 'out') { V6.prevSp = 0; return; }
  const thr = inp.thr || 0, sp = Math.hypot(v.vx, v.vz), fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  // 放油門或換檔：回火（排氣管越兇機率越高）與洩壓閥
  const lift = V6.prevThr > .5 && thr < .1 && v.rpm > .55, shift = typeof v.gear === 'number' && v.gear > V6.prevGear && thr > .5;
  if ((lift || shift) && v.popK && Math.random() < v.popK * (shift ? .6 : 1)) v6Backfire(v);
  if (lift && v.turbo) sfx.bov();
  V6.prevThr = thr; V6.prevGear = typeof v.gear === 'number' ? v.gear : 1;
  // 燒胎煙：甩尾或原地燒胎時從後輪冒出（顏色是改裝的燒胎煙）
  if (v.isCar && v.slip > 3.5 && sp > 2 && (V6.smokeT -= dt) <= 0) {
    V6.smokeT = .045;
    const c = v.smokeC || SMOKE_COL[0];
    for (const s of [-1, 1]) emit('smoke', v.x - fx * v.len * .32 - fz * s * v.w * .4, .25, v.z - fz * v.len * .32 + fx * s * v.w * .4, { vx: (Math.random() - .5) * .8 - v.vx * .2, vy: .5 + Math.random() * .4, vz: (Math.random() - .5) * .8 - v.vz * .2, max: 1.4 + Math.random() * .6, s0: .3, s1: 1.8, drag: 1.2, a: .42, c });
  }
  // 歪軸：一幀裡速度掉 9 m/s 以上（重撞）
  const drop = V6.prevSp - sp; V6.prevSp = sp;
  if (drop > AXLE_DV && !v.air && !v.dead && (v.axle || 0) < 2 && Math.random() < AXLE_P * (modsOf(v.carId).arm ? .25 : 1)) {
    v.axle = (v.axle || 0) + 1; v.axleYr = (Math.random() < .5 ? -1 : 1) * .16 * v.axle;
    toast(`撞歪了一側輪軸（${v.axle}/2）· 車子往一邊偏，到 CHROME WORKS 修`);
  }
}
function v6Backfire(v) {
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), bx = v.x - fx * (v.len / 2 + .15), bz = v.z - fz * (v.len / 2 + .15);
  for (const s of [-1, 1]) emit('flash', bx - fz * s * .3, .32, bz + fx * s * .3, { vx: -fx * 3, vz: -fz * 3, max: .14, s0: .35, s1: .7, c: [.6, .9, 2.6] });
  fxLights.push({ x: bx, y: .5, z: bz, col: lin(0x6aa0ff), r: 7, i: 3, life: 0, max: .12 });
  sfx.pop(.6 + v.popK * .5);
  chemIgnite(bx, bz, .9);   // 69-v3-chem.js：點著地上的汽油
}
// 改裝廠裡放開油門（66-chrome.js 的 cwCam）
function v6RevRelease(m) {
  const pk = fxOf(m, 'exh', 'pop', 0);
  if (pk && Math.random() < pk + .15) sfx.pop(.5 + pk * .5);
  if (m.tur) sfx.bov();
}
// 防撞鏟（66-chrome.js 的保險桿 2、3 級）：正面撞到別台車，把對方往上鏟 3.5 m/s；尖刺鏟順便扎破對方的前輪
function v6Plow(A, B) {
  if (!A || !B || A !== kestrel || !A.plow || !B.isCar || B === A || B.tumble || B.flipped || (B.mass || 1600) > 3000) return;
  const sp = Math.hypot(A.vx, A.vz); if (sp < 4) return;
  const dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz) || 1;
  if ((dx * Math.sin(A.yaw) + dz * Math.cos(A.yaw)) / d < .75 || uTimeNow() - (B.plowT || -9) < 1.5) return;
  B.plowT = uTimeNow();
  rollStart(B, 3.5, (Math.random() - .5) * 2.4, -1.6);
  if (A.plow >= 2) { for (const t of tireList(B)) if (t.front) { t.hp = 0; t.flat = 1; } tireApply(B); }
  sparks(B.x, .5, B.z, 16, 5); sfx.impact(12);
}

// ─── 燈：座駕的底盤霓虹、門頂的旋轉警示燈（99-main.js 的 pickLights 戶外呼叫） ───
function v6Lights(t) {
  const out = [], v = kestrel;
  if (v.neon && v.g.visible && !v.dead && v.x < 9000 && Math.hypot(v.x - camera.position.x, v.z - camera.position.z) < 90) {
    const k = v.neonBeat ? .45 + .55 * Math.abs(Math.sin(sfx.beat() * Math.PI)) : 1;
    out.push({ x: v.x, y: v.y + .22, z: v.z, col: v.neon, r: 4.6, i: 2.4 * k });
  }
  const S = SHOP.shutter;
  if (S && S.spin) { const [x, z] = toW(GAR_X + 4.7, GAR_Z + .4), a = S.spin; out.push({ x, y: 3.9, z, col: lin(0xffa020), r: 9, i: 2.4, dir: [Math.sin(a), -.25, Math.cos(a)], cos: .7 }); }
  return out;
}

// ─── 收購車廠（門口的待售告示牌）與黑市晶片抹除儀 ───
{
  const k = new Kit(), x = GAR_X - 6.4, z = GAR_Z + SW - .6;
  k.box(x, .9, z, .08, 1.8, .08, 0x2a2c30, 15).box(x, 1.55, z + .06, 1.2, .8, .04, 0xf2efe6, 2).box(x, 1.88, z + .085, 1.2, .14, .01, 0xb3121a, 2).box(x, 1.4, z + .085, .9, .06, .01, 0x2a2c30, 2).box(x, 1.25, z + .085, .7, .05, .01, 0x2a2c30, 2);
  V6.sign = new T.Mesh(k.build(), MAT.uber); cityAdd(V6.sign, zoneAtL(x, z));
  V6.signAt = { x, z: z + .8 };
}
function v6BuyShop() {
  if (v6Owned()) return;
  dialog('天際置業 · 待售', `CHROME WORKS 霓虹改車王總廠，連同工位、零件與 2 樓私人車庫，一口價 ${money(SHOP_PRICE)}。\n買下之後：保險箱每遊戲小時入帳、老闆 Kael 修車改裝全免、強尼會接客戶的委託改裝。`, [
    { t: motors.cash >= SHOP_PRICE ? `買下（${money(SHOP_PRICE)}）` : `錢不夠（還差 ${money(SHOP_PRICE - motors.cash)}）`, fn: () => { closeDialog(); if (estBuy('chrome')) { sfx.pickup(); toast('CHROME WORKS 現在是你的了'); } } },
    { t: '再說', fn: closeDialog },
  ]);
}
function v6Office() {
  const own = v6Owned(), safe = Math.floor(motors.props.safe.chrome || 0), opts = [];
  if (!own) { opts.push({ t: `買下這間車廠（${money(SHOP_PRICE)}）`, fn: v6BuyShop }); }
  else {
    if (safe >= 1) opts.push({ t: `收保險箱（${money(safe)}）`, fn: () => { closeDialog(); estCollect('chrome'); } });
    if (!motors.v6.wipe) opts.push({ t: `買黑市晶片抹除儀（${money(WIPE_PRICE)}）· 收超跑贓車`, fn: () => { closeDialog(); if (motors.cash < WIPE_PRICE) return toast('錢不夠'); motors.cash -= WIPE_PRICE; motors.v6.wipe = 1; saveMotors(); sfx.pickup(); toast('黑市晶片抹除儀裝好了：再燙手的超跑也收'); } });
  }
  opts.push({ t: '離開', fn: closeDialog });
  dialog('CHROME WORKS · 老闆辦公室', own ? `你的車廠。${CREW[crew.cur].id === 'kael' ? 'Kael 開進來修車改裝全免。' : '只有 Kael 本人開進來才免費。'}\n保險箱 ${money(safe)} · 黑市晶片抹除儀 ${motors.v6.wipe ? '已安裝' : '沒有'}${V6.job ? ' · 有一台客戶的車在工位 1' : ''}` : '老闆不在。桌上壓著一份天際置業的待售合約。', opts);
}

// ─── 2 樓私人展示車庫：你名下的車（現在開的那台除外），挑一台就開到樓下的馬力機上 ───
function v6PrivBuild() {
  for (const o of chrome.priv) { o.m.removeFromParent(); disposeKit(o.m); }
  chrome.priv.length = 0;
  const L1 = chromeLv[1]; L1.circles.length = L1.baseN ??= L1.circles.length;
  const ids = motors.owned.filter(id => id !== kestrel.carId || motors.stowed).slice(0, PRIV.length);
  ids.forEach((id, i) => {
    const P = PRIV[i], m = carObject(id, motors.paint[id], 1 + (modsOf(id).pf || 0)); m.position.set(P.x, MEZ_Y, P.z); m.rotation.y = P.yaw; chromeScene.add(m);
    const g = !CARS[id].bike && modParts(id, modsOf(id)); if (g) m.add(g);
    chrome.priv.push({ id, m, ...P });
    for (const s of [-1, 1]) L1.circles.push({ x: P.x, z: P.z + s * CARS[id].len * .28, r: CARS[id].w / 2 + .1, car: 1 });
  });
  if (player.where === 'chrome') colDirty();
}
function v6PrivTake(id) {
  if (chrome.stolen) return toast('先處理工位 4 的那台車');
  if (motors.test) return toast('先把試駕車還回去');
  motors.cur = id; motors.stowed = false; saveMotors();
  if (kestrel.dead) wreckFix(kestrel);
  applyCar(kestrel, id, motors.paint[id]);
  kestrel.vx = kestrel.vz = 0; kestrel.g.visible = false; kestrel.x = kestrel.z = 9999; poseVehicle(kestrel);
  chrome.parked = true; chromeShow(); v6PrivBuild(); rebuildGarage && rebuildGarage();
  sfx.pickup(); toast(`強尼把 ${CARS[id].name} 開到樓下的馬力機上了`);
}
// 2 樓的互動（66-chrome.js 的 ctxHooks）
function v6Upstairs(p, near) {
  for (const o of chrome.priv) if (near(o.x + Math.sin(o.yaw) * 3.1, o.z + Math.cos(o.yaw) * 3.1, 1.6)) return { key: 'E', text: `開這台 <i>· ${CARS[o.id].name}</i>`, fn: () => v6PrivTake(o.id) };
  if (near(-13, 28.3, 1.8)) return { key: 'E', text: '老闆辦公桌', fn: v6Office };
  if (p.x > -7.4 && p.x < -1.6 && p.z > CD - 2.6) return { key: 'E', text: '玩街機 <i>· $1</i>', fn: () => { if (motors.cash < 1) return; motors.cash -= 1; saveMotors(); sfx.zap(); toast(`《霓虹極速 II》得分 ${(Math.random() * 90000 + 10000 | 0).toLocaleString('en-US')}${Math.random() < .15 ? ' · 新紀錄！' : ''}`); } };
  return null;
}
// 1 樓的其他互動：工位 1 的委託車、工位 4、黑板、馬力機電腦
function v6Downstairs(p, near) {
  if (V6.job && V6.job.st === 'wait' && near(BAY1.x + 2.6, BAY1.z, 2.4)) return { key: 'E', text: `改裝客戶的車 <i>· ${CARS[V6.job.id].name}</i>`, fn: () => cwOpen(v6JobTarget()) };
  if (chrome.stolen && near(BAY4.x - 1.2, BAY4.z - 2, 2.2)) return { key: 'E', text: `跟 Rook 談這台車 <i>· ${chrome.stolen.v.name}</i>`, fn: v6StolenTalk };
  if (near(16.6, BAY4.z + 1.4, 2)) return { key: 'E', text: '看出口懸賞車單', fn: () => { const E = v6Exp(); dialog('工位 4 · 今日出口車單', E.list.map((n, i) => `${i + 1}. ${TYPE_NAME[n] || n}${E.done.includes(n) ? '（已交）' : ''}`).join('\n') + '\n完好（耐久 90% 以上）開進來交車 ×2.5，不算冷卻。明天（真實一小時後）換一張。', [{ t: '好', fn: closeDialog }]); } };
  if (near(ROOK.x - 1.4, ROOK.z, 1.6)) return { key: 'E', text: '跟 Rook 說話', fn: () => dialog('Rook · 工位 4 黑市拆解', '「街上搶來的車開進來，我照市價一成收，車況差的打折。一台洗完車籍要十五分鐘，黑板上的車例外。頂級超跑太燙手，除非老闆裝了晶片抹除儀。」', [{ t: '好', fn: closeDialog }]) };
  if (chrome.parked && near(3.6, 2.4, 1.4)) return { key: 'E', text: '馬力機測試', fn: v6Dyno };
  return null;
}
function v6Dyno() {
  const id = kestrel.carId, S = modStats(id), r = CARS[id].real;
  sfx.engineOn(kestrel); chrome.rev = 1;
  setTimeout(() => { sfx.engineOff(); chrome.rev = 0; }, 2400);
  toast(r ? `馬力機：${Math.round(S.ps)} PS（原廠 ${r.ps} PS）· 換檔 ${S.shift.toFixed(2)} 秒 · 極速 ${Math.round(S.kmh)} km/h` : '馬力機：這台沒有原廠資料');
}
// 強尼的對話選項（66-chrome.js 的 talkJohnny）
function v6JohnnyOpts() {
  const o = [];
  if (V6.job && V6.job.st === 'wait') o.push({ t: '客戶的車要怎麼改？', fn: () => dialog(WHO_CW, `「${V6.job.who}的 ${CARS[V6.job.id].name}，在工位 1。單子在這：${v6JobText().replace(/\n/g, '、')}。改好開去他家，路上別刮到。」`, [{ t: '好', fn: closeDialog }]) });
  if (!v6Owned()) o.push({ t: '這間店賣不賣？', fn: () => dialog(WHO_CW, `「老闆想退休了，門口有天際置業的牌子，${money(SHOP_PRICE)}。你要是買下來，Kael 開進來我一毛都不收。」`, [{ t: '好', fn: closeDialog }]) });
  return o;
}

// ─── 客戶委託改裝與外送（第七節第 2 點） ───
const JOB_OPTS = [['eng', 1, 4], ['pf', 1, 4], ['spl', 1, 2], ['sus', 1, 4], ['ng', 1, 5], ['tur', 1, 1], ['brk', 1, 3], ['exh', 1, 3], ['hl', 1, 2]];
function v6JobOffer() {
  const pool = CAR_ORDER.filter(id => CARS[id] && CARS[id].glb && !CARS[id].bike && CARS[id].paintable && !motors.owned.includes(id));
  if (!pool.length) return;
  const id = pool[Math.floor(Math.random() * pool.length)], opts = JOB_OPTS.slice(), req = [{ k: 'fix' }], P = PAINTS(id);
  req.push({ k: 'pc', n: P[1 + Math.floor(Math.random() * (P.length - 1))][0] });
  for (let i = 0; i < 2; i++) { const [k, a, b] = opts.splice(Math.floor(Math.random() * opts.length), 1)[0]; req.push({ k, n: a + Math.floor(Math.random() * (b - a + 1)) }); }
  const dest = JOB_DEST[Math.floor(Math.random() * JOB_DEST.length)], d = APT_DOORS[dest];
  const hpMax = CARS[id].hp || 1200;
  V6.job = { st: 'wait', id, paint: CARS[id].paint ?? null, m: {}, req, who: JOB_WHO[Math.floor(Math.random() * JOB_WHO.length)], dest: WP(d.x + 1.8, d.z + SW + 3.6), t: 600,
    car: { job: true, isCar: true, hp: hpMax * .55, hpMax, glass: 1, axle: 1, tires: [], carId: id } };
  v6JobShow();
  phone.msg = ''; toast('強尼：「老闆，有位富豪把他的車留在一號頂高機了，照他的單子改好送過去吧！」');
}
// 工位 1 的頂高機：有委託時降下來，擺客戶的車（照目前改到的樣子）
function v6JobShow() {
  if (chrome.jobShow) { chrome.jobShow.removeFromParent(); disposeKit(chrome.jobShow); chrome.jobShow = null; }
  const J = V6.job, waiting = J && J.st === 'wait';
  chrome.liftCar.visible = !waiting;
  chrome.lift1.position.y = waiting ? .02 : 1.6;
  if (!waiting) return;
  const g = chrome.jobShow = carObject(J.id, J.paint, 1 + (J.m.pf || 0)); g.position.set(BAY1.x, .07 + fxOf(J.m, 'sus', 'rideY', 0), BAY1.z); g.rotation.y = BAY1.yaw; chromeScene.add(g);
  const pg = modParts(J.id, J.m); if (pg) g.add(pg);
}
function v6JobTarget() {
  const J = V6.job;
  return { id: J.id, job: J, m: J.m, paint: J.paint, hp: J.car, setM(m) { J.m = m; this.m = m; }, setPaint(c) { J.paint = c; this.paint = c; }, apply() { v6JobShow(); } };
}
const v6ReqOk = (J, r) => r.k === 'fix' ? !needFix(J.car) : r.k === 'pc' ? J.paint === r.n : (J.m[r.k] || 0) === r.n;
function v6ReqName(J, r) {
  if (r.k === 'fix') return '修復車損';
  if (r.k === 'pc') return `烤漆：${(PAINTS(J.id).find(o => o[0] === r.n) || [0, '指定色'])[1]}`;
  return `${GRP[r.k].name}：${GRP[r.k].lv[r.n][0]}`;
}
function v6JobText() { const J = V6.job; return J ? J.req.map(r => (v6ReqOk(J, r) ? '✓ ' : '・') + v6ReqName(J, r)).join('\n') : ''; }
function v6JobHud() {
  const el = $('v6job'), J = V6.job;
  const on = !!J && (J.st === 'drive' || (J.st === 'wait' && player.where === 'chrome'));
  el.classList.toggle('on', on);
  if (!on) return;
  const html = J.st === 'wait' ? `<b>客戶委託 · ${CARS[J.id].name}</b>` + J.req.map(r => `<div class="${v6ReqOk(J, r) ? 'ok' : ''}">${v6ReqOk(J, r) ? '✓' : '・'} ${v6ReqName(J, r)}</div>`).join('')
    : `<b>交車 · ${J.who}</b><div>基本報酬 ${money(JOB_BASE)}</div><div>交車品質獎金 ${money(J.bonus)}${J.scrapes ? `（擦撞 ${J.scrapes} 次）` : ''}</div>`;
  if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; }
}
// 66-chrome.js 的「完成改裝、交車」：清單都做到了，車開到門口，開始外送
function v6JobDone() {
  const J = V6.job; if (!J || J.st !== 'wait') return;
  const miss = J.req.filter(r => !v6ReqOk(J, r));
  if (miss.length) { toast(`還沒照單子改完：${miss.map(r => v6ReqName(J, r)).join('、')}`); return; }
  if (side.act) { toast(`${side.act.name}還沒結束`); return; }
  J.st = 'drive'; J.bonus = JOB_PERFECT; J.scrapes = 0;
  const v = mkVehicle('cust'); vehicles.push(v);
  v.custom = { m: J.m }; applyCar(v, J.id, J.paint);
  v.name = `${CARS[J.id].name}（客戶的車）`; J.v = v; J.hp0 = null;
  v6JobShow();
  if (chrome.parked) { chrome.parked = false; const p = chromePad(); kestrel.g.visible = true; placeCarAt({ x: p.x - Math.cos(p.yaw) * 4, z: p.z + Math.sin(p.yaw) * 4, yaw: p.yaw + Math.PI }); }   // 你的車停到旁邊
  exitVenue(() => {
    chromeLevel(0); chromeShow();
    const p = chromePad(); v.x = p.x; v.z = p.z; v.yaw = p.yaw + Math.PI; v.vx = v.vz = 0; v.y = groundH(v.x, v.z); poseVehicle(v);
    enterVehicle(v); camState.yaw = v.yaw;
    gpsSet(J.dest.x, J.dest.z);
    sideStart(v6JobAct(J));
    toast(`把 ${CARS[J.id].name} 開到${J.who}家 · 路上每擦撞一次扣 ${money(JOB_SCRAPE)}`);
  });
}
function v6JobAct(J) {
  return {
    kind: 'cust', name: '客戶委託外送', label: '<b>客戶委託</b> 交車',
    step(dt) {
      const v = J.v;
      if (!v || v.dead) return this.fail('客戶的車毀了');
      J.hp0 ??= v.hp;
      if (J.hp0 - v.hp >= 6) { J.scrapes++; J.bonus = Math.max(0, J.bonus - JOB_SCRAPE); toast(`擦撞！交車品質獎金 −${money(JOB_SCRAPE)}`); }
      J.hp0 = v.hp;
      if (player.veh !== v && Math.hypot(pX() - v.x, pZ() - v.z) > 60) return this.fail('把客戶的車丟在路上');
      if (Math.hypot(v.x - J.dest.x, v.z - J.dest.z) < 9 && Math.hypot(v.vx, v.vz) < 2) {
        const pay = JOB_BASE + J.bonus;
        if (player.veh === v) exitVehicle();
        sideEnd(); v6JobDrop();
        earn(pay, `客戶委託交車${J.bonus === JOB_PERFECT ? '（完美車手紅利）' : ''}`);
        sideDone('交車完成', `${J.who}很滿意`, [['基本報酬', money(JOB_BASE)], ['交車品質獎金', money(J.bonus)], ['擦撞', `${J.scrapes} 次`], ['合計', money(pay)]], 3);
      }
    },
    hud() { return { text: `把 ${CARS[J.id].name} 開到${J.who}家`, bar: -1, num: money(J.bonus) }; },
    mark() { return { name: J.who, x: J.dest.x, y: 2.2, z: J.dest.z, where: 'out' }; },
    fail(why) { toast(`委託失敗：${why}`); sideEnd(); v6JobDrop(); },
    clear() { gpsClear(); },
  };
}
function v6JobDrop() {
  const J = V6.job; V6.job = null; v6JobHud();
  const v = J && J.v; if (!v) return;
  if (player.veh === v) exitVehicle();
  const i = vehicles.indexOf(v); if (i >= 0) vehicles.splice(i, 1);
  v.g.removeFromParent(); disposeKit(v.g);
}
function v6JobStep(dt) {
  if (V6.job) {
    if (V6.job.st === 'wait' && player.where !== 'chrome' && (V6.job.t -= dt) <= 0) { V6.job = null; v6JobShow(); toast('強尼：「客戶等不及，把車開走了。」'); }
    return;
  }
  if (!v6Owned() || player.where !== 'out' || W.stars || side.act) return;
  if ((V6.jobT -= dt) <= 0) { V6.jobT = 360 + Math.random() * 180; v6JobOffer(); }
}

// ─── 小地圖：改裝廠歇業時的紅色鎖頭、委託的目的地（90-hud.js 呼叫） ───
function v6Mini(ctx, P2, zoom) {
  if (V6.closeT > 0) {
    const [x, y] = P2(...toW(GAR_X, GAR_Z + 4)), s = 1 / zoom;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = '#ff3a2a'; ctx.fillRect(-5, -1, 10, 8); ctx.strokeStyle = '#ff3a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -1, 3.4, Math.PI, 0); ctx.stroke();
    ctx.restore();
  }
}

// ─── 每幀（99-main.js 的 step） ───
function v6Update(dt) {
  v6CloseStep(dt);
  v6BombStep(dt);
  v6HydStep(dt);
  v6DriveStep(dt);
  v6JobStep(dt);
  v6JobHud();
}
// 戶外走路的互動：走進改裝廠、門口的待售告示牌
ctxHooks.push((p, near) => {
  if (p.where !== 'out' || p.mode !== 'walk') return null;
  if (!v6Owned() && near(V6.signAt.x, V6.signAt.z, 1.6)) return { key: 'E', text: `天際置業待售告示牌 <i>· ${money(SHOP_PRICE)}</i>`, fn: v6BuyShop };
  if (near(GAR_X, GAR_Z + 1.2, 2)) return V6.closeT > 0 ? { key: 'E', text: 'CHROME WORKS <i>· 暫時歇業</i>', fn: () => toast('捲門拉下來了，門上貼著「暫時歇業」') } : { key: 'E', text: '走進 CHROME WORKS', fn: chromeWalkIn };
  return null;
});
chromeLevel(0); v6PrivBuild(); v6BoardSync();
// 測試 API（window.__nc.gta.v6）
gtaApi.v6 = {
  V6, CATS, GRP, MOD_FX, TYPE_VALUE, CYL: V6_CYL, JOB_OPTS,
  doorBlock: v => v6DoorBlock(v), value: v => v6Value(v), hot: v => v6Hot(v), quote: v => v6SellQuote(v), exp: () => v6Exp(), sell: v6Sell, track: v6Track,
  // 驗收用：直接把最近的一台路邊車（type 指定車型）變成搶來的車並坐進去
  steal(type) { const L = parked.filter(c => !type || c.type === type), c = L.reduce((b, o) => !b || Math.hypot(o.x - pX(), o.z - pZ()) < Math.hypot(b.x - pX(), b.z - pZ()) ? o : b, null); if (!c) return null; if (player.mode === 'drive') exitVehicle(); const v = detachCar(c); enterVehicle(v); return v; },
  violence: v6Violence, cylinder: i => v6Cylinder(V6_CYL[i]), reopen: () => { V6.closeT = 0; v6StaffReset(); for (const c of V6_CYL) c.on = 1; },
  claim: v6Claim, insured: id => v6Insured(id), deduct: id => v6Deduct(id), rebuild: id => v6Rebuild(id),
  detonate: v6Detonate, bait: () => V6.bait, park: t => { V6.park = t; },
  hydra: { key: () => v6Key('KeyX'), tap: () => { V6.hyd.t = uTimeNow(); V6.hyd.dance = false; }, hop: () => { V6.hyd.t = uTimeNow() - 1; }, st: V6.hyd },
  plow: (A, B) => v6Plow(A, B), axle: () => kestrel.axle || 0,
  job: () => V6.job, offer: v6JobOffer, openJob: () => cwOpen(v6JobTarget()), jobTarget: () => v6JobTarget(), jobDone: v6JobDone, jobText: v6JobText, reqOk: () => V6.job && V6.job.req.every(r => v6ReqOk(V6.job, r)),
  priv: () => chrome.priv.map(o => o.id), take: v6PrivTake, office: v6Office, buy: v6BuyShop, free: v6Free, owned: v6Owned,
  stairs: up => chromeStairs(up), level: k => chromeLevel(k), walkIn: chromeWalkIn, lights: () => v6Lights(0),
};
