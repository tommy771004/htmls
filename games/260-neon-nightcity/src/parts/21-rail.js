// ═══ 北嶺鐵道橋（10-city.js 的 VIADUCT）：走得上去的橋面、兩端的平台與隧道、夜燈、往返的電聯車 ═══
// 地形（山溝、平台、隧道上的山頭）在 10-city.js 的 viaCarve；這裡是畫面、20-walk.js 的步行面（橋面、橋下的橋墩、洞門與隧道）與列車。
// 座標都是北嶺公園的座標框（VIADUCT.zn = NPARK.f）；端點座標系 V.frame(e, x, z) → [o 往外（進山）, d 往左]，洞門在 o = A，洞底在 o = A + BORE。
// 列車：tools/props.mjs 的 w1_train（tiunov.se 的 Lastochka electric train，CC BY 4.0）拆成的車頭 cab、中間車 mid、無駕駛室的 tail，
// 編成 車頭＋中間＋tail＋中間＋反向的車頭（約 104 m）。以 http(s) 開啟、走近 RAIL_NEAR 公尺才下載；以檔案開啟或下載失敗用程式替身。
// 一趟從一端的洞底開到另一端的洞底（車身過了洞底就藏起來），停一陣子再反方向開回來；白天車窗暗、夜裡亮，頭燈一直開著

const RAIL = VIADUCT ? (() => {
  const V = VIADUCT, D = V.deck, [w, e] = V.ends;
  // 路徑：西洞底 → 西平台 → 橋上的中心線 → 東平台 → 東洞底，每 2 m 一點；s 是從西洞底起算的長度
  const pts = [];
  for (let o = V.A + V.BORE; o > 0; o -= 2) pts.push([w.x + w.ux * o, w.z + w.uz * o]);
  for (let x = w.x; x < e.x; x += 2) pts.push([x, V.zc(x)]);
  for (let o = 0; o <= V.A + V.BORE; o += 2) pts.push([e.x + e.ux * o, e.z + e.uz * o]);
  const S = [0]; for (let i = 1; i < pts.length; i++) S.push(S[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const len = S[S.length - 1];
  const at = s => {   // [x, z, ux, uz]
    s = clamp(s, 0, len);
    let lo = 0, hi = S.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
    const a = pts[lo], b = pts[hi], t = (s - S[lo]) / (S[hi] - S[lo] || 1), l = S[hi] - S[lo] || 1;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (b[0] - a[0]) / l, (b[1] - a[1]) / l];
  };
  // 編成：車種與反向。EXT 是車身前後端在模型座標的 z（車頭朝 +z；props.json 的外框還算進了拿掉的終點站字幕，車頭不在原點正中），
  // 替身照同樣的長度。off：車廂原點在車頭後面多遠；車廂之間留 0.4 m 的貫通道
  const EXT = { cab: [-9.91, 10.71], mid: [-9.98, 10.03], tail: [-9.6, 9.6] };
  const cars = [['cab', 0], ['mid', 0], ['tail', 0], ['mid', 0], ['cab', 1]].map(([id, rev]) => ({ id, rev, L: EXT[id][1] - EXT[id][0], obj: null, s: 0, x: 0, z: 0, ux: 1, uz: 0, on: false }));
  let off = 0;
  for (const c of cars) { const [z0, z1] = EXT[c.id], fr = c.rev ? -z0 : z1, bk = c.rev ? z1 : -z0; c.off = off + fr; c.mid = (z0 + z1) / 2 * (c.rev ? -1 : 1); off += fr + bk + .4; }
  return { V, D, pts, S, len, at, cars, EXT, trainL: off - .4, uM: { value: new T.Vector4(1, 0, 1, 0) },
    t: 0, speed: 17, wait: 38, dir: 1, s: -1e9, state: 'wait', tw: 12, hornCd: 0, joint: 0, hitCd: 0, loaded: false, req: false, snd: false };
})() : null;
const RAIL_NEAR = 1100, RAIL_ZN = VIADUCT ? VIADUCT.zn : null;
// 山頭蓋板的高度（公園框的座標，d：離鐵軌中心的橫向距離）：沒挖溝的山坡，比山頭的輪廓低就照輪廓
const railLid = (x, z, d) => Math.max(VIADUCT.deck + 17 - .7 * Math.max(0, Math.abs(d) - 10), parkLidH(x, z));

if (RAIL) {
  const L0 = coastLights.length, V = VIADUCT, D = V.deck, R = RAIL, k = new Kit(), con = 0x8c877e, con2 = 0x66625b, dark = 0x050506, steel = 0x3e4a52, warm = 0xffcf8a, wood = 0x4a3a2a;
  const P = (e, o, d) => [e.x + e.ux * o - e.uz * d, e.z + e.uz * o + e.ux * d];   // 端點座標系 → 公園框的座標
  // 燈與圓柱碰撞換成世界座標（w: 1），開場的 cityWorld 不會再照區換一次
  const railLight = (x, y, z, col, r, i) => { const [X, Z] = toW(x, z, RAIL_ZN), l = coastLight(X, y, Z, col, r, i); l.w = 1; return l; };
  const circle = (x, z, r) => { const [X, Z] = toW(x, z, RAIL_ZN); circles.push({ x: X, z: Z, r, w: 1 }); };
  // 沿端點方向擺一個盒：中心 (o, d)、y，長（沿 o）、高、寬（沿 d）
  const ebox = (e, o, d, y, lo, h, wd, col, mat = 2) => { const [x, z] = P(e, o, d); k.box(x, y, z, lo, h, wd, col, mat, 0, Math.atan2(-e.uz, e.ux), 0); };
  for (const e of V.ends) {
    const A = V.A, B = V.BORE;
    // ─── 洞門：8 m 厚、32 m 寬的混凝土塊，中間留 5.6×6.6 m 的洞口；頂上壓頂、洞口外框、兩側斜出的翼牆 ───
    for (const s of [-1, 1]) ebox(e, A + 4, s * 9.4, D + 8.1, 8, 18.8, 13.2, con, 2);   // 洞口兩側（頂在橋面上 17.5 m）
    ebox(e, A + 4, 0, D + 6.6 + (17.5 - 6.6) / 2, 8, 17.5 - 6.6, 5.8, con, 2);   // 洞口上方
    ebox(e, A + .2, 0, D + 17.85, 1.6, .9, 33.6, con2, 2);   // 壓頂
    for (const y of [4.2, 8.6, 13]) for (const s of [-1, 1]) ebox(e, A - .04, s * 9.6, D + y, .1, .12, 12.4, con2, 2);   // 混凝土的施工縫
    for (const s of [-1, 1]) ebox(e, A - .15, s * 3.15, D + 3.3, .3, 6.6, .5, con2, 2);   // 洞口外框
    ebox(e, A - .15, 0, D + 6.85, .3, .5, 6.8, con2, 2);
    for (const s of [-1, 1]) {   // 翼牆：從洞門的角（A, ±16）斜到（A − 12, ±24），頂從洞門頂斜降到橋面上 3 m（梯形擠出 1.2 m 厚）
      const [x0, z0] = P(e, A, s * 16), [x1, z1] = P(e, A - 12, s * 24), L = Math.hypot(x1 - x0, z1 - z0);
      const sh = new T.Shape([new T.Vector2(0, Math.min(D - 1, parkH(x0, z0) - 1)), new T.Vector2(L, Math.min(D - 1, parkH(x1, z1) - 1)), new T.Vector2(L, D + 3), new T.Vector2(0, D + 17.5)]);
      const g = new T.ExtrudeGeometry(sh, { depth: 1.2, bevelEnabled: false }); g.translate(0, 0, -.6);
      k.add(g, con, 2, tf(x0, 0, z0, 0, Math.atan2(-(z1 - z0), x1 - x0), 0));
    }
    // ─── 山頭蓋板：10-city.js 在隧道經過的地方挖了一條溝，這塊從洞門後面蓋到洞底後面（|d| ≤ 12，2 m 一格）；高度是沒挖溝的山坡（parkLidH），
    // 山坡比山頭的輪廓（|d| ≤ 10 平頂 D + 17，再往外每公尺降 0.7 m）低的地方照輪廓；頂點色和山一樣，高 8 cm 蓋住溝邊的三角形 ───
    {
      const no = Math.ceil((B - 6) / 2), nd = 12, pos = [], col = [], idx = [], c = new T.Color();
      for (let i = 0; i <= no; i++) for (let j = 0; j <= nd; j++) {
        const o = A + 8 + (B - 6) * i / no, d = -12 + 24 * j / nd, [x, z] = P(e, o, d), y = railLid(x, z, d) + .08, [X, Z] = toW(x, z, RAIL_ZN);
        pos.push(x, y, z); hillColor(c, X, Z, y); col.push(c.r, c.g, c.b);
        if (i && j) { const a = (i - 1) * (nd + 1) + j - 1, b = i * (nd + 1) + j - 1; idx.push(...(e.s > 0 ? [a, a + 1, b, b, a + 1, b + 1] : [a, b, a + 1, a + 1, b, b + 1])); }
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setAttribute('aMat', new T.Float32BufferAttribute(new Array(pos.length / 3).fill(2), 1));
      g.setIndex(idx); g.computeVertexNormals();
      if (g.attributes.normal.array[1] < 0) { g.setIndex(idx.map((v, n) => idx[n - n % 3 + [0, 2, 1][n % 3]])); g.computeVertexNormals(); }   // 繞序朝下就翻過來
      const lm = new T.Mesh(g, MAT.uber); lm.name = 'railLid'; cityAdd(lm, RAIL_ZN);
    }
    ebox(e, A + 4 + B / 2, 0, D - .24, B - 8, .1, 6.1, 0x46423c, 2);   // 洞裡的地面（溝底）
    // ─── 隧道：兩面洞壁、拱頂、黑色的洞底，洞壁上每 12 m 一盞燈 ───
    for (const s of [-1, 1]) ebox(e, A + 8 + (B - 8) / 2, s * 3.05, D + 3.2, B - 8, 7, .5, con2, 2);
    ebox(e, A + 8 + (B - 8) / 2, 0, D + 6.85, B - 8, .5, 6.6, con2, 2);
    ebox(e, A + B + .3, 0, D + 3.3, .6, 7, 6.6, dark, 2);
    for (let o = A + 12, i = 0; o < A + B - 4; o += 12, i++) {
      const s = i % 2 ? 1 : -1, [x, z] = P(e, o, s * 2.7);
      ebox(e, o, s * 2.72, D + 4.6, .5, .18, .14, 0xffe2b0, 11);
      railLight(x, D + 4.4, z, 0xffd8a0, 7, .7);
    }
    // ─── 平台：道碴、枕木、兩條鋼軌，從橋端接到洞底；兩側矮的混凝土路緣 ───
    for (let o = -1; o < A + B; o += .65) ebox(e, o, 0, D - .12, .24, .14, 2.6, wood, 2);
    ebox(e, (A + B - 1) / 2, 0, D - .2, A + B + 1, .16, 3.8, 0x4c4840, 2);
    for (const s of [-1, 1]) ebox(e, (A + B - 1) / 2, s * .72, D + .02, A + B + 1, .14, .08, 0x6c6a66, 15);
    for (const s of [-1, 1]) ebox(e, A / 2 - .5, s * 6.4, D - .05, A + 1, .4, .35, con2, 2);
    // ─── 洞門上的燈、號誌（綠＝可以過、紅＝列車進站）、隧道名牌 ───
    for (const s of [-1, 1]) {
      ebox(e, A - .4, s * 4.6, D + 7.6, .5, .4, .5, 0xffe2b0, 11);
      const [x, z] = P(e, A - 1.4, s * 4.6); railLight(x, D + 7.2, z, warm, 16, 1.4);
    }
    {
      const sd = e.s > 0 ? -4.4 : 4.4, [x, z] = P(e, A - 7, sd);   // 號誌桿：列車出洞的右手邊
      k.cyl(x, D + 2.6, z, .09, .11, 5.2, 8, 0x2a2c30, 15); ebox(e, A - 7.12, sd, D + 5.2, .14, 1.4, .6, 0x16181a, 15);
      railLight(x, D + 1.2, z, warm, 6, .4);
      circle(x, z, .2);
    }
    // 平台邊的燈：南側緩坡上來的地方兩盞
    for (const o of [2, A - 10]) {
      const sd = e.ux > 0 ? 7.6 : -7.6, [x, z] = P(e, o, sd), y = parkWalkH(x, z);
      k.cyl(x, y + 2.1, z, .07, .09, 4.2, 6, 0x2a2c30, 15).box(x, y + 4.25, z, .34, .3, .34, warm, 11);
      railLight(x, y + 4, z, warm, 14, 1.2); circle(x, z, .14);
    }
  }
  // ─── 橋上的燈：兩側護欄外每 16 m 一對（圓燈罩，遠遠看是兩串光點），橋墩頂兩盞紅色航空障礙燈，谷底的橋墩各兩盞往上打的投光燈 ───
  for (let x = V.x - V.W / 2 + 10; x < V.x + V.W / 2 - 6; x += 16) {
    const m = V.zc(x + 1) - V.zc(x), l = Math.hypot(1, m), nx = -m / l, nz = 1 / l;
    for (const s of [-1, 1]) {
      const px = x + nx * 6.2 * s, pz = V.zc(x) + nz * 6.2 * s, hx = px - nx * .55 * s, hz = pz - nz * .55 * s;
      k.cyl(px, D + 2, pz, .06, .08, 4, 6, 0x2a2c30, 15).box(px - nx * .3 * s, D + 4.05, pz - nz * .3 * s, .7, .08, .14, 0x2a2c30, 15, 0, Math.atan2(-nz, nx), 0);   // 燈臂朝橋面伸出去
      k.add(new T.SphereGeometry(.3, 10, 8), 0xfff0d0, 8, tf(hx, D + 3.8, hz));
      railLight(hx, D + 3.6, hz, 0xffe8c0, 12, 1.1);
    }
  }
  for (const p of V.piers) {
    const x = (p.x0 + p.x1) / 2, z = (p.z0 + p.z1) / 2, g = V.at(x - V.x - V.lx0, z - V.z - V.lz0) + V.y;
    for (const s of [-1, 1]) k.box(x, D - 4.2, z + s * (p.z1 - p.z0) * .32, .55, .55, .55, 0xff2a1a, 8);
    railLight(x, D - 4.8, z, 0xff3020, 12, 1);
    if (D - g > 12) for (const s of [-1, 1]) { k.box(x + s * 5, g + .4, z + 7, .7, .8, .7, 0xfff2d8, 8); railLight(x + s * 3, g + 4, z + 5, 0xffe6c0, 30, 2); }
  }
  const m = new T.Mesh(k.build(), MAT.ridge); m.name = 'railPortals'; cityAdd(m, RAIL_ZN);
  R.lights = coastLights.length - L0;   // 夜燈的數量（測試用）
  // 號誌燈：自己的材質，uM.x 綠、uM.y 紅（00-core 的材質 4 頭燈、5 尾燈）
  {
    const sk = new Kit();
    for (const e of V.ends) {
      const sd = e.s > 0 ? -4.4 : 4.4;
      for (const [dy, col, mat] of [[.35, 0x30ff70, 4], [-.3, 0xff3020, 5]]) { const [x, z] = P(e, V.A - 7.22, sd); sk.add(new T.SphereGeometry(.17, 10, 8), col, mat, tf(x, D + 5.2 + dy, z)); }
    }
    R.sig = mkUber(); R.sig.uniforms.uM.value.set(1, 0, 1, 0);
    cityAdd(new T.Mesh(sk.build(), R.sig), RAIL_ZN);
  }
  // 隧道名牌（洞口上方）：北嶺一號隧道（西）、二號隧道（東）
  V.ends.forEach((e, i) => {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256;
    const c = cv.getContext('2d'); c.fillStyle = '#3c3a36'; c.fillRect(0, 0, 1024, 256); c.strokeStyle = '#8a857c'; c.lineWidth = 10; c.strokeRect(14, 14, 996, 228);
    c.fillStyle = '#e8e2d2'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '700 104px "Avenir Next Condensed","DIN Condensed","Arial Narrow",system-ui,sans-serif'; c.fillText(`北嶺${i ? '二' : '一'}號隧道`, 512, 100);
    c.font = '600 46px "Avenir Next Condensed","DIN Condensed","Arial Narrow",system-ui,sans-serif'; c.fillStyle = '#c8c0ae'; c.fillText(`NORTH RIDGE TUNNEL ${i ? 'II' : 'I'} · ${V.BORE + 8} m`, 512, 196);
    const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 4;
    const pl = new T.Mesh(new T.PlaneGeometry(5.2, 1.3), new T.MeshBasicMaterial({ map: tx, toneMapped: false, color: 0xa8a8a8 }));
    const [x, z] = P(e, V.A - .32, 0); pl.position.set(x, D + 9.6, z); pl.rotation.y = Math.atan2(-e.ux, -e.uz); cityAdd(pl, RAIL_ZN);
  });
  // ─── 模型下載前（以檔案開啟就一直是它）的程式替身：沿中心線的鋼梁與護欄、量到的橋墩、兩條鋼軌。27-world1.js 擺好模型就拿掉 ───
  {
    const pk = new Kit(), n = Math.ceil(V.W / 12), x0 = V.x - V.W / 2;
    for (let i = 0; i < n; i++) {
      const xa = x0 + V.W * i / n, xb = x0 + V.W * (i + 1) / n, za = V.zc(xa), zb = V.zc(xb), L = Math.hypot(xb - xa, zb - za), a = -Math.atan2(zb - za, xb - xa), mx = (xa + xb) / 2, mz = (za + zb) / 2;
      pk.box(mx, D - 1.8, mz, L + .2, 3, 5.4, steel, 15, 0, a, 0).box(mx, D - .2, mz, L + .2, .3, 9.4, 0x4a4a46, 2, 0, a, 0);
      for (const s of [-.72, .72]) pk.box(mx - Math.sin(a) * s, D + .02, mz - Math.cos(a) * s, L + .2, .14, .08, 0x6c6a66, 15, 0, a, 0);
      for (const s of [-4.7, 4.7]) pk.box(mx - Math.sin(a) * s, D + .55, mz - Math.cos(a) * s, L + .2, 1.1, .12, steel, 15, 0, a, 0);
    }
    for (const p of V.piers) {
      const x = (p.x0 + p.x1) / 2, z = (p.z0 + p.z1) / 2, g = V.at(x - V.x - V.lx0, z - V.z - V.lz0) + V.y - 2, h = D - 3.3 - g;
      if (h > 2) pk.box(x, g + h / 2, z, (p.x1 - p.x0) * .5, h, (p.z1 - p.z0) * .45, 0x7a7068, 2);
    }
    V.proxy = new T.Mesh(pk.build(), MAT.ridge); cityAdd(V.proxy, RAIL_ZN);
  }

  // ─── 步行面（20-walk.js）───
  const inPier = (x, z) => V.piers.some(p => x > p.x0 - .4 && x < p.x1 + .4 && z > p.z0 - .4 && z < p.z1 + .4);
  const segD = (o, d, o0, d0, o1, d1) => { const a = o1 - o0, b = d1 - d0, t = clamp(((o - o0) * a + (d - d0) * b) / (a * a + b * b), 0, 1); return Math.hypot(o - o0 - a * t, d - d0 - b * t); };
  const R0 = NPARK.rail;
  WALKS.push({
    zn: RAIL_ZN, bb: [R0.x0 - 20, R0.x1 + 20, R0.z0 - 20, R0.z1 + 20],
    y(x, z, y0, cam) {
      for (const e of V.ends) {
        const [o, d] = V.frame(e, x, z), ad = Math.abs(d), A = V.A;
        if (o < A - 13 || o > A + V.BORE + 2 || ad > 26) continue;
        if (y0 < D + 4) {
          if (o >= A - .3) {
            if (ad <= 2.5) return o < A + V.BORE - 1 ? D : cam ? D : null;   // 隧道裡；洞底擋住
            if (ad <= 16 && o <= A + 8 || ad <= 12) return cam ? D : null;   // 洞門的混凝土、隧道兩邊的山
          }
          if (ad > 14 && segD(o, ad, A, 16, A - 12, 24) < .55) return cam ? undefined : null;   // 翼牆
        } else if (o >= A && o <= A + 8 && ad <= 16 && y0 > D + 12) return D + 17.5;   // 站在洞門頂上
        else if (o > A + 8 && o < A + V.BORE + 6 && ad <= 16) return railLid(x, z, d);   // 山頭蓋板上（底下是隧道的溝）
      }
      if (Math.abs(x - V.x) <= V.W / 2 + .5) {
        const dz = Math.abs(z - V.zc(x));
        if (y0 > D - 2.5) { if (dz <= 4.4) return D; if (dz <= 6.6) return cam ? D : null; }   // 橋面：護欄之間（列車兩側各約 3 m 的走道）
        else if (!cam && inPier(x, z)) return null;   // 谷底的橋墩
      }
      return undefined;
    },
    ceil(x, z, y0) {
      if (y0 >= D + 4) return undefined;
      for (const e of V.ends) { const [o, d] = V.frame(e, x, z); if (o > V.A - .5 && o < V.A + V.BORE + 1 && Math.abs(d) < 3.2) return D + 6.1; }
      return undefined;
    },
    clampCam(x, z, y0) {
      if (y0 >= D + 4) return undefined;
      for (const e of V.ends) {
        const [o, d] = V.frame(e, x, z);
        if (o < V.A + .2 || o > V.A + V.BORE + 20 || Math.abs(d) > 24) continue;
        const oc = Math.min(o, V.A + V.BORE - 1.2), dc = clamp(d, -2.2, 2.2);
        if (oc !== o || dc !== d) return P(e, oc, dc);
      }
      return undefined;
    },
  });
}

// ─── 列車：程式替身（白色車身、紅色腰帶、亮的車窗、頭燈）；模型下載好就換掉 ───
function railProxyCar(id) {
  const c = RAIL.cars.find(c => c.id === id), L = c.L, k = new Kit(), body = 0xdcdcd6, red = 0xb3201c, glass = 0x1a1c20;
  const cab = id === 'cab', L0 = cab ? L - 3 : L;
  k.box(0, 2.15, cab ? -1.5 : 0, 2.9, 3.1, L0, body, 10).box(0, 1.25, cab ? -1.5 : 0, 2.92, .45, L0, red, 10);
  k.box(0, .45, 0, 2.4, .6, L - 1, 0x2a2c30, 15);
  for (const s of [-1, 1]) k.box(s * 1.46, 2.45, cab ? -1.5 : 0, .04, .8, L0 - 3, 0xffd9a0, 11);
  for (const z of [-L / 2 + 3, L / 2 - 3]) k.box(0, .55, z, 2.2, .7, 2.6, 0x16181a, 15);
  if (cab) {
    k.box(0, 1.9, L / 2 - 1.5, 2.8, 2.6, 3, body, 10, -.18).box(0, 2.9, L / 2 - .4, 2.4, 1, .1, glass, 1, -.5).box(0, 1.25, L / 2 - .2, 2.6, .4, .3, red, 10);
    for (const s of [-1, 1]) k.box(s * .85, 1.5, L / 2 - .05, .36, .2, .1, 0xfff4d0, 4);
  }
  const m = new T.Mesh(k.build(), RAIL.mat || (RAIL.mat = (() => { const mt = mkUber(); mt.uniforms.uM = RAIL.uM; return mt; })()));
  m.position.z = (RAIL.EXT[id][0] + RAIL.EXT[id][1]) / 2;   // 車身前後不對稱：和模型一樣，車頭那端離原點遠一點
  const g = new T.Group(); g.add(m); return g;
}
// 下載的模型：材質複製一份、uM 換成列車自己的（車窗與頭燈的亮度）；其他 uniform 照樣共用原本的物件
function railGlbCar(item) {
  const g = new T.Group(), mats = RAIL.glbMats || (RAIL.glbMats = new Map());
  for (const p of item.parts) {
    let m = mats.get(p.mat);
    if (!m) { m = p.mat.clone(); m.uniforms = { ...p.mat.uniforms, uM: RAIL.uM }; mats.set(p.mat, m); }
    g.add(new T.Mesh(p.geo, m));
  }
  return g;
}
function railBuild(items) {
  for (const c of RAIL.cars) {
    const o = items ? railGlbCar(items[c.id]) : railProxyCar(c.id);
    o.visible = c.obj ? c.obj.visible : false;
    if (c.obj) { o.position.copy(c.obj.position); o.rotation.copy(c.obj.rotation); c.obj.removeFromParent(); }
    c.obj = o; cityAdd(o, RAIL_ZN);
  }
  RAIL.loaded = !!items;
}
if (RAIL) railBuild(null);

// 每幀：班次、車廂位置、號誌、聲音、撞到人。t 一直走（離得遠也照時刻表），走近才下載模型
function railUpdate(dt) {
  if (!RAIL) return;
  const R = RAIL, V = R.V, D = R.D;
  const [px, pz] = toL(player.x, player.z, RAIL_ZN), near = Math.hypot(px - V.x, pz - V.z);
  if (GLB_ON && !R.req && near < RAIL_NEAR) { R.req = true; loadProps('w1_train').then(items => { if (items && items.cab && items.mid && items.tail) railBuild(items); }); }
  // 班次：wait（藏在洞裡）→ run（車頭從一端洞底開到車尾過了另一端洞底）→ 換方向
  if (R.state === 'wait') {
    R.tw -= dt;
    if (R.tw <= 0) { R.state = 'run'; R.s = R.dir > 0 ? 0 : R.len; R.horned = false; }
  } else {
    R.s += R.dir * R.speed * dt;
    if (R.dir > 0 ? R.s - R.trainL > R.len + 4 : R.s + R.trainL < -4) { R.state = 'wait'; R.tw = R.wait; R.dir = -R.dir; }
  }
  const run = R.state === 'run', night = atm.lamp;
  R.uM.value.set(1, 0, .1 + .55 * night, 0);
  // 號誌：列車要出洞前 12 秒到車尾離開，那一端是紅燈
  if (R.sig) R.sig.uniforms.uM.value.set(run ? 0 : 1, run ? 1 : 0, 1, 0);
  let nearest = 1e9;
  for (const c of R.cars) {
    const sc = R.s - R.dir * c.off;   // 車廂中心沿路徑的位置（車頭在前）
    c.on = run && sc > -6 && sc < R.len + 6 && near < 2400;
    c.obj.visible = c.on;
    if (!c.on) continue;
    const h = c.L * .36, a = R.at(sc - h), b = R.at(sc + h), x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2;
    let ux = b[0] - a[0], uz = b[1] - a[1]; const l = Math.hypot(ux, uz) || 1; ux /= l; uz /= l;
    const fwd = R.dir * (c.rev ? -1 : 1);   // 車頭朝行進方向；最後一節反過來
    c.x = x; c.z = z; c.ux = ux * R.dir; c.uz = uz * R.dir;
    c.obj.position.set(x, D, z); c.obj.rotation.y = Math.atan2(ux * fwd, uz * fwd);
    nearest = Math.min(nearest, Math.hypot(px - x, pz - z));
    // 撞到人：在橋面、平台或隧道那一層，站在車身的範圍裡
    if (R.hitCd <= 0 && player.mode === 'walk' && player.where === 'out' && Math.abs(player.y - D) < 2.4) {
      const al = (px - x) * ux + (pz - z) * uz, lat = (pz - z) * ux - (px - x) * uz;
      if (Math.abs(al - c.mid) < c.L / 2 + .3 && Math.abs(lat) < 1.75) {
        // 撞到旁邊 2.2 m（橋面的走道、隧道的洞壁邊都站得下，列車半寬 1.45 m），再往外倒
        R.hitCd = 2; const s = lat >= 0 ? 1 : -1, [kx, kz] = dirW(RAIL_ZN, -uz * s + c.ux * .6, ux * s + c.uz * .6);
        [player.x, player.z] = toW(x + ux * al - uz * s * 2.2, z + uz * al + ux * s * 2.2, RAIL_ZN);
        knockPlayer(kx, kz); hurtPlayer(45, player.x - kx, player.z - kz); sfx.impact(14); camState.shake = 1;
      }
    }
  }
  R.hitCd -= dt;
  // 汽笛：車頭出洞時鳴一次；有人站在前面 160 m 內的軌道上也鳴
  const fr = R.at(R.s), fo = Math.max(...V.ends.map(e => V.frame(e, fr[0], fr[1])[0]));   // 車頭離最近那一端洞門往裡多深（負的是在洞外）
  if (run && !R.horned && fo < V.A + 2 && near < 900) { R.horned = true; sfx.trainHorn(clamp(1 - Math.hypot(px - fr[0], pz - fr[1]) / 700, .15, 1)); }
  R.hornCd -= dt;
  if (run && R.hornCd <= 0 && Math.abs(player.y - D) < 2.4) {
    const al = ((px - fr[0]) * fr[2] + (pz - fr[1]) * fr[3]) * R.dir, lat = Math.abs((pz - fr[1]) * fr[2] - (px - fr[0]) * fr[3]);
    if (al > 0 && al < 160 && lat < 2.2) { R.hornCd = 3.5; sfx.trainHorn(1); }
  }
  // 行駛聲：越近越大，過軌縫（每 18 m）喀噠一下；在隧道裡悶一點
  const k = run ? clamp(1 - nearest / 380, 0, 1) * (fo > V.A ? .6 : 1) : 0, j = Math.floor(R.s / 18), clack = j !== R.joint;
  R.joint = j; if (k > 0 || R.snd) sfx.trainRun(k, clack); R.snd = k > 0;
}
// 列車頭燈（99-main.js 的 pickLights）：夜裡、相機 300 m 內，車頭前方一盞聚光燈
function railLights() {
  if (!RAIL || RAIL.state !== 'run' || atm.lamp < .2) return [];
  const c = RAIL.cars[0]; if (!c.on) return [];
  const f = c.L / 2 + c.mid + .4, [x, z] = toW(c.x + c.ux * f, c.z + c.uz * f, RAIL_ZN), [dx, dz] = dirW(RAIL_ZN, c.ux, c.uz);
  if (Math.hypot(x - camera.position.x, z - camera.position.z) > 300) return [];
  return [{ x, y: RAIL.D + 1.6, z, col: HEAD_COL, r: 60, i: 4 * atm.lamp, dir: [dx, -.06, dz], cos: .9 }];
}
// 測試 API（99-main.js 的 __nc.props.rail）
const railApi = {
  get R() { return RAIL; },
  // 讓列車馬上從 dir 那一端出發（s：車頭的位置，省略是洞底）
  go(dir = 1, s) { if (!RAIL) return; RAIL.dir = dir; RAIL.state = 'run'; RAIL.s = s ?? (dir > 0 ? 0 : RAIL.len); RAIL.horned = false; },
  hold() { if (!RAIL) return; RAIL.state = 'wait'; RAIL.tw = 1e9; },
  walk: (X, Z, y0) => walkAt(X, Z, y0),
  // 鐵道橋的座標（公園框）和世界座標互換、擺位置（驗收腳本用，不寫死世界座標）
  W: (x, z) => toW(x, z, RAIL_ZN), L: (X, Z) => toL(X, Z, RAIL_ZN), yaw: y => yawW(RAIL_ZN, y),
  tp(x, z, yaw = 0) { const [X, Z] = toW(x, z, RAIL_ZN); window.__nc.tp(X, Z, yawW(RAIL_ZN, yaw)); },
};
