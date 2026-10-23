// ═══ 搶劫補完（neon_nightcity_gta_v_2.md 第 2–4 節）：前置 B、金庫電子鎖破譯、依路線的逃亡載具 ═══
// 前置 B（heist.st 'setupB'，只有強攻）：前置 A 交車後換成 Jax，到 7 號大道的路口埋伏 NCPD 移防車隊（鎮暴裝甲車、護送警車、四名押車特警）。
//   電擊槍或催淚瓦斯放倒的特警會癱瘓 14 秒；有特警站著盯你 2.5 秒就呼叫支援（2 星）。搶到裝甲車即 3 星，
//   甩開視線後開進 CHROME WORKS 改裝防彈輪胎與偽裝塗裝（通緝清掉），回到 go。
// 破譯：金庫門炸開 1.4 秒後自動開啟（Kael 接手壓人質，威懾不會掉）。20 秒內用 A／D 調頻率、W／S 調振幅，三組波形各對齊 0.6 秒；
//   E 改裝鋁熱鑽機。成功：潛行沒響警報就直接開金庫；響了警報（強攻炸門一定會響）省下鑽機，Jax 只守 30 秒。
//   逾時：潛行觸發警報（69-heist.js 的 heistAlarm 直接 4 星），之後照舊裝鑽機。
// 逃亡：潛行照舊是銀行附近路邊的 Tiara GT（城裡沒有能開車的暗巷）；強攻是改裝過的鎮暴裝甲車（防彈輪胎、塗裝讓警察的視錐變小），
//   開到灰鷺河濱的停機坪換 69-gunship.js 的武裝直升機，飛到鐵灣貨場降落在黃圈裡（停在地面）才算數。
// 排在 69-heist 之後：heist、heistStage、heistFade、escapeStart、holdStart、clearSpot 都已宣告；W、wantedApi 只在函式裡用。

const ENF_AT = spotW({ x: avX(6) + PARK, z: stZ(2) + 30, yaw: Math.PI });   // 移防車隊停在 3 St 路口前（世界座標）
const ENF_ESC = spotW({ x: avX(6) + PARK, z: stZ(2) + 41, yaw: Math.PI });
const ENF_MEN = [-3.5, 0, 3.5, 11].map((dz, i) => ({ ...WP(avX(6) + PARK + 3.1, stZ(2) + 30 + dz), yaw: yawW(zoneAtL(avX(6), stZ(2) + 30), -Math.PI / 2 + (i - 1.5) * .3) }));
const garDoor = () => WP(GAR_X, GAR_Z + SW + 4);
const ESC_STUN = 14, ESC_CALL = 2.5;

// 搶劫用的載具不在 jacked 裡（68-gta.js 的 dropVehicle 會刪錯），自己收
function heistVehGone(v) {
  if (!v) return;
  if (player.veh === v) exitVehicle();
  const i = vehicles.indexOf(v); if (i < 0) return;
  if (jacked.includes(v)) return dropVehicle(v);
  vehicles.splice(i, 1);
  scene.remove(v.g); v.g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
}

// ─── 前置 B：劫持 NCPD 鎮暴裝甲車 ───
function enfDrop() {
  for (const f of SQ.f) if (f.on && f.esc) fFree(f);
  heistVehGone(heist.enf); heistVehGone(heist.escCar);
  heist.enf = heist.escCar = heist.escG = null;
}
function enfSpawn() {
  enfDrop();
  clearSpot(ENF_AT.x, ENF_AT.z, 9); clearSpot(ENF_ESC.x, ENF_ESC.z, 7);
  const v = heist.enf = buildVeh('md84', ENF_AT.x, ENF_AT.z, ENF_AT.yaw, 0, .2, 0, 'heist');
  v.name = 'NCPD 鎮暴裝甲車'; v.lights = 1; v.y = groundH(v.x, v.z); poseVehicle(v);
  const c = heist.escCar = buildVeh('fh_cop', ENF_ESC.x, ENF_ESC.z, ENF_ESC.yaw, 0, .5, 0, 'heist');
  c.name = 'NCPD 護送警車'; c.lights = 1; c.y = groundH(c.x, c.z); poseVehicle(c);
  fRoom(ENF_MEN.length);
  const g = heist.escG = { kind: 'escort', awake: false };
  for (const m of ENF_MEN) {
    const f = fSpawn('gang', m.x, m.z, m.yaw, { gun: 'rifle', esc: true });
    if (f) { f.hp = 160; f.calm = true; f.grp = g; }
  }
  heist.enfHot = false; heist.escCallT = 0; heist.escCalled = false;
}
function setupBStart() {
  heistStage('setupB');
  enfSpawn();
  heistFade(() => {
    Object.assign(crew.st[2], { x: SAFE.x, z: SAFE.z, yaw: player.yaw });
    crewLoad(2);
    const a = arm.ammo;
    a.stun.mag = ARMS.stun.mag; a.stun.res = ARMS.stun.res; a.gas.mag = ARMS.gas.n;
    equip('stun', true);
    toast('前置 B：換 Jax 埋伏 NCPD 移防車隊。用電擊槍或催淚瓦斯放倒押車特警，搶走鎮暴裝甲車');
  });
}
function enfStep(dt) {
  const v = heist.enf;
  if (!v || v.dead || !vehicles.includes(v)) { toast('鎮暴裝甲車毀了：Zero 查到下一班移防車隊'); enfSpawn(); return; }
  // 被電擊或瓦斯放倒的特警：第一次倒下癱瘓 14 秒
  let up = false;
  for (const f of SQ.f) {
    if (!f.on || !f.esc) continue;
    if (f.stunT > 0 && !f.escK) { f.escK = 1; f.stunT = ESC_STUN; }
    if (fUp(f) && !f.calm && !(f.stunT > 0)) up = true;
  }
  // 醒著的特警盯著你 2.5 秒就呼叫支援
  if (up && !heist.escCalled && (heist.escCallT += dt) > ESC_CALL) { heist.escCalled = true; if (W.stars < 2) wantedApi.set(2); toast('押車特警呼叫支援了'); }
  if (player.veh === v && !heist.enfHot) {
    heist.enfHot = true; wakeGroup(heist.escG);
    if (W.stars < 3) wantedApi.set(3);
    toast('搶到鎮暴裝甲車：3 星。甩開視線，開進 CHROME WORKS 改裝');
  }
}
function enfRefit() {
  const v = heist.enf;
  transition(() => {
    wantedClear('respray'); W.lastVeh = null;
    heistVehGone(v); heist.enf = null; enfDrop();
    heist.enfReady = true;
    heistStage('go');
    sfx.spray();
    toast('改裝完成：防彈輪胎、市政工程車塗裝。搶完銀行它會停在逃亡點');
  });
}
// CHROME WORKS 門口（和 69-crew.js 的噴漆同一個位置；ctxHooks 比噴漆先問）
ctxHooks.push((p) => {
  if (heist.st !== 'setupB' || p.mode !== 'drive' || !heist.enf || p.veh !== heist.enf) return null;
  const v = p.veh, d = garDoor();
  if (Math.hypot(v.x - d.x, v.z - d.z) > 7 || Math.hypot(v.vx, v.vz) > 2) return null;
  if (W.seen) return { key: 'E', text: '警察還看得到你 <i>· 先甩開視線</i>', fn: () => toast('被盯著的時候 CHROME WORKS 不開門') };
  return { key: 'E', text: '改裝防彈輪胎與偽裝塗裝 <i>· CHROME WORKS</i>', fn: enfRefit };
});

// ─── 逃亡載具 ───
function getawayCar() {
  clearSpot(CAR_AT.x, CAR_AT.z, 9);
  heist.air = heist.how === 'loud' && !!heist.enfReady;   // 強攻而且做完前置 B：裝甲車＋直升機
  if (!heist.air) {
    const v = buildVeh('tiara', CAR_AT.x, CAR_AT.z, CAR_AT.yaw, 0, .61, 2, 'heist');
    v.name = '逃亡車 · Tiara GT'; v.vmax = 47; v.eng = 13; v.hp = 2400; v.y = groundH(v.x, v.z); poseVehicle(v);
    return v;
  }
  const v = buildVeh('md84', CAR_AT.x, CAR_AT.z, CAR_AT.yaw, 0, .2, 6, 'heist');   // palI 6 = PAL[5] 墨綠（市政工程車）
  v.name = '改裝裝甲車 · 市政工程塗裝'; v.bpTires = 1; v.disguise = 1;
  v.hp = v.hpMax = 6000; v.hpLock = 1; v.y = groundH(v.x, v.z); disguiseKit(v); poseVehicle(v);
  // 每次都在停機坪放一架新的（上一輪的可能停在貨場或炸毀了）
  if (heist.heli && GS.list.includes(heist.heli) && player.veh !== heist.heli) dropGunship(heist.heli);
  clearSpot(HELIPAD.x, HELIPAD.z, 10);
  heist.heli = buildGunship(HELIPAD.x, HELIPAD.z, HELIPAD.yaw);
  return v;
}
// 偽裝塗裝：車身兩側的橘黃反光條、駕駛艙頂兩盞閃爍的工程警示燈（車漆換色在 md84 的模型上看不太出來）
function disguiseKit(v) {
  const geo = v.body.children[0].geometry;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const b = geo.boundingBox, k = new Kit(), top = b.max.y, hw = (b.max.x - b.min.x) / 2 - .06, L = b.max.z - b.min.z, zc = (b.max.z + b.min.z) / 2;
  for (const s of [-1, 1]) {
    k.box(s * hw, top * .42, zc - L * .08, .03, .18, L * .7, 0xe8a520, 2).box(s * (hw + .005), top * .42, zc - L * .08, .03, .05, L * .7, 0xece8e0, 2);
    k.box(s * .45, top + .08, zc + L * .14, .3, .16, .3, 0xffa21a, 9);
  }
  v.body.add(new T.Mesh(k.build(), MAT.uber));
}
function heliLeg() {
  const v = player.veh, h = heist.heli;
  if (h && h.dead && v !== h && !heist.heliLost) { heist.heliLost = true; toast('直升機被打爛了：開裝甲車甩掉警察，直接開進貨場'); }
  if (v && v === h && !heist.heliIn) { heist.heliIn = true; toast('Kael 起飛：Space 爬升、左鍵發射火箭。飛高了地面的警察跟不住'); }
  if (v && v.fly && Math.hypot(v.x - YARD.x, v.z - YARD.z) < 10 && v.y - groundH(v.x, v.z) > 1.5 && !heist.landHint) { heist.landHint = true; toast('按住 Shift 降落在黃圈裡'); }
}
function heist2Mark() {
  if (heist.st === 'setupB') {
    if (heist.enf && player.veh === heist.enf) { const d = garDoor(); return { name: 'CHROME WORKS', x: d.x, y: 2, z: d.z, where: 'out' }; }
    return heist.enf ? { name: 'NCPD 移防車隊', x: heist.enf.x, y: 3, z: heist.enf.z, where: 'out' } : null;
  }
  const h = heist.heli, inH = h && player.veh === h;
  if (inH || !h || h.dead) return { name: '貨櫃安全屋', x: YARD.x, y: 1.5, z: YARD.z, where: 'out' };
  return { name: '武裝直升機', x: h.x, y: 4, z: h.z, where: 'out' };
}
HEIST_TEXT.setupB = () => heist.enf && player.veh === heist.enf ? (W.seen ? '甩開警察的視線' : '把裝甲車開進 CHROME WORKS 改裝') : '前置 B：放倒押車特警，搶走鎮暴裝甲車';
{
  const drill = HEIST_TEXT.drill;
  HEIST_TEXT.drill = () => HACK.on ? '破譯電子鎖（E 改裝鑽機）' : drill();
  const drive = HEIST_TEXT.drive;
  HEIST_TEXT.drive = () => {
    if (!heist.air) return drive();
    const h = heist.heli;
    if (h && !h.dead && player.veh !== h) return '開到灰鷺河濱的停機坪，換搭武裝直升機';
    return W.stars ? '甩掉警察（飛高、飛遠甩開警用直升機）' : '降落在鐵灣貨場的貨櫃安全屋';
  };
}

// ─── 金庫電子鎖破譯 ───
const HACK = { on: false, t: 0, rows: [], cur: 0, hold: 0, el: null, cv: null, tEl: null, bar: null, ph: 0 };
const HACK_T = 20, HACK_F = 6, HACK_A = 5, HACK_HOLD = .6;
function hackEl() {
  if (HACK.el) return HACK.el;
  const st = document.createElement('style');
  st.textContent = `#hack{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(540px,calc(100vw - 32px));z-index:4;display:none;padding:14px 16px 12px;background:rgba(10,11,14,.94);color:var(--ink);font-family:var(--sans);border-radius:3px;user-select:none;-webkit-user-select:none}
#hack.on{display:block}
#hack header{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
#hack h2{margin:0;font-size:15px;font-weight:600;letter-spacing:.02em}
#hack h2 small{margin-left:8px;font-size:12.5px;font-weight:400;color:var(--ink-2)}
#hackT{font-family:var(--cond);font-size:24px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--sodium)}
#hackT.low{color:var(--rose)}
#hackBar{height:2px;margin-top:8px;background:rgba(236,232,224,.12)}
#hackBar i{display:block;height:100%;width:100%;background:var(--sodium);transform-origin:0 50%}
#hackCv{display:block;width:100%;height:168px;margin-top:10px}
#hack p{margin:8px 0 0;font-size:12.5px;line-height:1.5;color:var(--ink-2)}
#hack p b{font-weight:600;color:var(--ink)}
#hack .hb{display:none;grid-template-columns:repeat(4,1fr) 1.4fr;gap:6px;margin-top:10px}
#hack .hb button{min-height:44px;border:0;border-radius:3px;background:rgba(236,232,224,.1);color:var(--ink);font:500 14px var(--sans);touch-action:manipulation}
#hack .hb button:active{background:rgba(236,232,224,.2)}
#hack .hb button.drill{background:rgba(255,174,87,.18);color:var(--sodium)}
body.touch #hack .hb{display:grid}
body.touch #hack p.k{display:none}
body.hacking #touch{visibility:hidden}`;
  document.head.appendChild(st);
  const e = document.createElement('div');
  e.id = 'hack'; e.setAttribute('role', 'dialog'); e.setAttribute('aria-label', '金庫電子鎖破譯');
  e.innerHTML = `<header><h2>金庫電子鎖<small>對齊三組波形</small></h2><span id="hackT">20.0</span></header><div id="hackBar"><i></i></div><canvas id="hackCv"></canvas>
<p class="k"><b>A D</b> 頻率　<b>W S</b> 振幅　對齊 0.6 秒鎖定一組　<b>E</b> 改裝鋁熱鑽機</p>
<div class="hb"><button data-h="f-">頻率 −</button><button data-h="f+">頻率 +</button><button data-h="a-">振幅 −</button><button data-h="a+">振幅 +</button><button data-h="drill" class="drill">裝鑽機</button></div>`;
  document.body.appendChild(e);
  e.querySelectorAll('.hb button').forEach(b => b.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); hackInput(b.dataset.h); }));
  HACK.el = e; HACK.cv = e.querySelector('#hackCv'); HACK.tEl = e.querySelector('#hackT'); HACK.bar = e.querySelector('#hackBar i');
  return e;
}
function hackOpen() {
  if (HACK.on) return;
  const r = n => 1 + Math.floor(Math.random() * n);
  HACK.rows = [0, 1, 2].map(i => {
    let o;
    do o = { tf: r(HACK_F), ta: r(HACK_A), f: r(HACK_F), a: r(HACK_A) }; while (Math.abs(o.tf - o.f) + Math.abs(o.ta - o.a) < 3);
    return { ...o, ok: false, ph: Math.random() * 6, sp: .7 + i * .35 };
  });
  HACK.on = true; HACK.t = HACK.T = HACK_T * hireK('hack'); HACK.cur = 0;   // 69-v3-heist.js：駭客決定破譯時間 HACK.hold = 0;
  hackEl().classList.add('on'); document.body.classList.add('hacking');
  arm.trig = false; gta.aiming = false;
  sfx.click();
}
function hackClose() { HACK.on = false; if (HACK.el) HACK.el.classList.remove('on'); document.body.classList.remove('hacking'); }
function hackInput(k) {
  if (!HACK.on) return;
  if (k === 'drill') { hackEnd('drill'); return; }
  const R = HACK.rows[HACK.cur]; if (!R) return;
  if (k === 'f-') R.f = Math.max(1, R.f - 1); else if (k === 'f+') R.f = Math.min(HACK_F, R.f + 1);
  else if (k === 'a-') R.a = Math.max(1, R.a - 1); else if (k === 'a+') R.a = Math.min(HACK_A, R.a + 1);
  HACK.hold = 0; sfx.click();
}
const HACK_KEYS = { KeyA: 'f-', ArrowLeft: 'f-', KeyD: 'f+', ArrowRight: 'f+', KeyS: 'a-', ArrowDown: 'a-', KeyW: 'a+', ArrowUp: 'a+', KeyE: 'drill' };
function hackKey(code) {
  if (!HACK.on) return false;
  if (HACK_KEYS[code]) { hackInput(HACK_KEYS[code]); return true; }
  return code === 'KeyF' || code === 'KeyG' || code === 'Space';
}
// ok：三組都對齊；drill：按 E 改裝鑽機；late：時間到
function hackEnd(how) {
  hackClose(); heist.hackDone = true;
  if (how === 'ok') {
    sfx.ability(true);
    if (!heist.alarm) { toast('電子鎖破解了：金庫門無聲滑開，把錢裝進袋子'); escapeStart(); }
    else { toast('電子鎖破解了：省下鑽機時間'); heist.holdT = 30; holdStart(); }
    return;
  }
  if (how === 'late' && !heist.alarm) heistAlarm('破譯逾時：電子鎖觸發了保全警報');
  drillStart();
}
function hackStep(dt) {
  if (heist.st !== 'drill' || player.where !== 'bank' || life.dead) { hackClose(); return; }
  HACK.ph += dt;
  HACK.t = Math.max(0, HACK.t - dt);
  const R = HACK.rows[HACK.cur];
  if (R && R.f === R.tf && R.a === R.ta) {
    if ((HACK.hold += dt) >= HACK_HOLD) { R.ok = true; HACK.cur++; HACK.hold = 0; sfx.reload(); if (HACK.cur >= HACK.rows.length) { hackDraw(); hackEnd('ok'); return; } }
  } else HACK.hold = 0;
  if (HACK.t <= 0) { hackEnd('late'); return; }
  hackDraw();
}
function hackDraw() {
  const cv = HACK.cv, dpr = Math.min(2, devicePixelRatio || 1), W0 = cv.clientWidth, H0 = cv.clientHeight;
  if (cv.width !== Math.round(W0 * dpr) || cv.height !== Math.round(H0 * dpr)) { cv.width = Math.round(W0 * dpr); cv.height = Math.round(H0 * dpr); }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W0, H0);
  const css = getComputedStyle(HACK.el), C = n => css.getPropertyValue(n).trim();
  const sod = C('--sodium'), teal = C('--teal'), ink2 = C('--ink-2'), rowH = H0 / 3, x0 = 30, w = W0 - x0 - 4;
  g.font = `600 13px ${C('--cond')}`; g.textBaseline = 'middle';
  HACK.rows.forEach((R, i) => {
    const cy = rowH * i + rowH / 2, act = i === HACK.cur, amp = rowH * .4;
    if (act) { g.fillStyle = 'rgba(236,232,224,.05)'; g.fillRect(0, rowH * i + 2, W0, rowH - 4); }
    g.globalAlpha = R.ok || act ? 1 : .35;
    g.fillStyle = R.ok ? teal : act ? sod : ink2; g.fillText(R.ok ? '✓' : String(i + 1), 10, cy);
    g.strokeStyle = 'rgba(236,232,224,.1)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, cy); g.lineTo(x0 + w, cy); g.stroke();
    const wave = (f, a, col, lw, dash) => {
      g.strokeStyle = col; g.lineWidth = lw; g.setLineDash(dash); g.beginPath();
      for (let s = 0; s <= 120; s++) { const u = s / 120, y = cy - Math.sin(u * Math.PI * 2 * f + R.ph + HACK.ph * R.sp * 3) * amp * a / HACK_A; s ? g.lineTo(x0 + u * w, y) : g.moveTo(x0 + u * w, y); }
      g.stroke(); g.setLineDash([]);
    };
    if (R.ok) wave(R.tf, R.ta, teal, 2, []);
    else { wave(R.tf, R.ta, ink2, 1.5, [4, 4]); wave(R.f, R.a, act ? sod : ink2, 2, []); }
    if (act && HACK.hold > 0) { g.fillStyle = teal; g.fillRect(x0, rowH * (i + 1) - 5, w * HACK.hold / HACK_HOLD, 2); }
  });
  g.globalAlpha = 1;
  HACK.tEl.textContent = HACK.t.toFixed(1); HACK.tEl.classList.toggle('low', HACK.t < 5);
  HACK.bar.style.transform = `scaleX(${(HACK.t / (HACK.T || HACK_T)).toFixed(3)})`; HACK.bar.style.background = HACK.t < 5 ? 'var(--rose)' : '';
}

// 69-heist.js 的 heistUpdate 每幀呼叫（off／plan／淡出中不會進來）
function heist2Update(dt) {
  const s = heist.st;
  if (s === 'lobby') { heist.hackDone = false; heist.hackWait = 0; heist.holdT = 0; }
  if (s === 'setupB') enfStep(dt);
  else if (heist.escG && s !== 'setupB') enfDrop();
  if (s === 'drill' && player.where === 'bank' && !heist.drilling && !heist.hackDone && !HACK.on && vaultDoor.userData.open && (heist.hackWait = (heist.hackWait || 0) + dt) > 1.4) hackOpen();
  if (HACK.on) hackStep(dt);
  if (s === 'escape') { heist.heliIn = false; heist.heliLost = false; heist.landHint = false; }
  if (s === 'drive' && heist.air) heliLeg();
}
Object.assign(heistApi, {
  setupB: setupBStart, enf: () => heist.enf, escCar: () => heist.escCar, escorts: () => SQ.f.filter(f => f.on && f.esc).map(f => ({ x: f.x, z: f.z, st: f.state, stun: f.stunT, calm: f.calm, hp: f.hp })),
  refit: enfRefit, ENF_AT, garDoor, HACK, hackOpen, hackInput, hackEnd, hackSolve: () => { for (const R of HACK.rows) { R.f = R.tf; R.a = R.ta; } }, heli: () => heist.heli, getawayCar,
});
