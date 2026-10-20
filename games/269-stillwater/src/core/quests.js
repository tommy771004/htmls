// 主線 5 章、木屋佈告欄 3 項輪替委託、圖鑑里程碑、時鐘與釣點出魚（不碰 DOM／three）。
import { FISH, byId, zoneFish, RARITY, TIME_ZH, ZONES, LEGENDS } from './fishdb.js';
import { TIERS } from './quality.js';

// ---------- 時鐘：早上 06:00–11:00、下午 11:00–17:00、黃昏 17:00–20:00，20:00 之後回到隔天清晨 ----------
export const MIN_PER_SEC = 1 / 0.7;          // 現實 1 秒 ≈ 1.43 遊戲分鐘（一天約 10 分鐘）
export const PERIODS = [
  { key: 'am', zh: '早上', en: 'Morning', from: 360, to: 660 },
  { key: 'pm', zh: '下午', en: 'Afternoon', from: 660, to: 1020 },
  { key: 'dusk', zh: '黃昏', en: 'Dusk', from: 1020, to: 1200 },
];
export const periodOf = (min) => (min < 660 ? 0 : min < 1020 ? 1 : 2);
export const clockText = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.floor(min % 60)).padStart(2, '0')}`;

// ---------- 主線 ----------
export const CHAPTERS = [
  {
    zh: '靜水初航', en: 'First Row at Stillwater',
    goals: [
      { kind: 'cp', cp: 1, zh: '划到「淺灘蘆葦灣」點亮燈樁' },
      { kind: 'deliver', fish: 1, n: 1, zh: '釣起 1 條銀鯛 Silver bream，帶回碼頭交付' },
    ],
    reward: 'book', rewardZh: '解鎖 55 魚種生態圖鑑與木屋委託板',
  },
  {
    zh: '波光與銀星', en: 'Sunlit Ripples & Silver Stars',
    goals: [
      { kind: 'cp', cp: 2, zh: '點亮「中游石拱橋」燈樁' },
      { kind: 'catch', minTier: 2, time: 'pm', n: 3, zh: '在下午釣起 3 條銀星以上的魚' },
    ],
    reward: 'line', rewardZh: '強韌蠶絲釣線：紅區斷線容錯 0.8 → 1.0 秒',
  },
  {
    zh: '松林深處的暮色', en: 'Dusk Beneath the Pines',
    goals: [
      { kind: 'cp', cp: 3, zh: '點亮「松林沉木灣」燈樁' },
      { kind: 'catch', fish: [30], n: 1, zh: '黃昏時釣起稀有的暮光鯉 Dusk carp' },
    ],
    reward: 'lantern', rewardZh: '船頭暖黃防風小提燈：黃昏視野更亮、完美提竿時間窗 +0.08 秒',
  },
  {
    zh: '穿越亂石急流', en: 'Navigating the Rocky Gorge',
    goals: [
      { kind: 'cp', cp: 4, zh: '逆流划行，點亮「峽谷急流口」燈樁' },
      { kind: 'catch', minTier: 3, zone: 4, n: 1, zh: '釣起 1 條金星品質的急流區魚種（#34–#44）' },
    ],
    reward: 'rod', rewardZh: '彈性竹製名竿：收線基礎效率 +20%',
  },
  {
    zh: '瀑布潭的傳說', en: 'Legend of the Waterfall Pool',
    goals: [
      { kind: 'cp', cp: 5, zh: '抵達最北端「上游瀑布潭」燈樁' },
      { kind: 'catch', fish: [50, ...LEGENDS], n: 1, zh: '釣起瀑潭紅點鮭，或任一區域的傳奇魚王' },
    ],
    reward: 'badge', rewardZh: '草帽金羽徽章與「大師釣手」稱號',
  },
];

// 一次漁獲是否符合條件（主線 catch 目標與委託共用）
export function matches(goal, c) {
  if (goal.fish && !(Array.isArray(goal.fish) ? goal.fish.includes(c.id) : goal.fish === c.id)) return false;
  if (goal.minTier != null && c.tier < goal.minTier) return false;
  if (goal.time && c.time !== goal.time) return false;
  if (goal.zone && c.zone !== goal.zone) return false;
  if (goal.zones && !goal.zones.includes(c.zone)) return false;
  if (goal.minLen && !(c.len >= goal.minLen || c.tier >= 4)) return false;
  return true;
}

// 主線進度：cp 看燈樁、catch 看本章開始後的漁獲數、deliver 看魚簍裡有沒有
export function goalState(save, goal) {
  if (goal.kind === 'cp') return { done: !!save.cps[goal.cp], have: save.cps[goal.cp] ? 1 : 0, n: 1 };
  if (goal.kind === 'catch') { const have = Math.min(goal.n, save.chapterCatches.filter((c) => matches(goal, c)).length); return { done: have >= goal.n, have, n: goal.n }; }
  if (goal.kind === 'deliver') { const have = Math.min(goal.n, save.creel.filter((c) => matches(goal, c)).length); return { done: have >= goal.n, have, n: goal.n }; }
  return { done: false, have: 0, n: 1 };
}
export function chapterReady(save) {
  const ch = CHAPTERS[save.chapter];
  return !!ch && ch.goals.every((g) => goalState(save, g).done);
}
// 在碼頭回報：交付需要的魚、發獎勵、進下一章。回傳獎勵 key 或 null
export function claimChapter(save) {
  if (!chapterReady(save)) return null;
  const ch = CHAPTERS[save.chapter];
  for (const g of ch.goals) if (g.kind === 'deliver') takeFromCreel(save, g, g.n);
  save.upgrades[ch.reward] = true;
  save.chapter++;
  save.chapterCatches = [];
  save.points += 100 * save.chapter;
  return ch.reward;
}
function takeFromCreel(save, goal, n) {
  // 先交品質低的，把好魚留著
  const idx = save.creel.map((c, i) => [c, i]).filter(([c]) => matches(goal, c)).sort((a, b) => a[0].tier - b[0].tier).slice(0, n).map(([, i]) => i);
  const out = idx.map((i) => save.creel[i]);
  save.creel = save.creel.filter((_, i) => !idx.includes(i));
  return out;
}

// ---------- 佈告欄委託 ----------
export function unlockedZones(save) {
  const z = new Set([1]);
  if (save.cps[2]) z.add(2);
  if (save.cps[3]) z.add(3);
  if (save.cps[4]) z.add(4);
  if (save.cps[5]) z.add(5);
  return [...z];
}
export function makeQuest(save, rng, kind) {
  const zones = unlockedZones(save);
  const pick = (a) => a[Math.floor(rng() * a.length)];
  kind = kind || pick(['quality', 'time', 'size']);
  if (kind === 'quality') {
    const pool = zones.flatMap((z) => zoneFish(z)).filter((f) => f.rarity === 'C' || f.rarity === 'U');
    const f = pick(pool);
    const n = f.rarity === 'U' ? 1 : 2;
    return { kind, fish: f.id, minTier: 2, n, reward: 50 + n * 30 + (f.rarity === 'U' ? 40 : 0), zh: `請交付 ${n} 條銀星以上的 ${f.en}（${f.zh}）` };
  }
  if (kind === 'time') {
    const t = pick(['am', 'pm', 'dusk']);
    const a = pick(zones), b = zones.length > 1 ? pick(zones.filter((z) => z !== a)) : a;
    const zs = [...new Set([a, b])].sort();
    const zText = zs.map((z) => `第${'一二三四五'[z - 1]}區`).join('或');
    return { kind, time: t, zones: zs, n: 4, reward: 110, zh: `在【${TIME_ZH[t]}】時段於【${zText}】釣獲 4 條魚並帶回碼頭` };
  }
  return { kind: 'size', minLen: 50, n: 1, reward: 140, zh: '釣獲任一體長超過 50 cm 的大魚，或任一王冠品質魚類' };
}
export function ensureBoard(save, rng) {
  while (save.board.length < 3) {
    const kinds = ['quality', 'time', 'size'].filter((k) => !save.board.some((q) => q.kind === k));
    save.board.push(makeQuest(save, rng, kinds[Math.floor(rng() * kinds.length)]));
  }
}
export const questHave = (save, q) => Math.min(q.n, save.creel.filter((c) => matches(q, c)).length);
// 交付委託：拿走魚、加積分、立刻換一張新的
export function deliverQuest(save, i, rng) {
  const q = save.board[i];
  if (!q || questHave(save, q) < q.n) return null;
  takeFromCreel(save, q, q.n);
  save.points += q.reward;
  save.questsDone++;
  save.board[i] = makeQuest(save, rng, q.kind);
  return q;
}

// ---------- 圖鑑里程碑 ----------
export const MILESTONES = [
  { n: 10, paint: 1, ribbon: 1, zh: '船殼「松針綠」漆與麻色帽帶' },
  { n: 25, paint: 2, ribbon: 2, zh: '船殼「湖心藍」漆與青竹帽帶' },
  { n: 40, paint: 3, ribbon: 3, zh: '船殼「樺木白」漆與金穗帽帶' },
  { n: 55, paint: 4, ribbon: 4, zh: '船殼「漆黑描金」與王冠紫帽帶' },
];
export const PAINTS = [
  { zh: '穀倉紅', hex: '#a5473a' }, { zh: '松針綠', hex: '#3f6248' }, { zh: '湖心藍', hex: '#36627a' },
  { zh: '樺木白', hex: '#e2dccd' }, { zh: '漆黑描金', hex: '#24221f' },
];
export const RIBBONS = [
  { zh: '酒紅', hex: '#7a2f2a' }, { zh: '麻色', hex: '#b9a27a' }, { zh: '青竹', hex: '#5d8a5a' },
  { zh: '金穗', hex: '#d2a43c' }, { zh: '王冠紫', hex: '#6d4f8f' },
];
export const speciesCount = (save) => Object.keys(save.book).length;

// ---------- 出魚 ----------
// 依釣點的區、時段與類型抽魚種：魚王只在 legend 釣點出現，並帶保底（每次沒抽到魚王 +0.6 權重）
export function pickFish(spot, time, rng, pity = 0) {
  const pool = zoneFish(spot.zone).filter((f) => f.times.includes(time) && (f.rarity !== 'L' || spot.kind === 'legend'));
  const mult = { C: 1, U: 1, R: 1, E: 1, L: 1 };
  if (spot.kind === 'shallow') mult.C = 1.3;
  if (spot.kind === 'legend') { mult.R = 1.6; mult.E = 2; mult.L = 3 + pity; }
  let sum = 0;
  const ws = pool.map((f) => { const w = RARITY[f.rarity].w * mult[f.rarity]; sum += w; return w; });
  let r = rng() * sum;
  for (let i = 0; i < pool.length; i++) { r -= ws[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

export function valueOf(c) { return Math.round(RARITY[byId(c.id).rarity].value * TIERS[c.tier].value); }
export { FISH, ZONES, TIERS };
