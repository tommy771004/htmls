#!/usr/bin/env node
// 快照 CPU 量測實驗：開／關交錯 R 輪，輸出每輪中位與截尾平均，看波動來源。
// node tools/snap-cpu.mjs [--page=dist/x.html] [--rounds=6] [--frames=600] [--isolate=1] [--q=&spot=key]
// --ab=1：同一頁交錯（__ol.cpuAB），另有 --blocks、--n、--skip；--match=1 改量實戰（士兵與 bot 都在動）
import { startServer, launch, GAME_DIR } from './lib/serve.mjs';
import { resolve } from 'node:path';
const arg = (k, d) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const page = arg('page', 'web/278-ochre-line.html'), R = +arg('rounds', 6), F = +arg('frames', 600), iso = arg('isolate', '1') === '1', Q = arg('q', '&spot=key'), warm = +arg('warm', 2500), ab = arg('ab', '') === '1';
const s = await startServer(undefined, { '/web/278-ochre-line.html': resolve(GAME_DIR, page) }, { isolate: iso }), b = await launch();
const run = async q => {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }), p = await ctx.newPage();
  await p.goto(`${s.url}/web/278-ochre-line.html?clean=1${Q}${q}`); await p.waitForFunction(() => window.__ol?.ready, null, { timeout: 120000 }); await p.waitForTimeout(warm);
  const r = await p.evaluate(n => __ol.cpu(n), F); const iso = await p.evaluate(() => crossOriginIsolated); await ctx.close(); return { ...r, iso };
};
if (ab) {
  const med = a => [...a].sort((x, y) => x - y)[a.length >> 1], rs = [];
  for (let i = 0; i < R; i++) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }), p = await ctx.newPage();
    await p.goto(`${s.url}/web/278-ochre-line.html?clean=1${Q}`); await p.waitForFunction(() => window.__ol?.ready, null, { timeout: 120000 }); await p.waitForTimeout(warm);
    if (arg('match', '') === '1') { await p.evaluate(async () => { const O = __ol, G = O.G; O.startMatch({ side: 'atk' }); G.time = 1; while (G.phase === 'buy') await new Promise(f => setTimeout(f, 50)); G.time = 900; G.me.hp = 1e6; }); await p.waitForTimeout(800); }
    const r = await p.evaluate(a => __ol.cpuAB(a), { blocks: +arg('blocks', 24), n: +arg('n', 60), skip: +arg('skip', 40) }); await ctx.close(); rs.push(r.reduction);
    console.log(i, 'on', r.on.toFixed(3), 'off', r.off.toFixed(3), '降', (r.reduction * 100).toFixed(1), '對內範圍', (Math.min(...r.rs) * 100).toFixed(1), (Math.max(...r.rs) * 100).toFixed(1));
  }
  console.log('每頁降幅', rs.map(x => (x * 100).toFixed(1)).join(' '), '中位', (med(rs) * 100).toFixed(1));
  await b.close(); await s.close(); process.exit(0);
}
const on = [], off = [];
for (let i = 0; i < R; i++) { const a = await run(''), c = await run('&nosnap=1'); on.push(a); off.push(c); console.log(i, 'on', a.median.toFixed(3), a.trim?.toFixed(3), 'p95', a.p95.toFixed(2), '| off', c.median.toFixed(3), c.trim?.toFixed(3), 'p95', c.p95.toFixed(2), '| 降', ((1 - a.median / c.median) * 100).toFixed(1), ((1 - (a.trim ?? a.median) / (c.trim ?? c.median)) * 100).toFixed(1), 'iso', a.iso); }
const med = a => [...a].sort((x, y) => x - y)[a.length >> 1], A = med(on.map(x => x.median)), B = med(off.map(x => x.median));
console.log('中位', A.toFixed(3), B.toFixed(3), ((1 - A / B) * 100).toFixed(1) + '%');
await b.close(); await s.close();
