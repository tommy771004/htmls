// ═══ 實體建築的碰撞外形（空氣牆修正）───
// 有實體建築的街區原本整塊人行道內是一個碰撞盒（10-city.js 的 makeLots）：模型比地塊窄、淺，或前面有騎樓、廣場、中庭、水塔腳時，就多擋了一圈看不到的牆。
// 模型下載好之後（27-props.js 的 bldLoad 呼叫 bldCut），在街區的格子（FOOT_C）裡畫上模型在人的高度（FOOT_HS）切出來的牆、這個高度範圍裡的水平面，
// 以及頭頂上方（FOOT_ROOF–FOOT_CEIL）的天花板與雨棚；然後 blkFoot 從街區外面往裡灌：
//   1. 牆先加厚 FOOT_CLOSE 格再灌，門窗、欄杆間 1.5 m 以內的縫灌不進去（免得走進模型的空殼），灌完再往牆邊退回同樣的格數；
//   2. 頭頂有屋頂、離露天的地方超過 FOOT_EAVE 的格子不算（騎樓、屋簷下可以走，室內不行）；
//   3. 程式立面的地塊、還沒下載（或下載失敗由 lotFallback 補立面）的模型的地塊整塊擋住。
// 灌不到的格子合併成矩形（邏輯座標，addBoxL 照片的彎曲換成仿射框），換掉這個街區原本的盒（blk 標記）。
const FOOT_C = .25, FOOT_HS = [.35, .7, 1.1, 1.5, 1.9], FOOT_ROOF = 2.6, FOOT_CEIL = 8, FOOT_CLOSE = 3, FOOT_EAVE = 3;
// 街區的格子：人行道內的範圍（10-city.js 的 makeLots 一樣退 SW），外面多一圈是街道（灌水的起點）
function footGrid(b) {
  if (b.foot) return b.foot;
  const x0 = b.x0 + SW, z0 = b.z0 + SW, ni = Math.ceil((b.x1 - SW - x0) / FOOT_C - 1e-6), nj = Math.ceil((b.z1 - SW - z0) / FOOT_C - 1e-6), nx = ni + 2, nz = nj + 2;
  return (b.foot = { x0, z0, x1: b.x1 - SW, z1: b.z1 - SW, nx, nz, wall: new Uint8Array(nx * nz), roof: new Uint8Array(nx * nz) });
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
