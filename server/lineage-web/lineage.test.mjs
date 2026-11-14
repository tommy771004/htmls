import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { describe, it } from 'node:test';
import {
  buildIdempotencyKey,
  CLASS_BASE_STATS,
  computeEggGrant,
  computeFinalStats,
  computePackSlice,
  createAuditRecord,
  createCheckoutSignature,
  decodeFrame,
  encodeFrame,
  issueWsTicket,
  lookupAssetEntry,
  parseAssetManifest,
  resetRealmGameStore,
  rollBonusPoints,
  shouldGrantReceipt,
  simulateRollDistribution,
  validateClientReport,
  verifyGmToken,
  verifyPurchaseTokenFormat,
  verifySha256Hex,
  verifyWebhookSignature,
  verifyWsTicket,
} from './core.mjs';
import { InMemoryRealmRepository } from './repository.mjs';
import { createLineageServer } from './server.mjs';

async function invokeHandler(lineage, urlPath, init = {}) {
  const req = new EventEmitter();
  req.url = urlPath;
  req.method = init.method || 'GET';
  req.headers = Object.fromEntries(
    Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v]),
  );
  if (init.body !== undefined) {
    req.body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
  }

  let statusCode = 200;
  let resHeaders = {};
  const chunks = [];

  const res = {
    headersSent: false,
    writeHead(code, headers = {}) {
      this.headersSent = true;
      statusCode = code;
      resHeaders = Object.fromEntries(
        Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
      );
    },
    end(chunk) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
    },
  };

  const handled = await lineage.handle(req, res);
  if (!handled) {
    statusCode = 404;
  }
  const rawBuffer = Buffer.concat(chunks);
  return {
    status: statusCode,
    headers: {
      get: (k) => resHeaders[k.toLowerCase()] ?? null,
    },
    json: async () => JSON.parse(rawBuffer.toString('utf8')),
    arrayBuffer: async () =>
      rawBuffer.buffer.slice(rawBuffer.byteOffset, rawBuffer.byteOffset + rawBuffer.byteLength),
  };
}

describe('286 lineage-web unit tests (8 suites)', () => {
  it('1. asset-manifest-parser: parses manifest, computes pack slice, verifies sha256', async () => {
    const sampleManifest = {
      version: 'modern-all-characters343',
      profile: 'modern',
      packOrigin: '/packs/',
      packs: [
        {
          file: '22c514411dae75f3897964c7.bin',
          hash: '22c514411dae75f3897964c744b43ef73bf8eb657100257b6dbb09860e7d8b17',
          bytes: 2048,
          phase: 'core',
        },
      ],
      assets: [
        ['/lineage163/actors.json', 'a1b2c3d4e5f60718', 512, 0, 128],
        ['/lineage163/ui.json', '1122334455667788', 256],
      ],
    };
    const parsed = parseAssetManifest(sampleManifest);
    assert.equal(parsed.packOrigin, '/packs');
    assert.equal(parsed.packs.length, 1);
    assert.equal(parsed.packs[0].phase, 'core');

    const hit = lookupAssetEntry(parsed, 'lineage163/actors.json');
    assert.equal(hit?.bytes, 512);

    const slice = computePackSlice(parsed, '/lineage163/actors.json');
    assert.deepEqual(slice, {
      packFile: '/packs/22c514411dae75f3897964c7.bin',
      packHash: '22c514411dae75f3897964c744b43ef73bf8eb657100257b6dbb09860e7d8b17',
      startOffset: 128,
      endOffset: 640,
      byteLength: 512,
    });
    assert.equal(computePackSlice(parsed, '/lineage163/ui.json'), null);

    const broken = parseAssetManifest({
      ...sampleManifest,
      assets: [['/lineage163/overflow.png', 'aaaa', 5000, 0, 100]],
    });
    assert.throws(() => computePackSlice(broken, '/lineage163/overflow.png'), /Invalid pack slice bounds/);

    const payload = new TextEncoder().encode('hello-talking-island');
    const expectedFull = createHash('sha256').update(payload).digest('hex');
    assert.equal(await verifySha256Hex(payload, expectedFull), true);
    assert.equal(await verifySha256Hex(payload, expectedFull.slice(0, 16)), true);
    assert.equal(await verifySha256Hex(payload, '0000000000000000'), false);
  });

  it('2. dice-roll: respects class bonusPool and stat cap 18', () => {
    for (const classId of Object.keys(CLASS_BASE_STATS)) {
      const def = CLASS_BASE_STATS[classId];
      const bonus = rollBonusPoints(classId, () => 0.42);
      const sum = Object.values(bonus).reduce((a, b) => a + b, 0);
      assert.equal(sum, def.bonusPool);

      const finalStats = computeFinalStats(classId, bonus);
      for (const val of Object.values(finalStats)) {
        assert.ok(val <= 18);
      }
    }
    assert.throws(
      () => computeFinalStats('knight', { str: 3, dex: 0, con: 0, wis: 0, cha: 0, intel: 0 }),
      /Invalid bonus sum/,
    );
    assert.throws(
      () => computeFinalStats('knight', { str: 4, dex: 0, con: 0, wis: 0, cha: 0, intel: 0 }),
      /exceeds cap 18/,
    );
    const dist = simulateRollDistribution('prince', 100, () => 0.1);
    assert.equal(dist.iterations, 100);
    assert.ok(dist.averageStr >= 13);
    assert.ok(dist.maxStrObserved <= 18);
  });

  it('3. world-protocol: encodes and decodes frames and rejects invalid frames', () => {
    const raw = encodeFrame({
      type: 'move',
      seq: 12,
      payload: { x: 32578, y: 32943, heading: 4 },
    });
    const decoded = decodeFrame(raw);
    assert.equal(decoded.type, 'move');
    assert.equal(decoded.seq, 12);
    assert.deepEqual(decoded.payload, { x: 32578, y: 32943, heading: 4 });

    assert.throws(() => decodeFrame('not-json'), /Malformed JSON/);
    assert.throws(() => decodeFrame(JSON.stringify({ t: 'fly_hack', s: 1, p: {} })), /Unsupported frame type/);
    assert.throws(() => decodeFrame(JSON.stringify({ t: 'ping', s: -1, p: {} })), /Invalid frame sequence/);
  });

  it('4. realtime-session: issues and verifies HMAC WS ticket', () => {
    const secret = 'unit-test-secret-999';
    const now = 1_700_000_000_000;
    const token = issueWsTicket('acct-1', 'knight01', secret, 30_000, now);
    const claims = verifyWsTicket(token, secret, now + 5_000);
    assert.equal(claims?.accountId, 'acct-1');
    assert.equal(claims?.username, 'knight01');
    assert.equal(verifyWsTicket(token, secret, now + 31_000), null);
    assert.equal(verifyWsTicket(`${token}tampered`, secret, now + 1_000), null);
    assert.equal(verifyWsTicket(token, 'wrong-secret', now + 1_000), null);
  });

  it('5. payments: computes egg grants and verifies HMAC webhook signatures', () => {
    const grant = computeEggGrant('pack-large');
    assert.equal(grant.pkg.amountTwd, 1500);
    assert.equal(grant.totalEggs, 1750);
    assert.throws(() => computeEggGrant('pack-non-existent'), /Unknown packageId/);

    const secret = 'pay-secret-xyz';
    const sig = createCheckoutSignature('ORD-1001', 500, secret);
    assert.equal(verifyWebhookSignature('ORD-1001', 500, sig, secret), true);
    assert.equal(verifyWebhookSignature('ORD-1001', 1500, sig, secret), false);
    assert.equal(verifyWebhookSignature('ORD-1001', 500, 'deadbeef', secret), false);
  });

  it('6. google-play-billing: validates purchase token format and idempotency', () => {
    const valid = verifyPurchaseTokenFormat({
      accountId: 'acc-123',
      productId: 'com.lineage.eggs.550',
      purchaseToken: 'gp_token_valid_1234567890abcdef',
    });
    assert.equal(valid.valid, true);
    assert.equal(valid.eggsToGrant, 550);

    assert.equal(
      verifyPurchaseTokenFormat({
        accountId: 'acc-123',
        productId: 'com.lineage.invalid',
        purchaseToken: 'gp_token_valid_1234567890abcdef',
      }).valid,
      false,
    );
    assert.equal(
      verifyPurchaseTokenFormat({
        accountId: 'acc-123',
        productId: 'com.lineage.eggs.150',
        purchaseToken: 'short',
      }).valid,
      false,
    );

    const k1 = buildIdempotencyKey('com.lineage.eggs.150', 'token_aaaa_bbbb_cccc_dddd');
    const k2 = buildIdempotencyKey('com.lineage.eggs.150', 'token_aaaa_bbbb_cccc_dddd');
    assert.equal(k1, k2);
    const seen = new Set();
    assert.deepEqual(shouldGrantReceipt(seen, k1), { allowGrant: true, duplicate: false });
    seen.add(k1);
    assert.deepEqual(shouldGrantReceipt(seen, k2), { allowGrant: false, duplicate: true });
  });

  it('7. gm-guard: verifies constant-time GM token and builds audit records', () => {
    assert.equal(verifyGmToken('my-gm-token', 'my-gm-token'), true);
    assert.equal(verifyGmToken('my-gm-token', 'other-token'), false);
    assert.equal(verifyGmToken(null, 'my-gm-token'), false);

    const audit = createAuditRecord({
      actor: 'gm-root',
      action: 'hold_account',
      target: 'badplayer',
      details: { reason: 'bot' },
    });
    assert.equal(audit.actor, 'gm-root');
    assert.equal(audit.action, 'hold_account');
    assert.equal(audit.target, 'badplayer');
    assert.match(audit.timestampIso, /^\d{4}-\d{2}-\d{2}T/);
  });

  it('8. client-report: validates client telemetry reports', () => {
    const res = validateClientReport({
      kind: 'asset_miss',
      message: 'Missing /lineage163/Tile.pak slice',
      build: '656',
      pathname: '/guide',
      payload: { packIndex: 12 },
    });
    assert.equal(res.ok, true);
    assert.equal(res.report?.kind, 'asset_miss');
    assert.equal(res.report?.pathname, '/guide');

    assert.equal(validateClientReport({ kind: 'unknown_kind', message: 'test' }).ok, false);
    assert.equal(validateClientReport({ kind: 'error', message: '   ' }).ok, false);
  });
});

describe('286 lineage-web HTTP API & Pack Slicing integration tests', () => {
  it('serves all 18 API endpoints and slices packed assets', async () => {
    resetRealmGameStore();
    const repo = new InMemoryRealmRepository();
    const lineage = createLineageServer({
      env: {
        GM_ADMIN_TOKEN: 'test-gm-secret',
        REALM_WS_SECRET: 'test-ws-secret',
        ORIGIN_PAY_SECRET: 'test-pay-secret',
      },
      repo,
    });

    // 1. /api/lineage/health, maintenance, version, runtime, test-frontend
    const healthRes = await invokeHandler(lineage, '/api/lineage/health');
    assert.equal(healthRes.status, 200);
    const health = await healthRes.json();
    assert.equal(health.ready, true);
    assert.equal(health.build, 656);

    const maintRes = await invokeHandler(lineage, '/api/lineage/maintenance');
    assert.equal((await maintRes.json()).maintenance, false);

    const verRes = await invokeHandler(lineage, '/api/lineage/version');
    assert.equal((await verRes.json()).version, '1.63.0');

    const rtRes = await invokeHandler(lineage, '/api/lineage/runtime');
    assert.equal((await rtRes.json()).ok, true);

    const tfRes = await invokeHandler(lineage, '/api/lineage/test-frontend');
    assert.equal((await tfRes.json()).probe, 'frontend-diagnostic-ready');

    // 2. /api/lineage/names, guide, guide-dialogues, release-scope
    const namesRes = await invokeHandler(lineage, '/api/lineage/names?limit=5');
    const namesData = await namesRes.json();
    assert.equal(namesData.names.length, 5);
    assert.equal(namesData.classes.length, 8);

    const guideRes = await invokeHandler(lineage, '/api/lineage/guide');
    const guideData = await guideRes.json();
    assert.equal(guideData.total, 243);

    const dlgRes = await invokeHandler(lineage, '/api/lineage/guide-dialogues?q=導師');
    const dlgData = await dlgRes.json();
    assert.ok(dlgData.totalNpcs > 100);

    const scopeRes = await invokeHandler(lineage, '/api/lineage/release-scope');
    const scopeData = await scopeRes.json();
    assert.equal(scopeData.plannedVersion, 'GI-0.5');

    // 3. /api/lineage/auth -> characters -> realtime -> world
    const regRes = await invokeHandler(lineage, '/api/lineage/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        action: 'register',
        username: 'hero286',
        password: 'password1234',
      },
    });
    assert.equal(regRes.status, 200);
    const regData = await regRes.json();
    assert.equal(regData.ok, true);
    const sessionId = regData.sessionId;

    const charsRes = await invokeHandler(lineage, '/api/lineage/characters', {
      headers: { 'x-game-session': sessionId },
    });
    const charsData = await charsRes.json();
    assert.equal(charsData.ok, true);
    assert.equal(charsData.slots.length, 8);
    assert.equal(charsData.slots.every((s) => s === null), true);

    const createCharRes = await invokeHandler(lineage, '/api/lineage/characters', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-game-session': sessionId,
      },
      body: {
        action: 'create',
        slot: 2,
        name: '亞丁王族286',
        classId: 'royal',
        gender: 'm',
        bonusStats: { str: 4, dex: 0, con: 4, wis: 0, cha: 0, int: 0 },
        classicMode: true,
      },
    });
    assert.equal(createCharRes.status, 200);
    const createdChar = await createCharRes.json();
    assert.equal(createdChar.ok, true);
    assert.equal(createdChar.character.name, '亞丁王族286');
    assert.equal(createdChar.character.level, 1);

    const syncCharRes = await invokeHandler(lineage, '/api/lineage/characters', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-game-session': sessionId,
      },
      body: {
        action: 'sync',
        slot: 2,
        patch: { level: 3, exp: 420, gold: 2500, hp: 50, maxHp: 50, clanName: '亞丁王室' },
      },
    });
    assert.equal(syncCharRes.status, 200);
    const syncedChar = await syncCharRes.json();
    assert.equal(syncedChar.ok, true);
    assert.equal(syncedChar.character.level, 3);
    assert.equal(syncedChar.character.pledge, '亞丁王室');

    const enterRes = await invokeHandler(lineage, '/api/lineage/characters', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-game-session': sessionId,
      },
      body: { action: 'enter', slot: 2 },
    });
    assert.equal(enterRes.status, 200);
    const entered = await enterRes.json();
    assert.equal(entered.character.name, '亞丁王族286');
    assert.equal(entered.character.level, 3);

    const delRes = await invokeHandler(lineage, '/api/lineage/characters', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-game-session': sessionId,
      },
      body: { action: 'delete', slot: 2, confirmName: '亞丁王族286' },
    });
    assert.equal(delRes.status, 200);
    assert.equal((await delRes.json()).slots[1], null);

    const rtTicketRes = await invokeHandler(lineage, '/api/lineage/realtime', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { sessionId },
    });
    const rtTicket = await rtTicketRes.json();
    assert.equal(rtTicket.ok, true);

    const worldRes = await invokeHandler(lineage, '/api/lineage/world', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        ticket: rtTicket.ticket,
        frame: encodeFrame({ type: 'ping', seq: 1, payload: {} }),
      },
    });
    const worldData = await worldRes.json();
    assert.equal(worldData.ok, true);
    const replyFrame = decodeFrame(worldData.frame);
    assert.equal(replyFrame.type, 'pong');
    assert.equal(replyFrame.seq, 2);

    // 驗證多玩家同地圖即時位置與對話廣播狀態同步
    const moveRes = await invokeHandler(lineage, '/api/lineage/world', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        ticket: rtTicket.ticket,
        frame: encodeFrame({
          type: 'move',
          seq: 2,
          payload: { map: 0, x: 32580, y: 32944, heading: 4, charName: '測試騎士', classId: 'knight', gfx: 61 },
        }),
      },
    });
    const moveData = await moveRes.json();
    assert.equal(moveData.ok, true);
    const syncFrame = decodeFrame(moveData.frame);
    assert.equal(syncFrame.type, 'state_sync');
    assert.equal(syncFrame.payload.mapId, 0);
    assert.equal(syncFrame.payload.x, 32580);
    assert.equal(Array.isArray(syncFrame.payload.peers), true);
    assert.ok(syncFrame.payload.onlineCount >= 1);

    // 4. /api/lineage/forum
    const forumListRes = await invokeHandler(lineage, '/api/lineage/forum');
    const forumList = await forumListRes.json();
    assert.ok(forumList.topics.length >= 10);

    const createTopicRes = await invokeHandler(lineage, '/api/lineage/forum', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        action: 'create_topic',
        title: '整合測試討論串',
        body: '測試發言與回覆流程',
        authorName: '測試騎士',
        category: '騎士',
      },
    });
    const createdTopic = (await createTopicRes.json()).topic;
    assert.equal(createdTopic.title, '整合測試討論串');

    // 5. /api/lineage/payments & /api/lineage/google-play-billing
    const checkoutRes = await invokeHandler(lineage, '/api/lineage/payments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        action: 'checkout',
        username: 'hero286',
        packageId: 'pack-medium',
      },
    });
    const checkout = await checkoutRes.json();
    assert.equal(checkout.ok, true);

    const webhookRes = await invokeHandler(lineage, '/api/lineage/payments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        action: 'webhook',
        orderNo: checkout.order.orderNo,
        signature: checkout.signature,
      },
    });
    const webhookData = await webhookRes.json();
    assert.equal(webhookData.ok, true);
    assert.equal(webhookData.order.status, 'completed');
    assert.equal(webhookData.accountEggs, 850); // 300 initial + 550

    const gpbRes1 = await invokeHandler(lineage, '/api/lineage/google-play-billing', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        username: 'hero286',
        productId: 'com.lineage.eggs.150',
        purchaseToken: 'gp_valid_token_1234567890abcdef',
      },
    });
    const gpb1 = await gpbRes1.json();
    assert.equal(gpb1.duplicate, false);
    assert.equal(gpb1.accountEggs, 1000);

    const gpbRes2 = await invokeHandler(lineage, '/api/lineage/google-play-billing', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        username: 'hero286',
        productId: 'com.lineage.eggs.150',
        purchaseToken: 'gp_valid_token_1234567890abcdef',
      },
    });
    const gpb2 = await gpbRes2.json();
    assert.equal(gpb2.duplicate, true);
    assert.equal(gpb2.eggsGranted, 0);

    // 6. /api/lineage/gm & /api/lineage/client-report
    const repRes = await invokeHandler(lineage, '/api/lineage/client-report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        kind: 'perf',
        message: 'Initial lobby load 45ms',
        build: '656',
        pathname: '/',
      },
    });
    assert.equal(repRes.status, 200);

    const gmUnauth = await invokeHandler(lineage, '/api/lineage/gm');
    assert.equal(gmUnauth.status, 403);

    const gmAuth = await invokeHandler(lineage, '/api/lineage/gm', {
      headers: { 'x-gm-token': 'test-gm-secret' },
    });
    assert.equal(gmAuth.status, 200);
    const gmData = await gmAuth.json();
    assert.equal(gmData.ok, true);
    assert.equal(gmData.reports.length, 1);

    // 7. Binary pack slicing (/lineage163/*, /original163/*, /level-up-v1/*)
    const slice1 = await invokeHandler(lineage, '/lineage163/actors-full/1052-0.webp');
    assert.equal(slice1.status, 200);
    assert.equal(slice1.headers.get('content-type'), 'image/webp');
    const slice1Buf = await slice1.arrayBuffer();
    assert.equal(slice1Buf.byteLength, 17820);

    const slice2 = await invokeHandler(
      lineage,
      '/original163/lineage163/nerupa-native437/895-1.png',
    );
    assert.equal(slice2.status, 200);
    assert.equal(slice2.headers.get('content-type'), 'image/png');
    const slice2Buf = await slice2.arrayBuffer();
    assert.equal(slice2Buf.byteLength, 22173);

    const slice3 = await invokeHandler(lineage, '/level-up-v1/definition.json');
    assert.equal(slice3.status, 200);
    const slice3Json = await slice3.json();
    assert.ok(slice3Json);
  });
});
