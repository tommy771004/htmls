// 在 Node 跑經濟模擬，檢查節奏：node tools/sim.mjs [天數] [策略 greedy|city]
// 以排隊模型近似畫面層：每分鐘依 arrivalPerMin 抽來客，容量滿就拒客，停留 stay 分鐘後離開。
import { newState, tick, arrivalPerMin, capOf, serve, turnAway, buyOrUpgrade, nextCost, todayRevenue, empireLevel, rand } from '../src/econ.js';
import { buyPort, portNextCost, placeBid } from '../src/port.js';
import { BIZ, BIZ_BY_ID, QUESTS } from '../src/data.js';

export function simulate(days = 10, strategy = 'greedy', seed = 7) {
  const s = newState(seed);
  const busy = Object.fromEntries(BIZ.map((b) => [b.id, []]));
  let r = seed;
  const rnd = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
  const log = [];
  const order = strategy === 'city' ? BIZ.filter((b) => b.zone === 'city') : BIZ;
  for (let m = 0; m < days * 1440; m++) {
    // 每小時看一次能不能買／升級（保留一天工資當預備金）
    if (m % 60 === 0) {
      let did = true;
      while (did) {
        did = false;
        const tg = QUESTS[s.quest] && QUESTS[s.quest].target;
        if (s.port.lv) for (const o of [...s.port.offers]) placeBid(s, rand, o.id, Math.round(o.guide * 0.85));
        if (s.quest >= 8 && strategy !== 'city') {
          const c = portNextCost(s);
          if (c !== null && s.port.lv < 3 && s.money - c > 60000 && buyPort(s)) { did = true; continue; }
          if (!s.port.lv) break; // 先存錢買海港
        }
        if (tg === 'port') {
          const c = portNextCost(s);
          if (c !== null && (!s.port.lv || s.quest >= 14) && s.money - c > 60000 && buyPort(s)) { did = true; continue; }
        } else if (tg && !s.biz[tg].lv) { if (s.money - nextCost(s, tg) > 30000 && buyOrUpgrade(s, tg)) { did = true; continue; } if (strategy !== 'city') break; }
        const cand = order.map((b) => ({ id: b.id, c: nextCost(s, b.id) })).filter((x) => x.c !== null && s.money - x.c > 30000).sort((a, b) => a.c - b.c);
        if (cand.length && buyOrUpgrade(s, cand[0].id)) did = true;
      }
    }
    for (const b of BIZ) {
      const q = busy[b.id];
      while (q.length && q[0] <= m) q.shift();
      let lam = arrivalPerMin(s, b.id);
      while (lam > 0) {
        if (rnd() < Math.min(1, lam)) {
          if (q.length < capOf(s, b.id)) { serve(s, b.id); q.push(m + b.stay); q.sort((a, c) => a - c); }
          else turnAway(s, b.id);
        }
        lam -= 1;
      }
    }
    for (const e of tick(s, 1)) {
      if (e.type === 'day') log.push({ day: e.day, rev: e.rev, cost: e.cost, money: Math.round(s.money), supply: Math.round(e.cost), saved: s.history.at(-1)?.saved, prev: e.rev && s.history.at(-1), stock: JSON.stringify(Object.fromEntries(Object.entries(s.port.stock).map(([k,v])=>[k,Math.round(v)]))), pc: s.port.stats.contracts, port: s.port.lv, owned: BIZ.filter((b) => s.biz[b.id].lv).map((b) => b.id + s.biz[b.id].lv).join(' '), quest: s.quest, lvl: empireLevel(s), rating: Math.round(s.rating) });
    }
  }
  return { s, log };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { log, s } = simulate(+(process.argv[2] || 10), process.argv[3] || 'greedy');
  for (const l of log) console.log(`D${l.day} 營收 ${l.rev} 成本 ${Math.round(l.cost)} 省 ${l.saved} 港Lv${l.port} 合約${l.pc} 庫存${l.stock} 資金 ${l.money} 任務 ${l.quest}/${QUESTS.length} Lv${l.lvl} 評分 ${l.rating} | ${l.owned}`);
  console.log('拒客', s.stats.turned, '服務', s.stats.served);
}
