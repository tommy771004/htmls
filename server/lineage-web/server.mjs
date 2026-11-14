import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildIdempotencyKey,
  CHARACTER_CLASSES,
  computeEggGrant,
  createAuditRecord,
  createCheckoutSignature,
  decodeFrame,
  EGG_PACKAGES,
  encodeFrame,
  issueWsTicket,
  validateClientReport,
  verifyGmToken,
  verifyPurchaseTokenFormat,
  verifyWebhookSignature,
  verifyWsTicket,
} from './core.mjs';
import {
  getDatabaseMode,
  getRealmRepository,
  hashPassword,
  loadNamesDataset,
  loadReleaseScopeDataset,
  mimeForAssetPath,
  queryDialogues,
  queryGuideEntries,
  resolvePackedAsset,
} from './repository.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const DEFAULT_ASSETS_DIR = join(REPO_ROOT, 'assets/286');
const DEFAULT_DATA_DIR = join(REPO_ROOT, 'games/286-lineage-web/src/data/captured');

const LINEAGE_API_ENDPOINTS = new Set([
  'health',
  'maintenance',
  'version',
  'names',
  'auth',
  'characters',
  'realtime',
  'world',
  'client-report',
  'guide',
  'guide-dialogues',
  'release-scope',
  'forum',
  'gm',
  'payments',
  'google-play-billing',
  'runtime',
  'test-frontend',
  'pack',
]);

const MAX_BODY = 1_000_000;

function readJsonBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    if (req.body && typeof req.body === 'object') {
      resolveBody(req.body);
      return;
    }
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        rejectBody(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolveBody({});
        return;
      }
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        rejectBody(Object.assign(new Error('Invalid JSON body'), { status: 400 }));
      }
    });
    req.on('error', rejectBody);
  });
}

function readCookie(req, name) {
  const raw = String(req.headers?.cookie ?? '');
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

export function createLineageServer({
  env = process.env,
  repo = null,
  assetsDir = DEFAULT_ASSETS_DIR,
  dataDir = DEFAULT_DATA_DIR,
} = {}) {
  const getRepo = () => repo ?? getRealmRepository(env);
  const wsSecret = () => env.REALM_WS_SECRET || 'dev-realm-ws-secret-key-163';
  const paySecret = () => env.ORIGIN_PAY_SECRET || 'dev-origin-pay-secret-163';
  const gmSecret = () => env.GM_ADMIN_TOKEN || 'dev-gm-secret-token';
  const realmPlayers = new Map();

  const sendJson = (res, status, body, extraHeaders = {}) => {
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...extraHeaders,
    });
    res.end(JSON.stringify(body));
  };

  // 由 session 找出帳號：{ id, username, key（小寫帳號）}
  async function resolveAccount(req) {
    const headerSession = String(req.headers['x-game-session'] ?? '').trim();
    const cookieSession = readCookie(req, 'realm_session')?.trim() ?? '';
    const token = headerSession || cookieSession;
    if (!token) return null;

    const repository = getRepo();
    const session = await repository.findSessionByTokenHash(token);
    if (session) {
      const account = await repository.findAccountById(session.accountId);
      if (account) {
        return { id: account.id, username: account.username, key: account.username.toLowerCase() };
      }
    }
    // 記憶體模式（本機 npm start）才把未知 token 當成臨時帳號；資料庫模式一律要真的登入
    if (!repository.persistent && token.length >= 6) {
      const key = `acct_${token.slice(0, 12).toLowerCase()}`;
      return { id: null, username: key, key };
    }
    return null;
  }

  async function handleApiRoute(req, res, endpoint, searchParams) {
    const method = req.method || 'GET';
    const repository = getRepo();

    if (endpoint === 'health' && method === 'GET') {
      const runtime = await repository.getRuntimeState();
      return sendJson(res, 200, {
        status: runtime.maintenance ? 'maintenance' : 'ok',
        ready: !runtime.maintenance,
        maintenance: runtime.maintenance,
        maintenanceMessage: runtime.maintenanceMessage,
        realm: runtime.realmName,
        build: runtime.build,
        databaseMode: getDatabaseMode(env),
        timestamp: new Date().toISOString(),
      });
    }

    if (endpoint === 'maintenance' && method === 'GET') {
      const state = await repository.getRuntimeState();
      return sendJson(res, 200, {
        maintenance: state.maintenance,
        message: state.maintenanceMessage,
        realmName: state.realmName,
        build: state.build,
      });
    }

    if (endpoint === 'version' && method === 'GET') {
      const state = await repository.getRuntimeState();
      const scope = loadReleaseScopeDataset(dataDir);
      return sendJson(res, 200, {
        version: '1.63.0',
        build: state.build,
        releaseVersion: scope.plannedVersion ?? scope.version ?? 'GI-0.5',
        releaseScope: scope.plannedVersion ?? 'GI-0.5',
        assetProfile: 'modern',
        timestamp: new Date().toISOString(),
      });
    }

    if (endpoint === 'names' && method === 'GET') {
      const category = (searchParams.get('category') ?? '').trim();
      const q = (searchParams.get('q') ?? searchParams.get('prefix') ?? '').trim().toLowerCase();
      const limitRaw = Number(searchParams.get('limit') ?? '200');
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 1000) : 200;
      const dataset = loadNamesDataset(dataDir);
      const entries = (dataset.entries ?? []).filter((entry) => {
        if (category && entry.category !== category) return false;
        if (!q) return true;
        return (
          entry.key.toLowerCase().includes(q) ||
          entry.name.toLowerCase().includes(q) ||
          entry.original.toLowerCase().includes(q) ||
          (entry.aliases ?? []).some((a) => a.toLowerCase().includes(q))
        );
      });
      const sliced = entries.slice(0, limit);
      return sendJson(res, 200, {
        schema: dataset.schema ?? 1,
        version: dataset.version ?? 2,
        publishedAt: dataset.publishedAt ?? '',
        revision: dataset.revision ?? '',
        total: entries.length,
        count: sliced.length,
        entries: sliced,
        names: sliced.map((e) => e.name),
        classes: Object.values(CHARACTER_CLASSES).map((c) => ({
          id: c.id,
          name: c.name,
          englishName: c.englishName,
          bonusPoints: c.bonusPoints,
          baseStats: c.baseStats,
          maxStats: c.maxStats,
          startingWeapons: c.startingWeapons,
          startingItems: c.startingItems,
          description: c.description,
        })),
      });
    }

    if (endpoint === 'auth' && method === 'POST') {
      const body = await readJsonBody(req);
      const action = body.action ?? 'login';
      const username = (body.username ?? '').trim();
      const password = body.password ?? '';
      if (username.length < 3 || username.length > 32 || password.length < 6) {
        return sendJson(res, 400, {
          ok: false,
          error: '帳號需為 3~32 字元，密碼至少 6 字元',
        });
      }

      const pwdHash = hashPassword(password);
      let account = await repository.findAccountByUsername(username);
      if (action === 'register') {
        if (account) {
          return sendJson(res, 409, { ok: false, error: 'username_taken' });
        }
        try {
          account = await repository.createAccount(username, pwdHash, 'player');
        } catch (err) {
          if (/already exists/i.test(err?.message ?? '')) {
            return sendJson(res, 409, { ok: false, error: 'username_taken' });
          }
          throw err;
        }
      } else {
        if (!account || account.passwordHash !== pwdHash) {
          return sendJson(res, 401, { ok: false, error: 'invalid_credentials' });
        }
      }

      if (account.isHeld) {
        return sendJson(res, 403, { ok: false, error: 'account_held' });
      }

      const sessionToken = randomUUID();
      await repository.createSession(account.id, sessionToken, 24 * 60 * 60 * 1000);
      return sendJson(
        res,
        200,
        {
          ok: true,
          sessionId: sessionToken,
          account: {
            id: account.id,
            username: account.username,
            role: account.role,
            eggs: account.eggs,
          },
        },
        {
          'set-cookie': `realm_session=${sessionToken}; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax`,
        },
      );
    }

    if (endpoint === 'characters') {
      const bodyPromise = method === 'POST' ? readJsonBody(req) : null;
      const account = await resolveAccount(req);
      if (!account) {
        return sendJson(res, 401, { ok: false, error: 'missing_session' });
      }
      if (method === 'GET') {
        const slots = await repository.getCharacterSlots(account);
        return sendJson(res, 200, {
          ok: true,
          account: account.key,
          maxSlots: 8,
          slots,
        });
      }
      if (method === 'POST') {
        const body = await bodyPromise;
        const action = body.action ?? 'create';
        if (action === 'create') {
          const result = await repository.createCharacter(account, {
            slot: Number(body.slot ?? 1),
            name: body.name ?? '',
            classId: body.classId ?? 'knight',
            gender: body.gender === 'f' ? 'f' : 'm',
            bonusStats: body.bonusStats ?? {},
            classicMode: body.classicMode ?? true,
          });
          if (!result.ok) {
            return sendJson(res, 400, { ok: false, error: result.error });
          }
          return sendJson(res, 200, {
            ok: true,
            character: result.character,
            slots: result.slots,
          });
        }
        if (action === 'enter') {
          const slot = Number(body.slot ?? 1);
          const slots = await repository.getCharacterSlots(account);
          const character = slot >= 1 && slot <= 8 ? slots[slot - 1] : null;
          if (!character) {
            return sendJson(res, 404, { ok: false, error: 'slot_empty' });
          }
          return sendJson(res, 200, {
            ok: true,
            character,
            worldSpawn: {
              realm: '說話之島 #1',
              mapId: 4,
              mapName: '說話之島村莊',
              x: 32578,
              y: 32943,
            },
          });
        }
        if (action === 'delete') {
          const result = await repository.deleteCharacter(
            account,
            Number(body.slot ?? 1),
            body.confirmName ?? '',
          );
          if (!result.ok) {
            return sendJson(res, 400, { ok: false, error: result.error });
          }
          return sendJson(res, 200, { ok: true, slots: result.slots });
        }
        if (action === 'import') {
          const result = await repository.importCharacter(
            account,
            Number(body.slot ?? 1),
            body.saveData ?? {},
          );
          if (!result.ok) {
            return sendJson(res, 400, { ok: false, error: result.error });
          }
          return sendJson(res, 200, {
            ok: true,
            character: result.character,
            slots: result.slots,
          });
        }
        if (action === 'sync') {
          const result = await repository.syncCharacter(
            account,
            Number(body.slot ?? 1),
            body.patch ?? body.saveData ?? {},
          );
          if (!result.ok) {
            return sendJson(res, 400, { ok: false, error: result.error });
          }
          return sendJson(res, 200, {
            ok: true,
            character: result.character,
            slots: result.slots,
          });
        }
        return sendJson(res, 400, { ok: false, error: 'unsupported_action' });
      }
    }

    if (endpoint === 'realtime' && method === 'POST') {
      const body = await readJsonBody(req);
      const sessionId = (body.sessionId ?? '').trim();
      if (!sessionId) {
        return sendJson(res, 401, { ok: false, error: 'missing_session' });
      }
      const session = await repository.findSessionByTokenHash(sessionId);
      if (!session) {
        return sendJson(res, 401, { ok: false, error: 'expired_or_invalid_session' });
      }
      const account = await repository.findAccountById(session.accountId);
      if (!account || account.isHeld) {
        return sendJson(res, 403, { ok: false, error: 'account_unavailable' });
      }
      const ticket = issueWsTicket(account.id, account.username, wsSecret(), 60_000);
      return sendJson(res, 200, {
        ok: true,
        ticket,
        wsEndpoint: env.NEXT_PUBLIC_WS_GATEWAY_URL || '/api/lineage/world',
        expiresInMs: 60_000,
      });
    }

    if (endpoint === 'world' && method === 'POST') {
      const body = await readJsonBody(req);
      const claims = verifyWsTicket(body.ticket ?? '', wsSecret());
      if (!claims) {
        return sendJson(res, 401, { ok: false, error: 'invalid_ws_ticket' });
      }
      let incoming;
      try {
        incoming = decodeFrame(body.frame ?? '');
      } catch (err) {
        return sendJson(res, 400, {
          ok: false,
          error: err instanceof Error ? err.message : 'bad_frame',
        });
      }

      if (incoming.type === 'ping') {
        const reply = encodeFrame({
          type: 'pong',
          seq: incoming.seq + 1,
          payload: {
            serverTimeMs: Date.now(),
            accountId: claims.accountId,
            realm: '說話之島 #1',
          },
        });
        return sendJson(res, 200, { ok: true, frame: reply });
      }

      if (incoming.type === 'move') {
        const nowMs = Date.now();
        for (const [accId, rec] of realmPlayers.entries()) {
          if (nowMs - rec.updatedAt > 45_000) realmPlayers.delete(accId);
        }
        const mapId = typeof incoming.payload.map === 'number' ? incoming.payload.map : 4;
        const x = typeof incoming.payload.x === 'number' ? incoming.payload.x : 32578;
        const y = typeof incoming.payload.y === 'number' ? incoming.payload.y : 32943;
        const heading = typeof incoming.payload.heading === 'number' ? incoming.payload.heading : 4;
        const prevRec = realmPlayers.get(claims.accountId);
        const rec = {
          id: claims.accountId,
          username: claims.username,
          charName: String(incoming.payload.charName || claims.username).slice(0, 24),
          classId: String(incoming.payload.classId || 'royal').slice(0, 16),
          gfx: Number(incoming.payload.gfx || 0),
          polyGfx: incoming.payload.polyGfx ? Number(incoming.payload.polyGfx) : null,
          clanName: String(incoming.payload.clanName || '').slice(0, 24),
          map: mapId,
          x,
          y,
          heading,
          chatText: incoming.payload.chat ? String(incoming.payload.chat).slice(0, 60) : (prevRec?.chatText || ''),
          chatAt: incoming.payload.chat ? nowMs : (prevRec?.chatAt || 0),
          updatedAt: nowMs,
        };
        realmPlayers.set(claims.accountId, rec);
        const peers = [];
        for (const [accId, other] of realmPlayers.entries()) {
          if (accId === claims.accountId || other.map !== mapId) continue;
          peers.push({
            id: other.id,
            charName: other.charName,
            classId: other.classId,
            gfx: other.polyGfx || other.gfx,
            clanName: other.clanName,
            map: other.map,
            tx: other.x,
            ty: other.y,
            heading: other.heading,
            chatText: nowMs - other.chatAt < 6000 ? other.chatText : '',
          });
        }
        const reply = encodeFrame({
          type: 'state_sync',
          seq: incoming.seq + 1,
          payload: { mapId, x, y, verified: true, peers, onlineCount: realmPlayers.size },
        });
        return sendJson(res, 200, { ok: true, frame: reply });
      }

      if (incoming.type === 'chat') {
        const nowMs = Date.now();
        const text = String(incoming.payload.text ?? '').slice(0, 120);
        const cur = realmPlayers.get(claims.accountId);
        if (cur) {
          cur.chatText = text;
          cur.chatAt = nowMs;
          cur.updatedAt = nowMs;
        }
        const reply = encodeFrame({
          type: 'chat',
          seq: incoming.seq + 1,
          payload: { sender: claims.username, text, channel: 'world', onlineCount: realmPlayers.size },
        });
        return sendJson(res, 200, { ok: true, frame: reply });
      }

      const defaultReply = encodeFrame({
        type: 'state_sync',
        seq: incoming.seq + 1,
        payload: { status: 'connected', username: claims.username },
      });
      return sendJson(res, 200, { ok: true, frame: defaultReply });
    }

    if (endpoint === 'client-report') {
      if (method === 'POST') {
        const raw = await readJsonBody(req);
        const checked = validateClientReport(raw);
        if (!checked.ok || !checked.report) {
          return sendJson(res, 400, { ok: false, error: checked.error });
        }
        const saved = await repository.recordClientReport({
          ...checked.report,
          userAgent: req.headers['user-agent'] ?? null,
        });
        return sendJson(res, 200, { ok: true, reportId: saved.id });
      }
      if (method === 'GET') {
        const reports = await repository.listRecentClientReports(25);
        return sendJson(res, 200, { ok: true, items: reports });
      }
    }

    if (endpoint === 'guide' && method === 'GET') {
      const category = searchParams.get('category') ?? undefined;
      const q = searchParams.get('q') ?? undefined;
      const id = searchParams.get('id') ?? searchParams.get('slug') ?? undefined;
      const limitParam = searchParams.get('limit');
      const limit = limitParam ? Number(limitParam) : undefined;
      const result = queryGuideEntries({ category, q, id, limit }, dataDir);
      return sendJson(res, 200, result);
    }

    if (endpoint === 'guide-dialogues' && method === 'GET') {
      const q =
        searchParams.get('npc') ??
        searchParams.get('key') ??
        searchParams.get('q') ??
        undefined;
      const limitRaw = Number(searchParams.get('limit') ?? '24');
      const result = queryDialogues(q, Number.isFinite(limitRaw) ? limitRaw : 24, dataDir);
      return sendJson(res, 200, result);
    }

    if (endpoint === 'release-scope' && method === 'GET') {
      return sendJson(res, 200, loadReleaseScopeDataset(dataDir));
    }

    if (endpoint === 'forum') {
      if (method === 'GET') {
        const topicId = searchParams.get('topicId');
        const topics = await repository.listForumTopics();
        if (topicId) {
          const posts = await repository.listForumPosts(topicId);
          return sendJson(res, 200, { topics, activeTopicId: topicId, posts });
        }
        const firstId = topics[0]?.id ?? null;
        const posts = firstId ? await repository.listForumPosts(firstId) : [];
        return sendJson(res, 200, { topics, activeTopicId: firstId, posts });
      }
      if (method === 'POST') {
        const body = await readJsonBody(req);
        const action = body.action ?? 'create_topic';
        if (action === 'create_topic') {
          const title = (body.title ?? '').trim();
          const content = (body.body ?? '').trim();
          const authorName = (body.authorName ?? '匿名冒險者').trim().slice(0, 32);
          const category = (body.category ?? 'general').trim();
          if (title.length < 2 || content.length < 2) {
            return sendJson(res, 400, { ok: false, error: '標題與內文至少需 2 個字元' });
          }
          const created = await repository.createForumTopic({
            title,
            body: content,
            authorName,
            category,
          });
          return sendJson(res, 200, { ok: true, topic: created });
        }
        if (action === 'create_post') {
          const topicId = (body.topicId ?? '').trim();
          const content = (body.body ?? '').trim();
          const authorName = (body.authorName ?? '匿名冒險者').trim().slice(0, 32);
          if (!topicId || content.length < 1) {
            return sendJson(res, 400, { ok: false, error: '缺少討論串或回覆內容' });
          }
          const post = await repository.createForumPost({
            topicId,
            authorName,
            body: content,
          });
          return sendJson(res, 200, { ok: true, post });
        }
        if (action === 'like_topic') {
          const topicId = (body.topicId ?? '').trim();
          const updated = await repository.likeForumTopic(topicId);
          if (!updated) {
            return sendJson(res, 404, { ok: false, error: '找不到討論串' });
          }
          return sendJson(res, 200, { ok: true, topic: updated });
        }
        return sendJson(res, 400, { ok: false, error: 'unsupported_forum_action' });
      }
    }

    if (endpoint === 'gm') {
      const token = req.headers['x-gm-token'] ?? searchParams.get('token');
      if (!verifyGmToken(typeof token === 'string' ? token : null, gmSecret())) {
        return sendJson(res, 403, { ok: false, error: 'unauthorized_gm' });
      }
      if (method === 'GET') {
        const [runtime, audits, reports] = await Promise.all([
          repository.getRuntimeState(),
          repository.listGmAudits(25),
          repository.listRecentClientReports(15),
        ]);
        return sendJson(res, 200, { ok: true, runtime, audits, reports });
      }
      if (method === 'POST') {
        const body = await readJsonBody(req);
        const actor = (body.actor ?? 'gm-operator').trim();
        const action = body.action;
        if (!action) {
          return sendJson(res, 400, { ok: false, error: 'missing_action' });
        }
        if (action === 'toggle_maintenance') {
          const nextMaint = Boolean(body.maintenance);
          const msg =
            typeof body.maintenanceMessage === 'string' && body.maintenanceMessage.trim()
              ? body.maintenanceMessage.trim()
              : nextMaint
                ? '系統臨時維護中，請稍候再試'
                : '說話之島伺服器正常開放中（1.63 經典版本）';
          const runtime = await repository.setRuntimeState({
            maintenance: nextMaint,
            maintenanceMessage: msg,
          });
          const audit = createAuditRecord({
            actor,
            action: 'toggle_maintenance',
            target: 'realm:1',
            details: { maintenance: nextMaint, message: msg },
          });
          await repository.recordGmAudit(audit);
          return sendJson(res, 200, { ok: true, runtime });
        }
        if (action === 'hold_account' || action === 'unhold_account') {
          const targetUser = (body.target ?? '').trim();
          const updated = await repository.updateAccountHold(
            targetUser,
            action === 'hold_account',
          );
          const audit = createAuditRecord({
            actor,
            action,
            target: targetUser || 'unknown',
            details: { found: Boolean(updated) },
          });
          await repository.recordGmAudit(audit);
          return sendJson(res, 200, { ok: true, account: updated });
        }
        if (action === 'grant_eggs') {
          const targetUser = (body.target ?? '').trim();
          const eggs = typeof body.eggs === 'number' ? Math.floor(body.eggs) : 0;
          const acct = await repository.findAccountByUsername(targetUser);
          const updated = acct ? await repository.addAccountEggs(acct.id, eggs) : null;
          const audit = createAuditRecord({
            actor,
            action: 'grant_eggs',
            target: targetUser || 'unknown',
            details: { eggs, found: Boolean(updated) },
          });
          await repository.recordGmAudit(audit);
          return sendJson(res, 200, { ok: true, account: updated });
        }
        return sendJson(res, 400, { ok: false, error: 'unsupported_gm_action' });
      }
    }

    if (endpoint === 'payments') {
      if (method === 'GET') {
        const orderNo = searchParams.get('orderNo');
        if (orderNo) {
          const order = await repository.findPaymentOrder(orderNo);
          return sendJson(res, 200, { ok: Boolean(order), order, packages: EGG_PACKAGES });
        }
        return sendJson(res, 200, { ok: true, packages: EGG_PACKAGES });
      }
      if (method === 'POST') {
        const body = await readJsonBody(req);
        const action = body.action ?? 'checkout';
        if (action === 'checkout') {
          const username = (body.username ?? 'adventurer').trim();
          let account = await repository.findAccountByUsername(username);
          // 資料庫模式不替陌生帳號自動開戶（會留下固定密碼的帳號）；記憶體展示模式維持原行為
          if (!account && repository.persistent) {
            return sendJson(res, 404, { ok: false, error: 'account_not_found' });
          }
          if (!account) {
            account = await repository.createAccount(
              username,
              hashPassword('default1234'),
              'player',
            );
          }
          const packageId = body.packageId ?? 'pack-small';
          const { pkg, totalEggs } = computeEggGrant(packageId);
          const orderNo = `ORD${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;
          const order = await repository.createPaymentOrder({
            orderNo,
            accountId: account.id,
            packageId: pkg.id,
            amountTwd: pkg.amountTwd,
            eggsGranted: totalEggs,
            provider: 'origin-pay',
          });
          const signature = createCheckoutSignature(orderNo, pkg.amountTwd, paySecret());
          return sendJson(res, 200, {
            ok: true,
            order,
            signature,
            originRedirectPath: `/topup/origin?orderNo=${encodeURIComponent(orderNo)}&sig=${signature}`,
          });
        }
        if (action === 'webhook') {
          const orderNo = (body.orderNo ?? '').trim();
          const existing = await repository.findPaymentOrder(orderNo);
          if (!existing) {
            return sendJson(res, 404, { ok: false, error: 'order_not_found' });
          }
          const validSig = verifyWebhookSignature(
            orderNo,
            existing.amountTwd,
            body.signature ?? '',
            paySecret(),
          );
          if (!validSig) {
            return sendJson(res, 403, { ok: false, error: 'invalid_webhook_signature' });
          }
          const completed = await repository.completePaymentOrder(
            orderNo,
            body.providerTxId ?? `TX-${Date.now()}`,
          );
          const updatedAccount = await repository.findAccountById(existing.accountId);
          return sendJson(res, 200, {
            ok: true,
            order: completed,
            accountEggs: updatedAccount?.eggs ?? 0,
          });
        }
        return sendJson(res, 400, { ok: false, error: 'unknown_payment_action' });
      }
    }

    if (endpoint === 'google-play-billing' && method === 'POST') {
      const body = await readJsonBody(req);
      const username = (body.username ?? 'adventurer').trim();
      let account = await repository.findAccountByUsername(username);
      if (!account && repository.persistent) {
        return sendJson(res, 404, { ok: false, error: 'account_not_found' });
      }
      if (!account) {
        account = await repository.createAccount(username, hashPassword('default1234'), 'player');
      }
      const accountId = body.accountId ?? account.id;
      const productId = body.productId ?? '';
      const purchaseToken = body.purchaseToken ?? '';

      const check = verifyPurchaseTokenFormat({ accountId, productId, purchaseToken });
      if (!check.valid) {
        return sendJson(res, 400, { ok: false, error: check.reason });
      }

      const idempotencyKey = buildIdempotencyKey(productId, purchaseToken);
      const alreadyProcessed = await repository.hasPurchaseReceipt(idempotencyKey);
      if (alreadyProcessed) {
        const currentAcct = await repository.findAccountById(account.id);
        return sendJson(res, 200, {
          ok: true,
          duplicate: true,
          idempotencyKey,
          eggsGranted: 0,
          accountEggs: currentAcct?.eggs ?? account.eggs,
        });
      }

      await repository.recordPurchaseReceipt({
        idempotencyKey,
        accountId: account.id,
        productId,
        purchaseToken,
        eggsGranted: check.eggsToGrant,
      });
      const updatedAcct = await repository.findAccountById(account.id);
      return sendJson(res, 200, {
        ok: true,
        duplicate: false,
        idempotencyKey,
        eggsGranted: check.eggsToGrant,
        accountEggs: updatedAcct?.eggs ?? 0,
      });
    }

    if (endpoint === 'runtime') {
      const runtime = await repository.getRuntimeState();
      const scope = loadReleaseScopeDataset(dataDir);
      const body = method === 'POST' ? await readJsonBody(req) : {};
      return sendJson(res, 200, {
        ok: true,
        realm: 'sun',
        build: runtime.build,
        mode: 'standalone',
        runtime,
        releaseScope: {
          version: scope.plannedVersion ?? scope.version ?? 'GI-0.5',
          regionCount: (scope.retainedMapIds ?? scope.regions ?? []).length,
        },
        nodeEnv: env.NODE_ENV ?? 'development',
        databaseMode: getDatabaseMode(env),
        memoryRssMb: Math.round(process.memoryUsage().rss / 1048576),
        payload: body,
      });
    }

    if (endpoint === 'test-frontend') {
      if (method === 'GET') {
        return sendJson(res, 200, {
          ok: true,
          probe: 'frontend-diagnostic-ready',
          routes: [
            '/',
            '/official',
            '/guide',
            '/form',
            '/rice',
            '/topup',
            '/topup/origin',
            '/gm',
            '/privacy',
            '/privacy2',
          ],
          timestamp: new Date().toISOString(),
        });
      }
      if (method === 'POST') {
        const body = await readJsonBody(req);
        return sendJson(res, 200, {
          ok: true,
          echo: body,
          receivedAt: new Date().toISOString(),
        });
      }
    }

    if (endpoint === 'pack' && method === 'GET') {
      const assetPath = searchParams.get('path') ?? '';
      const resolved = resolvePackedAsset(assetPath, assetsDir);
      if (!resolved) {
        return sendJson(res, 404, { error: 'Asset not found', path: assetPath });
      }
      res.writeHead(200, {
        'content-type': resolved.contentType,
        'cache-control': 'public, max-age=31536000, immutable',
        'x-asset-pack': resolved.packFile,
        'x-asset-sha256-prefix': resolved.sha256Prefix,
      });
      res.end(Buffer.from(resolved.bytes));
      return;
    }

    return sendJson(res, 404, { error: 'not_found', endpoint });
  }

  function tryServeLineageAsset(req, res, pathname) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;
    const decodedPath = decodeURIComponent(pathname);
    if (decodedPath.includes('..')) return false;

    // 1. Packed / lineage163 / original163 / level-up-v1 assets (both root and /assets/286/ prefixed)
    const stripped = decodedPath.replace(
      /^\/assets\/286(?=\/(?:lineage163|original163|level-up-v1)\/)/,
      '',
    );
    if (
      stripped.startsWith('/lineage163/') ||
      stripped.startsWith('/original163/') ||
      stripped.startsWith('/level-up-v1/')
    ) {
      const resolved = resolvePackedAsset(stripped, assetsDir);
      if (!resolved) {
        sendJson(res, 404, { error: 'Asset not found', path: stripped });
        return true;
      }
      res.writeHead(200, {
        'content-type': resolved.contentType,
        'cache-control': 'public, max-age=31536000, immutable',
        'x-asset-pack': resolved.packFile,
        'x-asset-sha256-prefix': resolved.sha256Prefix,
      });
      res.end(req.method === 'HEAD' ? undefined : Buffer.from(resolved.bytes));
      return true;
    }

    // 2. Direct files inside assets/286/ (including .bin packs, SWs, Workers, .json.gz, etc.)
    let relPath = null;
    if (decodedPath.startsWith('/assets/286/')) {
      relPath = decodedPath.slice('/assets/286/'.length);
    } else if (
      decodedPath.startsWith('/packs/') ||
      decodedPath.startsWith('/assets/284/') ||
      [
        '/art-assets.json',
        '/art-cache-sw.js',
        '/local-materials327-sw.js',
        '/local-materials327.json',
        '/manifest-sample.json',
        '/auto-worker465.js',
        '/scenery-worker289.js',
        '/sw-assets.js',
      ].includes(decodedPath)
    ) {
      relPath = decodedPath.slice(1);
    }

    if (relPath) {
      const fullPath = normalize(join(assetsDir, relPath));
      if (!fullPath.startsWith(assetsDir) || !existsSync(fullPath)) {
        return false;
      }
      const stat = statSync(fullPath);
      if (!stat.isFile()) return false;
      const headers = {
        'content-type': mimeForAssetPath(relPath),
        'content-length': stat.size,
        'cache-control': 'no-cache',
      };
      if (relPath.endsWith('-sw.js') || relPath === 'sw-assets.js') {
        headers['service-worker-allowed'] = '/';
      }
      res.writeHead(200, headers);
      if (req.method === 'HEAD') {
        res.end();
      } else if (typeof res.on === 'function') {
        createReadStream(fullPath).pipe(res);
      } else {
        res.end(readFileSync(fullPath));
      }
      return true;
    }

    return false;
  }

  async function handle(req, res) {
    const url = new URL(req.url || '/', 'http://local');
    const pathname = url.pathname;

    let endpoint = null;
    if (pathname.startsWith('/api/lineage/')) {
      endpoint = pathname.slice('/api/lineage/'.length).replace(/\/+$/, '');
    } else if (pathname === '/api/lineage') {
      endpoint = (url.searchParams.get('__path') ?? '').replace(/\/+$/, '');
      url.searchParams.delete('__path');
    } else if (pathname.startsWith('/api/')) {
      const candidate = pathname.slice('/api/'.length).replace(/\/+$/, '');
      if (LINEAGE_API_ENDPOINTS.has(candidate)) {
        endpoint = candidate;
      }
    }

    if (endpoint !== null) {
      try {
        await handleApiRoute(req, res, endpoint, url.searchParams);
      } catch (err) {
        if (!res.headersSent) {
          sendJson(res, err?.status ?? 500, {
            ok: false,
            error: err?.message ?? 'internal_server_error',
          });
        }
      }
      return true;
    }

    if (tryServeLineageAsset(req, res, pathname)) {
      return true;
    }

    return false;
  }

  return { handle, getRepo };
}
