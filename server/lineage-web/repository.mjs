import { createHash, randomUUID } from 'node:crypto';
import { closeSync, existsSync, openSync, readFileSync, readSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { neon } from '@neondatabase/serverless';
import {
  buildImportedCharacter,
  buildNewCharacter,
  buildSeedKnight,
  createCharacterInSlot,
  deleteCharacterInSlot,
  getAccountCharacterSlots,
  importCharacterToSlot,
  parseSlotIndex,
} from './core.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const DEFAULT_DATA_DIR = join(REPO_ROOT, 'games/286-lineage-web/src/data/captured');
const DEFAULT_ASSETS_DIR = join(REPO_ROOT, 'assets/286');

const jsonCache = new Map();

function readCapturedJson(fileName, dataDir = DEFAULT_DATA_DIR) {
  const fullPath = join(dataDir, fileName);
  if (jsonCache.has(fullPath)) {
    return jsonCache.get(fullPath);
  }
  const raw = readFileSync(fullPath, 'utf8');
  const parsed = JSON.parse(raw);
  jsonCache.set(fullPath, parsed);
  return parsed;
}

export function loadGuideDataset(dataDir = DEFAULT_DATA_DIR) {
  return readCapturedJson('guide.json', dataDir);
}

export function queryGuideEntries(options = {}, dataDir = DEFAULT_DATA_DIR) {
  const dataset = loadGuideDataset(dataDir);
  const category = (options.category ?? '').trim();
  const q = (options.q ?? '').trim().toLowerCase();
  const id = (options.id ?? options.slug ?? '').trim();

  let records = dataset.records ?? dataset.entries ?? [];
  if (id) {
    records = records.filter((rec) => rec.id === id || rec.slug === id);
  } else {
    if (category && category !== 'all' && category !== '全部') {
      records = records.filter((rec) => rec.category === category);
    }
    if (q) {
      records = records.filter(
        (rec) =>
          (rec.name ?? rec.title ?? '').toLowerCase().includes(q) ||
          (rec.summary ?? '').toLowerCase().includes(q) ||
          (rec.id ?? rec.slug ?? '').toLowerCase().includes(q) ||
          (rec.aliases ?? []).some((alias) => alias.toLowerCase().includes(q)),
      );
    }
  }

  const limit =
    typeof options.limit === 'number' && options.limit > 0
      ? Math.min(options.limit, 300)
      : records.length;
  const sliced = records.slice(0, limit);

  return {
    revision: dataset.revision ?? '1.63',
    build: dataset.build ?? 656,
    source: dataset.source ?? 'captured',
    syncedAt: dataset.syncedAt ?? Date.now(),
    nameVersion: dataset.nameVersion ?? 2,
    total: records.length,
    records: sliced,
    items: sliced,
  };
}

export function loadReleaseScopeDataset(dataDir = DEFAULT_DATA_DIR) {
  return readCapturedJson('release-scope.json', dataDir);
}

export function loadNamesDataset(dataDir = DEFAULT_DATA_DIR) {
  return readCapturedJson('names.json', dataDir);
}

export function loadDialoguesDataset(dataDir = DEFAULT_DATA_DIR) {
  return readCapturedJson('dialogues.json', dataDir);
}

export function queryDialogues(q, limit = 20, dataDir = DEFAULT_DATA_DIR) {
  const dialogues = loadDialoguesDataset(dataDir);
  const allEntries = Object.entries(dialogues);
  const normalized = (q ?? '').trim();
  const cleanKey = normalized.startsWith('npc:') ? normalized.slice(4) : normalized;
  const entries = [];

  if (cleanKey && typeof dialogues[cleanKey] === 'string') {
    entries.push({ key: cleanKey, html: dialogues[cleanKey] });
  }

  const needle = cleanKey.toLowerCase();
  for (const [k, html] of allEntries) {
    if (k === cleanKey || typeof html !== 'string') continue;
    if (
      !needle ||
      k.toLowerCase().startsWith(needle) ||
      k.toLowerCase().includes(needle) ||
      html.includes(`${cleanKey}：`) ||
      html.includes(`<p>${cleanKey}</p>`) ||
      html.toLowerCase().includes(needle)
    ) {
      entries.push({ key: k, html });
      if (entries.length >= Math.min(limit, 60)) break;
    }
  }

  return {
    ready: entries.length > 0,
    query: cleanKey,
    totalNpcs: allEntries.length,
    matchedCount: entries.length,
    entries,
    items: entries,
  };
}

export function loadForumTopicsSeed(dataDir = DEFAULT_DATA_DIR) {
  return readCapturedJson('forum-topics.json', dataDir);
}

export function hashPassword(password) {
  return createHash('sha256').update(`realm_salt_v1:${password}`).digest('hex');
}

function defaultRuntimeState() {
  return {
    maintenance: false,
    maintenanceMessage: '說話之島伺服器正常開放中（1.63 經典版本）',
    realmName: '說話之島 #1',
    build: 656,
    maxConcurrentPlayers: 1200,
    dropRateMultiplier: 1,
    expRateMultiplier: 1,
  };
}

export class InMemoryRealmRepository {
  constructor(dataDir = DEFAULT_DATA_DIR) {
    this.accountsById = new Map();
    this.accountsByUsername = new Map();
    this.sessionsByToken = new Map();
    this.forumTopics = [];
    this.forumPosts = new Map();
    this.paymentOrders = new Map();
    this.purchaseReceiptKeys = new Set();
    this.clientReports = [];
    this.auditLogs = [];
    this.runtimeState = defaultRuntimeState();

    let capturedTopics = [];
    try {
      capturedTopics = loadForumTopicsSeed(dataDir).topics ?? [];
    } catch {
      capturedTopics = [];
    }

    if (capturedTopics.length > 0) {
      for (const item of capturedTopics) {
        const topicId = String(item.id).startsWith('topic-') ? String(item.id) : `topic-${item.id}`;
        const replyList = Array.isArray(item.replies) ? item.replies : [];
        const createdAt =
          typeof item.created === 'number'
            ? new Date(item.created).toISOString()
            : item.createdAt || new Date().toISOString();
        const updatedAt =
          typeof item.updated === 'number'
            ? new Date(item.updated).toISOString()
            : item.updatedAt || createdAt;
        this.forumTopics.push({
          id: topicId,
          slug: `captured-post-${item.id}`,
          title: item.title,
          category: item.category || item.characterClass || '經典討論',
          authorName: item.nickname || item.authorName || '匿名冒險者',
          body: item.body,
          pinned: Boolean(item.pinned) || item.id === 24 || item.id === 22,
          likes: typeof item.likes === 'number' ? item.likes : Math.max(1, replyList.length * 2),
          replyCount: typeof item.replies === 'number' ? item.replies : replyList.length,
          createdAt,
          updatedAt,
        });
        this.forumPosts.set(
          topicId,
          replyList.map((r) => ({
            id: `reply-${r.id}`,
            topicId,
            authorName: r.authorName || '旅人',
            body: r.body,
            likes: 1,
            createdAt: r.createdAt || createdAt,
          })),
        );
      }
    } else {
      const now = new Date().toISOString();
      const seedTopicId = randomUUID();
      this.forumTopics.push({
        id: seedTopicId,
        slug: 'welcome-to-talking-island-163',
        title: '【公告】天堂 1.63 說話之島獨立伺服器正式啟航',
        category: 'announcement',
        authorName: '亞丁管理團隊',
        body: '歡迎回到說話之島！本平台已完成全量圖鑑、本機素材快取與雲端資料庫整合。',
        pinned: true,
        likes: 12,
        replyCount: 1,
        createdAt: now,
        updatedAt: now,
      });
      this.forumPosts.set(seedTopicId, [
        {
          id: randomUUID(),
          topicId: seedTopicId,
          authorName: '騎士團長',
          body: '測試回文與點讚功能一切正常，祝大家打寶順利！',
          likes: 3,
          createdAt: now,
        },
      ]);
    }
  }

  async createAccount(username, passwordHash, role = 'player') {
    const key = username.toLowerCase();
    if (this.accountsByUsername.has(key)) {
      throw new Error('Username already exists');
    }
    const record = {
      id: randomUUID(),
      username,
      passwordHash,
      role,
      eggs: 300,
      isHeld: false,
      createdAt: new Date().toISOString(),
    };
    this.accountsById.set(record.id, record);
    this.accountsByUsername.set(key, record);
    return { ...record };
  }

  async findAccountByUsername(username) {
    const found = this.accountsByUsername.get(username.toLowerCase());
    return found ? { ...found } : null;
  }

  async findAccountById(id) {
    const found = this.accountsById.get(id);
    return found ? { ...found } : null;
  }

  async updateAccountHold(username, isHeld) {
    const found = this.accountsByUsername.get(username.toLowerCase());
    if (!found) return null;
    found.isHeld = isHeld;
    return { ...found };
  }

  async addAccountEggs(accountId, deltaEggs) {
    const found = this.accountsById.get(accountId);
    if (!found) return null;
    found.eggs = Math.max(0, found.eggs + deltaEggs);
    return { ...found };
  }

  async createSession(accountId, tokenHash, ttlMs) {
    const now = Date.now();
    const record = {
      id: randomUUID(),
      accountId,
      tokenHash,
      expiresAt: new Date(now + ttlMs).toISOString(),
      createdAt: new Date(now).toISOString(),
    };
    this.sessionsByToken.set(tokenHash, record);
    return { ...record };
  }

  async findSessionByTokenHash(tokenHash) {
    const found = this.sessionsByToken.get(tokenHash);
    if (!found) return null;
    if (Date.parse(found.expiresAt) <= Date.now()) {
      this.sessionsByToken.delete(tokenHash);
      return null;
    }
    return { ...found };
  }

  async listForumTopics() {
    return [...this.forumTopics].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }

  async createForumTopic(input) {
    const now = new Date().toISOString();
    const slug = `${input.category}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const topic = {
      id: randomUUID(),
      slug,
      title: input.title,
      category: input.category,
      authorName: input.authorName,
      body: input.body,
      pinned: false,
      likes: 0,
      replyCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.forumTopics.unshift(topic);
    this.forumPosts.set(topic.id, []);
    return { ...topic };
  }

  async listForumPosts(topicId) {
    return [...(this.forumPosts.get(topicId) ?? [])];
  }

  async createForumPost(input) {
    const topic = this.forumTopics.find((t) => t.id === input.topicId);
    if (!topic) {
      throw new Error('Topic not found');
    }
    const post = {
      id: randomUUID(),
      topicId: input.topicId,
      authorName: input.authorName,
      body: input.body,
      likes: 0,
      createdAt: new Date().toISOString(),
    };
    const list = this.forumPosts.get(input.topicId) ?? [];
    list.push(post);
    this.forumPosts.set(input.topicId, list);
    topic.replyCount = list.length;
    topic.updatedAt = post.createdAt;
    return { ...post };
  }

  async likeForumTopic(topicId) {
    const topic = this.forumTopics.find((t) => t.id === topicId);
    if (!topic) return null;
    topic.likes += 1;
    return { ...topic };
  }

  async createPaymentOrder(input) {
    const order = {
      id: randomUUID(),
      orderNo: input.orderNo,
      accountId: input.accountId,
      packageId: input.packageId,
      amountTwd: input.amountTwd,
      eggsGranted: input.eggsGranted,
      provider: input.provider,
      status: 'pending',
      providerTxId: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    this.paymentOrders.set(order.orderNo, order);
    return { ...order };
  }

  async findPaymentOrder(orderNo) {
    const found = this.paymentOrders.get(orderNo);
    return found ? { ...found } : null;
  }

  async completePaymentOrder(orderNo, providerTxId) {
    const order = this.paymentOrders.get(orderNo);
    if (!order) return null;
    if (order.status === 'completed') {
      return { ...order };
    }
    order.status = 'completed';
    order.providerTxId = providerTxId;
    order.completedAt = new Date().toISOString();
    await this.addAccountEggs(order.accountId, order.eggsGranted);
    return { ...order };
  }

  async hasPurchaseReceipt(idempotencyKey) {
    return this.purchaseReceiptKeys.has(idempotencyKey);
  }

  async recordPurchaseReceipt(input) {
    this.purchaseReceiptKeys.add(input.idempotencyKey);
    await this.addAccountEggs(input.accountId, input.eggsGranted);
  }

  async recordClientReport(input) {
    const rec = {
      id: randomUUID(),
      ...input,
      createdAt: new Date().toISOString(),
    };
    this.clientReports.unshift(rec);
    if (this.clientReports.length > 200) {
      this.clientReports.pop();
    }
    return rec;
  }

  async listRecentClientReports(limit = 25) {
    return this.clientReports.slice(0, limit);
  }

  async getRuntimeState() {
    return { ...this.runtimeState };
  }

  async setRuntimeState(patch) {
    this.runtimeState = {
      ...this.runtimeState,
      ...patch,
    };
    return { ...this.runtimeState };
  }

  async recordGmAudit(input) {
    const rec = {
      id: randomUUID(),
      ...input,
      createdAt: new Date().toISOString(),
    };
    this.auditLogs.unshift(rec);
    return rec;
  }

  async listGmAudits(limit = 50) {
    return this.auditLogs.slice(0, limit);
  }

  /** 帳號、session 與角色是否跨實例保存（Neon 模式才是）。 */
  get persistent() {
    return false;
  }

  // 角色槽：記憶體模式沿用 core.mjs 的全域 Map，以帳號小寫為鍵（account.key）
  async getCharacterSlots(account) {
    return getAccountCharacterSlots(account.key);
  }

  async createCharacter(account, input) {
    return createCharacterInSlot(account.key, input);
  }

  async importCharacter(account, slot, rawSave) {
    return importCharacterToSlot(account.key, slot, rawSave);
  }

  async deleteCharacter(account, slot, confirmName) {
    return deleteCharacterInSlot(account.key, slot, confirmName);
  }
}

const SCHEMA_SQL_PATH = join(__dirname, 'schema.sql');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sha256Hex(text) {
  return createHash('sha256').update(String(text)).digest('hex');
}

function isoOrNull(value) {
  return value ? new Date(value).toISOString() : null;
}

function toAccount(row) {
  return row ? { ...row, createdAt: isoOrNull(row.createdAt) } : null;
}

/** schema.sql 拆成單句（Neon HTTP 一次只能送一句）。 */
export function splitSchemaStatements(text) {
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((stmt) => stmt.trim())
    .filter(Boolean);
}

/**
 * Neon PostgreSQL 模式：帳號、session 與 8 槽角色存在資料庫，跨 Vercel 實例與冷啟動都在。
 * 帳號、session、角色、蛋幣、儲值訂單與收據在資料庫；論壇、回報、維護開關與 GM 稽核仍沿用記憶體實作（繼承自 InMemoryRealmRepository）。
 * 這裡沒有記憶體後援：資料庫出錯就丟例外，讓 API 回 500，而不是把資料偷偷寫進會消失的記憶體。
 */
export class NeonRealmRepository extends InMemoryRealmRepository {
  constructor(databaseUrl, dataDir = DEFAULT_DATA_DIR, sqlClient = null) {
    super(dataDir);
    this.sql = sqlClient ?? neon(databaseUrl);
    this.schemaReady = null;
  }

  get persistent() {
    return true;
  }

  // 第一次查詢前確認資料表存在；缺 character_slots（最後加入的表）就整份套用 schema.sql（全是 IF NOT EXISTS）
  ensureSchema() {
    if (!this.schemaReady) {
      this.schemaReady = (async () => {
        const rows = await this.sql`SELECT to_regclass('public.character_slots') AS t`;
        if (rows[0]?.t) return;
        for (const stmt of splitSchemaStatements(readFileSync(SCHEMA_SQL_PATH, 'utf8'))) {
          await this.sql.query(stmt);
        }
      })().catch((err) => {
        this.schemaReady = null;
        throw err;
      });
    }
    return this.schemaReady;
  }

  async createAccount(username, passwordHash, role = 'player') {
    await this.ensureSchema();
    const rows = await this.sql`
      INSERT INTO accounts (username, password_hash, role, eggs, is_held)
      VALUES (${username}, ${passwordHash}, ${role}, 300, false)
      ON CONFLICT DO NOTHING
      RETURNING id, username, password_hash AS "passwordHash", role, eggs, is_held AS "isHeld", created_at AS "createdAt"
    `;
    if (!rows[0]) throw new Error('Username already exists');
    const account = toAccount(rows[0]);
    await this.seedStarterKnight(account);
    return account;
  }

  // 新帳號送一隻 Lv.12 騎士；名字「帳號前 8 字＋騎士」跨帳號可能撞名，撞了就加數字
  async seedStarterKnight(account) {
    const base = `${account.username.toLowerCase().slice(0, 8)}騎士`;
    for (let n = 0; n < 10; n += 1) {
      const name = n === 0 ? base : `${base}${n + 1}`;
      const result = await this.insertCharacterRow(account.id, buildSeedKnight(account.username.toLowerCase(), name));
      if (result.ok || result.error === 'slot_occupied') return;
    }
  }

  async findAccountByUsername(username) {
    await this.ensureSchema();
    const rows = await this.sql`
      SELECT id, username, password_hash AS "passwordHash", role, eggs, is_held AS "isHeld", created_at AS "createdAt"
      FROM accounts
      WHERE lower(username) = lower(${username})
      LIMIT 1
    `;
    return toAccount(rows[0]);
  }

  async findAccountById(id) {
    if (!UUID_RE.test(String(id ?? ''))) return null;
    await this.ensureSchema();
    const rows = await this.sql`
      SELECT id, username, password_hash AS "passwordHash", role, eggs, is_held AS "isHeld", created_at AS "createdAt"
      FROM accounts
      WHERE id = ${id}
      LIMIT 1
    `;
    return toAccount(rows[0]);
  }

  async updateAccountHold(username, isHeld) {
    await this.ensureSchema();
    const rows = await this.sql`
      UPDATE accounts SET is_held = ${Boolean(isHeld)}
      WHERE lower(username) = lower(${username})
      RETURNING id, username, password_hash AS "passwordHash", role, eggs, is_held AS "isHeld", created_at AS "createdAt"
    `;
    return toAccount(rows[0]);
  }

  async addAccountEggs(accountId, deltaEggs) {
    if (!UUID_RE.test(String(accountId ?? ''))) return null;
    await this.ensureSchema();
    const rows = await this.sql`
      UPDATE accounts SET eggs = GREATEST(0, eggs + ${Math.trunc(Number(deltaEggs) || 0)})
      WHERE id = ${accountId}
      RETURNING id, username, password_hash AS "passwordHash", role, eggs, is_held AS "isHeld", created_at AS "createdAt"
    `;
    return toAccount(rows[0]);
  }

  // 蛋幣、儲值訂單與 Google Play 收據一起放資料庫：入帳與「已處理」標記在同一句 SQL 裡完成，不會重複加值
  async createPaymentOrder(input) {
    await this.ensureSchema();
    const rows = await this.sql`
      INSERT INTO payment_orders (order_no, account_id, package_id, amount_twd, eggs_granted, provider)
      VALUES (${input.orderNo}, ${input.accountId}, ${input.packageId}, ${input.amountTwd}, ${input.eggsGranted}, ${input.provider ?? 'origin-pay'})
      RETURNING order_no AS "orderNo"
    `;
    return this.findPaymentOrder(rows[0].orderNo);
  }

  async findPaymentOrder(orderNo) {
    if (!orderNo) return null;
    await this.ensureSchema();
    const rows = await this.sql`
      SELECT id, order_no AS "orderNo", account_id AS "accountId", package_id AS "packageId",
             amount_twd AS "amountTwd", eggs_granted AS "eggsGranted", provider, status,
             provider_tx_id AS "providerTxId", created_at AS "createdAt", completed_at AS "completedAt"
      FROM payment_orders WHERE order_no = ${orderNo} LIMIT 1
    `;
    const row = rows[0];
    return row ? { ...row, createdAt: isoOrNull(row.createdAt), completedAt: isoOrNull(row.completedAt) } : null;
  }

  async completePaymentOrder(orderNo, providerTxId) {
    await this.ensureSchema();
    await this.sql`
      WITH done AS (
        UPDATE payment_orders
        SET status = 'completed', provider_tx_id = ${providerTxId}, completed_at = now()
        WHERE order_no = ${orderNo} AND status <> 'completed'
        RETURNING account_id, eggs_granted
      )
      UPDATE accounts SET eggs = accounts.eggs + done.eggs_granted
      FROM done WHERE accounts.id = done.account_id
    `;
    return this.findPaymentOrder(orderNo);
  }

  async hasPurchaseReceipt(idempotencyKey) {
    await this.ensureSchema();
    const rows = await this.sql`
      SELECT 1 FROM purchase_receipts WHERE idempotency_key = ${idempotencyKey} LIMIT 1
    `;
    return rows.length > 0;
  }

  async recordPurchaseReceipt(input) {
    await this.ensureSchema();
    await this.sql`
      WITH ins AS (
        INSERT INTO purchase_receipts (idempotency_key, account_id, product_id, purchase_token, eggs_granted)
        VALUES (${input.idempotencyKey}, ${input.accountId}, ${input.productId}, ${input.purchaseToken}, ${input.eggsGranted})
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING account_id, eggs_granted
      )
      UPDATE accounts SET eggs = accounts.eggs + ins.eggs_granted
      FROM ins WHERE accounts.id = ins.account_id
    `;
  }

  // session token 只存 SHA-256，資料庫外洩也拿不到可用的登入憑證
  async createSession(accountId, token, ttlMs) {
    await this.ensureSchema();
    const tokenHash = sha256Hex(token);
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    const rows = await this.sql`
      INSERT INTO sessions (account_id, token_hash, expires_at)
      VALUES (${accountId}, ${tokenHash}, ${expiresAt})
      RETURNING id, account_id AS "accountId", token_hash AS "tokenHash", expires_at AS "expiresAt", created_at AS "createdAt"
    `;
    const row = rows[0];
    return { ...row, expiresAt: isoOrNull(row.expiresAt), createdAt: isoOrNull(row.createdAt) };
  }

  async findSessionByTokenHash(token) {
    const raw = String(token ?? '').trim();
    if (!raw) return null;
    await this.ensureSchema();
    const rows = await this.sql`
      SELECT id, account_id AS "accountId", token_hash AS "tokenHash", expires_at AS "expiresAt", created_at AS "createdAt"
      FROM sessions
      WHERE token_hash = ${sha256Hex(raw)} AND expires_at > now()
      LIMIT 1
    `;
    const row = rows[0];
    return row ? { ...row, expiresAt: isoOrNull(row.expiresAt), createdAt: isoOrNull(row.createdAt) } : null;
  }

  // 單句 INSERT … ON CONFLICT DO NOTHING 同時擋槽位占用（主鍵）與撞名（lower(name) 唯一索引）
  async insertCharacterRow(accountId, character) {
    const rows = await this.sql`
      INSERT INTO character_slots (account_id, slot, name, data)
      VALUES (${accountId}, ${character.slot}, ${character.name}, ${JSON.stringify(character)}::jsonb)
      ON CONFLICT DO NOTHING
      RETURNING slot
    `;
    if (rows[0]) return { ok: true };
    const occupied = await this.sql`
      SELECT 1 FROM character_slots WHERE account_id = ${accountId} AND slot = ${character.slot}
    `;
    return { ok: false, error: occupied.length > 0 ? 'slot_occupied' : 'name_taken' };
  }

  async getCharacterSlots(account) {
    await this.ensureSchema();
    const rows = await this.sql`
      SELECT slot, data FROM character_slots WHERE account_id = ${account.id} ORDER BY slot
    `;
    const slots = Array.from({ length: 8 }, () => null);
    for (const row of rows) {
      const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      slots[row.slot - 1] = { ...data, slot: row.slot };
    }
    return slots;
  }

  async createCharacter(account, input) {
    const slotIndex = parseSlotIndex(input.slot);
    if (slotIndex < 0) return { ok: false, error: 'invalid_slot' };
    const built = buildNewCharacter(slotIndex, input);
    if (!built.ok) return built;
    await this.ensureSchema();
    const inserted = await this.insertCharacterRow(account.id, built.character);
    if (!inserted.ok) return inserted;
    return { ok: true, character: built.character, slots: await this.getCharacterSlots(account) };
  }

  async importCharacter(account, slot, rawSave) {
    const slotIndex = parseSlotIndex(slot);
    if (slotIndex < 0) return { ok: false, error: 'invalid_slot' };
    const character = buildImportedCharacter(slotIndex, rawSave ?? {});
    await this.ensureSchema();
    const inserted = await this.insertCharacterRow(account.id, character);
    if (!inserted.ok) return inserted;
    return { ok: true, character, slots: await this.getCharacterSlots(account) };
  }

  async deleteCharacter(account, slot, confirmName) {
    const slotIndex = parseSlotIndex(slot);
    if (slotIndex < 0) return { ok: false, error: 'invalid_slot' };
    await this.ensureSchema();
    const rows = await this.sql`
      DELETE FROM character_slots
      WHERE account_id = ${account.id} AND slot = ${slotIndex + 1} AND name = ${String(confirmName ?? '').trim()}
      RETURNING slot
    `;
    if (!rows[0]) {
      const exists = await this.sql`
        SELECT 1 FROM character_slots WHERE account_id = ${account.id} AND slot = ${slotIndex + 1}
      `;
      return { ok: false, error: exists.length > 0 ? 'confirm_name_mismatch' : 'slot_empty' };
    }
    return { ok: true, slots: await this.getCharacterSlots(account) };
  }
}

let singletonRepo = null;

export function getRealmRepository(env = process.env) {
  if (!singletonRepo) {
    // 刻意不讀共用的 DATABASE_URL（那是 127 青雀麻將的資料庫），沒設 LINEAGE_DATABASE_URL 就用記憶體模式
    const dbUrl = (env.LINEAGE_DATABASE_URL ?? '').trim();
    singletonRepo = dbUrl ? new NeonRealmRepository(dbUrl) : new InMemoryRealmRepository();
  }
  return singletonRepo;
}

export function resetDefaultRepository() {
  singletonRepo = new InMemoryRealmRepository();
}

export function getDatabaseMode(env = process.env) {
  const url = (env.LINEAGE_DATABASE_URL ?? '').trim();
  return url.length > 0 ? 'neon-postgres' : 'in-memory';
}

// Binary Pack Slicing & Static Asset Resolution
const MIME_BY_EXT = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  svg: 'image/svg+xml',
  png: 'image/png',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  json: 'application/json; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  woff: 'font/woff',
  woff2: 'font/woff2',
  cur: 'image/x-icon',
  bin: 'application/octet-stream',
};

export function mimeForAssetPath(assetPath) {
  if (assetPath.endsWith('.json.gz')) {
    return 'application/octet-stream';
  }
  const ext = assetPath.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

let cachedManifest = null;

export function getIndexedArtManifest(assetsDir = DEFAULT_ASSETS_DIR) {
  if (cachedManifest && cachedManifest.assetsDir === assetsDir) {
    return cachedManifest;
  }
  const manifestPath = join(assetsDir, 'art-assets.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const byPath = new Map();
  for (const row of manifest.assets) {
    byPath.set(row[0], row);
  }
  cachedManifest = { assetsDir, manifest, byPath };
  return cachedManifest;
}

function readPackSlice(assetsDir, packFile, offset, length) {
  const fullPath = join(assetsDir, 'packs', packFile);
  const fd = openSync(fullPath, 'r');
  try {
    const buffer = Buffer.allocUnsafe(length);
    const bytesRead = readSync(fd, buffer, 0, length, offset);
    if (bytesRead !== length) {
      throw new Error(`Short read from pack ${packFile}: expected ${length}, got ${bytesRead}`);
    }
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  } finally {
    closeSync(fd);
  }
}

export function resolvePackedAsset(rawPathname, assetsDir = DEFAULT_ASSETS_DIR) {
  const normalizedPath = (rawPathname.startsWith('/') ? rawPathname : `/${rawPathname}`).replace(
    /^\/assets\/286(?=\/(?:lineage163|original163|level-up-v1)\/)/,
    '',
  );
  if (normalizedPath.includes('..')) {
    return null;
  }

  // First check if a direct file exists in assets/286
  const directCandidate = join(assetsDir, normalizedPath);
  if (existsSync(directCandidate)) {
    try {
      const buf = readFileSync(directCandidate);
      return {
        bytes: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
        contentType: mimeForAssetPath(normalizedPath),
        sha256Prefix: 'direct-file',
        packFile: 'direct',
      };
    } catch {
      // fall through to pack lookup
    }
  }

  const { manifest, byPath } = getIndexedArtManifest(assetsDir);
  const row = byPath.get(normalizedPath);
  if (row && typeof row[3] === 'number' && typeof row[4] === 'number') {
    const pack = manifest.packs[row[3]];
    if (!pack) {
      return null;
    }
    const bytes = readPackSlice(assetsDir, pack.file, row[4], row[2]);
    return {
      bytes,
      contentType: mimeForAssetPath(normalizedPath),
      sha256Prefix: row[1],
      packFile: pack.file,
    };
  }

  const wholeMapMatch = normalizedPath.match(/^\/lineage163\/maps\/([a-zA-Z0-9_-]+)\.json\.gz$/);
  if (wholeMapMatch) {
    const mapId = wholeMapMatch[1];
    const mapsRow = resolvePackedAsset('/lineage163/maps.json', assetsDir);
    if (mapsRow) {
      const mapsIndex = JSON.parse(Buffer.from(mapsRow.bytes).toString('utf8'));
      const chunks = mapsIndex[mapId];
      if (chunks) {
        const firstChunk = chunks[0]?.[0];
        const sampleChunk = firstChunk
          ? resolvePackedAsset(`/lineage163/maps/${mapId}/${firstChunk}.json.gz`, assetsDir)
          : null;
        if (sampleChunk && chunks.length === 1) {
          return sampleChunk;
        }
        const summary = gzipSync(Buffer.from(JSON.stringify({ mapId, chunks }), 'utf8'));
        return {
          bytes: new Uint8Array(summary),
          contentType: 'application/octet-stream',
          sha256Prefix: 'synthetic-mapidx',
          packFile: 'maps.json',
        };
      }
    }
  }

  return null;
}
