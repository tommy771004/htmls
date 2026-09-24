// 八種原創怪獸的正面（敵方視角，朝左）與背面（我方視角，越過肩膀朝右上）。
// 每隻都以 48×48 的設計座標描述，icon 用同一段程式以 0.5 倍重畫。

import { C, R } from './palette';
import { Canvas } from './raster';
import { Gfx } from './gfx';

export type MonView = 'front' | 'back';
type Draw = (g: Gfx, view: MonView) => void;

// ---------------------------------------------------------------- 燭尾
/** 小型火焰四足獸：大耳朵、奶油色肚子，尾巴末端像燭台一樣頂著一簇火。 */
const wickling: Draw = (g, v) => {
  const flameTip = (x: number, y: number) => {
    g.part(g.ell(x, y + 5, 2.6, 1.6), R.sand, { shade: 1 });
    const f = g.ell(x, y, 3.6, 4.2).or(g.poly(x - 3, y - 1, x + 1.5, y - 10, x + 3.4, y - 1));
    g.part(f, R.fire, { shade: 1, light: 0, outline: true });
    g.fill(g.ell(x + 0.2, y + 0.8, 1.7, 2.4), C.spark);
  };
  if (v === 'front') {
    // 尾巴：從臀部往後上方捲起
    g.part(g.path([33, 33, 39, 28, 41, 21, 39, 15], 2.4, 1.6), R.flame, { shade: 1 });
    flameTip(39, 9);
    // 後腿
    g.part(g.cap(34, 36, 35.5, 43, 2.5, 2.1), R.flame, { shade: 1 });
    g.part(g.cap(29, 38, 29.5, 43.5, 2.5, 2.1), R.flame, { shade: 1 });
    // 身體
    g.ball(27, 33, 10.5, 7.5, R.flame);
    g.part(g.ell(24, 37.5, 7, 3.2), R.sand, { outline: false, shade: 1, light: 0, clip: g.ell(27, 33, 10.5, 7.5) });
    // 前腿
    g.part(g.cap(19, 37, 18, 43.5, 2.5, 2.1), R.flame, { shade: 1 });
    g.part(g.cap(24, 38, 24, 44, 2.5, 2.1), R.flame, { shade: 1 });
    g.px(17, 44, C.ember).px(19, 44, C.ember).px(23, 44.5, C.ember).px(25, 44.5, C.ember);
    // 耳朵（在頭後）
    g.part(g.poly(8, 21, 4, 8, 14, 16), R.flame, { shade: 1 });
    g.part(g.poly(18, 16, 25, 6, 24.5, 20), R.flame, { shade: 1 });
    g.fill(g.poly(7.5, 18, 5.8, 11, 11, 16), C.ember).fill(g.poly(20, 16.5, 23.5, 10, 23.2, 18), C.ember);
    // 頭
    g.ball(15.5, 24.5, 9.5, 8.5, R.flame, { spec: { x: 12, y: 19 } });
    // 胸前奶油色的毛
    g.part(g.poly(14, 30, 22, 31, 20, 36, 18, 34, 16, 37), R.bud, { outline: false, shade: 0, light: 0 });
    // 吻部、鼻子與嘴
    g.part(g.ell(10.5, 28, 4.6, 2.8), R.bud, { outline: false, shade: 1, light: 0 });
    g.fill(g.ell(7.2, 26.6, 1.3, 0.9), C.emberDark);
    g.px(9, 29.5, C.ember).px(10, 30, C.ember).px(11, 29.5, C.ember);
    g.fill(g.ell(19.5, 27.5, 1.4, 0.8), C.glow);
    g.eye(10.5, 23.5, 1.7, 2.4);
    g.eye(18.5, 23.5, 1.5, 2.3);
    // 額頭的火紋
    g.fill(g.poly(14, 19, 15.5, 15.5, 17, 19, 15.5, 20.5), C.glow);
  } else {
    // 背影：身體在前（左下），頭在右上，尾巴高高翹起靠近鏡頭
    g.part(g.cap(15, 40, 13, 46, 3.4, 3.2), R.flame, { shade: 1 });
    g.part(g.cap(30, 38, 31, 45.5, 3.2, 3), R.flame, { shade: 1 });
    g.ball(22, 36, 14, 9.5, R.flame);
    g.part(g.cap(22, 40, 23, 46.5, 3.4, 3.2), R.flame, { shade: 1 });
    // 背脊的火紋
    g.fill(g.poly(14, 31, 20, 29, 26, 31, 20, 33), C.glow);
    // 耳朵
    g.part(g.poly(26, 22, 25, 7, 33, 17), R.flame, { shade: 1 });
    g.part(g.poly(36, 17, 43, 7, 42, 24), R.flame, { shade: 1 });
    g.fill(g.poly(27, 19, 26.5, 11, 31, 17), C.ember).fill(g.poly(38, 18, 41.5, 11.5, 41, 21), C.ember);
    // 後腦勺（看不到臉）
    g.ball(34, 25, 9.5, 8.5, R.flame, { spec: { x: 30, y: 20 } });
    g.fill(g.ell(41.8, 27, 1.6, 2.2), C.ember);
    // 尾巴在最前方
    g.part(g.path([9, 38, 5, 32, 6, 24, 9, 19], 2.8, 1.8), R.flame, { shade: 1 });
    flameTip(9, 13);
  }
};

// ---------------------------------------------------------------- 泡鰭
/** 圓滾滾的水棲蠑螈：寬臉、三對羽狀鰓、尾鰭。 */
const bubblet: Draw = (g, v) => {
  const gill = (x0: number, y0: number, x1: number, y1: number) => {
    const m = g.cap(x0, y0, x1, y1, 1.3, 1.6);
    // 羽枝：沿著鰓兩側的小突起
    for (let t = 0.35; t <= 1.01; t += 0.22) {
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      const nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny);
      m.or(g.ell(x + (nx / l) * 1.8, y + (ny / l) * 1.8, 1.1, 1.1)).or(g.ell(x - (nx / l) * 1.8, y - (ny / l) * 1.8, 1.1, 1.1));
    }
    g.part(m, R.pink, { shade: 1, light: 0 });
  };
  if (v === 'front') {
    // 尾巴（身後往右上翹）
    const tail = g.path([30, 36, 38, 34, 43, 28, 45, 22], 5, 2).or(g.poly(34, 30, 44, 17, 46, 26, 40, 36));
    g.part(tail, R.tide, { shade: 1 });
    g.fill(g.path([33, 34, 39, 31, 43, 25], 0.8), C.foam);
    // 右側（遠側）三條鰓
    gill(31, 17, 38, 9);
    gill(33, 21, 42, 17);
    gill(33, 26, 42, 26);
    // 身體＋頭（一體的圓）
    g.ball(22, 30, 13, 11.5, R.tide, { spec: { x: 15, y: 22, r: 1.2 } });
    // 肚子
    g.part(g.ell(21, 36.5, 8.5, 4.5), R.pale, { outline: false, light: 0, shade: 1, clip: g.ell(22, 30, 13, 11.5) });
    // 左側（近側）三條鰓
    gill(13, 20, 5, 11);
    gill(11, 24, 2.5, 20);
    gill(11, 28, 2.5, 29);
    // 小手與腳
    g.part(g.cap(13, 38, 10, 43.5, 2.3, 2), R.tide, { shade: 1 });
    g.part(g.cap(29, 38, 31, 43.5, 2.3, 2), R.tide, { shade: 1 });
    // 臉：分得很開的小眼睛與寬寬的笑
    g.eye(15, 27, 1.8, 2);
    g.eye(28, 27, 1.8, 2);
    g.line(18, 32, 25, 32, C.deepSea).px(17, 31, C.deepSea).px(25.5, 31, C.deepSea);
    g.fill(g.ell(13, 31, 1.6, 1), C.rose).fill(g.ell(30, 31, 1.6, 1), C.rose);
    // 頭上的小水滴紋
    g.px(20, 21, C.foam).px(23, 20, C.foam).px(26, 21, C.foam);
    // 吹出的泡泡圈
    const ring = g.ell(22, 9, 4.2, 4.2).minus(g.ell(22, 9, 2.6, 2.6));
    g.part(ring, R.tide, { outline: 'outer', shade: 0, light: 0 });
    g.px(20.5, 7, C.paper).fill(g.ell(27.5, 14, 1.2, 1.2), C.foam);
  } else {
    // 背影：大大的圓背，尾巴往右下捲出來
    const tail = g.path([30, 40, 38, 43, 44, 40, 46, 33], 5, 2).or(g.poly(40, 38, 47, 28, 47, 40));
    g.part(tail, R.tide, { shade: 1 });
    g.line(34, 42, 44, 38, C.foam);
    gill(35, 13, 40, 4);
    gill(39, 17, 46, 11);
    gill(14, 17, 8, 7);
    gill(11, 21, 3, 15);
    g.ball(24, 29, 16, 13.5, R.tide, { spec: { x: 17, y: 20, r: 1.4 } });
    // 背脊：一排淡色鱗點
    for (let y = 19; y <= 38; y += 4) g.fill(g.ell(24.5, y, 1.5, 1.2), C.foam);
    // 背上的斑點
    for (const [x, y] of [[15, 25], [33, 23], [17, 34], [32, 35], [12, 30], [36, 29]] as const) g.fill(g.ell(x, y, 1.4, 1.2), C.sea);
    gill(39, 22, 47, 22);
    gill(10, 25, 1.5, 23);
    g.part(g.cap(13, 39, 11, 45.5, 2.6, 2.4), R.tide, { shade: 1 });
    g.part(g.cap(27, 41, 27, 46.5, 2.6, 2.4), R.tide, { shade: 1 });
  }
};

// ---------------------------------------------------------------- 苔團
/** 矮胖的苔蘚團：凹凸的苔邊、瞇瞇眼、背上一株嫩芽。 */
const mossum: Draw = (g, v) => {
  const body = (cx: number, cy: number, rx: number, ry: number) => {
    const m = g.ell(cx, cy, rx, ry);
    // 凹凸的苔邊
    for (let a = Math.PI * 1.05; a <= Math.PI * 1.95; a += 0.32)
      m.or(g.ell(cx + Math.cos(a) * rx * 0.9, cy + Math.sin(a) * ry * 0.92, 3.2, 3));
    return m;
  };
  const sprout = (x: number, y: number, flip = 1) => {
    g.part(g.path([x, y, x - 0.5 * flip, y - 5, x + 1 * flip, y - 9], 1, 0.8), R.leaf, { shade: 0, light: 0 });
    g.part(g.poly(x + 1 * flip, y - 9, x + 9 * flip, y - 15, x + 12 * flip, y - 10, x + 6 * flip, y - 7), R.leaf, { shade: 1 });
    g.part(g.poly(x + 0.5 * flip, y - 9, x - 7 * flip, y - 14, x - 8 * flip, y - 9, x - 3 * flip, y - 7.5), R.leaf, { shade: 1 });
    g.line(x + 2 * flip, y - 9, x + 9 * flip, y - 12, C.moss);
  };
  const tufts = (pts: readonly (readonly [number, number])[]) => {
    for (const [x, y] of pts) {
      g.px(x, y, C.forest).px(x + 1, y, C.forest).px(x + 0.5, y - 1, C.sprout);
    }
  };
  if (v === 'front') {
    sprout(31, 18);
    // 短腳
    g.part(g.ell(15, 42, 4.5, 3), R.bark, { shade: 1 });
    g.part(g.ell(31, 42, 4.5, 3), R.bark, { shade: 1 });
    const m = body(23, 30, 17, 12.5);
    g.part(m, R.moss, { shade: 3, light: 1, sph: [21, 26, 17, 13] });
    tufts([[10, 26], [34, 24], [20, 20], [38, 32], [28, 37], [12, 35]]);
    // 臉：石色的臉盤
    g.part(g.ell(20, 31, 9, 6), R.sand, { outline: false, shade: 1, light: 0 });
    // 瞇起來的眼睛（^ ^）
    g.line(14, 30, 15.5, 28.5, C.soil).line(15.5, 28.5, 17, 30, C.soil);
    g.line(23, 30, 24.5, 28.5, C.soil).line(24.5, 28.5, 26, 30, C.soil);
    g.px(19.5, 33, C.soil).px(20.5, 33, C.soil);
    g.fill(g.ell(13, 33, 1.5, 1), C.rose).fill(g.ell(27, 33, 1.5, 1), C.rose);
    // 小手
    g.part(g.ell(7.5, 35, 2.6, 3.2), R.moss, { shade: 1 });
    g.part(g.ell(39, 36, 2.6, 3.2), R.moss, { shade: 1 });
  } else {
    // 背影：大苔丘，嫩芽在正中央
    g.part(g.ell(12, 44, 5, 3), R.bark, { shade: 1 });
    g.part(g.ell(34, 44, 5, 3), R.bark, { shade: 1 });
    const m = body(24, 31, 20, 14.5);
    g.part(m, R.moss, { shade: 3, light: 1, sph: [22, 27, 20, 15] });
    tufts([[11, 27], [18, 22], [30, 21], [37, 28], [15, 36], [26, 39], [34, 35], [22, 30]]);
    // 苔上的小石頭
    g.part(g.ell(33, 30, 2.6, 2), R.stone, { shade: 1 });
    sprout(24, 20, -1);
    // 小尾巴
    g.part(g.ell(24, 43, 3, 2.2), R.leaf, { shade: 1 });
  }
};

// ---------------------------------------------------------------- 芽蟲
/** 一節一節的幼蟲：淡黃的頭、翠綠的體節，頭頂兩片圓圓的子葉。 */
const sprigling: Draw = (g, v) => {
  const cotyledons = (x: number, y: number, tilt = 0) => {
    g.part(g.cap(x, y, x + tilt, y - 5, 0.9), R.leaf, { shade: 0, light: 0 });
    const l = g.ell(x - 5.5 + tilt, y - 7.5, 5.2, 3.2), r = g.ell(x + 5.5 + tilt, y - 7.5, 5.2, 3.2);
    g.part(l, R.leaf, { shade: 1, light: 1 });
    g.part(r, R.leaf, { shade: 1, light: 1 });
    g.line(x - 9 + tilt, y - 7.5, x - 1.5 + tilt, y - 7.5, C.moss).line(x + 1.5 + tilt, y - 7.5, x + 9 + tilt, y - 7.5, C.moss);
  };
  const seg = (x: number, y: number, r: number, legs = true) => {
    if (legs) g.part(g.cap(x - r * 0.3, y + r * 0.5, x - r * 0.45, y + r + 1.6, 1.3), R.bark, { shade: 0, light: 0 });
    g.ball(x, y, r, r * 0.92, R.leaf);
    g.px(x - r * 0.35, y - r * 0.5, C.lime);
  };
  if (v === 'front') {
    // 尾端 → 頭（由後往前畫）
    seg(43, 38, 3.2);
    seg(38.5, 38.5, 4);
    seg(33, 38, 4.8);
    seg(26.5, 36.5, 5.4);
    seg(19.5, 33.5, 5.8);
    // 頭：抬起來、微微前傾
    cotyledons(14, 15, -0.5);
    g.ball(14, 23, 8, 7.5, R.bud, { spec: { x: 11, y: 18 } });
    g.eye(10.5, 23, 1.5, 2.1);
    g.eye(17.5, 23, 1.5, 2.1);
    g.line(12.5, 27.5, 15, 27.5, C.bark);
    g.fill(g.ell(8.5, 26, 1.2, 0.8), C.rose).fill(g.ell(19.5, 26, 1.2, 0.8), C.rose);
    // 尾巴末端的小刺
    g.part(g.poly(45.5, 36, 48, 34.5, 46.5, 38.5), R.leaf, { shade: 0 });
  } else {
    // 背影：最靠近鏡頭的體節在左下，身體往右上蜿蜒，頭在最遠處
    cotyledons(35, 13, 1);
    g.ball(35, 20.5, 7, 6.5, R.bud, { spec: { x: 32, y: 16 } });
    seg(31, 26.5, 5.5);
    seg(24, 31.5, 6.5);
    seg(15.5, 36.5, 7.2);
    seg(7, 41.5, 5.6, false);
    // 背上的節紋
    g.fill(g.ell(24, 29, 1.4, 1), C.lime).fill(g.ell(15.5, 33.5, 1.5, 1.1), C.lime).fill(g.ell(31, 25, 1, 0.9), C.lime);
  }
};

// ---------------------------------------------------------------- 繭葉
/** 倒掛在細枝上的繭，被一片大葉子斜斜地捲住，只露出上半張睡臉。 */
const leafcoon: Draw = (g, v) => {
  // 樹枝與絲
  g.part(g.path([2, 7, 16, 5, 34, 6, 46, 4], 1.8, 1.3), R.bark, { shade: 1 });
  g.part(g.poly(38, 5, 42, 9, 46, 12, 41, 11), R.leaf, { shade: 1 });
  g.fill(g.mask().line(g.X(24), g.Y(7), g.X(24), g.Y(12)), C.paper);
  const cx = 24, cy = 29, rx = 10, ry = 16;
  const cocoon = g.ell(cx, cy, rx, ry).or(g.poly(cx - 3, cy - 13, cx, cy - 17.5, cx + 3, cy - 13));
  g.part(cocoon, R.sand, { sph: [cx, cy - 3, rx, ry], shade: 2 });
  // 絲的纏紋
  for (const y of [16, 19]) g.line(cx - 5, y, cx + 5, y + 1, C.straw);
  if (v === 'front') {
    // 半閉的睡眼＋小嘴
    g.line(17.5, 23, 21, 23, C.soil).line(26, 23, 29.5, 23, C.soil);
    g.px(17, 22, C.soil).px(30, 22, C.soil).px(19, 24, C.soil).px(28, 24, C.soil);
    g.px(23, 26.5, C.bark).px(24, 26.5, C.bark);
    g.fill(g.ell(16.5, 25.5, 1.3, 0.8), C.rose).fill(g.ell(31, 25.5, 1.3, 0.8), C.rose);
    // 葉子的背面在左側往後捲
    g.part(g.poly(13, 28, 16, 27, 17, 44, 13, 38), R.leaf, { shade: 1, light: 0 });
    // 大葉子：從左下斜斜往右上包住，葉尖翹出輪廓
    const leaf = g.poly(15, 31, 22, 30, 31, 27, 37, 21, 43, 13, 40, 25, 35, 35, 29, 42, 22, 46, 16, 43);
    g.part(leaf, R.moss, { shade: 2, light: 1 });
    // 主脈與側脈
    g.line(18, 43, 25, 38, C.forest).line(25, 38, 33, 30, C.forest).line(33, 30, 41, 16, C.forest);
    for (const [x, y] of [[22, 40], [27, 36], [31, 32], [35, 27]] as const) {
      g.line(x, y, x - 4, y - 4, C.forest).line(x + 1, y, x + 3, y + 4, C.forest);
    }
    g.line(16, 32, 22, 31, C.sprout).line(23, 31, 31, 28, C.sprout);
  } else {
    // 背面：葉子的背側（較淡、葉柄與粗葉脈），包住大半個繭
    const back = g.poly(11, 26, 20, 18, 34, 22, 37, 36, 27, 47, 15, 42).and(g.ell(cx, cy, rx + 2.5, ry + 1.5));
    g.part(back, R.leaf, { shade: 2, light: 1 });
    g.line(24, 20, 24, 45, C.moss);
    for (let y = 24; y <= 40; y += 5) g.line(24, y, 16, y - 3, C.moss).line(24, y + 1, 32, y - 2, C.moss);
    g.fill(g.poly(19, 44, 24, 48, 29, 44, 24, 46), C.sprout);
  }
};

// ---------------------------------------------------------------- 翠翅蛾
/** 寬翅的蛾：前翅上有金色眼紋，羽狀觸角，毛茸茸的身體。 */
const verdmoth: Draw = (g, v) => {
  const eyeSpot = (x: number, y: number, r: number) => {
    g.fill(g.ell(x, y, r, r * 0.9), C.gold);
    g.fill(g.ell(x, y, r * 0.66, r * 0.6), C.ink);
    g.fill(g.ell(x + r * 0.15, y + r * 0.1, r * 0.3, r * 0.3), C.forest);
    g.px(x - r * 0.3, y - r * 0.3, C.paper);
  };
  const antenna = (x0: number, y0: number, x1: number, y1: number, cx: number, cy: number) => {
    const m = g.path([x0, y0, cx, cy, x1, y1], 0.6);
    // 羽狀的側枝
    for (let t = 0.2; t <= 1; t += 0.2) {
      const x = cx + (x1 - cx) * t, y = cy + (y1 - cy) * t;
      m.or(g.mask().line(g.X(x), g.Y(y), g.X(x - 1.5), g.Y(y + 1.5))).or(g.mask().line(g.X(x), g.Y(y), g.X(x + 1.5), g.Y(y + 1.2)));
    }
    g.part(m, R.sand, { shade: 0, light: 0 });
  };
  /** 一片翅膀：外圈淡色翅緣，內側主色，帶左上光。 */
  const wing = (cx: number, cy: number, rx: number, ry: number, deg: number, outer: typeof R.moss, inner: typeof R.moss) => {
    g.part(g.ell(cx, cy, rx, ry, deg), outer, { shade: 1, light: 1 });
    g.part(g.ell(cx + 0.6, cy + 0.4, rx - 2.2, ry - 2, deg), inner, { outline: false, shade: 2, light: 0 });
  };
  if (v === 'front') {
    // 後翅（下方、較小）
    wing(13, 36, 10, 6, -30, R.leaf, R.moss);
    wing(35, 36, 10, 6, 30, R.leaf, R.moss);
    // 前翅：往左右上方大大展開
    wing(12, 20, 13, 8, 26, R.leaf, R.moss);
    wing(36, 20, 13, 8, -26, R.leaf, R.moss);
    g.line(6, 27, 19, 23, C.forest).line(42, 27, 29, 23, C.forest);
    eyeSpot(11, 18.5, 3.8);
    eyeSpot(37, 18.5, 3.8);
    g.fill(g.ell(10, 38.5, 1.8, 1.5), C.lime).fill(g.ell(38, 38.5, 1.8, 1.5), C.lime);
    antenna(21.5, 15, 13, 3, 16, 8);
    antenna(26.5, 15, 35, 3, 32, 8);
    // 身體（毛絨胸＋分節腹）
    g.part(g.ell(24, 36, 3.5, 7), R.sand, { shade: 1 });
    for (const y of [34, 37, 40]) g.line(22, y, 26, y, C.wood);
    g.ball(24, 25, 5.5, 5, R.pale);
    g.ball(24, 18.5, 4.5, 4, R.sand);
    g.eye(22, 18.5, 1.5, 1.8, C.forestDark, C.lime);
    g.eye(26.5, 18.5, 1.5, 1.8, C.forestDark, C.lime);
  } else {
    // 背影：雙翅向上揚起呈 V 字，看得到背上的毛與腹節
    wing(14, 37, 10, 6, -26, R.leaf, R.moss);
    wing(36, 37, 10, 6, 26, R.leaf, R.moss);
    wing(14, 17, 14, 8, 50, R.leaf, R.moss);
    wing(36, 17, 14, 8, -50, R.leaf, R.moss);
    // 翅背：條紋與小眼紋
    g.line(8, 6, 20, 26, C.forest).line(40, 6, 28, 26, C.forest);
    eyeSpot(10.5, 11, 2.6);
    eyeSpot(37.5, 11, 2.6);
    antenna(23, 13, 17, 2, 19, 7);
    antenna(27, 13, 33, 2, 31, 7);
    g.part(g.ell(25, 37, 4.2, 8), R.sand, { shade: 1 });
    for (const y of [33, 36, 39, 42]) g.line(22, y, 28, y, C.wood);
    g.ball(25, 25, 6, 5.5, R.pale);
    g.fill(g.ell(24, 23, 2, 1.5), C.paper);
    g.ball(25, 16, 4.5, 4, R.sand);
  }
};

// ---------------------------------------------------------------- 霧蝸
/** 蝸牛：淡青色的軟身、灰紫的螺旋殼，殼口飄出一縷霧。 */
const mistsnail: Draw = (g, v) => {
  const spiral = (cx: number, cy: number, r: number, turns: number, color: number, dir = 1) => {
    const m = g.mask();
    let px = cx + r, py = cy;
    for (let a = 0; a <= Math.PI * 2 * turns; a += 0.12) {
      const rr = r * (1 - a / (Math.PI * 2 * turns + 0.6));
      const x = cx + Math.cos(a * dir) * rr, y = cy + Math.sin(a * dir) * rr;
      m.line(g.X(px), g.Y(py), g.X(x), g.Y(y));
      px = x; py = y;
    }
    g.fill(m, color);
  };
  const wisp = (pts: number[]) => {
    g.part(g.path(pts, 2.4, 1), R.mist, { outline: 'outer', shade: 0, light: 1 });
  };
  if (v === 'front') {
    wisp([30, 12, 27, 8, 30, 4, 35, 3, 37, 6]);
    // 軟身：沿地面的長腳＋抬起的頭
    const foot = g.path([44, 42, 30, 42, 16, 41], 2.5, 3.8).or(g.path([13, 42, 10, 34, 11, 27], 4, 4.5));
    g.part(foot, R.tide, { shade: 2 });
    // 眼柄
    g.part(g.path([9, 26, 6, 19, 5, 15], 1.1, 0.9), R.tide, { shade: 0 });
    g.part(g.path([14, 25, 15, 18, 17, 14], 1.1, 0.9), R.tide, { shade: 0 });
    g.ball(5, 14, 2.2, 2.2, R.tide).eye(5, 14, 1.2, 1.3);
    g.ball(17, 13, 2.2, 2.2, R.tide).eye(17, 13, 1.2, 1.3);
    // 短觸角
    g.part(g.cap(8, 32, 4, 34, 0.9), R.tide, { shade: 0 });
    // 殼
    g.ball(30, 27, 13, 12, R.mist, { spec: { x: 24, y: 20 } });
    spiral(30.5, 27.5, 11, 2.3, C.lilac);
    g.fill(g.ell(31, 28, 2, 1.8), C.dusk);
    // 殼口的霧
    g.part(g.ell(31, 15.5, 3.2, 2), R.mist, { outline: 'outer', shade: 0 });
    // 臉
    g.px(10, 30, C.deepSea).px(12, 30, C.deepSea).line(10, 32, 12, 32, C.sea);
    g.line(18, 40, 42, 40, C.foam);
  } else {
    wisp([20, 10, 23, 6, 20, 2, 15, 3]);
    // 背影：殼在正前方，軟身尾端在左下，眼柄在右上探出
    g.part(g.path([38, 32, 42, 22, 41, 16], 3.5, 3), R.tide, { shade: 1 });
    g.part(g.path([40, 18, 42, 10, 44, 7], 1.1, 0.9), R.tide, { shade: 0 });
    g.part(g.path([38, 18, 36, 10, 35, 6], 1.1, 0.9), R.tide, { shade: 0 });
    g.ball(44, 6, 2.2, 2.2, R.tide);
    g.ball(35, 5, 2.2, 2.2, R.tide);
    const foot = g.path([4, 44, 20, 44, 40, 40], 3, 4.5);
    g.part(foot, R.tide, { shade: 2 });
    g.ball(22, 28, 16, 15, R.mist, { spec: { x: 14, y: 19 } });
    spiral(23, 28, 14, 2.6, C.lilac, -1);
    g.fill(g.ell(23, 28, 2.2, 2), C.dusk);
    g.part(g.ell(21, 13.5, 3.5, 2.2), R.mist, { outline: 'outer', shade: 0 });
  }
};

// ---------------------------------------------------------------- 燼鴉
/** 黑鴉：張開的飛羽末端像燒過的紙一樣透著橘紅光。 */
const cinderow: Draw = (g, v) => {
  /**
   * 一整片翅膀：從肩膀 (sx, sy) 以扇形排出幾根飛羽（角度 deg、長度 len），
   * 合成一塊輪廓，再依離肩膀的距離把末端染成燼色。
   */
  const wing = (sx: number, sy: number, feathers: readonly (readonly [number, number])[], ember = true) => {
    const m = g.mask();
    const pts: number[] = [sx, sy];
    for (const [deg, len] of feathers) {
      const a = (deg * Math.PI) / 180, cx = Math.cos(a), cy = Math.sin(a);
      m.or(g.ell(sx + cx * len * 0.62, sy + cy * len * 0.62, len * 0.4, 2.3, deg));
      pts.push(sx + cx * len * 0.55, sy + cy * len * 0.55);
    }
    m.or(g.poly(...pts));
    g.part(m, R.crow, { shade: 1 });
    // 羽縫
    for (const [deg, len] of feathers.slice(1)) {
      const a = ((deg - 6) * Math.PI) / 180;
      g.line(sx + Math.cos(a) * len * 0.35, sy + Math.sin(a) * len * 0.35, sx + Math.cos(a) * len * 0.8, sy + Math.sin(a) * len * 0.8, C.ink);
    }
    if (!ember) return;
    for (const [deg, len] of feathers) {
      const a = (deg * Math.PI) / 180;
      const ex = sx + Math.cos(a) * len, ey = sy + Math.sin(a) * len;
      g.fill(m.clone().and(g.ell(ex, ey, len * 0.3, len * 0.3)), C.ember);
      g.fill(m.clone().and(g.ell(ex, ey, len * 0.2, len * 0.2)), C.flame);
      g.fill(m.clone().and(g.ell(ex, ey, len * 0.1, len * 0.1)), C.glow);
    }
  };
  if (v === 'front') {
    // 遠側翅膀（往右上揚起）
    wing(28, 27, [[-68, 25], [-50, 23], [-33, 20], [-16, 16]]);
    // 尾羽
    wing(30, 36, [[18, 15], [30, 14], [42, 12]], false);
    // 腳
    g.line(20, 39, 19, 45, C.stone).line(24, 39, 25, 45, C.stone);
    g.line(17, 45, 21, 45, C.stone).line(23, 45, 27, 45, C.stone);
    // 身體
    g.ball(23, 31, 10, 9, R.crow, { spec: { x: 18, y: 25 } });
    g.part(g.ell(19, 35, 5, 4), R.stone, { outline: false, shade: 1, light: 0 });
    // 近側翅膀（收在身側，飛羽往後下方）
    wing(24, 29, [[4, 20], [14, 18], [24, 15]]);
    // 頭與喙
    g.ball(14, 19, 7, 6.5, R.crow, { spec: { x: 11, y: 15 } });
    g.part(g.poly(8, 17, 1, 21, 8, 22), R.stone, { shade: 1 });
    g.line(2, 21, 8, 20.5, C.slate);
    // 燃燒般的眼睛＋頭頂羽冠
    g.fill(g.ell(12, 18, 1.7, 1.7), C.glow).px(12, 18, C.ember);
    g.part(g.poly(16, 12, 18, 7, 20, 13), R.crow, { shade: 0 });
    g.px(18.4, 8, C.flame);
  } else {
    // 背影：雙翅大大張開，頭轉向右側露出喙
    wing(20, 28, [[-118, 23], [-140, 23], [-162, 21], [176, 17]]);
    wing(28, 28, [[-62, 23], [-40, 23], [-18, 21], [4, 17]]);
    wing(24, 38, [[80, 10], [90, 11], [100, 10]], false);
    g.ball(24, 32, 10, 10, R.crow, { spec: { x: 19, y: 26 } });
    g.line(20, 30, 28, 30, C.slate).line(19, 34, 29, 34, C.slate).line(20, 38, 28, 38, C.slate);
    g.ball(26, 19, 7, 6.5, R.crow, { spec: { x: 23, y: 15 } });
    g.part(g.poly(32, 17, 39, 20, 32, 22), R.stone, { shade: 1 });
    g.fill(g.ell(31, 18, 1, 1), C.glow);
    g.part(g.poly(22, 13, 24, 8, 27, 13), R.crow, { shade: 0 });
  }
};

export const MONSTER_DRAW: Record<string, Draw> = {
  wickling, bubblet, mossum, sprigling, leafcoon, verdmoth, mistsnail, cinderow,
};

export function drawMonster(id: string, view: MonView | 'icon'): Canvas {
  const draw = MONSTER_DRAW[id];
  if (!draw) throw new Error(`no art for monster ${id}`);
  if (view === 'icon') {
    const c = new Canvas(24, 24);
    draw(new Gfx(c, 0.5), 'front');
    return c;
  }
  const c = new Canvas(48, 48);
  draw(new Gfx(c, 1), view);
  return c;
}
