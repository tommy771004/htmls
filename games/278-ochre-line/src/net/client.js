// 瀏覽器端連線：找伺服器、進房、心跳、斷線重連。房間裡的遊戲同步在 sync.js，大廳畫面在 ui/net.js。
// 伺服器位置：網址 ?server= → 打包時的 OL_SERVER（Cloudflare Worker）→ 在 localhost／127.0.0.1 的 npm start 上用同一個網域 → 否則沒有連線功能。
/* global __OL_SERVER__ */

export function serverBase() {
  const q = new URLSearchParams(location.search).get('server');
  if (q && /^wss?:\/\//.test(q)) return q.replace(/\/$/, '');
  if (typeof __OL_SERVER__ === 'string' && __OL_SERVER__) return __OL_SERVER__.replace(/\/$/, '');
  if (/^https?:$/.test(location.protocol) && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  return '';
}

const NAME_KEY = 'ochre-line.net.name';
export function savedName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } }
export function saveName(n) { try { localStorage.setItem(NAME_KEY, n); } catch { /* 無痕模式 */ } }
/** 每個分頁、每個房號一個重連身份（sessionStorage）：重整或換線時接回原本的席位。 */
function tokenFor(code) {
  const k = 'ochre-line.net.tok.' + code;
  try { let t = sessionStorage.getItem(k); if (!t) { t = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => (b % 36).toString(36)).join(''); sessionStorage.setItem(k, t); } return t; }
  catch { return 'tmp' + Math.random().toString(36).slice(2, 14); }
}

/** 房間狀態。UI 每幀讀，不寫。 */
export const NET = {
  status: 'off',      // off | connecting | in | retry
  code: '', id: 0, host: 0, phase: 'lobby', players: [], roster: null, n: 0, diff: 1,
  ping: 0, err: '', hostWait: 0,
  get isHost() { return this.status !== 'off' && this.id && this.id === this.host; },
};

const handlers = new Map();
/** 訂閱伺服器訊息類型（sync.js、ui/net.js 用）。 */
export function onNet(t, fn) { if (!handlers.has(t)) handlers.set(t, []); handlers.get(t).push(fn); }
const emit = (t, m) => { for (const fn of handlers.get(t) || []) fn(m); };

let ws = null, want = null, retryT = 0, pingT = 0, lastMsg = 0, tries = 0;

export function send(m) { if (ws?.readyState === 1) { ws.send(JSON.stringify(m)); return true; } return false; }

function open() {
  const base = serverBase(); if (!base || !want) return;
  const q = new URLSearchParams({ name: want.name, token: tokenFor(want.code) }); if (want.create) q.set('create', '1');
  const sock = new WebSocket(`${base}/api/ochre/room/${want.code}?${q}`);
  ws = sock; NET.status = NET.status === 'in' ? 'retry' : NET.status === 'retry' ? 'retry' : 'connecting'; emit('status', NET);
  sock.onmessage = e => {
    if (sock !== ws) return;
    lastMsg = performance.now();
    let m; try { m = JSON.parse(e.data); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    switch (m.t) {
      case 'welcome':
        want.create = false; tries = 0; NET.err = '';
        Object.assign(NET, { status: 'in', code: m.code, id: m.id, host: m.host, phase: m.phase, players: m.players, roster: m.roster, n: m.n, diff: m.diff, hostWait: 0 });
        break;
      case 'lobby': Object.assign(NET, { host: m.host, phase: m.phase, players: m.players, roster: m.roster, n: m.n, diff: m.diff }); break;
      case 'pong': NET.ping = Math.round(performance.now() - m.c); break;
      case 'hostwait': NET.hostWait = performance.now() + m.ms; break;
      case 'hostback': NET.hostWait = 0; break;
      case 'notfound': case 'taken': case 'full': case 'replaced': case 'bye':
        NET.err = m.t; stop(); break;
    }
    emit(m.t, m);
  };
  sock.onclose = () => {
    if (sock !== ws) return;
    ws = null;
    if (!want) return;
    // 意外斷線：很快重試，之後退避；房間會保留席位 30 秒（主機 20 秒）
    NET.status = 'retry'; emit('status', NET);
    retryT = setTimeout(open, Math.min(4000, 150 * 2 ** tries++));
  };
}

/** 進房（create 時伺服器會確認房號沒人用）。 */
export function join(code, name, create = false) {
  stop(); want = { code, name, create }; NET.err = ''; NET.code = code; tries = 0; lastMsg = performance.now(); open();
  clearInterval(pingT);
  pingT = setInterval(() => {
    if (!want) return;
    if (ws?.readyState === 1) send({ t: 'ping', c: performance.now() });
    // 12 秒沒有任何訊息：連線多半已經死了，換一條
    if (performance.now() - lastMsg > 12000 && ws) { const s = ws; ws = null; try { s.close(); } catch { /* 已關閉 */ } NET.status = 'retry'; lastMsg = performance.now(); open(); }
  }, 2000);
}
export function leave() { if (ws?.readyState === 1) send({ t: 'quit' }); stop(); }
function stop() {
  want = null; clearTimeout(retryT); clearInterval(pingT);
  if (ws) { const s = ws; ws = null; setTimeout(() => { try { s.close(); } catch { /* 已關閉 */ } }, 100); }
  Object.assign(NET, { status: 'off', id: 0, host: 0, phase: 'lobby', players: [], roster: null, hostWait: 0 });
  emit('status', NET);
}
export const newRoomCode = () => String(100000 + Math.floor(Math.random() * 900000));
