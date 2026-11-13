// 無頭跑 N 場全 bot 對戰，印出回合長度、勝率、狀態分佈。node tools/sim.mjs [場數=6] [難度=normal]
import { Game } from '../src/sim/game.js';
const N = +process.argv[2] || 6, diff = process.argv[3] || 'normal';
let rounds = 0, dur = 0, wins = [0, 0, 0], to = 0, kills = 0, hs = 0, assists = 0; const st = {}; const t0 = Date.now(); let ticks = 0;
for (let s = 1; s <= N; s++) {
  const g = new Game({ seed: s * 7919, auto: true, difficulty: diff }); g.startMatch(); let rs = 0;
  for (let i = 0; i < 60 * 60 * 40 && g.phase !== 'over'; i++) {
    g.step(1 / 60); ticks++;
    for (const f of g.fx) {
      if (f.t === 'round' && f.phase === 'live') rs = g.time;
      if (f.t === 'round' && f.phase === 'post') { rounds++; dur += g.time - rs; wins[f.winner < 0 ? 2 : f.winner]++; if (f.reason === 'time') to++; }
      if (f.t === 'kill') { kills++; if (f.head) hs++; assists += f.assists.length; }
    }
    g.fx.length = 0;
    if (i % 20 === 0 && g.phase === 'live') for (const e of g.ents) if (e.alive) st[e.bot.state] = (st[e.bot.state] || 0) + 1;
  }
}
console.log(`matches=${N} rounds=${rounds} avgRound=${(dur / rounds).toFixed(1)}s wins V/E/draw=${wins} timeouts=${to} kills=${kills} hs=${hs} assists=${assists}`);
console.log('states', st, `${(ticks / (Date.now() - t0) * 1000 | 0)} ticks/s`);
