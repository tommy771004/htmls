// ═══ 第五部曲之三：公園大道的五層立體停車場（neon_nightcity_gta_v3.md「城市建築設施藍圖」一之 3）═══
// 10-city.js 的 FAC.gar 街區 (8,8)：整塊人行道內是停車場，地面層加四層樓板，第五層是露天頂樓。
// 北側是一條螺旋坡道帶（x 22–46）：第 k 條坡道從第 k 層爬到第 k+1 層，四條疊在一起，坡道帶在頂樓是開口；
// 上樓的路線是「坡道 → 東側車道往南 → 南側車道往西 → 西側車道往北 → 下一條坡道」，往回開就是下樓。
// 高度：06-roads.js 的 DECKS 回傳車或人腳下那一層（取 y 往上 1.2 m 以內最高的面）；相機的天花板與地板在 20-walk.js 的 WALKS。
// 每層的護牆是帶 ly／hy 的碰撞盒（只擋同一層），標 low：子彈、相機與翻越都不算它。
// 頂樓：一台稀有超跑（McLaren P1，以檔案開啟是替身）、往東飛過大道落進燈籠公園的「飛躍霓虹大道」特技跳台（20-props.js 的第 21 座跳台）、
// 高空降落傘包（撿了之後，開車飛在半空時按 F 可以跳車開傘，用掉再回來拿）；西北角的電梯直通頂樓。
// 地面入口有兩支塑膠柵欄桿：時速 5 公里以上碰到就斷飛，車子不減速、不扣血，半分鐘後換新的。

const PK = { car: null, gone: 0, bag: null, bagT: 0, bars: [] };
const PK_LVC = [0x2cf2d8, 0xffb02e, 0xff3fa0, 0x8cff3a, 0x6aa8ff];   // 每層的識別色（P1 地面到 P5 頂樓）
const PK_BAG_RE = 60, PK_BAR_RE = 30, PK_BAR_V = 5 / 3.6;
if (FAC.gar) {
  const F = FAC.gar, LV = F.lv, N = F.n, SL = .3, Y = k => F.roof - (N - k) * LV;
  const SX0 = 22, SX1 = 46, SZ1 = 21.2;   // 坡道帶（設施座標）
  const X = x => F.ax + x, Z = z => F.az + z;
  // 第 j 層（1..N）的面：坡道帶裡是第 j-1 條坡道，其他地方是樓板；地面（第 0 層）照地形
  const surf = (x, z, j) => z < SZ1 && x > SX0 && x < SX1 ? Y(j - 1) + (x - SX0) / (SX1 - SX0) * LV : Y(j);
  const inside = (x, z) => x > 12.7 && x < 59.3 && z > 12.7 && z < 49.3;
  // 腳下那一層：y 往上 1.2 m 以內最高的面，地面層回傳 null（照地形）
  const floorAt = (x, z, y) => { let h = null; for (let j = 1; j <= N; j++) { const s = surf(x, z, j); if (s < y + 1.2) h = s; } return h; };
  const ceilAt = (x, z, y) => { for (let j = 1; j <= N; j++) { const s = surf(x, z, j); if (s > y + 1.3) return s - SL - .12; } return undefined; };
  PK.F = F; PK.Y = Y; PK.floorAt = floorAt;
  const wb = rectW(F.ax + 12.5, F.ax + 59.5, F.az + 12.5, F.az + 49.5, F.zn), wx0 = Math.min(...wb.map(p => p[0])), wx1 = Math.max(...wb.map(p => p[0])), wz0 = Math.min(...wb.map(p => p[1])), wz1 = Math.max(...wb.map(p => p[1]));
  DECKS.push((Xw, Zw, y) => {
    if (Xw < wx0 || Xw > wx1 || Zw < wz0 || Zw > wz1) return null;
    const [lx, lz] = toL(Xw, Zw, F.zn), x = lx - F.ax, z = lz - F.az;
    return inside(x, z) ? floorAt(x, z, y) : null;
  });
  WALKS.push({ zn: F.zn, bb: [X(12.5), X(59.5), Z(12.5), Z(49.5)],
    y: (x, z, y0, cam) => cam ? floorAt(x - F.ax, z - F.az, y0) ?? undefined : undefined,
    ceil: (x, z, y0) => ceilAt(x - F.ax, z - F.az, y0) });

  // k：有頂的部分（自己的材質，不算積水反射；露天的頂樓才會濕）；kr：頂樓
  const k = new Kit(), kr = new Kit(), th = Math.atan2(LV, SX1 - SX0), rl = Math.hypot(LV, SX1 - SX0) + .25;
  const bx = (x0, x1, y0, y1, z0, z1, c, m = 2) => (y0 >= Y(N) - SL - .01 ? kr : k).box(X((x0 + x1) / 2), (y0 + y1) / 2, Z((z0 + z1) / 2), x1 - x0, y1 - y0, z1 - z0, c, m);
  const CONC = 0x8f8b84, DECK = 0x5d5e60, LINE = 0xe8e6de;
  // 地面層的地坪與樓板（坡道帶在每層都挖掉，頂樓的開口就是第 4 條坡道）
  bx(13, 59, .04, Y(0) + .015, 13, 49, DECK);
  for (let j = 1; j <= N; j++) for (const [x0, x1, z0, z1] of [[13, 59, SZ1, 49], [13, SX0, 13, SZ1], [SX1, 59, 13, SZ1]]) bx(x0, x1, Y(j) - SL, Y(j), z0, z1, DECK);
  for (let j = 0; j < N; j++) {
    const K = j === N - 1 ? kr : k;
    K.box(X((SX0 + SX1) / 2), Y(j) + LV / 2 - SL / 2 * Math.cos(th), Z((13 + SZ1) / 2), rl, SL, SZ1 - 13, DECK, 2, 0, 0, th);   // 坡道
    K.box(X((SX0 + SX1) / 2), Y(j) + LV / 2 + .012, Z((13 + SZ1) / 2), rl, .02, .14, 0xffd23a, 2, 0, 0, th);   // 中線
  }
  // 北牆（整面到頂）、坡道帶南側的隔牆、電梯井
  bx(12.7, 59.3, 0, Y(N) + 1.05, 12.7, 13, CONC);
  bx(SX0, SX1, 0, Y(N) + 1.05, SZ1, 21.5, CONC);
  bx(13, 18.5, 0, Y(N) + 3, 44.2, 49, 0x7b7771);
  bx(12.9, 18.6, Y(N) + 3, Y(N) + 3.2, 44.1, 49.1, 0x4a4844);
  // 碰撞盒切段：這一片有剪切，以前盒的座標框（10-city.js 的 boxToW）只照 x 軸的方向，沿 z 的長牆每 6 m 會歪 0.6 m，所以沿 z 的切成 2 m、沿 x 的切成 12 m（現在是仿射框，不切也對，留著不影響）
  const pkBox = (x0, x1, z0, z1, o) => {
    const alongX = x1 - x0 > z1 - z0, n = Math.ceil(Math.max(x1 - x0, z1 - z0) / (alongX ? 12 : 2));
    for (let i = 0; i < n; i++) { const a = i / n, c = (i + 1) / n; if (alongX) v5Box(F, x0 + (x1 - x0) * a, x0 + (x1 - x0) * c + (i < n - 1 ? .1 : 0), z0, z1, o); else v5Box(F, x0, x1, z0 + (z1 - z0) * a, z0 + (z1 - z0) * c + (i < n - 1 ? .1 : 0), o); }
  };
  // 每層的護牆、外側的識別色霓虹條；地面層西側是入口、頂樓東側是跳台的缺口
  const west = j => j ? [[13, 49]] : [[13, 24], [36, 49]], east = j => j === N ? [[13, 38.2], [42.8, 49]] : [[13, 49]];
  for (let j = 0; j <= N; j++) {
    const y0 = j ? Y(j) - SL - .35 : 0, y1 = Y(j) + 1.05, c = PK_LVC[j];
    for (const [z0, z1] of west(j)) { bx(12.7, 13, y0, y1, z0, z1, CONC); bx(12.66, 12.7, y1 - .32, y1 - .2, z0, z1, c, 8); pkBox(12.7, 13.4, z0, z1, { ly: j ? Y(j) - .6 : -1, hy: y1, low: 1 }); }
    for (const [z0, z1] of east(j)) { bx(59, 59.3, y0, y1, z0, z1, CONC); bx(59.3, 59.34, y1 - .32, y1 - .2, z0, z1, c, 8); pkBox(58.6, 59.3, z0, z1, { ly: j ? Y(j) - .6 : -1, hy: y1, low: 1 }); }
    bx(12.7, 59.3, y0, y1, 49, 49.3, CONC); bx(12.7, 59.3, y1 - .32, y1 - .2, 49.3, 49.34, c, 8); pkBox(12.7, 59.3, 48.6, 49.3, { ly: j ? Y(j) - .6 : -1, hy: y1, low: 1 });
    bx(12.7, 59.3, y1 - .32, y1 - .2, 12.66, 12.7, c, 8);   // 北牆外側也拉一條
  }
  pkBox(12.7, 59.3, 12.7, 13);   // 北牆
  pkBox(SX0, SX1, SZ1, 21.5);   // 隔牆
  v5Box(F, 13, 18.5, 44.2, 49);   // 電梯井
  pkBox(SX1 - .4, SX1, 13, SZ1, { ly: -1, hy: Y(1) - .5 });   // 地面層：第 1 條坡道的下面不能鑽進去
  pkBox(SX0 - .3, SX0, 13, SZ1, { ly: Y(N) - 1, hy: Y(N) + 1.1 });   // 頂樓：坡道開口的西側欄杆
  bx(SX0 - .3, SX0, Y(N), Y(N) + 1.05, 13, SZ1, CONC);
  // 外牆的柱子（立面的節奏）與中間車位的柱子
  const fcol = (x, z, sx, sz) => bx(x - sx / 2, x + sx / 2, 0, Y(N) + 1.05, z - sz / 2, z + sz / 2, 0x9c978e);
  for (let i = 0; i <= 6; i++) fcol(13 + i * 46 / 6, 49, .6, .7);
  for (const z of [13, 20, 27, 34, 46]) { fcol(13, z, .7, .6); fcol(59, z, .7, .6); }
  for (let j = 0; j < N; j++) for (const x of [24, 32, 40, 48]) {
    bx(x - .3, x + .3, Y(j), Y(j + 1) - SL, 32.2, 32.8, 0xa29d94);
    bx(x - .31, x + .31, Y(j) + .9, Y(j) + 1.3, 32.19, 32.81, PK_LVC[j]);   // 柱子上漆一圈這層的顏色
  }
  for (const x of [24, 32, 40, 48]) v5Box(F, x - .3, x + .3, 32.2, 32.8, { hy: Y(N) - .3 });
  // 車位線（中間兩排背對背、南側一排）、頂樓超跑的金色車格、往跳台的箭頭
  for (let j = 0; j <= N; j++) {
    const y = Y(j) + .012, K = j === N ? kr : k;
    for (let i = 0; i <= 12; i++) {
      const x = X(20 + i * 2.6);
      K.box(x, y, Z(30.15), .12, .02, 4.3, LINE).box(x, y, Z(34.85), .12, .02, 4.3, LINE).box(x, y, Z(46.6), .12, .02, 4.6, LINE);
    }
    K.box(X(36), y, Z(32.5), 31.2, .02, .12, LINE);
  }
  // 跳台的中線（世界座標的弦，pkSpot 的超跑也停在上面）換回設施座標的 z
  const rw = RAMPS_W[RAMPS.findIndex(q => q.y0)];
  const lineZ = x => { if (!rw) return 40.5; const [wx, wz] = facW(F, x, 40.5), t = (wx - rw.x) * rw.dx + (wz - rw.z) * rw.dz; return toL(rw.x + rw.dx * t, rw.z + rw.dz * t, F.zn)[1] - F.az; };
  const sz0 = lineZ(17);
  for (const [x, z, sx, sz] of [[17, sz0 - 1.3, 5.4, .14], [17, sz0 + 1.3, 5.4, .14], [14.3, sz0, .14, 2.74], [19.7, sz0, .14, 2.74]]) kr.box(X(x), Y(N) + .015, Z(z), sx, .02, sz, 0xffc83a, 8);
  for (let x = 28; x <= 44; x += 4) for (const s of [-1, 1]) kr.box(X(x - .45), Y(N) + .015, Z(lineZ(x) + s * .5), .16, .02, 1.3, 0xffd23a, 8, 0, s * .7, 0);
  // 日光燈管（每層的天花板，沿著車道；坡道下面也有）與燈光
  for (let j = 0; j < N; j++) {
    const y = Y(j + 1) - SL - .05;
    for (let x = 16; x <= 56; x += 5) { k.box(X(x), y, Z(24.75), 1.6, .06, .16, 0xe8f6ff, 11); k.box(X(x), y, Z(40.5), 1.6, .06, .16, 0xe8f6ff, 11); }
    for (let z = 26; z <= 44; z += 6) { k.box(X(16.5), y, Z(z), .16, .06, 1.6, 0xe8f6ff, 11); k.box(X(55.5), y, Z(z), .16, .06, 1.6, 0xe8f6ff, 11); }
    if (j < N - 1) for (let x = 26; x <= 42; x += 8) k.box(X(x), Y(j + 1) + (x - SX0) / (SX1 - SX0) * LV - SL - .05, Z(17.1), 1.6, .06, .16, 0xe8f6ff, 11, 0, 0, th);
    v5Light(F, 24, Y(j) + 2.9, 40.5, 0xdff2ff, 14, .8); v5Light(F, 48, Y(j) + 2.9, 24.75, 0xdff2ff, 14, .8);
  }
  // 頂樓的燈桿
  for (const x of [28, 44]) {
    bx(x - .12, x + .12, Y(N), Y(N) + 6, 32.38, 32.62, 0x3a3d40, 15);
    bx(x - .9, x + .9, Y(N) + 5.9, Y(N) + 6.1, 32.2, 32.8, 0x2a2c2f, 15); bx(x - .8, x + .8, Y(N) + 5.86, Y(N) + 5.9, 32.25, 32.75, 0xfff0d0, 11);
    v5Box(F, x - .15, x + .15, 32.35, 32.65, { ly: Y(N) - .5, hy: Y(N) + 6 });
    v5Light(F, x, Y(N) + 5.6, 32.5, 0xffe2b0, 22, 1);
  }
  // 電梯門（每層北面）
  for (let j = 0; j <= N; j++) {
    bx(14.9, 16.6, Y(j), Y(j) + 2.2, 44.14, 44.2, 0x9aa0a6, 3);
    bx(16.8, 16.95, Y(j) + 1.1, Y(j) + 1.3, 44.12, 44.2, 0x30ff70, 8);
  }
  // 停著的車：traffic.glb 的低面數實車（30-vehicles.js 的 TRAFFIC_GEO），每種車一個 InstancedMesh，車漆用車流的調色盤（aIns.z）
  // 自己的亂數，不動 rnd() 的序列；有頂的樓層不算積水（同 k），頂樓的兩台照常會濕
  const R = rng(4471), ids = ['e34', 'compact', 'kiri', 'urban', 'milano', 'carter', 'camry', 'lc200', 'm5f90'], cars = { in: {}, roof: {} };
  const putCar = (set, id, x, y, z, yaw, palI) => {
    const t = TRAFFIC_GEO[id], sn = Math.sin(yaw);
    if (!t) return;
    (cars[set][id] ||= []).push({ x: X(x), y, z: Z(z), yaw, palI: t.pal ? palI : 0 });
    const w = t.w / 2 + .1, l = t.len / 2 + .1, hx = Math.abs(sn) > .5 ? l : w, hz = Math.abs(sn) > .5 ? w : l;
    v5Box(F, x - hx, x + hx, z - hz, z + hz, { ly: y - .5, hy: y + 1.4 });
  };
  for (let j = 0; j < N; j++) for (let i = 0; i < 12; i++) for (const [z, yaw] of [[30.2, 0], [34.8, Math.PI], [46.6, 0]]) {
    if (R() > .3 || z === 46.6 && i === 0) continue;
    putCar('in', ids[Math.floor(R() * ids.length)], 21.3 + i * 2.6, Y(j), z, yaw, 1 + Math.floor(R() * PAL.length));
  }
  putCar('roof', 'senna', 21.3 + 5 * 2.6, Y(N), 30.2, 0, 5); putCar('roof', 'r8', 21.3 + 9 * 2.6, Y(N), 30.2, 0, 4);   // 頂樓南排空著：跳台的助跑道
  const dryI = mkUber({ inst: true }); dryI.name = MAT.uberI.name; dryI.uniforms.uWet = { value: 0 };
  for (const set in cars) for (const id in cars[set]) {
    const L = cars[set][id], g = TRAFFIC_GEO[id].geo.clone(), ia = new Float32Array(L.length * 4);
    const m = new T.InstancedMesh(g, set === 'in' ? dryI : TRAF_MAT, L.length);
    L.forEach((c, i) => { m.setMatrixAt(i, new T.Matrix4().makeRotationY(c.yaw).setPosition(c.x, c.y, c.z)); ia[i * 4 + 1] = R(); ia[i * 4 + 2] = c.palI; });
    g.setAttribute('aIns', new T.InstancedBufferAttribute(ia, 4));
    m.name = 'garCars'; m.computeBoundingSphere(); cityAdd(m, F.zn, [X(36), Z(31)]);
  }
  const dry = mkUber(); dry.uniforms.uWet = { value: 0 };
  cityAdd(new T.Mesh(k.build(), dry), F.zn); cityAdd(new T.Mesh(kr.build(), MAT.uber), F.zn);
  // 招牌：北面的大燈箱、西面的直立「P」、入口的橫招牌、頂樓跳台旁的「飛躍霓虹大道」
  v5Put(F, v5Sign([['霓虹立體停車場', .42, '#ffffff', .4], ['NEON PARK  ·  5F  ·  24H  ·  頂樓特技跳台', .2, '#2cf2d8', .78]], 18, 3, { bg: '#0d1216', edge: '#2cf2d8' }), 36, Y(2) + 1.6, 12.62, Math.PI);
  v5Put(F, v5Sign([['P', .2, '#2cf2d8', .13], ['停', .095, '#ffffff', .34], ['車', .095, '#ffffff', .47], ['場', .095, '#ffffff', .6], ['24H', .06, '#ffb02e', .82]], 1.8, 8, { bg: '#0d1216', edge: '#ff3fa0' }), 12.6, 6.2, 19.5, -Math.PI / 2);
  v5Put(F, v5Sign([['入口  ENTRANCE  ·  限高 2.1 m', .5, '#ffd23a', .52]], 8, .7, { bg: '#121417' }), 12.6, Y(1) - .75, 30, -Math.PI / 2);
  v5Put(F, v5Sign([['飛躍霓虹大道', .4, '#ffffff', .36], ['NEON AVENUE LEAP  ▶', .24, '#ff3fa0', .76]], 4.4, 1.5, { bg: '#0d1216', edge: '#ffd23a' }), 47.5, Y(N) + 2.4, 35.6, -Math.PI / 2);
  const sk = new Kit();
  for (const z of [34.2, 37]) { sk.box(X(47.56), Y(N) + .85, Z(z), .12, 1.7, .12, 0x3a3d40, 15); v5Box(F, 47.4, 47.7, z - .15, z + .15, { ly: Y(N) - .5, hy: Y(N) + 3.2 }); }
  for (let j = 0; j <= N; j++) v5Put(F, v5Sign([[`P${j + 1}`, .62, '#' + PK_LVC[j].toString(16).padStart(6, '0'), .45], [j === N ? 'ROOF' : j ? `${j + 1}F` : 'GF', .26, '#ffffff', .86]], .9, .9, { bg: '#121417' }), 17.9, Y(j) + 1.7, 44.13, Math.PI);
  v5Light(F, 12, Y(2) + 1.6, 36, 0x2cf2d8, 16, 1.1); v5Light(F, 36, Y(2) + 1.6, 11.5, 0x2cf2d8, 20, 1.2); v5Light(F, 47, Y(N) + 2.4, 36.5, 0xff3fa0, 10, .9);
  // 入口：中間的收費機島、兩支柵欄桿（各自一個網格，斷掉時飛出去）
  bx(13.2, 16, 0, .2, 29.6, 30.4, 0xd9b42a); bx(14.2, 14.9, .2, 1.4, 29.75, 30.25, 0x30343a, 15); bx(14.25, 14.85, 1.05, 1.25, 29.74, 29.76, 0x6af0ff, 8);
  pkBox(13.2, 16, 29.6, 30.4, { ly: -1, hy: 1.4 });
  for (const [z0, s] of [[29.6, -1], [30.4, 1]]) {
    sk.box(X(14), .55, Z(z0 + s * .05), .2, 1.1, .2, 0xd9b42a, 2);
    const bk = new Kit();
    for (let i = 0; i < 6; i++) bk.box(0, 0, s * (.45 + i * .9), .08, .1, .9, i % 2 ? 0xffffff : 0xe03030, i % 2 ? 2 : 11);
    const m = new T.Mesh(bk.build(), MAT.uber), p = V3(X(14), 1.05, Z(z0 + s * .05));
    m.position.copy(p); cityAdd(m, F.zn);
    PK.bars.push({ m, p, s, z0, z1: z0 + s * 5.6, t: 0, vx: 0, vz: 0, vy: 0, w: 0 });
  }
  cityAdd(new T.Mesh(sk.build(), MAT.uber), F.zn);
  // 降落傘包（頂樓東南角）
  {
    const bk = new Kit();
    bk.box(0, .3, 0, .5, .6, .3, 0xc8402c, 2).box(0, .3, -.16, .36, .3, .04, 0xe9e5dc, 2).box(0, .62, 0, .3, .08, .2, 0x2a2a2a, 2);
    for (const s of [-1, 1]) bk.box(s * .17, .35, .17, .06, .5, .04, 0x2a2a2a, 2);
    bk.cyl(0, .01, 0, .9, .9, .02, 24, 0xffd23a, 8);
    PK.bag = v5Put(F, new T.Mesh(bk.build(), MAT.uber), 55.5, Y(N), 46, -Math.PI / 2);
  }
  // 頂樓也算 69-v5-civic.js 的屋頂：在邊上按空白鍵往下跳（坡道開口與電梯井不算）
  V5.roofs.push({ F, L: { x0: X(13), x1: X(59), z0: Z(13), z1: Z(49), zn: F.zn, h: Y(N) }, h: Y(N), bb: [X(13), X(59), Z(13), Z(49)], solid: [] });
  // 日照陰影：整塊停車場當成頂樓高的量體
  hmRectL(X(12.7), X(59.3), Z(12.7), Z(49.3), Y(N) + 1.05, false, F.zn); hmFlush();
  PK.elev = { down: [15.75, 43.3], roof: [15.75, 43.3] };
}

// 超跑的車位：金色車格中心投影到跳台的中線上（世界座標的弦；這一片有剪切，照設施座標的東邊開會偏 5°）
function pkSpot() {
  const F = PK.F, [x, z] = facW(F, 17, 40.5), r = RAMPS.find(q => q.y0);
  if (!r) return { x, z, yaw: facY(F, Math.PI / 2) };
  const t = (x - r.x) * r.dx + (z - r.z) * r.dz;
  return { x: r.x + r.dx * t, z: r.z + r.dz * t, yaw: r.yaw };
}
// 頂樓的稀有超跑：走近才造（實車模型只在 http(s) 下載）；開走、撞爛之後，人離開 300 m 以上半分鐘再換一台新的
function pkCarSpawn() {
  const F = PK.F, v = mkVehicle('rare'), s = pkSpot();
  applyCar(v, 'p1');
  v.x = s.x; v.z = s.z; v.yaw = s.yaw; v.y = PK.Y(F.n); v.vx = v.vz = 0; v.rare = 1;
  vehicles.push(v); poseVehicle(v);
  PK.car = v; PK.gone = 0;
  return v;
}
function pkCarDrop(v) {
  if (player.veh === v) exitVehicle();
  const i = vehicles.indexOf(v); if (i >= 0) vehicles.splice(i, 1);
  scene.remove(v.g); disposeKit(v.body); v.mat.dispose();
}
// 開車飛在半空（跳台、斷橋）時跳車開傘：要先撿頂樓的傘包
function pkBail() {
  const v = player.veh;
  if (!V5.chute || !v || !v.air || player.mode !== 'drive') return false;
  const vx = v.vx, vz = v.vz, y = v.y;
  v.air.qual = false; v.air.bail = 1; stunt.cam = null; slowmo.st = 1; camState.snap = true;   // 車自己飛完（pkUpdate 代替 stuntLate 的直接落地）
  exitVehicle(true);
  player.x = v.x + Math.cos(v.yaw) * 1.6; player.z = v.z - Math.sin(v.yaw) * 1.6; player.y = y + .6;
  player.air3 = { kind: 'fall', vx: vx * .8, vy: 2, vz: vz * .8, t: .4 };
  V5.chute = 0; PK.fly = v; sfx.swoosh(false);
  toast('跳車了 · 按 F 或空白鍵開傘');
  return true;
}
function pkUpdate(dt) {
  const F = PK.F; if (!F || !cityIsWorld) return;
  const fv = PK.fly; if (fv) { if (fv.air && player.veh !== fv) { stuntFly(fv, null, dt); poseVehicle(fv); } else PK.fly = null; }
  const { x: cx, z: cz } = pkSpot(), far = Math.hypot(pX() - cx, pZ() - cz);
  const v = PK.car;
  if (!v) { if (far < 220) pkCarSpawn(); }
  else {
    const off = v.dead || !vehicles.includes(v) || Math.hypot(v.x - cx, v.z - cz) > 3 || Math.abs(v.y - PK.Y(F.n)) > 1;
    if (off && player.veh !== v && far > 300) { if ((PK.gone += dt) > 30) { pkCarDrop(v); PK.car = null; } }
    else PK.gone = 0;
  }
  // 傘包
  if (PK.bagT > 0 && (PK.bagT -= dt) <= 0) PK.bag.visible = true;
  if (PK.bag.visible && player.mode === 'walk' && Math.abs(player.y - PK.Y(F.n)) < 1) {
    const [bx, bz] = facW(F, 55.5, 46);
    if (Math.hypot(player.x - bx, player.z - bz) < 1.2) {
      if (V5.chute) { if (!PK.bagHint) { PK.bagHint = 1; toast('已經揹著一具降落傘了'); } }
      else { V5.chute = 1; PK.bag.visible = false; PK.bagT = PK_BAG_RE; sfx.pickup(); toast('撿到降落傘 · 開車飛在半空時按 F 跳車開傘'); }
    } else PK.bagHint = 0;
  }
  // 入口的柵欄桿：車頭碰到就斷飛
  const pv = player.mode === 'drive' ? player.veh : null;
  for (const B of PK.bars) {
    if (B.t > 0) {
      B.t -= dt;
      if (B.vy || B.m.position.y > .1) {
        B.vy -= 9.8 * dt; B.m.position.x += B.vx * dt; B.m.position.z += B.vz * dt; B.m.position.y = Math.max(.06, B.m.position.y + B.vy * dt);
        B.m.rotation.y += B.w * dt; B.m.rotation.z += B.w * .6 * dt;
        if (B.m.position.y <= .06) { B.vy = 0; B.vx *= .5; B.vz *= .5; B.w *= .5; B.m.rotation.z = Math.PI / 2; }
      }
      if (B.t <= 0) { const [bx, bz] = toW(B.p.x, B.p.z, F.zn); if (Math.hypot(pX() - bx, pZ() - bz) > 40) { B.m.position.copy(B.p); B.m.rotation.set(0, 0, 0); B.vy = 0; } else B.t = 5; }
      continue;
    }
    if (!pv) continue;
    const sp = Math.hypot(pv.vx, pv.vz); if (sp < PK_BAR_V || pv.y > 1.5) continue;
    const [lx, lz] = toL(pv.x, pv.z, F.zn), x = lx - F.ax, z = lz - F.az, zl = Math.min(B.z0, B.z1), zh = Math.max(B.z0, B.z1);
    if (Math.abs(x - 14) < pv.len / 2 + .2 && z > zl - pv.w / 2 && z < zh + pv.w / 2) {
      const [ax, az] = toL(pv.x + pv.vx, pv.z + pv.vz, F.zn), ux = (ax - lx) / sp, uz = (az - lz) / sp;
      B.t = PK_BAR_RE; B.vx = ux * sp * .9; B.vz = uz * sp * .9; B.vy = 3 + sp * .15; B.w = (Math.random() - .5) * 9; B.m.position.y = 1.1;
      sfx.impact(3);
    }
  }
}
function pkCtx(p) {
  const F = PK.F; if (!F || p.mode !== 'walk') return null;
  const [ex, ez] = facW(F, ...PK.elev.down), top = PK.Y(F.n);
  if (Math.hypot(p.x - ex, p.z - ez) > 1.6) return null;
  if (p.y < 1.5) return { key: 'E', text: '搭電梯上頂樓', fn: () => transition(() => { const [x, z] = facW(F, ...PK.elev.roof); player.x = x; player.z = z; player.y = top; player.yaw = facY(F, Math.PI); camState.yaw = player.yaw; camState.snap = true; }) };
  if (Math.abs(p.y - top) < .8) return { key: 'E', text: '搭電梯下地面層', fn: () => transition(() => { const [x, z] = facW(F, ...PK.elev.down); player.x = x; player.z = z; player.y = PK.Y(0); player.yaw = facY(F, Math.PI); camState.yaw = player.yaw; camState.snap = true; }) };
  return null;
}
ctxHooks.unshift(pkCtx);
// 測試 API（window.__nc.gta.v5.gar）
gtaApi.v5.gar = { PK, spawn: pkCarSpawn, bail: pkBail, floorAt: (x, z, y) => PK.floorAt && PK.floorAt(x, z, y), ramp: () => RAMPS.find(r => r.y0), near: (X, Z, r = 3) => boxesNear(X, Z, r).map(b => JSON.parse(JSON.stringify(b, (k, v) => k === "zn" || k === "f" ? undefined : v))) };
