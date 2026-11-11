// 探勘 GRF：列出人族職業資料夾、某職業的武器檔、盾牌資料夾與武器外觀表，決定轉檔對照。
// node tools/grf/survey.mjs <data.grf> [職業資料夾]
import { Grf } from './grf.mjs';

const [grfPath, job = '검사'] = process.argv.slice(2);
const g = new Grf(grfPath);
console.log('GRF version', g.version.toString(16), 'entries', g.entries.size);
const H = 'data\\sprite\\인간족\\';
const folders = new Map();
for (const n of g.list(H)) {
  const rest = n.slice(H.length).split('\\');
  if (rest.length > 1) folders.set(rest[0], (folders.get(rest[0]) ?? 0) + 1);
}
console.log('人族資料夾', [...folders].map(([k, v]) => `${k}(${v})`).join(' '));
console.log(`== ${job} 的 .spr`);
console.log(g.list(H + job + '\\').filter((n) => n.endsWith('.spr')).map((n) => n.split('\\').pop()).join(' '));
const S = 'data\\sprite\\방패\\';
const sf = new Map();
for (const n of g.list(S)) { const r = n.slice(S.length).split('\\'); sf.set(r[0], (sf.get(r[0]) ?? 0) + 1); }
console.log('盾牌資料夾', [...sf].map(([k, v]) => `${k}(${v})`).join(' '));
console.log(`== 盾牌 ${job}`, g.list(S + job + '\\').filter((n) => n.endsWith('.spr')).map((n) => n.split('\\').pop()).join(' '));
console.log('== weapontable / iteminfo', [...g.entries.values()].map((e) => e.name).filter((n) => /weapontable|iteminfo|jobname|shieldtable/i.test(n)).join('\n'));
let enc = 0;
for (const e of g.entries.values()) if (e.flags & 6) enc++;
console.log('加密項目', enc);
