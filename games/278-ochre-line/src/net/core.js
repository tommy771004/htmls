// 赭線多人連線的房間邏輯：房號、名單、選邊、開賽名單（Bot 補位）、斷線保留、主機轉送。
// 不碰網路與儲存：本機 Node 伺服器（server/ochre/server.mjs）與 Cloudflare Durable Object（worker/index.js）共用。
// 伺服器不跑遊戲：開房者的瀏覽器是主機，跑完整對局（Bot、回合、傷害）；其他人送自己的狀態與射擊給主機，主機廣播快照與事件。
// send(conn, obj) 由建構時注入；時間由呼叫端傳入（毫秒）。

export const PROTO = 1;
export const SIDE_MAX = 5;
export const GRACE_MS = 30000;        // 玩家斷線保留席位的時間，過了由 Bot 接手
export const HOST_GRACE_MS = 20000;   // 主機斷線等待重連的時間，過了比賽結束
const IDLE_MS = 15000;                // 這麼久沒有任何訊息就當成斷線
const EMPTY_MS = 60000;               // 空房關閉

export const validCode = c => typeof c === 'string' && /^\d{6}$/.test(c);
export const newCode = (rnd = Math.random) => String(100000 + Math.floor(rnd() * 900000));
export function cleanName(v) {
  const s = typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>&"'`\\]/g, '').trim().slice(0, 12) : '';
  return s || '隊員' + Math.floor(Math.random() * 900 + 100);
}
const cleanToken = v => typeof v === 'string' && /^[A-Za-z0-9_-]{8,40}$/.test(v) ? v : null;

// 非主機送給主機的訊息類型（伺服器只轉送、不解讀）；主機送給大家的類型
const TO_HOST = new Set(['st', 'shot', 'hit', 'buy', 'nade', 'plant', 'defuse', 'drop', 'sw']);
const FROM_HOST = new Set(['s', 'ev']);

export class RoomCore {
  constructor(code, { send, log = () => {} } = {}) {
    this.code = code; this.send = send; this.log = log;
    this.players = [];        // { id, name, token, side, conn, online, offAt, seen, joinAt }
    this.nextId = 1;
    this.hostId = 0;
    this.phase = 'lobby';     // lobby | match
    this.roster = null;       // 比賽中：10 個席位 { team, pid, name }，pid 0 是 Bot
    this.matchN = 0;          // 第幾場，客戶端用來丟掉上一場的訊息
    this.diff = 1;
    this.emptyAt = 0;
    this.hostOffAt = 0;
  }
  get size() { let n = 0; for (const p of this.players) if (p.online) n++; return n; }
  get host() { return this.players.find(p => p.id === this.hostId) || null; }
  byConn(conn) { return this.players.find(p => p.conn === conn) || null; }
  view() { return this.players.map(p => ({ id: p.id, name: p.name, side: p.side, online: p.online })); }
  out(p, msg) { if (p?.online && p.conn) this.send(p.conn, msg); }
  all(msg, except = null) { for (const p of this.players) if (p !== except) this.out(p, msg); }
  count(side) { let n = 0; for (const p of this.players) if (p.side === side) n++; return n; }
  lobby() { this.all({ t: 'lobby', players: this.view(), host: this.hostId, phase: this.phase, roster: this.roster, diff: this.diff, n: this.matchN }); }

  /** 新連線。token 對得上就接回原本的席位（換線、重整、斷線重連）。 */
  join(conn, { name, token, create = false } = {}, now) {
    token = cleanToken(token);
    let p = token ? this.players.find(q => q.token === token) : null;
    // 建房撞到有人的房號、加入不存在的房號：都直接回絕，客戶端換號或提示
    if (!p && create && this.players.length) { this.send(conn, { t: 'taken' }); return null; }
    if (!p && !create && !this.players.length) { this.send(conn, { t: 'notfound' }); return null; }
    if (p) {
      if (p.conn && p.conn !== conn && p.online) this.send(p.conn, { t: 'replaced' });
      p.conn = conn; p.online = true; p.offAt = 0; p.seen = now; if (name) p.name = cleanName(name);
    } else {
      if (this.players.filter(q => q.online).length >= SIDE_MAX * 2) { this.send(conn, { t: 'full' }); return null; }
      p = { id: this.nextId++, name: cleanName(name), token: token || null, side: null, conn, online: true, offAt: 0, seen: now, joinAt: now };
      this.players.push(p);
    }
    this.emptyAt = 0;
    if (!this.host) this.hostId = p.id;
    if (p.id === this.hostId) this.hostOffAt = 0;
    this.send(conn, { t: 'welcome', v: PROTO, id: p.id, code: this.code, host: this.hostId, phase: this.phase, players: this.view(), roster: this.roster, diff: this.diff, n: this.matchN });
    this.lobby();
    // 比賽中重連：席位還在就告訴主機接回，主機會送完整狀態
    if (this.phase === 'match' && p.id !== this.hostId) {
      const slot = this.roster.findIndex(r => r.pid === p.id);
      if (slot >= 0) this.out(this.host, { t: 'claim', pid: p.id, slot, name: p.name });
    } else if (this.phase === 'match' && p.id === this.hostId) this.all({ t: 'hostback' }, p);
    this.log(`${this.code} ${p.name} 加入（${this.size} 人）`);
    return p;
  }

  leave(conn, now) {
    const p = this.byConn(conn); if (!p) return;
    p.online = false; p.conn = null; p.offAt = now;
    if (p.id === this.hostId) {
      if (this.phase === 'match') { this.hostOffAt = now; this.all({ t: 'hostwait', ms: HOST_GRACE_MS }); }
      else this.passHost();
    } else if (this.phase === 'match' && this.roster.some(r => r.pid === p.id)) this.out(this.host, { t: 'gone', pid: p.id });
    if (!this.size) this.emptyAt = now;
    this.lobby();
  }

  /** 主動離房：席位立刻交給 Bot。 */
  quit(p) {
    const slot = this.roster ? this.roster.findIndex(r => r.pid === p.id) : -1;
    this.players.splice(this.players.indexOf(p), 1);
    if (slot >= 0) { this.roster[slot].pid = 0; this.out(this.host, { t: 'bot', slot }); }
    if (p.id === this.hostId) { if (this.phase === 'match') this.endMatch('hostleft'); this.passHost(); }
    this.lobby();
  }

  passHost() {
    const next = this.players.filter(q => q.online).sort((a, b) => a.joinAt - b.joinAt)[0];
    this.hostId = next ? next.id : 0;
  }

  endMatch(why) {
    this.phase = 'lobby'; this.roster = null; this.hostOffAt = 0;
    this.all({ t: 'ended', why });
  }

  /** 開賽名單：每邊先放選了這邊的真人（依加入順序），不足 5 人用 Bot 補。沒選邊的人自動放到人少的一邊。 */
  buildRoster() {
    const want = { atk: [], def: [] };
    const sorted = this.players.filter(p => p.online).sort((a, b) => a.joinAt - b.joinAt);
    for (const p of sorted) if (p.side === 'atk' || p.side === 'def') want[p.side].push(p);
    for (const p of sorted) if (p.side !== 'atk' && p.side !== 'def') { const s = want.atk.length <= want.def.length ? 'atk' : 'def'; if (want[s].length < SIDE_MAX) { p.side = s; want[s].push(p); } }
    const roster = [];
    for (const [team, side] of [[0, 'atk'], [1, 'def']]) for (let i = 0; i < SIDE_MAX; i++) { const p = want[side][i]; roster.push({ team, pid: p ? p.id : 0, name: p ? p.name : '' }); }
    return roster;
  }

  message(conn, m, now) {
    const p = this.byConn(conn); if (!p || !m || typeof m.t !== 'string') return;
    p.seen = now;
    const isHost = p.id === this.hostId;
    switch (m.t) {
      case 'ping': this.send(conn, { t: 'pong', c: m.c, s: now }); return;
      case 'name': p.name = cleanName(m.name); this.lobby(); return;
      case 'side': {
        const s = m.side === 'atk' || m.side === 'def' ? m.side : null;
        if (this.phase === 'lobby') {
          if (s && p.side !== s && this.count(s) >= SIDE_MAX) { this.send(conn, { t: 'err', why: 'sidefull' }); return; }
          p.side = s; this.lobby(); return;
        }
        // 比賽中：還沒有席位的人（新加入、斷線太久被 Bot 接手）挑一個那一邊的 Bot 席位
        if (!s || this.roster.some(r => r.pid === p.id)) return;
        const team = s === 'atk' ? 0 : 1;
        const slot = this.roster.findIndex(r => r.pid === 0 && r.team === team);
        if (slot < 0) { this.send(conn, { t: 'err', why: 'sidefull' }); return; }
        p.side = s; this.roster[slot] = { team, pid: p.id, name: p.name };
        this.out(this.host, { t: 'claim', pid: p.id, slot, name: p.name });
        this.lobby(); return;
      }
      case 'diff': if (isHost && this.phase === 'lobby' && [0, 1, 2].includes(m.diff)) { this.diff = m.diff; this.lobby(); } return;
      case 'start':
        if (!isHost || this.phase !== 'lobby') return;
        this.phase = 'match'; this.roster = this.buildRoster(); this.matchN++;
        this.all({ t: 'start', roster: this.roster, n: this.matchN, diff: this.diff, host: this.hostId });
        this.lobby(); return;
      case 'over': if (isHost && this.phase === 'match') this.endMatch('over'); return;   // 主機宣告比賽結束
      case 'quit': this.quit(p); this.send(conn, { t: 'bye' }); return;
      // 回合中的同步：伺服器只轉送
      case 'to': if (isHost && this.phase === 'match') { const q = this.players.find(x => x.id === m.pid); if (q && m.m && typeof m.m.t === 'string') this.out(q, m.m); } return;
      default:
        if (this.phase !== 'match') return;
        if (isHost && FROM_HOST.has(m.t)) { this.all(m, p); return; }
        if (!isHost && TO_HOST.has(m.t) && this.roster.some(r => r.pid === p.id)) { m.from = p.id; this.out(this.host, m); }
    }
  }

  tick(now) {
    for (const p of [...this.players]) {
      if (p.online && now - p.seen > IDLE_MS) { const c = p.conn; this.leave(c, now); if (c) this.send(c, { t: 'idle' }); }
      // 斷線太久：放掉席位交給 Bot，名單上的人也移除（之後回來算新加入）
      if (!p.online && p.offAt && now - p.offAt > GRACE_MS && p.id !== this.hostId) this.quit(p);
    }
    if (this.phase === 'match' && this.hostOffAt && now - this.hostOffAt > HOST_GRACE_MS) {
      const h = this.host; this.endMatch('hostgone'); if (h) this.players.splice(this.players.indexOf(h), 1); this.passHost(); this.lobby();
    }
  }
  closable(now) { return !this.size && this.emptyAt && now - this.emptyAt > EMPTY_MS; }
}
