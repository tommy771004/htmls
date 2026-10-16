// 經濟系統：時間推進、工資、天氣、每日結算、購買升級、收入、任務與存檔遷移。
// 純資料，不碰 DOM／three；畫面層呼叫 tick() 推進、arrivalPerMin() 決定生客、serve() 收錢。
import { BIZ, BIZ_BY_ID, CURVES, WEATHER, WEATHER_NEXT, EVENTS, QUESTS, LEVEL_AT, FIRST_BEACH_QUEST, PORT } from './data.js';
import { newPort, sanitizePort, supplyCost, portStep, portHour } from './port.js';

export const SAVE_VERSION = 3;
export const START_MONEY = 250000;
export const SAVE_KEY = 'bayfront-empire';

export function rand(s) {
  // mulberry32，狀態存在 s.rng，讀檔後可延續同一條序列
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// cost 是工資；supply 供應成本；freight／storage／spoil 是海港的運費、倉儲費與生鮮耗損；saved 是走港口省下的錢
const DAY_NUM = ['cost', 'buy', 'supply', 'saved', 'freight', 'storage', 'spoil', 'viaPort'];
const blankDay = () => ({ rev: {}, visits: {}, turned: {}, cost: 0, buy: 0, supply: 0, saved: 0, freight: 0, storage: 0, spoil: 0, viaPort: 0 });

export function newState(seed = 20261016) {
  const s = {
    v: SAVE_VERSION, seed: seed | 0, rng: seed | 0,
    day: 1, minute: 8 * 60 + 30, money: START_MONEY, rating: 74,
    biz: {}, quest: 0, history: [], today: blankDay(), port: newPort(),
    weather: { cur: 'sunny', until: 12 * 60 },
    event: null,
    stats: { earned: 0, served: 0, turned: 0, invested: 0 },
    opts: { sound: true, quality: 'auto' },
    notice: null,
  };
  for (const b of BIZ) s.biz[b.id] = { lv: 0, earned: 0, visits: 0 };
  rollEvent(s);
  return s;
}

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int = (v, d, lo = -Infinity, hi = Infinity) => Math.max(lo, Math.min(hi, Math.round(num(v, d))));

// 讀檔：v1 是海灘改版前的格式（cash／time／shops{id: 等級}），v2 是海灘改版（沒有海港），v3 是現行格式。
// 任何缺欄位、未知商家或壞資料都退回預設值，不丟例外。
export function migrate(raw) {
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { raw = null; }
  }
  const s = newState(raw && typeof raw === 'object' ? int(raw.seed, 20261016) : 20261016);
  if (!raw || typeof raw !== 'object') return s;

  if (raw.v === 1 || (raw.v === undefined && raw.shops)) {
    s.money = num(raw.cash, s.money);
    s.day = int(raw.day, 1, 1);
    s.minute = int(raw.time, s.minute, 0, 1439);
    s.rating = int(raw.rating, s.rating, 0, 100);
    for (const [id, lv] of Object.entries(raw.shops || {})) {
      if (BIZ_BY_ID[id] && BIZ_BY_ID[id].zone === 'city') s.biz[id].lv = int(lv, 0, 0, 3);
    }
    s.stats.earned = num(raw.earnedTotal, 0);
    // 改版前只有城市任務（0–3）；做完的玩家直接接到海灘改版第一個任務
    s.quest = int(raw.quest, 0, 0, FIRST_BEACH_QUEST);
    s.rng = int(raw.seed, s.rng);
    s.migratedFrom = 1;
    s.notice = 'beach-update';
  } else {
    s.money = num(raw.money, s.money);
    s.day = int(raw.day, 1, 1);
    s.minute = int(raw.minute, s.minute, 0, 1439);
    s.rating = num(raw.rating, s.rating);
    s.rng = int(raw.rng, s.rng);
    s.quest = int(raw.quest, 0, 0, QUESTS.length);
    if (raw.biz && typeof raw.biz === 'object') {
      for (const id of Object.keys(s.biz)) {
        const b = raw.biz[id];
        if (!b || typeof b !== 'object') continue;
        s.biz[id] = { lv: int(b.lv, 0, 0, 3), earned: num(b.earned, 0), visits: int(b.visits, 0, 0) };
      }
    }
    if (Array.isArray(raw.history)) s.history = raw.history.filter((h) => h && typeof h.day === 'number').slice(-7);
    if (raw.today && typeof raw.today === 'object') {
      for (const k of ['rev', 'visits', 'turned']) {
        if (raw.today[k] && typeof raw.today[k] === 'object') {
          for (const id of [...Object.keys(s.biz), 'port']) if (typeof raw.today[k][id] === 'number') s.today[k][id] = raw.today[k][id];
        }
      }
      for (const k of DAY_NUM) s.today[k] = num(raw.today[k], 0);
    }
    if (raw.weather && WEATHER[raw.weather.cur]) s.weather = { cur: raw.weather.cur, until: int(raw.weather.until, s.minute + 120, 0, 1440 * 2) };
    if (raw.event === null || (raw.event && EVENTS[raw.event])) s.event = raw.event;
    if (raw.stats && typeof raw.stats === 'object') {
      for (const k of Object.keys(s.stats)) s.stats[k] = num(raw.stats[k], 0);
    }
    s.port = sanitizePort(raw.port);
    // v2 存檔沒有海港：供應成本從讀檔後開始計，顯示物流改版公告
    if (raw.v === 2) { s.migratedFrom = 2; s.notice = 'port-update'; }
    if (raw.opts && typeof raw.opts === 'object') {
      s.opts.sound = raw.opts.sound !== false;
      if (['auto', 'low', 'high'].includes(raw.opts.quality)) s.opts.quality = raw.opts.quality;
    }
  }
  s.stats.invested = investedOf(s);
  return s;
}

export function serialize(s) {
  const { notice, migratedFrom, ...rest } = s;
  return JSON.stringify(rest);
}

export function investedOf(s) {
  let t = 0;
  for (const b of BIZ) {
    const lv = s.biz[b.id].lv;
    if (lv >= 1) t += b.cost;
    if (lv >= 2) t += b.up[0];
    if (lv >= 3) t += b.up[1];
  }
  const pl = s.port ? s.port.lv : 0;
  if (pl >= 1) t += PORT.cost;
  if (pl >= 2) t += PORT.up[0];
  if (pl >= 3) t += PORT.up[1];
  return t;
}

export function empireLevel(s) {
  let lv = 1;
  for (let i = 0; i < LEVEL_AT.length; i++) if (s.stats.invested >= LEVEL_AT[i]) lv = i + 1;
  return lv;
}

export function isOpen(def, minute) {
  const m = ((minute % 1440) + 1440) % 1440;
  if (def.close > def.open) return m >= def.open && m < def.close;
  return m >= def.open || m < def.close; // 跨午夜（酒吧）
}

export function curveAt(name, minute) {
  const c = CURVES[name];
  const h = (minute / 60) % 24;
  const i = Math.floor(h), f = h - i;
  return c[i] * (1 - f) + c[(i + 1) % 24] * f;
}

const APPEAL = [0, 1, 1.4, 1.85];

export function eventMult(s, def) {
  const e = s.event && EVENTS[s.event];
  return e && e.zone === def.zone ? e.mult : 1;
}

export function ratingMult(s) { return 0.7 + 0.6 * (s.rating / 100); }

// 這家店此刻每遊戲分鐘的期望來客數（未扣容量）
export function arrivalPerMin(s, id) {
  const def = BIZ_BY_ID[id], st = s.biz[id];
  if (!st.lv || !isOpen(def, s.minute)) return 0;
  return def.demand * 0.155 * APPEAL[st.lv] * curveAt(def.curve, s.minute) * WEATHER[s.weather.cur].mult[def.kind] * ratingMult(s) * eventMult(s, def);
}

// 海灘閒逛人潮（不消費的泳客、散步的人），畫面層用來決定沙灘熱鬧程度
export function beachCrowd(s) {
  const e = s.event && EVENTS[s.event];
  return curveAt('beach', s.minute) * WEATHER[s.weather.cur].beach * (e && e.zone === 'beach' ? e.mult : 1);
}

export const priceOf = (s, id) => BIZ_BY_ID[id].price[Math.max(0, s.biz[id].lv - 1)];
export const capOf = (s, id) => BIZ_BY_ID[id].cap[Math.max(0, s.biz[id].lv - 1)];
export const wageOf = (s, id) => (s.biz[id].lv ? BIZ_BY_ID[id].wage[s.biz[id].lv - 1] : 0);

export function nextCost(s, id) {
  const def = BIZ_BY_ID[id], lv = s.biz[id].lv;
  if (lv === 0) return def.cost;
  if (lv < 3) return def.up[lv - 1];
  return null;
}

export function canAfford(s, id) {
  const c = nextCost(s, id);
  return c !== null && s.money >= c;
}

// 買下（lv 0→1）或升級（→2、→3）。成功回傳新等級
export function buyOrUpgrade(s, id) {
  const c = nextCost(s, id);
  if (c === null || s.money < c) return 0;
  s.money -= c;
  s.today.buy += c;
  s.biz[id].lv += 1;
  s.stats.invested = investedOf(s);
  return s.biz[id].lv;
}

// 客人開始消費。回傳收入金額（供應成本另外扣，記在 today.supply）
export function serve(s, id) {
  const amt = priceOf(s, id);
  const sc = supplyCost(s, BIZ_BY_ID[id], amt);
  s.money += amt - sc;
  s.today.supply += sc;
  s.today.rev[id] = (s.today.rev[id] || 0) + amt;
  s.today.visits[id] = (s.today.visits[id] || 0) + 1;
  s.biz[id].earned += amt;
  s.biz[id].visits += 1;
  s.stats.earned += amt;
  s.stats.served += 1;
  s.rating = Math.min(100, s.rating + (100 - s.rating) * 0.012);
  return amt;
}

// 客滿或打烊被拒於門外
export function turnAway(s, id) {
  s.today.turned[id] = (s.today.turned[id] || 0) + 1;
  s.stats.turned += 1;
  s.rating = Math.max(20, s.rating - 0.9);
}

// 今日營運成本：工資＋供應＋海港運費、倉儲、耗損
export function todayCosts(s) {
  const t = s.today;
  return t.cost + t.supply + t.freight + t.storage + t.spoil;
}

export function todayRevenue(s) {
  let t = 0;
  for (const k in s.today.rev) t += s.today.rev[k];
  return t;
}

function pickWeighted(s, table) {
  let r = rand(s), last = null;
  for (const [k, p] of Object.entries(table)) {
    last = k;
    if ((r -= p) <= 0) return k;
  }
  return last;
}

function rollWeather(s) {
  const h = (s.minute / 60) % 24;
  let next = pickWeighted(s, WEATHER_NEXT[s.weather.cur]);
  if (next === 'heat' && (h < 9 || h > 15)) next = 'sunny';
  s.weather.cur = next;
  s.weather.until = s.minute + 120 + Math.floor(rand(s) * 4) * 60;
}

function rollEvent(s) {
  const dow = s.day % 7;
  if (dow === 6 || dow === 0) s.event = 'weekend';
  else {
    const r = rand(s);
    s.event = r < 0.2 ? 'market' : r < 0.32 ? 'festival' : null;
  }
}

// 推進 dMin 遊戲分鐘。回傳這段時間發生的事件
export function tick(s, dMin) {
  const ev = [];
  let left = dMin;
  while (left > 0) {
    const toHour = 60 - (s.minute % 60);
    let step;
    if (left >= toHour - 1e-9) {
      // 跨整點：把分鐘數對齊整數，避免浮點誤差讓整點事件重複或漏掉
      step = toHour;
      s.minute = Math.round(s.minute + toHour);
      left -= toHour;
      onHour(s, ev);
    } else {
      step = left;
      s.minute += left;
      left = 0;
    }
    portStep(s, step, rand, ev, s.weather.cur);
    if (s.minute >= 1440) {
      s.minute -= 1440;
      if (s.weather.until >= 1440) s.weather.until -= 1440;
      onDay(s, ev);
    }
    if (s.minute >= s.weather.until) {
      const was = s.weather.cur;
      rollWeather(s);
      if (s.weather.cur !== was) ev.push({ type: 'weather', from: was, to: s.weather.cur });
    }
  }
  const q = checkQuest(s);
  if (q) ev.push(q);
  return ev;
}

function onHour(s, ev) {
  let cost = 0;
  for (const b of BIZ) cost += wageOf(s, b.id) / 24;
  if (s.port.lv) cost += PORT.wage[s.port.lv - 1] / 24;
  cost = Math.round(cost);
  portHour(s);
  if (cost) {
    s.money -= cost;
    s.today.cost += cost;
    ev.push({ type: 'wage', amount: cost });
  }
}

function onDay(s, ev) {
  const rev = todayRevenue(s);
  const t = s.today;
  s.history.push({ day: s.day, rev, cost: t.cost, supply: Math.round(t.supply), port: Math.round(t.freight + t.storage + t.spoil), saved: Math.round(t.saved), buy: t.buy, visits: Object.values(t.visits).reduce((a, b) => a + b, 0) });
  if (s.history.length > 7) s.history.shift();
  ev.push({ type: 'day', day: s.day, rev, cost: todayCosts(s) });
  s.day += 1;
  s.today = blankDay();
  rollEvent(s);
  if (s.event) ev.push({ type: 'event', id: s.event });
}

export function questProgress(s) {
  const q = QUESTS[s.quest];
  if (!q) return null;
  const [cur, goal] = q.goal(s);
  return { q, cur: Math.min(cur, goal), goal, index: s.quest };
}

export function checkQuest(s) {
  const p = questProgress(s);
  if (!p || p.cur < p.goal) return null;
  s.money += p.q.reward;
  s.quest += 1;
  return { type: 'quest', title: p.q.title, reward: p.q.reward };
}
