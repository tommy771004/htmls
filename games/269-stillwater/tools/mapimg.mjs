// 地圖除錯圖：把 height() 畫成 PPM → dist/map.png（水深藍、岸綠、崖灰；紅點檢查點、黃點釣點、黑點巨石）
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { height, BOUNDS, CHECKPOINTS, SPOTS, BOULDERS, DOCK, CABIN, zoneAt } from '../src/core/map.js';
const sc = +(process.argv[2] || 1);
const W = Math.round((BOUNDS.x1 - BOUNDS.x0) / sc), H = Math.round((BOUNDS.z1 - BOUNDS.z0) / sc);
const px = Buffer.alloc(W * H * 3);
const t0 = Date.now();
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const x = BOUNDS.x0 + i * sc, z = BOUNDS.z0 + j * sc, h = height(x, z);
  let c;
  if (h < 0) { const d = Math.min(1, -h / 5); c = [140 - 120 * d, 200 - 120 * d, 170 - 60 * d]; if (-h < 0.8) c = [190, 210, 160]; }
  else if (h < 4) c = [110 + h * 10, 150 + h * 5, 80];
  else { const g = Math.min(230, 120 + h * 5); c = [g, g, g - 10]; }
  const o = (j * W + i) * 3; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2];
}
const dot = (x, z, col, r = 2) => { const ci = Math.round((x - BOUNDS.x0) / sc), cj = Math.round((z - BOUNDS.z0) / sc); for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const i = ci + a, j = cj + b; if (i >= 0 && j >= 0 && i < W && j < H) { const o = (j * W + i) * 3; px.set(col, o); } } };
for (const b of BOULDERS) dot(b.x, b.z, [30, 30, 30], 1);
for (const s of SPOTS) { dot(s.x, s.z, [255, 220, 0], 2); if (s.roam) for (const r of s.roam) dot(r.x, r.z, [255, 160, 0], 1); }
for (const c of CHECKPOINTS) dot(c.x, c.z, [230, 30, 30], 2);
dot(DOCK.x, DOCK.z, [120, 60, 20], 2); dot(CABIN.x, CABIN.z, [120, 60, 20], 3);
writeFileSync('dist/map.ppm', Buffer.concat([Buffer.from(`P6 ${W} ${H} 255\n`), px]));
execFileSync('sips', ['-s', 'format', 'png', 'dist/map.ppm', '--out', 'dist/map.png'], { stdio: 'ignore' });
console.log(`dist/map.png ${W}×${H} in ${Date.now() - t0} ms`);
for (const s of SPOTS) console.log('spot', s.k, s.zh, 'zone', s.zone, zoneAt(s.x, s.z), 'depth', (-height(s.x, s.z)).toFixed(2), s.roam ? s.roam.map((r) => (-height(r.x, r.z)).toFixed(2)).join('/') : '');
for (const c of CHECKPOINTS) console.log('cp', c.k, c.zh, 'zone', c.zone, 'depth', (-height(c.x, c.z)).toFixed(2), 'berth', (-height(c.berth.x, c.berth.z)).toFixed(2));
