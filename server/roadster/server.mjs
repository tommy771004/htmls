// 200 Roadster Stunt Arena 的本機連線伺服器：大廳（在線人數、快速配對、排行榜）與車球聯賽房間。
// 規則與同步邏輯在 games/200-roadster-arena/src/net/core.js，和 Cloudflare Durable Objects 版（worker/index.js）共用。
// 掛在 npm start 的 8127 埠上（jade-table 伺服器的 onUpgrade 鏈），路徑 /api/rsa 與 /api/rsa/room/<房號>。
import { createServer } from 'node:http';
import { readFileSync, writeFile } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { LobbyCore, RoomCore, BoardCore, validCode } from '../../games/200-roadster-arena/src/net/core.js';

export function createRoadster({ origins = [], log = () => {}, boardFile = join(tmpdir(), 'rsa200-board.json') } = {}) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024, perMessageDeflate: false });
  const send = (ws, msg) => {
    if (ws?.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 1024 * 1024) { ws.terminate(); return; }
    ws.send(JSON.stringify(msg));
  };
  let saved = null;
  try { saved = JSON.parse(readFileSync(boardFile, 'utf8')); } catch { /* 第一次啟動沒有檔案 */ }
  let saveTimer = null;
  const lobby = new LobbyCore({
    send, board: new BoardCore(saved),
    onBoardChange: (b) => { clearTimeout(saveTimer); saveTimer = setTimeout(() => writeFile(boardFile, JSON.stringify(b), () => {}), 500); },
  });
  const rooms = new Map();
  const room = (code) => {
    let r = rooms.get(code);
    if (!r) { r = new RoomCore(code, { send, report: (c, n, now) => lobby.report(c, n, now) }); rooms.set(code, r); log(`房間 ${code} 建立`); }
    return r;
  };
  const parse = (data) => { try { return JSON.parse(data); } catch { return null; } };

  wss.on('connection', (ws, req, target) => {
    ws.alive = true;
    ws.on('pong', () => { ws.alive = true; });
    if (target.kind === 'lobby') {
      lobby.open(ws, Date.now());
      ws.on('message', (d) => lobby.message(ws, parse(d), Date.now()));
      ws.on('close', () => lobby.close(ws));
    } else {
      const r = room(target.code);
      const name = new URL(req.url, 'http://x').searchParams.get('name') || '';
      r.join(ws, name, Date.now());
      ws.on('message', (d) => { ws.alive = true; r.message(ws, parse(d), Date.now()); });
      ws.on('close', () => r.leave(ws, Date.now()));
    }
  });

  const loop = setInterval(() => {
    const now = Date.now();
    for (const [code, r] of rooms) {
      r.tick(now);
      if (r.closable(now)) { rooms.delete(code); lobby.report(code, 0, now); log(`房間 ${code} 關閉`); }
    }
  }, 1000 / 30);
  const counts = setInterval(() => lobby.tick(Date.now()), 5000);
  const heartbeat = setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); } }, 20000);
  for (const t of [loop, counts, heartbeat]) t.unref?.();

  function handleUpgrade(req, socket, head) {
    const path = new URL(req.url, 'http://x').pathname;
    let target = null;
    if (path === '/api/rsa') target = { kind: 'lobby' };
    else { const m = /^\/api\/rsa\/room\/([A-Za-z0-9]+)$/.exec(path); if (m && validCode(m[1].toUpperCase())) target = { kind: 'room', code: m[1].toUpperCase() }; }
    if (!target) return false;
    const origin = req.headers.origin;
    const sameHost = origin === `http://${req.headers.host}` || origin === `https://${req.headers.host}`;
    if ((origin && !sameHost && !origins.includes(origin)) || wss.clients.size >= 600) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return true;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req, target));
    return true;
  }
  return {
    handleUpgrade, lobby, rooms,
    close() { for (const t of [loop, counts, heartbeat]) clearInterval(t); for (const ws of wss.clients) ws.terminate(); wss.close(); },
  };
}

// 獨立執行：只處理 WebSocket 的伺服器（node server/roadster/server.mjs）
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const app = createRoadster({ origins: (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean), log: console.log });
  const server = createServer((req, res) => { res.writeHead(404); res.end('Not found'); });
  server.on('upgrade', (req, socket, head) => { if (!app.handleUpgrade(req, socket, head)) { socket.write('HTTP/1.1 404 Not Found\r\n\r\n'); socket.destroy(); } });
  const port = Number(process.env.PORT || 8200);
  server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Roadster Stunt Arena 伺服器：ws://127.0.0.1:${port}/api/rsa`));
}
