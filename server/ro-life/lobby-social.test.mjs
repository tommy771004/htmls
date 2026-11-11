// 282 普隆德拉大廳第二階段（社交）：檢視資料、密語、好友（npm run test:ro）
import test from 'node:test';
import assert from 'node:assert/strict';
import { signTicket, verifyTicket, cleanProfile, onMessage, onClose, MAX_PROFILE } from './lobby-core.mjs';
import { memoryStore, sqlStore, FRIEND_MAX } from './lobby-store.mjs';

const SECRET = 'test-secret-0123456789';
const LOOK = { job: 'hunter', gender: 'f', hair: 3, hairColor: 2, cloth: 1, equip: {} };
const PROFILE = {
  level: 42, jobLevel: 30, stats: { str: 20, agi: 50, vit: 10, int: 1, dex: 60, luk: 5 }, talents: { 'hunter.0.blitz_beat': 3, 'swordsman.1.bash_dmg': 5 },
  gear: [{ slot: 'weapon', itemId: 1701, cards: [4001, null], quality: 2, refine: 4, affixes: [{ stat: 'crit', value: 0.05 }, { stat: 'skill', value: 0.12, skill: 'double_strafe' }], ilvl: 30, tier: 1 }],
  record: { stage: 2, bestLevel: 30, wins: 1, runs: 5, totalKills: 900, mvps: 1 }, gs: 1234,
};

// SQLite 版用 node:sqlite 跑同樣的 SQL（Cloudflare 的 ctx.storage.sql 也是 SQLite）
async function sqliteStore() {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  return sqlStore((q, ...p) => {
    const st = db.prepare(q);
    return /^\s*(SELECT|WITH)/i.test(q) ? st.all(...p) : (st.run(...p), []);
  });
}

function world(db = memoryStore()) {
  const st = new Map(), sent = [], peers = [];
  const io = {
    peers: () => peers, get: (ws) => st.get(ws) ?? null, set: (ws, v) => (v ? st.set(ws, v) : st.delete(ws)),
    send: (ws, msg) => sent.push([ws, msg]), close: () => {}, verify: (t, now) => verifyTicket(SECRET, t, now), db,
  };
  let now = Date.now();
  const say = (ws, m) => onMessage(io, ws, JSON.stringify(m), (now += 50));
  return {
    io, st, sent, db,
    async join(ws, name, acc) {
      peers.push(ws);
      const rt = acc ? await signTicket(SECRET, { account: acc, name: 'GoogleName' }, now) : undefined;
      await say(ws, { t: 'hello', name, look: LOOK, x: 0, y: 0, f: 0, rt });
      return st.get(ws).id;
    },
    leave(ws) { onClose(io, ws); peers.splice(peers.indexOf(ws), 1); },
    say,
    got: (ws, t) => sent.filter(([w, m]) => w === ws && m.t === t).map(([, m]) => m),
    last: (ws, t) => sent.filter(([w, m]) => w === ws && m.t === t).at(-1)?.[1],
    clear: () => { sent.length = 0; },
  };
}

test('檢視資料只留數字與代號（別人的檢視視窗用 innerHTML 畫）', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const p = cleanProfile({
    ...PROFILE, level: evil, gs: evil, jobLevel: '3', stats: { str: evil, agi: 1e12, evil: 3 }, talents: { [evil]: 2, ok_one: 5, neg: -1 },
    gear: [{ slot: evil, itemId: 1 }, { slot: 'armor', itemId: evil }, { slot: 'shield', itemId: 2101, cards: [evil, 4002, 1, 2, 3], quality: evil, affixes: [{ stat: evil, value: 1 }, { stat: 'hp', value: evil }, { stat: 'hp', value: 3, skill: evil }] }],
    record: { stage: evil, wins: 3 }, extra: evil,
  });
  assert.deepEqual(p, {
    level: 1, jobLevel: 1, stats: { agi: 9999 }, talents: { ok_one: 5 },
    gear: [{ slot: 'shield', itemId: 2101, cards: [null, 4002, 1, 2], affixes: [{ stat: 'hp', value: 3 }] }],
    record: { stage: 0, bestLevel: 0, wins: 3, runs: 0, totalKills: 0, mvps: 0 }, gs: 0,
  });
  assert.equal(JSON.stringify(p).includes('<'), false);
  assert.deepEqual(cleanProfile(PROFILE), PROFILE);
  assert.equal(cleanProfile('x'), null);
});

test('檢視：送出的資料清理後存起來，別人檢視拿得到，人不在或沒資料回 p:null，離開就刪', async () => {
  const w = world();
  const a = await w.join('a', 'Amy', 10);
  const b = await w.join('b', 'Bob', 11);
  const g = await w.join('g', 'x');
  assert.equal(w.last('a', 'welcome').social, 1);
  await w.say('b', { t: 'profile', p: { ...PROFILE, gs: '<b>' } });
  w.clear();
  await w.say('g', { t: 'inspect', id: b }); // 訪客也能檢視
  assert.deepEqual(w.last('g', 'profile'), { t: 'profile', id: b, p: { ...PROFILE, gs: 0 }, name: 'Bob', look: w.st.get('b').look });
  await w.say('b', { t: 'inspect', id: a }); // Amy 沒送過資料
  assert.deepEqual(w.last('b', 'profile'), { t: 'profile', id: a, p: null });
  await w.say('a', { t: 'inspect', id: 123456 });
  assert.deepEqual(w.last('a', 'profile'), { t: 'profile', id: 123456, p: null });
  // 太大的資料不存
  const K = 'k'.repeat(40); // 長代號讓資料變大
  const huge = { ...PROFILE, gear: Array.from({ length: 16 }, (_, i) => ({ slot: `s${i}`, itemId: 1701, cards: [], affixes: Array.from({ length: 7 }, () => ({ stat: K, value: 0.123, skill: K })) })) };
  assert.ok(JSON.stringify(cleanProfile(huge)).length > MAX_PROFILE); // 清理後超過上限，但整則訊息沒超過 MAX_MESSAGE
  await w.say('a', { t: 'profile', p: PROFILE });
  await w.say('a', { t: 'profile', p: huge });
  assert.equal(w.db.getProfile(a), null);
  w.leave('b');
  assert.equal(w.db.getProfile(b), null);
  void g;
});

test('密語：名字不分大小寫、只送給那個帳號的所有分頁；訪客不能密語也不能被密語；重名就不送', async () => {
  const w = world();
  const a = await w.join('a', 'Amy', 10);
  const b1 = await w.join('b1', 'Bob', 11);
  await w.join('b2', 'Bob', 11); // 同帳號第二個分頁
  await w.join('g', 'x');
  const guestName = w.st.get('g').name;
  w.clear();
  await w.say('a', { t: 'whisper', to: 'bob', text: '嗨 <b>' });
  assert.deepEqual(w.last('a', 'whisper'), { t: 'whisper', out: true, name: 'Bob', text: '嗨 b', id: b1, c: 1, gm: false });
  assert.deepEqual(w.last('b1', 'whisper'), { t: 'whisper', out: false, name: 'Amy', text: '嗨 b', id: a, c: 1, gm: false });
  assert.equal(w.got('b2', 'whisper').length, 1);
  assert.equal(w.got('g', 'whisper').length, 0);
  await w.say('g', { t: 'whisper', to: 'Amy', text: 'hi' });
  assert.deepEqual(w.last('g', 'chatErr'), { t: 'chatErr', e: 'guest' });
  await w.say('a', { t: 'whisper', to: guestName, text: 'hi' });
  assert.deepEqual(w.last('a', 'whisperErr'), { t: 'whisperErr', name: guestName });
  await w.say('a', { t: 'whisper', to: 'Amy', text: 'me' });
  assert.equal(w.got('a', 'whisperErr').length, 2); // 自己
  await w.join('c', 'BOB', 12); // 另一個帳號也叫 Bob
  await w.say('a', { t: 'whisper', to: 'Bob', text: 'which?' });
  assert.equal(w.got('a', 'whisperErr').length, 3);
  assert.equal(w.got('b1', 'whisper').length, 1);
});

for (const [label, make] of [['記憶體', async () => memoryStore()], ['SQLite', sqliteStore]]) {
  test(`好友（${label}）：邀請、接受、上下線、重名加 #2、刪除、對方先邀請就直接成為好友`, async () => {
    const db = await make();
    let w = world(db);
    const a = await w.join('a', 'Amy', '10');
    const b = await w.join('b', 'Bob', 11); // 帳號可能是數字或字串，都當字串
    w.clear();
    await w.say('a', { t: 'friendAdd', name: 'Bob', id: b });
    assert.deepEqual(w.last('a', 'friendNote'), { t: 'friendNote', what: 'sent', name: 'Bob' });
    assert.deepEqual(w.last('b', 'friendAsk'), { t: 'friendAsk', name: 'Amy' });
    assert.deepEqual(w.last('b', 'friends'), { t: 'friends', list: [], asks: ['Amy'] });
    await w.say('b', { t: 'friendReply', name: 'amy', ok: true });
    assert.deepEqual(w.last('b', 'friendNote'), { t: 'friendNote', what: 'added', name: 'Amy' });
    assert.deepEqual(w.last('a', 'friendNote'), { t: 'friendNote', what: 'added', name: 'Bob' });
    assert.deepEqual(w.last('a', 'friends'), { t: 'friends', list: [{ name: 'Bob', on: 1, id: b }], asks: [] });
    assert.deepEqual(w.last('b', 'friends'), { t: 'friends', list: [{ name: 'Amy', on: 1, id: a }], asks: [] });
    await w.say('a', { t: 'friendAdd', name: 'Bob' });
    assert.equal(w.last('a', 'friendNote').what, 'already');
    await w.say('a', { t: 'friendAdd', name: 'Amy' });
    assert.equal(w.last('a', 'friendNote').what, 'self');
    await w.say('a', { t: 'friendAdd', name: 'Nobody' });
    assert.deepEqual(w.last('a', 'friendNote'), { t: 'friendNote', what: 'notFound', name: 'Nobody' });

    // Bob 下線：Amy 看到離線，名字仍記得；重新上線再看到上線
    w.leave('b');
    assert.deepEqual(w.last('a', 'friends').list, [{ name: 'Bob', on: 0 }]);
    const b2 = await w.join('b2', 'Bobby', 11); // 換了角色名
    assert.deepEqual(w.last('a', 'friends').list, [{ name: 'Bobby', on: 1, id: b2 }]);
    assert.deepEqual(w.last('b2', 'friends').list, [{ name: 'Amy', on: 1, id: a }]);

    // 另一個帳號也叫 Bobby：Amy 的清單裡加 #2，用清單上的名字密語、刪除都對得到人
    const c = await w.join('c', 'Bobby', '12');
    await w.say('c', { t: 'friendAdd', name: 'Amy' });
    await w.say('a', { t: 'friendReply', name: w.last('a', 'friends').asks[0], ok: true });
    assert.deepEqual(w.last('a', 'friends').list.map((r) => r.name), ['Bobby', 'Bobby #2']);
    await w.say('a', { t: 'whisper', to: 'Bobby #2', text: 'yo' });
    assert.equal(w.last('c', 'whisper').text, 'yo');
    await w.say('a', { t: 'friendRemove', name: 'Bobby #2' });
    assert.deepEqual(w.last('a', 'friendNote'), { t: 'friendNote', what: 'removed', name: 'Bobby #2' });
    assert.deepEqual(w.last('a', 'friends').list, [{ name: 'Bobby', on: 1, id: b2 }]);
    assert.deepEqual(w.last('c', 'friends').list, []);

    // 雙方互相邀請：第二個人送出時直接成為好友；拒絕會清掉邀請
    await w.say('c', { t: 'friendAdd', name: 'Amy' });
    await w.say('a', { t: 'friendReply', name: w.last('a', 'friends').asks[0], ok: false });
    assert.deepEqual(w.last('a', 'friends').asks, []);
    await w.say('c', { t: 'friendAdd', name: 'Amy' });
    await w.say('a', { t: 'friendAdd', id: c, name: 'Bobby' });
    assert.equal(w.last('a', 'friendNote').what, 'added');
    assert.equal(db.isFriend('12', '10'), true);

    // 訪客不能加好友
    await w.join('g', 'x');
    await w.say('g', { t: 'friendAdd', name: 'Amy' });
    assert.deepEqual(w.last('g', 'friendNote'), { t: 'friendNote', what: 'guest', name: '' });

    // 大廳重開（資料還在）：新的連線拿到同一份清單
    w = world(db);
    await w.join('a', 'Amy', '10');
    assert.equal(w.last('a', 'friends').list.length, 2);
    assert.ok(w.last('a', 'friends').list.every((r) => r.on === 0));
  });
}

test('好友上限：自己滿了回 full，對方滿了回 fullThem；離線的陌生人用名字找不到', async () => {
  const db = memoryStore();
  for (let i = 0; i < FRIEND_MAX; i++) db.addFriend('10', `x${i}`, i);
  const w = world(db);
  await w.join('a', 'Amy', 10);
  const b = await w.join('b', 'Bob', 11);
  await w.say('a', { t: 'friendAdd', id: b, name: 'Bob' });
  assert.equal(w.last('a', 'friendNote').what, 'full');
  await w.say('b', { t: 'friendAdd', name: 'Amy' });
  assert.equal(w.last('b', 'friendNote').what, 'fullThem');
  // 離線的人：只能從自己的好友清單找到，陌生人不行
  w.leave('b');
  await w.join('c', 'Cat', 12);
  await w.say('c', { t: 'friendAdd', name: 'Bob' });
  assert.equal(w.last('c', 'friendNote').what, 'notFound');
});
