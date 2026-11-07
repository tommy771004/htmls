#!/usr/bin/env node
// 校色量測：key 鏡位的亮面地、陰影地、亮面牆、天空，和 ref/targets.json 比較（HSV、ΔE）。
// 用法：node tools/color.mjs [png]。未指定時用 dist/shots/key.png
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const f = process.argv[2] ?? 'dist/shots/key.png';
const W = 1600, H = 900, raw = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-vf', `scale=${W}:${H}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 26 });
const px = (x, y) => { const o = (y * W + x) * 3; return [raw[o], raw[o + 1], raw[o + 2]]; };
const hsv = ([r, g, b]) => { const M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m; let h = 0; if (d) h = M === r ? ((g - b) / d + 6) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h * 60, M ? d / M : 0, M / 255]; };
const lab = ([r, g, b]) => { const f0 = c => { c /= 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; }, R = f0(r), G = f0(g), B = f0(b), x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, y = 0.2126 * R + 0.7152 * G + 0.0722 * B, z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883, t = v => v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116; return [116 * t(y) - 16, 500 * (t(x) - t(y)), 200 * (t(y) - t(z))]; };
// 依亮度與位置把畫面分群
const groups = { sunFloor: [], shadeFloor: [], sky: [], wall: [] };
for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) {
  const c = px(x, y), [h, s, v] = hsv(c);
  if (y < H * 0.32 && h > 190 && h < 235 && s > 0.08) groups.sky.push(c);
  else if (y > H * 0.72 && x > W * 0.2 && x < W * 0.75) (v > 0.45 ? groups.sunFloor : groups.shadeFloor).push(c);
  else if (y > H * 0.2 && y < H * 0.7 && v > 0.45 && s < 0.5) groups.wall.push(c);
}
const mean = a => { if (!a.length) return null; const m = [0, 0, 0]; for (const c of a) for (let i = 0; i < 3; i++) m[i] += c[i] / a.length; return m; };
const T = { sunFloor: [223.4, 206.4, 181.9], shadeFloor: [118.5, 108.8, 101.1], sky: [188.3, 214.3, 235.6], wall: [170, 150, 125] };
let worst = 0;
for (const k in groups) {
  const m = mean(groups[k]); if (!m) { console.log(k, '無樣本'); continue; }
  const a = hsv(m), b = hsv(T[k]), L = lab(m), Lt = lab(T[k]), dE = Math.hypot(L[0] - Lt[0], L[1] - Lt[1], L[2] - Lt[2]);
  worst = Math.max(worst, dE);
  console.log(k.padEnd(11), m.map(v => v.toFixed(0)).join(',').padEnd(13), `目標 ${T[k].map(v => v | 0).join(',')}`.padEnd(20), `ΔS ${((a[1] - b[1]) * 100).toFixed(1)}%`, `ΔV ${((a[2] - b[2]) * 100).toFixed(1)}%`, `ΔE ${dE.toFixed(1)}`, `n=${groups[k].length}`);
}
console.log('最大 ΔE', worst.toFixed(1));
