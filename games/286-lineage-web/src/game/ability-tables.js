/**
 * 天堂 1.63 / Lineage Real 角色基本數值與能力公式表
 * 參照官方能力介紹頁：https://lineagereal.com/ability/
 */

export const LINEAGE_REAL_BASE_STATS = {
  royal: {
    base: { str: 13, dex: 10, con: 10, wis: 11, cha: 13, int: 10 },
    pts: 8,
    baseHp: 14,
    maxHpCap: 1000,
    maxMpCap: 600,
  },
  knight: {
    base: { str: 16, dex: 12, con: 14, wis: 9, cha: 12, int: 8 },
    pts: 4,
    baseHp: 16,
    maxHpCap: 1500,
    maxMpCap: 200,
  },
  elf: {
    base: { str: 11, dex: 12, con: 12, wis: 12, cha: 9, int: 12 },
    pts: 7,
    baseHp: 15,
    maxHpCap: 1200,
    maxMpCap: 800,
  },
  mage: {
    base: { str: 8, dex: 7, con: 12, wis: 12, cha: 8, int: 12 },
    pts: 16,
    baseHp: 12,
    maxHpCap: 800,
    maxMpCap: 1200,
  },
  dark: {
    base: { str: 12, dex: 15, con: 8, wis: 10, cha: 9, int: 11 },
    pts: 10,
    baseHp: 16,
    maxHpCap: 1200,
    maxMpCap: 700,
  },
  illusion: {
    base: { str: 11, dex: 10, con: 12, wis: 12, cha: 8, int: 12 },
    pts: 10,
    baseHp: 16,
    maxHpCap: 900,
    maxMpCap: 900,
  },
  dragon: {
    base: { str: 13, dex: 11, con: 14, wis: 12, cha: 8, int: 11 },
    pts: 6,
    baseHp: 21,
    maxHpCap: 1400,
    maxMpCap: 500,
  },
  warrior: {
    base: { str: 16, dex: 13, con: 16, wis: 7, cha: 8, int: 10 },
    pts: 5,
    baseHp: 24,
    maxHpCap: 1600,
    maxMpCap: 200,
  },
};

export function normalizeAbilityClassId(classId) {
  if (classId === 'darkelf') return 'dark';
  return LINEAGE_REAL_BASE_STATS[classId] ? classId : 'royal';
}

function lookupRange(value, table) {
  for (let i = table.length - 1; i >= 0; i -= 1) {
    if (value >= table[i][0]) return table[i][1];
  }
  return table[0][1];
}

// ── STR 力量表 ──
const STR_MELEE_DMG_TABLE = [
  [-99, -2],
  [9, -1],
  [11, 0],
  [13, 1],
  [15, 2],
  [17, 3],
  [19, 4],
  [21, 5],
  [23, 6],
  [26, 7],
  [29, 8],
  [31, 9],
  [33, 10],
  [34, 11],
  [35, 12],
  [39, 13],
  [43, 14],
  [47, 15],
  [51, 16],
  [55, 17],
  [59, 18],
];

const STR_MELEE_HIT_TABLE = [
  [-99, -1],
  [10, 0],
  [12, 1],
  [14, 2],
  [16, 3],
  [18, 4],
  [21, 5],
  [24, 6],
  [27, 7],
  [30, 8],
  [33, 9],
  [35, 10],
  [39, 11],
  [42, 12],
  [45, 13],
  [49, 14],
  [51, 15],
  [54, 16],
  [57, 17],
  [60, 18],
];

export function getStrBaseBonuses(effStr) {
  return {
    meleeDmg: lookupRange(effStr, STR_MELEE_DMG_TABLE),
    meleeHit: lookupRange(effStr, STR_MELEE_HIT_TABLE),
    meleeCritPct: effStr >= 45 ? 1 : 0,
  };
}

// ── DEX 敏捷表 ──
const DEX_BOW_DMG_TABLE = [
  [-99, 0],
  [15, 1],
  [16, 2],
  [17, 3],
  [18, 4],
  [21, 5],
  [24, 6],
  [27, 7],
  [31, 8],
  [33, 9],
  [36, 10],
  [40, 11],
  [44, 12],
  [48, 13],
  [52, 14],
  [56, 15],
  [59, 16],
];

const DEX_BOW_HIT_TABLE = [
  [-99, -1],
  [9, 0],
  [11, 1],
  [13, 2],
  [15, 3],
  [17, 4],
  [19, 5],
  [20, 6],
  [21, 7],
  [23, 8],
  [24, 9],
  [25, 10],
  [26, 11],
  [27, 12],
  [28, 13],
  [29, 14],
  [30, 15],
  [31, 16],
  [32, 17],
  [33, 19],
  [36, 20],
  [39, 21],
  [42, 22],
  [45, 23],
  [48, 24],
  [51, 25],
  [54, 26],
  [57, 27],
  [59, 28],
];

const DEX_ER_TABLE = [
  [-99, -1],
  [8, 0],
  [10, 1],
  [12, 2],
  [14, 3],
  [16, 4],
  [18, 5],
  [20, 6],
  [22, 7],
  [25, 8],
  [27, 9],
  [28, 10],
  [30, 11],
  [32, 12],
  [34, 13],
  [36, 14],
  [38, 15],
  [40, 16],
  [42, 17],
  [44, 18],
  [46, 19],
  [48, 20],
  [50, 21],
  [52, 22],
  [54, 23],
  [56, 24],
  [58, 25],
];

export function getDexAcDivisor(effDex) {
  if (effDex <= 9) return 8;
  if (effDex <= 12) return 7;
  if (effDex <= 15) return 6;
  if (effDex <= 17) return 5;
  return 4;
}

export function getDexBaseBonuses(effDex) {
  return {
    bowDmg: lookupRange(effDex, DEX_BOW_DMG_TABLE),
    bowHit: lookupRange(effDex, DEX_BOW_HIT_TABLE),
    er: lookupRange(effDex, DEX_ER_TABLE),
    acDivisor: getDexAcDivisor(effDex),
  };
}

// ── CON 體質表 ──
export function getConBaseBonuses(effCon) {
  return {
    hpGrowth: effCon <= 15 ? 0 : Math.min(20, effCon - 15),
    hpRegen: effCon <= 13 ? 1 : effCon - 12,
    potionBonusPct: effCon <= 17 ? 0 : effCon <= 24 ? 1 : effCon <= 30 ? 2 : 3,
  };
}

// ── WIS 精神表 ──
const WIS_MR_TABLE = [
  [-99, 0],
  [15, 3],
  [17, 6],
  [18, 10],
  [19, 15],
  [20, 21],
  [21, 28],
  [22, 37],
  [23, 47],
  [24, 50],
  [35, 55],
  [40, 59],
  [44, 62],
  [46, 64],
  [50, 65],
];

export function getWisBaseBonuses(effWis) {
  let mpGrowth = 0;
  if (effWis <= 10) mpGrowth = -1;
  else if (effWis === 11) mpGrowth = 0;
  else if (effWis <= 13) mpGrowth = 1;
  else if (effWis <= 16) mpGrowth = 2;
  else mpGrowth = effWis - 14;

  return {
    mpRegen: effWis <= 14 ? 1 : effWis <= 16 ? 2 : 3,
    bluePotBonus: effWis <= 11 ? 1 : effWis - 10,
    mpGrowth,
    mrPct: lookupRange(effWis, WIS_MR_TABLE),
  };
}

export function computeInitialMp(classId, birthWis) {
  const cid = normalizeAbilityClassId(classId);
  if (cid === 'royal') return birthWis >= 16 ? 4 : birthWis >= 12 ? 3 : 2;
  if (cid === 'knight' || cid === 'warrior') return birthWis >= 12 ? 2 : 1;
  if (cid === 'elf') return birthWis >= 16 ? 6 : 4;
  if (cid === 'mage') return birthWis >= 16 ? 8 : birthWis >= 12 ? 6 : 4;
  if (cid === 'dark') return birthWis >= 16 ? 6 : birthWis >= 12 ? 4 : 3;
  return birthWis >= 14 ? 6 : 4;
}

export function computeInitialHp(classId) {
  const cid = normalizeAbilityClassId(classId);
  return LINEAGE_REAL_BASE_STATS[cid]?.baseHp ?? 14;
}

// ── INT 智力表 ──
const INT_EXTRA_SP_TABLE = [
  [-99, -2],
  [6, -1],
  [9, 0],
  [12, 1],
  [15, 2],
  [18, 3],
  [19, 4],
  [20, 5],
  [21, 6],
  [22, 7],
  [23, 8],
  [24, 9],
  [25, 10],
  [41, 11],
  [44, 12],
  [50, 13],
];

// 官方能力頁第 5 張：INT 對應各階段魔法消耗魔力減免上限
const INT_MP_REDUCE_BY_VAL = [
  [-99, 0],
  [13, 1],
  [15, 2],
  [17, 3],
  [19, 4],
  [21, 5],
  [23, 6],
  [25, 7],
  [26, 8],
  [27, 9],
];

export function getClassMagicLevel(classId, level) {
  const cid = normalizeAbilityClassId(classId);
  const lv = Math.max(1, Number(level || 1));
  if (cid === 'mage') return Math.min(10, Math.floor(lv / 4));
  if (cid === 'elf') return Math.min(6, Math.floor(lv / 8));
  if (cid === 'illusion') return Math.min(6, Math.floor(lv / 6));
  if (cid === 'royal') return lv >= 20 ? 2 : lv >= 10 ? 1 : 0;
  if (cid === 'dark') return lv >= 24 ? 2 : lv >= 12 ? 1 : 0;
  if (cid === 'dragon') return lv >= 50 ? 2 : lv >= 25 ? 1 : 0;
  return lv >= 50 ? 1 : 0; // knight / warrior Lv.50
}

export function getSpellMpDiscount(effInt, circle = 1, birthMpReduce = 0) {
  const cap = lookupRange(effInt, INT_MP_REDUCE_BY_VAL);
  // 1 階魔法於低智通常無減免，較高階受該智力階段減免上限限制
  const circleCap = Math.max(0, Math.min(9, Number(circle || 1) - (effInt < 14 ? 1 : 0)));
  return Math.min(cap, circleCap) + Math.max(0, birthMpReduce);
}

export function getIntBaseBonuses(effInt) {
  const extraSp = lookupRange(effInt, INT_EXTRA_SP_TABLE);
  const magicCritPct = effInt >= 25 ? Math.min(12, 2 + Math.floor((effInt - 25) / 3)) : 0;
  return {
    extraSp,
    magicHit: Math.max(0, Math.floor((effInt - 10) / 2)),
    magicDmg: Math.max(0, extraSp),
    magicCritPct,
    mpDiscountCap: lookupRange(effInt, INT_MP_REDUCE_BY_VAL),
  };
}

// ── CHA 魅力表 ──
export function getChaBonuses(classId, level, effCha) {
  const cid = normalizeAbilityClassId(classId);
  const cha = Math.max(0, Number(effCha || 0));
  const lv = Math.max(1, Number(level || 1));
  const extraCtrl = cid === 'elf' ? 12 : (cid === 'knight' || cid === 'warrior') ? 0 : 6;
  return {
    clanCap: cid === 'royal' ? cha * (lv >= 50 ? 3 : 2) : null,
    npcControlCap: Math.max(1, Math.floor((cha + extraCtrl) / 6)),
  };
}

/**
 * 創角初始配點（Birth Stats）額外出生加成表
 * 完全對照 lineagereal.com/ability/ 職業出生加成欄位。
 */
export function computeBirthBonuses(classId, birthStats) {
  const cid = normalizeAbilityClassId(classId);
  const def = LINEAGE_REAL_BASE_STATS[cid] || LINEAGE_REAL_BASE_STATS.royal;
  const s = Math.max(def.base.str, Number(birthStats?.str ?? def.base.str));
  const d = Math.max(def.base.dex, Number(birthStats?.dex ?? def.base.dex));
  const c = Math.max(def.base.con, Number(birthStats?.con ?? def.base.con));
  const w = Math.max(def.base.wis, Number(birthStats?.wis ?? def.base.wis));
  const i = Math.max(def.base.int, Number(birthStats?.int ?? def.base.int));

  const out = {
    meleeDmg: 0,
    meleeHit: 0,
    bowDmg: 0,
    bowHit: 0,
    acBonus: 0,
    er: 0,
    hpRegen: 0,
    hpGrowth: 0,
    mpRegen: 0,
    mpGrowth: 0,
    mr: 0,
    magicDmg: 0,
    magicHit: 0,
    magicCritPct: 0,
    mpReduce: 0,
    weightSteps: 0,
  };

  if (cid === 'royal') {
    out.meleeDmg += s >= 18 ? 2 : s >= 15 ? 1 : 0;
    out.meleeHit += s >= 19 ? 2 : s >= 16 ? 1 : 0;
    out.weightSteps += s >= 20 ? 3 : s >= 17 ? 2 : s >= 14 ? 1 : 0;
    out.bowDmg += d >= 13 ? 1 : 0;
    out.acBonus += d >= 17 ? 3 : d >= 15 ? 2 : d >= 12 ? 1 : 0;
    out.er += d >= 18 ? 3 : d >= 16 ? 2 : d >= 14 ? 1 : 0;
    out.hpRegen += c >= 18 ? 4 : c >= 17 ? 3 : c >= 15 ? 2 : c >= 13 ? 1 : 0;
    out.hpGrowth += c >= 16 ? 3 : c >= 14 ? 2 : c >= 12 ? 1 : 0;
    out.weightSteps += c >= 11 ? 1 : 0;
    out.mpRegen += w >= 15 ? 2 : w >= 13 ? 1 : 0;
    out.mpGrowth += w >= 16 ? 1 : 0;
    out.mr += w >= 14 ? 2 : w >= 12 ? 1 : 0;
    out.magicDmg += i >= 14 ? 2 : i >= 12 ? 1 : 0;
    out.magicHit += i >= 15 ? 2 : i >= 13 ? 1 : 0;
    out.magicCritPct += i >= 17 ? 2 : i >= 16 ? 1 : 0;
    out.mpReduce += i >= 18 ? 2 : i >= 11 ? 1 : 0;
  } else if (cid === 'knight' || cid === 'warrior') {
    out.meleeDmg += s >= 20 ? 4 : s >= 18 ? 2 : 0;
    out.meleeHit += s >= 19 ? 4 : s >= 17 ? 2 : 0;
    out.acBonus += d >= 15 ? 3 : d >= 13 ? 1 : 0;
    out.er += d >= 16 ? 3 : d >= 14 ? 1 : 0;
    out.hpRegen += c >= 18 ? 4 : c >= 16 ? 2 : 0;
    out.hpGrowth += c >= 17 ? 3 : c >= 15 ? 1 : 0;
    out.weightSteps += c >= 15 ? 1 : 0;
    out.mpRegen += w >= 13 ? 2 : w >= 11 ? 1 : 0;
    out.mr += w >= 12 ? 3 : w >= 10 ? 1 : 0;
    out.magicHit += i >= 11 ? 2 : i >= 9 ? 1 : 0;
    out.mpReduce += i >= 12 ? 2 : i >= 10 ? 1 : 0;
  } else if (cid === 'elf') {
    out.meleeDmg += s >= 14 ? 2 : s >= 12 ? 1 : 0;
    out.meleeHit += s >= 15 ? 2 : s >= 13 ? 1 : 0;
    out.weightSteps += s >= 16 ? 2 : 0;
    out.bowDmg += d >= 17 ? 3 : d >= 14 ? 2 : 0;
    out.bowHit += d >= 16 ? 3 : d >= 13 ? 2 : 0;
    out.acBonus += d >= 18 ? 2 : d >= 15 ? 1 : 0;
    out.hpRegen += c >= 17 ? 3 : c >= 16 ? 2 : c >= 14 ? 1 : 0;
    out.hpGrowth += c >= 18 ? 2 : c >= 13 ? 1 : 0;
    out.weightSteps += c >= 15 ? 2 : 0;
    out.mpRegen += w >= 18 ? 2 : w >= 15 ? 1 : 0;
    out.mpGrowth += w >= 17 ? 2 : w >= 14 ? 1 : 0;
    out.mr += w >= 16 ? 2 : w >= 13 ? 1 : 0;
    out.magicHit += i >= 14 ? 2 : i >= 13 ? 1 : 0;
    out.magicCritPct += i >= 17 ? 2 : 0;
    out.mpReduce += i >= 18 ? 2 : i >= 16 ? 1 : 0;
  } else if (cid === 'mage' || cid === 'illusion') {
    out.meleeDmg += s >= 12 ? 2 : s >= 10 ? 1 : 0;
    out.meleeHit += s >= 13 ? 2 : s >= 11 ? 1 : 0;
    out.weightSteps += s >= 9 ? 1 : 0;
    out.acBonus += d >= 10 ? 2 : d >= 8 ? 1 : 0;
    out.er += d >= 11 ? 2 : d >= 9 ? 1 : 0;
    out.hpRegen += c >= 18 ? 2 : c >= 17 ? 1 : 0;
    out.hpGrowth += c >= 16 ? 2 : c >= 14 ? 1 : 0;
    out.weightSteps += c >= 15 ? 2 : c >= 13 ? 1 : 0;
    out.mpRegen += w >= 18 ? 3 : w >= 16 ? 2 : w >= 14 ? 1 : 0;
    out.mpGrowth += w >= 17 ? 2 : w >= 13 ? 1 : 0;
    out.mr += w >= 15 ? 1 : 0;
    out.magicDmg += i >= 14 ? 1 : 0;
    out.magicHit += i >= 15 ? 1 : 0;
    out.magicCritPct += i >= 16 ? 2 : 0;
    out.mpReduce += i >= 18 ? 2 : i >= 17 ? 1 : 0;
  } else if (cid === 'dark' || cid === 'dragon') {
    out.meleeDmg += s >= 18 ? 2 : s >= 15 ? 1 : 0;
    out.meleeHit += s >= 17 ? 2 : s >= 15 ? 1 : 0;
    out.weightSteps += s >= 16 ? 3 : s >= 13 ? 2 : 0;
    out.bowDmg += d >= 18 ? 2 : 0;
    out.bowHit += d >= 18 ? 2 : d >= 17 ? 1 : 0;
    out.acBonus += d >= 17 ? 1 : 0;
    out.er += d >= 16 ? 2 : 0;
    out.hpRegen += c >= 13 ? 2 : c >= 11 ? 1 : 0;
    out.hpGrowth += c >= 12 ? 2 : c >= 10 ? 1 : 0;
    out.weightSteps += c >= 9 ? 1 : 0;
    out.mpRegen += w >= 13 ? 1 : 0;
    out.mpGrowth += w >= 12 ? 1 : 0;
    out.mr += w >= 16 ? 4 : w >= 15 ? 3 : w >= 14 ? 2 : w >= 11 ? 1 : 0;
    out.magicHit += i >= 15 ? 2 : i >= 13 ? 1 : 0;
    out.mpReduce += i >= 16 ? 2 : i >= 14 ? 1 : 0;
  }

  return out;
}

/**
 * 彙整角色完整衍生能力（供 world-state 戰鬥／回血回魔與狀態視窗顯示）
 */
export function computeDerivedAbilities({ classId, level, stats, effStats, birthStats }) {
  const effStr = Number(effStats?.str ?? stats?.str ?? 12);
  const effDex = Number(effStats?.dex ?? stats?.dex ?? 12);
  const effCon = Number(effStats?.con ?? stats?.con ?? 12);
  const effWis = Number(effStats?.wis ?? stats?.wis ?? 10);
  const effInt = Number(effStats?.int ?? stats?.int ?? 10);
  const effCha = Number(effStats?.cha ?? stats?.cha ?? 10);

  const strT = getStrBaseBonuses(effStr);
  const dexT = getDexBaseBonuses(effDex);
  const conT = getConBaseBonuses(effCon);
  const wisT = getWisBaseBonuses(effWis);
  const intT = getIntBaseBonuses(effInt);
  const chaT = getChaBonuses(classId, level, effCha);
  const birth = computeBirthBonuses(classId, birthStats || stats);
  const magicLv = getClassMagicLevel(classId, level);

  const levelAcRed = Math.floor(Math.max(1, Number(level || 1)) / dexT.acDivisor);
  const weightSum = effStr + effCon;
  const maxWeightBase = Math.min(
    5400,
    1500 + 150 * Math.floor(Math.max(0, weightSum - 18) / 2) + birth.weightSteps * 150,
  );

  return {
    meleeDmg: strT.meleeDmg + birth.meleeDmg,
    meleeHit: strT.meleeHit + birth.meleeHit,
    meleeCritPct: strT.meleeCritPct,
    bowDmg: dexT.bowDmg + birth.bowDmg,
    bowHit: dexT.bowHit + birth.bowHit,
    er: dexT.er + birth.er,
    acDivisor: dexT.acDivisor,
    levelAcRed,
    birthAcBonus: birth.acBonus,
    hpGrowth: conT.hpGrowth + birth.hpGrowth,
    hpRegen: conT.hpRegen + birth.hpRegen,
    potionBonusPct: conT.potionBonusPct,
    maxWeightBase,
    mpRegen: wisT.mpRegen + birth.mpRegen,
    bluePotBonus: wisT.bluePotBonus,
    mpGrowth: wisT.mpGrowth + birth.mpGrowth,
    wisMr: wisT.mrPct + birth.mr,
    magicLv,
    extraSp: intT.extraSp,
    magicDmg: intT.magicDmg + birth.magicDmg,
    magicHit: intT.magicHit + birth.magicHit,
    magicCritPct: intT.magicCritPct + birth.magicCritPct,
    mpReduce: birth.mpReduce,
    mpDiscountCap: intT.mpDiscountCap,
    clanCap: chaT.clanCap,
    npcControlCap: chaT.npcControlCap,
    birth,
  };
}
