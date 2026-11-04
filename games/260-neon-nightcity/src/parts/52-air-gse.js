// ═══ 灰鷺角機場的機坪地勤車（Blender 細模 blender/airgse.py → 內嵌的 airgse.glb）═══
// 每座登機門：機頭前的推機車＋拖桿、右前方的地面電源車、前貨艙門的行李輸送帶車（在發動機前面）、右翼前緣前的加油車、
// 鼻輪與主輪的輪擋、發動機前與翼尖、機尾的三角錐；第一、三座門的右後方各一座照明燈塔；右後門的空廚車、機尾右後方三台 ULD 拖板；空橋旋轉廳東邊的 FOD 回收桶與推車式滅火器、兩翼下的加油栓井蓋。
// 遠端機位的客機左側前後門各接一台客梯車、客梯車外面停一台接駁巴士。跑道與滑行道之間兩支風向袋。
// 座標是 SEA_FR（21-air.js 的機坪框）；客機停在 x = 門 + 4.5、機身中心 z 238.8、機頭朝 −z（機頭 z 220），右側是 +x。T2 的四座門是同一套轉 180°。
// 模型的車頭是 +x，rotateY(θ) 把車頭轉到 (cos θ, −sin θ)。全部合成一個網格烘進城市（MAT.ux），碰撞是 SEA_FR 的盒與圓。
if (AIR_L && PROPS.gse_fuel && PROPS.gse_belt && PROPS.gse_push && PROPS.gse_stairs) {
  const L = AIR_L, Y0 = .06, list = [], col = (x0, x1, z0, z1) => colliders.push({ x0, x1, z0, z1, zn: AIR_F });
  const put = (nm, x, z, th, y = Y0) => { const g = PROPS[nm].clone(); g.rotateY(th); g.translate(x, y, z); list.push(g); };
  const N = -Math.PI / 2, S = Math.PI / 2, E = 0, Wd = Math.PI;   // 車頭朝 +z、−z、+x、−x
  const k = new Kit();
  // T1 的登機門照下面寫（SEA_FR）；T2 的整組對空橋旋轉廳轉 180°（x → 2·門 − x、z → jz − (z − 200)、車頭 +π）
  for (const [gates, jz] of [[L.gates, null], [L.gates2, L.t2.jz]]) gates.forEach((g, gi) => {
    const m = jz == null ? (x, z) => [x, z] : (x, z) => [2 * g.x - x, jz - (z - 200)], dth = jz == null ? 0 : Math.PI;
    const pG = (nm, x, z, th, y) => { const [X, Z] = m(x, z); put(nm, X, Z, th + dth, y); };
    const cG = (x0, x1, z0, z1) => { const [a, b] = m(x0, z0), [c, d] = m(x1, z1); col(Math.min(a, c), Math.max(a, c), Math.min(b, d), Math.max(b, d)); };
    const rG = (ax, ay, az, bx, by, bz, ...r) => { const [A, B] = m(ax, az), [C, D] = m(bx, bz); k.rod(A, ay, B, C, by, D, ...r); };
    const aG = (x, z) => airW(...m(x, z));
    const cx = g.x + 4.5, liv = AIR_LIV[g.plane], eng = liv.liv3[0], ez = 238.8 - liv.liv3[2];   // 發動機的橫向距離與 z
    pG('gse_push', cx, 212.9, N); cG(cx - 1.4, cx + 1.4, 209.7, 216.1);                      // 推機車：車頭朝客機鼻輪
    rG(cx, .55, 216.3, cx, .5, 224.3, .06, 6, 0x2c2f33, 15);                                   // 拖桿接到鼻輪
    pG('gse_gpu', cx + 4.4, 223.2, S); cG(cx + 3.6, cx + 5.2, 221.8, 224.6);                 // 地面電源車（拖桿朝機頭）
    // 軟管與電纜：二次曲線往下垂、碰到地面就平躺（不是兩點之間的直線）
    const hoseG = (ax, ay, az, bx, by, bz, r, col, drop) => { const cX = (ax + bx) / 2, cZ = (az + bz) / 2, cY = Math.min(ay, by) - drop; let p = [ax, ay, az];
      for (let i = 1; i <= 16; i++) { const t = i / 16, u = 1 - t, q = [u * u * ax + 2 * u * t * cX + t * t * bx, Math.max(r + .01, u * u * ay + 2 * u * t * cY + t * t * by), u * u * az + 2 * u * t * cZ + t * t * bz]; rG(...p, ...q, r, 8, col, 2); p = q; } };
    hoseG(cx + 4.4, .9, 221.8, cx + 1.6, 2.2, 222.8, .028, 0x111214, 2.2);                    // 電源線接到機鼻下的插座
    pG('gse_belt', cx + 5.45, 226, Wd); cG(cx + 2.3, cx + 9.2, 225, 227);                    // 輸送帶車：皮帶頂端靠著前貨艙門
    pG('gse_fuel', cx + 12.5, 224.5, S); cG(cx + 11.2, cx + 13.8, 219.4, 230.1);             // 加油車：在右翼前緣前，車頭朝航廈好開走
    hoseG(cx + 12.5, .9, 230, cx + 12.2, 3.1, 236.5, .04, 0x15161a, 3.6);                     // 油管從捲盤垂到地上、再拉上翼下的加油口
    for (const [x, z, th] of [[cx, 224.6, N], [cx, 225.9, S], [cx - 3.8, 239.4, N], [cx - 3.8, 240.8, S], [cx + 3.8, 239.4, N], [cx + 3.8, 240.8, S]]) pG('gse_chock', x, z, th);
    for (const [x, z] of [[cx - eng, ez - 3.6], [cx + eng + 1.6, ez - 3.4], [cx - 17.3, 246], [cx + 17.3, 246], [cx, 259.6], [cx + 9.6, 223.6], [cx + 9.6, 228.4]]) pG('gse_cone', x, z, (x * 7 + z) % 6.28);
    if (gi !== 1) {   // 照明燈塔：右後方、繞圈的地勤車道（z 272）以內；燈頭朝客機
      const tx = cx + 20, tz = 262, th = 3 * Math.PI / 4; pG('gse_tower', tx, tz, th); const [X, Z] = aG(tx, tz); circles.push({ x: X, z: Z, r: 1.4, w: 1 });
      const [lx, lz] = aG(tx - 1.2, tz - 1.2); signLights.push({ x: lx, y: 8.6, z: lz, col: lin(0xfff2e0), r: 34, i: 14, w: 1 });
    }
    if (PROPS.gse_cater) {   // 空廚車：右後門（機尾往前 4.6 m），車頭朝機身、車廂升到門檻，平台前緣（模型 +x 4.1）貼著機身側面
      const rz = 238.8 - liv.liv[3] - 4.6, x = cx + liv.liv[1] - .03 + 4.1; pG('gse_cater', x, rz, Wd); cG(x - 4.1, x + 4.45, rz - 1.3, rz + 1.3);
    }
    if (PROPS.gse_fod) { pG('gse_fod', g.x + 9.5, 203.6, E); cG(g.x + 9.1, g.x + 9.9, 203.3, 203.9); }       // 空橋旋轉廳東邊：FOD 回收桶與推車式滅火器
    if (PROPS.gse_ext) { pG('gse_ext', g.x + 8.1, 203.8, Wd); cG(g.x + 7.8, g.x + 8.6, 203.4, 204.2); }
    for (const s of [-1, 1]) { const [X, Z] = m(cx + s * 15.5, 233); k.box(X, .066, Z, 1.25, .014, 1.25, 0xc9a23a, 2).box(X, .072, Z, .9, .014, .9, 0x3d3f43, 15).box(X + .3, .078, Z, .12, .01, .5, 0x26282b, 15); }   // 兩翼下的加油栓井蓋（黃框、鋼蓋、提把）
    if (PROPS.af_ladder && gi === 0) { const lx = cx - eng - 3.6, lz = ez + .2; pG('af_ladder', lx, lz, E); cG(lx - .1, lx + 2.12, lz - .46, lz + .46); }   // 左發動機外側的平台梯（airfac.glb，梯級往 +x 升到平台）
    if (PROPS.af_stepl && gi === 1) { const sx = cx - 2.2, sz = 223.5; pG('af_stepl', sx, sz, E); cG(sx - .57, sx + .55, sz - .26, sz + .26); }      // 機鼻左邊一把 A 字梯
    if (PROPS.gse_dolly) for (let i = 0; i < 3; i++) { const z = 259 + i * 4.2; pG('gse_dolly', cx + 9, z, N); cG(cx + 7.8, cx + 10.3, z - 1.9, z + 3.0); }   // 機尾右後方一列 ULD 拖板（等著上後貨艙；拖桿朝 +z）
  });
  for (const s of [...L.stands, ...L.stands2]) {   // 遠端機位：客機模型機頭 +z、左側是模型的 +x，再轉 ry；客梯車車頭朝機身外，平台那端（模型 −x）頂著前後門
    const p = AIR_LIV[s.plane].liv, c = Math.cos(s.ry), sn = Math.sin(s.ry), at = (lx, lz) => [s.x + lx * c + lz * sn, s.z - lx * sn + lz * c];
    for (const lz of [p[2] - 4.4, p[3] + 4.6]) {
      const [x, z] = at(5.75, lz), [a] = at(1.95, lz), [b] = at(9.3, lz); put('gse_stairs', x, z, s.ry); col(Math.min(a, b), Math.max(a, b), z - 1.2, z + 1.2);
    }
    for (const [lx, lz, th] of [[0, 13.2, N], [0, 14.6, S], [3.8, -1, N], [3.8, .4, S], [-3.8, -1, N], [-3.8, .4, S]]) { const [x, z] = at(lx, lz); put('gse_chock', x, z, th + s.ry); }
    for (const [lx, lz] of [[17.4, -6], [-17.4, -6], [0, -21]]) { const [x, z] = at(lx, lz); put('gse_cone', x, z, lx); }
    if (PROPS.gse_bus) {   // 接駁巴士：左側客梯車外面、機翼前緣之前，車頭朝機頭
      const [x, z] = at(12.6, 13.4), q = [at(11, 6.4), at(14.2, 20.4)]; put('gse_bus', x, z, s.ry + N);
      col(Math.min(q[0][0], q[1][0]), Math.max(q[0][0], q[1][0]), Math.min(q[0][1], q[1][1]), Math.max(q[0][1], q[1][1]));
    }
  }
  if (PROPS.gse_sock) for (const [x, th] of [[-2980, .35], [-1380, .5]]) {   // 風向袋：跑道與平行滑行道之間，跑道兩端附近
    put('gse_sock', x, 455, th, 0); const [X, Z] = airW(x, 455); circles.push({ x: X, z: Z, r: .55, w: 1 });
  }
  const kg = k.build(); if (kg.attributes.position.count) list.push(kg);
  const geo = mergeGeometries(list); for (const g of list) g.dispose();
  if (geo) { cityAdd(new T.Mesh(geo, MAT.ux), AIR_ZN); ahmGeo(geo); ahmFlush(); }   // 地勤車也投日光陰影（52-air-bld.js 的機場高度圖）
  colDirty();
}
