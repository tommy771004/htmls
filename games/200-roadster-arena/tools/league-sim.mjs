// 在 Node 跑一場 AI 對戰看規則與 AI：node tools/league-sim.mjs [秒數] [每隊人數] [難度]
import { initRapier } from './harness.mjs';
import { League, Bot } from '../src/core/league.js';
const [secs = '120', per = '3', level = 'pro'] = process.argv.slice(2);
const R = await initRapier();
const lg = new League(R);
for (let t = 0; t < 2; t++) for (let i = 0; i < Number(per); i++) lg.addCar(`b${t}${i}`, t, `BOT ${t}${i}`, new Bot(level, 7 + t * 31 + i * 3));
lg.kickoff();
const n = Math.round(Number(secs) * 120);
let touches = 0, maxBall = 0;
for (let i = 0; i < n; i++) {
  const ev = lg.tick();
  for (const e of ev) {
    if (e.type === 'touch') touches++;
    if (e.type === 'goal' || e.type === 'end' || e.type === 'overtime') console.log((i / 120).toFixed(1), e.type, JSON.stringify(e.score || ''), e.by || '');
  }
  const v = lg.ball.linvel(); maxBall = Math.max(maxBall, Math.hypot(v.x, v.y, v.z));
  const p = lg.ball.translation();
  if (!Number.isFinite(p.x)) { console.log('NaN ball at', i); break; }
}
console.log('score', lg.score, 'touches', touches, 'max ball speed', maxBall.toFixed(1), 'clock', lg.clock.toFixed(1), 'phase', lg.phase);
