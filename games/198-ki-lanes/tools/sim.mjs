// 無頭模擬（Node）：不渲染，只跑規則與 AI。node tools/sim.mjs [秒數] [seed]
import { DT, WAVE_EVERY, HERO_ORDER, FOUNTAIN } from '../src/config.js';
import { createWorld, addUnit, makeHero, spawnWave, updateMinion, updateTower, heroTick, tickStatus, physics, separate, respawnHero } from '../src/units.js';
import { heroAct, updateProjectiles, updateZones, wireShots, levelSkill } from '../src/combat.js';
import { makeBrain, updateAI } from '../src/ai.js';

const noop = () => {}; const handle = { update: noop, remove: noop };
const fx = new Proxy({}, { get: () => () => handle });
export function newGame(playerAI = true) {
  const G = createWorld();
  G.fx = fx; G.cam = {}; G.zones = []; G.timers = [];
  G.later = (d, fn) => G.timers.push({ t: G.time + d, fn });
  G.shake = noop; G.sfx = () => null;
  wireShots(G);
  const ids = HERO_ORDER;
  [0, 1, 2].forEach((l) => { const h = addUnit(G, makeHero(G, ids[l], 0, l, l === 1)); if (l === 1) G.player = h; if (playerAI || l !== 1) h.brain = makeBrain(h, 1); });
  [0, 1, 2].forEach((l) => { const h = addUnit(G, makeHero(G, ids[(l + 1) % 4], 1, l, false)); h.brain = makeBrain(h, 1); });
  return G;
}
export function step(G, dt = DT) {
  G.time += dt;
  if (G.time >= G.nextWave) { spawnWave(G); G.nextWave += WAVE_EVERY; }
  for (let i = G.timers.length - 1; i >= 0; i--) if (G.time >= G.timers[i].t) { const t = G.timers[i]; G.timers.splice(i, 1); t.fn(); }
  for (const h of G.heroes) {
    if (!h.alive) { h.deadT += dt; h.respawn -= dt; if (h.respawn <= 0 && G.winner < 0) respawnHero(G, h); continue; }
    tickStatus(h, dt); heroTick(G, h, dt); if (!h.alive) continue;
    if (h.brain) updateAI(G, h, dt);
    heroAct(G, h, dt); physics(G, h, dt);
  }
  for (const m of G.minions) { if (!m.alive) { m.deadT += dt; continue; } if (m.spawnDelay > 0) { m.spawnDelay -= dt; continue; } tickStatus(m, dt); m.anim.t += dt; updateMinion(G, m, dt); physics(G, m, dt); }
  for (const s of G.structures) if (s.alive && G.winner < 0) updateTower(G, s, dt);
  separate(G, dt); updateProjectiles(G, dt); updateZones(G, dt);
  for (let i = G.minions.length - 1; i >= 0; i--) { const m = G.minions[i]; if (!m.alive && m.deadT > 1.6) { G.minions.splice(i, 1); G.units.splice(G.units.indexOf(m), 1); } }
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const secs = +(process.argv[2] || 60);
  const G = newGame(true);
  const t0 = Date.now();
  let lastLog = 0;
  for (let i = 0; i < secs / DT && G.winner < 0; i++) {
    step(G);
    if (G.time - lastLog >= 30) {
      lastLog = G.time;
      const towers = G.structures.filter((s) => !s.alive).map((s) => s.sid).join(',');
      console.log(`t=${G.time.toFixed(0)} minions=${G.minions.filter((m) => m.alive).length} kills=${G.kills} down=[${towers}] heroes=` + G.heroes.map((h) => `${h.team}${h.heroId[0]}L${h.level}${h.alive ? '' : '✝'}(${h.x | 0},${h.z | 0})${h.brain ? h.brain.mode[0] : ''}`).join(' '));
    }
  }
  console.log('winner', G.winner, 'time', G.time.toFixed(0), 'wall ms', Date.now() - t0);
}
