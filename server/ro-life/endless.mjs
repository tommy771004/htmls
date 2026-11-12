import { randomBytes, randomInt } from 'node:crypto';
import R from './rules-data.mjs';

// 282 無盡之塔（線上角色）：引擎原本的 ?endless=1 WebSocket 協定，改走 HTTP（Vercel 沒有 WebSocket）。
// 頁面的 __RoHttpSocket（tools/build.mjs）把每次 send 變成 POST game/endless/io {run, msgs:[…]}，回 {msgs:[…]}。
// 伺服器只負責「記下來」：開局快照（伺服器存檔裡的角色＋塔的進度）、種子、每 10 秒一段操作與狀態雜湊、選卡。
// 結束時回 status:'pending'（引擎顯示「伺服器會在一天內檢查」），分數、塔的點數、排行榜都等驗證程式
// （games/282-ro-life/tools/verify-endless.mjs，在擁有者電腦上跑）用同一版頁面重跑過才算。
//   POST game/endless/io  start／resume／in／end／suspend（訊息格式照引擎 Pn 類別）
//   GET  game/endless?char=          {progress, verified, bestScore, suspended}
//   POST game/endless/upgrade {char, id}     {progress}   用塔的點數買強化（價格照引擎 rv）
//   POST game/endless/skills  {char, skills} {progress}   帶進塔的技能（合法與否由驗證程式用引擎檢查）
//   GET  game/ladder?season=&job=    {season, rows, me}   只列驗證過的
// 正式站要套用 schema.sql 的 ro_endless_* 表、已開 RO_ONLINE_ENFORCE=1，再設 RO_ENDLESS=1 才開放（/api/ro/config 回 endless）。

const E = R.endless;
const RESUME_MS = 7 * 86400_000;
const STARTS_PER_HOUR = 30;
const MAX_TICKS = 4 * 3600 / E.step; // 一場最多 4 小時（遊戲時間）
const MAX_SPEED = 4.2; // 引擎 qd = [1, 2, 4]
const MAX_PICKS = 4000;
const LADDER_ROWS = 50;
export const season = (t = Date.now()) => new Date(t).toISOString().slice(0, 7);

const list = (v) => (Array.isArray(v) ? v : []);
const int = (v) => (Number.isInteger(v) ? v : NaN);
const parse = (doc, key, fb) => { try { return JSON.parse(doc?.[key] ?? 'null') ?? fb; } catch { return fb; } };

// 引擎 G1／rh：依序打倒各區 MVP 才開對應的 10 層；沒轉職不能進塔
export function floorsOpen(c) {
  if (!c?.promotion) return 0;
  const dead = list(c.mvpsDefeated);
  let n = 0;
  for (const id of E.mvps) {
    if (!(dead.includes(id) || list(E.mvpAlias[id]).some((a) => dead.includes(a)))) break;
    n++;
  }
  return n * E.floorsPerStage;
}

// 引擎 ga()：角色身上的塔進度
export function progressOf(p) {
  const e = p && typeof p === 'object' ? p : {};
  const n = (v, d) => (Number.isFinite(v) ? v : d);
  return { reached: n(e.reached, 1), best: n(e.best, 0), earned: n(e.earned, 0), spent: n(e.spent, 0), ups: { ...(e.ups ?? {}) }, skills: [...list(e.skills)] };
}

export function buyUp(progress, id) {
  const p = progressOf(progress);
  if (!E.ups.includes(id)) return { error: 'bad_op' };
  const rank = p.ups[id] ?? 0;
  if (rank >= E.upMax[id]) return { error: 'bad_op' };
  const cost = E.upCost[id]?.[rank];
  if (!Number.isFinite(cost) || p.earned - p.spent < cost) return { error: 'missing' };
  p.ups[id] = rank + 1;
  p.spent += cost;
  return { progress: p };
}

export const RESET_KAFRA = 500; // 引擎 pi：重置強化要 500 Kafra
export function resetUps(progress) {
  const p = progressOf(progress);
  if (!p.spent && !Object.keys(p.ups).length) return { error: 'nothing' };
  p.ups = {};
  p.spent = 0;
  return { progress: p };
}

export function setSkills(progress, skills) {
  const p = progressOf(progress);
  const s = list(skills);
  if (s.length > 12 || s.some((x) => typeof x !== 'string' || !/^[\w-]{1,40}$/.test(x)) || new Set(s).size !== s.length) return { error: 'bad_op' };
  p.skills = s;
  return { progress: p };
}

// 把各段操作（照 seq 順序；後來的段從 at 開始覆蓋，接續時就是這樣截斷）組回完整的逐格操作與雜湊
export function rebuild(chunks, ticks, checks) {
  const moves = [], hashes = [];
  for (const c of chunks) {
    moves.length = Math.min(moves.length, c.at * 2);
    const r = list(c.runs);
    for (let i = 0; i + 2 < r.length; i += 3) for (let k = 0; k < r[i + 2]; k++) moves.push(r[i], r[i + 1]);
    hashes.length = Math.min(hashes.length, c.from);
    hashes.push(...list(c.checks));
  }
  moves.length = Math.min(moves.length, ticks * 2);
  hashes.length = Math.min(hashes.length, checks);
  return { moves, checks: hashes };
}
export function encodeRuns(moves) {
  const out = [];
  for (let i = 0; i < moves.length; i += 2) {
    const n = out.length;
    if (n && out[n - 3] === moves[i] && out[n - 2] === moves[i + 1]) out[n - 1]++;
    else out.push(moves[i], moves[i + 1], 1);
  }
  return out;
}
const runTicks = (runs) => { let t = 0; for (let i = 2; i < runs.length; i += 3) t += runs[i]; return t; };
// 引擎的操作是量化過的整數方向（−1024～1024），每三個一組：dx, dy, 連續格數
const goodRuns = (runs) => runs.length % 3 === 0 && runs.every((v, i) => Number.isInteger(v) && (i % 3 === 2 ? v > 0 && v <= MAX_TICKS : Math.abs(v) <= 1024));
const goodPicks = (p) => p.length % 2 === 0 && p.length <= MAX_PICKS && p.every((v) => Number.isInteger(v) && v >= 0);
const goodChecks = (c) => c.every((h) => typeof h === 'string' && /^[0-9a-f]{1,16}$/.test(h));
const claimOf = (c) => (c && typeof c === 'object' ? Object.fromEntries(['wave', 'cleared', 'points', 'bestWave', 'score'].map((k) => [k, Number.isFinite(c[k]) ? c[k] : 0])) : null);

export function createEndlessRoutes({ env, store, send, readBody }) {
  let probe = { at: 0, ok: false };
  async function enabled() {
    if (!store.ready) return false;
    if (!store.sql) return env.RO_ENDLESS !== '0';
    // 開局快照取自伺服器存檔：存檔要先由 RO_ONLINE_ENFORCE 把關（轉職、打倒的 MVP 才可信），否則不開
    if (env.RO_ENDLESS !== '1' || env.RO_ONLINE_ENFORCE !== '1') return false;
    if (Date.now() - probe.at < 60_000) return probe.ok;
    let ok = false;
    try { ok = await store.endlessTablesReady(); } catch {}
    probe = { at: Date.now(), ok };
    return ok;
  }

  const charOf = async (accId, charId, { gear = false } = {}) => {
    const save = await store.getGameSave(accId);
    const c = list(parse(save.doc, 'characters.v1', [])).find((x) => x && String(x.id) === String(charId)) ?? null;
    if (!c || !gear) return c;
    // 引擎的角色物件帶著帳號的倉庫（La() 從 inventory 找裝備）；快照只放身上穿的，卡片庫存不影響戰鬥
    const worn = new Set(Object.values(c.equipped ?? {}).filter(Boolean).map(String));
    const inv = list(parse(save.doc, 'account.v1', {})?.inventory).filter((it) => it?.uid && worn.has(String(it.uid)));
    return { ...c, inventory: inv, cards: {} };
  };
  const progress = async (accId, charId) => progressOf(await store.getEndlessProgress(accId, String(charId)));

  // 一個 io 請求裡的訊息依序處理；回傳要送回引擎的訊息
  async function io(acc, body) {
    const out = [];
    let runId = typeof body.run === 'string' ? body.run : null;
    for (const m of list(body.msgs).slice(0, 20)) {
      if (!m || typeof m !== 'object') continue;
      if (m.t === 'start') {
        // 錯誤碼照引擎 dI() 的訊息：char（伺服器還沒有這個角色）、job（沒轉職）、locked（沒開放樓層）、full（太頻繁）
        if ((await store.countEndlessRuns(acc.id, 3600)) >= STARTS_PER_HOUR) { out.push({ t: 'error', why: 'full' }); break; }
        const c = await charOf(acc.id, m.charId, { gear: true });
        const last = floorsOpen(c);
        if (!c || last <= 0) { out.push({ t: 'error', why: !c ? 'char' : !c.promotion ? 'job' : 'locked' }); break; }
        const build = typeof m.build === 'string' && /^[\w-]{1,40}$/.test(m.build) ? m.build : '?';
        const prog = await progress(acc.id, c.id);
        const snapshot = { ...c, endless: prog };
        const run = { id: randomBytes(12).toString('base64url'), charId: String(c.id), build, engine: Number.isInteger(m.engine) ? m.engine : null, seed: randomInt(1, 2 ** 31 - 1), wave: 1, last, snapshot, season: season(), name: String(c.name ?? '').slice(0, 24), job: String(c.promotion) };
        await store.createEndlessRun(acc.id, run);
        runId = run.id;
        out.push({ t: 'started', run: run.id, seed: run.seed, wave: run.wave, last, char: snapshot, best: prog.best });
        continue;
      }
      const id = typeof m.run === 'string' ? m.run : runId;
      const run = id ? await store.getEndlessRun(acc.id, id) : null;
      if (!run) { out.push({ t: 'error', why: 'gone' }); break; }
      runId = run.id;
      if (m.t === 'resume') {
        if (m.restore) {
          if (run.state !== 'suspended' || run.resumed || Date.now() - run.updatedAt > RESUME_MS) { out.push({ t: 'error', why: 'gone' }); break; }
          const cut = run.cut ?? 0, checks = Math.floor(cut / E.checkEvery);
          const picks = [];
          for (let i = 0; i + 1 < run.picks.length; i += 2) if (run.picks[i] <= cut) picks.push(run.picks[i], run.picks[i + 1]);
          const { moves } = rebuild(await store.endlessChunks(run.id), cut, checks);
          if (!(await store.restoreEndlessRun(acc.id, run.id, { ticks: cut, checks, picks }))) { out.push({ t: 'error', why: 'gone' }); break; }
          out.push({ t: 'resumed', ticks: cut, checks, restore: { run: run.id, seed: run.seed, wave: run.wave, last: run.last, char: run.snapshot, best: progressOf(run.snapshot.endless).best, picks, runs: encodeRuns(moves) } });
          continue;
        }
        if (run.state !== 'live') { out.push({ t: 'error', why: 'gone' }); break; }
        out.push({ t: 'resumed', ticks: run.ticks, checks: run.checks });
        continue;
      }
      if (run.state !== 'live') { out.push(m.t === 'end' && run.state === 'ended' ? { t: 'saved', status: run.status } : { t: 'error', why: 'gone' }); break; }
      if (m.t === 'in') {
        const runs = list(m.runs), checks = list(m.checks), picks = m.picks === undefined ? null : list(m.picks);
        if (!goodRuns(runs) || !goodChecks(checks) || (picks && !goodPicks(picks))) {
          // 格式不對：重送也不會變，直接結束這場（不然引擎會一直重送）
          await store.setEndlessState(acc.id, run.id, 'live', { state: 'ended', status: 'unranked', verdict: { why: 'format' } });
          out.push({ t: 'error', why: 'gone' });
          break;
        }
        if (m.at !== run.ticks || m.from !== run.checks) {
          // 對不上（重送、漏段）就照伺服器的進度要引擎重送
          out.push({ t: 'resumed', ticks: run.ticks, checks: run.checks });
          continue;
        }
        const ticks = run.ticks + runTicks(runs);
        const wall = (Date.now() - run.startedAt) / 1000;
        // 已通過的樓層可以 ×2／×4 快轉（引擎 qd、按 V），所以上限是牆鐘的 4 倍再寬一點；超過就結束、不排名
        if (ticks * E.step > wall * MAX_SPEED + 60 || ticks > MAX_TICKS || run.checks + checks.length > Math.floor(ticks / E.checkEvery)) {
          await store.setEndlessState(acc.id, run.id, 'live', { state: 'ended', status: 'unranked', verdict: { why: 'fast', ticks, wall } });
          out.push({ t: 'error', why: 'gone' });
          break;
        }
        const ok = await store.appendEndless(acc.id, run.id, { at: run.ticks, from: run.checks, runs, checks, ticks, checksTo: run.checks + checks.length, picks, claim: claimOf(m.claim) });
        if (!ok) out.push({ t: 'resumed', ticks: run.ticks, checks: run.checks });
        else Object.assign(run, { ticks, checks: run.checks + checks.length });
        continue;
      }
      if (m.t === 'end') {
        const status = run.ticks > 0 ? 'pending' : 'empty';
        await store.setEndlessState(acc.id, run.id, 'live', { state: 'ended', status, claim: claimOf(m.claim) });
        out.push({ t: 'saved', status });
        continue;
      }
      if (m.t === 'suspend') {
        const cut = Number.isInteger(m.cut) && m.cut >= 0 && m.cut <= run.ticks ? m.cut : run.ticks;
        // 已經接續過一次的不能再存：直接結束（引擎說「只能接續一次」）
        const patch = run.resumed ? { state: 'ended', status: run.ticks > 0 ? 'pending' : 'empty', claim: claimOf(m.claim) } : { state: 'suspended', cut, claim: claimOf(m.claim) };
        await store.setEndlessState(acc.id, run.id, 'live', patch);
        out.push({ t: 'suspended' });
        continue;
      }
    }
    return out;
  }

  async function route(req, res, path, acc, query) {
    if (!(await enabled())) return send(res, 404, { error: 'not_found' });
    const method = req.method;
    if (path === 'endless/io' && method === 'POST') return send(res, 200, { msgs: await io(acc, await readBody(req)) });
    if (path === 'endless' && method === 'GET') {
      const charId = String(query?.get('char') ?? '');
      const c = await charOf(acc.id, charId);
      if (!c) return send(res, 404, { error: 'missing' });
      const [prog, best, sus, pending] = await Promise.all([progress(acc.id, charId), store.endlessBestScore(acc.id, charId), store.endlessSuspended(acc.id, charId, RESUME_MS), store.endlessPendingFor(acc.id, charId)]);
      return send(res, 200, {
        progress: prog,
        verified: { level: c.level ?? 1, jobLevel: c.jobLevel ?? 1, mvps: list(c.mvpsDefeated), promotion: c.promotion ?? null },
        bestScore: best,
        pending,
        suspended: sus ? { run: sus.id, wave: sus.claim?.wave ?? 1, score: sus.claim?.score ?? 0, saved: sus.updatedAt } : null,
      });
    }
    if ((path === 'endless/upgrade' || path === 'endless/skills') && method === 'POST') {
      const body = await readBody(req);
      const charId = String(body.char ?? '');
      if (!(await charOf(acc.id, charId))) return send(res, 404, { error: 'missing' });
      for (let attempt = 0; attempt < 2; attempt++) {
        const raw = await store.getEndlessProgress(acc.id, charId);
        const r = path === 'endless/upgrade' ? buyUp(raw, String(body.id ?? '')) : setSkills(raw, body.skills);
        if (r.error) return send(res, 400, { error: r.error });
        if (await store.casEndlessProgress(acc.id, charId, raw, r.progress)) return send(res, 200, { progress: r.progress });
      }
      return send(res, 409, { error: 'conflict' });
    }
    if (path === 'ladder' && method === 'GET') {
      const q = String(query?.get('season') ?? 'current');
      const s = q === 'all' || /^\d{4}-\d{2}$/.test(q) ? q : season(); // all＝歷代
      const j = String(query?.get('job') ?? '').slice(0, 30);
      const job = j === 'all' ? '' : j;
      const { rows, me } = await store.endlessLadder(s, job, acc.id, LADDER_ROWS);
      return send(res, 200, { season: s, rows, me });
    }
    return null;
  }
  // game/op 的 towerReset：扣 500 Kafra、清掉強化（點數全部退回）。先改塔的進度，再扣存檔的 Kafra
  async function towerReset(acc, body, { putSave }) {
    if (!(await enabled())) return { error: 'bad_op' };
    const charId = String(body.char ?? '');
    if (!(await charOf(acc.id, charId))) return { error: 'missing' };
    const save = await store.getGameSave(acc.id);
    if ((Number(parse(save.doc, 'account.v1', {})?.kafra) || 0) < RESET_KAFRA) return { error: 'missing' };
    const raw = await store.getEndlessProgress(acc.id, charId);
    const r = resetUps(raw);
    if (r.error) return r;
    if (!(await store.casEndlessProgress(acc.id, charId, raw, r.progress))) return { error: 'conflict' };
    const put = await putSave((doc) => {
      const a = parse(doc, 'account.v1', {}) ?? {};
      a.kafra = Math.max(0, (Number(a.kafra) || 0) - RESET_KAFRA);
      return { ...doc, 'account.v1': JSON.stringify(a) };
    });
    return put ? { ...put, progress: r.progress } : { error: 'conflict' };
  }
  return { route, enabled, towerReset };
}
