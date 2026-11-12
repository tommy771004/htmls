// 282 交易：結算（trade.mjs）、結算端點、大廳撮合（lobby-trade.mjs）。npm run test:ro
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRoLife } from './server.mjs';
import { RoStore } from './store.mjs';
import { checkSave } from './game-rules.mjs';
import { tradeLedger, cleanOffer, applyTrade, settleTrade, signSettle, openSettle, makeSettle } from './trade.mjs';
import { signTicket, verifyTicket, onMessage, onClose } from './lobby-core.mjs';
import { onAlarm } from './lobby-party.mjs';
import { ASK_MS } from './lobby-trade.mjs';
import { memoryStore } from './lobby-store.mjs';

const SECRET = 'test-secret-0123456789';
const sword = (uid, o = {}) => ({ uid, itemId: 1104, quality: 1, cards: [null], affixes: [{ stat: 'str', value: 2 }], ilvl: 8, tier: 1, refine: 3, ...o });
const docOf = ({ chars = [{ id: 'c1', name: 'A', job: 'swordman', equipped: {} }], inventory = [], cards = {}, materials = {}, kafra = 0 } = {}) => ({
  'characters.v1': JSON.stringify(chars),
  'account.v1': JSON.stringify({ inventory, cards, materials, kafra }),
});
const acct = (doc) => JSON.parse(doc['account.v1']);
const offer = (o = {}) => cleanOffer({ gear: [], cards: [], ores: [], kafra: 0, ...o });

test('可交易清單：不含身上的、上鎖的、新手裝備', () => {
  const doc = docOf({
    chars: [{ id: 'c1', equipped: { weapon: 'w1' } }],
    inventory: [sword('w1'), sword('w2'), sword('w3', { safe: true }), { uid: 'n1', itemId: 1101, owner: 'c1' }],
    cards: { 4001: 2, 4002: 0 }, materials: { 984: 5 }, kafra: 300,
  });
  assert.deepEqual(tradeLedger(doc), { uids: ['w2'], cards: { 4001: 2 }, ores: { 984: 5 }, kafra: 300 });
  assert.deepEqual(tradeLedger({}), { uids: [], cards: {}, ores: {}, kafra: 0 });
});

test('出價清理：格式錯回 null；同 id 合併；Kafra 截在範圍內', () => {
  assert.equal(cleanOffer(null), null);
  assert.equal(cleanOffer({ gear: [{ uid: 'a b' }] }), null);
  assert.equal(cleanOffer({ gear: [sword('x'), sword('x')] }), null);
  assert.equal(cleanOffer({ cards: [[4001, 0]] }), null);
  assert.equal(cleanOffer({ gear: Array.from({ length: 13 }, (_, i) => sword('g' + i)) }), null);
  const o = cleanOffer({ gear: [{ ...sword('x'), extra: 'drop me', affixes: [{ stat: '<b>', value: 1 }, { stat: 'dex', value: 3 }] }], cards: [[4001, 1], ['4001', 2]], ores: [[984, 3]], kafra: -5 });
  assert.deepEqual(o, { gear: [{ uid: 'x', itemId: 1104, refine: 3, quality: 1, tier: 1, ilvl: 8, cards: [null], affixes: [{ stat: 'dex', value: 3 }] }], cards: [[4001, 3]], ores: [[984, 3]], kafra: 0 });
});

test('結算：雙方的裝備、卡片、礦石、Kafra 互換；回傳真正的那件', () => {
  const A = docOf({ inventory: [sword('a1'), sword('a2')], cards: { 4001: 3 }, kafra: 1000 });
  const B = docOf({ chars: [{ id: 'b1', job: 'archer', equipped: {} }], inventory: [sword('b1', { itemId: 1105, refine: 0 })], materials: { 984: 10 }, kafra: 50 });
  const r = applyTrade(A, B, offer({ gear: [sword('a1')], cards: [[4001, 2]], kafra: 400 }), offer({ gear: [sword('b1', { itemId: 1105, refine: 0 })], ores: [[984, 4]] }));
  assert.ok(!r.error);
  const a = acct(r.docA), b = acct(r.docB);
  assert.deepEqual(a.inventory.map((i) => i.uid), ['a2', 'b1']);
  assert.deepEqual(b.inventory.map((i) => i.uid), ['a1']);
  assert.equal(b.inventory[0].refine, 3);
  assert.deepEqual([a.cards, b.cards], [{ 4001: 1 }, { 4001: 2 }]);
  assert.deepEqual([a.materials, b.materials], [{ 984: 4 }, { 984: 6 }]);
  assert.deepEqual([a.kafra, b.kafra], [600, 450]);
  assert.equal(r.a.give.gear[0].uid, 'a1');
  assert.deepEqual(r.b.get, r.a.give);
  assert.equal(r.docA['characters.v1'], A['characters.v1']);
});

test('結算失敗：出價的樣子造假（+10）、身上的、上鎖的、不夠的、沒有線上角色', () => {
  const A = docOf({ chars: [{ id: 'c1', equipped: { weapon: 'worn' } }], inventory: [sword('a1'), sword('worn'), sword('lock', { safe: true })], cards: { 4001: 1 }, kafra: 10 });
  const B = docOf({ kafra: 0 });
  const none = offer();
  assert.equal(applyTrade(A, B, offer({ gear: [sword('a1', { refine: 10 })] }), none).error, 'missing');
  assert.equal(applyTrade(A, B, offer({ gear: [sword('a1', { affixes: [] })] }), none).error, 'missing');
  assert.equal(applyTrade(A, B, offer({ gear: [sword('worn')] }), none).error, 'missing');
  assert.equal(applyTrade(A, B, offer({ gear: [sword('lock', { safe: true })] }), none).error, 'missing');
  assert.equal(applyTrade(A, B, offer({ gear: [sword('nope')] }), none).error, 'missing');
  assert.equal(applyTrade(A, B, offer({ cards: [[4001, 2]] }), none).error, 'missing');
  assert.equal(applyTrade(A, B, offer({ kafra: 11 }), none).error, 'missing');
  assert.equal(applyTrade(A, {}, offer({ kafra: 1 }), none).error, 'offline');
  assert.ok(!applyTrade(A, B, offer({ gear: [sword('a1')] }), none).error);
});

test('settleTrade：一次寫兩邊、記 trade 紀錄；同一個 id 重送回成功不重做；rev 被搶就重讀', async () => {
  const store = new RoStore({});
  store.mem.gameSaves.set('1', { doc: docOf({ inventory: [sword('a1')], kafra: 100 }), rev: 4, wid: 'x' });
  store.mem.gameSaves.set('2', { doc: docOf({ kafra: 500 }), rev: 9, wid: 'y' });
  const x = { id: 'tradeid-0001', a: { acc: '1', offer: offer({ gear: [sword('a1')] }) }, b: { acc: '2', offer: offer({ kafra: 300 }) } };
  // 第一次寫入時另一邊剛好存檔：rev 對不上 → 重讀再算
  const orig = store.tradeGameSaves.bind(store);
  let calls = 0;
  store.tradeGameSaves = async (a, b, wid) => (calls++ === 0 ? (store.mem.gameSaves.get('2').rev++, null) : orig(a, b, wid));
  const r = await settleTrade(store, x);
  assert.equal(r.ok, true);
  assert.equal(calls, 2);
  assert.deepEqual([store.mem.gameSaves.get('1').rev, store.mem.gameSaves.get('2').rev], [5, 11]);
  assert.deepEqual(acct(store.mem.gameSaves.get('1').doc).kafra, 400);
  assert.deepEqual(acct(store.mem.gameSaves.get('2').doc).inventory.map((i) => i.uid), ['a1']);
  const logs = store.mem.gameLogs.filter((l) => l.kind === 'trade');
  assert.deepEqual(logs.map((l) => [l.detail.with, l.detail.trade]), [['2', 'tradeid-0001'], ['1', 'tradeid-0001']]);
  const again = await settleTrade(store, x);
  assert.equal(again.again, true);
  assert.equal(store.mem.gameSaves.get('1').rev, 5);
  // 東西已經給出去了：換個 id 再來一次就是 missing
  assert.equal((await settleTrade(store, { ...x, id: 'tradeid-0002' })).error, 'missing');
  assert.equal((await settleTrade(store, { ...x, id: 'tradeid-0003', a: { acc: '1', offer: offer() }, b: { acc: '2', offer: offer() } })).error, 'cancel');
});

test('交易後把給出去的那件加回存檔（帶關卡憑證）：精煉值、卡片不會跟著回來', () => {
  const prev = docOf({ chars: [{ id: 'c1', job: 'swordman', level: 10, jobLevel: 5, equipped: {} }], inventory: [] });
  const next = docOf({ chars: [{ id: 'c1', job: 'swordman', level: 10, jobLevel: 5, equipped: {} }], inventory: [sword('a1', { refine: 3, cards: [4001] })] });
  const r = checkSave(prev, next, { now: Date.now(), claim: { stage: 'prontera', mult: 1, issued: Date.now() - 600_000, char: 'c1' } });
  assert.ok(r.issues.some((i) => i.code.startsWith('item-')));
  assert.deepEqual(acct(r.doc).inventory, []);
});

test('結算端點：簽章、時效、關閉時 404；本機記憶體資料預設開放', async (t) => {
  const store = new RoStore({});
  store.mem.gameSaves.set(1, { doc: docOf({ kafra: 100 }), rev: 1, wid: null });
  store.mem.gameSaves.set(2, { doc: docOf({ kafra: 0 }), rev: 1, wid: null });
  const boot = async (env) => {
    const app = createRoLife({ env, store, lobby: { url: '/api/ro/lobby', secret: SECRET }, fetchImpl: () => { throw Error('no network'); } });
    const server = createServer(async (req, res) => { if (!(await app.handle(req, res))) { res.writeHead(404); res.end(); } });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    t.after(() => new Promise((r) => server.close(r)));
    return `http://127.0.0.1:${server.address().port}/api/ro/trade/settle`;
  };
  const url = await boot({});
  const payload = { id: 'tradeid-1234', ts: Date.now(), a: { acc: '1', offer: { gear: [], cards: [], ores: [], kafra: 60 } }, b: { acc: '2', offer: { gear: [], cards: [], ores: [], kafra: 0 } } };
  const post = (body) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const signed = await signSettle(SECRET, payload);
  assert.equal((await post({ ...signed, sig: signed.sig.slice(1) + 'A' })).status, 403);
  assert.equal((await post(await signSettle('other-secret-000000', payload))).status, 403);
  assert.equal((await post(await signSettle(SECRET, { ...payload, ts: Date.now() - 120_000 }))).status, 403);
  // 入場票不能拿來當結算授權（前綴不同）
  const ticket = await signTicket(SECRET, { account: '1', name: 'x' });
  assert.equal((await post({ p: ticket.split('.')[0], sig: ticket.split('.')[1] })).status, 403);
  const ok = await post(signed);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.ok, true);
  assert.deepEqual([acct(store.mem.gameSaves.get(1).doc).kafra, acct(store.mem.gameSaves.get(2).doc).kafra], [40, 60]);
  // makeSettle（大廳端）打同一個端點
  const settle = makeSettle({ url, secret: SECRET });
  assert.equal((await settle({ ...payload, id: 'tradeid-5678', ts: Date.now() })).error, 'missing'); // A 只剩 40
  assert.equal((await settle({ ...payload, id: 'tradeid-9999', ts: Date.now(), a: { acc: '2', offer: payload.a.offer }, b: { acc: '1', offer: payload.b.offer } })).ok, true);
  assert.deepEqual([acct(store.mem.gameSaves.get(1).doc).kafra, acct(store.mem.gameSaves.get(2).doc).kafra], [100, 0]);
  const off = await boot({ RO_TRADE: '0' });
  assert.equal((await fetch(off, { method: 'POST', body: JSON.stringify(signed) })).status, 404);
  assert.equal(await openSettle(SECRET, { p: '{}', sig: 'x' }), null);
});

// ---- 大廳撮合 ----
const LOOK = { job: 'hunter', gender: 'f', hair: 3, hairColor: 2, cloth: 1, equip: {} };
function world({ settle = async () => ({ ok: true, a: { give: 'GA', get: 'GB' }, b: { give: 'GB', get: 'GA' } }) } = {}) {
  const st = new Map(), sent = [], peers = [], wakes = [], settled = [];
  const io = {
    peers: () => peers, get: (ws) => (st.has(ws) ? structuredClone(st.get(ws)) : null), set: (ws, v) => (v ? st.set(ws, structuredClone(v)) : st.delete(ws)),
    send: (ws, msg) => sent.push([ws, msg]), close: () => {}, verify: (t, now) => verifyTicket(SECRET, t, now), db: memoryStore(), log: () => {}, wake: (at) => wakes.push(at),
    ...(settle ? { settle: (p) => (settled.push(p), settle(p)) } : {}),
  };
  const w = {
    io, st, sent, wakes, settled, now: Date.now(),
    async join(ws, name, acc, on = 1) {
      peers.push(ws);
      const rt = acc ? await signTicket(SECRET, { account: acc, name: 'G' }, w.now) : undefined;
      await w.say(ws, { t: 'hello', name, look: LOOK, x: 0, y: 0, f: 0, rt, ...(on ? { on: 1 } : {}) });
    },
    leave(ws) { onClose(io, ws, w.now); peers.splice(peers.indexOf(ws), 1); },
    say: (ws, m) => onMessage(io, ws, JSON.stringify(m), (w.now += 50)),
    last: (ws, t) => sent.filter(([x, m]) => x === ws && m.t === t).at(-1)?.[1],
    id: (ws) => st.get(ws).id,
  };
  return w;
}
async function open(w, a, b) {
  await w.say(a, { t: 'tradeReq', id: w.id(b) });
  await w.say(b, { t: 'tradeReply', id: w.id(a), ok: true });
}
const O1 = { gear: [sword('a1')], cards: [[4001, 1]], ores: [], kafra: 5 };

test('大廳：有 settle 才在 welcome 帶 trade；訪客、單機、同帳號、不在、忙碌都擋', async () => {
  const off = world({ settle: null });
  await off.join('a', 'Amy', 1);
  assert.equal(off.last('a', 'welcome').trade, undefined);
  await off.say('a', { t: 'tradeReq', id: 999 });
  assert.equal(off.last('a', 'tradeEnd'), undefined);

  const w = world();
  await w.join('a', 'Amy', 1); await w.join('b', 'Bob', 2); await w.join('g', 'x'); await w.join('s', 'Solo', 3, 0); await w.join('a2', 'Amy', 1);
  assert.equal(w.last('a', 'welcome').trade, 1);
  await w.say('g', { t: 'tradeReq', id: w.id('a') });
  assert.equal(w.last('g', 'tradeEnd').why, 'guest');
  await w.say('s', { t: 'tradeReq', id: w.id('a') });
  assert.equal(w.last('s', 'tradeEnd').why, 'offline');
  await w.say('a', { t: 'tradeReq', id: w.id('s') });
  assert.equal(w.last('a', 'tradeEnd').why, 'offline');
  await w.say('a', { t: 'tradeReq', id: w.id('g') });
  assert.equal(w.last('a', 'tradeEnd').why, 'guestThem');
  await w.say('a', { t: 'tradeReq', id: w.id('a2') });
  assert.equal(w.last('a', 'tradeEnd').why, 'same');
  await w.say('a', { t: 'tradeReq', id: 999 });
  assert.equal(w.last('a', 'tradeEnd').why, 'gone');
  await w.say('a', { t: 'tradeReq', id: w.id('b') });
  assert.deepEqual(w.last('b', 'tradeAsk'), { t: 'tradeAsk', id: w.id('a'), name: 'Amy' });
  assert.equal(w.wakes.at(-1), w.now + ASK_MS);
  // 同帳號的另一個分頁也算忙
  await w.say('a2', { t: 'tradeReq', id: w.id('b') });
  assert.equal(w.last('a2', 'tradeEnd').why, 'busy');
  // 拒絕
  await w.say('b', { t: 'tradeReply', id: w.id('a'), ok: false });
  assert.equal(w.last('a', 'tradeEnd').why, 'declined');
});

test('大廳：開視窗 → 出價轉給對方（清理過）→ 雙方 OK → 確認 → 結算 → tradeDone', async () => {
  const w = world();
  await w.join('a', 'Amy', 1); await w.join('b', 'Bob', 2);
  await open(w, 'a', 'b');
  assert.equal(w.last('a', 'tradeOpen').name, 'Bob');
  assert.equal(w.last('b', 'tradeOpen').name, 'Amy');
  await w.say('a', { t: 'tradeOffer', o: { ...O1, gear: [{ ...sword('a1'), hack: 1 }] } });
  assert.deepEqual(w.last('b', 'tradeOffer').o, cleanOffer(O1));
  await w.say('b', { t: 'tradeOffer', o: { gear: [], cards: [], ores: [[984, 2]], kafra: 0 } });
  // 沒兩邊 OK 不能確認
  await w.say('a', { t: 'tradeConfirm' });
  assert.deepEqual(w.last('a', 'tradeState'), { t: 'tradeState', me: { lock: false, ok: false }, them: { lock: false, ok: false } });
  await w.say('a', { t: 'tradeLock' });
  await w.say('b', { t: 'tradeLock' });
  // OK 之後不能再改出價
  await w.say('a', { t: 'tradeOffer', o: { ...O1, kafra: 999 } });
  assert.equal(w.st.get('a').tr.offer.kafra, 5);
  await w.say('a', { t: 'tradeConfirm' });
  assert.deepEqual(w.last('b', 'tradeState'), { t: 'tradeState', me: { lock: true, ok: false }, them: { lock: true, ok: true } });
  assert.equal(w.settled.length, 0);
  await w.say('b', { t: 'tradeConfirm' });
  assert.equal(w.settled.length, 1);
  const p = w.settled[0];
  // 最後按確認的（Bob）是 a
  assert.deepEqual([p.a.acc, p.b.acc, p.a.offer.ores, p.b.offer.kafra], ['2', '1', [[984, 2]], 5]);
  assert.match(p.id, /^[0-9a-f]{24}$/);
  assert.deepEqual(w.last('b', 'tradeDone'), { t: 'tradeDone', give: 'GA', get: 'GB' });
  assert.deepEqual(w.last('a', 'tradeDone'), { t: 'tradeDone', give: 'GB', get: 'GA' });
  assert.equal(w.st.get('a').tr, undefined);
  assert.equal(w.st.get('b').tr, undefined);
});

test('大廳：改出價會取消對方的 OK；聊天；取消；斷線；結算失敗回 missing；邀請逾時', async () => {
  let fail = false;
  const w = world({ settle: async () => (fail ? { error: 'missing' } : { ok: true, a: {}, b: {} }) });
  await w.join('a', 'Amy', 1); await w.join('b', 'Bob', 2); await w.join('c', 'Cat', 3);
  await open(w, 'a', 'b');
  await w.say('b', { t: 'tradeLock' });
  await w.say('a', { t: 'tradeOffer', o: O1 });
  assert.deepEqual(w.last('b', 'tradeState').me, { lock: false, ok: false });
  await w.say('a', { t: 'tradeChat', text: '<b>hi</b>' });
  assert.deepEqual(w.last('b', 'tradeChat'), { t: 'tradeChat', name: 'Amy', text: 'bhi/b', id: w.id('a') });
  // 交易中的人不能再被邀請
  await w.say('c', { t: 'tradeReq', id: w.id('a') });
  assert.equal(w.last('c', 'tradeEnd').why, 'busy');
  await w.say('b', { t: 'tradeCancel' });
  assert.equal(w.last('a', 'tradeEnd').why, 'cancel');
  assert.equal(w.last('b', 'tradeEnd').why, 'cancel');
  // 斷線
  await open(w, 'a', 'c');
  w.leave('c');
  assert.equal(w.last('a', 'tradeEnd').why, 'gone');
  assert.equal(w.st.get('a').tr, undefined);
  // 結算失敗
  fail = true;
  await open(w, 'a', 'b');
  await w.say('a', { t: 'tradeOffer', o: O1 });
  for (const x of ['a', 'b']) await w.say(x, { t: 'tradeLock' });
  for (const x of ['a', 'b']) await w.say(x, { t: 'tradeConfirm' });
  assert.equal(w.last('a', 'tradeEnd').why, 'missing');
  assert.equal(w.last('b', 'tradeEnd').why, 'missing');
  // 兩邊都空的：不呼叫 settle
  const n = w.settled.length;
  await open(w, 'a', 'b');
  for (const x of ['a', 'b']) await w.say(x, { t: 'tradeLock' });
  for (const x of ['a', 'b']) await w.say(x, { t: 'tradeConfirm' });
  assert.equal(w.settled.length, n);
  assert.equal(w.last('a', 'tradeEnd').why, 'cancel');
  // 邀請逾時：alarm 通知雙方；逾時後才回覆也只拿到 timeout
  await w.say('a', { t: 'tradeReq', id: w.id('b') });
  onAlarm(w.io, w.now + ASK_MS + 1);
  assert.equal(w.last('a', 'tradeEnd').why, 'timeout');
  assert.equal(w.last('b', 'tradeEnd').why, 'timeout');
  const opens = w.sent.filter(([, m]) => m.t === 'tradeOpen').length;
  await w.say('b', { t: 'tradeReply', id: w.id('a'), ok: true });
  assert.equal(w.sent.filter(([, m]) => m.t === 'tradeOpen').length, opens);
  assert.equal(w.st.get('b').tr, undefined);
});
