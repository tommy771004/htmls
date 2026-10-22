// ═══ 分區：方格（邏輯座標）到世界座標的剛體變換（plans/260-irregular-city.md） ═══
// 城市的生成全部在邏輯座標（avX、stZ 的方格）裡跑；每一區有自己的平移與繞 y 的旋轉 ry，世界 = (ox + x·c + z·s, oz − x·s + z·c)，
// 和 three 的 rotation.y = ry 一致；朝向（前方 = (sin yaw, cos yaw)）換到世界是 yaw + ry。
// 區的範圍是邏輯平面上的矩形，邊界放在道路中心線（ni0…ni1、nj0…nj1 是邊界上的路口編號，邊界那條路兩區各有一份）；
// 外側延伸到很遠，河、海、遠景也跟著所在的區走。室內場館在 x ≥ 9000，不屬於任何區，座標不變。
const ZONE_ROT = (() => { const q = new URLSearchParams(location.search).get('zrot'); return q !== null && isFinite(+q) ? +q * Math.PI / 180 : null; })();
const ZONES = [
  // 第 0 階段：整座城市（含海岸與遠景）一起轉 25° 再平移，驗證所有換算；第 1 階段切成幾區
  { id: 0, name: 'city', ni0: 0, ni1: NX, nj0: 0, nj1: NZ, x0: -1e5, x1: 8000, z0: -1e5, z1: 1e5, ry: 0, tx: 0, tz: 0 },
];
{
  const pcx = (avX(0) + avX(NX)) / 2, pcz = (stZ(0) + stZ(NZ)) / 2;   // 繞城市中心轉，tx、tz 是另外的平移
  for (const zn of ZONES) {
    if (ZONE_ROT !== null) Object.assign(zn, { ry: ZONE_ROT, tx: 37, tz: -23 });   // ?zrot=25：除錯用，整座城轉 25° 再平移
    zn.c = Math.cos(zn.ry); zn.s = Math.sin(zn.ry);
    zn.ox = pcx + zn.tx - (pcx * zn.c + pcz * zn.s); zn.oz = pcz + zn.tz - (-pcx * zn.s + pcz * zn.c);
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
// 邏輯 → 世界；zn 省略時依點所在的區（邊界路上的東西要明確給區）
const toW = (x, z, zn = zoneAtL(x, z)) => zn ? [zn.ox + x * zn.c + z * zn.s, zn.oz - x * zn.s + z * zn.c] : [x, z];
const toL = (X, Z, zn = zoneAtW(X, Z)) => { if (!zn) return [X, Z]; const dx = X - zn.ox, dz = Z - zn.oz; return [dx * zn.c - dz * zn.s, dx * zn.s + dz * zn.c]; };
const dirW = (zn, dx, dz) => zn ? [dx * zn.c + dz * zn.s, -dx * zn.s + dz * zn.c] : [dx, dz];
const dirL = (zn, dX, dZ) => zn ? [dX * zn.c - dZ * zn.s, dX * zn.s + dZ * zn.c] : [dX, dZ];
const yawW = (zn, yaw) => zn ? yaw + zn.ry : yaw;
// 邏輯的 {x, z, yaw} 換成世界座標的新物件（其餘欄位照抄）
const spotW = (o, zn = zoneAtL(o.x, o.z)) => { const [x, z] = toW(o.x, o.z, zn); return { ...o, x, z, yaw: yawW(zn, o.yaw || 0) }; };
// 邏輯的矩形換成世界座標的四個角（逆時針）
const rectW = (x0, x1, z0, z1, zn = zoneAtL((x0 + x1) / 2, (z0 + z1) / 2)) => [toW(x0, z0, zn), toW(x1, z0, zn), toW(x1, z1, zn), toW(x0, z1, zn)];
// 邏輯的點換成世界座標的 {x, z}（任務標記、錨點）
const WP = (x, z, zn) => { const [X, Z] = toW(x, z, zn); return { x: X, z: Z }; };
