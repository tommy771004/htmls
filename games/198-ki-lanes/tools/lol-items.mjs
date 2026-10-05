// 開發用：把 data/lol-items.json（Data Dragon）換算成本作裝備，寫出 src/items-lol.js。
// 名稱、效果與說明寫在 data/lol-item-map.mjs（逐件手填）；沒有填的裝備不會上架。
// 換算比例沿用現有 19 件的錨點（見 plans/198-lol-gap.md 第 3 節）。node tools/lol-items.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { MAP, REUSE } from '../data/lol-item-map.mjs';

const src = JSON.parse(readFileSync(new URL('../data/lol-items.json', import.meta.url)));
const byId = Object.fromEntries(src.items.map((i) => [i.id, i]));

// 層級：0 基礎、1 史詩（含二階鞋）、2 傳說（含三階鞋）
const TIER = { basic: 0, epic: 1, legendary: 2, boots: 1, consumable: 0 };
const tierOf = (i) => (i.tier === 'boots' ? (i.from.length ? (byId[i.from[0]]?.from.length ? 2 : 1) : 0) : TIER[i.tier]);
// 原作屬性名稱 → [本作欄位, 是否百分比, 每層換算係數]
const STATS = [
  ['物理攻擊', 'ad', false, [1.2, 0.9, 0.8]],
  ['魔法攻擊', 'ap', false, [1.0, 0.8, 0.65]],
  ['生命', 'hp', false, [1.2, 1.1, 1.0]],
  ['魔力', 'mp', false, [0.75, 0.75, 0.75]],
  ['物理防禦', 'armor', false, [0.4, 0.35, 0.3]],
  ['魔法防禦', 'mr', false, [0.4, 0.35, 0.3]],
  ['攻擊速度', 'as', true, [1, 0.9, 0.8]],
  ['暴擊率', 'crit', true, [1, 1, 1]],
  ['技能加速', 'ah', false, [1, 1, 1]],
  ['跑速', 'ms', true, [1, 1, 1]],
  ['物理致命', 'leth', false, [0.4, 0.4, 0.4]],
  ['物理穿透', 'apen', true, [1, 1, 1]],
  ['魔法穿透', 'mpenPct', true, [1, 1, 1]],
  ['魔法穿透', 'mpen', false, [0.4, 0.4, 0.4]],
  ['普攻吸血', 'ls', true, [1, 1, 1]],
  ['全能吸血', 'ov', true, [1, 1, 1]],
  ['韌性', 'ten', true, [1, 1, 1]],
  ['基礎生命回復', 'hpr', true, [1, 1, 1]],
  ['基礎魔力回復', 'mpr', true, [1, 1, 1]],
  ['治療及護盾強度', 'hsp', true, [1, 1, 1]],
  ['暴擊傷害', 'critDmg', true, [1, 1, 1]],
];
const MS_FLAT = 1 / 335; // 固定跑速換成本作移速比例
const GOLD_K = [1.0, 0.75, 0.55];
export function convStats(i) {
  const t = tierOf(i), out = {};
  for (const m of i.stats.matchAll(/([\d.]+)(%?) ([^\d%]+?)(?= [\d.]|$)/g)) {
    const v = +m[1], pct = m[2] === '%', name = m[3].trim();
    if (name === '跑速' && !pct) { out.ms = +((out.ms || 0) + v * MS_FLAT).toFixed(3); continue; }
    const row = STATS.find(([n, , p]) => n === name && p === pct);
    if (!row) continue;
    const [, key, isPct, k] = row;
    const val = (isPct ? v / 100 : v) * k[t];
    out[key] = +((out[key] || 0) + val).toFixed(isPct ? 3 : 0);
  }
  return out;
}
const label = { ad: '攻擊', ap: '氣功強度', hp: '血量', mp: '魔力', armor: '物理防禦', mr: '技能防禦', as: '攻速', crit: '暴擊率', ah: '技能加速', ms: '移速', leth: '穿甲', apen: '穿甲', mpenPct: '法穿', mpen: '法穿', ls: '普攻吸血', ov: '全能吸血', ten: '韌性', hpr: '生命回復', mpr: '魔力回復', hsp: '治療與護盾強度', critDmg: '暴擊傷害' };
const PCT = new Set(['as', 'crit', 'ms', 'apen', 'mpenPct', 'ls', 'ov', 'ten', 'hpr', 'mpr', 'hsp', 'critDmg']);
export const statText = (s) => Object.entries(s).map(([k, v]) => `${label[k]} +${PCT.has(k) ? Math.round(v * 100) + '%' : v}`).join('，');

// 本作 id：沿用的用舊 id，其餘用對照表的 id
const ourId = (lid) => REUSE[lid] || MAP[lid]?.id;
const total = {};
const out = [];
const skipped = [];
for (const i of src.items) {
  const m = MAP[i.id];
  if (!m || REUSE[i.id]) continue;
  const from = i.from.map(ourId);
  if (from.some((x) => !x)) { skipped.push(`${i.name}（缺材料 ${i.from.filter((f) => !ourId(f)).map((f) => byId[f]?.name || f).join('、')}）`); continue; }
  const t = tierOf(i);
  const stats = { ...convStats(i), ...(m.stats || {}) };
  total[i.id] = Math.round((m.gold ?? i.gold * (m.goldK ?? GOLD_K[t])) / 5) * 5;
  out.push({
    id: m.id, name: m.name, lol: i.id, proto: i.name, tier: t + 1, from, gold: total[i.id], stats,
    ...(m.psv ? { psv: m.psv } : {}), ...(m.act ? { act: m.act } : {}), ...(i.tier === 'boots' ? { boots: true } : {}),
    ...(m.consumable ? { consumable: m.consumable } : {}), ...(m.hidden ? { hidden: true } : {}),
    desc: statText(stats), note: m.note || '',
  });
}
writeFileSync(new URL('../src/items-lol.js', import.meta.url),
  `// 由 tools/lol-items.mjs 依 data/lol-items.json（Data Dragon ${src.version}）與 data/lol-item-map.mjs 產生，請勿手改。\n` +
  `// gold 是整件總價；config.js 會依材料換算成遞增價 cost。proto／lol 是原作名稱與編號。\n` +
  `export const LOL_ITEMS = ${JSON.stringify(out, null, 0).replace(/\},\{/g, '},\n  {').replace(/^\[/, '[\n  ').replace(/\]$/, ',\n]')};\n`);
console.log(`items-lol.js：${out.length} 件`);
if (skipped.length) console.log('略過：' + skipped.join('；'));
