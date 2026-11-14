// 286 天堂實境客戶端：全 64 張地圖世界模擬、角色屬性、戰鬥掉落、法術、商店與倉庫存檔
import { tileToWorld, tileDistance, headingBetween, HEADING_DELTAS } from './map-iso.js';
import {
  computeDerivedAbilities,
  computeInitialHp,
  computeInitialMp,
  getSpellMpDiscount,
  LINEAGE_REAL_BASE_STATS,
  normalizeAbilityClassId,
} from './ability-tables.js';
import {
  MAP_NAMES,
  getMapMeta,
  isSafetyZone,
  resolveHomeTown,
} from './world-maps.js';

export { MAP_NAMES };

export const DEFAULT_AUTO_CONFIG = {
  enabled: false,
  preset: 'custom',
  // 補給與緊急保命
  potEnabled: true,
  preferredPot: 'auto',
  potThreshold: 55,
  emergencyPotThreshold: 28,
  emergencyPot: '白色藥水',
  autoHealSpell: true,
  healSpellThreshold: 62,
  healSpellMode: 'auto',
  escapeEnabled: false,
  escapeHpPercent: 18,
  escapeAction: 'home',
  noPotAction: 'keep',
  autoCurePoison: true,
  autoEatFood: true,
  autoEatThreshold: 25,
  // 尋路與靜態障礙閃避（不含怪物）
  huntMode: 'anchor',
  radius: 14,
  tickMs: 280,
  obstacleAvoidance: true,
  obstacleLookahead: 4,
  avoidWallHug: true,
  avoidPortals: true,
  avoidSafetyBorder: true,
  stuckTimeoutSec: 3,
  stuckRecovery: 'replan',
  showNavDebug: false,
  // 目標篩選與戰術站位
  targetPriority: 'nearest',
  retaliateAggro: true,
  switchOnBlocked: true,
  skipCritters: true,
  avoidBoss: true,
  minMobLevel: 1,
  maxMobLevel: 45,
  safeLevelCap: false,
  mobFilterMode: 'all',
  mobFilterNames: '',
  kiteRanged: false,
  kiteDistance: 2,
  switchMeleeNoArrows: true,
  // 輔助狀態與攻擊法術
  autoHaste: false,
  autoBrave: false,
  autoBlue: false,
  autoWisdom: false,
  autoDefBuffs: true,
  autoCombatBuffs: false,
  autoMeditate: false,
  autoAttackSpell: false,
  attackSpellId: 'auto',
  minMpReservePct: 25,
  aoeMinCount: 2,
  autoTurnUndead: false,
  autoVampireTouch: true,
  // 戰利品與負重管理
  pickupDrops: true,
  lootFilter: 'all',
  pickupPriority: 'afterKill',
  pickupRadius: 12,
  maxWeightPct: 85,
  // 裝備耐久自動修復
  autoRepairGear: true,
  autoRepairMode: 'auto',
  autoRepairThreshold: 1,
  anchor: null,
};

const QUICKBAR_DEFAULT_BY_CLASS = {
  royal: [
    { kind: 'item', name: '紅色藥水' },
    { kind: 'item', name: '綠色藥水' },
    { kind: 'item', name: '瞬間移動的卷軸' },
    { kind: 'item', name: '傳送回家的卷軸' },
    { kind: 'spell', id: 1 },
    { kind: 'spell', id: 3 },
    { kind: 'item', name: '內掛符石' },
    { kind: 'item', name: '喝水符石' },
  ],
  knight: [
    { kind: 'item', name: '紅色藥水' },
    { kind: 'item', name: '橙色藥水' },
    { kind: 'item', name: '勇敢藥水' },
    { kind: 'item', name: '綠色藥水' },
    { kind: 'item', name: '瞬間移動的卷軸' },
    { kind: 'item', name: '傳送回家的卷軸' },
    { kind: 'item', name: '內掛符石' },
    { kind: 'item', name: '喝水符石' },
  ],
  elf: [
    { kind: 'item', name: '紅色藥水' },
    { kind: 'item', name: '綠色藥水' },
    { kind: 'spell', id: 1 },
    { kind: 'spell', id: 3 },
    { kind: 'spell', id: 4 },
    { kind: 'item', name: '瞬間移動的卷軸' },
    { kind: 'item', name: '傳送回家的卷軸' },
    { kind: 'item', name: '內掛符石' },
  ],
  mage: [
    { kind: 'item', name: '紅色藥水' },
    { kind: 'spell', id: 4 },
    { kind: 'spell', id: 1 },
    { kind: 'spell', id: 15 },
    { kind: 'spell', id: 17 },
    { kind: 'spell', id: 3 },
    { kind: 'spell', id: 5 },
    { kind: 'item', name: '藍色藥水' },
  ],
};

const STARTER_SPELLS_BY_CLASS = {
  royal: [1, 3],
  knight: [],
  elf: [1, 3, 4, 5],
  mage: [1, 2, 3, 4, 5, 6, 15, 17, 19, 21],
};

const EQUIP_SLOTS = ['weapon', 't', 'armor', 'helm', 'shield', 'cloak', 'boot', 'glove'];

export const RANGED_OR_CASTER_MOBS = {
  獸人弓箭手: { range: 6, mode: 'arrow' },
  骷骨弓箭手: { range: 6, mode: 'arrow' },
  漂浮魔眼: { range: 5, mode: 'spell', effectId: 252 },
  妖魔法師: { range: 5, mode: 'spell', effectId: 167 },
  白袍術士: { range: 6, mode: 'spell', effectId: 170 },
  巴風特: { range: 5, mode: 'spell', effectId: 171 },
};

export const MOB_SPELL_ELEMENT = {
  火咒師: 'fire',
  水咒師: 'water',
  風咒師: 'wind',
  土咒師: 'earth',
  妖魔法師: 'wind',
  白袍術士: 'wind',
  巴風特: 'fire',
  巴列斯: 'fire',
};

export const POISON_MOBS = {
  活死屍: 0.28,
  夏爾戈: 0.35,
};

export const CRAFT_RECIPES = [
  // 拉達（皮革工匠）
  { npc: '拉達', output: '高級皮革', count: 1, adena: 50, mats: [['皮革', 10]] },
  { npc: '拉達', output: '皮手套', count: 1, adena: 120, mats: [['皮革', 6], ['金屬塊', 1]] },
  { npc: '拉達', output: '皮甲', count: 1, adena: 200, mats: [['皮革', 12]] },
  { npc: '拉達', output: '銀釘皮甲', count: 1, adena: 600, mats: [['高級皮革', 3], ['金屬塊', 4]] },
  { npc: '拉達', output: '鋼鐵長靴', count: 1, adena: 800, mats: [['高級皮革', 2], ['金屬塊', 6]] },
  // 丁（武器與重裝鍛造師）
  { npc: '丁', output: '闊劍', count: 1, adena: 450, mats: [['金屬塊', 8], ['皮革', 2]] },
  { npc: '丁', output: '大盾牌', count: 1, adena: 650, mats: [['金屬塊', 10], ['皮革', 4]] },
  { npc: '丁', output: '環甲', count: 1, adena: 700, mats: [['金屬塊', 12]] },
  { npc: '丁', output: '青銅盔甲', count: 1, adena: 1200, mats: [['金屬塊', 18], ['粗糙的米索莉塊', 4]] },
  { npc: '丁', output: '鋼盔', count: 1, adena: 900, mats: [['金屬塊', 10], ['骨頭碎片', 6]] },
  { npc: '丁', output: '騎士面甲', count: 1, adena: 1800, mats: [['金屬塊', 16], ['紅寶石', 1]] },
  { npc: '丁', output: '鋼鐵金屬盔甲', count: 1, adena: 3200, mats: [['金屬塊', 30], ['粗糙的米索莉塊', 10], ['鑽石', 1]] },
  // 莫麗雅（精靈與魔法工藝師）
  { npc: '莫麗雅', output: '抗魔法斗篷', count: 1, adena: 1500, mats: [['高級皮革', 4], ['魔法寶石', 5]] },
  { npc: '莫麗雅', output: '精靈弓', count: 1, adena: 1800, mats: [['粗糙的米索莉塊', 15], ['高級皮革', 4], ['精靈玉', 5]] },
  { npc: '莫麗雅', output: '精靈鏈甲', count: 1, adena: 2400, mats: [['粗糙的米索莉塊', 20], ['綠寶石', 1]] },
];

export const TEACHER_SPELLS = [
  { id: 1, npcs: ['吉倫', '甘特'], minLv: 1, price: 80, classes: ['royal', 'knight', 'elf', 'mage'] },
  { id: 2, npcs: ['吉倫'], minLv: 1, price: 60, classes: ['royal', 'elf', 'mage'] },
  { id: 3, npcs: ['吉倫', '甘特'], minLv: 1, price: 100, classes: ['royal', 'knight', 'elf', 'mage'] },
  { id: 4, npcs: ['吉倫'], minLv: 1, price: 100, classes: ['royal', 'elf', 'mage'] },
  { id: 5, npcs: ['吉倫'], minLv: 2, price: 180, classes: ['royal', 'elf', 'mage'] },
  { id: 6, npcs: ['吉倫'], minLv: 2, price: 180, classes: ['elf', 'mage'] },
  { id: 7, npcs: ['吉倫'], minLv: 2, price: 200, classes: ['elf', 'mage'] },
  { id: 8, npcs: ['吉倫', '甘特'], minLv: 3, price: 320, classes: ['royal', 'elf', 'mage'] },
  { id: 9, npcs: ['吉倫', '甘特'], minLv: 4, price: 420, classes: ['royal', 'knight', 'elf', 'mage'] },
  { id: 15, npcs: ['吉倫'], minLv: 5, price: 520, classes: ['elf', 'mage'] },
  { id: 17, npcs: ['吉倫'], minLv: 8, price: 950, classes: ['mage'] },
  { id: 19, npcs: ['吉倫'], minLv: 8, price: 1050, classes: ['elf', 'mage'] },
  { id: 21, npcs: ['吉倫', '甘特'], minLv: 8, price: 1100, classes: ['royal', 'elf', 'mage'] },
];

export const UNDEAD_MOBS = new Set(['骷骨', '骷骨弓箭手', '活死屍', '噬屍鬼']);
export const ARMOR_BREAK_MOBS = new Set(['岩石魔怪', '克德', '夏爾戈']);
export const ARMOR_CORRODE_MOBS = new Set(['史萊姆', '岩石魔怪', '克德', '夏爾戈', '巨大兵蟻', '巨工蟻', '巨蟻女皇']);
export const AOE_SPELLS = new Set([22, 25, 34, 37, 45]);

export const STAT_BUFF_SPELLS = {
  14: { key: 'heavy', sec: 900, fx: 167, msg: '施放負重強化，負重上限大幅提高。' },
  26: { key: 'dexUp', sec: 600, fx: 750, msg: '施放通暢氣脈術（DEX +5，弓箭／閃避提升）！' },
  31: { key: 'mrUp', sec: 600, fx: 167, msg: '施放魔法屏障（抗魔 MR +20%）！' },
  32: { key: 'meditation', sec: 600, fx: 167, msg: '施放冥想術（自然魔力回復大幅提升）！' },
  42: { key: 'strUp', sec: 600, fx: 751, msg: '施放體魄強健術（STR +5，近戰傷害與負重提升）！' },
  43: { key: 'haste', sec: 300, fx: 755, msg: '施放加速術（移動與攻擊速度提升）！' },
  48: { key: 'holyWeapon', sec: 900, fx: 167, msg: '施放祝福魔法武器（物理命中與攻擊力提升）！' },
};

export const MORPH_FORMS = [
  { id: 'orc_war', label: '獸人戰士', gfx: 94, minLv: 1, atkMult: 1.15, dmg: 2, ac: 1, sp: 0, desc: '攻速 +15% · 近戰傷害 +2 · AC -1' },
  { id: 'werewolf', label: '冰原狼人', gfx: 1477, minLv: 5, atkMult: 1.2, dmg: 2, ac: 1, sp: 0, desc: '攻速 +20% · 傷害 +2 · AC -1' },
  { id: 'sorcerer', label: '白袍術士', gfx: 32, minLv: 8, atkMult: 1.1, dmg: 1, ac: 0, sp: 2, desc: '魔攻 SP +2 · 傷害 +1 · 攻速 +10%' },
  { id: 'skeleton', label: '骷髏戰士', gfx: 30, minLv: 10, atkMult: 1.24, dmg: 3, ac: 1, sp: 0, desc: '攻速 +24% · 傷害 +3 · AC -1' },
  { id: 'dk', label: '闇騎士', gfx: 110, minLv: 12, atkMult: 1.32, dmg: 4, ac: 2, sp: 0, desc: '攻速 +32% · 傷害 +4 · AC -2' },
  { id: 'revert', label: '解除變身', gfx: null, minLv: 1, atkMult: 1, dmg: 0, ac: 0, sp: 0, desc: '恢復角色原本職業造型。' },
];

export const PET_CATALOG = [
  { id: 'doberman', name: '杜賓犬', gfx: 931, price: 1200, baseHp: 75, dmg: [5, 11], desc: '敏捷獵犬，反應迅速、命中率佳。' },
  { id: 'wolf', name: '小狼', gfx: 96, price: 1600, baseHp: 95, dmg: [7, 14], desc: '野性狼種，咬擊爆發傷害突出。' },
  { id: 'shepherd', name: '牧羊犬', gfx: 936, price: 1500, baseHp: 110, dmg: [6, 12], desc: '忠誠耐久，體力上限高適合前排助戰。' },
];

export const STATUE_BLESSINGS = {
  潘妮雅的雕像: { key: 'dexUp', sec: 900, fx: 750, title: '潘妮雅女神庇佑', msg: '獲得潘妮雅雕像祝福：DEX +5 與體力回升！' },
  巴打的雕像: { key: 'strUp', sec: 900, fx: 751, title: '巴打戰神庇佑', msg: '獲得巴打雕像祝福：STR +5 與近戰威力提升！' },
  吉魔的雕像: { key: 'wisdom', sec: 900, fx: 190, title: '大法師智識庇佑', msg: '獲得吉魔雕像祝福：SP +2 與魔力回復提升！' },
};

export const SKELETON_ENCHANT_MAP = {
  對骷骨之劍強化的卷軸: { kind: 'weapon', types: ['sword', 'dagger', 'tohandsword', 'axe', 'spear'], label: '近戰武器' },
  對骷骨之杖強化的卷軸: { kind: 'weapon', types: ['staff', 'wand'], label: '魔杖' },
  對骷骨之弓強化的卷軸: { kind: 'weapon', types: ['bow'], label: '弓箭武器' },
  對骷骨頭盔強化的卷軸: { kind: 'armor', types: ['helm'], label: '頭盔' },
  對骷髏長靴強化的卷軸: { kind: 'armor', types: ['boot'], label: '長靴' },
  對骷骨盾牌強化的卷軸: { kind: 'armor', types: ['shield'], label: '盾牌' },
  對骷髏斗篷強化的卷軸: { kind: 'armor', types: ['cloak'], label: '斗篷' },
  對骷髏內衣強化的卷軸: { kind: 'armor', types: ['t'], label: '內衣' },
  對骷骨盔甲強化的卷軸: { kind: 'armor', types: ['armor'], label: '盔甲' },
};

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export class LineageWorld {
  constructor({ worldData, isoMap, sprites, audio, character, username, onLobbySync }) {
    this.worldData = worldData;
    this.isoMap = isoMap;
    this.sprites = sprites;
    this.assets = sprites?.assets || isoMap?.assets || null;
    this.audio = audio;
    this.lobbyChar = character;
    this.username = username || 'guest';
    this.onLobbySync = onLobbySync;

    this.saveKey = `ll286:${this.username}:world_slot_${character.slot ?? 0}`;
    this.storagePrefix = `ll286:${this.username}:warehouse`;
    this.displayPrefs = this.#loadDisplayPrefs();

    this.player = this.#initPlayer(character);
    this.warehouse = this.#loadWarehouse();

    this.npcs = [];
    this.mobs = [];
    this.drops = [];
    this.respawnQueue = [];
    this.projectiles = [];
    this.effects = [];
    this.floatingTexts = [];
    this.logs = [];
    this.remotePeers = [];
    this.onlineCount = 1;

    this.nextUid = 1;
    this.dirtySave = false;
    this.lastSaveAt = performance.now();
    this.lastBuffSaveAt = performance.now();
    this.lastRegenAt = performance.now();
    this.lastHungerAt = performance.now();
    this.onAutoToggled = null;
    this.portalSetByMap = new Map();

    this.loadMapEntities(this.player.map);
    this.saveWorld(true);
    this.addLog(`歡迎來到天堂 1.63《${MAP_NAMES[this.player.map] || '說話之島'}》。`, 'gold');
    this.addLog('點擊地面移動，點擊怪物自動鎖定攻擊，點擊 NPC 對話或交易。', 'info');
  }

  #initPlayer(char) {
    let saved = null;
    try {
      const raw = localStorage.getItem(this.saveKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const nameMismatch =
          parsed &&
          typeof parsed.charName === 'string' &&
          parsed.charName &&
          parsed.charName !== char.name;
        const createdAtMismatch =
          parsed &&
          parsed.createdAt &&
          char.createdAt &&
          parsed.createdAt !== char.createdAt;
        if (!nameMismatch && !createdAtMismatch) {
          saved = parsed;
        }
      }
    } catch {
      saved = null;
    }
    if (!saved && char.worldSave && typeof char.worldSave === 'object') {
      saved = char.worldSave;
    }

    const clsId = char.classId || 'royal';
    const clsCfg = this.worldData.classes[clsId] || this.worldData.classes.royal;
    const realCfg = LINEAGE_REAL_BASE_STATS[normalizeAbilityClassId(clsId)] || LINEAGE_REAL_BASE_STATS.royal;
    const gfx = Number(char.sex) === 1 ? clsCfg.femaleGfx : clsCfg.maleGfx;

    const baseStats = {
      str: Number(char.str ?? realCfg.base.str ?? clsCfg.stats.str),
      con: Number(char.con ?? realCfg.base.con ?? clsCfg.stats.con),
      dex: Number(char.dex ?? realCfg.base.dex ?? clsCfg.stats.dex),
      wis: Number(char.wis ?? realCfg.base.wis ?? clsCfg.stats.wis),
      cha: Number(char.cha ?? realCfg.base.cha ?? clsCfg.stats.cha),
      int: Number(char.int ?? realCfg.base.int ?? clsCfg.stats.int),
    };
    const birthStats = saved?.birthStats || char.birthStats || { ...baseStats };

    const initHp = computeInitialHp(clsId) + Math.max(0, baseStats.con - 15);
    const initMp = computeInitialMp(clsId, baseStats.wis);
    const startHp = Number(char.maxHp || char.hp || initHp);
    const startMp = Number(char.maxMp || char.mp || initMp);

    const player = {
      id: 'me',
      name: char.name || '無名勇者',
      classId: clsId,
      className: char.className || null,
      sex: Number(char.sex || 0),
      gfx,
      level: Number(saved?.level ?? char.level ?? 1),
      exp: Number(saved?.exp ?? char.exp ?? 0),
      gold: Number(saved?.gold ?? char.gold ?? char.adena ?? 1000),
      lawful: Number(saved?.lawful ?? char.alignment ?? 0),
      food: clamp(Number(saved?.food ?? 84), 0, 100),
      kills: Number(saved?.kills ?? 0),
      quests: saved?.quests || { hunterDone: false, slayerDone: false },
      stats: saved?.stats || baseStats,
      birthStats,
      hp: Number(saved?.hp ?? startHp),
      baseMaxHp: Number(saved?.baseMaxHp ?? saved?.maxHp ?? startHp),
      maxHp: Number(saved?.baseMaxHp ?? saved?.maxHp ?? startHp),
      _lastComputedMaxHp: Number(saved?.baseMaxHp ?? saved?.maxHp ?? startHp),
      mp: Number(saved?.mp ?? startMp),
      baseMaxMp: Number(saved?.baseMaxMp ?? saved?.maxMp ?? startMp),
      maxMp: Number(saved?.baseMaxMp ?? saved?.maxMp ?? startMp),
      _lastComputedMaxMp: Number(saved?.baseMaxMp ?? saved?.maxMp ?? startMp),
      sp: 1,
      map: Number(saved?.map ?? clsCfg.spawn.map ?? 0),
      tx: Number(saved?.tx ?? (clsCfg.spawn.map === 0 && clsCfg.spawn.x === 32578 && clsCfg.spawn.y === 32943 ? 32579 : clsCfg.spawn.x) ?? 32579),
      ty: Number(saved?.ty ?? (clsCfg.spawn.map === 0 && clsCfg.spawn.x === 32578 && clsCfg.spawn.y === 32943 ? 32946 : clsCfg.spawn.y) ?? 32946),
      heading: 4,
      animState: 'idle',
      animStartedAt: 0,
      moveFrom: null,
      moveTo: null,
      moveProgress: 0,
      path: [],
      targetId: null,
      pendingInteractNpcId: null,
      pendingPickupId: null,
      lastAttackAt: 0,
      lastSpellAt: 0,
      lastPotionAt: 0,
      clanName:
        saved?.clanName ??
        (char.pledge && char.pledge !== '無血盟' ? char.pledge : ''),
      polyGfx: saved?.polyGfx || null,
      polyName: saved?.polyName || '',
      polyBonus: saved?.polyBonus || null,
      pet: saved?.pet
        ? {
            ...saved.pet,
            map: Number(saved?.map ?? clsCfg.spawn.map ?? 0),
            tx: Number(saved?.tx ?? 32579) - 1,
            ty: Number(saved?.ty ?? 32946),
            animState: 'idle',
            animStartedAt: 0,
            lastActAt: 0,
            worldX: tileToWorld(Number(saved?.tx ?? 32579) - 1, Number(saved?.ty ?? 32946)).x,
            worldY: tileToWorld(Number(saved?.tx ?? 32579) - 1, Number(saved?.ty ?? 32946)).y,
          }
        : null,
      buffs: this.#restoreSavedBuffs(saved),
      spells: saved?.spells || [...(STARTER_SPELLS_BY_CLASS[clsId] || [1])],
      inventory: saved?.inventory || this.#buildStarterInventory(clsCfg, clsId),
      quickbar: saved?.quickbar || JSON.parse(JSON.stringify(QUICKBAR_DEFAULT_BY_CLASS[clsId] || QUICKBAR_DEFAULT_BY_CLASS.royal)),
      autoConfig: {
        ...DEFAULT_AUTO_CONFIG,
        ...(saved?.autoConfig || {}),
      },
      lastMoveBlocked: null,
      worldX: 0,
      worldY: 0,
      ac: 10,
      weaponType: 'unarmed',
      weaponItem: null,
      attackRange: 1,
      weightPercent: 0,
      mr: 10,
    };

    const validMaps =
      Array.isArray(this.worldData.mapIds) && this.worldData.mapIds.length > 0
        ? this.worldData.mapIds
        : [0, 1, 2, 3, 4];
    if (!validMaps.includes(player.map) || !this.isoMap.isWalkableTile(player.tx, player.ty, player.map)) {
      player.map = clsCfg.spawn.map || 0;
      player.tx = clsCfg.spawn.x || 32578;
      player.ty = clsCfg.spawn.y || 32943;
    }

    const wp = tileToWorld(player.tx, player.ty);
    player.worldX = wp.x;
    player.worldY = wp.y;

    this.recomputePlayerStats(player);
    // 修正大廳 Lv.>1 初始或舊存檔 exp 低於該級門檻，避免經驗百分比長期顯示 0.00%
    if (player.level > 1 && player.exp < player.expPrev) {
      player.exp = player.expPrev;
      this.dirtySave = true;
    }
    player.hp = clamp(player.hp, 1, player.maxHp);
    player.mp = clamp(player.mp, 0, player.maxMp);
    this.sprites.preloadActor(player.gfx);
    return player;
  }

  #buildStarterInventory(clsCfg, clsId) {
    const list = [];
    let seq = 1;
    const pushItem = (name, count, plus = 0, equipped = false) => {
      const def = this.worldData.items[name];
      if (!def) return;
      if (def.stack) {
        const existing = list.find((it) => it.name === name);
        if (existing) {
          existing.count += count;
          return;
        }
      }
      list.push({ id: `it-${seq++}`, name, count, plus, equipped });
    };

    for (const s of clsCfg.startItems || []) {
      const eq =
        (clsId === 'elf' && s.name === '短弓') ||
        (clsId !== 'elf' && s.name === '匕首') ||
        s.name === '皮夾克';
      pushItem(s.name, s.count, 0, eq);
    }
    pushItem('紅色藥水', 12);
    pushItem('綠色藥水', 3);
    pushItem('肉', 3);
    pushItem('瞬間移動的卷軸', 3);
    pushItem('傳送回家的卷軸', 2);
    pushItem('內掛符石', 1);
    pushItem('喝水符石', 1);
    if (clsId === 'knight' || clsId === 'royal') pushItem('長劍', 1, 0, true);
    if (clsId === 'mage') pushItem('木棒', 1, 0, true);
    // 若已裝備長劍，取消預設匕首裝備避免雙武器
    const weapons = list.filter((it) => this.worldData.items[it.name]?.kind === 'weapon' && it.equipped);
    if (weapons.length > 1) {
      weapons.slice(0, -1).forEach((w) => {
        w.equipped = false;
      });
    }
    return list;
  }

  #isHasted(p = this.player, now = performance.now()) {
    return (p.buffs?.haste || 0) > now || Boolean(p._equipHaste);
  }

  #getSpeedMult(p = this.player, now = performance.now(), hasteFactor = 1.32) {
    const hasted = this.#isHasted(p, now);
    const braved = (p.buffs?.brave || 0) > now;
    const polyed = (p.buffs?.poly || 0) > now;
    const polyMult = polyed ? (p.polyBonus?.atkMult ?? 1.15) : 1;
    return (hasted ? hasteFactor : 1) * (braved ? 1.12 : 1) * polyMult;
  }

  recomputePlayerStats(p = this.player) {
    const now = performance.now();

    // 同步外部直接修改的 maxHp / maxMp，避免裝備重算覆蓋測試腳本或外部調整
    if (p.baseMaxHp == null) p.baseMaxHp = p.maxHp || 14;
    else if (p._lastComputedMaxHp != null && p.maxHp !== p._lastComputedMaxHp) {
      p.baseMaxHp = Math.max(1, p.baseMaxHp + (p.maxHp - p._lastComputedMaxHp));
    }
    if (p.baseMaxMp == null) p.baseMaxMp = p.maxMp || 2;
    else if (p._lastComputedMaxMp != null && p.maxMp !== p._lastComputedMaxMp) {
      p.baseMaxMp = Math.max(0, p.baseMaxMp + (p.maxMp - p._lastComputedMaxMp));
    }

    // 第一階段：統計背包負重與已裝備武器／防具提供的六圍、抗性與特殊詞綴
    let equipStr = 0;
    let equipCon = 0;
    let equipDex = 0;
    let equipInt = 0;
    let equipWis = 0;
    let equipCha = 0;
    let equipAcRed = 0;
    let bonusHp = 0;
    let bonusMp = 0;
    let equipMr = 0;
    let bonusSp = 0;
    let equipHpRegen = 0;
    let equipMpRegen = 0;
    let equipDr = 0;
    let equipMaxWeightPct = 0;
    let equipHitMelee = 0;
    let equipHitBow = 0;
    let equipDmgMelee = 0;
    let equipDmgBow = 0;
    const elemRes = { water: 0, wind: 0, fire: 0, earth: 0 };
    const specials = new Set();
    // 金幣（金錢）不計入負重，僅統計背包道具重量
    let totalWeight = 0;
    let activeWeapon = null;

    for (const it of p.inventory) {
      const def = this.worldData.items[it.name];
      if (!def) continue;
      if (it.name !== '金幣') {
        totalWeight += (def.weight || 0) * it.count;
      }
      if (!it.equipped) continue;
      if (def.kind === 'weapon') {
        activeWeapon = { item: it, def };
      } else if (def.kind === 'armor') {
        equipAcRed += Math.max(0, (def.ac || 0) + (it.plus || 0) - (it.brokenCount || 0));
        bonusHp += def.hp || 0;
        bonusMp += def.mp || 0;
        equipMr += def.mr || 0;
        equipHitMelee += def.hitMelee || 0;
        equipHitBow += def.hitBow || 0;
        equipDmgMelee += def.dmgMelee || 0;
        equipDmgBow += def.dmgBow || 0;
      }
      equipStr += def.str || 0;
      equipCon += def.con || 0;
      equipDex += def.dex || 0;
      equipInt += def.int || 0;
      equipWis += def.wis || 0;
      equipCha += def.cha || 0;
      bonusSp += def.sp || 0;
      equipHpRegen += def.regenHp || 0;
      equipMpRegen += def.regenMp || 0;
      equipDr += def.dr || 0;
      equipMaxWeightPct += def.maxWeightBonus || 0;
      if (def.elem) {
        elemRes.water += def.elem.water || 0;
        elemRes.wind += def.elem.wind || 0;
        elemRes.fire += def.elem.fire || 0;
        elemRes.earth += def.elem.earth || 0;
      }
      if (def.special) specials.add(def.special);
    }

    // 第二階段：套用六圍加成後查表計算衍生能力與次級面板
    const effStr = p.stats.str + equipStr + ((p.buffs.strUp || 0) > now ? 5 : 0);
    const effDex = p.stats.dex + equipDex + ((p.buffs.dexUp || 0) > now ? 5 : 0);
    const effCon = p.stats.con + equipCon;
    const effWis = p.stats.wis + equipWis;
    const effInt = p.stats.int + equipInt;
    const effCha = p.stats.cha + equipCha;
    p.effStr = effStr;
    p.effDex = effDex;
    p.effCon = effCon;
    p.effWis = effWis;
    p.effInt = effInt;
    p.effCha = effCha;

    const abilities = computeDerivedAbilities({
      classId: p.classId,
      level: p.level,
      stats: p.stats,
      effStats: { str: effStr, dex: effDex, con: effCon, wis: effWis, int: effInt, cha: effCha },
      birthStats: p.birthStats || p.stats,
    });
    p.abilities = abilities;

    let ac = 10 - abilities.levelAcRed - abilities.birthAcBonus - equipAcRed;
    let bonusMr = abilities.wisMr + equipMr;

    if ((p.buffs.shield || 0) > now) ac -= 2;
    if ((p.buffs.blessedArmor || 0) > now) ac -= 3;
    if ((p.buffs.mrUp || 0) > now) bonusMr += 20;
    const isPolied = (p.buffs.poly || 0) > now;
    if (isPolied) ac -= (p.polyBonus?.ac ?? 1);
    else {
      p.polyGfx = null;
      p.polyName = '';
      p.polyBonus = null;
    }

    const weightEquipBonus = equipMaxWeightPct ? Math.round(abilities.maxWeightBase * (equipMaxWeightPct / 100)) : 0;
    const maxWeight = Math.max(500, abilities.maxWeightBase + weightEquipBonus + ((p.buffs.heavy || 0) > now ? 450 : 0));
    p.ac = ac;
    p.mr = bonusMr;
    p.er = abilities.er;
    p.sp = Math.max(
      1,
      abilities.magicLv +
        abilities.extraSp +
        bonusSp +
        ((p.buffs.wisdom || 0) > now ? 2 : 0) +
        (isPolied ? (p.polyBonus?.sp || 0) : 0),
    );
    p.maxHp = Math.max(1, p.baseMaxHp + bonusHp);
    p.maxMp = Math.max(0, p.baseMaxMp + bonusMp);
    p._lastComputedMaxHp = p.maxHp;
    p._lastComputedMaxMp = p.maxMp;
    if (p.hp > p.maxHp) p.hp = p.maxHp;
    if (p.mp > p.maxMp) p.mp = p.maxMp;

    p.maxWeight = maxWeight;
    p.elemRes = elemRes;
    p.equipDr = equipDr;
    p.equipHitMelee = equipHitMelee;
    p.equipHitBow = equipHitBow;
    p.equipDmgMelee = equipDmgMelee;
    p.equipDmgBow = equipDmgBow;
    p._equipHpRegen = equipHpRegen;
    p._equipMpRegen = equipMpRegen;
    p._equipHaste = specials.has('haste');
    p._equipSpecials = {
      haste: specials.has('haste'),
      manaDrain: specials.has('mana_drain'),
      dkFire: specials.has('dk_fire'),
    };
    p.weaponItem = activeWeapon;
    if (activeWeapon) {
      const t = activeWeapon.def.type;
      p.weaponType =
        t === 'tohand' || t === 'tohandsword'
          ? 'twohand'
          : t === 'wand' || t === 'staff'
            ? 'staff'
            : ['sword', 'dagger', 'bow', 'spear'].includes(t)
              ? t
              : 'sword';
      p.attackRange = p.weaponType === 'bow' ? 7 : p.weaponType === 'spear' ? 2 : 1;
    } else {
      p.weaponType = 'unarmed';
      p.attackRange = 1;
    }
    p.weightPercent = Math.min(100, Math.round((totalWeight / maxWeight) * 100));
    p.expNext = this.getExpForLevel(p.level);
    p.expPrev = p.level <= 1 ? 0 : this.getExpForLevel(p.level - 1);
    p._bonusHp = bonusHp;
    p._bonusMp = bonusMp;
  }

  getExpForLevel(lv) {
    const row = (this.worldData.expTable || []).find((r) => r.level === lv);
    if (row) return row.total;
    return lv * lv * 50;
  }

  getBuffList(now = performance.now()) {
    const polyLabel = this.player.polyName ? `變身:${this.player.polyName}` : '變身強化';
    const defs = [
      ['haste', '加速術'],
      ['brave', '勇敢'],
      ['strUp', '體魄強健'],
      ['dexUp', '通暢氣脈'],
      ['bluePotion', '藍水'],
      ['meditation', '冥想術'],
      ['wisdom', '慎重'],
      ['shield', '保護罩'],
      ['blessedArmor', '鎧甲護持'],
      ['mrUp', '魔法屏障'],
      ['holyWeapon', '神聖武器'],
      ['heavy', '負重強化'],
      ['resurrect', '復活庇護'],
      ['poly', polyLabel],
    ];
    const b = this.player.buffs || {};
    const out = [];
    if ((b.poison || 0) > now) {
      out.push({ key: 'poison', label: '中毒', remainSec: Math.ceil((b.poison - now) / 1000), isDebuff: true });
    }
    if ((this.player.food ?? 84) <= 10) {
      out.push({ key: 'hungry', label: '飢餓', remainSec: 0, isDebuff: true });
    }
    for (const [key, label] of defs) {
      const remMs = (b[key] || 0) - now;
      if (remMs > 0) out.push({ key, label, remainSec: Math.ceil(remMs / 1000) });
      else if (key === 'haste' && this.player._equipHaste) {
        out.push({ key: 'haste', label: '加速(裝備)', remainSec: 0 });
      }
    }
    return out;
  }

  curePoison(logText = '') {
    const p = this.player;
    const hadPoison = (p.buffs.poison || 0) > performance.now();
    p.buffs.poison = 0;
    if (hadPoison) {
      this.spawnEffect(p.tx, p.ty, '871');
      if (logText) this.addLog(logText, 'cyan');
      this.dirtySave = true;
    }
    return hadPoison;
  }

  #grantExp(gainedExp) {
    const p = this.player;
    const amount = Math.max(0, Math.floor(gainedExp || 0));
    if (amount <= 0) return false;
    p.exp += amount;
    let leveled = false;
    while (p.level < 60 && p.exp >= this.getExpForLevel(p.level)) {
      p.level += 1;
      leveled = true;
      const cls = this.worldData.classes[p.classId] || this.worldData.classes.royal;
      const realCls = LINEAGE_REAL_BASE_STATS[normalizeAbilityClassId(p.classId)] || LINEAGE_REAL_BASE_STATS.royal;
      const effStats = {
        str: p.effStr ?? p.stats.str,
        dex: p.effDex ?? p.stats.dex,
        con: p.effCon ?? p.stats.con,
        wis: p.effWis ?? p.stats.wis,
        int: p.effInt ?? p.stats.int,
        cha: p.effCha ?? p.stats.cha,
      };
      const der = computeDerivedAbilities({
        classId: p.classId,
        level: p.level,
        stats: p.stats,
        effStats,
        birthStats: p.birthStats || p.stats,
      });
      const hpGain = Math.max(4, Math.floor((realCls.baseHp || cls.baseHp || 14) * 0.55) + der.hpGrowth + randInt(1, 5));
      const mpGain = Math.max(1, Math.floor((computeInitialMp(p.classId, effStats.wis) || 2) * 0.65) + Math.max(0, der.mpGrowth) + randInt(0, 2));
      p.baseMaxHp = Math.min(realCls.maxHpCap || cls.maxHpCap || 1500, (p.baseMaxHp ?? p.maxHp) + hpGain);
      p.baseMaxMp = Math.min(realCls.maxMpCap || cls.maxMpCap || 1200, (p.baseMaxMp ?? p.maxMp) + mpGain);
      p.maxHp = Math.max(1, p.baseMaxHp + (p._bonusHp || 0));
      p.maxMp = Math.max(0, p.baseMaxMp + (p._bonusMp || 0));
      p._lastComputedMaxHp = p.maxHp;
      p._lastComputedMaxMp = p.maxMp;
      p.hp = p.maxHp;
      p.mp = p.maxMp;
      this.spawnEffect(p.tx, p.ty, 'levelup');
      this.audio.playSound('/level-up-v1/517.wav', 0.45);
      this.spawnFloatingText(p.tx, p.ty - 1, `LEVEL UP! Lv.${p.level}`, '#ffd54f');
      this.addLog(`恭喜升級！目前等級：Lv.${p.level}（HP ${p.maxHp} / MP ${p.maxMp}）！`, 'gold');
    }
    if (leveled) this.recomputePlayerStats();
    return leveled;
  }

  #loadDisplayPrefs() {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('ll286:display_prefs_v1') : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return { showVfx: parsed.showVfx !== false, showDamageNums: parsed.showDamageNums !== false };
        }
      }
    } catch {
      // 忽略
    }
    return { showVfx: true, showDamageNums: true };
  }

  setDisplayPref(key, val) {
    if (!this.displayPrefs) this.displayPrefs = { showVfx: true, showDamageNums: true };
    this.displayPrefs[key] = Boolean(val);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ll286:display_prefs_v1', JSON.stringify(this.displayPrefs));
      }
    } catch {
      // 忽略
    }
  }

  #loadWarehouse() {
    try {
      const raw = localStorage.getItem(this.storagePrefix);
      if (raw) return JSON.parse(raw);
    } catch {
      // 忽略
    }
    return { gold: 0, items: [] };
  }

  #restoreSavedBuffs(saved) {
    const initNow = performance.now();
    const restored = {};
    if (saved?.buffsRemaining && typeof saved.buffsRemaining === 'object') {
      for (const [k, remMs] of Object.entries(saved.buffsRemaining)) {
        const ms = Number(remMs);
        if (Number.isFinite(ms) && ms > 250) {
          restored[k] = initNow + ms;
        }
      }
      return restored;
    }
    if (saved?.buffs && typeof saved.buffs === 'object') {
      for (const [k, until] of Object.entries(saved.buffs)) {
        const ts = Number(until);
        if (Number.isFinite(ts) && ts > initNow + 250) {
          restored[k] = ts;
        }
      }
    }
    return restored;
  }

  saveWorld(force = false, opts = {}) {
    const now = performance.now();
    if (!force && (!this.dirtySave || now - this.lastSaveAt < 2500)) return;
    this.dirtySave = false;
    this.lastSaveAt = now;
    this.lastBuffSaveAt = now;
    const p = this.player;
    const buffsRemaining = {};
    for (const [k, until] of Object.entries(p.buffs || {})) {
      const rem = Math.round(Number(until) - now);
      if (Number.isFinite(rem) && rem > 250) {
        buffsRemaining[k] = rem;
      }
    }
    const worldSavePayload = {
      charName: p.name,
      classId: this.lobbyChar?.classId || p.classId,
      className: p.className || this.lobbyChar?.className || null,
      createdAt: this.lobbyChar?.createdAt || null,
      updatedAt: Date.now(),
      level: p.level,
      exp: p.exp,
      gold: p.gold,
      lawful: p.lawful,
      food: p.food,
      kills: p.kills,
      quests: p.quests,
      stats: p.stats,
      birthStats: p.birthStats || p.stats,
      hp: p.hp,
      baseMaxHp: p.baseMaxHp ?? p.maxHp,
      maxHp: p.maxHp,
      mp: p.mp,
      baseMaxMp: p.baseMaxMp ?? p.maxMp,
      maxMp: p.maxMp,
      ac: p.ac,
      map: p.map,
      tx: p.tx,
      ty: p.ty,
      clanName: p.clanName || '',
      polyGfx: p.polyGfx || null,
      polyName: p.polyName || '',
      polyBonus: p.polyBonus || null,
      pet: p.pet
        ? {
            id: p.pet.id,
            name: p.pet.name,
            gfx: p.pet.gfx,
            level: p.pet.level,
            hp: p.pet.hp,
            maxHp: p.pet.maxHp,
            exp: p.pet.exp,
            dmg: p.pet.dmg,
          }
        : null,
      buffsRemaining,
      spells: p.spells,
      inventory: p.inventory,
      quickbar: p.quickbar,
      autoConfig: p.autoConfig,
    };
    try {
      localStorage.setItem(this.saveKey, JSON.stringify(worldSavePayload));
      localStorage.setItem(this.storagePrefix, JSON.stringify(this.warehouse));
    } catch {
      // 配額已滿略過
    }
    if (typeof this.onLobbySync === 'function') {
      this.onLobbySync({
        slot: this.lobbyChar.slot,
        level: p.level,
        exp: p.exp,
        gold: p.gold,
        adena: p.gold,
        lawful: p.lawful,
        alignment: p.lawful,
        clanName: p.clanName || '',
        pledge: p.clanName || '無血盟',
        stats: p.stats,
        hp: p.hp,
        maxHp: p.maxHp,
        mp: p.mp,
        maxMp: p.maxMp,
        ac: p.ac,
        map: p.map,
        x: p.tx,
        y: p.ty,
        worldSave: worldSavePayload,
      }, { immediate: Boolean(opts?.immediate), keepalive: Boolean(opts?.keepalive) });
    }
  }

  addLog(text, tone = 'info') {
    const t = new Date();
    const hh = String(t.getHours()).padStart(2, '0');
    const mm = String(t.getMinutes()).padStart(2, '0');
    this.logs.push({ time: `${hh}:${mm}`, text, tone });
    if (this.logs.length > 80) this.logs.shift();
  }

  runChatCommand(rawText) {
    const text = String(rawText || '').trim();
    if (!text) return { ok: false };
    const p = this.player;
    const cmd = text.toLowerCase();
    if (cmd === '/who') {
      const aliveMobs = this.mobs.filter((m) => m.hp > 0).length;
      const peerNames = this.remotePeers.length ? ` · 同線玩家：${this.remotePeers.map((r) => r.charName).join('、')}` : '';
      this.addLog(`【世界名單】${p.name} (Lv.${p.level}) · 線上 ${Math.max(1, this.onlineCount || 1)} 人 · NPC ${this.npcs.length} 位 · 怪物 ${aliveMobs} 隻${peerNames}。`, 'cyan');
      return { ok: true, cmd: 'who' };
    }
    if (cmd === '/loc') {
      this.addLog(`【目前座標】${MAP_NAMES[p.map] || p.map}（${p.tx}, ${p.ty}）· 擊殺 ${p.kills} 隻。`, 'cyan');
      return { ok: true, cmd: 'loc' };
    }
    if (cmd === '/auto') {
      this.toggleAutoHunt('已透過指令開啟內掛。', '已透過指令關閉內掛。');
      return { ok: true, cmd: 'auto' };
    }
    if (cmd === '/home') {
      const town = resolveHomeTown(p.map, p.tx, p.ty);
      if (isSafetyZone(p.map, p.tx, p.ty, this.isoMap)) {
        this.teleportTo(town.map, town.x, town.y, 4);
        return { ok: true, cmd: 'home' };
      }
      if (!getMapMeta(p.map).recall) {
        this.addLog(`目前所在的【${MAP_NAMES[p.map] || p.map}】禁止使用回卷返村！`, 'warn');
        return { ok: false };
      }
      const scroll = p.inventory.find((i) => i.name === '傳送回家的卷軸' && i.count > 0);
      if (scroll) return this.useItem(scroll.id);
      this.addLog('背包中沒有傳送回家的卷軸，無法從野外返回。', 'warn');
      return { ok: false };
    }
    if (cmd === '/clear') {
      this.logs = [];
      this.addLog('已清除訊息紀錄。', 'info');
      return { ok: true, cmd: 'clear' };
    }
    if (cmd === '/help') {
      this.addLog('可用指令：/who 線上狀態、/loc 目前座標、/auto 切換內掛、/home 回村、/clear 清除對話。', 'gold');
      return { ok: true, cmd: 'help' };
    }
    if (text.startsWith('/')) {
      this.addLog(`未知指令「${text}」，輸入 /help 查看說明。`, 'warn');
      return { ok: false };
    }
    p.lastChatText = text;
    p.lastChatAt = Date.now();
    this.addLog(`[${p.name}] ${text}`, 'chat');
    this.spawnFloatingText(p.tx, p.ty - 1, `${p.name}: ${text}`, '#fff4c2', 2600);
    return { ok: true, cmd: 'say' };
  }

  spawnFloatingText(tx, ty, text, color = '#ffffff', duration = 950) {
    const wp = tileToWorld(tx, ty);
    this.floatingTexts.push({
      id: `ft-${this.nextUid++}`,
      x: wp.x + (Math.random() - 0.5) * 14,
      y: wp.y - 46,
      text,
      color,
      bornAt: performance.now(),
      duration,
    });
  }

  spawnEffect(tx, ty, effectId) {
    const eff = this.worldData.effectsMeta?.[String(effectId)];
    if (!eff) return;
    const wp = tileToWorld(tx, ty);
    this.effects.push({
      id: `fx-${this.nextUid++}`,
      effectId: String(effectId),
      x: wp.x,
      y: wp.y,
      bornAt: performance.now(),
      duration: eff.duration || 500,
    });
    const snd = eff.sounds?.['1'] || eff.sounds?.['0'];
    if (snd) this.audio.playSound(snd, 0.35);
  }

  loadMapEntities(mapId) {
    this.npcs = [];
    this.mobs = [];
    this.drops = [];
    this.respawnQueue = [];
    this.projectiles = [];

    for (const n of this.worldData.npcs || []) {
      if (n.map !== mapId) continue;
      const wp = tileToWorld(n.x, n.y);
      this.npcs.push({
        ...n,
        worldX: wp.x,
        worldY: wp.y,
        animState: 'idle',
      });
      if (tileDistance(n.x, n.y, this.player.tx, this.player.ty) <= 45) {
        this.sprites.preloadActor(n.renderGfx);
      }
    }

    const occupied = new Set(this.npcs.map((n) => `${n.x},${n.y}`));
    occupied.add(`${this.player.tx},${this.player.ty}`);

    const mapSpawns = (this.worldData.spawns || []).filter((sp) => sp.map === mapId);
    for (const sp of mapSpawns) {
      const mobDef = this.worldData.monsters[sp.name];
      if (!mobDef) continue;
      // 每個生怪點生成實體並散布於可行走格
      for (let idx = 0; idx < sp.count; idx += 1) {
        this.#spawnMobFromDef(sp, mobDef, occupied);
      }
    }
  }

  #isHostileRestrictedTile(mapId, tx, ty) {
    const m = Number(mapId);
    return isSafetyZone(m, tx, ty, this.isoMap) || ((m === 0 || m === 4) && Boolean(this.isoMap.hasSafetyBit?.(tx, ty, m)));
  }

  #findRandomMapTile(mapId, occupied, options = {}) {
    const pool = this.isoMap.getWalkableTiles(mapId);
    if (!pool.length) return null;
    const avoidSafe = Boolean(options?.avoidSafetyZone);
    const usable = (cand) =>
      !occupied?.has(`${cand.x},${cand.y}`) &&
      !(avoidSafe && this.#isHostileRestrictedTile(mapId, cand.x, cand.y));
    for (let i = 0; i < 32; i += 1) {
      const cand = pool[randInt(0, pool.length - 1)];
      if (usable(cand)) return cand;
    }
    for (const cand of pool) {
      if (usable(cand)) return cand;
    }
    if (avoidSafe) {
      const nonSafe = pool.find((cand) => !this.#isHostileRestrictedTile(mapId, cand.x, cand.y));
      if (nonSafe) return nonSafe;
    }
    return pool[0];
  }

  #findFreeWalkableTile(cx, cy, radius, mapId, occupied, options = {}) {
    if (!cx && !cy) {
      return this.#findRandomMapTile(mapId, occupied, options);
    }
    const avoidSafe = Boolean(options?.avoidSafetyZone);
    const canUse = (tx, ty) =>
      this.isoMap.isWalkableTile(tx, ty, mapId) &&
      !occupied?.has(`${tx},${ty}`) &&
      !(avoidSafe && this.#isHostileRestrictedTile(mapId, tx, ty));
    const tries = Math.max(6, radius * 3);
    for (let i = 0; i < tries; i += 1) {
      const tx = cx + (i === 0 ? 0 : randInt(-radius, radius));
      const ty = cy + (i === 0 ? 0 : randInt(-radius, radius));
      if (canUse(tx, ty)) return { x: tx, y: ty };
    }
    if (options?.allowOutwardFallback) {
      for (let r = 1; r <= 36; r += 1) {
        for (let oy = -r; oy <= r; oy += 1) {
          for (let ox = -r; ox <= r; ox += 1) {
            if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
            if (canUse(cx + ox, cy + oy)) return { x: cx + ox, y: cy + oy };
          }
        }
      }
    }
    if (avoidSafe && this.#isHostileRestrictedTile(mapId, cx, cy)) return null;
    return this.isoMap.isWalkableTile(cx, cy, mapId) ? { x: cx, y: cy } : null;
  }

  #spawnMobFromDef(sp, mobDef, occupied = null) {
    const spawnOpts = sp.villageAnimal
      ? { avoidSafetyZone: false }
      : { avoidSafetyZone: true, allowOutwardFallback: true };
    const pos =
      sp.random || (!sp.x && !sp.y)
        ? this.#findRandomMapTile(sp.map, occupied, spawnOpts)
        : this.#findFreeWalkableTile(
            sp.x,
            sp.y,
            Math.max(1, Math.min(sp.size, 8)),
            sp.map,
            occupied,
            spawnOpts,
          );
    if (!pos) return null;
    if (occupied) occupied.add(`${pos.x},${pos.y}`);
    const wp = tileToWorld(pos.x, pos.y);
    const rangedCfg = RANGED_OR_CASTER_MOBS[mobDef.name];
    const mob = {
      id: `mob-${this.nextUid++}`,
      spawnId: sp.id,
      spawn: sp,
      homeX: pos.x,
      homeY: pos.y,
      name: mobDef.name,
      gfx: mobDef.gfx,
      level: mobDef.level,
      hp: mobDef.hp,
      maxHp: mobDef.hp,
      ac: mobDef.ac,
      str: mobDef.str,
      exp: mobDef.exp,
      lawful: mobDef.lawful,
      range: Math.max(mobDef.range || 1, rangedCfg?.range || 1),
      attackMode: rangedCfg?.mode || 'melee',
      castEffectId: rangedCfg?.effectId || 167,
      aggressive: mobDef.aggressive && !mobDef.isPassiveCritter,
      isPassiveCritter: mobDef.isPassiveCritter,
      aden: mobDef.aden,
      map: sp.map,
      tx: pos.x,
      ty: pos.y,
      heading: randInt(0, 7),
      animState: 'idle',
      animStartedAt: performance.now(),
      moveFrom: null,
      moveTo: null,
      moveProgress: 0,
      worldX: wp.x,
      worldY: wp.y,
      aggroTarget: false,
      lastActAt: performance.now() + randInt(0, 1400),
      nextRoamAt: performance.now() + randInt(1500, 6000),
      dieAt: 0,
    };
    this.mobs.push(mob);
    return mob;
  }

  teleportTo(mapId, tx, ty, heading = 4) {
    const targetMap = Number(mapId);
    const prevMap = this.player.map;
    let destX = Number(tx);
    let destY = Number(ty);
    if (!this.isoMap.isWalkableTile(destX, destY, targetMap)) {
      const alt =
        this.#findFreeWalkableTile(destX, destY, 6, targetMap) ||
        this.#findRandomMapTile(targetMap, null);
      if (alt) {
        destX = alt.x;
        destY = alt.y;
      }
    }
    const p = this.player;
    p.map = targetMap;
    p.tx = destX;
    p.ty = destY;
    p.heading = heading;
    p.path = [];
    p.moveFrom = null;
    p.moveTo = null;
    p.targetId = null;
    p.animState = 'idle';
    const wp = tileToWorld(destX, destY);
    p.worldX = wp.x;
    p.worldY = wp.y;

    if (prevMap !== targetMap) {
      this.loadMapEntities(targetMap);
    }
    this.spawnEffect(destX, destY, '169');
    this.addLog(`已抵達 ${MAP_NAMES[targetMap] || '未知區域'} (${destX}, ${destY})。`, 'gold');
    this.dirtySave = true;
    this.saveWorld(true);
  }

  checkPortalAtPlayer() {
    const p = this.player;
    for (const portal of this.worldData.portals || []) {
      if (portal.map === p.map && tileDistance(p.tx, p.ty, portal.x, portal.y) === 0) {
        this.teleportTo(portal.toMap, portal.toX, portal.toY, portal.heading || 4);
        return true;
      }
    }
    return false;
  }

  /**
   * 切換自動練功開關並通知外掛控制器重置／保存錨點與統計。
   */
  toggleAutoHunt(enableMsg = null, disableMsg = null) {
    const p = this.player;
    p.autoConfig.enabled = !p.autoConfig.enabled;
    p.autoConfig.anchor = p.autoConfig.enabled ? { map: p.map, x: p.tx, y: p.ty } : null;
    if (p.autoConfig.enabled && enableMsg) this.addLog(enableMsg, 'gold');
    if (!p.autoConfig.enabled && disableMsg) this.addLog(disableMsg, 'gold');
    this.onAutoToggled?.(p.autoConfig.enabled);
    this.dirtySave = true;
    return p.autoConfig.enabled;
  }

  /**
   * 取得指定地圖所有靜態傳送點座標集合（不快取怪物）。
   */
  getPortalTileSet(mapId = this.player?.map) {
    const m = Number(mapId);
    let set = this.portalSetByMap.get(m);
    if (!set) {
      set = new Set();
      for (const portal of this.worldData.portals || []) {
        if (portal.map === m) set.add(`${portal.x},${portal.y}`);
      }
      this.portalSetByMap.set(m, set);
    }
    return set;
  }

  /**
   * 取得僅包含靜態實體（NPC）的佔位座標集合，明確排除怪物。
   */
  getStaticOccupiedTileSet() {
    const set = new Set();
    for (const n of this.npcs) set.add(`${n.x},${n.y}`);
    return set;
  }

  /**
   * 取得目前地圖上存活怪物佔位集合，僅供軟繞路成本權衡，不當作牆壁障礙。
   */
  getMobTileSet(excludeMobId = null) {
    const set = new Set();
    for (const m of this.mobs) {
      if (m.hp > 0 && m.id !== excludeMobId) set.add(`${m.tx},${m.ty}`);
    }
    return set;
  }

  getOccupiedTileSet(excludeId = null) {
    const set = this.getStaticOccupiedTileSet();
    for (const m of this.mobs) {
      if (m.hp > 0 && m.id !== excludeId) set.add(`${m.tx},${m.ty}`);
    }
    return set;
  }

  /**
   * 彙整指定地圖可出沒的怪物名稱清單（供內掛白名單／黑名單勾選）。
   */
  getMapMonsterNames(mapId = this.player?.map) {
    const mId = Number(mapId);
    const names = new Set();
    for (const m of this.mobs) {
      if (m.name) names.add(m.name);
    }
    for (const sp of this.worldData.spawns || []) {
      if (sp.map === mId && sp.name && this.worldData.monsters?.[sp.name]) {
        names.add(sp.name);
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  }

  /**
   * 共用智慧 A* 尋路入口：硬阻擋僅含靜態障礙（NPC／傳送點／牆壁），怪物只列為軟繞行成本。
   */
  computeSmartPath(tx, ty, options = {}) {
    const p = this.player;
    const staticBlocked = this.getStaticOccupiedTileSet();
    if (options.extraStaticBlocked) {
      for (const k of options.extraStaticBlocked) staticBlocked.add(k);
    }
    const mobTiles = options.excludeMobTiles ? null : this.getMobTileSet(options.excludeMobId || null);
    const useAutoGuards = Boolean(options.useAutoGuards ?? p.autoConfig?.enabled);
    return this.isoMap.findPathDetailed(p.tx, p.ty, tx, ty, p.map, {
      blockedSet: staticBlocked,
      softBlockedSet: mobTiles,
      softPenalty: options.softPenalty ?? 5,
      wallMarginCost: p.autoConfig?.avoidWallHug ? 0.14 : 0,
      goalRange: options.goalRange ?? 0,
      requireLos: Boolean(options.requireLos),
      maxNodes: options.maxNodes ?? 2200,
      allowPartial: options.allowPartial ?? true,
      portalSet: useAutoGuards && p.autoConfig?.avoidPortals ? this.getPortalTileSet(p.map) : null,
      avoidSafety: Boolean(useAutoGuards && p.autoConfig?.avoidSafetyBorder),
    });
  }

  setWalkTarget(tx, ty) {
    const p = this.player;
    if (p.hp <= 0) return;
    p.targetId = null;
    p.pendingInteractNpcId = null;
    p.pendingPickupId = null;
    p.pendingTrainNpcId = null;
    p.lastMoveBlocked = null;
    p.path = this.computeSmartPath(tx, ty, { useAutoGuards: false }).path;
  }

  interactOrWalkToNpc(npc) {
    const p = this.player;
    p.targetId = null;
    p.pendingPickupId = null;
    p.lastMoveBlocked = null;
    if (npc?.type === 'TrainingDummy') {
      p.pendingInteractNpcId = null;
      p.pendingTrainNpcId = npc.id;
      const reach = Math.max(2, p.attackRange || 1);
      if (tileDistance(p.tx, p.ty, npc.x, npc.y) <= reach) {
        p.path = [];
        this.hitTrainingDummy(npc);
      } else {
        p.path = this.computeSmartPath(npc.x, npc.y, { useAutoGuards: false }).path;
      }
      return null;
    }
    p.pendingTrainNpcId = null;
    if (tileDistance(p.tx, p.ty, npc.x, npc.y) <= 2) {
      p.heading = headingBetween(npc.x - p.tx, npc.y - p.ty);
      return npc;
    }
    p.pendingInteractNpcId = npc.id;
    p.path = this.computeSmartPath(npc.x, npc.y, { useAutoGuards: false }).path;
    return null;
  }

  hitTrainingDummy(npc, now = performance.now()) {
    if (!npc) return false;
    const p = this.player;
    const speedMult = this.#getSpeedMult(p, now, 1.3);
    const cd = Math.round(700 / speedMult);
    if (now - p.lastAttackAt < cd) return false;

    p.heading = headingBetween(npc.x - p.tx, npc.y - p.ty);
    p.isHittingDummy = true;
    p.lastAttackAt = now;
    p.animState = 'attack';
    p.animStartedAt = now;
    p.animDurationMs = Math.max(360, Math.round(cd * 0.9));
    p.animStiffUntil = now + Math.max(220, Math.round(cd * 0.44));
    npc.animState = 'damage';
    npc.animStartedAt = now;

    this.audio.playSound(p.weaponType === 'bow' ? 248 : 247, 0.3);
    if (p.weaponType === 'bow') {
      const from = tileToWorld(p.tx, p.ty);
      const to = tileToWorld(npc.x, npc.y);
      this.projectiles.push({
        id: `proj-${this.nextUid++}`,
        fromX: from.x,
        fromY: from.y,
        toX: to.x,
        toY: to.y,
        x: from.x,
        y: from.y,
        heading: p.heading,
        progress: 0,
        targetKind: 'dummy',
        dmg: 0,
      });
    }

    if (p.level < 5) {
      const gained = 5;
      const beforeLv = p.level;
      this.spawnFloatingText(npc.x, npc.y, `HIT · EXP +${gained}`, '#a7f3d0');
      this.#grantExp(gained);
      if (beforeLv < 5 && p.level >= 5) {
        p.pendingTrainNpcId = null;
        this.addLog('已透過木人訓練達到 Lv.5！請離開村莊挑戰實戰怪物以繼續升級。', 'gold');
      } else {
        this.addLog(`擊打木人練習（EXP +${gained}）。`, 'info');
      }
      this.dirtySave = true;
    } else {
      p.pendingTrainNpcId = null;
      this.spawnFloatingText(npc.x, npc.y, 'Lv.5 訓練已滿', '#fcd34d');
      this.addLog('Lv.5 以上擊打木人不會再獲得經驗值，請出村狩獵怪物。', 'warn');
    }
    return true;
  }

  targetMob(mob) {
    const p = this.player;
    p.pendingInteractNpcId = null;
    p.pendingPickupId = null;
    p.pendingTrainNpcId = null;
    p.targetId = mob.id;
    p.heading = headingBetween(mob.tx - p.tx, mob.ty - p.ty);
  }

  pickupOrWalkToDrop(drop) {
    const p = this.player;
    p.targetId = null;
    p.pendingInteractNpcId = null;
    p.pendingTrainNpcId = null;
    if (tileDistance(p.tx, p.ty, drop.tx, drop.ty) <= 1) {
      this.pickupDrop(drop);
      return true;
    }
    p.pendingPickupId = drop.id;
    const res = this.computeSmartPath(drop.tx, drop.ty);
    p.path = res.path;
    return false;
  }

  pickupDrop(drop) {
    const idx = this.drops.findIndex((d) => d.id === drop.id);
    if (idx === -1) return false;
    this.drops.splice(idx, 1);
    if (drop.item === '金幣') {
      this.player.gold += drop.count;
      this.addLog(`拾取了 金幣 (${drop.count})。`, 'cyan');
      this.spawnFloatingText(this.player.tx, this.player.ty, `+${drop.count} 金幣`, '#ffd86b');
    } else {
      const def = this.worldData.items[drop.item];
      const isGear = def?.kind === 'weapon' || def?.kind === 'armor';
      this.addItemToInventory(drop.item, drop.count, drop.plus || 0, { identified: !isGear });
      this.addLog(`拾取了 ${drop.plus ? `+${drop.plus} ` : ''}${drop.item}${drop.count > 1 ? ` (${drop.count})` : ''}。`, 'cyan');
      this.spawnFloatingText(this.player.tx, this.player.ty, `+${drop.item}`, '#8ef0ff');
    }
    this.audio.playSound(103, 0.35);
    this.recomputePlayerStats();
    this.dirtySave = true;
    return true;
  }

  addItemToInventory(name, count = 1, plus = 0, opts = {}) {
    const def = this.worldData.items[name];
    if (!def) return false;
    if (name === '金幣') {
      this.player.gold += count;
      this.dirtySave = true;
      return true;
    }
    if (def.stack) {
      const existing = this.player.inventory.find((i) => i.name === name);
      if (existing) {
        existing.count += count;
        this.recomputePlayerStats();
        this.dirtySave = true;
        return true;
      }
    }
    if (this.player.inventory.length >= 120) {
      this.addLog('背包已滿，無法放入更多道具。', 'warn');
      return false;
    }
    const isGear = def.kind === 'weapon' || def.kind === 'armor';
    this.player.inventory.push({
      id: `it-${Date.now().toString(36)}-${this.nextUid++}`,
      name,
      count,
      plus,
      equipped: false,
      identified: opts.identified ?? true,
      brokenCount: isGear ? (opts.brokenCount || 0) : 0,
    });
    this.recomputePlayerStats();
    this.dirtySave = true;
    return true;
  }

  consumeItem(itemId, count = 1) {
    const idx = this.player.inventory.findIndex((i) => i.id === itemId);
    if (idx === -1) return false;
    const it = this.player.inventory[idx];
    if (it.count <= count) {
      this.player.inventory.splice(idx, 1);
    } else {
      it.count -= count;
    }
    this.recomputePlayerStats();
    this.dirtySave = true;
    return true;
  }

  useItem(itemOrId, explicitTargetId = null) {
    const item = typeof itemOrId === 'string'
      ? this.player.inventory.find((i) => i.id === itemOrId || i.name === itemOrId)
      : itemOrId;
    if (!item) return { ok: false, msg: '找不到該道具。' };
    const def = this.worldData.items[item.name];
    if (!def) return { ok: false, msg: '未知道具。' };
    const p = this.player;
    const now = performance.now();

    if (def.kind === 'weapon' || def.kind === 'armor') {
      const allowed = def.classes?.[this.worldData.classes[p.classId]?.clsIdx ?? 0] ?? 1;
      if (!allowed && !item.equipped) {
        this.addLog(`${item.name} 無法由你的職業裝備。`, 'warn');
        return { ok: false };
      }
      if (item.equipped) {
        item.equipped = false;
        this.addLog(`已卸下 ${item.plus ? `+${item.plus} ` : ''}${item.name}。`, 'info');
      } else {
        // 卸下同部位（武器或同 armor.type），並處理雙手武器與盾牌互斥
        const slotType = def.kind === 'weapon' ? 'weapon' : def.type;
        const autoRemoved = [];
        for (const other of p.inventory) {
          if (!other.equipped || other.id === item.id) continue;
          const oDef = this.worldData.items[other.name];
          if (!oDef) continue;
          const sameSlot =
            (slotType === 'weapon' && oDef.kind === 'weapon') ||
            (slotType !== 'weapon' && oDef.kind === 'armor' && oDef.type === slotType);
          const handConflict =
            (slotType === 'weapon' && def.twoHand && oDef.kind === 'armor' && oDef.type === 'shield') ||
            (slotType === 'shield' && oDef.kind === 'weapon' && oDef.twoHand);
          if (sameSlot || handConflict) {
            other.equipped = false;
            if (handConflict) autoRemoved.push(other.name);
          }
        }
        item.equipped = true;
        this.addLog(
          `已裝備 ${item.plus ? `+${item.plus} ` : ''}${item.name}${autoRemoved.length ? `（已自動卸下衝突裝備：${autoRemoved.join('、')}）` : ''}。`,
          'info',
        );
      }
      this.audio.playSound(105, 0.3);
      this.recomputePlayerStats();
      this.dirtySave = true;
      return { ok: true };
    }

    // 藥水類
    const potHeal = {
      紅色藥水: [22, 42, '189'],
      橙色藥水: [45, 78, '193'],
      白色藥水: [80, 120, '197'],
    };
    if (potHeal[item.name]) {
      if (now - p.lastPotionAt < 500) return { ok: false };
      const [lo, hi, fx] = potHeal[item.name];
      const baseHeal = randInt(lo, hi);
      const pct = p.abilities?.potionBonusPct || 0;
      const heal = Math.max(1, Math.round(baseHeal * (1 + pct / 100)));
      p.hp = clamp(p.hp + heal, 1, p.maxHp);
      p.lastPotionAt = now;
      this.consumeItem(item.id, 1);
      this.spawnEffect(p.tx, p.ty, fx);
      this.spawnFloatingText(p.tx, p.ty, `+${heal}`, '#6cf296');
      return { ok: true };
    }

    if (item.name === '綠色藥水' || item.name === '自我加速藥水' || item.name === '強化綠色藥水') {
      const dur = item.name === '強化綠色藥水' ? 900000 : 300000;
      p.buffs.haste = now + dur;
      this.consumeItem(item.id, 1);
      this.spawnEffect(p.tx, p.ty, '751');
      this.addLog(`感受到了速度提升（加速狀態 ${Math.round(dur / 1000)} 秒）。`, 'cyan');
      this.saveWorld(true);
      return { ok: true };
    }

    if (item.name === '勇敢藥水' || item.name === '精靈餅乾') {
      p.buffs.brave = now + 300000;
      if (item.name === '精靈餅乾') p.food = clamp((p.food ?? 80) + 18, 0, 100);
      this.consumeItem(item.id, 1);
      this.spawnEffect(p.tx, p.ty, '751');
      this.addLog(item.name === '精靈餅乾' ? '食用精靈餅乾，行動速度與飽食度提升！' : '鬥志沸騰，攻擊節奏提升！', 'cyan');
      this.saveWorld(true);
      return { ok: true };
    }

    if (item.name === '藍色藥水' || item.name === '慎重藥水') {
      if (item.name === '慎重藥水') {
        p.buffs.wisdom = now + 300000;
        this.recomputePlayerStats();
        this.addLog('喝下慎重藥水（魔攻 +2 / 300 秒）。', 'cyan');
      } else {
        p.buffs.bluePotion = now + 300000;
        p.mp = clamp(p.mp + 15, 0, p.maxMp);
        this.addLog('魔力湧動（MP 自然回復量提升）。', 'cyan');
      }
      this.consumeItem(item.id, 1);
      this.spawnEffect(p.tx, p.ty, '190');
      this.saveWorld(true);
      return { ok: true };
    }

    if (item.name === '翡翠藥水') {
      const cured = this.curePoison();
      p.hp = clamp(p.hp + 18, 1, p.maxHp);
      this.consumeItem(item.id, 1);
      this.spawnEffect(p.tx, p.ty, '189');
      this.spawnFloatingText(p.tx, p.ty, cured ? '解毒 +18' : '+18', '#6cf296');
      this.addLog(cured ? '飲用翡翠藥水，體內毒素完全消散！' : '飲用翡翠藥水，毒素消散、精神清爽。', 'cyan');
      this.saveWorld(true);
      return { ok: true };
    }

    if (item.name === '肉' || item.name === '漂浮魔眼的肉') {
      const gain = item.name === '漂浮魔眼的肉' ? 30 : 22;
      p.food = clamp((p.food ?? 80) + gain, 0, 100);
      p.hp = clamp(p.hp + 10, 1, p.maxHp);
      this.consumeItem(item.id, 1);
      this.spawnFloatingText(p.tx, p.ty, `飽食 +${gain}%`, '#fde68a');
      this.addLog(`食用了 ${item.name}（飽食度 ${p.food}%）。`, 'info');
      this.dirtySave = true;
      return { ok: true };
    }

    if (item.name === '變形卷軸') {
      return { ok: true, openModal: 'poly', scrollId: item.id };
    }

    if (item.name === '地圖:說語島') {
      return { ok: true, openModal: 'map' };
    }

    if (def.kind === 'book') {
      const m = /魔法書\s*[（(]([^)）]+)[)）]/.exec(item.name);
      const spName = m?.[1]?.trim();
      const sp = spName ? (this.worldData.spells || []).find((s) => s.name === spName) : null;
      if (!sp) {
        this.addLog(`暫無法解析魔法書 ${item.name}。`, 'warn');
        return { ok: false };
      }
      if (p.spells.includes(sp.id)) {
        this.addLog(`你已經學會「${sp.name}」了。`, 'warn');
        return { ok: false };
      }
      p.spells.push(sp.id);
      this.consumeItem(item.id, 1);
      this.spawnEffect(p.tx, p.ty, '10');
      this.addLog(`研讀魔法書成功！習得「${sp.name}」（Lv.${sp.level} 魔法）！`, 'gold');
      this.dirtySave = true;
      this.saveWorld(true);
      return { ok: true };
    }

    if (item.name === '瞬間移動的卷軸') {
      if (!getMapMeta(p.map).tele) {
        this.addLog(`【${MAP_NAMES[p.map] || p.map}】周圍的魔力干擾了空間，無法使用瞬間移動！`, 'warn');
        return { ok: false };
      }
      const cand =
        this.#findFreeWalkableTile(
          p.tx + randInt(-18, 18),
          p.ty + randInt(-18, 18),
          8,
          p.map,
        ) || this.#findRandomMapTile(p.map, null);
      if (cand) {
        this.consumeItem(item.id, 1);
        this.teleportTo(p.map, cand.x, cand.y, p.heading);
      }
      return { ok: true };
    }

    if (item.name === '傳送回家的卷軸') {
      if (!getMapMeta(p.map).recall) {
        this.addLog(`【${MAP_NAMES[p.map] || p.map}】無法使用傳送回家的卷軸！`, 'warn');
        return { ok: false };
      }
      const town = resolveHomeTown(p.map, p.tx, p.ty);
      this.consumeItem(item.id, 1);
      this.teleportTo(town.map, town.x, town.y, 4);
      return { ok: true };
    }

    if (item.name === '血盟傳送卷軸') {
      if (!p.clanName) {
        this.addLog('尚未加入血盟，請先找血盟執行人盧卡斯創立或加入血盟。', 'warn');
        return { ok: false };
      }
      if (!getMapMeta(p.map).recall) {
        this.addLog(`【${MAP_NAMES[p.map] || p.map}】無法使用血盟傳送卷軸！`, 'warn');
        return { ok: false };
      }
      const town = resolveHomeTown(p.map, p.tx, p.ty);
      this.consumeItem(item.id, 1);
      this.teleportTo(town.map, town.x, town.y, 4);
      this.addLog(`使用血盟傳送卷軸返回《${p.clanName}》${town.label}集結點！`, 'gold');
      return { ok: true };
    }

    if (item.name === '鑑定卷軸') {
      return this.identifyItem(null, item.id);
    }

    if (item.name === '解除咀咒的卷軸') {
      this.consumeItem(item.id, 1);
      this.curePoison();
      p.mp = clamp(p.mp + 15, 0, p.maxMp);
      this.spawnEffect(p.tx, p.ty, '871');
      this.addLog('使用解除咀咒的卷軸，清除異常狀態並回復 15 點魔力。', 'cyan');
      this.dirtySave = true;
      return { ok: true };
    }

    if (item.name === '復活卷軸') {
      this.consumeItem(item.id, 1);
      p.buffs.resurrect = now + 900000;
      this.spawnEffect(p.tx, p.ty, '169');
      this.addLog('獲得復活卷軸庇護（900 秒內陣亡將原地滿狀態重生且零經驗損失）！', 'gold');
      this.saveWorld(true);
      return { ok: true };
    }

    const enchantRule = this.getEnchantRule(item);
    if (enchantRule) {
      if (explicitTargetId) {
        return this.enchantItemWithScroll(item.id, explicitTargetId);
      }
      return {
        ok: true,
        openModal: 'inventory',
        enterEnchant: {
          scrollId: item.id,
          scrollName: item.name,
          rule: enchantRule,
        },
      };
    }

    if (item.name === '內掛符石' || item.name === '喝水符石') {
      const enabled = this.toggleAutoHunt(
        `啟動自動練功 (${MAP_NAMES[p.map]} ${p.tx},${p.ty}，半徑 ${p.autoConfig.radius} 格)`,
        '已關閉自動練功。',
      );
      return { ok: true, toggledAuto: true, enabled };
    }

    if (item.name === '磨刀石') {
      const damaged = this.getDamagedGear({ minBroken: 1 });
      if (!damaged.length) {
        this.addLog('武器與防具皆完好無損，無需使用磨刀石。', 'info');
        return { ok: false, reason: 'none' };
      }
      const target = damaged[0];
      const leftCount = Math.max(0, (item.count || 1) - 1);
      this.consumeItem(item.id, 1);
      this.#finishGearRepair([target], `使用磨刀石修復了 ${target.name}（剩餘磨刀石 ${leftCount} 個）。`);
      return { ok: true, repaired: 1 };
    }

    this.addLog(`使用了 ${item.name}。`, 'info');
    return { ok: true };
  }

  #startPlayerSpellAnim(now) {
    const p = this.player;
    p.animState = 'spell';
    p.animStartedAt = now;
    p.animDurationMs = 540;
    p.animStiffUntil = now + 260;
  }

  castSpell(spellId, explicitTarget = null) {
    const spell = (this.worldData.spells || []).find((s) => s.id === Number(spellId));
    if (!spell) return false;
    const p = this.player;
    const now = performance.now();
    if (p.lastSpellAt > 0 && now - p.lastSpellAt < Math.max(550, spell.delay || 750)) return false;

    const abilities = p.abilities || computeDerivedAbilities({
      classId: p.classId,
      level: p.level,
      stats: p.stats,
      effStats: {
        str: p.effStr ?? p.stats.str,
        dex: p.effDex ?? p.stats.dex,
        con: p.effCon ?? p.stats.con,
        wis: p.effWis ?? p.stats.wis,
        int: p.effInt ?? p.stats.int,
        cha: p.effCha ?? p.stats.cha,
      },
      birthStats: p.birthStats || p.stats,
    });
    const effInt = p.effInt ?? p.stats.int;
    const effWis = p.effWis ?? p.stats.wis;
    const rawMp = Number(spell.mp || 0);
    const mpCost = rawMp <= 0 ? 0 : Math.max(1, rawMp - getSpellMpDiscount(effInt, spell.level || 1, abilities.mpReduce || 0));

    if (p.mp < mpCost) {
      this.addLog(`魔力不足（需要 MP ${mpCost}），無法施放 ${spell.name}。`, 'warn');
      return false;
    }

    // 治療 / 防禦 / 傳送類
    if (spell.name.includes('治癒術')) {
      const baseHeal = randInt(spell.minDmg || 10, spell.maxDmg || 25) + Math.floor(effInt * 0.8) + abilities.magicDmg;
      p.mp -= mpCost;
      p.hp = clamp(p.hp + baseHeal, 1, p.maxHp);
      p.lastSpellAt = now;
      this.#startPlayerSpellAnim(now);
      this.spawnEffect(p.tx, p.ty, spell.effect || 744);
      this.spawnFloatingText(p.tx, p.ty, `+${baseHeal}`, '#6cf296');
      this.addLog(`施放 ${spell.name}，回復 ${baseHeal} 點體力。`, 'cyan');
      this.dirtySave = true;
      return true;
    }

    if (spell.name === '保護罩' || spell.name === '鎧甲護持') {
      p.mp -= mpCost;
      p.lastSpellAt = now;
      this.#startPlayerSpellAnim(now);
      if (spell.name === '保護罩') p.buffs.shield = now + 600000;
      else p.buffs.blessedArmor = now + 600000;
      this.recomputePlayerStats();
      this.spawnEffect(p.tx, p.ty, spell.effect || 221);
      this.addLog(`施放 ${spell.name}，防禦力獲得提升。`, 'cyan');
      this.saveWorld(true);
      return true;
    }

    if (spell.name === '指定傳送') {
      if (!getMapMeta(p.map).tele) {
        this.addLog(`【${MAP_NAMES[p.map] || p.map}】無法施放指定傳送魔法！`, 'warn');
        return false;
      }
      const cand = this.#findFreeWalkableTile(
        p.tx + randInt(-14, 14),
        p.ty + randInt(-14, 14),
        8,
        p.map,
      );
      p.mp -= mpCost;
      p.lastSpellAt = now;
      if (cand) this.teleportTo(p.map, cand.x, cand.y, p.heading);
      return true;
    }

    if (spell.name === '日光術') {
      p.mp -= mpCost;
      p.lastSpellAt = now;
      p.buffs.light = now + 600000;
      this.spawnEffect(p.tx, p.ty, 169);
      this.addLog('周圍散發出柔和的白晝光芒。', 'info');
      this.saveWorld(true);
      return true;
    }

    if (spell.name === '解毒術') {
      p.mp -= mpCost;
      p.lastSpellAt = now;
      this.#startPlayerSpellAnim(now);
      const cured = this.curePoison();
      this.spawnEffect(p.tx, p.ty, spell.effect || 871);
      this.addLog(cured ? '施放解毒術，體內毒素已完全淨化。' : '施放解毒術（目前未處於中毒狀態）。', 'cyan');
      this.saveWorld(true);
      return true;
    }

    if (spell.name === '神聖武器' || spell.name === '擬似魔法武器') {
      p.mp -= mpCost;
      p.lastSpellAt = now;
      this.#startPlayerSpellAnim(now);
      p.buffs.holyWeapon = now + 600000;
      this.recomputePlayerStats();
      this.spawnEffect(p.tx, p.ty, spell.effect || 747);
      this.addLog(`施放 ${spell.name}，武器蘊含神聖魔力（命中／傷害提升）。`, 'cyan');
      this.saveWorld(true);
      return true;
    }

    // 表格驅動輔助／強化魔法（通暢氣脈術、體魄強健術、加速術、負重強化、魔法屏障、冥想術、祝福魔法武器）
    const buffCfg = STAT_BUFF_SPELLS[spell.id];
    if (buffCfg) {
      p.mp -= mpCost;
      p.lastSpellAt = now;
      this.#startPlayerSpellAnim(now);
      p.buffs[buffCfg.key] = now + buffCfg.sec * 1000;
      this.recomputePlayerStats();
      this.spawnEffect(p.tx, p.ty, spell.effect || buffCfg.fx);
      this.addLog(buffCfg.msg, 'cyan');
      this.saveWorld(true);
      return true;
    }

    // 攻擊／減益／吸血法術
    const target =
      explicitTarget ||
      this.mobs.find((m) => m.id === p.targetId && m.hp > 0) ||
      this.#findNearestMob(9);
    if (!target) {
      this.addLog('找不到可施放法術的目標。', 'warn');
      return false;
    }
    if (tileDistance(p.tx, p.ty, target.tx, target.ty) > Math.max(7, spell.range || 7)) {
      this.addLog('距離目標太遠，無法施法。', 'warn');
      return false;
    }

    p.mp -= mpCost;
    p.lastSpellAt = now;
    p.targetId = target.id;
    p.heading = headingBetween(target.tx - p.tx, target.ty - p.ty);
    this.#startPlayerSpellAnim(now);

    this.spawnEffect(target.tx, target.ty, spell.effect || 167);

    // 特殊控場／吸魂／不死系審判魔法
    if (spell.id === 18) {
      // 起死回生術：對不死系高額爆傷或超渡
      if (UNDEAD_MOBS.has(target.name)) {
        const turnChance = clamp(0.32 + ((effWis + effInt - 20) * 0.025), 0.25, 0.72);
        if (Math.random() < turnChance) {
          this.spawnFloatingText(target.tx, target.ty - 1, 'TURN UNDEAD!', '#fde68a');
          this.addLog(`起死回生術超渡了不死系的 ${target.name}！`, 'gold');
          this.#applyDamageToMob(target, target.hp, spell.name);
        } else {
          const holyDmg = Math.max(25, Math.round(target.maxHp * 0.45) + effInt * 2);
          this.#applyDamageToMob(target, holyDmg, spell.name);
        }
      } else {
        this.addLog(`${target.name} 並非不死系生物，起死回生術效果微弱。`, 'info');
        this.#applyDamageToMob(target, randInt(4, 9), spell.name);
      }
      this.dirtySave = true;
      return true;
    }

    if (spell.id === 29) {
      target.slowUntil = now + 18000;
      target.aggroTarget = true;
      this.spawnFloatingText(target.tx, target.ty, '緩速！', '#7dd3fc');
      this.addLog(`對 ${target.name} 施放緩速術，其移動與攻速減半。`, 'cyan');
      this.dirtySave = true;
      return true;
    }

    if (spell.id === 33) {
      target.paralyzeUntil = now + 4500;
      target.aggroTarget = true;
      this.spawnFloatingText(target.tx, target.ty, '麻痺！', '#f472b6');
      this.addLog(`對 ${target.name} 施放木乃伊的詛咒，目標暫時麻痺無法動彈！`, 'cyan');
      this.dirtySave = true;
      return true;
    }

    if (spell.id === 44) {
      target.slowUntil = 0;
      target.paralyzeUntil = 0;
      this.curePoison('魔法相消術順道淨化了體內毒素。');
      this.spawnFloatingText(target.tx, target.ty, 'DISPEL', '#a5b4fc');
      this.addLog(`對 ${target.name} 施放魔法相消術，驅散一切增益與異常。`, 'cyan');
      this.dirtySave = true;
      return true;
    }

    const isMagicCrit = abilities.magicCritPct > 0 && Math.random() * 100 < abilities.magicCritPct;
    const rawMagicDmg =
      randInt(Math.max(4, spell.minDmg || 8), Math.max(8, spell.maxDmg || 16)) +
      Math.floor(effInt * 0.9) +
      abilities.magicDmg +
      (p.sp || 1) * 2;
    const dmg = Math.max(1, isMagicCrit ? Math.round(rawMagicDmg * 1.4) : rawMagicDmg);

    if (spell.id === 28) {
      // 吸血鬼之吻
      const drain = Math.max(4, Math.floor(dmg * 0.5));
      this.#applyDamageToMob(target, dmg, spell.name);
      p.hp = clamp(p.hp + drain, 1, p.maxHp);
      this.spawnFloatingText(p.tx, p.ty, `吸取 +${drain}`, '#6cf296');
      this.dirtySave = true;
      return true;
    }

    if (spell.id === 39) {
      // 魔力奪取
      const mpGain = randInt(6, 12);
      this.#applyDamageToMob(target, Math.max(3, Math.floor(dmg * 0.45)), spell.name);
      p.mp = clamp(p.mp + mpGain, 0, p.maxMp);
      this.spawnFloatingText(p.tx, p.ty, `MP +${mpGain}`, '#60a5fa');
      this.addLog(`從 ${target.name} 奪取了 ${mpGain} 點魔力。`, 'cyan');
      this.dirtySave = true;
      return true;
    }

    this.#applyDamageToMob(target, dmg, spell.name);

    // 範圍群攻法術（火球、地裂術、極光雷電、冰氣、聖潔）
    if (AOE_SPELLS.has(spell.id)) {
      const splashDmg = Math.max(4, Math.round(dmg * 0.72));
      for (const mob of this.mobs) {
        if (mob.id === target.id || mob.hp <= 0 || mob.isPassiveCritter) continue;
        if (tileDistance(target.tx, target.ty, mob.tx, mob.ty) <= 2) {
          this.spawnEffect(mob.tx, mob.ty, spell.effect || 167);
          this.#applyDamageToMob(mob, splashDmg, spell.name);
        }
      }
    }

    this.dirtySave = true;
    return true;
  }

  #findNearestMob(maxDist) {
    let best = null;
    let bestD = 1e9;
    for (const m of this.mobs) {
      if (m.hp <= 0) continue;
      const d = tileDistance(this.player.tx, this.player.ty, m.tx, m.ty);
      if (d <= maxDist && d < bestD) {
        bestD = d;
        best = m;
      }
    }
    return best;
  }

  restAtInn(npc) {
    const p = this.player;
    const fee = 30;
    if (p.gold < fee) {
      this.addLog(`住店休息需要 ${fee} 金幣，目前金幣不足。`, 'warn');
      return false;
    }
    p.gold -= fee;
    p.hp = p.maxHp;
    p.mp = p.maxMp;
    p.food = Math.max(p.food ?? 80, 95);
    this.curePoison();
    this.recomputePlayerStats();
    this.spawnEffect(p.tx, p.ty, '751');
    this.audio.playSound(103, 0.35);
    this.addLog(`在 ${npc?.name || '旅店'} 休息恢復體力、魔力與毒素（花費 ${fee} 金幣）。`, 'gold');
    this.saveWorld(true);
    return true;
  }

  learnSpellFromTeacher(spellId, teacherName = '導師') {
    const p = this.player;
    const sid = Number(spellId);
    const entry = TEACHER_SPELLS.find((t) => t.id === sid);
    const sp = (this.worldData.spells || []).find((s) => s.id === sid);
    if (!entry || !sp) return false;
    if (p.spells.includes(sid)) {
      this.addLog(`你已經學會【${sp.name}】了。`, 'info');
      return false;
    }
    if (!entry.classes.includes(p.classId)) {
      this.addLog(`目前職業無法向 ${teacherName} 修習【${sp.name}】。`, 'warn');
      return false;
    }
    if (p.level < entry.minLv) {
      this.addLog(`需要達到 Lv.${entry.minLv} 才能修習【${sp.name}】。`, 'warn');
      return false;
    }
    if (p.gold < entry.price) {
      this.addLog(`學費不足（需要 ${entry.price} 金幣）。`, 'warn');
      return false;
    }
    p.gold -= entry.price;
    p.spells.push(sid);
    this.spawnEffect(p.tx, p.ty, '167');
    this.audio.playSound(104, 0.38);
    this.addLog(`向 ${teacherName} 習得魔法【${sp.name}】（花費 ${entry.price} 金幣）！`, 'gold');
    this.saveWorld(true);
    return true;
  }

  #countInventoryItem(itemName) {
    return this.player.inventory
      .filter((i) => i.name === itemName && !i.equipped)
      .reduce((acc, i) => acc + i.count, 0);
  }

  #consumeMaterial(itemName, qty) {
    let rem = qty;
    const matches = this.player.inventory.filter((i) => i.name === itemName && !i.equipped);
    for (const item of matches) {
      if (rem <= 0) break;
      const take = Math.min(rem, item.count);
      this.consumeItem(item.id, take);
      rem -= take;
    }
    return rem <= 0;
  }

  craftItem(recipeIdx) {
    const p = this.player;
    const recipe = CRAFT_RECIPES[Number(recipeIdx)];
    if (!recipe) return false;
    if (p.gold < recipe.adena) {
      this.addLog(`金幣不足（需要 ${recipe.adena} 金幣）。`, 'warn');
      return false;
    }
    for (const [matName, need] of recipe.mats) {
      if (this.#countInventoryItem(matName) < need) {
        this.addLog(`材料不足：需要 ${matName} x${need}。`, 'warn');
        return false;
      }
    }
    if (!this.addItemToInventory(recipe.output, recipe.count || 1, 0)) {
      return false;
    }
    p.gold -= recipe.adena;
    for (const [matName, need] of recipe.mats) {
      this.#consumeMaterial(matName, need);
    }
    this.spawnEffect(p.tx, p.ty, '751');
    this.audio.playSound(105, 0.38);
    this.recomputePlayerStats();
    this.addLog(`向 ${recipe.npc} 委託製作完成！獲得【${recipe.output}】！`, 'gold');
    this.saveWorld(true);
    return true;
  }

  getEnchantRule(scrollItem) {
    if (!scrollItem) return null;
    if (scrollItem.name === '對武器施法的卷軸') return { kind: 'weapon', types: null, label: '武器' };
    if (scrollItem.name === '對盔甲施法的卷軸') return { kind: 'armor', types: null, label: '防具' };
    return SKELETON_ENCHANT_MAP[scrollItem.name] || null;
  }

  validateEnchantTarget(scrollItem, targetItem) {
    const rule = this.getEnchantRule(scrollItem);
    if (!rule) return { ok: false, reason: '此物品不是強化卷軸。' };
    if (!targetItem) return { ok: false, reason: '找不到要強化的目標物品。' };
    if (targetItem.id === scrollItem.id) return { ok: false, reason: '不能對卷軸本身進行強化。' };

    const def = this.worldData.items[targetItem.name];
    if (!def || (def.kind !== 'weapon' && def.kind !== 'armor')) {
      return { ok: false, reason: `「${targetItem.name}」不是武器或防具，無法使用 ${scrollItem.name} 強化。` };
    }
    if (def.enchant === false) {
      return { ok: false, reason: `「${targetItem.name}」屬於不可強化裝備。` };
    }
    if (rule.kind === 'weapon' && def.kind !== 'weapon') {
      return { ok: false, reason: `【${scrollItem.name}】僅能強化武器，無法強化防具「${targetItem.name}」。` };
    }
    if (rule.kind === 'armor' && def.kind !== 'armor') {
      return { ok: false, reason: `【${scrollItem.name}】僅能強化防具，無法強化武器「${targetItem.name}」。` };
    }
    if (rule.types && !rule.types.includes(def.type)) {
      return { ok: false, reason: `【${scrollItem.name}】僅限強化${rule.label}，無法用於「${targetItem.name}」。` };
    }
    return { ok: true, rule, def };
  }

  enchantItemWithScroll(scrollId, targetItemId) {
    const p = this.player;
    const scrollItem = p.inventory.find((i) => i.id === scrollId && i.count > 0);
    if (!scrollItem) {
      this.addLog('強化卷軸不存在或已消耗殆盡。', 'warn');
      return { ok: false, reason: '強化卷軸不存在或已消耗殆盡。' };
    }
    const targetItem = p.inventory.find((i) => i.id === targetItemId);
    const check = this.validateEnchantTarget(scrollItem, targetItem);
    if (!check.ok) {
      this.addLog(check.reason, 'warn');
      return { ok: false, reason: check.reason };
    }
    return this.#applyEnchantScroll(scrollItem, check.rule, targetItem);
  }

  #applyEnchantScroll(scrollItem, rule, explicitTarget = null) {
    const p = this.player;
    const target =
      explicitTarget ||
      p.inventory.find((i) => {
        if (!i.equipped) return false;
        const d = this.worldData.items[i.name];
        if (!d || d.kind !== rule.kind) return false;
        if (rule.types && !rule.types.includes(d.type)) return false;
        return d.enchant !== false;
      });
    if (!target) {
      const msg = `請點選背包內可強化的${rule.label}（或先裝備後再使用 ${scrollItem.name}）。`;
      this.addLog(msg, 'warn');
      return { ok: false, reason: msg };
    }
    const safe = this.worldData.items[target.name]?.safe ?? (rule.kind === 'weapon' ? 6 : 4);
    const successChance = rule.types ? 0.55 : 0.45;
    const ok = (target.plus || 0) < safe || Math.random() < successChance;
    this.consumeItem(scrollItem.id, 1);
    if (ok) {
      target.plus = (target.plus || 0) + 1;
      target.identified = true;
      this.spawnEffect(p.tx, p.ty, '10');
      this.addLog(`你的 ${target.name} 閃耀魔光，強化成功（+${target.plus}）！`, 'gold');
    } else {
      const idx = p.inventory.findIndex((i) => i.id === target.id);
      if (idx !== -1) p.inventory.splice(idx, 1);
      this.addLog(`強化失敗，${target.name} 碎裂化作光粉消逝了！`, 'danger');
    }
    this.recomputePlayerStats();
    this.dirtySave = true;
    this.saveWorld(true);
    return {
      ok: true,
      success: ok,
      destroyed: !ok,
      targetId: target.id,
      newPlus: ok ? target.plus : 0,
    };
  }

  identifyItem(targetId = null, scrollItemId = null) {
    const p = this.player;
    const scroll = scrollItemId
      ? p.inventory.find((i) => i.id === scrollItemId)
      : p.inventory.find((i) => i.name === '鑑定卷軸' && i.count > 0);
    if (!scroll) {
      this.addLog('背包中沒有鑑定卷軸。', 'warn');
      return { ok: false };
    }
    const target = targetId
      ? p.inventory.find((i) => i.id === targetId)
      : p.inventory.find((i) => !i.identified) ||
        p.inventory.find((i) => {
          const d = this.worldData.items[i.name];
          return d && (d.kind === 'weapon' || d.kind === 'armor');
        });
    if (!target) {
      this.addLog('背包內沒有可鑑定的裝備道具。', 'warn');
      return { ok: false };
    }
    this.consumeItem(scroll.id, 1);
    target.identified = true;
    const d = this.worldData.items[target.name] || {};
    const detail =
      d.kind === 'weapon'
        ? `攻擊 ${d.small}/${d.large} · 安定值 +${d.safe ?? 6}${target.brokenCount ? ` · 受損 -${target.brokenCount}` : ''}`
        : `AC -${(d.ac || 0) + (target.plus || 0)} · 安定值 +${d.safe ?? 4}`;
    this.spawnEffect(p.tx, p.ty, '190');
    this.addLog(`鑑定完成：【${target.plus ? `+${target.plus} ` : ''}${target.name}】（${detail}）。`, 'gold');
    this.dirtySave = true;
    return { ok: true, itemId: target.id };
  }

  applyPolymorph(formId, scrollItemId = null) {
    const p = this.player;
    const form = MORPH_FORMS.find((f) => f.id === formId);
    if (!form) return { ok: false };
    if (p.level < form.minLv && form.gfx) {
      this.addLog(`需達到 Lv.${form.minLv} 才能變身為 ${form.label}。`, 'warn');
      return { ok: false };
    }
    if (form.id === 'revert') {
      p.buffs.poly = 0;
      p.polyGfx = null;
      p.polyName = '';
      p.polyBonus = null;
      this.recomputePlayerStats();
      this.spawnEffect(p.tx, p.ty, '10');
      this.addLog('已解除變身狀態，恢復原有造型。', 'info');
      this.saveWorld(true);
      return { ok: true };
    }
    const scroll = scrollItemId
      ? p.inventory.find((i) => i.id === scrollItemId)
      : p.inventory.find((i) => i.name === '變形卷軸' && i.count > 0);
    if (!scroll) {
      this.addLog('背包中已無變形卷軸。', 'warn');
      return { ok: false };
    }
    this.consumeItem(scroll.id, 1);
    p.buffs.poly = performance.now() + 600000;
    p.polyGfx = form.gfx;
    p.polyName = form.label;
    p.polyBonus = { atkMult: form.atkMult, dmg: form.dmg, ac: form.ac, sp: form.sp };
    this.sprites.preloadActor(form.gfx);
    this.recomputePlayerStats();
    this.spawnEffect(p.tx, p.ty, '10');
    this.addLog(`變身術生效！化身為【${form.label}】（${form.desc}）！`, 'gold');
    this.saveWorld(true);
    return { ok: true, polyName: form.label, polyGfx: form.gfx };
  }

  getDamagedGear({ minBroken = 1, equippedOnly = false } = {}) {
    const thr = Math.max(1, Number(minBroken) || 1);
    return (this.player?.inventory || [])
      .filter((i) => (i.brokenCount || 0) >= thr && (!equippedOnly || i.equipped))
      .sort((a, b) => ((b.equipped ? 1 : 0) - (a.equipped ? 1 : 0)) || ((b.brokenCount || 0) - (a.brokenCount || 0)));
  }

  #finishGearRepair(items, logText, logType = 'gold', fx = '751') {
    const p = this.player;
    for (const it of items) it.brokenCount = 0;
    this.recomputePlayerStats();
    this.spawnEffect(p.tx, p.ty, fx);
    this.audio.playSound(105, 0.35);
    if (logText) this.addLog(logText, logType);
    this.saveWorld(true);
  }

  repairWeapons() {
    const p = this.player;
    const damaged = this.getDamagedGear({ minBroken: 1 });
    if (!damaged.length) {
      this.addLog('你的武器與裝備完好無損，無須修理。', 'info');
      return { ok: false, count: 0 };
    }
    const totalBreak = damaged.reduce((s, i) => s + (i.brokenCount || 0), 0);
    const fee = Math.max(20, totalBreak * 30);
    if (p.gold < fee) {
      this.addLog(`修理費用需要 ${fee} 金幣，目前金幣不足。`, 'warn');
      return { ok: false };
    }
    p.gold -= fee;
    this.#finishGearRepair(damaged, `多瑪敲打了你的武器一番，已全數修復完成（花費 ${fee} 金幣）！`, 'gold');
    return { ok: true, fee, repaired: damaged.length };
  }

  autoRepairGear(cfg = this.player?.autoConfig) {
    const p = this.player;
    if (!p || !cfg || cfg.autoRepairGear === false) {
      return { ok: false, reason: 'disabled' };
    }
    const threshold = Math.max(1, Math.min(10, Number(cfg.autoRepairThreshold) || 1));
    const damaged = this.getDamagedGear({ minBroken: threshold });
    if (!damaged.length) {
      return { ok: false, reason: 'none' };
    }

    const mode = cfg.autoRepairMode || 'auto';
    if (mode !== 'gold') {
      const toRepair = [];
      let used = 0;
      for (const target of damaged) {
        const stone = p.inventory.find((i) => i.name === '磨刀石' && (i.count || 0) > 0);
        if (!stone) break;
        this.consumeItem(stone.id, 1);
        toRepair.push(target);
        used += 1;
      }
      if (toRepair.length > 0) {
        const names = toRepair.map((d) => d.name).join('、');
        const left = p.inventory.filter((i) => i.name === '磨刀石').reduce((s, i) => s + (i.count || 0), 0);
        this.#finishGearRepair(
          toRepair,
          `【內掛】自動使用磨刀石修復了【${names}】（消耗 ${used} 個，剩餘 ${left} 個）。`,
          'gold',
        );
        return { ok: true, mode: 'whetstone', used, repaired: toRepair.length };
      }
      if (mode === 'whetstone') {
        return { ok: false, reason: 'no_whetstone' };
      }
    }

    const totalBreak = damaged.reduce((s, i) => s + (i.brokenCount || 0), 0);
    const fee = Math.max(20, totalBreak * 30);
    if (p.gold < fee) {
      return { ok: false, reason: 'no_gold', fee };
    }
    p.gold -= fee;
    const names = damaged.map((d) => d.name).join('、');
    this.#finishGearRepair(damaged, `【內掛】遠程鍛造自動修復了【${names}】（花費 ${fee} 金幣）。`, 'gold');
    return { ok: true, mode: 'gold', fee, repaired: damaged.length };
  }

  adoptPet(petId) {
    const p = this.player;
    const spec = PET_CATALOG.find((x) => x.id === petId);
    if (!spec) return false;
    if (p.gold < spec.price) {
      this.addLog(`金幣不足，領養 ${spec.name} 需要 ${spec.price} 金幣。`, 'warn');
      return false;
    }
    p.gold -= spec.price;
    const px = p.tx > 1 ? p.tx - 1 : p.tx + 1;
    const py = p.ty;
    const wp = tileToWorld(px, py);
    p.pet = {
      id: spec.id,
      name: spec.name,
      gfx: spec.gfx,
      level: 1,
      hp: spec.baseHp,
      maxHp: spec.baseHp,
      exp: 0,
      dmg: spec.dmg,
      map: p.map,
      tx: px,
      ty: py,
      heading: p.heading,
      animState: 'idle',
      animStartedAt: 0,
      lastActAt: 0,
      worldX: wp.x,
      worldY: wp.y,
    };
    this.sprites.preloadActor(spec.gfx);
    this.spawnEffect(px, py, '751');
    this.audio.playSound(104, 0.35);
    this.addLog(`向寵物管理員詹森領養了忠誠夥伴【${spec.name}】！`, 'gold');
    this.saveWorld(true);
    return true;
  }

  healPet() {
    const p = this.player;
    if (!p.pet) return false;
    if (p.gold < 50) {
      this.addLog('治療與餵養寵物需要 50 金幣。', 'warn');
      return false;
    }
    p.gold -= 50;
    p.pet.hp = p.pet.maxHp;
    this.spawnEffect(p.pet.tx, p.pet.ty, '744');
    this.addLog(`${p.pet.name} 體力已完全恢復！`, 'gold');
    this.saveWorld(true);
    return true;
  }

  dismissPet() {
    const p = this.player;
    if (!p.pet) return false;
    const name = p.pet.name;
    p.pet = null;
    this.addLog(`已將夥伴 ${name} 交還寵物管理員照料。`, 'info');
    this.saveWorld(true);
    return true;
  }

  createOrJoinClan(rawName) {
    const p = this.player;
    const clanName = String(rawName || '').trim().slice(0, 14);
    if (!clanName) {
      this.addLog('請輸入有效的血盟名稱。', 'warn');
      return false;
    }
    if (p.gold < 1000) {
      this.addLog('創立血盟需要 1,000 金幣登記費。', 'warn');
      return false;
    }
    p.gold -= 1000;
    p.clanName = clanName;
    this.spawnEffect(p.tx, p.ty, '10');
    this.audio.playSound('/level-up-v1/517.wav', 0.35);
    this.addLog(`血盟執行人高聲宣告：血盟《${clanName}》正式在說話之島成立！`, 'gold');
    this.saveWorld(true);
    return true;
  }

  leaveClan() {
    const p = this.player;
    if (!p.clanName) return false;
    const old = p.clanName;
    p.clanName = '';
    this.addLog(`已退出血盟《${old}》。`, 'info');
    this.saveWorld(true);
    return true;
  }

  prayAtStatue(npc) {
    const cfg = STATUE_BLESSINGS[npc?.name];
    if (!cfg) return false;
    const p = this.player;
    const now = performance.now();
    p.buffs[cfg.key] = now + cfg.sec * 1000;
    if (npc.name === '巴打的雕像') p.buffs.shield = now + cfg.sec * 1000;
    if (npc.name === '吉魔的雕像') p.buffs.bluePotion = now + cfg.sec * 1000;
    p.hp = clamp(p.hp + Math.round(p.maxHp * 0.4), 1, p.maxHp);
    p.mp = clamp(p.mp + Math.round(p.maxMp * 0.4), 0, p.maxMp);
    this.recomputePlayerStats();
    this.spawnEffect(p.tx, p.ty, cfg.fx);
    this.addLog(cfg.msg, 'gold');
    this.saveWorld(true);
    return true;
  }

  setRemotePeers(peers = [], onlineCount = 1) {
    this.onlineCount = Math.max(1, Number(onlineCount || 1));
    const existingById = new Map(this.remotePeers.map((r) => [r.id, r]));
    const next = [];
    for (const raw of peers || []) {
      const prev = existingById.get(raw.id);
      const wp = tileToWorld(raw.tx, raw.ty);
      if (raw.gfx) this.sprites.preloadActor(raw.gfx);
      next.push({
        id: raw.id,
        charName: raw.charName || '冒險者',
        classId: raw.classId || 'royal',
        gfx: Number(raw.gfx || 0),
        clanName: raw.clanName || '',
        map: Number(raw.map || 0),
        tx: Number(raw.tx),
        ty: Number(raw.ty),
        heading: Number(raw.heading || 4),
        chatText: raw.chatText || '',
        worldX: prev ? prev.worldX : wp.x,
        worldY: prev ? prev.worldY : wp.y,
        targetWorldX: wp.x,
        targetWorldY: wp.y,
        animState: prev && (Math.abs(prev.worldX - wp.x) > 1 || Math.abs(prev.worldY - wp.y) > 1) ? 'walk' : 'idle',
      });
    }
    this.remotePeers = next;
  }

  #updateRemotePeers(dtMs) {
    const rate = Math.min(1, dtMs * 0.012);
    const now = performance.now();
    for (const peer of this.remotePeers) {
      const dx = peer.targetWorldX - peer.worldX;
      const dy = peer.targetWorldY - peer.worldY;
      if (Math.hypot(dx, dy) > 1.2) {
        peer.worldX += dx * rate;
        peer.worldY += dy * rate;
        if (peer.animState !== 'walk') peer.animStartedAt = now;
        peer.animState = 'walk';
      } else {
        peer.worldX = peer.targetWorldX;
        peer.worldY = peer.targetWorldY;
        peer.animState = 'idle';
      }
    }
  }

  #updatePet(dtMs, now) {
    const p = this.player;
    const pet = p.pet;
    if (!pet || pet.hp <= 0) return;

    if (pet.map !== p.map) {
      pet.map = p.map;
      pet.tx = p.tx;
      pet.ty = p.ty;
      const wp = tileToWorld(pet.tx, pet.ty);
      pet.worldX = wp.x;
      pet.worldY = wp.y;
      pet.animState = 'idle';
      return;
    }

    const mobTarget = p.targetId ? this.mobs.find((m) => m.id === p.targetId && m.hp > 0) : null;
    const goalX = mobTarget ? mobTarget.tx : (p.tx > 1 ? p.tx - 1 : p.tx + 1);
    const goalY = mobTarget ? mobTarget.ty : p.ty;
    const distToGoal = tileDistance(pet.tx, pet.ty, goalX, goalY);
    const targetWp = tileToWorld(pet.tx, pet.ty);

    // 距離玩家超過 10 格自動瞬移回身邊
    if (tileDistance(pet.tx, pet.ty, p.tx, p.ty) > 10) {
      pet.tx = p.tx > 1 ? p.tx - 1 : p.tx + 1;
      pet.ty = p.ty;
      const wp = tileToWorld(pet.tx, pet.ty);
      pet.worldX = wp.x;
      pet.worldY = wp.y;
      pet.animState = 'idle';
      return;
    }

    if (mobTarget && tileDistance(pet.tx, pet.ty, mobTarget.tx, mobTarget.ty) <= 1) {
      pet.heading = headingBetween(mobTarget.tx - pet.tx, mobTarget.ty - pet.ty);
      if (now - (pet.lastActAt || 0) >= 1050) {
        pet.lastActAt = now;
        pet.animState = 'attack';
        pet.animStartedAt = now;
        pet.animDurationMs = 520;
        const [lo, hi] = pet.dmg || [5, 11];
        const dmg = randInt(lo + pet.level, hi + pet.level * 2);
        this.audio.playSound(246, 0.2);
        this.#applyDamageToMob(mobTarget, dmg, '寵物');
      } else if (pet.animState === 'attack' && now - (pet.animStartedAt || 0) >= (pet.animDurationMs || 520)) {
        pet.animState = 'idle';
      }
      pet.worldX += (targetWp.x - pet.worldX) * Math.min(1, dtMs * 0.015);
      pet.worldY += (targetWp.y - pet.worldY) * Math.min(1, dtMs * 0.015);
      return;
    }

    if (distToGoal > (mobTarget ? 1 : 0) && now - (pet.lastActAt || 0) >= 240) {
      pet.lastActAt = now;
      const step = this.#bestStepToward({ tx: pet.tx, ty: pet.ty, map: pet.map }, goalX, goalY, new Set([`${p.tx},${p.ty}`]));
      if (step) {
        pet.heading = headingBetween(step.x - pet.tx, step.y - pet.ty);
        pet.tx = step.x;
        pet.ty = step.y;
        const wasWalking = pet.animState === 'walk';
        pet.animState = 'walk';
        if (!wasWalking) pet.animStartedAt = now;
      }
    }

    const nextWp = tileToWorld(pet.tx, pet.ty);
    pet.worldX += (nextWp.x - pet.worldX) * Math.min(1, dtMs * 0.012);
    pet.worldY += (nextWp.y - pet.worldY) * Math.min(1, dtMs * 0.012);
    const stillSliding = Math.hypot(nextWp.x - pet.worldX, nextWp.y - pet.worldY) > 1.5;
    if (!stillSliding && pet.animState === 'walk') {
      pet.animState = 'idle';
    } else if (pet.animState === 'attack' && now - (pet.animStartedAt || 0) >= (pet.animDurationMs || 520)) {
      pet.animState = 'idle';
    }
  }

  buyFromShop(npcName, shopEntry, qty = 1) {
    const cleanQty = Math.floor(Number(qty));
    if (!Number.isFinite(cleanQty) || cleanQty < 1) return false;
    const clampedQty = Math.min(9999, cleanQty);
    const total = shopEntry.price * clampedQty;
    if (this.player.gold < total) {
      this.addLog(`金幣不足（需要 ${total} 金幣）。`, 'warn');
      return false;
    }
    const def = this.worldData.items[shopEntry.item];
    const totalUnits = Math.max(1, (shopEntry.count || 1) * clampedQty);
    if (def?.stack || shopEntry.item === '金幣') {
      if (!this.addItemToInventory(shopEntry.item, totalUnits, shopEntry.plus || 0)) {
        return false;
      }
    } else {
      if (this.player.inventory.length + totalUnits > 120) {
        this.addLog('背包空間不足，無法購買這麼多裝備。', 'warn');
        return false;
      }
      for (let i = 0; i < totalUnits; i += 1) {
        if (!this.addItemToInventory(shopEntry.item, 1, shopEntry.plus || 0)) {
          return false;
        }
      }
    }
    this.player.gold -= total;
    this.addLog(`向 ${npcName} 購買了 ${shopEntry.item} x${totalUnits}（花費 ${total} 金幣）。`, 'gold');
    this.audio.playSound(104, 0.35);
    this.dirtySave = true;
    this.saveWorld(true);
    return true;
  }

  sellToShop(itemId, qty = 1) {
    const item = this.player.inventory.find((i) => i.id === itemId);
    if (!item || item.equipped) {
      this.addLog('無法販售已裝備或不存在的道具。', 'warn');
      return false;
    }
    const def = this.worldData.items[item.name];
    const unit = Math.max(1, Math.floor((def?.price || 10) * 0.5));
    const sellCount = Math.min(qty, item.count);
    const earned = unit * sellCount;
    this.consumeItem(item.id, sellCount);
    this.player.gold += earned;
    this.addLog(`販售了 ${item.name} x${sellCount}，獲得 ${earned} 金幣。`, 'gold');
    this.audio.playSound(103, 0.35);
    this.dirtySave = true;
    this.saveWorld(true);
    return true;
  }

  depositToWarehouse(itemId) {
    const item = this.player.inventory.find((i) => i.id === itemId);
    if (!item || item.equipped) return false;
    if (this.player.gold < 30) {
      this.addLog('領取或寄存倉庫需要 30 金幣手續費。', 'warn');
      return false;
    }
    this.player.gold -= 30;
    const clone = { ...item, equipped: false };
    this.consumeItem(item.id, item.count);
    const def = this.worldData.items[clone.name];
    if (def?.stack) {
      const ex = this.warehouse.items.find((i) => i.name === clone.name);
      if (ex) ex.count += clone.count;
      else this.warehouse.items.push(clone);
    } else {
      this.warehouse.items.push(clone);
    }
    this.addLog(`已將 ${clone.name} x${clone.count} 存入矮人倉庫。`, 'info');
    this.dirtySave = true;
    this.saveWorld(true);
    return true;
  }

  withdrawFromWarehouse(itemId) {
    const idx = this.warehouse.items.findIndex((i) => i.id === itemId);
    if (idx === -1) return false;
    if (this.player.gold < 30) {
      this.addLog('從倉庫領取物品需要 30 金幣。', 'warn');
      return false;
    }
    const item = this.warehouse.items[idx];
    if (!this.addItemToInventory(item.name, item.count, item.plus || 0)) return false;
    this.player.gold -= 30;
    this.warehouse.items.splice(idx, 1);
    this.addLog(`已從倉庫取出 ${item.name} x${item.count}（扣除 30 金幣）。`, 'info');
    this.dirtySave = true;
    this.saveWorld(true);
    return true;
  }

  /**
   * 每個影格更新玩家移動/鎖定戰鬥、怪物 AI、投射物、回復與自動存檔。
   */
  step(dtMs, now) {
    this.#updatePlayer(dtMs, now);
    this.#updateMobs(dtMs, now);
    this.#updatePet(dtMs, now);
    this.#updateRemotePeers(dtMs);
    this.#updateProjectiles(dtMs, now);
    this.#cleanupVfx(now);
    this.#updateRegen(now);
    if (now - this.lastBuffSaveAt >= 5000) {
      const hasActiveBuff = Object.values(this.player?.buffs || {}).some((until) => Number(until) > now);
      if (hasActiveBuff) {
        this.dirtySave = true;
      } else {
        this.lastBuffSaveAt = now;
      }
    }
    this.saveWorld(false);
  }

  #stepEntityMovement(ent, speedTilesPerSec, dtMs) {
    if (!ent.moveTo) return false;
    ent.moveProgress += (dtMs / 1000) * speedTilesPerSec;
    if (ent.moveProgress >= 1) {
      ent.tx = ent.moveTo.x;
      ent.ty = ent.moveTo.y;
      const wp = tileToWorld(ent.tx, ent.ty);
      ent.worldX = wp.x;
      ent.worldY = wp.y;
      ent.moveFrom = null;
      ent.moveTo = null;
      ent.moveProgress = 0;
      return true;
    }
    const a = tileToWorld(ent.moveFrom.x, ent.moveFrom.y);
    const b = tileToWorld(ent.moveTo.x, ent.moveTo.y);
    ent.worldX = a.x + (b.x - a.x) * ent.moveProgress;
    ent.worldY = a.y + (b.y - a.y) * ent.moveProgress;
    return false;
  }

  #updatePlayer(dtMs, now) {
    const p = this.player;
    if (p.hp <= 0) return;

    const speedMult = this.#getSpeedMult(p, now, 1.32);
    p.walkRate = Math.min(1.45, Math.max(0.85, speedMult));

    if (p.moveTo) {
      if (p.animState !== 'walk') p.animStartedAt = now;
      p.animState = 'walk';
      const arrived = this.#stepEntityMovement(p, 4.2 * speedMult, dtMs);
      if (arrived) {
        this.dirtySave = true;
        if (this.checkPortalAtPlayer()) return;
      }
      return;
    }

    // 處理攻擊或施法動作（揮擊／收招流暢播完，硬直過後允許移動指令中斷收招）
    if (p.animState === 'attack' || p.animState === 'spell' || p.animState === 'damage') {
      const animDur = p.animDurationMs || 520;
      const stiffUntil = p.animStiffUntil || (p.animStartedAt + 300);
      if (now - p.animStartedAt < animDur) {
        if (!(p.path.length && now >= stiffUntil)) return;
      }
      p.animState = 'idle';
    }

    // 撿取預約
    if (p.pendingPickupId) {
      const drop = this.drops.find((d) => d.id === p.pendingPickupId);
      if (!drop) {
        p.pendingPickupId = null;
      } else if (tileDistance(p.tx, p.ty, drop.tx, drop.ty) <= 1) {
        p.pendingPickupId = null;
        this.pickupDrop(drop);
        return;
      }
    }

    // NPC 對話預約
    if (p.pendingInteractNpcId) {
      const npc = this.npcs.find((n) => n.id === p.pendingInteractNpcId);
      if (!npc) {
        p.pendingInteractNpcId = null;
      } else if (tileDistance(p.tx, p.ty, npc.x, npc.y) <= 2) {
        p.pendingInteractNpcId = null;
        p.onNpcReady?.(npc);
        return;
      }
    }

    // 木人訓練預約／自動揮擊（Lv.5 以下可取得經驗）
    if (p.pendingTrainNpcId) {
      const dummy = this.npcs.find((n) => n.id === p.pendingTrainNpcId && n.type === 'TrainingDummy');
      if (!dummy) {
        p.pendingTrainNpcId = null;
      } else {
        const reach = Math.max(2, p.attackRange || 1);
        if (tileDistance(p.tx, p.ty, dummy.x, dummy.y) <= reach) {
          p.path = [];
          this.hitTrainingDummy(dummy, now);
          return;
        }
        if (!p.path.length) {
          const blocked = this.getOccupiedTileSet();
          p.path = this.isoMap.findPath(p.tx, p.ty, dummy.x, dummy.y, p.map, blocked, 420);
        }
      }
    }

    // 鎖定目標自動追蹤或攻擊
    if (p.targetId) {
      const mob = this.mobs.find((m) => m.id === p.targetId && m.hp > 0);
      if (!mob) {
        p.targetId = null;
      } else {
        const dist = tileDistance(p.tx, p.ty, mob.tx, mob.ty);
        const staticSet = this.getStaticOccupiedTileSet();
        const hasLos =
          dist === 0 ||
          (dist === 1
            ? this.isoMap.canStep(p.tx, p.ty, mob.tx - p.tx, mob.ty - p.ty, p.map)
            : this.isoMap.hasStaticLineOfSight(p.tx, p.ty, mob.tx, mob.ty, p.map, { staticBlockedSet: staticSet }));

        if (dist <= p.attackRange && hasLos) {
          p.path = [];
          const cd = Math.round(700 / speedMult);
          if (now - p.lastAttackAt >= cd) {
            this.#performPlayerAttack(mob, now);
          }
          return;
        }

        const pathEnd = p.path[p.path.length - 1];
        const mobDrifted = pathEnd ? tileDistance(pathEnd.x, pathEnd.y, mob.tx, mob.ty) > Math.max(1, p.attackRange) : false;
        if (!p.path.length || mobDrifted) {
          let res = this.computeSmartPath(mob.tx, mob.ty, {
            excludeMobId: mob.id,
            goalRange: p.attackRange,
            requireLos: true,
          });
          if (!res.path.length && !res.reached) {
            res = this.computeSmartPath(mob.tx, mob.ty, {
              excludeMobId: mob.id,
              goalRange: 0,
              requireLos: false,
            });
          }
          p.path = res.path;
        }
      }
    }

    // 取下一步移動格
    if (p.path.length > 0) {
      const next = p.path.shift();
      const dx = next.x - p.tx;
      const dy = next.y - p.ty;
      const staticObs = this.isoMap.inspectStepObstacle(p.tx, p.ty, dx, dy, p.map, {
        staticBlockedSet: this.getStaticOccupiedTileSet(),
      });
      const blockingMob = !staticObs
        ? this.mobs.find((m) => m.hp > 0 && m.tx === next.x && m.ty === next.y)
        : null;

      if (!staticObs && !blockingMob) {
        p.lastMoveBlocked = null;
        p.moveFrom = { x: p.tx, y: p.ty };
        p.moveTo = { x: next.x, y: next.y };
        p.moveProgress = 0;
        p.heading = headingBetween(dx, dy);
        if (p.animState !== 'walk') p.animStartedAt = now;
        p.animState = 'walk';
        return;
      }

      p.lastMoveBlocked = staticObs
        ? {
            at: now,
            tx: next.x,
            ty: next.y,
            dx,
            dy,
            kind: staticObs.kind,
            label: staticObs.label,
            isMob: false,
            mobId: null,
          }
        : {
            at: now,
            tx: next.x,
            ty: next.y,
            dx,
            dy,
            kind: 'mob',
            label: blockingMob.name,
            isMob: true,
            mobId: blockingMob.id,
          };
      p.path = [];
    }

    p.animState = 'idle';
  }

  #performPlayerAttack(mob, now) {
    const p = this.player;
    const speedMult = p.walkRate || 1;
    const cd = Math.round(700 / speedMult);
    p.isHittingDummy = false;
    p.heading = headingBetween(mob.tx - p.tx, mob.ty - p.ty);
    p.lastAttackAt = now;
    p.animState = 'attack';
    p.animStartedAt = now;
    p.animDurationMs = Math.max(360, Math.round(cd * 0.9));
    p.animStiffUntil = now + Math.max(220, Math.round(cd * 0.44));

    if (p.weaponType === 'bow') {
      const arrow = p.inventory.find((i) => this.worldData.items[i.name]?.type === 'arrow' && i.count > 0);
      if (!arrow) {
        this.addLog('身上已無箭矢，無法使用弓箭攻擊！', 'warn');
        p.targetId = null;
        return;
      }
      this.consumeItem(arrow.id, 1);
      this.audio.playSound(248, 0.35);
      const from = tileToWorld(p.tx, p.ty);
      const to = tileToWorld(mob.tx, mob.ty);
      this.projectiles.push({
        id: `proj-${this.nextUid++}`,
        fromX: from.x,
        fromY: from.y,
        toX: to.x,
        toY: to.y,
        x: from.x,
        y: from.y,
        heading: p.heading,
        progress: 0,
        targetMobId: mob.id,
        dmg: this.#rollWeaponDamage(mob, arrow),
      });
      return;
    }

    this.audio.playSound(p.weaponType === 'dagger' ? 246 : 247, 0.32);
    if (
      p.weaponItem &&
      ARMOR_BREAK_MOBS.has(mob.name) &&
      (p.weaponItem.item.brokenCount || 0) < 10 &&
      Math.random() < 0.14
    ) {
      p.weaponItem.item.brokenCount = (p.weaponItem.item.brokenCount || 0) + 1;
      this.addLog(`擊中堅硬的 ${mob.name}，你的武器受損了（損壞度 ${p.weaponItem.item.brokenCount}），請找多瑪修理！`, 'warn');
      this.dirtySave = true;
    }
    const dmg = this.#rollWeaponDamage(mob, null);
    this.#applyDamageToMob(mob, dmg);
    if (dmg > 0) this.#applyMeleeWeaponSpecials(mob);
  }

  #applyMeleeWeaponSpecials(mob) {
    const p = this.player;
    const special = p.weaponItem?.def?.special;
    if (!special) return;
    if (special === 'mana_drain') {
      const drain = randInt(1, 3);
      const gain = Math.min(drain, Math.max(0, p.maxMp - p.mp));
      if (gain > 0) {
        p.mp += gain;
        this.spawnFloatingText(p.tx, p.ty, `+${gain} MP`, '#38bdf8');
        this.dirtySave = true;
      }
      return;
    }
    if (special === 'dk_fire' && mob.hp > 0 && Math.random() < 0.03) {
      const sunburst = (this.worldData.spells || []).find((s) => s.id === 46);
      const fireDmg = randInt(sunburst?.minDmg || 50, sunburst?.maxDmg || 70);
      this.spawnEffect(mob.tx, mob.ty, sunburst?.effect || 167);
      this.spawnFloatingText(mob.tx, mob.ty - 1, `烈炎術 -${fireDmg}`, '#fb923c');
      this.addLog(`${p.weaponItem.item.name}發動火屬性烈炎術，對 ${mob.name} 造成 ${fireDmg} 點傷害！`, 'gold');
      this.#applyDamageToMob(mob, fireDmg, '烈炎術');
    }
  }

  #rollWeaponDamage(mob, arrowItem) {
    const p = this.player;
    const abilities = p.abilities || computeDerivedAbilities({
      classId: p.classId,
      level: p.level,
      stats: p.stats,
      effStats: {
        str: p.effStr ?? p.stats.str,
        dex: p.effDex ?? p.stats.dex,
        con: p.effCon ?? p.stats.con,
        wis: p.effWis ?? p.stats.wis,
        int: p.effInt ?? p.stats.int,
        cha: p.effCha ?? p.stats.cha,
      },
      birthStats: p.birthStats || p.stats,
    });
    const isBow = p.weaponType === 'bow';
    const wDef = p.weaponItem?.def;
    const wPlus = p.weaponItem?.item?.plus || 0;
    const statHit = isBow ? abilities.bowHit : abilities.meleeHit;
    const equipHit = isBow ? (p.equipHitBow || 0) : (p.equipHitMelee || 0);
    const hitChance = clamp(
      0.74 + (p.level - mob.level) * 0.022 + statHit * 0.018 + ((wDef?.hit || 0) + equipHit) * 0.015 + Math.floor(wPlus / 2) * 0.01 + (mob.ac || 0) * 0.008,
      0.35,
      0.98,
    );
    if (Math.random() > hitChance) return 0;

    const brokenPenalty = p.weaponItem?.item?.brokenCount || 0;
    const lo = wDef ? Math.max(1, Number(wDef.small || 1)) : 2;
    const hi = wDef ? Math.max(lo, Number(wDef.large || lo)) : 5;
    const statBonus = isBow
      ? Math.max(0, abilities.bowDmg) + (arrowItem ? this.worldData.items[arrowItem.name]?.small || 3 : 0)
      : Math.max(-2, abilities.meleeDmg);
    const equipDmg = isBow ? (p.equipDmgBow || 0) : (p.equipDmgMelee || 0);
    const polyBonus = (p.buffs.poly || 0) > performance.now() ? (p.polyBonus?.dmg ?? 3) : 0;
    const holyBonus = (p.buffs.holyWeapon || 0) > performance.now() ? 2 : 0;
    let dmg = Math.max(1, randInt(lo, hi) + wPlus + statBonus + (wDef?.damage || 0) + equipDmg + polyBonus + holyBonus - brokenPenalty);
    if (!isBow && abilities.meleeCritPct > 0 && Math.random() * 100 < abilities.meleeCritPct) {
      dmg = Math.round(dmg * 1.5);
    }
    return dmg;
  }

  #applyDamageToMob(mob, dmg, spellName = '') {
    if (mob.hp <= 0) return;
    if (dmg <= 0) {
      this.spawnFloatingText(mob.tx, mob.ty, 'MISS', '#cbd5e1');
      return;
    }
    mob.hp = Math.max(0, mob.hp - dmg);
    mob.aggroTarget = true;
    mob.animState = 'damage';
    mob.animStartedAt = performance.now();
    mob.animDurationMs = 340;
    this.spawnFloatingText(mob.tx, mob.ty, `-${dmg}`, spellName ? '#ffe26a' : '#ff6b57');

    if (mob.hp <= 0) {
      this.#handleMobDeath(mob);
    }
  }

  #handleMobDeath(mob) {
    const p = this.player;
    mob.animState = 'die';
    mob.animStartedAt = performance.now();
    mob.dieAt = performance.now();
    mob.moveTo = null;
    p.targetId = null;

    this.audio.playSound(249, 0.32);

    // 經驗與正義值計算
    const gainedExp = Math.max(1, mob.exp);
    p.kills = (p.kills || 0) + 1;
    p.lawful = clamp(p.lawful + (mob.isPassiveCritter ? -15 : 8), -32768, 32767);
    this.addLog(`擊倒了 ${mob.name}（EXP +${gainedExp}）。`, 'info');
    this.spawnFloatingText(mob.tx, mob.ty, `EXP +${gainedExp}`, '#a7f3d0');

    // 說話之島初心者討伐懸賞里程碑
    if (p.quests && !p.quests.hunterDone && p.kills >= 5) {
      p.quests.hunterDone = true;
      p.gold += 150;
      this.addItemToInventory('紅色藥水', 5);
      this.addLog('【試煉達成】說話之島初階討伐（5 隻）！獲得 150 金幣與紅色藥水 x5！', 'gold');
    } else if (p.quests && !p.quests.slayerDone && p.kills >= 20) {
      p.quests.slayerDone = true;
      p.gold += 500;
      this.addItemToInventory('瞬間移動的卷軸', 3);
      this.addLog('【試煉達成】島嶼巡守獵人（20 隻）！獲得 500 金幣與瞬移卷軸 x3！', 'gold');
    }

    // 經驗累加與升級判定（與木人練習共用）
    const leveled = this.#grantExp(gainedExp);

    // 寵物戰後累積經驗與升等
    if (p.pet && p.pet.hp > 0) {
      p.pet.exp = (p.pet.exp || 0) + randInt(2, 5);
      while (p.pet.level < 30 && p.pet.exp >= p.pet.level * 12) {
        p.pet.level += 1;
        p.pet.maxHp += 12;
        p.pet.hp = p.pet.maxHp;
        this.spawnEffect(p.pet.tx, p.pet.ty, '751');
        this.addLog(`你的夥伴【${p.pet.name}】升到了 Lv.${p.pet.level}！`, 'gold');
      }
    }

    // 掉落物生成
    const dropPos = { x: mob.tx, y: mob.ty };
    if (mob.aden || !mob.isPassiveCritter) {
      const adenaCount = Math.max(4, Math.round(mob.level * randInt(4, 12)));
      this.#spawnDrop('金幣', adenaCount, dropPos.x, dropPos.y);
    }

    const mobDrops = this.worldData.drops[mob.name] || [];
    for (const d of mobDrops) {
      const rate = clamp(d.chance / 1000000, 0.04, 0.65);
      if (Math.random() < rate) {
        const cnt = randInt(d.min, d.max);
        this.#spawnDrop(d.item, cnt, dropPos.x + randInt(-1, 1), dropPos.y + randInt(-1, 1));
        break;
      }
    }

    // 重生排程
    this.respawnQueue.push({
      spawn: mob.spawn,
      respawnAt: performance.now() + (mob.spawn?.respawnMs || 25000),
    });

    this.recomputePlayerStats();
    this.dirtySave = true;
    if (leveled) this.saveWorld(true);
  }

  #spawnDrop(itemName, count, tx, ty) {
    const def = this.worldData.items[itemName];
    if (!def) return;
    let dx = tx;
    let dy = ty;
    if (!this.isoMap.isWalkableTile(dx, dy, this.player.map)) {
      dx = this.player.tx;
      dy = this.player.ty;
    }
    const wp = tileToWorld(dx, dy);
    this.drops.push({
      id: `dr-${this.nextUid++}`,
      item: itemName,
      count,
      plus: 0,
      groundGfx: def.groundGfx ?? 7,
      map: this.player.map,
      tx: dx,
      ty: dy,
      worldX: wp.x,
      worldY: wp.y,
      bornAt: performance.now(),
    });
    if (this.drops.length > 45) this.drops.shift();
  }

  #updateMobs(dtMs, now) {
    for (const npc of this.npcs) {
      if (npc.animState === 'damage' && now - (npc.animStartedAt || 0) >= 340) {
        npc.animState = 'idle';
      }
    }

    const p = this.player;
    const playerInSafety = isSafetyZone(p.map, p.tx, p.ty, this.isoMap);
    const occupied = new Set([`${p.tx},${p.ty}`, ...this.npcs.map((n) => `${n.x},${n.y}`)]);
    for (const m of this.mobs) {
      if (m.hp > 0) occupied.add(`${m.tx},${m.ty}`);
    }

    // 移除屍體並處理重生
    this.mobs = this.mobs.filter((m) => m.hp > 0 || now - m.dieAt < 1800);
    while (this.respawnQueue.length && this.respawnQueue[0].respawnAt <= now) {
      const entry = this.respawnQueue.shift();
      const def = this.worldData.monsters[entry.spawn?.name];
      if (def) this.#spawnMobFromDef(entry.spawn, def, occupied);
    }

    for (const mob of this.mobs) {
      if (mob.hp <= 0) {
        mob.animState = 'die';
        continue;
      }

      if ((mob.paralyzeUntil || 0) > now) {
        mob.animState = 'idle';
        continue;
      }

      const slowFactor = (mob.slowUntil || 0) > now ? 0.5 : 1;

      if (mob.moveTo) {
        if (mob.animState !== 'walk') mob.animStartedAt = now;
        mob.animState = 'walk';
        const arrived = this.#stepEntityMovement(mob, 2.5 * slowFactor, dtMs);
        if (arrived) mob.animState = 'idle';
        continue;
      }

      if (mob.animState === 'attack' || mob.animState === 'damage') {
        if (now - mob.animStartedAt < (mob.animDurationMs || 520)) continue;
        mob.animState = 'idle';
      } else if (mob.animState === 'walk') {
        mob.animState = 'idle';
      }

      const guardTown = !mob.spawn?.villageAnimal;
      const distToPlayer = tileDistance(mob.tx, mob.ty, p.tx, p.ty);
      if (playerInSafety) {
        mob.aggroTarget = false;
      }
      if (distToPlayer > 36 && !mob.aggroTarget) {
        continue;
      }
      if (mob.aggressive && !playerInSafety && distToPlayer <= 6 && p.hp > 0) {
        mob.aggroTarget = true;
      } else if (distToPlayer > 12) {
        mob.aggroTarget = false;
      }

      if (mob.aggroTarget && !playerInSafety && p.hp > 0) {
        if (distToPlayer <= mob.range) {
          if (now - mob.lastActAt >= Math.round(1250 / slowFactor)) {
            mob.lastActAt = now;
            mob.heading = headingBetween(p.tx - mob.tx, p.ty - mob.ty);
            mob.animState = 'attack';
            mob.animStartedAt = now;
            mob.animDurationMs = 560;
            if (mob.attackMode === 'arrow' && distToPlayer > 1) {
              this.audio.playSound(248, 0.28);
              const from = tileToWorld(mob.tx, mob.ty);
              const to = tileToWorld(p.tx, p.ty);
              this.projectiles.push({
                id: `proj-${this.nextUid++}`,
                fromX: from.x,
                fromY: from.y,
                toX: to.x,
                toY: to.y,
                x: from.x,
                y: from.y,
                heading: mob.heading,
                progress: 0,
                targetKind: 'player',
                mobName: mob.name,
                mobLevel: mob.level,
              });
            } else {
              this.#applyMobAttackToPlayer(mob, now);
            }
          }
          continue;
        }
        // 往玩家方向跨一格
        if (now - mob.lastActAt >= 520) {
          mob.lastActAt = now;
          const step = this.#bestStepToward(mob, p.tx, p.ty, occupied);
          if (step) {
            occupied.delete(`${mob.tx},${mob.ty}`);
            occupied.add(`${step.x},${step.y}`);
            mob.moveFrom = { x: mob.tx, y: mob.ty };
            mob.moveTo = step;
            mob.moveProgress = 0;
            mob.heading = headingBetween(step.x - mob.tx, step.y - mob.ty);
            if (mob.animState !== 'walk') mob.animStartedAt = now;
            mob.animState = 'walk';
            continue;
          }
        }
      } else if (now >= mob.nextRoamAt) {
        mob.nextRoamAt = now + randInt(2800, 6200);
        const [dx, dy] = HEADING_DELTAS[randInt(0, 7)];
        const nx = mob.tx + dx;
        const ny = mob.ty + dy;
        if (
          !(guardTown && this.#isHostileRestrictedTile(mob.map, nx, ny)) &&
          tileDistance(nx, ny, mob.homeX ?? mob.spawn.x, mob.homeY ?? mob.spawn.y) <= Math.max(3, Math.min(mob.spawn.size || 6, 8)) &&
          !occupied.has(`${nx},${ny}`) &&
          this.isoMap.canStep(mob.tx, mob.ty, dx, dy, mob.map)
        ) {
          occupied.delete(`${mob.tx},${mob.ty}`);
          occupied.add(`${nx},${ny}`);
          mob.moveFrom = { x: mob.tx, y: mob.ty };
          mob.moveTo = { x: nx, y: ny };
          mob.moveProgress = 0;
          mob.heading = headingBetween(dx, dy);
          if (mob.animState !== 'walk') mob.animStartedAt = now;
          mob.animState = 'walk';
        }
      }
    }
  }

  #bestStepToward(mob, tx, ty, occupied) {
    let best = null;
    let bestD = tileDistance(mob.tx, mob.ty, tx, ty);
    const guardTown = !mob.spawn?.villageAnimal;
    for (const [dx, dy] of HEADING_DELTAS) {
      const nx = mob.tx + dx;
      const ny = mob.ty + dy;
      if (guardTown && this.#isHostileRestrictedTile(mob.map, nx, ny)) continue;
      if (occupied.has(`${nx},${ny}`)) continue;
      if (!this.isoMap.canStep(mob.tx, mob.ty, dx, dy, mob.map)) continue;
      const d = Math.hypot(nx - tx, ny - ty);
      if (d < bestD + 0.15) {
        bestD = d;
        best = { x: nx, y: ny };
      }
    }
    return best;
  }

  #applyMobAttackToPlayer(mob, now) {
    const p = this.player;
    if (isSafetyZone(p.map, p.tx, p.ty, this.isoMap)) return;
    const isSpell = mob.attackMode === 'spell';
    if (isSpell) {
      this.spawnEffect(p.tx, p.ty, mob.castEffectId || 167);
    }

    const hitChance = isSpell
      ? clamp(0.84 - p.mr * 0.002, 0.45, 0.94)
      : clamp(0.62 + (mob.level - p.level) * 0.02 + p.ac * 0.012, 0.18, 0.85);
    if (Math.random() > hitChance) {
      this.spawnFloatingText(p.tx, p.ty, isSpell ? 'RESIST' : 'DODGE', '#cbd5e1');
      return;
    }

    const raw = Math.max(1, Math.round(mob.level * (isSpell ? 1.35 : 1.15) + randInt(1, 5)));
    const baseReduction = isSpell
      ? Math.floor(raw * clamp(p.mr / 180, 0, 0.45))
      : Math.max(0, Math.floor((10 - p.ac) * 0.35));
    let dmg = Math.max(1, raw - baseReduction - (p.equipDr || 0));
    if (isSpell) {
      const elemKey = MOB_SPELL_ELEMENT[mob.name];
      const elemPct = elemKey ? clamp(p.elemRes?.[elemKey] || 0, 0, 80) : 0;
      if (elemPct > 0) dmg = Math.max(1, Math.round(dmg * (1 - elemPct / 100)));
    }
    p.hp = Math.max(0, p.hp - dmg);
    this.spawnFloatingText(p.tx, p.ty, `-${dmg}`, isSpell ? '#fb7185' : '#ff4d4f');
    this.addLog(`${mob.name}${isSpell ? '施放魔法' : mob.attackMode === 'arrow' ? '射箭' : ''}對你造成 ${dmg} 點傷害！`, 'danger');

    // 特定怪物附加毒素異常狀態
    const poisonChance = POISON_MOBS[mob.name];
    if (p.hp > 0 && poisonChance && Math.random() < poisonChance) {
      p.buffs.poison = now + 20000;
      this.spawnEffect(p.tx, p.ty, '745');
      this.spawnFloatingText(p.tx, p.ty - 1, '中毒！', '#d946ef');
      this.addLog(`${mob.name} 的攻擊帶有劇毒！你中毒了（可使用翡翠藥水或解毒術解除）。`, 'warn');
    }

    // 特定侵蝕型怪物攻擊可能損壞已穿戴防具（防禦力下降，可用磨刀石或內掛／鍛造修復）
    if (p.hp > 0 && !isSpell && ARMOR_CORRODE_MOBS.has(mob.name) && Math.random() < 0.08) {
      const equippedArmors = p.inventory.filter(
        (i) => i.equipped && this.worldData.items[i.name]?.kind === 'armor' && (i.brokenCount || 0) < 5,
      );
      if (equippedArmors.length > 0) {
        const armor = equippedArmors[Math.floor(Math.random() * equippedArmors.length)];
        armor.brokenCount = (armor.brokenCount || 0) + 1;
        this.recomputePlayerStats();
        this.addLog(`${mob.name} 腐蝕了你的防具【${armor.name}】（受損 ${armor.brokenCount} 級，防禦減弱）！`, 'warn');
      }
    }

    this.dirtySave = true;
    if (p.hp <= 0) {
      this.triggerPlayerDeath(`${mob.name} 攻擊`);
    }
  }

  triggerPlayerDeath(cause = '戰鬥倒下') {
    const p = this.player;
    const now = performance.now();
    p.buffs.poison = 0;

    if ((p.buffs.resurrect || 0) > now) {
      p.buffs.resurrect = 0;
      p.hp = p.maxHp;
      p.mp = p.maxMp;
      this.spawnEffect(p.tx, p.ty, '169');
      this.spawnFloatingText(p.tx, p.ty - 1, '復活庇護!', '#fde68a');
      this.recomputePlayerStats();
      this.addLog(`雖因${cause}倒下，但【復活卷軸庇護】發動，原地滿狀態復活（零經驗損失）！`, 'gold');
      this.saveWorld(true);
      return { penalty: 0, map: p.map, tx: p.tx, ty: p.ty, hp: p.hp, exp: p.exp, blessed: true };
    }

    p.targetId = null;
    p.pendingTrainNpcId = null;
    p.pendingInteractNpcId = null;
    p.pendingPickupId = null;
    p.path = [];
    p.autoConfig.enabled = false;

    // Lv.5 起陣亡損失當前等級區間 4% 經驗值，確保絕不倒扣至前級以下
    const levelSpan = Math.max(1, p.expNext - p.expPrev);
    const curableExp = Math.max(0, p.exp - p.expPrev);
    const penalty = p.level >= 5 ? Math.min(curableExp, Math.max(1, Math.floor(levelSpan * 0.04))) : 0;
    p.exp = Math.max(p.expPrev, p.exp - penalty);

    p.hp = Math.max(Math.ceil(p.maxHp * 0.5), 10);
    p.mp = Math.max(Math.ceil(p.maxMp * 0.5), 2);
    const town = resolveHomeTown(p.map, p.tx, p.ty);
    this.teleportTo(town.map, town.x, town.y, 4);
    this.spawnEffect(town.x, town.y, '169');
    this.recomputePlayerStats();
    this.addLog(
      `你的體力歸零倒下了（${cause}）…已由${town.label}神殿復活返村${penalty > 0 ? `，損失 ${penalty} 經驗值` : '（新手保護免扣經驗值）'}！`,
      'danger',
    );
    this.saveWorld(true);
    return { penalty, map: p.map, tx: p.tx, ty: p.ty, hp: p.hp, exp: p.exp };
  }

  #updateProjectiles(dtMs) {
    const next = [];
    for (const pr of this.projectiles) {
      pr.progress += (dtMs / 1000) * 6.5;
      if (pr.progress >= 1) {
        if (pr.targetKind === 'dummy') continue;
        if (pr.targetKind === 'player') {
          if (this.player.hp > 0) {
            this.#applyMobAttackToPlayer({ name: pr.mobName, level: pr.mobLevel, attackMode: 'arrow' }, performance.now());
          }
          continue;
        }
        const mob = this.mobs.find((m) => m.id === pr.targetMobId && m.hp > 0);
        if (mob) this.#applyDamageToMob(mob, pr.dmg);
        continue;
      }
      pr.x = pr.fromX + (pr.toX - pr.fromX) * pr.progress;
      pr.y = pr.fromY + (pr.toY - pr.fromY) * pr.progress;
      next.push(pr);
    }
    this.projectiles = next;
  }

  #cleanupVfx(now) {
    this.effects = this.effects.filter((fx) => now - fx.bornAt < fx.duration);
    this.floatingTexts = this.floatingTexts.filter((ft) => now - ft.bornAt < ft.duration);
    this.drops = this.drops.filter((d) => now - d.bornAt < 180000);
  }

  #updateRegen(now) {
    if (now - this.lastRegenAt < 3200) return;
    this.lastRegenAt = now;
    const p = this.player;
    if (p.hp <= 0) return;

    const poisoned = (p.buffs.poison || 0) > now;
    if (poisoned) {
      const pdmg = randInt(2, 5);
      p.hp = Math.max(0, p.hp - pdmg);
      this.spawnFloatingText(p.tx, p.ty, `毒素 -${pdmg}`, '#d946ef');
      this.dirtySave = true;
      if (p.hp <= 0) {
        this.triggerPlayerDeath('毒素侵蝕');
        return;
      }
    }

    // 動態飽食度隨時間消耗（約每 24 秒消耗 1%，低於 10% 停止自然回血回魔）
    if (now - (this.lastHungerAt || 0) >= 24000) {
      this.lastHungerAt = now;
      if ((p.food ?? 84) > 0) {
        p.food = Math.max(0, (p.food ?? 84) - 1);
        this.dirtySave = true;
        if (p.food <= 10 && !p.hungryWarned) {
          p.hungryWarned = true;
          this.addLog('肚子餓得咕嚕叫（飢餓狀態：停止自然回復，請食用肉類或精靈餅乾）。', 'warn');
        } else if (p.food > 10) {
          p.hungryWarned = false;
        }
      }
    }

    if (p.weightPercent >= 50 || (p.food ?? 84) <= 10) return;
    if (!poisoned && p.hp < p.maxHp) {
      const effCon = p.effCon ?? p.stats.con;
      const baseHpRegen = p.abilities?.hpRegen ?? Math.max(1, effCon <= 13 ? 1 : effCon - 12);
      const hpTick = Math.max(1, baseHpRegen + (p._equipHpRegen || 0));
      p.hp = Math.min(p.maxHp, p.hp + hpTick);
      this.dirtySave = true;
    }
    if (p.mp < p.maxMp) {
      const blueBonus = (p.buffs.bluePotion || 0) > now ? (p.abilities?.bluePotBonus ?? 2) : 0;
      const medBonus = (p.buffs.meditation || 0) > now ? 3 : 0;
      const mpTick = Math.max(1, (p.abilities?.mpRegen ?? 1) + (p._equipMpRegen || 0) + blueBonus + medBonus);
      p.mp = Math.min(p.maxMp, p.mp + mpTick);
      this.dirtySave = true;
    }
  }
}
