// 六器鏢行 — 核心屬性、五行相剋、罡氣／破罡三態結算與鍛器爐溫引擎
// 完全無 DOM / Three.js 依賴，可直接由 node --test 驗證數值

import { ELEMENTS, WEAPON_TYPES, LOADOUT_PRESETS, REBIRTH_STAGES, SKILLS, TEMPER_STONES, MECH_TIERS } from './data.js';

export function getElementalMultiplier(atkElem, defElem) {
  if (!atkElem || !defElem || atkElem === 0 || defElem === 0) return 1.0;
  const atkInfo = ELEMENTS[atkElem];
  const defInfo = ELEMENTS[defElem];
  if (!atkInfo || !defInfo) return 1.0;
  if (atkInfo.overcomes === defElem) return 1.25; // 相剋 1.25x
  if (defInfo.overcomes === atkElem) return 0.80; // 被反剋 0.80x
  return 1.0;
}

export function getWeaponAtk(weapon) {
  if (!weapon) return 40;
  const lv = weapon.upgrade || 0;
  // +1~+6 穩定成長，+7/+9/+12 視覺與數值高光躍升
  const upgMult = 1 + lv * 0.09 + (lv >= 7 ? 0.14 : 0) + (lv >= 9 ? 0.20 : 0) + (lv >= 12 ? 0.35 : 0);
  return Math.round(weapon.baseAtk * upgMult);
}

export function getWeaponAuraTier(upgradeLevel) {
  if (upgradeLevel >= 12) return 3; // +12 赤霞淬紋
  if (upgradeLevel >= 9) return 2;  // +9 鎏金流光
  if (upgradeLevel >= 7) return 1;  // +7 寒芒
  return 0;
}

// 鍛器光效名（驛報、鍛爐、在手標示共用這一張表）
export const AURA_NAMES = ['素紋', '寒芒', '鎏金流光', '赤霞淬紋'];
export function getWeaponAuraName(upgradeLevel) {
  return AURA_NAMES[getWeaponAuraTier(upgradeLevel)];
}

export function getIronShirtAlpha(layer = 1, isTrueSkill = false, extraAlpha = 0) {
  // 基礎 0.70，《鐵衣訣》1~12 重最高提升至 0.85，通玄再 +0.02
  const clamped = Math.max(1, Math.min(12, layer));
  const base = 0.70 + ((clamped - 1) / 11) * 0.15;
  const trueBonus = isTrueSkill ? 0.02 : 0;
  return Math.min(0.88, Number((base + trueBonus + extraAlpha).toFixed(4)));
}

export function getSkillScaling(skillId, layer = 1, isTrueSkill = false) {
  const sk = SKILLS[skillId];
  if (!sk) return { mult: 1.0, breakBeta: 1.0, name: '普攻' };
  const effLayer = Math.max(1, Math.min(12, layer));
  let mult = sk.mult * (1 + (effLayer - 1) * 0.045);
  let breakBeta = sk.breakBeta || 1.0;
  // 12 重之後突破第十三重「通玄」：傷害倍率提升 35%、破罡係數額外 +20%
  if (isTrueSkill || layer >= 13) {
    mult *= 1.35;
    breakBeta *= 1.20;
  }
  return {
    mult: Number(mult.toFixed(4)),
    breakBeta: Number(breakBeta.toFixed(4)),
    name: isTrueSkill || layer >= 13 ? sk.trueName : sk.name,
  };
}

export function computeDerivedStats(char, activeWeapon, martials = {}, equippedTemperStones = [], jadeCharms = []) {
  const str = char.statStr ?? 10;
  const agi = char.statAgi ?? 10;
  const con = char.statCon ?? 10;
  const int = char.statInt ?? 10;
  const level = char.level ?? 1;

  const rebirth = REBIRTH_STAGES[char.rebirthStage || 0] || REBIRTH_STAGES[0];
  const preset = LOADOUT_PRESETS.find((p) => p.id === (char.loadoutId || 1)) || LOADOUT_PRESETS[0];
  const wType = WEAPON_TYPES[activeWeapon?.type || 'BLADE'] || WEAPON_TYPES.BLADE;

  // 淬紋石加成匯總
  let gemAtkPct = 0, gemBreakPct = 0, gemCritRate = 0, gemCritDmg = 0;
  let gemMaxShield = 0, gemMaxHp = 0, gemDefFlat = 0;
  const allGems = [...(activeWeapon?.gems || []), ...equippedTemperStones];
  for (const gid of allGems) {
    const g = TEMPER_STONES[gid];
    if (!g) continue;
    gemAtkPct += g.atkPct || 0;
    gemBreakPct += g.breakPct || 0;
    gemCritRate += g.critRate || 0;
    gemCritDmg += g.critDmg || 0;
    gemMaxShield += g.maxShield || 0;
    gemMaxHp += g.maxHp || 0;
    gemDefFlat += g.defFlat || 0;
  }

  // 四季玉珮加成（開脈後開啟）
  let charmAtk = 0, charmDef = 0, charmShield = 0, charmSpeedPct = 0, charmCritDmg = 0;
  if (rebirth.charmUnlocked) {
    for (const charm of jadeCharms) {
      const t = charm.tier || 1;
      if (charm.id === 'spring') charmSpeedPct += 0.04 * t;
      if (charm.id === 'summer') { charmAtk += 18 * t; charmCritDmg += 0.05 * t; }
      if (charm.id === 'autumn') charmShield += 90 * t;
      if (charm.id === 'winter') charmDef += 14 * t;
    }
  }

  // 四維基礎屬性公式：
  // STR: 近戰外功 +2.2/pt, 負重 +15/pt
  // AGI: 遠程外功 +2.4/pt, 暴擊率 +0.08%/pt, 閃避率 +0.05%/pt
  // CON: 最大HP +18/pt, 物防 +1.5/pt, 抗暴率 +0.06%/pt
  // INT: 最大MP +12/pt, 最大罡氣 +16/pt, 五行內功 +2.5/pt, 五行抗性 +0.1%/pt
  const meleeStatAtk = str * 2.2;
  const rangedStatAtk = agi * 2.4;
  const innerStatAtk = int * 2.5;
  const maxWeight = 300 + str * 15;

  const baseHp = 320 + level * 22 + con * 18 + gemMaxHp;
  const maxHp = Math.round(baseHp);
  const maxMp = Math.round(180 + level * 10 + int * 12);
  const baseShield = 240 + level * 18 + int * 16 + gemMaxShield + charmShield;
  const maxShield = Math.round(baseShield * (preset.shieldMult || 1.0));

  const baseDef = 18 + level * 2.2 + con * 1.5 + gemDefFlat + charmDef;
  const physDef = Math.round(baseDef * (preset.defMult || 1.0));

  const wpnAtk = getWeaponAtk(activeWeapon);
  const attrAtk = wType.scaling === 'AGI' ? rangedStatAtk : meleeStatAtk;
  // 拳被動「沉勁」：每 10 點根骨屬性攻擊 +1%
  const fistConAmp = wType.id === 'FIST' ? Math.floor(con / 10) * 0.01 : 0;
  const mechBonus = char.mechPhase === 'ACTIVE_MERGED' ? (MECH_TIERS[char.mechTier || 1]?.atkBonus || 85) : 0;

  const totalWeaponAtk = Math.round(
    (wpnAtk + attrAtk + rebirth.atkFlat + charmAtk + mechBonus) *
    (1 + gemAtkPct + fistConAmp) *
    (preset.atkMult || 1.0)
  );
  const totalInnerAtk = Math.round(
    (wpnAtk * 0.85 + innerStatAtk + rebirth.atkFlat + charmAtk + mechBonus) *
    (1 + gemAtkPct + rebirth.elemAmp * 0.35) *
    (preset.atkMult || 1.0)
  );

  const critRate = Math.min(0.75, Number((0.08 + agi * 0.0008 + rebirth.critRate + (preset.critBonus || 0) + gemCritRate).toFixed(4)));
  const critDmg = Number((1.50 + (wType.critDmgBonus || 0) + rebirth.critDmg + gemCritDmg + charmCritDmg).toFixed(4));
  const dodgeRate = Math.min(0.55, Number((0.03 + agi * 0.0005 + (wType.dodgeBonus || 0) + (preset.dodgeBonus || 0)).toFixed(4)));
  const critResist = Math.min(0.50, Number((con * 0.0006).toFixed(4)));
  const elemResist = Math.min(0.50, Number((int * 0.001).toFixed(4)));

  const ironShirt = martials[801] || { layer: 1, isTrue: false };
  const shieldAlpha = getIronShirtAlpha(ironShirt.layer, ironShirt.isTrue, preset.alphaBonus || 0);

  const qinggong = martials[803] || { layer: 1, isTrue: false };
  const moveSpeed = Number(((5.8 + qinggong.layer * 0.14) * (preset.speedMult || 1.0) * (1 + charmSpeedPct)).toFixed(2));

  return {
    maxHp,
    maxMp,
    maxShield,
    maxWeight,
    physDef,
    weaponAtk: totalWeaponAtk,
    innerAtk: totalInnerAtk,
    critRate,
    critDmg,
    dodgeRate,
    critResist,
    elemResist,
    shieldAlpha,
    moveSpeed,
    armorPen: wType.armorPen || 0,
    weaponBreakBonus: (wType.breakBonus || 0) + gemBreakPct,
    lifesteal: wType.lifesteal || 0,
  };
}

/**
 * 伺服器權威傷害與「罡氣分攤／破罡懲罰」結算（情況 A 罡氣充足 / B 破罡 / C 無罡氣）
 */
export function resolveCombatHit({
  atkValue,
  skillMult = 1.0,
  breakBeta = 1.0,
  targetDef = 0,
  armorPen = 0,
  atkElement = 0,
  defElement = 0,
  isCrit = false,
  critMult = 1.5,
  pkMode = false,
  targetCurShield = 0,
  targetCurHp = 100,
  targetAlpha = 0.70,
  targetMechMerged = false,
  targetMechTier = 1,
}) {
  const effDef = Math.max(0, targetDef * (1 - armorPen));
  const mElem = getElementalMultiplier(atkElement, defElement);
  const mCrit = isCrit ? critMult : 1.0;
  const mPk = pkMode ? 1.05 : 1.0;

  // 原始傷害 D_raw
  let dRaw = (atkValue * skillMult - effDef) * mElem * mCrit * mPk;
  dRaw = Math.max(1, dRaw);

  // 目標若在偃甲中，偃甲自動分攤 80%（金樞偃甲 84%）承受傷害並獲得霸體
  let mechMitigated = 0;
  if (targetMechMerged) {
    const absorb = MECH_TIERS[targetMechTier]?.absorb ?? 0.80;
    mechMitigated = Math.round(dRaw * absorb);
    dRaw = Math.max(1, dRaw * (1 - absorb));
  }

  const alpha = Math.max(0, Math.min(0.90, targetAlpha));
  const beta = Math.max(0.1, breakBeta);
  const sCur = Math.max(0, targetCurShield);
  const shieldDemand = dRaw * alpha * beta;

  let deltaShield = 0;
  let deltaHp = 0;
  let isShieldBroken = false;
  let staggerSec = 0;
  let caseType = 'C';

  if (sCur <= 0) {
    // 情況 C：無罡氣（S_cur = 0），目標承受 100% 全額傷害
    caseType = 'C';
    deltaShield = 0;
    deltaHp = Math.max(1, Math.round(dRaw));
  } else if (sCur >= shieldDemand) {
    // 情況 A：罡氣充足（S_cur >= D_raw * alpha * beta_break）
    caseType = 'A';
    deltaShield = Math.round(shieldDemand);
    deltaHp = Math.max(1, Math.round(dRaw * (1 - alpha)));
  } else {
    // 情況 B：破罡（0 < S_cur < D_raw * alpha * beta_break）
    // 罡氣瞬間歸零，溢出未吸收傷害乘上 1.15x 易傷懲罰灌入 HP，並觸發 0.5 秒硬直
    caseType = 'B';
    deltaShield = sCur;
    const unabsorbedRaw = dRaw * alpha - (sCur / beta);
    deltaHp = Math.max(1, Math.round(dRaw * (1 - alpha) + unabsorbedRaw * 1.15));
    isShieldBroken = true;
    staggerSec = targetMechMerged ? 0 : 0.5;
  }

  const remShield = Math.max(0, sCur - deltaShield);
  const remHp = Math.max(0, targetCurHp - deltaHp);

  return {
    rawDamage: Math.round(dRaw),
    hpDamage: deltaHp,
    shieldAbsorbed: deltaShield,
    mechMitigated,
    remHp,
    remShield,
    isCrit: !!isCrit,
    isShieldBroken,
    staggerSec,
    elementalMultiplier: mElem,
    caseType,
  };
}

/**
 * 鍛器（+1 ~ +12）與爐溫（失敗累積，滿 100% 下一次必成）
 */
export const UPGRADE_RATES = {
  1: 1.00, 2: 1.00, 3: 1.00, 4: 1.00, 5: 1.00, 6: 1.00, // +1~+6 必成區間
  7: 0.65, 8: 0.50, 9: 0.38, 10: 0.28, 11: 0.18, 12: 0.12,
};

export function attemptWeaponUpgrade(weapon, { useProtectScroll = true, rng = Math.random } = {}) {
  const cur = weapon.upgrade || 0;
  if (cur >= 12) {
    return { ok: false, reason: 'MAX_LEVEL', level: 12, pity: weapon.pity || 0 };
  }
  const nextLv = cur + 1;
  const curPity = weapon.pity || 0;
  const baseRate = UPGRADE_RATES[nextLv] ?? 0.12;
  const guaranteedByPity = curPity >= 100;
  const roll = rng();
  const success = guaranteedByPity || roll < baseRate;

  if (success) {
    weapon.upgrade = nextLv;
    weapon.pity = 0;
    return {
      ok: true,
      success: true,
      guaranteedByPity,
      level: weapon.upgrade,
      pity: 0,
      auraTier: getWeaponAuraTier(weapon.upgrade),
    };
  }

  // 鍛器失敗：爐溫每次 +30% ~ +35%，3~4 次必滿 100%
  const pityGain = nextLv >= 10 ? 35 : 30;
  weapon.pity = Math.min(100, curPity + pityGain);
  let dropped = false;
  if (!useProtectScroll && cur >= 10 && rng() < 0.5) {
    weapon.upgrade = Math.max(0, cur - 1);
    dropped = true;
  }
  return {
    ok: true,
    success: false,
    guaranteedByPity: false,
    dropped,
    level: weapon.upgrade,
    pity: weapon.pity,
    auraTier: getWeaponAuraTier(weapon.upgrade),
  };
}
