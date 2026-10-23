// 室內場景的碰撞盒：把網格縮放／平移到場景座標（和 bake.html 的 origin、scale 相同），
// 取地面以上兩段高度帶裡接近垂直的三角形，柵格化成佔用格，再把每列連續的格子合併成盒子。
// 兩段都有東西的格子（牆、柱）做成高盒，只有低段的（長椅、床、欄杆）做成矮盒。
// 用法：node tools/room-col.mjs <glb> '{"origin":[x,y,z],"scale":0.7,"rotY":0,"carve":[[x0,x1,z0,z1]]}' [格子 0.25] [--png out.png]
// 輸出 PRIM 字串（b,中心x,中心y,中心z,長,高,寬,0;…），貼進頁面的 ROOMS.<id>.prims。
import { NodeIO } from '../../197-openworld/node_modules/@gltf-transform/core/dist/index.js';
import { ALL_EXTENSIONS } from '../../197-openworld/node_modules/@gltf-transform/extensions/dist/index.js';
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const [src, cfgS = '{}', cellS = '0.25'] = process.argv.slice(2).filter(a => !a.startsWith('--') && !a.endsWith('.png'));
const pngOut = process.argv.includes('--png') ? process.argv[process.argv.indexOf('--png') + 1] : null;
const cfg = JSON.parse(cfgS), cell = +cellS, K = cfg.scale ?? 1, O = cfg.origin || [0, 0, 0], ry = cfg.rotY || 0;
const LOW = cfg.low || [0.25, 1.7], HIGH = cfg.high || [2.4, 6], MIN_AREA = cfg.minArea ?? 0.012;
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(src);
const mul = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const xf = p => { const x = (p[0] - O[0]) * K, y = (p[1] - O[1]) * K, z = (p[2] - O[2]) * K, c = Math.cos(ry), s = Math.sin(ry); return [x * c + z * s, y, -x * s + z * c]; };
const tris = [];
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue; const W = node.getWorldMatrix();
  if (cfg.exclude && new RegExp(cfg.exclude).test(node.getName())) continue;
  for (const p of mesh.listPrimitives()) { if (p.getMode() !== 4) continue; // 只取三角形（有些模型夾帶線段）
   
    const pos = p.getAttribute('POSITION'), idx = p.getIndices(), v = [];
    for (let i = 0; i < pos.getCount(); i++) v.push(xf(mul(W, pos.getElement(i, []))));
    const n = idx ? idx.getCount() : pos.getCount();
    for (let i = 0; i < n; i += 3) tris.push([v[idx ? idx.getScalar(i) : i], v[idx ? idx.getScalar(i + 1) : i + 1], v[idx ? idx.getScalar(i + 2) : i + 2]]);
  }
}
let lo = [1e9, 1e9], hi = [-1e9, -1e9];
for (const t of tris) for (const p of t) { lo = [Math.min(lo[0], p[0]), Math.min(lo[1], p[2])]; hi = [Math.max(hi[0], p[0]), Math.max(hi[1], p[2])]; }
const nx = Math.ceil((hi[0] - lo[0]) / cell) + 1, nz = Math.ceil((hi[1] - lo[1]) / cell) + 1;
const low = new Float32Array(nx * nz), high = new Float32Array(nx * nz);
// 三角形在高度帶裡的部分：以重心附近的細分取樣點累積面積
for (const [a, b, c] of tris) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const NX = uy * vz - uz * vy, NY = uz * vx - ux * vz, NZ = ux * vy - uy * vx, L = Math.hypot(NX, NY, NZ); if (L < 1e-9) continue;
  if (Math.abs(NY / L) > 0.7) continue; // 地板、桌面、天花板不算
  const area = L / 2, k = Math.max(1, Math.ceil(Math.sqrt(area) / (cell * 0.5))), da = area / (k * k);
  for (let i = 0; i < k; i++) for (let j = 0; j < k - i; j++) for (const flip of [0, 1]) {
    if (flip && i + j >= k - 1) continue;
    const r1 = (i + (flip ? 2 / 3 : 1 / 3)) / k, r2 = (j + (flip ? 2 / 3 : 1 / 3)) / k;
    const x = a[0] + ux * r1 + vx * r2, y = a[1] + uy * r1 + vy * r2, z = a[2] + uz * r1 + vz * r2;
    const ci = Math.floor((x - lo[0]) / cell), cj = Math.floor((z - lo[1]) / cell), c0 = cj * nx + ci;
    if (y >= LOW[0] && y <= LOW[1]) low[c0] += da; else if (y >= HIGH[0] && y <= HIGH[1]) high[c0] += da;
  }
}
const occ = new Uint8Array(nx * nz); // 0 空、1 矮、2 高
for (let c = 0; c < nx * nz; c++) if (low[c] > MIN_AREA) occ[c] = high[c] > MIN_AREA ? 2 : 1;
// carve：手動清空的矩形（場景座標 [x0, x1, z0, z1]），例如掃描把窄門洞量得太窄
for (const [x0, x1, z0, z1] of cfg.carve || []) for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
  const x = lo[0] + (i + 0.5) * cell, z = lo[1] + (j + 0.5) * cell; if (x > x0 && x < x1 && z > z0 && z < z1) occ[j * nx + i] = 0;
}
// 把孤立的雜點去掉（掃描破片）
for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) { const c = j * nx + i; if (!occ[c]) continue; let n = 0; for (const d of [-1, 1, -nx, nx, -nx - 1, -nx + 1, nx - 1, nx + 1]) if (occ[c + d]) n++; if (!n) occ[c] = 0; }
const H = { 1: cfg.lowH ?? 1.6, 2: cfg.tallH ?? 9 };
const out = [];
for (let j = 0; j < nz; j++) for (let i = 0; i < nx;) {
  const t = occ[j * nx + i]; if (!t) { i++; continue; }
  let e = i; while (e + 1 < nx && occ[j * nx + e + 1] === t) e++;
  const x0 = lo[0] + i * cell, x1 = lo[0] + (e + 1) * cell, z0 = lo[1] + j * cell, h = H[t];
  out.push([(x0 + x1) / 2, h / 2 - 0.1, z0 + cell / 2, x1 - x0, h + 0.2, cell]);
  i = e + 1;
}
// 上下相鄰、x 範圍相同的盒子再合併
out.sort((p, q) => p[0] - q[0] || p[3] - q[3] || p[4] - q[4] || p[2] - q[2]);
const merged = [];
for (const b of out) { const m = merged.at(-1); if (m && m[0] === b[0] && m[3] === b[3] && m[4] === b[4] && Math.abs(m[2] + m[5] / 2 - (b[2] - b[5] / 2)) < 1e-6) { const z0 = m[2] - m[5] / 2, z1 = b[2] + b[5] / 2; m[2] = (z0 + z1) / 2; m[5] = z1 - z0; } else merged.push([...b]); }
const r = v => +v.toFixed(2);
console.log(merged.map(b => `b,${r(b[0])},${r(b[1])},${r(b[2])},${r(b[3])},${r(b[4])},${r(b[5])},0`).join(';'));
console.error(`${tris.length} tris → ${nx}×${nz} 格 → ${out.length} 列 → ${merged.length} 盒；範圍 x ${lo[0].toFixed(1)}…${hi[0].toFixed(1)} z ${lo[1].toFixed(1)}…${hi[1].toFixed(1)}`);
if (pngOut) {
  const S = 4, W = nx * S, Hh = nz * S, raw = Buffer.alloc((W * 3 + 1) * Hh);
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const c = (y / S | 0) * nx + (x / S | 0), d = y * (W * 3 + 1) + 1 + x * 3, col = occ[c] === 2 ? [255, 170, 40] : occ[c] === 1 ? [60, 160, 255] : [20, 24, 30]; raw[d] = col[0]; raw[d + 1] = col[1]; raw[d + 2] = col[2]; }
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = b => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td)); return Buffer.concat([l, td, cc]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(Hh, 4); ih[8] = 8; ih[9] = 2;
  writeFileSync(pngOut, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
