
// ═══ 街道設施、招牌、全息廣告、蒸氣、雨與天空 ═══
await bootStep(BOOT.props, '擺放街道與招牌…');
const _o = new T.Object3D(), _pfm = new T.Matrix4();
// 清單是邏輯座標（t.zn 給了就用那一片，否則看位置在哪一片；null 是世界座標）：每個 instance 的矩陣乘上所在位置的 frameM4 換成世界座標，InstancedMesh 本身掛在 scene
// R：只送相機附近幾公尺內的實例（預設 INST_R；面數多的模型，例如 27-props 檔尾的樹，給小一點）。
// stream.R0：近處這幾公尺內的不送（27-props 檔尾換成模型後，程式建模的樹只畫在模型的範圍外，當遠景）
// 每個實例記在清單項目的 t._inst（[網格, 編號]），之後要整個拿掉（27-bldfoot 讓位給實體建築的行道樹）用 instHide；標了 t.hide 的之後建的網格也不畫
function instanced(geo, mat, list, layer = 0, extra, R) {
  const m = new T.InstancedMesh(geo, mat, Math.max(1, list.length));
  const wx = new Float32Array(list.length), wz = new Float32Array(list.length);
  list.forEach((t, k) => {
    _o.position.set(t.x, t.y || 0, t.z); _o.rotation.set(t.rx || 0, t.ry || 0, t.rz || 0, 'YXZ');
    _o.scale.set(t.sx || t.s || 1, t.sy || t.s || 1, t.sz || t.s || 1); if (t.hide) _o.scale.setScalar(0); _o.updateMatrix();
    (t._inst || (t._inst = [])).push([m, k]);
    const zn = t.zn !== undefined ? t.zn : zoneAtL(t.x, t.z);
    if (zn) _o.matrix.premultiply(frameM4(zn, t.x, t.z, _pfm));
    wx[k] = _o.matrix.elements[12]; wz[k] = _o.matrix.elements[14];
    m.setMatrixAt(k, _o.matrix);
  });
  m.count = list.length;
  if (extra) geo.setAttribute('aIns', new T.InstancedBufferAttribute(new Float32Array(Math.max(1, list.length) * 4).map((_, k) => extra(list[k >> 2] || {}, k & 3)), 4));
  m.computeBoundingSphere();
  m.layers.set(layer);
  scene.add(m);
  if (list.length > 160 || R) instStreamAdd(m, wx, wz, R);   // 有給 R 就一定串流（數量少但面數多的模型）
  return m;
}
// 20×15 的城市有幾千盞路燈、上千個號誌：數量多的設施只把相機附近 INST_R 內的那幾個搬到 instance 緩衝區前段畫（相機移動 12 m 重排一次）。
// 原始矩陣與 instance 屬性另存一份；之後要改某一個（打爛電訊箱）用 instSet，依編號更新號誌燈號用 m.userData.map（緩衝區位置 → 原始編號）。
const INST_R = 380, instStreams = [];
function instStreamAdd(m, xs, zs, R = INST_R) {
  const n = xs.length, attrs = Object.entries(m.geometry.attributes).filter(([, a]) => a.isInstancedBufferAttribute).map(([k, a]) => ({ a, src: a.array.slice(0, n * a.itemSize) }));
  const S = { m, n, mtx: m.instanceMatrix.array.slice(0, n * 16), xs, zs, attrs, cx: 1e9, cz: 1e9, dirty: true, R };
  // 剔除用的球：中心跟著相機的水平位置，高度取實例的高低中點（山坡別墅、山林在一兩百公尺高，球心放在 y = 0 會被整組剔掉），半徑涵蓋串流半徑與高低差
  let y0 = Infinity, y1 = -Infinity;
  for (let k = 0; k < n; k++) { const y = S.mtx[k * 16 + 13]; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  S.cy = n ? (y0 + y1) / 2 : 0; S.hy = n ? (y1 - y0) / 2 : 0;
  m.userData.map = new Int32Array(n); m.userData.stream = S;
  m.boundingSphere = new T.Sphere(V3(0, S.cy, 0), Math.hypot(R + 30, S.hy));
  instStreams.push(S);
}
// 清單項目的所有實例縮成 0（串流的改原始矩陣）
function instHide(t) {
  t.hide = 1;
  for (const [m, k] of t._inst || []) {
    const S = m.userData.stream;
    if (S) { S.mtx.fill(0, k * 16, k * 16 + 16); S.dirty = true; }
    else { m.setMatrixAt(k, new T.Matrix4().makeScale(0, 0, 0)); m.instanceMatrix.needsUpdate = true; }
  }
}
// 整個縮小 f 倍（繞實例原點，也就是樹根；27-bldfoot 讓位給實體建築的行道樹）
function instScale(t, f) {
  const M = new T.Matrix4(), v = new T.Vector3(f, f, f);
  for (const [m, k] of t._inst || []) {
    const S = m.userData.stream;
    if (S) { M.fromArray(S.mtx, k * 16).scale(v).toArray(S.mtx, k * 16); S.dirty = true; }
    else { m.getMatrixAt(k, M); m.setMatrixAt(k, M.scale(v)); m.instanceMatrix.needsUpdate = true; }
  }
}
// mtx 是世界座標
function instSet(m, k, mtx) {
  const S = m.userData.stream;
  if (!S) { m.setMatrixAt(k, mtx); m.instanceMatrix.needsUpdate = true; return; }
  mtx.toArray(S.mtx, k * 16); S.dirty = true;
}
function instUpdate(cx, cz) {
  for (const S of instStreams) {
    if (!S.dirty && S.dv === detail.v && (S.cx - cx) ** 2 + (S.cz - cz) ** 2 < 144) continue;
    S.dirty = false; S.cx = cx; S.cz = cz; S.dv = detail.v;
    const { m, mtx } = S, dst = m.instanceMatrix.array, map = m.userData.map, R2 = S.R * S.R * detailK() ** 2, R02 = (S.R0 || 0) ** 2;
    let c = 0;
    for (let k = 0; k < S.n; k++) {
      const d2 = (S.xs[k] - cx) ** 2 + (S.zs[k] - cz) ** 2;
      if (d2 > R2 || d2 < R02) continue;
      for (let e = 0; e < 16; e++) dst[c * 16 + e] = mtx[k * 16 + e];
      for (const { a, src } of S.attrs) for (let e = 0; e < a.itemSize; e++) a.array[c * a.itemSize + e] = src[k * a.itemSize + e];
      map[c++] = k;
    }
    m.count = c; m.instanceMatrix.needsUpdate = true;
    for (const { a } of S.attrs) a.needsUpdate = true;
    m.boundingSphere.center.set(cx, S.cy, cz); m.boundingSphere.radius = Math.hypot(S.R * detailK() + 30, S.hy);
  }
}
// 避免設施互相重疊：佔用的圓放進 8 m 的格子（最大半徑 3.4 m），只比對附近幾格
const nearProp = new Map(), NP_S = 8, npKey = (c, d) => (c + 1024) * 4096 + d + 1024;
const free = (x, z, r) => {
  for (let c = Math.floor((x - r - 3.5) / NP_S); c <= Math.floor((x + r + 3.5) / NP_S); c++) for (let d = Math.floor((z - r - 3.5) / NP_S); d <= Math.floor((z + r + 3.5) / NP_S); d++)
    for (const p of nearProp.get(npKey(c, d)) || []) if ((p.x - x) ** 2 + (p.z - z) ** 2 < (p.r + r) ** 2) return false;
  return true;
};
const claim = (x, z, r) => { const k = npKey(Math.floor(x / NP_S), Math.floor(z / NP_S)); let L = nearProp.get(k); if (!L) nearProp.set(k, L = []); L.push({ x, z, r }); };
// 斜的大道（06-roads.js 的 PLAZA）先佔掉：街區邊的設施（消防栓、樹、報箱……）照樣抽亂數，只是擺不進路面
for (const p of PLAZA.values()) for (let a = 0; a <= p.len; a += 2) claim(p.ax + p.ux * a, p.az + p.uz * a, HR + .8);

// ─── 路燈：沿路網每一段（各區自己的邊界路也有一份）；燈頭的位置寫進 shader 的路燈表（lampTable，lampGrid 查） ───
const lampsA = [], lampsS = [], lampsC = [];
for (const e of RN.edges) {
  if (e.kind === 'c' || e.kind === 'd' || e.kind === 'f') {   // 區之間的連接道路、斜的大道與快速道路（世界座標）：兩側每 20 m 一盞，路口範圍內不放
    for (let u = HR + 10; u < e.len - HR - 6; u += 20) for (const s of [-1, 1]) {
      const [x, z] = edgeAt(e, u), [xa, za] = edgeAt(e, Math.max(0, u - 1)), [xb, zb] = edgeAt(e, Math.min(e.len, u + 1)), l = Math.hypot(xb - xa, zb - za) || 1;
      const nx = (zb - za) / l * s, nz = -(xb - xa) / l * s;   // 往路外
      if (brokenNear(x + nx * 9.6, z + nz * 9.6, 3)) continue;   // 鐵灣高架斷橋的跑道與飛越的路段（06-roads.js）
      if (e.kind === 'f') {   // 快速道路：燈柱立在護欄上（DECK_W 內 0.3 m），跟著上下坡；燈頭伸到路肩上方
        const y = fwyH(e, u), o = (e.dw || DECK_W) - .3;
        lampsC.push({ x: x + nx * o, z: z + nz * o, y, ry: Math.atan2(-nz, nx), hx: x + nx * (o - 2.2), hz: z + nz * (o - 2.2), zn: null });
        continue;
      }
      if (deckTop(x + nx * 9.6, z + nz * 9.6) !== null) continue;   // 從快速道路橋下穿過的那一段不放（燈頭會頂到橋面）
      lampsC.push({ x: x + nx * 9.6, z: z + nz * 9.6, ry: Math.atan2(-nz, nx), hx: x + nx * 7.4, hz: z + nz * 7.4, zn: null });
    }
    continue;
  }
  const { i, j } = e.a, zn = e.zn;
  // 斜的大道切過廣場街區的轉角：落在大道路面上的燈不放（plazaD）
  if (e.kind === 'z') { for (const s of [-1, 1]) for (const o of [16, 31, 46]) if (plazaD(avX(i) + s * 8.6, stZ(j) + o) > HR + 1) lampsA.push({ x: avX(i) + s * 8.6, z: stZ(j) + o, ry: s > 0 ? 0 : Math.PI, hx: avX(i) + s * 6.4, zn }); }
  else for (const s of [-1, 1]) for (const o of [18, 36, 54]) if (plazaD(avX(i) + o, stZ(j) + s * 8.6) > HR + 1) lampsS.push({ x: avX(i) + o, z: stZ(j) + s * 8.6, ry: s > 0 ? -Math.PI / 2 : Math.PI / 2, hz: stZ(j) + s * 6.4, zn });
}
function lampKit(col) {
  return new Kit()
    .cyl(0, .35, 0, .16, .2, .7, 10, 0x22252a, 15)
    .cyl(0, 3.7, 0, .075, .1, 6.8, 10, 0x2a2d33, 15)
    .box(-1.1, 7.15, 0, 2.3, .09, .09, 0x2a2d33, 15)
    .box(-2.25, 7.1, 0, .72, .16, .32, 0x1d1f23, 15)
    .box(-2.25, 7.0, 0, .6, .04, .24, col, 8)
    .build();
}
const lampMeshA = instanced(lampKit(0xff8a3a), MAT.uber, lampsA);
const lampMeshS = instanced(lampKit(0xb8dcff), MAT.uber, lampsS);
const lampMeshC = instanced(lampKit(0xff8a3a), MAT.uber, lampsC);
for (const l of [...lampsA, ...lampsS]) { circles.push(circleToW({ x: l.x, z: l.z, r: .22 }, l.zn)); claim(l.x, l.z, 1.4); }
for (const l of lampsC) if (!(l.y > .3)) circles.push({ x: l.x, z: l.z, r: .22, w: 1 });   // 橋上的燈柱在護欄上，護欄就擋住了
// 路燈表（00-core.js 的 lampGrid）：燈頭的世界座標放進光照範圍（√420 ≈ 20.5 m）蓋到的每一格；一格超過 LAMP_K 盞就留離格子中心最近的
function lampTable(heads) {
  const R = Math.sqrt(420) + .5;
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
  for (const h of heads) { x0 = Math.min(x0, h.x - R); x1 = Math.max(x1, h.x + R); z0 = Math.min(z0, h.z - R); z1 = Math.max(z1, h.z + R); }
  const nx = Math.ceil((x1 - x0) / LAMP_C), nz = Math.ceil((z1 - z0) / LAMP_C), cells = Array.from({ length: nx * nz }, () => []);
  for (const h of heads) {
    for (let c = Math.floor((h.x - R - x0) / LAMP_C); c <= Math.floor((h.x + R - x0) / LAMP_C); c++) for (let d = Math.floor((h.z - R - z0) / LAMP_C); d <= Math.floor((h.z + R - z0) / LAMP_C); d++) {
      if (c < 0 || d < 0 || c >= nx || d >= nz) continue;
      const qx = clamp(h.x, x0 + c * LAMP_C, x0 + (c + 1) * LAMP_C), qz = clamp(h.z, z0 + d * LAMP_C, z0 + (d + 1) * LAMP_C);
      if ((qx - h.x) ** 2 + (qz - h.z) ** 2 < R * R) cells[d * nx + c].push(h);
    }
  }
  const data = new Float32Array(nx * LAMP_K * nz * 4);
  let over = 0;
  cells.forEach((L, k) => {
    const c = k % nx, d = Math.floor(k / nx), cx = x0 + (c + .5) * LAMP_C, cz = z0 + (d + .5) * LAMP_C;
    if (L.length > LAMP_K) { over++; L.sort((a, b) => (a.x - cx) ** 2 + (a.z - cz) ** 2 - (b.x - cx) ** 2 - (b.z - cz) ** 2); }
    L.slice(0, LAMP_K).forEach((h, n) => data.set([h.x, h.z, h.t, 1 + (h.y || 0)], ((d * nx + c) * LAMP_K + n) * 4));
  });
  if (over) console.warn('lamp table: cells over', LAMP_K, over);
  const tex = new T.DataTexture(data, nx * LAMP_K, nz, T.RGBAFormat, T.FloatType);
  tex.minFilter = tex.magFilter = T.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  U.uLampT.value = tex; U.uLampG.value.set(x0, z0, nx, nz);
}
const LAMP_HEADS = [...lampsA.map(l => { const [x, z] = toW(l.hx, l.z, l.zn); return { x, z, t: 0 }; }), ...lampsS.map(l => { const [x, z] = toW(l.x, l.hz, l.zn); return { x, z, t: 1 }; }),
  ...lampsC.map(l => ({ x: l.hx, z: l.hz, t: 0, y: l.y }))];   // 28-enclave.js 再加上雲梯城寨的路燈、重畫一次
lampTable(LAMP_HEADS);
// 車行門前的兩台展示車與門口、車庫門前的車道：不放人行道設施
for (const [x, z, r] of [[DEAL_X - 6.5, DEAL_Z + 2.1, 3], [DEAL_X + 6.5, DEAL_Z + 2.1, 3], [DEAL_X, DEAL_Z + 1.5, 2], [HOME_X, HOME_Z - 2.2, 3.4]]) claim(x, z, r);

// 路燈下的光錐（體積光）：加法混合，越靠近燈頭越亮
const CONE_VS = /* glsl */`
varying vec3 vW, vN; varying float vH;
void main(){
  vec4 lp = instanceMatrix * vec4(position, 1.);
  vec4 w = modelMatrix * lp; vW = w.xyz; vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vH = clamp(position.y / 7., 0., 1.);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const CONE_FS = /* glsl */`
${GL_LIB}
uniform vec3 uColor;
varying vec3 vW, vN; varying float vH;
void main(){
  vec3 v = normalize(uCam - vW);
  float edge = pow(abs(dot(normalize(vN), v)), 2.2);
  float d = length(vW - uCam);
  float a = edge * pow(clamp(vH, 0., 1.), 1.6) * .11 * uLamp;
  a *= smoothstep(1.2, 6., d) * exp(-d * uFogDen * .9);
  a *= .65 + .35 * n2(vec2(atan(vN.z, vN.x) * 3., vW.y * 1.5 + uTime * 7.));
  a *= .8 + .4 * uRain;
  gl_FragColor = vec4(uColor * a, 1.);
}`;
function coneMat(col) {
  return new T.ShaderMaterial({ name: 'cone', uniforms: { ...shared(ALLU), uColor: { value: lin(col) } }, vertexShader: CONE_VS, fragmentShader: CONE_FS,
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
}
{
  const cg = new T.CylinderGeometry(.22, 3.1, 7, 18, 1, true); cg.translate(0, 3.5, 0);
  instanced(cg, coneMat(0xff9a4c), lampsA.map(l => ({ x: l.hx, z: l.z, zn: l.zn })), LY.NOREFL);
  instanced(cg.clone(), coneMat(0xa8d4ff), lampsS.map(l => ({ x: l.x, z: l.hz, zn: l.zn })), LY.NOREFL);
  instanced(cg.clone(), coneMat(0xff9a4c), lampsC.map(l => ({ x: l.hx, y: l.y, z: l.hz, zn: null })), LY.NOREFL);
}

// ─── 紅綠燈：每個路口每個來車方向一支懸臂號誌（立在來車那段路的右前方） ───
// 往外的方向換到路口所在區的邏輯座標再對齊軸（連接道路垂直離開邊界路，也落在軸上）；ax 和車流用的 edgeAx() 一樣
const signals = [];
for (const n of RN.nodes) for (const { e, dir } of n.out) {
  if (e.kind === 'd') continue;   // 斜的大道跟著方向比較接近的那一相（edgeAx），不另外立號誌
  if (n.nosig || e.oneway && dir === e.oneway) continue;   // 高架上的分合流點沒有號誌；單向的匝道從這裡出去就沒有來車
  if (n.free) {   // 快速道路與連接道路的交叉口（06-roads.js，世界座標）：立在來車那段路的右前方
    const [gx, gz] = outDir(e, dir), hx = -gx, hz = -gz;   // 來車方向
    signals.push({ x: n.x + gx * 9.2 - hz * 9.2, z: n.z + gz * 9.2 + hx * 9.2, ry: Math.atan2(hx, hz), i: n.i, j: n.j, ax: edgeAx(n, e), zn: null, node: n });
    continue;
  }
  const [ox, oz] = dirL(n.zn, ...outDir(e, dir)), ax = edgeAx(n, e), sg = ax === 'x' ? Math.sign(ox) : Math.sign(oz);
  const hx = ax === 'x' ? -sg : 0, hz = ax === 'z' ? -sg : 0;   // 來車的方向（邏輯座標）：和往外的方向相反
  signals.push({ x: avX(n.i) - hx * 9.2 - hz * 9.2, z: stZ(n.j) - hz * 9.2 + hx * 9.2, ry: Math.atan2(hx, hz), i: n.i, j: n.j, ax, zn: n.zn, node: n });
}
// 照美式懸臂號誌（mast arm）的照片畫：混凝土基座、底板與錨栓、錐形鋼柱、斜上的錐形懸臂與法蘭、兩組三色燈（12 吋燈面、
// 遮光罩、黑色背板帶黃色反光邊）、吊架；柱上朝路口的行人號誌與按鈕盒。局部座標：柱在原點，懸臂朝 +x，燈面朝 -z（來車）
// lo：遠景版（SIG_NEAR 外）：段數減半、不畫螺帽、燈框、遮光罩內壁與按鈕盒，圓角盒改直角，約 1/4 的面
const sigBuild = (lo) => {
  const k = new Kit(), steel = 0x3a3e44, dark = 0x121417, ARM_Y = 5.95, sg = (n) => lo ? Math.max(4, n >> 1) : n;
  const rb = (x, y, z, sx, sy, sz, r, c, m, rx = 0, ry = 0, rz = 0, b = 0) => lo ? k.box(x, y, z, sx, sy, sz, c, m, rx, ry, rz) : k.rbox(x, y, z, sx, sy, sz, r, c, m, rx, ry, rz, b);
  k.cyl(0, .1, 0, .4, .43, .2, sg(16), 0x77736b, TX.conc).box(0, .22, 0, .5, .04, .5, steel, TX.iron);   // 基座、底板
  if (!lo) for (const [x, z] of [[-.19, -.19], [.19, -.19], [-.19, .19], [.19, .19]]) k.cyl(x, .27, z, .028, .028, .07, 6, 0x6a6c70, TX.galv);   // 錨栓螺帽
  k.lathe(0, 0, 0, [[.25, .24], [.25, .34], [.21, .4], [.165, .47]], sg(16), steel, TX.iron);   // 底座罩
  k.lathe(0, 0, 0, [[.165, .47], [.118, 6.42], [.128, 6.44], [.128, 6.5], [.07, 6.58], [0, 6.6]], sg(16), steel, TX.iron);   // 錐形柱與柱頂蓋
  // 懸臂：法蘭板、斜上的錐形臂、下面的三角肋板、末端蓋
  k.box(.15, ARM_Y, 0, .05, .44, .34, steel, TX.iron);
  if (!lo) for (const z of [-.12, .12]) for (const y of [-.15, .15]) k.cyl(.18, ARM_Y + y, z, .02, .02, .05, 6, 0x6a6c70, TX.galv, 0, 0, Math.PI / 2);
  k.rod(.17, ARM_Y, 0, 5.75, ARM_Y + .32, 0, .105, sg(12), steel, TX.iron, .06);
  k.prism(.17, ARM_Y, 0, [[0, -.02], [.55, -.02], [0, -.5]], .025, steel, TX.iron);
  k.cyl(5.76, ARM_Y + .32, 0, .062, .062, .03, sg(10), steel, TX.iron, 0, 0, Math.PI / 2);
  // 三色燈：背板、黃邊、燈箱、每格的燈面、外框與遮光罩，上面的吊架夾在臂上
  const head = (hx) => {
    const ay = ARM_Y + .32 * (hx - .17) / 5.58, hy = ay - .62;
    rb(hx, hy, .15, .58, 1.3, .025, .05, dark, TX.rubber);
    for (const [x, y, w, h] of [[0, .625, .58, .05], [0, -.625, .58, .05], [-.265, 0, .05, 1.3], [.265, 0, .05, 1.3]]) k.box(hx + x, hy + y, .134, w, h, .008, 0xd9b020, 10);
    rb(hx, hy, 0, .36, 1.06, .26, .045, dark, TX.rubber, 0, 0, 0, .015);
    [[0xff2a1a, 12], [0xffb020, 13], [0x40ff9a, 14]].forEach(([c, m], i) => {
      const y = hy + .35 - i * .35;
      k.cyl(hx, y, -.132, .135, .135, .02, sg(12), c, m, Math.PI / 2);
      if (lo) { k.box(hx, y + .13, -.25, .3, .02, .24, dark, TX.rubber); return; }
      k.cyl(hx, y, -.128, .158, .158, .012, 12, 0x1c1e22, TX.rubber, Math.PI / 2);
      k.visor(hx, y, -.13, .165, .24, dark, TX.rubber, Math.PI);
      if (i < 2) k.box(hx, y - .175, -.12, .34, .012, .02, 0x08090a, 2);
    });
    k.box(hx, hy + .56, 0, .12, .06, .12, steel, TX.iron).rod(hx, hy + .58, 0, hx, ay - .05, 0, .025, sg(8), steel, TX.iron);
    rb(hx, ay, 0, .1, .2, .24, .03, steel, TX.iron);   // 臂上的夾具
  };
  head(2.7); head(5.1);
  // 柱上的行人號誌（朝 +x，過馬路的人看對面那一支）：燈箱、遮罩、亮著的橘色手掌；下面是按鈕盒與說明牌
  rb(.27, 2.75, 0, .2, .4, .38, .03, dark, TX.rubber, 0, Math.PI / 2).box(.18, 2.75, 0, .14, .06, .06, steel, TX.iron);
  k.box(.375, 2.75, 0, .01, .3, .3, 0xff7a20, 11).box(.42, 2.92, 0, .1, .02, .38, dark, TX.rubber);
  for (const z of [-.19, .19]) k.box(.42, 2.75, z, .1, .36, .02, dark, TX.rubber);
  if (!lo) {
    k.rbox(.16, 1.1, .1, .1, .17, .08, .02, 0xb89a2a, TX.iron, 0, Math.PI / 4).cyl(.2, 1.12, .14, .03, .03, .03, 10, 0x2a2c30, 3, Math.PI / 2, Math.PI / 4);
    k.box(.17, 1.32, .11, .015, .22, .14, 0xe8e8e2, 10, 0, Math.PI / 4);
  }
  return k.build();
};
// 近處 SIG_NEAR 內畫完整的、外面畫遠景版（兩個串流網格，R0 跟著畫質的距離倍率走，交界不重疊也不留空）；燈號兩個都更新
const SIG_NEAR = 70, sigMesh = instanced(sigBuild(false), MAT.uxI, signals, 0, () => 0, SIG_NEAR), sigFar = instanced(sigBuild(true), MAT.uxI, signals, 0, () => 0);
if (sigFar.userData.stream) Object.defineProperty(sigFar.userData.stream, 'R0', { get: () => SIG_NEAR * detailK() });
for (const s of signals) { circles.push(circleToW({ x: s.x, z: s.z, r: .2 }, s.zn)); if (s.zn) claim(s.x, s.z, 1.2); }
const SIGP = 26;
function lightState(i, j, ax, t) {
  const k = ((t + (i * 7 + j * 11) % SIGP) % SIGP + SIGP) % SIGP;
  if (ax === 'z') return k < 11 ? 2 : k < 13 ? 1 : 0;
  return k < 13 ? 0 : k < 24 ? 2 : 1;
}
function updateSignals(t) {
  for (const m of [sigMesh, sigFar]) {
    const a = m.geometry.attributes.aIns, map = m.userData.map;
    for (let c = 0; c < m.count; c++) { const s = signals[map ? map[c] : c]; a.array[c * 4] = lightState(s.i, s.j, s.ax, t); }
    a.needsUpdate = true;
  }
}

// ─── 人行道小物：消防栓、垃圾桶、報箱、護柱、電話亭 ───
const hydrants = [], bins = [], boxesN = [], bollards = [], booths = [], grates = [], trees = [], fountains = [];
const TREE_COL = .2;   // 樹的碰撞半徑：樹幹（街樹、公園、World 第二輪換上的模型）底部半徑約 0.13–0.19 m；以前 0.3–0.35，人在樹幹前 20 cm 就被擋住
const sideSpots = [];  // 人行道上沿路緣的位置
for (const b of blocks) {
  if (b.outer) continue;
  const edges = [
    { x0: b.x0 + 14, x1: b.x1 - 14, z: b.z0 + .9, nz: -1 }, { x0: b.x0 + 14, x1: b.x1 - 14, z: b.z1 - .9, nz: 1 },
  ];
  for (const e of edges) for (let x = e.x0; x < e.x1; x += 2.5 + rnd() * 4) sideSpots.push({ x, z: e.z, ry: e.nz > 0 ? Math.PI : 0, nz: e.nz, ax: 'z' });
  const edges2 = [{ z0: b.z0 + 14, z1: b.z1 - 14, x: b.x0 + .9, nx: -1 }, { z0: b.z0 + 14, z1: b.z1 - 14, x: b.x1 - .9, nx: 1 }];
  for (const e of edges2) for (let z = e.z0; z < e.z1; z += 2.5 + rnd() * 4) sideSpots.push({ x: e.x, z, ry: e.nx > 0 ? -Math.PI / 2 : Math.PI / 2, nx: e.nx, ax: 'x' });
}
for (const s of sideSpots) {
  const r = rnd();
  if (r < .1 && free(s.x, s.z, .6)) { hydrants.push({ ...s, y: .15 }); claim(s.x, s.z, .6); circles.push({ x: s.x, z: s.z, r: .25 }); }
  else if (r < .2 && free(s.x, s.z, .7)) { bins.push({ ...s, y: .15 }); claim(s.x, s.z, .7); circles.push({ x: s.x, z: s.z, r: .32 }); }
  else if (r < .26 && free(s.x, s.z, .8)) { boxesN.push({ ...s, y: .15 }); claim(s.x, s.z, .8); circles.push({ x: s.x, z: s.z, r: .45 }); }
  else if (r < .3 && free(s.x, s.z, 1.2)) { booths.push({ ...s, y: .15 }); claim(s.x, s.z, 1.2); circles.push({ x: s.x, z: s.z, r: .55 }); }
}
// 路口轉角的護柱（只放在這一區自己的人行道上）
for (const n of RN.nodes) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
  if (n.free) continue;   // 快速道路的交叉口沒有人行道（亂數序列和以前一樣：這些路口排在最後）
  if (rnd() < .45) continue;
  for (let k = 0; k < 3; k++) {
    const x = avX(n.i) + sx * (8.5 + (k === 2 ? 0 : 1.3 + k * 1.3)), z = stZ(n.j) + sz * (8.5 + (k === 2 ? 1.3 : 0));
    if (groundHL(x, z) > 0 && inZoneL(n.zn, x, z) && free(x, z, .3)) { bollards.push({ x, z, y: .15 }); circles.push({ x, z, r: .14 }); }
  }
}
// 燈籠公園的步道燈籠：十字碎石小徑（10-city.js 的 LAWN_FS，沿街區中線、寬約 3.6 m）兩側每 9 m 一盞，左右交錯，十字口留空。
// 先擺燈再種樹，樹會避開；燈光在 signLights 宣告之後才推進去（下面 parkLamps 那段）
const parkLamps = [];
for (const b of blocks) {
  if (b.outer || !b.park) continue;
  const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  for (const [ax, a0, a1] of [['x', b.x0 + SW + 2, b.x1 - SW - 2], ['z', b.z0 + SW + 2, b.z1 - SW - 2]]) {
    let k = 0;
    for (let a = a0 + 2; a < a1 - 2; a += 9, k++) {
      if (Math.abs(a - (ax === 'x' ? cx : cz)) < 4) continue;
      const side = k % 2 ? 1 : -1, x = ax === 'x' ? a : cx + side * 2.4, z = ax === 'x' ? cz + side * 2.4 : a;
      parkLamps.push({ x, z, y: .15, ry: ax === 'x' ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : (side > 0 ? 0 : Math.PI) });
      claim(x, z, 1.2); circles.push({ x, z, r: .12 });
    }
  }
}
// 燈籠燈（照中式庭園的燈籠燈柱）：石座、鑄鐵柱與柱頂的寶珠、捲草紋托架撐著的橫臂、吊環、鼓形的紅紙燈籠（12 條骨架、亮著的燈面）、金色上下蓋與流蘇
{
  const k = new Kit(), iron = 0x2a2622, gold = 0xb8862a, lx = -.82;
  k.lathe(0, 0, 0, [[.2, 0], [.2, .22], [.16, .26], [.16, .3], [.11, .36], [.08, .42]], 8, 0x6e6a62, TX.stone);
  k.lathe(0, 0, 0, [[.08, .42], [.065, 3.3], [.08, 3.32], [.08, 3.36], [.05, 3.4]], 8, iron, TX.iron);
  k.add(new T.SphereGeometry(.07, 8, 6), lin(gold), 15, tf(0, 3.45, 0)).cyl(0, 1.0, 0, .085, .085, .05, 8, iron, TX.iron);
  k.box(-.45, 3.25, 0, .95, .05, .05, iron, TX.iron).cyl(-.93, 3.25, 0, .035, .035, .06, 8, gold, 15, 0, 0, Math.PI / 2);
  k.torus(-.5, 2.75, 0, .5, .018, 12, iron, TX.iron, 0, 0, 0, Math.PI / 2, 4);   // 托架：從柱身彎上去接橫臂的四分之一弧，中間一個捲草
  k.torus(-.2, 3.08, 0, .08, .014, 8, iron, TX.iron, 0, 0, 0, Math.PI * 1.5, 4);
  k.cyl(lx, 3.16, 0, .012, .012, .16, 4, iron, TX.iron).torus(lx, 3.07, 0, .04, .01, 8, gold, 15, 0, 0, 0);
  k.cyl(lx, 3.0, 0, .1, .12, .06, 12, gold, 15);
  k.lathe(lx, 0, 0, [[.1, 2.97], [.18, 2.93], [.25, 2.84], [.28, 2.72], [.28, 2.62], [.25, 2.5], [.18, 2.41], [.1, 2.37]], 12, 0xff8a3a, 11);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a); k.rod(lx + c * .19, 2.92, sn * .19, lx + c * .287, 2.67, sn * .287, .008, 3, 0xa82a14, 11).rod(lx + c * .287, 2.67, sn * .287, lx + c * .19, 2.42, sn * .19, .008, 3, 0xa82a14, 11); }
  k.cyl(lx, 2.34, 0, .12, .1, .06, 12, gold, 15).cyl(lx, 2.27, 0, .02, .02, .08, 6, gold, 15).cyl(lx, 2.12, 0, .01, .05, .22, 8, 0xd8401c, 11);
  instanced(k.build(), MAT.ux, parkLamps, LY.NOREFL);
}

// 行道樹：紅磚巷與舊碼頭比較多；燈籠公園的草地上種滿樹
for (const b of blocks) {
  if (b.outer) continue;
  if (b.plaza) {   // 廣場：大道一側的三角形中間是噴水池（相鄰的街區左右輪流），其他鋪面上種樹（離大道 4 m 以上）
    const p = b.plaza, r3 = rng(b.i * 173 + b.j * 7 + 5), sg = (b.i + b.j) % 2 ? 1 : -1, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    const fx = cx + p.uz * sg * (HR + 10.5), fz = cz - p.ux * sg * (HR + 10.5);
    fountains.push({ x: fx, z: fz }); claim(fx, fz, 6); circles.push({ x: fx, z: fz, r: 3.3 });
    for (let x = b.x0 + SW + 3; x < b.x1 - SW - 2; x += 6.5) for (let z = b.z0 + SW + 3; z < b.z1 - SW - 2; z += 6.5) {
      const tx = x + (r3() - .5) * 2, tz = z + (r3() - .5) * 2, d = plazaD(tx, tz);
      if (r3() < .6 && d > HR + 4 && free(tx, tz, 2.2)) { trees.push({ x: tx, z: tz, y: .15, ry: r3() * 6.3, s: .9 + r3() * .4 }); claim(tx, tz, 2.2); circles.push({ x: tx, z: tz, r: TREE_COL }); }
    }
  }
  if (b.park) {
    const r3 = rng(b.i * 131 + b.j);
    for (let x = b.x0 + SW + 4; x < b.x1 - SW - 3; x += 7) for (let z = b.z0 + SW + 4; z < b.z1 - SW - 3; z += 7) {
      const tx = x + (r3() - .5) * 4, tz = z + (r3() - .5) * 4;
      if (r3() < .55 && free(tx, tz, 2.4)) { trees.push({ x: tx, z: tz, y: .15, ry: r3() * 6.3, s: .95 + r3() * .5, park: 1 }); claim(tx, tz, 2.4); circles.push({ x: tx, z: tz, r: TREE_COL }); }
    }
  }
  const dist = district((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
  const dens = dist.startsWith('霓虹') ? .35 : dist.startsWith('中城') ? .45 : .8;
  for (const z of [b.z0 + 1.6, b.z1 - 1.6]) for (let x = b.x0 + 12; x < b.x1 - 10; x += 9 + rnd() * 3)
    if (rnd() < dens && free(x, z, 2.2)) { const t = { x, z, y: .15, ry: rnd() * 6.3, s: .85 + rnd() * .35, walk: 1 }; trees.push(t); claim(x, z, 2.2); circles.push(t.col = { x, z, r: TREE_COL }); }
  for (const x of [b.x0 + 1.6, b.x1 - 1.6]) for (let z = b.z0 + 12; z < b.z1 - 10; z += 9 + rnd() * 3)
    if (rnd() < dens * .7 && free(x, z, 2.2)) { const t = { x, z, y: .15, ry: rnd() * 6.3, s: .85 + rnd() * .35, walk: 1 }; trees.push(t); claim(x, z, 2.2); circles.push(t.col = { x, z, r: TREE_COL }); }
}
// 片之間的空地：每一對相鄰的片，沿著共用的邊界走，在這片的邊界路與那片的邊界路中間鋪碎石步道（SEAM_PATH，世界座標的折線，
// 點上記草地寬 w），夠寬的地方擺涼亭、茶亭、公廁（SEAM_SITES）；長椅、路燈、建物的樣子在 21-coast.js。
// 步道在連接道路前斷開，草地不到 12 m、斷橋底下、外緣外面不鋪
const SEAM_PATH = [], SEAM_SITES = [];
{
  const conn = RN.edges.filter(e => e.kind === 'c' || e.kind === 'f');   // 快速道路經過的縫不鋪步道
  const nearConn = (x, z, r) => conn.some(e => e.pts.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < r * r));
  const runs = [];
  for (let a = 0; a < ZONES.length; a++) for (let b = a + 1; b < ZONES.length; b++) {
    const za = ZONES[a], zb = ZONES[b], L = [];
    if (za.x1 === zb.x0 || za.x0 === zb.x1) {   // 東西相鄰：共用一條大道
      const i = za.x1 === zb.x0 ? za.ni1 : za.ni0;
      for (let z = stZ(Math.max(za.nj0, zb.nj0)) - 40; z <= stZ(Math.min(za.nj1, zb.nj1)) + 40; z += 5) { const p = toW(avX(i), z, za), [, lz] = toL(p[0], p[1], zb); L.push([p, toW(avX(i), lz, zb)]); }
    } else if (za.z1 === zb.z0 || za.z0 === zb.z1) {   // 南北相鄰：共用一條街
      const j = za.z1 === zb.z0 ? za.nj1 : za.nj0;
      for (let x = avX(Math.max(za.ni0, zb.ni0)) - 40; x <= avX(Math.min(za.ni1, zb.ni1)) + 40; x += 5) { const p = toW(x, stZ(j), za), [lx] = toL(p[0], p[1], zb); L.push([p, toW(lx, stZ(j), zb)]); }
    } else continue;
    let cur = null;
    for (const [p, q] of L) {
      const x = (p[0] + q[0]) / 2, z = (p[1] + q[1]) / 2, w = Math.hypot(p[0] - q[0], p[1] - q[1]) - 2 * HR;   // w：草地寬
      const ok = w >= 12 && inCity(x, z) && polyDistPt(CITY_POLY, x, z) > 8 && !zoneNearL(x, z, HR + 2.5) && !nearConn(x, z, HR + 2) && !brokenNear(x, z, 6) && !isleFillNear(x, z, 4);   // 天樞島的填空樓（11-isle.js）
      if (!ok) { if (cur && cur.length > 3) runs.push(cur); cur = null; continue; }
      (cur ||= []).push({ x, z, w });
    }
    if (cur && cur.length > 3) runs.push(cur);
  }
  SEAM_PATH.push(...runs);
  // 建物：每一段步道，草地 40 m 以上寬、離上一個建物 140 m 以上，就在中點擺一個（離步道 4 m 起，兩側交錯）
  const KINDS = ['pavilion', 'kiosk', 'restroom'];
  let n = 0;
  for (const run of runs) {
    const i = run.length >> 1, p = run[i], q = run[i + 1];
    if (run.length < 5 || p.w < 40 || SEAM_SITES.some(o => Math.hypot(p.x - o.x, p.z - o.z) < 140)) continue;
    const ux = q.x - p.x, uz = q.z - p.z, l = Math.hypot(ux, uz) || 1, s = n % 2 ? 1 : -1, nx = -uz / l * s, nz = ux / l * s;
    const type = KINDS[n % 3], R = type === 'pavilion' ? 4.2 : type === 'kiosk' ? 3 : 3.6;
    const x = p.x + nx * (1.2 + 4 + R), z = p.z + nz * (1.2 + 4 + R);
    if (!inCity(x, z) || zoneNearL(x, z, HR + R + 2) || nearConn(x, z, HR + R + 3) || isleFillNear(x, z, R + 2)) continue;
    SEAM_SITES.push({ type, x, z, R, ry: Math.atan2(-nx, -nz), ux: ux / l, uz: uz / l }); n++;   // ry：正面朝步道
  }
}
const seamClear = (x, z, r) => !SEAM_PATH.some(run => run.some(p => (p.x - x) ** 2 + (p.z - z) ** 2 < r * r)) && !SEAM_SITES.some(s => (s.x - x) ** 2 + (s.z - z) ** 2 < (s.R + r) ** 2);
// 片之間與片外圍到外緣的草地：稀疏的樹，世界座標；避開片的路（zoneNearL）、連接道路、外緣邊上、斷橋與連接道路的路燈
{
  const r5 = rng(7171), conn = RN.edges.filter(e => e.kind === 'c' || e.kind === 'f'), { x0, x1, z0, z1 } = CITY_BB;
  for (let x = x0; x < x1; x += 11) for (let z = z0; z < z1; z += 11) {
    const tx = x + (r5() - .5) * 7, tz = z + (r5() - .5) * 7, s = .9 + r5() * .5, ry = r5() * 6.3;
    if (r5() > .55 || !inCity(tx, tz) || zoneNearL(tx, tz, HR + 4) || polyDistPt(CITY_POLY, tx, tz) < 7 || brokenNear(tx, tz, 6) || !seamClear(tx, tz, 3.5) || isleFillNear(tx, tz, 4)) continue;
    if (conn.some(e => e.pts.some(([px, pz]) => (px - tx) ** 2 + (pz - tz) ** 2 < 144)) || lampsC.some(l => (l.x - tx) ** 2 + (l.z - tz) ** 2 < 9)) continue;
    trees.push({ x: tx, z: tz, y: 0, ry, s, park: 1, zn: null }); circles.push({ x: tx, z: tz, r: TREE_COL, w: 1 });
  }
}
// 岬角（10-city.js 的 CAPES）：草地上一叢一叢的樹，世界座標
{
  const r6 = rng(8282);
  for (const h of CAPES) {
    const [x0, x1, z0, z1] = h.bb;
    for (let x = x0; x < x1; x += 9) for (let z = z0; z < z1; z += 9) {
      const tx = x + (r6() - .5) * 6, tz = z + (r6() - .5) * 6, s = .85 + r6() * .55, ry = r6() * 6.3;
      if (r6() > .5 || !inPoly(h.inn, tx, tz)) continue;
      trees.push({ x: tx, z: tz, y: 0, ry, s, park: 1, zn: null }); circles.push({ x: tx, z: tz, r: TREE_COL, w: 1 });
    }
  }
}
for (const t of trees) if (!t.park) grates.push(t.grate = { x: t.x, z: t.z, y: .155 });   // walk：人行道的行道樹（t.col／t.grate 給 27-bldfoot 的 bldTrees 一起拿掉）
// World 第四輪之二：只有換成模型時才擺的東西（人行道的報紙箱、燈籠公園步道旁的長椅與草地上的野餐桌、樹下的灌木）。
// 用自己的亂數（不動 rnd() 的序列）；兩種開啟方式都先 claim，之後的設施擺放一樣；碰撞等模型下載好才加（27-props.js 檔尾）
const newsBoxes = [], parkSeats = [], shrubs = [];
{
  const r = rng(2602);
  for (const s of sideSpots) if (r() < .045 && free(s.x, s.z, .6)) { newsBoxes.push({ ...s, y: .15 }); claim(s.x, s.z, .6); }
  for (const b of blocks) {
    if (b.outer || !b.park) continue;
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    // 長椅：十字步道兩側、兩盞燈籠中間，面向步道（模型正面朝 +z）
    for (const [ax, a0, a1] of [['x', b.x0 + SW + 2, b.x1 - SW - 2], ['z', b.z0 + SW + 2, b.z1 - SW - 2]]) {
      let k = 0;
      for (let a = a0 + 6.5; a < a1 - 4; a += 9, k++) {
        if (Math.abs(a - (ax === 'x' ? cx : cz)) < 6 || r() < .35) continue;
        const side = k % 2 ? -1 : 1, x = ax === 'x' ? a : cx + side * 2.9, z = ax === 'x' ? cz + side * 2.9 : a;
        if (!free(x, z, 1.1)) continue;
        parkSeats.push({ kind: 'bench', x, z, y: .15, ry: ax === 'x' ? (side > 0 ? Math.PI : 0) : (side > 0 ? -Math.PI / 2 : Math.PI / 2), ax }); claim(x, z, 1.1);
      }
    }
    // 野餐桌：草地上找空位，每座公園最多四張
    for (let n = 0, tries = 0; n < 4 && tries < 40; tries++) {
      const x = lerp(b.x0 + SW + 5, b.x1 - SW - 5, r()), z = lerp(b.z0 + SW + 5, b.z1 - SW - 5, r());
      if (Math.abs(x - cx) < 4.5 || Math.abs(z - cz) < 4.5 || !free(x, z, 2)) continue;
      parkSeats.push({ kind: 'picnic', x, z, y: .15, ry: Math.floor(r() * 4) * Math.PI / 2 }); claim(x, z, 2); n++;
    }
  }
  // 公園、縫與岬角的樹下：兩三株玉簪或蕨（裝飾，沒有碰撞）
  for (const t of trees) {
    if (!t.park || r() > .5) continue;
    for (let n = 2 + Math.floor(r() * 2); n > 0; n--) {
      const a = r() * 6.3, d = 1 + r() * 1.4;
      shrubs.push({ x: t.x + Math.cos(a) * d, z: t.z + Math.sin(a) * d, y: t.y || 0, ry: r() * 6.3, s: .8 + r() * .6, zn: t.zn, kind: Math.floor(r() * 3) });
    }
  }
}
// street.glb 的配電箱（同樣只有模型版才擺）：沿路緣、長邊順著街；另一個亂數，上面那段的序列不變
const eboxes = [];
{
  const r = rng(2604);
  for (const s of sideSpots) if (r() < .022 && free(s.x, s.z, 1.3)) { eboxes.push({ ...s, y: .15 }); claim(s.x, s.z, 1.3); }
}
// World 第四輪之二（27-props.js 檔尾）：以 http(s) 開啟時把下面幾種換成 Sketchfab 模型，所以留住程式建模的網格（下載好才拿掉）
const hydrantMesh = instanced(new Kit()
  .cyl(0, .3, 0, .13, .15, .6, 10, 0xb81e14, 10).cyl(0, .65, 0, .15, .1, .14, 10, 0xb81e14, 10)
  .cyl(0, .4, 0, .05, .05, .42, 6, 0x9a9a9a, 3, 0, 0, Math.PI / 2).build(), MAT.uber, hydrants, LY.NOREFL);
const binMesh = instanced(new Kit()
  .cyl(0, .48, 0, .3, .26, .96, 12, 0x2f3a33, 15).cyl(0, .98, 0, .32, .32, .06, 12, 0x232a26, 15).build(), MAT.uber, bins, LY.NOREFL);
// 電訊箱（69-market.js 射擊、撞爛）：執行時用世界座標，和換過的碰撞圓柱同一個算法，69-market 才比對得到
worldHooks.push(() => { for (const b of boxesN) { [b.x, b.z] = toW(b.x, b.z); } });
// 藍色電訊箱（照路邊的電信交接箱）：水泥基座、霧面粉體烤漆的機身與出簷的頂蓋、正面的門（門縫、把手與鎖）、兩側的百葉、警告貼紙與編號牌。69-market.js 打爛時把該格縮成 0
const boxesMesh = instanced((() => {
  const e = new Kit(), bl = 0x2c4c6e, dk = 0x1b2f45;
  e.box(0, .08, 0, .58, .16, .52, 0x7a776f, 20).box(0, .66, 0, .5, 1, .45, bl, 34).box(0, 1.18, 0, .56, .05, .51, bl, 34).box(0, 1.215, 0, .5, .02, .45, dk, 34);
  e.box(0, .66, -.2255, .44, .92, .002, dk, 34).box(0, .66, -.228, .425, .905, .004, bl, 34);   // 門縫與門板
  e.box(.16, .7, -.236, .025, .13, .018, 0xa8acb0, 35).cyl(.16, .58, -.232, .016, .016, .012, 10, 0x8a8e92, 35, Math.PI / 2);   // 把手、鎖
  for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) e.box(sx * .2515, .98 - i * .035, 0, .006, .012, .3, dk, 34);   // 百葉
  e.box(0, .98, -.231, .11, .1, .002, 0xe2b81c, 11).box(0, .98, -.2315, .02, .05, .002, 0x161616, 2).box(0, .4, -.231, .17, .07, .002, 0xe6e4dc, 2);   // 警告貼紙、編號牌
  return e.build();
})(), MAT.ux, boxesN, LY.NOREFL);
// 69-v5-street.js 以 http(s) 開啟時換成 v5works.glb 的電訊箱（照邏輯座標的 boxesL 擺）；69-market.js 打爛時每一串都要縮
const boxesMs = [boxesMesh], boxesL = boxesN.map(b => ({ ...b }));
// 路口護柱（照鑄鐵街柱）：底座的圓盤、微收的柱身、兩道凸環、黃色反光帶、半球頂
instanced(new Kit().lathe(0, 0, 0, [[.14, 0], [.14, .05], [.11, .09], [.1, .14], [.095, .66], [.11, .68], [.11, .72], [.095, .74], [.095, .82], [.105, .84], [.1, .87], [.07, .93], [.03, .955], [0, .96]], 12, 0x34383d, TX.iron)
  .cyl(0, .78, 0, .1, .1, .07, 12, 0xd8a020, 10).build(), MAT.ux, bollards, LY.NOREFL);
// 電話亭（照街邊的玻璃電話亭）：基座、四角柱、頂蓋與四面的燈箱、兩側與背面下段的踢腳板、兩側玻璃與腰帶、背板上的公用電話（不鏽鋼機身、螢幕、
// 投幣口、按鍵、話筒與鎧裝電話線）、置物板；正面（−z）開口
const boothMesh = instanced((() => {
  const b = new Kit(), pc = 0x2a2e33, gl = 0x9fb2b6;
  b.box(0, .05, 0, .96, .1, .96, 0x1a1c1e, 34);
  for (const x of [-.44, .44]) for (const z of [-.44, .44]) b.box(x, 1.2, z, .06, 2.2, .06, pc, 34);
  b.box(0, 2.34, 0, 1.04, .08, 1.04, pc, 34).box(0, 2.39, 0, .9, .03, .9, 0x1a1c1e, 34);
  for (const [x, z, sx, sz] of [[0, -.47, .84, .02], [0, .47, .84, .02], [-.47, 0, .02, .84], [.47, 0, .02, .84]]) b.box(x, 2.2, z, sx, .17, sz, 0xf4ead2, 11);   // 燈箱
  for (const [x, z, sx, sz] of [[-.44, 0, .03, .82], [.44, 0, .03, .82], [0, .44, .82, .03]]) b.box(x, .32, z, sx, .44, sz, pc, 34);   // 踢腳板
  for (const x of [-.44, .44]) b.box(x, 1.38, 0, .015, 1.68, .82, gl, 1).box(x, .99, 0, .035, .04, .82, pc, 34);   // 側面玻璃、腰帶
  b.box(0, 1.38, .44, .82, 1.68, .03, 0x3a3f44, 34);   // 背板
  b.rbox(0, 1.42, .39, .34, .56, .09, .025, 0x9a9ea2, 35).box(0, 1.6, .343, .2, .06, .004, 0x2e4636, 11).box(.1, 1.48, .343, .05, .012, .004, 0x111111, 2);   // 機身、螢幕、投幣口
  for (let i = 0; i < 12; i++) b.box(-.035 + (i % 3) * .035, 1.43 - Math.floor(i / 3) * .033, .342, .026, .024, .006, 0xc8ccd0, 35);   // 按鍵
  b.rbox(-.125, 1.43, .338, .055, .24, .05, .02, 0x141414, 2).rod(-.125, 1.3, .34, -.08, 1.16, .35, .008, 5, 0x8a8e92, 35);   // 話筒、電話線
  b.box(0, 1.03, .35, .42, .025, .16, 0x3a3f44, 34);   // 置物板
  return b.build();
})(), MAT.ux, booths);
// 樹穴鐵蓋（照常見的鑄鐵樹穴格柵）：方框、圍著樹幹的圓環、放射狀的格條
{
  const k = new Kit(), iron = 0x1c1b18;
  k.box(0, -.004, 0, 1.3, .012, 1.3, 0x0c0b09, 2);
  for (const [x, z, w, d] of [[0, -.62, 1.3, .06], [0, .62, 1.3, .06], [-.62, 0, .06, 1.3], [.62, 0, .06, 1.3]]) k.box(x, .004, z, w, .02, d, iron, TX.iron);
  k.torus(0, .004, 0, .3, .022, 16, iron, TX.iron).torus(0, .004, 0, .46, .015, 16, iron, TX.iron);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r1 = .6 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))); k.bar(Math.cos(a) * .32, .004, Math.sin(a) * .32, Math.cos(a) * r1, .004, Math.sin(a) * r1, .025, .016, iron, TX.iron); }
  instanced(k.build(), MAT.ux, grates, LY.NOREFL, null, 120);   // 貼地的格柵：遠處看不出來
}
let treeMesh;
{ // 行道樹（檔案模式；http 換 nat_trees 的楓樹）：樹幹分出幾根枝，末端各一團變形的葉團。葉團用圓滑的法線再加一點雜訊（葉子的碎亮），
  // 不再算平面法線（一面一面的多面體像玩具）；頂點色上亮下暗、外亮內暗（樹冠的自遮蔽），每團的綠帶一點不同
  const k = new Kit(); const r2 = rng(5);
  k.cyl(0, 2.1, 0, .1, .17, 4.2, 8, 0x3a2c20, 2);
  const c0 = k.pos.length / 3, hh = (x, y, z) => { const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5; return v - Math.floor(v); };
  for (let i = 0; i < 9; i++) {
    const g = new T.IcosahedronGeometry(1 + r2() * .45, 2);   // 細分 2 級：近看輪廓不是大三角面（行道樹是串流的，只畫相機附近）
    const p = g.attributes.position, nr = g.attributes.normal;
    const ph = r2() * 10;
    for (let v = 0; v < p.count; v++) {
      const x = p.getX(v), y = p.getY(v), z = p.getZ(v), L = Math.hypot(x, y, z), s = .86 + .2 * Math.sin(x * 4.1 + y * 2.3 + ph) * Math.cos(z * 3.7 - y * 1.9 + ph) + .07 * Math.sin(x * 11.3 - z * 9.1 + ph) * Math.sin(y * 10.7 + ph);
      p.setXYZ(v, x * s, y * s * .8, z * s);
      const j = .14, nx = x / L + (hh(x, y, z) - .5) * j, ny = y / L / .8 + (hh(y, z, x) - .5) * j, nz = z / L + (hh(z, x, y) - .5) * j, m = Math.hypot(nx, ny, nz);
      nr.setXYZ(v, nx / m, ny / m, nz / m);
    }
    const a = i / 8 * 6.28 + r2(), rr = i === 0 ? 0 : i < 5 ? 1.05 + r2() * .4 : 1.6 + r2() * .4, y = i === 0 ? 6.3 : i < 5 ? 5.6 + r2() * .9 : 4.8 + r2() * .8;
    const col = new T.Color().setHSL(.22 + r2() * .06, .36, .15 + r2() * .05);
    k.add(g, col, 2, tf(Math.cos(a) * rr, y, Math.sin(a) * rr));
    if (i) k.rod(0, 3.6 + r2() * .5, 0, Math.cos(a) * rr * .8, y - .5, Math.sin(a) * rr * .8, .07, 5, 0x3a2c20, 2, .03);   // 枝
  }
  for (let v = c0; v < k.pos.length / 3; v++) {
    if (k.mat[v] !== 2 || k.col[v * 3 + 1] < k.col[v * 3]) continue;   // 只調葉團（枝是棕色）
    const x = k.pos[v * 3], y = k.pos[v * 3 + 1], z = k.pos[v * 3 + 2];
    const up = Math.min(1, Math.max(0, (y - 4) / 3.4)), out = Math.min(1, Math.hypot(x, z) / 2.6), f = .5 + .45 * up + .25 * out;
    for (let c = 0; c < 3; c++) k.col[v * 3 + c] *= f;
  }
  treeMesh = instanced(k.build(), MAT.uber, trees);
}
// 廣場的噴水池：石砌圓池、深色水面、中間兩層的盤與水柱（水柱是淡藍的自發光），池邊一圈低矮的燈
// 廣場噴水池（照歐式兩層盤噴泉）：石砌池壁與圓弧壓頂、池底與水面、八盞池底燈、雕花的柱座、兩層有唇口的水盤、從盤緣落下的水簾、頂上的噴泉與水花
{
  const k = new Kit(), st = 0x6e6a62, st2 = 0x8a8478, water = 0x9fd8ff;
  k.lathe(0, 0, 0, [[3.3, 0], [3.3, .42], [3.38, .46], [3.38, .54], [3.3, .6], [3.15, .62], [3.0, .58], [2.95, .5], [2.95, .1], [0, .1]], 36, st, TX.stone);
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; k.box(Math.cos(a) * 3.32, .25, Math.sin(a) * 3.32, .02, .3, .3, 0x5a5650, TX.stone, 0, -a); }   // 石塊縫
  k.cyl(0, .4, 0, 2.95, 2.95, .02, 36, 0x0e2230, 1);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; k.cyl(Math.cos(a) * 2.6, .3, Math.sin(a) * 2.6, .08, .1, .05, 8, 0xbfe8ff, 11); }
  k.lathe(0, 0, 0, [[.7, .1], [.7, .3], [.55, .38], [.42, .5], [.36, .9], [.42, 1.1], [.3, 1.3], [.26, 1.5], [.0, 1.5]], 16, st, TX.stone);
  k.lathe(0, 0, 0, [[.26, 1.42], [.6, 1.48], [1.2, 1.62], [1.45, 1.74], [1.5, 1.82], [1.42, 1.86], [1.3, 1.8], [.0, 1.78]], 24, st2, TX.stone);
  k.cyl(0, 1.79, 0, 1.38, 1.38, .02, 24, 0x2a5a70, 1);
  k.lathe(0, 0, 0, [[.0, 1.8], [.24, 1.8], [.2, 2.1], [.16, 2.4], [.22, 2.6], [.16, 2.7], [.0, 2.7]], 12, st, TX.stone);
  k.lathe(0, 0, 0, [[.16, 2.66], [.4, 2.72], [.72, 2.86], [.78, 2.92], [.72, 2.96], [.0, 2.94]], 16, st2, TX.stone);
  k.lathe(0, 0, 0, [[.0, 2.94], [.08, 2.94], [.06, 3.2], [.1, 3.3], [.0, 3.38]], 8, st, TX.stone);
  k.add(new T.CylinderGeometry(1.52, 1.62, 1.3, 24, 1, true), lin(water), 11, tf(0, 1.18, 0));   // 下層盤的水簾
  k.add(new T.CylinderGeometry(.8, .88, .9, 16, 1, true), lin(water), 11, tf(0, 2.5, 0));
  k.lathe(0, 0, 0, [[.02, 3.3], [.05, 3.7], [.08, 4.1], [.18, 4.4], [.32, 4.35], [.5, 4.0], [.62, 3.6], [.0, 3.6]], 12, water, 11);
  instanced(k.build(), MAT.ux, fountains.map(f => ({ ...f, y: .15 })), LY.NOREFL);
}

// ─── 窗型冷氣、逃生梯、水塔、屋頂設備 ───
const acs = [], escapes = [], towers = [], roofBits = [];
const rndG = rnd;
function facePoint(L, k, along, y, out) {
  // 依 boxFaces 的 u 方向，把面上的 (u, y) 轉成世界座標，並往外推 out 公尺
  if (k === 'pz') return { x: L.x0 + along, y, z: L.z1 + out, ry: 0 };
  if (k === 'nz') return { x: L.x1 - along, y, z: L.z0 - out, ry: Math.PI };
  if (k === 'px') return { x: L.x1 + out, y, z: L.z1 - along, ry: Math.PI / 2 };
  return { x: L.x0 - out, y, z: L.z0 + along, ry: -Math.PI / 2 };
}
for (const L of winSpots) {
  // 自己有亂數的地塊（L.rng）用自己的；ghost 是改成廣場的街區原本的地塊（10-city.js），只抽亂數不放東西
  const rnd = L.rng || rndG, G = L.ghost ? { push() {} } : null;
  const k = L.axis === 'z' ? (L.face > 0 ? 'pz' : 'nz') : (L.face > 0 ? 'px' : 'nx');
  const fw = k === 'pz' || k === 'nz' ? L.x1 - L.x0 : L.z1 - L.z0;
  const ws = L.style === 2 ? 2.2 : 2.5, fh = L.fh, gH = 4.6;
  const nF = Math.floor((L.h - gH - .7) / fh);
  const cols = Math.max(1, Math.floor((fw - 1) / ws)), mg = (fw - cols * ws) / 2;
  let escCol = -1;
  if (cols >= 3 && rnd() < .45 && L.style !== 2) escCol = 1 + Math.floor(rnd() * (cols - 2));
  // 凸窗（09-mass.js）裡的窗不掛冷氣；逃生梯碰到凸窗就不擺（亂數照抽）
  for (let fi = 0; fi < nF; fi++) for (let ci = 0; ci < cols; ci++) {
    if (escCol >= 0 && (ci === escCol || ci === escCol - 1)) continue;
    if (rnd() < .14 && !facBayAt(L, ci, fi)) (G || acs).push(facePoint(L, k, mg + (ci + .5) * ws, gH + fi * fh + .18 * fh + .02, .22));
  }
  if (escCol >= 0 && L.mass && L.mass.bays.some(b => b.c1 >= escCol - 1 && b.c0 <= escCol)) escCol = -1;
  if (escCol >= 0) for (let fi = 0; fi < nF; fi++) (G || escapes).push(facePoint(L, k, mg + escCol * ws, gH + fi * fh + .18 * fh - .1, .62));
  const RG = roofKind(L) || L.crown ? { push() {} } : null;   // 斜屋頂（19-roofs.js）與天樞島的塔冠（20-isle.js）上不擺水塔與空調箱，亂數照抽
  // 天樞島的退台塔擺在最上一層（往裡退 ti、頂高 ty）；廠房樓 80 m 以下都可能有水塔
  const tp = L.tiers && L.tiers.length ? L.tiers.at(-1) : null, ti = tp ? tp.i : 0, ty = tp ? tp.y : L.h;
  if ((L.isle ? ty < 80 : L.h < 32) && rnd() < .28) (G || RG || towers).push({ x: lerp(L.x0 + ti, L.x1 - ti, .3 + rnd() * .4), y: ty, z: lerp(L.z0 + ti, L.z1 - ti, .3 + rnd() * .4), ry: rnd() * 6, s: .8 + rnd() * .4 });
  for (let n = 0; n < 2; n++) if (rnd() < .5) (G || RG || roofBits).push({ x: lerp(L.x0 + ti, L.x1 - ti, .15 + rnd() * .7), y: ty, z: lerp(L.z0 + ti, L.z1 - ti, .15 + rnd() * .7), ry: Math.floor(rnd() * 4) * Math.PI / 2, s: .7 + rnd() * .6 });
}
// 天樞島的填空樓（11-isle.js，世界座標的四邊形）：木水塔（磚石樓、75 m 以下）與空調箱，避開屋頂中間的樓梯間（20-isle.js）
{
  const r = rng(2610);
  for (const f of ISLE_FILL) {
    const P = f.tiers.length ? f.tiers.at(-1).P : f.P, y = f.htop, at = (s, t) => [lerp(lerp(P[0][0], P[1][0], s), lerp(P[3][0], P[2][0], s), t), lerp(lerp(P[0][1], P[1][1], s), lerp(P[3][1], P[2][1], s), t)];
    const ry = Math.atan2(-(P[1][1] - P[0][1]), P[1][0] - P[0][0]), side = () => r() < .5 ? .14 + r() * .2 : .66 + r() * .2;
    if (f.style !== 3 && y < 75 && r() < .55) { const [x, z] = at(side(), .3 + r() * .4); towers.push({ x, y, z, ry: r() * 6, s: .8 + r() * .4, zn: null }); }
    for (let n = 0; n < 2; n++) if (r() < .6) { const [x, z] = at(side(), .2 + r() * .6); roofBits.push({ x, y, z, ry: ry + Math.floor(r() * 4) * Math.PI / 2, s: .7 + r() * .6, zn: null }); }
  }
}
// 窗型冷氣（照公寓外牆上的窗機）：機身、前面板的出風百葉與進風格柵、右側的操作面板、兩側散熱百葉、下面的三角托架。局部 +z 朝外，牆在 z ≈ -0.22
{
  const k = new Kit(), shell = 0xc9c4b6, grey = 0x8e8a80;
  k.box(0, .22, .02, .66, .42, .5, shell, TX.sheet).box(0, .22, .272, .62, .38, .012, 0xb2ad9f, TX.sheet);
  for (let i = 0; i < 3; i++) k.box(-.07, .34 - i * .035, .285, .44, .008, .03, grey, TX.sheet, -.5);   // 出風百葉
  for (let i = 0; i < 5; i++) k.box(-.07, .2 - i * .03, .28, .44, .012, .006, 0x4a4842, 2);       // 進風格柵
  k.box(.22, .22, .28, .12, .3, .006, 0x5a5850, TX.rubber).box(.22, .3, .284, .06, .03, .004, 0x2a2c30, 2);
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) k.box(s * .333, .3 - i * .1, .05, .006, .03, .3, grey, TX.sheet);
  for (const s of [-1, 1]) k.bar(s * .26, -.16, -.22, s * .26, -.005, .2, .025, .025, 0x2a2a2a, TX.iron);
  k.box(0, -.01, -.01, .62, .025, .03, 0x2a2a2a, TX.iron);
  instanced(k.build(), MAT.ux, acs, 0, null, 150);   // 小東西：150 m 外只剩幾個像素，不送
}
// 逃生梯（照紐約與波特蘭的老公寓）：每層一座平台（角鋼框、格柵踏板、外緣與兩端的欄杆與直欄、下面的斜撐），往上一層的斜梯（兩根側板、踏階、扶手）。
// 局部 +z 朝外，牆在 z ≈ -0.62；斜梯爬 3.1 m（一層樓高），style 3 的高樓層差 0.6 m，照舊用同一座
{
  const k = new Kit(), iron = 0x1c1d20, W = 5.2, D = 1.15, z0 = -D / 2, z1 = D / 2;
  k.box(0, -.03, 0, W, .03, D, 0x141517, TX.iron);   // 踏板
  for (let x = -W / 2 + .2; x < W / 2; x += .2) k.box(x, .0, 0, .02, .02, D - .04, 0x2a2b2e, TX.iron);   // 格柵
  for (const z of [z0, z1]) k.box(0, -.04, z, W, .07, .04, iron, TX.iron);
  for (const x of [-W / 2, W / 2]) k.box(x, -.04, 0, .04, .07, D, iron, TX.iron);
  k.box(0, 1.0, z1, W + .04, .04, .04, iron, TX.iron).box(0, .5, z1, W, .025, .025, iron, TX.iron);   // 外緣扶手與中欄
  for (let x = -W / 2; x <= W / 2 + .01; x += .2) k.box(x, .5, z1, .018, 1, .018, iron, TX.iron);
  for (const x of [-W / 2, W / 2]) {
    k.box(x, 1.0, 0, .04, .04, D, iron, TX.iron).box(x, .5, 0, .025, .025, D, iron, TX.iron);
    for (let z = z0 + .2; z < z1; z += .2) k.box(x, .5, z, .018, 1, .018, iron, TX.iron);
  }
  for (const x of [-2.1, -.7, .7, 2.1]) k.bar(x, -1.0, z0 - .03, x, -.06, z1 - .08, .035, .035, iron, TX.iron);   // 斜撐
  // 斜梯：靠牆那半邊，從 x = -0.85 爬到 2.45
  const sx0 = -.85, sx1 = 2.45, H = 3.1, sz0 = -.15, sz1 = .45;
  for (const z of [sz0, sz1]) k.bar(sx0, 0, z, sx1, H, z, .025, .18, iron, TX.iron);
  for (let i = 1; i < 12; i++) { const t = i / 12; k.box(lerp(sx0, sx1, t), H * t - .04, (sz0 + sz1) / 2, .22, .025, sz1 - sz0, 0x2a2b2e, TX.iron); }
  k.bar(sx0, .95, sz1 + .03, sx1, H + .95, sz1 + .03, .03, .03, iron, TX.iron);
  for (const t of [.25, .5, .75]) k.box(lerp(sx0, sx1, t), H * t + .48, sz1 + .03, .02, .95, .02, iron, TX.iron);
  instanced(k.build(), MAT.ux, escapes.map(e => ({ ...e, x: e.x + Math.cos(e.ry) * 1.25, z: e.z - Math.sin(e.ry) * 1.25 })), 0, null, 240);
}
// 屋頂木水塔（照曼哈頓的木桶水塔）：四腳鋼架與交叉拉桿、鋼梁平台與一圈欄杆、杉木桶身（直條木板分兩色）與鐵箍、錐形頂與頂上的球、檢修爬梯
{
  const k = new Kit(), wood = 0x5a3f2a, wood2 = 0x4a3322, iron = 0x26272a;
  const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [x, z] of legs) k.box(x * 1.1, 1.3, z * 1.1, .12, 2.6, .12, iron, TX.iron).box(x * 1.1, .03, z * 1.1, .3, .06, .3, 0x3a3a3c, TX.sheet);
  for (let i = 0; i < 4; i++) {
    const [ax, az] = legs[i], [bx, bz] = legs[(i + 1) % 4];
    k.rod(ax * 1.1, .3, az * 1.1, bx * 1.1, 2.4, bz * 1.1, .02, 4, iron, TX.iron).rod(bx * 1.1, .3, bz * 1.1, ax * 1.1, 2.4, az * 1.1, .02, 4, iron, TX.iron);
    k.bar(ax * 1.1, 1.3, az * 1.1, bx * 1.1, 1.3, bz * 1.1, .08, .1, iron, TX.iron);
  }
  k.box(0, 2.62, 0, 2.9, .12, 2.9, iron, TX.iron);
  for (const [x, z, w, d] of [[0, -1.42, 2.9, .03], [0, 1.42, 2.9, .03], [-1.42, 0, .03, 2.9], [1.42, 0, .03, 2.9]]) k.box(x, 3.15, z, w, .04, d, iron, TX.iron);
  for (const [x, z] of legs) k.box(x * 1.42, 2.9, z * 1.42, .04, .55, .04, iron, TX.iron);
  for (let i = 0; i < 24; i++) {   // 桶身：24 片木板
    const a = i / 24 * Math.PI * 2;
    k.box(Math.sin(a) * 1.55, 4.3, Math.cos(a) * 1.55, .41, 3.2, .08, i % 3 ? wood : wood2, TX.woodY, 0, a);
  }
  k.cyl(0, 4.3, 0, 1.5, 1.5, 3.18, 12, 0x2a1e14, TX.woodY);
  for (let y = 3; y < 6; y += .55) k.cyl(0, y, 0, 1.62, 1.62, .05, 20, 0x222326, TX.iron);
  k.lathe(0, 0, 0, [[1.72, 5.86], [1.72, 5.92], [.12, 6.9], [.05, 6.98]], 20, 0x3a3a3c, TX.sheet);
  k.add(new T.SphereGeometry(.12, 8, 6), lin(0x3a3a3c), 15, tf(0, 7.05, 0));
  for (const x of [-.22, .22]) k.box(x, 4.45, 1.66, .04, 3.6, .04, iron, TX.iron);   // 爬梯
  for (let y = 2.8; y < 6.2; y += .3) k.box(0, y, 1.66, .44, .025, .025, iron, TX.iron);
  k.box(0, 6.05, 1.35, .6, .04, .5, iron, TX.iron, -.5);   // 頂上的檢修口
  instanced(k.build(), MAT.ux, towers, 0, null, 320);   // 數量不到 160 不會自動串流，但一座一千多面
}
// 屋頂空調箱（rooftop unit）：基座框、機櫃與面板接縫、側面的冷凝器格柵、頂上的風扇護網、排氣罩與瓦斯管
{
  const k = new Kit(), cab = 0xa3a6a8, seam = 0x6a6d70;
  k.box(0, .06, 0, 2.3, .12, 1.5, 0x3a3c3e, TX.iron).box(0, .62, 0, 2.2, 1.0, 1.4, cab, TX.sheet);
  for (const x of [-.55, .2]) k.box(x, .62, .705, .01, .96, .01, seam, TX.sheet);
  k.box(-.85, .65, .705, .05, .08, .02, 0x2a2c2e, TX.iron).box(-.2, .65, .705, .05, .08, .02, 0x2a2c2e, TX.iron);
  k.box(.75, .6, .704, .6, .74, .01, 0x3c3f42, TX.galv);   // 冷凝器格柵
  for (let y = .28; y < .96; y += .06) k.box(.75, y, .712, .6, .012, .012, seam, TX.sheet);
  for (const s of [-1, 1]) { k.box(s * 1.105, .62, 0, .01, .8, 1.1, 0x3c3f42, TX.galv); for (let z = -.5; z < .52; z += .07) k.box(s * 1.11, .62, z, .01, .78, .015, seam, TX.sheet); }
  k.cyl(.45, 1.14, 0, .42, .42, .04, 16, 0x2a2c2e, TX.iron).torus(.45, 1.17, 0, .42, .02, 16, seam, TX.galv);
  for (let a = 0; a < 4; a++) k.box(.45, 1.17, 0, .82, .015, .015, seam, TX.galv, 0, a * Math.PI / 4);
  k.box(-.7, 1.2, 0, .5, .16, .6, cab, TX.sheet).box(-.7, .9, -.75, .5, .4, .14, 0x8a8d90, TX.sheet, .4);   // 排氣罩
  k.rod(-1.05, .2, -.6, -1.05, .45, -.6, .025, 6, 0xd8b020, TX.iron).rod(-1.05, .45, -.6, -1.4, .45, -.6, .025, 6, 0xd8b020, TX.iron);
  instanced(k.build(), MAT.ux, roofBits, 0, null, 260);
}

// 施工區：Atlas Av 靠 8 St 的一段車道
const works = [];
{
  const x = avX(1) + 6.3, zc = stZ(2) + 30;
  for (let k = 0; k < 6; k++) works.push({ t: 'drum', x: x + (k % 2) * .6 - .3, z: zc - 9 + k * 3.2 });
  for (let k = 0; k < 7; k++) works.push({ t: 'cone', x: x - 1.5 + (k % 2) * .25, z: zc - 14 + k * 1.6 });
  works.push({ t: 'jersey', x: x + 1.05, z: zc - 2, ry: 0 }, { t: 'jersey', x: x + 1.05, z: zc + 2.1, ry: 0 });
  for (const w of works) if (w.t !== 'jersey') circles.push({ x: w.x, z: w.z, r: .35 });   // 紐澤西護欄的畫面與碰撞在 69-v5-street.js（會被推、會鏟起車）
}
// 飛車特技跳台（69-stunt.js）：放在路口前的停車道上，順著車流方向朝路口飛過去；(x, z) 是跳台邊緣，yaw 是車頭方向。
// 30-vehicles.js 擺路邊車時用 rampBlock() 讓開跳台與落地區
const RAMP_L = 10, RAMP_H = 1.5, RAMP_W = 3.2, RAMP_IN = 1;
const RAMPS = [
  { x: avX(2) - PARK, z: stZ(1) - HR - 1, yaw: 0 },
  { x: avX(4) - PARK, z: stZ(3) - HR - 1, yaw: 0 },
  { x: avX(5) - PARK, z: stZ(2) - HR - 1, yaw: 0 },
  { x: avX(0) + PARK, z: stZ(3) + HR + 1, yaw: Math.PI },
  { x: avX(3) - HR - 1, z: stZ(1) + PARK, yaw: Math.PI / 2 },
  { x: avX(2) + HR + 1, z: stZ(4) - PARK, yaw: -Math.PI / 2 },
  // 第二批（第四階段補齊 20 座）：分散在 8×7 與 20×15 擴充的城區；接在後面，存檔裡完成過的編號不變
  { x: avX(7) - PARK, z: stZ(5) - HR - 1, yaw: 0 },
  { x: avX(10) - PARK, z: stZ(3) - HR - 1, yaw: 0 },
  { x: avX(13) - PARK, z: stZ(6) - HR - 1, yaw: 0 },   // 原本在 stZ(7)：飛過去是光環南與琥珀西之間的縫
  { x: avX(16) - PARK, z: stZ(4) - HR - 1, yaw: 0 },
  { x: avX(18) - PARK, z: stZ(10) - HR - 1, yaw: 0 },
  { x: avX(9) + PARK, z: stZ(9) + HR + 1, yaw: Math.PI },
  { x: avX(12) + PARK, z: stZ(12) + HR + 1, yaw: Math.PI },
  { x: avX(6) + PARK, z: stZ(13) + HR + 1, yaw: Math.PI },   // 原本在 stZ(11)：往北飛會越過珊瑚灘與楓林的縫，兩片的路對不上
  { x: avX(7) - HR - 1, z: stZ(6) + PARK, yaw: Math.PI / 2 },   // 原本在 avX(8)：冠石與光環南之間的縫
  { x: avX(11) - HR - 1, z: stZ(8) + PARK, yaw: Math.PI / 2 },
  { x: avX(15) - HR - 1, z: stZ(2) + PARK, yaw: Math.PI / 2 },
  { x: avX(14) + HR + 1, z: stZ(13) - PARK, yaw: -Math.PI / 2 },
  { x: avX(19) + HR + 1, z: stZ(6) - PARK, yaw: -Math.PI / 2 },
  { x: avX(2) - PARK, z: stZ(9) - HR - 1, yaw: 0 },   // 原本在 avX(4)、往西飛：會越過楓林西與楓林東之間的縫
  // 第五部曲：公園大道立體停車場的頂樓（69-v5-garage.js）往東飛過大道、落進燈籠公園；y0 是頂樓樓板的高度
  ...(FAC.gar ? [{ x: FAC.gar.gar.x1, z: FAC.gar.gar.z0 + 28.5, yaw: Math.PI / 2, y0: FAC.gar.roof }] : []),
].map((r, i) => ({ ...r, i, dx: Math.sin(r.yaw), dz: Math.cos(r.yaw) }));
// 生成時（停車避開跳台）用邏輯座標；cityWorld() 之後 RAMPS 是世界座標（69-stunt.js 每幀判斷車有沒有開上去）。
// 世界座標的方向取助跑道後 20 m 到落地區前 40 m 的弦：彎曲的片裡路是彎的，車直直飛出去不會偏到路邊的燈柱與樹
const RAMPS_W = RAMPS.map(r => {
  const zn = zoneAtL(r.x, r.z), [x, z] = toW(r.x, r.z, zn), [ax, az] = toW(r.x - r.dx * 20, r.z - r.dz * 20, zn), [bx, bz] = toW(r.x + r.dx * 40, r.z + r.dz * 40, zn), yaw = Math.atan2(bx - ax, bz - az);
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  return { x: x + dz * RAMP_IN, z: z - dx * RAMP_IN, yaw, dx, dz, y0: r.y0 || 0 };   // 往路中間（車頭的左手邊）挪 RAMP_IN，離路緣的燈柱、樹遠一點
});
worldHooks.push(() => { RAMPS.forEach((r, k) => Object.assign(r, RAMPS_W[k])); });
const rampBlock = (x, z) => RAMPS.some(r => { if (r.y0) return false; const a = (x - r.x) * r.dx + (z - r.z) * r.dz, b = (x - r.x) * r.dz - (z - r.z) * r.dx; return Math.abs(b) < 3.5 && a > -RAMP_L - 26 && a < 60; });   // 前面留 26 m 助跑，後面 60 m 內不停車（落地後還會往前滑）
// 立體停車場（69-v5-garage.js）入口前的路邊不停車（生成時的邏輯座標）
const garDrive = (x, z) => !!FAC.gar && x > FAC.gar.ax - 1 && x < FAC.gar.ax + 13 && z > FAC.gar.az + 20 && z < FAC.gar.az + 40;
// 跳台的幾何直接用世界座標（RAMPS_W，和車判斷的方向一致），合併成一個網格
{
  // 照活動用的鋼構跳台：花紋鋼板面（橫向防滑條）、兩側黃邊、唇口角鋼與黃黑警示帶、底下兩條側樑、每側四根立柱、柱間斜撐、柱頂橫樑、貼地的底軌
  const k = new Kit(), th = Math.atan2(RAMP_H, RAMP_L), sl = Math.hypot(RAMP_H, RAMP_L), steel = 0x3d4044, W2 = RAMP_W / 2;
  for (const r of RAMPS_W) {
    const cx = r.x - r.dx * RAMP_L / 2, cz = r.z - r.dz * RAMP_L / 2, rx = r.dz, rz = -r.dx, y0 = r.y0;   // y0：停車場頂樓的跳台
    const P = (a, s, y) => [r.x - r.dx * (RAMP_L - a) + rx * s, y0 + y, r.z - r.dz * (RAMP_L - a) + rz * s], top = a => a * RAMP_H / RAMP_L;   // a：從斜坡起點算的水平距離，s：往右
    const B = (p, q, w, h, col = steel, mat = 34) => k.bar(...p, ...q, w, h, col, mat);
    k.box(cx, y0 + RAMP_H / 2 - .06, cz, RAMP_W, .12, sl, 0x55595e, 35, -th, r.yaw);   // 斜板
    for (let a = .5; a < RAMP_L - .3; a += .45) { const [x, y, z] = P(a, 0, top(a) + .012); k.box(x, y, z, RAMP_W - .5, .02, .07, 0x1e1f20, 2, -th, r.yaw); }   // 防滑條
    for (const s of [-1, 1]) k.box(cx + rx * s * (W2 - .08), y0 + RAMP_H / 2 - .02, cz + rz * s * (W2 - .08), .16, .14, sl, 0xd9b42a, 34, -th, r.yaw);   // 兩側黃邊
    k.box(r.x - r.dx * .1, y0 + RAMP_H / 2, r.z - r.dz * .1, RAMP_W, RAMP_H, .2, 0x2a2c2f, 34, 0, r.yaw);   // 邊緣的立板
    B(P(RAMP_L - .02, -W2, RAMP_H + .02), P(RAMP_L - .02, W2, RAMP_H + .02), .1, .06, 0x8a8e92, 35);   // 唇口角鋼
    for (let i = 0; i < 8; i++) { const s0 = -W2 + i * RAMP_W / 8, [x, y, z] = P(RAMP_L + .01, s0 + RAMP_W / 16, RAMP_H - .14); k.box(x, y, z, RAMP_W / 8, .2, .02, i % 2 ? 0x161616 : 0xe0b020, 34, 0, r.yaw); }   // 立板上緣的黃黑警示帶
    const posts = [RAMP_L * .28, RAMP_L * .52, RAMP_L * .76, RAMP_L - .35];
    for (const s of [-(W2 - .15), W2 - .15]) {
      B(P(.2, s, .05), P(RAMP_L - .2, s, .05), .14, .1);   // 底軌
      B(P(.3, s, .06), P(RAMP_L - .2, s, RAMP_H - .2), .1, .18);   // 側樑（斜板底下）
      posts.forEach((a, i) => {
        B(P(a, s, 0), P(a, s, top(a) - .16), .1, .1);   // 立柱
        if (i) B(P(posts[i - 1], s, .12), P(a, s, top(a) - .28), .06, .06);   // 斜撐
      });
    }
    for (const a of posts) B(P(a, -(W2 - .15), top(a) - .2), P(a, W2 - .15, top(a) - .2), .08, .12);   // 柱頂橫樑
  }
  cityAdd(new T.Mesh(k.build(), MAT.ux), null);
}
{
  // 施工桶（照美國的導引桶 channelizer drum）：黑色橡膠底圈、四道橘白反光帶與帶間的凹槽、頂蓋的提把、閃爍警示燈
  const d = new Kit();
  d.cyl(0, .05, 0, .42, .44, .1, 16, 0x1a1a1a, TX.rubber);
  for (let k = 0; k < 4; k++) d.cyl(0, .19 + k * .21, 0, .285 - k * .008, .295 - k * .008, .17, 16, k % 2 ? 0xf2f2ee : 0xff6a10, k % 2 ? 11 : 10);
  for (let k = 0; k < 4; k++) d.cyl(0, .085 + k * .21, 0, .27 - k * .008, .27 - k * .008, .04, 16, 0xe85a08, 10);
  d.lathe(0, 0, 0, [[.26, .92], [.25, .97], [.2, 1.0], [0, 1.01]], 16, 0xe85a08, 10).box(0, 1.03, 0, .3, .05, .06, 0xe85a08, 10);
  d.box(0, 1.08, 0, .04, .1, .04, 0x222222, 2).rbox(0, 1.18, 0, .18, .14, .07, .03, 0x222222, 2).box(0, 1.18, -.037, .13, .09, .01, 0xffb020, 9);
  instanced(d.build(), MAT.uxI, works.filter(w => w.t === 'drum'), 0, (t, c) => c === 1 ? rnd() : 0);
  // 交通錐（照 28 吋的 PVC 錐）：方形黑底座與四角的倒角、圓錐身、上下兩道白色反光環、頂端開口
  const c = new Kit().rbox(0, .02, 0, .42, .42, .04, .06, 0x222222, TX.rubber, Math.PI / 2).cyl(0, .055, 0, .2, .22, .03, 12, 0x2a2a2a, TX.rubber)
    .lathe(0, 0, 0, [[.19, .06], [.15, .3], [.035, .7], [.025, .72], [.02, .7]], 14, 0xff5a0a, 10)
    .cyl(0, .5, 0, .093, .107, .1, 14, 0xf2f2ee, 11).cyl(0, .35, 0, .135, .146, .07, 14, 0xf2f2ee, 11);
  instanced(c.build(), MAT.ux, works.filter(w => w.t === 'cone'), LY.NOREFL);
}

// ─── 招牌圖集：所有字都用 Canvas 畫在一張 2048 的貼圖上 ───
const atlas = document.createElement('canvas'); atlas.width = 2048; atlas.height = 2048;
const ax = atlas.getContext('2d');
ax.fillStyle = '#000'; ax.fillRect(0, 0, 2048, 2048);
const FONT_C = '"Avenir Next Condensed","DIN Condensed","Bahnschrift","Roboto Condensed","Arial Narrow",sans-serif';
const FONT_B = '"Arial Black","Helvetica Neue",Arial,sans-serif';
const FONT_S = '"Snell Roundhand","Segoe Script","Brush Script MT","Apple Chancery",cursive';
const FONT_H = '"PingFang TC","Hiragino Sans","Noto Sans CJK TC","Microsoft JhengHei",sans-serif';
const cells = {};
let shelfX = 0, shelfY = 0, shelfH = 0;
function cell(name, w, h, draw) {
  if (shelfX + w > 2048) { shelfX = 0; shelfY += shelfH + 2; shelfH = 0; }
  const x = shelfX, y = shelfY; shelfX += w + 2; shelfH = Math.max(shelfH, h);
  ax.save(); ax.beginPath(); ax.rect(x, y, w, h); ax.clip(); ax.translate(x, y); draw(ax, w, h); ax.restore();
  cells[name] = { u0: x / 2048, v0: 1 - (y + h) / 2048, u1: (x + w) / 2048, v1: 1 - y / 2048, w, h };
  if (y + h > 2048) console.warn('sign atlas overflow', name);
}
function neon(c, text, x, y, size, col, font = FONT_C, weight = 700, align = 'center') {
  c.font = `${weight} ${size}px ${font}`; c.textAlign = align; c.textBaseline = 'middle';
  c.lineJoin = 'round';
  c.shadowColor = col; c.shadowBlur = size * .35; c.strokeStyle = col; c.lineWidth = size * .11; c.strokeText(text, x, y);
  c.shadowBlur = size * .15; c.lineWidth = size * .05; c.strokeStyle = '#fff'; c.globalAlpha = .85; c.strokeText(text, x, y);
  c.globalAlpha = 1; c.shadowBlur = 0;
}
function plate(c, w, h, bg = '#0b0b0d') { c.fillStyle = bg; c.fillRect(0, 0, w, h); }
function boxSign(c, w, h, bg, fg, text, sub, font = FONT_B) {
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, 0, w, 5); c.fillRect(0, h - 5, w, 5);
  c.fillStyle = fg; c.font = `900 ${h * .5}px ${font}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, w / 2, sub ? h * .42 : h * .53, w * .9);
  if (sub) { c.font = `700 ${h * .2}px ${FONT_C}`; c.fillText(sub, w / 2, h * .8, w * .8); }
}
const FASCIA = [
  ['GROCERY & DELI', c => boxSign(c, 512, 96, ['#ffd23a', '#e8a512'], '#b3141c', 'GROCERY & DELI', '24 HRS · 熟食 · LOTTO'), 0xffc23a],
  ['UNIFORM TAILOR', c => boxSign(c, 512, 96, ['#7d1410', '#4c0b08'], '#f3e6cf', 'UNIFORM TAILOR', 'ALTERATIONS · 修改'), 0xff6040],
  ['VOLTAGE KARAOKE', c => { plate(c, 512, 96); neon(c, 'VOLTAGE KARAOKE', 256, 50, 52, '#ff3fb4'); }, 0xff3fb4],
  ['NOODLE 24', c => { plate(c, 512, 96); neon(c, '麵 NOODLE 24', 256, 50, 54, '#ffcf4a', FONT_H); }, 0xffcf4a],
  ['PAWN', c => boxSign(c, 512, 96, ['#14213d', '#0a1124'], '#ffd86b', 'PAWN · CASH · GOLD'), 0xffd86b],
  ['LAUNDROMAT', c => boxSign(c, 512, 96, ['#e9f3f6', '#b8d5dc'], '#0d5a8a', 'LAUNDROMAT', 'WASH · DRY · FOLD'), 0xbfe6ff],
  ['PHARMACY', c => { plate(c, 512, 96, '#062014'); neon(c, '✚ PHARMACY 藥', 256, 50, 50, '#3dff8e', FONT_H); }, 0x3dff8e],
  ['LIQUOR', c => { plate(c, 512, 96); neon(c, 'LIQUORS', 256, 50, 62, '#ff4b3a', FONT_S, 400); }, 0xff4b3a],
  ['ARCADE', c => { plate(c, 512, 96); neon(c, 'ARCADE 電玩', 256, 50, 56, '#4ee6ff', FONT_H); }, 0x4ee6ff],
  ['TATTOO', c => { plate(c, 512, 96); neon(c, 'Tattoo', 256, 52, 66, '#ff6b2a', FONT_S, 400); }, 0xff6b2a],
  ['RAMEN', c => boxSign(c, 512, 96, ['#c81d25', '#8e1016'], '#fff3dc', '拉麵 RAMEN', 'TONKOTSU · SHOYU', FONT_H), 0xff5a4a],
  ['ELECTRONICS', c => boxSign(c, 512, 96, ['#0e1a2a', '#08101c'], '#5fd2ff', '電器 ELECTRONICS', 'REPAIR · PARTS · 修理', FONT_H), 0x5fd2ff],
  ['HOTEL MIRA', c => { plate(c, 512, 96); neon(c, 'HOTEL MIRA', 256, 50, 56, '#ff9b3a'); }, 0xff9b3a],
  ['DINER', c => { plate(c, 512, 96, '#1a0606'); neon(c, 'DINER', 256, 50, 66, '#ff3a3a', FONT_S, 400); }, 0xff3a3a],
  ['CHECKS CASHED', c => boxSign(c, 512, 96, ['#ffe94a', '#f0c00c'], '#1b1b1b', 'CHECKS CASHED', 'MONEY ORDERS · 匯款'), 0xffe94a],
  ['PIZZA', c => { plate(c, 512, 96); neon(c, 'PIZZA · SLICE $2', 256, 50, 50, '#ffb13a'); }, 0xffb13a],
  ['BARBER', c => boxSign(c, 512, 96, ['#f2efe8', '#cfc9bd'], '#1a2d6b', 'BARBER', 'CUTS · SHAVE'), 0xe8eef8],
  ['OPTICS', c => { plate(c, 512, 96); neon(c, '眼鏡 OPTICS', 256, 50, 52, '#9aa8ff', FONT_H); }, 0x9aa8ff],
  ['CYBERWARE', c => { plate(c, 512, 96, '#05121a'); neon(c, 'CYBERWARE CLINIC', 256, 50, 46, '#2cf2d8'); }, 0x2cf2d8],
  ['DUMPLING', c => boxSign(c, 512, 96, ['#f6e7c8', '#e5cf9e'], '#9a1b12', '餃子 DUMPLING', 'STEAMED · FRIED', FONT_H), 0xffd9a0],
  ['NAIL SPA', c => { plate(c, 512, 96); neon(c, 'Nail Spa', 256, 52, 64, '#ff7ad1', FONT_S, 400); }, 0xff7ad1],
  ['VINYL', c => boxSign(c, 512, 96, ['#221a12', '#120d08'], '#f0b85a', 'BOOKS & VINYL', 'USED · RARE · 唱片'), 0xf0b85a],
  ['BODEGA', c => boxSign(c, 512, 96, ['#0f5c3a', '#0a3d27'], '#fff1c2', 'BODEGA', 'COLD BEER · ATM · 雜貨'), 0x9affc4],
  ['NOODLE BAR', c => { plate(c, 512, 96); neon(c, 'NOODLE BAR', 256, 50, 56, '#7cff6a'); }, 0x7cff6a],
];
FASCIA.forEach(([n, d]) => cell('f:' + n, 510, 96, d));   // 510 寬才能一排放四個
// 每塊招牌的店內是哪一類（10-city.js 的 shopKind：0 層架、1 洗衣店、2 小吃、3 螢幕、4 藥局類），招牌照店面的 kind 挑
const FASCIA_K = { 'LAUNDROMAT': 1, 'NOODLE 24': 2, 'RAMEN': 2, 'DINER': 2, 'PIZZA': 2, 'DUMPLING': 2, 'NOODLE BAR': 2,
  'VOLTAGE KARAOKE': 3, 'ARCADE': 3, 'ELECTRONICS': 3, 'CYBERWARE': 3, 'PHARMACY': 4, 'TATTOO': 4, 'BARBER': 4, 'OPTICS': 4, 'NAIL SPA': 4 };
const FASCIA_BY = [0, 1, 2, 3, 4].map(k => FASCIA.filter(f => (FASCIA_K[f[0]] || 0) === k));
const BLADE = [
  ['HOTEL', '#ff5a3a', FONT_C], ['空室', '#4ee6ff', FONT_H], ['薬', '#3dff8e', FONT_H], ['酒', '#ff3f6a', FONT_H], ['OPEN', '#ff4bd0', FONT_C],
  ['拉麵', '#ffcf4a', FONT_H], ['BAR', '#ffa13a', FONT_C], ['電脳', '#2cf2d8', FONT_H], ['24H', '#ffe94a', FONT_C], ['按摩', '#ff7ad1', FONT_H],
  ['NOVA', '#ffffff', FONT_C], ['質屋', '#9aa8ff', FONT_H],
];
const hexOf = s => parseInt(s.slice(1), 16);
BLADE.forEach(([t, col, f]) => cell('b:' + t, 96, 384, (c, w, h) => {
  plate(c, w, h, '#09090b');
  c.strokeStyle = col; c.globalAlpha = .5; c.lineWidth = 3; c.strokeRect(7, 7, w - 14, h - 14); c.globalAlpha = 1;
  const chars = [...t]; const sz = Math.min(62, (h - 40) / chars.length);
  chars.forEach((ch, k) => neon(c, ch, w / 2, 26 + sz * .55 + k * (h - 52) / chars.length, sz, col, f));
}));
const BILL = [
  ['ORBITAL COLA', (c, w, h) => {
    plate(c, w, h, '#120612');
    c.save(); c.translate(w * .5, h * .34); c.fillStyle = '#ff4a2a'; c.shadowColor = '#ff4a2a'; c.shadowBlur = 24; c.beginPath(); c.arc(0, 0, 44, 0, 7); c.fill();
    c.shadowBlur = 0; c.strokeStyle = '#ffd23a'; c.lineWidth = 7; c.beginPath(); c.ellipse(0, 0, 86, 20, -.25, 0, 7); c.stroke(); c.restore();
    neon(c, 'ORBITAL COLA', w / 2, h * .7, 54, '#ffd23a', FONT_B, 900);
    c.font = `600 22px ${FONT_H}`; c.fillStyle = '#ff9a8a'; c.textAlign = 'center'; c.fillText('オービタル・コーラ · ZERO G FIZZ', w / 2, h * .88);
  }, 0xffa040],
  ['KESTREL', (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#0a0d12'); g.addColorStop(1, '#1b2a36'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#e8eef4'; c.lineWidth = 5; c.beginPath(); c.moveTo(60, 170); c.lineTo(200, 120); c.lineTo(330, 118); c.lineTo(450, 150); c.lineTo(455, 172); c.lineTo(60, 178); c.closePath(); c.stroke();
    c.fillStyle = '#ff2a3a'; c.fillRect(420, 160, 34, 8);
    c.font = `800 40px ${FONT_C}`; c.fillStyle = '#e8eef4'; c.textAlign = 'left'; c.fillText('KESTREL', 40, 64);
    c.font = `500 20px ${FONT_C}`; c.fillStyle = '#8fb2c8'; c.fillText('WEDGE V8 · BUILT FOR THE RAIN', 40, 94);
  }, 0x9fd0ff],
  ['SOMNA', (c, w, h) => {
    plate(c, w, h, '#0c2418');
    c.save(); c.translate(150, 128); c.rotate(-.5); c.fillStyle = '#eaf7ee'; c.beginPath(); c.roundRect(-70, -28, 140, 56, 28); c.fill();
    c.fillStyle = '#38e07a'; c.beginPath(); c.roundRect(0, -28, 70, 56, [0, 28, 28, 0]); c.fill(); c.restore();
    c.font = `800 58px ${FONT_C}`; c.fillStyle = '#eaf7ee'; c.textAlign = 'left'; c.fillText('SOMNA', 260, 120);
    c.font = `600 22px ${FONT_H}`; c.fillStyle = '#38e07a'; c.fillText('一顆睡滿八小時', 262, 160);
  }, 0x5aff9a],
  ['DREAM 8K', (c, w, h) => {
    plate(c, w, h, '#05040c');
    for (let k = 0; k < 9; k++) { c.fillStyle = `hsl(${190 + k * 18},90%,${45 + k * 3}%)`; c.fillRect(0, k * h / 9, w, h / 9 + 1); }
    c.globalAlpha = .6; c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.globalAlpha = 1;
    neon(c, 'DREAM IN 8K', w / 2, h * .45, 64, '#7af0ff', FONT_C, 800);
    c.font = `600 20px ${FONT_C}`; c.fillStyle = '#d8f6ff'; c.textAlign = 'center'; c.fillText('LUCID SLEEP PODS · 9TH ST', w / 2, h * .75);
  }, 0x7af0ff],
  ['HANZO', (c, w, h) => {
    plate(c, w, h, '#160a04');
    c.font = `900 66px ${FONT_B}`; c.fillStyle = '#ff7a1a'; c.textAlign = 'center'; c.fillText('HANZO', w / 2, h * .48);
    c.font = `700 24px ${FONT_H}`; c.fillStyle = '#ffd9b8'; c.fillText('半藏機車 · 雨天也能過彎', w / 2, h * .76);
  }, 0xff8a3a],
  ['KOI', (c, w, h) => {
    plate(c, w, h, '#03080c');
    const fish = (x, y, s, col, flip) => { c.save(); c.translate(x, y); c.scale(flip ? -s : s, s); c.strokeStyle = col; c.shadowColor = col; c.shadowBlur = 14; c.lineWidth = 5;
      c.beginPath(); c.moveTo(-60, 0); c.quadraticCurveTo(-10, -32, 40, -4); c.quadraticCurveTo(-10, 26, -60, 0); c.moveTo(40, -4); c.lineTo(66, -22); c.lineTo(62, 14); c.closePath(); c.stroke(); c.restore(); };
    fish(170, 100, 1.3, '#ff5a8a', false); fish(330, 160, 1.1, '#4ee6ff', true);
    neon(c, '鯉 KOI', w / 2, h * .86, 34, '#ffffff', FONT_H);
  }, 0xff7aa0],
  ['SYNAPSE', (c, w, h) => {
    plate(c, w, h, '#0a0a0a');
    c.strokeStyle = '#d6ff3a'; c.lineWidth = 3; for (let k = 0; k < 7; k++) { c.beginPath(); c.arc(110, 128, 20 + k * 12, -1.2, 1.2); c.stroke(); }
    c.font = `800 52px ${FONT_C}`; c.fillStyle = '#d6ff3a'; c.textAlign = 'left'; c.fillText('SYNAPSE+', 210, 122);
    c.font = `500 20px ${FONT_C}`; c.fillStyle = '#f0f0f0'; c.fillText('THINK FASTER. FEEL LESS.', 212, 158);
  }, 0xd6ff3a],
  ['TOMORROW', (c, w, h) => {
    plate(c, w, h, '#020a10');
    neon(c, 'TOMORROW', w / 2, h * .36, 74, '#9ff6ff', FONT_C, 800);
    neon(c, 'ENGINEERED', w / 2, h * .66, 50, '#9ff6ff', FONT_C, 700);
    c.font = `500 18px ${FONT_H}`; c.fillStyle = '#5fbfd0'; c.textAlign = 'center'; c.fillText('明天，已經設計好了', w / 2, h * .88);
  }, 0x9ff6ff],
];
BILL.forEach(([n, d]) => cell('w:' + n, 512, 256, d));
cell('LAZARUS', 1024, 256, (c, w, h) => { plate(c, w, h, '#050306'); neon(c, 'LAZARUS', w / 2, h * .5, 150, '#ff3fa0', FONT_C, 800); });
cell('AFTERGLOW', 512, 128, (c, w, h) => { plate(c, w, h, '#120804'); neon(c, 'AFTERGLOW', w / 2, h * .42, 64, '#ffa040', FONT_C, 700); c.font = `500 20px ${FONT_H}`; c.fillStyle = '#d99a62'; c.textAlign = 'center'; c.fillText('餘燼 · COCKTAILS · SINCE 2041', w / 2, h * .82); });
cell('CHROME', 512, 128, (c, w, h) => { plate(c, w, h, '#03090c'); neon(c, 'CHROME WORKS', w / 2, h * .42, 58, '#2cf2d8', FONT_C, 700); c.font = `500 20px ${FONT_H}`; c.fillStyle = '#7fc8c0'; c.textAlign = 'center'; c.fillText('電馭改裝 · PAINT · WRAP · 24H', w / 2, h * .82); });
cell('VELOCE', 512, 128, (c, w, h) => { plate(c, w, h, '#0a0805'); neon(c, 'VELOCE MOTORS', w / 2, h * .42, 56, '#ffcf6a', FONT_C, 700); c.font = `500 20px ${FONT_H}`; c.fillStyle = '#d8b878'; c.textAlign = 'center'; c.fillText('疾風車行 · 新車 · 經典車 · 收購', w / 2, h * .82); });
cell('GARAGE07', 512, 128, (c, w, h) => { plate(c, w, h, '#06070a'); neon(c, 'GARAGE 07', w / 2, h * .42, 64, '#ff8a3a', FONT_C, 700); c.font = `500 20px ${FONT_H}`; c.fillStyle = '#c8926a'; c.textAlign = 'center'; c.fillText('私人車庫 · 請勿停車', w / 2, h * .82); });
cell('LAZARUS_SMALL', 512, 96, (c, w, h) => { plate(c, w, h, '#050306'); c.font = `600 22px ${FONT_C}`; c.fillStyle = '#c98ab0'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('MEMBERS & GUESTS · DOOR POLICY IN EFFECT', w / 2, h / 2); });
const atlasTex = new T.CanvasTexture(atlas);
atlasTex.colorSpace = T.SRGBColorSpace; atlasTex.anisotropy = 8; atlasTex.generateMipmaps = true; atlasTex.minFilter = T.LinearMipmapLinearFilter;

const SIGN_VS = /* glsl */`
attribute vec4 aS;
varying vec3 vW; varying vec2 vUv; varying vec4 vS;
void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vUv = uv; vS = aS; gl_Position = projectionMatrix * viewMatrix * w; }`;
const SIGN_FS = /* glsl */`
${GL_LIB}
uniform sampler2D tAtlas;
varying vec3 vW; varying vec2 vUv; varying vec4 vS;
void main(){
  if (vW.y < uClipY) discard;
  vec3 t = texture2D(tAtlas, vUv).rgb;
  float k = vS.y;                       // 0 穩定、1 壞掉在閃、2 全息掃描
  float fl = 1.;
  if (k > .5 && k < 1.5) fl = step(.22, n2(vec2(uTime*9., vS.x*40.))) * (.7 + .3*n2(vec2(uTime*30., vS.x)));
  if (k > 1.5) fl = .75 + .25*sin(vW.y*40. - uTime*6.) + .2*step(.96, n2(vec2(uTime*4., vS.x)));
  if (k > 2.5) fl *= .55 + .45*sin(uBeat*6.2832);
  float lum = dot(t, vec3(.3,.5,.2));
  vec3 c = t * t * (vS.z) * fl + t * .03;
  gl_FragColor = vec4(applyFog(c, vW), 1.);
}`;
const MAT_SIGN = new T.ShaderMaterial({ name: 'sign', uniforms: { ...shared(ALLU), tAtlas: { value: atlasTex } }, vertexShader: SIGN_VS, fragmentShader: SIGN_FS, side: T.DoubleSide });
const signGeo = { p: [], uv: [], s: [], idx: [] };
const signLights = [];  // {x,y,z,col,r,i}
function signQuad(cx, cy, cz, nx, nz, w, h, cellName, seed, kind, bright, col, lightR = 9) {
  const c = cells[cellName]; const tx = nz, tz = -nx;  // 面向觀看者的右方
  const base = signGeo.p.length / 3;
  const pts = [[-w / 2, -h / 2, c.u0, c.v0], [w / 2, -h / 2, c.u1, c.v0], [w / 2, h / 2, c.u1, c.v1], [-w / 2, h / 2, c.u0, c.v1]];
  for (const [a, b, u, v] of pts) { signGeo.p.push(cx + tx * a, cy + b, cz + tz * a); signGeo.uv.push(u, v); signGeo.s.push(seed, kind, bright, 0); }
  signGeo.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  if (col != null) signLights.push({ x: cx + nx * 1.4, y: cy - .3, z: cz + nz * 1.4, col: lin(col), r: lightR, i: bright * .55 });
}
// 燈籠公園步道燈籠的光（位置在上面 parkLamps 算好；燈籠在橫臂末端，往步道那側 0.82 m）
for (const L of parkLamps) signLights.push({ x: L.x - Math.cos(L.ry) * .82, y: 2.6, z: L.z + Math.sin(L.ry) * .82, col: lin(0xff8a44), r: 9, i: 1.1 });
// 實體建築模型自帶的路燈（props.mjs 的 lightPath，現在只有 Neighbourhood 街區）：燈頭位置換到世界座標補點光
for (const e of bldPlace) {
  const L = PROPS_SPEC[e.set]?.items[e.id]?.lights;
  if (!L) continue;
  const c = Math.cos(e.ry), sn = Math.sin(e.ry);
  for (const [lx, ly, lz] of L) signLights.push({ x: e.x + (lx * c + lz * sn) * e.s, y: ly * e.s, z: e.z + (-lx * sn + lz * c) * e.s, col: lin(0xffd8a8), r: 8, i: .8 });
}
const signBacks = [];
const r3 = rng(404);
let fasciaK = 0, bladeK = 0;
for (const su of shopUnits) {
  if (su.special) continue;
  const ox = su.nx * .08, oz = su.nz * .08;
  if (!su.shut || r3() < .3) {
    const fk = FASCIA_BY[su.kind], f = fk[(fasciaK++ * 7 + Math.floor(r3() * 5)) % fk.length];   // r3() 抽的次數照舊
    const w = Math.min(su.w * .82, 6.2), h = w / 5.33;
    const kind = r3() < .1 ? 1 : 0;
    signQuad(su.x + ox + su.nx * .12, 3.95, su.z + oz + su.nz * .12, su.nx, su.nz, w, Math.min(h, 1.05), 'f:' + f[0], r3(), kind, su.shut ? .5 : 1.6, f[2], 8);
    signBacks.push({ x: su.x + su.nx * .1, y: 3.95, z: su.z + su.nz * .1, ry: Math.atan2(su.nx, su.nz), sx: w + .14, sy: Math.min(h, 1.05) + .14, sz: .18 });
  }
  const dist = district(su.x, su.z);
  if (r3() < (dist.startsWith('霓虹') ? .32 : .12) && su.w > 4) {
    const b = BLADE[bladeK++ % BLADE.length];
    // 立式招牌垂直於牆，兩面各一片
    let px = su.x + su.nx * .85, pz = su.z + su.nz * .85;
    const tx = su.nz, tz = -su.nx;
    const y = 6.6 + r3() * 2;
    // 正面有凸窗或陽台（09-mass.js）的地方，招牌往外讓出它的深度
    if (su.lot && su.lot.mass) {
      const F = facFace(su.lot.mass.front, su.lot.x0, su.lot.x1, su.lot.z0, su.lot.z1);
      if (F.nx === su.nx && F.nz === su.nz) {
        const ux = su.x + tx * (su.w * .4), uz = su.z + tz * (su.w * .4), u = (ux - F.ax) * F.ux + (uz - F.az) * F.uz, d = facOut(su.lot, u, y);
        px += su.nx * d; pz += su.nz * d;
      }
    }
    let ex = px + tx * (su.w * .4), ez = pz + tz * (su.w * .4);
    signQuad(ex + tx * .07, y, ez + tz * .07, tx, tz, .9, 3.6, 'b:' + b[0], r3(), r3() < .12 ? 1 : 0, 1.8, hexOf(b[1]), 10);
    signQuad(ex - tx * .07, y, ez - tz * .07, -tx, -tz, .9, 3.6, 'b:' + b[0], r3(), 0, 1.8, null);
    signBacks.push({ x: ex, y, z: ez, ry: Math.atan2(tx, tz), sx: 1.02, sy: 3.75, sz: .1 });
    signBacks.push({ x: ex - su.nx * .45, y: y + 1.5, z: ez - su.nz * .45, ry: Math.atan2(su.nx, su.nz), sx: .06, sy: .06, sz: .9 });
  }
}
// 屋頂與牆面大型廣告
const billboards = [];
{
  const cand = lots.filter(L => !L.back && !L.special && !L.glb && L.style !== 3 && L.h < 30 && L.b && !L.b.outer && (L.x1 - L.x0) > 9);
  const neonC = cand.filter(L => district((L.x0 + L.x1) / 2, (L.z0 + L.z1) / 2).startsWith('霓虹'));
  const pick = [...neonC.sort(() => r3() - .5).slice(0, 9), ...cand.sort(() => r3() - .5).slice(0, 5)];
  pick.forEach((L, k) => {
    L.rk = null;   // 掛屋頂廣告的地塊照舊是平頂（19-roofs.js）
    const name = BILL[k % (BILL.length - 1)][0];
    const fz = L.axis === 'z' ? L.face : 0, fx = L.axis === 'x' ? L.face : 0;
    const cx = (L.x0 + L.x1) / 2 + fx * ((L.x1 - L.x0) / 2 - 1.5), cz = (L.z0 + L.z1) / 2 + fz * ((L.z1 - L.z0) / 2 - 1.5);
    const w = Math.min(10, (L.x1 - L.x0) - 1), h = w / 2;
    const y = L.h + 1.2 + h / 2;
    signQuad(cx + fx * .1, y, cz + fz * .1, fx || 0, fz || 0, w, h, 'w:' + name, r3(), 0, 1.25, BILL.find(b => b[0] === name)[2], 16);
    billboards.push({ x: cx - fx * .2, z: cz - fz * .2, y, w, h, ry: Math.atan2(fx, fz), top: L.h });
  });
}
const venueSigns = [];
{
  const bk = new Kit();
  for (const b of signBacks) { bk.box(0, 0, 0, b.sx, b.sy, b.sz, 0x111214, 2); applyLast(bk, b); }
  for (const b of billboards) {
    bk.box(0, 0, -.15, b.w + .3, b.h + .3, .2, 0x15161a, 15); applyLast(bk, { x: b.x, y: b.y, z: b.z, ry: b.ry });
    for (const s of [-1, 1]) { bk.box(s * b.w * .35, -(b.y - b.top) / 2, -.6, .18, b.y - b.top, .18, 0x222326, 15); applyLast(bk, { x: b.x, y: b.y, z: b.z, ry: b.ry }); }
    bk.box(0, -b.h / 2 - .2, .1, b.w, .08, .5, 0x222326, 15); applyLast(bk, { x: b.x, y: b.y, z: b.z, ry: b.ry });
  }
  var signBackMesh = cityAddAny(new T.Mesh(bk.build(), MAT.uber));
}
// 把 Kit 裡最後加入的零件整個做一次變換（零件先在原點建好）
function applyLast(k, t) {
  if (!k._mark) k._mark = 0;
  const m = tf(t.x, t.y, t.z, 0, t.ry || 0, 0);
  const nm = new T.Matrix3().getNormalMatrix(m);
  const v = V3();
  for (let i = k._mark; i < k.pos.length; i += 3) {
    v.set(k.pos[i], k.pos[i + 1], k.pos[i + 2]).applyMatrix4(m); k.pos[i] = v.x; k.pos[i + 1] = v.y; k.pos[i + 2] = v.z;
    v.set(k.nor[i], k.nor[i + 1], k.nor[i + 2]).applyMatrix3(nm).normalize(); k.nor[i] = v.x; k.nor[i + 1] = v.y; k.nor[i + 2] = v.z;
  }
  k._mark = k.pos.length;
}

// ─── 全息廣告：線框頭像在街角上方旋轉 ───
const holo = new T.Group();
{
  const prof = [];
  const pts = [[0, -1.25], [.32, -1.2], [.36, -.9], [.42, -.7], [.62, -.55], [.66, -.2], [.7, .2], [.66, .55], [.55, .85], [.32, 1.05], [0, 1.12]];
  for (const [r, y] of pts) prof.push(new T.Vector2(r * 1.6, y * 1.6));
  const g = new T.LatheGeometry(prof, 36);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {   // 臉部：鼻子和眉骨往前凸
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const front = Math.max(0, z / Math.hypot(x, z || 1e-3));
    const nose = Math.exp(-((y + .1) ** 2) * 18) * Math.exp(-(x * x) * 30) * .35;
    const brow = Math.exp(-((y - .45) ** 2) * 30) * .08;
    p.setZ(i, z + (nose + brow) * front * 1.6);
  }
  g.computeVertexNormals();
  const HOLO_FS = /* glsl */`
  ${GL_LIB}
  varying vec2 vUv; varying vec3 vW, vN;
  void main(){
    float lat = smoothstep(.08, 0., abs(fract(vUv.y*26.) - .5) - .38);
    float lon = smoothstep(.08, 0., abs(fract(vUv.x*36.) - .5) - .38);
    float scan = .55 + .45*sin(vW.y*18. - uTime*5.);
    float glitch = step(.93, n2(vec2(floor(vW.y*6.), uTime*3.)));
    vec3 v = normalize(uCam - vW);
    float rim = pow(1. - abs(dot(normalize(vN), v)), 2.);
    float a = (max(lat, lon) * .9 + rim * .5 + .06) * scan * (1. - glitch*.7);
    gl_FragColor = vec4(vec3(.45,1.,1.15) * a * 1.4, 1.);
  }`;
  const HOLO_VS = /* glsl */`
  varying vec2 vUv; varying vec3 vW, vN;
  void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
  const hm = new T.ShaderMaterial({ name: 'holo', uniforms: shared(ALLU), vertexShader: HOLO_VS, fragmentShader: HOLO_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
  holo.add(new T.Mesh(g, hm));
  // 投影光束
  const bg = new T.CylinderGeometry(1.4, .2, 3.4, 20, 1, true); bg.translate(0, -2.9, 0);
  const bm = new T.ShaderMaterial({ name: 'holoBeam', uniforms: shared(ALLU), vertexShader: HOLO_VS, fragmentShader: `${GL_LIB}
    varying vec2 vUv; varying vec3 vW, vN;
    void main(){ float a = (1. - vUv.y) * .25 * (.7 + .3*sin(vUv.x*60. + uTime*3.)); gl_FragColor = vec4(vec3(.4,1.,1.1)*a, 1.); }`,
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
  holo.add(new T.Mesh(bg, bm));
}
// 放在 9 St 與 Bishop Av 路口西北角的樓上
const HOLO_POS = V3(avX(2) - HR - SW - 2.4, 13.5, stZ(3) - HR - SW - 2.4);
holo.position.copy(HOLO_POS); holo.scale.setScalar(1.6); holo.layers.set(LY.NOREFL);
holo.traverse(o => o.layers.set(LY.NOREFL));
cityAdd(holo);
signQuad(HOLO_POS.x + 4.5, 9.2, stZ(3) - HR - SW + .14, 0, 1, 7, 3.5, 'w:TOMORROW', .3, 2, 1.3, 0x9ff6ff, 14);
signLights.push({ x: HOLO_POS.x, y: 9, z: HOLO_POS.z + 3, col: lin(0x6ff0ff), r: 16, i: 1.1 });
{
  const k = new Kit().box(0, 0, 0, 1.2, .5, 1.2, 0x1a1c20, 15).box(0, .28, 0, .8, .06, .8, 0x7ff6ff, 8);
  const m = new T.Mesh(k.build(), MAT.uber); m.position.set(HOLO_POS.x, 7.4, HOLO_POS.z); cityAdd(m);
}

// ─── 掛在街角的燈串 ───
const bulbs = [];
function festoon(a, b, n, sag) {
  for (let k = 0; k <= n; k++) { const t = k / n; bulbs.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) - Math.sin(t * Math.PI) * sag, z: lerp(a.z, b.z, t), s: 1 }); }
}
{
  const zc = stZ(3) - HR - SW;   // 9 St 南側、Atlas 與 Bishop 之間
  for (let k = 0; k < 3; k++) {
    const x0 = avX(1) + HR + SW + 3 + k * 4;
    festoon(V3(x0, 5.6, zc), V3(x0 + 2.5, 5.2, zc + 4.2), 10, .5);
  }
  const zb = stZ(1) - HR;
  festoon(V3(avX(3) + 14, 6, zb - SW + .5), V3(avX(3) + 30, 6, zb - SW + .5), 22, .8);
}
instanced(new Kit().add(new T.IcosahedronGeometry(.07, 1), 0xffc070, 8).build(), MAT.uber, bulbs, LY.NOREFL);

// ─── 蒸氣：從人孔與排氣口冒出 ───
const vents = [];
{
  const r4 = rng(8);
  for (let n = 0; n < 16; n++) {
    if (r4() < .5) { const i = Math.floor(r4() * (NX + 1)), j = Math.floor(r4() * NZ); vents.push(V3(avX(i) + (r4() < .5 ? -3 : 3), 0, stZ(j) + 31)); }
    else { const i = Math.floor(r4() * NX), j = Math.floor(r4() * (NZ + 1)); vents.push(V3(avX(i) + 36, 0, stZ(j) + (r4() < .5 ? -3 : 3))); }
  }
  vents.push(V3(avX(1) + 3, 0, stZ(3) - 20), V3(avX(2) - 3, 0, stZ(3) + 31 - 62));
}
const STEAM_VS = /* glsl */`
${GL_LIB}
attribute float aPh;
varying float vT, vA; varying vec2 vQ; varying vec3 vL, vW;
void main(){
  vec3 c0 = (instanceMatrix * vec4(0,0,0,1)).xyz;
  float t = fract(uTime * .16 + aPh);
  vec3 c = c0 + vec3(sin(aPh*40.)*.5*t + t*1.8, .2 + t*6.5, cos(aPh*30.)*.5*t);
  float s = .7 + t*3.2;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 w = c + (right*position.x + up*position.y) * s;
  vT = t; vQ = position.xy; vW = w; vA = aPh;
  mat3 lg = lampGrid(c, normalize(uCam - c), normalize(uCam - c), 4.), pl = pointLights(c, normalize(uCam - c), normalize(uCam - c), 4.);
  vec3 dif = lg[0] + pl[0];
  vL = dif + uAmbTop*1.5 + uSunCol*.4;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.);
}`;
const STEAM_FS = /* glsl */`
${GL_LIB}
varying float vT, vA; varying vec2 vQ; varying vec3 vL, vW;
void main(){
  float r = length(vQ) * 2.;
  float nn = fbm(vQ*2.2 + vec2(vA*9., -uTime*.4));
  float a = smoothstep(1., .2, r + nn*.5) * vT * (1. - vT) * 2.4 * .3;
  a *= smoothstep(.8, 4., length(vW - uCam));
  gl_FragColor = vec4(applyFog(vL * .55 + vec3(.03), vW), a);
}`;
{
  const g = new T.PlaneGeometry(1, 1);
  const list = []; const ph = [];
  for (const v of vents) for (let k = 0; k < 10; k++) { list.push({ x: v.x, y: 0, z: v.z }); ph.push(k / 10 + Math.random() * .05); }
  g.setAttribute('aPh', new T.InstancedBufferAttribute(new Float32Array(ph), 1));
  const m = instanced(g, new T.ShaderMaterial({ name: 'steam', uniforms: shared(ALLU), vertexShader: STEAM_VS, fragmentShader: STEAM_FS, transparent: true, depthWrite: false }), list, LY.NOREFL);
  m.frustumCulled = false;
}

// ─── 雨：圍著相機的一大箱雨絲，依相對速度拉長，被路燈照亮 ───
const RAIN_N = LOW ? 3600 : 9000;
const rainU = { uVel: { value: V3() }, uIn: { value: 0 } };
const RAIN_VS = /* glsl */`
${GL_LIB}
uniform vec3 uVel;
attribute vec4 aR; attribute vec2 aC;
varying vec2 vC; varying vec3 vL; varying float vF;
void main(){
  vec3 box = vec3(34., 22., 34.);
  float sp = 10. + aR.w * 4.;
  vec3 base = aR.xyz * box; base.y -= uTime * sp; base.x += uTime * 1.6;
  vec3 cp = uCam - vec3(box.x*.5, 7., box.z*.5);
  vec3 p = mod(base - cp, box) + cp;
  vec3 vel = vec3(1.6, -sp, .3) - uVel;
  vec3 dir = normalize(vel);
  float len = .45 + length(vel) * .028;
  vec3 tc = normalize(p - uCam);
  vec3 side = normalize(cross(dir, tc)) * (.008 + length(p - uCam)*.0011);
  vec3 w = p + dir * len * aC.y + side * aC.x;
  vC = aC;
  mat3 lg = lampGrid(p, -tc, -tc, 8.), pl = pointLights(p, -tc, -tc, 8.);
  vec3 dif = lg[0] + pl[0], spc = lg[1] + pl[1];
  vL = dif * .5 + spc * .4 + uFogHi * .7 + uFlash * .8;
  vF = exp(-length(p - uCam) * .045) * uRain;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.);
}`;
const RAIN_FS = /* glsl */`
varying vec2 vC; varying vec3 vL; varying float vF;
void main(){
  float a = (1. - abs(vC.x)) * vC.y * (1. - vC.y) * 4.;
  gl_FragColor = vec4(vL * a * vF * .55, 1.);
}`;
const rainMesh = (() => {
  const g = new T.BufferGeometry();
  const pos = new Float32Array(RAIN_N * 4 * 3), aR = new Float32Array(RAIN_N * 4 * 4), aC = new Float32Array(RAIN_N * 4 * 2), idx = new Uint32Array(RAIN_N * 6);
  for (let i = 0; i < RAIN_N; i++) {
    const r = [Math.random(), Math.random(), Math.random(), Math.random()];
    const corners = [[-1, 0], [1, 0], [1, 1], [-1, 1]];
    for (let c = 0; c < 4; c++) { aR.set(r, (i * 4 + c) * 4); aC.set(corners[c], (i * 4 + c) * 2); }
    idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  }
  g.setAttribute('position', new T.BufferAttribute(pos, 3));
  g.setAttribute('aR', new T.BufferAttribute(aR, 4)); g.setAttribute('aC', new T.BufferAttribute(aC, 2));
  g.setIndex(new T.BufferAttribute(idx, 1));
  const m = new T.Mesh(g, new T.ShaderMaterial({ name: 'rain', uniforms: { ...shared(ALLU), ...rainU }, vertexShader: RAIN_VS, fragmentShader: RAIN_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
  m.frustumCulled = false; m.layers.set(LY.NOREFL); m.renderOrder = 5;
  scene.add(m);
  return m;
})();
// 地上的水花
const SPLASH_N = LOW ? 500 : 1400;
const splashMesh = (() => {
  const g = new T.BufferGeometry();
  const aR = new Float32Array(SPLASH_N * 4 * 4), aC = new Float32Array(SPLASH_N * 4 * 2), idx = new Uint32Array(SPLASH_N * 6);
  for (let i = 0; i < SPLASH_N; i++) {
    const r = [Math.random(), Math.random(), Math.random(), Math.random()];
    for (let c = 0; c < 4; c++) { aR.set(r, (i * 4 + c) * 4); aC.set([[-1, 0], [1, 0], [1, 1], [-1, 1]][c], (i * 4 + c) * 2); }
    idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  }
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(SPLASH_N * 12), 3));
  g.setAttribute('aR', new T.BufferAttribute(aR, 4)); g.setAttribute('aC', new T.BufferAttribute(aC, 2));
  g.setIndex(new T.BufferAttribute(idx, 1));
  const m = new T.Mesh(g, new T.ShaderMaterial({ name: 'splash', uniforms: shared(ALLU), transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: `${GL_LIB}
    attribute vec4 aR; attribute vec2 aC;
    varying vec2 vC; varying float vT; varying vec3 vL;
    void main(){
      float box = 26.;
      float cyc = floor(uTime * 2.2 + aR.w * 7.);
      vec2 rr = fract(aR.xy + vec2(h11(cyc + aR.z*91.), h11(cyc*1.3 + aR.z*37.)));
      vec3 c = vec3(uCam.x + (rr.x - .5)*box, 0., uCam.z + (rr.y - .5)*box);
      float X0=uCity.x, Z0=uCity.y, P=uCity.z, Q=uCity.w;
      vec2 r0 = c.xz - uZone.xy, l = vec2(r0.x*uZone.z - r0.y*uZone.w, r0.x*uZone.w + r0.y*uZone.z);   // 換到相機所在區的邏輯座標
      float dx = abs(l.x - (X0 + floor((l.x-X0)/P + .5)*P)), dz = abs(l.y - (Z0 + floor((l.y-Z0)/Q + .5)*Q));
      c.y = (dx > 8. && dz > 8.) ? .16 : .01;
      vT = fract(uTime * 2.2 + aR.w * 7.);
      vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
      float s = .05 + vT * .12;
      vec3 w = c + right * aC.x * s + vec3(0., aC.y * s * 1.3, 0.);
      vC = aC;
      vec3 tc = normalize(uCam - c); mat3 lg = lampGrid(c + vec3(0,.3,0), tc, tc, 8.); vec3 dif = lg[0];
      vL = (dif * .6 + uFogHi) * uRain * exp(-length(c - uCam)*.06);
      gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.);
    }`,
    fragmentShader: `varying vec2 vC; varying float vT; varying vec3 vL;
    void main(){ vec2 q = vec2(vC.x, vC.y*2. - 1.); float r = length(q); float a = smoothstep(.15, 0., abs(r - .7)) * step(vC.y, .55) * (1. - vT); gl_FragColor = vec4(vL * a * .9, 1.); }` }));
  m.frustumCulled = false; m.layers.set(LY.NOREFL); m.renderOrder = 5;
  scene.add(m);
  return m;
})();

// ─── 天空：夜裡低垂的雲被城市燈光從下方照亮（雲散了看得到星星與月亮），白天是藍天、太陽與被照亮的雲（28-sky.js 給顏色） ───
const sky = (() => {
  const g = new T.SphereGeometry(900, 32, 16);
  const m = new T.Mesh(g, new T.ShaderMaterial({ name: 'sky', uniforms: shared(ALLU), side: T.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }`,
    fragmentShader: `${GL_LIB}
    varying vec3 vD;
    void main(){
      vec3 d = normalize(vD);
      vec2 q = d.xz / max(d.y + .08, .05);
      float cl = fbm(q * .5 + vec2(uTime*.01, uTime*.004));
      float cl2 = fbm(q * 1.3 - vec2(uTime*.015, 0.));
      float h = clamp(d.y, 0., 1.);
      float dens = smoothstep(1. - uCloud, 1.25 - uCloud * .8, cl + cl2 * .45);   // 雲量：uCloud 1 是整片低雲
      // 夜
      vec3 glow = mix(uFogHi * 2.2, uFogCol * .6, smoothstep(0., .5, h));
      vec3 overcast = glow * (.55 + .7*cl*cl2);
      vec3 clear = mix(uFogHi * 1.5, vec3(.003, .005, .012), smoothstep(0., .45, h));
      vec2 sc = vec2(atan(d.z, d.x) * 140., asin(h) * 140.);
      // 城市光害下只剩最亮的幾百顆（原本 pow(h, 60) 整片七千顆像天文館），亮度差很多、多半很暗，低空被天光吃掉
      float hs = h21(floor(sc)), star = pow(smoothstep(.9982, 1., hs), 2.) * smoothstep(.3, .06, length(fract(sc) - .5)) * (.75 + .25*sin(uTime*3. + h21(floor(sc) + 3.)*40.));
      clear += vec3(.85, .88, 1.) * star * 2.2 * smoothstep(.25, .75, h) * smoothstep(-.08, -.22, uSun.y);   // 天全黑了才看得到星星
      float md = dot(d, uMoon);
      clear += vec3(1., .96, .86) * (smoothstep(.99955, .9997, md) * 2.2 + pow(max(md, 0.), 80.) * .12) * step(0., uMoon.y);
      vec3 night = mix(clear, overcast, dens);
      // 白天
      float sd = max(dot(d, uSun), 0.);
      vec3 day = mix(uSkyHor, uSkyTop, pow(h, .55));
      day += uSunCol * (smoothstep(.99962, .9998, sd) * 20. + pow(sd, 14.) * .22 + pow(sd, 3.) * .05);
      vec3 cloud = (uSkyHor * .85 + uSkyTop * .2 + uSunCol * .32 * (.6 + .6*cl2)) * (.72 + .4*cl2);
      day = mix(day, cloud, dens * .96);
      vec3 c = mix(night, day, uDay);
      c += vec3(.75,.8,1.) * uFlash * (.6 + cl) * 1.6;
      if (d.y < 0.) c = uFogCol;
      gl_FragColor = vec4(c, 1.);
    }` }));
  m.renderOrder = -10; m.frustumCulled = false;
  scene.add(m);
  return m;
})();
