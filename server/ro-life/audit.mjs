// 282 事後稽核（唯讀）：從 ro_game_log／ro_game_run 算出經濟產出、行為特徵與值得人工看的帳號。
// 這裡只有純函式與兩句 SELECT；命令列工具在 games/282-ro-life/tools/audit-activity.mjs（擁有者自己對正式站跑）。
// 不改任何資料：停權由工具印出 SQL，擁有者看過再自己執行。
//
// 資料來源（game.mjs 寫進 ro_game_log.detail 的東西）：
//   kind=save  addedCount（這次存檔新增的物品數）、cards／materials／kafra［前, 後］、fix［{code, fixed:false 表示只記錄}］
//   kind=op    op=sell 的 gained（賣出拿到的 Kafra）、op=buy 的 cost（買礦花的 Kafra）、op=towerReset（固定 500）、
//              marketBuy 的 price（玩家之間轉手，不算產出）
//   ro_game_run 每張關卡憑證的 issued_at／claimed_at（只留 7 天，所以行為特徵最多看 7 天）
//
// 門檻全部是「還沒用正式站資料對過」的估計值（2026-11-12 正式站 0 筆）：超過只代表值得看，不代表作弊。

export const DEFAULTS = {
  kafraPerHour: 300_000, // 一小時賣出拿到的 Kafra
  itemsPerHour: 80, // 一小時新增的物品數（伺服器上限：10 分鐘單人約 11 件）
  cardsPerHour: 20, // 一小時新增的卡片數（上限：10 分鐘約 7 張，實際掉率是萬分之一）
  runsPerHour: 45, // 一小時領的關卡憑證數（伺服器上限 60）
  hoursPerDay: 18, // 一天裡有幾個小時在打
  streakHours: 14, // 連續幾個小時每小時都有打
  regularCv: 0.05, // 每場間隔的變異係數（標準差／平均）低於這個數＝太規律
  regularMin: 20, // 至少幾場才看規律
  softFixes: 10, // 「只記錄」的疑點累積幾次
};
// 停權 SQL 的分數門檻：比「值得看」（--min-score 5）高很多。一次存檔被改回（不管幾處，5 分）或只有行為特徵（最多 10 分）都不到，
// 要好幾種疑點疊在一起才會產生 UPDATE；要放寬請明講 --ban-min-score。
export const BAN_SCORE = 15;
// 名字審核的修正不是作弊（取了不能用的名字、或名字被別人先登記），不算分，只在別的理由旁邊附註
const MODERATION = new Set(['name']);
export const WEIGHTS = { fixed: 5, soft: 1, kafra: 3, items: 3, cards: 3, runs: 2, hours: 2, streak: 2, regular: 4, flag: 1 };

const HOUR = 3_600_000, DAY = 86_400_000;
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : 0);
const ms = (v) => { const t = v instanceof Date ? v.getTime() : typeof v === 'number' ? v : Date.parse(v); return Number.isFinite(t) ? t : NaN; };
const obj = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return {}; } } return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; };
const pair = (v) => (Array.isArray(v) && v.length === 2 ? [num(v[0]), num(v[1])] : null);
const up = (v) => { const p = pair(v); return p ? Math.max(0, p[1] - p[0]) : 0; };
const down = (v) => { const p = pair(v); return p ? Math.max(0, p[0] - p[1]) : 0; };
const add = (map, key, field, n) => { if (!n) return; let o = map.get(key); if (!o) map.set(key, (o = {})); o[field] = (o[field] ?? 0) + n; };
const iso = (t, len) => new Date(t).toISOString().slice(0, len);

// 經濟：全站每天的產出與消耗，以及每個帳號最高的一小時
export function economy(logs) {
  const days = new Map(), hours = new Map(), totals = new Map();
  for (const r of logs ?? []) {
    const t = ms(r?.at), acc = String(r?.account_id ?? '');
    if (!acc || Number.isNaN(t)) continue;
    const d = obj(r.detail);
    const e = {};
    if (r.kind === 'save') {
      e.items = Math.max(0, Math.trunc(num(d.addedCount)));
      e.cards = up(d.cards);
      e.cardsOut = down(d.cards);
      e.materials = up(d.materials);
      e.kafraEdit = up(d.kafra); // 存檔自己把 Kafra 改多（伺服器會改回去並記 kafra-no-sale；這裡只是看量）
    } else if (r.kind === 'op') {
      const op = String(d.op ?? '');
      if (op === 'sell') e.kafraIn = Math.max(0, num(d.gained));
      else if (op === 'buy') e.kafraOut = Math.max(0, num(d.cost));
      else if (op === 'towerReset') e.kafraOut = 500;
      else if (op === 'marketBuy') e.traded = Math.max(0, num(d.price));
      e.ops = 1;
    } else if (r.kind === 'trade') e.trades = 1;
    const day = iso(t, 10), hour = `${acc}|${iso(t, 13)}`;
    for (const [k, v] of Object.entries(e)) { add(days, day, k, v); add(hours, hour, k, v); add(totals, acc, k, v); }
  }
  const peak = new Map();
  for (const [key, v] of hours) {
    const [acc, hour] = key.split('|');
    let p = peak.get(acc);
    if (!p) peak.set(acc, (p = {}));
    for (const k of ['kafraIn', 'items', 'cards']) if ((v[k] ?? 0) > (p[k]?.n ?? 0)) p[k] = { n: v[k], hour };
  }
  return { days: [...days].sort(([a], [b]) => (a < b ? -1 : 1)).map(([day, v]) => ({ day, ...v })), peak, totals };
}

// 行為：每個帳號的場數、作息與規律程度（看關卡憑證）
export function behavior(runs) {
  const by = new Map();
  for (const r of runs ?? []) {
    const t = ms(r?.issued_at), acc = String(r?.account_id ?? '');
    if (!acc || Number.isNaN(t) || r.skip) continue;
    let a = by.get(acc);
    if (!a) by.set(acc, (a = []));
    const c = ms(r.claimed_at);
    a.push([t, Number.isNaN(c) ? null : c]);
  }
  const out = new Map();
  for (const [acc, list] of by) {
    list.sort((x, y) => x[0] - y[0]);
    const perHour = new Map(), perDay = new Map();
    for (const [t] of list) {
      const h = Math.floor(t / HOUR);
      perHour.set(h, (perHour.get(h) ?? 0) + 1);
      const d = Math.floor(t / DAY);
      if (!perDay.has(d)) perDay.set(d, new Set());
      perDay.get(d).add(h);
    }
    let maxPerHour = 0, maxHour = null;
    for (const [h, n] of perHour) if (n > maxPerHour) { maxPerHour = n; maxHour = iso(h * HOUR, 13); }
    let maxHoursPerDay = 0;
    for (const s of perDay.values()) maxHoursPerDay = Math.max(maxHoursPerDay, s.size);
    let streak = 0, cur = 0, last = null;
    for (const h of [...perHour.keys()].sort((x, y) => x - y)) { cur = last !== null && h === last + 1 ? cur + 1 : 1; streak = Math.max(streak, cur); last = h; }
    // 間隔：只看同一段遊玩裡的（隔超過 30 分鐘算休息過，不列入）
    const gaps = [];
    for (let i = 1; i < list.length; i++) { const g = (list[i][0] - list[i - 1][0]) / 1000; if (g > 0 && g <= 1800) gaps.push(g); }
    const stat = (xs) => { if (xs.length < 2) return null; const m = xs.reduce((a, b) => a + b, 0) / xs.length; if (!(m > 0)) return null; const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); return { n: xs.length, mean: Math.round(m), cv: +(sd / m).toFixed(3) }; };
    const lens = list.filter(([t, c]) => c !== null && c > t).map(([t, c]) => (c - t) / 1000);
    out.set(acc, { runs: list.length, maxPerHour, maxHour, maxHoursPerDay, streak, gap: stat(gaps), length: stat(lens) });
  }
  return out;
}

// 紀錄上的疑點：每個帳號的旗標、被改回去的（fixed）與只記錄的（soft）修正
export function flagged(logs) {
  const out = new Map();
  for (const r of logs ?? []) {
    const acc = String(r?.account_id ?? '');
    if (!acc) continue;
    const fl = Array.isArray(r.flags) ? r.flags : [];
    const fix = obj(r.detail).fix;
    if (!fl.length && !Array.isArray(fix)) continue;
    let a = out.get(acc);
    if (!a) out.set(acc, (a = { flags: {}, fixed: {}, soft: {}, mod: {}, nFixed: 0, nSoft: 0, fixedSaves: 0 }));
    for (const f of fl) if (typeof f === 'string') a.flags[f] = (a.flags[f] ?? 0) + 1;
    let enforced = false;
    for (const x of Array.isArray(fix) ? fix : []) {
      const code = typeof x?.code === 'string' ? x.code : null;
      if (!code) continue;
      if (MODERATION.has(code)) { a.mod[code] = (a.mod[code] ?? 0) + 1; continue; }
      if (x.fixed === false) { a.soft[code] = (a.soft[code] ?? 0) + 1; a.nSoft++; }
      else { a.fixed[code] = (a.fixed[code] ?? 0) + 1; a.nFixed++; enforced = true; }
    }
    // 一次存檔可以帶好幾處修正（一個壞掉的存檔就是好幾處）：分數照「幾次存檔」算，不照「幾處」算
    if (enforced) a.fixedSaves++;
  }
  return out;
}

// 綜合：每個帳號一列，附理由與分數（分數只用來排序）。opts 可以蓋掉 DEFAULTS 裡的門檻
export function review(logs, runs, opts = {}) {
  const T = { ...DEFAULTS, ...opts };
  const eco = economy(logs), beh = behavior(runs), fl = flagged(logs);
  const ids = new Set([...eco.peak.keys(), ...beh.keys(), ...fl.keys()]);
  const rows = [];
  for (const id of ids) {
    const p = eco.peak.get(id) ?? {}, b = beh.get(id), f = fl.get(id);
    const why = [];
    let score = 0;
    const hit = (w, text) => { score += w; why.push(text); };
    if (f?.fixedSaves) hit(WEIGHTS.fixed * Math.min(f.fixedSaves, 10), `${f.fixedSaves} 次存檔被改回（共 ${f.nFixed} 處：${Object.entries(f.fixed).map(([k, n]) => `${k}×${n}`).join('、')}）`);
    if ((f?.nSoft ?? 0) >= T.softFixes) hit(WEIGHTS.soft * Math.min(f.nSoft, 20), `只記錄的疑點 ${f.nSoft} 次（${Object.entries(f.soft).map(([k, n]) => `${k}×${n}`).join('、')}）`);
    const special = Object.entries(f?.flags ?? {}).filter(([k]) => ['kafra-no-sale', 'item-edit', 'dev', 'claim-reused', 'check-error'].includes(k));
    if (special.length) hit(WEIGHTS.flag * special.length, `旗標 ${special.map(([k, n]) => `${k}×${n}`).join('、')}`);
    if ((p.kafraIn?.n ?? 0) > T.kafraPerHour) hit(WEIGHTS.kafra, `一小時賣出 ${p.kafraIn.n} Kafra（${p.kafraIn.hour}，門檻 ${T.kafraPerHour}）`);
    if ((p.items?.n ?? 0) > T.itemsPerHour) hit(WEIGHTS.items, `一小時多 ${p.items.n} 件物品（${p.items.hour}，門檻 ${T.itemsPerHour}）`);
    if ((p.cards?.n ?? 0) > T.cardsPerHour) hit(WEIGHTS.cards, `一小時多 ${p.cards.n} 張卡片（${p.cards.hour}，門檻 ${T.cardsPerHour}）`);
    if (b) {
      if (b.maxPerHour > T.runsPerHour) hit(WEIGHTS.runs, `一小時 ${b.maxPerHour} 場（${b.maxHour}，門檻 ${T.runsPerHour}）`);
      if (b.maxHoursPerDay > T.hoursPerDay) hit(WEIGHTS.hours, `一天有 ${b.maxHoursPerDay} 個小時在打（門檻 ${T.hoursPerDay}）`);
      if (b.streak > T.streakHours) hit(WEIGHTS.streak, `連續 ${b.streak} 個小時每小時都有打（門檻 ${T.streakHours}）`);
      if (b.gap && b.gap.n >= T.regularMin && b.gap.cv < T.regularCv) hit(WEIGHTS.regular, `每場間隔太規律：${b.gap.n} 次平均 ${b.gap.mean} 秒、變異係數 ${b.gap.cv}（門檻 ${T.regularCv}）`);
    }
    if (score > 0 && f && Object.keys(f.mod).length) why.push(`（不算分）名字審核 ${Object.entries(f.mod).map(([k, n]) => `${k}×${n}`).join('、')}`);
    if (score > 0) rows.push({ account: id, score, why, runs: b?.runs ?? 0 });
  }
  rows.sort((a, b) => b.score - a.score || (a.account < b.account ? -1 : 1));
  return { rows, economy: eco, behavior: beh, flagged: fl, thresholds: T };
}

// 停權 SQL（只產生文字，不執行）。ro_login.state：0 正常、其他值停權；unban_time 在未來＝暫時停權到那時候。
// 被停權的帳號每個 API 請求都回 403 banned，也拿不到大廳入場票；已經連著的大廳連線最多 15 分鐘後（入場票到期）斷開。
// 只收分數 ≥ minScore 的帳號（預設 BAN_SCORE）；不到的只在最後註明有幾個沒列入。
export function banSql(rows, { days = 7, permanent = false, minScore = BAN_SCORE } = {}) {
  const bar = Number.isFinite(Number(minScore)) ? Number(minScore) : BAN_SCORE;
  const valid = (rows ?? []).filter((r) => /^\d{1,18}$/.test(String(r.account)));
  const ok = valid.filter((r) => Number(r.score) >= bar);
  const below = valid.length - ok.length;
  if (!ok.length) return '-- 沒有要停權的帳號' + (below ? `（${below} 個帳號分數不到 ${bar}，只列在上面給人看）` : '');
  const d = Math.max(1, Math.min(3650, Math.trunc(Number(days)) || 7));
  const lines = ['-- 282 停權（請逐筆看過理由再執行；這個工具不會自己執行）', 'BEGIN;'];
  for (const r of ok) {
    for (const w of r.why ?? []) lines.push(`--   ${String(w).replace(/[\r\n]+/g, ' ')}`);
    lines.push(permanent
      ? `UPDATE ro_login SET state = 5, unban_time = NULL WHERE account_id = ${r.account} AND state = 0;  -- 永久停權（分數 ${r.score}）`
      : `UPDATE ro_login SET unban_time = now() + interval '${d} days' WHERE account_id = ${r.account} AND state = 0;  -- 停權 ${d} 天（分數 ${r.score}）`);
  }
  if (below) lines.push(`-- 另有 ${below} 個帳號分數不到 ${bar}，沒有列入`);
  lines.push('COMMIT;', '', '-- 解除：UPDATE ro_login SET state = 0, unban_time = NULL WHERE account_id IN (' + ok.map((r) => r.account).join(', ') + ');');
  return lines.join('\n');
}

// 兩句 SELECT（sql 是 neon 或相容的 tagged template，回傳列的陣列）。只讀。
export async function loadAudit(sql, days = 7) {
  const d = Math.max(1, Math.min(90, Math.trunc(Number(days)) || 7));
  const logs = await sql`SELECT account_id, at, kind, flags, detail FROM ro_game_log WHERE at > now() - make_interval(days => ${d}::int) ORDER BY at`;
  const runs = await sql`SELECT account_id, stage, skip, issued_at, claimed_at FROM ro_game_run WHERE issued_at > now() - make_interval(days => ${d}::int) ORDER BY issued_at`;
  return { logs, runs };
}
export async function loadAccounts(sql, ids) {
  const list = [...new Set(ids)].filter((x) => /^\d{1,18}$/.test(String(x))).map(String);
  if (!list.length) return new Map();
  const rows = await sql`SELECT account_id, userid, state, unban_time, created_at FROM ro_login WHERE account_id = ANY(${list}::bigint[])`;
  return new Map(rows.map((r) => [String(r.account_id), r]));
}
