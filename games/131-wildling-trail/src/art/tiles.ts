// 地圖格：16×16、不透明、不描邊。地面類可無縫平鋪；樹、岩石、柵欄、建築等
// 都畫在自己的格子內並自帶底色，所以任何一格單獨畫出來都完整。

import { C, R } from './palette';
import { Canvas, hash } from './raster';

type Tile = () => Canvas;

const T = 16;
const rows = (s: string): string[] => s.replace(/^\n/, '').split('\n').slice(0, T);

/** 迴繞設定像素（讓圖樣跨過邊界時從另一側接回來）。 */
const wrap = (c: Canvas, x: number, y: number, col: number) => c.set(((x % T) + T) % T, ((y % T) + T) % T, col);

// ---------------------------------------------------------------- 地面
const GRASS = rows(`
................
..l.............
.dld......l.....
..........dld...
................
.....l..........
....dld.........
..............l.
.............dld
..l.............
.dld............
.........l......
........dld.....
................
....l...........
...dld..........`);

function grass(): Canvas {
  const c = new Canvas(T, T).fill(C.moss);
  c.stamp(0, 0, GRASS, { l: C.sprout, d: C.forest });
  return c;
}

/** 高草叢的一叢（8×8），四叢錯開排滿一格。 */
const TUFT = rows(`
..l...l.
.lL..lL.
.mlm.mlm
dmmlmmld
dDmmdmmD
.dDmDmD.
..dDDd..
........`);

function tallgrass(): Canvas {
  const c = grass();
  const legend = { l: C.sprout, L: C.lime, m: C.moss, d: C.forest, D: C.forestDark };
  for (const [x, y] of [[0, 0], [8, 0], [4, 8], [-4, 8], [12, 8]] as const) c.stamp(x, y, TUFT, legend);
  return c;
}

function forestfloor(): Canvas {
  const c = new Canvas(T, T).fill(C.forest);
  // 苔斑與落葉
  const patch = rows(`
................
...mm...........
..mmmm......o...
...mm......oO...
................
.........mm.....
........mmmm....
.o.......mm.....
oO..............
................
.....s..........
................
............mm..
...m.......mmmm.
..mmm...o...mm..
...m...oO.......`);
  c.stamp(0, 0, patch, { m: C.moss, o: C.ochre, O: C.bark, s: C.sand });
  return c;
}

const DEEP_TUFT = rows(`
.l....l.
.ml..lm.
dmlmdmld
dmmdmmmd
Dddmdmdd
DdDdDdDD
.DDdDDD.
........`);

function deepgrass(): Canvas {
  const c = forestfloor();
  const legend = { l: C.sprout, m: C.moss, d: C.forest, D: C.forestDark };
  for (const [x, y] of [[0, 0], [8, 0], [4, 8], [-4, 8], [12, 8]] as const) c.stamp(x, y, DEEP_TUFT, legend);
  return c;
}

function path(): Canvas {
  const c = new Canvas(T, T).fill(C.sand);
  const dirt = rows(`
................
.....w..........
....wW.......s..
............ss..
..s.............
.......w........
......wW........
...............w
.s............wW
................
..........s.....
....w...........
...wW...........
.........s..w...
...........wW...
................`);
  c.stamp(0, 0, dirt, { w: C.wood, W: C.bark, s: C.straw });
  return c;
}

function flagstone(): Canvas {
  const c = new Canvas(T, T).fill(C.ash);
  // 兩列錯開的石板，灰縫在右下（光從左上來）
  const slabs: [number, number, number, number][] = [[0, 0, 8, 8], [8, 0, 8, 8], [-4, 8, 8, 8], [4, 8, 8, 8], [12, 8, 8, 8]];
  for (const [x, y, w, h] of slabs) {
    for (let i = 0; i < w; i++) {
      wrap(c, x + i, y + h - 1, C.stone);
      wrap(c, x + i, y, C.mist);
    }
    for (let j = 0; j < h; j++) {
      wrap(c, x + w - 1, y + j, C.stone);
      wrap(c, x, y + j, C.mist);
    }
    wrap(c, x + w - 1, y, C.ash);
    wrap(c, x, y + h - 1, C.ash);
  }
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(hash(i, 3, 17) * 16), y = Math.floor(hash(i, 5, 17) * 16);
    if (c.get(x, y) === C.ash) c.set(x, y, hash(i, 9, 17) < 0.5 ? C.stone : C.mist);
  }
  return c;
}

// ---------------------------------------------------------------- 水與橋
function water(phase: number): Canvas {
  const c = new Canvas(T, T).fill(C.sea);
  const a = rows(`
................
..ff............
....fff.........
..........tt....
................
.........ff.....
...........fff..
..tt............
................
.ff.............
...fff.......tt.
................
..........ff....
............fff.
.....tt.........
................`);
  const b = rows(`
................
................
...ff...........
.....fff...tt...
................
................
..........ff....
............fff.
...tt...........
................
..ff............
....fff.......tt
................
................
...........ff...
.....tt......fff`);
  c.stamp(0, 0, phase === 0 ? a : b, { f: C.foam, t: C.tide });
  return c;
}

function bridge(): Canvas {
  const c = new Canvas(T, T).fill(C.wood);
  for (let y = 0; y < T; y += 4) {
    for (let x = 2; x < 14; x++) {
      c.set(x, y, C.sand);
      c.set(x, y + 3, C.bark);
    }
    c.set(4 + (y % 8), y + 1, C.bark).set(10 - (y % 8) / 2, y + 2, C.sand);
  }
  // 兩側扶手
  for (let y = 0; y < T; y++) {
    c.set(0, y, C.soil).set(1, y, C.bark).set(14, y, C.bark).set(15, y, C.soil);
    if (y % 8 === 3) c.set(1, y, C.sand).set(14, y, C.sand);
  }
  return c;
}

// ---------------------------------------------------------------- 植物與石頭
function tree(): Canvas {
  const c = grass();
  // 地上的影子
  c.paint(c.mask().ellipse(9, 14.2, 6.5, 2), C.forest);
  // 樹幹
  c.rect(7, 11, 2, 4, C.bark).set(7, 11, C.wood).set(7, 12, C.wood).set(8, 14, C.soil);
  // 樹冠：三團重疊的球
  const crown = c.mask().ellipse(8, 7, 7.5, 6.5).or(c.mask().ellipse(4.5, 9, 4, 3.5)).or(c.mask().ellipse(11.5, 9, 4, 3.5));
  c.part(crown, R.moss, { outline: false, shade: 2, light: 1, sphere: { cx: 8, cy: 6.5, rx: 8, ry: 7 } });
  c.stamp(0, 0, rows(`
................
................
.....ll.........
....llll.d......
...ll.l...d.....
...l...d........
..........dd....
.......d........
....d.......d...
..........d.....`), { l: C.sprout, d: C.forest });
  return c;
}

function pine(): Canvas {
  const c = forestfloor();
  c.paint(c.mask().ellipse(9, 14.5, 6, 1.8), C.forestDark);
  c.rect(7, 12, 2, 4, C.bark).set(7, 12, C.wood);
  const tiers: [number, number, number][] = [[1, 5.5, 5], [5, 7, 9], [9, 7.5, 13]];
  for (const [top, half, bottom] of tiers) {
    const m = c.mask().poly([8, top - 1, 8 + half, bottom, 8 - half, bottom]);
    c.paint(m, C.moss);
    // 左側受光、右半邊較暗
    for (let y = top; y <= bottom; y++)
      for (let x = 0; x < T; x++) {
        if (!m.has(x, y)) continue;
        if (!m.has(x - 1, y) || (x < 7 && !m.has(x - 2, y))) c.set(x, y, C.sprout);
        else if (x >= 9) c.set(x, y, !m.has(x + 1, y) || !m.has(x, y + 1) ? C.forestDark : C.forest);
      }
    // 每層底緣的鋸齒
    for (let x = Math.ceil(8 - half); x <= 8 + half; x += 2) c.set(x, bottom, C.forestDark);
  }
  c.set(8, 0, C.moss);
  return c;
}

function rock(): Canvas {
  const c = grass();
  c.paint(c.mask().ellipse(9, 13, 7, 2.5), C.forest);
  const m = c.mask().ellipse(8, 9, 6.5, 5).or(c.mask().ellipse(5, 10.5, 4, 3.5)).or(c.mask().ellipse(11, 7.5, 4, 3.5));
  c.part(m, R.stone, { outline: false, shade: 2, light: 1, sphere: { cx: 8, cy: 8, rx: 7, ry: 6 }, spec: { x: 6, y: 5 } });
  c.set(9, 9, C.slate).set(10, 10, C.slate).set(10, 11, C.slate).set(4, 9, C.slate);
  c.set(12, 6, C.moss).set(13, 7, C.moss).set(11, 6, C.sprout);
  return c;
}

function flowers(): Canvas {
  const c = grass();
  const bloom = (x: number, y: number, petal: number, core: number) => {
    c.set(x, y - 1, petal).set(x - 1, y, petal).set(x + 1, y, petal).set(x, y + 1, petal).set(x, y, core);
    c.set(x + 1, y + 2, C.forest).set(x + 1, y + 1, C.forest);
  };
  bloom(4, 3, C.rose, C.gold);
  bloom(11, 5, C.paper, C.gold);
  bloom(6, 10, C.spark, C.flame);
  bloom(13, 12, C.rose, C.gold);
  bloom(2, 13, C.paper, C.gold);
  c.set(9, 13, C.sprout).set(8, 2, C.sprout);
  return c;
}

function fence(): Canvas {
  const c = grass();
  // 兩條橫桿貫穿整格，中央一根柱子
  for (let x = 0; x < T; x++) {
    c.set(x, 5, C.sand).set(x, 6, C.wood).set(x, 7, C.bark);
    c.set(x, 10, C.sand).set(x, 11, C.wood).set(x, 12, C.bark);
    c.set(x, 13, C.forest);
  }
  c.rect(6, 2, 4, 12, C.wood);
  for (let y = 2; y < 14; y++) c.set(6, y, C.sand).set(9, y, C.bark);
  c.set(7, 2, C.straw).set(8, 2, C.sand).set(6, 2, C.straw);
  c.rect(6, 14, 4, 1, C.forest);
  c.set(8, 6, C.soil).set(8, 11, C.soil);
  return c;
}

// ---------------------------------------------------------------- 建築
function roof(): Canvas {
  const c = new Canvas(T, T).fill(C.ember);
  // 魚鱗瓦：每 4 列一排，奇數排錯開半片
  for (let row = 0; row < 4; row++) {
    const off = row % 2 === 0 ? 0 : 4;
    for (let k = 0; k < 2; k++) {
      const x0 = off + k * 8;
      const y0 = row * 4;
      for (let i = 0; i < 8; i++) {
        const x = x0 + i;
        const edge = i === 0 || i === 7;
        wrap(c, x, y0 + 3, edge ? C.emberDark : C.emberDark);
        wrap(c, x, y0 + 2, edge ? C.emberDark : i < 3 ? C.flame : C.ember);
        wrap(c, x, y0 + 1, edge ? C.ember : i < 4 ? C.flame : C.ember);
        wrap(c, x, y0, i === 1 || i === 2 ? C.glow : C.flame);
      }
    }
  }
  return c;
}

function wallBase(): Canvas {
  const c = new Canvas(T, T).fill(C.straw);
  // 屋簷的陰影、上下木樑、底部石基
  for (let x = 0; x < T; x++) {
    c.set(x, 0, C.bark).set(x, 1, C.sand);
    c.set(x, 2, C.wood);
    c.set(x, 12, C.wood).set(x, 13, C.bark);
    c.set(x, 14, x % 5 === 4 ? C.slate : C.stone).set(x, 15, C.slate);
  }
  for (let y = 3; y < 12; y++) c.set(0, y, C.wood).set(15, y, C.bark);
  // 灰泥的細紋
  c.set(4, 5, C.sand).set(5, 5, C.sand).set(11, 8, C.sand).set(3, 10, C.sand).set(12, 4, C.paper).set(6, 9, C.paper);
  return c;
}

function wall(): Canvas {
  return wallBase();
}

function windowTile(): Canvas {
  const c = wallBase();
  c.rect(3, 3, 10, 8, C.wood);
  c.rect(4, 4, 8, 6, C.sky);
  c.rect(4, 4, 8, 1, C.paper);
  c.set(4, 5, C.paper).set(5, 5, C.skyPale).set(10, 8, C.denim).set(11, 8, C.denim).set(11, 7, C.denim);
  for (let y = 4; y < 10; y++) c.set(7, y, C.bark).set(8, y, C.wood);
  for (let x = 4; x < 12; x++) c.set(x, 7, C.bark);
  // 窗台與花箱
  c.rect(2, 11, 12, 1, C.bark);
  c.rect(3, 10, 10, 1, C.sand);
  c.set(4, 10, C.rose).set(6, 10, C.moss).set(9, 10, C.rose).set(11, 10, C.moss);
  return c;
}

function door(): Canvas {
  const c = wallBase();
  c.rect(3, 3, 10, 13, C.bark);
  c.rect(4, 4, 8, 12, C.wood);
  for (let y = 4; y < 16; y++) c.set(4, y, C.sand).set(7, y, C.bark).set(11, y, C.bark);
  c.rect(4, 4, 8, 1, C.sand);
  c.set(9, 10, C.gold).set(9, 11, C.ochre);
  c.rect(3, 15, 10, 1, C.stone);
  return c;
}

function counter(): Canvas {
  const c = grass();
  // 攤位後方的影子、檯面、前板
  c.rect(0, 3, 16, 1, C.forest);
  c.rect(0, 4, 16, 1, C.straw);
  c.rect(0, 5, 16, 3, C.sand);
  c.rect(0, 8, 16, 1, C.wood);
  c.rect(0, 9, 16, 5, C.wood);
  for (let x = 0; x < T; x += 4) for (let y = 9; y < 14; y++) c.set(x + 3, y, C.bark);
  c.rect(0, 14, 16, 1, C.bark);
  c.rect(0, 15, 16, 1, C.forest);
  // 檯面上的貨品：一籃莓果與一個小罐子
  c.stamp(2, 2, rows(`
.mm.......
mrrm....aa
.bb....aAa`), { m: C.berry, r: C.rose, b: C.bark, a: C.foam, A: C.tide });
  return c;
}

function pillar(): Canvas {
  const c = flagstone();
  c.paint(c.mask().ellipse(9.5, 14.5, 5.5, 1.8), C.stone);
  // 柱頭、柱身（有凹槽）、柱基
  c.rect(3, 1, 10, 2, C.mist).rect(3, 3, 10, 1, C.stone);
  c.rect(4, 4, 8, 9, C.ash);
  for (let y = 4; y < 13; y++) {
    c.set(4, y, C.mist).set(5, y, C.paper).set(7, y, C.stone).set(9, y, C.stone).set(10, y, C.stone).set(11, y, C.slate);
  }
  c.rect(3, 13, 10, 2, C.mist).rect(3, 14, 10, 1, C.stone);
  c.set(12, 13, C.stone).set(12, 1, C.ash).set(3, 1, C.paper);
  return c;
}

function stonewall(): Canvas {
  const c = new Canvas(T, T).fill(C.stone);
  const courses: [number, number[]][] = [[0, [0, 8]], [4, [4, 12]], [8, [0, 8]], [12, [4, 12]]];
  for (const [y, joints] of courses) {
    for (let x = 0; x < T; x++) {
      c.set(x, y, C.ash);
      c.set(x, y + 3, C.slate);
    }
    for (const jx of joints) for (let j = 0; j < 4; j++) {
      wrap(c, jx - 1, y + j, C.slate);
      wrap(c, jx, y + j, j === 3 ? C.slate : C.ash);
    }
  }
  for (let i = 0; i < 12; i++) {
    const x = Math.floor(hash(i, 1, 31) * 16), y = Math.floor(hash(i, 2, 31) * 16);
    if (c.get(x, y) === C.stone) c.set(x, y, hash(i, 3, 31) < 0.6 ? C.slate : C.ash);
  }
  c.set(3, 13, C.moss).set(4, 13, C.moss).set(4, 14, C.forest).set(11, 1, C.moss);
  return c;
}

export const TILE_DRAW: Record<string, Tile> = {
  'tile.grass': grass,
  'tile.tallgrass': tallgrass,
  'tile.path': path,
  'tile.flowers': flowers,
  'tile.tree': tree,
  'tile.water': () => water(0),
  'tile.water.b': () => water(1),
  'tile.fence': fence,
  'tile.rock': rock,
  'tile.roof': roof,
  'tile.wall': wall,
  'tile.window': windowTile,
  'tile.door': door,
  'tile.counter': counter,
  'tile.forestfloor': forestfloor,
  'tile.deepgrass': deepgrass,
  'tile.pine': pine,
  'tile.flagstone': flagstone,
  'tile.pillar': pillar,
  'tile.stonewall': stonewall,
  'tile.bridge': bridge,
};
