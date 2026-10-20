// 存檔格式與漁獲紀錄（不碰 DOM；load/store 由呼叫端提供 localStorage 之類的存取）
import { byId } from './fishdb.js';
import { ensureBoard, speciesCount, MILESTONES } from './quests.js';

export const SAVE_KEY = 'st269.save';
export const CREEL_MAX = 8;

export function fresh() {
  return {
    v: 1, day: 1, clock: 6 * 60 + 20,
    cps: [true, false, false, false, false, false],
    at: 0,                         // 最後停泊的燈樁（重開時從這裡出發）
    book: {},                      // { 魚種 id: { n, tier, len, kg } }
    creel: [],
    points: 0, chapter: 0, chapterCatches: [],
    board: [], questsDone: 0,
    upgrades: { book: false, line: false, lantern: false, rod: false, badge: false },
    paint: 0, ribbon: 0,
    stats: { caught: 0, perfect: 0, snap: 0, escape: 0, released: 0, flawless: 0 },
    pity: {},                      // 各 legend 釣點的保底權重
    seen: {},                      // 已發現的釣點（New fishing spot 只跳一次）
  };
}

export function sanitize(raw) {
  const s = fresh();
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return s;
  const num = (v, d, lo, hi) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
  s.day = num(raw.day, 1, 1, 99999);
  s.clock = num(raw.clock, s.clock, 360, 1199);
  if (Array.isArray(raw.cps)) s.cps = s.cps.map((d, i) => i === 0 || !!raw.cps[i]);
  s.at = s.cps[raw.at] ? raw.at | 0 : 0;
  if (raw.book && typeof raw.book === 'object') for (const [k, e] of Object.entries(raw.book)) {
    const id = +k;
    if (id >= 1 && id <= 55 && e) s.book[id] = { n: num(e.n, 1, 1, 1e6), tier: num(e.tier, 0, 0, 4) | 0, len: num(e.len, 0, 0, 999), kg: num(e.kg, 0, 0, 999) };
  }
  const okCatch = (c) => c && c.id >= 1 && c.id <= 55 && c.tier >= 0 && c.tier <= 4;
  if (Array.isArray(raw.creel)) s.creel = raw.creel.filter(okCatch).slice(0, CREEL_MAX);
  if (Array.isArray(raw.chapterCatches)) s.chapterCatches = raw.chapterCatches.filter(okCatch).slice(-50);
  s.points = num(raw.points, 0, 0, 1e9);
  s.chapter = num(raw.chapter, 0, 0, 5) | 0;
  if (Array.isArray(raw.board)) s.board = raw.board.filter((q) => q && q.kind && q.n).slice(0, 3);
  s.questsDone = num(raw.questsDone, 0, 0, 1e6);
  for (const k of Object.keys(s.upgrades)) s.upgrades[k] = !!(raw.upgrades && raw.upgrades[k]);
  s.paint = num(raw.paint, 0, 0, 4) | 0; s.ribbon = num(raw.ribbon, 0, 0, 4) | 0;
  for (const k of Object.keys(s.stats)) s.stats[k] = num(raw.stats && raw.stats[k], 0, 0, 1e9);
  if (raw.pity && typeof raw.pity === 'object') for (const [k, v] of Object.entries(raw.pity)) s.pity[k] = num(v, 0, 0, 40);
  if (raw.seen && typeof raw.seen === 'object') for (const k of Object.keys(raw.seen)) s.seen[k] = true;
  return s;
}

export function load(storage, rng) {
  let s;
  try { s = sanitize(JSON.parse(storage.getItem(SAVE_KEY) || 'null')); } catch { s = fresh(); }
  if (s.upgrades.book) ensureBoard(s, rng);
  return s;
}
export function store(storage, s) {
  try { storage.setItem(SAVE_KEY, JSON.stringify(s)); return true; } catch { return false; }
}

// 釣起一條魚：更新圖鑑紀錄（回傳是否新魚種、新紀錄、新最高品質與新解鎖的里程碑）
export function recordCatch(s, c) {
  const before = speciesCount(s);
  const e = s.book[c.id];
  const out = { newSpecies: !e, newRecord: false, newTier: false, milestone: null };
  if (!e) s.book[c.id] = { n: 1, tier: c.tier, len: c.len, kg: c.kg };
  else {
    e.n++;
    if (c.len > e.len) { e.len = c.len; e.kg = Math.max(e.kg, c.kg); out.newRecord = true; }
    if (c.tier > e.tier) { e.tier = c.tier; out.newTier = true; }
  }
  if (out.newSpecies) out.newRecord = true;
  const after = speciesCount(s);
  for (const m of MILESTONES) if (before < m.n && after >= m.n) out.milestone = m;
  s.stats.caught++;
  if (c.perfect) s.stats.perfect++;
  if (c.flawless) s.stats.flawless++;
  s.chapterCatches.push(c);
  if (s.chapterCatches.length > 50) s.chapterCatches.shift();
  return out;
}

export function makeCatch(fish, judged, ctx) {
  return {
    id: fish.id, tier: judged.tier,
    len: Math.round(fish.len * judged.mult * 10) / 10,
    kg: Math.round(fish.kg * judged.mult * 100) / 100,
    time: ctx.time, zone: fish.zone, perfect: !!ctx.perfect, flawless: !!judged.flawless, day: ctx.day,
  };
}
export const fishOf = (c) => byId(c.id);
