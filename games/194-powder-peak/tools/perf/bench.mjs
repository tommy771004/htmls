// POWDER PEAK 效能基準測試（真實 GPU；不打包，只量測給定的 HTML）。
//
// 用法：
//   node tools/perf/bench.mjs <html> [選項]
// 選項：
//   --scen=fps,mem          要跑的情境（fps：各解析度 bot 試玩幀時間；mem：長時間記憶體穩定度）
//   --sizes=1280x720@1,1920x1080@1.5,1920x1080@2   解析度@DPR 清單
//   --warm=8                fps 情境暖機秒數（不計入統計，但自動畫質的變化會記錄）
//   --secs=20               fps 情境量測秒數
//   --seed=7                地形種子
//   --q="pr=1&aa=0"         附加到網址的 query（main.js 支援的除錯參數）
//   --memmin=10             mem 情境模擬的遊戲分鐘數（simulate 切片 + 中間渲染）
//   --swiftshader           改用軟體繪圖（只驗流程，數字無意義）
//   --json=out.json         同時把完整結果寫成 JSON
//   --pre="js"              fps 情境載入後先執行的 JS（A/B 用，例如隱藏 HUD）
//   --quietmax=180          開跑前最多等幾秒讓機器安靜（沒有其他無頭 Chrome、整機 CPU < --cpuquiet%）
//   --cpuquiet=35           視為安靜的整機 CPU 使用率上限（iGPU 與 CPU 共用功耗 / 記憶體頻寬，CPU 忙時 GPU 會變慢）
//   --reps=1                每個解析度重複幾次（雜訊大時用 2～3）
//   --vsync                 不關 vsync / 幀率上限（headless 的 rAF 約 90～100 Hz）；看有幀率上限時的掉幀（>20ms 幀 %）
//                           註：曾試過在頁內把 rAF 對齊 60 Hz 格線模擬筆電螢幕，但 setTimeout 在這台機器上偶爾晚 100～200 ms，
//                           量到的都是模擬器本身的卡頓 → 拿掉了
// 需求：本機 Chrome（預設路徑見 tools/shot.mjs，可用環境變數 CHROME 覆寫），puppeteer-core。
import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';
import { execSync, exec } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { CHROME } from '../shot.mjs';
const GPU_ARGS = [`--use-angle=${process.platform === 'win32' ? 'd3d11' : process.platform === 'darwin' ? 'metal' : 'gl'}`, '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'];
const SW_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-frame-rate-limit'];

const argv = process.argv.slice(2);
const opt = (k, d) => {
  const a = argv.find((s) => s.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const html = argv.find((s) => !s.startsWith('--'));
if (!html) {
  console.error('usage: node tools/perf/bench.mjs <html> [--scen=fps,mem] [--sizes=WxH@DPR,...] [--warm=8] [--secs=20] [--seed=7] [--q=...] [--memmin=10] [--swiftshader] [--json=out.json]');
  process.exit(2);
}
const scen = opt('scen', 'fps,mem').split(',');
const sizes = opt('sizes', '1280x720@1,1920x1080@1,1920x1080@1.5,1920x1080@2')
  .split(',')
  .map((s) => {
    const m = s.match(/^(\d+)x(\d+)(?:@([\d.]+))?$/);
    if (!m) throw new Error('bad size ' + s);
    return { w: +m[1], h: +m[2], dpr: m[3] ? +m[3] : 1 };
  });
const warm = +opt('warm', 8);
const secs = +opt('secs', 20);
const seed = +opt('seed', 7);
const extraQ = opt('q', '');
const memMin = +opt('memmin', 10);
const sw = argv.includes('--swiftshader');
const vsync = argv.includes('--vsync'); // 不關 vsync / 幀率上限（headless 的 rAF 約 90～100 Hz）→ 看掉幀比例
const jsonOut = opt('json', null);
const preJs = opt('pre', '');

function url(query) {
  const base = /^(https?|file):/.test(html) ? html : pathToFileURL(resolve(html)).href;
  return base + (base.includes('?') ? '&' : '?') + query + (extraQ ? '&' + extraQ : '');
}

// 在頁面載入前掛上：每個 rAF 記錄 [時間, pixelRatio]；包住 terrain._buildChunk 量 chunk 建置時間
const RECORDER = () => {
  const B = (window.__bench = { t: [], pr: [], builds: [], gpu: [], hooked: false });
  const tick = (now) => {
    B.t.push(now);
    const g = window.__game && window.__game.game;
    B.pr.push(g ? g.pixelRatio : 0);
    if (g && !B.hooked && g.terrain && g.terrain._buildChunk) {
      B.hooked = true;
      // GPU 時間：EXT_disjoint_timer_query_webgl2 包住 renderer.render（含 shadow pass，不含 MSAA resolve / 合成）
      const gl = g.renderer.getContext();
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      if (ext) {
        const pending = [];
        const ren = g.renderer;
        const orr = ren.render.bind(ren);
        ren.render = (s, c) => {
          for (let k = pending.length - 1; k >= 0; k--) {
            const q = pending[k];
            if (gl.getQueryParameter(q.q, gl.QUERY_RESULT_AVAILABLE)) {
              if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) B.gpu.push([q.t, gl.getQueryParameter(q.q, gl.QUERY_RESULT) / 1e6]);
              gl.deleteQuery(q.q);
              pending.splice(k, 1);
            }
          }
          const q = pending.length < 8 ? gl.createQuery() : null;
          if (q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
          orr(s, c);
          if (q) {
            gl.endQuery(ext.TIME_ELAPSED_EXT);
            pending.push({ q, t: performance.now() });
          }
        };
      }
      const orig = g.terrain._buildChunk.bind(g.terrain);
      g.terrain._buildChunk = (i) => {
        const t0 = performance.now();
        const r = orig(i);
        B.builds.push([t0, performance.now() - t0]);
        return r;
      };
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];

async function runFps(browser, s) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.setViewport({ width: s.w, height: s.h, deviceScaleFactor: s.dpr });
  await page.evaluateOnNewDocument(RECORDER);
  await page.goto(url(`bot=1&seed=${seed}&mute=1`), { waitUntil: 'load' });
  if (preJs) await page.evaluate(preJs);
  await new Promise((r) => setTimeout(r, warm * 1000));
  const cpuP = cpuDuring(secs - 1);
  await new Promise((r) => setTimeout(r, secs * 1000));
  const cpu = await cpuP;
  const d = await page.evaluate(() => {
    const B = window.__bench;
    const g = window.__game;
    const r = g.rendererInfo();
    const cv = g.game.renderer.domElement;
    return { t: B.t, pr: B.pr, builds: B.builds, gpu: B.gpu, info: r, buf: [cv.width, cv.height], dist: g.stats().distance, aa: g.game.renderer.getContext().getContextAttributes().antialias, qlog: r.qualityLog || null };
  });
  await page.close();
  const t0 = d.t[0];
  const tWarm = t0 + warm * 1000;
  const dts = [];
  for (let i = 1; i < d.t.length; i++) if (d.t[i] >= tWarm) dts.push(d.t[i] - d.t[i - 1]);
  const sorted = [...dts].sort((a, b) => a - b);
  const total = dts.reduce((a, b) => a + b, 0);
  // 自動畫質變化軌跡（秒, pixelRatio）
  const trace = [];
  let last = null;
  for (let i = 0; i < d.t.length; i++) {
    if (d.pr[i] && d.pr[i] !== last) {
      trace.push([((d.t[i] - t0) / 1000).toFixed(1), +d.pr[i].toFixed(3)]);
      last = d.pr[i];
    }
  }
  const buildsMeasured = d.builds.filter((b) => b[0] >= tWarm).map((b) => b[1]);
  // 長幀是否與 chunk 建置同幀
  let hitchWithBuild = 0;
  let hitches = 0;
  for (let i = 1; i < d.t.length; i++) {
    if (d.t[i] < tWarm) continue;
    const dt = d.t[i] - d.t[i - 1];
    if (dt > 25) {
      hitches++;
      if (d.builds.some((b) => b[0] >= d.t[i - 1] && b[0] < d.t[i])) hitchWithBuild++;
    }
  }
  const gpu = d.gpu.filter((x) => x[0] >= tWarm).map((x) => x[1]).sort((a, b) => a - b);
  return {
    size: `${s.w}x${s.h}@${s.dpr}`,
    gpuAvg: gpu.length ? gpu.reduce((a, b) => a + b, 0) / gpu.length : NaN,
    gpuP95: gpu.length ? pct(gpu, 95) : NaN,
    frames: dts.length,
    fps: dts.length / (total / 1000),
    p50: pct(sorted, 50),
    p95: pct(sorted, 95),
    p99: pct(sorted, 99),
    max: sorted[sorted.length - 1],
    low1: 1000 / pct(sorted, 99),
    drop20: (100 * dts.filter((x) => x > 20).length) / Math.max(1, dts.length), // 超過 20 ms（60 Hz 下等於掉一幀以上）的幀比例 %
    hitches,
    hitchWithBuild,
    buildN: buildsMeasured.length,
    buildMax: buildsMeasured.length ? Math.max(...buildsMeasured) : 0,
    buildAvg: buildsMeasured.length ? buildsMeasured.reduce((a, b) => a + b, 0) / buildsMeasured.length : 0,
    prTrace: trace,
    buf: d.buf,
    aa: d.aa,
    calls: d.info.calls,
    tris: d.info.triangles,
    dist: d.dist,
    qlog: d.qlog,
    cpu,
    errors,
  };
}

async function runMem(browser) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.goto(url(`bot=1&seed=${seed}&mute=1`), { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 3000));
  const cdp = await page.createCDPSession();
  const slice = 15; // 遊戲秒 / 切片
  const n = Math.round((memMin * 60) / slice);
  const rows = [];
  for (let k = 0; k <= n; k++) {
    if (k > 0) {
      await page.evaluate((sec) => window.__game.simulate(sec, undefined, { fresh: false }), slice);
      await new Promise((r) => setTimeout(r, 400)); // 讓 renderer 真的畫幾幀（上傳新幾何、回收舊的）
    }
    if (k % Math.max(1, Math.round(n / 10)) === 0 || k === n) {
      await cdp.send('HeapProfiler.collectGarbage');
      const m = await page.metrics();
      const info = await page.evaluate(() => {
        const g = window.__game;
        const r = g.rendererInfo();
        let objs = 0;
        g.game.scene.traverse(() => objs++);
        return { geo: r.geometries, tex: r.textures, prog: r.programs, dist: g.stats().distance, objs, chunks: g.terrain.chunks ? g.terrain.chunks.size : -1 };
      });
      rows.push({ min: ((k * slice) / 60).toFixed(1), heapMB: (m.JSHeapUsedSize / 1048576).toFixed(1), nodes: m.Nodes, listeners: m.JSEventListeners, ...info });
    }
  }
  await page.close();
  return { rows, errors };
}

// 整機 CPU 使用率（%）：PowerShell Get-Counter（英文計數器路徑在中文 Windows 也可用）
const CPU_PS = (n) => `powershell -NoProfile -Command "(Get-Counter '\\Processor(_Total)\\% Processor Time' -SampleInterval 1 -MaxSamples ${n}).CounterSamples | Measure-Object CookedValue -Average | % Average"`;
function cpuNow() {
  try {
    const v = parseFloat(execSync(CPU_PS(2), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
    return Number.isFinite(v) ? v : 0;
  } catch (e) {
    return 0;
  }
}
// 量測期間背景取樣 CPU → Promise<平均%>
function cpuDuring(sec) {
  return new Promise((res) => {
    exec(CPU_PS(Math.max(1, Math.floor(sec))), { encoding: 'utf8' }, (err, out) => {
      const v = parseFloat(String(out || '').trim());
      res(Number.isFinite(v) ? v : NaN);
    });
  });
}
// 共用機器上其他 agent / 程式也可能在跑 GPU 測試 → 啟動前等到沒有其他無頭 Chrome（GPU 測試或吃 CPU 的 SwiftShader 截圖）（最多 --quietmax 秒）
const quietMax = +opt('quietmax', 180);
const cpuQuiet = +opt('cpuquiet', 35);
const reps = +opt('reps', 1);
function gpuBusy(exceptPid) {
  try {
    // wmic 固定欄寬輸出：CommandLine ... ProcessId（/format:csv 在中文語系會壞）
    const s = execSync(`wmic process where "name='chrome.exe'" get CommandLine,ProcessId`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const lines = s.split(/\r?\n/).map((l) => l.trim());
    return lines.filter((l) => l.includes('--headless') && !l.includes('--type=') && !(exceptPid && l.endsWith(' ' + exceptPid))).length;
  } catch (e) {
    return 0;
  }
}
async function waitQuiet(exceptPid) {
  if (sw) return 0;
  const t0 = Date.now();
  while ((gpuBusy(exceptPid) > 0 || cpuNow() > cpuQuiet) && Date.now() - t0 < quietMax * 1000) await new Promise((r) => setTimeout(r, 1000));
  return (Date.now() - t0) / 1000;
}
const waited = await waitQuiet();
if (waited > 1) console.error('waited for quiet GPU ' + waited.toFixed(0) + 's');
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: sw ? SW_ARGS : vsync ? GPU_ARGS.slice(0, 3) : GPU_ARGS });
const out = { html, q: extraQ, date: new Date().toISOString(), fps: [], mem: null };
try {
  if (scen.includes('fps')) {
    for (let rep = 0; rep < reps; rep++) {
      for (const s of sizes) {
        const myPid = browser.process() && browser.process().pid;
        await waitQuiet(myPid);
        const r = await runFps(browser, s);
        // 量測期間有其他 GPU 測試 / 整機 CPU 很忙 → 數字可能偏低
        r.contended = gpuBusy(myPid) > 0 || r.cpu > cpuQuiet + 15;
        out.fps.push(r);
        console.error(`done ${r.size} rep ${rep + 1}`);
      }
    }
    const f = (v, d = 1) => (typeof v === 'number' ? v.toFixed(d) : String(v));
    console.log(`\n## fps${vsync ? '（vsync 模式）' : ''}（bot，暖機 ${warm}s 後量 ${secs}s，seed ${seed}${extraQ ? '，q=' + extraQ : ''}；fps 後 * = 量測期間有其他無頭 Chrome 或整機 CPU 很忙）`);
    console.log('| 解析度 | 算繪緩衝 | AA | avg fps | p50 ms | p95 ms | p99 ms | max ms | 1% low fps | >20ms 幀 % | GPU avg / p95 ms | >25ms 幀 (同幀建 chunk) | chunk 建置 n / avg / max ms | calls | tris | pixelRatio 軌跡 (s,pr) | 整機 CPU % |');
    console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const r of out.fps) {
      console.log(
        `| ${r.size} | ${r.buf.join('x')} | ${r.aa ? 'on' : 'off'} | ${f(r.fps)}${r.contended ? "*" : ""} | ${f(r.p50, 2)} | ${f(r.p95, 2)} | ${f(r.p99, 2)} | ${f(r.max)} | ${f(r.low1)} | ${f(r.drop20)} | ${f(r.gpuAvg, 2)} / ${f(r.gpuP95, 2)} | ${r.hitches} (${r.hitchWithBuild}) | ${r.buildN} / ${f(r.buildAvg, 2)} / ${f(r.buildMax, 1)} | ${r.calls} | ${r.tris} | ${r.prTrace.map((p) => p.join(':')).join(' ')} | ${f(r.cpu, 0)} |`,
      );
      if (r.errors.length) console.log('  errors:', r.errors.slice(0, 5));
    }
  }
  if (scen.includes('mem')) {
    const m = (out.mem = await runMem(browser));
    console.log(`\n## mem（simulate 切片 15s + 渲染，共 ${memMin} 遊戲分鐘，1280x720）`);
    console.log('| 遊戲分鐘 | 距離 m | JS heap MB | geometries | textures | programs | scene 物件 | chunks | DOM nodes | listeners |');
    console.log('|---|---|---|---|---|---|---|---|---|---|');
    for (const r of m.rows) console.log(`| ${r.min} | ${r.dist.toFixed(0)} | ${r.heapMB} | ${r.geo} | ${r.tex} | ${r.prog} | ${r.objs} | ${r.chunks} | ${r.nodes} | ${r.listeners} |`);
    if (m.errors.length) console.log('  errors:', m.errors.slice(0, 5));
  }
} finally {
  await browser.close();
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(out, null, 2));
