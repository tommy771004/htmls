// ═══ 實體建築的碰撞外形（空氣牆修正）───
// 有實體建築的街區原本整塊人行道內是一個碰撞盒（10-city.js 的 makeLots）：模型比地塊窄、淺，或前面有騎樓、廣場、中庭、水塔腳時，就多擋了一圈看不到的牆。
// 模型下載好之後（27-props.js 的 bldLoad 呼叫 bldCut），在街區的格子（FOOT_C）裡畫上模型在人的高度（FOOT_HS）切出來的牆、這個高度範圍裡的水平面，
// 以及頭頂上方（FOOT_ROOF–FOOT_CEIL）的天花板與雨棚；然後 blkFoot 從街區外面往裡灌：
//   1. 牆先加厚 FOOT_CLOSE 格再灌，門窗、欄杆間 1.5 m 以內的縫灌不進去（免得走進模型的空殼），灌完再往牆邊退回同樣的格數；
//   2. 頭頂有屋頂、離露天的地方超過 FOOT_EAVE 的格子不算（騎樓、屋簷下可以走，室內不行）；
//   3. 程式立面的地塊、還沒下載（或下載失敗由 lotFallback 補立面）的模型的地塊、bldSeam 補的立面（b.fill）整塊擋住。
// 灌不到的格子合併成矩形（邏輯座標，addBoxL 照片的彎曲換成仿射框），換掉這個街區原本的盒（blk 標記）。
// 格子往人行道多鋪 FOOT_OUT：bldAlign 把模型推到街面後，台階、門廊會凸出到人行道上（最多 ALIGN_OUT），也要擋住。
const FOOT_C = .25, FOOT_HS = [.35, .7, 1.1, 1.5, 1.9], FOOT_ROOF = 2.6, FOOT_CEIL = 8, FOOT_CLOSE = 3, FOOT_EAVE = 3, FOOT_OUT = 2;
// 街區的格子：人行道內的範圍（10-city.js 的 makeLots 一樣退 SW）再往外 FOOT_OUT，外面多一圈是人行道（灌水的起點）
function footGrid(b) {
  if (b.foot) return b.foot;
  const x0 = b.x0 + SW - FOOT_OUT, z0 = b.z0 + SW - FOOT_OUT, x1 = b.x1 - SW + FOOT_OUT, z1 = b.z1 - SW + FOOT_OUT;
  const ni = Math.ceil((x1 - x0) / FOOT_C - 1e-6), nj = Math.ceil((z1 - z0) / FOOT_C - 1e-6), nx = ni + 2, nz = nj + 2;
  return (b.foot = { x0, z0, x1, z1, nx, nz, wall: new Uint8Array(nx * nz), roof: new Uint8Array(nx * nz) });
}
// ─── 沿街模型與程式立面的交界：以模型為主 ───
// 模型的外框含雨棚、逃生梯、簷口與台階，10-city.js 照外框把模型正面貼齊地塊前緣，一樓的牆就常退在 1–3 m 後面，隔壁的程式立面凸出來、露出側牆。
// bldAlign（下載後、擺放前）：量模型在人的高度（FOOT_HS）切出來的前緣輪廓（沿寬度每 ALIGN_BIN 一格取最前面的東西），40 百分位當牆面
//   （台階、門廊這類窄的突出不算），整棟往街面推到牆面貼齊地塊前緣；最前面的東西最多凸出 ALIGN_OUT（路人走在離牆 0.8 m 以外），
//   牆面退超過 ALIGN_YARD 的是前院（停車場、廣場），不推。模型的幾何不改。
// bldSeam（切好外形後）：模型兩端的側牆往內縮（陽台、逃生梯撐大了外框），和隔壁的程式立面之間留一道縫：照隔壁地塊的樣式補一段立面
//   填到模型的側牆（高度照隔壁），碰撞一起擋住（b.fill）。縫寬超過 SEAM_MAX 的是側院，不補。
const ALIGN_BIN = .5, ALIGN_OUT = 1.2, ALIGN_YARD = 3, SEAM_MIN = .2, SEAM_MAX = 3, SEAM_D = 6;
function bldGap(it, s) {   // it 是 loadProps 的物件（parts 的幾何是模型座標，正面朝 +z），回傳要往前推幾公尺
  const hs = FOOT_HS.map(h => h / s), y0 = hs[0], y1 = hs[hs.length - 1], bin = ALIGN_BIN / s;
  let x0 = Infinity, x1 = -Infinity;
  for (const p of it.parts) { const a = p.geo.attributes.position.array; for (let k = 0; k < a.length; k += 3) { if (a[k] < x0) x0 = a[k]; if (a[k] > x1) x1 = a[k]; } }
  const n = Math.floor((x1 - x0) / bin);
  if (n < 4) return 0;
  const front = new Float32Array(n).fill(-Infinity);
  const seg = (ax, az, bx, bz) => {
    const m = Math.ceil(Math.abs(bx - ax) / (bin / 2)) + 1;
    for (let k = 0; k <= m; k++) { const t = k / m, i = Math.floor((ax + (bx - ax) * t - x0) / bin), z = az + (bz - az) * t; if (i >= 0 && i < n && z > front[i]) front[i] = z; }
  };
  for (const p of it.parts) {
    const g = p.geo, a = g.attributes.position.array, ix = g.index ? g.index.array : null, N = ix ? ix.length : a.length / 3;
    for (let k = 0; k < N; k += 3) {
      const A = (ix ? ix[k] : k) * 3, B = (ix ? ix[k + 1] : k + 1) * 3, C = (ix ? ix[k + 2] : k + 2) * 3;
      const lo = Math.min(a[A + 1], a[B + 1], a[C + 1]), hi = Math.max(a[A + 1], a[B + 1], a[C + 1]);
      if (hi < y0 || lo > y1) continue;
      if (hi - lo < .03 / s) { seg(a[A], a[A + 2], a[B], a[B + 2]); seg(a[B], a[B + 2], a[C], a[C + 2]); seg(a[C], a[C + 2], a[A], a[A + 2]); continue; }   // 人的高度裡的水平面（花台、矮牆頂）
      for (const h of hs) {
        if (h < lo || h > hi) continue;
        const q = [];
        for (const [u, v] of [[A, B], [B, C], [C, A]]) { const uy = a[u + 1], vy = a[v + 1]; if ((uy - h) * (vy - h) > 0 || uy === vy) continue; const t = (h - uy) / (vy - uy); q.push(a[u] + (a[v] - a[u]) * t, a[u + 2] + (a[v + 2] - a[u + 2]) * t); }
        if (q.length >= 4) seg(q[0], q[1], q[2], q[3]);
      }
    }
  }
  const gaps = [];
  for (let i = 1; i < n - 1; i++) if (front[i] > -Infinity) gaps.push((it.d / 2 - front[i]) * s);   // 兩端各留一格（側牆的轉角）
  if (gaps.length < (n - 2) * .3) return 0;   // 人的高度幾乎沒有東西（騎樓、架空）：不推
  gaps.sort((p, q) => p - q);
  const wall = gaps[Math.floor(gaps.length * .4)];
  return wall > ALIGN_YARD ? 0 : Math.max(0, Math.min(wall, gaps[0] + ALIGN_OUT));
}
function bldAlign(b, it) {   // b 是 bldPlace 的一筆（邏輯座標），只推沿街的一排（10-city.js 的 row）
  if (!b.row || b.gap !== undefined) return;
  const g = b.gap = bldGap(it, b.s);
  if (g < .05) return;
  const [w, d] = hmFoot(b, PROPS_SPEC[b.set].items[b.id]);
  hmRectL(b.x - w / 2 - 1, b.x + w / 2 + 1, b.z - d / 2 - 1, b.z + d / 2 + 1, HM_NONE, true);   // 舊位置的陰影高度（hmModel 只清新的位置）
  b.x += Math.sin(b.ry) * g; b.z += Math.cos(b.ry) * g;
}
function bldSeam(e) {
  const L0 = e.lots[0], ax = L0.axis, f = L0.face, b = e.blk, G = b && b.foot;
  if (!G || !e.cut) return;
  const along = L => ax === 'z' ? [L.x0, L.x1] : [L.z0, L.z1];
  const a0 = Math.min(...e.lots.map(L => along(L)[0])), a1 = Math.max(...e.lots.map(L => along(L)[1]));
  const face = ax === 'z' ? (f > 0 ? L0.z1 : L0.z0) : (f > 0 ? L0.x1 : L0.x0), dep = ax === 'z' ? L0.z1 - L0.z0 : L0.x1 - L0.x0;
  const wallAt = (u, d) => {   // 沿街 u、離前緣 d 的格子是不是模型的牆
    const x = ax === 'z' ? u : face - f * d, z = ax === 'z' ? face - f * d : u, i = footI(G, x), j = footJ(G, z);
    return i > 0 && j > 0 && i < G.nx - 1 && j < G.nz - 1 && G.wall[j * G.nx + i];
  };
  for (const [a, dir] of [[a0, 1], [a1, -1]]) {
    const nb = lots.find(L => L.b === L0.b && L.axis === ax && L.face === f && !L.back && !L.glb && !L.ghost && Math.abs(along(L)[dir > 0 ? 1 : 0] - a) < .05);
    if (!nb) continue;   // 隔壁是另一棟模型、街角或空地
    const dist = d => { for (let u = FOOT_C / 2; u < SEAM_MAX + FOOT_C; u += FOOT_C) if (wallAt(a + dir * u, d)) return u - FOOT_C / 2; return Infinity; };
    let w = Infinity, D = 0;
    for (let d = FOOT_C / 2; d < Math.min(SEAM_D, dep); d += FOOT_C) w = Math.min(w, dist(d));
    if (!(w >= SEAM_MIN && w <= SEAM_MAX)) continue;
    for (let d = FOOT_C / 2; d < dep && dist(d) >= w; d += FOOT_C) D = d + FOOT_C / 2;
    const u0 = a, u1 = a + dir * (w + FOOT_C / 2), v0 = face, v1 = face - f * Math.min(D, dep);
    const r = ax === 'z' ? { x0: Math.min(u0, u1), x1: Math.max(u0, u1), z0: Math.min(v0, v1), z1: Math.max(v0, v1) } : { x0: Math.min(v0, v1), x1: Math.max(v0, v1), z0: Math.min(u0, u1), z1: Math.max(u0, u1) };
    const B = { p: [], n: [], uv: [], b: [], b2: [], idx: [], zn: nb.zn };
    boxFaces(B, r.x0, r.x1, r.z0, r.z1, 0, nb.h, nb.seed, nb.style, null, nb.h, null);
    if (nb.style !== 3) {   // 簷口與一樓的腰帶接著隔壁（只往前後凸，不伸進模型）
      const o = .35, ox = ax === 'x' ? o : 0, oz = ax === 'z' ? o : 0, q = .18, qx = ax === 'x' ? q : 0, qz = ax === 'z' ? q : 0;
      boxFaces(B, r.x0 - ox, r.x1 + ox, r.z0 - oz, r.z1 + oz, nb.h - .55, nb.h + .06, nb.seed, 7, null, nb.h, null);
      boxFaces(B, r.x0 - qx, r.x1 + qx, r.z0 - qz, r.z1 + qz, 4.45, 4.75, nb.seed, 7, null, nb.h, null);
    }
    chunkMesh(B);
    hmRectL(r.x0, r.x1, r.z0, r.z1, nb.h, false, nb.zn);
    (b.fill || (b.fill = [])).push(r);
    (e.seams || (e.seams = [])).push(+w.toFixed(2));
  }
}
// 邏輯座標 → 格子（第 0 格與最後一格是街道）
const footI = (G, x) => Math.floor((x - G.x0) / FOOT_C) + 1, footJ = (G, z) => Math.floor((z - G.z0) / FOOT_C) + 1;
function footTri(G, L, ax, az, bx, bz, cx, cz) {   // 三角形蓋到的格子（格心在三角形裡；太細的至少標三個角）
  const i0 = Math.max(0, footI(G, Math.min(ax, bx, cx))), i1 = Math.min(G.nx - 1, footI(G, Math.max(ax, bx, cx))), j0 = Math.max(0, footJ(G, Math.min(az, bz, cz))), j1 = Math.min(G.nz - 1, footJ(G, Math.max(az, bz, cz)));
  if (i0 > i1 || j0 > j1) return;
  const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
  if (Math.abs(d) > 1e-9) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const px = G.x0 + (i - .5) * FOOT_C, pz = G.z0 + (j - .5) * FOOT_C, u = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / d, v = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / d;
    if (u >= 0 && v >= 0 && u + v <= 1) L[j * G.nx + i] = 1;
  }
  for (const [x, z] of [[ax, az], [bx, bz], [cx, cz]]) { const i = footI(G, x), j = footJ(G, z); if (i >= 0 && i < G.nx && j >= 0 && j < G.nz) L[j * G.nx + i] = 1; }
}
function footSeg(G, ax, az, bx, bz) {   // 牆的切線：每 0.1 m 標一格（比格子細，斜牆是 8 連通，4 連通的水灌不過去）
  const n = Math.ceil(Math.hypot(bx - ax, bz - az) / .1);
  for (let k = 0; k <= n; k++) {
    const t = n ? k / n : 0, i = footI(G, ax + (bx - ax) * t), j = footJ(G, az + (bz - az) * t);
    if (i >= 0 && i < G.nx && j >= 0 && j < G.nz) G.wall[j * G.nx + i] = 1;
  }
}
// 一棟模型（bldPlace 的 e，geos 是邏輯座標的幾何）畫進街區的格子
function bldCut(e, geos) {
  const G = footGrid(e.blk), y0c = FOOT_HS[0], y1c = FOOT_HS[FOOT_HS.length - 1];
  for (const g of geos) {
    const p = g.attributes.position.array, ix = g.index ? g.index.array : null, n = ix ? ix.length : p.length / 3;
    for (let k = 0; k < n; k += 3) {
      const a = (ix ? ix[k] : k) * 3, b = (ix ? ix[k + 1] : k + 1) * 3, c = (ix ? ix[k + 2] : k + 2) * 3;
      const ay = p[a + 1], by = p[b + 1], cy = p[c + 1], lo = Math.min(ay, by, cy), hi = Math.max(ay, by, cy);
      if (lo > FOOT_ROOF) {   // 頭上的面：只算 FOOT_CEIL 以下接近水平的（一樓的天花板、雨棚），牆面、樹葉的側面、高處的水塔與陽台不算
        if (lo > FOOT_CEIL) continue;
        const ux = p[b] - p[a], uy = by - ay, uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = cy - ay, vz = p[c + 2] - p[a + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        if (ny * ny > .5 * (nx * nx + ny * ny + nz * nz)) footTri(G, G.roof, p[a], p[a + 2], p[b], p[b + 2], p[c], p[c + 2]);
        continue;
      }
      if (hi < FOOT_ROOF && ay + by + cy > 3 * y0c) {   // 頭頂以下朝上的面、平均高過腳踝：墊高的地面、台階、攤子的頂（模型自帶的坡地切出來是一圈圈等高線，整片補起來）；跨過頭頂的斜屋頂不算（屋簷下照樣能走）
        const ux = p[b] - p[a], uy = by - ay, uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = cy - ay, vz = p[c + 2] - p[a + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        if (ny > 0 && ny * ny > .5 * (nx * nx + ny * ny + nz * nz)) footTri(G, G.wall, p[a], p[a + 2], p[b], p[b + 2], p[c], p[c + 2]);
      }
      if (hi < y0c || lo > y1c) continue;
      if (hi - lo < .03) { footTri(G, G.wall, p[a], p[a + 2], p[b], p[b + 2], p[c], p[c + 2]); continue; }   // 人的高度裡的水平面（花台、矮牆頂）
      for (const h of FOOT_HS) {
        if (h < lo || h > hi) continue;
        const s = [];
        for (const [u, v] of [[a, b], [b, c], [c, a]]) { const uy = p[u + 1], vy = p[v + 1]; if ((uy - h) * (vy - h) > 0 || uy === vy) continue; const t = (h - uy) / (vy - uy); s.push(p[u] + (p[v] - p[u]) * t, p[u + 2] + (p[v + 2] - p[u + 2]) * t); }
        if (s.length >= 4) footSeg(G, s[0], s[1], s[2], s[3]);
      }
    }
  }
  e.cut = 1;
}
// 方形的加厚（可分離：先橫再直）
function footDilate(src, nx, nz, k) {
  const t = new Uint8Array(src.length), out = new Uint8Array(src.length);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { if (!src[j * nx + i]) continue; for (let d = Math.max(0, i - k); d <= Math.min(nx - 1, i + k); d++) t[j * nx + d] = 1; }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { if (!t[j * nx + i]) continue; for (let d = Math.max(0, j - k); d <= Math.min(nz - 1, j + k); d++) out[d * nx + i] = 1; }
  return out;
}
// 重算一個街區的碰撞盒
function blkFoot(b) {
  const G = footGrid(b), { nx, nz } = G, N = nx * nz;
  const block = new Uint8Array(N);
  const mark = (x0, x1, z0, z1) => { for (let j = Math.max(1, footJ(G, z0 + FOOT_C / 2)); j <= Math.min(nz - 2, footJ(G, z1 - FOOT_C / 2)); j++) for (let i = Math.max(1, footI(G, x0 + FOOT_C / 2)); i <= Math.min(nx - 2, footI(G, x1 - FOOT_C / 2)); i++) block[j * nx + i] = 1; };
  for (const L of lots) if (L.b === b && !L.ghost && !(L.glb && L.glb.cut)) mark(L.x0, L.x1, L.z0, L.z1);   // ghost：設施街區原本的地塊
  for (const r of b.fill || []) mark(r.x0, r.x1, r.z0, r.z1);   // bldSeam 補的立面
  for (const e of b.ents) if (!e.cut && !e.lots.length) { const it = PROPS_SPEC[e.set]?.items[e.id]; if (it) { const [w, d] = hmFoot(e, it); mark(e.x - w / 2, e.x + w / 2, e.z - d / 2, e.z + d / 2); } }   // 同一街區的第二群（沒有地塊）
  const wallD = footDilate(G.wall, nx, nz, FOOT_CLOSE), open = new Uint8Array(N);
  // 1. 從街道灌（4 連通）
  let q = [];
  for (let i = 0; i < nx; i++) q.push(i, (nz - 1) * nx + i);
  for (let j = 1; j < nz - 1; j++) q.push(j * nx, j * nx + nx - 1);
  for (const k of q) open[k] = 1;
  const nb = k => { const i = k % nx; return [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, k - nx, k + nx]; };
  while (q.length) { const nq = []; for (const k of q) for (const m of nb(k)) if (m >= 0 && m < N && !open[m] && !block[m] && !wallD[m]) { open[m] = 1; nq.push(m); } q = nq; }
  // 退回加厚的那幾格（8 連通一層一層長，碰到真的牆就停）
  for (let s = 0; s < FOOT_CLOSE; s++) {
    const add = [];
    for (let k = 0; k < N; k++) {
      if (open[k] || block[k] || G.wall[k]) continue;
      const i = k % nx, j = (k / nx) | 0;
      let hit = 0;
      for (let dj = -1; dj <= 1 && !hit; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && ii < nx && jj >= 0 && jj < nz && open[jj * nx + ii]) { hit = 1; break; } }
      if (hit) add.push(k);
    }
    for (const k of add) open[k] = 1;
  }
  // 2. 屋頂下離露天超過 FOOT_EAVE 的地方（室內）不能走
  const dist = new Uint16Array(N).fill(65535);
  q = [];
  for (let k = 0; k < N; k++) if (open[k] && !G.roof[k]) { dist[k] = 0; q.push(k); }
  for (let s = 1; q.length; s++) { const nq = []; for (const k of q) for (const m of nb(k)) if (m >= 0 && m < N && open[m] && dist[m] === 65535) { dist[m] = s; nq.push(m); } q = nq; }
  const lim = FOOT_EAVE / FOOT_C;
  for (let k = 0; k < N; k++) if (open[k] && dist[k] > lim) open[k] = 0;
  // 3. 灌不到的格子（人行道內）合併成矩形。設施街區（b.fac，10-city.js 的 FAC）只換模型那幾塊地，其他樓有自己的盒（帶屋頂高度 hy）
  const used = new Uint8Array(N), rects = [], only = b.fac ? new Uint8Array(N) : null;
  if (only) for (const e of b.ents) for (const L of e.lots) for (let j = Math.max(1, footJ(G, L.z0 + FOOT_C / 2)); j <= Math.min(nz - 2, footJ(G, L.z1 - FOOT_C / 2)); j++) for (let i = Math.max(1, footI(G, L.x0 + FOOT_C / 2)); i <= Math.min(nx - 2, footI(G, L.x1 - FOOT_C / 2)); i++) only[j * nx + i] = 1;
  const solid = k => { const i = k % nx, j = (k / nx) | 0; return i > 0 && i < nx - 1 && j > 0 && j < nz - 1 && !open[k] && !used[k] && (!only || only[k]); };
  for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) {
    if (!solid(j * nx + i)) continue;
    let w = 1; while (i + w < nx - 1 && solid(j * nx + i + w)) w++;
    let h = 1; for (;;) { if (j + h >= nz - 1) break; let ok = true; for (let d = 0; d < w && ok; d++) ok = solid((j + h) * nx + i + d); if (!ok) break; h++; }
    for (let dj = 0; dj < h; dj++) for (let d = 0; d < w; d++) used[(j + dj) * nx + i + d] = 1;
    const r = { x0: G.x0 + (i - 1) * FOOT_C, x1: Math.min(G.x1, G.x0 + (i - 1 + w) * FOOT_C), z0: G.z0 + (j - 1) * FOOT_C, z1: Math.min(G.z1, G.z0 + (j - 1 + h) * FOOT_C), blk: b };
    if (b.fac) { const L = b.ents.flatMap(e => e.lots).find(L => r.x0 + .01 >= L.x0 - FOOT_C && r.x1 - .01 <= L.x1 + FOOT_C && r.z0 + .01 >= L.z0 - FOOT_C && r.z1 - .01 <= L.z1 + FOOT_C); if (L && L.col) { r.hy = L.col.hy; r.zn = L.col.zn; } }
    rects.push(r);
  }
  for (let k = colliders.length - 1; k >= 0; k--) if (colliders[k].blk === b) colliders.splice(k, 1);
  for (const r of rects) addBoxL(r);
  colDirty();
  b.footN = rects.length;
  return rects.length;
}
