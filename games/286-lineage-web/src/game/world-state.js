// 286 天堂實境客戶端：說話之島世界模擬、角色屬性、戰鬥掉落、法術、商店與倉庫存檔
import { tileToWorld, tileDistance, headingBetween, HEADING_DELTAS } from './map-iso.js';

export const MAP_NAMES = {
  0: '說話之島',
  1: '說話之島地監 1樓',
  2: '說話之島地監 2樓',
  3: '甘特之家',
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

const EQUIP_SLOTS = ['weapon', 'armor', 'helm', 'shield', 'cloak', 'boots', 'glove'];

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

    this.nextUid = 1;
    this.dirtySave = false;
    this.lastSaveAt = performance.now();
    this.lastRegenAt = performance.now();

    this.loadMapEntities(this.player.map);
    this.saveWorld(true);
    this.addLog(`歡迎來到天堂 1.63《${MAP_NAMES[this.player.map] || '說話之島'}》。`, 'gold');
    this.addLog('點擊地面移動，點擊怪物自動鎖定攻擊，點擊 NPC 對話或交易。', 'info');
  }

  #initPlayer(char) {
    let saved = null;
    try {
      const raw = localStorage.getItem(this.saveKey);
      if (raw) saved = JSON.parse(raw);
    } catch {
      saved = null;
    }

    const clsId = char.classId || 'royal';
    const clsCfg = this.worldData.classes[clsId] || this.worldData.classes.royal;
    const gfx = Number(char.sex) === 1 ? clsCfg.femaleGfx : clsCfg.maleGfx;

    const baseStats = {
      str: Number(char.str ?? clsCfg.stats.str),
      con: Number(char.con ?? clsCfg.stats.con),
      dex: Number(char.dex ?? clsCfg.stats.dex),
      wis: Number(char.wis ?? clsCfg.stats.wis),
      cha: Number(char.cha ?? clsCfg.stats.cha),
      int: Number(char.int ?? clsCfg.stats.int),
    };

    const startHp = Number(char.maxHp || char.hp || clsCfg.baseHp);
    const startMp = Number(char.maxMp || char.mp || clsCfg.baseMp);

    const player = {
      id: 'me',
      name: char.name || '無名勇者',
      classId: clsId,
      sex: Number(char.sex || 0),
      gfx,
      level: Number(saved?.level ?? char.level ?? 1),
      exp: Number(saved?.exp ?? char.exp ?? 0),
      gold: Number(saved?.gold ?? char.gold ?? 500),
      lawful: Number(saved?.lawful ?? 0),
      stats: saved?.stats || baseStats,
      hp: Number(saved?.hp ?? startHp),
      maxHp: Number(saved?.maxHp ?? startHp),
      mp: Number(saved?.mp ?? startMp),
      maxMp: Number(saved?.maxMp ?? startMp),
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
      buffs: saved?.buffs || {},
      spells: saved?.spells || [...(STARTER_SPELLS_BY_CLASS[clsId] || [1])],
      inventory: saved?.inventory || this.#buildStarterInventory(clsCfg, clsId),
      quickbar: saved?.quickbar || JSON.parse(JSON.stringify(QUICKBAR_DEFAULT_BY_CLASS[clsId] || QUICKBAR_DEFAULT_BY_CLASS.royal)),
      autoConfig: saved?.autoConfig || {
        enabled: false,
        potEnabled: true,
        potThreshold: 55,
        radius: 14,
        pickupDrops: true,
        anchor: null,
      },
      worldX: 0,
      worldY: 0,
      ac: 10,
      weaponType: 'unarmed',
      weaponItem: null,
      attackRange: 1,
      weightPercent: 0,
      mr: 10,
    };

    if (![0, 1, 2, 3].includes(player.map) || !this.isoMap.isWalkableTile(player.tx, player.ty, player.map)) {
      player.map = clsCfg.spawn.map || 0;
      player.tx = clsCfg.spawn.x || 32578;
      player.ty = clsCfg.spawn.y || 32943;
    }

    const wp = tileToWorld(player.tx, player.ty);
    player.worldX = wp.x;
    player.worldY = wp.y;

    this.recomputePlayerStats(player);
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

  recomputePlayerStats(p = this.player) {
    let ac = 10 - Math.floor((p.stats.dex - 10) / 3);
    let bonusHp = 0;
    let bonusMp = 0;
    let bonusMr = Math.max(0, (p.stats.wis - 10) * 2);
    let totalWeight = Math.floor(p.gold * 0.002);
    let activeWeapon = null;

    for (const it of p.inventory) {
      const def = this.worldData.items[it.name];
      if (!def) continue;
      totalWeight += def.weight * it.count;
      if (!it.equipped) continue;
      if (def.kind === 'weapon') {
        activeWeapon = { item: it, def };
      } else if (def.kind === 'armor') {
        ac -= def.ac + (it.plus || 0);
        bonusHp += def.hp;
        bonusMp += def.mp;
        bonusMr += def.mr;
      }
    }

    const now = performance.now();
    if ((p.buffs.shield || 0) > now) ac -= 2;
    if ((p.buffs.blessedArmor || 0) > now) ac -= 3;

    const maxWeight = Math.max(500, 1000 + p.stats.str * 50);
    p.ac = ac;
    p.mr = bonusMr;
    p.weaponItem = activeWeapon;
    if (activeWeapon) {
      const t = activeWeapon.def.type;
      p.weaponType = t === 'tohand' ? 'twohand' : ['sword', 'dagger', 'bow', 'spear', 'staff'].includes(t) ? t : 'sword';
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

  #loadWarehouse() {
    try {
      const raw = localStorage.getItem(this.storagePrefix);
      if (raw) return JSON.parse(raw);
    } catch {
      // 忽略
    }
    return { gold: 0, items: [] };
  }

  saveWorld(force = false) {
    const now = performance.now();
    if (!force && (!this.dirtySave || now - this.lastSaveAt < 2500)) return;
    this.dirtySave = false;
    this.lastSaveAt = now;
    const p = this.player;
    try {
      localStorage.setItem(
        this.saveKey,
        JSON.stringify({
          level: p.level,
          exp: p.exp,
          gold: p.gold,
          lawful: p.lawful,
          stats: p.stats,
          hp: p.hp,
          maxHp: p.maxHp,
          mp: p.mp,
          maxMp: p.maxMp,
          map: p.map,
          tx: p.tx,
          ty: p.ty,
          spells: p.spells,
          inventory: p.inventory,
          quickbar: p.quickbar,
          autoConfig: p.autoConfig,
        }),
      );
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
        hp: p.hp,
        maxHp: p.maxHp,
        mp: p.mp,
        maxMp: p.maxMp,
        ac: p.ac,
        map: p.map,
        x: p.tx,
        y: p.ty,
      });
    }
  }

  addLog(text, tone = 'info') {
    const t = new Date();
    const hh = String(t.getHours()).padStart(2, '0');
    const mm = String(t.getMinutes()).padStart(2, '0');
    this.logs.push({ time: `${hh}:${mm}`, text, tone });
    if (this.logs.length > 80) this.logs.shift();
  }

  spawnFloatingText(tx, ty, text, color = '#ffffff') {
    const wp = tileToWorld(tx, ty);
    this.floatingTexts.push({
      id: `ft-${this.nextUid++}`,
      x: wp.x + (Math.random() - 0.5) * 14,
      y: wp.y - 46,
      text,
      color,
      bornAt: performance.now(),
      duration: 950,
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
      this.sprites.preloadActor(n.renderGfx);
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

  #findFreeWalkableTile(cx, cy, radius, mapId, occupied) {
    const tries = Math.max(4, radius * 2);
    for (let i = 0; i < tries; i += 1) {
      const tx = cx + (i === 0 ? 0 : randInt(-radius, radius));
      const ty = cy + (i === 0 ? 0 : randInt(-radius, radius));
      if (!this.isoMap.isWalkableTile(tx, ty, mapId)) continue;
      if (occupied?.has(`${tx},${ty}`)) continue;
      return { x: tx, y: ty };
    }
    return this.isoMap.isWalkableTile(cx, cy, mapId) ? { x: cx, y: cy } : null;
  }

  #spawnMobFromDef(sp, mobDef, occupied = null) {
    const pos = this.#findFreeWalkableTile(sp.x, sp.y, Math.max(1, Math.min(sp.size, 8)), sp.map, occupied);
    if (!pos) return null;
    if (occupied) occupied.add(`${pos.x},${pos.y}`);
    const wp = tileToWorld(pos.x, pos.y);
    const mob = {
      id: `mob-${this.nextUid++}`,
      spawnId: sp.id,
      spawn: sp,
      name: mobDef.name,
      gfx: mobDef.gfx,
      level: mobDef.level,
      hp: mobDef.hp,
      maxHp: mobDef.hp,
      ac: mobDef.ac,
      str: mobDef.str,
      exp: mobDef.exp,
      lawful: mobDef.lawful,
      range: mobDef.range,
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
      const alt = this.#findFreeWalkableTile(destX, destY, 4, targetMap);
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

  getOccupiedTileSet(excludeId = null) {
    const set = new Set();
    for (const n of this.npcs) set.add(`${n.x},${n.y}`);
    for (const m of this.mobs) {
      if (m.hp > 0 && m.id !== excludeId) set.add(`${m.tx},${m.ty}`);
    }
    return set;
  }

  setWalkTarget(tx, ty) {
    const p = this.player;
    if (p.hp <= 0) return;
    p.targetId = null;
    p.pendingInteractNpcId = null;
    p.pendingPickupId = null;
    const blocked = this.getOccupiedTileSet();
    p.path = this.isoMap.findPath(p.tx, p.ty, tx, ty, p.map, blocked);
  }

  interactOrWalkToNpc(npc) {
    const p = this.player;
    p.targetId = null;
    p.pendingPickupId = null;
    if (tileDistance(p.tx, p.ty, npc.x, npc.y) <= 2) {
      p.heading = headingBetween(npc.x - p.tx, npc.y - p.ty);
      return npc;
    }
    p.pendingInteractNpcId = npc.id;
    const blocked = this.getOccupiedTileSet();
    p.path = this.isoMap.findPath(p.tx, p.ty, npc.x, npc.y, p.map, blocked);
    return null;
  }

  targetMob(mob) {
    const p = this.player;
    p.pendingInteractNpcId = null;
    p.pendingPickupId = null;
    p.targetId = mob.id;
    p.heading = headingBetween(mob.tx - p.tx, mob.ty - p.ty);
  }

  pickupOrWalkToDrop(drop) {
    const p = this.player;
    p.targetId = null;
    p.pendingInteractNpcId = null;
    if (tileDistance(p.tx, p.ty, drop.tx, drop.ty) <= 1) {
      this.pickupDrop(drop);
      return true;
    }
    p.pendingPickupId = drop.id;
    const blocked = this.getOccupiedTileSet();
    p.path = this.isoMap.findPath(p.tx, p.ty, drop.tx, drop.ty, p.map, blocked);
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
      this.addItemToInventory(drop.item, drop.count, drop.plus || 0);
      this.addLog(`拾取了 ${drop.plus ? `+${drop.plus} ` : ''}${drop.item}${drop.count > 1 ? ` (${drop.count})` : ''}。`, 'cyan');
      this.spawnFloatingText(this.player.tx, this.player.ty, `+${drop.item}`, '#8ef0ff');
    }
    this.audio.playSound(103, 0.35);
    this.recomputePlayerStats();
    this.dirtySave = true;
    return true;
  }

  addItemToInventory(name, count = 1, plus = 0) {
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
    this.player.inventory.push({
      id: `it-${Date.now().toString(36)}-${this.nextUid++}`,
      name,
      count,
      plus,
      equipped: false,
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

  useItem(itemOrId) {
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
        // 卸下同部位（武器或同 armor.type）
        const slotType = def.kind === 'weapon' ? 'weapon' : def.type;
        for (const other of p.inventory) {
          if (!other.equipped || other.id === item.id) continue;
          const oDef = this.worldData.items[other.name];
          if (!oDef) continue;
          if (slotType === 'weapon' && oDef.kind === 'weapon') other.equipped = false;
          if (slotType !== 'weapon' && oDef.kind === 'armor' && oDef.type === slotType) other.equipped = false;
        }
        item.equipped = true;
        this.addLog(`已裝備 ${item.plus ? `+${item.plus} ` : ''}${item.name}。`, 'info');
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
      const heal = randInt(lo, hi);
      p.hp = clamp(p.hp + heal, 1, p.maxHp);
      p.lastPotionAt = now;
      this.consumeItem(item.id, 1);
      this.spawnEffect(p.tx, p.ty, fx);
      this.spawnFloatingText(p.tx, p.ty, `+${heal}`, '#6cf296');
      return { ok: true };
    }

    if (item.name === '綠色藥水' || item.name === '自我加速藥水') {
      p.buffs.haste = now + 300000;
      this.consumeItem(item.id, 1);
      this.spawnEffect(p.tx, p.ty, '751');
      this.addLog('感受到了速度提升（加速狀態 300 秒）。', 'cyan');
      this.dirtySave = true;
      return { ok: true };
    }

    if (item.name === '勇敢藥水') {
      p.buffs.brave = now + 300000;
      this.consumeItem(item.id, 1);
      this.spawnEffect(p.tx, p.ty, '751');
      this.addLog('鬥志沸騰，攻擊節奏提升！', 'cyan');
      this.dirtySave = true;
      return { ok: true };
    }

    if (item.name === '藍色藥水') {
      p.buffs.bluePotion = now + 300000;
      p.mp = clamp(p.mp + 15, 0, p.maxMp);
      this.consumeItem(item.id, 1);
      this.spawnEffect(p.tx, p.ty, '190');
      this.addLog('魔力湧動（MP 自然回復量提升）。', 'cyan');
      this.dirtySave = true;
      return { ok: true };
    }

    if (item.name === '瞬間移動的卷軸') {
      const cand = this.#findFreeWalkableTile(
        p.tx + randInt(-18, 18),
        p.ty + randInt(-18, 18),
        8,
        p.map,
      );
      if (cand) {
        this.consumeItem(item.id, 1);
        this.teleportTo(p.map, cand.x, cand.y, p.heading);
      }
      return { ok: true };
    }

    if (item.name === '傳送回家的卷軸') {
      this.consumeItem(item.id, 1);
      this.teleportTo(0, 32578, 32943, 4);
      return { ok: true };
    }

    if (item.name === '對武器施法的卷軸') {
      const wp = p.inventory.find((i) => i.equipped && this.worldData.items[i.name]?.kind === 'weapon');
      if (!wp) {
        this.addLog('請先裝備武器後再使用對武器施法的卷軸。', 'warn');
        return { ok: false };
      }
      const safe = this.worldData.items[wp.name]?.safe ?? 6;
      const ok = wp.plus < safe || Math.random() < 0.45;
      this.consumeItem(item.id, 1);
      if (ok) {
        wp.plus += 1;
        this.spawnEffect(p.tx, p.ty, '10');
        this.addLog(`你的 +${wp.plus - 1} ${wp.name} 閃爍著藍色光芒（強化為 +${wp.plus}）！`, 'gold');
      } else {
        this.addItemToInventory(wp.name, -1); // 破壞裝備
        const idx = p.inventory.findIndex((i) => i.id === wp.id);
        if (idx !== -1) p.inventory.splice(idx, 1);
        this.addLog(`強化失敗，${wp.name} 化作灰燼消逝了！`, 'danger');
      }
      this.recomputePlayerStats();
      this.dirtySave = true;
      return { ok: true };
    }

    if (item.name === '對盔甲施法的卷軸') {
      const arm = p.inventory.find((i) => i.equipped && this.worldData.items[i.name]?.kind === 'armor');
      if (!arm) {
        this.addLog('請先裝備防具後再使用對盔甲施法的卷軸。', 'warn');
        return { ok: false };
      }
      const safe = this.worldData.items[arm.name]?.safe ?? 4;
      const ok = arm.plus < safe || Math.random() < 0.45;
      this.consumeItem(item.id, 1);
      if (ok) {
        arm.plus += 1;
        this.spawnEffect(p.tx, p.ty, '10');
        this.addLog(`你的 ${arm.name} 閃爍著銀色光芒（強化為 +${arm.plus}）！`, 'gold');
      } else {
        const idx = p.inventory.findIndex((i) => i.id === arm.id);
        if (idx !== -1) p.inventory.splice(idx, 1);
        this.addLog(`強化失敗，${arm.name} 碎裂了！`, 'danger');
      }
      this.recomputePlayerStats();
      this.dirtySave = true;
      return { ok: true };
    }

    if (item.name === '內掛符石' || item.name === '喝水符石') {
      p.autoConfig.enabled = !p.autoConfig.enabled;
      p.autoConfig.anchor = p.autoConfig.enabled ? { map: p.map, x: p.tx, y: p.ty } : null;
      this.addLog(
        p.autoConfig.enabled
          ? `啟動自動練功 (${MAP_NAMES[p.map]} ${p.tx},${p.ty}，半徑 ${p.autoConfig.radius} 格)`
          : '已關閉自動練功。',
        'gold',
      );
      this.dirtySave = true;
      return { ok: true, toggledAuto: true };
    }

    this.addLog(`使用了 ${item.name}。`, 'info');
    return { ok: true };
  }

  castSpell(spellId, explicitTarget = null) {
    const spell = (this.worldData.spells || []).find((s) => s.id === Number(spellId));
    if (!spell) return false;
    const p = this.player;
    const now = performance.now();
    if (now - p.lastSpellAt < Math.max(550, spell.delay || 750)) return false;
    if (p.mp < spell.mp) {
      this.addLog(`魔力不足，無法施放 ${spell.name}。`, 'warn');
      return false;
    }

    // 治療 / 防禦 / 傳送類
    if (spell.name.includes('治癒術')) {
      const baseHeal = randInt(spell.minDmg || 10, spell.maxDmg || 25) + Math.floor(p.stats.int * 0.8);
      p.mp -= spell.mp;
      p.hp = clamp(p.hp + baseHeal, 1, p.maxHp);
      p.lastSpellAt = now;
      p.animState = 'spell';
      p.animStartedAt = now;
      this.spawnEffect(p.tx, p.ty, spell.effect || 744);
      this.spawnFloatingText(p.tx, p.ty, `+${baseHeal}`, '#6cf296');
      this.addLog(`施放 ${spell.name}，回復 ${baseHeal} 點體力。`, 'cyan');
      this.dirtySave = true;
      return true;
    }

    if (spell.name === '保護罩' || spell.name === '鎧甲護持') {
      p.mp -= spell.mp;
      p.lastSpellAt = now;
      p.animState = 'spell';
      p.animStartedAt = now;
      if (spell.name === '保護罩') p.buffs.shield = now + 600000;
      else p.buffs.blessedArmor = now + 600000;
      this.recomputePlayerStats();
      this.spawnEffect(p.tx, p.ty, spell.effect || 221);
      this.addLog(`施放 ${spell.name}，防禦力獲得提升。`, 'cyan');
      this.dirtySave = true;
      return true;
    }

    if (spell.name === '指定傳送') {
      const cand = this.#findFreeWalkableTile(
        p.tx + randInt(-14, 14),
        p.ty + randInt(-14, 14),
        8,
        p.map,
      );
      p.mp -= spell.mp;
      p.lastSpellAt = now;
      if (cand) this.teleportTo(p.map, cand.x, cand.y, p.heading);
      return true;
    }

    if (spell.name === '日光術') {
      p.mp -= spell.mp;
      p.lastSpellAt = now;
      p.buffs.light = now + 600000;
      this.spawnEffect(p.tx, p.ty, 169);
      this.addLog('周圍散發出柔和的白晝光芒。', 'info');
      return true;
    }

    // 攻擊法術
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

    p.mp -= spell.mp;
    p.lastSpellAt = now;
    p.targetId = target.id;
    p.heading = headingBetween(target.tx - p.tx, target.ty - p.ty);
    p.animState = 'spell';
    p.animStartedAt = now;

    const dmg = Math.max(
      1,
      randInt(Math.max(4, spell.minDmg || 8), Math.max(8, spell.maxDmg || 16)) + Math.floor(p.stats.int * 0.9),
    );
    this.spawnEffect(target.tx, target.ty, spell.effect || 167);
    this.#applyDamageToMob(target, dmg, spell.name);
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

  buyFromShop(npcName, shopEntry, qty = 1) {
    const total = shopEntry.price * qty;
    if (this.player.gold < total) {
      this.addLog(`金幣不足（需要 ${total} 金幣）。`, 'warn');
      return false;
    }
    if (!this.addItemToInventory(shopEntry.item, shopEntry.count * qty, shopEntry.plus || 0)) {
      return false;
    }
    this.player.gold -= total;
    this.addLog(`向 ${npcName} 購買了 ${shopEntry.item} x${shopEntry.count * qty}（花費 ${total} 金幣）。`, 'gold');
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
    this.#updateProjectiles(dtMs, now);
    this.#cleanupVfx(now);
    this.#updateRegen(now);
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

    const hasted = (p.buffs.haste || 0) > now;
    const braved = (p.buffs.brave || 0) > now;
    const speedMult = (hasted ? 1.32 : 1) * (braved ? 1.12 : 1);

    if (p.moveTo) {
      p.animState = 'walk';
      const arrived = this.#stepEntityMovement(p, 4.2 * speedMult, dtMs);
      if (arrived) {
        this.dirtySave = true;
        if (this.checkPortalAtPlayer()) return;
      }
      return;
    }

    // 處理攻擊或施法硬直
    if (p.animState === 'attack' || p.animState === 'spell' || p.animState === 'damage') {
      if (now - p.animStartedAt < 420) return;
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

    // 鎖定目標自動追蹤或攻擊
    if (p.targetId) {
      const mob = this.mobs.find((m) => m.id === p.targetId && m.hp > 0);
      if (!mob) {
        p.targetId = null;
      } else {
        const dist = tileDistance(p.tx, p.ty, mob.tx, mob.ty);
        if (dist <= p.attackRange) {
          p.path = [];
          const cd = Math.round(700 / speedMult);
          if (now - p.lastAttackAt >= cd) {
            this.#performPlayerAttack(mob, now);
          }
          return;
        }
        // 自動貼近怪物
        if (!p.path.length) {
          const blocked = this.getOccupiedTileSet(mob.id);
          p.path = this.isoMap.findPath(p.tx, p.ty, mob.tx, mob.ty, p.map, blocked, 420);
        }
      }
    }

    // 取下一步移動格
    if (p.path.length > 0) {
      const next = p.path.shift();
      const dx = next.x - p.tx;
      const dy = next.y - p.ty;
      const occ = this.getOccupiedTileSet();
      if (this.isoMap.canStep(p.tx, p.ty, dx, dy, p.map) && !occ.has(`${next.x},${next.y}`)) {
        p.moveFrom = { x: p.tx, y: p.ty };
        p.moveTo = { x: next.x, y: next.y };
        p.moveProgress = 0;
        p.heading = headingBetween(dx, dy);
        p.animState = 'walk';
        p.animStartedAt = now;
        return;
      }
      p.path = [];
    }

    p.animState = 'idle';
  }

  #performPlayerAttack(mob, now) {
    const p = this.player;
    p.heading = headingBetween(mob.tx - p.tx, mob.ty - p.ty);
    p.lastAttackAt = now;
    p.animState = 'attack';
    p.animStartedAt = now;

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
    const dmg = this.#rollWeaponDamage(mob, null);
    this.#applyDamageToMob(mob, dmg);
  }

  #rollWeaponDamage(mob, arrowItem) {
    const p = this.player;
    const hitChance = clamp(
      0.72 + (p.level - mob.level) * 0.025 + (p.stats.dex - 10) * 0.015 + (mob.ac || 0) * 0.008,
      0.35,
      0.97,
    );
    if (Math.random() > hitChance) return 0;

    const wDef = p.weaponItem?.def;
    const wPlus = p.weaponItem?.item?.plus || 0;
    const lo = wDef ? Math.max(2, wDef.small || 4) : 2;
    const hi = wDef ? Math.max(lo + 2, wDef.large || 6) : 5;
    const statBonus =
      p.weaponType === 'bow'
        ? Math.max(0, Math.floor((p.stats.dex - 8) / 2)) + (arrowItem ? this.worldData.items[arrowItem.name]?.small || 3 : 0)
        : Math.max(0, Math.floor((p.stats.str - 8) / 2));
    return randInt(lo, hi) + wPlus + statBonus + (wDef?.damage || 0);
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
    p.exp += gainedExp;
    p.lawful = clamp(p.lawful + (mob.isPassiveCritter ? -15 : 8), -32768, 32767);
    this.addLog(`擊倒了 ${mob.name}（EXP +${gainedExp}）。`, 'info');
    this.spawnFloatingText(mob.tx, mob.ty, `EXP +${gainedExp}`, '#a7f3d0');

    // 升級判定
    let leveled = false;
    while (p.level < 60 && p.exp >= this.getExpForLevel(p.level)) {
      p.level += 1;
      leveled = true;
      const cls = this.worldData.classes[p.classId] || this.worldData.classes.royal;
      const hpGain = Math.max(4, Math.floor((cls.baseHp || 14) * 0.65) + Math.floor((p.stats.con - 10) / 2) + randInt(1, 5));
      const mpGain = Math.max(1, Math.floor((cls.baseMp || 3) * 0.7) + Math.floor((p.stats.wis - 10) / 2) + randInt(0, 3));
      p.maxHp = Math.min(cls.maxHpCap || 1500, p.maxHp + hpGain);
      p.maxMp = Math.min(cls.maxMpCap || 1200, p.maxMp + mpGain);
      p.hp = p.maxHp;
      p.mp = p.maxMp;
      this.spawnEffect(p.tx, p.ty, 'levelup');
      this.audio.playSound('/level-up-v1/517.wav', 0.45);
      this.spawnFloatingText(p.tx, p.ty - 1, `LEVEL UP! Lv.${p.level}`, '#ffd54f');
      this.addLog(`恭喜升級！目前等級：Lv.${p.level}（HP ${p.maxHp} / MP ${p.maxMp}）！`, 'gold');
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
    const p = this.player;
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

      if (mob.moveTo) {
        mob.animState = 'walk';
        this.#stepEntityMovement(mob, 2.5, dtMs);
        continue;
      }

      if (mob.animState === 'attack' || mob.animState === 'damage') {
        if (now - mob.animStartedAt < 460) continue;
        mob.animState = 'idle';
      }

      const distToPlayer = tileDistance(mob.tx, mob.ty, p.tx, p.ty);
      if (mob.aggressive && distToPlayer <= 6 && p.hp > 0) {
        mob.aggroTarget = true;
      } else if (distToPlayer > 12) {
        mob.aggroTarget = false;
      }

      if (mob.aggroTarget && p.hp > 0) {
        if (distToPlayer <= mob.range) {
          if (now - mob.lastActAt >= 1250) {
            mob.lastActAt = now;
            mob.heading = headingBetween(p.tx - mob.tx, p.ty - mob.ty);
            mob.animState = 'attack';
            mob.animStartedAt = now;
            this.#applyMobAttackToPlayer(mob, now);
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
            mob.animState = 'walk';
            mob.animStartedAt = now;
            continue;
          }
        }
      } else if (now >= mob.nextRoamAt) {
        mob.nextRoamAt = now + randInt(2800, 6200);
        const [dx, dy] = HEADING_DELTAS[randInt(0, 7)];
        const nx = mob.tx + dx;
        const ny = mob.ty + dy;
        if (
          tileDistance(nx, ny, mob.spawn.x, mob.spawn.y) <= Math.max(3, Math.min(mob.spawn.size, 8)) &&
          !occupied.has(`${nx},${ny}`) &&
          this.isoMap.canStep(mob.tx, mob.ty, dx, dy, mob.map)
        ) {
          occupied.delete(`${mob.tx},${mob.ty}`);
          occupied.add(`${nx},${ny}`);
          mob.moveFrom = { x: mob.tx, y: mob.ty };
          mob.moveTo = { x: nx, y: ny };
          mob.moveProgress = 0;
          mob.heading = headingBetween(dx, dy);
          mob.animState = 'walk';
          mob.animStartedAt = now;
        }
      }
    }
  }

  #bestStepToward(mob, tx, ty, occupied) {
    let best = null;
    let bestD = tileDistance(mob.tx, mob.ty, tx, ty);
    for (const [dx, dy] of HEADING_DELTAS) {
      const nx = mob.tx + dx;
      const ny = mob.ty + dy;
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
    const hitChance = clamp(0.62 + (mob.level - p.level) * 0.02 + p.ac * 0.012, 0.18, 0.85);
    if (Math.random() > hitChance) {
      this.spawnFloatingText(p.tx, p.ty, 'DODGE', '#cbd5e1');
      return;
    }
    const raw = Math.max(1, Math.round(mob.level * 1.15 + randInt(1, 5)));
    const acRed = Math.max(0, Math.floor((10 - p.ac) * 0.35));
    const dmg = Math.max(1, raw - acRed);
    p.hp = Math.max(0, p.hp - dmg);
    this.spawnFloatingText(p.tx, p.ty, `-${dmg}`, '#ff4d4f');
    this.addLog(`${mob.name} 對你造成 ${dmg} 點傷害！`, 'danger');
    this.dirtySave = true;

    if (p.hp <= 0) {
      p.targetId = null;
      p.path = [];
      p.autoConfig.enabled = false;
      this.addLog('你的體力歸零倒下了…已由說話之島神殿復活返村！', 'danger');
      const penalty = Math.min(p.exp, Math.floor((this.getExpForLevel(p.level) - (p.level <= 1 ? 0 : this.getExpForLevel(p.level - 1))) * 0.03));
      p.exp = Math.max(0, p.exp - penalty);
      p.hp = Math.max(Math.ceil(p.maxHp * 0.5), 10);
      p.mp = Math.max(Math.ceil(p.maxMp * 0.5), 2);
      this.teleportTo(0, 32578, 32943, 4);
    }
  }

  #updateProjectiles(dtMs) {
    const next = [];
    for (const pr of this.projectiles) {
      pr.progress += (dtMs / 1000) * 6.5;
      if (pr.progress >= 1) {
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
    if (p.weightPercent >= 50 || p.hp <= 0) return;
    if (p.hp < p.maxHp) {
      p.hp = Math.min(p.maxHp, p.hp + Math.max(1, Math.floor((p.stats.con - 6) / 3)));
      this.dirtySave = true;
    }
    if (p.mp < p.maxMp) {
      const blueBonus = (p.buffs.bluePotion || 0) > now ? 4 : 0;
      p.mp = Math.min(p.maxMp, p.mp + Math.max(1, Math.floor((p.stats.wis - 8) / 3) + blueBonus));
      this.dirtySave = true;
    }
  }
}
