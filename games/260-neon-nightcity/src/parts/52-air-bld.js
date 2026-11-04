// ═══ 灰鷺角機場的建築（Blender 模型 blender/airbld.py → 內嵌的 airbld.glb）：航廈 air_term、空橋 air_jetway（T1 三座、T2 四座）與外節的廣告燈箱 air_jwad_*、塔台 air_tower、機庫 air_hangar、第二航廈 air_t2、滑行道指示牌 air_sgn_* ═══
// 模型用 SEA_FR 座標寫（原點在各建築中心、沒有旋轉）。航廈、空橋、塔台是一個實例一個網格，材質 MAT.uxFI（遠景：城西岸隔著一公里的海也看得到，霧只算一部分距離，70-render 不剔；不吃點光）；
// 機庫烘進城市用 MAT.ux（要被裡面的天井燈照到）。
// 尺寸（airbld.py）：航廈牆 x ±78、z ±45（簷口 ±82、±51，屋頂 16.5–27 m）；空橋原點是旋轉廳，固定段往北 10.5 m 接進航廈南牆，機艙中心在南 24.6 m、
// 遮棚外緣在東 2.5 m（客機左側機身）；塔台基座 28 × 18 m；機庫 114 × 76 m，南面開口 x ±48、高 21 m，後面有工作間（到 z −46）。
// 沒有模型（解碼失敗）時用程式建模的替身。碰撞全部在這裡（SEA_FR 的盒與圓）。
// ─── 機場島的高度圖（日光陰影）：22-hmap.js 的城市高度圖只到城外 80 m，外海的機場島另畫一張（SEA_FR 座標、0.5 m 一格、半浮點，範圍見 21-air.js 的 AHM）。
// lib.mjs 的 sunVis 在城市圖外改查這張。航廈、空橋、塔台、機庫（這裡）、地勤車（52-air-gse.js）、停著的客機（21-air.js 的 airModels，模型下載好才畫）
// 的三角形投影下去（客機在 21-air.js 分幀畫），每格取蓋住它的三角形最高點（2.5D：機翼底下、機庫屋頂底下都算在陰影裡）。起降循環那一架會動，不畫。
// 貼圖本身（AHM）在 21-air.js 建：要在材質編譯前就掛上 U.uAHMap，晚掛的話先編好的管線綁的是預設貼圖，綁定對不上
function ahmTri(ax, ay, az, bx, by, bz, cx, cy, cz) {   // SEA_FR 座標的三角形：每格 4×4 個子取樣點（A.m 的位元）記覆蓋，三條邊另外點上（細桿不會漏）
  const A = AHM, h = Math.max(ay, by, cy); if (h < .4 || !A.h) return;
  const Q = 4 / A.S, fi = x => (x - A.x0) * Q, fj = z => (z - A.z0) * Q, NX = A.nx * 4, NZ = A.nz * 4;   // 子格座標
  const put = (u, w) => { if (u >= 0 && w >= 0 && u < NX && w < NZ) { const o = (w >> 2) * A.nx + (u >> 2); A.m[o] |= 1 << ((w & 3) * 4 + (u & 3)); if (h > A.h[o]) A.h[o] = h; } };
  const x0 = fi(ax), z0 = fj(az), x1 = fi(bx), z1 = fj(bz), x2 = fi(cx), z2 = fj(cz);
  const u0 = Math.floor(Math.min(x0, x1, x2)), u1 = Math.floor(Math.max(x0, x1, x2)), w0 = Math.floor(Math.min(z0, z1, z2)), w1 = Math.floor(Math.max(z0, z1, z2));
  A.max = Math.max(A.max, h); A.dirty = true;
  const den = (z1 - z2) * (x0 - x2) + (x2 - x1) * (z0 - z2);
  if (Math.abs(den) > 1e-6 && u1 > u0 && w1 > w0) for (let w = w0; w <= w1; w++) for (let u = u0; u <= u1; u++) {
    const px = u + .5, pz = w + .5, a = ((z1 - z2) * (px - x2) + (x2 - x1) * (pz - z2)) / den, b = ((z2 - z0) * (px - x2) + (x0 - x2) * (pz - z2)) / den;
    if (a >= 0 && b >= 0 && a + b <= 1) put(u, w);
  }
  for (const [sx, sz, ex, ez] of [[x0, z0, x1, z1], [x1, z1, x2, z2], [x2, z2, x0, z0]]) {
    const n = Math.ceil(Math.max(Math.abs(ex - sx), Math.abs(ez - sz)));
    for (let k = 0; k <= n; k++) { const t = n ? k / n : 0; put(Math.floor(sx + (ex - sx) * t), Math.floor(sz + (ez - sz) * t)); }
  }
}
// 幾何（e 是 SEA_FR 的 4×4 矩陣元素，沒有就是幾何本身已是 SEA_FR）
function ahmGeo(g, e) {
  if (!AHM) return;
  const p = g.attributes.position, ix = g.index ? g.index.array : null, n = ix ? ix.length : p.count, v = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let k = 0; k < n; k += 3) {
    for (let c = 0; c < 3; c++) {
      const i = ix ? ix[k + c] : k + c, x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (e) { v[c * 3] = e[0] * x + e[4] * y + e[8] * z + e[12]; v[c * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; v[c * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]; }
      else { v[c * 3] = x; v[c * 3 + 1] = y; v[c * 3 + 2] = z; }
    }
    ahmTri(...v);
  }
}
function ahmFlush() {   // 一格的值 = 最高點 × √覆蓋率、沒蓋到是 −0.6（略低於地面：太陽很低時平地不會自己遮自己）：線性取樣後輪廓跟著子取樣走，陰影邊不會是 0.5 m 的階梯
  if (!AHM || !AHM.dirty || !AHM.h) return;
  AHM.dirty = false; const d = AHM.tex.image.data, h = AHM.h, m = AHM.m;
  for (let o = 0; o < h.length; o++) { let b = m[o], c = 0; while (b) { b &= b - 1; c++; } d[o] = T.DataUtils.toHalfFloat(c ? h[o] * Math.sqrt(c / 16) : -.6); }
  AHM.tex.needsUpdate = true; U.uHM.value.w = Math.max(U.uHM.value.w, AHM.max + 1);
}
if (AIR_L) {
  const L = AIR_L, box = (x0, x1, z0, z1) => colliders.push({ x0, x1, z0, z1, zn: AIR_F }), circ = (x, z, r) => { const [X, Z] = airW(x, z); circles.push({ x: X, z: Z, r, w: 1 }); };
  const at = (x, z) => { const [X, Z] = airW(x, z); return { x: X, z: Z, ry: AIR_YAW, zn: null }; };
  const T0 = L.term, H = L.hangar, TW = L.tower, JZ = 200, T2 = L.t2;
  // 空橋外節兩側的廣告燈箱（airbld.py 的 air_jwad_*，和空橋同一個變換；T1 三座、T2 四座輪流用四款）
  const AD = ['lazarus', 'chrome', 'cable', 'dutyfree'], adAt = (gs, f) => AD.forEach((n, k) => { const L2 = gs.map((g, i) => [g, i]).filter(([, i]) => (i + f) % 4 === k).map(([g]) => g); if (PROPS['air_jwad_' + n] && L2.length) instanced(PROPS['air_jwad_' + n], MAT.uxFI, L2, 0, null); });
  if (PROPS.air_term && PROPS.air_jetway && PROPS.air_tower && PROPS.air_hangar) {
    instanced(PROPS.air_term, MAT.uxFI, [at(T0.x, T0.z)], 0, null);
    instanced(PROPS.air_jetway, MAT.uxFI, L.gates.map(g => at(g.x, JZ)), 0, null);
    adAt(L.gates.map(g => at(g.x, JZ)), 0);
    instanced(PROPS.air_tower, MAT.uxFI, [at(TW.x, TW.z)], 0, null);
    { const g = PROPS.air_hangar.clone(); g.translate(H.x, 0, H.z); cityAdd(new T.Mesh(g, MAT.ux), AIR_ZN); ahmGeo(g); }   // 機庫用一般材質：遠景材質不吃點光，門裡的地坪與後牆要被天井燈照到
    const mv = (x, z) => new T.Matrix4().makeTranslation(x, 0, z).elements;
    ahmGeo(PROPS.air_term, mv(T0.x, T0.z)); ahmGeo(PROPS.air_tower, mv(TW.x, TW.z)); for (const g of L.gates) ahmGeo(PROPS.air_jetway, mv(g.x, JZ));
  }
  if (PROPS.air_t2 && PROPS.air_jetway) {   // 第二航廈：模型原點在建築中心；空橋整座轉 180°（旋轉廳在 T2 北牆外 10.5 m，機艙往北伸）
    instanced(PROPS.air_t2, MAT.uxFI, [at(T2.x, T2.z)], 0, null);
    instanced(PROPS.air_jetway, MAT.uxFI, L.gates2.map(g => ({ ...at(g.x, T2.jz), ry: AIR_YAW + Math.PI })), 0, null);
    adAt(L.gates2.map(g => ({ ...at(g.x, T2.jz), ry: AIR_YAW + Math.PI })), 3);
    ahmGeo(PROPS.air_t2, new T.Matrix4().makeTranslation(T2.x, 0, T2.z).elements);
    for (const g of L.gates2) ahmGeo(PROPS.air_jetway, new T.Matrix4().makeTranslation(g.x, 0, T2.jz).multiply(new T.Matrix4().makeRotationY(Math.PI)).elements);
  }
  if (!(PROPS.air_term && PROPS.air_jetway && PROPS.air_tower && PROPS.air_hangar)) {
    const add = (k, x, z) => { const m = new T.Mesh(k.build(), MAT.far); m.position.set(x, 0, z); cityAdd(m, AIR_ZN); };
    { const k = new Kit(); k.box(0, 8.5, 0, 156, 17, 90, 0x8f969c, 10).box(0, 9, 45.2, 150, 12, .4, 0x1a2a33, 1); k.cyl(0, -102, 0, 129, 129, 164, 40, 0x9ea4aa, 15, 0, 0, Math.PI / 2); add(k, T0.x, T0.z); }
    { const k = new Kit(); k.cyl(0, 26, 0, 3.4, 4.4, 35, 12, 0xbdb8b0, 10).cyl(0, 52.5, 0, 7, 6, 5, 12, 0x1b2a2c, 1).box(0, 4.3, 0, 28, 8.6, 18, 0x8d939a, 10); add(k, TW.x, TW.z); }
    { const k = new Kit(); k.box(0, 12, -38, 114, 24, .6, 0x76808a, 10).box(-57, 10, 0, .6, 20, 76, 0x76808a, 10).box(57, 10, 0, .6, 20, 76, 0x76808a, 10).box(0, 25, 38, 114, 8, .6, 0x76808a, 10); add(k, H.x, H.z); }
    for (const g of L.gates) { const k = new Kit(); k.cyl(0, 5.8, 0, 2.4, 2.4, 3.4, 16, 0xcfd2d4, 10).box(0, 4.9, 13, 3, 2.9, 22, 0xcfd2d4, 10).box(.1, 4, 24.6, 3.6, 3.3, 4, 0xcfd2d4, 10); add(k, g.x, JZ); }
  }
  // 航廈：牆、南北兩排樹狀柱
  if (document.getElementById('glb-airint')) {   // 室內走得進去（52-air-int.js；模型走近才解，碰撞開場就放）：四面牆各一個盒，東牆中間 5.2 m 是開著的自動門
    box(T0.x - 78.3, T0.x + 78.6, T0.z - 45.1, T0.z - 44.4); box(T0.x - 78.3, T0.x + 78.6, T0.z + 44.4, T0.z + 45.5);
    box(T0.x - 78.3, T0.x - 77.4, T0.z - 44.4, T0.z + 44.4); box(T0.x + 77.4, T0.x + 78.6, T0.z - 44.4, T0.z - 2.6); box(T0.x + 77.4, T0.x + 78.6, T0.z + 2.6, T0.z + 44.4);
  } else box(T0.x - 78.3, T0.x + 78.6, T0.z - 45.1, T0.z + 45.5);
  for (const s of [-1, 1]) for (let x = -72; x <= 72; x += 24) circ(T0.x + x, T0.z + s * 49.5, .6);
  for (const z of [-22, -8, 8, 22]) circ(T0.x + 86.5, T0.z + z, .3);   // 東面入口雨遮的柱
  for (const z of [-12, 12]) circ(T0.x + 79.6, T0.z + z, 1.7);         // 旋轉門
  // 空橋：旋轉廳的柱、固定段的柱、升降柱、服務梯（機艙底 2.5 m，人與車從下面過）
  for (const g of L.gates) { circ(g.x, JZ, 1.0); circ(g.x, JZ - 6.5, .35); box(g.x - 1.65, g.x + 1.65, JZ + 16.6, JZ + 18.4); box(g.x - 2.8, g.x - 1.7, JZ + 18.8, JZ + 22.9); box(g.x - 3.55, g.x - 2.3, JZ - 5.6, JZ + .75); }   // 最後一個是旋轉廳的服務梯
  // 第二航廈（airbld.py 的 term2）：牆 x ±160、z ±30；空側懸挑下的白柱（z −35，24 m 一支）與防撞桿、陸側雨遮的柱（z 57）與安全島路緣的護柱（z 54.6）
  const T2OPEN = document.getElementById('glb-airint') ? [-20, 20, 60, 100, 140] : [];   // 室內走得進去（52-air-int.js）：這五座門斗打開（airbld.py 的 T2_OPEN），南牆在門口斷開
  if (T2OPEN.length) {
    box(T2.x - 160.5, T2.x + 160.5, T2.z - 30.2, T2.z - 29.7); box(T2.x - 160.5, T2.x - 159.8, T2.z - 29.7, T2.z + 29.7); box(T2.x + 159.8, T2.x + 160.5, T2.z - 29.7, T2.z + 29.7);
    const xs = [-160.5, ...T2OPEN.flatMap(d => [d - 1.6, d + 1.6]), 160.5];
    for (let i = 0; i < xs.length; i += 2) box(T2.x + xs[i], T2.x + xs[i + 1], T2.z + 29.7, T2.z + 30.3);
  } else box(T2.x - 160.5, T2.x + 160.5, T2.z - 30.2, T2.z + 30.3);
  for (let x = -142; x <= 146; x += 24) circ(T2.x + x, T2.z - 35, .6);
  for (let x = -144; x <= 156; x += 12) circ(T2.x + x, T2.z - 31, .15);
  for (let x = -150; x <= 150; x += 20) circ(T2.x + x, T2.z + 57, .5);
  for (let x = -150; x <= 150; x += 10) circ(T2.x + x, T2.z + 54.6, .12);
  for (let x = -140; x <= 140; x += 40) {   // 入口的門斗：打開的只擋兩側玻璃與推開的門扇（中間 3.2 m）
    if (!T2OPEN.includes(x)) { box(T2.x + x - 4.7, T2.x + x + 4.7, T2.z + 30, T2.z + 33.4); continue; }
    for (const s of [-1, 1]) { const a = x + s * 4.7, c = x + s * 1.6; box(T2.x + Math.min(a, c), T2.x + Math.max(a, c), T2.z + 30, T2.z + 30.15); box(T2.x + Math.min(a, c), T2.x + Math.max(a, c), T2.z + 33.1, T2.z + 33.4); box(T2.x + Math.min(x + s * 4.4, a), T2.x + Math.max(x + s * 4.4, a), T2.z + 30, T2.z + 33.4); }
  }
  // T2 的空橋（轉 180°：上面那幾個盒子對旋轉廳鏡射）
  for (const g of L.gates2) { const z = T2.jz; circ(g.x, z, 1.0); circ(g.x, z + 6.5, .35); box(g.x - 1.65, g.x + 1.65, z - 18.4, z - 16.6); box(g.x + 1.7, g.x + 2.8, z - 22.9, z - 18.8); box(g.x + 2.3, g.x + 3.55, z - .75, z + 5.6); }
  // 滑行道指示牌（airbld.py 的 SIGNS，正面朝 +z）：跑道等候點 A1–A4（等候線旁、連絡道的左手邊，面向從平行滑行道過來的飛機）、
  // 機坪出口 A5–A7（往滑行道 A）、T2 滑行通道往 K1 的轉角、K1 南端（從 T1 機坪往 T2）。合成一個網格（MAT.ux：底板與字入夜亮）
  { const S = [...[-3150, -2500, -1950, -1200].map((x, i) => ['h' + (i + 1), x + 18, 440, Math.PI]), ...[-2300, -1600, -1300].map((x, i) => ['a' + (i + 5), x + 18, 372, Math.PI]),
      ['k', L.lane2.x0 + 35, L.lane2.z + 18, Math.PI / 2], ['k1', L.link2.x - 18, L.link2.z1 - 10, 0]], list = [];
    for (const [n, x, z, ry] of S) {
      const P = PROPS['air_sgn_' + n]; if (!P) continue;
      const g = P.clone(); g.rotateY(ry); g.translate(x, 0, z); g.computeBoundingBox(); list.push(g);
      const b = g.boundingBox; colliders.push({ x0: b.min.x, x1: b.max.x, z0: b.min.z, z1: b.max.z, zn: AIR_F });
    }
    if (list.length) { const geo = mergeGeometries(list); for (const g of list) g.dispose(); cityAdd(new T.Mesh(geo, MAT.ux), AIR_ZN); }
  }
  // 塔台：基座、入口雨遮的柱
  box(TW.x - 14.4, TW.x + 14.4, TW.z - 9.4, TW.z + 9.4);
  // 機庫：兩側牆、後牆與工作間、南面兩邊的門袋（門扇收在牆外）；開口 x ±48 走得進去
  box(H.x - 57.3, H.x - 56.7, H.z - 38, H.z + 38); box(H.x + 56.7, H.x + 57.3, H.z - 38, H.z + 38);
  box(H.x - 57.3, H.x + 57.3, H.z - 38.3, H.z - 37.4); box(H.x - 45.3, H.x + 45.3, H.z - 46.3, H.z - 38);
  box(H.x - 57.3, H.x - 48, H.z + 37.4, H.z + 40.8); box(H.x + 48, H.x + 57.3, H.z + 37.4, H.z + 40.8);
  // 機庫裡：停著的 A320（機身，21-air.js 擺，中心 z −4）、機頭工作台與前梯、發動機升降台、尾翼塔架、翼後平台、西牆工作檯、東牆料架
  { const PZ = H.z - 4, NZ = PZ + 18.8; box(H.x - 2, H.x + 2, PZ - 18.8, NZ); box(H.x - 4.7, H.x + 4.7, NZ - 6.1, NZ + 5.8);
    for (const s of [-1, 1]) { box(H.x + s * 5.75 - 1.15, H.x + s * 5.75 + 1.15, PZ + 9.3, PZ + 11.7); box(H.x + s * 11 - 1.05, H.x + s * 11 + 1.05, PZ - 6.25, PZ - 4.15); }
    box(H.x + 1.5, H.x + 4.3, PZ - 11.5, PZ - 8.7); box(H.x - 56.7, H.x - 55.6, H.z - 33, H.z + 33); box(H.x + 55.8, H.x + 56.7, H.z - 33, H.z + 33); }
  // 燈：機庫裡四盞（天井燈照地坪，門開著從外面看得到），東面入口雨遮下兩盞
  for (const x of [-30, -10, 10, 30]) { const [X, Z] = airW(H.x + x, H.z - 4); signLights.push({ x: X, y: 17, z: Z, col: lin(0xf2f4ff), r: 42, i: 9, w: 1 }); }   // 裡面停著客機：16 時白漆過曝
  for (const z of [-12, 12]) { const [X, Z] = airW(T0.x + 83, T0.z + z); signLights.push({ x: X, y: 4.6, z: Z, col: lin(0xfff0da), r: 16, i: 3, w: 1 }); }
  for (let x = -120; x <= 120; x += 60) { const [X, Z] = airW(T2.x + x, T2.z + 45); signLights.push({ x: X, y: 7.8, z: Z, col: lin(0xfff0da), r: 20, i: 3, w: 1 }); }   // T2 落客雨遮下
  colDirty(); ahmFlush();
}
