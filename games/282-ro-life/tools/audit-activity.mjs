// 正式站事後稽核（只有 SELECT，不改任何資料）：經濟產出與消耗、行為特徵、值得人工看的帳號。
// 在作品集根目錄執行，要 RO_DATABASE_URL（這是讀正式資料：每次都由擁有者自己跑，或當場明講同意才代跑）：
//   node --env-file=.env.local games/282-ro-life/tools/audit-activity.mjs [選項]
// 選項：
//   --days 7              看最近幾天（關卡憑證只留 7 天，行為特徵最多 7 天）
//   --top 20              列出分數最高的幾個帳號
//   --min-score 5         分數低於這個數的不列
//   --ban-sql             另外印出停權 SQL（只印不執行；請看過理由再自己貼到 Neon 執行）
//   --ban-min-score 15    分數到這個數才產生停權 SQL（一次存檔被改回是 5 分、只有行為特徵最多 10 分，都不到）
//   --ban-days 7          停權幾天；--permanent 改成永久
//   --kafra-per-hour N · --items-per-hour N · --cards-per-hour N · --runs-per-hour N
//   --hours-per-day N · --streak-hours N · --regular-cv X · --soft-fixes N     調門檻
// 門檻都是估計值（正式站還沒有資料可以對）：列出來只代表值得看，不代表作弊。先標記、觀察一陣子、再一批處理，
// 不要一偵測到就停權（外掛作者會拿即時的停權來試哪條規則擋到他）。
// 計算邏輯與測試在 server/ro-life/audit.mjs／audit.test.mjs。
import { neon } from '@neondatabase/serverless';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const A = await import(pathToFileURL(resolve(ROOT, 'server/ro-life/audit.mjs')).href);

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(`--${k}`); return i < 0 ? undefined : argv[i + 1]; };
const flag = (k) => argv.includes(`--${k}`);
const numOpt = (k) => { const v = Number(opt(k)); return Number.isFinite(v) && opt(k) !== undefined ? v : undefined; };
const thresholds = Object.fromEntries(Object.entries({
  kafraPerHour: numOpt('kafra-per-hour'), itemsPerHour: numOpt('items-per-hour'), cardsPerHour: numOpt('cards-per-hour'), runsPerHour: numOpt('runs-per-hour'),
  hoursPerDay: numOpt('hours-per-day'), streakHours: numOpt('streak-hours'), regularCv: numOpt('regular-cv'), softFixes: numOpt('soft-fixes'),
}).filter(([, v]) => v !== undefined));

// 報告本體（sql 可以換成測試用的；回傳印出來的文字）
export async function report(sql, { days = 7, top = 20, minScore = 5, ban = false, banDays = 7, banMinScore = A.BAN_SCORE, permanent = false, thresholds: th = {} } = {}) {
  const out = [];
  const { logs, runs } = await A.loadAudit(sql, days);
  const r = A.review(logs, runs, th);
  out.push(`最近 ${days} 天：紀錄 ${logs.length} 筆、關卡憑證 ${runs.length} 張`);
  out.push('', '每天的產出與消耗（items／cards／materials 是存檔新增的；kafraIn 是賣出、kafraOut 是買礦與重置；traded 是市場轉手）');
  for (const d of r.economy.days) out.push('  ' + JSON.stringify(d));
  if (!r.economy.days.length) out.push('  （沒有資料）');
  const picked = r.rows.filter((x) => x.score >= minScore).slice(0, top);
  const who = await A.loadAccounts(sql, picked.map((x) => x.account));
  out.push('', `值得看的帳號（分數 ≥ ${minScore}，最多 ${top} 個；門檻 ${JSON.stringify(r.thresholds)}）`);
  for (const x of picked) {
    const a = who.get(x.account);
    const banned = a && (Number(a.state) !== 0 || (a.unban_time && new Date(a.unban_time).getTime() > Date.now()));
    out.push(`  ${x.account} ${a ? JSON.stringify(a.userid) : '（帳號不存在）'}${banned ? '［已停權］' : ''} 分數 ${x.score}，${x.runs} 場`);
    for (const w of x.why) out.push(`    - ${w}`);
  }
  if (!picked.length) out.push('  （沒有）');
  if (ban) out.push('', A.banSql(picked.filter((x) => { const a = who.get(x.account); return a && Number(a.state) === 0; }), { days: banDays, permanent, minScore: banMinScore }));
  return out.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.RO_DATABASE_URL) throw new Error('要設 RO_DATABASE_URL（node --env-file=.env.local …）');
  console.log(await report(neon(process.env.RO_DATABASE_URL), {
    days: numOpt('days') ?? 7, top: numOpt('top') ?? 20, minScore: numOpt('min-score') ?? 5,
    ban: flag('ban-sql'), banDays: numOpt('ban-days') ?? 7, banMinScore: numOpt('ban-min-score') ?? A.BAN_SCORE, permanent: flag('permanent'), thresholds,
  }));
}
