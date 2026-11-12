// 282 普隆德拉大廳的管理介面：看檢舉、禁言／解除禁言、把檢舉標成已處理。
// 只有 Cloudflare Worker 掛（GET /admin 是頁面，/admin/api/* 是 JSON），密鑰是 Worker 的 RO_ADMIN_KEY（至少 16 字）；
// 沒設就整個 404。密鑰只放在 Authorization 標頭，不放網址。頁面上所有玩家寫的文字都用 textContent 放，不用 innerHTML。
export const ADMIN_PATH = '/admin';
export const ADMIN_MIN_KEY = 16;

const enc = new TextEncoder();
// 長度不同也跑完整個比較，避免用回應時間猜密鑰
export function adminAuthorized(key, header) {
  if (typeof key !== 'string' || key.length < ADMIN_MIN_KEY) return false;
  const m = /^Bearer (.+)$/.exec(header ?? '');
  const a = enc.encode(key), b = enc.encode(m ? m[1] : '');
  let d = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ (b[i % (b.length || 1)] ?? 0);
  return d === 0;
}

const HOUR = 3_600_000;
const json = (status, body) => ({ status, body });
// path 是 /admin/api 之後的部分（例如 reports、mute）
export function adminApi(db, method, path, query, body, now = Date.now()) {
  const acc = typeof body?.acc === 'string' && /^\w{1,40}$/.test(body.acc) ? body.acc : null;
  if (method === 'GET' && path === 'reports') {
    const status = query.get('status') === 'done' ? 'done' : 'open';
    const mutes = new Map(db.listMutes(now).map((m) => [m.acc, m.until]));
    return json(200, { reports: db.listReports(status, 100).map((r) => ({ ...r, mutedUntil: mutes.get(r.target) ?? null })) });
  }
  if (method === 'GET' && path === 'mutes') return json(200, { mutes: db.listMutes(now) });
  if (method === 'POST' && path === 'report') {
    const id = Number(body?.id);
    const status = body?.status === 'open' ? 'open' : 'done';
    if (!Number.isInteger(id)) return json(400, { error: 'bad_id' });
    return db.setReportStatus(id, status) ? json(200, { ok: true }) : json(404, { error: 'not_found' });
  }
  if (method === 'POST' && path === 'mute') {
    const hours = Number(body?.hours);
    if (!acc || !Number.isFinite(hours) || hours <= 0 || hours > 24 * 365) return json(400, { error: 'bad_request' });
    const reason = String(body?.reason ?? '').slice(0, 100);
    const name = String(body?.name ?? '').slice(0, 32);
    db.setMute(acc, now + Math.round(hours * HOUR), reason, name, now);
    return json(200, { ok: true, until: now + Math.round(hours * HOUR) });
  }
  if (method === 'POST' && path === 'unmute') {
    if (!acc) return json(400, { error: 'bad_request' });
    return json(200, { ok: db.delMute(acc) });
  }
  return json(404, { error: 'not_found' });
}

export const ADMIN_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'content-security-policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cache-control': 'no-store',
};

export const ADMIN_HTML = `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>RO LIFE 大廳管理</title>
<style>
:root{color-scheme:light dark;--bg:#f5f6f8;--fg:#1d2330;--muted:#667;--card:#fff;--line:#dde1e8;--warn:#b42318;--ok:#18794e}
@media (prefers-color-scheme:dark){:root{--bg:#14171d;--fg:#e8eaef;--muted:#9aa3b2;--card:#1d2129;--line:#2d333d;--warn:#ff8a7a;--ok:#5fd39a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,"PingFang TC","Microsoft JhengHei",sans-serif}
main{max-width:920px;margin:0 auto;padding:16px}h1{font-size:20px;margin:0 0 12px}h2{font-size:16px;margin:20px 0 8px}
.bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}input,button,select{font:inherit;padding:6px 10px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--fg)}
button{cursor:pointer}button.warn{color:var(--warn)}.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;margin:8px 0}
.meta{color:var(--muted);font-size:13px}.lines{margin:8px 0;padding:8px;border-left:3px solid var(--line);font-size:14px;white-space:pre-wrap;word-break:break-word}
.muted{color:var(--warn);font-weight:600}.msg{min-height:1.5em;color:var(--muted)}[hidden]{display:none!important}
</style></head><body><main>
<h1>RO LIFE 大廳管理</h1>
<form id="login" class="bar"><input id="key" type="password" autocomplete="current-password" placeholder="RO_ADMIN_KEY" size="32"><button>登入</button></form>
<div id="app" hidden>
  <div class="bar"><select id="status"><option value="open">未處理</option><option value="done">已處理</option></select><button id="reload">重新整理</button><button id="logout">登出</button></div>
  <p class="msg" id="msg"></p>
  <h2>檢舉</h2><div id="reports"></div>
  <h2>禁言中</h2><div id="mutes"></div>
</div>
<script>
(() => {
  const $ = (id) => document.getElementById(id);
  const WHY = { abuse: '辱罵或騷擾', cheat: '作弊', rmt: '現金交易', spam: '洗版', other: '其他' };
  const KIND = { local: '頻道', general: '一般', trade: '交易', cn: '中文', whisper: '密語' };
  let key = '';
  try { key = sessionStorage.getItem('ro-admin-key') || ''; } catch {}
  const time = (t) => new Date(t).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' });
  const el = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };
  const btn = (text, fn, cls) => { const b = el('button', text, cls); b.type = 'button'; b.onclick = fn; return b; };
  async function api(method, path, body) {
    const r = await fetch('/admin/api/' + path, { method, headers: { authorization: 'Bearer ' + key, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    if (r.status === 401) { logout(); throw new Error('密鑰不對'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || String(r.status));
    return j;
  }
  const say = (t) => { $('msg').textContent = t; };
  function lines(title, rows, fmt) {
    const box = el('div', null, 'lines');
    box.append(el('div', title, 'meta'));
    if (!rows.length) box.append(el('div', '（沒有）', 'meta'));
    for (const r of rows) box.append(el('div', fmt(r)));
    return box;
  }
  async function mute(acc, name, hours) {
    const reason = prompt('禁言原因（可留空）', '') ?? null;
    if (reason === null) return;
    await api('POST', 'mute', { acc, name, hours, reason }); say('已禁言 ' + name); load();
  }
  async function load() {
    say('讀取中…');
    try {
      const [{ reports }, { mutes }] = await Promise.all([api('GET', 'reports?status=' + $('status').value), api('GET', 'mutes')]);
      const box = $('reports'); box.replaceChildren();
      if (!reports.length) box.append(el('p', '沒有檢舉。', 'meta'));
      for (const r of reports) {
        const c = el('div', null, 'card');
        const head = el('div');
        head.append(el('b', r.targetName), el('span', '　帳號 ' + r.target + '　原因：' + (WHY[r.why] || r.why), 'meta'));
        if (r.mutedUntil) head.append(el('span', '　禁言到 ' + time(r.mutedUntil), 'muted'));
        c.append(head, el('div', '檢舉人 ' + r.reporterName + '（帳號 ' + r.reporter + '）　' + time(r.at), 'meta'));
        c.append(lines('對方最近的公開發言', r.evidence.chat || [], (x) => time(x.at) + '［' + (KIND[x.kind] || x.kind) + '］' + x.name + '：' + x.text));
        c.append(lines('雙方之間的密語', r.evidence.whispers || [], (x) => time(x.at) + '　' + x.name + '：' + x.text));
        const acts = el('div', null, 'bar');
        acts.append(btn('禁言 1 小時', () => mute(r.target, r.targetName, 1), 'warn'), btn('禁言 1 天', () => mute(r.target, r.targetName, 24), 'warn'), btn('禁言 7 天', () => mute(r.target, r.targetName, 168), 'warn'));
        acts.append(btn(r.status === 'open' ? '標為已處理' : '改回未處理', async () => { await api('POST', 'report', { id: r.id, status: r.status === 'open' ? 'done' : 'open' }); load(); }));
        c.append(acts); box.append(c);
      }
      const mb = $('mutes'); mb.replaceChildren();
      if (!mutes.length) mb.append(el('p', '沒有人被禁言。', 'meta'));
      for (const m of mutes) {
        const c = el('div', null, 'card bar');
        c.append(el('b', m.name || m.acc), el('span', '帳號 ' + m.acc + '　到 ' + time(m.until) + (m.reason ? '　原因：' + m.reason : ''), 'meta'));
        c.append(btn('解除', async () => { await api('POST', 'unmute', { acc: m.acc }); say('已解除'); load(); }));
        mb.append(c);
      }
      say('');
    } catch (e) { say('錯誤：' + e.message); }
  }
  function logout() { key = ''; try { sessionStorage.removeItem('ro-admin-key'); } catch {} $('app').hidden = true; $('login').hidden = false; }
  function enter() { $('login').hidden = true; $('app').hidden = false; load(); }
  $('login').onsubmit = (e) => { e.preventDefault(); key = $('key').value.trim(); $('key').value = ''; try { sessionStorage.setItem('ro-admin-key', key); } catch {} enter(); };
  $('reload').onclick = load; $('status').onchange = load; $('logout').onclick = logout;
  if (key) enter();
})();
</script></main></body></html>`;
