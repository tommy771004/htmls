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
const KX_TEX = /* glsl */`
varying vec3 vP, vNo;
float kxAA(vec2 q){ return 1. - smoothstep(.25, .7, max(fwidth(q.x), fwidth(q.y))); }
float kxFade(float q){ return 1. - smoothstep(.9, 2.6, fwidth(q)); }
vec2 kxUV(vec3 p, vec3 n, out float ax){ vec3 a = abs(n); if (a.y > a.x && a.y > a.z) { ax = 1.; return p.xz; } if (a.x > a.z) { ax = 0.; return vec2(p.z, p.y); } ax = 2.; return p.xy; }
float n3(vec3 p){ float z = floor(p.z); vec2 o = vec2(17.31, 31.73); return mix(n2(p.xy + z * o), n2(p.xy + (z + 1.) * o), smoothstep(0., 1., fract(p.z))); }
float fbm3(vec3 p){ return .5 * n3(p) + .3 * n3(p * 2.07 + 5.1) + .2 * n3(p * 4.3 + 9.7); }
float kxMortar(vec2 q, vec2 sz, float j, out vec2 id){
  vec2 b = q / sz; b.x += step(1., mod(floor(b.y), 2.)) * .5; id = floor(b);
  vec2 f = fract(b), w = j / sz, fw = fwidth(b) * .8 + 1e-4;
  float m = smoothstep(w.y, w.y + fw.y, f.y) * smoothstep(w.x, w.x + fw.x, f.x);
  return mix(.85, m, 1. - smoothstep(.15, .45, fwidth(b.y)));
}
float kxStreak(vec3 p, vec2 uv, float k){ return smoothstep(.5, .85, fbm(vec2(uv.x * k, p.y * .3)) + .25 * n3(p * .7) - .12); }
uniform highp sampler2DArray uFacA; uniform vec4 uFac;   // 08-tex.js 的照片材質（斜屋頂的筒瓦第 5 層、石板瓦第 6 層）
uniform highp sampler2DArray uVilA, uVilN; uniform vec4 uVil;   // 08-tex.js 的別墅區照片材質（VIL_LAYERS：0 板模混凝土 1 雪松木板 2 白砂岩 3 疊石 4 乾土岩坡 5 草地 6 落葉 7 苔土 8 碎石步道；uVil.x 底色、y 法線）
// 43–46 的照片座標（xy）與層（z）：牆面是 (水平, −高)，圖的上方朝上；頂面照 xz。每棟（實例的種子 sd）錯開起點
vec3 kxVilQ(int m, vec3 p, vec2 uv, float ax, float sd){
  float L = m == 44 ? 1. : m == 46 ? 3. : 0., sc = m == 43 ? 2.3 : m == 44 ? .75 : m == 45 ? 1.7 : 1.6;   // 洞石借混凝土那張的細孔（砂岩塊的照片縫太密，像磚），板縫與層紋照舊程式畫
  vec2 q = ax == 1. ? uv : vec2(uv.x, -p.y);
  return vec3(q / sc + fract(vec2(sd * .131, sd * .287)), L);
}
// 照片的明暗與色彩變化乘在原本的底色上（除以整張的平均色＝最小一級 mipmap），模型上設計的色調不變；chroma 是留幾成照片自己的色彩
vec3 kxVil(vec3 alb, vec3 q, float chroma){
  vec3 t = texture(uVilA, q).rgb, mu = textureLod(uVilA, q, 10.).rgb, r = t * t / max(mu * mu, vec3(.003));
  return alb * mix(vec3(dot(r, vec3(.3, .5, .2))), r, chroma);
}
// 別墅區山坡（50）露岩的比例：陡處，加上幾十公尺一片的岩盤
// 外緣山林與別墅區的林地（vil 陣列 5 草地、6 落葉、7 苔土）：00-core.js 的山林樹冠圖（uFMap，鏡頭附近 1 km）有樹冠的地方是落葉（邊上 2.5 m 漸變），
// 林間是苔土，大片的空地是草；兩種尺度照雜訊換著用，遠處收成整張的平均色（同 50 的草地）。照片是 sRGB，平方當成線性
vec3 kxFloor(vec2 q, float dc){
  vec2 fu = (q + (vec2(n2(q * .31), n2(q * .31 + 7.3)) - .5) * 6. - uFM.xy) * uFM.z, e1 = vec2(2.5 * uFM.z, 0.), e2 = vec2(0., 2.5 * uFM.z);
  float cv = .25 * (step(1., textureLod(uFMap, fu + e1, 0.).r) + step(1., textureLod(uFMap, fu - e1, 0.).r) + step(1., textureLod(uFMap, fu + e2, 0.).r) + step(1., textureLod(uFMap, fu - e2, 0.).r));
  cv = uFM.w > 0. ? smoothstep(.1, .9, cv) : .5;
  float fd = smoothstep(10., 70., dc) * .85 + smoothstep(90., 220., dc) * .15, bl = smoothstep(.35, .65, fbm(q * .09 + 4.1));
  vec3 lit = mix(mix(texture(uVilA, vec3(q / 2.2, 6.)).rgb, texture(uVilA, vec3(q / 6.9 + .29, 6.)).rgb, bl), textureLod(uVilA, vec3(q, 6.), 10.).rgb, fd);
  vec3 mos = mix(mix(texture(uVilA, vec3(q / 2.6, 7.)).rgb, texture(uVilA, vec3(q / 7.3 + .41, 7.)).rgb, bl), textureLod(uVilA, vec3(q, 7.), 10.).rgb, fd);
  vec3 grs = mix(mix(texture(uVilA, vec3(q / 2.3, 5.)).rgb, texture(uVilA, vec3(q / 8.1 + .53, 5.)).rgb, bl), textureLod(uVilA, vec3(q, 5.), 10.).rgb, fd);
  lit *= lit; mos *= mos; grs *= grs;
  // 草與苔土的照片本身是枯黃的（sparse_grass 是乾草地），只取明暗、重新上色成林下的綠；落葉保留原色但壓暗
  float lg = dot(grs, vec3(.3, .55, .15)) / .053, lm = dot(mos, vec3(.3, .55, .15)) / .138;   // 分母是兩張照片的平均亮度（平方後）
  grs = vec3(.07, .105, .035) * lg; mos = vec3(.06, .07, .035) * lm; lit = mix(vec3(dot(lit, vec3(.3, .55, .15))), lit, .75) * .36;
  // 樹冠下是落葉與苔土，空地是草（草裡零星幾塊苔土）；cv 是附近 2.5 m 的樹冠，cw 是 9 m 內（樹冠外一圈還有落葉）；取樣點照雜訊抖幾公尺，樹冠圖 2 m 一格的方塊才不會印在地上
  float cw = .25 * (step(1., textureLod(uFMap, fu + e1 * 3.6, 0.).r) + step(1., textureLod(uFMap, fu - e1 * 3.6, 0.).r) + step(1., textureLod(uFMap, fu + e2 * 3.6, 0.).r) + step(1., textureLod(uFMap, fu - e2 * 3.6, 0.).r));
  cw = uFM.w > 0. ? max(cv, cw * .7) : .5;
  vec3 under = mix(mos, lit, smoothstep(.2, .5, n2(q * .21) * .6 + n2(q * .7 + 1.3) * .4 + cv * .35));   // 落葉比苔土多
  float op = (1. - smoothstep(.15, .75, cw)) * (1. - .45 * smoothstep(.55, .7, fbm(q * .05 + 2.6)));
  return mix(under, grs, op);
}
// 林地的露岩：只有真的陡（約 50° 以上，10-city.js 那裡不種樹）才整片是岩，緩坡上零星幾塊岩盤（kxRock 是別墅區的乾坡用的，山林的坡普遍 30° 上下，照它會整片黃土）
float kxCrag(vec3 p, vec3 n){ return clamp(smoothstep(.68, .56, n.y) + smoothstep(.76, .86, fbm(p.xz * .045 + 3.7)) * .5, 0., 1.); }
float kxRock(vec3 p, vec3 n){ return clamp(smoothstep(.9, .72, n.y) + smoothstep(.62, .78, fbm(p.xz * .045 + 3.7)) * .7, 0., 1.); }
// 43–46、50 的照片法線：回傳要加到法線上的偏移（幾何自己的座標，呼叫處再照實例的轉角轉到世界）與粗糙度（w，負的是不改）。
// io 和 texMat 的第三欄一樣：(種子, 50 的別墅區權重 × 0.4, 0)。切線：牆面是 (水平, 上)，頂面是 (x, −z)（圖往下是 +z）
vec4 texNrm(int m, vec3 p, vec3 n, vec3 io){
  float ax; vec2 uv = kxUV(p, n, ax);
  vec3 Tg = ax == 0. ? vec3(0., 0., 1.) : vec3(1., 0., 0.), Bg = ax == 1. ? vec3(0., 0., -1.) : vec3(0., 1., 0.);
  vec4 t; float k = m == 44 ? .7 : 1., rough;
  if (m == 42 || m == 50) {   // 林地（苔土與落葉照 kxFloor 的同一個雜訊換），陡處換岩坡；42 只在鏡頭附近（texMat 換成照片的範圍）
    vec2 q = p.xz; float dc = length(uCam - p);
    vec4 g = mix(texture(uVilN, vec3(q / 2.6, 7.)), texture(uVilN, vec3(q / 2.2, 6.)), smoothstep(.3, .6, n2(q * .21) * .6 + n2(q * .7 + 1.3) * .4));
    t = mix(g, texture(uVilN, vec3(q / 4. + .37, 4.)), kxCrag(p, n));
    k = max(clamp(io.y / .4, 0., 1.), 1. - smoothstep(220., 330., dc)) * 1.2 * (1. - smoothstep(10., 150., dc)); Tg = vec3(1., 0., 0.); Bg = vec3(0., 0., -1.); rough = -1.;
  } else {
    t = texture(uVilN, kxVilQ(m, p, uv, ax, io.x + (m == 44 ? floor(uv.x / .09) * .37 : 0.)));   // 木格柵每根錯開（同 texMat）
    rough = m == 45 ? mix(.35, .7, t.b) : m == 44 ? mix(.5, .8, t.b) : mix(.65, 1., t.b);
  }
  return vec4((Tg * (t.r * 2. - 1.) + Bg * (t.g * 2. - 1.)) * k, rough);
}
// 進出都是 mat3(alb, vec3(rough, metal, envK), 0)：沒有 out／inout，WebGPU 編成一個函式，不在呼叫處展開
mat3 texMat(int m, vec3 p, vec3 n, mat3 io){
  vec3 alb = io[0]; float rough = io[1].x, metal = io[1].y, envK = io[1].z, sd = io[2].x; vec3 emi = vec3(0.);
  float ax; vec2 uv = kxUV(p, n, ax);
  float vert = ax == 1. ? 0. : 1., up = smoothstep(.6, .95, n.y);
  if (m == 20) {   // 混凝土
    float aa = kxAA(uv * 40.);
    alb *= .74 + .4 * fbm3(p * 1.6) + aa * (n2(uv * 40.) - .5) * .22;
    alb *= 1. - .4 * aa * step(.93, n2(uv * 61.));
    alb *= 1. - .32 * vert * kxStreak(p, uv, 2.4);
    float fl = vert * clamp(smoothstep(.012, 0., abs(fract(uv.x / 1.22) - .5) - .488) + smoothstep(.01, 0., abs(fract(p.y / .61) - .5) - .49), 0., 1.);
    alb *= 1. - .16 * fl * kxAA(uv * 3.);
    alb = mix(alb, alb * vec3(.82, .86, .8), up * smoothstep(.45, .75, fbm3(p * 3.)));   // 頂面的青苔髒污
    rough = .9;
  } else if (m == 21) {   // 塗漆的鐵：粉化褪色、掉漆露底、鏽斑與往下流的鏽水
    float r = fbm3(p * 2.6 + 7.) + .14 * n3(p * 23.) + vert * .3 * smoothstep(.55, .9, fbm(vec2(uv.x * 7., p.y * .5)));
    float rust = smoothstep(.6, .74, r), halo = smoothstep(.5, .62, r) - rust;
    alb = mix(alb, vec3(.11, .1, .09), .35 * fbm3(p * 1.3 + 2.));
    alb = mix(alb, alb * vec3(.75, .62, .5), halo * .7);
    alb = mix(alb, mix(vec3(.16, .055, .02), vec3(.3, .13, .04), n3(p * 31.)), rust * .9);
    float aa = kxAA(uv * 30.), chip = step(.84, n3(p * 34.)) * aa * (1. - rust);
    alb = mix(alb, vec3(.2, .2, .19), chip * .8);
    alb *= .9 + .2 * aa * n2(uv * vec2(90., 6.));
    rough = mix(.45, .9, max(rust, .5 * chip)); metal = mix(.45, .05, rust); envK = .28 * (1. - rust);
  } else if (m == 22) {   // 鍍鋅鋼
    float sp = h21(floor(uv * 16.)), d = fbm3(p * 1.3 + 3.);
    alb *= (.84 + .3 * sp * kxAA(uv * 16.)) * (.78 + .36 * d);
    alb = mix(alb, vec3(.26, .25, .22), .3 * smoothstep(.55, .8, fbm3(p * 4.)));   // 白鏽
    alb *= 1. - .25 * vert * kxStreak(p, uv, 4.);
    rough = .32 + .32 * d; metal = .85; envK = .55;
  } else if (m >= 23 && m <= 25) {   // 木頭：沿紋的纖維條紋、細年輪線、板間色差、頂面曬白
    vec3 A = m == 23 ? vec3(1, 0, 0) : m == 24 ? vec3(0, 1, 0) : vec3(0, 0, 1);
    float along = dot(p, A);
    vec3 t = cross(n, A); float tl = length(t);
    float cr = tl > .3 ? dot(p, t / tl) : length(p - along * A) * 1.3;
    float warp = fbm(vec2(along * .35, cr * 4.)) * 5.;
    float streak = fbm(vec2(along * .7, cr * 26. + warp));
    float g = cr * 160. + warp * 6.;
    float lines = smoothstep(.55, .95, abs(sin(g))) * kxFade(g);
    alb *= .56 + .62 * streak;
    alb *= 1. - .24 * lines;
    alb *= .82 + .3 * n2(vec2(along * .25, cr * 2.5));
    float knot = smoothstep(.06, .0, length(vec2(fract(along * .55) - .5, (fract(cr * 3.3) - .5) * .4))) * step(.7, h21(floor(vec2(along * .55, cr * 3.3))));
    alb *= 1. - .5 * knot;
    alb = mix(alb, vec3(.24, .22, .2), up * .35 * smoothstep(.4, .75, fbm3(p * 2.)));
    rough = .8;
  } else if (m == 26 || m == 27) {   // 混凝土磚、紅磚
    vec2 id; float q = m == 26 ? kxMortar(vec2(uv.x, p.y), vec2(.4, .2), .012, id) : kxMortar(vec2(uv.x, p.y), vec2(.23, .076), .01, id);
    if (ax == 1.) { q = 1.; id = floor(uv * 3.); }
    float bv = h21(id + 3.7);
    alb *= mix(.58, 1., q) * (m == 26 ? .86 + .2 * bv : .74 + .42 * bv) * (.84 + .26 * fbm3(p * 3.));
    alb *= 1. - .25 * vert * kxStreak(p, uv, 3.);
    rough = .9;
  } else if (m == 28) {   // 石材
    vec2 id; float q = kxMortar(ax == 1. ? uv : vec2(uv.x, p.y), vec2(.62, .31), .015, id);
    float bv = h21(id + 1.3);
    alb *= mix(.58, 1., q) * (.76 + .38 * bv) * (.84 + .28 * n2(uv * 23.) * kxAA(uv * 23.)) * (.88 + .22 * fbm3(p * 2.));
    rough = .85;
  } else if (m == 29) {   // 鋼板：霧面、雨痕
    alb *= .82 + .3 * fbm3(p * 2.2);
    alb = mix(alb, vec3(.1, .1, .095), .25 * fbm3(p * .9 + 4.));
    alb *= 1. - .35 * vert * kxStreak(p, uv, 5.);
    rough = .55; metal = .35; envK = .35;
  } else if (m == 31) {   // 碳纖維：每束 6 mm 的 2×2 斜紋（每兩格換方向），兩個方向的纖維反光不同、束的斷面是圓的；外面一層清漆
    vec2 q = uv / .006, c = floor(q), f = fract(q);
    float d = mod(floor((c.x + c.y) * .5), 2.), a = d > .5 ? f.y : f.x, aa = kxAA(q);
    alb *= mix(1.3, (d > .5 ? 1.9 : .8) * (.55 + .45 * sin(a * 3.1416)), aa);
    rough = .2; envK = .45;
  } else if (m == 32) {   // 燒鈦：沿管子方向（z）的熱變色
    float t = fract(p.z * 3.2 + .12 * fbm3(p * 9.));
    vec3 a = vec3(.62, .5, .3), b = vec3(.36, .2, .5), c = vec3(.2, .34, .62);
    alb = t < .5 ? mix(a, b, t * 2.) : mix(b, c, t * 2. - 1.);
    rough = .2; metal = 1.; envK = .9;
  } else if (m == 33) {   // 環氧樹脂地坪：彩色碎片、大片色差、沿車道（z）的胎痕、油漬（更亮更暗）、每 6 m 一道切割縫、細刮痕
    float aa = kxAA(uv * 220.), c = h21(floor(uv * 220.));
    alb *= .86 + .22 * fbm3(p * .35);
    alb = mix(alb, c > .5 ? vec3(.75, .76, .78) : vec3(.12, .13, .15), step(.9, abs(c - .5) * 2.) * aa * .5);
    float tire = smoothstep(.62, .82, fbm(vec2(uv.x * 2.6, uv.y * .12)) + .3 * fbm(vec2(uv.x * 9., uv.y * .4)) - .15);
    alb *= 1. - .3 * tire * up;
    float oil = max(smoothstep(.78, .84, fbm3(vec3(uv * .45, 3.1)) + .06 * n2(uv * 7.)), .8 * smoothstep(.955, .985, n2(uv * 2.3 + 7.)));
    alb = mix(alb, alb * vec3(.62, .6, .58), oil * up);
    float jt = max(smoothstep(.006, 0., abs(fract(uv.x / 6. + .5) - .5) * 6. - .004), smoothstep(.006, 0., abs(fract(uv.y / 6. + .5) - .5) * 6. - .004));
    alb *= 1. - .55 * jt * up * kxAA(uv * 2.);
    float scr = smoothstep(.985, 1., n2(vec2(uv.x * 3. + uv.y * 40., uv.y * 1.5))) * kxAA(uv * 40.);
    alb = mix(alb, alb * 1.35 + .03, scr * up);
    rough = mix(.26 + .2 * tire, .12, oil); envK = .03 + .04 * oil;   // 室內：環境貼圖是城市夜景，地坪在斜看時會映出一格格霓虹，光澤留給點光的高光
  } else if (m == 34) {   // 粉體烤漆鋼板（工具櫃、升降機、鋼柱）：橘皮微紋、半光、手摸的髒污、少量磕掉的漆露出灰底、接地的地方較髒
    float aa = kxAA(uv * 80.);
    alb *= .94 + .1 * aa * n2(uv * 80.) + .1 * (fbm3(p * 1.8) - .5);
    alb = mix(alb, alb * .55, (1. - smoothstep(.0, .35, p.y)) * vert * .6);
    alb = mix(alb, alb * vec3(.7, .68, .64), .4 * smoothstep(.62, .8, fbm3(p * 5. + 2.)) * vert);
    float chip = step(.97, n3(p * 40.)) * smoothstep(.55, .7, fbm3(p * 2.3 + 5.)) * kxAA(uv * 40.);
    alb = mix(alb, vec3(.3, .3, .29), chip * .8);
    rough = mix(.34, .7, chip) + .1 * fbm3(p * 3.); metal = .15; envK = .05 * (1. - chip);   // 室內：環境貼圖是城市夜景，反射高了會在大片烤漆上映出色塊
  } else if (m == 35) {   // 室內的不鏽鋼：沿 x 的髮絲紋、指紋與油污；環境反射壓低（室內會映出城市環境貼圖的色塊）
    float aa = kxAA(vec2(uv.x * 4., uv.y * 400.));
    alb *= .86 + .14 * fbm3(p * 2.) + .1 * aa * (n2(vec2(uv.x * 4., uv.y * 400.)) - .5);
    alb = mix(alb, alb * .72, .35 * smoothstep(.6, .85, fbm3(p * 6. + 1.)));
    rough = .3 + .16 * fbm3(p * 4.); metal = .7; envK = .06;
  } else if (m == 36) {   // 洞洞板：2.54 cm 間距的圓孔（遠處淡成較暗的平均色）、手摸的髒污
    vec2 q = uv / .0254, f = fract(q) - .5; float aa = kxAA(q);
    float hole = 1. - smoothstep(.16, .23, length(f));
    alb *= mix(.84, 1. - .85 * hole, aa) * (.88 + .18 * fbm3(p * 2.5));
    rough = .85;
  } else if (m == 40) {   // 拋光大理石地磚（室內）：62.5 cm 方磚（對齊 2.5 m 的分割線），每塊的色調與石紋方向不同、扭曲的石紋、細灰縫；磨亮的低粗糙度，環境反射壓低（光澤留給點光）
    vec2 q = uv / .625, id = floor(q), f = fract(q);
    float hv = h21(id + 2.7), ang = hv * 6.2832, aa = kxAA(uv * 30.);
    vec2 r = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * (uv * 1.7) + id * 3.1;
    float w = fbm(r * .9 + fbm(r * 2.3) * 1.6);
    float vein = smoothstep(.06, 0., abs(sin((r.x + w * 2.4) * 2.6)) - .02) * (.5 + .5 * fbm(r * 4.));
    alb *= (.9 + .16 * hv) * (.93 + .12 * w);
    alb = mix(alb, alb * vec3(.55, .53, .52), vein * .55 * aa);
    float g = min(min(f.x, 1. - f.x), min(f.y, 1. - f.y)), grout = (1. - smoothstep(.004, .009, g)) * kxAA(q);
    alb = mix(alb, alb * .55, grout);
    rough = mix(.14, .5, grout) + .08 * fbm3(p * 3.); envK = .05;
  } else if (m == 41) {   // 室內漆面灰泥牆：大片的深淺、滾筒的細紋、牆腳的磨痕與髒污、手常摸的高度一圈淡淡的油污
    alb *= .92 + .1 * fbm3(p * .8) + .05 * kxAA(uv * 60.) * (n2(uv * 60.) - .5);
    alb *= 1. - vert * .22 * (1. - smoothstep(0., .45, p.y)) * (.6 + .4 * fbm(vec2(uv.x * 3., p.y * 6.)));
    alb *= 1. - vert * .06 * smoothstep(.85, 1.1, p.y) * smoothstep(1.6, 1.3, p.y) * fbm(vec2(uv.x * 1.4, 1.));
    rough = .88;
  } else if (m >= 37 && m <= 39) {   // 屋頂（20-roof.js）：a 沿屋脊、b 沿坡往上（高度除以坡的正弦，鋪面的間距照坡面量）；平的部分（復折式屋頂的頂）照 xz
    float sl = length(n.xz); vec2 dS = sl > .05 ? n.xz / sl : vec2(0., 1.);
    float a = dot(p.xz, vec2(-dS.y, dS.x)), b = sl > .05 ? p.y / max(sl, .25) : dot(p.xz, dS);
    vec3 hue = alb / max(dot(alb, vec3(.3, .5, .2)), .02);   // 地塊抽到的顏色只留色相，照片材質淡淡染上
    if (m <= 38 && uFac.x > .5) {   // 照片材質（08-tex.js）：陶筒瓦 2.9 m、石板瓦 2 m 一張
      vec3 t = texture(uFacA, vec3(vec2(a, b) / (m == 37 ? 2.9 : 2.), m == 37 ? 5. : 6.)).rgb;
      alb = t * t; alb = mix(vec3(dot(alb, vec3(.3, .5, .2))), alb, m == 37 ? .7 : 1.) * mix(vec3(1.), hue, .2);   // 陶瓦照片偏紅，收一點飽和
      rough = m == 37 ? .72 : .55; envK = m == 37 ? 0. : .1;
    } else if (m == 37) {   // 筒瓦：一列列半圓的陶瓦（弧面明暗）、每排下緣的陰影、每片色差、青苔與雨後的髒污
      vec2 q = vec2(a / .23, b / .34), id = floor(q), f = fract(q); float aa = kxAA(q);
      float barrel = sin(f.x * 3.1416), lip = smoothstep(.78, 1., f.y);
      alb *= mix(.86, (.6 + .5 * barrel) * (1. - .38 * lip), aa) * (.76 + .44 * h21(id + 4.2));
      alb = mix(alb, alb * vec3(.66, .72, .55), .55 * smoothstep(.55, .85, fbm3(p * 1.4)));
      rough = .72;
    } else if (m == 38) {   // 石板瓦：交丁的長方片、片間的縫、每片深淺不同，微微反光
      vec2 id; float q = kxMortar(vec2(a, b), vec2(.3, .16), .012, id);
      alb *= mix(.5, 1., q) * (.78 + .38 * h21(id + 2.1)) * (.86 + .2 * fbm3(p * 2.));
      rough = .55; envK = .1;
    } else {   // 立邊鋼板：每 48 cm 一道立起的接縫（亮邊）、沿坡往下的雨痕與鏽
      float d = abs(fract(a / .48) - .5), aa = kxAA(vec2(a / .48, 1.));
      alb *= mix(1., (1. + .3 * smoothstep(.45, .49, d)) * (1. - .25 * smoothstep(.4, .45, d) * (1. - smoothstep(.45, .47, d))), aa);
      alb *= (.82 + .28 * fbm3(p * 1.2)) * (1. - .25 * smoothstep(.55, .85, fbm(vec2(a * 3., b * .4))));
      alb = mix(alb, vec3(.2, .09, .04), .3 * smoothstep(.62, .8, fbm3(p * 2.3 + 6.)));
      rough = .45; metal = .55; envK = .3;
    }
    // 三種共用、遠處也看得到的舊化：幾公尺大小的深淺斑塊、日曬褪色（往灰拉）
    alb *= .78 + .36 * fbm3(p * .21 + 9.);
    alb = mix(alb, vec3(dot(alb, vec3(.3, .5, .2))), .25 + .2 * fbm3(p * .37 + 3.));
  } else if (m == 42 || m == 50) {   // 山坡（21-coast.js 的山網格，一格上百公尺）：頂點色是林線的底色；林冠一團團（亮的樹頂、暗的樹間）、幾十公尺的草坡、陡坡露岩、大片的深淺。遠處的林冠淡成平均色
    alb = mix(alb * .55, vec3(.05, .06, .035), .35);   // 外緣山林：林下的地面比原本的乾坡暗、偏橄欖綠（樹是另外擺的，見 10-city.js 的 HILL_FOREST）
    float aa = kxAA(p.xz * .22), crown = n2(p.xz * .22) * .6 + n2(p.xz * .57 + 3.1) * .4;
    float meadow = smoothstep(.58, .72, fbm(p.xz * .006 + 2.)), steep = smoothstep(.8, .6, n.y);
    vec3 forest = mix(alb * .95, alb * mix(.55, 1.35, smoothstep(.25, .8, crown)), aa);
    vec3 grass = vec3(.075, .085, .035) * (.8 + .4 * fbm(p.xz * .05)), rock = vec3(.11, .105, .095) * (.7 + .5 * fbm3(p * .3));
    alb = mix(forest, grass, meadow * (1. - steep) * .85);
    alb = mix(alb, rock, steep * (.6 + .4 * fbm(p.xz * .03)));
    alb *= .85 + .3 * fbm(p.xz * .0015 + 5.);
    rough = .95; envK = 0.;
    // 鏡頭 330 m 內的山坡（42）與別墅區細分過的山坡（50，10-city.js 的 HILL_VIL；權重是 io 第三欄的 y／0.4）：林地照片（kxFloor：落葉、苔土、草），
    // 陡處與岩盤露出乾土岩坡的照片；外面淡回上面的程式林坡，範圍的邊緣照雜訊參差
    float dc = length(uCam - p), wf = max(clamp(io[2].y / .4, 0., 1.), 1. - smoothstep(220., 330., dc));
    if (uVil.x > .5 && wf > 0.) {
      vec2 q = p.xz; float rk = kxCrag(p, n), fd = smoothstep(10., 70., dc) * .85 + smoothstep(90., 220., dc) * .15;
      vec3 r = mix(texture(uVilA, vec3(q / 4. + .37, 4.)).rgb, textureLod(uVilA, vec3(q, 4.), 10.).rgb, fd * .8);
      r *= r; r = mix(vec3(dot(r, vec3(.3, .55, .15))), r, .35) * vec3(.95, .97, 1.05);   // 岩坡的照片是黃土色，收成灰岩
      vec3 grd = mix(kxFloor(q, dc), r, rk) * (.6 + .3 * fbm(q * .017 + 1.3));
      alb = mix(alb, grd, clamp(wf * (.55 + .9 * fbm(q * .012 + 8.)), 0., 1.));
    }
  } else if (m == 51) {   // 石柱峰（hill_homes.py 的 karst，柱軸是幾何的 y）：灰色石灰岩、縱向的裂隙與黑色水痕、一層層的層理，平台與緩處長苔
    float az = atan(p.z, p.x) * 6., vf = fbm(vec2(az * .5, p.y * .03));
    float crack = smoothstep(.82, .97, abs(sin(az * 1.3 + vf * 4.)));
    float streak = smoothstep(.42, .72, fbm(vec2(az * 1.9, p.y * .012 + vf)));
    float strata = smoothstep(.93, 1., abs(sin(p.y * .37 + vf * 5.))) * smoothstep(.3, .6, fbm(vec2(az * .7, p.y * .05)));   // 層理斷斷續續，不排成格子
    alb *= (.5 + .35 * fbm(vec2(az * 3.1, p.y * .21))) * vec3(.92, .94, .97);
    alb = mix(alb, alb * vec3(.22, .21, .2), clamp(streak * .8 + crack * .5, 0., 1.));
    alb *= 1. - .22 * strata;
    float moss = clamp(smoothstep(.4, .8, n.y) + smoothstep(.62, .78, fbm(vec2(az * 4.3, p.y * .27) + 3.)) * .45, 0., 1.);
    alb = mix(alb, vec3(.045, .06, .03), moss * .85);
    rough = .93;
  } else if (m == 43) {   // 板模清水混凝土：水平的木模板（每片深淺、木紋印子）、模板間的細縫、60 cm 一格的繫結孔、雨水的垂流
    float h = ax == 1. ? uv.y : p.y, bd = floor(h / .15), aa = kxAA(vec2(uv.x * 8., h / .15));
    float pv = uVil.x > .5 ? .5 : 1.;   // 照片材質（板模混凝土的照片）在的時候，程式的模板紋減半
    if (uVil.x > .5) alb = kxVil(alb, kxVilQ(m, p, uv, ax, sd), .25) * (.92 + .16 * h21(vec2(bd, floor(uv.x / 2.4))));
    else {
      alb *= .8 + .2 * h21(vec2(bd, floor(uv.x / 2.4))) + .1 * fbm3(p * 1.3);
      alb *= 1. - .1 * aa * smoothstep(.5, .9, fbm(vec2(uv.x * 1.6, h * 30. + bd * 7.)));   // 模板的木紋
    }
    alb *= 1. - .22 * pv * vert * aa * smoothstep(.06, .0, abs(fract(h / .15) - .5) - .44);
    alb *= 1. - .5 * vert * kxAA(uv * 3.) * smoothstep(.03, .015, length(vec2(fract(uv.x / .6) - .5, (fract(h / .6) - .5)) * .6));
    alb *= 1. - .2 * vert * kxStreak(p, uv, 2.);
    rough = .82;
  } else if (m == 44) {   // 直向木格柵：每根 9 cm、根與根之間深色的縫、每根色差、沿 y 的木紋
    float a = ax == 1. ? uv.x : uv.x, sl = a / .09, id = floor(sl), aa = kxAA(vec2(sl, p.y * 4.));
    alb *= .7 + .45 * h21(vec2(id, 3.1));
    if (uVil.x > .5) alb = kxVil(alb, kxVilQ(m, p, uv, ax, sd + id * .37), .35);   // 照片的木紋，每根錯開
    else alb *= .78 + .3 * fbm(vec2(fract(sl) * 3. + id * 7., p.y * 1.5));
    alb *= 1. - .85 * vert * aa * smoothstep(.12, .05, abs(fract(sl) - .5) - .38);
    rough = .62; envK = .04;
  } else if (m == 45) {   // 洞石：1.2×0.6 m 的板（細縫、每片色差）、水平的層紋、小孔洞
    vec2 q = ax == 1. ? uv : vec2(uv.x, p.y), id = floor(q / vec2(1.2, .6)), f = fract(q / vec2(1.2, .6));
    float aa = kxAA(q * 12.), vein = fbm(vec2(q.x * .4 + id.y * 3., q.y * 9. + fbm(q * 1.5) * 2.));
    alb *= .86 + .2 * h21(id + 2.3);
    alb *= .82 + .3 * smoothstep(.3, .7, vein);
    if (uVil.x > .5) alb = kxVil(alb, kxVilQ(m, p, uv, ax, sd), 0.);   // 照片：石面的細孔與起伏（混凝土那張，只取明暗）
    else alb *= 1. - .35 * aa * step(.86, n2(q * vec2(30., 60.)));
    alb *= 1. - .3 * kxAA(q * 3.) * (1. - smoothstep(.0, .008 / .6, min(min(f.x, 1. - f.x) * 2., min(f.y, 1. - f.y))));
    rough = .5; envK = .08;
  } else if (m == 46) {   // 層疊板岩：一片片薄石（厚 4–11 cm、長 20–60 cm），片與片之間深縫，每片深淺與色調不同
    vec2 q = ax == 1. ? uv : vec2(uv.x, p.y);
    float row = floor(q.y / .075), th = .075, sh = h21(vec2(row, 1.7)) * 3.;
    float len = .2 + .4 * h21(vec2(row, 4.1)), x = q.x / len + sh, id = floor(x);
    float fy = fract(q.y / th), fx = fract(x), aa = kxAA(vec2(x, q.y / th));
    float gap = (1. - smoothstep(.0, .14, fy)) + (1. - smoothstep(.0, .05 / len * .2, min(fx, 1. - fx)));
    float tone = h21(vec2(id, row));
    if (uVil.x > .5) alb = kxVil(alb, kxVilQ(m, p, uv, ax, sd), .5);   // 照片：一顆顆疊起來的石塊與深縫
    else {
      alb *= mix(vec3(.8), mix(vec3(1.05, .95, .82), vec3(.85, .88, .92), step(.5, h21(vec2(row, id + 9.)))), .6) * (.6 + .6 * tone);
      alb *= 1. - .75 * aa * clamp(gap, 0., 1.);
    }
    rough = .88;
  } else if (m == 47) {   // 泳池水：兩層流動的水光紋（亮的網紋），白天映天空，入夜池燈從水裡打亮
    float t = uTime * .35;
    float c1 = n2(uv * 1.7 + vec2(t, t * .7)), c2 = n2(uv * 2.9 - vec2(t * .8, t * .4));
    float caus = pow(1. - abs(c1 + c2 - 1.), 6.) * kxAA(uv * 3.);
    alb = alb * (.75 + .5 * caus);
    rough = .05; envK = .55;
    emi = alb * (.35 + .9 * caus) * uLampOn * 1.3;
  } else if (m == 48) {   // 別墅的落地玻璃：白天是映天空的深色玻璃，入夜是暖光的室內（每 3.3 m 一層、3.2 m 一間，間間不同、有的沒開燈）
    float fl = floor(p.y / 3.3), fy = fract(p.y / 3.3), rm = floor(uv.x / 3.2);
    vec2 id = vec2(rm + sd * 17., fl + float(ax) * 5.);
    float on = step(.3, h21(id)), tk = h21(id + 4.7);
    vec3 tint = mix(vec3(1., .66, .38), vec3(1., .84, .62), tk);
    float lit = .18 + .75 * smoothstep(.62, .97, fy) + .3 * n2(vec2(uv.x * .8, fl)) * (.5 + .5 * tk);
    float furn = mix(1., .25, step(fy, .3) * step(.45, n2(vec2(uv.x * 1.3 + sd, fl * 3.))));   // 沙發、桌子的剪影
    float curt = step(.75, h21(id + 1.9));   // 拉上窗簾的房間：均勻柔光
    lit = mix(lit * furn, .75, curt);
    alb = vec3(.022, .026, .03); rough = .05; metal = 0.; envK = 1.;
    emi = tint * on * lit * uLampOn * (.2 + .18 * h21(id + 8.3));   // 原本 0.45–0.85 整面窗白成一片
  } else if (m == 49) {   // 簷下與樓板下的天花：白色灰泥，每 1.6 m 一盞崁燈（白天是小圓框，入夜亮起，周圍一圈暖光）
    vec2 g = fract(p.xz / 1.6) - .5; float d = length(g) * 1.6, dn = step(n.y, -.5);
    float dotL = smoothstep(.075, .055, d) * dn, halo = exp(-d * d * 3.) * dn;
    alb *= .9 + .1 * fbm3(p * 2.) - .25 * dotL;
    rough = .9;
    emi = vec3(1., .78, .52) * (dotL * 2.6 + halo * .22) * uLampOn;
  } else {   // 橡膠、粗塑膠：細顆粒、灰塵讓深色也看得出起伏
    alb = mix(alb, vec3(.075, .072, .068), .3 * fbm3(p * 4.) + .25 * up);
    alb *= .88 + .2 * n2(uv * 60.) * kxAA(uv * 60.);
    rough = .78;
  }
  return mat3(alb, vec3(rough, metal, envK), emi);
}
`;
// vP／vNo 是幾何自己的座標（實例在實例的框裡）：GEOM_POS／GEOM_NRM 在 WebGL 是 position／normal，WebGPU 的轉譯器換成套實例矩陣之前的 positionGeometry／normalGeometry
const UBERX_VS = '#ifndef GEOM_POS\n#define GEOM_POS position\n#define GEOM_NRM normal\n#endif\n' + UBER_VS.replace('varying vec3 vW, vN, vCol;', 'varying vec3 vP, vNo; varying vec3 vW, vN, vCol;').replace('vCol = color; vMat = aMat;', 'vCol = color; vMat = aMat; vP = GEOM_POS; vNo = GEOM_NRM;');
const UBERX_FS = UBER_FS.replace('void main(){', KX_TEX + 'void main(){').replace('if (m == 0) { rough = .22; envK = .75; }', 'if (m >= 20) { vec3 tio = vec3(vIns.z, vMat - float(m), 0.); mat3 tm = texMat(m, vP, normalize(vNo), mat3(alb, vec3(rough, metal, envK), tio)); alb = tm[0]; rough = tm[1].x; metal = tm[1].y; envK = tm[1].z; emi = tm[2];\n'
  + '    if (uVil.y > .5 && (m >= 43 && m <= 46 || m == 42 || m == 50)) { vec4 tn = texNrm(m, vP, normalize(vNo), tio); float ca = cos(vIns.w), sa = sin(vIns.w); n = normalize(n + vec3(ca * tn.x + sa * tn.z, tn.y, ca * tn.z - sa * tn.x)); if (tn.w >= 0.) rough = tn.w; } }\n  else if (m == 0) { rough = .22; envK = .75; }');
if (UBERX_VS === UBER_VS || !UBERX_FS.includes('texMat(m,')) console.warn('kitx: uber shader patch did not apply');
function mkUberX(o) { const m = mkUber(o); m.name = 'uberX'; m.vertexShader = UBERX_VS; m.fragmentShader = UBERX_FS; return m; }
MAT.ux = mkUberX(); MAT.uxI = mkUberX({ inst: true }); MAT.uxFI = mkUberX({ inst: true, far: .07, farc: 1 });   // uxFI：遠景的實例（21-coast.js 的石柱峰；霧只算 7% 的距離，鏡頭升高也一樣）
// 材質代號（Kit 的 mat 參數）
const TX = { conc: 20, iron: 21, galv: 22, woodX: 23, woodY: 24, woodZ: 25, cmu: 26, brick: 27, stone: 28, sheet: 29, rubber: 30, carbon: 31, ti: 32, epoxy: 33, enamel: 34, steel: 35, peg: 36, tile: 37, slate: 38, seam: 39, hill: 42, karst: 51, board: 43, slat: 44, trav: 45, ledge: 46, pool: 47, vglass: 48, soffit: 49, vhill: 50 };
