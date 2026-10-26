// ═══ 海岸：南面的海與珊瑚灘、錨灣港的碼頭與貨櫃船、跨海橋過去的灰鷗島與燈塔、西面的灰鷺河、北面的山 ═══
// 地形矩形與擋牆在 10-city.js（LANDS、BEACH、QUAY、BRIDGE、ISLE、PIERS、groundH），這裡只建畫面、燈與設施的碰撞。
// 遠景（對岸、北面的山、外海的島）用 MAT.far：霧只算一部分距離。排在 20-props 之後（signLights、cell、signQuad、instanced 都已宣告）。

// ─── 水面：同一張倒影貼圖，城市底下不鋪（四塊環繞的平面）。照 Na Pali 海岸那支空拍片（深藍外海、近岸青綠、岸邊成片白沫）：
// 波紋是九道順著風向、波長從 60 m 一路減半的方向波（深水色散：長波走得快），疊兩層雜訊打散，遠處的短波淡掉免得閃；
// 離岸距離 tShore（下面 SHD 烘的距離場）決定淺水的顏色、一道道往岸上推的浪線與岸邊的白沫，白沫照路燈與日光打光 ───
await bootTick(11, "鋪海岸、碼頭與跨海橋…");
const WATER_FS = /* glsl */`
${GROUND_COMMON}
uniform sampler2D tTron, tShore; uniform vec3 uTronA, uTronB; uniform vec4 uTronG, uShore;
// 方向波：回傳水面高度，g 累加斜率（dh/dx, dh/dz）
float waves(vec2 p, float t, float dist, out vec2 g){
  float h = 0.; g = vec2(0);
  float L = 60.;
  for (int i = 0; i < 9; i++) {
    float fi = float(i), a = -.55 + (h21(vec2(fi, 3.7)) - .5) * 1.9;
    vec2 d = vec2(cos(a), sin(a));
    float k = 6.2832 / L, w = sqrt(9.8 * k), A = L * .0055 * smoothstep(L * 90., L * 25., dist);
    float ph = dot(d, p) * k - w * t + h21(vec2(fi, 9.1)) * 6.2832;
    float s = sin(ph), c = cos(ph);
    // 波峰尖、波谷平：(1+sin)^1.6 的形狀
    float b = 1. + s, sh = pow(b, 1.6);
    h += A * sh * .5; g += A * .8 * pow(b, .6) * c * k * d;
    L *= .62;
  }
  return h;
}
void main(){
  // 光格島（21-tron.js）：島上的海面不畫（下層街區低於海面），tTron 是陸地遮罩、uTronA／B 把世界座標換成島的模型座標
  vec2 tq = (vec2(dot(uTronA, vec3(vW.xz, 1.)), dot(uTronB, vec3(vW.xz, 1.))) - uTronG.xy) / uTronG.zw;
  if (tq.x > 0. && tq.y > 0. && tq.x < 1. && tq.y < 1. && texture2D(tTron, tq).r > .5) discard;
  vec2 p = vL; float t = uTime;
  float dist = length(vW - uCam);
  vec2 su = (vW.xz - uShore.xy) * uShore.z;
  float shore = su.x > 0. && su.y > 0. && su.x < 1. && su.y < 1. ? texture2D(tShore, su).r * uShore.w : uShore.w;   // 離岸幾公尺（遠於 uShore.w 都當外海）
  vec2 g; float h = waves(vW.xz, t, dist, g);
  vec2 g2 = vec2(n2(p*.33 + vec2(t*.32, -t*.2)), n2(p*.29 + vec2(-t*.26, t*.3) + 3.)) - .5;
  float calm = mix(.45, 1., smoothstep(4., 30., shore));   // 貼岸的水被浪花打亂、方向波弱一點
  vec3 n = vec3(-g.x * calm + g2.x*.16, 1., -g.y * calm + g2.y*.16);
  if (dist < 50.) n.xz += ripple(p*.7, uTime) * .3 * (1. - dist/50.);
  n = normalize(n);
  vec3 v = normalize(uCam - vW);
  float F = .02 + .98*pow(1. - max(dot(n, v), 0.), 5.);
  // 水體：外海深藍、淺水青綠（照環境光、日光與路燈打光，夜裡自然暗下去）；波峰透一點亮
  float sh = 1. - smoothstep(2., 26., shore + (n2(vW.xz*.03) - .5) * 8.);
  vec3 body = mix(vec3(.004,.016,.04), vec3(.012,.085,.085), sh) * (1. + clamp(h, -.3, .6) * .9);
  vec3 c = shade(vW, vec3(0., 1., 0.), v, body, .95, 0.) + shade(vW, n, v, vec3(0.), .1, 0.);
  vec3 rc;
  if (uReflOn > .5) rc = reflSample(vRP.xy / vRP.w + n.xz * vec2(.05, .11), .003 + min(dist, 600.)*.00003);
  else rc = envMap(reflect(-v, n));
  c = mix(c, rc, clamp(.18 + F*.85, 0., 1.) * (1. - sh * .35));
  // 白沫：岸邊一圈（寬度隨雜訊起伏）＋一道道往岸上推的浪線（越靠岸越密、退下去會散）＋外海偶爾的白頭浪；
  // 花紋是兩層順著水流漂的細胞雜訊（中間鏤空的蕾絲狀）
  vec2 fp = vW.xz + g * 6.;
  float lace = smoothstep(.42, .72, fbm(fp*.21 + vec2(t*.07, -t*.05))) * .7 + smoothstep(.55, .8, n2(fp*.9 - t*.3)) * .5;
  float band = 1. - smoothstep(1., 5. + 7.*n2(vW.xz*.02 + t*.02), shore);
  float wv = fract(shore / 11. + t * .11 + n2(vW.xz*.015) * .6), line = smoothstep(.0, .05, wv) * smoothstep(.3, .08, wv) * (1. - smoothstep(4., 24., shore));
  float cap = smoothstep(.95, 1.2, h + (n2(vW.xz*.11 + t*.15) - .5) * .3) * smoothstep(300., 80., dist) * .3;
  float foam = clamp(band * (.2 + .9*lace) + line * lace * .9 + cap * lace, 0., 1.) * smoothstep(1800., 500., dist);
  c = mix(c, shade(vW, normalize(vec3(n.x*.3, 1., n.z*.3)), v, vec3(.62,.66,.68), .85, 0.), foam);
  gl_FragColor = vec4(applyFog(c, vW), 1.);
}`;
// 沙灘：乾沙、近水的濕沙（會反光）、浪花線
const SAND_FS = /* glsl */`
${GROUND_COMMON}
uniform float uSea;
void main(){
  vec2 p = vL;
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
  vec2 p = vL;
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
  vec2 p = vL;
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
  vec2 p = vL;
  float bx = p.x / .28, row = floor(bx), seam = smoothstep(.0, .08, fract(bx)) * smoothstep(1., .92, fract(bx));
  float off = h21(vec2(row, 1.)) * 3.2, end = step(.04, fract((p.y + off) / 3.2));
  vec3 alb = vec3(.09,.062,.042) * (.7 + .5*h21(vec2(row, floor((p.y + off) / 3.2)))) * (.85 + .3*n2(vec2(p.x*3., p.y*.3))) * mix(.35, 1., seam * end);
  float pud = smoothstep(.62, .72, fbm(p*.3 + 4.)) * seam;
  vec3 c = wetSurface(alb, normalize(vN), .7, pud, 0.);
  gl_FragColor = vec4(applyFog(c, vW), 1.);
}`;
const groundMat = (fs, u = {}) => new T.ShaderMaterial({ uniforms: { ...shared(ALLU), ...reflU, ...u }, vertexShader: GROUND_VS, fragmentShader: fs });
// 離岸距離場：城市外緣往外一圈（含灰鷗島、光格島）切成方格，每格是不是陸地（陸地、沙灘露出水面的部分、山與對岸、光格島），
// 再做精確的歐氏距離轉換（Felzenszwalb），存成 0–SHD_MAX m 的 8 位元貼圖。uShore：原點 x、z，1/邊長，SHD_MAX
const SHD_MAX = 80;
const SHD = (() => {
  const t0 = performance.now();
  let x0 = CITY_BB.x0 - 500, x1 = CITY_BB.x1 + 500, z0 = CITY_BB.z0 - 500, z1 = CITY_BB.z1 + 500;
  const grow = ([x, z], r) => { x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); z0 = Math.min(z0, z - r); z1 = Math.max(z1, z + r); };
  for (const c of rectW(ISLE.x0, ISLE.x1, ISLE.z0, ISLE.z1)) grow(c, 200);
  grow(toW(TRON_SITE.x, TRON_SITE.z, TRON_SITE.zn), 500);
  const N = LOW ? 512 : 1024, size = Math.max(x1 - x0, z1 - z0), cs = size / N, INF = 1e12;
  const f = new Float64Array(N * N);
  const isLand = (i, j) => { const X = x0 + (i + .5) * cs, Z = z0 + (j + .5) * cs; return landW(X, Z) ? groundH(X, Z) > SEA_Y + .02 : hillH(X, Z) > SEA_Y || tronLandW(X, Z); };
  // 陸地判定是大頭：先每 B 格取一點，四角一致的方塊整塊填，不一致的才逐格判定（窄於 B 格的陸地，例如木棧，會漏掉，水從底下過也說得通）
  const B = 4, M = N / B, cn = new Uint8Array((M + 1) * (M + 1));
  for (let j = 0; j <= M; j++) for (let i = 0; i <= M; i++) cn[j * (M + 1) + i] = isLand(Math.min(i * B, N - 1), Math.min(j * B, N - 1)) ? 1 : 0;
  for (let bj = 0; bj < M; bj++) for (let bi = 0; bi < M; bi++) {
    const k = bj * (M + 1) + bi, c = cn[k], same = c === cn[k + 1] && c === cn[k + M + 1] && c === cn[k + M + 2];
    for (let j = bj * B; j < bj * B + B; j++) for (let i = bi * B; i < bi * B + B; i++) f[j * N + i] = (same ? c : isLand(i, j)) ? 0 : INF;
  }
  const t1 = performance.now();
  // 一維平方距離轉換（下包絡拋物線），先列後行
  const d = new Float64Array(N), v = new Int32Array(N), zz = new Float64Array(N + 1), row = new Float64Array(N);
  const edt = () => {
    let k = 0; v[0] = 0; zz[0] = -INF; zz[1] = INF;
    for (let q = 1; q < N; q++) {
      let s; while ((s = ((row[q] + q * q) - (row[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])) <= zz[k]) k--;
      k++; v[k] = q; zz[k] = s; zz[k + 1] = INF;
    }
    k = 0; for (let q = 0; q < N; q++) { while (zz[k + 1] < q) k++; d[q] = (q - v[k]) ** 2 + row[v[k]]; }
  };
  for (let j = 0; j < N; j++) { for (let i = 0; i < N; i++) row[i] = f[j * N + i]; edt(); for (let i = 0; i < N; i++) f[j * N + i] = d[i]; }
  const px = new Uint8Array(N * N);
  for (let i = 0; i < N; i++) { for (let j = 0; j < N; j++) row[j] = f[j * N + i]; edt(); for (let j = 0; j < N; j++) px[j * N + i] = Math.min(255, Math.round(Math.sqrt(d[j]) * cs / SHD_MAX * 255)); }
  const tex = new T.DataTexture(px, N, N, T.RedFormat, T.UnsignedByteType);
  tex.minFilter = tex.magFilter = T.LinearFilter; tex.needsUpdate = true;
  if (location.search.includes('shoreLog')) console.log(`離岸距離場 ${N}² · ${cs.toFixed(1)} m/格 · ${(performance.now() - t0).toFixed(0)} ms（陸地 ${(t1 - t0).toFixed(0)}）`);
  return { tex, u: new T.Vector4(x0, z0, 1 / size, SHD_MAX) };
})();
const MAT_WATER = groundMat(WATER_FS, { tTron: { value: null }, uTronA: { value: V3() }, uTronB: { value: V3() }, uTronG: { value: new T.Vector4(1e9, 1e9, 1, 1) },
  tShore: { value: SHD.tex }, uShore: { value: SHD.u } }), MAT_PLANK = groundMat(PLANK_FS);
{
  // 灰鷺河、南面的海、東面的海灣：一整張世界座標的水面（各區轉過、拉開之後，岸線與區之間的縫都還在水上；陸地蓋在上面）。
  // 最後才畫，被陸地擋住的部分不必算
  const g = new T.PlaneGeometry(14000, 14000); g.rotateX(-Math.PI / 2); g.translate(CITY_CX, SEA_Y, CITY_CZ + 3000);
  const water = new T.Mesh(g, MAT_WATER); water.frustumCulled = false; water.renderOrder = 1; groundAdd(water, null);
}
// 河對岸（還有對岸的 London City 模型，27-props.js）跟著舊城那一片（A1，沒有轉）：對岸只到 FAR_Z1，再往南是河口與海
const FAR_ZN = ZONES[0];
const FAR_PARTS = [{ zn: FAR_ZN, z0: -1e5, z1: FAR_Z1 }];
// 游泳與開船：世界座標的點擋在對岸堤岸外 4 m、外緣外的山（hillH 高過水面）以外。對岸步道（10-city.js 的 BANK_WALKS）那一段擋到岸邊為止，前面有擋牆與梯子，靠得了岸
function farClamp(X, Z) {
  let [x, z] = toL(X, Z, FAR_ZN);
  const B = BANK_WALKS[0], lim = z > B.z0 - 4 && z < B.z1 + 4 ? 0 : 4;
  if (z < FAR_Z1 + 2 && x < FAR_BANK_X + lim) { x = FAR_BANK_X + lim; [X, Z] = toW(x, z, FAR_ZN); }
  return [X, Z];
}
// 沙灘：沿 z 切 40 段，高度和 groundH 一樣（往海裡再多延伸一段，讓水面切出岸線）
{
  // 往陸地多伸 INLAND（平的，蓋過外緣的草地邊）
  const L = BEACH.len + 30 + INLAND, z0 = BEACH.z0 - INLAND, g = new T.PlaneGeometry(BEACH.x1 - BEACH.x0, L, Math.ceil((BEACH.x1 - BEACH.x0) / WARP_SEG), 48); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = z0 + L / 2 + p.getZ(i);
    p.setXYZ(i, (BEACH.x0 + BEACH.x1) / 2 + p.getX(i), -clamp((z - BEACH.z0) / BEACH.len, 0, 1.3) * BEACH.drop + .001, z);
  }
  g.computeVertexNormals();
  groundAdd(new T.Mesh(g, groundMat(SAND_FS, { uSea: { value: SEA_Y } })));
}
// 碼頭面與島面：上表面 y = 0，側面一路到水下
{
  const slab = (r, mat, depth = 4) => { const g = new T.BoxGeometry(r.x1 - r.x0, depth, r.z1 - r.z0); g.translate((r.x0 + r.x1) / 2, -depth / 2, (r.z0 + r.z1) / 2); groundAdd(new T.Mesh(g, mat)); };
  slab({ ...QUAY, z0: QUAY.z0 - INLAND }, groundMat(QUAY_FS, { uQuay: { value: new T.Vector4(QUAY.x0, QUAY.x1, QUAY.z0, QUAY.z1) } }));
  slab(ISLE, groundMat(ISLE_FS, { uIsle: { value: new T.Vector4(BRIDGE_X, ISLE.z0 + 120, ISLE.z0 + 120, 0) } }), 6);
}

// 山的頂點色：林線以下深綠、往上轉成岩色（21-rail.js 的山頭蓋板也照它，接得上山坡）
const HILL_CA = new T.Color(0x0e170c), HILL_CB = new T.Color(0x1c1a16), HILL_CC = new T.Color(0x2a2a2c);
const hillColor = (c, X, Z, h) => c.copy(HILL_CA).lerp(HILL_CB, clamp((h - 60) / 160, 0, 1)).lerp(HILL_CC, clamp((h - 260) / 200, 0, 1)).multiplyScalar(.85 + .3 * Math.sin(X * .013 + Z * .009));

// ─── 擋牆旁的欄杆、步道路燈 ───
const coastLights = [];   // 也放進 signLights（60-venues 會複製成 outLights）
const coastLight = (x, y, z, col, r, i) => { const l = { x, y, z, col: lin(col), r, i }; signLights.push(l); coastLights.push(l); return l; };
{
  const kits = new Map(), posts = [];
  for (const b0 of colliders) {
    if (!b0.low || b0.zn || b0.swim) continue;   // zn：05-zones 縫端斜放的擋牆，不裝欄杆；swim：梯子前的缺口（10-city.js 的 LADDERS）
    for (const b of zoneClip(b0.x0, b0.x1, b0.z0, b0.z1)) {   // 跨區的長擋牆切成各區的部分，欄杆與路燈照所在的區掛
      if (!kits.has(b.zn)) kits.set(b.zn, new Kit());
      const k = kits.get(b.zn);
      // 擋牆貼著地的那一面：外側 0.6 m 是陸地的那一邊
      const sides = [['z0', (b.x0 + b.x1) / 2, b.z0 - .6], ['z1', (b.x0 + b.x1) / 2, b.z1 + .6], ['x0', b.x0 - .6, (b.z0 + b.z1) / 2], ['x1', b.x1 + .6, (b.z0 + b.z1) / 2]];
      const s = sides.find(([, x, z]) => inLand(x, z));
      if (!s) continue;
      const [f, lx, lz] = s, h = groundHL(lx, lz);
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
  }
  // 外緣臨水的邊（10-city.js 的 SHORE，世界座標；以前的岬角 CAPES 也一樣）：裝一樣的欄杆，邊緣是往下到水裡的石砌護岸，每 30 m 一盞步道路燈
  const hk = new Kit(), stone = new T.BufferGeometry();
  const sp = [], sn = [];
  for (const h of [...CAPES, SHORE, ...LAKE_SHORES]) {
    const n = h.pts.length, area = shoreSide(h);
    let run = 12;
    for (let k = 0; k < n; k++) {
      if (!h.wet[k]) continue;
      const p = h.pts[k], q = h.pts[(k + 1) % n], dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz);
      if (len < .01) continue;
      const ux = dx / len, uz = dz / len, ix = -uz * area, iz = ux * area;   // (ix, iz)：往岬角裡面
      const ry = Math.atan2(-uz, ux), mx = (p[0] + q[0]) / 2 + ix * .15, mz = (p[1] + q[1]) / 2 + iz * .15;
      hk.box(mx, 1.05, mz, len + .08, .07, .07, 0x2c3036, 15, 0, ry).box(mx, .55, mz, len + .08, .04, .04, 0x2c3036, 15, 0, ry);
      for (let a = 0; a < len; a += 2.4) posts.push({ x: p[0] + ux * a + ix * .15, y: 0, z: p[1] + uz * a + iz * .15, zn: null });
      // 護岸：從地面（0）直直往下到水面以下，法線朝外
      const y0 = .02, y1 = SEA_Y - 2.4, ox = -ix, oz = -iz, [a0, b0] = area > 0 ? [p, q] : [q, p];   // 繞向依多邊形的方向，正面朝外
      for (const [a, b, c] of [[[a0[0], y0, a0[1]], [b0[0], y0, b0[1]], [b0[0], y1, b0[1]]], [[a0[0], y0, a0[1]], [b0[0], y1, b0[1]], [a0[0], y1, a0[1]]]]) { sp.push(...a, ...b, ...c); sn.push(ox, 0, oz, ox, 0, oz, ox, 0, oz); }
      for (let a = run; a < len; a += 30) {
        const x = p[0] + ux * a + ix * .6, z = p[1] + uz * a + iz * .6;   // 欄杆與碎石步道之間
        circles.push({ x, z, r: .18, w: 1 });
        hk.cyl(x, 2.6, z, .07, .09, 5.2, 8, 0x22252a, 15).cyl(x, 5.3, z, .26, .18, .32, 10, 0x1a1c20, 15).cyl(x, 5.08, z, .22, .22, .08, 10, 0xffe2b0, 11);
        coastLight(x, 5, z, 0xffd8a0, 13, .85).w = 1;
        run = a + 30;
      }
      run -= len;
    }
  }
  stone.setAttribute('position', new T.Float32BufferAttribute(sp, 3)); stone.setAttribute('normal', new T.Float32BufferAttribute(sn, 3));
  hk.add(stone, 0x3a3832, 2, null);
  instanced(new Kit().box(0, .55, 0, .08, 1.1, .08, 0x2c3036, 15).build(), MAT.uber, posts, LY.NOREFL);
  for (const [zn, k] of kits) cityAdd(new T.Mesh(k.build(), MAT.uber), zn);
  cityAdd(new T.Mesh(hk.build(), MAT.uber), null);
}

// 梯子（10-city.js 的 LADDERS）：貼著岸邊的鋼梯，從水面下 1 m 到岸上，頂上兩根彎出來的扶手；旁邊一盞小燈
{
  const kits = new Map();
  for (const L of LADDERS) {
    if (!L.ok) continue;
    const zn = L.w ? null : zoneAtL(L.x, L.z);   // w：外緣上的梯子是世界座標
    if (!kits.has(zn)) kits.set(zn, new Kit());
    const k = kits.get(zn), top = Math.max(0, L.w ? groundH(L.x - L.nx * .6, L.z - L.nz * .6) : groundHL(L.x - L.nx * .6, L.z - L.nz * .6)), y0 = SEA_Y - 1, h = top - y0;
    const ry = Math.atan2(L.nx, L.nz), tx = L.nz, tz = -L.nx;   // (tx, tz)：沿著岸
    const at = (a, o, y) => [L.x + tx * a + L.nx * o, y, L.z + tz * a + L.nz * o];
    for (const s of [-.24, .24]) {
      k.box(...at(s, .1, y0 + h / 2), .06, h, .06, 0x8a8e94, 15, 0, ry);
      k.box(...at(s, -.05, top + .55), .05, 1.1, .05, 0x8a8e94, 15, 0, ry).box(...at(s, .03, top + 1.08), .05, .05, .2, 0x8a8e94, 15, 0, ry);
    }
    for (let y = y0 + .25; y < top; y += .3) k.box(...at(0, .1, y), .48, .04, .04, 0x9a9ea4, 15, 0, ry);
    k.box(...at(.75, -.3, top + .45), .12, .9, .12, 0x22252a, 15, 0, ry).box(...at(.75, -.3, top + .95), .2, .1, .2, 0x9ae0ff, 11, 0, ry);
    coastLight(...at(.75, .2, top + .9), 0x9ad8ff, 6, .5);
  }
  for (const [zn, k] of kits) cityAdd(new T.Mesh(k.build(), MAT.uber), zn);
}

// ─── 珊瑚灘：救生員塔、收起來的陽傘、排球網、步道上的椰子樹；棧橋盡頭的霓虹摩天輪 ───
const palms = [], lifeguards = [], beachUmbs = [];   // World 第四輪之二（27-props.js 檔尾）以 http(s) 開啟時換成模型
let palmMesh, guardMesh, beachUmbMesh;
{
  const k = new Kit(), gk = new Kit(), uk = new Kit(), r2 = rng(2027);
  for (const x of [avX(1) + 20, avX(5) + 10, avX(8) + 30]) {   // 救生員塔：木架、白色小屋、紅旗
    const z = BEACH.z0 + 24, y = groundHL(x, z);
    lifeguards.push({ x, z, y });
    const k = gk;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(x + sx * 1.1, y + 1.4, z + sz * 1.1, .16, 2.8, .16, 0xd8d0c0, 2);
    k.box(x, y + 2.9, z, 2.8, .14, 2.8, 0xc8bca8, 2).box(x, y + 3.9, z, 2.4, 1.8, 2.2, 0xe8e2d6, 10).box(x, y + 4.95, z, 3, .16, 2.8, 0xb83020, 10)
      .box(x, y + 4, z + 1.11, 1.8, .8, .04, 0x10161c, 1).cyl(x + 1.6, y + 4.5, z - 1, .03, .03, 3.4, 6, 0x888888, 3).box(x + 1.95, y + 5.8, z - 1, .7, .45, .02, 0xd02018, 11);
    circles.push({ x, z, r: 1.7 });
    k.box(x, y + 5.2, z + 1.2, .5, .3, .3, 0xfff0d0, 11); coastLight(x, y + 5, z + 2, 0xffe8c8, 22, 1.1);
  }
  for (let x = BEACH.x0 + 25; x < BEACH.x1 - 20; x += 14 + r2() * 10) {   // 收起來的陽傘
    if (Math.abs(x - avX(4)) < 14) continue;
    const z = BEACH.z0 + 8 + r2() * 14, y = groundHL(x, z), col = [0xc8442c, 0x2c6ea8, 0xe0b040, 0x2a8a6a][Math.floor(r2() * 4)];
    uk.cyl(x, y + 1.3, z, .03, .03, 2.6, 6, 0xdddddd, 3).cyl(x, y + 1.9, z, .16, .05, 1.3, 8, col, 2);
    beachUmbs.push({ x, z, y, ry: x * 1.7 % 6.28 });
  }
  { const x = avX(6) + 30, z = BEACH.z0 + 18, y = groundHL(x, z);   // 排球網
    for (const s of [-1, 1]) k.cyl(x + s * 4.6, y + 1.2, z, .05, .05, 2.4, 6, 0xcccccc, 3);
    k.box(x, y + 2.1, z, 9.2, .7, .02, 0x202020, 2); }
  cityAdd(new T.Mesh(k.build(), MAT.uber));
  guardMesh = cityAdd(new T.Mesh(gk.build(), MAT.uber)); beachUmbMesh = cityAdd(new T.Mesh(uk.build(), MAT.uber));
  // 椰子樹：沙灘靠陸地那一側一排（外緣邊上、碼頭區沒有）
  for (let x = CITY_X0 - OUT_D + 8; x < BEACH_X1 - 6; x += 16 + r2() * 6) {
    const z = SHORE_Z - 8 - r2() * 4;
    if (Math.abs(x - avX(4)) < 9 || !free(x, z, 1.2) || !landL(x, z)) continue;
    palms.push({ x, z, y: 0, ry: r2() * 6.3, s: .9 + r2() * .35, rz: (r2() - .5) * .14 }); claim(x, z, 1.2); circles.push({ x, z, r: .3 });
  }
  const pk = new Kit();
  for (let i = 0; i < 6; i++) pk.cyl(Math.sin(i * .25) * .25 * i * .2, .9 + i * 1.6, 0, .17 - i * .015, .2 - i * .015, 1.7, 7, 0x4a3a2a, 2, 0, 0, -.04 * i);
  for (let i = 0; i < 8; i++) {   // 葉子：往外垂的薄片
    const a = i / 8 * Math.PI * 2;
    pk.box(Math.cos(a) * 1.9, 9.3, Math.sin(a) * 1.9, 3.6, .05, .7, 0x2a4a22, 2, 0, -a, -.45);
  }
  palmMesh = instanced(pk.build(), MAT.uber, palms);
}
// 步道的長椅與花台：南面海濱（珊瑚灘那段）面向海、西面灰鷺河濱面向河，貼著欄杆內側，長椅與花台交錯
const benches = [], planters = [], capePicnic = [];
let benchMesh, planterShrubMesh;
{
  const put = (x, z, ry, alongX) => {
    if (!free(x, z, 1.6)) return;
    const list = (benches.length + planters.length) % 3 === 2 ? planters : benches;
    list.push({ x, z, y: .15, ry }); claim(x, z, 1.6);
    const hw = list === planters ? 1.6 : 1.1, hd = list === planters ? .7 : .45;
    colliders.push(alongX ? { x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd } : { x0: x - hd, x1: x + hd, z0: z - hw, z1: z + hw });
  };
  for (let x = CITY_X0 - OUT_D + 18; x < BEACH_X1 - 10; x += 21) if (Math.abs(x - avX(4)) > 10 && landL(x, SHORE_Z - 2.4)) put(x, SHORE_Z - 2.4, 0, true);
  // 對岸步道（BANK_WALKS）：靠水那側面向水，渡船碼頭前後讓開
  for (const [i, B] of BANK_WALKS.entries()) for (let z = B.z0 + 14; z < B.z1 - 10; z += 23) if (Math.abs(z - (FERRY[i].z0 + FERRY[i].z1) / 2) > 9) put(i ? B.x0 + 2.4 : B.x1 - 2.4, z, i ? -Math.PI / 2 : Math.PI / 2, false);
  // 外緣臨水的邊與岬角（世界座標）：碎石步道內側面向水，兩盞路燈中間一張
  for (const h of [...CAPES, SHORE, ...LAKE_SHORES]) {
    const n = h.pts.length, area = shoreSide(h);
    let run = 27;
    for (let k = 0; k < n; k++) {
      if (!h.wet[k]) continue;
      const p = h.pts[k], q = h.pts[(k + 1) % n], len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (len < .01) continue;
      const ux = (q[0] - p[0]) / len, uz = (q[1] - p[1]) / len, ix = -uz * area, iz = ux * area;
      for (let a = run; a < len; a += 30) {
        const x = p[0] + ux * a + ix * 4, z = p[1] + uz * a + iz * 4;
        if (!shoreLand(h, x, z)) { run = a + 30; continue; }
        benches.push({ x, z, y: 0, ry: Math.atan2(-ix, -iz), zn: null });
        colliders.push({ x0: -1.1, x1: 1.1, z0: -.45, z1: .45, zn: frameW(x, z, ux, uz) });
        run = a + 30;
      }
      run -= len;
    }
  }
  // 區之間的縫（20-props.js 的 SEAM_PATH）：步道兩側每 36 m 一張，面向步道，兩側交錯
  for (const run of SEAM_PATH) for (let i = 4, k = 0; i < run.length - 2; i += 7, k++) {
    const p = run[i], q = run[i + 1], l = Math.hypot(q.x - p.x, q.z - p.z) || 1, ux = (q.x - p.x) / l, uz = (q.z - p.z) / l, s = k % 2 ? 1 : -1;
    const x = p.x - uz * s * 2.4, z = p.z + ux * s * 2.4;
    benches.push({ x, z, y: 0, ry: Math.atan2(uz * s, -ux * s), zn: null });
    colliders.push({ x0: -1.1, x1: 1.1, z0: -.45, z1: .45, zn: frameW(x, z, ux, uz) });
  }
  // 長椅：鑄鐵腳、五條木板座面與靠背（正面朝 +z）
  const bk = new Kit();
  for (const sx of [-.85, .85]) bk.box(sx, .22, 0, .07, .44, .5, 0x1e2024, 15).box(sx, .62, -.24, .07, .5, .06, 0x1e2024, 15);
  for (let i = 0; i < 3; i++) bk.box(0, .46, -.16 + i * .14, 2.1, .04, .1, 0x6a4a30, 2);
  for (let i = 0; i < 2; i++) bk.box(0, .66 + i * .16, -.27, 2.1, .1, .03, 0x6a4a30, 2, -.12);
  benchMesh = instanced(bk.build(), MAT.uber, benches, LY.NOREFL);
  // 花台：混凝土槽、土、低矮灌木（灌木分開一個網格，換成模型時只拿掉灌木）
  const fk = new Kit(), sk = new Kit();
  fk.box(0, .3, 0, 3.2, .6, 1.4, 0x5a5854, 2).box(0, .58, 0, 3, .06, 1.2, 0x1a140e, 2);
  for (let i = 0; i < 4; i++) sk.add(new T.IcosahedronGeometry(.42 + (i % 2) * .1, 0), new T.Color().setHSL(.3, .45, .12 + (i % 3) * .02), 2, tf(-1.1 + i * .73, .82, (i % 2 - .5) * .3));
  instanced(fk.build(), MAT.uber, planters, LY.NOREFL);
  planterShrubMesh = instanced(sk.build(), MAT.uber, planters, LY.NOREFL);
  // 岬角的野餐桌（只有換成模型時才擺）：草地裡面、離樹 3 m 以上，每個岬角最多三張
  const r7 = rng(7373);
  for (const h of CAPES) {
    const [x0, x1, z0, z1] = h.bb;
    for (let n = 0, tries = 0; n < 3 && tries < 60; tries++) {
      const x = lerp(x0, x1, r7()), z = lerp(z0, z1, r7());
      if (!inPoly(h.inn, x, z) || trees.some(t => t.zn === null && (t.x - x) ** 2 + (t.z - z) ** 2 < 9) || capePicnic.some(t => (t.x - x) ** 2 + (t.z - z) ** 2 < 100)) continue;
      capePicnic.push({ kind: 'picnic', x, z, y: 0, ry: r7() * 6.3, zn: null, w: 1 }); n++;
    }
  }
}
// 區之間的縫：碎石步道（草地 shader 的小徑顏色）、步道路燈，涼亭、茶亭與公廁（20-props.js 的 SEAM_PATH、SEAM_SITES，世界座標，掛在 scene）
{
  const mat = new T.ShaderMaterial({ uniforms: { ...shared(ALLU), ...reflU }, vertexShader: GROUND_VS, fragmentShader: LAWN_FS.replace(/float path = max\([^;]*\);/, 'float path = 1.;'),
    side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const wp = [], wn = [], k = new Kit();
  for (const run of SEAM_PATH) {
    const side = run.map((p, i) => { const a = run[Math.max(0, i - 1)], b = run[Math.min(run.length - 1, i + 1)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1; return [-(b.z - a.z) / l * 1.2, (b.x - a.x) / l * 1.2]; });
    for (let i = 0; i < run.length - 1; i++) {
      const p = run[i], q = run[i + 1], [ax, az] = side[i], [bx, bz] = side[i + 1];
      for (const [x, z] of [[p.x - ax, p.z - az], [q.x - bx, q.z - bz], [q.x + bx, q.z + bz], [p.x - ax, p.z - az], [q.x + bx, q.z + bz], [p.x + ax, p.z + az]]) { wp.push(x, .003, z); wn.push(0, 1, 0); }
    }
    // 路燈：每 36 m 一盞，和長椅錯開半格、在另一側
    for (let i = 8, n = 0; i < run.length - 2; i += 7, n++) {
      const p = run[i], [sx, sz] = side[i], s = n % 2 ? -1 : 1, x = p.x + sx * s * 1.7, z = p.z + sz * s * 1.7;
      circles.push({ x, z, r: .18, w: 1 });
      // 公園的柱頂燈（照常見的鑄鐵橡實燈）：裙邊底座、細柱與兩道箍、燈座、乳白燈罩（自發光）、頂蓋與尖頂
      k.lathe(x, 0, z, [[.2, 0], [.2, .32], [.15, .4], [.11, .56], [.075, .6]], 10, 0x22252a, TX.iron)
        .lathe(x, 0, z, [[.075, .6], [.06, 3.55], [.0, 3.55]], 8, 0x22252a, TX.iron)
        .cyl(x, 1.1, z, .085, .085, .06, 10, 0x22252a, TX.iron).cyl(x, 3.3, z, .08, .08, .05, 10, 0x22252a, TX.iron)
        .lathe(x, 0, z, [[.05, 3.55], [.13, 3.66], [.16, 3.72], [.16, 3.76]], 10, 0x1a1c20, TX.iron)
        .lathe(x, 0, z, [[.16, 3.76], [.24, 3.92], [.25, 4.08], [.2, 4.22], [.16, 4.26]], 10, 0xffe2b0, 11)
        .lathe(x, 0, z, [[.16, 4.26], [.22, 4.28], [.2, 4.33], [.07, 4.46], [.03, 4.62], [0, 4.66]], 10, 0x1a1c20, TX.iron);
      coastLight(x, 4, z, 0xffd8a0, 11, .75).w = 1;
    }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(wp, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(wn, 3)); g.computeBoundingSphere();
  groundAdd(new T.Mesh(g, mat), null);
  // 建物：局部座標正面朝 +z（步道那邊），用 tf 轉到世界
  for (const S of SEAM_SITES) {
    const at = (x, y, z) => { const c = Math.cos(S.ry), s = Math.sin(S.ry); return [S.x + x * c + z * s, y, S.z - x * s + z * c]; };
    // 局部座標的零件：每個都回傳 C，可以串接（C.box(...).cyl(...) 仍是局部座標）
    const C = {};
    const box = C.box = (x, y, z, w, h, d, col, m, rx = 0, ry = 0, rz = 0) => (k.box(...at(x, y, z), w, h, d, col, m, rx, S.ry + ry, rz), C);
    const cyl = C.cyl = (x, y, z, r0, r1, h, seg, col, m, rx = 0, ry = 0, rz = 0) => (k.cyl(...at(x, y, z), r0, r1, h, seg, col, m, rx, S.ry + ry, rz), C);
    const lathe = C.lathe = (x, y, z, pts, seg, col, m) => (k.lathe(...at(x, y, z), pts, seg, col, m, 0, S.ry), C);
    const prism = C.prism = (x, y, z, pts, d, col, m, rx = 0, ry = 0) => (k.prism(...at(x, y, z), pts, d, col, m, rx, S.ry + ry, 0), C);
    const bar = C.bar = (a, b, w, h, col, m) => (k.bar(...at(...a), ...at(...b), w, h, col, m), C);
    const rod = C.rod = (a, b, r, seg, col, m) => (k.rod(...at(...a), ...at(...b), r, seg, col, m), C);
    const WX = Math.abs(Math.sin(S.ry)) > .707 ? TX.woodZ : TX.woodX, WZ = WX === TX.woodX ? TX.woodZ : TX.woodX;   // 合併後是世界座標：木紋方向跟著建物轉
    // 斜屋頂：屋脊沿 x，兩片斜板（簷高 ey、脊高 ry0、半深 hd 含出簷、長 L），上面一條條立邊鋼板的肋、脊蓋與封簷板
    const gable = (L, hd, ey, ry0, col, rib, ribGap = .45) => {
      const a = Math.atan2(ry0 - ey, hd), sl = Math.hypot(ry0 - ey, hd);
      for (const s of [-1, 1]) {
        box(0, (ey + ry0) / 2 + .06, s * hd / 2, L, .1, sl, col, TX.sheet, s * a);
        for (let x = -L / 2 + ribGap / 2; x < L / 2; x += ribGap) bar([x, ey + .12, s * hd], [x, ry0 + .1, 0], .03, .04, rib, TX.sheet);
        box(0, ey - .02, s * (hd + .02), L + .1, .2, .05, 0x2a2622, WX);   // 封簷板
        box(0, ey - .1, s * (hd - .05), L, .08, .1, 0x5a5e62, TX.galv);       // 簷溝
      }
      box(0, ry0 + .14, 0, L + .1, .1, .22, rib, TX.sheet);
    };
    if (S.type === 'pavilion') {   // 涼亭（照公園的木構涼亭）：石砌台基與前後踏階、石墩上的方木柱與斜撐、一圈梁、外露的椽、四坡瓦頂與脊蓋、頂上的小氣窗亭與風向標尖、中間兩張野餐桌
      const stone = 0x6e6a62, wood = 0x4a3424, wood2 = 0x5e4430, roof = 0x2a3a34;
      box(0, .15, 0, 7.4, .3, 7.4, stone, TX.stone).box(0, .31, 0, 7.6, .04, 7.6, 0x857f74, TX.stone);
      for (const s of [-1, 1]) box(0, .08, s * 4.05, 2.4, .16, .7, stone, TX.stone);
      for (const [px, pz] of [[-3.2, -3.2], [3.2, -3.2], [-3.2, 3.2], [3.2, 3.2]]) {
        box(px, .55, pz, .44, .5, .44, 0x7a756b, TX.stone).box(px, .82, pz, .5, .06, .5, 0x8a8478, TX.stone);
        box(px, 2.0, pz, .24, 2.36, .24, wood, TX.woodY);
        for (const [dx, dz] of [[-Math.sign(px), 0], [0, -Math.sign(pz)]]) bar([px + dx * .1, 2.55, pz + dz * .1], [px + dx * .8, 3.15, pz + dz * .8], .1, .1, wood2, TX.woodY);   // 斜撐
        circles.push({ ...(([x, , z]) => ({ x, z }))(at(px, 0, pz)), r: .26, w: 1 });
      }
      for (const s of [-1, 1]) box(0, 3.25, s * 3.2, 7, .3, .2, wood2, WX).box(s * 3.2, 3.25, 0, .2, .3, 7, wood2, WZ);
      for (let t = -3; t <= 3.01; t += .75) for (const s of [-1, 1]) {   // 椽：從四邊往中心爬
        bar([t, 3.27, s * 3.7], [t * .25, 4.6, s * .9], .07, .12, wood, WX);
        bar([s * 3.7, 3.27, t], [s * .9, 4.6, t * .25], .07, .12, wood, WZ);
      }
      k.add(new T.ConeGeometry(5.6, 1.9, 4, 1, true), lin(roof), TX.sheet, tf(...at(0, 4.2, 0), 0, S.ry + Math.PI / 4));   // 開底：從亭子裡看得到椽與望板
      const ceil = new T.ConeGeometry(5.6, 1.9, 4, 1, true); ceil.setIndex(Array.from(ceil.index.array).reverse());
      k.add(ceil, lin(0x6a4c34), WX, tf(...at(0, 4.16, 0), 0, S.ry + Math.PI / 4));   // 望板（翻面朝下）
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; bar([Math.cos(a) * 5.5, 3.27, Math.sin(a) * 5.5], [0, 5.13, 0], .1, .1, 0x1e2a24, TX.sheet); }   // 脊蓋
      for (let y = 3.5; y < 4.9; y += .3) { const r = 5.6 * (5.15 - y) / 1.9 + .02; k.add(new T.CylinderGeometry(r, r, .025, 4, 1, true), lin(0x23312b), TX.sheet, tf(...at(0, y, 0), 0, S.ry + Math.PI / 4)); }   // 瓦列
      box(0, 5.25, 0, .9, .5, .9, wood2, WX);
      k.add(new T.ConeGeometry(.85, .6, 4, 1), lin(roof), TX.sheet, tf(...at(0, 5.8, 0), 0, S.ry + Math.PI / 4));
      cyl(0, 6.3, 0, .02, .02, .5, 4, 0x1a1c20, 15);
      for (const s of [-1, 1]) {   // 野餐桌
        for (let j = 0; j < 4; j++) box(s * 1.3 - .3 + j * .2, .99, 0, .18, .05, 2.2, j % 2 ? wood2 : 0x56402c, WZ);   // 桌面四片板、板間留縫
        for (const t of [-1, 1]) for (const j of [-1, 1]) box(s * 1.3 + t * .62 + j * .065, .71, 0, .12, .04, 2.2, wood2, WZ);
        for (const t of [-1, 1]) box(s * 1.3, .955, t * .8, .76, .04, .08, wood, WX);   // 桌面下的橫檔
        for (const t of [-1, 1]) bar([s * 1.3 - .55, .32, t * .8], [s * 1.3 + .55, .32, t * .8], .06, .06, wood, WX).bar([s * 1.3 - .3, .32, t * .8], [s * 1.3, .97, t * .8], .06, .06, wood, WX).bar([s * 1.3 + .3, .32, t * .8], [s * 1.3, .97, t * .8], .06, .06, wood, WX);
      }
      cyl(0, 3.05, 0, .25, .25, .15, 10, 0xffe2b0, 11);
      coastLight(...at(0, 2.9, 0), 0xffd8a0, 8, .8).w = 1;
    } else if (S.type === 'kiosk') {   // 茶亭（照公園的木造小賣亭）：直條木板牆、半拉起的鐵捲門賣窗與亮著的櫃內、檯面、條紋遮陽篷、出簷的屋頂與霓虹招牌、側門、菜單板、高腳凳
      const wood = 0x3a2a20, wood2 = 0x4a3628;
      box(0, .08, 0, 3.8, .16, 3, 0x5a5650, TX.conc);
      // 機身：後段實心，前面是牆框圍出賣窗（x ±1.3、y 0.95–2.25），裡面是櫃內
      box(0, 1.43, -.3, 3.4, 2.54, 2.0, 0x2a1e16, TX.woodY);
      box(0, .555, 1.0, 3.4, .79, .6, 0x2a1e16, TX.woodY).box(0, 2.48, 1.0, 3.4, .46, .6, 0x2a1e16, TX.woodY);
      for (const s of [-1, 1]) box(s * 1.5, 1.6, 1.0, .4, 1.3, .6, 0x2a1e16, TX.woodY);
      for (let x = -1.6; x <= 1.61; x += .2) {
        const c = (x * 5 | 0) % 2 ? wood : wood2;
        box(x, 1.43, -1.31, .17, 2.54, .03, c, TX.woodY);
        if (Math.abs(x) < 1.32) box(x, .555, 1.31, .17, .79, .03, c, TX.woodY).box(x, 2.48, 1.31, .17, .46, .03, c, TX.woodY);
        else box(x, 1.43, 1.31, .17, 2.54, .03, c, TX.woodY);
      }
      for (let z = -1.2; z <= 1.21; z += .2) for (const s of [-1, 1]) box(s * 1.71, 1.43, z, .03, 2.54, .17, (z * 5 | 0) % 2 ? wood : wood2, TX.woodY);
      box(0, 1.6, .71, 2.6, 1.3, .02, 0x8a6438, 11);    // 亮著的櫃內（後牆）
      box(0, .96, 1.0, 2.6, .02, .6, 0x3a2a20, WX).box(0, 2.24, 1.0, 2.6, .02, .6, 0x6a5a48, 11);
      for (const s of [-1, 1]) box(s * 1.29, 1.6, 1.0, .02, 1.3, .6, 0x4a3628, TX.woodY);
      for (let i = 0; i < 2; i++) box(0, 1.35 + i * .35, .82, 2.5, .03, .22, 0x6a4a30, WX);
      for (let i = 0; i < 18; i++) box(-1.05 + (i % 9) * .26, 1.45 + (i / 9 | 0) * .35, .82, .14, .16 + (i % 3) * .04, .12, [0xc84a2a, 0x2a8ac8, 0xe8c040, 0x3aa860][i % 4], 10);
      box(-.6, 1.12, 1.0, .5, .3, .4, 0x8a8e92, 3).box(.5, 1.06, .95, .36, .18, .3, 0x2a2c30, TX.iron);   // 櫃台上的保溫壺與收銀機
      cyl(0, 2.2, 1.36, .12, .12, 2.5, 10, 0x6a6c70, TX.galv, 0, 0, Math.PI / 2);   // 捲起的鐵捲門
      box(0, 2.15, 1.36, 2.62, .14, .06, 0x5a5c60, TX.galv);
      for (const s of [-1, 1]) box(s * 1.32, 1.6, 1.36, .08, 1.36, .08, 0x2a2622, WX);
      box(0, .98, 1.55, 2.8, .07, .5, 0x6a4a30, WX).box(0, .9, 1.35, 2.7, .1, .1, 0x2a2622, WX);
      for (const s of [-1, 1]) bar([s * 1.2, .5, 1.33], [s * 1.2, .95, 1.75], .05, .05, 0x2a2622, WX);
      for (let i = 0; i < 8; i++) box(-1.4 + i * .4 + .2, 2.55, 1.85, .4, .05, 1.1, i % 2 ? 0xe8e0d0 : 0xc84a2a, 2, -.35);   // 條紋遮陽篷
      for (let i = 0; i < 8; i++) box(-1.4 + i * .4 + .2, 2.28, 2.36, .4, .16, .02, i % 2 ? 0xe8e0d0 : 0xc84a2a, 2);
      for (const s of [-1, 1]) bar([s * 1.58, 2.74, 1.32], [s * 1.58, 2.3, 2.36], .03, .03, 0x2a2c30, TX.iron);
      box(0, 2.85, 0, 4, .12, 3.2, 0x1e1a18, TX.sheet).box(0, 2.94, 0, 3.7, .08, 2.9, 0x2a2622, WX);
      for (const s of [-1, 1]) box(0, 2.85, s * 1.6, 4.04, .22, .05, 0x3a2a20, WX).box(s * 2.0, 2.85, 0, .05, .22, 3.24, 0x3a2a20, WX);
      box(0, 3.25, 1.2, 2.6, .5, .1, 0x10161c, TX.woodY).box(0, 3.25, 1.26, 2.2, .3, .02, 0xff6ab0, 8);
      for (const s of [-1, 1]) bar([s * 1.1, 2.95, 1.15], [s * 1.1, 3.05, 1.15], .04, .04, 0x2a2c30, TX.iron);
      box(1.73, 1.2, -.4, .04, 2.1, .9, 0x2a2018, TX.woodY).box(1.76, 1.15, -.1, .04, .04, .14, 0x9a9a9a, 3);   // 側門
      box(-1.73, 1.9, .5, .04, .7, .9, 0x12161a, 2).box(-1.755, 1.9, .5, .01, .6, .8, 0xd8c8a0, 11);   // 菜單板
      box(-1.5, 2.45, -1.0, .5, .32, .4, 0xbab5a8, TX.sheet);   // 窗機
      for (const px of [-.8, 0, .8]) lathe(px, 0, 2.15, [[.2, 0], [.2, .03], [.04, .06], [.035, .7], [.18, .72], [.18, .78], [0, .79]], 10, px ? 0x22252a : 0x2a2c30, TX.iron);
      coastLight(...at(0, 2, 2.2), 0xffb070, 8, .9).w = 1;
    } else {   // 公廁（照公園的混凝土磚公廁）：台基、裂面混凝土磚牆與腰帶、轉角壁柱、立邊鋼板的雙坡頂與山牆百葉、兩扇鋼門與門框、男女標示、高窗百葉、門燈、中間的飲水機、落水管
      const cmu = 0x9a8f80, cmu2 = 0x857b6d;
      box(0, .08, 0, 6.6, .16, 4.0, 0x6e6a62, TX.conc);
      box(0, 1.48, 0, 6, 2.64, 3.4, cmu, TX.cmu);
      for (const s of [-1, 1]) box(0, .45, s * 1.71, 6.02, .6, .03, cmu2, TX.cmu).box(s * 3.01, .45, 0, .03, .6, 3.42, cmu2, TX.cmu);   // 勒腳
      for (const y of [1.2, 2.5]) for (const s of [-1, 1]) box(0, y, s * 1.71, 6.02, .08, .03, cmu2, TX.cmu).box(s * 3.01, y, 0, .03, .08, 3.42, cmu2, TX.cmu);
      for (const [x, z] of [[-3, -1.7], [3, -1.7], [-3, 1.7], [3, 1.7]]) box(x, 1.48, z, .3, 2.64, .3, cmu2, TX.cmu);
      gable(7.2, 2.3, 2.85, 3.85, 0x3c5a50, 0x4a6a5e);
      for (const s of [-1, 1]) {
        prism(s * 3, 2.8, 0, [[-1.7, 0], [1.7, 0], [0, .98]], .2, cmu, TX.cmu, 0, Math.PI / 2);
        box(s * 3.11, 3.15, 0, .03, .4, .6, 0x3a3e40, TX.galv);
        for (let i = 0; i < 4; i++) box(s * 3.13, 3.0 + i * .1, 0, .03, .02, .56, 0x6a6e70, TX.galv);
      }
      for (const px of [-1.6, 1.6]) {
        box(px, 1.18, 1.72, 1.12, 2.22, .06, 0x2a2e32, TX.iron).box(px, 1.12, 1.74, .96, 2.06, .04, px < 0 ? 0x2c4a5e : 0x5e2c3a, TX.iron);
        box(px, .2, 1.765, .96, .3, .01, 0x8a8e92, 3).box(px + .36, 1.1, 1.78, .04, .12, .06, 0x9a9a9a, 3);
        box(px, 2.5, 1.73, .4, .4, .02, px < 0 ? 0x2a6ab0 : 0xb03a5a, 10).box(px, 2.53, 1.745, .08, .2, .01, 0xf0f0f0, 10).cyl(px, 2.67, 1.745, .045, .045, .01, 8, 0xf0f0f0, 10, Math.PI / 2);
        box(px, 2.82, 1.78, .3, .1, .14, 0x1a1c20, TX.iron).box(px, 2.765, 1.8, .24, .02, .1, 0xfff0d8, 11);   // 門燈
      }
      for (const x of [-2.6, 2.6, 0]) for (const zz of [-1, 1]) if (zz < 0 || x === 0) { box(x, 2.3, zz * 1.72, .7, .3, .04, 0x3a3e40, TX.galv); for (let i = 0; i < 3; i++) box(x, 2.2 + i * .09, zz * 1.74, .66, .02, .03, 0x6a6e70, TX.galv); }
      lathe(0, 0, 1.95, [[.2, 0], [.2, .04], [.12, .1], [.1, .8], [.22, .85], [.22, .95], [0, .96]], 12, 0x7a7e82, 3);   // 飲水機
      for (const [x, z] of [[-3.1, 1.6], [3.1, -1.6]]) cyl(x, 1.45, z, .05, .05, 2.8, 6, 0x5a5e62, TX.galv);
      coastLight(...at(0, 2.6, 2.4), 0xfff0d8, 7, .7).w = 1;
    }
    const hw = S.type === 'pavilion' ? 0 : S.type === 'kiosk' ? 1.7 : 3, hd = S.type === 'kiosk' ? 1.3 : 1.7;
    if (hw) colliders.push({ x0: -hw, x1: hw, z0: -hd, z1: hd, zn: frameW(S.x, S.z, Math.cos(S.ry), -Math.sin(S.ry)) });
  }
  cityAdd(new T.Mesh(k.build(), MAT.ux), null);
}
// ─── 快速道路（06-roads.js 的 FWY，世界座標）：高架橋與上下坡。路面在 10-city.js 的連接道路網格裡（跟著 fwyH 抬高），這裡是橋的結構：
// 橋面兩側的路肩與護欄、橋面板（厚 DECK_T）、橋下的單柱橋墩與帽梁（離連接道路 HR + 3 m 以內不立）、坡道低於 PIER_H 的部分是實心的擋土牆；
// 中央的混凝土護欄（路口前後 HR + 6 m 斷開，單向的匝道沒有）；每條長的路段中間一座門架，兩面各掛一塊綠底白字的指示牌（面向那一邊的來車）。
// 分合流的地方兩座橋面疊在一起：落在另一座橋面上（高度差 2 m 內）的護欄、中央護欄與橋墩不蓋，車才開得過去。
// 碰撞：橋面夠高的地方，護欄只擋橋上的（ly），橋墩只擋地面的（hy）；坡道低的地方，兩側的牆什麼都擋（從旁邊上不去）───
const PIER_H = 4.5;
// 橋墩的柱身另外合併成 fwyPierMesh：以 http(s) 開啟時 27-props.js 換成 hwy.glb 的混凝土柱（FWY_PIERS 是位置、朝向與柱高），帽梁留著
const FWY_PIERS = [];
let fwyPierMesh = null;
{
  const k = new Kit(), pk = new Kit(), font = '"Avenir Next Condensed","DIN Condensed","Arial Narrow",system-ui,sans-serif';
  const signMat = new Map();
  const sign = F => {
    if (signMat.has(F)) return signMat.get(F);
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 320;
    const c = cv.getContext('2d');
    c.fillStyle = '#0d5a32'; c.fillRect(0, 0, 1024, 320); c.strokeStyle = '#e8efe8'; c.lineWidth = 10; c.strokeRect(14, 14, 996, 292);
    c.fillStyle = '#f2f6f2'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 112px ${font}`; c.fillText(F.name.toUpperCase(), 512, 120);
    c.font = `600 72px ${font}`; c.fillText(F.zh, 512, 236);
    const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 4;
    const m = new T.MeshBasicMaterial({ map: tx, toneMapped: false, color: 0xb8b8b8 });
    signMat.set(F, m); return m;
  };
  // 掃掠的四邊形：a、b、c、d 依序繞一圈，want 是該朝外的法線方向（繞錯就翻過來）
  const pos = [], nor = [], col = [];
  const quad = (a, b, c, d, want, color) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    let q = [a, b, c, a, c, d];
    if (nx * want[0] + ny * want[1] + nz * want[2] < 0) { q = [a, c, b, a, d, c]; nx = -nx; ny = -ny; nz = -nz; }
    const cc = lin(color);
    for (const p of q) { pos.push(...p); nor.push(nx, ny, nz); col.push(cc.r, cc.g, cc.b); }
  };
  const CONC = 0x8e8a82, CONC_D = 0x6e6a64, ROADSIDE = 0x4a4a4c;
  const conn = RN.edges.filter(e => e.kind === 'c' || e.kind === 'd');
  const segDist = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };
  const nearRoad = (x, z, r) => conn.some(e => e.pts.some(([px, pz], i) => i && segDist(x, z, e.pts[i - 1], [px, pz]) < r));
  const onOther = (x, z, e, h) => { const o = deckOn(x, z, e, -.4); return o && Math.abs(o.h - h) < 2; };
  for (const F of FWY) for (const e of F.edges || []) {
    const n = Math.max(2, Math.ceil(e.len / 3)), S = [], W = e.dw || DECK_W, HW = e.hw || HR;
    for (let i = 0; i <= n; i++) {
      const u = e.len * i / n, [x, z] = edgeAt(e, u), [xa, za] = edgeAt(e, Math.max(0, u - 1.2)), [xb, zb] = edgeAt(e, Math.min(e.len, u + 1.2)), l = Math.hypot(xb - xa, zb - za) || 1;
      S.push({ u, x, z, hx: (xb - xa) / l, hz: (zb - za) / l, h: fwyH(e, u), y0: inLake(x, z) ? LAKE_Y : 0 });   // y0：橋下的地面（天樞島的水道裡是水底）
    }
    for (let i = 1; i <= n; i++) {
      const A = S[i - 1], B = S[i];
      if (A.h <= .05 && B.h <= .05) continue;
      const up = A.h - A.y0 >= PIER_H && B.h - B.y0 >= PIER_H;   // 橋（下面空的）還是坡道（實心）；水上的匝道貼近水面也是橋
      const keep = [-1, 1].filter(sd => { const x = (A.x + B.x) / 2 - (A.hz + B.hz) / 2 * W * sd, z = (A.z + B.z) / 2 + (A.hx + B.hx) / 2 * W * sd; return !onOther(x, z, e, (A.h + B.h) / 2); });
      for (const sd of keep) {
        const P = (s, o, y) => [s.x - s.hz * o * sd, y, s.z + s.hx * o * sd], out = [-A.hz * sd, 0, A.hx * sd], inn = [A.hz * sd, 0, -A.hx * sd];
        const bA = up ? A.h - DECK_T : 0, bB = up ? B.h - DECK_T : 0;
        quad(P(A, W, bA), P(B, W, bB), P(B, W, B.h + 1), P(A, W, A.h + 1), out, CONC);   // 外側面（橋面板＋護欄，坡道到地面）
        if (up) quad(P(A, W + .02, A.h - .32), P(B, W + .02, B.h - .32), P(B, W + .02, B.h - .2), P(A, W + .02, A.h - .2), out, CONC_D);   // 橋面板與護欄的施工縫
        // 護欄內側照 F 型混凝土護欄的斷面：底下 8 cm 直立、往上 25 cm 緩坡、再陡坡到頂（頂寬 0.4 m 不變）
        const fP = [[W - .66, 0], [W - .66, .08], [W - .5, .33], [W - .4, 1]];
        for (let j = 1; j < fP.length; j++) quad(P(A, fP[j - 1][0], A.h + fP[j - 1][1]), P(B, fP[j - 1][0], B.h + fP[j - 1][1]), P(B, fP[j][0], B.h + fP[j][1]), P(A, fP[j][0], A.h + fP[j][1]), inn, j === 1 ? CONC_D : CONC);
        quad(P(A, W - .4, A.h + 1), P(B, W - .4, B.h + 1), P(B, W, B.h + 1), P(A, W, A.h + 1), [0, 1, 0], CONC_D);   // 護欄頂
        if (up) {   // 橋上：護欄頂的鋼欄杆（每段一根立柱、上面一根方管）
          const R = (s, o, y) => P(s, o, y);
          k.bar(...R(A, W - .2, A.h + 1), ...R(A, W - .2, A.h + 1.32), .06, .06, 0x5a5e64, TX.galv);
          for (const [o0, o1] of [[W - .25, W - .15]]) { quad(R(A, o0, A.h + 1.3), R(B, o0, B.h + 1.3), R(B, o1, B.h + 1.3), R(A, o1, A.h + 1.3), [0, 1, 0], 0x6a6e74); quad(R(A, o1, A.h + 1.22), R(B, o1, B.h + 1.22), R(B, o1, B.h + 1.3), R(A, o1, A.h + 1.3), out, 0x5a5e64); quad(R(A, o0, A.h + 1.22), R(B, o0, B.h + 1.22), R(B, o0, B.h + 1.3), R(A, o0, A.h + 1.3), inn, 0x5a5e64); }
        }
        quad(P(A, HW - .05, A.h + .006), P(B, HW - .05, B.h + .006), P(B, W - .4, B.h + .006), P(A, W - .4, A.h + .006), [0, 1, 0], ROADSIDE);   // 路肩
      }
      if (up) for (const sd of [-1, 1]) {
        const P = (s, o, y) => [s.x - s.hz * o * sd, y, s.z + s.hx * o * sd], out = [-A.hz * sd, 0, A.hx * sd], inn = [A.hz * sd, 0, -A.hx * sd];
        quad(P(A, 0, A.h - DECK_T), P(B, 0, B.h - DECK_T), P(B, W, B.h - DECK_T), P(A, W, A.h - DECK_T), [0, -1, 0], CONC_D);   // 橋面板底
        // 預力混凝土縱梁（照加州高架的 I 型梁）：每側兩根，腹板 0.35 m、梁深 1.1 m、下翼 0.7 m
        for (const c of [W * .28, W * .72]) {
          const yA = A.h - DECK_T, yB = B.h - DECK_T, d = 1.1;
          quad(P(A, c - .175, yA), P(B, c - .175, yB), P(B, c - .175, yB - d + .2), P(A, c - .175, yA - d + .2), inn, CONC);
          quad(P(A, c + .175, yA), P(B, c + .175, yB), P(B, c + .175, yB - d + .2), P(A, c + .175, yA - d + .2), out, CONC);
          quad(P(A, c - .35, yA - d + .2), P(B, c - .35, yB - d + .2), P(B, c - .35, yB - d), P(A, c - .35, yA - d), inn, CONC);
          quad(P(A, c + .35, yA - d + .2), P(B, c + .35, yB - d + .2), P(B, c + .35, yB - d), P(A, c + .35, yA - d), out, CONC);
          quad(P(A, c - .35, yA - d), P(B, c - .35, yB - d), P(B, c + .35, yB - d), P(A, c + .35, yA - d), [0, -1, 0], CONC_D);
          quad(P(A, c - .35, yA - d + .2), P(B, c - .35, yB - d + .2), P(B, c - .175, yB - d + .2), P(A, c - .175, yA - d + .2), [0, 1, 0], CONC);
          quad(P(A, c + .175, yA - d + .2), P(B, c + .175, yB - d + .2), P(B, c + .35, yB - d + .2), P(A, c + .35, yA - d + .2), [0, 1, 0], CONC);
        }
      }
      // 碰撞：每 3 m 一段、兩側各一個盒（局部 x 沿路，z 橫向；兩側對稱，不用管哪邊是正）
      const f = frameW(A.x, A.z, B.x - A.x, B.z - A.z), L = Math.hypot(B.x - A.x, B.z - A.z), lo = Math.min(A.h, B.h);
      // frameW 的局部 z 是 (−hz, hx)·sd 那一側取正：sd = 1 是 [W − .5, W + .3]
      for (const [z0, z1] of keep.map(sd => sd > 0 ? [W - .5, W + .3] : [-W - .3, -W + .5])) colliders.push(Object.assign({ x0: -.05, x1: L + .05, z0, z1, low: 1, zn: f }, up ? { ly: lo - 1.5 } : {}));
    }
    // 橋墩：每 26 m 一座，連接道路與斜的大道旁邊不立
    for (let u = 13; u < e.len - 13; u += 26) {
      const h = fwyH(e, u), [x, z, hx, hz] = edgeAt(e, u);
      if (h - (inLake(x, z) ? LAKE_Y : 0) < PIER_H + .5) continue;
      if (nearRoad(x, z, HR + 3) || deckOn(x, z, e, 1)) continue;   // 分合流處疊在別條路的橋面下的不立
      const top = h - DECK_T, ry = Math.atan2(hx, hz), y0 = inLake(x, z) ? LAKE_Y : 0;   // 天樞島的水道裡：柱子從水底立起
      pk.cyl(x, (top - .8 + y0) / 2, z, .95, 1.1, top - .8 - y0, 14, CONC, TX.conc);
      // 帽梁（照高架的槌頭帽梁）：中間深、往兩端收薄，梁底在縱梁下；頂上每根縱梁一塊橡膠支承墊
      const hw = W - .2, cb = top - 1.1;
      k.prism(x, cb, z, [[-hw, -.6], [-1.3, -1.5], [1.3, -1.5], [hw, -.6], [hw, 0], [-hw, 0]], 1.8, CONC_D, TX.conc, 0, ry);
      for (const c of [-W * .72, -W * .28, W * .28, W * .72]) k.box(x + Math.cos(ry) * c, cb + .05, z - Math.sin(ry) * c, .6, .1, .5, 0x2a2a2a, TX.rubber, 0, ry);
      FWY_PIERS.push({ x, z, ry, h: top - .8 - y0, y0 });
      circles.push({ x, z, r: 1.15, w: 1, hy: top - .6 });
    }
    // 中央護欄：銜接點的路口前後 HR + 6 m 斷開；橋上只擋橋上的
    const u0 = HR + 6, u1 = e.oneway ? 0 : e.len - HR - 6;
    for (let u = u0; u < u1 - .5; u += 6) {
      const ub = Math.min(u + 6, u1), [x0, z0] = edgeAt(e, u), [x1, z1] = edgeAt(e, ub), l = Math.hypot(x1 - x0, z1 - z0);
      if (l < .3 || onOther((x0 + x1) / 2, (z0 + z1) / 2, e, (fwyH(e, u) + fwyH(e, ub)) / 2)) continue;
      const ha = fwyH(e, u), hb = fwyH(e, ub), y = (ha + hb) / 2, ry = Math.atan2(-(z1 - z0), x1 - x0), rz = Math.atan2(hb - ha, l);
      // F 型混凝土分隔牆的斷面沿路段擠出（局部 z 沿路、x 橫向）
      k.prism((x0 + x1) / 2, y, (z0 + z1) / 2, [[-.31, 0], [.31, 0], [.31, .08], [.2, .33], [.1, .86], [-.1, .86], [-.2, .33], [-.31, .08]], l + .06, 0x9a968c, TX.conc, -rz, Math.atan2(x1 - x0, z1 - z0));
      colliders.push(Object.assign({ x0: -.03, x1: l + .03, z0: -.31, z1: .31, low: 1, zn: frameW(x0, z0, x1 - x0, z1 - z0) }, Math.min(ha, hb) >= PIER_H ? { ly: Math.min(ha, hb) - 1.5 } : {}));
    }
    if (e.len < 140 || e.ramp) continue;
    // 門架：兩根柱子立在路肩外（橋上立在護欄上）、橫樑離路面 7 m；牌子在橫樑兩面，各在那一邊車道的上方
    const [mx, mz, hx, hz] = edgeAt(e, e.len / 2), nx = -hz, nz = hx, gy = fwyH(e, e.len / 2), po = gy > .05 ? DECK_W - .2 : HR + 1.6;
    // 門架（照加州的桁架式標誌門架）：兩端各一組雙柱（底板、柱間綴條），上面是四根弦桿的空間桁架、腹桿交錯；牌子下面一條有欄杆的檢修走道
    const G = (a, b, y) => [mx + nx * a + hx * b, gy + y, mz + nz * a + hz * b], GS = 0x7a7e84;
    for (const sd of [-1, 1]) {
      const a = sd * po;
      for (const b of [-.45, .45]) { k.rod(...G(a, b, 0), ...G(a, b, 7.5), .13, 8, GS, TX.galv).box(...G(a, b, .05), .5, .1, .5, 0x5a5e64, TX.galv, 0, Math.atan2(nx, nz)); }
      for (let y = .6; y < 7.3; y += 1.1) { k.rod(...G(a, -.45, y), ...G(a, .45, y + .55), .035, 4, GS, TX.galv).rod(...G(a, .45, y + .55), ...G(a, -.45, y + 1.1), .035, 4, GS, TX.galv); }
      if (gy <= .05) circles.push({ x: mx + nx * a, z: mz + nz * a, r: .7, w: 1 });
    }
    for (const b of [-.45, .45]) for (const y of [6.5, 7.6]) k.rod(...G(-po - .3, b, y), ...G(po + .3, b, y), .07, 6, GS, TX.galv);
    for (let a = -po, j = 0; a < po - .1; a += 1.1, j++) {
      const a2 = Math.min(a + 1.1, po);
      for (const b of [-.45, .45]) k.rod(...G(a, b, j % 2 ? 6.5 : 7.6), ...G(a2, b, j % 2 ? 7.6 : 6.5), .03, 4, GS, TX.galv);
      for (const y of [6.5, 7.6]) k.rod(...G(a, -.45, y), ...G(a2, .45, y), .03, 4, GS, TX.galv);
      k.rod(...G(a, -.45, 6.5), ...G(a, -.45, 7.6), .03, 4, GS, TX.galv).rod(...G(a, .45, 6.5), ...G(a, .45, 7.6), .03, 4, GS, TX.galv);
    }
    for (const sd of [-1, 1]) {   // 檢修走道：格柵踏板、欄杆
      const b = -sd * 1.1;
      k.box(...G(0, b, 5.95), .9, .05, 2 * po - 1.4, 0x4a4e54, TX.galv, 0, Math.atan2(nx, nz));
      k.rod(...G(-po + .7, b - sd * .45, 6.95), ...G(po - .7, b - sd * .45, 6.95), .025, 4, GS, TX.galv);
      for (let a = -po + .7; a <= po - .69; a += 1.5) k.rod(...G(a, b - sd * .45, 5.95), ...G(a, b - sd * .45, 6.95), .02, 4, GS, TX.galv);
    }
    for (const sd of [-1, 1]) {
      const pl = new T.Mesh(new T.PlaneGeometry(6.4, 2), sign(F));
      // 右駕：沿 +h 開的車在 n = (−hz, hx) 那一側；牌子掛在那半邊上方、正面朝來車（−h）
      const side = sd, fx = -sd * hx, fz = -sd * hz;
      pl.position.set(mx + nx * side * 3.4 + fx * .62, gy + 7.1, mz + nz * side * 3.4 + fz * .62); pl.rotation.y = Math.atan2(fx, fz);
      cityAdd(pl, null);
    }
  }
  if (pos.length) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    k.add(g, 0xffffff, TX.conc);
    // Kit.add 把整塊塗成同一色：顏色另外寫回去
    for (let i = 0, o = k.col.length - col.length; i < col.length; i++) k.col[o + i] = col[i];
  }
  cityAdd(new T.Mesh(k.build(), MAT.ux), null);
  if (FWY_PIERS.length) cityAdd(fwyPierMesh = new T.Mesh(pk.build(), MAT.ux), null);
}

// 棧橋：木板、樁、欄杆；盡頭的摩天輪（輪面朝北，岸上看得到整圈）
const ferris = new T.Group(), cabins = [];
// 換成模型時（27-props.js 檔尾）要動的：程式建模的底座與輪子、輪軸離棧橋面多高（wy）、車廂吊點的半徑（R）
const FERRIS = { R: 20, wy: 25, base: null, wheel: null, cx: 0, wz: 0, h: 0 };
{
  const P0 = PIERS[0], k = new Kit(), cx = (P0.x0 + P0.x1) / 2;
  { const dg = new T.BoxGeometry(P0.x1 - P0.x0, .3, P0.z1 - P0.z0); dg.translate(cx, P0.h - .15, (P0.z0 + P0.z1) / 2); groundAdd(new T.Mesh(dg, MAT_PLANK)); }
  for (let z = P0.z0 + 4; z < P0.z1; z += 6) for (const s of [-1, 1]) k.cyl(cx + s * 4.2, (P0.h + SEA_Y - 3) / 2, z, .22, .22, P0.h - SEA_Y + 3, 8, 0x2a221c, 2);
  for (let z = P0.z0 + 10; z < P0.z1 - 30; z += 24) for (const s of [-1, 1]) {
    k.cyl(cx + s * 4.6, P0.h + 2.4, z, .06, .08, 4.8, 8, 0x22252a, 15).box(cx + s * 4.6, P0.h + 4.85, z, .5, .14, .5, 0xfff0c8, 11);
    coastLight(cx + s * 4.6, P0.h + 4.6, z, 0xffe0b0, 11, .8);
  }
  // 摩天輪的底座與 A 字支架
  const wz = P0.z1 - 14, wy = 25, R = 20, fk = new Kit();
  for (const s of [-1, 1]) {
    fk.box(cx, P0.h + 1, wz + s * 3.2, 9.6, 2, 1.2, 0x1a1c22, 15);
    for (const t of [-1, 1]) fk.box(cx + t * 6, P0.h + wy / 2, wz + s * 2.6, .7, wy + 2, .7, 0xd8dce4, 15, 0, 0, -t * .23);
  }
  fk.box(cx, P0.h + wy, wz, 1.4, 1.4, 7, 0x2a2c34, 15);
  cityAdd(new T.Mesh(k.build(), MAT.uber));
  FERRIS.base = cityAdd(new T.Mesh(fk.build(), MAT.uber)); Object.assign(FERRIS, { cx, wz, h: P0.h });
  // 輪子本身：24 根輻條、兩圈霓虹輪框（會轉）
  const wk = new Kit();
  for (const s of [-1, 1]) for (let i = 0; i < 48; i++) {
    const a = i / 48 * Math.PI * 2, a2 = (i + 1) / 48 * Math.PI * 2, x0 = Math.cos(a) * R, y0 = Math.sin(a) * R, x1 = Math.cos(a2) * R, y1 = Math.sin(a2) * R;
    wk.box((x0 + x1) / 2, (y0 + y1) / 2, s * 2.2, Math.hypot(x1 - x0, y1 - y0) + .05, .28, .28, i % 2 ? 0xff3fa0 : 0x3ff0ff, 8, 0, 0, Math.atan2(y1 - y0, x1 - x0));
  }
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; for (const s of [-1, 1]) wk.box(Math.cos(a) * R / 2, Math.sin(a) * R / 2, s * 2.2, R, .12, .12, 0xc8ccd4, 3, 0, 0, a); }
  wk.cyl(0, 0, 0, 1.2, 1.2, 5, 16, 0xffd070, 8, Math.PI / 2);
  const wm = FERRIS.wheel = new T.Mesh(wk.build(), MAT.uber); ferris.add(wm);
  const fz = localZone(zoneAtL(cx, wz), cx, wz);   // 輪子與車廂共用一個剛體座標框（車廂每幀照邏輯座標擺）
  ferris.position.set(cx, P0.h + wy, wz); cityAdd(ferris, fz);
  const ck = new Kit().box(0, -1.3, 0, 2, 1.8, 2.4, 0xe8e0d0, 10).box(0, -1.2, 0, 2.05, .8, 2.45, 0x10161c, 1).box(0, -.2, 0, .1, 1, .1, 0x888888, 3).box(0, -2.25, 0, 2.1, .1, 2.5, 0xffd070, 11).build();
  for (let i = 0; i < 16; i++) { const m = new T.Mesh(ck, MAT.uber); m.userData.a = i / 16 * Math.PI * 2; cabins.push(m); cityAdd(m, fz, [cx, wz]); }
  coastLight(cx, P0.h + wy, wz - 6, 0xff5ab4, 34, 1.6);
  coastLight(cx, P0.h + 6, wz - 10, 0x5ae8ff, 18, 1.1);
}

// 舊碼頭的兩座木棧（伸進灰鷺河）：木板、樁、繫纜柱、盡頭一盞燈
{
  const k = new Kit();
  for (const P of PIERS.slice(1)) {
    const cz = (P.z0 + P.z1) / 2;
    const dg = new T.BoxGeometry(P.x1 - P.x0, .3, P.z1 - P.z0); dg.translate((P.x0 + P.x1) / 2, P.h - .15, cz); groundAdd(new T.Mesh(dg, MAT_PLANK));
    for (let x = P.x0 + 3; x < P.x1; x += 6) for (const z of [P.z0 + 1, P.z1 - 1]) k.cyl(x, (P.h + SEA_Y - 3) / 2, z, .2, .2, P.h - SEA_Y + 3, 8, 0x2a221c, 2);
    for (let x = P.x0 + 6; x < P.x1 - 4; x += 12) for (const z of [P.z0 + .6, P.z1 - .6]) { k.cyl(x, P.h + .3, z, .16, .2, .6, 8, 0x1a1a1c, 2); circles.push({ x, z, r: .2 }); }
    k.cyl(P.x0 + 2, P.h + 2.2, cz, .07, .09, 4.4, 8, 0x22252a, 15).box(P.x0 + 2, P.h + 4.5, cz, .4, .25, .4, 0xffd8a0, 11);
    coastLight(P.x0 + 2, P.h + 4.2, cz, 0xffc890, 12, .8);
  }
  cityAdd(new T.Mesh(k.build(), MAT.uber));
}

// ─── 錨灣港：岸橋、貨櫃堆、高桿燈、靠港的貨櫃船、碼頭上的集卡 ───
// 船、岸橋與集卡都會動（coastUpdate）：船靠港作業一陣子，由拖船推離碼頭、原地轉向朝南、開出外海，過一陣子再開回來靠港；
// 岸橋沿兩條軌道換艙位，小車在船與車道之間搬貨櫃；集卡在岸橋底下的車道與堆場之間繞圈，在作業中的岸橋底下停一下。
// 船掛在 harbor.root（船心、水面高度）底下，root 在所屬區的框裡平移、轉向；岸橋腳與集卡的碰撞是 dynCircles（30-vehicles.js，每幀更新的世界座標圓）。
const LANE_X0 = BRIDGE.x0 - 14, LANE_X1 = BRIDGE.x1 + 14;   // 碼頭上往跨海橋的車道，不堆貨櫃
const harbor = { cranes: [], ship: null, root: null, zn: null, shipY0: 0, trY: 41.4, wireY: 40.6, boxLists: null, boxMeshes: null, trucks: [],
  state: 'dock', st: 0, halfL: 0, halfB: 15 };
const CRANE_X = [610, 690, 770, 850];
// 港區會動的東西（岸橋、小車、集卡、貨櫃船）都掛在同一個剛體座標框（港區中心那一點的 localZone），toW(…, harbor.zn) 和畫面一致
harbor.zn = localZone(zoneAtL(730, QUAY.z1), 730, QUAY.z1);
{
  const k = new Kit(), r2 = rng(808);
  // 岸橋：腳跨在兩條軌道上（z1-6、z1-30），吊臂往海上伸 48 m；每台自己一個網格（原點在岸橋中心線，沿軌道移動；換成模型時拿掉 proc）
  for (const cx of CRANE_X) {
    const ck = new Kit(), z0 = QUAY.z1 - 30, z1 = QUAY.z1 - 6, col = cx % 160 ? 0xc83a24 : 0xe8e2d4;
    for (const z of [z0, z1]) for (const s of [-1, 1]) ck.box(s * 9, 20, z, 1.4, 40, 1.4, col, 10);
    for (const z of [z0, z1]) ck.box(0, 39.5, z, 20, 1.6, 1.6, col, 10);
    for (const s of [-1, 1]) ck.box(s * 9, 39.5, (z0 + z1) / 2, 1.6, 1.6, z1 - z0, col, 10).box(s * 9, 14, (z0 + z1) / 2, 1, 1, z1 - z0, col, 10);
    for (const s of [-1, 1]) for (const z of [z0, z1]) ck.box(s * 9, .6, z, 2.6, 1.2, 3.4, 0x30343a, 15);   // 行走台車
    ck.box(0, 43, QUAY.z1 + 5, 6, 2.4, 86, col, 10);                    // 吊臂（往陸側也伸一段）
    ck.box(0, 47, z1 - 8, 5, 6, 8, 0x30343a, 15).box(0, 47, z1 - 3.9, 4, 3, .1, 0xffe0a0, 11);   // 機房
    ck.box(0, 41, QUAY.z1 + 14, 3, 2.6, 3, 0x22262c, 15).box(0, 41, QUAY.z1 + 15.6, 2.4, 1.6, .1, 0x9ad0ff, 11);   // 駕駛室
    for (const z of [QUAY.z1 + 47, z0 - 37]) ck.box(0, 44.6, z, .7, .7, .7, 0xff2020, 9);   // 航空警示燈（閃）
    for (let z = z0 - 30; z < QUAY.z1 + 46; z += 18) ck.box(3.2, 42, z, .3, .3, .3, 0xffd8a0, 11);
    ck.box(0, 13.2, QUAY.z1 - 18, 1.2, .3, 1.2, 0xfff0d8, 11);
    const g = new T.Group(); g.position.x = cx; cityAdd(g, harbor.zn);
    const proc = new T.Mesh(ck.build(), MAT.uber); g.add(proc);
    harbor.cranes.push({ cx, x: cx, g, proc, lights: [coastLight(cx, 13.5, QUAY.z1 - 18, 0xffe6c0, 34, 1.5), coastLight(cx, 36, QUAY.z1 + 14, 0xffe6c0, 50, 1)] });
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
  cityAdd(new T.Mesh(k.build(), MAT.uber));
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
  harbor.boxLists = lists; harbor.COLS = COLS;
  harbor.boxMeshes = COLS.map((col, k2) => {
    const ck = new Kit().box(0, 1.3, 0, 12.2, 2.58, 2.44, col, 2);
    for (let i = -5; i <= 5; i++) ck.box(i * 1.1, 1.3, 1.23, .2, 2.4, .02, new T.Color(lin(col)).multiplyScalar(.7), 2).box(i * 1.1, 1.3, -1.23, .2, 2.4, .02, new T.Color(lin(col)).multiplyScalar(.7), 2);
    ck.box(6.11, 1.3, 0, .02, 2.4, 2.3, new T.Color(lin(col)).multiplyScalar(.6), 15);
    return instanced(ck.build(), MAT.uber, lists[k2]);
  });
  // 貨櫃船：靠在岸橋外側，船艏朝東；船身、甲板上的貨櫃、船尾的駕駛樓。幾何以船心為原點（root 轉向時繞船心轉）
  const sk = new Kit(), sx0 = 590, sx1 = 820, sz = QUAY.z1 + 22, top = SEA_Y + 9, scx = (sx0 + sx1) / 2;
  const X = x => x - scx;
  sk.box(0, SEA_Y + 1, 0, sx1 - sx0, 12, 30, 0x1a2430, 2)
    .box(0, SEA_Y - .2, 0, sx1 - sx0 + .1, 2.4, 30.1, 0x6a1a14, 2)
    .box(X(sx1 + 6), SEA_Y + 2, 0, 14, 10, 20, 0x1a2430, 2, 0, Math.PI / 4)
    .box(0, top - .9, -15.05, sx1 - sx0, .5, .1, 0xd8d8d8, 10).box(0, top - .9, 15.05, sx1 - sx0, .5, .1, 0xd8d8d8, 10);
  for (let x = sx0 + 40; x < sx1 - 12; x += 13) for (let b = -4; b <= 4; b++) {
    const n = 2 + Math.floor(r2() * 4);
    for (let c = 0; c < n; c++) sk.box(X(x), top + 1.3 + c * 2.6, b * 2.6, 12.2, 2.5, 2.44, COLS[Math.floor(r2() * COLS.length)], 2);
  }
  sk.box(X(sx0 + 18), top + 9, 0, 16, 18, 26, 0xe8e4dc, 10).box(X(sx0 + 18), top + 19, 0, 18, 2, 32, 0xe8e4dc, 10)
    .box(X(sx0 + 26.05), top + 14, 0, .1, 8, 22, 0x10161c, 1);
  for (let f = 0; f < 5; f++) for (let w = -4; w <= 4; w++) if (r2() < .45) sk.box(X(sx0 + 26.1), top + 4 + f * 3, w * 2.6, .05, 1.1, 1.6, 0xffd8a0, 11);
  sk.cyl(X(sx0 + 8), top + 24, 0, .7, .9, 8, 10, 0x2a2a2a, 15).box(X(sx0 + 8), top + 28.3, 0, .5, .5, .5, 0xff2020, 9).box(X(sx1 + 10), top + 6, 0, .5, .5, .5, 0x20ff60, 11);
  const root = harbor.root = new T.Group(); root.position.set(scx, 0, sz); cityAdd(root, harbor.zn);
  const ship = harbor.ship = new T.Mesh(sk.build(), MAT.uber); root.add(ship); cullAdd(ship);
  harbor.shipLight = coastLight(sx0 + 30, top + 12, sz, 0xffd8a0, 30, 1);
  Object.assign(harbor, { home: { x: scx, z: sz }, halfL: (sx1 - sx0) / 2 + 12, halfB: 15 });
  // 岸橋的小車、鋼索與吊具：在船上（z = sz）與兩條軌道之間的車道（z1 - 18）來回搬貨櫃；吊具沿 x 和貨櫃同向
  const tg = new Kit().box(0, 0, 0, 4.4, 1.4, 5, 0x30343a, 15).box(0, -.85, 0, 3.6, .3, 4.2, 0x22262c, 15).box(0, .2, 2.51, 2.4, .6, .02, 0x9ad0ff, 11).build();
  const wg = new Kit().box(-1.2, -.5, -.9, .05, 1, .05, 0x202226, 15).box(1.2, -.5, -.9, .05, 1, .05, 0x202226, 15)
    .box(-1.2, -.5, .9, .05, 1, .05, 0x202226, 15).box(1.2, -.5, .9, .05, 1, .05, 0x202226, 15).build();
  const spg = new Kit().box(0, 0, 0, 12.4, .45, 2.6, 0xe0b020, 10).box(0, .6, 0, 3, .8, 2, 0x30343a, 15).build();
  const cgs = COLS.map(col => new Kit().box(0, 0, 0, 12.2, 2.58, 2.44, col, 2).box(6.11, 0, 0, .02, 2.4, 2.3, new T.Color(lin(col)).multiplyScalar(.6), 15).build());
  harbor.cgs = cgs;
  harbor.cranes.forEach((c, i) => {
    Object.assign(c, { off: i * .27, k: i, tr: new T.Mesh(tg, MAT.uber), wire: new T.Mesh(wg, MAT.uber), sp: new T.Mesh(spg, MAT.uber), box: new T.Mesh(cgs[i % cgs.length], MAT.uber), cgs, n: -1, bay: 0, x0: c.cx, x1: c.cx });
    for (const m of [c.tr, c.wire, c.sp, c.box]) { m.position.x = c.cx; cityAdd(m, harbor.zn); }
  });
  Object.assign(harbor, { seaZ: sz, landZ: QUAY.z1 - 18, hiY: 34, shipY: top + 7.2, landY: 3.1, sx0, sx1 });
  // 集卡：拖頭＋20/40 呎板車，沿碼頭上的一圈路線開（岸橋底下的車道 → 東端 → 堆場北邊的通道 → 西端），貨櫃有時有、有時沒有
  const yk = new Kit();
  yk.box(0, 1.15, 1.6, 2.4, 1.6, 2.1, 0xd8a020, 10).box(0, 1.55, 2.66, 2.1, .8, .04, 0x10161c, 1).box(0, .55, .6, 2.3, .5, 4.6, 0x22252a, 15)
    .box(0, 2.05, 1.6, 2.5, .12, 2.2, 0x22252a, 15).box(.9, 2.2, 1.0, .12, .4, .12, 0xffa020, 9)
    .box(.85, .95, 2.68, .3, .14, .04, 0xfff0d8, 4).box(-.85, .95, 2.68, .3, .14, .04, 0xfff0d8, 4);
  for (const s of [-1, 1]) for (const z of [2, -.4]) yk.cyl(s * 1.05, .5, z, .5, .5, .4, 12, 0x15161a, 6, 0, 0, Math.PI / 2);
  const tk = new Kit();   // 板車（原點在牽引的鞍座，往後 12.5 m）
  tk.box(0, 1.05, -6.3, 2.4, .25, 12.6, 0x30343a, 15).box(0, .7, -6.3, .4, .5, 12.6, 0x22252a, 15);
  for (const s of [-1, 1]) for (const z of [-10.4, -11.6]) tk.cyl(s * 1.0, .5, z, .5, .5, .45, 12, 0x15161a, 6, 0, 0, Math.PI / 2);
  tk.box(0, .9, -12.6, 2.2, .3, .1, 0x8a1010, 5);
  const ykG = yk.build(), tkG = tk.build();
  const Z0 = QUAY.z0, LZ = harbor.landZ;
  const PATH = [[566, LZ], [884, LZ], [896, LZ - 6], [898, Z0 + 74], [890, Z0 + 68], [574, Z0 + 68], [564, Z0 + 74], [562, LZ - 6]];
  const segs = []; let plen = 0;
  for (let i = 0; i < PATH.length; i++) { const a = PATH[i], b = PATH[(i + 1) % PATH.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); segs.push({ a, b, l, s: plen }); plen += l; }
  harbor.path = { segs, len: plen };
  for (let i = 0; i < 3; i++) {
    const tr = new T.Mesh(ykG, MAT.uber), ch = new T.Mesh(tkG, MAT.uber), box = new T.Mesh(cgs[(i * 2 + 1) % cgs.length], MAT.uber);
    for (const m of [tr, ch, box]) cityAdd(m, harbor.zn);
    harbor.trucks.push({ tr, ch, box, s: i * plen / 3, v: 0, wait: 0, load: i % 2 === 0, lastCrane: -1, circ: [{ x: 0, z: 0, r: 1.5 }, { x: 0, z: 0, r: 1.5 }, { x: 0, z: 0, r: 1.5 }] });
  }
}
// 集卡路線上 s 處的點（邏輯座標）
function harborPathAt(s) {
  const P = harbor.path; s = ((s % P.len) + P.len) % P.len;
  for (const g of P.segs) if (s <= g.s + g.l) { const u = (s - g.s) / g.l; return [lerp(g.a[0], g.b[0], u), lerp(g.a[1], g.b[1], u)]; }
  return P.segs[0].a;
}
// ─── 跨海橋：斜張橋，兩座 H 形主塔、斜拉索、兩側路燈；橋面 y = 0（和碼頭、島一樣） ───
{
  const k = new Kit(), x = BRIDGE_X, z0 = BRIDGE.z0, z1 = BRIDGE.z1, L = z1 - z0, zm = (z0 + z1) / 2;
  { const dg = new T.BoxGeometry(BRIDGE.x1 - BRIDGE.x0, 1.2, L); dg.translate(x, -.6, zm); groundAdd(new T.Mesh(dg, MAT_ROAD)); }   // 橋面：和路面同一個材質（積水、倒影）
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
  const m = new T.Mesh(k.build(), MAT.uber); cityAdd(m); cullAdd(m, 900);
}

// ─── 灰鷗島：岩岸、樹、廢墟街區與辦公園區（以 http(s) 開啟時換成模型，27-props.js 的 ISLE_SITES）、東端的燈塔 ───
const ISLE_SITES = {
  ruin: { x: ISLE.x0 + 70, z: ISLE.z0 + 150, ry: 0, w: 52, d: 64 },        // dasy444 的 abandoned city street，放大 2.3 倍
  office: { x: BRIDGE_X + 8, z: ISLE.z0 + 160, ry: Math.PI, w: 62, d: 63 },  // dasy444 的 Loft 18 environment（辦公室與一圈板樓）；北面的門是安全屋（69-safehouse.js）
};
// 田園一景（27-world1.js 擺 cs_country）：從橋上島那條碎石路、往燈塔那條（路燈在路邊 5 m，剛好在護欄外）。ry 是路的方向（模型 +z），
// more：沿路再接幾段護欄（路面中心往 +z 的距離），boxes：路上倒著小貨櫃（燈塔那條是死路）
const CS_SITES = [
  { x: BRIDGE_X, z: ISLE.z0 + 52, ry: 0, more: [[47]] },
  { x: BRIDGE_X + 62, z: ISLE.z0 + 120, ry: Math.PI / 2, boxes: 1, more: [[31.3], [62.6]] },
];
// 基地裡每棟樓的佔地：tools/foot.mjs 從模型量出來寫進 props.json 的 foot（模型座標），換成邏輯座標的矩形 [x0, x1, z0, z1, 高]。
// 樓與樓之間的巷子、中庭走得進去；沒有量過就退回整塊
function isleFoot(id) {
  const s = ISLE_SITES[id], ft = PROPS_SPEC['isle_' + id]?.items[id]?.foot, c = Math.cos(s.ry), n = Math.sin(s.ry);
  if (!ft) return [[s.x - s.w * .42, s.x + s.w * .42, s.z - s.d * .42, s.z + s.d * .42, 12]];
  return ft.map(([a, b, p, q, h]) => {
    const xs = [], zs = [];
    for (const [x, z] of [[a, p], [b, p], [a, q], [b, q]]) { xs.push(s.x + x * c + z * n); zs.push(s.z - x * n + z * c); }
    return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs), h];
  });
}
const LIGHTHOUSE = { x: ISLE.x1 - 26, z: ISLE.z0 + 120 }, ISLE_PROXY = {};
let isleTreeMesh, ISLE_TREES = [];   // 島上的樹（World 第四輪之二換成模型）   // 替身：模型下載好就藏起來
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
    if (CS_SITES.some(c => { const dx = tx - c.x, dz = tz - c.z, a = dx * Math.cos(c.ry) - dz * Math.sin(c.ry), b = dx * Math.sin(c.ry) + dz * Math.cos(c.ry); return Math.abs(a) < 15 && Math.abs(b) < 20; })) continue;   // 田園一景自己有樹
    if (Math.abs(tx - BRIDGE_X) < 8 && tz < ISLE.z0 + 124 || Math.abs(tz - (ISLE.z0 + 120)) < 7 && tx > BRIDGE_X || Math.hypot(tx - x, tz - z) < 16) continue;
    isleTrees.push({ x: tx, z: tz, y: 0, ry: r2() * 6.3, s: .9 + r2() * .6 }); circles.push({ x: tx, z: tz, r: TREE_COL });
  }
  const tk = new Kit(); tk.cyl(0, 2.1, 0, .1, .17, 4.2, 8, 0x3a2c20, 2);
  for (let i = 0; i < 5; i++) { const g = new T.IcosahedronGeometry(1.4 + r2() * .5, 1); const a = i / 5 * 6.28, rr = i ? 1.2 : 0; tk.add(g, new T.Color().setHSL(.27, .4, .14 + r2() * .06), 2, tf(Math.cos(a) * rr, 5 + r2() * 1.4 + (i ? 0 : .9), Math.sin(a) * rr)); }
  isleTreeMesh = instanced(tk.build(), MAT.uber, isleTrees); ISLE_TREES = isleTrees;
  // 島上的路燈：沿碎石路
  for (let zp = ISLE.z0 + 10; zp < ISLE.z0 + 120; zp += 26) { k.cyl(BRIDGE_X + 5, 2.6, zp, .07, .09, 5.2, 8, 0x22252a, 15).box(BRIDGE_X + 5, 5.3, zp, .4, .25, .4, 0xffe0b0, 11); coastLight(BRIDGE_X + 5, 5, zp, 0xffd8a0, 12, .8); }
  for (let xp = BRIDGE_X + 20; xp < x - 14; xp += 26) { k.cyl(xp, 2.6, ISLE.z0 + 125, .07, .09, 5.2, 8, 0x22252a, 15).box(xp, 5.3, ISLE.z0 + 125, .4, .25, .4, 0xffe0b0, 11); coastLight(xp, 5, ISLE.z0 + 125, 0xffd8a0, 12, .8); }
  const m = new T.Mesh(k.build(), MAT.uber); cityAdd(m); cullAdd(m, 900);
  coastLight(x, 33, z, 0xfff0c0, 22, 1.4);
  // 旋轉的光束：兩道往外的長錐（加法混合，越遠越淡）
  const bg = new T.CylinderGeometry(16, .6, 420, 20, 1, true); bg.rotateZ(-Math.PI / 2); bg.translate(210, 0, 0);
  const bm = new T.ShaderMaterial({ uniforms: shared(ALLU), transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    vertexShader: `varying float vT; varying vec3 vW; void main(){ vT = position.x / 420.; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uFogDen; varying float vT; varying vec3 vW; void main(){ float a = pow(1. - clamp(vT, 0., 1.), 2.4) * smoothstep(0., .03, vT) * .07; gl_FragColor = vec4(vec3(1., .93, .75) * a, 1.); }` });
  for (const s of [0, Math.PI]) { const b = new T.Mesh(bg, bm); b.rotation.y = s; b.layers.set(LY.NOREFL); b.frustumCulled = false; beacon.add(b); }
  beacon.position.set(x, 33, z); cityAdd(beacon);
  // 以檔案開啟（或模型下載失敗）時的替身：照碰撞佔地（isleFoot）一格一個方塊，矮的是瓦礫與圍籬，高的面北牆上點幾扇窗
  const pk = new Kit();
  for (const id in ISLE_SITES) for (const [x0, x1, z0, z1, h0] of isleFoot(id)) {
    const h = Math.max(h0, 1.2), w = x1 - x0, d = z1 - z0;
    pk.box((x0 + x1) / 2, h / 2, (z0 + z1) / 2, w, h, d, h > 4 ? 0x3a3836 : 0x4a443c, 2);
    if (h > 6 && w > 3) for (let f = 1; f < h / 3.2; f++) if (r2() < .35) pk.box((x0 + x1) / 2, f * 3.2, z0 - .02, Math.min(2.2, w * .5), 1.3, .05, 0xffd8a0, 11);
  }
  const proxy = new T.Mesh(pk.build(), MAT.uber); cityAdd(proxy); cullAdd(proxy, 700);
  // 兩個基地的燈：辦公園區四角的投光燈、廢墟裡幾堆營火（模型和替身都用得到）
  const O = ISLE_SITES.office, R = ISLE_SITES.ruin, lk = new Kit();
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const lx = O.x + sx * (O.w / 2 + 3), lz = O.z + sz * (O.d / 2 + 3);
    lk.cyl(lx, 4, lz, .1, .14, 8, 8, 0x22252a, 15).box(lx, 8.1, lz, .9, .3, .6, 0xe8f0ff, 11);
    coastLight(lx, 7.5, lz, 0xe0ecff, 24, 1.1);
  }
  for (const [dx, dz] of [[-8, -14], [14, 0], [-4, 20]]) {
    lk.cyl(R.x + dx, .25, R.z + dz, .6, .7, .5, 8, 0x2a2420, 2).box(R.x + dx, .6, R.z + dz, .5, .4, .5, 0xff8a30, 11);
    coastLight(R.x + dx, 1.2, R.z + dz, 0xff9040, 11, 1);
  }
  const lm = new T.Mesh(lk.build(), MAT.uber); cityAdd(lm); cullAdd(lm, 700);
  ISLE_PROXY.isle = proxy;
  for (const id in ISLE_SITES) for (const [x0, x1, z0, z1] of isleFoot(id)) colliders.push({ x0, x1, z0, z1 });
}

// ─── 遠景：外緣外的山（北面與東面，10-city.js 的 hillH）、西岸的對岸城區（以 http(s) 開啟時換成 golukumar 的 London City）、外海的小島。
// 模型由 27-props.js 的 COAST_MODELS 下載擺放，擺好就把 ISLE_PROXY 的替身藏起來 ───
const PEAKS = [];   // FAR_BANK_X 在 10-city.js
const FAR_SITES = {
  london: { x: FAR_BANK_X - 380, z: FAR_Z1 - 660, ry: 0 },    // 模型 719×1265 m，東緣貼著河岸，最高的塔在北端；對岸只到 FAR_Z1，整座往北放
  // 外海的兩座島（World 第一輪剩下的兩個模型，下載前是下面程式建模的岩丘；邏輯座標，跟著 zoneAtL 那一片）：
  eze: { x: CITY_X0 + 500, z: SHORE_Z + 1900, ry: Math.PI / 2, y: SEA_Y - 30 },   // 鷹巖村：珊瑚灘正前方，Èze 的山城掃描（636×553 m、海面上約 230 m），山城那一面（模型 +x）朝北對著城市
  tron: { ...TRON_SITE, ry: 0 },   // 光格島（10-city.js 的 TRON_SITE）：錨灣港外的人工島，Arq Grid Tron 的霓虹街區（598×684 m），近景與上岸在 21-tron.js
};
{
  const r2 = rng(4242);
  // 山：以 CITY_C 為中心的極座標網格，第 0 圈就是外緣的頂點（外緣每 2° 一點），往外 3.5 km；高度照 hillH，整格在水面下的不建。
  // 林線以下深綠、往上轉成岩色，山頂零星幾盞管理站與山屋的燈
  {
    const P = CITY_POLY, n = P.length, [cx, cz] = CITY_C, D = HILL_D, m = D.length;   // HILL_D：10-city.js（hillMeshH 照同一組圈算網格上的高度）
    const pos = new Float32Array(n * m * 3), col = new Float32Array(n * m * 3), H = new Float32Array(n * m), c = new T.Color(), hillCol = (X, Z, h) => hillColor(c, X, Z, h);
    for (let k = 0; k < n; k++) {
      const R = Math.hypot(P[k][0] - cx, P[k][1] - cz), ux = (P[k][0] - cx) / R, uz = (P[k][1] - cz) / R;
      for (let j = 0; j < m; j++) {
        const X = cx + ux * (R + D[j]), Z = cz + uz * (R + D[j]), h = hillH(X, Z), v = (k * m + j) * 3;
        pos[v] = X; pos[v + 1] = h; pos[v + 2] = Z; H[k * m + j] = h;
        hillCol(X, Z, h); col[v] = c.r; col[v + 1] = c.g; col[v + 2] = c.b;
      }
    }
    // 北嶺鐵道橋挖過的山坡（10-city.js 的 NPARK.carve，公園框的範圍）：碰到的三角形另外細分，高度照 parkH
    const CV = NPARK && NPARK.carve, sub = [];
    const hitCV = t => {
      if (!CV) return false;
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (const v of t) { const [x, z] = parkL(pos[v * 3], pos[v * 3 + 2]); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      return x1 > CV.x0 && x0 < CV.x1 && z1 > CV.z0 && z0 < CV.z1;
    };
    const idx = [];
    for (let k = 0; k < n; k++) for (let j = 0; j < m - 1; j++) {
      const a = k * m + j, b = ((k + 1) % n) * m + j;
      if (Math.max(H[a], H[a + 1], H[b], H[b + 1]) < SEA_Y - .5) continue;
      for (const t of [[a, b, a + 1], [a + 1, b, b + 1]]) (hitCV(t) ? sub : idx).push(...t);
    }
    // 細分：每個三角形切成 N×N 份（N 全部一樣，相鄰三角形的共用邊上頂點才對得起來），頂點照位置合併；法線照合併後的網格算
    if (sub.length) {
      let el = 0;
      for (let t = 0; t < sub.length; t += 3) for (let q = 0; q < 3; q++) { const a = sub[t + q], b = sub[t + (q + 1) % 3]; el = Math.max(el, Math.hypot(pos[a * 3] - pos[b * 3], pos[a * 3 + 2] - pos[b * 3 + 2])); }
      const N = Math.ceil(el / 3.6), sp = [], sc = [], si = [], seen = new Map();
      const vert = (X, Z) => {
        const key = Math.round(X * 20) + ',' + Math.round(Z * 20); let v = seen.get(key);
        if (v === undefined) { v = sp.length / 3; seen.set(key, v); const h = parkH(...parkL(X, Z)); sp.push(X, h, Z); hillCol(X, Z, h); sc.push(c.r, c.g, c.b); }
        return v;
      };
      for (let t = 0; t < sub.length; t += 3) {
        const [ax, az, bx, bz, qx, qz] = [sub[t], sub[t + 1], sub[t + 2]].flatMap(v => [pos[v * 3], pos[v * 3 + 2]]), id = [];
        for (let i = 0; i <= N; i++) { id.push([]); for (let j = 0; j <= N - i; j++) id[i].push(vert(ax + (bx - ax) * i / N + (qx - ax) * j / N, az + (bz - az) * i / N + (qz - az) * j / N)); }
        for (let i = 0; i < N; i++) for (let j = 0; j < N - i; j++) {
          si.push(id[i][j], id[i + 1][j], id[i][j + 1]);
          if (j < N - i - 1) si.push(id[i + 1][j], id[i + 1][j + 1], id[i][j + 1]);
        }
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(sp, 3)); g.setAttribute('color', new T.Float32BufferAttribute(sc, 3)); g.setAttribute('aMat', new T.Float32BufferAttribute(new Array(sp.length / 3).fill(2), 1));
      g.setIndex(si); g.computeVertexNormals(); g.computeBoundingSphere();
      const sm = new T.Mesh(g, MAT.uber); sm.name = 'hillCarve'; cityAdd(sm, null);
      HILL.carveTris = { coarse: sub.length / 3, N, tris: si.length / 3 };
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setAttribute('aMat', new T.BufferAttribute(new Float32Array(n * m).fill(2), 1));
    g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
    const hm = new T.Mesh(g, MAT.uber); hm.frustumCulled = false; cityAdd(hm, null);
    // 山上的燈
    const lk = new Kit();
    for (let i = 0; i < 60; i++) {
      const k = Math.floor(r2() * n), d = 150 + r2() * 1800, R = Math.hypot(P[k][0] - cx, P[k][1] - cz), X = cx + (P[k][0] - cx) / R * (R + d), Z = cz + (P[k][1] - cz) / R * (R + d), h = hillH(X, Z);
      if (h < 20 || parkGround(X, Z) !== null) continue;   // 北嶺公園裡另外有步道燈
      lk.box(X, h + 2, Z, 3, 3, 3, 0xffc880, 11);
    }
    cityAdd(new T.Mesh(lk.build(), MAT.far), null);
    // 雪山（World 第四輪之二：只有換成模型時才擺）：山後面一排，拉伸成 1.6–2.3 km 寬、600–870 m 高
    const r8 = rng(4343);
    for (let i = 0; i < 40 && PEAKS.length < 6; i++) {
      const k = Math.floor(r8() * n), R = Math.hypot(P[k][0] - cx, P[k][1] - cz), X = cx + (P[k][0] - cx) / R * (R + 3400 + r8() * 500), Z = cz + (P[k][1] - cz) / R * (R + 3400 + r8() * 500), s = 11 + r8() * 5;
      if (HILL.W[k] < 1 || PEAKS.some(p => Math.hypot(p.x - X, p.z - Z) < 1500)) continue;
      PEAKS.push({ x: X, z: Z, y: -15, ry: r8() * 6.3, sx: s, sz: s * (.8 + r8() * .4), sy: 18 + r8() * 8, zn: null });
    }
  }
  // 外海的小島：低矮的岩丘，有幾盞燈（SEA_FR 座標，10-city.js）。兩座各自一個網格（ISLE_PROXY.tron／eze）：27-props.js 換成模型後拿掉
  for (const [ix, iz, r, h, id] of [[TRON_SITE.x, TRON_SITE.z, 330, 70, 'tron'], [CITY_X0 + 500, SHORE_Z + 1900, 380, 90, 'eze']]) {
    const zn = SEA_FR, kk = new Kit();
    for (let j = 0; j < 4; j++) {   // 幾個壓扁的圓丘疊成不規則的島
      const rr = r * (.45 + r2() * .45), g = new T.SphereGeometry(rr, 20, 6, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, h * (.4 + r2() * .6) / rr, .55 + r2() * .3);
      g.translate(ix + (r2() - .5) * r, SEA_Y, iz + (r2() - .5) * r * .4); kk.add(g, 0x0c100c, 2, null);
    }
    for (let j = 0; j < 6; j++) { const a = r2() * 6.3; kk.box(ix + Math.cos(a) * r * .6, SEA_Y + h * .35, iz + Math.sin(a) * r * .4, 2, 2, 2, 0xffd8a0, 11); }
    cityAdd(ISLE_PROXY[id] = new T.Mesh(kk.build(), MAT.far), zn);
  }
  // 對岸：沿河的堤岸與一條地面（FAR_PARTS，跟著舊城那一片），南端（FAR_Z1）是對著河口的岸；London City 的模型下載前先用程式剪影
  const bk = new Kit(), sk = new Kit(), ZA = CITY_Z0 - 1600, ZB = FAR_Z1;
  {
    const bank = new T.PlaneGeometry(1800, ZB - ZA, 1, 1); bank.rotateX(-Math.PI / 2); bank.translate(FAR_BANK_X - 900, 0, (ZA + ZB) / 2);
    bk.add(bank, 0x0e0f10, 2, null);
    bk.box(FAR_BANK_X + 2, -1, (ZA + ZB) / 2, 4, 2, ZB - ZA, 0x2a2826, 2).box(FAR_BANK_X - 900, -1, ZB + 2, 1800, 2, 4, 0x2a2826, 2);
  }
  for (let z = CITY_Z0 - 1400; z < ZB; z += 30) bk.box(FAR_BANK_X - 4, 5, z, .5, .5, .5, 0xffc880, 11);
  for (let x = FAR_BANK_X - 30; x > FAR_BANK_X - 1200; x -= 34) bk.box(x, 5, ZB - 4, .5, .5, .5, 0xffc880, 11);
  cityAdd(new T.Mesh(bk.build(), MAT.far), FAR_ZN);
  for (let i = 0; i < 70; i++) {
    const x = FAR_BANK_X - 40 - r2() * 700, z = ZA + 200 + r2() * (ZB - ZA - 240), w = 18 + r2() * 30, h = 20 + r2() * (r2() < .2 ? 160 : 60);
    sk.box(x, h / 2, z, w, h, w * (.6 + r2() * .8), 0x181a1e, 2);
    for (let f = 0; f < 18; f++) if (r2() < .5) sk.box(x + w / 2 + .05, 2 + r2() * (h - 4), z + (r2() - .5) * w * .8, .05, 1.2, 1.8, r2() < .8 ? 0xffd8a0 : 0x9ad0ff, 11);
  }
  ISLE_PROXY.far = cityAdd(new T.Mesh(sk.build(), MAT.far), FAR_ZN);
}
// ─── 對岸的濱水步道（10-city.js 的 BANK_WALKS、FERRY）：石板步道、靠樓那一側一排近景的樓面（一樓店面、樓上窗格，擋住後面遠景模型
// 糊掉的底層）、渡船碼頭與售票亭。臨水的欄杆與路燈由上面的擋牆迴圈自動加，長椅在 benches ───
{
  const r3 = rng(6161), COLS = [0x6a4a3a, 0x8a7a66, 0x5a5650, 0x7a5a48, 0x4a4e54, 0x80705e], AWN = [0x8a2a24, 0x24506a, 0x2e5a3a, 0x6a5a2a];
  for (const [i, B] of BANK_WALKS.entries()) {
    const zn = zoneAtL((B.x0 + B.x1) / 2, (B.z0 + B.z1) / 2), k = new Kit(), out = B.back === 'x0' ? -1 : 1, bx = out < 0 ? B.x0 : B.x1, F = FERRY[i];
    const pv = new T.BoxGeometry(B.x1 - B.x0, .5, B.z1 - B.z0); pv.translate((B.x0 + B.x1) / 2, B.h - .25, (B.z0 + B.z1) / 2);
    groundAdd(new T.Mesh(pv, MAT_WALK), zn);
    // 樓面：沿岸一段段 11–22 m 寬、9–21 m 高、8 m 深
    for (let z = B.z0 - 6; z < B.z1 + 6;) {
      const w = 11 + r3() * 11, z1 = Math.min(B.z1 + 6, z + w), d = z1 - z, h = 9 + Math.floor(r3() * 4) * 3.2, cz = (z + z1) / 2, col = COLS[Math.floor(r3() * COLS.length)];
      k.box(bx + out * 4, h / 2, cz, 8, h, d - .3, col, 2).box(bx + out * .1, h + .25, cz, .5, .5, d - .1, 0x2a2826, 2);   // 樓身、簷口
      // 一樓店面：櫥窗、門、遮雨棚（一半的店亮著）
      const lit = r3() < .6;
      k.box(bx - out * .02, 1.7, cz, .06, 2.4, d - 2.4, lit ? 0xffd0a0 : 0x2a3036, lit ? 11 : 1).box(bx - out * .02, 3.15, cz, .08, .5, d - 1.6, 0x1a1a1c, 2);
      k.box(bx - out * .9, 3.6, cz, 1.8, .1, d - 1.4, AWN[Math.floor(r3() * AWN.length)], 2, 0, 0, out * -.18);
      if (lit) coastLight(bx - out * 1.5, 2.4, cz, 0xffc890, 7, .5);
      // 樓上的窗：每層 3.2 m、每 2.6 m 一扇，亮的暖色、暗的深色玻璃
      for (let y = 5.6; y < h - 1; y += 3.2) for (let a = z + 1.6; a < z1 - 1.2; a += 2.6) k.box(bx - out * .02, y, a, .05, 1.5, 1.2, r3() < .35 ? 0xffd8a0 : 0x1c2228, r3() < .35 ? 11 : 1);
      z = z1;
    }
    // 步道兩端的圍籬（和遠景的堤岸接起來）
    for (const z of [B.z0, B.z1]) k.box((B.x0 + B.x1) / 2, .7, z, B.x1 - B.x0, 1.4, .12, 0x3a3c40, 15);
    // 渡船碼頭：木板、樁、繫纜柱，盡頭一盞燈；岸邊一座售票亭
    const fz = (F.z0 + F.z1) / 2, fx0 = F.x0, fx1 = F.x1;
    const dg = new T.BoxGeometry(fx1 - fx0, .3, F.z1 - F.z0); dg.translate((fx0 + fx1) / 2, F.h - .15, fz); groundAdd(new T.Mesh(dg, MAT_PLANK), zn);
    for (let x = fx0 + 3; x < fx1; x += 6) for (const z of [F.z0 + .6, F.z1 - .6]) k.cyl(x, (F.h + SEA_Y - 3) / 2, z, .2, .2, F.h - SEA_Y + 3, 8, 0x2a221c, 2);
    const tip = i ? fx0 + 1.5 : fx1 - 1.5;
    k.cyl(tip, F.h + 2.2, fz, .07, .09, 4.4, 8, 0x22252a, 15).box(tip, F.h + 4.5, fz, .4, .25, .4, 0xffd8a0, 11);
    coastLight(tip, F.h + 4.2, fz, 0xffc890, 12, .8);
    const kx = (i ? B.x0 + 5 : B.x1 - 5), kz = F.z1 + 4.5;
    k.box(kx, 1.3, kz, 2.6, 2.6, 2.2, 0x2c4a5a, 2).box(kx, 2.75, kz, 3, .3, 2.6, 0x1a2a34, 2).box(kx - out * 1.32, 1.5, kz, .05, 1, 1.6, 0xffe2b0, 11).box(kx, 3.3, kz, 2.4, .5, .08, 0x5ae8ff, 8);
    colliders.push({ x0: kx - 1.3, x1: kx + 1.3, z0: kz - 1.1, z1: kz + 1.1 });
    coastLight(kx - out * 2, 2.6, kz, 0xffe2b0, 8, .7);
    cityAdd(new T.Mesh(k.build(), MAT.uber), zn);
  }
}

// 每幀：摩天輪轉、車廂保持朝下；燈塔光束轉；貨櫃船進出港、岸橋與集卡
// 貨櫃船的一輪（秒）：靠港作業 → 拖離碼頭 → 原地轉向朝南 → 開出外海 → 不在 → 開回來 → 轉向朝東 → 推進碼頭
const SHIP_T = { dock: 300, push: 70, turn: 55, sail: 240, away: 150 };
const SHIP_C = SHIP_T.dock + 2 * (SHIP_T.push + SHIP_T.turn + SHIP_T.sail) + SHIP_T.away;
const SHIP_OFF = 130, SHIP_FAR = 1800;
function shipPose(T) {
  const H = harbor, hx = H.home.x, hz = H.home.z, ss = u => u * u * (3 - 2 * u);
  let t = ((T % SHIP_C) + SHIP_C) % SHIP_C;
  const S = SHIP_T;
  if (t < S.dock) return { state: 'dock', x: hx, z: hz, yaw: 0, vis: 1 };
  t -= S.dock;
  const leg = (t, back) => {   // back：回程（時間倒過來走同一條路）
    if (t < S.push) { const u = ss(t / S.push); return { state: back ? 'berth' : 'push', x: hx, z: hz + SHIP_OFF * u, yaw: 0, vis: 1 }; }
    t -= S.push;
    if (t < S.turn) { const u = ss(t / S.turn); return { state: 'turn', x: hx, z: hz + SHIP_OFF, yaw: -Math.PI / 2 * u, vis: 1 }; }
    t -= S.turn;
    const u = ss(Math.min(1, t / S.sail));
    return { state: back ? 'arrive' : 'sail', x: hx, z: hz + SHIP_OFF + SHIP_FAR * u, yaw: -Math.PI / 2, vis: u < .98 ? 1 : 0 };
  };
  const L = S.push + S.turn + S.sail;
  if (t < L) return leg(t, false);
  t -= L;
  if (t < S.away) return { state: 'away', x: hx, z: hz + SHIP_OFF + SHIP_FAR, yaw: -Math.PI / 2, vis: 0 };
  t -= S.away;
  return leg(L - t, true);
}
function cullSync(obj) { obj.traverse(o => { const e = o.userData.cull; if (e) { o.updateWorldMatrix(true, false); const c = o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld); e.x = c.x; e.z = c.z; } }); }
const _hc = [];   // 岸橋腳與集卡的碰撞圓（dynCircles）
function coastUpdate(t, dt = 0) {
  const a0 = t * .06;
  ferris.rotation.z = a0;
  const { x, y, z } = ferris.position;
  for (const c of cabins) { const a = c.userData.a + a0; c.position.set(x + Math.cos(a) * FERRIS.R, y + Math.sin(a) * FERRIS.R, z); }
  beacon.rotation.y = t * .55;
  const H = harbor, ss = u => u * u * (3 - 2 * u), seg = (u, a, b) => ss(clamp((u - a) / (b - a), 0, 1));
  // 貨櫃船：位置、朝向、隨浪起伏；移動中就更新距離剔除的中心與船上的燈
  H.st += dt;
  const sp = shipPose(H.st), R = H.root;
  H.state = sp.state;
  R.visible = !!sp.vis;
  if (R.position.x !== sp.x || R.position.z !== sp.z || R.rotation.y !== sp.yaw) {
    R.position.set(sp.x, 0, sp.z); R.rotation.y = sp.yaw;
    if (R.visible) cullSync(R);
    const dx = H.shipLightDX ?? -85, c = Math.cos(sp.yaw), s = Math.sin(sp.yaw);
    [H.shipLight.x, H.shipLight.z] = toW(sp.x + dx * c, sp.z - dx * s, H.zn);
  }
  H.shipLight.i = R.visible ? 1 : 0;
  if (H.ship) H.ship.position.y = H.shipY0 + Math.sin(t * .35) * .14;
  // 岸橋：每台 64 秒一輪，彼此錯開；開頭沿軌道換到下一個艙位，接著船上放下吊具 → 吊起 → 小車往陸側 → 放到車道上 → 吊起 → 回到船上。
  // 船不在（或吊臂底下沒有船）就把小車收到陸側停著
  const sx0 = H.shipX0 ?? H.sx0, sx1 = H.shipX1 ?? H.sx1;
  _hc.length = 0;
  for (const c of H.cranes) {
    const ph = t / 64 + c.off, u = ph % 1, n = Math.floor(ph);
    if (n !== c.n) { c.n = n; c.box.geometry = c.cgs[(n * 7 + c.k * 3) % c.cgs.length]; c.x0 = c.x; c.x1 = clamp(c.cx + [0, 13, 0, -13][(n + c.k) % 4], sx0 + 7, sx1 - 7); }
    const work = H.state === 'dock' && c.cx > sx0 + 6 && c.cx < sx1 - 6;
    let ty = H.hiY, tz = H.landZ, load = false;
    if (work) {
      c.x = lerp(c.x0, c.x1, seg(u, 0, .08));
      const w = (u - .08) / .92;
      const go = seg(w, .2, .42) - seg(w, .72, .94);                       // 0 = 船上、1 = 陸側
      const down = w < 0 ? 0 : w < .2 ? 1 - Math.abs(w - .1) / .1 : w > .42 && w < .72 ? 1 - Math.abs(w - .57) / .15 : 0;
      const lowY = w < .3 ? H.shipY + (H.ship ? H.ship.position.y - H.shipY0 : 0) : H.landY;
      ty = lerp(H.hiY, lowY, ss(clamp(down * 1.6, 0, 1))); tz = lerp(H.seaZ, H.landZ, go);
      load = w >= .1 && w < .57;                                           // 船上扣住、到車道放下
      c.trZ = tz; c.spY = ty;
    } else {
      c.trZ = damp(c.trZ ?? tz, tz, 1.2, dt); c.spY = damp(c.spY ?? ty, ty, 1.2, dt); tz = c.trZ; ty = c.spY;
    }
    c.work = work;
    c.g.position.x = c.x;
    c.tr.position.set(c.x, H.trY, tz);
    c.wire.position.set(c.x, H.wireY, tz); c.wire.scale.y = Math.max(.1, H.wireY - ty - .3);
    c.sp.position.set(c.x, ty, tz);
    c.box.visible = load; c.box.position.set(c.x, ty - 1.55, tz);
    for (const [k, L] of c.lights.entries()) { const lz = k ? QUAY.z1 + 14 : QUAY.z1 - 18; [L.x, L.z] = toW(c.x, lz, H.zn); }
    for (const s of [-1, 1]) for (const lz of [QUAY.z1 - 30, QUAY.z1 - 6]) { const [wx, wz] = toW(c.x + s * 9, lz, H.zn); _hc.push({ x: wx, z: wz, r: 1 }); }
  }
  // 集卡：沿路線開，前面有人、有車或別台集卡就停；開到作業中的岸橋底下停 5 秒裝卸
  const P = H.path, [plx, plz] = toL(player.x, player.z, H.zn);
  for (const tk of H.trucks) {
    const [fx, fz] = harborPathAt(tk.s + 3), [bx, bz] = harborPathAt(tk.s);
    const hx = fx - bx, hz = fz - bz, hl = Math.hypot(hx, hz) || 1;
    let want = 5.5;
    const dpx = plx - bx, dpz = plz - bz, ahead = (dpx * hx + dpz * hz) / hl, side = Math.abs(dpx * hz - dpz * hx) / hl;
    if (ahead > 0 && ahead < 11 && side < 2.6) want = 0;
    for (const o of H.trucks) if (o !== tk) { const d = ((o.s - tk.s) % P.len + P.len) % P.len; if (d < 20) want = 0; }
    if (tk.wait > 0) { tk.wait -= dt; want = 0; }
    else if (bz > H.landZ - 1 && hx > 0) for (const [ci, c] of H.cranes.entries()) if (c.work && ci !== tk.lastCrane && Math.abs(bx - c.x) < .6) { tk.wait = 5; tk.lastCrane = ci; tk.load = !tk.load; }
    if (bz < H.landZ - 30) tk.lastCrane = -1;
    tk.v = damp(tk.v, want, want ? 1.2 : 4, dt);
    tk.s = (tk.s + tk.v * dt) % P.len;
    const [cx, cz] = harborPathAt(tk.s), [ax, az] = harborPathAt(tk.s + 2.5), [rx, rz] = harborPathAt(tk.s - 11);
    const ty = Math.atan2(ax - cx, az - cz), ry = Math.atan2(cx - rx, cz - rz);
    tk.tr.position.set(cx, 0, cz); tk.tr.rotation.y = ty;
    tk.ch.position.set(cx, 0, cz); tk.ch.rotation.y = ry;
    tk.box.visible = tk.load; tk.box.position.set(cx - Math.sin(ry) * 6.3, 2.47, cz - Math.cos(ry) * 6.3); tk.box.rotation.y = ry + Math.PI / 2;
    for (const [k, d] of [[0, 1.2], [1, -5], [2, -10.5]]) {
      const [px, pz] = k ? [cx - Math.sin(ry) * -d, cz - Math.cos(ry) * -d] : [cx + Math.sin(ty) * d, cz + Math.cos(ty) * d];
      const [wx, wz] = toW(px, pz, H.zn); _hc.push({ x: wx, z: wz, r: 1.45, car: 1 });
    }
  }
  dynCircles.length = 0; dynCircles.push(..._hc);
}
