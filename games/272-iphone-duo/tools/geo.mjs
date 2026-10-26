// 由 build/log.json 產生頁面用的幾何：最終設計每個稜柱的截面輪廓，以及每次失敗與修正後的局部剖面對照。
// 輸出 build/geo.json（build.mjs 內嵌進頁面）。
import fs from 'node:fs';
import { BUILD, bakedEnv } from '../src/parts.mjs';
import { frameT, shapeOf, stateAt, TOL } from '../src/check.mjs';
import { contour } from '../src/geom.mjs';
import { apply, inv, D2R } from '../src/kin.mjs';
import { FIXES } from '../src/fixes.mjs';
const focusOf = id => Object.values(FIXES).flat().find(f => f.id === id)?.focus;

const log = JSON.parse(fs.readFileSync(new URL('../build/log.json', import.meta.url), 'utf8'));
Object.assign(bakedEnv, log.env);
const r3 = v => +v.toFixed(3);
const lo = s => s.sdf0 ? (x, z) => s.sdf0(x, z) : (x, z) => s.sdf(x, z);

// ---------- 最終設計：每個不同形狀算一次輪廓 ----------
const memo = new Map();
function loopsOf(s) {
  if (memo.has(s)) return memo.get(s);
  let L;
  if (s.src) L = loopsOf(s.src).map(l => l.map(([x, z]) => [-x, z]).reverse());
  else if (s.poly) L = [s.poly(0.04)];
  else L = contour({ bb: s.bb, sdf: lo(s) }, 0.02);
  L = L.map(l => l.map(([x, z]) => [r3(x), r3(z)]));
  memo.set(s, L);
  return L;
}
const D = log.D, shapes = [], ids = new Map();
const parts = BUILD.map(([, make]) => {
  const p = make(D);
  return {
    id: p.id, zh: p.zh, en: p.en, group: p.group, mat: p.mat, est: p.est, dims: p.dims, note: p.note,
    press: p.press || null, gears: p.gears ? p.gears.map(g => ({ x: g.x, z: g.z, n: g.n, p: g.p, tip: g.tip })) : null,
    prisms: p.prisms.map(q => {
      const o = { y0: r3(q.y0), y1: r3(q.y1), f: q.frame, tag: q.tag || null };
      if (q.shapeAt) o.dyn = q.tag; // fold／free：頁面即時計算
      else {
        if (!ids.has(q.shape)) { ids.set(q.shape, shapes.length); shapes.push(loopsOf(q.shape)); }
        o.s = ids.get(q.shape);
      }
      return o;
    }),
  };
});
console.log('shapes', shapes.length, 'points', shapes.flat(2).length);

// ---------- 失敗處的局部剖面（修正前／後同一位置） ----------
const W = 2.2, RES = 0.02;
function sketch(Dx, upto, phi, y, cx, cz, press = 0) {
  const st = stateAt(Dx, phi, press), win = [cx - W, cx + W, cz - W, cz + W], layers = [];
  for (const [, make] of BUILD.slice(0, upto + 1)) {
    const p = make(Dx), loops = [];
    for (const q of p.prisms) {
      let y0 = q.y0, y1 = q.y1;
      if (p.press && q.tag === p.press.tag && press && p.press.dy) { y0 += p.press.dy; y1 += p.press.dy; }
      if (y < y0 || y > y1) continue;
      const s = shapeOf(q, st); if (!s) continue;
      const T = frameT(Dx, q, p, st), Ti = inv(T), b = s.bb;
      const c = [[b[0], b[2]], [b[1], b[2]], [b[0], b[3]], [b[1], b[3]]].map(([x, z]) => apply(T, x, z));
      if (Math.max(...c.map(v => v[0])) < win[0] || Math.min(...c.map(v => v[0])) > win[1] || Math.max(...c.map(v => v[1])) < win[2] || Math.min(...c.map(v => v[1])) > win[3]) continue;
      const f = lo(s);
      for (const l of contour({ bb: win, sdf: (x, z) => { const [u, v] = apply(Ti, x, z); return f(u, v); } }, RES)) loops.push(l.map(([x, z]) => [r3(x), r3(z)]));
    }
    if (loops.length) layers.push({ id: p.id, loops });
  }
  return { phi: r3(phi / D2R), y: r3(y), win: win.map(r3), layers };
}
// 每個修正：取上一階段失敗、這一階段改善最多（最好已解決）的那一對，在同一位置畫修正前／後
const sketches = [];
const keyOf = q => q.other; // 左右對稱的標籤（pl／pr）視為同一對
log.steps.forEach((step, i) => {
  step.stages.forEach((sg, k) => {
    if (!k) return;
    const prev = step.stages[k - 1], now = new Map();
    for (const q of sg.res.pairs) if (!now.has(keyOf(q))) now.set(keyOf(q), q); // pairs 已依 d 排序：留最差的
    let best = null;
    for (const q of prev.res.pairs) {
      if (q.d >= TOL || !q.at) continue;
      const focus = focusOf(sg.fix.id);
      if (focus && q.other !== focus) continue; // 修正有指定對象時只看那一對
      const n = now.get(keyOf(q)), after = n ? n.d : Infinity, moved = n && Math.abs(n.phi - q.phi) > 0.3;
      const gain = after - q.d + (moved ? 1e-3 : 0); // 最小值相同但換了角度：原處已讓開
      if (!best || gain > best.gain) best = { q, after, gain, afterPhi: n ? n.phi : null };
    }
    if (!best) return;
    const { q: p } = best, y = (p.y[0] + p.y[1]) / 2, phi = p.phi * D2R;
    sketches.push({
      step: step.id, stage: k, other: p.other, d: p.d, after: isFinite(best.after) ? best.after : null, afterPhi: best.afterPhi, at: p.at,
      before: sketch(prev.D, i, phi, y, p.at[0], p.at[1], p.press),
      afterSk: sketch(sg.D, i, phi, y, p.at[0], p.at[1], p.press),
    });
    console.log('sketch', step.id, k, p.other, p.d, '→', best.after);
  });
});

// 頁面不需要每階段的完整 D 與包絡
const steps = log.steps.map(s => ({ id: s.id, stages: s.stages.map(g => ({ fix: g.fix, res: g.res })) }));
fs.writeFileSync(new URL('../build/geo.json', import.meta.url), JSON.stringify({
  when: log.when, tol: log.tol, D: { plate: D.plate, fpc: D.fpc, slider: D.slider }, parts, shapes, steps, final: log.final, curves: log.curves, sketches,
}));
console.log('geo.json', (fs.statSync(new URL('../build/geo.json', import.meta.url)).size / 1024).toFixed(0), 'KB');
