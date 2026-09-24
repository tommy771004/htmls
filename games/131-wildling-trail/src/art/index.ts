// 野靈旅記的原創像素美術：純 TypeScript、決定性、不碰 DOM 與 Phaser。
// buildSprites() 回傳 key → RGBA 圖；key 與 src/data/* 裡的 sprite 欄位一一對應。

import { SPECIES_LIST } from '../data/species';
import { drawMonster } from './monsters';
import { drawCharacter, type CharDir } from './characters';
import { TILE_DRAW } from './tiles';
import { OBJECT_DRAW } from './objects';
import { BG_DRAW } from './backgrounds';
import type { PixelImage } from './raster';

export type { PixelImage } from './raster';

export const CHAR_IDS: readonly string[] = [
  'player', 'tutor', 'healer', 'shopkeeper', 'kid', 'traveler', 'warden', 'ranger', 'gatekeeper', 'boss', 'fan',
];

export function buildSprites(): Map<string, PixelImage> {
  const out = new Map<string, PixelImage>();
  for (const sp of SPECIES_LIST) {
    out.set(sp.sprite.front, drawMonster(sp.id, 'front').toImage());
    out.set(sp.sprite.back, drawMonster(sp.id, 'back').toImage());
    out.set(sp.sprite.icon, drawMonster(sp.id, 'icon').toImage());
  }
  for (const [key, draw] of Object.entries(TILE_DRAW)) out.set(key, draw().toImage());
  for (const [key, draw] of Object.entries(OBJECT_DRAW)) out.set(key, draw().toImage());
  for (const [key, draw] of Object.entries(BG_DRAW)) out.set(key, draw().toImage());
  const dirs: CharDir[] = ['up', 'down', 'left', 'right'];
  for (const id of CHAR_IDS)
    for (const d of dirs) for (let f = 0; f < 3; f++) out.set(`char.${id}.${d}.${f}`, drawCharacter(id, d, f).toImage());
  return out;
}
