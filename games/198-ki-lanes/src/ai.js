// 英雄 AI：守線補兵、換血、用技能、撤退回城、推塔。
import { KI_BAR, FOUNTAIN, TOWER } from './config.js';
import { dist, targetable, vulnerable } from './units.js';
import { lanePath, laneProgress, pointAlong, blocked } from './map.js';
import { cast, orderMove, orderAttack, startRecall, setCharging, spark, levelSkill, canLevel, skillReady, skillDmg } from './combat.js';

const SKILL_ORDER = {
  homura: ['Q', 'W', 'Q', 'E', 'Q', 'W', 'Q', 'W', 'W', 'E', 'E', 'E'],
  shimo: ['Q', 'E', 'Q', 'W', 'Q', 'W', 'Q', 'W', 'W', 'E', 'E', 'E'],
  iwao: ['Q', 'W', 'E', 'Q', 'Q', 'W', 'Q', 'W', 'W', 'E', 'E', 'E'],
  raiga: ['Q', 'E', 'W', 'Q', 'Q', 'W', 'Q', 'W', 'W', 'E', 'E', 'E'],
};
const pathLen = (p) => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z); return L; };

export function makeBrain(h, difficulty = 1) {
  const path = lanePath(h.lane, h.team);
  return { path, L: pathLen(path), think: Math.random() * 0.3, mode: 'lane', aimErr: difficulty >= 2 ? 0.4 : 0.9, react: difficulty >= 2 ? 0.15 : 0.28, chargeT: 0, diff: difficulty };
}

function autoLevel(G, h) {
  let guard = 6;
  while (h.sp > 0 && guard--) {
    if (canLevel(h, 'R')) { levelSkill(G, h, 'R'); continue; }
    const order = SKILL_ORDER[h.heroId];
    const used = h.ranks.Q + h.ranks.W + h.ranks.E;
    let k = order[Math.min(used, order.length - 1)];
    if (!canLevel(h, k)) k = ['Q', 'W', 'E'].find((x) => canLevel(h, x));
    if (!k) break;
    levelSkill(G, h, k);
  }
}

function enemyTowerThreat(G, h, x, z) {
  for (const s of G.structures) {
    if (!s.alive || s.team === h.team) continue;
    if (Math.hypot(s.x - x, s.z - z) < s.range + 1.5) return s;
  }
  return null;
}
function alliesTanking(G, h, s) {
  let n = 0;
  for (const m of G.minions) if (m.alive && m.team === h.team && dist(m, s) < s.range) n++;
  return n;
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

  // 附近敵方英雄
  let foe = null, fd = 1e9, foes = 0;
  for (const e of G.heroes) {
    if (!e.alive || e.team === h.team || e.st.invuln > 0) continue;
    const d = dist(e, h);
    if (d < 13) foes++;
    if (d < fd) { fd = d; foe = e; }
  }
  let allies = 0; for (const a of G.heroes) if (a !== h && a.alive && a.team === h.team && dist(a, h) < 12) allies++;

  // 撤退／回城
  if (B.mode === 'heal') {
    if (atBase) { if (h.charging === false && h.ki < 300) setCharging(G, h, false); if (hpR > 0.92) B.mode = 'lane'; else { h.goal = null; return; } }
    else { if (h.recall <= 0) moveHome(G, h); return; }
  }
  if (h.recall > 0) { if (fd < 9) { orderMove(G, h, f[0], f[1]); } else return; }
  const danger = foe && fd < 10 && (foe.hp > h.hp * 1.3 || foes > allies + 1);
  if (hpR < 0.22 || (hpR < 0.38 && danger)) {
    if (h.cds.D <= 0 && foe && fd < 6 && hpR < 0.3) spark(G, h);
    if (!foe || fd > 13) { if (!startRecall(G, h)) moveHome(G, h); B.mode = 'heal'; return; }
    // 逃跑：E 往家的方向
    if (fd < 6 && skillReady(h, 'E')) { const a = Math.atan2(f[0] - h.x, f[1] - h.z); cast(G, h, 'E', h.x + Math.sin(a) * 10, h.z + Math.cos(a) * 10); }
    moveHome(G, h); B.mode = 'flee'; B.fleeT = 2.5; return;
  }
  if (B.mode === 'flee') { B.fleeT -= B.react; if (B.fleeT > 0) { moveHome(G, h); return; } B.mode = 'lane'; }

  // 打英雄
  if (foe && fd < 11) {
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
    // 只換血：對方在 Q 範圍內就丟
    if (skillReady(h, 'Q') && fd < h.def.skills.Q.range * 0.9 && hpR > 0.5) aimCast(G, h, 'Q', foe);
  }

  // 守線、補兵、推塔
  laneLogic(G, h);
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
  // 終極必殺
  if (h.ranks.R && skillReady(h, 'R') && fd < S.R.range * 0.9 && (foe.hp < skillDmg(h, 'R') * 1.6 || foeHpR < 0.45)) { if (aimCast(G, h, 'R', foe)) return; }
  // 瞬移切入（近戰）或保持距離（遠程）
  if (h.def.melee) {
    if (skillReady(h, 'W') && fd < S.W.range && fd > 2.2) { if (aimCast(G, h, 'W', foe)) return; }
    if (skillReady(h, 'E') && kiBars >= (h.ranks.R && h.cds.R <= 0 ? 4 : 1) && fd > 3 && fd < S.E.range + 2 && (foeHpR < 0.5 || killable)) { if (cast(G, h, 'E', foe.x, foe.z)) return; }
  } else {
    if (fd < 3.5 && skillReady(h, 'E') && kiBars >= 1) { const a = Math.atan2(h.x - foe.x, h.z - foe.z); if (cast(G, h, 'E', h.x + Math.sin(a) * 9, h.z + Math.cos(a) * 9)) return; }
    if (skillReady(h, 'W') && fd < S.W.range * 0.8 && foeHpR < 0.5) { if (aimCast(G, h, 'W', foe)) return; }
  }
  if (skillReady(h, 'Q') && fd < S.Q.range * 0.9) { if (aimCast(G, h, 'Q', foe)) return; }
  if (h.heroId === 'iwao' && skillReady(h, 'W') && fd < S.W.range) { if (aimCast(G, h, 'W', foe)) return; }
  orderAttack(G, h, foe);
}

function moveHome(G, h) {
  const f = FOUNTAIN[h.team];
  // 沿路線往回走（避免穿越野區卡住）
  const B = h.brain, prog = laneProgress(B.path, h.x, h.z);
  if (prog > 6) { const q = pointAlong(B.path, Math.max(0, prog - 10)); orderMove(G, h, q.x, q.z); }
  else orderMove(G, h, f[0], f[1]);
}

function laneLogic(G, h) {
  const B = h.brain, path = B.path;
  const myProg = laneProgress(path, h.x, h.z);
  // 兵線前緣：己方小兵在此路的最大進度
  let front = -1, enemyFront = 1e9;
  for (const m of G.minions) {
    if (!m.alive || m.lane !== h.lane) continue;
    const p = laneProgress(path, m.x, m.z);
    if (m.team === h.team) front = Math.max(front, p); else enemyFront = Math.min(enemyFront, p);
  }
  // 己方最前面的塔
  let safe = 6;
  for (const s of G.structures) if (s.alive && s.team === h.team && s.lane === h.lane) safe = Math.max(safe, laneProgress(path, s.x, s.z));
  let want;
  if (front >= 0) want = Math.max(safe - 6, front - 2.5);
  else want = Math.min(safe + 4, enemyFront - 7);
  want = Math.max(4, want);

  // 打塔：有己方小兵在塔下
  for (const s of G.structures) {
    if (!s.alive || s.team === h.team || !vulnerable(G, s)) continue;
    if (dist(s, h) < 16 && alliesTanking(G, h, s) >= 1 && s.target && s.target.kind === 'minion') { orderAttack(G, h, s); return; }
  }
  // 補兵：攻擊範圍附近血最少的敵方小兵
  let tgt = null, best = 1e9;
  for (const m of G.minions) {
    if (!m.alive || m.team === h.team) continue;
    const d = dist(m, h); if (d > 9) continue;
    if (enemyTowerThreat(G, h, m.x, m.z) && !(front >= 0 && alliesTanking(G, h, enemyTowerThreat(G, h, m.x, m.z)) >= 2)) continue;
    const sc = m.hp + d * 12;
    if (sc < best) { best = sc; tgt = m; }
  }
  // 小兵一群時用 Q 清兵
  if (tgt && skillReady(h, 'Q') && h.ki > 150 && Math.random() < 0.25) {
    let n = 0; for (const m of G.minions) if (m.alive && m.team !== h.team && dist(m, tgt) < 3) n++;
    if (n >= 3) { cast(G, h, 'Q', tgt.x, tgt.z); return; }
  }
  if (tgt) { orderAttack(G, h, tgt); return; }

  // 安全時集氣
  const q = pointAlong(path, want);
  const far = Math.hypot(q.x - h.x, q.z - h.z);
  const threat = enemyTowerThreat(G, h, h.x, h.z);
  if (threat && alliesTanking(G, h, threat) < 2) { const back = pointAlong(path, Math.max(0, myProg - 8)); orderMove(G, h, back.x, back.z); return; }
  if (far > 2.5) { setCharging(G, h, false); orderMove(G, h, q.x + (Math.random() - 0.5) * 2, q.z + (Math.random() - 0.5) * 2); return; }
  let enemyNear = false; for (const u of G.units) if (u.alive && u.team !== h.team && u.kind !== 'tower' && u.kind !== 'core' && dist(u, h) < 12) { enemyNear = true; break; }
  if (!enemyNear && h.ki < 300 && !h.goal && !h.target) setCharging(G, h, true);
  else if (enemyNear && h.charging) setCharging(G, h, false);
}
