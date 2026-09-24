import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { MahjongGame, scoreHand } from '../../assets/jade-table/engine.mjs';
import { createJadeServer } from './server.mjs';

// Main rule path: claiming, all three kongs, scoring, then a complete round.
test('台灣十六張行牌與逐筆結算', () => {
  const game = () => { const g = new MahjongGame({ bots: [false, false, false, false] }); g.startRound(); g.state.hands = [[], [], [], []]; g.state.flowers = [[], [], [], []]; g.state.wall = Array(30).fill(20); return g; };
  let g = game(), s = g.state;
  s.last = { p: 0, t: 2 }; s.discards[0] = [2]; s.hands[1] = [0, 1];
  assert.deepEqual(g.offers(1, 2), [{ kind: 'chow', tiles: [0, 1, 2] }]);
  s.hands[2] = [0, 1]; assert.equal(g.offers(2, 2).length, 0);
  g.openReactions(Date.now()); g.act(1, { kind: 'chow', tiles: [0, 1, 2] }, g.actionId);
  assert.equal(s.turn, 1); assert.equal(s.melds[1][0].type, 'chow'); assert.equal(s.drawn, -1);

  g = game(); s = g.state; s.last = { p: 0, t: 5 }; s.discards[0] = [5]; s.hands[2] = [5, 5, 5];
  g.openReactions(Date.now()); g.act(2, { kind: 'openKong', tile: 5 }, g.actionId);
  assert.equal(s.melds[2][0].tiles.length, 4); assert.equal(s.source, 'openKong'); assert.equal(s.hands[2].length, 1);
  g = game(); s = g.state; s.hands[0] = [5, 5, 5, 5];
  g.act(0, { kind: 'closedKong', tile: 5 }, g.actionId);
  assert.equal(s.melds[0][0].closed, true); assert.equal(s.source, 'closedKong');
  assert.deepEqual(g.view(1).melds[3][0].tiles, [null, null, null, null]);
  g = game(); s = g.state; s.melds[0] = [{ type: 'pung', tiles: [5, 5, 5], closed: false, from: 2 }]; s.hands[0] = [5];
  g.act(0, { kind: 'addedKong', tile: 5 }, g.actionId);
  assert.equal(s.melds[0][0].type, 'kong'); assert.equal(s.source, 'addedKong');

  g = game(); s = g.state; s.last = { p: 0, t: 5 }; s.discards[0] = [5];
  s.hands[1] = [3, 4]; s.hands[2] = [5, 5];
  s.hands[3] = [0, 1, 2, 9, 10, 11, 12, 13, 14, 18, 19, 20, 21, 22, 23, 5];
  g.openReactions(Date.now()); const claimId = g.actionId;
  g.act(1, { kind: 'chow', tiles: [3, 4, 5] }, claimId);
  g.act(2, { kind: 'pung', tile: 5 }, claimId);
  g.act(3, { kind: 'win' }, claimId);
  assert.equal(s.result.winner, 3); assert.equal(s.melds.flat().length, 0);
  g = game(); s = g.state; s.melds[0] = [{ type: 'pung', tiles: [5, 5, 5], closed: false, from: 2 }]; s.hands[0] = [5];
  s.hands[1] = [3, 4, 9, 10, 11, 12, 13, 14, 18, 19, 20, 21, 22, 23, 27, 27];
  g.act(0, { kind: 'addedKong', tile: 5 }, g.actionId);
  g.act(1, { kind: 'win' }, g.actionId);
  assert.equal(s.result.source, 'robKong'); assert.equal(s.wall.length, 30); assert.equal(s.melds[0][0].type, 'pung');

  const hand = [0, 0, 0, 9, 9, 9, 18, 18, 18, 31, 31, 31, 32, 32, 32, 33, 33];
  const score = scoreHand({ hand, tile: 33, selfDraw: true });
  assert.equal(score.tai, 20); // 門清自摸3、小三元4、碰碰4、五暗刻8、單吊1。
  g = game(); s = g.state; s.hands[1] = hand; s.discardCount = [2, 2, 2, 2]; s.drawCount[1] = 2;
  g.finish(1, -1, 'normal');
  assert.deepEqual(s.result.payments.map(p => p.amount), [520, 500, 500]);
  assert.equal(s.result.delta.reduce((a, b) => a + b, 0), 0);

  g = new MahjongGame({ bots: [true, true, true, true] }); g.startRound();
  for (let n = 1; g.state.phase !== 'ended' && n < 500; n++) {
    g.tick(Date.now() + n * 25000); s = g.state;
    assert.equal(s.wall.length + s.hands.flat().length + s.flowers.flat().length + s.discards.flat().length + s.melds.flat().flatMap(m => m.tiles).length, 144);
  }
  assert.equal(g.state.phase, 'ended');
});

// Critical authority path: four sockets across two instances must see one game,
// never another player's hand, and cannot forge a turn. DATABASE_URL opts into Neon.
test('跨伺服器四人房：隱藏手牌、拒絕越權與斷線重連', { timeout: 30000 }, async t => {
  const apps = [createJadeServer({ port: 0, turnMs: 120000 }), createJadeServer({ port: 0, turnMs: 120000 })];
  const addresses = await Promise.all(apps.map(a => a.listen())), clients = [];
  t.after(async () => { clients.forEach(c => c.ws.terminate()); await Promise.all(apps.map(a => a.close())); });
  async function client(instance) {
    const port = addresses[instance].port, ws = new WebSocket(`ws://127.0.0.1:${port}/api/jade`, { origin: `http://127.0.0.1:${port}` });
    const queue = []; ws.on('message', raw => queue.push(JSON.parse(raw)));
    await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
    const c = { ws, send: msg => ws.send(JSON.stringify(msg)), next: async predicate => {
      const until = Date.now() + 10000;
      while (Date.now() < until) { const i = queue.findIndex(predicate); if (i >= 0) return queue.splice(i, 1)[0]; await new Promise(r => setTimeout(r, 20)); }
      throw Error('Timed out waiting for room message');
    } }; clients.push(c); return c;
  }
  const a = await client(0); a.send({ type: 'CREATE_ROOM', name: '測試東' });
  const owner = await a.next(m => m.type === 'ROOM_JOINED');
  for (let i = 1; i < 4; i++) { const c = await client(i % 2); c.send({ type: 'JOIN_ROOM', code: owner.code, name: `測試${i}` }); await c.next(m => m.type === 'ROOM_JOINED'); }
  a.send({ type: 'START_GAME' });
  const states = await Promise.all(clients.map(c => c.next(m => m.type === 'STATE_SYNC' && m.state)));
  for (const m of states) { assert.ok(m.state.hands[0].every(Number.isInteger)); assert.ok(m.state.hands.slice(1).flat().every(x => x === null)); assert.equal(m.state.wall, undefined); assert.ok(m.room.players.every(p => !('token' in p))); }
  clients[1].send({ type: 'ACTION', actionId: states[1].state.actionId, action: { kind: 'discard', index: 0 }, seat: 0 });
  assert.match((await clients[1].next(m => m.type === 'ERROR')).message, /還沒輪到/);
  a.send({ type: 'ACTION', actionId: states[0].state.actionId, action: { kind: 'discard', index: 0 } });
  await clients[2].next(m => m.type === 'STATE_SYNC' && m.state?.actionId > states[0].state.actionId);
  a.ws.terminate(); const resumed = await client(1); resumed.send({ type: 'RECONNECT', code: owner.code, token: owner.token });
  assert.equal((await resumed.next(m => m.type === 'ROOM_JOINED')).seat, 0);
});
