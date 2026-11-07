#!/usr/bin/env node
// 地圖動線檢查器（作品 278 赭線）
//
// 用法：node tools/check-layout.mjs <layout.mjs 路徑> [輸出前綴]
// 輸出：stdout 量測值與不合格項目；<前綴>.svg、<前綴>.png 俯視雷達圖。
// 結束碼：0 全部合格、1 有不合格項目、2 用法或載入錯誤。
// 省略前綴時輸出到 dist/design/<檔名>。
//
// 檔案裡定下的解讀（layout 資料與 build.js 都要照這份）：
// - 牆開口的 at 是「開口中心」距 a 端的距離；sill 從牆的 y0 起算。
// - 牆的實體兩端各延伸 t/2，轉角才封得起來。
// - 只有 arch/door/gate 且 sill=0 才能通行；window 擋身體但不擋視線。
// - cover 的 rot 單位是度，尺寸見 COVER_DIMS，stack 只乘高度。
// - ground 是厚 0.3 m 的板，下面能走；要實心平台就在下面放 block。
// - ramps 是實心楔形，dir 是上行方向（y0 在起點、y1 在終點）；stairs 當斜坡算。
// - block 的 roof 為 flat/parapet（或省略）時屋頂可站；dome/tile 不可站。
//
// 量測的定義：
// - 到達時間：沿路徑拉直後的長度 ÷ 5.4 m/s，到炸點範圍的第一格，跳躍 +0.35 s。
// - 通道寬度：格子中心往 8 組對向射線量出的最短跨距，可站格另以牆開口的實際寬度封頂。
// - 必經窄道：最寬路徑（maximin）的最窄處；低於 1.3 m 代表不管怎麼走都要過這裡。
// - 不重疊路線：每格容量 ∝ 1/附近最窄的通道寬度，跨過一條通道的容量和約為 1，最小割
//   就是「要堵幾條通道才能切斷兩點」，寬街不會被算成多條。割上的每個連通塊是一條通道。
//   寬度低於 1.3 m 的格子不算路，所以窄縫不會湊成一條線。
//   起訖區由出生點或炸點往外淹，直到通道寬度低於 3.5 m 或超過時間上限。
//   flow 只是參考值，合格與否看通道數 count。下限見 ROUTE_PAIRS。
// - 視距：所有可達位置（1.5 m 取樣，最長的幾組再以 0.25 m 往外爬）之間，眼高 1.70 互看的
//   最長直線；低矮掩體看得過去就算看得到。
// - 破口：站得到的格子旁邊沒有地面也沒有實體，玩家會掉出地圖；bounds 不算牆。

import { mkdir, writeFile, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve, basename, join, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const CELL = 0.25;
export const BODY_R = 0.35;
export const BODY_H = 1.8;
export const STEP = 0.45;
export const JUMP = 1.1;
export const SPEED = 5.4;
export const EYE = 1.7;
const GRAVITY = 9.8;
const SLAB = 0.3;
const EPS = 1e-3;

export const LIMITS = {
  atkSec: [18, 24],
  defSec: [9, 13],
  maxSight: 62,
  minChoke: 1.3,
};

// 手冊的三線指攻方往前線的三條路；守方與轉點只要求不會被單點堵死。
export const ROUTE_PAIRS = [
  ['atk', 'A', 3], ['atk', 'B', 3], ['atk', 'def', 3],
  ['def', 'A', 2], ['def', 'B', 2], ['A', 'B', 2], ['B', 'A', 2],
];

// w 東西向、d 南北向（rot=0 時）；r 為圓柱。
export const COVER_DIMS = {
  crate1: { w: 1, d: 1, h: 1, stand: true },
  crate125: { w: 1.25, d: 1.25, h: 1.25, stand: true },
  crate2: { w: 1.4, d: 1.4, h: 1.4, stand: true },
  mil: { w: 1.8, d: 1, h: 1.1, stand: true },
  barrel: { r: 0.32, h: 0.95, stand: true },
  cart: { w: 2.6, d: 1.5, h: 1.3, stand: true },
  well: { r: 1, h: 1, stand: false },
  stone: { w: 1.2, d: 1.2, h: 0.9, stand: true },
  planter: { w: 1.6, d: 0.7, h: 0.8, stand: true },
  sandbag: { w: 1.8, d: 0.6, h: 0.75, stand: true },
  sundial: { r: 3, h: 0.9, stand: true },
  gnomon: { w: 0.6, d: 3.2, h: 4.4, stand: false },
};

const GROUND_MATS = new Set(['flag', 'cobble', 'sand', 'tile', 'plank']);
const STYLES = new Set(['sandstone', 'plaster', 'whitewash', 'brick', 'ashlar']);
const ROOFS = new Set(['flat', 'parapet', 'dome', 'tile']);
const OPENINGS = new Set(['arch', 'door', 'window', 'gate']);
const RAMP_DIRS = new Set(['+x', '-x', '+z', '-z']);

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = resolve(TOOL_DIR, '..');

// ---------------- 幾何 ----------------

function makeBox(id, type, cx, cz, hx, hz, rotDeg, y0, y1, opts = {}) {
  const a = (rotDeg * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  return {
    id, type, x: cx, z: cz, hx, hz, ca, sa, y0, y1,
    r: Math.hypot(hx, hz),
    body: opts.body !== false,
    vis: opts.vis !== false,
    stand: !!opts.stand,
    circle: 0,
    ramp: null,
  };
}

function makeCircle(id, type, cx, cz, r, y0, y1, opts = {}) {
  const s = makeBox(id, type, cx, cz, r, r, 0, y0, y1, opts);
  s.circle = r;
  s.r = r;
  return s;
}

function dist2D(s, x, z) {
  const dx = x - s.x;
  const dz = z - s.z;
  if (s.circle) return Math.max(0, Math.hypot(dx, dz) - s.circle);
  const u = Math.abs(dx * s.ca - dz * s.sa) - s.hx;
  const v = Math.abs(dx * s.sa + dz * s.ca) - s.hz;
  return Math.hypot(Math.max(u, 0), Math.max(v, 0));
}

function rampHeight(rp, x, z) {
  const axis = rp.dir[1] === 'x' ? x : z;
  const lo = rp.dir[1] === 'x' ? rp.x0 : rp.z0;
  const hi = rp.dir[1] === 'x' ? rp.x1 : rp.z1;
  let t = (axis - lo) / (hi - lo);
  if (rp.dir[0] === '-') t = 1 - t;
  t = Math.min(1, Math.max(0, t));
  return rp.y0 + (rp.y1 - rp.y0) * t;
}

// 這格看到的實體頂面。斜坡要往上坡方向多看一個身體半徑，身體才不會卡進坡面。
function topAt(s, x, z, reach = 0) {
  if (!s.ramp) return s.y1;
  const rp = s.ramp;
  const sign = rp.dir[0] === '+' ? 1 : -1;
  const up = rp.y1 >= rp.y0 ? sign : -sign;
  return rp.dir[1] === 'x' ? rampHeight(rp, x + up * reach, z) : rampHeight(rp, x, z + up * reach);
}

function rayBox(s, ox, oz, dx, dz) {
  const rx = ox - s.x;
  const rz = oz - s.z;
  if (s.circle) {
    const b = rx * dx + rz * dz;
    const c = rx * rx + rz * rz - s.circle * s.circle;
    const disc = b * b - c;
    if (disc < 0) return Infinity;
    const t = -b - Math.sqrt(disc);
    return t >= 0 ? t : (c <= 0 ? 0 : Infinity);
  }
  const lx = rx * s.ca - rz * s.sa;
  const lz = rx * s.sa + rz * s.ca;
  const ldx = dx * s.ca - dz * s.sa;
  const ldz = dx * s.sa + dz * s.ca;
  let t0 = -Infinity;
  let t1 = Infinity;
  if (Math.abs(ldx) < 1e-9) {
    if (Math.abs(lx) > s.hx) return Infinity;
  } else {
    const a = (-s.hx - lx) / ldx;
    const b = (s.hx - lx) / ldx;
    t0 = Math.max(t0, Math.min(a, b));
    t1 = Math.min(t1, Math.max(a, b));
  }
  if (Math.abs(ldz) < 1e-9) {
    if (Math.abs(lz) > s.hz) return Infinity;
  } else {
    const a = (-s.hz - lz) / ldz;
    const b = (s.hz - lz) / ldz;
    t0 = Math.max(t0, Math.min(a, b));
    t1 = Math.min(t1, Math.max(a, b));
  }
  if (t0 > t1 || t1 < 0) return Infinity;
  return Math.max(0, t0);
}

class MinHeap {
  constructor(cap = 1 << 16) {
    this.k = new Float64Array(cap);
    this.v = new Int32Array(cap);
    this.n = 0;
  }
  grow() {
    const k = new Float64Array(this.k.length * 2);
    const v = new Int32Array(this.v.length * 2);
    k.set(this.k);
    v.set(this.v);
    this.k = k;
    this.v = v;
  }
  push(key, val) {
    if (this.n === this.k.length) this.grow();
    const { k, v } = this;
    let i = this.n++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p];
      v[i] = v[p];
      i = p;
    }
    k[i] = key;
    v[i] = val;
  }
  pop() {
    const { k, v } = this;
    const top = v[0];
    this.topKey = k[0];
    const n = --this.n;
    if (n > 0) {
      const key = k[n];
      const val = v[n];
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= key) break;
        k[i] = k[c];
        v[i] = v[c];
        i = c;
      }
      k[i] = key;
      v[i] = val;
    }
    return top;
  }
}

// ---------------- 資料驗證與實體展開 ----------------

function validate(L, fails, warns) {
  const need = ['name', 'bounds', 'ground', 'ramps', 'blocks', 'walls', 'cover', 'deco', 'sites', 'spawns', 'nav', 'callouts', 'sundial'];
  for (const k of need) if (L[k] === undefined) fails.push(`格式：缺少欄位 ${k}`);
  if (fails.length) return;
  const b = L.bounds;
  if (!(b.x1 > b.x0 && b.z1 > b.z0)) fails.push('格式：bounds 範圍無效');
  const inB = (x, z) => x >= b.x0 - EPS && x <= b.x1 + EPS && z >= b.z0 - EPS && z <= b.z1 + EPS;
  L.ground.forEach((g, i) => {
    if (!(g.x1 > g.x0 && g.z1 > g.z0)) fails.push(`格式：ground[${i}] 範圍無效`);
    if (!GROUND_MATS.has(g.mat)) warns.push(`ground[${i}] 未知材質 ${g.mat}`);
  });
  L.ramps.forEach((r, i) => {
    if (!(r.x1 > r.x0 && r.z1 > r.z0)) fails.push(`格式：ramps[${i}] 範圍無效`);
    if (!RAMP_DIRS.has(r.dir)) fails.push(`格式：ramps[${i}] dir 應為 +x -x +z -z，實際 ${r.dir}`);
    const run = r.dir?.[1] === 'x' ? r.x1 - r.x0 : r.z1 - r.z0;
    const slope = Math.abs(r.y1 - r.y0) / run;
    if (slope > 1.2) fails.push(`ramps[${i}] 斜率 ${slope.toFixed(2)} 太陡，走不上去（上限 1.2）`);
  });
  L.blocks.forEach((s, i) => {
    if (!(s.x1 > s.x0 && s.z1 > s.z0 && s.y1 > s.y0)) fails.push(`格式：blocks[${i}] 範圍無效`);
    if (!STYLES.has(s.style)) warns.push(`blocks[${i}] 未知樣式 ${s.style}`);
    if (s.roof !== undefined && !ROOFS.has(s.roof)) warns.push(`blocks[${i}] 未知屋頂 ${s.roof}`);
  });
  L.walls.forEach((w, i) => {
    const axis = Math.abs(w.ax - w.bx) < EPS || Math.abs(w.az - w.bz) < EPS;
    if (!axis) fails.push(`格式：walls[${i}] 不是軸對齊`);
    if (!(w.t > 0)) fails.push(`格式：walls[${i}] 厚度 t 無效`);
    else if (w.t < 0.2) warns.push(`walls[${i}] 厚度 ${w.t} m 太薄，視線取樣可能穿過`);
    if (!STYLES.has(w.style)) warns.push(`walls[${i}] 未知樣式 ${w.style}`);
    const len = Math.hypot(w.bx - w.ax, w.bz - w.az);
    const ops = [...(w.openings || [])].sort((p, q) => p.at - q.at);
    ops.forEach((o, j) => {
      if (!OPENINGS.has(o.kind)) fails.push(`格式：walls[${i}].openings[${j}] 未知種類 ${o.kind}`);
      if (o.at - o.w / 2 < -EPS || o.at + o.w / 2 > len + EPS) {
        fails.push(`格式：walls[${i}].openings[${j}] 超出牆長 ${len.toFixed(2)} m`);
      }
      if (j > 0 && o.at - o.w / 2 < ops[j - 1].at + ops[j - 1].w / 2 - EPS) {
        fails.push(`格式：walls[${i}] 的開口互相重疊`);
      }
      if (o.kind !== 'window' && !(o.sill > 0)) {
        if (o.h < BODY_H) warns.push(`walls[${i}].openings[${j}] 高 ${o.h} m 低於身高，過不去`);
        else if (o.w < LIMITS.minChoke - EPS) fails.push(`walls[${i}].openings[${j}] 寬 ${o.w} m，可通行的開口至少 ${LIMITS.minChoke} m`);
      }
    });
  });
  L.cover.forEach((c, i) => {
    if (!COVER_DIMS[c.kind]) fails.push(`格式：cover[${i}] 未知種類 ${c.kind}`);
    if (!inB(c.x, c.z)) fails.push(`格式：cover[${i}] 在 bounds 外`);
    if (c.rot && !Number.isInteger(c.rot) && Math.abs(c.rot) < 6.3) {
      warns.push(`cover[${i}] rot=${c.rot} 看起來像弧度；這裡的單位是度`);
    }
  });
  for (const k of ['A', 'B']) {
    const s = L.sites[k];
    if (!s) fails.push(`格式：缺少炸點 ${k}`);
    else if (!(s.x1 > s.x0 && s.z1 > s.z0)) fails.push(`格式：炸點 ${k} 範圍無效`);
  }
  for (const k of ['atk', 'def']) {
    const n = L.spawns[k]?.length ?? 0;
    if (n !== 5) fails.push(`${k === 'atk' ? '攻方' : '守方'}出生點應有 5 個，實際 ${n}`);
  }
  if (!L.nav.nodes?.length) fails.push('格式：nav.nodes 是空的');
  const ids = new Set();
  (L.nav.nodes || []).forEach((n) => {
    if (ids.has(n.id)) fails.push(`格式：nav 節點 id ${n.id} 重複`);
    ids.add(n.id);
  });
  (L.nav.edges || []).forEach(([a, b]) => {
    if (!ids.has(a) || !ids.has(b)) fails.push(`格式：nav 邊 ${a}-${b} 指到不存在的節點`);
  });
  for (const k of ['A', 'B']) {
    if (!(L.nav.nodes || []).some((n) => n.tags?.includes(`site-${k}`))) {
      fails.push(`nav 沒有標 site-${k} 的節點`);
    }
  }
}

// 把牆拆成實心段。回傳 {s0,s1,y0,y1,body,vis}，s 是沿牆距離。
function wallPieces(w) {
  const len = Math.hypot(w.bx - w.ax, w.bz - w.az);
  const ops = [...(w.openings || [])].sort((p, q) => p.at - q.at);
  const out = [];
  let cur = -w.t / 2;
  for (const o of ops) {
    const a = o.at - o.w / 2;
    const b = o.at + o.w / 2;
    if (a > cur + EPS) out.push({ s0: cur, s1: a, y0: w.y0, y1: w.y1, body: true, vis: true });
    const sill = o.sill || 0;
    const pass = o.kind !== 'window' && sill === 0;
    if (sill > 0) out.push({ s0: a, s1: b, y0: w.y0, y1: w.y0 + sill, body: true, vis: true });
    if (w.y0 + sill + o.h < w.y1) {
      out.push({ s0: a, s1: b, y0: w.y0 + sill + o.h, y1: w.y1, body: true, vis: true });
    }
    if (!pass) {
      out.push({
        s0: a, s1: b, y0: w.y0 + sill, y1: Math.min(w.y1, w.y0 + sill + o.h), body: true, vis: false,
      });
    }
    cur = b;
  }
  if (cur < len + w.t / 2 - EPS) {
    out.push({ s0: cur, s1: len + w.t / 2, y0: w.y0, y1: w.y1, body: true, vis: true });
  }
  return out;
}

function buildSolids(L) {
  const solids = [];
  L.ground.forEach((g, i) => {
    solids.push(makeBox(
      `ground[${i}]`, 'ground', (g.x0 + g.x1) / 2, (g.z0 + g.z1) / 2,
      (g.x1 - g.x0) / 2, (g.z1 - g.z0) / 2, 0, g.y - SLAB, g.y, { stand: true },
    ));
  });
  L.ramps.forEach((r, i) => {
    const s = makeBox(
      `ramps[${i}]`, 'ramp', (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2,
      (r.x1 - r.x0) / 2, (r.z1 - r.z0) / 2, 0, Math.min(r.y0, r.y1) - SLAB, Math.max(r.y0, r.y1), { stand: true },
    );
    s.ramp = r;
    solids.push(s);
  });
  L.blocks.forEach((b, i) => {
    const stand = b.roof === undefined || b.roof === 'flat' || b.roof === 'parapet';
    solids.push(makeBox(
      `blocks[${i}]`, 'block', (b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2,
      (b.x1 - b.x0) / 2, (b.z1 - b.z0) / 2, 0, b.y0, b.y1, { stand },
    ));
  });
  L.walls.forEach((w, i) => {
    const len = Math.hypot(w.bx - w.ax, w.bz - w.az) || 1;
    const ux = (w.bx - w.ax) / len;
    const uz = (w.bz - w.az) / len;
    const alongX = Math.abs(ux) > 0.5;
    for (const p of wallPieces(w)) {
      const m = (p.s0 + p.s1) / 2;
      const half = (p.s1 - p.s0) / 2;
      solids.push(makeBox(
        `walls[${i}]`, 'wall', w.ax + ux * m, w.az + uz * m,
        alongX ? half : w.t / 2, alongX ? w.t / 2 : half, 0, p.y0, p.y1, { body: p.body, vis: p.vis },
      ));
    }
  });
  L.cover.forEach((c, i) => {
    const d = COVER_DIMS[c.kind];
    const base = coverBase(L, c);
    const y1 = base + d.h * (c.stack || 1);
    const id = `cover[${i}]:${c.kind}`;
    solids.push(d.r
      ? makeCircle(id, 'cover', c.x, c.z, d.r, base, y1, { stand: d.stand })
      : makeBox(id, 'cover', c.x, c.z, d.w / 2, d.d / 2, c.rot || 0, base, y1, { stand: d.stand }));
  });
  return solids;
}

// cover 沒有 y：放在所在位置最高的地面或坡面上；疊在屋頂要自己寫 y。
function coverBase(L, c) {
  if (typeof c.y === 'number') return c.y;
  let y = -Infinity;
  for (const g of L.ground) {
    if (c.x >= g.x0 && c.x <= g.x1 && c.z >= g.z0 && c.z <= g.z1 && g.y > y) y = g.y;
  }
  for (const r of L.ramps) {
    if (c.x >= r.x0 && c.x <= r.x1 && c.z >= r.z0 && c.z <= r.z1) y = Math.max(y, rampHeight(r, c.x, c.z));
  }
  return y === -Infinity ? 0 : y;
}

// ---------------- 柵格與可走圖 ----------------

function buildGrid(L, solids) {
  const b = L.bounds;
  const nx = Math.ceil((b.x1 - b.x0) / CELL);
  const nz = Math.ceil((b.z1 - b.z0) / CELL);
  const ncell = nx * nz;
  const cx = (i) => b.x0 + (i + 0.5) * CELL;
  const cz = (j) => b.z0 + (j + 0.5) * CELL;
  const cellIdx = (x, z) => {
    const i = Math.floor((x - b.x0) / CELL);
    const j = Math.floor((z - b.z0) / CELL);
    return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i;
  };

  const near = new Array(ncell);
  const raw = new Array(ncell);
  const filled = new Uint8Array(ncell);
  const forCells = (s, pad, fn) => {
    const r = (s.circle || s.r) + pad;
    const i0 = Math.max(0, Math.floor((s.x - r - b.x0) / CELL));
    const i1 = Math.min(nx - 1, Math.floor((s.x + r - b.x0) / CELL));
    const j0 = Math.max(0, Math.floor((s.z - r - b.z0) / CELL));
    const j1 = Math.min(nz - 1, Math.floor((s.z + r - b.z0) / CELL));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) fn(i, j, j * nx + i);
    }
  };

  // 2 m 分桶，量通道寬度的精確射線用。
  const BK = 2;
  const bw = Math.ceil((b.x1 - b.x0) / BK);
  const bh = Math.ceil((b.z1 - b.z0) / BK);
  const buckets = Array.from({ length: bw * bh }, () => []);
  const RAY_NEAR = 3;

  solids.forEach((s, id) => {
    forCells(s, BODY_R, (i, j, c) => {
      const d = dist2D(s, cx(i), cz(j));
      if (d > BODY_R) return;
      if (d === 0) filled[c] = 1;
      if (s.body) (near[c] ||= []).push(id);
      if (d === 0 && s.stand) {
        (raw[c] ||= []).push(topAt(s, cx(i), cz(j)));
      }
    });
    if (s.body) {
      const r = (s.circle || s.r) + RAY_NEAR + BK;
      const i0 = Math.max(0, Math.floor((s.x - r - b.x0) / BK));
      const i1 = Math.min(bw - 1, Math.floor((s.x + r - b.x0) / BK));
      const j0 = Math.max(0, Math.floor((s.z - r - b.z0) / BK));
      const j1 = Math.min(bh - 1, Math.floor((s.z + r - b.z0) / BK));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const bx = b.x0 + (i + 0.5) * BK;
          const bz = b.z0 + (j + 0.5) * BK;
          if (dist2D(s, bx, bz) <= RAY_NEAR + BK) buckets[j * bw + i].push(id);
        }
      }
    }
  });

  // 每格的可站立面。open＝身體放得下，supported＝格心站得上去但可能貼牆。
  const cellStart = new Int32Array(ncell + 1);
  const hs = [];
  const opens = [];
  for (let c = 0; c < ncell; c++) {
    cellStart[c] = hs.length;
    const list = raw[c];
    if (!list) continue;
    const j = Math.floor(c / nx);
    const i = c - j * nx;
    const x = cx(i);
    const z = cz(j);
    const uniq = [...new Set(list.map((h) => Math.round(h * 100) / 100))].sort((p, q) => p - q);
    const ns = near[c] || [];
    for (const h of uniq) {
      let center = true;
      let open = true;
      for (let k = 0; k < ns.length; k++) {
        const s = solids[ns[k]];
        const bot = s.y0;
        if (bot >= h + BODY_H - EPS) continue;
        const d = dist2D(s, x, z);
        if (d === 0 && topAt(s, x, z) > h + 0.02) center = false;
        if (topAt(s, x, z, BODY_R) > h + STEP + EPS) open = false;
        if (!center) break;
      }
      if (!center) continue;
      hs.push(h);
      opens.push(open ? 1 : 0);
    }
  }
  cellStart[ncell] = hs.length;
  const M = hs.length;
  const surfH = Float32Array.from(hs);
  const surfOpen = Uint8Array.from(opens);
  const surfCell = new Int32Array(M);
  for (let c = 0; c < ncell; c++) {
    for (let u = cellStart[c]; u < cellStart[c + 1]; u++) surfCell[u] = c;
  }
  const sx = (u) => cx(surfCell[u] % nx);
  const sz = (u) => cz(Math.floor(surfCell[u] / nx));

  return {
    nx, nz, ncell, cx, cz, cellIdx, near, filled, cellStart, M, surfH, surfOpen, surfCell, sx, sz,
    buckets, BK, bw, bh, b, RAY_NEAR,
  };
}

// 這格裡與高度 h 相距 reach 以內的可站面（open 限定）。
function surfNear(G, c, h, reach, needOpen = true) {
  const { cellStart, surfH, surfOpen } = G;
  let best = -1;
  let bd = Infinity;
  for (let u = cellStart[c]; u < cellStart[c + 1]; u++) {
    if (needOpen && !surfOpen[u]) continue;
    const d = Math.abs(surfH[u] - h);
    if (d <= reach + EPS && d < bd) {
      bd = d;
      best = u;
    }
  }
  return best;
}

function sweepClear(G, solids, c, H) {
  const ns = G.near[c];
  if (!ns) return true;
  const j = Math.floor(c / G.nx);
  const i = c - j * G.nx;
  const x = G.cx(i);
  const z = G.cz(j);
  for (let k = 0; k < ns.length; k++) {
    const s = solids[ns[k]];
    if (s.y0 < H + BODY_H - EPS && topAt(s, x, z, BODY_R) > H + EPS) return false;
  }
  return true;
}

const AIR_RADII = [0.75, 1, 1.25, 1.5, 2, 2.5];
const AIR_DIRS = 16;

function buildGraph(G, solids) {
  const { nx, nz, M, surfH, surfOpen, surfCell, cellStart } = G;
  const adjList = new Array(M);
  const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const walkCnt = new Uint8Array(M);
  let E = 0;
  for (let u = 0; u < M; u++) {
    if (!surfOpen[u]) continue;
    const c = surfCell[u];
    const j = Math.floor(c / nx);
    const i = c - j * nx;
    const h = surfH[u];
    const out = [];
    for (let d = 0; d < 8; d++) {
      const di = D8[d][0];
      const dj = D8[d][1];
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue;
      const nc = nj * nx + ni;
      if (di && dj) {
        if (surfNear(G, j * nx + ni, h, STEP) < 0) continue;
        if (surfNear(G, nj * nx + i, h, STEP) < 0) continue;
      }
      for (let v = cellStart[nc]; v < cellStart[nc + 1]; v++) {
        if (!surfOpen[v] || Math.abs(surfH[v] - h) > STEP + EPS) continue;
        out.push(v, (d < 4 ? CELL : CELL * Math.SQRT2) / SPEED, 0);
        walkCnt[u]++;
      }
    }
    adjList[u] = out;
    E += out.length / 3;
  }

  // 跳躍與落下只從可走圖的邊緣格找。
  const air = [];
  for (let k = 0; k < AIR_DIRS; k++) {
    const a = (k / AIR_DIRS) * Math.PI * 2;
    for (const r of AIR_RADII) air.push([Math.cos(a), Math.sin(a), r]);
  }
  for (let u = 0; u < M; u++) {
    if (!surfOpen[u] || walkCnt[u] >= 8) continue;
    const c = surfCell[u];
    const j = Math.floor(c / nx);
    const i = c - j * nx;
    const h = surfH[u];
    const seen = new Set();
    for (let k = 0; k < air.length; k++) {
      const [ax, az, r] = air[k];
      const ti = i + Math.round((ax * r) / CELL);
      const tj = j + Math.round((az * r) / CELL);
      if (ti < 0 || tj < 0 || ti >= nx || tj >= nz) continue;
      const nc = tj * nx + ti;
      for (let v = cellStart[nc]; v < cellStart[nc + 1]; v++) {
        if (!surfOpen[v] || seen.has(v)) continue;
        const dh = surfH[v] - h;
        const drop = dh < -STEP;
        if (dh > JUMP + EPS) continue;
        if (drop && r > 1.5) continue;
        if (Math.abs(dh) <= STEP + EPS && segWalk(G, G.cx(i), G.cz(j), h, G.cx(ti), G.cz(tj), surfH[v]).ok) continue;
        const H = drop ? h : h + JUMP;
        const steps = Math.ceil(r / (CELL * 0.5));
        let ok = true;
        for (let s = 1; s < steps && ok; s++) {
          const t = s / steps;
          const si = Math.round(i + (ti - i) * t);
          const sj = Math.round(j + (tj - j) * t);
          ok = sweepClear(G, solids, sj * nx + si, H);
        }
        if (!ok) continue;
        seen.add(v);
        const d = Math.hypot(ti - i, tj - j) * CELL;
        const cost = drop
          ? Math.max(d / SPEED, Math.sqrt((2 * -dh) / GRAVITY)) + 0.1
          : d / SPEED + 0.35;
        adjList[u].push(v, cost, drop ? 2 : 1);
        E++;
      }
    }
  }

  const adjStart = new Int32Array(M + 1);
  const adjTo = new Int32Array(E);
  const adjCost = new Float32Array(E);
  const adjKind = new Uint8Array(E);
  let e = 0;
  for (let u = 0; u < M; u++) {
    adjStart[u] = e;
    const out = adjList[u];
    if (!out) continue;
    for (let k = 0; k < out.length; k += 3) {
      adjTo[e] = out[k];
      adjCost[e] = out[k + 1];
      adjKind[e] = out[k + 2];
      e++;
    }
  }
  adjStart[M] = e;
  return { adjStart, adjTo, adjCost, adjKind, E };
}

function dijkstra(GR, M, sources, opts = {}) {
  const dist = new Float64Array(M).fill(Infinity);
  const prev = new Int32Array(M).fill(-1);
  const kind = new Uint8Array(M);
  const heap = new MinHeap();
  const { adjStart, adjTo, adjCost, adjKind } = GR;
  const { blocked, maxSec, walkOnly } = opts;
  for (const s of sources) {
    dist[s] = 0;
    heap.push(0, s);
  }
  while (heap.n) {
    const u = heap.pop();
    const d = heap.topKey;
    if (d > dist[u] + 1e-6) continue;
    if (maxSec !== undefined && d > maxSec) break;
    for (let e = adjStart[u]; e < adjStart[u + 1]; e++) {
      if (walkOnly && adjKind[e]) continue;
      const v = adjTo[e];
      if (blocked && blocked[v]) continue;
      const nd = d + adjCost[e];
      if (nd < dist[v] - 1e-6) {
        dist[v] = nd;
        prev[v] = u;
        kind[v] = adjKind[e];
        heap.push(nd, v);
      }
    }
  }
  return { dist, prev, kind };
}

// ---------------- 通道寬度 ----------------

function computeWidths(G, solids, L) {
  const { M, surfOpen, surfH, nx, sx, sz, surfCell, b, buckets, BK, bw, cellStart, cellIdx } = G;
  const W = new Float32Array(M);
  const LINES = 8;
  const CAP = 30;
  const dirs = [];
  for (let k = 0; k < LINES; k++) {
    const a = (k / LINES) * Math.PI;
    dirs.push([Math.cos(a), Math.sin(a)]);
  }
  const rel = [];
  const march = (x, z, h, dx, dz, tExact) => {
    let t = 0.25;
    let cur = h;
    const limit = Math.min(CAP, tExact);
    while (t < limit) {
      const c = cellIdx(x + dx * t, z + dz * t);
      if (c < 0) return t;
      let found = -1;
      let any = false;
      let bd = Infinity;
      for (let v = cellStart[c]; v < cellStart[c + 1]; v++) {
        const dh = Math.abs(surfH[v] - cur);
        if (dh > STEP + EPS) continue;
        any = true;
        if (surfOpen[v] && dh < bd) {
          bd = dh;
          found = v;
        }
      }
      if (found < 0) return any ? Math.min(limit, t + BODY_R) : t;
      cur = surfH[found];
      t += t < 3 ? 0.25 : 0.5;
    }
    return limit;
  };
  for (let u = 0; u < M; u++) {
    if (!surfOpen[u]) continue;
    const x = sx(u);
    const z = sz(u);
    const h = surfH[u];
    const bi = Math.min(bw - 1, Math.floor((x - b.x0) / BK));
    const bj = Math.min(G.bh - 1, Math.floor((z - b.z0) / BK));
    const list = buckets[bj * bw + bi];
    rel.length = 0;
    for (let k = 0; k < list.length; k++) {
      const s = solids[list[k]];
      if (s.y0 >= h + BODY_H - EPS) continue;
      if (s.ramp) {
        if (topAt(s, x, z) <= h + STEP + EPS) continue;
      } else if (s.y1 <= h + STEP + EPS) continue;
      rel.push(s);
    }
    let w = CAP * 2;
    for (let k = 0; k < LINES; k++) {
      const dx = dirs[k][0];
      const dz = dirs[k][1];
      let tp = Infinity;
      let tm = Infinity;
      for (let q = 0; q < rel.length; q++) {
        const s = rel[q];
        const a = rayBox(s, x, z, dx, dz);
        const c = rayBox(s, x, z, -dx, -dz);
        if (a < tp) tp = a;
        if (c < tm) tm = c;
      }
      const span = march(x, z, h, dx, dz, tp) + march(x, z, h, -dx, -dz, tm);
      if (span < w) w = span;
    }
    W[u] = w;
  }
  // 薄牆開口的門洞列可能剛好落在格心之間，直接用開口寬度封頂。
  for (const wl of L.walls) {
    const len = Math.hypot(wl.bx - wl.ax, wl.bz - wl.az) || 1;
    const ux = (wl.bx - wl.ax) / len;
    const uz = (wl.bz - wl.az) / len;
    for (const o of wl.openings || []) {
      if (o.kind === 'window' || o.sill > 0) continue;
      const ox = wl.ax + ux * o.at;
      const oz = wl.az + uz * o.at;
      const px = Math.abs(ux) > 0.5 ? o.w / 2 : wl.t / 2 + 0.25;
      const pz = Math.abs(ux) > 0.5 ? wl.t / 2 + 0.25 : o.w / 2;
      for (let x = ox - px; x <= ox + px + EPS; x += CELL) {
        for (let z = oz - pz; z <= oz + pz + EPS; z += CELL) {
          const c = cellIdx(x, z);
          if (c < 0) continue;
          for (let v = cellStart[c]; v < cellStart[c + 1]; v++) {
            if (surfOpen[v] && surfH[v] < wl.y0 + (o.h || 2) && surfH[v] >= wl.y0 - STEP && W[v] > o.w) {
              W[v] = o.w;
            }
          }
        }
      }
    }
  }
  return W;
}

// 容量用的寬度：取走得到的 3 m 內最窄值。十字路口的射線會逃進橫街把 W 量大，
// 不修正的話最小割都選在路口，一條街的容量只剩 0.6。
function localWidth(GR, M, W, surfOpen) {
  const { adjStart, adjTo, adjKind } = GR;
  let cur = W;
  for (let n = 0; n < 12; n++) {
    const next = cur.slice();
    for (let u = 0; u < M; u++) {
      if (!surfOpen[u]) continue;
      for (let e = adjStart[u]; e < adjStart[u + 1]; e++) {
        if (!adjKind[e] && cur[adjTo[e]] < next[u]) next[u] = cur[adjTo[e]];
      }
    }
    cur = next;
  }
  return cur;
}

function bottleneck(GR, M, W, sources, isT, blocked) {
  const best = new Float32Array(M);
  const prev = new Int32Array(M).fill(-1);
  const heap = new MinHeap();
  const { adjStart, adjTo } = GR;
  for (const s of sources) {
    best[s] = W[s];
    heap.push(-W[s], s);
  }
  while (heap.n) {
    const u = heap.pop();
    const w = -heap.topKey;
    if (w < best[u] - 1e-6) continue;
    if (isT[u]) {
      const path = [];
      for (let p = u; p >= 0; p = prev[p]) path.push(p);
      path.reverse();
      let lo = path[0];
      for (const p of path) if (W[p] < W[lo]) lo = p;
      return { width: w, at: lo };
    }
    for (let e = adjStart[u]; e < adjStart[u + 1]; e++) {
      const v = adjTo[e];
      if (blocked && blocked[v]) continue;
      const nw = Math.min(w, W[v]);
      if (nw > best[v] + 1e-6) {
        best[v] = nw;
        prev[v] = u;
        heap.push(-nw, v);
      }
    }
  }
  return { width: 0, at: -1 };
}

// ---------------- 路徑長度 ----------------

function segWalk(G, x0, z0, h0, x1, z1, h1) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.ceil(len / 0.1));
  let cur = h0;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const c = G.cellIdx(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
    if (c < 0) return { ok: false, x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t };
    const u = surfNear(G, c, cur, STEP);
    if (u < 0) return { ok: false, x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t };
    cur = G.surfH[u];
  }
  return { ok: Math.abs(cur - h1) <= STEP + EPS };
}

function pullPath(G, path, kinds) {
  const pts = [path[0]];
  const airs = [0];
  let i = 0;
  const n = path.length;
  while (i < n - 1) {
    if (kinds[i + 1]) {
      pts.push(path[i + 1]);
      airs.push(kinds[i + 1]);
      i++;
      continue;
    }
    let lim = i + 1;
    while (lim < n - 1 && !kinds[lim + 1]) lim++;
    let k = Math.min(lim, i + 480);
    const a = path[i];
    for (;;) {
      if (k === i + 1) break;
      const c = path[k];
      if (segWalk(G, G.sx(a), G.sz(a), G.surfH[a], G.sx(c), G.sz(c), G.surfH[c]).ok) break;
      k = Math.max(i + 1, k - Math.max(1, Math.floor((k - i) / 6)));
    }
    pts.push(path[k]);
    airs.push(0);
    i = k;
  }
  return { pts, airs };
}

function extractPath(prev, kind, end) {
  const path = [];
  const kinds = [];
  for (let p = end; p >= 0; p = prev[p]) {
    path.push(p);
    kinds.push(kind[p]);
  }
  path.reverse();
  kinds.reverse();
  return { path, kinds };
}

function pathTime(G, pts, airs, GR) {
  let sec = 0;
  let meters = 0;
  let jumps = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const d = Math.hypot(G.sx(a) - G.sx(b), G.sz(a) - G.sz(b));
    if (airs[i]) {
      for (let e = GR.adjStart[a]; e < GR.adjStart[a + 1]; e++) {
        if (GR.adjTo[e] === b && GR.adjKind[e] === airs[i]) {
          sec += GR.adjCost[e];
          break;
        }
      }
      if (airs[i] === 1) jumps++;
    } else {
      sec += d / SPEED;
    }
    meters += d;
  }
  return { sec, meters, jumps };
}

// ---------------- 最大流（不重疊路線） ----------------

class Flow {
  constructor(GR, M, W, capW, surfOpen) {
    this.M = M;
    const { adjStart, adjTo } = GR;
    let n = 0;
    for (let u = 0; u < M; u++) if (surfOpen[u]) n += 1 + adjStart[u + 1] - adjStart[u];
    const A = n * 2;
    const deg = new Int32Array(2 * M + 1);
    const from = new Int32Array(A);
    const to = new Int32Array(A);
    const cap = new Int32Array(A);
    let a = 0;
    const add = (p, q, c) => {
      from[a] = p; to[a] = q; cap[a] = c; a++;
      from[a] = q; to[a] = p; cap[a] = 0; a++;
      deg[p]++; deg[q]++;
    };
    this.INF = 1 << 28;
    this.splitCap = new Int32Array(M);
    for (let u = 0; u < M; u++) {
      if (!surfOpen[u]) continue;
      const c = W[u] < LIMITS.minChoke - EPS
        ? 0
        : Math.max(1, Math.round((1000 * CELL) / Math.max(CELL, capW[u] - 2 * BODY_R)));
      this.splitCap[u] = c;
      add(2 * u, 2 * u + 1, c);
      for (let e = adjStart[u]; e < adjStart[u + 1]; e++) add(2 * u + 1, 2 * adjTo[e], this.INF);
    }
    const head = new Int32Array(2 * M + 1);
    for (let i = 0, s = 0; i <= 2 * M; i++) {
      head[i] = s;
      s += deg[i];
    }
    const fill = head.slice();
    const list = new Int32Array(A);
    for (let i = 0; i < A; i++) list[fill[from[i]]++] = i;
    Object.assign(this, { head, list, to, cap0: cap, cap: new Int32Array(A) });
    this.splitArc = new Int32Array(M).fill(-1);
    for (let i = 0; i < A; i += 2) {
      if (to[i] === from[i] + 1 && (from[i] & 1) === 0) this.splitArc[from[i] >> 1] = i;
    }
    this.level = new Int32Array(2 * M);
    this.it = new Int32Array(2 * M);
    this.queue = new Int32Array(2 * M);
    this.stack = new Int32Array(2 * M + 2);
  }

  bfs(srcs, isT) {
    const { level, queue, head, list, to, cap } = this;
    level.fill(-1);
    let qh = 0;
    let qt = 0;
    for (const s of srcs) {
      const n = 2 * s;
      if (level[n] < 0) {
        level[n] = 0;
        queue[qt++] = n;
      }
    }
    let sinkLevel = -1;
    while (qh < qt) {
      const u = queue[qh++];
      if (sinkLevel >= 0 && level[u] >= sinkLevel) break;
      for (let k = head[u]; k < head[u + 1]; k++) {
        const a = list[k];
        if (cap[a] <= 0) continue;
        const v = to[a];
        if (level[v] >= 0) continue;
        level[v] = level[u] + 1;
        queue[qt++] = v;
        if (!(v & 1) && isT[v >> 1] && sinkLevel < 0) sinkLevel = level[v];
      }
    }
    return sinkLevel >= 0;
  }

  // 沒有終點可達時才跑完整殘量網路，用來取最小割。
  fullReach(srcs) {
    const { level, queue, head, list, to, cap } = this;
    level.fill(-1);
    let qh = 0;
    let qt = 0;
    for (const s of srcs) {
      if (level[2 * s] < 0) {
        level[2 * s] = 0;
        queue[qt++] = 2 * s;
      }
    }
    while (qh < qt) {
      const u = queue[qh++];
      for (let k = head[u]; k < head[u + 1]; k++) {
        const a = list[k];
        if (cap[a] > 0 && level[to[a]] < 0) {
          level[to[a]] = 1;
          queue[qt++] = to[a];
        }
      }
    }
  }

  blocking(start, isT) {
    const { level, it, head, list, to, cap, stack } = this;
    let total = 0;
    let sp = 0;
    let u = start;
    for (;;) {
      if (!(u & 1) && isT[u >> 1]) {
        let f = this.INF;
        for (let i = 0; i < sp; i++) if (cap[stack[i]] < f) f = cap[stack[i]];
        let cut = sp;
        for (let i = sp - 1; i >= 0; i--) {
          const a = stack[i];
          cap[a] -= f;
          cap[a ^ 1] += f;
          if (cap[a] === 0) cut = i;
        }
        total += f;
        sp = cut;
        u = sp === 0 ? start : to[stack[sp - 1]];
        continue;
      }
      let advanced = false;
      for (; it[u] < head[u + 1]; it[u]++) {
        const a = list[it[u]];
        const v = to[a];
        if (cap[a] > 0 && level[v] === level[u] + 1) {
          stack[sp++] = a;
          u = v;
          advanced = true;
          break;
        }
      }
      if (advanced) continue;
      level[u] = -1;
      if (sp === 0) return total;
      sp--;
      u = sp === 0 ? start : to[stack[sp - 1]];
      it[u]++;
    }
  }

  solve(srcs, isT, isS, limit) {
    const { cap, cap0, splitArc, head, it } = this;
    cap.set(cap0);
    for (let u = 0; u < this.M; u++) {
      if ((isS[u] || isT[u]) && splitArc[u] >= 0) cap[splitArc[u]] = this.INF;
    }
    let flow = 0;
    while (flow < limit && this.bfs(srcs, isT)) {
      it.set(head.subarray(0, it.length));
      for (const s of srcs) flow += this.blocking(2 * s, isT);
    }
    this.fullReach(srcs);
    return flow;
  }

  cutNodes() {
    const { level, M, splitArc } = this;
    const out = [];
    for (let u = 0; u < M; u++) {
      if (splitArc[u] >= 0 && this.splitCap[u] > 0 && level[2 * u] >= 0 && level[2 * u + 1] < 0) out.push(u);
    }
    return out;
  }
}

// 把最小割分成各自獨立的通道。
function groupCut(G, cut, flow, W) {
  const idx = new Map();
  cut.forEach((u, k) => idx.set(u, k));
  const seen = new Uint8Array(cut.length);
  const groups = [];
  const byCell = new Map();
  for (const u of cut) {
    const c = G.surfCell[u];
    if (!byCell.has(c)) byCell.set(c, []);
    byCell.get(c).push(u);
  }
  for (let k = 0; k < cut.length; k++) {
    if (seen[k]) continue;
    const q = [cut[k]];
    seen[k] = 1;
    const nodes = [];
    while (q.length) {
      const u = q.pop();
      nodes.push(u);
      const c = G.surfCell[u];
      const j = Math.floor(c / G.nx);
      const i = c - j * G.nx;
      for (let dj = -2; dj <= 2; dj++) {
        for (let di = -2; di <= 2; di++) {
          const nc = (j + dj) * G.nx + i + di;
          if (i + di < 0 || i + di >= G.nx || nc < 0) continue;
          const list = byCell.get(nc);
          if (!list) continue;
          for (const v of list) {
            const m = idx.get(v);
            if (seen[m] || Math.abs(G.surfH[v] - G.surfH[u]) > 1.2) continue;
            seen[m] = 1;
            q.push(v);
          }
        }
      }
    }
    let cap = 0;
    let wid = Infinity;
    let sx = 0;
    let sz = 0;
    for (const u of nodes) {
      cap += flow.splitCap[u];
      wid = Math.min(wid, W[u]);
      sx += G.sx(u);
      sz += G.sz(u);
    }
    groups.push({ nodes, cap: cap / 1000, width: wid, x: sx / nodes.length, z: sz / nodes.length });
  }
  groups.sort((p, q) => q.cap - p.cap);
  return groups;
}

// ---------------- 視距 ----------------

function buildVision(G, solids) {
  const { nx, nz, ncell, cx, cz, b } = G;
  const lists = new Array(ncell);
  // 夠讓 0.2 m 的牆佔滿一排格心就好；再大會把窄縫填掉，低估穿縫的視線。
  const PAD = (CELL - 0.2) / 2 + 0.01;
  solids.forEach((s) => {
    if (!s.vis) return;
    const r = (s.circle || s.r) + PAD;
    const i0 = Math.max(0, Math.floor((s.x - r - b.x0) / CELL));
    const i1 = Math.min(nx - 1, Math.floor((s.x + r - b.x0) / CELL));
    const j0 = Math.max(0, Math.floor((s.z - r - b.z0) / CELL));
    const j1 = Math.min(nz - 1, Math.floor((s.z + r - b.z0) / CELL));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        if (dist2D(s, cx(i), cz(j)) > PAD) continue;
        const c = j * nx + i;
        (lists[c] ||= []).push(s.y0, topAt(s, cx(i), cz(j)));
      }
    }
  });
  const start = new Int32Array(ncell + 1);
  let n = 0;
  for (let c = 0; c < ncell; c++) {
    start[c] = n;
    if (lists[c]) n += lists[c].length;
  }
  start[ncell] = n;
  const ys = new Float32Array(n);
  for (let c = 0; c < ncell; c++) if (lists[c]) ys.set(lists[c], start[c]);
  return { start, ys };
}

function losClear(G, V, x0, z0, y0, x1, z1, y1) {
  const { b, nx, nz } = G;
  const { start, ys } = V;
  const d = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.ceil(d / 0.2);
  const sx = (x1 - x0) / n;
  const sz = (z1 - z0) / n;
  const sy = (y1 - y0) / n;
  let x = x0;
  let z = z0;
  let y = y0;
  for (let k = 1; k < n; k++) {
    x += sx;
    z += sz;
    y += sy;
    const i = Math.floor((x - b.x0) / CELL);
    const j = Math.floor((z - b.z0) / CELL);
    if (i < 0 || j < 0 || i >= nx || j >= nz) return false;
    const c = j * nx + i;
    for (let a = start[c]; a < start[c + 1]; a += 2) {
      if (y >= ys[a] && y <= ys[a + 1]) return false;
    }
  }
  return true;
}

function computeSight(G, V, reach) {
  const { M, surfOpen, sx, sz, surfH, surfCell, nx } = G;
  const pts = [];
  for (let u = 0; u < M; u++) {
    if (!surfOpen[u] || !reach[u]) continue;
    const c = surfCell[u];
    const j = Math.floor(c / nx);
    const i = c - j * nx;
    if (i % 6 === 3 && j % 6 === 3) pts.push(u);
  }
  const n = pts.length;
  const X = new Float32Array(n);
  const Z = new Float32Array(n);
  const Y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    X[i] = sx(pts[i]);
    Z[i] = sz(pts[i]);
    Y[i] = surfH[pts[i]] + EYE;
  }
  const best = new Float32Array(n);
  const mate = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = Math.hypot(X[i] - X[j], Z[i] - Z[j]);
      if (d <= best[i] && d <= best[j]) continue;
      if (!losClear(G, V, X[i], Z[i], Y[i], X[j], Z[j], Y[j])) continue;
      if (d > best[i]) { best[i] = d; mate[i] = j; }
      if (d > best[j]) { best[j] = d; mate[j] = i; }
    }
  }
  let top = -1;
  for (let i = 0; i < n; i++) if (top < 0 || best[i] > best[top]) top = i;
  const lookup = new Map();
  pts.forEach((u, i) => lookup.set(G.surfCell[u], i));
  return { pts, X, Z, Y, best, mate, top, lookup };
}

// 1.5 m 取樣會低估穿過窄縫的視線：取最長的幾組，兩端往外爬到不能再長為止。
function refineSight(G, V, S, reach) {
  const { cellStart, surfOpen, surfH, nx, nz } = G;
  const order = Array.from(S.best.keys()).filter((i) => S.mate[i] >= 0);
  order.sort((p, q) => S.best[q] - S.best[p]);
  const surfaceAt = (i, j, h) => {
    if (i < 0 || j < 0 || i >= nx || j >= nz) return -1;
    const c = j * nx + i;
    let best = -1;
    let bd = STEP + EPS;
    for (let u = cellStart[c]; u < cellStart[c + 1]; u++) {
      const d = Math.abs(surfH[u] - h);
      if (surfOpen[u] && reach[u] && d <= bd) {
        bd = d;
        best = u;
      }
    }
    return best;
  };
  const place = (u) => {
    const c = G.surfCell[u];
    return { i: c % nx, j: Math.floor(c / nx), h: surfH[u], x: G.sx(u), z: G.sz(u) };
  };
  const seen = (p, q) => losClear(G, V, p.x, p.z, p.h + EYE, q.x, q.z, q.h + EYE);
  const D = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let top = null;
  for (const start of order.slice(0, 24)) {
    let p = place(S.pts[start]);
    let q = place(S.pts[S.mate[start]]);
    let d = Math.hypot(p.x - q.x, p.z - q.z);
    for (let moved = true, guard = 0; moved && guard < 400; guard++) {
      moved = false;
      for (const [di, dj] of D) {
        for (const stride of [4, 2, 1]) {
          const u = surfaceAt(p.i + di * stride, p.j + dj * stride, p.h);
          if (u >= 0) {
            const n = place(u);
            const nd = Math.hypot(n.x - q.x, n.z - q.z);
            if (nd > d + EPS && seen(n, q)) { p = n; d = nd; moved = true; }
          }
          const v = surfaceAt(q.i + di * stride, q.j + dj * stride, q.h);
          if (v >= 0) {
            const n = place(v);
            const nd = Math.hypot(p.x - n.x, p.z - n.z);
            if (nd > d + EPS && seen(p, n)) { q = n; d = nd; moved = true; }
          }
        }
      }
    }
    if (!top || d > top.dist) top = { dist: d, a: [p.x, p.z], b: [q.x, q.z] };
  }
  return top;
}

function routeSight(G, S, nodes) {
  let bd = 0;
  let bi = -1;
  for (let k = 0; k < nodes.length; k += 3) {
    const u = nodes[k];
    const c = G.surfCell[u];
    const j = Math.floor(c / G.nx);
    const i = c - j * G.nx;
    const li = Math.floor(i / 6) * 6 + 3;
    const lj = Math.floor(j / 6) * 6 + 3;
    for (let dj = -6; dj <= 6; dj += 6) {
      for (let di = -6; di <= 6; di += 6) {
        const m = S.lookup.get((lj + dj) * G.nx + li + di);
        if (m === undefined || Math.abs(S.Y[m] - G.surfH[u] - EYE) > 1.5) continue;
        if (S.best[m] > bd) {
          bd = S.best[m];
          bi = m;
        }
      }
    }
  }
  return { dist: bd, idx: bi };
}

// ---------------- 主流程 ----------------

export function checkLayout(L) {
  const fails = [];
  const warns = [];
  validate(L, fails, warns);
  const res = { fails, warns, layout: L };
  if (fails.some((f) => f.startsWith('格式：'))) return res;

  const t0 = performance.now();
  const solids = buildSolids(L);
  const G = buildGrid(L, solids);
  const GR = buildGraph(G, solids);
  const { M, surfOpen, surfH, sx, sz } = G;
  const W = computeWidths(G, solids, L);
  const capW = localWidth(GR, M, W, surfOpen);
  Object.assign(res, { solids, G, GR, W });

  const callout = (x, z) => {
    for (const c of L.callouts) if (x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1) return c.name;
    return '未命名區';
  };
  const where = (x, z) => `${callout(x, z)}(${x.toFixed(1)}, ${z.toFixed(1)})`;
  res.where = where;

  // 點位吸附到最近的可站格。容許量只吸收格子取樣誤差，點在牆裡要算不合格。
  const snap = (p, reach = 0.4) => {
    const R = Math.ceil(reach / CELL);
    const ci = Math.floor((p.x - L.bounds.x0) / CELL);
    const cj = Math.floor((p.z - L.bounds.z0) / CELL);
    let best = -1;
    let bd = Infinity;
    for (let dj = -R; dj <= R; dj++) {
      for (let di = -R; di <= R; di++) {
        const i = ci + di;
        const j = cj + dj;
        if (i < 0 || j < 0 || i >= G.nx || j >= G.nz) continue;
        const c = j * G.nx + i;
        for (let u = G.cellStart[c]; u < G.cellStart[c + 1]; u++) {
          if (!surfOpen[u]) continue;
          if (p.y !== undefined && Math.abs(surfH[u] - p.y) > 0.75) continue;
          const d = Math.hypot(G.cx(i) - p.x, G.cz(j) - p.z);
          if (d <= reach && d < bd) {
            bd = d;
            best = u;
          }
        }
      }
    }
    return best;
  };

  const spawnNodes = { atk: [], def: [] };
  for (const team of ['atk', 'def']) {
    const label = team === 'atk' ? '攻方' : '守方';
    L.spawns[team].forEach((s, i) => {
      const u = snap(s);
      if (u < 0) fails.push(`${label}出生點 ${i} ${where(s.x, s.z)} 不在可站位置（牆內、懸空或太貼牆）`);
      else spawnNodes[team].push(u);
    });
  }

  const zone = {};
  for (const k of ['A', 'B']) {
    const s = L.sites[k];
    const nodes = [];
    const y = s.y ?? 0;
    for (let u = 0; u < M; u++) {
      if (!surfOpen[u]) continue;
      const x = sx(u);
      const z = sz(u);
      if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1 && Math.abs(surfH[u] - y) <= 1.5) nodes.push(u);
    }
    zone[k] = nodes;
    if (!nodes.length) fails.push(`炸點 ${k} 範圍內沒有可站的位置`);
  }

  res.spawnNodes = spawnNodes;
  if (!spawnNodes.atk.length || !spawnNodes.def.length || !zone.A.length || !zone.B.length) {
    res.ms = performance.now() - t0;
    return res;
  }

  const fromAtk = dijkstra(GR, M, spawnNodes.atk);
  const fromDef = dijkstra(GR, M, spawnNodes.def);
  const fromA = dijkstra(GR, M, zone.A);
  const reachAny = new Uint8Array(M);
  for (let u = 0; u < M; u++) {
    if (fromAtk.dist[u] < Infinity || fromDef.dist[u] < Infinity) reachAny[u] = 1;
  }

  // 可達性
  const checkReach = (name, u, x, z) => {
    if (fromAtk.dist[u] === Infinity) fails.push(`${name} ${where(x, z)} 從攻方出生點走不到`);
    if (fromDef.dist[u] === Infinity) fails.push(`${name} ${where(x, z)} 從守方出生點走不到`);
    if (fromA.dist[u] === Infinity) fails.push(`${name} ${where(x, z)} 從炸點 A 走不到`);
  };
  for (const team of ['atk', 'def']) {
    spawnNodes[team].forEach((u, i) => checkReach(`${team === 'atk' ? '攻方' : '守方'}出生點 ${i}`, u, sx(u), sz(u)));
  }
  for (const k of ['A', 'B']) {
    if (!zone[k].some((u) => fromAtk.dist[u] < Infinity)) fails.push(`炸點 ${k} 從攻方出生點走不到`);
    if (!zone[k].some((u) => fromDef.dist[u] < Infinity)) fails.push(`炸點 ${k} 從守方出生點走不到`);
  }

  // 破口
  const holes = new Map();
  for (let u = 0; u < M; u++) {
    if (!surfOpen[u] || !reachAny[u]) continue;
    const c = G.surfCell[u];
    const j = Math.floor(c / G.nx);
    const i = c - j * G.nx;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di;
      const nj = j + dj;
      const out = ni < 0 || nj < 0 || ni >= G.nx || nj >= G.nz;
      if (!out && G.filled[nj * G.nx + ni]) continue;
      const key = `${Math.round(sx(u) / 6)},${Math.round(sz(u) / 6)}`;
      if (!holes.has(key)) holes.set(key, [sx(u), sz(u)]);
    }
  }
  res.holes = [...holes.values()];
  if (res.holes.length) {
    const list = res.holes.slice(0, 6).map(([x, z]) => where(x, z)).join('、');
    fails.push(`地面有 ${res.holes.length} 處破口，走過去會掉出地圖：${list}`);
  }

  // 導航圖
  const navNode = new Map();
  const nav = { nodes: 0, edges: 0, bad: [] };
  for (const n of L.nav.nodes) {
    const u = snap(n);
    if (u < 0) {
      fails.push(`nav 節點 ${n.id} ${where(n.x, n.z)} 不在可站位置`);
      continue;
    }
    navNode.set(n.id, u);
    if (n.y !== undefined && Math.abs(surfH[u] - n.y) > 0.3) {
      warns.push(`nav 節點 ${n.id} 的 y=${n.y} 與地面 ${surfH[u].toFixed(2)} 差超過 0.3 m`);
    }
    nav.nodes++;
    checkReach(`nav 節點 ${n.id}`, u, n.x, n.z);
  }
  for (const [a, b] of L.nav.edges || []) {
    nav.edges++;
    const ua = navNode.get(a);
    const ub = navNode.get(b);
    if (ua === undefined || ub === undefined) continue;
    const ax = sx(ua); const az = sz(ua); const ah = surfH[ua];
    const bx = sx(ub); const bz = sz(ub); const bh = surfH[ub];
    const f = segWalk(G, ax, az, ah, bx, bz, bh);
    const r = f.ok ? segWalk(G, bx, bz, bh, ax, az, ah) : f;
    if (!r.ok) {
      const x = r.x ?? bx;
      const z = r.z ?? bz;
      const c = G.cellIdx(x, z);
      const who = (c >= 0 && G.near[c] ? [...new Set(G.near[c].map((i) => solids[i].id))] : ['懸空或高差']).slice(0, 3).join(' ');
      nav.bad.push({ a: [ax, az], b: [bx, bz], x, z });
      fails.push(`nav 邊 ${a}-${b} 走不通：卡在 ${where(x, z)}，${who}`);
    }
  }
  res.nav = nav;

  const navAdj = new Map(L.nav.nodes.map((n) => [n.id, []]));
  for (const [a, b] of L.nav.edges || []) {
    navAdj.get(a)?.push(b);
    navAdj.get(b)?.push(a);
  }
  const navSeen = new Set();
  const navParts = [];
  for (const n of L.nav.nodes) {
    if (navSeen.has(n.id)) continue;
    const part = [n.id];
    navSeen.add(n.id);
    for (let k = 0; k < part.length; k++) {
      for (const m of navAdj.get(part[k])) {
        if (!navSeen.has(m)) {
          navSeen.add(m);
          part.push(m);
        }
      }
    }
    navParts.push(part);
  }
  if (navParts.length > 1) {
    const list = navParts.map((p) => `${p[0]} 等 ${p.length} 點`).join('、');
    fails.push(`nav 分成 ${navParts.length} 塊，bot 走不到另一塊：${list}`);
  }
  for (const team of ['atk', 'def']) {
    spawnNodes[team].forEach((u, i) => {
      for (const v of navNode.values()) {
        if (segWalk(G, sx(u), sz(u), surfH[u], sx(v), sz(v), surfH[v]).ok) return;
      }
      fails.push(`${team === 'atk' ? '攻方' : '守方'}出生點 ${i} ${where(sx(u), sz(u))} 直線走不到任何 nav 節點`);
    });
  }

  // 到炸點時間
  const times = [];
  const measure = (seed, dj, site) => {
    let end = -1;
    let bd = Infinity;
    for (const u of site) {
      if (dj.dist[u] < bd) {
        bd = dj.dist[u];
        end = u;
      }
    }
    if (end < 0) return null;
    const { path, kinds } = extractPath(dj.prev, dj.kind, end);
    const { pts, airs } = pullPath(G, path, kinds);
    return { ...pathTime(G, pts, airs, GR), path, pts };
  };
  for (const team of ['atk', 'def']) {
    for (const k of ['A', 'B']) {
      const rows = [];
      for (const s of spawnNodes[team]) {
        const dj = dijkstra(GR, M, [s]);
        const m = measure(s, dj, zone[k]);
        if (m) rows.push(m);
      }
      const label = `${team === 'atk' ? '攻方' : '守方'}→${k}`;
      if (!rows.length) {
        times.push({ label, team, site: k, min: Infinity, max: Infinity, avg: Infinity, meters: 0, rows });
        continue;
      }
      const secs = rows.map((r) => r.sec);
      const min = Math.min(...secs);
      const max = Math.max(...secs);
      const avg = secs.reduce((p, q) => p + q, 0) / secs.length;
      const [lo, hi] = team === 'atk' ? LIMITS.atkSec : LIMITS.defSec;
      times.push({ label, team, site: k, min, max, avg, meters: rows[0].meters, rows, lo, hi });
      if (min < lo || max > hi) {
        fails.push(`${label} 時間 ${min.toFixed(1)}–${max.toFixed(1)} s 不在 ${lo}–${hi} s`);
      }
    }
  }
  res.times = times;

  // 視距
  const V = buildVision(G, solids);
  const sight = computeSight(G, V, reachAny);
  res.sight = sight;
  res.sightLine = refineSight(G, V, sight, reachAny);
  if (res.sightLine && res.sightLine.dist > LIMITS.maxSight) {
    const { dist, a, b } = res.sightLine;
    fails.push(`最長視距 ${dist.toFixed(1)} m 超過 ${LIMITS.maxSight} m：${where(...a)} ↔ ${where(...b)}`);
  }

  // 路線
  const flow = new Flow(GR, M, W, capW, surfOpen);
  const grow = (seeds, sec) => {
    const blocked = new Uint8Array(M);
    for (let u = 0; u < M; u++) if (W[u] < 3.5) blocked[u] = 1;
    const dj = dijkstra(GR, M, seeds, { blocked, maxSec: sec, walkOnly: true });
    const mark = new Uint8Array(M);
    for (const s of seeds) mark[s] = 1;
    for (let u = 0; u < M; u++) if (dj.dist[u] <= sec) mark[u] = 1;
    return mark;
  };
  const SPAWN_ZONE = 3;
  const SITE_ZONE = 1;
  const points = {
    atk: { name: '攻方出生', seeds: spawnNodes.atk, mark: grow(spawnNodes.atk, SPAWN_ZONE) },
    def: { name: '守方出生', seeds: spawnNodes.def, mark: grow(spawnNodes.def, SPAWN_ZONE) },
    A: { name: '炸點A', seeds: zone.A, mark: grow(zone.A, SITE_ZONE) },
    B: { name: '炸點B', seeds: zone.B, mark: grow(zone.B, SITE_ZONE) },
  };
  res.routes = [];
  for (const [sk, tk, minRoutes] of ROUTE_PAIRS) {
    const S = points[sk];
    const T = points[tk];
    const label = `${S.name}→${T.name}`;
    const isT = new Uint8Array(M);
    const isS = S.mark.slice();
    for (let u = 0; u < M; u++) {
      if (T.mark[u]) {
        isT[u] = 1;
        isS[u] = 0;
      }
    }
    for (const u of T.seeds) isT[u] = 1;
    const seeds = S.seeds.filter((u) => !isT[u]);
    const zoneSrcs = [];
    for (let u = 0; u < M; u++) if (isS[u] && surfOpen[u]) zoneSrcs.push(u);
    const entry = { label, sk, tk, minRoutes, flow: 0, passages: [], routes: [] };
    res.routes.push(entry);

    const isTseed = new Uint8Array(M);
    for (const u of T.seeds) isTseed[u] = 1;
    const neck = bottleneck(GR, M, W, S.seeds, isTseed);
    entry.neck = neck;
    if (neck.at < 0) {
      fails.push(`${label} 完全斷路`);
      continue;
    }
    if (neck.width < LIMITS.minChoke - EPS) {
      fails.push(`${label} 的必經通道只有 ${neck.width.toFixed(2)} m 寬：${where(sx(neck.at), sz(neck.at))}`);
    }

    const f = flow.solve(zoneSrcs, isT, isS, 12000);
    entry.flow = f / 1000;
    // 起訖區直接相鄰時沒有割，當成全開。
    const open = f >= 12000;
    const groups = open ? [] : groupCut(G, flow.cutNodes(), flow, W).filter((g) => g.cap >= 0.2);
    entry.passages = groups;

    const blockedAll = new Uint8Array(M);
    for (let u = 0; u < M; u++) if (W[u] < LIMITS.minChoke - EPS) blockedAll[u] = 1;
    for (const g of groups) for (const u of g.nodes) blockedAll[u] = 1;
    for (const g of groups) {
      for (const u of g.nodes) blockedAll[u] = 0;
      const dj = dijkstra(GR, M, seeds.length ? seeds : S.seeds, { blocked: blockedAll });
      const thin = bottleneck(GR, M, W, S.seeds, isTseed, blockedAll);
      for (const u of g.nodes) blockedAll[u] = 1;
      const m = measure(null, dj, T.seeds);
      if (!m) continue;
      const lo = thin.at;
      const vs = routeSight(G, sight, m.path);
      const via = [];
      for (let k = 0; k < m.path.length; k += 8) {
        const n = callout(sx(m.path[k]), sz(m.path[k]));
        if (via[via.length - 1] !== n) via.push(n);
      }
      entry.routes.push({
        sec: m.sec, meters: m.meters, jumps: m.jumps, width: thin.width, widthAt: lo,
        sight: vs.dist, via, gate: where(g.x, g.z), pts: m.pts,
      });
    }
    entry.routes.sort((p, q) => p.sec - q.sec);
    const count = open ? Infinity : entry.routes.length;
    entry.count = count;
    if (count < minRoutes) {
      const list = groups.map((g) => where(g.x, g.z)).join('、') || '無';
      fails.push(`${label} 不重疊路線只有 ${count} 條（要 ${minRoutes}，寬度低於 ${LIMITS.minChoke} m 的不算）；堵住 ${list} 就切斷`);
    }
  }

  // 屋頂被跳上去通常是漏洞，但也可能是刻意的平台。
  const roofs = new Set();
  solids.forEach((s) => {
    if (s.type !== 'block' || !s.stand) return;
    const c = G.cellIdx(s.x, s.z);
    if (c < 0) return;
    for (let u = G.cellStart[c]; u < G.cellStart[c + 1]; u++) {
      if (Math.abs(surfH[u] - s.y1) < 0.02 && reachAny[u]) roofs.add(s.id);
    }
  });
  if (roofs.size) warns.push(`這些量體的屋頂走得上去：${[...roofs].slice(0, 8).join(' ')}`);

  let unnamed = 0;
  let total = 0;
  for (let u = 0; u < M; u++) {
    if (!surfOpen[u] || !reachAny[u]) continue;
    total++;
    if (callout(sx(u), sz(u)) === '未命名區') unnamed++;
  }
  if (unnamed > total * 0.02) warns.push(`${((unnamed / total) * 100).toFixed(0)}% 的可達範圍沒有 callout，HUD 不會顯示地名`);

  res.stats = {
    cells: G.ncell, surfaces: M,
    open: surfOpen.reduce((p, q) => p + q, 0),
    edges: GR.E,
    reach: reachAny.reduce((p, q) => p + q, 0),
    ms: performance.now() - t0,
  };
  return res;
}

// ---------------- 雷達圖 ----------------

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ATK = '#C4552D';
const DEF = '#5FA89A';

function heightColor(y, lo, hi) {
  const t = hi > lo ? Math.min(1, Math.max(0, (y - lo) / (hi - lo))) : 0;
  const stops = [[58, 54, 48], [120, 104, 76], [214, 186, 128]];
  const p = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(p));
  const f = p - i;
  const mix = (k) => Math.round(stops[i][k] + (stops[i + 1][k] - stops[i][k]) * f);
  return `rgb(${mix(0)},${mix(1)},${mix(2)})`;
}

export function renderSvg(res) {
  const L = res.layout;
  const b = L.bounds;
  const SIZE = 1000;
  const PAD = 44;
  const scale = Math.min((SIZE - PAD * 2) / (b.x1 - b.x0), (SIZE - PAD * 2) / (b.z1 - b.z0));
  const ox = (SIZE - (b.x1 - b.x0) * scale) / 2;
  const oz = (SIZE - (b.z1 - b.z0) * scale) / 2;
  const X = (x) => +(ox + (x - b.x0) * scale).toFixed(2);
  const Z = (z) => +(oz + (b.z1 - z) * scale).toFixed(2);
  const S = (d) => +(d * scale).toFixed(2);
  const o = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" font-family="'PingFang TC','Heiti TC','Noto Sans CJK TC',sans-serif">`);
  o.push(`<rect width="${SIZE}" height="${SIZE}" fill="#17181a"/>`);
  o.push(`<rect x="${X(b.x0)}" y="${Z(b.z1)}" width="${S(b.x1 - b.x0)}" height="${S(b.z1 - b.z0)}" fill="#202224" stroke="#3a3c40"/>`);

  const ys = [...L.ground.map((g) => g.y), ...L.ramps.flatMap((r) => [r.y0, r.y1])];
  const lo = Math.min(...ys, 0);
  const hi = Math.max(...ys, 1);
  const rect = (x0, z0, x1, z1) => `x="${X(x0)}" y="${Z(z1)}" width="${S(x1 - x0)}" height="${S(z1 - z0)}"`;

  for (const g of [...L.ground].sort((p, q) => p.y - q.y)) {
    o.push(`<rect ${rect(g.x0, g.z0, g.x1, g.z1)} fill="${heightColor(g.y, lo, hi)}"/>`);
  }
  for (const r of L.ramps) {
    const mid = heightColor((r.y0 + r.y1) / 2, lo, hi);
    o.push(`<rect ${rect(r.x0, r.z0, r.x1, r.z1)} fill="${mid}" stroke="#e8d9b4" stroke-width="1" stroke-dasharray="3 2"/>`);
    const cx = (r.x0 + r.x1) / 2;
    const cz = (r.z0 + r.z1) / 2;
    const up = r.y1 >= r.y0;
    const sign = (r.dir[0] === '+') === up ? 1 : -1;
    const dx = r.dir[1] === 'x' ? sign * 1 : 0;
    const dz = r.dir[1] === 'z' ? sign * 1 : 0;
    o.push(`<line x1="${X(cx - dx)}" y1="${Z(cz - dz)}" x2="${X(cx + dx)}" y2="${Z(cz + dz)}" stroke="#fff" stroke-width="1.6"/>`);
    o.push(`<circle cx="${X(cx + dx)}" cy="${Z(cz + dz)}" r="2.4" fill="#fff"/>`);
  }
  for (const s of L.blocks) {
    if (s.plinth) continue; // 墊在板下的擋土塊畫出來會蓋掉高程底色
    const grey = 62 + Math.min(40, (s.y1 - s.y0) * 3);
    o.push(`<rect ${rect(s.x0, s.z0, s.x1, s.z1)} fill="rgb(${grey},${grey + 3},${grey + 8})" stroke="#0e0f10" stroke-width="1"/>`);
    if (s.y0 > 0.5) o.push(`<rect ${rect(s.x0, s.z0, s.x1, s.z1)} fill="none" stroke="#9fb4c8" stroke-dasharray="5 3"/>`);
  }
  for (const s of res.solids || []) {
    if (s.type !== 'wall') continue;
    const x0 = s.x - s.hx;
    const x1 = s.x + s.hx;
    const z0 = s.z - s.hz;
    const z1 = s.z + s.hz;
    const fill = !s.vis ? '#6fb4d8' : s.y0 > 0.5 ? '#6a6d72' : '#e6e2d8';
    o.push(`<rect ${rect(x0, z0, x1, z1)} fill="${fill}"/>`);
  }
  for (const c of L.cover) {
    const d = COVER_DIMS[c.kind];
    if (!d) continue;
    const fill = c.kind === 'mil' ? '#6f7f4f' : c.kind.startsWith('crate') ? '#a88355' : '#8c8c84';
    if (d.r) {
      o.push(`<circle cx="${X(c.x)}" cy="${Z(c.z)}" r="${S(d.r)}" fill="${fill}" stroke="#111" stroke-width="0.8"/>`);
    } else {
      o.push(`<rect x="${X(c.x) - S(d.w / 2)}" y="${Z(c.z) - S(d.d / 2)}" width="${S(d.w)}" height="${S(d.d)}" fill="${fill}" stroke="#111" stroke-width="0.8" transform="rotate(${c.rot || 0} ${X(c.x)} ${Z(c.z)})"/>`);
    }
  }
  if (L.sundial) {
    o.push(`<circle cx="${X(L.sundial.x)}" cy="${Z(L.sundial.z)}" r="${S(L.sundial.r)}" fill="none" stroke="#e9c46a" stroke-width="2"/>`);
  }
  for (const k of ['A', 'B']) {
    const s = L.sites[k];
    if (!s) continue;
    o.push(`<rect ${rect(s.x0, s.z0, s.x1, s.z1)} fill="#d8452c" fill-opacity="0.26" stroke="#ff6a48" stroke-width="2"/>`);
    o.push(`<text x="${X((s.x0 + s.x1) / 2)}" y="${Z((s.z0 + s.z1) / 2) + 15}" text-anchor="middle" font-size="42" font-weight="700" fill="#ffb49f">${k}</text>`);
  }

  // 導航圖
  const nodeById = new Map((L.nav.nodes || []).map((n) => [n.id, n]));
  for (const [a, c] of L.nav.edges || []) {
    const p = nodeById.get(a);
    const q = nodeById.get(c);
    if (!p || !q) continue;
    o.push(`<line x1="${X(p.x)}" y1="${Z(p.z)}" x2="${X(q.x)}" y2="${Z(q.z)}" stroke="#7fd0ff" stroke-opacity="0.55" stroke-width="1.1"/>`);
  }
  for (const n of L.nav.nodes || []) {
    o.push(`<circle cx="${X(n.x)}" cy="${Z(n.z)}" r="2.6" fill="#7fd0ff"/>`);
  }

  // 主要路線
  const G = res.G;
  if (G && res.times) {
    for (const t of res.times) {
      const r = t.rows?.[0];
      if (!r) continue;
      const d = r.pts.map((u) => `${X(G.sx(u))},${Z(G.sz(u))}`).join(' ');
      o.push(`<polyline points="${d}" fill="none" stroke="${t.team === 'atk' ? ATK : DEF}" stroke-width="2.2" stroke-opacity="0.9"/>`);
    }
  }

  // 問題標記
  if (res.sightLine?.b) {
    const { a, b: c, dist } = res.sightLine;
    const over = dist > LIMITS.maxSight;
    o.push(`<line x1="${X(a[0])}" y1="${Z(a[1])}" x2="${X(c[0])}" y2="${Z(c[1])}" stroke="${over ? '#ff3b6b' : '#f2e27a'}" stroke-width="2" stroke-dasharray="7 4"/>`);
  }
  for (const e of res.nav?.bad || []) {
    o.push(`<line x1="${X(e.a[0])}" y1="${Z(e.a[1])}" x2="${X(e.b[0])}" y2="${Z(e.b[1])}" stroke="#ff3b6b" stroke-width="2.5"/>`);
    o.push(`<circle cx="${X(e.x)}" cy="${Z(e.z)}" r="7" fill="none" stroke="#ff3b6b" stroke-width="2.5"/>`);
  }
  for (const [x, z] of res.holes || []) {
    o.push(`<circle cx="${X(x)}" cy="${Z(z)}" r="7" fill="#ff3b6b" fill-opacity="0.5" stroke="#ff3b6b" stroke-width="2"/>`);
  }
  for (const r of res.routes || []) {
    if (r.neck?.at >= 0 && r.neck.width < LIMITS.minChoke - EPS) {
      const u = r.neck.at;
      o.push(`<circle cx="${X(G.sx(u))}" cy="${Z(G.sz(u))}" r="9" fill="none" stroke="#ff3b6b" stroke-width="3"/>`);
    }
  }

  for (const team of ['atk', 'def']) {
    const color = team === 'atk' ? ATK : DEF;
    for (const s of L.spawns[team] || []) {
      const yaw = ((s.yaw || 0) * Math.PI) / 180;
      const tx = s.x + Math.sin(yaw) * 2;
      const tz = s.z + Math.cos(yaw) * 2;
      o.push(`<line x1="${X(s.x)}" y1="${Z(s.z)}" x2="${X(tx)}" y2="${Z(tz)}" stroke="#fff" stroke-width="1.4"/>`);
      o.push(`<circle cx="${X(s.x)}" cy="${Z(s.z)}" r="5.5" fill="${color}" stroke="#fff" stroke-width="1.2"/>`);
    }
  }
  for (const c of L.callouts || []) {
    const x = X((c.x0 + c.x1) / 2);
    const y = Z((c.z0 + c.z1) / 2);
    o.push(`<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="13" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${esc(c.name)}</text>`);
  }

  // 圖例
  const items = [
    [ATK, `攻方出生／路線`], [DEF, `守方出生／路線`], ['#7fd0ff', 'nav'],
    ['#e6e2d8', '牆'], ['#6fb4d8', '窗（擋身不擋視線）'], ['#a88355', '掩體'],
    ['#f2e27a', '最長視距'], ['#ff3b6b', '不合格'],
  ];
  let lx = 16;
  for (const [c, t] of items) {
    o.push(`<rect x="${lx}" y="976" width="12" height="12" fill="${c}"/>`);
    o.push(`<text x="${lx + 17}" y="986" font-size="12.5" fill="#c9c7c0">${esc(t)}</text>`);
    lx += 34 + t.length * 13;
  }
  o.push(`<text x="16" y="26" font-size="17" font-weight="600" fill="#ece8dc">${esc(L.name)}　俯視雷達圖（上北右東）</text>`);
  const bar = S(20);
  o.push(`<line x1="${SIZE - 24 - bar}" y1="24" x2="${SIZE - 24}" y2="24" stroke="#ece8dc" stroke-width="2"/>`);
  o.push(`<text x="${SIZE - 24 - bar / 2}" y="18" text-anchor="middle" font-size="12" fill="#ece8dc">20 m</text>`);
  // 高度圖例
  for (let i = 0; i < 40; i++) {
    const y = lo + ((hi - lo) * i) / 39;
    o.push(`<rect x="${SIZE - 150 + i * 3}" y="976" width="3.2" height="12" fill="${heightColor(y, lo, hi)}"/>`);
  }
  o.push(`<text x="${SIZE - 154}" y="986" text-anchor="end" font-size="12" fill="#c9c7c0">${lo.toFixed(1)} m</text>`);
  o.push(`<text x="${SIZE - 26}" y="986" font-size="12" fill="#c9c7c0">${hi.toFixed(1)}</text>`);
  o.push('</svg>');
  return o.join('\n');
}

// 只用 chrome-headless-shell；沒有就略過 PNG，絕不退回系統 Chrome（會搶使用者的滑鼠）。
async function findHeadlessShell() {
  const home = process.env.HOME || '';
  const candidates = [
    process.env.CHROME_PATH,
    '/private/tmp/claude-501/-Users-tommy-Documents-Proj-htmls/d07b21bf-cb2c-4065-ad56-ac08ea3e6e5a/scratchpad/pw/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  ].filter(Boolean);
  try {
    const { readdir } = await import('node:fs/promises');
    const cache = join(home, 'Library/Caches/ms-playwright');
    for (const d of (await readdir(cache)).sort().reverse()) {
      if (!d.startsWith('chromium_headless_shell-')) continue;
      candidates.push(join(cache, d, 'chrome-headless-shell-mac-arm64/chrome-headless-shell'));
      candidates.push(join(cache, d, 'chrome-mac/headless_shell'));
    }
  } catch { /* 沒有快取資料夾 */ }
  for (const p of candidates) {
    if (/chrome\.app|Google Chrome/i.test(p)) continue;
    try {
      await access(p);
      return p;
    } catch { /* 下一個 */ }
  }
  return null;
}

async function svgToPng(svg, out) {
  const exe = await findHeadlessShell();
  if (!exe) return '找不到 chrome-headless-shell（可設 CHROME_PATH）';
  const req = createRequire(join(TOOL_DIR, 'x.js'));
  let chromium;
  try {
    ({ chromium } = req('playwright-core'));
  } catch {
    return '找不到 playwright-core';
  }
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#17181a}svg{display:block}</style>${svg}`);
    await page.screenshot({ path: out });
  } finally {
    await browser.close();
  }
  return null;
}

// ---------------- 報告 ----------------

function report(res) {
  const out = [];
  const L = res.layout;
  const { G, where, times, routes, sightLine, nav, stats } = res;
  out.push(`== 地圖檢查：${L.name} ==`);
  if (stats) {
    out.push(`柵格 ${G.nx}×${G.nz}（${CELL} m），可站面 ${stats.open}／${stats.surfaces}，從出生點到得了 ${stats.reach}，圖邊 ${stats.edges}，耗時 ${(stats.ms / 1000).toFixed(1)} s`);
  }
  if (times) {
    out.push('', '[到炸點時間]（到炸點範圍第一格）');
    for (const t of times) {
      const mark = t.lo === undefined ? '' : (t.min >= t.lo && t.max <= t.hi ? '合格' : '不合格');
      out.push(`  ${t.label}  ${t.min.toFixed(1)}–${t.max.toFixed(1)} s（平均 ${t.avg.toFixed(1)}，目標 ${t.lo ?? '?'}–${t.hi ?? '?'}）${mark}  約 ${t.meters.toFixed(0)} m`);
    }
  }
  if (routes) {
    out.push('', '[路線]（不重疊＝要堵幾條通道才切得斷；必經最窄＝怎麼走都得過的最窄處）');
    for (const r of routes) {
      const neck = r.neck?.at >= 0 ? `${r.neck.width.toFixed(2)} m @ ${where(G.sx(r.neck.at), G.sz(r.neck.at))}` : '無';
      const n = r.count === Infinity ? '全開' : `${r.count ?? 0} 條`;
      out.push(`  ${r.label}：不重疊 ${n}（下限 ${r.minRoutes}），流量 ${r.flow.toFixed(2)}，必經最窄 ${neck}`);
      r.routes.forEach((q, i) => {
        const jump = q.jumps ? `，跳 ${q.jumps} 次` : '';
        out.push(`    ${i + 1}. ${q.sec.toFixed(1)} s ${q.meters.toFixed(0)} m${jump}，最窄 ${q.width.toFixed(2)} m @ ${where(G.sx(q.widthAt), G.sz(q.widthAt))}，最長視距 ${q.sight.toFixed(1)} m，分流口 ${q.gate}`);
        out.push(`       經 ${q.via.join(' → ')}`);
      });
    }
  }
  if (sightLine) {
    const c = sightLine.b;
    out.push('', `[視距] 全圖最長 ${sightLine.dist.toFixed(1)} m${c ? `：${where(...sightLine.a)} ↔ ${where(...c)}` : ''}（眼高 ${EYE}，上限 ${LIMITS.maxSight}）`);
  }
  if (nav) out.push(`[導航] 節點 ${nav.nodes}、邊 ${nav.edges}、走不通 ${nav.bad.length}`);
  if (res.warns.length) {
    out.push('', '[提醒]');
    for (const w of res.warns) out.push(`  - ${w}`);
  }
  out.push('');
  if (res.fails.length) {
    out.push(`[不合格] ${res.fails.length} 項`);
    for (const f of res.fails.slice(0, 24)) out.push(`  - ${f}`);
    if (res.fails.length > 24) out.push(`  …另有 ${res.fails.length - 24} 項`);
  } else {
    out.push('[全部合格]');
  }
  return out.join('\n');
}

async function main() {
  const [path, prefixArg] = process.argv.slice(2);
  if (!path) {
    console.log('用法：node tools/check-layout.mjs <layout.mjs 路徑> [輸出前綴]');
    process.exit(2);
  }
  let L;
  try {
    const mod = await import(pathToFileURL(resolve(path)).href);
    L = mod.LAYOUT;
  } catch (e) {
    console.log(`載入失敗：${e.message}`);
    process.exit(2);
  }
  if (!L) {
    console.log('載入失敗：模組沒有 export LAYOUT');
    process.exit(2);
  }
  const prefix = resolve(prefixArg || join(PROJECT_DIR, 'dist/design', basename(path, extname(path))));
  const res = checkLayout(L);
  console.log(report(res));
  await mkdir(dirname(prefix), { recursive: true });
  const svg = res.G ? renderSvg(res) : null;
  if (svg) {
    await writeFile(`${prefix}.svg`, svg);
    let msg = null;
    try {
      msg = await svgToPng(svg, `${prefix}.png`);
    } catch (e) {
      msg = e.message.split('\n')[0];
    }
    console.log(`\n雷達圖：${prefix}.svg${msg ? `（PNG 略過：${msg}）` : `、${prefix}.png`}`);
  }
  process.exit(res.fails.length ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
