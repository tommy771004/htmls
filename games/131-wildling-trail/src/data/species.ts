import type { SpeciesDef } from '../core/types';

const sprite = (id: string) => ({ front: `mon.${id}.front`, back: `mon.${id}.back`, icon: `mon.${id}.icon` });

/** 八種原創怪獸。三隻初始夥伴＋一條兩階段進化線＋兩種野生怪獸。 */
export const SPECIES_LIST: SpeciesDef[] = [
  {
    id: 'wickling', name: '燭尾', type: 'flame',
    base: { hp: 44, atk: 58, def: 42, spd: 62 }, catchRate: 0.45, expYield: 64,
    learnset: [
      { level: 1, move: 'spark' }, { level: 1, move: 'warmup' }, { level: 5, move: 'leech' },
      { level: 7, move: 'scorch' }, { level: 13, move: 'blaze' },
    ],
    sprite: sprite('wickling'),
    dex: '尾巴尖端點著一小簇永不熄滅的火。夜裡會把尾巴捲起來當燈。',
  },
  {
    id: 'bubblet', name: '泡鰭', type: 'tide',
    base: { hp: 52, atk: 48, def: 56, spd: 48 }, catchRate: 0.45, expYield: 64,
    learnset: [
      { level: 1, move: 'bubble' }, { level: 1, move: 'jet' }, { level: 5, move: 'vine' },
      { level: 7, move: 'lull' }, { level: 13, move: 'surge' },
    ],
    sprite: sprite('bubblet'),
    dex: '頭側三對羽狀鰓會隨心情變色。喜歡把泡泡吹成圓圈送給朋友。',
  },
  {
    id: 'mossum', name: '苔團', type: 'moss',
    base: { hp: 58, atk: 52, def: 58, spd: 38 }, catchRate: 0.45, expYield: 64,
    learnset: [
      { level: 1, move: 'vine' }, { level: 1, move: 'warmup' }, { level: 5, move: 'bubble' },
      { level: 7, move: 'leech' }, { level: 10, move: 'spore' }, { level: 13, move: 'gale' },
    ],
    sprite: sprite('mossum'),
    dex: '背上長著一株嫩芽。曬太陽時會瞇起眼睛，一動也不動。',
  },
  {
    id: 'sprigling', name: '芽蟲', type: 'moss',
    base: { hp: 40, atk: 35, def: 38, spd: 42 }, catchRate: 0.9, expYield: 40,
    learnset: [{ level: 1, move: 'vine' }, { level: 4, move: 'spore' }],
    evolution: { level: 6, into: 'leafcoon' },
    sprite: sprite('sprigling'),
    dex: '身體一節一節的小蟲，頭上頂著兩片子葉。吃得很多，長得很快。',
  },
  {
    id: 'leafcoon', name: '繭葉', type: 'moss',
    base: { hp: 50, atk: 30, def: 70, spd: 25 }, catchRate: 0.6, expYield: 72,
    learnset: [{ level: 1, move: 'vine' }, { level: 1, move: 'spore' }, { level: 8, move: 'leech' }],
    evolution: { level: 9, into: 'verdmoth' },
    sprite: sprite('leafcoon'),
    dex: '用一片大葉子把自己裹起來，倒掛在枝頭等待羽化。',
  },
  {
    id: 'verdmoth', name: '翠翅蛾', type: 'moss',
    base: { hp: 64, atk: 66, def: 56, spd: 72 }, catchRate: 0.3, expYield: 150,
    learnset: [{ level: 1, move: 'leech' }, { level: 1, move: 'spore' }, { level: 9, move: 'gale' }, { level: 12, move: 'lull' }],
    sprite: sprite('verdmoth'),
    dex: '翅膀上的眼紋會嚇退天敵。鱗粉在月光下發出淡綠色的光。',
  },
  {
    id: 'mistsnail', name: '霧蝸', type: 'tide',
    base: { hp: 55, atk: 42, def: 66, spd: 28 }, catchRate: 0.7, expYield: 58,
    learnset: [{ level: 1, move: 'bubble' }, { level: 5, move: 'lull' }, { level: 9, move: 'surge' }],
    sprite: sprite('mistsnail'),
    dex: '殼裡總是飄出一縷白霧。下過雨的早晨會成群爬上石頭。',
  },
  {
    id: 'cinderow', name: '燼鴉', type: 'flame',
    base: { hp: 48, atk: 60, def: 40, spd: 70 }, catchRate: 0.55, expYield: 66,
    learnset: [{ level: 1, move: 'spark' }, { level: 1, move: 'jet' }, { level: 8, move: 'scorch' }, { level: 11, move: 'blaze' }],
    sprite: sprite('cinderow'),
    dex: '翅尖像燒過的紙一樣閃著紅光。會把亮晶晶的東西藏進樹洞。',
  },
];

export const STARTERS = ['wickling', 'bubblet', 'mossum'] as const;

export const SPECIES: Record<string, SpeciesDef> = Object.fromEntries(SPECIES_LIST.map((s) => [s.id, s]));

export function getSpecies(id: string): SpeciesDef {
  const species = SPECIES[id];
  if (!species) throw new Error(`未知物種：${id}`);
  return species;
}
