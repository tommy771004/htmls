#!/usr/bin/env node
// 量新槍對 draw、開機時間、下載量的影響：node tools/gun-measure.mjs [--page=dist/x.html] [--base=dist/base.html] [--runs=3]
// 三種狀態：base（改動前的打包）、alias（新槍 id 全走替身，index.json 當作空的）、full（現在 assets 裡有的新槍）。
// 不動 assets：alias 是用伺服器把 index.json 換成空清單做到的。
import { startServer, launch, GAME_DIR } from './lib/serve.mjs';
import { resolve } from 'node:path';
import { writeFileSync, existsSync } from 'node:fs';

const arg = (n, d) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const page = arg('page', 'dist/guns.html'), base = arg('base', 'dist/base.html'), runs = +arg('runs', 3);
const empty = resolve(GAME_DIR, 'dist/guns-empty.json'); writeFileSync(empty, '{"guns":{}}\n');
const INDEX = '/assets/278/models/guns/index.json';
const med = a => [...a].sort((x, y) => x - y)[a.length >> 1];

async function state(name, html, extra, qs) {
  const s = await startServer(undefined, { '/web/278-ochre-line.html': resolve(GAME_DIR, html), ...extra }), b = await launch(), res = [];
  try {
    for (let i = 0; i < runs; i++) {
      const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }), p = await ctx.newPage(), bad = [];
      p.on('console', m => { if (m.type() === 'error') bad.push(m.text().slice(0, 200)); });
      p.on('pageerror', e => bad.push(String(e).slice(0, 200)));
      await p.goto(`${s.url}/web/278-ochre-line.html?clean=1${qs}`);
      await p.waitForFunction(() => window.__ol?.ready || /^ERR/.test(document.title), null, { timeout: 120000 });
      await p.evaluate(() => { __ol.startMatch({ side: 'atk' }); __ol.G.time = 0; }); await p.waitForTimeout(1200);
      const r = await p.evaluate(async () => {
        const O = __ol, st = () => O.stats(), a = st(); await new Promise(f => setTimeout(f, 1500)); const c = st();
        const e = performance.getEntriesByType('resource'), net = e.filter(x => /models\/guns\//.test(x.name));
        const cpu = await O.cpu(120);
        return { boot: O.boot, draws: Math.round((c.draws - a.draws) / Math.max(1, c.frame - a.frame)), meshes: c.meshes, webgpu: c.webgpu, reqs: e.length, gunReqs: net.length, gunKB: net.reduce((n, x) => n + (x.decodedBodySize || 0), 0) / 1024, cpu: cpu.median, cpuP95: cpu.p95 };
      });
      res.push({ ...r, bad: bad.length }); await ctx.close();
    }
  } finally { await b.close(); await s.close(); }
  const f = k => med(res.map(r => r[k])), o = { name, boot: Math.round(f('boot')), boots: res.map(r => Math.round(r.boot)), draws: f('draws'), meshes: f('meshes'), webgpu: res[0].webgpu, reqs: f('reqs'), gunReqs: f('gunReqs'), gunMB: +(f('gunKB') / 1024).toFixed(2), cpu: +f('cpu').toFixed(2), cpuP95: +f('cpuP95').toFixed(2), errors: res.reduce((n, r) => n + r.bad, 0) };
  console.log(JSON.stringify(o)); return o;
}

const list = [];
for (const [tag, qs] of [['WebGPU', ''], ['WebGL', '&gfx=webgl']]) {
  console.log('--', tag);
  if (existsSync(resolve(GAME_DIR, base))) list.push(await state('base', base, {}, qs));
  list.push(await state('alias', page, { [INDEX]: empty }, qs));
  list.push(await state('full', page, {}, qs));
}
writeFileSync(resolve(GAME_DIR, 'dist/gun-measure.json'), JSON.stringify(list, null, 1));
