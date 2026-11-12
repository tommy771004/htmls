// 從打包後的 web/282-ro-life.html（無頭瀏覽器）倒出伺服器驗證線上角色要用的規則數值，寫成 server/ro-life/rules-data.mjs。
// 引擎是壓縮檔，規則只能從執行中的頁面取：build.mjs 把它們掛在 window.__ro.rules。改了引擎的經驗、價格、精煉、關卡後要重跑：
//   node games/282-ro-life/tools/dump-rules.mjs        （先 npm run build）
// 需要 Playwright：設 PLAYWRIGHT_MODULE 指到 playwright/index.mjs。
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = join(ROOT, 'server/ro-life/rules-data.mjs');
const PW = process.env.PLAYWRIGHT_MODULE;
if (!PW || !existsSync(PW)) throw new Error('請設定 PLAYWRIGHT_MODULE（playwright/index.mjs 的路徑）');
const { chromium } = await import(PW);

const T = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
const srv = createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^\/+/, '');
  try { const b = await readFile(join(ROOT, p)); res.writeHead(200, { 'content-type': T[extname(p)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu', '--use-angle=swiftshader'] });
const tab = await browser.newPage();
const errs = []; tab.on('pageerror', (e) => errs.push(e.message));
await tab.goto(`http://127.0.0.1:${srv.address().port}/web/282-ro-life.html`);
await tab.waitForFunction(() => window.__ro?.rules, null, { timeout: 60000 });

const data = await tab.evaluate(() => {
  const R = window.__ro.rules, ro = window.__ro;
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const jobs = Object.fromEntries((Array.isArray(ro.jobs) ? ro.jobs : Object.values(ro.jobs)).map((j) => [j.id, { base: j.base ?? null, rank: j.rank ?? 1, jobMax: R.jobMax(j.id) }]));
  for (const j of Object.values(jobs)) if (j.base && !jobs[j.base]) jobs[j.base] = { base: null, rank: 1, jobMax: R.jobMax(j.base) };
  const items = {}, sellBase = {};
  for (const [id, it] of Object.entries(ro.items)) {
    items[id] = { slot: it.slot ?? null, cardSlots: it.cardSlots ?? 0, starter: !!it.starter, rare: !!it.rare, jobs: it.jobs ?? null, refinable: R.refinable(id),
      slotsByQuality: [0, 1, 2, 3, 4].map((q) => R.cardSlots(id, q)) };
    // Wr 對 quality 0、無詞綴、無卡、+0 的值就是 VE(def)（KE 的 a）
    sellBase[id] = R.sellValue({ itemId: id, quality: 0, affixes: [], cards: [], refine: 0 });
  }
  // 賣價公式驗證樣本：伺服器的 KE 移植要對得上
  const sellSamples = [];
  for (const id of Object.keys(ro.items).filter((id) => sellBase[id] > 0).slice(0, 12))
    for (const [q, af, cs, rf] of [[0, 0, 0, 0], [2, 1, 1, 3], [4, 3, 2, 10], [1, 0, 3, 7]]) {
      const inst = { itemId: id, quality: q, affixes: Array(af).fill({}), cards: Array(cs).fill(null), refine: rf };
      sellSamples.push({ ...inst, affixes: af, cards: cs, value: R.sellValue(inst) });
    }
  const cardValue = Object.fromEntries(Object.keys(ro.cards).map((id) => [id, R.cardValue(id)]));
  const cards = Object.fromEntries(Object.entries(ro.cards).map(([id, c]) => [id, { monster: c.monster ?? null }]));
  const monsters = Object.fromEntries(Object.entries(ro.monsters).map(([id, m]) => [id, { level: num(m.level), hp: num(m.hp), exp: num(m.exp), boss: !!m.boss, group: m.group ?? null }]));
  const ids = (xs) => (xs ?? []).map((x) => (typeof x === 'string' ? x : x?.id)).filter(Boolean);
  const stages = Object.fromEntries(Object.entries(ro.stages).map(([id, s]) => [id, {
    story: s.story ?? null, storyOnly: !!s.storyOnly, map: s.map ?? null,
    ilvl: R.stageIlvl(id), tier: R.stageTier(id),
    waves: (s.waves ?? []).map((w) => ({ from: num(w.from), to: num(w.to), pool: ids(w.pool), perSecond: num(w.perSecond), maxAlive: num(w.maxAlive) })),
    minis: ids(s.minis), bosses: ids(s.bosses), mvp: s.mvp ? ids([s.mvp])[0] : null,
    bossAt: (s.bosses ?? []).map((b) => ({ id: b.id, t: num(b.t) })),
    runLength: num(s.runLength), jobCap: num(s.jobCap), jobExp: num(s.jobExp) ?? 1, hpGrowth: num(s.hpGrowth),
  }]));
  // 天賦表（引擎 Ze）：所屬職業、最高等級、二轉分支
  const talents = Object.fromEntries(Object.entries(R.talents).map(([id, t]) => [id, { job: t.job, maxRank: num(t.maxRank), branch: t.branch ?? null }]));
  const stageList = R.stageList.map((s) => ({ id: s.id, story: s.story ?? null, levels: s.levels ?? null, tier: s.tier ?? null }));
  const refineOre = {};
  for (const slot of ['weapon', 'armor']) refineOre[slot] = range(1, R.maxRefine).map((lv) => R.refineOre(slot, lv));
  return {
    baseMax: R.baseMax, jobFactor: R.jobFactor,
    expNext: range(1, R.baseMax).map((l) => R.expNext(l)),
    jobNext: range(1, 70).map((l) => R.jobNext(l)),
    statPts: range(1, R.baseMax).map((l) => R.statPts(l)),
    talentPts: range(1, 70).map((l) => R.talentPts(l)),
    // Ep(角色等級, 怪物等級)：差距 d = 角色 − 怪物，d ≤ 0 為 1
    ep: range(0, 40).map((d) => R.ep(50 + d, 50)),
    jobs, talents, items, sellBase, sellSamples, cards, cardValue, monsters, stages, stageList,
    ores: { ...R.ores }, orePrice: { ...R.orePrice }, maxRefine: R.maxRefine,
    refineRate: range(1, R.maxRefine).map((l) => R.refineRate(l)), refineOre,
  };
});
await browser.close(); srv.close();
if (errs.length) throw new Error('頁面錯誤：' + errs.join(' | '));

// 引擎內部常數（不是函式，build 沒掛出來）：照 main-DRFCcdKO.js 抄，改引擎時一起改
data.qualityMult = [1, 2, 4, 8, 16]; // UE：賣價依品質倍數
data.maxQuality = 4;
data.difficulty = { min: 1, max: 2 }; // sr()：難度滑桿換算的掉寶倍率
data.maxCount = 3; // Ko.count 上限（同時出怪數）
data.eliteExp = 5; // 菁英怪經驗 ×5
data.jobCapPenalty = 0.1; // p5：職業等級超過上限後每級 ×0.1
// 生怪（引擎 spawn／horde）：菁英每 45 秒、大群每 120 秒（都除以難度的 events，最多 2）；
// 大群一波 3 × min(120, 36 + 秒數/8) × 出怪數 × 組隊倍率；組隊倍率 Z0（1～3 人）
data.spawn = { eliteEvery: 45, hordeEvery: 120, hordeBase: 36, hordeMax: 120, hordeGrowth: 8, hordeRings: 3, partyCount: [1, 1, 2.5, 3.85], maxEvents: 2, talentRankPts: { 1: 50, 2: 50, 3: 70 } };

const engineHash = createHash('sha256').update(await readFile(join(ROOT, 'games/282-ro-life/src/engine/main-DRFCcdKO.js'))).digest('hex').slice(0, 12);
data.source = { engine: engineHash, dumpedAt: new Date().toISOString().slice(0, 10) };
await writeFile(OUT, `// 由 games/282-ro-life/tools/dump-rules.mjs 自動產生，不要手改。\nexport default ${JSON.stringify(data)};\n`);
console.log('寫入', OUT, `${(JSON.stringify(data).length / 1024).toFixed(1)} KB`, '關卡', Object.keys(data.stages).length, '道具', Object.keys(data.items).length, '怪物', Object.keys(data.monsters).length);
