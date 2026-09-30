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
  assert.equal(s.melds[1][0].claimed, 2); assert.deepEqual(s.melds[1][0].tiles, [0, 1, 2]); // Rules keep sorted tiles; the page centres the claimed one.

  g = game(); s = g.state; s.last = { p: 0, t: 5 }; s.discards[0] = [5]; s.hands[2] = [5, 5, 5];
  g.openReactions(Date.now()); g.act(2, { kind: 'openKong', tile: 5 }, g.actionId);
  assert.equal(s.melds[2][0].tiles.length, 4); assert.equal(s.source, 'openKong'); assert.equal(s.hands[2].length, 1);
  g = game(); s = g.state; s.hands[0] = [5, 5, 5, 5];
  const tailBefore = s.tailDrawn; g.act(0, { kind: 'closedKong', tile: 5 }, g.actionId);
  assert.equal(s.melds[0][0].closed, true); assert.equal(s.source, 'closedKong');
  assert.equal(s.tailDrawn, tailBefore + 1); assert.equal(g.view(0).wallTail, s.tailDrawn); // Replacement comes from the tail end.
  assert.deepEqual(g.view(1).melds[3][0].tiles, [null, null, null, null]);
  g = game(); s = g.state; s.melds[0] = [{ type: 'pung', tiles: [5, 5, 5], closed: false, from: 2 }]; s.hands[0] = [5];
  g.act(0, { kind: 'addedKong', tile: 5 }, g.actionId);
  assert.equal(s.melds[0][0].type, 'kong'); assert.equal(s.source, 'addedKong');

  g = game(); s = g.state; s.last = { p: 0, t: 5 }; s.discards[0] = [5];
  s.hands[1] = [3, 4]; s.hands[2] = [5, 5];
  s.hands[3] = [0, 1, 2, 9, 10, 11, 12, 13, 14, 18, 19, 20, 21, 22, 23, 5];
  g.openReactions(Date.now()); const claimId = g.actionId;
  g.act(3, { kind: 'win' }, claimId);
  assert.equal(s.phase, 'ended'); assert.equal(s.result.winner, 3); assert.equal(s.melds.flat().length, 0);
  assert.equal(s.result.tile, 5); assert.deepEqual(s.result.waits, [5]); assert.deepEqual(g.view(0).result.waits, [5]);
  g = game(); s = g.state; s.last = { p: 0, t: 5 }; s.discards[0] = [5];
  s.hands[1] = [0, 1, 2, 9, 10, 11, 12, 13, 14, 18, 19, 20, 21, 22, 23, 5];
  s.hands[3] = s.hands[1].slice();
  g.openReactions(Date.now()); g.act(3, { kind: 'win' }, g.actionId);
  assert.equal(s.phase, 'reaction');
  g.act(1, { kind: 'win' }, g.actionId); assert.equal(s.result.winner, 1);
  g = game(); s = g.state; s.melds[0] = [{ type: 'pung', tiles: [5, 5, 5], closed: false, from: 2 }]; s.hands[0] = [5];
  s.hands[1] = [3, 4, 9, 10, 11, 12, 13, 14, 18, 19, 20, 21, 22, 23, 27, 27];
  g.act(0, { kind: 'addedKong', tile: 5 }, g.actionId);
  g.act(1, { kind: 'win' }, g.actionId);
  assert.equal(s.result.source, 'robKong'); assert.equal(s.wall.length, 30); assert.equal(s.melds[0][0].type, 'pung');

  // Declaring ready hands the seat to auto: it wins a discard in the reaction window and otherwise discards its new tile.
  g = game(); s = g.state; s.turn = 1;
  s.hands[1] = [0, 1, 2, 9, 10, 11, 12, 13, 14, 18, 19, 20, 21, 22, 23, 5, 30]; s.drawn = 16;
  g.act(1, { kind: 'discard', index: 16, ready: true }, g.actionId);
  assert.equal(s.declared[1], true); assert.equal(s.auto[1], true); assert.equal(g.view(1).auto, true);
  g.beginTurn(2, Date.now()); s.hands[2].push(30); const now = Date.now();
  g.act(2, { kind: 'discard', index: s.hands[2].length - 1 }, g.actionId, now);
  if (s.phase === 'reaction' && s.offers[1].some(o => o.kind === 'win')) assert.fail('30 is not a winning tile');
  assert.equal(s.turn, 3); s.turn = 1; s.wall = [5, ...Array(29).fill(20)]; s.hands[3] = [];
  g.beginTurn(1, now); assert.equal(g.options(1)[0]?.kind, 'win');
  g.setAuto(1, false); assert.equal(g.tick(now + 1000), false); // Manual again: nothing happens before the deadline.
  g.setAuto(1, true); g.tick(now + 1000); assert.equal(s.phase, 'ended'); assert.equal(s.result.winner, 1); assert.equal(s.result.tile, 5);
  g = game(); s = g.state; s.turn = 1; s.hands[1] = [0, 1, 2, 9, 10, 11, 12, 13, 14, 18, 19, 20, 21, 22, 23, 5]; s.declared[1] = true; s.auto[1] = true;
  s.last = { p: 0, t: 5 }; s.discards[0] = [5]; g.openReactions(now); assert.equal(s.phase, 'reaction');
  g.tick(now + 1000); assert.equal(s.result.winner, 1); assert.equal(s.result.from, 0);
  g = game(); s = g.state; s.turn = 1; s.hands[1] = [0, 1, 2, 9, 10, 11, 12, 13, 14, 18, 19, 20, 21, 22, 23, 5]; s.declared[1] = true; s.auto[1] = true;
  g.beginTurn(1, now); const drawnTile = s.hands[1][s.drawn]; g.tick(now + 1000);
  assert.equal(s.discards[1].at(-1), drawnTile); assert.equal(s.hands[1].length, 16);

  const hand = [0, 0, 0, 9, 9, 9, 18, 18, 18, 31, 31, 31, 32, 32, 32, 33, 33];
  const score = scoreHand({ hand, tile: 33, selfDraw: true });
  assert.equal(score.tai, 20); // 門清自摸3、小三元4、碰碰4、五暗刻8、單吊1。
  g = game(); s = g.state; s.hands[1] = hand; s.discardCount = [2, 2, 2, 2]; s.drawCount[1] = 2;
  g.finish(1, -1, 'normal');
  assert.deepEqual(s.result.payments.map(p => p.amount), [520, 500, 500]);
  assert.equal(s.result.delta.reduce((a, b) => a + b, 0), 0);

  // A replacement tile in 七搶一 is drawn physically, although only the flower loser pays.
  g = game(); s = g.state;
  s.hands[0] = [0, 0, 3, 3, 3, 4, 4, 4, 6, 6, 6, 32, 32, 32];
  s.melds[0] = [{ type: 'pung', tiles: [28, 28, 28], closed: false, from: 1 }];
  s.discardCount = [2, 2, 2, 2];
  g.finish(0, 1, 'flower', { payer: 1, branch: 'rob', initial: false });
  assert.ok(s.result.scoring.items.some(i => i.name === '四暗刻' && i.tai === 5));
  assert.ok(s.result.scoring.items.some(i => i.name === '槓上開花' && i.tai === 1));
  assert.deepEqual(s.result.payments.map(p => p.from), [1]);
  assert.ok(!s.result.scoring.items.some(i => i.name.includes('自摸')));

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
  for (const [seat, m] of states.entries()) { assert.equal(m.state.names[0], seat === 0 ? '測試東' : `測試${seat}`); assert.equal(m.state.dealer, (4 - seat) % 4); assert.equal(m.state.turn, (4 - seat) % 4); assert.ok(m.state.hands[0].every(Number.isInteger)); assert.ok(m.state.hands.slice(1).flat().every(x => x === null)); assert.equal(m.state.wall, undefined); assert.ok(m.room.players.every(p => !('token' in p))); }
  clients[1].send({ type: 'ACTION', actionId: states[1].state.actionId, action: { kind: 'discard', index: 0 }, seat: 0 });
  assert.match((await clients[1].next(m => m.type === 'ERROR')).message, /還沒輪到/);
  clients[1].send({ type: 'AUTO', on: true });
  assert.match((await clients[1].next(m => m.type === 'ERROR')).message, /宣告聽牌後/);
  a.send({ type: 'ACTION', actionId: states[0].state.actionId, action: { kind: 'discard', index: 0 } });
  assert.equal((await a.next(m => m.type === 'DONE')).actionId, states[0].state.actionId); // Unlocks the mover even when chat syncs arrive first.
  await clients[2].next(m => m.type === 'STATE_SYNC' && m.state?.actionId > states[0].state.actionId);
  // Chat reaches the other instance with the speaker's seat; bad lines and rapid repeats come back as chat-scoped errors.
  // A resend with the same cid is acknowledged but stored once; a new line inside 0.8 s gets a retry hint.
  a.send({ type: 'CHAT', text: '  大家好，\n請多指教  ', cid: 'hello1' }); a.send({ type: 'CHAT', text: '大家好， 請多指教', cid: 'hello1' }); a.send({ type: 'CHAT', text: '再一句', cid: 'again1' });
  assert.equal((await a.next(m => m.type === 'CHAT_OK')).cid, 'hello1'); assert.equal((await a.next(m => m.type === 'CHAT_OK')).cid, 'hello1');
  // The cooldown is only checked in memory: two Neon round trips per write can outlast it.
  if (!process.env.DATABASE_URL) { const busy = await a.next(m => m.type === 'ERROR'); assert.equal(busy.scope, 'chat'); assert.ok(busy.retry > 0 && busy.retry <= 800); }
  const heard = await clients[1].next(m => m.type === 'STATE_SYNC' && m.chat?.length);
  assert.deepEqual(heard.chat.slice(0, 1).map(m => [m.seat, m.name, m.text]), [[0, '測試東', '大家好， 請多指教']]);
  clients[2].send({ type: 'CHAT', text: ' ' });
  assert.equal((await clients[2].next(m => m.type === 'ERROR')).scope, 'chat');
  clients[2].send({ type: 'CHAT', text: '👨‍👩‍👧‍👦'.repeat(3) + '字'.repeat(57), cid: 'emoji1' }); // 60 visible characters.
  assert.equal((await clients[2].next(m => m.type === 'CHAT_OK')).cid, 'emoji1');
  clients[2].send({ type: 'CHAT', text: '字'.repeat(61) });
  assert.match((await clients[2].next(m => m.type === 'ERROR')).message, /60 字/);
  // A sticker is a chat line with a whitelisted emote; the server writes its log text and ignores the page's.
  clients[2].send({ type: 'CHAT', emote: 'toString' });
  const badEmote = await clients[2].next(m => m.type === 'ERROR'); assert.equal(badEmote.scope, 'chat'); assert.match(badEmote.message, /表情/);
  await new Promise(r => setTimeout(r, 850));
  clients[2].send({ type: 'CHAT', emote: 'smug', text: '<b>假字</b>', cid: 'emote1' });
  assert.equal((await clients[2].next(m => m.type === 'CHAT_OK')).cid, 'emote1');
  const sticker = (await clients[3].next(m => m.type === 'STATE_SYNC' && m.chat?.some(x => x.emote))).chat.find(x => x.emote);
  assert.deepEqual([sticker.seat, sticker.emote, sticker.text], [2, 'smug', '〔得意〕']);
  a.ws.terminate(); const resumed = await client(1); resumed.send({ type: 'RECONNECT', code: owner.code, token: owner.token });
  assert.equal((await resumed.next(m => m.type === 'ROOM_JOINED')).seat, 0);
  const history = (await resumed.next(m => m.type === 'STATE_SYNC')).chat; assert.equal(history[0]?.text, '大家好， 請多指教'); assert.equal(history.filter(m => m.cid === 'hello1').length, 1); // A new socket gets today's history.
  const replaced = new Promise(resolve => resumed.ws.once('close', resolve));
  const replacement = await client(0);
  replacement.send({ type: 'RECONNECT', code: owner.code, token: owner.token });
  await replacement.next(m => m.type === 'ROOM_JOINED');
  assert.equal(await replaced, 4001); // A moved session closes instead of controlling two seats.
  assert.ok((await replacement.next(m => m.type === 'STATE_SYNC' && m.state)).state.hands[0].every(Number.isInteger));
});
