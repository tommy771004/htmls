// ═══ 第五階段：生存模式（三座擂台） ═══
// 每座擂台的路口有一個橘色霓虹圈，走進去按 E 開始：赤蠍幫打手一波接一波從看不到的路口湧來，一波比一波多、槍越來越重、血越來越厚。
// 第 3 波起有一部分人開車來（69-squads.js 的 c.go：開到擂台 26 m 內停下放人，車窗會開槍），第 6 波起兩台；
// 第 5 波起的單數波多一架幫派直升機（69-police.js 的 spawnHeli(true)，機槍手一直掃射，打下來才算清空那一波）。
// 每清空一波給錢（第 n 波 $400 × n × 擂台倍率），補一點生命與護甲，每兩波在路口中央丟彈藥；兩波之間有 8 秒喘息。
// 倒下、被捕或走出擂台（離路口 R 公尺）就結束，最佳紀錄：鐵灣貨場存在 motors.side.surv，其他擂台在 motors.side.svb[id]。
// 擂台裡的槍聲與爆炸不會報警（69-police.js 的 crime 問 noCrime）。同時在場的打手受戰鬥員池限制（69-side.js 的 fRoom 會先收倒地最久的）。

const SURVS = [
  { id: 'yard', name: '鐵灣夜戰', i: 6, j: 6, R: 75, k: 1, desc: '貨櫃堆之間的十字路口，掩體多、退路少。' },
  { id: 'grey', name: '灰石圍城', i: 14, j: 2, R: 70, k: 1.25, desc: '國宅中庭外的路口，四面都是高樓，打手會從樓縫裡冒出來。' },
  { id: 'halo', name: '光環死鬥', i: 10, j: 4, R: 80, k: 1.5, desc: '光環廣場正中央，沒什麼地方躲，車子一台接一台衝進來。' },
];
const SURV = SURVS[0], SURV_BRK = 8;
const SURV_HEX = '#ff8a3a';
const surv = { rings: [] };
function survAt(A = SURV) { return A.at ||= { c: WP(avX(A.i), stZ(A.j)), s: WP(avX(A.i) + HR + 9, stZ(A.j) - HR - 2.6) }; }
const survBest = A => A.id === 'yard' ? motors.side.surv : motors.side.svb[A.id] || 0;
function survIdle() {
  SURVS.forEach((A, k) => {
    const s = survAt(A).s, m = surv.rings[k] ||= neonRing(0xff8a3a, 1.3);
    if (side.act || player.where !== 'out' || Math.hypot(s.x - pX(), s.z - pZ()) > 250) { m.visible = false; return; }
    ringAt(m, s.x, s.z, 1, 0, 1.35);
    m.rotation.y = uTimeNow() * .8;
    m.material.opacity = .5 + .25 * Math.sin(uTimeNow() * 3);
  });
}
ctxHooks.unshift(p => {   // 排在最前面，路邊停的車不會搶走提示
  if (p.mode !== 'walk' || p.where !== 'out' || side.act) return null;
  for (const A of SURVS) { const s = survAt(A).s; if (Math.hypot(p.x - s.x, p.z - s.z) < 2.6) return { key: 'E', text: `生存模式 <i>· ${A.name}</i>`, fn: () => survBoard(A) }; }
  return null;
});
function survBoard(A) {
  const best = survBest(A);
  dialog(`生存模式 · ${A.name}`, `${A.desc}${GANG_NAME}的打手會一波接一波湧進來，撐越久錢越多。倒下或走出擂台就結束。${best ? `最佳紀錄：撐過 ${best} 波。` : ''}`, [
    { t: '開始', fn: () => { closeDialog(); const b = sideBusy(); if (b) { toast(b); return; } survStart(A); } },
    { t: '算了', fn: closeDialog },
  ]);
}
function survStart(A = SURV) {
  const c = survAt(A).c;
  const a = {
    kind: 'surv', A, name: '生存模式', label: `<b>生存模式</b> · ${A.name}`, wave: 0, cleared: 0, queue: 0, cars: 0, heli: null, brk: 5, spawnT: 0, kills: 0, pay: 0,
    step: dt => survStep(a, dt), hud: () => survHud(a), mark: () => ({ name: A.name, x: c.x, y: 2, z: c.z, where: 'out' }),
    fail: why => survOver(a, why), clear: () => { turfFree(a); if (a.heli && W.heli === a.heli && !a.heli.fall) a.heli.leave = true; },
    noCrime: (x, z) => Math.hypot(x - c.x, z - c.z) < A.R + 30,
  };
  sideStart(a);
  sfx.ability(); toast(`${A.name}：撐住`);
}
const survHeliUp = a => !!a.heli && W.heli === a.heli && !a.heli.fall && !a.heli.leave;
const survAlive = a => SQ.f.filter(f => fUp(f) && f.grp === a).length + (survHeliUp(a) ? 1 : 0);
function survGuns(w) { return w >= 5 ? ['rifle', 'smg', 'shotgun', 'rifle'] : w >= 3 ? ['smg', 'pistol', 'shotgun'] : w >= 2 ? ['pistol', 'smg'] : ['pistol']; }
function survStep(a, dt) {
  const A = a.A, c = survAt(A).c;
  if (Math.hypot(pX() - c.x, pZ() - c.z) > A.R) { survOver(a, '離開了擂台'); return; }
  if (a.heli && a.heli.fall && !a.heliDown) { a.heliDown = true; a.kills++; toast('直升機打下來了'); }
  if (a.brk > 0) {
    if ((a.brk -= dt) > 0) return;
    a.wave++; a.queue = 3 + a.wave * 2; a.spawnT = 0;
    a.cars = a.wave >= 6 ? 2 : a.wave >= 3 ? 1 : 0;
    if (a.wave >= 5 && a.wave % 2 && (!W.heli || W.heli.leave)) {
      if (W.heli) dropHeli();
      a.heli = spawnHeli(true); a.heliDown = false; a.heli.hp = 900 + a.wave * 60;
      toast(`第 ${a.wave} 波 · ${GANG_NAME}的直升機來了`);
    } else toast(`第 ${a.wave} 波`);
    sfx.beep();
    return;
  }
  const alive = survAlive(a);
  // 開車來的：一台三個人，從 90–160 m 外的路口出發
  if (a.cars > 0 && a.queue >= 3) {
    const sp = spawnSpot(90, 160);
    if (sp) {
      fRoom(3);
      const car = squadCar('gang', GANG_TYPES[(a.wave + a.cars) % 3], sp.x, sp.z, sp.yaw, 10), guns = survGuns(a.wave);
      carRiders(car, 3, guns);
      car.go = { x: c.x, z: c.z }; car.t = 0; car.grp = a;
      for (const f of car.riders) { f.grp = a; f.hp *= 1 + (a.wave - 1) * .1; f.onDown = () => a.kills++; }
      a.queue -= car.riders.length;
      if (a.cars === (a.wave >= 6 ? 2 : 1)) toast(`${GANG_NAME}開車殺過來了（小地圖紅點）`);
    }
    a.cars--;
    return;
  }
  if (a.queue > 0 && (a.spawnT -= dt) <= 0 && alive < 4 + a.wave) {
    a.spawnT = .7;
    fRoom(2);
    const sp = spawnSpot(35, 80), guns = survGuns(a.wave);
    const f = sp && fSpawn('gang', sp.x, sp.z, sp.yaw, { gun: guns[a.queue % guns.length] });
    if (f) { f.grp = a; f.hp *= 1 + (a.wave - 1) * .1; f.onDown = () => a.kills++; a.queue--; }
    return;
  }
  if (a.queue || alive) return;
  // 清空一波
  a.cleared = a.wave;
  const pay = Math.round(400 * a.wave * A.k / 10) * 10;
  a.pay += pay; earn(pay, `撐過第 ${a.wave} 波`);
  life.hp = Math.min(life.max, life.hp + 35); life.armor = Math.min(100, life.armor + 25);
  if (a.wave % 2 === 0) { dropPickup(c.x + 2, c.z, 'rifle'); dropPickup(c.x - 2, c.z, 'shotgun'); toast('路口中央有彈藥'); }
  survRecord(a);
  a.brk = SURV_BRK;
}
function survRecord(a) {
  if (a.cleared <= survBest(a.A)) return;
  if (a.A.id === 'yard') motors.side.surv = a.cleared; else motors.side.svb[a.A.id] = a.cleared;
  saveMotors();
}
function survHud(a) {
  if (a.brk > 0) return { text: a.wave ? `第 ${a.wave} 波清空 · 下一波` : '準備', bar: a.brk / SURV_BRK * 100, num: `${Math.ceil(a.brk)} 秒` };
  return { text: `第 ${a.wave} 波 · 打倒${GANG_NAME}${survHeliUp(a) ? '與直升機' : ''}`, bar: -1, num: `${survAlive(a) + a.queue} ${survHeliUp(a) ? '個目標' : '人'}` };
}
function survOver(a, why) {
  sideEnd();
  survRecord(a);
  sideDone('SURVIVAL', `生存模式 · ${a.A.name}（${why}）`, [['撐過', `${a.cleared} 波`], ['擊倒', `${a.kills} 人`], ['獎金', money(a.pay)], ['最佳紀錄', `${survBest(a.A)} 波`]], 0);
}
// 小地圖：起點橘點；進行中畫出擂台的邊界
function survMini(ctx, P2, zoom) {
  const a = side.act;
  if (a && a.kind === 'surv') {
    const C = survAt(a.A).c, [x, y] = P2(C.x, C.z), [x2] = P2(C.x + a.A.R, C.z);
    ctx.strokeStyle = SURV_HEX; ctx.lineWidth = 2 / zoom; ctx.beginPath(); ctx.arc(x, y, Math.abs(x2 - x), 0, 7); ctx.stroke();
    return;
  }
  ctx.fillStyle = SURV_HEX;
  for (const A of SURVS) { const s = survAt(A).s, [x, y] = P2(s.x, s.z); ctx.beginPath(); ctx.arc(x, y, 5 / zoom * 1.4, 0, 7); ctx.fill(); }
}
function survBlips(add) {
  for (const A of SURVS) {
    const s = survAt(A).s, best = survBest(A);
    add('surv', { name: `生存模式 · ${A.name}`, txt: '生', x: s.x, z: s.z, type: '生存模式', rows: [['獎金', `第 n 波 ${money(Math.round(400 * A.k))} × n`], ['最佳紀錄', best ? `${best} 波` : '—']], desc: `${A.desc}走進路口的橘色霓虹圈按 E 開始，倒下或走出擂台就結束。` });
  }
}

// 測試 API（window.__nc.gta.surv）
const survApi = {
  SURV, SURVS, at: id => survAt(SURVS.find(A => A.id === id) || SURV), start: id => survStart(SURVS.find(A => A.id === id) || SURV),
  act: () => side.act && side.act.kind === 'surv' ? side.act : null,
  // 直接跳到第 n 波的開頭（下一幀開打）
  wave: n => { const a = side.act; if (a && a.kind === 'surv') { a.wave = n - 1; a.brk = .01; } },
  wipe: () => { const a = side.act; if (a) { a.queue = 0; a.cars = 0; for (const f of SQ.f) if (fUp(f) && f.grp === a) fHit(f, 999, 0, 1, true); if (survHeliUp(a)) heliHit(1e5, true); } },
};
