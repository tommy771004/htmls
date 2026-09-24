// 全作共用的限定色盤。怪獸、角色、地圖格、道具與戰鬥背景都只從這裡取色，
// 讓整體像同一套像素美術。光源固定在左上方：每條色階由暗到亮排列。

/** 色盤名稱 → #rrggbb。順序即索引（索引 0 保留給透明）。 */
const HEX = {
  // 中性：墨、石、灰、紙
  ink: '#231e2c',
  slate: '#41405a',
  stone: '#6c6d80',
  ash: '#9d9eab',
  mist: '#cfd0d8',
  paper: '#f4efdf',
  // 火：燼 → 焰 → 光
  emberDark: '#5a1c24',
  ember: '#a2392d',
  flame: '#db6331',
  glow: '#f2a046',
  spark: '#fbe38e',
  // 水：深海 → 泡沫
  deepSea: '#1b2d4b',
  sea: '#2c6488',
  tide: '#489fb2',
  foam: '#98d8cf',
  // 苔：深林 → 嫩黃綠
  forestDark: '#1d3829',
  forest: '#336a3b',
  moss: '#5e9d44',
  sprout: '#a2cb5a',
  lime: '#d9ea8d',
  // 土與木
  soil: '#3a2822',
  bark: '#65422f',
  wood: '#946441',
  sand: '#c49a62',
  straw: '#e6c982',
  // 膚色
  skinShade: '#c3866a',
  skin: '#eeba92',
  // 莓果
  wine: '#662040',
  berry: '#b7416a',
  rose: '#eb8da4',
  // 藍布
  navy: '#29304f',
  denim: '#465b8b',
  sky: '#90b7d8',
  // 金
  ochre: '#a47725',
  gold: '#dcb044',
  // 霧紫
  dusk: '#4b3b64',
  lilac: '#8a7bad',
  haze: '#c7bedf',
  // 天空（背景用的淡色）
  skyPale: '#d4e9e9',
} as const;

export type ColorName = keyof typeof HEX;

export const COLOR_NAMES = Object.keys(HEX) as ColorName[];

/** 名稱 → 色盤索引（1 起算；0 = 透明）。 */
export const C = Object.fromEntries(COLOR_NAMES.map((n, i) => [n, i + 1])) as Record<ColorName, number>;

export const TRANSPARENT = 0;

/** 索引 → RGBA（索引 0 為全透明）。 */
export const RGBA: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 0, 0],
  ...COLOR_NAMES.map((n) => {
    const v = parseInt(HEX[n].slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255] as const;
  }),
];

export const PALETTE_SIZE = COLOR_NAMES.length;

/** 每個顏色描邊時使用的「加深色」：同色階最暗的一格，而不是純黑。 */
const OUTLINE_NAME: Record<ColorName, ColorName> = {
  ink: 'ink', slate: 'ink', stone: 'ink', ash: 'slate', mist: 'slate', paper: 'slate',
  emberDark: 'ink', ember: 'emberDark', flame: 'emberDark', glow: 'emberDark', spark: 'ember',
  deepSea: 'ink', sea: 'deepSea', tide: 'deepSea', foam: 'deepSea',
  forestDark: 'ink', forest: 'forestDark', moss: 'forestDark', sprout: 'forestDark', lime: 'forestDark',
  soil: 'ink', bark: 'soil', wood: 'soil', sand: 'bark', straw: 'bark',
  skinShade: 'bark', skin: 'bark',
  wine: 'ink', berry: 'wine', rose: 'wine',
  navy: 'ink', denim: 'navy', sky: 'navy',
  ochre: 'soil', gold: 'bark',
  dusk: 'ink', lilac: 'dusk', haze: 'dusk',
  skyPale: 'stone',
};

export const OUTLINE_OF: readonly number[] = [0, ...COLOR_NAMES.map((n) => C[OUTLINE_NAME[n]])];

/** 一條四到五階的色階：描邊、暗、中、亮、（高光）。 */
export interface Ramp {
  o: number;
  d: number;
  m: number;
  l: number;
  h?: number;
}

const ramp = (o: ColorName, d: ColorName, m: ColorName, l: ColorName, h?: ColorName): Ramp => ({
  o: C[o], d: C[d], m: C[m], l: C[l], ...(h ? { h: C[h] } : {}),
});

/** 常用色階。 */
export const R = {
  flame: ramp('emberDark', 'ember', 'flame', 'glow', 'spark'),
  fire: ramp('ember', 'flame', 'glow', 'spark'),
  tide: ramp('deepSea', 'sea', 'tide', 'foam', 'paper'),
  deep: ramp('deepSea', 'deepSea', 'sea', 'tide'),
  moss: ramp('forestDark', 'forest', 'moss', 'sprout', 'lime'),
  leaf: ramp('forestDark', 'moss', 'sprout', 'lime'),
  bark: ramp('soil', 'bark', 'wood', 'sand'),
  sand: ramp('bark', 'wood', 'sand', 'straw'),
  bud: ramp('bark', 'sand', 'straw', 'paper'),
  stone: ramp('ink', 'slate', 'stone', 'ash', 'mist'),
  pale: ramp('slate', 'ash', 'mist', 'paper'),
  crow: ramp('ink', 'ink', 'slate', 'stone'),
  berry: ramp('wine', 'wine', 'berry', 'rose'),
  pink: ramp('wine', 'berry', 'rose', 'paper'),
  denim: ramp('ink', 'navy', 'denim', 'sky'),
  gold: ramp('soil', 'ochre', 'gold', 'spark'),
  mist: ramp('dusk', 'lilac', 'haze', 'paper'),
  skin: ramp('bark', 'skinShade', 'skin', 'paper'),
} as const;
