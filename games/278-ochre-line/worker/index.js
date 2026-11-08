// Cloudflare Worker＋Durable Objects 版的赭線連線伺服器（不會自動部署，見 wrangler.toml 與 NET.md）。
// 每個房號一個 Room 物件，邏輯和本機 Node 伺服器（server/ochre/server.mjs）共用 ../src/net/core.js。
import { RoomCore, validCode } from '../src/net/core.js';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

function allowed(req, env) {
  const origin = req.headers.get('Origin');
  if (!origin) return true;
  const list = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return !list.length || list.includes(origin);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/health') return json({ service: 'ochre-line', ok: true });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Not found', { status: 404 });
    if (!allowed(req, env)) return new Response('Forbidden', { status: 403 });
    const m = /^\/api\/ochre\/room\/(\d+)$/.exec(url.pathname);
    if (m && validCode(m[1])) return env.ROOM.get(env.ROOM.idFromName(m[1])).fetch(req);
    return new Response('Not found', { status: 404 });
  },
};

const send = (ws, msg) => { try { ws.send(JSON.stringify(msg)); } catch { /* 已關閉 */ } };
const parse = d => { try { return JSON.parse(d); } catch { return null; } };

export class Room {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; this.core = null; this.timer = null; }
  async fetch(req) {
    const url = new URL(req.url);
    const code = url.pathname.split('/').pop();
    if (!this.core) this.core = new RoomCore(code, { send });
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    const q = url.searchParams;
    if (!this.core.join(server, { name: q.get('name'), token: q.get('token'), create: q.get('create') === '1' }, Date.now())) {
      setTimeout(() => { try { server.close(1000, 'rejected'); } catch { /* 已關閉 */ } }, 50);
      return new Response(null, { status: 101, webSocket: client });
    }
    server.addEventListener('message', e => this.core.message(server, parse(e.data), Date.now()));
    const bye = () => { this.core.leave(server, Date.now()); };
    server.addEventListener('close', bye);
    server.addEventListener('error', bye);
    if (!this.timer) this.timer = setInterval(() => {
      const now = Date.now(); this.core.tick(now);
      if (!this.core.size && (this.core.closable(now) || !this.core.players.length)) { clearInterval(this.timer); this.timer = null; this.core = null; }
    }, 1000);
    return new Response(null, { status: 101, webSocket: client });
  }
}
