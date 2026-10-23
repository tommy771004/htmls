// ═══ 北嶺公園：城北樓牆的門（Cinder Av 北端）外面一片走得上去的山坡 ═══
// 範圍、高度函式（parkH）、步道（NPARK.trail）、觀景台與管理站的位置在 10-city.js 的 NPARK；groundHL 在範圍裡回傳 parkH，
// 玩家與相機就貼著坡走。這裡只建畫面與碰撞：山坡網格（A 區邏輯座標、4 m 一格，邊界接上 21-coast.js 的第一層遠景山脊）、
// 步道（主步道與往鐵道橋的三條岔路）、松林、圍籬、步道燈、門口的牌樓與路樁、管理站、山頂的雲階觀景台（鐵道橋那一段在 21-rail.js）。材質都是 MAT.ridge（150 m 內照一般的霧，再遠和山脊一樣淡）

const PARK_ZN = ZONES[0];
// 到步道的距離：所有步道（NPARK.trails）的點放進 8 m 的格子
const parkTrailD = (() => {
  const S = 8, cells = new Map(), key = (i, j) => i * 4096 + j;
  for (const p of NPARK.trails.flat()) { const k = key(Math.floor(p[0] / S), Math.floor(p[1] / S)); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(p); }
  return (x, z, max = 16) => {
    let best = max; const r = Math.ceil(max / S), i0 = Math.floor(x / S), j0 = Math.floor(z / S);
    for (let i = i0 - r; i <= i0 + r; i++) for (let j = j0 - r; j <= j0 + r; j++) for (const p of cells.get(key(i, j)) || []) best = Math.min(best, Math.hypot(p[0] - x, p[1] - z));
    return best;
  };
})();
const parkGround = (x, z) => z < NPARK.z1 ? parkH(x, z) : .15;
// 步行的 NPC（警察、小隊）站的高度（世界座標）：城裡照舊是 0／0.15 兩階，公園的坡與觀景台、棧橋照 groundH
const footY = (X, Z) => { const h = groundH(X, Z); return h > .2 ? h : h > 0 ? .15 : 0; };

{
  // ─── 山坡網格 ───
  const nx = Math.round((NPARK.x1 - NPARK.x0) / 4), nz = Math.round((NPARK.z1 - NPARK.z0) / 4);
  const pos = new Float32Array((nx + 1) * (nz + 1) * 3), col = new Float32Array(pos.length), idx = [];
  const grass = [lin(0x3c5426), lin(0x4a5e2a), lin(0x2f4a24)], meadow = lin(0x6a7a3a), rock = lin(0x5a564c), far = lin(0x10180e), c = C3(0);
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = i === nx ? NPARK.x1 : NPARK.x0 + i * 4 * (NPARK.x1 - NPARK.x0) / (nx * 4), z = j === nz ? NPARK.z1 : NPARK.z0 + j * (NPARK.z1 - NPARK.z0) / nz;
    const y = i === 0 || i === nx || j === 0 ? parkBase(x, z) : parkH(x, z), k = (j * (nx + 1) + i) * 3;   // 邊界只用山脊頂點的內插，接得起來
    pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
    // 顏色：草地三種綠依雜訊混；門口一片淺色的草坪；陡的地方露出岩石；越靠網格邊界越接近遠景山脊的深綠
    const n = .5 + .5 * Math.sin(x * .05 + z * .031) * Math.sin(z * .047 - x * .019);
    c.copy(grass[0]).lerp(grass[1], n).lerp(grass[2], .5 + .5 * Math.sin(x * .013 - z * .009));
    const d = NPARK.z1 - z; if (d < 70 && Math.abs(x - NPARK.gx) < 60) c.lerp(meadow, (1 - d / 70) * (1 - Math.abs(x - NPARK.gx) / 60));
    const sx = parkH(x + 2, z) - parkH(x - 2, z), sz = parkH(x, z + 2) - parkH(x, z - 2), sl = Math.hypot(sx, sz) / 4;
    c.lerp(rock, sstep(.35, .7, sl));
    const e = Math.min(x - NPARK.x0, NPARK.x1 - x, z - NPARK.z0) / 90;
    c.lerp(far, NPARK.inWalk(x, z) ? 0 : (1 - sstep(0, 1, e)) * .9);
    col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, d = a + nx + 1, e = d + 1;
    idx.push(a, d, b, b, d, e);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3));
  g.setAttribute('color', new T.BufferAttribute(col, 3));
  g.setAttribute('aMat', new T.BufferAttribute(new Float32Array(pos.length / 3).fill(2), 1));
  g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  const m = new T.Mesh(g, MAT.ridge); m.name = 'parkHill'; cityAdd(m, PARK_ZN);
}

{
  // ─── 步道：沿 NPARK.trails 每條 2.6 m 寬的泥土路，貼在坡上 6 cm；進了鐵道橋模型的範圍就停（接上模型谷底自己的路）───
  const pos = [], col = [], idx = [], dirt = lin(0x7a6446), edge = lin(0x5c5034), V = VIADUCT;
  const inScan = (x, z) => V && x > V.x + V.lx0 + 2 && x < V.x + V.lx0 + V.W - 2 && z > V.z + V.lz0 + 2 && z < V.z + V.lz0 + V.D - 2;
  for (const P of NPARK.trails) {
    let prev = -1;
    for (let i = 0; i < P.length; i++) {
      if (inScan(P[i][0], P[i][1])) { prev = -1; continue; }
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, ox = -dz / l, oz = dx / l, n0 = pos.length / 3;
      for (const [s, c] of [[-1.5, edge], [-1, dirt], [1, dirt], [1.5, edge]]) {
        const x = P[i][0] + ox * s, z = P[i][1] + oz * s;
        pos.push(x, parkGround(x, z) + .06, z); col.push(c.r, c.g, c.b);
      }
      if (prev >= 0) for (let s = 0; s < 3; s++) { const q = prev + s, r = n0 + s; idx.push(q, r, q + 1, q + 1, r, r + 1); }
      prev = n0;
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  g.setAttribute('aMat', new T.Float32BufferAttribute(new Array(pos.length / 3).fill(2), 1));
  g.setIndex(idx); g.computeVertexNormals();
  for (let k = 1; k < g.attributes.normal.array.length; k += 3) if (g.attributes.normal.array[k] < 0) { g.setIndex(idx.map((v, n) => idx[n - n % 3 + [0, 2, 1][n % 3]])); g.computeVertexNormals(); break; }   // 繞序朝下就翻過來
  cityAdd(new T.Mesh(g, MAT.ridge), PARK_ZN);
}

{
  // ─── 松林與幾棵闊葉樹：整片山坡網格裡撒，避開步道、門口的草坪、管理站與觀景台；圍籬裡的樹幹有碰撞 ───
  const k = new Kit(), r = rng(9191), W = NPARK.walk, L = NPARK.look, C = NPARK.cabin, V = VIADUCT, F = NPARK.fence;
  const pine = [0x1e3a22, 0x24432a, 0x1a3320, 0x2c4a2a], leaf = [0x3a5a2a, 0x4a6230, 0x5a6a34];
  const dens = (NPARK.x1 - NPARK.x0) / 510;   // 網格加寬過（鐵道橋的隧道山頭），樹的數量照寬度加，密度不變
  const fenceD = (x, z) => { let m = 1e9; for (let i = 0; i < F.length - 1; i++) { const a = F[i], b = F[i + 1]; m = Math.min(m, Math.hypot(Math.max(0, Math.min(a[0], b[0]) - x, x - Math.max(a[0], b[0])), Math.max(0, Math.min(a[1], b[1]) - z, z - Math.max(a[1], b[1])))); } return m; };
  let n = 0;
  for (let tries = 0; tries < 9000 * dens && n < 2600 * dens; tries++) {
    const x = NPARK.x0 + 6 + r() * (NPARK.x1 - NPARK.x0 - 12), z = NPARK.z0 + 6 + r() * (NPARK.z1 - NPARK.z0 - 12), s = .75 + r() * .6, kind = r(), cr = r();
    const inWalk = NPARK.inWalk(x, z);
    const d = NPARK.z1 - z;
    if (d < 14) continue;   // 樓牆背面
    if (Math.abs(x - NPARK.gx) < 50 && d < 80) continue;   // 門口的草坪
    if (parkTrailD(x, z) < 5) continue;
    if (Math.hypot(x - L.cx, z - L.cz) < 16 || Math.hypot(x - C.x, z - C.z) < 12) continue;
    if (z > L.cz && z - L.cz < 260 && Math.abs(x - L.cx) < (z - L.cz) * .6 + 8) continue;   // 觀景台往南看出去的那一片不種
    if (fenceD(x, z) < 1.5) continue;   // 圍籬線上
    if (z < L.cz && L.cz - z < 150 && Math.abs(x - L.cx) < (L.cz - z) * .5 + 8) continue;   // 觀景台往北看鐵道橋的那一片也不種
    if (V && x > V.x + V.lx0 - 6 && x < V.x + V.lx0 + V.W + 6 && z > V.z + V.lz0 - 6 && z < V.z + V.lz0 + V.D + 6) continue;   // 鐵道橋的模型自己有樹
    if (V && V.ends.some(e => { const [o, d] = V.frame(e, x, z); return o > -26 && o < V.A + 12 && Math.abs(d) < (d * e.ux > 0 ? 40 : 26) || o > -26 && o < V.A + V.BORE + 8 && Math.abs(d) < 12; })) continue;   // 兩端的平台、南側的緩坡與洞門前、隧道上的蓋板
    const y = parkH(x, z) - .2;
    if (kind < .78) {
      const h = 9 * s, cl = lin(pine[Math.floor(cr * pine.length)]);
      k.cyl(x, y + h * .18, z, .14 * s, .22 * s, h * .36, 5, 0x3a2a1c, 2);
      k.add(new T.ConeGeometry(2.4 * s, h * .55, 6, 1, true), cl, 2, tf(x, y + h * .52, z, 0, cr * 6, 0));
      k.add(new T.ConeGeometry(1.7 * s, h * .45, 6, 1, true), cl, 2, tf(x, y + h * .8, z, 0, cr * 6 + .5, 0));
    } else {
      const h = 7 * s;
      k.cyl(x, y + h * .25, z, .16 * s, .24 * s, h * .5, 5, 0x4a3828, 2);
      k.add(new T.IcosahedronGeometry(2.6 * s, 0), lin(leaf[Math.floor(cr * leaf.length)]), 2, tf(x, y + h * .72, z, cr, cr * 3, 0, 1, .8, 1));
    }
    if (inWalk) circles.push({ x, z, r: .3 * s });
    n++;
  }
  const m = new T.Mesh(k.build(), MAT.ridge); m.name = 'parkTrees'; cityAdd(m, PARK_ZN);
}

{
  // ─── 圍籬（兩側與後面；前面是樓牆背面）、步道燈、長椅、門口的牌樓與路樁、管理站、觀景台 ───
  const k = new Kit(), W = NPARK.walk, wood = 0x6a4a2e, dark = 0x3a2a1c, stone = 0x6e6a62, warm = 0xffcf8a;
  const fence = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(len / 3), ux = (x1 - x0) / len, uz = (z1 - z0) / len;
    let px = x0, pz = z0, py = parkGround(px, pz);
    for (let i = 1; i <= n; i++) {
      const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n, y = parkGround(x, z);
      k.box(px, py + .5, pz, .14, 1.1, .14, dark, 2);
      const L = Math.hypot(x - px, z - pz), dy = y - py, mx = (px + x) / 2, mz = (pz + z) / 2, my = (py + y) / 2;
      for (const h of [.45, .9]) k.box(mx, my + h, mz, Math.abs(ux) > .5 ? Math.hypot(L, dy) : .08, .08, Math.abs(ux) > .5 ? .08 : Math.hypot(L, dy), wood, 2, Math.abs(ux) > .5 ? 0 : -Math.atan2(dy, L) * Math.sign(uz), 0, Math.abs(ux) > .5 ? Math.atan2(dy, L) * Math.sign(ux) : 0);
      px = x; pz = z; py = y;
    }
  };
  // 圍籬沿 NPARK.fence（原本的範圍和北嶺鐵道橋那一段合起來的外框，前面是樓牆背面不圍）
  const F = NPARK.fence;
  for (let i = 0; i < F.length - 1; i++) {
    const [x0, z0] = F[i], [x1, z1] = F[i + 1];
    fence(x0, z0, x1, z1);
    colliders.push({ x0: Math.min(x0, x1) - .3, x1: Math.max(x0, x1) + .3, z0: Math.min(z0, z1) - .3, z1: Math.max(z0, z1) + .3, low: 1 });
  }

  // 步道燈：每 36 m 一盞，左右交替（每條步道都是）；鐵道橋模型範圍裡貼著模型的地面
  for (const T0 of NPARK.trails) for (let i = 10, side = 1; i < T0.length - 6; i += 18, side = -side) {
    const a = T0[i - 1], b = T0[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    const x = T0[i][0] - dz / l * 2.2 * side, z = T0[i][1] + dx / l * 2.2 * side, y = parkWalkH(x, z);
    k.cyl(x, y + 1.6, z, .07, .09, 3.2, 6, dark, 15).box(x, y + 3.25, z, .34, .3, .34, warm, 11).box(x, y + 3.45, z, .5, .08, .5, dark, 15);
    coastLight(x, y + 3, z, warm, 12, 1.1);
    circles.push({ x, z, r: .12 });
  }
  const P = NPARK.trail;
  // 長椅：步道旁四張，面向步道
  for (const f of [.22, .45, .68, .9]) {
    const i = Math.floor(P.length * f), a = P[i - 1], b = P[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l;
    const x = P[i][0] + nx * 3, z = P[i][1] + nz * 3, y = parkGround(x, z), ry = Math.atan2(-nx, -nz);
    k.box(x, y + .45, z, 1.8, .08, .45, wood, 2, 0, ry).box(x - Math.sin(ry) * .2, y + .75, z - Math.cos(ry) * .2, 1.8, .4, .06, wood, 2, 0, ry);
    for (const s of [-.75, .75]) k.box(x + Math.cos(ry) * s, y + .22, z - Math.sin(ry) * s, .08, .45, .4, dark, 15, 0, ry);
    circles.push({ x, z, r: .6 });
  }

  // 門：牌樓（兩根石柱、一道木樑、招牌）、門口一排路樁、通道兩側的壁燈
  const g0 = NPARK.gx - NPARK.gw, g1 = NPARK.gx + NPARK.gw, zf = CITY_Z0 - SW - 1;
  for (const x of [g0 + .9, g1 - .9]) {
    k.box(x, .15 + 3.4, zf, 1.3, 6.8, 1.3, stone, 2).box(x, .15 + 6.95, zf, 1.6, .3, 1.6, dark, 2);
    circles.push({ x, z: zf, r: .9 });
    k.box(x + (x < NPARK.gx ? .75 : -.75), 4.4, zf + .3, .3, .4, .3, warm, 11); coastLight(x + (x < NPARK.gx ? 1.2 : -1.2), 4.2, zf + .8, warm, 10, 1.2);
  }
  k.box(NPARK.gx, 6.6, zf, g1 - g0, .9, .9, wood, 2).box(NPARK.gx, 7.2, zf, g1 - g0 + 1.2, .3, 1.5, dark, 2);
  for (let x = g0 + .5; x < g1; x += 1) k.cyl(x, .15 + .45, CITY_Z0 - 3, .12, .13, .9, 8, 0x2a2c30, 15).box(x, .15 + .82, CITY_Z0 - 3, .2, .05, .2, 0xd8b040, 10);
  for (const z of [CITY_Z0 - 18, CITY_Z0 - 34]) for (const x of [g0 + .2, g1 - .2]) { k.box(x, 3.2, z, .3, .5, .3, warm, 11); coastLight(x + (x < NPARK.gx ? .8 : -.8), 3, z, warm, 9, .9); }

  // 管理站：木屋、斜屋頂、門朝東邊的步道、亮著的窗、門口的燈與旗桿
  {
    const { x, z } = NPARK.cabin, y = Math.min(parkGround(x - 4, z - 3), parkGround(x + 4, z + 3), parkGround(x - 4, z + 3), parkGround(x + 4, z - 3)) - .3;
    k.box(x, y + .3, z, 8.4, .6, 6.4, stone, 2).box(x, y + 2.1, z, 8, 3.2, 6, 0x7a5636, 2);
    for (const s of [-1, 1]) k.box(x, y + 4.35, z + s * 1.7, 8.8, .2, 3.9, 0x3a3230, 2, s * .5, 0, 0);
    k.box(x, y + 4.05, z, 8.4, 1.4, .2, 0x7a5636, 2);
    k.box(x + 4.02, y + 1.6, z + 1.2, .08, 2.1, 1.1, dark, 2).box(x + 4.04, y + 1.9, z - 1.3, .06, 1, 1.6, warm, 11);
    for (const s of [-2, 0, 2]) k.box(x + s, y + 2.2, z - 3.02, 1.1, .9, .06, warm, 11);
    k.box(x + 4.6, y + .4, z + 1.2, 1.2, .2, 2, wood, 2);
    coastLight(x + 5, y + 3, z + .4, warm, 10, 1.2); coastLight(x, y + 2.5, z - 4.2, warm, 8, .7);
    k.cyl(x + 6.5, y + 4, z - 3.5, .06, .08, 8, 6, 0xb8b8b8, 15).box(x + 7.1, y + 7.3, z - 3.5, 1.2, .8, .03, 0x2c6a3a, 2);
    colliders.push({ x0: x - 4.2, x1: x + 4.2, z0: z - 3.2, z1: z + 3.2 });
    circles.push({ x: x + 6.5, z: z - 3.5, r: .12 });
  }

  // 雲階觀景台：9×9 m 木平台（groundHL 回傳 NPARK.look.h）、四根柱的亭頂、三面欄杆（南面留步道的入口）、望遠鏡
  {
    const L = NPARK.look, { cx, cz, h } = L;
    k.box(cx, h - .2, cz, 9, .4, 9, 0x8a6a46, 2);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const x = cx + sx * 4.2, z = cz + sz * 4.2, y0 = parkH(x, z) - .3, hh = h - .4 - y0;
      if (hh > .05) k.box(x, y0 + hh / 2, z, .3, hh, .3, dark, 2);
    }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { k.box(cx + sx * 3.2, h + 1.6, cz + sz * 3.2, .25, 3.2, .25, dark, 2); circles.push({ x: cx + sx * 3.2, z: cz + sz * 3.2, r: .2 }); }
    k.add(new T.ConeGeometry(5.6, 1.8, 4, 1), lin(0x3a3230), 2, tf(cx, h + 4.1, cz, 0, Math.PI / 4, 0));
    const rail = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), ax = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      k.box((x0 + x1) / 2, h + 1, (z0 + z1) / 2, ax ? len : .08, .08, ax ? .08 : len, wood, 2).box((x0 + x1) / 2, h + .5, (z0 + z1) / 2, ax ? len : .06, .06, ax ? .06 : len, wood, 2);
      for (let t = 0; t <= len + 1e-6; t += len / Math.max(1, Math.round(len / 1.5))) k.box(x0 + (x1 - x0) * t / len, h + .5, z0 + (z1 - z0) * t / len, .1, 1, .1, dark, 2);
      colliders.push({ x0: Math.min(x0, x1) - .12, x1: Math.max(x0, x1) + .12, z0: Math.min(z0, z1) - .12, z1: Math.max(z0, z1) + .12, low: 1 });
    };
    rail(L.x0, L.z0, L.x1, L.z0); rail(L.x0, L.z0, L.x0, L.z1); rail(L.x1, L.z0, L.x1, L.z1);
    rail(L.x0, L.z1, cx - 1.6, L.z1); rail(cx + 1.6, L.z1, L.x1, L.z1);
    // 入口的台階：從步道盡頭的坡面爬到平台
    { const y0 = parkH(cx, L.z1 + 1.6), n = Math.max(1, Math.ceil((h - y0) / .3)); for (let i = 0; i < n; i++) { const t = (i + 1) / (n + 1); k.box(cx, y0 + (h - y0) * t - .15, L.z1 + 1.4 - t * 1.4, 3, .3, .5, 0x8a6a46, 2); } }
    // 望遠鏡（投幣式）：西南角，朝山谷
    { const x = L.x0 + 1.2, z = L.z1 - 1; k.cyl(x, h + .6, z, .08, .1, 1.2, 8, 0x2a5a4a, 15).box(x, h + 1.3, z + .1, .28, .3, .5, 0x2a5a4a, 15, -.2); circles.push({ x, z, r: .25 }); }
    k.box(cx, h + .45, cz - 3.4, 3, .08, .5, wood, 2).box(cx, h + .22, cz - 3.4, 2.6, .44, .1, dark, 2);
    coastLight(cx, h + 3, cz, warm, 12, 1.1);
  }
  cityAdd(new T.Mesh(k.build(), MAT.ridge), PARK_ZN);

  // 招牌：牌樓正面、管理站門邊
  const sign = (w, h, x, y, z, ry, draw) => {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = Math.round(1024 * h / w);
    draw(cv.getContext('2d'), cv.width, cv.height);
    const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 4;
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tx, toneMapped: false, color: 0xb0b0b0 }));
    m.position.set(x, y, z); m.rotation.y = ry; cityAdd(m, PARK_ZN); return m;
  };
  const font = '"Avenir Next Condensed","DIN Condensed","Arial Narrow",system-ui,sans-serif';
  sign(g1 - g0 - 1.4, 1.1, NPARK.gx, 6.6, zf + .47, 0, (c, w, h) => {
    c.fillStyle = '#2a1e12'; c.fillRect(0, 0, w, h); c.strokeStyle = '#c8a46a'; c.lineWidth = 6; c.strokeRect(10, 10, w - 20, h - 20);
    c.fillStyle = '#f0dcae'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 ${Math.round(h * .42)}px ${font}`; c.fillText('北嶺國家公園', w / 2, h * .4);
    c.font = `600 ${Math.round(h * .2)}px ${font}`; c.fillStyle = '#c8b48a'; c.fillText('NORTH RIDGE NATIONAL PARK · 雲階步道 1.3 km', w / 2, h * .78);
  });
  const { x: cbx, z: cbz } = NPARK.cabin, cby = Math.min(parkGround(cbx - 4, cbz - 3), parkGround(cbx + 4, cbz + 3), parkGround(cbx - 4, cbz + 3), parkGround(cbx + 4, cbz - 3)) - .3;
  sign(2.2, .5, cbx + 4.12, cby + 3.05, cbz - .2, Math.PI / 2, (c, w, h) => {
    c.fillStyle = '#1e2a1a'; c.fillRect(0, 0, w, h); c.fillStyle = '#e8e0c0'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 ${Math.round(h * .5)}px ${font}`; c.fillText('管理站 RANGER STATION', w / 2, h / 2);
  });
}

