// 最小的 4×4 矩陣工具（列主序給 WebGL：m[col*4+row]）。

export function ident(o = new Float32Array(16)) {
  o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o;
}

export function mul(a, b, o = new Float32Array(16)) {
  const r = o === a || o === b ? new Float32Array(16) : o;
  for (let c = 0; c < 4; c++) {
    for (let rr = 0; rr < 4; rr++) {
      r[c * 4 + rr] = a[rr] * b[c * 4] + a[4 + rr] * b[c * 4 + 1] + a[8 + rr] * b[c * 4 + 2] + a[12 + rr] * b[c * 4 + 3];
    }
  }
  if (r !== o) o.set(r);
  return o;
}

export function lookAt(eye, at, up, o = new Float32Array(16)) {
  let zx = eye[0] - at[0], zy = eye[1] - at[1], zz = eye[2] - at[2];
  let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
  o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
  o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
  o[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  o[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  o[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  o[15] = 1;
  return o;
}

export function frustum(l, r, b, t, n, f, o = new Float32Array(16)) {
  o.fill(0);
  o[0] = 2 * n / (r - l); o[5] = 2 * n / (t - b);
  o[8] = (r + l) / (r - l); o[9] = (t + b) / (t - b); o[10] = -(f + n) / (f - n); o[11] = -1;
  o[14] = -2 * f * n / (f - n);
  return o;
}

export function ortho(l, r, b, t, n, f, o = new Float32Array(16)) {
  o.fill(0);
  o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n);
  o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n); o[15] = 1;
  return o;
}

export function xform(m, x, y, z) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
    m[3] * x + m[7] * y + m[11] * z + m[15],
  ];
}

export function invert(m, o = new Float32Array(16)) {
  const a = m, inv = new Float32Array(16);
  inv[0] = a[5] * a[10] * a[15] - a[5] * a[11] * a[14] - a[9] * a[6] * a[15] + a[9] * a[7] * a[14] + a[13] * a[6] * a[11] - a[13] * a[7] * a[10];
  inv[4] = -a[4] * a[10] * a[15] + a[4] * a[11] * a[14] + a[8] * a[6] * a[15] - a[8] * a[7] * a[14] - a[12] * a[6] * a[11] + a[12] * a[7] * a[10];
  inv[8] = a[4] * a[9] * a[15] - a[4] * a[11] * a[13] - a[8] * a[5] * a[15] + a[8] * a[7] * a[13] + a[12] * a[5] * a[11] - a[12] * a[7] * a[9];
  inv[12] = -a[4] * a[9] * a[14] + a[4] * a[10] * a[13] + a[8] * a[5] * a[14] - a[8] * a[6] * a[13] - a[12] * a[5] * a[10] + a[12] * a[6] * a[9];
  inv[1] = -a[1] * a[10] * a[15] + a[1] * a[11] * a[14] + a[9] * a[2] * a[15] - a[9] * a[3] * a[14] - a[13] * a[2] * a[11] + a[13] * a[3] * a[10];
  inv[5] = a[0] * a[10] * a[15] - a[0] * a[11] * a[14] - a[8] * a[2] * a[15] + a[8] * a[3] * a[14] + a[12] * a[2] * a[11] - a[12] * a[3] * a[10];
  inv[9] = -a[0] * a[9] * a[15] + a[0] * a[11] * a[13] + a[8] * a[1] * a[15] - a[8] * a[3] * a[13] - a[12] * a[1] * a[11] + a[12] * a[3] * a[9];
  inv[13] = a[0] * a[9] * a[14] - a[0] * a[10] * a[13] - a[8] * a[1] * a[14] + a[8] * a[2] * a[13] + a[12] * a[1] * a[10] - a[12] * a[2] * a[9];
  inv[2] = a[1] * a[6] * a[15] - a[1] * a[7] * a[14] - a[5] * a[2] * a[15] + a[5] * a[3] * a[14] + a[13] * a[2] * a[7] - a[13] * a[3] * a[6];
  inv[6] = -a[0] * a[6] * a[15] + a[0] * a[7] * a[14] + a[4] * a[2] * a[15] - a[4] * a[3] * a[14] - a[12] * a[2] * a[7] + a[12] * a[3] * a[6];
  inv[10] = a[0] * a[5] * a[15] - a[0] * a[7] * a[13] - a[4] * a[1] * a[15] + a[4] * a[3] * a[13] + a[12] * a[1] * a[7] - a[12] * a[3] * a[5];
  inv[14] = -a[0] * a[5] * a[14] + a[0] * a[6] * a[13] + a[4] * a[1] * a[14] - a[4] * a[2] * a[13] - a[12] * a[1] * a[6] + a[12] * a[2] * a[5];
  inv[3] = -a[1] * a[6] * a[11] + a[1] * a[7] * a[10] + a[5] * a[2] * a[11] - a[5] * a[3] * a[10] - a[9] * a[2] * a[7] + a[9] * a[3] * a[6];
  inv[7] = a[0] * a[6] * a[11] - a[0] * a[7] * a[10] - a[4] * a[2] * a[11] + a[4] * a[3] * a[10] + a[8] * a[2] * a[7] - a[8] * a[3] * a[6];
  inv[11] = -a[0] * a[5] * a[11] + a[0] * a[7] * a[9] + a[4] * a[1] * a[11] - a[4] * a[3] * a[9] - a[8] * a[1] * a[7] + a[8] * a[3] * a[5];
  inv[15] = a[0] * a[5] * a[10] - a[0] * a[6] * a[9] - a[4] * a[1] * a[10] + a[4] * a[2] * a[9] + a[8] * a[1] * a[6] - a[8] * a[2] * a[5];
  let det = a[0] * inv[0] + a[1] * inv[4] + a[2] * inv[8] + a[3] * inv[12];
  det = det ? 1 / det : 0;
  for (let i = 0; i < 16; i++) o[i] = inv[i] * det;
  return o;
}

// 模型矩陣：平移 · Ry(-yaw) · Rz(pitch) · Rx(roll) · 等比縮放，寫進 o 的 off 位置
export function trs(o, off, x, y, z, yaw, pitch, roll, s) {
  const cy = Math.cos(-yaw), sy = Math.sin(-yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  // Rz(p)·Rx(r)
  const a00 = cp, a01 = -sp * cr, a02 = sp * sr;
  const a10 = sp, a11 = cp * cr, a12 = -cp * sr;
  const a20 = 0, a21 = sr, a22 = cr;
  // Ry(y)·A
  const b00 = cy * a00 + sy * a20, b01 = cy * a01 + sy * a21, b02 = cy * a02 + sy * a22;
  const b10 = a10, b11 = a11, b12 = a12;
  const b20 = -sy * a00 + cy * a20, b21 = -sy * a01 + cy * a21, b22 = -sy * a02 + cy * a22;
  o[off] = b00 * s; o[off + 1] = b10 * s; o[off + 2] = b20 * s; o[off + 3] = 0;
  o[off + 4] = b01 * s; o[off + 5] = b11 * s; o[off + 6] = b21 * s; o[off + 7] = 0;
  o[off + 8] = b02 * s; o[off + 9] = b12 * s; o[off + 10] = b22 * s; o[off + 11] = 0;
  o[off + 12] = x; o[off + 13] = y; o[off + 14] = z; o[off + 15] = 1;
}

// 把 16 格矩陣 a（位於 src[sOff]）右乘區域矩陣 b，寫到 dst[dOff]
export function mulInto(dst, dOff, src, sOff, b) {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      dst[dOff + c * 4 + r] = src[sOff + r] * b[c * 4] + src[sOff + 4 + r] * b[c * 4 + 1] + src[sOff + 8 + r] * b[c * 4 + 2] + src[sOff + 12 + r] * b[c * 4 + 3];
    }
  }
}

export function hexToLinear(hex, fallback = [0.5, 0.5, 0.5]) {
  const h = String(hex || '').replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => parseInt(c + c, 16)) : [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  if (v.length !== 3 || v.some((c) => !Number.isFinite(c))) return fallback; // 不是 #rgb／#rrggbb
  return v.map((c) => srgbToLinear(c / 255));
}

export function srgbToLinear(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
