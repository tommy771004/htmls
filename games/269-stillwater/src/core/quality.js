// 5 階品質：QualityScore = BaseRoll(0～60) + HookBonus(0 或 20) + ReelBonus(0～25) + SpotBonus(0～15)，
// 門檻 45／65／82／95；再套企劃書的取得條件（銀星要正確時段或完美提竿、金星要完美提竿或全程張力 < 85%、
// 王冠要正確時段＋完美提竿＋全程張力 < 80%；紅區警告少於 2 次至少良質）。
export const TIERS = [
  { id: 0, key: 'normal', zh: '普通', en: 'Normal', mark: 'C', size: [0.80, 0.99], value: 1.0, struggle: 0 },
  { id: 1, key: 'fine', zh: '良質', en: 'Fine', mark: 'B', size: [1.00, 1.15], value: 1.3, struggle: 0 },
  { id: 2, key: 'silver', zh: '銀星', en: 'Silver', mark: '★', size: [1.16, 1.30], value: 1.8, struggle: 0.15 },
  { id: 3, key: 'gold', zh: '金星', en: 'Gold', mark: '★★', size: [1.31, 1.50], value: 2.6, struggle: 0.30 },
  { id: 4, key: 'crown', zh: '王冠', en: 'Crown', mark: '♛', size: [1.51, 1.85], value: 4.5, struggle: 0.45 },
];

export const tierOfScore = (s) => (s >= 95 ? 4 : s >= 82 ? 3 : s >= 65 ? 2 : s >= 45 ? 1 : 0);

// 收線表現 → ReelBonus 與無傷收線
export function reelBonus({ maxTension, redEntries }) {
  if (maxTension < 80) return { bonus: 25, flawless: true };
  if (redEntries <= 1) return { bonus: 14, flawless: false };
  if (redEntries <= 3) return { bonus: 6, flawless: false };
  return { bonus: 0, flawless: false };
}

// 咬鉤當下先算「潛力」（假設收線無傷），決定這條魚的掙扎強度：大魚比較難拉
export function potential({ base, perfect, spotBonus, timeBest }) {
  return gate(tierOfScore(base + (perfect ? 20 : 0) + 25 + spotBonus), { perfect, timeBest, maxTension: 0, redEntries: 0 });
}

function gate(t, { perfect, timeBest, maxTension, redEntries }) {
  if (t >= 4 && !(timeBest && perfect && maxTension < 80)) t = 3;
  if (t >= 3 && !(perfect || maxTension < 85)) t = 2;
  if (t >= 2 && !(timeBest || perfect)) t = 1;
  if (t < 1 && redEntries < 2) t = 1;
  return t;
}

// 結算：rng() ∈ [0,1)。回傳品質、分數明細與體型倍率
export function judge({ base, perfect, spotBonus, timeBest, maxTension, redEntries, rng }) {
  const rb = reelBonus({ maxTension, redEntries });
  const score = base + (perfect ? 20 : 0) + rb.bonus + spotBonus;
  const tier = gate(tierOfScore(score), { perfect, timeBest, maxTension, redEntries });
  const [a, b] = TIERS[tier].size;
  const mult = a + (b - a) * rng();
  return { tier, score, reelBonus: rb.bonus, flawless: rb.flawless, mult };
}

export const rollBase = (rng) => Math.floor(rng() * 61);
