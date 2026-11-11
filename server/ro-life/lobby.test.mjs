// 282 普隆德拉大廳：入場票、清理與本機 WebSocket 伺服器（npm run test:ro）
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { WebSocket } from 'ws';
import { createRoLobby } from './lobby.mjs';
import { signTicket, verifyTicket, cleanLook, onMessage, onClose, MAX_PLAYERS } from './lobby-core.mjs';
import { createRoLife } from './server.mjs';
import { RoStore } from './store.mjs';

const SECRET = 'test-secret-0123456789';
const LOOK = { job: 'hunter', gender: 'f', hair: 3, hairColor: 2, cloth: 1, equip: { headTop: 2220, weapon: 1701 } };

test('入場票：簽了能驗，改內容、換密鑰、過期都不行', async () => {
  const now = 1_000_000;
  const t = await signTicket(SECRET, { account: 2000001, name: 'Tommy' }, now);
  assert.equal((await verifyTicket(SECRET, t, now + 1000)).a, 2000001);
  assert.equal(await verifyTicket('other', t, now), null);
  assert.equal(await verifyTicket(SECRET, t, now + 16 * 60_000), null);
  const [body, sig] = t.split('.');
  const forged = Buffer.from(JSON.stringify({ a: 1, n: 'x', exp: now + 9e9 })).toString('base64url');
  assert.equal(await verifyTicket(SECRET, `${forged}.${sig}`, now), null);
  assert.equal(await verifyTicket(SECRET, `${body}.${sig}.x`, now), null);
  assert.equal(await verifyTicket(SECRET, 'garbage', now), null);
});

test('外觀只留引擎會送的欄位', () => {
  assert.deepEqual(cleanLook({ ...LOOK, evil: '<img>', equip: { weapon: 1701, x: 5, headMid: 'a' }, pet: 'poring', promotion: 'sniper' }), {
    job: 'hunter', promotion: 'sniper', gender: 'f', hair: 3, hairColor: 2, cloth: 1, equip: { weapon: 1701 }, pet: 'poring',
  });
  assert.equal(cleanLook({ job: '../x' }), null);
  assert.equal(cleanLook(null), null);
  assert.equal(cleanLook({ ...LOOK, hair: 1e9 }).hair, 999);
});

// 用記憶體的假 io 直接測核心
function fakeIo() {
  const st = new Map(), sent = [], closed = [];
  const peers = [];
  return {
    peers: () => peers, get: (ws) => st.get(ws) ?? null, set: (ws, v) => (v ? st.set(ws, v) : st.delete(ws)),
    send: (ws, msg) => sent.push([ws, msg]), close: (ws, code) => closed.push([ws, code]),
    verify: (t, now) => verifyTicket(SECRET, t, now), add: (ws) => peers.push(ws), sent, closed, st,
  };
}

test('核心：人滿就關、訪客不能聊天、聊天限速、離開會通知', async () => {
  const io = fakeIo();
  const now = Date.now();
  const rt = await signTicket(SECRET, { account: 7, name: 'A' }, now);
  io.add('a'); await onMessage(io, 'a', JSON.stringify({ t: 'hello', name: 'A<b>', look: LOOK, x: 10, y: 20, f: 3, rt }), now);
  io.add('g'); await onMessage(io, 'g', JSON.stringify({ t: 'hello', name: 'Guest', look: LOOK, x: 1, y: 1, f: 0 }), now);
  assert.equal(io.st.get('a').name, 'Ab');
  assert.equal(io.st.get('a').guest, false);
  assert.equal(io.st.get('g').guest, true);
  assert.match(io.st.get('g').name, /^冒險者 \d{4}$/); // 訪客不能用自填的名字
  io.sent.length = 0;
  await onMessage(io, 'g', JSON.stringify({ t: 'chat', ch: 'local', text: 'hi' }), now);
  assert.deepEqual(io.sent, [['g', { t: 'chatErr', e: 'guest' }]]);
  io.sent.length = 0;
  for (let i = 0; i < 6; i++) await onMessage(io, 'a', JSON.stringify({ t: 'chat', ch: 'local', text: `m${i}` }), now);
  assert.equal(io.sent.filter(([, m]) => m.t === 'chat').length, 5 * 2); // 前 5 句送給兩個人
  assert.deepEqual(io.sent.at(-1), ['a', { t: 'chatErr', e: 'rate' }]);
  io.sent.length = 0;
  const gid = io.st.get('g').id;
  onClose(io, 'g');
  assert.deepEqual(io.sent, [['a', { t: 'leave', id: gid }]]);
  // 人滿
  const full = fakeIo();
  for (let i = 0; i < MAX_PLAYERS; i++) { full.add(i); full.st.set(i, { id: i + 1, name: 'x', look: LOOK, x: 0, y: 0, f: 0 }); }
  full.add('late'); await onMessage(full, 'late', JSON.stringify({ t: 'hello', name: 'Late', look: LOOK }), now);
  assert.deepEqual(full.closed, [['late', 1013]]);
});

test('核心：驗票較慢時同時進來的兩個人仍然互相看得到', async () => {
  const io = fakeIo();
  io.verify = (t, now) => new Promise((r) => setTimeout(() => r(verifyTicket(SECRET, t, now)), 30));
  const now = Date.now();
  const rt = await signTicket(SECRET, { account: 9, name: 'S' }, now);
  io.add('a'); io.add('b');
  await Promise.all([
    onMessage(io, 'a', JSON.stringify({ t: 'hello', name: 'Slow', look: LOOK, rt }), now),
    onMessage(io, 'b', JSON.stringify({ t: 'hello', name: 'Fast', look: LOOK }), now),
  ]);
  const welcomeA = io.sent.find(([w, m]) => w === 'a' && m.t === 'welcome')[1];
  const joinsToB = io.sent.filter(([w, m]) => w === 'b' && m.t === 'join');
  assert.equal(welcomeA.players.length, 1); // 慢的人看得到快的人
  assert.equal(joinsToB.length, 1); // 快的人收到慢的人加入
  // 驗票期間斷線就不加入
  const io2 = fakeIo();
  io2.verify = () => new Promise((r) => setTimeout(() => r(null), 20));
  io2.add('x');
  const p = onMessage(io2, 'x', JSON.stringify({ t: 'hello', name: 'Gone', look: LOOK, rt: 'a.b' }), now);
  onClose(io2, 'x');
  await p;
  assert.equal(io2.st.get('x'), undefined);
  assert.equal(io2.sent.length, 0);
});

async function boot() {
  const lobby = createRoLobby({ secret: SECRET });
  const server = createServer((req, res) => { res.writeHead(404); res.end(); });
  server.on('upgrade', (req, socket, head) => { if (!lobby.handleUpgrade(req, socket, head)) socket.destroy(); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  return { port, lobby, close: () => { lobby.close(); return new Promise((r) => server.close(r)); } };
}

function client(port, l = 1) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/api/ro/lobby?l=${l}`);
  const inbox = [];
  const waiters = [];
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    inbox.push(m);
    for (const w of [...waiters]) if (w.pred(m)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(m); }
  });
  const next = (pred, ms = 2000) => {
    const hit = inbox.find(pred);
    if (hit) { inbox.splice(inbox.indexOf(hit), 1); return Promise.resolve(hit); }
    return new Promise((resolve, reject) => {
      const w = { pred: (m) => { if (pred(m)) { inbox.splice(inbox.indexOf(m), 1); return true; } return false; }, resolve };
      waiters.push(w);
      setTimeout(() => reject(Error('timeout')), ms);
    });
  };
  const open = new Promise((r) => ws.on('open', r));
  return { ws, inbox, next, open, send: (m) => ws.send(JSON.stringify(m)) };
}

test('本機伺服器：兩個人互相看得到，走動、外觀、表情、聊天會轉送，離開會消失', async () => {
  const t = await boot();
  const a = client(t.port), b = client(t.port);
  await Promise.all([a.open, b.open]);
  a.send({ t: 'hello', v: 15, name: 'Tommy', look: LOOK, x: 100, y: 200, f: 0, rt: await signTicket(SECRET, { account: 1, name: 'T' }) });
  const wa = await a.next((m) => m.t === 'welcome');
  assert.deepEqual(wa.players, []);
  b.send({ t: 'hello', v: 15, name: 'Ann', look: { ...LOOK, job: 'priest' }, x: 300, y: 400, f: 64, rt: await signTicket(SECRET, { account: 2, name: 'A' }) });
  const wb = await b.next((m) => m.t === 'welcome');
  assert.equal(wb.players.length, 1);
  assert.equal(wb.players[0].name, 'Tommy');
  const join = await a.next((m) => m.t === 'join');
  assert.equal(join.p.name, 'Ann');
  assert.equal(join.p.id, wb.id);

  a.send({ t: 'move', x: 110, y: 210, f: 32 });
  assert.deepEqual((await b.next((m) => m.t === 'moves')).m, [[wa.id, 110, 210, 32]]);
  a.send({ t: 'look', look: { ...LOOK, hair: 7 } });
  assert.equal((await b.next((m) => m.t === 'look')).look.hair, 7);
  b.send({ t: 'emote', e: 5 });
  assert.deepEqual(await a.next((m) => m.t === 'emote'), { t: 'emote', id: wb.id, e: 5 });
  b.send({ t: 'chat', ch: 'local', text: '哈囉 <script>' });
  const chat = await a.next((m) => m.t === 'chat');
  assert.equal(chat.text, '哈囉 script');
  assert.equal(chat.name, 'Ann');
  await b.next((m) => m.t === 'chat'); // 自己也會收到（引擎靠伺服器回送顯示自己的話）
  a.send({ t: 'channels' });
  assert.deepEqual(await a.next((m) => m.t === 'channels'), { t: 'channels', c: [[1, 2]], me: 1 });

  b.ws.close();
  assert.deepEqual(await a.next((m) => m.t === 'leave'), { t: 'leave', id: wb.id });
  a.ws.close();
  await t.close();
});

test('本機伺服器：不同大廳互不相見、壞的入場票當訪客、不合法的大廳編號拒絕', async () => {
  const t = await boot();
  const a = client(t.port, 1), b = client(t.port, 2);
  await Promise.all([a.open, b.open]);
  a.send({ t: 'hello', name: 'One', look: LOOK, x: 0, y: 0, f: 0, rt: 'bad.ticket' });
  b.send({ t: 'hello', name: 'Two', look: LOOK, x: 0, y: 0, f: 0 });
  assert.deepEqual((await a.next((m) => m.t === 'welcome')).players, []);
  assert.deepEqual((await b.next((m) => m.t === 'welcome')).players, []);
  a.send({ t: 'chat', ch: 'local', text: 'x' });
  assert.deepEqual(await a.next((m) => m.t === 'chatErr'), { t: 'chatErr', e: 'guest' });
  const bad = new WebSocket(`ws://127.0.0.1:${t.port}/api/ro/lobby?l=99`);
  await new Promise((r) => bad.on('error', r));
  a.ws.close(); b.ws.close();
  await t.close();
});

test('/api/ro：沒設定大廳就不給網址；本機傳進設定後 config 有網址、登入後能拿入場票', async () => {
  const res = () => ({ writeHead(s) { this.status = s; }, end(b) { this.body = JSON.parse(b); } });
  let app = createRoLife({ env: {}, store: new RoStore({}) });
  let r = res();
  await app.handle({ url: '/api/ro/config', method: 'GET', headers: {} }, r);
  assert.equal(r.body.lobby, null);
  // Vercel 上只設網址沒設密鑰也不算
  app = createRoLife({ env: { RO_LOBBY_URL: 'wss://x.workers.dev/api/ro/lobby' }, store: new RoStore({}) });
  r = res();
  await app.handle({ url: '/api/ro/config', method: 'GET', headers: {} }, r);
  assert.equal(r.body.lobby, null);
  app = createRoLife({ env: { RO_LOBBY_URL: 'wss://x.workers.dev/api/ro/lobby', RO_LOBBY_SECRET: SECRET }, store: new RoStore({}) });
  r = res();
  await app.handle({ url: '/api/ro/config', method: 'GET', headers: {} }, r);
  assert.equal(r.body.lobby, 'wss://x.workers.dev/api/ro/lobby');

  const store = new RoStore({});
  app = createRoLife({ env: {}, store, lobby: { url: '/api/ro/lobby', secret: SECRET } });
  const id = await store.loginIdentity('google', 'sub-1', '阿光');
  const token = 'tok_'.padEnd(40, 'x');
  await store.createSession(createHash('sha256').update(token).digest('hex'), id, 600);
  r = res();
  await app.handle({ url: '/api/ro/lobby-ticket', method: 'GET', headers: {} }, r);
  assert.equal(r.status, 401);
  r = res();
  await app.handle({ url: '/api/ro/lobby-ticket', method: 'GET', headers: { authorization: `Bearer ${token}` } }, r);
  assert.equal(r.status, 200);
  assert.equal((await verifyTicket(SECRET, r.body.ticket)).a, id);
  r = res();
  await app.handle({ url: '/api/ro/config', method: 'GET', headers: {} }, r);
  assert.equal(r.body.lobby, '/api/ro/lobby');
});
