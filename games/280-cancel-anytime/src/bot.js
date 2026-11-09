// 自動試玩機器人：期望傷害最大化的貪婪策略。供 tools/sim.mjs 與頁面 ?auto=1 使用。
import * as R from './rules.js';

function expDmg(s, u, sk, tu) {
  const S = R.skillDef(u, sk);
  const m = R.attackMods(s, u, tu, S.kind === 'melee' ? 'melee' : S.kind === 'aoe' ? 'aoe' : 'ranged', S.kind === 'yeet' ? u.str : S.hit);
  return R.hitChance(m.bonus, m.ac) * (R.avgDice(S.dice || '1d10+3') + (m.backstab ? 5.5 : 0));
}

// 回傳 {score, tile, sk, x, z}
function bestPlan(s, u) {
  const reach = R.reachable(s, u);
  let best = { score: 0 };
  const foes = s.units.filter(o => R.isFoe(u, o) && !o.downed);
  const ox = u.x, oz = u.z;
  for (const n of reach.values()) {
    u.x = n.x; u.z = n.z;
    const hz = s.grid[n.z][n.x].surf;
    const pen = hz && ['fire', 'cheese', 'slime', 'trap'].includes(hz.type) ? 8 : 0;
    for (const sk of ['melee', 'ranged', 'aoe', 'yeet']) {
      if (!R.canUse(s, u, sk).ok) continue;
      const S = R.skillDef(u, sk);
      if (S.kind === 'aoe') {
        for (const f of foes) {
          if (!R.validTarget(s, u, sk, f.x, f.z).ok) continue;
          let sc = 0, c = 0;
          for (const g of foes) if (Math.hypot(g.x - f.x, g.z - f.z) <= S.radius + 0.01) { sc += expDmg(s, u, sk, g); c++; }
          if (c < 2 && !f.boss) sc *= 0.5;
          sc -= 4 + pen;
          if (sc > best.score) best = { score: sc, tile: n, sk, x: f.x, z: f.z };
        }
        continue;
      }
      for (const f of foes) {
        if (!R.validTarget(s, u, sk, f.x, f.z).ok) continue;
        let sc = expDmg(s, u, sk, f) * (1 + (f.maxHp - f.hp) / f.maxHp * 0.5) - pen - n.cost * 0.05;
        if (sc > best.score) best = { score: sc, tile: n, sk, x: f.x, z: f.z };
      }
    }
  }
  u.x = ox; u.z = oz;
  return best;
}

export function botTurn(s, u) {
  // 救倒地隊友
  const down = s.units.find(o => o.side === 'hero' && o.downed && R.alive(o));
  if (down && u.key === 'karen' && R.canUse(s, u, 'bonus').ok && Math.hypot(down.x - u.x, down.z - u.z) <= 6) R.useSkill(s, u.id, 'bonus', down.x, down.z);
  if (down && R.alive(down) && down.downed && u.action) {
    const r = R.reachable(s, u);
    for (const n of r.values()) if (Math.hypot(n.x - down.x, n.z - down.z) <= 1.5) { R.moveTo(s, u.id, n.x, n.z); R.useSkill(s, u.id, 'help', down.x, down.z); break; }
  }
  // 自補
  if (u.hp < u.maxHp * 0.45 && u.key === 'chad' && u.bonus) R.useSkill(s, u.id, 'bonus');
  if (u.key === 'karen' && u.bonus && u.slots > 1) {
    const hurt = s.units.filter(o => o.side === 'hero' && R.alive(o) && o.hp < o.maxHp * 0.5);
    if (hurt.length >= 2 || hurt.some(h => h.downed)) { const h = hurt[0]; if (Math.hypot(h.x - u.x, h.z - u.z) <= 6) R.useSkill(s, u.id, 'bonus', h.x, h.z); }
  }
  if (!s.shortRestUsed && u.action && s.units.filter(o => o.side === 'hero' && R.standing(o) && o.hp < o.maxHp * 0.4).length >= 2) { R.useSkill(s, u.id, 'rest'); return; }
  if (u.key === 'doge' && u.bonus) R.useSkill(s, u.id, 'bonus');
  // 特殊機關
  if (s.L.center && R.canUse(s, u, 'valve').ok) {
    const boss = s.units.find(o => o.boss && R.alive(o));
    if (boss && s.L.center.some(([x, z]) => x === boss.x && z === boss.z)) { R.useSkill(s, u.id, 'valve'); }
  }
  if (R.canUse(s, u, 'cancel').ok && u.action) R.useSkill(s, u.id, 'cancel');
  // 5G 晶片
  if (R.canUse(s, u, 'power').ok) {
    const boss = s.units.filter(o => R.isFoe(u, o)).sort((a, b) => b.hp - a.hp)[0];
    const pw = s.party.chips[u.key];
    const t = pw === 'gaslight' ? s.units.filter(o => R.isFoe(u, o) && !o.boss).sort((a, b) => b.hp - a.hp)[0] : boss;
    if (t && R.validTarget(s, u, 'power', t.x, t.z).ok) R.useSkill(s, u.id, 'power', t.x, t.z);
  }
  if (s.over) return;
  if (u.action) {
    const p = bestPlan(s, u);
    if (p.sk) {
      if (p.tile.x !== u.x || p.tile.z !== u.z) R.moveTo(s, u.id, p.tile.x, p.tile.z);
      if (R.standing(u) && !s.over) {
        const v = R.validTarget(s, u, p.sk, p.x, p.z);
        if (v.ok) R.useSkill(s, u.id, p.sk, p.x, p.z);
      }
    } else {
      // 走向最近敵人
      const f = s.units.filter(o => R.isFoe(u, o)).sort((a, b) => R.udist(u, a) - R.udist(u, b))[0];
      if (f) {
        let bn = null, bd = 1e9;
        for (const n of R.reachable(s, u).values()) { const dd = Math.hypot(n.x - f.x, n.z - f.z); if (dd < bd) { bd = dd; bn = n; } }
        if (bn) R.moveTo(s, u.id, bn.x, bn.z);
      }
    }
  }
  // 推撞把敵人推下高台
  if (u.bonus && R.standing(u) && !s.over) {
    for (const o of s.units) if (R.isFoe(u, o) && R.validTarget(s, u, 'shove', o.x, o.z).ok) {
      const P = R.predictPush(s, u, o, u.key === 'chad' ? 3 : 2);
      if (P.fall || P.lava || P.hazard) { R.useSkill(s, u.id, 'shove', o.x, o.z); break; }
    }
  }
}

