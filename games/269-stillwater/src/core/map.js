// 河道地圖（不碰 DOM／three）：由南（木屋碼頭，z ≈ +40）往北（瀑布潭，z ≈ −720）的一條河。
// 中心線是 Catmull-Rom 曲線，每 1 m 一個樣本；地形高度、水深、水流、生態區、檢查點與釣點都由它推出。
// 水面 y = 0；height(x, z) < 0 的地方是水。座標：three 的 x、z（公尺），北方是 −Z。
import { fbm, vnoise, mulberry } from './rng.js';

// [x, z, 半寬 w, 最大水深 D, 水流 m/s, 岸坡, 岸高上限, 丘陵起伏]
const CTRL = [
  [0, 34, 25, 2.4, 0.03, 0.06, 1.6, 7],     // 0 碼頭南岸的靜水灣
  [-6, -14, 33, 2.9, 0.03, 0.07, 1.6, 7],   // 1 灣心
  [2, -74, 27, 2.2, 0.05, 0.08, 1.5, 6],    // 2 淺灘蘆葦灣
  [18, -128, 15, 2.6, 0.18, 0.12, 1.6, 6],  // 3 收窄入河
  [34, -165, 14, 2.8, 0.32, 0.14, 1.7, 6],  // 4 蜿蜒中游
  [14, -202, 14, 3.0, 0.34, 0.14, 1.8, 6],  // 5 石拱橋
  [-22, -234, 15, 3.0, 0.32, 0.15, 2.0, 7], // 6
  [-26, -270, 14, 2.9, 0.28, 0.2, 2.6, 9],  // 7
  [-4, -306, 16, 3.4, 0.22, 0.28, 3.4, 12], // 8 松林
  [22, -346, 19, 3.9, 0.16, 0.3, 3.6, 13],  // 9 沉木灣
  [10, -392, 15, 3.4, 0.22, 0.3, 3.6, 13],  // 10
  [-14, -430, 12, 3.0, 0.4, 0.7, 6, 13],    // 11
  [-18, -464, 10, 2.5, 1.0, 2.0, 15, 6],    // 12 峽谷急流口
  [-2, -500, 9, 2.3, 1.15, 2.3, 17, 5],     // 13
  [12, -540, 10.5, 2.7, 1.05, 2.3, 17, 5],  // 14 峽谷河灣
  [4, -580, 11, 2.8, 0.9, 2.0, 16, 5],      // 15
  [-4, -616, 22, 3.8, 0.25, 1.0, 12, 6],    // 16 瀑布潭入口
  [0, -656, 33, 5.6, 0.12, 0.9, 13, 6],     // 17 潭心
  [2, -694, 27, 5.0, 0.14, 1.6, 18, 4],     // 18 瀑布下
];
export const BOUNDS = { x0: -180, x1: 180, z0: -800, z1: 110 };
export const FALLS = { x: 2, z: -722, top: 17, width: 13 };

// ---------- 中心線取樣 ----------
const cr = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
function sampleAt(u) {   // u：控制點的小數索引
  const n = CTRL.length, i = Math.max(0, Math.min(n - 2, Math.floor(u))), t = u - i;
  const P = (k) => CTRL[Math.max(0, Math.min(n - 1, k))];
  const out = [];
  for (let c = 0; c < 8; c++) {
    if (c < 2) out.push(cr(P(i - 1)[c], P(i)[c], P(i + 1)[c], P(i + 2)[c], t));
    else { const s = t * t * (3 - 2 * t); out.push(P(i)[c] + (P(i + 1)[c] - P(i)[c]) * s); }
  }
  return out;
}
// 依弧長每 1 m 取一個樣本
const S = { x: [], z: [], w: [], D: [], cur: [], slope: [], cap: [], hill: [], tx: [], tz: [], u: [], s: [] };
{
  const dense = [];
  for (let u = 0; u <= CTRL.length - 1 + 1e-9; u += 0.002) dense.push([u, ...sampleAt(u)]);
  let acc = 0, next = 0;
  for (let k = 0; k < dense.length; k++) {
    if (k) acc += Math.hypot(dense[k][1] - dense[k - 1][1], dense[k][2] - dense[k - 1][2]);
    if (acc >= next || k === dense.length - 1) {
      const d = dense[k];
      S.u.push(d[0]); S.x.push(d[1]); S.z.push(d[2]); S.w.push(d[3]); S.D.push(d[4]); S.cur.push(d[5]);
      S.slope.push(d[6]); S.cap.push(d[7]); S.hill.push(d[8]); S.s.push(acc);
      next += 1;
    }
  }
  for (let i = 0; i < S.x.length; i++) {
    const a = Math.max(0, i - 2), b = Math.min(S.x.length - 1, i + 2);
    const dx = S.x[b] - S.x[a], dz = S.z[b] - S.z[a], l = Math.hypot(dx, dz) || 1;
    S.tx.push(dx / l); S.tz.push(dz / l);   // 切線指向上游（北）
  }
}
export const SAMPLES = S;
export const N = S.x.length;

// 最近的中心線樣本（中心線的 z 大致單調遞減，先二分搜尋 z 再往兩邊找）
export function nearest(x, z) {
  let lo = 0, hi = N - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S.z[m] > z) lo = m; else hi = m; }
  let best = lo, bd = Infinity;
  const a = Math.max(0, lo - 90), b = Math.min(N - 1, lo + 90);
  for (let i = a; i <= b; i += 3) { const d = (S.x[i] - x) ** 2 + (S.z[i] - z) ** 2; if (d < bd) { bd = d; best = i; } }
  for (let i = Math.max(0, best - 3); i <= Math.min(N - 1, best + 3); i++) { const d = (S.x[i] - x) ** 2 + (S.z[i] - z) ** 2; if (d < bd) { bd = d; best = i; } }
  const i = best;
  // 側向：+ 在切線左邊（往上游看的左手邊 = 西側）
  const side = (x - S.x[i]) * -S.tz[i] + (z - S.z[i]) * S.tx[i];
  return { i, d: Math.sqrt(bd), side, w: S.w[i], D: S.D[i] };
}
// 由「控制點小數索引＋側向偏移（以半寬為單位）」求世界座標
export function along(u, off = 0) {
  let i = 0;
  while (i < N - 1 && S.u[i] < u) i++;
  const w = S.w[i];
  return { x: S.x[i] + -S.tz[i] * off * w, z: S.z[i] + S.tx[i] * off * w, i, yaw: Math.atan2(S.tx[i], S.tz[i]) };
}
export function zoneAt(x, z) {
  const u = S.u[nearest(x, z).i];
  return u < 2.9 ? 1 : u < 7.75 ? 2 : u < 11.6 ? 3 : u < 15.6 ? 4 : 5;
}

// ---------- 淺灘、巨石與地形 ----------
// 淺灘蘆葦灣西側的濕地：水深上限
const SHALLOWS = [
  { x: -24, z: -70, r: 16, depth: 0.55 }, { x: -18, z: -98, r: 12, depth: 0.7 }, { x: -30, z: -40, r: 10, depth: 0.5 },
  { x: 26, z: -40, r: 9, depth: 0.8 },
];
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function height(x, z) {
  const n = nearest(x, z), i = n.i;
  const w = S.w[i], D = S.D[i];
  // 越過中心線兩端（碼頭南邊、瀑布北邊）就是岸
  let d = n.d;
  const u = d / w;
  let h;
  if (u < 1) {
    h = -D * Math.pow(1 - u * u, 0.62) + (fbm(x * 0.21, z * 0.21, 2) - 0.5) * 0.35;
    if (u > 0.82) h = Math.max(h, -0.25 - (1 - u) * 2.2);
  } else {
    const e = d - w;
    const slope = S.slope[i], cap = S.cap[i], hill = S.hill[i];
    const bank = Math.min(cap, e * slope * (1 + vnoise(x * 0.08, z * 0.08) * 0.8));
    const far = smooth(8, 70, e) * hill * fbm(x * 0.012 + 3, z * 0.012, 4);
    h = 0.1 + bank + far + (fbm(x * 0.15, z * 0.15, 2) - 0.5) * 0.4 * Math.min(1, e / 3);
    if (slope > 1.5) h += smooth(2, 9, e) * (fbm(x * 0.05, z * 0.09, 3) - 0.3) * 6;   // 峽谷崖壁的層次
  }
  for (const s of SHALLOWS) {
    const k = 1 - Math.hypot(x - s.x, z - s.z) / s.r;
    if (k > 0 && h < -s.depth) h += (-s.depth - h) * smooth(0, 0.6, k);
  }
  // 瀑布北側的崖壁與頂上的溪口
  const fz = FALLS.z - z;
  if (fz > -10) {
    const k = smooth(-10, 4, fz);
    let cliff = FALLS.top + 1.5 + (fbm(x * 0.07, z * 0.07, 3) - 0.5) * 5;
    const lip = Math.abs(x - FALLS.x) < FALLS.width / 2 + 1 ? smooth(FALLS.width / 2 + 1, FALLS.width / 2 - 2, Math.abs(x - FALLS.x)) : 0;
    if (fz > 0) cliff -= lip * (cliff - FALLS.top + 0.4);
    h = h + (Math.max(h, cliff) - h) * k;
  }
  for (const b of BOULDERS) {
    const q = Math.hypot(x - b.x, z - b.z) / (b.r * 1.15);
    if (q < 1) h = Math.max(h, -0.1 + (1 - q * q) * (b.h + 0.1));
  }
  return h;
}

// 水流（往下游 = 往南），中央最快
export function current(x, z) {
  const n = nearest(x, z), i = n.i;
  const u = Math.min(1, n.d / S.w[i]);
  const k = S.cur[i] * (1 - u * u * 0.85);
  return [-S.tx[i] * k, -S.tz[i] * k];
}

// ---------- 據點 ----------
export const DOCK = { x: 9, z: 59, yaw: 0, len: 14 };            // 原點在岸邊端，往 −Z 延伸
export const CABIN = { x: 17, z: 69, yaw: Math.PI };            // 門朝 −Z（河）
export const BERTH = { x: 2.9, z: 47.5 };                         // 碼頭停泊點（返航落點）
export const BRIDGE_U = 5.05;

// 6 座水道燈樁（第 0 座是木屋碼頭，一開始就亮）
const CP_DEF = [
  ['dock', '木屋碼頭', 'Cabin Dock', null],
  ['reed', '淺灘蘆葦灣', 'Reed Shallows', [2.1, -0.62]],
  ['bridge', '中游石拱橋', 'Stone Arch Bridge', [4.9, 0.66]],
  ['pine', '松林沉木灣', 'Sunken-Log Bay', [9.1, -0.68]],
  ['gorge', '峽谷急流口', 'Gorge Rapids Mouth', [12.15, 0.6]],
  ['falls', '上游瀑布潭', 'Waterfall Pool', [16.6, -0.66]],
];
export const CHECKPOINTS = CP_DEF.map(([id, zh, en, at], k) => {
  if (!at) return { k, id, zh, en, x: BERTH.x + 2.6, z: BERTH.z - 1.5, zone: 1, berth: { ...BERTH } };
  const p = along(at[0], at[1]), q = along(at[0] - 0.04, at[1] * 0.78);
  return { k, id, zh, en, x: p.x, z: p.z, zone: zoneAt(p.x, p.z), berth: { x: q.x, z: q.z } };
});

// 15 個釣點：每區 3 個，其中一個是魚王出沒的深水釣點（legend）；roam 的釣點會依時段換位置
const SPOT_DEF = [
  // [名稱, 區, 位置（小數索引, 側偏）, 釣點加成 0～15, 類型, 依時段輪替的位置]
  ['蘆葦邊', 1, [2.05, 0.3], 4, 'shallow', [[2.05, 0.3], [1.7, 0.5], [2.4, -0.1]]],
  ['灣心', 1, [1.0, 0.15], 8, 'open', null],
  ['碼頭樁下', 1, [0.25, 0.2], 12, 'legend', null],
  ['蜿蜒外彎', 2, [4.0, -0.35], 6, 'open', [[4.0, -0.35], [3.6, 0.3], [4.4, 0.1]]],
  ['拱橋陰影', 2, [5.25, 0.0], 9, 'open', null],
  ['向陽深潭', 2, [6.4, -0.25], 14, 'legend', null],
  ['倒木縫', 3, [8.55, 0.3], 7, 'open', [[8.55, 0.3], [8.3, -0.3], [8.8, 0.2]]],
  ['沉木灣深處', 3, [9.3, 0.2], 15, 'legend', null],
  ['松蔭轉角', 3, [10.6, -0.2], 9, 'open', null],
  ['急流石後', 4, [12.6, 0.1], 7, 'open', [[12.6, 0.1], [13.2, -0.2], [12.9, 0.25]]],
  ['峽谷河灣', 4, [14.15, -0.2], 14, 'legend', null],
  ['湍流迴水', 4, [15.2, 0.2], 9, 'open', null],
  ['潭邊淺台', 5, [16.9, 0.5], 6, 'open', [[16.9, 0.5], [17.2, -0.55], [16.6, 0.1]]],
  ['水霧白沫', 5, [17.7, -0.3], 10, 'open', null],
  ['瀑布深淵', 5, [18.15, 0.05], 15, 'legend', null],
];
export const SPOTS = SPOT_DEF.map(([zh, zone, at, bonus, kind, roam], k) => {
  const p = along(at[0], at[1]);
  return { k, zh, zone, x: p.x, z: p.z, bonus, kind, roam: roam ? roam.map(([u, o]) => { const q = along(u, o); return { x: q.x, z: q.z }; }) : null };
});
export const SPOT_R = 4.5;     // 觸發半徑
export const SPOT_SLOW = 0.8;  // 觸發速度上限 m/s
// 急流區河中的巨石（可碰撞），左右交錯留出可划的水道
export const BOULDERS = [];
{
  // 釣點（含輪替位置）、燈樁與停泊點附近不放巨石
  const CLEAR = [...SPOTS.flatMap((s) => [s, ...(s.roam || [])]), ...CHECKPOINTS.flatMap((c) => [c, c.berth])];
  const rnd = mulberry(4401);
  for (let i = 0; i < N; i++) {
    const u = S.u[i];
    if (u < 11.8 || u > 15.6 || i % 7) continue;
    if (rnd() < 0.42) continue;
    const side = (Math.floor(i / 7) % 2 ? 1 : -1) * (0.12 + rnd() * 0.62);
    const w = S.w[i], r = 0.9 + rnd() * 1.1;
    const bx = S.x[i] - S.tz[i] * side * w, bz = S.z[i] + S.tx[i] * side * w;
    if (CLEAR.some((c) => Math.hypot(c.x - bx, c.z - bz) < r + 4.5)) continue;
    BOULDERS.push({ x: bx, z: bz, r, h: 0.6 + rnd() * 1.2, rot: rnd() * 6.28 });
  }
  // 瀑布潭邊與峽谷河灣的幾顆
  for (const [u, off, r] of [[16.3, 0.82, 1.6], [17.6, -0.85, 2.0], [18.1, 0.7, 1.4], [12.4, -0.2, 1.3]]) {
    const p = along(u, off); BOULDERS.push({ x: p.x, z: p.z, r, h: 1.0, rot: u * 3 });
  }
}

export function spotPos(s, timeIdx) { return s.roam ? s.roam[timeIdx % s.roam.length] : s; }
