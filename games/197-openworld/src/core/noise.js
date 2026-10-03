// 可重現的亂數與 2D simplex noise，地形、植被、草都共用同一個 seed。

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const GRAD = [1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 0, 1, 0, -1];

/** 回傳 noise(x, y) → 約 [-1, 1] */
export function createNoise2D(seed) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  return function noise(x, y) {
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - (i - t);
    const y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = 1 - i1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    let n = 0;

    let tt = 0.5 - x0 * x0 - y0 * y0;
    if (tt > 0) {
      const g = (perm[ii + perm[jj]] & 7) * 2;
      tt *= tt;
      n += tt * tt * (GRAD[g] * x0 + GRAD[g + 1] * y0);
    }
    tt = 0.5 - x1 * x1 - y1 * y1;
    if (tt > 0) {
      const g = (perm[ii + i1 + perm[jj + j1]] & 7) * 2;
      tt *= tt;
      n += tt * tt * (GRAD[g] * x1 + GRAD[g + 1] * y1);
    }
    tt = 0.5 - x2 * x2 - y2 * y2;
    if (tt > 0) {
      const g = (perm[ii + 1 + perm[jj + 1]] & 7) * 2;
      tt *= tt;
      n += tt * tt * (GRAD[g] * x2 + GRAD[g + 1] * y2);
    }
    return 70 * n;
  };
}

export function fbm(noise, x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
/** 與 frame rate 無關的指數趨近 */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
