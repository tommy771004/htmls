// ═══ 第五部曲之五：霓峰塔工地的 250 m 塔吊（neon_nightcity_gta_v3.md「城市建築設施藍圖」一之 3）═══
// 10-city.js 的 FAC.crane 街區 (4,3)：西半是蓋到 202 m 的框架大樓（Stas Gunko 的 Construction 切成底層／標準層／頂層三段疊上去，兩份背對背），
// 屋頂是鋼板平台加停機坪（直升機可以直接降落）；東邊是 Cem Alagozlu 的 Liebherr 塔吊（桅桿標準節疊 78 節，旋轉機構與吊臂在 232.8 m，塔尖約 253 m）。
// 上去的路：桅桿東面的黃色直梯從地面爬到吊臂（約 40 秒，69-v5-civic.js 的 L.sp），在 202 m 的附著平台可以踏上連接橋走到大樓屋頂；
// 吊臂末端放著一箱重型狙擊槍（站在 120 m 以上用狙擊鏡，射程與倍率加倍，perchK）；吊臂、屋頂邊上按空白鍵往下跳、開傘。
// 座標：大樓的矩形 F.tower 是邏輯絕對座標（10-city.js 轉好的），桅桿 F.mast 是設施座標；吊臂的步行面在自己的仿射框 CR.f（原點是桅桿中心，+X 朝吊臂的反方向）。
// 以檔案開啟（或模型還沒下載完）畫程式建模的替身；下載後近處換成模型，LOD_R 以外仍畫替身。

const CR = { on: false, glb: null, fb: [], caseM: null, caseT: 0, lod: -1, hint: 0 };
const CR_SEC = 2.98, CR_N = 78, CR_PAD = .6, CR_TOP = CR_PAD + (CR_N - 1) * CR_SEC + 2.7;   // 標準節間距（模型 1.6556 × 1.8）、節數、混凝土基礎厚
const CR_JIB = CR_TOP + 6.2, CR_PEAK = CR_TOP + 20.6, CR_DECK = 202.3, CR_LOD = 700, CR_CASE_RE = 120;
const CR_FL = 4, CR_MID = 12, CR_MIDS = 15;   // 程式替身的樓高；模型：底層 13 m、標準層 12 m × 15、頂層 9 m
if (FAC.crane) {
  const F = FAC.crane, zn = facZn(F), Tw = F.tower, [mbx, mbz] = F.mast, mx = F.ax + mbx, mz = F.az + mbz;
  const tcx = (Tw.x0 + Tw.x1) / 2, tcz = (Tw.z0 + Tw.z1) / 2;
  CR.on = true; CR.F = F; CR.mx = mx; CR.mz = mz;
  // 吊臂的座標框：frameM4 在桅桿那一點的仿射部分（模型實例也用同一個矩陣，畫面和步行面一致）
  const M = frameM4(zn, mx, mz).elements;
  CR.f = frameA(M[0] * mx + M[8] * mz + M[12], M[2] * mx + M[10] * mz + M[14], M[0], M[8], M[2], M[10]);
  const YEL = 0xf2c12e, IRON = 0x3c3f42, CONC = 0x9a968e, ORG = 0xff7a1a;
  // ─── 程式建模：大樓的樓板與柱子、塔吊的桅桿與吊臂（以檔案開啟、遠景）───
  const kt = new Kit(), kc = new Kit(), kl = new Kit(), ks = new Kit();
  const rod = (k, ax, ay, az, bx, by, bz, t, c, m = 2) => {   // 兩點之間的方桿（box 的 y 軸對準 a→b；YXZ 尤拉角：ry = atan2(dx, dz)、rx = acos(dy)）
    const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz);
    k.box((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, t, L, t, c, m, Math.acos(clamp(dy / L, -1, 1)), Math.atan2(dx, dz), 0);
  };
  const tw = Tw.x1 - Tw.x0, td = Tw.z1 - Tw.z0;
  for (let y = 0; y < CR_DECK - 2; y += CR_FL) kt.box(tcx, y + .15, tcz, tw - .6, .3, td - .6, CONC, 2);
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) kt.box(Tw.x0 + .6 + i * (tw - 1.2) / 4, CR_DECK / 2, Tw.z0 + .6 + j * (td - 1.2) / 4, .7, CR_DECK, .7, 0xb0aca4, 2);
  for (let y = CR_DECK - 14; y < CR_DECK - 1; y += CR_FL) for (const [x, z, sx, sz] of [[tcx, Tw.z0 + .2, tw, .05], [tcx, Tw.z1 - .2, tw, .05], [Tw.x0 + .2, tcz, .05, td], [Tw.x1 - .2, tcz, .05, td]]) kt.box(x, y + 2, z, sx, 3.4, sz, ORG, 2);   // 頂上幾層的安全網
  // 桅桿：四根主肢、每節每面一根斜撐與一根橫撐
  const H = .85;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) kc.box(mx + sx * H, CR_TOP / 2, mz + sz * H, .16, CR_TOP, .16, YEL, 2);
  for (let i = 0; i < CR_N; i++) {
    const y0 = CR_PAD + i * CR_SEC, y1 = y0 + CR_SEC, s = i % 2 ? 1 : -1;
    for (const f of [-1, 1]) {
      rod(kc, mx + f * H, y0, mz - s * H, mx + f * H, y1, mz + s * H, .09, YEL);
      rod(kc, mx - s * H, y0, mz + f * H, mx + s * H, y1, mz + f * H, .09, YEL);
      kc.box(mx + f * H, y0, mz, .08, .08, H * 2, YEL, 2).box(mx, y0, mz + f * H, H * 2, .08, .08, YEL, 2);
    }
  }
  kc.box(mx, CR_PAD / 2, mz, 2.5, CR_PAD, 2.5, CONC, 2);   // 混凝土基礎（只比桅桿寬一點：東面的直梯從地面起爬）
  // 旋轉機構、駕駛室、吊臂（三角桁架，下弦是走道）、平衡臂與配重、塔尖與拉桿
  kc.box(mx, CR_TOP + 1.2, mz, 3.2, 2.4, 3.2, YEL, 2).box(mx, CR_TOP + 3.2, mz, 2.6, 1.6, 2.6, IRON, 15);
  kc.box(mx - .6, CR_JIB + 1.3, mz + 1.8, 2.2, 2.4, 1.8, YEL, 2).box(mx - 1.72, CR_JIB + 1.5, mz + 1.8, .05, 1.4, 1.6, 0x9ad8ff, 1);
  const J0 = mx - 1.3, J1 = mx - 76, JT = CR_JIB + 2.7;
  for (const s of [-1, 1]) kc.box((J0 + J1) / 2, CR_JIB - .12, mz + s * 1.2, J0 - J1, .16, .16, YEL, 2);
  kc.box((J0 + J1) / 2, JT, mz, J0 - J1, .16, .16, YEL, 2).box((J0 + J1) / 2, CR_JIB - .05, mz, J0 - J1, .04, 1.9, 0x55585c, 15);
  for (let x = J0, n = 0; x > J1 + .5; x -= 2.5, n++) {
    for (const s of [-1, 1]) rod(kc, x, CR_JIB - .1, mz + s * 1.2, x - 1.25, JT, mz, .07, YEL);
    for (const s of [-1, 1]) rod(kc, x - 1.25, JT, mz, x - 2.5, CR_JIB - .1, mz + s * 1.2, .07, YEL);
    kc.box(x, CR_JIB - .1, mz, .07, .07, 2.4, YEL, 2);
  }
  const C1 = mx + 27;
  for (const s of [-1, 1]) kc.box((mx + 1.3 + C1) / 2, CR_JIB - .1, mz + s * 1.1, C1 - mx - 1.3, .3, .2, YEL, 2);
  kc.box((mx + 1.3 + C1) / 2, CR_JIB - .05, mz, C1 - mx - 1.3, .05, 2, 0x55585c, 15);
  for (let i = 0; i < 4; i++) kc.box(C1 - 2.4 - i * 1.25, CR_JIB - 1.6, mz, 1.1, 3, 2.4, CONC, 2);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) rod(kc, mx + sx * 1.2, CR_TOP + 4, mz + sz * 1.2, mx, CR_PEAK, mz, .22, YEL);
  rod(kc, mx, CR_PEAK, mz, mx - 40, JT, mz, .06, IRON, 15); rod(kc, mx, CR_PEAK, mz, mx - 74, JT, mz, .05, IRON, 15); rod(kc, mx, CR_PEAK, mz, C1 - 1, CR_JIB + .2, mz, .06, IRON, 15);
  kc.box(mx - 30, CR_JIB - .5, mz, 1.6, .8, 2.6, IRON, 15);   // 吊鉤小車
  rod(kc, mx - 30, CR_JIB - .9, mz, mx - 30, CR_JIB - 60, mz, .03, 0x222222, 15); kc.box(mx - 30, CR_JIB - 60.4, mz, .5, .8, .3, ORG, 2);
  // ─── 都要的部分：屋頂平台與停機坪、附著平台與連接橋、直梯、施工圍籬、航空障礙燈 ───
  // 屋頂平台：鋼板、邊上 1.1 m 的欄杆（北、南兩邊留給連接橋與跳下去的缺口在 roofJump）
  ks.box(tcx, CR_DECK - .17, tcz, tw, .34, td, 0x4c4f53, 15);
  for (const [x, z, sx, sz] of [[tcx, Tw.z0, tw, .06], [tcx, Tw.z1, tw, .06], [Tw.x0, tcz, .06, td]]) ks.box(x, CR_DECK + 1.05, z, sx, .06, sz, YEL, 2).box(x, CR_DECK + .55, z, sx, .05, sz, YEL, 2);
  for (const [z0, z1] of [[Tw.z0, mz - 1.2], [mz + 1.2, Tw.z1]]) ks.box(Tw.x1, CR_DECK + 1.05, (z0 + z1) / 2, .06, .06, z1 - z0, YEL, 2).box(Tw.x1, CR_DECK + .55, (z0 + z1) / 2, .06, .05, z1 - z0, YEL, 2);
  for (let x = Tw.x0; x <= Tw.x1 + .01; x += tw / 8) for (const z of [Tw.z0, Tw.z1]) ks.box(x, CR_DECK + .55, z, .06, 1.1, .06, YEL, 2);
  for (let z = Tw.z0; z <= Tw.z1 + .01; z += td / 8) ks.box(Tw.x0, CR_DECK + .55, z, .06, 1.1, .06, YEL, 2);
  v5Pad({ ax: 0, az: 0 }, tcx - 2, tcz, CR_DECK, ks);
  // 附著平台（桅桿四周，x 到桅桿東面）與連接橋（大樓東緣到平台）
  const RG = { x0: mx - 3, x1: mx + 1.6, z0: mz - 3, z1: mz + 3 }, BR = { x0: Tw.x1 - 1.3, x1: mx - 1.2, z0: mz - 1.2, z1: mz + 1.2 };
  ks.box((RG.x0 + RG.x1) / 2, CR_DECK - .1, (RG.z0 + RG.z1) / 2, RG.x1 - RG.x0, .2, RG.z1 - RG.z0, 0x55585c, 15);
  ks.box((Tw.x1 + RG.x0) / 2, CR_DECK - .1, mz, RG.x0 - Tw.x1, .2, BR.z1 - BR.z0, 0x55585c, 15);
  for (const s of [-1, 1]) {
    ks.box((Tw.x1 + RG.x0) / 2, CR_DECK + 1.05, mz + s * 1.2, RG.x0 - Tw.x1, .06, .06, YEL, 2).box((Tw.x1 + RG.x0) / 2, CR_DECK + .55, mz + s * 1.2, RG.x0 - Tw.x1, .05, .05, YEL, 2);
    for (let x = Tw.x1; x < RG.x0; x += 1.5) ks.box(x, CR_DECK + .55, mz + s * 1.2, .06, 1.1, .06, YEL, 2);
    ks.box((RG.x0 + RG.x1) / 2, CR_DECK + 1.05, mz + s * 3, RG.x1 - RG.x0, .06, .06, YEL, 2);
    rod(ks, Tw.x1, CR_DECK - 4, mz + s * 1.1, RG.x0, CR_DECK - .2, mz + s * 1.1, .14, YEL);   // 附著桿（斜撐到大樓）
  }
  ks.box(RG.x0, CR_DECK + 1.05, mz - 2.1, .06, .06, 1.8, YEL, 2).box(RG.x0, CR_DECK + 1.05, mz + 2.1, .06, .06, 1.8, YEL, 2);
  // 直梯：桅桿東面，從地面到吊臂的走道；黃色，2.4 m 以上有護籠（v5Ladder 畫）
  const ladK = new Kit();
  CR.lad = v5Ladder(F, mbx + 1, mbz, 1, 0, CR_JIB, [mbx - 1.8, mbz], ladK);
  CR.lad.name = '塔吊直梯'; CR.lad.sp = 6; CR.lad.fast = 9; CR.lad.slide = 14;
  CR.lad.stops = [{ y: CR_DECK, at: [mbx + .3, mbz + 2], name: '附著平台' }];
  // 施工圍籬（人行道內側 2.4 m，南面中間是大門）、工地看板
  const HO = { x0: 12.8, x1: 59.2, z0: 12.8, z1: 49.2 }, gate = [30, 40];
  const fence = (x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
    ks.box(F.ax + (x0 + x1) / 2, 1.2, F.az + (z0 + z1) / 2, .08, 2.4, L, 0xe8e4d8, 2, 0, ry).box(F.ax + (x0 + x1) / 2, 2.36, F.az + (z0 + z1) / 2, .1, .08, L + .02, 0x1f5c3a, 2, 0, ry);
    for (let s = 0; s <= L; s += 3) ks.box(F.ax + x0 + (x1 - x0) * s / L, 1.2, F.az + z0 + (z1 - z0) * s / L, .1, 2.42, .1, 0x1f5c3a, 2);
    v5Box(F, Math.min(x0, x1) - .1, Math.max(x0, x1) + .1, Math.min(z0, z1) - .1, Math.max(z0, z1) + .1, { hy: 2.5 });
  };
  fence(HO.x0, HO.z0, HO.x1, HO.z0); fence(HO.x0, HO.z0, HO.x0, HO.z1); fence(HO.x1, HO.z0, HO.x1, HO.z1);
  fence(HO.x0, HO.z1, gate[0], HO.z1); fence(gate[1], HO.z1, HO.x1, HO.z1);
  for (const x of gate) ks.box(F.ax + x, 1.5, F.az + HO.z1, .3, 3, .3, ORG, 2);
  // 碰撞：大樓（屋頂以下）、桅桿連基礎（駕駛室以下；吊臂走道在它上面）
  v5Box(F, Tw.x0 - F.ax, Tw.x1 - F.ax, Tw.z0 - F.az, Tw.z1 - F.az, { hy: CR_DECK - .3 });
  v5Box(F, mbx - 1, mbx + 1, mbz - 1, mbz + 1, { hy: CR_TOP }); v5Box(F, mbx - 1.25, mbx + 1.25, mbz - 1.25, mbz + 1.25, { hy: CR_PAD + .05 });
  // 日照陰影、直升機的屋頂高度（69-gunship.js 的 roofH）：大樓到平台、桅桿到旋轉機構
  hmRectL(Tw.x0, Tw.x1, Tw.z0, Tw.z1, CR_DECK, false, zn); hmRectL(mx - 1.2, mx + 1.2, mz - 1.2, mz + 1.2, CR_TOP + 4, false, zn); hmFlush();
  // 屋頂、連接橋與附著平台：一個步行面（矩形的聯集，各自往裡退 0.45 m 是欄杆；重疊讓接縫走得過去）
  const rects = [[Tw.x0, Tw.x1, Tw.z0, Tw.z1], [BR.x0, BR.x1 + .6, BR.z0, BR.z1], [RG.x0, RG.x1, RG.z0, RG.z1]];
  const inR = (x, z, e) => rects.some(r => x > r[0] + e && x < r[1] - e && z > r[2] + e && z < r[3] - e);
  WALKS.push({ zn, bb: [Tw.x0 - 1.5, RG.x1 + 1.5, Tw.z0 - 1.5, Tw.z1 + 1.5], y(x, z, y0, cam) {
    if (y0 < CR_DECK - 2.5 || y0 > CR_DECK + 6) return undefined;
    if (inR(x, z, .45)) return CR_DECK;
    return cam && inR(x, z, 0) ? CR_DECK : null;
  } });
  V5.roofs.push({ F, L: { x0: Tw.x0, x1: Tw.x1, z0: Tw.z0, z1: Tw.z1, zn, h: CR_DECK }, h: CR_DECK, bb: [Tw.x0, Tw.x1, Tw.z0, Tw.z1], solid: [] });
  // 吊臂走道：框 CR.f 裡 X ∈ [−76, −1.3]、Z ∈ [−1.2, 1.2]（下弦之間），走得到的是中間 1.9 m
  const JB = { x0: -76, x1: -1.3, z0: -1.25, z1: 1.25 };
  WALKS.push({ zn: CR.f, bb: [JB.x0 - 1.5, JB.x1 + 1.5, JB.z0 - 1.5, JB.z1 + 1.5], y(x, z, y0, cam) {
    if (y0 < CR_JIB - 2.5 || y0 > CR_JIB + 8) return undefined;
    if (x > JB.x0 + .4 && x < JB.x1 - .1 && Math.abs(z) < .95) return CR_JIB;
    return cam && x > JB.x0 && x < JB.x1 && Math.abs(z) < 1.3 ? CR_JIB : null;
  } });
  V5.roofs.push({ F, L: { ...JB, zn: CR.f, h: CR_JIB }, h: CR_JIB, bb: [JB.x0, JB.x1, JB.z0, JB.z1], solid: [] });
  // 航空障礙燈（紅色閃爍）：吊臂末端、平衡臂末端、塔尖、屋頂四角
  for (const [x, y, z] of [[mx - 76, JT + .3, mz], [C1, CR_JIB + .5, mz], [mx, CR_PEAK + .4, mz], [Tw.x0, CR_DECK + 1.4, Tw.z0], [Tw.x1, CR_DECK + 1.4, Tw.z0], [Tw.x0, CR_DECK + 1.4, Tw.z1], [Tw.x1, CR_DECK + 1.4, Tw.z1]]) kl.box(x, y, z, .45, .45, .45, 0xff2020, 9);
  // 吊臂末端的狙擊槍箱（下面 craneUpdate 撿）
  const ck = new Kit();
  ck.box(0, .16, 0, 1.3, .32, .4, 0x2f3a2a, 2).box(0, .33, 0, 1.32, .03, .42, 0x1c221a, 2).box(-.4, .2, -.21, .12, .08, .02, 0xd8c040, 3).box(.4, .2, -.21, .12, .08, .02, 0xd8c040, 3);
  ck.cyl(0, .01, 0, .9, .9, .02, 20, 0xffd23a, 8);
  CR.caseAt = toW(-73, 0, CR.f);
  { const [dx, dz] = dirW(CR.f, 1, 0); CR.caseM = new T.Mesh(ck.build(), MAT.uber); CR.caseM.position.set(CR.caseAt[0], CR_JIB, CR.caseAt[1]); CR.caseM.rotation.y = Math.atan2(-dz, dx); scene.add(CR.caseM); }   // 框是世界座標：直接擺
  // 合併、掛上去
  const fbT = new T.Mesh(kt.build(), MAT.uber), fbC = new T.Mesh(kc.build(), MAT.uber);
  cityAdd(fbT, zn); cityAdd(fbC, zn); CR.fb = [fbT, fbC];
  cityAdd(new T.Mesh(ks.build(), MAT.uber), zn); cityAdd(new T.Mesh(ladK.build(), MAT.uber), zn); cityAdd(new T.Mesh(kl.build(), MAT.uber), zn);
  v5Put(F, v5Sign([['霓峰塔  NEON SPIRE', .36, '#ffffff', .34], ['地上 52 層 · 202 m · 施工中  閒人勿進', .2, '#ffd23a', .74]], 9, 2.2, { bg: '#13261c', edge: '#ffd23a' }), (gate[0] + gate[1]) / 2 - 10, 2.6, HO.z1 + .08, 0);
  v5Put(F, v5Sign([['塔吊直梯 · 約 40 秒 →', .42, '#1a1a1a', .5]], 2.2, .5, { bg: '#ffd23a' }), mbx, 2.4, mbz + 1.3, 0);
  v5Light(F, tcx - F.ax - 2, CR_DECK + 3, tcz - F.az, 0xd0ffe0, 16, .8);
  v5Light(F, mbx + 1.5, 3, mbz, 0xfff0d0, 9, .8);
  // ─── 模型（http(s)）：大樓三段、桅桿 78 節、塔頂；工寮與材料棚 ───
  if (GLB_ON) Promise.all([loadProps('v5tower'), loadProps('v5crane'), loadProps('v5site')]).then(([TW, CN, ST]) => {
    if (!TW || !CN) return;
    const zA = tcz - 6.54, zB = tcz + 6.54, lst = y => [{ x: tcx, y, z: zA, ry: 0, zn }, { x: tcx, y, z: zB, ry: Math.PI, zn }];
    const ms = [...w2Inst(TW.base, lst(0)), ...w2Inst(TW.mid, Array.from({ length: CR_MIDS }, (_, i) => lst(13 + i * CR_MID)).flat()), ...w2Inst(TW.top, lst(13 + CR_MIDS * CR_MID))];
    ms.push(...w2Inst(CN.cr_mast, Array.from({ length: CR_N }, (_, i) => ({ x: mx, y: CR_PAD + i * CR_SEC, z: mz, zn }))));
    ms.push(...w2Inst(CN.cr_top, [{ x: mx, y: CR_TOP, z: mz, ry: -Math.PI / 2, zn }]));
    CR.glb = ms;
    if (ST) {   // 工寮（大門西邊）、材料棚（東南角）；碰撞照模型的外框
      for (const [id, bx, bz] of [['site1', 25, 44.2], ['site4', 54.3, 41]]) {
        const it = ST[id]; if (!it) continue;
        w2Inst(it, [{ x: F.ax + bx, y: 0, z: F.az + bz, zn }]);
        addBoxL({ x0: F.ax + bx - it.w / 2, x1: F.ax + bx + it.w / 2, z0: F.az + bz - it.d / 2, z1: F.az + bz + it.d / 2, zn, hy: it.h });
      }
    }
    CR.lod = -1;
  });
}
// 走在吊臂上（202 m 屋頂以上）：街區的整塊碰撞盒沒有高度上限，吊臂伸到隔壁街區上空會被擋住，所以不算碰撞（40-people.js）
const skyWalk = () => CR.on && player.y > CR_DECK + 10;   // 推開人的 kinWalk 也會先算一次碰撞，一起跳過
// 站在 120 m 以上用狙擊鏡：射程 ×4、鏡頭倍率 ×2（69-combat.js 的 castRay、99-main.js 的 fov）
const perchK = A => (A && A.scope && player.mode === 'walk' && player.y > 120 ? 4 : 1);
const scopeK = () => (arm.zoomK > .5 && player.mode === 'walk' && player.y > 120 ? 2 : 1);
// 每幀（69-v5-civic.js 的 v5Update 呼叫）
function craneUpdate(dt) {
  if (!CR.on || !cityIsWorld) return;
  // 近處畫模型、遠處畫替身（以檔案開啟只有替身）
  if (CR.glb) {
    const [tx, tz] = toW(0, 0, CR.f), near = Math.hypot(camera.position.x - tx, camera.position.z - tz) < CR_LOD * detailK() ? 1 : 0;
    if (near !== CR.lod) { CR.lod = near; for (const m of CR.glb) m.visible = !!near; for (const m of CR.fb) m.visible = !near; }
  }
  // 狙擊槍箱
  const M = CR.caseM;
  if (CR.caseT > 0 && (CR.caseT -= dt) <= 0) M.visible = true;
  if (M.visible && player.mode === 'walk' && Math.abs(player.y - CR_JIB) < 1 && Math.hypot(player.x - CR.caseAt[0], player.z - CR.caseAt[1]) < 1.3) {
    const a = arm.ammo.sniper; a.res += 30; a.mag = ARMS.sniper.mag;
    equip('sniper', true); M.visible = false; CR.caseT = CR_CASE_RE; sfx.pickup();
    toast('重型狙擊槍 · 彈藥 +30 · 在這個高度用狙擊鏡射程與倍率加倍');
  }
  // 第一次爬到吊臂：提示
  if (!CR.hint && player.mode === 'walk' && Math.abs(player.y - CR_JIB) < 1) { CR.hint = 1; toast('吊臂走道 · 末端有狙擊槍箱 · 邊上按空白鍵往下跳，按 F 開傘'); }
}
// 測試 API（window.__nc.gta.v5.crane）
gtaApi.v5.crane = { CR, TOP: CR_TOP, JIB: CR_JIB, DECK: CR_DECK, PEAK: CR_PEAK, jib: (X, Z = 0) => toW(X, Z, CR.f), lad: (top) => ladStart(CR.lad, top), perchK, scopeK };
