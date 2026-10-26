// ═══ 分區：方格（邏輯座標）到世界座標的變換（plans/260-irregular-city.md 第二輪） ═══
// 城市的生成全部在邏輯座標（avX、stZ 的方格）裡跑。04-layout.js（tools/check-zones.mjs 產生）把城市切成 15 片，每片有：
//   彎曲 warpL：邏輯座標裡的平滑位移（大道與街左右彎、街區寬窄不一、大道扇形散開），城外 160 m 內漸漸收掉；
//   剛體：平移 ox、oz 與繞 y 的旋轉 ry，世界 = (ox + x'·c + z'·s, oz − x'·s + z'·c)，和 three 的 rotation.y = ry 一致。
// 所以世界 = 剛體(彎曲(邏輯))。方向與朝向要看位置（彎曲的 Jacobian）：dirW／dirL／yawW 都要帶邏輯座標的點。
// 片的範圍是邏輯平面上的矩形，邊界放在道路中心線（ni0…ni1、nj0…nj1 是邊界上的路口編號，邊界那條路兩片各有一份）；
// 在城市外框上的那幾邊延伸到很遠（河、海、遠景跟著所在的片走）。室內場館在 x ≥ 9000，不屬於任何片，座標不變。
// 片與片之間是縫（世界座標，草地、連接道路、快速道路），整座城的陸地是 CITY_EDGE 多邊形；外緣外拿掉的街區在 DROP_CELLS。
// ?warp=0 關掉彎曲（只剩剛體，用來分辨問題出在排版還是彎曲）；?zrot=25 整座城再一起轉 25° 驗證換算
const ZQ = new URLSearchParams(location.search);
const ZONE_ROT = (() => { const q = ZQ.get('zrot'); return q !== null && isFinite(+q) ? +q * Math.PI / 180 : null; })();
const WARP_ON = ZQ.get('warp') !== '0';
const ZONES = LAYOUT.map((L, id) => ({
  id, key: L.key, name: L.name, ni0: L.ni0, ni1: L.ni1, nj0: L.nj0, nj1: L.nj1, isle: !!L.isle,
  x0: L.ni0 === 0 ? -1e5 : avX(L.ni0), x1: L.ni1 === NX ? 8000 : avX(L.ni1), z0: L.nj0 === 0 ? -1e5 : stZ(L.nj0), z1: L.nj1 === NZ ? 1e5 : stZ(L.nj1),
  ry: L.ry, ox: L.ox, oz: L.oz, W: WARP_ON ? L.W : null,
}));
// 舊的三區（存檔第 6 版以前的世界座標）：讀檔時先換回邏輯座標，再用新的片換到世界（65-motors.js 的讀檔）
const ZONES_V6 = [
  { ni0: 0, ni1: 8, nj0: 0, nj1: 7, x0: -1e5, x1: avX(8), z0: -1e5, z1: stZ(7), ry: 0, ox: 0, oz: 0 },
  { ni0: 8, ni1: NX, nj0: 0, nj1: 7, x0: avX(8), x1: 8000, z0: -1e5, z1: stZ(7), ry: 8 * Math.PI / 180, px: avX(8), pz: stZ(0), wx: avX(8) + 36, wz: stZ(0) },
  { ni0: 0, ni1: NX, nj0: 7, nj1: NZ, x0: -1e5, x1: 8000, z0: stZ(7), z1: 1e5, ry: 4 * Math.PI / 180, px: avX(8), pz: stZ(7), wx: avX(8) + 48, wz: stZ(7) + 39 },
];
for (const zn of ZONES_V6) {
  zn.c = Math.cos(zn.ry); zn.s = Math.sin(zn.ry);
  if (zn.px !== undefined) { zn.ox = zn.wx - (zn.px * zn.c + zn.pz * zn.s); zn.oz = zn.wz - (-zn.px * zn.s + zn.pz * zn.c); }
}
{
  // ?zrot=25：除錯用，各片擺好之後整座城再一起繞城市中心轉 25° 並平移，驗證所有換算（單位變換驗不出漏掉的換算）
  const g = ZONE_ROT || 0, gc = Math.cos(g), gs = Math.sin(g), pcx = (avX(0) + avX(NX)) / 2, pcz = (stZ(0) + stZ(NZ)) / 2, tx = ZONE_ROT === null ? 0 : 37, tz = ZONE_ROT === null ? 0 : -23;
  for (const zn of ZONES) {
    const dx = zn.ox - pcx, dz = zn.oz - pcz;
    zn.ox = pcx + tx + dx * gc + dz * gs; zn.oz = pcz + tz - dx * gs + dz * gc; zn.ry += g;
    zn.c = Math.cos(zn.ry); zn.s = Math.sin(zn.ry);
    zn.m4 = new T.Matrix4().makeRotationY(zn.ry).setPosition(zn.ox, 0, zn.oz);
  }
  // CITY_EDGE 與縫裡的東西是世界座標，跟著一起轉
  ZONES.G = { gc, gs, pcx, pcz, tx, tz };
}
// 天樞島之前的十五片（存檔第 12 版以前的世界座標）：65-motors.js 讀舊存檔時先用它換回邏輯座標
const ZONES_V12 = LAYOUT_V12.map((L, id) => ({ id, key: L.key, ni0: L.ni0, ni1: L.ni1, nj0: L.nj0, nj1: L.nj1, ry: L.ry, ox: L.ox, oz: L.oz, W: L.W, c: Math.cos(L.ry), s: Math.sin(L.ry),
  x0: L.ni0 === 0 ? -1e5 : avX(L.ni0), x1: L.ni1 === NX ? 8000 : avX(L.ni1), z0: L.nj0 === 0 ? -1e5 : stZ(L.nj0), z1: L.nj1 === NZ ? 1e5 : stZ(L.nj1) }));
const zrotW = (x, z) => { const G = ZONES.G, dx = x - G.pcx, dz = z - G.pcz; return [G.pcx + G.tx + dx * G.gc + dz * G.gs, G.pcz + G.tz - dx * G.gs + dz * G.gc]; };

// ─── 彎曲（和 tools/check-zones.mjs 的 warpJ 同一個公式，改了要兩邊一起改）───
const WARP_TAPER = 160;
const CITY_LX0 = avX(0) - HR - 50, CITY_LX1 = avX(NX) + HR + 50, CITY_LZ0 = stZ(0) - HR - 50, CITY_LZ1 = stZ(NZ) + HR + 50 + 110;
// 天樞島的片（W.bx0…bz1）照島自己的邏輯範圍收
const warpOut = (x, z, W) => W && W.bx0 !== undefined ? Math.max(W.bx0 - x, x - W.bx1, W.bz0 - z, z - W.bz1, 0) : Math.max(CITY_LX0 - x, x - CITY_LX1, CITY_LZ0 - z, z - CITY_LZ1, 0);
const sm01 = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const warpT = (x, z, W) => 1 - sm01(warpOut(x, z, W) / WARP_TAPER);
const _wj = [0, 0, 1, 0, 0, 1], _wjC = { W: null, x: NaN, z: NaN, s0: 0, c0: 1, s1: 0, c1: 1, s2: 0, c2: 1, s3: 0, c3: 1 };
// 回傳共用的陣列 [x', z', ∂x'/∂x, ∂x'/∂z, ∂z'/∂x, ∂z'/∂z]（呼叫端要馬上取用）
function warpJ(W, x, z) {
  const o = _wj;
  if (!W) { o[0] = x; o[1] = z; o[2] = 1; o[3] = 0; o[4] = 0; o[5] = 1; return o; }
  const d = warpOut(x, z, W);
  if (d >= WARP_TAPER) { o[0] = x; o[1] = z; o[2] = 1; o[3] = 0; o[4] = 0; o[5] = 1; return o; }
  const t = 1 - sm01(d / WARP_TAPER);
  const a0 = W.kz * z + W.p0, a1 = W.kx * x + W.p1, a2 = W.kx2 * x + W.p2, a3 = W.kz2 * z + W.p3, ux = x - W.xc, uz = z - W.zc;
  // a1、a2 只看 x，a0、a3 只看 z：烘焙網格時同一面的頂點 x 或 z 常常一樣，記住上一次的三角函數（和每次重算的結果完全相同）
  const C = _wjC;
  if (C.W !== W || C.x !== x) { C.s1 = Math.sin(a1); C.c1 = Math.cos(a1); C.s2 = Math.sin(a2); C.c2 = Math.cos(a2); C.x = x; }
  if (C.W !== W || C.z !== z) { C.s0 = Math.sin(a0); C.c0 = Math.cos(a0); C.s3 = Math.sin(a3); C.c3 = Math.cos(a3); C.z = z; }
  C.W = W;
  const s0 = C.s0, c0 = C.c0, s1 = C.s1, c1 = C.c1, s2 = C.s2, c2 = C.c2, s3 = C.s3, c3 = C.c3;
  const dx = W.ax * s0 + W.sx * s1 + W.fa * ux * uz / W.hm, dz = W.az * s2 + W.sz * s3 + W.fb * ux * uz / W.hm;
  let tx = 0, tz = 0;
  if (d > 0) { const e = .5; tx = (warpT(x + e, z, W) - warpT(x - e, z, W)) / (2 * e); tz = (warpT(x, z + e, W) - warpT(x, z - e, W)) / (2 * e); }
  o[0] = x + dx * t; o[1] = z + dz * t;
  o[2] = 1 + (W.sx * W.kx * c1 + W.fa * uz / W.hm) * t + dx * tx; o[3] = (W.ax * W.kz * c0 + W.fa * ux / W.hm) * t + dx * tz;
  o[4] = (W.az * W.kx2 * c2 + W.fb * uz / W.hm) * t + dz * tx; o[5] = 1 + (W.sz * W.kz2 * c3 + W.fb * ux / W.hm) * t + dz * tz;
  return o;
}
// 反算：彎曲後的 (u, v) → 原本的 (x, z)（牛頓法，4 次就到 0.1 mm 以內）
function unwarp(W, u, v) {
  if (!W) return [u, v];
  let x = u, z = v;
  for (let it = 0; it < 8; it++) {
    const o = warpJ(W, x, z), ex = o[0] - u, ez = o[1] - v;
    if (ex * ex + ez * ez < 1e-9) break;
    const det = o[2] * o[5] - o[3] * o[4]; x -= (o[5] * ex - o[3] * ez) / det; z -= (-o[4] * ex + o[2] * ez) / det;
  }
  return [x, z];
}

const inZoneL = (zn, x, z) => x >= zn.x0 && x < zn.x1 && z >= zn.z0 && z < zn.z1;
const zoneAtL = (x, z) => { for (const zn of ZONES) if (inZoneL(zn, x, z)) return zn; return null; };
// 世界 → 片的邏輯座標（不檢查在不在片裡）
const zoneLocal = (zn, X, Z) => { const dx = X - zn.ox, dz = Z - zn.oz; if (zn.I) { const I = zn.I; return [I[0] * dx + I[1] * dz, I[2] * dx + I[3] * dz]; } return unwarp(zn.W, dx * zn.c - dz * zn.s, dx * zn.s + dz * zn.c); };
// 世界座標的點在哪一片（縫裡、室內是 null）。先用剛體反算粗篩（彎曲最多位移約 40 m），再精算
function zoneAtW(X, Z) {
  if (X > 8500) return null;
  for (const zn of ZONES) {
    const dx = X - zn.ox, dz = Z - zn.oz, u = dx * zn.c - dz * zn.s, v = dx * zn.s + dz * zn.c;
    if (u < zn.x0 - 60 || u >= zn.x1 + 60 || v < zn.z0 - 60 || v >= zn.z1 + 60) continue;
    const [x, z] = unwarp(zn.W, u, v);
    if (inZoneL(zn, x, z)) return zn;
  }
  return null;
}
// 縫裡的點：離得最近的片（換到它的邏輯座標之後落在邊界路外側，地名、街名照那一片算）
function zoneNearW(X, Z) {
  if (X > 8500) return null;
  let best = null, bd = 1e18;
  for (const zn of ZONES) {
    const [x, z] = zoneLocal(zn, X, Z);
    const d = Math.max(zn.x0 - x, x - zn.x1, 0) ** 2 + Math.max(zn.z0 - z, z - zn.z1, 0) ** 2;
    if (d < bd) { bd = d; best = zn; }
  }
  return best;
}
const zoneOfW = (X, Z) => zoneAtW(X, Z) || zoneNearW(X, Z);
// 世界座標的點離某一片留下來的街區（路中心線圍起來的格子）m 公尺以內：片的路、人行道都算（縫裡種樹、擺東西前先問）
function zoneNearL(X, Z, m) {
  if (X > 8500) return null;
  for (const zn of ZONES) {
    const dx = X - zn.ox, dz = Z - zn.oz, u = dx * zn.c - dz * zn.s, v = dx * zn.s + dz * zn.c;
    if (u < avX(zn.ni0) - m - 60 || u >= avX(zn.ni1) + m + 60 || v < stZ(zn.nj0) - m - 60 || v >= stZ(zn.nj1) + m + 60) continue;
    const [x, z] = unwarp(zn.W, u, v), ci = Math.floor((x - X0) / P), cj = Math.floor((z - Z0) / Q);
    for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) {
      if (i < zn.ni0 || i >= zn.ni1 || j < zn.nj0 || j >= zn.nj1 || DROP_CELLS.has(i + ',' + j)) continue;
      if (Math.max(avX(i) - x, x - avX(i + 1), 0) ** 2 + Math.max(stZ(j) - z, z - stZ(j + 1), 0) ** 2 <= m * m) return zn;
    }
  }
  return null;
}
// 邏輯 → 世界；zn 省略時依點所在的片（邊界路上的東西要明確給片）。zn 也可以是只有 ox、oz、c、s 的座標框（frameW，沒有彎曲）
const toW = (x, z, zn = zoneAtL(x, z)) => {
  if (!zn) return [x, z];
  if (zn.A) { const A = zn.A; return [zn.ox + A[0] * x + A[1] * z, zn.oz + A[2] * x + A[3] * z]; }
  if (zn.W) { const o = warpJ(zn.W, x, z); x = o[0]; z = o[1]; }
  return [zn.ox + x * zn.c + z * zn.s, zn.oz - x * zn.s + z * zn.c];
};
const toL = (X, Z, zn = zoneOfW(X, Z)) => zn ? zoneLocal(zn, X, Z) : [X, Z];
// 方向：邏輯的 (dx, dz) 在邏輯點 (x, z) 換到世界（長度不變）；沒給點就只轉剛體（片的平均方向，只能用在不在乎幾度誤差的地方）
function dirW(zn, dx, dz, x, z) {
  if (!zn) return [dx, dz];
  if (zn.A) { const A = zn.A, l0 = Math.hypot(dx, dz), ax = A[0] * dx + A[1] * dz, az = A[2] * dx + A[3] * dz, l1 = Math.hypot(ax, az) || 1; return [ax * l0 / l1, az * l0 / l1]; }
  if (zn.W && x !== undefined) {
    const o = warpJ(zn.W, x, z), l0 = Math.hypot(dx, dz), ax = o[2] * dx + o[3] * dz, az = o[4] * dx + o[5] * dz, l1 = Math.hypot(ax, az) || 1;
    dx = ax * l0 / l1; dz = az * l0 / l1;
  }
  return [dx * zn.c + dz * zn.s, -dx * zn.s + dz * zn.c];
}
// 世界的方向在邏輯點 (x, z) 換回邏輯（長度不變）
function dirL(zn, dX, dZ, x, z) {
  if (!zn) return [dX, dZ];
  if (zn.I) { const I = zn.I, l0 = Math.hypot(dX, dZ), ax = I[0] * dX + I[1] * dZ, az = I[2] * dX + I[3] * dZ, l1 = Math.hypot(ax, az) || 1; return [ax * l0 / l1, az * l0 / l1]; }
  let dx = dX * zn.c - dZ * zn.s, dz = dX * zn.s + dZ * zn.c;
  if (zn.W && x !== undefined) {
    const o = warpJ(zn.W, x, z), det = o[2] * o[5] - o[3] * o[4], l0 = Math.hypot(dx, dz), ax = (o[5] * dx - o[3] * dz) / det, az = (-o[4] * dx + o[2] * dz) / det, l1 = Math.hypot(ax, az) || 1;
    dx = ax * l0 / l1; dz = az * l0 / l1;
  }
  return [dx, dz];
}
// 朝向（前方 = (sin yaw, cos yaw)）
const yawW = (zn, yaw, x, z) => { if (!zn) return yaw; if (!zn.W || x === undefined) return yaw + zn.ry; const [fx, fz] = dirW(zn, Math.sin(yaw), Math.cos(yaw), x, z); return Math.atan2(fx, fz); };
const yawL = (zn, yaw, x, z) => { if (!zn) return yaw; if (!zn.W || x === undefined) return yaw - zn.ry; const [fx, fz] = dirL(zn, Math.sin(yaw), Math.cos(yaw), x, z); return Math.atan2(fx, fz); };
// 邏輯點的局部座標框：three 的 rotation.y（局部 +x 的方向）與兩個方向的伸縮（擺放實體建築用）
function localFrame(zn, x, z) {
  if (!zn) return { ry: 0, sx: 1, sz: 1 };
  if (!zn.W) return { ry: zn.ry, sx: 1, sz: 1 };
  const o = warpJ(zn.W, x, z), a = o[2], b = o[3], c = o[4], d = o[5];
  return { ry: zn.ry + Math.atan2(-c, a), sx: Math.hypot(a, c), sz: Math.hypot(b, d) };
}
// 邏輯點 (x, z) 附近的仿射座標框（Matrix4）：邏輯座標乘上它就是世界座標，在 (x, z) 精確、附近是一階近似（含彎曲的伸縮與斜切）。
// 擺放模型、實例、會動的物件（岸橋、摩天輪）都用它；out 省略時回傳新的 Matrix4
function frameM4(zn, x, z, out = new T.Matrix4()) {
  if (!zn) return out.identity();
  const o = warpJ(zn.W, x, z), c = zn.c, s = zn.s, a = o[2], b = o[3], cc = o[4], d = o[5];
  // A = R·J，R = [[c, s], [−s, c]]；平移讓 (x, z) 對到 toW(x, z)
  const A00 = c * a + s * cc, A01 = c * b + s * d, A10 = -s * a + c * cc, A11 = -s * b + c * d;
  const wx = zn.ox + o[0] * c + o[1] * s, wz = zn.oz - o[0] * s + o[1] * c;
  return out.set(A00, 0, A01, wx - A00 * x - A01 * z, 0, 1, 0, 0, A10, 0, A11, wz - A10 * x - A11 * z, 0, 0, 0, 1);
}
// 邏輯點 (x, z) 附近的剛體座標框（和片一樣有 ox、oz、c、s、ry，沒有彎曲）：(x, z) 精確，附近只差彎曲的伸縮與斜切。
// 會動的東西（岸橋、集卡、貨櫃船、摩天輪）整組掛在這個框裡，toW(x, z, 框) 和畫面一致
function localZone(zn, x, z) {
  if (!zn || !zn.W) return zn;
  const ry = localFrame(zn, x, z).ry, c = Math.cos(ry), s = Math.sin(ry), [X, Z] = toW(x, z, zn);
  return { id: zn.id, key: zn.key, name: zn.name, x0: zn.x0, x1: zn.x1, z0: zn.z0, z1: zn.z1, ni0: zn.ni0, ni1: zn.ni1, nj0: zn.nj0, nj1: zn.nj1,
    ry, c, s, ox: X - (x * c + z * s), oz: Z - (-x * s + z * c), W: null, base: zn };
}
// 邏輯的 {x, z, yaw} 換成世界座標的新物件（其餘欄位照抄）
const spotW = (o, zn = zoneAtL(o.x, o.z)) => { const [x, z] = toW(o.x, o.z, zn); return { ...o, x, z, yaw: yawW(zn, o.yaw || 0, o.x, o.z) }; };
// 邏輯的矩形換成世界座標的四個角（逆時針）
const rectW = (x0, x1, z0, z1, zn = zoneAtL((x0 + x1) / 2, (z0 + z1) / 2)) => [toW(x0, z0, zn), toW(x1, z0, zn), toW(x1, z1, zn), toW(x0, z1, zn)];
// 邏輯的點換成世界座標的 {x, z}（任務標記、錨點）
const WP = (x, z, zn) => { const [X, Z] = toW(x, z, zn); return { x: X, z: Z }; };
// 世界座標裡的座標框：原點 (ox, oz)、局部 +x 朝 (ux, uz)。縫裡斜放的碰撞盒用它當 f（和片一樣有 ox、oz、c、s，沒有彎曲）
const frameW = (ox, oz, ux, uz) => { const l = Math.hypot(ux, uz) || 1, c = ux / l, s = -uz / l; return { ox, oz, c, s, ry: Math.atan2(s, c) }; };
// 仿射的座標框：框裡的 (x, z) 乘上 A = [[a, b], [c, d]] 再加 (ox, oz) 就是世界座標（彎曲的片裡的碰撞盒：伸縮與斜切照盒中心那一點，盒在世界裡是平行四邊形）。
// toW／toL／dirW／dirL 都認得它（I 是 A 的反矩陣）；c、s、ry 是局部 +x 的方向，給只要大概朝向的地方用
const frameA = (ox, oz, a, b, c, d) => { const det = a * d - b * c, f = frameW(ox, oz, a, c); f.A = [a, b, c, d]; f.I = [d / det, -b / det, -c / det, a / det]; return f; };

// ─── 多邊形工具 ───
function segCross(p, q, r, s) {   // 兩條線段的交點（不相交回傳 null）
  const d1x = q[0] - p[0], d1z = q[1] - p[1], d2x = s[0] - r[0], d2z = s[1] - r[1], den = d1x * d2z - d1z * d2x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((r[0] - p[0]) * d2z - (r[1] - p[1]) * d2x) / den, u = ((r[0] - p[0]) * d1z - (r[1] - p[1]) * d1x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [p[0] + d1x * t, p[1] + d1z * t] : null;
}
const polyArea = P => { let a = 0; for (let k = 0; k < P.length; k++) { const p = P[k], q = P[(k + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
const inPoly = (P, x, z) => { let c = false; for (let k = 0, m = P.length - 1; k < P.length; m = k++) { const [ax, az] = P[k], [bx, bz] = P[m]; if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) c = !c; } return c; };
// 多邊形每條邊往裡縮 d[k]（相鄰兩條縮過的線取交點）
function polyInset(P, d) {
  const n = P.length, sg = polyArea(P) > 0 ? 1 : -1, L = [];
  for (let k = 0; k < n; k++) {
    const p = P[k], q = P[(k + 1) % n], ex = q[0] - p[0], ez = q[1] - p[1], l = Math.hypot(ex, ez) || 1;
    L.push([p[0] - ez / l * sg * d[k], p[1] + ex / l * sg * d[k], ex, ez]);
  }
  return P.map((p, k) => {
    const a = L[(k + n - 1) % n], b = L[k], den = a[2] * b[3] - a[3] * b[2];
    if (Math.abs(den) < 1e-9) return [b[0], b[1]];
    const t = ((b[0] - a[0]) * b[3] - (b[1] - a[1]) * b[2]) / den;
    return [a[0] + a[2] * t, a[1] + a[3] * t];
  });
}
// 點到折線（閉合）的距離
function polyDistPt(P, x, z) {
  let d = 1e9;
  for (let k = 0; k < P.length; k++) {
    const a = P[k], b = P[(k + 1) % P.length], ex = b[0] - a[0], ez = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / (ex * ex + ez * ez || 1)));
    d = Math.min(d, Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t));
  }
  return d;
}

// ─── 整座城的陸地（CITY_EDGE，世界座標）與縫 ───
// 外緣裡面是城：片的街區、片之間的縫（草地、連接道路、快速道路）；外面是河、海與山。CITY_EDGE_IN 往裡縮 HR + 2（縫裡種樹、放燈的範圍）
const CITY_POLY = ZONE_ROT === null ? CITY_EDGE : CITY_EDGE.map(p => zrotW(p[0], p[1]));
const CITY_BB = (() => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of CITY_POLY) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } return { x0, x1, z0, z1 }; })();
const CITY_EDGE_IN = polyInset(CITY_POLY, CITY_POLY.map(() => HR + 2));
// 4 m 的格子先算好「在不在外緣裡」，查詢不用每次跑多邊形
const CITY_MASK = (() => {
  const S = 4, nx = Math.ceil((CITY_BB.x1 - CITY_BB.x0) / S) + 1, nz = Math.ceil((CITY_BB.z1 - CITY_BB.z0) / S) + 1, m = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    // 掃描線：這一列和多邊形的交點
    const z = CITY_BB.z0 + (j + .5) * S, xs = [];
    for (let k = 0, n = CITY_POLY.length; k < n; k++) { const a = CITY_POLY[k], b = CITY_POLY[(k + 1) % n]; if ((a[1] > z) !== (b[1] > z)) xs.push(a[0] + (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1])); }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let i = Math.max(0, Math.floor((xs[k] - CITY_BB.x0) / S)); i <= Math.min(nx - 1, Math.floor((xs[k + 1] - CITY_BB.x0) / S)); i++) m[j * nx + i] = 1;
  }
  return { S, nx, nz, m };
})();
// 點在外緣裡（格子邊上兩格內用多邊形精算）
// 天樞島的水道不算（inLake 在下面，函式裡才用到）
function inCity(X, Z) {
  const M = CITY_MASK, i = Math.floor((X - CITY_BB.x0) / M.S), j = Math.floor((Z - CITY_BB.z0) / M.S);
  if (i < 0 || j < 0 || i >= M.nx || j >= M.nz) return false;
  const v = M.m[j * M.nx + i];
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii < M.nx && jj < M.nz && M.m[jj * M.nx + ii] !== v) return inPoly(CITY_POLY, X, Z) && !inLake(X, Z); }
  return !!v && !inLake(X, Z);
}
// ─── 天樞島的水道（04-layout.js 的 LAKE_POLY 裡、ISLE_POLY 外）：外緣把它包在裡面，但它是水。橋（06-roads.js 的 BRIDGES，
// 跨過水道的連接道路，路面加兩側人行道的寬度）上是陸地。4 m 的格子先算好，邊上兩格內用多邊形精算 ───
const LAKE_P = ZONE_ROT === null ? LAKE_POLY : LAKE_POLY.map(p => zrotW(p[0], p[1])), ISLE_P = ZONE_ROT === null ? ISLE_POLY : ISLE_POLY.map(p => zrotW(p[0], p[1]));
const ISLE_W = ZONE_ROT === null ? ISLE_C : zrotW(ISLE_C[0], ISLE_C[1]);
const lakeExact = (X, Z) => inPoly(LAKE_P, X, Z) && !inPoly(ISLE_P, X, Z);
const LAKE_MASK = (() => {
  const S = 4, xs = LAKE_P.map(p => p[0]), zs = LAKE_P.map(p => p[1]), x0 = Math.min(...xs) - S, z0 = Math.min(...zs) - S;
  const nx = Math.ceil((Math.max(...xs) + S - x0) / S), nz = Math.ceil((Math.max(...zs) + S - z0) / S), m = new Uint8Array(nx * nz);
  // 掃描線（和 CITY_MASK 一樣）：兩個多邊形的交點一起排序、奇偶填——島在水道裡面，奇數段就是「水道裡、島外」。
  // 以前每格各跑兩次 inPoly，開場要上千毫秒
  for (let j = 0; j < nz; j++) {
    const z = z0 + (j + .5) * S, cr = [];
    for (const P of [LAKE_P, ISLE_P]) for (let k = 0, n = P.length; k < n; k++) { const a = P[k], b = P[(k + 1) % n]; if ((a[1] > z) !== (b[1] > z)) cr.push(a[0] + (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1])); }
    cr.sort((p, q) => p - q);
    // 格子中心在 [cr[k], cr[k + 1]) 之間才算（和逐格用 inPoly 判斷同一個結果）
    for (let k = 0; k + 1 < cr.length; k += 2) for (let i = Math.max(0, Math.ceil((cr[k] - x0) / S - .5)); i < nx && x0 + (i + .5) * S < cr[k + 1]; i++) m[j * nx + i] = 1;
  }
  return { S, x0, z0, nx, nz, m };
})();
const BRIDGES = [];   // { pts, hw, bb }（06-roads.js 填）
function onBridge(X, Z) {
  for (const B of BRIDGES) {
    if (X < B.bb[0] || X > B.bb[1] || Z < B.bb[2] || Z > B.bb[3]) continue;
    const P = B.pts;
    for (let k = 1; k < P.length; k++) { const a = P[k - 1], ex = P[k][0] - a[0], ez = P[k][1] - a[1], t = Math.max(0, Math.min(1, ((X - a[0]) * ex + (Z - a[1]) * ez) / (ex * ex + ez * ez || 1))); if (Math.hypot(X - a[0] - ex * t, Z - a[1] - ez * t) <= B.hw) return B; }
  }
  return null;
}
// 點在水道的水面上（不含橋）
function inLake(X, Z) {
  const M = LAKE_MASK, i = Math.floor((X - M.x0) / M.S), j = Math.floor((Z - M.z0) / M.S);
  if (i < 0 || j < 0 || i >= M.nx || j >= M.nz) return false;
  const v = M.m[j * M.nx + i];
  let w = !!v;
  for (let a = -1; a <= 1 && w === !!v; a++) for (let b = -1; b <= 1; b++) { const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii < M.nx && jj < M.nz && M.m[jj * M.nx + ii] !== v) { w = lakeExact(X, Z); break; } }
  return w && !onBridge(X, Z);
}
// 外緣外面是水還是山：外緣是從 CITY_CTR 每 2° 量一點，所以看點在中心的哪個方向（?zrot 轉過的要轉回來）
const CITY_C = ZONE_ROT === null ? CITY_CTR : zrotW(CITY_CTR[0], CITY_CTR[1]);
const shoreAt = (X, Z) => { const a = (Math.atan2(Z - CITY_C[1], X - CITY_C[0]) + (ZONE_ROT || 0)) * 180 / Math.PI; return !!CITY_SHORE[((Math.round(a / 2) % 180) + 180) % 180]; };
// 外緣的第 k 條邊（k → k + 1）臨水
const shoreEdge = k => !!(CITY_SHORE[k] && CITY_SHORE[(k + 1) % CITY_SHORE.length]);
// 拿掉的街區（外緣外的邏輯街區）：不蓋房子、地面跟著縫走
const cellDropped = (i, j) => DROP_CELLS.has(i + ',' + j);
// 世界座標的點在縫裡（外緣裡、不在任何片的路網上）；呼叫端通常先問過 zoneAtW
const seamAt = (X, Z) => X < 8500 && inCity(X, Z);
