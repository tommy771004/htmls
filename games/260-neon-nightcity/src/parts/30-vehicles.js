
// ═══ 車輛：程序建模、車流 AI、路邊停車、玩家座駕物理 ═══
// 側面輪廓（z 為車長方向、y 為高度）沿寬度擠出，再把上半部往內收
await bootStep(BOOT.vehicles, '車流上路…');
function sideExtrude(kit, pts, width, color, mat, taper, bevel = .035, matrix) {
  const sh = new T.Shape(pts.map(([z, y]) => new T.Vector2(z, y)));
  const d = width - bevel * 2;
  const g = new T.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1, curveSegments: 4 });
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const sx = p.getX(i), sy = p.getY(i); let x = -(p.getZ(i) - d / 2);
    if (taper) x *= taper(sy, sx);
    p.setXYZ(i, x, sy, sx);
  }
  g.computeVertexNormals();
  kit.add(g, color, mat, matrix);
}
const arch = (zc, yc, r, n = 7) => Array.from({ length: n + 1 }, (_, k) => { const a = Math.PI - k / n * Math.PI; return [zc + Math.cos(a) * r, yc + Math.sin(a) * r]; });
function wheel(kit, x, y, z, r, w, rimCol = 0x9aa0a6, spokes = 6) {
  kit.cyl(x, y, z, r, r, w, 18, 0x121212, 6, 0, 0, Math.PI / 2);
  const s = Math.sign(x) || 1;
  kit.cyl(x + s * (w / 2 - .01), y, z, r * .66, r * .66, .03, 16, 0x26282b, 2, 0, 0, Math.PI / 2);
  for (let k = 0; k < spokes; k++) { const a = k / spokes * Math.PI * 2; kit.box(x + s * (w / 2 + .005), y, z, .03, r * 1.15, .06, rimCol, 7, a, 0, 0); }
  kit.cyl(x + s * (w / 2 + .01), y, z, r * .16, r * .16, .04, 10, rimCol, 7, 0, 0, Math.PI / 2);
}
const wheelGeo = (r, w, rimCol) => { const k = new Kit(); wheel(k, w / 2, 0, 0, r, w, rimCol); return k.build(); };

// Kestrel：楔形跑車，可升降頭燈、後擋百葉、整條尾燈
function kestrelKit(paint = 0x4a5058, withWheels = false) {
  const k = new Kit();
  const body = [[2.2, .27], [2.26, .47], [2.06, .58], [.86, .8], [-.92, .83], [-1.98, .9], [-2.17, .88], [-2.17, .36], [-1.84, .27],
    ...arch(-1.35, .33, .45), [-.88, .27], [.88, .27], ...arch(1.35, .33, .45), [1.84, .27]];
  sideExtrude(k, body, 1.9, paint, 0, (y) => 1 - sstep(.6, .9, y) * .05);
  sideExtrude(k, [[.88, .8], [.08, 1.13], [-.6, 1.14], [-1.02, .96], [-1.02, .81]], 1.62, 0x0a0c10, 1, (y) => 1 - sstep(.8, 1.14, y) * .22, .02);
  k.box(0, 1.142, -.28, 1.2, .03, .62, paint, 0);
  for (let i = 0; i < 6; i++) { const z = -1.12 - i * .15, y = .955 - i * .011; k.box(0, y, z, 1.45, .025, .09, 0x0e0f11, 2, -.07); }   // 引擎蓋百葉，貼著車尾斜面
  k.box(0, .52, 2.2, 1.55, .05, .05, 0xf4f1e8, 4);
  for (const s of [-1, 1]) { k.box(s * .62, .63, 1.98, .36, .05, .22, 0x2a2d31, 0); k.box(s * .62, .62, 2.1, .32, .045, .02, 0xf4f1e8, 4); }
  k.box(0, .7, -2.18, 1.66, .07, .03, 0xff1a24, 5);
  for (const s of [-1, 1]) k.box(s * .58, .57, -2.18, .32, .1, .03, 0xff1a24, 5);
  k.box(0, .34, -2.15, 1.5, .14, .06, 0x0d0e10, 2);
  k.box(0, .3, 2.2, 1.6, .1, .08, 0x0d0e10, 2);
  for (const s of [-1, 1]) { k.box(s * .96, .32, 0, .03, .08, 1.7, 0x0d0e10, 2); k.box(s * .93, .86, .72, .1, .07, .14, paint, 0); }
  if (withWheels) for (const s of [-1, 1]) for (const z of [-1.35, 1.35]) wheel(k, s * .82, .34, z, .34, .26);
  return k;
}
// 八〇年代三廂房車，計程車與警車共用
function sedanKit(kind, withWheels = true) {
  const k = new Kit();
  const paint = kind === 'taxi' ? 0xf2b41a : kind === 'police' ? 0x1b1e24 : 0x888888;
  const body = [[2.42, .32], [2.46, .7], [2.22, .79], [.78, .86], [-1.56, .9], [-2.36, .92], [-2.46, .88], [-2.46, .38], [-1.96, .31],
    ...arch(-1.45, .36, .44), [-1.0, .31], [1.0, .31], ...arch(1.45, .36, .44), [1.96, .31]];
  sideExtrude(k, body, 1.86, paint, 0, (y) => 1 - sstep(.7, .92, y) * .03);
  sideExtrude(k, [[.78, .86], [.12, 1.36], [-1.08, 1.38], [-1.62, .91]], 1.64, 0x090b0e, 1, (y) => 1 - sstep(.9, 1.38, y) * .12, .02);
  k.box(0, 1.385, -.47, 1.34, .03, 1.1, paint, 0);
  for (const s of [-1, 1]) {
    k.box(s * .55, .62, 2.45, .42, .14, .03, 0xf6f0dc, 4);
    k.box(s * .64, .66, -2.47, .34, .16, .03, 0xff1a1a, 5);
    k.box(s * .94, .5, 0, .03, .06, 3.9, 0x0e0e10, 2);
    k.box(s * .95, .93, .74, .1, .08, .14, 0x111111, 2);
  }
  k.box(0, .45, 2.47, 1.8, .14, .06, 0xb8bcc2, 3);
  k.box(0, .45, -2.48, 1.8, .14, .06, 0xb8bcc2, 3);
  k.box(0, .62, 2.465, .62, .14, .02, 0x15171a, 2);
  if (kind === 'taxi') {
    k.box(0, 1.5, -.35, .9, .22, .3, 0xfff4cc, 8);
    for (const s of [-1, 1]) for (let i = 0; i < 10; i++) k.box(s * .935, .68, -1.2 + i * .26, .01, .07, .13, i % 2 ? 0x101010 : 0xf4f4f4, 2);
  }
  if (kind === 'police') {
    for (const s of [-1, 1]) { k.box(s * .935, .66, 0, .01, .34, 2.6, 0xeeeeee, 2); k.box(s * .3, 1.47, -.35, .5, .12, .25, s < 0 ? 0xff1030 : 0x2050ff, 9); }
  }
  if (withWheels) for (const s of [-1, 1]) for (const z of [-1.45, 1.45]) wheel(k, s * .8, .36, z, .36, .24, 0x8a8e92, 0);
  return k;
}
function truckKit() {
  const k = new Kit();
  k.box(0, 1.15, 2.2, 2.2, 1.7, 1.9, 0xd8d4c8, 0);
  k.box(0, 1.65, 3.1, 2.0, .7, .06, 0x0a0c0e, 1);
  k.box(0, 1.9, -1.0, 2.36, 2.7, 4.6, 0xe6e2d8, 10);
  k.box(0, 1.9, -1.0, 2.38, .3, 4.5, 0x1a6a8a, 10);
  k.box(0, .5, 0, 2.0, .3, 6.4, 0x1a1a1a, 2);
  for (const s of [-1, 1]) { k.box(s * .8, .9, 3.16, .3, .18, .03, 0xf6f0dc, 4); k.box(s * .95, .8, -3.32, .2, .3, .03, 0xff1a1a, 5); }
  for (const s of [-1, 1]) for (const z of [2.3, -2.2, -1.2]) wheel(k, s * .95, .46, z, .46, .3, 0x6a6e72, 0);
  return k;
}
function hanzoKit() {
  const k = new Kit(), paint = 0xd8d2c4, dark = 0x1a1b1e;
  k.box(0, .62, .1, .16, .1, 1.1, dark, 15, -.12);
  sideExtrude(k, [[.55, .78], [.2, .95], [-.25, .92], [-.35, .74], [.4, .66]], .34, paint, 0, null, .04);
  sideExtrude(k, [[1.0, .62], [.95, .98], [.7, 1.08], [.5, .9], [.6, .6]], .42, paint, 0, (y) => 1 - sstep(.8, 1.08, y) * .3, .03);
  k.box(0, 1.06, .78, .3, .1, .02, 0x0b0c0f, 1, -.6);
  sideExtrude(k, [[-.25, .92], [-.95, 1.0], [-1.0, .86], [-.4, .76]], .26, paint, 0, null, .03);
  k.box(0, .96, -.48, .3, .07, .5, 0x101010, 2);
  k.box(0, .9, -.99, .2, .06, .03, 0xff1a1a, 5);
  k.box(0, .82, .99, .22, .1, .03, 0xf4f0e0, 4);
  k.box(0, .98, .52, .66, .03, .03, dark, 15);
  k.cyl(.16, .5, -.35, .05, .06, .7, 8, 0x8a8e94, 3, Math.PI / 2 - .2);
  k.box(0, .45, .05, .28, .32, .42, 0x2a2c30, 15);
  for (const s of [-1, 1]) { k.box(s * .09, .55, .82, .03, .5, .03, 0x8a8e94, 3, .45); k.box(s * .09, .55, -.62, .03, .03, .7, dark, 15, .3); }
  return k;
}
const BIKE_WHEEL = wheelGeo(.33, .14, 0x2a2c30);

// 車漆調色盤：instance 的 aIns.z 選色
const PAL = [0x7a1f22, 0x1e2f4f, 0x5a5e62, 0x111214, 0xd8d6d0, 0x23412e, 0x4d1a2c, 0xb3a385, 0x2d5f73, 0x6b3a1e].map(h => lin(h));
{
  const s = PAL.map(c => `vec3(${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)})`).join(',');
  MAT.uberI.fragmentShader = MAT.uberI.fragmentShader.replace('int m = int(vMat + .5);', `int m = int(vMat + .5);
  const vec3 PAL[${PAL.length}] = vec3[](${s});`).replace('if (m == 0) { rough = .22; envK = .75; }', 'if (m == 0) { rough = .22; envK = .75; if (vIns.z > .5) alb = PAL[int(vIns.z - .5)]; }');
}

// ─── 車流路網 ───
const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];   // +z、+x、-z、-x
const rightOf = d => DIRS[(d + 3) % 4];             // 前進方向的右手邊（右駕）
const hasEdge = (i, j, d) => { const ni = i + DIRS[d][0], nj = j + DIRS[d][1]; return ni >= 0 && ni <= NX && nj >= 0 && nj <= NZ; };
const nodePos = (i, j) => [avX(i), stZ(j)];
const segLen = d => (d % 2 === 0 ? Q : P) - 2 * HR;
function segPoint(i, j, d, s, lane = LANE) {
  const [x, z] = nodePos(i, j), [dx, dz] = DIRS[d], [rx, rz] = rightOf(d);
  return [x + dx * (HR + s) + rx * lane, z + dz * (HR + s) + rz * lane];
}
function turnPath(i, j, d, nd) {
  const [x, z] = nodePos(i, j);
  const [dx, dz] = DIRS[d], [rx, rz] = rightOf(d), [ndx, ndz] = DIRS[nd], [nrx, nrz] = rightOf(nd);
  const p0 = [x - dx * HR + rx * LANE, z - dz * HR + rz * LANE];
  const p2 = [x + ndx * HR + nrx * LANE, z + ndz * HR + nrz * LANE];
  const p1 = d === nd ? [(p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2] : [x + rx * LANE + nrx * LANE, z + rz * LANE + nrz * LANE];
  let len = 0, px = p0[0], pz = p0[1];
  for (let k = 1; k <= 12; k++) { const t = k / 12, q = bez(p0, p1, p2, t); len += Math.hypot(q[0] - px, q[1] - pz); px = q[0]; pz = q[1]; }
  return { p0, p1, p2, len };
}
function bez(a, b, c, t) { const u = 1 - t; return [u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]]; }
function bezTan(a, b, c, t) { const u = 1 - t; return [2 * u * (b[0] - a[0]) + 2 * t * (c[0] - b[0]), 2 * u * (b[1] - a[1]) + 2 * t * (c[1] - b[1])]; }

// ─── 車流與路邊停車都畫成 InstancedMesh，每種車型一次 draw call ───
// 實車車型由 tools/traffic.mjs 烘成 blender/out/traffic.glb（頂點色＋uber 材質編號 _MAT，幾千面），內嵌成 #glb-traffic；
// 載入失敗時退回程式建模的車（計程車、警車、房車、貨車各一種）。
const TRAFFIC_GEO = await embeddedGLB('traffic').then(g => {
  const o = {};
  g.scene.updateMatrixWorld(true);
  g.scene.traverse(m => {
    if (!m.isMesh) return;
    // 量化的位移與縮放在節點上；正規化整數屬性直接 applyMatrix4 會被截在 ±1，先轉成浮點
    const geo = m.geometry.clone();
    for (const k of ['position', 'normal']) {
      const at = geo.getAttribute(k), f = new Float32Array(at.count * 3);
      for (let i = 0; i < at.count; i++) for (let c = 0; c < 3; c++) f[i * 3 + c] = at.getComponent(i, c);
      geo.setAttribute(k, new T.BufferAttribute(f, 3));
    }
    geo.applyMatrix4(m.matrixWorld);
    geo.setAttribute('aMat', geo.getAttribute('_mat')); geo.deleteAttribute('_mat');
    geo.computeBoundingSphere();
    o[m.name] = { geo, ...m.userData };
  });
  return o;
}).catch(e => { console.warn('車流模型載入失敗，改用程式建模', e); return {}; });
const glbType = (id, vmax, fb, extra) => {
  const t = TRAFFIC_GEO[id], f = TRAFFIC_GEO[id + '_far'];
  return { ...(t ? { geo: () => t.geo, far: f && (() => f.geo), len: t.len, w: t.w, vmax, pal: t.pal ? 1 : 0 } : fb), ...extra };
};
const FB = {
  taxi: { kit: () => sedanKit('taxi'), len: 4.9, w: 1.9, vmax: 13 },
  police: { kit: () => sedanKit('police'), len: 4.9, w: 1.9, vmax: 14 },
  sedan: { kit: () => sedanKit('sedan'), len: 4.9, w: 1.9, vmax: 13, pal: 1 },
  truck: { kit: truckKit, len: 6.8, w: 2.4, vmax: 10 },
};
// 車型：計程車、兩種警車（police: 車頂警示燈）、九種房車、四種廂型車與貨車；模型都在時每種一組近遠兩個 InstancedMesh
const TYPES = {
  fh_taxi: glbType('fh_taxi', 13, FB.taxi),
  fh_cop: glbType('fh_cop', 14, FB.police, { police: 1 }),
  il_cop: glbType('il_cop', 14.5, FB.police, { police: 1 }),
  e34: glbType('e34', 12.5, FB.sedan), evo190: glbType('evo190', 13.5, FB.sedan),
  negotiator: glbType('negotiator', 12.5, FB.sedan), milano: glbType('milano', 12, FB.sedan), kiri: glbType('kiri', 13.5, FB.sedan),
  carter: glbType('carter', 13, FB.sedan), compact: glbType('compact', 11.5, FB.sedan), urban: glbType('urban', 12.5, FB.sedan),
  tiara: glbType('tiara', 14, FB.sedan),
  shvan: glbType('shvan', 11, FB.truck), lct: glbType('lct', 10, FB.truck), conquer: glbType('conquer', 12, FB.truck), fvan: glbType('fvan', 10, FB.truck),
  // 第二階段（69-police.js）：執法車也會被派出去追捕；運鈔裝甲車與救護車偶爾出現在車流
  urban_cop: glbType('urban_cop', 14, FB.police, { police: 1 }), md84: glbType('md84', 9.5, FB.truck, { armored: 1 }),
  ambulance: glbType('ambulance', 11.5, FB.truck), canyon_taxi: glbType('canyon_taxi', 13, FB.taxi),
  fh: glbType('fh', 13, FB.sedan), il: glbType('il', 13.5, FB.sedan),
  // 五星才出動的坦克（不進車流；砲塔是 traffic.glb 的 tank_turret，69-police.js 另外掛）
  tank: glbType('tank', 9, FB.truck, { armored: 1, tank: 1 }),
};
const TRAFFIC_N = LOW ? 18 : 34;
const traffic = [], parked = [];
const rT = rng(31);
const SEDANS = ['e34', 'evo190', 'negotiator', 'milano', 'kiri', 'carter', 'compact', 'urban', 'tiara', 'fh', 'il'], COPS = ['fh_cop', 'il_cop', 'urban_cop'], TRUCKS = ['shvan', 'lct', 'conquer', 'fvan', 'ambulance', 'md84'];
const TAXIS = ['fh_taxi', 'fh_taxi', 'canyon_taxi'];
const pick = (a, u) => a[Math.min(a.length - 1, Math.floor(u * a.length))];
function pickType() { const r = rT(); return r < .24 ? pick(TAXIS, r / .24) : r < .38 ? pick(TRUCKS, (r - .24) / .14) : r < .44 ? pick(COPS, (r - .38) / .06) : pick(SEDANS, (r - .44) / .56); }
// 停車：每段路兩側的停車格，避開路口、消防栓、施工區與夜店門口
const CLUB_X = avX(1) + 36, CLUB_Z = stZ(3) - HR - SW;
const BAR_X = lerp(avX(3) + HR + SW, avX(4) - HR - SW, SPECIAL.bar.at), BAR_Z = stZ(1) - HR - SW;
const GAR_X = avX(2) + 36, GAR_Z = stZ(2) - HR - SW;
const KESTREL_SPOT = { x: avX(1) - PARK, z: stZ(2) + 22, yaw: 0 };
const HANZO_SPOT = { x: BAR_X + 9, z: stZ(1) - PARK, yaw: -Math.PI / 2 };
// 車行交車、車庫門口：都在門前的停車道上，車頭順著車流
const DEAL_SPOT = { x: DEAL_X, z: stZ(3) - PARK, yaw: -Math.PI / 2 };
const HOME_SPOT = { x: HOME_X, z: stZ(2) + PARK, yaw: Math.PI / 2 };
// 醫院與警察局（69-combat.js 的 WASTED／BUSTED 在門口重生）：沒有建築，門前的人行道就是重生點，路邊停著救護車與警車
const HOSP = { x: avX(4) + HR + SW * .5, z: stZ(1) + 30, yaw: -Math.PI / 2, name: '聖瑪格麗特醫院', cars: ['ambulance', 'ambulance'] };
const PD = { x: avX(1) - HR - SW * .5, z: stZ(4) + 30, yaw: Math.PI / 2, name: '第九分局', cars: ['il_cop', 'urban_cop', 'fh_cop'] };
for (let i = 0; i <= NX; i++) for (let j = 0; j < NZ; j++) for (const d of [0, 2]) {
  // 大道（沿 z），右駕：往 +z 的車停在 x 負側
  const side = d === 0 ? -1 : 1;
  for (let s = 6; s < Q - 2 * HR - 6; s += 6.2) {
    if (rT() > .5) continue;
    const x = avX(i) + side * PARK, z = stZ(j) + HR + s;
    if (hydrants.some(h => Math.hypot(h.x - x, h.z - z) < 3.5) || works.some(w => Math.hypot(w.x - x, w.z - z) < 9) || rampBlock(x, z)) continue;
    if (Math.hypot(x - KESTREL_SPOT.x, z - KESTREL_SPOT.z) < 7) continue;
    parked.push({ type: pickType(), x, z, yaw: d === 0 ? 0 : Math.PI, pal: Math.floor(rT() * PAL.length) });
  }
}
for (let j = 0; j <= NZ; j++) for (let i = 0; i < NX; i++) for (const d of [1, 3]) {
  const side = d === 1 ? 1 : -1;
  for (let s = 6; s < P - 2 * HR - 6; s += 6.2) {
    if (rT() > .5) continue;
    const x = avX(i) + HR + s, z = stZ(j) + side * PARK;
    if (hydrants.some(h => Math.hypot(h.x - x, h.z - z) < 3.5) || rampBlock(x, z)) continue;
    if (Math.abs(z - (CLUB_Z + 4.5)) < 3 && Math.abs(x - CLUB_X) < 16) continue;
    if (Math.abs(z - (BAR_Z + 4.5)) < 3 && Math.abs(x - BAR_X) < 12) continue;
    if (Math.hypot(x - HANZO_SPOT.x, z - HANZO_SPOT.z) < 5) continue;
    if (Math.abs(z - (GAR_Z + 4.5)) < 3 && Math.abs(x - GAR_X) < 10) continue;
    if (Math.abs(z - DEAL_SPOT.z) < 3 && Math.abs(x - DEAL_X) < 14) continue;
    if (Math.abs(z - HOME_SPOT.z) < 3 && Math.abs(x - HOME_X) < 9) continue;
    parked.push({ type: pickType(), x, z, yaw: d === 1 ? Math.PI / 2 : -Math.PI / 2, pal: Math.floor(rT() * PAL.length) });
  }
}
for (const S of [HOSP, PD]) {
  // 大道（沿 z）邊的停車格：先清掉那一段原本的車，再依序停進去
  const side = S === HOSP ? 1 : -1, x = avX(S === HOSP ? 4 : 1) + side * PARK;
  for (let i = parked.length - 1; i >= 0; i--) if (Math.abs(parked[i].x - x) < 1 && Math.abs(parked[i].z - S.z) < 14) parked.splice(i, 1);
  S.cars.forEach((type, n) => parked.push({ type, x, z: S.z - 6.5 + n * 6.2, yaw: side > 0 ? Math.PI : 0, pal: 0 }));
}
for (const p of parked) { const L = TYPES[p.type].len * .3; p.circ = [-1, 1].map(s => ({ x: p.x + Math.sin(p.yaw) * L * s, z: p.z + Math.cos(p.yaw) * L * s, r: TYPES[p.type].w * .5, car: 1 })); circles.push(...p.circ); }

// 生成行駛中的車：均勻撒在各路段
for (let n = 0; n < TRAFFIC_N; n++) {
  let i, j, d;
  do { i = Math.floor(rT() * (NX + 1)); j = Math.floor(rT() * (NZ + 1)); d = Math.floor(rT() * 4); } while (!hasEdge(i, j, d));
  const type = pickType();
  traffic.push({ type, i, j, d, s: rT() * segLen(d), v: 8, turn: null, x: 0, z: 0, yaw: 0, brake: 0, pal: Math.floor(rT() * PAL.length), seed: rT(), stuck: 0, ghost: 0, hit: 0, honk: 0 });
}
// 實車車型有近景與遠景兩級（traffic.glb 的 id／id_far）：每幀依與相機的距離把車分進兩個 InstancedMesh，
// 相機後方的車不畫；路邊停了三百台車，全用近景模型會多出兩三百萬面
const typeMesh = {};
const LOD_NEAR = 40;
const mkInst = (g, cap) => {
  const m = new T.InstancedMesh(g, MAT.uberI, cap);
  g.setAttribute('aIns', new T.InstancedBufferAttribute(new Float32Array(cap * 4), 4));
  m.frustumCulled = false; m.count = 0;
  scene.add(m);
  return m;
};
for (const [name, ty] of Object.entries(TYPES)) {
  const list = [...traffic.filter(c => c.type === name), ...parked.filter(c => c.type === name)];
  const cap = Math.max(1, list.length);
  typeMesh[name] = { near: mkInst(ty.geo ? ty.geo() : ty.kit().build(), cap), far: ty.far ? mkInst(ty.far(), cap) : null, list };
  list.forEach(c => { c.m = new Float32Array(16); c.seed ??= rT(); c.palI = ty.pal ? c.pal + 1 : 0; });
}
const CAR_FAR = 320;
function flushTraffic() {
  const e = camera.matrixWorld.elements, cx = camera.position.x, cz = camera.position.z;
  let fx = -e[8], fz = -e[10]; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
  for (const name in typeMesh) {
    const { near, far, list } = typeMesh[name];
    const n = [0, 0];
    for (const c of list) {
      const dx = c.x - cx, dz = c.z - cz, d2 = dx * dx + dz * dz;
      if (d2 > 64 && dx * fx + dz * fz < -8 || d2 > CAR_FAR * CAR_FAR) continue;   // 相機後方、霧裡看不到的都不畫
      const lod = far && d2 > LOD_NEAR * LOD_NEAR ? 1 : 0, m = lod ? far : near, k = n[lod]++;
      m.instanceMatrix.array.set(c.m, k * 16);
      const ia = m.geometry.attributes.aIns.array; ia[k * 4] = c.brake; ia[k * 4 + 1] = c.seed; ia[k * 4 + 2] = c.palI;
    }
    for (const [m, k] of [[near, n[0]], [far, n[1]]]) if (m) { m.count = k; m.instanceMatrix.needsUpdate = true; m.geometry.attributes.aIns.needsUpdate = true; }
  }
}
// 車底陰影與頭燈照地
const SHADOW_FS = /* glsl */`varying vec2 vUv; void main(){ vec2 q = (vUv - .5) * 2.; float a = (1. - smoothstep(.35, 1., length(q * vec2(1., .9)))) * .82; gl_FragColor = vec4(0., 0., 0., a); }`;
const POOL_FS = /* glsl */`${GL_LIB}
varying vec2 vUv; varying vec3 vW;
void main(){ vec2 q = vUv - vec2(.5, 0.); float a = smoothstep(.5, .0, abs(q.x) / (.3 + vUv.y*.7)) * smoothstep(1., .1, vUv.y) * smoothstep(0., .08, vUv.y); gl_FragColor = vec4(vec3(1.,.86,.62) * a * .5 * exp(-length(vW - uCam)*uFogDen), 1.); }`;
const QUAD_VS = /* glsl */`varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const allCars = () => [...traffic, ...parked];
const shadowMesh = (() => {
  const g = new T.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
  const m = new T.InstancedMesh(g, new T.ShaderMaterial({ uniforms: shared(ALLU), vertexShader: QUAD_VS, fragmentShader: SHADOW_FS, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), traffic.length + parked.length + 48);
  m.frustumCulled = false; m.layers.set(LY.NOREFL); m.renderOrder = 2; scene.add(m); return m;
})();
const poolMesh = (() => {
  const g = new T.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); g.translate(0, 0, .5);
  // 平面往 +z 延伸：uv.y 0 在車頭、1 在遠端
  const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - uv.getY(k));
  const m = new T.InstancedMesh(g, new T.ShaderMaterial({ uniforms: shared(ALLU), vertexShader: QUAD_VS, fragmentShader: POOL_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending }), traffic.length + 2);
  m.frustumCulled = false; m.layers.set(LY.NOREFL); m.renderOrder = 3; scene.add(m); return m;
})();
function placeCar(c, k, y = 0) {
  _o.position.set(c.x, y + (c.bob || 0), c.z); _o.rotation.set(c.pitch || 0, c.yaw, c.roll || 0, 'YXZ'); _o.scale.set(1, 1, 1); _o.updateMatrix();
  _o.matrix.toArray(c.m);
}
parked.forEach(c => { c.brake = 0; placeCar(c, 0, groundH(c.x, c.z) > 0 ? .15 : 0); });

function carAhead(c, fx, fz, maxD) {
  let best = maxD;
  const test = (ox, oz, w) => {
    const rx = ox - c.x, rz = oz - c.z;
    const along = rx * fx + rz * fz; if (along <= .5 || along > best) return;
    const lat = Math.abs(rx * fz - rz * fx); if (lat > 1.3 + w) return;
    best = along;
  };
  for (const o of traffic) if (o !== c) test(o.x, o.z, .4);
  if (player.mode === 'drive' && player.veh) test(player.veh.x, player.veh.z, .5);
  else if (player.mode === 'walk' && onRoad(player.x, player.z)) test(player.x, player.z, 0);
  return best;
}
// 車流只有幾十台：離玩家太遠（霧裡看不到）的車搬到玩家附近 140–250 m 的路段，城市再大，眼前的路上都有車
function trafficRespawn(c, px, pz) {
  const ci = Math.round((px - X0) / P), cj = Math.round((pz - Z0) / Q);
  for (let n = 0; n < 40; n++) {
    const i = clamp(ci + Math.floor(rT() * 9) - 4, 0, NX), j = clamp(cj + Math.floor(rT() * 9) - 4, 0, NZ), d = Math.floor(rT() * 4);
    if (!hasEdge(i, j, d)) continue;
    const s = rT() * segLen(d), [x, z] = segPoint(i, j, d, s), dd = Math.hypot(x - px, z - pz);
    if (dd < 140 || dd > 250 || traffic.some(o => o !== c && (o.x - x) ** 2 + (o.z - z) ** 2 < 144)) continue;
    Object.assign(c, { i, j, d, s, turn: null, v: 6, stuck: 0, ghost: 0, hit: 0, brake: 0, x, z });
    return;
  }
}
function updateTraffic(dt, t) {
  const ppx = pX(), ppz = pZ();
  for (const c of traffic) {
    if (!c.turn && c.hit <= 0 && (c.x - ppx) ** 2 + (c.z - ppz) ** 2 > 290 * 290) trafficRespawn(c, ppx, ppz);
    if (c.hit > 0) { c.hit -= dt; c.v = damp(c.v, 0, 4, dt); }
    let fx, fz;
    if (c.turn) { const tg = bezTan(c.turn.p0, c.turn.p1, c.turn.p2, c.turn.t); const l = Math.hypot(tg[0], tg[1]) || 1; fx = tg[0] / l; fz = tg[1] / l; }
    else { fx = DIRS[c.d][0]; fz = DIRS[c.d][1]; }
    let want = TYPES[c.type].vmax * (.85 + c.seed * .3);
    const gap = c.ghost > 0 ? 99 : carAhead(c, fx, fz, 22);
    const half = TYPES[c.type].len / 2;
    if (gap < 22) want = Math.min(want, Math.max(0, (gap - half - 3.2) * 1.1));
    if (!c.turn) {
      const L = segLen(c.d);
      const ni = c.i + DIRS[c.d][0], nj = c.j + DIRS[c.d][1];
      const st = lightState(ni, nj, c.d % 2 === 0 ? 'z' : 'x', t);
      const stopS = L - 4.4 - half;
      if (st !== 2 && c.s < stopS + .5) {
        const dist = stopS - c.s;
        if (st === 0 || dist > c.v * 1.2) want = Math.min(want, Math.max(0, dist * .9));
      }
    }
    if (c.hit > 0) want = 0;
    c.v = c.v + clamp(want - c.v, -9 * dt, 3.2 * dt);
    c.brake = want < c.v - .3 || c.v < .3 ? 1 : 0;
    if (c.v < .2) { c.stuck += dt; if (c.stuck > 7 && c.turn) { c.ghost = 2.5; c.stuck = 0; } } else c.stuck = 0;
    if (c.ghost > 0) c.ghost -= dt;
    // 前進
    if (c.turn) {
      c.turn.t += c.v * dt / c.turn.len;
      if (c.turn.t >= 1) {
        const over = (c.turn.t - 1) * c.turn.len;
        c.i = c.turn.ni; c.j = c.turn.nj; c.d = c.turn.nd; c.s = over; c.turn = null;
      }
    } else {
      c.s += c.v * dt;
      if (c.s >= segLen(c.d)) {
        const ni = c.i + DIRS[c.d][0], nj = c.j + DIRS[c.d][1];
        const opts = [];
        if (hasEdge(ni, nj, c.d)) opts.push([c.d, .55]);
        if (hasEdge(ni, nj, (c.d + 3) % 4)) opts.push([(c.d + 3) % 4, .25]);
        if (hasEdge(ni, nj, (c.d + 1) % 4)) opts.push([(c.d + 1) % 4, .2]);
        let r = rT() * opts.reduce((a, o) => a + o[1], 0), nd = opts[0][0];
        for (const o of opts) { if (r < o[1]) { nd = o[0]; break; } r -= o[1]; }
        const tp = turnPath(ni, nj, c.d, nd);
        c.turn = { ...tp, t: (c.s - segLen(c.d)) / tp.len, ni, nj, nd };
      }
    }
    // 世界座標
    let px, pz, yaw;
    if (c.turn) { const q = bez(c.turn.p0, c.turn.p1, c.turn.p2, Math.min(c.turn.t, 1)); px = q[0]; pz = q[1]; const tg = bezTan(c.turn.p0, c.turn.p1, c.turn.p2, Math.min(c.turn.t, 1)); yaw = Math.atan2(tg[0], tg[1]); }
    else { [px, pz] = segPoint(c.i, c.j, c.d, c.s); yaw = Math.atan2(DIRS[c.d][0], DIRS[c.d][1]); }
    c.x = px; c.z = pz; c.yaw = yaw;
    c.pitch = c.brake && c.v > 1 ? -.012 : 0;
    placeCar(c, 0);
    if (c.honk > 0) c.honk -= dt;
  }
  flushTraffic();
  // 陰影與頭燈
  let k = 0;
  const putShadow = (x, z, yaw, L, W, y = .02) => { _o.position.set(x, y, z); _o.rotation.set(0, yaw, 0); _o.scale.set(W * 1.25, 1, L * 1.12); _o.updateMatrix(); shadowMesh.setMatrixAt(k++, _o.matrix); };
  for (const c of traffic) putShadow(c.x, c.z, c.yaw, TYPES[c.type].len, TYPES[c.type].w);
  const ccx = camera.position.x, ccz = camera.position.z;
  for (const c of parked) if ((c.x - ccx) ** 2 + (c.z - ccz) ** 2 < 40000) putShadow(c.x, c.z, c.yaw, TYPES[c.type].len, TYPES[c.type].w, groundH(c.x, c.z) + .02);
  for (const v of vehicles) putShadow(v.x, v.z, v.yaw, v.len, v.w, v.y + .02);
  shadowMesh.count = k; shadowMesh.instanceMatrix.needsUpdate = true;
  let q = 0;
  for (const c of traffic) {
    const L = TYPES[c.type].len / 2;
    _o.position.set(c.x + Math.sin(c.yaw) * L, .03, c.z + Math.cos(c.yaw) * L); _o.rotation.set(0, c.yaw, 0); _o.scale.set(4.2, 1, 11); _o.updateMatrix(); poolMesh.setMatrixAt(q++, _o.matrix);
  }
  if (player.veh && player.mode === 'drive') {
    const v = player.veh;
    _o.position.set(v.x + Math.sin(v.yaw) * v.len / 2, .035, v.z + Math.cos(v.yaw) * v.len / 2); _o.rotation.set(0, v.yaw, 0); _o.scale.set(5, 1, 16); _o.updateMatrix(); poolMesh.setMatrixAt(q++, _o.matrix);
  }
  poolMesh.count = q; poolMesh.instanceMatrix.needsUpdate = true;
}

// ─── 玩家座駕 ───
// 汽車的車身與輪子依 CARS 目錄重建（車行買車、試駕、車庫換車、改裝廠換色都走 applyCar）
function mkVehicle(kind) {
  const isCar = kind !== 'hanzo';
  const mat = mkUber(); mat.uniforms.uM.value.set(0, 0, 1, 0);
  const g = new T.Group();
  const body = new T.Group(); g.add(body);
  const wheels = [];
  scene.add(g);
  const sp = isCar ? KESTREL_SPOT : HANZO_SPOT;
  const v = { kind, isCar, g, body, mat, wheels, x: sp.x, z: sp.z, y: 0, yaw: sp.yaw, vx: 0, vz: 0, yr: 0, steer: 0, spin: 0, roll: 0, pitch: 0, lean: 0,
    len: 2.1, w: .7, rad: .45, off: .55, vmax: 47, eng: 12.5, grip: 7, wb: 1.5, wr: .33, name: 'Hanzo', rpm: 0, gear: 1, slip: 0, lights: 0 };
  if (isCar) applyCar(v, STARTER);
  else {
    body.add(new T.Mesh(hanzoKit().build(), mat));
    for (const z of [.8, -.72]) {
      const piv = new T.Group(); piv.position.set(0, .33, z); body.add(piv);
      const w = new T.Mesh(BIKE_WHEEL, mat); w.position.x = -.07; piv.add(w); wheels.push({ piv, w, front: z > 0 });
    }
  }
  return v;
}
function applyCar(v, id, paint) {
  const c = CARS[id], f = c.glb && !c.bike ? CARS[c.proxy] : c;
  disposeKit(v.body); v.body.clear();
  for (const w of v.wheels) w.piv.parent && w.piv.parent.remove(w.piv);
  v.wheels.length = 0;
  v.isCar = !c.bike; v.glbTok = (v.glbTok || 0) + 1;
  // 機車的輪子掛在車身上（跟著壓車），汽車的掛在車架上
  if (c.bike) {
    const m = new T.Mesh(hanzoKit().build(), v.mat); m.userData.kit = 1; v.body.add(m);
    for (const z of [.8, -.72]) {
      const piv = new T.Group(); piv.position.set(0, .33, z); v.body.add(piv);
      const w = new T.Mesh(BIKE_WHEEL, v.mat); w.position.x = -.07; piv.add(w); v.wheels.push({ piv, w, front: z > 0 });
    }
  } else {
    const m = new T.Mesh(carKit(id, paint, 0).build(), v.mat); m.userData.kit = 1; v.body.add(m);
    for (const s of [-1, 1]) for (const [z, fr] of [[f.fa, 0], [f.ra, 1]]) {
      const piv = new T.Group(); piv.position.set(s * f.track, f.wr, z); v.g.add(piv);
      const w = new T.Mesh(carWheelGeo(id, fr), v.mat); if (s < 0) w.rotation.y = Math.PI; piv.add(w); v.wheels.push({ piv, w, front: fr === 0 });
    }
  }
  Object.assign(v, { carId: id, paint: paint ?? c.paint, len: c.len, w: c.w, rad: c.w / 2 + .05, off: c.len * .28, vmax: c.vmax, eng: c.eng, grip: c.grip, wb: c.fa - c.ra, wr: c.wr, name: c.name, seat: c.seat || null });
  // 實車模型：下載好就把替身換掉（期間又換了車就作罷）
  const p = c.glb && loadGLB(id), tok = v.glbTok;
  if (p) p.then(tpl => {
    if (!tpl || v.glbTok !== tok) return;
    const inst = glbInstance(tpl, paint, v.mat.uniforms.uM);
    disposeKit(v.body); v.body.clear();
    for (const w of v.wheels) w.piv.parent && w.piv.parent.remove(w.piv);
    v.wheels.length = 0;
    v.body.add(inst.body);
    for (const w of inst.wheels) { (c.bike ? v.body : v.g).add(w.piv); v.wheels.push(w); }
  });
}
const kestrel = mkVehicle('kestrel'), hanzo = mkVehicle('hanzo');   // kestrel：玩家座駕（換車都走 applyCar）；hanzo：路邊的機車
applyCar(hanzo, STREET_BIKE);
const vehicles = [kestrel, hanzo];

// 碰撞：圓對 AABB、圓對圓；回傳推出量與法線
function collideCircle(x, z, r, skipCar, swimmer) {   // swimmer：玩家步行，可以穿過沙灘外緣的擋牆下水
  let nx = 0, nz = 0, hit = 0;
  for (const b of boxesNear(x, z, r)) {
    if (swimmer && b.swim) continue;
    const cx = clamp(x, b.x0, b.x1), cz = clamp(z, b.z0, b.z1);
    let dx = x - cx, dz = z - cz; const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 < 1e-8) { // 圓心在盒內：往最近的邊推
        const e = [x - b.x0, b.x1 - x, z - b.z0, b.z1 - z]; const m = Math.min(...e);
        if (m === e[0]) { x = b.x0 - r; nx -= 1; } else if (m === e[1]) { x = b.x1 + r; nx += 1; } else if (m === e[2]) { z = b.z0 - r; nz -= 1; } else { z = b.z1 + r; nz += 1; }
      } else { const d = Math.sqrt(d2); x = cx + dx / d * r; z = cz + dz / d * r; nx += dx / d; nz += dz / d; }
      hit = 1;
    }
  }
  for (const c of circlesNear(x, z, r)) {
    if (skipCar && c.car) continue;
    const dx = x - c.x, dz = z - c.z, rr = r + c.r, d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 1e-8) { const d = Math.sqrt(d2); x = c.x + dx / d * rr; z = c.z + dz / d * rr; nx += dx / d; nz += dz / d; hit = 1; }
  }
  return { x, z, nx, nz, hit };
}
// 兩個圓代表車身前後，跟靜態物、停車與車流碰撞
function vehicleCollide(v, dt) {
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  const off = v.off;
  let impact = 0;
  for (const s of [1, -1]) {
    const cx = v.x + fx * off * s, cz = v.z + fz * off * s;
    let r = collideCircle(cx, cz, v.rad, false);
    let px = r.x - cx, pz = r.z - cz, nx = r.nx, nz = r.nz;
    for (const c of traffic) {
      const L = TYPES[c.type].len * .3;
      for (const t of [-1, 1]) {
        const ox = c.x + Math.sin(c.yaw) * L * t, oz = c.z + Math.cos(c.yaw) * L * t;
        const dx = cx + px - ox, dz = cz + pz - oz, rr = v.rad + TYPES[c.type].w * .5, d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-6) {
          const d = Math.sqrt(d2), push = rr - d; px += dx / d * push; pz += dz / d * push; nx += dx / d; nz += dz / d;
          if (c.hit <= 0) { c.hit = 2.5 + Math.random() * 2; c.honk = 0; sfx.horn(c); }
        }
      }
    }
    if (px || pz) {
      v.x += px; v.z += pz;
      const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
      const vn = v.vx * nx + v.vz * nz;
      if (vn < 0) { v.vx -= vn * nx * 1.25; v.vz -= vn * nz * 1.25; v.vx *= .9; v.vz *= .9; impact = Math.max(impact, -vn); }
    }
  }
  return impact;
}
function driveVehicle(v, inp, dt) {
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), rx = -fz, rz = fx;
  let vF = v.vx * fx + v.vz * fz, vR = v.vx * rx + v.vz * rz;
  const spd = Math.abs(vF);
  const maxSt = lerp(v.isCar ? .55 : .5, v.isCar ? .12 : .1, clamp(spd / 45, 0, 1));
  v.steer = damp(v.steer, inp.steer * maxSt * (v.stK || 1), inp.steer ? 6 : 9, dt);
  let aF = 0;
  if (inp.thr > 0) aF += v.eng * inp.thr * (1 - (vF / v.vmax) ** 2) * (vF < 8 ? 1.25 : 1);
  if (inp.brk > 0) aF += vF > .8 ? -16 * inp.brk : -6 * inp.brk * (vF > -9 ? 1 : 0);
  aF -= vF * .12 + Math.sign(vF) * .35;
  if (inp.hb) aF -= Math.sign(vF) * 4;
  vF += aF * dt;
  if (!inp.thr && !inp.brk && Math.abs(vF) < .3) vF = 0;
  const grip = inp.hb ? 1.4 : v.grip * (1 - clamp((Math.abs(vR) - 3) / 10, 0, .6));
  vR *= Math.exp(-grip * dt);
  const wb = v.wb;
  let targetYr = vF * Math.tan(v.steer) / wb;
  if (inp.hb && spd > 6) targetYr += inp.steer * 1.1;
  v.yr = damp(v.yr, targetYr, v.isCar ? 7 : 9, dt);
  v.yaw += v.yr * dt;
  // 甩尾時把一部分前進速度轉成側滑
  if (inp.hb && spd > 6) vR += v.yr * vF * .045 * dt * 60 * .016;
  v.slip = Math.abs(vR);
  const nfx = Math.sin(v.yaw), nfz = Math.cos(v.yaw), nrx = -nfz, nrz = nfx;
  v.vx = nfx * vF + nrx * vR; v.vz = nfz * vF + nrz * vR;
  v.x += v.vx * dt; v.z += v.vz * dt;
  const imp = vehicleCollide(v, dt);
  const gh = groundH(v.x, v.z);
  v.y = damp(v.y, gh, 18, dt);
  // 車身姿態：側傾、俯仰、機車壓車
  const latA = vF * v.yr;
  v.roll = damp(v.roll, v.isCar ? clamp(latA * .006, -.06, .06) : 0, 6, dt);
  v.pitch = damp(v.pitch, clamp(-aF * .0035, -.04, .04), 6, dt);
  v.lean = damp(v.lean, v.isCar ? 0 : clamp(-latA * .045, -.7, .7), 7, dt);
  v.spin += vF * dt / v.wr;
  const kmh = Math.abs(vF) * 3.6;
  const gears = [0, 38, 72, 108, 146, 999];
  let g = 1; while (g < 5 && kmh > gears[g]) g++;
  v.gear = vF < -.5 ? 'R' : g;
  v.rpm = clamp(.18 + (kmh - gears[g - 1]) / (gears[g] - gears[g - 1] || 40) * .8, .12, 1) * (inp.thr ? 1 : .8);
  v.brakeOn = inp.brk && vF > .5 ? 1 : 0;
  return { imp, vF, aF };
}
function poseVehicle(v) {
  v.g.position.set(v.x, v.y, v.z);
  v.g.rotation.set(0, v.yaw, 0);
  v.body.rotation.set(v.pitch, 0, v.isCar ? v.roll : v.lean, 'YXZ');
  // 跳台飛行中（69-stunt.js）繞車身中心翻轉，平常繞著地面
  if (v.air && v.isCar) { const h = .7, cr = Math.cos(v.roll); v.body.position.set(h * Math.sin(v.roll), h * (1 - cr * Math.cos(v.pitch)), -h * cr * Math.sin(v.pitch)); }
  else if (v.body.position.lengthSq()) v.body.position.set(0, 0, 0);
  for (const w of v.wheels) {
    if (v.isCar) { w.piv.rotation.set(0, w.front ? v.steer : 0, 0); w.w.rotation.x = v.spin; }
    else { w.piv.rotation.set(0, w.front ? v.steer * .6 : 0, 0); w.w.rotation.x = v.spin; }
  }
  v.mat.uniforms.uM.value.set(v.lights * lerp(.3, 1, atm.lamp), v.brakeOn || 0, 1, v.burn || 0);   // 白天大燈暗一點（28-sky.js）
  if (v.ins) { v.ins.array[0] = v.brakeOn || 0; v.ins.needsUpdate = true; }   // 搶來的車流車（68-gta.js）：煞車燈在 aIns
}
vehicles.forEach(v => { v.y = groundH(v.x, v.z); poseVehicle(v); });
