import R from './rules-data.mjs';
import { nameProblem, nameKey, fallbackName } from './name-rules.mjs';

// 282 線上角色的存檔驗證。規則數值來自引擎（games/282-ro-life/tools/dump-rules.mjs 倒成 rules-data.mjs）。
// checkSave(上一版, 這一版, 情境) 回傳 { issues, doc, meta }：issues 是違規清單，doc 是修正後的存檔（沒有要修正時為 null）。
// 只拿這一版和伺服器上的上一版比，所以舊進度一律承認。
// 線上模式下正當的獲得只有兩條路：
//   1. 關卡結算：引擎開打時 POST run 拿憑證、結算存檔時帶回來（合作關卡、接續中斷的關卡、跳過劇情也一樣）。經驗、掉落、卡片只能跟著憑證來。
//   2. 伺服器 op（game-ops.mjs）：買礦、賣東西、精煉由伺服器算好直接寫進存檔。所以存檔裡的 Kafra、材料、精煉值不能自己變多。

export const RULES_SOURCE = R.source;
const SP = R.spawn;
const LATE = 600; // 關卡時間到之後還能打多久（魔王戰、收尾）
const SLACK = 1.25; // 估算以外的餘裕
// 一場關卡的新物品、新卡片上限照引擎的掉落規則算（R.drops，見 runKillCap／poissonCap）
const ITEM_SLACK = 3; // 劇情獎勵之類不算在小怪掉落裡的
const SKIP_ITEMS = 8; // 跳過劇情：劇情獎勵＋職業武器
const PET_NEW = 2, PET_GRACE = 30; // 一場最多孵幾顆蛋；親密度每 5 秒 +1（引擎 lT）外加的餘裕

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const int = (v) => Math.trunc(num(v));
const parse = (doc, key, fallback) => {
  try { return JSON.parse(doc?.[key] ?? 'null') ?? fallback; } catch { return fallback; }
};
const list = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

// ── 經驗：等級＋經驗 ↔ 累積經驗 ──
const cumTable = (next) => { const c = [0]; for (const n of next) c.push(c[c.length - 1] + n); return c; };
const BASE_CUM = cumTable(R.expNext), JOB_CUM = cumTable(R.jobNext);
const toCum = (cum, lv, exp) => cum[Math.max(0, Math.min(cum.length - 1, lv - 1))] + Math.max(0, exp);
function fromCum(cum, total, max) {
  let lv = 1;
  while (lv < max && cum[lv] <= total) lv++;
  return lv >= max ? [max, 0] : [lv, Math.floor(total - cum[lv - 1])];
}
const jobMax = (c) => R.jobs[String(c.promotion ?? c.job ?? '')]?.jobMax ?? R.jobs[c.job]?.jobMax ?? 50;

// ── 能力點 ──
const STATS = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];
const statStep = (v) => Math.floor((v - 1) / 10) + 2; // 引擎 QA：從 v 升到 v+1 的花費
export const statCost = (v) => { let s = 0; for (let t = 1; t < Math.min(99, int(v)); t++) s += statStep(t); return s; };
export const statSpent = (stats) => STATS.reduce((a, k) => a + statCost(obj(stats)[k] ?? 1), 0);
const statsOk = (stats) => STATS.every((k) => { const v = obj(stats)[k] ?? 1; return Number.isInteger(v) && v >= 1 && v <= 99; });
const statPts = (lv) => R.statPts[Math.max(0, Math.min(R.statPts.length - 1, lv - 1))];

// ── 天賦（引擎 QE／JE）：每個職業一棵樹各自計點。角色職業（job，轉職不會改）的樹＝職業等級，
// 同一職業線上前面的職業＝該階的滿點（r7），其他職業的樹 0 點；每項不能超過 maxRank ──
const lineage = (job) => { const out = []; for (let j = job, n = 0; j && n < 5; j = R.jobs[j]?.base, n++) out.unshift(j); return out; };
const PROMOTION_STAGE = 'prt_castle'; // 轉職的劇情關（引擎 choosePromotion）

export function talentProblem(c) {
  const t = obj(c.talents), job = String(c.job ?? ''), jl = Math.max(1, int(c.jobLevel) || 1), line = lineage(job);
  const spent = {};
  for (const [id, rank] of Object.entries(t)) {
    const def = R.talents[id];
    if (!def) return { id, why: 'unknown' };
    if (!Number.isInteger(rank) || rank < 0 || rank > def.maxRank) return { id, why: 'rank' };
    spent[def.job] = (spent[def.job] ?? 0) + rank;
  }
  // 二轉以上的職業樹只能點一個分支（引擎 r5／qp：c.spec，第一次點的分支就是專精）
  if ((R.jobs[job]?.rank ?? 1) >= 2) {
    const branches = new Set(Object.keys(t).filter((id) => R.talents[id].job === job && t[id] > 0).map((id) => R.talents[id].branch));
    if (branches.size > 1 || (c.spec !== undefined && branches.size === 1 && !branches.has(c.spec))) return { tree: job, why: 'spec' };
  }
  for (const [tree, n] of Object.entries(spent)) {
    const pts = tree === job ? jl : line.includes(tree) ? SP.talentRankPts[R.jobs[tree]?.rank ?? 1] ?? 0 : 0;
    if (n > pts) return { tree, spent: n, max: pts };
  }
  return null;
}

// ── 一場關卡最多能拿的基本經驗（逐秒累加；作弊的人一定報最大，所以一律用 3 人隊的出怪量）──
const monExp = (id) => num(R.monsters[id]?.exp);
const monLv = (id) => num(R.monsters[id]?.level);
const ep = (lv, mlv) => { const d = lv - mlv; return d <= 0 ? 1 : Math.max(0.01, 0.5 ** d); };
// party＝這一場的人數（行程收據上的）；不知道就用 3 人隊（最寬）。每個人都拿每隻怪的完整經驗（引擎 payKill），所以倍率就是出怪倍率 Z0
export function runExpCap(stageId, secs, { mult = 2, level = 1, skip = false, party = null } = {}) {
  const s = R.stages[stageId];
  // 無盡之塔不走關卡憑證（塔內沒有經驗，而且它的 runLength 等於沒有上限）；跳過劇情的結算是 baseExp 0（引擎 oI → Dh）
  if (!s || stageId === 'endless' || skip || !s.waves.length) return 0;
  const m = Math.max(1, Math.min(R.difficulty.max, num(mult) || 1));
  const count = Math.min(R.maxCount, 1 + 10 * (m - 1)); // sr()：出怪數 1～3 佔難度倍率的 1/5
  const events = Math.min(SP.maxEvents, 1 + 5 * (m - 1)); // 事件數 1～2 也佔 1/5
  const partyMult = SP.partyCount[party == null ? SP.partyCount.length - 1 : Math.max(1, Math.min(SP.partyCount.length - 1, int(party)))];
  const C = count * partyMult;
  const T = Math.max(0, Math.min(num(secs), s.runLength + LATE));
  const waveAt = (t) => s.waves.find((w) => t >= w.from && t < w.to) ?? s.waves[s.waves.length - 1];
  const killExp = (w) => Math.max(0, ...w.pool.map((id) => monExp(id) * ep(level, monLv(id))));
  let total = 0;
  for (let t = 0; t < T; t++) { const w = waveAt(t); total += w.perSecond * C * killExp(w); }
  const horde = SP.hordeEvery / events;
  for (let t = horde; t <= T && t < s.runLength; t += horde) total += SP.hordeRings * Math.min(SP.hordeMax, SP.hordeBase + t / SP.hordeGrowth) * C * killExp(waveAt(t));
  const elite = SP.eliteEvery / events;
  for (let t = 0; t <= T; t += elite) total += (R.eliteExp - 1) * killExp(waveAt(t)) * partyMult;
  for (const b of s.bossAt) if (b.t <= T) total += monExp(b.id) * ep(level, monLv(b.id));
  return total * SLACK;
}
// 一場關卡最多能殺幾隻怪（和 runExpCap 同一個出怪模型，只是不乘經驗）、時間內出場過幾隻頭目
export function runKillCap(stageId, secs, { mult = 2, party = null } = {}) {
  const s = R.stages[stageId];
  if (!s || stageId === 'endless' || !s.waves.length) return { kills: 0, bosses: 0 };
  const m = Math.max(1, Math.min(R.difficulty.max, num(mult) || 1));
  const count = Math.min(R.maxCount, 1 + 10 * (m - 1)), events = Math.min(SP.maxEvents, 1 + 5 * (m - 1));
  const partyMult = SP.partyCount[party == null ? SP.partyCount.length - 1 : Math.max(1, Math.min(SP.partyCount.length - 1, int(party)))];
  const C = count * partyMult, T = Math.max(0, Math.min(num(secs), s.runLength + LATE));
  const waveAt = (t) => s.waves.find((w) => t >= w.from && t < w.to) ?? s.waves[s.waves.length - 1];
  let kills = 0;
  for (let t = 0; t < T; t++) kills += waveAt(t).perSecond * C;
  const horde = SP.hordeEvery / events;
  for (let t = horde; t <= T && t < s.runLength; t += horde) kills += SP.hordeRings * Math.min(SP.hordeMax, SP.hordeBase + t / SP.hordeGrowth) * C;
  kills += Math.floor(T / (SP.eliteEvery / events) + 1) * partyMult;
  const bosses = s.bossAt.filter((b) => b.t <= T).length;
  return { kills: (kills + bosses) * SLACK, bosses };
}
// 平均 lam 次的稀有事件，實際發生超過幾次的機率才低於 p（卜瓦松分布）：卡片上限用，正常玩家千萬場才會碰到一次
export function poissonCap(lam, p = 1e-7) {
  let k = 0, term = Math.exp(-Math.max(0, lam)), cdf = term;
  while (1 - cdf > p && k < 200) { k++; term *= lam / k; cdf += term; }
  return Math.max(1, k);
}
const runSecs = (claim, now) => (claim?.issued ? Math.max(0, (now - claim.issued) / 1000) : 0);

// ── 物品 ──
const itemDef = (id) => R.items[String(id)];
export function sellValue(it) {
  const base = R.sellBase[String(it.itemId)] ?? 0;
  if (!base) return 0;
  const q = Math.max(0, Math.min(R.maxQuality, int(it.quality)));
  return Math.round((base * R.qualityMult[q] + 15 * list(it.affixes).length + 10 * list(it.cards).length) * (1 + 0.25 * int(it.refine)));
}
export const cardValue = (id) => num(R.cardValue[String(id)]);
function badNewItem(it, { maxIlvl, maxTier }) {
  const def = itemDef(it.itemId);
  if (!def) return 'unknown-item';
  const q = it.quality ?? 0;
  if (!Number.isInteger(q) || q < 0 || q > R.maxQuality) return 'quality';
  if (list(it.affixes).length > (R.affixMax?.[q] ?? R.maxQuality)) return 'affixes';
  if (it.ilvl != null && !(num(it.ilvl) >= 0 && num(it.ilvl) <= maxIlvl)) return 'ilvl';
  if (it.tier != null && !(num(it.tier) >= 0 && num(it.tier) <= maxTier)) return 'tier';
  if (int(it.refine) !== 0) return 'refine';
  if (list(it.cards).some((c) => c != null)) return 'cards';
  if (list(it.cards).length > Math.max(def.cardSlots, ...def.slotsByQuality)) return 'slots';
  return null;
}
const identity = (i) => JSON.stringify([String(i.itemId), i.quality ?? null, i.ilvl ?? null, i.tier ?? null, i.affixes ?? null]);
const socketed = (inv) => inv.reduce((a, i) => a + list(i.cards).filter((c) => c != null).length, 0);
const MAX_ILVL = Math.max(...Object.values(R.stages).map((s) => s.ilvl));
const MAX_TIER = Math.max(...Object.values(R.stages).map((s) => s.tier));

// 詞綴（引擎 d9，規則資料的 affix 由 dump-rules.mjs 從引擎取樣）：六維每種最多一條、值＝階級倍率；
// 其他能力是基礎值 × 階級倍率（取到小數 3 位）；傳說另有一條技能詞綴（0.1～0.2）。回傳不合理的原因或 null
const AF = R.affix ?? null;
const SKILL_ID = /^[\w.:-]{1,48}$/;
export function affixProblem(it) {
  if (!AF) return null;
  const mult = Math.max(...AF.tierMult.slice(0, Math.max(1, Math.min(AF.tierMult.length - 1, int(it.tier ?? 1))) + 1));
  const seen = new Set();
  for (const a of list(it.affixes)) {
    if (!a || typeof a !== 'object' || typeof a.stat !== 'string' || typeof a.value !== 'number' || !Number.isFinite(a.value) || a.value <= 0) return 'shape';
    if (seen.has(a.stat)) return 'dup';
    seen.add(a.stat);
    if (a.stat === 'skill') {
      if (int(it.quality) !== R.maxQuality || a.value > AF.skill[1] + 1e-9 || typeof a.skill !== 'string' || !SKILL_ID.test(a.skill)) return 'skill';
      continue;
    }
    const max = AF.stats.includes(a.stat) ? mult : a.stat in AF.base ? AF.base[a.stat] * mult : null;
    if (max === null) return 'stat';
    if (a.value > max + 1e-6) return 'value';
  }
  return null;
}

const jobOk = (j) => !(R.jobs[String(j)]?.rank >= 2); // 建角不能直接是二轉以上（一轉的天賦樹會平白拿到滿點）；規則資料沒有的職業不管
const QUICK_SECS = 10; // 發憑證後這麼快就領到東西：只記錄，之後收緊用
const END_GRACE = 30; // 結算收據的連線秒數加這麼多（連線比開打晚、斷線重連）
const inc = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);
const ORE_IDS = new Set([...Object.keys(R.orePrice ?? {}), ...Object.values(R.ores ?? {}).map(String)]);

// strict（RO_ONLINE_STRICT=1）：跟時間、數量有關，或還沒用正式站紀錄對過的規則，平常只記錄（issue 帶 fixed:false），strict 才真的修正。
// 其他規則是引擎不可能產生的狀態（重複的 uid、沒有 uid、換職業、卡片憑空換種類…），一律修正。
// 合作關卡（收據由大廳簽、game.mjs 驗過才放進 claim，格式見 coop.mjs）：
//   claim.party：行程收據上的人數 → 經驗上限照那個人數的出怪量。沒有收據時，coop（RO_COOP_RECEIPT=1）當單人算，沒開照舊用 3 人隊。
//   claim.end：結算收據。連線秒數、房主宣布打倒過的怪、這個人擲骰拿到的東西，都拿來核對，但先只記錄（coop-secs／coop-mvp／coop-loot）。
// nameTaken：別的帳號已經登記的角色名（nameKey 的集合，game.mjs 從 ro_game_name 查好傳進來）
export function checkSave(prevDoc, nextDoc, { now = Date.now(), claim = null, strict = false, coop = false, nameExtra = [], nameTaken = null } = {}) {
  const issues = [];
  const soft = (issue) => { issues.push(strict ? issue : { ...issue, fixed: false }); return strict; };
  const secs = runSecs(claim, now);
  const stageDef = claim ? R.stages[claim.stage] ?? null : null;
  const players = claim?.party ?? (coop ? 1 : null);
  const end = claim?.end ?? null;
  const endSecs = end ? Math.min(secs, Math.max(0, num(end.secs)) + END_GRACE) : secs;
  const killed = end ? new Set(list(end.killed).map(String)) : null;
  // 合作關卡的憑證卻沒有（有效的）結算收據：上面那些核對都做不了，所以不帶收據不能比帶收據划算。
  // 先記錄（coop-noend）；strict 時這張憑證不給新物品、卡片，也不記打倒與通關
  const noEnd = !!claim?.party && !end;
  const prevChars = new Map(list(parse(prevDoc, 'characters.v1', [])).filter((c) => c?.id).map((c) => [String(c.id), c]));
  const wornInv = new Map(list(obj(parse(nextDoc, 'account.v1', {})).inventory).filter((i) => i?.uid).map((i) => [String(i.uid), i]));
  const newIds = new Set(), seenChars = new Map();
  let charsFixed = false, used = null, topGain = 0, topCap = 0, credited = false;

  // 沒有 id、id 重複的角色不收（引擎建角一定給 id；沒有 id 的角色下面整段都不會查）。
  // 「舊進度一律承認」：上一版就有的那幾筆照留（不驗證、也進不了塔與跳關），只擋新出現的
  const legacy = (rows) => { const m = new Map(); for (const r of rows) { const k = JSON.stringify(r); m.set(k, (m.get(k) ?? 0) + 1); } return m; };
  const take = (m, k) => { const n = m.get(k) ?? 0; if (n > 0) m.set(k, n - 1); return n > 0; };
  const hasId = (c) => c && typeof c === 'object' && !Array.isArray(c) && (typeof c.id === 'string' || typeof c.id === 'number') && c.id !== '' && c.id !== 0;
  const prevList = list(parse(prevDoc, 'characters.v1', []));
  const oldNoId = legacy(prevList.filter((c) => !hasId(c)));
  const oldIdCount = new Map();
  for (const c of prevList) if (hasId(c)) oldIdCount.set(String(c.id), (oldIdCount.get(String(c.id)) ?? 0) + 1);
  const nextChars = [];
  for (const c of list(parse(nextDoc, 'characters.v1', []))) {
    if (!hasId(c)) {
      if (take(oldNoId, JSON.stringify(c))) nextChars.push(c);
      else { issues.push({ code: 'char-noid' }); charsFixed = true; }
      continue;
    }
    const n = (seenChars.get(String(c.id)) ?? 0) + 1;
    seenChars.set(String(c.id), n);
    if (n > Math.max(1, oldIdCount.get(String(c.id)) ?? 0)) { issues.push({ code: 'char-dup', char: String(c.id) }); charsFixed = true; continue; }
    nextChars.push(c);
  }

  for (const c of nextChars) {
    if (!hasId(c)) continue;
    const id = String(c.id), p = prevChars.get(id);
    const fix = (code, extra, apply) => { issues.push({ code, char: id, ...extra }); apply(); charsFixed = true; };
    // 角色名（name-rules.mjs）：新角色或改名時才查，舊名字不追溯。不能用的名字：改名的退回原名，新角色換成「冒險者NNNN」並要求改名（引擎的 rename）
    if (!p || c.name !== p.name) {
      const why = nameProblem(c.name, { extra: nameExtra }) ?? (nameTaken?.has(nameKey(c.name)) ? 'taken' : null);
      if (why) fix('name', { why }, () => {
        if (p && typeof p.name === 'string' && p.name) c.name = p.name;
        else { c.name = fallbackName(id); c.rename = true; }
      });
    }
    if (!p) {
      newIds.add(id);
      if (c.dev) fix('new-dev', {}, () => { delete c.dev; });
      if (!jobOk(c.job)) fix('new-job', { job: c.job ?? null }, () => { c.job = lineage(String(c.job ?? ''))[0] ?? 'swordsman'; });
      if (int(c.level) > 1 || int(c.jobLevel) > 1 || num(c.exp) > 0 || num(c.jobExp) > 0)
        fix('new-high', { lv: int(c.level), jl: int(c.jobLevel) }, () => { c.level = 1; c.exp = 0; c.jobLevel = 1; c.jobExp = 0; });
      if (c.promotion) fix('new-promoted', { job: c.promotion }, () => { delete c.promotion; });
      if (list(c.mvpsDefeated).length) fix('mvps', { ids: list(c.mvpsDefeated) }, () => { c.mvpsDefeated = []; });
      if (list(c.stagesCleared).length) fix('stages', { ids: list(c.stagesCleared) }, () => { c.stagesCleared = []; });
    } else {
      if (c.dev && !p.dev) fix('dev', {}, () => { delete c.dev; });
      // 職業不會變（轉職寫在 promotion）；天賦點數照職業線算，換職業等於換一整棵樹
      if (c.job !== p.job && (R.jobs[String(p.job)] || !jobOk(c.job))) fix('job', { from: p.job ?? null, to: c.job ?? null }, () => { c.job = p.job; });
      const was = toCum(BASE_CUM, int(p.level) || 1, num(p.exp)), now_ = toCum(BASE_CUM, int(c.level) || 1, num(c.exp));
      const jwas = toCum(JOB_CUM, int(p.jobLevel) || 1, num(p.jobExp)), jnow = toCum(JOB_CUM, int(c.jobLevel) || 1, num(c.jobExp));
      // 一張憑證只給一個角色（同一場關卡只會有一個角色在打）；跳過劇情的憑證綁定角色
      let cap = 0, jcap = 0;
      const mine = !!claim && (used === null || used === id) && (!claim.char || claim.char === id);
      if ((now_ > was || jnow > jwas) && mine) {
        used = id;
        const opts = { mult: claim.mult, level: int(p.level) || 1, skip: claim.skip, party: players };
        cap = runExpCap(claim.stage, secs, opts);
        // 在本局連線的秒數比憑證的牆鐘短：照連線秒數算的上限先記錄，strict 才用
        if (end && endSecs < secs) {
          const tight = runExpCap(claim.stage, endSecs, opts);
          if (now_ - was > tight && soft({ code: 'coop-secs', char: id, gain: Math.round(now_ - was), cap: Math.round(tight), secs: [Math.round(endSecs), Math.round(secs)] })) cap = tight;
        }
        // 職業經驗：基本 × 1.275 × 該關倍率（引擎 Rf.kill）；轉職後不再增加（Dh）
        jcap = p.promotion ? 0 : cap * R.jobFactor * Math.max(1, num(R.stages[claim.stage]?.jobExp) || 1);
      }
      if (now_ > was) { topGain = Math.max(topGain, now_ - was); topCap = Math.max(topCap, cap); }
      if (now_ - was > cap || int(c.level) > R.baseMax) {
        fix(mine ? 'exp' : 'exp-no-claim', { gain: Math.round(now_ - was), cap: Math.round(cap), ratio: cap ? +((now_ - was) / cap).toFixed(2) : null, lv: [int(p.level), int(c.level)] }, () => {
          [c.level, c.exp] = fromCum(BASE_CUM, Math.max(was, Math.min(now_, was + cap)), R.baseMax);
        });
      }
      const jmax = jobMax(c);
      if (jnow - jwas > jcap || int(c.jobLevel) > jmax) {
        fix(mine ? 'job-exp' : 'job-exp-no-claim', { gain: Math.round(jnow - jwas), cap: Math.round(jcap), jl: [int(p.jobLevel), int(c.jobLevel)], max: jmax }, () => {
          [c.jobLevel, c.jobExp] = fromCum(JOB_CUM, Math.max(jwas, Math.min(jnow, jwas + jcap)), jmax);
        });
      }
      if (int(c.level) < int(p.level) || int(c.jobLevel) < int(p.jobLevel)) issues.push({ code: 'level-down', char: id, fixed: false });
      // 打倒的 MVP、通過的關卡、轉職（無盡之塔開幾層、能不能進塔都看這些）：只能跟著該關的憑證來（引擎 Dh／Jk 結算時才寫）
      const forMe = !!claim && (!claim.char || claim.char === id) && (used === null || used === id);
      const bossT = new Map(forMe ? (stageDef?.bossAt ?? []).map((b) => [String(b.id), num(b.t)]) : []);
      const had = new Set(list(p.mvpsDefeated).map(String));
      const badMvp = list(c.mvpsDefeated).filter((x) => !had.has(String(x)) && !bossT.has(String(x)));
      if (badMvp.length) fix('mvps', { ids: badMvp, stage: claim?.stage ?? null }, () => { c.mvpsDefeated = list(c.mvpsDefeated).filter((x) => !badMvp.includes(x)); });
      const cleared = new Set(list(p.stagesCleared).map(String));
      const badStage = list(c.stagesCleared).filter((x) => !cleared.has(String(x)) && !(forMe && String(x) === claim.stage));
      if (badStage.length) fix('stages', { ids: badStage, stage: claim?.stage ?? null }, () => { c.stagesCleared = list(c.stagesCleared).filter((x) => !badStage.includes(x)); });
      // 頭目還沒出場（bossAt 的秒數）就記成打倒、通關：先記錄。憑證是開打時發的，牆鐘只會比遊戲時間長；
      // 但發憑證的請求失敗重試時會晚發，所以不直接擋（跳過劇情的憑證不看時間）
      if (forMe && !claim.skip) {
        const earlyMvp = list(c.mvpsDefeated).filter((x) => !had.has(String(x)) && bossT.get(String(x)) > secs);
        if (earlyMvp.length && soft({ code: 'mvp-early', char: id, ids: earlyMvp, secs: Math.round(secs), stage: claim.stage })) { c.mvpsDefeated = list(c.mvpsDefeated).filter((x) => !earlyMvp.includes(x)); charsFixed = true; }
        const lastT = Math.max(0, ...bossT.values());
        const earlyStage = list(c.stagesCleared).some((x) => !cleared.has(String(x)) && String(x) === claim.stage) && lastT > secs;
        if (earlyStage && soft({ code: 'stage-early', char: id, secs: Math.round(secs), stage: claim.stage })) { c.stagesCleared = list(c.stagesCleared).filter((x) => String(x) !== claim.stage); charsFixed = true; }
      }
      // 合作關卡：房主沒宣布打倒過的頭目不算（大廳從 mobs 封包記的；它的對照表只在記憶體，所以先記錄）
      if (forMe && !claim.skip && killed) {
        const ghost = list(c.mvpsDefeated).filter((x) => !had.has(String(x)) && bossT.has(String(x)) && !killed.has(String(x)));
        const last = stageDef?.bossAt.at(-1)?.id;
        const ghostClear = !!last && !killed.has(String(last)) && list(c.stagesCleared).some((x) => !cleared.has(String(x)) && String(x) === claim.stage);
        if ((ghost.length || ghostClear) && soft({ code: 'coop-mvp', char: id, ids: ghost, clear: ghostClear, stage: claim.stage })) {
          c.mvpsDefeated = list(c.mvpsDefeated).filter((x) => !ghost.includes(x));
          if (ghostClear) c.stagesCleared = list(c.stagesCleared).filter((x) => String(x) !== claim.stage);
          charsFixed = true;
        }
      }
      if (forMe && noEnd) {
        const fresh = list(c.mvpsDefeated).filter((x) => !had.has(String(x)) && bossT.has(String(x)));
        const clear = list(c.stagesCleared).some((x) => !cleared.has(String(x)) && String(x) === claim.stage);
        if ((fresh.length || clear) && soft({ code: 'coop-noend', char: id, ids: fresh, clear, stage: claim.stage })) {
          c.mvpsDefeated = list(c.mvpsDefeated).filter((x) => !fresh.includes(x));
          if (clear) c.stagesCleared = list(c.stagesCleared).filter((x) => String(x) !== claim.stage);
          charsFixed = true;
        }
      }
      if (list(c.mvpsDefeated).some((x) => !had.has(String(x))) || list(c.stagesCleared).some((x) => !cleared.has(String(x)))) credited = true;
      // 轉職只發生在普隆德拉城的劇情裡（引擎 choosePromotion），之後不能再換
      if ((c.promotion ?? null) !== (p.promotion ?? null)) {
        const ok = !p.promotion && forMe && claim.stage === PROMOTION_STAGE && R.jobs[c.promotion]?.base === c.job;
        if (!ok) fix('promotion', { from: p.promotion ?? null, to: c.promotion ?? null, stage: claim?.stage ?? null }, () => { if (p.promotion) c.promotion = p.promotion; else delete c.promotion; });
      }
    }
    // 穿戴限制（引擎 Ck／En／Tn）：欄位要對、職業與性別要能穿、新手裝備只有原主能穿。先記錄，strict 才卸下
    for (const [slot, uid] of Object.entries(obj(c.equipped))) {
      const it = uid ? wornInv.get(String(uid)) : null, def = it ? itemDef(it.itemId) : null;
      if (!def || !R.equipSlots) continue;
      const gear = R.equipSlots[slot];
      const fits = !!gear && (gear === def.slot || (slot === 'shield' && def.slot === 'weapon' && list(R.dual?.[c.job]).includes(def.wtype)));
      const why = !fits ? 'slot' : def.jobsAll && !def.jobsAll.includes(c.job) ? 'job' : def.gender && def.gender !== c.look?.gender ? 'gender' : it.owner && String(it.owner) !== id ? 'owner' : null;
      if (why && soft({ code: 'equip-bad', char: id, slot, item: String(it.itemId), why })) { delete c.equipped[slot]; charsFixed = true; }
    }
    // 同一件裝備不能同時穿在兩個欄位（塔的開局快照照 equipped 算能力）：先記錄，strict 才卸下後面那幾格
    const worn = new Set(), dupSlots = [];
    for (const [slot, uid] of Object.entries(obj(c.equipped))) { if (!uid) continue; if (worn.has(String(uid))) dupSlots.push(slot); else worn.add(String(uid)); }
    if (dupSlots.length && soft({ code: 'equip-dup', char: id, slots: dupSlots })) { for (const s of dupSlots) delete c.equipped[s]; charsFixed = true; }
    // 能力點、天賦（有變動才查，舊資料不追溯；不合理就重置，等同遊戲內的重置）
    const lv = Math.max(1, Math.min(R.baseMax, int(c.level) || 1));
    const same = (k) => p && JSON.stringify(p[k] ?? null) === JSON.stringify(c[k] ?? null) && int(p.level) === int(c.level) && int(p.jobLevel) === int(c.jobLevel) && p.job === c.job;
    if (c.stats != null && !same('stats') && (!statsOk(c.stats) || statSpent(c.stats) > statPts(lv)))
      fix('stats', { spent: statsOk(c.stats) ? statSpent(c.stats) : null, max: statPts(lv) }, () => { c.stats = Object.fromEntries(STATS.map((k) => [k, 1])); });
    if (c.talents != null && !same('talents')) {
      const bad = talentProblem(c);
      if (bad) fix('talents', bad, () => { c.talents = {}; delete c.spec; });
    }
  }

  // ── 帳號 ──
  const pa = obj(parse(prevDoc, 'account.v1', {})), na = obj(parse(nextDoc, 'account.v1', {}));
  const pinv = list(pa.inventory).filter((i) => i?.uid);
  const pByUid = new Map(pinv.map((i) => [String(i.uid), i]));
  let accFixed = false;
  const stage = claim && !claim.skip ? stageDef : null;
  const limits = { maxIlvl: stage ? stage.ilvl : MAX_ILVL, maxTier: stage ? stage.tier : MAX_TIER };
  // 合作關卡的掉落帳：全程由大廳擲骰（end.full）時，新裝備與新卡片要對得上這個人擲骰拿到的東西。劇情關的獎勵不經過擲骰，不查
  const ledgerOn = !!end?.full && !!stage && !stage.story && !stage.storyOnly;
  const ledger = ledgerOn ? new Map() : null, cardLedger = ledgerOn ? new Map() : null;
  if (ledgerOn) for (const w of list(end.won)) { const [kind, ref, q] = list(w); if (kind === 'loot') inc(ledger, `${ref}|${Math.max(0, int(q))}`); else if (kind === 'card') inc(cardLedger, String(ref)); }
  const keep = [], dropped = new Set(), seenUid = new Map();
  const oldNoUid = legacy(list(pa.inventory).filter((i) => !i?.uid));
  const oldUidCount = new Map();
  for (const i of pinv) oldUidCount.set(String(i.uid), (oldUidCount.get(String(i.uid)) ?? 0) + 1);
  let fresh = 0;
  // 憑證發出不到 QUICK_SECS 秒就結算：平常照給（只記 claim-quick），strict 時這張憑證不給物品與卡片（不然每張憑證一發就有底數可以領）
  const quick = !!claim && !claim.skip && secs < QUICK_SECS;
  // 上限照引擎的掉落規則：小怪掉的裝備一場最多 floor(4 × 難度倍率) 件、出場過的頭目一隻一件；卡片是每隻怪萬分之一（頭目千分之一）的稀有事件
  const off = strict && (quick || noEnd), dm = Math.max(1, Math.min(R.difficulty.max, num(claim?.mult) || 1));
  const kc = claim && !claim.skip ? runKillCap(claim.stage, secs, { mult: claim.mult, party: players }) : { kills: 0, bosses: 0 };
  const itemCap = !claim || off ? 0 : claim.skip ? SKIP_ITEMS : Math.floor(R.drops.mobLoot * dm) + kc.bosses + ITEM_SLACK;
  for (let it of list(na.inventory)) {
    // 物品一定有 uid（引擎 Hh），而且不重複：沒有 uid 的東西下面都查不到、重複的 uid 等於複製物品。
    // 上一版就有的照留（賣出、精煉、上架、交易都不認沒有 uid 的東西，重複的只算一件），只擋新出現的
    if (!it || typeof it !== 'object' || !it.uid || (typeof it.uid !== 'string' && typeof it.uid !== 'number')) {
      if (take(oldNoUid, JSON.stringify(it))) keep.push(it);
      else { issues.push({ code: 'item-nouid' }); accFixed = true; }
      continue;
    }
    const uid = String(it.uid);
    const seenN = (seenUid.get(uid) ?? 0) + 1;
    seenUid.set(uid, seenN);
    if (seenN > Math.max(1, oldUidCount.get(uid) ?? 0)) { issues.push({ code: 'item-dup', item: String(it.itemId) }); accFixed = true; continue; }
    const p = pByUid.get(uid);
    if (!p) {
      const def = itemDef(it.itemId);
      if (it.owner != null && newIds.has(String(it.owner)) && def?.starter) { keep.push(it); continue; }
      // 新物品只能來自關卡結算
      const bad = claim ? badNewItem(it, limits) : 'no-claim';
      if (bad) { issues.push({ code: 'item-' + bad, item: String(it.itemId), q: it.quality ?? null, ilvl: it.ilvl ?? null, tier: it.tier ?? null }); dropped.add(uid); accFixed = true; continue; }
      const af = affixProblem(it);
      if (af && soft({ code: 'item-affix', item: String(it.itemId), why: af, q: it.quality ?? null, tier: it.tier ?? null })) { dropped.add(uid); accFixed = true; continue; }
      if (ledger) {
        const key = `${it.itemId}|${Math.max(0, int(it.quality))}`, left = ledger.get(key) ?? 0;
        if (left > 0) ledger.set(key, left - 1);
        else if (soft({ code: 'coop-loot', item: String(it.itemId), q: it.quality ?? null })) { dropped.add(uid); accFixed = true; continue; }
      }
      if (++fresh > itemCap) {
        if (fresh === itemCap + 1) issues.push({ code: 'item-count', cap: itemCap, ...(strict ? {} : { fixed: false }) });
        if (strict) { dropped.add(uid); accFixed = true; continue; }
      }
      keep.push(it);
      continue;
    }
    // 同一件物品（同 uid）不能換成別的東西；精煉只能由伺服器 op 提升；卡槽數不會變多
    if (identity(it) !== identity(p)) { issues.push({ code: 'item-edit', item: String(p.itemId) }); it = { ...it, itemId: p.itemId, quality: p.quality, ilvl: p.ilvl, tier: p.tier, affixes: p.affixes }; accFixed = true; }
    if (int(it.refine) > int(p.refine)) { issues.push({ code: 'refine', item: String(it.itemId), refine: [int(p.refine), int(it.refine)] }); it = { ...it, refine: int(p.refine) }; accFixed = true; }
    const def = itemDef(p.itemId);
    const slots = Math.max(list(p.cards).length, def ? def.slotsByQuality?.[Math.max(0, Math.min(R.maxQuality, int(p.quality)))] ?? def.cardSlots : 0);
    if (list(it.cards).length > slots) { issues.push({ code: 'slots', item: String(p.itemId), slots: [slots, list(it.cards).length] }); it = { ...it, cards: list(it.cards).slice(0, slots) }; accFixed = true; }
    keep.push(it);
  }
  // 拿掉的物品如果已經裝在角色身上，裝備欄也要清掉
  if (dropped.size) for (const c of nextChars) for (const [slot, uid] of Object.entries(obj(c?.equipped))) if (dropped.has(String(uid))) { delete c.equipped[slot]; charsFixed = true; }

  // 卡片：每一種各自算（庫存＋插在裝備上的）。鑲卡、拆卡只是搬動，數量不變；某一種變多就是獲得，只能來自關卡結算、而且有上限。
  // 不存在的卡片編號不能變多；不是這一關的怪掉的卡先記錄（strict 才退回）；跳過劇情的憑證沒有卡片
  const ncards = obj(na.cards), pcards = obj(pa.cards);
  const tally = (cards, inv) => {
    const m = new Map();
    for (const [cid, n] of Object.entries(cards)) { const v = Math.max(0, int(n)); if (v) m.set(cid, v); }
    for (const i of inv) for (const c of list(i.cards)) if (c != null) m.set(String(c), (m.get(String(c)) ?? 0) + 1);
    return m;
  };
  const before = tally(pcards, pinv), after = tally(ncards, keep.filter((i) => i?.uid));
  const ups = [...after].map(([cid, n]) => [cid, n - (before.get(cid) ?? 0)]).filter(([, d]) => d > 0);
  for (const [cid, n] of Object.entries(ncards)) if ((!R.cards[cid] || !(int(n) >= 0)) && !ups.some(([u]) => u === cid)) issues.push({ code: 'card-unknown', card: cid, fixed: false });
  const stageMon = stage ? new Set([...stage.waves.flatMap((w) => list(w.pool)), ...stage.bossAt.map((b) => b.id), ...list(stage.minis), ...list(stage.bosses)].map(String)) : null;
  // 殺怪數上限在高難度、多人時很寬（出怪模型的理論最大值），所以再跟原本「3 張＋每分鐘 1 張」取小的
  const cardCap = claim && !claim.skip && !off ? Math.min(poissonCap((kc.kills * R.drops.card + kc.bosses * R.drops.cardBoss) * dm), Math.round(3 + secs / 60)) : 0;
  const back = new Map();
  let cardGain = 0;
  for (const [cid, d] of ups) {
    if (!R.cards[cid]) { issues.push({ code: 'card-unknown', card: cid, gain: d }); back.set(cid, d); continue; }
    if (stageMon && !stageMon.has(String(R.cards[cid].monster)) && soft({ code: 'card-stage', card: cid, stage: claim.stage })) { back.set(cid, d); continue; }
    const won = cardLedger ? cardLedger.get(cid) ?? 0 : d;
    if (d > won && soft({ code: 'coop-loot', card: cid, gain: d, won })) { back.set(cid, d - won); cardGain += won; continue; }
    cardGain += d;
  }
  if (cardGain > cardCap) {
    issues.push({ code: claim ? 'cards' : 'cards-no-claim', gain: cardGain, cap: cardCap });
    for (const [cid, d] of ups) back.set(cid, d);
    cardGain = 0;
  }
  // 退回：先扣庫存，不夠再把這次新插上去的拆掉；同一次存檔裡變少的種類補回上一版的數量（換種類的不會因此弄丟原本的卡）
  if (back.size) for (const [cid, n] of before) { const lost = n - (after.get(cid) ?? 0); if (lost > 0) ncards[cid] = Math.max(0, int(ncards[cid])) + lost; }
  for (let [cid, d] of back) {
    const have = Math.max(0, int(ncards[cid])), cut = Math.min(have, d);
    if (have - cut > 0) ncards[cid] = have - cut; else delete ncards[cid];
    d -= cut;
    for (let i = 0; i < keep.length && d > 0; i++) {
      if (!keep[i]?.uid) continue;
      const cs = list(keep[i].cards), was = list(pByUid.get(String(keep[i].uid))?.cards);
      if (!cs.some((c, k) => c != null && String(c) === cid && String(was[k]) !== cid)) continue;
      keep[i] = { ...keep[i], cards: cs.map((c, k) => (d > 0 && c != null && String(c) === cid && String(was[k]) !== cid ? (d--, null) : c)) };
    }
    accFixed = true;
  }

  // Kafra 與材料：買賣在伺服器 op 裡算，存檔只能變少（染色、轉職分支、塔重置等花費）。材料不分種類都一樣（濃縮礦也是）
  const k0 = num(pa.kafra), k1 = num(na.kafra);
  if (k1 > k0 || k1 < 0) { issues.push({ code: 'kafra', was: k0, now: k1 }); na.kafra = Math.max(0, Math.min(k1, k0)); accFixed = true; }
  const pm = obj(pa.materials), nm = obj(na.materials);
  for (const k of Object.keys(nm)) {
    if (int(nm[k]) > int(pm[k])) { issues.push({ code: 'materials', id: k, was: int(pm[k]), now: int(nm[k]) }); nm[k] = int(pm[k]); if (!nm[k]) delete nm[k]; accFixed = true; }
    else if (!ORE_IDS.has(k)) issues.push({ code: 'material-unknown', id: k, fixed: false });
  }

  // 發憑證後馬上就領到東西：只記錄（之後收緊時間與數量上限用）
  if (noEnd && !strict && (fresh > 0 || cardGain > 0)) issues.push({ code: 'coop-noend', items: fresh, cards: cardGain, stage: claim.stage, fixed: false });
  if (quick && (fresh > 0 || cardGain > 0 || topGain > 0 || credited)) issues.push({ code: 'claim-quick', secs: Math.round(secs), stage: claim.stage, fixed: false });

  // ── 寵物（pets.v1）與成就（achievements.v1）：都先記錄，strict 才改回 ──
  // 新寵物只能來自關卡裡的蛋（一場最多 PET_NEW 隻）或進化（規則資料的 from，要有原本那一隻）；親密度每玩 5 秒 +1
  const petsDoc = obj(parse(nextDoc, 'pets.v1', {})), np = obj(petsDoc.pets), pp = obj(obj(parse(prevDoc, 'pets.v1', {})).pets);
  let petsFixed = false, hatched = 0;
  for (const pid of Object.keys(np)) {
    const def = R.pets?.[pid], was = pp[pid];
    if (!was) {
      const ok = !!def && ((def.from && pp[def.from]) || (!!claim && !claim.skip && !off && ++hatched <= PET_NEW));
      if (!ok && soft({ code: 'pet-new', pet: pid })) { delete np[pid]; petsFixed = true; }
      continue;
    }
    const up = int(obj(np[pid]).intimacy) - int(obj(was).intimacy), room = claim && !claim.skip ? Math.floor(secs / 5) + PET_GRACE : 0;
    if (up > room && soft({ code: 'pet-intimacy', pet: pid, gain: up, cap: room })) { np[pid] = { ...obj(np[pid]), intimacy: int(obj(was).intimacy) + room }; petsFixed = true; }
  }
  // 成就的累計（殺怪數、場數、勝場）只會在關卡結算時增加，殺怪數不超過這一場殺得到的量
  const achDoc = obj(parse(nextDoc, 'achievements.v1', {})), pach = obj(parse(prevDoc, 'achievements.v1', {}));
  let achFixed = false;
  const grew = ['totalKills', 'runs', 'wins'].filter((k) => num(achDoc[k]) > num(pach[k]));
  const killUp = num(achDoc.totalKills) - num(pach.totalKills);
  if (grew.length && (!claim || killUp > kc.kills + 50 || num(achDoc.runs) - num(pach.runs) > 1) && soft({ code: 'ach-gain', keys: grew, kills: killUp, cap: Math.round(kc.kills) })) {
    for (const k of grew) achDoc[k] = num(pach[k]);
    achFixed = true;
  }

  const meta = { cap: Math.round(topCap), secs: Math.round(secs), gain: Math.round(topGain), ...(claim ? { stage: claim.stage } : {}), ...(claim?.party ? { party: claim.party } : {}), ...(end ? { end: { secs: Math.round(num(end.secs)), end: end.end ?? null, full: !!end.full, host: !!end.host, won: list(end.won).length, killed: list(end.killed).length } } : {}) };
  if (!charsFixed && !accFixed && !petsFixed && !achFixed) return { issues, doc: null, meta };
  const doc = { ...nextDoc };
  if (petsFixed) doc['pets.v1'] = JSON.stringify({ ...petsDoc, pets: np });
  if (achFixed) doc['achievements.v1'] = JSON.stringify(achDoc);
  if (charsFixed) doc['characters.v1'] = JSON.stringify(nextChars);
  if (accFixed) { na.inventory = keep; na.cards = ncards; na.materials = nm; doc['account.v1'] = JSON.stringify(na); }
  return { issues, doc, meta };
}
