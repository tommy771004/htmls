// 音效量測的共用部分：sfx-report.mjs 與 sfx-tail.mjs 用同一套數字，不要各算各的。全部是量測，不代表聽感。
export const db = (v) => 20 * Math.log10(Math.max(v, 1e-9));
export function fft(re, im) { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } } for (let l = 2; l <= n; l <<= 1) { const a = -2 * Math.PI / l, wr = Math.cos(a), wi = Math.sin(a); for (let i = 0; i < n; i += l) { let cr = 1, ci = 0; for (let j = 0; j < l / 2; j++) { const k = i + j, m = k + l / 2, tr = re[m] * cr - im[m] * ci, ti = re[m] * ci + im[m] * cr; re[m] = re[k] - tr; im[m] = im[k] - ti; re[k] += tr; im[k] += ti; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } } }
export const mono = (a) => { const o = new Float32Array(a.l.length); for (let i = 0; i < o.length; i++) o[i] = (a.l[i] + a.r[i]) * 0.5; return o; };
/** 逐聲道峰值：左右平均會把單側的尖峰算低。 */
export function chPeak(a, t0 = 0, win = 1e9) { let pk = 0; const i0 = Math.round(t0 * a.sr), i1 = Math.min(a.l.length, Math.round((t0 + win) * a.sr)); for (const d of [a.l, a.r]) for (let i = i0; i < i1; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; } return pk; }
export const hotMs = (a, th, t0 = 0) => { let n = 0; const i0 = Math.round(t0 * a.sr); for (const d of [a.l, a.r]) for (let i = i0; i < d.length; i++) if (Math.abs(d[i]) >= th) n++; return n / 2 / a.sr * 1000; };
/** 起音、峰值、尾長、重心、1/3 倍頻帶輪廓。尾長的基準是這一發自己的峰值，所以加高峰值的東西（低頻衝擊、早期反射）都會讓尾長變短。 */
export function analyze(a, t0 = 0, win = 1.3) {
  const sr = a.sr, x = mono(a).subarray(Math.round(t0 * sr), Math.round((t0 + win) * sr)), hop = Math.round(sr * 0.00025), E = [], top = chPeak(a, t0, win);
  for (let i = 0; i + hop <= x.length; i += hop) { let m = 0; for (let j = i; j < i + hop; j++) m = Math.max(m, Math.abs(x[j])); E.push(m); }
  let pk = 0, pi = 0; E.forEach((v, i) => { if (v > pk) { pk = v; pi = i; } });
  let i10 = pi; while (i10 > 0 && E[i10] > pk * 0.1) i10--; let i0 = i10; while (i0 > 0 && E[i0] > pk * 0.01) i0--;
  let i3 = i10; while (i3 < pi && E[i3] < pk * 0.708) i3++;
  const attack = (i3 - i10) * 0.25;   // 從峰值 -20 dB 到第一次達峰值 -3 dB
  // 尾長用 5 ms 窗的包絡：從起音算到最後一次高過峰值 -20 dB
  const W = 20; let t20 = 0, t40 = 0;
  for (let i = E.length - W; i >= pi; i--) { let m = 0; for (let j = i; j < i + W; j++) m = Math.max(m, E[j]); if (!t40 && m > pk * 0.01) t40 = i; if (m > pk * 0.1) { t20 = i; break; } }
  const n = 8192, re = new Float64Array(n), im = new Float64Array(n), st = i10 * hop, L = Math.min(n, Math.round(sr * 0.12));
  for (let i = 0; i < L && st + i < x.length; i++) re[i] = x[st + i] * Math.cos((Math.PI * i) / (2 * L)) ** 2;
  fft(re, im); let sum = 0, cen = 0, lo = 0; const P = new Float64Array(n / 2), df = sr / n;
  for (let i = 1; i < n / 2; i++) { P[i] = re[i] ** 2 + im[i] ** 2; sum += P[i]; cen += P[i] * i * df; if (i * df < 150) lo += P[i]; }
  const bands = []; for (let k = -13; k <= 11; k++) { const fc = 1000 * 2 ** (k / 3), a0 = Math.floor(fc * 2 ** (-1 / 6) / df), b0 = Math.ceil(fc * 2 ** (1 / 6) / df); let s = 0; for (let i = Math.max(1, a0); i < Math.min(n / 2, b0); i++) s += P[i]; bands.push(10 * Math.log10(s / Math.max(1, b0 - a0) + 1e-12)); }
  const mean = bands.reduce((p, c) => p + c, 0) / bands.length; for (let i = 0; i < bands.length; i++) bands[i] -= mean;
  let rms = 0; for (let i = st, e = Math.min(x.length, st + sr * 0.15); i < e; i++) rms += x[i] ** 2; rms = Math.sqrt(rms / (sr * 0.15));
  return { peak: db(top), attack, t20: (t20 - i10) * 0.25 / 1000, t40: (t40 - i10) * 0.25 / 1000, cen: cen / sum, lo: lo / sum, bands, rms: db(rms) };
}
export const distance = (a, b) => { let s = 0; for (let i = 0; i < a.bands.length; i++) s += (a.bands[i] - b.bands[i]) ** 2; return Math.sqrt(s / a.bands.length); };
