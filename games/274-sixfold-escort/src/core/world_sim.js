// 六器鏢行 — 權威世界模擬器（確定性 tick 步進，支援 PC/行動雙端、自動狩獵、攤位尋路、偃甲與懸紅榜）

import {
  ELEMENTS, WEAPON_TYPES, LOADOUT_PRESETS, REBIRTH_STAGES, SKILLS,
  INITIAL_WEAPONS, TEMPER_STONES, JADE_CHARMS, MECH_TIERS, MAPS, INITIAL_STALLS, POTION_EFFECT,
  MAP_BLOCKERS, REBIRTH_NEXT, REFORGE_ELEMENT_COST,
} from './data.js';
import {
  computeDerivedStats, getSkillScaling, resolveCombatHit, attemptWeaponUpgrade, getWeaponAuraTier, getWeaponAuraName,
} from './combat.js';
import { EscortNetBus, OPCODES, loadSavedState, saveStateSnapshot } from './proto.js';

export function createGameWorld({ restoreSave = true, persist = true } = {}) {
  // persist=false（?fresh=1）：不寫回瀏覽器存檔，免得試玩蓋掉原本的進度
  const net = new EscortNetBus();

  // 角色核心狀態（對應 characters + character_martials + inventory_items + mech_contracts 四張表）
  const char = {
    charId: 'char-hero-001',
    name: '陸遠行',
    gender: 'MALE', // 'MALE' 鏢師 | 'FEMALE' 女鏢師
    hairStyle: 0,
    level: 28,
    exp: 340,
    expNext: 1000,
    rebirthStage: 1, // 預設開脈（開啟四季玉珮與淬紋石）
    faction: 0,
    statStr: 32,
    statAgi: 26,
    statCon: 28,
    statInt: 30,
    freeStatPoints: 15,
    skillPoints: 2400,

    curHp: 1200,
    maxHp: 1200,
    curMp: 750,
    maxMp: 750,
    curShield: 980,
    maxShield: 980,
    curGear: 1000,
    maxGear: 1000,
    frenzyGauge: 65, // 酣戰值 0~100
    frenzyActiveSec: 0,

    pkMode: false,      // 亮刃開關
    karma: 0,           // 凶名值
    fame: 680,          // 聲望值
    silver: 16800,      // 銅錢
    ingots: 500,        // 銀票

    mapId: 1001,
    channel: 1,         // 1: 允許PK分流, 2: 安全分流
    sandstormNight: false,   // 風沙夜（全區亮刃無懲罰、經驗+30%）
    x: 0,
    y: 0,
    z: 4.5,
    rotY: Math.PI,
    staggerSec: 0,
    slowSec: 0,
    dotSec: 0,
    dotDps: 0,
    inCombatSec: 0,

    loadoutId: 1,
    activeWeaponUid: 'wpn-spear-01',

    // 偃甲狀態機
    mechPhase: 'INACTIVE', // 'INACTIVE' | 'CASTING_7S' | 'ACTIVE_MERGED' | 'COOLDOWN'
    mechTier: 1,
    mechCastRem: 0,
    mechCastDmgTaken: 0,
    mechCdRem: 0,
    mechGearTickAcc: 0,
    mechParts: { head: true, chest: true, arms: true, wings: false, weapon: false },

    // 三合一藥囊與自動閾值
    potions: { hp: 25, shield: 25, cleanse: 18 },
    potionCd: 0,
    autoPotionEnabled: true,
    autoShieldThreshold: 0.40,
    autoHpThreshold: 0.35,

    // 鍛器與武學材料
    materials: {
      iron: 18,          // 百鍊烏鋼
      protectScroll: 8,  // 護器符
      trueScroll: 2,     // 《通玄心得》
      martialScroll: 6,  // 武學手札
      mechCores: 4,     // 機樞核心
      jadeDew: 5,   // 養玉露
    },

    // 自動狩獵與導航狀態
    autoHunt: false,
    browseStallMode: false,
    lockedTargetId: null,
    hudMode: 'auto', // 'pc' | 'mobile' | 'auto'
    deviceType: 'PC_WEBGPU',
  };

  const weapons = structuredClone(INITIAL_WEAPONS);
  const jadeCharms = structuredClone(JADE_CHARMS);
  const equippedTemperStones = ['DEF_SHIELD', 'DEF_HP'];

  // 武學修煉與「匣中取器」綁定表（每招預綁一把兵器，出招時自動從六器匣抽出）
  const martials = {
    301: { skillId: 301, layer: 12, prof: 10000, isTrue: false, linkedWeaponUid: 'wpn-spear-01', slot: 0 },
    101: { skillId: 101, layer: 12, prof: 10000, isTrue: true, linkedWeaponUid: 'wpn-blade-01', slot: 1 },
    601: { skillId: 601, layer: 10, prof: 6200, isTrue: false, linkedWeaponUid: 'wpn-thrown-01', slot: 2 },
    501: { skillId: 501, layer: 9, prof: 4500, isTrue: false, linkedWeaponUid: 'wpn-bow-01', slot: 3 },
    201: { skillId: 201, layer: 8, prof: 3000, isTrue: false, linkedWeaponUid: 'wpn-sword-01', slot: 4 },
    401: { skillId: 401, layer: 9, prof: 5000, isTrue: false, linkedWeaponUid: 'wpn-fist-01', slot: 5 },
    701: { skillId: 701, layer: 10, prof: 5800, isTrue: false, linkedWeaponUid: null, slot: 6 },
    702: { skillId: 702, layer: 8, prof: 2100, isTrue: false, linkedWeaponUid: null, slot: 7 },
    704: { skillId: 704, layer: 7, prof: 1500, isTrue: false, linkedWeaponUid: null, slot: -1 },
    801: { skillId: 801, layer: 8, prof: 4000, isTrue: false, linkedWeaponUid: null, slot: -1 },
    802: { skillId: 802, layer: 6, prof: 2000, isTrue: false, linkedWeaponUid: null, slot: -1 },
    803: { skillId: 803, layer: 7, prof: 3500, isTrue: false, linkedWeaponUid: null, slot: -1 },
    9001: { skillId: 9001, layer: 10, prof: 8000, isTrue: false, linkedWeaponUid: null, slot: -1 },
    9002: { skillId: 9002, layer: 10, prof: 8000, isTrue: false, linkedWeaponUid: null, slot: -1 },
  };

  const skillCooldowns = {};
  let dashCd = 0;

  // 青萍渡攤位（含玩家寄攤）
  const stalls = structuredClone(INITIAL_STALLS);
  let playerStall = null;

  // 懸紅榜
  const bounties = [
    {
      id: 'bounty-1',
      issuer: '石鼓村商隊苦主',
      targetId: 'pk-red-1',
      targetName: '黑風刀客',
      targetMapId: 1002,
      karma: 340,
      rewardSilver: 5500,
      status: 'ACTIVE', // 'ACTIVE' | 'ACCEPTED' | 'CLAIMED'
      acceptedByHero: false,
    },
    {
      id: 'bounty-2',
      issuer: '赤沙驛採藥人',
      targetId: 'pk-red-2',
      targetName: '鬼手梁七',
      targetMapId: 1002,
      karma: 185,
      rewardSilver: 3800,
      status: 'ACTIVE',
      acceptedByHero: false,
    },
  ];

  // 赤沙驛三座烽燧（一真二假：只有一座點得燃）
  const beacons = [
    { id: 'beacon-1', name: '西烽燧・甲', x: -12, z: -10, isTrue: false, owner: '未點燃', progress: 0, revealed: false },
    { id: 'beacon-2', name: '中烽燧・乙', x: 0, z: -15, isTrue: true, owner: '未點燃', progress: 0, revealed: false },
    { id: 'beacon-3', name: '東烽燧・丙', x: 13, z: -9, isTrue: false, owner: '未點燃', progress: 0, revealed: false },
  ];
  let beaconState = null; // { beaconId, rem }
  let outpostHolder = null;

  // 導航尋路（渡口行會全攤檢索 → 朱砂引路線）
  let navTarget = null; // { x, z, stallId, label }

  // 驛報紀錄
  const chatLogs = [
    { ch: '系統', text: '順安鏢局開門接鏢。已連線青萍渡第 1 分流。', color: '#ffd166' },
    { ch: '鏢局', text: '祁鏢頭：今晚走赤沙驛那趟鏢，聚罡散帶足，別讓劫鏢匪破了罡氣。', color: '#6ee7b7' },
    { ch: '交易', text: '【河西貨郎】攤位上架：百鍊烏鋼、護器符（打開行會可畫朱砂引路線）。', color: '#93c5fd' },
    { ch: '驛報', text: '劫鏢匪「黑風刀客」（凶名 340）出沒赤沙驛，懸紅 5,500 銅錢。', color: '#fca5a5' },
  ];

  // 視覺事件佇列（供 3D 場景渲染刃風、破罡紅光、傷害跳字、通玄名號）
  const vfxQueue = [];
  const floatTexts = [];

  // 各張地圖的怪物與劫鏢匪
  const entities = [];
  function buildMapEntities() {
    entities.length = 0;
    // 1001 青萍渡：練功樁（鏢局東側，高罡氣供測試破罡）＋ 南岸泥塘蟾／刺藤花／蘆葦小賊／石殼螺
    entities.push(
      makeEntity({ id: 'dummy-1', mapId: 1001, kind: 'DUMMY', name: '練功樁', lv: 15, element: 1, x: 14.5, z: 7.5, hp: 15000, shield: 450, atk: 0, def: 18 }),
      makeEntity({ id: 'dummy-2', mapId: 1001, kind: 'DUMMY', name: '銅皮練功樁', lv: 25, element: 2, x: 16.8, z: 5.5, hp: 20000, shield: 650, atk: 0, def: 25 }),
      makeEntity({ id: 'mob-qp-1', mapId: 1001, kind: 'MOB', subKind: 'toad', name: '泥塘蟾', lv: 2, element: 5, x: -8, z: -15.5, hp: 520, shield: 180, atk: 34, def: 12 }),
      makeEntity({ id: 'mob-qp-2', mapId: 1001, kind: 'MOB', subKind: 'thornvine', name: '刺藤花', lv: 4, element: 2, x: -2.5, z: -17.5, hp: 680, shield: 240, atk: 42, def: 15 }),
      makeEntity({ id: 'mob-qp-3', mapId: 1001, kind: 'MOB', subKind: 'reedthief', name: '蘆葦小賊', lv: 5, element: 3, x: 4.5, z: -16.2, hp: 760, shield: 280, atk: 48, def: 16 }),
      makeEntity({ id: 'mob-qp-4', mapId: 1001, kind: 'MOB', subKind: 'snail', name: '石殼螺', lv: 6, element: 5, x: 10.5, z: -17.0, hp: 940, shield: 390, atk: 52, def: 24 }),
      makeEntity({ id: 'mob-qp-5', mapId: 1001, kind: 'MOB', subKind: 'bigtoad', name: '老泥塘蟾', lv: 8, element: 1, x: 0.5, z: -20.0, hp: 1180, shield: 440, atk: 64, def: 22 }),
    );

    // 1002 赤沙驛：赤沙狼、風蝕岩蜥、夯土石偶、頭目「黑駝寨主」＋ 劫鏢匪
    entities.push(
      makeEntity({ id: 'mob-cs-1', mapId: 1002, kind: 'MOB', subKind: 'sandwolf', name: '赤沙狼', lv: 22, element: 5, x: -9, z: 6, hp: 1650, shield: 620, atk: 92, def: 38 }),
      makeEntity({ id: 'mob-cs-2', mapId: 1002, kind: 'MOB', subKind: 'rocklizard', name: '風蝕岩蜥', lv: 28, element: 4, x: 8.5, z: 5, hp: 2100, shield: 780, atk: 112, def: 45 }),
      makeEntity({ id: 'mob-cs-3', mapId: 1002, kind: 'MOB', subKind: 'golem', name: '夯土石偶', lv: 32, element: 5, x: -6, z: -3, hp: 2550, shield: 960, atk: 124, def: 58 }),
      makeEntity({ id: 'boss-cs-1', mapId: 1002, kind: 'BOSS', subKind: 'chieftain', name: '【頭目】黑駝寨主', lv: 45, element: 4, x: 5.5, z: -13, hp: 5600, shield: 1800, atk: 175, def: 72 }),
      makeEntity({ id: 'pk-red-1', mapId: 1002, kind: 'BANDIT', subKind: 'blade_pk', name: '黑風刀客', lv: 38, karma: 340, element: 1, x: -11, z: -4, hp: 3200, shield: 1150, atk: 155, def: 56, aggressive: true }),
      makeEntity({ id: 'pk-red-2', mapId: 1002, kind: 'BANDIT', subKind: 'dart_pk', name: '鬼手梁七', lv: 34, karma: 185, element: 2, x: 11.5, z: -2, hp: 2700, shield: 920, atk: 142, def: 48, aggressive: false }),
    );

    // 2001 偃師遺墟：銅骨傀儡兵、機樞術偶、守門偶、首領「千機像」
    entities.push(
      makeEntity({ id: 'mob-yx-1', mapId: 2001, kind: 'MOB', subKind: 'puppet_guard', name: '銅骨傀儡兵', lv: 52, element: 1, x: -9, z: 5, hp: 4200, shield: 1600, atk: 195, def: 78 }),
      makeEntity({ id: 'mob-yx-2', mapId: 2001, kind: 'MOB', subKind: 'puppet_caster', name: '機樞術偶', lv: 58, element: 3, x: 9, z: 4, hp: 4600, shield: 1950, atk: 215, def: 82 }),
      makeEntity({ id: 'mob-yx-3', mapId: 2001, kind: 'MOB', subKind: 'puppet_guard', name: '遺墟守門偶', lv: 62, element: 2, x: -7, z: -8, hp: 5100, shield: 2100, atk: 228, def: 88 }),
      makeEntity({ id: 'boss-yx-1', mapId: 2001, kind: 'BOSS', subKind: 'warden', name: '【遺墟首領】偃師千機像', lv: 75, element: 1, x: 0, z: -13, hp: 11500, shield: 3600, atk: 285, def: 105 }),
    );
  }

  function makeEntity(cfg) {
    return {
      ...cfg,
      spawnX: cfg.x,
      spawnZ: cfg.z,
      maxHp: cfg.hp,
      curHp: cfg.hp,
      maxShield: cfg.shield,
      curShield: cfg.shield,
      alpha: cfg.kind === 'BANDIT' ? 0.78 : 0.70,
      rotY: 0,
      atkCd: 1.2 + Math.random() * 0.8,
      staggerSec: 0,
      slowSec: 0,
      dotSec: 0,
      dotDps: 0,
      respawnRem: 0,
      attackingHero: false,
    };
  }

  buildMapEntities();

  // 載入瀏覽器存檔（若有）
  if (restoreSave) {
    const saved = loadSavedState();
    if (saved && saved.char) {
      // 舊版存檔欄位名不同：只接收目前 char 已有的欄位，材料與藥囊逐項合併，缺的維持預設值
      for (const [k, v] of Object.entries(saved.char)) {
        if (!(k in char)) continue;
        if (k === 'materials' || k === 'potions') {
          for (const [mk, mv] of Object.entries(v || {})) if (mk in char[k] && Number.isFinite(mv)) char[k][mk] = mv;
        } else {
          char[k] = v;
        }
      }
      if (Array.isArray(saved.weapons) && saved.weapons.length === weapons.length) {
        for (let i = 0; i < weapons.length; i++) Object.assign(weapons[i], saved.weapons[i]);
      }
      if (saved.martials) {
        for (const [k, v] of Object.entries(saved.martials)) {
          if (martials[k]) Object.assign(martials[k], v);
        }
      }
      if (saved.playerStall) playerStall = saved.playerStall;
      // 不認得的淬紋石 id 直接丟掉
      for (const w of weapons) if (Array.isArray(w.gems)) w.gems = w.gems.filter((g) => TEMPER_STONES[g]);
      if (Array.isArray(saved.equippedTemperStones)) {
        equippedTemperStones.length = 0;
        for (const g of saved.equippedTemperStones) if (TEMPER_STONES[g]) equippedTemperStones.push(g);
      }
      if (Array.isArray(saved.jadeCharms)) {
        for (const sc of saved.jadeCharms) {
          const c = jadeCharms.find((x) => x.id === sc?.id);
          if (c && Number.isInteger(sc.tier)) c.tier = Math.max(0, Math.min(4, sc.tier));
        }
      }
      if (Array.isArray(saved.bounties)) {
        for (const sb of saved.bounties) {
          if (!sb || typeof sb.id !== 'string') continue;
          const b = bounties.find((x) => x.id === sb.id);
          if (b) {
            if (['ACTIVE', 'ACCEPTED', 'CLAIMED'].includes(sb.status)) b.status = sb.status;
            b.acceptedByHero = !!sb.acceptedByHero;
            if (Number.isFinite(sb.rewardSilver)) b.rewardSilver = sb.rewardSilver;
          } else if (sb.targetId && sb.targetName) {
            bounties.unshift({ ...sb });
          }
        }
      }
      if (Array.isArray(saved.beacons)) {
        for (const sb of saved.beacons) {
          const b = beacons.find((x) => x.id === sb?.id);
          if (b) { b.revealed = !!sb.revealed; if (typeof sb.owner === 'string') b.owner = sb.owner; }
        }
      }
      if (typeof saved.outpostHolder === 'string') outpostHolder = saved.outpostHolder;
    }
  }

  function snapshot() {
    return {
      char, weapons, martials, playerStall,
      bounties: bounties.map((b) => ({ ...b })),
      beacons: beacons.map((b) => ({ id: b.id, revealed: b.revealed, owner: b.owner })),
      outpostHolder,
      jadeCharms: jadeCharms.map((c) => ({ id: c.id, tier: c.tier })),
      equippedTemperStones: equippedTemperStones.slice(),
    };
  }

  function getActiveWeapon() {
    return weapons.find((w) => w.uid === char.activeWeaponUid) || weapons[0];
  }

  function getDerived() {
    return computeDerivedStats(char, getActiveWeapon(), martials, equippedTemperStones, jadeCharms);
  }

  function syncCaps(refill = false) {
    const d = getDerived();
    char.maxHp = d.maxHp;
    char.maxMp = d.maxMp;
    char.maxShield = d.maxShield;
    if (refill) {
      char.curHp = char.maxHp;
      char.curMp = char.maxMp;
      char.curShield = char.maxShield;
    } else {
      char.curHp = Math.min(char.curHp, char.maxHp);
      char.curMp = Math.min(char.curMp, char.maxMp);
      char.curShield = Math.min(char.curShield, char.maxShield);
    }
    return d;
  }
  syncCaps(true);

  function addLog(ch, text, color = '#e5e0d5') {
    chatLogs.unshift({ ch, text, color });
    if (chatLogs.length > 35) chatLogs.length = 35;
  }

  // id：跳字掛在誰頭上（'hero' 或怪物 id；介面依名牌錨點往上排開）；kind 'skill'：招式名大字，介面另放在畫面下方
  function pushFloatText(x, z, text, color = '#ffffff', big = false, id = null, kind = '') {
    const who = id ?? (x === char.x && z === char.z ? 'hero' : null);
    floatTexts.push({ x, y: 2.3, z, text, color, big, id: who, kind, age: 0, ttl: big ? 1.55 : 1.05 });
    if (floatTexts.length > 40) floatTexts.shift();
  }

  // 操作失敗：驛報記一筆、主角頭上飄一行字。同一原因 1 秒內只提示一次（按住鍵或連點不會洗版）；
  // log: false 只跳字不寫驛報（冷卻這類天天會碰到的）。回傳 { ok: false, reason, ...extra }。
  let simTime = 0;
  const lastFailAt = {};
  function fail(reason, msg, { log = true, color = '#e8b878', extra = null } = {}) {
    const last = lastFailAt[reason];
    if (last === undefined || simTime - last >= 1) {
      lastFailAt[reason] = simTime;
      if (log) addLog('系統', msg, '#e8a07a');
      pushFloatText(char.x, char.z, msg, color, false);
    }
    return { ok: false, reason, ...(extra || {}) };
  }

  // 不可走區：把 (x, z) 推出建築矩形（半徑 r 的圓），推向最近的一邊
  function pushOutOfBlockers(obj, r = 0.4, mapId = char.mapId) {
    for (const [x0, z0, x1, z1] of MAP_BLOCKERS[mapId] || []) {
      if (obj.x <= x0 - r || obj.x >= x1 + r || obj.z <= z0 - r || obj.z >= z1 + r) continue;
      const opts = [[obj.x - (x0 - r), 'x', x0 - r], [(x1 + r) - obj.x, 'x', x1 + r], [obj.z - (z0 - r), 'z', z0 - r], [(z1 + r) - obj.z, 'z', z1 + r]]
        .filter(([, axis, v]) => Math.abs(v) <= 25.5); // 不推到可走範圍外
      opts.sort((a, b) => a[0] - b[0]);
      const [, axis, v] = opts[0];
      obj[axis] = v;
    }
  }
  const isBlocked = (x, z, r = 0, mapId = char.mapId) => (MAP_BLOCKERS[mapId] || []).some(([x0, z0, x1, z1]) => x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r);

  function pushVfx(vfx) {
    vfxQueue.push({ ...vfx, createdAt: Date.now() });
    if (vfxQueue.length > 32) vfxQueue.shift();
  }

  function isTargetAttackable(ent) {
    if (!ent || ent.mapId !== char.mapId || ent.curHp <= 0 || ent.respawnRem > 0) return false;
    if (ent.kind === 'BANDIT') {
      const hasAcceptedBounty = bounties.some((b) => b.targetId === ent.id && b.status !== 'CLAIMED' && b.acceptedByHero);
      // 亮刃（第 1 分流）、風沙夜期間、已揭懸紅榜，或對方先動手，才可攻擊劫鏢匪
      return (char.pkMode && char.channel === 1) || char.sandstormNight || hasAcceptedBounty || ent.attackingHero;
    }
    return true;
  }

  function getMapEntities(includeDead = false) {
    return entities.filter((e) => e.mapId === char.mapId && (includeDead || (e.curHp > 0 && e.respawnRem <= 0)));
  }

  // 混戰索敵清單（優先序：正在攻擊自己的劫鏢匪 > 殘血／懸紅劫鏢匪 > 頭目 > 最近怪物）
  function getThreatRadarList() {
    const list = getMapEntities(false);
    const scored = list.map((e) => {
      const dist = Math.hypot(e.x - char.x, e.z - char.z);
      let priority = 100 - Math.min(40, dist);
      if (e.kind === 'BANDIT' && e.attackingHero) priority += 500;
      else if (e.kind === 'BANDIT') priority += 350 + (1 - e.curHp / e.maxHp) * 80;
      else if (e.kind === 'BOSS') priority += 240;
      else if (e.kind === 'DUMMY') priority -= 20;
      return { ent: e, dist, priority };
    });
    scored.sort((a, b) => b.priority - a.priority);
    return scored.slice(0, 4).map((s) => s.ent);
  }

  // 註冊網路協定處理器：[Opcode 2001] 匣中取器——「切兵器 + 換裝 + 出招」同一封包
  net.on(OPCODES.C2S_CAST_LINKED_SKILL, (pkt) => {
    if (char.staggerSec > 0) {
      return fail('STAGGERED', '硬直中，出不了招', { log: false, color: '#fca5a5' });
    }
    const sk = SKILLS[pkt.skill_id];
    if (!sk) return { ok: false, reason: 'UNKNOWN_SKILL' };

    if (sk.category === 'MECH' && char.mechPhase !== 'ACTIVE_MERGED') {
      addLog('系統', '要先坐進偃甲才能使用偃甲專屬技。', '#fca5a5');
      return { ok: false, reason: 'MECH_REQUIRED' };
    }

    const cdRem = skillCooldowns[sk.id] || 0;
    if (cdRem > 0.05) return fail('COOLDOWN', `${sk.name} 還要 ${cdRem.toFixed(1)} 秒`, { log: false, color: '#cbd5e1', extra: { cdRem } });

    if (char.curMp < sk.mpCost) {
      if (char.autoPotionEnabled && char.potions.cleanse > 0) useSmartPotion('CLEANSE_PILL', true);
      // 藥還在冷卻或吃完了，內力仍不夠就不出招
      if (char.curMp < sk.mpCost) return fail('NO_MP', '內力不足', { log: false, color: '#60a5fa' });
    }

    // 1. 同一 Tick 內從六器匣抽出綁定兵器並套用換裝組
    let switchedWeaponType = null;
    if (pkt.loadout_preset_id && pkt.loadout_preset_id !== char.loadoutId) {
      char.loadoutId = pkt.loadout_preset_id;
    }
    const targetWpnUid = pkt.linked_weapon_uid || martials[sk.id]?.linkedWeaponUid;
    if (sk.weapon) {
      let desired = weapons.find((w) => w.uid === targetWpnUid && w.type === sk.weapon);
      if (!desired) desired = weapons.find((w) => w.type === sk.weapon);
      if (desired && desired.uid !== char.activeWeaponUid) {
        char.activeWeaponUid = desired.uid;
        switchedWeaponType = desired.type;
      }
    }
    const d = syncCaps(false);
    const activeWpn = getActiveWeapon();

    // 2. 鎖定目標（若未鎖定或已死亡則自動索敵範圍內最高威脅目標）
    let primaryTarget = entities.find((e) => e.id === (pkt.target_entity_id || char.lockedTargetId));
    if (!isTargetAttackable(primaryTarget)) {
      const candidates = getMapEntities(false).filter(isTargetAttackable);
      candidates.sort((a, b) => Math.hypot(a.x - char.x, a.z - char.z) - Math.hypot(b.x - char.x, b.z - char.z));
      primaryTarget = candidates[0] || null;
      if (primaryTarget) char.lockedTargetId = primaryTarget.id;
    }

    const effRange = (sk.range || 3.8) * (LOADOUT_PRESETS.find((p) => p.id === char.loadoutId)?.rangeMult || 1.0);
    if (primaryTarget && !sk.isSelfAoe) {
      const dist = Math.hypot(primaryTarget.x - char.x, primaryTarget.z - char.z);
      char.rotY = Math.atan2(primaryTarget.x - char.x, primaryTarget.z - char.z);
      // 若距離略遠，自動輕功踏前一步貼近手感
      if (dist > effRange + 0.6) {
        const stepIn = Math.min(dist - effRange * 0.82, 2.6);
        if (stepIn > 0 && dist - stepIn <= effRange + 0.8) {
          char.x += Math.sin(char.rotY) * stepIn;
          char.z += Math.cos(char.rotY) * stepIn;
          pushOutOfBlockers(char);
        } else {
          return fail('OUT_OF_RANGE', '距離過遠', { log: false, color: '#cbd5e1', extra: { dist } });
        }
      }
    }

    // 扣除 MP 與設定武功冷卻（酣戰期間冷卻加快 25%）
    char.curMp = Math.max(0, char.curMp - sk.mpCost);
    const cdScale = char.frenzyActiveSec > 0 ? 0.75 : 1.0;
    skillCooldowns[sk.id] = sk.cd * cdScale;
    char.inCombatSec = 6.0;

    // 累積武功熟練度（1~12 重；第 n 重要攢滿 1000×n 才升下一重，偃甲專屬技不走這段）
    const mEntry = martials[sk.id] || { skillId: sk.id, layer: 1, prof: 0, isTrue: false, linkedWeaponUid: null, slot: -1 };
    martials[sk.id] = mEntry;
    if (mEntry.layer < 12 && sk.category !== 'MECH') {
      mEntry.prof += 360;
      if (mEntry.prof >= 1000 * mEntry.layer) {
        mEntry.layer += 1;
        mEntry.prof = mEntry.layer >= 12 ? 10000 : 0;
        addLog('武學', `《${sk.name}》練到第 ${mEntry.layer} 重。`, '#fde047');
        pushFloatText(char.x, char.z, `${sk.name} 第${mEntry.layer}重`, '#fde047', true);
      }
    }

    const scaling = getSkillScaling(sk.id, mEntry.layer, mEntry.isTrue);
    const center = sk.isSelfAoe || !primaryTarget
      ? { x: char.x, z: char.z }
      : { x: primaryTarget.x, z: primaryTarget.z };

    // 收集受擊目標（單體或範圍最多 6 名）
    const hitTargets = [];
    for (const ent of getMapEntities(false)) {
      if (!isTargetAttackable(ent)) continue;
      const dToCenter = Math.hypot(ent.x - center.x, ent.z - center.z);
      if (ent === primaryTarget || dToCenter <= (sk.aoeRadius || 2.0)) {
        hitTargets.push(ent);
        if (hitTargets.length >= 6) break;
      }
    }

    // 推送 3D 刃風／殘影特效
    pushVfx({
      kind: sk.category === 'MECH' ? 'MECH_SKILL' : (mEntry.isTrue ? 'TRUE_MARTIAL' : 'MARTIAL'),
      skillId: sk.id,
      skillName: scaling.name,
      weaponType: sk.weapon || activeWpn?.type,
      auraTier: getWeaponAuraTier(activeWpn?.upgrade || 0),
      color: sk.color,
      fromX: char.x,
      fromZ: char.z,
      toX: center.x,
      toZ: center.z,
      radius: sk.aoeRadius || 2.4,
      isTrue: !!mEntry.isTrue,
    });

    if (mEntry.isTrue) {
      pushFloatText(char.x, char.z, `【${scaling.name}】`, '#ffd166', true, 'hero', 'skill');
    }

    const results = [];
    const frenzyAtkAmp = char.frenzyActiveSec > 0 ? 1.25 : 1.0;
    const baseAtk = (sk.category === 'INNER_FIVE' ? d.innerAtk : d.weaponAtk) * frenzyAtkAmp;
    const atkElement = sk.element || activeWpn?.element || 0;

    for (const ent of hitTargets) {
      const dotBonus = (activeWpn?.type === 'THROWN' && ent.dotSec > 0) ? 1.08 : 1.0;
      const isCrit = Math.random() < Math.max(0.05, d.critRate - 0.02);
      const hit = resolveCombatHit({
        atkValue: baseAtk * dotBonus,
        skillMult: scaling.mult,
        breakBeta: scaling.breakBeta * (1 + d.weaponBreakBonus),
        targetDef: ent.def,
        armorPen: d.armorPen,
        atkElement,
        defElement: ent.element || 0,
        isCrit,
        critMult: d.critDmg,
        pkMode: char.pkMode,
        targetCurShield: ent.curShield,
        targetCurHp: ent.curHp,
        targetAlpha: ent.alpha || 0.70,
      });

      ent.curShield = hit.remShield;
      ent.curHp = hit.remHp;
      if (hit.staggerSec > 0) ent.staggerSec = Math.max(ent.staggerSec, hit.staggerSec);
      if (sk.slowSec) ent.slowSec = Math.max(ent.slowSec, sk.slowSec);
      if (sk.dotDps) { ent.dotDps = sk.dotDps; ent.dotSec = sk.dotSec || 4; }

      // 長槍迴風掃月吸血續航
      const stealRate = (sk.lifesteal || 0) + d.lifesteal;
      if (stealRate > 0 && hit.hpDamage > 0) {
        char.curHp = Math.min(char.maxHp, char.curHp + Math.round(hit.hpDamage * stealRate));
      }

      // 酣戰值累積
      char.frenzyGauge = Math.min(100, char.frenzyGauge + 6);

      // 廣播 S2C_CombatDamageResult 封包
      const s2cPayload = {
        attacker_id: char.charId,
        target_id: ent.id,
        skill_id: sk.id,
        is_true_skill: !!mEntry.isTrue,
        switched_weapon_type: switchedWeaponType || activeWpn?.type || '',
        hp_damage: hit.hpDamage,
        shield_absorbed: hit.shieldAbsorbed,
        target_rem_hp: ent.curHp,
        target_rem_shield: ent.curShield,
        is_crit: hit.isCrit,
        is_shield_broken: hit.isShieldBroken,
        elemental_multiplier: hit.elementalMultiplier,
      };
      net.send(OPCODES.S2C_COMBAT_DAMAGE_RESULT, s2cPayload);

      if (hit.isShieldBroken) {
        pushFloatText(ent.x, ent.z, `破罡！-${hit.hpDamage}`, '#ff6a4a', true, ent.id);
        pushVfx({ kind: 'SHIELD_BREAK', toX: ent.x, toZ: ent.z, color: '#38bdf8' });
        addLog('戰報', `破了【${ent.name}】的罡氣：1.15× 易傷、硬直 0.5 秒。`, '#ff6b6b');
      } else {
        const elemTag = hit.elementalMultiplier > 1 ? '剋' : (hit.elementalMultiplier < 1 ? '逆' : '');
        const label = `${hit.isCrit ? '暴擊 ' : ''}${elemTag ? `[${elemTag}] ` : ''}-${hit.hpDamage}${hit.shieldAbsorbed > 0 ? ` (罡-${hit.shieldAbsorbed})` : ''}`;
        pushFloatText(ent.x, ent.z, label, hit.isCrit ? '#facc15' : '#f8fafc', hit.isCrit, ent.id);
      }

      if (ent.curHp <= 0) {
        handleEntityDefeated(ent);
      }
      results.push({ targetId: ent.id, ...hit });
    }

    return { ok: true, switchedWeaponType, activeWeaponUid: char.activeWeaponUid, hits: results };
  });

  function handleEntityDefeated(ent) {
    if (ent.kind === 'DUMMY') {
      ent.curHp = ent.maxHp;
      ent.curShield = ent.maxShield;
      addLog('練功', `【${ent.name}】氣血與罡氣已重置，可以繼續練連招。`, '#93c5fd');
      return;
    }

    ent.respawnRem = ent.kind === 'BOSS' ? 16 : 7.5;
    ent.attackingHero = false;

    const expMult = char.sandstormNight ? 1.30 : 1.0; // 風沙夜經驗與 SP +30%
    const gainExp = Math.round((45 + ent.lv * 18 + (ent.kind === 'BOSS' ? 420 : 0)) * expMult);
    const gainSp = Math.round((30 + ent.lv * 12) * expMult);
    const gainSilver = Math.round(65 + ent.lv * 14 + (ent.kind === 'BOSS' ? 950 : 0));

    char.exp += gainExp;
    char.skillPoints += gainSp;
    char.silver += gainSilver;

    // 升級判定（每級獲得 5 點自由四維屬性點）
    while (char.exp >= char.expNext && char.level < 99) {
      char.exp -= char.expNext;
      char.level += 1;
      char.expNext = Math.round(900 + char.level * 120);
      char.freeStatPoints += 5;
      syncCaps(true);
      pushFloatText(char.x, char.z, `升至 Lv.${char.level}！屬性點+5`, '#fde047', true);
      addLog('系統', `升到 Lv.${char.level}：獲得 5 點自由屬性點，氣血與罡氣回滿。`, '#fde047');
    }

    // 掉落烏鋼／通玄心得／機樞核心
    if (ent.kind === 'BOSS') {
      char.materials.iron += 3;
      char.materials.trueScroll += 1;
      char.materials.mechCores += 2;
      addLog('掉落', `擊敗頭目【${ent.name}】：《通玄心得》×1、機樞核心×2、百鍊烏鋼×3。`, '#f59e0b');
    } else if (Math.random() < 0.45) {
      char.materials.iron += 1;
    }

    // 劫鏢匪與懸紅榜結算
    if (ent.kind === 'BANDIT') {
      char.fame += 35;
      const bounty = bounties.find((b) => b.targetId === ent.id && b.status !== 'CLAIMED');
      if (bounty && bounty.acceptedByHero) {
        bounty.status = 'CLAIMED';
        char.silver += bounty.rewardSilver;
        addLog('驛報', `${char.name} 拿下劫鏢匪「${ent.name}」，領到懸紅 ${bounty.rewardSilver} 銅錢。`, '#fde047');
        pushFloatText(char.x, char.z, `懸紅 +${bounty.rewardSilver} 銅錢`, '#fde047', true);
      } else if (char.pkMode && !char.sandstormNight && ent.karma === 0) {
        char.karma += 2; // 亮刃殺傷無凶名者 +2 凶名值
      }
    }
  }

  // [Opcode 2050] 三合一藥囊處理器
  net.on(OPCODES.C2S_USE_SMART_POTION, (pkt) => {
    // 自動服藥失敗不提示（每幀都在試）；手動按鍵才跳字、寫驛報
    const quietFail = (reason, msg) => (pkt.is_auto_triggered ? { ok: false, reason } : fail(reason, msg));
    if (char.potionCd > 0) return quietFail('POTION_CD', `藥囊還在回氣（${char.potionCd.toFixed(1)} 秒）`);
    const type = pkt.potion_type;
    if (type === 'HP_RED') {
      if (char.potions.hp <= 0) return quietFail('EMPTY', '回春丸吃完了，到柳三娘的藥舖補');
      char.potions.hp -= 1;
      const heal = Math.round(char.maxHp * POTION_EFFECT.hp);
      char.curHp = Math.min(char.maxHp, char.curHp + heal);
      char.potionCd = 1.4;
      pushFloatText(char.x, char.z, `回春丸 +${heal} HP`, '#f87171', false);
      return { ok: true, type, rem: char.potions.hp };
    }
    if (type === 'SHIELD_CYAN') {
      if (char.potions.shield <= 0) return quietFail('EMPTY', '聚罡散吃完了，到柳三娘的藥舖補');
      char.potions.shield -= 1;
      const restore = Math.round(char.maxShield * POTION_EFFECT.shield);
      char.curShield = Math.min(char.maxShield, char.curShield + restore);
      char.potionCd = 1.4;
      pushFloatText(char.x, char.z, `${pkt.is_auto_triggered ? '[自動]' : ''}聚罡散 +${restore} 罡氣`, '#38bdf8', false);
      return { ok: true, type, rem: char.potions.shield };
    }
    if (type === 'CLEANSE_PILL' || type === 'MP_BLUE') {
      if (char.potions.cleanse <= 0) return quietFail('EMPTY', '清心露喝完了，到柳三娘的藥舖補');
      char.potions.cleanse -= 1;
      const mpGain = Math.round(char.maxMp * POTION_EFFECT.cleanse);
      char.curMp = Math.min(char.maxMp, char.curMp + mpGain);
      char.slowSec = 0;
      char.dotSec = 0;
      char.staggerSec = 0;
      char.potionCd = 1.4;
      pushFloatText(char.x, char.z, `清心露 +${mpGain} MP・淨化`, '#a78bfa', false);
      return { ok: true, type, rem: char.potions.cleanse };
    }
    return { ok: false };
  });

  function useSmartPotion(type = 'AUTO', isAuto = false) {
    let chosen = type;
    if (chosen === 'AUTO') {
      if (char.curShield / char.maxShield < 0.55 && char.potions.shield > 0) chosen = 'SHIELD_CYAN';
      else if (char.curHp / char.maxHp < 0.75 && char.potions.hp > 0) chosen = 'HP_RED';
      else chosen = 'CLEANSE_PILL';
    }
    const res = net.send(OPCODES.C2S_USE_SMART_POTION, {
      potion_type: chosen,
      is_auto_triggered: isAuto,
    });
    return res.results[0];
  }

  function castLinkedSkill(skillId, opts = {}) {
    const m = martials[skillId];
    const res = net.send(OPCODES.C2S_CAST_LINKED_SKILL, {
      char_id: char.charId,
      skill_id: skillId,
      linked_weapon_uid: opts.weaponUid ?? m?.linkedWeaponUid ?? '',
      loadout_preset_id: opts.loadoutId ?? 0,
      target_entity_id: opts.targetId ?? char.lockedTargetId ?? '',
      cast_position: { x: char.x, y: char.y, z: char.z },
      aim_direction: { x: Math.sin(char.rotY), y: 0, z: Math.cos(char.rotY) },
    });
    return res.results[0];
  }

  // 輕功瞬步（外圈滑動／空白鍵／Shift）
  function castQinggongDash(dirX, dirZ) {
    if (dashCd > 0 || char.staggerSec > 0) return false;
    const len = Math.hypot(dirX, dirZ);
    const nx = len > 0.01 ? dirX / len : Math.sin(char.rotY);
    const nz = len > 0.01 ? dirZ / len : Math.cos(char.rotY);
    const dist = 5.4;
    const fromX = char.x, fromZ = char.z;
    char.x = clampCoord(char.x + nx * dist);
    char.z = clampCoord(char.z + nz * dist);
    pushOutOfBlockers(char);
    char.rotY = Math.atan2(nx, nz);
    dashCd = 1.6;
    navTarget = null;
    pushVfx({ kind: 'QINGGONG', fromX, fromZ, toX: char.x, toZ: char.z, color: '#7dd3fc' });
    pushFloatText(char.x, char.z, '踏浪步', '#7dd3fc', false);
    return true;
  }

  // 偃甲上機與解除（7 秒上機讀條，期間受擊累計 > 30% 最大 HP 即被打斷並冷卻 15 秒）
  function toggleMechSummon({ instantForTest = false } = {}) {
    const mapCfg = MAPS[char.mapId];
    if (char.mechPhase === 'ACTIVE_MERGED') {
      char.mechPhase = 'INACTIVE';
      syncMechPacket();
      addLog('偃甲', '已離開偃甲。', '#c4b5fd');
      return { ok: true, phase: char.mechPhase };
    }
    if (char.mechPhase === 'CASTING_7S') {
      char.mechPhase = 'INACTIVE';
      char.mechCastRem = 0;
      char.mechCastDmgTaken = 0;
      syncMechPacket();
      addLog('偃甲', '收起樞輪，取消上機。', '#c4b5fd');
      pushFloatText(char.x, char.z, '收起樞輪', '#c4b5fd', false);
      return { ok: true, phase: 'INACTIVE', cancelled: true };
    }
    if (char.mechPhase === 'COOLDOWN') {
      pushFloatText(char.x, char.z, `偃甲冷卻 ${char.mechCdRem.toFixed(1)}s`, '#fca5a5', false);
      return { ok: false, reason: 'COOLDOWN', rem: char.mechCdRem };
    }
    if (!mapCfg.isFreeGearZone && char.curGear < 40) {
      pushFloatText(char.x, char.z, '樞力不足', '#c084fc', false);
      return { ok: false, reason: 'LOW_GEAR' };
    }
    if (instantForTest) {
      char.mechPhase = 'ACTIVE_MERGED';
      char.mechGearTickAcc = 0;
      syncMechPacket();
      pushVfx({ kind: 'MECH_AWAKEN', toX: char.x, toZ: char.z, color: '#c084fc' });
      return { ok: true, phase: 'ACTIVE_MERGED' };
    }
    char.mechPhase = 'CASTING_7S';
    char.mechCastRem = 7.0;
    char.mechCastDmgTaken = 0;
    syncMechPacket();
    addLog('偃甲', '開始 7 秒上機：上緊樞輪發條（期間受傷超過最大生命 30% 會被打斷）。', '#c084fc');
    pushFloatText(char.x, char.z, '偃甲上機 7.0s...', '#c084fc', true);
    return { ok: true, phase: 'CASTING_7S' };
  }

  function syncMechPacket() {
    net.send(OPCODES.S2C_MECH_STATE_SYNC, {
      char_id: char.charId,
      phase: char.mechPhase,
      mech_tier: char.mechTier,
      current_gear: char.curGear,
      is_free_gear_zone: !!MAPS[char.mapId]?.isFreeGearZone,
    });
  }

  // 角色承受傷害（含上機 30% HP 打斷判定 ＋ 破罡硬直 ＋ 劫鏢匪懸紅）
  function applyDamageToHero(attacker, rawAtk, skillMult = 1.0, breakBeta = 1.15, { bypassDodge = false } = {}) {
    const d = getDerived();
    if (!bypassDodge && Math.random() < d.dodgeRate) {
      pushFloatText(char.x, char.z, '閃避', '#93c5fd', false);
      return { dodged: true };
    }
    const hit = resolveCombatHit({
      atkValue: rawAtk,
      skillMult,
      breakBeta,
      targetDef: d.physDef,
      atkElement: attacker?.element || 0,
      defElement: getActiveWeapon()?.element || 0,
      isCrit: Math.random() < Math.max(0.02, 0.10 - d.critResist),
      critMult: 1.45,
      pkMode: attacker?.kind === 'BANDIT',
      targetCurShield: char.curShield,
      targetCurHp: char.curHp,
      targetAlpha: d.shieldAlpha,
      targetMechMerged: char.mechPhase === 'ACTIVE_MERGED',
      targetMechTier: char.mechTier,
    });

    char.curShield = hit.remShield;
    char.curHp = hit.remHp;
    char.inCombatSec = 6.0;

    if (hit.isShieldBroken) {
      char.staggerSec = Math.max(char.staggerSec, hit.staggerSec);
      pushFloatText(char.x, char.z, `破罡！-${hit.hpDamage}`, '#ff2e4c', true);
      pushVfx({ kind: 'HERO_SHIELD_BREAK', toX: char.x, toZ: char.z, color: '#ff2e4c' });
      addLog('警告', '罡氣被破：承受 1.15× 易傷與 0.5 秒硬直，快服聚罡散。', '#ff4d6d');
    }

    // 7 秒上機打斷：累計承受超過最大 HP 30% 即打斷並冷卻 15 秒
    if (char.mechPhase === 'CASTING_7S') {
      char.mechCastDmgTaken += hit.hpDamage;
      if (char.mechCastDmgTaken > char.maxHp * 0.30) {
        char.mechPhase = 'COOLDOWN';
        char.mechCastRem = 0;
        char.mechCdRem = 15.0;
        syncMechPacket();
        pushFloatText(char.x, char.z, '上機被打斷！（15s冷卻）', '#ff4d6d', true);
        addLog('偃甲', '上機時受創超過最大氣血 30%，被打斷，冷卻 15 秒。', '#ff4d6d');
      }
    }

    if (char.curHp <= 0) {
      // 角色重傷回出生點（若被劫鏢匪擊倒，記下對方，可上懸紅榜）
      const killerName = attacker?.name || '江湖強敵';
      char.curHp = char.maxHp;
      char.curShield = char.maxShield;
      char.curMp = char.maxMp;
      char.staggerSec = 0;
      if (attacker?.kind === 'BANDIT') {
        char.lastPkKiller = { id: attacker.id, name: attacker.name, mapId: attacker.mapId, karma: attacker.karma || 200 };
        addLog('驛報', `你被劫鏢匪「${killerName}」打傷，可到【行會・懸紅榜】掛懸紅。`, '#fca5a5');
      } else {
        addLog('系統', char.mapId === 1001 ? '重傷調息，柳三娘把你扶回渡口，氣血與罡氣已回滿。' : `重傷，在${MAPS[char.mapId].name}的歇腳處調息，氣血與罡氣已回滿。`, '#fcd34d');
      }
      const sp = MAPS[char.mapId].spawn;
      char.x = sp.x;
      char.z = sp.z;
    }

    return hit;
  }

  // 地圖傳送
  function changeMap(targetMapId) {
    const m = MAPS[targetMapId];
    if (!m) return false;
    char.mapId = targetMapId;
    char.x = m.spawn.x;
    char.z = m.spawn.z;
    char.lockedTargetId = null;
    navTarget = null;
    beaconState = null;
    addLog('地圖', `已進入【${m.name}】（${m.sub}）${m.isFreeGearZone ? ' — 機樞地脈：偃甲不耗樞力。' : ''}`, '#7dd3fc');
    if (char.mechPhase === 'ACTIVE_MERGED') syncMechPacket();
    return true;
  }

  // 渡口行會全攤檢索 ＋ 朱砂引路線自動尋路
  function searchStalls(query = '') {
    const q = query.trim().toLowerCase();
    const all = playerStall ? [playerStall, ...stalls] : stalls;
    const matches = [];
    for (const st of all) {
      for (const it of st.items) {
        if (!q || st.title.toLowerCase().includes(q) || it.name.toLowerCase().includes(q) || it.desc.toLowerCase().includes(q)) {
          matches.push({ stall: st, item: it });
        }
      }
    }
    return matches;
  }

  function navigateToStall(stallId) {
    const all = playerStall ? [playerStall, ...stalls] : stalls;
    const st = all.find((s) => s.id === stallId);
    if (!st) return false;
    if (char.mapId !== 1001) changeMap(1001);
    char.autoHunt = false;
    navTarget = { x: st.x, z: st.z + 1.4, stallId: st.id, label: st.title };
    addLog('行會', `朱砂引路線已畫好，前往攤位：${st.title}`, '#fde047');
    return true;
  }

  function buyStallItem(stallId, itemId) {
    const st = stalls.find((s) => s.id === stallId);
    if (!st) return { ok: false, reason: 'NO_STALL' };
    const idx = st.items.findIndex((i) => i.id === itemId);
    if (idx < 0) return { ok: false, reason: 'SOLD_OUT' };
    const it = st.items[idx];
    if (char.silver < it.priceSilver) return fail('NO_SILVER', `銅錢不夠：「${it.name}」要 ${it.priceSilver}`);
    const g0 = it.grant || {};
    const slots = REBIRTH_STAGES[char.rebirthStage || 0]?.temperSlots ?? 2;
    if (g0.temperStone && equippedTemperStones.length >= slots) return fail('TEMPER_FULL', `淬紋槽已滿（${slots} 槽），晉升階位可多開`);

    char.silver -= it.priceSilver;
    const g = it.grant || {};
    if (g.iron) char.materials.iron += g.iron;
    if (g.protectScroll) char.materials.protectScroll += g.protectScroll;
    if (g.trueScroll) char.materials.trueScroll += g.trueScroll;
    if (g.martialScroll) char.materials.martialScroll += g.martialScroll;
    if (g.mechCores) char.materials.mechCores += g.mechCores;
    if (g.jadeDew) char.materials.jadeDew += g.jadeDew;
    if (g.shieldPots) char.potions.shield += g.shieldPots;
    if (g.hpPots) char.potions.hp += g.hpPots;
    if (g.temperStone) equippedTemperStones.push(g.temperStone);
    if (g.upgradeWeapon) {
      const w = weapons.find((x) => x.uid === g.upgradeWeapon.uid);
      if (w) w.upgrade = Math.max(w.upgrade, g.upgradeWeapon.level);
    }
    syncCaps(false);
    addLog('交易', `在【${st.owner}】攤位買下「${it.name}」，花費 ${it.priceSilver} 銅錢。`, '#fde047');
    pushFloatText(char.x, char.z, `購入 ${it.name}`, '#fde047', true);
    return { ok: true, item: it };
  }

  function setupConsignStall(title = '【鏢師寄攤】烏鋼雜貨', priceSilver = 1600) {
    playerStall = {
      id: 'stall-hero',
      owner: char.name,
      title: title.slice(0, 28),
      x: 0,
      z: -3.2,
      expiresHours: 24,
      isConsigned: true,
      items: [
        { id: 'hero-item-1', kind: 'MAT_IRON', name: '烏鋼料一組', desc: '寄攤商品：行會代看 24 時辰', priceSilver: Number(priceSilver) || 1600, grant: {} },
      ],
    };
    addLog('寄攤', `攤位已託給渡口行會代看 24 時辰：「${playerStall.title}」，離線也照常營業。`, '#6ee7b7');
    return playerStall;
  }

  // 掛懸紅與揭榜
  function issueBounty(targetId = 'pk-red-1', rewardSilver = 3000) {
    const cost = Math.max(500, Number(rewardSilver) || 3000);
    if (char.silver < cost) return fail('NO_SILVER', `銅錢不夠：張榜要 ${cost}`);
    const red = entities.find((e) => e.id === targetId) || { id: 'pk-red-1', name: '黑風刀客', mapId: 1002, karma: 360 };
    char.silver -= cost;
    const existing = bounties.find((b) => b.targetId === red.id && b.status !== 'CLAIMED');
    if (existing) {
      existing.rewardSilver += cost;
      existing.acceptedByHero = true;
      addLog('懸紅', `「${red.name}」的懸紅加到 ${existing.rewardSilver} 銅錢，追匪針已指向對方。`, '#fca5a5');
      return { ok: true, bounty: existing };
    }
    const b = {
      id: `bounty-${Date.now()}`,
      issuer: char.name,
      targetId: red.id,
      targetName: red.name,
      targetMapId: red.mapId || 1002,
      karma: red.karma || 220,
      rewardSilver: cost,
      status: 'ACCEPTED',
      acceptedByHero: true,
    };
    bounties.unshift(b);
    addLog('懸紅', `懸紅榜新增：${cost} 銅錢追拿劫鏢匪「${b.targetName}」，右上羅盤的追匪針已啟動。`, '#fca5a5');
    return { ok: true, bounty: b };
  }

  function acceptBounty(bountyId) {
    const b = bounties.find((x) => x.id === bountyId);
    if (!b || b.status === 'CLAIMED') return false;
    b.acceptedByHero = true;
    b.status = 'ACCEPTED';
    addLog('懸紅', `已揭「${b.targetName}」的懸紅榜：追匪針啟動，不必亮刃也能出手。`, '#fde047');
    return true;
  }

  // 換手：同一鏢師從電腦換到手機（或反過來），Opcode 3001；狀態原樣帶過去
  function performSessionHandoff(targetMode) {
    const fromDev = char.deviceType;
    const toDev = targetMode === 'mobile' ? 'MOBILE_TOUCH' : 'PC_WEBGPU';
    char.hudMode = targetMode;
    char.deviceType = toDev;
    const latencyMs = 142;
    const token = `SF-HANDOFF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const snap = {
      session_handoff_token: token,
      from_device: fromDev,
      to_device: toDev,
      handoff_latency_ms: latencyMs,
      current_pos: { x: Number(char.x.toFixed(2)), y: 0, z: Number(char.z.toFixed(2)) },
      locked_target_id: char.lockedTargetId || '',
      is_in_combat: char.inCombatSec > 0,
      cur_hp: char.curHp,
      cur_shield: char.curShield,
      cur_mp: char.curMp,
      cur_mech_gear: char.curGear,
    };
    net.send(OPCODES.S2C_SESSION_HANDOFF, snap);
    if (persist) saveStateSnapshot(snapshot());
    addLog('換手', `操作換成${toDev === 'MOBILE_TOUCH' ? '手機扇匣' : '電腦匣列'}，鎖定目標與罡氣原樣接著走。`, '#6ee7b7');
    return snap;
  }

  // 四維配點、武功突破、階位、鍛器與偃甲重鑄
  function allocateStat(statKey, amount = 1) {
    if (char.freeStatPoints < amount) return false;
    const mapKey = { STR: 'statStr', AGI: 'statAgi', CON: 'statCon', INT: 'statInt' }[statKey];
    if (!mapKey) return false;
    char.freeStatPoints -= amount;
    char[mapKey] += amount;
    syncCaps(false);
    return true;
  }

  function trainOrBreakthroughSkill(skillId) {
    const m = martials[skillId];
    const sk = SKILLS[skillId];
    if (!m || !sk) return { ok: false };
    if (sk.category === 'MECH') return fail('MECH_SKILL', '偃甲專屬技隨偃甲重鑄提升，不必修煉');
    if (m.layer < 12) {
      if (char.materials.martialScroll > 0) {
        char.materials.martialScroll -= 1;
        m.layer = Math.min(12, m.layer + 3);
      } else if (char.skillPoints >= 150) {
        char.skillPoints -= 150;
        m.layer = Math.min(12, m.layer + 1);
      } else {
        return fail('NO_SP', '武學手札與 SP 都不夠（升一重要 150 SP）');
      }
      if (m.layer === 12) m.prof = 10000;
      syncCaps(false);
      addLog('武學', `《${sk.name}》練到第 ${m.layer} 重。`, '#fde047');
      return { ok: true, layer: m.layer, isTrue: m.isTrue };
    }
    if (!m.isTrue) {
      if (char.materials.trueScroll <= 0) return fail('NO_TRUE_SCROLL', '缺《通玄心得》，到說書人老周的攤上找');
      char.materials.trueScroll -= 1;
      m.isTrue = true;
      m.layer = 13;
      syncCaps(false);
      addLog('突破', `《${sk.name}》突破第十三重「通玄」——【${sk.trueName}】（傷害 +35%、破罡 +20%）。`, '#f59e0b');
      pushFloatText(char.x, char.z, `通玄【${sk.trueName}】`, '#f59e0b', true);
      pushVfx({ kind: 'TRUE_MARTIAL', fromX: char.x, fromZ: char.z, toX: char.x, toZ: char.z, radius: 4.5, color: '#f59e0b', isTrue: true });
      return { ok: true, layer: 13, isTrue: true };
    }
    return { ok: false, reason: 'ALREADY_TRUE' };
  }

  function bindWeaponToSkill(skillId, weaponUid) {
    if (!martials[skillId]) return false;
    martials[skillId].linkedWeaponUid = weaponUid || null;
    const w = weapons.find((x) => x.uid === weaponUid);
    addLog('六器匣', `《${SKILLS[skillId]?.name}》出招時改抽：${w ? `+${w.upgrade} ${w.name}` : '不換兵器'}`, '#93c5fd');
    return true;
  }

  function upgradeWeapon(weaponUid, { useProtect = true, rng } = {}) {
    const w = weapons.find((x) => x.uid === weaponUid);
    if (!w) return { ok: false, reason: 'NO_WEAPON' };
    if (w.upgrade >= 12) return { ok: false, reason: 'MAX_LEVEL' };
    if (char.materials.iron <= 0) return fail('NO_IRON', '百鍊烏鋼用完了，到河西貨郎的攤上補');
    const useScroll = useProtect && w.upgrade >= 6 && char.materials.protectScroll > 0;
    char.materials.iron -= 1;
    if (useScroll) char.materials.protectScroll -= 1;

    const res = attemptWeaponUpgrade(w, { useProtectScroll: useScroll, rng });
    syncCaps(false);
    if (res.success) {
      const auraLabel = w.upgrade >= 7 ? `【${getWeaponAuraName(w.upgrade)}】` : '';
      addLog('鍛器', `鍛成了：「${w.name}」升到 +${w.upgrade} ${auraLabel}${res.guaranteedByPity ? '（爐溫已滿，這一次必成）' : ''}`, '#fde047');
      pushFloatText(char.x, char.z, `+${w.upgrade} ${w.name} 成功！`, '#fde047', true);
    } else {
      addLog('鍛器', `「${w.name}」這次沒鍛成（兵器無損），爐溫升到 ${w.pity}%。`, '#cbd5e1');
    }
    return res;
  }

  // 鍛爐「換五行」：照金→木→水→火→土的次序換到下一行，每次要烏鋼加爐錢
  function reforgeWeaponElement(weaponUid) {
    const w = weapons.find((x) => x.uid === weaponUid);
    if (!w) return { ok: false, reason: 'NO_WEAPON' };
    const cost = REFORGE_ELEMENT_COST;
    if (char.materials.iron < cost.iron) return fail('NO_IRON', `換五行要百鍊烏鋼 ${cost.iron} 塊，到河西貨郎的攤上補`);
    if (char.silver < cost.silver) return fail('NO_SILVER', `換五行要 ${cost.silver} 銅錢爐錢`);
    char.materials.iron -= cost.iron;
    char.silver -= cost.silver;
    const from = w.element;
    w.element = (w.element % 5) + 1;
    syncCaps(false);
    addLog('鍛器', `「${w.name}」重淬五行：${ELEMENTS[from]?.name || '無'} → ${ELEMENTS[w.element].name}（烏鋼 −${cost.iron}、銅錢 −${cost.silver}）`, '#fde047');
    return { ok: true, element: w.element, cost };
  }

  function advanceRebirth(targetStage) {
    const st = REBIRTH_STAGES[targetStage];
    if (!st) return { ok: false, reason: 'NO_STAGE' };
    const cur = char.rebirthStage || 0;
    if (!(REBIRTH_NEXT[cur] || []).includes(st.stage)) {
      const now = REBIRTH_STAGES[cur]?.name || '凡身';
      if (st.stage === cur) return fail('SAME_STAGE', `已經是【${now}】了`);
      if (st.stage < cur || (REBIRTH_STAGES[cur]?.path && st.path !== REBIRTH_STAGES[cur].path)) {
        return fail('NOT_NEXT', `晉升只往上走：【${now}】走不回【${st.name}】`);
      }
      return fail('NOT_NEXT', `要先晉升【${REBIRTH_STAGES[(REBIRTH_NEXT[cur] || [])[0]]?.name}】才輪得到【${st.name}】`);
    }
    // 等級不足時直接補到門檻等級，方便體驗各階位
    if (char.level < st.reqLv) {
      char.level = st.reqLv;
      char.freeStatPoints += 15;
    }
    char.rebirthStage = st.stage;
    char.faction = st.faction;
    syncCaps(true);
    addLog('階位', `祁鏢頭點撥，晉升【${st.name}】：攻擊與五行內功提升。`, '#f59e0b');
    pushFloatText(char.x, char.z, `晉升【${st.name}】`, '#f59e0b', true);
    pushVfx({ kind: 'TRUE_MARTIAL', fromX: char.x, fromZ: char.z, toX: char.x, toZ: char.z, radius: 5.0, color: '#fde047', isTrue: true });
    return { ok: true, stage: st };
  }

  function upgradeMechTier() {
    if (char.mechTier >= 3) return { ok: false, reason: 'MAX_TIER' };
    if (char.materials.mechCores < 2) return fail('NO_CORES', '機樞核心不夠：重鑄要 2 枚');
    char.materials.mechCores -= 2;
    char.mechTier += 1;
    char.mechParts.wings = true;
    if (char.mechTier >= 3) char.mechParts.weapon = true;
    syncCaps(false);
    const tInfo = MECH_TIERS[char.mechTier];
    addLog('偃甲', `偃甲重鑄完成：晉升第 ${char.mechTier} 階【${tInfo.name}】。`, '#c084fc');
    pushFloatText(char.x, char.z, `晉升【${tInfo.name}】`, '#c084fc', true);
    return { ok: true, tier: char.mechTier, name: tInfo.name };
  }

  function upgradeJadeCharm(charmId) {
    const charm = jadeCharms.find((o) => o.id === charmId);
    if (!charm || charm.tier >= 4) return false;
    if (char.materials.jadeDew <= 0) { fail('NO_DEW', '養玉露用完了，到遺墟拾荒人的攤上補'); return false; }
    char.materials.jadeDew -= 1;
    charm.tier += 1;
    syncCaps(false);
    addLog('玉珮', `養玉露溫養有成：【${charm.name}】升了一階。`, '#6ee7b7');
    return true;
  }

  function activateFrenzy() {
    if (char.frenzyGauge < 100 && char.frenzyActiveSec <= 0) {
      // 若差一點可消耗少許內力催動方便測試與爽快連戰
      if (char.frenzyGauge < 40) { fail('LOW_FRENZY', `酣戰值 ${Math.round(char.frenzyGauge)}%，攢到四成才點得開`); return false; }
    }
    char.frenzyGauge = 0;
    char.frenzyActiveSec = 12.0;
    pushFloatText(char.x, char.z, '酣戰・殺性上頭', '#d9a441', true);
    pushVfx({ kind: 'MECH_AWAKEN', toX: char.x, toZ: char.z, color: '#d9a441' });
    addLog('酣戰', '酣戰 12 秒：外內功傷害 +25%、武功冷卻縮短、腳程加快。', '#d9a441');
    return true;
  }

  // 烽燧點火：走到烽燧旁讀條 2.5 秒，點燃才知真假
  function igniteNearestBeacon() {
    if (char.mapId !== 1002) return fail('WRONG_MAP', '這裡沒有烽燧，烽燧在赤沙驛');
    let nearest = null, bestD = 999;
    for (const s of beacons) {
      const d = Math.hypot(s.x - char.x, s.z - char.z);
      if (d < bestD) { bestD = d; nearest = s; }
    }
    if (beaconState) return fail('IGNITING', '正在點火，等讀條走完', { log: false });
    if (!nearest || bestD > 4.2) return fail('TOO_FAR', `離【${nearest?.name}】還有 ${Math.ceil(bestD - 4.2)} 公尺，走近一點再點`);
    if (nearest.revealed) {
      // 點過的烽燧不再給驛稅：真的已有守驛人，假的柴是濕的
      const msg = nearest.isTrue ? `【${nearest.name}】已經點燃，守驛人是 ${nearest.owner}` : `【${nearest.name}】是假烽燧，點不燃`;
      pushFloatText(char.x, char.z, nearest.isTrue ? '烽燧已點燃' : '假烽燧', '#cbd5e1', false);
      addLog('烽燧', msg, '#cbd5e1');
      return { ok: false, reason: nearest.isTrue ? 'ALREADY_HELD' : 'FAKE', beacon: nearest };
    }
    beaconState = { beaconId: nearest.id, rem: 2.5 };
    addLog('烽燧', `正在點燃【${nearest.name}】...`, '#fde047');
    return { ok: true, beacon: nearest };
  }

  // 主迴圈確定性 Tick 步進（dt 秒）
  function step(dt, input) {
    input = input || { moveX: 0, moveZ: 0 };
    const clampedDt = Math.min(0.1, Math.max(0.001, dt));
    simTime += clampedDt;
    const d = getDerived();

    // 冷卻與狀態遞減
    for (const k of Object.keys(skillCooldowns)) {
      if (skillCooldowns[k] > 0) skillCooldowns[k] = Math.max(0, skillCooldowns[k] - clampedDt);
    }
    if (dashCd > 0) dashCd = Math.max(0, dashCd - clampedDt);
    if (char.potionCd > 0) char.potionCd = Math.max(0, char.potionCd - clampedDt);
    if (char.staggerSec > 0) char.staggerSec = Math.max(0, char.staggerSec - clampedDt);
    if (char.slowSec > 0) char.slowSec = Math.max(0, char.slowSec - clampedDt);
    if (char.inCombatSec > 0) char.inCombatSec = Math.max(0, char.inCombatSec - clampedDt);
    if (char.frenzyActiveSec > 0) char.frenzyActiveSec = Math.max(0, char.frenzyActiveSec - clampedDt);

    // 歸息訣自然調息（脫戰快、戰鬥中慢回罡氣與內力）
    const breathLv = martials[802]?.layer || 1;
    const shieldRegen = (char.inCombatSec <= 0 ? 28 : 6) + breathLv * 2.2;
    const mpRegen = 9 + breathLv * 1.5;
    char.curShield = Math.min(char.maxShield, char.curShield + shieldRegen * clampedDt);
    char.curMp = Math.min(char.maxMp, char.curMp + mpRegen * clampedDt);
    if (char.inCombatSec <= 0) {
      char.curHp = Math.min(char.maxHp, char.curHp + 18 * clampedDt);
    }

    // 偃甲狀態機
    const isFreeGear = !!MAPS[char.mapId]?.isFreeGearZone;
    if (char.mechPhase === 'CASTING_7S') {
      char.mechCastRem -= clampedDt;
      if (char.mechCastRem <= 0) {
        char.mechPhase = 'ACTIVE_MERGED';
        char.mechCastRem = 0;
        char.mechGearTickAcc = 0;
        syncMechPacket();
        pushFloatText(char.x, char.z, `【${MECH_TIERS[char.mechTier].name}】上機完成`, '#c084fc', true);
        pushVfx({ kind: 'MECH_AWAKEN', toX: char.x, toZ: char.z, color: '#c084fc' });
        addLog('偃甲', `【${MECH_TIERS[char.mechTier].name}】上機完成：霸體，分攤 ${Math.round(MECH_TIERS[char.mechTier].absorb * 100)}% 承受傷害。`, '#c084fc');
      }
    } else if (char.mechPhase === 'ACTIVE_MERGED') {
      if (!isFreeGear) {
        // 地脈之外：每 5 秒固定消耗 40 點樞力
        char.mechGearTickAcc += clampedDt;
        while (char.mechGearTickAcc >= 5.0) {
          char.mechGearTickAcc -= 5.0;
          char.curGear = Math.max(0, char.curGear - 40);
          syncMechPacket();
          if (char.curGear <= 0) {
            char.mechPhase = 'INACTIVE';
            addLog('偃甲', '樞力耗盡，偃甲停機，已自動離開。', '#cbd5e1');
            break;
          }
        }
      }
    } else if (char.mechPhase === 'COOLDOWN') {
      char.mechCdRem = Math.max(0, char.mechCdRem - clampedDt);
      if (char.mechCdRem <= 0) char.mechPhase = 'INACTIVE';
      char.curGear = Math.min(char.maxGear, char.curGear + 14 * clampedDt);
    } else {
      char.curGear = Math.min(char.maxGear, char.curGear + 18 * clampedDt);
    }

    // 藥囊自動閾值（罡氣 <= 40% 自動服聚罡散）
    if (char.autoPotionEnabled && char.potionCd <= 0 && char.inCombatSec > 0) {
      if (char.curShield / char.maxShield <= char.autoShieldThreshold && char.potions.shield > 0) {
        useSmartPotion('SHIELD_CYAN', true);
      } else if (char.curHp / char.maxHp <= char.autoHpThreshold && char.potions.hp > 0) {
        useSmartPotion('HP_RED', true);
      }
    }

    // 角色移動：手動搖桿/WASD > 朱砂引路線 > 自動狩獵
    let mx = input.moveX || 0;
    let mz = input.moveZ || 0;
    const hasManualMove = Math.hypot(mx, mz) > 0.05;
    if (hasManualMove) {
      navTarget = null;
      beaconState = null;
    } else if (navTarget) {
      const dx = navTarget.x - char.x;
      const dz = navTarget.z - char.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.75) {
        const arrivedStallId = navTarget.stallId;
        navTarget = null;
        char.arrivedStallId = arrivedStallId;
        addLog('行會', '到了，打開攤位貨單。', '#fde047');
      } else {
        mx = dx / dist;
        mz = dz / dist;
      }
    } else if (char.autoHunt && char.staggerSec <= 0) {
      const targets = getMapEntities(false).filter((e) => e.kind !== 'DUMMY' && isTargetAttackable(e));
      targets.sort((a, b) => Math.hypot(a.x - char.x, a.z - char.z) - Math.hypot(b.x - char.x, b.z - char.z));
      const tgt = targets[0];
      if (tgt) {
        char.lockedTargetId = tgt.id;
        const dx = tgt.x - char.x, dz = tgt.z - char.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 3.2) {
          mx = dx / dist;
          mz = dz / dist;
        } else {
          // 自動狩獵：輪流施放偃甲技或代表武功
          const rotSkills = char.mechPhase === 'ACTIVE_MERGED'
            ? [9001, 9002, 301, 101]
            : [301, 101, 601, 701, 201];
          for (const sid of rotSkills) {
            if ((skillCooldowns[sid] || 0) <= 0.05) {
              castLinkedSkill(sid, { targetId: tgt.id });
              break;
            }
          }
        }
      }
    }

    if (char.staggerSec <= 0 && Math.hypot(mx, mz) > 0.02) {
      const len = Math.hypot(mx, mz);
      const nx = mx / len, nz = mz / len;
      const slowFactor = char.slowSec > 0 ? 0.65 : 1.0;
      const frenzySpeed = char.frenzyActiveSec > 0 ? 1.18 : 1.0;
      const spd = d.moveSpeed * slowFactor * frenzySpeed;
      char.x = clampCoord(char.x + nx * spd * clampedDt);
      char.z = clampCoord(char.z + nz * spd * clampedDt);
      pushOutOfBlockers(char);
      char.rotY = Math.atan2(nx, nz);
    }

    // 烽燧點火讀條推進
    if (beaconState) {
      beaconState.rem -= clampedDt;
      if (beaconState.rem <= 0) {
        const st = beacons.find((s) => s.id === beaconState.beaconId);
        beaconState = null;
        if (st) {
          st.revealed = true;
          if (st.isTrue) {
            st.owner = char.name;
            outpostHolder = char.name;
            char.silver += 3500;
            char.materials.iron += 4;
            addLog('烽燧', `【${st.name}】點燃了，是真烽燧。赤沙驛歸你守，得驛稅 3,500 銅錢與百鍊烏鋼×4。`, '#fde047');
            pushFloatText(char.x, char.z, '烽燧點燃！守下赤沙驛', '#fde047', true);
          } else {
            addLog('烽燧', `【${st.name}】的柴是濕的，點不燃，是假烽燧。去試另外兩座。`, '#cbd5e1');
            pushFloatText(char.x, char.z, '假烽燧', '#94a3b8', true);
          }
        }
      }
    }

    // 地圖怪物與劫鏢匪 AI 行為更新
    const inSafePlaza = char.mapId === 1001 && Math.abs(char.x) < 13 && char.z > -11.5;
    for (const ent of entities) {
      if (ent.mapId !== char.mapId) continue;
      if (ent.respawnRem > 0) {
        ent.respawnRem -= clampedDt;
        if (ent.respawnRem <= 0) {
          ent.curHp = ent.maxHp;
          ent.curShield = ent.maxShield;
          ent.x = ent.spawnX;
          ent.z = ent.spawnZ;
          ent.staggerSec = 0;
          ent.dotSec = 0;
        }
        continue;
      }
      if (ent.curHp <= 0 || ent.kind === 'DUMMY') continue;

      if (ent.staggerSec > 0) ent.staggerSec = Math.max(0, ent.staggerSec - clampedDt);
      if (ent.slowSec > 0) ent.slowSec = Math.max(0, ent.slowSec - clampedDt);
      if (ent.dotSec > 0) {
        ent.dotSec = Math.max(0, ent.dotSec - clampedDt);
        ent.curHp = Math.max(1, ent.curHp - ent.dotDps * clampedDt);
      }

      const dx = char.x - ent.x;
      const dz = char.z - ent.z;
      const dist = Math.hypot(dx, dz);
      const aggroRange = ent.kind === 'BANDIT' ? 9.5 : (ent.kind === 'BOSS' ? 10.5 : 6.8);
      const wasHit = ent.curHp < ent.maxHp || ent.curShield < ent.maxShield;
      const canAggro = !inSafePlaza && (
        wasHit ||
        (ent.kind === 'BANDIT' && ent.aggressive && (char.pkMode || char.sandstormNight || bounties.some((b) => b.targetId === ent.id && b.acceptedByHero && b.status !== 'CLAIMED'))) ||
        (ent.kind !== 'BANDIT' && dist < aggroRange)
      );

      if (canAggro && dist < 16 && ent.staggerSec <= 0) {
        ent.attackingHero = ent.kind === 'BANDIT';
        ent.rotY = Math.atan2(dx, dz);
        if (dist > 2.4) {
          const mSpd = (ent.slowSec > 0 ? 1.8 : 3.1);
          ent.x += (dx / dist) * mSpd * clampedDt;
          ent.z += (dz / dist) * mSpd * clampedDt;
          pushOutOfBlockers(ent, 0.6, ent.mapId);
        } else {
          ent.atkCd -= clampedDt;
          if (ent.atkCd <= 0) {
            ent.atkCd = ent.kind === 'BANDIT' ? 1.55 : 1.95;
            applyDamageToHero(ent, ent.atk, 1.0, ent.kind === 'BANDIT' ? 1.35 : 1.10);
          }
        }
      } else {
        ent.attackingHero = false;
        // 脫戰緩回罡氣並走回出生點
        ent.curShield = Math.min(ent.maxShield, ent.curShield + 15 * clampedDt);
        const homeDist = Math.hypot(ent.spawnX - ent.x, ent.spawnZ - ent.z);
        if (homeDist > 1.2) {
          ent.x += ((ent.spawnX - ent.x) / homeDist) * 2.0 * clampedDt;
          ent.z += ((ent.spawnZ - ent.z) / homeDist) * 2.0 * clampedDt;
          pushOutOfBlockers(ent, 0.6, ent.mapId);
        }
      }
    }

    // 浮空跳字生命週期
    for (let i = floatTexts.length - 1; i >= 0; i--) {
      floatTexts[i].age += clampedDt;
      floatTexts[i].y += clampedDt * 1.15;
      if (floatTexts[i].age >= floatTexts[i].ttl) floatTexts.splice(i, 1);
    }
  }

  // 追匪針：指向已揭懸紅榜的劫鏢匪
  function getActiveBountyCompass() {
    const b = bounties.find((x) => x.acceptedByHero && x.status !== 'CLAIMED');
    if (!b) return null;
    const targetEnt = entities.find((e) => e.id === b.targetId);
    if (!targetEnt) return null;
    const sameMap = targetEnt.mapId === char.mapId;
    const angle = sameMap ? Math.atan2(targetEnt.x - char.x, targetEnt.z - char.z) : 0;
    const dist = sameMap ? Math.round(Math.hypot(targetEnt.x - char.x, targetEnt.z - char.z)) : null;
    return {
      bounty: b,
      sameMap,
      mapName: MAPS[targetEnt.mapId]?.name || '未知',
      x: Math.round(targetEnt.x),
      z: Math.round(targetEnt.z),
      angle,
      dist,
    };
  }

  function advance(seconds, input) {
    let rem = Math.max(0, seconds);
    while (rem > 1e-6) {
      const s = Math.min(0.05, rem);
      step(s, input);
      rem -= s;
    }
  }

  return {
    net,
    char,
    weapons,
    martials,
    jadeCharms,
    equippedTemperStones,
    skillCooldowns,
    stalls,
    getPlayerStall: () => playerStall,
    bounties,
    beacons,
    getOutpostHolder: () => outpostHolder,
    getBeaconState: () => beaconState,
    getNavTarget: () => navTarget,
    clearNavTarget: () => { navTarget = null; },
    chatLogs,
    vfxQueue,
    floatTexts,
    entities,
    getActiveWeapon,
    getDerived,
    syncCaps,
    getMapEntities,
    getThreatRadarList,
    getActiveBountyCompass,
    castLinkedSkill,
    castQinggongDash,
    useSmartPotion,
    toggleMechSummon,
    applyDamageToHero,
    changeMap,
    searchStalls,
    navigateToStall,
    buyStallItem,
    setupConsignStall,
    issueBounty,
    acceptBounty,
    performSessionHandoff,
    allocateStat,
    trainOrBreakthroughSkill,
    bindWeaponToSkill,
    upgradeWeapon,
    advanceRebirth,
    reforgeWeaponElement,
    isBlocked,
    upgradeMechTier,
    upgradeJadeCharm,
    activateFrenzy,
    igniteNearestBeacon,
    step,
    advance,
    save: () => (persist ? saveStateSnapshot(snapshot()) : false),
  };
}

function clampCoord(v) {
  return Math.max(-25.5, Math.min(25.5, v));
}
