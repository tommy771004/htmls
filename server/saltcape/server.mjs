// 鹽岬大逃殺（199）的權威伺服器：大廳與配對、房號分享、30 Hz 推進、15 Hz 快照、斷線接手。
// 對局全部在這個行程的記憶體裡；Vercel 上不同實例之間不共享房間（見 README）。
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { getMap } from '../../games/199-saltcape/src/core/map.js';
import { Match } from '../../games/199-saltcape/src/core/sim.js';
import { botName } from '../../games/199-saltcape/src/core/bots.js';
import { TICK, SNAP_EVERY, MATCH } from '../../games/199-saltcape/src/core/rules.js';

const PATHS = ['/saltcape', '/api/saltcape'];
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const INSTANCE = randomBytes(3).toString('hex');

export function createSaltcape({ origins = [], target = MATCH.target, quickWait = MATCH.lobbyQuick, linger = MATCH.endLinger, log = () => {} } = {}) {
  const W = getMap();
  const rooms = new Map();
  const tokens = new Map(); // token → { code, id }
  const wss = new WebSocketServer({ noServer: true, maxPayload: 32 * 1024, perMessageDeflate: false });

  const send = (ws, msg) => {
    if (ws?.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 2 * 1024 * 1024) { ws.terminate(); return; }
    ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
  };
  const newCode = () => { for (;;) { let c = ''; for (let i = 0; i < 5; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]; if (!rooms.has(c)) return c; } };
  const cleanName = (v) => {
    const s = typeof v === 'string' ? v.replace(/[\u0000-\u001f<>&"]/g, '').trim().slice(0, 14) : '';
    return s || '旅人' + Math.floor(Math.random() * 900 + 100);
  };

  function makeRoom(kind) {
    const room = {
      code: newCode(), kind, state: 'lobby', host: 0, members: new Map(), nextId: 1,
      countdownEnd: kind === 'quick' ? Date.now() + quickWait * 1000 : Date.now() + MATCH.lobbyPrivate * 1000,
      match: null, matchNo: 0, endedAt: 0, emptySince: 0, acc: 0, last: Date.now(),
    };
    room.timer = setInterval(() => roomLoop(room), 1000 / TICK);
    room.timer.unref?.();
    rooms.set(room.code, room);
    log(`房間 ${room.code}（${kind}）建立`);
    return room;
  }
  function closeRoom(room) {
    clearInterval(room.timer);
    for (const m of room.members.values()) tokens.delete(m.token);
    rooms.delete(room.code);
    log(`房間 ${room.code} 關閉`);
  }

  const connected = (m) => m.ws && m.ws.readyState === WebSocket.OPEN;
  function lobbyInfo(room) {
    return {
      code: room.code, kind: room.kind, state: room.state, host: room.host, inst: INSTANCE, target,
      ends: room.state === 'lobby' ? Math.max(0, room.countdownEnd - Date.now()) : 0,
      players: [...room.members.values()].map((m) => ({ id: m.id, n: m.name, c: connected(m) ? 1 : 0 })),
      live: room.match && !room.match.over ? { alive: room.match.alive().length, t: Math.round(room.match.time) } : null,
    };
  }
  function broadcastLobby(room) {
    const msg = JSON.stringify({ t: 'lobby', room: lobbyInfo(room) });
    for (const m of room.members.values()) send(m.ws, msg);
  }

  function startMatch(room) {
    const humans = [...room.members.values()].filter(connected);
    if (!humans.length) return;
    const roster = humans.map((m) => ({ id: m.id, name: m.name, bot: false }));
    for (let i = 0; roster.length < Math.max(target, humans.length); i++) roster.push({ id: 1000 + i, name: botName(i + room.matchNo * 7), bot: true });
    room.match = new Match({ W, seed: (Math.random() * 2 ** 32) >>> 0, roster });
    room.matchNo++;
    room.state = 'match';
    room.acc = 0; room.last = Date.now();
    for (const m of room.members.values()) { m.inMatch = connected(m); if (m.inMatch) send(m.ws, { t: 'start', ...room.match.startPacket(m.id) }); }
    broadcastLobby(room);
    log(`房間 ${room.code} 開局：${humans.length} 真人 + ${roster.length - humans.length} AI`);
  }

  function joinMidMatch(room, m) {
    const M = room.match;
    if (!M || M.over) return;
    let p = M.byId.get(m.id);
    if (!p) p = M.addPlayer(m.id, m.name, false, !M.canJoinPlane());
    if (p.mode === 5) { const al = M.alive(); p.watch = al.length ? al[Math.floor(Math.random() * al.length)].id : -1; }
    m.inMatch = true;
    send(m.ws, { t: 'start', ...M.startPacket(m.id) });
  }

  function roomLoop(room) {
    const now = Date.now();
    const anyone = [...room.members.values()].some(connected);
    if (!anyone) {
      room.emptySince ||= now;
      if (now - room.emptySince > 30000) { closeRoom(room); return; }
    } else room.emptySince = 0;
    // 斷線超過 90 秒的成員移出名單（對局中的角色保留在原地）
    for (const m of room.members.values()) {
      if (!connected(m) && now - m.lastSeen > 90000) { room.members.delete(m.id); tokens.delete(m.token); if (room.host === m.id) room.host = 0; broadcastLobby(room); }
    }
    if (!room.host || !room.members.has(room.host)) { const first = [...room.members.values()].find(connected); room.host = first ? first.id : 0; }
    if (room.state === 'lobby') {
      if (anyone && now >= room.countdownEnd) startMatch(room);
      else if (now - (room.lastLobbyPush || 0) > 1000) { room.lastLobbyPush = now; broadcastLobby(room); }
      return;
    }
    if (room.state === 'ended') {
      if (now - room.endedAt > linger * 1000) {
        room.state = 'lobby'; room.match = null;
        room.countdownEnd = now + (room.kind === 'quick' ? quickWait : MATCH.lobbyPrivate) * 1000;
        broadcastLobby(room);
      }
      return;
    }
    // 對局推進：以實際經過時間補足 tick，最多一次補 5 個避免卡頓後爆衝
    const M = room.match;
    room.acc += now - room.last; room.last = now;
    let n = 0;
    while (room.acc >= 1000 / TICK && n < 5) {
      room.acc -= 1000 / TICK; n++;
      M.step();
      if (M.tick % SNAP_EVERY === 0) {
        const ents = M.entities();
        for (const m of room.members.values()) if (m.inMatch && connected(m)) send(m.ws, M.snapshotFor(m.id, ents));
      }
      if (M.over) {
        // 最後一包快照帶 end 事件
        const ents = M.entities();
        for (const m of room.members.values()) if (m.inMatch && connected(m)) send(m.ws, M.snapshotFor(m.id, ents));
        room.state = 'ended'; room.endedAt = now;
        broadcastLobby(room);
        log(`房間 ${room.code} 結束，勝者 ${M.winner}`);
        break;
      }
    }
    if (room.acc > 500) room.acc = 0;
    if (M.tick % (TICK * 2) === 0) broadcastLobby(room);
  }

  function attach(ws, room, m) {
    const old = m.ws;
    m.ws = ws; m.lastSeen = Date.now();
    ws.member = m; ws.room = room;
    if (old && old !== ws) { old.member = null; try { old.close(4000, 'moved'); } catch { /* 已關閉 */ } }
  }

  function onHello(ws, msg) {
    // 接手：同一個 token 換到新連線（Vercel 連線 300 秒上限前前端會主動換線）
    if (typeof msg.token === 'string' && tokens.has(msg.token)) {
      const ref = tokens.get(msg.token), room = rooms.get(ref.code), m = room?.members.get(ref.id);
      if (room && m) {
        attach(ws, room, m);
        send(ws, { t: 'welcome', id: m.id, token: m.token, inst: INSTANCE, room: lobbyInfo(room), resumed: 1 });
        if (room.state === 'match') { if (m.inMatch) send(ws, { t: 'start', ...room.match.startPacket(m.id), resumed: 1 }); else joinMidMatch(room, m); }
        broadcastLobby(room);
        return;
      }
    }
    if (msg.mode === 'resume') { send(ws, { t: 'err', code: 'lost', msg: '原本的對局不在這台伺服器上。' }); return; }
    let room;
    if (msg.mode === 'join') {
      room = rooms.get(String(msg.code || '').toUpperCase());
      if (!room) { send(ws, { t: 'err', code: 'notfound', msg: '找不到這個房號：可能已解散，或分在另一台伺服器實例。' }); return; }
    } else if (msg.mode === 'create') room = makeRoom('private');
    else if (msg.mode === 'quick') {
      room = [...rooms.values()].find((r) => r.kind === 'quick' && r.state === 'lobby' && r.members.size < MATCH.maxHumans && r.countdownEnd - Date.now() > 4000)
        || [...rooms.values()].find((r) => r.kind === 'quick' && r.state === 'match' && r.match?.canJoinPlane() && r.members.size < MATCH.maxHumans)
        || makeRoom('quick');
    } else { send(ws, { t: 'err', code: 'bad', msg: '未知的請求。' }); return; }
    if ([...room.members.values()].filter(connected).length >= MATCH.maxHumans) { send(ws, { t: 'err', code: 'full', msg: '房間人數已滿。' }); return; }
    const m = { id: room.nextId++, name: cleanName(msg.name), token: randomBytes(12).toString('base64url'), ws: null, lastSeen: Date.now(), inMatch: false };
    room.members.set(m.id, m);
    tokens.set(m.token, { code: room.code, id: m.id });
    if (!room.host) room.host = m.id;
    attach(ws, room, m);
    send(ws, { t: 'welcome', id: m.id, token: m.token, inst: INSTANCE, room: lobbyInfo(room) });
    if (room.state === 'match') joinMidMatch(room, m);
    broadcastLobby(room);
  }

  wss.on('connection', (ws) => {
    ws.alive = true; ws.rate = 0; ws.rateT = Date.now();
    ws.on('pong', () => { ws.alive = true; });
    ws.on('message', (data) => {
      const now = Date.now();
      if (now - ws.rateT > 1000) { ws.rateT = now; ws.rate = 0; }
      if (++ws.rate > 90) return; // 每秒訊息上限
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      if (!msg || typeof msg.t !== 'string') return;
      if (msg.t === 'ping') { send(ws, { t: 'pong', c: msg.c, k: ws.room?.match ? ws.room.match.tick : 0 }); return; }
      if (msg.t === 'hello') { if (!ws.member) onHello(ws, msg); return; }
      const m = ws.member, room = ws.room;
      if (!m || !room) return;
      m.lastSeen = now;
      if (msg.t === 'in' && Array.isArray(msg.l) && room.state === 'match' && m.inMatch) {
        room.match.queueInput(m.id, msg.l.slice(0, 8).filter((i) => i && typeof i.s === 'number'));
      } else if (msg.t === 'start' && room.state === 'lobby' && room.host === m.id) {
        room.countdownEnd = Math.min(room.countdownEnd, now + 3000); broadcastLobby(room);
      } else if (msg.t === 'spec' && room.match) {
        const p = room.match.byId.get(m.id); if (p) p.watch = msg.i | 0;
      } else if (msg.t === 'leave') {
        room.members.delete(m.id); tokens.delete(m.token); ws.member = null;
        if (room.host === m.id) room.host = 0;
        try { ws.close(1000, 'bye'); } catch { /* ignore */ }
        broadcastLobby(room);
      }
    });
    ws.on('close', () => {
      const m = ws.member, room = ws.room;
      if (!m || !room || m.ws !== ws) return;
      m.lastSeen = Date.now();
      if (room.match && !room.match.over) room.match.emitAll({ e: 'dc', i: m.id });
      broadcastLobby(room);
    });
  });
  const heartbeat = setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); } }, 15000);
  heartbeat.unref?.();

  function handleUpgrade(req, socket, head) {
    const path = new URL(req.url, 'http://x').pathname;
    if (!PATHS.includes(path)) return false;
    const origin = req.headers.origin;
    const sameHost = origin === `http://${req.headers.host}` || origin === `https://${req.headers.host}`;
    if ((origin && !sameHost && !origins.includes(origin)) || wss.clients.size >= 400) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return true;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
    return true;
  }
  return {
    handleUpgrade, rooms, instance: INSTANCE,
    close() { clearInterval(heartbeat); for (const r of [...rooms.values()]) closeRoom(r); for (const ws of wss.clients) ws.terminate(); wss.close(); },
  };
}

// 獨立執行（或給 Vercel）：一個只處理 WebSocket 升級的 HTTP 伺服器
export function createSaltServer(opts = {}) {
  const app = createSaltcape(opts);
  const server = createServer((req, res) => {
    const path = new URL(req.url, 'http://x').pathname;
    if (path.endsWith('/health') || PATHS.includes(path)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ service: 'saltcape', ok: true, inst: app.instance, rooms: app.rooms.size }));
      return;
    }
    res.writeHead(404); res.end('Not found');
  });
  server.on('upgrade', (req, socket, head) => { if (!app.handleUpgrade(req, socket, head)) { socket.write('HTTP/1.1 404 Not Found\r\n\r\n'); socket.destroy(); } });
  return { server, app };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const { server } = createSaltServer({ origins: (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean), log: console.log });
  const port = Number(process.env.PORT || 8199);
  server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`鹽岬伺服器：ws://127.0.0.1:${port}/api/saltcape`));
}
