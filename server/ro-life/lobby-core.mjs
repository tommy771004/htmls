// 282 普隆德拉大廳的連線核心。
// 第一階段：加入／離開、走動、外觀、表情、公開聊天。第二階段（社交）：檢視資料、密語、好友。不碰遊戲規則；組隊、交易還沒做。
// 全部大廳編號共用同一個廣場（好友上線狀態與密語才不會分散在不同大廳），上限 MAX_PLAYERS 人。
// 本機 Node（server/ro-life/lobby.mjs）與 Cloudflare Durable Object（games/282-ro-life/worker/index.js）共用這一份。
// 核心本身不留狀態：每條連線的資料經 io.get／io.set 存取（DO 版放在 WebSocket attachment，休眠後還在）。
//
// io 介面：
//   peers()            這個大廳所有連線（含還沒打招呼的）
//   get(ws) / set(ws, state)
//   send(ws, msg)      送 JSON
//   close(ws, code, reason)
//   verify(ticket, now) → Promise<{a, n, exp} | null>   驗證 /api/ro/lobby-ticket 發的入場票
//   db                 lobby-store.mjs 的 sqlStore／memoryStore（同步）
//   log?(...args)
// 身分只認入場票的 a（帳號）；票裡的 n 是 Google／LINE 的名字，不顯示。
//
// 訊息格式照引擎原本的大廳協定（main-*.js 的 Xj 類別）：
//   用戶端 → hello{name, look, x, y, f, rt?} move{x, y, f} look{look} chat{ch, text} emote{e} channels hop{n} report{id, why}
//            profile{p} inspect{id} whisper{to, text} friendAdd{name, id?} friendReply{name, ok} friendRemove{name}
//   伺服器 → welcome{id, players, gm, channel, social} join{p} leave{id} moves{m:[[id, x, y, f]]} look{id, look}
//            chat{ch, name, text, id, c, gm} emote{id, e} chatErr{e} channels{c, me} hopErr{e} reported{ok}
//            profile{id, p, name, look} whisper{out, name, text, id, c} whisperErr{name}
//            friends{list:[{name, on, id?}], asks:[name]} friendAsk{name} friendNote{what, name}
// welcome 的 social＝這個伺服器有社交功能；頁面比伺服器先更新時，舊伺服器不送它，頁面就不顯示社交按鈕。

import { FRIEND_MAX, ASK_MAX } from './lobby-store.mjs';

export const LOBBY_PATH = '/api/ro/lobby';
export const MAX_PLAYERS = 80;
export const MAX_MESSAGE = 16384;
export const MAX_PROFILE = 12000; // 清理後的檢視資料 JSON 上限（存在 db，不放 attachment）
const CHANNEL = 1;
const CHAT_CHANNELS = new Set(['local', 'general', 'trade', 'cn']);
const LOOK_EQUIP = ['headTop', 'headMid', 'headLow', 'weapon', 'shield', 'offhand', 'cart'];
const TOKEN = /^[a-z0-9_]{1,32}$/;
const KEY = /^[A-Za-z0-9_.]{1,64}$/; // 能力、天賦（swordsman.0.sword_mastery）、詞綴、技能、裝備欄位的代號
const STATS = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];
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

// 檢視資料（引擎 kx() 送的 level、jobLevel、stats、talents、gear、record、gs）：別人的檢視視窗會用 innerHTML 畫，
// 所以只留數字與代號，其他一律丟掉
const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? int(v, lo, hi) : undefined);
export function cleanProfile(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const obj = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});
  const stats = {};
  for (const k of STATS) { const n = num(obj(v.stats)[k], 0, 9999); if (n !== undefined) stats[k] = n; }
  const talents = {};
  for (const [k, r] of Object.entries(obj(v.talents)).slice(0, 300)) { const n = num(r, 0, 99); if (KEY.test(k) && n) talents[k] = n; }
  const gear = [];
  for (const g of Array.isArray(v.gear) ? v.gear.slice(0, 16) : []) {
    if (!g || typeof g !== 'object' || !KEY.test(g.slot ?? '')) continue;
    const itemId = num(g.itemId, 0, 1e8);
    if (!itemId) continue;
    const it = { slot: g.slot, itemId, cards: (Array.isArray(g.cards) ? g.cards.slice(0, 4) : []).map((c) => num(c, 0, 1e8) || null) };
    for (const [k, hi] of [['quality', 20], ['refine', 20], ['ilvl', 9999], ['tier', 99]]) { const n = num(g[k], 0, hi); if (n !== undefined) it[k] = n; }
    if (Array.isArray(g.affixes)) {
      it.affixes = g.affixes.slice(0, 10).filter((a) => a && KEY.test(a.stat ?? '') && typeof a.value === 'number' && Number.isFinite(a.value))
        .map((a) => ({ stat: a.stat, value: Math.round(Math.max(-1e6, Math.min(1e6, a.value)) * 1000) / 1000, ...(KEY.test(a.skill ?? '') ? { skill: a.skill } : {}) }));
    }
    gear.push(it);
  }
  const rec = obj(v.record), record = {};
  for (const k of ['stage', 'bestLevel', 'wins', 'runs', 'totalKills', 'mvps']) record[k] = num(rec[k], 0, 1e9) ?? 0;
  return { level: num(v.level, 1, 9999) ?? 1, jobLevel: num(v.jobLevel, 1, 9999) ?? 1, stats, talents, gear, record, gs: num(v.gs, 0, 1e9) ?? 0 };
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

// ---- 社交 ----
const lower = (s) => s.toLocaleLowerCase();
// 登入的玩家依帳號分組（同一個帳號可能開好幾個分頁）；except 是正在關閉、還列在 peers() 裡的連線
function byAccount(io, except = null) {
  const out = new Map();
  for (const [ws, st] of members(io)) {
    if (ws === except || st.guest || !st.acc) continue;
    if (!out.has(st.acc)) out.set(st.acc, []);
    out.get(st.acc).push([ws, st]);
  }
  return out;
}
// 名字可能重複：同一份清單裡把重名的依帳號排序後加「 #2」「 #3」，讓用戶端用名字回覆時仍能對回唯一帳號
function uniqueNames(rows) {
  const groups = new Map();
  for (const r of rows) { const k = lower(r.name); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
  for (const g of groups.values()) if (g.length > 1) g.sort((x, y) => (x.acc < y.acc ? -1 : 1)).forEach((r, i) => i && (r.name = `${r.name} #${i + 1}`));
  return rows;
}
function friendView(io, acc, on = byAccount(io)) {
  const nameOf = (a) => on.get(a)?.[0][1].name ?? io.db.getName(a) ?? '?';
  const list = uniqueNames(io.db.friendsOf(acc).map((a) => {
    const s = on.get(a)?.[0][1];
    return { acc: a, name: nameOf(a), on: s ? CHANNEL : 0, ...(s ? { id: s.id } : {}) };
  }));
  const asks = uniqueNames(io.db.asksTo(acc).map((a) => ({ acc: a, name: nameOf(a) })));
  return { list, asks };
}
function sendFriends(io, acc, on = byAccount(io)) {
  const socks = on.get(acc);
  if (!socks) return;
  const v = friendView(io, acc, on);
  const msg = { t: 'friends', list: v.list.map(({ acc: _, ...r }) => r), asks: v.asks.map((r) => r.name) };
  for (const [ws] of socks) io.send(ws, msg);
}
// 我上線／下線：通知在線上的好友更新清單
function tellFriends(io, acc, on) {
  for (const f of io.db.friendsOf(acc)) if (on.has(f)) sendFriends(io, f, on);
}
const toAcc = (io, on, acc, msg) => { for (const [ws] of on.get(acc) ?? []) io.send(ws, msg); };
// 名字 → 帳號：先找自己的好友清單（清單上的名字可能帶 #2），再找廣場上登入的玩家；找不到或有好幾個帳號同名就回 null
function resolve(io, me, raw, on, { onlineOnly = true } = {}) {
  const k = lower(clean(raw, 32));
  if (!k) return null;
  const f = friendView(io, me.acc, on).list.find((r) => lower(r.name) === k);
  if (f && (!onlineOnly || f.on)) return f.acc;
  const hits = [...on].filter(([, socks]) => socks.some(([, st]) => lower(st.name) === k)).map(([a]) => a);
  return hits.length === 1 ? hits[0] : null;
}
const nameIn = (rows, acc) => rows.find((r) => r.acc === acc)?.name;

function friendAdd(io, ws, me, m, now) {
  const note = (what, name = '') => io.send(ws, { t: 'friendNote', what, name });
  const on = byAccount(io);
  const raw = clean(m.name, 32);
  let target = null;
  const byId = Number.isInteger(m.id) ? members(io).find(([, st]) => st.id === m.id)?.[1] : null;
  if (byId && !byId.guest) target = byId.acc;
  else target = resolve(io, me, raw, on, { onlineOnly: false });
  if (!target) return note('notFound', raw);
  if (target === me.acc) return note('self');
  const db = io.db;
  const theirName = () => nameIn(friendView(io, me.acc, on).list, target) ?? on.get(target)?.[0][1].name ?? db.getName(target) ?? raw;
  if (db.isFriend(me.acc, target)) return note('already', theirName());
  if (db.friendCount(me.acc) >= FRIEND_MAX) return note('full');
  if (db.hasAsk(target, me.acc)) {
    // 對方已經邀請過我：直接成為好友
    if (db.friendCount(target) >= FRIEND_MAX) return note('fullThem', raw);
    db.delAsk(target, me.acc);
    db.addFriend(me.acc, target, now);
    note('added', theirName());
    toAcc(io, on, target, { t: 'friendNote', what: 'added', name: nameIn(friendView(io, target, on).list, me.acc) ?? me.name });
    sendFriends(io, me.acc, on);
    return sendFriends(io, target, on);
  }
  if (db.friendCount(target) >= FRIEND_MAX) return note('fullThem', raw);
  if (!db.hasAsk(me.acc, target)) {
    if (db.askCount(target) >= ASK_MAX) return note('pending', raw);
    db.addAsk(me.acc, target, now);
    if (on.has(target)) {
      toAcc(io, on, target, { t: 'friendAsk', name: nameIn(friendView(io, target, on).asks, me.acc) ?? me.name });
      sendFriends(io, target, on);
    }
  }
  return note('sent', raw);
}
function friendReply(io, ws, me, m, now) {
  const on = byAccount(io);
  const k = lower(clean(m.name, 32));
  const src = friendView(io, me.acc, on).asks.find((r) => lower(r.name) === k)?.acc;
  if (src) {
    io.db.delAsk(src, me.acc);
    if (m.ok === true) {
      if (io.db.friendCount(me.acc) >= FRIEND_MAX) io.send(ws, { t: 'friendNote', what: 'full', name: '' });
      else if (io.db.friendCount(src) >= FRIEND_MAX) io.send(ws, { t: 'friendNote', what: 'fullThem', name: clean(m.name, 32) });
      else {
        io.db.addFriend(me.acc, src, now);
        io.send(ws, { t: 'friendNote', what: 'added', name: nameIn(friendView(io, me.acc, on).list, src) ?? '' });
        toAcc(io, on, src, { t: 'friendNote', what: 'added', name: nameIn(friendView(io, src, on).list, me.acc) ?? me.name });
        sendFriends(io, src, on);
      }
    }
  }
  sendFriends(io, me.acc, on);
}
function friendRemove(io, ws, me, m) {
  const on = byAccount(io);
  const k = lower(clean(m.name, 32));
  const row = friendView(io, me.acc, on).list.find((r) => lower(r.name) === k);
  if (row) {
    io.db.removeFriend(me.acc, row.acc);
    io.send(ws, { t: 'friendNote', what: 'removed', name: row.name });
    sendFriends(io, row.acc, on);
  }
  sendFriends(io, me.acc, on);
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
    acc: auth?.a != null ? String(auth.a) : null,
    rl: {},
  };
  io.set(ws, me);
  io.send(ws, { t: 'welcome', id, players: others.map(([, s]) => pub(s)), gm: false, channel: CHANNEL, social: 1 });
  broadcast(io, { t: 'join', p: pub(me) }, ws);
  if (me.acc) {
    io.db.setName(me.acc, me.name, now);
    const on = byAccount(io);
    sendFriends(io, me.acc, on);
    tellFriends(io, me.acc, on);
  }
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
    case 'whisper': {
      const to = clean(m.to, 32);
      if (me.guest) return io.send(ws, { t: 'chatErr', e: 'guest' });
      const text = clean(m.text, 200);
      if (!text) return;
      const ok = allow(me, 'ch', now, 5, 10_000);
      io.set(ws, me);
      if (!ok) return io.send(ws, { t: 'chatErr', e: 'rate' });
      const on = byAccount(io);
      const acc = resolve(io, me, to, on);
      if (!acc || acc === me.acc) return io.send(ws, { t: 'whisperErr', name: to });
      const [, them] = on.get(acc)[0];
      toAcc(io, on, acc, { t: 'whisper', out: false, name: nameIn(friendView(io, acc, on).list, me.acc) ?? me.name, text, id: me.id, c: CHANNEL, gm: false });
      return io.send(ws, { t: 'whisper', out: true, name: nameIn(friendView(io, me.acc, on).list, acc) ?? them.name, text, id: them.id, c: CHANNEL, gm: false });
    }
    case 'profile': {
      const ok = allow(me, 'pf', now, 6, 10_000);
      io.set(ws, me);
      if (!ok) return;
      const p = cleanProfile(m.p);
      const json = p && JSON.stringify(p);
      if (json && json.length <= MAX_PROFILE) return io.db.setProfile(me.id, json);
      io.db.delProfile(me.id);
      return io.log?.('[ro-lobby] profile dropped', json ? json.length : 'invalid');
    }
    case 'inspect': {
      const id = int(m.id, 0, 0x7fffffff);
      const ok = allow(me, 'in', now, 10, 10_000);
      io.set(ws, me);
      const st = ok ? members(io).find(([, s]) => s.id === id)?.[1] : null;
      const raw = st ? io.db.getProfile(id) : null;
      return io.send(ws, st && raw ? { t: 'profile', id, p: JSON.parse(raw), name: st.name, look: st.look } : { t: 'profile', id, p: null });
    }
    case 'friendAdd':
    case 'friendReply':
    case 'friendRemove': {
      if (me.guest) return io.send(ws, { t: 'friendNote', what: 'guest', name: '' });
      const ok = allow(me, 'fr', now, 20, 60_000);
      io.set(ws, me);
      if (!ok) return;
      if (m.t === 'friendAdd') return friendAdd(io, ws, me, m, now);
      if (m.t === 'friendReply') return friendReply(io, ws, me, m, now);
      return friendRemove(io, ws, me, m);
    }
    case 'report':
      io.log?.('[ro-lobby] report', me.acc ?? 'guest', '→', int(m.id, 0, 0x7fffffff), clean(m.why, 16));
      return io.send(ws, { t: 'reported', ok: true });
    default:
      // chatCn、組隊、交易：還沒做
      return;
  }
}

export function onClose(io, ws) {
  const me = io.get(ws);
  io.set(ws, null);
  if (!me?.id) return;
  broadcast(io, { t: 'leave', id: me.id }, ws);
  io.db?.delProfile(me.id);
  // 同帳號還有別的分頁時也通知：好友清單上的 id 要換成還在的那一頁
  if (me.acc) tellFriends(io, me.acc, byAccount(io, ws));
}
