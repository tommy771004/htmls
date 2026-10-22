// ═══ 路網圖：各區的路口與路段（世界座標）；車流、警車追捕、GPS、路障、叫車都走這張圖 ═══
// 節點是路口（區、i、j）；邊是兩個路口之間的路中心線，pts 是折線（方格裡的路是兩點的直線，區之間的連接道路是彎的）。
// 車在邊上的位置是 (e, dir, s)：dir = 1 從 a 往 b、-1 反過來，s 從出發路口的路口範圍（HR）邊緣量起，到 segLenE(e) 為止。
// 右駕：車道在前進方向的右手邊 LANE 公尺，右手邊 = (-fz, fx)。
const RN = { nodes: [], edges: [] };
const rnNode = new Map();   // `${區}:${i},${j}` → 節點
function rnAddNode(zn, i, j) {
  const [x, z] = toW(avX(i), stZ(j), zn);
  const n = { id: RN.nodes.length, zn, i, j, x, z, out: [] };
  RN.nodes.push(n); rnNode.set(`${zn.id}:${i},${j}`, n);
  return n;
}
function rnAddEdge(a, b, kind, zn, pts) {
  pts ||= [[a.x, a.z], [b.x, b.z]];
  const cum = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  const e = { id: RN.edges.length, a, b, kind, zn, pts, cum, len: cum.at(-1) };
  RN.edges.push(e); a.out.push({ e, dir: 1 }); b.out.push({ e, dir: -1 });
  return e;
}
// 片裡的路：只留旁邊至少有一塊留下來的街區（05-zones.js 的 DROP_CELLS）的路段與路口；路段每 8 m 取一點換到世界座標（彎曲之後是彎的）
const rnLine = (zn, x0, z0, x1, z1) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 8)), pts = []; for (let k = 0; k <= n; k++) pts.push(toW(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n, zn)); return pts; };
for (const zn of ZONES) {
  const has = (i, j) => i >= zn.ni0 && i < zn.ni1 && j >= zn.nj0 && j < zn.nj1 && !cellDropped(i, j);
  for (let i = zn.ni0; i <= zn.ni1; i++) for (let j = zn.nj0; j <= zn.nj1; j++) if (has(i - 1, j - 1) || has(i, j - 1) || has(i - 1, j) || has(i, j)) rnAddNode(zn, i, j);
  // 大道（沿邏輯 z）與街（沿邏輯 x）；順序和以前的方格迴圈一樣
  for (let i = zn.ni0; i <= zn.ni1; i++) for (let j = zn.nj0; j < zn.nj1; j++) if (has(i - 1, j) || has(i, j)) rnAddEdge(rnNode.get(`${zn.id}:${i},${j}`), rnNode.get(`${zn.id}:${i},${j + 1}`), 'z', zn, rnLine(zn, avX(i), stZ(j), avX(i), stZ(j + 1)));
  for (let j = zn.nj0; j <= zn.nj1; j++) for (let i = zn.ni0; i < zn.ni1; i++) if (has(i, j - 1) || has(i, j)) rnAddEdge(rnNode.get(`${zn.id}:${i},${j}`), rnNode.get(`${zn.id}:${i + 1},${j}`), 'x', zn, rnLine(zn, avX(i), stZ(j), avX(i + 1), stZ(j)));
}
const rnAt = (zn, i, j) => rnNode.get(`${zn.id}:${i},${j}`);
// 區之間的連接道路（kind 'c'）：兩區共用的邊界上，各自的邊界路口兩兩配對，用三次貝茲曲線接起來，兩端順著各自的區垂直離開邊界路。
// 兩片轉的角度不同，同一個 i、j 的路口會沿著縫錯開，所以不照編號配：近的、兩端大致面對面的先配（每個路口每個方向只接一條，
// 三區交會的路口也是），沿著縫的順序要一致（連接道路不交叉）；一對區一條都配不到時，接最近的那一對
{
  const used = new Set();
  const bez = (na, nb, ta, tb) => {
    const L = Math.hypot(nb.x - na.x, nb.z - na.z), h = L * .42, p1 = [na.x + ta[0] * h, na.z + ta[1] * h], p2 = [nb.x + tb[0] * h, nb.z + tb[1] * h], n = Math.max(6, Math.ceil(L / 3)), pts = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n, u = 1 - t;
      pts.push([u * u * u * na.x + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * nb.x, u * u * u * na.z + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * nb.z]);
    }
    return pts;
  };
  for (let a = 0; a < ZONES.length; a++) for (let b = a + 1; b < ZONES.length; b++) {
    const za = ZONES[a], zb = ZONES[b];
    let da, db, A = [], B = [];
    if (za.x1 === zb.x0 || za.x0 === zb.x1) {   // 東西相鄰：共用一條大道
      const i = za.x1 === zb.x0 ? za.ni1 : za.ni0, s = za.x1 === zb.x0 ? 1 : -1;
      da = [s, 0]; db = [-s, 0];
      for (let j = Math.max(za.nj0, zb.nj0); j <= Math.min(za.nj1, zb.nj1); j++) { A.push([i, j, j]); B.push([i, j, j]); }
    } else if (za.z1 === zb.z0 || za.z0 === zb.z1) {   // 南北相鄰：共用一條街
      const j = za.z1 === zb.z0 ? za.nj1 : za.nj0, s = za.z1 === zb.z0 ? 1 : -1;
      da = [0, s]; db = [0, -s];
      for (let i = Math.max(za.ni0, zb.ni0); i <= Math.min(za.ni1, zb.ni1); i++) { A.push([i, j, i]); B.push([i, j, i]); }
    } else continue;
    const cand = [];
    for (const [i, j, pa] of A) for (const [i2, j2, pb] of B) {
      const na = rnAt(za, i, j), nb = rnAt(zb, i2, j2);
      if (!na || !nb) continue;
      const dx = nb.x - na.x, dz = nb.z - na.z, L = Math.hypot(dx, dz) || 1;
      if (L > 160) continue;
      const ta = dirW(za, ...da, avX(i), stZ(j)), tb = dirW(zb, ...db, avX(i2), stZ(j2)), ca = (ta[0] * dx + ta[1] * dz) / L, cb = -(tb[0] * dx + tb[1] * dz) / L;
      cand.push({ na, nb, ta, tb, pa, pb, L, c: Math.min(ca, cb) });
    }
    const took = [], tryTake = (c) => {
      const ka = `${c.na.id}:${da}`, kb = `${c.nb.id}:${db}`;
      if (used.has(ka) || used.has(kb) || took.some(t => Math.sign(t.pa - c.pa) !== Math.sign(t.pb - c.pb) || t.pa === c.pa || t.pb === c.pb)) return;
      used.add(ka); used.add(kb); took.push(c);
    };
    for (const c of cand.filter(c => c.L < 110 && c.c > .55).sort((p, q) => p.L / p.c - q.L / q.c)) tryTake(c);
    if (!took.length && cand.length) tryTake(cand.sort((p, q) => p.L - q.L)[0]);
    for (const c of took.sort((p, q) => p.pa - q.pa)) rnAddEdge(c.na, c.nb, 'c', null, bez(c.na, c.nb, c.ta, c.tb));
  }
}
// ─── 斜穿片的大道（kind 'd'）：片裡從一個路口斜著穿過 n 個街區到對角的路口（邏輯座標的直線，跟著片彎），穿過的街區改成廣場
// （10-city.js 的 b.plaza：地塊留著當 ghost 照原寬度抽亂數、不蓋樓，人行道板沿大道切開，20-props.js 擺樹、長椅與噴水池）。
// 起點 (i, j) 是路口，di、dj 是 ±1；挑的格子不能有特殊地塊、實體建築、安全屋的門與地圖上的點（tools/check-diag 的清單見 README）
const DIAG = [
  { key: 'D2', i: 4, j: 7, di: 1, dj: 1, n: 4, name: 'Marlowe Blvd' },
  { key: 'F1', i: 13, j: 7, di: 1, dj: 1, n: 4, name: 'Cobalt Blvd' },
  { key: 'H1', i: 10, j: 11, di: 1, dj: 1, n: 4, name: 'Sable Blvd' },
];
const PLAZA = new Map();   // 'i,j'（格子）→ { D, ax, az, ux, uz }：格子裡那段斜線（起點與單位方向，邏輯座標）
for (const D of DIAG) {
  D.zn = ZONES.find(z => z.key === D.key); D.cells = [];
  for (let t = 0; t < D.n; t++) {
    const ia = D.i + D.di * t, ja = D.j + D.dj * t, ib = ia + D.di, jb = ja + D.dj, ci = Math.min(ia, ib), cj = Math.min(ja, jb);
    const ax = avX(ia), az = stZ(ja), dx = avX(ib) - ax, dz = stZ(jb) - az, l = Math.hypot(dx, dz);
    PLAZA.set(ci + ',' + cj, { D, ax, az, ux: dx / l, uz: dz / l, len: l });
    D.cells.push([ci, cj]);
    const na = rnAt(D.zn, ia, ja), nb = rnAt(D.zn, ib, jb);
    if (na && nb) rnAddEdge(na, nb, 'd', D.zn, rnLine(D.zn, ax, az, avX(ib), stZ(jb))).diag = D;
  }
}
// 邏輯座標的點在廣場格子裡的話，到那段斜線中心線的距離（不在廣場格子裡是 Infinity）
const plazaAt = (x, z) => PLAZA.get(Math.floor((x - X0) / P) + ',' + Math.floor((z - Z0) / Q));
const plazaD = (x, z) => { const p = plazaAt(x, z); return p ? Math.abs((x - p.ax) * p.uz - (z - p.az) * p.ux) : Infinity; };
// ─── 沿縫的快速道路（kind 'f'）：沿著幾對相鄰片之間的縫（兩片邊界路的中線）一路接下去的長路，和穿過縫的連接道路平面交叉
// （交叉點是新的路口 free：沒有片、沒有 i／j，號誌照 edgeAx 分兩相，快速道路一相、連接道路一相）。兩端停在最外面那條連接道路上，沒有死路。
// pairs 依序是縫的兩片（片的 key）；中線每 4 m 取一點，換片的地方平滑接過去
const FWY = [
  { name: 'Ridgeline Fwy', zh: '北嶺快速道路', pairs: [['A2', 'B1'], ['A2', 'B2'], ['D2', 'E'], ['E', 'G2'], ['G2', 'H1']] },
  { name: 'Harbor Fwy', zh: '港灣快速道路', pairs: [['A1', 'D1'], ['A1', 'D2'], ['A2', 'D2'], ['B2', 'E'], ['C1', 'F1'], ['C2', 'F2']] },
];
// 兩片之間的縫的中線：沿共用的邊界路走，這片的邊界路點與那片同一條路上對應的點取中點；w 是兩條路之間草地的寬
function seamMid(za, zb, step = 5, pad = 40) {
  const L = [];
  if (za.x1 === zb.x0 || za.x0 === zb.x1) {   // 東西相鄰：共用一條大道
    const i = za.x1 === zb.x0 ? za.ni1 : za.ni0;
    for (let z = stZ(Math.max(za.nj0, zb.nj0)) - pad; z <= stZ(Math.min(za.nj1, zb.nj1)) + pad; z += step) { const p = toW(avX(i), z, za), [, lz] = toL(p[0], p[1], zb); L.push([p, toW(avX(i), lz, zb)]); }
  } else if (za.z1 === zb.z0 || za.z0 === zb.z1) {   // 南北相鄰：共用一條街
    const j = za.z1 === zb.z0 ? za.nj1 : za.nj0;
    for (let x = avX(Math.max(za.ni0, zb.ni0)) - pad; x <= avX(Math.min(za.ni1, zb.ni1)) + pad; x += step) { const p = toW(x, stZ(j), za), [lx] = toL(p[0], p[1], zb); L.push([p, toW(lx, stZ(j), zb)]); }
  }
  return L.map(([p, q]) => ({ x: (p[0] + q[0]) / 2, z: (p[1] + q[1]) / 2, w: Math.hypot(p[0] - q[0], p[1] - q[1]) - 2 * HR }));
}
// 兩條折線的交點：[{ i, t, j, u, x, z }]（i、j 是線段編號，t、u 是線段上的比例）
function polyCross(A, B) {
  const out = [];
  for (let i = 1; i < A.length; i++) for (let j = 1; j < B.length; j++) {
    const p = A[i - 1], q = A[i], r = B[j - 1], s = B[j], d1x = q[0] - p[0], d1z = q[1] - p[1], d2x = s[0] - r[0], d2z = s[1] - r[1], den = d1x * d2z - d1z * d2x;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((r[0] - p[0]) * d2z - (r[1] - p[1]) * d2x) / den, u = ((r[0] - p[0]) * d1z - (r[1] - p[1]) * d1x) / den;
    if (t >= 0 && t < 1 && u >= 0 && u < 1) out.push({ i: i - 1, t, j: j - 1, u, x: p[0] + d1x * t, z: p[1] + d1z * t });
  }
  return out;
}
// 邊在 u（弧長）切成兩段：原本的邊留 a → m，新的邊 m → b 加在最後（RN.edges 前面的順序不變）
function rnSplit(e, u, m) {
  const { pts, cum } = e; let k = 1; while (k < pts.length - 1 && cum[k] < u) k++;
  const A = [...pts.slice(0, k), [m.x, m.z]], B = [[m.x, m.z], ...pts.slice(k)], b = e.b;
  const ob = b.out.find(o => o.e === e);
  b.out.splice(b.out.indexOf(ob), 1);
  e.pts = A; e.cum = [0]; for (let q = 1; q < A.length; q++) e.cum.push(e.cum[q - 1] + Math.hypot(A[q][0] - A[q - 1][0], A[q][1] - A[q - 1][1]));
  e.len = e.cum.at(-1); e.b = m; m.out.push({ e, dir: -1 });
  return rnAddEdge(m, b, e.kind, e.zn, B);
}
// 片裡的路（不含連接道路與斜的大道）的線段，40 m 一格分桶；fwyClear 把快速道路的點推離片的路（兩條路中心線至少 FWY_GAP：兩個半路寬加人行道），
// 縫太窄或三片交會的角落，縫的中線會壓到片的邊界路
const FWY_GAP = 2 * HR + SW + 3, segGrid = new Map(), sgKey = (x, z) => Math.floor(x / 40) + ',' + Math.floor(z / 40);
for (const e of RN.edges) if (e.kind !== 'c' && e.kind !== 'd') for (let k = 1; k < e.pts.length; k++) {
  const a = e.pts[k - 1], b = e.pts[k];
  for (let x = Math.floor(Math.min(a[0], b[0]) / 40) - 1; x <= Math.floor(Math.max(a[0], b[0]) / 40) + 1; x++) for (let z = Math.floor(Math.min(a[1], b[1]) / 40) - 1; z <= Math.floor(Math.max(a[1], b[1]) / 40) + 1; z++) {
    const key = x + ',' + z; (segGrid.get(key) || segGrid.set(key, []).get(key)).push([a, b]);
  }
}
function roadNear(x, z) {   // 最近的片路線段上的點與距離
  let best = Infinity, bx = 0, bz = 0;
  for (const [a, b] of segGrid.get(sgKey(x, z)) || []) {
    const dx = b[0] - a[0], dz = b[1] - a[1], t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1), px = a[0] + dx * t, pz = a[1] + dz * t, d = Math.hypot(x - px, z - pz);
    if (d < best) { best = d; bx = px; bz = pz; }
  }
  return [best, bx, bz];
}
function fwyOut([x, z]) {   // 點在片的範圍裡（邏輯座標的路網矩形）就搬到最近的邊外面一點
  for (const zn of ZONES) {
    const [lx, lz] = toL(x, z, zn), s = [lx - avX(zn.ni0), avX(zn.ni1) - lx, lz - stZ(zn.nj0), stZ(zn.nj1) - lz], d = Math.min(...s);
    if (d <= 0) continue;
    const k = s.indexOf(d), o = d + HR;
    return toW(lx + (k === 0 ? -o : k === 1 ? o : 0), lz + (k === 2 ? -o : k === 3 ? o : 0), zn);
  }
  return [x, z];
}
function fwyClear(P) {
  for (let it = 0; it < 40; it++) {
    P = P.map(fwyOut);
    P = P.map(([x, z]) => { const [d, px, pz] = roadNear(x, z); if (d >= FWY_GAP || d < 1e-6) return [x, z]; const k = (FWY_GAP - d) * .6 / d; return [x + (x - px) * k, z + (z - pz) * k]; });
    P = P.map((_, k) => { let x = 0, z = 0, n = 0; for (let d = -2; d <= 2; d++) { const q = P[clamp(k + d, 0, P.length - 1)]; x += q[0]; z += q[1]; n++; } return [x / n, z / n]; });
  }
  return P;
}
// 中線：各對縫依序接起來。每一段的方向照上一段的尾巴決定，接的地方在兩段最靠近的兩點剪開（兩段的 pad 互相重疊，直接接會折回來）
const resample = (Q, d) => { const out = [Q[0]]; let acc = 0; for (let k = 1; k < Q.length; k++) { const a = Q[k - 1], b = Q[k], l = Math.hypot(b[0] - a[0], b[1] - a[1]); let s = d - acc; while (s <= l) { out.push([a[0] + (b[0] - a[0]) * s / l, a[1] + (b[1] - a[1]) * s / l]); s += d; } acc = l - (s - d); } return out; };
for (const F of FWY) {
  const runs = F.pairs.map(([ka, kb]) => seamMid(ZONES.find(z => z.key === ka), ZONES.find(z => z.key === kb)).map(p => [p.x, p.z]));
  const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
  if (runs.length > 1) { const [a, b] = runs, near = p => Math.min(d2(p, b[0]), d2(p, b.at(-1))); if (near(a[0]) < near(a.at(-1))) a.reverse(); }
  let line = runs[0];
  for (const M0 of runs.slice(1)) {
    const e = line.at(-1), M = d2(M0[0], e) > d2(M0.at(-1), e) ? M0.reverse() : M0;
    let bi = line.length - 1, bj = 0, bd = Infinity;
    for (let i = Math.max(0, line.length - 40); i < line.length; i++) for (let j = 0; j < Math.min(40, M.length); j++) { const d = d2(line[i], M[j]); if (d < bd) { bd = d; bi = i; bj = j; } }
    line = [...line.slice(0, bi + 1), ...M.slice(bj)];
  }
  // 平滑：重取 4 m 一點、前後各 8 點平均三次（換片的轉角變成大彎）
  let P = resample(line, 4);
  for (let it = 0; it < 3; it++) P = P.map((_, k) => { let x = 0, z = 0, n = 0; for (let d = -8; d <= 8; d++) { const q = P[clamp(k + d, 0, P.length - 1)]; x += q[0]; z += q[1]; n++; } return [x / n, z / n]; });
  F.P = fwyClear(P);
}
// 交點：和連接道路（一條只切一次，兩次以上是沿著縫走、不是穿過；太靠近片的路口的不切），以及快速道路彼此（共用同一個路口，先列的那條是主線 maj）
const fwyNode = (x, z) => { const m = { id: RN.nodes.length, zn: null, i: 1000 + RN.nodes.length % 13, j: 1000 + RN.nodes.length % 7, x, z, out: [], free: 1 }; RN.nodes.push(m); return m; };
for (const F of FWY) F.X = [];
for (const F of FWY) for (const e of RN.edges) if (e.kind === 'c') {
  const cs = polyCross(F.P, e.pts);
  if (cs.length !== 1) continue;
  const c = cs[0], u = e.cum[c.j] + Math.hypot(c.x - e.pts[c.j][0], c.z - e.pts[c.j][1]);
  if (u > HR + 8 && u < e.len - HR - 8) F.X.push({ e, c, u, s: c.i + c.t });
}
FWY.forEach((F, a) => FWY.slice(a + 1).forEach(G => {
  for (const c of polyCross(F.P, G.P)) {
    const h = { c, maj: F };   // 路口要用到才建（被剪掉的端點外就不建，免得留下沒有路的節點）
    F.X.push({ h, s: c.i + c.t }); G.X.push({ h, s: c.j + c.u });
  }
}));
for (const F of FWY) {
  const { P, X } = F;
  X.sort((p, q) => p.s - q.s);
  // 兩端停在最外面的連接道路交點（快速道路彼此的交點不當端點）
  while (X.length && !X[0].e) X.shift();
  while (X.length && !X.at(-1).e) X.pop();
  if (X.length < 2) continue;
  F.nodes = []; F.edges = [];
  let prev = null;
  for (const x of X) {
    const m = x.h ? (x.h.n ||= Object.assign(fwyNode(x.h.c.x, x.h.c.z), { maj: x.h.maj })) : fwyNode(x.c.x, x.c.z);
    if (x.e) rnSplit(x.e, x.u, m);   // 連接道路在交點切開
    if (prev) {
      const pts = [[prev.n.x, prev.n.z]];
      for (let k2 = Math.ceil(prev.s); k2 <= Math.floor(x.s); k2++) if (k2 > prev.s && k2 < x.s) pts.push(P[k2]);
      pts.push([m.x, m.z]);
      F.edges.push(Object.assign(rnAddEdge(prev.n, m, 'f', null, pts), { fwy: F }));
    }
    F.nodes.push(m); prev = { n: m, s: x.s };
  }
}
const segLenE = e => e.len - 2 * HR;
// 邊上的點：u 是從 a 量起的弧長，回傳 [x, z, 前進方向 x, z]（a → b 的方向）
function edgeAt(e, u) {
  const { pts, cum } = e;
  let k = 1; while (k < pts.length - 1 && cum[k] < u) k++;
  const p = pts[k - 1], q = pts[k], L = cum[k] - cum[k - 1] || 1, t = (u - cum[k - 1]) / L;
  return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, (q[0] - p[0]) / L, (q[1] - p[1]) / L];
}
// 車道上的點：(e, dir, s) 往右偏 lane；回傳 [x, z, fx, fz]（fx、fz 是車頭方向）
function laneAt(e, dir, s, lane = LANE) {
  const u = dir > 0 ? HR + s : e.len - HR - s, [x, z, hx, hz] = edgeAt(e, u), fx = hx * dir, fz = hz * dir;
  return [x - fz * lane, z + fx * lane, fx, fz];
}
const edgeEnd = (e, dir) => dir > 0 ? e.b : e.a;
const edgeStart = (e, dir) => dir > 0 ? e.a : e.b;
// 從節點 n 沿 (e, dir) 出發的方向（世界座標的單位向量）
const outDir = (e, dir) => { const [, , hx, hz] = edgeAt(e, dir > 0 ? Math.min(HR, e.len / 2) : Math.max(e.len - HR, e.len / 2)); return [hx * dir, hz * dir]; };
// 號誌分兩相：邊在路口所在區的方向沿邏輯 z 是 'z'（大道），沿 x 是 'x'（街）；連接道路與斜的大道照離開路口的方向歸到比較接近的那一相
function edgeAx(n, e) { if (n.free) return e.kind === 'f' && (!n.maj || e.fwy === n.maj) ? 'z' : 'x'; if (e.kind === 'z' || e.kind === 'x') return e.kind; const [hx, hz] = outDir(e, e.a === n ? 1 : -1), [lx, lz] = dirL(n.zn, hx, hz, avX(n.i), stZ(n.j)); return Math.abs(lz) > Math.abs(lx) ? 'z' : 'x'; }
// 轉彎：進路口前的車道終點 p0、出路口後的車道起點 p2，控制點 p1 是兩條車道線的交點（直行或幾乎平行就取中點）
function turnPathE(eIn, dIn, eOut, dOut) {
  const [ax, az, fx, fz] = laneAt(eIn, dIn, segLenE(eIn)), [bx, bz, gx, gz] = laneAt(eOut, dOut, 0);
  const p0 = [ax, az], p2 = [bx, bz], cr = fx * gz - fz * gx;
  let p1 = [(ax + bx) / 2, (az + bz) / 2];
  if (Math.abs(cr) > .2) { const t = ((bx - ax) * gz - (bz - az) * gx) / cr; if (t > 0 && t < 40) p1 = [ax + fx * t, az + fz * t]; }
  let len = 0, px = ax, pz = az;
  for (let k = 1; k <= 12; k++) { const t = k / 12, q = bez(p0, p1, p2, t); len += Math.hypot(q[0] - px, q[1] - pz); px = q[0]; pz = q[1]; }
  return { p0, p1, p2, len };
}
// 到節點 goal 的最短路程（無向，邊長就是路程）
function rnField(goal) {
  const n = RN.nodes.length, D = new Float32Array(n).fill(1e9), done = new Uint8Array(n);
  D[goal] = 0;
  for (let it = 0; it < n; it++) {
    let b = -1; for (let k = 0; k < n; k++) if (!done[k] && (b < 0 || D[k] < D[b])) b = k;
    if (b < 0 || D[b] >= 1e9) break;
    done[b] = 1;
    for (const { e } of RN.nodes[b].out) { const m = e.a.id === b ? e.b.id : e.a.id; if (D[b] + e.len < D[m]) D[m] = D[b] + e.len; }
  }
  return D;
}
// 空間索引：每條邊的折線（往外 HR + 4）蓋到的 32 m 格子
const RN_S = 32, rnCells = new Map(), rnCK = (c, d) => (c + 1024) * 4096 + d + 1024;
for (const e of RN.edges) {
  const st = new Set();
  for (let k = 1; k < e.pts.length; k++) {
    const [x0, z0] = e.pts[k - 1], [x1, z1] = e.pts[k], n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 8);
    for (let s = 0; s <= n; s++) {
      const x = x0 + (x1 - x0) * s / n, z = z0 + (z1 - z0) * s / n, r = HR + 4;
      for (let c = Math.floor((x - r) / RN_S); c <= Math.floor((x + r) / RN_S); c++) for (let d = Math.floor((z - r) / RN_S); d <= Math.floor((z + r) / RN_S); d++) st.add(rnCK(c, d));
    }
  }
  for (const k of st) { let L = rnCells.get(k); if (!L) rnCells.set(k, L = []); L.push(e); }
}
// 離 (x, z) 最近的路中心線上的點：{ e, u（從 a 量起）, x, z, d }；搜尋半徑 r 內沒有路就往外擴
function rnProject(x, z, r = 64) {
  let best = null;
  for (let R = r; !best && R <= 2048; R *= 2) {
    const seen = new Set();
    for (let c = Math.floor((x - R) / RN_S); c <= Math.floor((x + R) / RN_S); c++) for (let d = Math.floor((z - R) / RN_S); d <= Math.floor((z + R) / RN_S); d++) {
      for (const e of rnCells.get(rnCK(c, d)) || []) {
        if (seen.has(e)) continue; seen.add(e);
        for (let k = 1; k < e.pts.length; k++) {
          const [ax, az] = e.pts[k - 1], [bx, bz] = e.pts[k], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
          const t = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1), px = ax + dx * t, pz = az + dz * t, dd = Math.hypot(x - px, z - pz);
          if (!best || dd < best.d) best = { e, u: e.cum[k - 1] + Math.sqrt(L2) * t, x: px, z: pz, d: dd };
        }
      }
    }
  }
  return best;
}
// 離 (x, z) 最近的路口
function rnNearest(x, z, filter) {
  let best = null, bd = 1e18;
  for (const n of RN.nodes) { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd && (!filter || filter(n))) { bd = d; best = n; } }
  return best;
}
// 離 (x, z) 最近的車道點（叫車、交車）：投影到最近的路，選靠 (x, z) 那一側的車道，車頭順著那一側的車流
function rnLaneSpot(x, z, minS = 4) {
  const p = rnProject(x, z);
  if (!p) return { x, z, yaw: 0 };
  const e = p.e, [, , hx, hz] = edgeAt(e, p.u), side = (x - p.x) * -hz + (z - p.z) * hx;   // > 0：在 a → b 方向的右手邊
  const dir = side >= 0 ? 1 : -1, sl = segLenE(e);
  const s = clamp(dir > 0 ? p.u - HR : e.len - HR - p.u, Math.min(minS, sl / 2), Math.max(sl - minS, sl / 2));
  const [lx, lz, fx, fz] = laneAt(e, dir, s);
  return { x: lx, z: lz, yaw: Math.atan2(fx, fz), e, dir, s };
}
// ─── 鐵灣高架斷橋（69-heist.js 的逃亡路線，平常也能當特技跳台）：片之間的縫裡，沿著縫爬升的半截高架橋，斷口停在一條連接道路前 14 m；
// 飛過那條路落在後面的草地（廢棄的鐵軌）。自動挑：連接道路中點往縫的兩個方向量，跑道（斷口前 L + 16 m）與落地區都不碰片的路與街區、
// 也不碰別的連接道路；夠長的裡面挑離鐵灣貨場（69-heist.js 的 YARD，舊城與冠石交界的南端）最近的那條。
// 世界座標；(x, z) 是斷口，L、H、W 是斜坡長、斷口高與橋面寬（69-stunt.js 的跳台判斷吃這幾個欄位）
const BROKEN = (() => {
  const L = 38, H = 5.6, W = 7.6, gap = 14, RUN = gap + L + 16, cs = RN.edges.filter(e => e.kind === 'c' && e.len > 24), fw = RN.edges.filter(e => e.kind === 'f');
  const [tx, tz] = toW(avX(5), stZ(7) - 26, ZONES[0]);   // 貨場
  // 離 e 以外的連接道路中心線的距離超過 HR + 5、不在片的路與街區旁、在外緣裡面：草地
  const grass = (x, z, e) => inCity(x, z) && !zoneNearL(x, z, HR + 4) && [...cs, ...fw].every(o => o === e || o.pts.every(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 > (HR + 5) ** 2));
  const reach = (e, mx, mz, dx, dz, a0, max) => { let a = a0; while (a < max && grass(mx + dx * a, mz + dz * a, e)) a += 2; return a; };
  let best = null;
  for (const e of cs) {
    const [mx, mz, hx, hz] = edgeAt(e, e.len / 2);
    for (const sg of [1, -1]) {
      const dx = -hz * sg, dz = hx * sg;   // 沿著縫（垂直於連接道路）
      const run = reach(e, mx, mz, -dx, -dz, HR + 4, RUN + 2), land = reach(e, mx, mz, dx, dz, HR + 4, 150);
      const ok = run >= RUN && land >= 50, d = Math.hypot(mx - tx, mz - tz), sc = ok ? d : 1e6 + (RUN - run) * 100 + (50 - Math.min(50, land)) * 100;
      if (!best || sc < best.sc) best = { sc, e, mx, mz, dx, dz, land };
    }
  }
  const { e, mx, mz, dx, dz, land } = best, x = mx - dx * gap, z = mz - dz * gap;
  return { x, z, yaw: Math.atan2(dx, dz), dx, dz, L, H, W, i: null, broken: 1, road: e, mid: [mx, mz], land: land - 12 };
})();
// 斷橋的跑道、斜坡與落地區（縫裡的樹與連接道路的路燈讓開）：a 從斷口量起，往前是正
const brokenNear = (x, z, pad = 4) => { const B = BROKEN, a = (x - B.x) * B.dx + (z - B.z) * B.dz, b = (x - B.x) * B.dz - (z - B.z) * B.dx; return a > -B.L - 16 && a < B.land + 16 && Math.abs(b) < B.W / 2 + pad; };
