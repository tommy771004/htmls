// ═══ 紐柏林周邊的道路（09-nbr-dem.js 的 OSM 道路：幹道、縣道、村裡的住宅街與巷道、服務道路；plans/260-nurburgring.md）═══
// 照真實路網鋪在地形上（村子裡彎來彎去的街把房子與坡地上露出的牆基串起來）：每 3 m 一個斷面，橫向 3～5 點各自貼 nbrMeshL，
// 抬高一點、polygonOffset 壓過 23-nbr-track.js 的草皮；路面是城裡連接道路的柏油（MAT.roadConn 同一份著色器與 uniform，aUV 橫向加 40：
// 不畫城裡的黃色中線與車道虛線），幹道與縣道兩側畫德國式的白色邊線。橋與隧道段不鋪；進到賽道、維修道、引道與兩側的路緣、護欄（離賽道邊 3.5 m 內）就斷開。網格照 512 m 一格分（照格剔除）。路邊的格子記在 NBR.roadR（8 m 一格），50-nbr.js 不在上面種樹 ═══
if (NBR && NBR_OSM.road) {
  const N = nbrGrid(), [ox, oz] = toW(0, 0, SEA_FR), [ex, ez] = toW(1, 0, SEA_FR), rc = ex - ox, rs = ez - oz;
  const W = (x, z) => [ox + x * rc - z * rs, oz + x * rs + z * rc];
  const B = NBR_OSM.road, cnt = nbB64(B.n, Uint16Array), xz = nbB64(B.xz, Int16Array), kind = nbB64(B.k, Uint8Array);
  const HW = [3.75, 3.25, 2.6, 1.7, 1.35], LIFT = [.1, .088, .076, .064, .058], STEP = 3, CELL = 512;   // 第 5 種是 24-nbr-bld.js 拉的車道
  const HS = new Map(), hk = (x, z) => Math.floor(x / 32) + ',' + Math.floor(z / 32);   // 鋪好的路面取樣點（32 m 一格），車道找最近的路
  const roadR = NBR.roadR = new Uint8Array(N.nx * N.nz);
  const mark = (x, z) => { const i = Math.round((x - N.gx0) / NBR_G), j = Math.round((z - N.gz0) / NBR_G); if (i >= 0 && j >= 0 && i < N.nx && j < N.nz) roadR[j * N.nx + i] = 1; };
  const tdAt = (x, z) => { const i = Math.round((x - N.gx0) / NBR_G), j = Math.round((z - N.gz0) / NBR_G); return i < 0 || j < 0 || i >= N.nx || j >= N.nz ? 1e9 : N.TD[j * N.nx + i]; };
  // 路邊離賽道邊至少 3.5 m（23-nbr-track.js 的路緣、護欄在賽道邊外 3.2 m 以內），不鋪到路肩與護欄上；也不穿過維修區大樓（09-nbr.js 的 nbrPitIn）
  const ok = (x, z, k) => nbrInL(x, z) && tdAt(x, z) > HW[k] + 3.5 && !nbrTrackL(x, z, HW[k] + 3.5) && nbrMeshL(x, z) > SEA_Y + .5 && !nbrPitIn(x, z, HW[k] + 2);
  const bufs = new Map(), at = (x, z) => { const key = Math.floor(x / CELL) + ',' + Math.floor(z / CELL); let b = bufs.get(key); if (!b) bufs.set(key, b = { P: [], NN: [], UV: [], AX: [], I: [], lp: [], lc: [], lm: [], li: [] }); return b; };
  const cw = new T.Color(0xc4c4bc), st = { roads: 0, km: 0, runs: 0 };
  // 一段連續可鋪的取樣點（x, z, 切線法向 nx, nz, 沿路 u）→ 帶狀網格（每 48 點切一塊，照中點分格）
  function run(S, k) {
    const hw = HW[k], os = hw > 2.5 ? [-hw, -hw / 2, 0, hw / 2, hw] : [-hw, 0, hw], m = os.length, lift = LIFT[k];
    for (let s0 = 0; s0 < S.length - 1; s0 += 47) {
      const S2 = S.slice(s0, s0 + 48), mid = S2[S2.length >> 1], b = at(mid[0], mid[1]);
      const base = b.P.length / 3;
      S2.forEach(([x, z, nx, nz, u], s) => {
        const [ax, az] = [nx * rc - nz * rs, nx * rs + nz * rc];
        for (const o of os) { const px = x + nx * o, pz = z + nz * o, [X, Z] = W(px, pz); b.P.push(X, nbrMeshL(px, pz) + lift, Z); b.NN.push(0, 1, 0); b.UV.push(o + 40, u); b.AX.push(ax, az); }
        if (s) for (let q = 0; q < m - 1; q++) { const a = base + (s - 1) * m + q, c = base + s * m + q; b.I.push(a, c, a + 1, a + 1, c, c + 1); }
        if (s && k <= 1) for (const [o0, o1] of [[hw - .45, hw - .3], [-hw + .3, -hw + .45]]) {   // 白色邊線
          const [x0, z0, nx0, nz0] = S2[s - 1], lb = b.lp.length / 3;
          for (const [qx, qz, qnx, qnz] of [[x0, z0, nx0, nz0], [x, z, nx, nz]]) for (const o of [o0, o1]) { const px = qx + qnx * o, pz = qz + qnz * o, [X, Z] = W(px, pz); b.lp.push(X, nbrMeshL(px, pz) + lift + .025, Z); b.lc.push(cw.r, cw.g, cw.b); b.lm.push(2); }
          b.li.push(lb, lb + 1, lb + 2, lb + 1, lb + 3, lb + 2);
        }
      });
      st.runs++;
    }
  }
  // 一條折線：照 STEP 重新取樣（折點處照樣取），法向用前後點的中央差分；回傳長度
  function lay(P, k) {
    const n = P.length, Q = [P[0]];
    for (let j = 1; j < n; j++) { const a = P[j - 1], b = P[j], L = Math.hypot(b[0] - a[0], b[1] - a[1]), c = Math.max(1, Math.ceil(L / STEP)); for (let t = 1; t <= c; t++) Q.push([a[0] + (b[0] - a[0]) * t / c, a[1] + (b[1] - a[1]) * t / c]); }
    let S = [], u = 0;
    for (let j = 0; j < Q.length; j++) {
      const [x, z] = Q[j], a = Q[Math.max(0, j - 1)], b = Q[Math.min(Q.length - 1, j + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      if (j) u += Math.hypot(x - Q[j - 1][0], z - Q[j - 1][1]);
      const nx = -(b[1] - a[1]) / L, nz = (b[0] - a[0]) / L;
      if (ok(x, z, k)) {
        S.push([x, z, nx, nz, u]); for (const t of [-HW[k] - 3, 0, HW[k] + 3]) mark(x + nx * t, z + nz * t);
        if (k < 4) { const key = hk(x, z); let a = HS.get(key); if (!a) HS.set(key, a = []); a.push(x, z, k); }
      } else { if (S.length > 1) run(S, k); S = []; }
    }
    if (S.length > 1) run(S, k);
    return u;
  }
  for (let i = 0, o = 0; i < cnt.length; i++) {
    const n = cnt[i], P = []; for (let j = 0; j < n; j++) P.push([NBR_OX - xz[(o + j) * 2] / 2, NBR_OZ - xz[(o + j) * 2 + 1] / 2]); o += n;
    const kd = kind[i]; if (kd & 12 || n < 2) continue;   // 橋、隧道
    st.km += lay(P, kd & 3) / 1000; st.roads++;
  }
  // 車道（24-nbr-bld.js）：最近的路面點 [x, z, 到路中心的距離, 那條路的半寬]，r 內沒有回傳 null
  NBR.roadNear = (x, z, r) => {
    let best = null, bd = r * r; const i0 = Math.floor((x - r) / 32), i1 = Math.floor((x + r) / 32), j0 = Math.floor((z - r) / 32), j1 = Math.floor((z + r) / 32);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const a = HS.get(i + ',' + j); if (a) for (let q = 0; q < a.length; q += 3) { const d = (a[q] - x) ** 2 + (a[q + 1] - z) ** 2; if (d < bd) { bd = d; best = [a[q], a[q + 1], 0, HW[a[q + 2]]]; } } }
    if (best) best[2] = Math.sqrt(bd); return best;
  };
  NBR.roadLay = P => { st.drive++; st.dkm += lay(P, 4) / 1000; };
  st.drive = 0; st.dkm = 0;
  // 路面：MAT.roadConn 的著色器與 uniform（城裡的柏油），自己的 polygonOffset 壓過草皮與碎石。24-nbr-bld.js 拉完車道才建（NBR.roadDone）
  NBR.roadDone = () => {
  const R0 = MAT.roadConn, rdMat = new T.ShaderMaterial({ name: R0.name, uniforms: R0.uniforms, vertexShader: R0.vertexShader, fragmentShader: R0.fragmentShader, side: R0.side, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  gfxLate.push(rdMat);
  for (const b of bufs.values()) {
    if (!b.I.length) continue;
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(b.P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(b.NN, 3));
    g.setAttribute('aUV', new T.Float32BufferAttribute(b.UV, 2)); g.setAttribute('aAx', new T.Float32BufferAttribute(b.AX, 2)); g.setIndex(b.I); g.computeVertexNormals(); g.computeBoundingSphere();
    const m = new T.Mesh(g, rdMat); m.name = 'nbrRoads'; nbrGround(m);
    if (b.li.length) {
      const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(b.lp, 3)); lg.setAttribute('color', new T.Float32BufferAttribute(b.lc, 3));
      lg.setAttribute('aMat', new T.Float32BufferAttribute(b.lm, 1)); lg.setIndex(b.li); lg.computeVertexNormals(); lg.computeBoundingSphere();
      const lm = new T.Mesh(lg, MAT.ux); lm.name = 'nbrRoadLines'; nbrGround(lm);
    }
  }
  st.km = Math.round(st.km * 10) / 10; st.dkm = Math.round(st.dkm * 10) / 10; st.meshes = bufs.size; NBR.roadDone = null;
  };
  NBR.roads = st;   // 驗收：__nc.nbr.roads()
}
