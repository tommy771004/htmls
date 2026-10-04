// 無頭模擬（Node）：不渲染，只跑規則與 AI。node tools/sim.mjs [秒數]
import { DT } from '../src/config.js';
import { newMatch, stepWorld } from '../src/world.js';

const noop = () => {}; const handle = { update: noop, remove: noop };
const fx = new Proxy({}, { get: () => () => handle });
export function newGame() { return newMatch({ fx, player: null }); }
export const step = (G) => stepWorld(G, DT);
if (import.meta.url === `file://${process.argv[1]}`) {
  const secs = +(process.argv[2] || 60);
  const G = newGame();
  const t0 = Date.now(); let lastLog = 0;
  for (let i = 0; i < secs / DT && G.winner < 0; i++) {
    step(G);
    if (G.time - lastLog >= 60) {
      lastLog = G.time;
      const towers = G.structures.filter((s) => !s.alive).map((s) => s.sid).join(',');
      const camps = G.camps.map((c) => c.mobs.some((m) => m.alive) ? c.id[0] : '-').join('');
      console.log(`t=${G.time.toFixed(0)} min=${G.minions.filter((m) => m.alive).length} camps=${camps} kills=${G.kills} down=[${towers}] ` + G.heroes.map((h) => `${h.team}${h.heroId.slice(0, 2)}L${h.level}$${h.gold | 0}i${h.inv.length}${h.alive ? '' : '✝'}${h.brain ? h.brain.mode[0] : ''}`).join(' '));
    }
  }
  console.log('winner', G.winner, 'time', G.time.toFixed(0), 'kills', G.kills, 'wall ms', Date.now() - t0);
}
