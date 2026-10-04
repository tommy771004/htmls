// 一場對戰的建立與固定步長推進（畫面與 Node 模擬共用）。
import { WAVE_EVERY, HERO_ORDER, FOUNTAIN } from './config.js';
import { createWorld, addUnit, makeHero, spawnWave, updateMinion, updateTower, heroTick, tickStatus, physics, separate, respawnHero } from './units.js';
import { heroAct, updateProjectiles, updateZones, wireShots, levelSkill, updateWards } from './combat.js';
import { makeBrain, updateAI } from './ai.js';
import { setupCamps, updateCamps, aggroCamp } from './jungle.js';
import { createVision, updateVision } from './vision.js';
import { aiShop } from './items.js';
import { setupDragonBalls, updateDragonBalls } from './dragonballs.js';

// opts: { fx, sfx, shake, cam, player: heroId|null, lane, diff, teams: [[ids],[ids]] }
export function newMatch(opts) {
  const G = createWorld();
  G.fx = opts.fx; G.cam = opts.cam || {}; G.zones = []; G.timers = [];
  G.later = (d, fn) => G.timers.push({ t: G.time + d, fn });
  G.shake = opts.shake || (() => {}); G.sfx = opts.sfx || (() => null);
  G.vision = createVision(); G.wards = [];
  wireShots(G); setupCamps(G); setupDragonBalls(G);
  G.on('monsterHit', ({ dst, src }) => aggroCamp(G, dst, src));
  const lane = opts.lane ?? 1, diff = opts.diff ?? 1;
  // 隊伍：玩家選的角色＋兩名隊友；敵隊三名，兩隊不重複
  let teams = opts.teams;
  if (!teams) {
    const pool = HERO_ORDER.filter((h) => h !== opts.player).sort(() => Math.random() - 0.5);
    teams = [[opts.player || pool.pop(), pool[0], pool[1]], [pool[2], pool[3], pool[4]]];
  }
  const lanesA = [lane, ...[0, 1, 2].filter((l) => l !== lane)];
  teams[0].forEach((id, i) => {
    const h = addUnit(G, makeHero(G, id, 0, lanesA[i], i === 0 && !!opts.player));
    if (h.isPlayer) G.player = h; else h.brain = makeBrain(h, diff);
  });
  teams[1].forEach((id, i) => { const h = addUnit(G, makeHero(G, id, 1, i, false)); h.brain = makeBrain(h, diff); });
  if (!G.player) G.player = G.heroes[0];
  if (G.player.isPlayer) levelSkill(G, G.player, 'Q');
  for (const h of G.heroes) { const f = FOUNTAIN[h.team]; h.x = f[0] + (Math.random() - 0.5) * 4; h.z = f[1] + (Math.random() - 0.5) * 4; h.facing = h.team ? -Math.PI * 0.25 : Math.PI * 0.75; }
  return G;
}

export function stepWorld(G, dt) {
  G.time += dt;
  if (G.time >= G.nextWave) { spawnWave(G); G.nextWave += WAVE_EVERY; }
  for (let i = G.timers.length - 1; i >= 0; i--) if (G.time >= G.timers[i].t) { const t = G.timers[i]; G.timers.splice(i, 1); t.fn(); }
  updateVision(G, dt);
  for (const h of G.heroes) {
    if (!h.alive) { h.deadT += dt; h.respawn -= dt; if (h.brain) aiShop(G, h); if (h.respawn <= 0 && G.winner < 0) respawnHero(G, h); continue; }
    tickStatus(h, dt);
    heroTick(G, h, dt);
    if (!h.alive) continue;
    if (h.brain) { updateAI(G, h, dt); aiShop(G, h); }
    heroAct(G, h, dt);
    physics(G, h, dt);
  }
  for (const m of G.minions) {
    if (!m.alive) { m.deadT += dt; continue; }
    if (m.spawnDelay > 0) { m.spawnDelay -= dt; continue; }
    tickStatus(m, dt); m.anim.t += dt;
    updateMinion(G, m, dt);
    physics(G, m, dt);
  }
  updateCamps(G, dt);
  updateDragonBalls(G, dt);
  for (const m of G.monsters) if (m.alive) { tickStatus(m, dt); physics(G, m, dt); }
  for (const s of G.structures) if (s.alive && G.winner < 0) updateTower(G, s, dt);
  separate(G, dt);
  updateProjectiles(G, dt);
  updateZones(G, dt);
  updateWards(G, dt);
  for (let i = G.minions.length - 1; i >= 0; i--) {
    const m = G.minions[i];
    if (!m.alive && m.deadT > 1.6) { G.minions.splice(i, 1); const j = G.units.indexOf(m); if (j >= 0) G.units.splice(j, 1); G.emit('despawn', m); }
  }
}
