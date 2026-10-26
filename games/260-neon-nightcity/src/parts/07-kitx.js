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
void texMat(int m, vec3 p, vec3 n, inout vec3 alb, inout float rough, inout float metal, inout float envK){
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
    rough = mix(.26 + .2 * tire, .12, oil); envK = .12 + .1 * oil;
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
  } else {   // 橡膠、粗塑膠：細顆粒、灰塵讓深色也看得出起伏
    alb = mix(alb, vec3(.075, .072, .068), .3 * fbm3(p * 4.) + .25 * up);
    alb *= .88 + .2 * n2(uv * 60.) * kxAA(uv * 60.);
    rough = .78;
  }
}
`;
const UBERX_VS = UBER_VS.replace('varying vec3 vW, vN, vCol;', 'varying vec3 vP, vNo; varying vec3 vW, vN, vCol;').replace('vCol = color; vMat = aMat;', 'vCol = color; vMat = aMat; vP = position; vNo = normal;');
const UBERX_FS = UBER_FS.replace('void main(){', KX_TEX + 'void main(){').replace('if (m == 0) { rough = .22; envK = .75; }', 'if (m >= 20) texMat(m, vP, normalize(vNo), alb, rough, metal, envK);\n  else if (m == 0) { rough = .22; envK = .75; }');
if (UBERX_VS === UBER_VS || !UBERX_FS.includes('texMat(m,')) console.warn('kitx: uber shader patch did not apply');
function mkUberX(o) { const m = mkUber(o); m.vertexShader = UBERX_VS; m.fragmentShader = UBERX_FS; return m; }
MAT.ux = mkUberX(); MAT.uxI = mkUberX({ inst: true });
// 材質代號（Kit 的 mat 參數）
const TX = { conc: 20, iron: 21, galv: 22, woodX: 23, woodY: 24, woodZ: 25, cmu: 26, brick: 27, stone: 28, sheet: 29, rubber: 30, carbon: 31, ti: 32, epoxy: 33, enamel: 34, steel: 35, peg: 36, tile: 37, slate: 38, seam: 39 };
