import { createHash, randomBytes } from 'node:crypto';
import { RoStore } from './store.mjs';
import { signTicket } from './lobby-core.mjs';
import { openSettle, settleTrade } from './trade.mjs';
import { createGameRoutes } from './game.mjs';

// 282 仙境人生：Google／LINE 登入與雲端存檔 API（/api/ro/…）。
// 遊戲本身照舊是單機模式（存檔在瀏覽器）；登入後由頁面把存檔同步到這裡。
//   GET  /api/ro/config                 哪些登入方式可用（有設定環境變數＋資料庫才算）
//   GET  /api/ro/auth/<provider>         轉到 Google／LINE 授權頁（authorization code + PKCE）
//   GET  /api/ro/auth/<provider>/callback  換 id_token、建立或找到帳號，帶一次性代碼回到遊戲頁
//   POST /api/ro/auth/exchange {code}    一次性代碼換登入權杖
//   GET  /api/ro/me · POST /api/ro/logout
//   GET  /api/ro/save · PUT /api/ro/save {rev, doc}   雲端存檔（rev 不符回 409）
//   GET  /api/ro/lobby-ticket            普隆德拉大廳的短效入場票（大廳伺服器用 RO_LOBBY_SECRET 驗證）
//   POST /api/ro/trade/settle {p, sig}    大廳成交時呼叫（沒有登入權杖，用 RO_LOBBY_SECRET 簽章；見 trade.mjs）。正式站要 RO_TRADE=1
//   /api/ro/game/…                       線上角色（引擎原本的線上協定），見 game.mjs

export const SAVE_KEY = /^(characters\.v1|account\.v1|achievements\.v1|pets\.v1|run\.v1\.[\w-]{1,40}|stages-seen\.v1\.[\w-]{1,40})$/;
const GAME_PATH = /^\/web\/282-ro-life(?:\.html)?$/;
const SESSION_TTL = 60 * 86400;
const MAX_BODY = 1_500_000;
const MAX_DOC = 1_000_000;

const PROVIDERS = {
  google: {
    enabled: (env) => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    id: (env) => env.GOOGLE_CLIENT_ID,
    secret: (env) => env.GOOGLE_CLIENT_SECRET,
    extra: { prompt: 'select_account' },
    // 直接從 Google 的 token 端點（TLS＋client secret）拿到的 id_token，依 OIDC Core 3.1.3.7 可只驗 iss／aud／exp／nonce
    async identity(idToken, nonce, env) {
      const p = decodeJwt(idToken);
      if (!['accounts.google.com', 'https://accounts.google.com'].includes(p.iss)) throw Error('iss');
      if (p.aud !== env.GOOGLE_CLIENT_ID || !(p.exp * 1000 > Date.now()) || p.nonce !== nonce || !p.sub) throw Error('claims');
      return { subject: String(p.sub), name: p.name || p.given_name };
    },
  },
  line: {
    enabled: (env) => !!(env.LINE_CHANNEL_ID && env.LINE_CHANNEL_SECRET),
    authorize: 'https://access.line.me/oauth2/v2.1/authorize',
    token: 'https://api.line.me/oauth2/v2.1/token',
    id: (env) => env.LINE_CHANNEL_ID,
    secret: (env) => env.LINE_CHANNEL_SECRET,
    extra: {},
    // LINE 官方的驗證端點會檢查簽章、aud、exp 與 nonce
    async identity(idToken, nonce, env, fetchImpl) {
      const r = await fetchImpl('https://api.line.me/oauth2/v2.1/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ id_token: idToken, client_id: env.LINE_CHANNEL_ID, nonce }),
      });
      const p = await r.json().catch(() => ({}));
      if (!r.ok || !p.sub) throw Error('verify');
      return { subject: String(p.sub), name: p.name };
    },
  },
};

function decodeJwt(t) {
  const part = String(t).split('.')[1];
  if (!part) throw Error('jwt');
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}
const rand = (n = 32) => randomBytes(n).toString('base64url');
const sha = (s) => createHash('sha256').update(s).digest('hex');

// 由存檔整理出 ro_char／ro_inventory 的列；格式不對就略過投影（存檔照存）
export function projectDoc(doc) {
  try {
    const chars = JSON.parse(doc['characters.v1'] ?? '[]');
    const acct = JSON.parse(doc['account.v1'] ?? '{}');
    if (!Array.isArray(chars)) return null;
    const n = (v, d = 0) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : d);
    const wearer = new Map();
    for (const c of chars) for (const [slot, uid] of Object.entries(c?.equipped ?? {})) if (uid) wearer.set(uid, { char: String(c.id), slot });
    const rows = chars.filter((c) => c && c.id).map((c) => ({
      game_id: String(c.id), char_num: n(c.slot), name: String(c.name ?? '').slice(0, 24), class: String(c.promotion ?? c.job ?? 'novice'),
      base_level: n(c.level, 1), job_level: n(c.jobLevel, 1), base_exp: n(c.exp), job_exp: n(c.jobExp),
      str: n(c.stats?.str, 1), agi: n(c.stats?.agi, 1), vit: n(c.stats?.vit, 1), int: n(c.stats?.int, 1), dex: n(c.stats?.dex, 1), luk: n(c.stats?.luk, 1),
      sex: c.look?.gender === 'f' ? 'F' : 'M', hair: n(c.look?.hair), hair_color: n(c.look?.hairColor), clothes_color: n(c.look?.cloth), created_at: n(c.createdAt) || null,
    }));
    const items = [];
    for (const it of Array.isArray(acct.inventory) ? acct.inventory : []) {
      if (!it?.uid) continue;
      const w = wearer.get(it.uid), cards = Array.isArray(it.cards) ? it.cards : [];
      items.push({
        kind: 'equip', uid: String(it.uid), nameid: n(it.itemId), amount: n(it.count, 1), refine: n(it.refine),
        card0: cards[0] ?? null, card1: cards[1] ?? null, card2: cards[2] ?? null, card3: cards[3] ?? null,
        quality: it.quality ?? null, tier: it.tier ?? null, ilvl: it.ilvl ?? null, affixes: it.affixes ?? null,
        bound_char: it.owner ? String(it.owner) : null, equip_char: w?.char ?? null, equip: w?.slot ?? null,
      });
    }
    for (const [kind, map] of [['card', acct.cards], ['material', acct.materials]])
      for (const [id, count] of Object.entries(map ?? {})) if (n(count) > 0) items.push({ kind, uid: Number.isFinite(Number(id)) ? null : String(id), nameid: n(id), amount: n(count) });
    return { chars: rows, items };
  } catch {
    return null;
  }
}

export function createRoLife({ env = process.env, fetchImpl = globalThis.fetch, store = new RoStore(env), lobby = null } = {}) {
  const providers = () => Object.fromEntries(Object.entries(PROVIDERS).map(([k, p]) => [k, store.ready && p.enabled(env)]));
  // 大廳：正式站是 Cloudflare Worker（RO_LOBBY_URL＋RO_LOBBY_SECRET 都要設）；本機 npm start 傳進同一台的 /api/ro/lobby
  const lobbyConf = () => (/^wss?:\/\//.test(env.RO_LOBBY_URL ?? '') && env.RO_LOBBY_SECRET ? { url: env.RO_LOBBY_URL, secret: env.RO_LOBBY_SECRET } : lobby);

  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers });
    res.end(JSON.stringify(body));
  };
  const redirect = (res, location, headers = {}) => {
    res.writeHead(302, { location, 'cache-control': 'no-store', ...headers });
    res.end();
  };
  const origin = (req) => {
    if (env.RO_PUBLIC_ORIGIN) return env.RO_PUBLIC_ORIGIN.replace(/\/$/, '');
    const proto = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0] || (req.socket?.encrypted ? 'https' : 'http');
    return `${proto}://${req.headers['x-forwarded-host'] ?? req.headers.host}`;
  };
  const readBody = (req) => new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(Object.assign(Error('too_large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(Object.assign(Error('bad_json'), { status: 400 })); } });
    req.on('error', reject);
  });
  const cookie = (req, name) => {
    for (const part of String(req.headers.cookie ?? '').split(';')) {
      const [k, ...v] = part.trim().split('=');
      if (k === name) return v.join('=');
    }
    return null;
  };
  const game = createGameRoutes({ env, store, send, readBody });

  async function authed(req) {
    // 頁面用 Bearer；引擎的線上協定用 x-session（同一個權杖）
    const m = String(req.headers.authorization ?? '').match(/^Bearer ([\w-]{20,100})$/) ?? String(req.headers['x-session'] ?? '').match(/^([\w-]{20,100})$/);
    if (!m) return null;
    const id = await store.sessionAccount(sha(m[1]));
    if (!id) return null;
    const acc = await store.account(id);
    if (!acc) return null;
    if (acc.state !== 0 || (acc.unbanTime && acc.unbanTime > Date.now())) return { banned: acc };
    return { account: acc, hash: sha(m[1]) };
  }

  async function route(req, res, path, query) {
    const method = req.method;
    if (path === 'config' && method === 'GET') return send(res, 200, { providers: providers(), lobby: lobbyConf()?.url ?? null, online: await game.enabled(), endless: (await game.enabled()) && (await game.endlessEnabled()), market: (await game.enabled()) && (await game.marketEnabled()) });

    let m = path.match(/^auth\/(google|line)(\/callback)?$/);
    if (m && method === 'GET') {
      const name = m[1], p = PROVIDERS[name];
      if (!providers()[name]) return send(res, 404, { error: 'disabled' });
      const redirectUri = `${origin(req)}/api/ro/auth/${name}/callback`;
      const cookieName = `ro_oauth_${name}`;
      const clear = { 'set-cookie': `${cookieName}=; Path=/api/ro; Max-Age=0; HttpOnly; Secure; SameSite=Lax` };
      if (!m[2]) {
        const ret = String(query.get('return') ?? '/web/282-ro-life.html');
        const back = GAME_PATH.test(ret) ? ret : '/web/282-ro-life.html';
        const state = rand(), verifier = rand(48), nonce = rand(16);
        // 資料庫還沒套 schema 之類的錯誤：帶錯誤碼回遊戲頁，不要停在一頁 JSON
        try { await store.putState({ id: state, kind: 'state', provider: name, verifier, nonce, return_to: back }, 600); }
        catch { return redirect(res, `${origin(req)}${back}#ro-login-error=provider`); }
        const challenge = createHash('sha256').update(verifier).digest('base64url');
        const url = new URL(p.authorize);
        url.search = new URLSearchParams({ response_type: 'code', client_id: p.id(env), redirect_uri: redirectUri, scope: 'openid profile', state, nonce, code_challenge: challenge, code_challenge_method: 'S256', ...p.extra });
        return redirect(res, url.href, { 'set-cookie': `${cookieName}=${state}; Path=/api/ro; Max-Age=600; HttpOnly; Secure; SameSite=Lax` });
      }
      // 回呼：state 必須同時對上資料庫與這個瀏覽器的 cookie（防止被塞別人的登入）
      const state = String(query.get('state') ?? '');
      const row = state ? await store.takeState(state, 'state') : null;
      const back = (hash) => redirect(res, `${origin(req)}${row?.return_to ?? '/web/282-ro-life.html'}#${hash}`, clear);
      if (!row || row.provider !== name || cookie(req, cookieName) !== state) return back('ro-login-error=state');
      if (query.get('error') || !query.get('code')) return back('ro-login-error=denied');
      try {
        const tr = await fetchImpl(p.token, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'authorization_code', code: String(query.get('code')), redirect_uri: redirectUri, client_id: p.id(env), client_secret: p.secret(env), code_verifier: row.verifier }),
        });
        const tok = await tr.json().catch(() => ({}));
        if (!tr.ok || !tok.id_token) throw Error('token');
        const who = await p.identity(tok.id_token, row.nonce, env, fetchImpl);
        const accountId = await store.loginIdentity(name, who.subject, who.name);
        const code = rand();
        await store.putState({ id: code, kind: 'code', provider: name, account_id: accountId }, 120);
        return back(`ro-login=${code}`);
      } catch (e) {
        console.warn('[ro-life] oauth', name, e.message);
        return back('ro-login-error=provider');
      }
    }

    if (path === 'auth/exchange' && method === 'POST') {
      const body = await readBody(req);
      const row = typeof body.code === 'string' ? await store.takeState(body.code, 'code') : null;
      if (!row?.account_id) return send(res, 400, { error: 'code' });
      const acc = await store.account(row.account_id);
      if (!acc) return send(res, 400, { error: 'code' });
      if (acc.state !== 0 || (acc.unbanTime && acc.unbanTime > Date.now())) return send(res, 403, { error: 'banned', until: acc.unbanTime });
      const token = rand();
      await store.createSession(sha(token), acc.id, SESSION_TTL);
      return send(res, 200, { token, account: { id: acc.id, name: acc.name, providers: acc.providers, via: row.provider } });
    }

    if (path === 'trade/settle' && method === 'POST') {
      const conf = lobbyConf();
      const on = store.ready && !!conf?.secret && (store.sql ? env.RO_TRADE === '1' && (await game.enabled()) : env.RO_TRADE !== '0');
      if (!on) return send(res, 404, { error: 'disabled' });
      const x = await openSettle(conf.secret, await readBody(req));
      if (!x) return send(res, 403, { error: 'sig' });
      return send(res, 200, await settleTrade(store, x));
    }
    const isGame = path.startsWith('game/');
    if (!isGame && !['me', 'logout', 'save', 'lobby-ticket'].includes(path)) return send(res, 404, { error: 'not_found' });
    const who = await authed(req);
    if (!who) return send(res, 401, { error: 'session' });
    if (who.banned) return send(res, 403, { error: 'banned', until: who.banned.unbanTime });
    const acc = who.account;
    if (isGame) return game.route(req, res, path.slice(5), acc, who.hash, query);

    if (path === 'me' && method === 'GET') return send(res, 200, { account: { id: acc.id, name: acc.name, providers: acc.providers } });
    if (path === 'lobby-ticket' && method === 'GET') {
      const conf = lobbyConf();
      if (!conf) return send(res, 404, { error: 'disabled' });
      return send(res, 200, { ticket: await signTicket(conf.secret, { account: acc.id, name: acc.name }) });
    }
    if (path === 'logout' && method === 'POST') { await store.deleteSession(who.hash); return send(res, 200, { ok: true }); }
    if (path === 'save' && method === 'GET') return send(res, 200, await store.getSave(acc.id));
    if (path === 'save' && method === 'PUT') {
      const body = await readBody(req);
      const { rev, doc } = body;
      if (!Number.isInteger(rev) || rev < 0 || !doc || typeof doc !== 'object' || Array.isArray(doc)) return send(res, 400, { error: 'bad_save' });
      const entries = Object.entries(doc);
      if (entries.length > 200 || entries.some(([k, v]) => !SAVE_KEY.test(k) || typeof v !== 'string') || JSON.stringify(doc).length > MAX_DOC) return send(res, 400, { error: 'bad_save' });
      const next = await store.putSave(acc.id, rev, doc, projectDoc(doc));
      if (next === null) return send(res, 409, { error: 'conflict', ...(await store.getSave(acc.id)) });
      return send(res, 200, { rev: next });
    }
    return send(res, 405, { error: 'method' });
  }

  // 回傳 true 代表這個請求是 /api/ro 的（已回應）
  async function handle(req, res) {
    const url = new URL(req.url, 'http://local');
    let path;
    if (url.pathname.startsWith('/api/ro/')) path = url.pathname.slice('/api/ro/'.length);
    else if (url.pathname === '/api/ro') path = url.searchParams.get('__path') ?? '';
    else return false;
    url.searchParams.delete('__path');
    try {
      if (!store.ready && path !== 'config') return send(res, 503, { error: 'unavailable' }), true;
      await route(req, res, path.replace(/\/+$/, ''), url.searchParams);
    } catch (e) {
      if (!res.headersSent) send(res, e.status ?? 500, { error: e.status ? e.message : 'server' });
    }
    return true;
  }
  return { handle, store };
}
