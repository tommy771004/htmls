// ═══ 主線終章「一起跳」（plans/260-story.md）：F-1 牌桌、F-2 天台、F-3 抉擇、F-4A 交帳／F-4B 直播，片尾與結局後的世界 ═══
// F-1 用 69-v7-casino.js 的整套金庫搶劫：casNew／casGo 建好 CAS.h（不扣準備費、不開自己的 side.act），每幀在這裡推 casHeistStep，
// 任務框與地圖目標借 casAct(H) 的 hud／mark；casHeistEnd 回報 storyEv('casino')，得手的錢照原本的算（主線只發獎牌加成）。
// F-2 雙人跳：冠石頂層公寓門口外、樓頂的高度起跳（69-v3-crash.js 的 air3 'fall'），每幀把水平速度修到落進樓旁的泳池（這裡建的模型）；
// airLand 落地扣血在 storyTicks 之前，所以離池面 3 m 內就先接手（濺水、不扣血）。戴恩用 a.npc 的身體（y、anim 覆寫）跟著跳。
// F-3 對白選擇：S.flags.route 決定下一關（m.next），F-4A／F-4B 是同一個位置的兩條路（m.route），做完都接 'end'。
// F-4A 護送：開車把帳本送到灰鷺角機場，69-squads.js 的幫派追殺與 3 星警察一路攔。
// F-4B 直播：霓峰塔（69-v5-tower.js）202 m 的屋頂步行面守 3 分鐘，六星（69-police.js 的 W.six）：只有直升機上得來（storyHeliY 讓它飛在屋頂以上）。
// 片尾：字幕（#stCred）在玩家還能動的時候跑完；結局後的世界（storyEnding）每次走完都照最後一次選的設定：A 消星、報案慢一點，B 名氣滿格、通緝海報、報案快一點。
// 排在 69-w4-ch5.js 之後、70-render.js 之前：post、camState、keys 只能在函式裡用。

// ─── 地點 ───
const ST_ALLEY = () => ({ ...VENUES.bar.out, yaw: VENUES.bar.out.yaw || 0 });   // AFTERGLOW 後巷（賭場搶劫的交貨點）
const ST_LOFT = () => APT.loft && APT.loft.doorW ? { ...APT.loft.doorW, yaw: 0 } : ST_CROWN();   // 冠石頂層公寓的大樓門口
const ST_BEACH = () => spotW({ x: avX(4) + 12, z: SHORE_Z + 10, yaw: Math.PI });   // 珊瑚灘：棧橋東邊的沙灘
const ST_JET = () => ST_DROP(-150, 0);   // 灰鷺角機場：聯邦專機停的草地旁
const ST_TGATE = () => { const t = towerSite(); return { x: t.gx, z: t.gz, yaw: 0 }; };   // 霓峰塔西面的空地
const finDeck = () => CR.on ? CR_DECK : 0;
// 霓峰塔屋頂上的一點（從大樓西牆往裡 dx、從中線往 dz）
function towerRoof(dx = 0, dz = 0) {
  if (!CR.on) { const p = ST_TGATE(); return { x: p.x + dx, z: p.z + dz, y: groundH(p.x, p.z), yaw: 0 }; }
  const Tw = CR.F.tower, cz = (Tw.z0 + Tw.z1) / 2, [x, z] = toW(Tw.x0 + 5 + dx, cz + dz), [ex, ez] = toW(Tw.x0 + 20, cz);
  return { x, z, y: CR_DECK, yaw: Math.atan2(ex - x, ez - z) };
}

// ─── F-1 金庫 ───
function casAsk(a, c) {
  c.ask = 0;
  const C = v7KS();
  if (!CAS_TGT[C.tgt]) { C.tgt = Object.keys(CAS_TGT)[Math.floor(Math.random() * 4)]; saveMotors(); }
  const T0 = CAS_TGT[C.tgt];
  dialog('計畫板 · 霓鑽賭場金庫', `金庫今天放的是 ${T0.name}（約 ${money(T0.val)}），帳本的正本也在裡面。\n準備費奧帝斯出了，挑一條路線。`,
    Object.entries(CAS_APPS).map(([id, A]) => ({ t: `${id} · ${A.name}（金庫 ${A.time} 秒）`, fn: () => { closeDialog(); casStory(a, c, id); } })));
}
function casStory(a, c, app) {
  if (c.H || !side.act || side.act !== a) return;
  v7KS().app = app; saveMotors(); sfx.pickup();
  const H = c.H = a.casH = casNew(app);
  c.A = casAct(H);
  casGo(H);
}
STEP.casino = {
  start: (a, s, c) => { a.casOn = 1; a.casC = c; c.ask = 0; if (!CASX.on) { c.end = c.ok = true; return; } casAsk(a, c); },
  step: (a, s, c, dt) => {
    if (!c.end && !c.H) { if (!dlg.open && (c.ask += dt) > .6) casAsk(a, c); return false; }
    if (!c.end && CAS.h === c.H) { casHeistStep(c.H, dt); if (c.H.alarm) a.casAlarm = true; return false; }
    if (!c.ok) { storyFail(a, c.H && !c.H.bag.val ? '金庫什麼都沒拿到' : '霓鑽賭場的搶劫失敗了'); return false; }
    return !$('heistDone').classList.contains('on');
  },
  hud: (a, s, c) => c.A && CAS.h === c.H ? c.A.hud() : { text: s.text, bar: -1 },
  mark: (a, s, c) => c.A && CAS.h === c.H ? c.A.mark() : null,
  skip: (a, s, c) => {
    if (!c.H && CASX.on) { if (dlg.open) closeDialog(); casStory(a, c, 'A'); }
    const H = c.H; if (!H || CAS.h !== H) { c.end = c.ok = true; return; }
    H.bag.val = CAS_TGT[H.tgt].val; H.daily = true; if (player.where !== 'out') { setWhere('out'); const o = casDrop(); player.x = o.x; player.z = o.z; }
    casHeistEnd(true); $('heistDone').classList.remove('on');
  },
};
storyCleanups.push(a => { if (a.casOn) { a.casOn = 0; a.casC = null; if (CAS.h) casHeistEnd(false); gpsClear(); } });

// ─── F-2 雙人跳 ───
// 起跳點：大樓門口外 1 m、樓頂的高度；泳池：門口外面 14–56 m 的空地（不在樓裡、推不動、不在水裡、跳過去的拋物線不碰別的屋頂）
function leapPlan() {
  const D = ST_LOFT(), g0 = groundH(D.x, D.z);
  let bt = 0, bh = -1;
  for (let k = 0; k < 16; k++) { const t = k / 16 * Math.PI * 2, h = roofH(D.x + Math.sin(t) * 6, D.z + Math.cos(t) * 6); if (h > bh) { bh = h; bt = t; } }
  const ix = Math.sin(bt), iz = Math.cos(bt);   // 往樓裡
  let top = 0;
  for (let d = 3; d <= 14; d++) top = Math.max(top, roofH(D.x + ix * d, D.z + iz * d));
  top = Math.max(top, g0 + 24);
  let ex = D.x - ix, ez = D.z - iz;
  for (let d = 1; d < 8; d += .5) { ex = D.x - ix * d; ez = D.z - iz * d; if (roofH(ex, ez) < top - 2) break; }
  const y0 = top + 1.6, vy0 = 3;
  const clear = (bx, bz, by) => {
    const T0 = (vy0 + Math.sqrt(vy0 * vy0 + 19.6 * (y0 - by))) / 9.8;
    for (let u = .08; u < .96; u += .08) { const t = u * T0, y = y0 + vy0 * t - 4.9 * t * t; if (roofH(ex + (bx - ex) * u, ez + (bz - ez) * u) > y - 2.5) return false; }
    return true;
  };
  let best = null;
  colY = 0;
  for (let r = 14; r <= 56 && !best; r += 3) for (let k = -8; k <= 8 && !best; k++) {
    const t = bt + Math.PI + k * .17, bx = ex + Math.sin(t) * r, bz = ez + Math.cos(t) * r, by = groundH(bx, bz);
    if (Math.abs(by - g0) > 2 || roofH(bx, bz) > by + .5 || waterDepth(bx, bz) > 0) continue;
    const q = collideCircle(bx, bz, 3.4, false);
    if (Math.hypot(q.x - bx, q.z - bz) > .05) continue;
    if (clear(bx, bz, by)) best = { bx, bz, by };
  }
  if (!best) { const bx = ex - ix * 16, bz = ez - iz * 16; best = { bx, bz, by: groundH(bx, bz) }; }
  return { ex, ez, y0, vy0, ...best, yaw: Math.atan2(best.bx - ex, best.bz - ez) };
}
function finPool(L) {
  const k = new Kit(), STONE = 0xd6cfc0, BLUE = 0x1f8fb0;
  k.box(0, .12, 0, 8.6, .24, 6.4, STONE, TX.tile);                  // 池邊的石板
  k.box(0, .26, 0, 6.6, .04, 4.4, BLUE, 16);                        // 池水（夜裡池底燈亮著）
  for (const [x, z, sx, sz] of [[0, 2.32, 7, .24], [0, -2.32, 7, .24], [3.42, 0, .24, 4.88], [-3.42, 0, .24, 4.88]]) k.box(x, .3, z, sx, .14, sz, 0xece6da, 2);   // 池緣
  for (const sx of [-1, 1]) {   // 兩張躺椅
    k.box(sx * 1.4, .38, 2.95, .7, .12, 1.7, 0xf2efe8, 2).box(sx * 1.4, .62, 3.68, .7, .5, .1, 0xf2efe8, 2, -.5);
    for (const dz of [-.7, .7]) k.box(sx * 1.4, .18, 2.95 + dz, .62, .2, .06, 0x6a6660, 2);
  }
  for (const [x, z] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) k.box(x, .5, z, .12, .76, .12, 0x2a2c2e, 2).box(x, .92, z, .2, .1, .2, 0xffe2b0, 9);   // 池邊矮燈
  const m = new T.Mesh(k.build(), MAT.uber); m.position.set(L.bx, L.by, L.bz); m.rotation.y = L.yaw; scene.add(m);
  return m;
}
function poolSplash(x, y, z, k = 1) {
  const n = Math.round((LOW ? 10 : 22) * k);
  for (let i = 0; i < n; i++) { const t = Math.random() * 6.3, s = (.6 + Math.random() * 1.8) * k; emit('spray', x, y + .3, z, { vx: Math.cos(t) * s, vy: 3 + Math.random() * 3.5 * k, vz: Math.sin(t) * s, max: 1.2, s0: .16, s1: .45 * k + .1, grav: 9.5, drag: .6, a: .65, c: [.75, .82, .88] }); }
  sfx.splash(1);
}
STEP.leap = {
  start: (a, s, c) => {
    if (a.pal < 0) palOn(a, DANE);   // 從檢查點重來：第一步的 palOn 沒跑
    const L = a.leap = leapPlan();
    if (a.poolM) { scene.remove(a.poolM); a.poolM.geometry.dispose(); }
    a.poolM = finPool(L);
    c.wait = true;
    transition(() => {
      if (player.mode === 'drive') exitVehicle();
      setWhere('out'); cardOff();
      player.x = L.ex; player.z = L.ez; player.y = L.y0; player.yaw = camState.yaw = L.yaw; camState.snap = true; player.down = 0;
      player.air3 = { kind: 'fall', vx: 0, vy: L.vy0, vz: 0, t: 0 };
      a.leapGo = { ...L, t: 0 }; a.leapDone = 0; slowmo.st = .45;
      sfx.swoosh && sfx.swoosh(false);
      c.wait = false;
    });
  },
  step: (a, s, c) => !c.wait && !fading && (a.leapDone || !a.leapGo && !player.air3),
  hud: (a, s) => ({ text: a.leapGo ? `${s.text} · F 開傘也可以` : s.text, bar: -1, num: a.leapGo ? `${Math.max(0, Math.round(player.y - a.leapGo.by))} m` : '' }),
  mark: a => a.leap ? { name: '泳池', x: a.leap.bx, y: 2, z: a.leap.bz, where: 'out' } : null,
  skip: a => { if (a.leapGo) { player.x = a.leapGo.bx; player.z = a.leapGo.bz; player.y = a.leapGo.by + 2; } },
};
function leapSplash(a, L) {
  player.air3 = null; chute.visible = false;
  player.x = L.bx; player.z = L.bz; player.y = L.by; player.v = 0; player.down = 0; player.anim = -1;
  poolSplash(L.bx, L.by, L.bz, 1.4); poolSplash(L.bx + Math.cos(L.yaw) * 1.2, L.by, L.bz - Math.sin(L.yaw) * 1.2, 1);
  camState.shake = .5; slowmo.st = 1;
  delete a.npc.dane;
  a.leapGo = null; a.leapDone = 1;
  toast('落進泳池了 · 快走');
}
storyTicks.push((a, dt) => {
  const L = a.leapGo; if (!L) return;
  L.t += slowmo.raw;
  if (L.t > 1.6 && slowmo.st < 1) slowmo.st = 1;
  const A = player.air3;
  if (!A) { leapSplash(a, L); return; }   // 開傘落地或撞到東西：一樣算進泳池
  const h = player.y - L.by, dx = L.bx - player.x, dz = L.bz - player.z;
  const tr = Math.max(.25, (A.vy + Math.sqrt(Math.max(0, A.vy * A.vy + 19.6 * Math.max(0, h)))) / 9.8);
  if (A.kind !== 'chute') { A.vx = dx / tr; A.vz = dz / tr; }
  // 戴恩在羅莎右手邊，牽著手一起掉
  const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
  a.npc.dane = { x: player.x + rx * 1.1, y: player.y, z: player.z + rz * 1.1, yaw: player.yaw, anim: ANIM.swimIdle };
  if (h < Math.max(3, -A.vy * .12)) leapSplash(a, L);
});
storyCleanups.push(a => {
  if (a.leapGo) { a.leapGo = null; if (player.air3) { player.air3 = null; chute.visible = false; player.y = groundH(pX(), pZ()); } }
  if (a.poolM) { scene.remove(a.poolM); a.poolM.geometry.dispose(); a.poolM = null; }
  if (slowmo.st < 1) slowmo.st = 1;
});

// ─── F-3 抉擇 ───
STEP.choose = {
  start: (a, s, c) => { c.ask = 0; finAsk(c); },
  step: (a, s, c, dt) => { if (c.pick) return true; if (!dlg.open && (c.ask += dt) > .6) finAsk(c); return false; },
  hud: () => ({ text: '帳本交給誰？', bar: -1 }),
  skip: (a, s, c) => { if (dlg.open) closeDialog(); c.pick = S.flags.route = S.flags.route || 'A'; },
};
function finAsk(c) {
  c.ask = 0;
  const go = r => { closeDialog(); c.pick = S.flags.route = r; saveMotors(); toast(r === 'A' ? '交帳：把帳本送到灰鷺角機場的聯邦專機' : '直播：帶著帳本攻上霓峰塔頂'); };
  dialog('抉擇 · 帳本交給誰？', '交給范斯：換到豁免，霍爾被捕，但史塔林全身而退。\n交給泰倫斯：在霓峰塔頂直播，史塔林下台，但你們永遠是逃犯。\n走完一種結局，可以從手機的「主線任務」重玩這一關，改走另一條路。', [
    { t: 'A · 交給范斯（交帳）', fn: () => go('A') },
    { t: 'B · 交給泰倫斯（直播）', fn: () => go('B') },
  ]);
}

// ─── F-4A 護送 ───
// 開車送到目標（STEP.go 的條件），路上沒有追兵就每 30 秒再叫兩台
STEP.run = {
  start: (a, s, c) => { c.chT = 0; },
  step: (a, s, c, dt) => {
    if (!SQ.chase && player.mode === 'drive' && (c.chT += dt) > 30) { c.chT = 0; gangChase('story', 2); }
    return STEP.go.step(a, s, c);
  },
  hud: (a, s, c) => STEP.go.hud(a, s, c),
  mark: (a, s, c) => STEP.go.mark(a, s, c),
  skip: (a, s, c) => { const q = tgtOf(c), o = player.mode === 'drive' ? player.veh : player; o.x = q.x; o.z = q.z; },
};
storyCleanups.push(a => { if (a.chaseOn) { a.chaseOn = 0; if (SQ.chase) chaseEnd(true); } });

// ─── F-4B 直播 ───
const UP_T = 180;   // 上傳要 3 分鐘
function rigMesh(p) {
  const k = new Kit();
  k.box(0, .3, 0, .9, .6, .55, 0x1c1e22, 2).box(0, .62, 0, .92, .04, .57, 0x3a3c40, 2);   // 器材箱
  k.box(0, .82, -.12, .62, .36, .03, 0x0e1014, 2, -.3).box(0, .82, -.105, .56, .3, .01, 0x9fd8ff, 16, -.3);   // 筆電螢幕
  for (let i = 0; i < 3; i++) { const t = i / 3 * Math.PI * 2; k.box(1.2 + Math.sin(t) * .35, .75, Math.cos(t) * .35, .04, 1.55, .04, 0x2a2c2e, 2, Math.cos(t) * .22, 0, -Math.sin(t) * .22); }   // 腳架
  k.box(1.2, 1.55, 0, .28, .2, .34, 0x16181a, 2).box(1.2, 1.55, .2, .14, .14, .08, 0x2a3440, 2);   // 攝影機
  k.cyl(-.9, .95, 0, .03, .03, 1.9, 6, 0x8a8c90, 2).cyl(-.9, 1.95, 0, .42, .06, .14, 16, 0xd8d8d4, 2, .5);   // 衛星天線
  k.box(.32, .66, .2, .08, .06, .08, 0xff3a2a, 9);   // 直播中的紅燈
  const m = new T.Mesh(k.build(), MAT.uber); m.position.set(p.x, p.y, p.z); m.rotation.y = p.yaw; scene.add(m);
  return m;
}
STEP.lift = {
  start: (a, s, c) => {
    if (a.pal < 0) palOn(a, DANE);
    c.wait = true;
    transition(() => {
      if (player.mode === 'drive') exitVehicle();
      setWhere('out'); cardOff();
      const p = towerRoof(0, 0), r = towerRoof(3.5, -3);
      player.x = p.x; player.z = p.z; player.y = p.y + .05; player.yaw = camState.yaw = p.yaw; camState.snap = true; player.v = 0;
      a.noPal = 1;
      if (!a.rig) a.rig = { ...r, m: rigMesh(r) };
      a.npc.dane = { ...towerRoof(2.4, 1.8), yaw: p.yaw + Math.PI };
      life.armor = 100;
      for (const id of ['rpg', 'rifle']) if (arm.ammo[id]) arm.ammo[id].res = Math.max(arm.ammo[id].res, ARMS[id].mag * 4);
      c.wait = false;
    });
  },
  step: (a, s, c) => !c.wait && !fading,
  hud: () => ({ text: '工地升降機一路往上……', bar: -1 }),
};
STEP.stream = {
  start: (a, s, c) => { c.p = 0; a.helis = a.helis || 0; a.streamOn = 1; W.six = 1; wantedApi.set(6); toast('直播開始 · 全城都看到了 · 六星通緝'); equip('rpg', true); },
  step: (a, s, c, dt) => {
    const R = a.rig, on = R && Math.hypot(pX() - R.x, pZ() - R.z) < 14 && Math.abs(player.y - R.y) < 3;
    c.on = on;
    if (on) c.p += dt / UP_T;
    const h = W.heli;
    if (h && h.fall && !h.cnt) { h.cnt = 1; a.helis++; toast(`打下第 ${a.helis} 架直升機`); }
    if (W.stars < 6 && !life.dead) { W.six = 1; wantedApi.set(6); }
    if (c.p >= 1) { a.streamOn = 0; return true; }
    return false;
  },
  hud: (a, s, c) => ({ text: c.on ? `${s.text}${W.heli && !W.heli.fall ? ' · 直升機來了' : ''}` : '回到直播器材旁邊（14 m 內）', bar: c.p * 100, num: `${Math.floor(c.p * 100)}%`, low: !c.on }),
  mark: a => a.rig ? { name: '直播器材', x: a.rig.x, y: a.rig.y + 2, z: a.rig.z, where: 'out' } : null,
  skip: (a, s, c) => { c.p = 1; },
};
// 69-police.js 的 heliStep：直播時直升機至少飛在屋頂以上 16 m
function storyHeliY() { const a = side.act; return a && a.kind === 'story' && a.streamOn ? finDeck() + 16 : 0; }
// 從塔頂下來（跳下去開傘、或爬直梯）
STEP.down = {
  step: (a, s, c) => player.where === 'out' && !player.air3 && (player.mode === 'drive' || player.y - groundH(pX(), pZ()) < 3),
  hud: (a, s) => ({ text: player.air3 ? (player.air3.kind === 'fall' ? '自由落體 · F 或空白鍵開傘' : s.text) : s.text, bar: -1, num: `${Math.max(0, Math.round(player.y - groundH(pX(), pZ())))} m` }),
  skip: () => { player.air3 = null; chute.visible = false; const p = ST_TGATE(); player.x = p.x; player.z = p.z; player.y = groundH(p.x, p.z); player.down = 0; },
};
storyCleanups.push(a => {
  a.streamOn = 0; a.noPal = 0;
  if (a.rig) { scene.remove(a.rig.m); a.rig.m.geometry.dispose(); a.rig = null; }
});

// ─── 片尾字幕（玩家還能動，字幕在畫面上方一組一組換） ───
const CRED_T = 3.6;
const cred = { on: false, rows: [], i: -1, t: 0 };
{ const el = document.createElement('div'); el.id = 'stCred'; el.setAttribute('aria-live', 'polite'); el.innerHTML = '<small></small><b></b><span></span>'; $('hud').append(el); }
function credRows(end) {
  return [
    ['霓虹夜城 · 主線', '一手爛牌', ''],
    ['主演', '羅莎·伊巴拉', '戴恩·默瑟'],
    ['家人', '盧佩·伊巴拉', '羅莎的母親'],
    ['街坊與同夥', '奧帝斯　凱爾　賈克斯', '塞拉斯　娜迪亞　泰倫斯'],
    ['反派', '霍爾副局長', '維多莉亞·史塔林'],
    ['紀念', '霍利斯與朵蒂', '錨灣港船廠'],
    [end === 'A' ? '結局 A' : '結局 B', end === 'A' ? '交帳' : '直播', end === 'A' ? '霍爾被捕，史塔林全身而退' : '史塔林下台，兩人成了城裡的傳說'],
    ['', '城市是你的', '手機的「主線任務」可以重玩每一關，F-3 可以改走另一條路'],
  ];
}
function credShow() {
  const el = $('stCred'), r = cred.rows[cred.i];
  el.querySelector('small').textContent = r[0]; el.querySelector('b').textContent = r[1]; el.querySelector('span').textContent = r[2];
  el.classList.add('on');
}
function credOff() { cred.on = false; cred.i = -1; $('stCred').classList.remove('on'); }
STEP.credits = {
  start: (a, s, c) => { Object.assign(cred, { on: true, rows: credRows(s.end), i: 0, t: 0 }); credShow(); },
  step: (a, s, c, dt) => {
    if (!cred.on) return true;
    cred.t += slowmo.raw;
    const k = Math.floor(cred.t / CRED_T);
    if (k !== cred.i) {
      if (k >= cred.rows.length) { credOff(); return true; }
      cred.i = k; credShow();
    } else if (cred.t - k * CRED_T > CRED_T - .7) $('stCred').classList.remove('on');   // 換下一組前先淡出
    return false;
  },
  hud: () => ({ text: '片尾 · 城市是你的', bar: -1 }),
  skip: () => { credOff(); },
};
storyCleanups.push(() => { if (cred.on) credOff(); });

// ─── 結局後的世界 ───
// 每次走完 F-4A／F-4B 都照這一次的結局設定（重玩 F-3 選另一條路，世界跟著換）
function storyEnding(end) {
  const F = S.flags;
  F.end = end; F.route = end;
  Object.assign(S.cast, { dane: 1, vance: 1, kael: 1, jax: 1 });
  if (end === 'A') { wantedClear('reset'); newsAdd('第九分局副局長霍爾遭聯邦逮捕', '聯邦檢察官手上有一本帳。天際置業發言人：「與本公司無關。」'); }
  else { F.fame = 100; newsAdd('天際置業大樓遭查封，史塔林宣布辭職', '一段三分鐘的直播轉傳了四百萬次。直播的兩人仍在通緝中。'); }
  saveMotors(); posterSync();
}
// 69-police.js 的 crime：路人報警到派車的秒數（第九分局換了人慢一點；兩人上了通緝海報就快一點）
function storyRepT() { return !S ? 3 : S.flags.end === 'B' ? 1.5 : S.flags.end === 'A' ? 4 : 3; }
// 結局 B 的通緝海報：幾個主線去過的街角立一塊告示牌
const posters = [];
function posterSync() {
  const on = !!(S && S.flags.end === 'B');
  if (on && !posters.length) {
    for (const p of [ST_CROWN(), ST_MID(), ST_NEON(), ST_HALO(), ST_DOCKS(), ST_TAPE(), ST_MOTEL()]) {
      const g = new T.Group(), sign = v5Sign([['通緝', .2, '#9a2a22', .17], ['羅莎·伊巴拉', .12, '#1c1814', .4], ['戴恩·默瑟', .12, '#1c1814', .56], ['懸賞 $1,000,000', .08, '#3a3028', .74], ['第九分局 · 見到請立即報警', .06, '#5a4a3a', .88]], .9, 1.25, { bg: '#e6dcc4', edge: '#7a6a50' });
      sign.position.set(0, 1.85, .05); g.add(sign);
      const k = new Kit(); k.box(0, 1.3, -.02, .08, 2.6, .08, 0x3a3c40, 2).box(0, 1.85, 0, .98, 1.33, .04, 0x2a2c2e, 2);
      g.add(new T.Mesh(k.build(), MAT.uber));
      const yaw = frameYaw(p.x, p.z) + Math.PI / 2, [lx, lz] = toL(p.x, p.z), q = spotW({ x: lx + 1.4, z: lz + 1.4 });
      g.position.set(q.x, groundH(q.x, q.z), q.z); g.rotation.y = yaw; scene.add(g); posters.push(g);
    }
  }
  for (const g of posters) g.visible = on;
}

// ─── 手機的「主線任務」：重玩做過的任務 ───
function storyPhoneRows() {
  if (!S) return [];
  const rows = ORDER.filter(id => MS[id] && isDone(id)).map(id => {
    const m = MS[id], md = S.medal[id];
    return { t: `${m.id}「${m.title}」`, sub: `${CHAPTER[m.ch][0]} · ${m.star ? '★'.repeat(m.star) : '劇情'}${md != null && m.bonus.length ? ` · ${MEDAL[md].name}` : ''}`, val: '重玩', ok: !side.act, fn: () => { closePhone(); const b = storyBusy(); if (b) { toast(b); return; } storyCard(m); } };
  });
  const nx = storyNext();
  return [...(nx ? [{ t: `下一關：${nx.id}「${nx.title}」`, sub: `${storyWhere(nx)} · 走到地圖上的起點按 E`, val: '', ok: true, fn: () => { const p = nx.at(); gpsSet(p.x, p.z); toast('已設定 GPS'); } }] : S.flags.end ? [{ t: `主線完成 · 結局 ${S.flags.end}`, sub: S.flags.end === 'A' ? '交帳：霍爾被捕' : '直播：史塔林下台', val: '', ok: true, fn: () => {} }] : []), ...rows];
}

// ─── 任務表 ───
const FIN_A = [L('lupe', '天際置業寄了信來，說法拍撤銷了。'), L('rosa', '聯邦的人辦事很快。'), L('lupe', '霍爾上了新聞。那個史塔林呢？'), L('dane', '她還在電視上剪綵。'), L('rosa', '一次只能抓一條魚。'), L('lupe', '吃飯。湯要涼了。')];
storyAdd([
  { id: 'F-1', ch: 'F', title: '牌桌', who: ROSA, star: 5, split: true, sw: [ROSA, DANE], at: ST_ALLEY, giver: 'otis', giverAt: () => nearL(ST_ALLEY(), 1.8, .6, -Math.PI / 2),
    desc: '史塔林帳上的錢最後都進了霓鑽賭場的金庫，帳本的正本也在裡面。', sms: '奧帝斯：正本不在帳上，在賭場的金庫裡。AFTERGLOW 後巷見。',
    bonus: [{ t: '沒觸發警報', ok: a => !a.casAlarm }, { t: '日間金庫也掃光', ok: a => !!(a.casH && a.casH.daily) }],
    steps: [
      { type: 'say', with: 'otis', lines: [L('otis', '史塔林的錢洗了一圈，最後都停在霓鑽賭場的金庫。'), L('rosa', '帳本的正本呢？'), L('otis', '也在裡面。她不信任電腦。'), L('rosa', '那就去拿。'), L('otis', '準備費我出了。路線妳挑。')] },
      { type: 'casino', text: '在計畫板上挑一條路線' },
      { type: 'say', phone: '奧帝斯', lines: [L('otis', '正本到手。現在帳上每一筆都對得起來了。'), L('rosa', '那霍爾也知道了。'), L('otis', '……今晚別回家。')] },
    ] },
  { id: 'F-2', ch: 'F', title: '天台', who: ROSA, star: 5, sw: [ROSA, DANE], at: ST_LOFT,
    desc: '霍爾的人包圍了冠石頂層公寓。', sms: '戴恩：冠石的公寓，樓下停了三台沒有車牌的車。快來。',
    bonus: [{ t: '生命沒掉超過 50', ok: a => a.hurt <= 50 }, { t: '爆頭 3 次', ok: a => a.heads >= 3 }],
    steps: [
      { type: 'fn', fn: a => palOn(a, DANE) },
      { type: 'say', with: 'dane', lines: [L('dane', '三台車，沒有車牌，引擎都沒熄。'), L('rosa', '霍爾知道正本在我們手上。'), L('dane', '頂樓有陽台。陽台下面是泳池。'), L('rosa', '你在開玩笑。')] },
      { type: 'fight', text: '霍爾的人堵在大樓門口', at: ST_LOFT, n: 6, r: 13, esc: true, hot: true, guns: ['rifle', 'smg', 'pistol'] },
      { type: 'card', k: '冠石頂層公寓', t: '凌晨四點', lines: [['dane', '他們上樓了。電梯、樓梯，兩邊都是。'], ['rosa', '你相信我嗎？'], ['dane', '從來沒有。'], ['rosa', '很好。牽著。']] },
      { type: 'leap', text: '牽著戴恩從頂樓跳進泳池', ck: true },
      { type: 'fn', fn: () => { addHeat(99, 4); toast('霍爾調了整個分局 · 4 星'); } },
      { type: 'lose', text: '甩掉霍爾調來的整個分局' },
    ] },
  { id: 'F-3', ch: 'F', title: '抉擇', who: ROSA, star: 0, sw: [ROSA, DANE], at: ST_BEACH, giver: 'twade', giverAt: () => nearL(ST_BEACH(), 1.8, .6, -Math.PI / 2),
    desc: '天亮的珊瑚灘。帳本只有一本，想要它的人有兩個。', sms: '泰倫斯：珊瑚灘，天亮的時候。我有個辦法，比交給條子大聲。',
    next: () => S.flags.route === 'B' ? 'F-4B' : 'F-4A',
    steps: [
      { type: 'fn', fn: a => { palOn(a, DANE); clockSt.min = 5 * 60 + 40; } },
      { type: 'say', with: 'twade', lines: [L('twade', '帳本我看過了。三分鐘，全城的手機都會看到。'), L('rosa', '然後呢？'), L('twade', '然後他們再也蓋不住。你們也再也躲不了。')] },
      { type: 'say', phone: '范斯', lines: [L('vance', '專機在灰鷺角等到中午。帳本給我，你們兩個的案子一筆勾銷。'), L('vance', '霍爾會進牢。'), L('dane', '史塔林呢？'), L('vance', '……下一次。')] },
      { type: 'choose' },
    ] },
  { id: 'F-4A', ch: 'F', title: '交帳', who: ROSA, star: 5, route: 'A', sw: [ROSA, DANE], at: ST_BEACH,
    desc: '開車把帳本送到灰鷺角機場的聯邦專機。', sms: '范斯：專機加好油了。路上小心，霍爾也知道你們要去哪。',
    next: () => 'end',
    bonus: [{ t: '4 分鐘內送到', ok: a => a.t < 240 }, { t: '沒換過車', ok: a => !a.vehs || a.vehs.size <= 1 }],
    steps: [
      { type: 'fn', fn: a => { palOn(a, DANE); storyCar(a, 'kiri', ST_BEACH(), '范斯安排的車', true); } },
      { type: 'car', text: '上車' },
      { type: 'fn', fn: a => { a.chaseOn = 1; gangChase('story', 3); addHeat(99, 3); toast('霍爾的人和赤蠍幫一起攔 · 3 星'); } },
      { type: 'run', text: '把帳本送到灰鷺角機場的聯邦專機', to: ST_JET, r: 12, drive: true, name: '聯邦專機' },
      { type: 'fn', fn: a => { a.chaseOn = 0; if (SQ.chase) chaseEnd(true); wantedClear('reset'); a.npc.vance = nearL(ST_JET(), 3, .8, -Math.PI / 2); } },
      { type: 'say', with: 'vance', lines: [L('vance', '準時。'), L('rosa', '正本跟副本都在。'), L('vance', '霍爾今天下午就會被帶走。'), L('dane', '史塔林呢？'), L('vance', '她請得起最好的律師。你們兩個自由了，這是我能給的。')] },
      { type: 'fn', fn: () => storyEnding('A') },
      { type: 'card', k: '片尾', t: '星期天的晚餐', hold: 2.4 },
      { type: 'fade', to: () => stAt(ROSA_L, .6, .8, 0), gray: 0 },
      { type: 'fn', fn: a => { a.npc.lupe = stAt(ROSA_L, 1.8, -.6); } },
      { type: 'say', with: 'lupe', lines: FIN_A },
      { type: 'credits', end: 'A' },
    ] },
  { id: 'F-4B', ch: 'F', title: '直播', who: ROSA, star: 5, route: 'B', sw: [ROSA, DANE], at: ST_TGATE, giver: 'twade', giverAt: () => nearL(ST_TGATE(), 1.8, .6, -Math.PI / 2),
    desc: '帶著帳本攻上霓峰塔頂開直播，守住三分鐘。', sms: '泰倫斯：霓峰塔工地。塔頂的訊號最好，器材我搬上去了。',
    next: () => 'end',
    bonus: [{ t: '打下 2 架直升機', ok: a => (a.helis || 0) >= 2 }, { t: '生命沒掉超過 120', ok: a => a.hurt <= 120 }],
    steps: [
      { type: 'fn', fn: a => palOn(a, DANE) },
      { type: 'say', with: 'twade', lines: [L('twade', '上傳要三分鐘，塔頂的訊號最好。'), L('dane', '霍爾會派直升機。'), L('twade', '那就讓全城看他派直升機。')] },
      { type: 'fight', text: '霍爾的人守著工地', at: ST_TGATE, n: 6, r: 14, esc: true, hot: true, guns: ['rifle', 'smg'] },
      { type: 'card', k: '霓峰塔 · 202 m', t: '直播', lines: [['twade', '訊號滿格。鏡頭對著你們。'], ['rosa', '我叫羅莎·伊巴拉。這是維多莉亞·史塔林的帳本。'], ['dane', '每一筆都有簽名。']] },
      { type: 'lift', ck: true },
      { type: 'stream', text: '直播上傳中：守住塔頂' },
      { type: 'fn', fn: a => { delete a.npc.dane; toast('上傳完成 · 從塔頂邊上按空白鍵跳下去，F 開傘'); } },
      { type: 'down', text: '從塔頂下去' },
      { type: 'fn', fn: a => { a.noPal = 0; } },
      { type: 'lose', text: '六星通緝：甩掉全城的警察' },
      { type: 'fn', fn: () => storyEnding('B') },
      { type: 'card', k: '片尾', t: '出海', lines: [['dane', '新聞說我們是「直播大盜」。'], ['rosa', '比「假釋犯」好聽。'], ['dane', '通緝海報上的照片很難看。'], ['rosa', '那就別回來看。開船。']] },
      { type: 'fade', to: () => ST_SHIP, gray: 0 },
      { type: 'fn', fn: () => { const b = ST_BH; if (b && !b.dead && vehicles.includes(b) && Math.hypot(b.x - pX(), b.z - pZ()) < 40) enterVehicle(b); } },
      { type: 'credits', end: 'B' },
    ] },
]);
posterSync();

storyApi.fin = { start: id => storyStart(MS[id]), leapPlan, towerRoof, ending: storyEnding, repT: storyRepT, cred: () => ({ on: cred.on, i: cred.i }), posters: () => posters.filter(g => g.visible).length, phone: storyPhoneRows, heliY: storyHeliY };
