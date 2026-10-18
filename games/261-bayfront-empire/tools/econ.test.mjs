// 經濟與存檔遷移測試：node --test tools/econ.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newState, migrate, serialize, tick, buyOrUpgrade, serve, isOpen, arrivalPerMin, questProgress, SAVE_VERSION } from '../src/econ.js';
import { BIZ, BIZ_BY_ID, BEACH_IDS, FIRST_BEACH_QUEST } from '../src/data.js';
import { simulate } from './sim.mjs';

test('v1 存檔（海灘改版前）遷移後保留城市進度，海灘商家為未開設', () => {
  const v1 = { v: 1, cash: 523400, day: 9, time: 13 * 60 + 5, shops: { cafe: 2, burger: 1, gym: 3, ghost: 2 }, earnedTotal: 812000, quest: 4, rating: 81 };
  const s = migrate(JSON.stringify(v1));
  assert.equal(s.v, SAVE_VERSION);
  assert.equal(s.money, 523400);
  assert.equal(s.day, 9);
  assert.equal(s.minute, 13 * 60 + 5);
  assert.equal(s.biz.cafe.lv, 2);
  assert.equal(s.biz.burger.lv, 1);
  assert.equal(s.biz.gym.lv, 3);
  assert.equal(s.biz.ghost, undefined);
  for (const id of BEACH_IDS) assert.equal(s.biz[id].lv, 0);
  assert.equal(s.quest, FIRST_BEACH_QUEST);
  assert.equal(s.notice, 'beach-update');
  assert.equal(s.stats.invested, BIZ_BY_ID.cafe.cost + BIZ_BY_ID.cafe.up[0] + BIZ_BY_ID.burger.cost + BIZ_BY_ID.gym.cost + BIZ_BY_ID.gym.up[0] + BIZ_BY_ID.gym.up[1]);
});

test('v1 存檔不能藉遷移把海灘商家塞進來', () => {
  const s = migrate({ v: 1, cash: 1, shops: { boat: 3, snack: 2 } });
  assert.equal(s.biz.boat.lv, 0);
  assert.equal(s.biz.snack.lv, 0);
});

test('v2 存檔來回序列化不失真', () => {
  const s = newState(42);
  s.money = 9e6;
  buyOrUpgrade(s, 'cafe');
  buyOrUpgrade(s, 'boat');
  serve(s, 'boat');
  tick(s, 300);
  const back = migrate(serialize(s));
  assert.equal(back.money, s.money);
  assert.equal(back.biz.boat.lv, 1);
  assert.equal(back.biz.boat.earned, BIZ_BY_ID.boat.price[0]);
  assert.equal(back.minute, s.minute);
  assert.equal(back.rng, s.rng);
  assert.deepEqual(back.today.rev, s.today.rev);
});

test('壞資料與未知欄位不丟例外', () => {
  for (const raw of [null, '', '{', '[]', 42, { v: 2, biz: 'x', money: 'lots', minute: 99999 }, { v: 99, biz: { cafe: { lv: 7 } } }]) {
    const s = migrate(raw);
    assert.ok(Number.isFinite(s.money));
    assert.ok(s.minute >= 0 && s.minute < 1440);
    for (const b of BIZ) assert.ok(s.biz[b.id].lv >= 0 && s.biz[b.id].lv <= 3);
  }
});

test('跨午夜營業（酒吧）與海灘夜間打烊', () => {
  assert.ok(isOpen(BIZ_BY_ID.bar, 23 * 60));
  assert.ok(isOpen(BIZ_BY_ID.bar, 60));
  assert.ok(!isOpen(BIZ_BY_ID.bar, 12 * 60));
  const s = newState(1);
  s.money = 1e7;
  buyOrUpgrade(s, 'boat');
  s.minute = 22 * 60;
  assert.equal(arrivalPerMin(s, 'boat'), 0);
  s.minute = 13 * 60;
  assert.ok(arrivalPerMin(s, 'boat') > 0);
  s.weather.cur = 'rain';
  const rainy = arrivalPerMin(s, 'boat');
  s.weather.cur = 'heat';
  assert.ok(arrivalPerMin(s, 'boat') > rainy * 10);
});

test('跨日結算、工資與任務獎勵', () => {
  const s = newState(3);
  const m0 = s.money;
  assert.equal(questProgress(s).index, 0);
  buyOrUpgrade(s, 'cafe');
  const ev = tick(s, 1440);
  assert.ok(ev.some((e) => e.type === 'quest'));
  assert.ok(ev.some((e) => e.type === 'day'));
  assert.equal(s.day, 2);
  assert.equal(s.history.length, 1);
  assert.ok(s.history[0].cost > 0);
  assert.ok(s.money < m0); // 只付工資沒有客人
});

test('模擬 16 天：開到海灘商家與海港、接到合約、資金為正', () => {
  const { s, log } = simulate(16, 'greedy', 11);
  assert.ok(s.money > 0, '資金為正');
  assert.ok(BEACH_IDS.some((id) => s.biz[id].lv > 0), '開了海灘商家');
  assert.ok(s.port.lv > 0, '開了海港');
  assert.ok(s.port.stats.contracts > 0, '完成合約');
  assert.ok(log.at(-1).rev > log[0].rev * 3, '營收有成長');
});

// ── 物流與海港 ──
import { buyPort, placeBid, setReorder, supplyCost, truckCap, absMin } from '../src/port.js';
import { rand } from '../src/econ.js';
import { PORT, FIRST_PORT_QUEST } from '../src/data.js';

test('v2 存檔（物流改版前）遷移到現行格式：海港未開設、顯示改版公告、海灘進度保留', () => {
  const v2 = { v: 2, money: 3.2e6, day: 14, minute: 600, rng: 99, quest: 11, biz: { boat: { lv: 2, earned: 1e6, visits: 200 }, cafe: { lv: 3, earned: 5e5, visits: 900 } }, today: { rev: { boat: 48300 }, visits: {}, turned: {}, cost: 1200, buy: 0 } };
  const s = migrate(JSON.stringify(v2));
  assert.equal(s.v, SAVE_VERSION);
  assert.equal(s.port.lv, 0);
  assert.equal(s.biz.boat.lv, 2);
  assert.equal(s.quest, FIRST_PORT_QUEST);
  assert.equal(s.notice, 'port-update');
  assert.equal(s.today.rev.boat, 48300);
  assert.equal(s.today.supply, 0);
});

test('沒有海港時以市價進貨；有海港且有庫存時打折並扣庫存與物流車額度', () => {
  const s = newState(5);
  s.money = 1e7;
  s.event = null;
  const def = BIZ_BY_ID.burger;
  assert.equal(supplyCost(s, def, 1000), 1000 * def.supply);
  buyPort(s);
  s.port.stock.food = 10;
  const c = supplyCost(s, def, 1000);
  assert.ok(Math.abs(c - 1000 * def.supply * (1 - PORT.disc[0])) < 1e-6);
  assert.equal(s.port.stock.food, 9);
  assert.equal(s.port.truckUsed, 1);
  s.port.truckUsed = truckCap(s);
  assert.equal(supplyCost(s, def, 1000), 1000 * def.supply, '物流車用完改回市價');
});

test('補給船：低於補貨點自動下單、到港卸貨入庫', () => {
  const s = newState(8);
  s.money = 1e7;
  buyPort(s);
  setReorder(s, 'food', 300);
  tick(s, 1);
  const ship = s.port.ships.find((q) => q.kind === 'supply');
  assert.ok(ship && ship.cargo.food > 0, '下單');
  assert.ok(s.today.freight > 0, '付運費');
  tick(s, ship.eta - absMin(s) + 40 + 60 * 12);
  assert.ok(s.port.stock.food > 0, '入庫');
  assert.ok(s.port.stats.ships >= 1);
});

test('貨運合約：得標、船到、卸貨、收款；逾期扣款', () => {
  const s = newState(12);
  s.money = 1e7;
  buyPort(s);
  s.weather.cur = 'sunny';
  s.weather.until = 99999;
  tick(s, 61);
  const o = s.port.offers[0];
  assert.ok(o, '有報價');
  // 把亂數固定成必中
  const r = placeBid(s, () => 0, o.id, Math.round(o.guide * 0.6));
  assert.ok(r.won && r.ship);
  const m0 = s.money;
  tick(s, o.arrive + 60 * 24);
  assert.equal(s.port.stats.contracts, 1);
  assert.ok(s.today.rev.port > 0 || s.history.some((h) => h.rev > 0));
  assert.ok(s.money > m0 - 1e6);
  // 逾期：把交期改到過去
  const o2 = s.port.offers[0] || { id: -1 };
  if (o2.id >= 0) {
    const r2 = placeBid(s, () => 0, o2.id, o2.guide);
    r2.ship.deadline = absMin(s) - 600;
    tick(s, o2.arrive + 60 * 24);
    assert.equal(s.port.stats.late, 1);
  }
});

test('v3 來回序列化保留港口庫存、船期與合約', () => {
  const s = newState(21);
  s.money = 1e7;
  buyPort(s);
  buyPort(s);
  tick(s, 200);
  s.port.stock.goods = 123.5;
  const back = migrate(serialize(s));
  assert.equal(back.port.lv, 2);
  assert.equal(back.port.stock.goods, 123.5);
  assert.equal(back.port.ships.length, s.port.ships.length);
  assert.deepEqual(back.port.reorder, s.port.reorder);
  assert.equal(back.notice, null);
  assert.equal(back.stats.invested, PORT.cost + PORT.up[0]);
});

// ───────── 城市生活改版（v4）─────────
import * as L from '../src/empire.js';
import { LANDMARKS, TIERS, PROMO, LIFT, SWAP_COST, RIVAL } from '../src/data.js';
import { priceOf, eventMult, beachCrowd, investedOf } from '../src/econ.js';

const fresh = (seed = 3) => { const s = newState(seed); s.money = 1e9; s.event = null; s.weather.cur = 'sunny'; s.minute = 12 * 60; return s; };

test('v3 存檔遷移到 v4：顯示城市生活改版公告，新欄位為預設值', () => {
  const s0 = fresh(); s0.v = 3; s0.biz.cafe.lv = 2;
  const raw = JSON.parse(serialize(s0));
  for (const k of ['lifts', 'order', 'apts', 'marks', 'rival', 'rivalNext', 'ach', 'daily', 'savedAt']) delete raw[k];
  raw.v = 3;
  const s = migrate(JSON.stringify(raw));
  assert.equal(s.v, SAVE_VERSION);
  assert.equal(s.notice, 'life-update');
  assert.equal(s.biz.cafe.lv, 2);
  assert.equal(s.biz.cafe.tier, 0);
  assert.deepEqual(s.apts, {});
  assert.equal(s.rival, null);
});

test('v4 來回序列化保留定價、電梯、樓層、公寓、地標、對手、成就與每日目標', () => {
  const s = fresh();
  for (const id of ['cafe', 'boutique', 'nail', 'books']) buyOrUpgrade(s, id);
  L.setTier(s, 'cafe', 1);
  L.startPromo(s, 'cafe');
  L.upgradeLift(s, '3,1,W');
  L.swapFloors(s, '3,1,W', 'nail', 'books');
  L.buyApt(s, '1,0,W');
  L.buyMark(s, 'ferris');
  s.quest = 6;
  s.rival = { id: 'cafe', name: 'x', lot: '0,0,W', power: 0.2, since: 1 };
  tick(s, 1);
  const back = migrate(serialize(s, 123456));
  assert.equal(back.notice, null);
  assert.equal(back.biz.cafe.tier, 1);
  assert.equal(back.biz.cafe.promo, s.biz.cafe.promo);
  assert.equal(back.lifts['3,1,W'], 2);
  assert.deepEqual(back.order['3,1,W'], ['boutique', 'books', 'nail']);
  assert.equal(back.apts['1,0,W'], 1);
  assert.ok(back.marks.ferris);
  assert.equal(back.rival.id, 'cafe');
  assert.equal(back.rival.power, 0.2);
  assert.equal(back.savedAt, 123456);
  assert.deepEqual(back.daily.tasks.map((t) => t.k), s.daily.tasks.map((t) => t.k));
  assert.equal(back.stats.invested, investedOf(back));
});

test('定價：精品客單價高、來客少；平價相反；促銷 3 小時客流 ×1.6 並扣款', () => {
  const s = fresh();
  buyOrUpgrade(s, 'cafe');
  const p0 = priceOf(s, 'cafe'), a0 = arrivalPerMin(s, 'cafe');
  L.setTier(s, 'cafe', 1);
  assert.equal(priceOf(s, 'cafe'), Math.round(p0 * TIERS[1].price));
  assert.ok(Math.abs(arrivalPerMin(s, 'cafe') - a0 * TIERS[1].arrive) < 1e-9);
  L.setTier(s, 'cafe', -1);
  assert.ok(arrivalPerMin(s, 'cafe') > a0);
  L.setTier(s, 'cafe', 0);
  const m = s.money;
  assert.ok(L.startPromo(s, 'cafe'));
  assert.equal(s.money, m - L.promoCost('cafe'));
  assert.ok(Math.abs(arrivalPerMin(s, 'cafe') - a0 * PROMO.mult) < 1e-9);
  assert.ok(!L.startPromo(s, 'cafe'), '同一家店的促銷不能疊加');
  s.minute += PROMO.minutes + 1;
  assert.equal(L.promoLeft(s, 'cafe'), 0);
});

test('疊樓加成：同棟別家每一級 +5%；公寓人口與地標加成乘進客流', () => {
  const s = fresh();
  buyOrUpgrade(s, 'nail');
  const a0 = arrivalPerMin(s, 'nail');
  buyOrUpgrade(s, 'boutique'); buyOrUpgrade(s, 'boutique');
  assert.ok(Math.abs(arrivalPerMin(s, 'nail') / a0 - 1.1) < 1e-9);
  const a1 = arrivalPerMin(s, 'nail');
  L.buyApt(s, '0,0,W');
  L.buyApt(s, '0,0,W');
  assert.ok(Math.abs(arrivalPerMin(s, 'nail') / a1 - 1.05) < 1e-9);
  assert.ok(L.rentPerDay(s) > 0);
  const b0 = beachCrowd(s);
  L.buyMark(s, 'ferris');
  assert.ok(Math.abs(beachCrowd(s) / b0 - 1.2) < 1e-9);
});

test('週五夜派對：晚上酒吧加倍、其他城市店 ×1.5，白天不影響', () => {
  const s = fresh();
  s.event = 'party';
  s.minute = 21 * 60;
  assert.equal(eventMult(s, BIZ_BY_ID.bar), 2);
  assert.equal(eventMult(s, BIZ_BY_ID.burger), 1.5);
  assert.equal(eventMult(s, BIZ_BY_ID.snack), 1);
  s.minute = 12 * 60;
  assert.equal(eventMult(s, BIZ_BY_ID.burger), 1);
  // 第 5、12…天是週五
  const t = newState(9);
  t.day = 4; t.minute = 1439;
  tick(t, 2);
  assert.equal(t.event, 'party');
});

test('季節：每 7 天換季，冬天海灘冷清、城市變熱鬧，冬天不會有熱浪', () => {
  const s = fresh();
  buyOrUpgrade(s, 'snack'); buyOrUpgrade(s, 'cafe');
  const sp = { b: arrivalPerMin(s, 'snack'), c: arrivalPerMin(s, 'cafe') };
  s.day = 22;
  assert.equal(L.seasonOf(s).id, 'winter');
  assert.ok(Math.abs(arrivalPerMin(s, 'snack') / sp.b - 0.55) < 1e-9);
  assert.ok(arrivalPerMin(s, 'cafe') > sp.c);
  let heat = 0;
  for (let i = 0; i < 300; i++) { tick(s, 60); if (s.day > 28) s.day = 22; if (s.weather.cur === 'heat') heat++; }
  assert.equal(heat, 0);
});

test('競爭對手：搶走目標店客人；平價減半；收購或買下他租的公寓就會離開', () => {
  const s = fresh();
  buyOrUpgrade(s, 'cafe');
  const a0 = arrivalPerMin(s, 'cafe');
  s.rival = { id: 'cafe', name: 'x', lot: '1,0,W', power: 0.2, since: 1 };
  assert.ok(Math.abs(arrivalPerMin(s, 'cafe') / a0 - 0.8) < 1e-9);
  L.setTier(s, 'cafe', -1);
  assert.ok(Math.abs(L.rivalMult(s, 'cafe') - 0.9) < 1e-9);
  L.buyApt(s, '1,0,W');
  assert.equal(s.rival, null);
  assert.equal(s.stats.rivals, 1);
  assert.equal(s.rivalNext, s.day + RIVAL.cooldown);
  s.rival = { id: 'cafe', name: 'x', lot: '3,0,W', power: 0.3, since: 1 };
  const m = s.money, c = L.rivalBuyCost(s);
  assert.ok(L.buyoutRival(s));
  assert.equal(s.money, m - c);
  assert.equal(s.rival, null);
});

test('對手出現：任務進入海灘章後、有沒買下的公寓才會開店；全部公寓都買下就無處可開', () => {
  const s = fresh(11);
  buyOrUpgrade(s, 'cafe');
  s.quest = 6;
  for (let d = 0; d < 20 && !s.rival; d++) tick(s, 1440);
  assert.ok(s.rival, '20 天內對手應該出現');
  assert.ok(!s.apts[s.rival.lot]);
  const t = fresh(11);
  buyOrUpgrade(t, 'cafe');
  t.quest = 6;
  for (const a of L.APTS) L.buyApt(t, a.key);
  for (let d = 0; d < 20; d++) tick(t, 1440);
  assert.equal(t.rival, null);
});

test('電梯升級與樓層交換扣款', () => {
  const s = fresh();
  const m = s.money;
  assert.equal(L.upgradeLift(s, '3,1,W'), 2);
  assert.equal(L.upgradeLift(s, '3,1,W'), 3);
  assert.equal(L.upgradeLift(s, '3,1,W'), 0);
  assert.equal(s.money, m - LIFT.cost[1] - LIFT.cost[2]);
  assert.ok(L.swapFloors(s, '0,0,E', 'gym', 'bar'));
  assert.deepEqual(L.floorOrder(s, '0,0,E'), ['bar', 'gym']);
  assert.equal(s.money, m - LIFT.cost[1] - LIFT.cost[2] - SWAP_COST);
});

test('每日目標完成發獎金；成就只發一次', () => {
  const s = fresh();
  buyOrUpgrade(s, 'cafe');
  tick(s, 1);
  const t = s.daily.tasks.find((x) => x.k === 'visits');
  assert.ok(t);
  const m = s.money;
  for (let i = 0; i < t.goal; i++) serve(s, t.id);
  const ev = tick(s, 0.01);
  assert.ok(ev.some((e) => e.type === 'daily'));
  assert.ok(t.done);
  assert.ok(s.money > m);
  s.stats.served = 1000;
  const e1 = tick(s, 0.01);
  assert.ok(e1.some((e) => e.type === 'ach' && e.name === '熟客滿街'));
  assert.ok(!tick(s, 0.01).some((e) => e.type === 'ach' && e.name === '熟客滿街'));
});

test('離線收入：最近平均淨利的一半，最多一天；沒有歷史就沒有', () => {
  const s = fresh();
  s.savedAt = 1e12;
  assert.equal(L.offlineEarnings(s, 1e12 + 3600e3).amount, 0);
  s.history = [{ day: 1, rev: 100000, cost: 20000, supply: 10000, port: 0 }];
  const half = L.offlineEarnings(s, 1e12 + L.OFFLINE.realMinPerDay * 30e3);
  assert.equal(half.amount, Math.round(70000 * 0.5 * 0.5));
  assert.equal(L.offlineEarnings(s, 1e12 + 86400e3).amount, 35000);
  assert.equal(L.offlineEarnings(s, 1e12 + 30e3).amount, 0);
});

test('批發短缺：市價進貨貴 50%', () => {
  const s = fresh();
  const def = BIZ_BY_ID.cafe;
  s.event = 'shortage';
  assert.ok(Math.abs(supplyCost(s, def, 1000) - 1500 * def.supply) < 1e-9);
});
