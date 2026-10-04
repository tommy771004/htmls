// 伺服器整合測試：好友房三人加入、房主開局、權威移動與射擊、Vercel 換線接手、快速配對。
// node --test games/199-saltcape/tools/net.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createSaltServer } from '../../../server/saltcape/server.mjs';
import { BITS } from '../src/core/rules.js';

function client(url) {
  const ws = new WebSocket(url, { headers: { origin: 'http://' + new URL(url).host } });
  const inbox = [];
  const waiters = [];
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    inbox.push(m);
    for (const w of [...waiters]) if (w.pred(m)) { waiters.splice(waiters.indexOf(w), 1); w.res(m); }
  });
  const c = {
    ws, inbox,
    open: () => new Promise((r, j) => { ws.once('open', r); ws.once('error', j); }),
    send: (m) => ws.send(JSON.stringify(m)),
    wait: (pred, ms = 8000) => {
      const hit = inbox.find(pred); if (hit) { inbox.splice(inbox.indexOf(hit), 1); return Promise.resolve(hit); }
      return new Promise((res, rej) => { const w = { pred, res }; waiters.push(w); setTimeout(() => rej(new Error('timeout')), ms); });
    },
    close: () => ws.close(),
  };
  return c;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('好友房：三人加入、開局、移動、射擊與換線接手', async () => {
  const { server, app } = createSaltServer({ target: 8 });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `ws://127.0.0.1:${server.address().port}/saltcape`;
  try {
    const a = client(url), b = client(url), c = client(url);
    await Promise.all([a.open(), b.open(), c.open()]);
    a.send({ t: 'hello', mode: 'create', name: '房主' });
    const wa = await a.wait((m) => m.t === 'welcome');
    assert.equal(wa.room.kind, 'private');
    b.send({ t: 'hello', mode: 'join', code: wa.room.code, name: '乙' });
    c.send({ t: 'hello', mode: 'join', code: wa.room.code.toLowerCase(), name: '丙' });
    const wb = await b.wait((m) => m.t === 'welcome'), wc = await c.wait((m) => m.t === 'welcome');
    assert.equal(wb.room.code, wa.room.code); assert.equal(wc.room.code, wa.room.code);
    // 不存在的房號
    const d = client(url); await d.open(); d.send({ t: 'hello', mode: 'join', code: 'ZZZZZ' });
    assert.equal((await d.wait((m) => m.t === 'err')).code, 'notfound'); d.close();
    // 非房主不能開局，房主可以
    b.send({ t: 'start' });
    await sleep(200);
    assert.ok(!b.inbox.some((m) => m.t === 'start'));
    a.send({ t: 'start' });
    const sa = await a.wait((m) => m.t === 'start', 6000);
    assert.equal(sa.players.length, 8);
    assert.equal(sa.players.filter((p) => !p.b).length, 3);
    assert.ok(sa.loot.length > 300);
    await b.wait((m) => m.t === 'start');
    // 快照只帶自己的完整狀態
    const snap = await a.wait((m) => m.t === 'snap');
    assert.equal(snap.me.mode, 0);
    assert.ok(snap.e.length >= 7);
    // 送跳機輸入
    let seq = 0;
    const press = (cl, b2, n = 1, yaw = 0, pitch = 0) => { const l = []; for (let i = 0; i < n; i++) l.push({ s: ++seq, b: b2, y: yaw, p: pitch }); cl.send({ t: 'in', l }); };
    await sleep(3600); // 運輸機飛過海岸後才能跳
    a.inbox.length = 0;
    press(a, 0); press(a, BITS.JUMP); press(a, 0);
    let s2;
    for (let k = 0; k < 40; k++) { s2 = await a.wait((m) => m.t === 'snap'); if (s2.me.mode !== 0) break; }
    assert.ok(s2.me.mode === 1 || s2.me.mode === 2, '已跳機');
    assert.ok(s2.a >= 2, '伺服器回報處理到的輸入序號');
    // 換線接手：新連線帶 token，舊連線被關閉（4000）
    const closed = new Promise((r) => b.ws.once('close', (code) => r(code)));
    const b2 = client(url); await b2.open();
    b2.send({ t: 'hello', mode: 'resume', token: wb.token });
    const rw = await b2.wait((m) => m.t === 'welcome');
    assert.equal(rw.resumed, 1); assert.equal(rw.id, wb.id);
    assert.equal(await closed, 4000);
    const rs = await b2.wait((m) => m.t === 'start');
    assert.equal(rs.you, wb.id);
    await b2.wait((m) => m.t === 'snap');
    // 錯誤 token 的接手
    const e = client(url); await e.open(); e.send({ t: 'hello', mode: 'resume', token: 'nope' });
    assert.equal((await e.wait((m) => m.t === 'err')).code, 'lost'); e.close();
    a.close(); b2.close(); c.close();
  } finally { app.close(); server.close(); }
});

test('快速配對：倒數結束自動開局，AI 補滿', async () => {
  const { server, app } = createSaltServer({ target: 6, quickWait: 1 });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `ws://127.0.0.1:${server.address().port}/saltcape`;
  try {
    const a = client(url); await a.open();
    a.send({ t: 'hello', mode: 'quick', name: '甲' });
    const w = await a.wait((m) => m.t === 'welcome');
    assert.equal(w.room.kind, 'quick');
    const s = await a.wait((m) => m.t === 'start', 6000);
    assert.equal(s.players.length, 6);
    // 第二人在運輸機還在航線前段時加入同一場
    const b = client(url); await b.open();
    b.send({ t: 'hello', mode: 'quick', name: '乙' });
    const wb = await b.wait((m) => m.t === 'welcome');
    assert.equal(wb.room.code, w.room.code);
    const sb = await b.wait((m) => m.t === 'start');
    assert.ok(sb.players.some((p) => p.id === wb.id));
    a.close(); b.close();
  } finally { app.close(); server.close(); }
});

test('拒絕其他來源的 WebSocket', async () => {
  const { server, app } = createSaltServer({});
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const ws = new WebSocket(`ws://127.0.0.1:${server.address().port}/saltcape`, { headers: { origin: 'https://evil.example' } });
    const code = await new Promise((r) => { ws.on('unexpected-response', (_q, res) => r(res.statusCode)); ws.on('open', () => r(101)); ws.on('error', () => {}); });
    assert.equal(code, 403);
  } finally { app.close(); server.close(); }
});
