// battle.mjs 結果彙整：node tools/battlesum.mjs before.json [after.json]
// 無頭 Chrome 關掉 vsync 時 rAF 會把兩幀擠在一起（34 ms 接 0.5 ms），所以幀時用相鄰兩幀平均（ms2）看掉幀，卡頓（hitch）另外要求那一幀主執行緒或顯示卡真的花了時間。
import { readFileSync } from 'node:fs';
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
function sum(file, v) {
  const R = JSON.parse(readFileSync(file, 'utf8')), B = R.battles.filter(b => v === undefined || b.v === v);
  const rows = [], allHitch = [];
  for (const b of B) {
    const F = b.F, ms2 = []; for (let i = 1; i < F.length; i++) ms2.push((F[i][0] + F[i - 1][0]) / 2);
    const work = F.map(f => f[1] + f[2]), gpu = F.map(f => f[3]).filter(x => x != null);
    // 卡頓：幀間隔 > max(50 ms, 這場中位數 × 1.8)，且主執行緒或顯示卡真的花了那幀的三分之二以上（排除 rAF 擠在一起的假卡頓）
    const hitches = [];
    const medW = pct(F.map(f => f[0]), .5), lim = Math.max(50, medW * 1.8);   // 和 96-perf.js 的卡頓同一套：比這場的中位數長 1.8 倍以上
    F.forEach((f, i) => { if (f[0] > lim && (f[1] + f[2] > lim * .66 || (f[3] || 0) > lim * .66)) hitches.push({ i, t: +(i / F.length * b.dur).toFixed(1), ms: f[0], cpu: f[1], sub: f[2], gpu: f[3], dp: f[7] }); });
    const st = b.stalls || [];
    for (const h of hitches) { const s = st.find(x => Math.abs(x.ms - h.ms) < .2); h.dt = s?.dt || 0; h.dg = s?.dg || 0; h.tags = s?.tags; allHitch.push({ ...h, kind: b.kind, i: b.i }); }
    rows.push({ i: b.i, kind: b.kind, dur: b.dur, n: F.length, fps: F.length / b.dur, low1: 1000 / pct(ms2, .99), med: pct(F.map(f => f[0]), .5), p99_2: pct(ms2, .99), work: avg(work), cpu: avg(F.map(f => f[1])), sub: avg(F.map(f => f[2])), gpu: avg(gpu), gpu95: pct(gpu, .95), calls: avg(F.map(f => f[4])), tris: avg(F.map(f => f[5])), hitch: hitches.length, worst: Math.max(...F.map(f => f[0])), rcpu: b.cpuPct?.renderer, gcpu: b.cpuPct?.gpu, mem: b.mem });
  }
  return { R, rows, allHitch };
}
const f1 = v => v == null || Number.isNaN(v) ? '—' : v.toFixed(1);
function report(name, S) {
  const { rows, allHitch } = S;
  console.log(`\n=== ${name}：${rows.length} 場 ===`);
  const by = {}; for (const r of rows) (by[r.kind] ||= []).push(r); by.all = rows;
  console.log('型別    場  平均fps  1%low  幀中位ms  CPU邏輯  送出  顯示卡  顯示卡p95  drawcall  三角形M  卡頓/場  最長ms  renderer%  GPU行程%');
  for (const [k, a] of Object.entries(by)) console.log(`${k.padEnd(6)} ${String(a.length).padStart(3)}  ${f1(avg(a.map(r => r.fps))).padStart(6)}  ${f1(avg(a.map(r => r.low1))).padStart(5)}  ${f1(avg(a.map(r => r.med))).padStart(7)}  ${f1(avg(a.map(r => r.cpu))).padStart(6)}  ${f1(avg(a.map(r => r.sub))).padStart(5)}  ${f1(avg(a.map(r => r.gpu))).padStart(5)}  ${f1(avg(a.map(r => r.gpu95))).padStart(7)}  ${String(Math.round(avg(a.map(r => r.calls)))).padStart(7)}  ${(avg(a.map(r => r.tris)) / 1e6).toFixed(2).padStart(6)}  ${f1(avg(a.map(r => r.hitch))).padStart(6)}  ${f1(Math.max(...a.map(r => r.worst))).padStart(7)}  ${String(Math.round(avg(a.map(r => r.rcpu || 0)))).padStart(7)}  ${String(Math.round(avg(a.map(r => r.gcpu || 0)))).padStart(7)}`);
  // 卡頓的成因
  const cls = h => h.dp ? '新編著色器' : h.dg > 5 || h.dt > 2 ? '上傳幾何／貼圖' : (h.gpu || 0) > h.cpu + h.sub ? '顯示卡' : h.cpu > h.sub ? 'CPU 邏輯' : 'CPU 送出';
  const c = {}; for (const h of allHitch) c[cls(h)] = (c[cls(h)] || 0) + 1;
  const early = allHitch.filter(h => h.t < 1.5).length;
  console.log(`卡頓共 ${allHitch.length} 次（開打 1.5 秒內 ${early} 次）：`, c);
  const worst = [...allHitch].sort((a, b) => b.ms - a.ms).slice(0, 8);
  for (const h of worst) console.log(`  #${h.i} ${h.kind} t=${h.t}s ${f1(h.ms)}ms 邏輯${f1(h.cpu)} 送出${f1(h.sub)} 顯示卡${f1(h.gpu)} 著色器+${h.dp} 貼圖+${h.dt} 幾何+${h.dg} ${h.tags ? JSON.stringify(h.tags) : ''}`);
  const fpsS = rows.map(r => r.fps).sort((a, b) => a - b);
  console.log(`最差 5 場 fps：${rows.slice().sort((a, b) => a.fps - b.fps).slice(0, 5).map(r => `#${r.i}${r.kind} ${f1(r.fps)}（1%low ${f1(r.low1)}、${Math.round(r.calls)} draw）`).join('、')}`);
  const m0 = rows[0]?.mem, m1 = rows.at(-1)?.mem; console.log('記憶體（第一場 → 最後一場）', JSON.stringify(m0), '→', JSON.stringify(m1));
  console.log('頁面錯誤', S.R.log?.pageerrors?.length, 'console.error', S.R.log?.errors?.length);
}
function compare(A, Bs, la, lb) {
  const m = new Map(A.rows.map(r => [r.i, r])), pr = Bs.rows.filter(r => m.has(r.i)).map(r => [m.get(r.i), r]);
  const d = k => avg(pr.map(([a, b]) => (b[k] - a[k]) / a[k] * 100));
  console.log(`\n配對 ${pr.length} 場，${lb} 相對 ${la}：fps ${f1(d('fps'))}%、1%low ${f1(d('low1'))}%、CPU 送出 ${f1(d('sub'))}%、主執行緒工作 ${f1(d('work'))}%、顯示卡 ${f1(d('gpu'))}%、draw call ${f1(d('calls'))}%、卡頓 ${f1(avg(pr.map(([a]) => a.hitch)))} → ${f1(avg(pr.map(([, b]) => b.hitch)))} 次/場`);
  console.log(`fps 變高的場數 ${pr.filter(([a, b]) => b.fps > a.fps).length}/${pr.length}`);
}
const file = process.argv[2], raw = JSON.parse(readFileSync(file, 'utf8')), vs = [...new Set(raw.battles.map(b => b.v || ''))];
if (vs.length > 1) { const S = vs.map(v => sum(file, v)); vs.forEach((v, k) => report(`${file} [${v}]`, S[k])); for (let k = 1; k < vs.length; k++) compare(S[0], S[k], vs[0], vs[k]); }
else {
  const A = sum(file); report(file, A);
  if (process.argv[3]) { const Bs = sum(process.argv[3]); report(process.argv[3], Bs); compare(A, Bs, 'before', 'after'); }
}
