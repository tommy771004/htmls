import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import { randomBytes, randomInt } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomStore } from './store.mjs';
import { MahjongGame } from '../../assets/jade-table/engine.mjs';

// Room transitions are persisted atomically before any client sees the resulting state.
export function createJadeServer({ port = 8127, host = '127.0.0.1', origins = [], turnMs = 20000, claimMs = 10000 } = {}) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const mime = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.css': 'text/css' };
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (path === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"service":"jade-table","ok":true}'); return; }
      if (path === '/') { res.writeHead(302, { Location: '/web/127-jade-table.html' }); res.end(); return; }
      // Serve public site assets only, never the server, repository metadata or session data.
      if (!['GET', 'HEAD'].includes(req.method) || !/^\/(?:index\.html|favicon\.svg|(?:web|assets|thumbs|vendor|app)\/[\w./-]+)$/.test(path) || path.split('/').some(p => p.startsWith('.')) || !mime[extname(path)]) {
        res.writeHead(404); res.end('Not found'); return;
      }
      const file = resolve(root, '.' + path);
      if (!file.startsWith(root)) { res.writeHead(404); res.end(); return; }
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': mime[extname(path)], 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  const store = new RoomStore();
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096, perMessageDeflate: false });
  server.on('upgrade', (req, socket, head) => {
    const origin = req.headers.origin;
    const sameHost = origin === `http://${req.headers.host}` || origin === `https://${req.headers.host}`;
    if (!['/mahjong', '/api/jade'].includes(req.url) || (!sameHost && !origins.includes(origin)) || wss.clients.size >= 500 || !store.ready) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  });
  const send = (ws, data) => {
    if (ws?.readyState === WebSocket.OPEN) {
      if (ws.bufferedAmount > 1024 * 1024) { ws.terminate(); return; }
      ws.send(JSON.stringify(data));
    }
  };
  const connected = (p, now = Date.now()) => !!p && !p.bot && !p.disconnectedAt && now - p.lastSeen < 30000;
  const roomHost = room => room.players.findIndex(p => connected(p));
  const restore = room => { if (room.game) room.game = Object.assign(new MahjongGame(), room.game); return room; };
  function snapshot(ws, room) {
    const seat = ws.client?.seat, p = room.players[seat];
    if (!p || p.connection !== ws.id || p.token !== ws.client.token) { ws.close(4001, 'Session moved'); return; }
    send(ws, { type: 'STATE_SYNC', serverTime: Date.now(), room: {
      code: room.code, seat, host: roomHost(room), base: room.base, unit: room.unit,
      players: room.players.map(p => p ? { name: p.name, connected: connected(p), bot: p.bot } : null)
    }, state: room.game?.view(seat) ?? null });
  }
  function broadcast(room) { for (const ws of wss.clients) if (ws.client?.code === room.code) snapshot(ws, room); }
  async function change(code, fn) { return restore(await store.transact(code, room => { restore(room); fn(room); room.touched = Date.now(); })); }
  async function detach(ws, leave = false) {
    const c = ws.client; ws.client = null; if (!c) return;
    const room = await change(c.code, room => {
      const p = room.players[c.seat]; if (!p || p.connection !== ws.id) return;
      p.disconnectedAt = Date.now();
      if (leave) { if (!room.game) room.players[c.seat] = null; else { p.bot = true; p.token = null; room.game.setBot(c.seat, true); } }
    });
    broadcast(room);
  }
  function playerName(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 16 || /[\u0000-\u001f<>]/.test(value)) throw Error('暱稱需為 1 至 16 個一般文字字元。');
    return value.trim();
  }
  const player = (name, ws) => ({ name, token: randomBytes(32).toString('hex'), connection: ws.id, bot: false, disconnectedAt: 0, lastSeen: Date.now() });
  async function handle(ws, msg) {
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') throw Error('無效訊息。');
    if (['CREATE_ROOM', 'JOIN_ROOM', 'RECONNECT'].includes(msg.type)) {
      if (ws.client) throw Error('請先離開目前房間。');
      let room, seat;
      if (msg.type === 'CREATE_ROOM') {
        const name = playerName(msg.name), base = Number(msg.base ?? 100), unit = Number(msg.unit ?? 20);
        if (![100, 300, 500].includes(base) || ![10, 20, 50, 100].includes(unit)) throw Error('底台設定不在可用範圍。');
        const p = player(name, ws); seat = 0;
        for (let i = 0; i < 10; i++) {
          const code = String(randomInt(100000, 1000000));
          room = { code, base, unit, players: [p, null, null, null], game: null, touched: Date.now() };
          if (await store.create(code, room)) break; room = null;
        }
        if (!room) throw Error('暫時無法開房，請稍後重試。');
      } else {
        if (!/^\d{6}$/.test(msg.code)) throw Error('請輸入六位數房號。');
        const newPlayer = msg.type === 'JOIN_ROOM' ? player(playerName(msg.name), ws) : null;
        room = await change(msg.code, room => {
          if (msg.type === 'RECONNECT') {
            seat = room.players.findIndex(p => typeof msg.token === 'string' && msg.token.length === 64 && p?.token === msg.token && !p.bot);
            const p = room.players[seat];
            if (!p || (p.disconnectedAt && Date.now() - p.disconnectedAt > 30000) || (!p.disconnectedAt && Date.now() - p.lastSeen > 30000)) throw Error('重連憑證已失效，請重新加入房間。');
            p.connection = ws.id; p.disconnectedAt = 0; p.lastSeen = Date.now();
          } else {
            if (room.game) throw Error('牌局已開始，不能中途加入。');
            seat = room.players.findIndex(p => !p); if (seat < 0) throw Error('房間已滿。'); room.players[seat] = newPlayer;
          }
        });
      }
      ws.client = { code: room.code, seat, token: room.players[seat].token };
      send(ws, { type: 'ROOM_JOINED', code: room.code, seat, token: room.players[seat].token }); broadcast(room); return;
    }
    if (!ws.client) throw Error('請先建立或加入房間。');
    if (msg.type === 'LEAVE_ROOM') { await detach(ws, true); send(ws, { type: 'ROOM_LEFT' }); return; }
    const { code, seat, token } = ws.client;
    const room = await change(code, room => {
      const p = room.players[seat]; if (p?.token !== token || p.connection !== ws.id) throw Error('連線已被取代。');
      p.lastSeen = Date.now();
      if (msg.type === 'START_GAME') {
        if (seat !== roomHost(room) || room.game) throw Error('只有房主可開始尚未開始的牌局。');
        if (room.players.some(p => p && !connected(p))) throw Error('請等斷線玩家重連或 30 秒後席位釋出。');
        if (room.players.some(p => !p) && msg.fillBots !== true) throw Error('等待四人入座，或選擇 AI 補位。');
        room.players = room.players.map((p, i) => p ?? { name: ['青竹', '月白', '竹隱', '遠山'][i], token: null, bot: true, lastSeen: 0, disconnectedAt: 0 });
        room.game = new MahjongGame({ names: room.players.map(p => p.name), bots: room.players.map(p => p.bot), base: room.base, unit: room.unit, turnMs, claimMs }); room.game.startRound();
      } else if (msg.type === 'NEXT_ROUND') {
        if (seat !== roomHost(room) || room.game?.state.phase !== 'ended') throw Error('請等房主在結算後開下一局。'); room.game.startRound();
      } else if (msg.type === 'ACTION') {
        if (!room.game) throw Error('牌局尚未開始。'); room.game.act(seat, msg.action, msg.actionId);
      } else if (msg.type !== 'STATE_SYNC') throw Error('不支援的指令。');
    }); broadcast(room);
  }
  wss.on('connection', ws => {
    ws.id = randomBytes(16).toString('hex'); ws.alive = true; ws.windowAt = Date.now(); ws.requests = 0; ws.chain = Promise.resolve();
    ws.on('pong', () => { ws.alive = true; }); ws.on('error', () => {}); ws.on('close', () => { ws.chain = ws.chain.then(() => detach(ws)).catch(() => {}); });
    ws.on('message', (raw, binary) => {
      ws.chain = ws.chain.then(async () => {
        if (binary) throw Error('僅接受 JSON 訊息。');
        if (Date.now() - ws.windowAt > 10000) { ws.windowAt = Date.now(); ws.requests = 0; }
        if (++ws.requests > 60) { ws.close(1008, 'Rate limit'); return; }
        await handle(ws, JSON.parse(raw.toString()));
      }).catch(err => send(ws, { type: 'ERROR', message: err instanceof SyntaxError ? 'JSON 格式錯誤。' : err.message }));
    });
  });
  let polling = false;
  const tick = setInterval(async () => {
    if (polling) return; polling = true;
    try {
      const codes = new Set([...wss.clients].filter(ws => ws.client).map(ws => ws.client.code));
      await Promise.allSettled([...codes].map(async code => {
        const room = await change(code, room => {
          const now = Date.now();
          for (const ws of wss.clients) if (ws.client?.code === code && ws.readyState === WebSocket.OPEN) {
            const p = room.players[ws.client.seat]; if (p?.connection === ws.id) p.lastSeen = now;
          }
          room.players.forEach((p, seat) => {
            if (p && !p.bot && (p.disconnectedAt && now - p.disconnectedAt > 30000 || !p.disconnectedAt && now - p.lastSeen > 30000)) {
              if (room.game) { p.bot = true; p.token = null; room.game.setBot(seat, true); } else room.players[seat] = null;
            }
          });
          // Catch up a frozen function only one transition at a time; deadlines use current time.
          room.game?.tick(now);
        }); broadcast(room);
      }));
    } finally { polling = false; }
  }, 1000);
  const heartbeat = setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); } }, 15000);
  tick.unref(); heartbeat.unref();
  return {
    server,
    listen: () => new Promise(resolve => server.listen(port, host, () => resolve(server.address()))),
    close: () => new Promise(resolve => { clearInterval(tick); clearInterval(heartbeat); for (const ws of wss.clients) ws.terminate(); wss.close(); server.close(resolve); })
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const app = createJadeServer({ port: Number(process.env.PORT || 8127), host: process.env.HOST || '127.0.0.1', origins: (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean) });
  const address = await app.listen();
  console.log(`青雀伺服器：http://${address.address.includes(':') ? '[' + address.address + ']' : address.address}:${address.port}/127-jade-table.html`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await app.close(); process.exit(0); });
}
