// 戰鬥背景：256×192、不透明。刻意壓低對比，讓上面的怪獸、血條與文字清楚可讀。
// 每張都有兩座地台：敵方在右上（約 x 150–240、y 70–95），我方在左下（約 x 10–110、y 140–170）。

import { C } from './palette';
import { Canvas, hash } from './raster';

export const BG_W = 256;
export const BG_H = 192;

type Bg = () => Canvas;

/** 兩色之間的棋盤格過渡帶。 */
function dither(c: Canvas, y: number, a: number, b: number, rows = 2) {
  for (let j = 0; j < rows; j++)
    for (let x = 0; x < c.w; x++) c.set(x, y + j, (x + j) % 2 === 0 ? a : b);
}

/** 由上到下的色帶，交界處以棋盤格過渡。 */
function bands(c: Canvas, stops: [number, number][], y1: number) {
  stops.forEach(([y, col], i) => {
    const end = i + 1 < stops.length ? stops[i + 1][0] : y1;
    c.rect(0, y, c.w, end - y, col);
    if (i > 0) dither(c, y, stops[i - 1][1], col);
  });
}

/** 平滑起伏的稜線（以幾個正弦疊加，完全決定性）。 */
function ridge(c: Canvas, base: number, amp: number, freq: number, phase: number, col: number, bottom: number, light?: number) {
  for (let x = 0; x < c.w; x++) {
    const h = base - amp * (0.6 * Math.sin(x * freq + phase) + 0.4 * Math.sin(x * freq * 2.3 + phase * 1.7));
    const top = Math.round(h);
    for (let y = top; y < bottom; y++) c.set(x, y, col);
    if (light !== undefined) c.set(x, top, light);
  }
}

function cloud(c: Canvas, x: number, y: number, w: number, top: number, shade: number) {
  const m = c.mask().ellipse(x, y, w, 3.5);
  m.or(c.mask().ellipse(x - w * 0.3, y - 2.5, w * 0.45, 3.5)).or(c.mask().ellipse(x + w * 0.2, y - 3.5, w * 0.4, 4));
  // 底部扁平
  m.and(c.mask().rect(0, 0, c.w, Math.round(y + 2)));
  for (let yy = 0; yy < c.h; yy++)
    for (let xx = 0; xx < c.w; xx++) {
      if (!m.has(xx, yy)) continue;
      c.set(xx, yy, m.has(xx, yy + 2) ? top : shade);
    }
}

/** 地台：上緣亮、下半圈暗，外圈一條柔和的邊。 */
function platform(c: Canvas, cx: number, cy: number, rx: number, ry: number, top: number, mid: number, rim: number, edge: number) {
  const outer = c.mask().ellipse(cx, cy + 2, rx + 1, ry + 1.5);
  c.paint(outer, edge);
  const disc = c.mask().ellipse(cx, cy, rx, ry);
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++) {
      if (!disc.has(x, y)) continue;
      const ny = (y + 0.5 - cy) / ry, nx = (x + 0.5 - cx) / rx;
      const lx = nx + 0.12, ly = ny + 0.3;
      let col = mid;
      if (!disc.has(x, y + 3)) col = rim;
      else if ((lx / 0.86) ** 2 + (ly / 0.68) ** 2 < 1) col = top;
      c.set(x, y, col);
    }
}

function tufts(c: Canvas, y0: number, y1: number, n: number, seed: number, dark: number, light: number, avoid: (x: number, y: number) => boolean) {
  for (let i = 0; i < n; i++) {
    const x = Math.floor(hash(i, 1, seed) * c.w), y = Math.floor(y0 + hash(i, 2, seed) * (y1 - y0));
    if (avoid(x, y)) continue;
    c.set(x, y, dark).set(x - 1, y + 1, dark).set(x + 1, y + 1, dark).set(x, y - 1, light);
  }
}

const inEnemy = (x: number, y: number) => ((x - 195) / 52) ** 2 + ((y - 84) / 16) ** 2 < 1;
const inAlly = (x: number, y: number) => ((x - 60) / 58) ** 2 + ((y - 156) / 19) ** 2 < 1;
const avoidPlatforms = (x: number, y: number) => inEnemy(x, y) || inAlly(x, y);

// ---------------------------------------------------------------- 草原
const meadow: Bg = () => {
  const c = new Canvas(BG_W, BG_H);
  bands(c, [[0, C.sky], [22, C.skyPale], [52, C.paper]], BG_H);
  cloud(c, 48, 20, 16, C.paper, C.skyPale);
  cloud(c, 150, 12, 12, C.paper, C.skyPale);
  cloud(c, 222, 30, 18, C.paper, C.skyPale);
  // 遠山兩層
  ridge(c, 58, 7, 0.028, 1.2, C.haze, 70);
  ridge(c, 66, 5, 0.041, 4.1, C.foam, 76);
  // 草地：往前越深
  ridge(c, 72, 2, 0.05, 0.3, C.sprout, BG_H, C.lime);
  bands(c, [[74, C.sprout], [110, C.moss]], BG_H);
  tufts(c, 78, 190, 140, 11, C.moss, C.lime, avoidPlatforms);
  tufts(c, 112, 190, 90, 12, C.forest, C.sprout, avoidPlatforms);
  platform(c, 195, 84, 46, 11, C.straw, C.sand, C.wood, C.moss);
  platform(c, 60, 156, 52, 13, C.straw, C.sand, C.wood, C.forest);
  return c;
};

// ---------------------------------------------------------------- 森林
const forest: Bg = () => {
  const c = new Canvas(BG_W, BG_H);
  bands(c, [[0, C.sprout], [18, C.moss], [44, C.forest]], BG_H);
  // 樹冠縫隙的光點
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(hash(i, 7, 41) * BG_W), y = Math.floor(hash(i, 8, 41) * 30);
    c.set(x, y, C.lime).set(x + 1, y, C.lime);
  }
  // 遠處樹幹（淡）與近處樹幹（深）
  for (let i = 0; i < 9; i++) {
    const x = 8 + i * 29 + Math.floor(hash(i, 1, 5) * 10), w = 5 + Math.floor(hash(i, 2, 5) * 3);
    c.rect(x, 10, w, 62, C.forest);
    c.rect(x, 10, 1, 62, C.moss);
  }
  for (const [x, w] of [[2, 11], [232, 14], [118, 8]] as const) {
    c.rect(x, 0, w, 76, C.forestDark);
    c.rect(x + 1, 0, 2, 76, C.forest);
    for (let y = 8; y < 70; y += 11) c.set(x + w - 3, y, C.forest).set(x + w - 4, y + 1, C.forest);
  }
  // 垂下的枝葉
  for (let x = 0; x < BG_W; x++) {
    const h = 6 + Math.round(4 * Math.sin(x * 0.09) + 3 * Math.sin(x * 0.23 + 1));
    for (let y = 0; y < h; y++) c.set(x, y, y === h - 1 ? C.moss : C.forest);
  }
  // 林地
  ridge(c, 74, 1.5, 0.06, 0.8, C.forest, BG_H, C.moss);
  bands(c, [[76, C.forest], [112, C.moss]], BG_H);
  dither(c, 76, C.moss, C.forest);
  tufts(c, 80, 110, 90, 21, C.forestDark, C.moss, avoidPlatforms);
  tufts(c, 114, 190, 90, 22, C.forest, C.sprout, avoidPlatforms);
  // 小蘑菇與落葉
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(hash(i, 3, 23) * BG_W), y = 82 + Math.floor(hash(i, 4, 23) * 105);
    if (avoidPlatforms(x, y)) continue;
    c.set(x, y, hash(i, 5, 23) < 0.5 ? C.ochre : C.bark);
  }
  platform(c, 195, 84, 46, 11, C.sprout, C.moss, C.forest, C.forestDark);
  platform(c, 60, 156, 52, 13, C.sprout, C.moss, C.forest, C.forestDark);
  return c;
};

// ---------------------------------------------------------------- 挑戰場
const arena: Bg = () => {
  const c = new Canvas(BG_W, BG_H);
  bands(c, [[0, C.haze], [16, C.skyPale]], BG_H);
  // 看台牆：石磚與垂掛的旗
  c.rect(0, 26, BG_W, 44, C.stone);
  for (let y = 26; y < 70; y += 6) {
    c.rect(0, y, BG_W, 1, C.ash);
    const off = ((y - 26) / 6) % 2 === 0 ? 0 : 10;
    for (let x = off; x < BG_W; x += 20) c.rect(x, y + 1, 1, 5, C.slate);
  }
  c.rect(0, 24, BG_W, 3, C.mist);
  c.rect(0, 70, BG_W, 2, C.slate);
  for (const [x, col, dark] of [[26, C.tide, C.sea], [96, C.flame, C.ember], [166, C.moss, C.forest], [226, C.lilac, C.dusk]] as const) {
    c.rect(x, 27, 14, 26, col);
    c.rect(x + 11, 27, 3, 26, dark);
    for (let i = 0; i < 7; i++) {
      c.set(x + i, 53 + Math.min(i, 6 - i), col);
      c.set(x + 13 - i, 53 + Math.min(i, 6 - i), dark);
    }
    c.rect(x + 4, 34, 6, 6, C.paper);
    c.rect(x + 5, 35, 4, 4, col);
    c.rect(x - 1, 26, 16, 1, C.gold);
  }
  // 石板地：透視的橫縫＋錯開的直縫
  c.rect(0, 72, BG_W, BG_H - 72, C.ash);
  let y = 72, h = 5, row = 0;
  while (y < BG_H) {
    c.rect(0, y, BG_W, 1, C.stone);
    const step = 22 + h * 3;
    for (let x = (row % 2) * (step >> 1); x < BG_W; x += step) c.rect(x, y, 1, h, C.stone);
    y += h;
    h = Math.min(18, h + 2);
    row++;
  }
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(hash(i, 1, 51) * BG_W), yy = 74 + Math.floor(hash(i, 2, 51) * 116);
    if (c.get(x, yy) === C.ash) c.set(x, yy, C.mist);
  }
  // 地台：刻著圓環的石台
  platform(c, 195, 84, 46, 11, C.paper, C.mist, C.ash, C.stone);
  platform(c, 60, 156, 52, 13, C.paper, C.mist, C.ash, C.stone);
  for (const [cx, cy, rx, ry] of [[195, 83, 34, 7.5], [60, 155, 39, 9]] as const) {
    const ring = c.mask().ellipse(cx, cy, rx, ry).minus(c.mask().ellipse(cx, cy, rx - 1.5, ry - 1));
    c.paint(ring, C.ash);
  }
  return c;
};

export const BG_DRAW: Record<string, Bg> = {
  'bg.meadow': meadow,
  'bg.forest': forest,
  'bg.arena': arena,
};
