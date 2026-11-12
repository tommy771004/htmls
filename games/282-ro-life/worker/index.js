// Cloudflare Worker＋Durable Objects 版的普隆德拉大廳（不會自動部署，見 wrangler.toml）。
// 大廳編號 1–9 都進同一個 Lobby 物件（lobby-1），廣場裡再分頻道；邏輯和本機 Node 版（server/ro-life/lobby.mjs）
// 共用 server/ro-life/lobby-core.mjs。用 WebSocket 休眠 API：沒有訊息時物件可以休眠、不計運算時間，每條連線的狀態存在
// attachment（上限 16 KB，實測）。好友、邀請、角色名、檢視資料、離線留言、聊天紀錄、檢舉與禁言存在這個物件內建的 SQLite
// （lobby-store.mjs），永久保存。組隊與合作關卡的本局連線（hello 帶 run:true）也走同一個網址、同一個物件（lobby-party.mjs）。管理頁 /admin 要 Worker 的 RO_ADMIN_KEY（wrangler secret put RO_ADMIN_KEY），沒設就 404。
import { DurableObject } from 'cloudflare:workers';
import { LOBBY_PATH, lobbyId, onMessage, onClose, verifyTicket } from '../../../server/ro-life/lobby-core.mjs';
import { sqlStore } from '../../../server/ro-life/lobby-store.mjs';
import { onAlarm } from '../../../server/ro-life/lobby-party.mjs';
import { makeSettle } from '../../../server/ro-life/trade.mjs';
import { nameBlockList } from '../../../server/ro-life/name-rules.mjs';
import { signer } from '../../../server/ro-life/coop.mjs';
import { ADMIN_PATH, ADMIN_HTML, ADMIN_HEADERS, ADMIN_MIN_KEY, adminApi, adminAuthorized } from '../../../server/ro-life/lobby-admin.mjs';

const ADMIN_API = `${ADMIN_PATH}/api/`;
// 連線數上限：廣場 100 人＋本局連線＋還沒打招呼的；同一個 IP 另有上限（還沒打招呼的連線也佔名額，不限制的話一台機器就能把大廳塞滿）
const MAX_SOCKETS = 400;
const IP_SOCKETS = 16; // 一個人是大廳＋本局兩條；同一個對外 IP（家裡、宿舍）可以有好幾個人。Worker 變數 LOBBY_IP_CAP 可調

function allowed(req, env) {
  const origin = req.headers.get('Origin');
  if (!origin) return true;
  const list = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return !list.length || list.includes(origin);
}
const lobby = (env) => env.LOBBY.get(env.LOBBY.idFromName('lobby-1'));

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/health') return Response.json({ service: 'ro-lobby', ok: true });
    if (url.pathname === ADMIN_PATH || url.pathname.startsWith(ADMIN_API)) {
      if (!env.RO_ADMIN_KEY || env.RO_ADMIN_KEY.length < ADMIN_MIN_KEY) return new Response('Not found', { status: 404 });
      if (url.pathname === ADMIN_PATH) return new Response(ADMIN_HTML, { headers: ADMIN_HEADERS });
      if (!adminAuthorized(env.RO_ADMIN_KEY, req.headers.get('Authorization'))) return Response.json({ error: 'unauthorized' }, { status: 401 });
      // 驗過密鑰才轉給大廳物件；轉過去的請求用內部網址，公開的 WebSocket 路徑碰不到管理功能
      const body = req.method === 'POST' ? await req.text() : undefined;
      return lobby(env).fetch(new Request(`https://lobby.internal${url.pathname}${url.search}`, { method: req.method, body, headers: { 'x-ro-admin': '1' } }));
    }
    if (url.pathname !== LOBBY_PATH) return new Response('Not found', { status: 404 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
    if (!allowed(req, env)) return new Response('Forbidden', { status: 403 });
    if (!lobbyId(url.searchParams.get('l'))) return new Response('Not found', { status: 404 });
    return lobby(env).fetch(req);
  },
};

export class Lobby extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    const cap = Number(env.LOBBY_CHANNEL_CAP); // 測試用：把每頻道上限調小
    this.io = {
      peers: () => ctx.getWebSockets(),
      get: (ws) => { try { return ws.deserializeAttachment() ?? null; } catch { return null; } },
      set: (ws, st) => { try { ws.serializeAttachment(st); } catch { /* 已關閉 */ } },
      send: (ws, msg) => { try { ws.send(JSON.stringify(msg)); } catch { /* 已關閉 */ } },
      sendRaw: (ws, str) => { try { ws.send(str); } catch { /* 已關閉 */ } },
      close: (ws, code, reason) => { try { ws.close(code, reason); } catch { /* 已關閉 */ } },
      verify: (ticket, now) => verifyTicket(env.RO_LOBBY_SECRET, ticket, now),
      ...(env.RO_LOBBY_SECRET ? { sign: signer(env.RO_LOBBY_SECRET) } : {}), // 合作關卡的行程收據、結算收據（coop.mjs）
      db: sqlStore((q, ...p) => ctx.storage.sql.exec(q, ...p).toArray()),
      ...(Number.isInteger(cap) && cap > 0 ? { cap } : {}),
      // 邀請與出發確認的期限：用 alarm 叫醒（休眠中的 setTimeout 會不見）
      wake: (at) => { ctx.storage.getAlarm().then((cur) => (cur == null || cur > at) && ctx.storage.setAlarm(at)).catch((e) => console.log('[ro-lobby] alarm', e.message)); },
      log: (...a) => console.log(...a),
      nameBlock: nameBlockList(env.NAME_BLOCK), // 額外的禁用角色名（逗號分隔，可不設）
      ...(env.LOBBY_REQUIRE_SR === '1' ? { requireSr: true } : {}), // 合作關卡只收支援伺服器擲骰的頁面（所有人都更新後再開）
    };
    // 交易：成交時打 Vercel 的 /api/ro/trade/settle（RO_TRADE_URL，例如 https://<網域>/api/ro/trade/settle；Vercel 也要設 RO_TRADE=1）。沒設就不開放交易
    const settle = makeSettle({ url: env.RO_TRADE_URL, secret: env.RO_LOBBY_SECRET, fetchImpl: (...a) => fetch(...a), log: (...a) => console.log(...a) });
    if (settle) this.io.settle = settle;
    // 醒來時清掉已離線玩家的檢視資料
    try { this.io.db.keepProfiles(ctx.getWebSockets().map((ws) => this.io.get(ws)?.id).filter(Boolean)); } catch (e) { console.log('[ro-lobby] db', e.message); }
  }
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname.startsWith(ADMIN_API)) {
      // 只有上面的 Worker 驗過密鑰後會帶這個標頭轉進來（外部連不到 Durable Object 本身）
      if (req.headers.get('x-ro-admin') !== '1') return new Response('Not found', { status: 404 });
      let body = null;
      if (req.method === 'POST') { try { body = JSON.parse(await req.text()); } catch { return Response.json({ error: 'bad_json' }, { status: 400 }); } }
      try {
        const r = adminApi(this.io.db, req.method, url.pathname.slice(ADMIN_API.length), url.searchParams, body, Date.now());
        return Response.json(r.body, { status: r.status, headers: { 'cache-control': 'no-store' } });
      } catch (e) {
        console.log('[ro-lobby] admin', e.message);
        return Response.json({ error: 'db' }, { status: 500 });
      }
    }
    if (url.pathname !== LOBBY_PATH || req.headers.get('Upgrade') !== 'websocket') return new Response('Not found', { status: 404 });
    // 連線按來源 IP 加標籤（休眠 API 的 tag），超過上限就不收
    const ip = (req.headers.get('CF-Connecting-IP') || 'unknown').slice(0, 64);
    const ipCap = Number(this.env.LOBBY_IP_CAP) > 0 ? Number(this.env.LOBBY_IP_CAP) : IP_SOCKETS;
    if (this.ctx.getWebSockets().length >= MAX_SOCKETS || this.ctx.getWebSockets(`ip:${ip}`).length >= ipCap) return new Response('Busy', { status: 503 });
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server, [`ip:${ip}`]);
    return new Response(null, { status: 101, webSocket: client });
  }
  async alarm() {
    try { onAlarm(this.io, Date.now()); } catch (e) { console.log('[ro-lobby] alarm', e.message); }
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
