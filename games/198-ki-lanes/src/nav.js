// 尋路：1 公尺格的可走格 + A*，路徑以視線檢查拉直。給長距離移動（玩家點遠處、AI 遊走、打野、打王）使用。
import { OBSTACLES, blocked } from './map.js';

const N = 180, HALF = 90, CELL = 1;
const PAD = 0.9; // 單位半徑 + 餘裕
const walk = new Uint8Array(N * N);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const x = i - HALF + 0.5, z = j - HALF + 0.5;
  let ok = Math.abs(x) < 87.5 && Math.abs(z) < 87.5;
  if (ok) for (const o of OBSTACLES) { const dx = x - o.x, dz = z - o.z, r = o.r + PAD; if (dx * dx + dz * dz < r * r) { ok = false; break; } }
  walk[j * N + i] = ok ? 1 : 0;
}
const toCell = (v) => Math.max(0, Math.min(N - 1, Math.floor(v + HALF)));
const idx = (i, j) => j * N + i;

function nearestWalkable(i, j) {
  if (walk[idx(i, j)]) return [i, j];
  for (let r = 1; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    const a = i + di, b = j + dj;
    if (a >= 0 && b >= 0 && a < N && b < N && walk[idx(a, b)]) return [a, b];
  }
  return [i, j];
}

// 二元堆積
const g = new Float32Array(N * N), from = new Int32Array(N * N), stamp = new Uint32Array(N * N), closed = new Uint32Array(N * N);
let gen = 1;
const heap = []; const hf = [];
function push(n, f) { heap.push(n); hf.push(f); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= hf[i]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; [hf[p], hf[i]] = [hf[i], hf[p]]; i = p; } }
function pop() {
  const top = heap[0], lastN = heap.pop(), lastF = hf.pop();
  if (heap.length) { heap[0] = lastN; hf[0] = lastF; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && hf[l] < hf[m]) m = l; if (r < heap.length && hf[r] < hf[m]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; [hf[m], hf[i]] = [hf[i], hf[m]]; i = m; } }
  return top;
}

// 回傳 [{x,z}, ...]（不含起點），找不到時回傳直線目標
export function findPath(ax, az, bx, bz) {
  if (!blocked(ax, az, bx, bz, PAD - 0.2)) return [{ x: bx, z: bz }];
  gen++; heap.length = 0; hf.length = 0;
  const [si, sj] = nearestWalkable(toCell(ax), toCell(az)), [ti, tj] = nearestWalkable(toCell(bx), toCell(bz));
  const s = idx(si, sj), t = idx(ti, tj);
  g[s] = 0; stamp[s] = gen; from[s] = -1; push(s, 0);
  let found = false, iter = 0;
  while (heap.length && iter++ < 40000) {
    const n = pop();
    if (closed[n] === gen) continue; closed[n] = gen;
    if (n === t) { found = true; break; }
    const i = n % N, j = (n / N) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= N || b >= N) continue;
      const m = idx(a, b); if (!walk[m] || closed[m] === gen) continue;
      if (di && dj && (!walk[idx(i + di, j)] || !walk[idx(i, j + dj)])) continue;
      const ng = g[n] + (di && dj ? 1.4142 : 1);
      if (stamp[m] !== gen || ng < g[m]) { stamp[m] = gen; g[m] = ng; from[m] = n; push(m, ng + Math.hypot(a - ti, b - tj)); }
    }
  }
  if (!found) return [{ x: bx, z: bz }];
  const cells = []; for (let n = t; n !== -1; n = from[n]) cells.push(n);
  cells.reverse();
  // 拉直：從目前點往後找最遠可直達的格
  const pts = cells.map((n) => ({ x: (n % N) - HALF + 0.5, z: ((n / N) | 0) - HALF + 0.5 }));
  pts[pts.length - 1] = { x: bx, z: bz };
  const out = []; let cur = { x: ax, z: az }, k = 0;
  while (k < pts.length) {
    let far = k;
    for (let m = pts.length - 1; m > k; m--) if (!blocked(cur.x, cur.z, pts[m].x, pts[m].z, PAD - 0.25)) { far = m; break; }
    out.push(pts[far]); cur = pts[far]; k = far + 1;
  }
  return out;
}
export const navGrid = { walk, N, HALF };
