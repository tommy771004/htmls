// 連線層：WebSocket（含 Vercel 300 秒換線接手、斷線重連）與離線練習（在瀏覽器裡跑同一份權威對局）。
// 兩者對上層送出相同的訊息：welcome / lobby / start / snap / err。
import { getMap } from '../core/map.js';
import { Match } from '../core/sim.js';
import { botName } from '../core/bots.js';
import { TICK, SNAP_EVERY, MATCH } from '../core/rules.js';

const HANDOFF_MS = 200000;

export function serverURL() {
  const q = new URLSearchParams(location.search).get('server');
  if (q) return q;
  if (location.protocol === 'file:') return null;
  // 伺服器同時接受 /saltcape 與 /api/saltcape；Vercel 只有 /api/ 會進 function，所以一律用後者
  const u = new URL('/api/saltcape', location.href);
  u.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  u.search = ''; u.hash = '';
  return u.href;
}

export class NetClient {
  constructor(url, onMsg, onState) {
    this.url = url; this.onMsg = onMsg; this.onState = onState;
    this.ws = null; this.token = null; this.closed = false; this.retries = 0; this.handoffTimer = 0; this.pending = null;
    this.rtt = 80;
  }
  connect(hello) {
    this.hello = hello;
    this.open(hello);
  }
  open(hello, isHandoff = false) {
    let ws;
    try { ws = new WebSocket(this.url); } catch { this.onState('fail'); return; }
    const timer = setTimeout(() => { if (ws.readyState !== 1) { try { ws.close(); } catch { /* */ } } }, 6000);
    ws.onopen = () => { clearTimeout(timer); ws.send(JSON.stringify(hello)); };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'welcome') {
        if (isHandoff || ws !== this.ws) {
          // 新連線接手成功：換掉舊的（伺服器會關閉舊連線）
          const old = this.ws; this.ws = ws; if (old && old !== ws) { old.onclose = null; try { old.close(); } catch { /* */ } }
        }
        this.token = m.token; this.retries = 0;
        try { sessionStorage.setItem('saltcape.token', m.token); } catch { /* 無痕模式 */ }
        this.armHandoff();
        this.onState('open');
      }
      if (m.t === 'err' && m.code === 'lost' && isHandoff) {
        try { ws.close(); } catch { /* */ }
        if (this.ws && this.ws !== ws && this.ws.readyState === 1) {
          // 主動換線卻落在另一個實例：舊連線還活著，保留它並稍後再試
          this.handoffTimer = setTimeout(() => this.handoff(), 4000);
          return;
        }
        // 斷線後重連落在另一個實例：原本的對局找不回來，交給上層顯示訊息並回大廳
        this.closed = true; clearTimeout(this.handoffTimer);
        this.onMsg(m);
        return;
      }
      if (m.t === 'pong') { this.rtt = this.rtt * 0.8 + (performance.now() - m.c) * 0.2; }
      if (ws === this.ws || m.t === 'welcome') this.onMsg(m);
    };
    ws.onclose = (e) => {
      clearTimeout(timer);
      if (ws !== this.ws) return;
      if (this.closed || e.code === 4000) return;
      this.onState('drop');
      if (this.token && this.retries < 12) {
        const delay = Math.min(4000, 150 * 2 ** this.retries++);
        setTimeout(() => { if (!this.closed && this.ws === ws) this.open({ t: 'hello', mode: 'resume', token: this.token }, true); }, delay);
      } else if (!this.token) this.onState('fail');
    };
    if (!isHandoff || !this.ws) this.ws = ws;
  }
  armHandoff() {
    clearTimeout(this.handoffTimer);
    this.handoffTimer = setTimeout(() => this.handoff(), HANDOFF_MS);
  }
  handoff() { if (!this.closed && this.token) this.open({ t: 'hello', mode: 'resume', token: this.token }, true); }
  send(m) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(m)); }
  ping() { this.send({ t: 'ping', c: performance.now() }); }
  close() { this.closed = true; clearTimeout(this.handoffTimer); try { this.send({ t: 'leave' }); this.ws?.close(); } catch { /* */ } }
}

// 離線練習：同一份 Match，在頁面裡以 30 Hz 推進
export class LocalClient {
  constructor(onMsg, onState) {
    this.onMsg = onMsg; this.onState = onState; this.rtt = 0; this.timer = 0; this.match = null;
  }
  connect(hello) {
    const name = hello.name || '旅人';
    this.me = 1;
    const room = { code: 'SOLO', kind: 'solo', state: 'lobby', host: 1, inst: 'local', target: MATCH.target, ends: 2500, players: [{ id: 1, n: name, c: 1 }], live: null };
    setTimeout(() => { this.onMsg({ t: 'welcome', id: 1, token: 'local', inst: 'local', room }); this.onState('open'); }, 0);
    this.startT = setTimeout(() => this.start(name), 2500);
  }
  start(name) {
    const roster = [{ id: 1, name, bot: false }];
    for (let i = 0; roster.length < MATCH.target; i++) roster.push({ id: 1000 + i, name: botName(i), bot: true });
    this.match = new Match({ W: getMap(), seed: (Math.random() * 2 ** 32) >>> 0, roster });
    this.onMsg({ t: 'start', ...this.match.startPacket(1) });
    let last = performance.now(), acc = 0;
    this.timer = setInterval(() => {
      const now = performance.now(); acc += now - last; last = now;
      let n = 0;
      while (acc >= 1000 / TICK && n < 4) {
        acc -= 1000 / TICK; n++;
        const M = this.match;
        if (this.ended) break;
        M.step();
        if (M.tick % SNAP_EVERY === 0 || M.over) this.onMsg(M.snapshotFor(1));
        if (M.over && !this.ended) { this.ended = true; this.onMsg({ t: 'lobby', room: { code: 'SOLO', kind: 'solo', state: 'ended', host: 1, players: [{ id: 1, n: name, c: 1 }], ends: 0 } }); }
      }
      if (acc > 300) acc = 0;
    }, 1000 / TICK);
  }
  send(m) {
    if (m.t === 'in' && this.match) this.match.queueInput(1, m.l);
    else if (m.t === 'spec' && this.match) { const p = this.match.byId.get(1); if (p) p.watch = m.i | 0; }
    else if (m.t === 'start' && !this.match) { clearTimeout(this.startT); this.start(this.nameCache || '旅人'); }
  }
  ping() {}
  close() { clearInterval(this.timer); clearTimeout(this.startT); this.match = null; }
}
