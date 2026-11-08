// 64 Hz 主邏輯：玩家、Bot、回合、投擲物。
import { G, RULES, WEAPONS } from './state.js';
import { LAYOUT } from '../map/layout.js';
import { input } from '../core/input.js';
import { you, tickPlayer, applyCamera, teleport } from './player.js';
import { fire, tickWeapon, startReload, recoilTable, maxSpeed, RECOIL_LAST, LAND_T, drawTime } from './weapons.js';
import { tickBot, plan } from './bots.js';
import { tickNades, throwNade } from './grenades.js';
import { endRound, nextRound, plantDone, defuseDone, checkElim, showCharge, dropCharge, pickCharge } from './round.js';
import { play as anim, chargePos, fpHide } from './soldiers.js';
import { vm, selectWeapon, updateViewmodel, muzzleTo, fireKick, startReloadAnim, stopReloadAnim, startInspect, hideViewmodel } from './viewmodel.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { NEW_GUNS } from './guns/index.js';

const TMP_VEC_MZ = new Vector3();
const PORT = { ks: 0.34, ar5: 0.42, l40: 0.7, s8: 0.45, v11: 0.14, p9: 0.1, r50: 0.12 };   // 槍口到拋殼口
const FLASH = { l40: 1.5, s8: 1.5, v11: 0.8, p9: 1.4, r50: 1.4 };   // 第一人稱火光倍率，沒列的是 1
const BIG_CASE = { s8: true, l40: true };
for (const g of NEW_GUNS) { PORT[g.id] = g.port; FLASH[g.id] = g.flash; if (g.bigCase) BIG_CASE[g.id] = true; }
import { muzzle, casing } from '../fx/particles.js';
import { play as sfx } from '../audio/sfx.js';
import { DRAW, AFTER_SHOT } from '../audio/cues.js';
import { muzzleSmoke } from '../fx/particles.js';
import { SYNC, netPre, netPost, netAct } from '../net/sync.js';
import { world } from './weapons.js';

const S = LAYOUT.sites;
const SCOPE_FOV = 0.32, SCOPE_SENS = Math.tan(SCOPE_FOV / 2) / Math.tan(Math.PI / 4);   // 開鏡時畫面轉速和腰射一樣
const inSite = (x, y, z) => x >= S.A.x0 && x <= S.A.x1 && z >= S.A.z0 && z <= S.A.z1 && Math.abs(y - S.A.y) < 3 ? 'A' : x >= S.B.x0 && x <= S.B.x1 && z >= S.B.z0 && z <= S.B.z1 && Math.abs(y - S.B.y) < 3 ? 'B' : '';
let rezoom = false, fovNow = Math.PI / 2, swayT = 0, swayA = 0, heat = 0, smokeT = 0;   // 栓動後自動回鏡、鏡頭視角、開鏡晃動、槍管熱度（槍口冒煙）
const SCOPE_IN = 0.3;   // 開鏡到完全穩定的秒數
let lastSlot = 'p9', fireHeld = false, altHeld = false, zoneT = 0, beepT = 0, stepT = 0, kickP = 0, kickY = 0, kickP0 = 0, kickY0 = 0, nadeHeld = false;

function setCur(m, id) {
  if (!id || m.cur === id) return;
  lastSlot = m.cur; m.cur = id; m.reloadT = 0; m.fireT = drawTime(WEAPONS[id]); G.scoped = false; rezoom = false; heat = 0;   // 拔出前不能開火
  selectWeapon(id, m.fireT);
  if (WEAPONS[id]?.id && !WEAPONS[id].nade && id !== 'charge') sfx(DRAW(WEAPONS[id]), m.x, m.y, m.z);
}

/** 手上真的有這把：lastSlot 可能指向已賣掉、丟完或上一回合的武器。 */
const owns = (m, id) => id === 'knife' || id === m.primary || id === m.secondary || m.nades.includes(id) || (id === 'charge' && m.hasCharge);
/** Q 鍵：回上一把；上一把已經不在手上就換到其他還有的武器。 */
function quickSwap(m) {
  if (lastSlot !== m.cur && owns(m, lastSlot)) { setCur(m, lastSlot); return; }
  setCur(m, m.primary && m.primary !== m.cur ? m.primary : m.secondary && m.secondary !== m.cur ? m.secondary : 'knife');
}

function tickMe(dt, cam) {
  const m = G.me;
  if (!m.alive) {   // 陣亡觀戰：左鍵下一個、右鍵上一個、空白鍵切第一／第三人稱
    you.frozen = true;
    if (input.firePress > 0) { input.firePress = 0; specNext(1); }
    if (input.alt && !altHeld) specNext(G.agents.length - 1);
    altHeld = input.alt;
    if (input.jumpPress) { input.jumpPress = false; G.specFP = !G.specFP; dead.snap = true; }
    return;
  }
  if (G.paused) { input.fire = false; input.firePress = 0; input.use = false; }   // 連線時暫停選單開著遊戲照跑，人站著不動
  you.frozen = G.paused || G.phase === 'buy' || G.phase === 'menu' || G.plantP > 0 || G.defuseP > 0;
  you.speedK = (WEAPONS[m.cur]?.speedK ?? 1) * (m.slowT > 0 ? 0.55 : 1) * (G.scoped ? 0.55 : 1);   // 開鏡走得慢
  you.sensK = G.scoped ? SCOPE_SENS * input.scopeSens : 1;
  tickPlayer(dt);
  const wasG = m.ground;
  m.px = m.x; m.py = m.y; m.pz = m.z; m.x = you.x; m.y = you.y; m.z = you.z; m.vx = you.vx; m.vy = you.vy; m.vz = you.vz;
  m.yaw = you.yaw; m.pitch = you.pitch; m.ground = you.ground; m.crouch = you.crouch; m.eye = you.eye; m.h = you.h; m.scoped = G.scoped;
  // 落地：騰空超過 0.2 s（跳躍、從高處落下；下樓梯的短暫離地不算）才有散布懲罰與減速
  if (!m.ground) m.airT = (m.airT || 0) + dt;
  else if (!wasG) { if (m.airT > 0.2) { m.landT = LAND_T; you.vx *= 0.8; you.vz *= 0.8; m.vx = you.vx; m.vz = you.vz; } m.airT = 0; }
  tickWeapon(m, dt);

  if (input.slot) {
    const s = input.slot; input.slot = 0;
    if (s === 1) setCur(m, m.primary); else if (s === 2) setCur(m, m.secondary); else if (s === 3) setCur(m, 'knife');
    else if (s === 4) { if (m.nades.length) setCur(m, m.nades[0]); } else if (s === 5) { if (m.hasCharge) setCur(m, 'charge'); }
    else if (s === 9) quickSwap(m);
  }
  if (input.wheel) { const list = [m.primary, m.secondary, 'knife', ...m.nades, m.hasCharge && 'charge'].filter(Boolean), i = list.indexOf(m.cur); setCur(m, list[(i + (input.wheel > 0 ? 1 : list.length - 1)) % list.length]); input.wheel = 0; }
  if (input.reload) { if (startReload(m)) { const r = WEAPONS[m.cur]; startReloadAnim(r.shell ? r.shell * Math.min(r.mag - m.ammo[m.cur], m.rsv[m.cur]) : m.reloadT, m.reloadTac); } }
  if (input.inspect) { input.inspect = false; startInspect(); }
  // 開鏡：拔槍中、拉栓中不能開；拉栓時按右鍵是取消「拉完自動回鏡」
  if (input.alt && !altHeld && WEAPONS[m.cur]?.scope) { if (m.fireT > 0 && !G.scoped) rezoom = false; else G.scoped = !G.scoped; }
  altHeld = input.alt;
  if (rezoom && m.fireT <= 0) { rezoom = false; if (WEAPONS[m.cur]?.scope) G.scoped = true; }
  m.scopeT = G.scoped ? Math.min(1, (m.scopeT || 0) + dt / SCOPE_IN) : 0;
  // 開鏡晃動：呼吸般的慢擺，蹲下減半，移動與剛落地時變大。鏡頭和子彈都加，準星中心就是彈著點
  swayT += dt;
  const sa = G.scoped ? 0.0011 * (m.crouch ? 0.5 : 1) + Math.min(0.006, Math.hypot(m.vx, m.vz) * 0.0016) + (m.landT > 0 ? 0.004 : 0) : 0;
  swayA += (sa - swayA) * Math.min(1, dt * 4);
  G.swayY = Math.sin(swayT * 0.83) * swayA * 1.3; G.swayP = Math.sin(swayT * 1.37 + 0.6) * swayA;

  const w = WEAPONS[m.cur], live = G.phase === 'live' || G.phase === 'planted' || G.phase === 'post';
  if (input.drop) { input.drop = false; if (m.hasCharge && !G.charge && G.phase !== 'buy') { if (m.cur === 'charge') setCur(m, m.primary ?? m.secondary); if (SYNC.role === 'client') netAct(['g']); else dropCharge(m, 1.1); } }
  const press = input.firePress > 0; input.firePress = 0;
  if (w?.nade) {
    if (input.fire || press) nadeHeld = true;
    else if (nadeHeld && live && m.fireT <= 0) {   // 拔出前放開，等拔好再丟
      nadeHeld = false; fireKick(); throwNade(m, w.id, m.yaw, m.pitch + 0.1); m.nades.splice(m.nades.indexOf(w.id), 1);
      setCur(m, m.nades[0] ?? m.primary ?? m.secondary);
    }
  } else if ((input.fire || press) && live && w) {
    if ((w.auto || press || !fireHeld) && fire(m, m.yaw + G.swayY, m.pitch + G.punch + G.swayP, cam.position)) {
      fireKick();
      if (w.range > 3 && vm.cur?.muzzle) {
        const q = muzzleTo(TMP_VEC_MZ), v = cam.getViewMatrix().m, fx0 = v[2], fy0 = v[6], fz0 = v[10], rx = v[0], rz = v[8];
        muzzle(q.x, q.y, q.z, fx0, fy0, fz0, FLASH[m.cur] ?? 1);
        const back = PORT[m.cur] ?? 0.2, sp = 1.7 + Math.random() * 0.7;
        casing(q.x - fx0 * back + rx * 0.02, q.y - fy0 * back + 0.02, q.z - fz0 * back + rz * 0.02, rx * sp + m.vx, 1.5 + Math.random() * 0.6, rz * sp + m.vz, BIG_CASE[m.cur] === true);
      }
      if (w.scope && AFTER_SHOT[w.id]) { if (G.scoped) rezoom = true; G.scoped = false; }   // 栓動：拉栓時退出瞄準鏡，拉完自動回鏡
      if (w.range > 3) heat = Math.min(12, heat + (w.auto ? 1 : 2.5));
      if (w.shell) stopReloadAnim();   // 開火中斷單發裝填
      if (!w.auto) { /* 栓動後短暫不可瞄 */ }
    }
  }
  fireHeld = input.fire; vm.dry = (m.ammo[m.cur] | 0) <= 0;
  // 槍口冒煙：連發或重槍打完、停火後，槍口飄一縷煙，熱度越高越久
  if (heat > 0) {
    if (m.burstT <= 0 && heat > 3 && vm.cur?.muzzle && vm.swap <= 0) { smokeT -= dt; if (smokeT <= 0) { smokeT = 0.05; const q = muzzleTo(TMP_VEC_MZ); muzzleSmoke(q.x, q.y, q.z, heat / 12); } }
    heat = Math.max(0, heat - dt * 2.2);
  }
  if (m.reloadT > 0 && vm.reload <= 0 && !w?.shell) startReloadAnim(m.reloadT, m.reloadTac, m.reloadDur);   // 打空自動換彈也要播；單發裝填在按下時已排好全程
  // 畫面後座跟彈道索引走：索引是小數（停火後逐漸回退），相鄰兩發內插，回位才會平順；中彈上抬 G.punch 疊在上面
  const tbl = recoilTable(m), bf = Math.min(Math.max(0, m.burst - 1), RECOIL_LAST - 1), i0 = bf | 0, fr = bf - i0, on = Math.min(1, m.burst);
  const tp = G.swayP + (tbl ? (tbl[i0 * 2] + (tbl[i0 * 2 + 2] - tbl[i0 * 2]) * fr) * 0.55 * on : 0) + G.punch, ty = tbl ? (tbl[i0 * 2 + 1] + (tbl[i0 * 2 + 3] - tbl[i0 * 2 + 1]) * fr) * 0.55 * on + G.swayY : G.swayY;
  const kk = Math.min(1, dt * (m.recT < 0.12 || G.punch > 0.002 ? 40 : 16));
  if (G.punch > 0) G.punch = Math.max(0, G.punch - dt * (0.01 + G.punch * 7));
  kickP0 = kickP; kickY0 = kickY; kickP += (tp - kickP) * kk; kickY += (ty - kickY) * kk;   // 留上一 tick 的值，畫面幀內插

  // 安裝／拆除
  const site = inSite(m.x, m.y, m.z), c = G.charge;
  if (input.use && m.hasCharge && site && G.phase === 'live' && m.ground) { G.plantP += dt / RULES.plantTime; if (G.plantP >= 1) { G.plantP = 0; if (SYNC.role === 'client') netAct(['p', site]); else plantDone(m, site); setCur(m, m.primary ?? m.secondary); } }
  else G.plantP = 0;
  if (input.use && c && m.team === 1 && Math.hypot(c.x - m.x, c.z - m.z, c.y - m.y) < 2 && G.phase === 'planted') { G.defuseP += dt / (m.kit ? RULES.defuseKit : RULES.defuseTime); if (G.defuseP >= 1) { G.defuseP = 0; if (SYNC.role === 'client') netAct(['d']); else defuseDone(m); } }
  else G.defuseP = 0;
  // 腳步
  const sp = Math.hypot(m.vx, m.vz);
  if (m.ground && sp > 3.6 && !input.walk) { stepT -= dt * sp; if (stepT <= 0) { stepT = 7; sfx('step', m.x, m.y, m.z); } }
}

function tickRound(dt, cam) {
  if (G.phase === 'menu' || G.phase === 'over') return;
  G.time -= dt;
  if (G.bannerT > 0) G.bannerT -= dt;
  if (G.phase === 'buy') { if (G.time <= 0) { G.phase = 'live'; G.time = RULES.roundTime; G.banner = '開始'; G.bannerT = 1; } return; }
  if (G.phase === 'live') {
    if (G.time <= 11 && G.canBuy) G.canBuy = false;
    if (RULES.roundTime - G.time > 20) G.canBuy = false;
    if (G.time <= 0) endRound(1, '時間到');
  } else if (G.phase === 'planted') {
    const c = G.charge; c.t = G.time; beepT -= dt;
    if (beepT <= 0) { beepT = Math.max(0.15, c.t / 22); sfx('beep', c.x, c.y, c.z); }
    if (G.time <= 0) { for (const a of G.agents) if (a.alive && Math.hypot(a.x - c.x, a.y - c.y, a.z - c.z) < 14) a.hp = 0, a.alive = false; endRound(0, '裝藥引爆'); }
  } else if (G.phase === 'post') { if (G.time <= 0) nextRound(); }
}

function botObjectives(dt) {
  const c = G.charge;
  for (let i = 0; i < G.agents.length; i++) {
    const a = G.agents[i]; if (!a.bot) continue;
    if (!a.alive) { if (a.bot.plantT > 0) { a.bot.plantT = 0; chargePos.on = !!G.charge || G.drop.on; } continue; }
    const site = inSite(a.x, a.y, a.z); a.onSite = !!site;
    if (a.hasCharge && site && !c && G.phase === 'live') { a.bot.plantT += dt; if (a.bot.plantT >= RULES.plantTime) { a.bot.plantT = 0; plantDone(a, site); } else if (!chargePos.on) showCharge(a); }
    else { if (a.bot.plantT > 0) chargePos.on = !!G.charge || G.drop.on; a.bot.plantT = 0; }
    if (c && a.team === 1 && G.phase === 'planted' && Math.hypot(c.x - a.x, c.z - a.z) < 1.6 && Math.hypot(a.vx, a.vz) < 0.3 && !(a.bot.target?.alive)) { a.bot.defT = (a.bot.defT || 0) + dt; if (a.bot.defT >= (a.kit ? RULES.defuseKit : RULES.defuseTime)) { a.bot.defT = 0; defuseDone(a); } }
    else if (a.bot) a.bot.defT = 0;
  }
}

/** 連線的客戶端：階段與勝負由主機判，這裡只在快照之間自己倒數、響裝藥的嗶聲。 */
function clientRound(dt) {
  if (G.bannerT > 0) G.bannerT -= dt;
  if (G.phase === 'menu' || G.phase === 'over') return;
  if (G.time > 0) G.time -= dt;
  const c = G.charge;
  if (G.phase === 'planted' && c) { beepT -= dt; if (beepT <= 0) { beepT = Math.max(0.15, G.time / 22); sfx('beep', c.x, c.y, c.z); } }
}

export function tick(dt, cam) {
  if (!G.me) return;
  const net = SYNC.role;
  if (G.paused && !net) return;   // 連線對戰不會暫停
  if (net) netPre(dt, cam);
  if (net === 'client') clientRound(dt); else tickRound(dt, cam);
  if (G.phase === 'over' || G.phase === 'menu') { if (net) netPost(); return; }
  tickMe(dt, cam);
  if (net !== 'client') {   // Bot、裝藥的安裝與撿起只在主機（或單機）跑
    for (let i = 0; i < G.agents.length; i++) { const a = G.agents[i]; if (a.bot && a.alive) tickBot(a, dt, cam.position); }
    botObjectives(dt);
    pickCharge();
  }
  // 別人的腳步聲（玩家自己的在 tickMe）：跑步才有聲音，靜步、蹲走沒有；Bot 靠同一個門檻判斷聽不聽得到
  for (let i = 0; i < G.agents.length; i++) {
    const a = G.agents[i]; if (a === G.me || !a.alive || !a.ground) continue;
    const sp = Math.hypot(a.vx, a.vz); if (sp <= 3.6 || a.crouch) continue;
    a.stepT -= dt * sp; if (a.stepT <= 0) { a.stepT = 7; sfx('step', a.x, a.y, a.z); }
  }
  tickNades(dt);
  for (let i = 0; i < G.agents.length; i++) { const a = G.agents[i]; if (a.fell && a.alive) { a.fell = false; } if (a.seen > 0) a.seen -= dt; }
  if (plan.alertT > 0) plan.alertT -= dt;
  if (G.flash > 0) G.flash = Math.max(0, G.flash - dt * 0.6);
  if (G.hitMark > 0) G.hitMark = Math.max(0, G.hitMark - dt * 6);
  if (G.dmgT > 0) G.dmgT = Math.max(0, G.dmgT - dt * 1.2);
  for (let i = G.feed.length - 1; i >= 0; i--) G.feed[i].t -= dt;
  for (let i = G.log.length - 1; i >= 0; i--) G.log[i].t -= dt;
  zoneT -= dt;
  if (zoneT <= 0) {
    zoneT = 0.3; const m = G.me; G.zone = '';
    for (const c of LAYOUT.callouts) if (m.x >= c.x0 && m.x <= c.x1 && m.z >= c.z0 && m.z <= c.z1 && (c.y1 === undefined || m.y < c.y1)) { G.zone = c.name; break; }
  }
  if (net) netPost();
}

// ── 陣亡鏡頭：先在倒下的位置轉向擊殺者，DEATH_HOLD 秒後跟在隊友背後觀戰（左鍵換人）；隊友全滅就看擊殺者 ──
const DEATH_HOLD = 1.2, CHASE = 3.1, CHASE_UP = 0.55;
const dead = { t: 0, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, cx: 0, cy: 0, cz: 0, snap: true, last: -1, wid: '', rl: false };
const RAY_C = new Vector3(), RAY_D = new Vector3();
const wrapPi = d => d > Math.PI ? d - 2 * Math.PI : d < -Math.PI ? d + 2 * Math.PI : d;
/** 換到下一個還活著的隊友；沒有隊友就看擊殺者。回傳觀戰對象或 null。 */
function specNext(step) {
  const A = G.agents, m = G.me, n = A.length, from = G.specIdx < 0 ? A.indexOf(m) : G.specIdx;
  for (let k = step; k <= n; k++) { const i = (from + k) % n, a = A[i]; if (a !== m && a.alive && a.team === m.team) { G.specIdx = i; return a; } }
  const kl = G.killer; if (kl && kl.alive) { G.specIdx = A.indexOf(kl); return kl; }
  G.specIdx = -1; return null;
}
function mateAlive() { const A = G.agents, m = G.me; for (let i = 0; i < A.length; i++) if (A[i] !== m && A[i].alive && A[i].team === m.team) return true; return false; }
function specTarget() {
  const a = G.agents[G.specIdx], m = G.me;
  if (a && a.alive && a !== m && (a.team === m.team || a === G.killer && !mateAlive())) return a;
  return specNext(1);
}
/** 第一人稱觀戰對象開槍：火光從第一人稱槍口出來、槍跟著後座。weapons.js 的 fire／shotFx 先問這裡。 */
world.specShot = (a, dx, dy, dz) => {
  if (a !== G.specView || !vm.cur) return false;
  fireKick(); if (vm.cur.muzzle) { const q = muzzleTo(TMP_VEC_MZ); muzzle(q.x, q.y, q.z, dx, dy, dz, FLASH[a.cur] ?? 1); }
  return true;
};
function endSpecView() { if (G.specView) { G.specView = null; fpHide.s = null; hideViewmodel(); dead.wid = ''; } }
function deathCam(cam, dt) {
  const m = G.me;
  if (dead.t === 0) { dead.x = you.x; dead.y = you.y + you.eye; dead.z = you.z; dead.yaw = you.yaw; dead.pitch = you.pitch; dead.snap = true; dead.last = -1; dead.wid = ''; }
  dead.t += dt; G.deadT = dead.t;
  fovNow = Math.PI / 2; cam.fov = fovNow;
  if (dead.t < DEATH_HOLD) {
    // 倒下：視線降到地面附近，轉頭看向擊殺者
    const k = G.killer, drop = Math.min(1, dead.t / 0.45), y = dead.y - (dead.y - (you.y + 0.55)) * drop * drop;
    if (k) {
      const dx = k.rx - dead.x, dz = k.rz - dead.z, ty = Math.atan2(dx, dz), tp = Math.atan2(k.ry + (k.eye || 1.6) - y, Math.hypot(dx, dz)), e = Math.min(1, dt * 5);
      dead.yaw += wrapPi(ty - dead.yaw) * e; dead.pitch += (tp - dead.pitch) * e;
    }
    cam.position.copyFromFloats(dead.x, y, dead.z); cam.rotation.copyFromFloats(-dead.pitch, dead.yaw, 0);
    cam.computeWorldMatrix(true); return;
  }
  const t = specTarget();
  if (!t) { endSpecView(); cam.computeWorldMatrix(true); return; }   // 沒人可看：停在原地
  const ti = G.agents.indexOf(t); if (ti !== dead.last) { dead.last = ti; dead.snap = true; endSpecView(); }
  if (G.specFP) {
    // 對方的眼睛：身體藏起來，第一人稱槍換成他手上的那把，跟著他的移動、開槍、換彈
    G.specView = t; fpHide.s = t.soldier;
    const e = dead.snap ? 1 : Math.min(1, dt * 18);
    dead.yaw += wrapPi(t.yaw - dead.yaw) * e; dead.pitch += (t.pitch - dead.pitch) * e; dead.snap = false;
    if (dead.wid !== t.cur) { dead.wid = t.cur; if (vm.groups[t.cur]) selectWeapon(t.cur, 0.3); else hideViewmodel(); dead.rl = false; }
    const rl = t.reloadT > 0; if (rl && !dead.rl) startReloadAnim(t.reloadT); dead.rl = rl;
    cam.position.copyFromFloats(t.rx, t.ry + (t.eye || 1.7), t.rz); cam.rotation.copyFromFloats(-dead.pitch, dead.yaw, 0);
    cam.computeWorldMatrix(true);
    updateViewmodel(dt, Math.hypot(t.vx, t.vz), t.ground, dead.yaw, dead.pitch);
    return;
  }
  endSpecView();
  // 跟在背後：轉向跟著目標，鏡頭被牆擋住就往目標拉近
  const e = dead.snap ? 1 : Math.min(1, dt * 7);
  dead.yaw += wrapPi(t.yaw - dead.yaw) * e;
  const hx = t.rx, hy = t.ry + (t.eye || 1.6), hz = t.rz, sy = Math.sin(dead.yaw), cy = Math.cos(dead.yaw);
  RAY_C.set(hx, hy, hz); RAY_D.set(hx - sy * CHASE, hy + CHASE_UP, hz - cy * CHASE);
  const hit = world.ctx.ray(RAY_C, RAY_D), f = hit.hasHit ? Math.max(0.12, (hit.hitDistance - 0.3) / Math.hypot(CHASE, CHASE_UP)) : 1;
  const px = hx - sy * CHASE * f, py = hy + CHASE_UP * f, pz = hz - cy * CHASE * f, pe = dead.snap ? 1 : Math.min(1, dt * 14);
  dead.cx += (px - dead.cx) * pe; dead.cy += (py - dead.cy) * pe; dead.cz += (pz - dead.cz) * pe; dead.snap = false;
  const lx = hx + sy * 2 - dead.cx, lz = hz + cy * 2 - dead.cz;   // 看目標前方一點，人在畫面中下方
  cam.position.copyFromFloats(dead.cx, dead.cy, dead.cz);
  cam.rotation.copyFromFloats(-Math.atan2(hy - 0.25 - dead.cy, Math.hypot(lx, lz)), Math.atan2(lx, lz), 0);
  cam.computeWorldMatrix(true);
}

/** 每幀：內插、動畫選擇、相機。 */
export function frame(alpha, dt, cam) {
  const m = G.me; if (!m) return;
  for (let i = 0; i < G.agents.length; i++) {
    const a = G.agents[i];
    a.rx = a.px + (a.x - a.px) * alpha; a.ry = a.py + (a.y - a.py) * alpha; a.rz = a.pz + (a.z - a.pz) * alpha;
    const s = a.soldier; if (!s || !a.alive) continue;
    const sp = Math.hypot(a.vx, a.vz), pistol = WEAPONS[a.cur]?.slot === 2;
    const task = a === m ? (G.plantP > 0 ? 'plant' : G.defuseP > 0 ? 'defuse' : '') : a.bot ? (a.bot.plantT > 0 ? 'plant' : a.bot.defT > 0 ? 'defuse' : '') : a.netTask;   // 連線的真人與客戶端的 puppet 由網路帶來
    s.busy = !!task && sp < 0.6;   // 雙手在忙，世界裡的槍要收起來
    if (a.hitT > 0) a.hitT -= dt;
    const firing = a.burstT > 0 || !!a.bot?.target?.alive || a.aim, wr = Math.min(2.2, Math.max(0.7, sp / 0.93));
    if (s.busy) anim(s, task);
    else if (a.hitT > 0 && a.ground) anim(s, 'hit');
    else if (!a.ground) anim(s, 'jump');
    else if (a.crouch) { if (sp > 0.3) anim(s, 'crouch_walk', false, wr); else anim(s, 'crouch_idle'); }
    else if (sp > 3.4) anim(s, pistol ? 'run_pistol' : 'run_rifle');
    else if (sp > 0.3) {
      const fx = Math.sin(a.yaw), fz = Math.cos(a.yaw), f = (a.vx * fx + a.vz * fz) / sp;
      if (f > 0.5) anim(s, pistol ? 'walk_pistol' : 'walk_rifle', false, wr); else if (f < -0.5) anim(s, 'back_rifle', false, wr);
      else anim(s, a.vx * fz - a.vz * fx > 0 ? 'strafe_r_rifle' : 'strafe_l_rifle', false, wr);
    } else anim(s, firing ? (pistol ? 'aim_pistol' : 'aim_rifle') : (pistol ? 'idle_pistol' : 'idle_rifle'));
  }
  if (!m.alive) { deathCam(cam, dt); return; }
  if (dead.t) { dead.t = 0; G.deadT = 0; G.specView = null; fpHide.s = null; }   // 復活：selectWeapon 已在回合開始把自己的槍拿回來
  applyCamera(cam, alpha, kickP0 + (kickP - kickP0) * alpha, kickY0 + (kickY - kickY0) * alpha);
  // 開鏡的視角縮放約 0.1 s，不是一格跳過去
  const fT = G.scoped ? SCOPE_FOV : Math.PI / 2; fovNow += (fT - fovNow) * Math.min(1, dt * 28); if (Math.abs(fovNow - fT) < 2e-3) fovNow = fT; cam.fov = fovNow;
  cam.computeWorldMatrix(true);
  updateViewmodel(dt, Math.hypot(you.vx, you.vz), you.ground, you.yaw, you.pitch);
}
