// ═══ 紐柏林賽道的畫面（09-nbr.js 的地形與賽道；plans/260-nurburgring.md）═══
// 地形：1024 m 一塊，遠的是 32 m 一格（整片開場就建好），鏡頭離那塊 NBR_NEAR 以內換成 8 m 一格（和 nbrMeshL 同一組格子與對角線，第一次靠近才建，
// 離開 NBR_FAR 以外收掉）；每塊四邊往下垂一圈裙邊，兩種格距相鄰的地方不會露縫。整塊在水面下的不建。材質同外緣的山（MAT.ux＋TX.hill），
// 頂點色照 OSM 的土地利用（森林、草地、農地、村子、鋪面、水）、坡度與高度。
// 賽道：北環、GP、維修道是 MAT.roadConn（連接道路的柏油；aUV 橫向座標加 40，不會畫到城裡的中央雙黃線與車道虛線），兩側白色邊線另外鋪；
// 機場上來的進場路照一般道路畫中央雙黃線 ═══
const NBR_CH = 128, NBR_NEAR = 700, NBR_FAR = 1000;   // 一塊 128 格（1024 m）；近網格的換入、換出距離（鏡頭到那塊矩形）
// 地面網格（groundAdd）：70-render.js 只在開場把 groundMeshes 設成不進倒影（它們的材質讀倒影貼圖，WebGPU 下同一趟又讀又寫會報錯），之後才建的要自己設
const nbrGround = m => (groundAdd(m, null), m.layers.set(LY.NOREFL), m);
const NBR_TICK = [];   // 每 0.3 秒照鏡頭位置（SEA_FR 座標）呼叫：50-nbr.js 的樹
if (NBR) {
  const N = nbrGrid(), F = SEA_FR, [ox, oz] = toW(0, 0, F), [ex, ez] = toW(1, 0, F), rc = ex - ox, rs = ez - oz;   // SEA_FR 的旋轉（剛體）
  const W = (x, z) => [ox + x * rc - z * rs, oz + x * rs + z * rc];
  // 土地利用（真實座標，10 m 一格）
  const LU = NBR_LU, lu = new Uint8Array(LU.nx * LU.nz);
  { const r = nbB64(LU.rle, Uint8Array); for (let k = 0, o = 0; k < r.length; k += 2) { lu.fill(r[k], o, o + r[k + 1]); o += r[k + 1]; } }
  const luAt = (x, z) => { const i = Math.floor((NBR_OX - x - NBR.D.x0) / LU.cell), j = Math.floor((NBR_OZ - z - NBR.D.z0) / LU.cell); return i < 0 || j < 0 || i >= LU.nx || j >= LU.nz ? -1 : lu[j * LU.nx + i]; };
  NBR.luAt = luAt;   // 23-nbr-track.js 的草地覆蓋
  const LUC = [0x3b4a24, 0x1c2a15, 0x5a5232, 0x3f4436, 0x45463f, 0x38393a, 0x22302e].map(h => new T.Color(h));   // 草地、森林、農地、村子、工商、鋪面、水
  const C_ROCK = new T.Color(0x3d3a34), C_SAND = new T.Color(0x6b6248), C_BED = new T.Color(0x2a2a22), C_APRON = new T.Color(0x34401f), c = new T.Color();
  const H = N.H, nx = N.nx, nz = N.nz;
  const hAt = (i, j) => H[clamp(j, 0, nz - 1) * nx + clamp(i, 0, nx - 1)];
  // 一塊網格：格點 (i0..i0+NBR_CH, j0..) 每 st 格取一點；裙邊垂 drop 公尺
  function chunkGeo(i0, j0, st, drop) {
    const n = NBR_CH / st + 1, pos = [], nor = [], col = [], idx = [], mt = [];
    const vert = (i, j, dy) => {
      const x = N.gx0 + i * NBR_G, z = N.gz0 + j * NBR_G, h = hAt(i, j), [X, Z] = W(x, z);
      const gx = (hAt(i + st, j) - hAt(i - st, j)) / (2 * st * NBR_G), gz = (hAt(i, j + st) - hAt(i, j - st)) / (2 * st * NBR_G), l = Math.hypot(gx, 1, gz);
      const nxl = -gx / l, nzl = -gz / l; nor.push(nxl * rc - nzl * rs, 1 / l, nxl * rs + nzl * rc);
      const slope = Math.hypot(gx, gz), td = N.TD[clamp(j, 0, nz - 1) * nx + clamp(i, 0, nx - 1)];
      if (h < SEA_Y + .4) c.copy(h < SEA_Y - 2 ? C_BED : C_SAND);
      else if (z < NBR.core.z0) c.copy(C_APRON).lerp(LUC[1], sm01((z - AIR.isl.z1 - 300) / 1200) * .6);   // 引道坡：機場那頭是草，往上漸漸進森林
      else { const k = luAt(x, z); c.copy(LUC[k < 0 ? 1 : k]); }
      if (td < 6) c.lerp(LUC[0], .5);   // 賽道兩側的草地路肩
      c.lerp(C_ROCK, clamp((slope - .55) / .5, 0, .8)).multiplyScalar(.9 + .2 * Math.sin(x * .021 + z * .017) * Math.sin(z * .013 - x * .007));
      pos.push(X, h + dy, Z); col.push(c.r, c.g, c.b); mt.push(TX.hill);
      return pos.length / 3 - 1;
    };
    const g = [];
    for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) g.push(vert(i0 + a * st, j0 + b * st, 0));
    for (let b = 0; b < n - 1; b++) for (let a = 0; a < n - 1; a++) { const A = g[b * n + a], B = g[b * n + a + 1], Cc = g[(b + 1) * n + a], D = g[(b + 1) * n + a + 1]; idx.push(A, D, B, A, Cc, D); }
    // 裙邊：四邊各一排往下垂的點（三角形雙面都朝外不重要，從上面看只會看到縫裡的那一條）
    const edge = (a0, b0, da, db) => { let p = null, q = null; for (let s = 0; s < n; s++) { const a = a0 + da * s, b = b0 + db * s, top = g[b * n + a], bot = vert(i0 + a * st, j0 + b * st, -drop); if (p !== null) idx.push(p, q, top, top, q, bot, p, top, q, top, bot, q); p = top; q = bot; } };
    edge(0, 0, 1, 0); edge(0, n - 1, 1, 0); edge(0, 0, 0, 1); edge(n - 1, 0, 0, 1);
    let hi = -1e9; for (let v = 1; v < pos.length; v += 3) hi = Math.max(hi, pos[v]);
    if (hi < SEA_Y - .5) return null;
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(col, 3)); geo.setAttribute('aMat', new T.Float32BufferAttribute(mt, 1));
    geo.setIndex(idx); geo.computeBoundingSphere();
    return geo;
  }
  const chunks = [];
  for (let j0 = 0; j0 < nz - 1; j0 += NBR_CH) for (let i0 = 0; i0 < nx - 1; i0 += NBR_CH) {
    const geo = chunkGeo(i0, j0, 4, 14); if (!geo) continue;
    const m = new T.Mesh(geo, MAT.ux); m.name = 'nbrFar'; cityAdd(m, null);
    chunks.push({ i0, j0, x0: N.gx0 + i0 * NBR_G, z0: N.gz0 + j0 * NBR_G, far: m, near: null });
  }
  // 近網格的換入換出：每 0.3 秒看一次鏡頭在哪（SEA_FR 座標），一次最多建一塊（約 17k 頂點）
  // 掛在 nbrTick 的 onBeforeRender 只排一個 microtask：這一幀的 render 全部送出之後才跑（render 途中 dispose 已經錄進指令的網格，WebGPU 送出時報 buffer destroyed）
  let nbrT = 0;
  const nbrStream = () => {
    const now = performance.now(); if (now - nbrT < 300) return; nbrT = now;
    const [x, z] = nbrL(camera.position.x, camera.position.z), S = NBR_CH * NBR_G;
    let built = false;
    for (const C of chunks) {
      const d = Math.hypot(Math.max(C.x0 - x, x - C.x0 - S, 0), Math.max(C.z0 - z, z - C.z0 - S, 0));
      if (!C.near && d < NBR_NEAR && !built) { const geo = chunkGeo(C.i0, C.j0, 1, 3); C.near = new T.Mesh(geo, MAT.ux); C.near.name = 'nbrNear'; cityAdd(C.near, null); built = true; }
      else if (C.near && d > NBR_FAR) { scene.remove(C.near); C.near.geometry.dispose(); C.near = null; }
      C.far.visible = !C.near;
    }
    for (const f of NBR_TICK) f(x, z, chunks);
  };
  { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([0, -1e4, 0, 0, -1e4, 0, 0, -1e4, 0], 3)); const m = new T.Mesh(g, MAT.ux); m.frustumCulled = false; m.name = 'nbrTick'; let q = false; m.onBeforeRender = () => { if (!q) { q = true; queueMicrotask(() => { q = false; nbrStream(); }); } }; scene.add(m); }
  // ─── 賽道路面 ───
  {
    const P = [], NN = [], UV = [], AX = [], I = [], lp = [], lc = [], lm = [], li = [], cw = new T.Color(0xc8c8c0);
    const line = (a, b, ya, yb, nxa, nza, nxb, nzb, o0, o1) => {   // 一段邊線（o0、o1 是離中心線的距離）
      const base = lp.length / 3;
      for (const [x, z, y, nxx, nzz] of [[a[0], a[1], ya, nxa, nza], [b[0], b[1], yb, nxb, nzb]]) for (const o of [o0, o1]) { const [X, Z] = W(x + nxx * o, z + nzz * o); lp.push(X, y + .035, Z); lc.push(cw.r, cw.g, cw.b); lm.push(2); }
      li.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    };
    for (const Tk of NBR.tracks) {
      const p = Tk.p, n = p.length, hw = Tk.hw, cnt = Tk.closed ? n + 1 : n; let u = 0;
      const nrm = k => { const a = p[(k - 1 + n) % n], b = p[(k + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [-(b[1] - a[1]) / L, (b[0] - a[0]) / L]; };
      for (let s = 0; s < cnt; s++) {
        const k = s % n, q = p[k], [nx2, nz2] = nrm(Tk.closed ? k : clamp(k, 1, n - 2));
        if (s) u += Math.hypot(q[0] - p[(s - 1) % n][0], q[1] - p[(s - 1) % n][1]);
        const [ax, az] = [nx2 * rc - nz2 * rs, nx2 * rs + nz2 * rc];
        for (const o of [-hw, 0, hw]) { const [X, Z] = W(q[0] + nx2 * o, q[1] + nz2 * o); P.push(X, q[2], Z); NN.push(0, 1, 0); UV.push(Tk.key === 'road' ? o : o + 40, u); AX.push(ax, az); }
        if (s) { const b = P.length / 3 - 6; I.push(b, b + 3, b + 1, b + 1, b + 3, b + 4, b + 1, b + 4, b + 2, b + 2, b + 4, b + 5); }
        if (s && Tk.key !== 'pit') { const a = p[(s - 1) % n], [na, za] = nrm(Tk.closed ? (s - 1) % n : clamp(s - 1, 1, n - 2)); line(a, q, a[2], q[2], na, za, nx2, nz2, hw - .55, hw - .3); line(a, q, a[2], q[2], na, za, nx2, nz2, -hw + .3, -hw + .55); }
      }
    }
    const ag = new T.BufferGeometry(); ag.setAttribute('position', new T.Float32BufferAttribute(P, 3)); ag.setAttribute('normal', new T.Float32BufferAttribute(NN, 3));
    ag.setAttribute('aUV', new T.Float32BufferAttribute(UV, 2)); ag.setAttribute('aAx', new T.Float32BufferAttribute(AX, 2)); ag.setIndex(I); ag.computeVertexNormals(); ag.computeBoundingSphere();
    // 北環的柏油比城裡的暗（參考圖）：同一份 roadConn 著色器（同名同 GLSL），自己的 uAsM 是共用平均色（27-props.js 下載柏油貼圖時設）的 1.9 倍，
    // 細節照片除以它就整片變暗；貼圖還沒下載（uAsOn 0）時和城裡一樣。23-nbr-track.js 的柏油緩衝區也用這份
    const R0 = MAT.roadConn, asM = new T.Vector3(1, 1, 1);
    const asMat = NBR.asphalt = new T.ShaderMaterial({ name: R0.name, uniforms: { ...R0.uniforms, uAsM: { value: asM } }, vertexShader: R0.vertexShader, fragmentShader: R0.fragmentShader, side: R0.side, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    gfxLate.push(asMat);
    const am = new T.Mesh(ag, asMat); am.name = 'nbrAsphalt'; am.frustumCulled = false; nbrGround(am);
    am.onBeforeRender = () => { const v = ASPH_U.uAsM.value; if (asM.x !== v.x * 1.9) asM.copy(v).multiplyScalar(1.9); };
    const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(lp, 3)); lg.setAttribute('color', new T.Float32BufferAttribute(lc, 3)); lg.setAttribute('aMat', new T.Float32BufferAttribute(lm, 1));
    lg.setIndex(li); lg.computeVertexNormals(); lg.computeBoundingSphere();
    const lm2 = new T.Mesh(lg, MAT.ux); lm2.name = 'nbrLines'; lm2.frustumCulled = false; nbrGround(lm2);
  }
  DECKS.push(nbrDeck);
  // 測試用：window.__nc.nbr（99-main.js 建好 __nc 之後才掛上）
  const api = NBR.api = {
    grid: () => ({ nx: N.nx, nz: N.nz, ms: N.ms, chunks: chunks.length, near: chunks.filter(C => C.near).length }),
    W: (x, z) => W(x, z), L: (X, Z) => nbrL(X, Z), h: (X, Z) => nbrH(X, Z), deck: (X, Z) => nbrDeck(X, Z), land: (X, Z) => nbrLandW(X, Z),
    track: k => { const Tk = NBR[k]; return Tk && { n: Tk.p.length, hw: Tk.hw, names: Tk.names, at: i => { const q = Tk.p[((i % Tk.p.length) + Tk.p.length) % Tk.p.length]; const [X, Z] = W(q[0], q[1]); return [X, q[2], Z]; } }; },
    core: NBR.core, apron: nbrApron(), fx: () => NBR.fx && NBR.fx(), bld: () => NBR.bld, facSync: () => NBR.facSync && NBR.facSync(), roads: () => NBR.roads,   // fx：23-nbr-track.js 的設施；bld：24-nbr-bld.js
  };
  const hook = () => { if (window.__nc) window.__nc.nbr = api; else setTimeout(hook, 200); };
  hook();
}
