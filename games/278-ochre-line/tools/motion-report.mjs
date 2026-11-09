// 動作探針報告：node tools/motion-report.mjs <dir>/probe.json。列卡頓、相機／第一人稱槍／士兵骨頭的單幀跳動（>門檻且 >附近中位數數倍），附當時的片段與混合比例
import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync(process.argv[2])), F = d.f, M = d.marks;
const seg = t => { let n = '?'; for (const [mt, mn] of M) if (mt <= t) n = mn; return n; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const med = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1] ?? 0; };
// 幀間隔
const dts = F.slice(1).map((f, i) => f.t - F[i].t), mdt = med(dts);
const hitch = dts.map((x, i) => [x, i + 1]).filter(([x]) => x > Math.max(25, mdt * 3));
console.log(`幀數 ${F.length} 中位幀距 ${mdt.toFixed(2)} ms；卡頓（>${Math.max(25, mdt * 3).toFixed(0)} ms）${hitch.length} 次`, hitch.slice(0, 12).map(([x, i]) => `${seg(F[i].t)}@${(F[i].t / 1000).toFixed(2)}s:${x.toFixed(0)}ms`).join(' '));
// 通用跳動偵測：每幀位移 / 前後 8 幀位移中位數
function pops(series, label, absMin, k = 5) {
  const out = [];
  for (let i = 1; i < series.length; i++) {
    const [t, p, q, meta] = series[i], [t0, p0] = series[i - 1]; if (!p || !p0) continue;
    const dd = dist(p, p0) / Math.max(1, (t - t0) / mdt);   // 掉幀時按時間攤平
    const win = []; for (let j = Math.max(1, i - 8); j < Math.min(series.length, i + 9); j++) if (j !== i && series[j][1] && series[j - 1][1]) win.push(dist(series[j][1], series[j - 1][1]));
    const m = med(win);
    if (dd > absMin && dd > k * Math.max(m, absMin / 4)) out.push({ t, seg: seg(t), dd: +dd.toFixed(4), m: +m.toFixed(4), meta });
  }
  console.log(`\n== ${label}：${out.length} 處`); for (const o of out.slice(0, 40)) console.log(`  ${(o.t / 1000).toFixed(3)}s [${o.seg}] 單幀 ${o.dd} m（附近中位 ${o.m}）${o.meta ?? ''}`);
  return out;
}
pops(F.map(f => [f.t, f.cp]), '相機位置', 0.05);
pops(F.map(f => [f.t, [f.cr[0], f.cr[1], 0]]), '相機角度（rad）', 0.03);
pops(F.map((f, i) => [f.t, f.vm?.[0] ?? null, null, f.vmId !== F[i - 1]?.vmId ? `換槍 ${F[i - 1]?.vmId}→${f.vmId}` : f.vmId]), '第一人稱槍（視空間 mesh0）', 0.006);
pops(F.map((f, i) => [f.t, f.vm?.[1] ?? null, null, f.vmId]), '第一人稱 mesh1', 0.006);
// 士兵骨頭
const names = new Set(); for (const f of F) for (const s of f.s) names.add(s.n);
const BN = d.bn.map(x => x.split(':')[0]); let tot = [];
for (const n of names) for (let b = 0; b < BN.length; b++) {
  const ser = F.map((f, i) => { const s = f.s.find(x => x.n === n); const pv = F[i - 1]?.s.find(x => x.n === n); return [f.t, s?.b[b] ?? null, null, s ? `${s.a ? '' : '死 '}${s.cA}${s.bl < 1 ? '→' + s.cB + ' ' + s.bl : ''}${pv && (pv.cA !== s.cA || pv.cB !== s.cB) ? ' ＊切換' : ''}` : '']; });
  // 去掉指派／回合重置（整個人瞬移）：骨盆同時跳超過 1.5 m 視為瞬移
  const o = []; const so = console.log; console.log = () => {}; const r = pops(ser, '', 0.08, 6); console.log = so;
  for (const x of r) if (x.dd < 1.5) tot.push({ n, bone: BN[b], ...x });
}
tot.sort((a, b) => a.t - b.t);
console.log(`\n== 士兵骨頭單幀跳動（>8 cm 且 >6× 附近）：${tot.length} 處`);
const bySeg = {}; for (const x of tot) { const k = `${x.n}@${(x.t / 1000).toFixed(2)}`; (bySeg[k] ??= []).push(`${x.bone} ${x.dd}`); bySeg[k].meta = x.meta; bySeg[k].seg = x.seg; }
for (const [k, v] of Object.entries(bySeg).slice(0, 60)) console.log(`  ${k}s [${v.seg}] ${v.join(', ')} | ${v.meta}`);
