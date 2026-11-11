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
    this.mem = { accounts: new Map(), identities: new Map(), sessions: new Map(), states: new Map(), saves: new Map(), chars: new Map(), items: new Map(), nextId: 2000000 };
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
