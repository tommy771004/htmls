// ═══ 第九部曲之三：排水道（HANDOFF「大型地景」的排水道）═══
// 三個入口共用一段地下箱涵（場館 'drain'）：河岸擋牆上的排水口（游泳靠近按 E）與兩個人行道上的人孔蓋（走到上面按 E）。
// 箱涵是 SPLEEN VISION 的 dirty tunnel（props/drain.glb，照片掃描的混凝土箱涵）：dr_mouth 整段（兩端有黃黑警示條的端牆）
// 在河岸與場館的西端各擺一份，dr_seg 是中間 6.4 m 那一段，放大 DR_S 倍沿 +x 接成兩條各 DR_RUN 段的隧道；
// 中間與東端是程式建模的檢查井（豎井、爬梯、頂上的人孔透下來的光），各通一個人孔。東端的檢查井裡有一袋走私現金。
// 場館座標：西端排水口的開口在 x 0，隧道中心線 z 0、地板 y 0，往東 x 變大。以檔案開啟（或模型還沒下載好）用程式建模的替身。
const DR_S = 1.6;                                   // 掃描箱涵內部只有 2.6 × 1.55 m，放大成 4.2 × 2.5 m
const DR_HALF = 3.2 * DR_S, DR_SEG = 6.3 * DR_S;    // 一段 10.24 m、每 10.08 m 擺一段（重疊 0.16 m 蓋住切口的鋸齒）
const DR_MOUTH = 4.45 * DR_S, DR_RUN = 4, DR_CH = 7;
const DR_W = 1.95, DR_H = 2.45, DR_CHW = 3.3, DR_CHH = 4.4, DR_SHAFT = 7.2;   // 隧道內半寬與高；檢查井半寬、天花板與豎井頂
const DR_IN_R = 5, DR_HOLE_R = 1.5, DR_LAD_R = 1.4, DR_STASH = 1800, DR_STASH_T = 20 * 60;   // 走私包 $1,800，真實時間 20 分鐘後再放一袋
const DR_X = (() => {
  const m = 2 * DR_MOUTH, r1 = m + DR_RUN * DR_SEG, b1 = r1 + DR_CH, r2 = b1 + DR_RUN * DR_SEG;
  return { mouth: m, run1: [m, r1], chB: [r1, b1], run2: [b1, r2], chA: [r2, r2 + DR_CH] };
})();
ENV.drain = { lampOn: 0, wet: 0, fogDen: .045, fog: 0x0c0f0b, fogHi: 0x121611, top: 0x5c6254, bot: 0x22261f, post: { exp: 1.12, thr: 1.8, bloom: .55, knee: 1.0, range: .85 } };

const DR = { ents: [], stash: { x: DR_X.chA[1] - 1.4, z: -2.5, next: 0 }, stats: { in: 0, cash: 0 } };
const drScene = new T.Scene();
const drData = { boxes: [], circles: [], lights: [] };

// ─── 河岸的排水口：外緣擋牆上的梯子（10-city.js 的 LADDERS，世界座標）旁邊 8 m，沿岸前後都是水、背後是陸地，
// 選身後人行道最多的那一座（排水道通到市區）。箱涵從擋牆往河裡伸出半段（擋牆的石砌護岸是一整片平面，開口不能貼著它），
// 底在水面下 0.25 m、頂和岸上齊平，開口在外緣往外 4.45 m（擋牆的低牆往外 4 m 都擋著游泳的人，剛好游得到開口前）───
{
  const walk = sideSpots.map(s => toW(s.x, s.z));
  let best = null;
  for (const L of LADDERS) {
    if (!L.w || !L.ok) continue;
    const tx = L.nz, tz = -L.nx;   // 沿著岸
    for (const sd of [1, -1]) {
      const mx = L.x + tx * 8 * sd, mz = L.z + tz * 8 * sd;
      let ok = true;
      for (let a = -2.5; a <= 2.5 && ok; a += 1.25) {
        const x = mx + tx * a, z = mz + tz * a;
        if (landW(x + L.nx * .6, z + L.nz * .6) || !landW(x - L.nx * 3, z - L.nz * 3)) ok = false;
      }
      if (!ok || LADDERS.some(o => o !== L && Math.hypot(o.x - mx, o.z - mz) < 14)) continue;
      const n = walk.filter(([x, z]) => Math.hypot(x - mx, z - mz) < 260).length;
      if (!best || n > best.n) best = { n, x: mx, z: mz, nx: L.nx, nz: L.nz };
    }
  }
  if (best) {
    const { x, z, nx, nz } = best, ry = Math.atan2(nx, nz);
    DR.ents.push({
      kind: 'mouth', name: '河濱排水口', X: x, Z: z, nx, nz, ry,
      front: [x + nx * 5.8, z + nz * 5.8],                           // 游泳靠近開口的那一點
      out: { x: x + nx * 7, z: z + nz * 7, yaw: ry },                // 出來的時候在水裡，面向外
      spawn: { x: 2.4, z: 0, yaw: Math.PI / 2 }, exitAt: [1.4, 0],
    });
  }
}
// ─── 人孔：人行道上（20-props.js 的 sideSpots 往內 1.5 m）離排水口 70–300 m、彼此 150 m 以上的兩個空位 ───
{
  const M = DR.ents[0], cand = [];
  if (M) for (const s of sideSpots) {
    const lx = s.ax === 'z' ? s.x : s.x - s.nx * 1.5, lz = s.ax === 'z' ? s.z - s.nz * 1.5 : s.z;
    if (groundHL(lx, lz) <= 0 || !free(lx, lz, 1.1)) continue;
    const [X, Z] = toW(lx, lz), d = Math.hypot(X - M.X, Z - M.Z);
    if (d > 70 && d < 300) cand.push({ x: lx, z: lz, d, ry: s.ry });
  }
  cand.sort((a, b) => a.d - b.d);
  const pick = [];
  for (const c of cand) {
    if (pick.length >= 2) break;
    if (pick.some(p => Math.hypot(p.x - c.x, p.z - c.z) < 150)) continue;
    pick.push(c);
  }
  // 近的那個通到中間的檢查井，遠的通到東端；同一區的兩個人孔加上一號、二號
  const names = pick.map(c => district(c.x, c.z).split(' ')[0]);
  pick.forEach((c, i) => {
    claim(c.x, c.z, 1.1);
    const cn = names[0] === names[1] ? names[i] + ['一號', '二號'][i] : names[i], ch = i ? DR_X.chA : DR_X.chB, cx = (ch[0] + ch[1]) / 2;
    DR.ents.push({
      kind: 'hole', name: `${cn}人孔`, x: c.x, z: c.z, zn: zoneAtL(c.x, c.z), ry: c.ry,
      out: { x: c.x - Math.sin(c.ry) * .9, z: c.z - Math.cos(c.ry) * .9, yaw: c.ry + Math.PI },   // sideSpots 的 ry 朝街區裡：站到人孔的街道那一側、面向馬路
      spawn: { x: cx, z: DR_CHW - 1.3, yaw: Math.PI }, exitAt: [cx, DR_CHW - .5], ch: i ? 'A' : 'B',
    });
  });
}
const drHoles = DR.ents.filter(e => e.kind === 'hole');
// 街上的畫面：排水口（模型；替身是端牆與黑洞）與人孔蓋（鑄鐵圓蓋，程式建模）
{
  const M = DR.ents[0];
  if (M) {
    const k = new Kit(), at = (a, o, y) => [M.X + M.nz * a + M.nx * o, y, M.Z - M.nx * a + M.nz * o];
    const y0 = SEA_Y - .25;
    // 替身：伸出去的箱身（頂、兩側）與端牆，開口裡面黑的
    k.box(...at(0, 2.25, y0 + 1.76), 3, .16, 4.5, 0x6e6a60, 2, 0, M.ry);
    for (const s of [-1, 1]) k.box(...at(s * 1.42, 2.25, y0 + .92), .16, 1.84, 4.5, 0x6e6a60, 2, 0, M.ry);
    k.box(...at(0, 4.4, y0 + 1.72), 3.1, .24, .12, 0x6e6a60, 2, 0, M.ry);
    for (let i = 0; i < 9; i++) k.box(...at(-1.2 + i * .3, 4.47, y0 + 1.72), .15, .1, .02, i % 2 ? 0x15140f : 0xd8b020, 2, 0, M.ry);
    const fb = new T.Mesh(k.build(), MAT.uber); cityAdd(fb, null);
    if (GLB_ON) loadProps('drain').then(items => {
      if (!items || !items.dr_mouth) return;
      fb.removeFromParent();   // distCull 每幀重設 visible，替身要拿掉
      cityAdd(propObject(items.dr_mouth, M.X, y0, M.Z, M.ry, 1), null);
    });
    // 開口裡面：擋牆的護岸面前封一塊黑板（不然看進去是石牆）
    const bk = new Kit(); bk.box(...at(0, .06, y0 + .9), 2.9, 1.9, .06, 0x020302, 2, 0, M.ry); cityAdd(new T.Mesh(bk.build(), MAT.uber), null);
    // 游泳的人不能穿過伸出去的箱身
    for (const o of [1, 2.2, 3.4]) { const [cx, , cz] = at(0, o, 0); circles.push({ x: cx, z: cz, r: 1.55, w: 1 }); }
    // 端牆上方一盞籠罩燈
    const [lx, ly, lz] = at(1.2, 4.6, .3); outLights.push({ x: lx, y: ly, z: lz, col: lin(0xffc890), r: 8, i: .7, w: 1 });
    const lk = new Kit(); lk.box(...at(1.2, 4.5, .1), .18, .14, .22, 0xffd9a0, 11, 0, M.ry).box(...at(1.2, 4.4, .02), .06, .2, .06, 0x22252a, 15, 0, M.ry);
    cityAdd(new T.Mesh(lk.build(), MAT.uber), null);
  }
  for (const h of drHoles) {
    const k = new Kit();
    k.cyl(h.x, .158, h.z, .42, .42, .016, 20, 0x2a2824, 15).cyl(h.x, .168, h.z, .34, .34, .012, 20, 0x3a3730, 15);
    for (let i = -2; i <= 2; i++) k.box(h.x, .176, h.z + i * .12, .5 - Math.abs(i) * .07, .006, .04, 0x4a463e, 15, 0, h.ry);
    cityAdd(new T.Mesh(k.build(), MAT.uber), h.zn);
  }
}

// ─── 場館：碰撞與燈 ───
{
  const B = drData.boxes, box = (x0, x1, z0, z1) => B.push({ x0, x1, z0, z1 });
  const [b0, b1] = DR_X.chB, [a0, a1] = DR_X.chA;
  box(-30, .6, -30, 30);                                   // 排水口外（開口在 x 0，過了 x 0.6 就是河）
  box(-30, b0, DR_W, 30); box(-30, b0, -30, -DR_W);       // 西段的兩道牆
  box(b0, b1, DR_CHW, 30); box(b0, b1, -30, -DR_CHW);     // 中間檢查井
  box(b1, a0, DR_W, 30); box(b1, a0, -30, -DR_W);         // 東段
  box(a0, a1, DR_CHW, 30); box(a0, a1, -30, -DR_CHW);     // 東端檢查井
  box(a1, a1 + 30, -30, 30);
  drData.circles.push({ x: DR.stash.x, z: DR.stash.z, r: .35 });
  // 箱涵頂上隔兩段一盞籠罩燈（左右交錯），檢查井一盞、豎井頂透下來的冷光，排水口外的月光
  let s = 1;
  for (const [r0, r1] of [DR_X.run1, DR_X.run2]) for (let x = r0 + DR_SEG; x < r1; x += DR_SEG * 2) { drData.lights.push({ x, y: 2.2, z: s * 1.5, col: lin(0xffc488), r: 9, i: .8 }); s = -s; }
  for (const ch of [DR_X.chB, DR_X.chA]) {
    const cx = (ch[0] + ch[1]) / 2;
    drData.lights.push({ x: cx, y: 3.8, z: -1, col: lin(0xffd4a0), r: 9, i: .9 }, { x: cx, y: DR_SHAFT - .5, z: DR_CHW - .8, col: lin(0xa8c4e0), r: 6, i: .6 });
  }
  drData.lights.push({ x: -1.5, y: 1.6, z: 0, col: lin(0x8aa4c8), r: 10, i: .7 });
}
// 程式建模：箱涵替身（整條）、兩個檢查井、排水口外的河景、中間的水溝
{
  const con = 0x5e5d54, dk = 0x34332d;
  const fb = new Kit();
  for (const [r0, r1] of [DR_X.run1, DR_X.run2]) {
    const L = r1 - r0, cx = (r0 + r1) / 2;
    fb.box(cx, -.1, 0, L, .2, DR_W * 2 + .6, 0x5a5448, 2).box(cx, DR_H + .15, 0, L, .3, DR_W * 2 + .6, dk, 2);
    for (const s of [-1, 1]) fb.box(cx, DR_H / 2, s * (DR_W + .15), L, DR_H, .3, con, 2);
  }
  const fbM = new T.Mesh(fb.build(), MAT.uber); drScene.add(fbM);
  const list = [];
  for (const [r0] of [DR_X.run1, DR_X.run2]) for (let k = 0; k < DR_RUN; k++) list.push({ x: r0 + DR_SEG * k + DR_HALF - .08, z: 0, ry: Math.PI / 2, s: DR_S });
  propSwap('drain', fbM, 'dr_seg', list, drScene, null, 'drain');
  // 西端：排水口那一段（模型的 −z 端牆朝 −x，就是開口）
  const mk = new Kit();
  mk.box(DR_MOUTH, -.1, 0, DR_MOUTH * 2, .2, DR_W * 2 + .6, 0x5a5448, 2).box(DR_MOUTH, DR_H + .15, 0, DR_MOUTH * 2, .3, DR_W * 2 + .6, dk, 2);
  for (const s of [-1, 1]) mk.box(DR_MOUTH, DR_H / 2, s * (DR_W + .15), DR_MOUTH * 2, DR_H, .3, con, 2);
  for (let i = 0; i < 13; i++) mk.box(0, DR_H - .12, -1.8 + i * .3, .04, .16, .15, i % 2 ? 0x15140f : 0xd8b020, 2);
  const mkM = new T.Mesh(mk.build(), MAT.uber); drScene.add(mkM);
  propSwap('drain', mkM, 'dr_mouth', [{ x: DR_MOUTH, z: 0, ry: Math.PI / 2, s: DR_S }], drScene, null, 'drain');
  // 檢查井：牆（隧道接進來的那兩面留開口）、天花板與豎井、爬梯、管子、端牆的警示條。
  // 模型下載好在牆前疊三層從箱涵切出來的牆面（dr_wall 整道、dr_lintel 開口上方、dr_pier 開口兩側；每層錯開、往室內退 1.2 cm 免得互相閃爍），
  // 地面鋪 dr_floor 轉 90° 放大；天花板也用牆面切片（繞 z 轉 90° 放平、紋理朝下，沿長邊排成一條條，豎井那條在洞口斷開）。程式建模的牆與地面（原檔地面往兩側的排水溝傾斜，模型擺好後墊底的地面放低 18 cm）留在後面墊住切邊的縫
  const k = new Kit(), fl = new Kit(), PITCH = DR_CHH / 3, FS = DR_CH / 2.98, pans = { dr_wall: [], dr_wall2: [], dr_lintel: [], dr_pier: [], dr_floor: [] };
  // 切片的牆面：模型 x 上的位置（dr_wall2 是左邊那面，朝 +x）、切的高度範圍
  const CUT = { dr_wall: [1.31, .2, 1], dr_wall2: [-1.36, .2, 1], dr_lintel: [1.31, .25, 1.1], dr_pier: [1.31, .25, 1.1] };
  // 牆面疊層：(fx, fz) 是牆面中心、(nx, nz) 朝牆裡，ids／ts 是每一層用的切片與沿牆的錯開量
  const pan = (ids, fx, fz, nx, nz, y0, ts) => ts.forEach((t, r) => {
    const id = ids[r % ids.length], [mx, my, mh] = CUT[id], s = PITCH / mh;
    const ry = Math.atan2(-nz, nx) + (mx < 0 ? Math.PI : 0), tx = Math.sin(ry), tz = Math.cos(ry), d = Math.abs(mx) * s + .03 + r * .012;
    pans[id].push({ x: fx - nx * d + tx * t, y: y0 - my * s + r * PITCH, z: fz - nz * d + tz * t, ry, s });
  });
  for (const [ch, end] of [[DR_X.chB, false], [DR_X.chA, true]]) {
    const [c0, c1] = ch, cx = (c0 + c1) / 2, L = c1 - c0;
    fl.box(cx, -.1, 0, L, .2, DR_CHW * 2, 0x47443b, 2);
    pans.dr_floor.push({ x: cx, y: .04, z: 0, ry: Math.PI / 2, s: FS });
    for (const s of [-1, 1]) {
      k.box(cx, DR_CHH / 2, s * (DR_CHW + .15), L + .6, DR_CHH, .3, con, 2);
      pan(s > 0 ? ['dr_wall', 'dr_wall2'] : ['dr_wall2', 'dr_wall'], cx, s * DR_CHW, 0, s, 0, s > 0 ? [-.8, .3, 1.1] : [.6, -1.1, 0]);
    }
    for (const [x, open, sx] of [[c0, true, 1], [c1, !end, -1]]) {
      if (open) {
        for (const s of [-1, 1]) {
          k.box(x, DR_CHH / 2, s * (DR_W + (DR_CHW - DR_W) / 2), .3, DR_CHH, DR_CHW - DR_W, con, 2);
          pan(['dr_pier'], x + sx * .15, s * (DR_W + (DR_CHW - DR_W) / 2), -sx, 0, 0, [0, 0, 0]);
        }
        k.box(x, (DR_H + DR_CHH) / 2, 0, .3, DR_CHH - DR_H, DR_W * 2, con, 2);
        pan(['dr_lintel'], x + sx * .15, 0, -sx, 0, DR_H, [0, 0]);
        for (let i = 0; i < 13; i++) for (const o of [-.16, .22]) k.box(x + sx * o, DR_H + .1, -1.8 + i * .3, .02, .14, .15, i % 2 ? 0x15140f : 0xd8b020, 2);
      } else {
        k.box(x + .15, DR_CHH / 2, 0, .3, DR_CHH, DR_CHW * 2, con, 2);
        pan(['dr_wall2', 'dr_wall'], x, 0, 1, 0, 0, [.4, -.9, 1]);
      }
    }
    // 天花板（豎井那一格挖空）與豎井
    const hz = DR_CHW - .8, hw = .6;
    // 模型的天花板：豎井南邊鋪 CEIL_N 條、豎井那條（到北牆）在洞口兩邊各一片，片的另一端伸進端牆後面
    const roof = (id, za, zb, r, sx = 0) => {   // 蓋住 z 從 za 到 zb 的一條；sx 不是 0 時是豎井那條，片的一端停在洞口邊
      const [mx, my, mh] = CUT[id], s = (zb - za + .04) / mh, x = sx ? cx + sx * (hw + 6.44 * s / 2) : cx;
      pans[id].push({ x, y: DR_CHH - .03 - r * .01 - Math.abs(mx) * s, z: mx > 0 ? za - .02 - my * s : za - .02 + (my + mh) * s, ry: Math.PI / 2, rz: mx > 0 ? Math.PI / 2 : -Math.PI / 2, s });
    };
    const CEIL_N = 4, cw = (hz - hw + DR_CHW) / CEIL_N;
    for (let i = 0; i < CEIL_N; i++) roof(i % 2 ? 'dr_wall2' : 'dr_wall', -DR_CHW + i * cw, -DR_CHW + (i + 1) * cw, i % 2);
    for (const sx of [-1, 1]) roof(sx > 0 ? 'dr_wall' : 'dr_wall2', hz - hw, DR_CHW, 0, sx);
    k.box(cx, DR_CHH + .15, (hz - hw - DR_CHW) / 2, L, .3, hz - hw + DR_CHW, dk, 2);
    k.box(cx, DR_CHH + .15, (hz + hw + DR_CHW) / 2, L, .3, DR_CHW - hz - hw, dk, 2);
    for (const s of [-1, 1]) k.box(cx + s * (hw + L / 2) / 2, DR_CHH + .15, hz, L / 2 - hw, .3, hw * 2, dk, 2);
    const sh = DR_SHAFT - DR_CHH;
    for (const s of [-1, 1]) { k.box(cx + s * (hw + .1), DR_CHH + sh / 2, hz, .2, sh, hw * 2 + .4, con, 2); k.box(cx, DR_CHH + sh / 2, hz + s * (hw + .1), hw * 2, sh, .2, con, 2); }
    k.cyl(cx, DR_SHAFT + .05, hz, .34, .34, .06, 20, 0x8aa0b8, 11);   // 人孔蓋的縫透下來的光
    // 爬梯：貼著北牆，從地上到豎井頂
    const lz = hz + hw - .1;   // 爬梯貼著豎井的北壁往下到地上
    for (const s of [-.24, .24]) k.box(cx + s, DR_SHAFT / 2, lz, .05, DR_SHAFT, .05, 0x7a7e84, 15);
    for (let y = .3; y < DR_SHAFT; y += .3) k.box(cx, y, lz - .04, .48, .035, .035, 0x8a8e94, 15);
    for (let y = .8; y < DR_CHH; y += 1.6) k.box(cx, y, (lz + DR_CHW) / 2, .06, .06, DR_CHW - lz, 0x6a6e74, 15);   // 固定在牆上的支架
    // 牆上的管子與籠罩燈
    k.cyl(c0 + .6, DR_CHH - .6, 0, .18, .18, DR_CHW * 2, 12, 0x5a5650, 15, Math.PI / 2, 0, 0);
    k.cyl(c1 - 1, 1.2, -DR_CHW + .25, .22, .22, .4, 12, 0x3a3832, 15, Math.PI / 2, 0, 0);
    k.box(cx, 3.95, -1, .3, .2, .3, 0xffd9a0, 11);
  }
  // 箱涵頂的籠罩燈（燈泡本體）
  let s = 1;
  for (const [r0, r1] of [DR_X.run1, DR_X.run2]) for (let x = r0 + DR_SEG; x < r1; x += DR_SEG * 2) { k.box(x, DR_H - .12, s * 1.5, .22, .16, .22, 0xffd9a0, 11); s = -s; }
  // 箱涵中間淺淺的一道水
  for (const [r0, r1] of [[0, DR_X.run1[1]], DR_X.run2]) k.box((r0 + r1) / 2, .02, 0, r1 - r0, .02, 1.1, 0x0d110e, 2);
  drScene.add(new T.Mesh(k.build(), MAT.uber));
  const flM = new T.Mesh(fl.build(), MAT.uber); drScene.add(flM);
  for (const id in pans) propSwap('drain', null, id, pans[id], drScene, id === 'dr_floor' ? () => { flM.position.y = -.18; } : null, 'drain');
  // 走私包：東端檢查井的角落
  DR.bag = new T.Mesh(new Kit().box(0, .2, 0, .7, .4, .36, 0x2a3a2a, 15).box(0, .42, 0, .5, .04, .06, 0x15140f, 15).build(), MAT.uber);
  DR.bag.position.set(DR.stash.x, 0, DR.stash.z); DR.bag.rotation.y = .4; drScene.add(DR.bag);
}
// 排水口外的河景：夜裡的河面與對岸的燈（畫布貼圖，自己發光）
{
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const c = cv.getContext('2d'), g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#0b1424'); g.addColorStop(.5, '#1a2840'); g.addColorStop(.56, '#0a121e'); g.addColorStop(1, '#05080d');
  c.fillStyle = g; c.fillRect(0, 0, 512, 256);
  const r = rng(260);
  for (let i = 0; i < 70; i++) { const x = r() * 512, y = 112 + r() * 24; c.fillStyle = r() < .5 ? '#ffd28a' : '#9ad0ff'; c.fillRect(x, y, 2 + r() * 3, 2 + r() * 4); c.globalAlpha = .25; c.fillRect(x, 146 + (y - 112) * 2, 2, 20 + r() * 40); c.globalAlpha = 1; }
  const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
  const m = new T.Mesh(new T.PlaneGeometry(40, 20), new T.MeshBasicMaterial({ map: tex, toneMapped: false, fog: false }));
  m.position.set(-14, 2, 0); m.rotation.y = Math.PI / 2; drScene.add(m);
  const w = new T.Mesh(new T.PlaneGeometry(14, 30), new T.MeshBasicMaterial({ color: 0x0a1018, fog: false }));
  w.rotation.x = -Math.PI / 2; w.position.set(-7, -.05, 0); drScene.add(w);
}
VENUES.drain = { scene: drScene, data: drData, spawn: { x: 2.4, z: 0, yaw: Math.PI / 2 }, name: '排水道', toast: '排水道', dist: '排水道', ceil: DR_H - .15, door: { x: 0, z: 0 }, out: { x: 0, z: 0, yaw: 0 } };
// 進出：哪個入口進來就從那裡的位置開始；爬哪個出口就從那裡出去
function drEnter(i) {
  const e = DR.ents[i], V = VENUES.drain;
  if (!e) return;
  V.spawn = e.spawn; V.door = e.kind === 'mouth' ? { x: e.X, z: e.Z } : WP(e.x, e.z, e.zn);
  V.name = '排水道'; V.dist = `排水道 · ${e.name}`;
  DR.stats.in++;
  enterVenue('drain');
}
function drExit(i) {
  const e = DR.ents[i], V = VENUES.drain;
  V.out = e.kind === 'mouth' ? e.out : spotW(e.out, e.zn);
  exitVenue(() => toast(e.kind === 'mouth' ? '從排水口游出來了' : `從${e.name}爬出來`));
}
function drStashOk() { return performance.now() / 1000 >= DR.stash.next; }
function drTake() {
  if (!drStashOk()) return;
  DR.stash.next = performance.now() / 1000 + DR_STASH_T; DR.bag.visible = false; DR.stats.cash += DR_STASH;
  earn(DR_STASH, '排水道裡的走私包');
}
ctxHooks.push(() => {
  const p = player;
  if (p.mode !== 'walk' || p.ride) return null;
  if (p.where === 'out') {
    for (const [i, e] of DR.ents.entries()) {
      if (e.kind === 'mouth') { if (p.swim && Math.hypot(p.x - e.front[0], p.z - e.front[1]) < DR_IN_R) return { key: 'E', text: `進排水道 <i>· ${e.name}</i>`, fn: () => drEnter(i) }; }
      else if (!p.swim) { const [x, z] = toW(e.x, e.z, e.zn); if (Math.hypot(p.x - x, p.z - z) < DR_HOLE_R) return { key: 'E', text: '掀開人孔蓋 <i>· 下排水道</i>', fn: () => drEnter(i) }; }
    }
    return null;
  }
  if (p.where !== 'drain') return null;
  DR.bag.visible = drStashOk();
  for (const [i, e] of DR.ents.entries()) {
    if (Math.hypot(p.x - e.exitAt[0], p.z - e.exitAt[1]) < DR_LAD_R + (e.kind === 'mouth' ? .6 : 0)) return { key: 'E', text: e.kind === 'mouth' ? '游出去 <i>· 河濱排水口</i>' : `爬上去 <i>· ${e.name}</i>`, fn: () => drExit(i) };
  }
  if (drStashOk() && Math.hypot(p.x - DR.stash.x, p.z - DR.stash.z) < 1.4) return { key: 'E', text: `撿起 <i>· 走私包（${money(DR_STASH)}）</i>`, fn: drTake };
  return null;
});
// 大地圖（91-map.js）
function drainBlips(add) {
  for (const e of DR.ents) {
    const p = e.kind === 'mouth' ? { x: e.X, z: e.Z } : WP(e.x, e.z, e.zn);
    add('drain', { name: e.name, txt: '⌇', ...p, type: '排水道入口', desc: e.kind === 'mouth' ? '擋牆上的箱涵排水口，從水裡游過去按 E。地下箱涵通到兩個人孔，警察不會追下來。' : '人行道上的人孔蓋，站上去按 E 爬下排水道。' });
  }
}
gtaApi.drain = {
  DR, X: DR_X, scene: drScene, ents: DR.ents, enter: drEnter, exit: drExit, take: drTake,
  // 驗收：入口的位置（世界座標；排水口給游泳靠近的那一點）
  at(i) { const e = DR.ents[i]; return e.kind === 'mouth' ? e.front.slice() : toW(e.x, e.z, e.zn); },
  resetStash() { DR.stash.next = 0; },
};
