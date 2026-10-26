// ═══ 程式立面的浮雕：窗台與窗楣、窗側框、店面壁柱、入口門框與雨遮、簷口托架與飾帶、轉角壁柱、女兒牆與壓頂、玻璃帷幕的直向鰭片；
//     腰線（一樓頂與每兩、三層一道）、轉角隅石、入口的門扇與氣窗、門燈與門牌、海濱灰泥樓的百葉窗與花台 ═══
// 10-city.js 的立面（boxFaces＋FACADE_FS）是平的四邊形，磚、窗、店面都是著色器畫的；這裡照同一套窗格（gH、fh、ws、cols、mg、wmin／wmax、店面 units）
// 擺出凸出牆面的幾何，照紐約老公寓的照片：石窗台與窗楣（中間一塊拱心石）、店面之間的壁柱與柱頭、簷口下的托架與飾帶。
// 只擺看得到的面：正面一定擺，兩側只擺高過隔壁地塊的樓層，背面不擺。窗的零件用實例（距離串流 RELIEF_R），其他每個街區合併成一個網格。
// 實體建築下載失敗時 lotFallback 補回的立面沒有浮雕（那時這裡已經跑過了）
await bootTick(9, "刻上立面的窗台與簷口…");
const RELIEF_R = 230;
{
  const GH = 4.6;
  const brickish = st => st === 0 || st === 1 || st === 5 || st === 6;
  const wallHex = L => L.style === 0 ? 0x6e3226 : L.style === 1 ? 0x6b4d38 : L.style === 2 ? 0x8c8578 : L.style === 5 ? 0x1e1c1e
    : L.style === 4 ? (((L.seed * 7) % 1) < .5 ? 0x5c7f7f : 0x8c6670) : 0x733324;
  // 每種窗一組幾何（局部原點在窗洞下緣中點、+z 朝外）
  const winGeo = (ws, fh, kind) => {
    const w = .46 * ws, h = .62 * fh, k = new Kit();
    if (kind === 'brick') {
      const stone = 0x9e9480;
      k.box(0, -.05, .08, w + .24, .08, .16, stone, TX.stone).box(0, -.11, .05, w + .1, .05, .1, 0x8a8070, TX.stone);   // 窗台與下面的線腳
      k.box(0, h + .09, .045, w + .2, .17, .09, stone, TX.stone).box(0, h + .1, .06, .16, .22, .12, 0xaea490, TX.stone);   // 窗楣與拱心石
      for (const s of [-1, 1]) k.box(s * (w / 2 + .035), h / 2, .025, .07, h, .05, 0x2a221c, 2);
    } else if (kind === 'concrete') {
      k.box(0, -.04, .06, w + .12, .06, .12, 0x8a867e, TX.conc).box(0, h + .05, .03, w + .12, .1, .06, 0x7a766e, TX.conc);
      for (const s of [-1, 1]) k.box(s * (w / 2 + .03), h / 2, .02, .06, h, .04, 0x3a3a3a, 2);
    } else {   // 翻新樓：鋁框與薄窗台
      k.box(0, -.03, .05, w + .06, .04, .1, 0x3a3e44, TX.galv).box(0, h + .02, .02, w + .06, .04, .04, 0x3a3e44, TX.galv);
      for (const s of [-1, 1]) k.box(s * (w / 2 + .02), h / 2, .02, .04, h, .04, 0x3a3e44, TX.galv);
    }
    return k.build();
  };
  const WIN = {}, winList = k => (WIN[k] ||= []);
  const kits = new Map(), kitOf = L => { const key = L.b ? L.b.i + ',' + L.b.j : 'z' + (L.zn ? L.zn.id : '-'); if (!kits.has(key)) kits.set(key, { k: new Kit(), zn: L.zn }); return kits.get(key).k; };
  // 面 key 的幾何：起點 a（u = 0，面向觀看者的左邊）、u 方向、法線、寬
  const faceOf = (L, key) => key === 'pz' ? { ax: L.x0, az: L.z1, ux: 1, uz: 0, nx: 0, nz: 1, w: L.x1 - L.x0, ry: 0 }
    : key === 'nz' ? { ax: L.x1, az: L.z0, ux: -1, uz: 0, nx: 0, nz: -1, w: L.x1 - L.x0, ry: Math.PI }
    : key === 'px' ? { ax: L.x1, az: L.z1, ux: 0, uz: -1, nx: 1, nz: 0, w: L.z1 - L.z0, ry: Math.PI / 2 }
    : { ax: L.x0, az: L.z0, ux: 0, uz: 1, nx: -1, nz: 0, w: L.z1 - L.z0, ry: -Math.PI / 2 };
  // 面外側緊貼著的其他地塊有多高（沒有就是 0）
  const byBlock = new Map();
  for (const L of lots) { const k = L.b || L.zn; if (!byBlock.has(k)) byBlock.set(k, []); byBlock.get(k).push(L); }
  const coverH = (L, key) => {
    let h = 0;
    for (const N of byBlock.get(L.b || L.zn) || []) {
      if (N === L) continue;
      const hit = key === 'px' ? Math.abs(N.x0 - L.x1) < .05 && N.z0 < L.z1 - .5 && N.z1 > L.z0 + .5
        : key === 'nx' ? Math.abs(N.x1 - L.x0) < .05 && N.z0 < L.z1 - .5 && N.z1 > L.z0 + .5
        : key === 'pz' ? Math.abs(N.z0 - L.z1) < .05 && N.x0 < L.x1 - .5 && N.x1 > L.x0 + .5
        : Math.abs(N.z1 - L.z0) < .05 && N.x0 < L.x1 - .5 && N.x1 > L.x0 + .5;
      if (hit) h = Math.max(h, N.h + (N.glb ? 3 : 0));
    }
    return h;
  };
  // 面上 (u, y) 往外 out 公尺的點（局部框：x 沿 u、z 朝外），box 也照這個框擺
  const P = (F, u, y, out) => [F.ax + F.ux * u + F.nx * out, y, F.az + F.uz * u + F.nz * out];
  const fbox = (k, F, u, y, out, w, h, d, col, m = 2) => k.box(...P(F, u, y, out), w, h, d, col, m, 0, F.ry);
  for (const L of lots) {
    if (L.glb || L.style === 8) continue;
    const front = L.axis === 'z' ? (L.face > 0 ? 'pz' : 'nz') : (L.face > 0 ? 'px' : 'nx');
    const rear = { pz: 'nz', nz: 'pz', px: 'nx', nx: 'px' }[front];
    const k = kitOf(L), wall = wallHex(L), st = L.style, wm = brickish(st) ? TX.brick : TX.conc;
    // 店面的面：和 10-city.js 一樣（正面，排尾的地塊在大道那側也有）
    const shopF = {};
    if (!L.back) {
      shopF[front] = true;
      if (L.axis === 'z' && L.b && !L.b.outer) { if (Math.abs(L.x0 - (L.b.x0 + SW)) < .01) shopF.nx = true; if (Math.abs(L.x1 - (L.b.x1 - SW)) < .01) shopF.px = true; }
    }
    if (st === 3) {   // 玻璃帷幕：豎框位置立鰭片，每層一道細的樓板線腳；頂上 1.6 m 是霓虹冠帶
      for (const key of ['pz', 'nz', 'px', 'nx']) {
        const F = faceOf(L, key), cols = Math.max(1, Math.floor((F.w - 1) / 1.6)), mg = (F.w - cols * 1.6) / 2, y0 = Math.max(GH, coverH(L, key)), y1 = L.h - 1.6;
        if (y1 - y0 < 3) continue;
        for (let c = 0; c <= cols; c++) fbox(k, F, mg + c * 1.6, (y0 + y1) / 2, .14, .07, y1 - y0, .28, 0x2a2e34, TX.galv);
        for (let y = GH + 3.7; y < y1; y += 3.7) if (y > y0) fbox(k, F, F.w / 2, y, .05, F.w - 2 * mg, .12, .1, 0x30343a, TX.galv);
        if (key === front && !L.back) for (const s of [0, F.w]) fbox(k, F, s, GH / 2, .1, .5, GH, .2, 0x30343a, TX.galv);
      }
      continue;
    }
    const fh = st === 2 ? 3.4 : 3.1, ws = st === 2 ? 2.2 : 2.5, nF = Math.floor((L.h - GH - .7) / fh);
    const kind = brickish(st) ? 'brick' : st === 2 ? 'concrete' : 'alu', wkey = kind + ws;
    for (const key of ['pz', 'nz', 'px', 'nx']) {
      if (key === rear) continue;
      const F = faceOf(L, key), cov = coverH(L, key), isFront = key === front;
      if (!isFront && cov >= L.h - .5) continue;
      // 窗：窗格和 FACADE_FS 一樣
      const cols = Math.max(1, Math.floor((F.w - 1) / ws)), mg = (F.w - cols * ws) / 2;
      for (let fi = 0; fi < nF; fi++) {
        const y = GH + fi * fh + .18 * fh;
        if (y < cov + .3) continue;
        for (let ci = 0; ci < cols; ci++) { const [x, , z] = P(F, mg + (ci + .5) * ws, 0, 0); winList(wkey).push({ x, y, z, ry: F.ry, zn: L.zn }); }
      }
      if (cov > 1) continue;
      // 一樓：店面之間的壁柱（柱礎、柱身、柱頭），或住宅入口的門框與雨遮
      if (shopF[key] && st !== 5) {
        const units = Math.max(1, Math.round(F.w / 6.5)), uw = F.w / units, pc = st === 6 ? 0x0f291f : 0x4d4742;
        for (let u = 0; u <= units; u++) {
          const a = u === 0 ? .28 : u === units ? F.w - .28 : u * uw;
          fbox(k, F, a, 1.71, .07, .55, 3.42, .14, pc, TX.stone).box(...P(F, a, .2, .1), .64, .4, .2, 0x3a3532, TX.stone, 0, F.ry).box(...P(F, a, 3.38, .1), .66, .12, .2, 0x5a544e, TX.stone, 0, F.ry);
        }
      } else if (st !== 5) {
        const c = F.w / 2;
        for (const s of [-1, 1]) fbox(k, F, c + s * .86, 1.42, .06, .2, 2.84, .12, 0x2a221c);
        fbox(k, F, c, 2.9, .07, 1.92, .16, .14, 0x2a221c).box(...P(F, c, 3.08, .55), 2.3, .1, 1.1, 0x26282c, TX.iron, 0, F.ry);   // 門楣與雨遮
        for (const s of [-1, 1]) k.bar(...P(F, c + s * 1.0, 2.55, .02), ...P(F, c + s * 1.0, 3.03, 1.0), .04, .04, 0x26282c, TX.iron);
        fbox(k, F, c, .08, .3, 2.0, .16, .6, 0x77736b, TX.conc);   // 門前的台階
        // 門：雙扇木門（每扇上下兩塊凸起的門板）、上面一扇氣窗（玻璃加三根直櫺）、兩側的壁燈與門牌
        const door = [0x2b3a2e, 0x3a2420, 0x1f2a36, 0x2a2622][Math.floor(L.seed * 3) % 4];
        for (const s of [-1, 1]) {
          fbox(k, F, c + s * .38, 1.12, .035, .74, 2.24, .05, door, TX.woodY);
          for (const y of [.62, 1.62]) fbox(k, F, c + s * .38, y, .065, .5, .74, .03, door, TX.woodY);
          fbox(k, F, c + s * .06, 1.12, .07, .04, .16, .04, 0x9a8a5a, 3);   // 把手（黃銅）
        }
        fbox(k, F, c, 2.52, .03, 1.5, .4, .04, 0x161a20, 0);
        for (const u of [-.37, 0, .37]) fbox(k, F, c + u, 2.52, .055, .035, .4, .03, 0x2a221c);
        for (const s of [-1, 1]) {
          fbox(k, F, c + s * 1.22, 2.25, .06, .16, .22, .12, 0x1c1c1e, TX.iron);
          fbox(k, F, c + s * 1.22, 2.16, .16, .14, .2, .14, 0xffd9a0, 11);   // 壁燈的燈罩（柔和自發光）
        }
        fbox(k, F, c + 1.22, 1.62, .025, .26, .18, .03, 0x9a8a5a, 3);   // 門牌
      }
    }
    // 正面：簷口下的飾帶與托架（磚樓），轉角壁柱
    const F = faceOf(L, front);
    if (brickish(st)) {
      fbox(k, F, F.w / 2, L.h - .82, .06, F.w, .24, .12, 0x5a4e44, TX.stone);
      for (let u = .4; u < F.w - .2; u += .7) fbox(k, F, u, L.h - .68, .17, .14, .26, .34, 0x6a5e52, TX.stone);
      if (st === 5) for (const s of [.22, F.w - .22]) fbox(k, F, s, (4.75 + L.h - .95) / 2, .04, .44, L.h - .95 - 4.75, .08, 0x2a282a, TX.stone);   // 其他磚樓是下面的轉角隅石
    }
    // 腰線：一樓頂一道（店面上緣），往上每兩層（灰泥樓）或三層（磚樓）一道，凸出 0.1 m；混凝土樓每層一道細的樓板線
    for (const key of ['pz', 'nz', 'px', 'nx']) {
      if (key === rear) continue;
      const F2 = faceOf(L, key), cov = coverH(L, key);
      if (key !== front && cov >= L.h - .5) continue;
      const every = st === 2 ? 1 : st === 4 ? 2 : 3, bandC = st === 4 ? 0xd8d0c0 : st === 2 ? 0x77736b : 0x8a7f70, bandM = st === 4 || st === 2 ? TX.conc : TX.stone;
      if (cov < GH - .2) fbox(k, F2, F2.w / 2, GH - .02, .07, F2.w, .2, .14, bandC, bandM);
      for (let fi = every; fi < nF; fi += every) {
        const y = GH + fi * fh - .12;
        if (y > cov + .2 && y < L.h - 1.2) fbox(k, F2, F2.w / 2, y, .05, F2.w, st === 2 ? .1 : .16, st === 2 ? .1 : .1, bandC, bandM);
      }
      // 轉角隅石：磚樓與灰泥樓的兩個角，一長一短交錯的石塊（每塊 0.38 m 高），從一樓頂到簷口
      if (st !== 2 && st !== 5) for (const [u, sgn] of [[0, 1], [F2.w, -1]]) {
        for (let y = Math.max(GH, cov + .2), n = 0; y < L.h - 1.1; y += .4, n++) {
          const lw = n % 2 ? .34 : .58;
          fbox(k, F2, u + sgn * lw / 2, y + .19, .03, lw, .36, .06, st === 4 ? 0xe2dccd : 0x9e9480, st === 4 ? TX.conc : TX.stone);
        }
      }
    }
    // 海濱的灰泥樓（style 4）：每扇窗兩側一對木百葉窗、隔一扇一個花台（紅花綠葉）
    if (st === 4) {
      const F2 = faceOf(L, front), cols = Math.max(1, Math.floor((F2.w - 1) / ws)), mg = (F2.w - cols * ws) / 2, w = .46 * ws, h = .62 * fh;
      const shut = [0x2f5e6a, 0x3d6b4a, 0x7a3a34, 0x2e4a72][Math.floor(L.seed * 5) % 4];
      for (let fi = 0; fi < nF; fi++) for (let ci = 0; ci < cols; ci++) {
        const u = mg + (ci + .5) * ws, y = GH + fi * fh + .18 * fh;
        for (const s of [-1, 1]) {
          fbox(k, F2, u + s * (w / 2 + w * .27), y + h / 2, .04, w * .5, h, .05, shut, TX.woodY);
          for (let j = 1; j < 7; j++) fbox(k, F2, u + s * (w / 2 + w * .27), y + h * j / 7, .07, w * .44, .025, .02, shut, TX.woodY);
        }
        if ((fi + ci) % 2 === 0) {
          fbox(k, F2, u, y - .2, .2, w + .12, .22, .26, 0x6a4a34, TX.woodX);
          for (let j = 0; j < 4; j++) fbox(k, F2, u - w / 2 + (j + .5) * w / 4, y - .02, .2, w / 4.4, .16, .2, j % 2 ? 0xb0283a : 0x3e6a2c, 2);
        }
      }
    }
    // 女兒牆與壓頂：四邊貼著外牆往上 0.75 m（簷口頂在 h + 0.06），屋頂從街上看是圍起來的；斜屋頂（19-roofs.js）的樓不擺
    if (roofKind(L)) continue;
    const t = .26, ph = .75, y = L.h + ph / 2;
    k.box((L.x0 + L.x1) / 2, y, L.z0 + t / 2, L.x1 - L.x0, ph, t, wall, wm).box((L.x0 + L.x1) / 2, y, L.z1 - t / 2, L.x1 - L.x0, ph, t, wall, wm);
    k.box(L.x0 + t / 2, y, (L.z0 + L.z1) / 2, t, ph, L.z1 - L.z0 - 2 * t, wall, wm).box(L.x1 - t / 2, y, (L.z0 + L.z1) / 2, t, ph, L.z1 - L.z0 - 2 * t, wall, wm);
    const cy = L.h + ph + .04, cc = st === 2 || st === 4 ? 0x6a6c70 : 0x8a8478;
    k.box((L.x0 + L.x1) / 2, cy, L.z0 + t / 2, L.x1 - L.x0 + .08, .08, t + .08, cc, TX.stone).box((L.x0 + L.x1) / 2, cy, L.z1 - t / 2, L.x1 - L.x0 + .08, .08, t + .08, cc, TX.stone);
    k.box(L.x0 + t / 2, cy, (L.z0 + L.z1) / 2, t + .08, .08, L.z1 - L.z0, cc, TX.stone).box(L.x1 - t / 2, cy, (L.z0 + L.z1) / 2, t + .08, .08, L.z1 - L.z0, cc, TX.stone);
  }
  for (const key in WIN) {
    const kind = key.replace(/[\d.]+$/, ''), ws = +key.slice(kind.length);
    instanced(winGeo(ws, ws === 2.2 ? 3.4 : 3.1, kind), MAT.ux, WIN[key], LY.NOREFL, null, RELIEF_R);
  }
  let ki = 0;
  for (const { k, zn } of kits.values()) { const m = new T.Mesh(k.build(), MAT.ux); cityAdd(m, zn); cullAdd(m); await bootTick(9 + 1.4 * ++ki / kits.size); }
}
