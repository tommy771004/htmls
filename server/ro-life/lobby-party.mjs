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
//
// 獎勵裁決（收據格式與擲骰在 coop.mjs；io.sign 有設才發收據）：
//   行程收據：partyStart{trip, rc} 多帶 rc，頁面拿去換關卡憑證，伺服器就知道這張憑證是幾人隊。
//   伺服器擲骰：房主的頁面 hello 帶 sr:1 時，這一趟的稀有掉落由大廳擲骰（runWelcome／runHost 帶 roll:1 告訴頁面）。
//     房主送 roll{id, kind, ref, quality, secs} 開骰（照常轉給隊員），所有人（含房主）送 rollPick{id, c}，大廳不轉送、自己記；
//     全員選完或到期就擲骰，送 rolled{id, r, win}（給支援的頁面 from:0，其他的 from:房主）。房主送的 rolled 一律丟掉。
//     房主送 rollEnd＝本局要結束了，還沒擲的現在擲。房主是舊頁面時照舊由房主擲，大廳只記下它宣布的結果。
//   結算收據：房主送 over 時發給每個人，或頁面送 {t:'runEnd'} 來要：runReceipt{rc}。內容是這個人的連線秒數、
//     房主宣布打倒過的怪物種類（從 mobs 封包的出生與死亡名單記）、擲骰拿到的東西、通關與否。頁面在結算存檔時帶上。
import { members, byAccount, safe, clean, int, allow, cleanLook, muted } from './lobby-core.mjs';
import { tradeAlarm } from './lobby-trade.mjs';
import { signReceipt, rollDice } from './coop.mjs';

export const PARTY_MAX = 3; // 同引擎 $0
export const INVITE_MS = 30_000;
export const CHECK_MS = 30_000;
export const PARTY_IDLE_MS = 10 * 60_000; // 所有隊員都不在線上這麼久就解散
export const RUN_HOST_WAIT_MS = 15_000; // 隊長還沒連進本局時，先等這麼久再讓別人當房主
export const RUN_RATE = 60; // 本局連線每秒最多轉送幾則（實測房主約 20 則）
export const RUN_MAX_MESSAGE = 65536; // 本局連線單則上限：房主的 mobs 封包新怪物最多 200 隻，但位置更新沒有上限，大波怪會超過大廳的 16 KB
export const RUN_CLOSE = 4000; // 引擎的本局連線（t3）只有這個代碼不會自動重連
const TOKEN = /^[a-z0-9_]{1,32}$/;
const ROLL_SECS = 20; // 同引擎 Pr
const ROLL_GRACE_MS = 1500; // 等最後一個選擇送到
const ROLL_MAX = 40; // 同時開著的骰
const WON_MAX = 400, KILLED_MAX = 200, MOBS_MAX = 6000;
// 本局只剩一個人時，他的掉落不經過擲骰（引擎 lootRoll 直接給），掉落帳就不完整。
// 隊友來過之後落單 3 秒就算；出發後隊友一直沒進來（還在載入）等 20 秒，這段時間引擎也還在等人、不會掉東西
const LONE_MS = 3_000, LONE_START_MS = 20_000;
const ROLL_KIND = new Set(['loot', 'card', 'egg']);
const PICKS = new Set(['need', 'greed', 'pass']);
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
    for (const [w, st] of runSocks(io, p.pid)) if (st.acc === acc) { stopClock(p, st.mid, now); io.set(w, null); rates.delete(w); io.close(w, RUN_CLOSE, 'left party'); }
    const rest = runSocks(io, p.pid);
    for (const [w] of rest) io.send(w, { t: 'runLeave', mid: m.mid });
    if (p.run.host === m.mid && rest.length) moveHost(io, p, rest, (rest.find(([, st]) => memberOf(p, st.acc)?.mid === p.leader && p.leader !== m.mid) ?? rest[0])[1], now);
    if (!rest.length) endRun(io, p);
    else noteLone(io, p, now);
  }
  if (why) toAcc(io, on, acc, { t: 'partyErr', why, name: '' });
  if (p.check) { p.check = null; toParty(io, p, on, { t: 'partyCheckEnd', why: 'gone', name: m.name }); }
  if (p.members.length < 2) {
    for (const x of p.members) toAcc(io, on, x.acc, { t: 'party', p: null });
    for (const [ws] of runSocks(io, p.pid)) { io.set(ws, null); rates.delete(ws); io.close(ws, RUN_CLOSE, 'party over'); }
    io.runMobs?.delete(p.pid);
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
        p.run = newRun(trip, p.leader, p.members.length, now);
        // 出發時記下隊員資料，之後在本局連線用
        for (const x of p.members) { const s = on.get(x.acc)?.[0][1]; if (s) Object.assign(x, { name: s.name, look: s.look, lv: s.lv, jl: s.jl, gs: s.gs }); }
        save(io, p, now);
        io.log?.('[ro-lobby] party run', p.pid, trip.stage, p.members.length);
        if (!io.sign) return toParty(io, p, on, { t: 'partyStart', trip });
        // 行程收據：每個隊員一張（帳號、這一趟的編號、關卡、人數），頁面拿去換關卡憑證
        const run = p.run;
        return Promise.all(p.members.map((x) => signReceipt(io.sign, 'trip', { a: x.acc, tid: run.tid, stage: trip.stage, n: run.n, at: now }).catch(() => null).then((rc) => [x.acc, rc])))
          .then((rcs) => { const live = byAccount(io); for (const [acc, rc] of rcs) toAcc(io, live, acc, { t: 'partyStart', trip, ...(rc ? { rc } : {}) }); });
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
  // io.requireSr（Worker 變數 LOBBY_REQUIRE_SR=1）：不支援伺服器擲骰的舊頁面不能進本局。沒開的話，房主用舊頁面時掉落帳不完整、伺服器不核對掉落
  if (io.requireSr && m.sr !== 1) { io.set(ws, null); return io.close(ws, RUN_CLOSE, 'old page'); }
  // 同一個帳號重連：換掉舊的本局連線
  fillRun(p.run, now);
  for (const [w, st] of runSocks(io, p.pid)) if (st.acc === acc) { stopClock(p, st.mid, now); io.set(w, null); rates.delete(w); io.close(w, RUN_CLOSE, 'replaced'); }
  // sr:1＝這一頁支援伺服器擲骰（它當房主時不自己擲）
  const me = { run: p.pid, mid: mine.mid, acc, name: mine.name, look: cleanLook(m.look) ?? mine.look, rl: {}, ...(m.sr === 1 ? { sr: 1 } : {}) };
  io.set(ws, me);
  p.run.since[mine.mid] = now;
  const socks = runSocks(io, p.pid).filter(([w]) => w !== ws);
  const live = new Set(socks.map(([, st]) => st.mid));
  // 房主不在：隊長剛出發時先等它，等太久或隊長就是自己就換人
  if (p.run.host !== mine.mid && !live.has(p.run.host) && (mine.mid === p.leader || now - p.run.at > RUN_HOST_WAIT_MS)) moveHost(io, p, socks, me, now);
  // 房主（重新）連進來：這一趟由誰擲骰照它的頁面決定，有變就告訴其他人
  else if (p.run.host === mine.mid && setSr(io, p, !!me.sr, now)) for (const [w] of socks) io.send(w, { t: 'runHost', mid: p.run.host, roll: p.run.sr ? 1 : 0 });
  noteLone(io, p, now);
  save(io, p, now);
  const pubOf = (st) => ({ mid: st.mid, name: st.name, look: st.look });
  io.send(ws, { t: 'runWelcome', me: mine.mid, host: p.run.host, mates: socks.map(([, st]) => pubOf(st)), roll: p.run.sr ? 1 : 0, ...(io.sign ? { rc: 1 } : {}) });
  for (const [w] of socks) io.send(w, { t: 'runJoin', m: pubOf(me) });
  sendParty(io, p);
}

// ---- 獎勵裁決：這一趟的紀錄（存在隊伍那一列的 run 裡）、擲骰、收據 ----
const hex = (n) => { const b = new Uint8Array(n); crypto.getRandomValues(b); return [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); };
function d100() { const b = new Uint32Array(1); do crypto.getRandomValues(b); while (b[0] >= 4294967200); return 1 + (b[0] % 100); }
const newRun = (trip, host, n, now) => fillRun({ trip, at: now, host, tid: hex(8), n }, now);
// 部署前就出發的隊伍沒有這些欄位：補上（沒有 tid 就不發收據）
function fillRun(run, now) {
  run.rolls ??= {}; run.won ??= {}; run.killed ??= []; run.secs ??= {}; run.since ??= {}; run.lone ??= {}; run.rollN ??= 0; run.end ??= null;
  return run;
}
function endRun(io, p) { p.run = null; io.runMobs?.delete(p.pid); }
function stopClock(p, mid, now) {
  const t = p.run?.since?.[mid];
  if (!t) return;
  p.run.secs[mid] = (p.run.secs[mid] ?? 0) + Math.max(0, now - t) / 1000;
  delete p.run.since[mid];
}
// 由誰擲骰跟著房主的頁面：回 true＝有變。改回房主擲（新房主是舊頁面）時，大廳手上還沒擲的先擲掉，之後的掉落帳就不算完整
function setSr(io, p, v, now) {
  if (p.run.sr === v) return false;
  if (p.run.sr && !v) resolveAll(io, p, now);
  p.run.sr = v;
  if (!v) p.run.gap = true;
  return true;
}
function moveHost(io, p, socks, st, now) {
  p.run.host = st.mid;
  setSr(io, p, !!st.sr, now);
  save(io, p, now);
  for (const [w] of socks) io.send(w, { t: 'runHost', mid: st.mid, roll: p.run.sr ? 1 : 0 });
}
// 本局只剩一個人超過 LONE_MS：記下來（except＝正在關閉、還沒從名單拿掉的連線）
function noteLone(io, p, now, except = null) {
  const run = p.run, mids = runSocks(io, p.pid).filter(([w]) => w !== except).map(([, st]) => st.mid);
  if (run.one && now - run.one.at > (run.met ? LONE_MS : LONE_START_MS)) run.lone[run.one.mid] = true;
  if (mids.length > 1) run.met = true;
  run.one = mids.length === 1 ? (run.one?.mid === mids[0] ? run.one : { mid: mids[0], at: now }) : null;
}
const wonBy = (run, mid) => (run.won[mid] ??= []);
function openRoll(io, p, d, now) {
  const run = p.run;
  if (!Number.isInteger(d.id) || d.id < 1 || !ROLL_KIND.has(d.kind) || !Number.isFinite(d.ref) || Object.keys(run.rolls).length >= ROLL_MAX) return false;
  const secs = Math.min(ROLL_SECS, Math.max(1, Number(d.secs) || ROLL_SECS));
  run.rolls[d.id] = { kind: d.kind, ref: d.ref, q: Number.isFinite(d.quality) ? d.quality : 0, who: runSocks(io, p.pid).map(([, st]) => st.mid), picks: {}, until: now + secs * 1000 + ROLL_GRACE_MS };
  run.rollN++;
  save(io, p, now);
  if (run.sr) io.wake?.(run.rolls[d.id].until);
  return true;
}
function pickRoll(io, p, mid, d, now) {
  const r = p.run.rolls[d?.id];
  if (!r || !r.who.includes(mid) || r.picks[mid] || !PICKS.has(d.c)) return;
  r.picks[mid] = d.c;
  checkRolls(io, p, now);
}
// 在場的人都選了就擲（不在場的當放棄）
function checkRolls(io, p, now, except = null) {
  if (!p.run?.sr) return;
  const here = new Set(runSocks(io, p.pid).filter(([w]) => w !== except).map(([, st]) => st.mid));
  for (const [id, r] of Object.entries(p.run.rolls)) if (r.who.every((mid) => r.picks[mid] || !here.has(mid))) resolveRoll(io, p, id, now);
}
function resolveRoll(io, p, id, now) {
  const run = p.run, r = run.rolls[id];
  if (!r) return;
  delete run.rolls[id];
  const out = rollDice(r.who, r.picks, d100);
  if (out.win && wonBy(run, out.win).length < WON_MAX) wonBy(run, out.win).push([r.kind, r.ref, r.q]);
  save(io, p, now);
  const d = { k: 'rolled', id: Number(id), r: out.r, win: out.win };
  // 支援的頁面收 from:0（引擎只認房主或 0 送的結果）；舊頁面的隊員照舊當成房主送的
  for (const [w, st] of runSocks(io, p.pid)) io.send(w, { t: 'run', from: st.sr ? 0 : run.host, d });
}
function resolveAll(io, p, now) {
  if (p.run?.sr) for (const id of Object.keys(p.run.rolls)) resolveRoll(io, p, id, now);
}
// 房主自己擲的（舊頁面）：只能照它宣布的記
function noteRolled(io, p, d, now) {
  const run = p.run, r = run.rolls[d.id];
  if (!r) return;
  delete run.rolls[d.id];
  if (Number.isInteger(d.win) && d.win > 0 && r.who.includes(d.win) && wonBy(run, d.win).length < WON_MAX) wonBy(run, d.win).push([r.kind, r.ref, r.q]);
  save(io, p, now);
}
// 房主的 mobs 封包（引擎 sendMobs／applyMobs）：n 是新出生的 [nid, 種類, …]，d 是被打倒的 nid，g 是消失的 nid。
// 記下每一種被打倒過的怪（結算收據用，伺服器拿來核對 MVP）。nid 對照只放記憶體，物件被回收的話之前出生的怪就認不得
function trackMobs(io, p, d, now) {
  const all = (io.runMobs ??= new Map());
  let mobs = all.get(p.pid);
  if (!mobs) all.set(p.pid, (mobs = new Map()));
  for (const row of Array.isArray(d.n) ? d.n : []) if (Array.isArray(row) && Number.isInteger(row[0]) && typeof row[1] === 'string' && TOKEN.test(row[1]) && mobs.size < MOBS_MAX) mobs.set(row[0], row[1]);
  let fresh = false;
  for (const nid of Array.isArray(d.d) ? d.d : []) {
    const def = mobs.get(nid);
    mobs.delete(nid);
    if (def && !p.run.killed.includes(def) && p.run.killed.length < KILLED_MAX) { p.run.killed.push(def); fresh = true; }
  }
  for (const nid of Array.isArray(d.g) ? d.g : []) mobs.delete(nid);
  if (fresh) save(io, p, now);
}
async function sendReceipt(io, p, ws, st, now) {
  const run = p.run;
  if (!io.sign || !run?.tid) return;
  noteLone(io, p, now);
  const mid = st.mid;
  const secs = Math.round((run.secs[mid] ?? 0) + (run.since[mid] ? Math.max(0, now - run.since[mid]) / 1000 : 0));
  const payload = { a: st.acc, tid: run.tid, stage: run.trip.stage, n: run.n, secs, end: run.end, host: run.host === mid, killed: run.killed, won: run.won[mid] ?? [], full: run.sr === true && !run.gap && !run.lone[mid], rolls: run.rollN, at: now };
  const rc = await signReceipt(io.sign, 'tripend', payload).catch((e) => { io.log?.('[ro-lobby] receipt', e?.message ?? e); return null; });
  if (rc && io.get(ws)) io.send(ws, { t: 'runReceipt', rc });
}

const rates = new Map(); // 本局連線的轉送計數只放記憶體（每則都寫 attachment 太貴；連線活著時物件不會休眠），關閉時刪
export const runStats = { msgs: 0, bytes: 0, cleaned: 0 };
export function runMessage(io, ws, me, m, data, now) {
  const p = table(io).get(me.run);
  if (!p?.run || !memberOf(p, me.acc)) { io.set(ws, null); rates.delete(ws); return io.close(ws, RUN_CLOSE, 'no run'); }
  if (m.t === 'run') {
    let r = rates.get(ws);
    if (!r || now - r.at >= 1000) rates.set(ws, (r = { at: now, n: 0 }));
    if (++r.n > RUN_RATE) return;
    runStats.msgs++; runStats.bytes += data.length;
    // 跟獎勵有關的封包先看一眼（見檔頭）
    const d = m.d, k = d && typeof d === 'object' ? d.k : null, host = me.mid === p.run.host;
    fillRun(p.run, now);
    let ended = false;
    if (k === 'rolled') { if (p.run.sr || !host) return; noteRolled(io, p, d, now); }
    else if (k === 'roll') { if (!host || !openRoll(io, p, d, now)) return; }
    else if (k === 'rollPick') { if (p.run.sr) return pickRoll(io, p, me.mid, d, now); }
    else if (k === 'rollEnd') { if (p.run.sr && host) resolveAll(io, p, now); return; }
    else if (host && k === 'mobs') trackMobs(io, p, d, now);
    else if (host && k === 'over') { resolveAll(io, p, now); p.run.end = d.win === true ? 'win' : 'lose'; save(io, p, now); ended = true; }
    let out = JSON.stringify({ t: 'run', from: me.mid, d: m.d });
    // 本局封包是數字與代號，隊友的頁面會照內容畫介面：不讓 < 原樣過去（換成 ‹，封包照送），擋掉夾帶標籤
    const dirty = out.includes('<');
    if (dirty) { out = out.replace(/</g, '‹'); runStats.cleaned++; }
    for (const [w] of runSocks(io, p.pid)) if (w !== ws) io.sendRaw ? io.sendRaw(w, out) : io.send(w, dirty ? JSON.parse(out) : { t: 'run', from: me.mid, d: m.d });
    // 房主宣布結束：每個人一張結算收據
    if (ended) return Promise.all(runSocks(io, p.pid).map(([w, st]) => sendReceipt(io, p, w, st, now))).then(() => {});
    return;
  }
  if (m.t === 'runEnd') {
    const ok = allow(me, 're', now, 6, 10_000);
    io.set(ws, me);
    return ok ? sendReceipt(io, p, ws, me, now) : undefined;
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
  fillRun(p.run, now);
  stopClock(p, me.mid, now);
  for (const [w] of socks) io.send(w, { t: 'runLeave', mid: me.mid });
  if (!socks.length) {
    // 全部離開本局：這一趟結束，隊伍留著
    endRun(io, p);
    save(io, p, now);
  } else {
    if (p.run.host === me.mid) moveHost(io, p, socks, (socks.find(([, st]) => st.mid === p.leader) ?? socks[0])[1], now);
    noteLone(io, p, now, ws);
    checkRolls(io, p, now, ws); // 等的人走了：剩下的人都選了就擲
    save(io, p, now);
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
    if (p.run?.sr) for (const [id, r] of Object.entries(p.run.rolls ?? {})) { if (r.until > now) next = Math.min(next, r.until); else resolveRoll(io, p, id, now); }
    const anyone = p.members.some((x) => on.has(x.acc)) || runSocks(io, p.pid).length > 0;
    if (!anyone) {
      if (now - (p.seen ?? 0) >= PARTY_IDLE_MS) drop(io, p);
      else next = Math.min(next, (p.seen ?? now) + PARTY_IDLE_MS);
    }
  }
  next = Math.min(next, safe(io, () => tradeAlarm(io, now), Infinity));
  if (next < Infinity) io.wake?.(next);
}
