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
    groundAdd(new T.Mesh(g, new T.ShaderMaterial({ name: 'walk', uniforms: { ...shared(ALLU), ...reflU }, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })), null);
  }
  if (location.search.includes('isleLog')) console.log(`天樞島的橋 ${BRIDGES.length} 座：吊橋 ${nS}、拱橋 ${nA}`, BRIDGES.map(B => B.pts.length * 3 | 0));
}
// 渡輪站第一道泊位的渡輪：位置與朝向（世界座標）、程式建模的替身（28-isle-lm.js 下載好模型後拿掉）
const ISLE_FERRY = { x: 0, z: 0, fx: 1, fz: 0, fb: null };
// ═══ 天樞島尖端的公園（照砲台公園）與東岸的碼頭（照南街海港）：位置在 11-isle.js 的 ISLE_PARK，世界座標 ═══
//   砲台：紅砂岩的圓形砲台（柯林頓堡），一圈射口、門朝島內，裡面一根旗桿
//   渡輪站（照白廳渡輪站）：島內那一面是預鑄混凝土的直鰭與三座入口，朝水的大廳是整片玻璃帷幕，屋頂往水面升起、伸出正面 10 m（三根鋼樹柱撐著），
//   屋簷上一排大字站名；站前兩道泊位（木護舷、木樁、鋼跳板、綠色鋼構門架與泊位號碼），第一道泊著渡輪（28-isle-lm.js 換成模型）
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
    const PRE = 0xc8c3b8, PRE_D = 0x9a958b, MUL = 0x2a2e33, GLW = 0xe8cfa4, GLW2 = 0x8c7c64, ROOF = 0xdcd9d2, GRN = 0x2f5a4c, BULB = 0xfff0d0;
    // 站房的座標：a 沿 f（朝水）、b 往左；B 是對齊站房的方塊（y 是中心高，la 沿 a、lb 沿 b），Pr 是 a–y 剖面沿 b 擠出（prism 的 x 是 −a）
    const B = (a, b, y, la, lb, h, col, m) => k.box(...f.at(a, b, y), lb, h, la, col, m, 0, f.ry);
    const Pr = (b, pts, len, col, m) => k.prism(...f.at(0, b, 0), pts.map(([a, y]) => [-a, y]), len, col, m, 0, f.ry + Math.PI / 2);
    // 屋頂往水面升起、伸出正面 10 m（照白廳渡輪站）：yR 是 a 處屋頂的底面
    const aB = -hd - 1, aF = hd + 10, rise = 3, yR = a => H + rise * (a - aB) / (aF - aB), aG = hd - 9;   // aG：後段實心的服務棟／前段玻璃大廳的分界
    B(0, 0, .25, T0.d + 1.6, T0.w + 1.6, .5, 0x8a8680, TX.stone);   // 花崗岩基座
    Pr(0, [[-hd, 0], [aG, 0], [aG, yR(aG)], [-hd, yR(-hd)]], T0.w, PRE, TX.conc);   // 服務棟
    // 大廳：白天是暗玻璃、入夜透出室內燈（一樓的候船室亮，夾層以上暗一些，整面才不會是一塊發光的箱子）
    Pr(0, [[aG, 0], [hd, 0], [hd, 6.6], [aG, 6.6]], T0.w - .6, GLW, 16);
    Pr(0, [[aG, 6.6], [hd, 6.6], [hd, yR(hd)], [aG, yR(aG)]], T0.w - .6, GLW2, 16);
    Pr(0, [[aB, yR(aB)], [aF, yR(aF)], [aF, yR(aF) + .9], [aB, yR(aB) + 1.1]], T0.w + 2, ROOF, TX.sheet);   // 屋頂
    B(aF + .12, 0, yR(aF) + .45, .25, T0.w + 2.2, 1, 0xeeebe4, 10);   // 屋簷的封邊
    // 玻璃帷幕：正面每 1.5 m 一根直料，3.4 m 的門楣、6.6 m 的夾層樓板邊、10 m 一道橫料；側面只有大廳那一段
    const yF = yR(hd);
    for (let b = -hw + .3; b <= hw - .29; b += (T0.w - .6) / Math.round((T0.w - .6) / 1.5)) B(hd + .1, b, yF / 2, .26, .12, yF, MUL, 15);
    for (const [y, h, col, m] of [[.1, .2, MUL, 15], [3.4, .16, MUL, 15], [6.6, .75, PRE_D, TX.conc], [10, .14, MUL, 15]]) B(hd + .12, 0, y, .3, T0.w - .5, h, col, m);
    for (const s of [-1, 1]) {
      for (let a = aG + 1.5; a < hd; a += 1.5) B(a, s * (hw - .24), yR(a) / 2, .12, .26, yR(a), MUL, 15);
      for (const [y, h, col, m] of [[3.4, .16, MUL, 15], [6.6, .75, PRE_D, TX.conc], [10, .14, MUL, 15]]) B((aG + hd) / 2, s * (hw - .2), y, hd - aG, .32, h, col, m);
      // 服務棟的側牆：每 2 m 一片預鑄混凝土的直鰭
      for (let a = -hd + 1; a < aG; a += 2) B(a, s * (hw + .18), yR(a) / 2, .3, .36, yR(a), PRE_D, TX.conc);
    }
    // 上船的門：正面對著兩道泊位各一座鋼框門洞
    for (const S of P.slips) {
      const b = (S.x - T0.x) * -T0.fz + (S.z - T0.z) * T0.fx;
      B(hd + .38, b, 3.55, .7, 6.6, .3, MUL, 15);
      for (const s of [-1, 1]) B(hd + .38, b + s * 3.15, 1.75, .7, .3, 3.5, MUL, 15);
      B(hd + .02, b, 1.7, .08, 6, 3.3, 0x1a2228, 1);
    }
    // 屋頂伸出去的那段：三根鋼樹柱撐著（樹幹分三枝頂到屋頂底面）、底面一排排嵌燈
    for (const b of [-hw + 1.5, 0, hw - 1.5]) {
      const a = hd + 7.5, yt = yR(a) - 3.2, [x, , z] = f.at(a, b);
      k.cyl(x, .15, z, .55, .6, .3, 12, 0x8a8680, TX.stone).cyl(x, yt / 2, z, .26, .32, yt, 12, MUL, 15);
      for (const [da, db] of [[2.2, 0], [-1.6, 2], [-1.6, -2]]) k.rod(x, yt - .1, z, ...f.at(a + da, b + db, yR(a + da) - .02), .16, 8, MUL, 15, .1);
      circles.push({ x, z, r: .5, w: 1 });
    }
    for (const a of [hd + 2.5, hd + 6, hd + 9.2]) for (let b = -hw + 2; b <= hw - 1.9; b += 4) B(a, b, yR(a) - .04, .6, .6, .06, BULB, 16);
    // 站名：屋簷上一排大字（照白廳渡輪站的 STATEN ISLAND FERRY），鋼桁架撐著；島內那一面入口上方一塊小的
    const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 288;
    const c = cv.getContext('2d'); c.fillStyle = '#f4efe4'; c.strokeStyle = '#1b2530'; c.lineJoin = 'round'; c.textAlign = 'center'; c.textBaseline = 'middle';
    // 字有深色描邊：白天映著亮的天空也讀得到
    c.font = '700 168px "Avenir Next Condensed","DIN Condensed","Arial Narrow",system-ui,sans-serif'; c.lineWidth = 24; c.strokeText('MERIDIAN FERRY', 1024, 100); c.fillText('MERIDIAN FERRY', 1024, 100);
    c.font = '600 84px system-ui,sans-serif'; c.lineWidth = 10; c.strokeText('天　樞　渡　輪', 1024, 236); c.fillText('天　樞　渡　輪', 1024, 236);
    const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 4;
    const signMat = new T.MeshBasicMaterial({ map: tx, toneMapped: false, color: 0xd8d8d8, transparent: true, alphaTest: .35, depthWrite: false });
    const yS = yR(aF - 1.5) + .9 + 2.4;
    const sg = new T.Mesh(new T.PlaneGeometry(30, 4.2), signMat); sg.position.set(...f.at(aF - 1.5, 0, yS)); sg.rotation.y = f.ry; cullAdd(cityAdd(sg, null));
    for (const y of [yS - 1.7, yS + 1.6]) k.bar(...f.at(aF - 1.75, -15.5, y), ...f.at(aF - 1.75, 15.5, y), .14, .22, MUL, 15);
    for (let b = -15; b <= 15.01; b += 5) k.bar(...f.at(aF - 1.75, b, yR(aF - 1.75) + .9), ...f.at(aF - 1.75, b, yS + 1.7), .14, .14, MUL, 15);
    const sb = new T.Mesh(new T.PlaneGeometry(15, 2.1), signMat); sb.position.set(...f.at(-hd - .5, 0, 7.6)); sb.rotation.y = f.ry + Math.PI; cullAdd(cityAdd(sb, null));
    // 島內那一面（後面）：直鰭、高處一道橫向的帶窗、三座入口（玻璃門分四扇）與入口雨棚
    const doors = [-9, 0, 9];
    B(-hd - .03, 0, 10.6, .06, T0.w - 2, 2.8, GLW2, 16);
    for (let b = -hw + 1; b < hw; b += 2) if (doors.every(d => Math.abs(b - d) > 2.9)) B(-hd - .18, b, yR(-hd) / 2, .36, .3, yR(-hd), PRE_D, TX.conc);
    for (const d of doors) {
      B(-hd - .02, d, 1.7, .08, 4.8, 3.4, 0x1a2228, 1); B(-hd - .2, d, 3.5, .4, 5.2, .25, MUL, 15);
      for (let i = -2; i <= 2; i++) B(-hd - .08, d + i * 1.2, 1.7, .1, i % 2 ? .06 : .14, 3.4, MUL, 15);
      B(-hd - .08, d, 2.7, .1, 4.8, .1, MUL, 15);
    }
    B(-hd - 1.7, 0, 4.2, 3.4, 26, .3, ROOF, TX.sheet);
    for (let b = -12; b <= 12; b += 6) B(-hd - 1.7, b, 4.04, .5, .5, .05, BULB, 16);
    const fq = frameW(T0.x, T0.z, T0.fx, T0.fz); colliders.push({ x0: -hd - .4, x1: hd + .4, z0: -hw - .4, z1: hw + .4, zn: fq });
    // 泊位：兩側木護舷牆與木樁、岸邊的鋼跳板；泊位口兩座綠色的鋼構門架（四柱與斜撐），頂上的桁架吊著跳板，正面掛泊位號碼；兩邊各一座繫船柱
    for (const [si, S] of P.slips.entries()) {
      const g = fr(S.x, S.z, S.fx, S.fz), sw = S.w / 2, G = g.ry;
      for (const b of [-sw, sw]) {
        k.bar(...g.at(-2, b, .3), ...g.at(S.len, b, .3), .5, 2.2, WOOD_D, TX.woodZ);
        for (let a = 0; a <= S.len; a += 4) k.cyl(...g.at(a, b + Math.sign(b) * .5, (LAKE_Y + 1.6) / 2), .3, .32, 1.6 - LAKE_Y, 8, WOOD, TX.woodY);
      }
      k.box(...g.at(1.2, 0, -.15), S.w - 2.6, .3, 7.4, 0x55595c, TX.steel, 0, G);
      for (const s of [-1, 1]) {
        k.bar(...g.at(-2.4, s * (sw - 1.4), 1.05), ...g.at(4.8, s * (sw - 1.4), 1.05), .07, .07, GRN, TX.steel);
        for (let a = -2.4; a <= 4.81; a += 1.8) k.box(...g.at(a, s * (sw - 1.4), .5), .06, 1.1, .06, GRN, TX.steel, 0, G);
        const bb = s * (sw + 1.6), [tx0, , tz0] = g.at(0, bb);
        for (const da of [-1.2, 1.2]) for (const db of [-.9, .9]) k.box(...g.at(da, bb + db, (13 + LAKE_Y) / 2), .38, 13 - LAKE_Y, .38, GRN, TX.steel, 0, G);
        for (let y = 1.5; y < 12; y += 3.4) for (const da of [-1.2, 1.2]) {
          k.bar(...g.at(da, bb - .9, y), ...g.at(da, bb + .9, y), .16, .16, GRN, TX.steel);
          k.rod(...g.at(da, bb - .9, y), ...g.at(da, bb + .9, y + 3.4), .06, 4, GRN, TX.steel);
        }
        for (const y of [1.5, 8.3]) for (const db of [-.9, .9]) k.bar(...g.at(-1.2, bb + db, y), ...g.at(1.2, bb + db, y), .16, .16, GRN, TX.steel);
        k.cyl(...g.at(-1.6, s * (sw + 4.2), .4), .2, .26, .8, 10, 0x22262a, 15).cyl(...g.at(-1.6, s * (sw + 4.2), .84), .3, .3, .1, 10, 0x22262a, 15);
        colliders.push({ x0: -1.5, x1: 1.5, z0: -1.2, z1: 1.2, zn: frameW(tx0, tz0, S.fx, S.fz) });
        // 吊著跳板外端的鋼索
        k.rod(...g.at(4.6, s * (sw - 1.6), .05), ...g.at(1.2, s * (sw - 1.6), 12.3), .03, 3, 0x2a2420, 15);
      }
      for (const b of [-sw + 1.5, sw - 1.5]) k.box(...g.at(1.45, b, 12.05), .7, .35, .4, BULB, 16, 0, G);   // 照著泊位的投光燈
      for (const y of [12.4, 13.4]) for (const da of [-1.2, 1.2]) k.bar(...g.at(da, -sw - 2.5, y), ...g.at(da, sw + 2.5, y), .3, .34, GRN, TX.steel);
      for (let b = -sw - 1.6, i = 0; b < sw + 1.6; b += (S.w + 3.2) / 8, i++) for (const da of [-1.2, 1.2]) k.rod(...g.at(da, b, i % 2 ? 12.4 : 13.4), ...g.at(da, b + (S.w + 3.2) / 8, i % 2 ? 13.4 : 12.4), .07, 4, GRN, TX.steel);
      // 泊位號碼
      const nc = document.createElement('canvas'); nc.width = 256; nc.height = 96;
      const n2 = nc.getContext('2d'); n2.fillStyle = '#1f3a31'; n2.fillRect(0, 0, 256, 96); n2.fillStyle = '#f4efe4'; n2.textAlign = 'center'; n2.textBaseline = 'middle';
      n2.font = '700 64px "Avenir Next Condensed","DIN Condensed","Arial Narrow",system-ui,sans-serif'; n2.fillText('SLIP ' + (si + 1), 128, 50);
      const nt = new T.CanvasTexture(nc); nt.colorSpace = T.SRGBColorSpace;
      const ns = new T.Mesh(new T.PlaneGeometry(4, 1.5), new T.MeshBasicMaterial({ map: nt, toneMapped: false, color: 0xc8c8c8 }));
      ns.position.set(...g.at(1.42, 0, 12.9)); ns.rotation.y = G; cullAdd(cityAdd(ns, null));
      if (si === 0) {   // 渡輪：28-isle-lm.js 下載好模型（Star Ferry）前的替身——橘色船身、兩層白色客艙、兩頭的駕駛台、中間的煙囪
        const L = 30, Bm = 8.6, mid = S.len * .52, kf = new Kit();
        Object.assign(ISLE_FERRY, { x: g.at(mid, 0)[0], z: g.at(mid, 0)[2], fx: S.fx, fz: S.fz });
        const PP = [], NN = [], UU = [];
        for (let i = 0; i <= 12; i++) { const a = mid - L / 2 + L * i / 12; PP.push(g.at(a, 0, -.6)); NN.push([-S.fz, 0, S.fx]); UU.push([0, 1, 0]); }
        kf.loft(PP, NN, UU, i => { const t = i / 12, w = Bm / 2 * (.72 + .28 * Math.sin(t * Math.PI)); return [[-w, 2.4], [-w, .6], [-w * .8, -1], [w * .8, -1], [w, .6], [w, 2.4]]; }, ORANGE, 0);
        kf.box(...g.at(mid, 0, 3.6), Bm - 1.6, 2.4, L - 6, WHITE, 10, 0, G).box(...g.at(mid, 0, 6), Bm - 2.6, 2.4, L - 10, ORANGE, 0, 0, G);
        for (const e of [-1, 1]) kf.box(...g.at(mid + e * (L / 2 - 6.5), 0, 8), 3.4, 1.8, 2.6, WHITE, 10, 0, G).box(...g.at(mid + e * (L / 2 - 6.5), 0, 8.1), 3.5, .7, 2.7, 0x1a2a3a, 1, 0, G);
        kf.cyl(...g.at(mid, 0, 9.4), .9, 1, 3.2, 12, 0x2a2a2a, 2);
        for (const e of [-1, 1]) for (let a = -L / 2 + 5; a < L / 2 - 4; a += 2.2) kf.box(...g.at(mid + a, e * (Bm / 2 - .79), 3.6), 1.4, .9, .05, 0x1a2a3a, 1, 0, G + Math.PI / 2);
        ISLE_FERRY.fb = cullAdd(cityAdd(new T.Mesh(kf.build(), MAT.ux), null));
        colliders.push({ x0: -16.3, x1: 16.3, z0: -5.3, z1: 5.3, zn: frameW(ISLE_FERRY.x, ISLE_FERRY.z, S.fx, S.fz) });   // 船身：游泳的人不會穿進去
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
    groundAdd(new T.Mesh(g, new T.ShaderMaterial({ name: 'path', uniforms: { ...shared(ALLU), ...reflU }, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })), null);
  }
}
