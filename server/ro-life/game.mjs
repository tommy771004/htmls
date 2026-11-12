import { randomBytes } from 'node:crypto';

// 282 線上角色（/api/ro/game/…）：引擎原本的線上協定，由我們的伺服器保存存檔。
// 第一步「只記錄不擋」：照單全收，但每次存檔都和上一版比對，把等級、經驗、物品的變化與疑點寫進 ro_game_log，
// 之後的存檔驗證（第二步）就照這些紀錄訂規則。存檔和單機的雲端備份（ro_save）分開放在 ro_game_save。
//   GET  game/save                       {rev, doc, name}
//   PUT  game/save {rev, doc, wid, mine?, run?, wipe?, lite?}   rev 不符回 409 {error:'conflict', rev, doc}
//   POST game/run {stage, mult, played?} 或 {stage, skip:true, char}   發關卡憑證 {run}
//   POST game/name {char, name} · game/visit · game/crash · game/logout
// 引擎用 x-session 標頭帶登入權杖（和 Bearer 是同一個）。正式站要套用 schema.sql 的新表、再設 RO_ONLINE=1 才開放。

export const GAME_KEY = /^(characters\.v1|account\.v1|achievements\.v1|pets\.v1|run\.v1\.[\w-]{1,40}|stages-seen\.v1\.[\w-]{1,40})$/;
const MAX_DOC = 1_000_000;
const RUNS_PER_HOUR = 120;
const LIST_MAX = 20;

export const displayName = (acc) => acc.name || '冒險者';

const parse = (doc, key, fallback) => {
  try {
    const v = JSON.parse(doc?.[key] ?? 'null');
    return v ?? fallback;
  } catch {
    return fallback;
  }
};
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const sum = (o) => Object.values(o && typeof o === 'object' ? o : {}).reduce((a, b) => a + Math.max(0, num(b)), 0);

// 兩版存檔的差異摘要與疑點（只看等級、經驗、物品這些之後要由伺服器把關的東西）。沒有值得記的變化回 null。
export function summarizeSave(prevDoc, nextDoc, { claim = null } = {}) {
  const flags = new Set();
  const detail = {};
  const prevChars = new Map((parse(prevDoc, 'characters.v1', []) || []).filter((c) => c?.id).map((c) => [String(c.id), c]));
  const nextChars = (parse(nextDoc, 'characters.v1', []) || []).filter((c) => c?.id);
  const chars = [], newIds = new Set();
  let gained = false;
  for (const c of nextChars) {
    const p = prevChars.get(String(c.id));
    prevChars.delete(String(c.id));
    if (c.dev) flags.add('dev');
    const now = { lv: num(c.level) || 1, jl: num(c.jobLevel) || 1, exp: num(c.exp), jexp: num(c.jobExp) };
    if (!p) {
      newIds.add(String(c.id));
      chars.push({ id: String(c.id), name: String(c.name ?? '').slice(0, 24), new: true, job: c.promotion ?? c.job ?? null, lv: now.lv, jl: now.jl });
      if (now.lv > 1 || now.jl > 1) flags.add('new-high');
      continue;
    }
    const was = { lv: num(p.level) || 1, jl: num(p.jobLevel) || 1, exp: num(p.exp), jexp: num(p.jobExp) };
    const changed = ['lv', 'jl', 'exp', 'jexp'].some((k) => now[k] !== was[k]) || (c.promotion ?? c.job) !== (p.promotion ?? p.job);
    if (!changed) continue;
    const up = now.lv > was.lv || now.jl > was.jl || now.exp > was.exp || now.jexp > was.jexp;
    if (up) gained = true;
    if (now.lv < was.lv || now.jl < was.jl) flags.add('level-down');
    if (now.lv - was.lv >= 10 || now.jl - was.jl >= 10) flags.add('big-jump');
    chars.push({ id: String(c.id), name: String(c.name ?? '').slice(0, 24), lv: [was.lv, now.lv], jl: [was.jl, now.jl], exp: [was.exp, now.exp], jexp: [was.jexp, now.jexp], ...(c.promotion !== p.promotion ? { job: [p.promotion ?? p.job ?? null, c.promotion ?? c.job ?? null] } : {}) });
  }
  for (const [id, p] of prevChars) chars.push({ id, name: String(p.name ?? '').slice(0, 24), removed: true });
  if (chars.length) detail.chars = chars.slice(0, LIST_MAX);

  const pa = parse(prevDoc, 'account.v1', {}) || {}, na = parse(nextDoc, 'account.v1', {}) || {};
  const pinv = new Map((Array.isArray(pa.inventory) ? pa.inventory : []).filter((i) => i?.uid).map((i) => [String(i.uid), i]));
  const ninv = (Array.isArray(na.inventory) ? na.inventory : []).filter((i) => i?.uid);
  const added = [], refined = [], edited = [];
  const look = (i) => JSON.stringify([num(i.itemId), i.tier ?? null, i.quality ?? null, i.ilvl ?? null, i.affixes ?? null, i.cards ?? null]);
  let starter = 0;
  for (const it of ninv) {
    const p = pinv.get(String(it.uid));
    pinv.delete(String(it.uid));
    if (!p && it.owner != null && newIds.has(String(it.owner))) starter++; // 新角色的新手裝備（引擎建角時發，owner 是角色 id）
    else if (!p) added.push({ id: num(it.itemId), tier: it.tier ?? null, q: it.quality ?? null, ilvl: it.ilvl ?? null });
    else {
      if (num(it.refine) !== num(p.refine)) refined.push({ id: num(it.itemId), refine: [num(p.refine), num(it.refine)] });
      // 同一件（同 uid）卻換了物品、品質、詞綴：精煉失敗只會清空卡片，所以卡片只看有沒有多出來
      const was = JSON.parse(look(p)), now = JSON.parse(look(it));
      const cardsUp = (now[5] ?? []).filter(Boolean).length > (was[5] ?? []).filter(Boolean).length && !(sum(na.cards) < sum(pa.cards));
      if (JSON.stringify(was.slice(0, 5)) !== JSON.stringify(now.slice(0, 5)) || cardsUp) edited.push({ id: num(it.itemId), was: was[0] !== now[0] ? was[0] : undefined });
    }
  }
  if (added.length) { detail.added = added.slice(0, LIST_MAX); detail.addedCount = added.length; gained = true; }
  if (starter) detail.starter = starter;
  if (pinv.size) detail.removed = pinv.size;
  if (refined.length) detail.refined = refined.slice(0, LIST_MAX);
  if (edited.length) { detail.edited = edited.slice(0, LIST_MAX); flags.add('item-edit'); }
  const kafra = [num(pa.kafra), num(na.kafra)];
  if (kafra[0] !== kafra[1]) detail.kafra = kafra;
  const cards = [sum(pa.cards), sum(na.cards)], mats = [sum(pa.materials), sum(na.materials)];
  if (cards[0] !== cards[1]) { detail.cards = cards; if (cards[1] > cards[0]) gained = true; }
  if (mats[0] !== mats[1]) detail.materials = mats;
  // 物品增加、或材料增加但 Kafra 點數沒減少（不是買來的）也算獲得
  if (mats[1] > mats[0] && kafra[1] >= kafra[0]) gained = true;
  // Kafra 點數只有賣東西會增加：點數變多卻沒有少任何物品或卡片
  if (kafra[1] > kafra[0] && !pinv.size && cards[1] >= cards[0] && !claim) flags.add('kafra-no-sale');

  if (gained && !claim) flags.add('gain-no-claim');
  if (!Object.keys(detail).length && !flags.size) return null;
  return { detail, flags: [...flags].sort() };
}

const badDoc = (doc) => {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return true;
  const entries = Object.entries(doc);
  return entries.length > 200 || entries.some(([k, v]) => !GAME_KEY.test(k) || typeof v !== 'string') || JSON.stringify(doc).length > MAX_DOC;
};
const shortStr = (v, n) => (typeof v === 'string' ? v.slice(0, n) : null);

export function createGameRoutes({ env, store, send, readBody }) {
  // 正式站：要設 RO_ONLINE=1，而且 ro_game_* 表真的在（每分鐘最多查一次），否則回報關閉
  let probe = { at: 0, ok: false };
  async function enabled() {
    if (!store.ready) return false;
    if (!store.sql) return true;
    if (env.RO_ONLINE !== '1') return false;
    if (Date.now() - probe.at < 60_000) return probe.ok;
    let ok = false;
    try { ok = await store.gameTablesReady(); } catch {}
    probe = { at: Date.now(), ok };
    return ok;
  }

  async function route(req, res, path, acc, sessionHash) {
    const method = req.method;
    // 線上模式關閉（或資料表還沒套用）時回 401，引擎會退回單機模式
    if (!(await enabled())) return send(res, 401, { error: 'offline' });
    const id = acc.id;

    if (path === 'save' && method === 'GET') {
      const s = await store.getGameSave(id);
      return send(res, 200, { rev: s.rev, doc: s.doc, name: displayName(acc) });
    }
    if (path === 'save' && method === 'PUT') {
      const body = await readBody(req);
      const { doc } = body;
      let { rev } = body;
      if (!Number.isInteger(rev) || rev < 0 || badDoc(doc)) return send(res, 400, { error: 'bad_save' });
      const wid = shortStr(body.wid, 40);
      const cur = await store.getGameSave(id);
      // 上一次寫入其實成功、只是回應沒收到：伺服器上的 wid 在這台的 mine 清單裡，就當作接著那一版寫
      if (rev !== cur.rev && cur.wid && Array.isArray(body.mine) && body.mine.includes(cur.wid)) rev = cur.rev;
      if (rev !== cur.rev) return send(res, 409, { error: 'conflict', rev: cur.rev, doc: cur.doc });
      let claim = null;
      const runId = shortStr(body.run, 64);
      const flagsExtra = [];
      if (runId) {
        claim = await store.claimGameRun(id, runId);
        if (claim.status !== 'ok') flagsExtra.push(`claim-${claim.status}`);
      }
      if (body.wipe) flagsExtra.push('wipe');
      const next = await store.putGameSave(id, rev, doc, wid);
      if (next === null) {
        const again = await store.getGameSave(id);
        return send(res, 409, { error: 'conflict', rev: again.rev, doc: again.doc });
      }
      const sum = summarizeSave(cur.doc, doc, { claim: claim?.status === 'ok' ? claim.run : null });
      if (sum || flagsExtra.length) {
        const flags = [...new Set([...(sum?.flags ?? []), ...flagsExtra])].sort();
        const run = claim?.run ? { stage: claim.run.stage, mult: claim.run.mult, secs: Math.round((Date.now() - claim.run.issued) / 1000), ...(claim.run.skip ? { skip: true } : {}) } : {};
        await store.addGameLog(id, 'save', { rev: next, runId, flags, detail: { ...(sum?.detail ?? {}), ...run } }).catch((e) => console.warn('[ro-life] game log', e.message));
      }
      return send(res, 200, { rev: next });
    }
    if (path === 'run' && method === 'POST') {
      const body = await readBody(req);
      const stage = shortStr(body.stage, 40);
      if (!stage) return send(res, 400, { error: 'bad_run' });
      if ((await store.countGameRuns(id, 3600)) >= RUNS_PER_HOUR) return send(res, 429, { error: 'rate' });
      const run = { id: randomBytes(18).toString('base64url'), stage, mult: Math.min(100, Math.max(0, num(body.mult) || 1)), skip: !!body.skip, char: shortStr(body.char, 40) };
      await store.createGameRun(id, run);
      if (run.skip) await store.addGameLog(id, 'run', { runId: run.id, flags: ['skip'], detail: { stage, char: run.char } }).catch((e) => console.warn('[ro-life] game log', e.message));
      return send(res, 200, { run: run.id });
    }
    if (path === 'name' && method === 'POST') {
      const body = await readBody(req);
      const name = shortStr(body.name, 40)?.trim();
      if (!name || name.length > 24) return send(res, 400, { error: 'bad_name' });
      return send(res, 200, { ok: true });
    }
    if ((path === 'visit' || path === 'crash') && method === 'POST') {
      if (path === 'crash') {
        const body = await readBody(req).catch(() => ({}));
        console.warn('[ro-life] crash', id, shortStr(body.message ?? body.msg, 200), shortStr(body.build, 40));
      }
      return send(res, 200, { ok: true });
    }
    if (path === 'logout' && method === 'POST') {
      await store.deleteSession(sessionHash);
      return send(res, 200, { ok: true });
    }
    return send(res, 404, { error: 'not_found' });
  }
  return { route, enabled };
}
