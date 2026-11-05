// ═══ 效能面板（?perf=1）與固定路線量測（__nc.perf.route）═══
// 每一幀記：幀間隔（相鄰兩次 loop 的 rAF 時間戳）、CPU 邏輯（loop 開始到 renderFrame 開始）、CPU 送出（renderFrame 本身，three 走場景圖與送指令）、
// draw call 與三角形數、顯示卡時間（?perf=1 時 00-core.js 開 trackTimestamp：每個 render pass 前後寫 timestamp query，perfGpu 每幀讀回；
// 讀回是非同步的，一次讀到的是上次讀回之後所有 pass 的總和，平均分給那幾幀。瀏覽器沒有 timestamp-query 時顯示「—」）。
// 顯示卡瓶頸時「送出」大半是繪圖呼叫在等顯示卡（指令緩衝滿了），不是 CPU 在做事：要分辨就看行程的 CPU 時間（tools/perf-mem.mjs）。
// 卡頓是比平常的幀長很多的那一幀：超過 PERF_STALL、也超過最近 PERF_MED 幀中位數的 PERF_K 倍（光環廣場本來就 31 ms 一幀，不能每幀都算卡頓），附上那段時間新編的著色器、新上傳的貼圖與幾何數，以及載入程式標的事件（26-glb.js 的 perfTag：模型解碼、建築組擺放…）。
// 無頭 Chrome 是軟體繪圖或拿不到真的顯示卡時間，數字要在玩家自己的 Chrome、實機顯示卡上量。
const PERF_STALL = 25, PERF_K = 1.8, PERF_MED = 60, PERF_N = 900;
const PF = { on: new URLSearchParams(location.search).get('perf') === '1', ring: [], n: 0, stalls: [], cur: null, now0: 0, t0: 0, r0: 0, el: null, shown: 0,
  last: null, snap: [0, 0, 0], lim: PERF_STALL, nst: 0, gq: null, gw: [] };
// 顯示卡計時：這幀畫完的 pass 記進 gw，沒有讀回在跑就開一次，讀回的毫秒數平均分給這段的幀（Chrome 的 timestamp 量化到 0.1 ms，平均後夠用）
const perfGpuOn = () => !!(R.backend && R.backend.trackTimestamp);
function perfGpu(f) {
  if (!perfGpuOn()) return;
  PF.gw.push(f);
  if (PF.gq) return;
  const fr = PF.gw; PF.gw = [];
  PF.gq = R.resolveTimestampsAsync('render').then(ms => { if (ms > 0) for (const x of fr) x.gpu = ms / fr.length; }, () => {}).finally(() => { PF.gq = null; });
}
function perfOn(on) {
  PF.on = on;
  if (on && !PF.el) {
    PF.el = document.createElement('pre'); PF.el.id = 'perf';
    PF.el.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99;margin:0;padding:6px 8px;font:11px/1.45 ui-monospace,Menlo,monospace;color:#d8f0e8;background:rgba(6,10,12,.72);pointer-events:none;white-space:pre';
    document.body.appendChild(PF.el);
  }
  if (PF.el) PF.el.style.display = on ? '' : 'none';
}
// 著色器數：WebGPURenderer 沒有 R.info.programs（原本一直是 0，新編著色器的卡頓都記不到），改數 three 的管線快取（每個是一條 render pipeline，新的就要編）
const perfInfo = () => [R._pipelines ? R._pipelines.caches.size : R.info.programs ? R.info.programs.length : 0, R.info.memory.textures, R.info.memory.geometries];
// 99-main.js 的 loop 一開始：結束上一段（上一次 loop 到這一次之間，含兩幀之間跑的下載回呼），開新的一段
perfHook.f = (now) => {
  if (!PF.on) { perfTags.length = 0; return; }
  const f = PF.cur, info = perfInfo();
  if (f) {
    f.ms = now - PF.now0;
    f.dp = info[0] - PF.snap[0]; f.dt = info[1] - PF.snap[1]; f.dg = info[2] - PF.snap[2];
    if (perfTags.length) f.tags = perfTags.splice(0);
    // 門檻用這一幀之前的中位數（自己不算進去）；換到重很多的地方，前 PERF_MED / 2 幀左右會記成卡頓，之後中位數跟上
    const med = PF.ring.length ? perfPct(PF.ring.slice(-PERF_MED).map(x => x.ms), .5) : 0;
    PF.lim = Math.max(PERF_STALL, med * PERF_K); f.stall = f.ms > PF.lim;
    PF.ring.push(f); PF.n++; if (PF.ring.length > PERF_N) PF.ring.shift();
    // k：遞增的序號（stalls 只留最近 200 筆，route() 照序號找抵達期間的卡頓，不能用陣列長度）
    if (f.stall) { PF.stalls.push({ k: ++PF.nst, at: Math.round(now / 100) / 10, where: player.where, ...f }); if (PF.stalls.length > 200) PF.stalls.shift(); }
  }
  PF.snap = info; PF.now0 = now; PF.t0 = performance.now();
  PF.cur = { ms: 0, cpu: 0, sub: 0, gpu: null, calls: 0, tris: 0 };
};
perfHook.a = () => { if (!PF.on || !PF.cur) return; PF.r0 = performance.now(); PF.cur.cpu = PF.r0 - PF.t0; };
perfHook.b = () => {
  if (!PF.on || !PF.cur) return;
  const f = PF.cur;
  f.sub = performance.now() - PF.r0; f.calls = R.info.render.drawCalls; f.tris = R.info.render.triangles;   // r186 的 render.calls 是開機以來累計，每幀的是 drawCalls
  perfGpu(f);
  if (performance.now() - PF.shown > 500) { PF.shown = performance.now(); perfPanel(); }
};
const perfPct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const perfAvg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
// 一段幀的統計（面板用最近 120 幀，路線量測用整段取樣）
function perfStats(fr) {
  const ms = fr.map(f => f.ms), g = fr.filter(f => f.gpu != null).map(f => f.gpu);
  return { n: fr.length, fps: fr.length ? 1000 / perfAvg(ms) : 0, ms: perfAvg(ms), p95: perfPct(ms, .95), max: Math.max(0, ...ms), cpu: perfAvg(fr.map(f => f.cpu)), sub: perfAvg(fr.map(f => f.sub)),
    gpu: g.length ? perfAvg(g) : null, gpu95: g.length ? perfPct(g, .95) : null, calls: Math.round(perfAvg(fr.map(f => f.calls))), tris: Math.round(perfAvg(fr.map(f => f.tris))), stalls: fr.filter(f => f.stall).length };
}
const perfF1 = v => v == null ? '—' : v.toFixed(1);
const perfStall = s => `${s.at}s ${Math.round(s.ms)}ms 邏輯${perfF1(s.cpu)} 送出${perfF1(s.sub)}${s.dp ? ` 著色器+${s.dp}` : ''}${s.dt ? ` 貼圖+${s.dt}` : ''}${s.dg ? ` 幾何+${s.dg}` : ''}${s.tags ? ' ' + s.tags.map(([n, t]) => `${n} ${Math.round(t)}ms`).join('、') : ''}`;
function perfPanel() {
  const s = perfStats(PF.ring.slice(-120)), info = perfInfo();
  PF.el.textContent = [
    `${GPU.short} · ${GT().name} · ${rtScene.width}×${rtScene.height}（DPR ${DPR}、${Math.round(post.scale * 100)}%、MSAA ${rtScene.samples}）`,
    `幀 ${perfF1(s.ms)} ms（${Math.round(s.fps)} fps）p95 ${perfF1(s.p95)} 最長 ${perfF1(s.max)}`,
    `CPU 邏輯 ${perfF1(s.cpu)} · 送出 ${perfF1(s.sub)} · 顯示卡 ${perfF1(s.gpu)}（p95 ${perfF1(s.gpu95)}）`,
    `draw call ${s.calls} · 三角形 ${(s.tris / 1e6).toFixed(2)} M`,
    `著色器 ${info[0]} · 貼圖 ${info[1]} · 幾何 ${info[2]} · 細節距離 ×${detailK().toFixed(2)}`,
    `卡頓（>${Math.round(PF.lim)} ms：至少 ${PERF_STALL}、最近幀中位數的 ${PERF_K} 倍）共 ${PF.nst} 次`, ...PF.stalls.slice(-4).map(perfStall),
  ].join('\n');
}
// ─── 固定路線：光環廣場（賭場塔樓）、機場（21-air.js 有才去）、北嶺公園、賭場大廳（室內）。每站傳送後等下載與編譯平靜下來（最多 wait），
// 抵達期間的卡頓另外記；再站著取樣 sample 毫秒。時間固定在晚上 10 點、下雨（遊戲的招牌場景）───
const PERF_STOPS = [
  ['光環廣場', N => { const F = FAC.casino, [x, z] = facW(F, 36, 60), [tx, tz] = facW(F, 36, 20); N.tp(x, z, Math.atan2(tx - x, tz - z)); }],
  ['機場', N => { const A = N.props && N.props.air; if (!A || !A.L || !A.W) return false; const T = A.L.term, [x, z] = A.W(T.x + 40, T.z + 160), [tx, tz] = A.W(T.x, T.z); N.tp(x, z, Math.atan2(tx - x, tz - z)); }],
  ['北嶺公園', N => { const P = NPARK.trail[200], a = parkW(P[0], P[1]), b = parkW(P[0], P[1] - 10); N.tp(a.x, a.z, Math.atan2(b.x - a.x, b.z - a.z)); }],
  ['賭場大廳', N => N.enter('casino')],
];
async function perfRoute({ wait = 12000, sample = 8000, min = 1320, weather = 'rain', stops } = {}) {
  const N = window.__nc, was = PF.on, out = [];
  perfOn(true); N.time(min); N.weather(weather);
  for (const [name, go] of PERF_STOPS) {
    if (stops && !stops.includes(name)) continue;
    const s0 = PF.nst, t0 = performance.now();
    if (go(N) === false) { out.push({ name, skip: '這個版本沒有' }); continue; }
    // 等平靜：沒有下載中的批次、沒有還在分幀做的載入工作（27-props.js 的 warmBusy）、2 秒內沒有新編著色器或卡頓（卡頓照上面的相對門檻，本來就慢的地方也等得到）
    let calm = performance.now();
    for (let k = PF.n; performance.now() - t0 < wait;) {
      await new Promise(r => setTimeout(r, 200));
      const fr = PF.ring.slice(-Math.min(PF.n - k, PERF_N)); k = PF.n;
      if (glbBatchFrac() !== null || warmBusy || fr.some(f => f.dp || f.stall)) calm = performance.now();
      if (performance.now() - calm > 2000) break;
    }
    const arrive = PF.stalls.filter(s => s.k > s0).map(perfStall), k0 = PF.n;
    await new Promise(r => setTimeout(r, sample));
    const st = perfStats(PF.ring.slice(-Math.min(PF.n - k0, PERF_N)));
    out.push({ name, settle: Math.round(performance.now() - t0 - sample), busy: warmBusy, arrive, ...st });
  }
  PERF_STOPS[0][1](N);   // 回到光環廣場（也從室內出來：tp 會 setWhere('out')）
  perfOn(was);
  return (perfApi.last = out);
}
// ─── 觀測模型（tools/observe.mjs）用的兩個量測，平常沒有成本 ───
// sample()：拆解下一幀（只包那一幀的 R.render／R.renderObject，由 renderFrame 頭尾的 perfHook.a／b 開關）。每一趟（主畫面、倒影、後製）記 CPU 時間、
// draw call、三角形，依材質名分組；白畫的 draw 分類：空實例、空幾何、drawRange 0、藏在地底、縮成 0、實例全死、整顆在視錐外、整顆在霧外、
// 主畫面投影不到半個像素（不透明的）。同幾何同材質分開畫的（可以實例化）、實例只有幾成在視錐裡的另外列
const PERF_WASTE = ['inst0', 'emptyGeo', 'range0', 'under', 'scale0', 'instDead', 'outside', 'instOutside', 'fogged', 'subpx'];
function perfWaste(o, g, m, p) {
  const n = g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0;
  if (o.isInstancedMesh && o.count === 0) return 'inst0';
  if (n === 0) return 'emptyGeo';
  if (g.drawRange.count === 0) return 'range0';
  const e = o.matrixWorld.elements;
  if (e[13] < -1000) return 'under';
  if (Math.abs(o.matrixWorld.determinant()) < 1e-12) return 'scale0';
  if (!p.fr || o === fsMesh) return null;
  if (g.boundingSphere === null) g.computeBoundingSphere();
  const s = g.boundingSphere, sp = new T.Sphere();
  if (o.isInstancedMesh) {
    const a = o.instanceMatrix.array, M = new T.Matrix4(); let live = 0, vis = 0;
    for (let i = 0, c = Math.min(o.count, 4000); i < c; i++) {
      const b = i * 16; if (a[b] * a[b] + a[b + 1] * a[b + 1] + a[b + 2] * a[b + 2] < 1e-10 || a[b + 13] < -1000) continue;
      live++; M.fromArray(a, b).premultiply(o.matrixWorld); sp.copy(s).applyMatrix4(M); if (p.fr.intersectsSphere(sp)) vis++;
    }
    p.inst.push([m.name || m.type, o.count, vis]);
    return live === 0 ? 'instDead' : vis === 0 ? 'instOutside' : null;
  }
  sp.copy(s).applyMatrix4(o.matrixWorld);
  if (!p.fr.intersectsSphere(sp)) return 'outside';
  const c = p.cam.position, d = sp.center.distanceTo(c);
  if (c.y < 20 && fogFull(m) && d - sp.radius > 12 / Math.max(U.uFogDen.value, 1e-4)) return 'fogged';
  if (p.nm === 'main' && d > sp.radius && sp.radius / d * p.k < .5 && !reflKeep(m)) return 'subpx';
  return null;
}
function perfSample() {
  return new Promise(res => {
    const pa = perfHook.a, pb = perfHook.b, r0 = R.render, ro0 = R.renderObject, passes = []; let cur = null;
    const M = new T.Matrix4();
    perfHook.a = () => {
      pa?.();
      R.render = function (s, c) {
        const nm = c === camera ? 'main' : c === reflCam ? 'refl' : s === fsScene ? 'post:' + (fsMesh.material.name || '?') : 'other:' + (s.name || c.name || c.type);
        const rt = R.getRenderTarget(), p = cur = { nm, cam: c, ms: 0, L: [], inst: [], fr: null, k: 1 };
        if (s !== fsScene && c.isPerspectiveCamera) { p.fr = new T.Frustum().setFromProjectionMatrix(M.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse), R.coordinateSystem); p.k = (rt ? rt.height : innerHeight) / 2 * c.projectionMatrix.elements[5]; }
        passes.push(p);
        const t = performance.now(); try { return r0.apply(this, arguments); } finally { p.ms = performance.now() - t; cur = null; }
      };
      R.renderObject = function (o, sc, c, g, m) { if (cur) cur.L.push([o, g, m]); return ro0.apply(this, arguments); };
    };
    perfHook.b = () => {
      R.render = r0; R.renderObject = ro0; perfHook.a = pa; perfHook.b = pb; pb?.();
      const out = [];
      for (const p of passes) {
        const by = new Map(), waste = {}, wex = {}, dup = new Map(); let tris = 0;
        for (const [o, g, m] of p.L) {
          const n = (g.drawRange.count !== Infinity ? Math.min(g.drawRange.count, g.index ? g.index.count : g.attributes.position?.count || 0) : g.index ? g.index.count : g.attributes.position?.count || 0) / 3 * (o.isInstancedMesh ? o.count : 1);
          tris += n;
          const mn = m.name || m.type, b = by.get(mn) || { d: 0, t: 0, w: 0 }; b.d++; b.t += n; by.set(mn, b);
          const w = perfWaste(o, g, m, p);
          if (w) { b.w++; waste[w] = (waste[w] || 0) + 1; const ex = (wex[w] ||= new Set()); if (ex.size < 8) ex.add(mn + ' ' + (o.name || o.parent?.name || '')); }
          if (!o.isInstancedMesh && !o.isSkinnedMesh) { const k = g.id + ':' + m.id; dup.set(k, (dup.get(k) || 0) + 1); }
        }
        const dupL = [...dup].filter(([, v]) => v > 1);
        out.push({ nm: p.nm, ms: +p.ms.toFixed(2), draws: p.L.length, tris: Math.round(tris), waste, wex: Object.fromEntries(Object.entries(wex).map(([k, v]) => [k, [...v]])),
          top: [...by].sort((a, b) => b[1].d - a[1].d).slice(0, 25).map(([k, v]) => [k, v.d, Math.round(v.t), v.w]),
          dupDraws: dupL.reduce((s, [, v]) => s + v, 0), dupSave: dupL.reduce((s, [, v]) => s + v - 1, 0),
          instLow: p.inst.filter(([, n, v]) => n >= 8 && v / n < .25).sort((a, b) => b[1] - a[1]).slice(0, 12) });
      }
      res(out);
    };
  });
}
// frozen(n, sets)：暫停（Esc 選單開著）時同一幀重畫，記 renderFrame 的 CPU 時間（送出）、整幀做完的時間（gpu：開始送出到顯示卡佇列做完）、draw call。
// sets 是要比的幾種設定（函式，null 是照現在）：n 輪，每輪每種先畫一幀丟掉（剛切換，可能建渲染目標或管線），再一口氣連畫 FROZEN_K 幀（偶數：倒影隔幀畫）
// 等顯示卡做完，總時間除以幀數——取各輪的中位數。交錯著量是因為無頭 Metal 的顯示卡時間整段飄 ±25%，前後分開量的差會被飄移蓋掉。
// 不一幀一幀「送出、等做完」：每幀之間顯示卡閒下來會降頻，前面剛好多做了事（例如 Esc 選單換設定）的那組就顯得快，
// 2026-11-01 觀測模型的拆解因此每一項都「省」2～5 ms（色差實際 ±0.5）。連畫時 gpu 是每幀的吞吐（CPU 送出與顯示卡重疊，取兩者中慢的），lat 是單幀從送出到做完。
// 回傳每種設定一筆（單位是「每幀」）。面板的統計這段時間暫停，免得兩邊搶 timestamp 讀回
const FROZEN_K = 8;
async function perfFrozen(n = 10, sets = [null]) {
  const was = PF.on; PF.on = false;
  while (PF.gq) await PF.gq;
  const S = sets.map(() => []);
  const one = async () => {
    const q = R.backend.device?.queue;
    if (q) await q.onSubmittedWorkDone();
    const f = await new Promise(r => requestAnimationFrame(() => { const t0 = performance.now(); renderFrame(0, (performance.now() - T0) / 1000); r([performance.now() - t0, R.info.render.drawCalls, R.info.render.triangles, t0]); }));
    // 顯示卡：送出後等佇列做完的牆鐘時間（前一幀已經等完，所以是這一幀從開始送到顯示卡畫完）。無頭 Metal 的 timestamp query 讀回的數字不可信
    // （畫面 60 fps 時讀到每幀 50 ms 以上、同一設定差到 ±25%），不用它
    let g = null; if (q) { await q.onSubmittedWorkDone(); g = performance.now() - f[3]; }
    return [f[0], f[1], f[2], g];
  };
  const burst = async () => {
    const q = R.backend.device?.queue;
    const f = await new Promise(r => requestAnimationFrame(() => {
      const t0 = performance.now(); let cpu = 0, dc = 0, tr = 0;
      for (let k = 0; k < FROZEN_K; k++) { const a = performance.now(); renderFrame(0, (a - T0) / 1000); cpu += performance.now() - a; dc += R.info.render.drawCalls; tr += R.info.render.triangles; }
      r([cpu / FROZEN_K, dc / FROZEN_K, tr / FROZEN_K, t0]);
    }));
    let g = null; if (q) { await q.onSubmittedWorkDone(); g = (performance.now() - f[3]) / FROZEN_K; }
    return [f[0], f[1], f[2], g];
  };
  try {
    for (let i = 0; i < n; i++) for (let j = 0; j < sets.length; j++) {
      sets[j]?.(); await one();
      const l = await one(), b = await burst();
      S[j].push([b[0], b[1], b[2], b[3], l[3]]);
    }
  } finally { PF.on = was; }
  return S.map(L => { const md = k => { const a = L.map(s => s[k]).filter(x => x != null && x > 0); return a.length ? +perfPct(a, .5).toFixed(3) : null; }; return { sub: md(0), draws: md(1), tris: md(2), gpu: md(3), lat: md(4), n: L.length }; });
}
const perfApi = { PF, busy: () => warmBusy, on: perfOn, stats: (n = 120) => perfStats(PF.ring.slice(-n)), stalls: () => PF.stalls.map(perfStall), route: perfRoute, last: null, gpuTimer: perfGpuOn, sample: perfSample, frozen: perfFrozen };
if (PF.on) perfOn(true);
