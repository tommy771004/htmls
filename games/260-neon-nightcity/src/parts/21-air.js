// ═══ 灰鷺角國際機場（10-city.js 的 AIR：城西外海的填海島與接回楓林西的堤道，SEA_FR 座標框）═══
// 島（SEA_FR 座標 x −3300..−1000、z 20..600）由北到南：航廈前路與停車場、航廈（tools/props.mjs 的 air 組 term，玻璃拱門朝東）、機坪（三座空橋登機門、
// 遠端機位、機庫前）、平行滑行道、東西向跑道（西端外海上有進場燈）。堤道從楓林西第 9 條街出海，S 形接到島東緣北段的航廈前路；
// 東緣南段有一座梯子（游泳或開船上岸，31-boats.js 在旁邊停一艘船）。客機一次一架照固定的流程跑：遠端機位 → 滑行 → 往西起飛爬升到外海 →
// 從西邊進場降落 → 滑回遠端機位（客機不能駕駛）。模型只在 http(s) 下載（玩家離島 AIR_NEAR 公尺內），以檔案開啟用程式建模的替身。
// 座標：這個檔的 x、z 都是 SEA_FR 座標（沒有 ?zrot 時就是世界座標），airW 換成世界；碰撞盒用 AIR_F（沒有框的盒會被當成片的邏輯座標）
const AIR_ZN = SEA_FR, AIR_F = SEA_FR || frameW(0, 0, 1, 0), AIR_NEAR = 3600;
const airW = (x, z) => toW(x, z, AIR_ZN);
const AIR_YAW = AIR_ZN ? AIR_ZN.ry : 0;   // SEA_FR 的 yaw → 世界（剛體框，沒有彎曲）
// 版面（SEA_FR 座標）：跑道、滑行道、機坪、航廈與停機位
const AIR_L = AIR && (() => {
  const I = AIR.isl;
  return {
    I, rwy: { x0: -3200, x1: -1150, z: 500, hw: 22.5 }, twy: { x0: -3150, x1: -1200, z: 410, hw: 11.5 },
    links: [[-3150, 410, 500], [-2500, 410, 500], [-1950, 410, 500], [-1200, 410, 500], [-2300, 360, 410], [-1600, 360, 410], [-1300, 360, 410]],   // [x, z0, z1] 南北向的連絡道
    apron: { x0: -2650, x1: -1280, z0: 200, z1: 360 }, land: { x0: -1810, x1: -1000, z0: 40, z1: 90 }, plaza: { x0: -1815, x1: -1700, z0: 90, z1: 200 }, park: { x0: -1690, x1: -1290, z0: 100, z1: 190 },
    term: { x: -1900, z: 145, ry: Math.PI / 2 }, tower: { x: -1240, z: 160 }, hangar: { x: -2560, z: 265 },
    gates: [-1958, -1900, -1842].map((x, i) => ({ x, z: 200, plane: i === 1 ? 'b737' : 'a320' })),   // 空橋接在航廈南面（z 200），客機機頭朝北
    stands: [{ x: -2250, z: 300, ry: Math.PI, plane: 'b737' }, { x: -2560, z: 342, ry: Math.PI, plane: 'a320' }],   // 遠端機位、機庫門前
    stand: { x: -1360, z: 300 },   // 起降循環那一架停的遠端機位（機頭朝東，開出去不必推）
    ladder: { x: I.x1, z: 560 }, cause: { z0: 50, z1: 70 }, td: -3080,
  };
})();
if (AIR_L) {   // 00-core.js 的 applyFog：島的範圍（直升機飛到上空時霧變淡）
  const I = AIR_L.I, [cx, cz] = airW((I.x0 + I.x1) / 2, (I.z0 + I.z1) / 2), [ux, uz] = dirW(AIR_ZN, 1, 0);
  U.uAirA.value.set(cx, cz, ux, uz); U.uAirB.value.set((I.x1 - I.x0) / 2 + 60, (I.z1 - I.z0) / 2 + 20, 0, 0);
}

// ─── 地面、標線、燈、護岸、擋牆、堤道（一個網格，遠景材質：城西的岸邊隔著一公里的海也看得到）───
if (AIR_L) {
  const L = AIR_L, I = L.I, k = new Kit(), grass = 0x3b4733, asph = 0x2b2c2f, twc = 0x34363a, conc = 0x8e8c86, white = 0xe6e4dc, yel = 0xd9ae3a;
  const B = (x0, x1, z0, z1, y0, y1, col, mat = 2) => k.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, col, mat);
  B(I.x0, I.x1, I.z0, I.z1, -9, 0, grass);                                                // 島（頂是草地）
  // 護岸：四邊往海裡斜下去的消波石（往外 9 m、斜 32°）
  const th = .56, rk = 0x56524b, wR = 11;
  k.box((I.x0 + I.x1) / 2, -Math.sin(th) * wR / 2 - .5, I.z1 + Math.cos(th) * wR / 2 - .4, I.x1 - I.x0 + 16, 1.6, wR, rk, 2, th);
  k.box((I.x0 + I.x1) / 2, -Math.sin(th) * wR / 2 - .5, I.z0 - Math.cos(th) * wR / 2 + .4, I.x1 - I.x0 + 16, 1.6, wR, rk, 2, -th);
  k.box(I.x1 + Math.cos(th) * wR / 2 - .4, -Math.sin(th) * wR / 2 - .5, (I.z0 + I.z1) / 2, wR, 1.6, I.z1 - I.z0 + 16, rk, 2, 0, 0, -th);
  k.box(I.x0 - Math.cos(th) * wR / 2 + .4, -Math.sin(th) * wR / 2 - .5, (I.z0 + I.z1) / 2, wR, 1.6, I.z1 - I.z0 + 16, rk, 2, 0, 0, th);
  // 鋪面（高度一層層錯開，遠看不閃）：機坪、滑行道、連絡道、跑道、航廈前路、廣場、停車場
  const A = L.apron, R = L.rwy, W = L.twy;
  B(A.x0, A.x1, A.z0, A.z1, -.2, .06, conc);
  B(W.x0 - W.hw, W.x1 + W.hw, W.z - W.hw, W.z + W.hw, -.2, .08, twc);
  for (const [x, z0, z1] of L.links) B(x - W.hw, x + W.hw, z0, z1, -.2, .075, twc);
  B(R.x0, R.x1, R.z - R.hw, R.z + R.hw, -.2, .1, asph);
  B(R.x0 - 60, R.x0, R.z - R.hw, R.z + R.hw, -.2, .09, 0x35322c);                         // 跑道頭外的防爆區（黃色 V 字）
  B(R.x1, R.x1 + 50, R.z - R.hw, R.z + R.hw, -.2, .09, 0x35322c);
  B(L.land.x0, L.land.x1, L.land.z0, L.land.z1, -.2, .06, asph);
  B(L.plaza.x0, L.plaza.x1, L.plaza.z0, L.plaza.z1, -.2, .07, 0x6f6c66);
  B(L.park.x0, L.park.x1, L.park.z0, L.park.z1, -.2, .065, 0x3a3b3e);
  // 跑道標線：中線虛線、邊線、兩端的斑馬線（threshold）、著陸區與瞄準點
  const M = (x0, x1, z0, z1, col = white, y = .12) => B(x0, x1, z0, z1, y - .02, y, col);
  for (let x = R.x0 + 120; x < R.x1 - 120; x += 50) M(x, x + 30, R.z - .45, R.z + .45);
  for (const s of [-1, 1]) M(R.x0, R.x1, R.z + s * (R.hw - 1.4), R.z + s * (R.hw - .5));
  for (const [x, d] of [[R.x0 + 6, 1], [R.x1 - 6, -1]]) {
    for (let i = 0; i < 8; i++) for (const s of [-1, 1]) { const z = R.z + s * (3 + i * 2.3); M(Math.min(x, x + d * 30), Math.max(x, x + d * 30), z - .9, z + .9); }
    for (const [a, w] of [[400, 9], [150, 3], [300, 3], [500, 3], [600, 3]]) for (const s of [-1, 1]) {   // 瞄準點（兩條粗的）與著陸區的成對短條
      const x0 = x + d * a, z = R.z + s * (w > 5 ? 9 : 7.5); M(Math.min(x0, x0 + d * (w > 5 ? 45 : 22)), Math.max(x0, x0 + d * (w > 5 ? 45 : 22)), z - w / 2, z + w / 2);
    }
  }
  for (const [x0, d] of [[R.x0, 1], [R.x1, -1]]) for (let i = 0; i < 5; i++) for (const s of [-1, 1]) {   // 防爆區的黃色 V 字
    const xa = x0 - d * (8 + i * 10); k.box(xa, .105, R.z + s * 10, 1, .02, 24, yel, 2, 0, s * d * .55);
  }
  // 滑行道：黃色中線、連絡道中線；機坪：停機位的導入線與停止線、機坪邊線
  M(W.x0, W.x1, W.z - .2, W.z + .2, yel, .1);
  for (const [x, z0, z1] of L.links) M(x - .2, x + .2, z0, z1, yel, .095);
  for (const [x0, x1] of [[A.x0, A.x1]]) { M(x0, x1, A.z1 - 1.4, A.z1 - 1, yel, .08); M(x0, x1, 299.8, 300.2, yel, .08); }
  for (const g of L.gates) { M(g.x + 4.3, g.x + 4.7, 226, 300, yel, .08); M(g.x + .5, g.x + 8.5, 225, 225.6, white, .081); }
  for (const s of L.stands) { M(s.x - .2, s.x + .2, s.z - 25, s.z + 25, yel, .08); }
  M(L.stand.x - 25, L.stand.x + 25, L.stand.z - .2, L.stand.z + .2, yel, .081);
  for (let x = L.park.x0 + 4; x < L.park.x1; x += 3) for (const z of [L.park.z0 + 6, L.park.z0 + 34, L.park.z0 + 56, L.park.z1 - 6]) M(x, x + .14, z - 5, z + 5, white, .085);
  for (let x = L.land.x1 - 4; x > L.land.x0 + 4; x -= 9) M(x - 3, x, (L.land.z0 + L.land.z1) / 2 - .12, (L.land.z0 + L.land.z1) / 2 + .12, white, .08);
  // 燈：跑道邊燈（白）、跑道頭（綠／紅）、滑行道邊燈（藍）、西端外海的進場燈（燈柱立在海裡）、PAPI
  const lamp = (x, z, col, y = .35, s = .9) => k.box(x, y, z, s, .5, s, col, 11);
  for (let x = R.x0; x <= R.x1; x += 60) for (const s of [-1, 1]) lamp(x, R.z + s * (R.hw + 1.5), 0xfff0d2);
  for (const [x, c0, c1] of [[R.x0 - 1, 0x4dff7a, 0xff3b30], [R.x1 + 1, 0x4dff7a, 0xff3b30]]) for (let z = R.z - R.hw; z <= R.z + R.hw; z += 4.5) { lamp(x - 1.2, z, c0); lamp(x + 1.2, z, c1); }
  for (let x = W.x0; x <= W.x1; x += 50) for (const s of [-1, 1]) lamp(x, W.z + s * (W.hw + 1), 0x3a6bff, .3, .7);
  for (let i = 1; i <= 18; i++) {
    const x = R.x0 - 60 - i * 30, top = 1.2 + i * .25;
    k.box(x, (top - 9) / 2, R.z, .5, top + 9, .5, 0x3a3a3a, 15);
    k.box(x, top, R.z, .4, .2, i === 10 ? 30 : 4.5, 0x3a3a3a, 15);
    for (let z = -(i === 10 ? 14 : 2); z <= (i === 10 ? 14 : 2); z += i === 10 ? 3.5 : 1) lamp(x, R.z + z, 0xfff6e4, top + .3, .8);
  }
  for (let i = 0; i < 4; i++) { const z = R.z - R.hw - 14 - i * 9; k.box(R.x0 + 420, .9, z, 1.2, 1, 2.4, 0x2a2a2a, 2); k.box(R.x0 + 420.7, 1.05, z, .3, .5, 2, i < 2 ? 0xffffff : 0xff3b30, 11); }
  // 擋牆：島邊 0.9 m 的混凝土矮牆（堤道接口、梯子前留開口）
  const pc = 0xa7a49a, wall = (x0, x1, z0, z1, swim) => { B(x0, x1, z0, z1, 0, .9, pc); colliders.push({ x0, x1, z0, z1, low: 1, zn: AIR_F, ...(swim ? { swim: 1 } : {}) }); };
  wall(I.x0, I.x1, I.z0, I.z0 + .5); wall(I.x0, I.x1, I.z1 - .5, I.z1); wall(I.x0, I.x0 + .5, I.z0, I.z1);
  const lz = L.ladder.z;
  wall(I.x1 - .5, I.x1, I.z0, L.cause.z0); wall(I.x1 - .5, I.x1, L.cause.z1, lz - 1.1); wall(I.x1 - .5, I.x1, lz + 1.1, I.z1);
  colliders.push({ x0: I.x1 - .5, x1: I.x1, z0: lz - 1.1, z1: lz + 1.1, low: 1, swim: 1, zn: AIR_F });   // 梯子前的缺口：游泳的人可以過
  { const [X, Z] = airW(I.x1, lz), [nx, nz] = dirW(AIR_ZN, 1, 0); LADDERS.push({ x: X, z: Z, nx, nz, w: 1, ok: 1 }); }
  // 機坪的高桿燈（南緣，夜裡照亮停機位）
  // 燈在 26 m 高：照度隨距離平方衰減（00-core.js 的 pointLights），強度要比 4 m 高的路燈大幾十倍，地上的光圈才有 40 m 左右
  for (let x = A.x0 + 40; x < A.x1; x += 100) {
    k.box(x, 14, A.z1 + 4, .8, 28, .8, 0x55585c, 15); k.box(x, 28.2, A.z1 + 4, 6, .6, 1.4, 0x2a2c30, 15); k.box(x, 27.8, A.z1 + 3.6, 5.6, .2, .9, 0xfff1d6, 11);
    const [X, Z] = airW(x, A.z1 - 2); signLights.push({ x: X, y: 26, z: Z, col: lin(0xffe2b8), r: 90, i: 45, w: 1 }); const [cx, cz] = airW(x, A.z1 + 4); circles.push({ x: cx, z: cz, r: .6, w: 1 });
  }
  for (let x = L.gates[0].x - 40; x <= L.gates[2].x + 40; x += 58) {   // 航廈南面（登機門那一側）屋簷下的泛光燈：照空橋與停在門口的客機
    const [X, Z] = airW(x, L.gates[0].z + 6); signLights.push({ x: X, y: 17, z: Z, col: lin(0xfff0dc), r: 70, i: 22, w: 1 });
  }
  { const [X, Z] = airW(L.plaza.x0 + 40, (L.plaza.z0 + L.plaza.z1) / 2); signLights.push({ x: X, y: 9, z: Z, col: lin(0xffd6a0), r: 55, i: 6, w: 1 }); }
  const pole = (x, z, h = 10) => {   // 航廈前路與停車場的路燈
    k.box(x, h / 2, z, .3, h, .3, 0x4d5055, 15); k.box(x, h - .1, z, .9, .14, .9, 0xffe8c4, 11);
    const [X, Z] = airW(x, z); signLights.push({ x: X, y: h - .4, z: Z, col: lin(0xffdcae), r: 34, i: 5, w: 1 }); circles.push({ x: X, z: Z, r: .3, w: 1 });
  };
  for (let x = L.land.x0 + 30; x < L.land.x1 - 10; x += 70) pole(x, L.land.z1 + 1.5);
  for (let x = L.park.x0 + 50; x < L.park.x1; x += 100) for (const z of [L.park.z0 + 20, L.park.z1 - 20]) pole(x, z, 12);   // 停車格之間的走道上
  // 堤道：路面（雙向四線）、標線、兩側的紐澤西護欄與往海裡斜下去的消波石、路燈。外緣裡面那一段只鋪路面
  const RD = AIR.road, hw = AIR.hw;
  for (let i = 1; i < RD.length; i++) {
    const [ax, az] = RD[i - 1], [bx, bz] = RD[i], len = Math.hypot(bx - ax, bz - az), ry = -Math.atan2(bz - az, bx - ax), cx = (ax + bx) / 2, cz = (az + bz) / 2;
    const [WX, WZ] = airW(cx, cz), out = !inCity(WX, WZ) && !(cx <= I.x1);
    if (cx <= I.x1 - 2) continue;
    const seg = (y, w, h, off, col, mat = 2) => k.box(cx + Math.sin(ry) * off, y, cz + Math.cos(ry) * off, len + .4, h, w, col, mat, 0, ry);
    seg(-.12, hw * 2, .36, 0, asph);
    if ((i & 1) === 0) seg(.071, .25, .02, 0, white);                                       // 中線虛線（8 m 一段，隔一段畫一段）
    for (const s of [-1, 1]) { seg(.07, .2, .02, s * (hw - 1.6), white); seg(.071, .12, .02, s * .35, yel); }
    if (!out) continue;
    for (const s of [-1, 1]) {
      seg(.45, .6, .8, s * (hw - .3), 0xb4b1a8);
      k.box(cx + Math.sin(ry) * s * (hw + 4.5), -2.6, cz + Math.cos(ry) * s * (hw + 4.5), len + .6, 1.4, 10, rk, 2, s * .5, ry);
      const [ex, ez] = airW(bx, bz), [sx, sz] = airW(ax, az);
      const f = frameW(sx, sz, ex - sx, ez - sz);
      colliders.push(s < 0 ? { x0: -.2, x1: len + .2, z0: -hw - .3, z1: -hw + .5, low: 1, zn: f } : { x0: -.2, x1: len + .2, z0: hw - .5, z1: hw + .3, low: 1, zn: f });
    }
    k.box(cx, -5, cz, len + .4, 9.6, hw * 2 + 2, rk, 2, 0, ry);                                // 路堤
    if (i % 6 === 3) {
      const s = i % 12 === 3 ? 1 : -1, px = cx + Math.sin(ry) * s * (hw + .2), pz = cz + Math.cos(ry) * s * (hw + .2);
      k.box(px, 5, pz, .3, 10, .3, 0x4d5055, 15); k.box(px - Math.sin(ry) * s * 1.4, 9.9, pz - Math.cos(ry) * s * 1.4, .35, .2, 2.8, 0x4d5055, 15, 0, ry + Math.PI / 2);
      k.box(px - Math.sin(ry) * s * 2.6, 9.75, pz - Math.cos(ry) * s * 2.6, .6, .12, .9, 0xffe8c4, 11, 0, ry);
      const [X, Z] = airW(px - Math.sin(ry) * s * 2.6, pz - Math.cos(ry) * s * 2.6); signLights.push({ x: X, y: 9.4, z: Z, col: lin(0xffdcae), r: 30, i: 5, w: 1 });
    }
  }
  cityAdd(new T.Mesh(k.build(), MAT.far), AIR_ZN);
}

// ─── 建築與客機：模型（http(s)）或程式建模的替身 ───
// 替身：客機是機身圓筒＋後掠翼＋尾翼＋兩具發動機；航廈是一道弧形屋頂的長廳；塔台是一根柱子頂一個六角的塔頂；機庫是半圓筒
function airPlaneKit(len = 38) {
  const k = new Kit(), wht = 0xeceeef, gry = 0x9aa0a6, s = len / 38;
  k.cyl(0, 3.3 * s, 0, 1.95 * s, 1.95 * s, len * .78, 16, wht, 10, Math.PI / 2);
  k.cyl(0, 3.3 * s, len * .43, .5 * s, 1.95 * s, len * .08, 16, wht, 10, Math.PI / 2);   // 機頭（圓筒的頂端轉到 +z）
  k.cyl(0, 3.6 * s, -len * .45, .4 * s, 1.95 * s, len * .12, 16, wht, 10, -Math.PI / 2);
  for (const sd of [-1, 1]) {
    k.box(sd * 9 * s, 2.4 * s, -1 * s, 16 * s, .35 * s, 4.2 * s, wht, 10, 0, sd * .42);
    k.cyl(sd * 5.7 * s, 1.5 * s, 2.5 * s, 1.05 * s, 1.05 * s, 4 * s, 12, gry, 15, Math.PI / 2);
    k.box(sd * 3.4 * s, 4.6 * s, -16.5 * s, 6 * s, .25 * s, 2.4 * s, wht, 10, 0, sd * .5);
  }
  k.box(0, 7.6 * s, -16.8 * s, .35 * s, 6.5 * s, 4 * s, wht, 10, -.35);
  k.box(0, 3.8 * s, len * .4, 3 * s, .5 * s, 1.2 * s, 0x15181c, 1);                             // 駕駛艙窗
  return k;
}
// 航行燈：左翼尖紅、右翼尖綠（機頭朝 +z 時右邊是 −x）、尾燈白、機背的紅色閃光燈
function airLightsKit(span) {
  const k = new Kit(), h = span / 2;
  k.box(h - .3, 3.2, -6, .4, .3, .5, 0xff2a2a, 11).box(-h + .3, 3.2, -6, .4, .3, .5, 0x2aff6a, 11).box(0, 5.4, -19.5, .3, .3, .3, 0xffffff, 11);
  k.box(0, 5.55, -2, .5, .3, .5, 0xff2020, 9).box(0, .6, 3, .5, .25, .5, 0xff2020, 9);
  return k;
}
const AIR_M = { items: null, req: false, proxies: [], jet: [] };
if (AIR_L) {
  const L = AIR_L, add = (o, x, z) => { o.position.set(x, o.position.y, z); cityAdd(o, AIR_ZN); AIR_M.proxies.push(o); return o; };
  const fw = (x, y, z) => { const g = new T.Group(); g.position.set(x, y, z); return g; };
  // 航廈（長軸沿 x，東端是入口）
  { const k = new Kit(), T0 = L.term;
    k.box(0, 8, 0, 160, 16, 100, 0x8f969c, 10).box(0, 7, 50.2, 150, 12, .4, 0x1a2a33, 1).box(80.2, 7, 0, .4, 12, 80, 0x1a2a33, 1);
    k.cyl(0, -32, 0, 56, 56, 170, 28, 0x5c6a6f, 15, 0, 0, Math.PI / 2);   // 弧形屋頂：圓筒只露出上面一段
    add(new T.Mesh(k.build(), MAT.far), T0.x, T0.z); }
  { const k = new Kit(); k.cyl(0, 22, 0, 4.5, 6, 44, 12, 0xc9ccce, 10).cyl(0, 47, 0, 9, 7, 6, 6, 0x1a2a33, 1).cyl(0, 50.5, 0, 9.5, 9.5, 1, 6, 0x7d8388, 15);
    add(new T.Mesh(k.build(), MAT.far), L.tower.x, L.tower.z); }
  { const k = new Kit(); k.cyl(0, 0, 0, 30, 30, 112, 20, 0x8a9096, 15, 0, 0, Math.PI / 2); k.box(0, 9, 37, 30, 18, .5, 0x0c1012, 2);
    const m = new T.Mesh(k.build(), MAT.far); m.scale.z = 1.25; add(m, L.hangar.x, L.hangar.z); }
  for (const g of L.gates) { const k = new Kit(); k.box(0, 4.6, 13, 3, 2.8, 26, 0xb9bcc0, 10).box(0, 1.6, 22, .6, 3.2, .6, 0x55585c, 15); add(new T.Mesh(k.build(), MAT.far), g.x, g.z); }
  const pk = airPlaneKit().build();
  for (const p of [...L.gates.map(g => ({ x: g.x + 4.5, z: 238.8, ry: Math.PI, plane: g.plane })), ...L.stands]) { const m = new T.Mesh(pk, MAT.far); m.rotation.y = p.ry; add(m, p.x, p.z); }
  // 碰撞：航廈、塔台、機庫三面牆（門在南面中間）、停著的客機機身、空廚車
  const box = (x0, x1, z0, z1) => colliders.push({ x0, x1, z0, z1, zn: AIR_F });
  box(L.term.x - 80, L.term.x + 80, L.term.z - 49, L.term.z + 49);
  box(L.tower.x - 7, L.tower.x + 7, L.tower.z - 7, L.tower.z + 7);
  { const { x, z } = L.hangar; box(x - 57, x + 57, z - 38, z - 35.5); box(x - 57, x - 54.5, z - 38, z + 38); box(x + 54.5, x + 57, z - 38, z + 38); box(x - 54.5, x - 4.6, z + 35.5, z + 38); box(x + 14.9, x + 54.5, z + 35.5, z + 38); }
  for (const g of L.gates) box(g.x + 2.5, g.x + 6.5, 220, 257.6);
  for (const s of L.stands) box(s.x - 2, s.x + 2, s.z - 18.8, s.z + 18.8);
}
// 模型下載好：換掉替身、擺上空橋、空廚車與停著的客機（每架共用同一份幾何）
function airModels(items) {
  const L = AIR_L, put = (id, x, z, ry, y = 0) => { const o = propObject(items[id], x, y, z, ry); cityAdd(o, AIR_ZN); return o; };
  put('term', L.term.x, L.term.z, L.term.ry);
  put('tower', L.tower.x, L.tower.z, 0);
  put('hangar', L.hangar.x, L.hangar.z, 0);
  for (const g of L.gates) {
    put('jetway', g.x, g.z + 13, -Math.PI / 2);                     // 長軸轉成南北，機艙那端朝南接到客機的左前門
    put(g.plane, g.x + 4.5, 238.8, Math.PI);   // 機身左側貼著空橋機艙，左前門對著機艙（機頭在 z 220）
    put('cater', g.x + 11, 250, 0);
  }
  for (const s of L.stands) put(s.plane, s.x, s.z, s.ry);
  for (const o of AIR_M.proxies) o.removeFromParent();
  AIR_M.proxies.length = 0;
  for (const p of AIR_P.planes) if (items[p.id]) { p.body.clear(); p.body.add(propObject(items[p.id], 0, 0, 0, 0)); }
}

// ─── 起降循環：一架客機（A320 與 737 輪流）停在遠端機位 → 滑行 → 往西起飛 → 消失在外海 → 從西邊進場降落 → 滑回遠端機位 ───
// 路徑是 SEA_FR 座標的折線，轉角用半徑 r 的圓角（二次貝茲近似）切細，照弧長走
function airPath(pts, r = 24) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], [cx, cz] = pts[i + 1], l1 = Math.hypot(bx - ax, bz - az), l2 = Math.hypot(cx - bx, cz - bz);
    const t = Math.min(r, l1 / 2, l2 / 2), p1 = [bx - (bx - ax) / l1 * t, bz - (bz - az) / l1 * t], p2 = [bx + (cx - bx) / l2 * t, bz + (cz - bz) / l2 * t];
    for (let j = 0; j <= 8; j++) { const u = j / 8, a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u; out.push([a * p1[0] + b * bx + c * p2[0], a * p1[1] + b * bz + c * p2[1]]); }
  }
  out.push(pts[pts.length - 1]);
  const s = [0]; for (let i = 1; i < out.length; i++) s.push(s[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
  return { p: out, s, len: s[s.length - 1] };
}
function airAt(P, d) {   // 路徑上弧長 d 的點與方向（yaw：0 朝 +z）
  d = clamp(d, 0, P.len); let i = 1; while (i < P.s.length - 1 && P.s[i] < d) i++;
  const [ax, az] = P.p[i - 1], [bx, bz] = P.p[i], u = (d - P.s[i - 1]) / Math.max(1e-6, P.s[i] - P.s[i - 1]);
  return [ax + (bx - ax) * u, az + (bz - az) * u, Math.atan2(bx - ax, bz - az)];
}
const AIR_P = { planes: [], cur: 0, st: 'park', t: 12, d: 0, v: 0, x: 0, y: 0, z: 0, yaw: Math.PI / 2, pitch: 0, roll: 0, n: 0, dyn: [] };
if (AIR_L) {
  const L = AIR_L, S = L.stand, R = L.rwy, W = L.twy;
  AIR_P.out = airPath([[S.x, S.z], [-1300, S.z], [-1300, W.z], [R.x1 - 50, W.z], [R.x1 - 50, R.z], [R.x1 - 95, R.z]], 22);
  AIR_P.inn = airPath([[-2010, R.z], [-1950, R.z], [-1950, W.z], [-1600, W.z], [-1600, S.z], [S.x, S.z]], 24);
  for (const [id, len, span] of [['a320', 37.6, 35.5], ['b737', 39.5, 36]]) {
    const g = new T.Group(), body = new T.Group(); g.add(body); g.visible = false; scene.add(g);
    body.add(new T.Mesh(airPlaneKit(len).build(), MAT.far));
    g.add(new T.Mesh(airLightsKit(span).build(), MAT.far));
    AIR_P.planes.push({ id, g, body, len });
  }
  [AIR_P.x, AIR_P.z] = [S.x, S.z];
  for (let i = 0; i < 4; i++) AIR_P.dyn.push({ x: 1e6, z: 1e6, r: i < 3 ? 2.6 : 1.6 });   // 30-vehicles.js 的 dynMore 還沒宣告：第一次 airUpdate 才放進去
}
const AIR_GLIDE = Math.tan(3 * Math.PI / 180), AIR_FINAL = 4200;
function airUpdate(dt) {
  if (!AIR_L) return;
  const P = AIR_P, L = AIR_L, R = L.rwy;
  if (!P.hooked) { P.hooked = true; dynMore.push(...P.dyn); }
  // 走近才下載模型
  if (!AIR_M.req && GLB_ON) {
    const [cx, cz] = airW((L.I.x0 + L.I.x1) / 2, (L.I.z0 + L.I.z1) / 2);
    if (Math.hypot(pX() - cx, pZ() - cz) < AIR_NEAR) { AIR_M.req = true; loadProps('air').then(items => { if (items) { AIR_M.items = items; airModels(items); } }); }
  }
  P.t -= dt;
  const pl = P.planes[P.cur];
  if (P.st === 'park') { [P.x, P.z, P.yaw, P.y, P.pitch] = [L.stand.x, L.stand.z, Math.PI / 2, 0, 0]; if (P.t <= 0) { P.st = 'out'; P.d = 0; P.v = 0; } }
  else if (P.st === 'out' || P.st === 'in') {   // 滑行：起步加速、轉彎與快到終點時放慢
    const path = P.st === 'out' ? P.out : P.inn, left = path.len - P.d;
    P.v = damp(P.v, Math.min(9, Math.max(2, left * .25)), 1.2, dt); P.d += P.v * dt;
    const [x, z, yaw] = airAt(path, P.d), [, , yaw2] = airAt(path, P.d + 6);
    [P.x, P.z] = [x, z]; P.yaw = yaw; P.roll = 0; P.pitch = 0; P.y = 0;
    P.yawRate = ((yaw2 - yaw + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
    if (left < .3) { if (P.st === 'out') { P.st = 'line'; P.t = 6; } else { P.st = 'park'; P.t = 30; } }
  } else if (P.st === 'line') { if (P.t <= 0) { P.st = 'roll'; P.v = 0; } }
  else if (P.st === 'roll') {   // 往西加速，70 m/s 抬頭，爬升角慢慢加到 8°
    P.v = Math.min(88, P.v + (P.v < 75 ? 2.3 : 1.2) * dt); P.x -= P.v * dt; P.yaw = -Math.PI / 2;
    if (P.v > 70) { P.pitch = damp(P.pitch, .16, 1.5, dt); P.y += P.v * Math.sin(Math.min(P.pitch * .85, .14)) * dt; }
    if (P.x < R.x0 - 5600 || P.y > 650) { P.st = 'gone'; P.t = 15; }
  } else if (P.st === 'gone') {
    if (P.t <= 0) { pl.g.visible = false; P.cur = (P.cur + 1) % P.planes.length; P.st = 'final'; P.x = L.td - AIR_FINAL; P.z = R.z; P.y = AIR_FINAL * AIR_GLIDE; P.v = 72; P.yaw = Math.PI / 2; P.pitch = .05; }
  } else if (P.st === 'final') {   // 3° 下滑道，著陸前拉平
    P.x += P.v * dt; P.y = Math.max(0, (L.td - P.x) * AIR_GLIDE); P.pitch = damp(P.pitch, P.y < 12 ? .09 : .05, 2, dt);
    if (P.x >= L.td) { P.st = 'rollout'; P.y = 0; P.v0 = P.v; }
  } else if (P.st === 'rollout') {   // 減速到 12 m/s 正好到東邊的出口
    const dec = (P.v0 * P.v0 - 144) / (2 * (-2010 - L.td));
    P.v = Math.max(12, P.v - dec * dt); P.x += P.v * dt; P.pitch = damp(P.pitch, 0, 1.5, dt);
    if (P.x >= -2010) { P.st = 'in'; P.d = 0; P.v = 12; }
  }
  if (P.st === 'roll' || P.st === 'final') P.roll = 0;
  // 擺到世界：機體跟著 yaw、pitch（機頭抬起是繞 x 負轉）
  const cur = P.planes[P.cur], vis = P.st !== 'gone';
  for (const p of P.planes) p.g.visible = p === cur && vis;
  const [X, Z] = airW(P.x, P.z), yaw = P.yaw + AIR_YAW;
  cur.g.position.set(X, P.y, Z); cur.g.rotation.set(-P.pitch, yaw, 0, 'YXZ');
  // 地面上的時候擋人和車：機身三個圓、機頭一個小圓
  const ground = P.y < 2 && cur.g.visible, fx = Math.sin(yaw), fz = Math.cos(yaw);
  P.dyn.forEach((c, i) => { const o = [-11, 0, 11, 17][i]; c.x = ground ? X + fx * o : 1e6; c.z = ground ? Z + fz * o : 1e6; });
}
const airApi = {
  get L() { return AIR_L; }, get P() { return AIR_P; }, get M() { return AIR_M; }, AIR, land: (x, z) => airLandL(x, z), landW: (X, Z) => airLandW(X, Z),
  W: (x, z) => airW(x, z), L2: (X, Z) => toL(X, Z, AIR_ZN), district: (X, Z) => districtW(X, Z),
  tp: (x, z, yaw = 0) => { const [X, Z] = airW(x, z); window.__nc.tp(X, Z, yaw + AIR_YAW); },
  set: (st, t = 0) => { AIR_P.st = st; AIR_P.t = t; if (st === 'final') { AIR_P.x = AIR_L.td - AIR_FINAL; AIR_P.z = AIR_L.rwy.z; AIR_P.y = AIR_FINAL * AIR_GLIDE; AIR_P.v = 72; AIR_P.yaw = Math.PI / 2; } if (st === 'out' || st === 'in') { AIR_P.d = 0; AIR_P.v = 0; } },
};
