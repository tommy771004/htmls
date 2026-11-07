#!/usr/bin/env node
// 把一幀的 CPU 拆段：每個 onBeforeRender 觀察者、其餘 scene.render、endFrame。看 FAST 下剩下的時間花在哪。
// node tools/snap-phase.mjs [--page=dist/x.html] [--frames=600] [--q=&spot=key]
import { startServer, launch, GAME_DIR } from './lib/serve.mjs';
import { resolve } from 'node:path';
const arg = (k, d) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const page = arg('page', 'web/278-ochre-line.html'), F = +arg('frames', 600), Q = arg('q', '&spot=key'), prof = arg('prof', '') === '1';
const s = await startServer(undefined, { '/web/278-ochre-line.html': resolve(GAME_DIR, page) }, { isolate: true }), b = await launch();
for (const q of ['', '&nosnap=1']) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }), p = await ctx.newPage();
  await p.goto(`${s.url}/web/278-ochre-line.html?clean=1${Q}${q}`); await p.waitForFunction(() => window.__ol?.ready, null, { timeout: 120000 }); await p.waitForTimeout(2500);
  const r = await p.evaluate(n => new Promise(ok => {
    const c = __ol.ctx, sc = c.scene, en = c.engine, T = {}, add = (k, v) => (T[k] ??= []).push(v), now = () => performance.now();
    const wrap = (o, tag) => o.observers.forEach((x, i) => { const f = x.callback; x.callback = (...a) => { const t = now(); const r = f(...a); add(`${tag}${i}`, now() - t); return r; }; });
    wrap(sc.onBeforeRenderObservable, 'before'); wrap(sc.onAfterRenderObservable, 'after');
    const render = sc.render, end = en.endFrame; let t0 = 0, t1 = 0;
    sc.render = function (...a) { t0 = now(); const r = render.apply(this, a); t1 = now(); add('scene.render', t1 - t0); return r; };
    en.endFrame = function (...a) { const t = now(); const r = end.apply(this, a); add('endFrame', now() - t); add('total', now() - t0); if (T.total.length >= n) { delete sc.render; delete en.endFrame; const m = {}; for (const k in T) { const v = T[k].sort((x, y) => x - y); m[k] = +v[v.length >> 1].toFixed(3); } ok({ m, meshes: sc.meshes.length, skeletons: sc.skeletons.length, active: en.snapshotRendering, mode: en.snapshotRenderingMode, res: performance.now() > 0 }); } return r; };
  }), F);
  console.log(q || 'FAST', JSON.stringify(r));
  if (prof && !q) {
    const cdp = await ctx.newCDPSession(p); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 }); await cdp.send('Profiler.start');
    await p.waitForTimeout(6000);
    const { profile: P } = await cdp.send('Profiler.stop'), self = new Map(), byId = new Map(P.nodes.map(n => [n.id, n]));
    for (let i = 0; i < P.samples.length; i++) { const n = byId.get(P.samples[i]), k = n.callFrame.functionName || '(anon)'; self.set(k, (self.get(k) ?? 0) + P.timeDeltas[i]); }
    const fr = 6000 * 60 / 1000, top = [...self].sort((a, b) => b[1] - a[1]).filter(x => !/idle|program|garbage/.test(x[0])).slice(0, 30);
    for (const [k, v] of top) console.log((v / 1000 / fr).toFixed(3), 'ms/幀', k);
  }
  await ctx.close();
}
await b.close(); await s.close();
