// ═══ 峰頂觀景環（電影場景）：暮色裡的雪山群峰、流動的體積雲海、最高峰上的環形觀景建築，45 秒循環的自動運鏡與 Web Audio 配樂 ═══
// 獨立的場景與相機（不放進城市的 scene、不動玩家與世界），畫法走同一套 rtScene → 泛光 → 合成（70-render.js 的 mPre／mDown／mUp／mComp），
// 合成時把受傷、特殊能力、熱成像、眼睛適應、環境光遮蔽這些城市的效果都歸零。
// 材質是這裡手寫的 TSL NodeMaterial（不是 ShaderMaterial，不經 gfxAuto），霧也是自己的：山景遠到 26 km，不能用城市的 applyFog／uFogDen。
// 變動的 uniform 一律放 renderGroup（每次 render 都更新；物件自己的 group 在物件沒變時不會重寫）。
// 不用外部模型或貼圖：地形是 JS 算的高度場（極座標網格，半徑照 sinh 拉開：165 m 內每圈最多 0.8 m、26 km 外約 220 m 一格），
// 雲、天空的雜訊與雲裡判斷山體的高度圖都是進場時算好的 DataTexture。
// 雲海：一片跟著相機的水平圓盤（雲頂上限 SM_CT），片段著色器沿視線往下步進到雲底（SM_CB），雲頂高度＝三層可循環雜訊（大團、中團、細節）往不同方向漂；
// 每一步看朝晚霞那一側的坡度（雲團朝西的一面染暖色）、在雲裡的深度（越深越暗、越藍）、建築的暖光，碰到山體（高度圖）就停。
// 進入：Esc 選單「遊戲 → 暫停 → 峰頂觀景環」、開始畫面的按鈕、網址 ?summit=1。Esc／返回鍵離開，C 切換寬銀幕黑邊，M 靜音。
// 測試：__nc.summit.open()、seek(秒)（固定在那一刻）、play()、close()、st()。
const SUMMIT = { on: false, built: false, busy: false, t: 0, freeze: false, from: null, wide: true, last: 0, hintT: 0, frames: 0 };
const SM_LOOP = 45, SM_CT = 48, SM_CB = -95;   // 運鏡一圈的秒數；雲頂上限與雲底（公尺）
{
  // ─── 地形 ───
  const r0 = rng(260045), perm = new Uint8Array(512), GX = new Float32Array(256), GZ = new Float32Array(256);
  { const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = r0() * (i + 1) | 0; [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) perm[i] = p[i & 255]; }
  for (let i = 0; i < 256; i++) { const a = r0() * Math.PI * 2; GX[i] = Math.cos(a); GZ[i] = Math.sin(a); }
  // 2D Perlin（約 −0.7..0.7）
  function n2(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, X = xi & 255, Z = zi & 255;
    const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), w = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
    const g = (ix, iz, dx, dz) => { const h = perm[perm[ix] + iz]; return GX[h] * dx + GZ[h] * dz; };
    const a = g(X, Z, fx, fz), b = g(X + 1, Z, fx - 1, fz), c = g(X, Z + 1, fx, fz - 1), d = g(X + 1, Z + 1, fx - 1, fz - 1);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  }
  // 稜線型多重分形：sp 是這一點的網格間距，波長短於 2.5 格的八度淡出（遠處不會長出比網格還細的尖刺）
  function ridged(x, z, oct, sp, wl) {
    let s = 0, a = 1, f = 1 / wl, nrm = 0, prev = 1;
    for (let o = 0; o < oct; o++) {
      nrm += a;
      const k = clamp(1 / f / (sp * 2.5) - 1, 0, 1);
      if (k > 0) { let n = 1 - Math.abs(n2(x * f + o * 17.3, z * f - o * 9.1) * 1.45); n *= n; s += n * a * prev * k; prev = clamp(n * 1.25, 0, 1); }
      a *= .5; f *= 2.03;
    }
    return s / nrm;
  }
  const smax = (a, b, k) => { const h = clamp(.5 + .5 * (b - a) / k, 0, 1); return lerp(a, b, h) + k * h * (1 - h); };
  // 山峰：x、z、峰頂高、半徑（高度降到 1/e 的距離）、尖度
  // 山峰：x、z、峰頂高、半徑、輪廓指數（大＝側壁陡、頂寬，像岩塔）
  const PEAKS = [
    [-84, 8, 218, 64, 1.9],        // 左邊的岩塔：玻璃迴廊從環的西側鑽進去
    [122, -20, 242, 190, 1.5],     // 右邊的主峰山體：東側迴廊接到肩上的車站
    [470, 110, 660, 340, 1.15],    // 右前方的大雪山
    [-330, -420, 360, 170, 1.4],
    [-620, -480, 580, 340, 1.15],
    [-420, 440, 320, 230, 1.25],
    [340, -540, 520, 300, 1.15],
    [60, -1100, 560, 420, 1.05],
    [-1150, 120, 470, 420, 1.05],
  ];
  { const r = rng(9124); for (let i = 0; i < 16; i++) { const a = r() * Math.PI * 2, d = 1000 + r() * 3200; PEAKS.push([Math.cos(a) * d, Math.sin(a) * d, 160 + r() * 520, 180 + r() * 380, 1 + r() * .4]); } }
  // 每座山 3–5 個面（面的法線方向）：取最大的投影當距離，面與面之間就是筆直的稜線
  const FACES = PEAKS.map((P, i) => { const r = rng(400 + i), n = 3 + (r() * 3 | 0), a0 = r() * 6.3; return Array.from({ length: n }, (_, k) => { const a = a0 + k / n * 6.283 + (r() - .5) * .9; return [Math.cos(a), Math.sin(a)]; }); });
  function Hb(x, z, sp = 1) {
    const d = Math.hypot(x, z);
    let h = -300;
    const far = sstep(800, 4600, d);   // 3 km 外的群山
    if (far > 0) h += far * (110 + 1450 * ridged(x + 9000 + 300 * n2(x / 2600, z / 2600), z - 3000 + 300 * n2(z / 2600 + 4, x / 2600), 8, sp, 3400) ** 1.6);
    for (let i = 0; i < PEAKS.length; i++) {
      const [px, pz, ph, pr, pp] = PEAKS[i];
      let dx = x - px, dz = z - pz;
      if (dx * dx + dz * dz > pr * pr * 10) continue;
      // 輪廓扭曲：山不是正圓錐
      const w = pr * .26; dx += w * n2(x / (pr * .7) + px * .01, z / (pr * .7)); dz += w * n2(x / (pr * .7), z / (pr * .7) - pz * .01);
      let fq = -1e9; for (const [fx, fz] of FACES[i]) fq = Math.max(fq, dx * fx + dz * fz);
      const q = lerp(Math.hypot(dx, dz), Math.max(fq, 0) * 1.25, .62) / pr;
      const f = Math.exp(-Math.pow(q, pp));
      h = smax(h, -300 + (ph + 300) * f * (.8 + .26 * ridged(x * 1.2 + px, z * 1.2 + pz, 7, sp, pr * .5)), 24);
    }
    // 岩脊與溝：越高越崎嶇
    const up = clamp((h + 300) / 700, 0, 1.4);
    h += up * (30 * (ridged(x, z, 7, sp, 170) - .45) + 9 * (ridged(z + 77, x - 31, 6, sp, 42) - .42));
    // 迴廊與車站走得進去：沿迴廊與車站把岩體壓到樓板下，往外是緩緩升起的雪坡（10 m 外 +3.7、20 m +9、40 m +29），窗外不會貼著一面岩壁；西邊迴廊在 XF 撞進岩塔（3 m 內立起來的岩面）
    const out = (v, a, b) => Math.max(a - v, v - b, 0), cap = d => FL - 2 + .25 * d + .012 * d * d;
    const dE = Math.hypot(out(z, -2.6, 2.6), out(x, RO - 3, ST.x - ST.hx)), dS = Math.hypot(out(x, ST.x - ST.hx - 1, ST.x + ST.hx + 1), out(z, ST.z - ST.hz - 1, ST.z + ST.hz + 1));
    const dW = Math.hypot(out(z, -2.6, 2.6), out(x, XF, -RO + 3));
    const c = Math.min(cap(dE), cap(dS), cap(dW) + 90 * sstep(0, 3, XF - x));
    if (c < h + 6) h = -smax(-h, -c, 3);
    // 纜車線：從車站往 CBL.dir 下到雲海，車站外那道岩緣切出一個缺口（纜索下 CBL.clr 公尺內沒有山）
    const ca = (x - CBL.x) * CBL.dx + (z - CBL.z) * CBL.dz, cl = Math.abs((x - CBL.x) * CBL.dz - (z - CBL.z) * CBL.dx);
    if (ca > -4 && ca < 130 && cl < 16) h = lerp(Math.min(h, cblY(ca) - CBL.clr), h, Math.max(sstep(7, 16, cl), sstep(100, 130, ca), 1 - sstep(-4, 3, ca)));
    return h;
  }
  // 東稜步道把山切出一條路（TR 在常數之後才建好，之前 H 就是 Hb）
  let TR = null;
  function H(x, z, sp = 1) { const h = Hb(x, z, sp); return TR ? trailCut(h, x, z) : h; }
  SUMMIT.H = H;

  // ─── 雜訊貼圖（可循環）：r 大雲團、g 中雲團、b 一般 fbm、a 細雲團 ───
  function tileTex(N, seed) {
    const r = rng(seed), lat = {};
    const vn = P => { if (lat[P]) return lat[P]; const g = new Float32Array(P * P); for (let i = 0; i < g.length; i++) g[i] = r(); return lat[P] = g; };
    const val = (u, v, P) => { const g = vn(P), x = u * P, y = v * P, xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), m = k => ((k % P) + P) % P;
      const a = g[m(yi) * P + m(xi)], b = g[m(yi) * P + m(xi + 1)], c = g[m(yi + 1) * P + m(xi)], d = g[m(yi + 1) * P + m(xi + 1)]; return lerp(lerp(a, b, sx), lerp(c, d, sx), sy); };
    const fbm = (u, v, P, oct) => { let s = 0, a = .5, t = 0; for (let o = 0; o < oct; o++) { s += a * val(u, v, P); t += a; a *= .5; P *= 2; } return s / t; };
    const wor = cells => { const pts = new Float32Array(cells * cells * 2); for (let i = 0; i < pts.length; i++) pts[i] = r();
      return (u, v) => { const x = u * cells, y = v * cells, xi = Math.floor(x), yi = Math.floor(y); let best = 9;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const cx = xi + dx, cy = yi + dy, k = (((cy % cells) + cells) % cells) * cells + (((cx % cells) + cells) % cells);
          const ex = cx + pts[k * 2] - x, ey = cy + pts[k * 2 + 1] - y, dd = ex * ex + ey * ey; if (dd < best) best = dd; }
        return Math.sqrt(best); }; };
    const w1 = wor(7), w2 = wor(17), w3 = wor(29), out = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N, o = (y * N + x) * 4;
      const puff = (w, k) => { const d = clamp(1 - w(u, v) * k, 0, 1); return Math.sqrt(d); };
      out[o] = clamp(puff(w1, 1.05) * .72 + fbm(u, v, 8, 4) * .38 - .04, 0, 1) * 255;
      out[o + 1] = clamp(puff(w2, 1.1) * .7 + fbm(u, v, 16, 3) * .36 - .03, 0, 1) * 255;
      out[o + 2] = fbm(u, v, 4, 6) * 255;
      out[o + 3] = clamp(puff(w3, 1.2) * .65 + fbm(u, v, 32, 3) * .4, 0, 1) * 255;
    }
    const t = new T.DataTexture(out, N, N, T.RGBAFormat, T.UnsignedByteType);
    t.wrapS = t.wrapT = T.RepeatWrapping; t.magFilter = T.LinearFilter; t.minFilter = T.LinearMipmapLinearFilter; t.generateMipmaps = true; t.colorSpace = T.NoColorSpace; t.needsUpdate = true;
    return t;
  }
  // 雲裡判斷山體用的高度圖：±2560 m、512²，r = (h + 300) / 600
  const HM_R = 2560, HM_N = 512;
  function heightTex() {
    const out = new Uint8Array(HM_N * HM_N * 4);
    for (let y = 0; y < HM_N; y++) for (let x = 0; x < HM_N; x++) {
      const wx = ((x + .5) / HM_N * 2 - 1) * HM_R, wz = ((y + .5) / HM_N * 2 - 1) * HM_R, o = (y * HM_N + x) * 4;
      out[o] = clamp((H(wx, wz, 10) + 300) / 600, 0, 1) * 255; out[o + 3] = 255;
    }
    const t = new T.DataTexture(out, HM_N, HM_N, T.RGBAFormat, T.UnsignedByteType);
    t.magFilter = t.minFilter = T.LinearFilter; t.generateMipmaps = false; t.colorSpace = T.NoColorSpace; t.needsUpdate = true;
    return t;
  }

  // ─── 幾何：極座標地形 ───
  const yieldUI = () => new Promise(r => setTimeout(r, 0));
  async function terrainGeo(prog) {
    const lo = isTouch || !GT().ao;
    const N0 = lo ? 260 : 400, NA = lo ? 640 : 1024, RMAX = 26000, B = 7.6, A = RMAX / Math.sinh(B);
    // 圈的半徑：照 sinh 拉開，但 165 m 內（山頂站、東稜步道）每圈最多 0.8 m（低畫質 1.1 m），步道的切坡才不會被粗網格吃掉
    const S0 = lo ? 1.1 : .8, R0 = 165, RL = [0];
    for (let r = 0; r < R0;) { r += Math.min(S0, B / N0 * Math.hypot(A, r)); RL.push(r); }
    for (let i = Math.ceil(Math.asinh(R0 / A) / B * N0); i <= N0; i++) { const r = A * Math.sinh(B * i / N0); if (r > RL[RL.length - 1] + S0 * .5) RL.push(r); }
    const NR = RL.length - 1;
    const nV = (NR + 1) * NA, pos = new Float32Array(nV * 3), Hs = new Float32Array(nV), R_ = new Float32Array(NR + 1), SP = new Float32Array(NR + 1);
    const cs = new Float32Array(NA), sn = new Float32Array(NA);
    for (let j = 0; j < NA; j++) { const a = j / NA * Math.PI * 2; cs[j] = Math.cos(a); sn[j] = Math.sin(a); }
    let tY = performance.now();
    for (let i = 0; i <= NR; i++) {
      const r = R_[i] = RL[i], dr = (RL[Math.min(NR, i + 1)] - RL[Math.max(0, i - 1)]) / (i > 0 && i < NR ? 2 : 1), arc = r * Math.PI * 2 / NA;
      const sp = SP[i] = Math.max(dr, arc, .4);
      for (let j = 0; j < NA; j++) { const k = i * NA + j, x = r * cs[j], z = r * sn[j], h = H(x, z, sp); pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z; Hs[k] = h; }
      if (performance.now() - tY > 40) { prog(i / NR * .7); await yieldUI(); tY = performance.now(); }
    }
    // 法線、雪與凹處：照網格的鄰點算（半徑方向與切線方向的一階、二階差分）
    const nor = new Float32Array(nV * 3), sm = new Float32Array(nV * 2);
    for (let i = 0; i <= NR; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(NR, i + 1), drr = Math.max(R_[i1] - R_[i0], 1e-3), arc = Math.max(R_[i] * Math.PI * 2 / NA, 1e-3);
      for (let j = 0; j < NA; j++) {
        const k = i * NA + j, jm = (j + NA - 1) % NA, jp = (j + 1) % NA, h = Hs[k];
        const gr = (Hs[i1 * NA + j] - Hs[i0 * NA + j]) / drr, gt = (Hs[i * NA + jp] - Hs[i * NA + jm]) / (2 * arc);
        const gx = gr * cs[j] - gt * sn[j], gz = gr * sn[j] + gt * cs[j], l = Math.hypot(gx, 1, gz), ny = 1 / l;
        nor[k * 3] = -gx / l; nor[k * 3 + 1] = ny; nor[k * 3 + 2] = -gz / l;
        // 凹處（正）與稜線（負）：兩個方向的二階差分 × 間距，無因次
        const lr = i > 0 && i < NR ? (Hs[i1 * NA + j] + Hs[i0 * NA + j] - 2 * h) / Math.max(SP[i], 1) : 0;
        const lt = (Hs[i * NA + jp] + Hs[i * NA + jm] - 2 * h) / Math.max(arc, .5);
        const cav = clamp((lr + lt) * .35, -1, 1);
        const x = pos[k * 3], z = pos[k * 3 + 2], nz = n2(x / 26, z / 26) * .5 + n2(x / 7.5, z / 7.5) * .35;
        const snow = (ny - .52) * 4 + nz * .45 + cav * 1.2 + clamp((h - 250) / 1400, 0, .35);
        sm[k * 2] = clamp(snow * .5 + .5, 0, 1); sm[k * 2 + 1] = clamp(1 - Math.max(cav, 0) * .55 - Math.max(.75 - ny, 0) * .35, .35, 1);
      }
      if (performance.now() - tY > 40) { prog(.7 + i / NR * .2); await yieldUI(); tY = performance.now(); }
    }
    const idx = new Uint32Array(NR * NA * 6);
    let q = 0;
    for (let i = 0; i < NR; i++) for (let j = 0; j < NA; j++) {
      const jp = (j + 1) % NA, a = i * NA + j, b = (i + 1) * NA + j, c = i * NA + jp, d = (i + 1) * NA + jp;
      idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = c; idx[q++] = d; idx[q++] = b;   // 從上面看是逆時針（法線朝上）
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setAttribute('aSm', new T.BufferAttribute(sm, 2));
    g.setIndex(new T.BufferAttribute(idx, 1));
    g.boundingSphere = new T.Sphere(V3(0, 0, 0), RMAX * 1.05);
    return g;
  }

  // ─── 幾何：通用的網格建構（三角形依頂點法線自動決定繞向） ───
  class Geo {
    constructor() { this.p = []; this.n = []; this.u = []; this.i = []; }
    v(x, y, z, nx, ny, nz, u = 0, w = 0) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.u.push(u, w); return this.p.length / 3 - 1; }
    tri(a, b, c) {
      const P = this.p, N = this.n;
      const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
      const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      const nx = N[a * 3] + N[b * 3] + N[c * 3], ny = N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1], nz = N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2];
      if (cx * nx + cy * ny + cz * nz < 0) this.i.push(a, c, b); else this.i.push(a, b, c);
    }
    quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); }
    // 平面四邊形（四個角依序），法線由前三點算，flip 反過來；uv 依序 (0,0)(1,0)(1,1)(0,1) 乘上 us、vs
    face(P, flip = false, us = 1, vs = 1) {
      const [a, b, c] = P, ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) * (flip ? -1 : 1); nx /= l; ny /= l; nz /= l;
      const UV = [[0, 0], [us, 0], [us, vs], [0, vs]], k = P.map((p, i) => this.v(p[0], p[1], p[2], nx, ny, nz, UV[i][0], UV[i][1]));
      this.quad(k[0], k[1], k[2], k[3]);
    }
    // 軸對齊（再繞 y 轉 ry）的方塊：中心、半寬
    box(cx, cy, cz, hx, hy, hz, ry = 0, us = 1) {
      const c = Math.cos(ry), s = Math.sin(ry), P = (x, y, z) => [cx + x * c + z * s, cy + y, cz - x * s + z * c];
      const C = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(([x, y, z]) => P(x * hx, y * hy, z * hz));
      const F = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]];
      const ctr = [cx, cy, cz];
      for (const f of F) {
        const q = f.map(i => C[i]), m = [0, 1, 2].map(k => (q[0][k] + q[2][k]) / 2), o = [0, 1, 2].map(k => m[k] - ctr[k]);
        const [a, b, cc] = q, ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = cc[0] - a[0], vy = cc[1] - a[1], vz = cc[2] - a[2];
        const flip = (uy * vz - uz * vy) * o[0] + (uz * vx - ux * vz) * o[1] + (ux * vy - uy * vx) * o[2] < 0;
        this.face(q, flip, us, 1);
      }
    }
    // 圓管（兩端點、半徑）
    tube(a, b, r, seg = 10) {
      const A = V3(...a), Bv = V3(...b), ax = Bv.clone().sub(A).normalize(), t1 = Math.abs(ax.y) < .9 ? V3(0, 1, 0).cross(ax).normalize() : V3(1, 0, 0).cross(ax).normalize(), t2 = ax.clone().cross(t1);
      const base = this.p.length / 3;
      for (let i = 0; i <= seg; i++) { const q = i / seg * Math.PI * 2, n = t1.clone().multiplyScalar(Math.cos(q)).addScaledVector(t2, Math.sin(q));
        for (const P of [A, Bv]) this.v(P.x + n.x * r, P.y + n.y * r, P.z + n.z * r, n.x, n.y, n.z, i / seg, P === A ? 0 : 1); }
      for (let i = 0; i < seg; i++) { const k = base + i * 2; this.quad(k, k + 2, k + 3, k + 1); }
    }
    // 迴轉體：剖面 [[r, y], …]（開放折線），th0..th1 的弧，us 是 u 方向一圈的格數；每段剖面各自的法線（稜角分明），v 依剖面長度 0..1
    lathe(prof, seg, th0 = 0, th1 = Math.PI * 2, us = 1, cy = 0, cx = 0, cz = 0) {
      let L = 0; for (let k = 0; k + 1 < prof.length; k++) L += Math.hypot(prof[k + 1][0] - prof[k][0], prof[k + 1][1] - prof[k][1]);
      let acc = 0;
      for (let k = 0; k + 1 < prof.length; k++) {
        const [ra, ya] = prof[k], [rb, yb] = prof[k + 1], dr = rb - ra, dy = yb - ya, len = Math.hypot(dr, dy), nr = -dy / len, ny = dr / len, base = this.p.length / 3;
        for (let j = 0; j <= seg; j++) {
          const q = th0 + (th1 - th0) * j / seg, c = Math.cos(q), s = Math.sin(q);
          this.v(cx + ra * c, cy + ya, cz + ra * s, nr * c, ny, nr * s, j / seg * us, acc / L);
          this.v(cx + rb * c, cy + yb, cz + rb * s, nr * c, ny, nr * s, j / seg * us, (acc + len) / L);
        }
        for (let j = 0; j < seg; j++) { const a = base + j * 2; this.quad(a, a + 2, a + 3, a + 1); }
        acc += len;
      }
    }
    // 直立的稜柱（平面多邊形 pts，凸的），y0..y1，上下各往內縮 i0、i1（做出斜邊）；cap 為真時封頂（扇形）。每面各自的法線
    prism(pts, y0, y1, i0 = 0, i1 = 0, cap = 0, us = 1) {
      const n = pts.length, cx = pts.reduce((a, p) => a + p[0], 0) / n, cz = pts.reduce((a, p) => a + p[1], 0) / n;
      const ins = (p, k) => { const dx = p[0] - cx, dz = p[1] - cz, l = Math.hypot(dx, dz) || 1; return [p[0] - dx / l * k, p[1] - dz / l * k]; };
      for (let k = 0; k < n; k++) {
        const a = pts[k], b = pts[(k + 1) % n], a0 = ins(a, i0), b0 = ins(b, i0), a1 = ins(a, i1), b1 = ins(b, i1);
        const ex = b0[0] - a0[0], ez = b0[1] - a0[1], mx = (a[0] + b[0]) / 2 - cx, mz = (a[1] + b[1]) / 2 - cz;
        this.face([[a0[0], y0, a0[1]], [b0[0], y0, b0[1]], [b1[0], y1, b1[1]], [a1[0], y1, a1[1]]], (-ez * mx + ex * mz) * (y1 - y0) < 0, us * Math.hypot(b[0] - a[0], b[1] - a[1]), 1);
      }
      if (cap) { const y = cap > 0 ? y1 : y0, ii = cap > 0 ? i1 : i0, c = this.v(cx, y, cz, 0, Math.sign(cap), 0, .5, .5);
        const ring = pts.map(p => { const q = ins(p, ii); return this.v(q[0], y, q[1], 0, Math.sign(cap), 0, 0, 0); });
        for (let k = 0; k < n; k++) this.tri(c, ring[k], ring[(k + 1) % n]); }
    }
    build() {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(this.u, 2));
      g.setIndex(this.p.length / 3 > 65535 ? new T.Uint32BufferAttribute(this.i, 1) : new T.Uint16BufferAttribute(this.i, 1));
      g.computeBoundingSphere();
      return g;
    }
  }

  // ─── 建築的尺寸（環心 C、外半徑 RO、內半徑 RI；樓板頂 FL、屋頂 RF） ───
  const C = [0, 150, 0], RO = 40, RI = 27, FL = 145.6, RF = 155.4, SOF = 143.9;
  const DECK = { th: -Math.PI / 2, half: .4, r1: 58, top: FL, bot: 144.1 };   // 朝晚霞（−z）的懸挑平台
  const BALC = { th: Math.PI / 2 + .35, half: .2, r1: 49, top: 142.4, bot: 141.2 };   // 朝 +z 的小陽台（低一階）
  // 建築的暖光（地形、雲、平台都照）：位置、顏色、強度、近距離的軟化
  const LIGHTS = [
    [0, 141, 0, 1, .6, .3, 900, 900], [0, 143, -50, 1, .62, .3, 380, 140], [24, 141, 42, 1, .62, .32, 140, 80],
    [-56, 147, 0, 1, .64, .34, 160, 60], [54, 147, 0, 1, .64, .34, 160, 60], [78, 150, 2, 1, .6, .3, 520, 200], [91.6, 148.4, 0, 1, .62, .32, 45, 18], [-66, 148, 0, 1, .6, .28, 150, 40],
  ];
  // 車站（主峰的肩上，東邊迴廊的盡頭）：中心 (ST.x, ST.z)、半寬 hx／hz、樓板就是 FL
  const ST = { x: 78.4, z: 2, hx: 10.4, hz: 8.4, h: 7 };
  const XF = -75.5;   // 西邊迴廊撞進岩塔的位置（山洞口的光）
  // 纜車線：迴轉輪的中心 (x, y, z)，往 dir（水平方向）每公尺降 sl，兩條索左右各 off，到 len 公尺（雲海裡）為止；車廂掛在索下 hang 公尺
  const CBL = { x: ST.x - 1.2, y: FL + 5.4, z: ST.z + 2.6, dir: 118 * Math.PI / 180, sl: .2, sag: 9, len: 720, off: 2.4, hang: 2.75, clr: 10 };
  CBL.dx = Math.cos(CBL.dir); CBL.dz = Math.sin(CBL.dir);
  function cblY(d) { const u = clamp(d / CBL.len, 0, 1); return CBL.y - CBL.sl * Math.max(d, 0) - CBL.sag * 4 * u * (1 - u); }
  // 索上 d 公尺、side（+1 上行、−1 下行）那條的位置
  const cblAt = (d, side, o = V3()) => o.set(CBL.x + CBL.dx * d - CBL.dz * CBL.off * side, cblY(d), CBL.z + CBL.dz * d + CBL.dx * CBL.off * side);
  // ─── 東稜步道：山頂站東門外的鋼梯下到雪地（2 m），之字形爬上東稜的觀景台（約 40 m 高） ───
  // 路線是手排的轉折點（腿與腿相隔 14 m 以上，切坡填坡才不會互相吃掉）；路面高度照沒切過的山（Hb）取平均，再限制坡度 ≤ 0.5（陡的段落鋪木階）。
  // 每段路各自給「上限（往上 1:1.7 的切坡）」與「下限（往下 1:1.4 的填坡）」，路寬 2×TR_HW 內兩者都是路面；終點是半徑 TR_PAD 的平台
  const TR_W = [[93.6, 0], [97.5, -6], [104, -30], [114, -8], [122, -32], [130, -9], [138, -30]];
  const TR_HW = 2, TR_PAD = 6.5, TR_UP = 2.3, TR_DN = 1.4;   // 切坡陡（66°，著色時是岩壁），填坡緩一點（54°，積雪）
  const STAIR = { x0: ST.x + ST.hx + .4, x1: 93.4, z: 0, hw: .95, door: 1.4 };   // 東門（玻璃開口 ±door）外的鋼梯：x0 平台邊到 x1 落地，降 2 m
  TR = (() => {
    const X = [], Z = [], S = [];
    let s = 0;
    for (let i = 0; i + 1 < TR_W.length; i++) {
      const [ax, az] = TR_W[i], [bx, bz] = TR_W[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L);
      for (let k = 0; k < n; k++) { X.push(ax + (bx - ax) * k / n); Z.push(az + (bz - az) * k / n); S.push(s + L * k / n); }
      s += L;
    }
    X.push(TR_W[TR_W.length - 1][0]); Z.push(TR_W[TR_W.length - 1][1]); S.push(s);
    const n = X.length, Hs = (x, z) => (Hb(x, z) + Hb(x + 1.5, z) + Hb(x - 1.5, z) + Hb(x, z + 1.5) + Hb(x, z - 1.5)) / 5;
    // 坡度上限 0.5；之字形的轉角前後 8 m 放緩到 0.1（轉角是一塊平台，上下兩腿在那裡挨得很近，高差要小）
    const Gc = X.map((x, i) => { let dc = 1e9; for (let k = 1; k + 1 < TR_W.length; k++) dc = Math.min(dc, Math.hypot(x - TR_W[k][0], Z[i] - TR_W[k][1])); return dc < 8 ? .1 + .4 * dc / 8 : .5; });
    let Y = X.map((x, i) => Hs(x, Z[i]));
    const lim = () => { for (let it = 0; it < 3; it++) { Y[0] = FL - 2;
      for (let i = 1; i < n; i++) { const g = Math.min(Gc[i], Gc[i - 1]) * (S[i] - S[i - 1]); Y[i] = clamp(Y[i], Y[i - 1] - g, Y[i - 1] + g); }
      for (let i = n - 2; i >= 0; i--) { const g = Math.min(Gc[i], Gc[i + 1]) * (S[i + 1] - S[i]); Y[i] = clamp(Y[i], Y[i + 1] - g, Y[i + 1] + g); } } Y[0] = FL - 2; };
    lim(); for (let it = 0; it < 4; it++) Y = Y.map((y, i) => i === 0 || i === n - 1 ? y : (Y[i - 1] + 2 * y + Y[i + 1]) / 4); lim();
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let i = 0; i < n; i++) { x0 = Math.min(x0, X[i]); x1 = Math.max(x1, X[i]); z0 = Math.min(z0, Z[i]); z1 = Math.max(z1, Z[i]); }
    const M = TR_PAD + TR_HW + 30;
    return { X, Z, Y, S, n, len: s, ex: X[n - 1], ez: Z[n - 1], ey: Y[n - 1], bb: [x0 - M, x1 + M, z0 - M, z1 + M] };
  })();
  // 路面的橫斷面照最近的那段（沿路的前後幾公尺是同一條路，不互相比）；沿路相隔 10 m 以上的其他段（之字形的上下兩腿、終點平台）才各自加上限與下限
  function trailCut(h, x, z) {
    const b = TR.bb; if (x < b[0] || x > b[1] || z < b[2] || z > b[3]) return h;
    const a = trailAt(x, z), s0 = a.s;
    let top = 1e9, bot = -1e9;
    const rough = n2(x / 2.6, z / 2.6) * .5 + n2(x / .9, z / .9) * .2;   // 切坡面不要是一整片平滑的斜面：岩面起伏
    const eat = (d, y, dn = TR_DN) => { const e = Math.max(0, d - TR_HW); top = Math.min(top, y + e * TR_UP + Math.min(e, 1.5) * rough * 1.2); bot = Math.max(bot, y - e * dn); };
    eat(a.d, a.y);
    for (let i = 0; i + 1 < TR.n; i++) {
      const ax = TR.X[i], az = TR.Z[i], dx = TR.X[i + 1] - ax, dz = TR.Z[i + 1] - az, u = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
      if (Math.abs(lerp(TR.S[i], TR.S[i + 1], u) - s0) < 12) continue;
      const d = Math.hypot(x - ax - dx * u, z - az - dz * u); if (d < 40) eat(d, lerp(TR.Y[i], TR.Y[i + 1], u));
    }
    if (TR.len - s0 > 10) eat(Math.max(0, Math.hypot(x - TR.ex, z - TR.ez) - TR_PAD) + TR_HW, TR.ey, 2.6);   // 終點平台：半徑 TR_PAD 內平，往下是陡的岩坎（不然填坡會蓋到底下那個轉角）
    return Math.max(Math.min(h, top), bot);
  }
  // 離步道中線多遠（含終點平台）、那裡的路面高
  const _trA = { d: 0, y: 0, k: 0, s: 0 };
  function trailAt(x, z) {
    _trA.d = 1e9; const b = TR.bb; if (x < b[0] || x > b[1] || z < b[2] || z > b[3]) return _trA;
    for (let i = 0; i + 1 < TR.n; i++) {
      const ax = TR.X[i], az = TR.Z[i], dx = TR.X[i + 1] - ax, dz = TR.Z[i + 1] - az, u = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
      const d = Math.hypot(x - ax - dx * u, z - az - dz * u); if (d < _trA.d) { _trA.d = d; _trA.y = lerp(TR.Y[i], TR.Y[i + 1], u); _trA.k = i + u; _trA.s = lerp(TR.S[i], TR.S[i + 1], u); }
    }
    const dp = Math.hypot(x - TR.ex, z - TR.ez) - TR_PAD + TR_HW; if (dp < _trA.d) { _trA.d = Math.max(dp, 0); _trA.y = TR.ey; _trA.k = TR.n - 1; _trA.s = TR.len; }
    return _trA;
  }
  SUMMIT.C = C; SUMMIT.dims = { RO, RI, FL, RF, SOF, DECK, BALC, ST, CBL, TR, TR_HW, TR_PAD, STAIR };

  // ─── 天色：場館裡跟著遊戲時間與天氣，獨立的電影場景固定在暮色 ───
  // 每個值都是 renderGroup 的 uniform。skyState() 照太陽高度在四組之間內插（夜、暮色、低日、白天），再疊雲量、雨（山上是雪）與霧。
  // 暮色那組就是原本調好的常數（太陽剛落到地平線下 se = −0.03），獨立的電影場景直接用它。
  const SKV = ['zen', 'mid', 'hor', 'glow', 'mag', 'disk', 'diskS', 'moonC', 'gnd', 'gndW', 'ambD', 'ambU', 'key', 'alp', 'hz', 'hzW', 'hcD', 'hcL', 'hcA', 'cLo', 'cHi', 'cSun'];
  const SKS = ['star', 'hcFlat', 'lamp', 'exp'];
  const PRESET = {
    night: { zen: [.0012, .0018, .005], mid: [.003, .005, .012], hor: [.008, .01, .02], glow: [0, 0, 0], mag: [0, 0, 0], disk: [0, 0, 0], diskS: [0, 0, 0], moonC: [1.6, 1.7, 1.9],
      gnd: [.01, .011, .017], gndW: [0, 0, 0], ambD: [.006, .007, .012], ambU: [.022, .03, .065], key: [.12, .15, .22], alp: [0, 0, 0], hz: [.012, .015, .028], hzW: [.012, .015, .028],
      hcD: [.002, .0025, .005], hcL: [.022, .026, .04], hcA: [.003, .003, .006], cLo: [.003, .004, .009], cHi: [.03, .038, .07], cSun: [.05, .06, .09], star: 1, hcFlat: .6, lamp: 1, exp: 1.15 },
    dusk: { zen: [.0025, .0055, .022], mid: [.013, .022, .066], hor: [.05, .04, .085], glow: [.84, .24, .052], mag: [.114, .0285, .0494], disk: [1.1, .375, .11], diskS: [0, 0, 0], moonC: [0, 0, 0],
      gnd: [.036, .029, .056], gndW: [.2, .055, .02], ambD: [.02, .018, .034], ambU: [.075, .1, .21], key: [.42, .14, .07], alp: [.8, .26, .2], hz: [.04, .04, .08], hzW: [.34, .12, .05],
      hcD: [.0045, .0055, .013], hcL: [.95, .27, .085], hcA: [.012, .009, .02], cLo: [.008, .01, .026], cHi: [.075, .09, .175], cSun: [.294, .109, .055], star: .6, hcFlat: 0, lamp: 1, exp: 1 },
    low: { zen: [.018, .05, .17], mid: [.06, .12, .28], hor: [.42, .3, .26], glow: [1.1, .5, .16], mag: [.08, .04, .05], disk: [1.8, 1, .4], diskS: [30, 22, 12], moonC: [0, 0, 0],
      gnd: [.12, .11, .12], gndW: [.25, .12, .05], ambD: [.05, .045, .05], ambU: [.16, .22, .4], key: [3.2, 2, 1.1], alp: [.5, .25, .12], hz: [.22, .24, .32], hzW: [.6, .38, .2],
      hcD: [.12, .13, .18], hcL: [1.3, .85, .5], hcA: [.02, .02, .03], cLo: [.08, .1, .16], cHi: [.4, .45, .6], cSun: [1.2, .75, .4], star: 0, hcFlat: .4, lamp: .7, exp: .75 },
    day: { zen: [.025, .08, .3], mid: [.1, .22, .52], hor: [.48, .58, .72], glow: [.12, .1, .07], mag: [0, 0, 0], disk: [.9, .85, .7], diskS: [50, 46, 40], moonC: [0, 0, 0],
      gnd: [.25, .28, .33], gndW: [.04, .03, .02], ambD: [.08, .085, .1], ambU: [.3, .4, .62], key: [5.2, 5, 4.6], alp: [0, 0, 0], hz: [.38, .45, .56], hzW: [.5, .5, .5],
      hcD: [.42, .46, .54], hcL: [1.3, 1.3, 1.28], hcA: [0, 0, 0], cLo: [.28, .32, .42], cHi: [1, 1.05, 1.15], cSun: [1.4, 1.36, 1.28], star: 0, hcFlat: 1, lamp: .35, exp: .42 },
  };
  const SKY_AT = [[-.22, PRESET.night], [-.03, PRESET.dusk], [.1, PRESET.low], [.4, PRESET.day]];
  const SUN0 = V3(.16, -.03, -1).normalize();   // 獨立電影場景的太陽：剛落到西邊（−z）的地平線下
  // 遊戲的太陽方位轉到這座山的座標：日落的方位對齊 SUN0（平台朝晚霞），其他時間照同一個轉角
  let ROT = 0;
  { const s = sunDir(18 * 60 + 18, V3()); ROT = Math.atan2(SUN0.z, SUN0.x) - Math.atan2(s.z, s.x); }
  const rotY = (v, o) => { const c = Math.cos(ROT), s = Math.sin(ROT); return o.set(v.x * c - v.z * s, v.y, v.x * s + v.z * c); };
  const SKY = { sun: SUN0.clone(), moon: SUN0.clone().negate(), kd: V3(), oc: 0, rain: 0, fog: 0, snow: 0, hzD: 1, cSh: 0, hcK: 0, v: {} };
  for (const k of SKV) SKY.v[k] = [0, 0, 0];
  const _s = V3(), _m = V3();
  // 依太陽、雲量、雨、霧算出 SKY.v（fixed：獨立的電影場景，固定暮色、無天氣）
  function skyState(fixed) {
    if (fixed) { SKY.sun.copy(SUN0); SKY.moon.copy(SUN0).negate(); SKY.oc = SKY.rain = SKY.fog = 0; }
    else {
      const min = clockSt.min + clockSt.acc / MIN_SEC;
      rotY(sunDir(min, _s), SKY.sun); rotY(sunDir(min + 760, _m), SKY.moon);
      SKY.oc = sstep(.3, .92, wx.cloud); SKY.rain = wx.rain; SKY.fog = wx.fog;
    }
    const se = SKY.sun.y, V = SKY.v;
    let i = 0; while (i < SKY_AT.length - 2 && se > SKY_AT[i + 1][0]) i++;
    const [a, A] = SKY_AT[i], [b, B] = SKY_AT[i + 1], w = sstep(0, 1, (se - a) / (b - a));
    for (const k of SKV) for (let j = 0; j < 3; j++) V[k][j] = lerp(A[k][j], B[k][j], w);
    for (const k of SKS) V[k] = lerp(A[k], B[k], w);
    // 天氣：陰天的灰（白天亮、夜裡暗），晚霞、太陽、殘照被雲遮掉；雨在山上是雪，霧是白茫茫一片
    const oc = SKY.oc, r = SKY.rain, f = SKY.fog, dk = sstep(-.12, .2, se), wet = Math.max(r, f);
    const grey = [lerp(.006, .3, dk), lerp(.007, .32, dk), lerp(.01, .35, dk)];
    const toG = (k, s, t) => { for (let j = 0; j < 3; j++) V[k][j] = lerp(V[k][j], grey[j] * s, t); };
    toG('zen', .75, oc * .9); toG('mid', .92, oc * .9); toG('hor', 1.08, oc * .9); toG('gnd', .8, oc * .7);
    for (const k of ['glow', 'mag', 'disk', 'diskS', 'moonC', 'gndW', 'alp']) for (let j = 0; j < 3; j++) V[k][j] *= 1 - .93 * oc;
    for (let j = 0; j < 3; j++) V.key[j] *= (1 - .85 * oc) * (1 - .5 * f);
    toG('ambU', 1.25, oc * .5); toG('ambD', .4, oc * .4);
    toG('hcD', .7, oc); toG('hcL', 1.15, oc); toG('cHi', 1.2, oc * .45); toG('cLo', .55, oc * .45);
    for (let j = 0; j < 3; j++) V.cSun[j] *= 1 - .75 * oc;
    toG('hz', 1, wet * .85); toG('hzW', 1, Math.max(oc, wet) * .85);
    V.star *= 1 - oc; V.hcFlat = Math.max(V.hcFlat, oc); V.exp *= 1 + .25 * oc * dk;
    SKY.hcK = oc; SKY.cSh = oc * 5; SKY.hzD = 1 + 1.5 * oc + 5 * r + 14 * f * f; SKY.snow = r;
    // 主光：白天、黃昏是太陽（壓到地平線上 0.1，晚霞的暖光從西邊低低地照過來），夜裡是月亮
    const nk = 1 - sstep(-.2, -.08, se), m = SKY.moon;
    SKY.kd.set(lerp(SKY.sun.x, m.x, nk), lerp(Math.max(SKY.sun.y, .1), Math.max(m.y, .15), nk), lerp(SKY.sun.z, m.z, nk)).normalize();
    return SKY;
  }

  // ─── 材質（TSL） ───
  function mats(tex) {
    const { Fn, If, Loop, Break, vec2, vec3, vec4, float, uniform, attribute, texture, positionWorld, normalWorld, cameraPosition, uv, mix, smoothstep, clamp: tc, max, min, pow, dot, normalize, length, exp, abs, fract, floor, sin, atan, reflect, select, mx_noise_float, screenCoordinate, interleavedGradientNoise, log2, inverseSqrt, renderGroup, frontFacing, step } = TSL;
    const g = v => uniform(v).setGroup(renderGroup);
    const U = { t: g(0), cl: g(0), blink: g(0), pa: g(.001) };
    const L = { sun: g(SUN0.clone()), moon: g(SUN0.clone().negate()), kd: g(V3()), star: g(.6), hcK: g(0), hcFlat: g(0), hzD: g(1), cSh: g(0), lamp: g(1), snow: g(0) };
    for (const k of SKV) L[k] = g(V3());
    // 把 SKY 寫進 uniform（每幀）
    const apply = () => {
      L.sun.value.copy(SKY.sun); L.moon.value.copy(SKY.moon); L.kd.value.copy(SKY.kd);
      for (const k of SKV) L[k].value.fromArray(SKY.v[k]);
      L.star.value = SKY.v.star; L.hcFlat.value = SKY.v.hcFlat; L.lamp.value = SKY.v.lamp;
      L.hcK.value = SKY.hcK; L.hzD.value = SKY.hzD; L.cSh.value = SKY.cSh; L.snow.value = SKY.snow;
    };
    const sunN = L.sun, sunH = vec2(L.sun.x, L.sun.z).div(max(length(vec2(L.sun.x, L.sun.z)), 1e-4));
    const tN = texture(tex.noise), tH = texture(tex.hm);
    const rs = (hi, lo, x) => float(1).sub(smoothstep(lo, hi, x));   // 反過來的 smoothstep（GLSL 裡 edge0 > edge1 沒有定義）
    const hash = x => fract(sin(x.mul(127.1).add(311.7)).mul(43758.5453));
    // 天空：地平線的晚霞（暮色）→ 洋紅 → 深藍；白天是藍天與太陽；夜裡是月亮。地平線以下是遠方的霧色
    const skyBase = d => {
      const y = d.y, h = max(y, 0), xz = d.xz.div(max(length(d.xz), 1e-4)), sa = dot(xz, sunH).mul(.5).add(.5), sd = dot(d, sunN);
      const c = mix(L.hor, L.mid, smoothstep(0, .2, h)).toVar();
      c.assign(mix(c, L.zen, smoothstep(.16, .75, h)));
      c.addAssign(L.glow.mul(exp(h.mul(-13))).mul(pow(sa, 5)));
      c.addAssign(L.mag.mul(exp(h.mul(-3.6))).mul(pow(sa, 2.4)));
      c.addAssign(L.disk.mul(pow(max(sd, 0), 30)).mul(exp(h.mul(-8))));
      c.addAssign(L.diskS.mul(smoothstep(.99988, .99994, sd)));
      const md = dot(d, L.moon);
      c.addAssign(L.moonC.mul(smoothstep(.99976, .99988, md).add(pow(max(md, 0), 80).mul(.012))));
      return mix(c, L.gnd.add(L.gndW.mul(pow(sa, 5))), rs(0, -.06, y));
    };
    // 天上的雲：投影到 6 km 高的一層。暮色時靠晚霞那側的雲底染橘、頭頂的雲暗；白天整片被太陽照白；陰天整片蓋滿
    const skyFull = d => {
      const c = skyBase(d).toVar(), y = d.y, h = max(y, 0), xz = d.xz.div(max(length(d.xz), 1e-4)), sa = dot(xz, sunH).mul(.5).add(.5);
      const p = d.xz.div(max(y, .02).add(.05)).mul(.075).add(vec2(U.t.mul(.0009), U.t.mul(.0003)));
      const n = tN.sample(p).b.mul(.62).add(tN.sample(p.mul(2.7).add(.31)).r.mul(.38));
      const den = smoothstep(L.hcK.mul(-.36).add(.46), L.hcK.mul(-.3).add(.74), n.add(h.mul(.25)).sub(.06)).mul(smoothstep(.005, .06, y)).mul(float(1).sub(smoothstep(.5, .92, y).mul(float(.6).sub(L.hcK.mul(.5)))));
      const lit = mix(pow(sa, 3.2).mul(exp(h.mul(-5.5))).mul(float(1.15).sub(n.mul(.7))), sa.mul(.45).add(.55).mul(float(1.1).sub(n.mul(.5))), L.hcFlat);
      const cc = mix(L.hcD, L.hcL, tc(lit, 0, 1)).add(L.hcA.mul(float(1).sub(sa)));
      c.assign(mix(c, cc, den.mul(.93)));
      // 星：暮色時頭頂很淡的幾顆，夜裡滿天
      const g2 = d.xz.div(y.add(1)).mul(260), cell = floor(g2), fr = fract(g2).sub(.5), s = hash(cell.x.add(cell.y.mul(57.13)));
      c.addAssign(vec3(.7, .8, 1).mul(rs(.08, .0, length(fr))).mul(smoothstep(mix(.985, .965, L.star.sub(.6).max(0).mul(2.5)), 1, s)).mul(smoothstep(.25, .7, y)).mul(float(1).sub(den)).mul(L.star));
      return c;
    };
    // 霧色：冷色，只在太陽那個方向帶一點暖
    const hazeCol = d => { const sa = dot(d.xz.div(max(length(d.xz), 1e-4)), sunH).mul(.5).add(.5); return mix(L.hz, L.hzW, pow(sa, 5).mul(.75)); };
    // 空氣透視：遠處淡進同方向的地平線霧色，高處空氣比較稀；下雪、起霧時變濃
    const haze = (col, p) => {
      const v = p.sub(cameraPosition), dist = length(v), d = v.div(dist);
      const k = exp(max(p.y, -60).mul(-.0012));
      const f = float(1).sub(exp(dist.mul(-.00008).mul(L.hzD).mul(k))).mul(.95);
      return mix(col, hazeCol(d), f);
    };
    // 山體的影子：沿主光方向在高度圖（±2560 m）裡往外走 12 步（越走越大步），碰到山就暗
    const shadowAt = p => {
      const s = float(1).toVar();
      If(L.kd.y.greaterThan(.02), () => {
        const d = float(5).toVar();
        Loop(12, () => {
          const q = p.add(L.kd.mul(d)), hu = q.xz.div(HM_R * 2).add(.5);
          If(max(abs(hu.x.sub(.5)), abs(hu.y.sub(.5))).greaterThan(.5), () => { Break(); });
          const th = tH.sample(hu).level(0).r.mul(600).sub(300);
          s.assign(min(s, smoothstep(-6, 2, q.y.sub(th))));
          d.mulAssign(1.5);
        });
      });
      return s;
    };
    // 打光：天光（上）、雲海反上來的光（下）、主光（太陽或月亮；暮色時是西邊地平線的暖光）、高峰的殘照、建築的暖色點光、天空的反射（菲涅耳）
    const shade = (alb, n, p, o = {}) => {
      const v = normalize(cameraPosition.sub(p)), up = n.y.mul(.5).add(.5);
      const Lc = mix(L.ambD, L.ambU, up).toVar();
      Lc.addAssign(L.key.mul(max(dot(n, L.kd), 0)).mul(o.warm ?? .5).mul(o.sh ?? 1));
      if (o.glow) Lc.addAssign(L.alp.mul(max(dot(n, normalize(vec3(sunH.x, .32, sunH.y))), 0)).mul(smoothstep(160, 620, p.y)).mul(o.glow));   // 高峰的殘照
      for (const [x, y, z, r, g3, b, k, r0] of LIGHTS) {
        const dl = vec3(x, y, z).sub(p), d2 = dot(dl, dl);
        Lc.addAssign(vec3(r, g3, b).mul(max(dot(n, dl.mul(inverseSqrt(d2))), 0).mul(k).div(d2.add(r0))).mul(L.lamp).mul(o.lamp ?? 1));
      }
      const F = pow(float(1).sub(max(dot(n, v), 0)), 5).mul(o.spec ?? .4).add(o.f0 ?? .02);
      return alb.mul(Lc).add(skyBase(reflect(v.negate(), n)).mul(F));
    };
    // 室內：天花板的燈帶往下照（暖），加一點從玻璃透進來的天光與日光
    const WARM_IN = vec3(1, .64, .36);
    const roomLight = n => WARM_IN.mul(max(n.y, 0).mul(.95).add(.32)).mul(1.25).add(mix(L.ambD, L.ambU, n.y.mul(.5).add(.5)).mul(.45)).add(L.key.mul(max(dot(n, L.kd), 0)).mul(.12));
    const M = (frag, o = {}) => { const m = new NodeMaterial(); m.fragmentNode = frag; Object.assign(m, o); return m; };

    // 天空球
    const sky = M(Fn(() => vec4(skyFull(normalize(positionWorld.sub(cameraPosition))), 1))(), { side: T.BackSide, depthWrite: false });

    // 地形：雪（坡緩、凹處、北坡）與岩（陡壁、稜線），岩壁有層理與裂理，雪面的冷色反光；主光照得到的地方才亮（高度圖的影子）
    const terrain = M(Fn(() => {
      const p = positionWorld, a = attribute('aSm', 'vec2'), n0 = normalize(normalWorld);
      const nz = mx_noise_float(p.mul(.045)), nz2 = mx_noise_float(p.mul(.19)), nz3 = mx_noise_float(p.mul(.8));
      // 順著坡往下的條紋：橫過坡面的座標變化快、沿坡的（用高度代替）變化慢
      const fall = n0.xz.div(max(length(n0.xz), 1e-3)), across = vec2(fall.y.negate(), fall.x), steep = tc(float(1).sub(n0.y).mul(2.2), 0, 1);
      const cu = dot(p.xz, across), ru = mx_noise_float(vec3(cu.mul(.085), p.y.mul(.011), 0)).mul(.65).add(mx_noise_float(vec3(cu.mul(.31), p.y.mul(.04), 3.7)).mul(.35));
      const snow = smoothstep(.46, .56, a.x.add(nz.mul(.08)).add(nz2.mul(.06)).add(nz3.mul(.03)).add(ru.mul(steep).mul(.32)));
      const ps = p.mul(vec3(.3, .045, .3)), st = mx_noise_float(ps), st2 = mx_noise_float(p.mul(vec3(1.1, .18, 1.1)));
      const g2 = vec3(mx_noise_float(ps.add(vec3(3.1, 0, 0))), 0, mx_noise_float(ps.add(vec3(0, 0, 5.3)))).mul(.22).add(vec3(mx_noise_float(p.mul(.7).add(1.3)), 0, mx_noise_float(p.mul(.7).add(2.9))).mul(.1));
      const n = normalize(n0.add(g2.mul(float(1).sub(snow.mul(.8)))).add(vec3(across.x, 0, across.y).mul(mx_noise_float(vec3(cu.mul(.085).add(.06), p.y.mul(.011), 0)).sub(mx_noise_float(vec3(cu.mul(.085).sub(.06), p.y.mul(.011), 0))).mul(2.4).mul(steep)))).toVar();
      const rock = mix(vec3(.026, .027, .03), vec3(.085, .086, .092), tc(st.mul(.35).add(st2.mul(.2)).add(nz2.mul(.15)).add(.45), 0, 1));
      const alb = mix(rock, vec3(.84, .89, .97).mul(nz3.mul(.04).add(.98)), snow);
      const c = shade(alb, n, p, { spec: snow.mul(.7).add(.1), f0: snow.mul(.03).add(.01), warm: .4, glow: .45, sh: shadowAt(p), lamp: .035 }).mul(a.y);
      return vec4(haze(c, p), 1);
    })());

    // 雲海：沿視線往下步進
    const STEPS = isTouch || !GT().ao ? 16 : 30;
    const cTop = (q, lod) => {
      const big = tN.sample(q.div(1750).add(vec2(U.cl.mul(.0021), U.cl.mul(.0009)))).level(lod.x).r;
      const mid = tN.sample(q.div(460).add(vec2(U.cl.mul(.0052), U.cl.mul(-.0017)))).level(lod.y).g;
      const det = tN.sample(q.div(120).add(vec2(U.cl.mul(.011), U.cl.mul(.004)))).level(lod.z).a;
      return big.mul(40).add(mid.mul(15)).add(det.mul(5)).sub(31).add(L.cSh);
    };
    const clouds = M(Fn(() => {
      const ro = cameraPosition, pw = positionWorld, rd = normalize(pw.sub(ro)).toVar();
      const t0 = length(pw.sub(ro)), dy = min(rd.y, -.0004);
      const path = float(SM_CB - SM_CT).div(dy), Lm = min(path, t0.mul(.45).add(260)), dt = Lm.div(STEPS);
      const t = t0.add(dt.mul(interleavedGradientNoise(screenCoordinate.xy))).toVar();
      const fp = t0.mul(U.pa);   // 這一點的像素寬度（公尺）
      const lod = vec3(log2(max(fp.div(1750 / 256), 1)), log2(max(fp.div(460 / 256), 1)), log2(max(fp.div(120 / 256), 1)));
      const q0 = pw.xz, cov = tN.sample(q0.div(7200).add(vec2(U.cl.mul(.0007), 0))).level(0).b;
      const shift = cov.sub(.5).mul(26);
      const sa = dot(rd.xz.div(max(length(rd.xz), 1e-4)), sunH).mul(.5).add(.5);
      const sunw = mix(pow(sa, 2.5).mul(.85).add(.15), 1, L.hcFlat);
      const Tr = float(1).toVar(), col = vec3(0).toVar();
      Loop(STEPS, () => {
        const p = ro.add(rd.mul(t)), q = p.xz;
        const top = cTop(q, lod).add(shift);
        const hu = q.div(HM_R * 2).add(.5), inHm = max(abs(hu.x.sub(.5)), abs(hu.y.sub(.5))).lessThan(.5);
        const ter = select(inHm, tH.sample(hu).level(0).r.mul(600).sub(300), float(-1e4));
        If(p.y.lessThan(ter), () => { Break(); });
        const din = top.sub(p.y), den = tc(din.mul(.16), 0, 1);
        If(den.greaterThan(.002), () => {
          const topS = cTop(q.add(sunH.mul(14)), lod).add(shift);
          const face = tc(float(.5).sub(topS.sub(top).div(14).mul(2.2)), 0, 1);
          const sh = exp(din.mul(-.05));
          const c = mix(L.cLo, L.cHi, sh).toVar();
          c.addAssign(L.cSun.mul(face).mul(sh).mul(sunw));
          for (const [x, y, z, r, g3, b, k] of LIGHTS) { const dl = vec3(x, y, z).sub(p); c.addAssign(vec3(r, g3, b).mul(k * 6).div(dot(dl, dl).add(2500)).mul(sh.mul(.7).add(.3)).mul(L.lamp)); }
          const a = float(1).sub(exp(den.mul(dt).mul(-.085)));
          col.addAssign(c.mul(a).mul(Tr)); Tr.mulAssign(float(1).sub(a));
        });
        If(Tr.lessThan(.015), () => { Break(); });
        t.addAssign(dt);
      });
      const A = float(1).sub(Tr), cc = col.div(max(A, 1e-4));
      // 遠處淡進霧色（同 haze，用雲頂的平均高度）
      const f = float(1).sub(exp(t0.mul(-.00008).mul(L.hzD))).mul(.95);
      const out = mix(cc, hazeCol(rd), f);
      const A2 = A.mul(rs(29000, 22000, t0));
      return vec4(out.mul(A2), A2);   // premultipliedAlpha
    })(), { transparent: true, depthWrite: false, premultipliedAlpha: true });

    // 金屬殼（屋頂、外殼、柱、橋的結構）
    const metal = (base, o = {}) => M(Fn(() => {
      const p = positionWorld, n = normalize(normalWorld);
      return vec4(haze(shade(vec3(...base), n, p, { spec: o.spec ?? .8, f0: o.f0 ?? .06, warm: .55 }), p), 1);
    })());
    // 屋頂：放射狀的板縫、一圈天窗的微光、薄雪
    const roof = M(Fn(() => {
      const p = positionWorld, n = normalize(normalWorld), u = uv();
      const seam = rs(.03, .0, abs(fract(u.x).sub(.5)).sub(.47).max(0)).max(rs(.012, 0, abs(fract(u.y.mul(4)).sub(.5)).sub(.488).max(0)));
      const sn = smoothstep(.35, .7, mx_noise_float(p.mul(.21)).mul(.6).add(mx_noise_float(p.mul(1.3)).mul(.4))).mul(smoothstep(.8, .95, n.y)).mul(.55);
      const alb = mix(mix(vec3(.36, .37, .39), vec3(.12, .124, .13), seam), vec3(.75, .8, .88), sn.mul(.8));
      const c = shade(alb, n, p, { spec: float(.9).sub(sn.mul(.5)), f0: .1, warm: .7 }).toVar();
      c.addAssign(vec3(1, .6, .3).mul(rs(.09, 0, u.y).add(rs(.09, 0, float(1).sub(u.y)))).mul(.35).mul(L.lamp));   // 簷口被窗光照到的那一圈
      const sk = rs(.02, 0, abs(u.y.sub(.52)).sub(.05)).mul(float(1).sub(seam));   // 天窗
      c.addAssign(vec3(1, .62, .3).mul(sk).mul(1.6));
      return vec4(haze(c, p), 1);
    })());
    // 底板：一顆顆的下照燈與燈附近的暖光（環的底下、平台的底下）
    const soffit = M(Fn(() => {
      const p = positionWorld, n = normalize(normalWorld), u = uv();
      const cu = fract(u.x).sub(.5), rows = fract(u.y.mul(3)).sub(.5), d = vec2(cu.mul(1.6), rows).length();
      const lamp = rs(.09, .05, d), wash = exp(d.mul(-3.2)).mul(.35);
      const c = shade(vec3(.06, .058, .056), n, p, { spec: .35, f0: .03, warm: .3 }).toVar();
      c.addAssign(vec3(1, .58, .27).mul(lamp.mul(9).add(wash)).mul(L.lamp.mul(.6).add(.4)));
      return vec4(haze(c, p), 1);
    })());
    // 發光（LED 燈條、門洞、窗框的燈）：白天調暗
    const emi = (r, g3, b, k) => M(Fn(() => vec4(haze(vec3(r, g3, b).mul(k).mul(L.lamp.mul(.75).add(.25)), positionWorld), 1))());
    const beacon = M(Fn(() => vec4(vec3(1, .06, .03).mul(U.blink.mul(26).add(.4)), 1))());
    // 平台面：暖灰石材，被欄杆底的燈條照亮
    const deck = M(Fn(() => {
      const p = positionWorld, n = normalize(normalWorld), u = uv();
      const tile = rs(.03, 0, abs(fract(u.x.mul(3)).sub(.5)).sub(.47).max(0));
      const alb = mix(vec3(.2, .17, .14), vec3(.1, .085, .07), tile.mul(.6));
      return vec4(haze(shade(alb, n, p, { spec: .3, f0: .03 }), p), 1);
    })());
    // 室內的地板：拋光的暖灰石（世界座標 1.2 m 的方磚），映著天花板的暖光
    const floorIn = M(Fn(() => {
      const p = positionWorld, n = vec3(0, 1, 0), V = normalize(cameraPosition.sub(p));
      const q = fract(p.xz.div(1.2)).sub(.5), seam = rs(.012, .004, float(.5).sub(max(abs(q.x), abs(q.y))));
      const nn = mx_noise_float(p.mul(vec3(1.3, 0, 1.3))).mul(.06).add(mx_noise_float(p.mul(vec3(7, 0, 7))).mul(.025));
      const alb = mix(vec3(.25, .215, .185).mul(nn.add(1)), vec3(.1, .09, .08), seam);
      const F = pow(float(1).sub(max(V.y, 0)), 4).mul(.55).add(.035);
      const c = alb.mul(roomLight(n)).add(WARM_IN.mul(F).mul(float(1).sub(seam)).mul(.9));
      return vec4(haze(c, p), 1);
    })());
    // 天花板：深色木格柵（u 沿著環），內外兩圈燈槽、中間兩排下照燈
    const ceilIn = M(Fn(() => {
      const p = positionWorld, u = uv(), r = length(p.xz);
      const sl = smoothstep(.3, .42, abs(fract(u.x.mul(2)).sub(.5)));
      const alb = mix(vec3(.2, .12, .065), vec3(.05, .035, .025), sl.mul(.8));
      const c = alb.mul(WARM_IN.mul(.55).add(mix(L.ambD, L.ambU, .2).mul(.3))).toVar();
      const cove = rs(.55, .25, abs(r.sub(RI + 1.6))).add(rs(.55, .25, abs(r.sub(RO - 1.6))));
      c.addAssign(WARM_IN.mul(cove).mul(4.2));
      const dl = vec2(fract(u.x.div(3)).sub(.5).mul(3), min(abs(r.sub(RI + 5.2)), abs(r.sub(RO - 5.2)))).length();
      c.addAssign(WARM_IN.mul(rs(.16, .1, dl).mul(9).add(exp(dl.mul(-2.2)).mul(.25))));
      return vec4(haze(c, p), 1);
    })());
    // 室內的木頭（長椅、格柵、吧台）：室內的光；戶外的（平台的長椅）走一般的打光
    const wood = (out = false) => M(Fn(() => {
      const p = positionWorld, n = normalize(normalWorld);
      const gr = mx_noise_float(p.mul(vec3(.6, 9, .6))).mul(.5).add(mx_noise_float(p.mul(vec3(2, 30, 2))).mul(.25));
      const alb = vec3(.3, .17, .085).mul(gr.mul(.35).add(1));
      const c = out ? shade(alb, n, p, { spec: .2, f0: .03 }) : alb.mul(roomLight(n)).add(skyBase(reflect(normalize(p.sub(cameraPosition)), n)).mul(.03));
      return vec4(haze(c, p), 1);
    })());
    // 室內的深色金屬（柱、吧台面、車站的機械）
    const steelIn = M(Fn(() => {
      const p = positionWorld, n = normalize(normalWorld), V = normalize(p.sub(cameraPosition));
      const F = pow(float(1).sub(abs(dot(V, n))), 4).mul(.5).add(.05);
      return vec4(haze(vec3(.05, .05, .055).mul(roomLight(n)).add(WARM_IN.mul(F).mul(.5)), p), 1);
    })());
    // 帶室內的玻璃帷幕（從外面遠看）：視線射進一個深 depth、高 room 的房間（後牆、天花板的燈條、地板），格線是窗框；sp 是一格窗的寬（公尺）
    const fakeRoom = (sp, room, depth, o, p, N, u, V) => {
      const nh = normalize(vec3(N.x, 0, N.z)), tg = vec3(nh.z.negate(), 0, nh.x);
      const dd = max(dot(V, nh.negate()), .06), ds = dot(V, tg), dy = V.y;
      const s0 = u.x.mul(sp), y0 = u.y.mul(room);
      const tb = float(depth).div(dd), tf = select(dy.lessThan(-.001), y0.div(dy.negate()), float(1e4)), tcl = select(dy.greaterThan(.001), float(room).sub(y0).div(dy), float(1e4));
      const tm = min(tb, min(tf, tcl)), hs = s0.add(ds.mul(tm)), hy = y0.add(dy.mul(tm)), hd = dd.mul(tm);
      const bay = floor(hs.div(sp * 2)), rb = hash(bay.add(o.seed ?? 0)), lit = smoothstep(.12, .2, rb);
      const furn = rs(.02, 0, hy.sub(float(.95).add(sin(hs.mul(2.3).add(rb.mul(9))).mul(.25)))).mul(smoothstep(.45, .5, fract(hs.div(2.7).add(rb))));
      const wall = vec3(1, .57, .27).mul(mix(.3, 1.05, lit)).mul(rb.mul(.45).add(.75)).mul(smoothstep(-1, room, hy).mul(.6).add(.5))
        .mul(rs(.5, .45, abs(fract(hs.mul(1.4)).sub(.5))).mul(.18).add(.82)).mul(float(1).sub(furn.mul(.85)));
      const strip = rs(.07, .0, abs(fract(hd.div(1.8)).sub(.5)).sub(.42).max(0));
      const ceil = vec3(.38, .24, .14).mul(.7).add(vec3(5.2, 3.1, 1.5).mul(strip).mul(mix(.25, 1, lit)));
      const flo = vec3(.2, .11, .055).mul(mix(.35, .9, lit)).add(vec3(.5, .3, .15).mul(smoothstep(.6, 1, hd.div(depth))).mul(lit));
      const isB = tb.lessThanEqual(min(tf, tcl)), isC = tcl.lessThan(tf);
      return select(isB, wall, select(isC, ceil, flo)).mul(mix(1, .7, tc(hd.div(depth), 0, 1))).mul(o.k ?? 1);
    };
    // 帷幕玻璃：遠看（o.n0..o.n1 公尺）是上面的假房間（不透明），走近變成真的透明玻璃，看得到裡面真的地板、天花板與家具；
    // 從裡面看（背面）一律是透明玻璃。窗框兩面都畫
    const curtain = (sp, room, depth, o = {}) => M(Fn(() => {
      const p = positionWorld, N0 = normalize(normalWorld), u = uv(), V = normalize(p.sub(cameraPosition));
      const N = select(dot(N0, V).greaterThan(0), N0.negate(), N0);
      const fr = rs(.035, .02, fract(u.x)).max(smoothstep(.965, .98, fract(u.x))).max(rs(.03, .015, u.y)).max(smoothstep(.97, .985, u.y));
      const F = pow(float(1).sub(abs(dot(V, N))), 5).mul(.92).add(.05);
      const gC = skyBase(reflect(V, N)).mul(F).add(WARM_IN.mul(.03)).add(vec3(.012, .016, .024));
      const ga = tc(F.add(.07), 0, 1);
      const far = select(frontFacing, smoothstep(o.n0 ?? 70, o.n1 ?? 170, length(p.sub(cameraPosition))), float(0));
      const Fi = pow(float(1).sub(abs(dot(V, N0))), 5).mul(.96).add(.04);
      const inC = mix(fakeRoom(sp, room, depth, o, p, N0, u, V).mul(.9), skyBase(reflect(V, N0)), Fi);
      const frameC = shade(vec3(.035, .035, .04), N, p, { spec: .6, f0: .05 });
      const rgb = mix(mix(gC, inC, far), frameC, fr).toVar(), a = max(mix(ga, 1, far), fr);
      const v = p.sub(cameraPosition), hk = float(1).sub(exp(length(v).mul(-.00008).mul(L.hzD).mul(exp(max(p.y, -60).mul(-.0012))))).mul(.95);
      return vec4(mix(rgb, hazeCol(normalize(v)).mul(a), hk), a);
    })(), { transparent: true, depthWrite: false, premultipliedAlpha: true, side: T.DoubleSide });
    // 透明玻璃（欄杆、迴廊）：天空反射＋一點暖色的室內反光
    const glass = (warm = .04) => M(Fn(() => {
      const p = positionWorld, V = normalize(p.sub(cameraPosition)), N0 = normalize(normalWorld), N = select(dot(N0, V).greaterThan(0), N0.negate(), N0);
      const F = pow(float(1).sub(abs(dot(V, N))), 5).mul(.9).add(.06);
      const c = skyBase(reflect(V, N)).mul(F).add(vec3(1, .6, .3).mul(warm)).add(vec3(.02, .03, .05));
      const a = tc(F.add(.1), 0, 1);
      return vec4(haze(c, p), a);
    })(), { transparent: true, depthWrite: false, premultipliedAlpha: true, side: T.DoubleSide });
    // 纜車廂：烤漆的車殼（白天米白、夜裡被窗光照暖）
    const paint = (base, o = {}) => M(Fn(() => {
      const p = positionWorld, n = normalize(normalWorld);
      return vec4(haze(shade(vec3(...base), n, p, { spec: o.spec ?? .9, f0: o.f0 ?? .05, warm: .6 }), p), 1);
    })());
    // 雪：跟著相機的三層圓筒，片段裡畫一格一格往下飄、被風吹斜的雪片；室內（環、迴廊、車站的屋頂下）不下
    const flakes = M(Fn(() => {
      const p = positionWorld, rel = p.sub(cameraPosition), R = length(rel.xz), a = atan(rel.z, rel.x);
      const lay = select(R.lessThan(9), float(0), select(R.lessThan(20), float(1), float(2)));
      const cs = lay.mul(.55).add(.55);
      const gx = a.mul(R).div(cs).add(U.t.mul(lay.mul(-.3).add(1.4))), gy = p.y.add(U.t.mul(lay.mul(.25).add(1.1))).div(cs);
      const cell = floor(vec2(gx, gy)), h1 = hash(cell.x.add(cell.y.mul(31.7)).add(lay.mul(91))), h2 = hash(cell.x.mul(7.1).add(cell.y.mul(3.3)).add(lay.mul(17)));
      const f = fract(vec2(gx, gy)).sub(vec2(h1, h2).mul(.6).add(.2)), d = length(f);
      const fl = rs(.11, .03, d).mul(step(.45, h1.mul(.6).add(h2.mul(.4)))).mul(lay.mul(-.3).add(1));
      const rr = length(p.xz), inRing = rr.greaterThan(RI - 1.5).and(rr.lessThan(RO + 1.6)).and(p.y.lessThan(RF));
      const inBr = abs(p.z).lessThan(2.8).and(p.y.lessThan(FL + 4.2)).and(p.x.greaterThan(XF).and(p.x.lessThan(-RO)).or(p.x.greaterThan(RO).and(p.x.lessThan(ST.x - ST.hx))));
      const inSt = abs(p.x.sub(ST.x)).lessThan(ST.hx + .6).and(abs(p.z.sub(ST.z)).lessThan(ST.hz + .6)).and(p.y.lessThan(FL + ST.h + .5));
      const k = fl.mul(L.snow).mul(select(inRing.or(inBr).or(inSt), float(0), float(1))).mul(smoothstep(1.2, 3, R));
      const col = L.ambU.mul(1.6).add(L.key.mul(.25)).add(vec3(.06, .05, .04).mul(L.lamp)).add(.02);
      return vec4(col.mul(k), k.mul(.9));
    })(), { transparent: true, depthWrite: false, premultipliedAlpha: true, side: T.DoubleSide });
    // 纜車廂的窗：裡面的暖光（座位的剪影）＋天空的反射，u 是一圈的長度（公尺）
    const cabWin = M(Fn(() => {
      const p = positionWorld, N0 = normalize(normalWorld), V = normalize(p.sub(cameraPosition)), u = uv();
      const F = pow(float(1).sub(abs(dot(V, N0))), 4).mul(.85).add(.08);
      const mull = smoothstep(.43, .47, abs(fract(u.x.div(.62)).sub(.5)));
      const seat = rs(.36, .3, u.y).mul(.6);
      const inC = WARM_IN.mul(float(.55).sub(seat.mul(.4))).mul(L.lamp.mul(.6).add(.4));
      const c = mix(inC, skyBase(reflect(V, N0)), F);
      return vec4(haze(mix(c, vec3(.03, .03, .035), mull), p), 1);
    })());
    // 步道的指標：canvas 寫字的木牌（正面 uv 0..1），一般的打光
    const sign = (draw, w = 512, h = 256) => {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
      const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; const tS = texture(t);
      return M(Fn(() => { const p = positionWorld, n = normalize(normalWorld); return vec4(haze(shade(tS.sample(uv()).rgb, n, p, { spec: .15, f0: .02, warm: .6 }), p), 1); })());
    };
    return { U, L, apply, sky, sign, terrain, clouds, roof, soffit, metal, emi, beacon, deck, floorIn, ceilIn, wood, steelIn, curtain, glass, paint, flakes, cabWin };
  }

  // ─── 建築 ───
  // 門：外圈玻璃在東、西迴廊與南邊平台（−z）各開一個口（角度、半寬 m、門上的橫楣高）
  const DOORS = [[0, 2.3, FL + 4.35], [Math.PI, 2.3, FL + 4.35], [-Math.PI / 2, 1.9, FL + 3.1]];
  // 室內的家具（碰撞也照這張表）：柱、長椅、木格柵、吧台
  const COLS = Array.from({ length: 12 }, (_, k) => (k + .5) * Math.PI / 6);
  const BENCH = Array.from({ length: 12 }, (_, k) => k * Math.PI / 6 + .26);
  const SCREEN = [Math.PI / 4 + .12, 3 * Math.PI / 4 - .12, -3 * Math.PI / 4 + .12, -Math.PI / 4 - .12];
  const BAR = { a0: 2.02, a1: 2.48, r0: 30.6, r1: 31.5 };
  const SCOPES = [-Math.PI / 2 - .22, -Math.PI / 2, -Math.PI / 2 + .22];
  const CAB_DOCK = 2.6;   // 車廂停在車站裡索上的哪裡（公尺）
  // ─── 東稜步道的設施（加進 building 的幾何群組）：東門雨遮、鋼梯、木階、標桿、繩欄、觀景台、三角點、石堆、指標 ───
  const TRAIL_PROPS = { scope: null, signs: [] };   // 碰撞圓直接加進 SM_DATA.circles（場館的碰撞拿的是同一個陣列）
  function trailBuild(g) {
    const n = TR.n, at = k => { const i = clamp(Math.floor(k), 0, n - 2), u = clamp(k - i, 0, 1), dx = TR.X[i + 1] - TR.X[i], dz = TR.Z[i + 1] - TR.Z[i], l = Math.hypot(dx, dz) || 1;
      return { x: lerp(TR.X[i], TR.X[i + 1], u), y: lerp(TR.Y[i], TR.Y[i + 1], u), z: lerp(TR.Z[i], TR.Z[i + 1], u), dx: dx / l, dz: dz / l, sl: (TR.Y[i + 1] - TR.Y[i]) / l }; };
    const C_ = SM_DATA.circles, { x0, x1, z: zc, hw } = STAIR, X1 = ST.x + ST.hx;
    // 東門：外面的鋼雨遮（下緣一條燈）、門口到梯頂的鋼格柵平台
    g.shell.box(X1 + 1.2, FL + 3.05, zc, 1.2, .08, STAIR.door + .6); g.ledW.box(X1 + 2.38, FL + 2.96, zc, .02, .02, STAIR.door + .5);
    g.dark.box((X1 + x0) / 2, FL - .05, zc, (x0 - X1) / 2, .05, hw);
    // 鋼梯：12 階（木踏板）、兩側的鋼梁與扶手
    const NS = 12, run = (x1 - x0) / NS;
    for (let i = 0; i < NS; i++) { const x = x0 + (i + .5) * run, y = FL - (i + 1) * 2 / NS; g.woodO.box(x, y + .025, zc, run / 2 - .01, .03, hw - .05); g.dark.box(x + run / 2 - .02, y - .06, zc, .02, .06, hw - .05); }
    for (const sd of [-1, 1]) { const z = zc + sd * hw;
      g.stru.tube([x0 - .05, FL - .1, z], [x1 + .1, FL - 2.15, z], .07, 6);
      g.stru.tube([x0, FL + 1, z], [x1, FL - 1, z], .03, 6);
      for (const u of [0, .5, 1]) { const x = lerp(x0, x1, u), y = lerp(FL, FL - 2, u); g.stru.tube([x, y - .1, z], [x, y + 1, z], .028, 6); } }
    // 木階：坡度 0.24 以上的段落每 0.7 m 一根橫木（兩頭各留 25 cm）
    for (let k = 2; k < n - 1; k += .7) { const a = at(k); if (Math.abs(a.sl) < .24) continue;
      g.woodO.box(a.x, a.y + .03, a.z, TR_HW - .25, .05, .07, Math.atan2(a.dx, a.dz)); }   // 方塊的 z 沿路、x 橫過路
    // 標桿：每 8 m 一根、左右交錯，頂端是反光片
    let side = 1;
    for (let k = 4; k < n - 4; k += 8) { const a = at(k), nx = -a.dz * side, nz = a.dx * side, x = a.x + nx * (TR_HW + .3), z = a.z + nz * (TR_HW + .3);
      g.pole.tube([x, a.y - .4, z], [x, a.y + 1.55, z], .032, 6); g.refl.box(x, a.y + 1.45, z, .045, .1, .045); side = -side; }
    // 繩欄：往下掉超過 1.5 m 的那一側，每 3 m 一根柱、兩條繩
    let prev = null;
    for (let k = 3; k < n - 2; k += 3) { const a = at(k), nx = -a.dz, nz = a.dx;
      const hp = Hb(a.x + nx * 5, a.z + nz * 5), hm = Hb(a.x - nx * 5, a.z - nz * 5), sd = hp < hm ? 1 : -1;
      if (Math.min(hp, hm) > a.y - 1.5) { prev = null; continue; }
      const x = a.x + nx * sd * (TR_HW + .1), z = a.z + nz * sd * (TR_HW + .1), cur = { x, z, y: a.y, sd };
      g.stru.tube([x, a.y - .4, z], [x, a.y + 1.02, z], .04, 6);
      if (prev && prev.sd === sd && Math.hypot(prev.x - x, prev.z - z) < 4.5) for (const h of [.95, .5]) g.rope.tube([prev.x, prev.y + h, prev.z], [x, a.y + h, z], .016, 4);
      prev = cur; }
    // 觀景台：朝環心，平台前緣的木平台＋玻璃欄、長椅、望遠鏡；平台邊一圈矮繩欄（步道進來的那段留開口）
    const ex = TR.ex, ez = TR.ez, ey = TR.ey, fl = Math.hypot(ex, ez), fx = -ex / fl, fz = -ez / fl, rx = fz, rz = -fx, ry = Math.atan2(fx, fz);
    const L = (u, v) => [ex + rx * u + fx * v, ez + rz * u + fz * v];
    { const [cx, cz] = L(0, TR_PAD - 2.3);
      g.woodO.box(cx, ey + .06, cz, 3.2, .06, 2.1, ry);
      for (const u of [-3.1, 3.1]) { const [a, b] = L(u, TR_PAD - 4.4), [c, d] = L(u, TR_PAD - .2); g.stru.tube([a, ey + 1.05, b], [c, ey + 1.05, d], .03, 6); }
      const [a0, b0] = L(-3.2, TR_PAD - .2), [a1, b1] = L(3.2, TR_PAD - .2);
      g.gl.face([[a0, ey + .1, b0], [a1, ey + .1, b1], [a1, ey + 1.05, b1], [a0, ey + 1.05, b0]]);
      g.stru.tube([a0, ey + 1.08, b0], [a1, ey + 1.08, b1], .035, 8);
      for (let u = -3.2; u <= 3.21; u += 1.6) { const [a, b] = L(u, TR_PAD - .2); g.stru.tube([a, ey, b], [a, ey + 1.08, b], .03, 6); }
      // 長椅（背對來的路、面朝環）
      { const [bx, bz] = L(-1.2, TR_PAD - 3.2); g.woodO.box(bx, ey + .48, bz, 1.1, .04, .22, ry); const [kx, kz] = L(-1.2, TR_PAD - 3.45); g.woodO.box(kx, ey + .78, kz, 1.1, .14, .03, ry);
        for (const u of [-2.1, -.3]) { const [lx, lz] = L(u, TR_PAD - 3.25); g.stru.box(lx, ey + .24, lz, .03, .24, .2, ry); }
        for (const u of [-2, -1.2, -.4]) { const [cx2, cz2] = L(u, TR_PAD - 3.2); C_.push({ x: cx2, z: cz2, r: .45 }); } }
      // 望遠鏡
      { const [tx, tz] = L(1.6, TR_PAD - 1.1); g.stru.tube([tx, ey, tz], [tx, ey + 1.05, tz], .06, 8);
        g.stru.tube([tx - fx * .3, ey + 1.18, tz - fz * .3], [tx + fx * .32, ey + 1.27, tz + fz * .32], .11, 10); g.dark.box(tx, ey + 1.12, tz, .08, .08, .08);
        C_.push({ x: tx, z: tz, r: .38 }); TRAIL_PROPS.scope = [tx, tz]; } }
    // 平台邊的矮繩欄（樁每 2.4 m；步道進來的方向留 3 m 開口）
    { const k0 = at(n - 1.01), inA = Math.atan2(-k0.dz, -k0.dx); let last = null;
      for (let a = 0; a <= Math.PI * 2 + 1e-6; a += 2.4 / (TR_PAD - .1)) { const da = Math.abs(wrapA(a - inA)), x = ex + Math.cos(a) * (TR_PAD - .1), z = ez + Math.sin(a) * (TR_PAD - .1);
        const front = Math.abs(wrapA(a - Math.atan2(fz, fx))) < .62;   // 前面是木平台的玻璃欄
        if (da < .3 || front) { last = null; continue; }
        g.woodO.tube([x, ey - .3, z], [x, ey + .75, z], .05, 6);
        if (last) g.rope.tube([last[0], ey + .68, last[1]], [x, ey + .68, z], .018, 4);
        last = [x, z]; } }
    // 三角點（花崗岩的方柱、頂上十字）與石堆
    { const [px, pz] = L(-3.6, -1.2); g.conc.box(px, ey + .3, pz, .13, .3, .13, ry); g.conc.box(px, ey + .02, pz, .45, .03, .45, ry); g.dark.box(px, ey + .605, pz, .1, .004, .012, ry); g.dark.box(px, ey + .605, pz, .012, .004, .1, ry);
      C_.push({ x: px, z: pz, r: .4 }); }
    { const [kx, kz] = L(3.2, -2.4); let y = ey - .1, R = 1.05; const rnd = rng(7731);
      for (let i = 0; i < 7; i++) {   // 由大到小、每顆偏一點、扁圓的石頭（上緣往內收）
        const m = 7 + (rnd() * 3 | 0), a0 = rnd() * 6.3, ox = (rnd() - .5) * R * .6, oz = (rnd() - .5) * R * .6, h = .2 + rnd() * .16, el = .7 + rnd() * .5;
        const pts = Array.from({ length: m }, (_, j) => { const a = a0 + j / m * Math.PI * 2, r = R * (.8 + rnd() * .25); return [kx + ox + Math.cos(a) * r * el, kz + oz + Math.sin(a) * r / el]; });
        g.rock.prism(pts, y, y + h * .45, R * .12, 0, 0); g.rock.prism(pts, y + h * .45, y + h, 0, R * .35, 1); y += h * .9; R *= .76; }
      C_.push({ x: kx, z: kz, r: 1.1 }); }
    // 指標：梯底（朝站）與觀景台（朝來的路）。木柱、木牌（正面寫字、背面素木）
    const post = (x, z, y, yaw, G) => {
      const c = Math.cos(yaw), s2 = Math.sin(yaw), wx = c * .55, wz = -s2 * .55, fx2 = s2, fz2 = c;   // 牌面朝 (fx2, fz2)
      g.woodO.box(x, y + .9, z, .06, 1.05, .06, yaw);
      const bx = x + fx2 * .08, bz = z + fz2 * .08, P = [[bx - wx, y + 1.25, bz - wz], [bx + wx, y + 1.25, bz + wz], [bx + wx, y + 1.8, bz + wz], [bx - wx, y + 1.8, bz - wz]];
      G.face(P);   // (P1 − P0) × (P2 − P0) 就朝 (fx2, fz2)
      g.woodO.box(x + fx2 * .045, y + 1.525, z + fz2 * .045, .55, .275, .03, yaw);
      C_.push({ x, z, r: .25 }); TRAIL_PROPS.signs.push([x, z]); };
    post(x1 + .9, zc + hw + 1.2, FL - 2, -Math.PI / 2, g.signA);   // 梯底右手邊，牌面朝站（−x）
    { const [sx2, sz2] = L(-4.6, -3.6), k0 = at(n - 1.01); post(sx2, sz2, ey, Math.atan2(-k0.dx, -k0.dz), g.signB); }
  }
  function building(Mt) {
    const G = () => new Geo();
    const g = { shell: G(), roof: G(), soff: G(), led: G(), ledS: G(), ledI: G(), deck: G(), gl: G(), stru: G(), dark: G(), gOut: G(), gIn: G(), stWin: G(), portal: G(), beacon: G(),
      floor: G(), ceil: G(), wood: G(), woodO: G(), steel: G(), rope: G(), ledW: G(), pole: G(), refl: G(), conc: G(), rock: G(), signA: G(), signB: G() };
    const [cx, cy, cz] = C, Y = y => y - cy, TAU = Math.PI * 2;
    const NOUT = 84, NIN = 56, RH = RF - 1.25;   // RH：室內天花板（玻璃頂）的高度
    const rOut = y => RO - .4 + .9 * (y - FL) / (RH - FL);   // 外圈玻璃（往外傾）在高度 y 的半徑
    // 屋頂（中間微微拱起）與屋簷
    g.roof.lathe([[RI - .8, Y(RF - .25)], [RI + 3, Y(RF + .25)], [(RI + RO) / 2, Y(RF + .55)], [RO - 3, Y(RF + .25)], [RO + 1.2, Y(RF - .2)]], 256, 0, TAU, 120, cy);
    g.shell.lathe([[RO + 1.2, Y(RF - .2)], [RO + 1.2, Y(RF - .62)]], 256, 0, TAU, 1, cy);
    g.ledS.lathe([[RO + 1.2, Y(RF - .62)], [RO + 1.2, Y(RF - .74)]], 256, 0, TAU, 1, cy);
    g.shell.lathe([[RO + 1.2, Y(RF - .74)], [RO + 1.2, Y(RF - 1.1)], [RO + .5, Y(RH)]], 256, 0, TAU, 1, cy);
    g.shell.lathe([[RI - .2, Y(RH)], [RI - .8, Y(RF - 1.1)], [RI - .8, Y(RF - .25)]], 192, 0, TAU, 1, cy);
    // 玻璃帷幕：外圈往外傾（三個門口留空，門上是橫楣玻璃）、內圈往內傾
    {
      const gaps = DOORS.map(([a, w, top]) => ({ a: (a + TAU) % TAU, w: w / RO, top })).sort((p, q) => p.a - q.a);
      for (let k = 0; k < gaps.length; k++) {
        const A = gaps[k], B = gaps[(k + 1) % gaps.length], a0 = A.a + A.w, a1 = B.a - B.w + (k + 1 === gaps.length ? TAU : 0);
        g.gOut.lathe([[RO - .4, Y(FL)], [RO + .5, Y(RH)]], Math.max(8, Math.round(336 * (a1 - a0) / TAU)), a0, a1, NOUT * (a1 - a0) / TAU, cy);
      }
      for (const [a, w, top] of DOORS) {
        const aw = w / RO, c0 = Math.cos(a - aw), s0 = Math.sin(a - aw), c1 = Math.cos(a + aw), s1 = Math.sin(a + aw);
        g.gOut.lathe([[rOut(top), Y(top)], [RO + .5, Y(RH)]], 12, a - aw, a + aw, 2 * w / (TAU * RO / NOUT), cy);
        // 門框：兩側的立柱、門楣，內側一圈暖色燈條
        for (const [c, s] of [[c0, s0], [c1, s1]]) { const r = rOut(FL), x = cx + c * r, z = cz + s * r; g.dark.box(x, (FL + top) / 2, z, .14, (top - FL) / 2, .14, -Math.atan2(s, c)); g.ledW.box(x - c * .16, (FL + top) / 2, z - s * .16, .03, (top - FL) / 2 - .1, .03, -Math.atan2(s, c)); }
        g.dark.lathe([[rOut(top) - .2, Y(top - .25)], [rOut(top) - .2, Y(top)], [rOut(top) + .2, Y(top)], [rOut(top) + .2, Y(top - .25)], [rOut(top) - .2, Y(top - .25)]], 10, a - aw, a + aw, 1, cy);   // 剖面順時針走：法線朝外
        g.ledW.lathe([[rOut(top) - .02, Y(top - .27)], [rOut(top) - .22, Y(top - .27)]], 10, a - aw + .004, a + aw - .004, 1, cy);
      }
    }
    g.gIn.lathe([[RI - .2, Y(RH)], [RI + .4, Y(FL)]], 224, 0, TAU, NIN, cy);
    // 樓板邊的燈帶與底板
    g.shell.lathe([[RO - .4, Y(FL)], [RO - .4, Y(FL - .35)]], 256, 0, TAU, 1, cy);
    g.led.lathe([[RO - .4, Y(FL - .35)], [RO - .4, Y(FL - .55)]], 256, 0, TAU, 1, cy);
    g.shell.lathe([[RO - .4, Y(FL - .55)], [RO - .4, Y(FL - 1.1)], [RO - 1.6, Y(SOF + .3)]], 256, 0, TAU, 1, cy);
    g.shell.lathe([[RI + 1.4, Y(SOF + .3)], [RI + .4, Y(FL - 1.1)], [RI + .4, Y(FL - .55)]], 192, 0, TAU, 1, cy);
    g.ledI.lathe([[RI + .4, Y(FL - .55)], [RI + .4, Y(FL - .35)]], 192, 0, TAU, 1, cy);
    g.shell.lathe([[RI + .4, Y(FL - .35)], [RI + .4, Y(FL)]], 192, 0, TAU, 1, cy);
    g.soff.lathe([[RO - 1.6, Y(SOF + .3)], [RO - 4, Y(SOF)], [RI + 3.6, Y(SOF)], [RI + 1.4, Y(SOF + .3)]], 256, 0, TAU, 96, cy);
    // 室內：石材地板、木格柵天花板（內外兩圈燈槽、兩排下照燈）
    g.floor.lathe([[RI + .4, Y(FL)], [RO - .4, Y(FL)]], 256, 0, TAU, 1, cy);
    g.ceil.lathe([[RO + .5, Y(RH)], [RI - .2, Y(RH)]], 256, 0, TAU, 256, cy);
    // 柱（12 根，避開三個門）、靠內圈玻璃的長椅、四道木格柵屏風、吧台
    for (const a of COLS) { const c = Math.cos(a), s = Math.sin(a); g.steel.box(cx + c * 33.4, (FL + RH) / 2, cz + s * 33.4, .2, (RH - FL) / 2, .2, -a); g.ledW.box(cx + c * 33.13, FL + 2.6, cz + s * 33.13, .015, 1.6, .06, -a); }
    for (const a of BENCH) {
      const c = Math.cos(a), s = Math.sin(a), x = cx + c * 29.2, z = cz + s * 29.2, ry = -a + Math.PI / 2;
      g.wood.box(x, FL + .42, z, 1.6, .06, .3, ry); g.wood.box(x + c * .24, FL + .72, z + s * .24, 1.6, .26, .04, ry);   // 座面、靠背（面向內圈玻璃，看環心的雲）
      for (const e of [-1.35, 1.35]) g.steel.box(x - s * e, FL + .2, z + c * e, .04, .2, .26, ry);
    }
    for (const a of SCREEN) {
      const c = Math.cos(a), s = Math.sin(a);
      for (let k = 0; k <= 16; k++) { const r = 29.6 + k * .43; g.wood.box(cx + c * r, FL + 1.35, cz + s * r, .03, 1.35, .09, -a); }
      g.wood.box(cx + c * 33.04, FL + 2.74, cz + s * 33.04, 3.5, .04, .1, -a);
    }
    g.wood.lathe([[BAR.r0, Y(FL)], [BAR.r0, Y(FL + 1.02)]], 24, BAR.a0, BAR.a1, 1, cy);
    g.wood.lathe([[BAR.r1, Y(FL + 1.02)], [BAR.r1, Y(FL)]], 24, BAR.a0, BAR.a1, 1, cy);
    g.steel.lathe([[BAR.r0 - .12, Y(FL + 1.02)], [BAR.r0 - .12, Y(FL + 1.07)], [BAR.r1 + .12, Y(FL + 1.07)], [BAR.r1 + .12, Y(FL + 1.02)]], 24, BAR.a0 - .004, BAR.a1 + .004, 1, cy);
    g.ledW.lathe([[BAR.r0 - .01, Y(FL + .12)], [BAR.r0 - .01, Y(FL + .16)]], 24, BAR.a0, BAR.a1, 1, cy);
    for (const a of [BAR.a0, BAR.a1]) { const c = Math.cos(a), s = Math.sin(a), r = (BAR.r0 + BAR.r1) / 2; g.wood.box(cx + c * r, FL + .51, cz + s * r, (BAR.r1 - BAR.r0) / 2, .51, .03, -a); }
    // 懸挑平台（厚板＋燈帶＋玻璃欄杆）
    for (const [P, wide] of [[DECK, 1], [BALC, 0]]) {
      const a0 = P.th - P.half, a1 = P.th + P.half, segs = wide ? 64 : 28, r0 = wide ? RO - .4 : RO - .6;
      g.deck.lathe([[r0, Y(P.top)], [P.r1, Y(P.top)]], segs, a0, a1, wide ? 30 : 12, cy);
      g.dark.lathe([[P.r1, Y(P.top)], [P.r1, Y(P.bot)]], segs, a0, a1, 1, cy);
      g.soff.lathe([[P.r1, Y(P.bot)], [r0, Y(P.bot)]], segs, a0, a1, wide ? 34 : 12, cy);
      g.led.lathe([[P.r1 - .35, Y(P.top + .06)], [P.r1 - .35, Y(P.top + .14)]], segs, a0, a1, 1, cy);
      g.gl.lathe([[P.r1 - .25, Y(P.top)], [P.r1 - .25, Y(P.top + 1.15)]], segs, a0, a1, 1, cy);
      g.stru.lathe([[P.r1 - .25, Y(P.top + 1.15)], [P.r1 - .25, Y(P.top + 1.22)]], segs, a0, a1, 1, cy);
      for (const a of [a0, a1]) {   // 兩側的端面與欄杆
        const c = Math.cos(a), s = Math.sin(a), at = r => [cx + r * c, 0, cz + r * s];
        const pa = at(r0), pb = at(P.r1);
        g.dark.face([[pa[0], P.bot, pa[2]], [pb[0], P.bot, pb[2]], [pb[0], P.top, pb[2]], [pa[0], P.top, pa[2]]]);
        g.gl.face([[pa[0], P.top, pa[2]], [pb[0], P.top, pb[2]], [pb[0], P.top + 1.15, pb[2]], [pa[0], P.top + 1.15, pa[2]]]);
      }
      if (wide) for (let k = 0; k < 7; k++) { const a = a0 + (a1 - a0) * (k + .5) / 7; g.woodO.box(cx + Math.cos(a) * 49, P.top + .45, cz + Math.sin(a) * 49, .6, .45, 1.6, -a + Math.PI / 2); }   // 座椅
    }
    // 平台上的投幣望遠鏡（朝晚霞）
    for (const a of SCOPES) {
      const c = Math.cos(a), s = Math.sin(a), x = cx + c * 55.6, z = cz + s * 55.6;
      g.stru.tube([x, FL, z], [x, FL + 1.05, z], .06, 8);
      g.stru.tube([x - c * .3, FL + 1.18, z - s * .3], [x + c * .32, FL + 1.27, z + s * .32], .11, 10);
      g.dark.box(x, FL + 1.12, z, .08, .08, .08);
    }
    // 迴廊（玻璃管）：從環的東西兩側伸到山裡與車站（地板是同一種石材）
    const bridge = (x0, x1) => {
      const L = Math.abs(x1 - x0), m = (x0 + x1) / 2, hw = 2.3;
      g.dark.box(m, FL - .46, 0, L / 2, .45, hw + .1);
      g.floor.face([[Math.min(x0, x1), FL - .004, hw], [Math.max(x0, x1), FL - .004, hw], [Math.max(x0, x1), FL - .004, -hw], [Math.min(x0, x1), FL - .004, -hw]]);
      g.stru.box(m, FL - 1.4, 0, L / 2, .5, .7);   // 底下的主梁
      g.shell.box(m, FL + 4.05, 0, L / 2, .3, hw + .25);
      g.led.box(m, FL + .05, hw - .25, L / 2, .05, .06); g.led.box(m, FL + .05, -hw + .25, L / 2, .05, .06);
      g.led.box(m, FL + 3.68, 0, L / 2, .04, .12);
      for (const z of [hw, -hw]) g.gl.face([[x0, FL, z], [x1, FL, z], [x1, FL + 3.75, z], [x0, FL + 3.75, z]]);
      const n = Math.round(L / 3.2);
      for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n; for (const z of [hw, -hw]) g.stru.box(x, FL + 1.9, z, .09, 1.9, .09); g.stru.box(x, FL + 3.8, 0, .09, .08, hw); }
    };
    // 西側迴廊撞進岩塔（XF 是岩面），再往裡 6 m 藏在山裡；東側接到車站
    const xf = XF;
    bridge(-RO + .6, xf - 6); bridge(RO - .6, ST.x - ST.hx);
    g.portal.box(xf + .4, FL + 1.9, 0, .15, 1.85, 2.2);   // 山洞口的光
    SUMMIT.dims.xf = xf;
    // 斜撐：從環底伸進雲海
    for (const a of [.62, 2.52, 3.76, 5.66]) {
      const c = Math.cos(a), s = Math.sin(a), p0 = [cx + c * 33, SOF + .2, cz + s * 33], dir = V3(c * .5, -.86, s * .5).normalize();
      let L = 20; while (L < 320 && p0[1] + dir.y * L > H(p0[0] + dir.x * L, p0[2] + dir.z * L) - 4) L += 4;
      g.stru.tube(p0, [p0[0] + dir.x * L, p0[1] + dir.y * L, p0[2] + dir.z * L], 1.15, 14);
      g.stru.tube([cx + c * 30, SOF + .2, cz + s * 30], [cx + c * 36, SOF + .2, cz + s * 36], .9, 10);
    }
    // 車站（主峰的肩上）：石材基座、三面玻璃（西面是迴廊的門）、北面朝纜車線敞開（矮玻璃欄），屋頂下的迴轉輪、天線與紅色航空燈
    const { x: sx, z: sz, hx, hz, h: sh } = ST, sy = FL;
    g.stru.box(sx, sy - 14, sz, hx + .1, 14, hz + .1);
    g.shell.box(sx, sy + sh + .4, sz, hx + .4, .4, hz + .4);
    g.dark.box(sx, sy - .11, sz, hx + .2, .1, hz + .2);
    g.floor.face([[sx - hx, sy, sz + hz], [sx + hx, sy, sz + hz], [sx + hx, sy, sz - hz], [sx - hx, sy, sz - hz]]);
    // 玻璃的正面朝外（假房間畫在正面）：照 face() 的算法看法線朝哪邊，朝裡就翻過來
    const win = (P, us) => { const [a, b, c] = P, u = [0, 1, 2].map(i => b[i] - a[i]), v = [0, 1, 2].map(i => c[i] - a[i]), nx = u[1] * v[2] - u[2] * v[1], nz = u[0] * v[1] - u[1] * v[0];
      const mx = (a[0] + c[0]) / 2 - sx, mz = (a[2] + c[2]) / 2 - sz; g.stWin.face(P, nx * mx + nz * mz < 0, us, 1); };
    const W0 = sx - hx, X1 = sx + hx, Z0 = sz - hz, Z1 = sz + hz;
    win([[W0, sy, Z1], [W0, sy, 2.3], [W0, sy + sh, 2.3], [W0, sy + sh, Z1]], 3);
    win([[W0, sy, -2.3], [W0, sy, Z0], [W0, sy + sh, Z0], [W0, sy + sh, -2.3]], 1.4);
    win([[W0, sy + 4.35, 2.3], [W0, sy + 4.35, -2.3], [W0, sy + sh, -2.3], [W0, sy + sh, 2.3]], 1.5);
    win([[W0, sy, Z0], [X1, sy, Z0], [X1, sy + sh, Z0], [W0, sy + sh, Z0]], 7);
    { const d0 = STAIR.z - STAIR.door, d1 = STAIR.z + STAIR.door;   // 東面：中間是通往東稜步道的門（上面一段氣窗）
      win([[X1, sy, Z0], [X1, sy, d0], [X1, sy + sh, d0], [X1, sy + sh, Z0]], 2); win([[X1, sy, d1], [X1, sy, Z1], [X1, sy + sh, Z1], [X1, sy + sh, d1]], 4);
      win([[X1, sy + 2.7, d0], [X1, sy + 2.7, d1], [X1, sy + sh, d1], [X1, sy + sh, d0]], 1);
      for (const z of [d0, d1]) g.dark.box(X1, sy + 1.35, z, .09, 1.35, .07);
      g.dark.box(X1, sy + 2.7, STAIR.z, .1, .07, STAIR.door); }
    g.gl.face([[X1, sy, Z1], [W0, sy, Z1], [W0, sy + 1.15, Z1], [X1, sy + 1.15, Z1]]);   // 北面：矮玻璃欄
    g.stru.box(sx, sy + 1.2, Z1, hx, .04, .05);
    for (const x of [W0, X1]) for (const z of [Z0, Z1]) g.dark.box(x, sy + sh / 2, z, .22, sh / 2, .22);   // 角柱
    g.dark.box(sx, sy + sh - .3, Z1, hx, .3, .2);   // 北面的大梁
    for (let k = 0; k < 4; k++) g.ledW.box(sx, sy + sh - .02, sz - 6 + k * 4, hx - 1, .02, .08);   // 天花板的燈條
    g.dark.box(W0 - .1, sy + 4.5, 0, .2, .15, 2.45);   // 迴廊門的門楣
    // 月台：車廂停靠那一側的黃線、驗票閘門、候車長椅
    { const q = cblAt(CAB_DOCK, 1, V3()).addScaledVector(V3(CBL.dz, 0, -CBL.dx), 1.9), ry = -CBL.dir;
      g.ledW.box(q.x, sy + .005, q.z, 3.2, .005, .05, ry);
      for (let k = -1; k <= 1; k++) { const x = sx - 4 + k * 1.6, z = sz - 1.5; g.steel.box(x, sy + .5, z, .08, .5, .45); g.ledW.box(x, sy + 1.02, z - .3, .06, .02, .1); }
      g.wood.box(sx + 6, sy + .42, sz - 5.6, 2.2, .06, .3); g.wood.box(sx + 6, sy + .72, sz - 5.9, 2.2, .26, .04);
      for (const e of [-1.9, 1.9]) g.steel.box(sx + 6 + e, sy + .2, sz - 5.6, .04, .2, .26); }
    // 迴轉輪（水平的大輪，索從兩側出去）：輪緣、輪輻、輪轂，吊在屋頂的鋼架下
    { const { x: wx, y: wy, z: wz, off } = CBL;
      g.stru.lathe([[off - .25, -.18], [off - .25, .18], [off + .12, .18], [off + .12, -.18], [off - .25, -.18]], 72, 0, TAU, 1, wy, wx, wz);
      for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; g.stru.tube([wx, wy, wz], [wx + Math.cos(a) * (off - .2), wy, wz + Math.sin(a) * (off - .2)], .07, 6); }
      g.stru.tube([wx, wy - .5, wz], [wx, sy + sh, wz], .32, 12);
      g.dark.box(wx, sy + sh - .15, wz, 3.2, .15, .35); }
    // 纜索：上行、下行兩條，每 24 m 一段（照垂度），延伸到雲海裡
    for (const side of [1, -1]) { const a = V3(), b = V3(); for (let d = 0; d < CBL.len; d += 24) { cblAt(d, side, a); cblAt(Math.min(d + 24, CBL.len), side, b); g.rope.tube(a.toArray(), b.toArray(), .05, 5); } }
    g.stru.tube([sx + 5, sy + sh + .8, sz - 3], [sx + 5, sy + 24, sz - 3], .25, 8);
    g.beacon.box(sx + 5, sy + 24.4, sz - 3, .35, .35, .35);
    { let bx = -82, bz = 8, bh = -1e9; for (let x = -100; x <= -64; x += 2) for (let z = -10; z <= 26; z += 2) { const h = H(x, z); if (h > bh) { bh = h; bx = x; bz = z; } }   // 岩塔的最高點：小天線與航空燈
      g.stru.tube([bx, bh - 6, bz], [bx, bh + 9, bz], .2, 6); g.beacon.box(bx, bh + 9.3, bz, .32, .32, .32); }
    trailBuild(g);
    const out = new T.Group(), add = (geo, m, ro = 0) => { if (!geo.p.length) return; const o = new T.Mesh(geo.build(), m); o.renderOrder = ro; out.add(o); return o; };
    add(g.roof, Mt.roof); add(g.shell, Mt.metal([.15, .155, .165])); add(g.soff, Mt.soffit); add(g.led, Mt.emi(1, .64, .32, 3)); add(g.ledI, Mt.emi(1, .64, .32, 1.6)); add(g.ledS, Mt.emi(1, .7, .42, 1.8));
    add(g.deck, Mt.deck); add(g.dark, Mt.metal([.03, .03, .034], { spec: .5 })); add(g.stru, Mt.metal([.045, .047, .05], { spec: .6 })); add(g.rope, Mt.metal([.02, .02, .022], { spec: .9 }));
    add(g.floor, Mt.floorIn); add(g.ceil, Mt.ceilIn); add(g.wood, Mt.wood()); add(g.woodO, Mt.wood(true)); add(g.steel, Mt.steelIn); add(g.ledW, Mt.emi(1, .7, .45, 2.4));
    add(g.gOut, Mt.curtain(2 * Math.PI * RO / NOUT, RH - FL, 7.5, { seed: 0 }), 2);
    add(g.gIn, Mt.curtain(2 * Math.PI * RI / NIN, RH - FL, 6, { seed: 31, k: .9 }), 2);
    add(g.stWin, Mt.curtain(3, sh, 9, { seed: 77, k: 1.1 }), 2);
    add(g.portal, Mt.emi(1, .6, .3, 3)); add(g.beacon, Mt.beacon);
    add(g.pole, Mt.paint([.62, .16, .03], { spec: .5 })); add(g.refl, Mt.emi(1, .42, .12, 1.4)); add(g.conc, Mt.paint([.42, .41, .39], { spec: .15, f0: .02 })); add(g.rock, Mt.paint([.05, .05, .055], { spec: .2, f0: .02 }));
    const ink = (ctx, w, h, title, sub, foot) => {
      ctx.fillStyle = '#5a3a20'; ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 3) { ctx.fillStyle = `rgba(30,16,6,${.08 + .08 * Math.sin(y * .7 + Math.sin(y * .13) * 3)})`; ctx.fillRect(0, y, w, 2); }   // 木紋
      ctx.strokeStyle = '#2a170a'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, w - 10, h - 10);
      ctx.fillStyle = '#f2e6cc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `600 ${h * .3}px "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif`; ctx.fillText(title, w / 2, h * .34);
      ctx.font = `500 ${h * .13}px "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif`; ctx.fillStyle = '#e8c890'; ctx.fillText(sub, w / 2, h * .64);
      ctx.font = `500 ${h * .085}px -apple-system,"Segoe UI",sans-serif`; ctx.fillStyle = '#cdb894'; ctx.fillText(foot, w / 2, h * .84);
    };
    add(g.signA, Mt.sign((c, w, h) => ink(c, w, h, '東稜步道', `觀景台 ${Math.round(TR.len / 10) * 10} m · 上升 ${Math.round(TR.ey - FL + 2)} m`, 'EAST RIDGE TRAIL · 雪地請走標桿之間')));
    add(g.signB, Mt.sign((c, w, h) => ink(c, w, h, '東稜觀景台', `海拔 ${(3900 + Math.round((TR.ey - FL) / 5) * 5).toLocaleString()} m`, 'EAST RIDGE VIEWPOINT · 往下是峰頂觀景環')));
    add(g.gl, Mt.glass(.03), 3);
    return out;
  }
  // 纜車廂：原點在索上的握索器，x 沿索往前、z 橫向；車殼是八角的稜柱（下裙、窗帶、上緣、斜邊的頂）
  function cabin(Mt) {
    const g = { body: new Geo(), win: new Geo(), dark: new Geo(), led: new Geo() }, h = CBL.hang, top = -h, bot = top - 2.5;
    const W = 1.25, D = 1.05, ch = .38, P = [[W, D - ch], [W - ch, D], [-W + ch, D], [-W, D - ch], [-W, -D + ch], [-W + ch, -D], [W - ch, -D], [W, -D + ch]];
    g.body.prism(P, bot - .12, bot, .18, 0, -1);
    g.body.prism(P, bot, bot + 1.02);
    g.led.prism(P.map(([x, z]) => [x * 1.006, z * 1.006]), bot + 1.02, bot + 1.07);
    g.win.prism(P, bot + 1.07, top - .3, 0, 0, 0, 1);
    g.body.prism(P, top - .3, top);
    g.body.prism(P, top, top + .22, 0, .4, 1);
    // 吊臂（從車頂中間往上，在握索器那裡往前彎）、握索器與兩顆滑輪
    g.dark.tube([0, top + .2, 0], [0, -1.1, 0], .07, 8); g.dark.tube([0, -1.1, 0], [.25, -.28, 0], .07, 8);
    g.dark.box(.25, -.12, 0, .5, .14, .12);
    for (const x of [-.12, .62]) g.dark.tube([x, .02, -.16], [x, .02, .16], .13, 10);
    const o = new T.Group();
    for (const [geo, m] of [[g.body, Mt.paint([.6, .58, .54])], [g.win, Mt.cabWin], [g.dark, Mt.metal([.03, .03, .034], { spec: .6 })], [g.led, Mt.emi(1, .7, .45, 2.4)]]) o.add(new T.Mesh(geo.build(), m));
    return o;
  }
  // 車廂擺到索上 d 公尺處（side 那條），沿著索的方向，掛著時微微擺
  function cabinAt(o, d, side, sway = 0) {
    cblAt(d, side, o.position);
    o.rotation.set(0, -CBL.dir, 0, 'YXZ'); o.rotation.z = sway;
  }

  // ─── 運鏡：10 個關鍵點、每 4.5 秒一個，閉合的 Catmull-Rom（位置、注視點、水平視角各一條） ───
  const KEYS = [
    [[36, 192, 290], [0, 150, 0], 46],          // 遠景：晚霞在環的後面
    [[26, 190, 205], [0, 149, -4], 50],
    [[14, 198, 126], [0, 146, -8], 56],         // 推近
    [[8, 246, 64], [0, 148, -4], 62],           // 升到環的上方，整圈與中間的雲
    [[1, 192, 7], [0, 104, -14], 74],           // 從環的正上方往下
    [[-2, 128, -10], [-4, 127, -62], 76],       // 穿過環心，轉向晚霞
    [[-5, 137, -32], [-6, 144, -110], 72],      // 貼著平台底下掠過（頭頂是平台的下照燈）
    [[-22, 140, -104], [-70, 160, -190], 60],   // 飛出平台、往左甩
    [[-235, 214, -165], [0, 150, 0], 48],       // 回頭：岩塔在前、環在後
    [[-200, 240, 300], [0, 150, 0], 46],        // 拉回全景
  ];
  const cv = i => new T.CatmullRomCurve3(KEYS.map(k => i < 2 ? V3(...k[i]) : V3(k[2], 0, 0)), true, 'centripetal');
  const curP = cv(0), curL = cv(1), curF = cv(2);
  const _p = V3(), _l = V3(), _a = V3(), _b = V3();
  function camAt(cam, t) {
    const u = ((t / SM_LOOP) % 1 + 1) % 1;
    curP.getPoint(u, _p); curL.getPoint(u, _l);
    // 手持的微晃
    const k = .35 + .65 * sstep(0, 1, Math.abs(Math.sin(u * Math.PI)));
    _p.x += Math.sin(t * .71) * .22 * k; _p.y += Math.sin(t * 1.13 + 1) * .16 * k; _l.x += Math.sin(t * .53 + 2) * .5 * k; _l.y += Math.sin(t * .87) * .35 * k;
    cam.position.copy(_p); cam.up.set(0, 1, 0); cam.lookAt(_l);
    // 轉彎時微微壓坡
    const e = .004; curP.getPoint((u + e) % 1, _a); curP.getPoint((u + 1 - e) % 1, _b);
    const vx = _a.x - _b.x, vz = _a.z - _b.z, ax = _a.x + _b.x - 2 * curP.getPoint(u, V3()).x, az = _a.z + _b.z - 2 * curP.getPoint(u, V3()).z;
    const sp = Math.hypot(vx, vz) + 1e-3, roll = clamp((vx * az - vz * ax) / (sp * sp * sp) * 9, -.14, .14);
    cam.rotateZ(roll);
    const hf = curF.getPoint(u, _a).x * Math.PI / 180, asp = cam.aspect;
    cam.fov = Math.min(2 * Math.atan(Math.tan(hf / 2) / Math.max(asp, .82)) * 180 / Math.PI, 82);
    cam.updateProjectionMatrix();
  }
  SUMMIT.path = (t, cam = new T.PerspectiveCamera(50, 1.6, 1, 10)) => { camAt(cam, t); return cam.position.toArray(); };

  // ─── 場景：場館 'summit' 的 scene 開場就建好（空的），第一次搭纜車或打開電影場景時才填內容 ───
  const SCN = new T.Scene();
  let S = null;
  const scam = new T.PerspectiveCamera(45, innerWidth / innerHeight, .9, 52000);
  async function build(prog) {
    prog(.02, '計算雲的雜訊…'); await yieldUI();
    const tex = { noise: tileTex(256, 7123) }; prog(.08, '計算山體高度圖…'); await yieldUI();
    tex.hm = heightTex(); await yieldUI();
    const Mt = mats(tex), scene = SCN;
    const sky = new T.Mesh(new T.SphereGeometry(42000, 64, 32), Mt.sky); sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
    const tg = await terrainGeo(f => prog(.12 + f * .7, '堆起雪山…'));
    const ter = new T.Mesh(tg, Mt.terrain); ter.frustumCulled = false; scene.add(ter);
    prog(.85, '架起觀景環…'); await yieldUI();
    scene.add(building(Mt));
    const cabA = cabin(Mt), cabB = cabA.clone(); scene.add(cabA, cabB);
    const cl = new T.Mesh(new T.CircleGeometry(30000, 128).rotateX(-Math.PI / 2), Mt.clouds); cl.position.y = SM_CT; cl.renderOrder = 1; cl.frustumCulled = false; scene.add(cl);
    // 雪：三層開口圓筒（半徑 6、14、30 m）跟著相機
    const snow = new T.Group(); snow.visible = false;
    for (const [r, h] of [[6, 16], [14, 32], [30, 60]]) { const m = new T.Mesh(new T.CylinderGeometry(r, r, h, 48, 1, true), Mt.flakes); m.renderOrder = 4; m.frustumCulled = false; snow.add(m); }
    scene.add(snow);
    S = { scene, sky, ter, cl, cabA, cabB, snow, Mt };
    prog(.9, '編譯著色器…');
    skyState(true); Mt.apply(); snow.visible = true;
    camAt(scam, 0);
    await Promise.race([gfxCompile(scene, scam, true), new Promise(r => setTimeout(r, 20000))]);
    snow.visible = false;
    SUMMIT.built = true;
  }
  // 每幀：天色、跟著相機的天空球／雲盤／雪、時間；車廂的位置（電影與搭車時一上一下地跑，在山上時一台停在站裡、一台停在線上）
  function sceneTick(cam, fixed, cineT) {
    skyState(fixed); S.Mt.apply();
    S.sky.position.copy(cam.position); S.cl.position.set(cam.position.x, SM_CT, cam.position.z);
    S.snow.position.copy(cam.position); S.snow.visible = SKY.snow > .01;
    const U = S.Mt.U, now = performance.now() / 1000;
    U.t.value = now; U.cl.value = (cineT ?? SUMMIT.vt) + 600;
    U.blink.value = Math.pow(Math.max(0, Math.sin(now * Math.PI * 1.1)), 18);
    U.pa.value = 2 * Math.tan(cam.fov * Math.PI / 360) / Math.max(rtScene.height, 1);
    if (cineT != null) {
      const u = ((cineT / SM_LOOP) % 1 + 1) % 1;
      cabinAt(S.cabA, lerp(CBL.len, CAB_DOCK, 1 - Math.pow(1 - u, 1.7)), 1, Math.sin(now * 1.3) * .012);   // 進站前慢下來
      cabinAt(S.cabB, lerp(CAB_DOCK, CBL.len, Math.pow(u, 1.7)), -1, Math.sin(now * 1.1 + 1) * .012);
    } else { cabinAt(S.cabA, CAB_DOCK, 1); cabinAt(S.cabB, 330, -1, Math.sin(now * .8) * .02); }
  }

  // ─── 電影與搭車的畫面（照 70-render.js 的 renderFrame：場景 → 泛光 → 合成，城市的效果歸零） ───
  const vpCur = new T.Matrix4(), vpPrev = new T.Matrix4();
  let snap = true;
  function render(t) {
    const w0 = R.domElement.width, h0 = R.domElement.height;
    scam.aspect = w0 / Math.max(h0, 1);
    camAt(scam, SUMMIT.t);
    sceneTick(scam, SUMMIT.from === 'start', SUMMIT.t);
    scam.updateMatrixWorld();
    R.setRenderTarget(rtScene); R.setClearColor(0x000000, 1); R.clear();
    R.render(S.scene, scam);
    const w = rtScene.width, h = rtScene.height;
    mPre.uniforms.tSrc.value = rtScene.texture; mPre.uniforms.uTexel.value.set(1 / w, 1 / h); mPre.uniforms.uThr.value = 1.15 / Math.max(SKY.v.exp, .3); blit(mPre, rtB[0]);   // 泛光門檻照曝光換算（白天曝光低、場景值高，不然陽光下的雪整片泛白）
    for (let i = 1; i < rtB.length; i++) { mDown.uniforms.tSrc.value = rtB[i - 1].texture; mDown.uniforms.uTexel.value.set(1 / rtB[i - 1].width, 1 / rtB[i - 1].height); blit(mDown, rtB[i]); }
    const last = rtB.length - 1;
    for (let i = last - 1; i >= 0; i--) {
      mUp.uniforms.tSrc.value = (i === last - 1 ? rtB[last] : rtU[i + 1]).texture; mUp.uniforms.tAdd.value = rtB[i].texture;
      mUp.uniforms.uTexel.value.set(1 / rtB[i].width, 1 / rtB[i].height); mUp.uniforms.uK.value = 1;
      blit(mUp, rtU[i]);
    }
    vpCur.multiplyMatrices(scam.projectionMatrix, scam.matrixWorldInverse);
    if (snap) { vpPrev.copy(vpCur); snap = false; }
    const u = mComp.uniforms;
    u.uVolOn.value = 0; u.uAOOn.value = 0; u.uEyeOn.value = 0;
    u.tScene.value = rtScene.texture; u.tDepth.value = rtScene.depthTexture; u.tBloom.value = rtU[0].texture;
    u.uInvVP.value.copy(vpCur).invert(); u.uPrevVP.value.copy(vpPrev);
    u.uBlur.value = SUMMIT.freeze ? 0 : post.blur * .6; u.uExp.value = 1.22 * SET.bright * SKY.v.exp; u.uTime.value = t; u.uWob.value = 0; u.uFlash.value = 0;
    u.uBloomK.value = .95 * SET.bloom; u.uHi.value.set(0, 1);
    u.uFx.value.set(SET.ca ? 1 : 0, SET.grain ? 1 : 0);
    u.uGray.value = 0; u.uVig.value = 0; u.uHurt.value = 0; u.uTint.value.set(1, 1, 1, 0); u.uFx7.value.set(0, 0, 0, 0);
    for (const q of u.uHeat.value) q.w = 0;
    u.uRes.value.set(w, h);
    blit(mComp, null);
    vpPrev.copy(vpCur);
  }

  // ─── 聲音：風（三層濾波噪音＋口哨般的共鳴）與 45 秒循環的配樂（和弦鋪底、低音、FM 鐘聲旋律、穿過環心時的閃爍琶音） ───
  // mode：'film'（電影、搭車：整段配樂）或 'venue'（在山上走：配樂小聲、只有和弦與鐘聲，風在室內悶掉）；inK 是在室內的程度
  const AU = { A: null, bus: null, mus: null, amb: null, rev: null, srcs: new Set(), wind: null, base: 0, until: 0, on: false, mode: 'film', inK: 0 };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const CHORDS = [[38, 45, 53, 57, 60, 64], [34, 46, 50, 53, 57, 60], [33, 45, 48, 52, 57, 64], [36, 43, 50, 55, 59, 62]];   // Dm9、B♭maj9、Fmaj7/A、Cmaj9(no3)/G 風
  const MEL = [[1.2, 69], [2.9, 74], [4.5, 76], [7.1, 77], [8.8, 76], [12.3, 74], [14.1, 72], [15.9, 69], [23.4, 76], [25.2, 81], [27.1, 79], [29.2, 76], [34.6, 79], [36.4, 76], [38.3, 74], [41.5, 69]];
  const ARP = [86, 93, 89, 88, 86, 93, 91, 88, 86, 81];   // 18–20 秒穿過環心
  function irBuf(A, sec) {
    const n = A.sampleRate * sec | 0, b = A.createBuffer(2, n, A.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++) { lp = lp * .55 + (Math.random() * 2 - 1) * .45; d[i] = lp * Math.pow(1 - i / n, 3.2) * (i < 200 ? i / 200 : 1); } }
    return b;
  }
  function noiseBuf(A) { const n = A.sampleRate * 4, b = A.createBuffer(2, n, A.sampleRate); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; } return b; }
  const track = s => { AU.srcs.add(s); s.onended = () => { AU.srcs.delete(s); try { s.disconnect(); } catch (e) {} }; return s; };
  function auStart(mode = AU.mode) {
    if (AU.on && AU.mode !== mode) { AU.mode = mode; sfx.summit(true, mode === 'venue'); }
    AU.mode = mode;
    if (AU.on || !sfx.ready) return;
    const S0 = sfx.summit(true, mode === 'venue'); if (!S0) return;
    const A = AU.A = S0.ac; if (A.state === 'suspended') A.resume();
    AU.bus = A.createGain(); AU.bus.gain.value = 0; AU.bus.connect(S0.out); AU.bus.gain.setTargetAtTime(1, A.currentTime, .5);
    AU.mus = A.createGain(); AU.mus.gain.value = SET.vMusic * .8; AU.mus.connect(AU.bus);
    AU.amb = A.createGain(); AU.amb.gain.value = SET.vAmb; AU.amb.connect(AU.bus);
    AU.rev = A.createConvolver(); AU.rev.buffer = irBuf(A, 5.5); const rg = A.createGain(); rg.gain.value = .7; AU.rev.connect(rg); rg.connect(AU.mus);
    // 風：低沉的風壓、中頻的呼嘯、窄頻的口哨（左右各一）
    const nb = noiseBuf(A), mk = (type, f, Q, g0) => { const s = track(A.createBufferSource()); s.buffer = nb; s.loop = true; s.loopStart = Math.random(); const f1 = A.createBiquadFilter(); f1.type = type; f1.frequency.value = f; f1.Q.value = Q; const g = A.createGain(); g.gain.value = g0; s.connect(f1); f1.connect(g); s.start(A.currentTime, Math.random() * 3); return { s, f: f1, g }; };
    const W = AU.wind = { lo: mk('lowpass', 260, .7, 0), mid: mk('bandpass', 700, .6, 0), w1: mk('bandpass', 820, 18, 0), w2: mk('bandpass', 1240, 22, 0) };
    const pL = A.createStereoPanner(), pR = A.createStereoPanner(); pL.pan.value = -.6; pR.pan.value = .6;
    W.lo.g.connect(AU.amb); W.mid.g.connect(AU.amb); W.w1.g.connect(pL); W.w2.g.connect(pR); pL.connect(AU.amb); pR.connect(AU.amb); W.mid.g.connect(AU.rev);
    AU.base = A.currentTime - SUMMIT.t; AU.until = SUMMIT.t - .01; AU.on = true;   // 往前一點：剛好落在這一刻的事件（第 0 秒的和弦）也排得到
  }
  function auStop() {
    if (!AU.on) return;
    const A = AU.A, t = A.currentTime;
    AU.bus.gain.setTargetAtTime(0, t, .12);
    for (const s of AU.srcs) { try { s.stop(t + .4); } catch (e) {} }   // 歸零 0.4 s 後停掉來源（CLAUDE.md 的規則）
    const bus = AU.bus; setTimeout(() => { try { bus.disconnect(); } catch (e) {} }, 700);
    AU.on = false; AU.wind = null; sfx.summit(false);
  }
  const env = (g, t, a, peak, hold, rel) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(.0001, t + a + hold + rel); g.gain.setValueAtTime(0, t + a + hold + rel + .01); };
  function pad(t, notes, dur) {
    const A = AU.A, g = A.createGain(), f = A.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = .5;
    f.frequency.setValueAtTime(380, t); f.frequency.linearRampToValueAtTime(1500, t + dur * .45); f.frequency.linearRampToValueAtTime(520, t + dur + 3);
    env(g, t, 2.8, .05, dur - 2.8, 3.6); f.connect(g); g.connect(AU.mus); g.connect(AU.rev);
    notes.forEach((m, i) => { for (const dt of [-7, 6]) { const o = track(A.createOscillator()); o.type = i === 0 ? 'triangle' : 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = dt + (i % 2 ? 3 : -2); o.connect(f); o.start(t); o.stop(t + dur + 4); } });
    const b = track(A.createOscillator()), bg = A.createGain(); b.type = 'sine'; b.frequency.value = mtof(notes[0] - 12); env(bg, t, 1.6, .16, dur - 1.6, 3); b.connect(bg); bg.connect(AU.mus); b.start(t); b.stop(t + dur + 4);
  }
  function bell(t, m, k = 1) {
    const A = AU.A, f = mtof(m), c = track(A.createOscillator()), mo = track(A.createOscillator()), mg = A.createGain(), g = A.createGain(), p = A.createStereoPanner();
    c.frequency.value = f; mo.frequency.value = f * 3.5; mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * .05, t + 2.5);
    mo.connect(mg); mg.connect(c.frequency); env(g, t, .006, .055 * k, .05, 3.4); p.pan.value = Math.sin(m * 1.7) * .4;
    c.connect(g); g.connect(p); p.connect(AU.mus); p.connect(AU.rev); c.start(t); mo.start(t); c.stop(t + 4); mo.stop(t + 4);
  }
  function swell(t, dur) {   // 穿過環心前的上揚噪音
    const A = AU.A, s = track(A.createBufferSource()), f = A.createBiquadFilter(), g = A.createGain();
    s.buffer = AU.wind.lo.s.buffer; f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(5200, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.05, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + .5);
    s.connect(f); f.connect(g); g.connect(AU.rev); g.connect(AU.mus); s.start(t); s.stop(t + dur + .6);
  }
  function boom(t) {
    const A = AU.A, o = track(A.createOscillator()), g = A.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(62, t); o.frequency.exponentialRampToValueAtTime(34, t + 3); env(g, t, .05, .22, .2, 3.2); o.connect(g); g.connect(AU.mus); g.connect(AU.rev); o.start(t); o.stop(t + 4);
  }
  const EVENTS = [];
  CHORDS.forEach((c, i) => EVENTS.push([i * SM_LOOP / 4, at => pad(at, c, SM_LOOP / 4 + .6)]));
  MEL.forEach(([t, m]) => EVENTS.push([t, at => bell(at, m, AU.mode === 'venue' ? .5 : 1)]));
  ARP.forEach((m, i) => EVENTS.push([18.1 + i * .19, at => bell(at, m, .45), 1]));   // 第三個值 1：只在電影與搭車時（穿過環心的那一段）
  EVENTS.push([15.2, at => swell(at, 2.9), 1], [0, at => boom(at), 1]);
  EVENTS.sort((a, b) => a[0] - b[0]);
  function auUpdate(dt, spd) {
    if (!AU.on) return;
    const A = AU.A, now = A.currentTime;
    if (!SUMMIT.freeze) {
      const hz = SUMMIT.t + .35;
      for (let k = Math.floor(AU.until / SM_LOOP); k <= Math.floor(hz / SM_LOOP); k++) for (const [et, fn, cine] of EVENTS) {
        if (cine && AU.mode === 'venue') continue;
        const T_ = k * SM_LOOP + et;
        if (T_ > AU.until && T_ <= hz) fn(AU.base + T_);
      }
      AU.until = hz;
    }
    // 風：慢的陣風＋相機速度
    // 下雪、陰天時風大；在室內（環、迴廊、車站裡）風聲小、高頻悶掉
    const t = SUMMIT.t, st = SKY.snow * .6 + SKY.oc * .2, gust = .5 + .32 * Math.sin(t * .37) + .18 * Math.sin(t * 1.13 + 2) + .1 * Math.sin(t * 2.9) + st * .4, v = clamp(spd / 30, 0, 1), W = AU.wind;
    const ik = 1 - AU.inK * .72, hk = 1 - AU.inK * .85;
    W.lo.g.gain.setTargetAtTime(.5 * (.55 + .45 * gust) * ik, now, .3); W.lo.f.frequency.setTargetAtTime((180 + 160 * gust + 120 * v) * (1 - AU.inK * .4), now, .4);
    W.mid.g.gain.setTargetAtTime((.1 + .2 * gust * gust + .16 * v) * hk, now, .25); W.mid.f.frequency.setTargetAtTime(520 + 520 * gust + 600 * v, now, .3);
    W.w1.g.gain.setTargetAtTime((.25 * Math.max(0, gust - .45) + .05 * v) * hk, now, .5); W.w1.f.frequency.setTargetAtTime(760 + 220 * Math.sin(t * .21), now, .6);
    W.w2.g.gain.setTargetAtTime(.18 * Math.max(0, .8 - gust) * gust * hk, now, .5); W.w2.f.frequency.setTargetAtTime(1150 + 260 * Math.sin(t * .17 + 1), now, .6);
    AU.mus.gain.setTargetAtTime(SET.vMusic * (AU.mode === 'venue' ? .38 : .8), now, .2); AU.amb.gain.setTargetAtTime(SET.vAmb, now, .2);
  }

  // ─── 介面 ───
  const css = document.createElement('style');
  css.textContent = `
#smUI{position:fixed;inset:0;z-index:9000;pointer-events:none;display:none;color:#efe7dc;font:inherit}
body.smOn #smUI{display:block}
body.smOn>*:not(#stage):not(#smUI):not(script):not(style){visibility:hidden!important}
#smUI .bar{position:absolute;left:0;right:0;height:0;background:#000;transition:height .8s var(--ease-out,ease)}
#smBarT{top:0}#smBarB{bottom:0}
#smTitle{position:absolute;left:clamp(18px,5vw,64px);bottom:calc(var(--smBar,0px) + clamp(22px,6vh,64px));opacity:0;transform:translateY(8px);transition:opacity 1.4s ease,transform 1.4s ease;text-shadow:0 1px 12px #000a}
#smTitle.on{opacity:1;transform:none}
#smTitle b{display:block;font-size:clamp(24px,3.2vw,40px);font-weight:600;letter-spacing:.18em}
#smTitle span{display:block;margin-top:6px;font-size:clamp(11px,1vw,13px);letter-spacing:.32em;opacity:.75}
#smHint{position:absolute;right:clamp(14px,3vw,32px);top:calc(var(--smBar,0px) + 14px);font-size:12px;letter-spacing:.06em;opacity:0;transition:opacity .6s;text-shadow:0 1px 6px #000}
#smHint.on{opacity:.8}
#smBack{position:absolute;left:14px;top:calc(var(--smBar,0px) + 10px);pointer-events:auto;border:1px solid #efe7dc66;background:#0006;color:#efe7dc;border-radius:3px;padding:7px 14px;font:inherit;font-size:13px;opacity:0;transition:opacity .6s}
#smBack.on{opacity:1}
#smVeil{position:absolute;inset:0;background:#05060a;display:grid;place-items:center;opacity:1;transition:opacity .7s ease;pointer-events:auto}
#smVeil.off{opacity:0;pointer-events:none}
#smLoad{font-size:13px;letter-spacing:.14em;opacity:.8}
#smSnd{position:absolute;left:50%;bottom:calc(var(--smBar,0px) + 18px);transform:translateX(-50%);font-size:12px;letter-spacing:.1em;opacity:0;transition:opacity .6s;text-shadow:0 1px 6px #000}
#smSnd.on{opacity:.85}
#goSm{display:block;margin:12px auto 0;border:1px solid #ffffff38;border-radius:3px;padding:9px 20px;background:transparent;color:inherit;font:inherit;font-size:13px;letter-spacing:.06em;transition:background var(--dur-hover,.15s),border-color var(--dur-hover,.15s)}
#goSm:hover:not(:disabled){background:#ffffff14;border-color:#ffffff70}
#goSm:disabled{opacity:.35;cursor:default}`;
  document.head.appendChild(css);
  const ui = document.createElement('div'); ui.id = 'smUI'; ui.setAttribute('aria-hidden', 'true');
  ui.innerHTML = `<div class="bar" id="smBarT"></div><div class="bar" id="smBarB"></div>
<div id="smTitle"><b>峰頂觀景環</b><span id="smSub">SUMMIT RING · 暮色 · 雲海之上 3,900 m</span></div>
<div id="smHint"></div><button id="smBack" type="button">返回</button>
<div id="smSnd">點一下畫面開啟聲音</div><div id="smVeil"><span id="smLoad">雪山場景準備中…</span></div>`;
  document.body.appendChild(ui);
  const go2 = document.createElement('button'); go2.id = 'goSm'; go2.type = 'button'; go2.disabled = true; go2.textContent = '峰頂觀景環 · 電影場景';
  $('go').insertAdjacentElement('afterend', go2);
  go2.addEventListener('click', () => { sfx.init(); SUMMIT.open(); });
  $('smBack').addEventListener('click', e => { e.stopPropagation(); SUMMIT.close(); });
  ui.addEventListener('pointerdown', () => { if (SUMMIT.on) { sfx.init(); auStart(); $('smSnd').classList.remove('on'); SUMMIT.hintT = 4; } });
  addEventListener('pointermove', () => { if (SUMMIT.on) SUMMIT.hintT = 3; });
  const bars = () => {
    const w = innerWidth, h = innerHeight, b = SUMMIT.wide && w / h > 1.25 ? Math.max(0, (h - w / 2.39) / 2) : 0;
    $('smBarT').style.height = $('smBarB').style.height = b + 'px'; ui.style.setProperty('--smBar', b + 'px');
  };
  addEventListener('resize', () => { if (SUMMIT.on) bars(); });
  // 按鍵：在捕獲階段攔下（開始畫面時城市的按鍵處理不跑，遊戲中也不讓按鍵漏到城市）。搭車時 Esc、空白鍵、Enter 跳過
  addEventListener('keydown', e => {
    if (!SUMMIT.on) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (e.repeat) return;
    sfx.init(); auStart(); $('smSnd').classList.remove('on'); SUMMIT.hintT = 3;
    if (e.code === 'Escape' || e.code === 'Backspace' || SUMMIT.mode === 'ride' && (e.code === 'Space' || e.code === 'Enter')) SUMMIT.close();
    else if (e.code === 'KeyC') { SUMMIT.wide = !SUMMIT.wide; bars(); }
    else if (e.code === 'KeyM') sfx.setMuted(!sfx.muted);
  }, true);
  addEventListener('keyup', e => { if (SUMMIT.on) e.stopImmediatePropagation(); }, true);

  const veil = on => $('smVeil').classList.toggle('off', !on);
  const WX_N = { clear: '晴', cloudy: '多雲', overcast: '陰', drizzle: '飄雪', rain: '下雪', storm: '暴風雪', fog: '濃霧' };
  const subtitle = () => {
    if (SUMMIT.from === 'start') return 'SUMMIT RING · 暮色 · 雲海之上 3,900 m';
    const h = Math.floor(clockSt.min / 60), m = clockSt.min % 60;
    return `北嶺纜車 · 山頂站 · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} · ${WX_N[wx.cur] || ''} · 雲海之上 3,900 m`;
  };
  // 打開電影場景（mode 'film'：開始畫面固定暮色、遊戲中跟著時間與天氣，Esc 返回）或搭纜車上山（'ride'：播一遍運鏡，播完或跳過就到山頂站）
  async function openCine(mode) {
    if (SUMMIT.on || SUMMIT.busy) return;
    if (menu.on) menuClose();
    SUMMIT.busy = true; SUMMIT.mode = mode; SUMMIT.from = mode === 'ride' ? 'ride' : started ? 'game' : 'start';
    if (document.pointerLockElement) document.exitPointerLock();
    for (const k in keys) keys[k] = false;
    $('smLoad').textContent = mode === 'ride' ? '纜車出發…' : '雪山場景準備中…';
    $('smBack').textContent = mode === 'ride' ? '跳過' : '返回';
    $('smHint').textContent = isTouch ? '' : mode === 'ride' ? 'Esc／空白鍵 跳過 · C 寬銀幕 · M 靜音' : 'Esc 返回 · C 寬銀幕 · M 靜音';
    document.body.classList.add('smOn'); ui.setAttribute('aria-hidden', 'false'); veil(true); bars();
    if (!SUMMIT.built) {
      try { await build((f, msg) => { $('smLoad').textContent = `${msg || '雪山場景準備中…'} ${Math.round(f * 100)}%`; }); }
      catch (e) { console.error('峰頂場景建不起來', e); document.body.classList.remove('smOn'); SUMMIT.busy = false; return; }
    }
    if (SUMMIT.from === 'start') $('start').style.display = 'none';
    $('smSub').textContent = subtitle();
    SUMMIT.t = 0; SUMMIT.freeze = false; SUMMIT.last = performance.now(); SUMMIT.hintT = 5; snap = true;
    SUMMIT.on = true; SUMMIT.busy = false;
    if (sfx.ready) auStart('film'); else { AU.mode = 'film'; $('smSnd').classList.add('on'); }
    requestAnimationFrame(() => requestAnimationFrame(() => { veil(false); $('smTitle').classList.add('on'); setTimeout(() => $('smTitle').classList.remove('on'), 6500); }));
  }
  SUMMIT.open = () => openCine('film');
  SUMMIT.ride = () => openCine('ride');
  const uiOff = () => { SUMMIT.on = false; document.body.classList.remove('smOn'); ui.setAttribute('aria-hidden', 'true'); $('smTitle').classList.remove('on'); };
  SUMMIT.close = () => {
    if (!SUMMIT.on || SUMMIT.busy) return;
    SUMMIT.busy = true; veil(true);
    if (SUMMIT.mode === 'ride') { setTimeout(arrive, 650); return; }
    if (player.where === 'summit') auStart('venue'); else auStop();
    setTimeout(() => {
      uiOff(); SUMMIT.busy = false;
      if (SUMMIT.from === 'start') $('start').style.display = '';
      camState.snap = true; last = performance.now();
    }, 650);
  };
  // 到站：換到場館 'summit'（城市的迴圈接手畫面），黑幕留兩幀等第一張畫面，再淡掉
  function arrive() {
    SUMMIT.on = false;   // 城市的迴圈接手；黑幕（body.smOn）先留著
    enterSummit();
    last = performance.now();
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => { veil(false); setTimeout(() => { uiOff(); SUMMIT.busy = false; }, 700); })));
  }
  function enterSummit() {
    setWhere('summit');
    const sp = VENUES.summit.spawn;
    player.x = sp.x; player.z = sp.z; player.y = FL; player.yaw = sp.yaw; player.v = 0;
    camState.yaw = sp.yaw; camState.pitch = .12; camState.snap = true;
    toast(VENUES.summit.toast);
  }
  // 99-main.js 的 loop 在 SUMMIT.on 時只呼叫這個（電影、搭車）
  const clock = raw => {
    if (SUMMIT.freeze) return;
    if (AU.on && !document.hidden) { const at = AU.A.currentTime - AU.base; SUMMIT.t = Math.abs(at - SUMMIT.t) < .25 ? at : (AU.base = AU.A.currentTime - SUMMIT.t, SUMMIT.t + raw); }
    else SUMMIT.t += raw;
  };
  SUMMIT.frame = now => {
    const raw = Math.min(.05, Math.max(0, (now - SUMMIT.last) / 1000)); SUMMIT.last = now;
    clock(raw);
    const p0 = scam.position.clone();
    render(now / 1000);
    const spd = raw > 0 ? p0.distanceTo(scam.position) / raw : 0;
    auUpdate(raw, spd);
    SUMMIT.hintT = Math.max(0, SUMMIT.hintT - raw);
    $('smHint').classList.toggle('on', SUMMIT.hintT > 0); $('smBack').classList.toggle('on', SUMMIT.hintT > 0 || isTouch || SUMMIT.mode === 'ride');
    if (SUMMIT.mode === 'ride') { if (SUMMIT.t >= SM_LOOP - .05 && !SUMMIT.busy) SUMMIT.close(); }
    else if (((SUMMIT.t % SM_LOOP) + SM_LOOP) % SM_LOOP < raw && SUMMIT.t > 1) { $('smTitle').classList.add('on'); setTimeout(() => $('smTitle').classList.remove('on'), 6000); }
    SUMMIT.frames++;
  };
  // 開始畫面載入完（99-main.js）：打開按鈕；網址帶 ?summit=1 直接進場
  SUMMIT.ready = () => { go2.disabled = false; if (/[?&]summit=1\b/.test(location.search)) SUMMIT.open(); };
  SUMMIT.seek = t => { SUMMIT.t = t; SUMMIT.freeze = true; snap = true; };
  SUMMIT.play = () => { SUMMIT.freeze = false; if (AU.on) { AU.base = AU.A.currentTime - SUMMIT.t; AU.until = SUMMIT.t - .01; } };
  SUMMIT.st = () => ({ on: SUMMIT.on, mode: SUMMIT.mode, where: player.where, built: SUMMIT.built, t: +SUMMIT.t.toFixed(2), frames: SUMMIT.frames, audio: AU.on, au: AU.mode, srcs: AU.srcs.size,
    cam: (SUMMIT.on ? scam : camera).position.toArray().map(v => +v.toFixed(1)), fov: +scam.fov.toFixed(1), tris: S ? S.ter.geometry.index.count / 3 : 0,
    sky: { se: +SKY.sun.y.toFixed(3), oc: +SKY.oc.toFixed(2), snow: +SKY.snow.toFixed(2), exp: +SKY.v.exp.toFixed(2) } });

  // ─── 場館 'summit'：走得到的地方、碰撞、相機天花板、燈、天色 ───
  // 走得到的範圍是幾塊的聯集：環的室內（內外圈玻璃之間）、三個門口、南邊的平台、兩條迴廊、車站。
  // 牆是這個函式（40-people.js 的 V.walk），家具是圓（data.circles），相機另外有幾道薄牆（data.boxes：迴廊與車站的玻璃、西邊的岩面）
  function inWalk(x, z) {
    const r = Math.hypot(x, z), a = Math.atan2(z, x);
    if (r > RI + .85 && r < RO - .75) return true;
    for (const [da, w] of DOORS) { const t = r * Math.abs(wrapA(a - da)); if (r > RO - 1.3 && r < RO + .7 && t < w - .45) return true; }
    const dd = Math.abs(wrapA(a - DECK.th));
    if (dd < DECK.half && r > RO - .3 && r < DECK.r1 - .7 && r * Math.sin(DECK.half - dd) > .5) return true;
    if (Math.abs(z) < 1.75 && (x > RO - 1.4 && x < ST.x - ST.hx + .6 || x > XF + .9 && x < -RO + 1.4)) return true;
    return Math.abs(x - ST.x) < ST.hx - .45 && z > ST.z - ST.hz + .45 && z < ST.z + ST.hz - .5;
  }
  // 戶外（東稜步道與車站四周的緩坡雪地）：建築佔的地（外擴 m）不算；東門的鋼梯把室內與雪地接起來，兩邊的區只能經過鋼梯互通
  function onBld(x, z, m) {
    const r = Math.hypot(x, z), a = Math.atan2(z, x);
    if (r < RO + .5 + m) return true;
    for (const P of [DECK, BALC]) if (Math.abs(wrapA(a - P.th)) < P.half + m / Math.max(r, 1) && r < P.r1 + m) return true;
    if (Math.abs(z) < 2.6 + m && (x > XF - m && x < -RO || x > RO && x < ST.x - ST.hx + m)) return true;
    return Math.abs(x - ST.x) < ST.hx + .2 + m && Math.abs(z - ST.z) < ST.hz + .2 + m;
  }
  const inStair = (x, z) => x > ST.x + ST.hx - .7 && x < STAIR.x1 + .4 && Math.abs(z - STAIR.z) < STAIR.hw - .3;
  const stairY = x => FL - 2 * clamp((x - STAIR.x0) / (STAIR.x1 - STAIR.x0), 0, 1);
  function inSnow(x, z) {
    if (onBld(x, z, .45)) return false;
    if (x < STAIR.x1 && Math.abs(z - STAIR.z) < STAIR.hw + .35) return false;   // 鋼梯兩側的扶手
    if (trailAt(x, z).d < TR_HW - .15) return true;
    const ca = (x - CBL.x) * CBL.dx + (z - CBL.z) * CBL.dz, cl = Math.abs((x - CBL.x) * CBL.dz - (z - CBL.z) * CBL.dx);
    if (ca > -8 && cl < 20) return false;   // 纜索下的缺口
    const out = (v, a, b) => Math.max(a - v, v - b, 0);
    const dS = Math.hypot(out(x, ST.x - ST.hx, ST.x + ST.hx), out(z, ST.z - ST.hz, ST.z + ST.hz)), dE = Math.hypot(out(x, RO, ST.x - ST.hx), out(z, -2.6, 2.6));
    if (Math.min(dS, dE) > 26) return false;
    const e = .7; return Math.hypot(H(x + e, z) - H(x - e, z), H(x, z + e) - H(x, z - e)) / (2 * e) < .5;   // 坡度 0.5 以內的雪地
  }
  const zone = (x, z) => (inWalk(x, z) ? 1 : 0) | (inSnow(x, z) ? 2 : 0) | (inStair(x, z) ? 4 : 0);
  function walk(ox, oz, nx, nz) {
    const zo = zone(ox, oz) || 7;   // 不在任何一區（剛傳送進來）：哪裡都算
    const ok = (x, z) => { const zn = zone(x, z); return zn && ((zn & zo) || ((zn | zo) & 4)); };
    if (ok(nx, nz)) return [nx, nz];
    const r = Math.hypot(nx, nz);   // 室內：貼著環的弧牆滑，半徑夾回室內那一圈
    if (zo & 1 && r > 1) { const k = clamp(r, RI + .86, RO - .76) / r; if (ok(nx * k, nz * k) && Math.hypot(nx * k - ox, nz * k - oz) < .5) return [nx * k, nz * k]; }
    if (ok(nx, oz)) return [nx, oz];
    if (ok(ox, nz)) return [ox, nz];
    return [ox, oz];
  }
  // 地板：室內是樓板，鋼梯照位置，戶外是山（相機也問這個）
  function floorAt(x, z) {
    if (inStair(x, z) && x > ST.x + ST.hx) return stairY(x);
    if (onBld(x, z, 0)) return FL;
    return H(x, z);
  }
  const RH = RF - 1.25;
  const inRoom = (x, z) => { const r = Math.hypot(x, z); return r > RI - .5 && r < RO + .6 || Math.abs(z) < 2.4 && (x > XF && x < -RO || x > RO && x < ST.x - ST.hx) || Math.abs(x - ST.x) < ST.hx && Math.abs(z - ST.z) < ST.hz; };
  function ceilAt(x, z) {
    const r = Math.hypot(x, z);
    if (r > RI - 1 && r < RO + 1.4) return RH - .35;
    if (Math.abs(z) < 2.8 && (x > XF && x < -RO || x > RO && x < ST.x - ST.hx)) return FL + 3.4;
    if (Math.abs(x - ST.x) < ST.hx + .5 && Math.abs(z - ST.z) < ST.hz + .5) return FL + ST.h - .35;
    return FL + 400;   // 戶外（步道爬到樓板上方 40 m）
  }
  const SM_DATA = { boxes: [], circles: [], lights: [] };
  {
    const C_ = SM_DATA.circles, B_ = SM_DATA.boxes, L_ = SM_DATA.lights, warm = lin(0xffc58a), polar = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
    for (const a of COLS) { const [x, z] = polar(33.4, a); C_.push({ x, z, r: .42 }); L_.push({ x, y: FL + 5.6, z, col: warm, r: 13, i: 1.5 }); }
    for (const a of BENCH) { const [x, z] = polar(29.3, a), tx = -Math.sin(a), tz = Math.cos(a); for (const e of [-1.05, 0, 1.05]) C_.push({ x: x + tx * e, z: z + tz * e, r: .48 }); }
    for (const a of SCREEN) for (let k = 0; k <= 17; k++) { const [x, z] = polar(29.6 + k * .4, a); C_.push({ x, z, r: .22 }); }
    for (let a = BAR.a0; a <= BAR.a1 + 1e-6; a += (BAR.a1 - BAR.a0) / 15) { const [x, z] = polar((BAR.r0 + BAR.r1) / 2, a); C_.push({ x, z, r: .62 }); }
    for (const a of SCOPES) { const [x, z] = polar(55.6, a); C_.push({ x, z, r: .38 }); }
    for (let k = 0; k < 7; k++) { const a = DECK.th - DECK.half + 2 * DECK.half * (k + .5) / 7, [x, z] = polar(49, a), tx = -Math.sin(a), tz = Math.cos(a); for (const e of [-.85, .85]) C_.push({ x: x + tx * e, z: z + tz * e, r: .66 }); }
    for (const a of [DECK.th - .25, DECK.th + .25]) { const [x, z] = polar(50, a); L_.push({ x, y: FL + 3, z, col: warm, r: 16, i: 1.2 }); }
    // 車站：停著的車廂（三個圓）、迴轉輪的柱、閘門、長椅
    { const p = cblAt(CAB_DOCK, 1, V3()); for (const e of [-.75, 0, .75]) C_.push({ x: p.x + CBL.dx * e, z: p.z + CBL.dz * e, r: 1.15 }); }
    C_.push({ x: CBL.x, z: CBL.z, r: .5 });
    for (let k = -1; k <= 1; k++) C_.push({ x: ST.x - 4 + k * 1.6, z: ST.z - 1.5, r: .48 });
    for (const e of [-1.2, 0, 1.2]) C_.push({ x: ST.x + 6 + e, z: ST.z - 5.7, r: .45 });
    for (const [x, z] of [[ST.x - 5, ST.z + 3], [ST.x + 5, ST.z + 3], [ST.x, ST.z - 4]]) L_.push({ x, y: FL + 6.2, z, col: warm, r: 14, i: 1.4 });
    L_.push({ x: 91.6, y: FL + 2.8, z: 0, col: warm, r: 9, i: 1.1 });   // 東門雨遮下
    for (const x of [52, 62, -50, -64]) L_.push({ x, y: FL + 3.3, z: 0, col: warm, r: 9, i: 1.1 });
    // 相機的牆：迴廊兩側的玻璃、車站的南、東、北牆與西牆（門口兩側）、西邊迴廊盡頭的岩面
    for (const [x0, x1] of [[RO + .6, ST.x - ST.hx], [XF, -RO - .6]]) for (const s of [-1, 1]) B_.push({ x0, x1, z0: s > 0 ? 2.3 : -2.6, z1: s > 0 ? 2.6 : -2.3 });
    const { x: sx, z: sz, hx, hz } = ST;
    B_.push({ x0: sx - hx, x1: sx + hx, z0: sz - hz - .3, z1: sz - hz }, { x0: sx + hx, x1: sx + hx + .3, z0: sz - hz, z1: STAIR.z - STAIR.door }, { x0: sx + hx, x1: sx + hx + .3, z0: STAIR.z + STAIR.door, z1: sz + hz }, { x0: sx - hx, x1: sx + hx, z0: sz + hz, z1: sz + hz + .3 });
    B_.push({ x0: sx - hx - .3, x1: sx - hx, z0: sz - hz, z1: -2.3 }, { x0: sx - hx - .3, x1: sx - hx, z0: 2.3, z1: sz + hz });
    B_.push({ x0: XF - 80, x1: XF + .3, z0: -60, z1: 60 });
  }
  const camFar = { on: false, far: 0, near: 0 };
  ENV.summit = { lampOn: 0, wet: 0, fogDen: .0005, fog: 0x101420, fogHi: 0x101420, top: 0x202838, bot: 0x141218, post: { exp: 1.22, thr: 1.15, bloom: .95, knee: 0, range: 1 } };
  const dockP = cblAt(CAB_DOCK, 1, V3()), outN = [-CBL.dz, CBL.dx];   // 車廂門那一側（上行線在迴轉輪的這一側，門朝外）
  VENUES.summit = {
    scene: SCN, data: SM_DATA, lvs: [SM_DATA], lv: 0, lvY: FL, floorAt, name: '峰頂觀景環', toast: '峰頂觀景環 · 雲海之上', dist: '北嶺纜車 · 山頂站', ceil: FL + 40, ceilAt, walk,
    spawn: { x: dockP.x + outN[0] * 3.2, z: dockP.z + outN[1] * 3.2, yaw: Math.atan2(outN[0], outN[1]) },
    door: { x: 0, z: 0 }, out: { x: 0, z: 0, yaw: 0 },   // 城裡的纜車站建好後（下面）換成那裡
    enter() {
      if (!camFar.on) { camFar.on = true; camFar.far = camera.far; camFar.near = camera.near; }
      camera.far = 52000; camera.near = .25; camera.updateProjectionMatrix();
      if (sfx.ready) auStart('venue'); else AU.mode = 'venue';
    },
    leave() {
      if (camFar.on) { camera.far = camFar.far; camera.near = camFar.near; camera.updateProjectionMatrix(); camFar.on = false; }
      if (!SUMMIT.on) auStop();
    },
  };
  SUMMIT.vt = 0;
  // 99-main.js 的 step 在場館 'summit' 時、renderFrame 之前呼叫：天色跟著遊戲時間、城市的環境光與霧換成山上的（人物的打光）、聲音
  SUMMIT.tick = dt => {
    if (!S) return;
    const raw = Math.min(slowmo.raw || dt, .05);
    SUMMIT.vt += raw; clock(raw);
    sceneTick(camera, false, null);
    const V = SKY.v, k = SKY.kd;
    U.uAmbTop.value.set(V.ambU[0] * .85 + V.key[0] * .12 * Math.max(k.y, 0), V.ambU[1] * .85 + V.key[1] * .12 * Math.max(k.y, 0), V.ambU[2] * .85 + V.key[2] * .12 * Math.max(k.y, 0));
    U.uAmbBot.value.set(V.ambD[0] + .02, V.ambD[1] + .014, V.ambD[2] + .01);
    U.uFogCol.value.set(V.hz[0], V.hz[1], V.hz[2]); U.uFogHi.value.copy(U.uFogCol.value); U.uFogDen.value = .0005 * SKY.hzD;
    ENV.summit.post.exp = 1.22 * V.exp / post.exposure; ENV.summit.post.thr = 1.15 / Math.max(V.exp, .3);
    if (!AU.on && sfx.ready) auStart('venue');
    AU.inK = damp(AU.inK, inRoom(player.x, player.z) ? 1 : 0, 3, raw);
    if (AU.on && !SUMMIT.on) auUpdate(raw, player.v || 0);
  };
  // 互動：在站裡搭纜車下山、平台上的望遠鏡（看一段空拍）
  ctxHooks.push((p, near) => {
    if (p.where !== 'summit') return null;
    if (near(dockP.x + outN[0] * 1.7, dockP.z + outN[1] * 1.7, 2.2)) return { key: 'E', text: '搭纜車下山 <i>· 北嶺公園站</i>', fn: () => exitVenue() };
    for (const a of SCOPES) if (near(Math.cos(a) * 54.7, Math.sin(a) * 54.7, 1.3)) return { key: 'E', text: '觀景望遠鏡 <i>· 看一段空拍</i>', fn: () => SUMMIT.open() };
    if (TRAIL_PROPS.scope && near(TRAIL_PROPS.scope[0], TRAIL_PROPS.scope[1], 1.4)) return { key: 'E', text: '東稜觀景台的望遠鏡 <i>· 看一段空拍</i>', fn: () => SUMMIT.open() };
    return null;
  });

  // ─── 城裡的纜車站：北嶺公園門內、管理站東邊的草坪上，纜索往左上爬過稜線（約 165 m）消失在山後 ───
  // 站的座標框 CS.f：原點在站的中心，局部 +x 是纜索往山上的方向；地面照 groundH（公園裡是山的網格高度）
  const CS = { on: false };
  if (NPARK) {
    const pw = (x, z) => { const w = parkW(x, z); return [w.x, w.z]; };
    const [ox, oz] = pw(-14, -24), [ux, uz] = pw(-14 + Math.cos(-2.094), -24 + Math.sin(-2.094));
    const f = CS.f = frameW(ox, oz, ux - ox, uz - oz), W = (x, z) => toW(x, z, f), gy = (x, z) => groundH(...W(x, z)), gyT = (x, z) => hillMeshH(...W(x, z));   // 塔架在公園外：直接問山的網格
    let y0 = 1e9, y1 = -1e9; for (let x = -9; x <= 7; x += 1) for (let z = -5.5; z <= 5.5; z += 1) { const h = gy(x, z); y0 = Math.min(y0, h); y1 = Math.max(y1, h); }
    const fy = Math.max(gy(-9.5, 0), y1) + .15;   // 地板：站底下最高的地面再高一點（坡往山上升，不然草地會從站裡的地板冒出來）；入口前的平台與踏步補到下坡
    CS.on = true; CS.y = fy;
    // 站、塔架、車廂是 blender/cableway.py 的模型（50-assets.js 的 PROPS）；沒有的時候（解壓失敗）退回下面的 Kit 方塊。照地形的基座、平台、踏步與纜索一直是 Kit
    const MODEL = !!(PROPS.cw_station && PROPS.cw_tower && PROPS.cw_cabin); CS.model = MODEL;
    const k = new Kit(), CONC = 0xb4b0a8, GLS = 0x1a2026, MET = 0x3a3d42, WARM = 0xffc070, SLATE = 0x8f8068;
    // 基座（往下埋到坡底：模型時是層疊板岩）、入口前的平台（模型時整個正面寬，放花台、長椅）、往草地的踏步
    const BOARD = 0xbdb9b0, TRAV = 0xd8ccb4;
    if (!MODEL) {
      k.box(-1, (fy + y0 - 1.5) / 2, 0, 16.4, fy - y0 + 1.5, 11.4, CONC, TX.conc);
      k.box(-10.6, (fy + y0 - 1) / 2, 0, 3, fy - y0 + 1, 6.4, CONC, TX.conc);   // 入口前的平台
      const g = gy(-13.4, 0), n = Math.max(0, Math.ceil((fy - g) / .17)); for (let i = 0; i < n; i++) { const top = fy - (i + 1) * (fy - g) / (n + 1); k.box(-12.35 - i * .3, (top + g - .6) / 2, 0, .3, top - g + .6, 6.4, CONC, TX.conc); } CS.steps = n;
    } else {
      // 坡往山上升（站底下前後差 4.5 m）：站坐在板模混凝土的基座上，基座側面是機房的窗、正面一扇維修門；
      // 入口前是整面寬的洞石平台，往下是 5 m 寬的大台階（兩側混凝土擋牆、不鏽鋼扶手，一半處一個平台）
      k.box(-1, (fy + y0 - 1.5) / 2, 0, 16.4, fy - y0 + 1.5, 11.4, BOARD, 43);
      k.box(-10.65, (fy + y0 - 1) / 2, 0, 3.3, fy - y0 + 1, 11.4, BOARD, 43);
      k.box(-10.65, fy - .03, 0, 3.3, .06, 11.2, TRAV, 45).box(-12.27, fy - .2, 0, .08, .3, 11.4, BOARD, 43);
      for (const s of [-1, 1]) { k.box(-10.65, fy + .5, s * 5.62, 3.3, 1, .16, BOARD, 43); k.rod(-12.25, fy + 1.05, s * 5.62, -9.1, fy + 1.05, s * 5.62, .03, 6, 0xa0a4a8, 15); }   // 平台兩側的矮牆與扶手
      for (const s of [-1, 1]) k.box(-12.22, fy + .5, s * 4.22, .16, 1, 2.96, BOARD, 43).box(-12.22, fy + 1.03, s * 4.22, .22, .06, 2.96, SLATE, 46);   // 平台前緣（台階兩旁）的矮牆
      for (const s of [-1, 1]) for (const x of [-7.6, -4.6, -1.6]) { const g = gy(x, s * 5.7); if (fy - g < 2.6) continue; const h = Math.min(1.1, fy - g - 1.6);   // 機房的窗
        k.box(x, fy - .6 - h / 2, s * 5.73, 2.2, h, .05, GLS, 1).box(x, fy - .6, s * 5.74, 2.3, .08, .06, MET, 15).box(x, fy - .6 - h, s * 5.74, 2.3, .08, .06, MET, 15); }
      { const g = gy(-12.4, 4.2); if (fy - g > 2.6) k.box(-12.34, g + 1.1, 4.2, .05, 2.2, 1.2, 0x3a3d42, 15).box(-12.36, g + 2.3, 4.2, .06, .1, 1.5, 0x3a3d42, 15).box(-12.36, g + 2.5, 4.2, .05, .08, .5, WARM, 16); }   // 維修門與門上的燈
      const g = gy(-14, 0), rise = fy - g, n = Math.max(1, Math.round(rise / .165)), hgt = rise / n, half = n > 16 ? Math.floor(n / 2) : -1;
      let x = -12.31, y = fy; const RAMP = [[-12.31, fy]];
      for (let i = 0; i < n; i++) {
        y -= hgt; const run = i === half ? 1.6 : .31; RAMP.push([x - run / 2, y]);
        const gb = gy(x - run / 2, 0) - .4;
        k.box(x - run / 2, (y + gb) / 2, 0, run, Math.max(.05, y - gb), 5, BOARD, 43).box(x - run / 2, y - .015, 0, run, .03, 4.96, TRAV, 45);
        x -= run;
      }
      { // 兩側擋牆：照樓梯斜度的一整片（斜放的長盒，上端埋進基座、下端埋進草地），頂比踏面高 0.9，頂上一條板岩壓頂
        const L = -12.31 - x, a = Math.atan2(fy - y, L), cl = Math.hypot(L, fy - y) + 1.2, cx = (-12.31 + x) / 2, cy = (fy + y) / 2 + .9;
        for (const s of [-1, 1]) {
          k.box(cx + Math.sin(a) * 1.2, cy - Math.cos(a) * 1.2, s * 2.68, cl, 2.4, .3, BOARD, 43, 0, 0, a);
          k.box(cx - Math.sin(a) * .03, cy + Math.cos(a) * .03, s * 2.68, cl, .06, .36, SLATE, 46, 0, 0, a);
        }
      }
      for (const s of [-1, 1]) k.rod(-12.31, fy + .95, s * 2.4, x, y + .95, s * 2.4, .03, 6, 0xa0a4a8, 15);   // 扶手（直的一根，平台那段微微浮起沒關係）
      CS.steps = n; CS.stairEnd = x; RAMP.push([x - .3, y]);
      // 走的面（城裡的人只有地形一個高度）：平台＝fy、台階照踏面的中點連成的斜坡；基座的牆、台階兩側擋牆、平台的矮牆擋住
      const xe = x, rampY = lx => { for (let j = 1; j < RAMP.length; j++) if (lx >= RAMP[j][0]) { const [a, ya] = RAMP[j], [b, yb] = RAMP[j - 1]; return lerp(ya, yb, (lx - a) / Math.max(b - a, 1e-3)); } return y; };
      CS.stairY = rampY;
      WALKS.push({ zn: f, bb: [xe - .3, -9.3, -5.75, 5.75], y: (lx, lz, y0, cam) => {
        const az = Math.abs(lz);
        if (lx >= -12.31) { if (cam) return fy; if (az > 5.5 || (lx < -12.12 && az > 2.5)) return null; return y0 > fy - .7 ? fy : null; }
        if (az > 2.9) return undefined;
        const ry = Math.max(rampY(lx), gy(lx, lz)); if (cam) return ry;
        return az > 2.5 ? null : ry;
      } });
    }
    if (!MODEL) {
    // 後牆（山那側）：高的混凝土牆，上半開口讓纜索出去
    k.box(7.2, fy + 2.5, 0, .5, 5, 11.4, CONC, TX.conc);
    for (const s of [-1, 1]) k.box(7.2, fy + 7.4, s * 4.3, .5, 4.8, 2.8, CONC, TX.conc);
    // 兩側：1 m 混凝土矮牆＋玻璃帷幕（窗框、夜裡透出暖光的內牆）
    for (const s of [-1, 1]) {
      k.box(-1, fy + .5, s * 5.5, 16, 1, .4, CONC, TX.conc);
      k.box(-1, fy + 3.6, s * 5.55, 16, 5.2, .06, GLS, 1);
      for (let x = -9; x <= 7; x += 2) k.box(x, fy + 3.6, s * 5.6, .1, 5.2, .1, MET, 15);
      k.box(-1, fy + 3.6, s * 4.9, 15.6, 4.6, .05, WARM, 16);
    }
    // 正面（入口）：玻璃、兩扇門、雨遮與燈條
    // 正面不封玻璃（門口大開，看得到裡面的燈、閘門與停在站裡的車廂），只留兩側的玻璃格與門楣
    for (const s of [-1, 1]) { k.box(-9.2, fy + 3.1, s * 3.6, .06, 6.2, 3.6, GLS, 1); for (const z of [1.8, 5.4]) k.box(-9.25, fy + 3.1, s * z, .14, 6.2, .14, MET, 15); }
    k.box(-9.25, fy + 5.2, 0, .16, 2, 3.6, CONC, TX.conc);
    // 站裡：天花的燈帶、閘門、月台邊線、靠背牆的長椅
    for (const z of [-3, 0, 3]) k.box(-4.6, fy + 5.8, z, 8.4, .08, .35, WARM, 16);   // 吊頂只蓋前半（後半是迴轉輪）
    k.box(-4.6, fy + 5.95, 0, 9, .2, 11, 0x6a5038, 2);
    for (const z of [-2.4, -.8, .8, 2.4]) k.box(-6.8, fy + .5, z, .9, 1, .18, 0x8a8f96, 15).box(-6.8, fy + 1.02, z, .9, .05, .2, WARM, 16);
    k.box(-1, fy + .02, 1.2, 14, .02, .12, 0xe8c040, 2).box(-1, fy + .02, -1.2, 14, .02, .12, 0xe8c040, 2);
    for (const s of [-1, 1]) k.box(-5, fy + .45, s * 4.6, 4, .12, .6, 0x7a5a3a, 2).box(-5, fy + .2, s * 4.6, 3.6, .4, .1, MET, 15);
    k.box(-10.6, fy + 3.3, 0, 3, .22, 6.2, MET, 15).box(-12.05, fy + 3.18, 0, .06, .06, 6.2, WARM, 16);
    // 屋頂：往山上那端翹起的金屬板（兩段）
    const ROOF = 0x5c5650;
    k.box(-5, fy + 6.6, 0, 9, .3, 12.2, ROOF, 2, 0, 0, .07).box(3.6, fy + 7.9, 0, 8.4, .3, 12.2, ROOF, 2, 0, 0, .16);
    k.box(-9.5, fy + 6.25, 0, .35, .5, 12.3, 0x8a7a5a, 2);   // 屋簷的封邊
    // 屋頂下的迴轉輪與出站的兩條索（從輪的兩側往山上）
    k.cyl(3.6, fy + 6.2, 0, 2.5, 2.5, .3, 40, MET, 15).cyl(3.6, fy + 6.9, 0, .35, .35, 1.4, 12, MET, 15);
    }
    // 纜線：塔架在 300 m、600 m（稜線）、900 m（山後），索在塔頂的鞍座上
    const D = [0, 300, 600, 900], tops = D.map((d, i) => i ? gyT(d, 0) + 28 : fy + 6.2);
    if (!MODEL) for (let i = 1; i < D.length; i++) {
      const d = D[i], g0 = gyT(d, 0) - .5, t = tops[i];
      k.rod(d - 1.2, g0, -1.2, d - .5, t - 1, -.5, .22, 6, MET, 15).rod(d + 1.2, g0, -1.2, d + .5, t - 1, -.5, .22, 6, MET, 15);
      k.rod(d - 1.2, g0, 1.2, d - .5, t - 1, .5, .22, 6, MET, 15).rod(d + 1.2, g0, 1.2, d + .5, t - 1, .5, .22, 6, MET, 15);
      for (let h = 5; h < t - g0 - 3; h += 5) { const q = h / (t - g0), w = 1.2 - .7 * q; k.box(d, g0 + h, 0, 2 * w, .12, .12, MET, 15).box(d, g0 + h, 0, .12, .12, 2 * w, MET, 15); }
      k.box(d, t - .6, 0, 1.2, .5, 6.2, MET, 15);
      for (const s of [-1, 1]) k.box(d, t - .2, s * 2.5, 2.4, .3, .5, MET, 15);
    }
    for (const s of [-1, 1]) for (let i = 0; i + 1 < D.length; i++) {
      const a = D[i] + (i ? 0 : 3.6), b = D[i + 1], ya = tops[i] + (i ? .05 : 0), yb = tops[i + 1] + .05, n = 6;
      for (let j = 0; j < n; j++) { const u0 = j / n, u1 = (j + 1) / n, sg = u => 4 * u * (1 - u) * (b - a) * .012;
        k.rod(lerp(a, b, u0), lerp(ya, yb, u0) - sg(u0), s * 2.5, lerp(a, b, u1), lerp(ya, yb, u1) - sg(u1), s * 2.5, .045, 4, 0x1a1a1c, 15); }
    }
    CS.D = D; CS.tops = tops;
    const m = new T.Mesh(k.build(), MAT.ux); cityAdd(m, f);
    if (MODEL) {   // 模型：幾何照框的局部座標平移後烘進城市（每座塔一份，cityAdd 會改幾何，要 clone）
      const put = (geo, x, y, z) => { const g = geo.clone(); g.translate(x, y, z); cityAdd(new T.Mesh(g, MAT.ux), f); };
      put(PROPS.cw_station, 0, fy, 0);
      for (let i = 1; i < D.length; i++) put(PROPS.cw_tower, D[i], tops[i] - 28, 0);
    }
    // 招牌（模型：門上的鋼背板；Kit：入口雨遮上）
    { const sg = v5Sign([['北嶺纜車', .4, '#f0e6d0', .36], ['NORTH RIDGE CABLEWAY · 峰頂觀景環', .17, '#e0b070', .76]], 6, 1.3, { bg: '#1c1e22', edge: '#8a7a5a' });
      if (MODEL) sg.position.set(-9.36, fy + 4.08, 0); else sg.position.set(-12.12, fy + 4.3, 0); sg.rotation.y = -Math.PI / 2; cityAdd(sg, f); }
    // 碰撞：站體（入口那面除外留門口給互動）、四座塔
    colliders.push({ x0: -9.3, x1: 7.5, z0: -5.8, z1: 5.8, hy: fy + 8, zn: f });
    for (let i = 1; i < D.length; i++) colliders.push({ x0: D[i] - 1.9, x1: D[i] + 1.9, z0: -1.9, z1: 1.9, hy: tops[i], zn: f });
    if (MODEL) for (const s of [-1, 1]) colliders.push({ x0: -11.85, x1: -10.15, z0: s > 0 ? 3.55 : -5.05, z1: s > 0 ? 5.05 : -3.55, hy: fy + 1.1, zn: f },   // 花台
      { x0: -12.12, x1: -11.92, z0: s * 2.95 - .12, z1: s * 2.95 + .12, hy: fy + 1, zn: f },   // 燈柱
      { x0: -10.2, x1: -9.3, z0: s > 0 ? 4.3 : -4.8, z1: s > 0 ? 5.5 : -4.2, hy: fy + 1, zn: f });   // 長椅、垃圾桶、指示牌
    colDirty();
    // 燈：入口雨遮下、站裡
    for (const [x, y, r, i] of [[-11, fy + 3, 12, 1.6], [-2, fy + 5, 16, 1.4]]) { const [X, Z] = W(x, 0); outLights.push({ x: X, y, z: Z, col: lin(0xffc890), r, i, w: 1 }); }
    // 線上的兩台車廂（往復式：一台上、一台下，在中間交會）：同一份幾何，每幀擺位置
    { const kc = new Kit(), BODY = 0xd8d4cc;
      kc.box(0, -4.2, 0, 2.4, 1, 2.1, BODY, 10).box(0, -3.2, 0, 2.4, 1, 2.1, 0x223038, 1).box(0, -2.6, 0, 2.4, .25, 2.1, BODY, 10).box(0, -2.4, 0, 2, .2, 1.7, BODY, 10);
      kc.box(0, -3.25, 0, 2.3, .9, 2, WARM, 16);
      kc.rod(0, -2.3, 0, 0, -.6, 0, .06, 6, MET, 15).rod(0, -.6, 0, .25, -.05, 0, .06, 6, MET, 15).box(.25, 0, 0, .9, .25, .25, MET, 15);
      const geo = MODEL ? PROPS.cw_cabin : kc.build();
      CS.cabs = [[1, 0], [-1, .5]].map(([s, ph]) => { const o = new T.Mesh(geo, MAT.ux); scene.add(o); return { o, s, ph }; });
    }
    CS.ropeY = d => { let i = 0; while (i < D.length - 2 && d > D[i + 1]) i++; const a = i ? D[i] : D[0] + 3.6, b = D[i + 1], u = clamp((d - a) / (b - a), 0, 1); return lerp(tops[i] + (i ? .05 : 0), tops[i + 1] + .05, u) - 4 * u * (1 - u) * (b - a) * .012; };
    CS.t = 0;
    { const [ax, az] = W(-12.6, 0), [bx, bz] = W(-13.6, 0); CS.door = W(-10.6, 0); CS.out = { x: ax, z: az, yaw: Math.atan2(bx - ax, bz - az) }; }
    VENUES.summit.door = { x: CS.door[0], z: CS.door[1] }; VENUES.summit.out = CS.out;
    ctxHooks.push((p, near) => {
      if (p.where !== 'out' || p.mode !== 'walk') return null;
      if (Math.hypot(p.x - CS.door[0], p.z - CS.door[1]) < 2.4) return { key: 'E', text: '搭纜車上山 <i>· 峰頂觀景環</i>', fn: () => SUMMIT.ride() };
      return null;
    });
  }
  // 測試用：城裡的站（door、out、塔頂）、走得到的範圍、搭纜車下山
  SUMMIT.cs = CS; SUMMIT.inWalk = (x, z) => zone(x, z) > 0; SUMMIT.zone = zone; SUMMIT.floorAt = floorAt; SUMMIT.place = (x, z, yaw = player.yaw) => { player.x = x; player.z = z; player.y = floorAt(x, z); player.yaw = camState.yaw = yaw; camState.snap = true; }; SUMMIT.trailAt = (x, z) => ({ ...trailAt(x, z) }); SUMMIT.down = () => { if (player.where === 'summit') exitVenue(); };
  // 99-main.js 的 step（戶外）：線上的車廂往返（1.4 km 外不動）
  SUMMIT.cityTick = dt => {
    if (!CS.on || !CS.cabs) return;
    const [X, Z] = CS.door; if (Math.hypot(camera.position.x - X, camera.position.z - Z) > 1400) return;
    CS.t += dt;
    const L = CS.D[CS.D.length - 1] - 3.6, f = CS.f;
    for (const cb of CS.cabs) {
      const u = (CS.t * 5 / (2 * L) + cb.ph) % 1, d = 3.6 + (u < .5 ? u * 2 : 2 - u * 2) * L;   // 5 m/s，來回一趟約 6 分鐘
      const [wx, wz] = toW(d, cb.s * 2.5, f); cb.o.position.set(wx, CS.ropeY(d), wz); cb.o.rotation.y = f.ry;
    }
  };
}
