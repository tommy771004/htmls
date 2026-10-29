// ═══ 紐柏林 GP 的維修區（使用者：「會有車廠的維修車間，也會有跑道接著，途中可以去換輪胎」；位置是 09-nbr.js 的 nbrPitBld，OSM 的維修樓沿著的那段直線）═══
// 大樓：一樓是一排 BW 寬的車間（門口朝維修道、捲門捲在頂上），二三樓是看維修道的玻璃帷幕（城裡的程式立面 MAT_FACADE，同 24-nbr-bld.js：
// 細模在鏡頭 SET.fac 內換成窗洞挖進牆裡的版本），維修道跟著地形往下坡，樓上照樓層線整層對齊、分段往下退一層，車間門頂到樓板之間是實牆。
// 門口上方是懸挑的雨棚（外緣掛車隊名牌）。車間裡的地坪、牆面、天花板與螢幕是 24-nbr-paint.js 畫的烘焙貼圖（glb 材質的自發光貼圖），立體的有鋼樑、燈具、
// 門口的氣動扳手吊桿、洞洞板、計時螢幕、捲門、工作台；近處（R 內）擺 27-props.js 的道具：輪胎推車、看板、工具櫃、工具車、千斤頂、滅火器（tools/nbr-pit.mjs → nbr_pit）、
// 工具推車（interior）、輪胎架、空壓機與吊臂（chrome）；每間兩盞點光（NBR.pitStop.lights → 61-nbr-pit.js 的 outLights）。
// 門口前面是 7 m 寬的工作車道（城裡連接道路的柏油，同 23-nbr-road.js），白線分出每一格、黃線是輪子停的位置；維修牆後面每隊一座計時台。
// 碰撞：隔間牆、端牆、後牆、門柱、計時台（門口開著，車開得進去）。換胎在 61-nbr-pit.js（NBR.pitStop）。車隊與贊助商名稱都是虛構的 ═══
const NBR_PIT_R = 85;   // 道具（輪胎推車三萬面）只畫鏡頭這個半徑內的
if (NBR && nbrPitBld()) {
  const PB = nbrPitBld(), { BW, t0, t1, n, f0, f1 } = PB, HW = NBR.pit.hw;
  const [ox, oz] = toW(0, 0, SEA_FR), [ex, ez] = toW(1, 0, SEA_FR), rc = ex - ox, rs = ez - oz;
  const W = (x, z) => [ox + x * rc - z * rs, oz + x * rs + z * rc], WN = (x, z) => [x * rc - z * rs, x * rs + z * rc];
  const L2 = (t, o) => [PB.A[0] + PB.ux * t + PB.nx * o, PB.A[1] + PB.uz * t + PB.nz * o];   // 沿線 t、離中心線 o → SEA_FR
  const P3 = (t, o, y) => { const [X, Z] = W(...L2(t, o)); return [X, y, Z]; };
  const gy = (t, o) => nbrMeshL(...L2(t, o)), yl = t => PB.A[2] + (PB.B[2] - PB.A[2]) * t / PB.L;   // 地面、維修道路面
  const [UX, UZ] = WN(PB.ux, PB.uz), [NX, NZ] = WN(PB.nx, PB.nz), RY = Math.atan2(-UZ, UX);   // Kit 方塊轉 RY：x 沿 U、z 沿 ±N
  const hsh = (a, b) => { let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
  const st = { boxes: n, secs: 0, cols: 0, props: 0 };
  // 車隊（兩間一隊）：名稱、隊色
  const TEAMS = [['NORDWALD RACING', 0x1d5c3a], ['HALDEN MOTORSPORT', 0x1f4e8c], ['VIERLING GP', 0xd2691e], ['OSTKURVE RACING', 0x8b1e2d], ['AHRTAL SPEED', 0xd8a90c], ['GRAUKAMM WORKS', 0x34373c],
    ['SILBERSEE MOTORSPORT', 0x9ea3a8], ['EIFELBLITZ', 0x5b2a86], ['KESSELHOF RACING', 0x0f7c86], ['WEHRTURM GP', 0xb3261e], ['MOSELKANTE RACING', 0x2c3e66], ['ROTBACH ENGINEERING', 0xe2551b]];
  const team = i => TEAMS[(i >> 1) % TEAMS.length];
  // ─── 每間的地面高低（3 m 一點取樣）與門頂；樓上照樓層線分段 ───
  const FH = facFh(3), box = [];
  for (let i = 0; i < n; i++) {
    const ta = t0 + i * BW, tb = ta + BW; let lo = 1e9, hi = -1e9;
    for (let t = ta; t <= tb + .01; t += 3) for (let o = f0; o <= f1 + .01; o += 3) { const y = gy(t, o); lo = Math.min(lo, y); hi = Math.max(hi, y); }
    box.push({ i, ta, tb, tc: ta + BW / 2, lo, hi, top: hi + 5 });
  }
  const snap = y => FAC_GH + Math.ceil((y - FAC_GH) / FH) * FH, secs = [];
  for (const b of box) {
    let s = secs[secs.length - 1];
    if (s && b.top + .6 <= s.yb && s.yb - b.top <= 4.4) { s.b1 = b.i; continue; }
    const yb = s && b.top + .6 <= s.yb ? s.yb - FH : snap(b.top + .6);
    secs.push(s = { b0: b.i, b1: b.i, yb, eave: yb + 2 * FH + .75 });
  }
  for (const s of secs) { s.ta = box[s.b0].ta; s.tb = box[s.b1].tb; s.lo = Math.min(...box.slice(s.b0, s.b1 + 1).map(b => b.lo)); for (let i = s.b0; i <= s.b1; i++) box[i].sec = s; }
  st.secs = secs.length;
  // ─── 立面（MAT_FACADE）：遠景與細模各建一份，照距離切換 ───
  const fbuf = () => ({ p: [], n: [], uv: [], b: [], b2: [], idx: [] });
  // 一面牆的框：(ta, oa) → (tb, ob) 這條線、往外的法向 (nx, nz)（SEA_FR），u 從面向觀看者的左邊算起（同 24-nbr-bld.js）
  const frame = (ta, oa, tb, ob, nx, nz) => {
    const [ax, az] = L2(ta, oa), [bx, bz] = L2(tb, ob), w = Math.hypot(bx - ax, bz - az), [Nx, Nz] = WN(nx, nz); let [AX, AZ] = W(ax, az), [BX, BZ] = W(bx, bz);
    if ((BX - AX) * Nz - (BZ - AZ) * Nx < 0) [AX, AZ, BX, BZ] = [BX, BZ, AX, AZ];
    return { ax: AX, az: AZ, ux: (BX - AX) / w, uz: (BZ - AZ) / w, nx: Nx, nz: Nz, w };
  };
  const SC = [.31, 7, 1, 0], ring3 = (B, F, eave, S2) => { for (const [o, y0b, y1b] of [[.1, eave - .62, eave - .34], [.2, eave - .34, eave - .16], [.36, eave - .16, eave + .06]]) fbx(B, F, -o, F.w + o, 0, o, y0b, y1b, SC, S2, SC, S2); };
  const facGeo = (B, det) => {
    secs.forEach((s, si) => {
      const sd = hsh(si * 7 + 3, 41), A2 = [0, 1, s.eave, 0], S2 = solidOf(A2), y0 = s.lo - .6;
      const front = frame(s.ta, f0, s.tb, f0, -PB.nx, -PB.nz), back = frame(s.ta, f1, s.tb, f1, PB.nx, PB.nz);
      // 車間門頂到樓板：每間一段實牆（門頂照那一間的地面）
      for (let i = s.b0; i <= s.b1; i++) { const Fi = frame(box[i].ta, f0, box[i].tb, f0, -PB.nx, -PB.nz); fvq(B, Fi, 0, Fi.w, 0, box[i].top, s.yb, [sd, 2, Fi.w, 0], S2); }
      // 二三樓：前面玻璃帷幕、後面與兩端灰泥開窗；一樓的後牆與端牆是實牆
      if (det) { facHoles(B, front, [sd, 3, front.w, 0], A2, 3, s.eave, s.yb, s.eave, .12, null); facHoles(B, back, [sd, 2, back.w, 0], A2, 2, s.eave, s.yb, s.eave, .3, null); }
      else { fvq(B, front, 0, front.w, 0, s.yb, s.eave, [sd, 3, front.w, 0], A2); fvq(B, back, 0, back.w, 0, s.yb, s.eave, [sd, 2, back.w, 0], A2); }
      fvq(B, back, 0, back.w, 0, y0, s.yb, [sd, 2, back.w, 0], S2);
      ring3(B, front, s.eave, S2); ring3(B, back, s.eave, S2);
      const ends = [];
      if (si === 0) ends.push([s.ta, -1, y0]);
      if (si === secs.length - 1) ends.push([s.tb, 1, y0]);
      const nb = [secs[si - 1], secs[si + 1]];   // 和隔壁段的高低差：高的那段露出來的端牆
      if (nb[0] && nb[0].eave < s.eave) ends.push([s.ta, -1, nb[0].eave]);
      if (nb[1] && nb[1].eave < s.eave) ends.push([s.tb, 1, nb[1].eave]);
      for (const [t, sg, ya] of ends) {
        const F = frame(t, f0, t, f1, PB.ux * sg, PB.uz * sg);
        if (ya < s.yb) fvq(B, F, 0, F.w, 0, ya, s.yb, [sd, 2, F.w, 0], S2);
        const yw = Math.max(ya, s.yb);
        if (det && ya <= s.yb) facHoles(B, F, [sd, 2, F.w, 0], A2, 2, s.eave, yw, s.eave, .3, null); else fvq(B, F, 0, F.w, 0, yw, s.eave, [sd, 2, F.w, 0], A2);
        ring3(B, F, s.eave, S2);
      }
      // 平頂（瀝青、積水，同城裡）
      const R = [P3(s.ta, f0, s.eave), P3(s.tb, f0, s.eave), P3(s.tb, f1, s.eave), P3(s.ta, f1, s.eave)];
      const up = (R[1][2] - R[0][2]) * (R[2][0] - R[0][0]) - (R[1][0] - R[0][0]) * (R[2][2] - R[0][2]) >= 0;
      quad(B, ...(up ? R : [R[0], R[3], R[2], R[1]]), [0, 1, 0], 0, 1, [sd, 2, 1, 0], [0, 1, s.eave, 0]);
    });
  };
  const facMesh = (B2, name) => {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(B2.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(B2.n, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(B2.uv, 2));
    g.setAttribute('aB', new T.Float32BufferAttribute(B2.b, 4)); g.setAttribute('aB2', new T.Float32BufferAttribute(B2.b2, 4)); g.setIndex(B2.idx); g.computeBoundingSphere();
    const m = new T.Mesh(g, MAT_FACADE); m.matrixAutoUpdate = false; m.userData.noTess = 1; m.name = name; cityAdd(m, null); return m;
  };
  const Bf = fbuf(), Bd = fbuf(); facGeo(Bf, false); facGeo(Bd, true);
  const facFar = facMesh(Bf, 'nbrPitFacade'), facDet = facMesh(Bd, 'nbrPitFacadeDet'); facDet.visible = false;
  // ─── Kit：門柱、雨棚、車間室內、計時台 ───
  const k = new Kit(true);
  const bx = (t, o, y, sT, sO, sY, col, mat = 2) => k.box(...P3(t, o, y), sT, sY, sO, col, mat, 0, RY, 0);   // 中心 (t, o, y)，沿線 sT、橫向 sO、高 sY
  const hq = (a, b, c, d, col, mat) => {   // 水平的四邊形（法線朝上）
    const cl = lin(col);
    for (let [p, q, r] of [[a, b, c], [a, c, d]]) {
      if ((q[2] - p[2]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[2] - p[2]) < 0) [q, r] = [r, q];
      for (const v of [p, q, r]) { k.pos.push(...v); k.nor.push(0, 1, 0); k.col.push(cl.r, cl.g, cl.b); k.mat.push(mat); }
    }
  };
  // 貼地的線（ta, oa）→（tb, ob），寬 w，離地 lift；每 3 m 切一段
  const ln = (ta, oa, tb, ob, w, col, lift, mat = 2) => {
    const L = Math.hypot(tb - ta, ob - oa), m = Math.max(1, Math.ceil(L / 3)), pt = -(ob - oa) / L * w / 2, po = (tb - ta) / L * w / 2;
    for (let j = 0; j < m; j++) {
      const P = f => [ta + (tb - ta) * f, oa + (ob - oa) * f], [pa, qa] = P(j / m), [pb, qb] = P((j + 1) / m), Y = (t, o) => P3(t, o, gy(t, o) + lift);
      hq(Y(pa - pt, qa - po), Y(pb - pt, qb - po), Y(pb + pt, qb + po), Y(pa + pt, qa + po), col, mat);
    }
  };
  const WHITE = 0xc4c4bc, YEL = 0xc99a1e, CONC = 0xc9c8c2, WALL = 0xd9d9d4;
  const cols = [], col = (t, o, y0, y1, sT, sO) => { const [X, Z] = W(...L2(t, o)); cols.push({ x0: -sT / 2, x1: sT / 2, z0: -sO / 2, z1: sO / 2, zn: frameW(X, Z, UX, UZ), ly: y0, hy: y1 }); };
  // 門柱（每道隔間牆前面，高到樓板）
  for (let i = 0; i <= n; i++) {
    const t = t0 + i * BW, s = box[Math.min(i, n - 1)].sec, s2 = box[Math.max(i - 1, 0)].sec, yb = Math.max(s.yb, s2.yb), y0 = Math.min(gy(t, f0), gy(t, f0 + .6)) - .3;
    bx(t, f0 + .3, (y0 + yb) / 2, .7, .7, yb - y0, CONC, TX.conc); col(t, f0 + .3, y0, yb, .7, .7);
  }
  // 雨棚：每段一片（板底照段裡最高的門頂再高一點），外緣掛深色的封板，板底一排嵌燈
  for (const s of secs) {
    const yT = s.yb - .05, d = 3.4, L = s.tb - s.ta + .7, tc = (s.ta + s.tb) / 2;
    bx(tc, f0 - d / 2, yT - .18, L, d, .36, 0xb9b9b5, TX.conc);
    bx(tc, f0 - d + .06, yT - .4, L, .12, .8, 0x23262a, 10);
    for (let t = s.ta + 1.5; t < s.tb; t += 3) bx(t, f0 - d / 2, yT - .37, .5, .5, .03, 0xfff3dc, 11);
  }
  // 車間
  for (const b of box) {
    const { ta, tb, tc, top } = b, y0 = b.lo - .3;
    // 地板、牆面與天花板的面是下面的烘焙貼圖（bake）；這裡是牆體、碰撞與立體的東西
    // 隔間牆（左右各一道；最後一間的右牆是端牆）、左牆的洞洞板
    for (const [t, sg] of [[ta, 1], [tb, -1]]) {
      if (sg > 0 || b.i === n - 1) { bx(t, (f0 + .6 + f1 - .3) / 2, (y0 + top + .3) / 2, .3, f1 - f0 - .9, top + .3 - y0, WALL, 2); col(t, (f0 + f1) / 2, y0, top + .3, .3, f1 - f0); }
      const tp = t + sg * .17;
      if (sg > 0) { bx(tp + .02, f1 - 4.5, gy(tp, f1 - 4.5) + 1.7, .03, 5, 1.4, 0x6d7276, TX.peg); bx(tp + .03, f1 - 4.5, gy(tp, f1 - 4.5) + 2.45, .06, 5.1, .06, 0x8f9499, TX.galv); }
    }
    // 後牆
    bx(tc, f1 - .15, (y0 + top + .3) / 2, BW, .3, top + .3 - y0, WALL, 2); col(tc, f1, y0, top + .3, BW, .4);
    // 天花板（樓板）、兩道鋼樑、三條頂燈（燈殼＋發光的燈面）、捲門（捲在門頂）與兩側的導軌
    bx(tc, (f0 + f1) / 2, top + .15, BW, f1 - f0, .3, 0xbfc1c3, TX.conc);
    for (const o of [f0 + 6, f0 + 12]) { bx(tc, o, top - .2, BW - .3, .22, .4, 0x4a4e53, TX.steel); bx(tc, o, top - .39, BW - .3, .3, .03, 0x55595e, TX.steel); }
    for (const e of [-3.6, 0, 3.6]) { bx(tc + e, (f0 + f1) / 2, top - .07, .34, f1 - f0 - 2.9, .1, 0x2c2f33, 2); bx(tc + e, (f0 + f1) / 2, top - .125, .26, f1 - f0 - 3, .02, 0xfff4e0, 11); }
    // 門口的工具吊桿：橫跨車間的鋼管、四條垂下來的氣管（前後輪的位置）與掛著的氣動扳手、捲起來的備用氣管
    { const oG = f0 + 2.2, yG = top - 1.05, yL = gy(tc, oG) + 1.45;
      bx(tc, oG, yG, BW - 1.4, .12, .12, 0x2e3135, TX.steel);
      for (const e of [-1, 1]) bx(tc + e * (BW / 2 - 1.2), oG, (yG + top) / 2, .06, .06, top - yG, 0x2e3135, TX.steel);
      for (const e of [-3.3, -1.5, 1.5, 3.3]) {
        bx(tc + e, oG, (yG + yL) / 2, .025, .025, yG - yL, 0x1a1b1d, 6);
        bx(tc + e, oG, yL - .08, .11, .26, .15, 0x26282c, 2); bx(tc + e, oG - .16, yL - .1, .06, .07, .06, 0xa9adb2, TX.steel); bx(tc + e, oG + .07, yL - .22, .05, .05, .18, 0x1d1e20, 6);
      }
      for (const e of [-.18, .18]) bx(tc + e, oG + .05, yG - .2, .04, .44, .44, 0x1c1d20, 2);   // 備用氣管的捲盤（兩片側板＋中間捲著的黑管）
      bx(tc, oG + .05, yG - .2, .32, .3, .3, 0x0f1012, 6);
    }
    bx(tc, f0 + .45, top - .32, BW - .8, .55, .55, 0x8f9396, TX.galv);
    for (const e of [-1, 1]) bx(tc + e * (BW / 2 - .5), f0 + .2, (y0 + top) / 2, .12, .15, top - y0, 0x75797d, TX.galv);
    // 吊在門口裡面的計時螢幕（朝維修道）
    bx(tc, f0 + 3.4, top - .45, 3.4, .06, .06, 0x3a3d40, TX.galv);
    for (const e of [-1.5, 1.5]) bx(tc + e, f0 + 3.4, (top - .45 + top) / 2, .03, .03, .45, 0x3a3d40, TX.galv);
    for (const e of [-1, 0, 1]) bx(tc + e * 1.1, f0 + 3.4, top - 1.05, 1, .08, .62, 0x141518, 2);
    // 工作台（右牆、後半段）
    { const t = tb - .55, o = f1 - 8, yg = gy(t, o); bx(t, o, yg + .45, .75, 3, .9, 0x3a3d42, 15); bx(t, o, yg + .92, .8, 3.1, .05, 0x9ea2a6, TX.steel); }
  }
  // 工作車道（門口到維修道邊）上的白線：每間的分隔、和快車道之間的實線；每間正中一條往車間的黃色引導線、停車位置的橫線
  ln(t0, HW + .35, t1, HW + .35, .15, WHITE, .125);
  for (let i = 0; i <= n; i++) ln(t0 + i * BW, HW + .5, t0 + i * BW, f0 - .1, .15, WHITE, .125);
  for (const b of box) { ln(b.tc, HW + 1.2, b.tc, f0 - .3, .12, YEL, .125); ln(b.tc - 1.2, HW + 3.4, b.tc + 1.2, HW + 3.4, .14, YEL, .125); }
  // 維修牆後面的計時台：每隊一座（兩間的中間），站台與維修牆頂齊高，桌上一排螢幕、隊色頂棚
  const wallO = -(HW + .6 + .45), stands = [];
  for (let j = 0; j * 2 < n; j++) {
    const tc = t0 + (j * 2 + (j * 2 + 1 < n ? 1 : .5)) * BW, [, tcol] = team(j * 2), oc = wallO - .7, yg = gy(tc, oc), yd = yg + 1.1, Lt = 6.4;
    for (const a of [-1, 1]) for (const e of [-.55, .55]) bx(tc + a * (Lt / 2 - .2), oc + e, yg + .55, .1, .1, 1.1, 0x575c60, TX.galv);
    bx(tc, oc, yd, Lt, 1.3, .08, 0x6b6f73, TX.galv);
    bx(tc, oc - .45, yd + .8, Lt - .4, .45, .05, 0x2c2f33, 10);   // 桌面（靠賽道那邊）
    for (let q = -2; q <= 2; q++) bx(tc + q * 1.15, oc - .55, yd + 1.12, .95, .06, .58, 0x141518, 2);
    for (const q of [-2, -.7, .7, 2]) { bx(tc + q, oc + .2, yd + .35, .06, .06, .7, 0x3a3d40, TX.galv); bx(tc + q, oc + .2, yd + .72, .38, .38, .06, 0x1b1c1e, 2); }
    for (const a of [-1, 1]) bx(tc + a * (Lt / 2 - .2), oc + .5, yd + 1.3, .08, .08, 2.6, 0x575c60, TX.galv);
    bx(tc, oc + .1, yd + 2.62, Lt + .3, 1.7, .08, tcol, 10, 0, 0, 0);
    stands.push({ tc, oc, yd });
    col(tc, oc, yg - .3, yd + 2.7, Lt, 1.3);
  }
  { const m = new T.Mesh(k.build(), MAT.ux); m.name = 'nbrPit'; cityAdd(m, null); }
  for (const c of cols) colliders.push(c); st.cols = cols.length;
  // ─── 烘焙貼圖的室內面（24-nbr-paint.js 畫）：glb 材質的自發光貼圖（底色近黑，不吃太陽；霧照常），一種貼圖一個網格 ───
  // A 隔間牆 2048²（一隊一格 1024×341）、B 後牆 1024×2048（一隊一格 512×341）、C 地坪＋天花板 1024²、D 螢幕 512²（六種畫面）
  const bake = { A: { cv: 2048, ch: 2048 }, B: { cv: 1024, ch: 2048 }, C: { cv: 1024, ch: 1024 }, D: { cv: 512, ch: 512 } };
  for (const q of Object.values(bake)) Object.assign(q, { p: [], n: [], uv: [], i: [] });
  const sgR = Math.sign(PB.uz * PB.nx - PB.ux * PB.nz) || 1;   // 從維修道看車間，U 朝右手邊是 1
  const vtx = (B, P, n, u, v) => { B.p.push(...P); B.n.push(...n); B.uv.push(u, v); return B.p.length / 3 - 1; };
  const quadB = (B, a, b, c, d) => B.i.push(a, b, c, a, c, d);
  const nU = [UX, 0, UZ], nN = [NX, 0, NZ], neg = v => v.map(x => -x), nFl = [-NX * .87, .5, -NZ * .87];   // 地坪的法線斜一點：glb 材質朝上的面會疊雨天的積水反光
  // 直立的面：沿 (t, o) 從 a 到 b，底邊貼地板（地形 + .1）、頂到 yT；u 從 ua 到 ub，v 從 v0 到 v1，seg 段
  const wallQ = (B, ta_, oa_, tb_, ob_, yT, ua, ub, v0, v1, n, seg) => {
    for (let q = 0; q < seg; q++) {
      const f = q / seg, g = (q + 1) / seg, T1 = ta_ + (tb_ - ta_) * f, O1 = oa_ + (ob_ - oa_) * f, T2 = ta_ + (tb_ - ta_) * g, O2 = oa_ + (ob_ - oa_) * g;
      const u1 = ua + (ub - ua) * f, u2 = ua + (ub - ua) * g;
      quadB(B, vtx(B, P3(T1, O1, gy(T1, O1) + .1), n, u1, v0), vtx(B, P3(T2, O2, gy(T2, O2) + .1), n, u2, v0), vtx(B, P3(T2, O2, yT), n, u2, v1), vtx(B, P3(T1, O1, yT), n, u1, v1));
    }
  };
  const WL0 = f0 + .65, WL1 = f1 - .3, WLm = WL1 - WL0, WH = 5.4;   // 隔間牆的室內面：門柱後面到後牆前面；貼圖照 5.4 m 高畫
  for (const b of box) {
    const { ta, tb, top } = b, j = (b.i >> 1) % TEAMS.length;
    // 地坪（3 m 一格貼著地形，同原本的高度）：u 是從門口往裡看的左到右，v 從門口（0）到後牆（1）；貼圖的左 2/3
    const fu = t => (sgR > 0 ? (t - ta) / BW : (tb - t) / BW) * 2 / 3, fv = o => (o - f0) / (f1 - f0);
    for (let t = ta + .15; t < tb - .2; t += 3) for (let o = f0; o < f1 - .2; o += 3) {
      const t2 = Math.min(t + 3, tb - .15), o2 = Math.min(o + 3, f1 - .3), C = bake.C, V = (tt, oo) => vtx(C, P3(tt, oo, gy(tt, oo) + .1), nFl, fu(tt), fv(oo));
      quadB(C, V(t, o), V(t2, o), V(t2, o2), V(t, o2));
    }
    // 天花板：貼圖右上那一格
    { const C = bake.C, cu = t => 2 / 3 + (sgR > 0 ? (t - ta) / BW : (tb - t) / BW) / 3, cv = o => .5 + .5 * (o - f0) / (f1 - f0), V = (tt, oo) => vtx(C, P3(tt, oo, top - .005), [0, -1, 0], cu(tt), cv(oo));
      quadB(C, V(ta + .15, f0 + .7), V(tb - .15, f0 + .7), V(tb - .15, f1 - .3), V(ta + .15, f1 - .3)); }
    // 兩面隔間牆：站在車間裡面對牆，左到右是 u（左牆朝 +U、右邊的牆朝 −U）
    { const x0 = (j % 2) * .5, va = 1 - ((j >> 1) + 1) / 6, vb = 1 - (j >> 1) / 6, vT = va + (vb - va) * Math.min(1, (top - b.lo - .1) / WH);
      const L = sgR > 0 ? [x0, x0 + .5] : [x0 + .5, x0];
      wallQ(bake.A, ta + .162, WL0, ta + .162, WL1, top, L[0], L[1], va, vT, nU, 6);
      wallQ(bake.A, tb - .162, WL0, tb - .162, WL1, top, L[1], L[0], va, vT, neg(nU), 6); }
    // 後牆：面對它，左到右是 u
    { const x0 = (j % 2) * .5, va = 1 - ((j >> 1) + 1) / 6, vb = 1 - (j >> 1) / 6, vT = va + (vb - va) * Math.min(1, (top - b.lo - .1) / WH), L = sgR > 0 ? [x0, x0 + .5] : [x0 + .5, x0];
      wallQ(bake.B, ta + .15, f1 - .312, tb - .15, f1 - .312, top, L[0], L[1], va, vT, neg(nN), 4); }
    // 吊掛的計時螢幕：朝維修道與朝車間裡各一面
    for (const e of [-1, 0, 1]) for (const sd of [-1, 1]) scrQ(b.tc + e * 1.1, f0 + 3.4 + sd * .041, top - 1.05, .9, .52, sd, hsh(b.i * 3 + e + 7, sd + 9) * 6 | 0);
  }
  // 計時台的螢幕（朝站台後面的凳子，+N）
  for (const s of stands) for (let q = -2; q <= 2; q++) scrQ(s.tc + q * 1.15, s.oc - .51, s.yd + 1.12, .85, .5, 1, (q + 2 + (s.tc | 0)) % 6);
  // 螢幕：中心 (t, o, y)、寬 w 高 h，sd = 1 朝 +N；貼圖 D 的第 kind 格（2 欄 3 列）
  function scrQ(t, o, y, w, h, sd, kind) {
    const B = bake.D, n = sd > 0 ? nN : neg(nN), r = -sd * sgR, u0 = (kind % 2) * .5, v1 = 1 - (kind >> 1) / 3, v0 = v1 - 1 / 3;
    const V = (dt, dy, u, v) => vtx(B, P3(t + dt * r, o, y + dy), n, u, v);
    quadB(B, V(-w / 2, -h / 2, u0, v0), V(w / 2, -h / 2, u0 + .5, v0), V(w / 2, h / 2, u0 + .5, v1), V(-w / 2, h / 2, u0, v1));
  }
  // ─── 工作車道的柏油（MAT.roadConn 同一份著色器，aUV 橫向加 40：不畫城裡的標線）：維修道路面邊到車間門口，兩端 10 m 收窄到維修道邊 ───
  {
    const R0 = MAT.roadConn, mat = new T.ShaderMaterial({ name: R0.name, uniforms: R0.uniforms, vertexShader: R0.vertexShader, fragmentShader: R0.fragmentShader, side: R0.side, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    gfxLate.push(mat);
    const P = [], NN = [], UV = [], AX = [], I = [], os = [0, .33, .66, 1];
    let row = 0;
    for (let t = t0 - 12; t <= t1 + 12.01; t += 3, row++) {
      const w = sm01(Math.min(t - (t0 - 12), t1 + 12 - t) / 10), o1 = HW + .5 + (f0 - .02 - HW - .5) * w;
      for (const f of os) { const o = HW - .25 + (o1 - HW + .25) * f, [X, Y, Z] = P3(t, o, Math.max(gy(t, o) + .1, o < HW ? yl(t) - .02 : -1e9)); P.push(X, Y, Z); NN.push(0, 1, 0); UV.push(o + 40, t); AX.push(NX, NZ); }
      if (row) for (let q = 0; q < os.length - 1; q++) { const a = (row - 1) * os.length + q, c = row * os.length + q; I.push(a, c, a + 1, a + 1, c, c + 1); }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(NN, 3));
    g.setAttribute('aUV', new T.Float32BufferAttribute(UV, 2)); g.setAttribute('aAx', new T.Float32BufferAttribute(AX, 2)); g.setIndex(I); g.computeVertexNormals(); g.computeBoundingSphere();
    const m = new T.Mesh(g, mat); m.name = 'nbrPitApron'; nbrGround(m);
  }
  // ─── 車隊名牌（雨棚外緣的封板上，每間一塊；圖集一隊一格，名稱＋白色編號另畫在右邊）───
  {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 1024; const cx = cv.getContext('2d'), rowH = 1024 / TEAMS.length;
    TEAMS.forEach(([nm, c], i) => {
      const y = i * rowH; cx.fillStyle = '#1c1e21'; cx.fillRect(0, y, 1024, rowH); cx.fillStyle = '#' + c.toString(16).padStart(6, '0'); cx.fillRect(0, y + 6, 26, rowH - 12);
      cx.fillStyle = '#f2f2ee'; cx.textBaseline = 'middle'; let fs = 52; do { cx.font = `800 ${fs}px "Helvetica Neue",Arial,system-ui,sans-serif`; fs -= 2; } while (cx.measureText(nm).width > 900 && fs > 20); cx.fillText(nm, 48, y + rowH / 2 + 2);
    });
    const Pq = [], UVq = [], Iq = [], sgR = Math.sign(PB.uz * PB.nx - PB.ux * PB.nz) || 1;   // 從維修道看車間，U 朝右手邊是 1（字從左到右）
    for (const b of box) {
      const j = (b.i >> 1) % TEAMS.length, v0 = 1 - (j + 1) / TEAMS.length, v1 = 1 - j / TEAMS.length, s = b.sec, y = s.yb - .45, o = f0 - 3.4 + .06 - .065, w = BW - 2.2, base = Pq.length / 3;
      for (const [a, h] of [[-w / 2, -.28], [w / 2, -.28], [w / 2, .28], [-w / 2, .28]]) Pq.push(...P3(b.tc + a * sgR, o, y + h));
      UVq.push(0, v0, 1, v0, 1, v1, 0, v1); Iq.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(Pq, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(UVq, 2)); g.setIndex(Iq); g.computeVertexNormals(); g.computeBoundingSphere();
    const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 8;
    const mat = new T.MeshBasicMaterial({ map: tx, toneMapped: false, side: T.DoubleSide, color: 0x6a6a6a }), m = new T.Mesh(g, mat); m.name = 'nbrPitSigns';
    m.onBeforeRender = () => mat.color.setScalar(.25 + .3 * U.uDay.value);   // 封板上是燈箱：夜裡也看得到
    cityAdd(m, null);
  }
  // ─── 夜裡車間透出來的光：門口的工作車道鋪一片加算混色的光暈（車間裡的光已經畫在烘焙貼圖裡；白天不畫）───
  {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const cx = cv.getContext('2d'), gr = cx.createRadialGradient(64, 80, 6, 64, 72, 70);
    gr.addColorStop(0, 'rgba(240,244,255,1)'); gr.addColorStop(.55, 'rgba(236,240,255,.5)'); gr.addColorStop(1, 'rgba(230,236,255,0)');   // 車間的冷白 LED cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
    const P = [], UVg = [], I = [];
    for (const b of box) {   // 3 m 一格貼著地板（一整片的平面會沉到起伏的地板下面）
      const T0 = b.ta + .3, T1 = b.tb - .3, O0 = f0 - 5, O1 = f0 + 1.5, nt = 4, no = Math.ceil((O1 - O0) / 3), base = P.length / 3;
      for (let q = 0; q <= no; q++) for (let r = 0; r <= nt; r++) { const t = T0 + (T1 - T0) * r / nt, o = O0 + (O1 - O0) * q / no; P.push(...P3(t, o, gy(t, o) + .14)); UVg.push(r / nt, .92 - .55 * q / no); }   // 光暈最亮的一圈（貼圖 v ≈ .37）在門口
      for (let q = 0; q < no; q++) for (let r = 0; r < nt; r++) { const a = base + q * (nt + 1) + r, c = a + nt + 1; I.push(a, a + 1, c + 1, a, c + 1, c); }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(UVg, 2)); g.setIndex(I); g.computeBoundingSphere();
    const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace;
    const mat = new T.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, side: T.DoubleSide, color: 0 }), m = new T.Mesh(g, mat);
    m.name = 'nbrPitGlow'; m.renderOrder = 2;
    m.onBeforeRender = () => mat.color.setScalar(.16 * clamp(1 - U.uDay.value * 1.6, 0, 1));
    cityAdd(m, null);
  }
  // 樹與路避開：大樓與門口車道標進 NBR.roadR（50-nbr.js 不種樹）
  if (NBR.roadR) { const N = nbrGrid(); for (let t = t0 - 12; t <= t1 + 12; t += 4) for (let o = HW; o <= f1 + 4; o += 4) { const [x, z] = L2(t, o), i = Math.round((x - N.gx0) / NBR_G), j = Math.round((z - N.gz0) / NBR_G); if (i >= 0 && j >= 0 && i < N.nx && j < N.nz) NBR.roadR[j * N.nx + i] = 1; } }
  // ─── 道具（27-props.js）：鏡頭走近才下載，實例照 NBR_PIT_R 串流 ───
  const props = [];
  const place = (it, list) => { if (!it) return; for (const m of w2Inst(it, list, 0, NBR_PIT_R)) { m.name = 'nbrPitProps'; props.push(m); } st.props += list.length; };
  const at = (t, o, ry, dy = .1) => { const [X, Y, Z] = P3(t, o, gy(t, o) + dy); return { x: X, y: Y, z: Z, ry, s: 1, zn: null }; };
  const ryOf = (dx, dz) => Math.atan2(dx, dz), ryX = (dx, dz) => Math.atan2(-dz, dx);   // 模型的 +z（ryX：+x）朝世界 (dx, dz)
  let asked = false;
  const load = () => {
    asked = true;
    loadProps('nbr_pit').then(it => it && glbWarm(Object.values(it).flatMap(x => x.parts), null, true).then(() => {
      place(it.tyrecart, box.flatMap(b => [at(b.ta + 1.4, f1 - 2.4, ryOf(NX, NZ)), at(b.tb - 2.2, f0 + 3.6, ryOf(NX, NZ))]));
      place(it.pitboard, stands.map(s => { const [X, , Z] = P3(s.tc + 2.4, s.oc - .72, 0); return { x: X, y: s.yd + .15, z: Z, ry: ryOf(-NX, -NZ), s: 1, zn: null }; }));
      place(it.cabinets, box.flatMap(b => [at(b.ta + .32 + 2.13, f1 - .6, ryOf(-NX, -NZ)), at(b.tb - .32 - 2.13, f1 - .6, ryOf(-NX, -NZ))]));   // 後牆兩組，中間留空壓機的位置
      place(it.chest, box.map(b => at(b.tb - 1.05, f0 + 6.6, ryOf(-UX, -UZ))));
      place(it.jack, box.filter(b => hsh(b.i, 3) < .7).map(b => at(b.tc - 2.3, f0 + 3.2, ryX(NX, NZ))));
      place(it.extinguisher, box.map(b => at(b.ta + .5, f0 + 1.1, ryOf(-NX, -NZ))));
    }));
    loadProps('interior').then(it => it && it.toolcart && glbWarm(it.toolcart.parts, null, true).then(() => place(it.toolcart, box.map(b => at(b.ta + .75, f1 - 7, ryOf(UX, UZ))))));
    loadProps('chrome').then(it => it && glbWarm(['cw_tires', 'cw_air', 'cw_hoist'].flatMap(id => it[id] ? it[id].parts : []), null, true).then(() => {
      place(it.cw_tires, box.map(b => at(b.tb - .7, f1 - 3.6, ryOf(NX, NZ))));
      place(it.cw_air, box.filter(b => b.i % 2).map(b => at(b.tc, f1 - .95, RY)));
      place(it.cw_hoist, box.filter(b => b.i % 3 === 1).map(b => at(b.ta + 1.6, f1 - 11, RY)));   // 吊臂朝模型的 +x：轉成沿 U 朝隔間的另一邊
    }));
  };
  // 烘焙的室內面：幾何開場就建好，材質（26-glb.js 的 glbMaterial，開場時那個 part 還沒跑）第一次 tick 建；鏡頭 900 m 內才分幀畫貼圖，畫好前不顯示
  const bakeM = [];
  const bakeMk = () => {
    for (const [key, q] of Object.entries(bake)) {
      q.can = document.createElement('canvas'); q.can.width = q.cv; q.can.height = q.ch;
      const g = new T.BufferGeometry(), nv = q.p.length / 3, rep = (a) => { const f = new Float32Array(nv * a.length); for (let v = 0; v < nv; v++) f.set(a, v * a.length); return new T.BufferAttribute(f, a.length); };
      g.setAttribute('position', new T.Float32BufferAttribute(q.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(q.n, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(q.uv, 2));
      g.setAttribute('color', rep([.02, .02, .02, 1])); g.setAttribute('_pbr', rep([.9, 0, 0, 0])); g.setAttribute('_emi', rep([1, 1, 1, 0])); g.setAttribute('_win', rep([0]));
      g.setIndex(q.i); g.computeBoundingSphere();
      q.tex = new T.CanvasTexture(q.can); q.tex.colorSpace = T.SRGBColorSpace; q.tex.anisotropy = key === 'C' ? 8 : 4;
      q.mat = glbMaterial({ emissiveMap: q.tex, side: T.DoubleSide }, { uM: { value: new T.Vector4(0, 0, key === 'D' ? 1.25 : .62, 0) }, uPaint: { value: new T.Vector4(0, 0, 0, 0) } });
      gfxLate.push(q.mat);
      const m = new T.Mesh(g, q.mat); m.name = 'nbrPitBake' + key; m.visible = false; cityAdd(m, null); bakeM.push(m);
    }
    st.bake = bakeM.map(m => m.geometry.index.count / 3);
  };
  let painted = 0;
  const paint = () => {
    painted = 1;
    warmJob(async () => {
      const wc = warmClock(), { A, B, C, D } = bake, cA = A.can.getContext('2d'), cB = B.can.getContext('2d'), cC = C.can.getContext('2d'), cD = D.can.getContext('2d'), jobs = [];
      const gp = NBR.gp && NBR.gp.p.map(p => [-p[0], -p[1]]);   // SEA_FR 是真實座標轉 180°：轉回北朝上
      TEAMS.forEach(([nm, c], j) => {
        jobs.push(() => nbrPaintWall(nbrCell(cA, (j % 2) * 1024, (j >> 1) * 2048 / 6, 1024, 2048 / 6, WLm, WH), nm, c, j, false));
        jobs.push(() => nbrPaintWall(nbrCell(cB, (j % 2) * 512, (j >> 1) * 2048 / 6, 512, 2048 / 6, BW - .3, WH), nm, c, j, true));
      });
      jobs.push(() => nbrPaintFloor(nbrCell(cC, 0, 0, 1024 * 2 / 3, 1024, BW, f1 - f0, false)));
      jobs.push(() => nbrPaintCeil(nbrCell(cC, 1024 * 2 / 3, 0, 1024 / 3, 512, BW, f1 - f0, false)));
      for (let q = 0; q < 6; q++) jobs.push(() => nbrPaintScreen(nbrCell(cD, (q % 2) * 256, (q >> 1) * 512 / 3, 256, 512 / 3, 1, 1), q, gp));
      const t0 = performance.now();
      for (const f of jobs) { f(); await wc.tick(); }
      st.paintMs = Math.round(wc.ms()); st.paintWall = Math.round(performance.now() - t0);
      for (const q of Object.values(bake)) q.tex.needsUpdate = true;
      await glbWarm(bakeM, null, false);
      for (const m of bakeM) m.visible = true;
    });
  };
  // 細模與道具：鏡頭到大樓的距離
  const [cX, cZ] = W(...L2((t0 + t1) / 2, (f0 + f1) / 2)), half = (t1 - t0) / 2 + 30;
  NBR_TICK.push(() => {
    const d = Math.max(0, Math.hypot(camera.position.x - cX, camera.position.z - cZ) - half), det = d < SET.fac * Math.min(1.2, detailK());
    facDet.visible = det; facFar.visible = !det;
    if (!asked && d < 600 && W2.on) load();
    if (!bakeM.length) bakeMk();
    if (!painted && d < 900) paint();
  });
  // 換胎（61-nbr-pit.js）：世界座標 → 第幾間（停在那一間門口的工作車道或車間裡），−1 是不在
  // 車間地坪與門口的工作車道（地形 + 10 cm，同上面的網格）：09-nbr.js 的 nbrDeck 先問這裡，車開進車間輪子才不會陷進去。維修道路面（o < HW）照賽道
  NBR.pitFloor = (x, z) => {
    const dx = x - PB.A[0], dz = z - PB.A[1], t = dx * PB.ux + dz * PB.uz, o = dx * PB.nx + dz * PB.nz;
    if (t < t0 - 12 || t > t1 + 12 || o < HW - .25) return null;
    const w = sm01(Math.min(t - (t0 - 12), t1 + 12 - t) / 10), o1 = HW + .5 + (f0 - .02 - HW - .5) * w;
    return o > (t >= t0 && t <= t1 ? f1 - .3 : o1) ? null : nbrMeshL(x, z) + .1;
  };
  NBR.pitStop = {
    n, BW,
    boxAt(X, Z) {
      const [x, z] = nbrL(X, Z), dx = x - PB.A[0], dz = z - PB.A[1], t = dx * PB.ux + dz * PB.uz, o = dx * PB.nx + dz * PB.nz, i = Math.floor((t - t0) / BW);
      return i >= 0 && i < n && o > HW - 2.5 && o < f1 - 2 ? i : -1;
    },
    name: i => `第 ${i + 1} 號維修區 · ${team(i)[0]}`,
    pos: (i, o = HW + 3, dt = 0) => { const t = box[i].tc + dt, [X, Y, Z] = P3(t, o, gy(t, o)); return { x: X, y: Y, z: Z }; },   // 驗收：那一間門口的工作車道（o 離維修道中心線、dt 沿線偏移）
    yaw: Math.atan2(NX, NZ),   // 車頭朝車間
    // 每間天花板下前後兩盞點光（61-nbr-pit.js 放進 60-venues.js 的 outLights，99-main.js 每幀挑鏡頭附近的幾盞）：車間裡的道具與車才有燈照
    // （牆、地板、天花板的光畫在烘焙貼圖裡；路燈表 lampTable 是涵蓋全部燈的方格貼圖，紐柏林離城好幾公里，放進去整張會大好幾倍）
    lights: box.flatMap(b => [f0 + 5, f1 - 5].map(o => { const [X, Y, Z] = P3(b.tc, o, b.top - 1); return { x: X, y: Y, z: Z }; })),
  };
  NBR.api.pit = () => ({ ...st, live: props.length, det: facDet.visible, f0, f1, hw: HW, yaw: NBR.pitStop.yaw });
  NBR.api.pitPos = (i, o, dt) => NBR.pitStop.pos(i, o, dt); NBR.api.pitBox = (X, Z) => NBR.pitStop.boxAt(X, Z);
}
