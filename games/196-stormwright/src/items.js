// 物品定義表（SPEC §5、§6）。combat 軌道：加入後座力序列、裝備時間、彈道、準心型態與戰利品權重。
export const RARITY = [
  { name: '普通', color: '#a8b0b8', hex: 0xa8b0b8, glow: 0.55, beam: 2.4 },
  { name: '優良', color: '#5fc12f', hex: 0x5fc12f, glow: 0.8, beam: 3.2 },
  { name: '稀有', color: '#3aa0f2', hex: 0x3aa0f2, glow: 1.0, beam: 4.2 },
  { name: '史詩', color: '#b04be6', hex: 0xb04be6, glow: 1.5, beam: 5.6 },
  { name: '傳說', color: '#f2a33a', hex: 0xf2a33a, glow: 2.2, beam: 7.5 },
];
export const AMMO_TYPES = ['light', 'medium', 'heavy', 'shells'];
export const AMMO_NAMES = { light: '輕型彈藥', medium: '中型彈藥', heavy: '重型彈藥', shells: '霰彈' };
export const AMMO_BOX = { light: 30, medium: 24, heavy: 6, shells: 8 };
export const AMMO_COLORS = { light: '#ffd84a', medium: '#6be04a', heavy: '#ff7a3a', shells: '#ff4a4a' };
export const MAT_NAMES = { wood: '木材', stone: '石材', metal: '金屬' };
export const MAT_COLORS = { wood: '#d9984a', stone: '#9fb0c6', metal: '#c9d3dc' };

// falloff: [起點, 終點, 最低倍率]
// 散布單位為弧度（半角）。recoil: 每發 [抬頭 pitch, 偏航 yaw]（弧度）循環；shake: 開火鏡頭震動 [強度, 秒]；
// equip: 換槍準備秒數；xh: 準心型態；proj: 有值則為彈道子彈 { speed m/s, grav m/s² }
export const WEAPONS = {
  ar: { name: '突擊步槍', ammo: 'medium', mag: 30, rate: 5.5, dmg: 30, head: 1.5, reload: 2.3, falloff: [50, 150, 0.7], pellets: 1, spreadHip: 0.022, spreadAds: 0.004, bloom: 0.0042, bloomMax: 0.026, bloomRecover: 0.06, bloomDelay: 0.14, rarity: [0, 4], weight: 3, auto: true, equip: 0.35, xh: 'cross', firstShot: true,
    recoil: [[0.0052, 0.0006], [0.0058, -0.0010], [0.0062, 0.0012], [0.0056, 0.0018], [0.005, -0.0006], [0.0046, -0.0020], [0.0044, 0.0010], [0.0042, 0.0022]], adsRecoil: 0.6 },
  pump: { name: '泵動霰彈槍', ammo: 'shells', mag: 5, rate: 0.75, dmg: 9, head: 2, reload: 0.5, falloff: [10, 25, 0.2], pellets: 10, spreadHip: 0.075, spreadAds: 0.055, bloom: 0, bloomMax: 0, bloomRecover: 0.1, bloomDelay: 0.1, rarity: [0, 4], weight: 2, perShell: true, equip: 0.5, xh: 'circle', recoil: [[0.05, 0.004]], adsRecoil: 0.75, shake: [0.45, 0.22] },
  smg: { name: '衝鋒槍', ammo: 'light', mag: 30, rate: 11, dmg: 16, head: 1.5, reload: 2.2, falloff: [30, 80, 0.6], pellets: 1, spreadHip: 0.03, spreadAds: 0.012, bloom: 0.0024, bloomMax: 0.03, bloomRecover: 0.08, bloomDelay: 0.1, rarity: [0, 3], weight: 3, auto: true, equip: 0.3, xh: 'cross',
    recoil: [[0.0026, 0.0010], [0.0030, -0.0014], [0.0028, 0.0016], [0.0024, -0.0008], [0.0022, 0.0020], [0.0022, -0.0018]], adsRecoil: 0.65 },
  sniper: { name: '栓動狙擊槍', ammo: 'heavy', mag: 1, rate: 0.4, dmg: 105, head: 2.5, reload: 2.6, falloff: null, pellets: 1, spreadHip: 0.06, spreadAds: 0.0006, bloom: 0, bloomMax: 0, bloomRecover: 0.1, bloomDelay: 0.1, rarity: [2, 4], weight: 1, zoom: 4, equip: 0.5, xh: 'dot', proj: { speed: 380, grav: 9 }, recoil: [[0.045, 0.002]], adsRecoil: 0.8, shake: [0.35, 0.25] },
  pistol: { name: '手槍', ammo: 'light', mag: 16, rate: 6.5, dmg: 24, head: 1.5, reload: 1.3, falloff: [30, 90, 0.7], pellets: 1, spreadHip: 0.02, spreadAds: 0.006, bloom: 0.006, bloomMax: 0.028, bloomRecover: 0.07, bloomDelay: 0.12, rarity: [0, 2], weight: 3, equip: 0.25, xh: 'cross', recoil: [[0.012, 0.001], [0.011, -0.0015]], adsRecoil: 0.7 },
  pickaxe: { name: '十字鎬', melee: true, rate: 1.6, dmg: 20, range: 2.2, rarity: [0, 0], equip: 0.2, xh: 'pick', hitDelay: 0.18 },
};
export const CONSUMABLES = {
  bandage: { name: '繃帶', stack: 15, use: 3.5, heal: 'health', amount: 15, cap: 75, weight: 4, equip: 0.1 },
  medkit: { name: '醫療包', stack: 3, use: 10, heal: 'health', amount: 100, cap: 100, weight: 1, equip: 0.1 },
  minishield: { name: '小護盾瓶', stack: 6, use: 2, heal: 'shield', amount: 25, cap: 50, weight: 4, equip: 0.1 },
  shield: { name: '護盾藥水', stack: 3, use: 5, heal: 'shield', amount: 50, cap: 100, weight: 1, equip: 0.1 },
};

let UID = 1;
export const PICKAXE = { uid: 0, defId: 'pickaxe', kind: 'weapon', rarity: 0, mag: 0, count: 1 };

export function defOf(item) {
  if (!item) return null;
  if (item.kind === 'weapon') return WEAPONS[item.defId];
  if (item.kind === 'consumable') return CONSUMABLES[item.defId];
  return null;
}
export function makeItem(defId, rarity = 0, count) {
  if (WEAPONS[defId]) {
    const w = WEAPONS[defId];
    const r = Math.max(w.rarity[0], Math.min(w.rarity[1], rarity));
    return { uid: UID++, defId, kind: 'weapon', rarity: r, mag: w.mag || 0, count: 1 };
  }
  if (CONSUMABLES[defId]) return { uid: UID++, defId, kind: 'consumable', rarity: defId === 'medkit' || defId === 'shield' ? 2 : 0, mag: 0, count: count || 1 };
  if (defId.startsWith('ammo_')) return { uid: UID++, defId, kind: 'ammo', rarity: 0, mag: 0, count: count || AMMO_BOX[defId.slice(5)] };
  if (defId.startsWith('mat_')) return { uid: UID++, defId, kind: 'mats', rarity: 0, mag: 0, count: count || 30 };
  throw new Error('未知物品 ' + defId);
}
export function itemName(item) {
  if (!item) return '';
  if (item.kind === 'weapon') return `${RARITY[item.rarity].name} ${WEAPONS[item.defId].name}`;
  if (item.kind === 'consumable') return CONSUMABLES[item.defId].name;
  if (item.kind === 'ammo') return AMMO_NAMES[item.defId.slice(5)];
  return MAT_NAMES[item.defId.slice(4)];
}
export function itemColor(item) {
  if (item.kind === 'weapon') return RARITY[item.rarity].color;
  if (item.kind === 'consumable') return item.rarity >= 2 ? RARITY[2].color : RARITY[item.defId.includes('shield') ? 2 : 1].color;
  if (item.kind === 'mats') return MAT_COLORS[item.defId.slice(4)];
  return AMMO_COLORS[item.defId.slice(5)] || '#e8c15a';
}
// 稀有度加成後的實際數值（依 defId:rarity 快取，回傳共用物件，請勿修改）
const _stat = new Map();
export function weaponStat(item) {
  const r = item.rarity || 0, key = item.defId + r;
  let s = _stat.get(key);
  if (!s) {
    const w = WEAPONS[item.defId];
    s = { ...w, defId: item.defId, rarityIdx: r, dmg: w.dmg * Math.pow(1.05, r), reload: w.reload * Math.pow(0.95, r) };
    _stat.set(key, s);
  }
  return s;
}
export function falloffMul(w, d) {
  if (!w.falloff) return 1;
  const [a, b, m] = w.falloff;
  const t = Math.max(0, Math.min(1, (d - a) / (b - a)));
  return 1 - (1 - m) * t;
}

function pickWeighted(rng, table) {
  const ids = Object.keys(table);
  const total = ids.reduce((s, k) => s + table[k].weight, 0);
  let t = rng() * total, id = ids[0];
  for (const k of ids) { t -= table[k].weight; if (t <= 0) { id = k; break; } }
  return id;
}
function rollRarity(rng, bonus = 0) {
  const q = Math.max(0, rng() - bonus);
  return q < 0.45 ? 0 : q < 0.74 ? 1 : q < 0.9 ? 2 : q < 0.975 ? 3 : 4;
}
const WEAPON_IDS = Object.keys(WEAPONS).filter((k) => k !== 'pickaxe');
const WEAPON_TABLE = Object.fromEntries(WEAPON_IDS.map((k) => [k, WEAPONS[k]]));
export function randomWeapon(rng, bonus = 0, minRarity = 0) {
  const id = pickWeighted(rng, WEAPON_TABLE), w = WEAPONS[id];
  return makeItem(id, Math.max(minRarity, rollRarity(rng, bonus)));
}
// 戰利品權重：室內多武器、POI 稀有度加成；戶外偏彈藥與材料。ctxInfo = { inside, poi }
export function randomLoot(rng, info = {}) {
  const inside = !!info.inside, poi = !!info.poi;
  const bonus = (poi ? 0.06 : 0) + (inside ? 0.05 : 0);
  const r = rng();
  const wCut = inside ? 0.5 : poi ? 0.44 : 0.34, cCut = wCut + (inside ? 0.26 : 0.24);
  if (r < wCut) return randomWeapon(rng, bonus);
  if (r < cCut) {
    const id = pickWeighted(rng, CONSUMABLES);
    return makeItem(id, 0, id === 'bandage' ? 5 : id === 'minishield' ? 2 : 1);
  }
  if (!inside && rng() < 0.3) return makeItem('mat_' + ['wood', 'stone', 'metal'][Math.floor(rng() * 3)], 0, 20 + Math.floor(rng() * 20));
  return makeItem('ammo_' + AMMO_TYPES[Math.floor(rng() * 4)]);
}
// 寶箱內容：1 把武器（稀有以上）+ 1 個消耗品 + 對應彈藥 + 材料
export function chestLoot(rng) {
  const w = randomWeapon(rng, 0.2, 2);
  const def = WEAPONS[w.defId];
  const out = [w];
  const cid = rng() < 0.5 ? (rng() < 0.55 ? 'minishield' : 'shield') : (rng() < 0.7 ? 'bandage' : 'medkit');
  out.push(makeItem(cid, 0, cid === 'bandage' ? 4 : cid === 'minishield' ? 3 : 1));
  out.push(makeItem('ammo_' + def.ammo, 0, def.ammo === 'heavy' ? 8 : def.ammo === 'shells' ? 10 : 30));
  out.push(makeItem('mat_' + ['wood', 'stone', 'metal'][Math.floor(rng() * 3)], 0, 30));
  return out;
}
