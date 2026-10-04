// 商店與道具（規則面，不碰 DOM）：泉水附近或陣亡時可以買；仙豆另外計數、最多 3 顆。
import { ITEMS, INV_SLOTS, FOUNTAIN, GOLD, KI_BAR } from './config.js';
import { recalcStats, heal, addKi } from './units.js';

export const itemById = (id) => ITEMS.find((i) => i.id === id);
export function inShop(h) {
  const f = FOUNTAIN[h.team];
  return !h.alive || Math.hypot(h.x - f[0], h.z - f[1]) < GOLD.shopRadius;
}
export function canBuy(h, id) {
  const it = itemById(id); if (!it) return false;
  if (!inShop(h) || h.gold < it.cost) return false;
  if (it.consumable) return (h.senzu || 0) < it.max;
  return h.inv.length < INV_SLOTS && !h.inv.includes(id);
}
export function buy(G, h, id) {
  if (!canBuy(h, id)) return false;
  const it = itemById(id);
  h.gold -= it.cost;
  if (it.consumable) h.senzu = (h.senzu || 0) + 1;
  else { h.inv.push(id); recalcStats(h); }
  G.emit('buy', { h, id });
  return true;
}
export function sell(G, h, id) {
  const i = h.inv.indexOf(id); if (i < 0 || !inShop(h)) return false;
  h.inv.splice(i, 1); h.gold += Math.round(itemById(id).cost * 0.6); recalcStats(h); G.emit('sell', { h, id }); return true;
}
export function eatSenzu(G, h) {
  if (!h.alive || !(h.senzu > 0) || h.cds.S > 0) return false;
  h.senzu--; h.cds.S = 6;
  heal(G, h, h.maxHp * 0.45); addKi(G, h, KI_BAR);
  G.emit('senzu', h); return true;
}
// AI 的採購順序（依定位）
export const BUILDS = {
  melee: ['senzu', 'weights', 'armor', 'nimbus', 'kaioken', 'cell', 'kiamp', 'water'],
  tank: ['senzu', 'armor', 'cell', 'nimbus', 'weights', 'kiamp', 'kaioken', 'water'],
  ranged: ['senzu', 'weights', 'scouter', 'nimbus', 'kaioken', 'kiamp', 'water', 'armor'],
};
export function aiShop(G, h) {
  if (!inShop(h)) return;
  const build = BUILDS[h.def.role === '坦克' ? 'tank' : h.def.melee ? 'melee' : 'ranged'];
  let guard = 8;
  while (guard--) {
    const next = build.find((id) => { const it = itemById(id); return it.consumable ? (h.senzu || 0) < 1 : !h.inv.includes(id); });
    if (!next || !buy(G, h, next)) break;
  }
}
