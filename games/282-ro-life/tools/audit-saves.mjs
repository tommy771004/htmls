// 正式站唯讀稽核（只有 SELECT，不改任何資料）：新的存檔規則套在現有線上存檔上會不會動到正常玩家，
// 以及 ro_game_log／ro_game_run 的分布（收緊上限用）。在作品集根目錄執行，要 RO_DATABASE_URL：
//   node --env-file=.env.local games/282-ro-life/tools/audit-saves.mjs
// 怎麼看：
//   「原封不動重存會出現的 issue」要是空的，才代表新規則不會動到現有存檔。
//   開 RO_ONLINE_STRICT=1 之前，「log 旗標」「修正代碼」裡不能有正常玩家的 mvp-early、stage-early、card-stage、item-affix、item-count、equip-dup、stage-locked。
//   「經驗 gain/cap」的 max_ratio 是實際拿到的經驗佔上限的比例，上限可以收多緊看它。
import { neon } from '@neondatabase/serverless';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const load = (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const { checkSave } = await load('server/ro-life/game-rules.mjs');
const { nameProblem } = await load('server/ro-life/name-rules.mjs');
if (!process.env.RO_DATABASE_URL) throw new Error('要設 RO_DATABASE_URL（node --env-file=.env.local …）');
const sql = neon(process.env.RO_DATABASE_URL);
const q = async (label, p) => { try { return await p; } catch (e) { console.log(label, '查詢失敗：', String(e.message).slice(0, 120)); return []; } };

const saves = await q('存檔', sql`SELECT account_id, rev, doc FROM ro_game_save`);
console.log('線上存檔', saves.length);
const codes = {}, names = [], prof = { chars: 0, noId: 0, items: 0, noUid: 0, dupUid: 0, jobs: {}, promoted: 0, maxLv: 0 };
for (const s of saves) {
  const doc = s.doc ?? {};
  let chars = [], acc = {};
  try { chars = JSON.parse(doc['characters.v1'] ?? '[]') ?? []; acc = JSON.parse(doc['account.v1'] ?? '{}') ?? {}; } catch { /* 格式壞掉的存檔照樣丟給 checkSave */ }
  for (const c of Array.isArray(chars) ? chars : []) {
    if (!c) continue;
    prof.chars++;
    if (!c.id) prof.noId++;
    prof.jobs[c.job] = (prof.jobs[c.job] ?? 0) + 1;
    if (c.promotion) prof.promoted++;
    prof.maxLv = Math.max(prof.maxLv, Number(c.level) || 1);
    const why = nameProblem(c.name);
    if (why) names.push([why, c.name]);
  }
  const seen = new Set();
  for (const it of Array.isArray(acc.inventory) ? acc.inventory : []) {
    prof.items++;
    if (!it?.uid) prof.noUid++; else if (seen.has(String(it.uid))) prof.dupUid++; else seen.add(String(it.uid));
  }
  // 存檔原封不動再存一次：新規則不應該有任何修正
  // 驗證丟例外的存檔：把關模式下那個帳號會存不了檔（回 400），一定要先修
  let r;
  try { r = checkSave(doc, structuredClone(doc), { now: Date.now(), claim: null, strict: true }); }
  catch (e) { codes['驗證丟例外：' + String(e.message).slice(0, 60)] = (codes['驗證丟例外：' + String(e.message).slice(0, 60)] ?? 0) + 1; continue; }
  for (const i of r.issues) { const k = i.code + (i.fixed === false ? '（只記錄）' : ''); codes[k] = (codes[k] ?? 0) + 1; }
}
console.log('概況', JSON.stringify(prof));
console.log('原封不動重存會出現的 issue', JSON.stringify(codes));
console.log('現有名字不合新規則（改名或新建時才會擋，舊名字不動；大廳會把冒充官方／不雅的顯示成編號）', names.length, JSON.stringify(names.slice(0, 20)));

const flags = await q('旗標', sql`SELECT f AS flag, count(*)::int AS n, count(DISTINCT account_id)::int AS accounts FROM ro_game_log, unnest(flags) AS f GROUP BY f ORDER BY n DESC`);
console.log('log 旗標 [旗標, 次數, 帳號數]', JSON.stringify(flags.map((r) => [r.flag, r.n, r.accounts])));
const kinds = await q('種類', sql`SELECT kind, count(*)::int AS n, count(DISTINCT account_id)::int AS accounts, min(at) AS first, max(at) AS last FROM ro_game_log GROUP BY kind`);
console.log('log 種類', JSON.stringify(kinds));
const fixes = await q('修正', sql`SELECT x->>'code' AS code, (x->>'fixed') IS NOT NULL AS log_only, count(*)::int AS n, count(DISTINCT account_id)::int AS accounts FROM ro_game_log, jsonb_array_elements(detail->'fix') AS x WHERE detail ? 'fix' GROUP BY 1, 2 ORDER BY n DESC`);
console.log('修正代碼 [代碼, 只記錄, 次數, 帳號數]', JSON.stringify(fixes.map((r) => [r.code, r.log_only, r.n, r.accounts])));
const caps = await q('經驗', sql`SELECT detail->'cap'->>'stage' AS stage, count(*)::int AS n,
  round(avg((detail->'cap'->>'gain')::numeric / NULLIF((detail->'cap'->>'cap')::numeric, 0)), 3) AS avg_ratio,
  round(max((detail->'cap'->>'gain')::numeric / NULLIF((detail->'cap'->>'cap')::numeric, 0)), 3) AS max_ratio,
  round(avg((detail->'cap'->>'secs')::numeric)) AS avg_secs, min((detail->'cap'->>'secs')::numeric) AS min_secs
  FROM ro_game_log WHERE detail ? 'cap' GROUP BY 1 ORDER BY n DESC`);
console.log('經驗 gain/cap', JSON.stringify(caps));
const runs = await q('憑證', sql`SELECT stage, skip, count(*)::int AS n, count(claimed_at)::int AS claimed,
  round(avg(extract(epoch FROM (claimed_at - issued_at)))) AS avg_secs, min(round(extract(epoch FROM (claimed_at - issued_at)))) AS min_secs
  FROM ro_game_run GROUP BY 1, 2 ORDER BY n DESC`);
console.log('憑證（只留 7 天）', JSON.stringify(runs));
const added = await q('物品', sql`SELECT count(*)::int AS saves, max((detail->>'addedCount')::int) AS max_items, round(avg((detail->>'addedCount')::int), 1) AS avg_items FROM ro_game_log WHERE detail ? 'addedCount'`);
console.log('一次結算的新物品數', JSON.stringify(added));
const endless = await q('塔', sql`SELECT status, count(*)::int AS n FROM ro_endless_run GROUP BY 1`);
console.log('無盡之塔場次', JSON.stringify(endless));
