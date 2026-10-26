// 完整重播：逐件放置 → 檢查 → 失敗就依 FIXES 修正再查；最後以最終設計全部重驗，
// 並記錄最小間隙對 φ 的曲線。輸出 build/log.json（頁面內嵌）與 build/report.txt。
import fs from 'node:fs';
import { BUILD, designV1, bakedEnv, envKeys } from '../src/parts.mjs';
import { checkPart, checkPair, TOL, PHI_STEPS } from '../src/check.mjs';
import { FIXES } from '../src/fixes.mjs';

const CACHE = new URL('./.envcache.json', import.meta.url);
try { Object.assign(bakedEnv, JSON.parse(fs.readFileSync(CACHE, 'utf8'))); } catch {}
const saveCache = () => fs.writeFileSync(CACHE, JSON.stringify({ ...bakedEnv, ...envKeys() }));

const deg = r => +(r * 180 / Math.PI).toFixed(2);
const snap = D => JSON.parse(JSON.stringify(D));
const brief = r => ({
  ok: r.ok,
  pairs: r.pairs.slice(0, 8).map(p => ({ other: p.other, ta: p.ta || null, tb: p.tb || null, d: +p.d.toFixed(4), phi: deg(p.phi), press: p.press || 0, at: p.at ? p.at.map(v => +v.toFixed(3)) : null, y: p.y ? p.y.map(v => +v.toFixed(2)) : null })),
  self: r.self.map(s => ({ ...s, R: s.R !== undefined ? +s.R.toFixed(4) : undefined, phi: s.phi !== undefined ? deg(s.phi) : undefined, err: s.err !== undefined ? +s.err.toFixed(5) : undefined, rest: s.rest !== undefined ? +s.rest.toFixed(4) : undefined, pressed: s.pressed !== undefined ? +s.pressed.toFixed(4) : undefined })),
});
const line = r => r.pairs.slice(0, 3).map(p => `${p.other} ${p.d.toFixed(3)}@${deg(p.phi)}°`).join(' | ');

const D = designV1(), applied = new Set(), steps = [];
const t0 = Date.now();
for (let i = 0; i < BUILD.length; i++) {
  const [id, make] = BUILD[i];
  const stages = [];
  let placed = BUILD.slice(0, i).map(([, m]) => m(D));
  let r = checkPart(D, make(D), placed);
  stages.push({ fix: null, D: snap(D), res: brief(r) });
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${id.padEnd(10)} ${line(r)}  (${((Date.now() - t0) / 60000).toFixed(1)} min)`);
  if (!r.ok) for (const f of FIXES[id] || []) {
    if (applied.has(f.id)) continue;
    f.apply(D); applied.add(f.id);
    placed = BUILD.slice(0, i).map(([, m]) => m(D));
    r = checkPart(D, make(D), placed);
    stages.push({ fix: { id: f.id, zh: f.zh, why: f.why, what: f.what }, D: snap(D), res: brief(r) });
    console.log(`  fix ${f.id}: ${r.ok ? 'OK' : 'FAIL'} ${line(r)}`);
    if (r.ok) break;
  }
  steps.push({ id, stages });
  saveCache();
  if (!r.ok) { console.log('STOP at', id); break; }
}

// 最終設計全部重驗（後面的修正可能改到前面的零件），並記錄每對活動件的最小間隙曲線
console.log('final verification…');
const parts = BUILD.map(([, m]) => m(D));
const final = [], curves = {};
for (let i = 0; i < parts.length; i++) {
  const r = checkPart(D, parts[i], parts.slice(0, i));
  final.push({ id: parts[i].id, ...brief(r) });
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${parts[i].id.padEnd(10)} ${line(r)}`);
}
// 曲線：只取會相對運動且 1 mm 內的零件對
const hinge = ['spine', 'frameL', 'frameR', 'sliderL', 'sliderR', 'sync', 'display', 'plates', 'fpc1'];
for (let i = 0; i < hinge.length; i++) for (let j = i + 1; j < hinge.length; j++) {
  const a = parts.find(p => p.id === hinge[i]), b = parts.find(p => p.id === hinge[j]);
  const ys = PHI_STEPS.map(phi => {
    const one = checkPair(D, a, b, [phi]);
    return one ? +one.d.toFixed(4) : null;
  });
  if (ys.some(v => v !== null && v < 1)) curves[`${a.id}|${b.id}`] = ys;
}
saveCache();
fs.mkdirSync(new URL('../build/', import.meta.url), { recursive: true });
const out = { when: new Date().toISOString().slice(0, 10), tol: TOL, steps, final, curves, env: envKeys(), D: snap(D) };
fs.writeFileSync(new URL('../build/log.json', import.meta.url), JSON.stringify(out));
console.log('done', ((Date.now() - t0) / 60000).toFixed(1), 'min; fails in final:', final.filter(f => !f.ok).map(f => f.id).join(',') || 'none');
