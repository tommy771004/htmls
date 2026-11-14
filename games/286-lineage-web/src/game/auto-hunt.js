// 286 智慧自動練功（內掛）控制器：支援靜態障礙物／牆壁／建築碰撞偵測與重新規劃（明確排除怪物）
import { tileDistance, HEADING_DELTAS } from './map-iso.js';
import { AOE_SPELLS, CRAFT_MATERIAL_SET, DEFAULT_AUTO_CONFIG, UNDEAD_MOBS } from './world-state.js';
import { getMapMeta, isSafetyZone } from './world-maps.js';

export const AUTO_PRESETS = {
  melee: {
    label: '近戰穩刷',
    patch: {
      potEnabled: true,
      preferredPot: 'auto',
      potThreshold: 58,
      emergencyPotThreshold: 28,
      emergencyPot: '白色藥水',
      autoHealSpell: true,
      healSpellThreshold: 60,
      healSpellMode: 'light',
      escapeEnabled: true,
      escapeHpPercent: 18,
      escapeAction: 'home',
      autoCurePoison: true,
      autoEatFood: true,
      huntMode: 'anchor',
      radius: 14,
      tickMs: 260,
      obstacleAvoidance: true,
      obstacleLookahead: 4,
      avoidWallHug: true,
      avoidPortals: true,
      avoidSafetyBorder: true,
      targetPriority: 'nearest',
      retaliateAggro: true,
      switchOnBlocked: true,
      kiteRanged: false,
      autoDefBuffs: true,
      autoCombatBuffs: true,
      autoAttackSpell: false,
      pickupDrops: true,
      lootFilter: 'all',
      pickupPriority: 'afterKill',
    },
  },
  archer: {
    label: '弓手拉打',
    patch: {
      potEnabled: true,
      preferredPot: 'auto',
      potThreshold: 50,
      emergencyPotThreshold: 25,
      emergencyPot: '白色藥水',
      autoHealSpell: true,
      healSpellThreshold: 65,
      healSpellMode: 'auto',
      escapeEnabled: true,
      escapeHpPercent: 20,
      escapeAction: 'home',
      autoCurePoison: true,
      autoEatFood: true,
      huntMode: 'anchor',
      radius: 16,
      tickMs: 250,
      obstacleAvoidance: true,
      obstacleLookahead: 5,
      avoidWallHug: true,
      avoidPortals: true,
      avoidSafetyBorder: true,
      targetPriority: 'nearest',
      retaliateAggro: true,
      switchOnBlocked: true,
      kiteRanged: true,
      kiteDistance: 2,
      switchMeleeNoArrows: true,
      autoHaste: true,
      autoDefBuffs: true,
      autoCombatBuffs: true,
      autoAttackSpell: false,
      pickupDrops: true,
      lootFilter: 'all',
      pickupPriority: 'afterKill',
    },
  },
  mage: {
    label: '法師砲台',
    patch: {
      potEnabled: true,
      preferredPot: 'auto',
      potThreshold: 52,
      emergencyPotThreshold: 26,
      emergencyPot: '白色藥水',
      autoHealSpell: true,
      healSpellThreshold: 72,
      healSpellMode: 'auto',
      escapeEnabled: true,
      escapeHpPercent: 22,
      escapeAction: 'home',
      autoCurePoison: true,
      autoEatFood: true,
      huntMode: 'anchor',
      radius: 15,
      tickMs: 260,
      obstacleAvoidance: true,
      obstacleLookahead: 4,
      avoidWallHug: true,
      avoidPortals: true,
      avoidSafetyBorder: true,
      targetPriority: 'aggroFirst',
      retaliateAggro: true,
      switchOnBlocked: true,
      kiteRanged: true,
      kiteDistance: 2,
      autoBlue: true,
      autoWisdom: true,
      autoDefBuffs: true,
      autoCombatBuffs: false,
      autoMeditate: true,
      autoAttackSpell: true,
      attackSpellId: 'auto',
      minMpReservePct: 25,
      aoeMinCount: 2,
      autoTurnUndead: true,
      autoVampireTouch: true,
      pickupDrops: true,
      lootFilter: 'all',
      pickupPriority: 'afterKill',
    },
  },
  eco: {
    label: '省水節能',
    patch: {
      potEnabled: true,
      preferredPot: '紅色藥水',
      potThreshold: 40,
      emergencyPotThreshold: 18,
      emergencyPot: '橙色藥水',
      autoHealSpell: true,
      healSpellThreshold: 58,
      healSpellMode: 'light',
      escapeEnabled: true,
      escapeHpPercent: 16,
      escapeAction: 'home',
      autoCurePoison: true,
      autoEatFood: true,
      huntMode: 'anchor',
      radius: 12,
      tickMs: 360,
      obstacleAvoidance: true,
      obstacleLookahead: 4,
      avoidWallHug: true,
      avoidPortals: true,
      avoidSafetyBorder: true,
      targetPriority: 'weakest',
      retaliateAggro: true,
      switchOnBlocked: true,
      safeLevelCap: true,
      avoidBoss: true,
      kiteRanged: false,
      autoHaste: false,
      autoBrave: false,
      autoBlue: false,
      autoCombatBuffs: false,
      autoMeditate: true,
      autoAttackSpell: false,
      pickupDrops: true,
      lootFilter: 'all',
      pickupPriority: 'immediate',
    },
  },
};

const HEAL_TIERS = {
  greater: [35, 19, 1],
  medium: [19, 1],
  light: [1],
};
const SINGLE_ATTACK_SPELLS = [46, 38, 17, 16, 15, 7, 6, 4];
const AOE_ATTACK_SPELLS = [34, 25, 45, 22, 37];
const POT_ORDER_MAP = {
  白色藥水: ['白色藥水', '橙色藥水', '紅色藥水'],
  橙色藥水: ['橙色藥水', '紅色藥水', '白色藥水'],
  紅色藥水: ['紅色藥水', '橙色藥水', '白色藥水'],
};

/**
 * 智慧自動練功控制器，整合生存補給、狀態增益、障礙碰撞閃避重算與目標篩選。
 */
export class AutoHuntController {
  constructor(world) {
    this.world = world;
    this.lastTick = 0;
    this.recentObstacles = [];
    this.blockedTiles = new Map();
    this.unreachableTargets = new Map();
    this.unreachableDrops = new Map();
    this.recentPositions = [];
    this.lastProgressAt = performance.now();
    this.lastPos = { map: world.player.map, tx: world.player.tx, ty: world.player.ty };
    this.patrolSectorIdx = 0;
    this.lastRoamAt = 0;
    this.lastDropAttemptId = null;
    this.lastDropAttemptAt = 0;
    this.lastNoPotWarnAt = 0;
    this.stats = this.#createEmptyStats();
  }

  #createEmptyStats() {
    const p = this.world.player;
    return {
      startedAt: performance.now(),
      killsBase: p.kills || 0,
      goldBase: p.gold || 0,
      obstacleHits: 0,
      replans: 0,
      lastObstacleKind: '',
      lastObstacleLabel: '尚無',
      lastObstacleTx: 0,
      lastObstacleTy: 0,
      lastObstacleAt: 0,
      statusText: p.autoConfig?.enabled ? '啟動中' : '待機中',
    };
  }

  get statusLabel() {
    return this.stats.statusText;
  }

  set statusLabel(val) {
    this.stats.statusText = String(val || '待機中');
  }

  /**
   * 切換自動練功啟用狀態並紀錄日誌與基準錨點。
   */
  toggle() {
    return this.world.toggleAutoHunt(
      `啟動自動練功（基準點 ${this.world.player.tx}, ${this.world.player.ty}，半徑 ${this.world.player.autoConfig.radius} 格）。`,
      '已停止自動練功。',
    );
  }

  /**
   * 當外掛從外部（指令／符石／按鈕）切換啟用狀態時同步錨點與統計。
   */
  onExternalToggle(enabled) {
    const p = this.world.player;
    const now = performance.now();
    if (enabled) {
      this.resetStats(now);
      if (!p.autoConfig.anchor || p.autoConfig.anchor.map !== p.map) {
        p.autoConfig.anchor = { map: p.map, x: p.tx, y: p.ty };
      }
      this.stats.statusText = '巡邏尋敵中';
    } else {
      this.stats.statusText = '已暫停';
    }
  }

  /**
   * 立即以目前位置重設掛機錨點。
   */
  resetAnchor() {
    const p = this.world.player;
    p.autoConfig.anchor = { map: p.map, x: p.tx, y: p.ty };
    this.blockedTiles.clear();
    this.world.addLog(`已更新內掛基準錨點至（${p.tx}, ${p.ty}）。`, 'cyan');
    this.world.dirtySave = true;
    return p.autoConfig.anchor;
  }

  /**
   * 套用一鍵掛機方案並保留啟用狀態與錨點。
   */
  applyPreset(presetId) {
    const preset = AUTO_PRESETS[presetId];
    if (!preset) return false;
    const cfg = this.world.player.autoConfig;
    Object.assign(cfg, preset.patch, { preset: presetId });
    this.world.dirtySave = true;
    this.world.addLog(`已套用內掛方案【${preset.label}】。`, 'gold');
    return true;
  }

  /**
   * 將所有自動設定回復為出廠預設（保留開關與錨點）。
   */
  resetConfigToDefaults() {
    const cfg = this.world.player.autoConfig;
    const keepEnabled = Boolean(cfg.enabled);
    const keepAnchor = cfg.anchor || null;
    Object.assign(cfg, DEFAULT_AUTO_CONFIG, { enabled: keepEnabled, anchor: keepAnchor, preset: 'custom' });
    this.world.dirtySave = true;
    this.world.addLog('已將內掛詳細參數重設為預設值。', 'cyan');
  }

  /**
   * 重置本次掛機統計與障礙偵測紀錄。
   */
  resetStats(now = performance.now()) {
    this.stats = this.#createEmptyStats();
    this.stats.startedAt = now;
    this.recentObstacles = [];
    this.blockedTiles.clear();
    this.unreachableTargets.clear();
    this.unreachableDrops.clear();
    this.recentPositions = [];
    this.lastProgressAt = now;
    this.lastPos = { map: this.world.player.map, tx: this.world.player.tx, ty: this.world.player.ty };
  }

  /**
   * 解析名單字串為 Set，供白名單／黑名單查詢。
   */
  getMobFilterSet() {
    const raw = String(this.world.player.autoConfig?.mobFilterNames || '');
    const set = new Set();
    for (const part of raw.split(/[,，、\n;]+/)) {
      const name = part.trim();
      if (name) set.add(name);
    }
    return set;
  }

  /**
   * 回傳供 HUD 與自動化測試讀取的即時掛機摘要數據。
   */
  getSummary(now = performance.now()) {
    const p = this.world.player;
    const elapsedSec = Math.max(0, Math.floor((now - this.stats.startedAt) / 1000));
    return {
      enabled: Boolean(p.autoConfig?.enabled),
      elapsedSec,
      killsGained: Math.max(0, (p.kills || 0) - this.stats.killsBase),
      goldGained: Math.max(0, (p.gold || 0) - this.stats.goldBase),
      obstacleHits: this.stats.obstacleHits,
      replans: this.stats.replans,
      lastObstacleKind: this.stats.lastObstacleKind,
      lastObstacleLabel: this.stats.lastObstacleLabel,
      lastObstacleTx: this.stats.lastObstacleTx,
      lastObstacleTy: this.stats.lastObstacleTy,
      statusText: this.stats.statusText,
      recentObstacleCount: this.recentObstacles.length,
    };
  }

  /**
   * 內掛每幀入口（別名，轉呼叫節流後的 update）。
   */
  step(now = performance.now()) {
    this.update(now);
  }

  /**
   * 內掛主循環（由 engine 每幀呼叫並依設定 tickMs 節流執行）。
   */
  update(now = performance.now()) {
    const p = this.world.player;
    const cfg = p.autoConfig;
    if (!cfg?.enabled || p.hp <= 0) return;

    const tickMs = Math.max(150, Math.min(800, Number(cfg.tickMs) || 280));
    if (now - this.lastTick < tickMs) return;
    this.lastTick = now;

    if (!cfg.anchor || cfg.anchor.map !== p.map) {
      cfg.anchor = { map: p.map, x: p.tx, y: p.ty };
    }

    this.#pruneExpiries(now, p.map);

    if (this.#handlePotionsAndEmergency(now)) return;
    if (this.#handleMaintenanceAndBuffs(now)) return;

    // 若玩家身處地圖安全區且開啟避開安全邊界，先尋找鄰近獵場或維持狀態
    if (cfg.avoidSafetyBorder && isSafetyZone(p.map, p.tx, p.ty, this.world.isoMap) && !p.targetId) {
      this.stats.statusText = '位於安全區內，尋找可行走出口';
    }

    if (this.#updateProgressAndDetectObstacles(now)) return;

    const hpPct = (p.hp / Math.max(1, p.maxHp)) * 100;
    if (cfg.pickupDrops && cfg.pickupPriority === 'immediate' && hpPct > cfg.potThreshold) {
      if (this.#handleLootPickup(now)) return;
    }

    if (this.#evaluateCurrentTarget(now)) return;

    if (cfg.pickupDrops && (!p.targetId || cfg.pickupPriority !== 'afterKill' || !this.#findNearbyAggro())) {
      if (this.#handleLootPickup(now)) return;
    }

    if (!p.targetId && !p.pendingPickupId && !p.path.length) {
      if (this.#selectBestTarget(now)) return;
      if (cfg.pickupDrops && this.#handleLootPickup(now)) return;
      this.#handlePatrolOrRoam(now);
    }
  }

  #pruneExpiries(now, mapId) {
    this.recentObstacles = this.recentObstacles.filter((o) => o.map === mapId && now - o.at < 18000);
    for (const [key, rec] of this.blockedTiles.entries()) {
      if (rec.until <= now || !key.startsWith(`${mapId}:`)) this.blockedTiles.delete(key);
    }
    for (const [id, until] of this.unreachableTargets.entries()) {
      if (until <= now) this.unreachableTargets.delete(id);
    }
    for (const [id, until] of this.unreachableDrops.entries()) {
      if (until <= now) this.unreachableDrops.delete(id);
    }
  }

  #findItemByNames(names) {
    const inv = this.world.player.inventory;
    for (const name of names) {
      const item = inv.find((i) => i.name === name && i.count > 0);
      if (item) return item;
    }
    return null;
  }

  #tryTeleportEscape(now, cfg) {
    const p = this.world.player;
    const meta = getMapMeta(p.map);
    if (cfg.escapeAction === 'teleport' && meta.tele) {
      const scroll = this.#findItemByNames(['瞬間移動的卷軸']);
      if (scroll) {
        this.world.useItem(scroll);
        p.targetId = null;
        p.path = [];
        this.stats.statusText = '緊急瞬移脫離';
        return true;
      }
      if (p.spells.includes(5) && p.mp >= 5 && now - p.lastSpellAt >= 700) {
        if (this.world.castSpell(5)) {
          p.targetId = null;
          p.path = [];
          this.stats.statusText = '施放指定傳送脫離';
          return true;
        }
      }
    }
    const homeScroll = this.#findItemByNames(['傳送回家的卷軸']);
    if (homeScroll && meta.recall !== false) {
      this.world.useItem(homeScroll);
      cfg.enabled = false;
      p.targetId = null;
      p.path = [];
      this.stats.statusText = '緊急回村（已暫停）';
      this.world.addLog('【內掛避難】生命值過低，已自動回村並暫停自動練功。', 'warn');
      this.world.dirtySave = true;
      return true;
    }
    return false;
  }

  #handlePotionsAndEmergency(now) {
    const p = this.world.player;
    const cfg = p.autoConfig;
    const hpPct = (p.hp / Math.max(1, p.maxHp)) * 100;
    const missingHp = Math.max(0, p.maxHp - p.hp);

    if (cfg.escapeEnabled && hpPct <= cfg.escapeHpPercent && !isSafetyZone(p.map, p.tx, p.ty, this.world.isoMap)) {
      if (this.#tryTeleportEscape(now, cfg)) return true;
    }

    if (cfg.potEnabled && now - p.lastPotionAt >= 520) {
      let order = null;
      if (hpPct <= cfg.emergencyPotThreshold) {
        const em = cfg.emergencyPot || '白色藥水';
        order = [em, ...(POT_ORDER_MAP[em] || ['白色藥水', '橙色藥水', '紅色藥水'])];
      } else if (hpPct <= cfg.potThreshold) {
        if (cfg.preferredPot === 'auto') {
          order = missingHp >= 75 ? ['白色藥水', '橙色藥水', '紅色藥水'] : missingHp >= 42 ? ['橙色藥水', '紅色藥水', '白色藥水'] : ['紅色藥水', '橙色藥水', '白色藥水'];
        } else {
          order = POT_ORDER_MAP[cfg.preferredPot] || ['紅色藥水', '橙色藥水', '白色藥水'];
        }
      }

      if (order) {
        const pot = this.#findItemByNames(order);
        if (pot) {
          this.world.useItem(pot);
        } else if (cfg.noPotAction === 'home') {
          const homeScroll = this.#findItemByNames(['傳送回家的卷軸']);
          if (homeScroll && getMapMeta(p.map).recall !== false) this.world.useItem(homeScroll);
          cfg.enabled = false;
          this.stats.statusText = '紅水耗盡回村';
          this.world.addLog('【內掛】治療藥水耗盡，已執行回村保護並暫停掛機。', 'warn');
          this.world.dirtySave = true;
          return true;
        } else if (cfg.noPotAction === 'pause') {
          cfg.enabled = false;
          this.stats.statusText = '無藥水暫停';
          this.world.addLog('【內掛】治療藥水耗盡，已原地暫停掛機。', 'warn');
          this.world.dirtySave = true;
          return true;
        } else if (now - this.lastNoPotWarnAt > 15000) {
          this.lastNoPotWarnAt = now;
          this.world.addLog('【內掛提醒】背包已無治療藥水，改以治癒法術維持血量。', 'warn');
        }
      }
    }

    if (cfg.autoHealSpell && hpPct <= cfg.healSpellThreshold && now - p.lastSpellAt >= 780) {
      const tiers =
        cfg.healSpellMode === 'auto'
          ? missingHp >= 85
            ? [35, 19, 1]
            : missingHp >= 45
              ? [19, 35, 1]
              : [1, 19, 35]
          : HEAL_TIERS[cfg.healSpellMode] || [35, 19, 1];
      for (const sid of tiers) {
        if (!p.spells.includes(sid)) continue;
        const sp = (this.world.worldData.spells || []).find((s) => s.id === sid);
        if (sp && p.mp >= sp.mp && this.world.castSpell(sid)) {
          break;
        }
      }
    }

    return false;
  }

  #tryCastBuffSpell(sid, now, reserveMpPct = 0) {
    const p = this.world.player;
    if (!p.spells.includes(sid) || now - p.lastSpellAt < 820) return false;
    const sp = (this.world.worldData.spells || []).find((s) => s.id === sid);
    if (!sp || p.mp < sp.mp) return false;
    if (reserveMpPct > 0 && ((p.mp - sp.mp) / Math.max(1, p.maxMp)) * 100 < reserveMpPct) return false;
    return this.world.castSpell(sid);
  }

  #handleMaintenanceAndBuffs(now) {
    const p = this.world.player;
    const cfg = p.autoConfig;

    if (cfg.autoCurePoison && (p.buffs.poison || 0) > now) {
      const item = this.#findItemByNames(['翡翠藥水', '解除咀咒的卷軸']);
      if (item) {
        this.world.useItem(item);
        return false;
      }
      if (this.#tryCastBuffSpell(9, now, 0)) return false;
    }

    if (cfg.autoEatFood && (p.food ?? 80) <= cfg.autoEatThreshold) {
      const food = this.#findItemByNames(['漂浮魔眼的肉', '肉']);
      if (food) {
        this.world.useItem(food);
        return false;
      }
    }

    if (cfg.switchMeleeNoArrows && p.weaponType === 'bow') {
      const hasArrows = p.inventory.some((i) => this.world.worldData.items[i.name]?.type === 'arrow' && i.count > 0);
      if (!hasArrows) {
        const clsIdx = this.world.worldData.classes[p.classId]?.clsIdx ?? 0;
        const melee = p.inventory.find((i) => {
          const d = this.world.worldData.items[i.name];
          return d && d.kind === 'weapon' && d.type !== 'bow' && (d.classes?.[clsIdx] ?? 1);
        });
        if (melee) {
          this.world.useItem(melee);
          this.world.addLog(`【內掛】箭矢已用盡，自動改持近戰武器【${melee.name}】。`, 'gold');
        }
      }
    }

    if (cfg.autoRepairGear !== false && now - (this.lastRepairCheckAt || 0) >= 1200) {
      this.lastRepairCheckAt = now;
      const threshold = Math.max(1, Math.min(10, Number(cfg.autoRepairThreshold) || 1));
      const damaged = this.world.getDamagedGear?.({ minBroken: threshold }) || [];
      if (damaged.length > 0) {
        const res = this.world.autoRepairGear(cfg);
        if (res?.ok) return false;
        if (res?.reason && res.reason !== 'none' && now - (this.lastRepairWarnAt || 0) >= 20000) {
          this.lastRepairWarnAt = now;
          const warnMsg =
            res.reason === 'no_whetstone'
              ? '【內掛】裝備已受損，但背包內沒有磨刀石，無法自動修復。'
              : `【內掛】裝備已受損，需要 ${res.fee || 20} 金幣或磨刀石才能自動修復。`;
          this.world.addLog(warnMsg, 'warn');
        }
      }
    }

    if (cfg.autoHaste && !p._equipHaste && (p.buffs.haste || 0) <= now + 3000) {
      const pot = this.#findItemByNames(['自我加速藥水', '強化綠色藥水', '綠色藥水']);
      if (pot) {
        this.world.useItem(pot);
        return false;
      }
      if (this.#tryCastBuffSpell(43, now, cfg.minMpReservePct)) return false;
    }

    if (cfg.autoBrave && (p.buffs.brave || 0) <= now + 3000) {
      const pot = this.#findItemByNames(['勇敢藥水', '精靈餅乾']);
      if (pot) {
        this.world.useItem(pot);
        return false;
      }
    }

    if (cfg.autoBlue && (p.buffs.bluePotion || p.buffs.blue || 0) <= now + 3000) {
      const pot = this.#findItemByNames(['藍色藥水']);
      if (pot) {
        this.world.useItem(pot);
        return false;
      }
    }

    if (cfg.autoWisdom && (p.buffs.wisdom || 0) <= now + 3000) {
      const pot = this.#findItemByNames(['慎重藥水']);
      if (pot) {
        this.world.useItem(pot);
        return false;
      }
    }

    if (cfg.autoDefBuffs) {
      if ((p.buffs.shield || 0) <= now + 3000 && this.#tryCastBuffSpell(3, now, cfg.minMpReservePct)) return false;
      if ((p.buffs.blessedArmor || 0) <= now + 3000 && this.#tryCastBuffSpell(21, now, cfg.minMpReservePct)) return false;
      if ((p.buffs.mrUp || 0) <= now + 3000 && this.#tryCastBuffSpell(31, now, cfg.minMpReservePct)) return false;
    }

    if (cfg.autoCombatBuffs) {
      if ((p.buffs.holyWeapon || 0) <= now + 3000) {
        if (
          this.#tryCastBuffSpell(48, now, cfg.minMpReservePct) ||
          this.#tryCastBuffSpell(12, now, cfg.minMpReservePct) ||
          this.#tryCastBuffSpell(8, now, cfg.minMpReservePct)
        ) {
          return false;
        }
      }
      if ((p.buffs.strUp || 0) <= now + 3000 && this.#tryCastBuffSpell(42, now, cfg.minMpReservePct)) return false;
      if ((p.buffs.dexUp || 0) <= now + 3000 && this.#tryCastBuffSpell(26, now, cfg.minMpReservePct)) return false;
    }

    const mpPct = (p.mp / Math.max(1, p.maxMp)) * 100;
    if (cfg.autoMeditate && !p.targetId && mpPct < 72 && (p.buffs.meditation || 0) <= now + 3000) {
      this.#tryCastBuffSpell(32, now, 0);
    }
    return false;
  }

  #wasRecentlyRecorded(mapId, tx, ty, now) {
    return this.recentObstacles.some((o) => o.map === mapId && o.tx === tx && o.ty === ty && now - o.at < 2000);
  }

  #recordStaticObstacle(obs, now, reasonText = null) {
    const p = this.world.player;
    const kind = obs.kind || 'wall';
    const label = obs.label || '障礙物';
    this.stats.replans += 1;
    if (!this.#wasRecentlyRecorded(p.map, obs.tx, obs.ty, now)) {
      this.stats.obstacleHits += 1;
      this.recentObstacles.push({ map: p.map, tx: obs.tx, ty: obs.ty, kind, label, at: now });
      if (this.recentObstacles.length > 20) this.recentObstacles.shift();
    }
    this.stats.lastObstacleKind = kind;
    this.stats.lastObstacleLabel = label;
    this.stats.lastObstacleTx = obs.tx;
    this.stats.lastObstacleTy = obs.ty;
    this.stats.lastObstacleAt = now;
    this.stats.statusText = reasonText || `閃避${label}(${obs.tx},${obs.ty})`;
    if (obs.tx || obs.ty) {
      this.blockedTiles.set(`${p.map}:${obs.tx},${obs.ty}`, { until: now + 9000, kind, label });
    }
  }

  #getExtraStaticDetourSet(mapId) {
    const set = new Set();
    const prefix = `${mapId}:`;
    for (const key of this.blockedTiles.keys()) {
      if (key.startsWith(prefix)) set.add(key.slice(prefix.length));
    }
    return set.size ? set : null;
  }

  #updateProgressAndDetectObstacles(now) {
    const p = this.world.player;
    const cfg = p.autoConfig;

    // 1. 偵測位置進度與擺盪卡點（ping-pong）
    if (p.map !== this.lastPos.map || p.tx !== this.lastPos.tx || p.ty !== this.lastPos.ty) {
      this.lastPos = { map: p.map, tx: p.tx, ty: p.ty };
      this.recentPositions.push({ tx: p.tx, ty: p.ty, at: now });
      if (this.recentPositions.length > 8) this.recentPositions.shift();
      this.lastProgressAt = now;
    }

    const stuckMs = Math.max(1500, (Number(cfg.stuckTimeoutSec) || 3) * 1000);
    const oscillating =
      this.recentPositions.length >= 6 &&
      now - this.recentPositions[0].at <= stuckMs * 1.8 &&
      new Set(this.recentPositions.slice(-6).map((pt) => `${pt.tx},${pt.ty}`)).size <= 2 &&
      now - Math.max(p.lastAttackAt || 0, p.lastSpellAt || 0) > 2200;

    // 2. 處理移動受阻事件（嚴格區分：怪物 vs 牆壁／建築／靜態障礙）
    if (p.lastMoveBlocked && now - p.lastMoveBlocked.at <= 1200) {
      const blk = p.lastMoveBlocked;
      p.lastMoveBlocked = null;
      if (blk.isMob) {
        // 怪物不算障礙物！若可反擊／符合條件就直接應戰，否則只清路徑讓下次尋路軟繞過去
        const blockingMob = this.world.mobs.find((m) => m.id === blk.mobId && m.hp > 0);
        if (blockingMob && (cfg.retaliateAggro || this.#isEligibleMob(blockingMob))) {
          this.world.targetMob(blockingMob);
          this.stats.statusText = `接戰阻道怪物：${blockingMob.name}`;
          return true;
        }
        p.path = [];
        this.stats.statusText = '怪物擋路，嘗試繞道繼續前進';
      } else if (cfg.obstacleAvoidance) {
        this.#recordStaticObstacle(blk, now, `碰撞${blk.label}，重新規劃`);
        p.path = [];
        return this.#recoverFromStaticObstacle(now, false);
      }
    }

    // 3. 路徑前瞻偵測靜態障礙（牆壁、建築、柵欄、景物、傳送點、安全線、NPC；排除怪物）
    if (cfg.obstacleAvoidance && p.path?.length > 0) {
      const ahead = this.world.isoMap.detectObstacleAhead(
        p.tx,
        p.ty,
        p.path,
        p.map,
        Math.max(2, Number(cfg.obstacleLookahead) || 4),
        {
          staticBlockedSet: this.world.getStaticOccupiedTileSet(),
          portalSet: cfg.avoidPortals ? this.world.getPortalTileSet(p.map) : null,
          avoidSafety: Boolean(cfg.avoidSafetyBorder),
        },
      );
      if (ahead) {
        this.#recordStaticObstacle(ahead, now, `前方${ahead.label}，重新尋路`);
        p.path = [];
        this.#replanActiveGoal(now);
        return false;
      }
    }

    // 4. 卡點計時器／擺盪恢復（若實際面前只是怪物則直接應戰，不計入障礙物）
    const activelyFighting =
      p.targetId && now - Math.max(p.lastAttackAt || 0, p.lastSpellAt || 0) < 1600;
    const isStuck =
      !p.moveTo &&
      !activelyFighting &&
      (oscillating || ((p.path?.length || p.targetId || p.pendingPickupId) && now - this.lastProgressAt >= stuckMs));

    if (isStuck) {
      this.lastProgressAt = now;
      this.recentPositions = [];
      const nearbyBlockingMob = this.world.mobs.find(
        (m) => m.hp > 0 && m.id !== p.targetId && tileDistance(p.tx, p.ty, m.tx, m.ty) <= 1,
      );
      if (nearbyBlockingMob && (cfg.retaliateAggro || this.#isEligibleMob(nearbyBlockingMob))) {
        this.world.targetMob(nearbyBlockingMob);
        this.stats.statusText = `接戰周邊怪物：${nearbyBlockingMob.name}`;
        return true;
      }
      if (cfg.obstacleAvoidance) {
        return this.#recoverFromStaticObstacle(now, true);
      }
    }
    return false;
  }

  #replanActiveGoal(now) {
    const p = this.world.player;
    const extraStatic = this.#getExtraStaticDetourSet(p.map);
    if (p.pendingPickupId) {
      const drop = this.world.drops.find((d) => d.id === p.pendingPickupId);
      if (drop) {
        const res = this.world.computeSmartPath(drop.tx, drop.ty, { extraStaticBlocked: extraStatic });
        if (res.reached) {
          p.path = res.path;
          return true;
        }
        this.unreachableDrops.set(drop.id, now + 8000);
        p.pendingPickupId = null;
      }
    }
    if (p.targetId) {
      const mob = this.world.mobs.find((m) => m.id === p.targetId && m.hp > 0);
      if (mob) {
        const res = this.world.computeSmartPath(mob.tx, mob.ty, {
          excludeMobTiles: true,
          goalRange: p.attackRange,
          requireLos: true,
          extraStaticBlocked: extraStatic,
        });
        if (res.reached && res.path.length) {
          p.path = res.path;
          return true;
        }
      }
    }
    return false;
  }

  #recoverFromStaticObstacle(now, isHardStuck) {
    const p = this.world.player;
    const cfg = p.autoConfig;

    if (p.targetId) {
      const mob = this.world.mobs.find((m) => m.id === p.targetId && m.hp > 0);
      if (mob) {
        const staticRes = this.world.computeSmartPath(mob.tx, mob.ty, {
          excludeMobTiles: true,
          goalRange: p.attackRange,
          requireLos: true,
          extraStaticBlocked: this.#getExtraStaticDetourSet(p.map),
        });
        if (!staticRes.reached && cfg.switchOnBlocked) {
          this.unreachableTargets.set(mob.id, now + 7000);
          p.targetId = null;
          if (staticRes.blocker) {
            this.#recordStaticObstacle(staticRes.blocker, now, `${staticRes.blocker.label}阻擋目標，改選他怪`);
          }
        } else if (staticRes.path.length) {
          p.path = staticRes.path;
          return false;
        }
      } else {
        p.targetId = null;
      }
    }

    if (p.pendingPickupId) {
      this.unreachableDrops.set(p.pendingPickupId, now + 8000);
      p.pendingPickupId = null;
    }

    if (isHardStuck) {
      this.#recordStaticObstacle(
        { tx: p.tx, ty: p.ty, kind: 'unreachable', label: '地形死角' },
        now,
        '長時間停滯，啟動脫困',
      );
      if (cfg.stuckRecovery === 'teleport' && getMapMeta(p.map).tele) {
        const scroll = this.#findItemByNames(['瞬間移動的卷軸']);
        if (scroll) {
          this.world.useItem(scroll);
          p.path = [];
          p.targetId = null;
          if (cfg.huntMode === 'roam') cfg.anchor = { map: p.map, x: p.tx, y: p.ty };
          return true;
        }
        if (p.spells.includes(5) && p.mp >= 5 && this.world.castSpell(5)) {
          p.path = [];
          p.targetId = null;
          if (cfg.huntMode === 'roam') cfg.anchor = { map: p.map, x: p.tx, y: p.ty };
          return true;
        }
      } else if (cfg.stuckRecovery === 'recall' && getMapMeta(p.map).recall !== false) {
        const home = this.#findItemByNames(['傳送回家的卷軸']);
        if (home) {
          this.world.useItem(home);
          cfg.enabled = false;
          p.path = [];
          p.targetId = null;
          this.world.addLog('【內掛脫困】連續卡點已自動回村並暫停掛機。', 'warn');
          return true;
        }
      }
    }

    // 重選一個安全且路徑乾淨的候選怪或巡邏方向
    if (this.#selectBestTarget(now)) return true;
    this.#handlePatrolOrRoam(now, true);
    return true;
  }

  #findNearbyAggro(maxDist = 6) {
    const p = this.world.player;
    let best = null;
    let bestD = 1e9;
    for (const m of this.world.mobs) {
      if (m.hp <= 0 || !m.aggroTarget) continue;
      const d = tileDistance(p.tx, p.ty, m.tx, m.ty);
      if (d <= maxDist && d < bestD) {
        bestD = d;
        best = m;
      }
    }
    return best;
  }

  #tryKiteStep(mob, now) {
    const p = this.world.player;
    const cfg = p.autoConfig;
    const anchor = cfg.anchor || { map: p.map, x: p.tx, y: p.ty };
    const staticSet = this.world.getStaticOccupiedTileSet();
    const mobSet = this.world.getMobTileSet(mob.id);
    const portalSet = cfg.avoidPortals ? this.world.getPortalTileSet(p.map) : null;
    const curDist = tileDistance(p.tx, p.ty, mob.tx, mob.ty);

    let best = null;
    let bestScore = -1e9;
    for (const [dx, dy] of HEADING_DELTAS) {
      const nx = p.tx + dx;
      const ny = p.ty + dy;
      if (mobSet.has(`${nx},${ny}`)) continue;
      const obs = this.world.isoMap.inspectStepObstacle(p.tx, p.ty, dx, dy, p.map, {
        staticBlockedSet: staticSet,
        portalSet,
        avoidSafety: Boolean(cfg.avoidSafetyBorder),
      });
      if (obs) continue;
      if (cfg.huntMode === 'anchor' && tileDistance(nx, ny, anchor.x, anchor.y) > (cfg.radius || 14)) continue;
      const newDist = tileDistance(nx, ny, mob.tx, mob.ty);
      if (newDist <= curDist || newDist > p.attackRange) continue;
      if (!this.world.isoMap.hasStaticLineOfSight(nx, ny, mob.tx, mob.ty, p.map, { staticBlockedSet: staticSet })) {
        continue;
      }
      const openNeighbors = 8 - this.world.isoMap.countBlockedNeighbors(nx, ny, p.map);
      const score = newDist * 10 + openNeighbors;
      if (score > bestScore) {
        bestScore = score;
        best = { x: nx, y: ny };
      }
    }
    if (best) {
      p.path = [best];
      this.stats.statusText = `拉打保持距離 (${mob.name})`;
      return true;
    }
    return false;
  }

  #tryAutoAttackSpell(mob, dist, hasLos, now) {
    const p = this.world.player;
    const cfg = p.autoConfig;
    if (!hasLos || dist > 7 || now - p.lastSpellAt < 820) return false;
    const hpPct = (p.hp / Math.max(1, p.maxHp)) * 100;
    const mpPct = (p.mp / Math.max(1, p.maxMp)) * 100;

    if (cfg.autoVampireTouch && p.spells.includes(28) && hpPct <= Math.max(cfg.potThreshold + 12, 72)) {
      const vSp = (this.world.worldData.spells || []).find((s) => s.id === 28);
      if (vSp && p.mp >= vSp.mp && this.world.castSpell(28, mob)) return true;
    }

    if (cfg.autoTurnUndead && p.spells.includes(18) && UNDEAD_MOBS.has(mob.name) && mpPct >= cfg.minMpReservePct) {
      const tSp = (this.world.worldData.spells || []).find((s) => s.id === 18);
      if (tSp && p.mp >= tSp.mp && this.world.castSpell(18, mob)) return true;
    }

    if (!cfg.autoAttackSpell || mpPct < cfg.minMpReservePct) return false;

    if (cfg.attackSpellId && cfg.attackSpellId !== 'auto') {
      const sid = Number(cfg.attackSpellId);
      const sp = (this.world.worldData.spells || []).find((s) => s.id === sid);
      if (sp && p.spells.includes(sid) && p.mp >= sp.mp) {
        if (((p.mp - sp.mp) / Math.max(1, p.maxMp)) * 100 >= cfg.minMpReservePct * 0.5) {
          return this.world.castSpell(sid, mob);
        }
      }
      return false;
    }

    let nearbyMobs = 0;
    for (const other of this.world.mobs) {
      if (other.hp <= 0 || other.isPassiveCritter) continue;
      if (tileDistance(mob.tx, mob.ty, other.tx, other.ty) <= 2) nearbyMobs += 1;
    }

    const candidates =
      nearbyMobs >= (cfg.aoeMinCount || 2)
        ? [...AOE_ATTACK_SPELLS, ...SINGLE_ATTACK_SPELLS]
        : SINGLE_ATTACK_SPELLS;
    for (const sid of candidates) {
      if (!p.spells.includes(sid)) continue;
      const sp = (this.world.worldData.spells || []).find((s) => s.id === sid);
      if (!sp || p.mp < sp.mp) continue;
      const remainPct = ((p.mp - sp.mp) / Math.max(1, p.maxMp)) * 100;
      if (remainPct >= cfg.minMpReservePct * 0.5 || AOE_SPELLS.has(sid)) {
        if (this.world.castSpell(sid, mob)) return true;
      }
    }
    return false;
  }

  #evaluateCurrentTarget(now) {
    const p = this.world.player;
    const cfg = p.autoConfig;
    if (!p.targetId) return false;

    const mob = this.world.mobs.find((m) => m.id === p.targetId && m.hp > 0);
    if (!mob || isSafetyZone(mob.map, mob.tx, mob.ty, this.world.isoMap) || this.unreachableTargets.has(mob.id)) {
      p.targetId = null;
      return false;
    }

    if (cfg.targetPriority === 'aggroFirst' && !mob.aggroTarget && cfg.retaliateAggro) {
      const attacker = this.#findNearbyAggro(2);
      if (attacker && attacker.id !== mob.id) {
        this.world.targetMob(attacker);
        this.stats.statusText = `優先反擊：${attacker.name}`;
        return true;
      }
    }

    const dist = tileDistance(p.tx, p.ty, mob.tx, mob.ty);
    const staticSet = this.world.getStaticOccupiedTileSet();
    const hasLos =
      dist === 0 ||
      (dist === 1
        ? this.world.isoMap.canStep(p.tx, p.ty, mob.tx - p.tx, mob.ty - p.ty, p.map)
        : this.world.isoMap.hasStaticLineOfSight(p.tx, p.ty, mob.tx, mob.ty, p.map, { staticBlockedSet: staticSet }));

    this.stats.statusText = hasLos
      ? `戰鬥中：${mob.name} (Lv.${mob.level})`
      : `繞過障礙接近：${mob.name}`;

    if (cfg.kiteRanged && p.attackRange >= 4 && dist <= (cfg.kiteDistance || 2) && hasLos && !p.moveTo) {
      if (now - p.lastAttackAt >= 120 && now - p.lastAttackAt < 520) {
        if (this.#tryKiteStep(mob, now)) return true;
      }
    }

    if (this.#tryAutoAttackSpell(mob, dist, hasLos, now)) return true;

    if (!hasLos || dist > p.attackRange) {
      if (!p.path.length) {
        const res = this.world.computeSmartPath(mob.tx, mob.ty, {
          excludeMobId: mob.id,
          goalRange: p.attackRange,
          requireLos: true,
          extraStaticBlocked: this.#getExtraStaticDetourSet(p.map),
        });
        if (res.reached && res.path.length) {
          p.path = res.path;
        } else if (!res.reached && cfg.switchOnBlocked) {
          const checkStatic = this.world.computeSmartPath(mob.tx, mob.ty, {
            excludeMobTiles: true,
            goalRange: p.attackRange,
            requireLos: true,
          });
          if (!checkStatic.reached) {
            this.unreachableTargets.set(mob.id, now + 7000);
            p.targetId = null;
            if (checkStatic.blocker) {
              this.#recordStaticObstacle(checkStatic.blocker, now, `${checkStatic.blocker.label}阻擋，改尋他怪`);
            }
            return false;
          }
        }
      }
    }
    return true;
  }

  #isEligibleMob(m) {
    const p = this.world.player;
    const cfg = p.autoConfig;
    if (m.hp <= 0 || this.unreachableTargets.has(m.id)) return false;
    if (isSafetyZone(m.map, m.tx, m.ty, this.world.isoMap)) return false;
    if (cfg.retaliateAggro && m.aggroTarget) return true;
    if (cfg.skipCritters && m.isPassiveCritter) return false;
    if (cfg.avoidBoss && m.level >= 32) return false;
    if (m.level < (Number(cfg.minMobLevel) || 1) || m.level > (Number(cfg.maxMobLevel) || 45)) return false;
    if (cfg.safeLevelCap && m.level > p.level + 10) return false;

    const filterMode = cfg.mobFilterMode || 'all';
    if (filterMode !== 'all') {
      const set = this.getMobFilterSet();
      if (filterMode === 'whitelist' && set.size > 0 && !set.has(m.name)) return false;
      if (filterMode === 'blacklist' && set.has(m.name)) return false;
    }
    return true;
  }

  #scoreMob(m) {
    const p = this.world.player;
    const cfg = p.autoConfig;
    const dist = tileDistance(p.tx, p.ty, m.tx, m.ty);
    switch (cfg.targetPriority) {
      case 'weakest':
        return m.hp + dist * 4;
      case 'aggroFirst':
        return (m.aggroTarget ? -1000 : 0) + dist;
      case 'highestExp':
        return -(m.exp || 10) + dist * 6;
      case 'nearest':
      default:
        return dist - (m.aggroTarget ? 1.5 : 0);
    }
  }

  #selectBestTarget(now) {
    const p = this.world.player;
    const cfg = p.autoConfig;
    const anchor = cfg.anchor || { map: p.map, x: p.tx, y: p.ty };
    const radius = Math.max(4, Number(cfg.radius) || 14);
    const isStationary = cfg.huntMode === 'stationary';
    const isRoam = cfg.huntMode === 'roam';
    const staticSet = this.world.getStaticOccupiedTileSet();

    const pool = [];
    for (const m of this.world.mobs) {
      if (!this.#isEligibleMob(m)) continue;
      const dPlayer = tileDistance(p.tx, p.ty, m.tx, m.ty);
      if (isStationary) {
        const hasLos =
          dPlayer <= 1
            ? this.world.isoMap.canStep(p.tx, p.ty, m.tx - p.tx, m.ty - p.ty, p.map) || dPlayer === 0
            : this.world.isoMap.hasStaticLineOfSight(p.tx, p.ty, m.tx, m.ty, p.map, { staticBlockedSet: staticSet });
        if (!(dPlayer <= p.attackRange && hasLos) && !(m.aggroTarget && dPlayer <= 2)) continue;
      } else if (!isRoam) {
        const dAnchor = tileDistance(anchor.x, anchor.y, m.tx, m.ty);
        if (dAnchor > radius + 4 && !(cfg.retaliateAggro && m.aggroTarget && dPlayer <= 8)) continue;
        if (dPlayer > radius + 10) continue;
      } else if (dPlayer > 48) {
        continue;
      }
      pool.push({ mob: m, score: this.#scoreMob(m), dPlayer });
    }

    if (!pool.length) return false;
    pool.sort((a, b) => a.score - b.score);

    const extraStatic = this.#getExtraStaticDetourSet(p.map);
    const maxCandidates = Math.min(pool.length, 6);
    for (let i = 0; i < maxCandidates; i += 1) {
      const m = pool[i].mob;
      const d = pool[i].dPlayer;
      const directLos =
        d <= p.attackRange &&
        (d === 0 ||
          (d === 1
            ? this.world.isoMap.canStep(p.tx, p.ty, m.tx - p.tx, m.ty - p.ty, p.map)
            : this.world.isoMap.hasStaticLineOfSight(p.tx, p.ty, m.tx, m.ty, p.map, { staticBlockedSet: staticSet })));
      if (directLos) {
        this.world.targetMob(m);
        p.path = [];
        this.stats.statusText = `鎖定目標：${m.name}`;
        return true;
      }

      // 先以 excludeMobTiles 測試「靜態地形與建築物」是否完全封死，排除怪物幹擾判斷
      const staticCheck = this.world.computeSmartPath(m.tx, m.ty, {
        excludeMobTiles: true,
        goalRange: p.attackRange,
        requireLos: true,
        extraStaticBlocked: extraStatic,
        maxNodes: 1800,
      });
      if (!staticCheck.reached) {
        this.unreachableTargets.set(m.id, now + 7000);
        if (i === 0 && staticCheck.blocker) {
          this.#recordStaticObstacle(staticCheck.blocker, now, `${staticCheck.blocker.label}隔絕 ${m.name}，改選目標`);
        }
        continue;
      }

      const fullRes = this.world.computeSmartPath(m.tx, m.ty, {
        excludeMobId: m.id,
        goalRange: p.attackRange,
        requireLos: true,
        extraStaticBlocked: extraStatic,
        maxNodes: 2000,
      });
      this.world.targetMob(m);
      p.path = fullRes.path.length ? fullRes.path : staticCheck.path;
      this.stats.statusText = `前往攻擊：${m.name}`;
      return true;
    }

    return false;
  }

  isDesiredDrop(drop) {
    const cfg = this.world.player.autoConfig;
    if (this.unreachableDrops.has(drop.id)) return false;
    if (isSafetyZone(drop.map, drop.tx, drop.ty, this.world.isoMap) && cfg.avoidSafetyBorder) return false;
    if (drop.item === '金幣') return true;
    if ((this.world.player.weightPercent || 0) >= (Number(cfg.maxWeightPct) || 85)) return false;

    const filter = cfg.lootFilter || 'all';
    if (filter === 'goldOnly') return false;
    const def = this.world.worldData.items?.[drop.item];
    const isGear = def?.kind === 'weapon' || def?.kind === 'armor';
    if (filter === 'goldAndGear') return isGear;
    if (filter === 'valuable') {
      return (
        isGear ||
        CRAFT_MATERIAL_SET.has(drop.item) ||
        (def?.price || 0) >= 250 ||
        /卷軸|寶石|鑽石|紅寶|綠寶|藍寶|祝福|強化/.test(drop.item)
      );
    }
    return true;
  }

  #handleLootPickup(now) {
    const p = this.world.player;
    const cfg = p.autoConfig;
    const pickupRadius = Math.max(2, Number(cfg.pickupRadius) || 12);

    if (p.pendingPickupId) {
      const pending = this.world.drops.find((d) => d.id === p.pendingPickupId);
      if (pending && tileDistance(p.tx, p.ty, pending.tx, pending.ty) <= 1) {
        this.world.pickupDrop(pending);
        p.pendingPickupId = null;
        return true;
      }
      if (pending && p.path.length > 0 && now - this.lastDropAttemptAt < 4000) {
        return true;
      }
      p.pendingPickupId = null;
    }

    let best = null;
    let bestD = 1e9;
    for (const d of this.world.drops) {
      if (!this.isDesiredDrop(d)) continue;
      const dist = tileDistance(p.tx, p.ty, d.tx, d.ty);
      if (dist <= pickupRadius && dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    if (!best) return false;

    if (bestD <= 1) {
      this.world.pickupDrop(best);
      this.stats.statusText = `拾取：${best.item}`;
      return true;
    }

    const staticCheck = this.world.computeSmartPath(best.tx, best.ty, {
      excludeMobTiles: true,
      goalRange: 1,
      extraStaticBlocked: this.#getExtraStaticDetourSet(p.map),
    });
    if (!staticCheck.reached) {
      this.unreachableDrops.set(best.id, now + 8000);
      return false;
    }

    this.lastDropAttemptId = best.id;
    this.lastDropAttemptAt = now;
    this.world.pickupOrWalkToDrop(best);
    this.stats.statusText = `前往拾取：${best.item}`;
    return true;
  }

  #handlePatrolOrRoam(now, forceStep = false) {
    const p = this.world.player;
    const cfg = p.autoConfig;
    const anchor = cfg.anchor || { map: p.map, x: p.tx, y: p.ty };

    if (cfg.huntMode === 'stationary') {
      if (tileDistance(p.tx, p.ty, anchor.x, anchor.y) > 2) {
        const res = this.world.computeSmartPath(anchor.x, anchor.y, {
          extraStaticBlocked: this.#getExtraStaticDetourSet(p.map),
        });
        p.path = res.path;
        this.stats.statusText = '定點回位';
      } else {
        this.stats.statusText = '定點警戒待機';
      }
      return;
    }

    if (!forceStep && now - this.lastRoamAt < 1100) return;
    this.lastRoamAt = now;

    const radius = Math.max(4, Number(cfg.radius) || 14);
    if (cfg.huntMode === 'anchor' && tileDistance(p.tx, p.ty, anchor.x, anchor.y) > Math.max(2, radius - 2)) {
      const res = this.world.computeSmartPath(anchor.x, anchor.y, {
        extraStaticBlocked: this.#getExtraStaticDetourSet(p.map),
      });
      if (res.path.length) {
        p.path = res.path;
        this.stats.statusText = `返回錨點 (${anchor.x},${anchor.y})`;
        return;
      }
    }

    const portalSet = cfg.avoidPortals ? this.world.getPortalTileSet(p.map) : null;
    const staticSet = this.world.getStaticOccupiedTileSet();
    const extraStatic = this.#getExtraStaticDetourSet(p.map);
    const stepLen = cfg.huntMode === 'roam' ? 12 : Math.min(8, Math.max(4, Math.floor(radius * 0.65)));

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const dir = HEADING_DELTAS[(this.patrolSectorIdx + attempt) % 8];
      const baseX = cfg.huntMode === 'roam' ? p.tx : anchor.x;
      const baseY = cfg.huntMode === 'roam' ? p.ty : anchor.y;
      const candX = baseX + dir[0] * stepLen;
      const candY = baseY + dir[1] * stepLen;

      if (
        this.world.isoMap.inspectTileObstacle(candX, candY, p.map, {
          staticBlockedSet: staticSet,
          portalSet,
          avoidSafety: Boolean(cfg.avoidSafetyBorder),
        })
      ) {
        continue;
      }

      const res = this.world.computeSmartPath(candX, candY, {
        extraStaticBlocked: extraStatic,
        maxNodes: 1400,
        allowPartial: false,
      });
      if (res.reached && res.path.length) {
        this.patrolSectorIdx = (this.patrolSectorIdx + attempt + 1) % 8;
        p.path = res.path;
        if (cfg.huntMode === 'roam' && tileDistance(p.tx, p.ty, anchor.x, anchor.y) > 16) {
          cfg.anchor = { map: p.map, x: p.tx, y: p.ty };
        }
        this.stats.statusText = cfg.huntMode === 'roam' ? '全圖巡邏尋敵' : '錨點範圍巡邏';
        return;
      }
    }

    // 保底搜尋任何可走鄰格，避免受牆角封鎖而完全呆住
    for (const [dx, dy] of HEADING_DELTAS) {
      const obs = this.world.isoMap.inspectStepObstacle(p.tx, p.ty, dx, dy, p.map, {
        staticBlockedSet: staticSet,
        portalSet,
        avoidSafety: Boolean(cfg.avoidSafetyBorder),
      });
      if (!obs) {
        p.path = [{ x: p.tx + dx, y: p.ty + dy }];
        this.stats.statusText = '調整站位中';
        return;
      }
    }
    this.stats.statusText = '待命尋敵中';
  }
}
