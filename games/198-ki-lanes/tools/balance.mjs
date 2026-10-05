// 英雄平衡統計：多行程平行跑 AI 對 AI 整場（隊伍隨機），彙整每名英雄的勝率、KDA、對英雄傷害。
// node tools/balance.mjs [場數=280] [行程數=CPU−2]
import { fork } from 'node:child_process';
import { cpus } from 'node:os';
import { DT, HERO_ORDER } from '../src/config.js';
import { newGame, step } from './sim.mjs';

const MAX = 1800; // 秒：超過就以剩餘建築血量判勝負
function playOne() {
  const G = newGame();
  const dmg = new Map();
  G.on('hit', ({ src, dst, amount }) => { if (src && src.kind === 'hero' && dst && dst.kind === 'hero') dmg.set(src, (dmg.get(src) || 0) + amount); });
  while (G.winner < 0 && G.time < MAX) step(G);
  let winner = G.winner;
  if (winner < 0) { const hp = [0, 1].map((t) => G.structures.filter((s) => s.team === t && s.alive).reduce((a, s) => a + s.hp / s.maxHp, 0)); winner = hp[0] >= hp[1] ? 0 : 1; }
  return { winner, time: G.time, timeout: G.winner < 0, heroes: G.heroes.map((h) => ({ id: h.heroId, team: h.team, k: h.kills, d: h.deaths, a: h.assists || 0, lv: h.level, dmg: Math.round(dmg.get(h) || 0) })) };
}

if (process.argv[2] === '--worker') {
  const n = +process.argv[3];
  for (let i = 0; i < n; i++) process.send(playOne());
  process.exit(0);
} else {
  const total = +(process.argv[2] || 280), P = +(process.argv[3] || Math.max(1, cpus().length - 2));
  const games = [];
  const t0 = Date.now();
  await Promise.all(Array.from({ length: P }, (_, i) => new Promise((res) => {
    const n = Math.floor(total / P) + (i < total % P ? 1 : 0);
    if (!n) return res();
    const c = fork(new URL(import.meta.url).pathname, ['--worker', String(n)]);
    c.on('message', (g) => { games.push(g); if (games.length % 20 === 0) process.stderr.write(`${games.length}/${total}\n`); });
    c.on('exit', res);
  })));
  const S = Object.fromEntries(HERO_ORDER.map((id) => [id, { n: 0, w: 0, k: 0, d: 0, a: 0, dmg: 0 }]));
  for (const g of games) for (const h of g.heroes) { const s = S[h.id]; s.n++; s.w += h.team === g.winner ? 1 : 0; s.k += h.k; s.d += h.d; s.a += h.a; s.dmg += h.dmg; }
  const avgT = games.reduce((a, g) => a + g.time, 0) / games.length, blue = games.filter((g) => g.winner === 0).length / games.length;
  console.log(`${games.length} 場，平均 ${(avgT / 60).toFixed(1)} 分，逾時 ${games.filter((g) => g.timeout).length} 場，藍方勝率 ${(blue * 100).toFixed(0)}%，${((Date.now() - t0) / 1000).toFixed(0)} 秒`);
  console.log('英雄        場  勝率   K/場  D/場  A/場  對英雄傷害/場');
  for (const [id, s] of Object.entries(S).sort((a, b) => b[1].w / b[1].n - a[1].w / a[1].n)) {
    const f = (v) => (v / s.n).toFixed(1).padStart(5);
    console.log(`${id.padEnd(9)} ${String(s.n).padStart(4)}  ${((s.w / s.n) * 100).toFixed(0).padStart(3)}%  ${f(s.k)} ${f(s.d)} ${f(s.a)}  ${String(Math.round(s.dmg / s.n)).padStart(8)}`);
  }
}
