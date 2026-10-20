
// ═══ VELOCE MOTORS 車行與 GARAGE 07 車庫：展示廳、車庫、買車／試駕／開車出庫／賣車、甩尾賺錢與存檔 ═══
ENV.show = { lampOn: 0, wet: 0, fogDen: .012, fog: 0x1a1814, fogHi: 0x2a2620, top: 0x8a8070, bot: 0x4a4238 };
ENV.home = { lampOn: 0, wet: 0, fogDen: .03, fog: 0x14181c, fogHi: 0x20262a, top: 0x6a767a, bot: 0x3a3a36 };
const money = n => '$' + Math.round(n).toLocaleString('en-US');
const carPrice = id => CARS[id].price;
const sellPrice = id => Math.round(CARS[id].price * .6 / 1000) * 1000;

// ─── 車庫存檔：現金、擁有的車、各車塗裝、目前開在街上的那台 ───
const MOTOR_KEY = 'nc260.motors';
const motors = { cash: 180000, owned: ['kestrel'], paint: {}, cur: 'kestrel', stowed: false, test: null };
try {
  const d = JSON.parse(localStorage.getItem(MOTOR_KEY) || 'null');
  if (d && typeof d === 'object') {
    if (Number.isFinite(d.cash)) motors.cash = clamp(Math.round(d.cash), 0, 1e9);
    if (Array.isArray(d.owned)) motors.owned = ['kestrel', ...d.owned.filter((id, i, a) => CARS[id] && id !== 'kestrel' && a.indexOf(id) === i)];
    if (d.paint && typeof d.paint === 'object') for (const id in d.paint) if (CARS[id] && Number.isInteger(d.paint[id])) motors.paint[id] = d.paint[id];
    if (motors.owned.includes(d.cur)) motors.cur = d.cur;
  }
} catch (e) { /* 私密視窗或封鎖儲存空間：用預設值 */ }
function saveMotors() {
  try { localStorage.setItem(MOTOR_KEY, JSON.stringify({ cash: motors.cash, owned: motors.owned, paint: motors.paint, cur: motors.cur })); } catch (e) { /* 存不了就算了 */ }
}
function earn(n, why) {
  motors.cash += n; saveMotors();
  toast(`${why} +${money(n)}`);
  const el = $('cash'); el.classList.remove('up'); void el.offsetWidth; el.classList.add('up');
}
if (motors.cur !== 'kestrel' || motors.paint.kestrel != null) { applyCar(kestrel, motors.cur, motors.paint[motors.cur]); poseVehicle(kestrel); }
function placeCarAt(sp) {
  const v = kestrel;
  v.x = sp.x; v.z = sp.z; v.yaw = sp.yaw; v.vx = v.vz = v.yr = v.steer = 0; v.y = groundH(v.x, v.z); v.g.visible = true;
  poseVehicle(v);
}
// 規格：極速照實換算，加速與抓地用五格評分（遊戲裡的加速度是街機手感，換成秒數會很怪）
const dots = (v, lo, hi) => { const n = clamp(Math.round(1 + (v - lo) / (hi - lo) * 4), 1, 5); return '●'.repeat(n) + '○'.repeat(5 - n); };
const carStats = id => {
  const c = CARS[id];
  return `極速 ${Math.round(c.vmax * 3.6)} km/h · 加速 ${dots(c.eng, 6.5, 22)} · 抓地 ${dots(c.grip, 6.8, 11)}`;
};

// ─── 展示廳：門在 z = 0，室內 x -16..16、z 0..30、挑高 7 m ───
const showScene = new T.Scene();
const show = { boxes: [], circles: [], lights: [], cars: [], spin: [], people: null };
const SHOW_ROWS = [
  ['doodle', 'kanto', 'bulldog', 'ronin', 'mamba', 'lucerna'],
  ['duchess', 'saetta', 'halcyon', 'solenne', 'furia', 'meridian'],
];
const SELLER = { x: 11, z: 27.4 };
{
  const k = new Kit(), B = show.boxes, S = showScene, gold = 0xffcf6a;
  const wall = (x0, x1, z0, z1, h, col, mat = 2) => { k.box((x0 + x1) / 2, h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0, col, mat); B.push({ x0, x1, z0, z1 }); };
  // 地板：拋光深灰石材與淺色石縫；天花板三條長燈帶
  k.box(0, -.05, 15, 32.4, .1, 30.4, 0x2a2b2f, 10);
  for (let x = -14; x <= 14; x += 2) k.box(x, .002, 15, .025, .004, 30, 0x45464c, 10);
  for (let z = 2; z < 30; z += 2) k.box(0, .002, z, 32, .004, .025, 0x45464c, 10);
  k.box(0, 7.05, 15, 32.4, .1, 30.4, 0x141518, 2);
  for (const x of [-10, 0, 10]) { k.box(x, 6.97, 15, .5, .05, 27, 0xfff4e4, 11); k.box(x, 6.99, 15, .8, .02, 27.4, 0x2a2b30, 15); }
  // 側牆：暖灰石材牆＋金色腰線；後牆：深色木格柵
  wall(-16.4, -16, 0, 30, 7.05, 0x9a948a); wall(16, 16.4, 0, 30, 7.05, 0x9a948a);
  for (const s of [-1, 1]) { k.box(s * 15.97, 1.1, 15, .04, .04, 30, gold, 8); k.box(s * 15.95, .06, 15, .06, .12, 30, 0x111214, 2); }
  wall(-16.4, 16.4, 30, 30.4, 7.05, 0x24180f);
  for (let x = -15.6; x <= 15.6; x += .52) k.box(x, 3.5, 29.96, .3, 7, .07, 0x5e3c22, 10);
  // 前牆：兩片雨窗、玻璃門、上方門楣
  k.box(0, 6.1, -.2, 32.8, 1.9, .4, 0x15161a, 2);
  for (const s of [-1, 1]) k.box(s * 8.9, .15, -.2, 15, .3, .4, 0x15161a, 2);
  B.push({ x0: -16.4, x1: -1.4, z0: -.4, z1: 0 }, { x0: 1.4, x1: 16.4, z0: -.4, z1: 0 }, { x0: -1.4, x1: 1.4, z0: -.7, z1: -.3 });
  k.box(0, 1.5, -.3, 2.8, 3, .06, 0x0a0c10, 1).box(0, 4.07, -.25, 2.8, 2.15, .05, 0x0a0c10, 1);
  k.box(0, 3.02, -.25, 2.9, .08, .1, gold, 3);
  for (const s of [-1, 1]) { k.box(s * 1.42, 2.6, -.2, .1, 5.1, .12, gold, 3); k.box(s * .25, 1.15, -.24, .04, .9, .04, 0xd8dce2, 3); }
  for (const x of [-15.9, -12.6, -9.2, -5.8, -1.5, 1.5, 5.8, 9.2, 12.6, 15.9]) k.box(x, 2.7, -.02, .08, 4.9, .08, 0xc8ccd2, 3);
  k.box(0, 5.15, -.02, 32, .08, .08, 0xc8ccd2, 3);
  // 展示台：圓形台座與金色燈環；台前一支規格立牌
  SHOW_ROWS.forEach((row, r) => row.forEach((id, i) => {
    const x = -12.5 + i * 5, z = r ? 19 : 9, yaw = Math.PI + Math.sign(x) * .5, spin = r === 1 && (i === 2 || i === 3);
    if (!spin) {
      k.cyl(x, .06, z, 2.35, 2.4, .12, 44, 0x1c1d21, 10);
      k.add(new T.TorusGeometry(2.37, .022, 4, 56), gold, 8, tf(x, .12, z, Math.PI / 2, 0, 0));
    }
    const px = x + Math.sin(yaw) * 2.95, pz = z + Math.cos(yaw) * 2.95;
    if (r === 0 || spin) {
      k.box(px, .4, pz, .04, .8, .04, 0xc8ccd2, 3).box(px, .02, pz, .26, .04, .26, 0x111214, 2);
      k.box(px, .82, pz, .4, .26, .03, 0x15161a, 2, -.6, yaw).box(px + Math.sin(yaw) * .012, .83, pz + Math.cos(yaw) * .012, .34, .2, .02, 0x4a4438, 11, -.6, yaw);
      show.circles.push({ x: px, z: pz, r: .18 });
    }
    show.cars.push({ id, x, z, yaw, spin });
    show.circles.push({ x, z, r: 2.3, car: 1 });
  }));
  // 業務的桌子（右後）、休息區沙發與茶几（左後）、盆栽
  k.box(11, .5, 26.4, 4.2, 1, 1.1, 0xe6e0d4, 10).box(11, 1.03, 26.4, 4.4, .06, 1.3, 0x2a2420, 10).box(11, .5, 25.84, 4.2, .9, .02, gold, 11);
  k.box(10.2, 1.2, 26.6, .5, .32, .03, 0x0a0c10, 1, -.2).box(10.2, 1.07, 26.4, .5, .02, .34, 0x1a1b1e, 2);
  k.box(11.3, .5, 28.1, .55, .1, .55, 0x1a1b1e, 2).box(11.3, .9, 28.4, .55, .7, .1, 0x1a1b1e, 2);
  B.push({ x0: 8.8, x1: 13.2, z0: 25.75, z1: 27.05 });
  for (const [x, z, w, d] of [[-12.6, 27.6, 4.6, 1.0], [-14.6, 25.2, 1.0, 3.8]]) {
    k.box(x, .25, z, w, .5, d, 0x4a2a1c, 2);
    k.box(x + (d > w ? -.4 : 0), .7, z + (d > w ? 0 : .4), d > w ? .2 : w, .5, d > w ? d : .2, 0x4a2a1c, 2);
    B.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
  }
  k.cyl(-12, .38, 25, .7, .7, .04, 24, 0x1a1b1e, 10).cyl(-12, .19, 25, .08, .1, .38, 8, 0xd8dce2, 3);
  show.circles.push({ x: -12, z: 25, r: .7 });
  for (const [x, z] of [[-15.2, 1.2], [15.2, 1.2], [-15.2, 29], [7.6, 29]]) {
    k.cyl(x, .35, z, .32, .26, .7, 14, 0x1a1b1e, 10);
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; k.add(new T.ConeGeometry(.12, 1.1, 5), 0x2a4a2c, 2, tf(x + Math.cos(a) * .12, 1.15, z + Math.sin(a) * .12, Math.sin(a) * .3, 0, -Math.cos(a) * .3)); }
    show.circles.push({ x, z, r: .4 });
  }
  S.add(new T.Mesh(k.build(), MAT.uber));
  // 車：固定的直接擺上台，中間兩台放在轉盤上慢慢轉
  for (const c of show.cars) {
    const m = new T.Mesh(carKit(c.id).build(), MAT.uber);
    if (c.spin) {
      const g = new T.Group(); g.position.set(c.x, 0, c.z); g.rotation.y = c.yaw;
      const tk = new Kit().cyl(0, .06, 0, 2.35, 2.4, .12, 44, 0x1c1d21, 10).add(new T.TorusGeometry(2.37, .022, 4, 56), gold, 8, tf(0, .12, 0, Math.PI / 2, 0, 0));
      for (let i = 0; i < 12; i++) tk.box(Math.cos(i / 12 * Math.PI * 2) * 2.0, .125, Math.sin(i / 12 * Math.PI * 2) * 2.0, .25, .01, .04, gold, 11, 0, -i / 12 * Math.PI * 2);
      g.add(new T.Mesh(tk.build(), MAT.uber));
      m.position.y = .12; g.add(m); S.add(g);
      show.spin.push({ g, c, a0: c.yaw });
    } else { m.position.set(c.x, .12, c.z); m.rotation.y = c.yaw; S.add(m); }
  }
  // 後牆上的招牌
  const sg = new T.PlaneGeometry(9, 2.25); const uv = sg.attributes.uv; const c = cells.VELOCE;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, lerp(c.u0, c.u1, uv.getX(i)), lerp(c.v0, c.v1, uv.getY(i)));
  sg.setAttribute('aS', new T.Float32BufferAttribute(new Array(uv.count).fill(0).flatMap(() => [.6, 0, 1.6, 0]), 4));
  const sm = new T.Mesh(sg, MAT_SIGN); sm.position.set(0, 4.7, 29.88); sm.rotation.y = Math.PI; S.add(sm);
  // 前窗：雨夜街景
  for (const s of [-1, 1]) {
    const m = new T.Mesh(new T.PlaneGeometry(14.8, 4.85), new T.ShaderMaterial({ uniforms: shared(ALLU), vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`, fragmentShader: WINDOW_FS }));
    m.position.set(s * 8.9, 2.725, -.05); S.add(m);
  }
}
{
  const cr = crowd(4); const rc = rng(707);
  const list = [
    [ANIM.talk, SELLER.x, 0, SELLER.z, Math.PI, { top: lin(0x1b2230), bot: lin(0x15171c), skin: SKINS[1], hair: lin(0x1a1410), longHair: 0, coat: 1, skirt: 0, hat: 0, glowI: 0 }],
    [ANIM.idle, -3.2, 0, 13.6, Math.PI - .4], [ANIM.talk, -2.2, 0, 13.9, -2.2],
    [ANIM.sit, -12.6, -.12, 27.3, Math.PI],
  ];
  list.forEach(([a, x, y, z, yaw, look], k) => { cr.look(k, look || { r: rc, glowI: 0 }); cr.anim(k, a, rc() * 10, 1); cr.place(k, x, y, z, yaw); if (k === 1 || k === 2) show.circles.push({ x, z, r: .3 }); });
  cr.flush(); showScene.add(cr.mesh); show.people = cr;
}
show.lights.push(
  ...[[-10, 9], [0, 9], [10, 9], [-10, 19], [0, 19], [10, 19]].map(([x, z]) => ({ x, y: 6.4, z, col: lin(0xfff2e0), r: 14, i: 2.1 })),
  { x: 0, y: 4.6, z: 28, col: lin(0xffcf6a), r: 9, i: 1.1 }, { x: 0, y: 4, z: 2, col: lin(0xd8e4ff), r: 12, i: .9 },
  { x: 11, y: 2.6, z: 25.6, col: lin(0xffe0b8), r: 6, i: 1 }, { x: -12, y: 2.6, z: 26, col: lin(0xffc890), r: 6, i: .9 },
  { x: -14, y: 5, z: 14, col: lin(0xfff2e0), r: 10, i: .7 }, { x: 14, y: 5, z: 14, col: lin(0xfff2e0), r: 10, i: .7 },
);

// ─── GARAGE 07：門在 z = 0，室內 x -9..9、z 0..27、高 4.6 m；兩側各六格、最裡面一格 ───
const homeScene = new T.Scene();
const home = { boxes: [], circles: [], lights: [], baseN: 0, cars: new T.Group(), bayCars: [] };
const BAYS = [];
for (let n = 0; n < 6; n++) for (const s of [-1, 1]) BAYS.push({ x: s * 6.2, z: 4.6 + n * 3.3, yaw: -s * Math.PI / 2 });
BAYS.push({ x: 0, z: 24.2, yaw: Math.PI });
const bayOf = id => BAYS[CAR_ORDER.indexOf(id)];
{
  const k = new Kit(), B = home.boxes, S = homeScene, amber = 0xd89a2a;
  const wall = (x0, x1, z0, z1, h, col, mat = 2) => { k.box((x0 + x1) / 2, h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0, col, mat); B.push({ x0, x1, z0, z1 }); };
  // 環氧樹脂地板、車格線、天花板鋼樑與日光燈管
  k.box(0, -.05, 13.5, 18.4, .1, 27.4, 0x3c3f44, 10);
  for (let n = 0; n <= 6; n++) for (const s of [-1, 1]) k.box(s * 6.3, .003, 2.95 + n * 3.3, 5.4, .006, .1, amber, 2);
  for (const s of [-1, 1]) k.box(s * 3.65, .003, 12.85, .1, .006, 19.8, amber, 2);
  for (const s of [-1, 1]) for (let n = 0; n < 6; n++) k.box(s * 8.55, .06, 4.6 + n * 3.3, .14, .12, 1.8, 0xc8a02a, 15);
  k.box(0, 4.65, 13.5, 18.4, .1, 27.4, 0x1c1e22, 2);
  for (let z = 2; z < 27; z += 3) k.box(0, 4.42, z, 18, .3, .16, 0x2a2c30, 2);
  for (const z of [4, 9, 14, 19, 24]) { k.box(0, 4.22, z, .14, .06, 2.6, 0xf0f6ff, 11); k.box(0, 4.27, z, .26, .05, 2.7, 0x2a2c30, 15); }
  for (const s of [-1, 1]) for (const z of [6.2, 12.8, 19.4]) { k.box(s * 6.2, 4.22, z, 2.4, .06, .12, 0xf0f6ff, 11); k.box(s * 6.2, 4.27, z, 2.5, .05, .24, 0x2a2c30, 15); }
  // 水泥磚牆、黃黑腰帶
  wall(-9.4, -9, 0, 27, 4.6, 0x5a5d61); wall(9, 9.4, 0, 27, 4.6, 0x5a5d61); wall(-9.4, 9.4, 27, 27.4, 4.6, 0x55585c);
  for (const s of [-1, 1]) k.box(s * 8.97, 1.2, 13.5, .04, .16, 27, 0xc8a02a, 2);
  for (let x = -8.6; x < 8.6; x += .8) k.box(x + .2, 1.2, 26.97, .4, .16, .04, 0xc8a02a, 2);
  // 前牆與捲門（室內側）
  wall(-9.4, -3.2, -.4, 0, 4.6, 0x4a4d52); wall(3.2, 9.4, -.4, 0, 4.6, 0x4a4d52);
  B.push({ x0: -3.2, x1: 3.2, z0: -.6, z1: -.25 });
  for (let y = .15; y < 4.1; y += .24) k.box(0, y, -.2, 6.4, .2, .08, 0x80848a, 15);
  k.box(0, 4.3, -.2, 6.6, .5, .4, 0x2a2c30, 15);
  for (const s of [-1, 1]) k.box(s * 3.25, 2.2, -.15, .12, 4.4, .16, 0x2a2c30, 15);
  k.box(0, .9, -.1, .5, .06, .1, 0xd8dce2, 3);
  // 後牆：工作台、洞洞板與工具、紅色工具車、輪胎架、油桶、小冰箱
  k.box(-6.2, .9, 26.3, 4.2, .08, 1.1, 0x5a3a20, 10).box(-6.2, .45, 26.3, 4.0, .9, 1.0, 0x2a2c30, 15);
  k.box(-6.2, 2.4, 26.95, 4.2, 1.8, .04, 0x8a7a5a, 2);
  for (let i = 0; i < 9; i++) k.box(-7.9 + i * .42, 2.3 + (i % 3) * .3, 26.9, .05, .38 - (i % 2) * .1, .03, 0xb8bcc2, 3, 0, 0, (i % 3 - 1) * .3);
  for (const [x, w] of [[-3.6, .9], [-2.6, .9]]) { k.box(x, .55, 26.5, w * .95, 1.1, .6, 0xa8141a, 10); for (let d = 0; d < 4; d++) k.box(x, .2 + d * .24, 26.19, w * .85, .02, .02, 0xd8dce2, 3); }
  B.push({ x0: -8.4, x1: -2.1, z0: 25.7, z1: 27 });
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) k.add(new T.TorusGeometry(.3, .12, 8, 18), 0x141414, 6, tf(6.4 + i * .82, .45 + j * .82, 26.4, 0, 0, 0));
  k.box(7.2, .02, 26.4, 2.8, .04, .6, 0x2a2c30, 15);
  for (const [x, z, c] of [[3.4, 26.3, 0x1c4a7a], [4.2, 26.4, 0x7a1c1c]]) k.cyl(x, .45, z, .3, .3, .9, 16, c, 10).cyl(x, .9, z, .3, .3, .02, 16, 0x1a1a1a, 15);
  B.push({ x0: 2.9, x1: 8.8, z0: 25.9, z1: 27 });
  // 牆上的旗子與時鐘、入口旁的開關箱
  k.box(-8.94, 3.2, 8, .03, .9, 2.4, 0x14243a, 2).box(-8.93, 3.2, 8, .02, .12, 2.4, 0xd8a02a, 2);
  k.cyl(8.94, 3.2, 12, .35, .35, .04, 24, 0xe8e4dc, 10, 0, 0, Math.PI / 2).box(8.91, 3.25, 12, .02, .22, .03, 0x111111, 2).box(8.91, 3.2, 11.92, .02, .03, .16, 0x111111, 2);
  k.box(4, 1.4, .08, .5, .7, .14, 0x3a3d42, 15).box(4, 1.5, .16, .12, .12, .02, 0x40ff80, 11);
  S.add(new T.Mesh(k.build(), MAT.uber));
  S.add(home.cars);
  home.baseN = home.circles.length;
}
home.lights.push(
  ...[4, 9, 14, 19, 24].map(z => ({ x: 0, y: 3.9, z, col: lin(0xe8f2ff), r: 11, i: 2 })),
  { x: -6.2, y: 2.4, z: 25.6, col: lin(0xffd0a0), r: 5, i: 1 }, { x: -6.2, y: 3.8, z: 12.8, col: lin(0xe8f2ff), r: 10, i: 1.2 }, { x: 6.2, y: 3.8, z: 12.8, col: lin(0xe8f2ff), r: 10, i: 1.2 },
);
// 車庫裡擺出擁有的車（目前開在街上的那台不在）
function rebuildGarage() {
  for (const m of home.cars.children) m.geometry.dispose();
  home.cars.clear(); home.bayCars.length = 0; home.circles.length = home.baseN;
  for (const id of motors.owned) {
    if (id === motors.cur && !motors.stowed) continue;
    const b = bayOf(id), m = new T.Mesh(carKit(id, motors.paint[id]).build(), MAT.uber);
    m.position.set(b.x, 0, b.z); m.rotation.y = b.yaw; home.cars.add(m);
    home.bayCars.push({ id, x: b.x, z: b.z });
    const L = CARS[id].len * .28;
    for (const s of [-1, 1]) home.circles.push({ x: b.x + Math.sin(b.yaw) * L * s, z: b.z + Math.cos(b.yaw) * L * s, r: CARS[id].w / 2 + .05, car: 1 });
  }
}
rebuildGarage();

VENUES.show = { scene: showScene, data: show, spawn: { x: 0, z: 2.2, yaw: 0 }, name: 'VELOCE MOTORS', toast: 'VELOCE MOTORS 疾風車行', dist: '中城 · 9 St', ceil: 6.6, door: { x: DEAL_X, z: DEAL_Z }, out: { x: DEAL_X, z: DEAL_Z + 1.3, yaw: Math.PI } };
VENUES.home = { scene: homeScene, data: home, spawn: { x: 0, z: 2.2, yaw: 0 }, name: 'GARAGE 07', toast: 'GARAGE 07 · 你的車庫', dist: '舊碼頭 · 8 St', ceil: 4.2, door: { x: HOME_X, z: HOME_Z }, out: { x: HOME_X - 1.4, z: HOME_Z - 1.3, yaw: 0 } };

// ─── 對話：看車、買車、試駕、業務、車庫 ───
const WHO_SELL = 'Vale · VELOCE MOTORS';
function carDialog(id) {
  const c = CARS[id], own = motors.owned.includes(id), short = c.price - motors.cash;
  const opts = [];
  if (own) opts.push({ t: '這台已經停在你的車庫了', fn: closeDialog });
  else if (short <= 0) opts.push({ t: `買下（${money(c.price)}）`, fn: () => confirmBuy(id) });
  else opts.push({ t: `還差 ${money(short)}`, fn: () => dialog(WHO_SELL, `${c.name} 要 ${money(c.price)}。你現在有 ${money(motors.cash)}。去街上甩幾圈尾再回來，這台車不會跑掉。`, [{ t: '試駕看看', fn: () => testDrive(id) }, { t: '好吧', fn: closeDialog }]) });
  opts.push({ t: '試駕 60 秒', fn: () => testDrive(id) }, { t: '再看看', fn: closeDialog });
  dialog(`${c.name} · ${c.cls}`, `${c.tag}\n${money(c.price)} · ${carStats(id)}`, opts);
}
function confirmBuy(id) {
  const c = CARS[id];
  dialog(WHO_SELL, `${c.name}，${money(c.price)}，不含稅也不含罰單。確定嗎？`, [{ t: '刷卡', fn: () => buyCar(id) }, { t: '再想想', fn: closeDialog }]);
}
function buyCar(id) {
  const c = CARS[id];
  if (motors.cash < c.price || motors.owned.includes(id)) return closeDialog();
  const prev = kestrel.carId;
  motors.cash -= c.price; motors.owned.push(id); motors.cur = id; motors.stowed = false; saveMotors();
  applyCar(kestrel, id, motors.paint[id]); placeCarAt(DEAL_SPOT); rebuildGarage();
  sfx.pickup();
  dialog(WHO_SELL, `${c.name} 是你的了，車已經停在門口。` + (prev !== id ? `原本那台 ${CARS[prev].name}，我們會幫你送回 GARAGE 07。` : ''), [
    { t: '馬上開走', fn: () => { closeDialog(); exitVenue(() => { enterVehicle(kestrel); camState.yaw = kestrel.yaw; }); } },
    { t: '再逛一下', fn: closeDialog },
  ]);
}
function testDrive(id) {
  closeDialog();
  motors.test = { id, t: 60, live: false, prev: { id: kestrel.carId, paint: kestrel.paint, x: kestrel.x, z: kestrel.z, yaw: kestrel.yaw, stowed: motors.stowed } };
  motors.stowed = false;
  applyCar(kestrel, id); placeCarAt(DEAL_SPOT);
  exitVenue(() => { enterVehicle(kestrel); camState.yaw = kestrel.yaw; toast(`試駕 ${CARS[id].name}：60 秒，別撞壞`); });
}
function endTest(msg) {
  const tst = motors.test; motors.test = null;
  if (player.mode === 'drive' && player.veh === kestrel) exitVehicle();
  const p = tst.prev;
  applyCar(kestrel, p.id, p.paint);
  kestrel.x = p.x; kestrel.z = p.z; kestrel.yaw = p.yaw; kestrel.vx = kestrel.vz = 0; kestrel.y = p.x < 9000 ? groundH(p.x, p.z) : 0;
  motors.stowed = p.stowed; kestrel.g.visible = !p.stowed;
  poseVehicle(kestrel);
  toast(msg || '試駕結束，車行派人把車開回去了');
}
function talkSeller() {
  const n = motors.owned.length - 1;
  dialog(WHO_SELL, n ? `又見面了。你車庫裡已經有 ${n} 台我們的車，要不要湊滿一整排？` : '歡迎光臨。每一台都可以先試駕一分鐘，看上哪台跟我說。', [
    { t: '錢要怎麼賺？', fn: () => dialog(WHO_SELL, '這座城的有錢人都靠兩件事：甩尾跟人情。在街上拉手煞甩出一段漂亮的側滑，觀眾會打賞；幫 LAZARUS 那邊的人一個忙，也不會讓你白跑。', [{ t: '知道了', fn: closeDialog }]) },
    { t: '舊車可以收嗎？', fn: () => dialog(WHO_SELL, `可以，開回你的 GARAGE 07，在車旁跟我們聯絡，用牌價六成收。Kestrel 除外，那台我們不敢收。`, [{ t: '好', fn: closeDialog }]) },
    { t: '隨便看看', fn: closeDialog },
  ]);
}
function bayDialog(id) {
  const c = CARS[id];
  const opts = [{ t: '開出去', fn: () => driveOut(id) }];
  if (id !== 'kestrel') opts.push({ t: `賣回車行（${money(sellPrice(id))}）`, fn: () => dialog('GARAGE 07', `把 ${c.name} 用 ${money(sellPrice(id))} 賣回 VELOCE MOTORS？`, [{ t: '賣', fn: () => sellCar(id) }, { t: '不賣了', fn: closeDialog }]) });
  opts.push({ t: '離開', fn: closeDialog });
  dialog(`${c.name} · ${c.cls}`, `${c.tag}\n${carStats(id)}`, opts);
}
function driveOut(id) {
  closeDialog();
  motors.cur = id; motors.stowed = false; saveMotors();
  exitVenue(() => {
    applyCar(kestrel, id, motors.paint[id]); placeCarAt(HOME_SPOT); rebuildGarage();
    enterVehicle(kestrel); camState.yaw = kestrel.yaw;
    toast(`${CARS[id].name} 開出車庫`);
  });
}
function sellCar(id) {
  if (id === 'kestrel' || !motors.owned.includes(id) || (id === motors.cur && !motors.stowed)) return closeDialog();
  const v = sellPrice(id);
  motors.owned = motors.owned.filter(o => o !== id);
  if (motors.cur === id) { motors.cur = 'kestrel'; applyCar(kestrel, 'kestrel', motors.paint.kestrel); }
  delete motors.paint[id];
  closeDialog(); rebuildGarage(); earn(v, `賣掉 ${CARS[id].name}`); sfx.click();
}
function stowCar() {
  const v = kestrel;
  exitVehicle();
  motors.stowed = true; saveMotors();
  v.g.visible = false; v.x = v.z = 9999; poseVehicle(v);
  rebuildGarage();
  enterVenue('home');
}

// ─── 互動提示 ───
ctxHooks.push((p, near) => {
  if (p.mode === 'drive') {
    const v = p.veh;
    if (v === kestrel && !motors.test && Math.hypot(v.x - HOME_SPOT.x, v.z - HOME_SPOT.z) < 6 && Math.hypot(v.vx, v.vz) < 2) return { key: 'E', text: '停進車庫 <i>· GARAGE 07</i>', fn: stowCar };
    return null;
  }
  if (p.where === 'out') {
    if (near(DEAL_X, DEAL_Z + .6, 1.7)) return { key: 'E', text: '進入 VELOCE MOTORS', fn: () => enterVenue('show') };
    if (near(HOME_X, HOME_Z - .6, 2.2)) return { key: 'E', text: '打開車庫 <i>· GARAGE 07</i>', fn: () => { rebuildGarage(); enterVenue('home'); } };
  } else if (p.where === 'show') {
    if (near(0, .6, 1.5)) return { key: 'E', text: '回到街上', fn: () => exitVenue() };
    if (near(SELLER.x, SELLER.z - 1.8, 1.8)) return { key: 'E', text: '跟業務 Vale 說話', fn: talkSeller };
    let best = null, bd = 3.5;
    for (const c of show.cars) { const d = Math.hypot(p.x - c.x, p.z - c.z); if (d < bd) { bd = d; best = c; } }
    if (best) return { key: 'E', text: `看車 <i>· ${CARS[best.id].name} · ${money(CARS[best.id].price)}</i>`, fn: () => carDialog(best.id) };
  } else if (p.where === 'home') {
    if (near(0, .6, 1.5)) return { key: 'E', text: '回到街上', fn: () => exitVenue() };
    let best = null, bd = 3.4;
    for (const c of home.bayCars) { const d = Math.hypot(p.x - c.x, p.z - c.z); if (d < bd) { bd = d; best = c; } }
    if (best) return { key: 'E', text: `${CARS[best.id].name} <i>· 開出去或賣掉</i>`, fn: () => bayDialog(best.id) };
  }
  return null;
});

// ─── 每幀：轉盤、試駕倒數 ───
function updateMotors(dt, t) {
  if (player.where === 'show') for (const s of show.spin) s.g.rotation.y = s.a0 + t * .22;
  const tst = motors.test;
  if (tst) {
    if (!tst.live) { if (player.mode === 'drive' && player.veh === kestrel) tst.live = true; }
    else if (player.mode !== 'drive' || player.veh !== kestrel) endTest();
    else { tst.t -= dt; if (tst.t <= 0) endTest('試駕時間到，車行派人把車開回去了'); }
  }
}
// 甩尾賺錢：側滑夠大、速度夠快才算，越久倍率越高，撞到就歸零；試駕的車不算
const drift = { t: 0, pts: 0, cool: 0 };
function driftTick(dt, v, imp, kmh) {
  if (!v.isCar || motors.test) { drift.t = drift.pts = 0; return; }
  if (imp > 6 && drift.t > 0) { drift.t = drift.pts = 0; drift.cool = 0; toast('撞到了，這段甩尾不算'); return; }
  if (v.slip > 1 && kmh > 25) {
    drift.t += dt; drift.cool = .5;
    const mult = 1 + Math.min(drift.t, 6) * .3;
    drift.pts += v.slip * kmh * dt * 3 * mult;
    if (drift.t > .6) toast(`甩尾 ×${mult.toFixed(1)}　${money(drift.pts)}`);
  } else if (drift.t > 0) {
    drift.cool -= dt;
    if (drift.cool <= 0) { const n = Math.round(drift.pts / 10) * 10; if (drift.t > .8 && n > 0) earn(n, '甩尾打賞'); drift.t = drift.pts = 0; }
  }
}
