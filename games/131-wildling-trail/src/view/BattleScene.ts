// 戰鬥畫面：背景、雙方怪獸與動畫提示。每個戰鬥事件的結果已經由規則引擎決定，
// 這裡只依事件附帶的 cue 播放動畫；跳過或減少動態效果都不會改變結果。

import Phaser from 'phaser';
import type { AnimCue, SideView, Snapshot } from '../core/battle';
import type { GrowthCue } from '../core/growth';
import { getSpecies } from '../data/species';
import type { SoundId } from './audio';
import { registerTextures } from './textures';

const ENEMY_POS = { x: 196, y: 88 };
const PLAYER_POS = { x: 62, y: 164 };
const CENTER_POS = { x: 128, y: 120 };

type Side = 'player' | 'enemy';

export class BattleScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Image;
  private enemy!: Phaser.GameObjects.Image;
  private player!: Phaser.GameObjects.Image;
  private focus!: Phaser.GameObjects.Image;
  private cage!: Phaser.GameObjects.Image;
  private flash!: Phaser.GameObjects.Rectangle;
  private fast = false;
  private token = 0;
  busy = false;
  reducedMotion = () => false;
  playSound: (id: SoundId) => void = () => undefined;

  constructor() {
    super('battle');
  }

  create(): void {
    registerTextures(this);
    this.bg = this.add.image(0, 0, 'bg.meadow').setOrigin(0, 0);
    this.enemy = this.add.image(ENEMY_POS.x, ENEMY_POS.y, '__DEFAULT').setOrigin(0.5, 1).setVisible(false);
    this.player = this.add.image(PLAYER_POS.x, PLAYER_POS.y, '__DEFAULT').setOrigin(0.5, 1).setVisible(false);
    this.focus = this.add.image(CENTER_POS.x, CENTER_POS.y, '__DEFAULT').setOrigin(0.5, 1).setVisible(false);
    this.cage = this.add.image(0, 0, 'item.cage').setVisible(false).setDepth(5);
    this.flash = this.add.rectangle(0, 0, 256, 192, 0xffffff, 0).setOrigin(0, 0).setDepth(10);
  }

  private sprite(side: Side): Phaser.GameObjects.Image {
    return side === 'player' ? this.player : this.enemy;
  }

  private home(side: Side): { x: number; y: number } {
    return side === 'player' ? PLAYER_POS : ENEMY_POS;
  }

  setBackground(name: string): void {
    this.bg.setTexture(`bg.${name}`);
  }

  /** 開戰時重設所有物件。 */
  reset(bg: string): void {
    this.token++;
    this.tweens.killAll();
    this.busy = false;
    this.fast = false;
    this.setBackground(bg);
    for (const side of ['player', 'enemy'] as Side[]) {
      const s = this.sprite(side);
      s.setVisible(false).setAlpha(1).setScale(1).clearTint().setPosition(this.home(side).x, this.home(side).y).setCrop();
    }
    this.focus.setVisible(false);
    this.cage.setVisible(false);
    this.flash.setAlpha(0);
  }

  private textureFor(view: SideView, side: Side): string {
    const s = getSpecies(view.species).sprite;
    return side === 'player' ? s.back : s.front;
  }

  /** 依事件快照同步兩邊的外觀（不含動畫）。 */
  applySnap(snap: Snapshot, includeVisibility: boolean): void {
    for (const side of ['player', 'enemy'] as Side[]) {
      const view = snap[side];
      const s = this.sprite(side);
      s.setTexture(this.textureFor(view, side));
      if (includeVisibility) {
        s.setVisible(view.visible).setAlpha(1).setScale(1).setCrop().setPosition(this.home(side).x, this.home(side).y);
      }
      this.tintStatus(s, view.status);
    }
  }

  private tintStatus(s: Phaser.GameObjects.Image, status: string): void {
    if (status === 'burn') s.setTint(0xffd2c2);
    else if (status === 'poison') s.setTint(0xe6cdf2);
    else if (status === 'sleep') s.setTint(0xc9d7ff);
    else s.clearTint();
  }

  /** 快轉：目前與之後的動畫都立即完成。 */
  skip(): void {
    this.fast = true;
    for (const t of this.tweens.getTweens()) t.complete();
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    const instant = this.fast || this.reducedMotion();
    return new Promise((resolve) => {
      this.tweens.add({
        ...config,
        duration: instant ? 0 : config.duration,
        delay: instant ? 0 : config.delay,
        repeat: instant ? 0 : config.repeat,
        yoyo: instant ? false : config.yoyo,
        onComplete: () => resolve(),
      });
    });
  }

  private wait(ms: number): Promise<void> {
    if (this.fast || this.reducedMotion()) return Promise.resolve();
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  private async flashScreen(color: number, peak = 0.7): Promise<void> {
    if (this.reducedMotion()) return;
    this.flash.setFillStyle(color, 1).setAlpha(0);
    await this.tween({ targets: this.flash, alpha: peak, duration: 70, yoyo: true });
    this.flash.setAlpha(0);
  }

  /** 播放一個戰鬥事件的所有 cue，完成後呼叫 done（若期間又開了新事件則不呼叫）。 */
  async playEvent(snap: Snapshot, cues: AnimCue[], done: () => void): Promise<void> {
    const token = ++this.token;
    this.fast = false;
    this.busy = true;
    this.applySnap(snap, false);
    for (const cue of cues) {
      if (token !== this.token) return;
      await this.playCue(cue, snap);
    }
    if (token !== this.token) return;
    this.applySnap(snap, true);
    this.busy = false;
    done();
  }

  private async playCue(cue: AnimCue, snap: Snapshot): Promise<void> {
    switch (cue.a) {
      case 'switchIn': {
        const s = this.sprite(cue.side);
        const home = this.home(cue.side);
        s.setTexture(this.textureFor(snap[cue.side], cue.side)).setVisible(true).setPosition(home.x, home.y).setCrop();
        s.setScale(0.2).setAlpha(0.2);
        await this.tween({ targets: s, scale: 1, alpha: 1, duration: 260, ease: 'Back.Out' });
        return;
      }
      case 'switchOut': {
        const s = this.sprite(cue.side);
        await this.tween({ targets: s, scale: 0.2, alpha: 0, duration: 200 });
        s.setVisible(false).setScale(1).setAlpha(1);
        return;
      }
      case 'attack': {
        this.playSound('attack');
        const s = this.sprite(cue.side);
        const home = this.home(cue.side);
        const dx = cue.side === 'player' ? 14 : -14;
        const dy = cue.side === 'player' ? -6 : 6;
        if (cue.physical) await this.tween({ targets: s, x: home.x + dx, y: home.y + dy, duration: 90, yoyo: true });
        else await this.tween({ targets: s, y: home.y - 4, duration: 80, yoyo: true });
        s.setPosition(home.x, home.y);
        return;
      }
      case 'hit': {
        const s = this.sprite(cue.side);
        this.playSound(cue.effectiveness > 1 ? 'hitSuper' : 'hit');
        if (cue.effectiveness > 1 && !this.reducedMotion() && !this.fast) this.cameras.main.shake(160, 0.012);
        await this.tween({ targets: s, alpha: 0.15, duration: 60, yoyo: true, repeat: 2 });
        s.setAlpha(1);
        return;
      }
      case 'miss': {
        const s = this.sprite(cue.side);
        const home = this.home(cue.side);
        await this.tween({ targets: s, x: home.x + (cue.side === 'player' ? -8 : 8), duration: 80, yoyo: true });
        s.setX(home.x);
        return;
      }
      case 'heal':
      case 'item': {
        this.playSound('status');
        const s = this.sprite(cue.side);
        s.setTint(cue.a === 'heal' ? 0xc8f7c0 : 0xfff3b0);
        await this.tween({ targets: s, y: this.home(cue.side).y - 3, duration: 120, yoyo: true, repeat: 1 });
        s.setY(this.home(cue.side).y);
        this.tintStatus(s, snap[cue.side].status);
        return;
      }
      case 'status': {
        this.playSound('status');
        const s = this.sprite(cue.side);
        const color = cue.status === 'burn' ? 0xff7a4d : cue.status === 'poison' ? 0xb46be0 : 0x7fa4ff;
        s.setTint(color);
        await this.wait(260);
        this.tintStatus(s, cue.status);
        return;
      }
      case 'stage': {
        const s = this.sprite(cue.side);
        const home = this.home(cue.side);
        s.setTint(cue.up ? 0xffe6a8 : 0xa8c8ff);
        await this.tween({ targets: s, y: home.y + (cue.up ? -5 : 4), duration: 110, yoyo: true, repeat: 1 });
        s.setY(home.y);
        this.tintStatus(s, snap[cue.side].status);
        return;
      }
      case 'faint': {
        this.playSound('faint');
        const s = this.sprite(cue.side);
        const home = this.home(cue.side);
        await this.tween({ targets: s, y: home.y + 40, alpha: 0, duration: 380, ease: 'Quad.In' });
        s.setVisible(false).setAlpha(1).setY(home.y);
        return;
      }
      case 'throw': {
        this.playSound('throw');
        this.cage.setTexture(`item.${cue.item}`).setVisible(true).setPosition(PLAYER_POS.x + 20, PLAYER_POS.y - 30).setAngle(0);
        await this.tween({ targets: this.cage, x: ENEMY_POS.x, duration: 380, ease: 'Linear' });
        await this.flashScreen(0xffffff, 0.5);
        this.enemy.setVisible(false);
        this.cage.setPosition(ENEMY_POS.x, ENEMY_POS.y - 8);
        return;
      }
      case 'shake': {
        this.playSound('shake');
        await this.tween({ targets: this.cage, angle: 18, duration: 90, yoyo: true });
        await this.tween({ targets: this.cage, angle: -18, duration: 90, yoyo: true });
        await this.wait(200);
        return;
      }
      case 'caught': {
        this.playSound('caught');
        this.cage.setTint(0xfff1a0);
        await this.wait(400);
        this.cage.clearTint();
        return;
      }
      case 'breakout': {
        await this.flashScreen(0xffffff, 0.6);
        this.cage.setVisible(false);
        this.enemy.setVisible(true).setScale(0.5);
        await this.tween({ targets: this.enemy, scale: 1, duration: 180, ease: 'Back.Out' });
        return;
      }
      case 'flee': {
        const s = this.player;
        await this.tween({ targets: s, x: -40, duration: 260 });
        s.setVisible(false).setX(PLAYER_POS.x);
        return;
      }
    }
  }

  /** 結算畫面：升級閃光與進化演出。 */
  async playGrowth(cue: GrowthCue | undefined, focusSpecies: string | null, done: () => void): Promise<void> {
    const token = ++this.token;
    this.fast = false;
    this.cage.setVisible(false);
    if (!cue || (cue.a !== 'evolveStart' && cue.a !== 'evolved' && cue.a !== 'levelup')) {
      this.focus.setVisible(false);
      done();
      return;
    }
    this.busy = true;
    this.enemy.setVisible(false);
    this.player.setVisible(false);
    if (focusSpecies) this.focus.setTexture(getSpecies(focusSpecies).sprite.front).setVisible(true).setScale(1).setAlpha(1).clearTint();
    if (cue.a === 'levelup') {
      this.focus.setTint(0xfff1a0);
      await this.tween({ targets: this.focus, y: CENTER_POS.y - 6, duration: 120, yoyo: true, repeat: 1 });
      this.focus.setY(CENTER_POS.y).clearTint();
    } else if (cue.a === 'evolveStart') {
      const from = getSpecies(cue.from).sprite.front;
      const to = getSpecies(cue.to).sprite.front;
      this.playSound('status');
      // 新舊外形交替閃爍，越來越快。
      for (const ms of [260, 220, 180, 140, 110, 90, 70, 60]) {
        if (token !== this.token) return;
        this.focus.setTexture(to).setTintFill(0xffffff);
        await this.wait(ms);
        this.focus.setTexture(from).setTintFill(0xffffff);
        await this.wait(ms);
      }
      this.focus.setTexture(from).clearTint();
    } else if (cue.a === 'evolved') {
      this.focus.setTexture(getSpecies(cue.to).sprite.front);
      await this.flashScreen(0xffffff, 0.9);
      this.focus.clearTint();
    }
    if (token !== this.token) return;
    this.busy = false;
    done();
  }

  hideFocus(): void {
    this.focus.setVisible(false);
  }
}
