// Cloudflare Worker＋Durable Objects 版的普隆德拉大廳（不會自動部署，見 wrangler.toml）。
// 每個大廳編號一個 Lobby 物件；邏輯和本機 Node 版（server/ro-life/lobby.mjs）共用 server/ro-life/lobby-core.mjs。
// 用 WebSocket 休眠 API：沒有訊息時物件可以休眠、不計運算時間，每條連線的狀態存在 attachment（上限 16 KB）。
import { DurableObject } from 'cloudflare:workers';
import { LOBBY_PATH, lobbyId, onMessage, onClose, verifyTicket } from '../../../server/ro-life/lobby-core.mjs';

function allowed(req, env) {
  const origin = req.headers.get('Origin');
  if (!origin) return true;
  const list = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return !list.length || list.includes(origin);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/health') return Response.json({ service: 'ro-lobby', ok: true });
    if (url.pathname !== LOBBY_PATH) return new Response('Not found', { status: 404 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
    if (!allowed(req, env)) return new Response('Forbidden', { status: 403 });
    const l = lobbyId(url.searchParams.get('l'));
    if (!l) return new Response('Not found', { status: 404 });
    return env.LOBBY.get(env.LOBBY.idFromName(`lobby-${l}`)).fetch(req);
  },
};

export class Lobby extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.io = {
      peers: () => ctx.getWebSockets(),
      get: (ws) => { try { return ws.deserializeAttachment() ?? null; } catch { return null; } },
      set: (ws, st) => { try { ws.serializeAttachment(st); } catch { /* 已關閉 */ } },
      send: (ws, msg) => { try { ws.send(JSON.stringify(msg)); } catch { /* 已關閉 */ } },
      close: (ws, code, reason) => { try { ws.close(code, reason); } catch { /* 已關閉 */ } },
      verify: (ticket, now) => verifyTicket(env.RO_LOBBY_SECRET, ticket, now),
      log: (...a) => console.log(...a),
    };
  }
  async fetch() {
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }
  async webSocketMessage(ws, data) {
    await onMessage(this.io, ws, typeof data === 'string' ? data : '', Date.now());
  }
  async webSocketClose(ws, code) {
    onClose(this.io, ws);
    try { ws.close(code === 1005 || code === 1006 ? 1000 : code, 'bye'); } catch { /* 已關閉 */ }
  }
  async webSocketError(ws) {
    onClose(this.io, ws);
  }
}
