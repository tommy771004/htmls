// 道具與設備改版的經營規則：消耗品背包與效果（buff）、每日特價、店家設備、全城建設、外觀與旗色。
// 純資料，不碰 DOM／three；econ.js 把這裡的倍率乘進客流、容量、停留時間與客單價。
import {
  BIZ, BIZ_BY_ID, ITEMS, ITEM_BY_ID, BAG_MAX, DEAL, BOOKABLE, GEAR, GEAR_BY_ID, DELIVERY, CIVIC, CIVIC_BY_ID, FLAGS, FLAG_BY_ID,
  CARGO, WEATHER,
} from './data.js';
import { absMin } from './port.js';

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const hourOf = (s) => (s.minute / 60) % 24;
// 近 3 天平均營收（沒有紀錄時用今天到目前的營收推估）
export function avgRev(s) {
  const h = s.history.slice(-3);
  if (h.length) return h.reduce((t, d) => t + d.rev, 0) / h.length;
  let r = 0;
  for (const k in s.today.rev) r += s.today.rev[k];
  return r;
}

// ───────── 消耗品 ─────────
export function itemListPrice(s, id) {
  const it = ITEM_BY_ID[id];
  if (it.fixed) return it.fixed;
  return Math.max(it.min, Math.round((avgRev(s) * it.k) / 500) * 500);
}
// 今日特價打折後的價格
export function itemPrice(s, id) {
  const p = itemListPrice(s, id);
  return s.deal && s.deal.sale === id ? Math.round((p * (1 - DEAL.off)) / 100) * 100 : p;
}
export const bagCount = (s, id) => (s.bag && s.bag[id]) || 0;
export const bagTotal = (s) => Object.values(s.bag || {}).reduce((t, v) => t + v, 0);
// 能不能買：稀有品只能在今日特價買，每天限一個
export function canBuyItem(s, id) {
  const it = ITEM_BY_ID[id];
  if (!it) return false;
  if (bagCount(s, id) >= BAG_MAX) return false;
  if (it.rare && !(s.deal && s.deal.items.includes(id) && !s.deal.bought.includes(id))) return false;
  return s.money >= itemPrice(s, id);
}
export function buyItem(s, id) {
  if (!canBuyItem(s, id)) return false;
  const c = itemPrice(s, id);
  s.money -= c;
  s.today.buy += c;
  s.bag[id] = bagCount(s, id) + 1;
  if (s.deal && s.deal.items.includes(id) && !s.deal.bought.includes(id)) s.deal.bought.push(id);
  return true;
}
export function giveItems(s, items) {
  for (const [id, n] of Object.entries(items || {})) if (ITEM_BY_ID[id]) s.bag[id] = Math.min(BAG_MAX, bagCount(s, id) + n);
}

export const buffOf = (s, id, t) => (s.buffs || []).find((b) => b.id === id && (t === undefined || b.t === t) && b.until > absMin(s));
// 可以用在哪些店（指定店家的道具）
export function itemTargets(s, id) {
  const it = ITEM_BY_ID[id];
  if (it.target !== 'shop') return [];
  return BIZ.filter((b) => s.biz[b.id].lv && (!it.ok || it.ok.includes(b.id))).map((b) => b.id);
}
// 和目標無關的使用條件（介面用來決定要不要展開目標）
export function useGate(s, id) {
  const it = ITEM_BY_ID[id];
  if (!it || !bagCount(s, id)) return '背包裡沒有';
  if (it.port && !s.port.lv) return '要先開設海港';
  if (it.rival && !s.rival) return '現在沒有對手';
  if (it.hours) { const h = hourOf(s); if (h < it.hours[0] || h >= it.hours[1]) return `只能在 ${it.hours[0]}:00 到 ${it.hours[1]}:00 使用`; }
  if (it.target === 'event' && s.booked) return '明天已經有預約了';
  if (!it.target && buffOf(s, id)) return '效果還在';
  return null;
}
// 現在能不能用；不能用時回傳原因
export function useBlock(s, id, t) {
  const it = ITEM_BY_ID[id];
  const g = useGate(s, id);
  if (g) return g;
  if (it.target === 'shop') {
    if (!t || !itemTargets(s, id).includes(t)) return '請選一家可用的店';
    if (buffOf(s, id, t)) return '這家店的效果還在';
  } else if (it.target === 'cargo') {
    if (!CARGO[t]) return '請選貨種';
  } else if (it.target === 'event') {
    if (!BOOKABLE.includes(t)) return '請選活動';
  }
  return null;
}
export function useItem(s, id, t, ev = []) {
  if (useBlock(s, id, t)) return false;
  const it = ITEM_BY_ID[id], now = absMin(s);
  s.bag[id] -= 1;
  if (!s.bag[id]) delete s.bag[id];
  s.stats.items = (s.stats.items || 0) + 1;
  s.today.items = (s.today.items || 0) + 1;
  s.used[id] = (s.used[id] || 0) + 1;
  if (id === 'influencer') s.rating = Math.min(100, s.rating + 8);
  if (id === 'airfreight') s.port.stock[t] += it.units;
  if (id === 'booking') s.booked = t;
  if (id === 'flyer') s.rival.power = Math.max(0, s.rival.power - 0.1);
  if (id === 'fireworks') s.stats.fireworks = (s.stats.fireworks || 0) + 1;
  const until = it.day ? now - s.minute + 1440 : it.minutes ? now + it.minutes : 0;
  if (until) s.buffs.push({ id, t: it.target === 'shop' ? t : undefined, until });
  ev.push({ type: 'item', id, t });
  return true;
}

// ───────── 店家設備 ─────────
export const gearFits = (bizId, gid) => {
  const g = GEAR_BY_ID[gid], b = BIZ_BY_ID[bizId];
  return (!g.ok || g.ok.includes(bizId)) && (!g.zone || g.zone === b.zone);
};
export const hasGear = (s, bizId, gid) => !!(s.gear[bizId] && s.gear[bizId].includes(gid));
export const gearCost = (bizId, gid) => Math.round((BIZ_BY_ID[bizId].cost * GEAR_BY_ID[gid].mul) / 1000) * 1000;
export function buyGear(s, bizId, gid) {
  if (!GEAR_BY_ID[gid] || !BIZ_BY_ID[bizId] || !s.biz[bizId].lv || !gearFits(bizId, gid) || hasGear(s, bizId, gid)) return false;
  const c = gearCost(bizId, gid);
  if (s.money < c) return false;
  s.money -= c;
  s.today.buy += c;
  (s.gear[bizId] = s.gear[bizId] || []).push(gid);
  return true;
}

// ───────── 全城建設與外觀 ─────────
export const hasCivic = (s, id) => !!(s.civic && s.civic[id]);
export const hasPermit = (s, id) => { const c = CIVIC_BY_ID[id]; return !c.permit || !!s.permits[c.permit]; };
export function buyCivic(s, id) {
  const c = CIVIC_BY_ID[id];
  if (!c || hasCivic(s, id) || !hasPermit(s, id) || s.money < c.cost) return false;
  s.money -= c.cost;
  s.today.buy += c.cost;
  s.civic[id] = s.day;
  return true;
}
export const flagColor = (s) => (FLAG_BY_ID[s.flag] || FLAGS[0]).color;
export const ownsFlag = (s, id) => id === 'green' || s.flags.includes(id);
export function setFlag(s, id) {
  const f = FLAG_BY_ID[id];
  if (!f) return false;
  if (!ownsFlag(s, id)) {
    if (s.money < f.cost) return false;
    s.money -= f.cost;
    s.today.buy += f.cost;
    s.flags.push(id);
  }
  s.flag = id;
  return true;
}

// ───────── 給 econ 的倍率 ─────────
// 客流
export function itemArrive(s, id) {
  const def = BIZ_BY_ID[id];
  let k = 1;
  if (buffOf(s, 'influencer', id)) k *= 1.3;
  if (def.zone === 'beach' && buffOf(s, 'fireworks')) k *= 1.6;
  if (buffOf(s, 'shuttle')) k *= 1.15;
  if (hasGear(s, id, 'neon')) { const h = hourOf(s); if (h >= 18 || h < 3) k *= 1.2; }
  if (hasGear(s, id, 'loyal')) k *= 1.08;
  if (def.zone === 'city') {
    if (hasCivic(s, 'stage')) k *= 1.04;
    if (hasCivic(s, 'parking')) k *= 1.06;
  }
  if (def.zone === 'beach' && hasCivic(s, 'mascot')) k *= 1.05;
  return k;
}
// 天氣倍率（雨棚、救生員塔）
export function weatherMult(s, def) {
  const w = s.weather.cur;
  let m = WEATHER[w].mult[def.kind];
  if (hasGear(s, def.id, 'awning')) {
    if (w === 'rain') m = Math.max(m, def.kind === 'water' ? 0.3 : 0.45);
    else if (w === 'cloudy') m = Math.max(m, 0.85);
  }
  if (def.kind === 'water' && (w === 'rain' || w === 'cloudy') && hasCivic(s, 'lifeguard')) m *= 2;
  return m;
}
// 海灘季節倍率（暖爐）
export const heaterSeason = (s, beach) => (buffOf(s, 'heater') ? Math.max(beach, 0.85) : beach);
// 海灘閒逛人潮
export function itemCrowd(s) {
  let k = 1;
  if (buffOf(s, 'fireworks')) k *= 2;
  if (s.weather.cur === 'rain' && hasCivic(s, 'lifeguard')) k *= 3;
  if (hasCivic(s, 'mascot')) k *= 1.05;
  return k;
}
export const capMult = (s, id) => (buffOf(s, 'temp', id) ? 1.5 : 1);
export const stayMult = (s, id) => (hasGear(s, id, 'kiosk') ? 0.85 : 1);
export const priceMult = (s, id) => (buffOf(s, 'chef', id) ? 1.3 : 1);
// 客滿時：外送機車接走一部分客人
export const canDeliver = (s, id, r) => hasGear(s, id, 'delivery') && r < DELIVERY.share;
export const loyalPenalty = (s, id) => (hasGear(s, id, 'loyal') ? 0.5 : 1);

// ───────── 每小時、每天 ─────────
// 每整點：雨天保險理賠、表演台評分、過期的效果移除。回傳保險理賠金額
export function itemsHour(s, ev, expect) {
  let pay = 0;
  if (buffOf(s, 'insurance') && s.weather.cur === 'rain') {
    // 每個下雨的整點：海灘商家在晴時多雲的期望營收與雨天的差額，補一半
    pay = Math.round(expect * 0.5);
    if (pay) {
      s.money += pay;
      s.today.rev.insurance = (s.today.rev.insurance || 0) + pay;
      s.stats.earned += pay;
      ev.push({ type: 'insurance', amount: pay });
    }
  }
  if (hasCivic(s, 'stage')) { const h = hourOf(s); if (h >= 10 && h < 22) s.rating = Math.min(100, s.rating + 0.3); }
  const now = absMin(s);
  for (const b of s.buffs) if (b.until <= now && !b.ended) { b.ended = true; ev.push({ type: 'buffEnd', id: b.id, t: b.t }); }
  s.buffs = s.buffs.filter((b) => b.until > now);
  return pay;
}
// 新的一天：換每日特價；預約的活動取代今天抽到的活動（週末與派對夜照舊）
export function newDeal(s, rand) {
  const pool = ITEMS.filter((i) => !i.rare && (!i.port || s.port.lv) && (!i.rival || s.rival || s.stats.rivals));
  const items = [];
  while (items.length < Math.min(DEAL.slots - 1, pool.length)) {
    const it = pool[Math.floor(rand(s) * pool.length)];
    if (!items.includes(it.id)) items.push(it.id);
  }
  const rares = ITEMS.filter((i) => i.rare);
  if (rand(s) < DEAL.rareChance) items.push(rares[Math.floor(rand(s) * rares.length)].id);
  else {
    const rest = pool.filter((i) => !items.includes(i.id));
    if (rest.length) items.push(rest[Math.floor(rand(s) * rest.length)].id);
  }
  const common = items.filter((id) => !ITEM_BY_ID[id].rare);
  s.deal = { day: s.day, items, sale: common[Math.floor(rand(s) * common.length)] || null, bought: [] };
}
export function applyBooking(s) {
  if (!s.booked) return false;
  if (s.event !== 'weekend' && s.event !== 'party') s.event = s.booked;
  s.booked = null;
  return true;
}

// ───────── 投資（帝國等級） ─────────
export function itemsInvested(s) {
  let t = 0;
  for (const [id, list] of Object.entries(s.gear)) for (const g of list) t += gearCost(id, g);
  for (const c of CIVIC) if (hasCivic(s, c.id)) t += c.cost;
  for (const f of s.flags) t += FLAG_BY_ID[f] ? FLAG_BY_ID[f].cost : 0;
  return t;
}

// ───────── 存檔 ─────────
export function newItems() {
  return { bag: {}, buffs: [], used: {}, gear: {}, civic: {}, permits: {}, flags: [], flag: 'green', deal: null, booked: null };
}
export function sanitizeItems(raw, s) {
  const r = raw && typeof raw === 'object' ? raw : {};
  for (const [k, v] of Object.entries(r.bag || {})) if (ITEM_BY_ID[k]) { const n = Math.max(0, Math.min(BAG_MAX, Math.round(num(v, 0)))); if (n) s.bag[k] = n; }
  for (const [k, v] of Object.entries(r.used || {})) if (ITEM_BY_ID[k]) s.used[k] = Math.max(0, Math.round(num(v, 0)));
  if (Array.isArray(r.buffs)) {
    s.buffs = r.buffs.filter((b) => b && ITEM_BY_ID[b.id] && typeof b.until === 'number' && (b.t === undefined || b.t === null || BIZ_BY_ID[b.t])).slice(0, 40)
      .map((b) => ({ id: b.id, t: b.t || undefined, until: b.until }));
  }
  for (const [k, v] of Object.entries(r.gear || {})) {
    if (!BIZ_BY_ID[k] || !Array.isArray(v)) continue;
    const list = [...new Set(v.filter((g) => GEAR_BY_ID[g] && gearFits(k, g)))];
    if (list.length) s.gear[k] = list;
  }
  for (const [k, v] of Object.entries(r.civic || {})) if (CIVIC_BY_ID[k]) s.civic[k] = Math.max(1, Math.round(num(v, 1)));
  for (const [k, v] of Object.entries(r.permits || {})) if (CIVIC.some((c) => c.permit === k)) s.permits[k] = Math.max(1, Math.round(num(v, 1)));
  if (Array.isArray(r.flags)) s.flags = [...new Set(r.flags.filter((f) => FLAG_BY_ID[f] && f !== 'green'))];
  if (ownsFlag(s, r.flag)) s.flag = r.flag;
  if (r.deal && r.deal.day === s.day && Array.isArray(r.deal.items)) {
    const items = r.deal.items.filter((id) => ITEM_BY_ID[id]).slice(0, DEAL.slots);
    s.deal = { day: s.day, items, sale: items.includes(r.deal.sale) ? r.deal.sale : null, bought: Array.isArray(r.deal.bought) ? r.deal.bought.filter((id) => items.includes(id)) : [] };
  }
  if (BOOKABLE.includes(r.booked)) s.booked = r.booked;
}
