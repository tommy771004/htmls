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
const TX = { conc: 20, iron: 21, galv: 22, woodX: 23, woodY: 24, woodZ: 25, cmu: 26, brick: 27, stone: 28, sheet: 29, rubber: 30 };
