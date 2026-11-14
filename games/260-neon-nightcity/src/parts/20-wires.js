// ─── 市區的電線桿與架空電線（質感改善第 5 項，2026-11-14）───
// 參考影片每一格路邊都有木電線桿和天空裡的幾條電線，260 的市區原本完全沒有（只有榛嶺 22-akina.js 與別墅區的水泥桿）。
// 舊城、住宅與工業區（舊碼頭、紅磚巷、雲杉坡、鐵灣、楓林、灰石、琥珀、錨灣）每個街區的北緣與西緣各拉一排：每條街只有一側有桿，
// 立在路緣內 0.45 m，兩端離路口 12 m，間距約 26 m；同一條街線上的桿沿街連成一條，跨過路口繼續拉。金融區、霓虹區、光環廣場、廣場、天樞島不擺。
// 桿（兩款：有沒有變壓器桶）與電線都是實例：電線是一根 1 m 的細長方塊，每段線照下垂的拋物線切成三截，每截一個實例（縮放成那一截的長度），
// 所以整個城市只多三個 InstancedMesh。claim 讓後面擺的東西讓開，碰撞是 circles 的細圓。用自己的亂數，其他東西的序列不變。
// POLES.list／spans 給驗收與截圖用（__nc.poles）
const POLES = { list: [], spans: 0, wires: [], on: !/[?&]poles=0\b/.test(location.search) };
if (POLES.on) {
  const r = rng(2651);
  const RE = /舊碼頭|紅磚|雲杉|鐵灣|楓林|灰石|琥珀|錨灣/;
  const ARM = .85, Y_ARM = 8.75, Y_TOP = 9.33, Y_COM = 6.6;   // 橫擔兩端的礙子、桿頂、下面那條通訊纜的高度
  const WIRES = [[-ARM, Y_ARM, .022, .38], [ARM, Y_ARM, .022, .38], [0, Y_TOP, .022, .42], [.16, Y_COM, .045, .3]];   // [沿橫擔的偏移, 高, 粗細, 下垂]
  // 街樹（20-props.js 的 trees，claim 2.2～2.4 m）沿路緣一棵接一棵，照 free() 算幾乎每一根都擋掉（2026-11-14 量過：501 根成功、1080 次失敗全是它）；
  // 真的路邊電線桿就立在樹旁邊、線從樹冠穿過，所以樹只算樹幹（0.7 m），其他 claim 照舊
  const freeP = (x, z, r) => {
    for (let c = Math.floor((x - r - 3.5) / NP_S); c <= Math.floor((x + r + 3.5) / NP_S); c++) for (let d = Math.floor((z - r - 3.5) / NP_S); d <= Math.floor((z + r + 3.5) / NP_S); d++)
      for (const p of nearProp.get(npKey(c, d)) || []) { const pr = p.r >= 2.15 && p.r <= 2.45 ? .7 : p.r; if ((p.x - x) ** 2 + (p.z - z) ** 2 < (pr + r) ** 2) return false; }
    return true;
  };
  POLES.miss = { free: 0, hill: 0, deck: 0 };
  const okAt = (x, z) => {
    if (!freeP(x, z, .9)) { POLES.miss.free++; return false; }
    const zn = zoneAtL(x, z), [X, Z] = toW(x, z, zn);
    if (hillConnNear(X, Z, HILL.roadHW + 1.5)) { POLES.miss.hill++; return false; }   // 山路的連接路口
    if (deckTop(X, Z) !== null) { POLES.miss.deck++; return false; }   // 快速道路橋下（線會頂到橋面）
    return true;
  };
  const seg = (a, b, w, sag) => {   // a、b：[x, y, z]（本地座標），照拋物線切三截
    const P = t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - 4 * sag * t * (1 - t), a[2] + (b[2] - a[2]) * t];
    for (let k = 0; k < 3; k++) {
      const p = P(k / 3), q = P((k + 1) / 3), dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2], L = Math.hypot(dx, dy, dz);
      POLES.wires.push({ x: p[0], y: p[1], z: p[2], ry: Math.atan2(dx, dz), rx: -Math.asin(dy / L), sx: w, sy: w, sz: L });
    }
  };
  // 先沿每個街區的北緣與西緣找立得下的位置（兩端離路口 12 m、中間約 26 m 一根），再把同一條街線（同一區、同一個 z 或 x）上的桿照順序連起來：
  // 跨過路口繼續拉（路口兩側的桿相距約 40 m），相鄰兩根超過 55 m（中間的街區不擺、立不下）就斷開。沒拉到線的桿不立
  const lines = new Map();
  for (const b of blocks) {
    if (b.outer || b.plaza || b.isle != null) continue;
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    if (!RE.test(district(cx, cz))) continue;
    const zk = (zoneAtL(cx, cz) || { key: '' }).key || '';
    for (const [ax, a0, a1, c] of [['x', b.x0, b.x1, b.z0 + .45], ['z', b.z0, b.z1, b.x0 + .45]]) {
      const len = a1 - a0 - 24;
      if (len < 10) continue;
      const n = Math.max(2, Math.round(len / 26) + 1), key = ax + zk + ':' + c.toFixed(1);
      if (!lines.has(key)) lines.set(key, []);
      for (let k = 0; k < n; k++) {
        const u0 = a0 + 12 + len * k / (n - 1);
        for (const d of [0, 2.5, -2.5, 5, -5]) {   // 擋到路燈、號誌、消防栓就前後挪一點，挪不開這根跳過（前後兩根直接拉）
          const u = u0 + d, x = ax === 'x' ? u : c, z = ax === 'x' ? c : u;
          if (u > a0 + 7 && u < a1 - 7 && okAt(x, z)) { claim(x, z, 1); lines.get(key).push({ x, z, u, y: .15, ry: ax === 'x' ? Math.PI / 2 : 0, ax }); break; }   // 桿的橫擔沿本地 x；沿 x 的那排轉 90°，橫擔垂直於街
        }
      }
    }
  }
  for (const L of lines.values()) {
    L.sort((a, b) => a.u - b.u);
    let prev = null;
    for (const p of L) {
      if (prev && p.u - prev.u <= 55) {
        if (!prev.on) { prev.on = 1; POLES.list.push(prev); }
        p.on = 1; POLES.list.push(p);
        for (const [o, h, w, sag] of WIRES) {
          const off = (q, s) => p.ax === 'x' ? [q.x, h + .15, q.z - s] : [q.x + s, h + .15, q.z];   // 轉 90° 的那排，本地 +x 落在 −z
          seg(off(prev, o), off(p, o), w, sag * (p.u - prev.u) / 30 * (.8 + r() * .4));
        }
        POLES.spans++;
      }
      prev = p;
    }
  }
  for (const p of POLES.list) { p.kind = r() < .22 ? 1 : 0; circles.push(circleToW({ x: p.x, z: p.z, r: .2 }, zoneAtL(p.x, p.z))); }
  // 桿：木桿（上細下粗）、橫擔、三個礙子（兩端與桿頂）、通訊纜的掛鉤；kind 1 多一個掛在路側的變壓器桶
  const poleKit = tr => {
    const k = new Kit()
      .cyl(0, 4.62, 0, .12, .165, 9.25, 8, 0x5b4b3c, TX.woodY)
      .box(0, Y_ARM - .2, 0, 2.05, .1, .12, 0x4c3f31, TX.woodX)
      .rod(0, Y_ARM - .95, 0, -.6, Y_ARM - .27, 0, .025, 4, 0x55534e, TX.galv).rod(0, Y_ARM - .95, 0, .6, Y_ARM - .27, 0, .025, 4, 0x55534e, TX.galv)   // 斜撐
      .box(.13, Y_COM, 0, .14, .1, .1, 0x3a3a3a, TX.galv);
    for (const s of [-ARM, ARM]) k.cyl(s, Y_ARM - .07, 0, .035, .05, .17, 6, 0x9fae9a, TX.epoxy);
    k.cyl(0, Y_TOP - .07, 0, .035, .05, .17, 6, 0x9fae9a, TX.epoxy);
    if (tr) k.cyl(0, 7.35, -.42, .26, .26, 1.05, 12, 0x8b8f92, TX.galv).box(0, 7.35, -.2, .12, .5, .2, 0x6d7174, TX.galv).cyl(0, 7.94, -.42, .27, .27, .06, 12, 0x7b7f82, TX.galv);
    return k.build();
  };
  const by = [POLES.list.filter(p => !p.kind), POLES.list.filter(p => p.kind)];
  by.forEach((L, k) => { if (L.length) instanced(poleKit(k), MAT.uber, L, LY.NOREFL, undefined, 300); });
  if (POLES.wires.length) instanced(new Kit().box(0, 0, .5, 1, 1, 1, 0x161616, TX.rubber).build(), MAT.uber, POLES.wires, LY.NOREFL, undefined, 220);
}
