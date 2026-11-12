import { neon } from '@neondatabase/serverless';

// 282 帳號與雲端存檔的資料層。有 RO_DATABASE_URL 用 Neon（表格見 schema.sql），
// 刻意不讀共用的 DATABASE_URL：沒設定就不會寫進青雀等其他作品的資料庫。
// 沒有時用記憶體（只給本機開發與測試；在 Vercel 上沒有資料庫就整個關閉）。
export class RoStore {
  constructor(env = process.env) {
    const raw = env.RO_DATABASE_URL ? neon(env.RO_DATABASE_URL) : null;
    this.raw = raw;
    this.sql = raw ? (...args) => raw(...args).catch((e) => { console.warn('[ro-life] db', e.message); throw Error('db'); }) : null;
    this.ready = !!this.sql || !env.VERCEL;
    this.mem = { accounts: new Map(), identities: new Map(), sessions: new Map(), states: new Map(), saves: new Map(), chars: new Map(), items: new Map(), nextId: 2000000, gameSaves: new Map(), gameRuns: new Map(), gameLogs: [], endlessRuns: new Map(), endlessChunks: [], endlessProgress: new Map(), seq: 1 };
  }

  // ---- 線上角色（game.mjs）：存檔、關卡憑證、紀錄 ----
  async gameTablesReady() {
    if (!this.sql) return true;
    const rows = await this.sql`SELECT to_regclass('ro_game_save') IS NOT NULL AND to_regclass('ro_game_run') IS NOT NULL AND to_regclass('ro_game_log') IS NOT NULL AS ok`;
    return rows[0]?.ok === true;
  }
  async getGameSave(accountId) {
    if (this.sql) {
      const rows = await this.sql`SELECT doc, rev, wid, updated_at FROM ro_game_save WHERE account_id = ${accountId}`;
      const r = rows[0];
      return r ? { doc: r.doc, rev: Number(r.rev), wid: r.wid, updatedAt: new Date(r.updated_at).getTime() } : { doc: {}, rev: 0, wid: null, updatedAt: 0 };
    }
    return this.mem.gameSaves.get(accountId) ?? { doc: {}, rev: 0, wid: null, updatedAt: 0 };
  }
  // 寫入存檔；帶 runId 時在同一個語句裡領取憑證：存檔沒寫成（rev 不符）就不會用掉憑證。回傳 {rev, claimed} 或 null（rev 不符）
  async putGameSave(accountId, rev, doc, wid, runId = null) {
    const json = JSON.stringify(doc);
    if (this.sql) {
      const rows = rev === 0
        ? await this.sql`WITH s AS (INSERT INTO ro_game_save (account_id, doc, rev, wid) VALUES (${accountId}, ${json}::jsonb, 1, ${wid}) ON CONFLICT (account_id) DO NOTHING RETURNING rev),
            r AS (UPDATE ro_game_run SET claimed_at = now() WHERE id = ${runId}::text AND account_id = ${accountId} AND claimed_at IS NULL AND EXISTS (SELECT 1 FROM s) RETURNING id)
            SELECT (SELECT rev FROM s) AS rev, (SELECT count(*) FROM r)::int AS claimed`
        : await this.sql`WITH s AS (UPDATE ro_game_save SET doc = ${json}::jsonb, rev = rev + 1, wid = ${wid}, updated_at = now() WHERE account_id = ${accountId} AND rev = ${rev} RETURNING rev),
            r AS (UPDATE ro_game_run SET claimed_at = now() WHERE id = ${runId}::text AND account_id = ${accountId} AND claimed_at IS NULL AND EXISTS (SELECT 1 FROM s) RETURNING id)
            SELECT (SELECT rev FROM s) AS rev, (SELECT count(*) FROM r)::int AS claimed`;
      return rows[0]?.rev == null ? null : { rev: Number(rows[0].rev), claimed: rows[0].claimed > 0 };
    }
    const cur = this.mem.gameSaves.get(accountId)?.rev ?? 0;
    if (cur !== rev) return null;
    this.mem.gameSaves.set(accountId, { doc: JSON.parse(json), rev: rev + 1, wid, updatedAt: Date.now() });
    const r = runId ? this.mem.gameRuns.get(runId) : null;
    const claimed = !!r && r.account_id === accountId && !r.claimed;
    if (claimed) r.claimed = Date.now();
    return { rev: rev + 1, claimed };
  }
  // 交易：兩個帳號的存檔在同一個交易裡各自照 rev 改寫（帳號 id 小的先寫，避免互相等鎖）；
  // 最後一句確認兩邊都寫成了（wid 都是這筆交易），否則除以零讓整個交易回滾。回傳 {revA, revB} 或 null（有一邊 rev 不符）
  async tradeGameSaves(a, b, wid) {
    if (this.sql) {
      const sql = this.raw;
      const [x, y] = String(a.acc) < String(b.acc) ? [a, b] : [b, a];
      const upd = (s) => sql`UPDATE ro_game_save SET doc = ${JSON.stringify(s.doc)}::jsonb, rev = rev + 1, wid = ${wid}, updated_at = now() WHERE account_id = ${s.acc} AND rev = ${s.rev}`;
      try {
        await sql.transaction([
          upd(x),
          upd(y),
          sql`SELECT 1 / (CASE WHEN (SELECT count(*) FROM ro_game_save WHERE account_id IN (${a.acc}, ${b.acc}) AND wid = ${wid}) = 2 THEN 1 ELSE 0 END) AS ok`,
        ]);
      } catch (e) {
        if (/division by zero/i.test(e?.message ?? '')) return null;
        console.warn('[ro-life] db', e?.message);
        throw Error('db');
      }
      return { revA: a.rev + 1, revB: b.rev + 1 };
    }
    const ca = this.mem.gameSaves.get(a.acc), cb = this.mem.gameSaves.get(b.acc);
    if ((ca?.rev ?? 0) !== a.rev || (cb?.rev ?? 0) !== b.rev || !ca || !cb) return null;
    const now = Date.now();
    this.mem.gameSaves.set(a.acc, { doc: structuredClone(a.doc), rev: a.rev + 1, wid, updatedAt: now });
    this.mem.gameSaves.set(b.acc, { doc: structuredClone(b.doc), rev: b.rev + 1, wid, updatedAt: now });
    return { revA: a.rev + 1, revB: b.rev + 1 };
  }
  // ---- 信箱與市場（market.mjs）。改存檔的動作都是一句 SQL：存檔照 rev 改寫只在那一列真的改到時才做，
  // 最後 1 / count(存檔改到的列) —— 0 列就除以零，整句回滾。回傳 null＝rev 不符或那一列已經被別人改了 ----
  async marketTablesReady() {
    if (!this.sql) return true;
    const rows = await this.sql`SELECT to_regclass('ro_game_mail') IS NOT NULL AND to_regclass('ro_market') IS NOT NULL AS ok`;
    return rows[0]?.ok === true;
  }
  async #guarded(run) {
    try { return await run(this.raw); } catch (e) {
      if (/division by zero/i.test(e?.message ?? '')) return null;
      console.warn('[ro-life] db', e?.message);
      throw Error('db');
    }
  }
  #memMail() { return (this.mem.mail ??= []); }
  #memMarket() { return (this.mem.market ??= []); }
  // 過期的上架寄回賣家（開市場或信箱時對自己做一次）
  async marketExpire(accountId, text) {
    if (this.sql) {
      await this.sql`WITH x AS (UPDATE ro_market SET status = 'expired', closed_at = now() WHERE seller_id = ${accountId} AND status = 'open' AND expires_at <= now() RETURNING id, kind, item_id, item, count)
        INSERT INTO ro_game_mail (account_id, kind, title, body, attach, ref)
        SELECT ${accountId}, 'recovered', ${JSON.stringify(text.title)}::jsonb, ${JSON.stringify(text.body)}::jsonb,
          jsonb_build_object('gear', CASE WHEN kind = 'gear' AND item IS NOT NULL THEN jsonb_build_array(item) ELSE '[]'::jsonb END,
            'cards', CASE WHEN kind = 'card' THEN jsonb_build_object(item_id::text, count) ELSE '{}'::jsonb END,
            'ores', CASE WHEN kind = 'ore' THEN jsonb_build_object(item_id::text, count) ELSE '{}'::jsonb END, 'kafra', 0),
          'market-expired-' || id FROM x ON CONFLICT (ref) DO NOTHING`;
      return;
    }
    const now = Date.now();
    for (const l of this.#memMarket()) {
      if (l.seller_id !== accountId || l.status !== 'open' || l.expires_at > now) continue;
      Object.assign(l, { status: 'expired', closed_at: now });
      this.#memSend(accountId, { kind: 'recovered', ...text, attach: { gear: l.kind === 'gear' && l.item ? [l.item] : [], cards: l.kind === 'card' ? { [l.item_id]: l.count } : {}, ores: l.kind === 'ore' ? { [l.item_id]: l.count } : {}, kafra: 0 }, ref: `market-expired-${l.id}` });
    }
  }
  #memSend(accountId, m) {
    const box = this.#memMail();
    if (m.ref && box.some((x) => x.ref === m.ref)) return null;
    const row = { id: (this.mem.mailSeq = (this.mem.mailSeq ?? 0) + 1), account_id: accountId, kind: m.kind ?? 'notice', title: m.title, body: m.body, attach: m.attach ?? null, ref: m.ref ?? null, created_at: Date.now(), read_at: null, claimed_at: null, deleted_at: null };
    box.push(row);
    return row.id;
  }
  async sendMail(accountId, m) {
    if (this.sql) {
      const rows = await this.sql`INSERT INTO ro_game_mail (account_id, kind, title, body, attach, ref) VALUES (${accountId}, ${m.kind ?? 'notice'}, ${JSON.stringify(m.title)}::jsonb, ${JSON.stringify(m.body)}::jsonb, ${m.attach ? JSON.stringify(m.attach) : null}::jsonb, ${m.ref ?? null}) ON CONFLICT (ref) DO NOTHING RETURNING id`;
      return rows[0] ? Number(rows[0].id) : null;
    }
    return this.#memSend(accountId, m);
  }
  async listMail(accountId, limit = 50) {
    if (this.sql) return this.sql`SELECT id, kind, title, body, attach, created_at, read_at, claimed_at FROM ro_game_mail WHERE account_id = ${accountId} AND deleted_at IS NULL ORDER BY id DESC LIMIT ${limit}`;
    return this.#memMail().filter((m) => m.account_id === accountId && !m.deleted_at).sort((a, b) => b.id - a.id).slice(0, limit);
  }
  async getMail(accountId, id) {
    if (this.sql) return (await this.sql`SELECT id, kind, title, body, attach, created_at, read_at, claimed_at FROM ro_game_mail WHERE id = ${id} AND account_id = ${accountId} AND deleted_at IS NULL`)[0] ?? null;
    return this.#memMail().find((m) => m.id === id && m.account_id === accountId && !m.deleted_at) ?? null;
  }
  async readAllMail(accountId) {
    if (this.sql) return void (await this.sql`UPDATE ro_game_mail SET read_at = now() WHERE account_id = ${accountId} AND read_at IS NULL AND deleted_at IS NULL`);
    for (const m of this.#memMail()) if (m.account_id === accountId && !m.read_at) m.read_at = Date.now();
  }
  // 只能刪沒有待領附件的
  async deleteMail(accountId, id) {
    if (this.sql) return (await this.sql`UPDATE ro_game_mail SET deleted_at = now() WHERE id = ${id} AND account_id = ${accountId} AND deleted_at IS NULL AND (attach IS NULL OR claimed_at IS NOT NULL) RETURNING id`).length > 0;
    const m = this.#memMail().find((x) => x.id === id && x.account_id === accountId && !x.deleted_at);
    if (!m || (m.attach && !m.claimed_at)) return false;
    m.deleted_at = Date.now();
    return true;
  }
  // 領信：信件標成已領＋存檔照 rev 改寫，一起成功或一起不做
  async claimMailSave(accountId, id, rev, doc, wid) {
    if (this.sql) {
      return this.#guarded(async (sql) => {
        const rows = await sql`WITH m AS (UPDATE ro_game_mail SET claimed_at = now(), read_at = COALESCE(read_at, now()) WHERE id = ${id} AND account_id = ${accountId} AND claimed_at IS NULL AND deleted_at IS NULL AND attach IS NOT NULL RETURNING id),
          s AS (UPDATE ro_game_save SET doc = ${JSON.stringify(doc)}::jsonb, rev = rev + 1, wid = ${wid}, updated_at = now() WHERE account_id = ${accountId} AND rev = ${rev} AND EXISTS (SELECT 1 FROM m) RETURNING rev)
          SELECT (SELECT rev FROM s) AS rev, 1 / (SELECT count(*) FROM s) AS ok`;
        return { rev: Number(rows[0].rev) };
      });
    }
    const m = this.#memMail().find((x) => x.id === id && x.account_id === accountId && !x.deleted_at && !x.claimed_at && x.attach);
    const cur = this.mem.gameSaves.get(accountId);
    if (!m || !cur || cur.rev !== rev) return null;
    m.claimed_at = Date.now(); m.read_at ??= m.claimed_at;
    this.mem.gameSaves.set(accountId, { doc: structuredClone(doc), rev: rev + 1, wid, updatedAt: Date.now() });
    return { rev: rev + 1 };
  }
  async marketOpenCount(accountId) {
    if (this.sql) return Number((await this.sql`SELECT count(*)::int AS n FROM ro_market WHERE seller_id = ${accountId} AND status = 'open'`)[0].n);
    return this.#memMarket().filter((l) => l.seller_id === accountId && l.status === 'open').length;
  }
  async marketGet(id) {
    if (this.sql) return (await this.sql`SELECT * FROM ro_market WHERE id = ${id}`)[0] ?? null;
    return this.#memMarket().find((l) => l.id === id) ?? null;
  }
  async marketBrowse({ kind, ids, page, size }) {
    if (this.sql) {
      return this.sql`SELECT id, seller_id, seller_name, kind, item_id, item, count, price, status, expires_at FROM ro_market
        WHERE status = 'open' AND expires_at > now() AND (${kind} = '' OR kind = ${kind}) AND (cardinality(${ids}::int[]) = 0 OR item_id = ANY (${ids}::int[]))
        ORDER BY price ASC, id ASC LIMIT ${size + 1} OFFSET ${page * size}`;
    }
    const now = Date.now();
    return this.#memMarket().filter((l) => l.status === 'open' && l.expires_at > now && (!kind || l.kind === kind) && (!ids.length || ids.includes(l.item_id)))
      .sort((a, b) => a.price - b.price || a.id - b.id).slice(page * size, page * size + size + 1);
  }
  async marketMine(accountId) {
    if (this.sql) return this.sql`SELECT id, seller_id, seller_name, kind, item_id, item, count, price, status, expires_at FROM ro_market WHERE seller_id = ${accountId} AND (status = 'open' OR closed_at > now() - interval '7 days') ORDER BY id DESC LIMIT 60`;
    return this.#memMarket().filter((l) => l.seller_id === accountId && (l.status === 'open' || l.closed_at > Date.now() - 7 * 86400_000)).sort((a, b) => b.id - a.id).slice(0, 60);
  }
  // 上架：存檔照 rev 改寫（物品拿出來）＋新增一筆上架
  async marketListSave(accountId, rev, doc, wid, l, sellerName, days) {
    if (this.sql) {
      return this.#guarded(async (sql) => {
        const rows = await sql`WITH s AS (UPDATE ro_game_save SET doc = ${JSON.stringify(doc)}::jsonb, rev = rev + 1, wid = ${wid}, updated_at = now() WHERE account_id = ${accountId} AND rev = ${rev} RETURNING rev),
          l AS (INSERT INTO ro_market (seller_id, seller_name, kind, item_id, item, count, price, expires_at)
            SELECT ${accountId}, ${sellerName}, ${l.kind}, ${l.itemId}, ${l.item ? JSON.stringify(l.item) : null}::jsonb, ${l.count}, ${l.price}, now() + make_interval(days => ${days}) WHERE EXISTS (SELECT 1 FROM s) RETURNING id)
          SELECT (SELECT rev FROM s) AS rev, (SELECT id FROM l) AS id, 1 / (SELECT count(*) FROM l) AS ok`;
        return { rev: Number(rows[0].rev), id: Number(rows[0].id) };
      });
    }
    const cur = this.mem.gameSaves.get(accountId);
    if (!cur || cur.rev !== rev) return null;
    this.mem.gameSaves.set(accountId, { doc: structuredClone(doc), rev: rev + 1, wid, updatedAt: Date.now() });
    const id = (this.mem.marketSeq = (this.mem.marketSeq ?? 0) + 1);
    this.#memMarket().push({ id, seller_id: accountId, seller_name: sellerName, kind: l.kind, item_id: l.itemId, item: l.item, count: l.count, price: l.price, status: 'open', buyer_id: null, created_at: Date.now(), expires_at: Date.now() + days * 86400_000, closed_at: null });
    return { rev: rev + 1, id };
  }
  // 購買：上架改 sold（還開著、沒過期、不是自己的）＋買家存檔照 rev 改寫＋寄信給賣家，一起成功或一起不做
  async marketBuySave(buyerId, id, rev, doc, wid, mail) {
    if (this.sql) {
      return this.#guarded(async (sql) => {
        const rows = await sql`WITH l AS (UPDATE ro_market SET status = 'sold', buyer_id = ${buyerId}, closed_at = now() WHERE id = ${id} AND status = 'open' AND expires_at > now() AND seller_id <> ${buyerId} RETURNING seller_id),
          s AS (UPDATE ro_game_save SET doc = ${JSON.stringify(doc)}::jsonb, rev = rev + 1, wid = ${wid}, updated_at = now() WHERE account_id = ${buyerId} AND rev = ${rev} AND EXISTS (SELECT 1 FROM l) RETURNING rev),
          m AS (INSERT INTO ro_game_mail (account_id, kind, title, body, attach, ref) SELECT l.seller_id, 'gift', ${JSON.stringify(mail.title)}::jsonb, ${JSON.stringify(mail.body)}::jsonb, ${JSON.stringify(mail.attach)}::jsonb, ${mail.ref} FROM l WHERE EXISTS (SELECT 1 FROM s) RETURNING id)
          SELECT (SELECT rev FROM s) AS rev, 1 / (SELECT count(*) FROM m) AS ok`;
        return { rev: Number(rows[0].rev) };
      });
    }
    const l = this.#memMarket().find((x) => x.id === id && x.status === 'open' && x.expires_at > Date.now() && x.seller_id !== buyerId);
    const cur = this.mem.gameSaves.get(buyerId);
    if (!l || !cur || cur.rev !== rev) return null;
    Object.assign(l, { status: 'sold', buyer_id: buyerId, closed_at: Date.now() });
    this.mem.gameSaves.set(buyerId, { doc: structuredClone(doc), rev: rev + 1, wid, updatedAt: Date.now() });
    this.#memSend(l.seller_id, { kind: 'gift', ...mail });
    return { rev: rev + 1 };
  }
  // 取消上架：上架改 cancelled（自己的、還開著）＋存檔照 rev 改寫（物品回來）
  async marketCancelSave(accountId, id, rev, doc, wid) {
    if (this.sql) {
      return this.#guarded(async (sql) => {
        const rows = await sql`WITH l AS (UPDATE ro_market SET status = 'cancelled', closed_at = now() WHERE id = ${id} AND seller_id = ${accountId} AND status = 'open' RETURNING id),
          s AS (UPDATE ro_game_save SET doc = ${JSON.stringify(doc)}::jsonb, rev = rev + 1, wid = ${wid}, updated_at = now() WHERE account_id = ${accountId} AND rev = ${rev} AND EXISTS (SELECT 1 FROM l) RETURNING rev)
          SELECT (SELECT rev FROM s) AS rev, 1 / (SELECT count(*) FROM s) AS ok`;
        return { rev: Number(rows[0].rev) };
      });
    }
    const l = this.#memMarket().find((x) => x.id === id && x.seller_id === accountId && x.status === 'open');
    const cur = this.mem.gameSaves.get(accountId);
    if (!l || !cur || cur.rev !== rev) return null;
    Object.assign(l, { status: 'cancelled', closed_at: Date.now() });
    this.mem.gameSaves.set(accountId, { doc: structuredClone(doc), rev: rev + 1, wid, updatedAt: Date.now() });
    return { rev: rev + 1 };
  }
  // 發新憑證：同一個帳號同時只留一張沒領的。接續中斷的關卡（resume）時，沿用同一關舊憑證的開打時間，不讓秒數被灌大
  async createGameRun(accountId, run, { resume = false } = {}) {
    if (this.sql) {
      await this.sql`DELETE FROM ro_game_run WHERE issued_at < now() - interval '7 days'`;
      const prev = resume ? (await this.sql`SELECT issued_at FROM ro_game_run WHERE account_id = ${accountId} AND stage = ${run.stage} AND claimed_at IS NULL ORDER BY issued_at LIMIT 1`)[0]?.issued_at ?? null : null;
      await this.sql`DELETE FROM ro_game_run WHERE account_id = ${accountId} AND claimed_at IS NULL`;
      await this.sql`INSERT INTO ro_game_run (id, account_id, stage, mult, skip, char, issued_at) VALUES (${run.id}, ${accountId}, ${run.stage}, ${run.mult}, ${run.skip}, ${run.char}, COALESCE(${prev}::timestamptz, now()))`;
      return;
    }
    let issued = Date.now();
    for (const [k, r] of this.mem.gameRuns) {
      if (r.account_id !== accountId || r.claimed) continue;
      if (resume && r.stage === run.stage) issued = Math.min(issued, r.issued);
      this.mem.gameRuns.delete(k);
    }
    this.mem.gameRuns.set(run.id, { ...run, account_id: accountId, issued, claimed: null });
  }
  async countGameRuns(accountId, sec) {
    if (this.sql) {
      const rows = await this.sql`SELECT count(*)::int AS n FROM ro_game_run WHERE account_id = ${accountId} AND issued_at > now() - make_interval(secs => ${sec}::double precision)`;
      return rows[0].n;
    }
    let n = 0;
    for (const r of this.mem.gameRuns.values()) if (r.account_id === accountId && r.issued > Date.now() - sec * 1000) n++;
    return n;
  }
  // ---- 角色名全站唯一（ro_game_name：name_key 是 name-rules.mjs 的 nameKey；表在才啟用，game.mjs 每分鐘查一次）----
  async nameTableReady() {
    if (!this.sql) return true;
    return (await this.sql`SELECT to_regclass('ro_game_name') IS NOT NULL AS ok`)[0]?.ok === true;
  }
  // 這些名字各是哪個帳號登記的 → Map(name_key → account_id)
  async nameOwners(keys) {
    const out = new Map();
    if (!keys.length) return out;
    if (this.sql) { for (const r of await this.sql`SELECT name_key, account_id FROM ro_game_name WHERE name_key = ANY(${keys})`) out.set(r.name_key, Number(r.account_id)); return out; }
    for (const k of keys) { const r = (this.mem.names ??= new Map()).get(k); if (r) out.set(k, r.account_id); }
    return out;
  }
  // 登記名字：沒人用、或本來就是這個帳號的才成功（同一句 SQL，兩個人同時搶只有一個成功）
  async claimName(accountId, charId, key, name) {
    if (this.sql) return (await this.sql`INSERT INTO ro_game_name (name_key, account_id, char_id, name) VALUES (${key}, ${accountId}, ${charId}, ${name})
      ON CONFLICT (name_key) DO UPDATE SET char_id = EXCLUDED.char_id, name = EXCLUDED.name, at = now() WHERE ro_game_name.account_id = EXCLUDED.account_id RETURNING account_id`).length > 0;
    const names = (this.mem.names ??= new Map()), cur = names.get(key);
    if (cur && cur.account_id !== accountId) return false;
    names.set(key, { account_id: accountId, char_id: charId, name, at: Date.now() });
    return true;
  }
  // 存檔後對帳：這個帳號現有角色的名字都登記起來，不再使用的（改名、刪角色）放掉。剛登記的留 10 分鐘（建角時先登記名字、之後才存檔）
  async syncNames(accountId, rows) {
    const keys = rows.map((r) => r.key);
    if (this.sql) await this.sql`DELETE FROM ro_game_name WHERE account_id = ${accountId} AND NOT (name_key = ANY(${keys})) AND at < now() - interval '10 minutes'`;
    else for (const [k, r] of (this.mem.names ??= new Map())) if (r.account_id === accountId && !keys.includes(k) && Date.now() - r.at > 600_000) this.mem.names.delete(k);
    for (const r of rows) await this.claimName(accountId, r.charId, r.key, r.name);
  }
  // 合作關卡的行程收據（coop.mjs）：憑證 id 是「p人數.這一趟的編號.亂數」。同一趟的憑證領過了，那張收據就不能再換一張
  async gameRunTripUsed(accountId, tid) {
    if (this.sql) return (await this.sql`SELECT 1 FROM ro_game_run WHERE account_id = ${accountId} AND claimed_at IS NOT NULL AND id LIKE ${'p_.' + tid + '.%'} LIMIT 1`).length > 0;
    for (const [k, r] of this.mem.gameRuns) if (r.account_id === accountId && r.claimed && /^p\d\./.test(k) && k.split('.')[1] === tid) return true;
    return false;
  }
  // 接續中斷的關卡：同一關還沒領的那張憑證的 id（沿用它的合作關卡前綴）
  async openGameRunId(accountId, stage) {
    if (this.sql) return (await this.sql`SELECT id FROM ro_game_run WHERE account_id = ${accountId} AND stage = ${stage} AND claimed_at IS NULL ORDER BY issued_at LIMIT 1`)[0]?.id ?? null;
    for (const [k, r] of this.mem.gameRuns) if (r.account_id === accountId && !r.claimed && r.stage === stage) return k;
    return null;
  }
  // 查看關卡憑證（不領取，領取在 putGameSave）：ok／unknown（不是這個帳號的、不存在、過期或被新憑證取代）／reused（領過了）
  async peekGameRun(accountId, id) {
    if (this.sql) {
      const r = (await this.sql`SELECT stage, mult, skip, char, issued_at, claimed_at FROM ro_game_run WHERE id = ${id} AND account_id = ${accountId}`)[0];
      if (!r) return { status: 'unknown' };
      if (r.claimed_at) return { status: 'reused' };
      return { status: 'ok', run: { id, stage: r.stage, mult: Number(r.mult), skip: r.skip, char: r.char, issued: new Date(r.issued_at).getTime() } };
    }
    const r = this.mem.gameRuns.get(id);
    if (!r || r.account_id !== accountId) return { status: 'unknown' };
    if (r.claimed) return { status: 'reused' };
    return { status: 'ok', run: { id, stage: r.stage, mult: r.mult, skip: r.skip, char: r.char, issued: r.issued } };
  }
  async addGameLog(accountId, kind, { rev = null, runId = null, flags = [], detail = null } = {}) {
    if (this.sql) {
      await this.sql`INSERT INTO ro_game_log (account_id, kind, rev, run_id, flags, detail) VALUES (${accountId}, ${kind}, ${rev}, ${runId}, ${flags}, ${detail === null ? null : JSON.stringify(detail)}::jsonb)`;
      return;
    }
    this.mem.gameLogs.push({ account_id: accountId, at: Date.now(), kind, rev, run_id: runId, flags, detail });
    if (this.mem.gameLogs.length > 2000) this.mem.gameLogs.splice(0, 1000);
  }

  // ---- 無盡之塔（endless.mjs）：每場的開局快照與操作、塔的進度；驗證（tools/verify-endless.mjs）也用這幾個方法 ----
  async endlessTablesReady() {
    if (!this.sql) return true;
    const rows = await this.sql`SELECT to_regclass('ro_endless_run') IS NOT NULL AND to_regclass('ro_endless_chunk') IS NOT NULL AND to_regclass('ro_endless_progress') IS NOT NULL AS ok`;
    return rows[0]?.ok === true;
  }
  async getEndlessProgress(accountId, charId) {
    if (this.sql) return (await this.sql`SELECT data FROM ro_endless_progress WHERE account_id = ${accountId} AND char_id = ${charId}`)[0]?.data ?? null;
    return structuredClone(this.mem.endlessProgress.get(`${accountId}:${charId}`) ?? null);
  }
  // 照讀到的那一版改（prev 是 null 表示原本沒有）；被別的請求搶先改了回 false
  async casEndlessProgress(accountId, charId, prev, next) {
    const json = JSON.stringify(next);
    if (this.sql) {
      const rows = prev === null
        ? await this.sql`INSERT INTO ro_endless_progress (account_id, char_id, data) VALUES (${accountId}, ${charId}, ${json}::jsonb) ON CONFLICT DO NOTHING RETURNING 1`
        : await this.sql`UPDATE ro_endless_progress SET data = ${json}::jsonb, updated_at = now() WHERE account_id = ${accountId} AND char_id = ${charId} AND data = ${JSON.stringify(prev)}::jsonb RETURNING 1`;
      return rows.length > 0;
    }
    const k = `${accountId}:${charId}`, cur = this.mem.endlessProgress.get(k) ?? null;
    if (JSON.stringify(cur) !== JSON.stringify(prev)) return false;
    this.mem.endlessProgress.set(k, JSON.parse(json));
    return true;
  }
  static endlessRow(r) {
    return { id: r.id, accountId: Number(r.account_id), charId: r.char_id, build: r.build, engine: r.engine, seed: Number(r.seed), wave: r.wave, last: r.last, snapshot: r.snapshot, season: r.season, state: r.state, status: r.status, ticks: r.ticks, checks: r.checks, picks: r.picks ?? [], claim: r.claim, cut: r.cut, resumed: r.resumed, startedAt: new Date(r.started_at).getTime(), updatedAt: new Date(r.updated_at).getTime(), name: r.name, job: r.job, score: r.score, floor: r.floor, verdict: r.verdict };
  }
  // 開新的一場：同帳號還開著或存著的那場一律結束（有操作的等驗證）
  async createEndlessRun(accountId, run) {
    if (this.sql) {
      await this.sql`UPDATE ro_endless_run SET state = 'ended', status = CASE WHEN ticks > 0 THEN 'pending' ELSE 'empty' END, ended_at = now(), updated_at = now() WHERE account_id = ${accountId} AND state IN ('live', 'suspended')`;
      await this.sql`INSERT INTO ro_endless_run (id, account_id, char_id, build, engine, seed, wave, last, snapshot, season, name, job) VALUES (${run.id}, ${accountId}, ${run.charId}, ${run.build}, ${run.engine}, ${run.seed}, ${run.wave}, ${run.last}, ${JSON.stringify(run.snapshot)}::jsonb, ${run.season}, ${run.name}, ${run.job})`;
      return;
    }
    for (const r of this.mem.endlessRuns.values()) if (r.account_id === accountId && (r.state === 'live' || r.state === 'suspended')) Object.assign(r, { state: 'ended', status: r.ticks > 0 ? 'pending' : 'empty', updated_at: Date.now() });
    const now = Date.now();
    this.mem.endlessRuns.set(run.id, { id: run.id, account_id: accountId, char_id: run.charId, build: run.build, engine: run.engine, seed: run.seed, wave: run.wave, last: run.last, snapshot: structuredClone(run.snapshot), season: run.season, name: run.name, job: run.job, state: 'live', status: null, ticks: 0, checks: 0, picks: [], claim: null, cut: null, resumed: false, started_at: now, updated_at: now, score: null, floor: null, verdict: null });
  }
  async countEndlessRuns(accountId, sec) {
    if (this.sql) return (await this.sql`SELECT count(*)::int AS n FROM ro_endless_run WHERE account_id = ${accountId} AND started_at > now() - make_interval(secs => ${sec}::double precision)`)[0].n;
    let n = 0;
    for (const r of this.mem.endlessRuns.values()) if (r.account_id === accountId && r.started_at > Date.now() - sec * 1000) n++;
    return n;
  }
  async getEndlessRun(accountId, id) {
    if (this.sql) {
      const r = (await this.sql`SELECT * FROM ro_endless_run WHERE id = ${id} AND (account_id = ${accountId} OR ${accountId}::bigint IS NULL)`)[0];
      return r ? RoStore.endlessRow(r) : null;
    }
    const r = this.mem.endlessRuns.get(id);
    return r && (accountId === null || r.account_id === accountId) ? RoStore.endlessRow(structuredClone(r)) : null;
  }
  // 接一段操作：伺服器的進度要剛好等於這段的起點（at、from），否則回 false
  async appendEndless(accountId, id, { at, from, runs, checks, ticks, checksTo, picks, claim }) {
    if (this.sql) {
      const rows = await this.sql`WITH r AS (UPDATE ro_endless_run SET ticks = ${ticks}, checks = ${checksTo}, picks = COALESCE(${picks === null ? null : JSON.stringify(picks)}::jsonb, picks), claim = COALESCE(${claim === null ? null : JSON.stringify(claim)}::jsonb, claim), updated_at = now()
          WHERE id = ${id} AND account_id = ${accountId} AND state = 'live' AND ticks = ${at} AND checks = ${from} RETURNING id)
        INSERT INTO ro_endless_chunk (run_id, at, runs, from_check, checks) SELECT id, ${at}, ${JSON.stringify(runs)}::jsonb, ${from}, ${JSON.stringify(checks)}::jsonb FROM r RETURNING seq`;
      return rows.length > 0;
    }
    const r = this.mem.endlessRuns.get(id);
    if (!r || r.account_id !== accountId || r.state !== 'live' || r.ticks !== at || r.checks !== from) return false;
    Object.assign(r, { ticks, checks: checksTo, updated_at: Date.now() });
    if (picks !== null) r.picks = [...picks];
    if (claim !== null) r.claim = { ...claim };
    this.mem.endlessChunks.push({ seq: this.mem.seq++, run_id: id, at, runs: [...runs], from, checks: [...checks] });
    return true;
  }
  async endlessChunks(id) {
    if (this.sql) return (await this.sql`SELECT at, runs, from_check, checks FROM ro_endless_chunk WHERE run_id = ${id} ORDER BY seq`).map((c) => ({ at: c.at, runs: c.runs, from: c.from_check, checks: c.checks ?? [] }));
    return this.mem.endlessChunks.filter((c) => c.run_id === id).map((c) => structuredClone(c));
  }
  // 狀態要是 from 才改（live → ended／suspended）
  async setEndlessState(accountId, id, from, { state, status = null, claim = null, cut = null, verdict = null }) {
    if (this.sql) {
      const rows = await this.sql`UPDATE ro_endless_run SET state = ${state}, status = COALESCE(${status}, status), claim = COALESCE(${claim === null ? null : JSON.stringify(claim)}::jsonb, claim), cut = COALESCE(${cut}, cut), verdict = COALESCE(${verdict === null ? null : JSON.stringify(verdict)}::jsonb, verdict),
          ended_at = CASE WHEN ${state} = 'ended' THEN now() ELSE ended_at END, updated_at = now() WHERE id = ${id} AND account_id = ${accountId} AND state = ${from} RETURNING 1`;
      return rows.length > 0;
    }
    const r = this.mem.endlessRuns.get(id);
    if (!r || r.account_id !== accountId || r.state !== from) return false;
    Object.assign(r, { state, updated_at: Date.now() });
    if (status !== null) r.status = status;
    if (claim !== null) r.claim = { ...claim };
    if (cut !== null) r.cut = cut;
    if (verdict !== null) r.verdict = verdict;
    return true;
  }
  // 接續存起來的那場（只能一次）：進度退回切點
  async restoreEndlessRun(accountId, id, { ticks, checks, picks }) {
    if (this.sql) {
      const rows = await this.sql`UPDATE ro_endless_run SET state = 'live', resumed = true, ticks = ${ticks}, checks = ${checks}, picks = ${JSON.stringify(picks)}::jsonb, updated_at = now() WHERE id = ${id} AND account_id = ${accountId} AND state = 'suspended' AND NOT resumed RETURNING 1`;
      return rows.length > 0;
    }
    const r = this.mem.endlessRuns.get(id);
    if (!r || r.account_id !== accountId || r.state !== 'suspended' || r.resumed) return false;
    Object.assign(r, { state: 'live', resumed: true, ticks, checks, picks: [...picks], updated_at: Date.now() });
    return true;
  }
  async endlessSuspended(accountId, charId, maxAgeMs) {
    if (this.sql) {
      const r = (await this.sql`SELECT * FROM ro_endless_run WHERE account_id = ${accountId} AND char_id = ${charId} AND state = 'suspended' AND NOT resumed AND updated_at > now() - make_interval(secs => ${maxAgeMs / 1000}::double precision) ORDER BY updated_at DESC LIMIT 1`)[0];
      return r ? RoStore.endlessRow(r) : null;
    }
    const r = [...this.mem.endlessRuns.values()].filter((x) => x.account_id === accountId && x.char_id === charId && x.state === 'suspended' && !x.resumed && x.updated_at > Date.now() - maxAgeMs).sort((a, b) => b.updated_at - a.updated_at)[0];
    return r ? RoStore.endlessRow(structuredClone(r)) : null;
  }
  async endlessBestScore(accountId, charId) {
    if (this.sql) return Number((await this.sql`SELECT max(score) AS s FROM ro_endless_run WHERE account_id = ${accountId} AND char_id = ${charId} AND status = 'verified'`)[0]?.s ?? 0);
    let best = 0;
    for (const r of this.mem.endlessRuns.values()) if (r.account_id === accountId && r.char_id === charId && r.status === 'verified') best = Math.max(best, r.score ?? 0);
    return best;
  }
  // 這個角色還在等驗證的場次與自報的點數（守護者面板顯示「N 場待檢查（+點數）」）
  async endlessPendingFor(accountId, charId) {
    if (this.sql) {
      const r = (await this.sql`SELECT count(*)::int AS n, COALESCE(sum((claim->>'points')::int), 0)::int AS p FROM ro_endless_run WHERE account_id = ${accountId} AND char_id = ${charId} AND (status = 'pending' OR (state = 'live' AND ticks > 0))`)[0];
      return { runs: r.n, points: r.p };
    }
    let runs = 0, points = 0;
    for (const r of this.mem.endlessRuns.values()) if (r.account_id === accountId && r.char_id === charId && (r.status === 'pending' || (r.state === 'live' && r.ticks > 0))) { runs++; points += r.claim?.points ?? 0; }
    return { runs, points };
  }
  // 排行榜：該月、該職業，每個角色只取最高分
  async endlessLadder(season, job, accountId, limit) {
    let best;
    if (this.sql) {
      best = await this.sql`SELECT DISTINCT ON (account_id, char_id) account_id, char_id, name, job, score, floor FROM ro_endless_run
        WHERE status = 'verified' AND (${season} = 'all' OR season = ${season}) AND (${job} = '' OR job = ${job}) ORDER BY account_id, char_id, score DESC, floor DESC, verified_at`;
    } else {
      const m = new Map();
      for (const r of this.mem.endlessRuns.values()) {
        if (r.status !== 'verified' || (season !== 'all' && r.season !== season) || (job && r.job !== job)) continue;
        const k = `${r.account_id}:${r.char_id}`;
        const o = m.get(k);
        if (!o || o.score < r.score || (o.score === r.score && o.floor < r.floor)) m.set(k, r);
      }
      best = [...m.values()];
    }
    const all = best.map((r) => ({ name: r.name, job: r.job, score: Number(r.score), wave: r.floor, mine: Number(r.account_id) === accountId }))
      .sort((a, b) => b.score - a.score || b.wave - a.wave).map((r, i) => ({ rank: i + 1, ...r }));
    return { rows: all.slice(0, limit), me: all.filter((r) => r.mine) };
  }
  // 驗證程式：要重跑的（結束的 pending、一小時沒動靜的 live、存了 7 天沒接續的 suspended）
  async endlessPending(limit = 20) {
    if (this.sql) return (await this.sql`SELECT * FROM ro_endless_run WHERE status = 'pending' OR (ticks > 0 AND status IS NULL AND ((state = 'live' AND updated_at < now() - interval '1 hour') OR (state = 'suspended' AND updated_at < now() - interval '7 days'))) ORDER BY updated_at LIMIT ${limit}`).map(RoStore.endlessRow);
    const now = Date.now();
    return [...this.mem.endlessRuns.values()].filter((r) => r.status === 'pending' || (r.ticks > 0 && r.status === null && ((r.state === 'live' && r.updated_at < now - 3600_000) || (r.state === 'suspended' && r.updated_at < now - 7 * 86400_000)))).map((r) => RoStore.endlessRow(structuredClone(r)));
  }
  // 寫下驗證結果；verified 時把塔的點數、最高樓層加到角色的塔進度（同一場只會加一次：status 必須還沒驗證過）
  async endlessVerdict(id, { status, verdict, score = null, floor = null, points = 0, best = 0 }) {
    if (this.sql) {
      // 同一個語句：場次改成驗證結果，verified 時一併把點數加進塔的進度（不會只做一半）
      const rows = await this.sql`WITH r AS (UPDATE ro_endless_run SET status = ${status}, verdict = ${JSON.stringify(verdict)}::jsonb, score = ${score}, floor = ${floor}, verified_at = now(),
            state = 'ended', ended_at = COALESCE(ended_at, now()) WHERE id = ${id} AND (status IS NULL OR status = 'pending') RETURNING account_id, char_id),
          g AS (INSERT INTO ro_endless_progress AS p (account_id, char_id, data)
            SELECT account_id, char_id, jsonb_build_object('earned', ${points}::int, 'best', ${best}::int, 'reached', ${best + 1}::int) FROM r WHERE ${status} = 'verified'
            ON CONFLICT (account_id, char_id) DO UPDATE SET updated_at = now(), data = p.data
              || jsonb_build_object('earned', COALESCE((p.data->>'earned')::int, 0) + ${points}::int)
              || jsonb_build_object('best', GREATEST(COALESCE((p.data->>'best')::int, 0), ${best}::int))
              || jsonb_build_object('reached', GREATEST(COALESCE((p.data->>'reached')::int, 1), ${best + 1}::int))
            RETURNING 1)
        SELECT (SELECT count(*) FROM r)::int AS n, (SELECT count(*) FROM g)::int AS g`;
      return rows[0].n > 0;
    }
    const r = this.mem.endlessRuns.get(id);
    if (!r || (r.status !== null && r.status !== 'pending')) return false;
    Object.assign(r, { status, verdict, score, floor, state: 'ended', verified_at: Date.now() });
    if (status === 'verified') {
      const k = `${r.account_id}:${r.char_id}`, p = this.mem.endlessProgress.get(k) ?? {};
      this.mem.endlessProgress.set(k, { ...p, earned: (p.earned ?? 0) + points, best: Math.max(p.best ?? 0, best), reached: Math.max(p.reached ?? 1, best + 1) });
    }
    return true;
  }

  // 第三方身分 → 帳號；第一次登入就建立帳號
  async loginIdentity(provider, subject, name) {
    name = String(name || 'Adventurer').slice(0, 24);
    if (this.sql) {
      const found = await this.sql`UPDATE ro_login_identity SET last_login = now(), display_name = ${name} WHERE provider = ${provider} AND subject = ${subject} RETURNING account_id`;
      let id = found[0]?.account_id;
      if (!id) {
        const acc = await this.sql`INSERT INTO ro_login (userid) VALUES (${name}) RETURNING account_id`;
        id = acc[0].account_id;
        // 兩個分頁同時第一次登入：輸的那邊改用先寫入的帳號，自己剛建的空帳號刪掉
        const ins = await this.sql`INSERT INTO ro_login_identity (provider, subject, account_id, display_name) VALUES (${provider}, ${subject}, ${id}, ${name}) ON CONFLICT DO NOTHING RETURNING account_id`;
        if (!ins.length) {
          await this.sql`DELETE FROM ro_login WHERE account_id = ${id}`;
          id = (await this.sql`SELECT account_id FROM ro_login_identity WHERE provider = ${provider} AND subject = ${subject}`)[0].account_id;
        }
      }
      await this.sql`UPDATE ro_login SET logincount = logincount + 1, lastlogin = now() WHERE account_id = ${id}`;
      return Number(id);
    }
    const key = `${provider}:${subject}`;
    let id = this.mem.identities.get(key)?.account_id;
    if (!id) {
      id = this.mem.nextId++;
      this.mem.accounts.set(id, { account_id: id, userid: name, state: 0, unban_time: null, logincount: 0 });
      this.mem.identities.set(key, { provider, subject, account_id: id, display_name: name });
    }
    this.mem.accounts.get(id).logincount++;
    return id;
  }

  async account(id) {
    if (this.sql) {
      const rows = await this.sql`SELECT a.account_id, a.userid, a.state, a.unban_time, COALESCE(array_agg(i.provider) FILTER (WHERE i.provider IS NOT NULL), '{}') AS providers
        FROM ro_login a LEFT JOIN ro_login_identity i USING (account_id) WHERE a.account_id = ${id} GROUP BY a.account_id`;
      const r = rows[0];
      return r ? { id: Number(r.account_id), name: r.userid, state: r.state, unbanTime: r.unban_time ? new Date(r.unban_time).getTime() : null, providers: r.providers } : null;
    }
    const a = this.mem.accounts.get(id);
    if (!a) return null;
    const providers = [...this.mem.identities.values()].filter((i) => i.account_id === id).map((i) => i.provider);
    return { id, name: a.userid, state: a.state, unbanTime: a.unban_time, providers };
  }

  // 一次性紀錄：OAuth state 與登入代碼
  async putState(row, ttlSec) {
    const expires = new Date(Date.now() + ttlSec * 1000);
    if (this.sql) {
      await this.sql`DELETE FROM ro_auth_state WHERE expires_at < now()`;
      await this.sql`INSERT INTO ro_auth_state (id, kind, provider, verifier, nonce, return_to, account_id, expires_at)
        VALUES (${row.id}, ${row.kind}, ${row.provider}, ${row.verifier ?? null}, ${row.nonce ?? null}, ${row.return_to ?? null}, ${row.account_id ?? null}, ${expires})`;
      return;
    }
    for (const [k, v] of this.mem.states) if (v.expires < Date.now()) this.mem.states.delete(k);
    this.mem.states.set(row.id, { ...row, expires: expires.getTime() });
  }
  async takeState(id, kind) {
    if (this.sql) {
      const rows = await this.sql`DELETE FROM ro_auth_state WHERE id = ${id} AND kind = ${kind} RETURNING *, expires_at > now() AS live`;
      const r = rows[0];
      return r?.live ? { ...r, account_id: r.account_id == null ? null : Number(r.account_id) } : null;
    }
    const r = this.mem.states.get(id);
    this.mem.states.delete(id);
    return r && r.kind === kind && r.expires > Date.now() ? r : null;
  }

  async createSession(hash, accountId, ttlSec) {
    const expires = new Date(Date.now() + ttlSec * 1000);
    if (this.sql) {
      await this.sql`DELETE FROM ro_session WHERE expires_at < now()`;
      await this.sql`INSERT INTO ro_session (token_hash, account_id, expires_at) VALUES (${hash}, ${accountId}, ${expires})`;
      return;
    }
    this.mem.sessions.set(hash, { account_id: accountId, expires: expires.getTime() });
  }
  async sessionAccount(hash) {
    if (this.sql) {
      const rows = await this.sql`SELECT account_id FROM ro_session WHERE token_hash = ${hash} AND expires_at > now()`;
      return rows[0] ? Number(rows[0].account_id) : null;
    }
    const s = this.mem.sessions.get(hash);
    return s && s.expires > Date.now() ? s.account_id : null;
  }
  async deleteSession(hash) {
    if (this.sql) await this.sql`DELETE FROM ro_session WHERE token_hash = ${hash}`;
    else this.mem.sessions.delete(hash);
  }

  async getSave(accountId) {
    if (this.sql) {
      const rows = await this.sql`SELECT doc, rev, updated_at FROM ro_save WHERE account_id = ${accountId}`;
      const r = rows[0];
      return r ? { doc: r.doc, rev: Number(r.rev), updatedAt: new Date(r.updated_at).getTime() } : { doc: {}, rev: 0, updatedAt: 0 };
    }
    return this.mem.saves.get(accountId) ?? { doc: {}, rev: 0, updatedAt: 0 };
  }

  // 以 rev 做樂觀鎖寫入；成功回傳新的 rev，別的裝置先寫了就回 null
  async putSave(accountId, rev, doc, projection) {
    const json = JSON.stringify(doc);
    if (this.sql) {
      let rows;
      if (rev === 0) rows = await this.sql`INSERT INTO ro_save (account_id, doc, rev) VALUES (${accountId}, ${json}::jsonb, 1) ON CONFLICT (account_id) DO NOTHING RETURNING rev`;
      else rows = await this.sql`UPDATE ro_save SET doc = ${json}::jsonb, rev = rev + 1, updated_at = now() WHERE account_id = ${accountId} AND rev = ${rev} RETURNING rev`;
      if (!rows.length) return null;
      const next = Number(rows[0].rev);
      if (projection) await this.#project(accountId, next, projection);
      return next;
    }
    const cur = this.mem.saves.get(accountId)?.rev ?? 0;
    if (cur !== rev) return null;
    this.mem.saves.set(accountId, { doc: JSON.parse(json), rev: rev + 1, updatedAt: Date.now() });
    if (projection) {
      this.mem.chars.set(accountId, projection.chars);
      this.mem.items.set(accountId, projection.items);
    }
    return rev + 1;
  }

  // 投影：每個語句都先確認存檔還是這個 rev，避免較舊的寫入蓋掉較新的投影
  async #project(accountId, rev, { chars, items }) {
    const sql = this.raw;
    const c = JSON.stringify(chars), it = JSON.stringify(items);
    try {
      await sql.transaction([
        sql`DELETE FROM ro_char WHERE account_id = ${accountId} AND EXISTS (SELECT 1 FROM ro_save s WHERE s.account_id = ${accountId} AND s.rev = ${rev}) AND game_id <> ALL (SELECT x.game_id FROM jsonb_to_recordset(${c}::jsonb) AS x(game_id text))`,
        sql`INSERT INTO ro_char (account_id, game_id, char_num, name, class, base_level, job_level, base_exp, job_exp, str, agi, vit, "int", dex, luk, sex, hair, hair_color, clothes_color, created_at)
          SELECT ${accountId}, x.game_id, x.char_num, x.name, x.class, x.base_level, x.job_level, x.base_exp, x.job_exp, x.str, x.agi, x.vit, x."int", x.dex, x.luk, x.sex, x.hair, x.hair_color, x.clothes_color, to_timestamp(x.created_at / 1000.0)
          FROM jsonb_to_recordset(${c}::jsonb) AS x(game_id text, char_num smallint, name text, class text, base_level smallint, job_level smallint, base_exp bigint, job_exp bigint, str smallint, agi smallint, vit smallint, "int" smallint, dex smallint, luk smallint, sex char(1), hair smallint, hair_color smallint, clothes_color smallint, created_at double precision)
          WHERE EXISTS (SELECT 1 FROM ro_save s WHERE s.account_id = ${accountId} AND s.rev = ${rev})
          ON CONFLICT (account_id, game_id) DO UPDATE SET char_num = EXCLUDED.char_num, name = EXCLUDED.name, class = EXCLUDED.class, base_level = EXCLUDED.base_level, job_level = EXCLUDED.job_level,
            base_exp = EXCLUDED.base_exp, job_exp = EXCLUDED.job_exp, str = EXCLUDED.str, agi = EXCLUDED.agi, vit = EXCLUDED.vit, "int" = EXCLUDED."int", dex = EXCLUDED.dex, luk = EXCLUDED.luk,
            sex = EXCLUDED.sex, hair = EXCLUDED.hair, hair_color = EXCLUDED.hair_color, clothes_color = EXCLUDED.clothes_color, updated_at = now()`,
        sql`DELETE FROM ro_inventory WHERE account_id = ${accountId} AND EXISTS (SELECT 1 FROM ro_save s WHERE s.account_id = ${accountId} AND s.rev = ${rev})`,
        sql`INSERT INTO ro_inventory (account_id, kind, uid, nameid, amount, refine, card0, card1, card2, card3, quality, tier, ilvl, affixes, bound_char, char_id, equip)
          SELECT ${accountId}, x.kind, x.uid, COALESCE(x.nameid, 0), COALESCE(x.amount, 1), COALESCE(x.refine, 0), x.card0, x.card1, x.card2, x.card3, x.quality, x.tier, x.ilvl, x.affixes, x.bound_char, c.char_id, x.equip
          FROM jsonb_to_recordset(${it}::jsonb) AS x(kind text, uid text, nameid integer, amount integer, refine smallint, card0 integer, card1 integer, card2 integer, card3 integer, quality smallint, tier smallint, ilvl smallint, affixes jsonb, bound_char text, equip_char text, equip text)
          LEFT JOIN ro_char c ON c.account_id = ${accountId} AND c.game_id = x.equip_char
          WHERE EXISTS (SELECT 1 FROM ro_save s WHERE s.account_id = ${accountId} AND s.rev = ${rev})`,
      ]);
    } catch (e) {
      // 投影只是方便查詢；失敗不影響存檔本身
      console.warn('[ro-life] projection', e.message);
    }
  }
}
