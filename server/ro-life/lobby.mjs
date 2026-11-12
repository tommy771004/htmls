// 282 普隆德拉大廳：本機 Node 版的 WebSocket 伺服器（npm start 的 8127 埠，路徑 /api/ro/lobby?l=<大廳編號>）。
// 邏輯在 lobby-core.mjs，和 Cloudflare 版（games/282-ro-life/worker/index.js）共用。
// 大廳編號 1–9 都進同一個廣場（同 Cloudflare 版）；好友等資料放記憶體，重開就清空（正式站存在 Durable Object 的 SQLite）。
import { WebSocketServer, WebSocket } from 'ws';
import { LOBBY_PATH, lobbyId, onMessage, onClose, verifyTicket } from './lobby-core.mjs';
import { memoryStore } from './lobby-store.mjs';
import { onAlarm, RUN_MAX_MESSAGE } from './lobby-party.mjs';

export function createRoLobby({ secret, origins = [], log = () => {}, db = memoryStore(), settle = null } = {}) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: RUN_MAX_MESSAGE, perMessageDeflate: false });
  const plaza = new Set();
  const state = new WeakMap();

  const io = {
    peers: () => plaza,
    get: (ws) => state.get(ws) ?? null,
    set: (ws, st) => (st ? state.set(ws, st) : state.delete(ws)),
    send: (ws, msg) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (ws.bufferedAmount > 1024 * 1024) return ws.terminate();
      ws.send(JSON.stringify(msg));
    },
    close: (ws, code, reason) => { try { ws.close(code, reason); } catch { ws.terminate(); } },
    sendRaw: (ws, str) => { if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount <= 1024 * 1024) ws.send(str); },
    verify: (ticket, now) => verifyTicket(secret, ticket, now),
    // 邀請與出發確認的期限（Cloudflare 版用 Durable Object 的 alarm）
    wake: (at) => {
      if (alarm && alarm.at <= at) return;
      if (alarm) clearTimeout(alarm.t);
      const t = setTimeout(() => { alarm = null; onAlarm(io, Date.now()); }, Math.max(0, at - Date.now()) + 5);
      t.unref?.();
      alarm = { at, t };
    },
    db,
    log,
    ...(settle ? { settle } : {}), // 交易結算（trade.mjs 的 makeSettle）；沒有就不開放交易
  };
  let alarm = null;

  wss.on('connection', (ws) => {
    plaza.add(ws);
    ws.alive = true;
    ws.on('pong', () => { ws.alive = true; });
    ws.on('message', (d, binary) => { ws.alive = true; if (!binary) onMessage(io, ws, d.toString('utf8')).catch((e) => log('[ro-lobby]', e.message)); });
    ws.on('close', () => {
      onClose(io, ws);
      plaza.delete(ws);
    });
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); }
  }, 15000);
  heartbeat.unref?.();

  function handleUpgrade(req, socket, head) {
    const url = new URL(req.url, 'http://x');
    if (url.pathname !== LOBBY_PATH) return false;
    const l = lobbyId(url.searchParams.get('l'));
    const origin = req.headers.origin;
    const sameHost = origin === `http://${req.headers.host}` || origin === `https://${req.headers.host}`;
    if (!l || (origin && !sameHost && !origins.includes(origin)) || wss.clients.size >= 400) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return true;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    return true;
  }

  return {
    handleUpgrade,
    plaza,
    close() { clearInterval(heartbeat); if (alarm) clearTimeout(alarm.t); for (const ws of wss.clients) ws.terminate(); wss.close(); },
  };
}
