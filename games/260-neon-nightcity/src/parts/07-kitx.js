// ═══ Kit 的細節零件：圓角方塊、旋轉體、兩點之間的桿、擠出的剖面、環、開口的遮光罩 ═══
// 程式建模的街道設施與交通設施（20-props、21-coast…）照實物照片重畫時用；全部走 Kit.add，頂點色與 aMat 照舊
const _kx = { a: V3(), b: V3(), d: V3(), q: new T.Quaternion(), up: V3(0, 1, 0), m: new T.Matrix4(), s: V3(1, 1, 1) };
// 圓角矩形剖面（四角各 n 段圓弧）
function kxRoundRect(w, h, r, n = 2) {
  const s = new T.Shape(), x = w / 2 - r, y = h / 2 - r;
  s.moveTo(-x, -h / 2); s.lineTo(x, -h / 2); s.absarc(x, -y, r, -Math.PI / 2, 0); s.lineTo(w / 2, y); s.absarc(x, y, r, 0, Math.PI / 2);
  s.lineTo(-x, h / 2); s.absarc(-x, y, r, Math.PI / 2, Math.PI); s.lineTo(-w / 2, -y); s.absarc(-x, -y, r, Math.PI, Math.PI * 1.5);
  s.userData = { n };
  return s;
}
// 圓角方塊：xy 面是圓角矩形（半徑 r），z 方向的前後邊再導一個 b 的角（b = 0 不導）
Kit.prototype.rbox = function (x, y, z, sx, sy, sz, r, color, mat = 2, rx = 0, ry = 0, rz = 0, b = 0) {
  r = Math.min(r, sx / 2 - .001, sy / 2 - .001); b = Math.min(b, sz / 2 - .001, r);
  const g = new T.ExtrudeGeometry(kxRoundRect(sx - 2 * b, sy - 2 * b, Math.max(.001, r - b)), { depth: sz - 2 * b, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 1, curveSegments: 2 });
  g.translate(0, 0, -(sz - 2 * b) / 2);
  return this.add(g, color, mat, tf(x, y, z, rx, ry, rz));
};
// 旋轉體：pts 是 [半徑, 高度] 由下往上，繞 y 軸
Kit.prototype.lathe = function (x, y, z, pts, seg, color, mat = 2, rx = 0, ry = 0, rz = 0, phi = 0, len = Math.PI * 2) {
  return this.add(new T.LatheGeometry(pts.map(([r, h]) => new T.Vector2(Math.max(r, 1e-4), h)), seg, phi, len), color, mat, tf(x, y, z, rx, ry, rz));
};
// 兩點之間的圓桿（r0 在 a 端、r1 在 b 端）
Kit.prototype.rod = function (ax, ay, az, bx, by, bz, r0, seg, color, mat = 15, r1 = r0) {
  const { a, b, d, q, up, m, s } = _kx;
  a.set(ax, ay, az); b.set(bx, by, bz); d.subVectors(b, a); const L = d.length() || 1e-4;
  q.setFromUnitVectors(up, d.multiplyScalar(1 / L));
  m.compose(a.add(b).multiplyScalar(.5), q, s);
  return this.add(new T.CylinderGeometry(r1, r0, L, seg), color, mat, m.clone());
};
// 兩點之間的方管（截面 w × h，h 方向盡量朝上）
Kit.prototype.bar = function (ax, ay, az, bx, by, bz, w, h, color, mat = 15) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz) || 1e-4;
  const ry = Math.atan2(dx, dz), rx = -Math.atan2(dy, Math.hypot(dx, dz));
  return this.box((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, w, h, L, color, mat, rx, ry, 0);
};
// 擠出的剖面：pts 是 xy 平面的多邊形（逆時針），沿 z 擠出 depth（以 z = 0 為中心）
Kit.prototype.prism = function (x, y, z, pts, depth, color, mat = 2, rx = 0, ry = 0, rz = 0, bevel = 0) {
  const s = new T.Shape(pts.map(([px, py]) => new T.Vector2(px, py)));
  const g = new T.ExtrudeGeometry(s, { depth: depth - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, -(depth - 2 * bevel) / 2);
  return this.add(g, color, mat, tf(x, y, z, rx, ry, rz));
};
// 環（預設躺在 xz 平面）
Kit.prototype.torus = function (x, y, z, R, r, seg, color, mat = 15, rx = Math.PI / 2, ry = 0, rz = 0, arc = Math.PI * 2, rseg = 6) {
  return this.add(new T.TorusGeometry(R, r, rseg, seg, arc), color, mat, tf(x, y, z, rx, ry, rz));
};
// 沿一串點擠出剖面：P[i] 是路徑上的點，N[i]、U[i] 是那一點剖面平面的兩軸（「外」與「上」，單位向量），sec(i) 是第 i 點的剖面
// [外, 上] 封閉多邊形（陣列也可以，每點一樣；點數要相同）。剖面每條邊各自一組頂點（稜角是硬的）、沿路徑平滑，兩端封口
Kit.prototype.loft = function (P, N, U, sec, color, mat = 2) {
  const n = P.length, S = typeof sec === 'function' ? sec : () => sec, pos = [], nor = [];
  const R = [], E = [];
  for (let i = 0; i < n; i++) {
    const s = S(i); let A = 0;
    for (let j = 0; j < s.length; j++) { const a = s[j], b = s[(j + 1) % s.length]; A += a[0] * b[1] - b[0] * a[1]; }
    const sg = A < 0 ? -1 : 1, p = P[i], o = N[i], u = U[i];
    R.push(s.map(([a, b]) => [p[0] + o[0] * a + u[0] * b, p[1] + o[1] * a + u[1] * b, p[2] + o[2] * a + u[2] * b]));
    // 邊的外法線：逆時針多邊形的邊 (da, db) 往外是 (db, −da)
    E.push(s.map((a, j) => { const b = s[(j + 1) % s.length], da = (b[0] - a[0]) * sg, db = (b[1] - a[1]) * sg, x = o[0] * db - u[0] * da, y = o[1] * db - u[1] * da, z = o[2] * db - u[2] * da, l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; }));
  }
  const tri = (a, b, c, na, nb, nc) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const f = (uy * vz - uz * vy) * (na[0] + nb[0] + nc[0]) + (uz * vx - ux * vz) * (na[1] + nb[1] + nc[1]) + (ux * vy - uy * vx) * (na[2] + nb[2] + nc[2]);
    if (f < 0) { [b, c] = [c, b]; [nb, nc] = [nc, nb]; }
    pos.push(...a, ...b, ...c); nor.push(...na, ...nb, ...nc);
  };
  const m = R[0].length;
  for (let i = 0; i + 1 < n; i++) for (let j = 0; j < m; j++) {
    const j1 = (j + 1) % m, na = E[i][j], nb = E[i + 1][j];
    tri(R[i][j], R[i][j1], R[i + 1][j1], na, na, nb); tri(R[i][j], R[i + 1][j1], R[i + 1][j], na, nb, nb);
  }
  for (const [i, k] of [[0, 1], [n - 1, n - 2]]) {
    const c = R[i].reduce((a, q) => [a[0] + q[0] / m, a[1] + q[1] / m, a[2] + q[2] / m], [0, 0, 0]);
    let t = [P[i][0] - P[k][0], P[i][1] - P[k][1], P[i][2] - P[k][2]]; const l = Math.hypot(...t) || 1; t = t.map(v => v / l);
    for (let j = 0; j < m; j++) tri(c, R[i][j], R[i][(j + 1) % m], t, t, t);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  return this.add(g, color, mat);
};
// 號誌燈的遮光罩：沿 +z 伸出的半開圓筒（下方開口 gap 弧度），雙面要另外補內壁，所以做成有厚度的兩層
Kit.prototype.visor = function (x, y, z, r, len, color, mat = 2, ry = 0, gap = 1.6) {
  const th = Math.PI * 2 - gap, st = Math.PI / 2 + gap / 2;   // CylinderGeometry 的 θ 從 +z 起算；轉成軸朝 z 後開口朝 -y
  for (const [rr, flip] of [[r, false], [r - .008, true]]) {
    const g = new T.CylinderGeometry(rr, rr, len, 8, 1, true, st, th);
    if (flip) { const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i)); g.setIndex(Array.from(g.index.array).reverse()); }
    g.rotateX(Math.PI / 2); g.translate(0, 0, len / 2);
    this.add(g, color, mat, tf(x, y, z, 0, ry, 0));
  }
  return this;
};

// ─── 程式紋理材質 MAT.ux／uxI：和 MAT.uber 一樣是頂點色＋aMat，aMat ≥ 20 時照材質種類在著色器裡畫紋路（不用貼圖檔），
// 座標是幾何自己的座標（實例在實例的框裡、合併烘焙過的網格是世界座標），三面投影取法線最大的那一軸；細紋在遠處依 fwidth 淡掉。
//   20 混凝土（細斑、氣孔、雨水垂流、模板接縫）  21 塗漆的鐵（掉漆、鏽斑與鏽水痕、細刮痕）  22 鍍鋅鋼（鋅花、霧面）
//   23／24／25 木頭，木紋沿 x／y／z（年輪、纖維、髒污）  26 混凝土磚（40×20 cm、灰縫）  27 紅磚（23×7.6 cm、交丁）
//   28 石材（大塊石、斑點）  29 鋼板與立邊屋頂（壓紋、垂流的髒污）  30 橡膠、粗塑膠（細顆粒）
//   31 碳纖維（2×2 斜紋、清漆，66-chrome 的改裝件）  32 燒鈦（排氣尾管的熱變色，金→紫→藍；不看頂點色）
//   33 環氧樹脂地坪（彩色碎片、胎痕、油漬、切割縫）  34 粉體烤漆鋼板（橘皮、手摸髒污、磕掉的漆）  35 室內不鏽鋼（髮絲紋、低反射）  36 洞洞板：66-chrome 改裝廠
//   37 筒瓦  38 石板瓦  39 立邊鋼板：20-roof.js 的斜屋頂（沿坡的鋪面）
//   40 拋光大理石地磚（室內，62.5 cm）  41 室內漆面灰泥牆  42 山坡（21-coast.js）
//   43 板模清水混凝土（15 cm 一道的木模板紋、模板的繫結孔）  44 直向木格柵（9 cm 一根、深色的縫、沿 y 的木紋）  45 洞石（1.2×0.6 m 的板、水平的層紋與孔洞）
//   46 層疊板岩（一片片薄石、深縫）  47 泳池水（流動的水光紋、夜裡池燈打亮）  48 別墅的落地玻璃（白天是映天空的深色玻璃，入夜是暖光的室內：天花的光暈、家具的剪影、有的房間沒開燈）
//   49 簷下的天花（每 1.6 m 一盞崁燈，入夜亮）
//   50 別墅區的山坡（21-coast.js 照 10-city.js 的 HILL_VIL 細分起伏的那幾片）：照片的乾草地與露岩，往外照權重淡回 42（aMat = 50 + 0.4 × 權重，小數內插）
//   texMat 的第三欄進來是 (實例的種子 vIns.z, aMat 的小數 vMat − m, 0)，出去是自發光（47、48、49 用）。43–46、50 另由 texNrm 算照片法線（uVil.y），
//   實例的繞 y 轉角在 vIns.w（50-assets.js 的 HILL_SEED），法線偏移照它轉到世界
// 著色器是 src/tsl/m-uberX.mjs：vP／vNo 是幾何自己的座標（實例在實例的框裡，pGeom_／nGeom_）
function mkUberX(o) { const m = mkUber(o); m.name = 'uberX'; return m; }
MAT.ux = mkUberX(); MAT.uxI = mkUberX({ inst: true }); MAT.uxFI = mkUberX({ inst: true, far: .07, farc: 1 });   // uxFI：遠景的實例（21-coast.js 的石柱峰；霧只算 7% 的距離，鏡頭升高也一樣）
// 材質代號（Kit 的 mat 參數）
const TX = { conc: 20, iron: 21, galv: 22, woodX: 23, woodY: 24, woodZ: 25, cmu: 26, brick: 27, stone: 28, sheet: 29, rubber: 30, carbon: 31, ti: 32, epoxy: 33, enamel: 34, steel: 35, peg: 36, tile: 37, slate: 38, seam: 39, hill: 42, karst: 51, board: 43, slat: 44, trav: 45, ledge: 46, pool: 47, vglass: 48, soffit: 49, vhill: 50 };
