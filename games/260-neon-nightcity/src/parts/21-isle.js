// ═══ 天樞島的橋（06-roads.js 的 BRIDGES：連接道路跨過水道的那一段，世界座標）：路面還是 10-city.js 的連接道路網格（高度 0，水面 −1.6），
// 這裡蓋橋的結構：橋面板與兩側人行道、混凝土護欄加鋼欄杆、每 30 m 一座落到水底（LAKE_Y）的雙柱橋墩。依跨距與直不直分三種：
//   長而直（≥ 150 m）：照布魯克林大橋——兩座石砌橋塔（尖拱門洞讓路面穿過、塔腳落在水裡的沉箱上），兩條主纜從岸邊錨座拉上塔頂、塔間垂成拋物線，每 5 m 一根吊索；入夜主纜上一串燈
//   中等而直（70–150 m）：鋼拱橋，兩道拱肋從橋頭升到跨距的 18%（最高 22 m），每 5 m 一根吊桿，拱頂夠高的地方兩肋之間有橫撐
//   其他：平的梁橋
// 碰撞：護欄（low，人與車都擋，不擋相機與子彈）、橋塔的塔腳 ───
{
  const k = new Kit(), CONC = 0x8e8a82, CONC_D = 0x6e6a64, STONE = 0xb7a98f, STONE_D = 0x9a8c74, STEEL = 0x4f5a62, CABLE = 0x6d7378, BULB = 0xfff0d0;
  const wp = [], wn = [], wl = [], wi = [];
  let nS = 0, nA = 0;
  for (const B of BRIDGES) {
    const P = B.pts, hw = B.hw, cum = [0];
    for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const L = cum.at(-1);
    // 沿橋的位置 u（公尺）→ [x, z, 切線 x, 切線 z]
    const at = u => { u = Math.max(0, Math.min(L, u)); let i = 1; while (i < P.length - 1 && cum[i] < u) i++; const a = P[i - 1], b = P[i], l = cum[i] - cum[i - 1] || 1, t = (u - cum[i - 1]) / l; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
    const side = (u, o) => { const [x, z, tx, tz] = at(u); return [x - tz * o, z + tx * o]; };
    // 直不直：折線離兩端連線最遠多少
    const [ax, az] = P[0], [bx, bz] = P.at(-1), cl = Math.hypot(bx - ax, bz - az) || 1;
    const dev = Math.max(...P.map(([x, z]) => Math.abs((x - ax) * (bz - az) - (z - az) * (bx - ax)) / cl));
    const type = dev < 4 && L >= 150 ? 'susp' : dev < 4 && L >= 70 ? 'arch' : 'beam';
    // 橋面板、人行道、護欄：每 3 m 一段
    const n = Math.max(2, Math.ceil(L / 3));
    for (let i = 0; i < n; i++) {
      const u0 = L * i / n, u1 = L * (i + 1) / n;
      const [x0, z0] = at(u0), [x1, z1] = at(u1);
      k.bar(x0, -.72, z0, x1, -.72, z1, hw * 2, 1.3, CONC, TX.conc);   // 橋面板（頂面在路面下 5 cm）
      for (const s of [-1, 1]) {
        const [px0, pz0] = side(u0, s * (hw - .3)), [px1, pz1] = side(u1, s * (hw - .3));
        k.bar(px0, .35, pz0, px1, .35, pz1, .5, .7, CONC_D, TX.conc);    // 護欄
        k.bar(px0, 1.12, pz0, px1, 1.12, pz1, .12, .1, STEEL, TX.galv);  // 欄杆頂管
        k.box(px0, .85, pz0, .1, .5, .1, STEEL, TX.galv);
        const [fx0, fz0] = side(u0, s * (hw + .02)), [fx1, fz1] = side(u1, s * (hw + .02));
        k.bar(fx0, -.25, fz0, fx1, -.25, fz1, .06, .5, CONC_D, TX.conc);   // 橋面板外緣的滴水線
        const f = frameW(px0, pz0, px1 - px0, pz1 - pz0), l = Math.hypot(px1 - px0, pz1 - pz0);
        colliders.push({ x0: -.05, x1: l + .05, z0: -.3, z1: .3, low: 1, zn: f });
      }
      // 人行道（路緣 HR 到護欄內側）
      for (const s of [-1, 1]) {
        const base = wp.length / 3;
        for (const [u, o] of [[u0, HR + .05], [u0, hw - .55], [u1, HR + .05], [u1, hw - .55]]) { const [x, z] = side(u, s * o); wp.push(x, .03, z); wn.push(0, 1, 0); wl.push(X0 + 20 + o - HR, Z0 + 10 + u % 40, 1, 0); }
        wi.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      }
    }
    // 雙柱橋墩：每 30 m 一座（離兩端 12 m 內不立，橋塔那裡也不立）
    const towersU = type === 'susp' ? [L * .22, L * .78] : [];
    for (let u = 15; u < L - 12; u += 30) {
      if (towersU.some(t => Math.abs(t - u) < 10)) continue;
      const [x, z] = at(u); if (!inLake(x, z)) continue;
      for (const s of [-1, 1]) { const [px, pz] = side(u, s * (hw - 2.5)); k.cyl(px, (LAKE_Y - 1.37) / 2, pz, .95, 1.1, -1.37 - LAKE_Y, 12, CONC, TX.conc); }
      const [qa, qb] = [side(u, -(hw - 1)), side(u, hw - 1)];
      k.bar(qa[0], -1.6, qa[1], qb[0], -1.6, qb[1], 1.6, .5, CONC_D, TX.conc);
    }
    if (type === 'susp') {
      nS++;
      const Ht = 36, half = hw + 2.2, s1 = towersU[0], s2 = towersU[1];
      for (const tu of towersU) {
        const [x, z, tx, tz] = at(tu), ry = Math.atan2(tx, tz);
        // 沉箱（水底到水面上 0.5 m）、兩支塔腳、塔頂的實心段與尖拱
        k.box(x, (LAKE_Y + .5) / 2, z, (half + 3) * 2, .5 - LAKE_Y, 9, STONE_D, TX.stone, 0, ry);
        for (const s of [-1, 1]) {
          const [lx, lz] = side(tu, s * (half + 1.6));
          k.box(lx, (Ht + .5) / 2, lz, 3.2, Ht - .5, 6, STONE, TX.stone, 0, ry);
          k.box(lx, Ht + .6, lz, 3.6, .6, 6.4, STONE_D, TX.stone, 0, ry);   // 塔頂簷
          const f = frameW(lx, lz, tx, tz); colliders.push({ x0: -3, x1: 3, z0: -1.6, z1: 1.6, zn: f });
        }
        // 門洞上方的實心段（尖拱）：xy 剖面，局部 x 橫跨路面、沿路方向擠出
        const W = half, a = hw + .4;
        k.prism(x, 0, z, [[-W, Ht - 15], [-a, Ht - 15], [-a * .55, Ht - 10.5], [0, Ht - 8.8], [a * .55, Ht - 10.5], [a, Ht - 15], [W, Ht - 15], [W, Ht + .3], [-W, Ht + .3]], 5.6, STONE, TX.stone, 0, ry);
        k.box(x, Ht - 16, z, (W + 3.2) * 2, .8, 6.3, STONE_D, TX.stone, 0, ry);   // 拱腳的橫帶
      }
      // 主纜：塔頂（Ht + 1）↔ 錨座（橋頭，高 2.5 m），塔間垂到路面上 4 m；每 5 m 一根吊索；入夜一串燈
      const cy = u => u <= s1 ? 2.5 + (Ht + 1 - 2.5) * Math.max(0, u / s1) ** 1.5 : u >= s2 ? 2.5 + (Ht + 1 - 2.5) * Math.max(0, (L - u) / (L - s2)) ** 1.5 : 4 + (Ht + 1 - 4) * ((u - s1) / (s2 - s1) * 2 - 1) ** 2;
      for (const s of [-1, 1]) {
        let prev = null;
        for (let u = 0; u <= L + .01; u += L / Math.ceil(L / 4)) {
          const [x, z] = side(u, s * (hw + .4)), y = cy(u), p = [x, y, z];
          if (prev) k.rod(...prev, ...p, .32, 6, CABLE, TX.galv);
          if (u > 3 && u < L - 3 && Math.abs(u - s1) > 3 && Math.abs(u - s2) > 3 && y > 2.2) k.rod(x, 1.2, z, x, y, z, .05, 4, CABLE, TX.galv);
          if (Math.round(u / 4) % 2 === 0) k.box(x, y + .38, z, .22, .22, .22, BULB, 16);
          prev = p;
        }
        const [ex0, ez0] = side(0, s * (hw + .4)), [ex1, ez1] = side(L, s * (hw + .4));
        for (const [x, z] of [[ex0, ez0], [ex1, ez1]]) k.box(x, 1.4, z, 2.4, 2.8, 2.4, STONE_D, TX.stone);   // 錨座
      }
    } else if (type === 'arch') {
      nA++;
      const rise = Math.min(22, L * .18), u0 = L * .04, u1 = L * .96, ay = u => 1.2 + rise * (1 - ((u - u0) / (u1 - u0) * 2 - 1) ** 2);
      for (const s of [-1, 1]) {
        let prev = null;
        for (let u = u0; u <= u1 + .01; u += (u1 - u0) / Math.ceil((u1 - u0) / 3)) {
          const [x, z] = side(u, s * (hw + .3)), p = [x, ay(u), z];
          if (prev) k.bar(...prev, ...p, .9, 1.4, STEEL, TX.steel);
          prev = p;
        }
        for (let u = u0 + 5; u < u1 - 3; u += 5) { const [x, z] = side(u, s * (hw + .3)), y = ay(u); if (y > 2) k.rod(x, 1.2, z, x, y, z, .07, 4, STEEL, TX.steel); }
      }
      for (let u = u0 + 8; u < u1 - 6; u += 12) if (ay(u) > 8) { const [qa, qz] = side(u, -(hw + .3)), [qb, qbz] = side(u, hw + .3); k.bar(qa, ay(u), qz, qb, ay(u), qbz, .5, .6, STEEL, TX.steel); }
    }
  }
  if (BRIDGES.length) {
    cullAdd(cityAdd(new T.Mesh(k.build(), MAT.ux), null), CULL_R * 2);
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(wp, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(wn, 3)); g.setAttribute('aL', new T.Float32BufferAttribute(wl, 4)); g.setIndex(wi);
    groundAdd(new T.Mesh(g, new T.ShaderMaterial({ uniforms: { ...shared(ALLU), ...reflU }, vertexShader: GROUND_VS, fragmentShader: WALK_FS, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })), null);
  }
  if (location.search.includes('isleLog')) console.log(`天樞島的橋 ${BRIDGES.length} 座：吊橋 ${nS}、拱橋 ${nA}`, BRIDGES.map(B => B.pts.length * 3 | 0));
}
// ═══ 天樞島尖端的公園（照砲台公園）與東岸的碼頭（照南街海港）：位置在 11-isle.js 的 ISLE_PARK，世界座標 ═══
//   砲台：紅砂岩的圓形砲台（柯林頓堡），一圈射口、門朝島內，裡面一根旗桿
//   渡輪站：玻璃正面朝水、正面上方伸出雨棚、屋頂上的站名牌；站前兩道泊位（木護舷與一排排木樁），一道泊著一艘兩頭都能開的橘色渡輪
//   銅球：花崗岩基座上的銅球雕塑，四周一圈鋪面廣場；碎石小徑把它們和公園邊上接起來
//   碼頭：木棧板碼頭（木樁每 4 m 一排），兩座上面有紅色的倉庫棚，中間那座旁邊泊一艘三桅帆船
{
  const P = ISLE_PARK, k = new Kit();
  const SAND = 0x9a5f4a, SAND_D = 0x7d4a3a, WOOD = 0x6a5440, WOOD_D = 0x4a3a2c, GRANITE = 0x8a8680, BRONZE = 0x8c6a3c, WHITE = 0xe8e6e0, ORANGE = 0xe8701c;
  const fr = (x, z, fx, fz) => ({ at: (a, b, y = 0) => [x + fx * a - fz * b, y, z + fz * a + fx * b], ry: Math.atan2(fx, fz) });   // a 沿 f、b 往 f 的左手邊
  const grounds = [];
  if (P.fort) {
    const F = P.fort, N = 40, R = F.r, gA = Math.atan2(F.gz, F.gx);
    for (let i = 0; i < N; i++) {
      const a = (i + .5) / N * Math.PI * 2, da = Math.abs(((a - gA) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      const x = F.x + Math.cos(a) * R, z = F.z + Math.sin(a) * R, ry = Math.atan2(Math.cos(a), Math.sin(a)), seg = 2 * Math.PI * R / N + .15;
      if (da < .22) continue;   // 門
      k.box(x, 3.8, z, seg, 7.6, 2.4, SAND, TX.stone, 0, ry + Math.PI / 2);
      k.box(F.x + Math.cos(a) * (R + .1), 7.75, F.z + Math.sin(a) * (R + .1), seg, .3, 2.9, SAND_D, TX.stone, 0, ry + Math.PI / 2);   // 牆頂壓條
      if (i % 2) k.box(F.x + Math.cos(a) * (R + 1.21), 3.6, F.z + Math.sin(a) * (R + 1.21), .9, 1.4, .06, 0x1c1a18, 2, 0, ry + Math.PI / 2);   // 射口
      circles.push({ x, z, r: 1.5, w: 1 });
    }
    // 門柱與門楣
    for (const s of [-1, 1]) { const a = gA + s * .24, x = F.x + Math.cos(a) * R, z = F.z + Math.sin(a) * R; k.box(x, 3.9, z, 1.8, 7.8, 2.8, SAND_D, TX.stone, 0, Math.atan2(Math.cos(a), Math.sin(a)) + Math.PI / 2); }
    k.box(F.x + Math.cos(gA) * R, 6.7, F.z + Math.sin(gA) * R, 2.8, 1.8, 7, SAND_D, TX.stone, 0, Math.atan2(Math.cos(gA), Math.sin(gA)));
    // 旗桿與旗（藍底白條）
    k.cyl(F.x, 7, F.z, .09, .14, 14, 8, 0xd8d8d8, 15).box(F.x + .9, 12.6, F.z, 1.8, 1.1, .03, 0x203a78, 2).box(F.x + .9, 12.6, F.z, 1.8, .22, .035, WHITE, 2);
    grounds.push({ x: F.x, z: F.z, r: R - 1.2 });
  }
  if (P.term) {
    const T0 = P.term, f = fr(T0.x, T0.z, T0.fx, T0.fz), hw = T0.w / 2, hd = T0.d / 2, H = T0.h;
    // 主體：兩側與背面是混凝土牆，正面（+a）整片玻璃、每 4 m 一根鋼框
    k.box(...f.at(-1, 0, H / 2), T0.w, H, T0.d - 2, 0xb8b4ac, TX.conc, 0, f.ry + Math.PI / 2);
    for (let b = -hw; b < hw - 1; b += 4) {
      k.box(...f.at(hd - .1, b + 2, H * .45), 3.7, H * .78, .2, 0xffe8c0, 16, 0, f.ry + Math.PI / 2);
      k.box(...f.at(hd, b, H * .45), .25, H * .8, .35, 0x3a3e44, 15, 0, f.ry + Math.PI / 2);
    }
    k.box(...f.at(hd + 4, 0, H * .9), T0.w + 4, .5, 9, 0xd8d6d0, TX.sheet, 0, f.ry + Math.PI / 2);   // 雨棚
    for (const b of [-hw + 1, hw - 1]) k.box(...f.at(hd + 7.8, b, H * .45), .3, H * .9, .3, 0x3a3e44, 15, 0, f.ry);
    k.box(...f.at(-1, 0, H + .3), T0.w + 1, .6, T0.d - 1, 0x8a8680, TX.conc, 0, f.ry + Math.PI / 2);
    // 站名牌
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 192;
    const c = cv.getContext('2d'); c.fillStyle = '#1d2a3a'; c.fillRect(0, 0, 1024, 192); c.fillStyle = '#f2ead8'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '700 92px "Avenir Next Condensed","DIN Condensed","Arial Narrow",system-ui,sans-serif'; c.fillText('MERIDIAN FERRY', 512, 78); c.font = '600 54px system-ui,sans-serif'; c.fillText('天 樞 渡 輪', 512, 152);
    const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 4;
    const sg = new T.Mesh(new T.PlaneGeometry(20, 3.75), new T.MeshBasicMaterial({ map: tx, toneMapped: false, color: 0xd0d0d0 }));
    sg.position.set(...f.at(hd - .3, 0, H + 2.6)); sg.rotation.y = f.ry; cullAdd(cityAdd(sg, null));
    k.box(...f.at(hd - .45, 0, H + 2.6), 20.6, 4.2, .25, 0x2a2e34, 15, 0, f.ry);
    const fq = frameW(T0.x, T0.z, T0.fx, T0.fz); colliders.push({ x0: -hd, x1: hd, z0: -hw, z1: hw, zn: fq });
    // 泊位：兩側木護舷牆與木樁
    for (const [si, S] of P.slips.entries()) {
      const g = fr(S.x, S.z, S.fx, S.fz);
      for (const b of [-S.w / 2, S.w / 2]) {
        k.bar(...g.at(-2, b, .3), ...g.at(S.len, b, .3), .5, 2.2, WOOD_D, TX.woodZ);
        for (let a = 0; a <= S.len; a += 4) k.cyl(...g.at(a, b + Math.sign(b) * .5, (LAKE_Y + 1.6) / 2), .3, .32, 1.6 - LAKE_Y, 8, WOOD, TX.woodY);
      }
      k.box(...g.at(-1, 0, .9), S.w + 1, .4, 3, WOOD_D, TX.woodZ, 0, g.ry);   // 跳板
      if (si === 0) {   // 渡輪：橘色船身、兩層白色客艙、兩頭的駕駛台、中間的煙囪
        const L = 30, B = 8.6, mid = S.len * .55;
        const PP = [], NN = [], UU = [];
        for (let i = 0; i <= 12; i++) { const a = mid - L / 2 + L * i / 12; PP.push(g.at(a, 0, -.6)); NN.push([-S.fz, 0, S.fx]); UU.push([0, 1, 0]); }
        k.loft(PP, NN, UU, i => { const t = i / 12, w = B / 2 * (.72 + .28 * Math.sin(t * Math.PI)); return [[-w, 2.4], [-w, .6], [-w * .8, -1], [w * .8, -1], [w, .6], [w, 2.4]]; }, ORANGE, 0);
        k.box(...g.at(mid, 0, 3.6), B - 1.6, 2.4, L - 6, WHITE, 10, 0, g.ry).box(...g.at(mid, 0, 6), B - 2.6, 2.4, L - 10, ORANGE, 0, 0, g.ry);
        for (const e of [-1, 1]) k.box(...g.at(mid + e * (L / 2 - 6.5), 0, 8), 3.4, 1.8, 2.6, WHITE, 10, 0, g.ry).box(...g.at(mid + e * (L / 2 - 6.5), 0, 8.1), 3.5, .7, 2.7, 0x1a2a3a, 1, 0, g.ry);
        k.cyl(...g.at(mid, 0, 9.4), .9, 1, 3.2, 12, 0x2a2a2a, 2);
        for (const e of [-1, 1]) for (let a = -L / 2 + 5; a < L / 2 - 4; a += 2.2) k.box(...g.at(mid + a, e * (B / 2 - .79), 3.6), 1.4, .9, .05, 0x1a2a3a, 1, 0, g.ry + Math.PI / 2);
      }
    }
  }
  if (P.sphere) {
    const S = P.sphere;
    k.cyl(S.x, .6, S.z, 2.6, 2.8, 1.2, 20, GRANITE, TX.stone).cyl(S.x, 1.5, S.z, 1.1, 1.4, .8, 16, GRANITE, TX.stone);
    k.add(new T.SphereGeometry(3.2, 28, 18), lin(BRONZE), 15, tf(S.x, 5, S.z));
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + .3; k.box(S.x + Math.cos(a) * 3.05, 5 + Math.sin(i * 1.7) * 1.4, S.z + Math.sin(a) * 3.05, 1.1, .5, .3, 0x6a4e2a, 15, 0, -a); }   // 銅球的凹痕與裂口
    circles.push({ x: S.x, z: S.z, r: 2.9, w: 1 });
    grounds.push({ x: S.x, z: S.z, r: 10 });
  }
  for (const [pi, Q] of P.piers.entries()) {
    const g = fr(Q.x, Q.z, Q.fx, Q.fz), hw = Q.w / 2;
    k.box(...g.at(Q.len / 2 - 2, 0, .3), Q.w, .4, Q.len, WOOD, TX.woodZ, 0, g.ry);
    for (let a = 0; a <= Q.len - 2; a += 4) for (const b of [-hw + .4, 0, hw - .4]) k.cyl(...g.at(a, b, (LAKE_Y + .1) / 2), .28, .3, .1 - LAKE_Y, 8, WOOD_D, TX.woodY);
    for (const b of [-hw, hw]) k.bar(...g.at(-2, b, .55), ...g.at(Q.len - 2, b, .55), .25, .3, WOOD_D, TX.woodZ);
    if (pi !== 1) {   // 倉庫棚：紅色鋼板牆、雙坡頂
      const L = Q.len * .62, a0 = Q.len * .5, w = Q.w - 3;
      k.box(...g.at(a0, 0, 3.9), w, 7, L, 0x8a3a2c, TX.seam, 0, g.ry);
      k.prism(...g.at(a0, 0, 7.4), [[-w / 2 - .4, 0], [w / 2 + .4, 0], [0, 2.6]], L + .6, 0x5a5e62, TX.seam, 0, g.ry);
      for (const b of [-w / 2 - .01, w / 2 + .01]) for (let a = a0 - L / 2 + 4; a < a0 + L / 2 - 2; a += 6) k.box(...g.at(a, b, 2.2), .05, 3.6, 3.4, 0x3a2a24, 2, 0, g.ry + Math.PI / 2);
    } else {   // 三桅帆船：黑色船身、白腰帶、甲板、三根桅與帆桁、斜桅與支索
      const L = 44, Bm = 8.2, side = hw + Bm / 2 + 1.2, a0 = Q.len * .5;
      const PP = [], NN = [], UU = [];
      for (let i = 0; i <= 16; i++) { const a = a0 - L / 2 + L * i / 16; PP.push(g.at(a, side, -1.2)); NN.push([-Q.fz, 0, Q.fx]); UU.push([0, 1, 0]); }
      const hull = i => { const t = i / 16, w = Bm / 2 * Math.sqrt(Math.max(.02, 1 - ((t - .42) / (t > .42 ? .58 : .52)) ** 2)); return [[-w, 4.2], [-w, 1.2], [-w * .7, -1.2], [-w * .2, -2.4], [w * .2, -2.4], [w * .7, -1.2], [w, 1.2], [w, 4.2]]; };
      k.loft(PP, NN, UU, hull, 0x16181a, 0);
      k.loft(PP, NN, UU, i => { const w = hull(i)[7][0] * 1.012; return [[-w, 3.1], [w, 3.1], [w, 3.5], [-w, 3.5]]; }, 0xe8e2d0, 10);   // 白腰帶
      k.box(...g.at(a0, side, 2.9), Bm - 1, .2, L - 6, 0x8a6a48, TX.woodZ, 0, g.ry);   // 甲板
      for (const [ma, mh] of [[a0 - 13, 26], [a0, 30], [a0 + 12, 24]]) {
        const [mx, , mz] = g.at(ma, side, 0);
        k.cyl(mx, 3 + mh / 2, mz, .2, .38, mh, 10, 0x5a4632, TX.woodY);
        for (const [yf, yw] of [[.42, .9], [.62, .75], [.8, .58], [.95, .42]]) {
          const y = 3 + mh * yf, [ax, , az] = g.at(ma, side - Bm * yw, 0), [bx, , bz] = g.at(ma, side + Bm * yw, 0);
          k.rod(ax, y, az, bx, y, bz, .14, 6, 0x4a3a2a, TX.woodY);
          k.rod(ax, y - .3, az, bx, y - .3, bz, .32, 6, 0xd8cdb4, 2);   // 收起的帆
        }
        for (const s of [-1, 1]) { const [cx, , cz] = g.at(ma, side + s * Bm / 2, 0); k.rod(cx, 3.6, cz, mx, 3 + mh * .9, mz, .03, 3, 0x2a2420, 15); }   // 側支索
      }
      const [bx0, , bz0] = g.at(a0 + L / 2 - 1, side, 0), [bx1, , bz1] = g.at(a0 + L / 2 + 11, side, 0);
      k.rod(bx0, 4.4, bz0, bx1, 7.4, bz1, .22, 8, 0x5a4632, TX.woodY);   // 斜桅
      const [fx, , fz] = g.at(a0 + 12, side, 0); k.rod(bx1, 7.4, bz1, fx, 3 + 24 * .95, fz, .03, 3, 0x2a2420, 15);
    }
  }
  if (P.term || P.fort || P.sphere || P.piers.length) cullAdd(cityAdd(new T.Mesh(k.build(), MAT.ux), null), CULL_R * 2);
  // 地面：小徑（4 m 寬的碎石帶）、廣場與砲台裡面（圓形鋪面），草地材質的小徑顏色
  const gp = [], gn = [];
  const push = (a, b, c) => { for (const v of [a, b, c]) { gp.push(v[0], .012, v[1]); gn.push(0, 1, 0); } };
  for (const path of P.paths) for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1], [bx, bz] = path[i], l = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / l * 2, nz = (bx - ax) / l * 2;
    push([ax + nx, az + nz], [bx + nx, bz + nz], [bx - nx, bz - nz]); push([ax + nx, az + nz], [bx - nx, bz - nz], [ax - nx, az - nz]);
  }
  for (const G of grounds) for (let i = 0; i < 32; i++) { const a0 = i / 32 * Math.PI * 2, a1 = (i + 1) / 32 * Math.PI * 2; push([G.x, G.z], [G.x + Math.cos(a1) * G.r, G.z + Math.sin(a1) * G.r], [G.x + Math.cos(a0) * G.r, G.z + Math.sin(a0) * G.r]); }
  if (gp.length) {
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(gp, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(gn, 3));
    groundAdd(new T.Mesh(g, new T.ShaderMaterial({ uniforms: { ...shared(ALLU), ...reflU }, vertexShader: GROUND_VS, fragmentShader: LAWN_FS.replace(/float path = max\([^;]*\);/, 'float path = 1.;'), side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })), null);
  }
}
