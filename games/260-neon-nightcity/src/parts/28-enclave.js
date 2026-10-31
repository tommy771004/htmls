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
  // 南北向的街在橫街的路口斷開（橫街的標線穿過路口）；主街一路接到城市外緣
  const xs = S.streets.filter(s => s.ax === 'x'), cut = s => {
    const out = []; let z = s.z0;
    for (const x of xs.slice().sort((a, b) => a.z0 - b.z0)) { if (x.z1 <= z || x.z0 >= s.z1) continue; if (x.z0 > z) out.push({ ...s, z0: z, z1: x.z0 }); z = x.z1; }
    if (z < s.z1) out.push({ ...s, z0: z });
    return out;
  };
  const streets = S.streets.map(s => s.id === 'main' ? { ...s, z1: edgeZ(0) } : s);
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
  // ── 燈 ──
  // 路燈（enclave.json 的 lamps：燈柱位置與懸臂方向）進 20-props.js 的路燈表（地面與牆照 shader 算，不佔每幀挑的點光），燈下加同一套光錐
  const heads = S.lamps.map(([x, z, dx, dz]) => { const [X, Z] = W(x + dx * 1.4, z + dz * 1.4); return { x: X, z: Z, t: 0 }; });
  // 前街到城市外緣那段主街（模型裡沒有）：城裡的路燈（20-props.js 的 lampKit，懸臂朝 −x）兩側交錯
  const posts = [];
  for (let z = -50, k = 0; z < edgeZ(0) - 6; z += 22, k++) {
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
  // ── 替身：模型下載好之前（或以檔案開啟）每棟一個方塊，每層一圈窗帶（入夜才亮的窗，uber 的 16 號）──
  const px = new Kit(), cols = [0x6d6a63, 0x726d66, 0x5f5d58, 0x7a756b, 0x66625e];
  for (const [k, b] of S.blds.entries()) {
    const w = b.x1 - b.x0, d = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    px.box(cx, b.h / 2, cz, w, b.h, d, cols[k % cols.length], TX.conc);
    for (let j = 1; j < b.n; j++) { const y = S.gf + (j - 1) * S.fh + 1.4; px.box(cx, y, cz, w + .06, 1.1, d + .06, 0x1a1c22, 16); }
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
