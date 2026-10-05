// 符文與裝備被動（《英雄聯盟》的基石符文、咒刃、暴擊、主動道具、野怪增益）。規則面，不碰 DOM。
// units.damage() 透過 G.traits.onHeroHit 呼叫這裡，避免 units ↔ traits 互相 import。
import { TEAR_MAX, JUNGLE_BUFF } from './config.js';
import { damage, heal, recalcStats, interrupt, addMp, dist } from './units.js';

const sfx = (G, name, at, o) => G.sfx && G.sfx(name, at, o);
const fx = (G) => G.fx;
const isBasic = (o) => o.type === 'L' || o.type === 'M' || o.type === 'H';
export const baseAd = (h) => h.def.stats.ad + h.def.stats.adLv * (h.level - 1);
const bonusAd = (h) => Math.max(0, h.ad - baseAd(h));

// 同一名目標的命中紀錄：間隔 0.25 秒以上才算「不同的一次」（多段技能不會一口氣疊滿）
function countHits(G, h, dst, win) {
  const rs = h.rs, last = rs.hits[rs.hits.length - 1];
  if (!last || last.id !== dst.id || G.time - last.t >= 0.25) rs.hits.push({ id: dst.id, t: G.time });
  rs.hits = rs.hits.filter((x) => G.time - x.t < win && x.id === dst.id);
  return rs.hits.length;
}

// 英雄對英雄造成傷害後（普攻或技能）
export function onHeroHit(G, h, dst, a, opts) {
  const rs = h.rs, skill = opts.type === 'skill' || opts.type === 'super';
  if (!skill && !isBasic(opts)) return;
  itemOnHeroHit(G, h, dst, a, opts, skill);
  switch (h.rune) {
    case 'conqueror': {
      rs.stacks = Math.min(8, (G.time - rs.t < 5 ? rs.stacks : 0) + (skill ? 2 : 1)); rs.t = G.time;
      if (rs.stacks >= 8) heal(G, h, a * 0.08);
      break;
    }
    case 'electrocute': {
      if (G.time < rs.cd) break;
      if (countHits(G, h, dst, 3) >= 3) {
        rs.cd = G.time + 20; rs.hits = [];
        G.later(0.05, () => {
          if (!dst.alive) return;
          damage(G, h, dst, 30 + 12 * h.level + 0.3 * bonusAd(h) + 0.25 * h.ap, { type: 'skill', rune: true, noKi: true });
          fx(G).lightning({ x: dst.x + 0.5, y: 9, z: dst.z - 0.5 }, { x: dst.x, y: 1 + dst.y, z: dst.z }, '#ff5a8a');
          sfx(G, 'thunder', dst, { vol: 0.55, pitch: 1.3 });
          G.emit('runeProc', { h, id: 'electrocute', dst });
        });
      }
      break;
    }
    case 'phase': {
      if (G.time < rs.cd) break;
      if (countHits(G, h, dst, 4) >= 3) {
        rs.cd = G.time + 14; rs.hits = [];
        h.st.haste = Math.max(h.st.haste || 0, 3); h.st.hasteMs = Math.max(h.st.hasteMs || 0, 0.35); h.st.hasteAs = h.st.hasteAs || 0;
        fx(G).ring(h.x, h.z, '#9fe6ff', 2.2, 0.4);
        G.emit('runeProc', { h, id: 'phase' });
      }
      break;
    }
    case 'comet': {
      if (!skill || G.time < rs.cd) break;
      rs.cd = G.time + 16;
      const x = dst.x, z = dst.z;
      fx(G).comet(x, z, '#b98bff', 0.8);
      G.later(0.8, () => {
        let hit = false;
        for (const u of G.heroes) if (u.alive && u.team !== h.team && Math.hypot(u.x - x, u.z - z) < 1.8 + u.radius) { damage(G, h, u, 30 + 10 * h.level + 0.35 * h.ap + 0.2 * bonusAd(h), { type: 'skill', rune: true, noKi: true }); hit = true; }
        fx(G).explode(x, z, '#b98bff', 1.8);
        sfx(G, 'explode', { x, z }, { vol: 0.4, pitch: 1.4 });
        if (hit) G.emit('runeProc', { h, id: 'comet' });
      });
      break;
    }
    case 'tempo': {
      if (!isBasic(opts)) break;
      rs.stacks = Math.min(6, (G.time - rs.t < 6 ? rs.stacks : 0) + 1); rs.t = G.time;
      break;
    }
  }
}

// 普攻間隔倍率（連打節奏）
export function asMul(G, h) {
  return h.rune === 'tempo' && G.time - h.rs.t < 6 ? 1 - 0.07 * h.rs.stacks : 1;
}

// 普攻命中前：暴擊、咒刃、不死之身、赤色氣焰。回傳最後的傷害
export function beforeAuto(G, h, t, dmg, opts) {
  if (h.crit > 0 && Math.random() < h.crit) { dmg *= h.critMul; opts.crit = true; }
  if (h.psv.blade && h.bladeT > G.time && G.time >= h.bladeCd) {
    dmg += baseAd(h) * h.psv.blade; h.bladeT = 0; h.bladeCd = G.time + 1.5; opts.blade = true;
    fx(G).ring(t.x, t.z, h.psv.blade >= 2 ? '#ffd34a' : '#bfe8ff', 1.8, 0.3);
    G.emit('spellblade', { h, t });
  }
  if (h.rune === 'grasp' && h.rs.charge >= 4 && t.kind === 'hero') {
    const k = h.def.melee ? 1 : 0.5;
    dmg += h.maxHp * 0.04 * k; heal(G, h, h.maxHp * 0.02 * k);
    h.graspHp += 6 * k; recalcStats(h); h.rs.charge = 0;
    fx(G).ring(h.x, h.z, '#7bd36a', 2, 0.4);
    G.emit('runeProc', { h, id: 'grasp' });
  }
  for (const e of effs(h, 'onhit')) if (!e.magic && (!e.minionOnly || t.kind === 'minion')) dmg += onhitAmount(h, t, e);
  if (h.red > 0 && (t.kind === 'hero' || t.kind === 'minion' || t.kind === 'monster')) {
    const R = JUNGLE_BUFF.red;
    t.st.burn = R.burnT; t.st.burnDps = (R.burn + R.burnLv * h.level) / R.burnT; t.st.burnSrc = h;
    if (t.kind !== 'monster' || !t.boss) { t.st.slow = Math.max(t.st.slow, 1.5); t.st.slowAmt = Math.max(t.st.slowAmt, R.slow); }
  }
  return dmg;
}

// 施放技能後：咒刃上膛、積蓄層數
export function onCast(G, h, cost = 0) {
  if (h.psv.blade && G.time >= h.bladeCd) h.bladeT = G.time + 10;
  for (const e of effs(h, 'refund')) addMp(h, cost * e.pct);
  for (const e of effs(h, 'msAfterCast')) haste(h, e.dur, e.ms);
  if (h.psv.tear && h.res === 'mana' && h.tear < TEAR_MAX) { h.tear = Math.min(TEAR_MAX, h.tear + h.psv.tear); recalcStats(h); }
}

// 每步：不死之身在交戰中累積
export function tick(G, h, dt) {
  itemTick(G, h, dt);
  if (h.rune !== 'grasp') return;
  const fighting = G.time - h.lastAttackHeroT < 4 || (h.lastHitBy && h.lastHitBy.kind === 'hero' && G.time - h.lastHitT < 4);
  if (fighting) h.rs.charge = Math.min(4, h.rs.charge + dt); else h.rs.charge = 0;
}

// 主動道具：i 是身上第幾個主動道具（0、1）
export function activeReady(G, h, i) { const a = h.acts && h.acts[i]; return !!a && h.alive && G.time >= (h.actCd[a.id] || 0); }
export function useActive(G, h, i) {
  if (!activeReady(G, h, i)) return false;
  const a = h.acts[i];
  if (a.id === 'stasis') {
    if (h.y > 0.05) return false;
    interrupt(G, h); h.goal = null; h.target = null; h.recall = 0; h.charging = false;
    h.st.invuln = a.dur; h.st.stun = Math.max(h.st.stun, a.dur); h.stasis = G.time + a.dur;
    fx(G).shieldFx(h, '#ffd34a', a.dur); fx(G).ring(h.x, h.z, '#ffd34a', 2.4, 0.5);
    sfx(G, 'freeze', h, { vol: 0.5, pitch: 1.3 });
    G.emit('stasis', { h, dur: a.dur, kind: 'hourglass' });
    // 只能用一次的（時之護腕）：用完換成碎裂的版本
    if (a.once) { const i2 = h.inv.indexOf(a.item); if (i2 >= 0) { h.inv[i2] = a.once; recalcStats(h); } return true; }
  } else if (a.id === 'crescent') {
    for (const u of G.units) if (u.alive && u.team !== h.team && u.team <= 2 && (u.kind === 'hero' || u.kind === 'minion' || u.kind === 'monster') && dist(u, h) < a.r + u.radius) damage(G, h, u, h.ad * a.ad, { type: 'proc', noKi: true });
    fx(G).ring(h.x, h.z, '#e8f4ff', a.r, 0.35); fx(G).slash(h.x, h.z, h.facing, '#ffffff', a.r);
    sfx(G, 'slash', h, { vol: 0.5 });
  } else if (a.id === 'cleanse') {
    if (h.stasis > G.time) return false;
    const st = h.st; st.stun = 0; st.frozen = 0; st.slow = 0; st.slowAmt = 0;
    st.haste = Math.max(st.haste || 0, a.dur); st.hasteMs = Math.max(st.hasteMs || 0, 0.4); st.hasteAs = st.hasteAs || 0;
    fx(G).ring(h.x, h.z, '#e8f4ff', 2.2, 0.4); fx(G).hitSpark(h.x, 1.2, h.z, '#e8f4ff', 1.4, 'light');
    sfx(G, 'vanish', h, { vol: 0.5 });
    G.emit('cleanse', h);
  }
  h.actCd[a.id] = G.time + a.cd;
  return true;
}

// AI：被控或殘血時用主動道具
export function aiActives(G, h, foeNear) {
  if (!h.acts || !h.acts.length) return;
  h.acts.forEach((a, i) => {
    if (!activeReady(G, h, i)) return;
    if (a.id === 'cleanse' && (h.st.stun > 0.6 || h.st.frozen > 0.6) && foeNear && !(h.stasis > G.time)) useActive(G, h, i);
    if (a.id === 'stasis' && h.hp / h.maxHp < 0.2 && foeNear) useActive(G, h, i);
  });
}

/* ================= 裝備效果（《英雄聯盟》的被動與主動） =================
 * h.psv 由 units.itemPassives 彙整：key 是被動名稱（同名不疊加，取 lv 較高的那件），值是 { k: 種類, ...參數 }。
 * 數字型的舊欄位（blade、tear、critDmg…）照舊，沒有 k 的值這裡不處理。
 * 種類一覽：
 *   onhit      普攻命中附加傷害：flat＋ad×總攻擊＋bad×額外攻擊＋ap×氣功強度＋maxHp／curHp／missHp×目標血量；magic 走技能防禦；minionOnly
 *   onhitHeal  普攻命中回血 v
 *   msOnAuto   普攻後移速 +ms，dur 秒
 *   cleave     近戰普攻對目標周圍 r 公尺的敵人造成 pct 的物理傷害
 *   everyN     每 n 下普攻追加 flat＋ad＋bad 的傷害（magic 可選）
 *   heroProc   傷害英雄時追加 dmg＋ap×氣功強度的技能傷害，冷卻 cd；autoCdr＝每次普攻縮短冷卻的秒數
 *   gw         對英雄造成 type（phys／magic／any）傷害時施加重傷 pct，3 秒
 *   skillBurn  技能命中後灼燒：每秒 dps，dur 秒；monster＝對野怪的額外傷害
 *   ramp       與英雄交戰時每秒傷害 +per，上限 max
 *   immolate   造成或承受傷害後 3 秒內，每秒對 r 公尺內敵人造成 dps＋hpK×額外血量 的技能傷害
 *   autoReduce 承受的普攻傷害 -pct
 *   spellShield 擋下下一次敵方技能，冷卻 cd
 *   lifeline   受傷後血量低於 at 時得到護盾 base＋bonusHp×額外血量（magicOnly 只擋技能傷害），持續 dur，冷卻 cd
 *   hitShield  受到英雄的 type 傷害後得到護盾 base＋lv×等級，持續 5 秒，冷卻 cd
 *   regenHit   受到英雄傷害後 8 秒內每秒回 v 血
 *   manaHit    受到英雄傷害時回 pct×傷害 的魔力
 *   refund     施放技能退還 pct×消耗
 *   msAfterCast 施放技能後移速 +ms，dur 秒
 *   mpRegen    每秒回 v 魔力，對英雄造成傷害後 5 秒內 combat
 *   stacks     參與擊殺疊 1 層（最多 max，死亡失去 lose），每層 ap／ov
 *   eternal    血量高於一半時傷害 +dmg，低於一半時治療與護盾 +heal
 *   adaptiveMs 適性之力＝移速×pct（本作移速換回原作單位），加在攻擊或氣功強度較高的那邊
 *   slowResist 緩速效果 -v
 */
const effs = (h, k) => { const out = []; for (const key in h.psv || {}) { const e = h.psv[key]; if (e && e.k === k) out.push(e); } return out; };
export { effs };
function onhitAmount(h, t, e) {
  return (e.flat || 0) + (e.ad || 0) * h.ad + (e.bad || 0) * bonusAd(h) + (e.ap || 0) * (h.ap || 0)
    + (e.maxHp || 0) * t.maxHp + (e.curHp || 0) * t.hp + (e.missHp || 0) * (t.maxHp - t.hp);
}
function haste(h, dur, ms) { h.st.haste = Math.max(h.st.haste || 0, dur); h.st.hasteMs = Math.max(h.st.hasteMs || 0, ms); h.st.hasteAs = h.st.hasteAs || 0; }
const fxs = (h) => (h.fxs ||= {});

// 普攻命中後：技能傷害型命中效果、命中回血、移速、順劈、第 N 下
export function afterAuto(G, h, t, dealt, opts) {
  const F = fxs(h);
  for (const e of effs(h, 'onhit')) if (e.magic && (!e.minionOnly || t.kind === 'minion')) damage(G, h, t, onhitAmount(h, t, e), { type: 'proc', magic: true, noKi: true });
  for (const e of effs(h, 'onhitHeal')) heal(G, h, e.v);
  for (const e of effs(h, 'msOnAuto')) haste(h, e.dur, e.ms);
  for (const e of effs(h, 'heroProc')) if (e.autoCdr && F.procCd) F.procCd -= e.autoCdr;
  if (h.def.melee) for (const e of effs(h, 'cleave')) {
    for (const u of G.units) if (u !== t && u.alive && u.team !== h.team && u.team <= 2 && (u.kind === 'hero' || u.kind === 'minion' || u.kind === 'monster') && dist(u, t) < e.r + u.radius) damage(G, h, u, dealt * e.pct, { type: 'proc', noKi: true });
  }
  for (const e of effs(h, 'everyN')) {
    F.nHits = (F.nHits || 0) + 1;
    if (F.nHits >= e.n) { F.nHits = 0; damage(G, h, t, (e.flat || 0) + (e.ad || 0) * h.ad + (e.bad || 0) * bonusAd(h), { type: 'proc', magic: !!e.magic, noKi: true }); fx(G).ring(t.x, t.z, '#ffe08a', 1.4, 0.25); }
  }
}

// 對英雄造成傷害後（普攻或技能）
function itemOnHeroHit(G, h, dst, a, opts, skill) {
  const F = fxs(h), magic = skill || opts.magic;
  for (const e of effs(h, 'gw')) if (e.type === 'any' || (e.type === 'magic') === !!magic) { dst.st.gw = 3; dst.st.gwAmt = Math.max(dst.st.gwAmt || 0, e.pct); }
  for (const e of effs(h, 'heroProc')) if (G.time >= (F.procCd || 0)) {
    F.procCd = G.time + e.cd;
    G.later(0.02, () => { if (dst.alive) damage(G, h, dst, e.dmg + (e.ap || 0) * (h.ap || 0) + (e.lvDmg || 0) * h.level, { type: 'proc', magic: true, noKi: true }); });
    fx(G).hitSpark(dst.x, 1.2 + dst.y, dst.z, '#9fd8ff', 0.8, 'light');
  }
  if (skill) for (const e of effs(h, 'skillBurn')) { dst.st.burn = Math.max(dst.st.burn || 0, e.dur); dst.st.burnDps = Math.max(dst.st.burnDps || 0, e.dps); dst.st.burnSrc = h; }
  F.heroCombat = G.time;
  if (effs(h, 'immolate').length) F.immoT = G.time + 3;
}
// 對野怪與小兵也有效的技能灼燒（命定灰燼對野怪加傷）
export function onSkillHitAny(G, h, u) {
  for (const e of effs(h, 'skillBurn')) { if (u.kind === 'hero') continue; u.st.burn = Math.max(u.st.burn || 0, e.dur); u.st.burnDps = Math.max(u.st.burnDps || 0, e.dps + (u.kind === 'monster' ? (e.monster || 0) / e.dur : 0)); u.st.burnSrc = h; }
}

// 承受傷害前：減普攻傷害、法術護盾。回傳調整後的傷害
export function beforeTaken(G, src, dst, a, opts) {
  if (dst.kind !== 'hero' || !dst.psv) return a;
  const basic = isBasic(opts), skill = opts.type === 'skill' || opts.type === 'super';
  if (basic) for (const e of effs(dst, 'autoReduce')) a *= 1 - e.pct;
  if (skill && src && src.kind === 'hero') for (const e of effs(dst, 'spellShield')) {
    const F = fxs(dst);
    if (G.time >= (F.shieldCd || 0)) { F.shieldCd = G.time + e.cd; fx(G).shieldFx(dst, '#c8b4ff', 0.4); G.emit('spellShield', dst); return 0; }
  }
  if (src && src.kind === 'hero') for (const e of effs(src, 'ramp')) a *= 1 + Math.min(e.max, e.per * Math.max(0, G.time - (fxs(src).rampT0 ?? G.time)));
  if (src && src.kind === 'hero') for (const e of effs(src, 'eternal')) if (src.hp > src.maxHp * 0.5) a *= 1 + e.dmg;
  return a;
}
// 承受傷害後：保命護盾、受擊護盾、受擊回血與回魔、獻祭
export function afterTaken(G, src, dst, a, opts) {
  if (dst.kind !== 'hero' || !dst.psv || a <= 0) return;
  const F = fxs(dst), fromHero = src && src.kind === 'hero', magic = opts.type === 'skill' || opts.type === 'super' || opts.magic;
  for (const e of effs(dst, 'lifeline')) {
    if ((e.magicOnly && !magic) || G.time < (F.lifeCd || 0) || dst.hp > dst.maxHp * e.at || dst.hp <= 0) continue;
    F.lifeCd = G.time + e.cd;
    const v = (e.base || 0) + (e.bonusHp || 0) * Math.max(0, dst.maxHp - dst.def.stats.hp - dst.def.stats.hpLv * (dst.level - 1)) + (e.lv || 0) * dst.level;
    dst.st.shield = (dst.st.shield || 0) + v * (1 + (dst.hsp || 0)); dst.st.shieldT = Math.max(dst.st.shieldT, e.dur);
    fx(G).shieldFx(dst, '#ffd34a', e.dur); G.emit('lifeline', dst);
  }
  if (fromHero) {
    for (const e of effs(dst, 'hitShield')) if ((e.type === 'magic') === !!magic && G.time >= (F['hs' + e.type] || 0)) {
      F['hs' + e.type] = G.time + e.cd;
      dst.st.shield = (dst.st.shield || 0) + (e.base + e.lv * dst.level) * (1 + (dst.hsp || 0)); dst.st.shieldT = Math.max(dst.st.shieldT, 5);
    }
    for (const e of effs(dst, 'regenHit')) { F.regenT = G.time + 8; F.regenV = e.v; }
    for (const e of effs(dst, 'manaHit')) addMp(dst, a * e.pct);
    if (effs(dst, 'immolate').length) F.immoT = G.time + 3;
  }
}
// 參與擊殺英雄
export function onTakedown(G, h) {
  let changed = false;
  for (const key in h.psv || {}) { const e = h.psv[key]; if (e && e.k === 'stacks') { h.stk = h.stk || {}; h.stk[key] = Math.min(e.max, (h.stk[key] || 0) + 1); changed = true; } }
  if (changed) recalcStats(h);
}
export function onDeath(G, h) {
  if (!h.stk) return;
  for (const key in h.stk) { const e = h.psv && h.psv[key]; if (e && e.lose) h.stk[key] = Math.max(0, h.stk[key] - e.lose); }
  recalcStats(h);
}
// 每步
function itemTick(G, h, dt) {
  const F = h.fxs; if (!F && !h.psv) return;
  for (const e of effs(h, 'mpRegen')) addMp(h, (G.time - (F && F.heroCombat || -99) < 5 ? e.combat : e.v) * dt);
  if (!F) return;
  if (F.regenT > G.time) heal(G, h, F.regenV * dt);
  // 交戰中的增傷：5 秒沒和英雄交手就重置
  if (G.time - (F.heroCombat ?? -99) > 5) F.rampT0 = undefined; else if (F.rampT0 === undefined) F.rampT0 = G.time;
  if (F.immoT > G.time) for (const e of effs(h, 'immolate')) {
    F.immoAcc = (F.immoAcc || 0) + dt;
    if (F.immoAcc >= 0.5) {
      F.immoAcc = 0;
      const bonus = Math.max(0, h.maxHp - h.def.stats.hp - h.def.stats.hpLv * (h.level - 1)), d = (e.dps + (e.hpK || 0) * bonus) * 0.5;
      for (const u of G.units) if (u.alive && u.team !== h.team && u.team <= 2 && (u.kind === 'hero' || u.kind === 'minion' || u.kind === 'monster') && dist(u, h) < e.r + u.radius) damage(G, h, u, d * (u.kind === 'hero' ? 1 : 1.5), { type: 'proc', magic: true, noKi: true, dot: true });
    }
  }
}

export const traits = { onHeroHit, tick, beforeTaken, afterTaken, onSkillHitAny, onTakedown, onDeath };
