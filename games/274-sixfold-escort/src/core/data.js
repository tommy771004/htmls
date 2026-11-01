// 六器鏢行 · SIXFOLD ESCORT — 核心靜態資料表（五行、六器、換裝組、階位、武功、玉珮、偃甲、地圖與攤位）

export const ELEMENTS = {
  0: { id: 0, key: 'NONE', name: '無相', short: '無', color: '#c8bfa8', overcomes: -1 },
  1: { id: 1, key: 'METAL', name: '金系', short: '金', color: '#f0d57c', overcomes: 2 }, // 金剋木
  2: { id: 2, key: 'WOOD', name: '木系', short: '木', color: '#58d68d', overcomes: 5 },  // 木剋土
  3: { id: 3, key: 'WATER', name: '水系', short: '水', color: '#4fc3f7', overcomes: 4 }, // 水剋火
  4: { id: 4, key: 'FIRE', name: '火系', short: '火', color: '#ff6b4a', overcomes: 1 },  // 火剋金
  5: { id: 5, key: 'EARTH', name: '土系', short: '土', color: '#d99b52', overcomes: 3 }, // 土剋水
};

// 六器匣裡的六種兵器與各自的被動（暴傷、抗控、閃避吸血、根骨轉攻、破甲、毒傷增幅）
export const WEAPON_TYPES = {
  BLADE: {
    id: 'BLADE', name: '刀', scaling: 'STR', range: 3.4, cd: 0.85,
    passiveName: '斷骨', passiveDesc: '暴擊額外傷害 +15%，破罡係數高',
    critDmgBonus: 0.15, breakBonus: 0.25, color: '#ff5e4d', icon: '刀',
  },
  SWORD: {
    id: 'SWORD', name: '劍', scaling: 'STR', range: 3.8, cd: 0.68,
    passiveName: '遊絲', passiveDesc: '減速／持續傷害／眩暈抵抗 50%，連段命中均衡',
    ccResist: 0.50, breakBonus: 0.05, color: '#6ec6ff', icon: '劍',
  },
  SPEAR: {
    id: 'SPEAR', name: '槍', scaling: 'STR', range: 4.8, cd: 0.82,
    passiveName: '長驅', passiveDesc: '閃避率 +8%，360° 大範圍橫掃與吸血續航',
    dodgeBonus: 0.08, lifesteal: 0.08, breakBonus: 0.10, color: '#f5c451', icon: '槍',
  },
  FIST: {
    id: 'FIST', name: '拳', scaling: 'STR', range: 2.9, cd: 0.60,
    passiveName: '沉勁', passiveDesc: '每 10 點根骨額外提升屬性攻擊 +1%，近身震碎罡氣',
    conAttrScale: 0.001, breakBonus: 0.35, color: '#ff9f43', icon: '拳',
  },
  BOW: {
    id: 'BOW', name: '弓', scaling: 'AGI', range: 10.8, cd: 0.78,
    passiveName: '貫日', passiveDesc: '無視目標防具 15% 防禦力，遠射箭雨減速',
    armorPen: 0.15, breakBonus: 0.08, color: '#5be39b', icon: '弓',
  },
  THROWN: {
    id: 'THROWN', name: '飛針', scaling: 'AGI', range: 9.2, cd: 0.55,
    passiveName: '淬毒', passiveDesc: '對持續傷害目標增傷 +8%，針上帶五行毒傷',
    dotAmp: 0.08, breakBonus: 0.12, color: '#c98bff', icon: '針',
  },
};

// 三組一鍵換裝預設（1／2／3）
export const LOADOUT_PRESETS = [
  {
    id: 1, name: '猛攻裝', short: '猛攻',
    desc: '攻擊力 +18%、暴擊傷害 +22%，適合破罡速攻',
    atkMult: 1.18, defMult: 0.94, shieldMult: 0.95, speedMult: 1.02, critBonus: 0.08,
    robeColor: 0x8e1e20, trimColor: 0xf0c259,
  },
  {
    id: 2, name: '鐵衣守勢裝', short: '鐵衣',
    desc: '最大罡氣 +35%、物理防禦 +28%、罡氣吸收額外 +5%',
    atkMult: 0.92, defMult: 1.28, shieldMult: 1.35, speedMult: 0.96, alphaBonus: 0.05,
    robeColor: 0x1c3d52, trimColor: 0x62d9e8,
  },
  {
    id: 3, name: '流雲風箏裝', short: '風箏',
    desc: '移動與輕功速度 +20%、閃避 +10%、遠程射程 +12%',
    atkMult: 1.05, defMult: 0.98, shieldMult: 1.05, speedMult: 1.20, dodgeBonus: 0.10, rangeMult: 1.12,
    robeColor: 0x244235, trimColor: 0x8cf0b6,
  },
];

// 鏢師階位：凡身 → 開脈（Lv20）→ 守拙／逆鋒（Lv40 分守鏢、走險兩路）→ 歸真／焚心（Lv70）
export const REBIRTH_STAGES = [
  { stage: 0, name: '凡身', faction: 0, reqLv: 1, atkFlat: 0, critRate: 0, critDmg: 0, elemAmp: 0, temperSlots: 2, charmUnlocked: false },
  { stage: 1, name: '開脈', faction: 0, reqLv: 20, atkFlat: 15, critRate: 0.04, critDmg: 0.08, elemAmp: 0.12, temperSlots: 3, charmUnlocked: true },
  { stage: 2, name: '守拙', path: '守鏢一路', faction: 1, reqLv: 40, atkFlat: 30, critRate: 0.10, critDmg: 0.05, elemAmp: 0.30, temperSlots: 4, charmUnlocked: true },
  { stage: 3, name: '逆鋒', path: '走險一路', faction: 2, reqLv: 40, atkFlat: 30, critRate: 0.03, critDmg: 0.15, elemAmp: 0.30, temperSlots: 4, charmUnlocked: true },
  { stage: 4, name: '歸真', path: '守鏢一路', faction: 1, reqLv: 70, atkFlat: 70, critRate: 0.20, critDmg: 0.10, elemAmp: 0.70, temperSlots: 6, charmUnlocked: true },
  { stage: 5, name: '焚心', path: '走險一路', faction: 2, reqLv: 70, atkFlat: 70, critRate: 0.06, critDmg: 0.30, elemAmp: 0.70, temperSlots: 6, charmUnlocked: true },
];
// 晉升只能往下一階走（開脈之後分兩路，選了就不回頭）：鍵是目前階位，值是可晉升的階位
export const REBIRTH_NEXT = { 0: [1], 1: [2, 3], 2: [4], 3: [5], 4: [], 5: [] };

// 鍛爐「換五行」：重淬兵器的五行，每次要一塊百鍊烏鋼加爐錢
export const REFORGE_ELEMENT_COST = { iron: 1, silver: 600 };

// 武功表（六器外功 ＋ 五行內功 ＋ 罡氣／歸息／輕功 ＋ 偃甲專屬技）
export const SKILLS = {
  101: {
    id: 101, name: '斷流斬', trueName: '通玄・斷流斬', category: 'BLADE', weapon: 'BLADE',
    element: 4, mult: 2.35, breakBeta: 1.55, mpCost: 22, cd: 2.2, range: 3.8, aoeRadius: 2.2,
    desc: '一刀縱劈截斷來勢，對罡氣造成 1.55× 削減', color: '#ff4e3a',
  },
  201: {
    id: 201, name: '穿柳三疊', trueName: '通玄・穿柳三疊', category: 'SWORD', weapon: 'SWORD',
    element: 3, mult: 1.95, breakBeta: 1.15, mpCost: 18, cd: 1.6, range: 4.5, aoeRadius: 2.4,
    bindSec: 1.5, desc: '劍走三疊如穿柳枝，附帶減速與高命中連段', color: '#5ec8ff',
  },
  301: {
    id: 301, name: '迴風掃月', trueName: '通玄・迴風掃月', category: 'SPEAR', weapon: 'SPEAR',
    element: 1, mult: 1.88, breakBeta: 1.22, mpCost: 26, cd: 2.4, range: 5.2, aoeRadius: 5.2,
    isSelfAoe: true, lifesteal: 0.12,
    desc: '長槍迴身一圈 360° 橫掃（最多 6 目標），並吸取氣血', color: '#ffd15c',
  },
  401: {
    id: 401, name: '山崩印', trueName: '通玄・山崩印', category: 'FIST', weapon: 'FIST',
    element: 5, mult: 2.10, breakBeta: 1.70, mpCost: 20, cd: 2.0, range: 3.4, aoeRadius: 3.0,
    staggerSec: 0.8, desc: '沉肩一印震退敵群，全武學最高 1.70× 破罡倍率', color: '#ffa94d',
  },
  501: {
    id: 501, name: '落星箭', trueName: '通玄・星墜雨', category: 'BOW', weapon: 'BOW',
    element: 2, mult: 2.05, breakBeta: 1.18, mpCost: 20, cd: 1.9, range: 11.2, aoeRadius: 3.4,
    slowSec: 2.5, desc: '11 公尺遠射貫穿並落下箭雨，無視 15% 防禦並減速', color: '#58e698',
  },
  601: {
    id: 601, name: '碎雨飛針', trueName: '通玄・碎雨飛針', category: 'THROWN', weapon: 'THROWN',
    element: 2, mult: 1.78, breakBeta: 1.25, mpCost: 16, cd: 1.35, range: 9.5, aoeRadius: 3.2,
    dotDps: 28, dotSec: 4.0, desc: '一把淬毒飛針灑向敵群，附加毒傷與致盲，適合拉開距離', color: '#ce8cff',
  },
  701: {
    id: 701, name: '赤燼掌', trueName: '通玄・燎原', category: 'INNER_FIVE', weapon: null,
    element: 4, mult: 2.25, breakBeta: 1.30, mpCost: 30, cd: 2.8, range: 8.2, aoeRadius: 3.6,
    desc: '火系內功（火剋金 1.25×），掌風落處炸開一圈餘燼', color: '#ff6338',
  },
  702: {
    id: 702, name: '寒汀訣', trueName: '通玄・封江', category: 'INNER_FIVE', weapon: null,
    element: 3, mult: 2.10, breakBeta: 1.20, mpCost: 28, cd: 2.6, range: 8.2, aoeRadius: 3.2,
    slowSec: 3.0, desc: '水系內功（水剋火 1.25×），凝出霜刃遲緩敵方行動', color: '#45b8ff',
  },
  704: {
    id: 704, name: '鳴雷指', trueName: '通玄・萬鈞', category: 'INNER_FIVE', weapon: null,
    element: 1, mult: 2.20, breakBeta: 1.35, mpCost: 28, cd: 2.6, range: 8.2, aoeRadius: 2.8,
    desc: '金系內功（金剋木 1.25×），一指引雷轟擊單點與周遭', color: '#f7de7e',
  },
  801: {
    id: 801, name: '鐵衣訣', trueName: '通玄・鐵衣', category: 'PASSIVE', weapon: null,
    element: 5, mult: 0, breakBeta: 0, mpCost: 0, cd: 0, range: 0, aoeRadius: 0,
    desc: '罡氣心法：1~12 重將罡氣吸收率 α 由 70% 提升至 85%（通玄 87%）', color: '#e8b45a',
  },
  802: {
    id: 802, name: '歸息訣', trueName: '通玄・歸息', category: 'PASSIVE', weapon: null,
    element: 2, mult: 0, breakBeta: 0, mpCost: 0, cd: 0, range: 0, aoeRadius: 0,
    desc: '調息養氣：每秒額外回復罡氣與內力，縮短破罡失衡時間', color: '#6ee09e',
  },
  803: {
    id: 803, name: '踏浪步', trueName: '通玄・踏浪', category: 'PASSIVE', weapon: null,
    element: 0, mult: 0, breakBeta: 0, mpCost: 8, cd: 3.0, range: 6.5, aoeRadius: 0,
    desc: '輕功：提高基礎移速，並可留下殘影瞬步閃避殺招', color: '#9be7ff',
  },
  9001: {
    id: 9001, name: '千鈞錘', trueName: '金樞・千鈞錘', category: 'MECH', weapon: null,
    element: 1, mult: 3.40, breakBeta: 2.10, mpCost: 0, cd: 2.2, range: 6.8, aoeRadius: 5.8,
    isSelfAoe: true, desc: '【偃甲專屬】機關巨偶掄起銅錘砸地，霸體橫掃周遭敵人', color: '#70e4ff',
  },
  9002: {
    id: 9002, name: '連弩齊發', trueName: '金樞・連弩齊發', category: 'MECH', weapon: null,
    element: 4, mult: 4.10, breakBeta: 2.40, mpCost: 0, cd: 4.5, range: 13.5, aoeRadius: 4.6,
    desc: '【偃甲專屬】胸前弩匣一次放盡，覆蓋遠處密集目標', color: '#c47dff',
  },
};

// 開局六器匣（每招自動從匣中抽出對應兵器，可鍛到 +12）
export const INITIAL_WEAPONS = [
  { uid: 'wpn-blade-01', tplId: 1001, name: '截江刀', type: 'BLADE', baseAtk: 68, upgrade: 9, pity: 40, element: 4, gems: ['ATK_DMG', 'ATK_FEROCITY'] },
  { uid: 'wpn-spear-01', tplId: 1002, name: '白蠟長槍', type: 'SPEAR', baseAtk: 64, upgrade: 10, pity: 20, element: 1, gems: ['ATK_DMG'] },
  { uid: 'wpn-thrown-01', tplId: 1003, name: '柳葉飛針', type: 'THROWN', baseAtk: 58, upgrade: 7, pity: 60, element: 2, gems: ['ATK_PIERCE'] },
  { uid: 'wpn-sword-01', tplId: 1004, name: '青鋒劍', type: 'SWORD', baseAtk: 62, upgrade: 7, pity: 0, element: 3, gems: ['ATK_DMG'] },
  { uid: 'wpn-fist-01', tplId: 1005, name: '鐵指虎', type: 'FIST', baseAtk: 60, upgrade: 6, pity: 0, element: 5, gems: [] },
  { uid: 'wpn-bow-01', tplId: 1006, name: '牛角弓', type: 'BOW', baseAtk: 63, upgrade: 8, pity: 25, element: 2, gems: ['ATK_FEROCITY'] },
];

// 三種藥的瞬補比例（說明文字與實際效果共用）
export const POTION_EFFECT = { hp: 0.68, shield: 0.72, cleanse: 0.65 };

// 淬紋石（鑲在兵器或身上，攻擊類三種、防禦類三種）
export const TEMPER_STONES = {
  ATK_DMG: { id: 'ATK_DMG', kind: 'ATK', name: '淬紋石・銳鋒', bonusText: '外功／內功傷害 +6%', atkPct: 0.06 },
  ATK_PIERCE: { id: 'ATK_PIERCE', kind: 'ATK', name: '淬紋石・穿罡', bonusText: '命中與破罡 +6%', breakPct: 0.06 },
  ATK_FEROCITY: { id: 'ATK_FEROCITY', kind: 'ATK', name: '淬紋石・狠勁', bonusText: '暴擊率 +4%、暴傷 +8%', critRate: 0.04, critDmg: 0.08 },
  DEF_SHIELD: { id: 'DEF_SHIELD', kind: 'DEF', name: '淬紋石・厚罡', bonusText: '最大罡氣 +120', maxShield: 120 },
  DEF_HP: { id: 'DEF_HP', kind: 'DEF', name: '淬紋石・養身', bonusText: '最大生命 +150', maxHp: 150 },
  DEF_RES: { id: 'DEF_RES', kind: 'DEF', name: '淬紋石・穩樁', bonusText: '物防 +18、抗暴 +5%', defFlat: 18 },
};

// 四季玉珮（春／夏／秋／冬；素 → 溫 → 潤 → 凝）
export const JADE_CHARMS = [
  { id: 'spring', name: '春玉珮', color: '#39d98a', tier: 1, stage: 4, statLabel: '輕功移速 +8%・木系內功 +12%' },
  { id: 'summer', name: '夏玉珮', color: '#ff5c4d', tier: 2, stage: 6, statLabel: '外功攻擊 +36・暴擊傷害 +10%' },
  { id: 'autumn', name: '秋玉珮', color: '#dff4ff', tier: 1, stage: 5, statLabel: '罡氣上限 +180・破罡抗性 +8%' },
  { id: 'winter', name: '冬玉珮', color: '#ffd452', tier: 2, stage: 7, statLabel: '物理防禦 +28・五行全抗 +8%' },
];
export const CHARM_TIERS = ['未養', '素', '溫', '潤', '凝'];

// 偃甲三階（竹骨 → 銅骨 → 金樞「不周」）
export const MECH_TIERS = {
  1: { tier: 1, name: '竹骨偃甲', color: 0xb87b4b, glow: 0x4ad8ff, scale: 1.85, atkBonus: 85, absorb: 0.80 },
  2: { tier: 2, name: '銅骨偃甲', color: 0xc9d6e3, glow: 0x6ef2ff, scale: 2.05, atkBonus: 165, absorb: 0.80 },
  3: { tier: 3, name: '金樞偃甲「不周」', color: 0xf2c14e, glow: 0xe0b04a, scale: 2.28, atkBonus: 280, absorb: 0.84 },
};

// 不可走區：建築的軸對齊矩形 [x0, z0, x1, z1]（主角與怪物走進去會被推出最近的一邊）。
// 和 scenery.js 的鏡頭 colliders 分開：這裡只包牆腳，不包屋簷。
export const MAP_BLOCKERS = {
  1001: [
    [-16.4, 21.3, 16.4, 34],      // 順安鏢局：門樓、院牆與院子整個不可進（院子太淺，鏡頭會卡進正廳）
    [-26, -8.8, -19.2, 1.8],      // 西貨棧（南）
    [-26, 4.8, -19.2, 13.2],      // 西貨棧（北）
    [-7.35, 10.15, -5.65, 11.85], // 水井
  ],
  1002: [
    [-13.2, -11.2, -10.8, -8.8],  // 西烽燧・甲 的夯土台
    [-1.2, -16.2, 1.2, -13.8],    // 中烽燧・乙
    [11.8, -10.2, 14.2, -7.8],    // 東烽燧・丙
  ],
  2001: [
    [-15.8, -12.8, -14.2, -11.2], [14.2, -12.8, 15.8, -11.2], // 殘柱
    [-21.8, 5.2, -20.2, 6.8], [20.2, 7.2, 21.8, 8.8],
    [-12.8, 21.2, -11.2, 22.8], [11.2, 22.2, 12.8, 23.8],
    [-6.8, -22.8, -5.2, -21.2], [5.2, -22.8, 6.8, -21.2],
  ],
};

// 三張實際可走的地圖：青萍渡（主城）、赤沙驛（攻防）、偃師遺墟（偃甲不耗樞力）
export const MAPS = {
  1001: {
    id: 1001, name: '青萍渡', sub: '河渡市集・攤販街與南岸獵場',
    region: 'SURFACE', isFreeGearZone: false, recLv: 'Lv.1 ~ 25',
    skyTop: '#23394d', skyHorizon: '#8da69b', groundBase: '#6d674e', groundRoad: '#9b8c6e', fogColor: '#7a8c89',
    spawn: { x: 0, z: 4 },
    portals: [
      { x: 0, z: -23, toMap: 1002, label: '往 赤沙驛（烽燧／亮刃）' },
      { x: 22, z: 0, toMap: 2001, label: '往 偃師遺墟（偃甲不耗樞力）' },
    ],
  },
  1002: {
    id: 1002, name: '赤沙驛', sub: '荒漠驛站・一真二假烽燧與劫鏢匪出沒地',
    region: 'SURFACE', isFreeGearZone: false, recLv: 'Lv.20 ~ 65',
    skyTop: '#3d2419', skyHorizon: '#d4945a', groundBase: '#b88b52', groundRoad: '#8c6940', fogColor: '#b88454',
    spawn: { x: 0, z: 12 },
    portals: [
      { x: -16, z: 16, toMap: 1001, label: '返 青萍渡（攤販安全區）' },
      { x: 23, z: -8, toMap: 2001, label: '地脈往 偃師遺墟' },
    ],
  },
  2001: {
    id: 2001, name: '偃師遺墟', sub: '機樞地脈・偃甲不耗樞力常駐區',
    region: 'RUINS', isFreeGearZone: true, recLv: 'Lv.45 ~ 90',
    skyTop: '#0d0821', skyHorizon: '#3c1f6e', groundBase: '#1d1a30', groundRoad: '#2e2650', fogColor: '#251747',
    spawn: { x: 0, z: 11 },
    portals: [
      { x: -17, z: 14, toMap: 1001, label: '返 青萍渡' },
      { x: 20, z: 0, toMap: 1002, label: '往 赤沙驛' },
    ],
  },
};

// 鏢路圖節點（點擊傳送到對應的實際地圖；playable 為實際可走的三張）
export const WORLD_MAP_NODES = [
  { id: 'tieling', name: '鐵嶺關', lv: 'Lv.25-35', x: 14, y: 18, targetMap: 1002 },
  { id: 'duanqiao', name: '斷橋集', lv: 'Lv.6-15', x: 28, y: 30, targetMap: 1002 },
  { id: 'bailu', name: '白鷺洲', lv: 'Lv.8-15', x: 14, y: 50, targetMap: 1002 },
  { id: 'chisha', name: '赤沙驛', lv: 'Lv.20-65', x: 28, y: 52, targetMap: 1002, playable: true },
  { id: 'qingping', name: '青萍渡', lv: '主城・順安鏢局', x: 45, y: 52, targetMap: 1001, playable: true },
  { id: 'shigu', name: '石鼓村', lv: 'Lv.15-30', x: 45, y: 70, targetMap: 1001 },
  { id: 'yanhui', name: '雁回峽', lv: 'Lv.20-40', x: 26, y: 84, targetMap: 1002 },
  { id: 'luoyan', name: '落雁坡', lv: 'Lv.40-50', x: 62, y: 70, targetMap: 1001 },
  { id: 'heishui', name: '黑水渡', lv: 'Lv.35-50', x: 62, y: 52, targetMap: 1001 },
  { id: 'shuanglin', name: '霜林寺', lv: 'Lv.45-60', x: 62, y: 32, targetMap: 1002 },
  { id: 'wangxiang', name: '望鄉臺', lv: 'Lv.70-80', x: 78, y: 18, targetMap: 1001 },
  { id: 'yunzhan', name: '雲棧道', lv: 'Lv.65-80', x: 84, y: 38, targetMap: 2001 },
  { id: 'ruins', name: '偃師遺墟', lv: '偃甲不耗樞力', x: 82, y: 76, targetMap: 2001, playable: true },
];

// 青萍渡攤販街初始攤位（寄攤：託行會代看 24 時辰；行會可全攤檢索並畫朱砂引路線）
export const INITIAL_STALLS = [
  {
    id: 'stall-1', owner: '河西貨郎', title: '【收攤清貨】百鍊烏鋼・護器符',
    x: -9.5, z: -3.5, expiresHours: 23,
    items: [
      { id: 'st-item-1', kind: 'MAT_IRON', name: '百鍊烏鋼 ×5', desc: '+7~+12 鍛器必備', priceSilver: 1800, grant: { iron: 5 } },
      { id: 'st-item-2', kind: 'MAT_PROTECT', name: '護器符 ×3', desc: '鍛器失敗不降階並累積爐溫', priceSilver: 2200, grant: { protectScroll: 3 } },
    ],
  },
  {
    id: 'stall-2', owner: '說書人老周', title: '【通玄心得】十二重之後的手札',
    x: -9.5, z: 2.5, expiresHours: 19,
    items: [
      { id: 'st-item-3', kind: 'TRUE_SCROLL', name: '《通玄心得》', desc: '將十二重圓滿的武功突破到第十三重「通玄」', priceSilver: 3200, grant: { trueScroll: 1 } },
      { id: 'st-item-4', kind: 'EXP_SCROLL', name: '武學手札 ×3', desc: '立即提升當前武功 3 重', priceSilver: 950, grant: { martialScroll: 3 } },
    ],
  },
  {
    id: 'stall-3', owner: '柳三娘', title: '【渡口藥舖】聚罡散・回春丸',
    x: 9.5, z: -3.5, expiresHours: 22,
    items: [
      { id: 'st-item-5', kind: 'POT_SHIELD', name: '聚罡散 ×10', desc: `瞬補 ${Math.round(POTION_EFFECT.shield * 100)}% 罡氣（亮刃時防破罡）`, priceSilver: 800, grant: { shieldPots: 10 } },
      { id: 'st-item-6', kind: 'POT_HP', name: '回春丸 ×10', desc: `瞬補 ${Math.round(POTION_EFFECT.hp * 100)}% 生命`, priceSilver: 850, grant: { hpPots: 10 } },
    ],
  },
  {
    id: 'stall-4', owner: '遺墟拾荒人', title: '【遺墟拾得】機樞核心・養玉露',
    x: 9.5, z: 2.5, expiresHours: 16,
    items: [
      { id: 'st-item-7', kind: 'MECH_CORE', name: '機樞核心 ×3', desc: '重鑄銅骨／金樞偃甲的關節與樞輪', priceSilver: 2600, grant: { mechCores: 3 } },
      { id: 'st-item-8', kind: 'JADE_DEW', name: '養玉露 ×4', desc: '溫養四季玉珮（素→溫→潤→凝）', priceSilver: 1900, grant: { jadeDew: 4 } },
    ],
  },
  {
    id: 'stall-5', owner: '白鷺洲漁娘', title: '【淬紋石】狠勁・厚罡',
    x: -5.5, z: -8.5, expiresHours: 14,
    items: [
      { id: 'st-item-9', kind: 'TEMPER_CRIT', name: '淬紋石・狠勁', desc: '鑲進淬紋槽：暴擊率 +4%、暴傷 +8%', priceSilver: 1500, grant: { temperStone: 'ATK_FEROCITY' } },
      { id: 'st-item-10', kind: 'TEMPER_SHIELD', name: '淬紋石・厚罡', desc: '鑲進淬紋槽：最大罡氣 +120', priceSilver: 1400, grant: { temperStone: 'DEF_SHIELD' } },
    ],
  },
  {
    id: 'stall-6', owner: '石老鐵', title: '【爐邊現貨】+11 柳葉飛針',
    x: 5.5, z: -8.5, expiresHours: 24,
    items: [
      { id: 'st-item-11', kind: 'UPG_DART', name: '飛針直升 +11 鍛器帖', desc: '把匣中的柳葉飛針直接鍛到 +11', priceSilver: 4500, grant: { upgradeWeapon: { uid: 'wpn-thrown-01', level: 11 } } },
    ],
  },
];
