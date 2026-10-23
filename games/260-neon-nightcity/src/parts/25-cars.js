
// ═══ 車型目錄：車行與車庫裡的 13 台車，全部以程式建模（側面輪廓擠出＋燈具、進氣、尾翼等零件）═══
// 外型參考經典跑車、超跑、肌肉車與古董車的線稿剪影，只取比例與輪廓，不放任何廠牌字樣或標誌。
// 座標：+z 車頭、y 高度、x 車寬；輪胎落地在 y = 0。
// sideExtrude、arch、wheel 在 30-vehicles.js（函式宣告會提升；arch 只在建模時才呼叫，那時已經定義好了）

// 車身收窄：belt 以上往內收（車窗肩線）、車底微收，z 靠近車頭車尾時依冪次收窄（俯視圓角）
const SH = (belt, top, tumble, zf, zr, nf = .14, nr = .1, pf = 3, pr = 3) => (y, z) =>
  (1 - sstep(belt, top, y) * tumble) * (1 - (1 - sstep(.18, .42, y)) * .05) *
  (z > 0 ? 1 - nf * Math.pow(clamp(z / zf, 0, 1), pf) : 1 - nr * Math.pow(clamp(-z / zr, 0, 1), pr));
// 車底：後保險桿 → 後輪拱 → 門檻 → 前輪拱 → 前保險桿
function under(zR, zF, ra, fa, yb, R, yc) {
  return [[zR, yb], ...arch(ra, yc, R, 9), [ra + R + .03, yb], [fa - R - .03, yb], ...arch(fa, yc, R, 9), [zF, yb]];
}
// 座艙：給了 paint 就做成車身色的座艙（車頂與 A/B/C 柱）再嵌上側窗、擋風玻璃與後窗；沒給就整塊玻璃（泡泡座艙）
// pts 從前擋下緣開始、經過車頂、到後窗下緣（凸多邊形）
function glassHouse(k, pts, w, tumble = .26, paint) {
  const ys = pts.map(p => p[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const tp = y => 1 - sstep(y0, y1, y) * tumble;
  if (paint == null) { sideExtrude(k, pts, w, 0x0a0c10, 1, tp, .02); return; }
  sideExtrude(k, pts, w, paint, 0, tp, .02);
  // 側窗：座艙輪廓往內縮（柱子 7 cm、窗台 4 cm），兩側各凸出 6 mm
  const win = insetPoly(pts, .075, .045);
  if (win) sideExtrude(k, win, w + .012, 0x0a0c10, 1, tp, .006);
  // 擋風玻璃與後窗：沿第一段與最後一段邊做薄片
  const strip = (a, b) => {
    const dz = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dz, dy), uz = dz / L, uy = dy / L;
    let nz = uy, ny = -uz; if (nz * (a[0] + b[0]) / 2 < 0 || ny < -.2) { nz = -nz; ny = -ny; }
    const e = Math.min(.06, L * .12), A = [a[0] + uz * e, a[1] + uy * e], B = [b[0] - uz * e, b[1] - uy * e];
    const ym = (a[1] + b[1]) / 2;
    sideExtrude(k, [[A[0] + nz * .012, A[1] + ny * .012], [B[0] + nz * .012, B[1] + ny * .012], [B[0] - nz * .03, B[1] - ny * .03], [A[0] - nz * .03, A[1] - ny * .03]], Math.max(.3, w * tp(ym) - .16), 0x0a0c10, 1, null, .005);
  };
  strip(pts[0], pts[1]); strip(pts[pts.length - 1], pts[pts.length - 2]);
}
// 凸多邊形往內縮：上方各邊縮 d、最下面那條（窗台）縮 db
function insetPoly(pts, d, db) {
  const n = pts.length; let area = 0;
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const sgn = area > 0 ? 1 : -1, lines = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], dz = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dz, dy) || 1;
    const nz = -dy / L * sgn, ny = dz / L * sgn, off = i === n - 1 ? db : d;
    lines.push([a[0] + nz * off, a[1] + ny * off, dz, dy]);
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const [ax, ay, adx, ady] = lines[(i + n - 1) % n], [bx, by, bdx, bdy] = lines[i];
    const den = adx * bdy - ady * bdx; if (Math.abs(den) < 1e-6) continue;
    const t = ((bx - ax) * bdy - (by - ay) * bdx) / den;
    out.push([ax + adx * t, ay + ady * t]);
  }
  return out.length >= 3 ? out : null;
}
// 車頂鈑件：沿車頂線往下 3 cm 的薄片
function roofSkin(k, line, w, col, mat = 0) {
  sideExtrude(k, [...line.map(([z, y]) => [z, y + .014]), ...line.slice().reverse().map(([z, y]) => [z, y - .03])], w, col, mat, null, .01);
}
// 貼在車身側面的薄片（進氣口、飾條、鰓狀通風口），兩側各一片
function sideDecal(k, pts, off, col, mat = 2, th = .024) { for (const s of [-1, 1]) sideExtrude(k, pts, th, col, mat, null, .005, tf(s * off, 0, 0)); }
// 圓燈：深色燈杯＋燈面；face 是燈面朝向（+1 朝前、-1 朝後）
function lamp(k, x, y, z, r, col, mat, face = 1) {
  k.cyl(x, y, z, r * 1.2, r * 1.2, .04, 16, 0x16171a, 2, Math.PI / 2);
  k.cyl(x, y, z + face * .022, r, r, .03, 16, col, mat, Math.PI / 2);
}
function mirrors(k, x, y, z, col) {
  for (const s of [-1, 1]) { k.box(s * (x - .05), y - .03, z, .1, .025, .05, 0x111214, 2); k.box(s * (x + .04), y, z - .02, .12, .07, .1, col, 0, 0, -s * .2); }
}
function pipe(k, x, y, z, r = .045) { k.cyl(x, y, z, r, r, .1, 12, 0xc8ccd2, 3, Math.PI / 2); k.cyl(x, y, z - .03, r * .72, r * .72, .06, 10, 0x050505, 2, Math.PI / 2); }
function wing(k, z, y, span, chord, col, standH, standX, tilt = .06) {
  k.box(0, y, z, span, .035, chord, col, 0, tilt);
  for (const s of [-1, 1]) {
    k.box(s * span / 2, y - .02, z, .02, .16, chord + .08, col, 0);
    if (standH) k.box(s * standX, y - standH / 2, z + .02, .035, standH, .1, 0x16171a, 15);
  }
}

// 輪胎與輪框：胎（可白邊）、內桶、碟盤與卡鉗、依樣式的輻條、輪緣與中心蓋。外側朝 x 的正負號
function carWheel(k, x, y, z, r, w, style = 'five', rim = 0xb8bcc2, wall = 0, cal = 0xc0282c) {
  const s = Math.sign(x) || 1, ox = x + s * w / 2, RZ = Math.PI / 2;
  k.cyl(x, y, z, r, r, w, 24, 0x121212, 6, 0, 0, RZ);
  k.cyl(x + s * .004, y, z, r * .97, r * .97, w * .96 + .012, 24, 0x0c0c0c, 6, 0, 0, RZ);
  if (wall) k.cyl(ox + s * .003, y, z, r * .88, r * .88, .008, 24, 0xe8e2d4, 10, 0, 0, RZ);
  k.cyl(ox - s * .012, y, z, r * .7, r * .7, .02, 22, 0x16171a, 2, 0, 0, RZ);
  k.cyl(ox - s * .05, y, z, r * .5, r * .5, .018, 20, 0x5a5c60, 15, 0, 0, RZ);
  if (style !== 'wire' && style !== 'dish') k.box(ox - s * .045, y + r * .3, z - r * .22, .05, r * .3, r * .2, cal, 10, -.65);
  const R = r * .66;
  const spoke = (a, r0, r1, wd, col = rim, t = .03) => { const m = (r0 + r1) / 2; k.box(ox - s * .004, y + Math.cos(a) * m, z + Math.sin(a) * m, t, r1 - r0, wd, col, 7, a); };
  if (style === 'five') for (let i = 0; i < 5; i++) spoke(i / 5 * Math.PI * 2, r * .1, R, r * .2);
  else if (style === 'twin') for (let i = 0; i < 5; i++) for (const d of [-.11, .11]) spoke(i / 5 * Math.PI * 2 + d, r * .12, R, r * .08);
  else if (style === 'y') for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; spoke(a, r * .1, r * .38, r * .16); for (const d of [-.2, .2]) spoke(a + d, r * .34, R, r * .09); }
  else if (style === 'mesh') { for (let i = 0; i < 10; i++) spoke(i / 10 * Math.PI * 2, r * .1, R, r * .07); k.add(new T.TorusGeometry(r * .4, .012, 5, 20), rim, 7, tf(ox - s * .006, y, z, 0, Math.PI / 2, 0)); }
  else if (style === 'six') for (let i = 0; i < 6; i++) spoke(i / 6 * Math.PI * 2, r * .1, R, r * .14);
  else if (style === 'turbine') { k.cyl(ox - s * .008, y, z, R, R, .02, 22, rim, 7, 0, 0, RZ); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, m = r * .42; k.box(ox, y + Math.cos(a) * m, z + Math.sin(a) * m, .03, r * .4, r * .05, 0x1b1c1f, 2, a + .5); } }
  else if (style === 'dish') { k.cyl(ox - s * .006, y, z, R, R, .02, 22, rim, 7, 0, 0, RZ); k.cyl(ox + s * .006, y, z, r * .3, r * .26, .03, 16, 0xd8dce2, 3, 0, 0, RZ); }
  else if (style === 'wire') { for (let i = 0; i < 24; i++) spoke(i / 24 * Math.PI * 2 + (i % 2) * .08, r * .16, R, .008, 0xd8dce2, .012); k.cyl(ox - s * .006, y, z, r * .2, r * .2, .05, 12, 0xd8dce2, 3, 0, 0, RZ); for (let i = 0; i < 2; i++) k.box(ox + s * .02, y, z, .02, r * .44, .03, 0xd8dce2, 3, i * Math.PI / 2 + .4); }
  k.add(new T.TorusGeometry(R, .016, 6, 28), rim, 7, tf(ox - s * .004, y, z, 0, Math.PI / 2, 0));
  if (style !== 'wire' && style !== 'dish') k.cyl(ox + s * .004, y, z, r * .13, r * .13, .035, 12, rim, 7, 0, 0, RZ);
}

// ─── 載具級距（neon_nightcity_gta_v_2.md 第一節第 1 表）：質量 kg、極速 km/h、加速度 m/s²、轉向靈敏度、側向抓地 μ_lat、手煞車 μ_drift、耐久 ───
// 車流、警車、坦克與搶來的車整組套用（vehClass）；車行的實車保留自己調好的極速、加速與抓地，只套質量、耐久、轉向與手煞車（carClass）。
// 側向速度每幀乘上 exp(−μ·10·dt)（規格的 1 − μ·dt·10）；手煞車照規格的 ×10 會在半秒內抓回來甩不出去，這裡乘 DRIFT_K（超跑 ≈ 1.4，和改版前的手感一樣）
const VCLASS = {
  super: { name: '超跑', m: 1450, kmh: 240, acc: 14.5, turn: 1.25, lat: .92, drift: .45, hp: 1000 },
  muscle: { name: '肌肉車', m: 1750, kmh: 205, acc: 12, turn: .95, lat: .75, drift: .32, hp: 1250 },
  sedan: { name: '轎跑', m: 1600, kmh: 180, acc: 9.5, turn: 1.05, lat: .85, drift: .5, hp: 1100 },
  bike: { name: '重型機車', m: 280, kmh: 225, acc: 16, turn: 1.5, lat: .88, drift: .4, hp: 550 },
  heavy: { name: '廂型／運鈔車', m: 4800, kmh: 130, acc: 5.5, turn: .65, lat: .7, drift: .6, hp: 3500 },
  police: { name: '巡邏警車', m: 1800, kmh: 215, acc: 13, turn: 1.1, lat: .86, drift: .42, hp: 1400 },
  tank: { name: '重裝坦克', m: 12000, kmh: 75, acc: 4, turn: .5, lat: .98, drift: .9, hp: 10000 },
};
const DRIFT_K = 1 / 3.2;
// 車子的 vmax 參數是推力歸零的速度（driveVehicle：eng·(1 − (v/vmax)²) 對上阻力 .12v + .35），這裡反推成實際極速剛好是表上的 km/h
const vmaxFor = (kmh, acc) => { const V = kmh / 3.6; return V / Math.sqrt(Math.max(.05, 1 - (.12 * V + .35) / acc)); };
const CAR_CLS = { muscle: ['chall', 'zr1', 'bulldog'], sedan: ['ae86', 'e34', 'evo190', 'm3c', 'm3t24', 'lucerna', 'meridian', 'kestrel'], police: ['police'] };
function carClass(id) {
  const c = CARS[id];
  if (!c) return 'sedan';
  if (c.bike) return 'bike';
  for (const k in CAR_CLS) if (CAR_CLS[k].includes(id)) return k;
  return c.vmax >= 70 ? 'super' : 'sedan';
}
// 車流車型（30-vehicles.js 的 TYPES）：沒列到的是轎跑
const TYPE_CLS = { super: ['tiara', 'milano'], muscle: ['carter', 'fh', 'il'], police: ['fh_cop', 'il_cop', 'urban_cop'], heavy: ['shvan', 'lct', 'conquer', 'fvan', 'ambulance', 'md84', 'grc_stepvan', 'grc_mailvan'], tank: ['tank'] };
const typeClass = type => Object.keys(TYPE_CLS).find(k => TYPE_CLS[k].includes(type)) || 'sedan';
// 套到載具上：full 時連極速、加速與抓地一起換（車流車型）；mass、hpMax、turn、hbGrip 每台都有
function vehClass(v, cls, full) {
  const C = VCLASS[cls], k = v.hpMax ? clamp(v.hp / v.hpMax, 0, 1) : 1;
  v.cls = cls; v.mass = C.m; v.turn = C.turn; v.hbGrip = C.drift * 10 * DRIFT_K;
  v.hpMax = C.hp; v.hp = C.hp * k; v.hpLock = full ? 0 : 1;   // full（車流造的車）：各模組之後還會改 hp，第一次受損時才鎖上限（68-wreck.js 的 hpLockOf）
  if (full) { v.vmax = vmaxFor(C.kmh, C.acc); v.eng = C.acc; v.grip = C.lat * 10; }
}

// ─── 車型 ───
// len／w：碰撞用車長車寬；wr 輪徑、ww 前後胎寬、track 輪距一半、fa／ra 前後軸 z；vmax m/s、eng 加速、grip 抓地
const CARS = {};
const car = (id, o) => { CARS[id] = { id, ...o }; };

car('kestrel', {
  name: 'Kestrel', cls: '楔形跑車', price: 0, paint: 0x8a1018, len: 4.4, w: 1.9, wr: .34, ww: [.26, .26], track: .82, fa: 1.35, ra: -1.35,
  vmax: 54, eng: 11, grip: 8.5, rim: ['six', 0x9aa0a6], tag: '你的老夥伴。楔形車身、可升降頭燈與整條尾燈，八〇年代的未來感。',
  body: (k, p) => { const kk = kestrelKit(p); k.pos.push(...kk.pos); k.nor.push(...kk.nor); k.col.push(...kk.col); k.mat.push(...kk.mat); },
});

car('doodle', {
  name: 'Doodlebug', cls: '經典金龜車', price: 16000, paint: 0x8fb8c8, len: 4.05, w: 1.6, wr: .33, ww: [.17, .17], track: .66, fa: 1.2, ra: -1.2,
  vmax: 36, eng: 6.5, grip: 7.4, rim: ['dish', 0xd8d6d0], wall: 1, tag: '圓滾滾的拱形車頂與獨立葉子板，後置氣冷引擎。慢，但每個人都會對它笑。',
  body: (k, p) => {
    sideExtrude(k, [[1.98, .44], [2.0, .6], [1.85, .76], [1.5, .86], [1.05, .9], [-1.25, .93], [-1.6, .86], [-1.88, .72], [-2.0, .56], [-2.02, .42], ...under(-1.95, 1.95, -1.2, 1.2, .36, .41, .33)],
      1.3, p, 0, SH(.7, .93, .1, 2.0, 2.02, .24, .22, 2.4, 2.4));
    glassHouse(k, [[1.05, .9], [.62, 1.3], [.1, 1.45], [-.55, 1.43], [-1.0, 1.22], [-1.25, .93]], 1.16, .3, p);
    roofSkin(k, [[.62, 1.3], [.1, 1.45], [-.55, 1.43], [-1.0, 1.22]], .86, p);
    for (const s of [-1, 1]) for (const [zc, f] of [[1.2, 1], [-1.2, -1]]) {
      const o = arch(zc, .33, .5, 10), i = arch(zc, .33, .42, 10).reverse();
      const pts = f > 0 ? [[zc - .5, .4], ...o.slice(1), [zc + .62, .4], ...i] : [[zc - .62, .4], ...o.slice(0, -1), [zc + .5, .4], ...i];
      sideExtrude(k, pts, .3, p, 0, y => 1 - sstep(.55, .85, y) * .35, .04, tf(s * .66, 0, 0));
    }
    for (const s of [-1, 1]) {
      k.box(s * .7, .38, 0, .2, .035, 1.45, 0x1a1a1a, 2);
      lamp(k, s * .66, .74, 1.6, .085, 0xf6f0dc, 4); k.cyl(s * .66, .74, 1.6, .105, .105, .06, 16, 0xc8ccd2, 3, Math.PI / 2);
      lamp(k, s * .66, .66, -1.66, .05, 0xff1a1a, 5, -1);
      k.box(s * .62, .9, .85, .08, .06, .1, 0xc8ccd2, 3);
    }
    k.box(0, .43, 2.04, 1.55, .07, .06, 0xc8ccd2, 3).box(0, .43, -2.05, 1.55, .07, .06, 0xc8ccd2, 3);
    for (const s of [-1, 1]) { k.box(s * .4, .5, 2.06, .06, .16, .06, 0xc8ccd2, 3); k.box(s * .4, .5, -2.07, .06, .16, .06, 0xc8ccd2, 3); }
    for (let i = 0; i < 4; i++) k.box(0, .8 - i * .035, -1.7 - i * .05, .5, .012, .03, 0x111214, 2, .5);
    k.box(0, .88, 1.6, .03, .02, .7, 0xc8ccd2, 3, -.15);
  },
});

car('kanto', {
  name: 'Kanto 9', cls: '後置引擎跑車', price: 92000, paint: 0xc9a227, len: 4.3, w: 1.84, wr: .335, ww: [.24, .29], track: .76, fa: 1.25, ra: -1.2,
  vmax: 72, eng: 13.5, grip: 9.2, rim: ['five', 0xc8ccd2], tag: '青蛙眼圓燈、一路滑到車尾的斜背與鴨尾翼。後置引擎讓它出彎時像被人推了一把。',
  body: (k, p) => {
    sideExtrude(k, [[2.12, .36], [2.15, .55], [2.02, .66], [1.6, .73], [1.0, .8], [-1.35, .93], [-1.8, .86], [-2.08, .76], [-2.15, .6], [-2.13, .4], ...under(-2.0, 2.0, -1.2, 1.25, .3, .41, .33)],
      1.84, p, 0, SH(.6, .93, .08, 2.15, 2.15, .16, .14, 2.6, 2.4));
    glassHouse(k, [[1.0, .8], [.45, 1.18], [-.15, 1.3], [-.7, 1.27], [-1.35, .93]], 1.42, .26, p);
    roofSkin(k, [[.45, 1.18], [-.15, 1.3], [-.7, 1.27], [-1.1, 1.1]], 1.07, p);
    for (const s of [-1, 1]) {
      k.cyl(s * .6, .66, 1.9, .13, .13, .26, 16, p, 0, Math.PI / 2 - .22);
      lamp(k, s * .6, .69, 2.04, .1, 0xf6f0dc, 4);
      k.box(s * .55, .33, 2.12, .38, .1, .04, 0x0d0e10, 2);
    }
    k.box(0, .35, 2.14, .5, .1, .04, 0x0d0e10, 2);
    k.box(0, .8, -2.12, 1.52, .05, .03, 0xff1a24, 5);
    for (const s of [-1, 1]) k.box(s * .62, .8, -2.11, .28, .09, .03, 0xff1a24, 5);
    k.box(0, .93, -1.97, 1.3, .03, .3, p, 0, -.14);
    for (let i = 0; i < 5; i++) k.box(0, .9 - i * .02, -1.55 - i * .08, .6, .012, .035, 0x0e0f11, 2, .2);
    k.box(0, .38, -2.14, 1.4, .1, .04, 0x111214, 2); pipe(k, .3, .3, -2.12); pipe(k, -.3, .3, -2.12);
    mirrors(k, .92, .92, .78, p);
  },
});

car('bulldog', {
  name: 'Bulldog V8', cls: '美式肌肉車', price: 64000, paint: 0xd86a1a, len: 4.8, w: 1.96, wr: .36, ww: [.26, .32], track: .8, fa: 1.48, ra: -1.36,
  vmax: 66, eng: 14.5, grip: 7.6, rim: ['five', 0x9aa0a6], tag: '長引擎蓋、斜背車頂、整面水箱罩與兩道賽車條紋。後輪很愛甩，甩尾賺錢最快。',
  body: (k, p) => {
    sideExtrude(k, [[2.38, .38], [2.4, .8], [2.3, .88], [1.05, .93], [-1.5, .97], [-2.32, 1.0], [-2.4, .96], [-2.42, .42], ...under(-2.2, 2.2, -1.36, 1.48, .32, .43, .35)],
      1.96, p, 0, SH(.75, 1.0, .05, 2.4, 2.42, .06, .05, 4, 4));
    glassHouse(k, [[1.05, .93], [.3, 1.34], [-.4, 1.36], [-1.55, .98]], 1.55, .22, p);
    roofSkin(k, [[.3, 1.34], [-.4, 1.36], [-.95, 1.18]], 1.23, p);
    k.box(0, .64, 2.41, 1.62, .3, .03, 0x0b0c0e, 2);
    for (const y of [.49, .79]) k.box(0, y, 2.42, 1.64, .025, .03, 0xc8ccd2, 3);
    for (const s of [-1, 1]) { lamp(k, s * .62, .64, 2.42, .1, 0xf6f0dc, 4); k.box(s * .82, .64, 2.42, .025, .3, .03, 0xc8ccd2, 3); }
    k.box(0, .4, 2.42, 1.7, .1, .05, 0x111214, 2);
    k.box(0, .98, 1.45, .5, .08, .75, p, 0); k.box(0, .99, 1.83, .4, .05, .02, 0x050505, 2);
    for (const s of [-1, 1]) {
      k.box(s * .17, .936, 1.7, .2, .012, 1.32, 0x111214, 10);
      k.box(s * .17, 1.37, -.05, .2, .012, .62, 0x111214, 10, .02);
      k.box(s * .17, 1.0, -1.92, .2, .012, .8, 0x111214, 10, -.03);
      for (let i = 0; i < 3; i++) k.box(s * (.44 + i * .15), .78, -2.42, .11, .15, .03, 0xff1a1a, 5);
      pipe(k, s * .56, .33, -2.42, .05);
      for (let i = 0; i < 3; i++) k.box(s * .985, .68, .62 - i * .09, .02, .14, .05, 0x111214, 2, 0, 0, .3);
    }
    k.box(0, .78, -2.425, .5, .15, .02, 0x111214, 2);
    k.box(0, .44, -2.42, 1.7, .1, .05, 0x8a8e92, 3);
    k.box(0, 1.02, -2.28, 1.5, .04, .1, p, 0, .2);
    mirrors(k, .98, .98, .92, p);
  },
});

car('ronin', {
  name: 'Ronin GT', cls: '日系性能雙門', price: 128000, paint: 0x6a6e74, len: 4.7, w: 1.92, wr: .36, ww: [.26, .29], track: .79, fa: 1.4, ra: -1.38,
  vmax: 76, eng: 15.5, grip: 9.6, rim: ['mesh', 0x3a3c40], tag: '方正的車身、梯形大嘴、四顆圓形尾燈與高腳尾翼。四輪驅動，雨天也抓得住地。',
  body: (k, p) => {
    sideExtrude(k, [[2.33, .34], [2.36, .62], [2.2, .76], [1.0, .86], [-1.3, .93], [-2.2, .99], [-2.33, .95], [-2.34, .42], ...under(-2.15, 2.15, -1.38, 1.4, .32, .43, .35)],
      1.92, p, 0, SH(.7, .99, .06, 2.36, 2.34, .1, .06, 3, 4));
    glassHouse(k, [[1.0, .86], [.3, 1.32], [-.5, 1.34], [-1.35, .97]], 1.5, .24, p);
    roofSkin(k, [[.3, 1.32], [-.5, 1.34], [-.95, 1.17]], 1.16, p);
    k.box(0, .5, 2.37, 1.0, .26, .03, 0x0b0c0e, 2); k.box(0, .64, 2.375, 1.04, .02, .03, 0xc8ccd2, 3);
    for (let i = 0; i < 4; i++) k.box(0, .41 + i * .06, 2.385, .96, .012, .02, 0x2a2c30, 15);
    for (const s of [-1, 1]) {
      k.box(s * .63, .73, 2.17, .42, .09, .22, 0x15161a, 2, 0, -s * .35);
      k.box(s * .64, .73, 2.24, .36, .05, .06, 0xf4f1e8, 4, 0, -s * .35);
      k.box(s * .68, .42, 2.3, .34, .1, .04, 0x0b0c0e, 2, 0, -s * .3);
      for (const o of [.42, .72]) { k.cyl(s * o, .83, -2.33, .1, .1, .04, 18, 0xff1a24, 5, Math.PI / 2); k.cyl(s * o, .83, -2.35, .05, .05, .04, 12, 0x2a0606, 2, Math.PI / 2); }
      pipe(k, s * .36, .32, -2.33, .05); pipe(k, s * .5, .32, -2.33, .05);
    }
    sideDecal(k, [[1.0, .6], [.92, .72], [.76, .72], [.84, .6]], .955, 0x0b0c0e);
    k.box(0, .42, -2.33, 1.6, .12, .04, 0x111214, 2);
    wing(k, -2.12, 1.17, 1.72, .28, p, .2, .55);
    mirrors(k, .95, .95, .86, p);
  },
});

car('mamba', {
  name: 'Mamba RT', cls: '長頭 V10 跑車', price: 150000, paint: 0x1f5fa8, len: 4.5, w: 1.96, wr: .35, ww: [.27, .33], track: .79, fa: 1.45, ra: -1.25,
  vmax: 80, eng: 16, grip: 8.6, rim: ['five', 0xc8ccd2], tag: '駕駛艙往後縮到後輪前面，前面是長得誇張的引擎蓋與側排氣。雙泡車頂，白色條紋。',
  body: (k, p) => {
    sideExtrude(k, [[2.24, .3], [2.28, .5], [2.12, .62], [1.3, .76], [.25, .86], [-1.45, .92], [-2.14, .95], [-2.24, .9], [-2.24, .42], ...under(-2.08, 2.1, -1.25, 1.45, .3, .42, .34)],
      1.96, p, 0, SH(.6, .95, .08, 2.28, 2.24, .18, .08, 2.2, 3));
    glassHouse(k, [[.25, .86], [-.25, 1.2], [-.95, 1.21], [-1.55, .93]], 1.36, .28, p);
    for (const s of [-1, 1]) sideExtrude(k, [[-.25, 1.2], [-.6, 1.24], [-.95, 1.22], [-1.25, 1.08], [-1.25, 1.04], [-.25, 1.16]], .32, p, 0, null, .012, tf(s * .2, 0, 0));
    sideExtrude(k, [[2.02, .61], [1.9, .68], [1.0, .84], [.32, .88], [.32, .84], [2.02, .59]], .55, p, 0, null, .02);
    for (const s of [-1, 1]) {
      k.box(s * .4, .8, 1.05, .2, .012, .5, 0x050505, 2, -.16);
      k.box(s * .63, .6, 2.12, .38, .06, .2, 0xf4f1e8, 4, 0, -s * .45, s * .12);
      k.box(s * .14, .89, .5, .16, .012, 2.6, 0xf2f0ea, 10, -.13);
      k.box(s * .14, 1.255, -.6, .16, .012, .7, 0xf2f0ea, 10);
      k.box(s * .14, .95, -1.85, .16, .012, .62, 0xf2f0ea, 10);
      k.box(s * .6, .8, -2.23, .4, .1, .03, 0xff1a24, 5);
      k.cyl(s * .985, .3, -.2, .05, .05, 1.0, 12, 0xc8ccd2, 3, Math.PI / 2);
    }
    for (let i = 0; i < 3; i++) sideDecal(k, [[.98 - i * .13, .5], [.94 - i * .13, .72], [.89 - i * .13, .72], [.93 - i * .13, .5]], .975, 0x050505);
    k.box(0, .42, 2.27, 1.2, .16, .03, 0x0b0c0e, 2);
    k.box(0, .4, -2.24, 1.6, .12, .04, 0x111214, 2);
    wing(k, -2.04, 1.2, 1.8, .3, p, .26, .6);
    mirrors(k, .95, .93, .2, p);
  },
});

car('saetta', {
  name: 'Saetta 40', cls: '八〇年代傳奇超跑', price: 380000, paint: 0xc8141c, len: 4.4, w: 1.98, wr: .34, ww: [.26, .33], track: .8, fa: 1.3, ra: -1.28,
  vmax: 87, eng: 17, grip: 9.4, rim: ['five', 0x8a8e92], tag: '低矮楔形車頭、壓克力百葉後窗與跟車尾連成一體的大尾翼。沒有音響，也不需要。',
  body: (k, p) => {
    sideExtrude(k, [[2.2, .28], [2.24, .42], [2.05, .53], [.95, .74], [-.8, .98], [-1.95, .92], [-2.18, .9], [-2.2, .46], ...under(-2.05, 2.05, -1.28, 1.3, .28, .41, .33)],
      1.98, p, 0, SH(.55, .95, .08, 2.24, 2.2, .2, .06, 2.2, 4));
    glassHouse(k, [[.95, .74], [.12, 1.1], [-.45, 1.12], [-.8, .98]], 1.36, .26, p);
    roofSkin(k, [[.12, 1.1], [-.45, 1.12], [-.65, 1.06]], 1.03, p);
    for (let i = 0; i < 8; i++) { const z = -.95 - i * .13; k.box(0, lerp(.985, .935, i / 7) + .014, z, 1.1, .016, .06, 0x0e0f11, 2, -.05); }
    k.box(0, 1.12, -2.08, 1.86, .04, .32, p, 0, .05);
    for (const s of [-1, 1]) sideExtrude(k, [[-1.82, .9], [-1.95, 1.15], [-2.25, 1.15], [-2.2, .9]], .03, p, 0, null, .008, tf(s * .92, 0, 0));
    for (const s of [-1, 1]) {
      k.box(s * .62, .5, 2.06, .36, .05, .2, 0xf4f1e8, 4, 0, -s * .3);
      k.box(s * .6, .34, 2.17, .3, .08, .03, 0x0b0c0e, 2);
      k.box(s * .25, .62, 1.65, .12, .01, .2, 0x050505, 2, -.12);
      lamp(k, s * .4, .72, -2.22, .08, 0xff1a24, 5, -1); lamp(k, s * .64, .72, -2.21, .08, 0xff1a24, 5, -1);
    }
    k.box(0, .34, 2.22, .7, .08, .03, 0x0b0c0e, 2);
    sideDecal(k, [[.35, .66], [-.15, .72], [-.15, .66]], .97, 0x0b0c0e);
    k.box(0, .72, -2.205, 1.7, .2, .03, 0x0b0c0e, 2);
    pipe(k, 0, .4, -2.2, .05); pipe(k, -.14, .4, -2.2, .05); pipe(k, .14, .4, -2.2, .05);
    mirrors(k, .95, .86, .6, p);
  },
});

car('furia', {
  name: 'Furia V12', cls: '稜角楔形超跑', price: 520000, paint: 0x7dd13a, len: 4.8, w: 2.04, wr: .36, ww: [.27, .34], track: .82, fa: 1.5, ra: -1.35,
  vmax: 96, eng: 19.5, grip: 10, rim: ['y', 0x2a2c30], cal: 0xd8a020, tag: '從車頭一刀切到車尾的楔形、Y 字頭燈與巨大的側進氣口。V12 在隧道裡會讓整條街的狗一起叫。',
  body: (k, p) => {
    sideExtrude(k, [[2.4, .26], [2.42, .38], [2.22, .48], [1.05, .78], [-1.4, .97], [-2.25, .94], [-2.4, .88], [-2.4, .42], ...under(-2.2, 2.25, -1.35, 1.5, .28, .43, .35)],
      2.04, p, 0, SH(.55, .97, .1, 2.42, 2.4, .22, .08, 1.8, 3));
    glassHouse(k, [[1.05, .78], [.05, 1.12], [-.6, 1.12], [-1.45, .97]], 1.42, .3, p);
    roofSkin(k, [[.05, 1.12], [-.6, 1.12], [-1.0, 1.05]], 1.0, p);
    sideDecal(k, [[-.2, .82], [-1.0, .9], [-1.05, .46], [-.5, .4]], 1.0, 0x0b0c0e, 2, .03);
    sideDecal(k, [[.98, .6], [.75, .66], [.72, .48]], .99, 0x0b0c0e);
    for (let i = 0; i < 3; i++) k.box(0, .98 - i * .02, -1.65 - i * .16, 1.0, .014, .08, 0x0e0f11, 2, -.1);
    for (const s of [-1, 1]) {
      for (const [dx, dy, a] of [[0, 0, 0], [-.07, .05, .7], [-.07, -.05, -.7]]) k.box(s * (.66 + dx), .5 + dy, 2.2, .2, .025, .03, 0xf4f1e8, 4, 0, -s * .3, s * a);
      k.box(s * .7, .37, 2.3, .52, .14, .03, 0x0b0c0e, 2, 0, -s * .3);
      for (const [dx, dy, a] of [[0, 0, 0], [-.08, .05, -.7], [-.08, -.05, .7]]) k.box(s * (.68 + dx), .8 + dy, -2.38, .22, .03, .03, 0xff1a24, 5, 0, 0, s * a);
    }
    k.box(0, .27, 2.38, 1.9, .03, .2, 0x111214, 2);
    k.box(0, .42, -2.4, 1.7, .14, .04, 0x0b0c0e, 2);
    for (let i = -2; i <= 2; i++) k.box(i * .3, .3, -2.32, .02, .1, .2, 0x2a2c30, 15);
    for (const [x, y] of [[-.1, .52], [.1, .52], [-.1, .4], [.1, .4]]) pipe(k, x, y, -2.42, .045);
    wing(k, -2.18, 1.02, 1.6, .3, 0x111214, .06, .4, .04);
    mirrors(k, 1.0, .9, .82, p);
  },
});

car('meridian', {
  name: 'Meridian F', cls: '中置單座超跑', price: 680000, paint: 0xe8782a, len: 4.3, w: 1.84, wr: .33, ww: [.25, .31], track: .74, fa: 1.32, ra: -1.38,
  vmax: 104, eng: 19, grip: 9.8, rim: ['mesh', 0xb8bcc2], tag: '駕駛座在正中央，兩旁各一個乘客座。圓潤的泡泡座艙、車頂進氣口，安靜地快。',
  body: (k, p) => {
    sideExtrude(k, [[2.15, .3], [2.18, .45], [2.0, .56], [1.05, .72], [-1.3, .9], [-2.05, .85], [-2.15, .78], [-2.16, .42], ...under(-2.0, 2.0, -1.38, 1.32, .28, .4, .32)],
      1.84, p, 0, SH(.5, .9, .1, 2.18, 2.16, .18, .12, 2.2, 2.4));
    glassHouse(k, [[1.05, .72], [.2, 1.12], [-.6, 1.14], [-1.35, .9]], 1.4, .32, p);
    roofSkin(k, [[.2, 1.12], [-.6, 1.14], [-1.0, 1.05]], .97, p);
    k.box(0, 1.19, -.6, .26, .1, .62, p, 0); k.box(0, 1.19, -.28, .2, .07, .02, 0x050505, 2);
    for (const s of [-1, 1]) {
      k.box(s * .56, .55, 1.97, .44, .09, .24, 0x17181b, 2, 0, -s * .3);
      lamp(k, s * .46, .56, 2.05, .06, 0xf6f0dc, 4); lamp(k, s * .66, .55, 2.0, .06, 0xf6f0dc, 4);
      k.box(s * .3, .66, 1.55, .3, .012, .36, 0x050505, 2, -.12);
      lamp(k, s * .45, .72, -2.16, .065, 0xff1a24, 5, -1); lamp(k, s * .65, .72, -2.15, .065, 0xff1a24, 5, -1);
    }
    sideDecal(k, [[-.4, .7], [-.9, .76], [-.95, .5], [-.55, .45]], .9, 0x0b0c0e);
    k.box(0, .36, 2.17, .9, .1, .03, 0x0b0c0e, 2);
    k.box(0, .55, -2.16, 1.2, .18, .03, 0x111214, 2);
    k.box(0, .87, -2.08, 1.3, .03, .14, p, 0, .15);
    pipe(k, 0, .42, -2.17, .055);
    mirrors(k, .88, .85, .7, p);
  },
});

car('halcyon', {
  name: 'Halcyon', cls: '賽道級超級跑車', price: 1200000, paint: 0x23402f, len: 4.6, w: 1.98, wr: .35, ww: [.28, .34], track: .8, fa: 1.42, ra: -1.4,
  vmax: 102, eng: 22, grip: 11, rim: ['turbine', 0x9aa0a6], cal: 0x9cff3a, tag: '淚滴形座艙懸在兩條巨大的文氏管之間，前輪拱和車身分開。它是被風洞設計出來的，不是畫出來的。',
  body: (k, p) => {
    const acc = 0x9cff3a;
    // 中央龍骨與淚滴座艙
    sideExtrude(k, [[2.32, .18], [2.36, .3], [2.1, .42], [1.5, .55], [1.0, .62], [-1.5, .78], [-2.35, .8], [-2.38, .3], [-2.2, .14], [2.1, .14]], 1.05, p, 0,
      (y, z) => (1 - sstep(.4, .8, y) * .25) * (z > 0 ? 1 - .45 * Math.pow(clamp(z / 2.36, 0, 1), 1.6) : 1));
    glassHouse(k, [[1.0, .62], [.35, 1.0], [-.25, 1.08], [-.95, 1.0], [-1.7, .79]], .95, .45);
    roofSkin(k, [[.35, 1.0], [-.25, 1.08], [-.95, 1.0], [-1.5, .85]], .3, p);
    sideExtrude(k, [[-.6, 1.06], [-1.9, .95], [-2.15, 1.02], [-.9, 1.12]], .03, p, 0, null, .008);
    // 後側車身：寬大的臀部與後輪拱
    sideExtrude(k, [[-.2, .55], [-.9, .84], [-1.9, .9], [-2.36, .88], [-2.38, .3], [-2.25, .22], ...arch(-1.4, .34, .43, 9), [-.9, .22], [-.2, .26]], 1.98, p, 0,
      (y, z) => (1 - sstep(.6, .9, y) * .1) * (1 - .42 * Math.pow(clamp((z + 1.05) / .85, 0, 1), 1.4)));
    // 前輪的獨立輪拱
    for (const s of [-1, 1]) {
      const o = arch(1.42, .35, .5, 10), i = arch(1.42, .35, .42, 10).reverse();
      sideExtrude(k, [[.86, .36], ...o, [1.98, .36], ...i], .36, p, 0, y => 1 - sstep(.6, .85, y) * .3, .04, tf(s * .8, 0, 0));
      k.box(s * .6, .44, 1.35, .42, .03, .9, p, 0);
      k.box(s * .8, .58, 1.93, .2, .02, .03, 0xf4f1e8, 4, -.3);
      k.box(s * .8, .4, 1.9, .2, .01, .02, acc, 8);
    }
    k.box(0, .74, -2.38, 1.7, .02, .03, 0xff1a24, 5);
    k.box(0, .3, -2.37, 1.6, .14, .03, 0x0b0c0e, 2);
    for (let i = -3; i <= 3; i++) k.box(i * .22, .24, -2.2, .02, .14, .4, 0x1b1c1f, 15);
    wing(k, -2.2, 1.14, 1.7, .3, p, 0, 0, .05);
    for (const s of [-1, 1]) { k.box(s * .25, 1.0, -2.12, .03, .26, .1, 0x16171a, 15, -.3); k.box(s * .82, .9, -2.15, .02, .5, .4, acc, 10); }
    pipe(k, 0, .9, -2.37, .06);
    k.box(0, .19, 2.2, 1.0, .02, .3, acc, 10);
  },
});

car('lucerna', {
  name: 'Lucerna GT', cls: '前置 V8 豪華跑旅', price: 240000, paint: 0x8aa0b0, len: 4.65, w: 1.98, wr: .36, ww: [.26, .3], track: .8, fa: 1.5, ra: -1.25,
  vmax: 88, eng: 15.5, grip: 9.2, rim: ['twin', 0xc8ccd2], tag: '長車頭、鯊魚鼻與一刀細長的頭燈，車尾是乾淨的斜背。適合在雨夜慢慢開過整條海港大道。',
  body: (k, p) => {
    sideExtrude(k, [[2.33, .34], [2.37, .5], [2.25, .63], [1.15, .82], [-1.45, .95], [-2.18, .92], [-2.3, .86], [-2.32, .42], ...under(-2.15, 2.18, -1.25, 1.5, .3, .43, .35)],
      1.98, p, 0, SH(.62, .95, .08, 2.37, 2.32, .2, .1, 2.2, 3));
    glassHouse(k, [[1.15, .82], [.35, 1.24], [-.35, 1.27], [-1.5, .96]], 1.48, .26, p);
    roofSkin(k, [[.35, 1.24], [-.35, 1.27], [-.9, 1.15]], 1.12, p);
    k.box(0, .44, 2.36, 1.0, .14, .03, 0x0b0c0e, 2);
    for (let i = 0; i < 9; i++) for (let j = 0; j < 2; j++) k.box(-.4 + i * .1, .41 + j * .06, 2.375, .03, .03, .02, 0x3a3c40, 15);
    for (const s of [-1, 1]) {
      k.box(s * .66, .61, 2.2, .44, .035, .16, 0xf4f1e8, 4, 0, -s * .35);
      k.box(s * .66, .58, 2.19, .44, .02, .16, 0x15161a, 2, 0, -s * .35);
      lamp(k, s * .52, .78, -2.3, .055, 0xff1a24, 5, -1); lamp(k, s * .72, .78, -2.28, .055, 0xff1a24, 5, -1);
      pipe(k, s * .5, .36, -2.31, .045); pipe(k, s * .38, .36, -2.31, .045);
    }
    k.box(0, .9, -2.24, 1.3, .025, .1, p, 0, .1);
    k.box(0, .42, -2.31, 1.6, .1, .04, 0x111214, 2);
    mirrors(k, .97, .93, .95, p);
  },
});

car('solenne', {
  name: 'Solenne W16', cls: '十六缸極速超跑', price: 950000, paint: 0x1b2a4a, len: 4.55, w: 2.04, wr: .36, ww: [.27, .34], track: .82, fa: 1.4, ra: -1.32,
  vmax: 116, eng: 21, grip: 10.2, rim: ['y', 0xb8bcc2], tag: '車側一道鍍鉻的 C 字弧線、馬蹄形的中央進氣格柵、四顆一排的頭燈。四百公里以後它才開始認真。',
  body: (k, p) => {
    sideExtrude(k, [[2.25, .32], [2.28, .5], [2.12, .66], [1.05, .84], [-1.35, .97], [-2.15, .94], [-2.27, .88], [-2.28, .42], ...under(-2.12, 2.12, -1.32, 1.4, .3, .43, .35)],
      2.04, p, 0, SH(.6, .97, .08, 2.28, 2.28, .16, .1, 2.4, 3));
    glassHouse(k, [[1.05, .84], [.25, 1.2], [-.45, 1.22], [-1.4, .97]], 1.45, .28, p);
    roofSkin(k, [[.25, 1.2], [-.45, 1.22], [-.95, 1.08]], 1.06, p);
    for (const s of [-1, 1]) {
      const c = new T.CatmullRomCurve3([V3(s * .74, 1.0, -.15), V3(s * .9, .93, -.5), V3(s * 1.0, .72, -.72), V3(s * 1.0, .48, -.62), V3(s * .97, .32, -.25)]);
      k.add(new T.TubeGeometry(c, 20, .024, 6), 0xd8dce2, 3);
      sideDecal(k, [[-.45, .88], [-.66, .72], [-.6, .5], [-.4, .4], [-.5, .66]], .985, 0x0b0c0e);
      for (let i = 0; i < 4; i++) k.box(s * (.5 + i * .085), .63, 2.12 - i * .03, .06, .035, .03, 0xf4f1e8, 4, 0, -s * .3);
      k.box(s * .64, .63, 2.1, .42, .08, .1, 0x15161a, 2, 0, -s * .3);
      k.box(s * .62, .36, 2.22, .5, .12, .03, 0x0b0c0e, 2, 0, -s * .25);
    }
    const hs = new T.Shape(); hs.moveTo(-.2, -.18); hs.lineTo(-.2, .02); hs.absarc(0, .02, .2, Math.PI, 0, true); hs.lineTo(.2, -.18); hs.lineTo(-.2, -.18);
    k.add(new T.ExtrudeGeometry(hs, { depth: .04, bevelEnabled: false, curveSegments: 10 }), 0xd8dce2, 3, tf(0, .5, 2.25));
    const hi = new T.Shape(); hi.moveTo(-.16, -.15); hi.lineTo(-.16, .02); hi.absarc(0, .02, .16, Math.PI, 0, true); hi.lineTo(.16, -.15); hi.lineTo(-.16, -.15);
    k.add(new T.ExtrudeGeometry(hi, { depth: .04, bevelEnabled: false, curveSegments: 10 }), 0x0b0c0e, 2, tf(0, .5, 2.265));
    k.box(0, .87, -2.26, 1.8, .035, .03, 0xff1a24, 5);
    k.box(0, .62, -2.27, 1.6, .3, .03, 0x0b0c0e, 2);
    for (const [x, y] of [[-.12, .44], [.12, .44], [-.12, .3], [.12, .3]]) pipe(k, x, y, -2.28, .045);
    k.box(0, .99, -2.0, 1.5, .03, .3, p, 0, .04);
    mirrors(k, 1.0, .95, .85, p);
  },
});

car('duchess', {
  name: 'Duchess 34', cls: '三〇年代古董敞篷', price: 200000, paint: 0xe9dfc6, len: 4.95, w: 1.84, wr: .38, ww: [.18, .18], track: .76, fa: 1.6, ra: -1.45,
  vmax: 46, eng: 7.5, grip: 6.8, rim: ['wire', 0xd8dce2], wall: 1, tag: '直立的鍍鉻水箱罩、像水滴一樣甩到踏板上的獨立葉子板、白邊輪胎與車尾的備胎。慢慢開才是重點。',
  body: (k, p) => {
    const fen = 0x5a1420;
    sideExtrude(k, [[2.12, .6], [2.12, 1.04], [.55, 1.08], [.55, .6]], .92, p, 0, y => 1 - sstep(.96, 1.08, y) * .14, .03);
    for (let i = 0; i < 6; i++) sideDecal(k, [[1.7 - i * .14, .76], [1.66 - i * .14, .96], [1.62 - i * .14, .96], [1.66 - i * .14, .76]], .465, 0x2a1d14);
    k.box(0, .86, 2.2, .7, .56, .08, 0xc8ccd2, 3);
    for (let i = 0; i < 9; i++) k.box(-.28 + i * .07, .86, 2.245, .025, .46, .02, 0x15110d, 2);
    k.cyl(0, 1.18, 2.2, .02, .03, .1, 8, 0xc8ccd2, 3);
    sideExtrude(k, [[.6, .52], [.6, 1.03], [.3, 1.0], [-.4, .96], [-1.6, .99], [-2.2, .92], [-2.45, .78], [-2.45, .62], [-2.1, .5]], 1.3, p, 0, SH(.85, 1.0, .1, .6, 2.45, 0, .3, 1, 2), .04);
    k.box(0, .98, -.45, 1.1, .05, 1.25, 0x2a1810, 10);
    for (const s of [-1, 1]) { k.box(s * .28, 1.05, -.62, .46, .12, .5, 0x4a2a1a, 2); k.box(s * .28, 1.25, -.88, .46, .4, .1, 0x4a2a1a, 2, -.15); }
    k.add(new T.TorusGeometry(.17, .015, 6, 20), 0x1a1210, 2, tf(-.28, 1.2, .12, -.9, 0, 0));
    k.box(0, 1.24, .5, 1.15, .36, .015, 0x0a0c10, 1, -.2);
    k.box(0, 1.42, .465, 1.17, .025, .03, 0xc8ccd2, 3, -.2);
    for (const s of [-1, 1]) k.box(s * .58, 1.24, .5, .025, .38, .03, 0xc8ccd2, 3, -.2);
    for (const s of [-1, 1]) {
      sideExtrude(k, [[2.28, .56], [2.12, .78], [1.85, .88], [1.45, .88], [1.1, .74], [.75, .55], [.25, .45], [.25, .41], [.7, .48], [1.05, .62], [1.35, .8], [1.85, .83], [2.08, .74], [2.2, .55]], .36, fen, 0, y => 1 - sstep(.55, .88, y) * .3, .05, tf(s * .76, 0, 0));
      const o = arch(-1.45, .38, .5, 10), i = arch(-1.45, .38, .43, 10).reverse();
      sideExtrude(k, [[-1.98, .4], ...o, [-.85, .42], ...i], .36, fen, 0, y => 1 - sstep(.55, .88, y) * .3, .05, tf(s * .76, 0, 0));
      k.box(s * .76, .42, -.32, .36, .035, 1.15, 0x15110d, 2);
      k.cyl(s * .5, 1.04, 2.16, .15, .12, .18, 16, 0xc8ccd2, 3, Math.PI / 2);
      k.cyl(s * .5, 1.04, 2.255, .13, .13, .02, 16, 0xf6f0dc, 4, Math.PI / 2);
      k.box(s * .35, .98, 2.12, .3, .02, .02, 0xc8ccd2, 3);
      lamp(k, s * .76, .86, -1.78, .045, 0xff1a1a, 5, -1);
    }
    k.cyl(0, .76, -2.56, .36, .36, .17, 22, 0x121212, 6, Math.PI / 2);
    k.cyl(0, .76, -2.65, .27, .27, .02, 22, 0xe8e2d4, 10, Math.PI / 2);
    k.cyl(0, .76, -2.66, .2, .2, .03, 18, 0xc8ccd2, 3, Math.PI / 2);
    k.box(0, .46, 2.4, 1.7, .06, .06, 0xc8ccd2, 3).box(0, .46, -2.5, 1.6, .06, .06, 0xc8ccd2, 3);
  },
});

// 組一台完整的車：wheels 2 = 細緻輪框（展示、車庫）、1 = 簡化輪子（車流的 InstancedMesh）、0 = 不含輪子（玩家座駕另外掛）
function carKit(id, paint, wheels = 2) {
  const c = CARS[id];
  if (c.glb) return carKit(c.proxy, paint ?? c.fb, wheels);   // 實車模型還沒下載好（或以檔案開啟）時的替身
  const k = new Kit();
  c.body(k, paint ?? c.paint);
  if (wheels) for (const s of [-1, 1]) for (const [z, f] of [[c.fa, 0], [c.ra, 1]]) {
    if (wheels === 2) carWheel(k, s * c.track, c.wr, z, c.wr, c.ww[f], c.rim[0], c.rim[1], c.wall, c.cal);
    else wheel(k, s * c.track, c.wr, z, c.wr, c.ww[f], c.rim[1], c.rim[0] === 'wire' ? 0 : 5);
  }
  return k;
}
// 玩家座駕的輪子：單獨的幾何，外側朝 +x，轉動軸在原點
const wheelGeoCache = {};
function carWheelGeo(id, f) {
  if (CARS[id].glb) id = CARS[id].proxy;
  const key = id + f;
  if (!wheelGeoCache[key]) { const c = CARS[id], k = new Kit(); carWheel(k, .001, 0, 0, c.wr, c.ww[f], c.rim[0], c.rim[1], c.wall, c.cal); wheelGeoCache[key] = k.build(); }
  return wheelGeoCache[key];
}
// 車庫車格的順序（車行與車庫只放 26-glb.js 的實車模型；上面程式建模的車留給車流與沒下載到模型時的替身）
const CAR_ORDER = ['ae86', 'e92', 'm3c', 'm4wb', 'm3gtr', 'm3t24', 'm4gt3', 'gt3rs', 'gt3r', 's1krr', 's1krr19',
  'rx7', 'supra', 'r34', 'nsx', 'r35', 'p930', 'rwb', 'e34', 'evo190', 'm4csl', 'chall', 'police', 'zr1', 'f40', 'sf90', 'p1', 'zx6r', 'v4'];
