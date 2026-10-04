// 在 Node 跑整場 AI 對 AI：node tools/sim.mjs [秒數] [藍方難度] [橘方難度]
import R from '@dimforge/rapier3d-compat';
import { Sim } from '../src/core/sim.js';
import { Bot, LEVELS } from '../src/core/ai.js';
await R.init();
const secs = +(process.argv[2] || 300);
const sim = new Sim(R, { autoKickoff: true, seed: +(process.env.SEED || 7), swapCreate: !!process.env.SWAP });
const mk = (car, a) => { const b = new Bot(sim, car, 'pro'); if (a && a.startsWith('{')) b.L = { ...LEVELS.pro, ...JSON.parse(a) }; else b.setLevel(a || 'pro'); return b; };
const bots = [mk(sim.cars[0], process.argv[3]), mk(sim.cars[1], process.argv[4])];
const counts = {};
let maxBall = 0, oob = 0, t0 = performance.now();
for (let i = 0; i < secs * 120; i++) {
  for (const b of bots) b.update(1 / 120);
  sim.step();
  for (const e of sim.drainEvents()) { counts[e.type] = (counts[e.type] || 0) + 1; if (e.type === 'goal') console.log(`  ${(i / 120).toFixed(1)}s 進球 隊${e.team} 球速 ${e.speed.toFixed(1)}`); }
  const p = sim.ball.body.translation();
  if (sim.phase === 'play') {
    const v = sim.ball.body.linvel(); maxBall = Math.max(maxBall, Math.hypot(v.x, v.y, v.z));
    if (p.y < 0 || p.y > 21 || Math.abs(p.x) > 41.5) oob++;
  }
  for (const c of sim.cars) { const t = c.body.translation(); if (c.state.demolished <= 0 && (t.y < -0.5 || t.y > 21 || Math.abs(t.x) > 41.5)) { oob++; } }
  if (sim.phase === 'over') { console.log('結束於', (i / 120).toFixed(1)); break; }
}
console.log('比分', sim.score, '延長', sim.overtime, '事件', counts, '最高球速', maxBall.toFixed(1), '出界 tick', oob, `耗時 ${((performance.now() - t0) / 1000).toFixed(1)}s`);
