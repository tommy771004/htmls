// Cloudflare Worker＋Durable Objects 版的連線伺服器（不會自動部署，見 README「部署到 Cloudflare」）。
// Lobby：全站一個，在線人數、快速配對、排行榜（存在 DO storage）。Room：每個房號一個，車球聯賽的狀態同步。
// 邏輯和本機 Node 伺服器共用 ../src/net/core.js。
import { LobbyCore, RoomCore, BoardCore, validCode } from '../src/net/core.js';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

function allowed(req, env) {
  const origin = req.headers.get('Origin');
  if (!origin) return true;
  const list = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return !list.length || list.includes(origin);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/health') return json({ service: 'roadster-stunt-arena', ok: true });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Not found', { status: 404 });
    if (!allowed(req, env)) return new Response('Forbidden', { status: 403 });
    if (url.pathname === '/api/rsa') return env.LOBBY.get(env.LOBBY.idFromName('lobby')).fetch(req);
    const m = /^\/api\/rsa\/room\/([A-Za-z0-9]+)$/.exec(url.pathname);
    if (m && validCode(m[1].toUpperCase())) return env.ROOM.get(env.ROOM.idFromName(m[1].toUpperCase())).fetch(req);
    return new Response('Not found', { status: 404 });
  },
};

const send = (ws, msg) => { try { ws.send(JSON.stringify(msg)); } catch { /* 已關閉 */ } };
const parse = (d) => { try { return JSON.parse(d); } catch { return null; } };

export class Lobby {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env;
    this.core = null;
    this.ready = ctx.blockConcurrencyWhile(async () => {
      const data = await ctx.storage.get('board');
      this.core = new LobbyCore({ send, board: new BoardCore(data || null), onBoardChange: (b) => ctx.storage.put('board', b.toJSON()) });
    });
    this.timer = null;
  }
  async fetch(req) {
    await this.ready;
    const url = new URL(req.url);
    if (url.pathname === '/report') {
      const { code, players } = await req.json();
      this.core.report(code, players, Date.now());
      return json({ ok: true });
    }
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    this.core.open(server, Date.now());
    server.addEventListener('message', (e) => this.core.message(server, parse(e.data), Date.now()));
    const bye = () => { this.core.close(server); if (!this.core.conns.size && this.timer) { clearInterval(this.timer); this.timer = null; } };
    server.addEventListener('close', bye);
    server.addEventListener('error', bye);
    if (!this.timer) this.timer = setInterval(() => this.core.tick(Date.now()), 5000);
    return new Response(null, { status: 101, webSocket: client });
  }
}

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env;
    this.core = null; this.timer = null;
  }
  report(code, players) {
    const lobby = this.env.LOBBY.get(this.env.LOBBY.idFromName('lobby'));
    this.ctx.waitUntil(lobby.fetch('https://lobby/report', { method: 'POST', body: JSON.stringify({ code, players }) }).catch(() => {}));
  }
  async fetch(req) {
    const url = new URL(req.url);
    const code = url.pathname.split('/').pop().toUpperCase();
    if (!this.core) this.core = new RoomCore(code, { send, report: (c, n) => this.report(c, n) });
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    this.core.join(server, url.searchParams.get('name') || '', Date.now());
    server.addEventListener('message', (e) => this.core.message(server, parse(e.data), Date.now()));
    const bye = () => {
      this.core.leave(server, Date.now());
      if (!this.core.size && this.timer) { clearInterval(this.timer); this.timer = null; }
    };
    server.addEventListener('close', bye);
    server.addEventListener('error', bye);
    if (!this.timer) this.timer = setInterval(() => this.core.tick(Date.now()), 1000 / 30);
    return new Response(null, { status: 101, webSocket: client });
  }
}
