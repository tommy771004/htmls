// ═══ 雲梯城寨：城北山腳挖出來的平台上，十二到十五層的老公寓圍著中庭（blender/enclave.py 程序化產生，tools/enclave-glb.mjs 打包）═══
// 版面（街、地塊、中庭、穿堂、每棟樓的外框與高度、燈）是 assets/260/enclave/enclave.json，座標都是 10-city.js 的 ENC.f 框座標；
// 平台與切坡的地面高度是 10-city.js 的 encGround，山的網格在 21-coast.js 細分。這裡開場同步做：城市外緣的隱形高牆在平台前開口、
// 平台三面立牆、樓的碰撞盒（穿堂底下留空）、街道與人行道、中庭的黃色網格線、燈；模型 assets/260/enclave/enclave.glb 在背景下載，
// 下載好拿掉替身方塊。模型的頂點色與窗號照 26-glb.js 的 glbMaterial（窗是 USE_WINMAP 的房間），粗糙度與自發光每種材質一個值，在這裡補成 _pbr／_emi。
const ENC_BASE = new URL('../assets/260/enclave/', location.href).href;
const ENC_ON = { glb: 0, failed: 0, blds: 0, lights: 0, proxy: 0 };   // __nc.enc 驗收用
// 材質名（enclave-glb.mjs）→ [粗糙度, 金屬度]；emi 是霓虹與燈，頂點色就是發光色
const ENC_PBR = { conc: [.9, 0], win: [.2, 0], tin: [.6, .3], rail: [.7, .4], cage: [.7, .4], cloth: [.9, 0], misc: [.7, .05], emi: [.5, 0] };
if (ENC) {
  const E = ENC, S = E.S, P = E.pad, f = E.f, W = (x, z) => toW(x, z, f);
  // 平台前那一段的城市外緣（框座標的 z）：從平台前緣往城裡找第一個在城裡的點
  const edgeZ = x => { for (let z = P.z1 - 10; z < 30; z += .5) if (inCity(...W(x, z))) return z; return 0; };
  // ── 碰撞 ──
  // 外緣靠山那一側的隱形高牆（10-city.js shoreRing 的 edge 牆）在平台前開口
  const inGap = (X, Z) => { const [x, z] = encL(X, Z); return x > P.x0 && x < P.x1 && z > P.z1 - 40 && z < 40; };
  for (const b of colliders.filter(b => b.edge)) {
    let g0 = null, g1 = null;
    for (let u = b.x0; u <= b.x1; u += .5) if (inGap(...toW(u, 0, b.zn))) { g0 ??= u; g1 = u; }
    if (g0 === null) continue;
    colliders.splice(colliders.indexOf(b), 1);
    if (g0 > b.x0 + .5) colliders.push({ ...b, x1: g0 });
    if (g1 < b.x1 - .5) colliders.push({ ...b, x0: g1 });
  }
  // 平台兩側與後面的高牆（外面是切坡）：兩側從後牆一路接到城市外緣
  colliders.push({ x0: P.x0 - 1.5, x1: P.x0, z0: P.z0 - 1.5, z1: edgeZ(P.x0 + .5) + .5, zn: f });
  colliders.push({ x0: P.x1, x1: P.x1 + 1.5, z0: P.z0 - 1.5, z1: edgeZ(P.x1 - .5) + .5, zn: f });
  colliders.push({ x0: P.x0 - 1.5, x1: P.x1 + 1.5, z0: P.z0 - 1.5, z1: P.z0, zn: f });
  // 樓：外框到樓頂；有穿堂的那棟切成三段，穿堂那段從一樓天花（GF）往上
  for (const b of S.blds) {
    const p = b.pas, box = (x0, x1, z0, z1, ly) => { if (x1 - x0 > .05 && z1 - z0 > .05) colliders.push({ x0, x1, z0, z1, hy: b.h, ...(ly ? { ly } : {}), zn: f }); };
    if (!p) box(b.x0, b.x1, b.z0, b.z1);
    else if (p.side === 's' || p.side === 'n') { box(b.x0, p.x0, b.z0, b.z1); box(p.x0, p.x1, b.z0, b.z1, p.h); box(p.x1, b.x1, b.z0, b.z1); }
    else { box(b.x0, b.x1, b.z0, p.z0); box(b.x0, b.x1, p.z0, p.z1, p.h); box(b.x0, b.x1, p.z1, b.z1); }
    ENC_ON.blds++;
  }
  const G = S.gate;   // 門樓的兩根方柱（enclave.py 的 build_gate）
  for (const x of [-7.6, 6.4]) colliders.push({ x0: x, x1: x + 1.2, z0: G.z - .6, z1: G.z + .6, zn: f });
  // ── 地面 ──
  // 街：connMat（10-city.js 的連接道路：中央雙黃線、車道線、積水與倒影）。aUV.x 是橫向公尺數，換算成城裡 8 m 半路寬的比例，標線與排水溝才落在路邊；
  // 巷子（lane）不畫標線
  const roadM = MAT.roadConn;
  // uniforms 要和原本的同一份（倒影貼圖、時間、天氣每幀改的是那一份；clone() 會複製一份死的）
  const laneM = new T.ShaderMaterial({ name: 'roadLane', uniforms: roadM.uniforms, side: roadM.side, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const strip = (mat, list) => {
    const Pp = [], N = [], UV = [], AX = [], I = [];
    for (const s of list) {
      const along = s.ax === 'z', a0 = along ? s.z0 : s.x0, a1 = along ? s.z1 : s.x1, c = along ? (s.x0 + s.x1) / 2 : (s.z0 + s.z1) / 2, hw = along ? (s.x1 - s.x0) / 2 : (s.z1 - s.z0) / 2;
      const n = Math.max(1, Math.ceil((a1 - a0) / 6)), base = Pp.length / 3, [ax, az] = along ? dirW(f, 1, 0) : dirW(f, 0, 1), k = 8 / hw;
      for (let i = 0; i <= n; i++) {
        const a = a0 + (a1 - a0) * i / n;
        for (const sg of [-1, 1]) {
          const [X, Z] = along ? W(c + hw * sg, a) : W(a, c + hw * sg);
          Pp.push(X, .004, Z); N.push(0, 1, 0); UV.push(hw * sg * k, along ? -a : a); AX.push(ax, az);
        }
        if (i) I.push(base + 2 * i - 2, base + 2 * i - 1, base + 2 * i + 1, base + 2 * i - 2, base + 2 * i + 1, base + 2 * i);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(Pp, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(N, 3));
    g.setAttribute('aUV', new T.Float32BufferAttribute(UV, 2)); g.setAttribute('aAx', new T.Float32BufferAttribute(AX, 2));
    g.setIndex(I); g.computeBoundingSphere();
    const m = new T.Mesh(g, mat); m.name = 'encRoad'; groundAdd(m, null); cullAdd(m, CULL_R * 1.5);
  };
  // 南北向的街在橫街的路口斷開（橫街的標線穿過路口）；主街一路接到城裡那條路的路邊（框原點是那條路的中心線，HR − 0.4：蓋過路緣，
  // 原本只到城市外緣，外緣和城裡的路之間隔著片外圍的草地；20-props.js 的樹、路燈、路邊停車照 12-hillmouth.js 的 hillConnNear 讓開）
  const xs = S.streets.filter(s => s.ax === 'x'), cut = s => {
    const out = []; let z = s.z0;
    for (const x of xs.slice().sort((a, b) => a.z0 - b.z0)) { if (x.z1 <= z || x.z0 >= s.z1) continue; if (x.z0 > z) out.push({ ...s, z0: z, z1: x.z0 }); z = x.z1; }
    if (z < s.z1) out.push({ ...s, z0: z });
    return out;
  };
  const streets = S.streets.map(s => s.id === 'main' ? { ...s, z1: -(HR - .4) } : s);
  strip(roadM, streets.filter(s => !s.lane).flatMap(s => s.ax === 'z' ? cut(s) : [s]));
  strip(laneM, streets.filter(s => s.lane).flatMap(s => s.ax === 'z' ? cut(s) : [s]));
  // 人行道（10-city.js 的 MAT_WALK）：地塊外圈 SW 寬、高 0.15 的板（穿堂穿過的地方斷開）；中庭與穿堂是地面上的板；
  // 前街到城市外緣是一片廣場（每 2 m 一條照外緣的位置收邊）
  const wk = new Kit(true), SW = S.sw;
  const slab = (x0, x1, z0, z1, y0, y1) => { if (x1 - x0 > .05 && z1 - z0 > .05) wk.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, 0x888888, 2); };
  const hole = (x0, x1, z0, z1, holes) => {   // 矩形扣掉穿堂（只切成沿 x 或沿 z 的條）
    let segs = [[x0, x1, z0, z1]];
    for (const h of holes) segs = segs.flatMap(([a0, a1, b0, b1]) => {
      if (h[1] <= a0 || h[0] >= a1 || h[3] <= b0 || h[2] >= b1) return [[a0, a1, b0, b1]];
      return a1 - a0 > b1 - b0 ? [[a0, Math.max(a0, h[0]), b0, b1], [Math.min(a1, h[1]), a1, b0, b1]] : [[a0, a1, b0, Math.max(b0, h[2])], [a0, a1, Math.min(b1, h[3]), b1]];
    });
    for (const [a0, a1, b0, b1] of segs) slab(a0, a1, b0, b1, -.2, .15);
  };
  for (const L of S.lots) {
    const holes = E.flat0.filter(r => r[0] < L.x1 && r[1] > L.x0 && r[2] < L.z1 && r[3] > L.z0);
    hole(L.x0, L.x1, L.z0, L.z0 + SW, holes); hole(L.x0, L.x1, L.z1 - SW, L.z1, holes);
    hole(L.x0, L.x0 + SW, L.z0 + SW, L.z1 - SW, holes); hole(L.x1 - SW, L.x1, L.z0 + SW, L.z1 - SW, holes);
  }
  for (const r of E.flat0) slab(r[0], r[1], r[2], r[3], -.2, .01);
  // 前街南邊到外緣：主街兩側各一片（每 2 m 一條，外緣是斜的）
  for (let x = P.x0; x < P.x1 - .01; x += 2) {
    const x1 = Math.min(P.x1, x + 2), ze = Math.min(edgeZ(x + .5), edgeZ(x1 - .5)) + .5;
    const parts = x1 <= -6 || x >= 6 ? [[x, x1]] : [[x, Math.min(x1, -6)], [Math.max(x, 6), x1]];
    for (const [p0, p1] of parts) slab(p0, p1, -62, ze, -.2, .15);
  }
  // 外緣到城裡那條路：主街兩側的人行道（4 m）
  for (const [p0, p1] of [[-10, -6], [6, 10]]) slab(p0, p1, Math.min(edgeZ(p0 + .5), edgeZ(p1 - .5)) + .5, -(HR + .4), -.2, .15);
  const wm = new T.Mesh(wk.build(), MAT_WALK); wm.name = 'encWalk'; groundAdd(wm, f); cullAdd(wm, CULL_R * 1.5);
  // 中庭：黃色外框與斜線（卸貨區那種），貼在地面上
  const pk = new Kit(true), yel = 0xd8a020;
  for (const L of S.lots) {
    const c = L.court, y = .02, t = .18;
    pk.box((c.x0 + c.x1) / 2, y, c.z0 + 1.2, c.x1 - c.x0 - 2.4, .01, t, yel, 2); pk.box((c.x0 + c.x1) / 2, y, c.z1 - 1.2, c.x1 - c.x0 - 2.4, .01, t, yel, 2);
    pk.box(c.x0 + 1.2, y, (c.z0 + c.z1) / 2, t, .01, c.z1 - c.z0 - 2.4, yel, 2); pk.box(c.x1 - 1.2, y, (c.z0 + c.z1) / 2, t, .01, c.z1 - c.z0 - 2.4, yel, 2);
    const w = Math.min(10, (c.x1 - c.x0) * .4), d = Math.min(8, (c.z1 - c.z0) * .5), cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.z1) / 2;   // 中間的禁停格
    for (const [x, z, sx, sz] of [[cx, cz - d / 2, w, t], [cx, cz + d / 2, w, t], [cx - w / 2, cz, t, d], [cx + w / 2, cz, t, d]]) pk.box(x, y, z, sx, .01, sz, yel, 2);
    const ang = Math.atan2(d, w), len = Math.hypot(w, d);
    for (const sg of [-1, 1]) pk.box(cx, y, cz, len, .01, t, yel, 2, 0, ang * sg, 0);
  }
  const pm = new T.Mesh(pk.build(), MAT.ux); pm.name = 'encPaint'; cityAdd(pm, f); cullAdd(pm, CULL_R);
  // ── 擋土牆（使用者：路的平地與山坡銜接有問題——巷子邊直接接上切坡，細分的山網格跨過平台邊的那幾格被坡抬起來、凸到路面上）──
  // 平台兩側（從城市外緣起）與後面：牆腳在平台邊、石砌牆面往後倒 8%、水泥壓頂，壓頂後面一片回填的草坡鋪到 ENC.M + 6 m（10-city.js 的 encGround
  // 在牆後 ENC.M 內留平、再從牆頂起坡，這片草坡蓋住中間那道溝與網格的斜邊）；角上是 6 段的圓弧。牆高照 encWallH，不到 0.3 m 不砌。碰撞照舊是上面那三道高牆
  {
    const M = E.M, G = { stone: [], cap: [], fill: [] }, line = [];
    const quad = (L, a, b, c, d, want) => {   // 四個點兩個三角形，繞序照 want（希望法線朝的方向）
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const flip = (uy * vz - uz * vy) * want[0] + (uz * vx - ux * vz) * want[1] + (ux * vy - uy * vx) * want[2] < 0;
      L.push(...(flip ? [a, c, b, a, d, c] : [a, b, c, a, c, d]).flat());
    };
    const arc = (x, z, a0) => { for (let k = 0; k <= 6; k++) { const a = a0 + Math.PI / 2 * k / 6; line.push([x, z, Math.cos(a), Math.sin(a)]); } };
    const zw = edgeZ(P.x0 + .5), ze = edgeZ(P.x1 - .5);
    for (let z = zw; z > P.z0 + 2; z -= 4) line.push([P.x0, z, -1, 0]);
    arc(P.x0, P.z0, Math.PI);
    for (let x = P.x0 + 4; x < P.x1 - 2; x += 4) line.push([x, P.z0, 0, -1]);
    arc(P.x1, P.z0, -Math.PI / 2);
    for (let z = P.z0 + 4; z <= ze; z += 4) line.push([P.x1, z, 1, 0]);
    const sec = ([x, z, nx, nz]) => {   // 一點的牆斷面（世界 [x, y, z]）：牆腳、牆頂、壓頂、回填的末端
      const h = encWallH(encNat(...W(x + nx * M, z + nz * M))), ob = h * .08, at = (d, y) => { const [X, Z] = W(x + nx * d, z + nz * d); return [X, y, Z]; };
      const [ix, iz] = dirW(f, -nx, -nz), [tx, tz] = dirW(f, -nz, nx);
      return { h, n: [ix, 0, iz], t: [tx, 0, tz], f0: at(0, -.3), f1: at(ob, h), c0: at(ob - .08, h), c1: at(ob - .08, h + .25), c2: at(ob + .5, h + .25), c3: at(ob + .5, h + .08), e: at(M + 6, h - .05), b0: at(ob + .5, -.3) };
    };
    const Q = line.map(sec), up = [0, 1, 0], on = i => Q[i] && Q[i].h >= .3;
    let len = 0, hMax = 0;
    for (let i = 0; i + 1 < Q.length; i++) {
      if (!on(i) || !on(i + 1)) continue;
      const a = Q[i], b = Q[i + 1];
      quad(G.stone, a.f0, a.f1, b.f1, b.f0, a.n);
      quad(G.cap, a.c0, a.c1, b.c1, b.c0, a.n); quad(G.cap, a.c1, a.c2, b.c2, b.c1, up);
      quad(G.fill, a.c3, a.e, b.e, b.c3, up);
      if (!on(i - 1)) quad(G.stone, a.f0, a.f1, a.c2, a.b0, a.t.map(v => -v));   // 牆的兩端：側面封起來
      if (!on(i + 2)) quad(G.stone, b.f0, b.f1, b.c2, b.b0, b.t);
      len += Math.hypot(b.f0[0] - a.f0[0], b.f0[2] - a.f0[2]); hMax = Math.max(hMax, a.h);
    }
    if (G.stone.length) {
      const geo = arr => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(arr, 3)); g.computeVertexNormals(); return g; };
      const rk = new Kit(); rk.add(geo(G.stone), 0x6a6860, TX.kenchi).add(geo(G.cap), 0xa9a69e, TX.conc).add(geo(G.fill), 0x4d5a30, TX.hill);
      const wm2 = new T.Mesh(rk.build(), MAT.ux); wm2.name = 'encWall'; cityAdd(wm2, null); cullAdd(wm2, CULL_R * 1.5);
    }
    ENC_ON.wall = { len: Math.round(len), hMax: +hMax.toFixed(1) };
  }
  // ── 燈 ──
  // 路燈（enclave.json 的 lamps：燈柱位置與懸臂方向）進 20-props.js 的路燈表（地面與牆照 shader 算，不佔每幀挑的點光），燈下加同一套光錐
  const heads = S.lamps.map(([x, z, dx, dz]) => { const [X, Z] = W(x + dx * 1.4, z + dz * 1.4); return { x: X, z: Z, t: 0 }; });
  // 前街到城裡那條路的那段主街（模型裡沒有）：城裡的路燈（20-props.js 的 lampKit，懸臂朝 −x）兩側交錯
  const posts = [];
  for (let z = -50, k = 0; z < -(HR + 6); z += 22, k++) {
    const sg = k % 2 ? -1 : 1, [X, Z] = W(sg * 7.4, z), [hx, hz] = W(sg * (7.4 - 2.25), z);
    posts.push({ x: X, z: Z, ry: f.ry + (sg > 0 ? 0 : Math.PI), zn: null }); heads.push({ x: hx, z: hz, t: 0 }); circles.push({ x: X, z: Z, r: .22, w: 1 });
  }
  instanced(lampKit(0xff8a3a), MAT.uber, posts);
  LAMP_HEADS.push(...heads); U.uLampT.value?.dispose(); lampTable(LAMP_HEADS);   // lampTable 每次新建一張 DataTexture
  { const cg = new T.CylinderGeometry(.22, 3.1, 7, 18, 1, true); cg.translate(0, 3.5, 0); instanced(cg, coneMat(0xff9a4c), heads.map(h => ({ x: h.x, z: h.z, zn: null })), LY.NOREFL); }
  // 其餘的點光（框座標、sRGB 色號）：99-main.js 每幀只挑離相機最近的幾盞，所以路燈（上面處理了）與外廊 6 m 以上的小燈泡（只照得到外廊，模型上有燈泡自己發光）不放
  for (const [x, y, z, hex, r, i] of S.lights) {
    if (hex === 'ffa850' && r === 16 || r <= 5 && y > 6) continue;
    const [X, Z] = W(x, z); coastLight(X, y, Z, parseInt(hex, 16), r, i).w = 1; ENC_ON.lights++;
  }
  // ── 替身：模型下載好之前（或以檔案開啟）每棟一個量體。每層一圈窗帶（入夜才亮的窗，uber 的 16 號）與窗台、樓板線，四面每 2.6 m 一根
  // 通到頂的壁柱把窗帶切成一扇扇窗；一樓一排鐵捲門店面與雨庇。約一成的窗外焊鐵窗籠（老公寓的「鐵籠」）、一成掛冷氣；屋頂女兒牆、水塔與天線。
  // 方塊一律直角（new Kit(true)：倒角 132 頂點、直角 36），也不逐窗建窗框窗台：逐窗建的版本 290 萬頂點（115 MB），以檔案開啟時分頁會當掉 ──
  const px = new Kit(true), cols = [0x6d6a63, 0x726d66, 0x5f5d58, 0x7a756b, 0x66625e], pr = rng(4417);
  for (const [k, b] of S.blds.entries()) {
    const w = b.x1 - b.x0, d = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, col = cols[k % cols.length];
    px.box(cx, b.h / 2, cz, w, b.h, d, col, TX.conc);
    for (let j = 1; j < b.n; j++) {
      const y = S.gf + (j - 1) * S.fh + 1.4;
      px.box(cx, y, cz, w + .06, 1.1, d + .06, 0x1a1c22, 16);                                   // 窗帶
      px.box(cx, y - .6, cz, w + .2, .06, d + .2, 0x9a958a, TX.conc);                          // 窗台
      px.box(cx, S.gf + (j - 1) * S.fh, cz, w + .12, .14, d + .12, 0x8a857c, TX.conc);       // 樓板線
    }
    for (const [ax, sg] of [['x', -1], ['x', 1], ['z', -1], ['z', 1]]) {
      const L = ax === 'x' ? w : d, nb = Math.max(1, Math.floor(L / 2.6)), off = (ax === 'x' ? d : w) / 2;
      const at = (u, o) => ax === 'x' ? [cx + u, cz + sg * o] : [cx + sg * o, cz + u];
      const bx = (u, y, o, a, h, t, c, m) => { const [X, Z] = at(u, o); if (ax === 'x') px.box(X, y, Z, a, h, t, c, m); else px.box(X, y, Z, t, h, a, c, m); };
      const ph = b.h - S.gf;
      for (let i = 1; i < nb; i++) bx(-L / 2 + i * L / nb, S.gf + ph / 2, off + .05, .5, ph, .1, col, TX.conc);   // 壁柱（窗與窗之間）
      for (let i = 0; i < nb; i++) {
        const u = -L / 2 + (i + .5) * L / nb, bw = L / nb, ww = Math.min(1.5, bw - .6);
        bx(u, S.gf * .45, off + .02, bw - .3, S.gf * .8, .04, 0x4a4c50, TX.sheet);   // 一樓鐵捲門
        bx(u, S.gf * .9 + .1, off + .2, bw - .1, .1, .4, 0x2a2c30, TX.iron);       // 雨庇
        for (let j = 1; j < b.n; j++) {
          const y = S.gf + (j - 1) * S.fh + 1.4, r = pr();
          if (r < .1) {   // 鐵窗籠：底板、上蓋、兩根角柱
            bx(u, y - .62, off + .3, ww + .2, .05, .6, 0x3a3e3a, TX.iron);
            bx(u, y + .62, off + .3, ww + .2, .05, .6, 0x3a3e3a, TX.iron);
            for (const q of [-1, 1]) bx(u + q * (ww / 2 + .08), y, off + .58, .03, 1.24, .03, 0x3a3e3a, TX.iron);
          } else if (r < .2) bx(u + ww / 2 - .3, y - .9, off + .25, .7, .5, .45, 0xb8b6ae, TX.enamel);   // 冷氣室外機
        }
      }
    }
    for (const [ox, oz, sx, sz] of [[0, -d / 2 + .1, w, .2], [0, d / 2 - .1, w, .2], [-w / 2 + .1, 0, .2, d], [w / 2 - .1, 0, .2, d]]) px.box(cx + ox, b.h + .45, cz + oz, sx, .9, sz, col, TX.conc);   // 女兒牆
    if (w > 4 && d > 4) {
      const tx = cx + (pr() - .5) * (w - 3), tz = cz + (pr() - .5) * (d - 3);
      px.cyl(tx, b.h + 1.1, tz, .8, .8, 1.4, 14, 0x8a8c8a, TX.galv).box(tx, b.h + .3, tz, 1.4, .3, 1.4, 0x3a3c3e, TX.iron);   // 水塔與台座
      px.rod(cx - w / 4, b.h, cz + d / 4, cx - w / 4, b.h + 3.5 + pr() * 2, cz + d / 4, .03, 6, 0x6a6c70, TX.galv);   // 天線
    }
  }
  const proxy = new T.Mesh(px.build(), MAT.ux); proxy.name = 'encProxy'; cityAdd(proxy, f); cullAdd(proxy, CULL_R * 1.5); ENC_ON.proxy = 1;
  // ── 模型 ──
  if (GLB_ON) glbLoader.loadAsync(ENC_BASE + 'enclave.glb', e => { glbBytes['enc'] = [e.loaded, e.lengthComputable ? e.total : 0]; }).then(g => warmJob(async () => {
    g.scene.updateMatrixWorld(true);   // enclave-glb.mjs 的 meshopt 把位置量化成整數，節點上帶著平移與縮放
    const clk = warmClock(), M = new T.Matrix4().compose(V3(f.ox, 0, f.oz), new T.Quaternion().setFromAxisAngle(V3(0, 1, 0), f.ry), V3(1, 1, 1)), ms = [], mats = new Map();
    g.scene.traverse(o => {
      if (!o.isMesh) return;
      const geo = o.geometry, n = geo.attributes.position.count, nm = o.material.name, pb = ENC_PBR[nm] || [.8, 0];
      const pbr = new Uint8Array(n * 4), emi = new Uint8Array(n * 4);
      for (let v = 0; v < n; v++) { pbr[v * 4] = pb[0] * 255; pbr[v * 4 + 1] = pb[1] * 255; }
      if (nm === 'emi') { const c = geo.attributes.color; for (let v = 0; v < n; v++) { emi[v * 4] = c.getX(v) * 255; emi[v * 4 + 1] = c.getY(v) * 255; emi[v * 4 + 2] = c.getZ(v) * 255; } }
      geo.setAttribute('_pbr', new T.BufferAttribute(pbr, 4, true)); geo.setAttribute('_emi', new T.BufferAttribute(emi, 4, true));
      if (!geo.attributes._win) geo.setAttribute('_win', new T.BufferAttribute(new Float32Array(n), 1));
      if (!mats.has(o.material)) mats.set(o.material, glbMaterial(o.material, PROP_INST, 0, false));
      const m = new T.Mesh(geo, mats.get(o.material)); m.name = 'enc:' + o.parent.name + ':' + nm;
      m.matrixAutoUpdate = false; m.matrix.multiplyMatrices(M, o.matrixWorld); m.userData.noTess = 1; ms.push(m);
    });
    await clk.tick();
    await glbWarm(ms, () => false);
    const i = cullList.indexOf(proxy.userData.cull); proxy.removeFromParent(); if (i >= 0) cullList.splice(i, 1); proxy.geometry.dispose(); ENC_ON.proxy = 0;
    for (const m of ms) { scene.add(m); m.updateMatrixWorld(true); cullAdd(m, CULL_R * 1.5); }
    perfTags.push(['雲梯城寨', clk.ms()]);
    glbDone.add('enc'); ENC_ON.glb = ms.length;
  })).catch(err => { console.warn('雲梯城寨模型下載失敗', err); glbDone.add('enc'); ENC_ON.failed = 1; });
}
