// ═══ 分區：方格（邏輯座標）到世界座標的剛體變換（plans/260-irregular-city.md） ═══
// 城市的生成全部在邏輯座標（avX、stZ 的方格）裡跑；每一區有自己的平移與繞 y 的旋轉 ry，世界 = (ox + x·c + z·s, oz − x·s + z·c)，
// 和 three 的 rotation.y = ry 一致；朝向（前方 = (sin yaw, cos yaw)）換到世界是 yaw + ry。
// 區的範圍是邏輯平面上的矩形，邊界放在道路中心線（ni0…ni1、nj0…nj1 是邊界上的路口編號，邊界那條路兩區各有一份）；
// 外側延伸到很遠，河、海、遠景也跟著所在的區走。室內場館在 x ≥ 9000，不屬於任何區，座標不變。
// 三區：A 舊城＋冠石（不動，舊存檔與任務座標照舊）、B 光環＋灰石（往東拉開再轉 8°）、C 南面整排含海岸（往南拉開再轉 4°）。
// px、pz 是區裡的樞紐點（邏輯），擺到世界的 wx、wz；區之間留下的縫在下面的 SEAM，06-roads.js 用彎道把兩區同一個路口接起來
const ZONE_ROT = (() => { const q = new URLSearchParams(location.search).get('zrot'); return q !== null && isFinite(+q) ? +q * Math.PI / 180 : null; })();
const ZONES = [
  { id: 0, name: 'old', ni0: 0, ni1: 8, nj0: 0, nj1: 7, x0: -1e5, x1: avX(8), z0: -1e5, z1: stZ(7), ry: 0, px: 0, pz: 0, wx: 0, wz: 0 },
  { id: 1, name: 'halo', ni0: 8, ni1: NX, nj0: 0, nj1: 7, x0: avX(8), x1: 8000, z0: -1e5, z1: stZ(7), ry: 8 * Math.PI / 180, px: avX(8), pz: stZ(0), wx: avX(8) + 36, wz: stZ(0) },
  { id: 2, name: 'south', ni0: 0, ni1: NX, nj0: 7, nj1: NZ, x0: -1e5, x1: 8000, z0: stZ(7), z1: 1e5, ry: 4 * Math.PI / 180, px: avX(8), pz: stZ(7), wx: avX(8) + 48, wz: stZ(7) + 39 },
];
{
  // ?zrot=25：除錯用，各區擺好之後整座城再一起繞城市中心轉 25° 並平移，驗證所有換算（單位變換驗不出漏掉的換算）
  const g = ZONE_ROT || 0, gc = Math.cos(g), gs = Math.sin(g), pcx = (avX(0) + avX(NX)) / 2, pcz = (stZ(0) + stZ(NZ)) / 2, tx = ZONE_ROT === null ? 0 : 37, tz = ZONE_ROT === null ? 0 : -23;
  for (const zn of ZONES) {
    const c = Math.cos(zn.ry), s = Math.sin(zn.ry), dx = zn.wx - (zn.px * c + zn.pz * s) - pcx, dz = zn.wz - (-zn.px * s + zn.pz * c) - pcz;
    zn.ox = pcx + tx + dx * gc + dz * gs; zn.oz = pcz + tz - dx * gs + dz * gc; zn.ry += g;
    zn.c = Math.cos(zn.ry); zn.s = Math.sin(zn.ry);
    zn.m4 = new T.Matrix4().makeRotationY(zn.ry).setPosition(zn.ox, 0, zn.oz);
  }
}
const inZoneL = (zn, x, z) => x >= zn.x0 && x < zn.x1 && z >= zn.z0 && z < zn.z1;
const zoneAtL = (x, z) => { for (const zn of ZONES) if (inZoneL(zn, x, z)) return zn; return null; };
// 世界座標的點在哪一區（縫裡、室內是 null）
function zoneAtW(X, Z) {
  if (X > 8500) return null;
  for (const zn of ZONES) { const dx = X - zn.ox, dz = Z - zn.oz; if (inZoneL(zn, dx * zn.c - dz * zn.s, dx * zn.s + dz * zn.c)) return zn; }
  return null;
}
// 縫裡的點：離得最近的區（換到它的邏輯座標之後落在邊界路外側，地名、街名照那一區算）
function zoneNearW(X, Z) {
  if (X > 8500) return null;
  let best = null, bd = 1e18;
  for (const zn of ZONES) {
    const dx = X - zn.ox, dz = Z - zn.oz, x = dx * zn.c - dz * zn.s, z = dx * zn.s + dz * zn.c;
    const d = Math.max(zn.x0 - x, x - zn.x1, 0) ** 2 + Math.max(zn.z0 - z, z - zn.z1, 0) ** 2;
    if (d < bd) { bd = d; best = zn; }
  }
  return best;
}
const zoneOfW = (X, Z) => zoneAtW(X, Z) || zoneNearW(X, Z);
// 邏輯 → 世界；zn 省略時依點所在的區（邊界路上的東西要明確給區）。zn 也可以是只有 ox、oz、c、s 的座標框（frameW）
const toW = (x, z, zn = zoneAtL(x, z)) => zn ? [zn.ox + x * zn.c + z * zn.s, zn.oz - x * zn.s + z * zn.c] : [x, z];
const toL = (X, Z, zn = zoneOfW(X, Z)) => { if (!zn) return [X, Z]; const dx = X - zn.ox, dz = Z - zn.oz; return [dx * zn.c - dz * zn.s, dx * zn.s + dz * zn.c]; };
const dirW = (zn, dx, dz) => zn ? [dx * zn.c + dz * zn.s, -dx * zn.s + dz * zn.c] : [dx, dz];
const dirL = (zn, dX, dZ) => zn ? [dX * zn.c - dZ * zn.s, dX * zn.s + dZ * zn.c] : [dX, dZ];
const yawW = (zn, yaw) => zn ? yaw + zn.ry : yaw;
// 邏輯的 {x, z, yaw} 換成世界座標的新物件（其餘欄位照抄）
const spotW = (o, zn = zoneAtL(o.x, o.z)) => { const [x, z] = toW(o.x, o.z, zn); return { ...o, x, z, yaw: yawW(zn, o.yaw || 0) }; };
// 邏輯的矩形換成世界座標的四個角（逆時針）
const rectW = (x0, x1, z0, z1, zn = zoneAtL((x0 + x1) / 2, (z0 + z1) / 2)) => [toW(x0, z0, zn), toW(x1, z0, zn), toW(x1, z1, zn), toW(x0, z1, zn)];
// 邏輯的點換成世界座標的 {x, z}（任務標記、錨點）
const WP = (x, z, zn) => { const [X, Z] = toW(x, z, zn); return { x: X, z: Z }; };
// 世界座標裡的座標框：原點 (ox, oz)、局部 +x 朝 (ux, uz)。縫裡斜放的碰撞盒用它當 f（和區一樣有 ox、oz、c、s）
const frameW = (ox, oz, ux, uz) => { const l = Math.hypot(ux, uz) || 1, c = ux / l, s = -uz / l; return { ox, oz, c, s, ry: Math.atan2(s, c) }; };

// ─── 區之間的縫（世界座標的多邊形）───
// A／B 之間往北的一條，A、B 和 C 之間東西向的一條。邊都在邊界路的中心線上；河與東灣那兩端直接接兩區的岸角，
// 北端是兩條邊界線往北的交點（在樓牆後面）。road[k] 標出 pts[k] → pts[k + 1] 是不是邊界路；SEAM_IN 往裡縮到邊界路外緣（草地）
function segCross(p, q, r, s) {   // 兩條線段的交點（不相交回傳 null）
  const d1x = q[0] - p[0], d1z = q[1] - p[1], d2x = s[0] - r[0], d2z = s[1] - r[1], den = d1x * d2z - d1z * d2x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((r[0] - p[0]) * d2z - (r[1] - p[1]) * d2x) / den, u = ((r[0] - p[0]) * d1z - (r[1] - p[1]) * d1x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [p[0] + d1x * t, p[1] + d1z * t] : null;
}
const SEAM = (() => {
  const [zA, zB, zC] = ZONES, xm = avX(zA.ni1), zm = stZ(zA.nj1), n0 = stZ(0) - 900;
  const L0 = avX(0) - HR - 50, L1 = avX(NX) + HR + 50;   // 陸地東西緣，和 10-city.js 的 CITY_X0 − OUT_D、CITY_X1 + OUT_D 一樣
  const a0 = toW(xm, zm, zA), aN = toW(xm, n0, zA), b0 = toW(xm, zm, zB), bN = toW(xm, n0, zB), X = segCross(a0, aN, b0, bN);
  return {
    pts: [a0, ...(X ? [X] : [aN, bN]), b0, toW(L1, zm, zB), toW(L1, zm, zC), toW(L0, zm, zC), toW(L0, zm, zA)],
    road: [1, ...(X ? [1] : [0, 1]), 1, 0, 1, 0, 1],
  };
})();
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
const SEAM_IN = polyInset(SEAM.pts, SEAM.road.map(r => r ? HR - .5 : 0));
// 世界座標的點在縫裡（含邊界路外側那半條）
const seamAt = (X, Z) => X < 8500 && inPoly(SEAM.pts, X, Z);
