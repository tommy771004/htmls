// 英雄模型烘焙（Node 執行）：用 models-heroes.js 的 SDF 造型建出各部件，以 QEM 減面到目標面數，
// 量化後壓縮成 src/models-baked.js。遊戲執行時直接解碼，不必在瀏覽器裡跑網格化。
//   node src/models-bake.mjs            （在 games/198-ki-lanes 目錄下）
// 改了 models-heroes.js 或 models-sdf.js 的造型後要重新烘焙，再 npm run build。
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { zlibSync } from 'three/examples/jsm/libs/fflate.module.js';
import { PROPS, buildHeroLive, SEGMENT_TARGETS } from './models-heroes.js';

/* ---------------- QEM 減面（半邊收縮，保留端點屬性） ---------------- */
const MAX_ERR = 6e-5;
function decimate(geo, target) {
  const P = geo.attributes.position.array, nv = geo.attributes.position.count;
  const I = geo.index.array, nf = I.length / 3;
  if (nf <= target) return geo;
  const F = new Int32Array(I), alive = new Uint8Array(nf).fill(1), dead = new Uint8Array(nv);
  const vf = Array.from({ length: nv }, () => []);
  for (let f = 0; f < nf; f++) for (let k = 0; k < 3; k++) vf[F[f * 3 + k]].push(f);
  // 屬性類別：顏色對、邊界側、材質不同的頂點之間收縮要付代價（保住色塊邊界）
  const cA = geo.attributes.color.array, cB = geo.attributes.aColB.array, E = geo.attributes.aEdge.array, M = geo.attributes.aMat.array;
  const cls = new Float64Array(nv);
  for (let v = 0; v < nv; v++) cls[v] = Math.round(cA[v * 3] * 255) * 1e6 + Math.round(cA[v * 3 + 1] * 255) * 1e3 + Math.round(cA[v * 3 + 2] * 255) + (E[v] < 0 ? 0 : 0.5) + M[v * 2] * 0.01;
  const Q = new Float64Array(nv * 10);
  const addQ = (v, a, b, c, d, w) => {
    const o = v * 10;
    Q[o] += w * a * a; Q[o + 1] += w * a * b; Q[o + 2] += w * a * c; Q[o + 3] += w * a * d;
    Q[o + 4] += w * b * b; Q[o + 5] += w * b * c; Q[o + 6] += w * b * d; Q[o + 7] += w * c * c; Q[o + 8] += w * c * d; Q[o + 9] += w * d * d;
  };
  const fn = (f, out) => {
    const a = F[f * 3], b = F[f * 3 + 1], c = F[f * 3 + 2];
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
    const wx = P[c * 3] - P[a * 3], wy = P[c * 3 + 1] - P[a * 3 + 1], wz = P[c * 3 + 2] - P[a * 3 + 2];
    out[0] = uy * wz - uz * wy; out[1] = uz * wx - ux * wz; out[2] = ux * wy - uy * wx;
    return out;
  };
  const triN = (a, b, c, out) => {
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
    const wx = P[c * 3] - P[a * 3], wy = P[c * 3 + 1] - P[a * 3 + 1], wz = P[c * 3 + 2] - P[a * 3 + 2];
    out[0] = uy * wz - uz * wy; out[1] = uz * wx - ux * wz; out[2] = ux * wy - uy * wx; return out;
  };
  const n3 = [0, 0, 0];
  for (let f = 0; f < nf; f++) {
    fn(f, n3); const l = Math.hypot(n3[0], n3[1], n3[2]); if (l < 1e-12) continue;
    const a = n3[0] / l, b = n3[1] / l, c = n3[2] / l, v0 = F[f * 3], d = -(a * P[v0 * 3] + b * P[v0 * 3 + 1] + c * P[v0 * 3 + 2]);
    for (let k = 0; k < 3; k++) addQ(F[f * 3 + k], a, b, c, d, 1);
  }
  const qerr = (u, v) => {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2], o = u * 10, p = v * 10;
    const q = (i) => Q[o + i] + Q[p + i];
    return q(0) * x * x + 2 * q(1) * x * y + 2 * q(2) * x * z + 2 * q(3) * x + q(4) * y * y + 2 * q(5) * y * z + 2 * q(6) * y + q(7) * z * z + 2 * q(8) * z + q(9);
  };
  const ver = new Int32Array(nv);
  // 二元堆積：[cost, u, v, verU, verV]
  const H = []; const push = (e) => { H.push(e); let i = H.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (H[p][0] <= H[i][0]) break; [H[p], H[i]] = [H[i], H[p]]; i = p; } };
  const pop = () => { const t = H[0], l = H.pop(); if (H.length) { H[0] = l; let i = 0; for (;;) { const a = i * 2 + 1, b = a + 1; let m = i; if (a < H.length && H[a][0] < H[m][0]) m = a; if (b < H.length && H[b][0] < H[m][0]) m = b; if (m === i) break; [H[m], H[i]] = [H[i], H[m]]; i = m; } } return t; };
  // 色塊邊界：跨類別收縮幾乎禁止；靠近邊界（|edge| 小）的頂點移動也要付代價，色塊輪廓才不會被吃掉
  const nearB = (u) => cB[u * 3] !== cA[u * 3] || cB[u * 3 + 1] !== cA[u * 3 + 1] || cB[u * 3 + 2] !== cA[u * 3 + 2] ? Math.abs(E[u]) < 0.02 : false;
  const edgeCost = (u, v) => qerr(u, v) + (cls[u] !== cls[v] ? 1 : 0) + (nearB(u) ? 2e-3 : 0);
  const pushEdge = (a, b) => { const c1 = edgeCost(a, b), c2 = edgeCost(b, a); if (c1 <= c2) push([c1, a, b, ver[a], ver[b]]); else push([c2, b, a, ver[b], ver[a]]); };
  const seen = new Set();
  for (let f = 0; f < nf; f++) for (let k = 0; k < 3; k++) {
    const a = F[f * 3 + k], b = F[f * 3 + (k + 1) % 3], key = a < b ? a * nv + b : b * nv + a;
    if (!seen.has(key)) { seen.add(key); pushEdge(a, b); }
  }
  let faces = nf;
  const nOld = [0, 0, 0], nNew = [0, 0, 0];
  while (faces > target && H.length) {
    const [cost, u, v, vu, vv] = pop();
    if (cost > MAX_ERR) break; // 再減就會明顯走樣：寧可多留一些面
    if (dead[u] || dead[v] || ver[u] !== vu || ver[v] !== vv) continue;
    // 檢查收縮後是否翻面（u 換成 v 之後，法線不可大幅轉向）
    let ok = true;
    const fu = vf[u].filter((f) => alive[f]);
    for (const f of fu) {
      const a = F[f * 3], b = F[f * 3 + 1], c = F[f * 3 + 2];
      if (a === v || b === v || c === v) continue;
      triN(a, b, c, nOld);
      triN(a === u ? v : a, b === u ? v : b, c === u ? v : c, nNew);
      const dot = nOld[0] * nNew[0] + nOld[1] * nNew[1] + nOld[2] * nNew[2];
      const lo = Math.hypot(nOld[0], nOld[1], nOld[2]), ln = Math.hypot(nNew[0], nNew[1], nNew[2]);
      if (ln < 1e-14 || dot < 0.25 * lo * ln) { ok = false; break; }
    }
    if (!ok) continue;
    // 執行收縮
    for (const f of fu) {
      let hasV = false; for (let k = 0; k < 3; k++) if (F[f * 3 + k] === v) hasV = true;
      if (hasV) { alive[f] = 0; faces--; continue; }
      for (let k = 0; k < 3; k++) if (F[f * 3 + k] === u) F[f * 3 + k] = v;
      vf[v].push(f);
    }
    dead[u] = 1;
    for (let i = 0; i < 10; i++) Q[v * 10 + i] += Q[u * 10 + i];
    ver[v]++;
    const nb = new Set();
    for (const f of vf[v]) if (alive[f]) for (let k = 0; k < 3; k++) { const w = F[f * 3 + k]; if (w !== v) nb.add(w); }
    vf[v] = vf[v].filter((f) => alive[f]);
    for (const w of nb) { ver[w]++; }
    for (const w of nb) pushEdge(v, w);
    // 鄰點的其他邊也要重算（版本已變）
    for (const w of nb) { const nb2 = new Set(); for (const f of vf[w]) if (alive[f]) for (let k = 0; k < 3; k++) { const x = F[f * 3 + k]; if (x !== w && x !== v) nb2.add(x); } for (const x of nb2) pushEdge(w, x); }
  }
  // 壓縮
  const remap = new Int32Array(nv).fill(-1); let n = 0; const idx = [];
  for (let f = 0; f < nf; f++) if (alive[f]) for (let k = 0; k < 3; k++) { const v = F[f * 3 + k]; if (remap[v] < 0) remap[v] = n++; idx.push(remap[v]); }
  const out = {};
  for (const name of Object.keys(geo.attributes)) {
    const a = geo.attributes[name], s = a.itemSize, src = a.array, dst = new Float32Array(n * s);
    for (let v = 0; v < nv; v++) if (remap[v] >= 0) for (let i = 0; i < s; i++) dst[remap[v] * s + i] = src[v * s + i];
    out[name] = { s, a: dst };
  }
  return { attrs: out, index: idx, n };
}

/* ---------------- 編碼 ---------------- */
function encode(seg, pal) {
  const { attrs, index, n } = seg;
  const pos = attrs.position.a, nor = attrs.normal.a, cA = attrs.color.a, cB = attrs.aColB.a, mat = attrs.aMat.a, edge = attrs.aEdge.a, ao = attrs.aAO.a;
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (let v = 0; v < n; v++) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], pos[v * 3 + i]); hi[i] = Math.max(hi[i], pos[v * 3 + i]); }
  const sz = hi.map((h, i) => Math.max(1e-6, h - lo[i]));
  const head = new Float32Array([n, index.length, ...lo, ...sz]);
  const body = new Uint8Array(n * 13);
  const dv = new DataView(body.buffer);
  const palIdx = (r, g, b) => { const hex = (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255); let i = pal.indexOf(hex); if (i < 0) { i = pal.length; pal.push(hex); } return i; };
  for (let v = 0; v < n; v++) {
    const o = v * 13;
    for (let i = 0; i < 3; i++) dv.setUint16(o + i * 2, Math.round(((pos[v * 3 + i] - lo[i]) / sz[i]) * 65535), true);
    // 八面體法線編碼
    let x = nor[v * 3], y = nor[v * 3 + 1], z = nor[v * 3 + 2]; const l1 = Math.abs(x) + Math.abs(y) + Math.abs(z) || 1; x /= l1; y /= l1; z /= l1;
    if (z < 0) { const ox = x; x = (1 - Math.abs(y)) * Math.sign(ox || 1); y = (1 - Math.abs(ox)) * Math.sign(y || 1); }
    dv.setInt8(o + 6, Math.round(x * 127)); dv.setInt8(o + 7, Math.round(y * 127));
    body[o + 8] = palIdx(cA[v * 3], cA[v * 3 + 1], cA[v * 3 + 2]);
    body[o + 9] = palIdx(cB[v * 3], cB[v * 3 + 1], cB[v * 3 + 2]);
    body[o + 10] = (Math.round(mat[v * 2]) & 15) | ((Math.round(mat[v * 2 + 1]) & 15) << 4);
    dv.setInt8(o + 11, Math.max(-127, Math.min(127, Math.round(edge[v] / 0.05 * 127))));
    body[o + 12] = Math.round(Math.max(0, Math.min(1, ao[v])) * 255);
  }
  const ix = new Uint16Array(index);
  return [new Uint8Array(head.buffer), body, new Uint8Array(ix.buffer)];
}

const t0 = Date.now();
const all = {};
let totalBytes = 0;
for (const id of Object.keys(PROPS)) {
  const d = { ...PROPS[id] }; d.torso = d.H - d.L - d.hr * 1.95 - 0.04; d.upper = d.torso * 0.5; d.lower = d.torso * 0.47; d.thighLen = d.L * 0.5; d.shinLen = d.L * 0.44;
  const parts = buildHeroLive(id, d);
  const pal = [], names = [], chunks = [];
  let tris = 0;
  const add = (name, geo) => {
    if (!geo) return;
    const tgt = SEGMENT_TARGETS(name);
    const seg = decimate(geo, tgt);
    const s = seg.attrs ? seg : { attrs: Object.fromEntries(Object.entries(geo.attributes).map(([k, a]) => [k, { s: a.itemSize, a: a.array }])), index: Array.from(geo.index.array), n: geo.attributes.position.count };
    names.push(name); chunks.push(...encode(s, pal));
    if (!name.startsWith('head_ssj')) tris += s.index.length / 3;
  };
  for (const f in parts.heads) add('head_' + f, parts.heads[f].main);
  for (const k of ['torso', 'hips', 'upperL', 'upperR', 'foreL', 'foreR', 'thighL', 'thighR', 'shinL', 'shinR', 'sword', 'sheath']) add(k, parts[k]);
  (parts.sash || []).forEach((g, i) => add('sash' + i, g));
  (parts.tail || []).forEach((g, i) => add('tail' + i, g));
  const len = chunks.reduce((a, c) => a + c.length + ((4 - (c.length % 4)) % 4), 0);
  const buf = new Uint8Array(len); let o = 0;
  for (const c of chunks) { buf.set(c, o); o += c.length + ((4 - (c.length % 4)) % 4); }
  const z = zlibSync(buf, { level: 9 });
  totalBytes += z.length;
  all[id] = { names, pal, faceRect: parts.faceRect, data: Buffer.from(z).toString('base64') };
  console.log(id, 'tris', tris, 'raw', (buf.length / 1024).toFixed(0) + 'KB', 'zlib', (z.length / 1024).toFixed(0) + 'KB');
}
const out = resolve(dirname(fileURLToPath(import.meta.url)), 'models-baked.js');
writeFileSync(out, `// 由 models-bake.mjs 產生，請勿手改。英雄各部件的減面網格（量化＋zlib＋base64）。\nexport const BAKED = ${JSON.stringify(all)};\n`);
console.log('寫入', out, (totalBytes / 1024).toFixed(0) + 'KB', '耗時', ((Date.now() - t0) / 1000).toFixed(1) + 's');
