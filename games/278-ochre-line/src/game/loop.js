// 64 Hz 主邏輯：玩家、Bot、回合、投擲物。
import { G, RULES, WEAPONS } from './state.js';
import { LAYOUT } from '../map/layout.js';
import { input } from '../core/input.js';
import { you, tickPlayer, applyCamera, teleport } from './player.js';
import { fire, tickWeapon, startReload, recoilTable, maxSpeed, RECOIL_LAST } from './weapons.js';
import { tickBot, plan } from './bots.js';
import { tickNades, throwNade } from './grenades.js';
import { endRound, nextRound, plantDone, defuseDone, checkElim, showCharge } from './round.js';
import { play as anim, chargePos } from './soldiers.js';
import { vm, selectWeapon, updateViewmodel, muzzleTo, fireKick, startReloadAnim, stopReloadAnim, startInspect } from './viewmodel.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { NEW_GUNS } from './guns/index.js';

const TMP_VEC_MZ = new Vector3();
const PORT = { ks: 0.34, ar5: 0.42, l40: 0.7, s8: 0.45, v11: 0.14, p9: 0.1, r50: 0.12 };   // 槍口到拋殼口
const FLASH = { l40: 1.5, s8: 1.5, v11: 0.8, p9: 1.4, r50: 1.4 };   // 第一人稱火光倍率，沒列的是 1
const BIG_CASE = { s8: true, l40: true };
for (const g of NEW_GUNS) { PORT[g.id] = g.port; FLASH[g.id] = g.flash; if (g.bigCase) BIG_CASE[g.id] = true; }
import { muzzle, casing } from '../fx/particles.js';
import { play as sfx } from '../audio/sfx.js';
import { DRAW } from '../audio/cues.js';

const S = LAYOUT.sites;
const SCOPE_FOV = 0.32, SCOPE_SENS = Math.tan(SCOPE_FOV / 2) / Math.tan(Math.PI / 4);   // 開鏡時畫面轉速和腰射一樣
const inSite = (x, y, z) => x >= S.A.x0 && x <= S.A.x1 && z >= S.A.z0 && z <= S.A.z1 && Math.abs(y - S.A.y) < 3 ? 'A' : x >= S.B.x0 && x <= S.B.x1 && z >= S.B.z0 && z <= S.B.z1 && Math.abs(y - S.B.y) < 3 ? 'B' : '';
let lastSlot = 'p9', fireHeld = false, altHeld = false, zoneT = 0, beepT = 0, stepT = 0, kickP = 0, kickY = 0, nadeHeld = false;

function setCur(m, id) {
  if (!id || m.cur === id) return;
  lastSlot = m.cur; m.cur = id; m.reloadT = 0; m.fireT = 0.35; G.scoped = false;
  selectWeapon(id);
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
  if (!m.alive) { you.frozen = true; return; }
  you.frozen = G.phase === 'buy' || G.phase === 'menu' || G.plantP > 0 || G.defuseP > 0;
  you.speedK = (WEAPONS[m.cur]?.speedK ?? 1) * (m.slowT > 0 ? 0.55 : 1);
  you.sensK = G.scoped ? SCOPE_SENS * input.scopeSens : 1;
  tickPlayer(dt);
  m.px = m.x; m.py = m.y; m.pz = m.z; m.x = you.x; m.y = you.y; m.z = you.z; m.vx = you.vx; m.vy = you.vy; m.vz = you.vz;
  m.yaw = you.yaw; m.pitch = you.pitch; m.ground = you.ground; m.crouch = you.crouch; m.eye = you.eye; m.h = you.h; m.scoped = G.scoped;
  tickWeapon(m, dt);

  if (input.slot) {
    const s = input.slot; input.slot = 0;
    if (s === 1) setCur(m, m.primary); else if (s === 2) setCur(m, m.secondary); else if (s === 3) setCur(m, 'knife');
    else if (s === 4) { if (m.nades.length) setCur(m, m.nades[0]); } else if (s === 5) { if (m.hasCharge) setCur(m, 'charge'); }
    else if (s === 9) quickSwap(m);
  }
  if (input.wheel) { const list = [m.primary, m.secondary, 'knife', ...m.nades, m.hasCharge && 'charge'].filter(Boolean), i = list.indexOf(m.cur); setCur(m, list[(i + (input.wheel > 0 ? 1 : list.length - 1)) % list.length]); input.wheel = 0; }
  if (input.reload) { if (startReload(m)) { const r = WEAPONS[m.cur]; startReloadAnim(r.shell ? r.shell * Math.min(r.mag - m.ammo[m.cur], m.rsv[m.cur]) : r.reload); } }
  if (input.inspect) { input.inspect = false; startInspect(); }
  if (input.alt && !altHeld && WEAPONS[m.cur]?.scope) G.scoped = !G.scoped;
  altHeld = input.alt;

  const w = WEAPONS[m.cur], live = G.phase === 'live' || G.phase === 'planted' || G.phase === 'post';
  if (w?.nade) {
    if (input.fire) nadeHeld = true;
    else if (nadeHeld && live) {
      nadeHeld = false; fireKick(); throwNade(m, w.id, m.yaw, m.pitch + 0.1); m.nades.splice(m.nades.indexOf(w.id), 1);
      setCur(m, m.nades[0] ?? m.primary ?? m.secondary);
    }
  } else if (input.fire && live && w) {
    if ((w.auto || !fireHeld) && fire(m, m.yaw, m.pitch, cam.position)) {
      fireKick();
      if (w.range > 3 && vm.cur?.muzzle) {
        const q = muzzleTo(TMP_VEC_MZ), v = cam.getViewMatrix().m, fx0 = v[2], fy0 = v[6], fz0 = v[10], rx = v[0], rz = v[8];
        muzzle(q.x, q.y, q.z, fx0, fy0, fz0, FLASH[m.cur] ?? 1);
        const back = PORT[m.cur] ?? 0.2, sp = 1.7 + Math.random() * 0.7;
        casing(q.x - fx0 * back + rx * 0.02, q.y - fy0 * back + 0.02, q.z - fz0 * back + rz * 0.02, rx * sp + m.vx, 1.5 + Math.random() * 0.6, rz * sp + m.vz, BIG_CASE[m.cur] === true);
      }
      if (w.scope) G.scoped = false;
      if (w.shell) stopReloadAnim();   // 開火中斷單發裝填
      if (!w.auto) { /* 栓動後短暫不可瞄 */ }
    }
  }
  fireHeld = input.fire; vm.dry = (m.ammo[m.cur] | 0) <= 0;
  if (m.reloadT > 0 && vm.reload <= 0 && !w?.shell) startReloadAnim(m.reloadT);   // 打空自動換彈也要播；單發裝填在按下時已排好全程
  const tbl = recoilTable(m), b = Math.min(Math.max(0, m.burst - 1), RECOIL_LAST);
  const tp = tbl && m.burst > 0 ? tbl[b * 2] * 0.55 : 0, ty = tbl && m.burst > 0 ? tbl[b * 2 + 1] * 0.55 : 0, kk = Math.min(1, dt * (m.burst > 0 ? 40 : 9));
  kickP += (tp - kickP) * kk; kickY += (ty - kickY) * kk;

  // 安裝／拆除
  const site = inSite(m.x, m.y, m.z), c = G.charge;
  if (input.use && m.hasCharge && site && G.phase === 'live' && m.ground) { G.plantP += dt / RULES.plantTime; if (G.plantP >= 1) { G.plantP = 0; plantDone(m, site); setCur(m, m.primary ?? m.secondary); } }
  else G.plantP = 0;
  if (input.use && c && m.team === 1 && Math.hypot(c.x - m.x, c.z - m.z, c.y - m.y) < 2 && G.phase === 'planted') { G.defuseP += dt / (m.kit ? RULES.defuseKit : RULES.defuseTime); if (G.defuseP >= 1) { G.defuseP = 0; defuseDone(m); } }
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
    if (!a.alive) { if (a.bot.plantT > 0) { a.bot.plantT = 0; chargePos.on = !!G.charge; } continue; }
    const site = inSite(a.x, a.y, a.z); a.onSite = !!site;
    if (a.hasCharge && site && !c && G.phase === 'live') { a.bot.plantT += dt; if (a.bot.plantT >= RULES.plantTime) { a.bot.plantT = 0; plantDone(a, site); } else if (!chargePos.on) showCharge(a); }
    else { if (a.bot.plantT > 0) chargePos.on = !!G.charge; a.bot.plantT = 0; }
    if (c && a.team === 1 && G.phase === 'planted' && Math.hypot(c.x - a.x, c.z - a.z) < 1.6 && Math.hypot(a.vx, a.vz) < 0.3 && !(a.bot.target?.alive)) { a.bot.defT = (a.bot.defT || 0) + dt; if (a.bot.defT >= (a.kit ? RULES.defuseKit : RULES.defuseTime)) { a.bot.defT = 0; defuseDone(a); } }
    else if (a.bot) a.bot.defT = 0;
  }
}

export function tick(dt, cam) {
  if (G.paused || !G.me) return;
  tickRound(dt, cam);
  if (G.phase === 'over' || G.phase === 'menu') return;
  tickMe(dt, cam);
  for (let i = 0; i < G.agents.length; i++) { const a = G.agents[i]; if (a.bot && a.alive) tickBot(a, dt, cam.position); }
  botObjectives(dt);
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
}

/** 每幀：內插、動畫選擇、相機。 */
export function frame(alpha, dt, cam) {
  const m = G.me; if (!m) return;
  for (let i = 0; i < G.agents.length; i++) {
    const a = G.agents[i];
    a.rx = a.px + (a.x - a.px) * alpha; a.ry = a.py + (a.y - a.py) * alpha; a.rz = a.pz + (a.z - a.pz) * alpha;
    const s = a.soldier; if (!s || !a.alive) continue;
    const sp = Math.hypot(a.vx, a.vz), pistol = WEAPONS[a.cur]?.slot === 2;
    const task = a === m ? (G.plantP > 0 ? 'plant' : G.defuseP > 0 ? 'defuse' : '') : (a.bot?.plantT > 0 ? 'plant' : a.bot?.defT > 0 ? 'defuse' : '');
    s.busy = !!task && sp < 0.6;   // 雙手在忙，世界裡的槍要收起來
    if (a.hitT > 0) a.hitT -= dt;
    const firing = a.burstT > 0 || !!a.bot?.target?.alive, wr = Math.min(2.2, Math.max(0.7, sp / 0.93));
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
  applyCamera(cam, alpha, kickP, kickY);
  cam.fov = G.scoped ? SCOPE_FOV : Math.PI / 2;
  cam.computeWorldMatrix(true);
  updateViewmodel(dt, Math.hypot(you.vx, you.vz), you.ground, you.yaw, you.pitch);
}
