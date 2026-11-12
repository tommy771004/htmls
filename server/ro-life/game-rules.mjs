import R from './rules-data.mjs';

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
const ITEMS_BASE = 10, ITEMS_PER_SEC = 1 / 5; // 一場關卡的新物品上限（目前只記錄）
const CARDS_BASE = 3, CARDS_PER_SEC = 1 / 60; // 一場關卡的新卡片上限

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
export function runExpCap(stageId, secs, { mult = 2, level = 1, skip = false } = {}) {
  const s = R.stages[stageId];
  if (!s) return 0;
  const bossExp = s.bossAt.reduce((a, b) => a + monExp(b.id) * ep(level, monLv(b.id)), 0);
  if (skip) return bossExp * SLACK; // 跳過劇情：只結算最後的 MVP（引擎 kL），全部頭目算進去當上限
  if (!s.waves.length) return 0;
  const m = Math.max(1, Math.min(R.difficulty.max, num(mult) || 1));
  const count = Math.min(R.maxCount, 1 + 10 * (m - 1)); // sr()：出怪數 1～3 佔難度倍率的 1/5
  const events = Math.min(SP.maxEvents, 1 + 5 * (m - 1)); // 事件數 1～2 也佔 1/5
  const party = SP.partyCount[SP.partyCount.length - 1];
  const C = count * party;
  const T = Math.max(0, Math.min(num(secs), s.runLength + LATE));
  const waveAt = (t) => s.waves.find((w) => t >= w.from && t < w.to) ?? s.waves[s.waves.length - 1];
  const killExp = (w) => Math.max(0, ...w.pool.map((id) => monExp(id) * ep(level, monLv(id))));
  let total = 0;
  for (let t = 0; t < T; t++) { const w = waveAt(t); total += w.perSecond * C * killExp(w); }
  const horde = SP.hordeEvery / events;
  for (let t = horde; t <= T && t < s.runLength; t += horde) total += SP.hordeRings * Math.min(SP.hordeMax, SP.hordeBase + t / SP.hordeGrowth) * C * killExp(waveAt(t));
  const elite = SP.eliteEvery / events;
  for (let t = 0; t <= T; t += elite) total += (R.eliteExp - 1) * killExp(waveAt(t)) * party;
  for (const b of s.bossAt) if (b.t <= T) total += monExp(b.id) * ep(level, monLv(b.id));
  return total * SLACK;
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

export function checkSave(prevDoc, nextDoc, { now = Date.now(), claim = null } = {}) {
  const issues = [];
  const secs = runSecs(claim, now);
  const nextChars = list(parse(nextDoc, 'characters.v1', []));
  const prevChars = new Map(list(parse(prevDoc, 'characters.v1', [])).filter((c) => c?.id).map((c) => [String(c.id), c]));
  const newIds = new Set();
  let charsFixed = false, used = null, topGain = 0, topCap = 0;

  for (const c of nextChars) {
    if (!c?.id) continue;
    const id = String(c.id), p = prevChars.get(id);
    const fix = (code, extra, apply) => { issues.push({ code, char: id, ...extra }); apply(); charsFixed = true; };
    if (!p) {
      newIds.add(id);
      if (c.dev) fix('new-dev', {}, () => { delete c.dev; });
      if (int(c.level) > 1 || int(c.jobLevel) > 1 || num(c.exp) > 0 || num(c.jobExp) > 0)
        fix('new-high', { lv: int(c.level), jl: int(c.jobLevel) }, () => { c.level = 1; c.exp = 0; c.jobLevel = 1; c.jobExp = 0; });
      if (c.promotion) fix('new-promoted', { job: c.promotion }, () => { delete c.promotion; });
      if (list(c.mvpsDefeated).length) fix('mvps', { ids: list(c.mvpsDefeated) }, () => { c.mvpsDefeated = []; });
      if (list(c.stagesCleared).length) fix('stages', { ids: list(c.stagesCleared) }, () => { c.stagesCleared = []; });
    } else {
      if (c.dev && !p.dev) fix('dev', {}, () => { delete c.dev; });
      const was = toCum(BASE_CUM, int(p.level) || 1, num(p.exp)), now_ = toCum(BASE_CUM, int(c.level) || 1, num(c.exp));
      const jwas = toCum(JOB_CUM, int(p.jobLevel) || 1, num(p.jobExp)), jnow = toCum(JOB_CUM, int(c.jobLevel) || 1, num(c.jobExp));
      // 一張憑證只給一個角色（同一場關卡只會有一個角色在打）；跳過劇情的憑證綁定角色
      let cap = 0, jcap = 0;
      const mine = !!claim && (used === null || used === id) && (!claim.char || claim.char === id);
      if ((now_ > was || jnow > jwas) && mine) {
        used = id;
        cap = runExpCap(claim.stage, secs, { mult: claim.mult, level: int(p.level) || 1, skip: claim.skip });
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
      const bosses = new Set(forMe ? (R.stages[claim.stage]?.bossAt ?? []).map((b) => b.id) : []);
      const had = new Set(list(p.mvpsDefeated).map(String));
      const badMvp = list(c.mvpsDefeated).filter((x) => !had.has(String(x)) && !bosses.has(String(x)));
      if (badMvp.length) fix('mvps', { ids: badMvp, stage: claim?.stage ?? null }, () => { c.mvpsDefeated = list(c.mvpsDefeated).filter((x) => !badMvp.includes(x)); });
      const cleared = new Set(list(p.stagesCleared).map(String));
      const badStage = list(c.stagesCleared).filter((x) => !cleared.has(String(x)) && !(forMe && String(x) === claim.stage));
      if (badStage.length) fix('stages', { ids: badStage, stage: claim?.stage ?? null }, () => { c.stagesCleared = list(c.stagesCleared).filter((x) => !badStage.includes(x)); });
      // 轉職只發生在普隆德拉城的劇情裡（引擎 choosePromotion），之後不能再換
      if ((c.promotion ?? null) !== (p.promotion ?? null)) {
        const ok = !p.promotion && forMe && claim.stage === PROMOTION_STAGE && R.jobs[c.promotion]?.base === c.job;
        if (!ok) fix('promotion', { from: p.promotion ?? null, to: c.promotion ?? null, stage: claim?.stage ?? null }, () => { if (p.promotion) c.promotion = p.promotion; else delete c.promotion; });
      }
    }
    // 能力點、天賦（有變動才查，舊資料不追溯；不合理就重置，等同遊戲內的重置）
    const lv = Math.max(1, Math.min(R.baseMax, int(c.level) || 1));
    const same = (k) => p && JSON.stringify(p[k] ?? null) === JSON.stringify(c[k] ?? null) && int(p.level) === int(c.level) && int(p.jobLevel) === int(c.jobLevel);
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
  const stage = claim && !claim.skip ? R.stages[claim.stage] : null;
  const limits = { maxIlvl: stage ? stage.ilvl : MAX_ILVL, maxTier: stage ? stage.tier : MAX_TIER };
  const keep = [], dropped = new Set();
  let fresh = 0;
  const itemCap = claim ? Math.round(ITEMS_BASE + secs * ITEMS_PER_SEC) : 0;
  for (let it of list(na.inventory)) {
    if (!it?.uid) { keep.push(it); continue; }
    const p = pByUid.get(String(it.uid));
    if (!p) {
      const def = itemDef(it.itemId);
      if (it.owner != null && newIds.has(String(it.owner)) && def?.starter) { keep.push(it); continue; }
      // 新物品只能來自關卡結算
      const bad = claim ? badNewItem(it, limits) : 'no-claim';
      if (bad) { issues.push({ code: 'item-' + bad, item: String(it.itemId), q: it.quality ?? null, ilvl: it.ilvl ?? null, tier: it.tier ?? null }); dropped.add(String(it.uid)); accFixed = true; continue; }
      if (++fresh === itemCap + 1) issues.push({ code: 'item-count', cap: itemCap, fixed: false });
      keep.push(it);
      continue;
    }
    // 同一件物品（同 uid）不能換成別的東西；精煉只能由伺服器 op 提升
    if (identity(it) !== identity(p)) { issues.push({ code: 'item-edit', item: String(p.itemId) }); it = { ...it, itemId: p.itemId, quality: p.quality, ilvl: p.ilvl, tier: p.tier, affixes: p.affixes }; accFixed = true; }
    if (int(it.refine) > int(p.refine)) { issues.push({ code: 'refine', item: String(it.itemId), refine: [int(p.refine), int(it.refine)] }); it = { ...it, refine: int(p.refine) }; accFixed = true; }
    keep.push(it);
  }
  if (accFixed) na.inventory = keep;
  // 拿掉的物品如果已經裝在角色身上，裝備欄也要清掉
  if (dropped.size) for (const c of nextChars) for (const [slot, uid] of Object.entries(obj(c?.equipped))) if (dropped.has(String(uid))) { delete c.equipped[slot]; charsFixed = true; }

  // 卡片：未知 id 只記錄；增加的張數（庫存＋插在裝備上的）只能來自關卡結算，而且有上限
  const ncards = obj(na.cards), pcards = obj(pa.cards);
  for (const [cid, n] of Object.entries(ncards)) if (!R.cards[cid] || !(int(n) >= 0)) issues.push({ code: 'card-unknown', card: cid, fixed: false });
  const cardTotal = (cards, inv) => Object.values(cards).reduce((a, n) => a + Math.max(0, int(n)), 0) + socketed(inv);
  const cardGain = cardTotal(ncards, list(na.inventory).filter((i) => i?.uid)) - cardTotal(pcards, pinv);
  const cardCap = claim ? Math.round(CARDS_BASE + secs * CARDS_PER_SEC) : 0;
  if (cardGain > cardCap) {
    issues.push({ code: claim ? 'cards' : 'cards-no-claim', gain: cardGain, cap: cardCap });
    for (const [cid, n] of Object.entries(ncards)) if (int(n) > int(pcards[cid])) { if (pcards[cid] == null) delete ncards[cid]; else ncards[cid] = int(pcards[cid]); }
    accFixed = true;
  }

  // Kafra 與材料：買賣在伺服器 op 裡算，存檔只能變少（染色、轉職分支、塔重置等花費）
  const k0 = num(pa.kafra), k1 = num(na.kafra);
  if (k1 > k0 || k1 < 0) { issues.push({ code: 'kafra', was: k0, now: k1 }); na.kafra = Math.max(0, Math.min(k1, k0)); accFixed = true; }
  const pm = obj(pa.materials), nm = obj(na.materials);
  for (const k of Object.keys(nm)) {
    if (!(k in R.orePrice)) { issues.push({ code: 'material-unknown', id: k, fixed: false }); continue; }
    if (int(nm[k]) > int(pm[k])) { issues.push({ code: 'materials', id: k, was: int(pm[k]), now: int(nm[k]) }); nm[k] = int(pm[k]); if (!nm[k]) delete nm[k]; accFixed = true; }
  }

  const meta = { cap: Math.round(topCap), secs: Math.round(secs), gain: Math.round(topGain), ...(claim ? { stage: claim.stage } : {}) };
  if (!charsFixed && !accFixed) return { issues, doc: null, meta };
  const doc = { ...nextDoc };
  if (charsFixed) doc['characters.v1'] = JSON.stringify(nextChars);
  if (accFixed) doc['account.v1'] = JSON.stringify(na);
  return { issues, doc, meta };
}
