import { describe, expect, it } from 'vitest';
import { buildSprites, CHAR_IDS, type PixelImage } from '../../src/art/index';
import { PALETTE_SIZE } from '../../src/art/palette';
import { SPECIES_LIST } from '../../src/data/species';
import { TILE_LIST } from '../../src/data/tiles';
import { ITEM_LIST } from '../../src/data/items';
import { MAP_LIST } from '../../src/data/maps';

const sprites = buildSprites();
const DIRS = ['up', 'down', 'left', 'right'] as const;

const alpha = (img: PixelImage, x: number, y: number) => img.data[(y * img.w + x) * 4 + 3];
const opaqueCount = (img: PixelImage) => {
  let n = 0;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] === 255) n++;
  return n;
};
const cornersClear = (img: PixelImage) =>
  [[0, 0], [img.w - 1, 0], [0, img.h - 1], [img.w - 1, img.h - 1]].every(([x, y]) => alpha(img, x, y) === 0);
const same = (a: PixelImage, b: PixelImage) => a.w === b.w && a.h === b.h && a.data.every((v, i) => v === b.data[i]);

function get(key: string, w: number, h: number): PixelImage {
  const img = sprites.get(key);
  expect(img, `missing sprite ${key}`).toBeDefined();
  expect([img!.w, img!.h], key).toEqual([w, h]);
  expect(img!.data.length, key).toBe(w * h * 4);
  return img!;
}

describe('art: sprite atlas', () => {
  it('is deterministic', () => {
    const again = buildSprites();
    expect([...again.keys()].sort()).toEqual([...sprites.keys()].sort());
    for (const [k, img] of sprites) expect(same(img, again.get(k)!), k).toBe(true);
  });

  it('uses only fully transparent or fully opaque pixels from one shared palette', () => {
    const colours = new Set<number>();
    let partial = 0;
    for (const img of sprites.values())
      for (let i = 0; i < img.data.length; i += 4) {
        const a = img.data[i + 3];
        if (a !== 0 && a !== 255) partial++;
        if (a === 255) colours.add((img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2]);
      }
    expect(partial).toBe(0);
    expect(colours.size).toBeLessThanOrEqual(PALETTE_SIZE);
  });
});

describe('art: monsters', () => {
  for (const sp of SPECIES_LIST) {
    it(`${sp.id} has front / back / icon`, () => {
      const front = get(sp.sprite.front, 48, 48);
      const back = get(sp.sprite.back, 48, 48);
      const icon = get(sp.sprite.icon, 24, 24);
      for (const img of [front, back, icon]) {
        expect(cornersClear(img)).toBe(true);
        expect(opaqueCount(img)).toBeGreaterThan(img.w * img.h * 0.15);
      }
      expect(same(front, back)).toBe(false);
    });
  }

  it('every species has a distinct silhouette', () => {
    const masks = SPECIES_LIST.map((sp) => {
      const img = sprites.get(sp.sprite.front)!;
      return Array.from({ length: 48 * 48 }, (_, i) => img.data[i * 4 + 3] > 0);
    });
    for (let a = 0; a < masks.length; a++)
      for (let b = a + 1; b < masks.length; b++) {
        let diff = 0;
        for (let i = 0; i < masks[a].length; i++) if (masks[a][i] !== masks[b][i]) diff++;
        expect(diff, `${SPECIES_LIST[a].id} vs ${SPECIES_LIST[b].id}`).toBeGreaterThan(200);
      }
  });
});

describe('art: tiles', () => {
  const keys = [...TILE_LIST.map((t) => t.sprite), 'tile.water.b'];
  for (const key of keys) {
    it(`${key} is an opaque 16×16 tile`, () => {
      const img = get(key, 16, 16);
      expect(opaqueCount(img)).toBe(256);
    });
  }

  it('water has two different animation frames', () => {
    expect(same(sprites.get('tile.water')!, sprites.get('tile.water.b')!)).toBe(false);
  });
});

describe('art: characters', () => {
  it('lists the eleven map characters', () => {
    expect(CHAR_IDS).toEqual(['player', 'tutor', 'healer', 'shopkeeper', 'kid', 'traveler', 'warden', 'ranger', 'gatekeeper', 'boss', 'fan']);
  });

  it('covers every char.* sprite referenced by the maps', () => {
    for (const map of MAP_LIST)
      for (const e of map.entities)
        if (e.sprite.startsWith('char.')) for (const d of DIRS) get(`${e.sprite}.${d}.0`, 16, 16);
  });

  for (const id of CHAR_IDS) {
    it(`${id} has 4 directions × 3 frames`, () => {
      for (const d of DIRS) {
        const frames = [0, 1, 2].map((f) => get(`char.${id}.${d}.${f}`, 16, 16));
        for (const img of frames) {
          expect(cornersClear(img)).toBe(true);
          expect(opaqueCount(img)).toBeGreaterThan(60);
        }
        expect(same(frames[0], frames[1]), `${id}.${d} 0 vs 1`).toBe(false);
        expect(same(frames[0], frames[2]), `${id}.${d} 0 vs 2`).toBe(false);
        expect(same(frames[1], frames[2]), `${id}.${d} 1 vs 2`).toBe(false);
      }
      expect(same(get(`char.${id}.up.0`, 16, 16), get(`char.${id}.down.0`, 16, 16))).toBe(false);
    });
  }

  it('characters are not palette swaps of each other', () => {
    const shape = (id: string) => {
      const img = sprites.get(`char.${id}.down.0`)!;
      return Array.from({ length: 256 }, (_, i) => img.data[i * 4 + 3] > 0).join('');
    };
    const shapes = new Set(CHAR_IDS.map(shape));
    expect(shapes.size).toBe(CHAR_IDS.length);
  });
});

describe('art: objects, items and battle backgrounds', () => {
  for (const key of ['obj.sign', 'obj.terminal', 'obj.itemball', ...ITEM_LIST.map((i) => i.sprite)]) {
    it(`${key} is a 16×16 sprite with transparent corners`, () => {
      const img = get(key, 16, 16);
      expect(cornersClear(img)).toBe(true);
      expect(opaqueCount(img)).toBeGreaterThan(30);
    });
  }

  for (const id of new Set(MAP_LIST.map((m) => m.battleBg))) {
    it(`bg.${id} is an opaque 256×192 scene`, () => {
      const img = get(`bg.${id}`, 256, 192);
      expect(opaqueCount(img)).toBe(256 * 192);
    });
  }
});
