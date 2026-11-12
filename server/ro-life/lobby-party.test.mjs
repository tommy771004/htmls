// 282 普隆德拉大廳：組隊與合作關卡轉送（npm run test:ro）
import test from 'node:test';
import assert from 'node:assert/strict';
import { signTicket, verifyTicket, onMessage, onClose } from './lobby-core.mjs';
import { onAlarm, INVITE_MS, CHECK_MS, PARTY_IDLE_MS, RUN_RATE, RUN_HOST_WAIT_MS, RUN_CLOSE } from './lobby-party.mjs';
import { memoryStore, sqlStore } from './lobby-store.mjs';
import { openReceipt, signer, rollDice } from './coop.mjs';

const SECRET = 'test-secret-0123456789';
const LOOK = { job: 'hunter', gender: 'f', hair: 3, hairColor: 2, cloth: 1, equip: {} };
const TRIP = { stage: 'orcs', diff: { hp: 1.2, pick: 1, bad: 'x' } };

async function sqliteStore() {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  return sqlStore((q, ...p) => { const st = db.prepare(q); return /^\s*(SELECT|WITH)|RETURNING/i.test(q) ? st.all(...p) : (st.run(...p), []); });
}

function world({ db = memoryStore() } = {}) {
  const st = new Map(), sent = [], peers = [], closed = [], wakes = [];
  const io = {
    peers: () => peers, get: (ws) => st.get(ws) ?? null, set: (ws, v) => (v ? st.set(ws, v) : st.delete(ws)),
    send: (ws, msg) => sent.push([ws, msg]), close: (ws, code) => closed.push([ws, code]),
    verify: (t, now) => verifyTicket(SECRET, t, now), db, log: () => {}, wake: (at) => wakes.push(at),
  };
  const w = {
    io, st, sent, closed, wakes, db, now: Date.now(),
    async join(ws, name, acc) {
      peers.push(ws);
      const rt = acc ? await signTicket(SECRET, { account: acc, name: 'G' }, w.now) : undefined;
      await w.say(ws, { t: 'hello', name, look: LOOK, x: 0, y: 0, f: 0, rt });
      return st.get(ws)?.id;
    },
    async run(ws, acc) {
      peers.push(ws);
      const rt = await signTicket(SECRET, { account: acc, name: 'G' }, w.now);
      await w.say(ws, { t: 'hello', run: true, name: 'ignored', look: LOOK, key: 'tabkey', rt });
    },
    leave(ws) { onClose(io, ws, w.now); peers.splice(peers.indexOf(ws), 1); },
    say: (ws, m) => onMessage(io, ws, JSON.stringify(m), (w.now += 50)),
    got: (ws, t) => sent.filter(([x, m]) => x === ws && m.t === t).map(([, m]) => m),
    last: (ws, t) => sent.filter(([x, m]) => x === ws && m.t === t).at(-1)?.[1],
    clear: () => { sent.length = 0; },
    id: (ws) => st.get(ws).id,
  };
  return w;
}
// a 邀請 b 並接受
async function pair(w, a, b) {
  await w.say(a, { t: 'partyInvite', id: w.id(b) });
  await w.say(b, { t: 'partyReply', ok: true });
}

test('邀請、接受：雙方拿到隊伍（mid、隊長、等級與裝備分數、上線與頻道）；訪客不能組隊', async () => {
  const w = world();
  await w.join('a', 'Amy', 1); await w.join('b', 'Bob', 2); await w.join('g', 'x');
  await w.say('a', { t: 'profile', p: { level: 42, gs: 900 } });
  assert.equal((await w.say('g', { t: 'partyInvite', id: w.id('a') }), w.last('g', 'partyErr').why), 'guest');
  await w.say('a', { t: 'partyInvite', id: w.id('g') });
  assert.deepEqual(w.last('a', 'partyErr'), { t: 'partyErr', why: 'guestThem', name: w.st.get('g').name });
  await w.say('a', { t: 'partyInvite', id: 999 });
  assert.equal(w.last('a', 'partyErr').why, 'offline');
  await w.say('a', { t: 'partyInvite', id: w.id('b') });
  assert.deepEqual(w.last('b', 'partyAsk'), { t: 'partyAsk', id: w.id('a'), name: 'Amy' });
  assert.equal(w.wakes.at(-1), w.now + INVITE_MS);
  await w.say('b', { t: 'partyReply', ok: true });
  const pa = w.last('a', 'party').p, pb = w.last('b', 'party').p;
  assert.equal(pa.me, 1); assert.equal(pb.me, 2); assert.equal(pa.leader, 1);
  assert.deepEqual(pa.members.map((m) => [m.mid, m.name, m.id, m.online, m.channel, m.inRun]), [[1, 'Amy', w.id('a'), true, 1, false], [2, 'Bob', w.id('b'), true, 1, false]]);
  assert.deepEqual([pa.members[0].level, pa.members[0].gs, pa.members[0].job, pa.members[0].gender], [42, 900, 'hunter', 'f']);
});

test('邀請的各種失敗：拒絕、忙碌、滿員、不是隊長、逾時', async () => {
  const w = world();
  for (const [k, n, a] of [['a', 'Amy', 1], ['b', 'Bob', 2], ['c', 'Cat', 3], ['d', 'Dan', 4], ['e', 'Eve', 5]]) await w.join(k, n, a);
  await w.say('a', { t: 'partyInvite', id: w.id('b') });
  await w.say('c', { t: 'partyInvite', id: w.id('b') });
  assert.deepEqual(w.last('c', 'partyErr'), { t: 'partyErr', why: 'busy', name: 'Bob' }); // 有待回的邀請
  await w.say('b', { t: 'partyReply', ok: false });
  assert.deepEqual(w.last('a', 'partyErr'), { t: 'partyErr', why: 'declined', name: 'Bob' });
  await pair(w, 'a', 'b');
  await w.say('b', { t: 'partyInvite', id: w.id('c') });
  assert.equal(w.last('b', 'partyErr').why, 'notLeader');
  await w.say('c', { t: 'partyInvite', id: w.id('a') });
  assert.equal(w.last('c', 'partyErr').why, 'busy');
  await pair(w, 'a', 'c');
  await w.say('a', { t: 'partyInvite', id: w.id('d') });
  assert.equal(w.last('a', 'partyErr').why, 'full');
  // 逾時：叫醒時通知雙方，之後再回覆沒有作用
  await w.say('d', { t: 'partyInvite', id: w.id('e') });
  w.now += INVITE_MS;
  onAlarm(w.io, w.now);
  assert.equal(w.last('e', 'partyErr').why, 'timeout');
  assert.deepEqual(w.last('d', 'partyErr'), { t: 'partyErr', why: 'timeout', name: 'Eve' });
  w.clear();
  await w.say('e', { t: 'partyReply', ok: true });
  assert.equal(w.got('d', 'party').length, 0);
});

test('離隊、踢人、換隊長；隊長離開換人；剩一個人解散', async () => {
  const w = world();
  for (const [k, n, a] of [['a', 'Amy', 1], ['b', 'Bob', 2], ['c', 'Cat', 3]]) await w.join(k, n, a);
  await pair(w, 'a', 'b'); await pair(w, 'a', 'c');
  await w.say('b', { t: 'partyKick', mid: 3 }); // 不是隊長
  assert.equal(w.last('c', 'party').p.members.length, 3);
  await w.say('a', { t: 'partyKick', mid: 3 });
  assert.equal(w.last('c', 'party').p, null);
  assert.equal(w.last('c', 'partyErr').why, 'kicked');
  await pair(w, 'a', 'c');
  await w.say('a', { t: 'partyLead', mid: 2 });
  assert.equal(w.last('c', 'party').p.leader, 2);
  await w.say('b', { t: 'partyLeave' });
  assert.equal(w.last('b', 'party').p, null);
  assert.equal(w.last('a', 'party').p.leader, w.last('a', 'party').p.members[0].mid);
  await w.say('c', { t: 'partyLeave' });
  assert.equal(w.last('a', 'party').p, null); // 只剩一個人：解散
});

test('出發確認：全員按好才 partyStart；有人拒絕、隊長取消、不在廣場、逾時都會結束', async () => {
  const w = world();
  for (const [k, n, a] of [['a', 'Amy', 1], ['b', 'Bob', 2], ['c', 'Cat', 3]]) await w.join(k, n, a);
  await pair(w, 'a', 'b'); await pair(w, 'a', 'c');
  await w.say('b', { t: 'partyGo', trip: TRIP }); // 不是隊長
  assert.equal(w.got('a', 'partyCheck').length, 0);
  await w.say('a', { t: 'partyGo', trip: TRIP });
  const ck = w.last('c', 'partyCheck');
  assert.deepEqual(ck, { t: 'partyCheck', trip: { stage: 'orcs', diff: { hp: 1.2, pick: 1 } }, ready: [1] });
  await w.say('b', { t: 'partyReady', ok: false });
  assert.deepEqual(w.last('a', 'partyCheckEnd'), { t: 'partyCheckEnd', why: 'declined', name: 'Bob' });
  await w.say('a', { t: 'partyGo', trip: TRIP });
  await w.say('a', { t: 'partyReady', ok: false });
  assert.equal(w.last('b', 'partyCheckEnd').why, 'cancel');
  await w.say('a', { t: 'partyGo', trip: TRIP });
  w.now += CHECK_MS; onAlarm(w.io, w.now);
  assert.equal(w.last('c', 'partyCheckEnd').why, 'timeout');
  await w.say('a', { t: 'partyGo', trip: TRIP });
  await w.say('b', { t: 'partyReady', ok: true });
  assert.deepEqual(w.last('c', 'partyCheck').ready, [1, 2]);
  await w.say('c', { t: 'partyReady', ok: true });
  for (const k of ['a', 'b', 'c']) assert.deepEqual(w.last(k, 'partyStart').trip, ck.trip);
  // 有人不在廣場就不能出發
  w.leave('c');
  w.clear();
  await w.say('a', { t: 'partyGo', trip: TRIP });
  assert.deepEqual(w.last('a', 'partyCheckEnd'), { t: 'partyCheckEnd', why: 'away', name: 'Cat' });
});

test('隊伍頻道只送隊員；被禁言不能說；不在隊伍的 party 聊天沒有作用', async () => {
  const w = world();
  for (const [k, n, a] of [['a', 'Amy', 1], ['b', 'Bob', 2], ['c', 'Cat', 3]]) await w.join(k, n, a);
  await pair(w, 'a', 'b');
  await w.say('a', { t: 'chat', ch: 'party', text: 'go go' });
  assert.deepEqual(w.got('b', 'chat').map((m) => [m.ch, m.name, m.text]), [['party', 'Amy', 'go go']]);
  assert.equal(w.got('c', 'chat').length, 0);
  w.clear();
  await w.say('c', { t: 'chat', ch: 'party', text: 'nobody' });
  assert.equal(w.sent.filter(([, m]) => m.t === 'chat').length, 0);
  w.db.setMute('2', w.now + 60_000, 'x', 'Bob', w.now);
  await w.say('b', { t: 'chat', ch: 'party', text: 'hi' });
  assert.equal(w.last('b', 'chatErr').e, 'muted');
  assert.equal(w.got('a', 'chat').length, 0);
  assert.deepEqual(w.db.recentChat('1').map((r) => r.kind), ['party']); // 檢舉證據包含隊伍頻道
});

test('合作關卡：本局連線靠入場票對到隊伍；歡迎、加入、轉送只給隊友、房主交接、全部離開結束這一趟', async () => {
  const w = world();
  for (const [k, n, a] of [['a', 'Amy', 1], ['b', 'Bob', 2], ['c', 'Cat', 3], ['x', 'Xen', 9]]) await w.join(k, n, a);
  await pair(w, 'a', 'b'); await pair(w, 'a', 'c');
  await w.run('ra0', 1); // 還沒出發：拒絕
  assert.deepEqual(w.closed.at(-1), ['ra0', RUN_CLOSE]);
  await w.say('a', { t: 'partyGo', trip: TRIP });
  await w.say('b', { t: 'partyReady', ok: true }); await w.say('c', { t: 'partyReady', ok: true });
  await w.run('rx', 9); // 不是隊員
  assert.deepEqual(w.closed.at(-1), ['rx', RUN_CLOSE]);
  await w.run('rb', 2);
  assert.deepEqual(w.last('rb', 'runWelcome'), { t: 'runWelcome', me: 2, host: 1, mates: [], roll: 0 }); // 隊長還沒進來，先等它
  await w.run('ra', 1);
  assert.deepEqual(w.last('ra', 'runWelcome'), { t: 'runWelcome', me: 1, host: 1, mates: [{ mid: 2, name: 'Bob', look: LOOK }], roll: 0 });
  assert.deepEqual(w.last('rb', 'runJoin').m.mid, 1);
  assert.equal(w.last('c', 'party').p.members.find((m) => m.mid === 1).inRun, true);
  await w.run('rc', 3);
  w.clear();
  await w.say('ra', { t: 'run', d: { k: 'go', secs: 3 } });
  assert.deepEqual(w.last('rb', 'run'), { t: 'run', from: 1, d: { k: 'go', secs: 3 } });
  assert.equal(w.got('ra', 'run').length, 0);
  assert.equal(w.got('x', 'run').length + w.got('a', 'run').length, 0);
  // 本局裡的隊伍聊天：本局與大廳的隊員都收到
  await w.say('rb', { t: 'chat', ch: 'party', text: 'nice' });
  assert.equal(w.last('rc', 'chat').text, 'nice');
  assert.equal(w.last('c', 'chat').text, 'nice');
  // 每秒上限
  w.clear();
  for (let i = 0; i < RUN_RATE + 10; i++) await onMessage(w.io, 'rb', JSON.stringify({ t: 'run', d: i }), w.now);
  assert.equal(w.got('ra', 'run').length, RUN_RATE);
  // 房主離開：交給隊長以外的人（隊長就是房主時交給下一個）
  w.leave('ra');
  assert.deepEqual(w.last('rb', 'runLeave'), { t: 'runLeave', mid: 1 });
  assert.equal(w.last('rc', 'runHost').mid, 2);
  w.leave('rb'); w.leave('rc');
  assert.equal(w.io.parties.values().next().value.run, null); // 這一趟結束，隊伍還在
  assert.equal(w.last('a', 'party').p.members.length, 3);
});

test('房主一直沒連進本局：等一段時間後讓先到的人當房主', async () => {
  const w = world();
  await w.join('a', 'Amy', 1); await w.join('b', 'Bob', 2);
  await pair(w, 'a', 'b');
  await w.say('a', { t: 'partyGo', trip: TRIP }); await w.say('b', { t: 'partyReady', ok: true });
  w.now += RUN_HOST_WAIT_MS;
  await w.run('rb', 2);
  assert.equal(w.last('rb', 'runWelcome').host, 2);
});

test('隊伍存在 SQLite：物件重啟後還在；所有人離線太久才解散', async () => {
  const db = await sqliteStore();
  const w = world({ db });
  await w.join('a', 'Amy', 1); await w.join('b', 'Bob', 2);
  await pair(w, 'a', 'b');
  // 模擬 DO 休眠後醒來：新的 io 快取、同一份資料庫
  delete w.io.parties;
  w.leave('a');
  assert.equal(w.last('b', 'party').p.members.find((m) => m.mid === 1).online, false);
  w.leave('b');
  onAlarm(w.io, w.now + PARTY_IDLE_MS - 1000);
  assert.equal(db.parties().length, 1);
  await w.join('a2', 'Amy', 1);
  assert.equal(w.last('a2', 'party').p.members.length, 2); // 回到廣場還在隊伍裡
  w.leave('a2');
  onAlarm(w.io, w.now + PARTY_IDLE_MS);
  assert.equal(db.parties().length, 0);
});

test('本局中被踢：關掉它的本局連線（不會自動重連的 4000）、其他人收到離開與新房主；同帳號第二個分頁取代第一個', async () => {
  const w = world();
  for (const [k, n, a] of [['a', 'Amy', 1], ['b', 'Bob', 2], ['c', 'Cat', 3]]) await w.join(k, n, a);
  await pair(w, 'a', 'b'); await pair(w, 'a', 'c');
  await w.say('a', { t: 'partyGo', trip: TRIP });
  await w.say('b', { t: 'partyReady', ok: true }); await w.say('c', { t: 'partyReady', ok: true });
  await w.run('ra', 1); await w.run('rb', 2); await w.run('rc', 3);
  await w.run('rc2', 3); // 同帳號另一個分頁
  assert.deepEqual(w.closed.at(-1), ['rc', RUN_CLOSE]);
  w.clear();
  await w.say('a', { t: 'partyKick', mid: 3 });
  assert.deepEqual(w.closed.at(-1), ['rc2', RUN_CLOSE]);
  assert.deepEqual(w.last('rb', 'runLeave'), { t: 'runLeave', mid: 3 });
  await w.say('rc2', { t: 'run', d: 1 }); // 已經不是隊員：不轉送
  assert.equal(w.got('rb', 'run').length, 0);
  // 房主（隊長）離隊：本局換房主
  await w.say('a', { t: 'partyLeave' });
  assert.equal(w.got('ra', 'run').length, 0);
  assert.equal(w.last('b', 'party').p, null); // 只剩一人：解散，最後的本局連線也關掉
  assert.deepEqual(w.closed.at(-1), ['rb', RUN_CLOSE]);
});

test('本局連線可以送大封包（大波怪的 mobs），大廳連線超過 16 KB 會被關掉；換頻道後隊伍框的頻道更新', async () => {
  const w = world();
  await w.join('a', 'Amy', 1); await w.join('b', 'Bob', 2);
  await pair(w, 'a', 'b');
  await w.say('a', { t: 'partyGo', trip: TRIP }); await w.say('b', { t: 'partyReady', ok: true });
  await w.run('ra', 1); await w.run('rb', 2);
  const big = { k: 'mobs', u: Array.from({ length: 900 }, (_, i) => [i, 6000, 6000, 100, 0, 1, 0, 0]) };
  assert.ok(JSON.stringify(big).length > 16384);
  w.clear();
  await w.say('ra', { t: 'run', d: big });
  assert.equal(w.last('rb', 'run').d.u.length, 900);
  await w.say('a', { t: 'chat', ch: 'local', text: 'x'.repeat(17000) });
  assert.deepEqual(w.closed.at(-1), ['a', 1009]);
  await w.say('b', { t: 'hop', n: 3 });
  assert.equal(w.last('b', 'party').p.members.find((m) => m.mid === 2).channel, 3);
});

// ---- 獎勵裁決：行程收據、伺服器擲骰、結算收據 ----
// 兩人隊出發並連進本局；sr＝各自的頁面支不支援伺服器擲骰
async function trip(w, { sr = [1, 1], third = false } = {}) {
  w.io.sign = signer(SECRET);
  await w.join('a', 'Amy', 1); await w.join('b', 'Bob', 2);
  await pair(w, 'a', 'b');
  if (third) { await w.join('c', 'Cat', 3); await pair(w, 'a', 'c'); }
  await w.say('a', { t: 'partyGo', trip: TRIP });
  await w.say('b', { t: 'partyReady', ok: true });
  if (third) await w.say('c', { t: 'partyReady', ok: true });
  const hello = async (ws, acc, s) => {
    w.io.peers().push(ws);
    await w.say(ws, { t: 'hello', run: true, name: 'x', look: LOOK, rt: await signTicket(SECRET, { account: acc, name: 'G' }, w.now), ...(s ? { sr: 1 } : {}) });
  };
  await hello('ra', 1, sr[0]); await hello('rb', 2, sr[1]);
  if (third) await hello('rc', 3, 1);
  w.clear();
}
const runs = (w, ws, k) => w.got(ws, 'run').filter((m) => m.d.k === k);

test('行程收據：出發時每個隊員一張，簽章綁帳號、關卡、人數；沒有 io.sign 就照舊', async () => {
  const w = world();
  w.io.sign = signer(SECRET);
  await w.join('a', 'Amy', 1); await w.join('b', 'Bob', 2);
  await pair(w, 'a', 'b');
  await w.say('a', { t: 'partyGo', trip: TRIP });
  await w.say('b', { t: 'partyReady', ok: true });
  const ra = await openReceipt(SECRET, 'trip', w.last('a', 'partyStart').rc), rb = await openReceipt(SECRET, 'trip', w.last('b', 'partyStart').rc);
  assert.deepEqual([ra.a, ra.stage, ra.n, rb.a, rb.tid], ['1', 'orcs', 2, '2', ra.tid]);
  // 換個種類、換把密鑰、改內容都驗不過
  const rc = w.last('a', 'partyStart').rc;
  assert.equal(await openReceipt(SECRET, 'tripend', rc), null);
  assert.equal(await openReceipt('other-secret', 'trip', rc), null);
  assert.equal(await openReceipt(SECRET, 'trip', { p: rc.p.replace('"n":2', '"n":3'), sig: rc.sig }), null);
  const old = world();
  await old.join('a', 'Amy', 1); await old.join('b', 'Bob', 2);
  await pair(old, 'a', 'b');
  await old.say('a', { t: 'partyGo', trip: TRIP });
  await old.say('b', { t: 'partyReady', ok: true });
  assert.deepEqual(old.last('b', 'partyStart'), { t: 'partyStart', trip: { stage: 'orcs', diff: { hp: 1.2, pick: 1 } } });
});

test('擲骰規則：需求優先於貪婪、放棄不擲、同分再擲', () => {
  const seq = (xs) => { let i = 0; return () => xs[i++ % xs.length]; };
  assert.deepEqual(rollDice([1, 2, 3], { 1: 'greed', 2: 'need', 3: 'pass' }, seq([99, 5])), { r: [[1, 'greed', 99], [2, 'need', 5], [3, 'pass', 0]], win: 2 });
  assert.equal(rollDice([1, 2], {}, seq([50])).win, 0); // 沒人選＝都放棄
  assert.equal(rollDice([1, 2], { 1: 'greed', 2: 'greed' }, seq([40, 40, 7, 90])).win, 2); // 同分再擲
});

test('伺服器擲骰：房主開骰、大家選、大廳擲；房主自己宣布的結果不算；到期與結束時補擲', async () => {
  const w = world();
  await trip(w, { third: true });
  assert.equal(w.st.get('ra').sr, 1);
  // 開骰照常轉給隊員；選擇不轉送，全員選完才有結果
  await w.say('ra', { t: 'run', d: { k: 'roll', id: 1, kind: 'card', ref: 4001, quality: 0, secs: 20 } });
  assert.deepEqual(runs(w, 'rb', 'roll').map((m) => [m.from, m.d.ref]), [[1, 4001]]);
  await w.say('rb', { t: 'run', d: { k: 'rollPick', id: 1, c: 'need' } });
  await w.say('ra', { t: 'run', d: { k: 'rollPick', id: 1, c: 'greed' } });
  assert.equal(runs(w, 'ra', 'rollPick').length + runs(w, 'rc', 'rollPick').length, 0);
  assert.equal(runs(w, 'ra', 'rolled').length, 0);
  // 房主偷送結果：丟掉
  await w.say('ra', { t: 'run', d: { k: 'rolled', id: 1, r: [[1, 'need', 100]], win: 1 } });
  assert.equal(runs(w, 'rb', 'rolled').length, 0);
  // 選過不能改；不是 need／greed／pass 的不收
  await w.say('rb', { t: 'run', d: { k: 'rollPick', id: 1, c: 'pass' } });
  await w.say('rc', { t: 'run', d: { k: 'rollPick', id: 1, c: 'mine' } });
  await w.say('rc', { t: 'run', d: { k: 'rollPick', id: 1, c: 'greed' } });
  for (const ws of ['ra', 'rb', 'rc']) {
    const m = runs(w, ws, 'rolled');
    assert.equal(m.length, 1);
    assert.deepEqual([m[0].from, m[0].d.id, m[0].d.win, m[0].d.r.map((x) => x[1])], [0, 1, 2, ['greed', 'need', 'greed']]); // 只有 Bob 選需求
  }
  // 沒人選：到期由 alarm 擲（都當放棄，沒人拿）
  w.clear();
  await w.say('ra', { t: 'run', d: { k: 'roll', id: 2, kind: 'loot', ref: 1104, quality: 2, secs: 20 } });
  assert.ok(w.wakes.at(-1) > w.now + 20_000);
  onAlarm(w.io, w.now + 5_000);
  assert.equal(runs(w, 'rb', 'rolled').length, 0);
  onAlarm(w.io, w.wakes.at(-1) + 1);
  assert.deepEqual(runs(w, 'rb', 'rolled').map((m) => [m.d.id, m.d.win]), [[2, 0]]);
  // 隊員不能開骰；結束（rollEnd、over）時還沒擲的現在擲，結果排在 over 前面
  w.clear();
  await w.say('rb', { t: 'run', d: { k: 'roll', id: 9, kind: 'card', ref: 4002, quality: 0, secs: 20 } });
  assert.equal(runs(w, 'ra', 'roll').length, 0);
  await w.say('ra', { t: 'run', d: { k: 'roll', id: 3, kind: 'loot', ref: 1105, quality: 1, secs: 20 } });
  await w.say('ra', { t: 'run', d: { k: 'rollPick', id: 3, c: 'greed' } });
  await w.say('ra', { t: 'run', d: { k: 'rollEnd' } });
  assert.deepEqual(runs(w, 'ra', 'rolled').map((m) => [m.d.id, m.d.win]), [[3, 1]]);
  assert.equal(runs(w, 'rb', 'rollEnd').length, 0);
  await w.say('ra', { t: 'run', d: { k: 'roll', id: 4, kind: 'egg', ref: 9001, quality: 0, secs: 20 } });
  await w.say('rc', { t: 'run', d: { k: 'rollPick', id: 4, c: 'need' } });
  await w.say('ra', { t: 'run', d: { k: 'mobs', n: [[7, 'poring', 0, 30, 1, 1, 30], [8, 'mastering', 0, 9000, 1, 1, 9000], [9, 'drops', 0, 30, 1, 1, 30]], u: [], d: [8], g: [9] } });
  await w.say('ra', { t: 'run', d: { k: 'over', win: true } });
  const order = w.got('rb', 'run').map((m) => m.d.k).filter((k) => k === 'rolled' || k === 'over');
  assert.deepEqual(order.slice(-2), ['rolled', 'over']);
  // 結算收據：每個人一張，各自的連線秒數與擲骰拿到的東西
  const rc = Object.fromEntries(await Promise.all(['ra', 'rb', 'rc'].map(async (ws) => [ws, await openReceipt(SECRET, 'tripend', w.last(ws, 'runReceipt').rc)])));
  assert.deepEqual([rc.ra.a, rc.ra.host, rc.ra.end, rc.ra.n, rc.ra.full, rc.ra.rolls], ['1', true, 'win', 3, true, 4]);
  assert.deepEqual([rc.ra.won, rc.rb.won, rc.rc.won], [[['loot', 1105, 1]], [['card', 4001, 0]], [['egg', 9001, 0]]]);
  assert.deepEqual(rc.rb.killed, ['mastering']); // 只有打倒的，消失的不算
  assert.ok(rc.rb.secs >= 0 && rc.rb.tid === rc.ra.tid && rc.rb.host === false);
  // 頁面也可以自己來要（提早離開的人）
  w.clear();
  await w.say('rb', { t: 'runEnd' });
  assert.equal((await openReceipt(SECRET, 'tripend', w.last('rb', 'runReceipt').rc)).a, '2');
});

test('伺服器擲骰：等的人斷線就不等他；房主換成舊頁面時改回房主擲，掉落帳標成不完整', async () => {
  const w = world();
  await trip(w, { sr: [1, 0] });
  await w.say('ra', { t: 'run', d: { k: 'roll', id: 1, kind: 'card', ref: 4001, quality: 0, secs: 20 } });
  await w.say('ra', { t: 'run', d: { k: 'rollPick', id: 1, c: 'greed' } });
  assert.equal(runs(w, 'ra', 'rolled').length, 0);
  // 舊頁面的隊員收到的結果要像是房主送的（from＝房主），它才認
  await w.say('ra', { t: 'run', d: { k: 'roll', id: 2, kind: 'card', ref: 4002, quality: 0, secs: 20 } });
  await w.say('rb', { t: 'run', d: { k: 'rollPick', id: 2, c: 'need' } });
  await w.say('ra', { t: 'run', d: { k: 'rollPick', id: 2, c: 'pass' } });
  assert.deepEqual([runs(w, 'rb', 'rolled')[0].from, runs(w, 'ra', 'rolled')[0].from, runs(w, 'rb', 'rolled')[0].d.win], [1, 0, 2]);
  // Bob 斷線：第 1 顆骰只剩房主，馬上擲
  w.clear();
  w.leave('rb');
  assert.deepEqual(runs(w, 'ra', 'rolled').map((m) => [m.d.id, m.d.win]), [[1, 1]]);
  // 房主也走了、Bob（舊頁面）回來當房主：改回房主自己擲，大廳照它宣布的記
  w.io.peers().push('rb2');
  await w.say('rb2', { t: 'hello', run: true, name: 'x', look: LOOK, rt: await signTicket(SECRET, { account: 2, name: 'G' }, w.now) });
  w.leave('ra');
  assert.deepEqual(w.last('rb2', 'runHost'), { t: 'runHost', mid: 2, roll: 0 });
  await w.say('rb2', { t: 'run', d: { k: 'roll', id: 5, kind: 'card', ref: 4003, quality: 0, secs: 20 } });
  await w.say('rb2', { t: 'run', d: { k: 'rolled', id: 5, r: [[2, 'need', 77]], win: 2 } });
  await w.say('rb2', { t: 'runEnd' });
  const rc = await openReceipt(SECRET, 'tripend', w.last('rb2', 'runReceipt').rc);
  assert.deepEqual([rc.full, rc.host, rc.won], [false, true, [['card', 4002, 0], ['card', 4003, 0]]]);
});

test('io.requireSr：不支援伺服器擲骰的頁面進不了本局', async () => {
  const w = world();
  w.io.requireSr = true;
  await trip(w, { sr: [1, 0] });
  assert.equal(w.st.get('ra')?.run > 0, true);
  assert.equal(w.st.get('rb'), undefined);
  assert.deepEqual(w.closed.at(-1), ['rb', RUN_CLOSE]);
});
