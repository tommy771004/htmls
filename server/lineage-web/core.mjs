import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

// 1. Asset Manifest Parser & Pack Slicer
export function parseAssetManifest(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid manifest payload');
  }
  const doc = raw;
  const packOrigin =
    typeof doc.packOrigin === 'string' && doc.packOrigin.trim().length > 0
      ? doc.packOrigin.replace(/\/+$/, '')
      : '/packs';

  const rawPacks = Array.isArray(doc.packs) ? doc.packs : [];
  const packs = rawPacks.map((p) => {
    const item = p;
    if (
      typeof item.file !== 'string' ||
      typeof item.hash !== 'string' ||
      typeof item.bytes !== 'number' ||
      item.bytes < 0
    ) {
      throw new Error('Invalid pack entry in manifest');
    }
    return {
      file: item.file,
      hash: item.hash.toLowerCase(),
      bytes: item.bytes,
      phase: item.phase === 'core' ? 'core' : 'background',
    };
  });

  const rawAssets = Array.isArray(doc.assets) ? doc.assets : [];
  const assets = new Map();
  for (const row of rawAssets) {
    if (!Array.isArray(row) || row.length < 3) {
      throw new Error('Malformed asset tuple');
    }
    const [path, hashPrefix, bytes, packIndex, offset] = row;
    if (typeof path !== 'string' || typeof hashPrefix !== 'string' || typeof bytes !== 'number') {
      throw new Error('Invalid asset tuple types');
    }
    assets.set(path, {
      path,
      hashPrefix: hashPrefix.toLowerCase(),
      bytes,
      packIndex: typeof packIndex === 'number' ? packIndex : undefined,
      offset: typeof offset === 'number' ? offset : undefined,
    });
  }

  return {
    version: typeof doc.version === 'string' ? doc.version : 'modern',
    profile: typeof doc.profile === 'string' ? doc.profile : 'modern',
    packOrigin,
    packs,
    assets,
  };
}

export function lookupAssetEntry(manifest, assetPath) {
  const normalized = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;
  return manifest.assets.get(normalized) ?? null;
}

export function computePackSlice(manifest, assetPath) {
  const entry = lookupAssetEntry(manifest, assetPath);
  if (!entry || entry.packIndex === undefined || entry.offset === undefined) {
    return null;
  }
  const pack = manifest.packs[entry.packIndex];
  if (!pack) {
    throw new Error(`Missing pack index ${entry.packIndex} for ${assetPath}`);
  }
  const endOffset = entry.offset + entry.bytes;
  if (entry.offset < 0 || endOffset > pack.bytes) {
    throw new Error(`Invalid pack slice bounds for ${assetPath}`);
  }
  return {
    packFile: `${manifest.packOrigin}/${pack.file}`,
    packHash: pack.hash,
    startOffset: entry.offset,
    endOffset,
    byteLength: entry.bytes,
  };
}

export async function verifySha256Hex(buffer, expectedHex) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const hex = createHash('sha256').update(bytes).digest('hex');
  const normalizedExpected = expectedHex.toLowerCase();
  if (normalizedExpected.length === 16) {
    return hex.startsWith(normalizedExpected);
  }
  return hex === normalizedExpected;
}

// 2. Dice Roll Simulator
export const CLASS_BASE_STATS = {
  prince: {
    id: 'prince',
    label: '王族',
    base: { str: 13, dex: 10, con: 10, wis: 11, cha: 13, intel: 10 },
    bonusPool: 8,
  },
  knight: {
    id: 'knight',
    label: '騎士',
    base: { str: 16, dex: 12, con: 14, wis: 9, cha: 12, intel: 8 },
    bonusPool: 4,
  },
  elf: {
    id: 'elf',
    label: '妖精',
    base: { str: 11, dex: 12, con: 12, wis: 12, cha: 9, intel: 12 },
    bonusPool: 7,
  },
  mage: {
    id: 'mage',
    label: '法師',
    base: { str: 8, dex: 7, con: 12, wis: 12, cha: 8, intel: 12 },
    bonusPool: 16,
  },
  darkelf: {
    id: 'darkelf',
    label: '黑暗妖精',
    base: { str: 12, dex: 15, con: 8, wis: 10, cha: 9, intel: 11 },
    bonusPool: 10,
  },
};

const STAT_KEYS = ['str', 'dex', 'con', 'wis', 'cha', 'intel'];
const MAX_SINGLE_STAT = 18;

export function rollBonusPoints(classId, rng = Math.random) {
  const def = CLASS_BASE_STATS[classId];
  if (!def) {
    throw new Error(`Unknown classId: ${String(classId)}`);
  }
  const current = { ...def.base };
  const bonus = { str: 0, dex: 0, con: 0, wis: 0, cha: 0, intel: 0 };

  let remaining = def.bonusPool;
  let guard = 0;
  while (remaining > 0 && guard < 500) {
    guard += 1;
    const candidates = STAT_KEYS.filter((k) => current[k] < MAX_SINGLE_STAT);
    if (candidates.length === 0) break;
    const idx = Math.min(candidates.length - 1, Math.floor(rng() * candidates.length));
    const chosen = candidates[idx];
    current[chosen] += 1;
    bonus[chosen] += 1;
    remaining -= 1;
  }
  return bonus;
}

export function computeFinalStats(classId, bonus) {
  const def = CLASS_BASE_STATS[classId];
  if (!def) {
    throw new Error(`Unknown classId: ${String(classId)}`);
  }
  const totalBonus = STAT_KEYS.reduce((sum, key) => sum + bonus[key], 0);
  if (totalBonus !== def.bonusPool) {
    throw new Error(`Invalid bonus sum ${totalBonus}, expected ${def.bonusPool}`);
  }
  const finalStats = { ...def.base };
  for (const key of STAT_KEYS) {
    if (bonus[key] < 0) {
      throw new Error(`Negative bonus on ${key}`);
    }
    finalStats[key] += bonus[key];
    if (finalStats[key] > MAX_SINGLE_STAT) {
      throw new Error(`Stat ${key} exceeds cap ${MAX_SINGLE_STAT}`);
    }
  }
  return finalStats;
}

export function simulateRollDistribution(classId, iterations, rng = Math.random) {
  if (iterations <= 0 || iterations > 10000) {
    throw new Error('Iterations must be between 1 and 10000');
  }
  let sumStr = 0;
  let maxStr = 0;
  for (let i = 0; i < iterations; i += 1) {
    const bonus = rollBonusPoints(classId, rng);
    const final = computeFinalStats(classId, bonus);
    sumStr += final.str;
    if (final.str > maxStr) maxStr = final.str;
  }
  return {
    iterations,
    averageStr: Number((sumStr / iterations).toFixed(2)),
    maxStrObserved: maxStr,
  };
}

// 3. World Protocol Codec
export function encodeFrame(frame) {
  if (!frame || typeof frame.type !== 'string' || !Number.isInteger(frame.seq) || frame.seq < 0) {
    throw new Error('Invalid frame header');
  }
  return JSON.stringify({
    t: frame.type,
    s: frame.seq,
    p: frame.payload ?? {},
  });
}

export function decodeFrame(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Malformed JSON frame');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Frame must be an object');
  }
  const doc = parsed;
  const validTypes = new Set(['hello', 'ping', 'pong', 'move', 'chat', 'state_sync']);
  if (typeof doc.t !== 'string' || !validTypes.has(doc.t)) {
    throw new Error('Unsupported frame type');
  }
  if (typeof doc.s !== 'number' || !Number.isInteger(doc.s) || doc.s < 0) {
    throw new Error('Invalid frame sequence');
  }
  return {
    type: doc.t,
    seq: doc.s,
    payload:
      doc.p && typeof doc.p === 'object' && !Array.isArray(doc.p)
        ? doc.p
        : {},
  };
}

// 4. Realtime Session Ticket
function signPayload(encoded, secret) {
  return createHmac('sha256', secret).update(encoded).digest('base64url');
}

export function issueWsTicket(accountId, username, secret, ttlMs = 60_000, nowMs = Date.now()) {
  if (!accountId || !username || !secret) {
    throw new Error('Missing required fields for WS ticket');
  }
  const claims = {
    accountId,
    username,
    issuedAt: nowMs,
    expiresAt: nowMs + ttlMs,
    nonce: randomUUID(),
  };
  const encoded = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const sig = signPayload(encoded, secret);
  return `${encoded}.${sig}`;
}

export function verifyWsTicket(token, secret, nowMs = Date.now()) {
  if (!token || !secret || !token.includes('.')) {
    return null;
  }
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;
  const expectedSig = signPayload(encoded, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }
  try {
    const claims = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (typeof claims.expiresAt !== 'number' || claims.expiresAt <= nowMs) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

// 5. Payments & Egg Packages
export const EGG_PACKAGES = [
  { id: 'pack-small', label: '初心者蛋幣袋', amountTwd: 150, baseEggs: 150, bonusEggs: 0 },
  { id: 'pack-medium', label: '騎士團補給箱', amountTwd: 500, baseEggs: 500, bonusEggs: 50 },
  { id: 'pack-large', label: '亞丁王室秘寶', amountTwd: 1500, baseEggs: 1500, bonusEggs: 250 },
  { id: 'pack-royal', label: '說話之島誓約箱', amountTwd: 3000, baseEggs: 3000, bonusEggs: 600 },
];

export function computeEggGrant(packageId) {
  const pkg = EGG_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) {
    throw new Error(`Unknown packageId: ${packageId}`);
  }
  return {
    pkg,
    totalEggs: pkg.baseEggs + pkg.bonusEggs,
  };
}

export function createCheckoutSignature(orderNo, amountTwd, secret) {
  if (!orderNo || amountTwd <= 0 || !secret) {
    throw new Error('Invalid parameters for checkout signature');
  }
  return createHmac('sha256', secret).update(`${orderNo}:${amountTwd}`).digest('hex');
}

export function verifyWebhookSignature(orderNo, amountTwd, signatureHex, secret) {
  if (!signatureHex || !secret) return false;
  try {
    const expected = createCheckoutSignature(orderNo, amountTwd, secret);
    const a = Buffer.from(signatureHex, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length === 0 || a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// 6. Google Play Billing Idempotency
const PRODUCT_EGG_MAP = {
  'com.lineage.eggs.150': 150,
  'com.lineage.eggs.550': 550,
  'com.lineage.eggs.1750': 1750,
  'com.lineage.eggs.3600': 3600,
};

export function verifyPurchaseTokenFormat(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, reason: 'Empty payload', eggsToGrant: 0 };
  }
  if (!payload.accountId || typeof payload.accountId !== 'string') {
    return { valid: false, reason: 'Missing accountId', eggsToGrant: 0 };
  }
  const eggs = PRODUCT_EGG_MAP[payload.productId];
  if (!eggs) {
    return { valid: false, reason: 'Unknown productId', eggsToGrant: 0 };
  }
  if (
    typeof payload.purchaseToken !== 'string' ||
    payload.purchaseToken.trim().length < 16 ||
    !/^[a-zA-Z0-9._-]+$/.test(payload.purchaseToken)
  ) {
    return { valid: false, reason: 'Malformed purchaseToken', eggsToGrant: 0 };
  }
  return { valid: true, eggsToGrant: eggs };
}

export function buildIdempotencyKey(productId, purchaseToken) {
  const digest = createHash('sha256').update(`${productId}:${purchaseToken}`).digest('hex');
  return `gp_${digest.slice(0, 40)}`;
}

export function shouldGrantReceipt(existingKeys, idempotencyKey) {
  if (existingKeys.has(idempotencyKey)) {
    return { allowGrant: false, duplicate: true };
  }
  return { allowGrant: true, duplicate: false };
}

// 7. GM Guard
export function verifyGmToken(providedToken, expectedSecret) {
  if (!providedToken || !expectedSecret) return false;
  const a = Buffer.from(providedToken.trim());
  const b = Buffer.from(expectedSecret.trim());
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function createAuditRecord(input) {
  if (!input.actor || !input.action || !input.target) {
    throw new Error('Audit record requires actor, action, and target');
  }
  return {
    actor: input.actor.trim(),
    action: input.action,
    target: input.target.trim(),
    details: input.details ?? {},
    timestampIso: new Date().toISOString(),
  };
}

// 8. Client Report Validator
const ALLOWED_REPORT_KINDS = new Set([
  'error',
  'asset_miss',
  'perf',
  'sw_lifecycle',
  'ws_disconnect',
]);

export function validateClientReport(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Body must be a JSON object' };
  }
  const obj = raw;
  const kind = typeof obj.kind === 'string' ? obj.kind.trim() : 'error';
  if (!ALLOWED_REPORT_KINDS.has(kind)) {
    return { ok: false, error: `Unsupported report kind: ${kind}` };
  }
  const message = typeof obj.message === 'string' ? obj.message.trim() : '';
  if (message.length === 0 || message.length > 2000) {
    return { ok: false, error: 'Message is required and must be <= 2000 chars' };
  }
  const build = typeof obj.build === 'string' && obj.build.trim() ? obj.build.trim().slice(0, 32) : '656';
  const pathname =
    typeof obj.pathname === 'string' && obj.pathname.startsWith('/')
      ? obj.pathname.slice(0, 160)
      : '/';
  const payload =
    obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)
      ? obj.payload
      : {};

  return {
    ok: true,
    report: {
      kind,
      message,
      build,
      pathname,
      payload,
    },
  };
}

// 9. Character Classes & 4:3 Stage Config
export function buildFrameRange(prefix, start, end, ext = 'png') {
  const step = start <= end ? 1 : -1;
  const out = [];
  for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
    out.push(`${prefix}/${i}.${ext}`);
  }
  return out;
}

export const EMPTY_SLOT_FRAMES = [
  ...Array.from({ length: 13 }, (_, idx) => `/assets/284/start/none/${idx + 1}.png`),
  ...Array.from({ length: 9 }, (_, idx) => `/assets/284/start/none/${idx + 16}.png`),
];
export const LOGIN_ANIM_FRAMES = Array.from(
  { length: 28 },
  (_, index) => `/assets/284/login/${273 + index}.png`,
);
export const LOGIN_BG_IMAGE = '/assets/284/login/310.png';
export const SELECT_BG_IMAGE = '/assets/284/login/load.png';
export const SELECT_OVERLAY_IMAGE = '/assets/284/login/load1.png';
export const CREATE_BG_IMAGE = '/assets/284/login/824.png';

export const LOGIN_UPDATE_NOTES = [
  '沿用 284 經典 4:3 登入、角色選擇與創立角色視覺介面',
  '整合帳號驗證、8 職業 2 性別角色槽（1-8 頁切換）與經典模式',
  '完整保留說語島 1.63 地圖、Service Worker 分包快取與即時連線測試',
];

export const CHARACTER_CLASSES = {
  royal: {
    id: 'royal',
    name: '王族',
    englishName: 'Royal',
    logo: '/assets/284/logo/royal.png',
    bonusPoints: 8,
    baseStats: { str: 13, dex: 10, con: 10, wis: 11, cha: 13, int: 10 },
    maxStats: { str: 20, dex: 20, con: 20, wis: 20, cha: 20, int: 20 },
    baseHp: 16,
    baseMp: 6,
    startingAdena: 1200,
    startingWeapons: [
      { id: 4, name: '匕首', plus: 0, count: 1, equip: true, slot: 'weapon' },
      { id: 25, name: '木盾', plus: 0, count: 1, equip: true, slot: 'shield' },
    ],
    startingItems: [
      { id: 40010, name: '紅色藥水', plus: 0, count: 100, equip: false, slot: 'consumable' },
      { id: 40088, name: '變形卷軸', plus: 0, count: 5, equip: false, slot: 'scroll' },
      { id: 40100, name: '傳送回家卷軸', plus: 0, count: 10, equip: false, slot: 'scroll' },
    ],
    description:
      '亞丁王室的血脈繼承者，具備建立與號召血盟的領導魅力，是攻城戰不可或缺的核心統帥。',
  },
  knight: {
    id: 'knight',
    name: '騎士',
    englishName: 'Knight',
    logo: '/assets/284/logo/knight.png',
    bonusPoints: 8,
    altBonusPoints: [4, 8],
    baseStats: { str: 16, dex: 12, con: 14, wis: 9, cha: 8, int: 8 },
    maxStats: { str: 20, dex: 20, con: 20, wis: 20, cha: 20, int: 20 },
    baseHp: 22,
    baseMp: 4,
    startingAdena: 1000,
    startingWeapons: [
      { id: 35, name: '匕首', plus: 0, count: 1, equip: true, slot: 'weapon' },
      { id: 20001, name: '皮夾克', plus: 0, count: 1, equip: true, slot: 'armor' },
    ],
    startingItems: [
      { id: 40010, name: '紅色藥水', plus: 0, count: 100, equip: false, slot: 'consumable' },
      { id: 40014, name: '勇敢藥水', plus: 0, count: 10, equip: false, slot: 'consumable' },
      { id: 40100, name: '傳送回家卷軸', plus: 0, count: 10, equip: false, slot: 'scroll' },
    ],
    description:
      '擁有最高體魄與近戰爆發力的前線戰士，能裝備重型鎧甲與雙手武器並飲用勇敢藥水衝鋒陷陣。',
  },
  mage: {
    id: 'mage',
    name: '法師',
    englishName: 'Wizard',
    logo: '/assets/284/logo/mage.png',
    bonusPoints: 16,
    baseStats: { str: 8, dex: 7, con: 12, wis: 12, cha: 8, int: 12 },
    maxStats: { str: 20, dex: 20, con: 20, wis: 20, cha: 20, int: 20 },
    baseHp: 14,
    baseMp: 16,
    startingAdena: 1200,
    startingWeapons: [
      { id: 115, name: '匕首', plus: 0, count: 1, equip: true, slot: 'weapon' },
      { id: 20110, name: '皮夾克', plus: 0, count: 1, equip: true, slot: 'armor' },
    ],
    startingItems: [
      { id: 40015, name: '魔法書(光箭)', plus: 0, count: 1, equip: false, slot: 'book' },
      { id: 40010, name: '紅色藥水', plus: 0, count: 100, equip: false, slot: 'consumable' },
      { id: 40100, name: '傳送回家卷軸', plus: 0, count: 10, equip: false, slot: 'scroll' },
    ],
    description:
      '精通元素破壞、治癒與不死族召喚的奧術學者，擁有最豐富的初始獎勵點數與強大法術潛能。',
  },
  elf: {
    id: 'elf',
    name: '妖精',
    englishName: 'Elf',
    logo: '/assets/284/logo/elf.png',
    bonusPoints: 8,
    altBonusPoints: [7, 8],
    baseStats: { str: 11, dex: 12, con: 12, wis: 12, cha: 8, int: 12 },
    maxStats: { str: 20, dex: 20, con: 20, wis: 20, cha: 20, int: 20 },
    baseHp: 18,
    baseMp: 10,
    startingAdena: 1100,
    startingWeapons: [
      { id: 172, name: '短弓', plus: 0, count: 1, equip: true, slot: 'weapon' },
      { id: 40744, name: '箭', plus: 0, count: 1000, equip: true, slot: 'ammo' },
    ],
    startingItems: [
      { id: 20002, name: '木製的夾克', plus: 0, count: 1, equip: true, slot: 'armor' },
      { id: 4, name: '匕首', plus: 0, count: 1, equip: false, slot: 'weapon' },
      { id: 40010, name: '紅色藥水', plus: 0, count: 100, equip: false, slot: 'consumable' },
    ],
    description:
      '受世界樹庇佑的森林射手，兼具遠程弓箭壓制、精靈魔法與金屬工藝製作能力，攻守平衡。',
  },
  dark: {
    id: 'dark',
    name: '黑暗妖精',
    englishName: 'Dark Elf',
    logo: '/assets/284/logo/dark.png',
    bonusPoints: 11,
    baseStats: { str: 12, dex: 15, con: 8, wis: 11, cha: 8, int: 10 },
    maxStats: { str: 20, dex: 20, con: 20, wis: 20, cha: 20, int: 20 },
    baseHp: 16,
    baseMp: 8,
    startingAdena: 1000,
    startingWeapons: [
      { id: 4, name: '匕首', plus: 0, count: 1, equip: true, slot: 'weapon' },
      { id: 20001, name: '皮夾克', plus: 0, count: 1, equip: true, slot: 'armor' },
    ],
    startingItems: [
      { id: 40010, name: '紅色藥水', plus: 0, count: 100, equip: false, slot: 'consumable' },
    ],
    description: '承襲敏銳與長壽卻在陰影中磨練雙刀與鋼爪的刺客，具備極高閃避與爆發殺傷力。',
  },
  illusion: {
    id: 'illusion',
    name: '幻術士',
    englishName: 'Illusionist',
    logo: '/assets/284/logo/illusionist.png',
    bonusPoints: 10,
    baseStats: { str: 11, dex: 10, con: 12, wis: 12, cha: 8, int: 12 },
    maxStats: { str: 20, dex: 20, con: 20, wis: 20, cha: 20, int: 20 },
    baseHp: 16,
    baseMp: 14,
    startingAdena: 1000,
    startingWeapons: [
      { id: 5, name: '木棒', plus: 0, count: 1, equip: true, slot: 'weapon' },
      { id: 20001, name: '皮夾克', plus: 0, count: 1, equip: true, slot: 'armor' },
    ],
    startingItems: [
      { id: 40010, name: '紅色藥水', plus: 0, count: 100, equip: false, slot: 'consumable' },
    ],
    description: '研究精神與幻象的力量，藉由奇古獸與神秘魔法動搖敵人判斷並強化隊伍。',
  },
  dragon: {
    id: 'dragon',
    name: '龍騎士',
    englishName: 'Dragon Knight',
    logo: '/assets/284/logo/Dknight.png',
    bonusPoints: 6,
    baseStats: { str: 13, dex: 11, con: 14, wis: 12, cha: 8, int: 11 },
    maxStats: { str: 20, dex: 20, con: 20, wis: 20, cha: 20, int: 20 },
    baseHp: 21,
    baseMp: 6,
    startingAdena: 1000,
    startingWeapons: [
      { id: 5, name: '木棒', plus: 0, count: 1, equip: true, slot: 'weapon' },
      { id: 20001, name: '皮夾克', plus: 0, count: 1, equip: true, slot: 'armor' },
    ],
    startingItems: [
      { id: 40010, name: '紅色藥水', plus: 0, count: 100, equip: false, slot: 'consumable' },
    ],
    description: '繼承龍之血脈與戰鬥本能，使用鎖鏈劍與龍魔法在瞬間爆發出強大破壞力。',
  },
  warrior: {
    id: 'warrior',
    name: '戰士',
    englishName: 'Warrior',
    logo: '/assets/284/logo/warrior.png',
    bonusPoints: 5,
    baseStats: { str: 16, dex: 13, con: 16, wis: 7, cha: 8, int: 10 },
    maxStats: { str: 20, dex: 20, con: 20, wis: 20, cha: 20, int: 20 },
    baseHp: 24,
    baseMp: 3,
    startingAdena: 1000,
    startingWeapons: [
      { id: 6, name: '斧頭', plus: 0, count: 1, equip: true, slot: 'weapon' },
      { id: 20001, name: '皮夾克', plus: 0, count: 1, equip: true, slot: 'armor' },
    ],
    startingItems: [
      { id: 40010, name: '紅色藥水', plus: 0, count: 100, equip: false, slot: 'consumable' },
    ],
    description: '憑藉強健體魄與雙斧鈍器在近距離戰鬥中展現高耐久力與壓制力的前線鬥士。',
  },
};

export function resolvePreviewUrls(classId, gender) {
  if (classId === 'royal' && gender !== 'f') {
    return Array.from({ length: 11 }, (_, idx) => `/assets/284/start/prince/${714 + idx}.png`);
  }
  if (classId === 'knight' && gender !== 'f') {
    return Array.from({ length: 21 }, (_, idx) => `/assets/284/start/m_knight/${378 + idx}.png`);
  }
  const def = CHARACTER_CLASSES[classId] ?? CHARACTER_CLASSES.royal;
  return [def.logo];
}

export function rollRandomBonusAllocation(classId, rng = Math.random) {
  const def = CHARACTER_CLASSES[classId] ?? CHARACTER_CLASSES.knight;
  const keys = ['str', 'dex', 'con', 'wis', 'cha', 'int'];
  const bonus = { str: 0, dex: 0, con: 0, wis: 0, cha: 0, int: 0 };
  let remaining = def.bonusPoints;
  let guard = 0;

  while (remaining > 0 && guard < 300) {
    guard += 1;
    const validKeys = keys.filter(
      (k) => def.baseStats[k] + bonus[k] < def.maxStats[k],
    );
    if (validKeys.length === 0) break;
    const picked = validKeys[Math.floor(rng() * validKeys.length)];
    bonus[picked] += 1;
    remaining -= 1;
  }

  return bonus;
}

// 10. 8-Slot Character Game Store
const globalStore = globalThis;

function getSlotsMap() {
  if (!globalStore.__realmCharacterSlots) {
    globalStore.__realmCharacterSlots = new Map();
  }
  return globalStore.__realmCharacterSlots;
}

function createInitialSlots(accountKey) {
  const slots = Array.from({ length: 8 }, () => null);
  const knightDef = CHARACTER_CLASSES.knight;
  slots[0] = {
    slot: 1,
    name: `${accountKey.slice(0, 8)}騎士`,
    classId: 'knight',
    className: knightDef.name,
    gender: 'm',
    level: 12,
    alignment: 3200,
    alignmentLabel: '守序 (Lawful)',
    pledge: '說話之島守衛隊',
    classicMode: true,
    stats: {
      str: 18,
      dex: 12,
      con: 16,
      wis: 9,
      cha: 12,
      int: 8,
    },
    hp: 168,
    maxHp: 168,
    mp: 18,
    maxMp: 18,
    ac: -6,
    adena: 12500,
    eggs: 500,
    inventory: [...knightDef.startingWeapons, ...knightDef.startingItems],
    createdAt: new Date().toISOString(),
  };
  return slots;
}

export function getAccountCharacterSlots(accountKey) {
  const key = (accountKey || 'guest').trim().toLowerCase();
  const map = getSlotsMap();
  let slots = map.get(key);
  if (!slots) {
    slots = createInitialSlots(key);
    map.set(key, slots);
  }
  return slots.map((s) => (s ? { ...s } : null));
}

export function getCharacterInSlot(accountKey, slot) {
  const slots = getAccountCharacterSlots(accountKey);
  const idx = slot - 1;
  if (idx < 0 || idx >= 8) return null;
  return slots[idx] ?? null;
}

export function createCharacterInSlot(accountKey, input) {
  const key = (accountKey || 'guest').trim().toLowerCase();
  const map = getSlotsMap();
  if (!map.has(key)) {
    map.set(key, createInitialSlots(key));
  }
  const slots = map.get(key);

  const slotIndex = Number(input.slot) - 1;
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= 8) {
    return { ok: false, error: 'invalid_slot' };
  }
  if (slots[slotIndex] !== null) {
    return { ok: false, error: 'slot_occupied' };
  }

  const trimmedName = (input.name ?? '').trim();
  if (trimmedName.length < 2 || trimmedName.length > 12) {
    return { ok: false, error: 'invalid_name' };
  }

  for (const [, existingSlots] of map.entries()) {
    if (existingSlots.some((c) => c && c.name.toLowerCase() === trimmedName.toLowerCase())) {
      return { ok: false, error: 'name_taken' };
    }
  }

  const classDef = CHARACTER_CLASSES[input.classId];
  if (!classDef) {
    return { ok: false, error: 'invalid_class' };
  }

  const bonus = input.bonusStats ?? { str: 0, dex: 0, con: 0, wis: 0, cha: 0, int: 0 };
  const statKeys = ['str', 'dex', 'con', 'wis', 'cha', 'int'];
  let totalAllocated = 0;
  const finalStats = { ...classDef.baseStats };

  for (const k of statKeys) {
    const b = Number(bonus[k] ?? 0);
    if (!Number.isInteger(b) || b < 0) {
      return { ok: false, error: 'invalid_bonus_points' };
    }
    totalAllocated += b;
    finalStats[k] += b;
    if (finalStats[k] > classDef.maxStats[k]) {
      return { ok: false, error: 'stat_exceeds_cap' };
    }
  }

  const allowedTotals = classDef.altBonusPoints ?? [classDef.bonusPoints];
  if (!allowedTotals.includes(totalAllocated)) {
    return { ok: false, error: 'points_unallocated' };
  }

  const maxHp = classDef.baseHp + Math.max(0, finalStats.con - 10) * 2;
  const maxMp = classDef.baseMp + Math.max(0, finalStats.wis - 10);
  const ac = 10 - Math.floor(finalStats.dex / 4);

  const created = {
    slot: slotIndex + 1,
    name: trimmedName,
    classId: classDef.id,
    className: classDef.name,
    gender: input.gender === 'f' ? 'f' : 'm',
    level: 1,
    alignment: 0,
    alignmentLabel: '中立 (Neutral)',
    pledge: '無血盟',
    classicMode: Boolean(input.classicMode ?? true),
    stats: finalStats,
    hp: maxHp,
    maxHp,
    mp: maxMp,
    maxMp,
    ac,
    adena: classDef.startingAdena,
    eggs: 100,
    inventory: [...classDef.startingWeapons, ...classDef.startingItems],
    createdAt: new Date().toISOString(),
  };

  slots[slotIndex] = created;
  return { ok: true, character: { ...created }, slots: getAccountCharacterSlots(key) };
}

export function deleteCharacterInSlot(accountKey, slot, confirmName) {
  const key = (accountKey || 'guest').trim().toLowerCase();
  const map = getSlotsMap();
  if (!map.has(key)) {
    map.set(key, createInitialSlots(key));
  }
  const slots = map.get(key);
  const slotIndex = Number(slot) - 1;
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= 8) {
    return { ok: false, error: 'invalid_slot' };
  }

  const existing = slots[slotIndex];
  if (!existing) {
    return { ok: false, error: 'slot_empty' };
  }
  if (existing.name !== (confirmName ?? '').trim()) {
    return { ok: false, error: 'confirm_name_mismatch' };
  }

  slots[slotIndex] = null;
  return { ok: true, slots: getAccountCharacterSlots(key) };
}

export function importCharacterToSlot(accountKey, slot, rawSave) {
  const key = (accountKey || 'guest').trim().toLowerCase();
  const map = getSlotsMap();
  if (!map.has(key)) {
    map.set(key, createInitialSlots(key));
  }
  const slots = map.get(key);
  const slotIndex = Number(slot) - 1;
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= 8) {
    return { ok: false, error: 'invalid_slot' };
  }
  if (slots[slotIndex] !== null) {
    return { ok: false, error: 'slot_occupied' };
  }

  const classId =
    rawSave.classId && CHARACTER_CLASSES[rawSave.classId] ? rawSave.classId : 'knight';
  const classDef = CHARACTER_CLASSES[classId];
  const name =
    typeof rawSave.name === 'string' && rawSave.name.trim().length >= 2
      ? rawSave.name.trim().slice(0, 12)
      : `匯入${classDef.name}${slotIndex + 1}`;

  const imported = {
    slot: slotIndex + 1,
    name,
    classId: classDef.id,
    className: classDef.name,
    gender: rawSave.gender === 'f' ? 'f' : 'm',
    level:
      typeof rawSave.level === 'number' && rawSave.level >= 1
        ? Math.min(99, Math.floor(rawSave.level))
        : 15,
    alignment: 5000,
    alignmentLabel: '守序 (Lawful)',
    pledge: '說語之島遠征軍',
    classicMode: Boolean(rawSave.classicMode ?? true),
    stats: rawSave.stats
      ? {
          str: Number(rawSave.stats.str ?? classDef.baseStats.str),
          dex: Number(rawSave.stats.dex ?? classDef.baseStats.dex),
          con: Number(rawSave.stats.con ?? classDef.baseStats.con),
          wis: Number(rawSave.stats.wis ?? classDef.baseStats.wis),
          cha: Number(rawSave.stats.cha ?? classDef.baseStats.cha),
          int: Number(rawSave.stats.int ?? classDef.baseStats.int),
        }
      : { ...classDef.baseStats },
    hp: 210,
    maxHp: 210,
    mp: 45,
    maxMp: 45,
    ac: -8,
    adena: 25000,
    eggs: 300,
    inventory: [...classDef.startingWeapons, ...classDef.startingItems],
    createdAt: new Date().toISOString(),
  };

  slots[slotIndex] = imported;
  return { ok: true, character: { ...imported }, slots: getAccountCharacterSlots(key) };
}

export function resetRealmGameStore() {
  globalStore.__realmCharacterSlots = new Map();
}
