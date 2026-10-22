// ═══ 海岸：南面的海與珊瑚灘、錨灣港的碼頭與貨櫃船、跨海橋過去的灰鷗島與燈塔、西面的灰鷺河、北面的山 ═══
// 地形矩形與擋牆在 10-city.js（LANDS、BEACH、QUAY、BRIDGE、ISLE、PIERS、groundH），這裡只建畫面、燈與設施的碰撞。
// 遠景（對岸、北面的山、外海的島）用 MAT.far：霧只算一部分距離。排在 20-props 之後（signLights、cell、signQuad、instanced 都已宣告）。

// ─── 水面：同一張倒影貼圖，加上兩層移動的波紋法線；城市底下不鋪（四塊環繞的平面） ───
const WATER_FS = /* glsl */`
${GROUND_COMMON}
void main(){
  vec2 p = vW.xz; float t = uTime;
  vec2 g = vec2(n2(p*.045 + vec2(t*.05, t*.03)), n2(p*.05 + vec2(-t*.04, t*.05) + 7.)) - .5;
  vec2 g2 = vec2(n2(p*.33 + vec2(t*.32, -t*.2)), n2(p*.29 + vec2(-t*.26, t*.3) + 3.)) - .5;
  vec3 n = vec3(g.x*.55 + g2.x*.3, 1., g.y*.55 + g2.y*.3);
  float dist = length(vW - uCam);
  if (dist < 50.) n.xz += ripple(p*.7, uTime) * .3 * (1. - dist/50.);
  n = normalize(n);
  vec3 v = normalize(uCam - vW);
  float F = .02 + .98*pow(1. - max(dot(n, v), 0.), 5.);
  vec3 c = shade(vW, n, v, vec3(.006,.011,.016), .12, 0.);
  vec3 rc;
  if (uReflOn > .5) rc = reflSample(vRP.xy / vRP.w + n.xz * vec2(.05, .11), .003 + min(dist, 600.)*.00003);
  else rc = envMap(reflect(-v, n));
  c = mix(c, rc, clamp(.3 + F*.85, 0., 1.));
  gl_FragColor = vec4(applyFog(c, vW), 1.);
}`;
// 沙灘：乾沙、近水的濕沙（會反光）、浪花線
const SAND_FS = /* glsl */`
${GROUND_COMMON}
uniform float uSea;
void main(){
  vec2 p = vW.xz;
  float above = vW.y - uSea;                       // 離水面的高度
  float wetK = smoothstep(.55, .05, above);
  vec3 alb = vec3(.2,.17,.13) * (.75 + .5*fbm(p*.6)) * (.9 + .2*n2(p*9.));
  alb = mix(alb, alb * .45, wetK);
  float foam = smoothstep(.14, .0, abs(above - .06 - .05*sin(p.x*.13 + uTime*.9) - .04*sin(p.x*.41 - uTime*1.3)));
  vec3 c = wetSurface(alb, vec3(0., 1., 0.), mix(.2, 1., wetK), wetK * .8, 0.);
  c += vec3(.5,.55,.6) * foam * .12;
  gl_FragColor = vec4(applyFog(c, vW), 1.);
}`;
// 碼頭面：6 m 的混凝土板、黃色邊線、岸橋的軌道
const QUAY_FS = /* glsl */`
${GROUND_COMMON}
uniform vec4 uQuay;
void main(){
  vec2 p = vW.xz;
  vec2 tile = p / 6.; vec2 tf = fract(tile); vec2 ti = floor(tile);
  float joint = smoothstep(.0, .012, tf.x) * smoothstep(1., .988, tf.x) * smoothstep(.0, .012, tf.y) * smoothstep(1., .988, tf.y);
  vec3 alb = vec3(.1,.098,.094) * (.8 + .3*h21(ti)) * (.8 + .35*fbm(p*.4)) * mix(.6, 1., joint);
  float edge = min(min(p.x - uQuay.x, uQuay.y - p.x), uQuay.w - p.y);
  float paint = step(.8, edge) * step(edge, 1.2);
  float rail = max(step(abs(p.y - (uQuay.w - 6.)), .09), step(abs(p.y - (uQuay.w - 30.)), .09));
  alb = mix(alb, vec3(.55,.42,.08), paint);
  alb = mix(alb, vec3(.22,.21,.2), rail);
  float pud = smoothstep(.6, .7, fbm(p*.07 + 2.)) * joint;
  vec3 c = wetSurface(alb, vec3(0., 1., 0.), .7, pud, paint);
  gl_FragColor = vec4(applyFog(c, vW), 1.);
}`;
// 灰鷗島：濕草與裸岩、通往燈塔的碎石路
const ISLE_FS = /* glsl */`
${GROUND_COMMON}
uniform vec4 uIsle;
void main(){
  vec2 p = vW.xz;
  float n1 = fbm(p*.05), rock = smoothstep(.55, .7, fbm(p*.11 + 4.));
  vec3 alb = mix(vec3(.028,.05,.02) * (.6 + .8*n1), vec3(.07,.068,.066) * (.7 + .5*n2(p*2.)), rock);
  float road = smoothstep(4.2, 3.6, abs(p.x - uIsle.x)) * step(p.y, uIsle.y);
  road = max(road, smoothstep(3.6, 3., abs(p.y - uIsle.z)) * step(uIsle.x, p.x));
  alb = mix(alb, vec3(.06,.058,.054) * (.8 + .4*h21(floor(p*5.))), road);
  vec3 c = wetSurface(alb, vec3(0., 1., 0.), mix(.3, .7, road), road * .3, 0.);
  gl_FragColor = vec4(applyFog(c, vW), 1.);
}`;
// 木棧橋：沿 z 的木板（棧橋與舊碼頭的木棧共用）
const PLANK_FS = /* glsl */`
${GROUND_COMMON}
void main(){
  vec2 p = vW.xz;
  float bx = p.x / .28, row = floor(bx), seam = smoothstep(.0, .08, fract(bx)) * smoothstep(1., .92, fract(bx));
  float off = h21(vec2(row, 1.)) * 3.2, end = step(.04, fract((p.y + off) / 3.2));
  vec3 alb = vec3(.09,.062,.042) * (.7 + .5*h21(vec2(row, floor((p.y + off) / 3.2)))) * (.85 + .3*n2(vec2(p.x*3., p.y*.3))) * mix(.35, 1., seam * end);
  float pud = smoothstep(.62, .72, fbm(p*.3 + 4.)) * seam;
  vec3 c = wetSurface(alb, normalize(vN), .7, pud, 0.);
  gl_FragColor = vec4(applyFog(c, vW), 1.);
}`;
const groundMat = (fs, u = {}) => new T.ShaderMaterial({ uniforms: { ...shared(ALLU), ...reflU, ...u }, vertexShader: GROUND_VS, fragmentShader: fs });
const MAT_WATER = groundMat(WATER_FS), MAT_PLANK = groundMat(PLANK_FS);
{
  const W0 = CITY_X0 - OUT_D, W1 = CITY_X1 + OUT_D, FAR_X0 = W0 - 300, BIG = 5200, N = CITY_Z0 - 650;
  const rects = [
    [FAR_X0, W0, N, SHORE_Z],                   // 灰鷺河
    [FAR_X0 - BIG, W1 + BIG, SHORE_Z, SHORE_Z + BIG],   // 南面的海
    [W1, W1 + BIG, N - BIG, SHORE_Z],           // 東面的海灣
  ];
  const gs = rects.map(([x0, x1, z0, z1]) => { const g = new T.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, SEA_Y, (z0 + z1) / 2); return g; });
  const water = new T.Mesh(mergeGeometries(gs), MAT_WATER); water.frustumCulled = false; groundGroup.add(water);
}
// 沙灘：沿 z 切 40 段，高度和 groundH 一樣（往海裡再多延伸一段，讓水面切出岸線）
{
  const L = BEACH.len + 30, g = new T.PlaneGeometry(BEACH.x1 - BEACH.x0, L, 1, 40); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = BEACH.z0 + L / 2 + p.getZ(i);
    p.setXYZ(i, (BEACH.x0 + BEACH.x1) / 2 + p.getX(i), -Math.min(1.3, (z - BEACH.z0) / BEACH.len) * BEACH.drop + .001, z);
  }
  g.computeVertexNormals();
  groundGroup.add(new T.Mesh(g, groundMat(SAND_FS, { uSea: { value: SEA_Y } })));
}
// 碼頭面與島面：上表面 y = 0，側面一路到水下
{
  const slab = (r, mat, depth = 4) => { const g = new T.BoxGeometry(r.x1 - r.x0, depth, r.z1 - r.z0); g.translate((r.x0 + r.x1) / 2, -depth / 2, (r.z0 + r.z1) / 2); groundGroup.add(new T.Mesh(g, mat)); };
  slab(QUAY, groundMat(QUAY_FS, { uQuay: { value: new T.Vector4(QUAY.x0, QUAY.x1, QUAY.z0, QUAY.z1) } }));
  slab(ISLE, groundMat(ISLE_FS, { uIsle: { value: new T.Vector4(BRIDGE_X, ISLE.z0 + 120, ISLE.z0 + 120, 0) } }), 6);
}

// ─── 擋牆旁的欄杆、步道路燈 ───
const coastLights = [];   // 也放進 signLights（60-venues 會複製成 outLights）
const coastLight = (x, y, z, col, r, i) => { const l = { x, y, z, col: lin(col), r, i }; signLights.push(l); coastLights.push(l); return l; };
{
  const k = new Kit(), posts = [];
  for (const b of colliders) {
    if (!b.low) continue;
    // 擋牆貼著地的那一面：外側 0.6 m 是陸地的那一邊
    const sides = [['z0', (b.x0 + b.x1) / 2, b.z0 - .6], ['z1', (b.x0 + b.x1) / 2, b.z1 + .6], ['x0', b.x0 - .6, (b.z0 + b.z1) / 2], ['x1', b.x1 + .6, (b.z0 + b.z1) / 2]];
    const s = sides.find(([, x, z]) => inLand(x, z));
    if (!s) continue;
    const [f, lx, lz] = s, h = groundH(lx, lz);
    const onBridge = lx >= BRIDGE.x0 && lx <= BRIDGE.x1 && lz >= BRIDGE.z0 && lz <= BRIDGE.z1;
    if (h < .1 && !onBridge) continue;   // 沙灘、碼頭邊、島的岩岸不裝欄杆
    const alongX = f === 'z0' || f === 'z1', y0 = Math.max(h, 0);
    const ex = f === 'x0' ? b.x0 - .15 : f === 'x1' ? b.x1 + .15 : 0, ez = f === 'z0' ? b.z0 - .15 : f === 'z1' ? b.z1 + .15 : 0;
    const a0 = alongX ? b.x0 + 1 : b.z0 + 1, a1 = alongX ? b.x1 - 1 : b.z1 - 1, len = a1 - a0;
    if (len < 1) continue;
    const mid = (a0 + a1) / 2;
    if (alongX) k.box(mid, y0 + 1.05, ez, len, .07, .07, 0x2c3036, 15).box(mid, y0 + .55, ez, len, .04, .04, 0x2c3036, 15);
    else k.box(ex, y0 + 1.05, mid, .07, .07, len, 0x2c3036, 15).box(ex, y0 + .55, mid, .04, .04, len, 0x2c3036, 15);
    for (let a = a0; a <= a1; a += 2.4) posts.push(alongX ? { x: a, y: y0, z: ez } : { x: ex, y: y0, z: a });
    // 步道路燈：每 30 m 一盞，暖白
    if (h > .1 && !onBridge) for (let a = a0 + 12; a < a1 - 6; a += 30) {
      const x = alongX ? a : ex + (f === 'x0' ? -1.2 : 1.2), z = alongX ? ez + (f === 'z0' ? -1.2 : 1.2) : a;
      if (!free(x, z, .6)) continue;
      claim(x, z, 1); circles.push({ x, z, r: .18 });
      k.cyl(x, y0 + 2.6, z, .07, .09, 5.2, 8, 0x22252a, 15).cyl(x, y0 + 5.3, z, .26, .18, .32, 10, 0x1a1c20, 15).cyl(x, y0 + 5.08, z, .22, .22, .08, 10, 0xffe2b0, 11);
      coastLight(x, y0 + 5, z, 0xffd8a0, 13, .85);
    }
  }
  instanced(new Kit().box(0, .55, 0, .08, 1.1, .08, 0x2c3036, 15).build(), MAT.uber, posts, LY.NOREFL);
  scene.add(new T.Mesh(k.build(), MAT.uber));
}

// ─── 珊瑚灘：救生員塔、收起來的陽傘、排球網、步道上的椰子樹；棧橋盡頭的霓虹摩天輪 ───
const palms = [];
{
  const k = new Kit(), r2 = rng(2027);
  for (const x of [avX(1) + 20, avX(5) + 10, avX(8) + 30]) {   // 救生員塔：木架、白色小屋、紅旗
    const z = BEACH.z0 + 24, y = groundH(x, z);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(x + sx * 1.1, y + 1.4, z + sz * 1.1, .16, 2.8, .16, 0xd8d0c0, 2);
    k.box(x, y + 2.9, z, 2.8, .14, 2.8, 0xc8bca8, 2).box(x, y + 3.9, z, 2.4, 1.8, 2.2, 0xe8e2d6, 10).box(x, y + 4.95, z, 3, .16, 2.8, 0xb83020, 10)
      .box(x, y + 4, z + 1.11, 1.8, .8, .04, 0x10161c, 1).cyl(x + 1.6, y + 4.5, z - 1, .03, .03, 3.4, 6, 0x888888, 3).box(x + 1.95, y + 5.8, z - 1, .7, .45, .02, 0xd02018, 11);
    circles.push({ x, z, r: 1.7 });
    k.box(x, y + 5.2, z + 1.2, .5, .3, .3, 0xfff0d0, 11); coastLight(x, y + 5, z + 2, 0xffe8c8, 22, 1.1);
  }
  for (let x = BEACH.x0 + 25; x < BEACH.x1 - 20; x += 14 + r2() * 10) {   // 收起來的陽傘
    if (Math.abs(x - avX(4)) < 14) continue;
    const z = BEACH.z0 + 8 + r2() * 14, y = groundH(x, z), col = [0xc8442c, 0x2c6ea8, 0xe0b040, 0x2a8a6a][Math.floor(r2() * 4)];
    k.cyl(x, y + 1.3, z, .03, .03, 2.6, 6, 0xdddddd, 3).cyl(x, y + 1.9, z, .16, .05, 1.3, 8, col, 2);
  }
  { const x = avX(6) + 30, z = BEACH.z0 + 18, y = groundH(x, z);   // 排球網
    for (const s of [-1, 1]) k.cyl(x + s * 4.6, y + 1.2, z, .05, .05, 2.4, 6, 0xcccccc, 3);
    k.box(x, y + 2.1, z, 9.2, .7, .02, 0x202020, 2); }
  scene.add(new T.Mesh(k.build(), MAT.uber));
  // 椰子樹：南面步道外緣一排，碼頭區沒有
  for (let x = CITY_X0 - OUT_D + 8; x < BEACH_X1 - 6; x += 16 + r2() * 6) {
    const z = SHORE_Z - 6 - r2() * 3;
    if (Math.abs(x - avX(4)) < 9 || !free(x, z, 1.2)) continue;
    palms.push({ x, z, y: .15, ry: r2() * 6.3, s: .9 + r2() * .35, rz: (r2() - .5) * .14 }); claim(x, z, 1.2); circles.push({ x, z, r: .3 });
  }
  const pk = new Kit();
  for (let i = 0; i < 6; i++) pk.cyl(Math.sin(i * .25) * .25 * i * .2, .9 + i * 1.6, 0, .17 - i * .015, .2 - i * .015, 1.7, 7, 0x4a3a2a, 2, 0, 0, -.04 * i);
  for (let i = 0; i < 8; i++) {   // 葉子：往外垂的薄片
    const a = i / 8 * Math.PI * 2;
    pk.box(Math.cos(a) * 1.9, 9.3, Math.sin(a) * 1.9, 3.6, .05, .7, 0x2a4a22, 2, 0, -a, -.45);
  }
  instanced(pk.build(), MAT.uber, palms);
}
// 步道的長椅與花台：南面海濱（珊瑚灘那段）面向海、西面灰鷺河濱面向河，貼著欄杆內側，長椅與花台交錯
{
  const benches = [], planters = [];
  const put = (x, z, ry, alongX) => {
    if (!free(x, z, 1.6)) return;
    const list = (benches.length + planters.length) % 3 === 2 ? planters : benches;
    list.push({ x, z, y: .15, ry }); claim(x, z, 1.6);
    const hw = list === planters ? 1.6 : 1.1, hd = list === planters ? .7 : .45;
    colliders.push(alongX ? { x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd } : { x0: x - hd, x1: x + hd, z0: z - hw, z1: z + hw });
  };
  for (let x = CITY_X0 - OUT_D + 18; x < BEACH_X1 - 10; x += 21) if (Math.abs(x - avX(4)) > 10) put(x, SHORE_Z - 2.4, 0, true);
  for (let z = CITY_Z0 - OUT_D + 24; z < SHORE_Z - 16; z += 23) put(CITY_X0 - OUT_D + 2.4, z, -Math.PI / 2, false);
  // 長椅：鑄鐵腳、五條木板座面與靠背（正面朝 +z）
  const bk = new Kit();
  for (const sx of [-.85, .85]) bk.box(sx, .22, 0, .07, .44, .5, 0x1e2024, 15).box(sx, .62, -.24, .07, .5, .06, 0x1e2024, 15);
  for (let i = 0; i < 3; i++) bk.box(0, .46, -.16 + i * .14, 2.1, .04, .1, 0x6a4a30, 2);
  for (let i = 0; i < 2; i++) bk.box(0, .66 + i * .16, -.27, 2.1, .1, .03, 0x6a4a30, 2, -.12);
  instanced(bk.build(), MAT.uber, benches, LY.NOREFL);
  // 花台：混凝土槽、土、低矮灌木
  const fk = new Kit();
  fk.box(0, .3, 0, 3.2, .6, 1.4, 0x5a5854, 2).box(0, .58, 0, 3, .06, 1.2, 0x1a140e, 2);
  for (let i = 0; i < 4; i++) fk.add(new T.IcosahedronGeometry(.42 + (i % 2) * .1, 0), new T.Color().setHSL(.3, .45, .12 + (i % 3) * .02), 2, tf(-1.1 + i * .73, .82, (i % 2 - .5) * .3));
  instanced(fk.build(), MAT.uber, planters, LY.NOREFL);
}
// 棧橋：木板、樁、欄杆；盡頭的摩天輪（輪面朝北，岸上看得到整圈）
const ferris = new T.Group(), cabins = [];
{
  const P0 = PIERS[0], k = new Kit(), cx = (P0.x0 + P0.x1) / 2;
  { const dg = new T.BoxGeometry(P0.x1 - P0.x0, .3, P0.z1 - P0.z0); dg.translate(cx, P0.h - .15, (P0.z0 + P0.z1) / 2); groundGroup.add(new T.Mesh(dg, MAT_PLANK)); }
  for (let z = P0.z0 + 4; z < P0.z1; z += 6) for (const s of [-1, 1]) k.cyl(cx + s * 4.2, (P0.h + SEA_Y - 3) / 2, z, .22, .22, P0.h - SEA_Y + 3, 8, 0x2a221c, 2);
  for (let z = P0.z0 + 10; z < P0.z1 - 30; z += 24) for (const s of [-1, 1]) {
    k.cyl(cx + s * 4.6, P0.h + 2.4, z, .06, .08, 4.8, 8, 0x22252a, 15).box(cx + s * 4.6, P0.h + 4.85, z, .5, .14, .5, 0xfff0c8, 11);
    coastLight(cx + s * 4.6, P0.h + 4.6, z, 0xffe0b0, 11, .8);
  }
  // 摩天輪的底座與 A 字支架
  const wz = P0.z1 - 14, wy = 25, R = 20;
  for (const s of [-1, 1]) {
    k.box(cx, P0.h + 1, wz + s * 3.2, 9.6, 2, 1.2, 0x1a1c22, 15);
    for (const t of [-1, 1]) k.box(cx + t * 6, P0.h + wy / 2, wz + s * 2.6, .7, wy + 2, .7, 0xd8dce4, 15, 0, 0, -t * .23);
  }
  k.box(cx, P0.h + wy, wz, 1.4, 1.4, 7, 0x2a2c34, 15);
  scene.add(new T.Mesh(k.build(), MAT.uber));
  // 輪子本身：24 根輻條、兩圈霓虹輪框（會轉）
  const wk = new Kit();
  for (const s of [-1, 1]) for (let i = 0; i < 48; i++) {
    const a = i / 48 * Math.PI * 2, a2 = (i + 1) / 48 * Math.PI * 2, x0 = Math.cos(a) * R, y0 = Math.sin(a) * R, x1 = Math.cos(a2) * R, y1 = Math.sin(a2) * R;
    wk.box((x0 + x1) / 2, (y0 + y1) / 2, s * 2.2, Math.hypot(x1 - x0, y1 - y0) + .05, .28, .28, i % 2 ? 0xff3fa0 : 0x3ff0ff, 8, 0, 0, Math.atan2(y1 - y0, x1 - x0));
  }
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; for (const s of [-1, 1]) wk.box(Math.cos(a) * R / 2, Math.sin(a) * R / 2, s * 2.2, R, .12, .12, 0xc8ccd4, 3, 0, 0, a); }
  wk.cyl(0, 0, 0, 1.2, 1.2, 5, 16, 0xffd070, 8, Math.PI / 2);
  const wm = new T.Mesh(wk.build(), MAT.uber); ferris.add(wm);
  ferris.position.set(cx, P0.h + wy, wz); scene.add(ferris);
  const ck = new Kit().box(0, -1.3, 0, 2, 1.8, 2.4, 0xe8e0d0, 10).box(0, -1.2, 0, 2.05, .8, 2.45, 0x10161c, 1).box(0, -.2, 0, .1, 1, .1, 0x888888, 3).box(0, -2.25, 0, 2.1, .1, 2.5, 0xffd070, 11).build();
  for (let i = 0; i < 16; i++) { const m = new T.Mesh(ck, MAT.uber); m.userData.a = i / 16 * Math.PI * 2; cabins.push(m); scene.add(m); }
  coastLight(cx, P0.h + wy, wz - 6, 0xff5ab4, 34, 1.6);
  coastLight(cx, P0.h + 6, wz - 10, 0x5ae8ff, 18, 1.1);
}

// 舊碼頭的兩座木棧（伸進灰鷺河）：木板、樁、繫纜柱、盡頭一盞燈
{
  const k = new Kit();
  for (const P of PIERS.slice(1)) {
    const cz = (P.z0 + P.z1) / 2;
    const dg = new T.BoxGeometry(P.x1 - P.x0, .3, P.z1 - P.z0); dg.translate((P.x0 + P.x1) / 2, P.h - .15, cz); groundGroup.add(new T.Mesh(dg, MAT_PLANK));
    for (let x = P.x0 + 3; x < P.x1; x += 6) for (const z of [P.z0 + 1, P.z1 - 1]) k.cyl(x, (P.h + SEA_Y - 3) / 2, z, .2, .2, P.h - SEA_Y + 3, 8, 0x2a221c, 2);
    for (let x = P.x0 + 6; x < P.x1 - 4; x += 12) for (const z of [P.z0 + .6, P.z1 - .6]) { k.cyl(x, P.h + .3, z, .16, .2, .6, 8, 0x1a1a1c, 2); circles.push({ x, z, r: .2 }); }
    k.cyl(P.x0 + 2, P.h + 2.2, cz, .07, .09, 4.4, 8, 0x22252a, 15).box(P.x0 + 2, P.h + 4.5, cz, .4, .25, .4, 0xffd8a0, 11);
    coastLight(P.x0 + 2, P.h + 4.2, cz, 0xffc890, 12, .8);
  }
  scene.add(new T.Mesh(k.build(), MAT.uber));
}

// ─── 錨灣港：岸橋、貨櫃堆、高桿燈、靠港的貨櫃船 ───
const LANE_X0 = BRIDGE.x0 - 14, LANE_X1 = BRIDGE.x1 + 14;   // 碼頭上往跨海橋的車道，不堆貨櫃
const harbor = { cranes: [], ship: null };   // coastUpdate 每幀動：岸橋小車搬貨櫃、貨櫃船隨浪起伏
{
  const k = new Kit(), r2 = rng(808);
  // 岸橋：腳跨在兩條軌道上（z1-6、z1-30），吊臂往海上伸 48 m
  for (const cx of [610, 690, 770, 850]) {
    const z0 = QUAY.z1 - 30, z1 = QUAY.z1 - 6, col = cx % 160 ? 0xc83a24 : 0xe8e2d4;
    for (const z of [z0, z1]) for (const s of [-1, 1]) { k.box(cx + s * 9, 20, z, 1.4, 40, 1.4, col, 10); circles.push({ x: cx + s * 9, z, r: 1 }); }
    for (const z of [z0, z1]) k.box(cx, 39.5, z, 20, 1.6, 1.6, col, 10);
    for (const s of [-1, 1]) k.box(cx + s * 9, 39.5, (z0 + z1) / 2, 1.6, 1.6, z1 - z0, col, 10).box(cx + s * 9, 14, (z0 + z1) / 2, 1, 1, z1 - z0, col, 10);
    k.box(cx, 43, QUAY.z1 + 5, 6, 2.4, 86, col, 10);                    // 吊臂（往陸側也伸一段）
    k.box(cx, 47, z1 - 8, 5, 6, 8, 0x30343a, 15).box(cx, 47, z1 - 3.9, 4, 3, .1, 0xffe0a0, 11);   // 機房
    k.box(cx, 41, QUAY.z1 + 14, 3, 2.6, 3, 0x22262c, 15).box(cx, 41, QUAY.z1 + 15.6, 2.4, 1.6, .1, 0x9ad0ff, 11);   // 駕駛室
    for (const z of [QUAY.z1 + 47, z0 - 37]) k.box(cx, 44.6, z, .7, .7, .7, 0xff2020, 9);   // 航空警示燈（閃）
    for (let z = z0 - 30; z < QUAY.z1 + 46; z += 18) k.box(cx + 3.2, 42, z, .3, .3, .3, 0xffd8a0, 11);
    coastLight(cx, 13.5, QUAY.z1 - 18, 0xffe6c0, 34, 1.5);   // 腳架下的投光燈
    coastLight(cx, 36, QUAY.z1 + 14, 0xffe6c0, 50, 1);
    k.box(cx, 13.2, QUAY.z1 - 18, 1.2, .3, 1.2, 0xfff0d8, 11);
  }
  // 高桿燈
  for (const x of [580, 760, 940, 1120, 1280]) {
    const z = QUAY.z0 + 40;
    if (x > LANE_X0 - 4 && x < LANE_X1 + 4) continue;
    k.cyl(x, 15, z, .3, .45, 30, 10, 0x30343a, 15).box(x, 30.4, z, 4.4, .5, 1.4, 0x22262c, 15).box(x, 30.1, z, 4, .1, 1.1, 0xfff0d8, 11);
    circles.push({ x, z, r: .6 });
    coastLight(x, 29, z, 0xffefd0, 58, 1.4);
  }
  // 門口的警衛亭與欄杆（城市這一側）
  { const x = avX(13) + 36, z = QUAY.z0 + 6;
    k.box(x - 9, 1.4, z, 3, 2.8, 3, 0x2a3036, 10).box(x - 9, 1.6, z - 1.51, 2.4, 1, .04, 0xa8e0ff, 11).box(x - 9, 2.9, z, 3.6, .2, 3.6, 0x1a1e22, 15)
      .box(x, 1, z, 14, .12, .12, 0xe0c020, 10);
    circles.push({ x: x - 9, z, r: 1.8 }); }
  scene.add(new T.Mesh(k.build(), MAT.uber));
  // 貨櫃堆：每堆 4×3 個 40 呎櫃、1–4 層；顏色分六組 InstancedMesh
  const COLS = [0x9a2a1e, 0x1e4a8a, 0x2a6a3a, 0xc8a030, 0x6a6e74, 0xd0d4d8];
  const lists = COLS.map(() => []);
  for (let x = QUAY.x0 + 30; x < QUAY.x1 - 52; x += 58) for (const z of [QUAY.z0 + 22, QUAY.z0 + 52]) {
    if (x + 50 > LANE_X0 && x < LANE_X1) continue;
    const hgt = 1 + Math.floor(r2() * 4);
    for (let a = 0; a < 4; a++) for (let b = 0; b < 3; b++) for (let c = 0; c < hgt - (r2() < .3 ? 1 : 0); c++)
      lists[Math.floor(r2() * COLS.length)].push({ x: x + 6.1 + a * 12.4, y: c * 2.6, z: z + b * 2.6, ry: 0 });
    colliders.push({ x0: x, x1: x + 49.6, z0: z - 1.3, z1: z + 6.5 });
  }
  COLS.forEach((col, k2) => {
    const ck = new Kit().box(0, 1.3, 0, 12.2, 2.58, 2.44, col, 2);
    for (let i = -5; i <= 5; i++) ck.box(i * 1.1, 1.3, 1.23, .2, 2.4, .02, new T.Color(lin(col)).multiplyScalar(.7), 2).box(i * 1.1, 1.3, -1.23, .2, 2.4, .02, new T.Color(lin(col)).multiplyScalar(.7), 2);
    ck.box(6.11, 1.3, 0, .02, 2.4, 2.3, new T.Color(lin(col)).multiplyScalar(.6), 15);
    instanced(ck.build(), MAT.uber, lists[k2]);
  });
  // 貨櫃船：靠在岸橋外側，船艏朝東；船身、甲板上的貨櫃、船尾的駕駛樓
  const sk = new Kit(), sx0 = 590, sx1 = 820, sz = QUAY.z1 + 22, top = SEA_Y + 9;
  sk.box((sx0 + sx1) / 2, SEA_Y + 1, sz, sx1 - sx0, 12, 30, 0x1a2430, 2)
    .box((sx0 + sx1) / 2, SEA_Y - .2, sz, sx1 - sx0 + .1, 2.4, 30.1, 0x6a1a14, 2)
    .box(sx1 + 6, SEA_Y + 2, sz, 14, 10, 20, 0x1a2430, 2, 0, Math.PI / 4)
    .box((sx0 + sx1) / 2, top - .9, sz - 15.05, sx1 - sx0, .5, .1, 0xd8d8d8, 10).box((sx0 + sx1) / 2, top - .9, sz + 15.05, sx1 - sx0, .5, .1, 0xd8d8d8, 10);
  for (let x = sx0 + 40; x < sx1 - 12; x += 13) for (let b = -4; b <= 4; b++) {
    const n = 2 + Math.floor(r2() * 4);
    for (let c = 0; c < n; c++) sk.box(x, top + 1.3 + c * 2.6, sz + b * 2.6, 12.2, 2.5, 2.44, COLS[Math.floor(r2() * COLS.length)], 2);
  }
  sk.box(sx0 + 18, top + 9, sz, 16, 18, 26, 0xe8e4dc, 10).box(sx0 + 18, top + 19, sz, 18, 2, 32, 0xe8e4dc, 10)
    .box(sx0 + 26.05, top + 14, sz, .1, 8, 22, 0x10161c, 1);
  for (let f = 0; f < 5; f++) for (let w = -4; w <= 4; w++) if (r2() < .45) sk.box(sx0 + 26.1, top + 4 + f * 3, sz + w * 2.6, .05, 1.1, 1.6, 0xffd8a0, 11);
  sk.cyl(sx0 + 8, top + 24, sz, .7, .9, 8, 10, 0x2a2a2a, 15).box(sx0 + 8, top + 28.3, sz, .5, .5, .5, 0xff2020, 9).box(sx1 + 10, top + 6, sz, .5, .5, .5, 0x20ff60, 11);
  const ship = harbor.ship = new T.Mesh(sk.build(), MAT.uber); scene.add(ship); cullAdd(ship);
  coastLight(sx0 + 30, top + 12, sz, 0xffd8a0, 30, 1);
  // 岸橋的小車、鋼索與吊具：在船上（z = sz）與兩條軌道之間的車道（z1 - 18）來回搬貨櫃；吊具沿 x 和貨櫃同向
  const tg = new Kit().box(0, 0, 0, 4.4, 1.4, 5, 0x30343a, 15).box(0, -.85, 0, 3.6, .3, 4.2, 0x22262c, 15).box(0, .2, 2.51, 2.4, .6, .02, 0x9ad0ff, 11).build();
  const wg = new Kit().box(-1.2, -.5, -.9, .05, 1, .05, 0x202226, 15).box(1.2, -.5, -.9, .05, 1, .05, 0x202226, 15)
    .box(-1.2, -.5, .9, .05, 1, .05, 0x202226, 15).box(1.2, -.5, .9, .05, 1, .05, 0x202226, 15).build();
  const spg = new Kit().box(0, 0, 0, 12.4, .45, 2.6, 0xe0b020, 10).box(0, .6, 0, 3, .8, 2, 0x30343a, 15).build();
  const cgs = COLS.map(col => new Kit().box(0, 0, 0, 12.2, 2.58, 2.44, col, 2).box(6.11, 0, 0, .02, 2.4, 2.3, new T.Color(lin(col)).multiplyScalar(.6), 15).build());
  [610, 690, 770, 850].forEach((cx, i) => {
    const c = { cx, off: i * .27, k: i, tr: new T.Mesh(tg, MAT.uber), wire: new T.Mesh(wg, MAT.uber), sp: new T.Mesh(spg, MAT.uber), box: new T.Mesh(cgs[i % cgs.length], MAT.uber), cgs, n: -1 };
    for (const m of [c.tr, c.wire, c.sp, c.box]) { m.position.x = cx; scene.add(m); }
    harbor.cranes.push(c);
  });
  Object.assign(harbor, { seaZ: sz, landZ: QUAY.z1 - 18, hiY: 34, shipY: top + 7.2, landY: 3.1 });
}

// ─── 跨海橋：斜張橋，兩座 H 形主塔、斜拉索、兩側路燈；橋面 y = 0（和碼頭、島一樣） ───
{
  const k = new Kit(), x = BRIDGE_X, z0 = BRIDGE.z0, z1 = BRIDGE.z1, L = z1 - z0, zm = (z0 + z1) / 2;
  { const dg = new T.BoxGeometry(BRIDGE.x1 - BRIDGE.x0, 1.2, L); dg.translate(x, -.6, zm); groundGroup.add(new T.Mesh(dg, MAT_ROAD)); }   // 橋面：和路面同一個材質（積水、倒影）
  k.box(x, -1.6, zm, BRIDGE.x1 - BRIDGE.x0 - 2, .8, L, 0x1c1e22, 2).box(x, .01, zm, .24, .01, L, 0xc8a020, 11);
  for (const zt of [z0 + L * .3, z0 + L * .7]) {
    for (const s of [-1, 1]) k.box(x + s * 8.6, 22, zt, 1.8, 48, 2.6, 0x8a8e94, 10);
    k.box(x, 40, zt, 19, 2, 2.6, 0x8a8e94, 10).box(x, 8, zt, 19, 1.6, 2.6, 0x8a8e94, 10);
    for (const s of [-1, 1]) k.box(x + s * 8.6, 46.6, zt, .6, .6, .6, 0xff2020, 9);
    for (const s of [-1, 1]) for (const d of [-1, 1]) for (let c = 1; c <= 7; c++) {   // 斜拉索
      const za = zt + d * c * 9.5, ya = 44 - c * 3.6, dz = za - zt, dy = .4 - ya, ln = Math.hypot(dz, dy);
      k.box(x + s * 7.4, (ya + .4) / 2, (zt + za) / 2, .08, .08, ln, 0x9aa0a8, 2, Math.atan2(dy, dz) * -1 + 0, 0, 0);
    }
  }
  for (let zp = z0 + 20; zp < z1 - 10; zp += 30) k.cyl(x, (SEA_Y - 6 - 1.2) / 2, zp, 1.6, 1.6, 6 + SEA_Y + 4, 12, 0x3a3c40, 15);
  for (let zp = z0 + 8; zp < z1 - 4; zp += 28) for (const s of [-1, 1]) {
    k.cyl(x + s * 6.2, 4, zp, .08, .1, 8, 8, 0x2a2d33, 15).box(x + s * 5.4, 8, zp, 1.8, .1, .1, 0x2a2d33, 15).box(x + s * 4.6, 7.92, zp, .7, .12, .3, 0xb8dcff, 8);
    coastLight(x + s * 4.6, 7.6, zp, 0xc8e0ff, 16, .9);
  }
  const m = new T.Mesh(k.build(), MAT.uber); scene.add(m); cullAdd(m, 900);
}

// ─── 灰鷗島：岩岸、樹、廢墟街區與辦公園區（以 http(s) 開啟時換成模型，27-props.js 的 ISLE_SITES）、東端的燈塔 ───
const ISLE_SITES = {
  ruin: { x: ISLE.x0 + 70, z: ISLE.z0 + 150, ry: 0, w: 52, d: 64 },        // dasy444 的 abandoned city street，放大 2.3 倍
  office: { x: BRIDGE_X + 8, z: ISLE.z0 + 160, ry: Math.PI, w: 62, d: 63 },  // dasy444 的 Loft 18 environment（辦公室與一圈板樓）；北面的門是安全屋（69-safehouse.js）
};
const LIGHTHOUSE = { x: ISLE.x1 - 26, z: ISLE.z0 + 120 }, ISLE_PROXY = {};   // 替身：模型下載好就藏起來
const beacon = new T.Group();
{
  const k = new Kit(), r2 = rng(99);
  // 岩岸：沿著四邊堆幾排變形的岩塊
  for (const [ax, fixed, a0, a1, out] of [['x', ISLE.z0, ISLE.x0, ISLE.x1, -1], ['x', ISLE.z1, ISLE.x0, ISLE.x1, 1], ['z', ISLE.x0, ISLE.z0, ISLE.z1, -1], ['z', ISLE.x1, ISLE.z0, ISLE.z1, 1]])
    for (let a = a0; a < a1; a += 5 + r2() * 4) {
      if (ax === 'x' && out < 0 && Math.abs(a - BRIDGE_X) < 12) continue;
      const s = 3 + r2() * 4, o = out * (r2() * 3), x = ax === 'x' ? a : fixed + o, z = ax === 'x' ? fixed + o : a;
      k.add(new T.DodecahedronGeometry(s, 0), new T.Color().setHSL(.08, .05, .07 + r2() * .05), 2, tf(x, SEA_Y + s * .3 - .6, z, r2() * 3, r2() * 3, 0, 1, .55, 1));
    }
  // 燈塔：白塔紅帶、燈室、外推的陽台
  const { x, z } = LIGHTHOUSE;
  k.cyl(x, 2, z, 7, 7.5, 4, 16, 0x6a6a68, 2);
  for (let i = 0; i < 6; i++) k.cyl(x, 4 + i * 4.4 + 2.2, z, 3.6 - i * .22, 3.8 - i * .22, 4.4, 16, i % 2 ? 0xb82418 : 0xe8e4dc, 10);
  k.cyl(x, 31, z, 3.4, 3.4, .4, 16, 0x22262a, 15).cyl(x, 33, z, 2, 2, 3.4, 12, 0xfff0c0, 11).cyl(x, 35.2, z, .6, 2.4, 1.6, 12, 0x2a1a14, 15);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; k.box(x + Math.cos(a) * 3.3, 31.7, z + Math.sin(a) * 3.3, .06, 1, .06, 0x22262a, 15); }
  k.box(x - 9, 1.6, z, 7, 3.2, 6, 0xe8e4dc, 10).box(x - 9, 3.4, z, 7.4, .4, 6.4, 0x8a2a1e, 10).box(x - 12.55, 1.2, z, .05, 2.2, 1.1, 0x2a1c14, 10);
  circles.push({ x, z, r: 7.4 });
  colliders.push({ x0: x - 12.5, x1: x - 5.5, z0: z - 3, z1: z + 3 });
  // 樹：避開兩個建築基地、往燈塔的碎石路
  const sites = Object.values(ISLE_SITES), isleTrees = [];
  for (let i = 0; i < 140; i++) {
    const tx = ISLE.x0 + 8 + r2() * (ISLE.x1 - ISLE.x0 - 16), tz = ISLE.z0 + 8 + r2() * (ISLE.z1 - ISLE.z0 - 16);
    if (sites.some(s => Math.abs(tx - s.x) < s.w / 2 + 5 && Math.abs(tz - s.z) < s.d / 2 + 5)) continue;
    if (Math.abs(tx - BRIDGE_X) < 8 && tz < ISLE.z0 + 124 || Math.abs(tz - (ISLE.z0 + 120)) < 7 && tx > BRIDGE_X || Math.hypot(tx - x, tz - z) < 16) continue;
    isleTrees.push({ x: tx, z: tz, y: 0, ry: r2() * 6.3, s: .9 + r2() * .6 }); circles.push({ x: tx, z: tz, r: .35 });
  }
  const tk = new Kit(); tk.cyl(0, 2.1, 0, .1, .17, 4.2, 8, 0x3a2c20, 2);
  for (let i = 0; i < 5; i++) { const g = new T.IcosahedronGeometry(1.4 + r2() * .5, 1); const a = i / 5 * 6.28, rr = i ? 1.2 : 0; tk.add(g, new T.Color().setHSL(.27, .4, .14 + r2() * .06), 2, tf(Math.cos(a) * rr, 5 + r2() * 1.4 + (i ? 0 : .9), Math.sin(a) * rr)); }
  instanced(tk.build(), MAT.uber, isleTrees);
  // 島上的路燈：沿碎石路
  for (let zp = ISLE.z0 + 10; zp < ISLE.z0 + 120; zp += 26) { k.cyl(BRIDGE_X + 5, 2.6, zp, .07, .09, 5.2, 8, 0x22252a, 15).box(BRIDGE_X + 5, 5.3, zp, .4, .25, .4, 0xffe0b0, 11); coastLight(BRIDGE_X + 5, 5, zp, 0xffd8a0, 12, .8); }
  for (let xp = BRIDGE_X + 20; xp < x - 14; xp += 26) { k.cyl(xp, 2.6, ISLE.z0 + 125, .07, .09, 5.2, 8, 0x22252a, 15).box(xp, 5.3, ISLE.z0 + 125, .4, .25, .4, 0xffe0b0, 11); coastLight(xp, 5, ISLE.z0 + 125, 0xffd8a0, 12, .8); }
  const m = new T.Mesh(k.build(), MAT.uber); scene.add(m); cullAdd(m, 900);
  coastLight(x, 33, z, 0xfff0c0, 22, 1.4);
  // 旋轉的光束：兩道往外的長錐（加法混合，越遠越淡）
  const bg = new T.CylinderGeometry(16, .6, 420, 20, 1, true); bg.rotateZ(-Math.PI / 2); bg.translate(210, 0, 0);
  const bm = new T.ShaderMaterial({ uniforms: shared(ALLU), transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    vertexShader: `varying float vT; varying vec3 vW; void main(){ vT = position.x / 420.; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uFogDen; varying float vT; varying vec3 vW; void main(){ float a = pow(1. - clamp(vT, 0., 1.), 2.4) * smoothstep(0., .03, vT) * .07; gl_FragColor = vec4(vec3(1., .93, .75) * a, 1.); }` });
  for (const s of [0, Math.PI]) { const b = new T.Mesh(bg, bm); b.rotation.y = s; b.layers.set(LY.NOREFL); b.frustumCulled = false; beacon.add(b); }
  beacon.position.set(x, 33, z); scene.add(beacon);
  // 以檔案開啟（或模型下載失敗）時的替身：兩個基地上的程式方塊
  const pk = new Kit();
  for (const s of sites) {
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, bx = s.x + Math.cos(a) * s.w * .32, bz = s.z + Math.sin(a) * s.d * .32, h = 10 + r2() * 14;
      pk.box(bx, h / 2, bz, 12, h, 12, 0x3a3836, 2);
      for (let f = 1; f < h / 3.2; f++) if (r2() < .4) pk.box(bx, f * 3.2, bz + 6.02, 2.2, 1.3, .05, 0xffd8a0, 11);
    }
  }
  const proxy = new T.Mesh(pk.build(), MAT.uber); scene.add(proxy); cullAdd(proxy, 700);
  // 兩個基地的燈：辦公園區四角的投光燈、廢墟裡幾堆營火（模型和替身都用得到）
  const O = ISLE_SITES.office, R = ISLE_SITES.ruin, lk = new Kit();
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const lx = O.x + sx * (O.w / 2 + 3), lz = O.z + sz * (O.d / 2 + 3);
    lk.cyl(lx, 4, lz, .1, .14, 8, 8, 0x22252a, 15).box(lx, 8.1, lz, .9, .3, .6, 0xe8f0ff, 11);
    coastLight(lx, 7.5, lz, 0xe0ecff, 24, 1.1);
  }
  for (const [dx, dz] of [[-8, -14], [10, 6], [-4, 20]]) {
    lk.cyl(R.x + dx, .25, R.z + dz, .6, .7, .5, 8, 0x2a2420, 2).box(R.x + dx, .6, R.z + dz, .5, .4, .5, 0xff8a30, 11);
    coastLight(R.x + dx, 1.2, R.z + dz, 0xff9040, 11, 1);
  }
  const lm = new T.Mesh(lk.build(), MAT.uber); scene.add(lm); cullAdd(lm, 700);
  ISLE_PROXY.isle = proxy;
  for (const s of sites) colliders.push({ x0: s.x - s.w * .42, x1: s.x + s.w * .42, z0: s.z - s.d * .42, z1: s.z + s.d * .42 });
}

// ─── 遠景：北面的山（國家公園）、西岸的對岸城區（以 http(s) 開啟時換成 golukumar 的 London City）、外海的小島、
// 東灣對岸的舊港城（換成 golukumar 的 City）。模型由 27-props.js 的 COAST_MODELS 下載擺放，擺好就把 ISLE_PROXY 的替身藏起來 ───
const FAR_BANK_X = CITY_X0 - OUT_D - 300, EAST_BANK_X = CITY_X1 + OUT_D + 300;
const FAR_SITES = {
  london: { x: FAR_BANK_X - 380, z: CITY_CZ, ry: 0 },    // 模型 719×1265 m，東緣貼著河岸，最高的塔在北端
  golu: { x: EAST_BANK_X + 110, z: CITY_CZ, ry: 0 },     // 模型 172×387 m，西排是倉庫與棚屋（背面朝城市）、東排是沿街立面
  s7: { x: EAST_BANK_X + 300, z: CITY_CZ - 60, ry: 0 },  // 舊港城後排的板樓群（street7 剩下的部分，164×265 m、最高 71 m），從城裡看是天際線
};
{
  const k = new Kit(), r2 = rng(4242);
  // 北嶺國家公園：三層山脊，越遠越高、越淡；山腳是一圈林線，零星幾盞管理站的燈
  for (const [zr, hmax, col, seg] of [[CITY_Z0 - 700, 140, 0x10180e, 90], [CITY_Z0 - 1300, 360, 0x0c120c, 80], [CITY_Z0 - 2300, 620, 0x0a0e10, 70]]) {
    const x0 = CITY_X0 - 2600, x1 = CITY_X1 + 2600, g = new T.PlaneGeometry(x1 - x0, 900, seg, 6); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, ph = r2() * 100;
    for (let i = 0; i < p.count; i++) {
      const x = (x0 + x1) / 2 + p.getX(i), zz = p.getZ(i), u = (450 - zz) / 900;   // u：0 前緣（城市那邊）→ 1 後緣
      const ridge = (.55 + .45 * Math.sin(x * .0021 + ph) * Math.sin(x * .0057 + ph * 2)) * (.75 + .25 * Math.sin(x * .013 + ph));
      p.setXYZ(i, x, Math.max(0, Math.sin(Math.min(1, u * 1.15) * Math.PI * .5)) * hmax * ridge, zr - 450 + zz);
    }
    g.computeVertexNormals();
    k.add(g, col, 2, null);
  }
  for (let i = 0; i < 26; i++) { const x = CITY_X0 - 1200 + r2() * (CITY_X1 - CITY_X0 + 2400), z = CITY_Z0 - 900 - r2() * 700; k.box(x, 40 + r2() * 120, z, 3, 3, 3, 0xffc880, 11); }
  // 外海的小島：低矮的岩丘，有幾盞燈
  for (const [ix, iz, r, h] of [[CITY_X1 + 1300, SHORE_Z + 900, 260, 70], [CITY_X0 + 500, SHORE_Z + 1900, 380, 90], [CITY_X1 + 2200, CITY_Z0 + 400, 300, 90]]) {
    for (let j = 0; j < 4; j++) {   // 幾個壓扁的圓丘疊成不規則的島
      const rr = r * (.45 + r2() * .45), g = new T.SphereGeometry(rr, 20, 6, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, h * (.4 + r2() * .6) / rr, .55 + r2() * .3);
      g.translate(ix + (r2() - .5) * r, SEA_Y, iz + (r2() - .5) * r * .4); k.add(g, 0x0c100c, 2, null);
    }
    for (let j = 0; j < 6; j++) { const a = r2() * 6.3; k.box(ix + Math.cos(a) * r * .6, SEA_Y + h * .35, iz + Math.sin(a) * r * .4, 2, 2, 2, 0xffd8a0, 11); }
  }
  // 對岸：沿河的堤岸與一條地面；London City 的模型下載前先用程式剪影
  const bank = new T.PlaneGeometry(1800, CITY_Z1 - CITY_Z0 + 3000); bank.rotateX(-Math.PI / 2); bank.translate(FAR_BANK_X - 900, 0, CITY_CZ + 600);
  k.add(bank, 0x0e0f10, 2, null);
  k.box(FAR_BANK_X + 2, -1, CITY_CZ + 600, 4, 2, CITY_Z1 - CITY_Z0 + 3000, 0x2a2826, 2);
  for (let z = CITY_Z0 - 400; z < SHORE_Z + 800; z += 30) k.box(FAR_BANK_X - 4, 5, z, .5, .5, .5, 0xffc880, 11);
  scene.add(new T.Mesh(k.build(), MAT.far));
  const sk = new Kit();
  for (let i = 0; i < 70; i++) {
    const x = FAR_BANK_X - 40 - r2() * 700, z = CITY_Z0 - 300 + r2() * (SHORE_Z - CITY_Z0 + 900), w = 18 + r2() * 30, h = 20 + r2() * (r2() < .2 ? 160 : 60);
    sk.box(x, h / 2, z, w, h, w * (.6 + r2() * .8), 0x181a1e, 2);
    for (let f = 0; f < 18; f++) if (r2() < .5) sk.box(x + w / 2 + .05, 2 + r2() * (h - 4), z + (r2() - .5) * w * .8, .05, 1.2, 1.8, r2() < .8 ? 0xffd8a0 : 0x9ad0ff, 11);
  }
  const farProxy = new T.Mesh(sk.build(), MAT.far); scene.add(farProxy);
  ISLE_PROXY.far = farProxy;
  // 東灣對岸：一條陸地、堤岸與岸邊的燈；舊港城模型下載前同樣先用程式剪影
  const ek = new Kit(), eb = new T.PlaneGeometry(900, 1700); eb.rotateX(-Math.PI / 2); eb.translate(EAST_BANK_X + 450, 0, CITY_CZ);
  ek.add(eb, 0x0e0f10, 2, null);
  ek.box(EAST_BANK_X - 2, -1, CITY_CZ, 4, 2, 1700, 0x2a2826, 2);
  for (let z = CITY_CZ - 820; z < CITY_CZ + 820; z += 34) ek.box(EAST_BANK_X + 4, 5, z, .5, .5, .5, 0xffc880, 11);
  scene.add(new T.Mesh(ek.build(), MAT.far));
  const gk = new Kit(), g0 = FAR_SITES.golu;
  for (let i = 0; i < 40; i++) {
    const x = g0.x - 80 + r2() * 160, z = g0.z - 190 + r2() * 380, w = 14 + r2() * 20, h = 8 + r2() * 26;
    gk.box(x, h / 2, z, w, h, w * (.6 + r2() * .6), 0x1c1a1a, 2);
    for (let f = 0; f < 8; f++) if (r2() < .55) gk.box(x - w / 2 - .05, 2 + r2() * (h - 4), z + (r2() - .5) * w * .7, .05, 1.2, 1.6, 0xffc890, 11);
  }
  const s7 = FAR_SITES.s7;
  for (let i = 0; i < 12; i++) {   // 後排的板樓
    const x = s7.x - 70 + r2() * 140, z = s7.z - 120 + r2() * 240, w = 18 + r2() * 14, h = 35 + r2() * 35;
    gk.box(x, h / 2, z, w, h, w * (.5 + r2() * .4), 0x1e1e20, 2);
    for (let f = 0; f < 14; f++) if (r2() < .5) gk.box(x - w / 2 - .05, 2 + r2() * (h - 4), z + (r2() - .5) * w * .7, .05, 1.2, 1.6, 0xffd8a0, 11);
  }
  const goluProxy = new T.Mesh(gk.build(), MAT.far); scene.add(goluProxy);
  ISLE_PROXY.golu = goluProxy;
}
// 每幀：摩天輪轉、車廂保持朝下；燈塔光束轉
function coastUpdate(t) {
  const a0 = t * .06;
  ferris.rotation.z = a0;
  const { x, y, z } = ferris.position;
  for (const c of cabins) { const a = c.userData.a + a0; c.position.set(x + Math.cos(a) * 20, y + Math.sin(a) * 20, z); }
  beacon.rotation.y = t * .55;
  // 貨櫃船：慢慢起伏（幾何是世界座標，只平移）
  if (harbor.ship) harbor.ship.position.y = Math.sin(t * .35) * .14;
  // 岸橋：每台 64 秒一輪，彼此錯開；船上放下吊具 → 吊起 → 小車往陸側 → 放到車道上 → 吊起 → 回到船上
  const H = harbor, ss = u => u * u * (3 - 2 * u), seg = (u, a, b) => ss(clamp((u - a) / (b - a), 0, 1));
  for (const c of H.cranes) {
    const ph = t / 64 + c.off, u = ph % 1, n = Math.floor(ph);
    if (n !== c.n) { c.n = n; c.box.geometry = c.cgs[(n * 7 + c.k * 3) % c.cgs.length]; }
    const go = seg(u, .2, .42) - seg(u, .72, .94);                       // 0 = 船上、1 = 陸側
    const down = u < .2 ? 1 - Math.abs(u - .1) / .1 : u > .42 && u < .72 ? 1 - Math.abs(u - .57) / .15 : 0;
    const lowY = u < .3 ? H.shipY + H.ship.position.y : H.landY;
    const y = lerp(H.hiY, lowY, ss(clamp(down * 1.6, 0, 1))), z = lerp(H.seaZ, H.landZ, go);
    const load = u >= .1 && u < .57;                                     // 船上扣住、到車道放下
    c.tr.position.set(c.cx, 41.4, z);
    c.wire.position.set(c.cx, 40.6, z); c.wire.scale.y = Math.max(.1, 40.6 - y - .3);
    c.sp.position.set(c.cx, y, z);
    c.box.visible = load; c.box.position.set(c.cx, y - 1.55, z);
  }
}
