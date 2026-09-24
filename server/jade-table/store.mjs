import { neon } from '@neondatabase/serverless';

// Optimistic version checks serialize room actions across Vercel instances.
// In-memory rooms are only for local use; production fails closed without Neon.
const memory = new Map();
export class RoomStore {
  constructor() {
    const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
    this.sql = sql ? (...args) => sql(...args).catch(() => { throw Error('牌桌資料庫暫時無法使用，請稍後重試。'); }) : null;
    this.ready = !!this.sql || !process.env.VERCEL;
  }
  async create(code, room) {
    if (!this.ready) throw Error('伺服器尚未設定牌桌資料庫。');
    const value = JSON.stringify(room);
    if (this.sql) {
      const rows = await this.sql`INSERT INTO jade_mahjong_rooms (code, data, expires_at) VALUES (${code}, ${value}::jsonb, now() + interval '2 hours') ON CONFLICT (code) DO UPDATE SET data = EXCLUDED.data, version = jade_mahjong_rooms.version + 1, expires_at = EXCLUDED.expires_at WHERE jade_mahjong_rooms.expires_at < now() RETURNING code`;
      return rows.length > 0;
    }
    for (const [key, value] of memory) if (value.expires < Date.now()) memory.delete(key);
    if (memory.size >= 100) throw Error('本機房間已滿。');
    if (memory.has(code)) return false;
    memory.set(code, { value, version: 0, expires: Date.now() + 7200000 }); return true;
  }
  async transact(code, update) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const entry = memory.get(code);
      const row = this.sql ? (await this.sql`SELECT data, version FROM jade_mahjong_rooms WHERE code = ${code} AND expires_at > now()`)[0] : entry && entry.expires > Date.now() ? { data: JSON.parse(entry.value), version: entry.version } : null;
      if (!row) throw Error('房號不存在或已過期。');
      const room = row.data; update(room); const next = JSON.stringify(room);
      let ok;
      if (this.sql) ok = (await this.sql`UPDATE jade_mahjong_rooms SET data = ${next}::jsonb, version = version + 1, expires_at = now() + interval '2 hours' WHERE code = ${code} AND version = ${row.version} RETURNING code`).length > 0;
      else { ok = memory.get(code)?.version === row.version; if (ok) memory.set(code, { value: next, version: row.version + 1, expires: Date.now() + 7200000 }); }
      if (ok) return room;
    }
    throw Error('牌桌正在同步，請稍後再操作。');
  }
}
