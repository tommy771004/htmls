// 房間邏輯（src/net/core.js）的 Node 測試：選邊、Bot 補位、轉送、斷線接手、主機離線。node --test tools/net.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomCore, GRACE_MS, HOST_GRACE_MS, SIDE_MAX } from '../src/net/core.js';

function room() {
  const box = new Map();
  const r = new RoomCore('123456', { send: (c, m) => { if (!box.has(c)) box.set(c, []); box.get(c).push(m); } });
  const conn = name => ({ name });
  const got = (c, t) => (box.get(c) || []).filter(m => m.t === t);
  const last = (c, t) => got(c, t).at(-1);
  const clear = () => box.clear();
  return { r, conn, got, last, clear };
}

test('建房、加入、不存在與撞號', () => {
  const { r, conn, last } = room();
  const a = conn('a'), b = conn('b'), x = conn('x'), y = conn('y');
  assert.equal(r.join(x, { name: 'X' }, 0), null); assert.ok(last(x, 'notfound'));
  r.join(a, { name: '甲', token: 'tokA00000', create: true }, 0);
  assert.equal(r.hostId, last(a, 'welcome').id);
  assert.equal(r.join(y, { name: 'Y', create: true }, 0), null); assert.ok(last(y, 'taken'));
  r.join(b, { name: '乙', token: 'tokB00000' }, 1);
  assert.equal(last(b, 'welcome').host, r.hostId);
  assert.equal(last(a, 'lobby').players.length, 2);
});

test('選邊上限、開賽名單用 Bot 補滿、沒選邊的放人少的一邊', () => {
  const { r, conn, last } = room();
  const cs = []; for (let i = 0; i < 7; i++) { const c = conn('p' + i); cs.push(c); r.join(c, { name: 'P' + i, create: i === 0 }, i); }
  for (let i = 0; i < 5; i++) r.message(cs[i], { t: 'side', side: 'atk' }, 10);
  r.message(cs[5], { t: 'side', side: 'atk' }, 10);
  assert.equal(last(cs[5], 'err').why, 'sidefull');
  r.message(cs[0], { t: 'start' }, 20);
  const st = last(cs[6], 'start');
  assert.equal(st.roster.length, SIDE_MAX * 2);
  assert.equal(st.roster.filter(s => s.team === 0 && s.pid).length, 5);
  assert.equal(st.roster.filter(s => s.team === 1 && s.pid).length, 2);   // p5、p6 沒選到攻方，自動到守方
  assert.equal(st.roster.filter(s => !s.pid).length, 3);
});

test('非主機不能開賽；比賽中轉送：客→主、主→客、指定對象', () => {
  const { r, conn, got, last } = room();
  const a = conn('a'), b = conn('b'), c = conn('c');
  r.join(a, { name: 'A', create: true }, 0); r.join(b, { name: 'B' }, 0); r.join(c, { name: 'C' }, 0);
  r.message(b, { t: 'start' }, 1); assert.equal(r.phase, 'lobby');
  r.message(b, { t: 'side', side: 'def' }, 1);
  r.message(a, { t: 'start' }, 2); assert.equal(r.phase, 'match');
  r.message(b, { t: 'st', s: [1, 2, 3] }, 3);
  const fwd = last(a, 'st'); assert.deepEqual(fwd.s, [1, 2, 3]); assert.equal(fwd.from, last(b, 'welcome').id);
  assert.equal(got(c, 'st').length, 0);
  r.message(a, { t: 's', a: [9] }, 4);
  assert.deepEqual(last(b, 's').a, [9]); assert.deepEqual(last(c, 's').a, [9]); assert.equal(got(a, 's').length, 0);
  r.message(a, { t: 'to', pid: last(c, 'welcome').id, m: { t: 'sync', x: 1 } }, 5);
  assert.equal(last(c, 'sync').x, 1); assert.equal(got(b, 'sync').length, 0);
  r.message(b, { t: 's', a: [1] }, 6); assert.equal(got(c, 's').length, 1);   // 非主機不能廣播快照
});

test('玩家斷線：通知主機、時限內重連接回原席位、過時限交給 Bot', () => {
  const { r, conn, last } = room();
  const a = conn('a'), b = conn('b'), b2 = conn('b2'), b3 = conn('b3');
  r.join(a, { name: 'A', create: true, token: 'hostTok01' }, 0); r.join(b, { name: 'B', token: 'bTok00001' }, 0);
  r.message(b, { t: 'side', side: 'def' }, 0); r.message(a, { t: 'start' }, 0);
  const bid = last(b, 'welcome').id, slot = r.roster.findIndex(s => s.pid === bid);
  r.leave(b, 1000); assert.equal(last(a, 'gone').pid, bid);
  r.join(b2, { token: 'bTok00001' }, 5000);
  assert.deepEqual(last(a, 'claim'), { t: 'claim', pid: bid, slot, name: 'B' });
  r.leave(b2, 6000); r.message(a, { t: 'ping' }, 6000 + GRACE_MS); r.tick(6000 + GRACE_MS + 1);   // 主機一直有心跳
  assert.equal(last(a, 'bot').slot, slot); assert.equal(r.roster[slot].pid, 0);
  // 回來算新加入：比賽中選邊會拿到一個 Bot 席位
  r.join(b3, { token: 'bTok00001', name: 'B' }, 7000 + GRACE_MS);
  r.message(b3, { t: 'side', side: 'def' }, 7001 + GRACE_MS);
  const cl = last(a, 'claim'); assert.equal(r.roster[cl.slot].pid, cl.pid); assert.equal(r.roster[cl.slot].team, 1);
});

test('主機斷線：等待後結束比賽、房主交給下一個人', () => {
  const { r, conn, last } = room();
  const a = conn('a'), b = conn('b');
  r.join(a, { name: 'A', create: true, token: 'hostTok01' }, 0); r.join(b, { name: 'B', token: 'bTok00001' }, 0);
  r.message(a, { t: 'start' }, 0);
  r.leave(a, 100); assert.ok(last(b, 'hostwait'));
  r.message(b, { t: 'ping' }, HOST_GRACE_MS); r.tick(100 + HOST_GRACE_MS - 10); assert.equal(r.phase, 'match');
  r.tick(100 + HOST_GRACE_MS + 10);
  assert.equal(r.phase, 'lobby'); assert.equal(last(b, 'ended').why, 'hostgone'); assert.equal(r.hostId, last(b, 'welcome').id);
});

test('主機時限內回來比賽繼續', () => {
  const { r, conn, last } = room();
  const a = conn('a'), a2 = conn('a2'), b = conn('b');
  r.join(a, { name: 'A', create: true, token: 'hostTok01' }, 0); r.join(b, { name: 'B' }, 0); r.message(a, { t: 'start' }, 0);
  r.leave(a, 100); r.join(a2, { token: 'hostTok01' }, 5000);
  assert.ok(last(b, 'hostback')); r.message(b, { t: 'ping' }, HOST_GRACE_MS); r.message(a2, { t: 'ping' }, HOST_GRACE_MS); r.tick(100 + HOST_GRACE_MS + 10); assert.equal(r.phase, 'match');
});

test('主機主動離開比賽：結束比賽', () => {
  const { r, conn, last } = room();
  const a = conn('a'), b = conn('b');
  r.join(a, { name: 'A', create: true }, 0); r.join(b, { name: 'B' }, 0); r.message(a, { t: 'start' }, 0);
  r.message(a, { t: 'quit' }, 10);
  assert.equal(last(b, 'ended').why, 'hostleft'); assert.equal(r.phase, 'lobby'); assert.equal(r.hostId, last(b, 'welcome').id);
});
