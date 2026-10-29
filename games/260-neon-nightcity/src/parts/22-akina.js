// ═══ 榛嶺的榛名湖（09-akina.js）：DEM 裡湖面那一片（1085 m 平的，A.lk）每 15 m 一格、照比例換到世界座標的一張水面，
// 和海面同一個水的著色器（21-coast.js 的 MAT_WATER，同名、同一份 GLSL／TSL），只是自己的 uReflOn 一直是 0：平面反射的鏡面在海面高度，
// 湖在 270 m 上，照環境貼圖反射。離岸距離場在湖這裡都當外海，沒有岸邊的白沫。湖岸的地面比水面高，格子多鋪一圈蓋在下面 ═══
if (AKINA && AKINA.fine) {
  const A = AKINA, D = AK_DEM, f = NPARK.f, wet = (i, j) => A.lk[j * D.nx + i] > 0, pos = [], idx = [], vid = new Map();
  const v = (i, j) => { const k = i + ',' + j; let n = vid.get(k); if (n === undefined) { n = pos.length / 3; vid.set(k, n); const [X, Z] = toW(...A.toL(D.x0 + i * D.cell, D.z0 + j * D.cell), f); pos.push(X, A.WL, Z); } return n; };
  for (let j = 1; j < D.nz - 2; j++) for (let i = 1; i < D.nx - 2; i++) {
    let near = false;
    for (let b = -1; b <= 2 && !near; b++) for (let a = -1; a <= 2; a++) if (wet(i + a, j + b)) { near = true; break; }
    if (!near || A.wt[j * D.nx + i] < 250) continue;   // 權重不到 1 的地方接回原本的地形，那裡不放水
    const a = v(i, j), b = v(i + 1, j), c = v(i, j + 1), d = v(i + 1, j + 1);
    idx.push(a, c, b, b, c, d);
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  const mat = MAT_WATER.clone(); mat.name = MAT_WATER.name;
  mat.uniforms = { ...MAT_WATER.uniforms, uReflOn: { value: 0 } };
  const lake = new T.Mesh(g, mat); lake.name = 'akinaLake'; lake.renderOrder = 1; groundAdd(lake, null);
  A.lake = { tris: idx.length / 3, y: A.WL };
}
// ─── 牌面的字（使用者：站牌沒有站名、標誌只有七段數字）：榛嶺與別墅區的標誌、站牌、時刻表、解說牌全部畫進一張 canvas 圖集（系統字型；日文靠 Hiragino／Yu Gothic／Noto），
// 貼在牌面前的四邊形上，檔案最後併成一個網格。和 21-coast.js 的路牌一樣是不受光的 MeshBasicMaterial，亮度每幀照 uDay 調（山路沒有路燈，夜裡不能像燈箱一樣亮）───
const AKT = { L: new Map(), Q: [], JF: '"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic","Noto Sans JP","Noto Sans CJK JP","PingFang TC",system-ui,sans-serif' };   // L：圖集的格子（同樣的字共用一格）；Q：[格子, 四個角的世界座標（左下、右下、右上、左上）]
AKT.NF = '"DIN Condensed","Avenir Next Condensed","Arial Narrow",' + AKT.JF;
const akFace = (x, y, z, ry, u, v, d) => [x + Math.cos(ry) * u + Math.sin(ry) * d, y + v, z - Math.sin(ry) * u + Math.cos(ry) * d];   // u：看牌面的人的右手邊，d：往牌面前
const akFlat = (seg, r) => { const g = new T.CylinderGeometry(r, r, .03, seg); g.rotateX(Math.PI / 2); return g; };   // 牌：厚 3 cm 的圓／六角／三角板，面朝 +z
const akLbl = (key, pw, ph, draw) => { if (!AKT.L.has(key)) AKT.L.set(key, { pw, ph, draw }); return AKT.L.get(key); };
const akLq = (c, x, y, z, ry, w, h, d, back) => { const s = back ? -1 : 1; AKT.Q.push([c, [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([u, v]) => akFace(x, y, z, ry, u * s, v, d))]); };
const akFit = (c, str, x, y, maxW, px, wt, font, col) => { let f = px; c.font = `${wt} ${f}px ${font}`; while (f > 8 && c.measureText(str).width > maxW) { f -= 2; c.font = `${wt} ${f}px ${font}`; } c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(str, x, y); };
const akMaxSign = (rk, px, py, pz, ry, val) => {   // 速限（紅圈白底藍字，只有數字）：桿底 (px, py, pz)，牌面朝 ry
  const hy = py + 2.25;
  rk.cyl(px, py + 1.15, pz, .03, .03, 2.3, 6, 0x9a9da0, TX.galv);
  rk.add(akFlat(28, .3), 0x9a9da0, TX.galv, tf(...akFace(px, hy, pz, ry, 0, 0, -.03), 0, ry, 0)).add(akFlat(28, .3), 0xc4221c, 2, tf(...akFace(px, hy, pz, ry, 0, 0, .0), 0, ry, 0)).add(akFlat(28, .24), 0xf2f2ee, 2, tf(...akFace(px, hy, pz, ry, 0, 0, .012), 0, ry, 0));
  const str = String(val); akLq(akLbl('max' + str, 256, 192, (c, w, h) => akFit(c, str, w / 2, h * .54, w * .9, 176, 700, AKT.NF, '#1d4a9a')), px, hy, pz, ry, .34, .255, .032);
  return hy;
};
// ═══ 榛嶺山道的擋土牆與電線桿（使用者給的參考圖：上坡那側挖出來的地方是深灰的石砌牆＋水泥壓頂，路邊一路有水泥電線桿）═══
// 牆：路緣外（ROAD_HW + 1.15 m，髮夾彎外側讓開導向牌，+2.15 m）沿路每一點量原本的山坡比路面高多少，前後 ±3 點平均，1.3 m 以上就砌牆（最高 4.2 m，再上面是 10-city.js 照 1.4:1 挖的山坡）；
// 牆面往後倒 12%，壓頂後面鋪一片回填的草坡接到挖過的山坡上（10-city.js 的挖方在榛嶺從路緣外 4 m（RC_AK）才起坡，牆後面原本是一道溝）。彎的內側半徑不到牆的距離 + 4 m 不砌（法線會交叉）。
// 碰撞是每段一個沿路的薄盒（同護欄的做法），ly／hy 只擋這一層。電線桿：每 22 點（約 40 m）一根 9 m 的水泥桿＋橫擔，立在沒有牆的那一側，相鄰兩根之間拉兩條電線
if (AKINA && AKINA.road) {
  const R = AKINA.road, n = R.length, HW = HILL.roadHW, rk = new Kit(), G = { stone: [], cap: [], fill: [] };
  const hd = []; for (let i = 0; i + 1 < n; i++) hd.push(Math.atan2(R[i + 1][1] - R[i][1], R[i + 1][0] - R[i][0])); hd.push(hd[n - 2]);
  const turn = i => { let t = 0; for (let j = Math.max(0, i - 3); j < Math.min(n - 2, i + 3); j++) t += akAng(hd[j + 1], hd[j]); return t; };
  const nrm = i => { const a = R[Math.max(0, i - 1)], b = R[Math.min(n - 1, i + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [-(b[1] - a[1]) / L, (b[0] - a[0]) / L]; };
  const quad = (L, a, b, c, d, want) => {   // 四個點（[x, y, z]）兩個三角形，繞序照 want（希望法線朝的方向）
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const flip = (uy * vz - uz * vy) * want[0] + (uz * vx - ux * vz) * want[1] + (ux * vy - uy * vx) * want[2] < 0;
    L.push(...(flip ? [a, c, b, a, d, c] : [a, b, c, a, c, d]).flat());
  };
  const walls = {}, stat = { pts: 0, len: 0, hMax: 0 }, runs = [];
  for (const sd of [-1, 1]) {
    const H = new Float32Array(n), Hs = new Float32Array(n), off = new Float32Array(n);
    for (let i = 8; i < n - 2; i++) {
      const [x, z, y] = R[i], [nx0, nz0] = nrm(i), nx = nx0 * sd, nz = nz0 * sd, pin = akinaPin(R, i), out = pin && Math.sign(pin) === -sd;
      const o = HW + (out ? 2.15 : 1.15), t = turn(i), r = 6 * Math.hypot(R[i + 1][0] - x, R[i + 1][1] - z) / (Math.abs(t) || 1e-6);
      off[i] = o;
      if (Math.sign(t) === sd && r < o + 4 || R.gap[i] === sd) continue;   // 支路口那一側不砌
      const h = hillMeshRaw(x + nx * (o + 1.6), z + nz * (o + 1.6));
      if (Number.isFinite(h)) H[i] = Math.max(0, h - y - .3);
    }
    for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let k = -3; k <= 3; k++) if (i + k >= 0 && i + k < n) { s += H[i + k]; c++; } Hs[i] = H[i] && s / c >= 1.3 ? Math.min(4.2, s / c) : 0; }
    for (let i = 0; i < n;) {   // 連續 5 點以上才砌（短的一截不像牆）
      if (!Hs[i]) { i++; continue; }
      let j = i; while (j + 1 < n && Hs[j + 1]) j++;
      if (j - i < 4) Hs.fill(0, i, j + 1); else runs.push({ i: (i + j) >> 1, len: j - i, sd });
      i = j + 1;
    }
    walls[sd] = { Hs, off };
    const P = i => {   // 第 i 點的牆斷面：牆腳、牆頂、壓頂前後、回填的末端
      const [x, z, y] = R[i], [nx0, nz0] = nrm(i), nx = nx0 * sd, nz = nz0 * sd, h = Hs[i], o = off[i], ob = o + h * .12, at = (d, yy) => [x + nx * d, yy, z + nz * d];
      const ef = Math.max(ob + 1, HW + 4 + h / 1.4 + .8), ye = hillMeshH(x + nx * ef, z + nz * ef);
      return { n: [-nx, 0, -nz], o: [nx, 0, nz], f0: at(o, y - .8), f1: at(ob, y + h), c0: at(ob - .06, y + h), c1: at(ob - .06, y + h + .2), c2: at(ob + .45, y + h + .2), c3: at(ob + .45, y + h + .05),
        e: at(ef, (Number.isFinite(ye) ? ye : y + h) - .05), b0: at(ob + .45, y - .8) };
    };
    for (let i = 0; i + 1 < n; i++) {
      if (!Hs[i] || !Hs[i + 1]) continue;
      const a = P(i), b = P(i + 1), up = [0, 1, 0];
      quad(G.stone, a.f0, a.f1, b.f1, b.f0, a.n);
      quad(G.cap, a.c0, a.c1, b.c1, b.c0, a.n); quad(G.cap, a.c1, a.c2, b.c2, b.c1, up);
      quad(G.fill, a.c3, a.e, b.e, b.c3, up);
      for (const [e, q] of [[i === 0 || !Hs[i - 1], a], [i + 2 >= n || !Hs[i + 2], b]]) if (e) {   // 牆的兩端：側面封起來
        const t = q === a ? [R[i][0] - R[i + 1][0], 0, R[i][1] - R[i + 1][1]] : [R[i + 1][0] - R[i][0], 0, R[i + 1][1] - R[i][1]];
        quad(G.stone, q.f0, q.f1, q.c2, q.b0, t);
      }
      const ax = a.f1[0], az = a.f1[2], bx = b.f1[0], bz = b.f1[2], L = Math.hypot(bx - ax, bz - az), y0 = Math.min(R[i][2], R[i + 1][2]);
      if (L > .3) colliders.push({ x0: -.05, x1: L + .05, z0: -.25, z1: .25, zn: frameW(ax, az, bx - ax, bz - az), ly: y0 - 2, hy: y0 + Math.max(Hs[i], Hs[i + 1]) + .3 });
      stat.pts++; stat.len += Math.hypot(R[i + 1][0] - R[i][0], R[i + 1][1] - R[i][1]); stat.hMax = Math.max(stat.hMax, Hs[i]);
    }
  }
  // 下坡那側落差大的地方（髮夾彎上下疊時，上段的路緣外；10-city.js 的 carveH 讓下段的挖方斜面壓過上段的填方）：路緣外砌一道往外的石牆，
  // 牆頂比路面高 0.3 m（護欄在牆前面），牆面往外倒 8%、往下埋到地面以下 0.6 m（最深 14 m）。量法同上：路緣外 2.15 m 比路面低多少、±3 點平均、2 m 以上、連續 5 點
  const fstat = { len: 0, dMax: 0 };
  for (const sd of [-1, 1]) {
    const D = new Float32Array(n), Ds = new Float32Array(n), { Hs, off } = walls[sd];
    for (let i = 8; i < n - 2; i++) {
      const [x, z, y] = R[i], [nx0, nz0] = nrm(i), nx = nx0 * sd, nz = nz0 * sd, o = off[i] || HW + 1.15, t = turn(i), r = 6 * Math.hypot(R[i + 1][0] - x, R[i + 1][1] - z) / (Math.abs(t) || 1e-6);
      if (Hs[i] || R.br[i] || R.gap[i] === sd || Math.sign(t) === sd && r < o + 4) continue;
      const h = hillMeshH(x + nx * (o + 1), z + nz * (o + 1));
      if (Number.isFinite(h)) D[i] = Math.max(0, y - h);
    }
    for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let k = -3; k <= 3; k++) if (i + k >= 0 && i + k < n) { s += D[i + k]; c++; } Ds[i] = D[i] && s / c >= 2 ? Math.min(14, s / c) : 0; }
    for (let i = 0; i < n;) { if (!Ds[i]) { i++; continue; } let j = i; while (j + 1 < n && Ds[j + 1]) j++; if (j - i < 4) Ds.fill(0, i, j + 1); i = j + 1; }
    walls[sd].Ds = Ds;
    const P = i => {
      const [x, z, y] = R[i], [nx0, nz0] = nrm(i), nx = nx0 * sd, nz = nz0 * sd, d = Ds[i], o = off[i] || HW + 1.15, at = (dd, yy) => [x + nx * dd, yy, z + nz * dd];
      return { o: [nx, 0, nz], t0: at(o, y + .3), b0: at(o + (d + .6) * .08, y - d - .6), c0: at(o - .3, y + .3), c1: at(o - .3, y + .45), c2: at(o + .06, y + .45), c3: at(o + .06, y + .3) };
    };
    for (let i = 0; i + 1 < n; i++) {
      if (!Ds[i] || !Ds[i + 1]) continue;
      const a = P(i), b = P(i + 1);
      quad(G.stone, a.t0, a.b0, b.b0, b.t0, a.o);
      quad(G.cap, a.c1, a.c2, b.c2, b.c1, [0, 1, 0]); quad(G.cap, a.c2, a.c3, b.c3, b.c2, a.o);
      for (const [e, q, t] of [[!Ds[i - 1], a, [R[i][0] - R[i + 1][0], 0, R[i][1] - R[i + 1][1]]], [!Ds[i + 2], b, [R[i + 1][0] - R[i][0], 0, R[i + 1][1] - R[i][1]]]]) if (e) quad(G.stone, q.c0, q.t0, q.b0, [q.c0[0], q.b0[1], q.c0[2]], t);
      fstat.len += Math.hypot(R[i + 1][0] - R[i][0], R[i + 1][1] - R[i][1]); fstat.dMax = Math.max(fstat.dMax, Ds[i]);
    }
  }
  const geo = arr => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(arr, 3)); g.computeVertexNormals(); return g; };
  if (G.stone.length) rk.add(geo(G.stone), 0x55574f, TX.stone).add(geo(G.cap), 0xa9a69e, TX.conc).add(geo(G.fill), 0x4d5a30, TX.hill);
  // 電線桿：沒有牆、不是髮夾彎外側（那裡是護欄與導向牌）的那一側，路緣外 1.6 m；兩根之間的電線照直線拉（略垂 0.3 m 分兩段）
  let prev = null, poles = 0;
  for (let i = 12; i < n - 2; i += 22) {
    const [x, z, y] = R[i], [nx0, nz0] = nrm(i), pin = akinaPin(R, i);
    let sd = (i / 22 | 0) % 2 ? 1 : -1;
    const bad = s => R.br[i] || R.gap[i] === s || walls[s].Hs[i] > 0 || walls[s].Ds[i] > 0 || pin && Math.sign(pin) === -s;
    if (bad(sd)) sd = -sd; if (bad(sd)) { prev = null; continue; }
    const px = x + nx0 * sd * (HW + 1.6), pz = z + nz0 * sd * (HW + 1.6), py = hillMeshH(px, pz);
    if (!Number.isFinite(py) || Math.abs(py - y) > 2) { prev = null; continue; }
    const ry = Math.atan2(nx0, nz0);
    rk.cyl(px, py + 4.5, pz, .11, .17, 9, 8, 0x9c9b95, TX.conc).box(px, py + 8.3, pz, 1.6, .1, .1, 0x8e8e8a, TX.galv, 0, ry, 0);
    for (const s of [-.6, .6]) rk.cyl(px + Math.sin(ry) * s, py + 8.42, pz + Math.cos(ry) * s, .035, .035, .14, 5, 0xd8d6cc, TX.conc);
    if (prev && Math.hypot(px - prev[0], pz - prev[2]) < 70) for (const s of [-.6, .6]) {
      const a = [prev[0] + Math.sin(prev[3]) * s, prev[1] + 8.5, prev[2] + Math.cos(prev[3]) * s], b = [px + Math.sin(ry) * s, py + 8.5, pz + Math.cos(ry) * s], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - .3, (a[2] + b[2]) / 2];
      rk.bar(...a, ...m, .02, .02, 0x1c1c1c, TX.rubber).bar(...m, ...b, .02, .02, 0x1c1c1c, TX.rubber);
    }
    prev = [px, py, pz, ry]; poles++;
    colliders.push({ x0: -.2, x1: .2, z0: -.2, z1: .2, zn: frameW(px, pz, 1, 0), ly: py - 1, hy: py + 9 });
  }
  // ─── OSM 對應的物件（09-akina.js 的 R.seg／br／calm／jun，tools/akina-dem.mjs 從 Overpass 的 way 標籤烘出來）───
  // 橋（bridge=yes）：兩側水泥高欄＋兩端親柱、橋面外緣的側板；速限（maxspeed）：每段開頭與支路口後面兩個方向各一面（紅圈白底藍字）；
  // 県道（ref）：藍色六角形白字的路線標誌，每段開頭、支路口後面與每 1.1 km；支路（別的 highway 接在山道上）：26 m 的柏油支路，次要道路有停止線與倒三角的停車再開標誌；
  // メロディーライン（traffic_calming）：往湖那個方向的車道上一道道橫溝。標誌立在車行方向的右側（城裡的車流與 41-hill.js 都靠右）。標誌與站牌的字畫在 canvas 圖集上（見下面的 lbl）
  const tng = k => { const a = R[Math.max(0, k - 1)], b = R[Math.min(n - 1, k + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
  const flat = akFlat;
  const face = akFace, lbl = akLbl, lq = akLq, fit = akFit, { JF, NF } = AKT;
  const text = (str, x, y, z, ry, d) => lq(lbl('ref' + str, 256, 256, (c, w, h) => { fit(c, '群馬県', w / 2, h * .2, w * .62, 40, 700, JF, '#f2f2ee'); fit(c, str, w / 2, h * .62, w * .8, 128, 700, NF, '#f2f2ee'); }), x, y, z, ry, .46, .46, d);   // 県道：上面一行小字「群馬県」（速限只有數字，日本的規制標識沒有 km/h：akMaxSign）
  const signAt = (k, dir, kind, val) => {   // dir：+1 往湖、−1 往低端；牌面朝迎面來的車
    const busy = q => q < 1 || q >= n - 1 || akinaPin(R, q) || R.br[q] || R.gap[q] === dir || walls[dir].Hs[q] > 0 || walls[dir].Ds[q] > 0;   // 髮夾彎、橋、支路口、擋土牆前面都不立
    for (let j = 0; j < 40 && busy(k); j++) k += dir;
    if (busy(k)) return 0;
    if (k < 1 || k >= n - 1) return 0;
    const [tx, tz] = tng(k), sx = -tz * dir, sz = tx * dir, [x, z, y0] = R[k], px = x + sx * (HW + 1.5), pz = z + sz * (HW + 1.5), py = hillMeshH(px, pz);
    if (!Number.isFinite(py) || Math.abs(py - y0) > 1.5) return 0;
    const ry = Math.atan2(-tx * dir, -tz * dir), hy = py + 2.25;
    if (kind === 'max') akMaxSign(rk, px, py, pz, ry, val);
    else {
      rk.cyl(px, py + 1.15, pz, .03, .03, 2.3, 6, 0x9a9da0, TX.galv);
      const g6 = (r, dd, c) => { const g = flat(6, r); g.rotateZ(Math.PI / 6); g.scale(1.15, .9, 1); rk.add(g, c, 2, tf(...face(px, hy, pz, ry, 0, 0, dd), 0, ry, 0)); };
      g6(.36, -.035, 0x9a9da0); g6(.36, -.02, 0xf2f2ee); g6(.32, .0, 0x1f58a8);
      text(String(val), px, hy - .02, pz, ry, .022);
    }
    SIGNS.push([kind, +px.toFixed(1), +hy.toFixed(1), +pz.toFixed(1), +ry.toFixed(2)]);
    return 1;
  };
  const SIGNS = [];   // 驗收與截圖用：[種類, x, 牌面中心 y, z, 牌面朝向]
  const osm = { bridge: 0, max: 0, route: 0, spur: 0, stop: 0, calm: 0 };
  // 橋
  for (const sg of R.seg) if (sg.br) for (const sd of [-1, 1]) {
    for (let k = sg.k0; k < sg.k1 + 1 && k + 1 < n; k++) {
      const A = R[k], B = R[k + 1], [ax, az] = nrm(k), [bx, bz] = nrm(k + 1), o = HW + 1.05;
      const p = [A[0] + ax * sd * o, A[1] + az * sd * o], q = [B[0] + bx * sd * o, B[1] + bz * sd * o], L = Math.hypot(q[0] - p[0], q[1] - p[1]), ry = Math.atan2(q[0] - p[0], q[1] - p[1]), y = (A[2] + B[2]) / 2;
      rk.box((p[0] + q[0]) / 2, y + .7, (p[1] + q[1]) / 2, .25, .9, L + .02, 0xa9a59a, TX.conc, 0, ry, 0).box((p[0] + q[0]) / 2, y - .35, (p[1] + q[1]) / 2, .3, 1.3, L + .02, 0x8e8b83, TX.conc, 0, ry, 0);
      colliders.push({ x0: -.05, x1: L + .05, z0: -.15, z1: .15, zn: frameW(p[0], p[1], q[0] - p[0], q[1] - p[1]), ly: y - 2, hy: y + 1.3, low: 1 });
    }
    for (const k of [sg.k0, Math.min(n - 1, sg.k1 + 1)]) { const [ax, az] = nrm(k), o = HW + 1.05, [tx, tz] = tng(k); rk.box(R[k][0] + ax * sd * o, R[k][2] + .85, R[k][1] + az * sd * o, .45, 1.3, .45, 0x7d7a72, TX.stone, 0, Math.atan2(tx, tz), 0); }
    osm.bridge++;
  }
  // 速限與県道：每段開頭（兩個方向）、支路口後面、每 600 點
  const runs2 = []; for (const sg of R.seg) { const L = runs2[runs2.length - 1]; if (L && L.max === sg.max && L.ref === sg.ref) L.k1 = sg.k1; else runs2.push({ ...sg }); }
  for (const r of runs2) {
    if (r.max) { osm.max += signAt(Math.max(r.k0, 2) + 6, 1, 'max', r.max) + signAt(r.k1 - 6, -1, 'max', r.max); for (const j of R.jun) if (j.k > r.k0 && j.k < r.k1) osm.max += signAt(j.k + 10, 1, 'max', r.max) + signAt(j.k - 10, -1, 'max', r.max); }
    if (r.ref) { osm.route += signAt(Math.max(r.k0, 2) + 16, 1, 'ref', r.ref) + signAt(r.k1 - 16, -1, 'ref', r.ref); for (let k = r.k0 + 600; k < r.k1 - 300; k += 600) osm.route += signAt(k, 1, 'ref', r.ref) + signAt(k + 8, -1, 'ref', r.ref); for (const j of R.jun) if (j.k > r.k0 + 20 && j.k < r.k1 - 20) osm.route += signAt(j.k + 20, 1, 'ref', r.ref) + signAt(j.k - 20, -1, 'ref', r.ref); }
  }
  // 支路
  for (const j of R.jun) {
    const [x, z, y] = R[j.k], P = [], N = [], UV = [], AX = [], I = [], L = 26, M = 14, px = j.dz, pz = -j.dx;
    for (let i = 0; i <= M; i++) {
      const s = L * i / M, cx = x + j.dx * s, cz = z + j.dz * s, t = sm01((s - HW) / (L - HW)), tg = hillMeshH(cx, cz), cy = (Number.isFinite(tg) ? y + (tg - y) * t : y) + .24 - (i === M ? .3 : 0);
      for (const off of [-j.hwd, 0, j.hwd]) { P.push(cx + px * off, cy, cz + pz * off); N.push(0, 1, 0); UV.push(off, s); AX.push(px, pz); }
      if (i) { const b = (i - 1) * 3; I.push(b, b + 3, b + 1, b + 1, b + 3, b + 4, b + 1, b + 4, b + 2, b + 2, b + 4, b + 5); }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(N, 3));
    g.setAttribute('aUV', new T.Float32BufferAttribute(UV, 2)); g.setAttribute('aAx', new T.Float32BufferAttribute(AX, 2)); g.setIndex(I); g.computeVertexNormals(); g.computeBoundingSphere();
    const m = new T.Mesh(g, MAT.roadConn); m.name = 'akinaSpur'; groundAdd(m, null); osm.spur++;
    if (j.hw === 'tertiary' || j.hw === 'unclassified') {   // 往山道開的那一側（車道在右）：停止線與停車再開（倒三角，紅底白邊）
      const s0 = HW + 2.6, rx = j.dz, rz = -j.dx, sx = x + j.dx * s0 + rx * j.hwd / 2, sz = z + j.dz * s0 + rz * j.hwd / 2, sy = hillMeshH(sx, sz);
      if (Number.isFinite(sy)) rk.box(sx, Math.max(sy, y) + .27, sz, j.hwd, .02, .45, 0xc9c8c0, 2, 0, Math.atan2(-rz, rx), 0);
      const qx = x + j.dx * (HW + 3.4) + rx * (j.hwd + .8), qz = z + j.dz * (HW + 3.4) + rz * (j.hwd + .8), qy = hillMeshH(qx, qz), ry = Math.atan2(j.dx, j.dz);
      if (Number.isFinite(qy)) {
        rk.cyl(qx, qy + 1.1, qz, .03, .03, 2.2, 6, 0x9a9da0, TX.galv);
        rk.add(flat(3, .46), 0x9a9da0, TX.galv, tf(...face(qx, qy + 2.05, qz, ry, 0, 0, -.025), 0, ry, 0)).add(flat(3, .46), 0xf2f2ee, 2, tf(...face(qx, qy + 2.05, qz, ry, 0, 0, -.01), 0, ry, 0)).add(flat(3, .38), 0xc4221c, 2, tf(...face(qx, qy + 2.05, qz, ry, 0, 0, .008), 0, ry, 0));
        lq(lbl('stop', 256, 96, (c, w, h) => fit(c, '止まれ', w / 2, h / 2, w * .94, 80, 800, JF, '#f2f2ee')), qx, qy + 2.12, qz, ry, .36, .135, .028);   // 倒三角的上半寬，字放在中心偏上
        osm.stop++; SIGNS.push(['stop', +qx.toFixed(1), +(qy + 2.05).toFixed(1), +qz.toFixed(1), +ry.toFixed(2)]);
      }
    }
  }
  // メロディーライン：往湖那個方向的車道（右側），每 0.45 m 一道橫溝
  for (let k = 0; k + 1 < n; k++) if (R.calm[k]) {
    const A = R[k], B = R[k + 1], L = Math.hypot(B[0] - A[0], B[1] - A[1]), [nx, nz] = nrm(k), ry = Math.atan2(nx, nz);
    for (let u = 0; u < L; u += .45) { const t = u / L, x = A[0] + (B[0] - A[0]) * t + nx * 1.5, z = A[1] + (B[1] - A[1]) * t + nz * 1.5, h = hillMeshH(x, z); if (Number.isFinite(h)) rk.box(x, h + .262, z, .07, .012, 2.4, 0x1f2022, 2, 0, ry, 0); }
    osm.calm++;
  }
  // ─── OSM 的路邊節點與停車場（R.obj，Overpass 的 bus_stop／viewpoint／amenity=parking）───
  // バス停：路緣外 1.3 m 那一側（OSM 的點在路邊 5–20 m，是畫在路外的；髮夾彎、支路口就往前後挪，擋土牆前面立在路肩上），水泥底座、圓牌（綠框白底）、時刻表板；
  // 展望地：OSM 的點本身（地面和路面差 4 m 內、不陡），不行就路緣外 3 m：一段木欄、長椅、茶色的解說牌，朝路的外面；
  // 停車場：外形照地面鋪柏油（MAT.roadConn，橫向座標放在大道標線的範圍外，只有柏油、補丁與裂縫），最長那條邊一排白色停車格與車擋
  osm.bus = 0; osm.view = 0; osm.park = 0;
  const near = (k0, sd, ok) => { for (let j = 0; j < 30; j++) { const k = k0 + (j % 2 ? (j + 1) / 2 : -j / 2); if (k > 1 && k < n - 2 && ok(k)) return k; } return -1; };
  const free = sd => k => !akinaPin(R, k) && !R.br[k] && R.gap[k] !== sd && !(walls[sd].Hs[k] > 0) && !(walls[sd].Ds[k] > 0);
  for (const o of R.obj) {
    if (o.kind === 'bus') {
      const k = near(o.k, o.sd, q => !akinaPin(R, q) && !R.br[q] && R.gap[q] !== o.sd); if (k < 0) continue;
      const wl = walls[o.sd].Hs[k] > 0 || walls[o.sd].Ds[k] > 0, oo = HW + (wl ? .55 : 1.3);   // 擋土牆前面：立在路肩上（牆在 HW + 1.15 外）
      const [tx, tz] = tng(k), [nx, nz] = nrm(k), px = R[k][0] + nx * o.sd * oo, pz = R[k][1] + nz * o.sd * oo, py = wl ? R[k][2] : hillMeshH(px, pz);
      if (!Number.isFinite(py) || Math.abs(py - R[k][2]) > 1.5) continue;
      const ry = Math.atan2(tx, tz), y = Math.max(py, R[k][2] + .22);   // 路面在路的點上 0.24 m
      rk.cyl(px, y + .1, pz, .3, .34, .2, 12, 0x8f8c84, TX.conc).cyl(px, y + 1.3, pz, .035, .035, 2.3, 6, 0xb8bab8, TX.galv);
      // 時刻表：時刻是照站名雜湊出來的（不是真的班表；不動 rnd）
      let hs = 7; for (const ch of o.name) hs = (hs * 31 + ch.charCodeAt(0)) >>> 0;
      const tt = lbl('tt' + o.name, 256, 352, (c, w, h) => {
        c.fillStyle = '#2f7a46'; c.fillRect(0, 0, w, 58); fit(c, '時 刻 表', w / 2, 30, w * .9, 34, 700, JF, '#f0efe8');
        fit(c, o.name, w / 2, 82, w * .92, 26, 700, JF, '#2a2c2e'); c.fillStyle = '#55585c'; c.fillRect(10, 100, w - 20, 2); c.fillRect(70, 104, 2, h - 112);
        let q = hs; for (let r = 0; r < 12; r++) {
          const hr = 7 + r, yy = 118 + r * 19.5; q = (q * 1103515245 + 12345) >>> 0;
          fit(c, String(hr), 40, yy, 50, 18, 700, NF, '#2a2c2e');
          c.font = `500 17px ${NF}`; c.textAlign = 'left'; c.fillStyle = '#3a3c3e'; c.fillText(q % 3 ? String(5 + q % 50).padStart(2, '0') + (q % 5 < 2 ? '   ' + String(30 + q % 28) : '') : '', 84, yy);
        }
      });
      for (const d of [-1, 1]) {   // 圓牌兩面都看得到（兩個方向的車）
        rk.add(flat(24, .29), 0x2f7a46, 2, tf(...face(px, y + 2.2, pz, ry, 0, 0, .02 * d), 0, ry, 0)).add(flat(24, .23), 0xf0efe8, 2, tf(...face(px, y + 2.2, pz, ry, 0, 0, .032 * d), 0, ry, 0));
        rk.box(...face(px, y + 2.2, pz, ry, 0, 0, .05 * d), .3, .07, .01, 0x2f7a46, 2, 0, ry, 0);   // 圓牌中間的橫帶：站名
        lq(lbl('bus' + o.name, 512, 96, (c, w, h) => fit(c, o.name, w / 2, h / 2, w * .94, 76, 700, JF, '#f4f4ee')), px, y + 2.2, pz, ry, .28, .0525, .056 * d, d < 0);
        lq(lbl('busHd', 256, 64, (c, w, h) => fit(c, 'バス停留所', w / 2, h / 2, w * .9, 48, 800, JF, '#2f7a46')), px, y + 2.315, pz, ry, .2, .05, .049 * d, d < 0);
        lq(tt, px, y + 1.45, pz, ry, .38, .52, .02 * d, d < 0);
      }
      rk.box(px, y + 1.45, pz, .42, .56, .035, 0xe6e4da, TX.sheet, 0, ry, 0);
      colliders.push({ x0: -.3, x1: .3, z0: -.3, z1: .3, zn: frameW(px, pz, 1, 0), ly: y - 1, hy: y + 2.6, low: 1 });
      o.at = [px, y, pz, k]; osm.bus++;
    } else if (o.kind === 'view') {
      const [nx, nz] = nrm(o.k); let px = o.x, pz = o.z, py = hillMeshH(px, pz);
      const steep = (x, z) => Math.hypot(hillMeshH(x + 2, z) - hillMeshH(x - 2, z), hillMeshH(x, z + 2) - hillMeshH(x, z - 2)) / 4 > .35;
      if (!Number.isFinite(py) || Math.abs(py - R[o.k][2]) > 4 || steep(px, pz)) {
        const k = near(o.k, o.sd, free(o.sd)); if (k < 0) continue;
        const [mx, mz] = nrm(k); px = R[k][0] + mx * o.sd * (HW + 3); pz = R[k][1] + mz * o.sd * (HW + 3); py = hillMeshH(px, pz);
        if (!Number.isFinite(py) || Math.abs(py - R[k][2]) > 2) continue;
      }
      const ox = nx * o.sd, oz = nz * o.sd, ry = Math.atan2(ox, oz), ux = oz, uz = -ox;   // 朝外（看出去的方向）；u：沿欄杆
      for (let q = -2; q <= 2; q++) { const x = px + ox * 1.6 + ux * q, z = pz + oz * 1.6 + uz * q, h = hillMeshH(x, z); if (Number.isFinite(h)) rk.box(x, h + .45, z, .1, .9, .1, 0x5b4630, TX.woodY, 0, ry, 0); }
      for (const v of [.45, .8]) { const a = [px + ox * 1.6 - ux * 2, pz + oz * 1.6 - uz * 2], b = [px + ox * 1.6 + ux * 2, pz + oz * 1.6 + uz * 2], ha = hillMeshH(...a), hb = hillMeshH(...b); if (Number.isFinite(ha) && Number.isFinite(hb)) rk.bar(a[0], ha + v, a[1], b[0], hb + v, b[1], .06, .09, 0x6a5238, TX.woodX); }
      rk.box(px, py + .42, pz, 1.6, .06, .4, 0x6a5238, TX.woodX, 0, ry, 0);
      for (const s2 of [-.65, .65]) rk.box(px + ux * s2, py + .2, pz + uz * s2, .1, .4, .34, 0x8f8c84, TX.conc, 0, ry, 0);
      const bx = px - ux * 2.6, bz = pz - uz * 2.6, bh = hillMeshH(bx, bz);
      if (Number.isFinite(bh)) {
        for (const s2 of [-.55, .55]) rk.box(bx + ux * s2, bh + .75, bz + uz * s2, .1, 1.5, .1, 0x4b3826, TX.woodY, 0, ry, 0);
        rk.box(bx, bh + 1.25, bz, 1.3, .8, .06, 0x5a3c24, TX.woodX, 0, ry, 0).box(bx, bh + 1.68, bz, 1.45, .08, .3, 0x4b3826, TX.woodX, 0, ry, 0);
        rk.box(...face(bx, bh + 1.25, bz, ry + Math.PI, 0, 0, .035), 1.1, .6, .01, 0xd9d2bd, 2, 0, ry, 0);   // 解說牌面朝路
        lq(lbl('view', 512, 280, (c, w, h) => {   // 解說牌：標題與一條山稜線的示意
          fit(c, '展 望 所', w / 2, 44, w * .8, 50, 800, JF, '#4b3826'); fit(c, '榛名山　標高 1,449 m', w / 2, 96, w * .8, 26, 600, JF, '#5a4632');
          c.strokeStyle = '#5a4632'; c.lineWidth = 4; c.beginPath(); c.moveTo(30, 230); for (let i = 0; i <= 18; i++) c.lineTo(30 + i * 25.5, 230 - 70 * Math.sin(i / 18 * Math.PI) * (.6 + .4 * Math.cos(i * 1.7))); c.stroke();
          c.fillStyle = '#7a6448'; c.fillRect(30, 244, w - 60, 3);
        }), bx, bh + 1.25, bz, ry + Math.PI, 1.04, .57, .041);
      }
      colliders.push({ x0: -2, x1: 2, z0: -.25, z1: .25, zn: frameW(px + ox * 1.6, pz + oz * 1.6, ux, uz), ly: py - 1, hy: py + 1.1, low: 1 });
      o.at = [px, py, pz, o.k]; osm.view++;
    }
  }
  for (const o of AKINA.lots || []) {
    const r = o.ring.slice(0, -1); if (r.length < 3) continue;
    const tri = T.ShapeUtils.triangulateShape(r.map(([x, z]) => new T.Vector2(x, z)), []), cx = r.reduce((a, p) => a + p[0], 0) / r.length, cz = r.reduce((a, p) => a + p[1], 0) / r.length;
    const P = [], N = [], UV = [], AX = [];
    const vtx = (x, z) => { const h = hillMeshH(x, z); P.push(x, (Number.isFinite(h) ? h : R[o.k][2]) + .08, z); N.push(0, 1, 0); UV.push(x - cx + 200, z - cz); AX.push(1, 0); };
    const up = (p, q, w) => { if ((q[1] - p[1]) * (w[0] - p[0]) - (q[0] - p[0]) * (w[1] - p[1]) < 0) [q, w] = [w, q]; vtx(...p); vtx(...q); vtx(...w); };   // 外形可能是順時針：每個三角形都排成法線朝上
    for (const [a, b, c] of tri) {   // 每個三角形再切成 1.2 m 左右的小三角形，貼著地面（地面在外形裡是一片斜平面，10-city.js 的挖填照 akinaLotH 整平）
      const A = r[a], B = r[b], C = r[c], m = Math.max(1, Math.ceil(Math.max(Math.hypot(B[0] - A[0], B[1] - A[1]), Math.hypot(C[0] - A[0], C[1] - A[1]), Math.hypot(C[0] - B[0], C[1] - B[1])) / 1.2));
      const at = (i, j) => [A[0] + (B[0] - A[0]) * i / m + (C[0] - A[0]) * j / m, A[1] + (B[1] - A[1]) * i / m + (C[1] - A[1]) * j / m];
      for (let i = 0; i < m; i++) for (let j = 0; i + j < m; j++) {
        up(at(i, j), at(i + 1, j), at(i, j + 1));
        if (i + j + 1 < m) up(at(i + 1, j), at(i + 1, j + 1), at(i, j + 1));
      }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(N, 3));
    g.setAttribute('aUV', new T.Float32BufferAttribute(UV, 2)); g.setAttribute('aAx', new T.Float32BufferAttribute(AX, 2)); g.computeVertexNormals(); g.computeBoundingSphere();
    const m = new T.Mesh(g, MAT.roadConn); m.name = 'akinaLot'; groundAdd(m, null);
    // 最長的邊往內一排停車格（2.5 m 寬、5 m 深），兩端都在外形裡才畫；格子裡面那一頭的車擋
    let e = 0, el = 0; for (let q = 0; q < r.length; q++) { const a = r[q], b = r[(q + 1) % r.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l > el) { el = l; e = q; } }
    const a = r[e], b = r[(e + 1) % r.length], ex = (b[0] - a[0]) / el, ez = (b[1] - a[1]) / el; let ix = -ez, iz = ex;
    if (!akinaInLot(o, (a[0] + b[0]) / 2 + ix * 2, (a[1] + b[1]) / 2 + iz * 2)) { ix = -ix; iz = -iz; }
    const hy = (x, z) => { const h = hillMeshH(x, z); return Number.isFinite(h) ? h : R[o.k][2]; };
    let stalls = 0;
    for (let u = 1.5; u < el - 1.5; u += 2.5) {
      const p0 = [a[0] + ex * u + ix * .8, a[1] + ez * u + iz * .8], p1 = [p0[0] + ix * 5, p0[1] + iz * 5], pm = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
      if (!akinaInLot(o, ...p0) || !akinaInLot(o, ...p1)) continue;
      rk.bar(p0[0], hy(...p0) + .11, p0[1], pm[0], hy(...pm) + .11, pm[1], .12, .02, 0xd6d4cc, 2).bar(pm[0], hy(...pm) + .11, pm[1], p1[0], hy(...p1) + .11, p1[1], .12, .02, 0xd6d4cc, 2);
      if (u + 2.5 < el - 1.5) { const w = [p0[0] + ix * 4.3 + ex * 1.25, p0[1] + iz * 4.3 + ez * 1.25]; rk.box(w[0], hy(...w) + .15, w[1], 1.6, .14, .18, 0x9a978f, TX.conc, 0, Math.atan2(ix, iz), 0); }
      stalls++;
    }
    for (let q = 0; q < r.length; q++) {   // 外緣：水泥邊石（高出柏油 2 cm，往下 0.6 m 埋進地面，遮住整平的邊）
      const a = r[q], b = r[(q + 1) % r.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]), sn = Math.max(1, Math.ceil(l / 2));
      for (let t = 0; t < sn; t++) { const u0 = t / sn, u1 = (t + 1) / sn, p = [a[0] + (b[0] - a[0]) * u0, a[1] + (b[1] - a[1]) * u0], q2 = [a[0] + (b[0] - a[0]) * u1, a[1] + (b[1] - a[1]) * u1]; rk.bar(p[0], hy(...p) - .2, p[1], q2[0], hy(...q2) - .2, q2[1], .18, .6, 0x8a877f, TX.conc); }
    }
    o.stalls = stalls; osm.park++;
  }
  osm.lot = (AKINA.lots || []).map(o => ({ k: o.k, sd: o.sd, n: o.ring.length - 1, stalls: o.stalls || 0, x: +o.x.toFixed(1), z: +o.z.toFixed(1), bb: o.ring.reduce((b, [x, z]) => [Math.min(b[0], x), Math.min(b[1], z), Math.max(b[2], x), Math.max(b[3], z)], [1e9, 1e9, -1e9, -1e9]).map(v => +v.toFixed(1)) }));
  osm.objs = R.obj.map(o => ({ kind: o.kind, k: o.k, sd: o.sd, off: +o.off.toFixed(1), name: o.name, x: +o.x.toFixed(1), z: +o.z.toFixed(1), at: o.at ? o.at.map(v => +v.toFixed(1)) : null }));
  osm.rail = HILL.railsAk; osm.signs = SIGNS;
  AKINA.osm = osm;
  if (rk.pos.length) { const m = new T.Mesh(rk.build(), MAT.ux); m.name = 'akinaWalls'; cityAdd(m, null); }
  // runs：最長的幾段牆中間那一點（路上的點、牆在哪一側、高度），驗收與截圖用
  AKINA.walls = { len: Math.round(stat.len), seg: stat.pts, hMax: +stat.hMax.toFixed(1), fill: Math.round(fstat.len), dMax: +fstat.dMax.toFixed(1), poles, runs: runs.sort((a, b) => b.len - a.len).slice(0, 8).map(r => ({ k: r.i, x: +R[r.i][0].toFixed(1), z: +R[r.i][1].toFixed(1), y: +R[r.i][2].toFixed(1), sd: r.sd, h: +walls[r.sd].Hs[r.i].toFixed(1), n: nrm(r.i).map(v => +(v * r.sd).toFixed(3)), m: Math.round(r.len * 1.8) })) };
}
// ═══ 別墅區的山路（10-city.js 的 HILL.paths 裡不是榛嶺的那幾條）照同一套參考圖（使用者：別墅區的樣式同步）：路面、路緣、白邊線、白色護欄在 10-city.js（和榛嶺同一個分支），
// 這裡砌上坡那側的石牆＋水泥壓頂＋回填草坡（量法同榛嶺；路上的點每 8 m 一個，所以平均只取前後各一點、連續 3 點以上才砌），別墅的車道口與車庫前 14 m、平台四周 3 m、
// 別的路 HW + 6 m 內、路口頭三點不砌；每條路從路口進來約 30 m 立一面速限 30（車行方向的右側，牌面朝進來的車）═══
if (HILL.paths) {
  const HW = HILL.roadHW, rk = new Kit(), G = { stone: [], cap: [], fill: [] }, VR = HILL.paths.filter(p => !p.akina), st = { len: 0, seg: 0, hMax: 0, signs: 0, roads: VR.length, runs: [] };
  const quad = (L, a, b, c, d, want) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const flip = (uy * vz - uz * vy) * want[0] + (uz * vx - ux * vz) * want[1] + (ux * vy - uy * vx) * want[2] < 0;
    L.push(...(flip ? [a, c, b, a, d, c] : [a, b, c, a, c, d]).flat());
  };
  const segs = []; for (const P of HILL.paths) for (let k = 0; k + 1 < P.length; k++) segs.push([P, P[k], P[k + 1], Math.min(P[k][0], P[k + 1][0]), Math.max(P[k][0], P[k + 1][0]), Math.min(P[k][1], P[k + 1][1]), Math.max(P[k][1], P[k + 1][1])]);
  const nearOther = (R, x, z, r) => segs.some(([P, a, b, x0, x1, z0, z1]) => {
    if (P === R || x < x0 - r || x > x1 + r || z < z0 - r || z > z1 + r) return false;
    const ex = b[0] - a[0], ez = b[1] - a[1], t = clamp(((x - a[0]) * ex + (z - a[1]) * ez) / (ex * ex + ez * ez || 1), 0, 1); return Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t) < r;
  });
  const nearHome = (x, z) => HILL_HOMES.some(h => {
    const c = Math.cos(h.ry), s = Math.sin(h.ry), dx = x - h.x, dz = z - h.z, lx = dx * c - dz * s, lz = dx * s + dz * c, [px0, px1, pz0, pz1] = h.pad, [ddx, gap] = h.drv;
    return lx > px0 - 3 && lx < px1 + 3 && lz > pz0 - gap - 3 && lz < pz1 + 3 || Math.hypot(lx - ddx, lz - (pz0 - gap)) < 14;
  });
  for (const R of VR) {
    const n = R.length; if (n < 6) continue;
    const nrm = i => { const a = R[Math.max(0, i - 1)], b = R[Math.min(n - 1, i + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [-(b[1] - a[1]) / L, (b[0] - a[0]) / L]; };
    const hd = i => Math.atan2(R[Math.min(n - 1, i + 1)][1] - R[i][1], R[Math.min(n - 1, i + 1)][0] - R[i][0]);
    const wall = {};
    for (const sd of [-1, 1]) {
      const H = new Float32Array(n), Hs = new Float32Array(n), o = HW + 1.08;   // 牆面貼著路緣外緣（1.1 m）：粗網格內插的草才不會從牆腳前冒出來
      for (let i = 3; i < n - 1; i++) {
        const [x, z, y] = R[i], [nx0, nz0] = nrm(i), nx = nx0 * sd, nz = nz0 * sd, t = akAng(hd(i), hd(i - 1)), r = 8 / (Math.abs(t) || 1e-6);
        if (Math.sign(t) === sd && r < o + 6) continue;   // 彎的內側太急（牆的法線會交叉）
        const wx = x + nx * (o + .6), wz = z + nz * (o + .6);
        if (nearOther(R, wx, wz, HW + 6) || nearHome(wx, wz)) continue;
        const h = hillMeshRaw(x + nx * (o + 1.6), z + nz * (o + 1.6));
        if (Number.isFinite(h)) H[i] = Math.max(0, h - y - .3);
      }
      for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let k = -1; k <= 1; k++) if (i + k >= 0 && i + k < n) { s += H[i + k]; c++; } Hs[i] = H[i] && s / c >= 1.3 ? Math.min(4.2, s / c) : 0; }
      for (let i = 0; i < n;) { if (!Hs[i]) { i++; continue; } let j = i; while (j + 1 < n && Hs[j + 1]) j++; if (j - i < 2) Hs.fill(0, i, j + 1); i = j + 1; }
      wall[sd] = Hs;
      const P = i => {
        const [x, z, y] = R[i], [nx0, nz0] = nrm(i), nx = nx0 * sd, nz = nz0 * sd, h = Hs[i], ob = o + h * .12, at = (d, yy) => [x + nx * d, yy, z + nz * d];
        const ef = Math.max(ob + 1, HW + 1.4 + h / 1.4 + 1.2), ye = hillMeshH(x + nx * ef, z + nz * ef);   // 10-city.js 的挖方從 RC（路緣外 1.4 m）照 1.4:1 起坡
        return { n: [-nx, 0, -nz], f0: at(o, y - .8), f1: at(ob, y + h), c0: at(ob - .06, y + h), c1: at(ob - .06, y + h + .2), c2: at(ob + .45, y + h + .2), c3: at(ob + .45, y + h + .05),
          e: at(ef, Math.max(y + h, Number.isFinite(ye) ? ye : y + h) - .05), b0: at(ob + .45, y - .8) };
      };
      for (let i = 0; i + 1 < n; i++) {
        if (!Hs[i] || !Hs[i + 1]) continue;
        const a = P(i), b = P(i + 1), up = [0, 1, 0];
        quad(G.stone, a.f0, a.f1, b.f1, b.f0, a.n);
        quad(G.cap, a.c0, a.c1, b.c1, b.c0, a.n); quad(G.cap, a.c1, a.c2, b.c2, b.c1, up);
        quad(G.fill, a.c3, a.e, b.e, b.c3, up);
        for (const [e, q] of [[i === 0 || !Hs[i - 1], a], [i + 2 >= n || !Hs[i + 2], b]]) if (e) {
          const t = q === a ? [R[i][0] - R[i + 1][0], 0, R[i][1] - R[i + 1][1]] : [R[i + 1][0] - R[i][0], 0, R[i + 1][1] - R[i][1]];
          quad(G.stone, q.f0, q.f1, q.c2, q.b0, t);
        }
        const ax = a.f1[0], az = a.f1[2], bx = b.f1[0], bz = b.f1[2], L = Math.hypot(bx - ax, bz - az), y0 = Math.min(R[i][2], R[i + 1][2]);
        if (L > .3) colliders.push({ x0: -.05, x1: L + .05, z0: -.25, z1: .25, zn: frameW(ax, az, bx - ax, bz - az), ly: y0 - 2, hy: y0 + Math.max(Hs[i], Hs[i + 1]) + .3 });
        st.seg++; st.len += Math.hypot(R[i + 1][0] - R[i][0], R[i + 1][1] - R[i][1]); st.hMax = Math.max(st.hMax, Hs[i]);
        if (!Hs[i - 1]) st.runs.push([+R[i][0].toFixed(1), +R[i][2].toFixed(1), +R[i][1].toFixed(1), sd, +Hs[i].toFixed(1)]);
      }
    }
    // 速限 30：路口進來第 5 點起（約 40 m），立在右側的水泥路緣上（路緣外 0.5 m，下坡那側護欄在 0.85 m，不擋），別的路口與別墅車道口讓開
    for (let k = 5; k < (R.link && !R.mouth ? 0 : n - 1); k++) {   // 連絡路（09-hilllink.js）不立
      if (k % 18 === 4) continue;   // 10-city.js 的路燈（第 4、13、22…點，右側是 4、22、40…）
      const [x, z] = R[k], [nx, nz] = nrm(k), px = x + nx * (HW + .5), pz = z + nz * (HW + .5), py = hillMeshH(px, pz);   // 右側：nrm 的 (−tz, tx) 就是車行方向的右手邊（同榛嶺的 signAt）
      if (!Number.isFinite(py) || nearOther(R, px, pz, HW + 4) || nearHome(px, pz)) continue;
      akMaxSign(rk, px, py + .22, pz, Math.atan2(-nz, nx), 30); st.signs++;   // 牌面朝進來的車（前進方向是 (nz, −nx)）
      colliders.push({ x0: -.08, x1: .08, z0: -.08, z1: .08, zn: frameW(px, pz, 1, 0), ly: py - 1, hy: py + 2.8, low: 1 });
      break;
    }
  }
  const geo = arr => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(arr, 3)); g.computeVertexNormals(); return g; };
  if (G.stone.length) rk.add(geo(G.stone), 0x55574f, TX.stone).add(geo(G.cap), 0xa9a69e, TX.conc).add(geo(G.fill), 0x4d5a30, TX.hill);
  if (rk.pos.length) { const m = new T.Mesh(rk.build(), MAT.ux); m.name = 'hillWalls'; cityAdd(m, null); }
  HILL.walls = HILL_HOMES.walls = { len: Math.round(st.len), seg: st.seg, hMax: +st.hMax.toFixed(1), signs: st.signs, roads: st.roads, runs: st.runs };   // 驗收：__nc.hillHomes.walls
}
// ─── 牌面文字的圖集（AKT，最上面）：寬 1024，一列一列排、高取 2 的次方，一個網格 ───
if (AKT.Q.length) {
  const W = 1024; let x = 0, y = 0, rh = 0;
  for (const c of AKT.L.values()) { if (x + c.pw > W) { x = 0; y += rh; rh = 0; } c.x = x; c.y = y; x += c.pw; rh = Math.max(rh, c.ph); }
  const H = 2 ** Math.ceil(Math.log2(y + rh)), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const cx = cv.getContext('2d'); for (const c of AKT.L.values()) { cx.save(); cx.translate(c.x, c.y); c.draw(cx, c.pw, c.ph); cx.restore(); }
  const P = [], UV = [], I = [];
  for (const [c, q] of AKT.Q) { const b = P.length / 3, u0 = (c.x + 1) / W, u1 = (c.x + c.pw - 1) / W, v1 = 1 - (c.y + 1) / H, v0 = 1 - (c.y + c.ph - 1) / H; for (const p of q) P.push(...p); UV.push(u0, v0, u1, v0, u1, v1, u0, v1); I.push(b, b + 1, b + 2, b, b + 2, b + 3); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals(); g.computeBoundingSphere();
  const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 8;
  const mat = new T.MeshBasicMaterial({ map: tx, alphaTest: .45, toneMapped: false, color: 0x6a6a6a }), m = new T.Mesh(g, mat); m.name = 'akinaText';
  m.onBeforeRender = () => mat.color.setScalar(.03 + .4 * U.uDay.value * (1 - .25 * U.uWet.value));   // 白天約等於 0xb0（21-coast.js 的路牌），夜裡幾乎是暗的
  cityAdd(m, null); AKT.stat = { quads: AKT.Q.length, cells: AKT.L.size, atlas: [W, H] };
  if (AKINA && AKINA.osm) AKINA.osm.text = AKT.stat;
}

// ═══ 別墅區山路的路燈（10-city.js 的 HILL.lampHeads）寫進路燈表（20-props.js 的 lampTable，同 28-enclave.js 的做法），晚上照亮路面與山坡（使用者：晚上路燈要會亮）═══
if (HILL.lampHeads && HILL.lampHeads.length) { LAMP_HEADS.push(...HILL.lampHeads); U.uLampT.value?.dispose(); lampTable(LAMP_HEADS); }
