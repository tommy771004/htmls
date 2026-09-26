// 特斯拉 Model Y 的 LEGO 模型（1:30，8 凸點寬、20 凸點長、軸距 12 凸點）。
// 車身先用體素（1 凸點 × 1 凸點 × 1 薄板高）描出形狀，再由拼砌器挑現行零件填滿、錯開接縫；
// 斜面、平滑片、底盤與輪子等造型零件手工放置。最後由排程器決定組裝順序，並分成說明書的步驟。
// 座標：LDraw 慣例，y 向下為正；車頭朝 +x，車寬沿 z。高度以「離地 LDU」描述，1 LDU = 0.4 mm。
// 用法：LDRAW_DIR=... node design.mjs ../model-y.ldr
import fs from 'node:fs';
import path from 'node:path';
import { partGeom, ldrawFileFor } from './parts.mjs';
import { formatLine } from './ldr.mjs';
import { worldPart, findConnections, insertion, r3 } from './geom.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const avail = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'availability.json'), 'utf8'));
const available = (id, color) => (avail.combos[id + '|' + color]?.sets || 0) >= 2;

const C = { white: 15, black: 0, dbg: 72, tan: 19, trClear: 47, trRed: 36 };
const PLATE = { '1x1': '3024', '1x2': '3023', '1x3': '3623', '1x4': '3710', '1x5': '78329', '1x6': '3666', '1x8': '3460', '1x10': '4477', '2x2': '3022', '2x3': '3021', '2x4': '3020', '2x6': '3795', '2x8': '3034', '2x10': '3832', '2x12': '2445', '4x4': '3031', '4x6': '3032', '4x8': '3035', '4x10': '3030', '4x12': '3029', '6x6': '3958', '6x8': '3036', '6x10': '3033', '6x12': '3028', '6x14': '3456', '6x16': '3027', '8x8': '41539' };
const BRICK = { '1x1': '3005', '1x2': '3004', '1x3': '3622', '1x4': '3010', '1x6': '3009', '1x8': '3008', '2x2': '3003', '2x3': '3002', '2x4': '3001', '2x6': '2456' };
const TILE = { '1x1': '3070b', '1x2': '3069b', '1x3': '63864', '1x4': '2431', '1x6': '6636', '1x8': '4162', '2x2': '3068b', '2x3': '26603', '2x4': '87079', '2x6': '69729' };

// ---------- 放置工具 ----------
function rotY(deg) {
  const r = (deg * Math.PI) / 180, c = Math.round(Math.cos(r)), s = Math.round(Math.sin(r));
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}
function rotBox(R, lo, hi) {
  const out = { lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] };
  for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) {
    const p = [R[0] * x + R[1] * y + R[2] * z, R[3] * x + R[4] * y + R[5] * z, R[6] * x + R[7] * y + R[8] * z];
    for (let k = 0; k < 3; k++) { out.lo[k] = Math.min(out.lo[k], p[k]); out.hi[k] = Math.max(out.hi[k], p[k]); }
  }
  return out;
}
const X = (col) => -200 + 20 * col;   // col 0..19：車尾 → 車頭
const Z = (row) => -80 + 20 * row;    // row 0..7：左 → 右
const parts = [];                      // { id, color, m, phase, tiled }
function putRaw(id, color, pos, R, phase) {
  if (!available(id, color)) throw new Error(`零件 ${id} 顏色 ${color} 沒有現行供貨紀錄`);
  parts.push({ id, color, file: ldrawFileFor(id), m: [R[0], R[1], R[2], pos[0], R[3], R[4], R[5], pos[1], R[6], R[7], R[8], pos[2]], phase });
}
// 以佔地最小角 (x0, z0)、底面離地高度放零件；rot 為繞 y 旋轉角度
function put(id, color, x0, z0, bottom, rot, phase = 'body') {
  const g = partGeom(ldrawFileFor(id));
  const R = rotY(rot);
  const b = rotBox(R, g.lo, g.hi);
  putRaw(id, color, [x0 - b.lo[0], -bottom - b.hi[1], z0 - b.lo[2]], R, phase);
}
function sized(table, nx, nz) {
  const id = table[Math.min(nx, nz) + 'x' + Math.max(nx, nz)];
  if (!id) return null;
  const g = partGeom(ldrawFileFor(id));
  return { id, rot: Math.round((g.hi[0] - g.lo[0]) / 20) === nx ? 0 : 90 };
}
const tile = (color, col, row, nx, nz, bottom) => { const s = sized(TILE, nx, nz); put(s.id, color, X(col), Z(row), bottom, s.rot); };
// 斜面零件朝 dir 下斜：front = +x、rear = -x、left = -z、right = +z
const SLOPE_ROT = { left: 0, front: 270, rear: 90, right: 180 };
const slope = (id, color, col, row, bottom, dir) => put(id, color, X(col), Z(row), bottom, SLOPE_ROT[dir]);

// ================= 手工零件 =================
// 高度規劃（離地 LDU）：輪軸 30、輪胎頂 60、底板 40–48、腰線 88、車頂 136（實車 1,624 mm ÷ 30 ≈ 54 mm = 135 LDU）
// 底盤
put('3027', C.black, X(2), Z(1), 40, 0, 'chassis');                 // 6×16 底板
for (const col of [15, 3]) put('3001', C.dbg, X(col), Z(2), 16, 90, 'chassis');  // 軸磚凹槽裡的 2×4 墊高磚
for (const cx of [120, -120]) put('3668', C.dbg, cx - 20, -60, 8, 90, 'chassis');
// 引擎蓋：4×2 曲面磚從 64 往車頭下斜
for (const row of [0, 2, 4, 6]) slope('93606', C.white, 16, row, 64, 'front');
// 擋風玻璃：兩段，下段 33° 斜面、上段曲面銜接車頂；全寬 8 凸點，兩側用 1 凸點寬的同款零件
for (const row of [1, 3, 5]) slope('3298', C.black, 13, row, 88, 'front');
for (const row of [0, 7]) slope('4286', C.black, 13, row, 88, 'front');
for (const row of [1, 3, 5]) slope('24309', C.black, 11, row, 112, 'front');
for (const row of [0, 7]) slope('50950', C.black, 11, row, 112, 'front');
// 後擋風玻璃與尾門：白色尾門曲面在下、黑色玻璃曲面在上，形成斜背
for (const row of [1, 3, 5]) slope('24309', C.white, 0, row, 88, 'rear');
for (const row of [0, 7]) slope('50950', C.white, 0, row, 88, 'rear');
for (const row of [1, 3, 5]) slope('24309', C.black, 2, row, 112, 'rear');
for (const row of [0, 7]) slope('50950', C.black, 2, row, 112, 'rear');
// 全景玻璃車頂，兩側以 30° 斜面收邊（車頂往內收）
for (const col of [5, 7, 9]) tile(C.black, col, 1, 2, 6, 128);
for (const col of [5, 7, 9]) { slope('85984', C.black, col, 0, 120, 'left'); slope('85984', C.black, col, 7, 120, 'right'); }
// 輪子：軸銷插進軸磚兩端的軸孔，輪子套上軸銷。輪子內側面離軸磚 2.5 LDU（軸銷擋環 2 LDU 加 0.5 間隙），
// 軸銷尖端剛好碰到輪轂銷孔底部
for (const cx of [120, -120]) {
  putRaw('3749', C.tan, [cx, -30, 61], rotY(-90), 'wheels');
  putRaw('72206p01', C.dbg, [cx, -30, 78.5], rotY(180), 'wheels');
  putRaw('3749', C.tan, [cx, -30, -61], rotY(90), 'wheels');
  putRaw('72206p01', C.dbg, [cx, -30, -78.5], rotY(0), 'wheels');
}

// ================= 車身體素 =================
// level L 佔高度 [8L, 8L+8]；回傳顏色或 null
const inWell = (c, r) => (r === 0 || r === 7) && ((c >= 2 && c <= 5) || (c >= 14 && c <= 17));
function voxel(c, r, L) {
  const outer = r === 0 || r === 7;
  if (L <= 1 || L >= 16) return null;
  if (inWell(c, r) && L < 8) return null;                                // 輪拱
  const bumperF = c >= 18, bumperR = c <= 1, mid = c >= 6 && c <= 13;
  if (L <= 4) {                                                          // 16–40：保險桿與側裙
    if (bumperF || bumperR || (outer && mid)) return L === 2 ? C.black : C.white;
    return null;
  }
  if (L === 5) {                                                         // 40–48：底板那一層
    if (bumperF || bumperR || (outer && mid)) return C.white;
    return null;                                                         // row 1–6、col 2–17 是底板
  }
  if (L <= 10) {                                                         // 48–88：車身
    if (c >= 16 && L >= 8) return null;                                  // 引擎蓋曲面磚
    if (L === 7 && c === 19) return C.trClear;                          // 車頭燈條
    if (L === 10 && c === 0) return C.trRed;                            // 車尾燈條
    // 車廂中空：中段 row 1–6 在 56–80 不填，後段 row 2–5
    if (L >= 7 && L <= 9 && mid && !outer) return null;
    if (L >= 7 && L <= 9 && c >= 2 && c <= 5 && r >= 2 && r <= 5) return null;
    return C.white;
  }
  // 88 以上：車廂（全寬）
  if (L <= 13) {                                                         // 88–112
    if (c <= 2 || c >= 13) return null;                                  // 尾門曲面、擋風玻璃下段
    if (outer) return C.black;                                           // 側窗
    if ((c >= 3 && c <= 4) || (c >= 11 && c <= 12)) return C.black;      // 上段曲面的支撐
    return null;
  }
  if (L <= 15) {                                                         // 112–128
    if (c < 5 || c > 10) return null;
    if (L === 14 && !outer && r >= 2 && r <= 5) return null;
    return C.black;
  }
  return null;
}

// 手工零件佔用的格子（拼砌器不能用）；底板所在的格子視為承載結構
const reserved = new Set();
const owner = new Map();                // "c,r,L" → 零件序號
const supportedParts = new Set();
parts.forEach((p, i) => {
  const w = worldPart(p, 0);
  for (let c = 0; c < 20; c++) for (let r = 0; r < 8; r++) for (let L = 0; L < 18; L++) {
    const cx = X(c) + 10, cz = Z(r) + 10, cy = -(8 * L + 4);
    if (cx > w.lo[0] && cx < w.hi[0] && cz > w.lo[2] && cz < w.hi[2] && cy > w.lo[1] && cy < w.hi[1]) { reserved.add(`${c},${r},${L}`); if (p.id === '3027') owner.set(`${c},${r},${L}`, i); }
  }
  if (p.id === '3027') supportedParts.add(i);
});

// ---------- 拼砌器：由下往上逐層，貪婪挑最大的零件，並偏好跨過下一層接縫 ----------
function tileLevel(L) {
  const need = (c, r, l) => { const k = `${c},${r},${l}`; return !reserved.has(k) && !owner.has(k) ? voxel(c, r, l) : null; };
  for (;;) {
    let best = null;
    for (let c0 = 0; c0 < 20; c0++) for (let r0 = 0; r0 < 8; r0++) {
      const col = need(c0, r0, L); if (col == null) continue;
      for (const [table, h] of [[BRICK, 3], [PLATE, 1]]) for (const key of Object.keys(table)) {
        const [a, b] = key.split('x').map(Number);
        for (const [nx, nz] of a === b ? [[a, b]] : [[a, b], [b, a]]) {
          if (c0 + nx > 20 || r0 + nz > 8) continue;
          if (!available(table[key], col)) continue;
          let ok = true;
          for (let c = c0; c < c0 + nx && ok; c++) for (let r = r0; r < r0 + nz && ok; r++) for (let l = L; l < L + h && ok; l++) if (need(c, r, l) !== col) ok = false;
          if (!ok) continue;
          // 跨過下一層幾個不同零件（接縫交錯），邊緣和下一層接縫對齊要扣分；
          // 坐在承載結構上（能一路接回底板）大幅加分，同時把吊掛部分綁進承載結構再加分
          const below = new Set();
          let onSupported = 0, onHanging = 0;
          for (let c = c0; c < c0 + nx; c++) for (let r = r0; r < r0 + nz; r++) {
            const o = owner.get(`${c},${r},${L - 1}`); if (o == null) continue;
            below.add(o); if (supportedParts.has(o)) onSupported++; else onHanging++;
          }
          let aligned = 0;
          const seam = (ci, ri, co, ro) => { const a = owner.get(`${ci},${ri},${L - 1}`), b = owner.get(`${co},${ro},${L - 1}`); return a != null && b != null && a !== b; };
          for (let c = c0; c < c0 + nx; c++) { if (seam(c, r0, c, r0 - 1)) aligned++; if (seam(c, r0 + nz - 1, c, r0 + nz)) aligned++; }
          for (let r = r0; r < r0 + nz; r++) { if (seam(c0, r, c0 - 1, r)) aligned++; if (seam(c0 + nx - 1, r, c0 + nx, r)) aligned++; }
          const score = nx * nz * h * 4 + below.size * 25 - aligned * 12 + (h === 3 ? 6 : 0) + (onSupported ? 200 : 0) + (onSupported && onHanging ? 150 : 0);
          if (!best || score > best.score) best = { score, c0, r0, nx, nz, h, col, table };
        }
      }
    }
    if (!best) break;
    const s = sized(best.table, best.nx, best.nz);
    const idx = parts.length;
    put(s.id, best.col, X(best.c0), Z(best.r0), 8 * L, s.rot, 'body');
    parts[idx].tiled = true;
    for (let c = best.c0; c < best.c0 + best.nx; c++) for (let r = best.r0; r < best.r0 + best.nz; r++) if (supportedParts.has(owner.get(`${c},${r},${L - 1}`))) supportedParts.add(idx);
    for (let c = best.c0; c < best.c0 + best.nx; c++) for (let r = best.r0; r < best.r0 + best.nz; r++) for (let l = L; l < L + best.h; l++) owner.set(`${c},${r},${l}`, idx);
  }
}
for (let L = 1; L < 17; L++) tileLevel(L);

// ================= 組裝順序 =================
const PHASE = { chassis: 0, body: 1, wheels: 2 };
const W = parts.map((p, i) => worldPart(p, i));
const CN = findConnections(W);
const placed = new Set();
const order = [];
const bottomOf = (w) => -w.hi[1];
const topOf = (w) => -w.lo[1];
// 凸點接點的上下關係：below[i] = i 下方（i 的凸點孔接到它的凸點）的零件
const below = W.map(() => new Set()), above = W.map(() => new Set());
for (const c of CN.studConns) { below[c.b].add(c.a); above[c.a].add(c.b); }
// 每個零件指定插入方向：D（從上方壓下）或 U（從下方插上）。
// 任何接點都不能是「下方零件 D、上方零件 U」；D 零件要有下方鄰居可接、U 零件要有上方鄰居可接。
// 先把底板往上的閉包設為 D；U 裡面上方沒有任何鄰居的（例如不帶凸點的曲面磚）也改成 D，並往上閉包。
const root = W.find((w) => parts[w.idx].id === '3027').idx;
const techOnly = new Set(W.filter((w) => below[w.idx].size + above[w.idx].size === 0).map((w) => w.idx));
const D = new Set();
const closeUp = (seed) => { for (const q = [seed]; q.length;) { const u = q.pop(); if (D.has(u)) continue; D.add(u); for (const v of above[u]) q.push(v); } };
closeUp(root);
for (let changed = true; changed;) {
  changed = false;
  for (const w of W) { const i = w.idx; if (D.has(i) || techOnly.has(i)) continue; if (above[i].size === 0) { closeUp(i); changed = true; } }
}
const isD = (i) => D.has(i);
function ready(w) {
  const i = w.idx;
  if (techOnly.has(i)) return CN.techConns.some((c) => c.ok && ((c.a === i && placed.has(c.b)) || (c.b === i && placed.has(c.a))));
  if (isD(i)) return [...below[i]].every((j) => !isD(j) || placed.has(j)) && [...below[i]].some((j) => placed.has(j));
  return [...above[i]].every((j) => isD(j) || placed.has(j)) && [...above[i]].some((j) => placed.has(j));
}
placed.add(root); order.push({ idx: root, dir: null });
let lastD = false;
const remaining = new Set(W.map((w) => w.idx)); remaining.delete(root);
while (remaining.size) {
  const minPhase = Math.min(...[...remaining].map((i) => PHASE[parts[i].phase]));
  const cands = [...remaining].map((i) => W[i]).filter((w) => PHASE[parts[w.idx].phase] === minPhase && ready(w));
  // 優先：維持目前方向 → 從上方壓下的零件由低到高、從下方插上的由高到低 → 車頭到車尾
  // 盡量維持同一個方向，減少翻面次數
  cands.sort((a, b) => ((isD(a.idx) !== lastD) - (isD(b.idx) !== lastD)) ||
    (isD(a.idx) ? bottomOf(a) - bottomOf(b) : topOf(b) - topOf(a)) || b.lo[0] - a.lo[0] || a.lo[2] - b.lo[2]);
  let pick = null;
  for (const w of cands) {
    const r = insertion(W, CN, w, placed);
    if (r.ok) { pick = { idx: w.idx, dir: r3(r.dir) }; break; }
  }
  if (!pick) {
    const rest = [...remaining].map((i) => W[i]);
    console.error('排不出順序，剩下', rest.length, '個：', rest.slice(0, 6).map((w) => w.idx + ' ' + parts[w.idx].id + (ready(w) ? ' ' + insertion(W, CN, w, placed).msg : ' 尚未就緒')).join('｜'));
    if (process.env.DEBUG) for (const w of rest) console.error(w.idx, parts[w.idx].id, 'D', isD(w.idx), 'below', [...below[w.idx]].map((j) => j + (placed.has(j) ? '✓' : '') + (isD(j) ? 'D' : 'U')).join(','), 'above', [...above[w.idx]].map((j) => j + (placed.has(j) ? '✓' : '') + (isD(j) ? 'D' : 'U')).join(','), 'bottom', bottomOf(w));
    for (const w2 of rest) { placed.add(w2.idx); order.push({ idx: w2.idx, dir: null }); }
    break;
  }
  placed.add(pick.idx); remaining.delete(pick.idx); order.push(pick);
  if (!techOnly.has(pick.idx)) lastD = isD(pick.idx);
}

// ---------- 分步驟 ----------
function band(bottom) {
  if (bottom < 40) return '保險桿與側裙';
  if (bottom < 56) return '車身底層';
  if (bottom < 88) return '車身與輪拱';
  if (bottom < 112) return '車窗與擋風玻璃';
  if (bottom < 128) return '車頂骨架';
  return '全景玻璃車頂';
}
const steps = [];
for (const o of order) {
  const p = parts[o.idx], w = W[o.idx];
  const up = o.dir && o.dir[1] < -0.5;
  const title = p.phase === 'chassis' ? '底盤' : p.phase === 'wheels' ? '輪子' : band(bottomOf(w));
  const view = up ? 'below' : 'above';
  const last = steps[steps.length - 1];
  const newStep = !last || last.title !== title || last.view !== view || last.parts.length >= 6 || new Set([...last.parts.map((i) => parts[i].id), p.id]).size > 3;
  if (newStep) steps.push({ title, view, parts: [o.idx] }); else last.parts.push(o.idx);
}

// ================= 輸出 =================
const out = ['0 Tesla Model Y - LEGO 1:30', '0 Name: model-y.ldr', '0 Author: htmls 164', '0 !MY META scale 1:30', '0 !MY META source https://www.tesla.com/zh_tw/modely', ''];
steps.forEach((s) => {
  out.push('0 !MY TITLE ' + s.title);
  if (s.view === 'below') out.push('0 !MY META_STEP view below');
  for (const i of s.parts) out.push(formatLine(parts[i]));
  out.push('0 STEP');
});
fs.writeFileSync(process.argv[2], out.join('\n') + '\n');
console.log('steps', steps.length, 'parts', parts.length, 'tiled', parts.filter((p) => p.tiled).length);
