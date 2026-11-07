// dist/balance.json → dist/balance.md。node tools/balance-report.mjs dist/balance.json [dist/bal-base.json 改動前] [dist/bots-*.json ...]
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { GAME_DIR } from './lib/serve.mjs';

const [mainF, baseF, ...botF] = process.argv.slice(2), load = f => JSON.parse(readFileSync(resolve(GAME_DIR, f), 'utf8'));
const J = load(mainF), Base = baseF && baseF !== '-' ? load(baseF) : null, R = J.range.row, lane = J.range.lane;
const js = (await build({ stdin: { contents: "export { WEAPONS, RULES } from './src/game/state.js';", resolveDir: GAME_DIR }, bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'error' })).outputFiles[0].text;
const { WEAPONS: W } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const GUNS = Object.keys(R), D = [3, 6, 10, 15, 25, 40].filter(d => d <= lane.L - 2);
/** 擊殺時間 ms：平均發數換算，再除以彈匣內打得死的比例（打不死的情況等於要多花一倍以上時間）。 */
const ttk = (id, tag, d, row = R) => { const c = row[id]?.[`${tag}@${d}`]; if (!c || !c.mean || !c.kill) return null; return ((c.mean - 1) * 60 / W[id].rpm * 1000) / c.kill; };
const fmt = t => (t == null ? '—' : t.toFixed(0));
const pct = v => `${(v * 100).toFixed(0)}%`;
const md = ['# 武器平衡實算（dist/balance.md）', '', '由 `tools/balance.mjs`（量測）與 `tools/balance-report.mjs`（出表）產生。', '',
  `量測：在無頭遊戲裡走真正的 \`fire()\`、\`shootOne()\`、\`damage()\`，打站著的 Bot 骨架膠囊，每格 ${J.trials} 次。空巷長 ${lane.L} m，所以表到 ${D[D.length - 1]} m。瞄胸口（y+1.3）或頭膠囊中心，玩家站定不動。擊殺時間 =（平均發數 − 1）× 60/rpm ÷ 彈匣內打得死的比例，完全壓住後座；不含反應與瞄準時間。狙擊槍是開鏡狀態。`, ''];
md.push('## 武器數值', '', '| 武器 | 價 | 彈匣/備彈 | rpm | 傷害身/頭 | 彈丸 | 穿甲 | 散布 rad | 移速 | 換彈 s |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
for (const id of GUNS) { const w = W[id]; md.push(`| ${id} | ${w.price} | ${w.mag}/${w.rsv} | ${w.rpm} | ${w.dmg}/${w.head} | ${w.pellets ?? 1} | ${w.pen} | ${w.spread} | ${w.speedK} | ${w.reload} |`); }
for (const [tag, title] of [['armor', '有甲（防彈衣＋頭盔）瞄胸口'], ['bare', '無甲瞄胸口'], ['headA', '有甲瞄頭'], ['head', '無甲瞄頭']]) {
  md.push('', `## 擊殺時間 ms：${title}`, '', `| 武器 | ${D.map(d => d + ' m').join(' | ')} |`, `| --- | ${D.map(() => '---:').join(' | ')} |`);
  for (const id of GUNS) if (id !== 'knife') md.push(`| ${id} | ${D.map(d => fmt(ttk(id, tag, d))).join(' | ')} |`);
}
md.push('', `K2 戰鬥刀只有 1.5 m 這格：無甲 ${fmt(ttk('knife', 'bare', 1.5))} ms、有甲 ${fmt(ttk('knife', 'armor', 1.5))} ms。`);
md.push('', '## 不壓槍（有甲瞄胸口，後座照表走）', '', `| 武器 | ${D.map(d => d + ' m').join(' | ')} |`, `| --- | ${D.map(() => '---:').join(' | ')} |`);
for (const id of GUNS) if (id !== 'knife' && (W[id].auto || id === 'x10')) md.push(`| ${id} | ${D.map(d => fmt(ttk(id, 'spray', d))).join(' | ')} |`);
md.push('', '## S8 與 X10', '', '| 項目 | 3 m | 6 m | 10 m | 15 m | 25 m |', '| --- | ---: | ---: | ---: | ---: | ---: |');
const rowOf = (label, id, tag, row) => md.push(`| ${label} | ${[3, 6, 10, 15, 25].map(d => fmt(ttk(id, tag, d, row))).join(' | ')} |`);
const oneOf = (label, id, tag, row) => md.push(`| ${label} | ${[3, 6, 10, 15, 25].map(d => { const c = row[id]?.[`${tag}@${d}`]; return c ? pct(c.one) : '—'; }).join(' | ')} |`);
if (Base) { rowOf('改動前 S8 有甲 ms', 's8', 'armor', Base.range.row); rowOf('改動前 X10 有甲 ms', 'x10', 'armor', Base.range.row); oneOf('改動前 S8 有甲一槍倒', 's8', 'armor', Base.range.row); }
rowOf('現在 S8 有甲 ms', 's8', 'armor', R); rowOf('現在 X10 有甲 ms', 'x10', 'armor', R); oneOf('現在 S8 有甲一槍倒', 's8', 'armor', R); oneOf('現在 X10 有甲一槍倒', 'x10', 'armor', R); oneOf('現在 S8 無甲一槍倒', 's8', 'bare', R); oneOf('現在 X10 無甲一槍倒', 'x10', 'bare', R);
md.push('', `S8 $${W.s8.price}、移速 ${W.s8.speedK}、整匣換彈 ${W.s8.reload} s：近距離一發定生死，打偏等 ${(60 / W.s8.rpm).toFixed(2)} s。X10 $${W.x10.price}、移速 ${W.x10.speedK}、單發裝填 ${W.x10.shell} s 可中斷：穿甲一定要兩發以上，${(60 / W.x10.rpm).toFixed(2)} s 一發，連開有後座。`);
// 取代檢查
const K = []; for (const tag of ['armor', 'bare', 'head', 'headA']) for (const d of D) K.push([tag, d]);
const beats = (b, a) => { const A = W[a], B = W[b]; if (!(B.price <= A.price && B.speedK >= A.speedK && B.mag >= A.mag)) return false; return K.every(([t, d]) => { const x = ttk(a, t, d), y = ttk(b, t, d); return x == null || (y != null && y <= x + 1); }); };
const bad = []; for (const a of GUNS) for (const b of GUNS) if (a !== b && beats(b, a)) bad.push(`${a} 被 ${b} 取代`);
md.push('', '## 完全取代檢查', '', `定義：B 的價格 ≤ A、移速 ≥ A、彈匣 ≥ A，而且表上每一格（有甲、無甲 × 胸、頭 × ${D.length} 種距離）擊殺時間都 ≤ A。結果：${bad.length ? bad.join('、') : '15 把都沒有被完全取代'}。`, '', '每把守住的項目：', '', '| 武器 | 比它便宜且移速、彈匣都不輸的武器，它贏在 |', '| --- | --- |');
for (const a of GUNS) {
  const rivals = GUNS.filter(b => b !== a && W[b].price <= W[a].price && W[b].speedK >= W[a].speedK && W[b].mag >= W[a].mag);
  if (!rivals.length) { md.push(`| ${a} | 沒有這種對手（價格、移速、彈匣至少一項沒人比得過） |`); continue; }
  md.push(`| ${a} | ${rivals.map(b => { const win = K.filter(([t, d]) => { const x = ttk(a, t, d), y = ttk(b, t, d); return x != null && (y == null || x < y - 1); }); const [t, d] = win.sort((p, q) => (ttk(b, ...q) ?? 1e9) - (ttk(a, ...q) ?? 0) - ((ttk(b, ...p) ?? 1e9) - (ttk(a, ...p) ?? 0)))[0] ?? ['', 0]; return `對 ${b}：${win.length} 格，例如 ${d} m ${{ armor: '有甲胸', bare: '無甲胸', head: '無甲頭', headA: '有甲頭' }[t]} ${fmt(ttk(a, t, d))} 對 ${fmt(ttk(b, t, d))} ms`; }).join('；')} |`);
}
// Bot：--before=檔 是調整前的同一套模擬，兩欄對照
const before = process.argv.find(x => x.startsWith('--before='))?.slice(9), botFiles = botF.filter(f => !f.startsWith('--'));
const med = a => { a = a.filter(x => x != null).sort((x, y) => x - y); return a.length ? a[a.length >> 1] : null; };
const hit = L => { let s = 0, h = 0, k = 0; for (const b of L) for (const t in b.shots) { s += b.shots[t].shots; h += b.shots[t].hits; k += b.shots[t].kills; } return { s, h, k }; };
function botStats(B) {
  const stand = B.filter(b => b.mode === 'stand'), fair = B.filter(b => b.mode === 'fair'), Rd = stand.flatMap(b => b.rounds), f = hit(fair), g = hit(stand), P = fair.flatMap(b => b.plants ?? []), why = {}; let a = 0, d = 0;
  for (const b of fair) for (const h of b.history) { if (h.winner === 0) a++; else d++; why[h.why] = (why[h.why] || 0) + 1; }
  return { '站樁場數': stand.length, '站樁陣亡回合／總回合': `${Rd.length}/${stand.reduce((p, b) => p + b.nRounds, 0)}`, '開局到陣亡中位數 s': med(Rd.map(r => r.t))?.toFixed(1), '被鎖定到陣亡中位數 s': med(Rd.map(r => r.sight))?.toFixed(2), '首次受傷到陣亡中位數 s': med(Rd.map(r => r.hurt))?.toFixed(2), '首次受傷到陣亡最短 s': Math.min(...Rd.map(r => r.hurt ?? 99)).toFixed(2),
    'Bot 命中率（站樁場）': `${(g.h / g.s * 100).toFixed(1)}%（${g.h}/${g.s}）`, '4 對 4 場數': fair.length, 'Bot 命中率（4 對 4）': `${(f.h / f.s * 100).toFixed(1)}%（${f.h}/${f.s}）`, '每殺扣扳機次數（4 對 4）': (f.s / f.k).toFixed(1), '4 對 4 攻方勝回合': `${a}/${a + d}（${(a / (a + d) * 100).toFixed(0)}%）`, '回合結束原因': Object.entries(why).map(([k, v]) => k + ' ' + v).join('、'), '安裝比例': `${P.length}/${a + d}`, '開局到安裝中位數 s': med(P.map(p => p.t))?.toFixed(0), '安裝時存活中位數 攻／守': `${med(P.map(p => p.atk))}／${med(P.map(p => p.def))}` };
}
const Bn = [J, ...botFiles.map(load)].flatMap(x => x.bots ?? []);
if (Bn.length) {
  const now = botStats(Bn), was = before ? botStats(load(before).bots) : null;
  md.push('', '## Bot 對戰模擬', '', '整場比賽走 `speed(4)`（要經過渲染，命中膠囊才是真的），無頭約 25 fps，一幀推進約 0.16 s 遊戲時間。站樁：玩家穿甲戴盔站在炸點中央不動，比賽是 4 對 5。4 對 4：玩家當觀眾、對面少一隻（不抽持裝藥的），量攻守。同一半場的回合受經濟連動，不是獨立樣本，勝率的誤差比回合數看起來大。', '',
    '自訂目標（不是標準，只是判斷要不要調的線）：4 對 4 攻方勝率 40–60%；Bot 每扣一次扳機的命中率不超過 30%；站樁從被 Bot 鎖定到陣亡的中位數不少於 1 s。', '',
    was ? '| 量 | 調整前 | 調整後 |' : '| 量 | 值 |', was ? '| --- | ---: | ---: |' : '| --- | ---: |');
  for (const k in now) md.push(was ? `| ${k} | ${was[k]} | ${now[k]} |` : `| ${k} | ${now[k]} |`);
  md.push('', '調整：反應改成 (.32 + (1−skill)×.4 + 0–.14) s，裝藥前守方 ×.55、攻方 ×1.2；散布 miss 改成 (1−skill)×.045 + .01 rad；守方到位後看向攻方來路（沿導航往攻方出生點兩步的方向）並左右掃。攻方勝率偏高的主因是最後一項：守方走到定點後一直面向走來的方向，攻方常從背後進場，光改反應時攻方仍是 74%（29/39），加上朝向後才到 50%。');
}
md.push('');
writeFileSync(resolve(GAME_DIR, 'dist/balance.md'), md.join('\n'));
console.log(md.join('\n'));
