// ═══ 山路路口接到城裡的路（使用者：別墅區與榛嶺的山路路口和城裡的路之間隔著草地，要鋪成真的路）═══
// 外緣山路（10-city.js 的 HILL.paths，不是連絡路的那幾條與下山路）的第一點 P[0] 在外緣（CITY_POLY）上，城裡最近的路離它 10–90 m，中間是片外圍的草地。
// 每個路口從城裡最近的路（中心線上的投影點 C）垂直離開，三次貝茲曲線轉到山路第一段的方向接上 P[0]，每 4 m 一點（世界座標）存在 P.conn（C → P[0]，含兩端）。
// 曲線碰到片的路網（離片的格子 < HR + 1，起點那段路除外）、出了外緣或碰到水就換下一條最近的路。
// 畫法同山路（10-city.js 的「路面」那段）：MAT.roadConn 的柏油（aUV 是橫向、沿路公尺數）、水泥路肩、白色邊線；路面在草地上 4 cm（片外圍的地面高度是 0），
// 最後 12 m 漸漸抬到山路的路面高度（山網格 + 0.25 m）；從路邊（離中心線 HR − 0.4）鋪起，蓋過城裡那條路的邊。超過 40 m 的在中間立一盞別墅區那種水泥桿路燈（HILL.lampHeads）。
// 讓路：20-props.js 的片邊路燈、草地上的樹、片之間的碎石步道與亭子避開 hillConnNear；69-gps.js 的導航與 90-hud.js 的地圖把 P.conn 接在山路前面 ═══
const HILL_CONN = [];
function hillConnNear(x, z, r) {
  for (const C of HILL_CONN) {
    if (x < C.bb[0] - r || x > C.bb[1] + r || z < C.bb[2] - r || z > C.bb[3] + r) continue;
    const P = C.near;
    for (let k = 1; k < P.length; k++) { const [ax, az] = P[k - 1], dx = P[k][0] - ax, dz = P[k][1] - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1), 0, 1); if (Math.hypot(x - ax - dx * t, z - az - dz * t) < r) return true; }
  }
  return false;
}
const hillConnNearL = (x, z, r) => HILL_CONN.length > 0 && hillConnNear(...toW(x, z), r);   // 邏輯座標（30-vehicles.js 的路邊停車）
if (HILL.paths) {
  const HW = HILL.roadHW, st = { conn: 0, len: 0, tries: [], fail: [] };
  const cands = RN.edges.filter(e => e.kind !== 'f');
  // 曲線：C（路中心）→ 路邊垂直離開 → P[0]（照山路第一段的方向進去）
  const curve = (e, u, P) => {
    const [cx, cz, tx, tz] = edgeAt(e, u), [mx, mz] = P[0];
    let nx = -tz, nz = tx; if (nx * (mx - cx) + nz * (mz - cz) < 0) { nx = -nx; nz = -nz; }
    const q = P[Math.min(P.length - 1, 2)], ql = Math.hypot(q[0] - mx, q[1] - mz) || 1, dx = (q[0] - mx) / ql, dz = (q[1] - mz) / ql;   // 山路往外的方向
    const D = Math.hypot(mx - cx, mz - cz), a = Math.max(HR, D * .45), b = Math.max(4, D * .4);
    const B = [[cx, cz], [cx + nx * a, cz + nz * a], [mx - dx * b, mz - dz * b], [mx, mz]];
    const bz = (t, k) => (1 - t) ** 3 * B[0][k] + 3 * (1 - t) ** 2 * t * B[1][k] + 3 * (1 - t) * t * t * B[2][k] + t ** 3 * B[3][k];
    const raw = []; for (let i = 0; i <= 60; i++) raw.push([bz(i / 60, 0), bz(i / 60, 1)]);
    const out = [raw[0]]; let acc = 0;   // 每 4 m 重取樣
    for (let i = 1; i < raw.length; i++) { const L = Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]); acc += L; if (acc >= 4 || i === raw.length - 1) { out.push(raw[i]); acc = 0; } }
    if (out.length > 2 && Math.hypot(out.at(-1)[0] - out.at(-2)[0], out.at(-1)[1] - out.at(-2)[1]) < 1.5) out.splice(-2, 1);
    return out;
  };
  // 能不能鋪：路邊以外不碰片的路網、不出外緣、不下水
  const ok = pts => {
    let s = 0;
    for (let k = 1; k < pts.length - 1; k++) {
      s += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
      const [x, z] = pts[k];
      if (s > HR + 2 && zoneNearL(x, z, HR + 1)) return 'zone';
      if (!inCity(x, z) && polyDistPt(CITY_POLY, x, z) > 3) return 'out';
      if (!landW(x, z)) return 'water';
    }
    return null;
  };
  for (const P of HILL.paths) {
    if (P.link && !P.mouth || P.length < 3) continue;
    const [mx, mz] = P[0], tried = [];
    // 候選：每條路上離路口最近的一點，由近到遠試五條
    const C = [];
    for (const e of cands) {
      let best = null;
      for (let k = 1; k < e.pts.length; k++) { const [ax, az] = e.pts[k - 1], dx = e.pts[k][0] - ax, dz = e.pts[k][1] - az, l2 = dx * dx + dz * dz || 1, t = clamp(((mx - ax) * dx + (mz - az) * dz) / l2, 0, 1), d = Math.hypot(mx - ax - dx * t, mz - az - dz * t); if (!best || d < best.d) best = { d, u: e.cum[k - 1] + Math.sqrt(l2) * t }; }
      if (best && best.d < 260) C.push({ e, ...best });
    }
    C.sort((a, b) => a.d - b.d);
    let got = null;
    for (const c of C.slice(0, 5)) {
      const u = clamp(c.u, Math.min(HR + 12, c.e.len / 2), Math.max(c.e.len - HR - 12, c.e.len / 2)), pts = curve(c.e, u, P), why = ok(pts);   // 離路口 12 m 以上（斑馬線、號誌桿那一段不出去）
      tried.push(why || 'ok');
      if (!why) { got = { e: c.e, u, pts }; break; }
    }
    st.tries.push(tried.join(','));
    if (!got) { st.fail.push([Math.round(mx), Math.round(mz)]); continue; }
    const pts = got.pts, near = [...pts, ...P.slice(1, 6).map(p => [p[0], p[1]])], xs = near.map(p => p[0]), zs = near.map(p => p[1]);   // near：讓路的範圍多算山路開頭 40 m（路口貼著城裡的路時，山路本身也壓在路邊停車格上）
    HILL_CONN.push({ P, e: got.e, u: got.u, pts, near, bb: [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)] });
    P.conn = pts;
    st.conn++; st.len += Math.round(pts.reduce((a, p, k) => k ? a + Math.hypot(p[0] - pts[k - 1][0], p[1] - pts[k - 1][1]) : 0, 0));
  }
  HILL_CONN.stat = st;
  // ─── 畫面 ───
  const pos = [], col = [], mt = [], idx = [], c = new T.Color(), rk = new Kit();
  const AP = [], AN = [], AUV = [], AAX = [], AI = [];
  for (const C of HILL_CONN) {
    const pts = C.pts, n = pts.length, sL = [0];
    for (let k = 1; k < n; k++) sL.push(sL[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    const len = sL[n - 1], s0 = (C.e.hw || HR) - .4, yEnd = (() => { const [x, z] = pts[n - 1], h = hillMeshH(x, z); return (Number.isFinite(h) ? h : 0) + .25; })();
    // 從路邊鋪起：起點那一段切在 s0（橫向座標照沿路的公尺數，和山路一樣從 0 起算）
    const S = [];
    for (let k = 0; k < n; k++) {
      if (sL[k] < s0 && !(k + 1 < n && sL[k + 1] > s0)) continue;
      if (sL[k] < s0) { const t = (s0 - sL[k]) / (sL[k + 1] - sL[k]); S.push([pts[k][0] + (pts[k + 1][0] - pts[k][0]) * t, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * t, s0]); }
      else S.push([pts[k][0], pts[k][1], sL[k]]);
    }
    const yAt = s => { const r = clamp((s - (len - 12)) / 12, 0, 1); return .04 + (yEnd - .04) * r * r * (3 - 2 * r); };
    const nrm = i => { const o = S[Math.min(S.length - 1, i + 1)], p = S[Math.max(0, i - 1)], L = Math.hypot(o[0] - p[0], o[1] - p[1]) || 1; return [-(o[1] - p[1]) / L, (o[0] - p[0]) / L]; };
    // 柏油
    const base = AP.length / 3;
    S.forEach(([x, z, s], i) => {
      const [nx, nz] = nrm(i), y = yAt(s);
      for (const off of [-HW, 0, HW]) { AP.push(x + nx * off, y, z + nz * off); AN.push(0, 1, 0); AUV.push(off, s - s0); AAX.push(nx, nz); }
      if (i) { const b = base + (i - 1) * 3; AI.push(b, b + 3, b + 1, b + 1, b + 3, b + 4, b + 1, b + 4, b + 2, b + 2, b + 4, b + 5); }
    });
    // 水泥路肩、白色邊線（同 10-city.js 山路的 strip）
    const strip = (o0, o1, dy, hex, mat) => {
      c.set(hex);
      for (let i = 0; i + 1 < S.length; i++) {
        const b = pos.length / 3;
        for (const k of [i, i + 1]) { const [x, z, s] = S[k], [nx, nz] = nrm(k); for (const off of [o0, o1]) { pos.push(x + nx * off, yAt(s) + dy, z + nz * off); col.push(c.r, c.g, c.b); mt.push(mat); } }
        idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
      }
    };
    strip(-HW - 1.1, -HW, -.03, 0x77746c, TX.conc); strip(HW, HW + 1.1, -.03, 0x77746c, TX.conc);
    strip(-HW + .2, -HW + .36, .02, 0xbdbcb4, 2); strip(HW - .36, HW - .2, .02, 0xbdbcb4, 2);
    // 路燈：40 m 以上的在中間立一盞（別墅區的水泥桿、燈臂伸向路面）
    if (len - s0 > 40) {
      const i = S.findIndex(p => p[2] > (s0 + len) / 2), [x, z] = S[i], [nx, nz] = nrm(i), sd = C.P.akina ? -1 : 1;
      const lx = x + nx * sd * (HW + .8), lz = z + nz * sd * (HW + .8), y = 0;
      rk.cyl(lx, y + 3.6, lz, .1, .15, 7.2, 8, 0x9c9b95, TX.conc).bar(lx, y + 5.9, lz, lx - nx * sd * 1.4, y + 6, lz - nz * sd * 1.4, .1, .08, 0x3a3d40, TX.enamel);
      rk.box(lx - nx * sd * 1.4, y + 5.92, lz - nz * sd * 1.4, .45, .1, .22, 0xffd9a0, 11);
      (HILL.lampHeads ||= []).push({ x: lx - nx * sd * 1.4, z: lz - nz * sd * 1.4, t: 0, y: -.4 });   // 22-akina.js 寫進路燈表（地面高 0，同 10-city.js 的 max(y − 1.18, −0.4)）
      circles.push({ x: lx, z: lz, r: .22, w: 1 });   // 世界座標的圓柱（w: 1，cityWorld 不再換）
      C.lamp = [lx, lz];
    }
  }
  if (AP.length) {
    const ag = new T.BufferGeometry(); ag.setAttribute('position', new T.Float32BufferAttribute(AP, 3)); ag.setAttribute('normal', new T.Float32BufferAttribute(AN, 3));
    ag.setAttribute('aUV', new T.Float32BufferAttribute(AUV, 2)); ag.setAttribute('aAx', new T.Float32BufferAttribute(AAX, 2)); ag.setIndex(AI); ag.computeVertexNormals(); ag.computeBoundingSphere();
    if (ag.attributes.normal.array[1] < 0) { ag.setIndex(AI.map((v, n) => AI[n - n % 3 + [0, 2, 1][n % 3]])); ag.computeVertexNormals(); }   // 繞序朝下就翻過來
    const am = new T.Mesh(ag, MAT.roadConn); am.name = 'hillMouthAsphalt'; groundAdd(am, null);
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setAttribute('aMat', new T.Float32BufferAttribute(mt, 1));
    g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
    if (g.attributes.normal.array[1] < 0) { g.setIndex(idx.map((v, n) => idx[n - n % 3 + [0, 2, 1][n % 3]])); g.computeVertexNormals(); }
    const m = new T.Mesh(g, MAT.ux); m.name = 'hillMouthEdges'; cityAdd(m, null);
    if (rk.n !== 0) cityAdd(new T.Mesh(rk.build(), MAT.ux), null);
  }
}
