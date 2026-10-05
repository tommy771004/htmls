// 單位：英雄、小兵、建築。移動、碰撞、傷害、死亡、經驗。
import {
  HEROES, MINION, MINION_GROWTH, TOWER, STAT, KI_MAX, KI_BAR, MAX_LEVEL, xpToNext, respawnTime, XP_SHARE_RADIUS,
  FOUNTAIN, BASE, COMBO_WINDOW, HITSTOP, SPARK, WAVE_EVERY, FIRST_WAVE, SIEGE_FROM_WAVE, GOLD, ITEMS, APE_BUFF, DRAGON, RES, JUNGLE_BUFF, TEAR_MAX, RUNE_REC,
} from './config.js';
import { collide, obstaclesNear, lanePath, heightAt, STRUCTURES, laneProgress } from './map.js';

let nextId = 1;
export const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
export const angTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function baseUnit(kind, team, x, z, radius, hp) {
  return {
    id: nextId++, kind, team, x, z, y: 0, vy: 0, radius, hp, maxHp: hp, alive: true, facing: team === 0 ? Math.PI * 0.75 : -Math.PI * 0.25,
    st: { stun: 0, slow: 0, slowAmt: 0, frozen: 0, shield: 0, shieldT: 0, spark: 0, mark: 0, invuln: 0 },
    kx: 0, kz: 0, atkCd: 0, anim: { name: 'idle', t: 0, k: 0 }, lastHitBy: null, lastHitT: -99, deadT: 0, flash: 0,
  };
}

export function makeHero(G, heroId, team, lane, isPlayer) {
  const def = HEROES[heroId];
  const u = baseUnit('hero', team, FOUNTAIN[team][0], FOUNTAIN[team][1], 0.75, def.stats.hp);
  Object.assign(u, {
    heroId, def, lane, isPlayer, level: 1, xp: 0, sp: 1, ranks: { Q: 0, W: 0, E: 0, R: 0 }, cds: { Q: 0, W: 0, E: 0, R: 0, D: 0, B: 0, S: 0, T: 0 },
    ki: 100, kills: 0, deaths: 0, assists: 0, chain: 0, chainT: -9, target: null, goal: null, order: null, action: null,
    respawn: 0, recall: 0, empowered: 0, charging: false, damagers: new Map(), lastAttackHeroT: -99, cs: 0, hitstopOwner: isPlayer,
    gold: GOLD.start, inv: [], path: null, apeBuff: 0, omen: 0, wish: 0, form: 'base',
    // 資源、符文、裝備被動與野怪增益
    res: def.res, mp: 0, maxMp: 0, tear: 0, graspHp: 0, rune: RUNE_REC[heroId] || 'conqueror', rs: { stacks: 0, t: -99, hits: [], cd: 0, charge: 0 },
    bladeT: 0, bladeCd: 0, gaCd: 0, actCd: {}, stasis: 0, blue: 0, red: 0,
  });
  recalcStats(u);
  u.hp = u.maxHp; u.mp = u.maxMp;
  return u;
}
export function itemStats(u) {
  const t = { ad: 0, hp: 0, armor: 0, mr: 0, as: 0, ms: 0, ki: 0, ah: 0, skill: 0, dmg: 0, vision: 0, regen: 0, detect: 0, mp: 0, mpr: 0, ap: 0, crit: 0, ls: 0, leth: 0, apen: 0, mpen: 0, mpenPct: 0, ten: 0, ov: 0 };
  let keepCc = 1;
  for (const id of u.inv || []) {
    const it = ITEMS.find((i) => i.id === id); if (!it || !it.stats) continue;
    for (const k in it.stats) { if (k === 'ten') keepCc *= 1 - it.stats.ten; else t[k] += it.stats[k]; }
  }
  if (u.elixir && u.elixir.stats) for (const k in u.elixir.stats) { if (k === 'ten') keepCc *= 1 - u.elixir.stats.ten; else t[k] += u.elixir.stats[k]; }
  t.ten = 1 - keepCc; // 韌性相乘疊加：兩件 30% 是 51%，不是 60%
  return t;
}
// 裝備被動：同名被動不疊加（數字取最大；荊棘取反彈最強的那件）。主動道具依身上順序排列
export function itemPassives(u) {
  const p = {}, acts = [];
  for (const id of u.inv || []) {
    const it = ITEMS.find((i) => i.id === id); if (!it) continue;
    if (it.psv) for (const k in it.psv) {
      const v = it.psv[k];
      if (typeof v === 'number') p[k] = Math.max(p[k] || 0, v);
      else if (v.k) { if (!p[k] || (v.lv || 0) > (p[k].lv || 0)) p[k] = v; } // 裝備效果：同名不疊，取較強的那件
      else if (!p[k] || v.pct > p[k].pct) p[k] = v;
    }
    if (it.act && !acts.some((a) => a.id === it.act.id)) acts.push({ ...it.act, item: id });
  }
  if (u.elixir && u.elixir.psv) Object.assign(p, u.elixir.psv);
  return { p, acts };
}
export function recalcStats(u) {
  const s = u.def.stats, lv = u.level - 1, it = itemStats(u);
  const ratio = u.maxHp ? u.hp / u.maxHp : 1;
  u.maxHp = s.hp + s.hpLv * lv + it.hp; u.hp = ratio * u.maxHp;
  // 普攻間隔＝基礎間隔 ÷ (1＋每級攻速＋裝備攻速)；防禦是數值（承受 ×100／(100＋防禦)）
  u.ad = s.ad + s.adLv * lv + it.ad; u.range = s.range; u.as = Math.max(STAT.asMinInterval, s.as / (1 + STAT.asLv * lv + it.as)); u.ms = s.ms * (1 + it.ms);
  u.armor = s.armor + STAT.armorLv * lv + it.armor;
  u.ah = it.ah; u.leth = it.leth; u.apen = it.apen; u.mpen = it.mpen; u.mpenPct = it.mpenPct; u.ten = it.ten; u.ov = it.ov;
  u.kiGain = 1 + it.ki; u.skillMul = 1 + it.skill; u.dmgMul = 1 + it.dmg; u.visionBonus = it.vision; u.regen = it.regen; u.detect = it.detect;
  const { p, acts } = itemPassives(u);
  u.psv = p; u.acts = acts;
  u.maxHp += u.graspHp || 0; u.hp = ratio * u.maxHp;
  u.mr = (s.mr ?? s.armor) + STAT.armorLv * lv + it.mr;
  u.crit = Math.min(1, it.crit); u.critMul = p.critDmg || 1.75; u.ls = it.ls;
  // 魔力：上限加上裝備與「積蓄」層數；能量型固定
  const oldMp = u.maxMp || 0;
  if (u.res === 'energy') { u.maxMp = RES.energy.max; u.mpRegen = RES.energy.regen; }
  else { u.maxMp = s.mp + s.mpLv * lv + it.mp + (p.tear ? Math.min(TEAR_MAX, u.tear || 0) : 0); u.mpRegen = (s.mpr + s.mprLv * lv) * (1 + it.mpr); }
  if (oldMp) u.mp = clamp(u.mp + Math.max(0, u.maxMp - oldMp), 0, u.maxMp);
  u.ap = (it.ap + (p.mpAp || 0) * (u.res === 'energy' ? 0 : u.maxMp)) * (1 + (p.apAmp || 0));
  if (u.blue > 0) u.ah += JUNGLE_BUFF.blue.ah;
  u.hpr = it.hpr; u.hsp = it.hsp; u.slowRes = 0; u.healAmp = 0;
  if (it.critDmg) u.critMul += it.critDmg;
  statMods(u);
}
// 依層數或其他屬性算出的加成（裝備效果，見 traits.js 的種類一覽）
function statMods(u) {
  for (const key in u.psv) {
    const e = u.psv[key]; if (!e || !e.k) continue;
    const n = (u.stk && u.stk[key]) || 0;
    if (e.k === 'stacks') { if (e.ap) u.ap += e.ap * n; if (e.ov) u.ov += e.ov * n; }
    else if (e.k === 'adaptiveMs') { const af = u.ms * 46 * e.pct, bad = u.ad - u.def.stats.ad - u.def.stats.adLv * (u.level - 1); if ((u.ap || 0) > bad) u.ap += af; else u.ad += af * 0.6; }
    else if (e.k === 'slowResist') u.slowRes = Math.max(u.slowRes, e.v);
    else if (e.k === 'eternal') u.healAmp = e.heal;
  }
}
export function addMp(h, v) { if (h.alive && h.maxMp) h.mp = clamp(h.mp + v, 0, h.maxMp); }
export function makeMinion(G, kind, team, lane) {
  const d = MINION[kind], grow = 1 + MINION_GROWTH * (G.time / 60);
  const path = lanePath(lane, team).concat([{ x: BASE[1 - team][0], z: BASE[1 - team][1] }]);
  const u = baseUnit('minion', team, path[0].x, path[0].z, d.radius, d.hp * grow);
  Object.assign(u, { mkind: kind, structMul: d.structMul || 1.5, lane, path, wp: 1, dmg: d.dmg * grow, range: d.range, as: d.cd, ms: d.speed, xp: d.xp, sight: d.sight, target: null, retarget: 0, armor: 0 });
  return u;
}

export function makeStructure(G, s) {
  const hp = s.kind === 'core' ? TOWER.core : TOWER.hp[s.tier === 'inner' ? 1 : 0];
  const u = baseUnit(s.kind, s.team, s.x, s.z, s.kind === 'core' ? 3.2 : TOWER.radius, hp);
  Object.assign(u, { sid: s.id, tier: s.tier, lane: s.lane, range: TOWER.range, target: null, shots: 0, armor: 0, charge: 0 });
  return u;
}

export function createWorld() {
  const G = {
    time: 0, units: [], heroes: [], minions: [], structures: [], projectiles: [], actions: [], phase: 'select',
    kills: [0, 0], player: null, timeScale: 1, hitstop: 0, slowmo: 0, slowmoScale: 1, nextWave: FIRST_WAVE, waveN: 0, winner: -1,
    listeners: {}, combo: { n: 0, t: -9, dmg: 0 }, aiFrozen: false,
    on(ev, fn) { (this.listeners[ev] ||= []).push(fn); },
    emit(ev, d) { const l = this.listeners[ev]; if (l) for (const f of l) f(d); },
  };
  for (const s of STRUCTURES) { const u = makeStructure(G, s); G.structures.push(u); G.units.push(u); }
  return G;
}

export function addUnit(G, u) { G.units.push(u); if (u.kind === 'hero') G.heroes.push(u); else if (u.kind === 'minion') G.minions.push(u); G.emit('spawn', u); return u; }

/* ---------------- 結構規則 ---------------- */
export function vulnerable(G, s) {
  if (s.kind !== 'tower' && s.kind !== 'core') return true;
  if (s.kind === 'tower') {
    if (s.tier === 'outer') return true;
    return !G.structures.some((o) => o.kind === 'tower' && o.alive && o.team === s.team && o.lane === s.lane && o.tier === 'outer');
  }
  return G.structures.some((o) => o.kind === 'tower' && !o.alive && o.team === s.team && o.tier === 'inner');
}

/* ---------------- 傷害 ---------------- */
// opts: { type: 'L'|'M'|'H'|'skill'|'super'|'tower'|'minion'|'true', knock: power, kdir: angle, stun, air, slow, slowT, freeze, noKi, fx: name, color }
export function damage(G, src, dst, amount, opts = {}) {
  if (!dst.alive || dst.st.invuln > 0) return 0;
  if (src && src.team === dst.team) return 0;
  if (!vulnerable(G, dst)) { G.emit('immune', { dst, src }); return 0; }
  // 眼：每次命中扣 1
  if (dst.kind === 'ward') { dst.hp -= 1; dst.flash = 0.12; G.emit('hit', { src, dst, amount: 1, opts }); if (dst.hp <= 0) kill(G, dst, src); return 1; }
  // 從暗處出手會短暫現形
  if (src && (src.kind === 'hero' || src.kind === 'minion') && (dst.kind === 'hero' || dst.kind === 'minion')) src.reveal = G.time + 1.2;
  let a = amount;
  if (src && src.st && src.st.spark > 0) a *= SPARK.dmg;
  if (src && src.kind === 'hero') { a *= src.dmgMul || 1; if (src.apeBuff > 0) a *= 1 + APE_BUFF.dmg; if (src.omen > 0) a *= 1 + DRAGON.omen.dmg; if (src.wish > 0) a *= 1 + DRAGON.wish.dmg; if (opts.type === 'skill' || opts.type === 'super') a *= src.skillMul || 1; }
  if (src && src.kind === 'hero' && src.rune === 'conqueror' && src.rs.stacks && G.time - src.rs.t < 5 && dst.kind === 'hero') a *= 1 + 0.015 * src.rs.stacks;
  // 普攻、小兵、塔、野怪是物理傷害（物理減傷），技能是技能傷害（技能減傷），真實傷害不減
  if (dst.kind === 'hero' && opts.type !== 'true') a *= defMul(src, dst, opts.type === 'skill' || opts.type === 'super' || opts.magic);
  if (dst.kind === 'tower' || dst.kind === 'core') { if (src && src.kind === 'hero' && (opts.type === 'skill' || opts.type === 'super')) a *= 0.55; }
  if (G.traits) a = G.traits.beforeTaken(G, src, dst, a, opts);
  if (dst.st.shield > 0) { const s = Math.min(dst.st.shield, a); dst.st.shield -= s; a -= s; }
  a = Math.round(a);
  // 天使光環：致命傷害時倒下，3 秒後原地復活
  if (dst.kind === 'hero' && a >= dst.hp && dst.psv && dst.psv.ga && G.time >= dst.gaCd) {
    dst.gaCd = G.time + dst.psv.ga; dst.hp = 1; dst.st.invuln = 3; dst.st.stun = 3; dst.st.shield = 0; dst.recall = 0; dst.charging = false; interrupt(G, dst);
    G.emit('stasis', { h: dst, dur: 3, kind: 'revive' });
    G.later(3, () => { if (!dst.alive) return; dst.hp = dst.maxHp * 0.4; dst.mp = Math.max(dst.mp, dst.maxMp * 0.3); dst.st.stun = 0; G.emit('revive', dst); });
    return 0;
  }
  dst.hp -= a; dst.flash = 0.12;
  if (G.traits && dst.kind === 'hero' && dst.hp > 0) G.traits.afterTaken(G, src, dst, a, opts);
  if (G.traits && src && src.kind === 'hero' && dst.kind !== 'hero' && (opts.type === 'skill' || opts.type === 'super')) G.traits.onSkillHitAny(G, src, dst);
  const basic = opts.type === 'L' || opts.type === 'M' || opts.type === 'H';
  if (src && src.kind === 'hero' && basic && a > 0) {
    // 普攻吸血；魔人之牙把溢出的血量轉成護盾
    if (src.ls > 0) { const amt = a * src.ls * (dst.kind === 'hero' ? 1 : 0.6), room = src.maxHp - src.hp; heal(G, src, amt); if (src.psv.overheal && amt > room) { src.st.shield = Math.min(src.maxHp * src.psv.overheal, src.st.shield + amt - room); src.st.shieldT = Math.max(src.st.shieldT, 6); } }
    // 荊棘：被英雄普攻時反彈並施加重傷
    const th = dst.kind === 'hero' && dst.psv && dst.psv.thorns;
    if (th && !opts.thorn) { damage(G, dst, src, th.base + th.lv * dst.level + a * th.pct, { type: 'true', noKi: true, thorn: true }); src.st.gw = 3; src.st.gwAmt = Math.max(src.st.gw > 0 ? src.st.gwAmt || 0 : 0, th.gw); }
  }
  // 全能吸血：所有傷害都回血，技能（多為範圍技）只算三分之一；打小兵野怪打六折
  if (src && src.kind === 'hero' && src.ov > 0 && a > 0 && !opts.thorn && !opts.dot) heal(G, src, a * src.ov * (basic ? 1 : STAT.ovSkill) * (dst.kind === 'hero' ? 1 : 0.6));
  if (G.traits && src && src.kind === 'hero' && dst.kind === 'hero' && a > 0 && !opts.rune && !opts.thorn && !opts.dot) G.traits.onHeroHit(G, src, dst, a, opts);
  dst.lastHitBy = src; dst.lastHitT = G.time;
  if (src && src.kind === 'hero' && dst.kind === 'hero') { dst.damagers.set(src, G.time); src.lastAttackHeroT = G.time; src.lastHeroTarget = dst; }
  // 氣力
  if (!opts.noKi) {
    if (src && src.kind === 'hero') addKi(G, src, (a * (dst.kind === 'hero' ? 0.34 : 0.14) + (opts.type === 'L' || opts.type === 'M' || opts.type === 'H' ? 6 : 0)) * (src.kiGain || 1));
    if (dst.kind === 'hero') addKi(G, dst, a * 0.18 * (dst.kiGain || 1));
  }
  // 狀態
  if (dst.kind === 'monster') G.emit('monsterHit', { dst, src });
  if ((dst.kind === 'hero' || dst.kind === 'minion' || (dst.kind === 'monster' && !dst.boss))) {
    if (opts.knock) { const ang = opts.kdir ?? (src ? angTo(src, dst) : 0), p = opts.knock * (dst.kind === 'minion' ? 1.4 : 1); dst.kx += Math.sin(ang) * p; dst.kz += Math.cos(ang) * p; }
    const ten = dst.kind === 'hero' ? 1 - (dst.ten || 0) : 1; // 韌性縮短暈眩、冰凍與緩速；擊飛不受影響
    if (opts.stun) dst.st.stun = Math.max(dst.st.stun, opts.stun * (dst.kind === 'hero' ? ten : 1.3));
    if (opts.air) { dst.st.stun = Math.max(dst.st.stun, opts.air); dst.vy = Math.max(dst.vy, opts.air * 9.8 * 0.5); }
    if (opts.freeze) { dst.st.frozen = Math.max(dst.st.frozen, opts.freeze * ten); dst.st.stun = Math.max(dst.st.stun, opts.freeze * ten); }
    if (opts.slow) { dst.st.slow = Math.max(dst.st.slow, (opts.slowT || 1.5) * ten); dst.st.slowAmt = Math.max(dst.st.slowAmt, opts.slow * (1 - (dst.slowRes || 0))); }
    if (dst.kind === 'hero' && (opts.stun || opts.air || opts.freeze || a > 0)) { if (dst.recall > 0) cancelRecall(G, dst); if (opts.stun || opts.air || opts.freeze) interrupt(G, dst); }
  }
  // 連擊數與頓幀（只算玩家參與的命中）
  const P = G.player;
  if (P && src === P) {
    const c = G.combo;
    if (G.time - c.t > COMBO_WINDOW) { c.n = 0; c.dmg = 0; }
    c.n++; c.dmg += a; c.t = G.time;
    const hs = HITSTOP[opts.type] ?? 0;
    if (hs) G.hitstop = Math.max(G.hitstop, hs);
  } else if (P && dst === P && a > 0 && (opts.type === 'skill' || opts.type === 'super' || opts.type === 'H')) {
    G.hitstop = Math.max(G.hitstop, 0.04);
  }
  G.emit('hit', { src, dst, amount: a, opts });
  if (dst.hp <= 0) kill(G, dst, src);
  return a;
}
// 防禦減傷：先 ％穿透再固定穿透，防禦不會被穿到負值；原作的「減防」效果另外直接改 dst 的防禦
export function defMul(src, dst, magic) {
  let d = (magic ? dst.mr : dst.armor) || 0;
  if (src && src.kind === 'hero' && d > 0) d = Math.max(0, d * (1 - ((magic ? src.mpenPct : src.apen) || 0)) - ((magic ? src.mpen : src.leth) || 0));
  return d >= 0 ? 100 / (100 + d) : 2 - 100 / (100 - d);
}
export function heal(G, u, amount) { if (!u.alive) return; if (u.st.gw > 0) amount *= 1 - (u.st.gwAmt || 0); if (u.healAmp && u.hp < u.maxHp * 0.5) amount *= 1 + u.healAmp; u.hp = Math.min(u.maxHp, u.hp + amount); }

export function addKi(G, h, v) {
  if (!h.alive) return;
  const before = Math.floor(h.ki / KI_BAR);
  h.ki = clamp(h.ki + v, 0, KI_MAX);
  const after = Math.floor(h.ki / KI_BAR);
  if (after > before) G.emit('kibar', { h, bars: after });
}

export function addGold(G, h, g, at) { if (h.kind !== 'hero') return; h.gold += Math.round(g); G.emit('gold', { h, g: Math.round(g), at }); }

export function gainXp(G, h, xp) {
  if (!h.alive && h.kind !== 'hero') return;
  if (h.level >= MAX_LEVEL) return;
  h.xp += xp;
  while (h.level < MAX_LEVEL && h.xp >= xpToNext(h.level)) {
    h.xp -= xpToNext(h.level); h.level++; h.sp++;
    const old = h.maxHp; recalcStats(h); h.hp += (h.maxHp - old) * 0.6 + h.maxHp * 0.05; h.hp = Math.min(h.hp, h.maxHp);
    if (h.psv && h.psv.lvMp) addMp(h, h.maxMp * h.psv.lvMp);
    G.emit('levelup', h);
  }
  if (h.level >= MAX_LEVEL) h.xp = 0;
}

function kill(G, u, src) {
  u.alive = false; u.hp = 0; u.deadT = 0; u.action = null; u.target = null;
  const killerTeam = 1 - u.team;
  if (u.kind === 'minion') {
    const near = G.heroes.filter((h) => h.alive && h.team === killerTeam && dist(h, u) < XP_SHARE_RADIUS);
    const share = near.length > 1 ? u.xp * 1.3 / near.length : u.xp;
    for (const h of near) gainXp(G, h, share);
    if (src && src.kind === 'hero') { src.cs++; addGold(G, src, GOLD[u.mkind] || 18, u); }
  } else if (u.kind === 'hero') {
    u.deaths++; u.respawn = respawnTime(u.level); u.recall = 0; u.charging = false;
    G.kills[killerTeam]++;
    const killer = src && src.kind === 'hero' ? src : [...u.damagers.entries()].filter(([h, t]) => G.time - t < 10 && h.team === killerTeam).sort((a, b) => b[1] - a[1]).map((e) => e[0])[0];
    const assists = [...u.damagers.entries()].filter(([h, t]) => G.time - t < 10 && h !== killer && h.team === killerTeam).map((e) => e[0]);
    const bounty = 140 + u.level * 38;
    if (killer) { killer.kills++; gainXp(G, killer, bounty); addKi(G, killer, 120); addGold(G, killer, GOLD.hero, u); }
    // 野怪增益轉給擊殺者
    if (killer) for (const b of ['blue', 'red']) if (u[b] > 0) { killer[b] = JUNGLE_BUFF[b].dur; G.emit('jungleBuff', { h: killer, b, stolen: true }); }
    if (u.blue > 0) { u.blue = 0; recalcStats(u); } u.red = 0;
    for (const a of assists) { a.assists++; gainXp(G, a, bounty * 0.5); addGold(G, a, GOLD.assist, u); }
    if (G.traits) { for (const t of [killer, ...assists]) if (t) G.traits.onTakedown(G, t); G.traits.onDeath(G, u); }
    for (const h of G.heroes) if (h.team === killerTeam && h !== killer && !assists.includes(h) && h.alive && dist(h, u) < XP_SHARE_RADIUS) gainXp(G, h, bounty * 0.4);
    u.damagers.clear();
    G.emit('herodeath', { u, killer, assists });
  } else if (u.kind === 'ward') {
    G.emit('wardDeath', { u, src });
  } else if (u.kind === 'monster') {
    const team = src && src.team <= 1 ? src.team : (u.lastHitBy && u.lastHitBy.team <= 1 ? u.lastHitBy.team : -1);
    if (team >= 0) {
      const near = G.heroes.filter((h) => h.alive && h.team === team && dist(h, u) < XP_SHARE_RADIUS + (u.boss ? 10 : 0));
      for (const h of near) gainXp(G, h, u.boss ? u.xp : u.xp / Math.max(1, near.length * 0.7));
      if (u.boss) { for (const h of G.heroes) if (h.team === team) { addGold(G, h, u.gold, u); h.apeBuff = APE_BUFF.dur; } }
      else if (src && src.kind === 'hero') addGold(G, src, u.gold, u);
      const b = u.mkind === 'robot' ? 'blue' : u.mkind === 'dino' ? 'red' : null;
      if (b && src && src.kind === 'hero') { const had = src[b] > 0; src[b] = JUNGLE_BUFF[b].dur; if (b === 'blue' && !had) recalcStats(src); G.emit('jungleBuff', { h: src, b }); }
    }
    G.emit('monsterDeath', { u, team });
  } else {
    for (const h of G.heroes) if (h.team === killerTeam) { gainXp(G, h, u.kind === 'core' ? 0 : 110); if (u.kind === 'tower') addGold(G, h, GOLD.tower, u); }
    G.emit('structure', { u, src });
    if (u.kind === 'core') { G.winner = killerTeam; G.emit('gameover', { winner: killerTeam }); }
  }
  G.emit('death', { u, src });
}

export function interrupt(G, h) {
  if (h.action && !h.action.unstoppable) { h.action.cancel?.(); h.action = null; }
  h.charging = false;
}
export function cancelRecall(G, h) { if (h.recall > 0) { h.recall = 0; G.emit('recall', { h, state: 'cancel' }); } }

/* ---------------- 查詢 ---------------- */
export function enemiesNear(G, u, r, filter) {
  const out = [];
  for (const o of G.units) if (o.alive && o.team !== u.team && (!filter || filter(o)) && dist2(o, u) < (r + o.radius) ** 2) out.push(o);
  return out;
}
export function nearestEnemy(G, u, r, filter) {
  let best = null, bd = (r) ** 2;
  for (const o of G.units) {
    if (!o.alive || o.team === u.team || (filter && !filter(o))) continue;
    const d = dist2(o, u) - o.radius * o.radius;
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
export const targetable = (G, o) => o.alive && o.st.invuln <= 0 && vulnerable(G, o);

/* ---------------- 移動 ---------------- */
// 往 (tx,tz) 移動一步，繞開障礙物；回傳是否已到達
const look = { x: 0, z: 0 };
export function steer(G, u, tx, tz, speed, dt, stopDist = 0.15) {
  const dx = tx - u.x, dz = tz - u.z, d = Math.hypot(dx, dz);
  if (d < stopDist) return true;
  let nx = dx / d, nz = dz / d;
  // 前方障礙（樹叢、岩石、建築）：沿切線繞行，選靠近目標的一側
  const ahead = Math.min(d, 3.2);
  let best = null, bestProj = 1e9;
  const consider = (cx, cz, r) => {
    const ox = cx - u.x, oz = cz - u.z, proj = ox * nx + oz * nz;
    if (proj < -0.2 || proj > ahead + r) return;
    const perp = ox * nz - oz * nx, rr = r + u.radius + 0.25;
    if (Math.abs(perp) < rr && proj < bestProj && d > proj - r) { bestProj = proj; best = { perp, rr }; }
  };
  for (const o of obstaclesNear(u.x - 8, u.z - 8, u.x + 8, u.z + 8)) consider(o.x, o.z, o.r);
  for (const s of G.structures) if (s.alive && s !== u) consider(s.x, s.z, s.radius);
  if (best) {
    const side = best.perp > 0 ? 1 : -1, w = Math.min(1, 1.15 - Math.abs(best.perp) / best.rr);
    const tx2 = -nz * side, tz2 = nx * side;
    const mx = nx * (1 - w) + tx2 * w, mz = nz * (1 - w) + tz2 * w, l = Math.hypot(mx, mz) || 1;
    nx = mx / l; nz = mz / l;
  }
  const step = Math.min(d, speed * dt);
  u.x += nx * step; u.z += nz * step;
  const tf = Math.atan2(nx, nz);
  u.facing = turn(u.facing, tf, dt * 16);
  return false;
}
export function turn(a, b, k) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * Math.min(1, k); }
export function face(u, tx, tz) { u.facing = Math.atan2(tx - u.x, tz - u.z); }

export function physics(G, u, dt) {
  // 擊退速度與擊飛高度
  if (u.kx || u.kz) {
    u.x += u.kx * dt; u.z += u.kz * dt;
    const f = Math.exp(-dt * 7); u.kx *= f; u.kz *= f;
    if (Math.abs(u.kx) + Math.abs(u.kz) < 0.05) u.kx = u.kz = 0;
  }
  if (u.y > 0 || u.vy > 0) { u.vy -= 22 * dt; u.y += u.vy * dt; if (u.y <= 0) { u.y = 0; u.vy = 0; } }
  collide(u, u.radius);
  for (const s of G.structures) {
    if (!s.alive || s === u) continue;
    const dx = u.x - s.x, dz = u.z - s.z, rr = s.radius + u.radius, d2 = dx * dx + dz * dz;
    if (d2 < rr * rr) { const d = Math.sqrt(d2) || 1e-3; u.x = s.x + (dx / d) * rr; u.z = s.z + (dz / d) * rr; }
  }
}

// 單位間的柔性分離
export function separate(G, dt) {
  const list = G.units;
  for (let i = 0; i < list.length; i++) {
    const a = list[i]; if (!a.alive || a.kind === 'tower' || a.kind === 'core' || a.dashing) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j]; if (!b.alive || b.kind === 'tower' || b.kind === 'core' || b.dashing) continue;
      const dx = b.x - a.x, dz = b.z - a.z, rr = (a.radius + b.radius) * 0.92, d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr || d2 === 0) continue;
      const d = Math.sqrt(d2), push = (rr - d) * Math.min(1, dt * 10);
      const wa = a.immovable ? 0 : b.immovable ? 1 : a.kind === 'hero' ? (b.kind === 'hero' ? 0.5 : 0.15) : (b.kind === 'hero' ? 0.85 : 0.5);
      const nx = dx / d, nz = dz / d;
      a.x -= nx * push * wa; a.z -= nz * push * wa; b.x += nx * push * (1 - wa); b.z += nz * push * (1 - wa);
    }
  }
}

/* ---------------- 小兵 ---------------- */
export function spawnWave(G) {
  G.waveN++;
  for (let team = 0; team < 2; team++) for (let lane = 0; lane < 3; lane++) {
    const kinds = ['melee', 'melee', 'melee', 'ranged', 'ranged'];
    if (G.waveN >= SIEGE_FROM_WAVE) kinds.push('siege');
    // 敵方這一路內塔已倒：多一台攻城兵
    if (G.structures.some((s) => s.kind === 'tower' && s.team !== team && s.lane === lane && s.tier === 'inner' && !s.alive)) kinds.push('siege');
    kinds.forEach((k, i) => {
      const m = makeMinion(G, k, team, lane);
      const p = m.path, dx = p[1].x - p[0].x, dz = p[1].z - p[0].z, l = Math.hypot(dx, dz);
      const back = i * 1.6, side = ((i % 3) - 1) * 1.1;
      m.x -= (dx / l) * back - (dz / l) * side; m.z -= (dz / l) * back + (dx / l) * side;
      m.spawnDelay = i * 0.12;
      addUnit(G, m);
    });
  }
}

export function updateMinion(G, m, dt) {
  m.atkCd -= dt;
  if (m.st.stun > 0 || m.y > 0) { m.anim.name = 'idle'; return; }
  m.retarget -= dt;
  if (m.retarget <= 0 || !m.target || !m.target.alive || !vulnerable(G, m.target) || dist(m, m.target) > m.sight + 4) {
    m.retarget = 0.4;
    m.target = pickMinionTarget(G, m);
  }
  const slow = m.st.slow > 0 ? 1 - m.st.slowAmt : 1;
  if (m.target) {
    const t = m.target, d = dist(m, t) - t.radius - m.radius;
    if (d > m.range) { steer(G, m, t.x, t.z, m.ms * slow, dt); m.anim.name = 'walk'; }
    else {
      face(m, t.x, t.z);
      if (m.atkCd <= 0) {
        m.atkCd = m.as; m.anim.name = 'atk'; m.anim.t = 0;
        if (m.mkind === 'melee') damage(G, m, t, m.dmg * (t.kind === 'hero' ? 0.8 : t.kind === 'minion' ? 1 : m.structMul), { type: 'minion', noKi: true });
        else G.emit('minionShot', { src: m, dst: t });
      } else if (m.anim.name !== 'atk' || m.anim.t > 0.5) m.anim.name = 'idle';
    }
  } else {
    // 沿路線前進
    const p = m.path;
    while (m.wp < p.length - 1 && Math.hypot(p[m.wp].x - m.x, p[m.wp].z - m.z) < 2.5) m.wp++;
    const w = p[m.wp];
    steer(G, m, w.x, w.z, m.ms * slow, dt);
    m.anim.name = 'walk';
  }
}
function pickMinionTarget(G, m) {
  // 呼救：附近有敵方英雄攻擊己方英雄
  for (const h of G.heroes) {
    if (!h.alive || h.team === m.team || G.time - h.lastAttackHeroT > 2) continue;
    if (dist(h, m) < m.sight && h.lastHeroTarget && h.lastHeroTarget.team === m.team) return h;
  }
  let best = null, bs = 1e9;
  for (const o of G.units) {
    if (!o.alive || o.team === m.team || o.kind === 'ward' || !vulnerable(G, o)) continue;
    const d = dist(o, m) - o.radius;
    if (d > m.sight) continue;
    const pri = o.kind === 'minion' ? 0 : o.kind === 'tower' || o.kind === 'core' ? 6 : 9;
    if (d + pri < bs) { bs = d + pri; best = o; }
  }
  return best;
}

/* ---------------- 塔 ---------------- */
export function updateTower(G, s, dt) {
  s.atkCd -= dt;
  const inRange = (o) => o && o.alive && o.team !== s.team && o.st.invuln <= 0 && dist(o, s) < s.range + o.radius;
  // 敵方英雄在塔下攻擊己方英雄 → 改打它
  for (const h of G.heroes) {
    if (inRange(h) && G.time - h.lastAttackHeroT < 1.2 && h.lastHeroTarget && h.lastHeroTarget.team === s.team && dist(h.lastHeroTarget, s) < s.range + 4) { if (s.target !== h) s.shots = 0; s.target = h; break; }
  }
  if (!inRange(s.target)) {
    s.shots = 0; s.target = null;
    let bd = 1e9;
    for (const o of G.units) if (o.kind === 'minion' && inRange(o)) { const d = dist(o, s); if (d < bd) { bd = d; s.target = o; } }
    if (!s.target) for (const o of G.heroes) if (inRange(o)) { const d = dist(o, s); if (d < bd) { bd = d; s.target = o; } }
  }
  s.charge = s.target ? Math.min(1, s.charge + dt * 1.6) : Math.max(0, s.charge - dt);
  if (s.target && s.atkCd <= 0) {
    s.atkCd = TOWER.cd * (s.kind === 'core' ? 0.8 : 1);
    const t = s.target;
    const dmg = t.kind === 'hero' ? TOWER.dmg * (1 + TOWER.ramp * Math.min(4, s.shots)) * (1 + G.time / 600) : TOWER.dmgMinion * (1 + G.time / 900) * (t.mkind === 'ranged' ? 1.1 : 0.75);
    if (t.kind === 'hero') s.shots++;
    G.emit('towerShot', { src: s, dst: t, dmg });
  }
}

/* ---------------- 英雄共用 ---------------- */
export function heroTick(G, h, dt) {
  for (const k in h.cds) h.cds[k] = Math.max(0, h.cds[k] - dt);
  const st = h.st;
  if (st.spark > 0) { st.spark -= dt; heal(G, h, h.maxHp * SPARK.heal / SPARK.dur * dt); addKi(G, h, 12 * dt); addMp(h, h.maxMp * RES.spark / SPARK.dur * dt); }
  else if (h.form !== 'base') h.form = 'base';
  if (st.shieldT > 0) { st.shieldT -= dt; if (st.shieldT <= 0) st.shield = 0; }
  // 泉水
  const f = FOUNTAIN[h.team], fe = FOUNTAIN[1 - h.team];
  if (st.potion > 0) { st.potion -= dt; heal(G, h, st.potionRate * dt); }
  if (h.elixir && G.time > h.elixir.until) { h.elixir = null; recalcStats(h); }
  if (Math.hypot(h.x - f[0], h.z - f[1]) < 11) { if (h.flask > 0) h.flaskC = 2; heal(G, h, h.maxHp * 0.14 * dt); addKi(G, h, 30 * dt); addMp(h, h.maxMp * RES.fountain * dt); }
  if (Math.hypot(h.x - fe[0], h.z - fe[1]) < 12) damage(G, null, h, 600 * dt, { type: 'true', noKi: true });
  // 被動回血、回氣
  if (G.time - h.lastHitT > 6) heal(G, h, h.maxHp * (0.004 * (1 + (h.hpr || 0)) + (h.regen || 0)) * dt);
  if (G.time > 30) h.gold += GOLD.passive * dt;
  if (h.apeBuff > 0) h.apeBuff -= dt;
  addKi(G, h, 2.5 * dt);
  if (h.charging) addKi(G, h, 75 * dt);
  // 魔力／體力回復：集氣 ×3、藍色氣焰加成
  const blue = h.blue > 0 ? 1 + (h.res === 'energy' ? JUNGLE_BUFF.blue.energy : JUNGLE_BUFF.blue.mpr) : 1;
  addMp(h, h.mpRegen * blue * (h.charging ? RES.chargeMul : 1) * dt);
  if (h.blue > 0) { h.blue -= dt; if (h.blue <= 0) recalcStats(h); }
  if (h.red > 0) h.red -= dt;
  if (G.traits) G.traits.tick(G, h, dt);
  // 回城
  if (h.recall > 0) {
    h.recall -= dt;
    if (h.recall <= 0) { h.recall = 0; h.x = f[0] + (h.team ? -1 : 1) * 2; h.z = f[1] + (h.team ? 1 : -1) * 2; h.goal = null; h.target = null; G.emit('recall', { h, state: 'done' }); }
  }
}
export function moveSpeed(h) {
  let s = h.ms;
  if (h.st.spark > 0) s *= SPARK.ms;
  if (h.wish > 0) s *= 1 + DRAGON.wish.ms;
  if (h.st.haste > 0) s *= 1 + (h.st.hasteMs || 0);
  if (h.st.slow > 0) s *= 1 - h.st.slowAmt;
  // 高移速遞減（原作 415／490 換算）
  const [c1, c2] = STAT.msCap;
  if (s > c2) s = c1 + (c2 - c1) * 0.8 + (s - c2) * 0.5; else if (s > c1) s = c1 + (s - c1) * 0.8;
  return s;
}
export function tickStatus(u, dt, G) {
  const st = u.st;
  if (st.stun > 0) st.stun -= dt;
  if (st.frozen > 0) st.frozen -= dt;
  if (st.slow > 0) { st.slow -= dt; if (st.slow <= 0) st.slowAmt = 0; }
  if (st.invuln > 0) st.invuln -= dt;
  if (st.mark > 0) st.mark -= dt;
  if (st.gw > 0) st.gw -= dt;
  // 灼燒（赤色氣焰）：累積到 4 點或結束時才結算一次，避免每格四捨五入成 0
  if (st.burn > 0) { st.burn -= dt; st.burnAcc = (st.burnAcc || 0) + st.burnDps * dt; if ((st.burnAcc >= 4 || st.burn <= 0) && u.alive) { const v = st.burnAcc; st.burnAcc = 0; if (st.burnSrc) damage(G, st.burnSrc, u, v, { type: 'true', noKi: true, dot: true }); } }
  if (st.haste > 0) st.haste -= dt;
  if (u.flash > 0) u.flash -= dt;
}

export function respawnHero(G, h) {
  const f = FOUNTAIN[h.team];
  h.alive = true; h.hp = h.maxHp; h.x = f[0] + (Math.random() - 0.5) * 3; h.z = f[1] + (Math.random() - 0.5) * 3;
  h.y = 0; h.vy = 0; h.kx = h.kz = 0; h.st.stun = h.st.slow = h.st.frozen = 0; h.st.slowAmt = 0; h.goal = null; h.target = null; h.action = null; h.path = null;
  h.ki = Math.max(h.ki, 100); h.mp = h.maxMp;
  G.emit('respawn', h);
}

export { WAVE_EVERY, heightAt, laneProgress };
