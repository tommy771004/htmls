
// ═══ 街道設施、招牌、全息廣告、蒸氣、雨與天空 ═══
await bootStep(BOOT.props, '擺放街道與招牌…');
const _o = new T.Object3D();
// 清單是邏輯座標（t.zn 給了就用那一區，否則看位置在哪一區）：每個 instance 的矩陣換成世界座標，InstancedMesh 本身掛在 scene
// R：只送相機附近幾公尺內的實例（預設 INST_R；面數多的模型，例如 27-props 檔尾的樹，給小一點）。
// stream.R0：近處這幾公尺內的不送（27-props 檔尾換成模型後，程式建模的樹只畫在模型的範圍外，當遠景）
function instanced(geo, mat, list, layer = 0, extra, R) {
  const m = new T.InstancedMesh(geo, mat, Math.max(1, list.length));
  const wx = new Float32Array(list.length), wz = new Float32Array(list.length);
  list.forEach((t, k) => {
    _o.position.set(t.x, t.y || 0, t.z); _o.rotation.set(t.rx || 0, t.ry || 0, t.rz || 0, 'YXZ');
    _o.scale.set(t.sx || t.s || 1, t.sy || t.s || 1, t.sz || t.s || 1); _o.updateMatrix();
    const zn = t.zn !== undefined ? t.zn : zoneAtL(t.x, t.z);
    if (zn) _o.matrix.premultiply(zn.m4);
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
  m.userData.map = new Int32Array(n); m.userData.stream = S;
  m.boundingSphere = new T.Sphere(V3(), R + 30);
  instStreams.push(S);
}
// mtx 是世界座標
function instSet(m, k, mtx) {
  const S = m.userData.stream;
  if (!S) { m.setMatrixAt(k, mtx); m.instanceMatrix.needsUpdate = true; return; }
  mtx.toArray(S.mtx, k * 16); S.dirty = true;
}
function instUpdate(cx, cz) {
  for (const S of instStreams) {
    if (!S.dirty && (S.cx - cx) ** 2 + (S.cz - cz) ** 2 < 144) continue;
    S.dirty = false; S.cx = cx; S.cz = cz;
    const { m, mtx } = S, dst = m.instanceMatrix.array, map = m.userData.map, R2 = S.R * S.R, R02 = (S.R0 || 0) ** 2;
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
    m.boundingSphere.center.set(cx, 0, cz);
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

// ─── 路燈：沿路網每一段（各區自己的邊界路也有一份）；燈頭的位置寫進 shader 的路燈表（lampTable，lampGrid 查） ───
const lampsA = [], lampsS = [], lampsC = [];
for (const e of RN.edges) {
  if (e.kind === 'c') {   // 區之間的連接道路（世界座標）：兩側每 20 m 一盞，路口範圍內不放
    for (let u = HR + 10; u < e.len - HR - 6; u += 20) for (const s of [-1, 1]) {
      const [x, z] = edgeAt(e, u), [xa, za] = edgeAt(e, Math.max(0, u - 1)), [xb, zb] = edgeAt(e, Math.min(e.len, u + 1)), l = Math.hypot(xb - xa, zb - za) || 1;
      const nx = (zb - za) / l * s, nz = -(xb - xa) / l * s;   // 往路外
      lampsC.push({ x: x + nx * 9.6, z: z + nz * 9.6, ry: Math.atan2(-nz, nx), hx: x + nx * 7.4, hz: z + nz * 7.4, zn: null });
    }
    continue;
  }
  const { i, j } = e.a, zn = e.zn;
  if (e.kind === 'z') { for (const s of [-1, 1]) for (const o of [16, 31, 46]) lampsA.push({ x: avX(i) + s * 8.6, z: stZ(j) + o, ry: s > 0 ? 0 : Math.PI, hx: avX(i) + s * 6.4, zn }); }
  else for (const s of [-1, 1]) for (const o of [18, 36, 54]) lampsS.push({ x: avX(i) + o, z: stZ(j) + s * 8.6, ry: s > 0 ? -Math.PI / 2 : Math.PI / 2, hz: stZ(j) + s * 6.4, zn });
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
for (const l of lampsC) circles.push({ x: l.x, z: l.z, r: .22, w: 1 });
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
    L.slice(0, LAMP_K).forEach((h, n) => data.set([h.x, h.z, h.t, 1], ((d * nx + c) * LAMP_K + n) * 4));
  });
  if (over) console.warn('lamp table: cells over', LAMP_K, over);
  const tex = new T.DataTexture(data, nx * LAMP_K, nz, T.RGBAFormat, T.FloatType);
  tex.minFilter = tex.magFilter = T.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  U.uLampT.value = tex; U.uLampG.value.set(x0, z0, nx, nz);
}
lampTable([...lampsA.map(l => { const [x, z] = toW(l.hx, l.z, l.zn); return { x, z, t: 0 }; }), ...lampsS.map(l => { const [x, z] = toW(l.x, l.hz, l.zn); return { x, z, t: 1 }; }),
  ...lampsC.map(l => ({ x: l.hx, z: l.hz, t: 0 }))]);
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
  return new T.ShaderMaterial({ uniforms: { ...shared(ALLU), uColor: { value: lin(col) } }, vertexShader: CONE_VS, fragmentShader: CONE_FS,
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
}
{
  const cg = new T.CylinderGeometry(.22, 3.1, 7, 18, 1, true); cg.translate(0, 3.5, 0);
  instanced(cg, coneMat(0xff9a4c), lampsA.map(l => ({ x: l.hx, z: l.z, zn: l.zn })), LY.NOREFL);
  instanced(cg.clone(), coneMat(0xa8d4ff), lampsS.map(l => ({ x: l.x, z: l.hz, zn: l.zn })), LY.NOREFL);
  instanced(cg.clone(), coneMat(0xff9a4c), lampsC.map(l => ({ x: l.hx, z: l.hz, zn: null })), LY.NOREFL);
}

// ─── 紅綠燈：每個路口每個來車方向一支懸臂號誌（立在來車那段路的右前方） ───
// 往外的方向換到路口所在區的邏輯座標再對齊軸（連接道路垂直離開邊界路，也落在軸上）；ax 和車流用的 edgeAx() 一樣
const signals = [];
for (const n of RN.nodes) for (const { e, dir } of n.out) {
  const [ox, oz] = dirL(n.zn, ...outDir(e, dir)), ax = edgeAx(n, e), sg = ax === 'x' ? Math.sign(ox) : Math.sign(oz);
  const hx = ax === 'x' ? -sg : 0, hz = ax === 'z' ? -sg : 0;   // 來車的方向（邏輯座標）：和往外的方向相反
  signals.push({ x: avX(n.i) - hx * 9.2 - hz * 9.2, z: stZ(n.j) - hz * 9.2 + hx * 9.2, ry: Math.atan2(hx, hz), i: n.i, j: n.j, ax, zn: n.zn, node: n });
}
const sigGeo = new Kit()
  .cyl(0, 3.1, 0, .11, .13, 6.2, 10, 0x30343a, 15)
  .box(2.6, 6.05, 0, 5.2, .12, .12, 0x30343a, 15)
  .box(4.7, 5.35, 0, .42, 1.25, .34, 0x15171a, 2)
  .box(4.7, 5.35, .19, .5, 1.33, .04, 0x101113, 2)
  .cyl(4.7, 5.74, -.18, .12, .12, .04, 12, 0xff2a1a, 12, Math.PI / 2)
  .cyl(4.7, 5.35, -.18, .12, .12, .04, 12, 0xffb020, 13, Math.PI / 2)
  .cyl(4.7, 4.96, -.18, .12, .12, .04, 12, 0x40ff9a, 14, Math.PI / 2)
  .box(.25, 2.6, 0, .3, .5, .25, 0x15171a, 2)
  .build();
const sigMesh = instanced(sigGeo, MAT.uberI, signals, 0, () => 0);
for (const s of signals) { circles.push(circleToW({ x: s.x, z: s.z, r: .2 }, s.zn)); claim(s.x, s.z, 1.2); }
const SIGP = 26;
function lightState(i, j, ax, t) {
  const k = ((t + (i * 7 + j * 11) % SIGP) % SIGP + SIGP) % SIGP;
  if (ax === 'z') return k < 11 ? 2 : k < 13 ? 1 : 0;
  return k < 13 ? 0 : k < 24 ? 2 : 1;
}
function updateSignals(t) {
  const a = sigGeo.attributes.aIns, map = sigMesh.userData.map;
  for (let c = 0; c < sigMesh.count; c++) { const s = signals[map ? map[c] : c]; a.array[c * 4] = lightState(s.i, s.j, s.ax, t); }
  a.needsUpdate = true;
}

// ─── 人行道小物：消防栓、垃圾桶、報箱、護柱、電話亭 ───
const hydrants = [], bins = [], boxesN = [], bollards = [], booths = [], grates = [], trees = [];
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
  else if (r < .26 && free(s.x, s.z, .8)) { boxesN.push({ ...s, y: .15 }); claim(s.x, s.z, .8); circles.push({ x: s.x, z: s.z, r: .35 }); }
  else if (r < .3 && free(s.x, s.z, 1.2)) { booths.push({ ...s, y: .15 }); claim(s.x, s.z, 1.2); circles.push({ x: s.x, z: s.z, r: .55 }); }
}
// 路口轉角的護柱（只放在這一區自己的人行道上）
for (const n of RN.nodes) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
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
// 燈柱、往步道伸出的橫臂、吊著的紅燈籠（上下黑色環）
instanced(new Kit()
  .cyl(0, .2, 0, .14, .16, .4, 8, 0x1c1a18, 15).cyl(0, 1.7, 0, .06, .07, 3.2, 8, 0x2a2622, 15)
  .box(-.42, 3.25, 0, .9, .06, .06, 0x2a2622, 15).cyl(-.82, 3.05, 0, .01, .01, .35, 4, 0x1c1a18, 15)
  .cyl(-.82, 2.94, 0, .09, .09, .05, 10, 0x1c1a18, 15)
  .cyl(-.82, 2.84, 0, .14, .24, .14, 12, 0xd8401c, 11).cyl(-.82, 2.67, 0, .26, .26, .2, 12, 0xff9a4a, 11).cyl(-.82, 2.5, 0, .24, .14, .14, 12, 0xd8401c, 11)
  .cyl(-.82, 2.41, 0, .09, .09, .05, 10, 0x1c1a18, 15).cyl(-.82, 2.3, 0, .015, .015, .18, 4, 0xd8401c, 11).build(), MAT.uber, parkLamps, LY.NOREFL);

// 行道樹：紅磚巷與舊碼頭比較多；燈籠公園的草地上種滿樹
for (const b of blocks) {
  if (b.outer) continue;
  if (b.park) {
    const r3 = rng(b.i * 131 + b.j);
    for (let x = b.x0 + SW + 4; x < b.x1 - SW - 3; x += 7) for (let z = b.z0 + SW + 4; z < b.z1 - SW - 3; z += 7) {
      const tx = x + (r3() - .5) * 4, tz = z + (r3() - .5) * 4;
      if (r3() < .55 && free(tx, tz, 2.4)) { trees.push({ x: tx, z: tz, y: .15, ry: r3() * 6.3, s: .95 + r3() * .5, park: 1 }); claim(tx, tz, 2.4); circles.push({ x: tx, z: tz, r: .35 }); }
    }
  }
  const dist = district((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
  const dens = dist.startsWith('霓虹') ? .35 : dist.startsWith('中城') ? .45 : .8;
  for (const z of [b.z0 + 1.6, b.z1 - 1.6]) for (let x = b.x0 + 12; x < b.x1 - 10; x += 9 + rnd() * 3)
    if (rnd() < dens && free(x, z, 2.2)) { trees.push({ x, z, y: .15, ry: rnd() * 6.3, s: .85 + rnd() * .35 }); claim(x, z, 2.2); circles.push({ x, z, r: .3 }); }
  for (const x of [b.x0 + 1.6, b.x1 - 1.6]) for (let z = b.z0 + 12; z < b.z1 - 10; z += 9 + rnd() * 3)
    if (rnd() < dens * .7 && free(x, z, 2.2)) { trees.push({ x, z, y: .15, ry: rnd() * 6.3, s: .85 + rnd() * .35 }); claim(x, z, 2.2); circles.push({ x, z, r: .3 }); }
}
// 區之間的縫（05-zones.js 的 SEAM_IN）：草地上稀疏的樹，世界座標；避開連接道路、草地邊緣，樓牆後面不種
{
  const r5 = rng(7171), conn = RN.edges.filter(e => e.kind === 'c'), P = SEAM_IN;
  const edgeD = (x, z) => { let m = 1e9; for (let k = 0; k < P.length; k++) { const [ax, az] = P[k], [bx, bz] = P[(k + 1) % P.length], dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1), 0, 1); m = Math.min(m, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return m; };
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const [x, z] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  for (let x = x0; x < x1; x += 11) for (let z = z0; z < z1; z += 11) {
    const tx = x + (r5() - .5) * 7, tz = z + (r5() - .5) * 7, s = .9 + r5() * .5, ry = r5() * 6.3;
    if (r5() > .55 || !inPoly(P, tx, tz) || edgeD(tx, tz) < 4 || toL(tx, tz)[1] < CITY_Z0 + 4) continue;
    if (conn.some(e => e.pts.some(([px, pz]) => (px - tx) ** 2 + (pz - tz) ** 2 < 144)) || lampsC.some(l => (l.x - tx) ** 2 + (l.z - tz) ** 2 < 9)) continue;
    trees.push({ x: tx, z: tz, y: 0, ry, s, park: 1, zn: null }); circles.push({ x: tx, z: tz, r: .35, w: 1 });
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
      trees.push({ x: tx, z: tz, y: 0, ry, s, park: 1, zn: null }); circles.push({ x: tx, z: tz, r: .35, w: 1 });
    }
  }
}
for (const t of trees) if (!t.park) grates.push({ x: t.x, z: t.z, y: .155 });
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
// World 第四輪之二（27-props.js 檔尾）：以 http(s) 開啟時把下面幾種換成 Sketchfab 模型，所以留住程式建模的網格（下載好才拿掉）
const hydrantMesh = instanced(new Kit()
  .cyl(0, .3, 0, .13, .15, .6, 10, 0xb81e14, 10).cyl(0, .65, 0, .15, .1, .14, 10, 0xb81e14, 10)
  .cyl(0, .4, 0, .05, .05, .42, 6, 0x9a9a9a, 3, 0, 0, Math.PI / 2).build(), MAT.uber, hydrants, LY.NOREFL);
const binMesh = instanced(new Kit()
  .cyl(0, .48, 0, .3, .26, .96, 12, 0x2f3a33, 15).cyl(0, .98, 0, .32, .32, .06, 12, 0x232a26, 15).build(), MAT.uber, bins, LY.NOREFL);
// 電訊箱（69-market.js 射擊、撞爛）：執行時用世界座標，和換過的碰撞圓柱同一個算法，69-market 才比對得到
worldHooks.push(() => { for (const b of boxesN) { [b.x, b.z] = toW(b.x, b.z); } });
const boxesMesh = instanced(new Kit()   // 藍色電訊箱：69-market.js 打爛時把該格縮成 0
  .box(0, .62, 0, .5, .9, .45, 0x1c4f9a, 10).box(0, 1.1, 0, .5, .08, .45, 0x163f7a, 10).box(0, .7, -.23, .38, .3, .02, 0xeeeeee, 11)
  .box(.18, .1, 0, .04, .2, .4, 0x222222, 15).box(-.18, .1, 0, .04, .2, .4, 0x222222, 15).build(), MAT.uber, boxesN, LY.NOREFL);
instanced(new Kit().cyl(0, .45, 0, .1, .11, .9, 10, 0x34383d, 15).cyl(0, .82, 0, .115, .115, .06, 10, 0xd8a020, 10).build(), MAT.uber, bollards, LY.NOREFL);
const boothMesh = instanced(new Kit()
  .box(0, 1.15, 0, .9, 2.3, .9, 0x1d2a2a, 15).box(0, 1.3, -.46, .7, 1.5, .02, 0x88aaaa, 1).box(0, 2.18, -.46, .7, .16, .03, 0x7fe7ff, 8)
  .box(0, 2.35, 0, .96, .1, .96, 0x121818, 15).build(), MAT.uber, booths);
instanced(new Kit().box(0, 0, 0, 1.3, .02, 1.3, 0x14130f, 15).build(), MAT.uber, grates, LY.NOREFL);
let treeMesh;
{ // 行道樹：幾團變形的二十面體葉團
  const k = new Kit(); const r2 = rng(5);
  k.cyl(0, 2.1, 0, .1, .17, 4.2, 8, 0x3a2c20, 2);
  for (let i = 0; i < 7; i++) {
    const g = new T.IcosahedronGeometry(1.1 + r2() * .5, 1);
    const p = g.attributes.position;
    const ph = r2() * 10;
    for (let v = 0; v < p.count; v++) { const x = p.getX(v), y = p.getY(v), z = p.getZ(v); const s = .86 + .22 * Math.sin(x * 4.1 + y * 2.3 + ph) * Math.cos(z * 3.7 - y * 1.9 + ph); p.setXYZ(v, x * s, y * s * .8, z * s); }
    g.computeVertexNormals();
    const a = i / 7 * 6.28, rr = i === 0 ? 0 : 1 + r2() * .5;
    const col = new T.Color().setHSL(.24 + r2() * .06, .45, .2 + r2() * .08);
    k.add(g, col, 2, tf(Math.cos(a) * rr, 4.9 + r2() * 1.3 + (i === 0 ? .8 : 0), Math.sin(a) * rr));
  }
  treeMesh = instanced(k.build(), MAT.uber, trees);
}

// ─── 窗型冷氣、逃生梯、水塔、屋頂設備 ───
const acs = [], escapes = [], towers = [], roofBits = [];
function facePoint(L, k, along, y, out) {
  // 依 boxFaces 的 u 方向，把面上的 (u, y) 轉成世界座標，並往外推 out 公尺
  if (k === 'pz') return { x: L.x0 + along, y, z: L.z1 + out, ry: 0 };
  if (k === 'nz') return { x: L.x1 - along, y, z: L.z0 - out, ry: Math.PI };
  if (k === 'px') return { x: L.x1 + out, y, z: L.z1 - along, ry: Math.PI / 2 };
  return { x: L.x0 - out, y, z: L.z0 + along, ry: -Math.PI / 2 };
}
for (const L of winSpots) {
  const k = L.axis === 'z' ? (L.face > 0 ? 'pz' : 'nz') : (L.face > 0 ? 'px' : 'nx');
  const fw = k === 'pz' || k === 'nz' ? L.x1 - L.x0 : L.z1 - L.z0;
  const ws = L.style === 2 ? 2.2 : 2.5, fh = L.fh, gH = 4.6;
  const nF = Math.floor((L.h - gH - .7) / fh);
  const cols = Math.max(1, Math.floor((fw - 1) / ws)), mg = (fw - cols * ws) / 2;
  let escCol = -1;
  if (cols >= 3 && rnd() < .45 && L.style !== 2) escCol = 1 + Math.floor(rnd() * (cols - 2));
  for (let fi = 0; fi < nF; fi++) for (let ci = 0; ci < cols; ci++) {
    if (escCol >= 0 && (ci === escCol || ci === escCol - 1)) continue;
    if (rnd() < .14) acs.push(facePoint(L, k, mg + (ci + .5) * ws, gH + fi * fh + .18 * fh + .02, .22));
  }
  if (escCol >= 0) for (let fi = 0; fi < nF; fi++) escapes.push(facePoint(L, k, mg + escCol * ws, gH + fi * fh + .18 * fh - .1, .62));
  if (L.h < 32 && rnd() < .28) towers.push({ x: lerp(L.x0, L.x1, .3 + rnd() * .4), y: L.h, z: lerp(L.z0, L.z1, .3 + rnd() * .4), ry: rnd() * 6, s: .8 + rnd() * .4 });
  for (let n = 0; n < 2; n++) if (rnd() < .5) roofBits.push({ x: lerp(L.x0, L.x1, .15 + rnd() * .7), y: L.h, z: lerp(L.z0, L.z1, .15 + rnd() * .7), ry: Math.floor(rnd() * 4) * Math.PI / 2, s: .7 + rnd() * .6 });
}
instanced(new Kit().box(0, .22, .02, .66, .42, .5, 0xbab5a8, 10).box(0, .22, .28, .58, .3, .02, 0x55534e, 2).box(0, -.04, .05, .5, .06, .4, 0x2a2a2a, 15).build(), MAT.uber, acs);
{
  const k = new Kit(), iron = 0x1c1d20, W = 5.2;
  k.box(0, 0, 0, W, .06, 1.15, iron, 15);
  k.box(0, 1.0, .55, W, .05, .05, iron, 15);
  for (let x = -W / 2; x <= W / 2 + .01; x += W / 8) k.box(x, .5, .55, .03, 1, .03, iron, 15);
  k.box(-W / 2, .5, 0, .03, 1, 1.15, iron, 15);
  k.box(W / 2, .5, 0, .03, 1, 1.15, iron, 15);
  k.box(.8, 1.55, .15, .6, .05, 3.4, iron, 15, -Math.atan2(3.1, 3.3) + Math.PI / 2, Math.PI / 2, 0);
  instanced(k.build(), MAT.uber, escapes.map(e => ({ ...e, x: e.x + Math.cos(e.ry) * 1.25, z: e.z - Math.sin(e.ry) * 1.25 })));
}
{
  const k = new Kit(), wood = 0x5a3f2a;
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(x * 1.1, 1.3, z * 1.1, .12, 2.6, .12, 0x26272a, 15);
  k.box(0, 2.62, 0, 2.9, .12, 2.9, 0x26272a, 15);
  k.cyl(0, 4.3, 0, 1.55, 1.6, 3.2, 16, wood, 2);
  for (let y = 3; y < 6; y += .7) k.cyl(0, y, 0, 1.63, 1.63, .06, 16, 0x222326, 15);
  k.cyl(0, 6.45, 0, .1, 1.7, 1.1, 16, 0x3a3a3c, 15);
  instanced(k.build(), MAT.uber, towers);
}
instanced(new Kit().box(0, .55, 0, 2.2, 1.1, 1.4, 0x6c6f72, 10).box(.4, 1.2, 0, .9, .2, .9, 0x3a3c3e, 2).cyl(-.6, 1.4, 0, .25, .25, .8, 10, 0x55585b, 15).build(), MAT.uber, roofBits);

// 施工區：Atlas Av 靠 8 St 的一段車道
const works = [];
{
  const x = avX(1) + 6.3, zc = stZ(2) + 30;
  for (let k = 0; k < 6; k++) works.push({ t: 'drum', x: x + (k % 2) * .6 - .3, z: zc - 9 + k * 3.2 });
  for (let k = 0; k < 7; k++) works.push({ t: 'cone', x: x - 1.5 + (k % 2) * .25, z: zc - 14 + k * 1.6 });
  works.push({ t: 'jersey', x: x + 1.05, z: zc - 2, ry: 0 }, { t: 'jersey', x: x + 1.05, z: zc + 2.1, ry: 0 });
  for (const w of works) circles.push({ x: w.x, z: w.z, r: w.t === 'jersey' ? 1 : .35 });
}
// 飛車特技跳台（69-stunt.js）：放在路口前的停車道上，順著車流方向朝路口飛過去；(x, z) 是跳台邊緣，yaw 是車頭方向。
// 30-vehicles.js 擺路邊車時用 rampBlock() 讓開跳台與落地區
const RAMP_L = 10, RAMP_H = 1.5, RAMP_W = 3.2;
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
  { x: avX(13) - PARK, z: stZ(7) - HR - 1, yaw: 0 },
  { x: avX(16) - PARK, z: stZ(4) - HR - 1, yaw: 0 },
  { x: avX(18) - PARK, z: stZ(10) - HR - 1, yaw: 0 },
  { x: avX(9) + PARK, z: stZ(9) + HR + 1, yaw: Math.PI },
  { x: avX(12) + PARK, z: stZ(12) + HR + 1, yaw: Math.PI },
  { x: avX(6) + PARK, z: stZ(11) + HR + 1, yaw: Math.PI },
  { x: avX(8) - HR - 1, z: stZ(6) + PARK, yaw: Math.PI / 2 },
  { x: avX(11) - HR - 1, z: stZ(8) + PARK, yaw: Math.PI / 2 },
  { x: avX(15) - HR - 1, z: stZ(2) + PARK, yaw: Math.PI / 2 },
  { x: avX(14) + HR + 1, z: stZ(13) - PARK, yaw: -Math.PI / 2 },
  { x: avX(19) + HR + 1, z: stZ(6) - PARK, yaw: -Math.PI / 2 },
  { x: avX(4) + HR + 1, z: stZ(9) - PARK, yaw: -Math.PI / 2 },
].map((r, i) => ({ ...r, i, dx: Math.sin(r.yaw), dz: Math.cos(r.yaw) }));
// 生成時（停車避開跳台）用邏輯座標；cityWorld() 之後 RAMPS 是世界座標（69-stunt.js 每幀判斷車有沒有開上去）
worldHooks.push(() => { for (const r of RAMPS) { const zn = zoneAtL(r.x, r.z); [r.x, r.z] = toW(r.x, r.z, zn); r.yaw = yawW(zn, r.yaw); r.dx = Math.sin(r.yaw); r.dz = Math.cos(r.yaw); } });
const rampBlock = (x, z) => RAMPS.some(r => { const a = (x - r.x) * r.dx + (z - r.z) * r.dz, b = (x - r.x) * r.dz - (z - r.z) * r.dx; return Math.abs(b) < 2.5 && a > -RAMP_L - 26 && a < 60; });   // 前面留 26 m 助跑，後面 60 m 內不停車（落地後還會往前滑）
// 跳台的幾何是邏輯座標：每區合併一份，以一個 instance 掛上該區的變換
for (const zn of ZONES) {
  const k = new Kit(), th = Math.atan2(RAMP_H, RAMP_L), sl = Math.hypot(RAMP_H, RAMP_L), mine = RAMPS.filter(r => zoneAtL(r.x, r.z) === zn);
  if (!mine.length) continue;
  for (const r of mine) {
    const cx = r.x - r.dx * RAMP_L / 2, cz = r.z - r.dz * RAMP_L / 2, rx = r.dz, rz = -r.dx;
    k.box(cx, RAMP_H / 2 - .06, cz, RAMP_W, .12, sl, 0x55595e, 15, -th, r.yaw);   // 斜板
    for (const s of [-1, 1]) k.box(cx + rx * s * (RAMP_W / 2 - .08), RAMP_H / 2 - .02, cz + rz * s * (RAMP_W / 2 - .08), .16, .14, sl, 0xd9b42a, 10, -th, r.yaw);   // 兩側黃邊
    k.box(r.x - r.dx * .1, RAMP_H / 2, r.z - r.dz * .1, RAMP_W, RAMP_H, .2, 0x2a2c2f, 15, 0, r.yaw);   // 邊緣的立板
    for (const s of [-1, 1]) for (const f of [.35, .7]) k.box(r.x - r.dx * RAMP_L * (1 - f) + rx * s * 1.2, RAMP_H * f / 2, r.z - r.dz * RAMP_L * (1 - f) + rz * s * 1.2, .14, RAMP_H * f, .14, 0x2a2c2f, 15, 0, r.yaw);   // 支架
  }
  instanced(k.build(), MAT.uber, [{ x: 0, z: 0, zn }]);
}
{
  const d = new Kit();
  for (let k = 0; k < 4; k++) d.cyl(0, .12 + k * .24, 0, .29, .3, .24, 14, k % 2 ? 0xf2f2ee : 0xff6a10, k % 2 ? 11 : 10);
  d.cyl(0, 1.0, 0, .2, .2, .06, 12, 0x222222, 2).box(0, 1.12, 0, .14, .12, .06, 0xffb020, 9);
  instanced(d.build(), MAT.uberI, works.filter(w => w.t === 'drum'), 0, (t, c) => c === 1 ? rnd() : 0);
  const c = new Kit().cyl(0, .38, 0, .03, .19, .72, 12, 0xff5a0a, 10).cyl(0, .4, 0, .12, .14, .1, 12, 0xf2f2ee, 11).box(0, .02, 0, .42, .04, .42, 0x222222, 2);
  instanced(c.build(), MAT.uber, works.filter(w => w.t === 'cone'), LY.NOREFL);
  const j = new Kit().box(0, .2, 0, .6, .4, 3.8, 0xb8b4aa, 10).box(0, .6, 0, .35, .4, 3.8, 0xb8b4aa, 10).box(0, .82, 0, .22, .06, 3.8, 0xb8b4aa, 10)
    .box(.31, .4, 0, .01, .12, 3.6, 0xff6a10, 11);
  instanced(j.build(), MAT.uber, works.filter(w => w.t === 'jersey'));
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
const MAT_SIGN = new T.ShaderMaterial({ uniforms: { ...shared(ALLU), tAtlas: { value: atlasTex } }, vertexShader: SIGN_VS, fragmentShader: SIGN_FS, side: T.DoubleSide });
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
    const f = FASCIA[(fasciaK++ * 7 + Math.floor(r3() * 5)) % FASCIA.length];
    const w = Math.min(su.w * .82, 6.2), h = w / 5.33;
    const kind = r3() < .1 ? 1 : 0;
    signQuad(su.x + ox + su.nx * .12, 3.95, su.z + oz + su.nz * .12, su.nx, su.nz, w, Math.min(h, 1.05), 'f:' + f[0], r3(), kind, su.shut ? .5 : 1.6, f[2], 8);
    signBacks.push({ x: su.x + su.nx * .1, y: 3.95, z: su.z + su.nz * .1, ry: Math.atan2(su.nx, su.nz), sx: w + .14, sy: Math.min(h, 1.05) + .14, sz: .18 });
  }
  const dist = district(su.x, su.z);
  if (r3() < (dist.startsWith('霓虹') ? .32 : .12) && su.w > 4) {
    const b = BLADE[bladeK++ % BLADE.length];
    // 立式招牌垂直於牆，兩面各一片
    const px = su.x + su.nx * .85, pz = su.z + su.nz * .85, tx = su.nz, tz = -su.nx;
    const y = 6.6 + r3() * 2;
    const ex = px + tx * (su.w * .4), ez = pz + tz * (su.w * .4);
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
  const hm = new T.ShaderMaterial({ uniforms: shared(ALLU), vertexShader: HOLO_VS, fragmentShader: HOLO_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
  holo.add(new T.Mesh(g, hm));
  // 投影光束
  const bg = new T.CylinderGeometry(1.4, .2, 3.4, 20, 1, true); bg.translate(0, -2.9, 0);
  const bm = new T.ShaderMaterial({ uniforms: shared(ALLU), vertexShader: HOLO_VS, fragmentShader: `${GL_LIB}
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
  vec3 dif = vec3(0), spc = vec3(0);
  lampGrid(dif, spc, c, normalize(uCam - c), normalize(uCam - c), 4.);
  pointLights(dif, spc, c, normalize(uCam - c), normalize(uCam - c), 4.);
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
  const m = instanced(g, new T.ShaderMaterial({ uniforms: shared(ALLU), vertexShader: STEAM_VS, fragmentShader: STEAM_FS, transparent: true, depthWrite: false }), list, LY.NOREFL);
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
  vec3 dif = vec3(0), spc = vec3(0);
  lampGrid(dif, spc, p, -tc, -tc, 8.);
  pointLights(dif, spc, p, -tc, -tc, 8.);
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
  const m = new T.Mesh(g, new T.ShaderMaterial({ uniforms: { ...shared(ALLU), ...rainU }, vertexShader: RAIN_VS, fragmentShader: RAIN_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
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
  const m = new T.Mesh(g, new T.ShaderMaterial({ uniforms: shared(ALLU), transparent: true, depthWrite: false, blending: T.AdditiveBlending,
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
      vec3 dif = vec3(0), spc = vec3(0); vec3 tc = normalize(uCam - c);
      lampGrid(dif, spc, c + vec3(0,.3,0), tc, tc, 8.);
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
  const m = new T.Mesh(g, new T.ShaderMaterial({ uniforms: shared(ALLU), side: T.BackSide, depthWrite: false,
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
      float star = pow(h21(floor(sc)), 60.) * smoothstep(.45, .1, length(fract(sc) - .5)) * (.6 + .4*sin(uTime*3. + h21(floor(sc) + 3.)*40.));
      clear += vec3(.8, .85, 1.) * star * 3. * smoothstep(.12, .5, h) * smoothstep(-.08, -.22, uSun.y);   // 天全黑了才看得到星星
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
