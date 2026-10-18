// 城市生活改版的經營規則：季節、定價與促銷、疊樓加成、電梯、樓層交換、公寓與人口、地標、競爭對手、
// 每日目標、成就與離線收入。純資料，不碰 DOM／three；econ.js 把這裡的倍率乘進客流與客單價。
import {
  BIZ, BIZ_BY_ID, CITY_IDS, BEACH_IDS, SEASONS, SEASON_DAYS, TIERS, PROMO, STACK_BONUS, LIFT, SWAP_COST,
  APT, APT_NAMES, LANDMARKS, LANDMARK_BY_ID, FERRIS_TICKET, RIVAL, RIVAL_NAMES,
} from './data.js';
import { CITY_LOTS, APT_LOTS, STACKS, DEFAULT_FLOOR, lotKey, lotRect } from './layout.js';
import { absMin } from './port.js';

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const hourOf = (s) => (s.minute / 60) % 24;

// ───────── 季節 ─────────
export const seasonOf = (s) => SEASONS[Math.floor((s.day - 1) / SEASON_DAYS) % SEASONS.length];
export const seasonDay = (s) => ((s.day - 1) % SEASON_DAYS) + 1;

// ───────── 定價與促銷 ─────────
export const tierOf = (s, id) => TIERS[s.biz[id].tier || 0];
export const promoLeft = (s, id) => Math.max(0, (s.biz[id].promo || 0) - absMin(s));
export const promoCost = (id) => BIZ_BY_ID[id].price[0] * PROMO.costMul;
export function setTier(s, id, t) {
  if (!s.biz[id].lv || !TIERS[t]) return false;
  s.biz[id].tier = +t;
  return true;
}
export function startPromo(s, id) {
  const c = promoCost(id);
  if (!s.biz[id].lv || promoLeft(s, id) > 0 || s.money < c) return false;
  s.money -= c;
  s.today.buy += c;
  s.biz[id].promo = absMin(s) + PROMO.minutes;
  s.today.promos = (s.today.promos || 0) + 1;
  s.stats.promos = (s.stats.promos || 0) + 1;
  return true;
}

// ───────── 疊樓：加成、電梯、樓層順序 ─────────
export function stackMult(s, id) {
  const key = CITY_LOTS[id] && lotKey(id);
  const st = key && STACKS.find((q) => q.key === key);
  if (!st) return 1;
  let n = 0;
  for (const k of st.ids) if (k !== id) n += s.biz[k].lv;
  return 1 + STACK_BONUS * n;
}
export const liftLv = (s, key) => (s.lifts && s.lifts[key]) || 1;
export const liftCost = (s, key) => (liftLv(s, key) < 3 ? LIFT.cost[liftLv(s, key)] : null);
export function upgradeLift(s, key) {
  const c = liftCost(s, key);
  if (c === null || s.money < c || !STACKS.some((q) => q.key === key)) return 0;
  s.money -= c;
  s.today.buy += c;
  s.lifts[key] = liftLv(s, key) + 1;
  return s.lifts[key];
}
// 疊樓各層的店家（由下而上）；沒調過就是 layout 的預設
export function floorOrder(s, key) {
  const st = STACKS.find((q) => q.key === key);
  const o = s.order && s.order[key];
  return o && o.length === st.ids.length && st.ids.every((id) => o.includes(id)) ? o : st.ids.slice().sort((a, b) => DEFAULT_FLOOR[a] - DEFAULT_FLOOR[b]);
}
export function swapFloors(s, key, a, b) {
  const o = floorOrder(s, key).slice();
  const i = o.indexOf(a), j = o.indexOf(b);
  if (i < 0 || j < 0 || i === j || s.money < SWAP_COST) return false;
  [o[i], o[j]] = [o[j], o[i]];
  s.money -= SWAP_COST;
  s.today.buy += SWAP_COST;
  s.order[key] = o;
  return true;
}

// ───────── 公寓與人口 ─────────
export const APTS = APT_LOTS.map(([c, r, side], i) => {
  const rr = lotRect(c, r, side);
  const cost = APT.base + i * APT.step;
  return { key: `${c},${r},${side}`, c, r, side, i, name: APT_NAMES[i % APT_NAMES.length], cost, reno: Math.round(cost * APT.renoMul), x: (rr.x0 + rr.x1) / 2, z: rr.z1 };
});
export const APT_BY_KEY = Object.fromEntries(APTS.map((a) => [a.key, a]));
export const aptLv = (s, key) => (s.apts && s.apts[key]) || 0;
export const aptNextCost = (s, key) => { const lv = aptLv(s, key), a = APT_BY_KEY[key]; return lv === 0 ? a.cost : lv === 1 ? a.reno : null; };
export function aptRent(key, lv) {
  const a = APT_BY_KEY[key];
  return lv >= 1 ? Math.round(a.cost * APT.rent[0] + (lv >= 2 ? a.reno * APT.rent[1] : 0)) : 0;
}
export function buyApt(s, key) {
  const c = aptNextCost(s, key);
  if (c === null || s.money < c) return 0;
  s.money -= c;
  s.today.buy += c;
  s.apts[key] = aptLv(s, key) + 1;
  // 對手租的就是這棟：買下來就請他們搬走
  if (s.rival && s.rival.lot === key) beatRival(s, 'evict');
  return s.apts[key];
}
export const popLevels = (s) => APTS.reduce((t, a) => t + aptLv(s, a.key), 0);
export const popMult = (s) => 1 + APT.pop * popLevels(s);
export const rentPerDay = (s) => APTS.reduce((t, a) => t + aptRent(a.key, aptLv(s, a.key)), 0);

// ───────── 地標 ─────────
export const hasMark = (s, id) => !!(s.marks && s.marks[id]);
export function buyMark(s, id) {
  const m = LANDMARK_BY_ID[id];
  if (!m || hasMark(s, id) || s.money < m.cost) return false;
  s.money -= m.cost;
  s.today.buy += m.cost;
  s.marks[id] = s.day;
  return true;
}
export function markMult(s, def) {
  let k = 1;
  if (def.kind === 'water' && hasMark(s, 'lighthouse')) k *= 1.15;
  if (def.zone === 'city' && hasMark(s, 'market')) {
    const h = hourOf(s);
    k *= h >= 18 ? 1.1 * 1.25 : 1.1;
  }
  if (def.zone === 'beach' && hasMark(s, 'ferris')) k *= 1.1;
  return k;
}
export const ferrisCrowd = (s) => (hasMark(s, 'ferris') ? 1.2 : 1);

// ───────── 競爭對手 ─────────
export function rivalMult(s, id) {
  const r = s.rival;
  if (!r || r.id !== id) return 1;
  // 平價可以打價格戰（影響減半），Lv3 的店客人比較忠誠
  const k = (s.biz[id].tier === -1 ? 0.5 : 1) * (s.biz[id].lv >= 3 ? 0.8 : 1);
  return 1 - r.power * k;
}
export const rivalBuyCost = (s) => (s.rival ? Math.round(BIZ_BY_ID[s.rival.id].cost * RIVAL.buyMul * (1 + s.rival.power) / 1000) * 1000 : null);
export function buyoutRival(s) {
  const c = rivalBuyCost(s);
  if (c === null || s.money < c) return false;
  s.money -= c;
  s.today.buy += c;
  beatRival(s, 'buyout');
  return true;
}
function beatRival(s, how) {
  s.rivalLog = { id: s.rival.id, name: s.rival.name, how, day: s.day };
  s.rival = null;
  s.rivalNext = s.day + RIVAL.cooldown;
  s.stats.rivals = (s.stats.rivals || 0) + 1;
  s.rating = Math.min(100, s.rating + 4);
}
// 每天開始時：對手變強，或在冷卻結束後找一家生意最好的城市店開到對街（要有沒買下的公寓可租）
function rivalDay(s, rand, ev) {
  if (s.rival) { s.rival.power = Math.min(RIVAL.max, s.rival.power + RIVAL.grow); return; }
  if (s.quest < 4 || s.day < (s.rivalNext || 0)) return;
  const own = CITY_IDS.filter((id) => s.biz[id].lv).sort((a, b) => s.biz[b].earned - s.biz[a].earned);
  if (!own.length || rand(s) > 0.5) return;
  const id = own[Math.min(own.length - 1, Math.floor(rand(s) * Math.min(3, own.length)))];
  const tr = lotRect(...CITY_LOTS[id]);
  const free = APTS.filter((a) => !aptLv(s, a.key)).sort((p, q) => Math.hypot(p.x - (tr.x0 + tr.x1) / 2, p.z - tr.z1) - Math.hypot(q.x - (tr.x0 + tr.x1) / 2, q.z - tr.z1));
  if (!free.length) return;
  s.rival = { id, name: RIVAL_NAMES[id], lot: free[0].key, power: RIVAL.start, since: s.day };
  ev.push({ type: 'rival', id, name: s.rival.name });
}

// ───────── econ 用的總倍率 ─────────
export function lifeMult(s, id) {
  const def = BIZ_BY_ID[id], se = seasonOf(s);
  let k = def.zone === 'beach' ? se.beach : se.city;
  k *= tierOf(s, id).arrive * stackMult(s, id) * rivalMult(s, id) * markMult(s, def);
  if (promoLeft(s, id) > 0) k *= PROMO.mult;
  if (def.zone === 'city') k *= popMult(s);
  return k;
}

// ───────── 每小時與每天 ─────────
export function lifeHour(s) {
  let inc = 0;
  const rent = Math.round(rentPerDay(s) / 24);
  if (rent) { s.today.rev.rent = (s.today.rev.rent || 0) + rent; inc += rent; }
  if (hasMark(s, 'ferris')) {
    const h = hourOf(s);
    const open = h >= 9 && h < 23;
    const t = open ? Math.round(FERRIS_TICKET * (h >= 18 ? 1.3 : 1) * (s.weather.cur === 'rain' ? 0.2 : 1) * seasonOf(s).beach) : 0;
    if (t) { s.today.rev.ferris = (s.today.rev.ferris || 0) + t; inc += t; }
  }
  s.money += inc;
  s.stats.earned += inc;
  return inc;
}
export function lifeDay(s, rand, ev) {
  rivalDay(s, rand, ev);
  newDaily(s);
  if (seasonDay(s) === 1) ev.push({ type: 'season', season: seasonOf(s) });
}

// ───────── 每日目標 ─────────
const openMin = (d) => ((d.close - d.open + 1440) % 1440) || 1440;
const APPEAL = [0, 1, 1.4, 1.85];
function expectVisits(s, id) {
  const d = BIZ_BY_ID[id], lv = s.biz[id].lv;
  const thru = (d.cap[lv - 1] * openMin(d)) / d.stay;
  const dem = d.demand * 0.155 * APPEAL[lv] * openMin(d) * 0.6;
  return Math.min(thru, dem);
}
const avgRev = (s) => {
  const h = s.history.slice(-3);
  return h.length ? h.reduce((t, d) => t + d.rev, 0) / h.length : 0;
};
const round = (v, k) => Math.max(k, Math.round(v / k) * k);
export function newDaily(s) {
  const own = BIZ.filter((b) => s.biz[b.id].lv);
  const tasks = [];
  const avg = avgRev(s);
  const rw = (m = 1) => round(Math.max(8000, avg * 0.03) * m, 1000);
  if (own.length) {
    // 服務某家店 N 位客人（每天換一家；週五晚上優先挑夜店）
    const pool = s.event === 'party' && s.biz.bar.lv ? [BIZ_BY_ID.bar] : own;
    const b = pool[Math.abs(s.day * 7 + s.rng) % pool.length];
    tasks.push({ k: 'visits', id: b.id, goal: Math.max(4, Math.round(expectVisits(s, b.id) * 0.55)), reward: rw() });
    tasks.push({ k: 'rev', goal: round(avg ? avg * 1.04 : 20000, 1000), reward: rw(1.5) });
    if (s.port.lv && s.day % 2 === 0) tasks.push({ k: 'contract', base: s.port.stats.contracts, goal: 1, reward: rw(1.2) });
    else if (own.some((q) => q.zone === 'beach')) tasks.push({ k: 'beach', goal: Math.max(10, Math.round(BEACH_IDS.filter((id) => s.biz[id].lv).reduce((t, id) => t + expectVisits(s, id), 0) * 0.5)), reward: rw() });
    else tasks.push({ k: 'promo', goal: 1, reward: rw(0.8) });
  } else {
    tasks.push({ k: 'open', goal: 1, reward: 10000 });
  }
  s.daily = { day: s.day, tasks };
}
export function dailyProgress(s, t) {
  const tv = s.today.visits;
  switch (t.k) {
    case 'visits': return tv[t.id] || 0;
    case 'rev': { let r = 0; for (const k in s.today.rev) r += s.today.rev[k]; return Math.round(r); }
    case 'beach': return BEACH_IDS.reduce((n, id) => n + (tv[id] || 0), 0);
    case 'promo': return s.today.promos || 0;
    case 'contract': return s.port.stats.contracts - (t.base || 0);
    case 'open': return BIZ.filter((b) => s.biz[b.id].lv).length;
    default: return 0;
  }
}
export function dailyText(t) {
  switch (t.k) {
    case 'visits': return `${BIZ_BY_ID[t.id].name}今天服務 ${t.goal} 位客人`;
    case 'rev': return `今日營收達到 $${t.goal.toLocaleString('en-US')}`;
    case 'beach': return `海灘商家今天共服務 ${t.goal} 位`;
    case 'promo': return '舉辦一次促銷活動';
    case 'contract': return '今天完成一份貨運合約';
    case 'open': return '開第一家店';
    default: return '';
  }
}

// ───────── 成就 ─────────
const allLv3 = (s, ids) => ids.every((id) => s.biz[id].lv >= 3);
export const ACHIEVEMENTS = [
  { id: 'served1k', name: '熟客滿街', desc: '累計服務 1,000 位客人', reward: 30000, ok: (s) => s.stats.served >= 1000 },
  { id: 'served10k', name: '萬人迷', desc: '累計服務 10,000 位客人', reward: 300000, ok: (s) => s.stats.served >= 10000 },
  { id: 'earn1m', name: '第一個百萬', desc: '累計營收 $1M', reward: 50000, ok: (s) => s.stats.earned >= 1e6 },
  { id: 'earn10m', name: '千萬身價', desc: '累計營收 $10M', reward: 400000, ok: (s) => s.stats.earned >= 1e7 },
  { id: 'earn100m', name: '海岸首富', desc: '累計營收 $100M', reward: 3000000, ok: (s) => s.stats.earned >= 1e8 },
  { id: 'tower', name: '三層樓的生意', desc: '同一棟疊樓的三層全部開業', reward: 200000, ok: (s) => STACKS.some((q) => q.floors >= 3 && q.ids.every((id) => s.biz[id].lv)) },
  { id: 'lift', name: '直達頂樓', desc: '把一部電梯升到高速觀景梯', reward: 150000, ok: (s) => Object.values(s.lifts || {}).some((v) => v >= 3) },
  { id: 'city3', name: '大道之王', desc: '城市十家店全部 Lv3', reward: 1500000, ok: (s) => allLv3(s, CITY_IDS) },
  { id: 'beach3', name: '海岸線', desc: '海灘五家店全部 Lv3', reward: 1500000, ok: (s) => allLv3(s, BEACH_IDS) },
  { id: 'landlord', name: '包租公', desc: '擁有 5 棟公寓', reward: 400000, ok: (s) => APTS.filter((a) => aptLv(s, a.key)).length >= 5 },
  { id: 'marks', name: '城市名片', desc: '三座地標全部蓋好', reward: 2000000, ok: (s) => LANDMARKS.every((m) => hasMark(s, m.id)) },
  { id: 'rival1', name: '對街退場', desc: '趕走第一個競爭對手', reward: 120000, ok: (s) => (s.stats.rivals || 0) >= 1 },
  { id: 'rival3', name: '無人能敵', desc: '趕走 3 個競爭對手', reward: 600000, ok: (s) => (s.stats.rivals || 0) >= 3 },
  { id: 'promo10', name: '行銷鬼才', desc: '舉辦 10 次促銷', reward: 100000, ok: (s) => (s.stats.promos || 0) >= 10 },
  { id: 'daily10', name: '每日打卡', desc: '完成 10 個每日目標', reward: 150000, ok: (s) => (s.stats.daily || 0) >= 10 },
  { id: 'rating95', name: '五星好評', desc: '顧客評分達到 95', reward: 200000, ok: (s) => s.rating >= 95 },
  { id: 'year', name: '四季更迭', desc: '經營滿 28 天，走過一整年', reward: 500000, ok: (s) => s.day > SEASONS.length * SEASON_DAYS },
];

// 每次 tick 結尾檢查每日目標與成就，完成就發獎金
export function checkLife(s, ev) {
  if (!s.daily || s.daily.day !== s.day) newDaily(s);
  for (const t of s.daily.tasks) {
    if (t.done || dailyProgress(s, t) < t.goal) continue;
    t.done = true;
    s.money += t.reward;
    s.stats.daily = (s.stats.daily || 0) + 1;
    ev.push({ type: 'daily', text: dailyText(t), reward: t.reward });
  }
  for (const a of ACHIEVEMENTS) {
    if (s.ach[a.id] || !a.ok(s)) continue;
    s.ach[a.id] = s.day;
    s.money += a.reward;
    ev.push({ type: 'ach', name: a.name, desc: a.desc, reward: a.reward });
  }
}

// ───────── 離線收入 ─────────
// 不在的時候由店長代管：真實 7 分鐘約等於遊戲一天，最多結算一天，拿最近幾天平均淨利的一半
export const OFFLINE = { realMinPerDay: 7.2, maxDays: 1, share: 0.5 };
export function offlineEarnings(s, now) {
  if (!s.savedAt || !(now > s.savedAt)) return { amount: 0, minutes: 0 };
  const realMin = (now - s.savedAt) / 60000;
  if (realMin < 1) return { amount: 0, minutes: realMin };
  const h = s.history.slice(-3);
  if (!h.length) return { amount: 0, minutes: realMin };
  const net = h.reduce((t, d) => t + d.rev - d.cost - (d.supply || 0) - (d.port || 0), 0) / h.length;
  const days = Math.min(OFFLINE.maxDays, realMin / OFFLINE.realMinPerDay);
  return { amount: Math.max(0, Math.round(net * days * OFFLINE.share)), minutes: realMin, days };
}

// ───────── 存檔 ─────────
export function newLife() {
  return { lifts: {}, order: {}, apts: {}, marks: {}, rival: null, rivalNext: 0, ach: {}, daily: null, savedAt: 0 };
}
export function sanitizeLife(raw, s) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const keys = new Set(STACKS.map((q) => q.key));
  for (const [k, v] of Object.entries(r.lifts || {})) if (keys.has(k)) s.lifts[k] = Math.max(1, Math.min(3, Math.round(num(v, 1))));
  for (const [k, v] of Object.entries(r.order || {})) {
    const st = STACKS.find((q) => q.key === k);
    if (st && Array.isArray(v) && v.length === st.ids.length && st.ids.every((id) => v.includes(id))) s.order[k] = v.slice();
  }
  for (const [k, v] of Object.entries(r.apts || {})) if (APT_BY_KEY[k]) s.apts[k] = Math.max(0, Math.min(2, Math.round(num(v, 0))));
  for (const [k, v] of Object.entries(r.marks || {})) if (LANDMARK_BY_ID[k]) s.marks[k] = Math.max(1, Math.round(num(v, 1)));
  for (const [k, v] of Object.entries(r.ach || {})) if (ACHIEVEMENTS.some((a) => a.id === k)) s.ach[k] = Math.round(num(v, 1));
  const rv = r.rival;
  if (rv && typeof rv === 'object' && CITY_LOTS[rv.id] && APT_BY_KEY[rv.lot] && !s.apts[rv.lot]) {
    s.rival = { id: rv.id, name: RIVAL_NAMES[rv.id], lot: rv.lot, power: Math.max(0, Math.min(RIVAL.max, num(rv.power, RIVAL.start))), since: Math.round(num(rv.since, s.day)) };
  }
  s.rivalNext = Math.round(num(r.rivalNext, 0));
  if (r.daily && r.daily.day === s.day && Array.isArray(r.daily.tasks)) {
    const tasks = r.daily.tasks.filter((t) => t && typeof t.k === 'string' && typeof t.goal === 'number' && (t.k !== 'visits' || BIZ_BY_ID[t.id]));
    s.daily = { day: s.day, tasks: tasks.map((t) => ({ k: t.k, id: t.id, base: num(t.base, 0), goal: t.goal, reward: num(t.reward, 8000), done: !!t.done })) };
  }
  s.savedAt = num(r.savedAt, 0);
}
