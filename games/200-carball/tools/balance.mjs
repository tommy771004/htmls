// 難度平衡：指定難度對上職業，兩邊各打 N 場（換邊消除開球物理的先後順序偏差）
// node tools/balance.mjs rookie 3
import R from '@dimforge/rapier3d-compat';
import { Sim } from '../src/core/sim.js';
import { Bot, LEVELS } from '../src/core/ai.js';
await R.init();
const lv = process.argv[2] || 'rookie', N = +(process.argv[3] || 3), vs = process.argv[4] || 'pro';
const mk = (sim, car, a) => { const b = new Bot(sim, car, 'pro'); if (a.startsWith('{')) b.L = { ...LEVELS.pro, ...JSON.parse(a) }; else b.setLevel(a); return b; };
let mine = 0, theirs = 0;
for (let side = 0; side < 2; side++) for (let k = 0; k < N; k++) {
  const sim = new Sim(R, { autoKickoff: true, seed: 100 + k });
  const bots = side === 0 ? [mk(sim, sim.cars[0], lv), mk(sim, sim.cars[1], vs)] : [mk(sim, sim.cars[0], vs), mk(sim, sim.cars[1], lv)];
  for (let i = 0; i < 120 * 330 && sim.phase !== 'over'; i++) { for (const b of bots) b.update(1 / 120); sim.step(); sim.drainEvents(); }
  mine += sim.score[side]; theirs += sim.score[1 - side];
}
console.log(`${lv} 對 ${vs}：${mine} 比 ${theirs}`);
