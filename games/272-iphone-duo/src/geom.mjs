// 2D 截面幾何（XZ 平面）：精確 SDF 區域、CSG、邊界取樣、輪廓萃取。
// 每個零件是一組沿 Y 方向拉伸的稜柱，截面就是這裡的形狀。單位 mm，角度用弧度。
const TAU = Math.PI * 2;

// ---------- 邊 ----------
export const seg = (x0, z0, x1, z1) => ({ t: 0, x0, z0, x1, z1 });
export const arc = (cx, cz, r, a0, a1) => ({ t: 1, cx, cz, r, a0, a1 }); // 逆時針 a0→a1

function normA(a, a0) { while (a < a0) a += TAU; while (a >= a0 + TAU) a -= TAU; return a; }

function edgeDist(e, x, z) {
  if (e.t === 0) {
    const dx = e.x1 - e.x0, dz = e.z1 - e.z0, L2 = dx * dx + dz * dz;
    let k = L2 ? ((x - e.x0) * dx + (z - e.z0) * dz) / L2 : 0;
    k = k < 0 ? 0 : k > 1 ? 1 : k;
    return Math.hypot(x - e.x0 - k * dx, z - e.z0 - k * dz);
  }
  const ax = x - e.cx, az = z - e.cz;
  if (normA(Math.atan2(az, ax), e.a0) <= e.a1) return Math.abs(Math.hypot(ax, az) - e.r);
  return Math.min(
    Math.hypot(x - e.cx - e.r * Math.cos(e.a0), z - e.cz - e.r * Math.sin(e.a0)),
    Math.hypot(x - e.cx - e.r * Math.cos(e.a1), z - e.cz - e.r * Math.sin(e.a1)));
}

function edgeSample(e, h, out) {
  if (e.t === 0) {
    const n = Math.max(1, Math.ceil(Math.hypot(e.x1 - e.x0, e.z1 - e.z0) / h));
    for (let i = 0; i <= n; i++) out.push(e.x0 + (e.x1 - e.x0) * i / n, e.z0 + (e.z1 - e.z0) * i / n);
  } else {
    const n = Math.max(1, Math.ceil(e.r * (e.a1 - e.a0) / h));
    for (let i = 0; i <= n; i++) { const a = e.a0 + (e.a1 - e.a0) * i / n; out.push(e.cx + e.r * Math.cos(a), e.cz + e.r * Math.sin(a)); }
  }
}

function bbOf(arr) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < arr.length; i += 2) {
    const x = arr[i], z = arr[i + 1];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  return [x0, x1, z0, z1];
}

// 取樣點分塊，每塊帶外框，配對檢查時先用外框剔除
function chunk(flat, n = 96) {
  const out = [];
  for (let i = 0; i < flat.length; i += n * 2) {
    const p = flat.slice(i, i + n * 2);
    out.push({ p, bb: bbOf(p) });
  }
  return out;
}

// ---------- 基本區域：邊界由邊組成，SDF = ±到邊界的最短距離 ----------
class Region {
  constructor(edges, inside, bb, poly) { this.edges = edges; this.inside = inside; this.bb = bb; this.poly = poly; }
  sdf(x, z) {
    let d = Infinity;
    if (this.edges.length > 24) d = this.nearEdge(x, z);
    else for (const e of this.edges) { const v = edgeDist(e, x, z); if (v < d) d = v; }
    return this.inside(x, z) ? -d : d;
  }
  nearEdge(x, z) { // 邊數多的多邊形：以格網索引找最近邊
    if (!this._ix) {
      const cell = 0.2, m = new Map();
      this.edges.forEach((e, k) => {
        const a0 = Math.floor(Math.min(e.x0, e.x1) / cell), a1 = Math.floor(Math.max(e.x0, e.x1) / cell);
        const b0 = Math.floor(Math.min(e.z0, e.z1) / cell), b1 = Math.floor(Math.max(e.z0, e.z1) / cell);
        for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++) { const key = a * 65536 + b; (m.get(key) || m.set(key, []).get(key)).push(k); }
      });
      const bb = this.bb;
      this._ix = { cell, m, R: Math.ceil(Math.max(bb[1] - bb[0], bb[3] - bb[2]) / cell) + 2 };
    }
    const bb = this.bb, ox = Math.max(bb[0] - x, 0, x - bb[1]), oz = Math.max(bb[2] - z, 0, z - bb[3]);
    if (ox > 0.5 || oz > 0.5) return Math.hypot(ox, oz); // 遠在外框外：外框距離是下界（只當布林子形狀用）
    const { cell, m, R } = this._ix, gx = Math.floor(x / cell), gz = Math.floor(z / cell);
    let best = Infinity;
    const visit = (a, b) => {
      const l = m.get(a * 65536 + b); if (!l) return;
      for (const k of l) { const v = edgeDist(this.edges[k], x, z); if (v < best) best = v; }
    };
    for (let ring = 0; ring <= R + 4; ring++) {
      if ((ring - 1) * cell > best) break;
      if (ring === 0) { visit(gx, gz); continue; }
      for (let a = gx - ring; a <= gx + ring; a++) { visit(a, gz - ring); visit(a, gz + ring); }
      for (let b = gz - ring + 1; b <= gz + ring - 1; b++) { visit(gx - ring, b); visit(gx + ring, b); }
    }
    return best;
  }
  samples(h) {
    if (!this._s || this._h !== h) {
      const groups = [];
      for (const e of this.edges) { const a = []; edgeSample(e, h, a); groups.push(...chunk(a)); }
      this._s = groups; this._h = h;
    }
    return this._s;
  }
  loops(res = 0.05) { return [this.poly(res)]; }
}

export function rect(x0, x1, z0, z1) {
  const r = new Region(
    [seg(x0, z0, x1, z0), seg(x1, z0, x1, z1), seg(x1, z1, x0, z1), seg(x0, z1, x0, z0)],
    (x, z) => x > x0 && x < x1 && z > z0 && z < z1,
    [x0, x1, z0, z1],
    () => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
  r.kind = 'rect'; r.dims = [x0, x1, z0, z1];
  return r;
}

export function polygon(pts) {
  const edges = pts.map((p, i) => { const q = pts[(i + 1) % pts.length]; return seg(p[0], p[1], q[0], q[1]); });
  const inside = (x, z) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, zi] = pts[i], [xj, zj] = pts[j];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
    }
    return c;
  };
  const flat = pts.flat();
  return new Region(edges, inside, bbOf(flat), () => pts.map(p => [p[0], p[1]]));
}

// 環形扇區（r0 可為 0）；a0、a1 以度數傳入
export function sector(cx, cz, r0, r1, d0, d1) {
  const a0 = d0 * Math.PI / 180, a1 = d1 * Math.PI / 180, full = a1 - a0 >= TAU - 1e-9;
  const edges = [arc(cx, cz, r1, a0, a1)];
  if (r0 > 0) edges.push(arc(cx, cz, r0, a0, a1));
  if (!full) {
    edges.push(seg(cx + r0 * Math.cos(a0), cz + r0 * Math.sin(a0), cx + r1 * Math.cos(a0), cz + r1 * Math.sin(a0)));
    edges.push(seg(cx + r0 * Math.cos(a1), cz + r0 * Math.sin(a1), cx + r1 * Math.cos(a1), cz + r1 * Math.sin(a1)));
  }
  const inside = (x, z) => {
    const r = Math.hypot(x - cx, z - cz);
    if ((r0 > 0 && r <= r0) || r >= r1) return false;
    return full || normA(Math.atan2(z - cz, x - cx), a0) < a1;
  };
  // 外框：端點＋落在範圍內的四個象限極值
  const bx = [];
  for (const rr of [r0, r1]) for (const a of [a0, a1]) bx.push(cx + rr * Math.cos(a), cz + rr * Math.sin(a));
  for (let k = Math.ceil(a0 / (Math.PI / 2)); k * Math.PI / 2 <= a1; k++) { const a = k * Math.PI / 2; bx.push(cx + r1 * Math.cos(a), cz + r1 * Math.sin(a)); }
  const poly = (res) => {
    const n = Math.max(8, Math.ceil(r1 * (a1 - a0) / res)), out = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; out.push([cx + r1 * Math.cos(a), cz + r1 * Math.sin(a)]); }
    if (r0 > 0) for (let i = n; i >= 0; i--) { const a = a0 + (a1 - a0) * i / n; out.push([cx + r0 * Math.cos(a), cz + r0 * Math.sin(a)]); }
    else out.push([cx, cz]);
    if (full) out.pop();
    return out;
  };
  const s = new Region(edges, inside, bbOf(bx), poly);
  s.kind = 'sector'; s.dims = [cx, cz, r0, r1, d0, d1];
  return s;
}
export const circle = (cx, cz, r) => sector(cx, cz, 0, r, 0, 360);

const lo = (sh, x, z) => sh.sdf0 ? sh.sdf0(x, z) : sh.sdf(x, z);
// 取樣點網格：最近點查詢
export const REF_H = 0.01;
function sampleGrid(groups) {
  const cell = 0.05, m = new Map();
  for (const g of groups) for (let i = 0; i < g.p.length; i += 2) {
    const k = Math.floor(g.p[i] / cell) * 65536 + Math.floor(g.p[i + 1] / cell);
    (m.get(k) || m.set(k, []).get(k)).push(g.p[i], g.p[i + 1]);
  }
  return {
    nearest(x, z, cap) {
      const gx = Math.floor(x / cell), gz = Math.floor(z / cell);
      let best = cap * cap;
      const R = Math.ceil(cap / cell) + 1;
      const visit = (a, b) => {
        const l = m.get(a * 65536 + b); if (!l) return;
        for (let i = 0; i < l.length; i += 2) { const dx = l[i] - x, dz = l[i + 1] - z, d = dx * dx + dz * dz; if (d < best) best = d; }
      };
      for (let ring = 0; ring <= R; ring++) {
        if (ring > 1 && ((ring - 1) * cell) ** 2 > best) break;
        if (ring === 0) { visit(gx, gz); continue; }
        for (let a = gx - ring; a <= gx + ring; a++) { visit(a, gz - ring); visit(a, gz + ring); }
        for (let b = gz - ring + 1; b <= gz + ring - 1; b++) { visit(gx - ring, b); visit(gx + ring, b); }
      }
      return Math.sqrt(best);
    },
  };
}

// ---------- 布林運算（min/max 組合為保守距離：外部值不大於真實距離） ----------
class Csg {
  constructor(op, a, b) {
    this.op = op; this.a = a; this.b = b;
    const A = a.bb, B = b.bb;
    this.bb = op === 'u' ? [Math.min(A[0], B[0]), Math.max(A[1], B[1]), Math.min(A[2], B[2]), Math.max(A[3], B[3])]
      : op === 'i' ? [Math.max(A[0], B[0]), Math.min(A[1], B[1]), Math.max(A[2], B[2]), Math.min(A[3], B[3])] : A;
  }
  sdf0(x, z) { // min/max 組合：正負號精確、大小為下界（子形狀也用下界，只在最外層精確化）
    const a = lo(this.a, x, z);
    if (this.op === 'd') return Math.max(a, -lo(this.b, x, z));
    const b = lo(this.b, x, z);
    return this.op === 'u' ? Math.min(a, b) : Math.max(a, b);
  }
  // 精確化：1 mm 內改用「到真實邊界取樣點的最短距離 − H/2」與下界取大者（仍為保守值）
  sdf(x, z, cap = 1) {
    const s = this.sdf0(x, z);
    if (Math.abs(s) >= cap) return s;
    const n = this.near(x, z, cap), d = n >= cap ? cap : n - REF_H / 2; // 範圍內沒有邊界點 → 至少 cap
    return s < 0 ? -Math.max(-s, d) : Math.max(s, d);
  }
  near(x, z, cap) {
    if (!this._g) this._g = sampleGrid(this.samples(REF_H));
    return this._g.nearest(x, z, cap);
  }
  samples(h) {
    if (this._s && this._h === h) return this._s;
    const keep = [], eps = 1e-7;
    for (const src of [this.a, this.b]) for (const g of src.samples(h)) {
      const p = [];
      for (let i = 0; i < g.p.length; i += 2) {
        const x = g.p[i], z = g.p[i + 1];
        if (Math.abs(this.sdf0(x, z)) >= eps) continue;
        // 相鄰形狀的接縫在聯集內部：四周都在內 → 不是邊界
        const d = 2e-4;
        const o = [this.sdf0(x + d, z), this.sdf0(x - d, z), this.sdf0(x, z + d), this.sdf0(x, z - d)];
        if (o.some(v => v > 0) && o.some(v => v < 0)) p.push(x, z); // 只收兩側異號（真邊界）
      }
      if (p.length) keep.push(...chunk(p));
    }
    this._s = keep; this._h = h;
    return keep;
  }
  loops(res = 0.02) { return contour(this, res); }
}
export const uni = (...s) => s.reduce((a, b) => new Csg('u', a, b));
export const inter = (a, b) => new Csg('i', a, b);
export const cut = (a, ...bs) => bs.reduce((s, b) => new Csg('d', s, b), a);

// 鏡射（x → −x）
export function mirror(s) {
  return {
    src: s,
    bb: [-s.bb[1], -s.bb[0], s.bb[2], s.bb[3]],
    sdf: (x, z, cap) => s.sdf(-x, z, cap),
    sdf0: s.sdf0 ? (x, z) => s.sdf0(-x, z) : undefined,
    samples(h) {
      if (!this._s || this._h !== h) {
        this._s = s.samples(h).map(g => { const p = g.p.slice(); for (let i = 0; i < p.length; i += 2) p[i] = -p[i]; return { p, bb: [-g.bb[1], -g.bb[0], g.bb[2], g.bb[3]] }; });
        this._h = h;
      }
      return this._s;
    },
    loops(res) { return s.loops(res).map(l => l.map(([x, z]) => [-x, z]).reverse()); },
  };
}

// ---------- 帶厚度的曲線（排線、自由段顯示屏），以網格加速 ----------
export function ribbon(pts, half) {
  const n = pts.length, cell = 0.25;
  const bb = bbOf(pts.flat()); bb[0] -= half; bb[1] += half; bb[2] -= half; bb[3] += half;
  const nx = Math.ceil((bb[1] - bb[0]) / cell) + 1, nz = Math.ceil((bb[3] - bb[2]) / cell) + 1;
  const grid = new Map();
  for (let i = 0; i < n - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const cx0 = Math.floor((Math.min(x0, x1) - bb[0]) / cell), cx1 = Math.floor((Math.max(x0, x1) - bb[0]) / cell);
    const cz0 = Math.floor((Math.min(z0, z1) - bb[2]) / cell), cz1 = Math.floor((Math.max(z0, z1) - bb[2]) / cell);
    for (let a = cx0; a <= cx1; a++) for (let b = cz0; b <= cz1; b++) { const k = a * 100000 + b; (grid.get(k) || grid.set(k, []).get(k)).push(i); }
  }
  const segD = (i, x, z) => {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz;
    let k = L2 ? ((x - x0) * dx + (z - z0) * dz) / L2 : 0; k = k < 0 ? 0 : k > 1 ? 1 : k;
    return Math.hypot(x - x0 - k * dx, z - z0 - k * dz);
  };
  const sdf = (x, z) => {
    const ox = Math.max(bb[0] - x, 0, x - bb[1]), oz = Math.max(bb[2] - z, 0, z - bb[3]);
    if (ox > 0.6 || oz > 0.6) return Math.hypot(ox, oz) + 1e-9; // 遠處只需下界
    const gx = Math.floor((x - bb[0]) / cell), gz = Math.floor((z - bb[2]) / cell);
    let best = Infinity;
    const visit = (a, b) => {
      const l = grid.get(a * 100000 + b); if (!l) return;
      for (const i of l) { const d = segD(i, x, z); if (d < best) best = d; }
    };
    for (let ring = 0; ring < Math.max(nx, nz) + 2; ring++) {
      if ((ring - 1) * cell > best) break;
      if (ring === 0) { visit(gx, gz); continue; }
      for (let a = gx - ring; a <= gx + ring; a++) { visit(a, gz - ring); visit(a, gz + ring); }
      for (let b = gz - ring + 1; b <= gz + ring - 1; b++) { visit(gx - ring, b); visit(gx + ring, b); }
    }
    return best - half;
  };
  // 法線與兩側偏移線（邊界取樣）
  const nrm = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const tx = b[0] - a[0], tz = b[1] - a[1], L = Math.hypot(tx, tz) || 1;
    return [-tz / L, tx / L];
  });
  return {
    pts, half, bb, sdf, nrm,
    samples() {
      if (!this._s) {
        const a = [], b = [];
        for (let i = 0; i < n; i++) { a.push(pts[i][0] + nrm[i][0] * half, pts[i][1] + nrm[i][1] * half); b.push(pts[i][0] - nrm[i][0] * half, pts[i][1] - nrm[i][1] * half); }
        this._s = [...chunk(a), ...chunk(b)];
      }
      return this._s;
    },
    loops() {
      const up = pts.map((p, i) => [p[0] + nrm[i][0] * half, p[1] + nrm[i][1] * half]);
      const dn = pts.map((p, i) => [p[0] - nrm[i][0] * half, p[1] - nrm[i][1] * half]).reverse();
      return [[...up, ...dn]];
    },
  };
}

// ---------- 輪廓萃取（布林形狀用 marching squares） ----------
export function contour(s, res = 0.02) {
  const [x0, x1, z0, z1] = s.bb, pad = res * 2;
  const X0 = x0 - pad, Z0 = z0 - pad;
  const nx = Math.ceil((x1 - x0 + 2 * pad) / res) + 1, nz = Math.ceil((z1 - z0 + 2 * pad) / res) + 1;
  const v = new Float64Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    // 外框一圈視為外部，讓超出範圍的區域也能閉合（等於裁切到外框）
    v[j * nx + i] = (i === 0 || j === 0 || i === nx - 1 || j === nz - 1) ? 1 : s.sdf(X0 + i * res, Z0 + j * res);
  }
  // 交點以「格線邊編號」辨識，避免浮點誤差把迴圈斷開
  const pt = new Map();
  const edgePt = (id, i0, j0, i1, j1) => {
    if (!pt.has(id)) {
      const va = v[j0 * nx + i0], vb = v[j1 * nx + i1], t = va / (va - vb);
      pt.set(id, [X0 + (i0 + (i1 - i0) * t) * res, Z0 + (j0 + (j1 - j0) * t) * res]);
    }
    return id;
  };
  const H = (i, j) => edgePt(2 * (j * nx + i), i, j, i + 1, j);       // (i,j)–(i+1,j)
  const V = (i, j) => edgePt(2 * (j * nx + i) + 1, i, j, i, j + 1);   // (i,j)–(i,j+1)
  const segs = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = v[j * nx + i] < 0, b = v[j * nx + i + 1] < 0, c = v[(j + 1) * nx + i + 1] < 0, d = v[(j + 1) * nx + i] < 0;
    const e = [];
    if (a !== b) e.push(H(i, j));
    if (b !== c) e.push(V(i + 1, j));
    if (c !== d) e.push(H(i, j + 1));
    if (d !== a) e.push(V(i, j));
    if (e.length === 2) segs.push(e);
    else if (e.length === 4) { segs.push([e[0], e[1]]); segs.push([e[2], e[3]]); }
  }
  const adj = new Map();
  segs.forEach((sg, k) => { for (const id of sg) (adj.get(id) || adj.set(id, []).get(id)).push(k); });
  const used = new Uint8Array(segs.length), loops = [];
  for (let k = 0; k < segs.length; k++) {
    if (used[k]) continue;
    used[k] = 1;
    const ids = [segs[k][0], segs[k][1]];
    for (;;) {
      const last = ids[ids.length - 1], nk = (adj.get(last) || []).find(m => !used[m]);
      if (nk === undefined) break;
      used[nk] = 1;
      ids.push(segs[nk][0] === last ? segs[nk][1] : segs[nk][0]);
    }
    if (ids[ids.length - 1] === ids[0]) ids.pop();
    if (ids.length > 3) loops.push(simplify(ids.map(id => pt.get(id)), res * 0.15));
  }
  return loops;
}

function simplify(pts, tol) { // 刪掉近共線點：被略過的每一點到弦的距離都不超過 tol
  const out = [pts[0]];
  let ia = 0;
  const far = (a, c, p) => Math.abs((c[0] - a[0]) * (p[1] - a[1]) - (c[1] - a[1]) * (p[0] - a[0])) / (Math.hypot(c[0] - a[0], c[1] - a[1]) || 1);
  for (let j = 2; j < pts.length; j++) {
    let ok = true;
    for (let k = ia + 1; k < j && ok; k++) if (far(pts[ia], pts[j], pts[k]) > tol) ok = false;
    if (!ok || j - ia > 64) { ia = j - 1; out.push(pts[ia]); }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
