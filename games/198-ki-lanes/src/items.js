// 商店與道具（規則面，不碰 DOM）：泉水附近或陣亡時可以買賣；合成道具會吃掉身上的下位道具並折抵價格；
// 賣回拿 60% 總價；仙豆另外計數、最多 3 顆。
import { ITEMS, INV_SLOTS, FOUNTAIN, GOLD, KI_BAR, ELIXIR_DUR } from './config.js';
import { recalcStats, heal, addKi, addMp } from './units.js';

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
  if (it.elixir) return h.gold >= it.cost && !(h.elixir && h.elixir.id === id);
  if (it.consumable) return (h[it.field] || 0) < it.max && h.gold >= it.cost;
  const p = plan(h, id);
  // 原作規則：同一件傳說裝備只能有一件，鞋子只能有一雙（合成時被吃掉的不算）
  if (it.tier === 3 && h.inv.includes(id)) return false;
  if (it.boots && h.inv.some((x, i) => !p.use.includes(i) && itemById(x).boots)) return false;
  if (it.boots && h.psv && h.psv.rune_footwear && !h.footGot) return false; // 神行鞋：時間到之前不能買鞋
  return h.gold >= p.price && h.inv.length - p.use.length < INV_SLOTS;
}
export function buy(G, h, id) {
  if (!canBuy(h, id)) return false;
  const it = itemById(id);
  if (it.elixir) { h.gold -= it.cost; h.elixir = { id, until: G.time + ELIXIR_DUR, ...it.elixir }; recalcStats(h); G.emit('buy', { h, id }); return true; }
  if (it.consumable) { h.gold -= it.cost; h[it.field] = (h[it.field] || 0) + 1; if (id === 'flask') h.flaskC = 2; G.emit('buy', { h, id }); return true; }
  const p = plan(h, id);
  h.gold -= p.price;
  h.inv = h.inv.filter((_, i) => !p.use.includes(i));
  h.inv.push(id); recalcStats(h);
  if (it.tier === 3 && h.psv && h.psv.rune_cashback) h.gold += p.price * h.psv.rune_cashback.cashback; // 回饋金
  G.emit('buy', { h, id, combined: p.use.length > 0 });
  return true;
}
export const sellPrice = (id) => Math.round(totalCost(id) * 0.6);
export function sell(G, h, slot) {
  const id = h.inv[slot]; if (!id || !inShop(h)) return false;
  h.inv.splice(slot, 1); h.gold += sellPrice(id); recalcStats(h); G.emit('sell', { h, id }); return true;
}
// 藥水：持續回血，同一時間只有一瓶在作用
function drink(G, h, hp, dur) {
  if (h.st.potion > 0) return false;
  const tw = h.psv && h.psv.rune_timewarp ? h.psv.rune_timewarp.timewarp : 0; // 時光藥：立刻回 40%
  if (tw) heal(G, h, hp * tw);
  h.st.potion = dur; h.st.potionRate = hp * (1 - tw) / dur; G.emit('potion', h); return true;
}
export function eatSenzu(G, h) {
  if (!h.alive) return false;
  if (!(h.senzu > 0)) {
    if (h.biscuit > 0) { h.biscuit--; heal(G, h, (20 + h.maxHp * 0.02) * (1 + (1 - h.hp / h.maxHp))); h.bisHp = (h.bisHp || 0) + 30; recalcStats(h); G.emit('potion', h); return true; } // 乾糧
    if (h.salve > 0 && drink(G, h, 120, 15)) { h.salve--; return true; }
    if (h.flask > 0 && h.flaskC > 0 && drink(G, h, 100, 12)) { h.flaskC--; return true; }
    return false;
  }
  if (h.cds.S > 0) return false;
  h.senzu--; h.cds.S = 6;
  heal(G, h, h.maxHp * 0.45); addKi(G, h, KI_BAR); addMp(h, h.maxMp * 0.45);
  G.emit('senzu', h); return true;
}
// AI 的出裝目標（依定位，每種定位有幾套路線，開局隨機挑一套），一次只買目標的下一步。體力型英雄不買魔力裝
export const BUILDS = {
  fighter: [
    ['trinity', 'steelboots', 'sterak', 'deathdance', 'halo', 'water'],
    ['cleaver', 'steelboots', 'ravenous', 'sterak', 'jaksho', 'halo'],
    ['stride', 'windboots', 'overlord', 'deathdance', 'sundered', 'halo'],
  ],
  assassin: [
    ['zsword', 'leafboots', 'hubris', 'umbral', 'mortal', 'halo'],
    ['ghostblade', 'leafboots', 'axiom', 'nightedge', 'serylda', 'halo'],
    ['profane', 'leafboots', 'eclipse', 'hubris', 'majin', 'holy'],
  ],
  tank: [
    ['thorn', 'windboots', 'sunfire', 'frostheart', 'visage', 'warmog'],
    ['heartsteel', 'steelboots', 'jaksho', 'randuin', 'naturefx', 'thorn'],
  ],
  mage: [
    ['tome', 'mageboots', 'liandry', 'beerus', 'voidstaff', 'hourglass'],
    ['echo', 'mageboots', 'shadowflame', 'beerus', 'rylai', 'veil'],
    ['malignance', 'mageboots', 'stormsurge', 'beerus', 'cryptbloom', 'hourglass'],
  ],
  mageEnergy: [
    ['beerus', 'leafboots', 'hourglass', 'riftmaker', 'shadowflame', 'holy'],
    ['liandry', 'leafboots', 'rylai', 'beerus', 'voidstaff', 'veil'],
  ],
  marksman: [
    ['zsword', 'nimbus', 'tribow', 'collector', 'mortal', 'shieldbow'],
    ['statikk', 'nimbus', 'zsword', 'botrk', 'giantslayer', 'shieldbow'],
    ['rageblade', 'nimbus', 'botrk', 'witsend', 'terminus', 'halo'],
  ],
};
export const buildList = (h) => { const l = BUILDS[buildOf(h)]; return l[(h.buildPick || 0) % l.length]; };
export function buildOf(h) {
  const r = h.def.role;
  if (r === '坦克') return 'tank';
  if (r === '刺客') return 'assassin';
  if (r === '遠程術士') return h.res === 'energy' ? 'mageEnergy' : 'mage';
  if (r === '遠程射手') return 'marksman';
  return h.res === 'energy' ? 'assassin' : 'fighter';
}
// 下一個要買的東西：目標本身買得起就買，否則買最貴、買得起、還缺的下位道具
export function nextBuy(h) {
  const build = buildList(h);
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
  // 六格滿了還有錢：依定位吃一顆藥丸
  if (h.inv.length >= INV_SLOTS && !h.elixir && h.gold > 900) { const b = buildOf(h); buy(G, h, b === 'tank' ? 'ironpill' : b.startsWith('mage') ? 'kipill' : 'ragepill'); }
}
