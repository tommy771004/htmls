// 278 赭線 OCHRE LINE 的本機連線伺服器：房間名單與主機轉送（不跑遊戲，主機是開房者的瀏覽器）。
// 邏輯在 games/278-ochre-line/src/net/core.js，和 Cloudflare Durable Objects 版（games/278-ochre-line/worker/index.js）共用。
// 掛在 npm start 的 8127 埠上（jade-table 伺服器的 onUpgrade 鏈），路徑 /api/ochre/room/<六位數房號>?name=&token=&create=1。
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomCore, validCode } from '../../games/278-ochre-line/src/net/core.js';

export function createOchre({ origins = [], log = () => {} } = {}) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 32 * 1024, perMessageDeflate: false });
  const send = (ws, msg) => {
    if (ws?.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 1024 * 1024) { ws.terminate(); return; }
    ws.send(JSON.stringify(msg));
  };
  const rooms = new Map();
  const parse = data => { try { return JSON.parse(data); } catch { return null; } };

  wss.on('connection', (ws, req, code) => {
    ws.alive = true;
    ws.on('pong', () => { ws.alive = true; });
    let r = rooms.get(code);
    if (!r) { r = new RoomCore(code, { send, log }); rooms.set(code, r); }
    const q = new URL(req.url, 'http://x').searchParams;
    if (!r.join(ws, { name: q.get('name'), token: q.get('token'), create: q.get('create') === '1' }, Date.now())) { setTimeout(() => ws.close(), 50); if (!r.players.length) rooms.delete(code); return; }
    ws.on('message', d => { ws.alive = true; r.message(ws, parse(d), Date.now()); });
    ws.on('close', () => r.leave(ws, Date.now()));
  });

  const loop = setInterval(() => {
    const now = Date.now();
    for (const [code, r] of rooms) { r.tick(now); if (r.closable(now) || !r.players.length) rooms.delete(code); }
  }, 1000);
  const heartbeat = setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); } }, 15000);
  for (const t of [loop, heartbeat]) t.unref?.();

  function handleUpgrade(req, socket, head) {
    const m = /^\/api\/ochre\/room\/(\d+)$/.exec(new URL(req.url, 'http://x').pathname);
    if (!m) return false;
    const origin = req.headers.origin;
    const sameHost = origin === `http://${req.headers.host}` || origin === `https://${req.headers.host}`;
    if (!validCode(m[1]) || (origin && !sameHost && !origins.includes(origin)) || wss.clients.size >= 400) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return true;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req, m[1]));
    return true;
  }
  return {
    handleUpgrade, rooms,
    close() { for (const t of [loop, heartbeat]) clearInterval(t); for (const ws of wss.clients) ws.terminate(); wss.close(); },
  };
}

// 獨立執行：只處理 WebSocket（node server/ochre/server.mjs）
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const app = createOchre({ origins: (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean), log: console.log });
  const server = createServer((req, res) => { res.writeHead(404); res.end('Not found'); });
  server.on('upgrade', (req, socket, head) => { if (!app.handleUpgrade(req, socket, head)) { socket.write('HTTP/1.1 404 Not Found\r\n\r\n'); socket.destroy(); } });
  const port = Number(process.env.PORT || 8278);
  server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`赭線連線伺服器：ws://127.0.0.1:${port}/api/ochre/room/<房號>`));
}
