// 程式幾何：依材質合併成單一 mesh，UV 用世界座標公尺換算（烘進頂點，不必用材質外掛），
// 頂點色帶地面污漬與每棟的色偏，省掉一整層 AO 貼圖。
export class Bucket {
  constructor(name, texSize) { this.name = name; this.s = 1 / texSize; this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
  vert(x, y, z, nx, ny, nz, c) {
    const s = this.s, ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    const u = ay >= ax && ay >= az ? x : ax > az ? z : x, v = ay >= ax && ay >= az ? z : y;
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u * s, v * s); this.c.push(c[0], c[1], c[2], 1);
    return this.p.length / 3 - 1;
  }
  /** a b c d 順時針（Babylon 左手系從外看） */
  quad(a, b, cc, d, n, ca = WHITE, cb = ca, cc2 = ca, cd = ca) {
    const i0 = this.vert(...a, ...n, ca), i1 = this.vert(...b, ...n, cb), i2 = this.vert(...cc, ...n, cc2), i3 = this.vert(...d, ...n, cd);
    // 繞序依法線自動決定：Babylon 左手系下正面的幾何叉積與法線反向。呼叫端傳什麼順序都不會被背面剔除
    const ux = cc[0] - a[0], uy = cc[1] - a[1], uz = cc[2] - a[2], vx = d[0] - b[0], vy = d[1] - b[1], vz = d[2] - b[2];
    const flip = (uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2] > 0;
    if (flip) this.i.push(i0, i2, i1, i0, i3, i2); else this.i.push(i0, i1, i2, i0, i2, i3);
  }
}
export const WHITE = [1, 1, 1];

/** 面向 +x/-x/+z/-z 的直立面，底部有污漬漸層。 */
export function wallFace(b, x0, z0, x1, z1, y0, y1, nx, nz, tint, grime = 0.62) {
  const low = [tint[0] * grime, tint[1] * grime * 0.97, tint[2] * grime * 0.93];
  const ym = Math.min(y1, y0 + 0.9);
  const seg = (ya, yb, ca, cb) => b.quad([x0, ya, z0], [x0, yb, z0], [x1, yb, z1], [x1, ya, z1], [nx, 0, nz], ca, cb, cb, ca);
  seg(y0, ym, low, tint);
  if (y1 > ym) seg(ym, y1, tint, tint);
}

/** 軸對齊盒子。faces：字串含 t b e w n s 決定要畫哪幾面。top 為另一個桶時放頂面。 */
export function box(b, x0, y0, z0, x1, y1, z1, tint = WHITE, faces = 'tewns', top = b, grime) {
  if (faces.includes('t')) top.quad([x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [x0, y1, z0], [0, 1, 0], tint);
  if (faces.includes('b')) b.quad([x1, y0, z1], [x1, y0, z0], [x0, y0, z0], [x0, y0, z1], [0, -1, 0], tint);
  if (faces.includes('e')) wallFace(b, x1, z0, x1, z1, y0, y1, 1, 0, tint, grime);
  if (faces.includes('w')) wallFace(b, x0, z1, x0, z0, y0, y1, -1, 0, tint, grime);
  if (faces.includes('n')) wallFace(b, x1, z1, x0, z1, y0, y1, 0, 1, tint, grime);
  if (faces.includes('s')) wallFace(b, x0, z0, x1, z0, y0, y1, 0, -1, tint, grime);
}

/** 楔形斜坡或階梯。dir 為上行方向。 */
export function ramp(top, side, r) {
  const xAxis = r.dir[1] === 'x', neg = r.dir[0] === '-';
  const a0 = xAxis ? r.x0 : r.z0, a1 = xAxis ? r.x1 : r.z1, b0 = xAxis ? r.z0 : r.x0, b1 = xAxis ? r.z1 : r.x1;
  const P = (a, y, s) => xAxis ? [a, y, s] : [s, y, a];
  const base = Math.min(r.y0, r.y1) - 0.4, rise = r.y1 - r.y0;
  if (r.kind === 'stairs') {
    const n = Math.max(2, Math.round(Math.abs(rise) / 0.18)), da = (a1 - a0) / n;
    for (let i = 0; i < n; i++) {
      const k = neg ? n - 1 - i : i, a = a0 + da * k, h = r.y0 + rise * (i + 0.5) / n + (rise > 0 ? 0 : 0);
      const v = xAxis ? [a, base, b0, a + da, h, b1] : [b0, base, a, b1, h, a + da];
      box(side, ...v, WHITE, 't', top);
      const prev = r.y0 + rise * (i - 0.5) / n, y = i === 0 ? base : prev;   // 踢面
      const face = neg ? a + da : a, sgn = neg ? 1 : -1;
      if (rise > 0) xAxis ? wallFace(side, face, neg ? b1 : b0, face, neg ? b0 : b1, y, h, sgn, 0, WHITE, 0.8) : wallFace(side, neg ? b0 : b1, face, neg ? b1 : b0, face, y, h, 0, sgn, WHITE, 0.8);
      for (const sb of [b0, b1]) {
        const out = sb === b0 ? -1 : 1, p = P(a, base, sb), q = P(a + da, h, sb);
        out < 0 === xAxis ? side.quad(P(a, base, sb), P(a, h, sb), P(a + da, h, sb), P(a + da, base, sb), xAxis ? [0, 0, out] : [out, 0, 0])
          : side.quad(P(a + da, base, sb), P(a + da, h, sb), P(a, h, sb), P(a, base, sb), xAxis ? [0, 0, out] : [out, 0, 0]);
        void p; void q;
      }
    }
    return;
  }
  const yA0 = neg ? r.y1 : r.y0, yA1 = neg ? r.y0 : r.y1, len = a1 - a0, d = yA1 - yA0, l = Math.hypot(len, d);
  const nA = -d / l, nY = len / l, n = xAxis ? [nA, nY, 0] : [0, nY, nA];
  xAxis ? top.quad(P(a0, yA0, b0), P(a0, yA0, b1), P(a1, yA1, b1), P(a1, yA1, b0), n) : top.quad(P(a0, yA0, b0), P(a1, yA1, b0), P(a1, yA1, b1), P(a0, yA0, b1), n);
  for (const sb of [b0, b1]) {
    const out = sb === b0 ? -1 : 1, nn = xAxis ? [0, 0, out] : [out, 0, 0];
    out < 0 === xAxis ? side.quad(P(a0, base, sb), P(a0, yA0, sb), P(a1, yA1, sb), P(a1, base, sb), nn) : side.quad(P(a1, base, sb), P(a1, yA1, sb), P(a0, yA0, sb), P(a0, base, sb), nn);
  }
}

/** 牆：實體段是盒子，拱頂段用直條逼近弧線。 */
export function wall(b, w, pieces, tint) {
  const len = Math.hypot(w.bx - w.ax, w.bz - w.az), ux = (w.bx - w.ax) / len, uz = (w.bz - w.az) / len, alongX = Math.abs(ux) > 0.5, t = w.t / 2;
  const B = (s0, s1, y0, y1, faces) => {
    const c0 = alongX ? w.ax + ux * s0 : w.ax - t, c1 = alongX ? w.ax + ux * s1 : w.ax + t;
    const d0 = alongX ? w.az - t : w.az + uz * s0, d1 = alongX ? w.az + t : w.az + uz * s1;
    box(b, Math.min(c0, c1), y0, Math.min(d0, d1), Math.max(c0, c1), y1, Math.max(d0, d1), tint, faces);
  };
  for (const p of pieces) {
    if (p.hole) continue;
    const o = p.lintel;
    if (o && (o.kind === 'arch' || o.kind === 'gate')) {
      const N = 14, R = o.w / 2, cx = (p.s0 + p.s1) / 2, spring = p.y0 - R;
      for (let i = 0; i < N; i++) {
        const a = p.s0 + (p.s1 - p.s0) * i / N, e = p.s0 + (p.s1 - p.s0) * (i + 1) / N, m = (a + e) / 2 - cx;
        const yy = spring + Math.sqrt(Math.max(0, R * R - m * m));
        B(a, e, yy, w.y1, 'tbns' + 'ew');
      }
      continue;
    }
    B(p.s0, p.s1, p.y0, p.y1, 'tbewns');
  }
}

/** 半球頂。 */
export function dome(b, cx, y, cz, rx, rz, h, tint) {
  const N = 20, M = 8;
  const P = (i, j) => { const th = i / N * Math.PI * 2, ph = j / M * Math.PI / 2, c = Math.cos(ph); return [cx + Math.sin(th) * c * rx, y + Math.sin(ph) * h, cz + Math.cos(th) * c * rz]; };
  const Nn = (i, j) => { const th = i / N * Math.PI * 2, ph = j / M * Math.PI / 2, c = Math.cos(ph); return [Math.sin(th) * c, Math.sin(ph), Math.cos(th) * c]; };
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const a = P(i, j), bb = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
    const i0 = b.vert(...a, ...Nn(i, j), tint), i1 = b.vert(...bb, ...Nn(i + 1, j), tint), i2 = b.vert(...c, ...Nn(i + 1, j + 1), tint), i3 = b.vert(...d, ...Nn(i, j + 1), tint);
    b.i.push(i0, i2, i1, i0, i3, i2);
  }
}

/** 四坡屋頂（沿長邊有屋脊）。 */
export function hipRoof(b, x0, y, z0, x1, z1, h, tint) {
  const dx = x1 - x0, dz = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, alongX = dx >= dz, m = Math.min(dx, dz) / 2;
  const ra = alongX ? [x0 + m, y + h, cz] : [cx, y + h, z0 + m], rb = alongX ? [x1 - m, y + h, cz] : [cx, y + h, z1 - m];
  const c00 = [x0, y, z0], c01 = [x0, y, z1], c11 = [x1, y, z1], c10 = [x1, y, z0], l = Math.hypot(h, m), ny = m / l, ns = h / l;
  if (alongX) {
    b.quad(c01, ra, rb, c11, [0, ny, ns], tint); b.quad(c10, rb, ra, c00, [0, ny, -ns], tint);
    b.quad(c00, ra, ra, c01, [-ns, ny, 0], tint); b.quad(c11, rb, rb, c10, [ns, ny, 0], tint);
  } else {
    b.quad(c00, ra, rb, c01, [-ns, ny, 0], tint); b.quad(c11, rb, ra, c10, [ns, ny, 0], tint);
    b.quad(c10, ra, ra, c00, [0, ny, -ns], tint); b.quad(c01, rb, rb, c11, [0, ny, ns], tint);
  }
}
