// ═══ 光格島（外海東南的人工島，10-city.js 的 TRON_SITE）：開船靠北端的碼頭、上岸走進霓虹街區 ═══
// 遠景（far_tron，只有樓與路）由 27-props.js 的 COAST_MODELS 下載；走近 TRON_NEAR 公尺才下載近景 isle_tron（整個街區含長椅、販賣機、樹、停著的車），
// 擺好就把遠景拿掉，走遠再換回來。tools/props.mjs 的 tron 選項（tools/walkgrid.mjs）另外烘了：步行格（isle_tron.walk.bin，每 0.5 m 最多三層站得上去的高度）、
// 車道中心線圖（graph）、販賣機／長椅／樹／路燈／光速機車／水池的位置、上下層街區之間的升降梯（lift）。
// 座標：島的模型座標（原點在島心、+z 朝南，不轉）加上 TRON_SITE 就是 C 區的邏輯座標；高度是模型的 y 加上 TRON_SITE.y（島面，下層街區約 -10 m）。
// 這裡做：碼頭與梯子、20-walk.js 的步行面（樓、牆、護欄靠步行格擋住，樹另外擋）、相機與子彈被樓擋住、21-coast.js 的海面在島上挖掉（下層街區低於海面）、
// 水池的水面、光束、街上跑的光速機車（拖著光牆）與車、騎停著的光速機車（40-people.js 走路時交給 tronRide）、販賣機買飲料回血、坐長椅、升降梯。
// 以檔案開啟沒有島可以上去（島是 21-coast.js 的岩丘替身，31-boats.js 也不擺這裡的船）
const TRON_ZN = ZONES[2], TRON_NEAR = 950;
const TRON = (() => {
  const N = PROPS_SPEC.isle_tron && PROPS_SPEC.isle_tron.items, D = N && N.tron;
  if (!/^https?:$/.test(location.protocol) || !TRON_LAND || !D) return null;   // 和 26-glb.js 的 GLB_ON 一樣（那裡還沒宣告）
  // 車道圖：邊的折線（模型座標 [x, y, z]）與累計長度；adj[節點] = [[邊, 方向]…]
  const G = D.graph || { nodes: [], edges: [] };
  const edges = G.edges.map(([a, b, pts]) => { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2])); return { a, b, pts, L, len: L[L.length - 1] }; });
  const adj = G.nodes.map(() => []);
  edges.forEach((e, i) => { adj[e.a].push([i, 1]); adj[e.b].push([i, -1]); });
  // 樹幹（步行格不算樹，這裡另外擋）：4 m 一格的索引
  const trees = new Map();
  for (const t of D.tree || []) { const k = Math.floor(t[0] / 4) + ',' + Math.floor(t[2] / 4); if (!trees.has(k)) trees.set(k, []); trees.get(k).push(t); }
  const P = TRON_LAND.pier;
  return { S: TRON_SITE, P, D, edges, adj, trees, walk: null, req: false, built: false, near: null, nearOn: false, agents: [], parked: [], uK: { value: 1 },
    ladder: P ? { x: (P.x0 + P.x1) / 2, z: P.z0 } : null, hooked: false, masked: false, hitCd: 0, sold: 0 };
})();
// 島心附近（世界座標）：40-people.js 放寬游泳的範圍
function tronNear(X, Z) { if (!TRON) return false; const [x, z] = toL(X, Z, TRON_ZN); return Math.hypot(x - TRON.S.x, z - TRON.S.z) < 560; }
const tronW = (x, z) => toW(TRON.S.x + x, TRON.S.z + z, TRON_ZN);   // 模型座標 → 世界

// ─── 碼頭：北端那條路的盡頭往北伸 28 m 的棧橋（10-city.js 的 TRON_LAND.pier），樁、繫船柱、青色的邊燈、盡頭的梯子、燈柱與門架 ───
if (TRON && TRON.P) {
  const { S, P } = TRON, k = new Kit(), edge = 0x46e6ff, mag = 0xff3ad0, cx = (P.x0 + P.x1) / 2, w = P.x1 - P.x0, L = P.z1 - P.z0;
  const B = (x, y, z, sx, sy, sz, col, mat = 2) => k.box(S.x + x, S.y + y, S.z + z, sx, sy, sz, col, mat);
  B(cx, -.35, (P.z0 + P.z1) / 2, w, .7, L, 0x2a2d33);                                    // 橋面（頂在島面）
  for (let z = P.z0 + 1.5; z < P.z1 - 2; z += 6) for (const x of [P.x0 + .6, P.x1 - .6]) B(x, -4, z, .7, 7, .7, 0x16181c);   // 樁
  for (const x of [P.x0 + .12, P.x1 - .12]) B(x, .04, (P.z0 + P.z1) / 2, .12, .08, L - .6, edge, 8);   // 兩側的邊燈
  B(cx, .04, P.z0 + .12, w - .6, .08, .12, edge, 8);
  for (let z = P.z0 + 4; z < P.z1 - 3; z += 8) { B(P.x1 - .45, .3, z, .35, .6, .35, 0x0c0d10); B(P.x1 - .45, .62, z, .4, .06, .4, mag, 8); }   // 繫船柱
  // 盡頭的梯子（從海裡爬上來）：兩根扶手、橫桿
  const lx = TRON.ladder.x, lz = TRON.ladder.z - .15;
  for (const s of [-.35, .35]) B(lx + s, -1.2, lz, .06, 2.6, .06, 0x8a9096, 15);
  for (let y = -2.2; y < .1; y += .32) B(lx, y, lz, .76, .05, .05, 0x8a9096, 15);
  // 燈柱：兩側各兩支，夜裡照亮橋面（60-venues.js 把 signLights 複製成 outLights 之前加，世界座標）
  for (const z of [P.z0 + 3, P.z0 + 16]) for (const x of [P.x0 + .5, P.x1 - .5]) {
    B(x, 2.2, z, .16, 4.4, .16, 0x111317); B(x, 4.45, z, .5, .12, .5, 0xc8f6ff, 8);
    const [X, Z] = tronW(x, z); signLights.push({ x: X, y: S.y + 4.2, z: Z, col: lin(0xa8ecff), r: 13, i: 1.1, w: 1 });
  }
  // 入口的門架
  for (const x of [P.x0 + .25, P.x1 - .25]) { B(x, 2.6, P.z1 - 1, .3, 5.2, .3, 0x101215); B(x, 2.6, P.z1 - 1.17, .06, 5, .04, edge, 8); }
  B(cx, 5.1, P.z1 - 1, w, .5, .3, 0x101215); B(cx, 5.1, P.z1 - 1.17, w - 1.4, .22, .02, mag, 8);
  cityAdd(new T.Mesh(k.build(), MAT.uber), TRON_ZN);
}
// 路燈（原檔的 PF_LampPost）：夜裡在燈頭補一盞點光
if (TRON) for (const [x, y, z, , , , h] of TRON.D.lamp || []) { const [X, Z] = tronW(x, z); signLights.push({ x: X, y: TRON.S.y + y + h - .4, z: Z, col: lin(0x9fe8ff), r: 15, i: 1.2, w: 1 }); }

// ─── 步行格（20-walk.js）：模型座標的格子查站得上去的高度（分米） ───
const TRON_NONE = -32768;
function tronCell(x, z) { const W = TRON.walk; if (!W) return -1; const i = Math.floor((x - W.x0) / W.res), j = Math.floor((z - W.z0) / W.res); return i < 0 || j < 0 || i >= W.nx || j >= W.nz ? -1 : j * W.nx + i; }
const tronTree = (x, z, y0) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const t of TRON.trees.get((Math.floor(x / 4) + i) + ',' + (Math.floor(z / 4) + j)) || []) if (Math.hypot(t[0] - x, t[2] - z) < .5 && Math.abs(t[1] - y0) < 2) return true; return false; };
// 站在 (x, z)、現在的高度 y0（都是模型座標）：回傳站的高度，null 是擋住，undefined 是海（照 seaFloor）。cam：相機問的地板（不擋）
function tronY(x, z, y0, cam) {
  const { P, ladder } = TRON, swim = y0 < SEA_Y - TRON.S.y - .3;
  if (P && x >= P.x0 && x <= P.x1 && z >= P.z0 && z <= P.z1) {   // 碼頭：游泳的人只能從梯子上來
    if (cam || !swim || Math.hypot(x - ladder.x, z - ladder.z) < 1.4) return 0;
    return null;
  }
  const land = tronLandL(x, z), k = tronCell(x, z);
  if (!land && (k < 0 || TRON.walk.L[0][k] === TRON_NONE)) {   // 海：走路的人不會從岸邊掉下去（碼頭盡頭的梯子除外），游泳照海面
    if (cam || swim) return undefined;
    return ladder && Math.hypot(x - ladder.x, z - ladder.z + .6) < 1.2 ? undefined : null;
  }
  if (k < 0) return cam ? 0 : swim ? null : 0;   // 近景還沒下載：島面當成平的，游泳的人被岸壁擋住
  const L = TRON.walk.L, top = y0 * 10 + 5.5;
  let best = TRON_NONE, low = TRON_NONE;
  for (let n = 0; n < L.length; n++) { const v = L[n][k]; if (v === TRON_NONE) break; if (low === TRON_NONE) low = v; if (v <= top && v > best) best = v; }
  if (low === TRON_NONE) return cam ? undefined : null;   // 樓裡、牆
  if (best === TRON_NONE) return cam ? low / 10 : null;   // 太高：樓的基座、花台
  if (cam) return best / 10;
  if (y0 * 10 - best > 35) return null;                    // 比現在低 3.5 m 以上：不從邊上跳下去（下層街區搭升降梯）
  if (tronTree(x, z, best / 10)) return null;
  return best / 10;
}
// (x, z) 在 y 這個高度是不是空的（相機與子彈，模型座標）：有站得上去的層不高於 y，或是海
function tronOpen(x, z, y) {
  const k = tronCell(x, z), P = TRON.P; if (k < 0) return true;
  if (P && x >= P.x0 && x <= P.x1 && z >= P.z0 && z <= P.z1) return y > -.1;   // 碼頭（步行格沒有它）
  const L = TRON.walk.L, v0 = L[0][k];
  if (v0 === TRON_NONE) return !tronLandL(x, z);
  for (let n = 0; n < L.length; n++) { const v = L[n][k]; if (v === TRON_NONE) break; if (v <= y * 10 + 2) return true; }
  return false;
}
if (TRON) {
  const { S, P, D } = TRON, L = TRON_LAND, W = D.walk;
  WALKS.push({
    zn: TRON_ZN,
    bb: [S.x + Math.min(L.x0, W.x0) - 2, S.x + Math.max(L.x0 + L.nx * L.res, W.x0 + W.nx * W.res) + 2, S.z + Math.min(L.z0, W.z0, P ? P.z0 : 1e9) - 3, S.z + Math.max(L.z0 + L.nz * L.res, W.z0 + W.nz * W.res) + 2],
    y: (x, z, y0, cam) => { const y = tronY(x - S.x, z - S.z, y0 - S.y, cam); return y == null ? y : y + S.y; },
    // 相機：從角色往相機那點走，碰到比腳高 1.6 m 還高的牆就停在牆前
    clampCam: (x, z, y0) => {
      if (!TRON.walk || !TRON.nearOn) return null;
      const [px, pz] = toL(player.x, player.z, TRON_ZN), ax = px - S.x, az = pz - S.z, bx = x - S.x, bz = z - S.z, n = Math.ceil(Math.hypot(bx - ax, bz - az) / .4);
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        if (!tronOpen(ax + (bx - ax) * t, az + (bz - az) * t, y0 - S.y + 1.6)) { const u = Math.max(0, (i - 1.5) / n); return [S.x + ax + (bx - ax) * u, S.z + az + (bz - az) * u]; }
      }
      return null;
    },
  });
}

// ─── 下載與擺放 ───
function tronLoad() {
  const T0 = TRON; T0.req = true;
  const walk = fetch(PROP_BASE + T0.D.walk.file).then(r => { if (!r.ok) throw new Error(r.status); return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(); }).then(buf => {
    const n = new DataView(buf).getUint32(0, true), head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, n))), N = head.nx * head.nz, L = [];
    for (let i = 0; i < head.layers; i++) L.push(new Int16Array(buf, 4 + n + i * N * 2, N));
    return { ...head, L };
  });
  Promise.all([loadProps('isle_tron'), walk]).then(([items, W]) => { if (items && items.tron) tronBuild(items, W); }, e => console.warn('光格島近景下載失敗', e));
}
// 光速機車的亮線（原檔的光速機車沒有自發光）：兩個輪圈、車身上緣一條，顏色照車
function tronGlow(col) {
  const k = new Kit(), it = TRON.items.cycle, h = it.h, r = h * .47, zc = it.d / 2 - r - .05;
  for (const z of [-zc, zc]) k.add(new T.TorusGeometry(r, .035, 6, 28), col, 8, tf(0, r + .02, z, 0, Math.PI / 2, 0));
  k.box(0, h * .86, 0, .05, .04, it.d * .45, col, 8);
  return new T.Mesh(k.build(), MAT.uber);
}
function tronBuild(items, W) {
  const T0 = TRON, S = T0.S, g = new T.Group();
  T0.walk = W; T0.items = items;
  g.add(propObject(items.tron, S.x, S.y, S.z, 0));
  // 光束（原檔的 GodRay）：加亮、往上淡掉，夜裡比較亮
  if (items.beam) {
    const m = new T.ShaderMaterial({
      uniforms: { uTime: U.uTime, uK: T0.uK, uY: { value: items.beam.h } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
      // 正對著看最亮、看到側邊淡掉（像一道體積光），近看也淡掉，不會糊成一片白
      vertexShader: 'varying vec3 vW, vN; varying float vH; uniform float uY; void main(){ vH = position.y / uY; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform float uTime, uK; varying vec3 vW, vN; varying float vH; void main(){ vec3 v = normalize(cameraPosition - vW); float f = (1. - smoothstep(.0, 1., vH)) * smoothstep(-.05, .08, vH) * pow(abs(dot(normalize(vN), v)), 2.); float d = length(vW - cameraPosition); float fl = .85 + .15 * sin(uTime * 3.1 + vW.x * .2); gl_FragColor = vec4(vec3(.3, .8, 1.) * f * fl * (.04 + .12 * uK) * smoothstep(3., 25., d), 1.); }',
    });
    for (const p of items.beam.parts) { const o = new T.Mesh(p.geo, m); o.position.set(S.x, S.y, S.z); o.renderOrder = 3; g.add(o); }
  }
  // 水池（原檔的 Water_Plane）：起波紋、映著青色霓虹的水面
  if (T0.D.pool) {
    const m = new T.ShaderMaterial({
      uniforms: { uTime: U.uTime, uK: T0.uK },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float uTime, uK; varying vec3 vW;
        void main(){
          vec2 p = vW.xz; float t = uTime;
          vec2 n = vec2(sin(p.x * 3.1 + t * 1.7) + sin(p.y * 2.3 - t * 1.3 + p.x), cos(p.y * 3.4 + t * 1.9) + sin(p.x * 2.7 + t * 1.1)) * .12;
          vec3 v = normalize(cameraPosition - vW), N = normalize(vec3(n.x, 1., n.y));
          float fr = pow(1. - max(dot(N, v), 0.), 3.);
          float c = pow(abs(sin((p.x + n.x * 3.) * 2.2) * sin((p.y + n.y * 3.) * 2.2)), 8.);
          gl_FragColor = vec4(vec3(.004, .018, .026) + vec3(.2, .7, 1.) * (fr * (.25 + .6 * uK) + c * (.05 + .35 * uK)), 1.);
        }`,
    });
    for (const [x, y, z, yaw, l, w] of T0.D.pool) { const pg = new T.PlaneGeometry(w, l); pg.rotateX(-Math.PI / 2); const o = new T.Mesh(pg, m); o.position.set(S.x + x, S.y + y + .02, S.z + z); o.rotation.y = yaw; g.add(o); }
  }
  // 停著的光速機車：原檔停在人行道的車格裡，前後都被路緣的燈條擋住騎不出去，改停到附近車道的路邊（離中心線 4 m、順著右側車流），
  // 停不下的照原檔的位置；原檔有疊在一起的重複件，1.2 m 內只擺一台。走近按 F 騎上去
  const cols = [0x3ae8ff, 0xff8a2a, 0xff3ad0, 0x9dff4a];
  if (items.cycle) for (let [x, y, z, yaw] of T0.D.cycle) {
    const q = tronCurb(x, z, y);
    if (q) [x, y, z, yaw] = q;
    if (T0.parked.some(c => Math.hypot(c.x - x, c.z - z) < 1.2 && Math.abs(c.y - y) < 1)) continue;
    const col = cols[T0.parked.length % 4], o = propObject(items.cycle, S.x + x, S.y + y, S.z + z, yaw); o.add(tronGlow(col)); g.add(o);
    T0.parked.push({ x, y, z, yaw, obj: o, v: 0, lean: 0, col, trail: null });
  }
  // 街上跑的：五台光速機車拖著光牆、三台車照右邊車道開
  const r = rng(2468), cars = ['car_conv', 'car_pod', 'car_tuc'].filter(k => items[k]);
  if (T0.edges.length) for (let i = 0; i < 8; i++) { const id = i < 5 ? 'cycle' : cars[i % cars.length]; if (id && items[id]) T0.agents.push(tronAgent(id, r, cols[i % 4], g)); }
  T0.near = g; T0.built = true;
}

// (x, z) 附近 40 m 內最近的車道：回傳路邊的停車位置 [x, y, z, yaw]（前後 12 m 都騎得過去才算）
function tronCurb(x, z, y0) {
  let best = null, bd = 40;
  for (const E of TRON.edges) for (let i = 1; i < E.pts.length; i++) {
    const p = E.pts[i - 1], q = E.pts[i], dx = q[0] - p[0], dz = q[2] - p[2], l2 = dx * dx + dz * dz; if (l2 < 1e-6 || Math.abs(p[1] - y0) > 2) continue;
    const t = clamp(((x - p[0]) * dx + (z - p[2]) * dz) / l2, 0, 1), px = p[0] + dx * t, pz = p[2] + dz * t, d = Math.hypot(x - px, z - pz);
    if (d < bd) { bd = d; best = { px, pz, py: p[1] + (q[1] - p[1]) * t, dx, dz, l: Math.sqrt(l2), s: (x - px) * -dz + (z - pz) * dx >= 0 ? 1 : -1 }; }
  }
  if (!best) return null;
  const { px, pz, py, dx, dz, l, s } = best, fx = dx / l * s, fz = dz / l * s, cx = px - fz * 4, cz = pz + fx * 4;   // 右手邊（-fz, fx）
  for (const d of [-12, -6, 0, 6, 12]) if (tronY(cx + fx * d, cz + fz * d, py) == null) return null;
  return [cx, py, cz, Math.atan2(fx, fz)];
}
// ─── 車道上的車：沿邊的折線走，到節點挑下一條（不迴轉，死路才掉頭）；位置偏到行進方向的右邊 lane 公尺 ───
function tronAgent(id, r, col, g) {
  const T0 = TRON, cyc = id === 'cycle', e = Math.floor(r() * T0.edges.length), obj = propObject(T0.items[id], 0, 0, 0, 0);
  if (cyc) obj.add(tronGlow(col));
  g.add(obj);
  const a = { id, cyc, e, dir: r() < .5 ? 1 : -1, s: r() * T0.edges[e].len, v: 0, vmax: cyc ? 18 + r() * 8 : 8 + r() * 4, lane: cyc ? (r() < .5 ? 1.2 : 3.2) : 2.4, obj, x: 0, y: 0, z: 0, yaw: 0, trail: cyc ? tronTrail(col, g) : null };
  tronAgentPos(a); a.x = a.tx; a.y = a.ty; a.z = a.tz; a.yaw = Math.atan2(a.fx, a.fz);
  return a;
}
// a.s 在邊上的位置（含右偏）：tx, ty, tz 與前進方向 fx, fz
function tronAgentPos(a) {
  const E = TRON.edges[a.e], s = a.dir > 0 ? a.s : E.len - a.s;
  let lo = 0, hi = E.L.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (E.L[m] <= s) lo = m; else hi = m; }
  const p = E.pts[lo], q = E.pts[hi], l = E.L[hi] - E.L[lo] || 1, t = clamp((s - E.L[lo]) / l, 0, 1);
  const fx = (q[0] - p[0]) / l * a.dir, fz = (q[2] - p[2]) / l * a.dir;
  a.fx = fx; a.fz = fz;
  a.tx = p[0] + (q[0] - p[0]) * t - fz * a.lane; a.tz = p[2] + (q[2] - p[2]) * t + fx * a.lane; a.ty = p[1] + (q[1] - p[1]) * t;
}
function tronAgentNext(a, r) {
  const T0 = TRON, E = T0.edges[a.e], node = a.dir > 0 ? E.b : E.a, opts = T0.adj[node].filter(([i]) => i !== a.e);
  const [i, d] = opts.length ? opts[Math.floor(r() * opts.length)] : [a.e, -a.dir];
  a.e = i; a.dir = d; a.s = 0;
}
// 光牆：最近 TRAIL_N 個點（每 0.6 m 一點）拉成一片 0.9 m 高的帶子，越舊越淡（世界座標，不跟著區轉：點本身已經是世界座標）
const TRAIL_N = 90;
function tronTrail(col, g) {
  const pos = new Float32Array(TRAIL_N * 6), age = new Float32Array(TRAIL_N * 2), idx = [];
  for (let i = 0; i < TRAIL_N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('age', new T.BufferAttribute(age, 1)); geo.setIndex(idx);
  const m = new T.ShaderMaterial({
    uniforms: { uCol: { value: lin(col) }, uK: TRON.uK }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    vertexShader: 'attribute float age; varying float vA; void main(){ vA = age; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'uniform vec3 uCol; uniform float uK; varying float vA; void main(){ gl_FragColor = vec4(uCol * (1. - vA) * (1.2 + 1.4 * uK), 1.); }',
  });
  const mesh = new T.Mesh(geo, m); mesh.frustumCulled = false; scene.add(mesh); mesh.visible = false;
  return { pts: [], geo, pos, age, mesh };
}
// 把一點（模型座標）推進光牆：距離上一點 0.6 m 以上才加新的一點；畫的時候換成世界座標
function trailPush(tr, x, y, z) {
  const P = tr.pts, b = P[P.length - 2];   // 最後一點跟著車走，離前一點超過 0.6 m 就留下來、再開一個新的頭
  if (P.length < 2) P.push([x, y, z], [x, y, z]);
  else if (Math.hypot(x - b[0], z - b[2]) > .6) { P.push([x, y, z]); if (P.length > TRAIL_N) P.shift(); }
  else P[P.length - 1] = [x, y, z];
  const n = P.length, S = TRON.S;
  for (let i = 0; i < TRAIL_N; i++) {
    const p = P[Math.max(0, n - 1 - i)], [X, Z] = tronW(p[0], p[2]);
    tr.pos.set([X, S.y + p[1] + .08, Z, X, S.y + p[1] + .95, Z], i * 6);
    const a = i < n ? i / (TRAIL_N - 1) : 1; tr.age[i * 2] = a; tr.age[i * 2 + 1] = a;
  }
  tr.geo.attributes.position.needsUpdate = true; tr.geo.attributes.age.needsUpdate = true;
  tr.mesh.visible = TRON.nearOn;
}

// ─── 每幀 ───
function tronUpdate(dt) {
  if (!TRON) return;
  const T0 = TRON, S = T0.S;
  if (!T0.hooked && typeof ctxHooks !== 'undefined') { T0.hooked = true; tronHooks(); }
  if (!T0.masked) {   // 21-coast.js 的海面：島上不畫（世界 → 模型座標的仿射、陸地遮罩）
    T0.masked = true;
    const L = TRON_LAND, [ox, oz] = toL(0, 0, TRON_ZN), [ax, az] = toL(1, 0, TRON_ZN), [bx, bz] = toL(0, 1, TRON_ZN), u = MAT_WATER.uniforms;
    const tex = new T.DataTexture(L.a.map(v => v * 255), L.nx, L.nz, T.RedFormat); tex.unpackAlignment = 1; tex.needsUpdate = true;
    u.tTron.value = tex; u.uTronA.value.set(ax - ox, bx - ox, ox - S.x); u.uTronB.value.set(az - oz, bz - oz, oz - S.z); u.uTronG.value.set(L.x0, L.z0, L.nx * L.res, L.nz * L.res);
  }
  const [px, pz] = toL(pX(), pZ(), TRON_ZN), d = Math.hypot(px - S.x, pz - S.z);
  if (!T0.req && d < TRON_NEAR) tronLoad();
  T0.uK.value = atm.lamp;
  // 近景與遠景互換：近景在 TRON_NEAR + 150 內才放進場景
  if (T0.built) {
    const on = d < TRON_NEAR + 150;
    if (on !== T0.nearOn) {
      T0.nearOn = on;
      const far = COAST_MODELS.find(o => o.id === 'tron');
      if (on) { cityAdd(T0.near, TRON_ZN); if (far && far.obj) far.obj.removeFromParent(); }
      else { T0.near.removeFromParent(); if (far && far.obj) cityAdd(far.obj, TRON_ZN); }
      for (const a of T0.agents) if (a.trail) a.trail.mesh.visible = on;
    }
  }
  if (!T0.nearOn) return;
  const mx = px - S.x, mz = pz - S.z, my = player.y - S.y, onFoot = player.mode === 'walk' && !player.ride;
  for (const a of T0.agents) {
    // 前面有人（右偏的車道上、十幾公尺內）就停下來等
    const dx = mx - a.x, dz = mz - a.z, ahead = dx * a.fx + dz * a.fz, side = Math.abs(-dx * a.fz + dz * a.fx);
    const block = player.mode === 'walk' && ahead > 0 && ahead < (a.cyc ? 14 : 10) && side < 2.2 && Math.abs(my - a.y) < 2;
    a.v = damp(a.v, block ? 0 : a.vmax, block ? 4 : 1.2, dt);
    a.s += a.v * dt;
    while (a.s > T0.edges[a.e].len) { const over = a.s - T0.edges[a.e].len; tronAgentNext(a, Math.random); a.s = Math.min(over, T0.edges[a.e].len); }
    tronAgentPos(a);
    const k = 1 - Math.exp(-(a.cyc ? 9 : 6) * dt);
    a.x += (a.tx - a.x) * k; a.y += (a.ty - a.y) * k; a.z += (a.tz - a.z) * k;
    a.yaw += wrapA(Math.atan2(a.fx, a.fz) - a.yaw) * (1 - Math.exp(-(a.cyc ? 10 : 5) * dt));
    a.obj.position.set(S.x + a.x, S.y + a.y, S.z + a.z); a.obj.rotation.y = a.yaw;
    if (a.trail) trailPush(a.trail, a.x - Math.sin(a.yaw) * 1.1, a.y, a.z - Math.cos(a.yaw) * 1.1);
    // 撞到走路的人：撞倒（停下來等的不會）
    if (onFoot && a.v > 4 && Math.hypot(dx, dz) < (a.cyc ? 1.3 : 2.1) && Math.abs(my - a.y) < 1.5 && T0.hitCd <= 0) {
      T0.hitCd = 1.5; const [kx, kz] = dirW(TRON_ZN, a.fx, a.fz); knockPlayer(kx, kz); hurtPlayer(a.cyc ? 20 : 30, player.x - kx, player.z - kz); sfx.impact(8);
    }
  }
  if (T0.hitCd > 0) T0.hitCd -= dt;
}

// ─── 騎光速機車（40-people.js 的 updatePlayerWalk 交給這裡）：W 加速、S 煞車倒退、A／D 轉向，撞到牆停下來；F 下車。坐長椅也在這裡（一動就站起來） ───
const CYC = { vmax: 42, acc: 14, brk: 26, turn: 2.3 };
function tronRide(inp, dt, camYaw) {
  const R = player.ride, T0 = TRON, S = T0.S;
  if (R.tron === 'sit') {
    if (Math.hypot(inp.mx, inp.mz) > .3) { player.ride = null; return; }
    if (player.anim !== ANIM.sit) { player.prevAnim = player.anim; player.anim = ANIM.sit; player.blend = 1; }
    player.blend = Math.max(0, player.blend - dt * 4); player.v = 0;
    me.anim(0, ANIM.sit, -uTimeNow(), 1, 0); me.anim2(0, player.prevAnim, player.blend, 1);
    me.place(0, player.x, player.y, player.z, player.yaw); me.flush();
    return;
  }
  const c = R.cyc;
  c.v += (inp.thr * CYC.acc * (1 - Math.max(0, c.v) / CYC.vmax) - inp.brk * (c.v > .5 ? CYC.brk : c.v > -8 ? 6 : 0)) * dt;
  c.v -= c.v * .15 * dt;
  if (!inp.thr && !inp.brk && Math.abs(c.v) < .3) c.v = 0;
  c.yaw += inp.steer * CYC.turn * clamp(Math.abs(c.v) / 6, .3, 1) * Math.sign(c.v || 1) * (1 - clamp(Math.abs(c.v) / 90, 0, .45)) * dt;
  c.lean = damp(c.lean, -inp.steer * clamp(Math.abs(c.v) / 20, 0, 1) * .45, 6, dt);
  const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), sg = Math.sign(c.v || 1), nx = c.x + fx * c.v * dt, nz = c.z + fz * c.v * dt;
  // 新位置與車頭那一點（1.2 m 前）都要站得上去；擋住就撞停（游泳的海面也不行）
  const yF = tronY(nx + fx * 1.2 * sg, nz + fz * 1.2 * sg, c.y), y = tronY(nx, nz, c.y);
  if (yF == null || y == null) {
    if (Math.abs(c.v) > 6) { sfx.impact(clamp(Math.abs(c.v) / 2, 3, 14)); camState.shake = Math.min(1, Math.abs(c.v) / 25); const [X, Z] = tronW(c.x + fx, c.z + fz); sparks(X, S.y + c.y + .6, Z, 10, 4); }
    c.v = -c.v * .15;
  } else { c.x = nx; c.z = nz; c.y = damp(c.y, y, 14, dt); }
  for (const a of T0.agents) if (Math.hypot(a.x - c.x, a.z - c.z) < (a.cyc ? 1.6 : 2.4) && Math.abs(a.y - c.y) < 1.5 && Math.abs(c.v) > 3) { sfx.impact(6); c.v *= -.2; a.v = 0; }
  const [X, Z] = tronW(c.x, c.z);
  player.x = X; player.z = Z; player.y = S.y + c.y; player.yaw = yawW(TRON_ZN, c.yaw); player.v = 0;
  c.obj.position.set(S.x + c.x, S.y + c.y, S.z + c.z); c.obj.rotation.set(0, c.yaw, c.lean, 'YXZ');
  if (!c.trail) c.trail = tronTrail(c.col, T0.near);
  trailPush(c.trail, c.x - fx * 1.1, c.y, c.z - fz * 1.1);
  if (SET.recenter && camState.idle > 1.2 && Math.abs(c.v) > 2) camState.yaw += wrapA(player.yaw - camState.yaw) * (1 - Math.exp(-3 * dt));
  // 騎姿：和機車一樣的 Driving_Loop（40-people.js 的 ANIM.ride 改成前傾、手伸向把手），跟著車身壓車
  if (player.anim !== ANIM.ride) { player.prevAnim = player.anim; player.anim = ANIM.ride; player.blend = 1; }
  me.anim(0, ANIM.ride, 0, 1); me.anim2(0, 0, 0);
  const m = new T.Matrix4().compose(V3(X, player.y, Z), new T.Quaternion().setFromEuler(new T.Euler(0, player.yaw, c.lean, 'YXZ')), V3(1, 1, 1));
  m.multiply(new T.Matrix4().makeTranslation(0, TRON_SEAT[0], TRON_SEAT[1]));
  me.placeM(0, m); me.flush();
}
const TRON_SEAT = [.05, -.05];   // 騎姿的原點在車上的位置（高、前後），和 99-main.js 的 placeRider 一樣的意思
function tronMount(c) {
  // 原檔的朝向只知道長邊：車頭前面被花台、長椅擋住而車尾那邊是空的，就掉頭停（騎上去直接往空的那邊走）
  const open = sg => [.6, 1, 1.4, 1.8, 2.4].every(d => tronY(c.x + Math.sin(c.yaw) * d * sg, c.z + Math.cos(c.yaw) * d * sg, c.y) != null);
  if (!open(1) && open(-1)) { c.yaw = wrapA(c.yaw + Math.PI); c.obj.rotation.set(0, c.yaw, 0); }
  player.ride = { tron: 'cycle', cyc: c }; c.v = 0; c.lean = 0; player.crouch = false; gta.aiming = false;
  sfx.zap(); toast('W 加速 · S 煞車 · A／D 轉向 · F 下車');
}
function tronDismount() {
  const c = player.ride.cyc, S = TRON.S, sx = Math.cos(c.yaw), sz = -Math.sin(c.yaw);   // 車身左邊
  player.ride = null; c.v = 0; c.obj.rotation.set(0, c.yaw, 0);
  for (const s of [1, -1, 2, -2]) { const x = c.x + sx * s * 1.1, z = c.z + sz * s * 1.1, y = tronY(x, z, c.y); if (y != null) { const [X, Z] = tronW(x, z); player.x = X; player.z = Z; player.y = S.y + y; break; } }
  player.anim = ANIM.idle;
}

// ─── 互動：停著的光速機車、販賣機、長椅、升降梯；子彈打到樓 ───
function tronHooks() {
  const T0 = TRON, S = T0.S;
  ctxHooks.push(p => {
    if (!T0.nearOn || p.where !== 'out' || !T0.walk) return null;
    if (p.ride && p.ride.tron === 'cycle') return Math.abs(p.ride.cyc.v) < 4 ? { key: 'F', text: '下車 <i>· 光速機車</i>', fn: tronDismount } : null;
    if (p.mode !== 'walk' || p.ride || p.swim || p.down > 0) return null;
    const [lx, lz] = toL(p.x, p.z, TRON_ZN), x = lx - S.x, z = lz - S.z, y = p.y - S.y, D = T0.D;
    for (const c of T0.parked) if (Math.hypot(c.x - x, c.z - z) < 2 && Math.abs(c.y - y) < 1.5) return { key: 'F', text: '騎上光速機車', fn: () => tronMount(c) };
    for (const v of D.vend || []) if (Math.hypot(v[0] - x, v[2] - z) < 1.8 && Math.abs(v[1] - y) < 1.5)
      return { key: 'E', text: '買一罐光能飲料 <i>· $20，回 35 點生命</i>', fn: () => {
        if (motors.cash < 20) { toast('錢不夠'); sfx.dry(); return; }
        motors.cash -= 20; saveMotors(); life.hp = Math.min(life.max, life.hp + 35); T0.sold++;
        sfx.pickup(); toast('喀啷——罐子滾出來，青色的汽水有點像電池的味道');
      } };
    for (const b of D.bench || []) if (Math.hypot(b[0] - x, b[2] - z) < 1.3 && Math.abs(b[1] - y) < 1.2) return { key: 'E', text: '坐一下', fn: () => tronSit(b) };
    if (D.lift) for (const [k, L] of D.lift.entries()) if (Math.hypot(L[0] - x, L[2] - z) < 2.5 && Math.abs(L[1] - y) < 1.5)
      return { key: 'E', text: k ? '搭升降梯 <i>· 回到上層街道</i>' : '搭升降梯 <i>· 下層街區</i>', fn: () => transition(() => { const o = D.lift[1 - k], [X, Z] = tronW(o[0], o[2]); player.x = X; player.z = Z; player.y = S.y + o[1]; camState.snap = true; }) };
    return null;
  });
  rayHooks.push((R, hit) => {
    if (!T0.nearOn || !T0.walk) return;
    const [ox, oz] = toL(R.ox, R.oz, TRON_ZN), [dx, dz] = dirL(TRON_ZN, R.dx, R.dz);
    if (Math.hypot(ox - S.x, oz - S.z) > 520) return;
    for (let t = .5; t < 160; t += .5) if (!tronOpen(ox - S.x + dx * t, oz - S.z + dz * t, R.oy + R.dy * t - S.y)) { hit(t, 'wall', null); return; }
  });
}
// 坐長椅：面向最近的車道（長椅都在人行道上），坐在椅面中間
function tronSit(b) {
  const T0 = TRON, S = T0.S, [x, y, z, yaw] = b;
  let best = null, bd = 1e9;
  for (const E of T0.edges) for (const p of E.pts) { const d = Math.hypot(p[0] - x, p[2] - z); if (d < bd) { bd = d; best = p; } }
  let f = yaw + Math.PI / 2;
  if (best && Math.sin(f) * (best[0] - x) + Math.cos(f) * (best[2] - z) < 0) f += Math.PI;
  const [X, Z] = tronW(x - Math.sin(f) * .1, z - Math.cos(f) * .1);
  player.x = X; player.z = Z; player.y = S.y + y; player.yaw = yawW(TRON_ZN, f); player.v = 0;
  player.ride = { tron: 'sit' };
}
const tronApi = {
  get T() { return TRON; },
  y: (x, z, y0) => tronY(x, z, y0), open: (x, z, y) => tronOpen(x, z, y), W: (x, z) => tronW(x, z), land: (x, z) => tronLandL(x, z),
  mount: i => tronMount(TRON.parked[i]), sit: i => tronSit(TRON.D.bench[i]), dismount: () => player.ride && player.ride.tron === 'cycle' && tronDismount(),
};
