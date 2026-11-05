// 戰鬥觀戰效能量測：N 場戰鬥（赤蠍幫 vs 鐵幕保全傭兵，有的加通緝星級與爆炸），玩家無敵站在傭兵後面，固定相機繞著戰場轉。
// 每場記：每幀幀時、CPU 邏輯／送出、顯示卡（timestamp query）、draw call、三角形、卡頓與當時新編著色器／貼圖／幾何，
// 以及這段時間 renderer 與 GPU 行程的 CPU（CDP SystemInfo）。結果每場寫一次 OUT（中途掛掉也留得下來）。
//   N=100 OUT=x.json HTML=web/260-neon-nightcity.html SECS=30 node tools/battle.mjs
//   PROFILE=1：每場同時錄 CPU 剖析，彙整自身時間前幾名
//   HTMLS='base=web/_260base.html;cur=web/260-neon-nightcity.html'：兩個建置各開一頁、同一個瀏覽器，每個地點各打一場（順序輪換），
//     閒著的那頁開 Esc 選單暫停（暫停時只畫選單、不跑世界），新舊版吃同一段機器負載
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { chromePath, GPU_ARGS } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), repo = resolve(root, '../..');
const N = +(process.env.N || 100), SECS = +(process.env.SECS || 30), OUT = process.env.OUT || resolve(root, '.cache/battle.json');
const HTML = process.env.HTML || 'web/260-neon-nightcity.html', START = +(process.env.START || 0), PROFILE = !!process.env.PROFILE;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.png': 'image/png', '.jpg': 'image/jpeg', '.ktx2': 'image/ktx2' };
const srv = createServer((q, s) => {
  const f = resolve(repo, '.' + decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(repo + sep) || !existsSync(f) || !statSync(f).isFile()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const urlOf = h => `http://127.0.0.1:${srv.address().port}/${h}?perf=1&gpu=${process.env.GPU || 'high'}&civ=0&story=0${process.env.Q || ''}`, url = urlOf(HTML);
const HTMLS = process.env.HTMLS ? process.env.HTMLS.split(';').map(x => { const k = x.indexOf('='); return { name: x.slice(0, k), html: x.slice(k + 1) }; }) : null;

const browser = await chromium.launch({ headless: true, executablePath: chromePath(), args: [...GPU_ARGS, '--disable-gpu-vsync', '--disable-frame-rate-limit', ...(process.env.ARGS ? process.env.ARGS.split(' ') : [])] });
const bcdp = await browser.newBrowserCDPSession();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const log = { errors: [], pageerrors: [] };
let page, pcdp;
const ev = (fn, arg) => page.evaluate(fn, arg);
async function openPage(h, tag) {
  const p = await ctx.newPage();
  p.on('pageerror', e => log.pageerrors.push(tag + String(e.message || e) + ' @ ' + String(e.stack || '').split('\n').slice(1, 7).join(' | ')));
  p.on('console', m => { if (m.type() === 'error') log.errors.push(tag + m.text().slice(0, 300)); });
  await p.goto(urlOf(h), { waitUntil: 'load', timeout: 120000 });
  await p.waitForFunction(() => window.__nc && window.__nc.ready, null, { timeout: 300000, polling: 300 });
  return { p, cdp: await ctx.newCDPSession(p) };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function cpuSnap() {
  const { processInfo } = await bcdp.send('SystemInfo.getProcessInfo');
  const by = {}; for (const p of processInfo) { const k = p.type === 'GPU' ? 'gpu' : p.type; by[k] = (by[k] || 0) + p.cpuTime; }
  return { t: Date.now(), by };
}
const cpuPct = (a, b) => Object.fromEntries(['renderer', 'gpu', 'browser'].map(k => [k, Math.round(((b.by[k] || 0) - (a.by[k] || 0)) / ((b.t - a.t) / 1000) * 100)]));

const PAGES = {};
for (const h of HTMLS || [{ name: '', html: HTML }]) { PAGES[h.name] = await openPage(h.html, h.name ? `[${h.name}] ` : ''); ({ p: page, cdp: pcdp } = PAGES[h.name]); await ev(() => { __nc.start(); __nc.menu.set('fps', 0); __nc.menu.set('pauseBlur', false); __nc.menu.open(); }); }
const usePage = async name => { ({ p: page, cdp: pcdp } = PAGES[name]); await ev(() => __nc.menu.close()); };
await usePage(Object.keys(PAGES)[0]);
const info = await ev(() => { return { gfx: __nc.gfx.backend ? __nc.gfx.backend() : null, gpuTimer: __nc.perf.gpuTimer(), ts: __nc.renderer.hasFeature('timestamp-query'), gpu: __nc.gpu.short, tier: __nc.menu.SET && __nc.menu.SET.tier }; });
console.log('page', info);
await sleep(4000);

// 戰場地點：路網節點（世界座標），去掉快速道路上的（高架上打不起來），照固定亂數挑 N 個彼此離 150 m 以上的
const locs = await ev(({ n, seed }) => {
  let s = seed; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const nodes = __nc.roads.nodes.filter(nd => nd.out.length >= 3 && !nd.out.some(o => o.e.kind === 'f'));
  const pick = [];
  for (let tries = 0; pick.length < n && tries < 20000; tries++) {
    const nd = nodes[Math.floor(rnd() * nodes.length)];
    if (pick.some(p => Math.hypot(p.x - nd.x, p.z - nd.z) < 150) && tries < 15000) continue;
    pick.push({ x: nd.x, z: nd.z, a: rnd() * Math.PI * 2, zn: nd.zn && nd.zn.id });
  }
  return pick;
}, { n: N, seed: +(process.env.SEED || 260) });
console.log('locs', locs.length);

// 場景型別：sk 純槍戰；cop 加三星（警車、步警、路障）；boom 加爆炸（每 1.6 秒一顆、燒車）；max 五星（直升機、SWAT、戰車）加爆炸
const KINDS = ['sk', 'cop', 'boom', 'max'];
const res = { url, info, battles: [], log };
const save = () => writeFileSync(OUT, JSON.stringify(res));

let prof = null;
if (PROFILE) { await pcdp.send('Profiler.enable'); await pcdp.send('Profiler.setSamplingInterval', { interval: 250 }); }

// AB='名字=JS;名字=JS'：每個地點把每種設定各打一場（順序每場輪換），同一頁交錯跑，機器負載的漂移兩邊一起吃
const AB = HTMLS ? HTMLS.map(h => ({ name: h.name, js: '', page: h.name })) : process.env.AB ? process.env.AB.split(';').map(x => { const k = x.indexOf('='); return { name: x.slice(0, k), js: x.slice(k + 1) }; }) : [{ name: '', js: '' }];
const jobs = [];
for (let i = START; i < Math.min(N, locs.length); i++) { const o = AB.map((_, j) => AB[(j + i) % AB.length]); for (const v of o) jobs.push([i, v]); }
for (const [i, V] of jobs) {
  const kind = KINDS[i % 4]; if (ONLY && !ONLY.includes(kind)) continue;
  const L = locs[i];
  if (V.page !== undefined) await usePage(V.page);
  if (PROFILE && V.page !== undefined) { await pcdp.send('Profiler.enable'); await pcdp.send('Profiler.setSamplingInterval', { interval: 250 }); }
  if (V.js) await ev(V.js);
  // 傳送、無敵、等平靜（沒有下載、沒有分幀載入、2 秒內沒有新編著色器或卡頓，最多 10 秒）
  const arrive = await ev(async ({ L }) => {
    const N = __nc, G = N.gta;
    G.squad.clear(); G.wanted.clear('reset'); G.god.on = true; G.fill();
    N.time(1320); N.weather('rain');
    const bx = L.x - Math.sin(L.a) * 16, bz = L.z - Math.cos(L.a) * 16;
    N.tp(bx, bz, L.a); N.camAt();
    const PF = N.perf.PF, s0 = PF.nst, t0 = performance.now(); let calm = t0, k = PF.n;
    while (performance.now() - t0 < 10000) {
      await new Promise(r => setTimeout(r, 200));
      const fr = PF.ring.slice(-Math.min(PF.n - k, 900)); k = PF.n;
      if (N.perf.busy() || fr.some(f => f.dp || f.stall)) calm = performance.now();
      if (performance.now() - calm > 2000) break;
    }
    return { ms: Math.round(performance.now() - t0), stalls: PF.nst - s0 };
  }, { L });
  const c0 = await cpuSnap();
  if (PROFILE) await pcdp.send('Profiler.start');
  const b = await ev(async ({ L, kind, SECS }) => {
    const N = __nc, G = N.gta, PF = N.perf.PF, k0 = PF.n, s0 = PF.nst;
    const fx = Math.sin(L.a), fz = Math.cos(L.a), sx = fz, sz = -fx;   // 前方（往幫派）與側向
    const guns = ['smg', 'rifle', 'pistol', 'shotgun'];
    let ng = 0, nm = 0;
    for (let j = 0; j < 7; j++) { const o = (j - 3) * 2.6; if (G.squad.spawn('gang', L.x + fx * 20 + sx * o, L.z + fz * 20 + sz * o, guns[j % 4])) ng++; }
    for (let j = 0; j < 6; j++) { const o = (j - 2.5) * 2.4; if (G.squad.spawn('merc', L.x - fx * 8 + sx * o, L.z - fz * 8 + sz * o, j % 2 ? 'rifle' : 'smg')) nm++; }
    if (kind === 'cop') G.wanted.set(3);
    if (kind === 'max') G.wanted.set(5);
    // 觀戰相機：戰場中心外 26 m、高 10 m，每秒繞 0.2 弧度
    const cx = L.x + fx * 6, cz = L.z + fz * 6, y0 = N.player.y || 0;
    let run = true, ang = L.a + Math.PI * .75, last = performance.now();
    const orb = () => { if (!run) return; const t = performance.now(); ang += (t - last) / 1000 * .2; last = t; N.camAt(cx + Math.sin(ang) * 26, y0 + 10, cz + Math.cos(ang) * 26, cx, y0 + 1.2, cz); requestAnimationFrame(orb); };
    orb();
    const t0 = performance.now(); let nb = 0, peak = { f: 0, cops: 0, units: 0 };
    while (true) {
      await new Promise(r => setTimeout(r, 250));
      const t = (performance.now() - t0) / 1000;
      if ((kind === 'boom' || kind === 'max') && t > nb * 1.6 + 2 && nb < 14) {
        nb++;
        const tg = G.squad.SQ.f.filter(f => f.on && f.state === 'act' && f.team === 'gang');
        const p = tg.length ? tg[nb % tg.length] : { x: cx, z: cz };
        G.blast(p.x + (Math.random() - .5) * 4, y0 + .5, p.z + (Math.random() - .5) * 4, 7, 120, 'npc');
      }
      const gang = G.squad.count('gang'), merc = G.squad.count('merc');
      peak.f = Math.max(peak.f, gang + merc); peak.cops = Math.max(peak.cops, G.wanted.W.cops.filter(c => c.on && c.state !== 'down').length); peak.units = Math.max(peak.units, G.wanted.W.units.length);
      if (gang === 0 && t > 8 || merc === 0 && t > 8 || t > SECS) break;
    }
    run = false;
    const dur = (performance.now() - t0) / 1000, gang = G.squad.count('gang'), merc = G.squad.count('merc');
    const fr = PF.ring.slice(-Math.min(PF.n - k0, 900));
    // 等最後幾幀的顯示卡讀回
    await new Promise(r => setTimeout(r, 120));
    const stalls = PF.stalls.filter(s => s.k > s0).map(s => ({ at: s.at, ms: +s.ms.toFixed(1), cpu: +s.cpu.toFixed(1), sub: +s.sub.toFixed(1), gpu: s.gpu == null ? null : +s.gpu.toFixed(2), dp: s.dp, dt: s.dt, dg: s.dg, tags: s.tags, calls: s.calls }));
    const F = fr.map(f => [+f.ms.toFixed(2), +f.cpu.toFixed(2), +f.sub.toFixed(2), f.gpu == null ? null : +f.gpu.toFixed(2), f.calls, f.tris, f.stall ? 1 : 0, f.dp || 0]);
    const mem = { tex: N.renderer.info.memory.textures, geo: N.renderer.info.memory.geometries, prog: N.renderer._pipelines ? N.renderer._pipelines.caches.size : 0, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null };
    G.squad.clear(); G.wanted.clear('reset'); N.camAt();
    return { dur: +dur.toFixed(1), ng, nm, left: { gang, merc }, bombs: nb, peak, F, stalls, mem };
  }, { L, kind, SECS });
  const c1 = await cpuSnap();
  if (PROFILE) {
    const { profile } = await pcdp.send('Profiler.stop');
    const byId = new Map(profile.nodes.map(n => [n.id, n])), self = (prof ||= { us: new Map(), frames: 0 });
    const parent = new Map(); for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
    const kf = n => `${n.callFrame.functionName || '(anon)'}:${n.callFrame.lineNumber}`;
    self.inc ||= new Map();
    profile.samples.forEach((id, k) => { const n = byId.get(id), key = kf(n), us = profile.timeDeltas[k] || 0; self.us.set(key, (self.us.get(key) || 0) + us);
      const seen = new Set(); let p = id; while (p != null) { const kk = kf(byId.get(p)); if (!seen.has(kk)) { seen.add(kk); self.inc.set(kk, (self.inc.get(kk) || 0) + us); } p = parent.get(p); } });
    self.frames += b.F.length;
  }
  const ms = b.F.map(f => f[0]).sort((x, y) => x - y), q = p => ms[Math.min(ms.length - 1, Math.floor(ms.length * p))] || 0;
  const g = b.F.map(f => f[3]).filter(x => x != null), avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const sum = { i, v: V.name, kind, loc: L, arrive, ...b, cpuPct: cpuPct(c0, c1), med: q(.5), p99: q(.99), max: ms.at(-1) || 0, fps: b.F.length / b.dur, gpu: avg(g), cpu: avg(b.F.map(f => f[1])), sub: avg(b.F.map(f => f[2])), calls: avg(b.F.map(f => f[4])) };
  if (V.page !== undefined) await ev(() => __nc.menu.open());
  res.battles.push(sum); save();
  console.log(`#${i}${V.name ? '/' + V.name : ''} ${kind} ${b.dur}s fr ${b.F.length} fps ${sum.fps.toFixed(0)} med ${sum.med} p99 ${sum.p99} max ${sum.max} cpu ${sum.cpu?.toFixed(1)} sub ${sum.sub?.toFixed(1)} gpu ${sum.gpu?.toFixed(2)} calls ${sum.calls?.toFixed(0)} stalls ${b.stalls.length} left ${b.left.gang}/${b.left.merc} peak ${JSON.stringify(b.peak)} cpu% ${JSON.stringify(sum.cpuPct)}`);
}
if (prof) {
  res.prof = [...prof.us].filter(([k]) => !/^\((idle|program|garbage)/.test(k) || k.startsWith('(garbage')).sort((a, b) => b[1] - a[1]).slice(0, 60).map(([k, v]) => [k, +(v / 1000 / prof.frames).toFixed(3)]);
  res.inc = [...prof.inc].filter(([k]) => !/^\((idle|program|root)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 120).map(([k, v]) => [k, +(v / 1000 / prof.frames).toFixed(3)]);
  console.log(res.prof.slice(0, 40).map(([k, v]) => `${String(v).padStart(7)} ${k}`).join('\n'));
  console.log('— inclusive —\n' + res.inc.slice(0, 80).map(([k, v]) => `${String(v).padStart(7)} ${k}`).join('\n'));
}
res.log = log; save();
console.log('errors', log.pageerrors.length, log.errors.length, log.pageerrors.slice(0, 3), log.errors.slice(0, 3));
await browser.close(); srv.close();
