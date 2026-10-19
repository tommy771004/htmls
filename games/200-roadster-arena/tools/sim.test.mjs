// Node 測試：車的手感數值、特技場規則（任務、Time Attack）、車球聯賽規則與 AI、連線核心（大廳、房間、排行榜），
// 以及本機 WebSocket 伺服器的兩人整合。node --test tools/sim.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parkSim, initRapier } from './harness.mjs';
import { TICK, BALL, ARENA, LEAGUE } from '../src/core/const.js';
import { FreeRide, TimeAttack, crossed, medalFor } from '../src/core/stunt.js';
import { TA } from '../src/core/park.js';
import { placeCar } from '../src/core/car.js';
import { League, Bot, kickoffSpot } from '../src/core/league.js';
import { BoardCore, LobbyCore, RoomCore, weekKey, cleanName, newCode, validCode } from '../src/net/core.js';
import { createRoadster } from '../../../server/roadster/server.mjs';

const S = TA.start;
const finite = (o) => Object.values(o).every(Number.isFinite);

// ---------------------------------------------------------------------------------------------
// 車
test('車停在平地上：四輪著地、不滑動', async () => {
  const sim = await parkSim();
  sim.place(S.x, 0.5, S.z, S.yaw);
  sim.step({}, 120);
  assert.equal(sim.car.state.contacts, 4);
  assert.ok(sim.speed() < 0.3, `速度 ${sim.speed()}`);
  assert.ok(Math.abs(sim.pos().y - 0.36) < 0.08, `高度 ${sim.pos().y}`);
});

test('0–60 mph：只踩油門約 1.4 秒，加冷氣推進 1.1 秒內（任務成立）', async () => {
  const time60 = async (input) => {
    const sim = await parkSim();
    sim.place(S.x, 0.4, S.z, S.yaw);
    sim.step({}, 60);
    const fr = new FreeRide(sim.park), out = [];
    let t = null;
    sim.step(input, 300, (s) => { fr.update(s.car, TICK, out); if (s.car.state.speed >= 26.82 && t == null) { t = s.t - 0.5; return false; } });
    return { t, out };
  };
  const plain = await time60({ throttle: 1 });
  assert.ok(plain.t > 1.2 && plain.t < 1.7, `油門 ${plain.t}`);
  assert.ok(!plain.out.some((e) => e.type === 'objective'));
  const boost = await time60({ throttle: 1, boost: true });
  assert.ok(boost.t < 1.1, `推進 ${boost.t}`);
  assert.ok(boost.out.some((e) => e.type === 'objective' && e.id === 'launch'), '完成 launch 任務');
});

test('起跳離地，空中按住跳躍會懸停並消耗冷氣，落地後回充', async () => {
  const sim = await parkSim();
  sim.place(S.x, 0.4, S.z, S.yaw);
  sim.step({}, 60);
  const y0 = sim.pos().y;
  let maxY = 0, hovered = false;
  sim.step({ jump: true }, 240, (s) => { maxY = Math.max(maxY, s.pos().y); hovered ||= s.car.state.hovering; });
  assert.ok(maxY - y0 > 1.5, `跳高 ${maxY - y0}`);
  assert.ok(hovered, '有進入懸停');
  const gas = sim.car.state.gas;
  assert.ok(gas < 85, `冷氣 ${gas}`);
  sim.step({}, 480);
  assert.ok(sim.car.state.contacts >= 3, '落地');
  assert.ok(sim.car.state.gas > gas + 20, `回充 ${gas} → ${sim.car.state.gas}`);
});

test('高速手煞車轉向會甩尾', async () => {
  const sim = await parkSim();
  sim.place(S.x, 0.4, S.z, S.yaw, 30);
  sim.step({ throttle: 1 }, 30);
  let drift = false;
  sim.step({ throttle: 1, steer: 1, handbrake: true }, 90, (s) => { drift ||= s.car.state.drifting; });
  assert.ok(drift);
});

test('亂按 20 秒不會出現 NaN、不會掉出世界', async () => {
  const sim = await parkSim();
  sim.place(S.x, 0.4, S.z, S.yaw);
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  let inp = {};
  sim.step(() => inp, 2400, (s) => {
    if (Math.round(s.t * 120) % 30 === 0) inp = { throttle: rnd() * 2 - 0.6, steer: rnd() * 2 - 1, jump: rnd() < 0.2, boost: rnd() < 0.3, handbrake: rnd() < 0.15, pitch: rnd() * 2 - 1, roll: rnd() < 0.2 ? 1 : 0 };
    assert.ok(finite(s.pos()) && finite(s.vel()));
  });
  assert.ok(sim.pos().y > -2);
});

// ---------------------------------------------------------------------------------------------
// Time Attack
test('crossed()：只在正向穿過環面、且在半徑內才算', () => {
  const g = { x: 0, y: 5, z: 0, r: 4, dir: [1, 0, 0] };
  assert.ok(crossed(g, { x: -1, y: 5, z: 0 }, { x: 1, y: 5, z: 1 }));
  assert.ok(!crossed(g, { x: 1, y: 5, z: 0 }, { x: -1, y: 5, z: 0 }), '反向');
  assert.ok(!crossed(g, { x: -1, y: 5, z: 9 }, { x: 1, y: 5, z: 9 }), '環外');
});

test('獎牌門檻', () => {
  const m = TA.medals;
  assert.ok(m.author < m.gold && m.gold < m.silver && m.silver < m.bronze);
  assert.equal(medalFor(m.author - 1), 'author');
  assert.equal(medalFor(m.gold), 'gold');
  assert.equal(medalFor(m.silver - 0.1), 'silver');
  assert.equal(medalFor(m.bronze), 'bronze');
  assert.equal(medalFor(m.bronze + 1), null);
});

test('Time Attack：倒數時車不能動，依序過五個環與終點，分段可以上傳排行榜', async () => {
  const sim = await parkSim();
  sim.place(S.x, 0.4, S.z, S.yaw);
  const ta = new TimeAttack(sim.park), out = [];
  const z0 = sim.pos().z;
  sim.step({ throttle: 1 }, Math.round(2.5 * 120), (s) => ta.update(s.car, TICK, out));
  assert.equal(ta.phase, 'countdown');
  assert.ok(Math.abs(sim.pos().z - z0) < 0.2, '倒數中被鎖住');
  sim.step({ throttle: 1 }, 80, (s) => ta.update(s.car, TICK, out));
  assert.equal(ta.phase, 'run');
  assert.ok(out.some((e) => e.type === 'go'));
  assert.deepEqual(out.filter((e) => e.type === 'count').map((e) => e.n), [2, 1]);
  // 直接把車擺到每個環的兩側穿過去
  const gates = ta.gates;
  for (let i = 0; i < gates.length; i++) {
    const g = gates[i];
    ta.time += 8;
    ta.prev = { x: g.x - g.dir[0], y: g.y - g.dir[1], z: g.z - g.dir[2] };
    placeCar(sim.car, g.x + g.dir[0], g.y + g.dir[1], g.z + g.dir[2], 0);
    ta.update(sim.car, TICK, out);
    assert.equal(ta.next, i + 1, `環 ${i}`);
  }
  assert.equal(ta.phase, 'done');
  const fin = out.find((e) => e.type === 'finish');
  assert.ok(fin && fin.splits.length === 6);
  assert.ok(ta.ghost.length > 0 && ta.ghost.length % 7 === 0, '幽靈車每格 7 個數');
  const board = new BoardCore();
  assert.equal(board.validate(fin.time, fin.splits), null);
});

// ---------------------------------------------------------------------------------------------
// 聯賽
test('開球站位：20 人不重疊且都在場內', () => {
  const spots = [];
  for (const t of [0, 1]) for (let i = 0; i < 10; i++) spots.push(kickoffSpot(t, i));
  for (const s of spots) assert.ok(Math.abs(s.x) < ARENA.A - 4 && Math.abs(s.z) < ARENA.B - 4, JSON.stringify(s));
  for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) assert.ok(Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z) > 5);
});

test('離線聯賽：倒數 → 進球加分 → 重新開球；時間到平手進延長，延長賽進球結束', async () => {
  const R = await initRapier();
  const lg = new League(R);
  lg.addCar('me', 0, 'ME');
  lg.addCar('b', 1, 'B');
  lg.kickoff();
  const run = (secs, until) => { for (let i = 0; i < secs * 120; i++) { const ev = lg.tick({}); const hit = ev.find(until || (() => false)); if (hit) return { ...hit }; } return null; };
  assert.ok(run(LEAGUE.KICKOFF + 0.1, (e) => e.type === 'go'));
  lg.lastTouch = 'me';
  lg.placeBall(0, 6, ARENA.B - 6, 0, 0, 30);
  const g = run(2, (e) => e.type === 'goal');
  assert.ok(g, '進球');
  assert.equal(g.team, 0); assert.equal(g.by, 'ME'); assert.equal(g.own, false);
  assert.deepEqual(lg.score, [1, 0]);
  assert.ok(run(LEAGUE.GOAL_PAUSE + 0.2, (e) => e.type === 'kickoff'));
  const bp = lg.ball.translation();
  assert.ok(Math.hypot(bp.x, bp.z) < 0.1, '球回中場');
  run(LEAGUE.KICKOFF + 0.1);
  lg.score = [1, 1]; lg.clock = 0.05;
  assert.ok(run(1, (e) => e.type === 'overtime'));
  lg.lastTouch = 'b';
  lg.placeBall(0, 6, -ARENA.B + 6, 0, 0, -30);
  assert.ok(run(2, (e) => e.type === 'goal'));
  const end = run(LEAGUE.GOAL_PAUSE + 0.2, (e) => e.type === 'end');
  assert.ok(end); assert.equal(end.winner, 1);
});

test('連線聯賽：只有球的主人回報進球，伺服器沒回應時每秒重報', async () => {
  const R = await initRapier();
  const lg = new League(R, { online: true });
  lg.addCar('me', 0, 'ME');
  lg.phase = 'play';
  lg.placeBall(0, 6, ARENA.B - 6, 0, 0, 30);
  let claims = 0;
  for (let i = 0; i < 240; i++) claims += lg.tick({}).filter((e) => e.type === 'goalClaim').length;
  assert.equal(claims, 2, '進門後立刻報一次，1 秒後再報一次');
  assert.deepEqual(lg.score, [0, 0], '比分等伺服器');
  const lg2 = new League(R, { online: true });
  lg2.phase = 'play';
  lg2.setBallAuthority(false);
  lg2.placeBall(0, 6, ARENA.B + 10, 0, 0, 0);
  assert.equal(lg2.tick({}).filter((e) => e.type === 'goalClaim').length, 0);
});

test('AI 3v3 兩分鐘：會碰球、會進球、球不會跑出場', async () => {
  const R = await initRapier();
  const lg = new League(R);
  for (let t = 0; t < 2; t++) for (let i = 0; i < 3; i++) lg.addCar(`b${t}${i}`, t, `B${t}${i}`, new Bot('pro', 7 + t * 31 + i * 3));
  lg.kickoff();
  let touches = 0, goals = 0;
  for (let i = 0; i < 120 * 120; i++) {
    for (const e of lg.tick()) { if (e.type === 'touch') touches++; if (e.type === 'goal') goals++; }
    const p = lg.ball.translation();
    assert.ok(Number.isFinite(p.x) && Math.abs(p.x) < ARENA.A + 2 && p.y > 0 && p.y < ARENA.H + 1, `球 ${p.x} ${p.y} ${p.z}`);
  }
  assert.ok(touches >= 20, `碰球 ${touches}`);
  assert.ok(goals >= 1, `進球 ${goals}`);
});

// ---------------------------------------------------------------------------------------------
// 連線核心
const hub = () => {
  const box = new Map();
  const send = (c, m) => { if (!box.has(c)) box.set(c, []); box.get(c).push(m); };
  const of = (c, t) => (box.get(c) || []).filter((m) => m.t === t);
  const last = (c, t) => of(c, t).at(-1);
  return { send, of, last, clear: () => box.clear() };
};

test('小工具：ISO 週、名字清理、房號', () => {
  assert.equal(weekKey(Date.UTC(2026, 0, 1)), '2026-W01');
  assert.equal(weekKey(Date.UTC(2024, 11, 30)), '2025-W01');
  assert.equal(weekKey(Date.UTC(2027, 0, 1)), '2026-W53');
  assert.equal(weekKey(Date.UTC(2026, 9, 19)), '2026-W43');
  assert.equal(cleanName('  <b>Aymeric</b>  '), 'bAymeric/b');
  assert.equal(cleanName('x'.repeat(40)).length, 16);
  assert.match(cleanName(''), /^車手\d{3}$/);
  for (let i = 0; i < 50; i++) assert.ok(validCode(newCode()));
  assert.ok(!validCode('ABCD1') && !validCode('abcde') && !validCode('ABCDEF'));
});

const splitsFor = (t) => [0.15, 0.3, 0.45, 0.6, 0.8, 1].map((k) => +(t * k).toFixed(3));

test('排行榜：檢查成績、同名只留最快、本週榜換週清空', () => {
  const b = new BoardCore();
  const now = Date.UTC(2026, 9, 19, 12);
  assert.equal(b.submit('A', 10, splitsFor(10), now).ok, false, '太快');
  assert.equal(b.submit('A', 60, [1, 2, 3], now).ok, false, '分段數');
  assert.equal(b.submit('A', 60, [10, 5, 30, 40, 50, 60], now).ok, false, '分段倒退');
  assert.equal(b.submit('A', 60, splitsFor(59), now).ok, false, '總時間對不上');
  const r = b.submit('A', 60, splitsFor(60), now);
  assert.ok(r.ok && r.improved && r.rank === 1);
  assert.equal(b.submit('A', 65, splitsFor(65), now).improved, false);
  b.submit('B', 55, splitsFor(55), now);
  assert.deepEqual(b.top('world', now).map((x) => [x.name, x.time]), [['B', 55], ['A', 60]]);
  const later = now + 8 * 86400000;
  assert.equal(b.top('week', later).length, 0);
  assert.equal(b.top('world', later).length, 2);
  b.submit('A', 62, splitsFor(62), later);
  assert.deepEqual(b.top('week', later).map((x) => x.time), [62]);
  assert.equal(b.top('world', later).find((x) => x.name === 'A').time, 60);
  const copy = new BoardCore(JSON.parse(JSON.stringify(b)));
  assert.deepEqual(copy.top('world', later), b.top('world', later));
});

test('大廳：在線人數、快速配對優先填人多的房、上傳成績有頻率限制', () => {
  const h = hub();
  const L = new LobbyCore({ send: h.send });
  const a = {}, c = {};
  L.open(a, 0); L.open(c, 0);
  assert.equal(h.last(c, 'hello').online, 2);
  L.message(a, { t: 'quick' }, 0);
  const code = h.last(a, 'room').code;
  assert.ok(validCode(code));
  L.report(code, 3, 0); L.report('ZZZZZ', 5, 0); L.report('YYYYY', LEAGUE.MAX, 0);
  L.message(c, { t: 'quick' }, 0);
  assert.equal(h.last(c, 'room').code, 'ZZZZZ', '人多但沒滿的房');
  assert.equal(L.counts().playing, 3 + 5 + LEAGUE.MAX);
  L.message(a, { t: 'score', name: 'A', time: 60, splits: splitsFor(60) }, 1000);
  assert.equal(h.last(a, 'scored').ok, true);
  L.message(a, { t: 'score', name: 'A', time: 59, splits: splitsFor(59) }, 3000);
  assert.equal(h.last(a, 'scored').ok, false);
  L.message(c, { t: 'board', kind: 'world' }, 3000);
  assert.equal(h.last(c, 'board').rows[0].name, 'A');
  L.tick(200000);
  assert.equal(L.counts().rooms, 0, '過期的房間回報被清掉');
  L.close(a);
  assert.equal(L.counts().online, 1);
});

const goalBall = (z = 1) => [0, 5, z * (ARENA.B + BALL.R + 1), 0, 0, 0, 1, 0, 0, z * 20, 0, 0, 0];
const midBall = () => [0, BALL.R, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0];

test('房間：分隊、開球、球權、進球檢查、計時與延長賽、斷線', () => {
  const h = hub();
  let reported = 0;
  const room = new RoomCore('ABCDE', { send: h.send, report: (code, n) => { reported = n; } });
  const A = {}, B = {}, C = {};
  let now = 1000;
  const pa = room.join(A, 'Ann', now);
  assert.equal(room.phase, 'warmup');
  assert.equal(h.last(A, 'welcome').team, 0);
  // 熱身時一個人也能進球
  room.message(A, { t: 'claim', b: midBall(), seq: room.seq }, now);
  assert.equal(room.owner, pa.id);
  room.message(A, { t: 'ball', b: goalBall(), seq: room.seq }, now);
  room.message(A, { t: 'goal', seq: room.seq }, now);
  assert.ok(h.last(A, 'goal').warmup);
  assert.equal(room.owner, 0);
  // 第二人加入：開新比賽、倒數
  const pb = room.join(B, 'Ben', now);
  assert.equal(reported, 2);
  assert.notEqual(pa.team, pb.team);
  assert.equal(room.phase, 'kickoff');
  const ko = h.last(B, 'ko');
  assert.equal(ko.idx[pb.id], 0);
  room.message(A, { t: 'claim', b: midBall(), seq: room.seq }, now);
  assert.equal(room.owner, 0, '倒數中不能接球');
  now += LEAGUE.KICKOFF * 1000 + 10; room.tick(now);
  assert.equal(room.phase, 'play');
  // 球權：A 先拿到，0.2 秒內 B 搶不走，之後可以
  room.message(A, { t: 'claim', b: midBall(), seq: room.seq }, now);
  assert.equal(room.owner, pa.id);
  room.message(B, { t: 'claim', b: midBall(), seq: room.seq }, now + 100);
  assert.equal(room.owner, pa.id);
  room.message(B, { t: 'claim', b: midBall(), seq: room.seq - 1 }, now + 300);
  assert.equal(room.owner, pa.id, '舊序號被拒');
  room.message(B, { t: 'claim', b: midBall(), seq: room.seq }, now + 300);
  assert.equal(room.owner, pb.id);
  assert.equal(h.last(A, 'own').id, pb.id);
  now += 300;
  // 不是主人的進球回報不算；位置不在門裡也不算
  room.message(A, { t: 'goal', seq: room.seq }, now);
  room.message(B, { t: 'goal', seq: room.seq }, now);
  assert.deepEqual(room.score, [0, 0]);
  room.message(B, { t: 'goal', seq: room.seq, b: goalBall(-1) }, now);
  assert.deepEqual(room.score, [0, 1], '進球訊息附上當下的球');
  assert.equal(h.last(A, 'goal').byId, pb.id);
  assert.equal(room.phase, 'goal');
  room.message(B, { t: 'goal', seq: room.seq }, now);
  assert.deepEqual(room.score, [0, 1], '同一球不重複算');
  now += LEAGUE.GOAL_PAUSE * 1000 + 10; room.tick(now);
  assert.equal(room.phase, 'kickoff');
  now += LEAGUE.KICKOFF * 1000 + 10; room.tick(now);
  // 球主人 3 秒沒回報就收回
  room.message(A, { t: 'claim', b: midBall(), seq: room.seq }, now);
  for (let i = 0; i < 40; i++) { now += 100; room.message(A, { t: 'ping', c: 0 }, now); room.message(B, { t: 'ping', c: 0 }, now); room.tick(now); }
  assert.equal(room.owner, 0);
  // 時間到平手 → 延長；延長賽進球 → 結束 → 9 秒後新比賽
  room.score = [1, 1]; room.clock = 0.01;
  now += 100; room.tick(now);
  assert.ok(room.overtime);
  assert.ok(h.of(A, 'overtime').length);
  room.message(A, { t: 'claim', b: midBall(), seq: room.seq }, now);
  room.message(A, { t: 'ball', b: goalBall(1), seq: room.seq }, now);
  room.message(A, { t: 'goal', seq: room.seq }, now);
  now += LEAGUE.GOAL_PAUSE * 1000 + 10; room.message(B, { t: 'ping' }, now); room.tick(now);
  assert.equal(room.phase, 'ended');
  assert.equal(h.last(B, 'end').winner, 0);
  now += LEAGUE.END_PAUSE * 1000 + 10; room.message(A, { t: 'ping' }, now); room.message(B, { t: 'ping' }, now); room.tick(now);
  assert.equal(room.phase, 'kickoff');
  assert.deepEqual(room.score, [0, 0]);
  // 快照：送出各車狀態
  room.message(A, { t: 'st', s: new Array(14).fill(1) }, now);
  room.message(B, { t: 'st', s: [1, 2, NaN] }, now);
  h.clear(); now += 100; room.tick(now);
  const snap = h.last(C, 's') || h.last(A, 's');
  assert.equal(snap.c.length, 1, '格式不對的狀態不轉送');
  // 第三人加入後離開；B 斷線 15 秒被踢 → 剩一人回熱身
  room.join(C, 'Cat', now);
  room.leave(C, now);
  now += 16000; room.message(A, { t: 'ping' }, now); room.tick(now);
  assert.equal(room.size, 1);
  assert.equal(room.phase, 'warmup');
  room.leave(A, now);
  assert.equal(reported, 0);
  assert.ok(!room.closable(now + 1000));
  assert.ok(room.closable(now + 31000));
});

test('房間最多 20 人，隊伍人數平均', () => {
  const h = hub();
  const room = new RoomCore('FULLX', { send: h.send });
  const conns = Array.from({ length: LEAGUE.MAX + 1 }, () => ({}));
  conns.forEach((c, i) => room.join(c, 'P' + i, 0));
  assert.equal(room.size, LEAGUE.MAX);
  assert.ok(h.last(conns[LEAGUE.MAX], 'full'));
  const n = [0, 0];
  for (const p of room.players.values()) n[p.team]++;
  assert.deepEqual(n, [10, 10]);
});

// ---------------------------------------------------------------------------------------------
// 本機伺服器整合：兩個 WebSocket 客戶端走大廳 → 快速配對 → 進同一房 → 開球 → 球權 → 進球
test('本機伺服器：大廳在線人數、快速配對、兩人同房進球', async () => {
  const app = createRoadster({ boardFile: join(tmpdir(), `rsa200-test-${process.pid}.json`) });
  const server = createServer((req, res) => { res.writeHead(404); res.end(); });
  server.on('upgrade', (req, socket, head) => { if (!app.handleUpgrade(req, socket, head)) socket.destroy(); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `ws://127.0.0.1:${server.address().port}/api/rsa`;
  const socks = [];
  const conn = (url) => new Promise((res, rej) => {
    const ws = new WebSocket(url);
    const box = [];
    ws.onmessage = (e) => box.push(JSON.parse(e.data));
    ws.onopen = () => res({ ws, box, send: (m) => ws.send(JSON.stringify(m)), wait: (t, f = () => true, ms = 6000) => new Promise((ok, no) => {
      const t0 = Date.now();
      const iv = setInterval(() => {
        const m = box.find((x) => x.t === t && f(x));
        if (m) { clearInterval(iv); ok(m); } else if (Date.now() - t0 > ms) { clearInterval(iv); no(new Error('等不到 ' + t)); }
      }, 20);
    }) });
    ws.onerror = rej;
    socks.push(ws);
  });
  try {
    const l1 = await conn(base), l2 = await conn(base);
    assert.equal((await l2.wait('hello')).online, 2);
    l1.send({ t: 'quick' });
    const { code } = await l1.wait('room');
    const a = await conn(`${base}/room/${code}?name=Ann`);
    const wa = await a.wait('welcome');
    // 房間回報給大廳後，第二個人快速配對會進同一房
    l2.send({ t: 'quick' });
    assert.equal((await l2.wait('room')).code, code);
    const b = await conn(`${base}/room/${code}?name=Ben`);
    const wb = await b.wait('welcome');
    assert.notEqual(wa.team, wb.team);
    await a.wait('ko');
    const play = await a.wait('phase', (m) => m.phase === 'play', 5000);
    assert.equal(play.phase, 'play');
    const seq = (await a.wait('ko')).seq;
    a.send({ t: 'claim', b: midBall(), seq });
    assert.equal((await b.wait('own')).id, wa.id);
    a.send({ t: 'st', s: new Array(14).fill(0.5) });
    const snap = await b.wait('s', (m) => m.c.some((c) => c[0] === wa.id));
    assert.equal(snap.o, wa.id);
    const team = goalBall(1)[2] > 0 ? 0 : 1;
    a.send({ t: 'ball', b: goalBall(1), seq });
    a.send({ t: 'goal', seq });
    const g = await b.wait('goal');
    assert.equal(g.team, team);
    assert.equal(g.by, 'Ann');
    // 錯誤的房號被拒
    await assert.rejects(conn(`${base}/room/bad!`));
  } finally {
    for (const ws of socks) try { ws.close(); } catch { /* 已關 */ }
    app.close();
    await new Promise((r) => server.close(r));
  }
});
