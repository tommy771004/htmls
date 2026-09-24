// 標題與通關畫面的背景：草原上站著幾隻野靈，通關時再加上飄落的光點。

import Phaser from 'phaser';
import { getSpecies } from '../data/species';
import { registerTextures } from './textures';

export class ShowcaseScene extends Phaser.Scene {
  private mons: Phaser.GameObjects.Image[] = [];
  private sparks: Phaser.GameObjects.Rectangle[] = [];
  private key = '';
  reducedMotion = () => false;

  constructor() {
    super('showcase');
  }

  create(): void {
    registerTextures(this);
    this.add.image(0, 0, 'bg.meadow').setOrigin(0, 0);
    // 蓋住背景上的兩個戰鬥台座，改成一整片草原
    this.add.rectangle(0, 132, 256, 60, 0x000000, 0.12).setOrigin(0, 0);
  }

  /** species：要站成一排的物種；celebrate：通關時的光點。 */
  show(species: string[], celebrate: boolean): void {
    const key = `${species.join(',')}|${celebrate}`;
    if (key === this.key) return;
    this.key = key;
    this.mons.forEach((m) => m.destroy());
    this.sparks.forEach((s) => s.destroy());
    this.mons = [];
    this.sparks = [];
    const n = species.length;
    const gap = Math.min(60, 220 / Math.max(1, n));
    species.forEach((id, i) => {
      const x = 128 + (i - (n - 1) / 2) * gap;
      const img = this.add.image(x, 176, getSpecies(id).sprite.front).setOrigin(0.5, 1);
      if (n > 4) img.setScale(0.8);
      this.mons.push(img);
    });
    if (celebrate) {
      const colors = [0xffe07a, 0xff9f6b, 0x9fe3a8, 0x8fd0ff];
      for (let i = 0; i < 28; i++) {
        const r = this.add.rectangle((i * 37) % 256, (i * 53) % 150, 2, 2, colors[i % colors.length]).setOrigin(0, 0);
        this.sparks.push(r);
      }
    }
  }

  update(time: number): void {
    if (this.reducedMotion()) return;
    this.mons.forEach((m, i) => {
      m.y = 176 + Math.round(Math.sin(time / 400 + i * 1.3) * 1.5);
    });
    this.sparks.forEach((s, i) => {
      s.y = (s.y + 0.25 + (i % 3) * 0.1) % 160;
    });
  }
}
