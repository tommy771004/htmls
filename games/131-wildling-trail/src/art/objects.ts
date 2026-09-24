// 地圖物件與背包道具：16×16、透明底、與怪獸同樣的一像素加深色描邊。

import { C, R } from './palette';
import { Canvas } from './raster';
import { Gfx } from './gfx';

type Obj = () => Canvas;
const make = (draw: (g: Gfx) => void): Canvas => {
  const c = new Canvas(16, 16);
  draw(new Gfx(c));
  return c;
};

// ---------------------------------------------------------------- 地圖物件
/** 告示牌：木板＋兩行刻字，插在木樁上。 */
const sign: Obj = () =>
  make((g) => {
    g.part(g.mask().rect(7, 8, 2, 7), R.bark, { shade: 0, light: 0 });
    g.c.set(8, 9, C.bark).set(8, 10, C.bark).set(8, 11, C.bark).set(8, 12, C.bark).set(8, 13, C.bark);
    g.part(g.mask().rect(2, 2, 12, 7), R.sand, { shade: 1, light: 1 });
    g.c.rect(2, 8, 12, 1, C.wood);
    for (const [x, y, w] of [[4, 4, 3], [8, 4, 4], [4, 6, 5], [10, 6, 2]] as const) g.c.rect(x, y, w, 1, C.bark);
    g.c.set(3, 3, C.straw).set(4, 3, C.straw);
  });

/** 收納石：立起的青灰石碑，中央嵌著發光的水晶，刻紋也透著光。 */
const terminal: Obj = () =>
  make((g) => {
    g.part(g.mask().rect(2, 12, 12, 3), R.stone, { shade: 1, light: 1 });
    const slab = g.poly(4, 12, 4.5, 4, 6, 1.5, 10, 1.5, 11.5, 4, 12, 12);
    g.part(slab, R.stone, { shade: 2, light: 1, sph: [8, 6, 5, 8] });
    // 水晶
    g.part(g.poly(8, 3, 10.5, 6, 8, 9.5, 5.5, 6), R.tide, { shade: 1, light: 1, outline: true });
    g.c.set(7, 5, C.paper).set(8, 4, C.paper).set(7, 6, C.foam);
    // 發光的刻紋
    g.c.rect(6, 10, 4, 1, C.foam).set(5, 11, C.tide).set(10, 11, C.tide);
    g.c.set(2, 3, C.foam).set(13, 6, C.foam).set(1, 8, C.tide).set(14, 2, C.tide);
  });

/** 地上的道具：束口的莓紅小布袋，口上露出一顆晶石，旁邊閃著光。 */
const itemball: Obj = () =>
  make((g) => {
    g.part(g.ell(8, 11.5, 5, 3.8), R.berry, { shade: 1, light: 1, sph: [8, 11, 5, 4] });
    g.part(g.poly(6, 7, 10, 7, 11, 9, 5, 9), R.berry, { shade: 0, light: 1 });
    g.c.rect(5, 8, 6, 1, C.gold).set(10, 9, C.gold).set(11, 10, C.ochre);
    g.part(g.poly(8, 3, 10, 5.5, 8, 7.5, 6, 5.5), R.tide, { shade: 1, light: 1 });
    g.c.set(7, 4, C.paper);
    g.c.set(13, 3, C.spark).set(12, 4, C.spark).set(14, 4, C.spark).set(13, 5, C.spark).set(13, 4, C.paper);
    g.c.set(3, 6, C.spark);
  });

// ---------------------------------------------------------------- 道具
/** 晶籠：金色籠頂與底座，中間是幾根水晶柱圍成的籠。 */
function crystalCage(g: Gfx, crystal: typeof R.tide, frame: typeof R.gold, sparkle: boolean) {
  g.part(g.ell(8, 2, 1.6, 1.6).minus(g.ell(8, 2, 0.6, 0.6)), frame, { shade: 0, light: 0 });
  const body = g.poly(4, 5, 12, 5, 13, 8.5, 12, 12, 4, 12, 3, 8.5);
  g.part(body, crystal, { shade: 2, light: 1 });
  // 籠條
  for (const x of [5, 8, 11]) for (let y = 5; y < 12; y++) g.c.set(x, y, crystal.d);
  g.c.set(5, 6, crystal.l).set(8, 6, crystal.l);
  // 中間的光
  g.c.set(6, 7, C.paper).set(6, 8, crystal.l).set(9, 9, crystal.l);
  g.part(g.mask().rect(4, 3, 8, 2), frame, { shade: 1, light: 1 });
  g.part(g.mask().rect(3, 12, 10, 2), frame, { shade: 1, light: 1 });
  if (sparkle) {
    g.c.set(14, 1, C.spark).set(13, 2, C.spark).set(15, 2, C.spark).set(14, 3, C.spark).set(14, 2, C.paper);
    g.c.set(1, 14, C.spark);
  }
}

const cage: Obj = () => make((g) => crystalCage(g, R.tide, R.gold, false));
const fineCage: Obj = () => make((g) => crystalCage(g, R.mist, R.pale, true));

/** 莓果露：圓肚玻璃瓶，裝著莓紅色的露。 */
const berry: Obj = () =>
  make((g) => {
    const bulb = g.ell(8, 10.5, 5, 4.6).or(g.mask().rect(6, 4, 4, 3));
    g.part(bulb, R.pale, { shade: 1, light: 0 });
    g.fill(g.ell(8, 10.5, 5, 4.6).and(g.mask().rect(0, 9, 16, 7)), C.berry);
    g.fill(g.ell(8, 10.5, 5, 4.6).and(g.mask().rect(0, 9, 16, 1)), C.rose);
    g.c.set(11, 12, C.wine).set(10, 13, C.wine).set(11, 11, C.wine);
    g.c.set(5, 8, C.paper).set(5, 9, C.paper);
    g.part(g.mask().rect(6, 2, 4, 2), R.bark, { shade: 0, light: 1 });
  });

/** 濃莓果露：高瓶、深色的露，貼著一張畫了莓果的標籤。 */
const bigBerry: Obj = () =>
  make((g) => {
    const bottle = g.poly(6, 3, 10, 3, 10, 5, 12.5, 7, 12.5, 14, 3.5, 14, 3.5, 7, 6, 5);
    g.part(bottle, R.pale, { shade: 1, light: 0 });
    g.fill(g.poly(4, 8, 12, 8, 12, 14, 4, 14).and(bottle), C.wine);
    g.c.rect(4, 8, 8, 1, C.berry);
    g.c.rect(5, 9, 6, 4, C.paper);
    g.c.set(7, 10, C.berry).set(8, 11, C.berry).set(9, 10, C.berry).set(8, 10, C.moss).set(10, 12, C.mist);
    g.c.set(4, 6, C.paper).set(4, 7, C.paper);
    g.part(g.mask().rect(6, 1, 4, 2), R.bark, { shade: 0, light: 1 });
  });

/** 萬用草：三片葉子的藥草，莖上綁著草繩。 */
const herb: Obj = () =>
  make((g) => {
    g.part(g.path([8, 14, 8, 9, 7, 5], 0.7), R.leaf, { shade: 0, light: 0 });
    g.part(g.poly(7, 5, 5, 1, 9, 1.5), R.leaf, { shade: 1, light: 1 });
    g.part(g.poly(8, 8, 2, 6, 3, 10), R.moss, { shade: 1, light: 1 });
    g.part(g.poly(8, 9, 14, 6, 13, 10.5), R.moss, { shade: 1, light: 1 });
    g.c.set(6, 3, C.moss).set(5, 8, C.forest).set(4, 8, C.forest).set(11, 8, C.forest).set(12, 8, C.forest);
    g.c.rect(7, 11, 3, 1, C.straw).set(10, 12, C.straw).set(6, 12, C.sand);
    g.c.set(3, 3, C.lime).set(13, 3, C.lime);
  });

export const OBJECT_DRAW: Record<string, Obj> = {
  'obj.sign': sign,
  'obj.terminal': terminal,
  'obj.itemball': itemball,
  'item.cage': cage,
  'item.fineCage': fineCage,
  'item.berry': berry,
  'item.bigBerry': bigBerry,
  'item.herb': herb,
};
