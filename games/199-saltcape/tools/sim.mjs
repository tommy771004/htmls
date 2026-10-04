// 無頭跑一整場 AI 對戰：node tools/sim.mjs [人數] [種子]
import { getMap } from '../src/core/map.js';
import { Match, MODE } from '../src/core/sim.js';
import { botName } from '../src/core/bots.js';
import { stormRemaining } from '../src/core/storm.js';

const n = Number(process.argv[2] || 100), seed = Number(process.argv[3] || 7);
const t0 = Date.now();
const W = getMap();
console.log(`地圖 ${Date.now() - t0} ms：${W.boxes.length} 方塊、${W.buildings.length} 棟建築、${W.loot.length} 戰利品點`);
const m = new Match({ W, seed, roster: Array.from({ length: n }, (_, i) => ({ id: i + 1, name: botName(i), bot: true })) });
console.log(`戰利品 ${m.loot.size} 件`);
const kills = [];
const realOut = m.emitAll.bind(m);
m.emitAll = (ev) => { if (ev.e === 'k') kills.push(ev); realOut(ev); };
const tStart = Date.now();
let lastLog = 0, maxTick = 0;
while (!m.over && m.time < 900) {
  const a = performance.now();
  m.step();
  maxTick = Math.max(maxTick, performance.now() - a);
  if (m.time - lastLog >= 60) {
    lastLog = m.time;
    const al = m.alive();
    const modes = [0, 0, 0, 0];
    for (const p of al) modes[p.mode] = (modes[p.mode] || 0) + 1;
    console.log(`t=${m.time.toFixed(0)}s 存活 ${al.length}（機上 ${modes[0]} 自由落體 ${modes[1]} 傘 ${modes[2]} 地面 ${modes[3]}） 毒圈第 ${m.storm.phase + 1} 階 ${m.storm.state} r=${m.storm.cur.r.toFixed(0)} 剩 ${stormRemaining(m.storm, m.time).toFixed(0)}s`);
  }
}
const ms = Date.now() - tStart;
console.log(`結束 t=${m.time.toFixed(0)}s，模擬耗時 ${ms} ms（每 tick 平均 ${(ms / m.tick).toFixed(2)} ms，最慢 ${maxTick.toFixed(1)} ms）`);
const byW = {};
for (const k of kills) byW[k.w] = (byW[k.w] || 0) + 1;
console.log('擊殺方式', byW, '爆頭', kills.filter((k) => k.hs).length);
const w = m.byId.get(m.winner);
console.log('勝者', w ? `${w.name} ${w.kills} 殺` : '無');
console.log(m.standings().slice(0, 5));
