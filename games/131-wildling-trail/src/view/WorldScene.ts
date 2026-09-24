// 俯視角世界：地形、NPC、玩家與目標標記。位置與結果全部來自 GameApp，
// 這裡只做補間動畫；補間進行中控制器不會送出下一步。

import Phaser from 'phaser';
import type { GameApp } from '../app/game';
import type { Effect } from '../app/types';
import type { Dir } from '../core/types';
import { tileAt, type MapDef } from '../core/world';
import { getMap } from '../data/maps';
import { TILE } from '../data/tiles';
import { registerTextures } from './textures';

export const VIEW_W = 256;
export const VIEW_H = 192;
const STEP_MS = 150;

export class WorldScene extends Phaser.Scene {
  private app!: GameApp;
  private mapId = '';
  private layer: Phaser.GameObjects.Container | null = null;
  private water: Phaser.GameObjects.Image[] = [];
  private npcs = new Map<string, Phaser.GameObjects.Image>();
  private player!: Phaser.GameObjects.Image;
  private marker!: Phaser.GameObjects.Container;
  private stepFrame = 1;
  private waterTimer = 0;
  private waterAlt = false;
  busy = false;
  reducedMotion = () => false;

  constructor() {
    super('world');
  }

  init(data: { app: GameApp }): void {
    this.app = data.app;
  }

  create(): void {
    registerTextures(this);
    this.cameras.main.setRoundPixels(true);
    this.player = this.add.image(0, 0, 'char.player.down.0').setOrigin(0, 0).setDepth(10);
    this.marker = this.buildMarker().setDepth(20).setVisible(false);
    this.app.onEffect((e) => this.onEffect(e));
    this.syncAll();
  }

  private buildMarker(): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    // 小小的對話泡泡與驚嘆號，提示目前目標人物。
    g.fillStyle(0x2b2118, 1).fillRect(3, 0, 8, 10).fillRect(2, 1, 10, 8);
    g.fillStyle(0xfff4d6, 1).fillRect(4, 1, 6, 8).fillRect(3, 2, 8, 6);
    g.fillStyle(0xd9482b, 1).fillRect(6, 2, 2, 4).fillRect(6, 7, 2, 1);
    g.fillStyle(0x2b2118, 1).fillRect(6, 10, 2, 1);
    return this.add.container(0, 0, [g]);
  }

  private onEffect(e: Effect): void {
    if (!this.sys.isActive() && e.kind !== 'mapChanged') return;
    if (e.kind === 'step') this.animateStep(e.from, e.to, e.dir);
    else if (e.kind === 'turn') this.setPlayerFrame(e.dir, 0);
    else if (e.kind === 'bump') this.bump(e.dir);
    else if (e.kind === 'mapChanged') this.syncAll();
  }

  /** 依目前進度重建地圖與所有角色位置。 */
  syncAll(): void {
    if (!this.app.progress || !this.player) return;
    const p = this.app.p.player;
    if (p.map !== this.mapId) this.buildMap(getMap(p.map));
    this.tweens.killTweensOf(this.player);
    this.busy = false;
    this.player.setPosition(p.x * TILE, p.y * TILE);
    this.setPlayerFrame(p.facing, 0);
    this.syncEntities();
  }

  private buildMap(map: MapDef): void {
    this.layer?.destroy(true);
    this.npcs.forEach((s) => s.destroy());
    this.npcs.clear();
    this.water = [];
    this.mapId = map.id;
    const tiles: Phaser.GameObjects.Image[] = [];
    map.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const tile = tileAt(map, x, y)!;
        const img = this.make.image({ x: x * TILE, y: y * TILE, key: tile.sprite, add: false }).setOrigin(0, 0);
        if (tile.sprite === 'tile.water') this.water.push(img);
        tiles.push(img);
      }
    });
    this.layer = this.add.container(0, 0, tiles).setDepth(0);
    const mapW = map.rows[0].length * TILE;
    const mapH = map.rows.length * TILE;
    const bx = Math.min(0, (mapW - VIEW_W) / 2);
    const by = Math.min(0, (mapH - VIEW_H) / 2);
    this.cameras.main.setBounds(Math.floor(bx), Math.floor(by), Math.max(mapW, VIEW_W), Math.max(mapH, VIEW_H));
    this.cameras.main.setBackgroundColor(map.id === 'arena' ? '#3b3430' : '#24301f');
    this.cameras.main.startFollow(this.player, true, 1, 1, -TILE / 2, -TILE / 2);
  }

  private syncEntities(): void {
    const visible = new Set<string>();
    for (const e of this.app.visibleEntities()) {
      visible.add(e.def.id);
      const key = e.def.sprite.startsWith('char.') ? `${e.def.sprite}.${this.app.entityFacing(e)}.0` : e.def.sprite;
      let img = this.npcs.get(e.def.id);
      if (!img) {
        img = this.add.image(0, 0, key).setOrigin(0, 0).setDepth(9);
        this.npcs.set(e.def.id, img);
      }
      img.setTexture(key).setPosition(e.x * TILE, e.y * TILE).setVisible(true);
    }
    for (const [id, img] of this.npcs) if (!visible.has(id)) img.setVisible(false);
    this.updateMarker();
  }

  private updateMarker(): void {
    const o = this.app.objective();
    const t = o?.target;
    const img = t && t.map === this.mapId ? this.npcs.get(t.entity) : undefined;
    if (!img || !img.visible) {
      this.marker.setVisible(false);
      return;
    }
    this.marker.setVisible(true).setPosition(img.x + 1, img.y - 13);
  }

  private setPlayerFrame(dir: Dir, frame: number): void {
    this.player.setTexture(`char.player.${dir}.${frame}`);
  }

  private animateStep(from: { x: number; y: number }, to: { x: number; y: number }, dir: Dir): void {
    this.tweens.killTweensOf(this.player);
    this.player.setPosition(from.x * TILE, from.y * TILE);
    this.stepFrame = this.stepFrame === 1 ? 2 : 1;
    this.setPlayerFrame(dir, this.stepFrame);
    const duration = this.reducedMotion() ? 70 : STEP_MS;
    this.busy = true;
    this.tweens.add({
      targets: this.player,
      x: to.x * TILE,
      y: to.y * TILE,
      duration,
      onComplete: () => {
        this.busy = false;
        this.setPlayerFrame(dir, 0);
      },
    });
  }

  private bump(dir: Dir): void {
    this.setPlayerFrame(dir, 0);
    if (this.reducedMotion() || this.busy) return;
    const d = { up: [0, -2], down: [0, 2], left: [-2, 0], right: [2, 0] }[dir];
    const x0 = this.player.x;
    const y0 = this.player.y;
    this.busy = true;
    this.tweens.add({
      targets: this.player,
      x: x0 + d[0],
      y: y0 + d[1],
      duration: 50,
      yoyo: true,
      onComplete: () => {
        this.player.setPosition(x0, y0);
        this.busy = false;
      },
    });
  }

  update(_time: number, delta: number): void {
    if (!this.app.progress) return;
    if (this.app.p.player.map !== this.mapId) this.syncAll();
    if (!this.busy) {
      const p = this.app.p.player;
      if (this.player.x !== p.x * TILE || this.player.y !== p.y * TILE) this.player.setPosition(p.x * TILE, p.y * TILE);
    }
    this.syncEntities();
    if (!this.reducedMotion()) {
      this.waterTimer += delta;
      if (this.waterTimer > 600) {
        this.waterTimer = 0;
        this.waterAlt = !this.waterAlt;
        for (const w of this.water) w.setTexture(this.waterAlt ? 'tile.water.b' : 'tile.water');
      }
      this.marker.y += Math.sin(_time / 180) * 0.15;
    }
  }
}
