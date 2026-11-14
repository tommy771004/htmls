// 286 天堂實境客戶端：內掛與喝水符石控制器（自動喝水、自動尋敵、自動拾取與錨點巡邏）
import { tileDistance, HEADING_DELTAS } from './map-iso.js';

export class AutoHuntController {
  constructor(world) {
    this.world = world;
    this.lastHuntTickAt = 0;
    this.lastPotCheckAt = 0;
    this.patrolStep = 0;
    this.statusLabel = '待機（手動模式）';
  }

  toggle(forceState = null) {
    const cfg = this.world.player.autoConfig;
    const next = forceState === null ? !cfg.enabled : Boolean(forceState);
    cfg.enabled = next;
    if (next) {
      cfg.anchor = { map: this.world.player.map, x: this.world.player.tx, y: this.world.player.ty };
      this.statusLabel = `自動練功啟動（錨點 ${cfg.anchor.x},${cfg.anchor.y}）`;
      this.world.addLog(
        `啟動內掛符石：以 (${cfg.anchor.x}, ${cfg.anchor.y}) 半徑 ${cfg.radius} 格自動狩獵。`,
        'gold',
      );
    } else {
      cfg.anchor = null;
      this.statusLabel = '待機（手動模式）';
      this.world.addLog('已關閉內掛符石，切換回手動操作。', 'info');
    }
    this.world.dirtySave = true;
    this.world.saveWorld(true);
    return next;
  }

  step(now) {
    const p = this.world.player;
    const cfg = p.autoConfig;
    if (!p || p.hp <= 0) return;

    // 1. 喝水符石判斷（獨立於練功開關，只要開啟喝水且體力低於門檻即飲用）
    if (cfg.potEnabled && now - this.lastPotCheckAt >= 550) {
      this.lastPotCheckAt = now;
      const ratio = (p.hp / Math.max(1, p.maxHp)) * 100;
      if (ratio <= (cfg.potThreshold || 55)) {
        const pot = ['紅色藥水', '橙色藥水', '白色藥水'].find((name) =>
          p.inventory.some((it) => it.name === name && it.count > 0),
        );
        if (pot) {
          this.world.useItem(pot);
        } else if (p.spells.includes(1) && p.mp >= 4) {
          this.world.castSpell(1);
        }
      }
    }

    if (!cfg.enabled) {
      this.statusLabel = '手動操作中';
      return;
    }

    if (!cfg.anchor || cfg.anchor.map !== p.map) {
      cfg.anchor = { map: p.map, x: p.tx, y: p.ty };
    }

    if (now - this.lastHuntTickAt < 450) return;
    this.lastHuntTickAt = now;

    // 2. 超出掛機範圍先折返錨點
    const anchorDist = tileDistance(p.tx, p.ty, cfg.anchor.x, cfg.anchor.y);
    if (anchorDist > (cfg.radius || 14) + 3) {
      if (!p.path.length && !p.moveTo) {
        this.world.setWalkTarget(cfg.anchor.x, cfg.anchor.y);
      }
      this.statusLabel = '返回練功錨點中';
      return;
    }

    // 3. 若已有活著的目標則繼續交由引擎鎖定追蹤
    const currentMob = p.targetId ? this.world.mobs.find((m) => m.id === p.targetId && m.hp > 0) : null;
    if (currentMob) {
      this.statusLabel = `狩獵目標：${currentMob.name} (Lv.${currentMob.level})`;
      return;
    }

    // 4. 自動拾取附近戰利品
    if (cfg.pickupDrops && p.weightPercent < 82) {
      const nearestDrop = this.world.drops
        .filter((d) => d.map === p.map && tileDistance(p.tx, p.ty, d.tx, d.ty) <= 4)
        .sort((a, b) => tileDistance(p.tx, p.ty, a.tx, a.ty) - tileDistance(p.tx, p.ty, b.tx, b.ty))[0];
      if (nearestDrop) {
        this.world.pickupOrWalkToDrop(nearestDrop);
        this.statusLabel = `拾取戰利品：${nearestDrop.item}`;
        return;
      }
    }

    // 5. 尋找錨點半徑內最近的適合怪物（避開村莊可愛小動物與 55 級頭目克德）
    const radius = cfg.radius || 14;
    const candidates = this.world.mobs
      .filter(
        (m) =>
          m.hp > 0 &&
          m.map === p.map &&
          !m.isPassiveCritter &&
          m.level < 40 &&
          tileDistance(m.tx, m.ty, cfg.anchor.x, cfg.anchor.y) <= radius,
      )
      .sort((a, b) => tileDistance(p.tx, p.ty, a.tx, a.ty) - tileDistance(p.tx, p.ty, b.tx, b.ty));

    if (candidates.length > 0) {
      this.world.targetMob(candidates[0]);
      this.statusLabel = `接近獵物：${candidates[0].name}`;
      return;
    }

    // 6. 周圍暫無怪物時於錨點附近巡邏
    if (!p.path.length && !p.moveTo) {
      for (let i = 0; i < 8; i += 1) {
        this.patrolStep = (this.patrolStep + 1) % 8;
        const [dx, dy] = HEADING_DELTAS[this.patrolStep];
        const stepRadius = Math.max(3, Math.min(6, Math.floor(radius / 2)));
        const wx = cfg.anchor.x + dx * stepRadius;
        const wy = cfg.anchor.y + dy * stepRadius;
        if (this.world.isoMap.isWalkableTile(wx, wy, p.map)) {
          this.world.setWalkTarget(wx, wy);
          this.statusLabel = '巡邏索敵中…';
          return;
        }
      }
      this.statusLabel = '等待怪物重生…';
    }
  }
}
