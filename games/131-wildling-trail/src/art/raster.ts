// 無反鋸齒的小型光柵器：所有圖都先畫進「索引緩衝」，最後才換成 RGBA。
// 形狀（橢圓、多邊形、膠囊線）先填進 Mask，再以色階上色＋左上光源分層陰影＋一像素描邊。

import { OUTLINE_OF, RGBA, TRANSPARENT, type Ramp } from './palette';

export interface PixelImage {
  w: number;
  h: number;
  /** RGBA、逐列排列。 */
  data: Uint8ClampedArray;
}

/** 決定性雜湊雜訊：同樣的 (x, y, seed) 永遠得到同一個 [0, 1) 值。 */
export function hash(x: number, y: number, seed = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** 布林遮罩：形狀的「像素集合」。 */
export class Mask {
  readonly m: Uint8Array;
  constructor(readonly w: number, readonly h: number) {
    this.m = new Uint8Array(w * h);
  }
  has(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.m[y * this.w + x] === 1;
  }
  put(x: number, y: number, v = true): this {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.m[y * this.w + x] = v ? 1 : 0;
    return this;
  }
  get empty(): boolean {
    return !this.m.includes(1);
  }
  clone(): Mask {
    const out = new Mask(this.w, this.h);
    out.m.set(this.m);
    return out;
  }
  /** 以像素中心判定：((px-cx)/rx)^2 + ((py-cy)/ry)^2 <= 1；angle（弧度）可旋轉橢圓。 */
  ellipse(cx: number, cy: number, rx: number, ry: number, v = true, angle = 0): this {
    const r = Math.max(rx, ry);
    const x0 = Math.floor(cx - r), x1 = Math.ceil(cx + r), y0 = Math.floor(cy - r), y1 = Math.ceil(cy + r);
    const cos = Math.cos(angle), sin = Math.sin(angle);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - cx, py = y + 0.5 - cy;
        const dx = (px * cos + py * sin) / rx, dy = (-px * sin + py * cos) / ry;
        if (dx * dx + dy * dy <= 1) this.put(x, y, v);
      }
    return this;
  }
  rect(x: number, y: number, w: number, h: number, v = true): this {
    for (let j = Math.round(y); j < Math.round(y + h); j++)
      for (let i = Math.round(x); i < Math.round(x + w); i++) this.put(i, j, v);
    return this;
  }
  /** 偶奇規則多邊形填色（點為 [x, y, x, y, ...]）。 */
  poly(pts: readonly number[], v = true): this {
    const n = pts.length / 2;
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      minY = Math.min(minY, pts[i * 2 + 1]);
      maxY = Math.max(maxY, pts[i * 2 + 1]);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const py = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < n; i++) {
        const ax = pts[i * 2], ay = pts[i * 2 + 1];
        const bx = pts[((i + 1) % n) * 2], by = pts[((i + 1) % n) * 2 + 1];
        if ((ay <= py && by > py) || (by <= py && ay > py)) xs.push(ax + ((py - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) this.put(x, y, v);
    }
    return this;
  }
  /** 膠囊線段：距離線段 ≤ r 的像素。r 可從頭到尾漸變。 */
  capsule(x0: number, y0: number, x1: number, y1: number, r0: number, r1 = r0, v = true): this {
    const pad = Math.max(r0, r1) + 1;
    const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy || 1e-9;
    for (let y = Math.floor(Math.min(y0, y1) - pad); y <= Math.ceil(Math.max(y0, y1) + pad); y++)
      for (let x = Math.floor(Math.min(x0, x1) - pad); x <= Math.ceil(Math.max(x0, x1) + pad); x++) {
        const px = x + 0.5, py = y + 0.5;
        const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / len2));
        const qx = x0 + dx * t - px, qy = y0 + dy * t - py;
        const r = r0 + (r1 - r0) * t;
        if (qx * qx + qy * qy <= r * r) this.put(x, y, v);
      }
    return this;
  }
  /** 一像素寬的 Bresenham 線。 */
  line(x0: number, y0: number, x1: number, y1: number, v = true): this {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.put(x0, y0, v);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }
  or(o: Mask): this {
    for (let i = 0; i < this.m.length; i++) this.m[i] |= o.m[i];
    return this;
  }
  and(o: Mask): this {
    for (let i = 0; i < this.m.length; i++) this.m[i] &= o.m[i];
    return this;
  }
  minus(o: Mask): this {
    for (let i = 0; i < this.m.length; i++) if (o.m[i]) this.m[i] = 0;
    return this;
  }
  /** 四鄰擴張一像素（用於描邊）。 */
  dilate(): Mask {
    const out = this.clone();
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (!this.has(x, y) && (this.has(x - 1, y) || this.has(x + 1, y) || this.has(x, y - 1) || this.has(x, y + 1)))
          out.put(x, y);
    return out;
  }
  flipX(): Mask {
    const out = new Mask(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.has(x, y)) out.put(this.w - 1 - x, y);
    return out;
  }
}

export interface PartOptions {
  /** 描邊：true（預設）＝外框覆蓋在既有部位上，形成部位間的分隔線；'outer' ＝只描在空白處；false ＝不描。 */
  outline?: boolean | 'outer';
  /** 暗面偏移（像素）：遮罩往右下移這麼多仍在形狀外的像素 → 暗色。0 ＝不做。 */
  shade?: number;
  /** 亮面偏移：往左上看這麼多像素就出界 → 亮色。0 ＝不做。 */
  light?: number;
  /** 球面光：以橢圓法線計算明暗（給頭、身體等圓形部位）。 */
  sphere?: { cx: number; cy: number; rx: number; ry: number };
  /** 高光點（使用 ramp.h）。 */
  spec?: { x: number; y: number; r?: number };
  /** 只畫在這個遮罩範圍內（裁切）。 */
  clip?: Mask;
}

/** 索引緩衝畫布。 */
export class Canvas {
  readonly px: Uint8Array;
  constructor(readonly w: number, readonly h: number) {
    this.px = new Uint8Array(w * h);
  }
  get(x: number, y: number): number {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.px[y * this.w + x] : TRANSPARENT;
  }
  set(x: number, y: number, c: number): this {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c;
    return this;
  }
  /** 只在已有顏色的地方上色（畫紋理用）。 */
  over(x: number, y: number, c: number): this {
    if (this.get(Math.round(x), Math.round(y)) !== TRANSPARENT) this.set(x, y, c);
    return this;
  }
  mask(): Mask {
    return new Mask(this.w, this.h);
  }
  fill(c: number): this {
    this.px.fill(c);
    return this;
  }
  rect(x: number, y: number, w: number, h: number, c: number): this {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
    return this;
  }
  paint(m: Mask, c: number): this {
    for (let i = 0; i < m.m.length; i++) if (m.m[i]) this.px[i] = c;
    return this;
  }
  /** 以色階畫一個部位：描邊 → 中間色 → 暗面 → 亮面 → 高光。 */
  part(m: Mask, r: Ramp, o: PartOptions = {}): this {
    const shape = o.clip ? m.clone().and(o.clip) : m;
    const outline = o.outline ?? true;
    if (outline) {
      const ring = shape.dilate().minus(shape);
      for (let y = 0; y < this.h; y++)
        for (let x = 0; x < this.w; x++)
          if (ring.has(x, y) && (outline === true || this.get(x, y) === TRANSPARENT)) this.set(x, y, r.o);
    }
    const sd = o.shade ?? 2, ld = o.light ?? 1;
    const sp = o.sphere;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (!shape.has(x, y)) continue;
        let c = r.m;
        if (sp) {
          const nx = (x + 0.5 - sp.cx) / sp.rx, ny = (y + 0.5 - sp.cy) / sp.ry;
          const lit = -(nx * 0.62 + ny * 0.78);
          if (lit > 0.42) c = r.l;
          else if (lit < -0.3) c = r.d;
        }
        if (sd > 0 && !m.has(x + sd, y + sd)) c = r.d;
        else if (!sp && ld > 0 && !m.has(x - ld, y - ld)) c = r.l;
        this.set(x, y, c);
      }
    if (o.spec && r.h !== undefined) {
      const rr = o.spec.r ?? 0;
      if (rr <= 0) this.set(o.spec.x, o.spec.y, r.h);
      else {
        const s = new Mask(this.w, this.h).ellipse(o.spec.x, o.spec.y, rr, rr).and(shape);
        this.paint(s, r.h);
      }
    }
    return this;
  }
  /** 自動描邊：每個與不透明像素四鄰相接的透明像素，填上鄰色的加深色。 */
  outline(): this {
    const src = this.px.slice();
    const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < this.w && y < this.h ? src[y * this.w + x] : 0);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (at(x, y) !== TRANSPARENT) continue;
        const n = at(x, y + 1) || at(x, y - 1) || at(x + 1, y) || at(x - 1, y);
        if (n) this.px[y * this.w + x] = OUTLINE_OF[n];
      }
    return this;
  }
  /** 以字元格蓋印：legend 對應色盤索引；不在 legend 內的字元（如 '.'）略過。 */
  stamp(x0: number, y0: number, rows: readonly string[], legend: Record<string, number>, flip = false): this {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const c = legend[row[i]];
        if (c === undefined) continue;
        this.set(flip ? x0 + row.length - 1 - i : x0 + i, y0 + j, c);
      }
    });
    return this;
  }
  /** 把另一張畫布疊上來（透明處略過）。 */
  blit(src: Canvas, dx = 0, dy = 0, flip = false): this {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const c = src.get(flip ? src.w - 1 - x : x, y);
        if (c !== TRANSPARENT) this.set(dx + x, dy + y, c);
      }
    return this;
  }
  flipX(): Canvas {
    const out = new Canvas(this.w, this.h);
    return out.blit(this, 0, 0, true);
  }
  /** 把某色換成另一色。 */
  swap(map: Record<number, number>): this {
    for (let i = 0; i < this.px.length; i++) {
      const v = map[this.px[i]];
      if (v !== undefined) this.px[i] = v;
    }
    return this;
  }
  toImage(): PixelImage {
    const data = new Uint8ClampedArray(this.w * this.h * 4);
    for (let i = 0; i < this.px.length; i++) data.set(RGBA[this.px[i]], i * 4);
    return { w: this.w, h: this.h, data };
  }
}
