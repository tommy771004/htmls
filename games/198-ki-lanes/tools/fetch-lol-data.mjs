// 開發用：從 Riot 公開的 Data Dragon 抓《英雄聯盟》召喚峽谷的裝備、符文與召喚師技能（繁中），
// 整理成 data/lol-*.json，作為 tools/lol-items.mjs 換算本作裝備的來源。不進遊戲打包。
// node tools/fetch-lol-data.mjs [版本，預設最新]
import { writeFileSync, mkdirSync } from 'node:fs';

const get = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${r.status} ${u}`); return r.json(); };
const ver = process.argv[2] || (await get('https://ddragon.leagueoflegends.com/api/versions.json'))[0];
const cdn = `https://ddragon.leagueoflegends.com/cdn/${ver}/data/zh_TW`;
const strip = (s) => s.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/[ \t]+/g, ' ').trim();

const raw = (await get(`${cdn}/item.json`)).data;
// 召喚峽谷（地圖 11）買得到的；id ≥ 10000 是其他模式的複本
const sr = Object.entries(raw).filter(([id, v]) => +id < 10000 && v.maps?.['11'] && v.gold?.purchasable);
const tierOf = (v) => {
  const t = v.tags || [];
  if (t.includes('Consumable')) return 'consumable';
  if (t.includes('Trinket')) return 'trinket';
  if (t.includes('Boots')) return 'boots';
  if (!v.from) return 'basic';
  return v.into ? 'epic' : 'legendary';
};
// 同名不同版本只留 id 最大的
const byName = new Map();
for (const [id, v] of sr) if (!byName.has(v.name) || +id > +byName.get(v.name)[0]) byName.set(v.name, [id, v]);
const items = [...byName.values()].map(([id, v]) => {
  const d = v.description;
  const stats = strip((d.match(/<stats>([\s\S]*?)<\/stats>/) || [, ''])[1]).replace(/\n/g, ' ');
  const tagged = (tag) => [...d.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => strip(m[1])).filter(Boolean);
  return {
    id, name: v.name, tier: tierOf(v), gold: v.gold.total, from: v.from || [], into: v.into || [], tags: v.tags || [],
    stats, passive: [...new Set(tagged('passive'))], active: [...new Set(tagged('active'))], text: strip(d),
  };
}).sort((a, b) => a.gold - b.gold);

const runes = (await get(`${cdn}/runesReforged.json`)).map((t) => ({
  id: t.key, name: t.name,
  slots: t.slots.map((s) => s.runes.map((r) => ({ id: r.key, name: r.name, text: strip(r.longDesc) }))),
}));
const sums = Object.values((await get(`${cdn}/summoner.json`)).data)
  .filter((s) => s.modes.includes('CLASSIC'))
  .map((s) => ({ id: s.id, name: s.name, cd: +s.cooldownBurn, text: strip(s.description) }));

mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
const save = (n, o) => writeFileSync(new URL(`../data/${n}`, import.meta.url), JSON.stringify({ version: ver, source: 'Riot Games Data Dragon（zh_TW）', ...o }, null, 1));
save('lol-items.json', { items });
save('lol-runes.json', { trees: runes });
save('lol-summoners.json', { spells: sums });
const count = {}; for (const i of items) count[i.tier] = (count[i.tier] || 0) + 1;
console.log(ver, items.length, count, 'runes', runes.length, 'summoners', sums.length);
