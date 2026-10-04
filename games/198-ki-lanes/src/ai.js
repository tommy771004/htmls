// 英雄 AI：守線補兵、換血連招、撤退回城買裝、遊走支援、打野、集合打大猿。只對看得到的敵方英雄出手。
import { KI_BAR, FOUNTAIN, ITEMS } from './config.js';
import { dist, targetable, vulnerable } from './units.js';
import { lanePath, laneProgress, pointAlong, distToLane } from './map.js';
import { cast, orderMove, orderAttack, startRecall, setCharging, spark, levelSkill, canLevel, skillReady, skillDmg, placeWard, placeControl } from './combat.js';
import { BUSHES } from './map.js';
import { seen, inBush } from './vision.js';
import { eatSenzu, nextBuy, priceFor } from './items.js';
import { bossAlive } from './jungle.js';
import { shenronAlive } from './dragonballs.js';

const SKILL_ORDER = {
  goku: ['Q', 'W', 'Q', 'E', 'Q', 'W', 'Q', 'W', 'W', 'E', 'E', 'E'],
  vegeta: ['Q', 'E', 'W', 'Q', 'Q', 'W', 'Q', 'W', 'W', 'E', 'E', 'E'],
  trunks: ['W', 'Q', 'W', 'E', 'W', 'Q', 'W', 'Q', 'Q', 'E', 'E', 'E'],
  piccolo: ['Q', 'W', 'E', 'Q', 'Q', 'W', 'Q', 'W', 'W', 'E', 'E', 'E'],
  frieza: ['Q', 'W', 'Q', 'E', 'Q', 'W', 'Q', 'W', 'W', 'E', 'E', 'E'],
  a18: ['Q', 'E', 'Q', 'W', 'Q', 'W', 'Q', 'W', 'W', 'E', 'E', 'E'],
  naruto: ['Q', 'W', 'Q', 'E', 'Q', 'W', 'Q', 'W', 'W', 'E', 'E', 'E'],
  sasuke: ['Q', 'W', 'E', 'Q', 'Q', 'W', 'Q', 'W', 'W', 'E', 'E', 'E'],
  kakashi: ['Q', 'W', 'Q', 'E', 'Q', 'W', 'Q', 'W', 'W', 'E', 'E', 'E'],
  sakura: ['Q', 'E', 'W', 'Q', 'Q', 'W', 'Q', 'W', 'W', 'E', 'E', 'E'],
  luffy: ['Q', 'W', 'E', 'Q', 'Q', 'W', 'Q', 'W', 'W', 'E', 'E', 'E'],
  zoro: ['W', 'Q', 'W', 'E', 'W', 'Q', 'W', 'Q', 'Q', 'E', 'E', 'E'],
  sanji: ['Q', 'W', 'Q', 'E', 'Q', 'W', 'Q', 'W', 'W', 'E', 'E', 'E'],
  nami: ['Q', 'W', 'Q', 'E', 'Q', 'W', 'Q', 'W', 'W', 'E', 'E', 'E'],
};
// 技能用法提示：eSelf＝E 原地施放（護盾、回血、吹開、增益），eBehind＝E 能瞬移到敵人背後，eHeal＝E 在殘血時用來保命，
// eBuff＝E 是開打時的增益，wRanged＝W 從遠處施放（抓人、絆住），wSelf＝W 是自身周圍的範圍招，noFleeE＝E 不適合拿來逃
const HINT = {
  goku: { eBehind: 1 }, vegeta: { eBehind: 1 }, sasuke: { eBehind: 1 },
  piccolo: { eHeal: 1, wRanged: 1, eSelfOnly: 1 }, a18: { eSelf: 1 },
  sakura: { eSelf: 1, eHeal: 1 }, luffy: { eSelf: 1, eBuff: 1 }, nami: { eSelf: 1 },
  kakashi: { wRanged: 1 }, sanji: { wSelf: 1 },
};
const hint = (h) => HINT[h.heroId] || {};
const pathLen = (p) => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z); return L; };

export function makeBrain(h, difficulty = 1) {
  const path = lanePath(h.lane, h.team);
  return { path, L: pathLen(path), think: Math.random() * 0.3, mode: 'lane', aimErr: difficulty >= 2 ? 0.4 : 0.9, react: difficulty >= 2 ? 0.16 : 0.28, diff: difficulty, plan: 2 + Math.random() * 2, roam: null, until: 0 };
}

function autoLevel(G, h) {
  let guard = 6;
  while (h.sp > 0 && guard--) {
    if (canLevel(h, 'R')) { levelSkill(G, h, 'R'); continue; }
    const order = SKILL_ORDER[h.heroId] || SKILL_ORDER.goku;
    const used = h.ranks.Q + h.ranks.W + h.ranks.E;
    let k = order[Math.min(used, order.length - 1)];
    if (!canLevel(h, k)) k = ['Q', 'W', 'E'].find((x) => canLevel(h, x));
    if (!k) break;
    levelSkill(G, h, k);
  }
}
function enemyTowerThreat(G, h, x, z) {
  for (const s of G.structures) if (s.alive && s.team !== h.team && Math.hypot(s.x - x, s.z - z) < s.range + 1.5) return s;
  return null;
}
function alliesTanking(G, h, s) { let n = 0; for (const m of G.minions) if (m.alive && m.team === h.team && dist(m, s) < s.range) n++; return n; }
const visibleFoes = (G, h) => G.heroes.filter((e) => e.alive && e.team !== h.team && e.st.invuln <= 0 && seen(G, h.team, e));
function nextItemCost(h) {
  const nb = nextBuy(h); if (!nb) return 1e9;
  return Math.min(...nb.missing.map((id) => priceFor(h, id)));
}

export function updateAI(G, h, dt) {
  if (!h.alive || G.aiFrozen) return;
  const B = h.brain;
  if (h.sp > 0) autoLevel(G, h);
  B.think -= dt;
  if (B.think > 0) return;
  B.think = B.react + Math.random() * 0.1;
  if (h.action && !h.action.auto) return;
  if (h.st.stun > 0) return;

  const f = FOUNTAIN[h.team];
  const hpR = h.hp / h.maxHp;
  const atBase = Math.hypot(h.x - f[0], h.z - f[1]) < 11;
  const foesV = visibleFoes(G, h);
  let foe = null, fd = 1e9, foes = 0;
  for (const e of foesV) { const d = dist(e, h); if (d < 13) foes++; if (d < fd) { fd = d; foe = e; } }
  let allies = 0; for (const a of G.heroes) if (a !== h && a.alive && a.team === h.team && dist(a, h) < 12) allies++;

  // 仙豆
  if (hpR < 0.4 && h.senzu > 0 && (foe && fd < 14 || hpR < 0.25)) eatSenzu(G, h);

  // 回城補血／買裝
  if (B.mode === 'heal') {
    if (atBase) { if (hpR > 0.92 && h.ki > 150) B.mode = 'lane'; else { h.goal = null; if (!h.charging && h.ki < 300) setCharging(G, h, true); return; } }
    else { if (h.recall <= 0) moveHome(G, h); return; }
  }
  if (h.recall > 0) { if (foe && fd < 9) orderMove(G, h, f[0], f[1]); else return; }
  const danger = foe && fd < 10 && (foe.hp > h.hp * 1.3 || foes > allies + 1);
  if (hpR < 0.22 || (hpR < 0.38 && danger)) {
    if (h.cds.D <= 0 && foe && fd < 6 && hpR < 0.3) spark(G, h);
    if (!foe || fd > 13) { if (!startRecall(G, h)) moveHome(G, h); B.mode = 'heal'; return; }
    if (fd < 6 && skillReady(h, 'E') && !hint(h).eSelf) { const a = Math.atan2(f[0] - h.x, f[1] - h.z); cast(G, h, 'E', h.x + Math.sin(a) * 10, h.z + Math.cos(a) * 10); }
    moveHome(G, h); B.mode = 'flee'; B.fleeT = 2.5; return;
  }
  if (B.mode === 'flee') { B.fleeT -= B.react; if (B.fleeT > 0) { moveHome(G, h); return; } B.mode = 'lane'; }
  // 錢夠了就回去買
  if (!foe && h.gold > nextItemCost(h) + 250 && (hpR < 0.75 || h.gold > 1400) && B.mode !== 'boss') { if (startRecall(G, h)) { B.mode = 'heal'; return; } }

  // 打英雄（遊走包抄途中先不接戰，繞到背後再出手）
  if (foe && fd < 11 && !(B.mode === 'roam' && !B.behind && G.time < B.until) && !(B.mode === 'ambush' && G.time < B.until)) {
    const towerThreat = enemyTowerThreat(G, h, foe.x, foe.z);
    const foeHpR = foe.hp / foe.maxHp;
    const killable = foe.hp < h.ad * 3 + (skillReady(h, 'Q') ? skillDmg(h, 'Q') : 0) + (h.ranks.R && skillReady(h, 'R') ? skillDmg(h, 'R') * 1.5 : 0);
    const adv = (h.hp / foe.hp) * (1 + (h.level - foe.level) * 0.15) * (1 + allies * 0.4) / (1 + (foes - 1) * 0.5);
    const engage = (adv > 0.85 || killable) && (!towerThreat || alliesTanking(G, h, towerThreat) >= 2 && foeHpR < 0.3 || killable && foeHpR < 0.2);
    if (engage) {
      fight(G, h, foe, fd, killable);
      if (h.st.spark <= 0 && h.cds.D <= 0 && foeHpR < 0.6 && fd < 5 && (hpR < 0.6 || killable)) spark(G, h);
      return;
    }
    if (skillReady(h, 'Q') && fd < h.def.skills.Q.range * 0.9 && hpR > 0.5) aimCast(G, h, 'Q', foe);
  }

  // 戰略層：每幾秒評估一次（大猿、遊走、打野）
  B.plan -= B.react;
  if (B.plan <= 0) { B.plan = 3 + Math.random() * 2; strategy(G, h, hpR); }
  if (B.mode === 'ambush' && ambushMode(G, h)) return;
  if (B.mode === 'boss' && bossMode(G, h)) return;
  if (B.mode === 'roam' && roamMode(G, h)) return;
  if (B.mode === 'jungle' && jungleMode(G, h)) return;
  laneLogic(G, h);
}

function strategy(G, h, hpR) {
  const B = h.brain;
  if (B.mode === 'heal' || B.mode === 'flee') return;
  // 神龍降臨：全隊健康的人都去神龍坑爭奪
  if (shenronAlive(G) && hpR > 0.45 && B.mode !== 'boss') { B.mode = 'boss'; B.until = G.time + 45; return; }
  // 大猿：敵方至少兩人陣亡，或 9 分鐘後我方三人都健康
  const boss = bossAlive(G);
  if (boss && hpR > 0.55) {
    const enemiesDead = G.heroes.filter((e) => e.team !== h.team && !e.alive).length;
    const allyOk = G.heroes.filter((a) => a.team === h.team && a.alive && a.hp / a.maxHp > 0.55).length;
    if (enemiesDead >= 2 || (G.time > 540 && allyOk >= 3 && enemiesDead >= 1)) { for (const a of G.heroes) if (a.team === h.team && a.alive && a.brain && a.brain.mode !== 'heal') { a.brain.mode = 'boss'; a.brain.until = G.time + 30; } return; }
  }
  if (B.mode !== 'lane') return;
  if (G.time > 90 && hpR > 0.65 && G.time > (B.ambushCd || 0) && planAmbush(G, h)) return;
  // 遊走：附近隊友正在和敵方英雄交手，而且我這一路沒人
  const laneQuiet = !visibleFoes(G, h).some((e) => dist(e, h) < 20);
  if (laneQuiet && hpR > 0.6) {
    for (const a of G.heroes) {
      if (a === h || !a.alive || a.team !== h.team) continue;
      const d = dist(a, h); if (d > 60) continue;
      const threat = visibleFoes(G, h).find((e) => dist(e, a) < 12);
      if (threat && (threat.hp / threat.maxHp < 0.85 || a.hp / a.maxHp < 0.7)) { B.mode = 'roam'; B.roam = a; B.foe = threat; B.behind = false; B.until = G.time + 14; G.emit('roam', { h, to: a, foe: threat }); return; }
    }
    // 主動包抄：隔壁路的敵方英雄壓得太前面（靠近我方的塔），就繞過去切它後路
    for (const e of visibleFoes(G, h)) {
      const d = dist(e, h); if (d > 55) continue;
      const nearOurTower = G.structures.some((t) => t.alive && t.team === h.team && t.kind === 'tower' && dist(t, e) < 16);
      const mate = G.heroes.find((a) => a !== h && a.alive && a.team === h.team && dist(a, e) < 18);
      if (nearOurTower && mate && Math.random() < 0.6) { B.mode = 'roam'; B.roam = mate; B.foe = e; B.behind = false; B.until = G.time + 16; G.emit('roam', { h, to: mate, foe: e }); return; }
    }
  }
  // 打野：兵線上沒兵可補時，清附近我方半邊的營地
  let laneMinions = 0; for (const m of G.minions) if (m.alive && m.lane === h.lane && dist(m, h) < 20) laneMinions++;
  if (!laneMinions && hpR > 0.5) {
    let best = null, bd = 42;
    for (const c of G.camps) {
      if (c.boss || !c.mobs.some((m) => m.alive)) continue;
      const mySide = h.team === 0 ? c.x < c.z : c.x > c.z;
      const d = Math.hypot(c.x - h.x, c.z - h.z) * (mySide ? 1 : 1.6);
      if (d < bd) { bd = d; best = c; }
    }
    if (best) { B.mode = 'jungle'; B.camp = best; B.until = G.time + 25; }
  }
}
// 草叢埋伏：鎖定一名落單、正往我方推進的敵方英雄，兩到三名隊友先躲進它前方路邊的草叢，等它走近再一起出手
function planAmbush(G, h) {
  const B = h.brain;
  B.ambushCd = G.time + 12;
  const foes = visibleFoes(G, h);
  for (const E of foes) {
    if (foes.some((o) => o !== E && dist(o, E) < 16)) continue; // 不是落單
    if (E.hp / E.maxHp < 0.25) continue;
    const ep = lanePath(E.lane, E.team), eProg = laneProgress(ep, E.x, E.z);
    let best = null, bs = 1e9;
    for (const b of BUSHES) {
      if (distToLane(b.x, b.z, E.lane) > 9.5) continue;
      if (G.structures.some((t) => t.alive && t.team !== h.team && Math.hypot(t.x - b.x, t.z - b.z) < t.range + 3)) continue; // 不在敵塔射程內
      const bp = laneProgress(ep, b.x, b.z), ahead = bp - eProg;
      if (ahead < 5 || ahead > 20) continue;
      const d = Math.hypot(b.x - h.x, b.z - h.z); if (d > 45) continue;
      if (d < bs) { bs = d; best = b; }
    }
    if (!best) continue;
    const team = G.heroes.filter((a) => a.team === h.team && a.alive && a.brain && a.hp / a.maxHp > 0.6 && (a === h || a.brain.mode === 'lane' || a.brain.mode === 'jungle') && Math.hypot(a.x - best.x, a.z - best.z) < 48);
    if (team.length < 2) continue;
    const members = team.sort((a, b2) => Math.hypot(a.x - best.x, a.z - best.z) - Math.hypot(b2.x - best.x, b2.z - best.z)).slice(0, 3);
    members.forEach((a, i) => { const ab = a.brain; ab.mode = 'ambush'; ab.bush = best; ab.foe = E; ab.slot = i; ab.until = G.time + 22; ab.ambushCd = G.time + 35; ab.members = members; });
    G.emit('ambush', { team: h.team, bush: best, foe: E, members });
    return true;
  }
  return false;
}
function ambushMode(G, h) {
  const B = h.brain, E = B.foe, b = B.bush;
  if (!E || !E.alive || G.time > B.until || h.hp / h.maxHp < 0.4) { B.mode = 'lane'; return false; }
  const inPlace = inBush(h) > 0 && Math.hypot(h.x - b.x, h.z - b.z) < b.r;
  const near = Math.hypot(E.x - b.x, E.z - b.z);
  const struck = B.members.some((m) => m.alive && G.time - m.lastHitT < 0.6 && m.lastHitBy && m.lastHitBy.kind === 'hero');
  if ((near < b.r + 6 || struck || B.members.some((m) => m.alive && dist(m, E) < 7.5)) && seen(G, h.team, E)) {
    // 出手：全員轉成包抄、直接開打
    for (const m of B.members) if (m.alive && m.brain && m.brain.mode === 'ambush') { const mb = m.brain; mb.mode = 'roam'; mb.foe = E; mb.roam = m; mb.behind = true; mb.until = G.time + 10; }
    G.emit('ambushStrike', { team: h.team, foe: E, members: B.members });
    fight(G, h, E, dist(h, E), true);
    return true;
  }
  if (!inPlace) { const a = (B.slot / 3) * Math.PI * 2; setCharging(G, h, false); orderMove(G, h, b.x + Math.cos(a) * b.r * 0.45, b.z + Math.sin(a) * b.r * 0.45); return true; }
  // 已就位：靜止等待（不集氣，免得氣焰暴露位置）
  h.goal = null; h.path = null; h.target = null; setCharging(G, h, false);
  return true;
}

function bossMode(G, h) {
  const B = h.brain, sh = shenronAlive(G), boss = sh || bossAlive(G);
  if (!boss || G.time > B.until || h.hp / h.maxHp < 0.4) { B.mode = 'lane'; return false; }
  // 神龍坑裡遇到敵方英雄先打人
  if (sh) { const foe = visibleFoes(G, h).find((e) => e.kind === 'hero' && dist(e, h) < 8); if (foe) { orderAttack(G, h, foe); return true; } }
  const near = G.heroes.filter((a) => a.team === h.team && a.alive && dist(a, boss) < 14).length;
  if (dist(h, boss) > 9) { orderMove(G, h, boss.x - 4 * (h.team ? -1 : 1), boss.z + 4 * (h.team ? -1 : 1)); return true; }
  if (near >= 2 || boss.hp / boss.maxHp < 0.5 || boss.state === 'fight') {
    if (skillReady(h, 'Q') && h.ki > 200) cast(G, h, 'Q', boss.x, boss.z);
    orderAttack(G, h, boss);
  } else h.goal = null;
  return true;
}
function roamMode(G, h) {
  const B = h.brain, a = B.roam;
  if (G.time > B.until) { B.mode = 'lane'; return false; }
  // 目標：原本鎖定的敵人（隊友倒下也繼續追），否則找正在打隊友的敵人
  let threat = B.foe && B.foe.alive && seen(G, h.team, B.foe) ? B.foe : null;
  if (!threat && a && a.alive) threat = visibleFoes(G, h).find((e) => dist(e, a) < 14);
  if (!threat) { if (!a || !a.alive || dist(h, a) < 8) { B.mode = 'lane'; return false; } orderMove(G, h, a.x, a.z); return true; }
  if (dist(h, threat) > 62) { B.mode = 'lane'; return false; }
  // 從敵人背後（它回家的方向）切入，繞到位再出手
  const p = retreatPoint(threat, 3.2);
  if (!B.behind && Math.hypot(h.x - p.x, h.z - p.z) > 2.2 && dist(h, threat) > 2.5) { orderMove(G, h, p.x, p.z); return true; }
  if (!B.behind) { B.behind = true; G.emit('flank', { h, foe: threat }); }
  fight(G, h, threat, dist(h, threat), threat.hp < h.ad * 4);
  return true;
}
function jungleMode(G, h) {
  const B = h.brain, c = B.camp;
  const mob = c && c.mobs.find((m) => m.alive);
  if (!mob || G.time > B.until || h.hp / h.maxHp < 0.35) { B.mode = 'lane'; return false; }
  if (dist(h, mob) > h.range + 3) orderMove(G, h, mob.x, mob.z);
  else { if (skillReady(h, 'Q') && h.ki > 250) cast(G, h, 'Q', mob.x, mob.z); orderAttack(G, h, mob); }
  return true;
}

function aimCast(G, h, k, u) {
  const B = h.brain, s = h.def.skills[k];
  const lead = s.speed ? dist(h, u) / s.speed : 0.15;
  let tx = u.x, tz = u.z;
  if (u.goal && !u.action) { const dx = u.goal.x - u.x, dz = u.goal.z - u.z, d = Math.hypot(dx, dz) || 1; tx += (dx / d) * u.ms * lead; tz += (dz / d) * u.ms * lead; }
  tx += (Math.random() - 0.5) * B.aimErr * 2; tz += (Math.random() - 0.5) * B.aimErr * 2;
  return cast(G, h, k, tx, tz);
}
function fight(G, h, foe, fd, killable) {
  const S = h.def.skills;
  const foeHpR = foe.hp / foe.maxHp;
  const kiBars = Math.floor(h.ki / KI_BAR);
  if (h.ranks.R && skillReady(h, 'R') && fd < S.R.range * 0.9 && (foe.hp < skillDmg(h, 'R') * 1.6 || foeHpR < 0.45)) { if (aimCast(G, h, 'R', foe)) return; }
  if (flank(G, h, foe, fd, kiBars)) return;
  const H = hint(h);
  if (H.wRanged && skillReady(h, 'W') && fd > 3 && fd < S.W.range * 0.9) { if (aimCast(G, h, 'W', foe)) return; }
  if (H.wSelf && skillReady(h, 'W') && fd < (S.W.radius || 3) * 0.9) { if (cast(G, h, 'W', foe.x, foe.z)) return; }
  if (H.eSelf && !H.eHeal && !H.eBuff && skillReady(h, 'E') && fd < 3.5 && kiBars >= 1) { if (cast(G, h, 'E', h.x, h.z)) return; }
  if (H.eBuff && skillReady(h, 'E') && fd < 6 && kiBars >= 1) { if (cast(G, h, 'E', h.x, h.z)) return; }
  if (h.def.melee) {
    if (skillReady(h, 'W') && fd < S.W.range && fd > 2.2 && !H.wRanged && !H.wSelf) { if (aimCast(G, h, 'W', foe)) return; }
    if (skillReady(h, 'E') && kiBars >= (h.ranks.R && h.cds.R <= 0 ? 4 : 1) && fd > 3 && fd < (S.E.range || 6) + 2 && (foeHpR < 0.5 || killable) && !H.eSelf && !H.eSelfOnly) { if (cast(G, h, 'E', foe.x, foe.z)) return; }
  } else {
    if (fd < 3.5 && skillReady(h, 'E') && kiBars >= 1 && !H.eSelf) { const a = Math.atan2(h.x - foe.x, h.z - foe.z); if (cast(G, h, 'E', h.x + Math.sin(a) * 9, h.z + Math.cos(a) * 9)) return; }
    if (skillReady(h, 'W') && fd < S.W.range * 0.8 && !H.wRanged) { if (aimCast(G, h, 'W', foe)) return; }
  }
  if (skillReady(h, 'Q') && fd < S.Q.range * 0.9) { if (aimCast(G, h, 'Q', foe)) return; }
  if (H.eHeal && skillReady(h, 'E') && kiBars >= 1 && (h.hp / h.maxHp < 0.6 || G.heroes.some((a) => a.alive && a.team === h.team && a !== h && dist(a, h) < 6 && a.hp / a.maxHp < 0.45))) cast(G, h, 'E', h.x, h.z);
  orderAttack(G, h, foe);
}

// 包夾：隊友已經貼上敵人時，近戰繞到敵人和它家之間（切斷退路）；悟空、貝吉塔直接瞬移到背後
function retreatPoint(foe, d) { const ef = FOUNTAIN[foe.team]; let rx = ef[0] - foe.x, rz = ef[1] - foe.z; const l = Math.hypot(rx, rz) || 1; return { x: foe.x + (rx / l) * d, z: foe.z + (rz / l) * d }; }
function flank(G, h, foe, fd, kiBars) {
  const B = h.brain;
  if (!h.def.melee || fd < 2.2 || fd > 12 || foe.hp / foe.maxHp < 0.2 || G.time < (B.flankDone || 0)) return false;
  const mates = G.heroes.filter((a) => a !== h && a.alive && a.team === h.team && dist(a, foe) < 13);
  if (!mates.length) return false;
  const p = retreatPoint(foe, 2.6);
  if (!B.flankT) { B.flankT = G.time; G.emit('flank', { h, foe }); }
  if (hint(h).eBehind && skillReady(h, 'E') && kiBars >= 1 && fd < 8) { cast(G, h, 'E', foe.x, foe.z); B.flankDone = G.time + 9; B.flankT = 0; return true; }
  if (G.time - B.flankT < 2.2 && Math.hypot(h.x - p.x, h.z - p.z) > 1.4) { orderMove(G, h, p.x, p.z); return true; }
  B.flankDone = G.time + 9; B.flankT = 0;
  return false;
}
// 插眼：前方的草叢或河道
function wardSpot(G, h, control = false) {
  const own = G.wards.filter((w) => w.alive && w.team === h.team && (!control || w.control));
  let best = null, bs = 1e9;
  for (const b of BUSHES) {
    const d = Math.hypot(b.x - h.x, b.z - h.z); if (d > 13) continue;
    if (own.some((w) => Math.hypot(w.x - b.x, w.z - b.z) < 7)) continue;
    const enemySide = h.team === 0 ? b.x > b.z : b.x < b.z;
    const sc = d - (enemySide ? 6 : 0);
    if (sc < bs) { bs = sc; best = b; }
  }
  return best;
}

function moveHome(G, h) {
  const f = FOUNTAIN[h.team], B = h.brain;
  const prog = laneProgress(B.path, h.x, h.z), q = pointAlong(B.path, Math.max(0, prog - 10));
  if (Math.hypot(q.x - h.x, q.z - h.z) < 14 && prog > 6) orderMove(G, h, q.x, q.z);
  else orderMove(G, h, f[0], f[1]);
}

function laneLogic(G, h) {
  const B = h.brain, path = B.path;
  if (h.cds.T <= 0 && G.time > 40 && Math.random() < 0.35) { const sp = wardSpot(G, h); if (sp && placeWard(G, h, sp.x, sp.z)) return; }
  if (h.controls > 0 && !G.wards.some((w) => w.alive && w.control && w.owner === h) && Math.random() < 0.3) { const sp = wardSpot(G, h, true); if (sp && placeControl(G, h, sp.x, sp.z)) return; }
  const ew = G.wards.find((w) => w.alive && w.team !== h.team && dist(w, h) < 8 && seen(G, h.team, w));
  if (ew) { orderAttack(G, h, ew); return; }
  const myProg = laneProgress(path, h.x, h.z);
  let front = -1, enemyFront = 1e9;
  for (const m of G.minions) {
    if (!m.alive || m.lane !== h.lane) continue;
    const p = laneProgress(path, m.x, m.z);
    if (m.team === h.team) front = Math.max(front, p); else if (seen(G, h.team, m)) enemyFront = Math.min(enemyFront, p);
  }
  let safe = 6;
  for (const s of G.structures) if (s.alive && s.team === h.team && s.lane === h.lane) safe = Math.max(safe, laneProgress(path, s.x, s.z));
  let want = front >= 0 ? Math.max(safe - 6, front - 2.5) : Math.min(safe + 4, enemyFront - 7);
  want = Math.max(4, want);
  for (const s of G.structures) {
    if (!s.alive || s.team === h.team || !vulnerable(G, s)) continue;
    if (dist(s, h) < 16 && alliesTanking(G, h, s) >= 1 && s.target && s.target.kind === 'minion') { orderAttack(G, h, s); return; }
  }
  let tgt = null, best = 1e9;
  for (const m of G.minions) {
    if (!m.alive || m.team === h.team) continue;
    const d = dist(m, h); if (d > 9) continue;
    const th = enemyTowerThreat(G, h, m.x, m.z);
    if (th && !(front >= 0 && alliesTanking(G, h, th) >= 2)) continue;
    const sc = m.hp + d * 12;
    if (sc < best) { best = sc; tgt = m; }
  }
  if (tgt && skillReady(h, 'Q') && h.ki > 150 && Math.random() < 0.25) {
    let n = 0; for (const m of G.minions) if (m.alive && m.team !== h.team && dist(m, tgt) < 3) n++;
    if (n >= 3) { cast(G, h, 'Q', tgt.x, tgt.z); return; }
  }
  if (tgt) { orderAttack(G, h, tgt); return; }
  const q = pointAlong(path, want);
  const far = Math.hypot(q.x - h.x, q.z - h.z);
  const threat = enemyTowerThreat(G, h, h.x, h.z);
  if (threat && alliesTanking(G, h, threat) < 2) { const back = pointAlong(path, Math.max(0, myProg - 8)); orderMove(G, h, back.x, back.z); return; }
  if (far > 2.5) { setCharging(G, h, false); orderMove(G, h, q.x + (Math.random() - 0.5) * 2, q.z + (Math.random() - 0.5) * 2); return; }
  let enemyNear = false; for (const u of G.units) if (u.alive && u.team !== h.team && u.team <= 1 && u.kind !== 'tower' && u.kind !== 'core' && dist(u, h) < 12) { enemyNear = true; break; }
  if (!enemyNear && h.ki < 300 && !h.goal && !h.target) setCharging(G, h, true);
  else if (enemyNear && h.charging) setCharging(G, h, false);
}
