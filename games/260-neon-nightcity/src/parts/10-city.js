
// ═══ 城市：街區、建築立面、路面與人行道 ═══
await bootStep(BOOT.city, '正在鋪路…');
import PROPS_SPEC from '../../../../assets/260/props/props.json';
const scene = new T.Scene();
// 每區一個 Group（05-zones.js 的變換）：以邏輯座標建好的靜態網格掛進所在的區
for (const zn of ZONES) { zn.g = new T.Group(); zn.g.position.set(zn.ox, 0, zn.oz); zn.g.rotation.y = zn.ry; zn.g.name = 'zone' + zn.id; scene.add(zn.g); }
// 以邏輯座標建好的物件掛進區（zn 省略時看物件的位置，沒有位置就看幾何的中心）
function cityAdd(obj, zn) {
  if (zn === undefined) {
    let x = obj.position.x, z = obj.position.z;
    if (!x && !z && obj.geometry) { obj.geometry.computeBoundingSphere(); x = obj.geometry.boundingSphere.center.x; z = obj.geometry.boundingSphere.center.z; }
    zn = zoneAtL(x, z);
  }
  (zn ? zn.g : scene).add(obj);
  return obj;
}
// 整座城合併成一個網格的（招牌、招牌背板）：頂點都在同一區就掛進那一區，否則把每個頂點依所在的區換成世界座標、網格掛在 scene
function cityAddAny(m) {
  const g = m.geometry, p = g.attributes.position, nrm = g.attributes.normal, zs = new Set();
  for (let k = 0; k < p.count; k++) zs.add(zoneAtL(p.getX(k), p.getZ(k)));
  if (zs.size === 1) return cityAdd(m, [...zs][0]);
  for (let k = 0; k < p.count; k++) {
    const zn = zoneAtL(p.getX(k), p.getZ(k)), [x, z] = toW(p.getX(k), p.getZ(k), zn);
    p.setXYZ(k, x, p.getY(k), z);
    if (nrm) { const [nx, nz] = dirW(zn, nrm.getX(k), nrm.getZ(k)); nrm.setXYZ(k, nx, nrm.getY(k), nz); }
  }
  p.needsUpdate = true; if (nrm) nrm.needsUpdate = true; g.computeBoundingSphere();
  scene.add(m); return m;
}
const LY = { MAIN: 0, NOREFL: 1 };     // 1 號圖層不進倒影（雨、蒸氣、小物件）
const rnd = rng(20261019);
const colliders = [];                   // 靜態 AABB：{x0,x1,z0,z1}
const circles = [];                     // 靜態圓柱：{x,z,r}
let activeBoxes = colliders, activeCircles = circles;   // 室內時換成室內的碰撞表
const blocks = [], lots = [], shopUnits = [];

// 依序建：原本的 5×5、World 第一輪的 8×7、第二輪的 20×15（亂數序列和擴建前一樣，舊城區的地塊與立面不變）
const CORE = 5, isCore = (i, j) => i < CORE && j < CORE, isOld = (i, j) => i < 8 && j < 7;
const phase = (i, j) => isCore(i, j) ? 0 : isOld(i, j) ? 1 : 2;
for (const ph of [0, 1, 2]) for (let i = 0; i < (ph < 2 ? 8 : NX); i++) for (let j = 0; j < (ph < 2 ? 7 : NZ); j++)
  if (phase(i, j) === ph) blocks.push({ i, j, x0: avX(i) + HR, x1: avX(i + 1) - HR, z0: stZ(j) + HR, z1: stZ(j + 1) - HR, outer: 0 });
const OUT_D = 50, CITY_X0 = avX(0) - HR, CITY_X1 = avX(NX) + HR, CITY_Z0 = stZ(0) - HR, CITY_Z1 = stZ(NZ) + HR;
const CITY_CX = (CITY_X0 + CITY_X1) / 2, CITY_CZ = (CITY_Z0 + CITY_Z1) / 2;
// 海岸（21-coast.js）：南面是海（西半珊瑚灘的沙灘、東半錨灣港的碼頭與跨海橋過去的灰鷗島）、東面是海灣、西面是灰鷺河，只有北面留著樓牆，背後是山。
// 外圍 OUT_D 寬的人行道板變成濱海步道；下面是步道外還能走的地（矩形，y = 0；沙灘往海裡斜下去、棧橋高 0.4 m）。
const SEA_Y = -1.6, SHORE_Z = CITY_Z1 + OUT_D, BEACH_X1 = avX(10) - HR;
const BEACH = { x0: CITY_X0 - OUT_D, x1: BEACH_X1, z0: SHORE_Z, z1: SHORE_Z + 58, len: 90, drop: 3 };   // 90 m 從 0 斜到 -3，走到水深 0.3 m 為止
const QUAY = { x0: BEACH_X1, x1: CITY_X1 + OUT_D, z0: SHORE_Z, z1: SHORE_Z + 110 };
const BRIDGE_X = avX(16) + 36;
const ISLE = { x0: BRIDGE_X - 180, x1: BRIDGE_X + 180, z0: QUAY.z1 + 230, z1: QUAY.z1 + 480 };
const BRIDGE = { x0: BRIDGE_X - 7, x1: BRIDGE_X + 7, z0: QUAY.z1, z1: ISLE.z0 };
const PIERS = [
  { x0: avX(4) - 5, x1: avX(4) + 5, z0: SHORE_Z, z1: SHORE_Z + 190, h: .4, name: 'coral' },   // 珊瑚灘棧橋（盡頭是摩天輪）
  ...[1, 3].map(j => ({ x0: CITY_X0 - OUT_D - 64, x1: CITY_X0 - OUT_D, z0: stZ(j) + 24, z1: stZ(j) + 38, h: .15, name: 'dock' })),   // 舊碼頭伸進河裡的兩座木棧
];
// 對岸（21-coast.js 的遠景）：灰鷺河西岸、東灣東岸的堤岸線
const FAR_BANK_X = CITY_X0 - OUT_D - 300, EAST_BANK_X = CITY_X1 + OUT_D + 300;
// 對岸的濱水步道：灰鷺河對岸（A 區，London City 模型前）與東灣對岸（C 區，舊港城模型前）各一條 20 m 寬，中間一座渡船碼頭。
// back 那一邊靠著遠景模型，不做低擋牆，換成一道高牆（21-coast.js 在那裡蓋一排近景的樓面）
const BANK_WALKS = [
  { x0: FAR_BANK_X - 20, x1: FAR_BANK_X, z0: CITY_Z0 - 60, z1: stZ(7) - 30, h: .15, back: 'x0', name: '鷺岸步道', en: 'Heron Quay' },
  { x0: EAST_BANK_X, x1: EAST_BANK_X + 20, z0: stZ(7) + 30, z1: CITY_CZ + 180, h: .15, back: 'x1', name: '舊港步道', en: 'Old Harbour Quay' },
];
const FERRY = BANK_WALKS.map((B, i) => { const zc = Math.round((B.z0 + B.z1) / 2); return i ? { x0: B.x0 - 30, x1: B.x0, z0: zc - 2.5, z1: zc + 2.5, h: .4, name: '舊港渡口' } : { x0: B.x1, x1: B.x1 + 30, z0: zc - 2.5, z1: zc + 2.5, h: .4, name: '鷺岸渡口' }; });
const LANDS = [{ x0: CITY_X0 - OUT_D, x1: CITY_X1 + OUT_D, z0: -1e5, z1: SHORE_Z }, BEACH, QUAY, BRIDGE, ISLE, ...PIERS, ...BANK_WALKS, ...FERRY];
const inLand = (x, z) => LANDS.some(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
// ─── 北嶺公園（畫面在 21-park.js）：北面樓牆在 Cinder Av（avX(3)）北端開一道門，門外是一片走得上去的山坡，A 區邏輯座標 ───
// 山坡網格的範圍（x0…x1、z0…z1）對齊 21-coast.js 第一層遠景山脊的格線：邊界上的高度照山脊頂點線性內插，接得起來；
// 範圍裡的山脊頂點壓到地下，被山坡蓋住。walk 是圍籬圈起來、走得到的範圍；車被門口的路樁擋住
const NPARK = (() => {
  const zr = CITY_Z0 - 700, RX0 = CITY_X0 - 2600, RX1 = CITY_X1 + 2600, ax1 = Math.min(RX1, avX(8) + 60);   // 21-coast.js 第一層山脊（A 區那一段）
  const n = Math.max(4, Math.round(90 * (ax1 - RX0) / (RX1 - RX0))), dx = (ax1 - RX0) / n, gx = avX(3);
  const ka = Math.round((gx - 240 - RX0) / dx), kb = Math.round((gx + 270 - RX0) / dx);
  return {
    zr, RX0, dx, ph: rng(4242)() * 100,   // ph：21-coast.js 的 rng(4242) 第一個值就是第一層山脊的相位
    x0: RX0 + ka * dx, x1: RX0 + kb * dx, z0: zr - 300, z1: CITY_Z0 - OUT_D, gx, gw: 10,
    walk: { x0: gx - 120, x1: gx + 120, z0: CITY_Z0 - OUT_D - 620, z1: CITY_Z0 - OUT_D },
    name: '北嶺公園 North Ridge Park',
  };
})();
// 第一層山脊的高度（21-coast.js 的頂點公式）
const ridgeAt = (x, z) => {
  const u = (NPARK.zr - z) / 900; if (u <= 0) return 0;
  const ph = NPARK.ph, ridge = (.55 + .45 * Math.sin(x * .0021 + ph) * Math.sin(x * .0057 + ph * 2)) * (.75 + .25 * Math.sin(x * .013 + ph));
  return Math.max(0, Math.sin(Math.min(1, u * 1.15) * Math.PI * .5)) * 140 * ridge;
};
// 山坡的底：山脊頂點之間的雙線性內插（邊界線上和山脊的三角形一樣是兩頂點之間的直線）
const parkBase = (x, z) => {
  if (z >= NPARK.zr) return 0;
  const k = (x - NPARK.RX0) / NPARK.dx, m = (NPARK.zr - z) / 150, k0 = Math.floor(k), m0 = Math.floor(m), a = k - k0, b = m - m0;
  const V = (kk, mm) => ridgeAt(NPARK.RX0 + kk * NPARK.dx, NPARK.zr - mm * 150);
  return (V(k0, m0) * (1 - a) + V(k0 + 1, m0) * a) * (1 - b) + (V(k0, m0 + 1) * (1 - a) + V(k0 + 1, m0 + 1) * a) * b;
};
// 山坡本身：門口一片平地，往北 600 m 爬到約 55 m；沿步道那一帶略低，兩側與後面在網格邊界前降回山脊
const parkHill = (x, z) => {
  const W = NPARK.walk, d = NPARK.z1 - z, main = 55 * sstep(30, 600, d);
  const side = x < W.x0 - 20 ? sstep(NPARK.x0, W.x0 - 20, x) : x > W.x1 + 20 ? sstep(NPARK.x1, W.x1 + 20, x) : 1, back = sstep(NPARK.z0, W.z0 - 40, z);
  const vale = 1 - .3 * Math.exp(-(((x - NPARK.gx - 15) / 110) ** 2));
  const nz = Math.sin(x * .029 + z * .013 + 1.7) * Math.sin(z * .037 - x * .011) * .6 + Math.sin(x * .071 - z * .053) * .4;
  return side * back * (.15 + main * (vale + .12 * nz));
};
const inParkMesh = (x, z) => x >= NPARK.x0 && x <= NPARK.x1 && z >= NPARK.z0 && z <= NPARK.z1;
const parkH = (x, z) => parkBase(x, z) + parkHill(x, z);
// 步道：門口往北蜿蜒到山頂的觀景台（控制點：離門中線的 x、離樓牆背面的距離），每 2 m 取一點
NPARK.trail = (() => {
  const C = [[0, -2], [0, 45], [-22, 110], [18, 185], [-26, 260], [8, 335], [44, 400], [26, 465], [52, 530], [60, 588]].map(([x, d]) => [NPARK.gx + x, NPARK.z1 - d]);
  const out = [];
  for (let i = 0; i < C.length - 1; i++) {
    const p0 = C[Math.max(0, i - 1)], p1 = C[i], p2 = C[i + 1], p3 = C[Math.min(C.length - 1, i + 2)];
    const n = Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 2);
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => .5 * (2 * p1[j] + (p2[j] - p0[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(C[C.length - 1]);
  return out;
})();
// 觀景台（步道盡頭）與管理站：平台高度固定，站上去不跟著坡
{
  const [lx, lz] = NPARK.trail[NPARK.trail.length - 1], cx = lx, cz = lz - 5;
  let h = 0; for (const [dx, dz] of [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5], [0, 0]]) h = Math.max(h, parkH(cx + dx, cz + dz));
  NPARK.look = { x0: cx - 4.5, x1: cx + 4.5, z0: cz - 4.5, z1: cz + 4.5, h: h + .35, cx, cz };
  NPARK.cabin = { x: NPARK.gx - 36, z: NPARK.z1 - 48 };
}
// ─── 岬角：從岸邊伸進灰鷺河與東灣的草地公園（世界座標的多邊形），海岸線就不是一條直線 ───
// 只往水裡加，不切進原本的陸地矩形。兩區在岸邊交會的地方（縫的兩端）各有一塊順著兩邊岸線把錯開的岸角接起來，
// 另外 C 區西岸、B 區東岸各凸出一個岬。wet[k]：pts[k] → pts[k + 1] 臨水（擋牆、欄杆、路燈、護岸只做這些邊）；
// caps 是臨水那串邊接回岸邊的兩端（各補一小段順著岸的擋牆，不留縫）。地面高度 0（和縫一樣）
const CAPES = (() => {
  const [zA, zB, zC] = ZONES, zm = stZ(zA.nj1), L0 = CITY_X0 - OUT_D, L1 = CITY_X1 + OUT_D;
  const bez = (a, b, c, d, n) => {
    const out = [];
    for (let k = 1; k < n; k++) { const t = k / n, u = 1 - t, w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t]; out.push([0, 1].map(i => w[0] * a[i] + w[1] * b[i] + w[2] * c[i] + w[3] * d[i])); }
    return out;
  };
  // 兩區的岸角之間：p 是上一區（zp）的岸角，沿下一區（zn）的岸往南 len 公尺，臨水的是順著兩邊岸線的三次曲線
  const fillet = (zp, zn, x, out, len, name) => {
    const p = toW(x, zm, zp), c0 = toW(x, zm, zn), c1 = toW(x, zm + len, zn), dp = dirW(zp, 0, 1), dn = dirW(zn, 0, 1), h = len * .5;
    const curve = bez(c1, [c1[0] - dn[0] * h, c1[1] - dn[1] * h], [p[0] + dp[0] * h, p[1] + dp[1] * h], p, 16);
    return { name, pts: [p, c0, c1, ...curve], wet: [0, 0, ...curve.map(() => 1), 1], caps: [[p, zp, out], [c1, zn, out]] };
  };
  // 岸邊凸出去的岬：沿 zn 的岸（邏輯 x 固定、z 從 a0 到 a1），往 out（−1 西、+1 東）最多 depth 公尺，外緣帶一點起伏
  const point = (zn, x, out, a0, a1, depth, seed, name) => {
    const n = 20, pts = [];
    for (let k = 0; k <= n; k++) { const t = k / n, d = depth * Math.sin(Math.PI * t ** .85) ** .7 * (1 + .12 * Math.sin(t * 9 + seed)); pts.push(toW(x + out * d, a0 + (a1 - a0) * t, zn)); }
    return { name, pts, wet: pts.map((_, k) => k < n ? 1 : 0), caps: [[pts[0], zn, out], [pts[n], zn, out]] };
  };
  const list = [
    fillet(zA, zC, L0, -1, 210, '灰鷺河濱公園 Heron Riverside'), fillet(zB, zC, L1, 1, 190, '東灣岸角公園 Bayside Green'),
    point(zC, L0, -1, 600, 730, 42, 1.3, '鷺嘴岬 Heron Point'), point(zB, L1, 1, -40, 90, 46, 4.1, '東灣觀景岬 Bay Lookout'),
  ];
  for (const h of list) {
    const xs = h.pts.map(p => p[0]), zs = h.pts.map(p => p[1]);
    h.bb = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    h.inn = polyInset(h.pts, h.wet.map(w => w ? 6 : 0));   // 種樹的範圍：離水邊 6 m
    h.walk = [1, 3.4].map(d => polyInset(h.pts, h.wet.map(w => w ? d : 0)));   // 沿水邊的碎石步道（離水邊 1–3.4 m；燈在 0.6 m、長椅在 4 m）
  }
  return list;
})();
const capeAt = (X, Z) => { for (const h of CAPES) if (X >= h.bb[0] && X <= h.bb[1] && Z >= h.bb[2] && Z <= h.bb[3] && inPoly(h.pts, X, Z)) return h; return null; };
{ // 外圍：一整圈連續的樓牆，背後再一圈高樓
  const D = OUT_D, ax0 = CITY_X0, ax1 = CITY_X1, sz0 = CITY_Z0, sz1 = CITY_Z1;
  blocks.push({ x0: ax0 - D, x1: ax1 + D, z0: sz1, z1: sz1 + D, outer: 'n' });
  blocks.push({ x0: ax0 - D, x1: ax1 + D, z0: sz0 - D, z1: sz0, outer: 's' });
  blocks.push({ x0: ax0 - D, x1: ax0, z0: sz0, z1: sz1, outer: 'w' });
  blocks.push({ x0: ax1, x1: ax1 + D, z0: sz0, z1: sz1, outer: 'e' });
}
// 區域：i、j 是以大道／街為單位的連續座標（街區 (bi, bj) 的範圍是 bi…bi+1）
const DISTRICTS = [
  // 第二輪（World 延伸）：北半往東是光環廣場與灰石國宅，中段是楓林里、燈籠公園、琥珀工業區，最南一排是珊瑚灘與錨灣港
  { name: '光環廣場 Halo Square', i0: 8, i1: 13, j0: 0, j1: 7 },
  { name: '灰石國宅 Greystone Estates', i0: 13, i1: NX, j0: 0, j1: 7 },
  { name: '燈籠公園 Lantern Park', i0: 9, i1: 12, j0: 8, j1: 10 },
  { name: '楓林里 Maple Row', i0: 0, i1: 8, j0: 7, j1: 11 },
  { name: '公園大道 Parkside', i0: 8, i1: 13, j0: 7, j1: 11 },
  { name: '琥珀工業區 Amber Works', i0: 13, i1: NX, j0: 7, j1: 11 },
  { name: '珊瑚灘 Coral Beach', i0: 0, i1: 10, j0: 11, j1: NZ },
  { name: '錨灣港 Anchor Bay', i0: 10, i1: NX, j0: 11, j1: NZ },
];
const district = (x, z) => {
  const i = (x - X0) / P, j = (z - Z0) / Q;
  if (z > CITY_Z1) {   // 海邊（21-coast.js）：在格網外，要先判斷
    if (z >= ISLE.z0 - 4) return '灰鷗島 Gull Island';
    if (z > QUAY.z1 && x > BRIDGE.x0 - 30 && x < BRIDGE.x1 + 30) return '灰鷗大橋 Gullwing Bridge';
    return x < BEACH_X1 ? '珊瑚灘 Coral Beach' : '錨灣港 Anchor Bay';
  }
  for (const B of [...BANK_WALKS, ...FERRY]) if (x >= B.x0 - 2 && x <= B.x1 + 2 && z >= B.z0 - 2 && z <= B.z1 + 2) return `${B.name} ${B.en || (B.x0 < CITY_X0 ? 'Heron Ferry' : 'Old Harbour Ferry')}`;
  if (z < CITY_Z0 && x >= NPARK.gx - NPARK.gw - 2 && x <= NPARK.gx + NPARK.gw + 2 || z < NPARK.z1 && inParkMesh(x, z)) return NPARK.name;
  if (x < CITY_X0) return '灰鷺河濱 Heron Riverside';
  if (i < 0 || i > NX || j < 0 || j > NZ) return '城郊 Outskirts';
  if (i >= 8 || j >= 7) { for (const d of DISTRICTS) if (i >= d.i0 && i <= d.i1 && j >= d.j0 && j <= d.j1) return d.name; return '城郊 Outskirts'; }
  // World 第一輪：東邊三排是金融區、南邊兩排是住宅坡、東南角是貨場
  if (i > CORE && j > CORE) return '鐵灣貨場 Ironbay Yards';
  if (i > CORE) return '冠石金融區 Crownstone';
  if (j > CORE) return '雲杉坡 Spruce Hill';
  if (i >= 1 && i <= 3.4 && j >= 1.5 && j <= 4) return '霓虹區 Neon District';
  if (i < 1.6) return '舊碼頭 Old Docks';
  if (j < 1.5) return '紅磚巷 Brick Row';
  if (i > 3.4) return '中城 Midtown';
  return '霓虹區 Neon District';
};
const isPark = b => b && !b.outer && district((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2).startsWith('燈籠');

// 特殊店面：LAZARUS 夜店（Atlas 與 Bishop 之間，面向 9 St）、AFTERGLOW 酒吧（Cinder 與 Delmar 之間，面向 7 St）、
// CHROME WORKS 改裝廠（Bishop 與 Cinder 之間，面向 8 St）、VELOCE MOTORS 車行（Cinder 與 Delmar 之間，面向 9 St）、
// 你的車庫 GARAGE 07（Harbor 與 Atlas 之間，面向 8 St）
const SPECIAL = {
  club: { i: 1, j: 2, side: +1, at: .5, w: 20 },
  bar: { i: 3, j: 0, side: +1, at: .45, w: 13 },
  garage: { i: 2, j: 1, side: +1, at: .5, w: 13 },
  dealer: { i: 3, j: 2, side: +1, at: .5, w: 22 },
  home: { i: 0, j: 2, side: -1, at: .78, w: 12 },
};
const DEAL_X = lerp(avX(3) + HR + SW, avX(4) - HR - SW, SPECIAL.dealer.at), DEAL_Z = stZ(3) - HR - SW;
const HOME_X = lerp(avX(0) + HR + SW, avX(1) - HR - SW, SPECIAL.home.at), HOME_Z = stZ(2) + HR + SW;
const venues = {};

// 一個街區切成兩排（面向 -z 與 +z），每排沿 x 切成數個地塊
function makeLots(b) {
  const bx0 = b.x0 + SW, bx1 = b.x1 - SW, bz0 = b.z0 + SW, bz1 = b.z1 - SW;
  if (b.outer) {
    const face = { n: -1, s: 1, w: 1, e: -1 }[b.outer];
    if (b.outer === 'n' || b.outer === 's') {
      const zf = b.outer === 'n' ? bz0 : bz1, zb = b.outer === 'n' ? bz0 + 22 : bz1 - 22;
      rowLots(bx0, bx1, Math.min(zf, zb), Math.max(zf, zb), face, b, 'z');
      backTowers(bx0, bx1, b.outer === 'n' ? zb : b.z0, b.outer === 'n' ? b.z1 : zb, 'x');
    } else {
      const xf = b.outer === 'w' ? bx1 : bx0, xb = b.outer === 'w' ? bx1 - 22 : bx0 + 22;
      rowLots(Math.min(xf, xb), Math.max(xf, xb), b.z0 + SW, b.z1 - SW, face, b, 'x');
      backTowers(b.outer === 'w' ? b.x0 : xb, b.outer === 'w' ? xb : b.x1, b.z0, b.z1, 'z');
    }
    const c = { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1 };
    if (b.outer === 'n') c.z0 += SW; else if (b.outer === 's') c.z1 -= SW; else if (b.outer === 'w') c.x1 -= SW; else c.x0 += SW;
    c.outer = b.outer; colliders.push(c);
    return;
  }
  if (isPark(b)) { b.park = 1; return; }   // 公園：只有人行道一圈，中間是草地與樹（20-props.js），車可以開進去
  const mid = (bz0 + bz1) / 2;
  rowLots(bx0, bx1, bz0, mid, -1, b, 'z');
  rowLots(bx0, bx1, mid, bz1, +1, b, 'z');
  colliders.push({ x0: bx0, x1: bx1, z0: bz0, z1: bz1 });
}
// axis 'z'：地塊沿 x 排開、正面朝 ±z；axis 'x'：沿 z 排開、正面朝 ±x
function rowLots(x0, x1, z0, z1, face, b, axis) {
  const along0 = axis === 'z' ? x0 : z0, along1 = axis === 'z' ? x1 : z1;
  let a = along0;
  const sp = Object.entries(SPECIAL).find(([, s]) => s.i === b.i && s.j === b.j && s.side === face && axis === 'z');
  const cuts = [];
  if (sp) { const c = lerp(along0, along1, sp[1].at); cuts.push([c - sp[1].w / 2, c + sp[1].w / 2, sp[0]]); }
  while (a < along1 - .01) {
    let w = 7 + rnd() * 9;
    const cut = cuts.find(c => a < c[1] && a + w > c[0]);
    if (cut) {
      if (a < cut[0] - .01) w = cut[0] - a;
      else { addLot(axis, cut[0], cut[1], x0, x1, z0, z1, face, b, cut[2]); a = cut[1]; continue; }
    }
    if (along1 - (a + w) < 6) w = along1 - a;
    addLot(axis, a, a + w, x0, x1, z0, z1, face, b, null);
    a += w;
  }
}
function addLot(axis, a0, a1, x0, x1, z0, z1, face, b, special) {
  const L = axis === 'z' ? { x0: a0, x1: a1, z0, z1 } : { x0, x1, z0: a0, z1: a1 };
  const cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2;
  const dist = district(cx, cz);
  const neon = dist.startsWith('霓虹'), mid = dist.startsWith('中城'), fin = dist.startsWith('冠石'), res = dist.startsWith('雲杉'), docks = dist.startsWith('舊碼頭') || dist.startsWith('鐵灣');
  const halo = dist.startsWith('光環'), grey = dist.startsWith('灰石'), maple = dist.startsWith('楓林'), side = dist.startsWith('公園'),
    works = dist.startsWith('琥珀') || dist.startsWith('錨灣'), beach = dist.startsWith('珊瑚');
  let style, floors;
  const r = rnd();
  if (special === 'club') { style = 5; floors = 3; }
  else if (special === 'bar') { style = 6; floors = 4; }
  else if (special === 'garage') { style = 2; floors = 2; }
  else if (special === 'dealer') { style = 3; floors = 0; }
  else if (special === 'home') { style = 2; floors = 3; }
  else if (b.outer) { style = r < .5 ? 0 : r < .75 ? 1 : 2; floors = 5 + Math.floor(rnd() * 6); }
  else if (mid && r < .35 || fin && r < .6 || halo && r < .55) { style = 3; floors = 0; }
  else if (grey) { style = r < .6 ? 2 : 0; floors = 7 + Math.floor(rnd() * 9); }
  else if (maple || side) { style = r < .5 ? 0 : r < .8 ? 2 : 1; floors = (side ? 5 : 3) + Math.floor(rnd() * 4); }
  else if (works) { style = r < .75 ? 1 : 0; floors = 2 + Math.floor(rnd() * 3); }
  else if (beach) { style = r < .45 ? 4 : r < .75 ? 2 : 0; floors = 2 + Math.floor(rnd() * 4); }
  else if (res) { style = r < .75 ? 0 : 2; floors = 4 + Math.floor(rnd() * 5); }
  else if (neon && r < .3) { style = 4; floors = 4 + Math.floor(rnd() * 5); }
  else if (neon && r < .4) { style = 3; floors = 0; }
  else { style = docks ? (r < .7 ? 1 : 0) : r < .55 ? 0 : r < .8 ? 1 : 2; floors = 3 + Math.floor(rnd() * (docks ? 3 : 6)); }
  const fh = style === 3 ? 3.7 : style === 2 ? 3.4 : 3.1;
  const h = style === 3 ? 38 + rnd() * (mid || fin ? 70 : halo ? 120 : 40) : 4.6 + floors * fh + .7;
  lots.push({ ...L, h, style, seed: rnd() * 1000, face, axis, special, fh, b });
}
function backTowers(x0, x1, z0, z1, along) {
  const a0 = along === 'x' ? x0 : z0, a1 = along === 'x' ? x1 : z1;
  for (let a = a0; a < a1 - 4;) {
    const w = Math.min(a1 - a, 16 + rnd() * 18);
    const L = along === 'x' ? { x0: a, x1: a + w, z0, z1 } : { x0, x1, z0: a, z1: a + w };
    lots.push({ ...L, h: 50 + rnd() * 110, style: rnd() < .7 ? 3 : 2, seed: rnd() * 1000, face: 0, axis: along === 'x' ? 'z' : 'x', back: 1, fh: 3.7 });
    a += w;
  }
}
blocks.forEach(makeLots);
// 南、東、西面臨水：外圍樓牆照樣產生（亂數序列和以前一樣）再丟掉，只留北面的樓牆與背後的高樓
const shoreSide = b => b && b.outer && b.outer !== 's';
for (let k = lots.length - 1; k >= 0; k--) { const L = lots[k]; if (L.b ? shoreSide(L.b) : L.z1 > CITY_Z0) lots.splice(k, 1); }
for (let k = colliders.length - 1; k >= 0; k--) if (colliders[k].outer && colliders[k].outer !== 's') colliders.splice(k, 1);
// A、B 兩區的北面樓牆中間被縫隔開（05-zones.js 的 SEAM）：A 區的樓牆往東多蓋一棟塔樓補上缺口（地塊與碰撞框指定 A 區，伸進縫裡）
{
  const zA = ZONES[0], zB = ZONES[1], xm = avX(zA.ni1);
  let w = 0; for (const z of [CITY_Z0, CITY_Z0 - OUT_D]) w = Math.max(w, toL(...toW(xm, z, zB), zA)[0] - xm);
  if (w > 1) {
    const L = { x0: xm - 2, x1: xm + w + 6, z0: CITY_Z0 - OUT_D, z1: CITY_Z0 - SW, h: 96, style: 3, seed: 517, face: 0, axis: 'z', back: 1, fh: 3.7, zn: zA, seam: 1 };   // seam：地圖在縫之後才畫它
    lots.push(L);
    colliders.push({ x0: L.x0, x1: L.x1, z0: L.z0, z1: L.z1, zn: zA });   // cityWorld() 不切到各區
  }
}
// 地塊所在的區（立面、陰影高度圖、直升機的屋頂高度都照這個）
for (const L of lots) if (L.zn === undefined) L.zn = zoneAtL((L.x0 + L.x1) / 2, (L.z0 + L.z1) / 2);
// 岸邊的擋牆：沿每塊地的邊每 2 m 看外側是不是水（岬角也算陸地），連續的一段變成一個 4 m 厚的盒（low：不擋相機與子彈）
const landL = (x, z) => inLand(x, z) || !!capeAt(...toW(x, z));
// 梯子：從水裡爬上岸的地方。擋牆在梯子前留一段 2.2 m 只擋車與船、不擋人的缺口（swim），游進去碰到岸就上岸，從岸上走過去就下水；梯子的樣子在 21-coast.js。
// { x, z } 是岸邊那一點（邏輯座標），(nx, nz) 朝水面；岸外不是水（岬角、沙灘）的就不放
const LADDERS = [
  ...[-1, 1].map(s => ({ x: s < 0 ? PIERS[0].x0 : PIERS[0].x1, z: SHORE_Z + 150, nx: s, nz: 0 })),              // 珊瑚灘棧橋兩側
  ...PIERS.slice(1).map(P => ({ x: P.x0, z: (P.z0 + P.z1) / 2, nx: -1, nz: 0 })),                                 // 舊碼頭木棧的盡頭
  ...[560, 940, 1170].map(x => ({ x, z: QUAY.z1, nx: 0, nz: 1 })),                                                // 錨灣港碼頭邊（船的西邊、跨海橋兩側）
  ...[BRIDGE_X - 34, BRIDGE_X + 34].map(x => ({ x, z: ISLE.z0, nx: 0, nz: -1 })), { x: BRIDGE_X + 60, z: ISLE.z1, nx: 0, nz: 1 },   // 灰鷗島
  ...[5, 9, 13].map(j => ({ x: CITY_X0 - OUT_D, z: stZ(j) + 31, nx: -1, nz: 0 })),                                // 灰鷺河濱步道
  ...[2, 6, 10].map(j => ({ x: CITY_X1 + OUT_D, z: stZ(j) + 31, nx: 1, nz: 0 })),                                 // 東灣步道
  ...BANK_WALKS.flatMap((B, i) => [.2, .8].map(t => ({ x: i ? B.x0 : B.x1, z: B.z0 + (B.z1 - B.z0) * t, nx: i ? -1 : 1, nz: 0 }))),   // 對岸步道
  ...FERRY.map((F, i) => ({ x: i ? F.x0 : F.x1, z: (F.z0 + F.z1) / 2, nx: i ? -1 : 1, nz: 0 })),                   // 渡船碼頭的盡頭
].filter(L => !landL(L.x + L.nx * 1.5, L.z + L.nz * 1.5) && !landL(L.x + L.nx * 1.5 + L.nz * 2, L.z + L.nz * 1.5 + L.nx * 2) && !landL(L.x + L.nx * 1.5 - L.nz * 2, L.z + L.nz * 1.5 - L.nx * 2));
for (const r of LANDS) {
  for (const [ax, fixed, a0, a1, out, side] of [['x', r.z0, r.x0, r.x1, -1, 'z0'], ['x', r.z1, r.x0, r.x1, 1, 'z1'], ['z', r.x0, r.z0, r.z1, -1, 'x0'], ['z', r.x1, r.z0, r.z1, 1, 'x1']]) {
    if (fixed < -1e4) continue;
    if (r.back === side) { colliders.push({ x0: out < 0 ? fixed - 1 : fixed, x1: out < 0 ? fixed : fixed + 1, z0: a0, z1: a1 }); continue; }   // 對岸步道靠樓那一邊：高牆
    let run = null;
    const flush = (end) => {
      if (!run) return;
      const [p0, p1] = [run, end], [f0, f1] = out < 0 ? [fixed - 4, fixed] : [fixed, fixed + 4];
      // 沙灘外緣（水深 0.3 m 處）那段擋車不擋人：人可以涉水、游出去（40-people.js 的 swim）
      const swim = r === BEACH && fixed === r.z1 ? 1 : 0;
      const put = (a, b, sw) => { if (b - a > .01) colliders.push(ax === 'x' ? { x0: a, x1: b, z0: f0, z1: f1, low: 1, swim: sw } : { x0: f0, x1: f1, z0: a, z1: b, low: 1, swim: sw }); };
      let a = p0;
      for (const L of LADDERS) {   // 梯子前的缺口
        const along = ax === 'x' ? L.x : L.z, at = ax === 'x' ? L.z : L.x, n = ax === 'x' ? L.nz : L.nx;
        if (n !== out || Math.abs(at - fixed) > .5 || along - 1.1 < a || along + 1.1 > p1) continue;
        put(a, along - 1.1, swim); put(along - 1.1, along + 1.1, 1); a = along + 1.1; L.ok = 1;
      }
      put(a, p1, swim);
      run = null;
    };
    for (let a = a0; a <= a1 + 1e-6; a += 2) {
      const wet = ax === 'x' ? !landL(a, fixed + out * .6) : !landL(fixed + out * .6, a);
      if (wet && run === null) run = a - 1; else if (!wet) flush(a - 1);
    }
    flush(a1 + 1);
  }
}

// ─── 實體建築：以 http(s) 開啟時，部分連續地塊合併換成 DanielZhabotinsky 建築組的模型（tools/props.mjs → assets/260/props/bld_*.glb，
// 規格在 props.json）。這些地塊不建程式立面、不開店面；模型由 27-props.js 下載擺放，下載失敗再補回程式立面（lotFallback）。
const BLD_ON = /^https?:$/.test(location.protocol);
const bldPlace = [];   // { set, id, x, z, ry, s, lots }
if (BLD_ON) {
  const rb = rng(5150), pool = {};
  for (const [set, v] of Object.entries(PROPS_SPEC)) if (set.startsWith('bld_')) pool[set] = Object.entries(v.items).map(([id, it]) => ({ id, ...it }));
  // World 第四輪：bld_grc（各區的辦公樓與公寓）、bld_w1（舊辦公樓、清水模板樓）、bld_rural（海邊的木屋與小店）也加進來
  const SETS = { 紅磚: ['bld_brown', 'bld_brown', 'bld_mid', 'bld_grc'], 舊碼: ['bld_ind', 'bld_ind', 'bld_brown', 'bld_w1'], 中城: ['bld_down', 'bld_down', 'bld_brown', 'bld_grc', 'bld_grc'], 霓虹: ['bld_brown', 'bld_down'],
    冠石: ['bld_down', 'bld_grc'], 雲杉: ['bld_res', 'bld_brown', 'bld_res', 'bld_mid'], 鐵灣: ['bld_ind', 'bld_ind', 'bld_rural'],
    光環: ['bld_down', 'bld_mid', 'bld_grc', 'bld_grc', 'bld_w1'], 灰石: ['bld_grey', 'bld_grey', 'bld_mid', 'bld_w1', 'bld_grc'], 楓林: ['bld_res', 'bld_shop', 'bld_brown', 'bld_mid', 'bld_grc'], 公園: ['bld_brown', 'bld_res', 'bld_down', 'bld_grc'],
    琥珀: ['bld_ind', 'bld_ind', 'bld_grey', 'bld_w1', 'bld_rural'], 珊瑚: ['bld_shop', 'bld_shop', 'bld_brown', 'bld_rural', 'bld_rural'], 錨灣: ['bld_ind', 'bld_rural', 'bld_rural'] };
  const PROB = { 紅磚: .6, 舊碼: .55, 中城: .6, 霓虹: .22, 冠石: .4, 雲杉: .55, 鐵灣: .7, 光環: .5, 灰石: .65, 楓林: .6, 公園: .55, 琥珀: .7, 珊瑚: .65, 錨灣: .75 };
  wholeBlocks(pool);
  const rows = new Map();
  for (const L of lots) { if (L.back) continue; const k = blocks.indexOf(L.b) + '|' + L.face + '|' + L.axis; if (!rows.has(k)) rows.set(k, []); rows.get(k).push(L); }
  for (const row of rows.values()) {
    const ax = row[0].axis, len = L => ax === 'z' ? L.x1 - L.x0 : L.z1 - L.z0, dep = ax === 'z' ? row[0].z1 - row[0].z0 : row[0].x1 - row[0].x0;
    for (let i = 0; i < row.length; i++) {
      if (row[i].special || row[i].glb) continue;
      const dk = district((row[i].x0 + row[i].x1) / 2, (row[i].z0 + row[i].z1) / 2).slice(0, 2), sets = SETS[dk] || SETS.中城;
      if (rb() > (PROB[dk] ?? .45)) continue;
      const list = pool[sets[Math.floor(rb() * sets.length)]];
      if (!list) continue;
      // 往後併入最多四塊地，找寬度比例最接近、深度放得下的一棟（等比縮放 0.85–1.18）
      let best = null;
      for (let j = i, W = 0; j < row.length && !row[j].special && !row[j].glb && j - i < 4; j++) {
        W += len(row[j]);
        for (const b of list) {
          const s = W / b.w;
          if (s < .85 || s > 1.18 || b.d * s > dep + 1.5 || b.d * s < dep * .5 || b.h < 4.5) continue;
          const sc = Math.abs(Math.log(s)) + rb() * .2;
          if (!best || sc < best.sc) best = { b, s, j, sc };
        }
      }
      if (!best) continue;
      const span = row.slice(i, best.j + 1), b = best.b, s = best.s, f = row[i].face, dd = b.d * s / 2;
      const a0 = ax === 'z' ? span[0].x0 : span[0].z0, a1 = ax === 'z' ? span.at(-1).x1 : span.at(-1).z1, am = (a0 + a1) / 2;
      const P = ax === 'z'
        ? { x: am, z: f > 0 ? row[i].z1 - dd : row[i].z0 + dd, ry: f > 0 ? 0 : Math.PI }
        : { x: f > 0 ? row[i].x1 - dd : row[i].x0 + dd, z: am, ry: f > 0 ? Math.PI / 2 : -Math.PI / 2 };
      const set = Object.keys(pool).find(k => pool[k] === list);
      bldPlace.push({ set, id: b.id, ...P, s, h: b.h * s, lots: span });
      for (const L of span) L.glb = bldPlace.at(-1);
      i = best.j;
    }
  }
}
// 北嶺公園的門（NPARK.gx ± gw）：樓牆被門切到的地塊換成切剩的兩段（piece，用自己的亂數）；原地塊留著當 ghost，
// 立面迴圈（下面）與 20-props.js 的窗台設施照原本的寬度抽掉 rnd()，不蓋東西，後面地塊與街道設施的亂數序列和開門前一樣。
// 換成模型的那幾塊（bldPlace）整組退回程式立面，同樣用自己的亂數（原本就不抽 rnd）。碰撞框拆成兩段，門口一排路樁擋車（人走得過，警察也追得進去）
{
  const g0 = NPARK.gx - NPARK.gw, g1 = NPARK.gx + NPARK.gw, hit = L => L.z1 <= CITY_Z0 + .01 && L.z0 >= CITY_Z0 - OUT_D - .01 && !L.seam && L.x0 < g1 && L.x1 > g0;
  for (const L of lots) if (hit(L) && L.glb) {
    const e = L.glb; bldPlace.splice(bldPlace.indexOf(e), 1);
    for (const M of e.lots) { M.glb = null; M.rng = rng(Math.floor(M.seed * 1000) + 7); }
  }
  const pieces = [];
  for (const L of lots) {
    if (!hit(L)) continue;
    for (const [a, b] of [[L.x0, g0], [g1, L.x1]]) if (b - a >= 4) pieces.push({ ...L, x0: a, x1: b, piece: 1, rng: rng(Math.floor(L.seed * 1000) + (a < g0 ? 1 : 2)) });
    L.ghost = L.rng ? 2 : 1;   // 2：本來是模型，從來不抽 rnd，迴圈直接跳過
  }
  lots.push(...pieces);
  for (const c of colliders) if (c.outer === 's' && c.x0 < g0 && c.x1 > g1) { colliders.push({ ...c, x0: g1 }); c.x1 = g0; break; }
  for (let x = g0 + .5; x < g1; x += 1) circles.push({ x, z: CITY_Z0 - 3, r: .12 });   // 路樁：間隔 1 m，人（半徑 0.32）走得過，機車（0.45）與汽車過不去
}

// 整個街區換成一個模型或一群建築：冠石金融區是 bld_fin（golukumar 的紐約街區拆出來的 12 群，tools/props.mjs），
// 光環廣場是 Cyberpunk City 拆出的 14 群（bld_cyber）加上金融區的三群、灰石國宅放 grey_18 塔樓、grey_30 雙層板樓與 grey_31 大板樓、楓林里與公園大道放 golukumar 的 Neighbourhood 整個街區（nbh_01，帶中庭與樹）。
// 一群或兩群並排，等比縮放（最多 1.08 倍）塞進人行道內 47×37 m 的地塊範圍，能轉 90° 放得更大就轉；整個街區的地塊都不建程式立面，
// 下載失敗由第一筆補回。排列是固定的：冠石最高的兩群（fin_02、fin_07）在中間。
function wholeBlocks(pool) {
  const by = {};
  for (const [set, list] of Object.entries(pool)) for (const b of list) by[b.id] = { ...b, set };
  const PLAN = [[6, 2, ['fin_07']], [6, 1, ['fin_02']], [5, 1, ['fin_01']], [7, 1, ['fin_12']], [5, 2, ['fin_05', 'fin_08']], [7, 2, ['fin_04']],
    [6, 3, ['fin_09']], [5, 0, ['fin_03']], [6, 0, ['fin_06']], [7, 3, ['fin_10']], [5, 3, ['fin_11']],
    // 光環廣場：cyberpunk 的 14 群排成 4×4（北排 6 群、南排 8 群照原檔由西往東），剩下兩塊與南邊一塊放金融區的三群
    ...Array.from({ length: 14 }, (_, k) => [9 + k % 4, 1 + Math.floor(k / 4), ['cyber_' + String(k + 1).padStart(2, '0')]]),
    [11, 4, ['fin_07']], [12, 4, ['fin_09']], [9, 5, ['fin_05', 'fin_08']],
    [15, 2, ['grey_18']], [18, 1, ['grey_18']], [16, 5, ['grey_18']], [19, 4, ['grey_31']], [14, 6, ['grey_30']],   // grey_31 是 street8 後面那棟港式大板樓、grey_30 是 70 m 的雙層板樓
    [1, 8, ['nbh_01']], [5, 7, ['nbh_01']], [3, 10, ['nbh_01']], [7, 9, ['nbh_01']], [8, 7, ['nbh_01']], [12, 10, ['nbh_01']],
    // World 第四輪：Procedural City 5 的 14 群玻璃高樓（pc5_10 是兩棟連在一起、放不進一個街區）排滿光環廣場的北排與南段、冠石最南一排；
    // 公園大道面向燈籠公園的是 modern tower（帶廣場）、希臘神廟遺跡（bld_temple，整塊地圍起來不能進去）與 gameready 的兩棟大樓，琥珀工業區一塊是量販店，灰石國宅加上 Tram Station 的板樓與塔樓
    [9, 0, ['pc5_02']], [10, 0, ['pc5_13']], [11, 0, ['pc5_01']], [12, 0, ['pc5_04']], [10, 5, ['pc5_05']], [11, 5, ['pc5_06']], [12, 5, ['pc5_03']],
    [9, 6, ['pc5_08']], [10, 6, ['pc5_07']], [11, 6, ['pc5_11']], [12, 6, ['pc5_09']], [5, 4, ['pc5_12']], [6, 4, ['pc5_14']], [7, 4, ['pc5_15']],
    [10, 7, ['tower']], [9, 7, ['temple']], [9, 10, ['grc_13']], [11, 10, ['grc_01']], [17, 9, ['pet']],
    [14, 1, ['tram_05']], [17, 4, ['tram_05']], [19, 6, ['tram_05']], [16, 0, ['tram_03']], [18, 3, ['tram_03']], [13, 4, ['tram_04']]];
  const AW = P - 2 * HR - 2 * SW, AD = Q - 2 * HR - 2 * SW;
  for (const [bi, bj, ids] of PLAN) {
    const b = blocks.find(o => o.i === bi && o.j === bj && !o.outer), its = ids.map(id => by[id]);
    if (!b || its.some(o => !o)) continue;
    const W = its.reduce((a, o) => a + o.w, 0), D = Math.max(...its.map(o => o.d));
    const s0 = Math.min(AW / W, AD / D, 1.08), s1 = its.length === 1 ? Math.min(AW / D, AD / W, 1.08) : 0, rot = s1 > s0, s = Math.max(s0, s1);
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, mine = lots.filter(L => L.b === b);
    let x = cx - W * s / 2;
    its.forEach((o, k) => {
      const e = { set: o.set, id: o.id, x: rot ? cx : x + o.w * s / 2, z: cz, ry: rot ? Math.PI / 2 : (bi + bj) % 2 ? Math.PI : 0, s, h: o.h * s, lots: k ? [] : mine };
      bldPlace.push(e); x += o.w * s;
      if (!k) for (const L of mine) L.glb = e;
    });
  }
}

// ─── 建築幾何：每個面一個四邊形，帶面寬、樣式、店面遮罩 ───
const FACADE_VS = /* glsl */`
attribute vec4 aB; attribute vec4 aB2;
varying vec3 vW, vN; varying vec2 vUv; varying vec4 vB, vB2;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  vUv = uv; vB = aB; vB2 = aB2;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FACADE_FS = /* glsl */`
${GL_LIB}
varying vec3 vW, vN; varying vec2 vUv; varying vec4 vB, vB2;
vec3 L(vec3 c){ return c*c; }
float brick(vec2 q, out vec2 id){
  vec2 b = q / vec2(.23, .076);
  b.x += step(1., mod(floor(b.y), 2.)) * .5;
  id = floor(b);
  vec2 f = fract(b);
  float m = smoothstep(0., .1, f.y) * smoothstep(1., .9, f.y) * smoothstep(0., .04, f.x) * smoothstep(1., .96, f.x);
  float lod = 1. - smoothstep(.12, .45, fwidth(b.y));
  return mix(.8, m, lod);
}
// 室內映射：從窗面往房間裡射線，求出撞到後牆、側牆或天花板地板
vec3 room(vec3 o, vec3 vd, vec3 dim, float hs, vec3 lc, float kind){
  vec3 inv = 1. / max(abs(vd), vec3(1e-4));
  float tx = (vd.x > 0. ? dim.x - o.x : o.x) * inv.x;
  float ty = (vd.y > 0. ? dim.y - o.y : o.y) * inv.y;
  float tz = (dim.z - o.z) * inv.z;
  float t = min(tx, min(ty, tz));
  vec3 hp = o + vd * t;
  vec3 c; float lit = 1.;
  if (t == tz) {
    vec2 bw = hp.xy / dim.xy;
    c = mix(vec3(.5,.42,.36), vec3(.36,.4,.44), fract(hs*13.));
    if (kind < .5) {                       // 住家：畫框、書架、人影
      float pic = step(.18, bw.x)*step(bw.x, .5)*step(.45, bw.y)*step(bw.y, .72)*step(.45, fract(hs*7.));
      c = mix(c, vec3(.16,.1,.06), pic);
      float shelf = step(.62, bw.x)*step(bw.x, .92)*step(bw.y, .75)*step(.6, fract(hs*3.));
      c = mix(c, vec3(.2,.13,.08) * (.6 + .4*step(.5, fract(bw.y*6.))), shelf);
      float px = fract(hs*29.)*.6 + .2;
      float person = step(abs(bw.x - px), .07 - .03*step(.55, bw.y)) * step(bw.y, .62 + .08*step(abs(bw.x-px), .035)) * step(.72, fract(hs*17.));
      c = mix(c, vec3(.04), person);
    } else if (kind < 1.5) {              // 辦公室：隔板與螢幕
      c = vec3(.5,.52,.55);
      float desk = step(bw.y, .32) * step(.2, bw.y);
      c = mix(c, vec3(.18,.2,.22), desk);
      float scr = step(.32, bw.y) * step(bw.y, .42) * step(.5, fract(bw.x*5.));
      c = mix(c, vec3(.3,.6,1.)*2., scr * step(.4, fract(hs*5.)));
    }
  } else if (t == ty) {
    if (vd.y > 0.) { c = vec3(.75,.72,.66); if (kind > .5 && kind < 1.5) c += step(.85, fract(hp.z*.8)) * 3.; }
    else c = kind > .5 ? vec3(.28,.28,.3) : vec3(.3,.2,.13);
  } else c = vec3(.46,.4,.35) * .85;
  float ld = length(hp - vec3(dim.x*.5, dim.y*.92, dim.z*.45));
  c *= lc * (.45 + 1.3 / (1. + ld*ld*.5));
  return c * mix(1., .55, hp.z / dim.z);
}
// 店面室內：貨架、日光燈、地磚
vec3 shopRoom(vec3 o, vec3 vd, vec3 dim, float hs){
  vec3 inv = 1. / max(abs(vd), vec3(1e-4));
  float tx = (vd.x > 0. ? dim.x - o.x : o.x) * inv.x;
  float ty = (vd.y > 0. ? dim.y - o.y : o.y) * inv.y;
  float tz = (dim.z - o.z) * inv.z;
  float t = min(tx, min(ty, tz));
  vec3 hp = o + vd * t;
  float kind = floor(fract(hs*7.13) * 5.);
  vec3 lc = kind == 2. ? vec3(1.,.62,.32) : kind == 3. ? vec3(.5,.42,.9) : kind == 4. ? vec3(.7,1.,.85) : vec3(1.,.97,.9);
  vec3 c;
  if (t == tz || t == tx) {
    vec2 bw = t == tz ? hp.xy : vec2(hp.z, hp.y);
    c = vec3(.72,.7,.66);
    if (kind == 0. || kind == 4.) {          // 雜貨、藥局：一排排貨架
      float row = floor(bw.y / .42); float fy = fract(bw.y / .42);
      vec3 prod = .25 + .75*vec3(h21(vec2(floor(bw.x*5.), row)), h21(vec2(floor(bw.x*5.)+3., row)), h21(vec2(floor(bw.x*5.)+7., row)));
      c = mix(c, prod, step(.25, fy) * step(bw.y, 2.1) * step(.3, bw.y));
      c *= mix(1., .4, step(fy, .08));
    } else if (kind == 1.) {                 // 洗衣店：滾筒
      vec2 cell = vec2(fract(bw.x / .8) - .5, bw.y - .7);
      float drum = smoothstep(.27, .24, length(cell)) * step(bw.y, 1.2);
      c = mix(vec3(.85), vec3(.15,.2,.25), drum);
    } else if (kind == 2.) {                 // 小吃店：櫃台、菜單燈箱
      c = vec3(.55,.32,.18);
      c = mix(c, vec3(1.2,1.,.7), step(1.7, bw.y) * step(bw.y, 2.3) * step(.15, fract(bw.x*.7)));
    } else {                                 // 電器、遊樂場：亮著的螢幕
      c = vec3(.12,.1,.16);
      vec2 g = vec2(fract(bw.x*1.6), fract(bw.y*1.4));
      vec3 sc = .4 + .6*vec3(h21(floor(bw*vec2(1.6,1.4))), h21(floor(bw*vec2(1.6,1.4))+5.), h21(floor(bw*vec2(1.6,1.4))+9.));
      c = mix(c, sc * 2.2 * (.8 + .2*sin(uTime*3. + bw.x*9.)), step(.12, g.x)*step(g.x,.88)*step(.15,g.y)*step(g.y,.8)*step(.4, bw.y));
    }
  } else if (vd.y > 0.) {
    c = vec3(.6) + step(.8, fract(hp.z / 1.1)) * step(.15, fract(hp.x / 1.6)) * 4.;
  } else {
    vec2 tl = floor(hp.xz / .5);
    c = mix(vec3(.5), vec3(.35), mod(tl.x + tl.y, 2.));
  }
  // 店員或客人的剪影
  float px = fract(hs*31.)*dim.x*.7 + dim.x*.15, pz = dim.z * (.35 + .4*fract(hs*11.));
  float tp = (pz - o.z) / max(vd.z, 1e-3);
  vec3 pp = o + vd * tp;
  float person = step(abs(pp.x - px), .2 - .08*step(1.45, pp.y)) * step(pp.y, 1.72) * step(tp, t) * step(.35, fract(hs*23.));
  c = mix(c, vec3(.03), person);
  return c * lc * mix(1.25, .7, hp.z / dim.z);
}
void main(){
  if (vW.y < uClipY) discard;
  vec3 n = normalize(vN);
  vec3 v = normalize(uCam - vW);
  float seed = vB.x, fw = vB.z, shop = vB.w;
  int st = int(vB.y + .5);
  float u = vUv.x, y = vW.y, H = vB2.z;
  vec3 c;
  if (n.y > .5) {                                  // 屋頂：瀝青、積水
    float f = fbm(vW.xz*.5);
    vec3 alb = vec3(.035,.035,.04) * (.7 + .6*f);
    float pud = smoothstep(.55, .65, fbm(vW.xz*.15 + seed));
    c = shade(vW, n, v, alb, mix(.85, .1, pud), 0.);
    c += envMap(reflect(-v, n)) * pud * .35;
    gl_FragColor = vec4(applyFog(c, vW), 1.); return;
  }
  if (st == 7) {                                   // 簷口、女兒牆、窗台線
    vec3 alb = L(mix(vec3(.42,.36,.3), vec3(.3,.28,.27), fract(seed*3.))) * (.8 + .3*fbm(vec2(u, y)*2.));
    c = shade(vW, n, v, alb, .8, 0.);
    gl_FragColor = vec4(applyFog(c, vW), 1.); return;
  }
  vec3 Tn = vec3(n.z, 0., -n.x);
  vec3 V = -v;
  vec3 vd = vec3(dot(V, Tn), V.y, dot(V, -n));
  float grime = fbm(vec2(u*.6, y*.08) + seed);
  // 牆面底色
  vec3 wall; float rough = .85;
  vec2 bid; float bm = brick(vec2(u, y), bid);
  float bv = h21(bid + seed);
  if (st == 0) wall = L(vec3(.5,.22,.15)) * mix(.75, 1.15, bv) * (.55 + .45*bm);
  else if (st == 1) wall = L(vec3(.42,.3,.22)) * mix(.75, 1.12, bv) * (.55 + .45*bm);
  else if (st == 2) { wall = L(vec3(.55,.52,.47)) * (.85 + .15*fbm(vec2(u,y)*3.)); float bl = fract(y/.6); wall *= .8 + .2*smoothstep(0.,.04,bl); }
  else if (st == 3) wall = L(vec3(.22,.24,.27));
  else if (st == 4) wall = L(mix(vec3(.36,.5,.5), vec3(.55,.4,.44), fract(seed*7.))) * (.85 + .15*fbm(vec2(u,y)*2.));
  else if (st == 5) wall = L(vec3(.12,.11,.12)) * (.6 + .4*bm);
  else wall = L(vec3(.45,.2,.14)) * mix(.8, 1.1, bv) * (.55 + .45*bm);
  wall *= 1. - .35*grime*smoothstep(H, 0., y*.6);
  wall *= mix(.6, 1., smoothstep(0., .9, y));       // 雨水打濕的牆腳
  float gH = 4.6;
  float fh = st == 3 ? 3.7 : st == 2 ? 3.4 : 3.1;
  float ws = st == 3 ? 1.6 : st == 2 ? 2.2 : 2.5;
  float nF = floor((H - gH - .7) / fh);
  float cols = max(1., floor((fw - 1.) / ws)); float mg = (fw - cols*ws) * .5;
  float cu = (u - mg) / ws; float ci = floor(cu);
  float fy = (y - gH) / fh; float fi = floor(fy);
  vec2 f = vec2(fract(cu), fract(fy));
  vec2 wmin = st == 3 ? vec2(.03,.06) : vec2(.27,.18), wmax = st == 3 ? vec2(.97,.96) : vec2(.73,.8);
  bool grid = ci >= 0. && ci < cols && fi >= 0. && fi < nF;
  bool inWin = grid && f.x > wmin.x && f.x < wmax.x && f.y > wmin.y && f.y < wmax.y;
  // 地面層
  if (y < gH) {
    if (shop > .5 && st != 5) {
      float units = max(vB2.y, 1.); float uw = fw / units;
      float ui = floor(u / uw); float ux = fract(u / uw);
      float shut = mod(floor(vB2.x / exp2(ui)), 2.);
      float hs = h21(vec2(ui, seed));
      if (st == 6) { shut = 0.; }
      if (ux < .045 || ux > .955 || y > 3.42) {
        vec3 alb = y > 3.42 ? L(vec3(.08,.08,.09)) : L(vec3(.3,.28,.26)) * (.8 + .3*fbm(vec2(u,y)*4.));
        if (st == 6) alb = L(vec3(.06,.16,.12));
        c = shade(vW, n, v, alb, .7, 0.);
      } else if (y < .42) {
        c = shade(vW, n, v, L(vec3(.13,.12,.12)), .4, 0.);
      } else if (shut > .5) {                        // 鐵捲門與塗鴉
        float rib = .55 + .45*smoothstep(-.6, .6, sin(y*42.));
        vec3 alb = L(vec3(.32,.34,.33)) * rib;
        float g = fbm(vec2(u*.9, y*1.4) + hs*20.);
        vec3 gc = .5 + .5*cos(6.28*(hs + vec3(0., .33, .67)) + g*3.);
        alb = mix(alb, L(gc) * .7, smoothstep(.55, .6, g) * step(y, 2.6));
        c = shade(vW, n, v, alb, .5, .3);
      } else {
        vec3 dim = vec3(uw*.91, 3., 5.2);
        vec3 o = vec3((ux - .045) / .91 * dim.x, y - .42, 0.);
        vec3 inside = st == 6 ? room(o, vd, dim, hs, vec3(1.1,.6,.28)*1.4, 0.) : shopRoom(o, vd, dim, hs);
        float door = step(.7, ux) * step(ux, .86);
        float frame = max(step(abs(ux - .7), .008), step(abs(ux - .86), .008)) * step(y, 2.6) + step(abs(y - 2.6), .03) * door;
        frame += step(abs(y - 2.95), .025);
        float F = .06 + .94*pow(1. - max(dot(n, v), 0.), 5.);
        c = inside * .62 * (1. - F*.6) + envMap(reflect(-v, n)) * F * .8;
        c += shade(vW, n, v, vec3(0.), .05, 0.) * .5;
        c = mix(c, shade(vW, n, v, L(vec3(.12)), .4, .6), clamp(frame, 0., 1.));
      }
    } else if (st == 5) {                            // 夜店外牆：黑磚
      c = shade(vW, n, v, wall * .7, .6, 0.);
    } else {                                         // 住宅入口
      float d = abs(u - fw*.5);
      if (d < .75 && y < 2.7) {
        vec3 dim = vec3(1.5, 2.7, 4.);
        vec3 inside = room(vec3(u - fw*.5 + .75, y, 0.), vd, dim, seed, vec3(1.,.8,.55), 0.);
        float fr = step(.7, d) + step(2.62, y);
        c = mix(inside * .9, shade(vW, n, v, L(vec3(.1,.08,.06)), .5, 0.), clamp(fr, 0., 1.));
      } else c = shade(vW, n, v, st == 3 ? L(vec3(.3,.31,.33)) : wall * .9, rough, 0.);
    }
    gl_FragColor = vec4(applyFog(c, vW), 1.); return;
  }
  // 樓層
  if (inWin) {
    vec2 wc = vec2(ci, fi);
    float hs = h21(wc + seed*vec2(1.37, 2.71));
    float hs2 = h21(wc*1.7 + seed);
    float litP = uLit * (st == 3 ? (step(.55, h21(vec2(fi, seed))) * .9 + .25) : st == 5 ? .2 : 1.);
    bool lit = hs < litP;
    vec3 lc = hs2 < .55 ? vec3(1.,.66,.36) : hs2 < .8 ? vec3(.8,.86,1.) : hs2 < .92 ? vec3(1.,.4,.65) : vec3(.4,.6,1.);
    if (st == 5) lc = vec3(.9,.2,.6) * (.6 + .4*sin(uBeat*6.283));
    if (hs2 >= .92) lc *= .6 + .4*fract(sin(floor(uTime*5. + hs*20.))*91.);
    lc = lit ? lc * 1.5 : mix(lc * .025, vec3(.42,.43,.45), uDay);   // 白天沒開燈的房間也看得到裡面
    vec3 dim = vec3(ws, fh, st == 3 ? 6. : 3.4);
    vec3 o = vec3(f.x*ws, f.y*fh, 0.);
    vec3 inside = room(o, vd, dim, hs, lc, st == 3 ? 1. : 0.);
    vec2 wf = (f - wmin) / (wmax - wmin);
    float cur = fract(hs*41.);
    if (lit && cur < .3) {                              // 窗簾
      float cov = step(wf.x, .28 + .1*sin(hs*9.)) + step(.72, wf.x);
      inside = mix(inside, lc * L(vec3(.6,.45,.35)) * (.6 + .2*sin(wf.x*60.)), clamp(cov, 0., 1.));
    } else if (lit && cur < .5) {                       // 百葉窗
      inside = mix(inside, lc * .5 * (.5 + .5*step(.35, fract(wf.y*14.))), .8);
    }
    float F = .05 + .95*pow(1. - max(dot(n, v), 0.), 5.);
    c = inside * (1. - F*.5) + envMap(reflect(-v, n)) * (F*.7 + .04);
    c += shade(vW, n, v, vec3(0.), .04, 0.) * .6;
    if (st == 3) { float mul = step(f.x, .035) + step(.965, f.x) + step(f.y, .07); c = mix(c, shade(vW, n, v, L(vec3(.2,.22,.25)), .4, .7), clamp(mul, 0., 1.)); }
    else {                                               // 窗框分隔
      float bar = step(abs(wf.y - .52), .018) + step(abs(wf.x - .5), .012);
      c = mix(c, shade(vW, n, v, L(vec3(.85,.82,.75))*.4, .6, 0.), clamp(bar, 0., 1.));
    }
  } else {
    vec3 alb = wall; float rr = rough;
    if (grid && st != 3) {
      float sill = step(abs(f.y - wmin.y + .03), .03) * step(wmin.x - .04, f.x) * step(f.x, wmax.x + .04);
      float lintel = step(abs(f.y - wmax.y - .035), .035) * step(wmin.x - .02, f.x) * step(f.x, wmax.x + .02);
      float frame = step(wmin.x - .025, f.x) * step(f.x, wmax.x + .025) * step(wmin.y - .02, f.y) * step(f.y, wmax.y + .02);
      alb = mix(alb, L(vec3(.15,.12,.1)), frame);
      alb = mix(alb, L(vec3(.62,.58,.5)) * (.8 + .2*grime), max(sill, lintel) * (st == 2 ? .5 : 1.));
      float streak = smoothstep(.0, .5, wmin.y - f.y) * step(wmin.x, f.x) * step(f.x, wmax.x) * fbm(vec2(u*8., y*.5));
      alb *= 1. - streak * .4;
    }
    if (st == 3) {                                        // 玻璃帷幕的樓板帶
      alb = L(vec3(.18,.2,.23));
      if (y > H - 1.6) { c = vec3(.2,.9,1.) * 1.6 * step(.5, fract(seed*3.)) + vec3(1.,.35,.6) * 1.6 * step(fract(seed*3.), .5); gl_FragColor = vec4(applyFog(c, vW), 1.); return; }
    }
    c = shade(vW, n, v, alb, rr, 0.);
    if (st == 4) {                                        // 翻新的霓虹樓：樓板 LED 線
      float band = step(abs(f.y - .02), .018) * step(0., fi) * step(fi, nF);
      vec3 bc = mix(vec3(.15,1.,.9), vec3(1.,.2,.6), step(.5, fract(seed*11.)));
      c += bc * band * 2.4 * (.7 + .3*sin(uTime*2. + u*.6));
    }
  }
  gl_FragColor = vec4(applyFog(c, vW), 1.);
}`;
const MAT_FACADE = new T.ShaderMaterial({ uniforms: shared(ALLU), vertexShader: FACADE_VS, fragmentShader: FACADE_FS });

// 每個街區一個網格，方便視錐剔除
const chunkBuf = new Map();
const buf = (key, zn) => { if (!chunkBuf.has(key)) chunkBuf.set(key, { p: [], n: [], uv: [], b: [], b2: [], idx: [], zn }); return chunkBuf.get(key); };
function quad(B, a, b, c, d, nrm, u0, u1, attrB, attrB2) {
  const base = B.p.length / 3;
  for (const [p, u] of [[a, u0], [b, u1], [c, u1], [d, u0]]) {
    B.p.push(p[0], p[1], p[2]); B.n.push(nrm[0], nrm[1], nrm[2]); B.uv.push(u, p[1]);
    B.b.push(...attrB); B.b2.push(...attrB2);
  }
  B.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}
// 盒子：四面＋頂，面朝外；u 從面向觀看者的左邊算起
function boxFaces(B, x0, x1, z0, z1, y0, y1, seed, style, shopFaces, h, masks, roof = true) {
  const faces = [
    { n: [0, 0, 1], a: [x0, y0, z1], b: [x1, y0, z1], w: x1 - x0, key: 'pz' },
    { n: [0, 0, -1], a: [x1, y0, z0], b: [x0, y0, z0], w: x1 - x0, key: 'nz' },
    { n: [1, 0, 0], a: [x1, y0, z1], b: [x1, y0, z0], w: z1 - z0, key: 'px' },
    { n: [-1, 0, 0], a: [x0, y0, z0], b: [x0, y0, z1], w: z1 - z0, key: 'nx' },
  ];
  for (const f of faces) {
    const shop = shopFaces && shopFaces[f.key] ? 1 : 0;
    const m = masks && masks[f.key] || [0, 1];
    quad(B, f.a, f.b, [f.b[0], y1, f.b[2]], [f.a[0], y1, f.a[2]], f.n, 0, f.w, [seed, style, f.w, shop], [m[0], m[1], h, 0]);
  }
  if (roof) quad(B, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], 0, x1 - x0, [seed, style, x1 - x0, 0], [0, 1, h, 0]);
}
const shopSigns = [];      // 之後由招牌模組使用：{x,z,nx,nz,w,unit}
const winSpots = [];       // 窗型冷氣、逃生梯
for (const L of lots) {
  if (L.glb || L.ghost === 2) continue;
  const R = L.rng || rnd;   // 北嶺公園門口切剩的地塊用自己的亂數；ghost 只抽 rnd、不蓋（見上面開門那段）
  const zn = L.zn;
  const key = L.b && !L.b.outer ? `${L.b.i},${L.b.j}` : `o${zn ? zn.id : '-'}:${Math.floor((L.x0 + 400) / 120)},${Math.floor((L.z0 + 400) / 120)}`;
  const shopF = {};
  const masks = {};
  // 面向街道的那一面有店面；排尾的地塊在大道那側也有
  if (!L.back) {
    const fkey = L.axis === 'z' ? (L.face > 0 ? 'pz' : 'nz') : (L.face > 0 ? 'px' : 'nx');
    shopF[fkey] = true;
    if (L.axis === 'z' && L.b && !L.b.outer) {
      if (Math.abs(L.x0 - (L.b.x0 + SW)) < .01) shopF.nx = true;
      if (Math.abs(L.x1 - (L.b.x1 - SW)) < .01) shopF.px = true;
    }
    for (const k in shopF) {
      const fw = k === 'pz' || k === 'nz' ? L.x1 - L.x0 : L.z1 - L.z0;
      const units = Math.max(1, Math.round(fw / 6.5));
      let mask = 0;
      for (let u = 0; u < units; u++) if ((R() < .28 && !L.special) || L.special === 'garage' || L.special === 'home') mask |= 1 << u;
      masks[k] = [mask, units];
      if (L.ghost) continue;
      const nrm = { pz: [0, 1], nz: [0, -1], px: [1, 0], nx: [-1, 0] }[k];
      for (let u = 0; u < units; u++) {
        const uw = fw / units, along = (u + .5) * uw;
        // 沿著「面向觀看者的左邊」算 u；和 boxFaces 的方向一致
        let x, z;
        if (k === 'pz') { x = L.x0 + along; z = L.z1; }
        else if (k === 'nz') { x = L.x1 - along; z = L.z0; }
        else if (k === 'px') { x = L.x1; z = L.z1 - along; }
        else { x = L.x0; z = L.z0 + along; }
        shopUnits.push({ x, z, nx: nrm[0], nz: nrm[1], w: uw, shut: (mask >> u) & 1, lot: L, special: L.special });
      }
    }
  }
  // 高樓退縮頂的亂數先抽（和以前一樣排在店面之後）
  const h2 = L.style === 3 && R() < .5 && L.h > 50 ? L.h + 8 + R() * 20 : 0;
  if (L.ghost) { if (L.style <= 2 && !L.back) winSpots.push(L); continue; }   // 20-props.js 的窗台設施也照原本的寬度抽亂數
  const B = buf(key, zn);
  boxFaces(B, L.x0, L.x1, L.z0, L.z1, 0, L.h, L.seed, L.style, shopF, L.h, masks);
  // 簷口與女兒牆（磚樓、石樓）
  if (L.style !== 3) {
    const o = .35, y = L.h;
    boxFaces(B, L.x0 - o, L.x1 + o, L.z0 - o, L.z1 + o, y - .55, y + .06, L.seed, 7, null, L.h, null);
    boxFaces(B, L.x0 - .18, L.x1 + .18, L.z0 - .18, L.z1 + .18, 4.45, 4.75, L.seed, 7, null, L.h, null);
  } else if (h2) {   // 高樓退縮頂
    const ix = (L.x1 - L.x0) * .18, iz = (L.z1 - L.z0) * .18;
    boxFaces(B, L.x0 + ix, L.x1 - ix, L.z0 + iz, L.z1 - iz, L.h, h2, L.seed + 1, 3, null, h2, null);
    L.h2 = h2;
  }
  if (L.style <= 2 && !L.back) winSpots.push(L);
}
for (let k = lots.length - 1; k >= 0; k--) if (lots[k].ghost) lots.splice(k, 1);   // ghost 只留在 winSpots 裡抽亂數
const cityChunks = [];
// 距離剔除：霧在 300 m 外已經看不到，城市放大到 20×15 之後，遠處的立面、實體建築與街道設施不畫（每幀依相機位置切換 visible）
const CULL_R = 420, cullList = [];
// 物件要先掛好（區的 Group 或 scene）：中心換成世界座標
const cullAdd = (obj, R = CULL_R) => {
  obj.geometry.computeBoundingSphere(); obj.updateWorldMatrix(true, false);
  const s = obj.geometry.boundingSphere, c = s.center.clone().applyMatrix4(obj.matrixWorld);
  const e = { obj, x: c.x, z: c.z, r: s.radius + R }; cullList.push(e); obj.userData.cull = e; return obj;   // userData.cull：會動的東西（21-coast.js 的貨櫃船）移動後用 cullSync 更新中心
};
function distCull(cx, cz) { for (const c of cullList) c.obj.visible = (c.x - cx) ** 2 + (c.z - cz) ** 2 < c.r * c.r; }
function chunkMesh(B) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(B.p, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(B.n, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(B.uv, 2));
  g.setAttribute('aB', new T.Float32BufferAttribute(B.b, 4));
  g.setAttribute('aB2', new T.Float32BufferAttribute(B.b2, 4));
  g.setIndex(B.idx);
  g.computeBoundingSphere();
  const m = new T.Mesh(g, MAT_FACADE); m.matrixAutoUpdate = false;
  cityAdd(m, B.zn === undefined ? zoneAtL(B.p[0], B.p[2]) : B.zn); cityChunks.push(m); cullAdd(m);
  return m;
}
for (const B of chunkBuf.values()) chunkMesh(B);
// 實體建築下載失敗：那幾塊地補回程式立面（沒有店面與招牌）
function lotFallback(list) {
  const B = { p: [], n: [], uv: [], b: [], b2: [], idx: [], zn: list.length ? list[0].zn : null };
  for (const L of list) { L.glb = null; boxFaces(B, L.x0, L.x1, L.z0, L.z1, 0, L.h, L.seed, L.style, null, L.h, null); }
  if (B.idx.length) chunkMesh(B);
}

// 遠方天際線：一圈更高的塔樓
{
  const B = buf('sky', ZONES[0]); const r2 = rng(77);
  // 圍著整座城（20×15）的橢圓，離外圍樓牆 120–380 m，只取北半圈
  const hx = (CITY_X1 - CITY_X0) / 2 + OUT_D, hz = (CITY_Z1 - CITY_Z0) / 2 + OUT_D;
  // 塔樓跟著 A 區擺；其他區轉過之後，碰到它的樓牆（含背後的高樓）或不在任何一區樓牆正後方（落到水上）的就不蓋
  const skyHit = (cx, cz, m) => {
    const [X, Z] = toW(cx, cz, ZONES[0]);
    let back = seamAt(X, Z);
    for (const zn of ZONES) {
      const [x, z] = toL(X, Z, zn), lx0 = Math.max(zn.x0, CITY_X0 - OUT_D), lx1 = Math.min(zn.x1, CITY_X1 + OUT_D);
      if (z >= zn.z1) continue;
      if (zn !== ZONES[0] && x > lx0 - m && x < lx1 + m && z > CITY_Z0 - OUT_D - m) return true;
      if (x > lx0 && x < lx1) back = true;
    }
    return !back;
  };
  for (let k = 0; k < 120; k++) {
    const a = k / 120 * Math.PI * 2 + r2() * .03, rr = 120 + r2() * 260;
    const cx = CITY_CX + Math.cos(a) * (hx + rr), cz = CITY_CZ + Math.sin(a) * (hz + rr);
    const w = 20 + r2() * 30, d = 20 + r2() * 30, h = 70 + r2() * 200;
    if (cz > CITY_Z0 - OUT_D) continue;   // 只留北面（其他三面是水，對岸另外做）
    const sd = r2() * 1000, st = r2() < .75 ? 3 : 2;
    if (skyHit(cx, cz, Math.max(w, d) / 2 + 8)) continue;
    if (cx + w / 2 > NPARK.x0 - 20 && cx - w / 2 < NPARK.x1 + 20 && cz - d / 2 < NPARK.z1) continue;   // 北嶺公園的山坡上不蓋
    boxFaces(B, cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, 0, h, sd, st, null, h, null);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(B.p, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(B.n, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(B.uv, 2));
  g.setAttribute('aB', new T.Float32BufferAttribute(B.b, 4));
  g.setAttribute('aB2', new T.Float32BufferAttribute(B.b2, 4));
  g.setIndex(B.idx); g.computeBoundingSphere();
  const m = new T.Mesh(g, MAT_FACADE); m.matrixAutoUpdate = false; cityAdd(m, B.zn);
}

// ─── 路面：一張大平面，標線、人孔、積水、雨滴漣漪與倒影都在 shader 裡 ───
const reflU = { tRefl: { value: null }, uReflMat: { value: new T.Matrix4() }, uReflOn: { value: 0 } };
// 地面網格的幾何是邏輯座標、網格本身不變換（掛在區的 Group 裡）：vL 是邏輯 xz，標線、路緣、磁磚都用它算；
// vAx 是邏輯 x 軸在世界的方向，用 nW() 把邏輯座標裡算出的法線擾動轉回世界
const GROUND_VS = /* glsl */`
uniform mat4 uReflMat;
varying vec3 vW, vN; varying vec4 vRP; varying vec2 vL, vAx;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  vL = position.xz; vAx = normalize((modelMatrix * vec4(1., 0., 0., 0.)).xz);
  vRP = uReflMat * w;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const GROUND_COMMON = /* glsl */`
${GL_LIB}
uniform sampler2D tRefl; uniform float uReflOn;
varying vec3 vW, vN; varying vec4 vRP; varying vec2 vL, vAx;
vec3 nW(vec3 n){ return vec3(n.x*vAx.x - n.z*vAx.y, n.y, n.x*vAx.y + n.z*vAx.x); }
vec2 ripple(vec2 p, float t){
  vec2 acc = vec2(0);
  for (int k=0; k<2; k++){
    vec2 q = p * 1.7 + float(k)*vec2(.37, .71);
    vec2 ci = floor(q), cf = fract(q) - .5;
    float hs = h21(ci + float(k)*13.);
    vec2 off = (vec2(h21(ci + 3.1), h21(ci + 7.7)) - .5) * .5;
    float tt = fract(t*1.2 + hs);
    vec2 d = cf - off; float r = length(d);
    float ring = exp(-pow((r - tt*.42)*28., 2.)) * (1. - tt) * step(hs, uRain);   // 沒下雨就沒有漣漪
    acc += d / max(r, 1e-3) * ring;
  }
  return acc;
}
vec3 reflSample(vec2 ruv, float blur){
  vec3 c = texture2D(tRefl, ruv).rgb * .3;
  c += texture2D(tRefl, ruv + vec2(blur*.15, blur)).rgb * .2;
  c += texture2D(tRefl, ruv - vec2(blur*.15, blur)).rgb * .2;
  c += texture2D(tRefl, ruv + vec2(0., blur*2.2)).rgb * .15;
  c += texture2D(tRefl, ruv - vec2(0., blur*2.2)).rgb * .15;
  return c;
}
vec3 wetSurface(vec3 base, vec3 n, float wet, float pud, float paint){
  vec3 v = normalize(uCam - vW);
  pud *= smoothstep(.05, .6, uWet); wet *= uWet;   // 雨停後積水慢慢乾掉
  float rough = mix(.75, .08, max(pud, wet*.6));
  vec3 c = shade(vW, n, v, base, rough, 0.);
  float F = .05 + .95*pow(1. - max(dot(n, v), 0.), 5.);
  float refl = mix(.3, 1., F) * mix(wet*.55, 1., pud) * (1. - paint*.4);
  vec3 rc;
  if (uReflOn > .5) {
    vec2 ruv = vRP.xy / vRP.w + n.xz * vec2(.05, .09) * (1. + 1.5*(1. - pud));
    float dist = length(vW - uCam);
    rc = reflSample(ruv, mix(.024, .003, pud) / (1. + dist*.01));
  } else rc = envMap(reflect(-v, n));
  return mix(c, rc, clamp(refl, 0., 1.) * uWet);
}
`;
const ROAD_FS = /* glsl */`
${GROUND_COMMON}
void main(){
  vec2 p = vL;
  float X0=uCity.x, Z0=uCity.y, P=uCity.z, Q=uCity.w;
  float ia = floor((p.x - X0)/P + .5); float dx = p.x - (X0 + ia*P);
  float js = floor((p.y - Z0)/Q + .5); float dz = p.y - (Z0 + js*Q);
  bool onA = abs(dx) < 8., onS = abs(dz) < 8.;
  bool inter = onA && onS;
  float n1 = fbm(p*.3), fine = h21(floor(p*37.));
  vec3 alb = vec3(.034,.036,.04) * (.7 + .6*n1) * (.88 + .24*fine);
  float patchv = step(.66, n2(p*.07 + 3.)); alb *= mix(1., .72, patchv);
  alb *= 1. + uDay * (1.6 - uWet);   // 乾的柏油在白天比夜裡的濕路面亮
  float seam = smoothstep(.04, .0, abs(fract(p.x*.031 + n2(p*.05)*.3) - .5)) * .3; alb *= 1. - seam;
  float paint = 0.; vec3 pc = vec3(.8);
  // 大道上的標線
  if (onA && !inter) {
    float ax = abs(dx);
    float yel = step(abs(ax - .2), .085) * step(.12, ax);
    if (yel > 0.) { paint = 1.; pc = vec3(.85,.6,.1); }
    paint = max(paint, step(abs(ax - 5.1), .07) * step(.42, fract(p.y*.25)));
    float cw = step(8.7, abs(dz)) * step(abs(dz), 12.2) * step(.45, fract(dx / 1.15)) * step(ax, 7.6);
    paint = max(paint, cw);
    float stop = step(12.4, abs(dz)) * step(abs(dz), 12.85) * step(.3, ax) * step(ax, 5.1) * step(0., dz*dx);
    paint = max(paint, stop);
    // 直行箭頭
    float aa = 19. - abs(dz), ll = ax - 3.;
    float arrow = step(abs(ll), .13) * step(-1.6, aa) * step(aa, .6) + step(.6, aa) * step(aa, 1.8) * step(abs(ll), (1.8 - aa) * .45);
    paint = max(paint, clamp(arrow, 0., 1.) * step(0., dz*dx));
  }
  if (onS && !inter) {
    float az = abs(dz);
    float yel = step(abs(az - .2), .085) * step(.12, az);
    if (yel > 0.) { paint = 1.; pc = vec3(.85,.6,.1); }
    paint = max(paint, step(abs(az - 5.1), .07) * step(.42, fract(p.x*.25)));
    float cw = step(8.7, abs(dx)) * step(abs(dx), 12.2) * step(.45, fract(dz / 1.15)) * step(az, 7.6);
    paint = max(paint, cw);
    float stop = step(12.4, abs(dx)) * step(abs(dx), 12.85) * step(.3, az) * step(az, 5.1) * step(0., -dz*dx);
    paint = max(paint, stop);
  }
  float wear = smoothstep(.35, .7, fbm(p*1.3 + 9.));
  alb = mix(alb, pc * .55 * (.75 + .25*fine), paint * (1. - wear*.6));
  // 人孔蓋
  float mh = 1.;
  {
    float d = onA ? length(vec2(abs(dx) - 3., mod(p.y - Z0, Q) - 31.)) : 99.;
    float d2 = onS ? length(vec2(mod(p.x - X0, P) - 36., abs(dz) - 3.)) : 99.;
    float md = min(d, d2);
    float disc = smoothstep(.45, .43, md);
    alb = mix(alb, vec3(.03,.028,.026) * (.8 + .4*step(.5, fract(md*12.))), disc);
    mh = 1. - disc * .6;
  }
  // 積水與排水溝
  float gut = onA && !inter ? smoothstep(6.6, 7.9, abs(dx)) : onS && !inter ? smoothstep(6.6, 7.9, abs(dz)) : 0.;
  float pud = smoothstep(.56, .66, fbm(p*.09 + 7.) + gut*.25 + (1. - n1)*.05);
  pud = max(pud, gut * .6);
  vec3 n = vec3(0., 1., 0.);
  float h0 = n2(p*4.), hx = n2(p*4. + vec2(.05, 0.)), hz = n2(p*4. + vec2(0., .05));
  n.xz -= vec2(hx - h0, hz - h0) * 1.6 * (1. - pud);
  float dist = length(vW - uCam);
  if (dist < 40.) n.xz += ripple(p, uTime) * .5 * (.3 + .7*pud) * (1. - dist/40.);
  n = normalize(nW(n));
  vec3 c = wetSurface(alb * mh, n, .8, pud, paint);
  gl_FragColor = vec4(applyFog(c, vW), 1.);
}`;
const WALK_FS = /* glsl */`
${GROUND_COMMON}
void main(){
  vec3 n = normalize(vN);
  vec2 p = vL;
  vec3 c;
  if (n.y < .5) {                                         // 路緣石側面
    vec3 alb = vec3(.16,.155,.15) * (.8 + .3*n2(p*3. + vW.y));
    c = shade(vW, n, normalize(uCam - vW), alb, .5, 0.);
  } else {
    vec2 tile = p / 1.5; vec2 tf = fract(tile); vec2 ti = floor(tile);
    float joint = smoothstep(.0, .025, tf.x) * smoothstep(1., .975, tf.x) * smoothstep(.0, .025, tf.y) * smoothstep(1., .975, tf.y);
    vec3 alb = vec3(.14,.135,.13) * (.8 + .35*h21(ti)) * (.85 + .3*fbm(p*.8)) * mix(.55, 1., joint);
    // 路緣石帶
    float X0=uCity.x, Z0=uCity.y, P=uCity.z, Q=uCity.w;
    float ia = floor((p.x - X0)/P + .5); float dx = abs(p.x - (X0 + ia*P));
    float js = floor((p.y - Z0)/Q + .5); float dz = abs(p.y - (Z0 + js*Q));
    float curb = max(step(dx, 8.35) * step(8., dx), step(dz, 8.35) * step(8., dz));
    alb = mix(alb, vec3(.2,.19,.18) * (.8 + .3*n2(p*6.)), curb);
    float stain = smoothstep(.5, .8, fbm(p*.25 + 3.));
    alb *= 1. - stain * .35;
    float pud = smoothstep(.62, .7, fbm(p*.2 + 11.) + (1. - joint)*.08) * (1. - curb);
    vec3 nn = vec3(0, 1, 0);
    float dist = length(vW - uCam);
    if (dist < 30.) nn.xz += ripple(p, uTime + 3.) * .35 * pud * (1. - dist/30.);
    nn.xz += (vec2(h21(ti), h21(ti + 4.)) - .5) * .04;
    c = wetSurface(alb, normalize(nW(nn)), .6, pud, 0.);
  }
  gl_FragColor = vec4(applyFog(c, vW), 1.);
}`;
// 燈籠公園的草地：濕草、兩條十字碎石小徑（沿街區中線）
const LAWN_FS = /* glsl */`
${GROUND_COMMON}
void main(){
  vec2 p = vL;
  float X0=uCity.x, Z0=uCity.y, P=uCity.z, Q=uCity.w;
  float n1 = fbm(p*.35), fine = n2(p*3.1);
  vec3 alb = vec3(.03,.055,.022) * (.65 + .7*n1) * (.8 + .4*fine);
  float px = abs(fract((p.x - X0)/P) - .5)*P, pz = abs(fract((p.y - Z0)/Q) - .5)*Q;
  float path = max(smoothstep(1.9, 1.6, px), smoothstep(1.9, 1.6, pz));
  alb = mix(alb, vec3(.12,.11,.095) * (.8 + .4*h21(floor(p*9.))), path);
  float pud = smoothstep(.6, .7, fbm(p*.12 + 5.)) * (.4 + .6*path);
  vec3 c = wetSurface(alb, vec3(0., 1., 0.), mix(.3, .6, path), pud, 0.);
  gl_FragColor = vec4(applyFog(c, vW), 1.);
}`;
const MAT_ROAD = new T.ShaderMaterial({ uniforms: { ...shared(ALLU), ...reflU }, vertexShader: GROUND_VS, fragmentShader: ROAD_FS });
const MAT_WALK = new T.ShaderMaterial({ uniforms: { ...shared(ALLU), ...reflU }, vertexShader: GROUND_VS, fragmentShader: WALK_FS });
// 地面網格（不進倒影，70-render.js）：幾何是邏輯座標，掛進所在的區
const groundMeshes = [];
const groundAdd = (m, zn) => { groundMeshes.push(m); return cityAdd(m, zn); };
// 邏輯矩形切成各區的部分（跨區的外圍步道板、碰撞框）：[{ zn, x0, x1, z0, z1 }]
function zoneClip(x0, x1, z0, z1) {
  const out = [];
  for (const zn of ZONES) {
    const a0 = Math.max(x0, zn.x0), a1 = Math.min(x1, zn.x1), b0 = Math.max(z0, zn.z0), b1 = Math.min(z1, zn.z1);
    if (a1 - a0 > 1e-3 && b1 - b0 > 1e-3) out.push({ zn, x0: a0, x1: a1, z0: b0, z1: b1 });
  }
  return out;
}
{
  // 路面只鋪到城市外緣（再外面是步道板、海與河，21-coast.js）；北面往樓牆後多鋪 600 m。每區一張，鋪到邊界路的外緣
  for (const zn of ZONES) {
    const x0 = zn.ni0 === 0 ? CITY_X0 - OUT_D : avX(zn.ni0) - HR, x1 = zn.ni1 === NX ? CITY_X1 + OUT_D : avX(zn.ni1) + HR;
    const z0 = zn.nj0 === 0 ? CITY_Z0 - 600 : stZ(zn.nj0) - HR, z1 = zn.nj1 === NZ ? SHORE_Z : stZ(zn.nj1) + HR;
    const g = new T.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    groundAdd(new T.Mesh(g, MAT_ROAD), zn);
  }
  // 人行道：每個街區一塊高 15 公分的板（建築就坐在上面）；每區合併成一個網格
  const parts = new Map();
  for (const b of blocks) for (const r of zoneClip(b.x0, b.x1, b.z0, b.z1)) {
    const bg = new T.BoxGeometry(r.x1 - r.x0, .15, r.z1 - r.z0);
    bg.translate((r.x0 + r.x1) / 2, .075, (r.z0 + r.z1) / 2);
    if (!parts.has(r.zn)) parts.set(r.zn, []);
    parts.get(r.zn).push(bg.toNonIndexed());
  }
  for (const [zn, list] of parts) {
    const pos = [], nor = [];
    for (const g2 of list) { pos.push(...g2.attributes.position.array); nor.push(...g2.attributes.normal.array); }
    const wg = new T.BufferGeometry();
    wg.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    wg.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    wg.computeBoundingSphere();
    groundAdd(new T.Mesh(wg, MAT_WALK), zn);
  }
  const lawnMat = new T.ShaderMaterial({ uniforms: { ...shared(ALLU), ...reflU }, vertexShader: GROUND_VS, fragmentShader: LAWN_FS }), lawns = new Map();
  for (const b of blocks.filter(b => b.park)) {
    const lg = new T.PlaneGeometry(b.x1 - b.x0 - 2 * SW, b.z1 - b.z0 - 2 * SW); lg.rotateX(-Math.PI / 2); lg.translate((b.x0 + b.x1) / 2, .152, (b.z0 + b.z1) / 2);
    const zn = zoneAtL((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
    if (!lawns.has(zn)) lawns.set(zn, []);
    lawns.get(zn).push(lg);
  }
  for (const [zn, list] of lawns) groundAdd(new T.Mesh(mergeGeometries(list), lawnMat), zn);
}
// ─── 區之間的縫（05-zones.js 的 SEAM）：草地與連接道路（06-roads.js 的 kind 'c'），幾何是世界座標、掛在 scene ───
// 草地往裡縮到邊界路外緣、比路面低一點；連接道路從路口範圍（HR）外面鋪起，蓋過邊界路那一小段。
// 連接道路的 shader 是路面那一套，vL = (橫向, 沿路的距離)，大道的標線（中央雙黃線、車道虛線、人孔）照畫，沒有路口
{
  const seamMat = new T.ShaderMaterial({ uniforms: { ...shared(ALLU), ...reflU }, vertexShader: GROUND_VS, fragmentShader: LAWN_FS.replace(/float path = max\([^;]*\);/, 'float path = 0.;'),
    side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 });
  const pos = [], nor = [];
  for (const P of [SEAM_IN, ...CAPES.map(h => h.pts)]) {   // 岬角的草地也在這裡（同一個材質）
    const tri = T.ShapeUtils.triangulateShape(P.map(([x, z]) => new T.Vector2(x, z)), []);
    for (const t of tri) for (const k of t) { pos.push(P[k][0], -.01, P[k][1]); nor.push(0, 1, 0); }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.computeBoundingSphere();
  groundAdd(new T.Mesh(g, seamMat), null);
  // 岬角沿水邊的碎石步道：草地 shader 的小徑顏色鋪滿，蓋在草地上
  const walkMat = new T.ShaderMaterial({ uniforms: { ...shared(ALLU), ...reflU }, vertexShader: GROUND_VS, fragmentShader: LAWN_FS.replace(/float path = max\([^;]*\);/, 'float path = 1.;'),
    side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const wp = [], wn = [];
  for (const h of CAPES) {
    const [A, B] = h.walk, n = h.pts.length;
    for (let k = 0; k < n; k++) {
      if (!h.wet[k]) continue;
      const k1 = (k + 1) % n;
      for (const v of [A[k], B[k], B[k1], A[k], B[k1], A[k1]]) { wp.push(v[0], .003, v[1]); wn.push(0, 1, 0); }
    }
  }
  const wg = new T.BufferGeometry();
  wg.setAttribute('position', new T.Float32BufferAttribute(wp, 3)); wg.setAttribute('normal', new T.Float32BufferAttribute(wn, 3)); wg.computeBoundingSphere();
  groundAdd(new T.Mesh(wg, walkMat), null);
  const vs = GROUND_VS.replace('uniform mat4 uReflMat;', 'uniform mat4 uReflMat;\nattribute vec2 aUV, aAx;').replace('vL = position.xz; vAx = normalize((modelMatrix * vec4(1., 0., 0., 0.)).xz);', 'vL = aUV; vAx = aAx;');
  const fs = ROAD_FS.replace(/float ia = [^\n]*\n\s*float js = [^\n]*\n\s*bool onA = [^\n]*\n/, 'float dx = p.x, dz = 40.;\n  bool onA = true, onS = false;\n');
  if (vs === GROUND_VS || fs === ROAD_FS) throw new Error('connector shader patch failed');
  const connMat = new T.ShaderMaterial({ uniforms: { ...shared(ALLU), ...reflU }, vertexShader: vs, fragmentShader: fs, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const P = [], N = [], UV = [], AX = [], I = [];
  for (const e of RN.edges) {
    if (e.kind !== 'c') continue;
    const u0 = HR - .4, u1 = e.len - HR + .4, n = Math.max(2, Math.ceil((u1 - u0) / 2.5)), base = P.length / 3;
    for (let k = 0; k <= n; k++) {
      const u = u0 + (u1 - u0) * k / n, [x, z] = edgeAt(e, u), [xa, za] = edgeAt(e, Math.max(0, u - 1.2)), [xb, zb] = edgeAt(e, Math.min(e.len, u + 1.2));
      const l = Math.hypot(xb - xa, zb - za) || 1, ax = (zb - za) / l, az = -(xb - xa) / l;   // 橫向：沿路方向轉成「邏輯 x 軸」那一側（和 nW() 的慣例一樣）
      for (const s of [-1, 1]) { P.push(x + ax * HR * s, .004, z + az * HR * s); N.push(0, 1, 0); UV.push(HR * s, u); AX.push(ax, az); }
      if (k) I.push(base + 2 * k - 2, base + 2 * k - 1, base + 2 * k + 1, base + 2 * k - 2, base + 2 * k + 1, base + 2 * k);
    }
  }
  const cg = new T.BufferGeometry();
  cg.setAttribute('position', new T.Float32BufferAttribute(P, 3)); cg.setAttribute('normal', new T.Float32BufferAttribute(N, 3));
  cg.setAttribute('aUV', new T.Float32BufferAttribute(UV, 2)); cg.setAttribute('aAx', new T.Float32BufferAttribute(AX, 2));
  cg.setIndex(I); cg.computeBoundingSphere();
  groundAdd(new T.Mesh(cg, connMat), null);
}
// 縫的兩端接到河與東灣（岸角之間那條邊）：擋牆照樣 4 m 厚，用斜放的座標框（low：不擋相機與子彈；21-coast.js 的欄杆不裝）。
// 外面接著岬角的那條不擋
for (let k = 0; k < SEAM.pts.length; k++) {
  if (SEAM.road[k]) continue;
  const p = SEAM.pts[k], q = SEAM.pts[(k + 1) % SEAM.pts.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]), f = frameW(p[0], p[1], q[0] - p[0], q[1] - p[1]);
  const out = inPoly(SEAM.pts, (p[0] + q[0]) / 2 + f.s * 2, (p[1] + q[1]) / 2 + f.c * 2) ? -1 : 1;   // 局部 +z（世界的 (s, c)）指向縫外就是 1
  if (capeAt((p[0] + q[0]) / 2 + f.s * 2 * out, (p[1] + q[1]) / 2 + f.c * 2 * out)) continue;
  colliders.push({ x0: -3, x1: L + 3, z0: out > 0 ? 0 : -4, z1: out > 0 ? 4 : 0, low: 1, zn: f });
}
// 岬角臨水的邊（21-coast.js 沿這些邊裝欄杆）；兩端各補一段順著岸的擋牆，蓋住岸邊擋牆每 2 m 取樣留下的空隙
for (const h of CAPES) {
  for (let k = 0; k < h.pts.length; k++) {
    if (!h.wet[k]) continue;
    const p = h.pts[k], q = h.pts[(k + 1) % h.pts.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]), f = frameW(p[0], p[1], q[0] - p[0], q[1] - p[1]);
    const out = inPoly(h.pts, (p[0] + q[0]) / 2 + f.s * .5, (p[1] + q[1]) / 2 + f.c * .5) ? -1 : 1;
    colliders.push({ x0: -.6, x1: L + .6, z0: out > 0 ? 0 : -4, z1: out > 0 ? 4 : 0, low: 1, zn: f });
  }
  for (const [p, zn, out] of h.caps) {   // 岸的 +z 方向當局部 x；局部 +z 是岸的西側（out −1 的那一邊）
    const [ux, uz] = dirW(zn, 0, 1), f = frameW(p[0], p[1], ux, uz);
    colliders.push({ x0: -2.5, x1: 2.5, z0: out < 0 ? 0 : -4, z1: out < 0 ? 4 : 0, low: 1, zn: f });
  }
}
// 地面高度（邏輯座標）：人行道高 0.15；查格子，不逐一比對街區。世界座標的 groundH 在下面
const groundHL = (x, z) => {
  if (x <= CITY_X0 || x >= CITY_X1 || z <= CITY_Z0 || z >= CITY_Z1) {
    if (z < NPARK.z1 && inParkMesh(x, z)) { const L = NPARK.look; return x >= L.x0 && x <= L.x1 && z >= L.z0 && z <= L.z1 ? L.h : parkH(x, z); }   // 北嶺公園的山坡與觀景台
    if (x > CITY_X0 - OUT_D && x < CITY_X1 + OUT_D && z > CITY_Z0 - OUT_D && z < SHORE_Z) return .15;   // 濱海步道、北面樓牆前
    for (const r of PIERS) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r.h;
    for (const r of FERRY) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r.h;
    for (const r of BANK_WALKS) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r.h;
    if (x >= BEACH.x0 && x <= BEACH.x1 && z > BEACH.z0) return -Math.min(1, (z - BEACH.z0) / BEACH.len) * BEACH.drop;   // 沙灘
    return 0;
  }
  const i = Math.floor((x - X0) / P), j = Math.floor((z - Z0) / Q);
  if (i < 0 || j < 0 || i >= NX || j >= NZ) return 0;
  return x > avX(i) + HR && x < avX(i + 1) - HR && z > stZ(j) + HR && z < stZ(j + 1) - HR ? .15 : 0;
};
// 執行時（玩家、車、行人、警察）用的是世界座標：先換回邏輯座標
const groundH = (X, Z) => { if (capeAt(X, Z) || !zoneAtW(X, Z) && seamAt(X, Z)) return 0; const [x, z] = toL(X, Z); return groundHL(x, z); };   // 縫裡是草地與連接道路，高度 0
const onRoad = (X, Z) => groundH(X, Z) === 0;
const districtW = (X, Z) => { const h = capeAt(X, Z); if (h) return h.name; const [x, z] = toL(X, Z); return district(x, z); };   // 岬角有自己的名字
// 水深（水面在 SEA_Y）：陸地矩形與沙灘外的淺水照 groundH，其他地方當成 8 m 深的海（世界座標）
const seaFloorL = (x, z) => inLand(x, z) || x >= BEACH.x0 && x <= BEACH.x1 && z > BEACH.z0 ? groundHL(x, z) : -8;
const seaFloor = (X, Z) => { if (capeAt(X, Z) || !zoneAtW(X, Z) && seamAt(X, Z)) return 0; const [x, z] = toL(X, Z); return seaFloorL(x, z); };
const waterDepth = (X, Z) => Math.max(0, SEA_Y - seaFloor(X, Z));

// ─── 碰撞的空間索引：室外的靜態盒與圓柱放進 24 m 的格子，查詢只看附近幾格（20×15 的城市有上萬個圓柱：路燈、停車、設施）。
// 陣列長度變了就重建；同一幀先刪後加、長度沒變的地方（搶車、打爛電訊箱、路障）要呼叫 colDirty()。室內的碰撞表很小，直接回傳整個陣列。
const COL_S = 24;
// 生成時碰撞表是邏輯座標；開場的 cityWorld()（99-main.js）一次換成世界座標：盒保留邏輯 AABB，f 是所屬的區（null 是世界座標），
// bx0…bz1 是世界座標的外接框（空間索引與粗篩用）；圓柱直接換成世界座標（w = 1）。之後執行時加進來的盒與圓柱都是世界座標
let cityIsWorld = false;
function boxToW(b, zn = zoneAtL((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2)) {
  b.f = zn;
  if (!zn) { b.bx0 = b.x0; b.bx1 = b.x1; b.bz0 = b.z0; b.bz1 = b.z1; return b; }
  const cs = rectW(b.x0, b.x1, b.z0, b.z1, zn);
  b.bx0 = Math.min(...cs.map(c => c[0])); b.bx1 = Math.max(...cs.map(c => c[0])); b.bz0 = Math.min(...cs.map(c => c[1])); b.bz1 = Math.max(...cs.map(c => c[1]));
  return b;
}
function circleToW(c, zn) { if (!c.w) { [c.x, c.z] = toW(c.x, c.z, zn); c.w = 1; } return c; }
// 生成之後才加的（27-props.js 下載好的模型）：還沒換成世界座標的話照樣先放邏輯座標
const worldHooks = [];   // 其他檔案在生成時登記的換算（光源表、錨點……），cityWorld() 依序呼叫
function cityWorld() {
  if (cityIsWorld) return;
  // 跨區的盒（北面樓牆那一整條）切成各區的部分
  for (let k = colliders.length - 1; k >= 0; k--) {
    const b = colliders[k];
    if (b.zn) { boxToW(b, b.zn); continue; }   // 指定了區的（補樓牆缺口那棟）
    const parts = zoneClip(b.x0, b.x1, b.z0, b.z1);
    if (parts.length > 1) colliders.splice(k, 1, ...parts.map(r => boxToW({ ...b, x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1 }, r.zn)));
    else boxToW(b, parts.length ? parts[0].zn : null);
  }
  for (const c of circles) circleToW(c);
  for (const f of worldHooks) f();
  cityIsWorld = true; colDirty();
}
const addBoxL = b => { colliders.push(cityIsWorld ? boxToW(b) : b); colDirty(); return b; };
const addCircleL = c => { circles.push(cityIsWorld ? circleToW(c) : c); colDirty(); return c; };
// 世界座標的點到盒的距離（粗篩）與點在盒的框裡的座標
const boxGap = (b, x, z) => Math.max((b.bx0 ?? b.x0) - x, x - (b.bx1 ?? b.x1), (b.bz0 ?? b.z0) - z, z - (b.bz1 ?? b.z1));
let colVer = 0;
const colDirty = () => { colVer++; };
// 跨很多格的（海岸、城外延伸到 1e5 的擋牆，轉了角度之後外接框兩個方向都很大）不進格子，放進 big，每次查詢都附上
const mkIndex = (arr, box) => ({ arr, box, n: -1, v: -1, cells: new Map(), big: [] });
const IDX_B = mkIndex(colliders, true), IDX_C = mkIndex(circles, false);
const cellKey = (c, d) => (c + 1024) * 4096 + d + 1024;
function idxBuild(I) {
  I.cells.clear(); I.big.length = 0; I.n = I.arr.length; I.v = colVer;
  for (const o of I.arr) {
    const x0 = I.box ? o.bx0 ?? o.x0 : o.x - o.r, x1 = I.box ? o.bx1 ?? o.x1 : o.x + o.r, z0 = I.box ? o.bz0 ?? o.z0 : o.z - o.r, z1 = I.box ? o.bz1 ?? o.z1 : o.z + o.r;
    if ((x1 - x0) * (z1 - z0) > 256 * COL_S * COL_S || x1 - x0 > 1000 * COL_S || z1 - z0 > 1000 * COL_S) { I.big.push(o); continue; }
    for (let c = Math.floor(x0 / COL_S); c <= Math.floor(x1 / COL_S); c++) for (let d = Math.floor(z0 / COL_S); d <= Math.floor(z1 / COL_S); d++) {
      const k = cellKey(c, d); let L = I.cells.get(k); if (!L) I.cells.set(k, L = []); L.push(o);
    }
  }
}
let _qStamp = 0;
function idxQuery(I, x0, z0, x1, z1, out) {
  if (I.n !== I.arr.length || I.v !== colVer) idxBuild(I);
  out.length = 0; const st = ++_qStamp;
  for (const o of I.big) { o._q = st; out.push(o); }
  for (let c = Math.floor(x0 / COL_S); c <= Math.floor(x1 / COL_S); c++) for (let d = Math.floor(z0 / COL_S); d <= Math.floor(z1 / COL_S); d++) {
    const L = I.cells.get(cellKey(c, d)); if (!L) continue;
    for (const o of L) if (o._q !== st) { o._q = st; out.push(o); }
  }
  return out;
}
const _qB = [], _qC = [];
// 圓心 (x, z)、半徑 r 附近的盒／圓柱；或傳 x1、z1 查一個矩形（射線的包圍盒）
const boxesNear = (x, z, r, x1, z1) => activeBoxes !== colliders ? activeBoxes : x1 === undefined ? idxQuery(IDX_B, x - r, z - r, x + r, z + r, _qB) : idxQuery(IDX_B, Math.min(x, x1) - r, Math.min(z, z1) - r, Math.max(x, x1) + r, Math.max(z, z1) + r, _qB);
const circlesNear = (x, z, r) => activeCircles !== circles ? activeCircles : idxQuery(IDX_C, x - r, z - r, x + r, z + r, _qC);
