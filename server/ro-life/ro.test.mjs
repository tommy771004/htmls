// 282 帳號／雲端存檔 API 測試：Google 與 LINE 的端點用假的 fetch 代替，資料用記憶體（不連 Neon）。
// npm run test:ro
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRoLife, projectDoc } from './server.mjs';
import { RoStore } from './store.mjs';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (p) => `${b64({ alg: 'RS256' })}.${b64(p)}.sig`;

function fakeProviders(env, calls) {
  return async (url, init) => {
    const body = Object.fromEntries(new URLSearchParams(String(init.body)));
    calls.push({ url, body });
    if (url === 'https://oauth2.googleapis.com/token') {
      if (body.code !== 'g-code' || body.client_secret !== env.GOOGLE_CLIENT_SECRET || !body.code_verifier) return Response.json({ error: 'invalid_grant' }, { status: 400 });
      return Response.json({ id_token: jwt({ iss: 'https://accounts.google.com', aud: env.GOOGLE_CLIENT_ID, exp: Date.now() / 1000 + 600, sub: 'google-sub-1', name: '阿光', nonce: calls.nonce }) });
    }
    if (url === 'https://api.line.me/oauth2/v2.1/token') return Response.json({ id_token: 'line-id-token' });
    if (url === 'https://api.line.me/oauth2/v2.1/verify') {
      if (body.id_token !== 'line-id-token' || body.client_id !== env.LINE_CHANNEL_ID || body.nonce !== calls.nonce) return Response.json({ error: 'invalid' }, { status: 400 });
      return Response.json({ sub: 'U-line-1', name: 'LINE 玩家' });
    }
    throw Error('unexpected ' + url);
  };
}

async function boot(env) {
  const calls = [];
  const app = createRoLife({ env, fetchImpl: fakeProviders(env, calls), store: new RoStore({}) });
  const server = createServer(async (req, res) => { if (!(await app.handle(req, res))) { res.writeHead(404); res.end(); } });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { app, calls, base, close: () => new Promise((r) => server.close(r)) };
}

// 走完一次 OAuth：授權頁 → 回呼 → 一次性代碼換權杖
async function signIn(t, provider, code) {
  const start = await fetch(`${t.base}/api/ro/auth/${provider}?return=/web/282-ro-life.html`, { redirect: 'manual' });
  assert.equal(start.status, 302);
  const auth = new URL(start.headers.get('location'));
  const state = auth.searchParams.get('state');
  t.calls.nonce = auth.searchParams.get('nonce');
  assert.equal(auth.searchParams.get('scope'), 'openid profile');
  assert.equal(auth.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(auth.searchParams.get('redirect_uri'), `${t.base}/api/ro/auth/${provider}/callback`);
  const cookie = start.headers.get('set-cookie').split(';')[0];
  const cb = await fetch(`${t.base}/api/ro/auth/${provider}/callback?code=${code}&state=${state}`, { redirect: 'manual', headers: { cookie } });
  assert.equal(cb.status, 302);
  const hash = new URL(cb.headers.get('location')).hash;
  const m = hash.match(/ro-login=([\w-]+)/);
  assert.ok(m, hash);
  const ex = await fetch(`${t.base}/api/ro/auth/exchange`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: m[1] }) });
  assert.equal(ex.status, 200);
  const out = await ex.json();
  // 權杖只在 HttpOnly cookie 裡，回應的 JSON 沒有
  assert.equal(out.token, undefined);
  const set = ex.headers.get('set-cookie');
  assert.match(set, /^ro_session=[\w-]{20,100}; Path=\/api\/ro; Max-Age=\d+; HttpOnly; SameSite=Strict$/);
  out.cookie = set.split(';')[0];
  out.token = out.cookie.split('=')[1]; // 測試裡也拿它當 Bearer 用（標頭帶真的權杖仍然接受）
  // 代碼只能用一次
  const again = await fetch(`${t.base}/api/ro/auth/exchange`, { method: 'POST', body: JSON.stringify({ code: m[1] }) });
  assert.equal(again.status, 400);
  return out;
}

test('沒設定環境變數時不提供任何登入方式', async () => {
  const t = await boot({});
  const cfg = await (await fetch(`${t.base}/api/ro/config`)).json();
  assert.deepEqual(cfg.providers, { google: false, line: false });
  assert.equal((await fetch(`${t.base}/api/ro/auth/google`, { redirect: 'manual' })).status, 404);
  await t.close();
});

test('只設定一半（缺 secret）也不算啟用；Vercel 上沒有資料庫就關閉', async () => {
  let t = await boot({ GOOGLE_CLIENT_ID: 'gid', LINE_CHANNEL_ID: '123', LINE_CHANNEL_SECRET: 's' });
  assert.deepEqual((await (await fetch(`${t.base}/api/ro/config`)).json()).providers, { google: false, line: true });
  await t.close();
  const env = { VERCEL: '1', LINE_CHANNEL_ID: '123', LINE_CHANNEL_SECRET: 's' };
  const app = createRoLife({ env, store: new RoStore(env) });
  const res = { writeHead(s) { this.status = s; }, end(b) { this.body = JSON.parse(b); } };
  await app.handle({ url: '/api/ro/config', method: 'GET', headers: {} }, res);
  assert.deepEqual(res.body.providers, { google: false, line: false });
  // 只有共用的 DATABASE_URL 也不算：282 只讀 RO_DATABASE_URL
  assert.equal(new RoStore({ ...env, DATABASE_URL: 'postgres://u:p@h/db' }).ready, false);
  assert.equal(new RoStore({ ...env, RO_DATABASE_URL: 'postgres://u:p@h/db' }).ready, true);
});

const ENV = { GOOGLE_CLIENT_ID: 'gid.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'gsecret', LINE_CHANNEL_ID: '2000000001', LINE_CHANNEL_SECRET: 'lsecret' };

test('Google 登入、雲端存檔與 rev 衝突', async () => {
  const t = await boot(ENV);
  const { token, account } = await signIn(t, 'google', 'g-code');
  assert.equal(account.name, '阿光');
  assert.deepEqual(account.providers, ['google']);
  const tokenCall = t.calls.find((c) => c.url.includes('googleapis'));
  assert.equal(tokenCall.body.redirect_uri, `${t.base}/api/ro/auth/google/callback`);
  const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  assert.deepEqual(await (await fetch(`${t.base}/api/ro/save`, { headers: auth })).json(), { doc: {}, rev: 0, updatedAt: 0 });
  const doc = {
    'characters.v1': JSON.stringify([{ id: 'c1', slot: 0, name: 'Tester', job: 'knight', look: { gender: 'm', hair: 3, hairColor: 1, cloth: 0 }, level: 60, jobLevel: 50, stats: { str: 9, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 }, equipped: { weapon: 'u1' } }]),
    'account.v1': JSON.stringify({ inventory: [{ uid: 'u1', itemId: 1466, cards: [4001, null, null, null], quality: 4, tier: 3, ilvl: 60, affixes: [{ stat: 'int', value: 3 }], owner: 'c1' }], cards: { 4001: 2 }, materials: { 984: 5 } }),
  };
  let r = await fetch(`${t.base}/api/ro/save`, { method: 'PUT', headers: auth, body: JSON.stringify({ rev: 0, doc }) });
  assert.deepEqual(await r.json(), { rev: 1 });
  const saved = await (await fetch(`${t.base}/api/ro/save`, { headers: auth })).json();
  assert.equal(saved.rev, 1);
  assert.deepEqual(saved.doc, doc);
  // 投影寫進角色與物品
  const chars = t.app.store.mem.chars.get(account.id), items = t.app.store.mem.items.get(account.id);
  assert.equal(chars[0].class, 'knight');
  assert.equal(chars[0].str, 9);
  assert.deepEqual(items.map((i) => [i.kind, i.nameid, i.amount, i.equip]), [['equip', 1466, 1, 'weapon'], ['card', 4001, 2, undefined], ['material', 984, 5, undefined]]);

  // 舊的 rev 被拒絕，並附上雲端目前的版本
  r = await fetch(`${t.base}/api/ro/save`, { method: 'PUT', headers: auth, body: JSON.stringify({ rev: 0, doc: {} }) });
  assert.equal(r.status, 409);
  assert.equal((await r.json()).rev, 1);
  // 不認得的存檔 key 擋下
  r = await fetch(`${t.base}/api/ro/save`, { method: 'PUT', headers: auth, body: JSON.stringify({ rev: 1, doc: { 'evil.v1': 'x' } }) });
  assert.equal(r.status, 400);

  await fetch(`${t.base}/api/ro/logout`, { method: 'POST', headers: auth });
  assert.equal((await fetch(`${t.base}/api/ro/me`, { headers: auth })).status, 401);
  await t.close();
});

test('LINE 登入走官方驗證端點；同一個 LINE 帳號再登入是同一個遊戲帳號', async () => {
  const t = await boot(ENV);
  const a = await signIn(t, 'line', 'l-code');
  assert.equal(a.account.name, 'LINE 玩家');
  assert.ok(t.calls.some((c) => c.url.endsWith('/verify') && c.body.nonce === t.calls.nonce));
  const b = await signIn(t, 'line', 'l-code');
  assert.equal(b.account.id, a.account.id);
  assert.notEqual(b.token, a.token);
  await t.close();
});

test('cookie 登入：同源、帳號標記、登出清 cookie；https 才加 Secure', async () => {
  const t = await boot(ENV);
  const a = await signIn(t, 'google', 'g-code');
  const pin = `c.${a.account.id}.abcdef`;
  const call = (method, path, headers = {}, body) => fetch(`${t.base}/api/ro/${path}`, { method, headers: { cookie: a.cookie, ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  // 讀取：只帶 cookie 就可以；帶了別的帳號的標記就不行
  assert.equal((await call('GET', 'me')).status, 200);
  assert.equal((await call('GET', 'me', { 'x-session': pin })).status, 200);
  let r = await call('GET', 'me', { 'x-session': `c.${a.account.id + 1}.abcdef` });
  assert.equal(r.status, 401);
  assert.equal((await r.json()).error, 'account');
  // 寫入：要帶自己的帳號標記
  const doc = { 'characters.v1': '[]' };
  r = await call('PUT', 'save', {}, { rev: 0, doc });
  assert.equal(r.status, 401);
  assert.equal((await r.json()).error, 'account');
  r = await call('PUT', 'save', { 'x-session': `c.${a.account.id + 1}.abcdef` }, { rev: 0, doc });
  assert.equal(r.status, 401);
  r = await call('PUT', 'save', { 'x-session': pin }, { rev: 0, doc });
  assert.deepEqual(await r.json(), { rev: 1 });
  // 別的網站發的寫入請求（瀏覽器會標 cross-site／same-site，或 Origin 不是本站）一律擋
  for (const h of [{ 'sec-fetch-site': 'cross-site' }, { 'sec-fetch-site': 'same-site' }, { origin: 'https://evil.example' }]) {
    r = await call('PUT', 'save', { 'x-session': pin, ...h }, { rev: 1, doc });
    assert.equal(r.status, 403, JSON.stringify(h));
    assert.equal((await r.json()).error, 'origin');
  }
  r = await call('PUT', 'save', { 'x-session': pin, 'sec-fetch-site': 'same-origin', origin: t.base }, { rev: 1, doc });
  assert.deepEqual(await r.json(), { rev: 2 });
  r = await call('PUT', 'save', { 'x-session': pin, origin: t.base }, { rev: 2, doc });
  assert.deepEqual(await r.json(), { rev: 3 });
  // 用標頭帶權杖的（測試、工具）不受同源與標記的限制：那不是瀏覽器自動帶的東西
  r = await fetch(`${t.base}/api/ro/save`, { method: 'PUT', headers: { authorization: `Bearer ${a.token}`, 'content-type': 'application/json', origin: 'https://evil.example' }, body: JSON.stringify({ rev: 3, doc }) });
  assert.deepEqual(await r.json(), { rev: 4 });
  // 亂寫的 cookie 不算登入；cookie 壞掉但標頭的權杖是好的仍然可以
  assert.equal((await fetch(`${t.base}/api/ro/me`, { headers: { cookie: 'ro_session=' + 'x'.repeat(40) } })).status, 401);
  assert.equal((await fetch(`${t.base}/api/ro/me`, { headers: { cookie: 'ro_session=' + 'x'.repeat(40), 'x-session': a.token } })).status, 200);
  // 登出：刪掉登入、清 cookie
  r = await call('POST', 'logout', { 'x-session': pin });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('set-cookie'), /^ro_session=; Path=\/api\/ro; Max-Age=0; HttpOnly; SameSite=Strict$/);
  assert.equal((await call('GET', 'me')).status, 401);
  // https（Vercel 的 x-forwarded-proto）才加 Secure
  const b = await signIn(t, 'line', 'l-code');
  r = await fetch(`${t.base}/api/ro/logout`, { method: 'POST', headers: { cookie: b.cookie, 'x-session': `c.${b.account.id}.zz`, 'x-forwarded-proto': 'https' } });
  assert.match(r.headers.get('set-cookie'), /; HttpOnly; SameSite=Strict; Secure$/);
  await t.close();
});

test('舊版頁面的權杖換成 cookie：舊權杖作廢、只收標頭', async () => {
  const t = await boot(ENV);
  const a = await signIn(t, 'google', 'g-code');
  const old = a.token;
  // 只帶 cookie 不能換（不然別的網站可以幫你換一張新的）
  assert.equal((await fetch(`${t.base}/api/ro/auth/upgrade`, { method: 'POST', headers: { cookie: a.cookie } })).status, 401);
  const r = await fetch(`${t.base}/api/ro/auth/upgrade`, { method: 'POST', headers: { authorization: `Bearer ${old}` } });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.token, undefined);
  assert.equal(body.account.id, a.account.id);
  const fresh = r.headers.get('set-cookie').split(';')[0];
  assert.notEqual(fresh, a.cookie);
  // 舊權杖（標頭或 cookie）都不能用了，新的 cookie 可以
  assert.equal((await fetch(`${t.base}/api/ro/me`, { headers: { authorization: `Bearer ${old}` } })).status, 401);
  assert.equal((await fetch(`${t.base}/api/ro/me`, { headers: { cookie: a.cookie } })).status, 401);
  assert.equal((await fetch(`${t.base}/api/ro/me`, { headers: { cookie: fresh } })).status, 200);
  assert.equal((await fetch(`${t.base}/api/ro/auth/upgrade`, { method: 'POST', headers: { authorization: `Bearer ${old}` } })).status, 401);
  await t.close();
});

test('回呼檢查 state 與 cookie，錯誤時帶錯誤碼回遊戲頁', async () => {
  const t = await boot(ENV);
  const start = await fetch(`${t.base}/api/ro/auth/google?return=https://evil.example/`, { redirect: 'manual' });
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  // 沒有 cookie（別的瀏覽器發起的登入）
  let cb = await fetch(`${t.base}/api/ro/auth/google/callback?code=g-code&state=${state}`, { redirect: 'manual' });
  assert.match(cb.headers.get('location'), /\/web\/282-ro-life\.html#ro-login-error=state$/);
  // state 已經用掉，帶 cookie 重送也不行
  cb = await fetch(`${t.base}/api/ro/auth/google/callback?code=g-code&state=${state}`, { redirect: 'manual', headers: { cookie: `ro_oauth_google=${state}` } });
  assert.match(cb.headers.get('location'), /ro-login-error=state/);
  // 使用者在 Google 按取消
  const s2 = await fetch(`${t.base}/api/ro/auth/google`, { redirect: 'manual' });
  const st2 = new URL(s2.headers.get('location')).searchParams.get('state');
  cb = await fetch(`${t.base}/api/ro/auth/google/callback?error=access_denied&state=${st2}`, { redirect: 'manual', headers: { cookie: `ro_oauth_google=${st2}` } });
  assert.match(cb.headers.get('location'), /ro-login-error=denied/);
  // token 端點失敗
  const s3 = await fetch(`${t.base}/api/ro/auth/google`, { redirect: 'manual' });
  const st3 = new URL(s3.headers.get('location')).searchParams.get('state');
  cb = await fetch(`${t.base}/api/ro/auth/google/callback?code=wrong&state=${st3}`, { redirect: 'manual', headers: { cookie: `ro_oauth_google=${st3}` } });
  assert.match(cb.headers.get('location'), /ro-login-error=provider/);
  await t.close();
});

test('Vercel 改寫後的網址（?__path=）也認得', async () => {
  const t = await boot(ENV);
  const r = await fetch(`${t.base}/api/ro?__path=config`);
  assert.deepEqual((await r.json()).providers, { google: true, line: true });
  await t.close();
});

test('存檔格式不對時投影略過、不報錯', () => {
  assert.equal(projectDoc({ 'characters.v1': '{bad' }), null);
  assert.deepEqual(projectDoc({}), { chars: [], items: [] });
});
