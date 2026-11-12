// 282 普隆德拉大廳第三階段：多頻道、密語帶 id、離線留言、禁言、檢舉、管理 API、聊天紀錄（npm run test:ro）
import test from 'node:test';
import assert from 'node:assert/strict';
import { signTicket, verifyTicket, onMessage, onClose, OFFLINE_TAG } from './lobby-core.mjs';
import { memoryStore, sqlStore, OFFLINE_PER_SENDER, CHAT_KEEP_MS } from './lobby-store.mjs';
import { adminApi, adminAuthorized } from './lobby-admin.mjs';

const SECRET = 'test-secret-0123456789';
const LOOK = { job: 'hunter', gender: 'f', hair: 3, hairColor: 2, cloth: 1, equip: {} };

async function sqliteStore(opts) {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  return sqlStore((q, ...p) => {
    const st = db.prepare(q);
    return /^\s*(SELECT|WITH)|RETURNING/i.test(q) ? st.all(...p) : (st.run(...p), []);
  }, opts);
}

function world({ db = memoryStore(), cap } = {}) {
  const st = new Map(), sent = [], peers = [], closed = [];
  const io = {
    peers: () => peers, get: (ws) => st.get(ws) ?? null, set: (ws, v) => (v ? st.set(ws, v) : st.delete(ws)),
    send: (ws, msg) => sent.push([ws, msg]), close: (ws, code) => closed.push([ws, code]),
    verify: (t, now) => verifyTicket(SECRET, t, now), db, ...(cap ? { cap } : {}), log: () => {},
  };
  const w = {
    io, st, sent, closed, db, now: Date.now(),
    async join(ws, name, acc) {
      peers.push(ws);
      const rt = acc ? await signTicket(SECRET, { account: acc, name: 'G' }, w.now) : undefined;
      await w.say(ws, { t: 'hello', name, look: LOOK, x: 0, y: 0, f: 0, rt });
      return st.get(ws)?.id;
    },
    leave(ws) { onClose(io, ws); peers.splice(peers.indexOf(ws), 1); },
    say: (ws, m) => onMessage(io, ws, JSON.stringify(m), (w.now += 50)),
    got: (ws, t) => sent.filter(([x, m]) => x === ws && m.t === t).map(([, m]) => m),
    last: (ws, t) => sent.filter(([x, m]) => x === ws && m.t === t).at(-1)?.[1],
    clear: () => { sent.length = 0; },
    ch: (ws) => st.get(ws).ch,
  };
  return w;
}

test('多頻道：先填到八成再開下一個；頻道聊天、走動只送同頻道，一般聊天全廣場；換頻道重送 welcome；全滿用 1013', async () => {
  const w = world({ cap: 2 }); // 每頻道 2 人、八成＝2
  await w.join('a', 'Amy', 1); await w.join('b', 'Bob', 2); await w.join('c', 'Cat', 3); await w.join('d', 'Dan', 4); await w.join('e', 'Eve', 5);
  assert.deepEqual(['a', 'b', 'c', 'd', 'e'].map(w.ch), [1, 1, 2, 2, 3]);
  assert.deepEqual(w.last('c', 'welcome').players.map((p) => p.name), []); // 只看到同頻道的人
  assert.equal(w.got('a', 'join').length, 1); // a 只收到 b 加入
  w.clear();
  await w.say('a', { t: 'chat', ch: 'local', text: 'ch1' });
  await w.say('a', { t: 'chat', ch: 'general', text: 'all' });
  await w.say('a', { t: 'move', x: 5, y: 6, f: 1 });
  assert.deepEqual(w.got('b', 'chat').map((m) => m.text), ['ch1', 'all']);
  assert.deepEqual(w.got('c', 'chat').map((m) => [m.text, m.c]), [['all', 1]]);
  assert.equal(w.got('c', 'moves').length, 0);
  await w.say('a', { t: 'channels' });
  assert.deepEqual(w.last('a', 'channels'), { t: 'channels', c: [[1, 2], [2, 2], [3, 1], [4, 0]], me: 1 });
  // 換頻道：滿的不行；可以的話舊頻道收到 leave、自己收到新頻道的 welcome（同一個 id）、新頻道收到 join
  await w.say('a', { t: 'hop', n: 2 });
  assert.deepEqual(w.last('a', 'hopErr'), { t: 'hopErr', e: 'full' });
  w.now += 5000;
  const aid = w.st.get('a').id;
  w.clear();
  await w.say('a', { t: 'hop', n: 3 });
  assert.equal(w.ch('a'), 3);
  assert.deepEqual(w.last('b', 'leave'), { t: 'leave', id: aid });
  const wel = w.last('a', 'welcome');
  assert.deepEqual([wel.id, wel.channel, wel.players.map((p) => p.name)], [aid, 3, ['Eve']]);
  assert.equal(w.last('e', 'join').p.id, aid);
  await w.say('a', { t: 'hop', n: 4 }); // 3 秒內再換
  assert.deepEqual(w.last('a', 'hopErr'), { t: 'hopErr', e: 'wait' });
  // 全滿
  await w.join('f', 'F', 6); await w.join('g', 'G', 7); await w.join('h', 'H', 8);
  await w.join('i', 'I', 9);
  assert.deepEqual(w.closed, [['i', 1013]]);
});

test('好友清單顯示對方的頻道；換頻道後好友看到新頻道', async () => {
  const w = world({ cap: 2 });
  await w.join('a', 'Amy', 1); await w.join('b', 'Bob', 2);
  w.db.addFriend('1', '3', 0);
  await w.join('c', 'Cat', 3);
  assert.deepEqual(w.last('a', 'friends').list, [{ name: 'Cat', on: 2, id: w.st.get('c').id }]);
  w.now += 5000;
  await w.say('c', { t: 'hop', n: 3 });
  assert.equal(w.last('a', 'friends').list[0].on, 3);
});

test('密語：帶 id 時送給點的那個人（同名也不會送錯）；跨頻道也送得到', async () => {
  const w = world({ cap: 2 });
  await w.join('a', 'Amy', 1); await w.join('b1', 'Bob', 2);
  const b2 = await w.join('b2', 'Bob', 3); // 頻道 2
  await w.say('a', { t: 'whisper', to: 'Bob', text: 'which' });
  assert.equal(w.last('a', 'whisperErr').name, 'Bob'); // 沒帶 id：兩個 Bob 不送
  await w.say('a', { t: 'whisper', to: 'Bob', id: b2, text: 'you' });
  assert.equal(w.got('b2', 'whisper').length, 1);
  assert.equal(w.got('b1', 'whisper').length, 0);
  assert.deepEqual(w.last('a', 'whisper'), { t: 'whisper', out: true, name: 'Bob', text: 'you', id: b2, c: 2, gm: false });
  await w.say('a', { t: 'whisper', to: 'Nope', id: b2, text: 'x' }); // id 和名字對不上就不用 id
  assert.equal(w.last('a', 'whisperErr').name, 'Nope');
});

for (const [label, make] of [['記憶體', async () => memoryStore()], ['SQLite', () => sqliteStore()]]) {
  test(`離線留言（${label}）：只能留給好友，上線時當密語送達；有上限；刪好友就清掉；禁言時不能留`, async () => {
    const w = world({ db: await make() });
    await w.join('a', 'Amy', 1); await w.join('b', 'Bob', 2);
    w.db.addFriend('1', '2', 0);
    w.leave('b');
    await w.say('a', { t: 'whisper', to: 'bob', text: '晚點上線' });
    assert.deepEqual(w.last('a', 'whisper'), { t: 'whisper', out: true, name: 'Bob', text: OFFLINE_TAG + '晚點上線', id: 0, c: 0, gm: false });
    await w.join('g', 'x'); // 訪客
    await w.say('a', { t: 'whisper', to: 'Stranger', text: 'x' });
    assert.equal(w.last('a', 'whisperErr').name, 'Stranger');
    w.clear();
    const aId = w.st.get('a').id;
    await w.join('b2', 'Bob', 2);
    assert.deepEqual(w.got('b2', 'whisper'), [{ t: 'whisper', out: false, name: 'Amy', text: OFFLINE_TAG + '晚點上線', id: aId, c: 1, gm: false }]);
    assert.equal(w.db.offlineCount('2'), 0); // 送達就刪
    // 上限：同一人最多 OFFLINE_PER_SENDER 則
    w.leave('b2');
    for (let i = 0; i < OFFLINE_PER_SENDER + 2; i++) { w.now += 3000; await w.say('a', { t: 'whisper', to: 'Bob', text: `m${i}` }); }
    assert.equal(w.db.offlineCount('2'), OFFLINE_PER_SENDER);
    assert.equal(w.got('a', 'whisperErr').length, 2);
    // 刪好友：待送的留言一起刪
    await w.say('a', { t: 'friendRemove', name: 'Bob' });
    assert.equal(w.db.offlineCount('2'), 0);
    // 禁言：不能密語也不能留言
    w.db.addFriend('1', '2', 0);
    w.db.setMute('1', w.now + 3_600_000, 'spam', 'Amy', w.now);
    w.now += 20_000;
    await w.say('a', { t: 'whisper', to: 'Bob', text: 'still?' });
    assert.equal(w.last('a', 'chatErr').e, 'muted');
    assert.equal(w.db.offlineCount('2'), 0);
  });

  test(`檢舉與禁言（${label}）：證據是對方的公開發言與雙方密語；一小時內重複、訪客、檢舉自己都不收；禁言後聊天回 muted`, async () => {
    const w = world({ db: await make() });
    await w.join('a', 'Amy', 1); const bId = await w.join('b', 'Bad', 2); await w.join('g', 'x');
    await w.say('b', { t: 'chat', ch: 'local', text: '<罵人>' });
    await w.say('b', { t: 'whisper', to: 'Amy', text: '私下罵' });
    await w.say('a', { t: 'whisper', to: 'Bad', text: '請停止' });
    await w.say('a', { t: 'report', id: bId, why: 'abuse' });
    assert.deepEqual(w.last('a', 'reported'), { t: 'reported', ok: true });
    const [r] = w.db.listReports('open');
    assert.deepEqual([r.reporter, r.reporterName, r.target, r.targetName, r.why], ['1', 'Amy', '2', 'Bad', 'abuse']);
    assert.deepEqual(r.evidence.chat.map((c) => [c.kind, c.text]), [['local', '罵人']]);
    assert.deepEqual(r.evidence.whispers.map((c) => [c.name, c.text]), [['Bad', '私下罵'], ['Amy', '請停止']]);
    await w.say('a', { t: 'report', id: bId, why: 'spam' });
    assert.deepEqual(w.last('a', 'reported'), { t: 'reported', ok: false });
    await w.say('g', { t: 'report', id: bId, why: 'abuse' });
    assert.deepEqual(w.last('g', 'reported'), { t: 'reported', ok: false });
    await w.say('a', { t: 'report', id: w.st.get('a').id });
    assert.equal(w.last('a', 'reported').ok, false);
    // 管理 API 禁言 → 對方聊天回 muted（帶到期時間）
    const res = adminApi(w.db, 'POST', 'mute', new URLSearchParams(), { acc: '2', hours: 1, reason: '辱罵', name: 'Bad' }, w.now);
    assert.equal(res.status, 200);
    w.now += 20_000;
    await w.say('b', { t: 'chat', ch: 'local', text: 'hi' });
    assert.deepEqual(w.last('b', 'chatErr'), { t: 'chatErr', e: 'muted', until: res.body.until });
    assert.equal(w.got('a', 'chat').filter((m) => m.text === 'hi').length, 0);
    const list = adminApi(w.db, 'GET', 'reports', new URLSearchParams('status=open'), null, w.now).body.reports;
    assert.equal(list[0].mutedUntil, res.body.until);
    assert.deepEqual(adminApi(w.db, 'GET', 'mutes', new URLSearchParams(), null, w.now).body.mutes.map((m) => [m.acc, m.name, m.reason]), [['2', 'Bad', '辱罵']]);
    assert.deepEqual(adminApi(w.db, 'POST', 'unmute', null, { acc: '2' }, w.now).body, { ok: true });
    w.now += 20_000;
    await w.say('b', { t: 'chat', ch: 'local', text: 'ok now' });
    assert.equal(w.got('a', 'chat').at(-1).text, 'ok now');
    assert.equal(adminApi(w.db, 'POST', 'report', null, { id: r.id, status: 'done' }, w.now).status, 200);
    assert.equal(adminApi(w.db, 'GET', 'reports', new URLSearchParams('status=done'), null, w.now).body.reports.length, 1);
    assert.equal(adminApi(w.db, 'POST', 'report', null, { id: 999 }, w.now).status, 404);
    assert.equal(adminApi(w.db, 'POST', 'mute', null, { acc: '<x>', hours: 1 }, w.now).status, 400);
    assert.equal(adminApi(w.db, 'POST', 'mute', null, { acc: '2', hours: -1 }, w.now).status, 400);
    assert.equal(adminApi(w.db, 'DELETE', 'reports', null, null, w.now).status, 404);
  });
}

test('管理密鑰：沒設或太短一律拒絕，只接受 Authorization: Bearer 完全相同的值', () => {
  const key = 'k'.repeat(24);
  assert.equal(adminAuthorized(key, `Bearer ${key}`), true);
  assert.equal(adminAuthorized(key, `Bearer ${key}x`), false);
  assert.equal(adminAuthorized(key, `Bearer ${key.slice(1)}`), false);
  assert.equal(adminAuthorized(key, key), false);
  assert.equal(adminAuthorized(key, null), false);
  assert.equal(adminAuthorized('short', 'Bearer short'), false);
  assert.equal(adminAuthorized(undefined, 'Bearer '), false);
});

test('聊天紀錄（SQLite）：每天有上限、3 天前的會被清掉', async () => {
  const db = await sqliteStore({ chatPerDay: 3 });
  const day = 86_400_000, t0 = 100 * day;
  for (let i = 0; i < 5; i++) db.logChat({ acc: '1', name: 'A', kind: 'local', text: `m${i}`, at: t0 + i });
  assert.deepEqual(db.recentChat('1').map((c) => c.text), ['m0', 'm1', 'm2']); // 第 4、5 則超過當天上限
  db.logChat({ acc: '1', name: 'A', kind: 'local', text: 'next day', at: t0 + day });
  db.logChat({ acc: '1', name: 'A', kind: 'local', text: 'later', at: t0 + CHAT_KEEP_MS + 2 * 3_600_000 });
  assert.deepEqual(db.recentChat('1').map((c) => c.text), ['next day', 'later']);
});

test('資料庫壞掉時聊天、進場照常（免費額度用完時寫入會失敗）', async () => {
  const broken = new Proxy(memoryStore(), { get: (t, k) => (typeof t[k] === 'function' ? () => { throw new Error('quota'); } : t[k]) });
  const w = world({ db: broken });
  await w.join('a', 'Amy', 1); await w.join('b', 'Bob', 2);
  assert.ok(w.last('a', 'welcome'));
  await w.say('a', { t: 'chat', ch: 'local', text: 'still works' });
  assert.equal(w.last('b', 'chat').text, 'still works');
  await w.say('a', { t: 'whisper', to: 'Bob', text: 'psst' });
  assert.equal(w.last('b', 'whisper').text, 'psst');
  w.leave('b');
  assert.equal(w.last('a', 'leave').t, 'leave');
});
