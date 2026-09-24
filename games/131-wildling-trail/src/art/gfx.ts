// 以「設計座標」作畫的小工具：怪獸以 48×48 設計，icon 用同一套描述以 0.5 倍重畫，
// 描邊與細節仍是 1 像素，所以小圖不會糊成一團。

import { Canvas, Mask, type PartOptions } from './raster';
import { C, type Ramp } from './palette';

/** 設計座標版的部位選項：sph 為球面光的 [cx, cy, rx, ry]。 */
export type GPart = Omit<PartOptions, 'sphere'> & { sph?: [number, number, number, number] };

export class Gfx {
  constructor(
    readonly c: Canvas,
    readonly s = 1,
    readonly ox = 0,
    readonly oy = 0,
  ) {}
  X(x: number): number {
    return this.ox + x * this.s;
  }
  Y(y: number): number {
    return this.oy + y * this.s;
  }
  R(r: number): number {
    return Math.max(0.55, r * this.s);
  }
  mask(): Mask {
    return this.c.mask();
  }
  /** 橢圓；deg 為旋轉角度（度）。 */
  ell(cx: number, cy: number, rx: number, ry: number, deg = 0): Mask {
    return this.mask().ellipse(this.X(cx), this.Y(cy), this.R(rx), this.R(ry), true, (deg * Math.PI) / 180);
  }
  poly(...pts: number[]): Mask {
    return this.mask().poly(pts.map((v, i) => (i % 2 === 0 ? this.X(v) : this.Y(v))));
  }
  cap(x0: number, y0: number, x1: number, y1: number, r0: number, r1 = r0): Mask {
    return this.mask().capsule(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), this.R(r0), this.R(r1));
  }
  /** 以折線串起多段膠囊（半徑從 r0 漸變到 r1）。 */
  path(pts: readonly number[], r0: number, r1 = r0): Mask {
    const m = this.mask();
    const n = pts.length / 2 - 1;
    for (let i = 0; i < n; i++) {
      const a = r0 + ((r1 - r0) * i) / n, b = r0 + ((r1 - r0) * (i + 1)) / n;
      m.or(this.cap(pts[i * 2], pts[i * 2 + 1], pts[i * 2 + 2], pts[i * 2 + 3], a, b));
    }
    return m;
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number): this {
    this.c.paint(this.mask().line(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1)), c);
    return this;
  }
  /** 畫部位；陰影與亮面寬度隨比例縮放（至少 1 像素）。 */
  part(m: Mask, r: Ramp, o: GPart = {}): this {
    const opts: PartOptions = { ...o };
    opts.shade = o.shade === 0 ? 0 : Math.max(1, Math.round((o.shade ?? 2) * this.s));
    opts.light = o.light === 0 ? 0 : Math.max(1, Math.round((o.light ?? 1) * this.s));
    if (Array.isArray(o.sph)) {
      const [cx, cy, rx, ry] = o.sph;
      opts.sphere = { cx: this.X(cx), cy: this.Y(cy), rx: this.R(rx), ry: this.R(ry) };
    }
    if (o.spec) opts.spec = { x: this.X(o.spec.x), y: this.Y(o.spec.y), r: o.spec.r ? this.R(o.spec.r) : 0 };
    this.c.part(m, r, opts);
    return this;
  }
  /** 橢圓部位（自動球面光）。 */
  ball(cx: number, cy: number, rx: number, ry: number, r: Ramp, o: GPart = {}): this {
    return this.part(this.ell(cx, cy, rx, ry), r, { sph: [cx, cy - ry * 0.1, rx, ry], ...o });
  }
  fill(m: Mask, c: number): this {
    this.c.paint(m, c);
    return this;
  }
  /** 只畫在既有像素上的單點。 */
  px(x: number, y: number, c: number): this {
    this.c.set(Math.floor(this.X(x)), Math.floor(this.Y(y)), c);
    return this;
  }
  /** 閃亮的眼睛：深色瞳孔＋左上高光。 */
  eye(x: number, y: number, rx: number, ry: number, iris = C.ink, shine = C.paper): this {
    this.fill(this.ell(x, y, rx, ry), iris);
    if (this.s >= 1 && rx >= 1.4) this.px(x - rx * 0.45, y - ry * 0.45, shine);
    else if (this.s < 1 && rx >= 2.5) this.px(x - rx * 0.5, y - ry * 0.5, shine);
    return this;
  }
}
