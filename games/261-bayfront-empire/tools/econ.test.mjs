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

test('v2 存檔（物流改版前）遷移到 v3：海港未開設、顯示改版公告、海灘進度保留', () => {
  const v2 = { v: 2, money: 3.2e6, day: 14, minute: 600, rng: 99, quest: 11, biz: { boat: { lv: 2, earned: 1e6, visits: 200 }, cafe: { lv: 3, earned: 5e5, visits: 900 } }, today: { rev: { boat: 48300 }, visits: {}, turned: {}, cost: 1200, buy: 0 } };
  const s = migrate(JSON.stringify(v2));
  assert.equal(s.v, 3);
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
