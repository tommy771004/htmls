// 符文與裝備被動（《英雄聯盟》的基石符文、咒刃、暴擊、主動道具、野怪增益）。規則面，不碰 DOM。
// units.damage() 透過 G.traits.onHeroHit 呼叫這裡，避免 units ↔ traits 互相 import。
import { TEAR_MAX, JUNGLE_BUFF } from './config.js';
import { damage, heal, recalcStats, interrupt, addMp, dist, addGold } from './units.js';
import { seen } from './vision.js';

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
  let m = h.rune === 'tempo' && G.time - h.rs.t < 6 ? 1 - 0.07 * h.rs.stacks : 1;
  const F = h.fxs;
  if (F) {
    for (const e of effs(h, 'guinsoo')) if (F.gStk && G.time - F.gT < e.dur) m /= 1 + e.as * F.gStk;
    if (F.flT > G.time) m /= 1 + F.flAs;
  }
  for (const e of effs(h, 'selfLowHp')) if (h.hp < h.maxHp * e.below) m /= 1 + e.as;
  // 光環：附近敵方英雄的攻速降低（冰霜之心類）
  for (const o of G.heroes) if (o.alive && o.team !== h.team && o.psv) for (const k in o.psv) { const e = o.psv[k]; if (e && e.k === 'asAura' && dist(o, h) < e.r) m *= 1 + e.pct; }
  return m;
}

// 普攻命中前：暴擊、咒刃、不死之身、赤色氣焰。回傳最後的傷害
export function beforeAuto(G, h, t, dmg, opts) {
  if (h.crit > 0 && Math.random() < h.crit) { dmg *= h.critMul; opts.crit = true; }
  if (h.psv.blade && !effs(h, 'spellblade').length && h.bladeT > G.time && G.time >= h.bladeCd) {
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
  dmg = legendBeforeAuto(G, h, t, dmg, opts);
  if (h.red > 0 && (t.kind === 'hero' || t.kind === 'minion' || t.kind === 'monster')) {
    const R = JUNGLE_BUFF.red;
    t.st.burn = R.burnT; t.st.burnDps = (R.burn + R.burnLv * h.level) / R.burnT; t.st.burnSrc = h;
    if (t.kind !== 'monster' || !t.boss) { t.st.slow = Math.max(t.st.slow, 1.5); t.st.slowAmt = Math.max(t.st.slowAmt, R.slow); }
  }
  return dmg;
}

// 施放技能後：咒刃上膛、積蓄層數
export function onCast(G, h, cost = 0, k = '') {
  // 複製忍者：附近的敵方英雄施放技能 → 自己下一次技能增傷
  for (const o of G.heroes) if (o.alive && o.team !== h.team && o.psv) for (const e of effs(o, 'copy')) if (dist(o, h) < e.r) { const F = fxs(o); F.copyT = G.time + e.dur; F.copyAmp = e.pct; F.copyEnd = 0; }
  if (h.psv.blade && G.time >= h.bladeCd) h.bladeT = G.time + 10;
  if (effs(h, 'spellblade').length) fxs(h).bladeArmed = G.time + 10;
  if (k === 'R' && h.soul === 'cloud') haste(h, 6, 0.5); // 風雲之魂
  if (k === 'R') {
    for (const e of effs(h, 'ultStorm')) { fxs(h).stormT = G.time + e.dur; fx(G).ring(h.x, h.z, '#9fe6ff', e.r, 0.5); }
    for (const e of effs(h, 'ultAs')) { h.st.haste = Math.max(h.st.haste || 0, e.dur); h.st.hasteAs = Math.max(h.st.hasteAs || 0, e.as / (1 + e.as)); h.st.hasteMs = Math.max(h.st.hasteMs || 0, e.ms || 0); }
  }
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
  } else if (a.id === 'teamHaste') {
    for (const o of G.heroes) if (o.alive && o.team === h.team && dist(o, h) < a.r) { haste(o, a.dur, a.ms); fx(G).ring(o.x, o.z, '#bfe8ff', 1.6, 0.3); }
  } else if (a.id === 'teamShield') {
    for (const o of G.heroes) if (o.alive && o.team === h.team && dist(o, h) < a.r) { o.st.shield = (o.st.shield || 0) + (a.base + a.lv * h.level) * (1 + (h.hsp || 0)); o.st.shieldT = Math.max(o.st.shieldT, a.dur); fx(G).shieldFx(o, '#ffe9a0', a.dur); }
  } else if (a.id === 'healCircle') {
    const x = h.lastHeroTarget && h.lastHeroTarget.alive && dist(h, h.lastHeroTarget) < 12 ? h.lastHeroTarget.x : h.x, z = h.lastHeroTarget && h.lastHeroTarget.alive && dist(h, h.lastHeroTarget) < 12 ? h.lastHeroTarget.z : h.z;
    const mark = fx(G).target(x, z, a.r, '#ffe9a0', a.delay);
    G.later(a.delay, () => {
      mark && mark.remove && mark.remove();
      for (const o of G.heroes) if (o.alive && Math.hypot(o.x - x, o.z - z) < a.r + o.radius) { if (o.team === h.team) heal(G, o, (a.heal + a.lv * h.level) * (1 + (h.hsp || 0))); else damage(G, h, o, o.maxHp * a.pct, { type: 'true', noKi: true, rune: true }); }
      fx(G).dome(x, z, a.r, '#ffe9a0');
    });
  } else if (a.id === 'cleanseAlly') {
    const o = G.heroes.filter((o) => o.alive && o.team === h.team && o !== h && dist(o, h) < a.r).sort((p, q) => p.hp / p.maxHp - q.hp / q.maxHp)[0] || h;
    const st = o.st; st.stun = 0; st.frozen = 0; st.slow = 0; st.slowAmt = 0; heal(G, o, a.heal + a.lv * h.level);
    fx(G).ring(o.x, o.z, '#e8f4ff', 2, 0.4);
  } else if (a.id === 'rocket' || a.id === 'gunblade' || a.id === 'slowNova' || a.id === 'quake') {
    const t = h.lastHeroTarget && h.lastHeroTarget.alive && dist(h, h.lastHeroTarget) < (a.reach || 8) ? h.lastHeroTarget : null;
    if (a.id === 'rocket') {
      const ang = t ? Math.atan2(t.x - h.x, t.z - h.z) : h.facing, d = a.dist;
      const nx = h.x + Math.sin(ang) * d, nz = h.z + Math.cos(ang) * d; interrupt(G, h); h.x = nx; h.z = nz; h.facing = ang;
      fx(G).trail(h, '#ffb03a');
      for (const u of enemiesIn(G, h, h.x + Math.sin(ang) * 2, h.z + Math.cos(ang) * 2, 3)) procDmg(G, h, u, a.dmg + a.ap * (h.ap || 0), true);
    } else if (a.id === 'gunblade') {
      if (!t) return false;
      procDmg(G, h, t, a.dmg + a.ap * (h.ap || 0), true); t.st.slow = Math.max(t.st.slow, 1.5); t.st.slowAmt = Math.max(t.st.slowAmt, a.slow * (1 - (t.slowRes || 0)));
      fx(G).lightning({ x: h.x, y: 1.4, z: h.z }, { x: t.x, y: 1.2, z: t.z }, '#c8a0ff');
    } else {
      for (const u of enemiesIn(G, h, h.x, h.z, a.r)) { if (a.ad) procDmg(G, h, u, h.ad * a.ad, false); u.st.slow = Math.max(u.st.slow, a.dur || 2); u.st.slowAmt = Math.max(u.st.slowAmt, a.slow * (1 - (u.slowRes || 0))); if (a.id === 'quake' && u.kind === 'hero') haste(h, 3, 0.2); }
      fx(G).ring(h.x, h.z, '#e8dcc0', a.r, 0.45); fx(G).dust(h.x, h.z, 16);
    }
    sfx(G, a.id === 'gunblade' ? 'thunder' : 'slam', h, { vol: 0.5 });
  } else if (a.id === 'haste') {
    haste(h, a.dur, a.ms); fx(G).ring(h.x, h.z, '#ff8a5a', 1.6, 0.3);
  } else if (a.id === 'empower') {
    buff(G, h, 'empower', {}, a.dur, { dmg: a.dmg, cdr: a.cdr }); fx(G).ring(h.x, h.z, '#9fd8ff', 2.2, 0.5);
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
    const tgt = h.lastHeroTarget && h.lastHeroTarget.alive && G.time - h.lastAttackHeroT < 2 && dist(h, h.lastHeroTarget) < 7;
    if (tgt && ['crescent', 'gunblade', 'slowNova', 'quake', 'rocket', 'empower', 'haste', 'healCircle'].includes(a.id)) useActive(G, h, i);
    if (foeNear && ['teamShield', 'teamHaste'].includes(a.id) && G.heroes.some((o) => o.alive && o.team === h.team && o.hp / o.maxHp < 0.5 && dist(o, h) < 8)) useActive(G, h, i);
    if (a.id === 'cleanseAlly' && G.heroes.some((o) => o.alive && o.team === h.team && (o.st.stun > 0.6 || o.st.frozen > 0.6) && dist(o, h) < a.r)) useActive(G, h, i);
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
 * —— 傳說裝備 ——
 *   spellblade 咒刃變體：施放技能後下一次普攻追加 base×基礎攻擊＋ap×氣功強度（magic 走技能防禦），heal 回血，mana 回魔，slowField 留下緩速區
 *   energize   蓄能：移動與普攻累積到 100 後，下一次普攻追加 dmg（magic）、curHp×目標當前血量、chain 連鎖幾個目標、ms 移速、range 距離
 *   splitShot  遠程普攻多射 n 支分裂箭，每支 pct 傷害
 *   cdOnAuto   普攻縮短 Q／W／E 剩餘冷卻的 pct
 *   guinsoo    普攻疊攻速 as（最多 max 層，dur 秒），滿層每第三下多一次命中效果
 *   flurry     普攻英雄時攻速 +as dur 秒，冷卻 cd（每次普攻縮短 1 秒）
 *   stackCrit  每次普攻永久暴擊率 +per，上限 max
 *   colossal   附近有敵方英雄時，對英雄的下一次普攻追加 base＋hpK×最大血量，並永久增加 grow×傷害 的最大血量；冷卻 cd
 *   momentum   移動累積移速到 ms，下一次普攻放出：追加 dmg
 *   ambush     不被敵方看見 1 秒以上時，下一次對英雄的普攻追加 dmg＋lv×等級 真實傷害
 *   firstCrit  脫戰後對英雄的第一次普攻必暴擊並回 heal＋hpK×最大血量
 *   threeHit   連續三次普攻同一英雄：緩速 slow 1 秒
 *   distAmp    普攻依距離增傷，最遠 at 公尺時 +max
 *   shred      對英雄造成 type 傷害時降低其防禦 pct（最多 max 層，dur 秒）
 *   skillSlow  技能命中緩速 pct dur 秒（below：只對血量低於此比例的目標）
 *   ccMark     暈眩、擊飛或冰凍英雄時標記易傷 amp，dur 秒
 *   shieldBreak 傷害英雄時削掉其護盾 pct（同一目標 3 秒一次）
 *   twoHit     2 秒內兩次不同命中同一英雄 → 護盾 base＋bad×額外攻擊，冷卻 cd
 *   msOnHeroHit 對英雄造成技能或真實傷害後移速 +ms，dur 秒
 *   focus      技能命中英雄疊層，每層傷害 +per（最多 max，dur 秒）
 *   stormsurge win 秒內對同一英雄造成其最大血量 pct 的傷害 → 2 秒後追加 dmg＋ap
 *   revealFar  距離 dist 以上的技能命中會讓目標現形 dur 秒
 *   ultStorm   施放大絕後 dur 秒內，每秒對 r 內敵方英雄造成 dps 並緩速 slow
 *   ultAs      施放大絕後 dur 秒攻速 +as、移速 +ms
 *   ultAh / basicAh 大絕／一般技能另外的技能加速 v
 *   ultBurn    大絕命中英雄：灼燒 dps dur 秒並降低技能防禦 pct
 *   magicAmp   光環：r 公尺內的敵方英雄受到的技能傷害 +pct
 *   asAura     光環：r 公尺內的敵方英雄攻速 -pct
 *   giantSlayer 對額外血量越多的英雄傷害越高，額外血量 at 時 +max
 *   lowHpAmp   對血量低於 below 的英雄，技能與真實傷害 +pct
 *   missingAd  依自身已損血量，普攻最多 +max
 *   burnAmp    每名被自己灼燒中的敵方英雄，傷害 +pct
 *   execute    傷害後目標血量低於 pct 直接擊殺；bounty＝擊殺英雄多拿的金錢
 *   critReduce 受到的暴擊額外傷害 -pct
 *   dance      受到的傷害有 pct 改成 3 秒流血；參與擊殺時清掉流血並回血
 *   combatRes  與英雄交戰 after 秒後承受的傷害 -pct
 *   steadfast  承受英雄技能傷害 n 次後，技能防禦 +mr、移速 +ms 直到脫戰
 *   idleShield 脫離技能傷害 after 秒後得到 base＋lv×等級 的技能護盾
 *   warmog     8 秒沒受傷時每秒回 pct 最大血量（需額外血量 need 以上）
 *   despair    與英雄交戰時每 every 秒對 r 內敵方英雄造成 dmg＋hpK×額外血量，回復傷害的 heal 倍
 *   timeStacks 每 every 秒疊一層（最多 max），每層 hp／mp／ap
 *   oocMs      脫戰 5 秒後移速 +ms
 *   hubris     參與擊殺後 dur 秒攻擊 +ad，每次再 +per
 *   ultRefund  參與擊殺時返還大絕總冷卻的 pct
 *   takedownOv 參與擊殺後 dur 秒全能吸血 +v
 *   takedownHeal 參與擊殺時，r 內隊友回復 v＋lv×等級
 *   dual       普攻英雄時在光明（防禦 +res）與黑暗（穿透 +pen）之間切換，各 5 秒
 *   support    治療或護盾隊友時：雙方 dur 秒 ap／ah／as／onhit 增益；heal＝另一名隊友回復 pct
 *   statFrom   屬性轉換（units.statMods）：manaToHp、manaToAd、hpToAp、hpToAd、baseAd、adToAh、itemHp
 */
const effs = (h, k) => { const out = []; for (const key in h.psv || {}) { const e = h.psv[key]; if (e && e.k === k) out.push(e); } return out; };
export { effs };
function onhitAmount(h, t, e) {
  return (e.flat || 0) + (e.ad || 0) * h.ad + (e.bad || 0) * bonusAd(h) + (e.ap || 0) * (h.ap || 0)
    + (e.maxHp || 0) * t.maxHp + (e.curHp || 0) * t.hp + (e.missHp || 0) * (t.maxHp - t.hp);
}
function haste(h, dur, ms) { h.st.haste = Math.max(h.st.haste || 0, dur); h.st.hasteMs = Math.max(h.st.hasteMs || 0, ms); h.st.hasteAs = h.st.hasteAs || 0; }
const fxs = (h) => (h.fxs ||= {});
const enemiesIn = (G, h, x, z, r, heroOnly) => G.units.filter((u) => u.alive && u.team !== h.team && u.team <= 2 && (u.kind === 'hero' || (!heroOnly && (u.kind === 'minion' || u.kind === 'monster'))) && Math.hypot(u.x - x, u.z - z) < r + u.radius);
const bonusHp = (h) => Math.max(0, h.maxHp - h.def.stats.hp - h.def.stats.hpLv * (h.level - 1));
const inHeroCombat = (G, h) => G.time - ((h.fxs && h.fxs.heroCombat) ?? -99) < 5 || (h.lastHitBy && h.lastHitBy.kind === 'hero' && G.time - h.lastHitT < 5);
// 限時屬性增益：h.buffs[key] = { stats, until }，units.statMods 會加上去，到期由 itemTick 移除
export function buff(G, h, key, stats, dur, extra) {
  h.buffs = h.buffs || {};
  h.buffs[key] = { stats, until: G.time + dur, ...(extra || {}) };
  recalcStats(h);
}
const procDmg = (G, h, t, v, magic) => v > 0 && t.alive && damage(G, h, t, v, { type: 'proc', magic: !!magic, noKi: true });

// 傳說裝備的普攻前效果：咒刃變體、蓄能、巨像、動量、伏擊、首擊暴擊、距離增傷、損血增傷
function legendBeforeAuto(G, h, t, dmg, opts) {
  const F = fxs(h), hero = t.kind === 'hero';
  opts.extra = opts.extra || [];
  if (F.bladeArmed > G.time && G.time >= (F.bladeCd2 || 0)) for (const e of effs(h, 'spellblade')) {
    F.bladeArmed = 0; F.bladeCd2 = G.time + (e.cd || 1.5);
    const v = (e.base || 0) * baseAd(h) + (e.ap || 0) * (h.ap || 0) + (e.bad || 0) * bonusAd(h) + (e.hpK || 0) * h.maxHp;
    if (e.magic) opts.extra.push([v, true]); else dmg += v;
    if (e.heal) heal(G, h, e.heal + (e.healAp || 0) * (h.ap || 0));
    if (e.mana) addMp(h, e.mana);
    if (e.slowField) for (const u of enemiesIn(G, h, t.x, t.z, e.slowField)) { u.st.slow = Math.max(u.st.slow, 2); u.st.slowAmt = Math.max(u.st.slowAmt, 0.25 * (1 - (u.slowRes || 0))); }
    fx(G).ring(t.x, t.z, e.magic ? '#c8a0ff' : '#ffd34a', e.slowField || 1.8, 0.3); G.emit('spellblade', { h, t });
    break;
  }
  for (const e of effs(h, 'energize')) if ((F.energy || 0) >= 100) {
    F.energy = 0;
    if (e.dmg) opts.extra.push([e.dmg + (e.ap || 0) * (h.ap || 0), !!e.magic]);
    if (e.curHp) dmg += t.hp * e.curHp;
    if (e.chain) for (const u of enemiesIn(G, h, t.x, t.z, 5).filter((u) => u !== t).slice(0, e.chain - 1)) G.later(0.05, () => procDmg(G, h, u, e.dmg || 40, true));
    if (e.ms) haste(h, 1.5, e.ms);
    if (e.leth) buff(G, h, 'charged', { leth: e.leth }, 4);
    if (e.range) F.rangeT = G.time + 0.2;
    fx(G).hitSpark(t.x, 1.2 + t.y, t.z, '#fff3a0', 1, 'light');
    break;
  }
  if (hero) for (const e of effs(h, 'colossal')) if (G.time >= (F.colCd || 0)) { F.colCd = G.time + e.cd; const v = e.base + e.hpK * h.maxHp; dmg += v; h.colHp = (h.colHp || 0) + v * e.grow; recalcStats(h); }
  for (const e of effs(h, 'momentum')) if ((F.mom || 0) > 0.05) { dmg += e.dmg * F.mom; F.mom = 0; }
  if (hero) for (const e of effs(h, 'ambush')) if ((F.unseen >= 1 || F.ambushT > G.time) && G.time >= (F.ambCd || 0)) { F.ambCd = G.time + 3; F.ambushT = 0; opts.extraTrue = (opts.extraTrue || 0) + e.dmg + e.lv * h.level; }
  if (hero) for (const e of effs(h, 'firstCrit')) if (!inHeroCombat(G, h) && G.time >= (F.fcCd || 0)) { F.fcCd = G.time + 8; if (!opts.crit) { dmg *= h.critMul; opts.crit = true; } heal(G, h, e.heal + (e.hpK || 0) * h.maxHp); }
  for (const e of effs(h, 'distAmp')) dmg *= 1 + e.max * Math.min(1, dist(h, t) / e.at);
  for (const e of effs(h, 'missingAd')) dmg *= 1 + e.max * (1 - h.hp / h.maxHp);
  return dmg;
}

// 普攻命中後：技能傷害型命中效果、命中回血、移速、順劈、第 N 下
export function afterAuto(G, h, t, dealt, opts) {
  const F = fxs(h);
  for (const [v, magic] of opts.extra || []) procDmg(G, h, t, v, magic);
  if (opts.extraTrue && t.alive) damage(G, h, t, opts.extraTrue, { type: 'true', noKi: true, rune: true });
  if (h.buffs && h.buffs.ardent) procDmg(G, h, t, h.buffs.ardent.onhit || 20, true);
  if (effs(h, 'energize').length) F.energy = Math.min(100, (F.energy || 0) + 15);
  if (!h.def.melee) for (const e of effs(h, 'splitShot')) for (const u of enemiesIn(G, h, t.x, t.z, e.r).filter((u) => u !== t).slice(0, e.n)) { procDmg(G, h, u, dealt * e.pct, false); fx(G).hitSpark(u.x, 1.1 + u.y, u.z, h.def.color, 0.6, 'light'); }
  for (const e of effs(h, 'cdOnAuto')) for (const k of ['Q', 'W', 'E']) h.cds[k] *= 1 - e.pct;
  for (const e of effs(h, 'guinsoo')) {
    F.gStk = Math.min(e.max, (G.time - (F.gT ?? -99) < e.dur ? F.gStk || 0 : 0) + 1); F.gT = G.time;
    if (F.gStk >= e.max && (F.gN = (F.gN || 0) + 1) % 3 === 0) for (const o of effs(h, 'onhit')) if (!o.minionOnly) procDmg(G, h, t, onhitAmount(h, t, o), true);
  }
  for (const e of effs(h, 'flurry')) {
    if (t.kind === 'hero' && G.time >= (F.flCd || 0)) { F.flCd = G.time + e.cd; F.flT = G.time + e.dur; F.flAs = e.as; }
    else if (F.flCd) F.flCd -= opts.crit ? 2 : 1;
  }
  for (const e of effs(h, 'stackCrit')) if ((h.critStk || 0) < e.max) { h.critStk = Math.min(e.max, (h.critStk || 0) + e.per); recalcStats(h); }
  if (t.kind === 'hero') for (const e of effs(h, 'dual')) {
    F.dualDark = !F.dualDark;
    buff(G, h, 'dual', F.dualDark ? { apen: e.pen, mpenPct: e.pen } : { armor: e.res, mr: e.res }, 5);
  }
  if (t.kind === 'hero') for (const e of effs(h, 'threeHit')) {
    if (F.thId === t.id) F.thN++; else { F.thId = t.id; F.thN = 1; }
    if (F.thN >= 3) { F.thN = 0; t.st.slow = Math.max(t.st.slow, 1); t.st.slowAmt = Math.max(t.st.slowAmt, e.slow * (1 - (t.slowRes || 0))); }
  }
  for (const e of effs(h, 'onhit')) if (e.magic && (!e.minionOnly || t.kind === 'minion')) damage(G, h, t, onhitAmount(h, t, e), { type: 'proc', magic: true, noKi: true });
  for (const e of effs(h, 'onhitHeal')) heal(G, h, e.v);
  for (const e of effs(h, 'msOnAuto')) haste(h, e.dur, e.ms);
  for (const e of effs(h, 'heroProc')) if (e.autoCdr && F.procCd) F.procCd -= e.autoCdr;
  if (h.def.melee) for (const e of effs(h, 'cleave')) {
    for (const u of G.units) if (u !== t && u.alive && u.team !== h.team && u.team <= 2 && (u.kind === 'hero' || u.kind === 'minion' || u.kind === 'monster') && dist(u, t) < e.r + u.radius) damage(G, h, u, dealt * e.pct, { type: 'proc', noKi: true });
  }
  for (const e of effs(h, 'everyN')) {
    F.nHits = (F.nHits || 0) + 1; // 多個「每第 N 下」共用計數（每次普攻只加一次）
    if (F.nHits >= e.n) { F.nHits = 0; damage(G, h, t, (e.flat || 0) + (e.lvDmg || 0) * h.level + (e.ad || 0) * h.ad + (e.bad || 0) * bonusAd(h) + (e.apK || 0) * (h.ap || 0), e.trueDmg ? { type: 'true', noKi: true, rune: true } : { type: 'proc', magic: !!e.magic, noKi: true }); if (h.heroId === 'nami') fx(G).lightning({ x: t.x + 0.6, y: 9, z: t.z - 0.6 }, { x: t.x, y: 1 + t.y, z: t.z }, '#ffe36a'); else fx(G).ring(t.x, t.z, '#ffe08a', 1.4, 0.25); }
  }
}

// 對英雄造成傷害後（普攻或技能）
function itemOnHeroHit(G, h, dst, a, opts, skill) {
  const F = fxs(h), magic = skill || opts.magic;
  for (const e of effs(h, 'gw')) if (e.type === 'any' || (e.type === 'magic') === !!magic) { dst.st.gw = 3; dst.st.gwAmt = Math.max(dst.st.gwAmt || 0, e.pct); }
  for (const e of effs(h, 'heroProc')) if ((!e.skillOnly || skill) && G.time >= (F.procCd || 0)) {
    F.procCd = G.time + e.cd;
    if (e.splash) for (const u of enemiesIn(G, h, dst.x, dst.z, e.splash).filter((u) => u !== dst).slice(0, 3)) G.later(0.05, () => procDmg(G, h, u, (e.dmg + (e.ap || 0) * (h.ap || 0)) * 0.5, true));
    G.later(0.02, () => { if (dst.alive) damage(G, h, dst, e.dmg + (e.ap || 0) * (h.ap || 0) + (e.lvDmg || 0) * h.level, e.trueDmg ? { type: 'true', noKi: true, rune: true } : { type: 'proc', magic: true, noKi: true }); });
    fx(G).hitSpark(dst.x, 1.2 + dst.y, dst.z, '#9fd8ff', 0.8, 'light');
  }
  if (skill) for (const e of effs(h, 'skillBurn')) { dst.st.burn = Math.max(dst.st.burn || 0, e.dur); dst.st.burnDps = Math.max(dst.st.burnDps || 0, e.dps + (e.pctMax || 0) * dst.maxHp); dst.st.burnSrc = h; }
  for (const e of effs(h, 'shred')) if (e.type === 'any' || (e.type === 'magic') === !!magic) {
    const st = dst.st, p = e.type === 'magic' ? 'mrSh' : 'arSh';
    st[p + 'N'] = Math.min(e.max, (st[p + 'T'] > 0 ? st[p + 'N'] || 0 : 0) + 1); st[p + 'T'] = e.dur; st[p + 'P'] = e.pct;
  }
  if (skill) for (const e of effs(h, 'skillPctMax')) if (G.time >= ((dst.st.pmCd || {})[h.id] || 0)) { (dst.st.pmCd ||= {})[h.id] = G.time + e.cd; G.later(0.02, () => procDmg(G, h, dst, dst.maxHp * e.pct, true)); }
  if (skill) for (const e of effs(h, 'skillSlow')) if (!e.below || dst.hp < dst.maxHp * e.below) { dst.st.slow = Math.max(dst.st.slow, e.dur); dst.st.slowAmt = Math.max(dst.st.slowAmt, e.pct * (1 - (dst.slowRes || 0))); }
  if (opts.stun || opts.air || opts.freeze) {
    for (const e of effs(h, 'ccMark')) { dst.st.vuln = e.dur; dst.st.vulnAmp = e.amp; }
    for (const e of effs(h, 'ccRally')) for (const o of G.heroes) if (o.alive && o.team === h.team && dist(o, h) < e.r) { buff(G, o, 'rally', { as: e.as }, e.dur); haste(o, e.dur, e.ms); }
  }
  for (const e of effs(h, 'shieldBreak')) if (dst.st.shield > 0 && G.time >= (dst.st.sbCd || 0)) { dst.st.sbCd = G.time + 3; dst.st.shield *= 1 - e.pct; }
  for (const e of effs(h, 'twoHit')) {
    const last = F.twoHit; F.twoHit = { id: dst.id, t: G.time };
    if (last && last.id === dst.id && G.time - last.t > 0.25 && G.time - last.t < 2 && G.time >= (F.twoCd || 0)) {
      F.twoCd = G.time + e.cd; h.st.shield = (h.st.shield || 0) + (e.base + (e.bad || 0) * bonusAd(h)) * (1 + (h.hsp || 0)); h.st.shieldT = Math.max(h.st.shieldT, 2);
      fx(G).shieldFx(h, '#ffe9a0', 1.5);
    }
  }
  if (skill || opts.type === 'true') for (const e of effs(h, 'msOnHeroHit')) haste(h, e.dur, e.ms);
  if (skill) for (const e of effs(h, 'focus')) { F.fN = Math.min(e.max, (G.time - (F.fT ?? -99) < e.dur ? F.fN || 0 : 0) + 1); F.fT = G.time; }
  for (const e of effs(h, 'stormsurge')) {
    if (F.ssId !== dst.id || G.time - F.ssT0 > e.win) { F.ssId = dst.id; F.ssT0 = G.time; F.ssAcc = 0; }
    F.ssAcc += a;
    if (F.ssAcc >= dst.maxHp * e.pct && G.time >= (F.ssCd || 0)) {
      F.ssCd = G.time + 30; F.ssAcc = 0;
      fx(G).target(dst.x, dst.z, 1.6, '#ffe36a', 2);
      G.later(2, () => { if (dst.alive) { procDmg(G, h, dst, e.dmg + (e.ap || 0) * (h.ap || 0), true); fx(G).lightning({ x: dst.x + 0.5, y: 9, z: dst.z - 0.5 }, { x: dst.x, y: 1, z: dst.z }, '#ffe36a'); } });
    }
  }
  if (skill) for (const e of effs(h, 'revealFar')) if (dist(h, dst) > e.dist) dst.reveal = Math.max(dst.reveal || 0, G.time + e.dur);
  if (opts.type === 'super') for (const e of effs(h, 'ultBurn')) { dst.st.burn = Math.max(dst.st.burn || 0, e.dur); dst.st.burnDps = Math.max(dst.st.burnDps || 0, e.dps); dst.st.burnSrc = h; dst.st.mrShN = 1; dst.st.mrShT = e.dur; dst.st.mrShP = e.pct; }
  // 龍魂與究極神龍
  if ((h.soul === 'fire' || h.soul === 'hextech') && G.time >= (F.soulCd || 0)) {
    F.soulCd = G.time + 3;
    const v = h.soul === 'fire' ? 40 + 6 * h.level : 30 + 5 * h.level;
    G.later(0.05, () => { if (!dst.alive) return; procDmg(G, h, dst, v, true); if (h.soul === 'hextech') { dst.st.slow = Math.max(dst.st.slow, 1); dst.st.slowAmt = Math.max(dst.st.slowAmt, 0.3 * (1 - (dst.slowRes || 0))); fx(G).lightning({ x: h.x, y: 1.4, z: h.z }, { x: dst.x, y: 1.2, z: dst.z }, '#7fe8ff'); } else fx(G).explode(dst.x, dst.z, '#ff6a3a', 1.4); });
  }
  if (h.elder > 0) {
    dst.st.burn = Math.max(dst.st.burn || 0, 3); dst.st.burnDps = Math.max(dst.st.burnDps || 0, 15); dst.st.burnSrc = h;
    if (dst.hp > 0 && dst.hp < dst.maxHp * 0.2) G.later(0, () => { if (dst.alive) { damage(G, h, dst, dst.hp + 1, { type: 'true', noKi: true, rune: true }); fx(G).explode(dst.x, dst.z, '#d8b4ff', 2); G.emit('elderExecute', { h, dst }); } });
  }
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
  const magic = skill || opts.magic, trueD = opts.type === 'true';
  if (src && src.kind === 'hero') {
    for (const e of effs(src, 'ramp')) a *= 1 + Math.min(e.max, e.per * Math.max(0, G.time - (fxs(src).rampT0 ?? G.time)));
    for (const e of effs(src, 'eternal')) if (src.hp > src.maxHp * 0.5) a *= 1 + e.dmg;
    for (const e of effs(src, 'giantSlayer')) a *= 1 + e.max * Math.min(1, bonusHp(dst) / e.at);
    if (magic || trueD) for (const e of effs(src, 'lowHpAmp')) if (dst.hp < dst.maxHp * e.below) a *= 1 + e.pct;
    for (const e of effs(src, 'burnAmp')) a *= 1 + e.pct * G.heroes.filter((u) => u.alive && u.team !== src.team && u.st.burn > 0 && u.st.burnSrc === src).length;
    if (skill) for (const e of effs(src, 'focus')) { const F = fxs(src); if (G.time - (F.fT ?? -99) < e.dur) a *= 1 + e.per * (F.fN || 0); }
    if (src.buffs && src.buffs.empower && skill) a *= 1 + (src.buffs.empower.dmg || 0);
    for (const e of effs(src, 'selfLowHp')) if (src.hp < src.maxHp * e.below) a *= 1 + e.dmg;
    for (const e of effs(src, 'vsCc')) if (dst.st.stun > 0 || dst.st.frozen > 0 || dst.st.slow > 0) a *= 1 + e.pct;
    if (skill) { const F = fxs(src); if (F.copyT > G.time) { if (!F.copyEnd) F.copyEnd = G.time + 0.4; if (G.time < F.copyEnd) a *= 1 + F.copyAmp; else F.copyT = F.copyEnd = 0; } } // 複製：同一招的多段命中都算
  }
  if (dst.st.vuln > 0) a *= 1 + (dst.st.vulnAmp || 0);
  if (src && src.soul === 'chem' && src.hp < src.maxHp * 0.5) a *= 1.1; // 毒霧之魂
  if (dst.soul === 'chem' && dst.hp < dst.maxHp * 0.5) a *= 0.9;
  if (magic) for (const o of G.heroes) if (o.alive && o.team !== dst.team && o.psv) for (const k in o.psv) { const e = o.psv[k]; if (e && e.k === 'magicAmp' && dist(o, dst) < e.r) { a *= 1 + e.pct; break; } }
  if (opts.crit && src) for (const e of effs(dst, 'critReduce')) a *= 1 - e.pct * (1 - 1 / (src.critMul || 1.75));
  for (const e of effs(dst, 'combatRes')) { const F = fxs(dst); if (F.c0 !== undefined && G.time - F.c0 >= e.after) a *= 1 - e.pct; }
  // 騎士誓約：附近的隊友持有誓約時，替自己承擔一部分傷害
  if (!opts.dot && dst.kind === 'hero') for (const o of G.heroes) if (o !== dst && o.alive && o.team === dst.team && o.psv) for (const k in o.psv) { const e = o.psv[k]; if (e && e.k === 'vow' && dist(o, dst) < e.r) { const d = a * e.pct; a -= d; G.later(0, () => { if (o.alive) damage(G, null, o, d, { type: 'true', noKi: true, dot: true }); }); } }
  if (!opts.dot) for (const e of effs(dst, 'dance')) { const F = fxs(dst), d = a * e.pct; a -= d; F.bleed = (F.bleed || 0) + d; F.bleedRate = F.bleed / 3; F.bleedSrc = src; }
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
    if (v > 0) { dst.st.shield = (dst.st.shield || 0) + v * (1 + (dst.hsp || 0)); dst.st.shieldT = Math.max(dst.st.shieldT, e.dur); }
    if (e.regen) { F.regenT = G.time + e.dur; F.regenV = e.regen * dst.maxHp / e.dur; }
    if (e.ms || e.ten) buff(G, dst, 'lifeline', { ms: e.ms || 0, ten: e.ten || 0 }, e.dur);
    if (e.ov) buff(G, dst, 'lifelineOv', { ov: e.ov }, 8);
    fx(G).shieldFx(dst, '#ffd34a', e.dur); G.emit('lifeline', dst);
  }
  F.lastDmg = G.time;
  if (magic) {
    F.lastMagic = G.time;
    if (fromHero) for (const e of effs(dst, 'steadfast')) { F.sfN = (G.time - (F.sfT ?? -99) < 5 ? F.sfN || 0 : 0) + 1; F.sfT = G.time; if (F.sfN >= e.n) buff(G, dst, 'steadfast', { mr: e.mr, ms: e.ms }, 5); }
  }
  if (src && src.kind === 'hero') for (const e of effs(src, 'execute')) if (dst.hp > 0 && dst.hp < dst.maxHp * e.pct) { G.later(0, () => { if (dst.alive) damage(G, src, dst, dst.hp + 1, { type: 'true', noKi: true, rune: true }); }); break; }
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
export function onTakedown(G, h, killer) {
  let changed = false;
  for (const e of effs(h, 'hubris')) { const v = (h.buffs && h.buffs.hubris ? h.buffs.hubris.stats.ad + e.per : e.ad); buff(G, h, 'hubris', { ad: v }, e.dur); }
  for (const e of effs(h, 'ultRefund')) { const s = h.def.skills.R; h.cds.R = Math.max(0, h.cds.R - s.cd * e.pct); }
  for (const e of effs(h, 'takedownOv')) buff(G, h, 'feast', { ov: e.v }, e.dur);
  for (const e of effs(h, 'takedownHeal')) for (const a of G.heroes) if (a.alive && a.team === h.team && dist(a, h) < e.r) heal(G, a, e.v + e.lv * h.level);
  if (killer === h) for (const e of effs(h, 'execute')) if (e.bounty) addGold(G, h, e.bounty, h);
  const F = h.fxs; if (F && F.bleed > 0 && effs(h, 'dance').length) { heal(G, h, F.bleed * 0.5); F.bleed = 0; }
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
  // 岩山之魂：5 秒沒受傷就得到護盾
  if (h.soul === 'earth') { const F0 = fxs(h); if (G.time - (F0.lastDmg ?? -99) > 5 && !(h.st.shield > 0)) { h.st.shield = 60 + 14 * h.level; h.st.shieldT = 9999; } }
  const F = fxs(h);
  for (const e of effs(h, 'mpRegen')) addMp(h, (G.time - (F && F.heroCombat || -99) < 5 ? e.combat : e.v) * dt);
  if (!F) return;
  if (F.regenT > G.time) heal(G, h, F.regenV * dt);
  // 限時增益到期
  if (h.buffs) { let ch = false; for (const k in h.buffs) if (h.buffs[k].until <= G.time) { delete h.buffs[k]; ch = true; } if (ch) recalcStats(h); }
  const fight = inHeroCombat(G, h);
  if (fight) { if (F.c0 === undefined) F.c0 = G.time; } else F.c0 = undefined;
  // 移動累積：蓄能、動量
  const moved = F.lx === undefined ? 0 : Math.hypot(h.x - F.lx, h.z - F.lz); F.lx = h.x; F.lz = h.z;
  if (moved < 2) {
    if (effs(h, 'energize').length) F.energy = Math.min(100, (F.energy || 0) + moved * 9);
    for (const e of effs(h, 'momentum')) F.mom = Math.min(1, (F.mom || 0) + moved / 25);
  }
  // 伏擊：不被敵方看見的時間
  if (effs(h, 'ambush').length && G.vision) { if (!seen(G, 1 - h.team, h)) F.unseen = (F.unseen || 0) + dt; else { if (F.unseen >= 1) F.ambushT = G.time + 1; F.unseen = 0; } }
  // 脫戰移速
  for (const e of effs(h, 'oocMs')) { const want = !fight && G.time - h.lastHitT > 5; if (want !== !!(h.buffs && h.buffs.ooc)) { if (want) buff(G, h, 'ooc', { ms: e.ms }, 9999); else { delete h.buffs.ooc; recalcStats(h); } } }
  // 時光之杖：每段時間疊一層
  for (const e of effs(h, 'timeStacks')) if ((h.tStk || 0) < e.max) { F.tAcc = (F.tAcc || 0) + dt; if (F.tAcc >= e.every) { F.tAcc = 0; h.tStk = (h.tStk || 0) + 1; recalcStats(h); } }
  // 大絕後的風暴
  if (F.stormT > G.time) for (const e of effs(h, 'ultStorm')) { F.stAcc = (F.stAcc || 0) + dt; if (F.stAcc >= 0.5) { F.stAcc = 0; for (const u of enemiesIn(G, h, h.x, h.z, e.r, true)) { procDmg(G, h, u, e.dps * 0.5, true); u.st.slow = Math.max(u.st.slow, 0.6); u.st.slowAmt = Math.max(u.st.slowAmt, e.slow * (1 - (u.slowRes || 0))); } } }
  // 絕望：交戰中每隔幾秒燒附近英雄並回血
  if (fight) for (const e of effs(h, 'despair')) { F.dAcc = (F.dAcc || 0) + dt; if (F.dAcc >= e.every) { F.dAcc = 0; let tot = 0; for (const u of enemiesIn(G, h, h.x, h.z, e.r, true)) tot += procDmg(G, h, u, e.dmg + e.hpK * bonusHp(h), true) || 0; if (tot) heal(G, h, tot * e.heal); } }
  // 死亡之舞的流血
  if (F.bleed > 0) { const d = Math.min(F.bleed, F.bleedRate * dt); F.bleed -= d; F.bleedAcc = (F.bleedAcc || 0) + d; if (F.bleedAcc >= 4 || F.bleed <= 0) { const v = F.bleedAcc; F.bleedAcc = 0; damage(G, F.bleedSrc && F.bleedSrc.alive ? F.bleedSrc : null, h, v, { type: 'true', noKi: true, dot: true }); } }
  // 技能護盾（脫離技能傷害一段時間後）
  for (const e of effs(h, 'idleShield')) if (G.time - (F.lastMagic ?? -99) > e.after && !(h.st.shield > 0)) { h.st.shield = e.base + e.lv * h.level; h.st.shieldT = 9999; }
  // 好戰活力：8 秒沒受傷時快速回血
  for (const e of effs(h, 'warmog')) if (G.time - (F.lastDmg ?? -99) > (e.after || 8) && bonusHp(h) >= e.need) heal(G, h, h.maxHp * e.pct * dt);
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

// 治療或護盾隊友時（小櫻 E、比克 E、18 號 E 會呼叫）：輔助裝備的增益
export function onSupport(G, h, a) {
  for (const e of effs(h, 'support')) {
    const st = { ap: e.ap || 0, ah: e.ah || 0, as: e.as || 0 };
    buff(G, h, 'support', st, e.dur, e.onhit ? { onhit: e.onhit } : null);
    if (a && a !== h) buff(G, a, 'support', st, e.dur, e.onhit ? { onhit: e.onhit } : null);
    if (e.onhit) { buff(G, h, 'ardent', {}, e.dur, { onhit: e.onhit }); if (a && a !== h) buff(G, a, 'ardent', {}, e.dur, { onhit: e.onhit }); }
    if (e.heal) { const o = G.heroes.filter((o) => o.alive && o.team === h.team && o !== h && o !== a && dist(o, h) < 10).sort((p, q) => p.hp / p.maxHp - q.hp / q.maxHp)[0]; if (o) heal(G, o, e.heal + (e.healAp || 0) * (h.ap || 0)); }
  }
}

export const traits = { onHeroHit, tick, beforeTaken, afterTaken, onSkillHitAny, onTakedown, onDeath };
