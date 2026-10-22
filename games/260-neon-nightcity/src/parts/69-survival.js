// ═══ 第五階段：生存模式「鐵灣夜戰」 ═══
// 鐵灣貨場的路口有一個橘色霓虹圈，走進去按 E 開始：赤蠍幫打手一波接一波從看不到的路口湧來，一波比一波多、槍越來越重、血越來越厚。
// 每清空一波給錢（第 n 波 $400 × n），補一點生命與護甲，每兩波在路口中央丟彈藥；兩波之間有 8 秒喘息。
// 倒下、被捕或走出貨場（離路口 75 m）就結束，最佳紀錄存在 motors.side.surv。貨場裡的槍聲與爆炸不會報警（69-police.js 的 crime 問 noCrime）。
// 同時在場的打手受戰鬥員池限制（69-side.js 的 fRoom 會先收倒地最久的）。

const SURV = { name: '鐵灣夜戰', i: 6, j: 6, R: 75, brk: 8 };
const SURV_HEX = '#ff8a3a';
const surv = { ring: null };
function survAt() { return SURV.at ||= { c: WP(avX(SURV.i), stZ(SURV.j)), s: WP(avX(SURV.i) + HR + 9, stZ(SURV.j) - HR - 2.6) }; }
function survIdle() {
  surv.ring ||= neonRing(0xff8a3a, 1.3);
  const s = survAt().s, m = surv.ring;
  if (side.act || player.where !== 'out' || Math.hypot(s.x - pX(), s.z - pZ()) > 250) { m.visible = false; return; }
  ringAt(m, s.x, s.z, 1, 0, 1.35);
  m.rotation.y = uTimeNow() * .8;
  m.material.opacity = .5 + .25 * Math.sin(uTimeNow() * 3);
}
ctxHooks.unshift(p => {   // 排在最前面，路邊停的車不會搶走提示
  if (p.mode !== 'walk' || p.where !== 'out' || side.act) return null;
  const s = survAt().s;
  return Math.hypot(p.x - s.x, p.z - s.z) < 2.6 ? { key: 'E', text: `生存模式 <i>· ${SURV.name}</i>`, fn: survBoard } : null;
});
function survBoard() {
  const best = motors.side.surv;
  dialog(`生存模式 · ${SURV.name}`, `貨場裡會一波接一波湧進${GANG_NAME}的打手，撐越久錢越多。倒下或走出貨場就結束。${best ? `最佳紀錄：撐過 ${best} 波。` : ''}`, [
    { t: '開始', fn: () => { closeDialog(); const b = sideBusy(); if (b) { toast(b); return; } survStart(); } },
    { t: '算了', fn: closeDialog },
  ]);
}
function survStart() {
  const c = survAt().c;
  const a = {
    kind: 'surv', name: '生存模式', label: `<b>生存模式</b> · ${SURV.name}`, wave: 0, cleared: 0, queue: 0, brk: 5, spawnT: 0, kills: 0, pay: 0,
    step: dt => survStep(a, dt), hud: () => survHud(a), mark: () => ({ name: SURV.name, x: c.x, y: 2, z: c.z, where: 'out' }),
    fail: why => survOver(a, why), clear: () => turfFree(a),
    noCrime: (x, z) => Math.hypot(x - c.x, z - c.z) < SURV.R + 30,
  };
  sideStart(a);
  sfx.ability(); toast(`${SURV.name}：撐住`);
}
const survAlive = a => SQ.f.filter(f => fUp(f) && f.grp === a).length;
function survGuns(w) { return w >= 5 ? ['rifle', 'smg', 'shotgun', 'rifle'] : w >= 3 ? ['smg', 'pistol', 'shotgun'] : w >= 2 ? ['pistol', 'smg'] : ['pistol']; }
function survStep(a, dt) {
  const c = survAt().c;
  if (Math.hypot(pX() - c.x, pZ() - c.z) > SURV.R) { survOver(a, '離開了貨場'); return; }
  if (a.brk > 0) {
    if ((a.brk -= dt) > 0) return;
    a.wave++; a.queue = 3 + a.wave * 2; a.spawnT = 0;
    sfx.beep(); toast(`第 ${a.wave} 波`);
    return;
  }
  const alive = survAlive(a);
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
  const pay = 400 * a.wave;
  a.pay += pay; earn(pay, `撐過第 ${a.wave} 波`);
  life.hp = Math.min(life.max, life.hp + 35); life.armor = Math.min(100, life.armor + 25);
  if (a.wave % 2 === 0) { dropPickup(c.x + 2, c.z, 'rifle'); dropPickup(c.x - 2, c.z, 'shotgun'); toast('路口中央有彈藥'); }
  if (a.cleared > motors.side.surv) { motors.side.surv = a.cleared; saveMotors(); }
  a.brk = SURV.brk;
}
function survHud(a) {
  if (a.brk > 0) return { text: a.wave ? `第 ${a.wave} 波清空 · 下一波` : '準備', bar: a.brk / SURV.brk * 100, num: `${Math.ceil(a.brk)} 秒` };
  return { text: `第 ${a.wave} 波 · 打倒${GANG_NAME}`, bar: -1, num: `${survAlive(a) + a.queue} 人` };
}
function survOver(a, why) {
  sideEnd();
  if (a.cleared > motors.side.surv) { motors.side.surv = a.cleared; saveMotors(); }
  sideDone('SURVIVAL', `生存模式 · ${SURV.name}（${why}）`, [['撐過', `${a.cleared} 波`], ['擊倒', `${a.kills} 人`], ['獎金', money(a.pay)], ['最佳紀錄', `${motors.side.surv} 波`]], 0);
}
// 小地圖：起點橘點；進行中畫出貨場的邊界
function survMini(ctx, P2, zoom) {
  const A = survAt(), a = side.act;
  if (a && a.kind === 'surv') {
    const [x, y] = P2(A.c.x, A.c.z), [x2] = P2(A.c.x + SURV.R, A.c.z);
    ctx.strokeStyle = SURV_HEX; ctx.lineWidth = 2 / zoom; ctx.beginPath(); ctx.arc(x, y, Math.abs(x2 - x), 0, 7); ctx.stroke();
    return;
  }
  const [x, y] = P2(A.s.x, A.s.z); ctx.fillStyle = SURV_HEX; ctx.beginPath(); ctx.arc(x, y, 5 / zoom * 1.4, 0, 7); ctx.fill();
}
function survBlips(add) {
  const s = survAt().s;
  add('surv', { name: `生存模式 · ${SURV.name}`, txt: '生', x: s.x, z: s.z, type: '生存模式', rows: [['獎金', `第 n 波 ${money(400)} × n`], ['最佳紀錄', motors.side.surv ? `${motors.side.surv} 波` : '—']], desc: `走進鐵灣貨場路口的橘色霓虹圈按 E 開始。${GANG_NAME}的打手一波比一波多，倒下或走出貨場就結束。` });
}

// 測試 API（window.__nc.gta.surv）
const survApi = { SURV, at: survAt, start: survStart, act: () => side.act && side.act.kind === 'surv' ? side.act : null, wipe: () => { const a = side.act; if (a) { a.queue = 0; for (const f of SQ.f) if (fUp(f) && f.grp === a) fHit(f, 999, 0, 1, true); } } };
