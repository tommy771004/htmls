// ═══ 效能面板（?perf=1）與固定路線量測（__nc.perf.route）═══
// 每一幀記：幀間隔（相鄰兩次 loop 的 rAF 時間戳）、CPU 邏輯（loop 開始到 renderFrame 開始）、CPU 送出（renderFrame 本身，three 走場景圖與送指令）、
// 顯示卡時間（EXT_disjoint_timer_query_webgl2：Chrome 桌機的 Direct3D／OpenGL 後端有，Mac 的 Metal 後端多半沒有，沒有就顯示「—」）、draw call 與三角形數。
// 幀間隔超過 PERF_STALL 的記成卡頓：附上那段時間新編的著色器、新上傳的貼圖與幾何數，以及載入程式標的事件（26-glb.js 的 perfTag：模型解碼、建築組擺放…）。
// 無頭 Chrome 是軟體繪圖或拿不到真的顯示卡時間，數字要在玩家自己的 Chrome、實機顯示卡上量。
const PERF_STALL = 25, PERF_N = 900;
const PF = { on: new URLSearchParams(location.search).get('perf') === '1', ring: [], n: 0, stalls: [], cur: null, now0: 0, t0: 0, r0: 0, el: null, shown: 0,
  ext: null, gl: R.getContext(), q: [], last: null, snap: [0, 0, 0] };
// 顯示卡計時：同一時間只能有一個 TIME_ELAPSED 查詢，結果幾幀後才拿得到（逐幀輪詢），中間發生過 GPU_DISJOINT 的整批丟掉
function perfGpuBegin(f) {
  if (!PF.ext) return;
  const q = PF.gl.createQuery(); PF.gl.beginQuery(PF.ext.TIME_ELAPSED_EXT, q); PF.q.push([q, f]);
}
function perfGpuEnd() {
  if (!PF.ext) return;
  const gl = PF.gl; gl.endQuery(PF.ext.TIME_ELAPSED_EXT);
  const dis = gl.getParameter(PF.ext.GPU_DISJOINT_EXT);
  while (PF.q.length) {
    const [q, f] = PF.q[0];
    if (!dis && !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
    if (!dis) f.gpu = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6;
    gl.deleteQuery(q); PF.q.shift();
  }
}
function perfOn(on) {
  PF.on = on;
  if (on && PF.ext === null) PF.ext = PF.gl.getExtension('EXT_disjoint_timer_query_webgl2') || false;
  if (on && !PF.el) {
    PF.el = document.createElement('pre'); PF.el.id = 'perf';
    PF.el.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99;margin:0;padding:6px 8px;font:11px/1.45 ui-monospace,Menlo,monospace;color:#d8f0e8;background:rgba(6,10,12,.72);pointer-events:none;white-space:pre';
    document.body.appendChild(PF.el);
  }
  if (PF.el) PF.el.style.display = on ? '' : 'none';
}
const perfInfo = () => [R.info.programs ? R.info.programs.length : 0, R.info.memory.textures, R.info.memory.geometries];
// 99-main.js 的 loop 一開始：結束上一段（上一次 loop 到這一次之間，含兩幀之間跑的下載回呼），開新的一段
perfHook.f = (now) => {
  if (!PF.on) { perfTags.length = 0; return; }
  const f = PF.cur, info = perfInfo();
  if (f) {
    f.ms = now - PF.now0;
    f.dp = info[0] - PF.snap[0]; f.dt = info[1] - PF.snap[1]; f.dg = info[2] - PF.snap[2];
    if (perfTags.length) f.tags = perfTags.splice(0);
    PF.ring.push(f); PF.n++; if (PF.ring.length > PERF_N) PF.ring.shift();
    if (f.ms > PERF_STALL) { PF.stalls.push({ at: Math.round(now / 100) / 10, where: player.where, ...f }); if (PF.stalls.length > 200) PF.stalls.shift(); }
  }
  PF.snap = info; PF.now0 = now; PF.t0 = performance.now();
  PF.cur = { ms: 0, cpu: 0, sub: 0, gpu: null, calls: 0, tris: 0 };
};
perfHook.a = () => { if (!PF.on || !PF.cur) return; PF.r0 = performance.now(); PF.cur.cpu = PF.r0 - PF.t0; perfGpuBegin(PF.cur); };
perfHook.b = () => {
  if (!PF.on || !PF.cur) return;
  const f = PF.cur; perfGpuEnd();
  f.sub = performance.now() - PF.r0; f.calls = R.info.render.calls; f.tris = R.info.render.triangles;
  if (performance.now() - PF.shown > 500) { PF.shown = performance.now(); perfPanel(); }
};
const perfPct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const perfAvg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
// 一段幀的統計（面板用最近 120 幀，路線量測用整段取樣）
function perfStats(fr) {
  const ms = fr.map(f => f.ms), g = fr.filter(f => f.gpu != null).map(f => f.gpu);
  return { n: fr.length, fps: fr.length ? 1000 / perfAvg(ms) : 0, ms: perfAvg(ms), p95: perfPct(ms, .95), max: Math.max(0, ...ms), cpu: perfAvg(fr.map(f => f.cpu)), sub: perfAvg(fr.map(f => f.sub)),
    gpu: g.length ? perfAvg(g) : null, gpu95: g.length ? perfPct(g, .95) : null, calls: Math.round(perfAvg(fr.map(f => f.calls))), tris: Math.round(perfAvg(fr.map(f => f.tris))), stalls: fr.filter(f => f.ms > PERF_STALL).length };
}
const perfF1 = v => v == null ? '—' : v.toFixed(1);
const perfStall = s => `${s.at}s ${Math.round(s.ms)}ms 邏輯${perfF1(s.cpu)} 送出${perfF1(s.sub)}${s.dp ? ` 著色器+${s.dp}` : ''}${s.dt ? ` 貼圖+${s.dt}` : ''}${s.dg ? ` 幾何+${s.dg}` : ''}${s.tags ? ' ' + s.tags.map(([n, t]) => `${n} ${Math.round(t)}ms`).join('、') : ''}`;
function perfPanel() {
  const s = perfStats(PF.ring.slice(-120)), info = perfInfo();
  PF.el.textContent = [
    `${GPU.short} · ${GT().name} · ${rtScene.width}×${rtScene.height}（DPR ${DPR}、${Math.round(post.scale * 100)}%、MSAA ${rtScene.samples}）`,
    `幀 ${perfF1(s.ms)} ms（${Math.round(s.fps)} fps）p95 ${perfF1(s.p95)} 最長 ${perfF1(s.max)}`,
    `CPU 邏輯 ${perfF1(s.cpu)} · 送出 ${perfF1(s.sub)} · 顯示卡 ${PF.ext ? perfF1(s.gpu) : '—（沒有計時擴充）'}`,
    `draw call ${s.calls} · 三角形 ${(s.tris / 1e6).toFixed(2)} M`,
    `著色器 ${info[0]} · 貼圖 ${info[1]} · 幾何 ${info[2]} · 細節距離 ×${detailK().toFixed(2)}`,
    `卡頓（>${PERF_STALL} ms）共 ${PF.stalls.length} 次`, ...PF.stalls.slice(-4).map(perfStall),
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
    const s0 = PF.stalls.length, t0 = performance.now();
    if (go(N) === false) { out.push({ name, skip: '這個版本沒有' }); continue; }
    // 等平靜：沒有下載中的批次、沒有還在分幀做的載入工作（27-props.js 的 warmBusy）、2 秒內沒有新編著色器或卡頓
    let calm = performance.now();
    for (let k = PF.n; performance.now() - t0 < wait;) {
      await new Promise(r => setTimeout(r, 200));
      const fr = PF.ring.slice(-Math.min(PF.n - k, PERF_N)); k = PF.n;
      if (glbBatchFrac() !== null || warmBusy || fr.some(f => f.dp || f.ms > PERF_STALL)) calm = performance.now();
      if (performance.now() - calm > 2000) break;
    }
    const arrive = PF.stalls.slice(s0).map(perfStall), k0 = PF.n;
    await new Promise(r => setTimeout(r, sample));
    const st = perfStats(PF.ring.slice(-Math.min(PF.n - k0, PERF_N)));
    out.push({ name, settle: Math.round(performance.now() - t0 - sample), busy: warmBusy, arrive, ...st });
  }
  PERF_STOPS[0][1](N);   // 回到光環廣場（也從室內出來：tp 會 setWhere('out')）
  perfOn(was);
  return (perfApi.last = out);
}
const perfApi = { PF, busy: () => warmBusy, on: perfOn, stats: (n = 120) => perfStats(PF.ring.slice(-n)), stalls: () => PF.stalls.map(perfStall), route: perfRoute, last: null, gpuTimer: () => (PF.ext === null ? (PF.ext = PF.gl.getExtension('EXT_disjoint_timer_query_webgl2') || false) : PF.ext) ? true : false };
if (PF.on) perfOn(true);
