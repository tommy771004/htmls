// 單位：英雄、小兵、建築。移動、碰撞、傷害、死亡、經驗。
import {
  HEROES, MINION, MINION_GROWTH, TOWER, KI_MAX, KI_BAR, MAX_LEVEL, xpToNext, respawnTime, XP_SHARE_RADIUS,
  FOUNTAIN, BASE, COMBO_WINDOW, HITSTOP, SPARK, WAVE_EVERY, FIRST_WAVE, SIEGE_FROM_WAVE,
} from './config.js';
import { collide, OBSTACLES, lanePath, heightAt, STRUCTURES, laneProgress } from './map.js';

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
    heroId, def, lane, isPlayer, level: 1, xp: 0, sp: 1, ranks: { Q: 0, W: 0, E: 0, R: 0 }, cds: { Q: 0, W: 0, E: 0, R: 0, D: 0, B: 0 },
    ki: 100, kills: 0, deaths: 0, assists: 0, chain: 0, chainT: -9, target: null, goal: null, order: null, action: null,
    respawn: 0, recall: 0, empowered: 0, charging: false, damagers: new Map(), lastAttackHeroT: -99, cs: 0, hitstopOwner: isPlayer,
  });
  recalcStats(u);
  u.hp = u.maxHp;
  return u;
}
export function recalcStats(u) {
  const s = u.def.stats, lv = u.level - 1;
  const ratio = u.maxHp ? u.hp / u.maxHp : 1;
  u.maxHp = s.hp + s.hpLv * lv; u.hp = ratio * u.maxHp;
  u.ad = s.ad + s.adLv * lv; u.range = s.range; u.as = s.as * Math.pow(0.975, lv); u.ms = s.ms; u.armor = s.armor + lv * 0.006;
}

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
  if (s.kind === 'minion' || s.kind === 'hero') return true;
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
  let a = amount;
  if (src && src.st && src.st.spark > 0) a *= SPARK.dmg;
  if (dst.kind === 'hero') a *= 1 - (dst.armor || 0);
  if (dst.kind === 'tower' || dst.kind === 'core') { if (src && src.kind === 'hero' && (opts.type === 'skill' || opts.type === 'super')) a *= 0.55; }
  if (dst.st.shield > 0) { const s = Math.min(dst.st.shield, a); dst.st.shield -= s; a -= s; }
  a = Math.round(a);
  dst.hp -= a; dst.flash = 0.12;
  dst.lastHitBy = src; dst.lastHitT = G.time;
  if (src && src.kind === 'hero' && dst.kind === 'hero') { dst.damagers.set(src, G.time); src.lastAttackHeroT = G.time; src.lastHeroTarget = dst; }
  // 氣力
  if (!opts.noKi) {
    if (src && src.kind === 'hero') addKi(G, src, a * (dst.kind === 'hero' ? 0.34 : 0.14) + (opts.type === 'L' || opts.type === 'M' || opts.type === 'H' ? 6 : 0));
    if (dst.kind === 'hero') addKi(G, dst, a * 0.18);
  }
  // 狀態
  if (dst.kind === 'hero' || dst.kind === 'minion') {
    if (opts.knock) { const ang = opts.kdir ?? (src ? angTo(src, dst) : 0), p = opts.knock * (dst.kind === 'minion' ? 1.4 : 1); dst.kx += Math.sin(ang) * p; dst.kz += Math.cos(ang) * p; }
    if (opts.stun) dst.st.stun = Math.max(dst.st.stun, opts.stun * (dst.kind === 'hero' ? 1 : 1.3));
    if (opts.air) { dst.st.stun = Math.max(dst.st.stun, opts.air); dst.vy = Math.max(dst.vy, opts.air * 9.8 * 0.5); }
    if (opts.freeze) { dst.st.frozen = Math.max(dst.st.frozen, opts.freeze); dst.st.stun = Math.max(dst.st.stun, opts.freeze); }
    if (opts.slow) { dst.st.slow = Math.max(dst.st.slow, opts.slowT || 1.5); dst.st.slowAmt = Math.max(dst.st.slowAmt, opts.slow); }
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
export function heal(G, u, amount) { if (!u.alive) return; u.hp = Math.min(u.maxHp, u.hp + amount); }

export function addKi(G, h, v) {
  if (!h.alive) return;
  const before = Math.floor(h.ki / KI_BAR);
  h.ki = clamp(h.ki + v, 0, KI_MAX);
  const after = Math.floor(h.ki / KI_BAR);
  if (after > before) G.emit('kibar', { h, bars: after });
}

export function gainXp(G, h, xp) {
  if (!h.alive && h.kind !== 'hero') return;
  if (h.level >= MAX_LEVEL) return;
  h.xp += xp;
  while (h.level < MAX_LEVEL && h.xp >= xpToNext(h.level)) {
    h.xp -= xpToNext(h.level); h.level++; h.sp++;
    const old = h.maxHp; recalcStats(h); h.hp += (h.maxHp - old) * 0.6 + h.maxHp * 0.05; h.hp = Math.min(h.hp, h.maxHp);
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
    if (src && src.kind === 'hero') src.cs++;
  } else if (u.kind === 'hero') {
    u.deaths++; u.respawn = respawnTime(u.level); u.recall = 0; u.charging = false;
    G.kills[killerTeam]++;
    const killer = src && src.kind === 'hero' ? src : [...u.damagers.entries()].filter(([h, t]) => G.time - t < 10 && h.team === killerTeam).sort((a, b) => b[1] - a[1]).map((e) => e[0])[0];
    const assists = [...u.damagers.entries()].filter(([h, t]) => G.time - t < 10 && h !== killer && h.team === killerTeam).map((e) => e[0]);
    const bounty = 140 + u.level * 38;
    if (killer) { killer.kills++; gainXp(G, killer, bounty); addKi(G, killer, 120); }
    for (const a of assists) { a.assists++; gainXp(G, a, bounty * 0.5); }
    for (const h of G.heroes) if (h.team === killerTeam && h !== killer && !assists.includes(h) && h.alive && dist(h, u) < XP_SHARE_RADIUS) gainXp(G, h, bounty * 0.4);
    u.damagers.clear();
    G.emit('herodeath', { u, killer, assists });
  } else {
    for (const h of G.heroes) if (h.team === killerTeam) gainXp(G, h, u.kind === 'core' ? 0 : 110);
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
  for (const o of OBSTACLES) consider(o.x, o.z, o.r);
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
      const wa = a.kind === 'hero' ? (b.kind === 'hero' ? 0.5 : 0.15) : (b.kind === 'hero' ? 0.85 : 0.5);
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
    if (!o.alive || o.team === m.team || !vulnerable(G, o)) continue;
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
  if (st.spark > 0) { st.spark -= dt; heal(G, h, h.maxHp * SPARK.heal / SPARK.dur * dt); addKi(G, h, 12 * dt); }
  if (st.shieldT > 0) { st.shieldT -= dt; if (st.shieldT <= 0) st.shield = 0; }
  // 泉水
  const f = FOUNTAIN[h.team], fe = FOUNTAIN[1 - h.team];
  if (Math.hypot(h.x - f[0], h.z - f[1]) < 11) { heal(G, h, h.maxHp * 0.14 * dt); addKi(G, h, 30 * dt); }
  if (Math.hypot(h.x - fe[0], h.z - fe[1]) < 12) damage(G, null, h, 600 * dt, { type: 'true', noKi: true });
  // 被動回血、回氣
  if (G.time - h.lastHitT > 6) heal(G, h, h.maxHp * 0.004 * dt);
  addKi(G, h, 2.5 * dt);
  if (h.charging) addKi(G, h, 75 * dt);
  // 回城
  if (h.recall > 0) {
    h.recall -= dt;
    if (h.recall <= 0) { h.recall = 0; h.x = f[0] + (h.team ? -1 : 1) * 2; h.z = f[1] + (h.team ? 1 : -1) * 2; h.goal = null; h.target = null; G.emit('recall', { h, state: 'done' }); }
  }
}
export function moveSpeed(h) {
  let s = h.ms;
  if (h.st.spark > 0) s *= SPARK.ms;
  if (h.st.slow > 0) s *= 1 - h.st.slowAmt;
  return s;
}
export function tickStatus(u, dt) {
  const st = u.st;
  if (st.stun > 0) st.stun -= dt;
  if (st.frozen > 0) st.frozen -= dt;
  if (st.slow > 0) { st.slow -= dt; if (st.slow <= 0) st.slowAmt = 0; }
  if (st.invuln > 0) st.invuln -= dt;
  if (st.mark > 0) st.mark -= dt;
  if (u.flash > 0) u.flash -= dt;
}

export function respawnHero(G, h) {
  const f = FOUNTAIN[h.team];
  h.alive = true; h.hp = h.maxHp; h.x = f[0] + (Math.random() - 0.5) * 3; h.z = f[1] + (Math.random() - 0.5) * 3;
  h.y = 0; h.vy = 0; h.kx = h.kz = 0; h.st.stun = h.st.slow = h.st.frozen = 0; h.st.slowAmt = 0; h.goal = null; h.target = null; h.action = null;
  h.ki = Math.max(h.ki, 100);
  G.emit('respawn', h);
}

export { WAVE_EVERY, heightAt, laneProgress };
