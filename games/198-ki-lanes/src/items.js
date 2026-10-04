// 商店與道具（規則面，不碰 DOM）：泉水附近或陣亡時可以買賣；合成道具會吃掉身上的下位道具並折抵價格；
// 賣回拿 60% 總價；仙豆另外計數、最多 3 顆。
import { ITEMS, INV_SLOTS, FOUNTAIN, GOLD, KI_BAR } from './config.js';
import { recalcStats, heal, addKi } from './units.js';

export const itemById = (id) => ITEMS.find((i) => i.id === id);
const totals = {};
export function totalCost(id) {
  if (totals[id] !== undefined) return totals[id];
  const it = itemById(id);
  return (totals[id] = it.cost + (it.from || []).reduce((a, c) => a + totalCost(c), 0));
}
export function inShop(h) {
  const f = FOUNTAIN[h.team];
  return !h.alive || Math.hypot(h.x - f[0], h.z - f[1]) < GOLD.shopRadius;
}
// 合成計畫：從身上道具扣掉能用的下位道具（遞迴），回傳 { price, use: [被吃掉的身上道具索引] }
export function plan(h, id) {
  const pool = h.inv.map((x, i) => ({ id: x, i, used: false }));
  const use = [];
  const need = (iid, top) => {
    if (!top) { const own = pool.find((p) => !p.used && p.id === iid); if (own) { own.used = true; use.push(own.i); return 0; } }
    const it = itemById(iid);
    return it.cost + (it.from || []).reduce((a, c) => a + need(c, false), 0);
  };
  const price = need(id, true);
  return { price, use };
}
export function priceFor(h, id) { const it = itemById(id); return it.consumable ? it.cost : plan(h, id).price; }
export function canBuy(h, id) {
  const it = itemById(id); if (!it) return false;
  if (!inShop(h)) return false;
  if (it.consumable) return (h[it.field] || 0) < it.max && h.gold >= it.cost;
  const p = plan(h, id);
  return h.gold >= p.price && h.inv.length - p.use.length < INV_SLOTS;
}
export function buy(G, h, id) {
  if (!canBuy(h, id)) return false;
  const it = itemById(id);
  if (it.consumable) { h.gold -= it.cost; h[it.field] = (h[it.field] || 0) + 1; G.emit('buy', { h, id }); return true; }
  const p = plan(h, id);
  h.gold -= p.price;
  h.inv = h.inv.filter((_, i) => !p.use.includes(i));
  h.inv.push(id); recalcStats(h);
  G.emit('buy', { h, id, combined: p.use.length > 0 });
  return true;
}
export const sellPrice = (id) => Math.round(totalCost(id) * 0.6);
export function sell(G, h, slot) {
  const id = h.inv[slot]; if (!id || !inShop(h)) return false;
  h.inv.splice(slot, 1); h.gold += sellPrice(id); recalcStats(h); G.emit('sell', { h, id }); return true;
}
export function eatSenzu(G, h) {
  if (!h.alive || !(h.senzu > 0) || h.cds.S > 0) return false;
  h.senzu--; h.cds.S = 6;
  heal(G, h, h.maxHp * 0.45); addKi(G, h, KI_BAR);
  G.emit('senzu', h); return true;
}
// AI 的出裝目標（依定位），一次只買目標的下一步
export const BUILDS = {
  melee: ['kaioken', 'nimbus', 'armor', 'water', 'potara'],
  tank: ['armor', 'cell', 'nimbus', 'potara', 'water'],
  ranged: ['kaioken', 'kiamp', 'nimbus', 'water', 'potara'],
};
// 下一個要買的東西：目標本身買得起就買，否則買最貴、買得起、還缺的下位道具
export function nextBuy(h) {
  const build = BUILDS[h.def.role === '坦克' ? 'tank' : h.def.melee ? 'melee' : 'ranged'];
  // 已合成的終極道具會吃掉進階道具：已經擁有（或其上位已擁有）就跳過
  const owns = (id) => h.inv.includes(id) || ITEMS.some((x) => x.from && x.from.includes(id) && owns(x.id));
  const target = build.find((id) => !owns(id));
  if (!target) return null;
  const missing = [];
  const walk = (id, top) => { if (!top && h.inv.includes(id)) return; const it = itemById(id); missing.push(id); (it.from || []).forEach((c) => walk(c, false)); };
  walk(target, true);
  return { target, missing };
}
export function aiShop(G, h) {
  if (!inShop(h)) return;
  let guard = 8;
  if ((h.senzu || 0) < 1 && h.gold > 400) buy(G, h, 'senzu');
  if ((h.controls || 0) < 1 && h.gold > 350 && G.time > 150) buy(G, h, 'control');
  while (guard--) {
    const nb = nextBuy(h); if (!nb) break;
    if (canBuy(h, nb.target)) { buy(G, h, nb.target); continue; }
    const opts = nb.missing.filter((id) => id !== nb.target && canBuy(h, id)).sort((a, b) => priceFor(h, b) - priceFor(h, a));
    if (!opts.length || !buy(G, h, opts[0])) break;
  }
}
