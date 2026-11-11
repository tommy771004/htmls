// 282 普隆德拉大廳的資料：好友、好友邀請、帳號最後用的角色名、玩家檢視資料。
// 兩種實作介面相同、全部同步：
//   sqlStore(exec)  Cloudflare Durable Object 內建的 SQLite（exec = ctx.storage.sql.exec(...).toArray()），資料跟著大廳物件永久保存
//   memoryStore()   本機 npm start 與測試用，重開就清空
// 帳號一律用字串（Neon 的 bigint 會以字串傳來）。
export const FRIEND_MAX = 40; // 同引擎的 Gj
export const ASK_MAX = 20; // 一個人最多同時有幾則沒回的好友邀請

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS friend (a TEXT NOT NULL, b TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (a, b))',
  'CREATE TABLE IF NOT EXISTS friend_ask (src TEXT NOT NULL, dst TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (src, dst))',
  'CREATE INDEX IF NOT EXISTS friend_ask_dst ON friend_ask (dst, at)',
  'CREATE TABLE IF NOT EXISTS player_name (acc TEXT PRIMARY KEY, name TEXT NOT NULL, at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS profile (id INTEGER PRIMARY KEY, p TEXT NOT NULL)',
];

export function sqlStore(exec) {
  for (const q of SCHEMA) exec(q);
  const one = (q, ...p) => exec(q, ...p)[0] ?? null;
  return {
    setName: (acc, name, now) => void exec('INSERT INTO player_name (acc, name, at) VALUES (?, ?, ?) ON CONFLICT (acc) DO UPDATE SET name = excluded.name, at = excluded.at', acc, name, now),
    getName: (acc) => one('SELECT name FROM player_name WHERE acc = ?', acc)?.name ?? null,
    friendsOf: (acc) => exec('SELECT b FROM friend WHERE a = ? ORDER BY at', acc).map((r) => r.b),
    isFriend: (a, b) => !!one('SELECT 1 AS x FROM friend WHERE a = ? AND b = ?', a, b),
    friendCount: (acc) => one('SELECT count(*) AS n FROM friend WHERE a = ?', acc).n,
    addFriend: (a, b, now) => {
      exec('INSERT OR IGNORE INTO friend (a, b, at) VALUES (?, ?, ?)', a, b, now);
      exec('INSERT OR IGNORE INTO friend (a, b, at) VALUES (?, ?, ?)', b, a, now);
    },
    removeFriend: (a, b) => void exec('DELETE FROM friend WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)', a, b, b, a),
    asksTo: (acc) => exec('SELECT src FROM friend_ask WHERE dst = ? ORDER BY at', acc).map((r) => r.src),
    hasAsk: (src, dst) => !!one('SELECT 1 AS x FROM friend_ask WHERE src = ? AND dst = ?', src, dst),
    askCount: (dst) => one('SELECT count(*) AS n FROM friend_ask WHERE dst = ?', dst).n,
    addAsk: (src, dst, now) => void exec('INSERT OR IGNORE INTO friend_ask (src, dst, at) VALUES (?, ?, ?)', src, dst, now),
    delAsk: (src, dst) => void exec('DELETE FROM friend_ask WHERE src = ? AND dst = ?', src, dst),
    setProfile: (id, json) => void exec('INSERT OR REPLACE INTO profile (id, p) VALUES (?, ?)', id, json),
    getProfile: (id) => one('SELECT p FROM profile WHERE id = ?', id)?.p ?? null,
    delProfile: (id) => void exec('DELETE FROM profile WHERE id = ?', id),
    // 大廳物件重啟後，清掉已經不在線上的玩家檢視資料
    keepProfiles: (ids) => {
      const keep = new Set(ids);
      for (const { id } of exec('SELECT id FROM profile')) if (!keep.has(id)) exec('DELETE FROM profile WHERE id = ?', id);
    },
  };
}

export function memoryStore() {
  const names = new Map(); // acc → name
  const friends = new Map(); // acc → Map<acc, at>
  const asks = new Map(); // dst → Map<src, at>
  const profiles = new Map();
  const sorted = (m) => (m ? [...m].sort((x, y) => x[1] - y[1]).map(([k]) => k) : []);
  const edge = (m, a, b, at) => { if (!m.has(a)) m.set(a, new Map()); if (!m.get(a).has(b)) m.get(a).set(b, at); };
  return {
    setName: (acc, name) => void names.set(acc, name),
    getName: (acc) => names.get(acc) ?? null,
    friendsOf: (acc) => sorted(friends.get(acc)),
    isFriend: (a, b) => !!friends.get(a)?.has(b),
    friendCount: (acc) => friends.get(acc)?.size ?? 0,
    addFriend: (a, b, now) => { edge(friends, a, b, now); edge(friends, b, a, now); },
    removeFriend: (a, b) => { friends.get(a)?.delete(b); friends.get(b)?.delete(a); },
    asksTo: (acc) => sorted(asks.get(acc)),
    hasAsk: (src, dst) => !!asks.get(dst)?.has(src),
    askCount: (dst) => asks.get(dst)?.size ?? 0,
    addAsk: (src, dst, now) => edge(asks, dst, src, now),
    delAsk: (src, dst) => void asks.get(dst)?.delete(src),
    setProfile: (id, json) => void profiles.set(id, json),
    getProfile: (id) => profiles.get(id) ?? null,
    delProfile: (id) => void profiles.delete(id),
    keepProfiles: (ids) => { const keep = new Set(ids); for (const id of profiles.keys()) if (!keep.has(id)) profiles.delete(id); },
  };
}
