// 逐件放置並檢查；失敗時套用 FIXES 中對應的修正後重查。最後全部重驗一次。
import { BUILD, designV1, bakedEnv, envKeys } from '../src/parts.mjs';
import fs from 'node:fs';
const CACHE = new URL('./.envcache.json', import.meta.url);
try { Object.assign(bakedEnv, JSON.parse(fs.readFileSync(CACHE, 'utf8'))); } catch {}
process.on('exit', () => { try { fs.writeFileSync(CACHE, JSON.stringify({ ...bakedEnv, ...envKeys() })); } catch {} });
import { checkPart } from '../src/check.mjs';
import { FIXES } from '../src/fixes.mjs';
const deg = r => (r * 180 / Math.PI).toFixed(1);
const D = designV1(), done = new Set(), log = [];
const only = process.argv[2] ? +process.argv[2] : BUILD.length;
const from = process.argv[3] ? +process.argv[3] : 0; // 之前的步驟只套修正、不重查（加速迭代）
for (let i = 0; i < from; i++) for (const f of FIXES[BUILD[i][0]] || []) { f.apply(D); done.add(f.id); }
const fmt = r => r.pairs.slice(0, 4).map(p => `${p.other}${p.ta ? '.' + p.ta : ''}${p.tb ? '/' + p.tb : ''} ${p.d.toFixed(3)}@${deg(p.phi)}°${p.press ? 'P' : ''}${p.at ? ' (' + p.at.map(v => v.toFixed(2)).join(',') + ')' : ''}`).join(' | ');
const selfs = r => r.self.filter(s => !s.ok).map(s => '✗ ' + s.what + (s.R !== undefined ? ` R=${s.R.toFixed(3)}` : '')).join('; ');
for (let i = from; i < only; i++) {
  const [id, make] = BUILD[i];
  const placed = BUILD.slice(0, i).map(([, m]) => m(D));
  let part = make(D), r = checkPart(D, part, placed);
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${id.padEnd(10)} ${fmt(r)} ${selfs(r)}`);
  const entry = { id, first: r.ok, fixes: [] };
  if (!r.ok && FIXES[id]) for (const f of FIXES[id]) {
    if (done.has(f.id)) continue;
    f.apply(D); done.add(f.id);
    const pl = BUILD.slice(0, i).map(([, m]) => m(D));
    part = make(D); r = checkPart(D, part, pl);
    console.log(`  fix ${f.id}: ${r.ok ? 'OK  ' : 'FAIL'} ${fmt(r)} ${selfs(r)}`);
    entry.fixes.push(f.id);
    if (r.ok) break;
  }
  log.push(entry);
  if (!r.ok) { console.log('STOP at', id); process.exit(1); }
}
