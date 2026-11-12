// 282 市場＋信箱：上架、購買、取消、到期寄回、領信（market.mjs＋game.mjs 路由，記憶體資料）。npm run test:ro
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRoLife } from './server.mjs';
import { RoStore } from './store.mjs';
import { takeForListing, addAttach, attachOf, sellerPays, marketQuery, MARKET_MAX_LISTINGS } from './market.mjs';

const sha = (s) => createHash('sha256').update(s).digest('hex');
const sword = (uid, o = {}) => ({ uid, itemId: 1104, quality: 1, cards: [null], affixes: [{ stat: 'str', value: 2 }], ilvl: 8, tier: 1, refine: 3, ...o });
const docOf = ({ chars = [{ id: 'c1', name: 'Alice', job: 'archer', equipped: {} }], inventory = [], cards = {}, materials = {}, kafra = 0 } = {}) => ({
  'characters.v1': JSON.stringify(chars),
  'account.v1': JSON.stringify({ inventory, cards, materials, kafra }),
});
const acct = (doc) => JSON.parse(doc['account.v1']);

async function boot(env = {}) {
  const store = new RoStore({});
  const app = createRoLife({ env, store, fetchImpl: () => { throw Error('no network'); } });
  const server = createServer(async (req, res) => { if (!(await app.handle(req, res))) { res.writeHead(404); res.end(); } });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/api/ro/`;
  const who = async (tag, doc) => {
    const id = await store.loginIdentity('google', 'sub-' + tag, tag);
    const token = `tok_${tag}_` + 'x'.repeat(28);
    await store.createSession(sha(token), id, 3600);
    store.mem.gameSaves.set(id, { doc, rev: 1, wid: null });
    const call = async (method, path, body) => {
      const r = await fetch(base + path, { method, headers: { 'x-session': token, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    };
    return { id, call, op: (body) => call('POST', 'game/op', body), save: () => store.mem.gameSaves.get(id), acct: () => acct(store.mem.gameSaves.get(id).doc) };
  };
  return { store, who, base, close: () => new Promise((r) => server.close(r)) };
}

test('上架拿出物品：身上的、上鎖的、新手的、不存在的、價格不對都不行', () => {
  const doc = docOf({ chars: [{ id: 'c1', equipped: { weapon: 'w1' } }], inventory: [sword('w1'), sword('w2'), sword('w3', { safe: true }), { uid: 'n1', itemId: 1101 }], cards: { 4001: 2 }, materials: { 984: 5 } });
  assert.equal(takeForListing(doc, { uid: 'w1', price: 10 }).error, 'bad_op');
  assert.equal(takeForListing(doc, { uid: 'w3', price: 10 }).error, 'bad_op');
  assert.equal(takeForListing(doc, { uid: 'nope', price: 10 }).error, 'missing');
  assert.equal(takeForListing(doc, { uid: 'w2', price: 0 }).error, 'bad_op');
  assert.equal(takeForListing(doc, { uid: 'w2', price: 2e9 }).error, 'bad_op');
  assert.equal(takeForListing(doc, { card: 4001, count: 3, price: 5 }).error, 'missing');
  assert.equal(takeForListing(doc, { card: 4001, count: 0, price: 5 }).error, 'bad_op');
  assert.equal(takeForListing(doc, { ore: 984, count: 6, price: 5 }).error, 'missing');
  const g = takeForListing(doc, { uid: 'w2', price: 500 });
  assert.deepEqual(acct(g.doc).inventory.map((i) => i.uid), ['w1', 'w3', 'n1']);
  assert.deepEqual(g.listing, { kind: 'gear', itemId: 1104, item: { uid: 'w2', itemId: 1104, refine: 3, quality: 1, tier: 1, ilvl: 8, cards: [null], affixes: [{ stat: 'str', value: 2 }] }, count: 1, price: 500 });
  const c = takeForListing(doc, { card: 4001, count: 2, price: 9 });
  assert.deepEqual([acct(c.doc).cards, c.listing.count], [{}, 2]);
  const o = takeForListing(doc, { ore: 984, count: 2, price: 9 });
  assert.deepEqual(acct(o.doc).materials, { 984: 3 });
});

test('附件加回存檔：uid 撞號換新、Kafra 不夠付不行；手續費 3%（無條件捨去）', () => {
  const doc = docOf({ inventory: [sword('x')], kafra: 100 });
  const r = addAttach(doc, attachOf({ kind: 'gear', itemId: 1104, item: sword('x', { extra: 1 }), count: 1 }));
  const inv = acct(r.doc).inventory;
  assert.equal(inv.length, 2);
  assert.notEqual(inv[1].uid, 'x');
  assert.equal(inv[1].extra, undefined);
  assert.equal(addAttach(doc, attachOf({ kind: 'card', itemId: 4001, count: 1 }), { pay: 101 }).error, 'kafra');
  assert.deepEqual(acct(addAttach(doc, { cards: { 4001: 2 }, ores: { 984: -5 }, kafra: 7 }, { pay: 50 }).doc), { inventory: [sword('x')], cards: { 4001: 2 }, materials: { 984: 0 }, kafra: 57 });
  assert.deepEqual([sellerPays(100), sellerPays(33), sellerPays(1)], [97, 33, 1]);
  const q = marketQuery(new URLSearchParams('kind=card&ids=4001,x,-3,4002&page=9999'));
  assert.deepEqual(q, { kind: 'card', ids: [4001, 4002], page: 200 });
  assert.deepEqual(marketQuery(new URLSearchParams('kind=<b>')), { kind: '', ids: [], page: 0 });
});

test('市場流程：上架 → 瀏覽 → 購買（賣家收信、扣手續費）→ 領信；不能買自己的、不能買第二次', async (t) => {
  const s = await boot({ RO_ONLINE: '1', RO_ONLINE_ENFORCE: '1' });
  t.after(s.close);
  const A = await s.who('A', docOf({ inventory: [sword('s1'), sword('s2')], cards: { 4001: 3 }, kafra: 10 }));
  const B = await s.who('B', docOf({ chars: [{ id: 'b1', name: 'Bobby', job: 'mage', equipped: {} }], kafra: 1000 }));
  const C = await s.who('C', docOf({ chars: [{ id: 'c1', name: 'Cid', job: 'mage', equipped: {} }], kafra: 1000 }));
  assert.equal((await A.call('GET', 'config')).body.market, true);

  const l1 = await A.op({ op: 'marketList', uid: 's1', price: 700, char: 'c1' });
  assert.equal(l1.status, 200, JSON.stringify(l1.body));
  assert.equal(l1.body.rev, 2);
  assert.deepEqual(acct(l1.body.doc).inventory.map((i) => i.uid), ['s2']);
  assert.deepEqual(l1.body.trade.uids, ['s2']);
  const l2 = await A.op({ op: 'marketList', card: 4001, count: 2, price: 50 });
  assert.equal(l2.status, 200);
  assert.equal((await A.op({ op: 'marketList', uid: 's1', price: 5 })).body.error, 'missing'); // 已經上架了

  const browse = await B.call('GET', 'game/market');
  assert.equal(browse.status, 200);
  assert.deepEqual(browse.body.rows.map((r) => [r.kind, r.itemId, r.price, r.seller, r.mine]), [['card', 4001, 50, 'Alice', false], ['gear', 1104, 700, 'Alice', false]]);
  assert.equal(browse.body.rows[1].item.refine, 3);
  assert.equal(browse.body.rows[1].seller_id, undefined);
  assert.equal((await B.call('GET', 'game/market?kind=gear')).body.rows.length, 1);
  assert.equal((await B.call('GET', 'game/market?ids=4001')).body.rows[0].count, 2);
  const mine = await A.call('GET', 'game/market/mine');
  assert.deepEqual(mine.body.rows.map((r) => [r.mine, r.status]), [[true, 'open'], [true, 'open']]);

  const gid = browse.body.rows[1].id;
  assert.equal((await A.op({ op: 'marketBuy', id: gid })).body.error, 'own');
  const buy = await B.op({ op: 'marketBuy', id: gid });
  assert.equal(buy.status, 200, JSON.stringify(buy.body));
  assert.deepEqual([B.acct().kafra, B.acct().inventory.map((i) => [i.uid, i.refine])], [300, [['s1', 3]]]);
  assert.equal((await C.op({ op: 'marketBuy', id: gid })).body.error, 'gone');
  assert.equal(C.acct().kafra, 1000);
  // 賣家：信箱有一封附 679 Kafra（700 − 21）的信
  const box = await A.call('GET', 'game/mail');
  assert.equal(box.body.pending, 1);
  const m = box.body.mail[0];
  assert.deepEqual([m.kind, m.title.zh, m.attach.kafra, m.claimed], ['gift', '市場：已售出', 679, false]);
  assert.equal((await A.call('POST', 'game/mail/delete', { id: m.id })).body.mail.length, 1); // 沒領不能刪
  const claim = await A.op({ op: 'mail', id: m.id });
  assert.equal(claim.status, 200, JSON.stringify(claim.body));
  assert.equal(acct(claim.body.doc).kafra, 689);
  assert.equal((await A.op({ op: 'mail', id: m.id })).body.error, 'missing'); // 不能領兩次
  assert.equal(A.acct().kafra, 689);
  const after = await A.call('GET', 'game/mail');
  assert.deepEqual([after.body.pending, after.body.mail[0].claimed], [0, true]);
  assert.equal((await A.call('POST', 'game/mail/delete', { id: m.id })).body.mail.length, 0);
  // Kafra 不夠
  assert.equal((await C.op({ op: 'marketBuy', id: browse.body.rows[0].id, x: 1 })).status, 200);
  const poor = await s.who('D', docOf({ kafra: 5 }));
  const l3 = await A.op({ op: 'marketList', uid: 's2', price: 6 });
  assert.equal((await poor.op({ op: 'marketBuy', id: l3.body.listing })).body.error, 'kafra');
  // 紀錄
  const logs = s.store.mem.gameLogs.filter((l) => l.kind === 'op').map((l) => l.detail.op);
  assert.deepEqual(logs, ['marketList', 'marketList', 'marketBuy', 'mail', 'marketBuy', 'marketList']);
});

test('取消上架拿回物品；到期寄回信箱；上架數量上限', async (t) => {
  const s = await boot({ RO_ONLINE: '1' });
  t.after(s.close);
  const inv = Array.from({ length: MARKET_MAX_LISTINGS + 1 }, (_, i) => sword('g' + i));
  const A = await s.who('A', docOf({ inventory: inv, materials: { 984: 9 } }));
  const B = await s.who('B', docOf({ kafra: 99 }));
  const one = await A.op({ op: 'marketList', ore: 984, count: 4, price: 3 });
  assert.equal((await B.op({ op: 'marketCancel', id: one.body.listing })).body.error, 'gone'); // 不是自己的
  const cancel = await A.op({ op: 'marketCancel', id: one.body.listing });
  assert.equal(cancel.status, 200);
  assert.deepEqual(A.acct().materials, { 984: 9 });
  assert.equal((await A.op({ op: 'marketCancel', id: one.body.listing })).body.error, 'gone');
  assert.equal((await B.op({ op: 'marketBuy', id: one.body.listing })).body.error, 'gone');

  for (let i = 0; i < MARKET_MAX_LISTINGS; i++) assert.equal((await A.op({ op: 'marketList', uid: 'g' + i, price: 10 + i })).status, 200);
  assert.equal((await A.op({ op: 'marketList', uid: 'g' + MARKET_MAX_LISTINGS, price: 1 })).body.error, 'full');
  // 兩筆過期：開信箱時寄回，再開一次不重寄；過期的不能買
  const rows = s.store.mem.market.filter((l) => l.status === 'open').slice(0, 2);
  for (const l of rows) l.expires_at = Date.now() - 1;
  assert.equal((await B.op({ op: 'marketBuy', id: rows[0].id })).body.error, 'gone');
  assert.equal((await A.call('GET', 'game/mail')).body.pending, 2);
  assert.equal((await A.call('GET', 'game/market/mine')).body.rows.filter((r) => r.status === 'expired').length, 2);
  const box = (await A.call('GET', 'game/mail')).body;
  assert.equal(box.mail.length, 2);
  assert.equal(box.mail[0].kind, 'recovered');
  for (const m of box.mail) assert.equal((await A.op({ op: 'mail', id: m.id })).status, 200);
  assert.deepEqual(A.acct().inventory.map((i) => i.uid).sort(), ['g0', 'g1', 'g20'].sort());
  // 已讀
  await A.call('POST', 'game/mail/read', {});
  assert.ok((await A.call('GET', 'game/mail')).body.mail.every((m) => m.read));
});

test('RO_MARKET=0：市場關閉（404／bad_op），信箱照常；沒登入 401', async (t) => {
  const s = await boot({ RO_ONLINE: '1', RO_MARKET: '0' });
  t.after(s.close);
  const A = await s.who('A', docOf({ inventory: [sword('s1')] }));
  assert.equal((await A.call('GET', 'config')).body.market, false);
  assert.equal((await A.call('GET', 'game/market')).status, 404);
  assert.equal((await A.op({ op: 'marketList', uid: 's1', price: 5 })).body.error, 'bad_op');
  assert.deepEqual((await A.call('GET', 'game/mail')).body, { mail: [], pending: 0 });
  assert.equal((await fetch(s.base + 'game/market')).status, 401);
});
