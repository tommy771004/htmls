// 步槍：由零件設定（瞄具／槍管／彈匣）程序組出。第一人稱視角模型（含雙手、後座力、換彈、開鏡）與第三人稱簡模共用同一份零件。
import * as THREE from 'three';
import { textTexture } from './textures.js';
import { Geo, smooth, fillet, circle, latheGeo, tubeGeo } from './geo.js';

const PI = Math.PI;
const M = [0.028, 0.029, 0.032], M2 = [0.06, 0.062, 0.068], DK = [0.006, 0.006, 0.007], ST = [0.1, 0.105, 0.11], TAN = [0.1, 0.077, 0.052], PD = [0.02, 0.02, 0.022];
const BY = 0.045, Z0 = -0.135; // 槍膛軸高度、護木起點
let HQ = true; // 第一人稱的高模才導圓角、平滑法線、做小零件；第三人稱低模（rifleParts 的 low）全部關掉

// 輪廓擠出：pts = [[a, b, r?]…]，角落導圓（r 省略用預設值）、兩端邊緣是三段的圓倒角，法線依夾角平滑；hole 是挖掉的內輪廓（瞄具的窗）
function extr(pts, depth, b, r, hole, rh) {
  const path = (P, sh) => { P.forEach((q, i) => i ? sh.lineTo(q[0], q[1]) : sh.moveTo(q[0], q[1])); return sh; };
  const lowR = (P, r0) => P.map(q => [q[0], q[1], (q[2] ?? r0) >= 0.006 ? (q[2] ?? r0) : 0]); // 低模只留大的圓角
  const sh = path(r ? (HQ ? fillet(pts, r, 4) : fillet(lowR(pts, r), 0, 2)) : pts, new THREE.Shape()); if (hole) sh.holes.push(path(HQ && rh ? fillet(hole, rh, 4) : hole, new THREE.Path()));
  const g = new THREE.ExtrudeGeometry(sh, { depth: depth - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: HQ ? 3 : 1, curveSegments: 1 });
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 5, uv.getY(i) * 5);
  return smooth(g, 40);
}
// 側面輪廓（[z, y]…，槍口朝 -z）沿 x 擠出：機匣、握把、槍托、彈匣
function prof(G, pts, w, col, b = 0.004, x = 0, r = 0.004) {
  const g = extr(pts.map(q => [-q[0], q[1], q[2]]), w, b, r); g.translate(0, 0, -(w - 2 * b) / 2); g.rotateY(PI / 2);
  return G.add(g, x, 0, 0, col, { bev: 'x' });
}
// 橫截面（[x, y]…）沿槍身 z 擠出：上機匣、護木、瞄具外框
function xsec(G, pts, z0, z1, col, b = 0.003, r = 0, hole, rh = 0) { return G.add(extr(pts, z1 - z0, b, r, hole, rh), 0, 0, z0 + b, col, { bev: 'z' }); }
// 車削件（軸沿 z）：槍管、消音器、瞄準鏡、槍燈、緩衝管
function lat(G, pts, seg, x, y, col, o) { return G.add(latheGeo(pts, HQ ? seg : Math.min(seg, 10)), x, y, 0, col, { bev: 'z', ...o }); }
// 繞槍膛軸貼在表面上的長圓形凹槽（散熱孔、消焰器開槽）：ang 從 +x 起算
function slot(G, ang, zc, len, h, rad, th = 0.003, cy = BY, col = DK) {
  if (!HQ) return;
  const g = extr([[-len / 2, -h / 2], [len / 2, -h / 2], [len / 2, h / 2], [-len / 2, h / 2]], th, 0.0006, h * 0.49); g.translate(0, 0, -(th - 0.0012) / 2); g.rotateY(PI / 2); g.translate(rad, 0, zc);
  G.add(g, 0, cy, 0, col, { rz: ang });
}
// 皮卡汀尼導軌：底座＋一排燕尾截面的齒（低模只畫底座）
let TOOTH = null;
function rail(G, zc, len) {
  G.box(0.0212, 0.012, len, 0, 0.081, zc, M2, { r: HQ ? 0.0015 : 0 }); if (!HQ) { G.box(0.0212, 0.005, len, 0, 0.0895, zc, M2); return; }
  if (!TOOTH) TOOTH = extr([[-0.0082, 0], [-0.0106, 0.002], [-0.0106, 0.0038], [-0.0094, 0.005], [0.0094, 0.005], [0.0106, 0.0038], [0.0106, 0.002], [0.0082, 0]], 0.0054, 0.0005, 0);
  const n = Math.floor(len / 0.01); for (let i = 0; i < n; i++) G.add(TOOTH.clone(), 0, 0.087, zc + len / 2 - 0.0072 - i * 0.01, M2, { bev: 'z' });
}
const WM = { ao: 0.5, k: 0.2, col: [0.17, 0.17, 0.18] }, WP = { ao: 0.58, k: 0.22 }; // 金屬邊緣磨出亮鋼色；聚合物邊緣磨白

// 回傳各群組的幾何與幾個定位點。槍口朝 -z，原點在握把上緣。
export function rifleParts(lo, low = false) {
  HQ = !low;
  const B = { metal: new Geo(WM), poly: new Geo(WP) }, MAG = { metal: new Geo(WM), poly: new Geo(WP) }, BOLT = new Geo(WM), STOCK = new Geo(WP), glass = [], info = {}, Bm = B.metal;
  const HG = lo.barrel === 'sup' ? 0.24 : lo.barrel === 'long' ? 0.34 : 0.3, BL = lo.barrel === 'sup' ? 0.27 : lo.barrel === 'long' ? 0.47 : 0.37, mz = Z0 - BL, hz = Z0 - HG;
  const pinX = (r, hw, x, y, z, col) => Bm.add(latheGeo([[-hw, 0], [-hw, r * 0.8], [-hw + 0.0008, r], [hw - 0.0008, r], [hw, r * 0.8], [hw, 0]], 12), x, y, z, col, { ry: PI / 2, bev: 'z' });
  // ---- 上機匣（頂部兩側削角的鍛件截面）、下機匣（含彈匣井） ----
  xsec(Bm, [[-0.02, 0.018], [-0.023, 0.026], [-0.023, 0.054], [-0.0125, 0.073], [-0.0106, 0.076], [0.0106, 0.076], [0.0125, 0.073], [0.023, 0.054], [0.023, 0.026], [0.02, 0.018]], -0.135, 0.08, M, 0.004, 0.003);
  rail(Bm, -0.03, 0.21);
  prof(Bm, [[-0.123, 0.02], [-0.126, -0.078], [-0.121, -0.09, 0.003], [-0.05, -0.092, 0.003], [-0.046, -0.034, 0.008], [0.022, -0.032], [0.046, -0.022, 0.012], [0.08, -0.014], [0.082, 0.02]], 0.04, M, 0.004, 0, 0.004);
  if (HQ) {
    // 扳機護弓（一根彎管）、扳機、插銷、快慢機
    Bm.add(tubeGeo([[0, -0.06, -0.05, 0.0032], [0, -0.066, -0.03, 0.0031], [0, -0.068, 0, 0.003], [0, -0.066, 0.02, 0.003], [0, -0.058, 0.033, 0.0032], [0, -0.048, 0.039, 0.0034]], 8, { up: [1, 0, 0], w: 1.7 }), 0, 0, 0, M);
    Bm.add(tubeGeo([[0, -0.032, -0.014, 0.003], [0, -0.045, -0.0105, 0.0028], [0, -0.057, -0.0145, 0.0023]], 8, { up: [1, 0, 0], w: 1.4 }), 0, 0, 0, ST);
    for (const [y, z] of [[0.012, 0.064], [0.014, -0.104]]) { pinX(0.0045, 0.0222, 0, y, z, M2); pinX(0.0088, 0.0211, 0, y, z, M); }
    prof(Bm, [[-0.127, 0.0265], [-0.006, 0.0265], [0.004, 0.036, 0.006], [0.004, 0.051], [-0.127, 0.051]], 0.0032, M, 0.0012, -0.0232, 0.003);   // 上機匣左側的凸起面板
    prof(Bm, [[-0.119, -0.028], [-0.053, -0.028], [-0.053, -0.083], [-0.119, -0.083]], 0.0426, M, 0.0012, 0, 0.007);                                 // 彈匣井兩側的補強框
    prof(Bm, [[-0.03, 0.008], [0.07, 0.008], [0.07, -0.004], [0.04, -0.016, 0.01], [-0.03, -0.022]], 0.0418, M, 0.0009, 0, 0.004);                // 扳機組外側的階面
    pinX(0.0062, 0.002, -0.0218, -0.006, 0.03, M2); Bm.box(0.0032, 0.0052, 0.019, -0.0238, -0.004, 0.022, M2, { rx: 0.5, r: 0.0012 });
    // 右側：拋殼窗、防塵蓋與鉸鏈、彈殼導板、輔助推機柄、彈匣卡榫
    Bm.box(0.003, 0.022, 0.066, 0.0235, BY + 0.008, -0.04, DK, { r: 0.0014 }); Bm.box(0.003, 0.02, 0.062, 0.027, BY - 0.02, -0.04, M2, { rz: -0.45, r: 0.0013 });
    Bm.add(new THREE.CylinderGeometry(0.0017, 0.0017, 0.074, 8), 0.0245, BY - 0.0085, -0.04, M2, { rx: PI / 2 });
    prof(Bm, [[-0.004, 0.036], [0.012, 0.036], [0.012, 0.056, 0.006], [0.004, 0.056, 0.003]], 0.012, M2, 0.002, 0.026, 0.002);
    lat(Bm, [[0.036, 0.0042], [0.04, 0.006], [0.057, 0.006], [0.059, 0.0078], [0.0635, 0.0078], [0.065, 0.006], [0.065, 0]], 12, 0.027, BY + 0.004, M2);
    pinX(0.0048, 0.003, 0.0215, -0.01, -0.05, M2); Bm.box(0.003, 0.004, 0.026, 0.0212, -0.018, -0.05, M2, { r: 0.001 });
    // 左側（玩家看得到的那一面）：槍機釋放鈕、機匣刻線、彈匣井補強肋
    Bm.box(0.003, 0.02, 0.011, -0.0215, 0.014, -0.036, M2, { r: 0.0014 }); Bm.box(0.0045, 0.009, 0.017, -0.0222, 0.026, -0.036, M2, { r: 0.002 });
    Bm.box(0.002, 0.0025, 0.19, -0.0232, 0.046, -0.03, DK); Bm.box(0.002, 0.0025, 0.05, -0.0232, 0.03, 0.04, DK);
    for (const s of [-1, 1]) { Bm.box(0.003, 0.066, 0.005, s * 0.0205, -0.05, -0.122, M2, { r: 0.001 }); Bm.box(0.003, 0.004, 0.07, s * 0.0205, -0.084, -0.086, M2, { r: 0.001 }); }
  }
  // ---- 握把：背脊鼓起、前緣有指槽的弧線 ----
  prof(B.poly, [[0.024, -0.03], [0.066, -0.03], [0.075, -0.05, 0.012], [0.084, -0.09, 0.04], [0.105, -0.14, 0.008], [0.064, -0.151, 0.008], [0.052, -0.105, 0.04], [0.042, -0.072, 0.012], [0.03, -0.052, 0.006]], 0.032, TAN, HQ ? 0.011 : 0.008, 0, 0.004);
  // ---- 緩衝管與固定環、槍托 ----
  lat(Bm, [[0.078, 0], [0.078, 0.0185], [0.079, 0.0195], [0.089, 0.0195], [0.09, 0.0185], [0.0905, 0.015], [0.26, 0.015], [0.2635, 0.0138], [0.265, 0.011], [0.265, 0]], 24, 0, BY - 0.004, M);
  for (let k = 0; k < 6; k++) slot(Bm, k * PI / 3 + 0.3, 0.084, 0.008, 0.005, 0.0188, 0.002, BY - 0.004);
  // 槍托是「鑰匙孔」截面：上半是包住緩衝管的圓筒（前後各一圈凸環），下半是比較窄的板身。腰射時看得到的就是那段圓筒
  lat(STOCK, [[0.116, 0], [0.116, 0.0178], [0.1185, 0.0202], [0.131, 0.0202], [0.1335, 0.0186], [0.287, 0.0186], [0.2895, 0.0202], [0.314, 0.0202], [0.314, 0]], 24, 0, BY - 0.004, TAN);
  prof(STOCK, [[0.12, 0.05], [0.3, 0.05], [0.318, 0.046, 0.006], [0.318, -0.084, 0.006], [0.296, -0.09], [0.262, -0.04, 0.03], [0.228, -0.004, 0.02], [0.12, 0.014]], 0.031, TAN, 0.009, 0, 0.006);
  STOCK.box(0.044, 0.14, 0.02, 0, BY - 0.062, 0.327, PD, { r: HQ ? 0.0095 : 0.008 });
  if (HQ) {
    for (let k = 0; k < 6; k++) STOCK.box(0.034, 0.003, 0.002, 0, BY - 0.112 + k * 0.02, 0.3372, [0.008, 0.008, 0.009], { r: 0.0009 });
    prof(STOCK, [[0.128, 0.013], [0.2, 0.002], [0.2, -0.006], [0.14, 0.001]], 0.012, PD, 0.003, 0, 0.003);
    prof(STOCK, [[0.28, -0.022], [0.302, -0.022], [0.302, -0.032], [0.28, -0.032]], 0.0318, DK, 0.0006, 0, 0.0048);
    for (const a of [PI / 2 - 0.95, PI / 2 + 0.95]) slot(STOCK, a, 0.21, 0.12, 0.0052, 0.0182, 0.002, BY - 0.004);            // 圓筒兩側的長凹槽
    for (const s of [-1, 1]) pinX(0.0052, 0.0012, s * 0.0162, 0.012, 0.3, DK);                                              // 背帶扣座
  }
  // ---- 護木（圓角八角截面，頂面墊高接導軌）、散熱孔、槍管座環 ----
  { const a = 0.0268, c = 0.0111; xsec(Bm, [[c, 0.031], [a, c], [a, -c], [c, -a], [-c, -a], [-a, -c], [-a, c], [-c, 0.031]].map(p => [p[0], p[1] + BY]), hz, Z0, M, 0.003, 0.007); }
  rail(Bm, Z0 - HG / 2 - 0.004, HG - 0.012);
  for (let k = 0; k < Math.floor(HG / 0.066); k++) for (const ang of [0, PI, -PI / 4, -PI * 3 / 4, -PI / 2]) slot(Bm, ang, Z0 - 0.04 - k * 0.066, 0.042, 0.0105, 0.0256, 0.003);
  lat(Bm, [[Z0 - 0.012, 0.027], [Z0 - 0.0105, 0.0312], [Z0 + 0.001, 0.0312], [Z0 + 0.0025, 0.027]], 20, 0, BY, M2);
  // ---- 槍管與槍口裝置 ----
  lat(Bm, [[mz - 0.002, 0.0082], [mz + 0.03, 0.0082], [mz + 0.034, 0.0092], [hz + 0.03, 0.0095]], 14, 0, BY, ST);
  if (lo.barrel === 'std') { // 鳥籠式消焰器
    lat(Bm, [[mz - 0.047, 0.0048], [mz - 0.047, 0.0108], [mz - 0.044, 0.0126], [mz - 0.014, 0.0126], [mz - 0.011, 0.0108], [mz + 0.002, 0.0108], [mz + 0.004, 0.009]], 14, 0, BY, M2);
    lat(Bm, [[mz - 0.045, 0], [mz - 0.045, 0.005]], 10, 0, BY, DK); for (let k = 0; k < 5; k++) slot(Bm, PI / 2 + (k - 2) * 1.05, mz - 0.03, 0.02, 0.0042, 0.0118, 0.002);
    info.muzzleZ = mz - 0.045;
  } else if (lo.barrel === 'long') { // 加厚槍管＋制退器
    lat(Bm, [[mz, 0.0105], [mz + 0.1, 0.0105], [mz + 0.104, 0.0095]], 14, 0, BY, ST);
    lat(Bm, [[mz - 0.06, 0.0048], [mz - 0.06, 0.0115], [mz - 0.056, 0.0145], [mz - 0.006, 0.0145], [mz - 0.002, 0.0115], [mz + 0.004, 0.0105], [mz + 0.006, 0.009]], 16, 0, BY, M2);
    lat(Bm, [[mz - 0.058, 0], [mz - 0.058, 0.005]], 10, 0, BY, DK);
    for (const a of [0, PI]) for (const dz of [-0.045, -0.031, -0.017]) slot(Bm, a, mz + dz, 0.009, 0.014, 0.0136, 0.0022);
    for (const a of [PI / 2 - 0.55, PI / 2 + 0.55]) slot(Bm, a, mz - 0.031, 0.03, 0.003, 0.0136, 0.002);
    info.muzzleZ = mz - 0.058;
  } else { // 消音器：筒身、三道加強環、後段收窄
    const e = mz - 0.182;
    lat(Bm, [[e, 0.0052], [e, 0.0188], [e + 0.003, 0.0218], [e + 0.014, 0.0218], [e + 0.016, 0.0206], [e + 0.066, 0.0206], [e + 0.068, 0.0218], [e + 0.078, 0.0218], [e + 0.08, 0.0206], [e + 0.126, 0.0206], [e + 0.128, 0.0218], [e + 0.138, 0.0218], [e + 0.14, 0.0206],
      [e + 0.176, 0.0206], [e + 0.178, 0.0222], [e + 0.192, 0.0222], [e + 0.194, 0.0205], [e + 0.202, 0.0125], [e + 0.206, 0.0125]], 20, 0, BY, [0.04, 0.04, 0.043]);
    lat(Bm, [[e + 0.002, 0], [e + 0.002, 0.0056]], 10, 0, BY, DK); for (let k = 0; k < 10; k++) slot(Bm, k * PI / 5, e + 0.185, 0.011, 0.0034, 0.0212, 0.0024);
    info.muzzleZ = mz - 0.182;
  }
  // ---- 槍燈 ----
  const lz = hz + 0.07;
  lat(Bm, [[lz - 0.0375, 0.0118], [lz - 0.0375, 0.0152], [lz - 0.03, 0.0158], [lz - 0.016, 0.0158], [lz - 0.01, 0.0128], [lz + 0.02, 0.0128], [lz + 0.022, 0.0138], [lz + 0.034, 0.0138], [lz + 0.0375, 0.011], [lz + 0.0375, 0]], 14, -0.045, BY, M);
  Bm.box(0.016, 0.014, 0.03, -0.034, BY, lz + 0.01, M, { r: HQ ? 0.003 : 0 }); info.light = new THREE.Vector3(-0.045, BY, lz - 0.04);
  // ---- 拉柄 ----
  BOLT.box(0.036, 0.01, 0.018, 0, BY + 0.027, 0.086, M2, { r: HQ ? 0.003 : 0 }); BOLT.box(0.012, 0.01, 0.05, 0, BY + 0.027, 0.062, M2, { r: HQ ? 0.002 : 0 });
  if (HQ) BOLT.box(0.011, 0.007, 0.013, -0.0165, BY + 0.027, 0.079, M, { r: 0.002 });
  // ---- 彈匣 ----
  if (lo.mag === 'drum') {
    MAG.poly.box(0.026, 0.075, 0.058, 0, -0.112, -0.089, PD, { r: HQ ? 0.004 : 0.003 });
    MAG.metal.add(latheGeo([[-0.034, 0], [-0.034, 0.03], [-0.031, 0.034], [-0.031, 0.066], [-0.027, 0.076], [-0.02, 0.078], [-0.015, 0.073], [0.015, 0.073], [0.02, 0.078], [0.027, 0.076], [0.031, 0.066], [0.031, 0.034], [0.034, 0.03], [0.034, 0]], HQ ? 28 : 12), 0, -0.205, -0.092, M2, { ry: PI / 2, bev: 'z' });
    if (HQ) for (const s of [-1, 1]) {
      for (let k = 0; k < 6; k++) { const a = k * PI / 3 + 0.2; MAG.metal.box(0.003, 0.007, 0.028, s * 0.0315, -0.205 - Math.sin(a) * 0.05, -0.092 + Math.cos(a) * 0.05, M, { rx: a, r: 0.0014 }); }
      MAG.metal.add(latheGeo([[0, 0.013], [0.004, 0.013], [0.0052, 0.011], [0.0052, 0]], 14), s * 0.034, -0.205, -0.092, ST, { ry: s * PI / 2, bev: 'z' }); MAG.metal.box(0.003, 0.006, 0.022, s * 0.0395, -0.205, -0.092, ST, { r: 0.0014, rx: 0.5 });
    }
  } else { // 彎曲的彈匣：前後緣是連續的弧線
    const L = lo.mag === 'ext' ? 0.225 : 0.155, zc = d => -0.089 - 0.03 * d - 0.75 * d * d, n = HQ ? 7 : 3, f = [], bk = [];
    for (let i = 0; i <= n; i++) { const t = i / n, d = L * t, c = i === n ? 0.006 : i ? 0 : 0.002; bk.push([zc(d) + 0.031, -0.07 - d - 0.004 * t, c]); f.push([zc(d) - 0.031, -0.07 - d + 0.012 * t * t, c]); }
    prof(MAG.poly, [...bk, ...f.reverse()], 0.026, TAN, 0.004, 0, 0.004);
    for (let k = 0; k < (L > 0.2 ? 5 : 3); k++) { const d = 0.035 + k * 0.034; MAG.poly.box(0.0275, 0.0045, 0.05, 0, -0.07 - d, zc(d), [0.12, 0.09, 0.055], { rx: 0.03 + 1.5 * d, r: HQ ? 0.0016 : 0 }); }
    MAG.poly.box(0.031, 0.012, 0.07, 0, -0.07 - L - 0.001, zc(L), PD, { rx: 0.25, r: HQ ? 0.004 : 0 });
  }
  // ---- 瞄具 ----
  if (lo.optic === 'iron') { // 後：鬼環照門；前：帶護圈的準星
    const fz = hz + 0.03, sy = 0.1235;
    Bm.box(0.026, 0.012, 0.03, 0, 0.098, 0.05, M, { r: HQ ? 0.003 : 0 }); Bm.box(0.02, 0.012, 0.026, 0, 0.097, fz, M, { r: HQ ? 0.003 : 0 });
    xsec(Bm, [[-0.006, 0.102], [0.006, 0.102], ...circle(0, sy, 0.0098, HQ ? 20 : 8, -0.9, PI + 0.9)], 0.048, 0.052, M, 0.0008, 0, circle(0, sy, 0.0066, HQ ? 18 : 8));
    xsec(Bm, [[-0.008, 0.1], [0.008, 0.1], ...circle(0, sy, 0.0128, HQ ? 22 : 8, -1, PI + 1)], fz - 0.004, fz + 0.004, M, 0.0008, 0, circle(0, sy, 0.0106, HQ ? 20 : 8));
    Bm.box(0.0026, 0.0125, 0.0026, 0, sy - 0.00575, fz, M2);
    info.sightY = sy; info.eye = 0.2;
  } else if (lo.optic === 'reflex') { // 開放式紅點：圓角外框
    prof(Bm, [[-0.026, 0.092], [0.026, 0.092], [0.026, 0.099], [0.021, 0.104], [-0.021, 0.104], [-0.026, 0.099]], 0.03, M, 0.003, 0, 0.002);
    prof(Bm, [[0.003, 0.102], [0.029, 0.102], [0.029, 0.111, 0.003], [0.022, 0.1185, 0.004], [0.007, 0.1185, 0.004], [0.003, 0.113, 0.003]], 0.028, M, 0.005, 0, 0.002);
    xsec(Bm, [[-0.018, 0.1035, 0.002], [0.018, 0.1035, 0.002], [0.018, 0.1445, 0.009], [-0.018, 0.1445, 0.009]], -0.024, -0.012, M, 0.0008, 0.002, [[-0.015, 0.106, 0.001], [0.015, 0.106, 0.001], [0.015, 0.14, 0.006], [-0.015, 0.14, 0.006]], 0.001);
    if (HQ) { pinX(0.004, 0.0018, 0.0148, 0.109, 0.016, M2); Bm.add(new THREE.CylinderGeometry(0.0042, 0.0042, 0.003, 12), 0, 0.118, 0.016, M2); }
    glass.push({ w: 0.03, h: 0.034, x: 0, y: 0.123, z: -0.018 }); info.ret = { type: 'dot', y: 0.123, z: -0.0185, s: 0.0012 }; info.sightY = 0.123; info.eye = 0.23;
  } else if (lo.optic === 'holo') { // 全像：圓角護罩
    prof(Bm, [[-0.039, 0.092], [0.039, 0.092], [0.039, 0.1], [0.034, 0.106], [-0.034, 0.106], [-0.039, 0.1]], 0.036, M, 0.003, 0, 0.002);
    prof(Bm, [[0.027, 0.104], [0.052, 0.104], [0.052, 0.114, 0.003], [0.046, 0.123, 0.004], [0.031, 0.123, 0.004], [0.027, 0.117, 0.003]], 0.03, M, 0.005, 0, 0.002);
    xsec(Bm, [[-0.022, 0.104, 0.002], [0.022, 0.104, 0.002], [0.022, 0.1535, 0.007], [-0.022, 0.1535, 0.007]], -0.036, 0.024, M, 0.001, 0.002, [[-0.018, 0.108, 0.001], [0.018, 0.108, 0.001], [0.018, 0.148, 0.004], [-0.018, 0.148, 0.004]], 0.001);
    if (HQ) { pinX(0.0075, 0.006, 0.022, 0.1, -0.022, M2); for (const s of [-1, 1]) Bm.box(0.008, 0.005, 0.003, s * 0.007, 0.114, 0.0515, M2, { r: 0.0012 }); }
    glass.push({ w: 0.036, h: 0.04, x: 0, y: 0.128, z: -0.03 }); info.ret = { type: 'ring', y: 0.128, z: -0.0305, s: 0.0062 }; info.sightY = 0.128; info.eye = 0.24;
  } else { // 4× 鏡：車削鏡身、鏡環、調整鈕
    const sy = 0.133;
    for (const z of [-0.075, 0.035]) xsec(Bm, [[-0.014, 0.093, 0.002], [0.014, 0.093, 0.002], [0.014, 0.114, 0.002], ...circle(0, sy, 0.0198, HQ ? 18 : 8, -0.75, PI + 0.75), [-0.014, 0.114, 0.002]], z - 0.008, z + 0.008, M2, 0.0015, 0.002);
    lat(Bm, [[-0.182, 0.021], [-0.182, 0.0245], [-0.176, 0.0252], [-0.14, 0.0235], [-0.118, 0.0165], [-0.112, 0.0155], [-0.045, 0.0155], [-0.042, 0.019], [0.002, 0.019], [0.005, 0.0155], [0.072, 0.0155], [0.08, 0.0185], [0.098, 0.0215], [0.116, 0.0215], [0.118, 0.0235], [0.132, 0.0235], [0.134, 0.0215], [0.134, 0.017]], 20, 0, sy, M);
    const knob = (h, r) => latheGeo([[0, r * 0.9], [h * 0.5, r * 0.9], [h * 0.55, r], [h * 0.95, r], [h, r * 0.86], [h, 0]], HQ ? 14 : 8);
    Bm.add(knob(0.022, 0.012), 0, sy + 0.016, -0.02, M2, { rx: -PI / 2, bev: 'z' }); Bm.add(knob(0.02, 0.012), 0.016, sy, -0.02, M2, { ry: PI / 2, bev: 'z' }); if (HQ) Bm.add(knob(0.014, 0.01), -0.016, sy, -0.02, M2, { ry: -PI / 2, bev: 'z' });
    glass.push({ r: 0.0205, x: 0, y: sy, z: -0.18, tint: [0.25, 0.5, 0.35] }, { r: 0.0165, x: 0, y: sy, z: 0.129, tint: [0.2, 0.3, 0.3] }); info.sightY = sy; info.eye = 0.2;
  }
  info.eject = new THREE.Vector3(0.03, BY + 0.008, -0.04); info.magPivot = new THREE.Vector3(0, -0.08, -0.088); info.hg = HG;
  return { B, MAG, BOLT, STOCK, glass, info };
}
// 第三人稱：整把槍併成一個幾何
const LOW = new Map(); // 依配件組合快取（最多 36 種），所有角色共用、不釋放：開場一次建 10 把會卡一下
export function rifleLow(lo) {
  const key = lo.optic + '|' + lo.barrel + '|' + lo.mag; let r = LOW.get(key); if (r) return r;
  const p = rifleParts(lo, true), G = new Geo();
  for (const g of [p.B.metal, p.B.poly, p.MAG.metal, p.MAG.poly, p.BOLT, p.STOCK]) for (const q of g.list) G.list.push(q);
  r = { geo: G.build(), info: p.info }; LOW.set(key, r); return r;
}

function handGeo(R, sleeve, side) { // 握住沿 z 軸、半徑 R 的圓柱；掌心在下，四指從 +x*side 側包上來
  const G = new Geo(), gl = [0.022, 0.022, 0.024], kn = [0.05, 0.05, 0.055];
  const pt = (a, rr, z) => [side * Math.cos(a) * rr, Math.sin(a) * rr, z];
  // 手掌：壓扁的橢球墊在握的東西下面，掌根再一顆
  G.sph(0.05, 0, -R - 0.019, 0.002, gl, { sx: 0.92, sy: 0.4, sz: 1.08, ws: 16, hs: 10 }); G.sph(0.03, side * -0.012, -R - 0.024, 0.04, gl, { sx: 1.1, sy: 0.6 });
  // 四指：每根是一條沿著握把彎過去的管，指節稍粗、指尖收細；食指與小指短一點
  const FA = [-1.05, -0.55, -0.1, 0.35, 0.8, 1.25, 1.85], FR = [0.0112, 0.0116, 0.0124, 0.0108, 0.0113, 0.0098, 0.0086];
  for (let i = 0; i < 4; i++) {
    const z = -0.037 + i * 0.0245, k = i === 0 ? 0.92 : i === 3 ? 0.86 : 1, end = i === 0 ? 1.7 : i === 3 ? 1.55 : 1.85;
    G.add(tubeGeo(FA.map((a, j) => [...pt(j === 6 ? end : a, R + 0.0108 * k + (j === 2 ? 0.0016 : 0), z + (j - 2) * 0.0007 * (i - 1.5)), FR[j] * k]), 8, { sub: 3 }), 0, 0, 0, gl);
  }
  // 指節護片：橫過四個指節的一條扁墊
  G.add(tubeGeo([[...pt(0.12, R + 0.0235, -0.046), 0.0075], [...pt(0.12, R + 0.0245, -0.014), 0.009], [...pt(0.12, R + 0.0245, 0.018), 0.009], [...pt(0.12, R + 0.0235, 0.046), 0.0075]], 8, { sub: 2, up: [side, 0.12, 0], w: 0.55, e: 1.5 }), 0, 0, 0, kn);
  // 拇指：從掌根繞到另一側
  G.add(tubeGeo([[...pt(PI + 1.2, R + 0.012, 0.026), 0.0138], [...pt(PI + 0.72, R + 0.0128, 0.033), 0.0132], [...pt(PI + 0.2, R + 0.0122, 0.038), 0.012], [...pt(PI - 0.38, R + 0.0115, 0.04), 0.0098]], 8, { sub: 3 }), 0, 0, 0, gl);
  // 前臂：往鏡頭外；袖口與幾道皺褶
  const dir = new THREE.Vector3(side * -0.28, -0.42, 0.86).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir), e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
  const w = new THREE.Vector3(side * -0.012, -R - 0.03, 0.05), at = (g, d, c) => G.add(g, w.x + dir.x * d, w.y + dir.y * d, w.z + dir.z * d, c, { rx: e.x, ry: e.y, rz: e.z });
  const sl = new THREE.CylinderGeometry(0.053, 0.039, 0.44, 24, 30, true), SP = sl.attributes.position, SU = sl.attributes.uv; // 袖子：錐管上壓幾道不規則的皺褶
  for (let i = 0; i < SP.count; i++) { const x = SP.getX(i), y = SP.getY(i), z = SP.getZ(i), a = Math.atan2(z, x), k = 1 + 0.075 * Math.sin(y * 52 + Math.sin(a * 2 + 1) * 1.8) * (0.5 + 0.5 * Math.sin(a + y * 9)) + 0.04 * Math.sin(a * 3 + y * 15) + 0.02 * Math.sin(y * 118 + a * 2); SP.setXYZ(i, x * k, y, z * k); SU.setXY(i, SU.getX(i) * 3, SU.getY(i) * 4); }
  sl.computeVertexNormals(); at(sl, 0.26, [sleeve[0] * 0.6, sleeve[1] * 0.6, sleeve[2] * 0.6]);
  at(new THREE.CylinderGeometry(0.043, 0.04, 0.05, 16), 0.045, gl); at(new THREE.CylinderGeometry(0.0445, 0.0445, 0.014, 16), 0.062, kn); // 手套腕口與束帶
  return G.build();
}
const kf = (p, keys) => { if (p <= keys[0][0]) return keys[0][1]; for (let i = 1; i < keys.length; i++) if (p <= keys[i][0]) { const t = (p - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]), s = t * t * (3 - 2 * t); return keys[i - 1][1] + (keys[i][1] - keys[i - 1][1]) * s; } return keys[keys.length - 1][1]; };

export class ViewModel {
  constructor(Tx, sleeveCol) {
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(52, 1, 0.01, 8);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); this.key = new THREE.DirectionalLight(0xffffff, 1); this.key.position.set(0.4, 1, 0.5);
    this.flashLight = new THREE.PointLight(0xffb060, 0, 1.2, 2); this.scene.add(this.hemi, this.key, this.flashLight);
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.matMetal = new THREE.MeshStandardMaterial({ vertexColors: true, color: new THREE.Color(2.3, 2.3, 2.45), metalness: 0.78, roughness: 1, roughnessMap: Tx.gunMetal.roughnessMap, normalMap: Tx.gunMetal.normalMap, normalScale: new THREE.Vector2(0.45, 0.45) });
    this.matPoly = new THREE.MeshStandardMaterial({ vertexColors: true, color: new THREE.Color(0.78, 0.78, 0.78), metalness: 0, roughness: 1, roughnessMap: Tx.gunPoly.roughnessMap, normalMap: Tx.gunPoly.normalMap, normalScale: new THREE.Vector2(0.5, 0.5) });
    this.matCloth = new THREE.MeshStandardMaterial({ vertexColors: true, color: new THREE.Color(0.7, 0.7, 0.7), metalness: 0, roughness: 0.9, map: Tx.cloth.map, normalMap: Tx.cloth.normalMap, normalScale: new THREE.Vector2(1.7, 1.7) });
    this.matGlass = new THREE.MeshStandardMaterial({ color: 0x223028, metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
    this.matRet = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.2, 0.4, 0.2), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.matFlash = new THREE.MeshBasicMaterial({ map: Tx.flash, color: new THREE.Color(3.2, 2.4, 1.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.matLamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.4, 4.2) });
    Tx.gunPoly.normalMap.repeat.set(4, 4); Tx.gunPoly.roughnessMap.repeat.set(4, 4); // 止滑紋要細（約 1.5 mm 一顆）
    // 機匣左側的刻字（廠名、口徑、序號）：一張透明小貼片，受光、不發亮
    this.matMark = new THREE.MeshStandardMaterial({ map: textTexture('SOLACE ARMS   CAL 5.56   LC-0283', { w: 512, h: 40, size: 24, font: '"DIN Condensed", "Arial Narrow", "Helvetica Neue", sans-serif', weight: 700, color: '#aeb2b8', spacing: '3px' }), transparent: true, opacity: 0.55, depthWrite: false, roughness: 0.5, metalness: 0.3, polygonOffset: true, polygonOffsetFactor: -2 });
    this.gun = new THREE.Group(); this.root.add(this.gun);
    this.handL = new THREE.Mesh(handGeo(0.031, sleeveCol, 1), this.matCloth); this.handR = new THREE.Mesh(handGeo(0.02, sleeveCol, -1), this.matCloth);
    this.root.add(this.handL, this.handR);
    this.flash = new THREE.Group(); for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), this.matFlash); m.rotation.y = i === 2 ? 0 : PI / 2; m.rotation.z = i * PI / 2; if (i === 2) m.scale.setScalar(0.8); this.flash.add(m); } this.flash.visible = false;
    this.k = { z: 0, vz: 0, r: 0, vr: 0, y: 0, vy: 0, ro: 0, vro: 0 }; this.sway = new THREE.Vector2(); this.bob = 0; this.flashT = 0; this.land = 0; this.inspect = 0; this.spin = 0.6; this.scopeMix = 0; this.torch = true;
    this.pos = new THREE.Vector3(); this.rot = new THREE.Euler(); this.fovK = 1; // 直式螢幕把垂直視野放大，槍才不會塞滿畫面
  }
  setLoadout(lo) {
    for (const c of [...this.gun.children]) { this.gun.remove(c); if (c.geometry) c.geometry.dispose(); }
    const p = rifleParts(lo); this.info = p.info; this.lo = { ...lo };
    const add = (G, mat, parent) => { if (G.empty) return null; const m = new THREE.Mesh(G.build(), mat); parent.add(m); return m; };
    add(p.B.metal, this.matMetal, this.gun); add(p.B.poly, this.matPoly, this.gun);
    this.mag = new THREE.Group(); this.gun.add(this.mag); add(p.MAG.metal, this.matMetal, this.mag); add(p.MAG.poly, this.matPoly, this.mag);
    this.bolt = add(p.BOLT, this.matMetal, this.gun); this.stock = add(p.STOCK, this.matPoly, this.gun);
    const mk = new THREE.Mesh(new THREE.PlaneGeometry(0.115, 0.009), this.matMark); mk.position.set(-0.02487, 0.0385, -0.06); mk.rotation.y = -PI / 2; this.gun.add(mk);
    for (const g of p.glass) { const m = new THREE.Mesh(g.r ? new THREE.CircleGeometry(g.r, 20) : new THREE.PlaneGeometry(g.w, g.h), g.tint ? Object.assign(this.matGlass.clone(), { color: new THREE.Color(g.tint[0], g.tint[1], g.tint[2]), opacity: 0.75 }) : this.matGlass); m.position.set(g.x, g.y, g.z); this.gun.add(m); }
    if (p.info.ret) { const r = p.info.ret, grp = new THREE.Group(); grp.position.set(0, r.y, r.z);
      if (r.type === 'dot') grp.add(new THREE.Mesh(new THREE.CircleGeometry(r.s, 12), this.matRet));
      else { grp.add(new THREE.Mesh(new THREE.RingGeometry(r.s * 0.86, r.s, 28), this.matRet), new THREE.Mesh(new THREE.CircleGeometry(r.s * 0.13, 10), this.matRet)); for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.PlaneGeometry(r.s * 0.1, r.s * 0.3), this.matRet); t.position.set(Math.sin(i * PI / 2) * r.s * 1.1, Math.cos(i * PI / 2) * r.s * 1.1, 0); t.rotation.z = -i * PI / 2; grp.add(t); } }
      grp.renderOrder = 5; this.gun.add(grp); this.ret = grp; } else this.ret = null;
    this.lamp = new THREE.Mesh(new THREE.CircleGeometry(0.0115, 12), this.matLamp); this.lamp.position.copy(p.info.light); this.lamp.rotation.y = PI; this.gun.add(this.lamp);
    this.flash.position.set(0, BY, p.info.muzzleZ - 0.06); this.gun.add(this.flash);
    this.handL.position.set(0, BY, Z0 - Math.min(0.2, p.info.hg * 0.62)); this.handLBase = this.handL.position.clone();
  }
  kick(rec, ads) { const k = this.k, a = 1 - ads * 0.55; k.vz += 1.5 * rec * a; k.vr += 2.4 * rec * a; k.vy += (Math.random() - 0.5) * 1.4 * rec * a; k.vro += (Math.random() - 0.5) * 2.4 * rec; if (this.info && this.lo.barrel !== 'sup') { this.flashT = 0.055; this.flash.rotation.z = Math.random() * 6.28; this.flash.scale.setScalar((1.15 + Math.random() * 0.8) * (this.lo.barrel === 'long' ? 1.25 : 1)); } }
  setProbe(c, flashOn) {
    const l = Math.max(0.04, c.r * 0.3 + c.g * 0.55 + c.b * 0.15);
    this.hemi.color.copy(c).multiplyScalar(3.4); this.hemi.groundColor.copy(c).multiplyScalar(1.2); this.key.color.copy(c).multiplyScalar(2.6); this.scene.environmentIntensity = Math.min(1.7, l * 2.6 + 0.45);
    if (flashOn) { this.hemi.color.addScalar(0.16); this.key.color.addScalar(0.12); }
  }
  // s：{ ads, sprint, crouch, speed, reload(0..1 或 -1), stepAcc, ground, dx, dy（滑鼠位移）, gunsmith }
  update(dt, s) {
    const k = this.k, I = this.info; if (!I) return;
    // 後座力彈簧
    for (const [x, v, st, dm] of [['z', 'vz', 260, 24], ['r', 'vr', 230, 22], ['y', 'vy', 200, 20], ['ro', 'vro', 200, 18]]) { k[v] += (-st * k[x] - dm * k[v]) * dt; k[x] += k[v] * dt; }
    this.sway.x += (-s.dx * 0.00028 - this.sway.x) * Math.min(1, dt * 9); this.sway.y += (s.dy * 0.00028 - this.sway.y) * Math.min(1, dt * 9);
    this.sway.x = Math.max(-0.03, Math.min(0.03, this.sway.x)); this.sway.y = Math.max(-0.03, Math.min(0.03, this.sway.y));
    const mv = Math.min(1, s.speed / 4.3) * (s.ground ? 1 : 0); this.bob += dt * (4.6 + s.speed * 1.5) * (mv > 0.05 ? 1 : 0);
    this.land += (0 - this.land) * Math.min(1, dt * 8);
    const a = s.ads, sp = s.sprint * (1 - a), bobA = mv * (1 - a * 0.85) * (1 + sp * 1.4);
    const ins = this.inspect += ((s.gunsmith ? 1 : 0) - this.inspect) * Math.min(1, dt * 7);
    // 位置：腰射 ↔ 開鏡 ↔ 衝刺
    const hx = 0.096, hy = -0.126, hz = -0.36;
    let px = hx + (0 - hx) * a, py = hy + (-I.sightY - hy) * a, pz = hz + (-I.eye - hz) * a, rx = 0, ry = 0.035 * (1 - a), rz = -0.03 * (1 - a);
    px += sp * -0.035; py += sp * -0.05; pz += sp * 0.05; ry += sp * 0.72; rx += sp * -0.2; rz += sp * 0.24;
    py -= s.crouch * 0.012 * (1 - a); rz += s.crouch * 0.05 * (1 - a);
    px += Math.sin(this.bob) * 0.0055 * bobA + this.sway.x; py += -Math.abs(Math.cos(this.bob)) * 0.006 * bobA + this.sway.y - this.land * 0.03; rz += Math.sin(this.bob) * 0.012 * bobA - this.sway.x * 1.4; ry += this.sway.x * 0.8; rx += this.sway.y * 0.8;
    // 換彈
    let magY = 0, magA = 0, boltZ = 0, lhx = 0, lhy = 0, lhz = 0, lhShow = 1;
    if (s.reload >= 0) {
      const p = s.reload, tilt = kf(p, [[0, 0], [0.1, 1], [0.78, 1], [0.92, 0.3], [1, 0]]);
      rz += -0.5 * tilt; rx += 0.24 * tilt; px += -0.02 * tilt; py += -0.03 * tilt + kf(p, [[0.46, 0], [0.5, 0.012], [0.56, 0]]);
      magY = kf(p, [[0.1, 0], [0.24, -0.34], [0.3, -0.34], [0.5, 0]]); magA = kf(p, [[0.1, 0], [0.24, 0.5], [0.3, -0.25], [0.5, 0]]);
      boltZ = kf(p, [[0.7, 0], [0.8, 0.04], [0.84, 0]]);
      const toMag = kf(p, [[0.02, 0], [0.12, 1], [0.52, 1], [0.64, 0]]), toBolt = kf(p, [[0.6, 0], [0.72, 1], [0.84, 1], [0.96, 0]]);
      lhx = 0; lhy = toMag * (-0.2 + magY * 0.9) + toBolt * 0.05; lhz = toMag * (this.handLBase.z * -1 - 0.09) + toBolt * (this.handLBase.z * -1 + 0.06); lhShow = 1;
    }
    this.mag.position.set(0, magY, magY * 0.12); this.mag.rotation.x = magA * 0.5; this.mag.visible = magY > -0.33;
    if (this.bolt) this.bolt.position.z = boltZ + Math.max(0, k.z) * 0.6;
    this.handL.position.set(this.handLBase.x + lhx, this.handLBase.y + lhy, this.handLBase.z + lhz); this.handL.visible = lhShow > 0 && ins < 0.5;
    this.handR.position.set(0.004, -0.085, 0.05); this.handR.rotation.set(-1.25, 0, 0.0); this.handR.visible = ins < 0.5;
    // 後座力
    pz += k.z; rx += k.r * 0.06; ry += k.y * 0.03; rz += k.ro * 0.03; py += k.r * 0.004;
    // 槍匠檢視：槍橫在畫面中央慢慢轉
    if (ins > 0.001) { this.spin += dt * 0.25; const t = ins; px += ((s.gx ?? 0.02) - px) * t; py += ((s.gy ?? -0.035) - py) * t; pz += ((s.gz ?? -0.62) - pz) * t; rx += (0.1 - rx) * t; ry += (PI / 2 + Math.sin(this.spin) * 0.5 - ry) * t; rz += (0 - rz) * t; }
    this.root.position.set(px, py, pz); this.root.rotation.set(rx, ry, rz, 'YXZ');
    this.root.children.forEach(c => { if (c === this.handL || c === this.handR) return; });
    // 手跟著槍一起動（handL / handR 是 root 的子物件，gun 也是）
    this.flashT -= dt; this.flash.visible = this.flashT > 0; this.flashLight.intensity = this.flashT > 0 ? 1.6 : 0; this.flashLight.position.set(px, py + BY, pz + I.muzzleZ);
    this.lamp.visible = this.torch;
    if (this.ret) this.ret.visible = ins < 0.5;
    // 4× 鏡：開鏡後改用全螢幕遮罩
    const sc = this.lo.optic === 'scope' ? Math.max(0, (a - 0.8) / 0.2) : 0; this.scopeMix = sc; this.root.visible = sc < 0.95;
    const fv = 52 - a * 12; this.camera.fov = this.fovK > 1 ? 2 * Math.atan(Math.tan(fv * PI / 360) * this.fovK) * 180 / PI : fv; this.camera.updateProjectionMatrix();
  }
  // 視角模型空間的點 → 世界座標（兩台相機 FOV 不同，x / y 依比例換算）
  toWorld(local, mainCam, out) {
    out.copy(local); this.gun.localToWorld(out); // vm 場景裡的「世界」＝相機空間
    const k = Math.tan(mainCam.fov * PI / 360) / Math.tan(this.camera.fov * PI / 360); out.x *= k; out.y *= k;
    return out.applyMatrix4(mainCam.matrixWorld);
  }
}
