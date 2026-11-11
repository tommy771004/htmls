// 282 普隆德拉大廳的連線核心（第一階段：看得到其他玩家）。
// 只轉送「加入／離開、走動、外觀、表情、公開聊天」，不碰遊戲規則；好友、組隊、交易、檢視資料都還沒做。
// 本機 Node（server/ro-life/lobby.mjs）與 Cloudflare Durable Object（games/282-ro-life/worker/index.js）共用這一份。
// 核心本身不留狀態：每條連線的資料經 io.get／io.set 存取（DO 版放在 WebSocket attachment，休眠後還在）。
//
// io 介面：
//   peers()            這個大廳所有連線（含還沒打招呼的）
//   get(ws) / set(ws, state)
//   send(ws, msg)      送 JSON
//   close(ws, code, reason)
//   verify(ticket, now) → Promise<{a, n, exp} | null>   驗證 /api/ro/lobby-ticket 發的入場票
//   log?(...args)
//
// 訊息格式照引擎原本的大廳協定（main-*.js 的 Xj 類別）：
//   用戶端 → hello{name, look, x, y, f, rt?} move{x, y, f} look{look} chat{ch, text} emote{e} channels hop{n} whisper{to} report{id, why}
//   伺服器 → welcome{id, players, gm, channel} join{p} leave{id} moves{m:[[id, x, y, f]]} look{id, look}
//            chat{ch, name, text, id, c, gm} emote{id, e} chatErr{e} channels{c, me} hopErr{e} whisperErr{name} reported{ok}

export const LOBBY_PATH = '/api/ro/lobby';
export const MAX_PLAYERS = 80;
export const MAX_MESSAGE = 8192;
const CHANNEL = 1;
const CHAT_CHANNELS = new Set(['local', 'general', 'trade', 'cn']);
const LOOK_EQUIP = ['headTop', 'headMid', 'headLow', 'weapon', 'shield', 'offhand', 'cart'];
const TOKEN = /^[a-z0-9_]{1,32}$/;
const MAX_COORD = 100000;

// 大廳編號 1–9（引擎預設 1）；不合法回 0
export const lobbyId = (raw) => {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 9 ? n : 0;
};

// ---- 入場票：/api/ro 用共用密鑰簽，大廳伺服器驗；不把 60 天的登入權杖交給大廳 ----
const enc = new TextEncoder();
const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(t + '='.repeat((4 - (t.length % 4)) % 4)), (c) => c.charCodeAt(0));
};
async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}
const sameStr = (a, b) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};
export async function signTicket(secret, { account, name }, now = Date.now(), ttlMs = 15 * 60_000) {
  const body = b64u(enc.encode(JSON.stringify({ a: account, n: String(name ?? '').slice(0, 24), exp: now + ttlMs })));
  return `${body}.${await hmac(secret, body)}`;
}
export async function verifyTicket(secret, ticket, now = Date.now()) {
  if (!secret || typeof ticket !== 'string' || ticket.length > 600) return null;
  const [body, sig, extra] = ticket.split('.');
  if (!body || !sig || extra !== undefined) return null;
  if (!sameStr(await hmac(secret, body), sig)) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(unb64u(body)));
    return p && p.a && Number(p.exp) > now ? p : null;
  } catch {
    return null;
  }
}

// ---- 清理：每個用戶端都會照伺服器轉的內容畫圖，所以在這裡把關 ----
const clean = (s, max) =>
  String(s ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff<>]/g, '')
    .trim()
    .slice(0, max);
const int = (v, lo, hi) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
};
// 外觀只收引擎 vh() 會送的欄位：job/promotion/pet 是代號，gender m/f，hair/hairColor/cloth 是編號，equip 是物品編號
export function cleanLook(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  if (typeof v.job !== 'string' || !TOKEN.test(v.job)) return null;
  const out = { job: v.job };
  if (typeof v.promotion === 'string' && TOKEN.test(v.promotion)) out.promotion = v.promotion;
  if (v.peco === true) out.peco = true;
  out.gender = v.gender === 'f' ? 'f' : 'm';
  for (const k of ['hair', 'hairColor', 'cloth']) out[k] = int(v[k], 0, 999);
  const equip = {};
  if (v.equip && typeof v.equip === 'object') {
    for (const k of LOOK_EQUIP) {
      const n = v.equip[k];
      if (Number.isInteger(n) && n > 0 && n < 1e8) equip[k] = n;
    }
  }
  out.equip = equip;
  if (typeof v.pet === 'string' && TOKEN.test(v.pet)) out.pet = v.pet;
  return out;
}

const pub = (p) => ({ id: p.id, name: p.name, look: p.look, x: p.x, y: p.y, f: p.f, ...(p.guest ? { guest: true } : {}) });

// 固定視窗計數：key 在 windowMs 內最多 max 次
function allow(p, key, now, max, windowMs) {
  const r = (p.rl ??= {});
  const cur = r[key];
  if (!cur || now - cur[1] >= windowMs) { r[key] = [1, now]; return true; }
  if (cur[0] >= max) return false;
  cur[0]++;
  return true;
}

function members(io) {
  const out = [];
  for (const ws of io.peers()) {
    const st = io.get(ws);
    if (st?.id) out.push([ws, st]);
  }
  return out;
}
function broadcast(io, msg, except = null) {
  for (const [ws] of members(io)) if (ws !== except) io.send(ws, msg);
}

async function hello(io, ws, m, now) {
  const auth = m.rt ? await io.verify(m.rt, now).catch(() => null) : null;
  // 驗票是非同步的：名單與人數要在驗完之後才算，不然同時進來的兩個人會互相漏掉
  if (!io.get(ws)) return; // 驗票期間已經斷線
  const others = members(io).filter(([w]) => w !== ws);
  if (others.length >= MAX_PLAYERS) return io.close(ws, 1013, 'full');
  const taken = new Set(others.map(([, s]) => s.id));
  let id;
  do id = 1 + Math.floor(Math.random() * 0x7ffffffe); while (taken.has(id));
  const me = {
    id,
    // 訪客沒有帳號可以停權，所以不用自填的角色名，改用伺服器給的編號（用戶端會再加上「訪客」標記）
    name: auth ? clean(m.name, 24) || 'Adventurer' : `冒險者 ${String(id % 10000).padStart(4, '0')}`,
    look: cleanLook(m.look) ?? { job: 'novice', gender: 'm', hair: 0, hairColor: 0, cloth: 0, equip: {} },
    x: int(m.x, 0, MAX_COORD),
    y: int(m.y, 0, MAX_COORD),
    f: int(m.f, 0, 1023),
    guest: !auth,
    acc: auth?.a ?? null,
    rl: {},
  };
  io.set(ws, me);
  io.send(ws, { t: 'welcome', id, players: others.map(([, s]) => pub(s)), gm: false, channel: CHANNEL });
  broadcast(io, { t: 'join', p: pub(me) }, ws);
}

export async function onMessage(io, ws, data, now = Date.now()) {
  if (typeof data !== 'string') return;
  if (data.length > MAX_MESSAGE) return io.close(ws, 1009, 'too big');
  let m;
  try { m = JSON.parse(data); } catch { return; }
  if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
  const me = io.get(ws);
  if (!me?.id) {
    if (m.t === 'hello' && !(me?.hello)) {
      io.set(ws, { hello: true }); // 驗票期間重送的 hello 不重複處理
      return hello(io, ws, m, now);
    }
    return;
  }
  switch (m.t) {
    case 'move': {
      if (!allow(me, 'mv', now, 12, 1000)) return;
      const x = int(m.x, 0, MAX_COORD), y = int(m.y, 0, MAX_COORD), f = int(m.f, 0, 1023);
      if (x === me.x && y === me.y && f === me.f) return;
      Object.assign(me, { x, y, f });
      io.set(ws, me);
      return broadcast(io, { t: 'moves', m: [[me.id, x, y, f]] }, ws);
    }
    case 'look': {
      const look = cleanLook(m.look);
      if (!look || !allow(me, 'lk', now, 6, 10_000)) return;
      me.look = look;
      io.set(ws, me);
      return broadcast(io, { t: 'look', id: me.id, look }, ws);
    }
    case 'chat': {
      if (me.guest) return io.send(ws, { t: 'chatErr', e: 'guest' });
      if (!CHAT_CHANNELS.has(m.ch)) return;
      const text = clean(m.text, 200);
      if (!text) return;
      const ok = allow(me, 'ch', now, 5, 10_000);
      io.set(ws, me);
      if (!ok) return io.send(ws, { t: 'chatErr', e: 'rate' });
      return broadcast(io, { t: 'chat', ch: m.ch, name: me.name, text, id: me.id, c: CHANNEL, gm: false });
    }
    case 'emote': {
      const e = int(m.e, 0, 99);
      const ok = allow(me, 'em', now, 3, 3000);
      io.set(ws, me);
      if (ok) broadcast(io, { t: 'emote', id: me.id, e });
      return;
    }
    case 'channels':
      return io.send(ws, { t: 'channels', c: [[CHANNEL, members(io).length]], me: CHANNEL });
    case 'hop':
      if (int(m.n, 0, 99) !== CHANNEL) io.send(ws, { t: 'hopErr', e: 'full' });
      return;
    case 'whisper':
      return io.send(ws, { t: 'whisperErr', name: clean(m.to, 24) });
    case 'report':
      io.log?.('[ro-lobby] report', me.acc ?? 'guest', '→', int(m.id, 0, 0x7fffffff), clean(m.why, 16));
      return io.send(ws, { t: 'reported', ok: true });
    default:
      // profile、chatCn、好友、組隊、交易、檢視：第一階段不處理
      return;
  }
}

export function onClose(io, ws) {
  const me = io.get(ws);
  io.set(ws, null);
  if (me?.id) broadcast(io, { t: 'leave', id: me.id }, ws);
}
