// 物流與海港（純資料）：倉庫庫存、補貨點與補給船、船期與天候延誤、泊位與岸橋卸貨、
// 物流車配送上限、倉儲費與生鮮耗損、貨運合約投標與逾期罰款。由 econ.js 的 tick／serve 呼叫。
import { PORT, CARGO, CARGO_IDS, SHIP_NAMES, CLIENTS } from './data.js';

export const absMin = (s) => (s.day - 1) * 1440 + s.minute;

export function newPort() {
  return {
    lv: 0,
    stock: { food: 0, goods: 0, fuel: 0 },
    reorder: { food: 360, goods: 240, fuel: 120 },
    ships: [],
    offers: [],
    truckUsed: 0,
    nextShip: 1,
    nextOffer: 0,
    offerAt: 0,
    stats: { contracts: 0, late: 0, containers: 0, ships: 0 },
  };
}

// 讀檔時把任何形狀的 port 資料修成合法狀態
export function sanitizePort(raw) {
  const p = newPort();
  if (!raw || typeof raw !== 'object') return p;
  const n = (v, d, lo = 0, hi = Infinity) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
  p.lv = Math.round(n(raw.lv, 0, 0, 3));
  for (const c of CARGO_IDS) {
    if (raw.stock) p.stock[c] = n(raw.stock[c], 0);
    if (raw.reorder) p.reorder[c] = Math.round(n(raw.reorder[c], p.reorder[c], 0, 3000));
  }
  if (Array.isArray(raw.ships)) {
    p.ships = raw.ships.filter((q) => q && typeof q.id === 'number' && typeof q.eta === 'number' && q.cargo && typeof q.total === 'number').slice(0, 12).map((q) => ({
      id: q.id, name: String(q.name || '貨輪'), kind: q.kind === 'contract' ? 'contract' : 'supply', cargo: q.cargo, total: n(q.total, 0), done: n(q.done, 0),
      eta: q.eta, state: ['inbound', 'waiting', 'berthing', 'unloading', 'departed'].includes(q.state) ? q.state : 'inbound',
      t: n(q.t, 0, -1e9, 1e12), berth: Math.round(n(q.berth, -1, -1, 2)), delayed: !!q.delayed, client: q.client ? String(q.client) : null,
      bid: n(q.bid, 0), deadline: n(q.deadline, 0, -1e9, 1e12), paid: !!q.paid,
      doneBy: q.doneBy && typeof q.doneBy === 'object' ? { ...q.doneBy } : undefined,
    }));
  }
  if (Array.isArray(raw.offers)) p.offers = raw.offers.filter((o) => o && typeof o.id === 'number' && typeof o.guide === 'number').slice(0, 4);
  p.nextShip = Math.round(n(raw.nextShip, 1, 1));
  p.nextOffer = Math.round(n(raw.nextOffer, 0));
  p.offerAt = n(raw.offerAt, 0, -1e9, 1e12);
  if (raw.stats) for (const k of Object.keys(p.stats)) p.stats[k] = n(raw.stats[k], 0);
  return p;
}

export const portVal = (s, key) => (s.port.lv ? PORT[key][s.port.lv - 1] : 0);
export const truckCap = (s) => portVal(s, 'trucks') * PORT.truckUnits;
export const inbound = (s, c) => s.port.ships.filter((q) => q.kind === 'supply' && q.state !== 'departed').reduce((t, q) => t + ((q.cargo[c] || 0) - (q.doneBy?.[c] || 0)) * PORT.container, 0);

// 每位客人消費時呼叫：回傳這次的供應成本，並記錄是否走港口
export function supplyCost(s, def, price) {
  const retail = price * def.supply;
  const p = s.port;
  if (p.lv && p.stock[def.cargo] >= 1 && p.truckUsed < truckCap(s)) {
    p.stock[def.cargo] -= 1;
    p.truckUsed += 1;
    const disc = PORT.disc[p.lv - 1];
    s.today.saved = (s.today.saved || 0) + retail * disc;
    s.today.viaPort = (s.today.viaPort || 0) + 1;
    return retail * (1 - disc);
  }
  return retail;
}

function addCost(s, key, v) {
  if (!v) return;
  s.money -= v;
  s.today[key] = (s.today[key] || 0) + v;
}

function shipName(s) {
  const p = s.port;
  return SHIP_NAMES[(p.nextShip * 7) % SHIP_NAMES.length];
}

// 庫存加上在途量低於補貨點就叫一艘補給船，一次補到補貨點的 2.5 倍
function maybeOrder(s, rand, ev) {
  const p = s.port;
  if (!p.lv) return;
  if (p.ships.some((q) => q.kind === 'supply' && (q.state === 'inbound' || q.state === 'waiting'))) return;
  const cargo = {};
  let total = 0;
  for (const c of CARGO_IDS) {
    if (p.stock[c] + inbound(s, c) >= p.reorder[c]) continue;
    const need = p.reorder[c] * 2.5 - p.stock[c] - inbound(s, c);
    const k = Math.max(1, Math.min(14, Math.ceil(need / PORT.container)));
    cargo[c] = k;
    total += k;
  }
  if (!total) return;
  const now = absMin(s);
  const q = { id: p.nextShip++, name: shipName(s), kind: 'supply', cargo, total, done: 0, eta: now + 120 + Math.floor(rand(s) * 150), state: 'inbound', t: now, berth: -1, delayed: false, client: null, bid: 0, deadline: 0, paid: false };
  p.ships.push(q);
  addCost(s, 'freight', PORT.freight + PORT.freightPer * total);
  ev.push({ type: 'port', msg: `已向批發商下單：${q.name} 載 ${total} 櫃補給，約 ${Math.round((q.eta - now) / 60)} 小時後到港`, ic: 'anchor' });
}

function makeOffer(s, rand) {
  const p = s.port;
  const [client, goods] = CLIENTS[Math.floor(rand(s) * CLIENTS.length)];
  const lv = p.lv;
  const containers = 4 + Math.floor(rand(s) * (5 + lv * 5));
  const guide = Math.round((4500 + rand(s) * 3500) * (1 + 0.12 * (lv - 1)) / 100) * 100;
  const now = absMin(s);
  const arrive = 60 + Math.floor(rand(s) * 180);
  return {
    id: p.nextOffer++, client, goods, containers, guide,
    arrive, deadlineH: Math.round(arrive / 60 + containers / (PORT.craneRate * Math.max(1, lv)) + 6 + rand(s) * 10),
    expires: now + 360 + Math.floor(rand(s) * 240), name: SHIP_NAMES[(p.nextOffer * 5 + 3) % SHIP_NAMES.length],
  };
}

// 出價與得標機率：出價越接近指導價的 60%，越容易得標
export function winChance(s, offer, bid) {
  const r = bid / offer.guide;
  const rep = (s.rating - 70) / 300;
  return Math.max(0.04, Math.min(0.96, 1.02 - (r - 0.6) * 1.15 + rep));
}

export function placeBid(s, rand, offerId, bid) {
  const p = s.port;
  const i = p.offers.findIndex((o) => o.id === offerId);
  if (i < 0 || !p.lv) return null;
  const o = p.offers[i];
  p.offers.splice(i, 1);
  const chance = winChance(s, o, bid);
  const won = rand(s) < chance;
  if (!won) return { won, offer: o, chance };
  const now = absMin(s);
  const q = { id: p.nextShip++, name: o.name, kind: 'contract', cargo: { contract: o.containers }, total: o.containers, done: 0, eta: now + o.arrive, state: 'inbound', t: now, berth: -1, delayed: false, client: o.client, bid, deadline: now + o.deadlineH * 60, paid: false };
  p.ships.push(q);
  return { won, offer: o, chance, ship: q };
}

export function setReorder(s, cargo, v) {
  if (!CARGO[cargo]) return;
  s.port.reorder[cargo] = Math.max(0, Math.min(3000, Math.round(v / 30) * 30));
}

// 每遊戲分鐘推進：船期、靠泊、卸貨、合約結算、報價
export function portStep(s, dMin, rand, ev, weather) {
  const p = s.port;
  if (!p.lv) return;
  const now = absMin(s);
  maybeOrder(s, rand, ev);
  // 報價：每 5–8 小時一份，最多 3 份；過期移除
  p.offers = p.offers.filter((o) => o.expires > now);
  if (now >= p.offerAt && p.offers.length < 3) {
    p.offers.push(makeOffer(s, rand));
    p.offerAt = now + 300 + Math.floor(rand(s) * 180);
  }
  const berths = PORT.berths[p.lv - 1];
  const busy = new Set(p.ships.filter((q) => q.state === 'berthing' || q.state === 'unloading').map((q) => q.berth));
  const unloading = p.ships.filter((q) => q.state === 'unloading');
  const perShip = unloading.length ? (PORT.cranes[p.lv - 1] * PORT.craneRate) / Math.max(unloading.length, 1) / 60 : 0;
  for (const q of p.ships) {
    if (q.state === 'inbound') {
      // 下雨時航行中的船有機會延誤
      if (weather === 'rain' && !q.delayed && q.eta - now > 30 && rand(s) < dMin * 0.004) {
        const d = 60 + Math.floor(rand(s) * 3) * 60;
        q.eta += d;
        q.delayed = true;
        ev.push({ type: 'port', msg: `${q.name} 因風浪延誤 ${d / 60} 小時${q.kind === 'contract' ? '，交期照算' : ''}`, ic: 'rain', tone: 'warn' });
      }
      if (now >= q.eta) { q.state = 'waiting'; q.t = now; }
    }
    if (q.state === 'waiting') {
      for (let b = 0; b < berths; b++) {
        if (!busy.has(b)) {
          busy.add(b);
          q.berth = b;
          q.state = 'berthing';
          q.t = now;
          ev.push({ type: 'port', msg: `${q.name} 抵達錨地，載 ${q.total} 櫃${q.client ? `（${q.client}）` : '補給'}，準備靠泊`, ic: 'anchor' });
          break;
        }
      }
    } else if (q.state === 'berthing') {
      if (now - q.t >= 40) { q.state = 'unloading'; q.t = now; }
    } else if (q.state === 'unloading') {
      const before = Math.floor(q.done);
      q.done = Math.min(q.total, q.done + perShip * dMin);
      const whole = Math.floor(q.done);
      if (q.kind === 'supply' && whole > before) {
        // 依貨單順序把卸下的櫃子入庫
        q.doneBy = q.doneBy || {};
        let n = whole - before;
        for (const c of CARGO_IDS) {
          while (n > 0 && (q.doneBy[c] || 0) < (q.cargo[c] || 0)) {
            q.doneBy[c] = (q.doneBy[c] || 0) + 1;
            p.stock[c] += PORT.container;
            n--;
          }
        }
        p.stats.containers += whole - before;
      }
      if (q.done >= q.total) {
        q.state = 'departed';
        q.t = now;
        p.stats.ships++;
        if (q.kind === 'contract') {
          const late = Math.max(0, now - q.deadline);
          const pen = Math.min(0.5, 0.15 * Math.ceil(late / 60));
          const pay = Math.round(q.total * q.bid * (1 - pen));
          s.money += pay;
          s.today.rev.port = (s.today.rev.port || 0) + pay;
          s.stats.earned += pay;
          p.stats.contracts++;
          p.stats.containers += q.total;
          if (pen) { p.stats.late++; s.rating = Math.max(20, s.rating - 4); }
          q.paid = true;
          ev.push({ type: 'contract', name: q.name, client: q.client, pay, late: pen > 0, pen, hours: Math.ceil(late / 60) });
        } else {
          ev.push({ type: 'port', msg: `${q.name} 卸貨完成，${q.total} 櫃入庫`, ic: 'check' });
        }
      }
    }
  }
  // 離港兩小時後從清單移除
  p.ships = p.ships.filter((q) => q.state !== 'departed' || now - q.t < 120);
}

// 每整點：倉儲費、生鮮耗損、物流車額度重置
export function portHour(s) {
  const p = s.port;
  p.truckUsed = 0;
  if (!p.lv) return 0;
  let units = 0;
  for (const c of CARGO_IDS) units += p.stock[c];
  const fee = Math.round((units * PORT.storage) / 24);
  addCost(s, 'storage', fee);
  const rate = PORT.spoil[p.lv - 1] / 24;
  const lost = p.stock.food * rate;
  p.stock.food -= lost;
  const spoilCost = Math.round(lost * CARGO.food.unit);
  addCost(s, 'spoil', spoilCost);
  return fee + spoilCost;
}

export function portNextCost(s) {
  const lv = s.port.lv;
  if (lv === 0) return PORT.cost;
  if (lv < 3) return PORT.up[lv - 1];
  return null;
}

export function buyPort(s) {
  const c = portNextCost(s);
  if (c === null || s.money < c) return 0;
  s.money -= c;
  s.today.buy += c;
  s.port.lv += 1;
  if (s.port.lv === 1) s.port.offerAt = absMin(s) + 60;
  return s.port.lv;
}

// 給畫面用的船隻狀態文字
export function shipStatus(q, now) {
  if (q.state === 'inbound') return `入港中 · ${Math.max(0, Math.ceil((q.eta - now) / 60))} 小時`;
  if (q.state === 'waiting') return '錨地等泊位';
  if (q.state === 'berthing') return '靠泊中';
  if (q.state === 'unloading') return `卸貨 ${Math.floor((q.done / q.total) * 100)}%`;
  return '已離港';
}
