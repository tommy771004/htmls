// CPU／GPU 效能與記憶體回收量測：本機 HTTP 開頁（實車、建築組、道具都會下載），Metal 顯示卡、關掉 vsync 與幀率上限（幀時才是真的成本，不是 120 Hz 的上限）。
//   node tools/perf-mem.mjs            OUT=結果.json 另存原始數字；WAIT／SAMPLE 改每站等平靜與取樣的毫秒
// 量的東西：
//   1. 開頁載入期間每 250 ms 的各行程 RSS（峰值），開始畫面後的穩定值
//   2. 96-perf.js 的固定路線走兩趟（第一趟冷、第二趟熱）：每站幀時、CPU 邏輯／送出、顯示卡計時（有擴充才有）、draw call、三角形，
//      同一段時間 renderer 與 GPU 行程的 CPU 時間（CDP SystemInfo.getProcessInfo，不碰頁面的主執行緒）、RSS、R.info 的貼圖／幾何／著色器數
//   3. 光環廣場換內部解析度（50% / 100% / 125%）：幀時跟著解析度變是顯示卡瓶頸，不變是 CPU 瓶頸
//   4. 回收：室內場館進出、換車各幾輪看數量與 RSS 會不會一直長；最後 GC、再送記憶體壓力通知，分出「還沒回收」和「一直留著」
// 行程的 RSS 只算這次啟動的瀏覽器的行程；macOS 是統一記憶體，貼圖與頂點算在 GPU 行程，另外用 footprint 量 phys_footprint（含 IOSurface／Metal）。
// 機器在 swap 時 RSS 不算被壓縮或換出去的頁，沒做事也會忽高忽低；看會不會回收要看 footprint。
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { chromePath, GPU_ARGS } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(root, '../..');
const WAIT = +(process.env.WAIT || 30000), SAMPLE = +(process.env.SAMPLE || 8000), W = 1440, H = 900;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.png': 'image/png', '.jpg': 'image/jpeg', '.ktx2': 'image/ktx2' };
const srv = createServer((q, s) => {
  const f = resolve(repo, '.' + decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(repo + sep) || !existsSync(f) || !statSync(f).isFile()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${srv.address().port}/web/260-neon-nightcity.html?perf=1&gpu=high&civ=0&story=0`;

const browser = await chromium.launch({ headless: true, executablePath: chromePath(), args: [...GPU_ARGS, '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const bcdp = await browser.newBrowserCDPSession();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const log = { errors: [], pageerrors: [] };
page.on('pageerror', e => log.pageerrors.push(String(e.message || e)));
page.on('console', m => { if (m.type() === 'error') log.errors.push(m.text()); });
const pcdp = await ctx.newCDPSession(page);
const ev = (fn, arg) => page.evaluate(fn, arg);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MB = kb => Math.round(kb / 1024);

// ─── 行程取樣：CDP 給 PID、型別與 CPU 秒數，ps 給 RSS ───
async function procs() {
  const { processInfo } = await bcdp.send('SystemInfo.getProcessInfo');
  const pids = processInfo.map(p => p.id).filter(Boolean);
  const rss = {};
  if (pids.length) for (const l of execFileSync('ps', ['-o', 'pid=,rss=', '-p', pids.join(',')]).toString().trim().split('\n')) { const [p, r] = l.trim().split(/\s+/).map(Number); rss[p] = r; }
  const by = {};
  for (const p of processInfo) { const k = p.type === 'GPU' ? 'gpu' : p.type; const b = (by[k] ||= { cpu: 0, rss: 0, pids: [] }); b.cpu += p.cpuTime; b.rss += rss[p.id] || 0; b.pids.push(p.id); }
  const total = Object.values(by).reduce((a, b) => a + b.rss, 0);
  return { t: Date.now(), by, total };
}
const tl = [];   // 整段的時間軸
let polling = true;
const poller = (async () => { while (polling) { try { tl.push(await procs()); } catch (e) {} await sleep(250); } })();
const peakIn = (t0, t1) => { const s = tl.filter(x => x.t >= t0 && x.t <= t1); return s.length ? { total: MB(Math.max(...s.map(x => x.total))), renderer: MB(Math.max(...s.map(x => x.by.renderer?.rss || 0))), gpu: MB(Math.max(...s.map(x => x.by.gpu?.rss || 0))) } : null; };
const cpuIn = (t0, t1) => { const s = tl.filter(x => x.t >= t0 && x.t <= t1); if (s.length < 2) return null; const a = s[0], b = s.at(-1), dt = (b.t - a.t) / 1000;
  return Object.fromEntries(['renderer', 'gpu', 'browser'].map(k => [k, Math.round(((b.by[k]?.cpu || 0) - (a.by[k]?.cpu || 0)) / dt * 100)])); };   // 佔一顆核心的百分比
function footprint(pids) {
  try {
    const out = execFileSync('footprint', pids.flatMap(p => ['-p', String(p)]), { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    // 多個 PID 時最後會多一行 Summary Footprint（合計，扣掉共用的頁），有就用它，不要和每個行程的那行加在一起
    const u = { KB: 1 / 1024, MB: 1, GB: 1024 }, sm = out.match(/Summary Footprint:\s*([\d.]+)\s*(KB|MB|GB)/);
    if (sm) return Math.round(+sm[1] * u[sm[2]]);
    let sum = 0;
    for (const m of out.matchAll(/Footprint:\s*([\d.]+)\s*(KB|MB|GB)/g)) sum += +m[1] * u[m[2]];
    return Math.round(sum);
  } catch (e) { return null; }
}
async function mem(label) {
  const p = await procs();
  const heap = await pcdp.send('Runtime.getHeapUsage').catch(() => null);
  const info = await ev(() => { const R = window.__nc.renderer; return { tex: R.info.memory.textures, geo: R.info.memory.geometries, prog: R.info.programs ? R.info.programs.length : 0, where: window.__nc.player.where }; });
  const r = { label, ...info, rss: MB(p.total), rendererRss: MB(p.by.renderer?.rss || 0), gpuRss: MB(p.by.gpu?.rss || 0),
    fpRenderer: footprint(p.by.renderer?.pids || []), fpGpu: footprint(p.by.gpu?.pids || []), heap: heap ? MB(heap.usedSize / 1024) : null };
  console.log(`  [${label}] 貼圖 ${r.tex} 幾何 ${r.geo} 著色器 ${r.prog} · RSS 共 ${r.rss} MB（renderer ${r.rendererRss}、GPU ${r.gpuRss}）· footprint renderer ${r.fpRenderer} GPU ${r.fpGpu} MB · JS heap ${r.heap} MB`);
  return r;
}
const res = { url, chrome: browser.version(), load: null, passes: [], resScale: [], probes: {}, cpuCores: null };

// ─── 1. 載入 ───
const tLoad = Date.now();
await page.goto(url, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => window.__nc && window.__nc.ready, null, { timeout: 90000 });
const tReady = Date.now();
const gpuInfo = await ev(() => ({ tier: window.__nc.gpu?.tier, timer: window.__nc.perf.gpuTimer(), renderer: (() => { const gl = window.__nc.renderer.getContext(), d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : '?'; })() }));
console.log(`Chrome ${res.chrome} · ${gpuInfo.renderer} · 等級 ${gpuInfo.tier} · 顯示卡計時擴充 ${gpuInfo.timer ? '有' : '沒有'}`);
await ev(() => window.__nc.start());
await sleep(1500);
// 開場的下載（建築組、拉麵攤、座駕）做完：perf.busy() 歸零後再等 3 秒
for (const t0 = Date.now(); Date.now() - t0 < 60000;) { if (!(await ev(() => window.__nc.perf.busy()))) break; await sleep(500); }
await sleep(3000);
res.load = { readyMs: tReady - tLoad, peak: peakIn(tLoad, Date.now()), settled: await mem('開場平靜後') };
console.log(`載入：${res.load.readyMs} ms 到 ready，載入期間峰值 RSS ${res.load.peak.total} MB（renderer ${res.load.peak.renderer}、GPU ${res.load.peak.gpu}）`);

// ─── 2. 固定路線兩趟，一站一站跑，量同一段時間的行程 CPU 與 RSS ───
const STOPS = ['光環廣場', '機場', '北嶺公園', '賭場大廳'];
for (let pass = 1; pass <= 2; pass++) {
  console.log(`\n路線第 ${pass} 趟（每站最多等 ${WAIT} ms 平靜、取樣 ${SAMPLE} ms）`);
  const rows = [];
  for (const name of STOPS) {
    const t0 = Date.now();
    const [st] = await ev(o => window.__nc.perf.route(o), { stops: [name], wait: WAIT, sample: SAMPLE });
    const t1 = Date.now();
    if (st.skip) { console.log(`  ${name}：${st.skip}`); continue; }
    // 取樣窗：route 回傳前最後 SAMPLE 毫秒（之後那一下是傳回光環廣場）
    const s0 = t0 + st.settle, s1 = s0 + SAMPLE, cpu = cpuIn(s0, s1), pk = peakIn(s0, s1), info = await mem(`第${pass}趟 ${name}（已傳回光環廣場）`);
    const row = { name, settle: st.settle, calm: st.settle < WAIT, busy: st.busy, fps: +st.fps.toFixed(1), ms: +st.ms.toFixed(2), p95: +st.p95.toFixed(2), max: +st.max.toFixed(1), cpu: +st.cpu.toFixed(2), sub: +st.sub.toFixed(2),
      gpu: st.gpu == null ? null : +st.gpu.toFixed(2), calls: st.calls, tris: st.tris, stalls: st.stalls, arrive: st.arrive, procCpu: cpu, rssPeak: pk, after: info };
    rows.push(row);
    console.log(`  ${name}：${row.calm ? '平靜' : '沒等到平靜'} ${st.settle} ms · ${row.fps} fps 幀 ${row.ms} ms p95 ${row.p95} · 邏輯 ${row.cpu} 送出 ${row.sub} · 顯示卡 ${row.gpu ?? '—'} · draw ${row.calls} 三角 ${(row.tris / 1e6).toFixed(2)} M · 行程 CPU% renderer ${cpu?.renderer} GPU ${cpu?.gpu} · 取樣時 RSS ${pk?.total} MB · 抵達卡頓 ${st.arrive.length}`);
  }
  res.passes.push(rows);
}

// ─── 3. 解析度掃描（光環廣場）：幀時跟著畫素數變 → 顯示卡瓶頸 ───
console.log('\n解析度掃描（光環廣場）');
for (const s of [.5, 1, 1.25, '1080p']) {
  await ev(v => window.__nc.menu.set('res', v), s);
  await sleep(2500);
  await ev(() => { window.__nc.perf.PF.ring.length = 0; });
  const t0 = Date.now(); await sleep(5000);
  const st = await ev(() => window.__nc.perf.stats(900)), rt = await ev(() => window.__nc.menu.rt()), cpu = cpuIn(t0, Date.now());
  const row = { set: s, w: rt.w, h: rt.h, scale: rt.scale, fps: +st.fps.toFixed(1), ms: +st.ms.toFixed(2), cpu: +st.cpu.toFixed(2), sub: +st.sub.toFixed(2), gpu: st.gpu, procCpu: cpu };
  res.resScale.push(row);
  console.log(`  res=${s}：${rt.w}×${rt.h} · ${row.fps} fps 幀 ${row.ms} ms · 邏輯 ${row.cpu} 送出 ${row.sub}（CPU 合計 ${(row.cpu + row.sub).toFixed(2)}）· 行程 CPU% renderer ${cpu?.renderer} GPU ${cpu?.gpu}`);
}

// ─── 4. 回收 ───
console.log('\n回收：室內場館進出 ×4');
const home = () => ev(() => window.__nc.perf.route({ stops: ['光環廣場'], wait: 8000, sample: 500 }));
const venues = await ev(() => ['casino', 'bar', 'club', 'show', 'chrome', 'bank', 'bunker'].filter(k => { try { window.__nc.enter(k); return true; } catch (e) { return false; } }));
await home(); await sleep(2000);
res.probes.venue = [await mem('進出前')];
for (let i = 1; i <= 4; i++) {
  for (const v of venues) { await ev(k => window.__nc.enter(k), v); await sleep(3000); }
  await home(); await sleep(3000);
  res.probes.venue.push(await mem(`第 ${i} 輪（${venues.join('、')}）後回光環廣場`));
}

console.log('\n回收：換車 ×3 輪');
const carIds = await ev(() => Object.keys(window.__nc.cars).filter(id => !window.__nc.cars[id].bike && !window.__nc.cars[id].street && id !== 'ae86').slice(0, 8));
res.probes.cars = [await mem('換車前')];
for (let i = 1; i <= 3; i++) {
  for (const id of carIds) {
    await ev(id => window.__nc.applyCar(id), id);
    await page.waitForFunction(id => window.__nc.glb.loaded.includes(id) || window.__nc.glb.failed.includes(id), id, { timeout: 30000 }).catch(() => {});
    await sleep(1200);
  }
  await ev(() => window.__nc.applyCar('ae86')); await sleep(2000);
  res.probes.cars.push(await mem(`第 ${i} 輪換 ${carIds.length} 台後換回 AE86`));
}

console.log('\n回收：GC 與記憶體壓力');
await home(); await sleep(2000);
res.probes.gc = [await mem('GC 前')];
await pcdp.send('HeapProfiler.collectGarbage'); await sleep(3000);
res.probes.gc.push(await mem('HeapProfiler.collectGarbage 後'));
await pcdp.send('Memory.simulatePressureNotification', { level: 'critical' }).catch(e => console.log('  壓力通知失敗', e.message));
await sleep(5000);
res.probes.gc.push(await mem('critical 記憶體壓力通知 5 秒後'));
await sleep(10000);
res.probes.gc.push(await mem('再過 10 秒'));

polling = false; await poller;
res.errors = log.errors.slice(0, 20); res.pageerrors = log.pageerrors.slice(0, 20);
console.log(`\nconsole.error ${log.errors.length} 則、pageerror ${log.pageerrors.length} 則`);
for (const e of [...log.pageerrors, ...log.errors].slice(0, 8)) console.log('  ', e.slice(0, 200));
if (process.env.OUT) writeFileSync(resolve(process.env.OUT), JSON.stringify({ ...res, gpuInfo, timeline: tl.map(x => ({ t: x.t - tLoad, total: MB(x.total), renderer: MB(x.by.renderer?.rss || 0), gpu: MB(x.by.gpu?.rss || 0) })) }, null, 1));
await browser.close(); srv.close();
