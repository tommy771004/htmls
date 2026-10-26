
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
const PAL_HEX = [0x7a1f22, 0x1e2f4f, 0x5a5e62, 0x111214, 0xd8d6d0, 0x23412e, 0x4d1a2c, 0xb3a385, 0x2d5f73, 0x6b3a1e], PAL = PAL_HEX.map(h => lin(h));   // PAL_HEX：搶到街頭車時換成實車的烤漆（68-gta.js）
{
  const s = PAL.map(c => `vec3(${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)})`).join(',');
  MAT.uberI.fragmentShader = MAT.uberI.fragmentShader.replace('int m = int(vMat + .5);', `int m = int(vMat + .5);
  const vec3 PAL[${PAL.length}] = vec3[](${s});`).replace('if (m == 0) { rough = .22; envK = .75; }', 'if (m == 0) { rough = .22; envK = .75; if (vIns.z > .5) alb = PAL[int(vIns.z - .5)]; }');
}
// 車流與路邊停車的 InstancedMesh 用自己的一份：aIns.w 是剛生成的車還要淡掉多少（1 全透明、0 不透明），用點陣丟掉像素淡入
// （MAT.uberI 也給道具的實例用，它們的 aIns.w 另有用途，所以不改共用的那份）
const TRAF_MAT = mkUber({ inst: true });
TRAF_MAT.fragmentShader = MAT.uberI.fragmentShader.replace('int m = int(vMat + .5);', `if (vIns.w > 0. && fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715)))) < vIns.w) discard;
  int m = int(vMat + .5);`);

// ─── 車流路網：06-roads.js 的 RN（路口與路段，世界座標）；車在 (e, dir, s)，轉彎走 turnPathE 的二次貝茲 ───
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
  // world_1 gameready_city 路上的三台車（tools/traffic.mjs 的 grc_*）：深藍舊轎車、白色廂型貨車、藍色郵務車
  grc_sedan: glbType('grc_sedan', 12, FB.sedan), grc_stepvan: glbType('grc_stepvan', 10, FB.truck), grc_mailvan: glbType('grc_mailvan', 10, FB.truck),
  // 69-v8-civic.js：拖吊車（也在車流與拖吊場裡）、消防指揮車與消防水箱車（只有消防派遣會出動）
  tow: glbType('tow', 10.5, FB.truck), fire_chief: glbType('fire_chief', 13, FB.police), firetruck: glbType('firetruck', 9.5, FB.truck),
  // 五星才出動的坦克（不進車流；砲塔是 traffic.glb 的 tank_turret，69-police.js 另外掛）
  tank: glbType('tank', 9, FB.truck, { armored: 1, tank: 1 }),
  // 街頭車（26-glb.js 的 street）：車流與路邊用 traffic.glb 的低面數版，玩家坐上去時 68-gta.js 的 streetUp 換成 assets/260 的實車
  ...Object.fromEntries(['g63', 'lc200', 'rr06', 'ramtrx', 'ghost', 's65', 'm5f90', 'camry', 'gt500', 'viper', 'senna', 'r8', 'evo6'].map(id => [id, glbType(id, id === 'ramtrx' ? 12 : 13.5, FB.sedan, { street: 1 })])),
};
const TRAFFIC_N = LOW ? 23 : 43;   // 2026-10-26 多 25%（原本 18／34）
const traffic = [], parked = [];
const rT = rng(31);
const SEDANS = ['e34', 'evo190', 'negotiator', 'milano', 'kiri', 'carter', 'compact', 'urban', 'tiara', 'fh', 'il', 'grc_sedan'], COPS = ['fh_cop', 'il_cop', 'urban_cop'], TRUCKS = ['shvan', 'lct', 'conquer', 'fvan', 'ambulance', 'md84', 'grc_stepvan', 'grc_mailvan'];
const TAXIS = ['fh_taxi', 'fh_taxi', 'canyon_taxi'];
// 街頭車：一般車多抽幾次（Camry、Land Cruiser 常見，Senna 全城難得一見）
const STREET = ['camry', 'camry', 'camry', 'lc200', 'lc200', 'rr06', 'rr06', 'g63', 'g63', 'ramtrx', 'ramtrx', 's65', 'ghost', 'm5f90', 'm5f90', 'gt500', 'gt500', 'viper', 'evo6', 'evo6', 'r8', 'senna'];
const pick = (a, u) => a[Math.min(a.length - 1, Math.floor(u * a.length))];
function pickType() { const r = rT(); return r < .24 ? pick(TAXIS, r / .24) : r < .38 ? pick(TRUCKS, (r - .24) / .14) : r < .44 ? pick(COPS, (r - .38) / .06) : r < .53 ? pick(STREET, (r - .44) / .09) : pick(SEDANS, (r - .53) / .47); }
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
const HOSP = { x: avX(4) + HR + SW * .5, z: stZ(1) + 30, yaw: -Math.PI / 2, name: '聖瑪格麗特醫院', cars: ['ambulance', 'ambulance', 'firetruck'] };
const PD = { x: avX(1) - HR - SW * .5, z: stZ(4) + 30, yaw: Math.PI / 2, name: '第九分局', cars: ['il_cop', 'urban_cop', 'fh_cop', 'fire_chief'] };
for (let i = 0; i <= NX; i++) for (let j = 0; j < NZ; j++) for (const d of [0, 2]) {
  // 大道（沿 z），右駕：往 +z 的車停在 x 負側
  const side = d === 0 ? -1 : 1;
  for (let s = 6; s < Q - 2 * HR - 6; s += 6.2) {
    if (rT() > .5) continue;
    const x = avX(i) + side * PARK, z = stZ(j) + HR + s;
    if (hydrants.some(h => Math.hypot(h.x - x, h.z - z) < 3.5) || works.some(w => Math.hypot(w.x - x, w.z - z) < 9) || rampBlock(x, z)) continue;
    if (Math.hypot(x - KESTREL_SPOT.x, z - KESTREL_SPOT.z) < 7) continue;
    const car = { type: pickType(), x, z, yaw: d === 0 ? 0 : Math.PI, pal: Math.floor(rT() * PAL.length) };
    if (plazaD(x, z) >= HR + 2.5 && !garDrive(x, z)) parked.push(car);   // 斜的大道從路口切進廣場的那一段、停車場入口前不停車（亂數照抽，後面的車不跑位）
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
    const car = { type: pickType(), x, z, yaw: d === 1 ? Math.PI / 2 : -Math.PI / 2, pal: Math.floor(rT() * PAL.length) };
    if (plazaD(x, z) >= HR + 2.5) parked.push(car);
  }
}
for (const S of [HOSP, PD]) {
  // 大道（沿 z）邊的停車格：先清掉那一段原本的車，再依序停進去（一格 6.2 m，消防水箱車這種長車照車長多佔一點）
  const side = S === HOSP ? 1 : -1, x = avX(S === HOSP ? 4 : 1) + side * PARK;
  const L = S.cars.map(t => Math.max(6.2, ((TYPES[t] && TYPES[t].len) || 5) + .9)), z1 = S.z - 9.6 + L.reduce((a, b) => a + b, 0);
  for (let i = parked.length - 1; i >= 0; i--) if (Math.abs(parked[i].x - x) < 1 && parked[i].z > S.z - 14 && parked[i].z < Math.max(S.z + 14, z1 + 3.5)) parked.splice(i, 1);
  let z = S.z - 9.6;
  S.cars.forEach((type, n) => { parked.push({ type, x, z: z + L[n] / 2, yaw: side > 0 ? Math.PI : 0, pal: 0 }); z += L[n]; });
}
{
  // CHROME WORKS 門口旁邊的車位停一台拖吊車（69-v8-civic.js 開得走）：換掉那一格的車，拖吊車比一格長，前後各清一格
  const z = GAR_Z + 4.5, c = parked.filter(p => Math.abs(p.z - z) < 3 && Math.abs(p.x - GAR_X) > 12 && Math.abs(p.x - GAR_X) < 30).sort((a, b) => Math.abs(a.x - GAR_X) - Math.abs(b.x - GAR_X))[0];
  if (c) { for (let i = parked.length - 1; i >= 0; i--) if (parked[i] !== c && Math.abs(parked[i].z - c.z) < 1 && Math.abs(parked[i].x - c.x) < 8) parked.splice(i, 1); c.type = 'tow'; c.pal = 2; }
}
parked.push(...facParked());   // 69-v5-civic.js：拖吊場裡被扣的車（不抽 rT）
mallParkClear();   // 69-v5-shops.js：洗車隧道進出口前的路邊車位
streetParkClear();   // 69-v5-street.js：路邊施工區那幾段
// 停車位以邏輯座標挑好，這裡一次換成世界座標（車頭方向一起轉）；車身的兩個碰撞圓直接是世界座標
for (const p of parked) { const zn = zoneAtL(p.x, p.z); [p.x, p.z] = toW(p.x, p.z, zn); p.yaw = yawW(zn, p.yaw); }
// 停車、出生、交車與重生點：生成時（避開停車格）是邏輯座標，cityWorld() 之後換成世界座標
worldHooks.push(() => { for (const S of [KESTREL_SPOT, HANZO_SPOT, DEAL_SPOT, HOME_SPOT, HOSP, PD]) Object.assign(S, spotW(S)); });
for (const p of parked) { const L = TYPES[p.type].len * .3; p.circ = [-1, 1].map(s => ({ x: p.x + Math.sin(p.yaw) * L * s, z: p.z + Math.cos(p.yaw) * L * s, r: TYPES[p.type].w * .5, car: 1, w: 1 })); circles.push(...p.circ); }

// 生成行駛中的車：均勻撒在各路段
const TRAFFIC_EDGES = RN.edges.filter(e => segLenE(e) > 8);
for (let n = 0; n < TRAFFIC_N; n++) {
  const e = TRAFFIC_EDGES[Math.floor(rT() * TRAFFIC_EDGES.length)], dir = rT() < .5 || e.oneway ? 1 : -1;   // 單向的匝道只能從 a 開到 b
  const type = pickType();
  traffic.push({ type, e, dir, s: rT() * segLenE(e), v: 8, turn: null, x: 0, z: 0, yaw: 0, brake: 0, pal: Math.floor(rT() * PAL.length), seed: rT(), stuck: 0, ghost: 0, hit: 0, honk: 0 });
}
// 實車車型有近景與遠景兩級（traffic.glb 的 id／id_far）：每幀依與相機的距離把車分進兩個 InstancedMesh，
// 相機後方的車不畫；路邊停了三百台車，全用近景模型會多出兩三百萬面
const typeMesh = {};
const LOD_NEAR = 40;
const mkInst = (g, cap) => {
  const m = new T.InstancedMesh(g, TRAF_MAT, cap);
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
      const ia = m.geometry.attributes.aIns.array; ia[k * 4] = c.brake; ia[k * 4 + 1] = c.seed; ia[k * 4 + 2] = c.palI; ia[k * 4 + 3] = c.fade || 0;
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

// 前方同一條線上最近的東西有多遠；aheadV 是它的速度（給超車判斷：前面停住的才超）
let aheadV = 0;
function carAhead(c, fx, fz, maxD) {
  let best = maxD;
  const test = (ox, oz, w, v, oy = 0) => {
    if (Math.abs(oy - (c.y || 0)) > 3) return;   // 快速道路的橋上與橋下
    const rx = ox - c.x, rz = oz - c.z;
    const along = rx * fx + rz * fz; if (along <= .5 || along > best) return;
    const lat = Math.abs(rx * fz - rz * fx); if (lat > 1.3 + w) return;
    best = along; aheadV = v;
  };
  for (const o of traffic) if (o !== c) test(o.x, o.z, .4, o.v, o.y);
  if (player.mode === 'drive' && player.veh) test(player.veh.x, player.veh.z, .5, Math.hypot(player.veh.vx, player.veh.vz), player.veh.y);
  else if (player.mode === 'walk' && onRoad(player.x, player.z)) test(player.x, player.z, 0, 9, player.y);   // 走在路上的人：等他過，不繞
  return best;
}
// 超車：前面的車停住（撞壞、玩家停在車道上）而不是在等紅燈時，等兩秒、看對向車道前方 45 m 沒車，就借對向車道繞過去，過了再切回來。
// c.off 是往路中心偏的距離（0 = 自己的車道，2 × LANE = 對向車道中心）
const PASS_OFF = 2 * LANE;
// 讓路：後面 32 m 內有亮著警示燈追上來的警車（69-police.js 的 W.units），靠到車道和路邊停車格之間、減速
const YIELD_OFF = -1.6;
function sirenBehind(c, fx, fz) {
  for (const u of W.units) {
    const v = u.v;
    if (!v || v.dead || !v.lights || !u.drive || u.quiet) continue;   // quiet：69-v9-ai.js 沒有警笛的徵用車與便衣車
    const dx = v.x - c.x, dz = v.z - c.z, a = dx * fx + dz * fz;
    if (a < -2 && a > -32 && Math.abs(dx * fz - dz * fx) < 5 && v.vx * fx + v.vz * fz > 3) return true;
  }
  return false;
}
function oncomingClear(c, fx, fz, d) {
  for (const o of traffic) {
    if (o === c) continue;
    const rx = o.x - c.x, rz = o.z - c.z, along = rx * fx + rz * fz, lat = rx * fz - rz * fx;   // lat > 0：在左手邊（對向）
    if (along > -8 && along < d && lat > LANE * .6 && lat < PASS_OFF + 2.5) return false;
  }
  return true;
}
// ─── 以玩家為中心的生成圈（2026-10-26）：車流與路人集中在玩家附近活動。走出外環、而且鏡頭看不到的，搬回外環上
// （車 100–170 m、人 90–140 m）；移動時外環跟著速度往外推，生成點也偏向前方，開得快時前面的路先排好車。
// 白天 100 m 外還看得清楚，所以只在畫面外、被街區擋住或霧裡的地方生成，車再用點陣淡入（TRAF_MAT）；一直往前走的時候前方大多看得到，
// 連續 RING_LOOSE 次找不到藏得住的點，就放到外環最外圈（r1 前 30 m 內）、淡入慢一點（1.5 s），前面的路才不會變空。
// 一幀最多搬 RING_PER_FRAME 個。超過 hard（車 290 m、人 230 m）的不管看不看得到都搬（和以前一樣）。畫的距離不變（CAR_FAR 等）
// ki／mi、ko／mo：內外環每 m/s 往外推幾公尺與上限（路人走得慢、開車時看不清楚，推得少）
const RING_CAR = { r0: 100, r1: 170, hard: 290, ki: 1.2, mi: 80, ko: 2.5, mo: 110 }, RING_PED = { r0: 90, r1: 140, hard: 230, ki: .6, mi: 40, ko: 1.2, mo: 60 }, RING_PER_FRAME = 2, RING_LOOSE = 3;
const ringV = { x: 0, z: 0, px: NaN, pz: NaN };   // 玩家的平滑速度（m/s），updateTraffic 每幀先算（40-people.js 的路人也用）
function ringTick(dt) {
  const x = pX(), z = pZ();
  if (dt > 0 && ringV.px === ringV.px) {
    const vx = (x - ringV.px) / dt, vz = (z - ringV.pz) / dt, k = 1 - Math.exp(-dt * 2);
    if (vx * vx + vz * vz < 150 * 150) { ringV.x += (vx - ringV.x) * k; ringV.z += (vz - ringV.z) * k; }   // 瞬移不算
  }
  ringV.px = x; ringV.pz = z;
}
// 依速度把外環往外推：時速 100 公里左右車的外環是 133–240 m、路人 107–173 m；外環不超過 hard
function ringR(R) {
  const sp = Math.hypot(ringV.x, ringV.z), r1 = Math.min(R.r1 + Math.min(sp * R.ko, R.mo), R.hard - 10);
  return [Math.min(R.r0 + Math.min(sp * R.ki, R.mi), r1 - 40), r1];
}
// 移動時在背後、離玩家超過內環 20 m 的：先收回來放到前面
function ringBehind(dx, dz, d2, r0) {
  const sp = Math.hypot(ringV.x, ringV.z);
  return sp > 5 && d2 > (r0 + 20) ** 2 && dx * ringV.x + dz * ringV.z < -.3 * Math.sqrt(d2) * sp;
}
// 往前方多放：回傳 0–1 的接受機率，背後的點在速度快時幾乎不放
function ringAhead(x, z, px, pz) {
  const sp = Math.hypot(ringV.x, ringV.z); if (sp < 2) return 1;
  const a = Math.min(sp / 15, 1) * 3, d = Math.hypot(x - px, z - pz) || 1;
  return Math.max(0, 1 + a * ((x - px) * ringV.x + (z - pz) * ringV.z) / (d * sp)) / (1 + a);
}
// 鏡頭看不到 (x, z) 高 h 的東西：在背後或畫面外、霧太濃、或被街區擋住（相機飛高時街區擋不住）
const _ringP = new T.Vector3();
function ringHidden(x, z, h) {
  const cp = camera.position, dx = x - cp.x, dz = z - cp.z, d = Math.hypot(dx, dz);
  const f = d * U.uFogDen.value;
  if (lerp(1 - Math.exp(-f), 1 - Math.exp(-f * f), U.uDay.value) > .9) return true;
  const e = camera.matrixWorld.elements;
  if (dx * -e[8] + dz * -e[10] < 0) return true;
  _ringP.set(x, h, z).project(camera);
  if (Math.abs(_ringP.x) > 1.15 || Math.abs(_ringP.y) > 1.2) return true;
  return cp.y < 40 && !losClear(cp.x, cp.z, x, z);
}
// 車流只有幾十台：走出外環的車搬到外環上的路段，城市再大，眼前的路上都有車。找不到合適的點就留在原地，下一幀再試（c.ringF 記失敗次數）
let ringEdges = null, ringEX = 0, ringEZ = 0;
function trafficRespawn(c, px, pz, [r0, r1]) {
  const loose = (c.ringF || 0) >= RING_LOOSE;
  if (!ringEdges || Math.hypot(px - ringEX, pz - ringEZ) > 30) {   // 玩家附近的路段：走 30 m 重算一次
    ringEX = px; ringEZ = pz;
    ringEdges = TRAFFIC_EDGES.filter(e => { const m = e.pts[0], q = e.pts.at(-1); return Math.min(Math.hypot(m[0] - px, m[1] - pz), Math.hypot(q[0] - px, q[1] - pz)) < 360; });
  }
  if (!ringEdges.length) return false;
  for (let n = 0; n < 40; n++) {
    const e = ringEdges[Math.floor(rT() * ringEdges.length)], dir = rT() < .5 || e.oneway ? 1 : -1;
    const s = rT() * segLenE(e), [x, z] = laneAt(e, dir, s), dd = Math.hypot(x - px, z - pz);
    if (dd < (loose ? r1 - 30 : r0) || dd > r1 || rT() > ringAhead(x, z, px, pz) || traffic.some(o => o !== c && (o.x - x) ** 2 + (o.z - z) ** 2 < 144)) continue;
    const hid = ringHidden(x, z, 1.2);
    if (!hid && !loose) continue;
    Object.assign(c, { e, dir, s, turn: null, v: 6, stuck: 0, ghost: 0, hit: 0, brake: 0, x, z, off: 0, offT: 0, blockT: 0, passS: 0, yieldT: 0, fade: 1, fadeT: hid ? .6 : 1.5, ringF: 0 });
    return true;
  }
  c.ringF = (c.ringF || 0) + 1;
  return false;
}
// 到了路口：直行 .55、右轉 .25、左轉 .2（依出路口的方向和進來的方向的夾角分類），沒路才迴轉
function trafficNext(c) {
  const n = edgeEnd(c.e, c.dir), [, , fx, fz] = laneAt(c.e, c.dir, segLenE(c.e)), opts = [];
  for (const o of n.out) {
    if (o.e === c.e || segLenE(o.e) <= 8 || o.e.oneway && o.dir !== o.e.oneway) continue;
    const [gx, gz] = outDir(o.e, o.dir), dot = fx * gx + fz * gz, cr = fx * gz - fz * gx;
    if (dot < -.5) continue;
    opts.push([o, dot > .7 ? .55 : cr > 0 ? .25 : .2]);
  }
  if (!opts.length) return { e: c.e, dir: -c.dir };
  let r = rT() * opts.reduce((a, o) => a + o[1], 0);
  for (const [o, w] of opts) { if (r < w) return o; r -= w; }
  return opts[0][0];
}
function updateTraffic(dt, t) {
  ringTick(dt);
  const ppx = pX(), ppz = pZ(), ring = ringR(RING_CAR);
  let ringN = RING_PER_FRAME;
  for (const c of traffic) {
    if (c.fade > 0) c.fade = Math.max(0, c.fade - dt / (c.fadeT || .6));
    if (ringN > 0 && !c.turn && c.hit <= 0) {
      const dx = c.x - ppx, dz = c.z - ppz, d2 = dx * dx + dz * dz;
      if (d2 > RING_CAR.hard ** 2 || (ringBehind(dx, dz, d2, ring[0]) || d2 > (ring[1] + 20) ** 2) && ringHidden(c.x, c.z, 1.2)) { ringN--; trafficRespawn(c, ppx, ppz, ring); }
    }
    if (c.hit > 0) { c.hit -= dt; c.v = damp(c.v, 0, 4, dt); }
    let fx, fz;
    if (c.turn) { const tg = bezTan(c.turn.p0, c.turn.p1, c.turn.p2, c.turn.t); const l = Math.hypot(tg[0], tg[1]) || 1; fx = tg[0] / l; fz = tg[1] / l; }
    else [, , fx, fz] = laneAt(c.e, c.dir, c.s);
    let want = TYPES[c.type].vmax * (.85 + c.seed * .3) * (!c.turn && c.e.kind === 'f' && !c.e.ramp ? 1.35 : 1);   // 快速道路開快一點（匝道不算）
    aheadV = 9;
    const gap = c.ghost > 0 ? 99 : carAhead(c, fx, fz, 22);
    const half = TYPES[c.type].len / 2;
    if (gap < 22) want = Math.min(want, Math.max(0, (gap - half - 3.2) * 1.1));
    let atLight = false;
    if (!c.turn) {
      const L = segLenE(c.e), n = edgeEnd(c.e, c.dir);
      const st = n.nosig ? 2 : lightState(n.i, n.j, edgeAx(n, c.e), t);   // 高架上的分合流點沒有號誌
      const stopS = L - 4.4 - half;
      if (st !== 2 && c.s < stopS + .5) {
        const dist = stopS - c.s;
        if (st === 0 || dist > c.v * 1.2) want = Math.min(want, Math.max(0, dist * .9));
        atLight = dist < 30;
      }
      // 超車
      c.off ||= 0; c.offT ||= 0;
      const left = L - c.s;
      if (!c.offT && gap < 14 && aheadV < .5 && !atLight && c.hit <= 0) {
        c.blockT = (c.blockT || 0) + dt;
        if (c.blockT > 2 && left > gap + 22 && oncomingClear(c, fx, fz, 45)) { c.offT = PASS_OFF; c.passS = c.s + gap + 9; c.blockT = 0; }
      } else c.blockT = 0;
      if (c.offT > 0 && (c.s > c.passS || left < 14)) c.offT = 0;
      if (c.offT > 0) want = Math.max(want, Math.min(6, TYPES[c.type].vmax * .5));   // 借道時不理會原本車道上停著的車
      if (c.hit <= 0 && W.units.length && sirenBehind(c, fx, fz)) c.yieldT = 1.2;
      if (c.yieldT > 0) { c.yieldT -= dt; c.offT = c.yieldT > 0 ? YIELD_OFF : 0; want = Math.min(want, 2.5); }
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
        c.e = c.turn.o.e; c.dir = c.turn.o.dir; c.s = over; c.turn = null;
      }
    } else {
      c.s += c.v * dt;
      if (c.s >= segLenE(c.e)) {
        const o = trafficNext(c), tp = turnPathE(c.e, c.dir, o.e, o.dir);
        c.turn = { ...tp, t: (c.s - segLenE(c.e)) / tp.len, o };
        c.off = c.offT = 0;
      }
    }
    // 往目標偏移量橫移（每秒 2.4 m），車頭跟著偏一點
    const dOff = c.turn ? 0 : clamp((c.offT || 0) - (c.off || 0), -2.4 * dt, 2.4 * dt);
    if (!c.turn) c.off = (c.off || 0) + dOff;
    // 世界座標
    let px, pz, yaw;
    if (c.turn) { const q = bez(c.turn.p0, c.turn.p1, c.turn.p2, Math.min(c.turn.t, 1)); px = q[0]; pz = q[1]; const tg = bezTan(c.turn.p0, c.turn.p1, c.turn.p2, Math.min(c.turn.t, 1)); yaw = Math.atan2(tg[0], tg[1]); }
    else { let fx2, fz2; [px, pz, fx2, fz2] = laneAt(c.e, c.dir, c.s, LANE - c.off); yaw = Math.atan2(fx2, fz2) + (dOff && c.v > .5 ? Math.atan2(dOff / dt, c.v) : 0); }
    c.x = px; c.z = pz; c.yaw = yaw;
    // 快速道路的上下坡（06-roads.js 的 fwyH）：路口裡是路口的高度（高架上的分合流點 n.y，其他是地面）
    let cy = c.turn ? edgeEnd(c.e, c.dir).y || 0 : 0, cp = 0;
    if (!c.turn && c.e.kind === 'f') { const u = c.dir > 0 ? HR + c.s : c.e.len - HR - c.s; cy = fwyH(c.e, u); cp = -Math.atan((fwyH(c.e, u + c.dir) - cy)); }
    c.y = cy;
    c.pitch = cp + (c.brake && c.v > 1 ? -.012 : 0);
    placeCar(c, 0, cy);
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
  const sp0 = isCar ? KESTREL_SPOT : HANZO_SPOT, sp = cityIsWorld ? sp0 : spotW(sp0);   // 開場（cityWorld() 之前）還是邏輯座標
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
const carHooks = [];   // applyCar 換好車之後呼叫 (v, id)：66-chrome.js 把這台車裝過的改裝套件疊上去
function applyCar(v, id, paint) {
  const c = CARS[id], f = c.glb && !c.bike ? CARS[c.proxy] : c;
  disposeKit(v.body); v.body.clear();
  for (const w of v.wheels) w.piv.parent && w.piv.parent.remove(w.piv);
  v.wheels.length = 0;
  v.isCar = !c.bike; v.glbTok = (v.glbTok || 0) + 1; v.inst = null; v.modG = null;
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
  vehClass(v, carClass(id), false);   // 25-cars.js：質量、耐久、轉向與手煞車照級距表，極速與抓地保留這台車自己的
  if (c.real) {   // 26-glb.js 的原廠規格：車重、轉向、手煞車、耐久與煞車也是這台車自己的
    const k = v.hpMax ? clamp(v.hp / v.hpMax, 0, 1) : 1;
    v.mass = c.m; v.turn = c.turn; v.hbGrip = c.drift * 10 * DRIFT_K; v.hpMax = c.hp; v.hp = c.hp * k;
  }
  v.brk = c.brk || 16;
  tireReset(v);   // 換車就是新輪胎（68-wreck.js）
  for (const h of carHooks) h(v, id);   // 66-chrome.js：CHROME WORKS 的改裝套件
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
    v.inst = inst;
    for (const h of carHooks) h(v, id, true);   // 66-chrome.js：改裝件掛回新的車身、烤漆材質
  });
}
const kestrel = mkVehicle('kestrel'), hanzo = mkVehicle('hanzo');   // kestrel：玩家座駕（換車都走 applyCar）；hanzo：路邊的機車
applyCar(hanzo, STREET_BIKE);
const vehicles = [kestrel, hanzo];

// 碰撞：圓對 AABB、圓對圓；回傳推出量與法線
const dynCircles = [];   // 會動的圓（世界座標，每幀重建）：21-coast.js 的岸橋腳與集卡
const dynMore = [];   // 會動的圓（世界座標，各自更新位置）：69-v5-street.js 被推著走的紐澤西護欄
let colY = 0;   // 正在算碰撞的東西離地多高：高過 hy 的圓與盒不擋（車開在鐵灣高架斷橋、快速道路橋面上時，橋下的柱子不算），低於 ly 的盒不擋（橋面的護欄只擋橋上的）
function collideCircle(x, z, r, skipCar, swimmer) {   // swimmer：玩家步行，可以穿過沙灘外緣的擋牆下水
  let nx = 0, nz = 0, hit = 0;
  for (const b of boxesNear(x, z, r)) {
    if (swimmer && b.swim || b.ly != null && colY < b.ly || b.hy != null && colY > b.hy) continue;
    if (boxGap(b, x, z) > r) continue;
    if (b.f && b.f.A) { const o = quadPush(b, x, z, r); if (o) { x = o[0]; z = o[1]; nx += o[2]; nz += o[3]; hit = 1; } continue; }
    // 盒在所屬區的框裡是 AABB：點換進去算，推出後的點與法線再轉回世界
    let [lx, lz] = b.f ? toL(x, z, b.f) : [x, z], ex = 0, ez = 0;
    const cx = clamp(lx, b.x0, b.x1), cz = clamp(lz, b.z0, b.z1);
    let dx = lx - cx, dz = lz - cz; const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 < 1e-8) { // 圓心在盒內：往最近的邊推
        const e = [lx - b.x0, b.x1 - lx, lz - b.z0, b.z1 - lz]; const m = Math.min(...e);
        if (m === e[0]) { lx = b.x0 - r; ex = -1; } else if (m === e[1]) { lx = b.x1 + r; ex = 1; } else if (m === e[2]) { lz = b.z0 - r; ez = -1; } else { lz = b.z1 + r; ez = 1; }
      } else { const d = Math.sqrt(d2); lx = cx + dx / d * r; lz = cz + dz / d * r; ex = dx / d; ez = dz / d; }
      if (b.f) { [x, z] = toW(lx, lz, b.f); [ex, ez] = dirW(b.f, ex, ez); } else { x = lx; z = lz; }
      nx += ex; nz += ez; hit = 1;
    }
  }
  for (const c of dynCircles.length || dynMore.length ? [...circlesNear(x, z, r), ...dynCircles, ...dynMore] : circlesNear(x, z, r)) {
    if (skipCar && c.car || c.hy != null && colY > c.hy) continue;
    const dx = x - c.x, dz = z - c.z, rr = r + c.r, d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 1e-8) { const d = Math.sqrt(d2); x = c.x + dx / d * rr; z = c.z + dz / d * rr; nx += dx / d; nz += dz / d; hit = 1; }
  }
  return { x, z, nx, nz, hit };
}
// 仿射框的盒（彎曲的片，10-city.js 的 boxToW）在世界裡是平行四邊形：直接在世界座標算圓對凸四邊形（框裡的距離被斜切拉歪了，不能在框裡算）。
// 圓心在裡面就從最近的邊推出去，在外面就推離最近點；回傳 [x, z, 法線 x, 法線 z]，沒碰到是 null
function quadPush(b, x, z, r) {
  const q = b.q || (b.q = rectW(b.x0, b.x1, b.z0, b.z1, b.f)), [lx, lz] = toL(x, z, b.f), inside = lx > b.x0 && lx < b.x1 && lz > b.z0 && lz < b.z1;
  const ox = b.f.ox, oz = b.f.oz;
  let best = Infinity, px = 0, pz = 0, k = 0;
  for (let i = 0; i < 4; i++) {
    const [ax, az] = q[i], [bx, bz] = q[(i + 1) & 3], ex = bx - ax, ez = bz - az, t = clamp(((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1), 0, 1);
    const cx = ax + ex * t, cz = az + ez * t, d2 = (x - cx) ** 2 + (z - cz) ** 2;
    if (d2 < best) { best = d2; px = cx; pz = cz; k = i; }
  }
  if (inside) {
    const [ax, az] = q[k], [bx, bz] = q[(k + 1) & 3], l = Math.hypot(bx - ax, bz - az) || 1;
    let ex = (bz - az) / l, ez = -(bx - ax) / l;
    if (ex * (ax - ox) + ez * (az - oz) < 0) { ex = -ex; ez = -ez; }   // 法線朝外（盒心在框的原點）
    return [px + ex * r, pz + ez * r, ex, ez];
  }
  if (best >= r * r || best < 1e-12) return null;
  const d = Math.sqrt(best), ex = (x - px) / d, ez = (z - pz) / d;
  return [px + ex * r, pz + ez * r, ex, ez];
}
// 兩個圓代表車身前後，跟靜態物、停車與車流碰撞
// 擦牆：入射角 30° 以內算擦過（SCRAPE_SIN = sin 30°），擦著時速度每秒衰減 SCRAPE_DRAG，車頭每秒往牆的方向轉 SCRAPE_ALIGN 的比例
const SCRAPE_SIN = .5, SCRAPE_DRAG = .55, SCRAPE_ALIGN = 2.5;
function vehicleCollide(v, dt) {
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  const off = v.off;
  let impact = 0, ram = null;
  for (const s of [1, -1]) {
    const cx = v.x + fx * off * s, cz = v.z + fz * off * s;
    colY = v.y || 0;
    let r = collideCircle(cx, cz, v.rad, false);
    colY = 0;
    let px = r.x - cx, pz = r.z - cz, nx = r.nx, nz = r.nz;
    const near = (v.rad * 2 + 15) ** 2;   // 車流車的兩個圓心離車中心最多 len × .3、半徑最多半個車寬：遠的不用算地面高度（groundH 要反算彎曲，每台車每幀兩次 × 整個車流）
    for (const c of traffic) {
      if ((c.x - cx) ** 2 + (c.z - cz) ** 2 > near) continue;
      const cy = c.y || groundH(c.x, c.z);
      if (c === v.under || v.y > 1.1 && v.y > cy + 1.1 || cy > v.y + 2.5) continue;   // 68-roll.js：疊在車頂上、剛從車頂開下來或從上面飛過；快速道路橋上與橋下
      const L = TYPES[c.type].len * .3;
      for (const t of [-1, 1]) {
        const ox = c.x + Math.sin(c.yaw) * L * t, oz = c.z + Math.cos(c.yaw) * L * t;
        const dx = cx + px - ox, dz = cz + pz - oz, rr = v.rad + TYPES[c.type].w * .5, d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-6) {
          const d = Math.sqrt(d2), push = rr - d; px += dx / d * push; pz += dz / d * push; nx += dx / d; nz += dz / d;
          if (c.hit <= 0) { c.hit = 2.5 + Math.random() * 2; c.honk = 0; sfx.horn(c); }
          // 68-roll.js：高速撞上去（相對速度 18 m/s 以上）就把車流車撞離車道
          const rel = -((v.vx - Math.sin(c.yaw) * c.v) * dx + (v.vz - Math.cos(c.yaw) * c.v) * dz) / d;
          if (v.isCar && !v.tumble && rel > 18 && (!ram || rel > ram.rel)) ram = { c, rel, nx: -dx / d, nz: -dz / d };
        }
      }
    }
    if (px || pz) {
      v.x += px; v.z += pz;
      const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
      const vn = v.vx * nx + v.vz * nz, sp = Math.hypot(v.vx, v.vz);
      // 擦牆（入射角小於 SCRAPE_DEG）：只去掉法向速度、切向留著，車頭被帶向牆的方向，噴火花；正面撞：反彈並掉一成速度（彈出車外在 69-v3-crash.js）
      if (vn < 0 && v.isCar && sp > 6 && -vn < sp * SCRAPE_SIN) {
        v.vx -= vn * nx * 1.05; v.vz -= vn * nz * 1.05;
        const k = Math.exp(-SCRAPE_DRAG * dt); v.vx *= k; v.vz *= k;
        const tx = -nz, tz = nx, dir = Math.sign(v.vx * tx + v.vz * tz) || 1, fwd = Math.sign(v.vx * fx + v.vz * fz) || 1;
        v.yaw += wrapA(Math.atan2(tx * dir * fwd, tz * dir * fwd) - v.yaw) * Math.min(1, SCRAPE_ALIGN * dt);
        if (Math.random() < dt * 40 && Math.hypot(v.x - pX(), v.z - pZ()) < 80) sparks(cx + px - nx * v.rad, (v.y || 0) + .45, cz + pz - nz * v.rad, 3, 3);
        v.scrape = .15; impact = Math.max(impact, -vn * .5);
      } else if (vn < 0) { v.vx -= vn * nx * 1.25; v.vz -= vn * nz * 1.25; v.vx *= .9; v.vz *= .9; impact = Math.max(impact, -vn); }
    }
  }
  if (ram) rollRam(v, ram.c, ram.rel, ram.nx, ram.nz);
  return impact;
}
// 基礎加速調降 25%（2026-10-26）：踩油門時的淨加速度（推力減阻力）乘 ACC_K，0–100 等等的時間變成 1/0.75 倍；
// 到極速時推力等於阻力、扣掉的是 0，所以極速不變（只把推力乘 0.75 的話，阻力沒變，淨加速度掉得更多、極速也會掉）
const ACC_K = .75;
function driveVehicle(v, inp, dt) {
  if (v.bail && v !== player.veh) inp = BAIL_INP;   // 68-wreck.js：起火後駕駛跳車，車子滑行到停
  if (v.tumble) return rollStep(v, dt);   // 68-roll.js：翻滾中、側躺或倒扣
  if (v.flipped) return flipStep(v, v === player.veh ? inp : null, dt);
  if (v.flood) inp = FLOOD_INP;   // 68-vdetail.js：引擎進水熄火
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), rx = -fz, rz = fx;
  let vF = v.vx * fx + v.vz * fz, vR = v.vx * rx + v.vz * rz;
  const spd = Math.abs(vF);
  const hold = vdPre(v, inp, dt, vF);   // 68-vdetail.js：原地燒胎、甜甜圈、濕沙卡軸（沙地阻力寫在 vdK／vdDrag）
  const maxSt = lerp(v.isCar ? .55 : .5, v.isCar ? .12 : .1, clamp(spd / 45, 0, 1));
  v.steer = damp(v.steer, inp.steer * maxSt * (v.stK || 1) * clamp((v.turn || 1.05) / 1.05, .6, 1.4), inp.steer ? 6 : 9, dt);   // 級距表的轉向靈敏度（以轎跑 1.05 為基準）
  let aF = 0;
  if (inp.thr > 0) {
    const th = v.eng * (v.engK ?? 1) * v.vdK * inp.thr * (1 - (vF / v.vmax) ** 2) * (vF < 8 ? 1.25 : 1);   // engK：68-wreck.js 的車損與熄火
    aF += th - (1 - ACC_K) * Math.max(0, th - (Math.max(vF, 0) * .12 + .35 + v.vdDrag));
  }
  if (inp.brk > 0) aF += vF > .8 ? -(v.brk || 16) * inp.brk * (v.brkK || 1) : -6 * (v.revK || 1) * inp.brk * (vF > -9 ? 1 : 0);   // revK：66-chrome.js 的變速箱，倒車起步比較快
  aF -= vF * .12 + Math.sign(vF) * (.35 + v.vdDrag);
  if (inp.hb) aF -= Math.sign(vF) * 4;
  vF += aF * dt;
  if (!inp.thr && !inp.brk && Math.abs(vF) < .3) vF = 0;
  if (hold) { if (hold.vF != null) vF = hold.vF; if (hold.min) vF = Math.max(vF, hold.min); }
  const grip = (inp.hb ? (v.hbGrip ?? 1.4) : v.grip * (1 - clamp((Math.abs(vR) - 3) / 10, 0, .6))) * (v.slideT > 0 ? .25 : 1);   // slideT：被撞得打轉（69-kinema.js）
  vR *= Math.exp(-grip * dt);
  if (hold && hold.vR != null) vR = hold.vR;
  const wb = v.wb;
  let targetYr = vF * Math.tan(v.steer) / wb + ((v.flatYr || 0) + (v.axleYr || 0)) * clamp(vF / 12, -1, 1);   // axleYr：69-v6-customs.js 撞歪的輪軸   // 68-wreck.js：破胎那一側被拖住，車頭往那邊偏
  if (inp.hb && spd > 6) targetYr += inp.steer * 1.1;
  v.yr = hold && hold.yr != null ? hold.yr : damp(v.yr, targetYr, v.isCar ? 7 : 9, dt);
  v.yaw += v.yr * dt;
  kinYaw(v, dt);
  // 甩尾時把一部分前進速度轉成側滑
  if (inp.hb && spd > 6) vR += v.yr * vF * .045 * dt * 60 * .016;
  v.slip = hold && hold.slip != null ? hold.slip : Math.abs(vR);
  const nfx = Math.sin(v.yaw), nfz = Math.cos(v.yaw), nrx = -nfz, nrz = nfx;
  v.vx = nfx * vF + nrx * vR; v.vz = nfz * vF + nrz * vR;
  if (hold && hold.piv) { const h = wb / 2; v.vx = (fx - nfx) * h / dt; v.vz = (fz - nfz) * h / dt; }   // 甜甜圈：前軸那一點不動，車尾甩出去
  v.x += v.vx * dt; v.z += v.vz * dt;
  const imp = vehicleCollide(v, dt);
  const gh = v.isCar ? surfaceH(v) : deckAt(v.x, v.z, v.y) ?? groundH(v.x, v.z);   // 68-roll.js：疊在別台車的車頂上；06-roads.js：快速道路的橋面
  v.y = vdWater(v, dt, gh) ?? damp(v.y, gh, 18, dt);   // 68-vdetail.js：下水、沉到海底
  // 車身姿態：側傾、俯仰、機車壓車
  const latA = vF * v.yr;
  v.roll = damp(v.roll, v.isCar ? clamp(latA * .006, -.06, .06) : 0, 6, dt);
  v.pitch = damp(v.pitch, clamp(-aF * .0035, -.04, .04), 6, dt);
  v.lean = damp(v.lean, v.isCar ? 0 : clamp(-latA * .045, -.7, .7), 7, dt);
  v.spin += hold && hold.spin != null ? hold.spin * dt : vF * dt / v.wr;
  const kmh = Math.abs(vF) * 3.6;
  const gears = [0, 38, 72, 108, 146, 999];
  let g = 1; while (g < 5 && kmh > gears[g]) g++;
  v.gear = vF < -.5 ? 'R' : g;
  v.rpm = hold && hold.rpm != null ? hold.rpm : clamp(.18 + (kmh - gears[g - 1]) / (gears[g] - gears[g - 1] || 40) * .8, .12, 1) * (inp.thr ? 1 : .8);
  v.brakeOn = inp.brk && vF > .5 ? 1 : 0;
  return { imp, vF, aF };
}
const _rake = V3();
function poseVehicle(v) {
  v.g.position.set(v.x, v.y, v.z);
  v.g.rotation.set(0, v.yaw, 0);
  v.body.rotation.set(v.pitch + (v.sagP || 0) + (v.hydP || 0), 0, (v.isCar ? v.roll : v.lean) + (v.sagR || 0) + (v.hydR || 0), 'YXZ');   // sag：68-wreck.js 的破胎下沉；hyd：69-v6-customs.js 的液壓起伏
  // 跳台飛行中（69-stunt.js）與翻車（68-roll.js）繞車身中心翻轉，平常繞著地面
  if ((v.air || v.tumble || v.flipped) && v.isCar) { const h = .7, cr = Math.cos(v.roll); v.body.position.set(h * Math.sin(v.roll), h * (1 - cr * Math.cos(v.pitch)), -h * cr * Math.sin(v.pitch)); }
  else if (v.isCar && (v.rideY || v.hydY)) v.body.position.set(0, (v.rideY || 0) + (v.hydY || 0), 0);   // 66-chrome.js 的降低懸吊：車身往輪子壓下去；液壓升降
  else if (v.body.position.lengthSq()) v.body.position.set(0, 0, 0);
  for (const w of v.wheels) {
    if (v.isCar) { w.piv.rotation.set(0, w.front ? v.steer : 0, 0); w.w.rotation.x = v.spin; }
    else if (w.rake) { const r = w.rake * Math.PI / 180; w.piv.quaternion.setFromAxisAngle(_rake.set(0, Math.cos(r), -Math.sin(r)), v.steer * .6); w.w.rotation.x = v.spin; }   // 實車機車：前輪連同前叉、車把繞後傾的轉向軸轉
    else { w.piv.rotation.set(0, w.front ? v.steer * .6 : 0, 0); w.w.rotation.x = v.spin; }
  }
  v.mat.uniforms.uM.value.set(v.lights * lerp(.3, 1, atm.lamp), v.brakeOn || 0, 1, v.burn || 0);   // 白天大燈暗一點（28-sky.js）
  if (v.ins) { v.ins.array[0] = v.brakeOn || 0; v.ins.needsUpdate = true; }   // 搶來的車流車（68-gta.js）：煞車燈在 aIns
}
vehicles.forEach(v => { v.y = groundH(v.x, v.z); poseVehicle(v); });
