// 野怪（規則面）：營地定時重生；被打才反擊，離營太遠就回家並回滿血。大猿是王，擊殺給全隊金幣與「大猿之力」。
import { CAMPS, MONSTER, CAMP_FIRST, CAMP_RESPAWN, BOSS_FIRST, BOSS_RESPAWN, LEASH } from './config.js';
import { addUnit, dist, face, steer, damage, targetable } from './units.js';

let nid = 0;
export function setupCamps(G) {
  G.camps = CAMPS.map((c) => ({ ...c, mobs: [], next: c.boss ? BOSS_FIRST : CAMP_FIRST }));
  G.monsters = [];
}
function spawnCamp(G, c) {
  c.mobs = [];
  for (let i = 0; i < c.n; i++) {
    const d = MONSTER[c.kind], a = (i / c.n) * Math.PI * 2, off = c.n > 1 ? 1.6 : 0;
    const u = {
      id: 100000 + nid++, kind: 'monster', mkind: c.kind, team: 2, camp: c.id, boss: !!c.boss,
      x: c.x + Math.cos(a) * off, z: c.z + Math.sin(a) * off, home: { x: c.x + Math.cos(a) * off, z: c.z + Math.sin(a) * off },
      y: 0, vy: 0, radius: d.radius, hp: d.hp * (1 + G.time / 900), maxHp: d.hp * (1 + G.time / 900), alive: true, facing: Math.random() * 6,
      st: { stun: 0, slow: 0, slowAmt: 0, frozen: 0, shield: 0, shieldT: 0, spark: 0, mark: 0, invuln: 0 },
      kx: 0, kz: 0, atkCd: 0, anim: { name: 'idle', t: 0 }, lastHitBy: null, lastHitT: -99, deadT: 0, flash: 0,
      dmg: d.dmg * (1 + G.time / 900), range: d.range, as: d.cd, ms: d.speed, xp: d.xp, gold: d.gold, ranged: d.ranged, aoe: d.aoe || 0,
      armor: c.boss ? 0.2 : 0, target: null, state: 'idle', windup: 0,
    };
    c.mobs.push(u); G.monsters.push(u); addUnit(G, u);
  }
  G.emit('campSpawn', c);
}
export function updateCamps(G, dt) {
  for (const c of G.camps) {
    if (c.mobs.length && c.mobs.every((m) => !m.alive)) { c.mobs = []; c.next = G.time + (c.boss ? BOSS_RESPAWN : CAMP_RESPAWN); }
    if (!c.mobs.length && G.time >= c.next) spawnCamp(G, c);
  }
  for (const m of G.monsters) if (m.alive) updateMonster(G, m, dt); else m.deadT += dt;
  // 移除倒下很久的野怪
  for (let i = G.monsters.length - 1; i >= 0; i--) {
    const m = G.monsters[i];
    if (!m.alive && m.deadT > 2) { G.monsters.splice(i, 1); const j = G.units.indexOf(m); if (j >= 0) G.units.splice(j, 1); G.emit('despawn', m); }
  }
}
// 營地的同伴一起反擊
export function aggroCamp(G, m, src) {
  if (!src || src.team > 1) return;
  const c = G.camps.find((k) => k.id === m.camp); if (!c) return;
  for (const o of c.mobs) if (o.alive && o.state !== 'return') { if (!o.target || !o.target.alive) o.target = src; o.state = 'fight'; }
}
function updateMonster(G, m, dt) {
  m.anim.t += dt; m.atkCd -= dt;
  if (m.st.stun > 0) { m.st.stun -= dt; m.anim.name = 'idle'; return; }
  const homeD = Math.hypot(m.x - m.home.x, m.z - m.home.z);
  if (m.state === 'return') {
    m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.25 * dt);
    if (steer(G, m, m.home.x, m.home.z, m.ms * 1.4, dt, 0.4)) { m.state = 'idle'; m.anim.name = 'idle'; m.hp = m.maxHp; }
    else m.anim.name = 'walk';
    return;
  }
  if (m.state === 'idle') { m.anim.name = m.boss && Math.sin(G.time * 0.4 + m.id) > 0.995 ? 'roar' : 'idle'; if (m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.05 * dt); return; }
  // fight
  const t = m.target;
  if (!t || !t.alive || !targetable(G, t) || homeD > LEASH || dist(t, m.home) > LEASH + 6) { m.target = null; m.state = 'return'; m.windup = 0; return; }
  if (m.windup > 0) {
    m.windup -= dt;
    if (m.windup <= 0) {
      if (m.aoe) {
        const fx = m.x + Math.sin(m.facing) * 2.5, fz = m.z + Math.cos(m.facing) * 2.5;
        for (const u of G.units) if (u.alive && u.team <= 1 && (u.kind === 'hero' || u.kind === 'minion') && Math.hypot(u.x - fx, u.z - fz) < m.aoe + u.radius) damage(G, m, u, m.dmg, { type: 'H', air: 0.5, noKi: false });
        G.emit('apeSlam', { m, x: fx, z: fz });
      } else if (m.ranged) G.emit('monsterShot', { src: m, dst: t });
      else if (dist(t, m) < m.range + t.radius + m.radius + 0.6) damage(G, m, t, m.dmg, { type: 'M' });
    }
    return;
  }
  const d = dist(t, m) - t.radius - m.radius;
  if (d > m.range) { steer(G, m, t.x, t.z, m.ms, dt); m.anim.name = 'walk'; return; }
  face(m, t.x, t.z);
  if (m.atkCd <= 0) { m.atkCd = m.as; m.windup = m.boss ? 0.55 : 0.2; m.anim.name = 'atk'; m.anim.t = 0; }
  else if (m.anim.t > 0.6) m.anim.name = 'idle';
}
export function bossAlive(G) { const c = G.camps.find((k) => k.boss); return c && c.mobs.some((m) => m.alive) ? c.mobs.find((m) => m.alive) : null; }
