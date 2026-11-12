// 282 事後稽核（audit.mjs）的純函式測試。npm run test:ro
import test from 'node:test';
import assert from 'node:assert/strict';
import { economy, behavior, flagged, review, banSql, DEFAULTS, BAN_SCORE } from './audit.mjs';

const T0 = Date.parse('2026-11-10T08:00:00Z');
const at = (min) => new Date(T0 + min * 60_000).toISOString();
const save = (acc, min, detail, flags = []) => ({ account_id: acc, at: at(min), kind: 'save', flags, detail });
const op = (acc, min, detail) => ({ account_id: acc, at: at(min), kind: 'op', flags: [], detail });
const run = (acc, min, secs = 300, extra = {}) => ({ account_id: acc, stage: 'prontera', skip: false, issued_at: at(min), claimed_at: new Date(T0 + min * 60_000 + secs * 1000).toISOString(), ...extra });

test('經濟：產出、消耗、每小時高峰；格式壞掉的紀錄略過', () => {
  const logs = [
    save(1, 0, { addedCount: 3, cards: [2, 5], materials: [10, 4], kafra: [100, 100] }),
    save(1, 20, { addedCount: 4, cards: [5, 4] }),
    save(1, 70, { addedCount: 1 }), // 下一個小時
    op(1, 5, { op: 'sell', gained: 1200, kafra: 1300 }),
    op(1, 6, { op: 'buy', ore: 984, count: 2, cost: 400, kafra: 900 }),
    op(1, 7, { op: 'towerReset' }),
    op(2, 8, { op: 'marketBuy', price: 5000 }),
    op(2, 9, { op: 'refine', item: '1101', ok: true }),
    { account_id: 2, at: at(10), kind: 'trade', flags: [], detail: { trade: 't1' } },
    // 壞掉的：detail 是字串、數字是字串或負數、時間不對、沒有帳號
    save(3, 1, '{"addedCount":"7","cards":["1","4"]}'),
    save(3, 2, { addedCount: -5, cards: 'x', materials: [1], kafra: null }),
    save(3, 3, 'not json'),
    { account_id: 3, at: 'never', kind: 'save', detail: { addedCount: 99 } },
    { at: at(1), kind: 'save', detail: { addedCount: 99 } },
    null,
  ];
  const e = economy(logs);
  assert.equal(e.days.length, 1);
  const d = e.days[0];
  assert.equal(d.day, '2026-11-10');
  assert.equal(d.items, 3 + 4 + 1 + 7);
  assert.equal(d.cards, 3 + 3);
  assert.equal(d.cardsOut, 1);
  assert.equal(d.kafraIn, 1200);
  assert.equal(d.kafraOut, 400 + 500);
  assert.equal(d.traded, 5000);
  assert.equal(d.trades, 1);
  assert.equal(d.ops, 5);
  assert.deepEqual(e.peak.get('1'), { kafraIn: { n: 1200, hour: '2026-11-10T08' }, items: { n: 7, hour: '2026-11-10T08' }, cards: { n: 3, hour: '2026-11-10T08' } });
  assert.equal(e.peak.get('3').items.n, 7);
  assert.equal(e.totals.get('1').items, 8);
  assert.deepEqual(economy([]).days, []);
  assert.deepEqual(economy(null).days, []);
});

test('行為：場數、作息、連續小時、間隔規律', () => {
  const runs = [];
  // 帳號 1：機器人，每 300 秒一場、連續 16 小時
  for (let i = 0; i < 16 * 12; i++) runs.push(run(1, i * 5, 290));
  // 帳號 2：正常人，間隔亂、中間休息
  for (const m of [0, 7, 19, 26, 41, 200, 211, 229, 236, 900, 913]) runs.push(run(2, m, 200 + (m % 7) * 30));
  // 跳過劇情的不算；時間壞掉的略過
  runs.push(run(2, 50, 1, { skip: true }), { account_id: 2, issued_at: 'x' }, null);
  const b = behavior(runs);
  const bot = b.get('1'), man = b.get('2');
  assert.equal(bot.runs, 192);
  assert.equal(bot.maxPerHour, 12);
  assert.equal(bot.streak, 16);
  assert.equal(bot.maxHoursPerDay, 16);
  assert.equal(bot.gap.cv, 0);
  assert.equal(bot.gap.mean, 300);
  assert.equal(bot.length.mean, 290);
  assert.equal(man.runs, 11);
  assert.ok(man.gap.cv > 0.2, JSON.stringify(man.gap));
  assert.equal(man.streak, 1);
  assert.equal(behavior([]).size, 0);
});

test('疑點：旗標、被改回的與只記錄的分開算', () => {
  const f = flagged([
    save(1, 0, { fix: [{ code: 'exp' }, { code: 'item-count', fixed: false }, { nope: 1 }, null] }, ['big-jump']),
    save(1, 1, { fix: [{ code: 'exp' }] }, ['big-jump', 'kafra-no-sale']),
    save(2, 0, { addedCount: 1 }),
    save(3, 0, { fix: 'x' }, 'not-array'),
    save(4, 0, { fix: [{ code: 'name', why: 'taken' }, { code: 'name', why: 'offensive' }] }),
  ]);
  assert.deepEqual(f.get('1'), { flags: { 'big-jump': 2, 'kafra-no-sale': 1 }, fixed: { exp: 2 }, soft: { 'item-count': 1 }, mod: {}, nFixed: 2, nSoft: 1, fixedSaves: 2 });
  // 名字審核不是作弊：另外記，不算進被改回的次數
  assert.deepEqual(f.get('4'), { flags: {}, fixed: {}, soft: {}, mod: { name: 2 }, nFixed: 0, nSoft: 0, fixedSaves: 0 });
  assert.equal(f.has('2'), false);
  assert.equal(f.has('3'), false);
});

test('綜合：機器人與改存檔的排在前面，正常玩家不列；門檻可以改', () => {
  const logs = [], runs = [];
  for (let i = 0; i < 16 * 12; i++) runs.push(run(1, i * 5, 290));
  for (const m of [0, 7, 19, 26, 41, 200, 211]) { runs.push(run(2, m, 240)); logs.push(save(2, m + 4, { addedCount: 2 })); }
  logs.push(save(3, 0, { fix: [{ code: 'item-dup' }, { code: 'cards' }] }, ['item-edit']), op(3, 5, { op: 'sell', gained: 900_000 }));
  const r = review(logs, runs);
  assert.deepEqual(r.rows.map((x) => x.account), ['3', '1']);
  assert.ok(r.rows[0].why.some((w) => w.includes('1 次存檔被改回（共 2 處')));
  assert.ok(r.rows[0].why.some((w) => w.includes('一小時賣出 900000 Kafra')));
  assert.ok(r.rows[1].why.some((w) => w.includes('太規律')));
  assert.ok(r.rows[1].why.some((w) => w.includes('連續 16 個小時')));
  assert.equal(r.thresholds.runsPerHour, DEFAULTS.runsPerHour);
  // 門檻放寬到機器人也不列、收緊到正常玩家也列
  assert.deepEqual(review(logs, runs, { streakHours: 99, regularCv: 0, hoursPerDay: 99 }).rows.map((x) => x.account), ['3']);
  assert.ok(review(logs, runs, { itemsPerHour: 5 }).rows.some((x) => x.account === '2'));
  assert.deepEqual(review([], []).rows, []);
  // 只有名字被改的帳號不列；和別的疑點一起時只附註、不加分
  assert.deepEqual(review([save(7, 0, { fix: [{ code: 'name' }, { code: 'name' }] })], []).rows, []);
  const mixed = review([save(7, 0, { fix: [{ code: 'name' }, { code: 'exp' }] })], []).rows;
  assert.equal(mixed.length, 1);
  assert.equal(mixed[0].score, 5);
  // 一次存檔帶很多處修正還是只算一次（5 分），到不了停權門檻；要好幾次存檔才會
  const one = review([save(8, 0, { fix: [{ code: 'item-dup' }, { code: 'item-dup' }, { code: 'item-dup' }, { code: 'cards' }] })], []).rows[0];
  assert.equal(one.score, 5);
  assert.ok(one.score < BAN_SCORE);
  assert.equal(banSql([one]).includes('UPDATE'), false);
  const many = review([0, 1, 2].map((m) => save(8, m, { fix: [{ code: 'item-dup' }] })), []).rows[0];
  assert.equal(many.score, 15);
  assert.ok(many.why[0].includes('3 次存檔被改回（共 3 處'));
  assert.ok(mixed[0].why.some((w) => w.includes('（不算分）名字審核 name×1')));
});

test('停權 SQL：只產生文字、帳號 id 只收數字、預設是暫時停權', () => {
  const rows = [{ account: '2000001', score: 22, why: ['存檔被改回 2 次', '第二行\n換行要壓掉'] }, { account: "1; DROP TABLE ro_login", score: 99, why: [] }, { account: '2000002', score: 15, why: [] }, { account: '2000003', score: 14, why: ['存檔被改回 1 次'] }, { account: '2000004', score: 5, why: [] }];
  const sql = banSql(rows, { days: 3 });
  // 分數不到 BAN_SCORE 的不產生 UPDATE，只註明有幾個
  assert.equal(BAN_SCORE, 15);
  assert.ok(!sql.includes('2000003') && !sql.includes('2000004'));
  assert.ok(sql.includes('-- 另有 2 個帳號分數不到 15，沒有列入'));
  assert.match(banSql(rows, { minScore: 5 }), /account_id = 2000004 AND state = 0/);
  assert.equal(banSql([{ account: '2000004', score: 5, why: [] }]), '-- 沒有要停權的帳號（1 個帳號分數不到 15，只列在上面給人看）');
  assert.equal(banSql(rows, { minScore: 'x' }).includes('2000004'), false);
  assert.match(sql, /^-- 282 停權/);
  assert.match(sql, /UPDATE ro_login SET unban_time = now\(\) \+ interval '3 days' WHERE account_id = 2000001 AND state = 0;/);
  assert.match(sql, /account_id = 2000002 AND state = 0/);
  assert.ok(!sql.includes('DROP'));
  assert.ok(sql.includes('--   第二行 換行要壓掉'));
  assert.ok(sql.includes('BEGIN;') && sql.includes('COMMIT;'));
  assert.match(sql, /解除：UPDATE ro_login SET state = 0, unban_time = NULL WHERE account_id IN \(2000001, 2000002\);/);
  assert.match(banSql(rows, { permanent: true }), /SET state = 5, unban_time = NULL WHERE account_id = 2000001 AND state = 0;/);
  assert.match(banSql(rows, { days: "7'; --" }), /interval '7 days'/);
  assert.equal(banSql([]), '-- 沒有要停權的帳號');
});
