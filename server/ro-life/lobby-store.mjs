// 282 普隆德拉大廳的資料：好友、好友邀請、帳號最後用的角色名、玩家檢視資料、離線留言、聊天紀錄、檢舉、禁言。
// 兩種實作介面相同、全部同步：
//   sqlStore(exec)  Cloudflare Durable Object 內建的 SQLite（exec = ctx.storage.sql.exec(...).toArray()），資料跟著大廳物件永久保存
//   memoryStore()   本機 npm start 與測試用，重開就清空
// 帳號一律用字串（Neon 的 bigint 會以字串傳來）。
export const FRIEND_MAX = 40; // 同引擎的 Gj
export const ASK_MAX = 20; // 一個人最多同時有幾則沒回的好友邀請
export const OFFLINE_MAX = 50; // 一個人最多累積幾則離線留言
export const OFFLINE_PER_SENDER = 10; // 同一個人最多留給同一個人幾則
export const CHAT_KEEP_MS = 3 * 86_400_000; // 聊天紀錄（檢舉的證據）保留 3 天
// Cloudflare 免費方案每天 10 萬列寫入（刪除也算）；聊天紀錄每則約 2 列（寫入＋3 天後刪除），所以每天最多記這麼多則，超過就不記
export const CHAT_LOG_PER_DAY = 20_000;

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS friend (a TEXT NOT NULL, b TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (a, b))',
  'CREATE TABLE IF NOT EXISTS friend_ask (src TEXT NOT NULL, dst TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (src, dst))',
  'CREATE INDEX IF NOT EXISTS friend_ask_dst ON friend_ask (dst, at)',
  'CREATE TABLE IF NOT EXISTS player_name (acc TEXT PRIMARY KEY, name TEXT NOT NULL, at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS profile (id INTEGER PRIMARY KEY, p TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS offline_msg (id INTEGER PRIMARY KEY AUTOINCREMENT, dst TEXT NOT NULL, src TEXT NOT NULL, src_name TEXT NOT NULL, text TEXT NOT NULL, at INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS offline_msg_dst ON offline_msg (dst)',
  // kind：local／general／trade／cn 是公開聊天，whisper 是密語（dst 是收件帳號）
  'CREATE TABLE IF NOT EXISTS chat_log (id INTEGER PRIMARY KEY AUTOINCREMENT, acc TEXT NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL, dst TEXT, text TEXT NOT NULL, at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS report (id INTEGER PRIMARY KEY AUTOINCREMENT, reporter TEXT NOT NULL, reporter_name TEXT NOT NULL, target TEXT NOT NULL, target_name TEXT NOT NULL, why TEXT NOT NULL, evidence TEXT NOT NULL, status TEXT NOT NULL DEFAULT \'open\', at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS mute (acc TEXT PRIMARY KEY, until INTEGER NOT NULL, reason TEXT NOT NULL, name TEXT NOT NULL, at INTEGER NOT NULL)',
  // 隊伍（lobby-party.mjs）：只在組隊、離隊、換隊長、出發這類事件時寫，不會每則訊息寫
  'CREATE TABLE IF NOT EXISTS party (pid INTEGER PRIMARY KEY, doc TEXT NOT NULL, at INTEGER NOT NULL)',
];
const dayOf = (now) => Math.floor(now / 86_400_000);

export function sqlStore(exec, { chatPerDay = CHAT_LOG_PER_DAY } = {}) {
  for (const q of SCHEMA) exec(q);
  const one = (q, ...p) => exec(q, ...p)[0] ?? null;
  const budget = { day: -1, n: 0 }; // 記在記憶體：物件重啟就重算，最壞多記一些，仍在每日上限內
  let pruned = 0;
  const report = (r) => ({ id: r.id, reporter: r.reporter, reporterName: r.reporter_name, target: r.target, targetName: r.target_name, why: r.why, evidence: JSON.parse(r.evidence), status: r.status, at: r.at });
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
    // 離線留言
    addOffline: (dst, src, srcName, text, at) => void exec('INSERT INTO offline_msg (dst, src, src_name, text, at) VALUES (?, ?, ?, ?, ?)', dst, src, srcName, text, at),
    offlineCount: (dst) => one('SELECT count(*) AS n FROM offline_msg WHERE dst = ?', dst).n,
    offlineFrom: (src, dst) => one('SELECT count(*) AS n FROM offline_msg WHERE dst = ? AND src = ?', dst, src).n,
    takeOffline: (dst) => {
      const rows = exec('SELECT src, src_name, text, at FROM offline_msg WHERE dst = ? ORDER BY id', dst);
      if (rows.length) exec('DELETE FROM offline_msg WHERE dst = ?', dst);
      return rows.map((r) => ({ src: r.src, srcName: r.src_name, text: r.text, at: r.at }));
    },
    dropOffline: (a, b) => void exec('DELETE FROM offline_msg WHERE (dst = ? AND src = ?) OR (dst = ? AND src = ?)', a, b, b, a),
    // 聊天紀錄：只給檢舉當證據，3 天後刪
    logChat: ({ acc, name, kind, dst = null, text, at }) => {
      if (budget.day !== dayOf(at)) Object.assign(budget, { day: dayOf(at), n: 0 });
      if (budget.n >= chatPerDay) return false;
      budget.n++;
      exec('INSERT INTO chat_log (acc, name, kind, dst, text, at) VALUES (?, ?, ?, ?, ?, ?)', acc, name, kind, dst, text, at);
      if (at - pruned > 3_600_000) { pruned = at; exec('DELETE FROM chat_log WHERE at < ?', at - CHAT_KEEP_MS); }
      return true;
    },
    recentChat: (acc, limit = 20) => exec("SELECT name, kind, text, at FROM chat_log WHERE acc = ? AND kind <> 'whisper' ORDER BY id DESC LIMIT ?", acc, limit).reverse(),
    whispersBetween: (a, b, limit = 20) => exec("SELECT acc, name, text, at FROM chat_log WHERE kind = 'whisper' AND ((acc = ? AND dst = ?) OR (acc = ? AND dst = ?)) ORDER BY id DESC LIMIT ?", a, b, b, a, limit).reverse(),
    // 檢舉與禁言
    addReport: (r) => exec('INSERT INTO report (reporter, reporter_name, target, target_name, why, evidence, at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id', r.reporter, r.reporterName, r.target, r.targetName, r.why, JSON.stringify(r.evidence), r.at)[0].id,
    hasReport: (reporter, target, since) => !!one('SELECT 1 AS x FROM report WHERE reporter = ? AND target = ? AND at >= ?', reporter, target, since),
    listReports: (status, limit = 100) => exec('SELECT * FROM report WHERE status = ? ORDER BY id DESC LIMIT ?', status, limit).map(report),
    setReportStatus: (id, status) => exec('UPDATE report SET status = ? WHERE id = ? RETURNING id', status, id).length > 0,
    getMute: (acc, now) => { const r = one('SELECT until, reason FROM mute WHERE acc = ?', acc); return r && r.until > now ? r : null; },
    setMute: (acc, until, reason, name, at) => void exec('INSERT OR REPLACE INTO mute (acc, until, reason, name, at) VALUES (?, ?, ?, ?, ?)', acc, until, reason, name, at),
    delMute: (acc) => exec('DELETE FROM mute WHERE acc = ? RETURNING acc', acc).length > 0,
    listMutes: (now) => exec('SELECT acc, until, reason, name, at FROM mute WHERE until > ? ORDER BY until', now),
    parties: () => exec('SELECT doc FROM party').map((r) => JSON.parse(r.doc)),
    saveParty: (p, at) => void exec('INSERT OR REPLACE INTO party (pid, doc, at) VALUES (?, ?, ?)', p.pid, JSON.stringify(p), at),
    delParty: (pid) => void exec('DELETE FROM party WHERE pid = ?', pid),
  };
}

export function memoryStore() {
  const names = new Map(); // acc → name
  const friends = new Map(); // acc → Map<acc, at>
  const asks = new Map(); // dst → Map<src, at>
  const profiles = new Map();
  const offline = []; // {dst, src, srcName, text, at}
  let chat = []; // {acc, name, kind, dst, text, at}
  const reports = []; // 同 sqlStore 的 report()
  const mutes = new Map(); // acc → {until, reason, name, at}
  const parties = new Map(); // pid → JSON（同 sqlStore，讀回來是新的物件）
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
    addOffline: (dst, src, srcName, text, at) => void offline.push({ dst, src, srcName, text, at }),
    offlineCount: (dst) => offline.filter((o) => o.dst === dst).length,
    offlineFrom: (src, dst) => offline.filter((o) => o.dst === dst && o.src === src).length,
    takeOffline: (dst) => {
      const out = offline.filter((o) => o.dst === dst);
      for (const o of out) offline.splice(offline.indexOf(o), 1);
      return out.map(({ src, srcName, text, at }) => ({ src, srcName, text, at }));
    },
    dropOffline: (a, b) => { for (const o of offline.filter((o) => (o.dst === a && o.src === b) || (o.dst === b && o.src === a))) offline.splice(offline.indexOf(o), 1); },
    logChat: (row) => { chat.push({ dst: null, ...row }); chat = chat.filter((c) => c.at >= row.at - CHAT_KEEP_MS).slice(-5000); return true; },
    recentChat: (acc, limit = 20) => chat.filter((c) => c.acc === acc && c.kind !== 'whisper').slice(-limit).map(({ name, kind, text, at }) => ({ name, kind, text, at })),
    whispersBetween: (a, b, limit = 20) => chat.filter((c) => c.kind === 'whisper' && ((c.acc === a && c.dst === b) || (c.acc === b && c.dst === a))).slice(-limit).map(({ acc, name, text, at }) => ({ acc, name, text, at })),
    addReport: (r) => { const id = reports.length + 1; reports.push({ id, status: 'open', ...r, evidence: JSON.parse(JSON.stringify(r.evidence)) }); return id; },
    hasReport: (reporter, target, since) => reports.some((r) => r.reporter === reporter && r.target === target && r.at >= since),
    listReports: (status, limit = 100) => reports.filter((r) => r.status === status).reverse().slice(0, limit),
    setReportStatus: (id, status) => { const r = reports.find((x) => x.id === id); if (r) r.status = status; return !!r; },
    getMute: (acc, now) => { const m = mutes.get(acc); return m && m.until > now ? { until: m.until, reason: m.reason } : null; },
    setMute: (acc, until, reason, name, at) => void mutes.set(acc, { until, reason, name, at }),
    delMute: (acc) => mutes.delete(acc),
    listMutes: (now) => [...mutes].filter(([, m]) => m.until > now).sort((x, y) => x[1].until - y[1].until).map(([acc, m]) => ({ acc, ...m })),
    parties: () => [...parties.values()].map((j) => JSON.parse(j)),
    saveParty: (p) => void parties.set(p.pid, JSON.stringify(p)),
    delParty: (pid) => void parties.delete(pid),
  };
}
