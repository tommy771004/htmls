// 連線：大廳一條（在線人數、配對、排行榜），進聯賽房間再開一條。找不到伺服器就安靜地退回離線模式。
// 伺服器位置：打包時的 RSA_SERVER → 網址 ?server= → 在 localhost／127.0.0.1 的 npm start 上用同一個網域 → 否則離線。
/* global __RSA_SERVER__ */

export function serverBase() {
  const q = new URLSearchParams(location.search).get('server');
  if (q) return q.replace(/\/$/, '');
  if (typeof __RSA_SERVER__ === 'string' && __RSA_SERVER__) return __RSA_SERVER__.replace(/\/$/, '');
  if (/^https?:$/.test(location.protocol) && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
    return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  }
  return '';
}

class Emitter {
  constructor() { this.h = {}; }
  on(t, f) { (this.h[t] = this.h[t] || []).push(f); return this; }
  emit(t, m) { for (const f of this.h[t] || []) f(m); for (const f of this.h['*'] || []) f(m); }
}

export class Lobby extends Emitter {
  constructor() {
    super();
    this.base = serverBase();
    this.ws = null; this.live = false; this.counts = null;
    this.wait = new Map();
    this.retry = 0;
  }
  connect() {
    if (!this.base) { this.emit('status', { live: false, reason: 'offline' }); return; }
    let ws;
    try { ws = new WebSocket(this.base + '/api/rsa'); } catch { this.emit('status', { live: false }); return; }
    this.ws = ws;
    ws.onopen = () => { this.live = true; this.retry = 0; this.emit('status', { live: true }); };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'hello' || m.t === 'count' || m.t === 'pong') { this.counts = { online: m.online, rooms: m.rooms, playing: m.playing }; this.emit('count', this.counts); }
      const w = this.wait.get(m.t);
      if (w) { this.wait.delete(m.t); w(m); }
      this.emit(m.t, m);
    };
    ws.onclose = () => {
      const was = this.live;
      this.live = false; this.ws = null;
      for (const [, w] of this.wait) w(null);
      this.wait.clear();
      this.emit('status', { live: false, lost: was });
      // 斷了就慢慢重試（最多每 30 秒）
      this.retry = Math.min(30, (this.retry || 2) * 2);
      setTimeout(() => this.connect(), this.retry * 1000);
    };
    ws.onerror = () => {};
  }
  send(m) { if (this.ws && this.ws.readyState === 1) { this.ws.send(JSON.stringify(m)); return true; } return false; }
  ask(m, reply, ms = 6000) {
    return new Promise((res) => {
      if (!this.send(m)) { res(null); return; }
      this.wait.set(reply, res);
      setTimeout(() => { if (this.wait.get(reply) === res) { this.wait.delete(reply); res(null); } }, ms);
    });
  }
  board(kind) { return this.ask({ t: 'board', kind }, 'board'); }
  submit(name, time, splits) { return this.ask({ t: 'score', name, time, splits }, 'scored'); }
  quick() { return this.ask({ t: 'quick' }, 'room'); }
}

// 聯賽房間的連線：送自己的車與球（如果球歸自己），收快照與事件
export class RoomConn extends Emitter {
  constructor(base, code, name) {
    super();
    this.code = code;
    this.ws = new WebSocket(`${base}/api/rsa/room/${code}?name=${encodeURIComponent(name || '')}`);
    this.open = false; this.closed = false;
    this.offset = null;   // 伺服器時間 − 本機時間
    this.rtt = 100;
    this.ws.onopen = () => { this.open = true; this.emit('open', {}); this.ping(); };
    this.ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 's') {
        const off = m.T - performance.now();
        this.offset = this.offset == null ? off : this.offset + (off - this.offset) * 0.05;
      }
      if (m.t === 'pong' && m.c) { this.rtt = this.rtt * 0.7 + (performance.now() - m.c) * 0.3; }
      this.emit(m.t, m);
    };
    this.ws.onclose = () => { this.open = false; this.closed = true; this.emit('close', {}); };
    this.ws.onerror = () => {};
    this.pinger = setInterval(() => this.ping(), 2000);
  }
  ping() { this.send({ t: 'ping', c: performance.now() }); }
  send(m) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  serverNow() { return performance.now() + (this.offset || 0); }
  close() { clearInterval(this.pinger); try { this.ws.close(); } catch { /* 已關閉 */ } }
}
