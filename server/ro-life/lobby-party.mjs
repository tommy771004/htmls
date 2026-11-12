// 282 普隆德拉大廳：組隊與合作關卡的轉送（lobby-core.mjs 呼叫這裡）。不碰遊戲規則：關卡由房主的用戶端模擬，伺服器只轉送。
//
// 訊息照引擎原本的協定（main-*.js：a3 隊伍框、e_ 合作關卡、t3 本局連線）：
//   大廳連線（用戶端 → 伺服器）partyInvite{id} partyReply{ok} partyLeave partyKick{mid} partyLead{mid}
//                              partyGo{trip:{stage, diff}} partyReady{ok} chat{ch:'party', text}
//   大廳連線（伺服器 → 用戶端）party{p: {me, leader, members:[{mid, id, name, job, promotion, gender, level, jobLevel, gs, online, channel, inRun}]} | null}
//                              partyAsk{id, name} partyErr{why, name} partyCheck{trip, ready:[mid]} partyCheckEnd{why, name} partyStart{trip}
//   本局連線（同一個網址加 run=1；hello 帶 run:true 與入場票 rt）
//     用戶端 → 伺服器：hello{run:true, name, look, rt} run{d} chat{ch:'party', text}
//     伺服器 → 用戶端：runWelcome{me, host, mates:[{mid, name, look}]} runJoin{m} runLeave{mid} runHost{mid} run{from, d} chat chatErr
// 隊員以帳號計（mid 是隊伍內的編號，大廳連線與本局連線共用），只有登入玩家能組隊；隊伍存在 db（事件時才寫），
// 邀請放在被邀請者連線的 attachment，邀請與出發確認的期限用 io.wake(at) 叫醒（DO 用 alarm、Node 用 setTimeout）。
// 本局連線的身分只認入場票，不轉送、也不比對引擎的分頁 key。
import { members, byAccount, safe, clean, int, allow, cleanLook, muted } from './lobby-core.mjs';
import { tradeAlarm } from './lobby-trade.mjs';

export const PARTY_MAX = 3; // 同引擎 $0
export const INVITE_MS = 30_000;
export const CHECK_MS = 30_000;
export const PARTY_IDLE_MS = 10 * 60_000; // 所有隊員都不在線上這麼久就解散
export const RUN_HOST_WAIT_MS = 15_000; // 隊長還沒連進本局時，先等這麼久再讓別人當房主
export const RUN_RATE = 60; // 本局連線每秒最多轉送幾則（實測房主約 20 則）
export const RUN_MAX_MESSAGE = 65536; // 本局連線單則上限：房主的 mobs 封包新怪物最多 200 隻，但位置更新沒有上限，大波怪會超過大廳的 16 KB
export const RUN_CLOSE = 4000; // 引擎的本局連線（t3）只有這個代碼不會自動重連
const TOKEN = /^[a-z0-9_]{1,32}$/;
const KEY = /^[A-Za-z0-9_.]{1,32}$/;

// ---- 隊伍資料（快取在 io，來源是 db；DO 醒來時重新讀） ----
function table(io) {
  if (!io.parties) {
    io.parties = new Map();
    for (const p of safe(io, () => io.db.parties(), [])) io.parties.set(p.pid, p);
  }
  return io.parties;
}
const save = (io, p, now) => { table(io).set(p.pid, p); safe(io, () => io.db.saveParty(p, now)); };
const drop = (io, p) => { table(io).delete(p.pid); safe(io, () => io.db.delParty(p.pid)); };
export const partyOf = (io, acc) => (acc ? [...table(io).values()].find((p) => p.members.some((m) => m.acc === acc)) ?? null : null);
const memberOf = (p, acc) => p.members.find((m) => m.acc === acc);

// 本局連線（沒有 id，不算在廣場裡）
function runSocks(io, pid) {
  const out = [];
  for (const ws of io.peers()) { const st = io.get(ws); if (st?.run === pid) out.push([ws, st]); }
  return out;
}

export function cleanTrip(t) {
  if (!t || typeof t !== 'object' || typeof t.stage !== 'string' || !TOKEN.test(t.stage)) return null;
  const diff = {};
  if (t.diff && typeof t.diff === 'object' && !Array.isArray(t.diff)) {
    for (const [k, v] of Object.entries(t.diff).slice(0, 16)) if (KEY.test(k) && typeof v === 'number' && Number.isFinite(v)) diff[k] = Math.max(-1000, Math.min(1000, v));
  }
  return { stage: t.stage, diff };
}

function view(io, p, acc, on) {
  const inRun = new Set(runSocks(io, p.pid).map(([, st]) => st.acc));
  return {
    me: memberOf(p, acc)?.mid ?? 0,
    leader: p.leader,
    members: p.members.map((m) => {
      const s = on.get(m.acc)?.[0][1];
      const look = s?.look ?? m.look ?? {};
      return {
        mid: m.mid, id: s?.id ?? 0, name: s?.name ?? m.name, job: look.job ?? 'novice', ...(look.promotion ? { promotion: look.promotion } : {}),
        gender: look.gender ?? 'm', level: s?.lv ?? m.lv ?? 1, jobLevel: s?.jl ?? m.jl ?? 1, gs: s?.gs ?? m.gs ?? 0, online: !!s, channel: s?.ch ?? 0, inRun: inRun.has(m.acc),
      };
    }),
  };
}
const toAcc = (io, on, acc, msg) => { for (const [ws] of on.get(acc) ?? []) io.send(ws, msg); };
export function sendParty(io, p, on = byAccount(io)) {
  for (const m of p.members) toAcc(io, on, m.acc, { t: 'party', p: view(io, p, m.acc, on) });
}
const toParty = (io, p, on, msg) => { for (const m of p.members) toAcc(io, on, m.acc, msg); };

// 邀請放在被邀請者每個分頁的 attachment
function setInvite(io, acc, inv) {
  for (const [ws, st] of members(io)) if (st.acc === acc) { if (inv) st.pinv = inv; else delete st.pinv; io.set(ws, st); }
}
const inviteOf = (io, acc) => members(io).find(([, st]) => st.acc === acc && st.pinv)?.[1].pinv ?? null;

function leave(io, p, acc, now, on, why = null) {
  const m = memberOf(p, acc);
  if (!m) return;
  p.members = p.members.filter((x) => x !== m);
  toAcc(io, on, acc, { t: 'party', p: null });
  // 本局裡的人被踢或離隊：關掉它的本局連線，其他人收到離開、必要時換房主
  if (p.run) {
    for (const [w, st] of runSocks(io, p.pid)) if (st.acc === acc) { io.set(w, null); rates.delete(w); io.close(w, RUN_CLOSE, 'left party'); }
    const rest = runSocks(io, p.pid);
    for (const [w] of rest) io.send(w, { t: 'runLeave', mid: m.mid });
    if (p.run.host === m.mid && rest.length) {
      p.run.host = (rest.find(([, st]) => memberOf(p, st.acc)?.mid === p.leader && p.leader !== m.mid) ?? rest[0])[1].mid;
      for (const [w] of rest) io.send(w, { t: 'runHost', mid: p.run.host });
    }
    if (!rest.length) p.run = null;
  }
  if (why) toAcc(io, on, acc, { t: 'partyErr', why, name: '' });
  if (p.check) { p.check = null; toParty(io, p, on, { t: 'partyCheckEnd', why: 'gone', name: m.name }); }
  if (p.members.length < 2) {
    for (const x of p.members) toAcc(io, on, x.acc, { t: 'party', p: null });
    for (const [ws] of runSocks(io, p.pid)) { io.set(ws, null); rates.delete(ws); io.close(ws, RUN_CLOSE, 'party over'); }
    return drop(io, p);
  }
  if (p.leader === m.mid) p.leader = p.members[0].mid;
  save(io, p, now);
  sendParty(io, p, on);
}

// ---- 大廳連線上的組隊訊息 ----
export function partyMessage(io, ws, me, m, now) {
  const on = byAccount(io);
  const err = (why, name = '') => io.send(ws, { t: 'partyErr', why, name });
  if (me.guest || !me.acc) return err('guest');
  if (!allow(me, 'pt', now, 20, 60_000)) { io.set(ws, me); return; }
  io.set(ws, me);
  const p = partyOf(io, me.acc);
  const mine = p && memberOf(p, me.acc);
  switch (m.t) {
    case 'partyInvite': {
      const them = members(io).find(([, st]) => st.id === int(m.id, 0, 0x7fffffff))?.[1];
      if (!them) return err('offline');
      if (them.guest || !them.acc) return err('guestThem', them.name);
      if (them.acc === me.acc) return;
      if (p && p.leader !== mine.mid) return err('notLeader');
      if (p && p.members.length >= PARTY_MAX) return err('full');
      const inv = inviteOf(io, them.acc);
      if (partyOf(io, them.acc) || (inv && inv.until > now)) return err('busy', them.name);
      setInvite(io, them.acc, { from: me.acc, name: me.name, until: now + INVITE_MS });
      toAcc(io, on, them.acc, { t: 'partyAsk', id: me.id, name: me.name });
      return io.wake?.(now + INVITE_MS);
    }
    case 'partyReply': {
      const inv = inviteOf(io, me.acc);
      if (!inv) return;
      setInvite(io, me.acc, null);
      if (inv.until <= now) return err('timeout');
      if (!on.has(inv.from)) return err('gone', inv.name);
      if (m.ok !== true) return toAcc(io, on, inv.from, { t: 'partyErr', why: 'declined', name: me.name });
      if (p) return err('busy', me.name);
      let q = partyOf(io, inv.from);
      if (q && q.leader !== memberOf(q, inv.from).mid) return err('gone', inv.name);
      if (q && q.members.length >= PARTY_MAX) return err('full');
      if (!q) {
        const host = on.get(inv.from)[0][1];
        let pid;
        do pid = 1 + Math.floor(Math.random() * 0x7ffffffe); while (table(io).has(pid));
        q = { pid, leader: 1, seq: 1, members: [{ mid: 1, acc: inv.from, name: host.name, look: host.look, lv: host.lv, jl: host.jl, gs: host.gs }], check: null, run: null, seen: now };
      }
      q.members.push({ mid: ++q.seq, acc: me.acc, name: me.name, look: me.look, lv: me.lv, jl: me.jl, gs: me.gs });
      save(io, q, now);
      return sendParty(io, q, on);
    }
    case 'partyLeave':
      return p && leave(io, p, me.acc, now, on);
    case 'partyKick': {
      if (!p || p.leader !== mine.mid) return;
      const t = p.members.find((x) => x.mid === int(m.mid, 0, 99));
      return t && t !== mine && leave(io, p, t.acc, now, on, 'kicked');
    }
    case 'partyLead': {
      if (!p || p.leader !== mine.mid) return;
      const t = p.members.find((x) => x.mid === int(m.mid, 0, 99));
      if (!t || t === mine) return;
      p.leader = t.mid;
      save(io, p, now);
      return sendParty(io, p, on);
    }
    case 'partyGo': {
      if (!p || p.leader !== mine.mid || p.check) return;
      const trip = cleanTrip(m.trip);
      if (!trip) return;
      const inRun = new Set(runSocks(io, p.pid).map(([, st]) => st.acc));
      const away = p.members.find((x) => !on.has(x.acc) || inRun.has(x.acc));
      if (away) return io.send(ws, { t: 'partyCheckEnd', why: 'away', name: on.get(away.acc)?.[0][1].name ?? away.name });
      p.check = { trip, ready: [mine.mid], until: now + CHECK_MS };
      save(io, p, now);
      toParty(io, p, on, { t: 'partyCheck', trip, ready: p.check.ready });
      return io.wake?.(p.check.until);
    }
    case 'partyReady': {
      if (!p?.check) return;
      if (m.ok !== true) {
        const why = mine.mid === p.leader ? 'cancel' : 'declined';
        p.check = null;
        save(io, p, now);
        return toParty(io, p, on, { t: 'partyCheckEnd', why, name: me.name });
      }
      if (!p.check.ready.includes(mine.mid)) p.check.ready.push(mine.mid);
      if (p.members.every((x) => p.check.ready.includes(x.mid))) {
        const trip = p.check.trip;
        p.check = null;
        p.run = { trip, at: now, host: p.leader };
        // 出發時記下隊員資料，之後在本局連線用
        for (const x of p.members) { const s = on.get(x.acc)?.[0][1]; if (s) Object.assign(x, { name: s.name, look: s.look, lv: s.lv, jl: s.jl, gs: s.gs }); }
        save(io, p, now);
        io.log?.('[ro-lobby] party run', p.pid, trip.stage, p.members.length);
        return toParty(io, p, on, { t: 'partyStart', trip });
      }
      save(io, p, now);
      return toParty(io, p, on, { t: 'partyCheck', trip: p.check.trip, ready: p.check.ready });
    }
  }
}

// 隊伍頻道：送給隊員的大廳連線與本局連線
export function partyChat(io, ws, me, text, now) {
  const p = partyOf(io, me.acc);
  if (!p) return;
  const on = byAccount(io);
  const msg = { t: 'chat', ch: 'party', name: me.name, text, id: me.id ?? 0, c: me.ch ?? 0, gm: false };
  toParty(io, p, on, msg);
  for (const [w] of runSocks(io, p.pid)) io.send(w, msg);
  safe(io, () => io.db.logChat({ acc: me.acc, name: me.name, kind: 'party', text, at: now }));
}

// 大廳連線進來／離開時：更新隊友看到的上線狀態
export function partyPresence(io, acc, now, except = null) {
  const p = partyOf(io, acc);
  if (!p) return;
  const on = byAccount(io, except);
  const anyone = p.members.some((x) => on.has(x.acc)) || runSocks(io, p.pid).some(([w]) => w !== except);
  if (!anyone) { p.seen = now; save(io, p, now); io.wake?.(now + PARTY_IDLE_MS); }
  sendParty(io, p, on);
}

// ---- 本局連線 ----
export async function runHello(io, ws, m, now) {
  const auth = m.rt ? await io.verify(m.rt, now).catch(() => null) : null;
  if (!io.get(ws)) return;
  const acc = auth?.a != null ? String(auth.a) : null;
  const p = partyOf(io, acc);
  if (!p?.run) { io.set(ws, null); return io.close(ws, RUN_CLOSE, 'no run'); }
  const mine = memberOf(p, acc);
  // 同一個帳號重連：換掉舊的本局連線
  for (const [w, st] of runSocks(io, p.pid)) if (st.acc === acc) { io.set(w, null); rates.delete(w); io.close(w, RUN_CLOSE, 'replaced'); }
  const me = { run: p.pid, mid: mine.mid, acc, name: mine.name, look: cleanLook(m.look) ?? mine.look, rl: {} };
  io.set(ws, me);
  const socks = runSocks(io, p.pid).filter(([w]) => w !== ws);
  const live = new Set(socks.map(([, st]) => st.mid));
  // 房主不在：隊長剛出發時先等它，等太久或隊長就是自己就換人
  if (p.run.host !== mine.mid && !live.has(p.run.host) && (mine.mid === p.leader || now - p.run.at > RUN_HOST_WAIT_MS)) {
    p.run.host = mine.mid;
    save(io, p, now);
    for (const [w] of socks) io.send(w, { t: 'runHost', mid: mine.mid });
  }
  const pubOf = (st) => ({ mid: st.mid, name: st.name, look: st.look });
  io.send(ws, { t: 'runWelcome', me: mine.mid, host: p.run.host, mates: socks.map(([, st]) => pubOf(st)) });
  for (const [w] of socks) io.send(w, { t: 'runJoin', m: pubOf(me) });
  sendParty(io, p);
}

const rates = new Map(); // 本局連線的轉送計數只放記憶體（每則都寫 attachment 太貴；連線活著時物件不會休眠），關閉時刪
export const runStats = { msgs: 0, bytes: 0 };
export function runMessage(io, ws, me, m, data, now) {
  const p = table(io).get(me.run);
  if (!p?.run || !memberOf(p, me.acc)) { io.set(ws, null); rates.delete(ws); return io.close(ws, RUN_CLOSE, 'no run'); }
  if (m.t === 'run') {
    let r = rates.get(ws);
    if (!r || now - r.at >= 1000) rates.set(ws, (r = { at: now, n: 0 }));
    if (++r.n > RUN_RATE) return;
    runStats.msgs++; runStats.bytes += data.length;
    const out = JSON.stringify({ t: 'run', from: me.mid, d: m.d });
    for (const [w] of runSocks(io, p.pid)) if (w !== ws) io.sendRaw ? io.sendRaw(w, out) : io.send(w, { t: 'run', from: me.mid, d: m.d });
    return;
  }
  if (m.t === 'chat' && m.ch === 'party') {
    const text = clean(m.text, 200);
    if (!text) return;
    const ok = allow(me, 'ch', now, 5, 10_000);
    io.set(ws, me);
    if (!ok) return io.send(ws, { t: 'chatErr', e: 'rate' });
    const mu = muted(io, me, now);
    if (mu) return io.send(ws, { t: 'chatErr', e: 'muted', until: mu.until });
    return partyChat(io, ws, me, text, now);
  }
}

export function runClose(io, ws, me, now) {
  rates.delete(ws);
  const p = table(io).get(me.run);
  if (!p?.run) return;
  const socks = runSocks(io, p.pid).filter(([w]) => w !== ws);
  for (const [w] of socks) io.send(w, { t: 'runLeave', mid: me.mid });
  if (!socks.length) {
    // 全部離開本局：這一趟結束，隊伍留著
    p.run = null;
    save(io, p, now);
  } else if (p.run.host === me.mid) {
    const next = socks.find(([, st]) => st.mid === p.leader) ?? socks[0];
    p.run.host = next[1].mid;
    save(io, p, now);
    for (const [w] of socks) io.send(w, { t: 'runHost', mid: p.run.host });
  }
  partyPresence(io, me.acc, now, ws);
}

// ---- 期限：邀請、出發確認、沒人在線上的隊伍 ----
export function onAlarm(io, now = Date.now()) {
  const on = byAccount(io);
  let next = Infinity;
  for (const [ws, st] of members(io)) {
    if (!st.pinv) continue;
    if (st.pinv.until > now) { next = Math.min(next, st.pinv.until); continue; }
    const from = st.pinv.from;
    delete st.pinv;
    io.set(ws, st);
    io.send(ws, { t: 'partyErr', why: 'timeout', name: '' });
    toAcc(io, on, from, { t: 'partyErr', why: 'timeout', name: st.name });
  }
  for (const p of [...table(io).values()]) {
    if (p.check) {
      if (p.check.until > now) next = Math.min(next, p.check.until);
      else { p.check = null; save(io, p, now); toParty(io, p, on, { t: 'partyCheckEnd', why: 'timeout', name: '' }); }
    }
    const anyone = p.members.some((x) => on.has(x.acc)) || runSocks(io, p.pid).length > 0;
    if (!anyone) {
      if (now - (p.seen ?? 0) >= PARTY_IDLE_MS) drop(io, p);
      else next = Math.min(next, (p.seen ?? now) + PARTY_IDLE_MS);
    }
  }
  next = Math.min(next, safe(io, () => tradeAlarm(io, now), Infinity));
  if (next < Infinity) io.wake?.(next);
}
