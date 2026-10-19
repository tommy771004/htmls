// 連線的純邏輯：大廳（在線人數、快速配對、排行榜）、房間（車球聯賽的狀態同步與裁定）、排行榜。
// 不碰網路與儲存：Cloudflare Durable Objects（worker/index.js）與本機 Node 伺服器（server/roadster/server.mjs）共用。
// 送訊息一律透過建構時注入的 send(conn, obj)；時間由呼叫端傳入（毫秒）。
import { LEAGUE, ARENA, BALL } from '../core/const.js';

export const PROTO = 1;
export const SNAP_HZ = 15;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function cleanName(v) {
  const s = typeof v === 'string' ? v.replace(/[\u0000-\u001f<>&"'`\\]/g, '').trim().slice(0, 16) : '';
  return s || '車手' + Math.floor(Math.random() * 900 + 100);
}
export const newCode = (rnd = Math.random) => { let c = ''; for (let i = 0; i < 5; i++) c += CODE_CHARS[Math.floor(rnd() * CODE_CHARS.length)]; return c; };
export const validCode = (c) => typeof c === 'string' && /^[A-Z2-9]{5}$/.test(c);
const finiteArr = (a, n) => Array.isArray(a) && a.length === n && a.every((x) => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) < 1e5);

// ISO 週：週一開始，以 UTC 計
export function weekKey(t) {
  const d = new Date(t);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const y = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const w = 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------------------------
// 排行榜：每個名字只留最佳成績。世界紀錄＝全部，本週最佳＝這個 ISO 週完成的成績
export class BoardCore {
  constructor(data = null, { min = 30, max = 600, gates = 6 } = {}) {
    this.rows = Array.isArray(data?.rows) ? data.rows.filter((r) => r && typeof r.name === 'string' && Number.isFinite(r.time)) : [];
    this.min = min; this.max = max; this.gates = gates;
  }
  toJSON() { return { rows: this.rows }; }
  // 檢查：時間範圍、分段時間遞增且最後一段就是總時間
  validate(time, splits) {
    if (!Number.isFinite(time) || time < this.min || time > this.max) return '時間不合理';
    if (!Array.isArray(splits) || splits.length !== this.gates) return '分段數不對';
    let prev = 0;
    for (const s of splits) { if (!Number.isFinite(s) || s <= prev + 0.5) return '分段時間不合理'; prev = s; }
    if (Math.abs(splits[splits.length - 1] - time) > 0.002) return '總時間對不上';
    return null;
  }
  submit(name, time, splits, now) {
    const err = this.validate(time, splits);
    if (err) return { ok: false, error: err };
    name = cleanName(name);
    const wk = weekKey(now);
    const t = Math.round(time * 1000) / 1000;
    // 世界：同名只留最快；本週：同名同週只留最快
    let improved = false;
    const all = this.rows.find((r) => r.name === name && r.kind === 'all');
    if (!all) { this.rows.push({ name, time: t, at: now, kind: 'all' }); improved = true; }
    else if (t < all.time) { all.time = t; all.at = now; improved = true; }
    const wr = this.rows.find((r) => r.name === name && r.kind === 'week' && r.wk === wk);
    if (!wr) this.rows.push({ name, time: t, at: now, kind: 'week', wk });
    else if (t < wr.time) { wr.time = t; wr.at = now; }
    // 只留每種前 200 名，過期的週紀錄丟掉
    const keep = (kind, filt) => this.rows.filter((r) => r.kind === kind && filt(r)).sort((a, b) => a.time - b.time).slice(0, 200);
    this.rows = [...keep('all', () => true), ...keep('week', (r) => r.wk === wk)];
    const rank = this.top('world', now, 1000).findIndex((r) => r.name === name) + 1;
    return { ok: true, improved, rank, time: t };
  }
  top(kind, now, n = 20) {
    const wk = weekKey(now);
    const rows = this.rows.filter((r) => (kind === 'week' ? r.kind === 'week' && r.wk === wk : r.kind === 'all'));
    return rows.sort((a, b) => a.time - b.time || a.at - b.at).slice(0, n).map((r) => ({ name: r.name, time: r.time, at: r.at }));
  }
}

// ---------------------------------------------------------------------------------------------
// 大廳：每個開著頁面的人都連一條；算在線人數、快速配對、查排行榜、上傳成績
export class LobbyCore {
  constructor({ send, board = new BoardCore(), rnd = Math.random, onBoardChange = () => {} }) {
    this.send = send; this.board = board; this.rnd = rnd; this.onBoardChange = onBoardChange;
    this.conns = new Map();   // conn → { name, lastScore }
    this.rooms = new Map();   // code → { players, at }
  }
  open(conn, now) { this.conns.set(conn, { name: '', lastScore: -Infinity }); this.send(conn, { t: 'hello', v: PROTO, ...this.counts() }); }
  close(conn) { this.conns.delete(conn); }
  counts() {
    let playing = 0;
    for (const r of this.rooms.values()) playing += r.players;
    return { online: this.conns.size, rooms: this.rooms.size, playing };
  }
  // 房間回報人數（Durable Object 之間或同一行程內）
  report(code, players, now) {
    if (players > 0) this.rooms.set(code, { players, at: now });
    else this.rooms.delete(code);
  }
  quick() {
    // 找人數最多但還沒滿的房間，沒有就開新的
    let best = null;
    for (const [code, r] of this.rooms) if (r.players < LEAGUE.MAX && (!best || r.players > best.players)) best = { code, players: r.players };
    if (best) return best.code;
    let c;
    do c = newCode(this.rnd); while (this.rooms.has(c));
    this.rooms.set(c, { players: 0, at: Date.now() });
    return c;
  }
  message(conn, msg, now) {
    const me = this.conns.get(conn);
    if (!me || !msg || typeof msg.t !== 'string') return;
    if (msg.t === 'ping') this.send(conn, { t: 'pong', c: msg.c, ...this.counts() });
    else if (msg.t === 'quick') this.send(conn, { t: 'room', code: this.quick() });
    else if (msg.t === 'board') this.send(conn, { t: 'board', kind: msg.kind === 'week' ? 'week' : 'world', rows: this.board.top(msg.kind === 'week' ? 'week' : 'world', now), wk: weekKey(now) });
    else if (msg.t === 'score') {
      if (now - me.lastScore < 8000) { this.send(conn, { t: 'scored', ok: false, error: '太頻繁了' }); return; }
      me.lastScore = now;
      const r = this.board.submit(msg.name, Number(msg.time), msg.splits, now);
      this.send(conn, { t: 'scored', ...r });
      if (r.ok) this.onBoardChange(this.board);
    }
  }
  tick(now) {
    // 每 5 秒廣播一次人數；房間回報超過 2 分鐘沒更新就當作不存在
    for (const [code, r] of this.rooms) if (now - r.at > 120000) this.rooms.delete(code);
    const c = { t: 'count', ...this.counts() };
    for (const conn of this.conns.keys()) this.send(conn, c);
  }
}

// ---------------------------------------------------------------------------------------------
// 房間：伺服器不跑物理。每個玩家回報自己的車；球由「最後碰到的人」模擬並回報，伺服器裁定誰可以接手；
// 進球由球的主人回報、伺服器檢查位置後加分。計時、開球、比賽結束都由這裡決定。
export class RoomCore {
  constructor(code, { send, report = () => {}, rnd = Math.random }) {
    this.code = code; this.send = send; this.report = report; this.rnd = rnd;
    this.players = new Map();   // id → { conn, name, team, st, at, idx }
    this.byConn = new Map();
    this.nextId = 1;
    this.phase = 'warmup'; this.phaseEnd = 0;
    this.clock = LEAGUE.CLOCK; this.score = [0, 0]; this.overtime = false;
    this.owner = 0; this.ownerAt = 0; this.ball = null; this.ballAt = 0;
    this.lastSnap = 0; this.lastTick = 0; this.emptySince = 0;
    this.seq = 0;
  }

  get size() { return this.players.size; }

  join(conn, name, now) {
    if (this.players.size >= LEAGUE.MAX) { this.send(conn, { t: 'full' }); return null; }
    const n = [0, 0];
    for (const p of this.players.values()) n[p.team]++;
    const team = n[0] <= n[1] ? 0 : 1;
    const id = this.nextId++;
    const p = { id, conn, name: cleanName(name), team, st: null, at: now, idx: 0 };
    this.players.set(id, p); this.byConn.set(conn, p);
    this.reindex();
    this.send(conn, { t: 'welcome', id, team, code: this.code, players: this.roster(), phase: this.phase, clock: this.clock, score: this.score, owner: this.owner, ball: this.ball, idx: p.idx, overtime: this.overtime, seq: this.seq });
    this.broadcast({ t: 'join', p: { id, name: p.name, team } }, conn);
    if (this.phase === 'warmup' && this.players.size >= 2) this.newMatch(now);
    this.report(this.code, this.players.size, now);
    this.emptySince = 0;
    return p;
  }

  leave(conn, now) {
    const p = this.byConn.get(conn);
    if (!p) return;
    this.byConn.delete(conn); this.players.delete(p.id);
    if (this.owner === p.id) { this.owner = 0; }
    this.broadcast({ t: 'leave', id: p.id });
    this.reindex();
    if (this.players.size < 2 && this.phase !== 'warmup') { this.phase = 'warmup'; this.broadcast(this.phaseMsg()); }
    if (!this.players.size) this.emptySince = now;
    this.report(this.code, this.players.size, now);
  }

  roster() { return [...this.players.values()].map((p) => ({ id: p.id, name: p.name, team: p.team })); }
  reindex() { const n = [0, 0]; for (const p of this.players.values()) p.idx = n[p.team]++; }
  broadcast(msg, except = null) { for (const p of this.players.values()) if (p.conn !== except) this.send(p.conn, msg); }
  phaseMsg() { return { t: 'phase', phase: this.phase, clock: this.clock, score: this.score, overtime: this.overtime, ends: Math.max(0, this.phaseEnd - this.lastTick) }; }

  newMatch(now) {
    this.score = [0, 0]; this.clock = LEAGUE.CLOCK; this.overtime = false;
    // 重新分隊：照加入順序交錯
    let i = 0;
    for (const p of this.players.values()) p.team = i++ % 2;
    this.reindex();
    this.broadcast({ t: 'teams', players: this.roster() });
    this.kickoff(now);
  }

  kickoff(now) {
    this.phase = 'kickoff'; this.phaseEnd = now + LEAGUE.KICKOFF * 1000;
    this.owner = 0; this.ball = [0, BALL.R + 0.02, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0]; this.seq++;
    const idx = {};
    for (const p of this.players.values()) idx[p.id] = p.idx;
    this.broadcast({ ...this.phaseMsg(), t: 'ko', idx, seq: this.seq, ends: LEAGUE.KICKOFF * 1000 });
  }

  message(conn, msg, now) {
    const p = this.byConn.get(conn);
    if (!p || !msg || typeof msg.t !== 'string') return;
    p.at = now;
    switch (msg.t) {
      case 'st':
        if (finiteArr(msg.s, 14)) p.st = msg.s;
        break;
      case 'ball':
        // 只收球主人的；開球倒數時不收
        if (p.id === this.owner && msg.seq === this.seq && finiteArr(msg.b, 13) && this.phase !== 'kickoff') { this.ball = msg.b; this.ballAt = now; }
        break;
      case 'claim': {
        // 碰到球的人要求接手：沒人管、或上一次換手超過 0.2 秒就給
        if (!finiteArr(msg.b, 13) || msg.seq !== this.seq || this.phase === 'kickoff' || this.phase === 'ended') break;
        if (this.owner === p.id) break;
        if (this.owner && now - this.ownerAt < 200) break;
        this.owner = p.id; this.ownerAt = now; this.ball = msg.b; this.ballAt = now;
        this.broadcast({ t: 'own', id: p.id, b: msg.b, seq: this.seq });
        break;
      }
      case 'goal': {
        if (p.id !== this.owner || msg.seq !== this.seq || (this.phase !== 'play' && this.phase !== 'warmup')) break;
        // 進球那一刻的球（一般 20 Hz 的回報可能還停在門外）
        if (finiteArr(msg.b, 13)) { this.ball = msg.b; this.ballAt = now; }
        const b = this.ball;
        if (!b) break;
        // 位置檢查：球心在門框內、越過球門線
        const team = b[2] > 0 ? 0 : 1;
        if (!(Math.abs(b[0]) < ARENA.GW + 1 && b[1] < ARENA.GH + 1 && Math.abs(b[2]) > ARENA.B + BALL.R * 0.8)) break;
        if (this.phase === 'warmup') { this.broadcast({ t: 'goal', team, by: p.name, byId: p.id, score: this.score, warmup: true }); this.kickoffWarm(now); break; }
        this.score[team]++;
        this.broadcast({ t: 'goal', team, by: p.name, byId: p.id, own: p.team !== team, score: this.score });
        this.phase = 'goal'; this.phaseEnd = now + LEAGUE.GOAL_PAUSE * 1000; this.seq++;
        this.owner = 0;
        break;
      }
      case 'ping':
        this.send(conn, { t: 'pong', c: msg.c, s: now });
        break;
    }
  }

  // 熱身（只有一個人）：進球後把球放回中場
  kickoffWarm(now) {
    this.owner = 0; this.seq++;
    this.ball = [0, BALL.R + 0.02, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0];
    this.broadcast({ t: 'reset', b: this.ball, seq: this.seq });
  }

  tick(now) {
    const dt = this.lastTick ? Math.min(0.5, (now - this.lastTick) / 1000) : 0;
    this.lastTick = now;
    // 斷線偵測：15 秒沒有任何訊息就踢掉
    for (const p of [...this.players.values()]) if (now - p.at > 15000) this.leave(p.conn, now);
    if (this.phase === 'kickoff' && now >= this.phaseEnd) { this.phase = 'play'; this.broadcast(this.phaseMsg()); }
    else if (this.phase === 'play') {
      if (!this.overtime) this.clock = Math.max(0, this.clock - dt);
      if (this.clock <= 0 && !this.overtime) {
        const b = this.ball;
        if (!b || b[1] < BALL.R + 1.5 || now - this.ballAt > 2000) {
          if (this.score[0] === this.score[1]) { this.overtime = true; this.broadcast({ t: 'overtime' }); this.broadcast(this.phaseMsg()); }
          else this.end(now);
        }
      }
    } else if (this.phase === 'goal' && now >= this.phaseEnd) {
      if ((this.clock <= 0 && this.score[0] !== this.score[1]) || this.overtime) this.end(now);
      else this.kickoff(now);
    } else if (this.phase === 'ended' && now >= this.phaseEnd) {
      if (this.players.size >= 2) this.newMatch(now);
      else { this.phase = 'warmup'; this.broadcast(this.phaseMsg()); }
    }
    // 球主人離線太久（3 秒沒回報）：收回，讓下一個碰到的人接
    if (this.owner && now - this.ballAt > 3000) { this.owner = 0; this.broadcast({ t: 'own', id: 0, b: this.ball, seq: this.seq }); }
    if (now - this.lastSnap >= 1000 / SNAP_HZ) {
      this.lastSnap = now;
      const c = [];
      for (const p of this.players.values()) if (p.st) c.push([p.id, ...p.st]);
      this.broadcast({ t: 's', T: now, c, b: this.ball, o: this.owner, k: Math.round(this.clock * 10) / 10, ph: this.phase, sq: this.seq });
    }
  }

  end(now) {
    this.phase = 'ended'; this.phaseEnd = now + LEAGUE.END_PAUSE * 1000;
    const winner = this.score[0] > this.score[1] ? 0 : 1;
    this.broadcast({ t: 'end', winner, score: this.score });
    this.broadcast(this.phaseMsg());
  }

  // 空房 30 秒後可以關
  closable(now) { return !this.players.size && this.emptySince && now - this.emptySince > 30000; }
}
