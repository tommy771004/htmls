// 282 普隆德拉大廳：玩家交易的撮合（lobby-core.mjs 呼叫這裡）。大廳只轉送出價與狀態；成交時呼叫 io.settle()，
// 由 Vercel（/api/ro/trade/settle，trade.mjs）在兩邊的伺服器存檔上搬東西，大廳不碰庫存。
//
// 訊息照引擎原本的協定（main-*.js 的交易視窗 v3）：
//   用戶端 → 伺服器：tradeReq{id} tradeReply{id, ok} tradeOffer{o} tradeLock tradeConfirm tradeCancel tradeChat{text}
//   伺服器 → 用戶端：tradeAsk{id, name} tradeOpen{name} tradeOffer{o} tradeState{me:{lock, ok}, them:{lock, ok}}
//                    tradeChat{name, text, id} tradeDone{give, get} tradeEnd{why}
//   why：cancel declined busy gone timeout guest guestThem same missing offline（offline＝對方不是線上模式，頁面另外補字）
// 規則：只有登入、線上模式（hello 帶 on:1）的玩家能交易；同一個帳號同時只能有一筆（不分分頁）。
// 改出價只能在自己還沒按 OK 時；任何一邊改了出價，雙方的 OK 與確認都取消。兩邊都 OK 才能確認，兩邊都確認才結算。
// 狀態放在連線的 attachment：邀請 tq／ta（期限 ASK_MS，到期由 tradeAlarm 處理）、交易中 tr（對方的連線 id、帳號、自己的出價）。
// 結算是非同步的：先把兩邊標成 busy（不再收出價、取消），結算回來後重新讀兩邊的狀態再送結果。
// io.settle(payload) → Promise<{ok, a:{give, get}, b:{give, get}} | {error}>；沒有 settle 的大廳不開放交易（welcome 不帶 trade）。
import { members, safe, clean, allow, muted } from './lobby-core.mjs';
import { cleanOffer, emptyOffer } from './trade.mjs';

export const ASK_MS = 30_000;
const randomId = () => [...crypto.getRandomValues(new Uint8Array(12))].map((x) => x.toString(16).padStart(2, '0')).join('');
const EMPTY = { gear: [], cards: [], ores: [], kafra: 0 };

const byId = (io, id) => (Number.isInteger(id) ? members(io).find(([, s]) => s.id === id) ?? null : null);
const end = (io, ws, why) => io.send(ws, { t: 'tradeEnd', why });
const busyAcc = (io, acc, now) => members(io).some(([, s]) => s.acc === acc && (s.tr || (s.tq && s.tq.until > now) || (s.ta && s.ta.until > now)));
const status = (tr) => ({ lock: !!tr?.lock, ok: !!tr?.ok });
function sendStates(io, a, b) {
  io.send(a[0], { t: 'tradeState', me: status(a[1].tr), them: status(b[1].tr) });
  io.send(b[0], { t: 'tradeState', me: status(b[1].tr), them: status(a[1].tr) });
}
// 交易中的對方（雙向都要對得上，才不會被舊的狀態騙）
function peerOf(io, me) {
  const p = me.tr ? byId(io, me.tr.id) : null;
  return p && p[1].tr?.id === me.id && p[1].acc === me.tr.acc ? p : null;
}
function stop(io, ws, me, why, peer = peerOf(io, me)) {
  delete me.tr;
  io.set(ws, me);
  if (peer) { delete peer[1].tr; io.set(peer[0], peer[1]); end(io, peer[0], why); }
}

export async function tradeMessage(io, ws, me, m, now) {
  if (!io.settle) return;
  switch (m.t) {
    case 'tradeReq': {
      if (me.guest || !me.acc) return end(io, ws, 'guest');
      if (!me.on) return end(io, ws, 'offline');
      if (!allow(me, 'tq', now, 10, 60_000)) { io.set(ws, me); return; }
      const t = byId(io, m.id);
      if (!t) return end(io, ws, 'gone');
      const [tws, ts] = t;
      if (ts.guest || !ts.acc) return end(io, ws, 'guestThem');
      if (ts.acc === me.acc) return end(io, ws, 'same');
      if (!ts.on) return end(io, ws, 'offline');
      if (busyAcc(io, me.acc, now) || busyAcc(io, ts.acc, now)) return end(io, ws, 'busy');
      const until = now + ASK_MS;
      me.tq = { id: ts.id, until };
      io.set(ws, me);
      ts.ta = { id: me.id, until };
      io.set(tws, ts);
      io.send(tws, { t: 'tradeAsk', id: me.id, name: me.name });
      io.wake?.(until);
      return;
    }
    case 'tradeReply': {
      if (!me.ta || me.ta.id !== m.id) return;
      const ask = me.ta;
      delete me.ta;
      io.set(ws, me);
      const r = byId(io, ask.id);
      const live = r && r[1].tq?.id === me.id ? r : null;
      if (live) { delete live[1].tq; io.set(live[0], live[1]); }
      if (ask.until <= now) { end(io, ws, 'timeout'); if (live) end(io, live[0], 'timeout'); return; }
      if (!live) return end(io, ws, 'gone');
      if (!m.ok) return end(io, live[0], 'declined');
      if (me.tr || live[1].tr) { end(io, ws, 'busy'); return end(io, live[0], 'busy'); }
      const tid = randomId();
      me.tr = { id: live[1].id, acc: live[1].acc, offer: EMPTY, lock: 0, ok: 0, tid };
      live[1].tr = { id: me.id, acc: me.acc, offer: EMPTY, lock: 0, ok: 0, tid };
      io.set(ws, me);
      io.set(live[0], live[1]);
      io.send(ws, { t: 'tradeOpen', name: live[1].name });
      io.send(live[0], { t: 'tradeOpen', name: me.name });
      return sendStates(io, [ws, me], live);
    }
    case 'tradeOffer': {
      const peer = peerOf(io, me);
      if (!peer) { if (me.tr) stop(io, ws, me, 'gone', null); return end(io, ws, 'gone'); }
      if (me.tr.busy || me.tr.lock) return;
      if (!allow(me, 'to', now, 30, 10_000)) { io.set(ws, me); return; }
      const o = cleanOffer(m.o);
      if (!o) return;
      me.tr = { ...me.tr, offer: o, ok: 0 };
      peer[1].tr = { ...peer[1].tr, lock: 0, ok: 0 };
      io.set(ws, me);
      io.set(peer[0], peer[1]);
      io.send(peer[0], { t: 'tradeOffer', o });
      return sendStates(io, [ws, me], peer);
    }
    case 'tradeLock': {
      const peer = peerOf(io, me);
      if (!peer || me.tr.busy) return;
      me.tr = { ...me.tr, lock: 1 };
      io.set(ws, me);
      return sendStates(io, [ws, me], peer);
    }
    case 'tradeConfirm': {
      const peer = peerOf(io, me);
      if (!peer || me.tr.busy || !me.tr.lock || !peer[1].tr.lock) return;
      me.tr = { ...me.tr, ok: 1 };
      io.set(ws, me);
      sendStates(io, [ws, me], peer);
      if (peer[1].tr.ok) return settle(io, [ws, me], peer, now);
      return;
    }
    case 'tradeCancel': {
      if (!me.tr || me.tr.busy) return;
      stop(io, ws, me, 'cancel');
      return end(io, ws, 'cancel');
    }
    case 'tradeChat': {
      const peer = peerOf(io, me);
      if (!peer) return;
      const text = clean(m.text, 120);
      if (!text) return;
      const ok = allow(me, 'tc', now, 8, 10_000);
      io.set(ws, me);
      if (!ok) return io.send(ws, { t: 'chatErr', e: 'rate' });
      const mu = muted(io, me, now);
      if (mu) return io.send(ws, { t: 'chatErr', e: 'muted', until: mu.until });
      const msg = { t: 'tradeChat', name: me.name, text, id: me.id };
      io.send(ws, msg);
      io.send(peer[0], msg);
      // 記成雙方之間的密語：檢舉時一起留證據
      return safe(io, () => io.db.logChat({ acc: me.acc, name: me.name, kind: 'whisper', dst: peer[1].acc, text: '[交易] ' + text, at: now }));
    }
  }
}

async function settle(io, a, b, now) {
  const tid = a[1].tr.tid;
  const ids = [a[1].id, b[1].id];
  for (const [w, s] of [a, b]) { s.tr = { ...s.tr, busy: 1 }; io.set(w, s); }
  const [A, B] = [a[1], b[1]];
  const payload = { id: tid, ts: now, a: { acc: A.acc, offer: A.tr.offer }, b: { acc: B.acc, offer: B.tr.offer } };
  let r;
  if (emptyOffer(A.tr.offer) && emptyOffer(B.tr.offer)) r = { error: 'cancel' };
  else {
    try { r = await io.settle(payload); } catch (e) { io.log?.('[ro-lobby] trade settle', e?.message ?? e); r = { error: 'cancel' }; }
  }
  // 等待期間可能有人斷線或換了狀態：重新讀
  const out = [[ids[0], r?.a], [ids[1], r?.b]];
  for (const [id, mine] of out) {
    const c = byId(io, id);
    if (!c || c[1].tr?.tid !== tid) continue;
    delete c[1].tr;
    io.set(c[0], c[1]);
    if (r?.ok) io.send(c[0], { t: 'tradeDone', give: mine.give, get: mine.get });
    else end(io, c[0], r?.error === 'missing' ? 'missing' : r?.error === 'offline' ? 'offline' : 'cancel');
  }
}

// 斷線：交易中或邀請中的對方收到 gone
export function tradeClose(io, ws, me) {
  if (!me) return;
  if (me.tr && !me.tr.busy) { const p = peerOf(io, me); if (p) { delete p[1].tr; io.set(p[0], p[1]); end(io, p[0], 'gone'); } }
  for (const [k, other] of [['tq', 'ta'], ['ta', 'tq']]) {
    if (!me[k]) continue;
    const p = byId(io, me[k].id);
    if (p && p[1][other]?.id === me.id) { delete p[1][other]; io.set(p[0], p[1]); end(io, p[0], 'gone'); }
  }
}

// 邀請到期（lobby-party.mjs 的 onAlarm 一起叫）：回傳下一個要叫醒的時間
export function tradeAlarm(io, now) {
  let next = Infinity;
  for (const [ws, st] of members(io)) {
    for (const k of ['tq', 'ta']) {
      if (!st[k]) continue;
      if (st[k].until > now) { next = Math.min(next, st[k].until); continue; }
      delete st[k];
      io.set(ws, st);
      end(io, ws, 'timeout');
    }
  }
  return next;
}
