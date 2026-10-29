// ═══ 紐柏林的賽道設施（22-nbr.js 只有路面與白色邊線；使用者：「你做的不像賽車場」，照 CGTrader「Nürburgring Karussell」的參考圖做）═══
// 北環：彎道的紅白路緣、兩側的雙層鍍鋅護欄（每 4 m 一根柱）、急彎外側護欄後面的木欄（觀眾區）、落差大的那側改成白色水泥牆、
// 路肩到護欄後面是草皮（城裡草地的 lawnBare，急彎內側一路鋪到彎心）、Karussell 內側的水泥槽（凹下去再翹起來，邊上一條紅白路緣）。
// GP：彎道外側的柏油緩衝區（急彎是碎石）、水泥護牆加防護網；維修道靠 GP 那側是維修牆。別的賽道或路接進來的地方護欄斷開。
// 幾何是世界座標，照 22-nbr.js 的地形塊（1024 m）分組，鏡頭 NBR_FX_IN 內才建、NBR_FX_OUT 外收掉（同 50-nbr.js 的樹）；草皮只在那塊換成近網格時顯示
// （遠網格 32 m 一格，草皮會埋進去）。碰撞（護欄、水泥牆、維修牆）開場就全部登錄。草皮範圍記在 NBR.lawn（8 m 一格），50-nbr.js 不在上面種樹 ═══
const NBR_FX_IN = 1100, NBR_FX_OUT = 1400;
if (NBR) {
  const N = nbrGrid(), [ox, oz] = toW(0, 0, SEA_FR), [ex, ez] = toW(1, 0, SEA_FR), rc = ex - ox, rs = ez - oz;
  const W = (x, z) => [ox + x * rc - z * rs, oz + x * rs + z * rc], WN = (x, z) => [x * rc - z * rs, x * rs + z * rc];
  const S = NBR_CH * NBR_G;
  // ─── 每條賽道每一點：法線（往 +n 是 s = +1 那側）、沿路距離、帶號曲率（> 0 往 +n 彎，內側是 s = sign κ）───
  const TR = NBR.tracks.map((Tk, ti) => {
    const p = Tk.p, n = p.length, cl = Tk.closed, at = k => p[cl ? (k % n + n) % n : clamp(k, 0, n - 1)];
    const nx = new Float32Array(n), nz = new Float32Array(n), u = new Float32Array(n), kr = new Float32Array(n), ka = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const a = at(k - 1), b = at(k + 1), L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; nx[k] = -(b[1] - a[1]) / L; nz[k] = (b[0] - a[0]) / L;
      if (k) u[k] = u[k - 1] + Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]);
      const A = at(k - 3), B = p[k], C = at(k + 3), l1 = Math.hypot(B[0] - A[0], B[1] - A[1]), l2 = Math.hypot(C[0] - B[0], C[1] - B[1]);
      kr[k] = l1 > .5 && l2 > .5 ? Math.atan2((B[0] - A[0]) * (C[1] - B[1]) - (B[1] - A[1]) * (C[0] - B[0]), (B[0] - A[0]) * (C[0] - B[0]) + (B[1] - A[1]) * (C[1] - B[1])) / ((l1 + l2) / 2) : 0;
    }
    for (let k = 0; k < n; k++) { let s = 0; for (let d = -4; d <= 4; d++) s += kr[cl ? (k + d + n) % n : clamp(k + d, 0, n - 1)]; ka[k] = s / 9; }
    return { Tk, ti, key: Tk.key, p, n, cl, hw: Tk.hw, nx, nz, u, ka, nxt: k => cl ? (k + 1) % n : k + 1 < n ? k + 1 : -1 };
  });
  const TRK = Object.fromEntries(TR.map(t => [t.key, t]));
  // 沿路的陣列：平滑（環狀）、往前後擴張
  const ring = (t, k) => t.cl ? (k % t.n + t.n) % t.n : clamp(k, 0, t.n - 1);
  const smooth = (t, a, r) => { const o = new Float32Array(t.n); for (let k = 0; k < t.n; k++) { let s = 0; for (let d = -r; d <= r; d++) s += a[ring(t, k + d)]; o[k] = s / (2 * r + 1); } return o; };
  const grow = (t, a, r) => { const o = new Float32Array(t.n); for (let k = 0; k < t.n; k++) { let m = 0; for (let d = -r; d <= r; d++) m = Math.max(m, a[ring(t, k + d)]); o[k] = m; } return o; };
  // 所有賽道與進場路的點（16 m 一格）：護欄、路緣在別條路接進來的地方斷開
  const HS = new Map(), hk = (x, z) => (Math.floor(x / 16) + 2000) * 4000 + Math.floor(z / 16) + 2000;
  for (const t of TR) for (let k = 0; k < t.n; k++) { const h = hk(t.p[k][0], t.p[k][1]); let a = HS.get(h); if (!a) HS.set(h, a = []); a.push(t.ti, k); }
  const busy = (x, z, t, k, pad) => {
    const cx = Math.floor(x / 16), cz = Math.floor(z / 16);
    for (let i = cx - 1; i <= cx + 1; i++) for (let j = cz - 1; j <= cz + 1; j++) {
      const a = HS.get((i + 2000) * 4000 + j + 2000); if (!a) continue;
      for (let q = 0; q < a.length; q += 2) {
        const o = TR[a[q]], kk = a[q + 1], d = Math.hypot(o.p[kk][0] - x, o.p[kk][1] - z);
        if (o !== t) { if (d < o.hw + pad) return true; }
        else { const dk = Math.abs(kk - k), dd = t.cl ? Math.min(dk, t.n - dk) : dk; if (dd > 30 && d < t.hw + pad) return true; }
      }
    }
    return false;
  };
  const hsh = (a, b) => { let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
  const at = (t, k, s, o) => [t.p[k][0] + t.nx[k] * s * o, t.p[k][1] + t.nz[k] * s * o];
  // ─── Karussell：OSM 那一段的中心（真實座標 1838, −2415）最近的點前後 30 點裡最急的地方（半徑約 33 m），曲率過四成的那一段 ───
  const KAR = (() => {
    const t = TRK.ns; if (!t) return null;
    const cx = NBR_OX - 1838, cz = NBR_OZ + 2415; let kc = 0; for (let k = 0; k < t.n; k++) if (Math.hypot(t.p[k][0] - cx, t.p[k][1] - cz) < Math.hypot(t.p[kc][0] - cx, t.p[kc][1] - cz)) kc = k;
    let kb = kc; for (let k = kc - 30; k <= kc + 30; k++) if (Math.abs(t.ka[ring(t, k)]) > Math.abs(t.ka[kb])) kb = ring(t, k);
    const km = Math.abs(t.ka[kb]), sd = Math.sign(t.ka[kb]); let k0 = kb, k1 = kb;
    while (k0 > 0 && Math.abs(t.ka[k0 - 1]) > km * .4 && Math.sign(t.ka[k0 - 1]) === sd) k0--;
    while (k1 < t.n - 1 && Math.abs(t.ka[k1 + 1]) > km * .4 && Math.sign(t.ka[k1 + 1]) === sd) k1++;
    return { k0, k1, kb, s: sd, r: 1 / km };
  })();
  const inKar = (t, k, s) => KAR && t.key === 'ns' && s === KAR.s && k >= KAR.k0 - 3 && k <= KAR.k1 + 3;
  // ─── 每條賽道、每一側（0：s = −1，1：s = +1）的設施 ───
  //   ro 護欄（牆）離中心線的距離；rail 0 沒有、1 鍍鋅護欄、2 水泥牆、3 水泥護牆＋防護網（GP）、4 維修牆；kerb 路緣寬（0 沒有）；
  //   lawn 草皮外緣；run 柏油緩衝區外緣（GP）；grav 碎石；fence 木欄
  const FX = new Map();
  for (const t of TR) {
    if (t.key === 'road') continue;
    const n = t.n, ak = Float32Array.from(t.ka, Math.abs), sides = [];
    for (const s of [-1, 1]) {
      const inn = Float32Array.from(t.ka, v => Math.sign(v) === s ? Math.abs(v) : 0), out = Float32Array.from(t.ka, v => Math.sign(v) === -s ? Math.abs(v) : 0);
      const ro = new Float32Array(n), rail = new Uint8Array(n), kerb = new Float32Array(n), lawn = new Float32Array(n), run = new Float32Array(n), grav = new Uint8Array(n), fence = new Uint8Array(n);
      const kIn = grow(t, Float32Array.from(inn, v => v > 1 / 220 ? 1 : 0), 4), kOut = grow(t, Float32Array.from(out, v => v > 1 / 110 ? 1 : 0), 5);
      if (t.key === 'ns') {
        const wide = smooth(t, grow(t, Float32Array.from(inn, v => clamp(v * 600 - 2, 0, 14)), 6), 6), spec = grow(t, Float32Array.from(out, v => v > 1 / 100 ? 1 : 0), 14);
        for (let k = 0; k < n; k++) {
          ro[k] = t.hw + 3.2; kerb[k] = kIn[k] ? 1.1 : kOut[k] ? .8 : 0;
          lawn[k] = Math.min(ro[k] + 6 + wide[k], Math.max(ro[k] + 1, .85 / Math.max(ak[k], 1e-4)));   // 草皮一路鋪到林緣（參考圖：護欄後面還有幾公尺草）
          const [x, z] = at(t, k, s, ro[k] + 8), dy = nbrMeshL(x, z) - t.p[k][2];
          rail[k] = Math.abs(dy) > 2.6 ? 2 : 1; fence[k] = spec[k] && rail[k] === 1 ? 1 : 0;
        }
        if (KAR) for (let k = KAR.k0 - 3; k <= KAR.k1 + 3; k++) if (s === KAR.s) { kerb[k] = 0; lawn[k] = Math.max(lawn[k], Math.min(t.hw + 30, KAR.r * .95)); }
      } else if (t.key === 'gp') {
        const ofs = smooth(t, grow(t, Float32Array.from(out, v => clamp(v * 2400, 0, 26)), 8), 8), gr = grow(t, Float32Array.from(out, v => v > 1 / 70 ? 1 : 0), 6);
        for (let k = 0; k < n; k++) {
          ro[k] = t.hw + 7 + ofs[k]; rail[k] = 3; kerb[k] = kIn[k] ? 1.5 : kOut[k] ? 1.2 : 0;
          run[k] = ofs[k] > 2 ? ro[k] - 3.5 : 0; grav[k] = gr[k] && ofs[k] > 8 ? 1 : 0; lawn[k] = ro[k] + 2;
        }
      } else if (t.key === 'pit') {
        const g = TRK.gp, dG = (k, ss) => { const [x, z] = at(t, k, ss, t.hw + 2); let m = 1e9; for (let q = 0; q < g.n; q++) m = Math.min(m, Math.hypot(g.p[q][0] - x, g.p[q][1] - z)); return m; };
        for (let k = 0; k < n; k++) {   // 維修牆：GP 那一側（這一側比另一側近）、GP 在 16 m 內
          const a = dG(k, s), b = dG(k, -s);
          ro[k] = t.hw + .6; rail[k] = a < b && a < g.hw + 16 ? 4 : 0; lawn[k] = rail[k] ? 0 : t.hw + 3;
        }
      }
      // 斷開：別條路（含進場路）接近的地方（擴張 2 點）；路緣斷得少一點
      const gap = new Float32Array(n), kgap = new Float32Array(n);
      for (let k = 0; k < n; k++) {
        if (rail[k]) { const [x, z] = at(t, k, s, ro[k]); gap[k] = busy(x, z, t, k, rail[k] === 4 ? -.5 : 2.5) ? 1 : 0; }
        if (kerb[k]) { const [x, z] = at(t, k, s, t.hw + kerb[k]); kgap[k] = busy(x, z, t, k, .8) ? 1 : 0; }
      }
      const g2 = grow(t, gap, 2), kg2 = grow(t, kgap, 1);
      for (let k = 0; k < n; k++) { if (g2[k]) { rail[k] = 0; fence[k] = 0; } if (kg2[k]) kerb[k] = 0; }
      // 維修區大樓（24-nbr-pit.js）與門口的工作車道上不鋪草皮與緩衝區（GP 彎外的草皮可以寬到 40 m，會蓋過車間的地板）
      if (t.key !== 'pit' && nbrPitBld()) for (let k = 0; k < n; k++) { const L = Math.max(lawn[k], run[k]); for (let o = t.hw + 1; o <= L; o += 2) if (nbrPitIn(...at(t, k, s, o), 1.5)) { lawn[k] = Math.min(lawn[k], o - 2); if (run[k]) run[k] = Math.min(run[k], o - 2); break; } }
      sides.push({ s, ro, rail, kerb, lawn, run, grav, fence });
    }
    FX.set(t, sides);
  }
  // ─── 碰撞：護欄與牆每 3 段一個薄盒（直弦；急彎半徑 24 m 時弦高約 0.75 m，這裡只到 2 段）───
  let nCol = 0;
  for (const [t, sides] of FX) for (const F of sides) {
    for (let k = 0; k < t.n; k += 0) {
      if (!F.rail[k]) { k++; continue; }
      let k2 = k, m = 0; const lim = Math.abs(t.ka[k]) > 1 / 60 ? 1 : Math.abs(t.ka[k]) > 1 / 200 ? 2 : 3;
      while (m < lim) { const q = t.nxt(k2); if (q < 0 || q <= k2 || !F.rail[q]) break; k2 = q; m++; }
      if (k2 === k) { k++; continue; }
      const [ax, az] = at(t, k, F.s, F.ro[k]), [bx, bz] = at(t, k2, F.s, F.ro[k2]), [AX, AZ] = W(ax, az), [BX, BZ] = W(bx, bz), L = Math.hypot(BX - AX, BZ - AZ);
      const y0 = Math.min(nbrMeshL(ax, az), nbrMeshL(bx, bz)), hy = F.rail[k] === 1 ? 1.1 : F.rail[k] === 2 ? 1.05 : 1.15;
      if (L > .3) { colliders.push({ x0: -.05, x1: L + .05, z0: -.15, z1: .15, zn: frameW(AX, AZ, BX - AX, BZ - AZ), ly: y0 - 2, hy: y0 + hy, low: 1 }); nCol++; }
      k = k2;
    }
  }
  // ─── 草皮範圍（8 m 一格；50-nbr.js 不在上面種樹）───
  const lawnR = NBR.lawn = new Uint8Array(N.nx * N.nz);
  const mark = (x, z) => { const i = Math.round((x - N.gx0) / NBR_G), j = Math.round((z - N.gz0) / NBR_G); if (i >= 0 && j >= 0 && i < N.nx && j < N.nz) lawnR[j * N.nx + i] = 1; };
  for (const [t, sides] of FX) for (const F of sides) for (let k = 0; k < t.n; k++) { const L = Math.max(F.lawn[k], F.run[k]); for (let o = t.hw; o <= L; o += 3) mark(...at(t, k, F.s, o)); }
  // ─── 依地形塊分組：每段（k → k+1）照 k 那一點所在的塊 ───
  const CH = new Map(), chKey = (x, z) => Math.floor((x - N.gx0) / S) + ',' + Math.floor((z - N.gz0) / S);
  for (const t of FX.keys()) for (let k = 0; k < t.n; k++) { if (t.nxt(k) < 0) continue; const ck = chKey(t.p[k][0], t.p[k][1]); let c = CH.get(ck); if (!c) CH.set(ck, c = { segs: [], m: null }); c.segs.push(t, k); }
  // ─── 材質：草皮與碎石是城裡草地那兩份 shader（同名同 GLSL），柏油緩衝區用 22-nbr.js 北環那份柏油 ───
  const lawnMat = new T.ShaderMaterial({ name: 'lawnBare', uniforms: { ...shared(ALLU), ...reflU }, vertexShader: GROUND_VS, fragmentShader: LAWN_FS.replace(/float path = max\([^;]*\);/, 'float path = 0.;'),
    side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const gravMat = new T.ShaderMaterial({ name: 'path', uniforms: { ...shared(ALLU), ...reflU }, vertexShader: GROUND_VS, fragmentShader: LAWN_FS.replace(/float path = max\([^;]*\);/, 'float path = 1.;'),
    side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  gfxLate.push(lawnMat, gravMat);
  // 防護網的網面：菱形網目（6 cm 的鍍鋅鐵絲）的透明貼圖，半透明混色（遠處 mipmap 平均成一層淡淡的灰），亮度照 uDay（同廣告看板）
  const netMat = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
    c.strokeStyle = '#d4d8da'; c.lineWidth = 5; c.beginPath(); c.moveTo(0, 32); c.lineTo(32, 0); c.lineTo(64, 32); c.lineTo(32, 64); c.closePath(); c.stroke();
    const tx = new T.CanvasTexture(cv); tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.anisotropy = 8; tx.colorSpace = T.SRGBColorSpace;
    return new T.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false, side: T.DoubleSide, toneMapped: false, color: 0x777777 });
  })(), netDay = () => netMat.color.setScalar(.04 + .5 * U.uDay.value * (1 - .2 * U.uWet.value));
  const C = { red: lin(0x7a2621), white: lin(0xb3b1a9), joint: lin(0x3a3936), galv: lin(0x767b7e), post: lin(0x575c60), block: lin(0x4a4f53), conc: lin(0xc9c7bd), cgrey: lin(0xa3a29b), wood: lin(0x6b5137), wire: lin(0x5d6264), band: lin(0x7c7b75), dirt: lin(0x5e5c57) };
  // 網格累積器：頂點色＋aMat（MAT.ux），四邊形照給的法線自動決定繞向
  class Mb {
    constructor() { this.p = []; this.n = []; this.c = []; this.m = []; this.i = []; }
    v(X, y, Z, nx, ny, nz, col, mat) { this.p.push(X, y, Z); this.n.push(nx, ny, nz); if (col) { this.c.push(col.r, col.g, col.b); this.m.push(mat); } return this.p.length / 3 - 1; }
    q(a, b, c, d, nx, ny, nz) {
      const P = this.p, ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
      if ((uy * vz - uz * vy) * nx + (uz * vx - ux * vz) * ny + (ux * vy - uy * vx) * nz >= 0) this.i.push(a, b, c, a, c, d); else this.i.push(a, c, b, a, d, c);
    }
    geo() {
      if (!this.i.length) return null;
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3));
      if (this.c.length) { g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3)); g.setAttribute('aMat', new T.Float32BufferAttribute(this.m, 1)); }
      g.setIndex(this.i); g.computeBoundingSphere(); return g;
    }
  }
  // 沿一段（k → k1）、離中心線 o 的一條細長面：prof 是 [離中心線, 離地高] 的剖面（地高照 yb：'t' 賽道高、'g' 地形高）
  function strip(mb, t, k, k1, s, oa, ob, prof, col, mat, base, profB = prof) {
    const row = (kk, o0, pr) => pr.map(([o, h]) => { const [x, z] = at(t, kk, s, o0 + o), y = (base === 't' ? t.p[kk][2] : nbrMeshL(...at(t, kk, s, o0))) + h, [X, Z] = W(x, z); return [X, y, Z]; });
    const A = row(k, oa, prof), B = row(k1, ob, profB), [lX, lZ] = WN(t.nx[k] * s, t.nz[k] * s);
    for (let j = 0; j + 1 < prof.length; j++) {   // 剖面這一段（橫向 dO、往上 dH）的法線是 (−dH, dO)：橫向的正向是離開賽道
      const dO = prof[j + 1][0] - prof[j][0], dH = prof[j + 1][1] - prof[j][1], L = Math.hypot(dO, dH) || 1, NX = lX * -dH / L, NY = dO / L, NZ = lZ * -dH / L;
      const a = mb.v(...A[j], NX, NY, NZ, col, mat), b = mb.v(...A[j + 1], NX, NY, NZ, col, mat), c = mb.v(...B[j + 1], NX, NY, NZ, col, mat), d = mb.v(...B[j], NX, NY, NZ, col, mat);
      mb.q(a, b, c, d, NX, NY, NZ);
    }
  }
  // 牆面（face −1 朝賽道、+1 朝外）；高度從 o − gd 那裡的地面量（牆的背面和正面同一個基準）
  function wall(mb, t, k, k1, s, oa, ob, h0, h1, col, mat, face, gd = 0) {
    const [ax, az] = at(t, k, s, oa), [bx, bz] = at(t, k1, s, ob), ya = nbrMeshL(...at(t, k, s, oa - gd)), yb = nbrMeshL(...at(t, k1, s, ob - gd)), [AX, AZ] = W(ax, az), [BX, BZ] = W(bx, bz), [nX, nZ] = WN(t.nx[k] * s * face, t.nz[k] * s * face);
    const a = mb.v(AX, ya + h0, AZ, nX, 0, nZ, col, mat), b = mb.v(AX, ya + h1, AZ, nX, 0, nZ, col, mat), c = mb.v(BX, yb + h1, BZ, nX, 0, nZ, col, mat), d = mb.v(BX, yb + h0, BZ, nX, 0, nZ, col, mat);
    mb.q(a, b, c, d, nX, 0, nZ);
  }
  function top(mb, t, k, k1, s, oa, ob, w, h, col, mat) {   // 牆頂：o .. o + w，高 h
    const P = (kk, o, g) => { const [x, z] = at(t, kk, s, o), [X, Z] = W(x, z); return [X, nbrMeshL(...at(t, kk, s, g)) + h, Z]; };
    const A0 = P(k, oa, oa), A1 = P(k, oa + w, oa), B1 = P(k1, ob + w, ob), B0 = P(k1, ob, ob);
    const a = mb.v(...A0, 0, 1, 0, col, mat), b = mb.v(...A1, 0, 1, 0, col, mat), c = mb.v(...B1, 0, 1, 0, col, mat), d = mb.v(...B0, 0, 1, 0, col, mat); mb.q(a, b, c, d, 0, 1, 0);
  }
  function rod(mb, A, B, w, col, mat) {   // 兩點之間的方管（寬 w），四個側面
    const dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2], L = Math.hypot(dx, dy, dz) || 1, ex = [dx / L, dy / L, dz / L];
    let ux2 = [-ex[2], 0, ex[0]]; const ul = Math.hypot(ux2[0], ux2[2]) || 1; ux2 = [ux2[0] / ul, 0, ux2[2] / ul];
    const vx2 = [ex[1] * ux2[2] - ex[2] * ux2[1], ex[2] * ux2[0] - ex[0] * ux2[2], ex[0] * ux2[1] - ex[1] * ux2[0]];
    const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [ux2[0] * a * w / 2 + vx2[0] * b * w / 2, ux2[1] * a * w / 2 + vx2[1] * b * w / 2, ux2[2] * a * w / 2 + vx2[2] * b * w / 2]);
    for (let j = 0; j < 4; j++) {
      const p = c[j], q = c[(j + 1) % 4], n = [p[0] + q[0], p[1] + q[1], p[2] + q[2]], nl = Math.hypot(...n) || 1, N2 = n.map(v => v / nl);
      const a = mb.v(A[0] + p[0], A[1] + p[1], A[2] + p[2], ...N2, col, mat), b = mb.v(B[0] + p[0], B[1] + p[1], B[2] + p[2], ...N2, col, mat), e = mb.v(B[0] + q[0], B[1] + q[1], B[2] + q[2], ...N2, col, mat), f = mb.v(A[0] + q[0], A[1] + q[1], A[2] + q[2], ...N2, col, mat);
      mb.q(a, b, e, f, ...N2);
    }
  }
  function post(mb, t, k, s, o, w, d, h, y0, col, mat) {   // 柱：寬 w（沿路）、厚 d（橫向）、高 h，四個側面＋頂
    const tx = t.nz[k], tz = -t.nx[k], [x, z] = at(t, k, s, o), y = y0 ?? nbrMeshL(x, z), nX = t.nx[k] * s, nZ = t.nz[k] * s, V = [];
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const [X, Z] = W(x + tx * a * w / 2 + nX * b * d / 2, z + tz * a * w / 2 + nZ * b * d / 2); V.push([X, Z]); }
    for (let j = 0; j < 4; j++) {
      const A = V[j], B = V[(j + 1) % 4], mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2, [cX, cZ] = W(x, z), l = Math.hypot(mx - cX, mz - cZ) || 1, fx = (mx - cX) / l, fz = (mz - cZ) / l;
      const a = mb.v(A[0], y - .3, A[1], fx, 0, fz, col, mat), b = mb.v(A[0], y + h, A[1], fx, 0, fz, col, mat), c = mb.v(B[0], y + h, B[1], fx, 0, fz, col, mat), e = mb.v(B[0], y - .3, B[1], fx, 0, fz, col, mat); mb.q(a, b, c, e, fx, 0, fz);
    }
    const q = V.map(([X, Z]) => mb.v(X, y + h, Z, 0, 1, 0, col, mat)); mb.q(q[0], q[1], q[2], q[3], 0, 1, 0);
  }
  // 路緣：每 1 m 換一次紅白（褪色的漆，混凝土的細斑與雨痕照 TX.conc），剖面 [離起點, 高]，內側 25 cm 斜上來、外緣垂到草裡；每塊之間 3 cm 深色的縫；照沿路距離切
  const KERB = w => [[0, .012], [.25, .065], [w - .25, .065], [w, -.08]];
  function kerb(mb, t, k, k1, s, w0, w1, o0) {
    const L = 1, ua = t.u[k], ub = k1 ? t.u[k1] : t.u[k] + Math.hypot(t.p[k1][0] - t.p[k][0], t.p[k1][1] - t.p[k][1]), seg = ub - ua;
    const P = (f, o, h) => { const x = t.p[k][0] + (t.p[k1][0] - t.p[k][0]) * f, z = t.p[k][1] + (t.p[k1][1] - t.p[k][1]) * f, nx = t.nx[k] + (t.nx[k1] - t.nx[k]) * f, nz = t.nz[k] + (t.nz[k1] - t.nz[k]) * f, l = Math.hypot(nx, nz) || 1, y = t.p[k][2] + (t.p[k1][2] - t.p[k][2]) * f, [X, Z] = W(x + nx / l * s * o, z + nz / l * s * o); return [X, y + h, Z]; };
    let f0 = 0;
    while (f0 < 1 - 1e-4) {
      const st = Math.floor((ua + f0 * seg) / L + 1e-4), f1 = Math.min(1, ((st + 1) * L - ua) / seg), col = (st % 2 ? C.white : C.red).clone().multiplyScalar(.72 + .28 * hsh(st, t.key.length * 7 + s)), wa = w0 + (w1 - w0) * f0, wb = w0 + (w1 - w0) * f1;
      const A = KERB(wa).map(([o, h]) => P(f0, o0 + o, h)), B = KERB(wb).map(([o, h]) => P(f1, o0 + o, h));
      const jt = Math.min(.03 / seg, (f1 - f0) * .5), B2 = KERB(wb).map(([o, h]) => P(f1 - jt, o0 + o, h));
      for (let j = 0; j < 3; j++) {
        for (const [X, Y, cc] of [[A, B2, col], [B2, B, C.joint]]) { const a = mb.v(...X[j], 0, 1, 0, cc, TX.conc), b = mb.v(...X[j + 1], 0, 1, 0, cc, TX.conc), c = mb.v(...Y[j + 1], 0, 1, 0, cc, TX.conc), d = mb.v(...Y[j], 0, 1, 0, cc, TX.conc); mb.q(a, b, c, d, 0, 1, 0); }
      }
      f0 = f1;
    }
  }
  // Karussell 的水泥槽：賽道內側 3.6 m 鋪水泥（蓋在柏油與白色邊線上面幾公分），內緣翹到 +0.25 m 的槽緣、槽緣外側垂到地面；兩端 5 點內收窄
  const BAND = [[-3.6, .045], [-2.4, .05], [-1.2, .05], [0, .055], [.8, .25]];
  const bandW = k => clamp(Math.min(k - (KAR.k0 - 3), KAR.k1 + 3 - k) / 5, .15, 1), bandP = w => BAND.map(([o, h]) => [.8 - (.8 - o) * w, h * w + .045 * (1 - w)]);
  // ─── 一塊的設施 ───
  function build(c) {
    const ux = new Mb(), lw = new Mb(), gv = new Mb(), asp = { P: [], N: [], UV: [], AX: [], I: [] }, net = { P: [], UV: [], I: [] };
    const netQ = (A, B, C2, D2, ua, ub, va, vb) => { const b = net.P.length / 3; net.P.push(...A, ...B, ...C2, ...D2); net.UV.push(ua, va, ub, va, ub, vb, ua, vb); net.I.push(b, b + 1, b + 2, b, b + 2, b + 3); };
    for (let q = 0; q < c.segs.length; q += 2) {
      const t = c.segs[q], k = c.segs[q + 1], k1 = t.nxt(k), sides = FX.get(t);
      for (const F of sides) {
        const s = F.s;
        // 草皮：路緣（或路面邊）到草皮外緣，橫向 8 格；GP 的柏油緩衝區與碎石在草皮下面那一層之上
        const l0 = t.hw - .3, la = F.lawn[k], lb = F.lawn[k1];
        if (la > l0 + .5 && lb > l0 + .5) {
          const M = 8, A = [], B = [];
          for (let j = 0; j <= M; j++) for (const [kk, L, R] of [[k, la, A], [k1, lb, B]]) { const o = l0 + (L - l0) * j / M, [x, z] = at(t, kk, s, o), [X, Z] = W(x, z); R.push(lw.v(X, nbrMeshL(x, z) + .06, Z, 0, 1, 0)); }
          for (let j = 0; j < M; j++) lw.q(A[j], A[j + 1], B[j + 1], B[j], 0, 1, 0);
        }
        if (F.run[k] && F.run[k1]) {   // 柏油緩衝區（GP 彎道外側）；急彎改碎石
          if (F.grav[k] && F.grav[k1]) for (let j = 0; j < 4; j++) { const f0 = j / 4, f1 = (j + 1) / 4, w = F.run[k] - t.hw - 3; strip(gv, t, k, k1, s, t.hw + 3, t.hw + 3, [[w * f0, .12], [w * f1, .12]], null, 0, 'g'); }
          const b = asp.P.length / 3;
          for (const kk of [k, k1]) {
            const o1 = F.grav[k] && F.grav[k1] ? t.hw + 3 : F.run[kk], [nX, nZ] = WN(t.nx[kk], t.nz[kk]);
            for (const o of [t.hw - .2, o1]) { const [x, z] = at(t, kk, s, o), [X, Z] = W(x, z); asp.P.push(X, Math.max(nbrMeshL(x, z) + .1, o < t.hw ? t.p[kk][2] - .02 : -1e9), Z); asp.N.push(0, 1, 0); asp.UV.push(s * o + 60, t.u[kk]); asp.AX.push(nX, nZ); }
          }
          asp.I.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
        }
        // 路緣
        if (F.kerb[k] && F.kerb[k1]) kerb(ux, t, k, k1, s, F.kerb[k], F.kerb[k1], t.hw - .28);
        // Karussell 的水泥槽與槽緣的路緣
        if (inKar(t, k, s) && inKar(t, k1, s)) {
          strip(ux, t, k, k1, s, t.hw, t.hw, bandP(bandW(k)), C.band, TX.conc, 't', bandP(bandW(k1)));
          strip(ux, t, k, k1, s, t.hw + .8, t.hw + .8, [[0, .25 * bandW(k)], [.02, -.6]], C.band, TX.conc, 't', [[0, .25 * bandW(k1)], [.02, -.6]]);
          { const w = bandW(k), pr = bandP(w), y0 = t.p[k][2], tx = t.nz[k] * .025, tz = -t.nx[k] * .025;   // 每 4 m 一道水泥板的縫（橫過槽面）、槽面上輪胎磨黑的一條
            for (let j = 0; j + 1 < pr.length; j++) { const [oa2, ha] = pr[j], [ob2, hb] = pr[j + 1], [ax, az] = at(t, k, s, t.hw + oa2), [bx, bz] = at(t, k, s, t.hw + ob2), V = [[ax - tx, az - tz, ha], [bx - tx, bz - tz, hb], [bx + tx, bz + tz, hb], [ax + tx, az + tz, ha]].map(([x, z, hh]) => { const [X, Z] = W(x, z); return [X, y0 + hh + .006, Z]; }); const q = V.map(v => ux.v(...v, 0, 1, 0, C.joint, TX.conc)); ux.q(q[0], q[1], q[2], q[3], 0, 1, 0); }
            strip(ux, t, k, k1, s, t.hw, t.hw, [[-2.3 * w, .051 * w + .045 * (1 - w) + .004], [-1.3 * w, .051 * w + .045 * (1 - w) + .004]], C.dirt, TX.conc, 't', [[-2.3 * bandW(k1), .051 * bandW(k1) + .045 * (1 - bandW(k1)) + .004], [-1.3 * bandW(k1), .051 * bandW(k1) + .045 * (1 - bandW(k1)) + .004]]); }
        }
        // 護欄與牆
        const ra = F.rail[k], rb = F.rail[k1];
        if (ra && rb) {
          const oa = F.ro[k], ob = F.ro[k1];
          if (ra === 1) {   // 雙層鍍鋅護欄（W 形斷面，朝賽道那面兩道凸起）；每點一根柱
            for (const h0 of [.4, .74]) {
              strip(ux, t, k, k1, s, oa, ob, [[0, h0], [-.045, h0 + .08], [-.015, h0 + .16], [-.045, h0 + .24], [0, h0 + .32]], C.galv, TX.sheet, 'g');
              wall(ux, t, k, k1, s, oa + .012, ob + .012, h0, h0 + .32, C.galv, TX.sheet, 1);
            }
            post(ux, t, k, s, oa + .2, .06, .12, .95, null, C.post, TX.galv);   // C 形鋼柱（離護欄 0.2 m）
            { const yg = nbrMeshL(...at(t, k, s, oa)); for (const h0 of [.56, .9]) { const [ax, az] = at(t, k, s, oa + .02), [bx, bz] = at(t, k, s, oa + .14), [AX, AZ] = W(ax, az), [BX, BZ] = W(bx, bz); rod(ux, [AX, yg + h0, AZ], [BX, yg + h0, BZ], .13, C.block, TX.galv); } }   // 墊塊
          } else if (ra === 2 || ra === 3 || ra === 4) {   // 水泥牆（北環：白、1.0 m；GP：護牆 1.1 m＋防護網；維修牆）
            const h = ra === 2 ? 1 : 1.1, d = ra === 2 ? .25 : .45, col = ra === 3 ? C.cgrey : C.conc;
            wall(ux, t, k, k1, s, oa, ob, -.4, h, col, TX.conc, -1); wall(ux, t, k, k1, s, oa + d, ob + d, -.4, h, col, TX.conc, 1, d); top(ux, t, k, k1, s, oa, ob, d, h, col, TX.conc);
            wall(ux, t, k, k1, s, oa - .006, ob - .006, -.05, .32, C.dirt, TX.conc, -1);   // 牆腳：輪胎與泥水的髒污
            { const tx = t.nz[k] * .02, tz = -t.nx[k] * .02, y = nbrMeshL(...at(t, k, s, oa)), [ax, az] = at(t, k, s, oa - .012), [AX, AZ] = W(ax - tx, az - tz), [BX, BZ] = W(ax + tx, az + tz), [nX, nZ] = WN(-t.nx[k] * s, -t.nz[k] * s);   // 每 4 m 一道預鑄牆板的縫
              const a = ux.v(AX, y - .05, AZ, nX, 0, nZ, C.joint, TX.conc), b = ux.v(AX, y + h, AZ, nX, 0, nZ, C.joint, TX.conc), c2 = ux.v(BX, y + h, BZ, nX, 0, nZ, C.joint, TX.conc), d2 = ux.v(BX, y - .05, BZ, nX, 0, nZ, C.joint, TX.conc); ux.q(a, b, c2, d2, nX, 0, nZ); }
            if (ra >= 3) {   // 防護網：每點一根圓柱（頂端 1 m 往賽道斜 30°）、鋼索、菱形網目的網面（透明貼圖，遠處淡成一層薄霧）
              const H = ra === 4 ? 2.6 : 3.8, lean = ra === 3, oc = oa + d / 2, ya = nbrMeshL(...at(t, k, s, oa)), yb = nbrMeshL(...at(t, k1, s, ob));
              post(ux, t, k, s, oc, .1, .1, h + H, null, C.post, TX.galv);
              if (lean) { const [px, pz] = at(t, k, s, oc), [qx, qz] = at(t, k, s, oc - .5), [PX, PZ] = W(px, pz), [QX, QZ] = W(qx, qz); rod(ux, [PX, ya + h + H - .05, PZ], [QX, ya + h + H + .87, QZ], .09, C.post, TX.galv); }
              for (const hh of ra === 4 ? [h + .9, h + 1.8, h + 2.55] : [h + .9, h + 1.9, h + 2.9, h + 3.75]) wall(ux, t, k, k1, s, oc - .06, ob + d / 2 - .06, hh, hh + .03, C.wire, TX.galv, -1);
              const P = (kk, o, y) => { const [x, z] = at(t, kk, s, o), [X, Z] = W(x, z); return [X, y, Z]; }, ua = t.u[k] / .12, ub = (t.u[k] + Math.hypot(t.p[k1][0] - t.p[k][0], t.p[k1][1] - t.p[k][1])) / .12;
              netQ(P(k, oc - .04, ya + h), P(k1, ob + d / 2 - .04, yb + h), P(k1, ob + d / 2 - .04, yb + h + H), P(k, oc - .04, ya + h + H), ua, ub, 0, H / .12);
              if (lean) netQ(P(k, oc - .04, ya + h + H), P(k1, ob + d / 2 - .04, yb + h + H), P(k1, ob + d / 2 - .54, yb + h + H + .87), P(k, oc - .54, ya + h + H + .87), ua, ub, H / .12, (H + 1) / .12);
            }
          }
          // 觀眾區的木欄：護欄後面 2 m，兩條橫木，每兩點一根柱
          if (F.fence[k] && F.fence[k1]) {
            for (const h0 of [.42, .86]) { wall(ux, t, k, k1, s, oa + 2, ob + 2, h0, h0 + .14, C.wood, TX.woodX, -1); wall(ux, t, k, k1, s, oa + 2.04, ob + 2.04, h0, h0 + .14, C.wood, TX.woodX, 1); }
            if (k % 2 === 0) post(ux, t, k, s, oa + 2.1, .12, .12, 1.1, null, C.wood, TX.woodY);
          }
        } else if (ra === 1 && !rb && F.rail[(k - 1 + t.n) % t.n]) post(ux, t, k, s, F.ro[k] + .2, .06, .12, .95, null, C.post, TX.galv);   // 斷開前最後一根柱
      }
    }
    const out = [];
    const g1 = ux.geo(); if (g1) { const m = new T.Mesh(g1, MAT.ux); m.name = 'nbrTrackFx'; cityAdd(m, null); out.push(m); }
    const g2 = lw.geo(); if (g2) { const m = new T.Mesh(g2, lawnMat); m.name = 'nbrLawn'; nbrGround(m); m.userData.lawn = 1; out.push(m); }
    const g3 = gv.geo(); if (g3) { const m = new T.Mesh(g3, gravMat); m.name = 'nbrGravel'; nbrGround(m); m.userData.lawn = 1; out.push(m); }
    if (asp.I.length) {
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(asp.P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(asp.N, 3));
      g.setAttribute('aUV', new T.Float32BufferAttribute(asp.UV, 2)); g.setAttribute('aAx', new T.Float32BufferAttribute(asp.AX, 2)); g.setIndex(asp.I); g.computeBoundingSphere();
      const m = new T.Mesh(g, NBR.asphalt || MAT.roadConn); m.name = 'nbrRunoff'; nbrGround(m); out.push(m);
    }
    if (net.I.length) {
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(net.P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(net.UV, 2)); g.setIndex(net.I); g.computeVertexNormals(); g.computeBoundingSphere();
      const m = new T.Mesh(g, netMat); m.name = 'nbrNet'; m.onBeforeRender = netDay; cityAdd(m, null); out.push(m);
    }
    return out;
  }
  // 草地覆蓋：近網格（22-nbr.js 的 chunkGeo，st = 1：前 129 × 129 個頂點是格點）的格子，照格子中心的土地利用（0 草地、2 農地；引道坡北段）抬 5 cm 鋪草
  function meadow(ch) {
    const P = ch.near.geometry.attributes.position.array, n = NBR_CH + 1, mb = new Mb(), ids = new Int32Array(n * n).fill(-1), A = nbrApron();
    const vid = (a, b) => { const q = b * n + a; if (ids[q] < 0) ids[q] = mb.v(P[q * 3], P[q * 3 + 1] + .05, P[q * 3 + 2], 0, 1, 0); return ids[q]; };
    for (let b = 0; b < n - 1; b++) for (let a = 0; a < n - 1; a++) {
      const x = ch.x0 + (a + .5) * NBR_G, z = ch.z0 + (b + .5) * NBR_G, k = z < NBR.core.z0 ? (z < A.z0 + 600 ? 0 : -1) : NBR.luAt(x, z);
      if (k !== 0 && k !== 2 || nbrPitIn(x, z, 6)) continue;   // 維修區大樓（24-nbr-pit.js）的車間地板上不鋪
      const i0 = vid(a, b), i1 = vid(a + 1, b), i2 = vid(a, b + 1), i3 = vid(a + 1, b + 1); mb.i.push(i0, i3, i1, i0, i2, i3);
    }
    const g = mb.geo(); if (!g) return null;
    const m = new T.Mesh(g, lawnMat); m.name = 'nbrMeadow'; nbrGround(m); return m;
  }
  const drop = ms => { for (const m of ms) { if (!m) continue; m.removeFromParent(); m.geometry.dispose(); const i = groundMeshes.indexOf(m); if (i >= 0) groundMeshes.splice(i, 1); } };
  let built = 0, buildMs = 0;
  NBR_TICK.push((x, z, chunks) => {
    let once = false;
    for (const ch of chunks) {
      const c = CH.get(Math.round(ch.i0 / NBR_CH) + ',' + Math.round(ch.j0 / NBR_CH)); if (!c) continue;
      const d = Math.hypot(Math.max(ch.x0 - x, x - ch.x0 - S, 0), Math.max(ch.z0 - z, z - ch.z0 - S, 0));
      if (!c.m && d < NBR_FX_IN && !once) { const t0 = performance.now(); c.m = build(c); buildMs = Math.max(buildMs, performance.now() - t0); once = true; built++; }
      else if (c.m && d > NBR_FX_OUT) { drop(c.m); c.m = null; }
      if (c.m) for (const m of c.m) if (m.userData.lawn) m.visible = !!ch.near;
    }
    for (const ch of chunks) {   // 近網格上 OSM 的草地與農地（地形的林地照片在鏡頭附近蓋掉頂點色，空地會是一片褐色的落葉土）
      if (ch.ovSrc !== undefined && ch.ovSrc !== ch.near) { drop([ch.ov]); ch.ov = null; ch.ovSrc = undefined; }
      if (ch.near && ch.ovSrc === undefined && !once) { ch.ov = meadow(ch); ch.ovSrc = ch.near; once = true; }
    }
  });
  // ─── 開場就建的：起終點線與發車格、門架、廣告看板（品牌名是虛構的；字畫在自己的圖集上，材質照 22-akina.js 的路牌，白天亮、夜裡暗）───
  const sk = new Kit(true), AD = ['EIFELWERK', 'RINGLINE OIL', 'NORDSPEED', 'GRÜNWALD REIFEN', 'HOCHEIFEL BRÄU', 'KARUSSELL RADIO'], AQ = [];
  const AC = [['#0f1a2c', '#f2f2ee'], ['#f0c419', '#141414'], ['#1d1d1f', '#e8392f'], ['#1f6b3a', '#f4f4ef'], ['#7d1d1b', '#f3e9d2'], ['#f4f4ef', '#1b3e8c']];
  const face = (X, y, Z, ux, uz, w, h, d, nx, nz) => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([a, b]) => [X + ux * a + nx * d, y + b, Z + uz * a + nz * d]);
  const across = (t, k, o0, o1, y, w, col, mat) => {   // 橫過路面的一條（o0..o1 橫向、沿路寬 w）
    const tx = t.nz[k], tz = -t.nx[k], P = [[o0, -w / 2], [o1, -w / 2], [o1, w / 2], [o0, w / 2]].map(([o, a]) => { const [X, Z] = W(t.p[k][0] + t.nx[k] * o + tx * a, t.p[k][1] + t.nz[k] * o + tz * a); return [X, y, Z]; });
    const b = new T.BufferGeometry(); b.setAttribute('position', new T.Float32BufferAttribute([...P[0], ...P[1], ...P[2], ...P[0], ...P[2], ...P[3]], 3)); b.setAttribute('normal', new T.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    const e = new T.Vector3(), f = new T.Vector3(); e.subVectors(new T.Vector3(...P[1]), new T.Vector3(...P[0])); f.subVectors(new T.Vector3(...P[2]), new T.Vector3(...P[0])); if (e.cross(f).y < 0) b.setAttribute('position', new T.Float32BufferAttribute([...P[0], ...P[2], ...P[1], ...P[0], ...P[3], ...P[2]], 3));
    sk.add(b, col, mat);
  };
  // 起終點：GP 是黑白格（兩排 0.5 m 方格）＋後面每 8 m 一格的發車格（左右錯開），北環（T13）一條白線
  const gp = TRK.gp, ns = TRK.ns;
  if (gp) {
    for (let r = 0; r < 2; r++) for (let o = -gp.hw, j = 0; o < gp.hw - .01; o += .5, j++) { const kk = 0; const tx = gp.nz[kk], tz = -gp.nx[kk]; const sh = (r - .5) * .5; const t2 = { ...gp, p: [[gp.p[0][0] + tx * sh, gp.p[0][1] + tz * sh, gp.p[0][2]]], nx: [gp.nx[0]], nz: [gp.nz[0]] }; across(t2, 0, o, o + .5, gp.p[0][2] + .045, .5, (j + r) % 2 ? 0x141414 : 0xe6e6e0, 2); }
    for (let s2 = 1; s2 <= 24; s2++) {
      const kk = ring(gp, -s2 * 2), sd = s2 % 2 ? -1 : 1, o0 = sd < 0 ? -gp.hw + 1 : 1, o1 = sd < 0 ? -1 : gp.hw - 1;
      across(gp, kk, o0, o1, gp.p[kk][2] + .04, .15, 0xdedfd8, 2);
    }
  }
  if (ns) across(ns, 0, -ns.hw, ns.hw, ns.p[0][2] + .04, .4, 0xdedfd8, 2);
  // 門架：兩根柱立在護欄外、橫樑過路面 6.5 m 高，兩面各一塊廣告布
  const gantry = (t, k, ad) => {
    const ro = t.hw + 4, ya = nbrMeshL(...at(t, k, -1, ro)), yb = nbrMeshL(...at(t, k, 1, ro)), y = Math.max(t.p[k][2] + 6.5, ya + 6.5, yb + 6.5), tx = t.nz[k], tz = -t.nx[k];
    // 兩座 1.2 m 見方的格構塔（四根角柱、每 1.5 m 一道橫撐與交叉斜撐），塔頂之間一榀箱形桁架（上下各兩條弦桿、斜腹桿），廣告布掛在桁架兩面
    const [X0, Z0] = W(t.p[k][0], t.p[k][1]), [UX, UZ] = WN(t.nx[k], t.nz[k]), [NX, NZ] = WN(tx, tz), ry = Math.atan2(UX, UZ), gc = 0x9a9d9f, w2 = .6;
    const P = (o, f, yy) => { const [x, z] = at(t, k, 1, o), [X, Z] = W(x + tx * f, z + tz * f); return [X, yy, Z]; };
    for (const s2 of [-1, 1]) {
      const yg = s2 < 0 ? ya : yb, o = s2 * ro, c4 = [[-w2, -w2], [w2, -w2], [w2, w2], [-w2, w2]];
      for (const [a, f] of c4) sk.bar(...P(o + a, f, yg - .3), ...P(o + a, f, y + 1.5), .12, .12, gc, TX.galv);
      for (let yy = yg + .2, j = 0; yy < y + 1.4; yy += 1.5, j++) for (let e = 0; e < 4; e++) { const [a0, f0] = c4[e], [a1, f1] = c4[(e + 1) % 4]; sk.bar(...P(o + a0, f0, yy), ...P(o + a1, f1, yy), .06, .06, gc, TX.galv); if (yy + 1.5 < y + 1.5) sk.bar(...P(o + (j % 2 ? a0 : a1), j % 2 ? f0 : f1, yy), ...P(o + (j % 2 ? a1 : a0), j % 2 ? f1 : f0, yy + 1.5), .05, .05, gc, TX.galv); }
      sk.box(...P(o, 0, yg - .15), 1.8, .3, 1.8, 0xa6a49c, TX.conc, 0, ry, 0);   // 基座
    }
    const yl = y - .2, yu = y + 1.4, n = Math.max(4, Math.round(ro * 2 / 1.5));
    for (const [yy, f] of [[yl, -w2], [yl, w2], [yu, -w2], [yu, w2]]) sk.bar(...P(-ro - w2, f, yy), ...P(ro + w2, f, yy), .1, .1, gc, TX.galv);
    for (let j = 0; j < n; j++) { const oa = -ro + 2 * ro * j / n, ob = -ro + 2 * ro * (j + 1) / n; for (const f of [-w2, w2]) sk.bar(...P(oa, f, j % 2 ? yl : yu), ...P(ob, f, j % 2 ? yu : yl), .06, .06, gc, TX.galv); sk.bar(...P(ob, -w2, yu), ...P(ob, w2, yu), .05, .05, gc, TX.galv); sk.bar(...P(ob, -w2, yl), ...P(ob, w2, yl), .05, .05, gc, TX.galv); }
    for (const f of [-1, 1]) AQ.push([ad, face(X0, y + .6, Z0, UX, UZ, ro * 2 - .5, 1.3, w2 + .08, NX * f, NZ * f), -f]);   // 正面（f = 1）時 U 是看的人的左手邊，字要左右翻
  };
  if (gp) gantry(gp, ring(gp, -6), 0);
  if (ns) { gantry(ns, 30, 1); if (KAR) gantry(ns, ring(ns, KAR.k0 - 60), 5); }
  // 看板：北環觀眾區（木欄那一側）、GP 彎道外側的牆後，每段至少隔 120 點；兩根柱、6 × 1.6 m 的板面朝來車
  let nAd = 0;
  for (const [t, sides] of FX) {
    if (t.key === 'pit') continue;
    let last = -1e9;
    for (let k = 10; k < t.n - 10; k++) for (const F of sides) {
      const ok = t.key === 'ns' ? F.fence[k] && F.fence[k + 4] && F.fence[k - 4] : F.rail[k] === 3 && F.ro[k] > t.hw + 15;
      if (!ok || k - last < (t.key === 'ns' ? 120 : 60)) continue;
      const o = F.ro[k] + (t.key === 'ns' ? 3.6 : 2.5), [x, z] = at(t, k, F.s, o), y = nbrMeshL(x, z), [X, Z] = W(x, z);
      const fx = t.p[ring(t, k - 6)][0] - t.p[k][0], fz = t.p[ring(t, k - 6)][1] - t.p[k][1], fl = Math.hypot(fx, fz) || 1, [NX, NZ] = WN(fx / fl, fz / fl), UX = NZ, UZ = -NX;   // 板面朝來車（往回 6 點的方向）；U 是看板面的人的右手邊
      for (const e of [-2.4, 2.4]) sk.box(X + UX * e, y + 1.6, Z + UZ * e, .14, 3.4, .14, 0x6f7377, TX.galv);
      sk.box(X - NX * .06, y + 2.5, Z - NZ * .06, .1, 1.8, 6.2, 0x2b2d30, 2, 0, Math.atan2(UX, UZ), 0);
      AQ.push([nAd++ % AD.length, face(X, y + 2.5, Z, UX, UZ, 6, 1.6, .03, NX, NZ), 1]);
      last = k;
    }
  }
  // GP 護牆朝賽道那面的廣告：每 10 點（40 m）一塊 5.6 × 0.7 m，貼在牆面上（牆在 23 的 build 才串流建，廣告開場就全部建好，兩者位置一樣）
  if (gp) for (const F of FX.get(gp) || []) for (let k = 3; k < gp.n - 3; k += 10) {
    if (F.rail[k] !== 3 || F.rail[k - 2] !== 3 || F.rail[k + 2] !== 3) continue;
    const [x, z] = at(gp, k, F.s, F.ro[k] - .03), y = nbrMeshL(...at(gp, k, F.s, F.ro[k])), [X, Z] = W(x, z), [NX, NZ] = WN(-gp.nx[k] * F.s, -gp.nz[k] * F.s);
    AQ.push([(k / 10 + (F.s > 0 ? 3 : 0)) % AD.length | 0, face(X, y + .58, Z, NZ, -NX, 5.6, .7, 0, NX, NZ), 1]); nAd++;
  }
  if (sk.pos.length) { const m = new T.Mesh(sk.build(), MAT.ux); m.name = 'nbrSigns'; cityAdd(m, null); }
  if (AQ.length) {   // 圖集：一格 512 × 128，六家一欄
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 1024; const cx = cv.getContext('2d');
    AD.forEach((n, i) => { const [bg, fg] = AC[i]; cx.fillStyle = bg; cx.fillRect(0, i * 128 + 2, 512, 124); cx.fillStyle = fg; cx.textAlign = 'center'; cx.textBaseline = 'middle'; let fs = 74; do { cx.font = `800 ${fs}px "Helvetica Neue",Arial,system-ui,sans-serif`; fs -= 2; } while (cx.measureText(n).width > 470 && fs > 20); cx.fillText(n, 256, i * 128 + 66); });
    const P = [], UV = [], I = [];   // rp：長的布條字重複幾次
    for (const [a, q, f] of AQ) { const b = P.length / 3, v0 = 1 - (a * 128 + 124) / 1024, v1 = 1 - (a * 128 + 4) / 1024, rp = Math.max(1, Math.round(Math.hypot(q[1][0] - q[0][0], q[1][2] - q[0][2]) / (q[3][1] - q[0][1]) / 3.6)), [u0, u1] = f > 0 ? [0, rp] : [rp, 0]; for (const p of q) P.push(...p); UV.push(u0, v0, u1, v0, u1, v1, u0, v1); I.push(b, b + 1, b + 2, b, b + 2, b + 3); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals(); g.computeBoundingSphere();
    const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 8; tx.wrapS = T.RepeatWrapping;
    const mat = new T.MeshBasicMaterial({ map: tx, toneMapped: false, side: T.DoubleSide, color: 0x6a6a6a }), m = new T.Mesh(g, mat); m.name = 'nbrAds';
    m.onBeforeRender = () => mat.color.setScalar(.03 + .4 * U.uDay.value * (1 - .25 * U.uWet.value));
    cityAdd(m, null);
  }
  // 測試用：__nc.nbr.fx()
  NBR.fx = () => {
    const st = { colliders: nCol, chunks: CH.size, ads: AQ.length, built, buildMs: Math.round(buildMs), kar: KAR, live: 0, verts: 0 };
    for (const c of CH.values()) if (c.m) { st.live++; for (const m of c.m) st.verts += m.geometry.attributes.position.count; }
    for (const [t, sides] of FX) st[t.key] = sides.map(F => ({ rail: F.rail.reduce((a, v) => a + (v ? 1 : 0), 0), kerb: F.kerb.reduce((a, v) => a + (v ? 1 : 0), 0), fence: F.fence.reduce((a, v) => a + v, 0), wall: F.rail.reduce((a, v) => a + (v === 2 ? 1 : 0), 0) }));
    return st;
  };
}
