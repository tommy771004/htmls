// 光格島（tools/props.mjs 的 isle_tron）走得上去的資料：步行格、島面補洞、車道圖、家具的位置。
// 都在 place() 擺正、縮放之後跑，座標是輸出的公尺（模型座標：原點是島心，+z 朝南，和頁面的 FAR_SITES.tron 一樣不轉）。
//
// walkGrid：每 res 公尺一格，把朝上（或朝下：原檔有翻面的面）的三角形取樣進格子，記下每格所有表面的高度；
// 一個高度「站得上去」＝它上面 head 公尺內沒有別的表面（長椅底下、樓裡都不算），每格留最低的 layers 個，存成分米的 Int16（-32768 是沒有）。
// 頁面（21-tron.js）照現在的高度 y0 挑「不高於 y0 + 一步」的最高那層；沒有就擋住。牆、樓、護欄靠這個擋，不另外做碰撞盒。
// road(prim) 為真的面（車道）另外記一張車道高度，給 roadGraph 抽中心線。
import { gzipSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { basename } from 'node:path';

const NONE = -32768;

// 從中心往外每個角度找最外面有東西的格子（和 props.mjs 的 addSkirt 一樣的作法），回傳 n 個半徑；inRing 用它判斷一點在不在島內
export function ringOf(prims, { res = 2, n = 720 } = {}) {
  let mn = [1e9, 1e9], mx = [-1e9, -1e9];
  for (const p of prims) for (let i = 0; i < p.cnt; i++) { const x = p.pos[i * 3], z = p.pos[i * 3 + 2]; mn = [Math.min(mn[0], x), Math.min(mn[1], z)]; mx = [Math.max(mx[0], x), Math.max(mx[1], z)]; }
  const W = Math.ceil((mx[0] - mn[0]) / res) + 1, H = Math.ceil((mx[1] - mn[1]) / res) + 1, occ = new Uint8Array(W * H);
  for (const p of prims) for (let t = 0; t < p.idx.length; t += 3) {
    const P = [0, 1, 2].map((k) => { const v = p.idx[t + k]; return [p.pos[v * 3], p.pos[v * 3 + 2]]; });
    const m = Math.max(1, Math.ceil(Math.max(...[[0, 1], [1, 2], [2, 0]].map(([a, b]) => Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1]))) / (res * .7)));
    for (let i = 0; i <= m; i++) for (let j = 0; j <= m - i; j++) {
      const u = i / m, w = j / m, v = 1 - u - w, x = P[0][0] * u + P[1][0] * w + P[2][0] * v, z = P[0][1] * u + P[1][1] * w + P[2][1] * v;
      occ[Math.floor((z - mn[1]) / res) * W + Math.floor((x - mn[0]) / res)] = 1;
    }
  }
  const cx = (mn[0] + mx[0]) / 2, cz = (mn[1] + mx[1]) / 2, R = Math.hypot(mx[0] - mn[0], mx[1] - mn[1]) / 2 + res, r = new Float32Array(n);
  const at = (x, z) => { const X = Math.floor((x - mn[0]) / res), Z = Math.floor((z - mn[1]) / res); return X >= 0 && Z >= 0 && X < W && Z < H && occ[Z * W + X]; };
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    for (let q = R; q > res; q -= res * .5) if (at(cx + dx * q, cz + dz * q)) { r[i] = q - res * .75; break; }
  }
  return { cx, cz, n, r };
}
export const inRing = (g, x, z) => {
  const dx = x - g.cx, dz = z - g.cz, a = (Math.atan2(dz, dx) / (Math.PI * 2) + 1) % 1 * g.n, i = Math.floor(a), f = a - i;
  const r = g.r[i % g.n] * (1 - f) + g.r[(i + 1) % g.n] * f;
  return Math.hypot(dx, dz) < r;
};

// 三角形在 res 的格子裡取樣（細的護欄、燈柱頂也會落進它經過的格子）
function sampleTri(A, B, C, res, fn) {
  const m = Math.max(1, Math.ceil(Math.max(Math.hypot(A[0] - B[0], A[2] - B[2]), Math.hypot(B[0] - C[0], B[2] - C[2]), Math.hypot(C[0] - A[0], C[2] - A[2])) / (res * .6)));
  for (let i = 0; i <= m; i++) for (let j = 0; j <= m - i; j++) {
    const u = i / m, w = j / m, v = 1 - u - w;
    fn(A[0] * u + B[0] * w + C[0] * v, A[1] * u + B[1] * w + C[1] * v, A[2] * u + B[2] * w + C[2] * v);
  }
}

export function walkGrid(prims, { res = .5, skip = () => false, road = () => false, head = 1.9, merge = .12, layers = 3, slots = 12, minNy = .45 } = {}) {
  let mn = [1e9, 1e9], mx = [-1e9, -1e9];
  for (const p of prims) if (!skip(p)) for (let i = 0; i < p.cnt; i++) { const x = p.pos[i * 3], z = p.pos[i * 3 + 2]; mn = [Math.min(mn[0], x), Math.min(mn[1], z)]; mx = [Math.max(mx[0], x), Math.max(mx[1], z)]; }
  const x0 = Math.floor(mn[0]) - 1, z0 = Math.floor(mn[1]) - 1, nx = Math.ceil((mx[0] - x0) / res) + 2, nz = Math.ceil((mx[1] - z0) / res) + 2, N = nx * nz;
  // 每格的表面：朝上的是地板（站得上去的候選），朝下的只算頭頂上的東西（樓底、雨遮、橋底）。朝下的存成負的「旗標」：ys 存高度、up 存是不是朝上
  const ys = new Float32Array(N * slots), up = new Uint8Array(N * slots), cnt = new Uint8Array(N), roadY = new Float32Array(N).fill(NaN);
  let over = 0;
  const put = (k, y, f) => {
    const o = k * slots, c = cnt[k];
    for (let s = 0; s < c; s++) if (up[o + s] === f && Math.abs(ys[o + s] - y) < merge) { if (y > ys[o + s]) ys[o + s] = y; return; }
    if (c < slots) { ys[o + c] = y; up[o + c] = f; cnt[k] = c + 1; return; }
    over++;   // 滿了：換掉最接近的那個（保留比較高的）
    let b = 0; for (let s = 1; s < c; s++) if (Math.abs(ys[o + s] - y) < Math.abs(ys[o + b] - y)) b = s;
    if (y > ys[o + b]) { ys[o + b] = y; up[o + b] = f; }
  };
  const V = (p, v) => [p.pos[v * 3], p.pos[v * 3 + 1], p.pos[v * 3 + 2]];
  for (const p of prims) {
    if (skip(p)) continue;
    const isRoad = road(p);
    for (let t = 0; t < p.idx.length; t += 3) {
      const A = V(p, p.idx[t]), B = V(p, p.idx[t + 1]), C = V(p, p.idx[t + 2]);
      const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
      const ny = uz * vx - ux * vz, l = Math.hypot(uy * vz - uz * vy, ny, ux * vy - uy * vx);
      if (!l || Math.abs(ny) / l < minNy) continue;
      const f = ny > 0 ? 1 : 0;
      sampleTri(A, B, C, res, (x, y, z) => {
        const i = Math.floor((x - x0) / res), j = Math.floor((z - z0) / res);
        if (i < 0 || j < 0 || i >= nx || j >= nz) return;
        const k = j * nx + i;
        put(k, y, f);
        if (isRoad && f && !(roadY[k] >= y)) roadY[k] = y;
      });
    }
  }
  // 每格：排序，站得上去的層（上面 head 內沒有別的面）留最低的 layers 個
  const L = Array.from({ length: layers }, () => new Int16Array(N).fill(NONE));
  const tmp = [];
  let multi = 0;
  for (let k = 0; k < N; k++) {
    const c = cnt[k]; if (!c) continue;
    tmp.length = 0; for (let s = 0; s < c; s++) tmp.push([ys[k * slots + s], up[k * slots + s]]);
    tmp.sort((a, b) => a[0] - b[0]);
    let n = 0;
    for (let s = 0; s < c && n < layers; s++) {
      if (!tmp[s][1]) continue;
      let q = s + 1; while (q < c && tmp[q][0] - tmp[s][0] < merge) q++;   // 和地板幾乎同高的朝下面（同一片板子的底）不算頭頂
      if (q === c || tmp[q][0] - tmp[s][0] >= head) L[n++][k] = Math.round(tmp[s][0] * 10);
    }
    if (n > 1) multi++;
  }
  const probe = (x, z) => { const k = Math.floor((z - z0) / res) * nx + Math.floor((x - x0) / res); const o = []; for (let q = 0; q < cnt[k]; q++) o.push((up[k * slots + q] ? '+' : '-') + ys[k * slots + q].toFixed(2)); return o.join(' ') + ' => ' + L.map((a) => a[k]).join(','); };
  console.log(`  步行格：${nx}×${nz}（${res} m），${multi} 格有兩層以上${over ? `，${over} 次超過 ${slots} 個表面` : ''}`);
  return { x0, z0, res, nx, nz, L, roadY, cnt, probe };
}

// 陸地：2 m 一格，有任何東西的格子是陸地；從外框往內灌水（四連通，經過沒有東西的格子），灌不到的空格是被樓圍起來的空地，也算陸地。
// 細縫（不到一格寬）在 2 m 的格子裡會被封住，水灌不進街區之間
export function landMask(G, prims, { res = 2 } = {}) {
  const nx = Math.ceil(G.nx * G.res / res) + 2, nz = Math.ceil(G.nz * G.res / res) + 2, x0 = G.x0 - res, z0 = G.z0 - res, occ = new Uint8Array(nx * nz);
  for (let j = 0; j < G.nz; j++) for (let i = 0; i < G.nx; i++) if (G.cnt[j * G.nx + i]) occ[Math.floor((j * G.res + G.res / 2) / res + 1) * nx + Math.floor((i * G.res + G.res / 2) / res + 1)] = 1;
  const sea = new Uint8Array(nx * nz), st = [];
  for (let i = 0; i < nx; i++) st.push(i, (nz - 1) * nx + i);
  for (let j = 0; j < nz; j++) st.push(j * nx, j * nx + nx - 1);
  while (st.length) {
    const k = st.pop(); if (sea[k] || occ[k]) continue;
    sea[k] = 1; const i = k % nx, j = (k / nx) | 0;
    if (i > 0) st.push(k - 1); if (i < nx - 1) st.push(k + 1); if (j > 0) st.push(k - nx); if (j < nz - 1) st.push(k + nx);
  }
  const land = new Uint8Array(nx * nz); for (let k = 0; k < nx * nz; k++) land[k] = sea[k] ? 0 : 1;
  // 遊程編碼（從 0 開始交替的長度，36 進位）給頁面同步判斷（props.json）
  const runs = []; let cur = 0, n = 0;
  for (let k = 0; k < nx * nz; k++) { if (land[k] !== cur) { runs.push(n.toString(36)); n = 0; cur = land[k]; } n++; }
  runs.push(n.toString(36));
  let area = 0; for (const v of land) area += v;
  console.log(`  陸地：${nx}×${nz}（${res} m），${(area * res * res / 1e4).toFixed(1)} 公頃`);
  return { x0, z0, res, nx, nz, land, rle: runs.join(',') };
}
export const onLand = (M, x, z) => { const i = Math.floor((x - M.x0) / M.res), j = Math.floor((z - M.z0) / M.res); return i >= 0 && j >= 0 && i < M.nx && j < M.nz && M.land[j * M.nx + i] === 1; };

// 陸地裡沒有任何表面的步行格（被樓圍起來的空地）：補一片 y = h 的島面，同時寫進步行格。回傳要加進模型的 primitive（每列連續的格子合成一條長方形）
export function capHoles(G, M, h, mat) {
  const { x0, z0, res, nx, nz, L, cnt } = G, pos = [], nor = [], idx = [];
  let n = 0;
  for (let j = 0; j < nz; j++) {
    let run = -1;
    const flush = (i1) => {
      if (run < 0) return;
      const xa = x0 + run * res, xb = x0 + i1 * res, za = z0 + j * res, zb = za + res, q = pos.length / 3;
      pos.push(xa, h, za, xb, h, za, xb, h, zb, xa, h, zb); nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
      idx.push(q, q + 2, q + 1, q, q + 3, q + 2);
      run = -1;
    };
    for (let i = 0; i <= nx; i++) {
      const k = j * nx + i, hole = i < nx && !cnt[k] && onLand(M, x0 + (i + .5) * res, z0 + (j + .5) * res);
      if (hole) { L[0][k] = Math.round(h * 10); n++; if (run < 0) run = i; } else flush(i);
    }
  }
  console.log(`  島面補洞：${n} 格（${(n * res * res / 1e4).toFixed(1)} 公頃）`);
  return { node: 'cap', path: 'cap', mat, pos: Float32Array.from(pos), nor: Float32Array.from(nor), uv: null, idx: Uint32Array.from(idx), cnt: pos.length / 3 };
}
// 岸壁：陸地與海相鄰的每條格邊，從 top 垂直往下到 bottom 的一片牆（朝海）；edges 回傳岸線的線段 [[x0, z0, x1, z1]…]（頁面沿著擺護岸燈）
export function seaWall(M, top, bottom, mat) {
  const pos = [], nor = [], idx = [], edges = [], { x0, z0, res, nx, nz, land } = M;
  const at = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz && land[j * nx + i] === 1;
  const quad = (ax, az, bx, bz, ox, oz) => {
    const q = pos.length / 3;
    pos.push(ax, top, az, bx, top, bz, bx, bottom, bz, ax, bottom, az); for (let k = 0; k < 4; k++) nor.push(ox, 0, oz);
    idx.push(q, q + 1, q + 2, q, q + 2, q + 3);
    edges.push([ax, az, bx, bz]);
  };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    if (!at(i, j)) continue;
    const xa = x0 + i * res, xb = xa + res, za = z0 + j * res, zb = za + res;
    if (!at(i, j - 1)) quad(xb, za, xa, za, 0, -1);
    if (!at(i, j + 1)) quad(xa, zb, xb, zb, 0, 1);
    if (!at(i - 1, j)) quad(xa, za, xa, zb, -1, 0);
    if (!at(i + 1, j)) quad(xb, zb, xb, za, 1, 0);
  }
  // 同一直線上相連的線段接起來（燈的間距照長度算）
  const merged = [];
  for (const e of edges.sort((a, b) => a[1] === a[3] ? (b[1] === b[3] ? a[1] - b[1] || Math.min(a[0], a[2]) - Math.min(b[0], b[2]) : -1) : (b[1] === b[3] ? 1 : a[0] - b[0] || Math.min(a[1], a[3]) - Math.min(b[1], b[3])))) {
    const h = e[1] === e[3], lo = h ? Math.min(e[0], e[2]) : Math.min(e[1], e[3]), hi = lo + res, m = merged[merged.length - 1];
    if (m && m.h === h && m.c === (h ? e[1] : e[0]) && Math.abs(m.hi - lo) < 1e-6) m.hi = hi; else merged.push({ h, c: h ? e[1] : e[0], lo, hi });
  }
  console.log(`  岸壁：${edges.length} 段格邊，合成 ${merged.length} 條`);
  const prim = { node: 'seawall', path: 'seawall', mat, pos: Float32Array.from(pos), nor: Float32Array.from(nor), uv: null, idx: Uint32Array.from(idx), cnt: pos.length / 3 };
  return { prim, edges: merged.map((m) => (m.h ? [m.lo, m.c, m.hi, m.c] : [m.c, m.lo, m.c, m.hi]).map((v) => +v.toFixed(1))) };
}

// 寫成頁面讀的二進位檔（gzip）：前 4 bytes 是 JSON 標頭長度，接著標頭，再來是 layers 個 Int16Array（對齊 2 bytes）
export function packWalk(G) {
  const head = Buffer.from(JSON.stringify({ x0: G.x0, z0: G.z0, res: G.res, nx: G.nx, nz: G.nz, layers: G.L.length }));
  const pad = (4 + head.length) % 2, len = Buffer.alloc(4); len.writeUInt32LE(head.length + pad);
  return gzipSync(Buffer.concat([len, head, Buffer.alloc(pad, 32), ...G.L.map((a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength))]), { level: 9 });
}

// 車道中心線：車道格降到 1 m，Zhang-Suen 細線化，再追成圖（端點、路口是節點，中間是折線）；短於 spur 的分岔剪掉，折線用 Douglas-Peucker 簡化。
// 回傳 { nodes: [[x, y, z]…], edges: [[a, b, [[x, y, z]…]]…] }（折線含兩端點）
export function roadGraph(G, { cell = 1, spur = 12, eps = .6, close = 3 } = {}) {
  const f = Math.round(cell / G.res), W = Math.floor(G.nx / f), H = Math.floor(G.nz / f), m = new Uint8Array(W * H), yv = new Float32Array(W * H).fill(NaN);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    let c = 0, y = -1e9;
    for (let b = 0; b < f; b++) for (let a = 0; a < f; a++) { const v = G.roadY[(j * f + b) * G.nx + i * f + a]; if (v === v) { c++; y = Math.max(y, v); } }
    if (c * 2 >= f * f) { m[j * W + i] = 1; yv[j * W + i] = y; }
  }
  // 補小洞（車道上的人孔蓋、斑馬線換材質的地方）：四周八格有六格以上是車道的格子算車道
  for (let pass = 0; pass < 2; pass++) for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
    const k = j * W + i; if (m[k]) continue;
    let c = 0, y = -1e9; for (const [a, b] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) { const q = (j + b) * W + i + a; if (m[q]) { c++; y = Math.max(y, yv[q]); } }
    if (c >= 6) { m[k] = 1; yv[k] = y; }
  }
  // 閉運算（先膨脹再侵蝕 close 格）：可動橋與路面接縫、路口拼塊之間幾公尺的缺口接起來；新補的格子高度取附近車道的最高值
  if (close) {
    const dil = (src, val) => { const o = new Uint8Array(W * H); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { let hit = !val; for (let b = -close; b <= close && hit !== val; b++) for (let a = -close; a <= close; a++) { const x = i + a, z = j + b; if (x < 0 || z < 0 || x >= W || z >= H) continue; if (!!src[z * W + x] === val) { hit = val; break; } } o[j * W + i] = hit ? 1 : 0; } return o; };
    const d = dil(m, true), e = dil(d, false);
    for (let k = 0; k < W * H; k++) if (e[k] && !m[k]) {
      const i = k % W, j = (k / W) | 0; let y = -1e9;
      for (let b = -close * 2; b <= close * 2; b++) for (let a = -close * 2; a <= close * 2; a++) { const x = i + a, z = j + b; if (x >= 0 && z >= 0 && x < W && z < H && m[z * W + x]) y = Math.max(y, yv[z * W + x]); }
      m[k] = 1; yv[k] = y;
    }
  }
  const N8 = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  const px = (i, j) => (i < 0 || j < 0 || i >= W || j >= H ? 0 : m[j * W + i]);
  for (let changed = 1; changed;) {
    changed = 0;
    for (const step of [0, 1]) {
      const del = [];
      for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
        if (!m[j * W + i]) continue;
        const P = N8.map(([a, b]) => px(i + a, j + b)), B = P.reduce((s, v) => s + v, 0);
        if (B < 2 || B > 6) continue;
        let A = 0; for (let q = 0; q < 8; q++) if (!P[q] && P[(q + 1) % 8]) A++;
        if (A !== 1) continue;
        if (step === 0 ? P[0] * P[2] * P[4] || P[2] * P[4] * P[6] : P[0] * P[2] * P[6] || P[0] * P[4] * P[6]) continue;
        del.push(j * W + i);
      }
      for (const k of del) m[k] = 0;
      if (del.length) changed = 1;
    }
  }
  const deg = (k) => { const i = k % W, j = (k / W) | 0; let d = 0; for (const [a, b] of N8) d += px(i + a, j + b); return d; };
  const nbr = (k) => { const i = k % W, j = (k / W) | 0, o = []; for (const [a, b] of N8) if (px(i + a, j + b)) o.push((j + b) * W + i + a); return o; };
  // 追線：從每個節點格（度數不是 2）出發沿著度數 2 的格子走到下一個節點格
  const isNode = (k) => deg(k) !== 2;
  const nodeOf = new Map(), nodes = [], edges = [], used = new Set();
  const nodeId = (k) => { if (!nodeOf.has(k)) { nodeOf.set(k, nodes.length); nodes.push(k); } return nodeOf.get(k); };
  const key = (a, b) => a < b ? a + ',' + b : b + ',' + a;
  for (let k = 0; k < W * H; k++) {
    if (!m[k] || !isNode(k)) continue;
    for (const n0 of nbr(k)) {
      if (used.has(key(k, n0))) continue;
      const path = [k]; let prev = k, cur = n0;
      used.add(key(k, n0));
      while (!isNode(cur)) {
        path.push(cur);
        const nx = nbr(cur).filter((q) => q !== prev && !used.has(key(cur, q)));
        if (!nx.length) break;
        used.add(key(cur, nx[0])); prev = cur; cur = nx[0];
      }
      path.push(cur);
      if (path.length > 2 || cur !== k) edges.push({ a: nodeId(k), b: nodeId(cur), path });
    }
  }
  // 剪短分岔：一端是度數 1 的節點、長度短於 spur 的邊（重複到沒有可剪的）
  const pt = (k) => [G.x0 + ((k % W) + .5) * cell, (yv[k] === yv[k] ? yv[k] : 0), G.z0 + (((k / W) | 0) + .5) * cell];
  const len = (e) => { let s = 0; for (let q = 1; q < e.path.length; q++) { const a = pt(e.path[q - 1]), b = pt(e.path[q]); s += Math.hypot(a[0] - b[0], a[2] - b[2]); } return s; };
  // 細線化在路口留下兩三個相鄰的節點格，中間是一兩格長的邊：短於 4 m 的邊兩端併成同一個節點（union-find），自己接自己的短邊丟掉
  const par = new Map(), find = (n) => { while (par.has(n) && par.get(n) !== n) n = par.get(n); return n; };
  for (const e of edges) if (len(e) < 4) { const a = find(e.a), b = find(e.b); if (a !== b) par.set(b, a); }
  for (let q = edges.length - 1; q >= 0; q--) { const e = edges[q]; e.a = find(e.a); e.b = find(e.b); if (e.a === e.b && len(e) < 4) edges.splice(q, 1); }
  for (let again = 1; again;) {
    again = 0;
    const dn = new Map(); for (const e of edges) { dn.set(e.a, (dn.get(e.a) || 0) + 1); dn.set(e.b, (dn.get(e.b) || 0) + 1); }
    for (let q = edges.length - 1; q >= 0; q--) { const e = edges[q]; if ((dn.get(e.a) === 1 || dn.get(e.b) === 1) && e.a !== e.b && len(e) < spur && (dn.get(e.a) > 1 || dn.get(e.b) > 1)) { edges.splice(q, 1); again = 1; break; } }
    if (again) continue;
    // 度數 2 的節點（剪掉分岔之後）：把兩條邊接起來
    for (const [n, d] of dn) {
      if (d !== 2) continue;
      const es = edges.filter((e) => e.a === n || e.b === n);
      if (es.length !== 2 || es[0] === es[1]) continue;
      const [e1, e2] = es, p1 = e1.b === n ? e1.path : e1.path.slice().reverse(), p2 = e2.a === n ? e2.path : e2.path.slice().reverse();
      const a = e1.b === n ? e1.a : e1.b, b = e2.a === n ? e2.b : e2.a;
      if (a === n || b === n) continue;
      edges.splice(edges.indexOf(e1), 1); edges.splice(edges.indexOf(e2), 1);
      edges.push({ a, b, path: [...p1, ...p2.slice(1)] }); again = 1; break;
    }
  }
  const dp = (P) => {   // Douglas-Peucker（只看水平）
    if (P.length < 3) return P;
    const [a, b] = [P[0], P[P.length - 1]], L = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1e-9;
    let w = 0, wi = 0;
    for (let q = 1; q < P.length - 1; q++) { const d = Math.abs((b[0] - a[0]) * (a[2] - P[q][2]) - (a[0] - P[q][0]) * (b[2] - a[2])) / L; if (d > w) { w = d; wi = q; } }
    return w > eps ? [...dp(P.slice(0, wi + 1)).slice(0, -1), ...dp(P.slice(wi))] : [a, b];
  };
  const live = new Set(edges.flatMap((e) => [e.a, e.b])), remap = new Map();
  const outN = [...live].map((n, i) => { remap.set(n, i); return pt(nodes[n]).map((v) => +v.toFixed(2)); });
  // 折線的兩端換成（併過之後的）節點位置
  const outE = edges.map((e) => { const P = dp(e.path.map(pt)); P[0] = outN[remap.get(e.a)]; P[P.length - 1] = outN[remap.get(e.b)]; return [remap.get(e.a), remap.get(e.b), P.map((p) => p.map((v) => +v.toFixed(2)))]; });
  const cp = outN.map((_, i) => i), cf = (i) => { while (cp[i] !== i) i = cp[i] = cp[cp[i]]; return i; };
  for (const [a, b] of outE) cp[cf(a)] = cf(b);
  const comp = new Map(); outE.forEach(([a], i) => { const r = cf(a); comp.set(r, (comp.get(r) || 0) + len(edges[i])); });
  console.log(`  車道圖：${outN.length} 個節點、${outE.length} 條邊，總長 ${Math.round(edges.reduce((s, e) => s + len(e), 0))} m，${comp.size} 塊連通（${[...comp.values()].map(Math.round).sort((a, b) => b - a).join('／')} m）`);
  return { nodes: outN, edges: outE };
}

// 家具的位置：每個符合 re 的原檔物件（路徑裡第一個符合的節點名）一筆 [x, 底面 y, z, 朝向, 長, 寬, 高]；朝向是長邊的方向（0＝沿 z）
export function marks(prims, re) {
  const g = new Map();
  for (const p of prims) {
    const seg = p.path.split('/'), i = seg.findIndex((s) => re.test(s)); if (i < 0) continue;
    const name = seg.slice(0, i + 1).join('/');   // 同名的原件有好幾份：照整條路徑分
    if (!g.has(name)) g.set(name, []);
    g.get(name).push(p);
  }
  return [...g.values()].map((ps) => {
    let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], C = [0, 0, 0, 0], cx = 0, cz = 0, n = 0;
    for (const p of ps) for (let i = 0; i < p.cnt; i++) { for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p.pos[i * 3 + k]); mx[k] = Math.max(mx[k], p.pos[i * 3 + k]); } cx += p.pos[i * 3]; cz += p.pos[i * 3 + 2]; n++; }
    cx /= n; cz /= n;
    for (const p of ps) for (let i = 0; i < p.cnt; i++) { const dx = p.pos[i * 3] - cx, dz = p.pos[i * 3 + 2] - cz; C[0] += dx * dx; C[1] += dx * dz; C[2] += dz * dz; }
    const a = .5 * Math.atan2(2 * C[1], C[0] - C[2]), ux = Math.cos(a), uz = Math.sin(a);   // 水平主軸
    let l0 = 1e9, l1 = -1e9, w0 = 1e9, w1 = -1e9;
    for (const p of ps) for (let i = 0; i < p.cnt; i++) { const dx = p.pos[i * 3] - cx, dz = p.pos[i * 3 + 2] - cz, s = dx * ux + dz * uz, t = -dx * uz + dz * ux; l0 = Math.min(l0, s); l1 = Math.max(l1, s); w0 = Math.min(w0, t); w1 = Math.max(w1, t); }
    const mid = [cx + ux * (l0 + l1) / 2 - uz * (w0 + w1) / 2, cz + uz * (l0 + l1) / 2 + ux * (w0 + w1) / 2];
    return [mid[0], mn[1], mid[1], Math.atan2(ux, uz), l1 - l0, w1 - w0, mx[1] - mn[1]].map((v) => +v.toFixed(2));
  });
}

// props.mjs 的 tron 選項：擺正縮放之後的整座島。回傳 { prims, dims }：prims 補上島面與岸壁、拿掉 cut 的部分（光速機車、水面、光束另外放）；
// dims 給 props.json：land（陸地遊程編碼）、edges（岸線）、dock（北端那條路的盡頭）；walk 為真時另外寫步行格檔、車道圖與家具位置
export function tronData(prims, { walk, cut, file, mat }) {
  const skip = (p) => /(^|\/)(SM_TEST_Tree|Point|Icosphere)/.test(p.path) || /M_Foliage|Leaves|^M_Tree/.test(p.mat ? p.mat.getName() : '') || (cut && cut.test(p.path));
  const G = walkGrid(prims, { skip, road: (p) => /Hexagon_Ground/.test(p.mat ? p.mat.getName() : ''), slots: 20 });
  const dims = {};
  if (walk) {
    const mk = (re) => marks(prims, re);
    Object.assign(dims, { vend: mk(/^PF_Vending_Machine/), bench: mk(/^PF_(Bench_Street|City_Bench)/), tree: mk(/^(SM_TEST_Tree|Point|Icosphere)/), lamp: mk(/^PF_LampPost/),
      cycle: mk(/^PF_TronCycle/), pool: mk(/^Water_Plane/), shop: mk(/^PF_Console_Shop_Freestanding/) });
  }
  const M = landMask(G, prims), cap = capHoles(G, M, -.2, mat('cap', [.012, .014, .02])), wall = seaWall(M, -.12, -9, mat('seawall', [.02, .022, .028]));
  const out = (cut ? prims.filter((p) => !cut.test(p.path)) : prims).concat([cap, wall.prim]);
  // 碼頭：海拔 0 附近的車道格裡最北（z 最小）的那一格
  let dock = null;
  for (let j = 0; j < G.nz && !dock; j++) for (let i = 0; i < G.nx; i++) { const y = G.roadY[j * G.nx + i]; if (y > -1 && y < 1) { let n = 0; while (i + n < G.nx && G.roadY[j * G.nx + i + n] > -1) n++; dock = [+(G.x0 + (i + n / 2) * G.res).toFixed(2), +(G.z0 + j * G.res).toFixed(2)]; break; } }
  Object.assign(dims, { land: { x0: M.x0, z0: M.z0, res: M.res, nx: M.nx, nz: M.nz, rle: M.rle }, edges: wall.edges, dock });
  if (walk) {
    writeFileSync(file, packWalk(G));
    dims.walk = { file: basename(file), x0: G.x0, z0: G.z0, res: G.res, nx: G.nx, nz: G.nz, layers: G.L.length };
    dims.graph = roadGraph(G);
    // 升降梯：上層（約 0 m）與下層街區（低於 -5 m）各取最大一塊連通的地面（最低那層、相鄰格高差不到半公尺算連通），
    // 兩塊之間水平距離最近的一對格子（每 4 m 取一格比）
    const N = G.nx * G.nz, comp = new Int32Array(N).fill(-1), L0 = G.L[0], best = {};
    for (let k0 = 0, c = 0; k0 < N; k0++) {
      const v0 = L0[k0]; if (v0 === NONE || comp[k0] >= 0) continue;
      const cls = v0 > -10 && v0 < 10 ? 'up' : v0 < -50 ? 'lo' : null; if (!cls) continue;
      const st = [k0], cells = []; comp[k0] = c;
      while (st.length) {
        const k = st.pop(), i = k % G.nx, j = (k / G.nx) | 0; cells.push(k);
        for (const q of [i > 0 ? k - 1 : -1, i < G.nx - 1 ? k + 1 : -1, j > 0 ? k - G.nx : -1, j < G.nz - 1 ? k + G.nx : -1])
          if (q >= 0 && comp[q] < 0 && L0[q] !== NONE && Math.abs(L0[q] - L0[k]) <= 5) { comp[q] = c; st.push(q); }
      }
      if (!best[cls] || cells.length > best[cls].length) best[cls] = cells;
      c++;
    }
    if (best.up && best.lo) {
      const pt = (k) => [G.x0 + (k % G.nx + .5) * G.res, L0[k] / 10, G.z0 + (((k / G.nx) | 0) + .5) * G.res], sub = (a) => a.filter((k) => (k % G.nx) % 8 === 0 && ((k / G.nx) | 0) % 8 === 0).map(pt);
      let bd = 1e9;
      for (const a of sub(best.up)) for (const b of sub(best.lo)) { const d = (a[0] - b[0]) ** 2 + (a[2] - b[2]) ** 2; if (d < bd) { bd = d; dims.lift = [a, b].map((q) => q.map((v) => +v.toFixed(2))); } }
      console.log(`  升降梯：上層 ${(best.up.length * G.res * G.res / 1e4).toFixed(1)} 公頃、下層 ${(best.lo.length * G.res * G.res / 1e4).toFixed(1)} 公頃，${JSON.stringify(dims.lift)}`);
    }
  }
  return { prims: out, dims };
}
