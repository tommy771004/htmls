
// ═══ 城市：街區、建築立面、路面與人行道 ═══
await bootStep(BOOT.city, '正在鋪路…');
import PROPS_SPEC from '../../../../assets/260/props/props.json';
import ENC_SPEC from '../../../../assets/260/enclave/enclave.json';   // 雲梯城寨的版面（blender/enclave.py）
const scene = new T.Scene();
// 以邏輯座標建好的物件換到世界座標（05-zones.js：世界 = 剛體(彎曲(邏輯))），都掛在 scene：
//   沒有變換的網格（合併好的立面、路面、Kit）：頂點逐一換成世界座標，長邊先切短，彎曲後的路面與牆才跟著彎；
//     zn 省略時每個零件（Kit 的 parts）或三角形看自己在哪一片；材質讀 aL 的（路面 shader）另外記下原本的邏輯 xz 與邏輯 x 軸的方向。
//   有位置、旋轉的物件（招牌、摩天輪、岸橋……）：外面套一個 localZone 的剛體座標框（在物件的位置 at 精確），物件自己的位置與動畫照舊是邏輯座標。
//   at 省略時用物件的位置；物件之後才擺到定位的（車廂、岸橋的小車）要給 at，或直接傳 localZone 的框當 zn
const WARP_SEG = 12;
const baked = new WeakSet();
function cityAdd(obj, zn, at) {
  const ident = obj.position.lengthSq() === 0 && obj.rotation.x === 0 && obj.rotation.y === 0 && obj.rotation.z === 0 && obj.scale.x === 1 && obj.scale.y === 1 && obj.scale.z === 1;
  if (obj.isMesh && !obj.isInstancedMesh && ident && obj.geometry && !at) { bakeMesh(obj, zn); scene.add(obj); return obj; }
  const [ax, az] = at || [obj.position.x, obj.position.z];
  if (zn === undefined) zn = zoneAtL(ax, az);
  if (!zn) { scene.add(obj); return obj; }
  const fr = localZone(zn, ax, az), fg = new T.Group(); fg.position.set(fr.ox, 0, fr.oz); fg.rotation.y = fr.ry; fg.name = 'frame' + zn.id;
  fg.add(obj); scene.add(fg); return obj;
}
const cityAddAny = m => cityAdd(m);
// 三角形的 xz 長邊超過 L 就從中點切開（所有屬性線性內插）；回傳 non-indexed 的新幾何
function tessXZ(g, L) {
  if (g.index) g = g.toNonIndexed();
  const pos = g.attributes.position.array, n = pos.length / 9;
  let need = false;
  for (let t = 0; t < n && !need; t++) for (let e = 0; e < 3; e++) { const a = t * 9 + e * 3, b = t * 9 + (e + 1) % 3 * 3; if ((pos[a] - pos[b]) ** 2 + (pos[a + 2] - pos[b + 2]) ** 2 > L * L) { need = true; break; } }
  if (!need || g.groups.length) return g;
  const names = Object.keys(g.attributes), src = names.map(k => g.attributes[k]), out = names.map(() => []), parts = g.userData.parts, pOut = parts ? [] : null;
  let pk = 0;
  const vtx = (attr, i) => { const s = attr.itemSize, o = []; for (let c = 0; c < s; c++) o.push(attr.array[i * s + c]); return o; };
  const emit = tri => { for (const v of tri) v.forEach((arr, k) => out[k].push(...arr)); };
  const mid = (u, v) => u.map((arr, k) => arr.map((x, c) => (x + v[k][c]) / 2));
  const split = (tri, depth) => {
    const P = tri.map(v => v[0]);
    let best = -1, bl = L * L;
    for (let e = 0; e < 3; e++) { const p = P[e], q = P[(e + 1) % 3], l = (p[0] - q[0]) ** 2 + (p[2] - q[2]) ** 2; if (l > bl) { bl = l; best = e; } }
    if (best < 0 || depth > 12) { emit(tri); return; }
    const a = tri[best], b = tri[(best + 1) % 3], c = tri[(best + 2) % 3], m = mid(a, b);
    split([a, m, c], depth + 1); split([m, b, c], depth + 1);
  };
  const posK = names.indexOf('position'), L2 = L * L;
  for (let t = 0; t < n; t++) {
    if (parts) while (pk < parts.length && parts[pk] <= t * 3) { pOut.push(out[posK].length / 3); pk++; }
    // 不用切的三角形直接照抄（和 split 一路 emit 的結果一樣）：大多數三角形都短，逐頂點配置陣列的那條路開場要上千毫秒
    const a = t * 9;
    if ((pos[a] - pos[a + 3]) ** 2 + (pos[a + 2] - pos[a + 5]) ** 2 <= L2 && (pos[a + 3] - pos[a + 6]) ** 2 + (pos[a + 5] - pos[a + 8]) ** 2 <= L2 && (pos[a + 6] - pos[a]) ** 2 + (pos[a + 8] - pos[a + 2]) ** 2 <= L2) {
      for (let k = 0; k < src.length; k++) { const s = src[k].itemSize, arr = src[k].array, o = out[k]; for (let i = t * 3 * s, e = i + 3 * s; i < e; i++) o.push(arr[i]); }
      continue;
    }
    split([0, 1, 2].map(e => src.map(attr => vtx(attr, t * 3 + e))), 0);
  }
  const ng = new T.BufferGeometry();
  names.forEach((k, i) => ng.setAttribute(k, new T.Float32BufferAttribute(out[i], src[i].itemSize)));
  if (pOut) ng.userData.parts = Int32Array.from(pOut);
  return ng;
}
// 網格的頂點換到世界座標（obj 掛在 scene）。zn：null 是已經是世界座標；省略時依零件／三角形所在的片
function bakeMesh(m, zn) {
  let g = m.geometry;
  const needL = m.material && m.material.vertexShader && m.material.vertexShader.includes('attribute vec4 aL');
  if (zn === null) {
    if (needL && !g.attributes.aL) { const p = g.attributes.position, a = new Float32Array(p.count * 4); for (let k = 0; k < p.count; k++) { a[k * 4] = p.getX(k); a[k * 4 + 1] = p.getZ(k); a[k * 4 + 2] = 1; } g.setAttribute('aL', new T.BufferAttribute(a, 4)); }
    return;
  }
  if (baked.has(g)) g = g.clone();
  // 長邊切短（路面、人行道、長牆）；立面、實體建築與遠景不切（userData.noTess、MAT.far）：20 m 以內的面，彎曲的弧差不到 10 公分
  if (!m.userData.noTess && m.material !== MAT.far && m.material !== MAT.far2) g = tessXZ(g, WARP_SEG);
  const p = g.attributes.position, nr = g.attributes.normal, cnt = p.count, parts = g.userData.parts;
  // 每個頂點所在的片：給了 zn 就全部同一片；否則看零件（Kit）或三角形的中心
  const zof = new Array(cnt);
  if (zn) zof.fill(zn);
  else if (parts && parts.length) {
    for (let k = 0; k < parts.length; k++) {
      const a0 = parts[k], a1 = k + 1 < parts.length ? parts[k + 1] : cnt;
      let sx = 0, sz = 0; for (let v = a0; v < a1; v++) { sx += p.getX(v); sz += p.getZ(v); }
      const z = a1 > a0 ? zoneAtL(sx / (a1 - a0), sz / (a1 - a0)) : null; for (let v = a0; v < a1; v++) zof[v] = z;
    }
  } else if (g.index) { for (let v = 0; v < cnt; v++) zof[v] = zoneAtL(p.getX(v), p.getZ(v)); }
  else for (let t = 0; t < cnt; t += 3) { const z = zoneAtL((p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3, (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3); zof[t] = zof[t + 1] = zof[t + 2] = z; }
  const aL = needL ? new Float32Array(cnt * 4) : null;
  for (let v = 0; v < cnt; v++) {
    const z = zof[v], x = p.getX(v), y = p.getY(v), w = p.getZ(v);
    if (!z) { if (aL) { aL[v * 4] = x; aL[v * 4 + 1] = w; aL[v * 4 + 2] = 1; } continue; }
    const o = warpJ(z.W, x, w), a = o[2], b = o[3], c = o[4], d = o[5], wx = o[0], wz = o[1];
    p.setXYZ(v, z.ox + wx * z.c + wz * z.s, y, z.oz - wx * z.s + wz * z.c);
    if (nr) {
      // 法線（餘向量）乘 J 的反轉置，再轉剛體
      const det = a * d - b * c, nx = nr.getX(v), nz = nr.getZ(v), mx = (d * nx - c * nz) / det, mz = (-b * nx + a * nz) / det;
      const X = mx * z.c + mz * z.s, Z = -mx * z.s + mz * z.c, ny = nr.getY(v), l = Math.hypot(X, ny, Z) || 1, l0 = Math.hypot(nx, ny, nz);
      nr.setXYZ(v, X / l * l0, ny / l * l0, Z / l * l0);
    }
    if (aL) { const ax = a * z.c + c * z.s, az = -a * z.s + c * z.c, l = Math.hypot(ax, az) || 1; aL[v * 4] = x; aL[v * 4 + 1] = w; aL[v * 4 + 2] = ax / l; aL[v * 4 + 3] = az / l; }
  }
  if (aL) g.setAttribute('aL', new T.BufferAttribute(aL, 4));
  p.needsUpdate = true; if (nr) nr.needsUpdate = true;
  g.computeBoundingSphere(); g.boundingBox = null;
  baked.add(g); m.geometry = g;
}
const LY = { MAIN: 0, NOREFL: 1 };     // 1 號圖層不進倒影（雨、蒸氣、小物件）
const rnd = rng(20261019);
const colliders = [];                   // 靜態 AABB：{x0,x1,z0,z1}
const circles = [];                     // 靜態圓柱：{x,z,r}
let activeBoxes = colliders, activeCircles = circles;   // 室內時換成室內的碰撞表
const blocks = [], lots = [], shopUnits = [];
// 店內是哪一類（立面著色器 shopRoom 的 kind，20-props.js 照它挑招牌，招牌和櫥窗裡看到的才對得上）：0 層架（雜貨、當鋪、酒、唱片…）、1 洗衣店、2 小吃、3 螢幕（電玩、電器、KTV）、4 藥局類（白綠光的層架：藥局、眼鏡、美甲、理髮、刺青）。
// 著色器拿到的 seed 是 float32，floor 之後的整數兩邊一樣；比例 8:1:6:4:5 照招牌各類的數量
const shopKind = (seed, ui) => { const r = (Math.floor(Math.fround(seed)) * 7 + ui * 13) % 24; return r < 8 ? 0 : r < 9 ? 1 : r < 15 ? 2 : r < 19 ? 3 : 4; };
// 安全屋在街上的門（邏輯座標，都在街區南面朝 +z；69-safehouse.js 的 APT 引用），車庫捲門在門的東邊 GAR_DX 公尺。
// 程式立面在門與捲門那一段的店面畫成鐵捲門，櫥窗才不會蓋住門板（只改畫面，shopUnits 的 shut 不變，20-props 招牌的亂數序列照舊）
const APT_DOORS = {
  loft: { x: avX(6) + 44, z: stZ(2) - HR - SW }, villa: { x: avX(2) + 36, z: stZ(7) - HR - SW }, mini: { x: avX(2) + 36, z: stZ(9) - HR - SW },
  l16: { x: avX(15) + 36, z: stZ(9) - HR - SW }, i14: { x: avX(12) + 36, z: stZ(8) - HR - SW }, lr: { x: avX(4) + 36, z: stZ(13) - HR - SW },
};
const GAR_DX = 3.5;
const aptDoorOn = (x0, x1, z) => Object.values(APT_DOORS).some(d => Math.abs(d.z - z) < .5 && x1 > d.x - 1.1 && x0 < d.x + GAR_DX + 1.6);

// 依序建：原本的 5×5、World 第一輪的 8×7、第二輪的 20×15（亂數序列和擴建前一樣，舊城區的地塊與立面不變）
const CORE = 5, isCore = (i, j) => i < CORE && j < CORE, isOld = (i, j) => i < 8 && j < 7;
const phase = (i, j) => isCore(i, j) ? 0 : isOld(i, j) ? 1 : 2;
for (const ph of [0, 1, 2]) for (let i = 0; i < (ph < 2 ? 8 : NX); i++) for (let j = 0; j < (ph < 2 ? 7 : NZ); j++)
  if (phase(i, j) === ph && !cellDropped(i, j)) blocks.push({ i, j, x0: avX(i) + HR, x1: avX(i + 1) - HR, z0: stZ(j) + HR, z1: stZ(j + 1) - HR, outer: 0 });
// 第三輪：天樞島（04-layout.js 的 isle 四片，邏輯座標在 x ≥ 8000）排在最後，地塊用自己的亂數（isleLots），前面的序列不變
const ISLE_CELLS = new Set();
for (const zn of ZONES) if (zn.isle) for (let i = zn.ni0; i < zn.ni1; i++) for (let j = zn.nj0; j < zn.nj1; j++) {
  ISLE_CELLS.add(i + ',' + j);
  if (!cellDropped(i, j)) blocks.push({ i, j, x0: avX(i) + HR, x1: avX(i + 1) - HR, z0: stZ(j) + HR, z1: stZ(j + 1) - HR, outer: 0, isle: zn.key });
}
// 邏輯格子 (i, j) 是城裡的街區（方格或島上）
const gridCell = (i, j) => (i >= 0 && j >= 0 && i < NX && j < NZ || ISLE_CELLS.has(i + ',' + j)) && !cellDropped(i, j);
const OUT_D = 50, CITY_X0 = avX(0) - HR, CITY_X1 = avX(NX) + HR, CITY_Z0 = stZ(0) - HR, CITY_Z1 = stZ(NZ) + HR;
const CITY_CX = (CITY_X0 + CITY_X1) / 2, CITY_CZ = (CITY_Z0 + CITY_Z1) / 2;
// 海岸（21-coast.js）：城市的陸地是 05-zones.js 的外緣多邊形（CITY_POLY；片之間與片外圍的空地是草地），南面與西面臨水（西是灰鷺河、南是海：
// 西半珊瑚灘的沙灘、東半錨灣港的碼頭與跨海橋過去的灰鷗島），北面與東面是山。
// 下面的矩形是外緣之外還能走的地（邏輯座標，跟著所在的片轉；y = 0，沙灘往海裡斜下去、棧橋高 0.4 m）。沙灘與碼頭往陸地多伸 INLAND，蓋過外緣的草地邊
const SEA_Y = -1.6, SHORE_Z = CITY_Z1 + OUT_D, BEACH_X1 = avX(10) - HR, INLAND = 40;
const BEACH = { x0: CITY_X0 - OUT_D, x1: BEACH_X1, z0: SHORE_Z, z1: SHORE_Z + 58, len: 90, drop: 3 };   // 90 m 從 0 斜到 -3，走到水深 0.3 m 為止
const QUAY = { x0: BEACH_X1, x1: CITY_X1 + OUT_D, z0: SHORE_Z - INLAND, z1: SHORE_Z + 110 };
const BRIDGE_X = avX(17) + 36;   // 島的西緣剛好在 avX(15)：整座島都在錨灣東那一片（不會被兩片切開）
const ISLE = { x0: BRIDGE_X - 180, x1: BRIDGE_X + 180, z0: QUAY.z1 + 230, z1: QUAY.z1 + 480 };
const BRIDGE = { x0: BRIDGE_X - 7, x1: BRIDGE_X + 7, z0: QUAY.z1, z1: ISLE.z0 };
const PIERS = [
  { x0: avX(4) - 5, x1: avX(4) + 5, z0: SHORE_Z, z1: SHORE_Z + 190, h: .4, name: 'coral' },   // 珊瑚灘棧橋（盡頭是摩天輪）
  ...[1, 3].map(j => ({ x0: CITY_X0 - OUT_D - 64, x1: CITY_X0 - OUT_D, z0: stZ(j) + 24, z1: stZ(j) + 38, h: .15, name: 'dock' })),   // 舊碼頭伸進河裡的兩座木棧
];
// 對岸（21-coast.js 的遠景）：灰鷺河西岸、東灣東岸的堤岸線
// 灰鷺河的對岸只到 FAR_Z1（舊城的北半段）為止，再往南河口張開成海；河往北流進山谷（hillH）。EAST_BANK_X 只剩地圖的範圍在用
const FAR_BANK_X = CITY_X0 - OUT_D - 300, EAST_BANK_X = CITY_X1 + OUT_D + 300, FAR_Z1 = CITY_Z0 + 100, RIVER_E = CITY_X0 - OUT_D;
// 對岸的濱水步道：灰鷺河對岸（舊城那一片，London City 模型前）一條 20 m 寬，中間一座渡船碼頭（東面改成山之後，舊港那一條拿掉了）。
// back 那一邊靠著遠景模型，不做低擋牆，換成一道高牆（21-coast.js 在那裡蓋一排近景的樓面）
const BANK_WALKS = [
  { x0: FAR_BANK_X - 20, x1: FAR_BANK_X, z0: CITY_Z0 - 420, z1: FAR_Z1 - 20, h: .15, back: 'x0', name: '鷺岸步道', en: 'Heron Quay' },
];
const FERRY = BANK_WALKS.map((B, i) => { const zc = Math.round((B.z0 + B.z1) / 2); return i ? { x0: B.x0 - 30, x1: B.x0, z0: zc - 2.5, z1: zc + 2.5, h: .4, name: '舊港渡口' } : { x0: B.x1, x1: B.x1 + 30, z0: zc - 2.5, z1: zc + 2.5, h: .4, name: '鷺岸渡口' }; });
const LANDS = [{ ...BEACH, z0: SHORE_Z - INLAND }, QUAY, BRIDGE, ISLE, ...PIERS, ...BANK_WALKS, ...FERRY];
const inLand = (x, z) => LANDS.some(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
// 外海的島（光格島、鷹巖村）與機場不屬於任何片：SEA_FR 是它們的剛體座標框（沒有 ?zrot 時就是世界座標；有的話跟著整座城一起轉）
const SEA_FR = ZONE_ROT === null ? null : (() => { const [ox, oz] = zrotW(0, 0), [ex, ez] = zrotW(1, 0); return frameW(ox, oz, ex - ox, ez - oz); })();
// ─── 灰鷺角國際機場（21-air.js）：城西外海的填海島（SEA_FR 座標的矩形，北緣離灰鷺河對岸 FAR_Z1 七十多公尺），跑道東西向，
// 堤道從楓林西第 9 條街的西端（外緣那條大道的路邊）沿街道方向出海，S 形彎到島東緣北段的航廈前路。堤道是 SEA_FR 座標的三次貝茲曲線，切成 8 m 一段的折線 ───
const AIR = (() => {
  const isl = { x0: -3300, x1: -1000, z0: 20, z1: 600 }, zn = ZONES.find(z => z.name === '楓林西');
  if (!zn) return null;
  const [sx, sz] = toL(...toW(avX(zn.ni0) - HR, stZ(9), zn), SEA_FR), [dx, dz] = dirW(zn, -1, 0, avX(zn.ni0) - HR, stZ(9)), dl = Math.hypot(dx, dz);
  const ux = dx / dl, uz = dz / dl, [rx, rz] = SEA_FR ? [ux * SEA_FR.c - uz * SEA_FR.s, ux * SEA_FR.s + uz * SEA_FR.c] : [ux, uz];   // 街道方向換到 SEA_FR
  const B = [[sx, sz], [sx + rx * 160, sz + rz * 160], [isl.x1 + 240, 60], [isl.x1, 60]], pts = [];
  const bz = (t, k) => (1 - t) ** 3 * B[0][k] + 3 * (1 - t) ** 2 * t * B[1][k] + 3 * (1 - t) * t * t * B[2][k] + t ** 3 * B[3][k];
  for (let i = 0; i <= 80; i++) pts.push([bz(i / 80, 0), bz(i / 80, 1)]);
  const road = [];   // 均勻 8 m 一段
  let acc = 0; road.push(pts[0]);
  for (let i = 1; i < pts.length; i++) { const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); acc += L; if (acc >= 8 || i === pts.length - 1) { road.push(pts[i]); acc = 0; } }
  const xs = road.map(p => p[0]), zs = road.map(p => p[1]);
  return { isl, road, hw: 10, bb: [Math.min(...xs) - 12, Math.max(...xs) + 12, Math.min(...zs) - 12, Math.max(...zs) + 12], name: '灰鷺角國際機場', en: 'Heron Point International' };
})();
// SEA_FR 座標的一點：在機場島上（含堤道路面）。堤道從街口開始，外緣裡面那一小段本來就是陸地
const airLandL = (x, z) => {
  if (!AIR) return false;
  const I = AIR.isl; if (x >= I.x0 && x <= I.x1 && z >= I.z0 && z <= I.z1) return true;
  const b = AIR.bb; if (x < b[0] || x > b[1] || z < b[2] || z > b[3]) return false;
  const R = AIR.road;
  for (let i = 1; i < R.length; i++) {
    const [ax, az] = R[i - 1], ex = R[i][0] - ax, ez = R[i][1] - az, t = clamp(((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez), 0, 1);
    if (Math.hypot(x - ax - ex * t, z - az - ez * t) <= AIR.hw) return true;
  }
  return false;
};
const airLandW = (X, Z) => AIR ? airLandL(...toL(X, Z, SEA_FR)) : false;
// 世界座標的點在陸地上：外緣裡面，或在上面那些矩形裡（換到點所在那一片的邏輯座標），或在機場島與堤道上
const landW = (X, Z) => { if (inCity(X, Z) || airLandW(X, Z)) return true; if (inLake(X, Z)) return false; const zn = zoneAtW(X, Z); return !!zn && inLand(...zoneLocal(zn, X, Z)); };   // 片與片之間海上的縫沒有畫沙灘、碼頭：不能換到最近那片的邏輯座標去套它的陸地矩形
// ─── 岬角（世界座標的草地多邊形）：外緣改成不規則的多邊形之後不需要了，留著空的表（21-coast、地圖照樣迭代） ───
const CAPES = [];
// 北嶺公園（下面 hillH 之後建好；畫面在 21-park.js）。開場在那之前問地面高度的（groundH、seaFloor）就當沒有公園
let NPARK = null;
// 雲梯城寨（下面 HILL 之後建好；畫面在 28-enclave.js）。之前問地面高度的就當沒有城寨
let ENC = null;
// 北嶺鐵道橋（World 第一輪的 railway 掃描）：北嶺公園建好之後擺在公園框裡（下面 NPARK 那一段）；沒有掃描資料時是 null（21-rail.js、27-world1.js 就跳過）
let VIADUCT = null;
const capeAt = (X, Z) => { for (const h of CAPES) if (X >= h.bb[0] && X <= h.bb[1] && Z >= h.bb[2] && Z <= h.bb[3] && inPoly(h.pts, X, Z)) return h; return null; };
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
// 天樞島四片的地名（照片的 key）
const ISLE_NAMES = { MA: '天樞北城 Meridian North', MB: '天樞西岸 Meridian Westbank', MC: '天樞金融區 Meridian Financial', MD: '天樞岬角 Meridian Point' };
const district = (x, z) => {
  const i = (x - X0) / P, j = (z - Z0) / Q;
  if (x > 7900 && x < 8600) { const zn = zoneAtL(x, z) || ZONES.filter(o => o.isle).reduce((a, o) => Math.hypot(x - (o.x0 + o.x1) / 2, z - (o.z0 + o.z1) / 2) < Math.hypot(x - (a.x0 + a.x1) / 2, z - (a.z0 + a.z1) / 2) ? o : a); return ISLE_NAMES[zn.key]; }
  if (z > CITY_Z1) {   // 海邊（21-coast.js）：在格網外，要先判斷
    if (z >= ISLE.z0 - 4) return '灰鷗島 Gull Island';
    if (z > QUAY.z1 && x > BRIDGE.x0 - 30 && x < BRIDGE.x1 + 30) return '灰鷗大橋 Gullwing Bridge';
    return x < BEACH_X1 ? '珊瑚灘 Coral Beach' : '錨灣港 Anchor Bay';
  }
  for (const B of [...BANK_WALKS, ...FERRY]) if (x >= B.x0 - 2 && x <= B.x1 + 2 && z >= B.z0 - 2 && z <= B.z1 + 2) return `${B.name} ${B.en || (B.x0 < CITY_X0 ? 'Heron Ferry' : 'Old Harbour Ferry')}`;
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
  if (isPark(b)) { b.park = 1; return; }   // 公園：只有人行道一圈，中間是草地與樹（20-props.js），車可以開進去
  const mid = (bz0 + bz1) / 2;
  rowLots(bx0, bx1, bz0, mid, -1, b, 'z');
  rowLots(bx0, bx1, mid, bz1, +1, b, 'z');
  colliders.push(b.col = { x0: bx0, x1: bx1, z0: bz0, z1: bz1 });
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
// ─── 天樞島的街區（照曼哈頓下城）：金融區與岬角多半是整塊街區的高樓，西岸是新填地的現代高樓，北城是五到十二層的鑄鐵與磚造廠房樓、偶爾一棟塔樓。
// 塔樓 = 底座（L.h，到第一道退台）加上往上一層層往裡退的 L.tiers（{ i：每邊退幾公尺, y：這一層的頂, st：樣式 }），最上面的 crown 是 20-isle.js 的塔冠與尖頂。
// 牆和樓板仍是方塊；退台的邊上有簷口（樣式 7）。亂數用 isleRnd，舊城區的序列不受影響 ───
const isleRnd = rng(20261026);
const ISLE_KIND = { MA: 'loft', MB: 'bpc', MC: 'fin', MD: 'fin' };
function isleTower(L, R, kind) {
  const w = Math.min(L.x1 - L.x0, L.z1 - L.z0), r = R();
  // deco：石造退台塔（1930 年代），glass：玻璃帷幕塔，slab：方正的戰後辦公樓
  const type = kind === 'bpc' ? (r < .55 ? 'glass' : r < .85 ? 'deco' : 'slab') : kind === 'loft' ? (r < .5 ? 'deco' : 'slab') : (r < .45 ? 'deco' : r < .8 ? 'glass' : 'slab');
  const big = w > 30, H = (kind === 'loft' ? 55 + R() * 55 : big ? 110 + R() * 150 : 70 + R() * 80) * (kind === 'bpc' ? .85 : 1);
  L.type = type; L.tiers = [];
  if (type === 'glass') {
    L.style = 3; L.fh = 3.7; L.h = H * (.62 + R() * .2);
    const ins = 2 + R() * 3; L.tiers.push({ i: ins, y: H, st: 3 });
    if (R() < .6) L.tiers.push({ i: ins + 4 + R() * 3, y: H + 6 + R() * 6, st: 3 });   // 頂上的機房層
  } else if (type === 'slab') {
    L.style = R() < .5 ? 2 : 3; L.fh = L.style === 3 ? 3.7 : 3.4; L.h = H * .9;
    L.tiers.push({ i: 3, y: H, st: L.style });
  } else {
    // 退台：底座到 0.3–0.4，之後每段退 2.5–4 m，最上面一段收成塔冠（L.crown）
    L.style = 2; L.fh = 3.4; L.h = Math.max(24, H * (.3 + R() * .12));
    let y = L.h, ins = 0;
    const n = 3 + Math.floor(R() * 3);
    for (let k = 0; k < n && ins < w / 2 - 6; k++) {
      ins += 2.5 + R() * 1.5; y += (H - L.h) / n * (k === 0 ? 1.4 : .85 + R() * .3);
      L.tiers.push({ i: ins, y: Math.min(y, H), st: 2 });
    }
    if (w / 2 - ins > 5) L.crown = { i: ins, y: L.tiers.at(-1).y, kind: Math.floor(R() * 3), spire: R() < .6 ? 18 + R() * 45 : 0 };
  }
  L.htop = Math.max(L.h, ...L.tiers.map(t => t.y)) + (L.crown ? 14 + L.crown.spire : 0);
}
function isleLots(b) {
  const R = isleRnd, kind = ISLE_KIND[b.isle];
  const bx0 = b.x0 + SW, bx1 = b.x1 - SW, bz0 = b.z0 + SW, bz1 = b.z1 - SW, mid = (bz0 + bz1) / 2;
  colliders.push(b.col = { x0: bx0, x1: bx1, z0: bz0, z1: bz1 });
  const r = R(), whole = kind === 'fin' ? .5 : kind === 'bpc' ? .45 : .08, half = kind === 'fin' ? .35 : kind === 'bpc' ? .35 : .22;
  const put = (x0, x1, z0, z1, face, axis, tower, back) => {
    const L = { x0, x1, z0, z1, face, axis, special: null, b, seed: R() * 1000, rng: R, isle: b.isle, back: back ? 1 : 0 };
    if (tower) isleTower(L, R, kind);
    else {   // 廠房樓：鑄鐵立面（石）或磚，五到十二層
      L.style = R() < .45 ? 2 : 0; L.fh = L.style === 2 ? 3.9 : 3.4;
      const fl = kind === 'loft' ? 5 + Math.floor(R() * 8) : 8 + Math.floor(R() * 10);
      L.h = 4.6 + fl * L.fh + .7;
      if (fl > 9 && R() < .5) { L.tiers = [{ i: 2.5, y: L.h + 2 * L.fh, st: L.style }]; }
      L.htop = Math.max(L.h, ...(L.tiers || []).map(t => t.y));
    }
    lots.push(L);
    return L;
  };
  if (r < whole) put(bx0, bx1, bz0, bz1, R() < .5 ? 1 : -1, 'z', true);
  else if (r < whole + half) { put(bx0, bx1, bz0, mid, -1, 'z', true); put(bx0, bx1, mid, bz1, 1, 'z', R() < .6); }
  else for (const [z0, z1, face] of [[bz0, mid, -1], [mid, bz1, 1]]) {
    let a = bx0;
    while (a < bx1 - .01) {
      let w = 8 + R() * 10;
      if (bx1 - (a + w) < 7) w = bx1 - a;
      put(a, a + w, z0, z1, face, 'z', kind !== 'loft' && w > 15 && R() < .4);
      a += w;
    }
  }
}
blocks.forEach(b => b.isle ? isleLots(b) : makeLots(b));   // 外圍的樓牆（outer）已經拿掉：片外圍到外緣之間是草地，北面與東面的外面是山
// 天樞島的地標大樓（28-isle-lm.js 載入 tools/isle-glb.mjs 的模型）：這幾塊地不蓋程式立面與塔冠（L.glb），模型下載好之後 27-bldfoot.js 照模型的外形換掉街區的盒。
// half：0 整塊街區、1 南半（z0 側）、2 北半；h 是模型的高（屋頂高度用）。以檔案開啟不下載模型，照舊蓋程式的塔
const ISLE_LM = [
  { id: 'owtc', i: 114, j: 5, half: 0, w: 35.32, d: 35.5, h: 296.34 },
  { id: 'wtc3', i: 115, j: 5, half: 0, w: 44, d: 32.84, h: 147.56 },
  { id: 'exch20', i: 115, j: 7, half: 0, w: 45, d: 34.25, h: 148.2 },
  { id: 'whitehall', i: 116, j: 8, half: 2, w: 45, d: 17.85, h: 68.4 },
];
if (/^https?:$/.test(location.protocol)) for (const o of ISLE_LM) {
  const L = lots.find(L => L.isle && L.b.i === o.i && L.b.j === o.j && (o.half ? L.z1 - L.z0 < 25 && (o.half === 1) === (L.z0 - L.b.z0 < SW + 1) : L.z1 - L.z0 > 30));
  if (!L || L.x1 - L.x0 < o.w || L.z1 - L.z0 < o.d) { console.warn('天樞島地標：找不到放得下的地塊 ' + o.id); continue; }
  const b = L.b;
  o.L = L; L.glb = { set: 'isle', id: o.id, lots: [L], blk: b, x: (L.x0 + L.x1) / 2, z: (L.z0 + L.z1) / 2, ry: L.face > 0 ? 0 : Math.PI, s: 1 };
  o.h0 = L.h; L.h = L.htop = o.h; L.tiers = null; L.crown = null;   // h0：下載失敗時補回的程式立面用原本的底座高
  b.col.blk = b; (b.ents || (b.ents = [])).push(L.glb);
}
// 地塊所在的區（立面、陰影高度圖、直升機的屋頂高度都照這個）
for (const L of lots) if (L.zn === undefined) L.zn = zoneAtL((L.x0 + L.x1) / 2, (L.z0 + L.z1) / 2);
// 岸邊的擋牆：沿每塊地的邊每 2 m 看外側是不是水（岬角也算陸地），連續的一段變成一個 4 m 厚的盒（low：不擋相機與子彈）
const landL = (x, z) => inLand(x, z) || inCity(...toW(x, z));
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
      const swim = r === LANDS[0] && fixed === r.z1 ? 1 : 0;   // LANDS[0] 是 BEACH 往內陸延伸的副本（不是 BEACH 本身）
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

// ─── 外緣（05-zones.js 的 CITY_POLY，世界座標）───
// 臨水的邊：4 m 厚的低擋牆（low），外面是沙灘、碼頭這些矩形的那幾段不擋；沿岸每 260 m 一座梯子（擋牆在那裡留 2.2 m 的 swim 缺口）。
// 靠山的邊：一道看不見的高牆。SHORE 是把外緣在擋牆的頭尾切開之後的多邊形，wet[k] 標出臨水的邊（21-coast.js 沿這些邊裝欄杆、
// 路燈、護岸，鋪碎石步道，和以前的岬角同一套）
// 天樞島的水道兩岸（LAKE_SHORES：島岸與對岸，05-zones.js 的 ISLE_P、LAKE_P）也用同一套：out 是陸地在多邊形外面（對岸），
// 每條邊都看外側（水那一側）是不是水，橋頭（06-roads.js 的 BRIDGES 上是陸地）自動斷開
function shoreRing(P, out, gate) {
  const n = P.length, sg = (polyArea(P) > 0 ? 1 : -1) * (out ? -1 : 1), pts = [], wet = [];
  let lad = 130;
  for (let k = 0; k < n; k++) {
    const p = P[k], q = P[(k + 1) % n], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (L < .01) continue;
    const ux = (q[0] - p[0]) / L, uz = (q[1] - p[1]) / L, ox = uz * sg, oz = -ux * sg, f = frameW(p[0], p[1], ux, uz), zo = ox * f.s + oz * f.c > 0 ? 1 : -1;   // zo：往外是局部 +z 還是 −z
    const box = (a, b, extra) => colliders.push({ x0: a, x1: b, z0: zo > 0 ? 0 : -4, z1: zo > 0 ? 4 : 0, zn: f, ...extra });
    if (gate && !gate(k)) { box(-3, L + 3, { edge: 1 }); pts.push(p); wet.push(0); continue; }
    // 每 2 m 看外面 0.6 m 是不是水，連續的水邊一段擋牆
    const N = Math.max(1, Math.round(L / 2)), at = t => [p[0] + ux * t, p[1] + uz * t], isWet = [];
    for (let i = 0; i <= N; i++) { const [x, z] = at(L * i / N); isWet.push(!landW(x + ox * .6, z + oz * .6)); }
    let i = 0;
    pts.push(p); wet.push(isWet[0] && isWet[1] ? 1 : 0);
    while (i < N) {
      const w = isWet[i] && isWet[i + 1];
      let j = i + 1; while (j < N && (isWet[j] && isWet[j + 1]) === w) j++;
      const a = L * i / N, b = L * j / N;
      if (j < N) { pts.push(at(b)); wet.push(isWet[j] && isWet[j + 1] ? 1 : 0); }
      if (w) {
        let c = a - .6;
        for (let t = a; t < b; t += 2) {   // 梯子
          lad -= Math.min(2, b - t);
          if (lad > 0 || t - a < 3 || b - t < 3) continue;
          const [x, z] = at(t); LADDERS.push({ x, z, nx: ox, nz: oz, w: 1, ok: 1 }); lad = 260;
          box(c, t - 1.1, { low: 1 }); box(t - 1.1, t + 1.1, { low: 1, swim: 1 }); c = t + 1.1;
        }
        box(c, b + .6, { low: 1 });
      }
      i = j;
    }
  }
  const S = { name: '', pts, wet, caps: [], out: out ? 1 : 0 }, o = out ? -1 : 1;
  const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  S.bb = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  S.inn = polyInset(pts, wet.map(w => w ? 6 * o : 0));
  S.walk = [1, 3.4].map(d => polyInset(pts, wet.map(w => w ? d * o : 0)));
  return S;
}
const SHORE = shoreRing(CITY_POLY, 0, shoreEdge);
const LAKE_SHORES = [shoreRing(ISLE_P, 0), shoreRing(LAKE_P, 1)];
// 岸邊的物件迴圈（21-coast.js 的欄杆、護岸、路燈、長椅，下面的碎石步道）：陸地那一側的方向（多邊形裡面 = 1，對岸 = −1）
const shoreSide = h => (polyArea(h.pts) > 0 ? 1 : -1) * (h.out ? -1 : 1);
const shoreLand = (h, x, z) => inPoly(h.pts, x, z) !== !!h.out;

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
      if (row[i].special || row[i].glb || row[i].isle) continue;   // 天樞島的地塊排在最後，跳過不抽 rb
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
      bldPlace.push({ set, id: b.id, ...P, s, h: b.h * s, lots: span, blk: row[i].b, row: 1 });   // row：沿街的一排，27-props.js 下載後照模型的牆面對齊街面（bldAlign）
      for (const L of span) L.glb = bldPlace.at(-1);
      i = best.j;
    }
  }
}
// 斜的大道穿過的街區改成廣場（06-roads.js 的 PLAZA）：地塊照樣生成（亂數序列不變），原地塊留著當 ghost 只照原本的寬度抽 rnd()
// （立面迴圈與 20-props.js 的窗台設施），不蓋樓；換成模型的整組拿掉（那幾塊原本就不抽 rnd，標 2 直接跳過）。街區中間的碰撞盒拿掉，人行道板在下面沿大道切開
for (const b of blocks) {
  if (b.outer || !PLAZA.has(b.i + ',' + b.j)) continue;
  b.plaza = PLAZA.get(b.i + ',' + b.j);
  if (b.col) colliders.splice(colliders.indexOf(b.col), 1);
  for (const L of lots) if (L.b === b) {
    if (L.glb) { const k = bldPlace.indexOf(L.glb); if (k >= 0) bldPlace.splice(k, 1); L.glb = null; L.ghost = 2; }
    else L.ghost = 1;
  }
}
// 第五部曲的設施街區（69-v5-civic.js）：中城的聖瑪格麗特醫院、舊碼頭的第九分局與拖吊場。地塊照樣生成（亂數序列不變），
// 原本的地塊和廣場一樣當 ghost、實體建築拿掉，換成設施自己的地塊（自己的亂數 L.rng，20-props.js 的窗台設施也用它）；
// 街區的碰撞盒換成每棟樓自己的，帶屋頂高度 hy（站上屋頂的人不被擋）。座標相對於街區的西北角（avX(i)、stZ(j)），人行道內是 12.5–59.5 × 12.5–49.5
const FAC = (() => {
  const S = {
    // 急診樓（2 層，面向西邊的大道；以 http(s) 開啟時換成 artfletch 掃描的紅磚舊院區正面 v5hosp，模型中心擺在 (19.65, 31)）＋主樓（8 層，屋頂停機坪）
    hosp: { i: 4, j: 1, lots: [{ x0: 12.5, x1: 28, z0: 12.5, z1: 49.5, style: 8, floors: 2, axis: 'x', face: -1, er: 1, glb: ['v5hosp', 'front', 19.65, 31] }, { x0: 28, x1: 59.5, z0: 12.5, z1: 49.5, style: 8, floors: 8, axis: 'x', face: -1, back: 1, roof: 1 }] },
    // 分局：北半是 katiewolfe 掃描的紅磚老分局（v5pd，以 http(s) 開啟時換模型，面向東邊的大道），南半是 4 層的附樓（屋頂停機坪、南牆逃生梯）；西邊是圍起來的拖吊場
    pd: { i: 0, j: 4, lots: [{ x0: 37.5, x1: 59.5, z0: 12.5, z1: 32, style: 0, floors: 4, axis: 'x', face: 1, glb: ['v5pd', 'pd'] }, { x0: 37.5, x1: 59.5, z0: 32, z1: 49.5, style: 0, floors: 4, axis: 'x', face: 1, roof: 1 }],
      yard: { x0: 12.5, x1: 36.5, z0: 12.5, z1: 49.5 } },
    // 楓林里的商店街（69-v5-shops.js）：槍店（店面往後退，騎樓下是櫃台）與後面的露天射擊場、服飾店（樓房往後退，前面是一層樓的店面）、停車場、東側的洗車隧道（南北穿過街區）
    mall: { i: 3, j: 7, lots: [{ x0: 12.5, x1: 30, z0: 15.5, z1: 25, style: 4, floors: 1, axis: 'z', face: -1 }, { x0: 31, x1: 44, z0: 20.3, z1: 27, style: 2, floors: 2, axis: 'z', face: -1 }],
      range: { x0: 12.5, x1: 30, z0: 25, z1: 49.5 }, lot: { x0: 31, x1: 46, z0: 27, z1: 49.5 }, wash: { x0: 47, x1: 55, z0: 18, z1: 42 } },
    // 公園大道 (8,8) 的五層立體停車場（69-v5-garage.js）：沒有地塊，整塊人行道內是停車場；東邊隔著大道是燈籠公園，頂樓的特技跳台往東飛進公園
    gar: { i: 8, j: 8, lots: [], gar: { x0: 13, x1: 59, z0: 13, z1: 49 }, lv: 3.6, n: 4, roof: .15 + 4 * 3.6 },   // 層高 3.6 m，頂樓是第 4 層樓板（地面 0.15）
    // 中城 (4,3) 的霓峰塔工地（69-v5-tower.js）：沒有地塊，西半是蓋到 202 m 的框架大樓（tower），東邊是 250 m 的塔吊（mast 是桅桿中心），四周圍施工圍籬
    crane: { i: 4, j: 3, lots: [], tower: { x0: 14.2, x1: 37.3, z0: 13.3, z1: 38.2 }, mast: [47, 26] },
    // 第七部曲（69-v7-casino.js）：光環廣場 (8,4) 的霓鑽賭場酒店：西北、東北兩座塔樓，南半是 2 層的裙樓（大門朝南，屋頂是 RF 泳池與停機坪）
    // 以 http(s) 開啟時兩座塔樓換成 VertaScan 的雙圓弧塔連同它的基座（props/cas_ext.glb，46.8 × 22.3 m、高 120 m）一棟，佔滿北半（到 z 34.8），
    // 裙樓（永遠是程式建模、最後一塊地）往南縮；屋頂的泳池、停機坪與通風井在 69-v7-casino.js 跟著挪（CAS_G）
    casino: { i: 8, j: 4, lots: BLD_ON && PROPS_SPEC.cas_ext ? [{ x0: 12.5, x1: 59.5, z0: 12.5, z1: 34.8, style: 3, floors: 38, axis: 'z', face: 1, back: 1, glb: ['cas_ext', 'tower'] },
      { x0: 12.5, x1: 59.5, z0: 34.8, z1: 49.5, style: 3, floors: 2, axis: 'z', face: 1, roof: 1 }]
      : [{ x0: 12.5, x1: 30, z0: 12.5, z1: 30, style: 3, floors: 42, axis: 'z', face: 1, back: 1 }, { x0: 42, x1: 59.5, z0: 12.5, z1: 30, style: 3, floors: 36, axis: 'z', face: 1, back: 1 },
      { x0: 12.5, x1: 59.5, z0: 30, z1: 49.5, style: 3, floors: 2, axis: 'z', face: 1, roof: 1 }] },
    // 69-v7-bunker.js：灰石國宅北端 (15,0) 的霓虹堡軍事基地、隔壁 (16,0) 北嶺山腳的地堡土丘，兩塊都沒有地塊（(17,0) 以東的北排沒有街區）
    fort: { i: 15, j: 0, lots: [] },
    bunker: { i: 16, j: 0, lots: [] },
  };
  for (const [id, F] of Object.entries(S)) {
    const b = blocks.find(o => !o.outer && o.i === F.i && o.j === F.j);
    if (!b) { delete S[id]; continue; }
    F.b = b; F.ax = avX(F.i); F.az = stZ(F.j); F.zn = zoneAtL(F.ax + P / 2, F.az + Q / 2);
    if (b.col) colliders.splice(colliders.indexOf(b.col), 1);
    for (const L of lots) if (L.b === b) {
      if (L.glb) { const k = bldPlace.indexOf(L.glb); if (k >= 0) bldPlace.splice(k, 1); L.glb = null; L.ghost = 2; }
      else L.ghost = 1;
    }
    const R = rng(911 + F.i * 31 + F.j);
    F.L = F.lots.map(o => {
      const fh = o.style === 2 || o.style === 8 ? 3.4 : 3.1, h = 4.6 + o.floors * fh + .7;
      const L = { x0: F.ax + o.x0, x1: F.ax + o.x1, z0: F.az + o.z0, z1: F.az + o.z1, h, style: o.style, seed: R() * 1000, face: o.face, axis: o.axis, special: 'fac', fh, b, rng: R, back: o.back ? 1 : 0, fac: id, o };
      L.zn = zoneAtL((L.x0 + L.x1) / 2, (L.z0 + L.z1) / 2);
      lots.push(L);
      colliders.push(L.col = { x0: L.x0, x1: L.x1, z0: L.z0, z1: L.z1, hy: h - .05 });
      // 換成模型的設施樓（正面朝 +z 的模型轉成面向 face；glb[2..3] 是模型中心的設施座標，沒給就是地塊中心）：下載失敗由 lotFallback 補回程式立面
      const it = BLD_ON && o.glb && PROPS_SPEC[o.glb[0]] && PROPS_SPEC[o.glb[0]].items[o.glb[1]];
      if (it) {
        const [, , gx, gz] = o.glb;
        bldPlace.push(L.glb = { set: o.glb[0], id: o.glb[1], x: gx === undefined ? (L.x0 + L.x1) / 2 : F.ax + gx, z: gz === undefined ? (L.z0 + L.z1) / 2 : F.az + gz,
          ry: o.axis === 'x' ? o.face * Math.PI / 2 : o.face > 0 ? 0 : Math.PI, s: 1, h: it.h, lots: [L] });
        L.col.hy = Math.max(L.col.hy, it.h);
        L.glb.blk = b; L.col.blk = b; b.fac = 1; (b.ents || (b.ents = [])).push(L.glb);   // 27-bldfoot.js 照模型的外形換掉這塊地的盒（只換這塊，屋頂高度照舊）
      }
      return L;
    });
    for (const k of ['yard', 'range', 'lot', 'wash', 'gar', 'tower']) if (F[k]) F[k] = { x0: F.ax + F[k].x0, x1: F.ax + F[k].x1, z0: F.az + F[k].z0, z1: F.az + F[k].z1 };
  }
  return S;
})();
// 有實體建築的街區（設施街區除外）：街區的碰撞盒標上 blk，模型下載好之後 27-bldfoot.js 照模型的外形重算、換掉它（b.ents 是街區裡的模型）
for (const e of bldPlace) { const b = e.blk; if (!b || !b.col || !colliders.includes(b.col)) continue; b.col.blk = b; (b.ents || (b.ents = [])).push(e); }
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
      const e = { set: o.set, id: o.id, x: rot ? cx : x + o.w * s / 2, z: cz, ry: rot ? Math.PI / 2 : (bi + bj) % 2 ? Math.PI : 0, s, h: o.h * s, lots: k ? [] : mine, blk: b };
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
// 室內映射的房間（立面的窗與 26-glb.js 建築模型的亮窗共用）：o 是窗面上的點、vd 是往房間裡的視線（z 朝裡），dim 是房間大小
const ROOM_GL = /* glsl */`
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
    c = mix(vec3(.56,.52,.47), vec3(.47,.48,.49), fract(hs*13.)) * (.92 + .08*n2(hp.xy*2.));   // 低彩度的牆（米白、灰）
    c *= mix(.55, 1., step(.035, bw.y));                                                         // 踢腳板
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
    else c = kind > .5 ? vec3(.3,.3,.31) * (.9 + .1*step(.5, fract(hp.x*1.7))) : vec3(.33,.25,.18) * (.82 + .18*h21(vec2(floor(hp.x / .16), hs)));   // 地毯、木地板（一條條地板）
  } else c = mix(vec3(.56,.52,.47), vec3(.47,.48,.49), fract(hs*13.)) * .8 * mix(.55, 1., step(.035, hp.y / dim.y));
  float ld = length(hp - vec3(dim.x*.5, dim.y*.92, dim.z*.45));
  c *= lc * (.45 + 1.3 / (1. + ld*ld*.5));
  return c * mix(1., .55, hp.z / dim.z);
}`.slice(1);
const FACADE_FS = /* glsl */`
${GL_LIB}
varying vec3 vW, vN; varying vec2 vUv; varying vec4 vB, vB2;
uniform highp sampler2DArray uFacA, uFacN; uniform vec4 uFac;   // 08-tex.js 的照片材質（uFac.x 底色、y 法線）
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
// 玻璃映出的對街（白天）：反射線往外走一條街寬（18 m）撞到對面的樓，高度照 seed 抽 9–25 m；
// 撞到的話畫對面的磚牆與窗格（受天光與斜射的太陽），沒撞到才是天空（envMap）
vec3 oppRefl(vec3 p, vec3 r, vec3 n, float seed){
  float t = 18. / max(dot(r, n), .06), hy = p.y + r.y * t, Ho = 9. + 16. * h21(vec2(seed, 5.3));
  vec3 env = envMap(r);
  if (hy > Ho || r.y < -.9) return env;
  vec3 q = p + r * t; vec2 w = vec2(dot(q.xz, vec2(-n.z, n.x)), hy);
  vec3 wc = mix(vec3(.2,.11,.08), vec3(.24,.22,.2), step(.5, h21(vec2(floor(w.x / 30.), seed))));
  float win = step(.3, fract(w.x / 2.5)) * step(fract(w.x / 2.5), .75) * step(.2, fract(w.y / 3.1)) * step(fract(w.y / 3.1), .78) * step(4.6, hy);
  vec3 c = wc * (uAmbTop * .9 + uSunCol * .35 * max(-uSun.x * n.x - uSun.z * n.z, 0.));
  c = mix(c, uSkyHor * .25 + vec3(.02), win);
  return mix(env, c * 1.4, smoothstep(Ho, Ho - .6, hy) * uDay);
}
// 室內映射：從窗面往房間裡射線，求出撞到後牆、側牆或天花板地板
${ROOM_GL}
// 店面室內：貨架、日光燈、地磚
vec3 shopRoom(vec3 o, vec3 vd, vec3 dim, float hs, float kind){   // kind：shopKind()，和 20-props.js 挑的招牌同一類；5 是 12-wearshops.js 挑中的服裝店
  vec3 inv = 1. / max(abs(vd), vec3(1e-4));
  float tx = (vd.x > 0. ? dim.x - o.x : o.x) * inv.x;
  float ty = (vd.y > 0. ? dim.y - o.y : o.y) * inv.y;
  float tz = (dim.z - o.z) * inv.z;
  float t = min(tx, min(ty, tz));
  vec3 hp = o + vd * t;
  // 燈色照真的店：日光燈冷白、小吃店暖白、遊樂場偏紫的暗光；彩度都壓低，櫥窗裡才不會是一塊塊純色
  vec3 lc = kind == 5. ? vec3(1.,.93,.82) : kind == 2. ? vec3(1.,.82,.62) : kind == 3. ? vec3(.66,.6,.86) : kind == 4. ? vec3(.9,1.,.95) : vec3(1.,.98,.94);
  vec3 c;
  if (t == tz || t == tx) {
    vec2 bw = t == tz ? hp.xy : vec2(hp.z, hp.y);
    float wn = .9 + .1*n2(bw*3. + hs*7.);
    c = vec3(.62,.6,.56) * wn;
    if (kind == 0. || kind == 4.) {          // 雜貨、藥局：層架（背板深色、層板前緣金屬、上一層板下的陰影），商品寬窄高矮不一、幾種包裝的低彩度色、偶爾一條價格標
      float row = floor(bw.y / .42), fy = fract(bw.y / .42);
      float cw = .08 + .17*h21(vec2(row, 3.7 + hs)), ci = floor(bw.x / cw), fx = fract(bw.x / cw);
      float r1 = h21(vec2(ci, row + hs*13.)), r2 = h21(vec2(ci + 7.1, row)), r3 = h21(vec2(ci, row + 2.3));
      vec3 pal = r1 < .3 ? vec3(.62,.58,.5) : r1 < .48 ? vec3(.52,.3,.24) : r1 < .62 ? vec3(.32,.4,.5) : r1 < .78 ? vec3(.76,.73,.64) : r1 < .9 ? vec3(.36,.45,.32) : vec3(.68,.55,.3);
      vec3 prod = pal * (.7 + .4*r2);
      float top = .3 + .5*r3;
      prod = mix(prod, vec3(.86,.84,.8), step(abs(fy - .16 - top*.5), .025) * step(.55, r2));
      vec3 sc = mix(vec3(.26,.25,.24), prod, step(.12, fy) * step(fy, top + .12) * step(.07, fx) * step(fx, .95));
      sc = mix(sc, vec3(.8,.8,.78), step(fy, .045));
      sc *= mix(1., .55, smoothstep(.7, 1., fy));
      c = mix(c, sc, step(.3, bw.y) * step(bw.y, 2.1));
      c = mix(c, vec3(.42,.4,.38), step(2.1, bw.y) * step(bw.y, 2.22));
    } else if (kind == 1.) {                 // 洗衣店：一排滾筒機（白色機身、接縫、鍍鉻門圈、深色玻璃與反光），上面是淺色磁磚牆
      vec2 cell = vec2(fract(bw.x / .8) - .5, bw.y - .7);
      float r = length(cell);
      vec3 m = vec3(.8,.8,.77) * (1. - .35*step(.485, abs(cell.x)));
      m = mix(m, vec3(.62,.63,.64), smoothstep(.29, .27, r));
      m = mix(m, vec3(.1,.13,.16) + .25*smoothstep(.05, .0, abs(cell.x + cell.y*.6 + .08)) * step(r, .2), smoothstep(.235, .215, r));
      vec2 tl = fract(bw / .15);
      c = bw.y < 1.22 ? m : vec3(.74,.76,.75) * (.88 + .12*step(.06, min(tl.x, tl.y)));
    } else if (kind == 5.) {                 // 服裝店：上下兩層衣桿掛滿衣服（一件件窄的色條，下襬高低不齊、上深下淺），最上面一層板疊著摺好的衣服
      c = vec3(.74,.71,.66) * wn;
      for (int r = 0; r < 2; r++) {
        float ry = r == 0 ? 1.9 : 1.18, len = r == 0 ? .6 : .48, gw = .075 + .02*float(r);
        float gi = floor(bw.x / gw), gx = fract(bw.x / gw), g1 = h21(vec2(gi, float(r) + hs*9.)), g2 = h21(vec2(gi + 3.1, float(r) + hs));
        vec3 gc = .5 + .5*cos(6.28*(g1*.7 + hs*3. + vec3(0., .33, .67)));
        gc = mix(vec3(dot(gc, vec3(.33))), gc, .5) * (.25 + .55*g2);
        float bot = ry - len - .22*g2;
        c = mix(c, gc * mix(.7, 1., smoothstep(bot, ry, bw.y)), step(bot, bw.y) * step(bw.y, ry - .02) * step(.1, gx) * step(gx, .93));
        c = mix(c, vec3(.6,.6,.62), step(abs(bw.y - ry), .012));
      }
      float sy = bw.y - 2.3, fi = floor(bw.x / .36), fx = fract(bw.x / .36), fh = h21(vec2(fi, hs*5.));
      vec3 fc = (.5 + .5*cos(6.28*(fh + hs*3. + vec3(0., .33, .67)))) * .45 + .12;
      c = mix(c, fc * (.8 + .2*step(.5, fract(sy / .045))), step(0., sy) * step(sy, .1 + .12*fh) * step(.12, fx) * step(fx, .88));
      c = mix(c, vec3(.42,.4,.37), step(abs(sy), .015));
    } else if (kind == 2.) {                 // 小吃店：下半截深色木牆裙、上面奶油色牆、不鏽鋼櫃台邊、菜單燈箱（一行行字）
      c = bw.y < 1.0 ? vec3(.3,.21,.15) * (.85 + .15*step(.5, fract(bw.x*2.4))) : vec3(.72,.66,.56) * wn;
      c = mix(c, vec3(.7,.71,.72), step(abs(bw.y - 1.02), .03));
      float menu = step(1.7, bw.y) * step(bw.y, 2.3) * step(.15, fract(bw.x*.7));
      c = mix(c, vec3(1.15,1.05,.88) * (.78 + .22*step(.45, fract(bw.y*13.))) * (.85 + .15*step(.3, fract(bw.x*6.))), menu);
    } else {                                 // 電器、遊樂場：暗的牆、一格格螢幕（有邊框）；店裡的電視都播同一段示範影片（天空、地平線、移動的亮點），不是一格一色
      c = vec3(.1,.1,.12) * wn;
      vec2 g = vec2(fract(bw.x*1.6), fract(bw.y*1.4)), gi = floor(bw*vec2(1.6,1.4));
      vec2 q = vec2((g.x - .14) / .72, (g.y - .17) / .61);
      float tt = uTime * .15 + hs * 7.;
      vec3 sc = mix(mix(vec3(.2,.27,.16), vec3(.33,.36,.28), n2(q * 6. + tt)), mix(vec3(.5,.58,.72), vec3(.18,.3,.52), q.y), smoothstep(.38, .42, q.y + .05*sin(q.x*6. + tt)));
      sc += vec3(1.,.88,.66) * smoothstep(.14, .0, length(q - vec2(fract(tt * .3), .72)));
      sc *= (.8 + .15*h21(gi)) * (kind == 3. ? 1.1 : 1.3);
      float scr = step(.14, g.x)*step(g.x,.86)*step(.17,g.y)*step(g.y,.78)*step(.4, bw.y);
      c = mix(c, vec3(.05), step(.1, g.x)*step(g.x,.9)*step(.13,g.y)*step(g.y,.82)*step(.4, bw.y));
      c = mix(c, sc, scr);
    }
  } else if (vd.y > 0.) {                    // 天花板：礦纖板的格線、一排排日光燈
    vec2 tf = fract(hp.xz / .6);
    c = vec3(.58,.58,.56) * (.9 + .1*step(.04, min(tf.x, tf.y))) + step(.86, fract(hp.z / 1.1)) * step(.15, fract(hp.x / 1.6)) * 3.;
  } else {                                   // 地板：兩種相近色的塑膠地磚與磚縫（小吃店是低對比的黑白格）
    vec2 tl = floor(hp.xz / .45), tf = fract(hp.xz / .45);
    float ck = mod(tl.x + tl.y, 2.);
    c = kind == 5. ? vec3(.44,.32,.22) * (.82 + .18*h21(vec2(floor(hp.x / .16), floor(hp.z / 1.2 + fract(hp.x * 2.3)) + hs))) * (.85 + .15*step(.04, fract(hp.x / .16)))
      : kind == 2. ? mix(vec3(.56,.54,.5), vec3(.36,.34,.31), ck) : mix(vec3(.46,.45,.43), vec3(.4,.39,.37), ck * .7);
    c *= (.9 + .1*h21(tl + hs)) * (.82 + .18*step(.03, min(tf.x, tf.y)));
  }
  // 店員或客人的剪影
  float px = fract(hs*31.)*dim.x*.7 + dim.x*.15, pz = dim.z * (.35 + .4*fract(hs*11.));
  float tp = (pz - o.z) / max(vd.z, 1e-3);
  vec3 pp = o + vd * tp;
  // 人形：頭、肩、往下收的上身、兩條腿（中間有縫）；衣服顏色照 hs 抽，受店裡的燈
  float dx = abs(pp.x - px), py = pp.y;
  float body = step(length(vec2(dx, (py - 1.6) * .85)), .1)                                          // 頭
    + step(py, 1.47) * step(.92, py) * step(dx, mix(.15, .22, smoothstep(.92, 1.4, py)))              // 上身與肩
    + step(py, .95) * step(dx, .15) * step(.025, dx) + step(py, 1.5) * step(1.4, py) * step(dx, .05);  // 腿、脖子
  float person = clamp(body, 0., 1.) * step(tp, t) * step(.35, fract(hs*23.));
  vec3 cloth = .06 + .22 * (.5 + .5*cos(6.28*(fract(hs*53.) + vec3(0., .33, .67))));
  c = mix(c, mix(cloth, vec3(.05,.045,.05), step(py, .95) * .7 + step(1.5, py) * .5) * (.8 + .4*smoothstep(.9, 1.5, py)), person);
  return c * lc * mix(1.25, .7, hp.z / dim.z) * mix(.55, .5, uDay);   // 夜裡的曝光已經拉高，店裡和白天差不多亮就好（原本 1 會整片過曝成白色）
}
// 玻璃帷幕的鋁框：照樓選陽極鋁、黑框或古銅框，擦亮的面帶一點天空倒影
vec3 facMul(vec3 p, vec3 n, vec3 v, vec3 nW, float seed){
  float mk = fract(seed*5.3);
  vec3 a = mk < .45 ? L(vec3(.52,.54,.56)) : mk < .75 ? L(vec3(.08,.08,.09)) : L(vec3(.24,.19,.14));
  float F = .04 + .96*pow(1. - max(dot(n, v), 0.), 5.);
  return shade(p, nW, v, a * .75, .4, 0.) + envMap(reflect(-v, n)) * (a * .35 + F * .2);
}
// 視差的洞口：牆面上的點 p 在洞口 [a, b] 裡，視線 r（x 沿 u、y 往上、z 往牆裡）走 d 深到玻璃面。
// 打到玻璃回傳 (玻璃面上的點, 0, 1)；先碰到洞口四周的回傳 (p, 1 側面／2 上下面, 碰到的深度比例)
vec4 reveal(vec2 p, vec2 a, vec2 b, vec3 r, float d){
  vec2 q = p + r.xy / r.z * d;
  if (q.x > a.x && q.x < b.x && q.y > a.y && q.y < b.y) return vec4(q, 0., 1.);
  float dx = (r.x > 0. ? b.x - p.x : p.x - a.x) / max(abs(r.x), 1e-5) * r.z;
  float dy = (r.y > 0. ? b.y - p.y : p.y - a.y) / max(abs(r.y), 1e-5) * r.z;
  return dx < dy ? vec4(p, 1., dx / d) : vec4(p, 2., dy / d);
}
void main(){
  if (vW.y < uClipY) discard;
  vec3 n = normalize(vN);
  vec3 v = normalize(uCam - vW);
  float seed = vB.x, fw = vB.z, shop = vB.w;
  int st = int(vB.y + .5);
  float u = vUv.x, y = vW.y, H = vB2.z;
  bool solid = mod(floor(vB2.w * .5), 2.) > .5;   // 09-mass.js 的窗洞側面、凸窗側牆、壁柱側面：純牆，不畫窗、不當屋頂
  bool flatW = vB2.w < 3.5;                         // 平的牆（遠景、天樞島、11-isle 的填空樓、lotFallback）：洞口的深度用視差畫；細模真的凹進去的玻璃是 4 以上
  vec3 c;
  if (n.y > .5 && !solid) {                        // 屋頂：瀝青、積水
    float f = fbm(vW.xz*.5);
    vec3 alb = vec3(.035,.035,.04) * (.7 + .6*f);
    if (uFac.x > .5) {                             // 照片材質：龜裂的瀝青防水層（第 4 層，3 m 一張）
      vec2 q = vW.xz / 3.;
      alb = L(texture(uFacA, vec3(q, 4.)).rgb) * .6 * (.8 + .4*f);
      if (uFac.y > .5) { vec3 t = texture(uFacN, vec3(q, 4.)).rgb; n = normalize(n + vec3(t.r*2. - 1., 0., 1. - t.g*2.) * .8); }
    }
    float pud0 = smoothstep(.55, .65, fbm(vW.xz*.15 + seed)), pud = pud0 * smoothstep(.05, .6, uWet);   // 積水跟著雨走；乾的時候只剩低窪處較深的水漬
    alb *= 1. - .3*pud0*(1. - pud);
    c = shade(vW, n, v, alb, mix(.85, .1, pud), 0.);
    c += envMap(reflect(-v, n)) * pud * .35;
    gl_FragColor = vec4(applyFog(c, vW), 1.); return;
  }
  if (st == 9) {                                   // 騎樓（09-mass.js）：地坪是磨石子地磚、天花板是灰泥，每個店面單位中間一條橫跨的燈（燈下的地坪亮一塊）
    float uw = vB.z / max(vB2.y, 1.), du = abs((fract(u / uw) - .5) * uw);
    float lamp = uLampOn * (1. - .75*uDay);
    if (n.y > 0.) {
      vec2 tf = fract(vW.xz / .5);
      vec3 alb = L(vec3(.5,.48,.45)) * (.85 + .15*n2(vW.xz*3.)) * (.82 + .18*step(.03, min(tf.x, tf.y)));
      c = shade(vW, n, v, alb, .5, 0.) + alb * vec3(1.,.85,.65) * .9 * lamp * exp(-du*du*.25);
    } else {
      vec3 alb = L(vec3(.62,.6,.56)) * (.9 + .1*fbm(vec2(u, vW.x + vW.z)*.8));
      c = shade(vW, n, v, alb, .9, 0.) + alb * vec3(1.,.85,.65) * .35 * lamp * exp(-du*du*.15);
      c = mix(c, vec3(1.6,1.45,1.2) * (.3 + .7*lamp), step(du, .09));
    }
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
  // 磚：每塊的深淺與色偏、偶爾一塊換過的深色磚、偏灰的灰縫（遠處 bm 收斂成 .8）
  vec3 btint = mix(vec3(1.), vec3(1.07,.93,.84), h21(bid + 3.1)) * (1. - .42*step(.95, h21(bid*1.31 + seed)));
  vec3 mortar = L(vec3(.44,.41,.37)) * (.75 + .25*grime);
  if (st == 0) wall = mix(mortar, L(vec3(.48,.24,.17)) * mix(.72, 1.15, bv) * btint, bm);
  else if (st == 1) wall = mix(mortar, L(vec3(.42,.3,.22)) * mix(.74, 1.12, bv) * btint, bm);
  else if (st == 2) { wall = L(vec3(.55,.52,.47)) * (.85 + .15*fbm(vec2(u,y)*3.)); float bl = fract(y/.6); wall *= .8 + .2*smoothstep(0.,.04,bl); }
  else if (st == 3) wall = L(vec3(.22,.24,.27));
  else if (st == 4) wall = L(mix(vec3(.36,.5,.5), vec3(.55,.4,.44), fract(seed*7.))) * (.85 + .15*fbm(vec2(u,y)*2.));
  else if (st == 5) wall = L(vec3(.12,.11,.12)) * (.6 + .4*bm);
  else if (st == 8) { wall = L(vec3(.84,.86,.86)) * (.9 + .1*fbm(vec2(u,y)*2.)); float pj = step(fract(u/1.8), .025) + step(fract(y/1.7), .025); wall *= 1. - .22*clamp(pj, 0., 1.); }   // 醫院（69-v5-civic.js）：白色牆板
  else wall = L(vec3(.45,.2,.14)) * mix(.8, 1.1, bv) * (.55 + .45*bm);
  // 照片材質（08-tex.js）：磚、混凝土、灰泥換成照片，每塊地錯開貼圖的起點、深淺不同；翻新樓的灰泥上粉彩色。
  // 法線照面的水平方向（用螢幕導數判斷 u 往哪邊增加）與上方；玻璃帷幕、夜店、醫院照舊
  vec3 nW = n;
  if (uFac.x > .5 && st != 3 && st != 5 && st != 8) {
    float lay = st == 1 ? 1. : st == 2 ? 2. : st == 4 ? 3. : 0., sc = st == 1 ? 1.3 : st == 2 ? 4. : st == 4 ? 2. : 1.4;
    vec2 q = vec2(u, y) / sc + vec2(fract(seed*13.), fract(seed*29.));
    vec3 tint = st == 4 ? L(mix(vec3(.62,.86,.84), vec3(.95,.72,.74), fract(seed*7.))) * 1.25
              : st == 2 ? vec3(1.1) : vec3(.9 + .25*fract(seed*5.)) * (st == 1 ? vec3(.92,.86,.8) : vec3(1.));
    // 混凝土那張斑塊很重：往整張的平均色（最小一級 mipmap）收一半，免得看出重複
    vec3 tA = texture(uFacA, vec3(q, lay)).rgb;
    if (st == 2) tA = mix(textureLod(uFacA, vec3(q, lay), 10.).rgb, tA, .45);
    wall = L(tA) * tint;
    if (uFac.y > .5) {
      vec4 tn = texture(uFacN, vec3(q, lay));
      float sg = sign(dot(Tn, dFdx(vW))*dFdx(u) + dot(Tn, dFdy(vW))*dFdy(u) + 1e-6);
      nW = normalize(n + (Tn*sg*(tn.r*2. - 1.) + vec3(0., 1. - tn.g*2., 0.)) * 1.2);
      rough = mix(.6, 1., tn.b);
    }
  }
  wall *= 1. - .35*grime*smoothstep(H, 0., y*.6);
  // 做舊：整面的大塊褪色、女兒牆流下來的黑痕、轉角（和隔壁棟的交界）與牆腳的暗部、牆腳的泥水濺痕
  float edge = min(u, fw - u);
  float run = smoothstep(H - 6., H - .4, y) * smoothstep(.5, .78, n2(vec2(u*2.1 + seed*9., y*.09)));
  wall *= (.86 + .2*fbm(vec2(u, y)*.12 + seed)) * (1. - .4*run) * mix(.7, 1., smoothstep(0., 1.3, edge));
  wall *= 1. - .3*(1. - smoothstep(0., 1.5, y)) * (.5 + .5*n2(vec2(u*1.3, y*2.5)));
  wall *= mix(.6, 1., smoothstep(0., .9, y));       // 雨水打濕的牆腳
  float gH = 4.6;
  float fh = st == 3 ? 3.7 : st == 2 || st == 8 ? 3.4 : 3.1;
  float ws = st == 3 ? 1.6 : st == 2 || st == 8 ? 2.2 : 2.5;
  float nF = floor((H - gH - .7) / fh);
  float cols = max(1., floor((fw - 1.) / ws)); float mg = (fw - cols*ws) * .5;
  float cu = (u - mg) / ws; float ci = floor(cu);
  float fy = (y - gH) / fh; float fi = floor(fy);
  vec2 f = vec2(fract(cu), fract(fy));
  vec2 wmin = st == 3 ? vec2(.03,.06) : vec2(.27,.18), wmax = st == 3 ? vec2(.97,.96) : vec2(.73,.8);
  bool grid = !solid && ci >= 0. && ci < cols && fi >= 0. && fi < nF;
  bool inWin = grid && f.x > wmin.x && f.x < wmax.x && f.y > wmin.y && f.y < wmax.y;
  // 平的牆：視線穿過窗洞往裡走到玻璃面（深度和 09-mass.js 的細模一樣），先碰到的是窗洞兩側、窗楣底或窗台就畫那一面
  float sgU = sign(dot(Tn, dFdx(vW))*dFdx(u) + dot(Tn, dFdy(vW))*dFdy(u) + 1e-6);   // u 沿 Tn 的哪個方向增加
  vec3 rv = vec3(vd.x*sgU, vd.y, max(vd.z, 1e-3));
  if (inWin && flatW && st != 5) {
    float dR = st == 2 ? .3 : st == 4 ? .18 : st == 3 ? .12 : .22;
    vec4 h = reveal(vec2(u, y), vec2(mg + (ci + wmin.x)*ws, gH + (fi + wmin.y)*fh), vec2(mg + (ci + wmax.x)*ws, gH + (fi + wmax.y)*fh), rv, dR);
    if (h.z > .5) {
      vec3 nr = h.z < 1.5 ? -sign(rv.x)*sgU*Tn : vec3(0., -sign(rv.y), 0.);
      vec3 alb = st == 3 ? L(vec3(.2,.22,.25)) : h.z > 1.5 && rv.y < 0. ? L(vec3(.62,.58,.5)) * (.8 + .2*grime) : wall * .85;
      c = shade(vW - n*h.w*dR, nr, v, alb, .85, st == 3 ? .6 : 0.) * (1. - .4*h.w);
      gl_FragColor = vec4(applyFog(c, vW), 1.); return;
    }
    f = vec2(fract((h.x - mg) / ws), fract((h.y - gH) / fh));
  }
  // 地面層
  if (y < gH && !solid) {
    if (shop > .5 && st != 5) {
      float units = max(vB2.y, 1.); float uw = fw / units;
      float ui = floor(u / uw); float ux = fract(u / uw);
      float shut = mod(floor(vB2.x / exp2(ui)), 2.);
      float hs = h21(vec2(ui, seed));
      if (st == 6) { shut = 0.; }
      if (flatW && ux > .045 && ux < .955 && y < 3.42) {   // 平的牆：櫥窗和鐵捲門退 0.3 m（同細模），牆墩側面與招牌帶底面用視差畫
        vec4 h = reveal(vec2(u, y), vec2((ui + .045)*uw, -1.), vec2((ui + .955)*uw, 3.42), rv, .3);
        if (h.z > .5) {
          vec3 nr = h.z < 1.5 ? -sign(rv.x)*sgU*Tn : vec3(0., -1., 0.);
          c = shade(vW - n*h.w*.3, nr, v, h.z < 1.5 ? L(vec3(.3,.28,.26)) : L(vec3(.08,.08,.09)), .7, 0.) * (1. - .35*h.w);
          gl_FragColor = vec4(applyFog(c, vW), 1.); return;
        }
        u = h.x; y = h.y; ux = fract(u / uw);
      }
      if (ux < .045 || ux > .955 || y > 3.42) {
        vec3 alb = y > 3.42 ? L(vec3(.08,.08,.09)) : L(vec3(.3,.28,.26)) * (.8 + .3*fbm(vec2(u,y)*4.));
        if (st == 6) alb = L(vec3(.06,.16,.12));
        c = shade(vW, n, v, alb, .7, 0.);
      } else if (y < .42) {
        c = shade(vW, n, v, L(vec3(.13,.12,.12)), .4, 0.);
      } else if (shut > .5) {                        // 鐵捲門：橫向肋條、鏽斑與水痕、髒的下緣，一半的門有一塊噴漆字樣（黑色線條、低彩度的填色）
        float rib = .6 + .4*smoothstep(-.6, .6, sin(y*42.));
        float rust = fbm(vec2(u*1.3, y*.35) + hs*9.);
        vec3 alb = mix(L(vec3(.37,.38,.37)), L(vec3(.34,.27,.21)), smoothstep(.55, .8, rust) * .7) * rib;
        alb *= (1. - .3*smoothstep(.5, 0., y)) * (.9 + .1*n2(vec2(u*6., y*.4)));
        float tw = 1.4 + 1.2*fract(hs*7.), th = .6 + .4*fract(hs*11.);
        vec2 tc = vec2(ux*uw - .25*uw - .3*uw*fract(hs*5.), y - .9 - .5*fract(hs*3.));
        float msk = smoothstep(1., .6, length((tc - vec2(tw, th)*.5) / (vec2(tw, th)*.5))) * step(.45, fract(hs*17.));
        float g = fbm(tc*vec2(2.4, 3.2) + hs*20.);
        vec3 gc = L(.5 + .5*cos(6.28*(hs + vec3(0., .33, .67))));
        gc = mix(vec3(dot(gc, vec3(.33))), gc, .5) * .7;
        alb = mix(alb, gc, smoothstep(.5, .53, g) * msk * .85);
        alb = mix(alb, L(vec3(.04)), smoothstep(.025, .0, abs(g - .5)) * msk);
        c = shade(vW, n, v, alb, .5, .3);
      } else {
        vec3 dim = vec3(uw*.91, 3., 5.2);
        vec3 o = vec3((ux - .045) / .91 * dim.x, y - .42, 0.);
        float sk = mod(floor(seed)*7. + ui*13. + .5, 24.);   // 和 JS 的 shopKind() 同一條整數式（加 .5 避開除法誤差剛好落在整數上）
        vec3 inside = st == 6 ? room(o, vd, dim, hs, vec3(1.1,.6,.28)*1.4, 0.) : shopRoom(o, vd, dim, hs, mod(floor(vB2.x / exp2(ui + 16.)), 2.) > .5 ? 5. : sk < 8. ? 0. : sk < 9. ? 1. : sk < 15. ? 2. : sk < 19. ? 3. : 4.);   // 服裝店標在 masks 第 16 位以上
        float door = step(.7, ux) * step(ux, .86);
        float frame = max(step(abs(ux - .7), .008), step(abs(ux - .86), .008)) * step(y, 2.6) + step(abs(y - 2.6), .03) * door;
        frame += step(abs(y - 2.95), .025);
        float F = .06 + .94*pow(1. - max(dot(n, v), 0.), 5.);
        c = inside * .62 * (1. - F*.6) + oppRefl(vW, reflect(-v, n), n, seed + ui) * (F * .8 + .06*uDay);
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
      } else c = shade(vW, st == 3 ? n : nW, v, st == 3 ? L(vec3(.3,.31,.33)) : wall * .9, rough, 0.);
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
    vec3 lc = mix(vec3(1.,.76,.48), vec3(1.,.93,.8), hs2);   // 窗燈一律是自然的黃白光（暖黃到偏白），不用粉紅、藍色
    if (st == 5) lc = vec3(.9,.2,.6) * (.6 + .4*sin(uBeat*6.283));
    if (hs2 >= .92) lc *= .6 + .4*fract(sin(floor(uTime*5. + hs*20.))*91.);
    lc = lit ? lc * 1.5 : mix(lc * .025, vec3(.15,.15,.16) * (.6 + .8*hs2), uDay);   // 白天沒開燈的房間：看得到裡面，但比外牆暗得多
    vec3 dim = vec3(ws, fh, st == 3 ? 6. : 3.4);
    vec3 o = vec3(f.x*ws, f.y*fh, 0.);
    bool spand = st == 3 && f.y > .78 && fract(seed*7.7) < .7;   // 玻璃帷幕的背漆拱肩板：看不到裡面，不算室內
    vec3 inside = spand ? vec3(0.) : room(o, vd, dim, hs, lc, st == 3 ? 1. : 0.);
    vec2 wf = (f - wmin) / (wmax - wmin);
    float cur = fract(hs*41.);
    if (lit && cur < .3) {                              // 窗簾
      float cov = step(wf.x, .28 + .1*sin(hs*9.)) + step(.72, wf.x);
      inside = mix(inside, lc * L(vec3(.6,.45,.35)) * (.6 + .2*sin(wf.x*60.)), clamp(cov, 0., 1.));
    } else if (lit && cur < .5) {                       // 百葉窗
      inside = mix(inside, lc * .5 * (.5 + .5*step(.35, fract(wf.y*14.))), .8);
    } else if (!lit && uDay > 0. && cur > .55) {        // 白天：拉上的窗簾、放下一半的百葉、紗簾（受天光）
      vec3 dl = uAmbTop * .55 + uSunCol * .12 * max(dot(n, uSun), 0.);
      float k = fract(hs*67.);
      vec3 cc = L(mix(vec3(.78,.74,.66), mix(vec3(.62,.4,.32), vec3(.42,.5,.56), fract(hs*5.)), step(.5, k))) * dl;
      float cov = k < .35 ? 1. - step(abs(wf.x - .5), .06*fract(hs*9.))                              // 拉上的窗簾（中間留一條縫）
                : k < .7 ? step(.75 - .5*fract(hs*13.), wf.y) * (.75 + .25*step(.4, fract(wf.y*16.)))   // 放下一部分的捲簾
                : step(wf.x, .3) + step(.7, wf.x);                                                     // 拉到兩側的窗簾
      inside = mix(inside, cc * (.85 + .15*sin(wf.x*55.)), clamp(cov, 0., 1.) * uDay);
    }
    vec3 nG = normalize(n + Tn*(hs - .5)*.05 + vec3(0., (hs2 - .5)*.04, 0.));   // 每片玻璃有一點不平
    if (st == 3) {
      // 帷幕玻璃：每片中間微微鼓起（熱強化玻璃的枕狀變形，各片幅度不同），倒影在板與板之間錯開；
      // 鍍膜照樓選：藍綠反射、灰色低輻射、古銅反射（反射率 R0 與透過的色調），七成的樓在天花板以上到樓板是不透明的背漆拱肩板
      float gk = fract(seed*17.3), pa = .08 + .14*fract(hs*29.);
      vec2 sf = sin(f*3.1416), cf = cos(f*3.1416);
      nG = normalize(nG - (Tn*sgU*cf.x*sf.y + vec3(0., cf.y*sf.x, 0.)) * pa);
      vec3 gT = gk < .4 ? vec3(.55,.74,.76) : gk < .7 ? vec3(.72,.74,.76) : vec3(.8,.68,.52);
      float R0 = gk < .4 ? .22 : gk < .7 ? .11 : .32;
      float F = R0 + (1. - R0)*pow(1. - max(dot(nG, v), 0.), 5.);
      vec3 rc = oppRefl(vW, reflect(-v, nG), n, seed + fi*.37) * mix(vec3(1.), gT, .45);
      vec3 bk = spand ? shade(vW, n, v, gT * L(vec3(.07,.08,.09)), .5, 0.) : inside * gT;
      c = bk * (1. - F) + rc * (F + .03*uDay);
      c += shade(vW, nG, v, vec3(0.), .03, 0.) * .7;
    } else {
    float F = .05 + .95*pow(1. - max(dot(nG, v), 0.), 5.);
    vec3 rG = reflect(-v, nG);
    c = inside * (1. - F*.5) + oppRefl(vW, rG, n, seed + fi*.37) * (F*.7 + .04 + .1*uDay);
    c += shade(vW, n, v, vec3(0.), .04, 0.) * .6;
    }
    if (st == 3) { float mul = step(f.x, .035) + step(.965, f.x) + step(f.y, .07); c = mix(c, facMul(vW, n, v, nW, seed), clamp(mul, 0., 1.)); }
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
      alb = mix(alb, L(vec3(.62,.58,.5)) * (.8 + .2*grime), max(sill, lintel) * (st == 2 ? .5 : st == 8 ? .25 : 1.));
      float streak = smoothstep(.0, .5, wmin.y - f.y) * step(wmin.x, f.x) * step(f.x, wmax.x) * fbm(vec2(u*8., y*.5));
      alb *= 1. - streak * .4;
    }
    if (st == 3) {                                        // 玻璃帷幕的直框、橫框與樓板帶：鋁料（facMul）
      c = facMul(vW, n, v, nW, seed);
      if (y > H - 1.6 && mod(vB2.w, 2.) < .5) {   // 樓頂（與每段退縮）的女兒牆：白天是暗一點的鋁板，夜裡中間一條細的 LED 燈帶（原本整圈 1.6 m 的青／粉霓虹日夜都亮）
        vec3 led = mix(mix(vec3(.2,.9,1.), vec3(1.,.35,.6), step(fract(seed*3.), .5)), vec3(1.), .35);
        c = c * .75 + led * 1.8 * (1. - uDay) * step(abs(y - (H - .9)), .08);
        gl_FragColor = vec4(applyFog(c, vW), 1.); return;
      }
    } else
    c = shade(vW, nW, v, alb, rr, 0.);
    if (st == 4) {                                        // 翻新的霓虹樓：樓板 LED 線
      float band = step(abs(f.y - .02), .018) * step(0., fi) * step(fi, nF);
      vec3 bc = mix(vec3(.15,1.,.9), vec3(1.,.2,.6), step(.5, fract(seed*11.)));
      c = mix(c, c * .55, band * uDay) + bc * band * 2.4 * (.7 + .3*sin(uTime*2. + u*.6)) * (1. - uDay);   // 夜裡才亮；白天是一條暗的鋁槽
    }
  }
  gl_FragColor = vec4(applyFog(c, vW), 1.);
}`;
const MAT_FACADE = new T.ShaderMaterial({ name: 'facade', uniforms: shared(ALLU), vertexShader: FACADE_VS, fragmentShader: FACADE_FS });

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
function boxFaces(B, x0, x1, z0, z1, y0, y1, seed, style, shopFaces, h, masks, roof = true, flag = 0) {   // flag（aB2.w）：1 = 天樞島，玻璃樓頂不畫霓虹燈帶；加 2 是 09-mass.js 的 solid 面
  const faces = [
    { n: [0, 0, 1], a: [x0, y0, z1], b: [x1, y0, z1], w: x1 - x0, key: 'pz' },
    { n: [0, 0, -1], a: [x1, y0, z0], b: [x0, y0, z0], w: x1 - x0, key: 'nz' },
    { n: [1, 0, 0], a: [x1, y0, z1], b: [x1, y0, z0], w: z1 - z0, key: 'px' },
    { n: [-1, 0, 0], a: [x0, y0, z0], b: [x0, y0, z1], w: z1 - z0, key: 'nx' },
  ];
  for (const f of faces) {
    const shop = shopFaces && shopFaces[f.key] ? 1 : 0;
    const m = masks && masks[f.key] || [0, 1];
    quad(B, f.a, f.b, [f.b[0], y1, f.b[2]], [f.a[0], y1, f.a[2]], f.n, 0, f.w, [seed, style, f.w, shop], [m[0], m[1], h, flag]);
  }
  if (roof) quad(B, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], 0, x1 - x0, [seed, style, x1 - x0, 0], [0, 1, h, 0]);
}
// 一個地塊：立面與量體（09-mass.js 的 lotGeo；det 是細模），加上簷口、腰線、高樓退縮頂與天樞島的退台（遠近一樣）
const facBlk = new Map();   // 街區 key → { lots, zn, far（遠景網格）, det（細模，走近才建） }
function lotAll(B, L, det) {
  lotGeo(B, L, det);
  // 簷口（磚樓、石樓）：三段往外出挑的線腳（帶狀板、托線、挑簷），一樓頂的腰線兩段；地塊的輪廓往外推 o
  if (L.style !== 3) {
    const y = L.h, ring = (o, y0, y1) => boxFaces(B, L.x0 - o, L.x1 + o, L.z0 - o, L.z1 + o, y0, y1, L.seed, 7, null, L.h, null);
    ring(.1, y - .62, y - .34); ring(.2, y - .34, y - .16); ring(.36, y - .16, y + .06);
    ring(.1, 4.42, 4.78); ring(.2, 4.56, 4.7);
  } else if (L.h2) {   // 高樓退縮頂
    const ix = (L.x1 - L.x0) * .18, iz = (L.z1 - L.z0) * .18;
    boxFaces(B, L.x0 + ix, L.x1 - ix, L.z0 + iz, L.z1 - iz, L.h, L.h2, L.seed + 1, 3, null, L.h2, null);
  }
  // 天樞島的退台：一層層往裡退的方塊，石樓每道退台邊上一圈簷口
  if (L.tiers) {
    let y0 = L.h;
    for (const [k, t] of L.tiers.entries()) {
      boxFaces(B, L.x0 + t.i, L.x1 - t.i, L.z0 + t.i, L.z1 - t.i, y0, t.y, L.seed + k + 1, t.st, null, t.y, null, true, 1);
      if (t.st !== 3) boxFaces(B, L.x0 + t.i - .3, L.x1 - t.i + .3, L.z0 + t.i - .3, L.z1 - t.i + .3, t.y - .45, t.y + .06, L.seed, 7, null, t.y, null);
      y0 = t.y;
    }
  }
}
const shopSigns = [];      // 之後由招牌模組使用：{x,z,nx,nz,w,unit}
const winSpots = [];       // 窗型冷氣、逃生梯
for (const L of lots) {
  if (L.glb || L.ghost === 2) continue;
  const R = L.rng || rnd;   // 自己有亂數的地塊（L.rng）用自己的；ghost 只抽 rnd、不蓋（見上面廣場那段）
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
        shopUnits.push({ x, z, nx: nrm[0], nz: nrm[1], w: uw, shut: (mask >> u) & 1, lot: L, special: L.special, kind: shopKind(L.seed, u), fk: k, u });   // fk、u：12-wearshops.js 回頭在 masks 上標服裝店
        if (k === 'pz' && aptDoorOn(x - uw / 2, x + uw / 2, z)) masks[k][0] |= 1 << u;
      }
    }
  }
  // 高樓退縮頂的亂數先抽（和以前一樣排在店面之後）
  const h2 = L.style === 3 && R() < .5 && L.h > 50 ? L.h + 8 + R() * 20 : 0;
  if (L.ghost) { if (L.style <= 2 && !L.back) winSpots.push(L); continue; }   // 20-props.js 的窗台設施也照原本的寬度抽亂數
  if (L.style === 3 && h2 && !L.tiers) L.h2 = h2;
  // 量體與立面（09-mass.js）：遠景先建（每街區一個網格），近處的細模由 facLod 串流
  L.fz = { shopF, masks, key };
  massPlan(L);
  lotAll(buf(key, zn), L, false);
  if (!facBlk.has(key)) facBlk.set(key, { lots: [], zn, far: null, det: null });
  facBlk.get(key).lots.push(L);
  if (L.style <= 2 && !L.back) winSpots.push(L);
}
for (let k = lots.length - 1; k >= 0; k--) if (lots[k].ghost) lots.splice(k, 1);   // ghost 只留在 winSpots 裡抽亂數
// 騎樓（09-mass.js 的 L.mass.arc）：街區的碰撞盒在有騎樓的那一面切成「往裡退 ARC_D 的主體」加上沒有騎樓那幾段的條，柱是圓柱
{
  const byB = new Map();
  for (const L of lots) if (L.mass && L.mass.arc) { if (!byB.has(L.b)) byB.set(L.b, []); byB.get(L.b).push(L); }
  for (const [b, list] of byB) {
    const R = b.col, i = colliders.indexOf(R);
    if (i < 0) continue;
    const core = { ...R }, out = [];
    for (const key of ['pz', 'nz', 'px', 'nx']) {
      const fl = list.filter(L => L.mass.front === key);
      if (!fl.length) continue;
      const alongX = key === 'pz' || key === 'nz', sp = fl.map(L => alongX ? [L.x0, L.x1] : [L.z0, L.z1]).sort((p, q) => p[0] - q[0]);
      const segs = []; let a = alongX ? R.x0 : R.z0;
      for (const [s0, s1] of sp) { if (s0 > a + .01) segs.push([a, s0]); a = Math.max(a, s1); }
      if ((alongX ? R.x1 : R.z1) > a + .01) segs.push([a, alongX ? R.x1 : R.z1]);
      for (const [s0, s1] of segs) out.push(key === 'pz' ? { x0: s0, x1: s1, z0: R.z1 - ARC_D, z1: R.z1 } : key === 'nz' ? { x0: s0, x1: s1, z0: R.z0, z1: R.z0 + ARC_D }
        : key === 'px' ? { x0: R.x1 - ARC_D, x1: R.x1, z0: s0, z1: s1 } : { x0: R.x0, x1: R.x0 + ARC_D, z0: s0, z1: s1 });
      if (key === 'pz') core.z1 -= ARC_D; else if (key === 'nz') core.z0 += ARC_D; else if (key === 'px') core.x1 -= ARC_D; else core.x0 += ARC_D;
    }
    if (R.blk) for (const o of out) o.blk = R.blk;   // 有實體建築的街區：27-bldfoot.js 下載後整組換掉（騎樓那段照 arcFoot 留空）
    colliders.splice(i, 1, core, ...out); b.col = core; b.arc = out;
    for (const L of list) {
      const F = facFace(L.mass.front, L.x0, L.x1, L.z0, L.z1);
      for (const [u0, u1] of arcCols(L, F.w)) { const [x, z] = facPt(F, (u0 + u1) / 2, -.25); circles.push({ x, z, r: .34 }); }
    }
  }
}
const cityChunks = [];
// 距離剔除：霧在 300 m 外已經看不到，城市放大到 20×15 之後，遠處的立面、實體建築與街道設施不畫（每幀依相機位置切換 visible）
const CULL_R = 420, cullList = [];
// 物件要先掛好（區的 Group 或 scene）：中心換成世界座標
const cullAdd = (obj, R = CULL_R) => {
  obj.geometry.computeBoundingSphere(); obj.updateWorldMatrix(true, false);
  const s = obj.geometry.boundingSphere, c = s.center.clone().applyMatrix4(obj.matrixWorld);
  const e = { obj, x: c.x, z: c.z, r: s.radius + R }; cullList.push(e); obj.userData.cull = e; return obj;   // userData.cull：會動的東西（21-coast.js 的貨櫃船）移動後用 cullSync 更新中心
};
function distCull(cx, cz) { const k = detailK() ** 2; for (const c of cullList) c.obj.visible = (c.x - cx) ** 2 + (c.z - cz) ** 2 < c.r * c.r * k; facLod(cx, cz); }   // SET.dist：Esc 選單的細節距離；facLod：近處換成立面細模
function chunkMesh(B) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(B.p, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(B.n, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(B.uv, 2));
  g.setAttribute('aB', new T.Float32BufferAttribute(B.b, 4));
  g.setAttribute('aB2', new T.Float32BufferAttribute(B.b2, 4));
  g.setIndex(B.idx);
  g.computeBoundingSphere();
  const m = new T.Mesh(g, MAT_FACADE); m.matrixAutoUpdate = false; m.userData.noTess = 1;
  cityAdd(m, B.zn === undefined ? zoneAtL(B.p[0], B.p[2]) : B.zn); cityChunks.push(m); cullAdd(m);
  return m;
}
for (const [key, B] of chunkBuf) { const m = chunkMesh(B); if (facBlk.has(key)) facBlk.get(key).far = m; }
// ─── 細模串流：鏡頭 SET.fac 公尺內（乘上細節距離）的街區建細模、藏起遠景網格；走遠 40 m 再丟掉細模 ───
// 一幀最多花 4 ms 建（近的先建）；__nc.fac.sync() 一次建完（截圖、驗收）
const facList = [...facBlk.values()].filter(e => e.far);
const fac = { built: 0, tris: 0, ms: 0 };
function facBuild(e) {
  const t = performance.now(), B = { p: [], n: [], uv: [], b: [], b2: [], idx: [], zn: e.zn };
  for (const L of e.lots) if (!L.glb) lotAll(B, L, true);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(B.p, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(B.n, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(B.uv, 2));
  g.setAttribute('aB', new T.Float32BufferAttribute(B.b, 4));
  g.setAttribute('aB2', new T.Float32BufferAttribute(B.b2, 4));
  g.setIndex(B.idx);
  const m = new T.Mesh(g, MAT_FACADE); m.matrixAutoUpdate = false; m.userData.noTess = 1;
  cityAdd(m, e.zn === undefined ? zoneAtL(B.p[0], B.p[2]) : e.zn);
  e.det = m; fac.built++; fac.tris += B.idx.length / 3; fac.ms += performance.now() - t;
}
function facDrop(e) { fac.tris -= e.det.geometry.index.count / 3; e.det.removeFromParent(); e.det.geometry.dispose(); e.det = null; fac.built--; }
function facLod(cx, cz, budget = 4) {
  const R = SET.fac * Math.min(1.2, detailK()), t0 = performance.now();
  let want = null;
  for (const e of facList) {
    const c = e.far.userData.cull, d = Math.hypot(c.x - cx, c.z - cz) - (c.r - CULL_R);
    e.d = d;
    if (e.det && (d > R + 40 || !R)) facDrop(e);
    if (!e.det && R && d < R && (!want || d < want.d)) want = e;
    if (e.det) { e.det.visible = e.far.visible; e.far.visible = false; }
  }
  // 近的先建；同一幀還有預算就繼續建下一個
  while (want && performance.now() - t0 < budget) {
    facBuild(want); want.det.visible = want.far.visible; want.far.visible = false;
    want = null;
    for (const e of facList) if (!e.det && R && e.d < R && (!want || e.d < want.d)) want = e;
  }
}

// 實體建築下載失敗：那幾塊地補回程式立面（沒有店面與招牌）
function lotFallback(list) {
  const B = { p: [], n: [], uv: [], b: [], b2: [], idx: [], zn: list.length ? list[0].zn : null };
  for (const L of list) { L.glb = null; boxFaces(B, L.x0, L.x1, L.z0, L.z1, 0, L.h, L.seed, L.style, null, L.h, null); }
  if (B.idx.length) chunkMesh(B);
}

// ─── 路面：一張大平面，標線、人孔、積水、雨滴漣漪與倒影都在 shader 裡 ───
const reflU = { tRefl: { value: null }, uReflMat: { value: new T.Matrix4() }, uReflOn: { value: 0 } };
// 地面網格烘焙到世界座標時（cityAdd）每個頂點記下 aL = (邏輯 x, 邏輯 z, 邏輯 x 軸在世界的方向)：vL 是邏輯 xz，標線、路緣、磁磚都用它算；
// vAx 用 nW() 把邏輯座標裡算出的法線擾動轉回世界
const GROUND_VS = /* glsl */`
uniform mat4 uReflMat;
attribute vec4 aL;
varying vec3 vW, vN; varying vec4 vRP; varying vec2 vL, vAx;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  vL = aL.xy; vAx = normalize((modelMatrix * vec4(aL.z, 0., aL.w, 0.)).xz);
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
uniform sampler2D uAsB, uAsN; uniform float uAsOn; uniform vec3 uAsM;
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
  // Full Gameready City 的柏油貼圖（27-props 下載好才開 uAsOn）：每 5.5 m 一格，亮度除以平均值當細節，法線疊在程式的起伏上
  vec2 asT = vec2(0.);
  if (uAsOn > .5) {
    vec2 tu = p / 5.5 + vec2(n2(p*.013), n2(p*.013 + 5.)) * .6;   // 加一點低頻位移，看不出格子
    alb *= mix(vec3(1.), texture2D(uAsB, tu).rgb / uAsM, .8);
    asT = texture2D(uAsN, tu).xy * 2. - 1.;
  }
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
  n.xz += vec2(asT.x, -asT.y) * .35 * (1. - pud) * (1. - paint*.5);
  float dist = length(vW - uCam);
  if (dist < 40.) n.xz += ripple(p, uTime) * .5 * (.3 + .7*pud) * (1. - dist/40.);
  n = normalize(nW(n));
  vec3 c = wetSurface(alb * mh, n, .8, pud, paint);
  gl_FragColor = vec4(applyFog(c, vW), 1.);
}`;
const WALK_FS = /* glsl */`
${GROUND_COMMON}
uniform highp sampler2DArray uFacA, uFacN; uniform vec4 uFac;   // 08-tex.js 的照片材質：第 2 層是混凝土（Concrete035）
// 混凝土的細節：照片（有的話）除以整張的平均色，只取明暗與顆粒，色調照舊由程式給；法線 xy 疊上去。沒有照片時用雜訊
vec4 walkTex(vec2 q){
  if (uFac.x < .5) return vec4(vec3(.85 + .3*fbm(q*2.)), 0.);
  vec3 t = texture(uFacA, vec3(q, 2.)).rgb, m = textureLod(uFacA, vec3(q, 2.), 10.).rgb;
  return vec4(mix(vec3(1.), (t*t) / max(m*m, vec3(1e-3)), .8), 1.);
}
void main(){
  vec3 n = normalize(vN);
  vec2 p = vL;
  vec3 c;
  float fwp = max(fwidth(p.x), fwidth(p.y)), kFine = clamp(.012 / max(fwp, 1e-4), 0., 1.);   // 遠處細節收掉（溝、口香糖、裂縫比一個像素細就不畫）
  if (n.y < .5) {                                         // 路緣石側面：混凝土，底下沾著路面的泥水
    vec4 dt = walkTex(vec2(p.x + p.y, vW.y) / 1.2);
    vec3 alb = vec3(.16,.155,.15) * dt.rgb * (.85 + .25*n2(p*3. + vW.y));
    c = shade(vW, n, normalize(uCam - vW), alb, .55, 0.);
  } else {
    vec2 tile = p / 1.5; vec2 tf = fract(tile); vec2 ti = floor(tile);
    float hs = h21(ti), hs2 = h21(ti + 17.), newSl = step(.9, h21(ti + 31.));   // 一成的板是後來補的新混凝土（較淺、較乾淨）
    // 每塊板錯開照片的起點，深淺與冷暖不同
    vec4 dt = walkTex(p / 2.5 + vec2(hs, hs2) * 7.);
    vec3 tone = mix(vec3(1.03,1.,.96), vec3(.95,.98,1.03), hs2) * (.82 + .3*hs);
    vec3 alb = vec3(.14,.135,.13) * tone * mix(dt.rgb, vec3(1.) + (dt.rgb - 1.)*.4, newSl) * mix(1., 1.3, newSl) * (.88 + .24*fbm(p*.8));
    // 鋸縫：6 mm 深溝、兩側 2 cm 斜角（法線往縫傾），髒污沿縫積成較寬的暗帶
    vec2 e = min(tf, 1. - tf) * 1.5; float ed = min(e.x, e.y);
    float groove = (1. - smoothstep(.003, .009, ed)) * kFine, dirtJ = 1. - smoothstep(.0, .07, ed);
    alb *= (1. - .5*groove) * (1. - .3*dirtJ*(1. - .5*newSl));
    vec3 nn = vec3(0, 1, 0);
    float bev = (1. - smoothstep(.006, .022, ed)) * kFine * .5;
    nn.xz += e.x < e.y ? vec2(tf.x < .5 ? -bev : bev, 0.) : vec2(0., tf.y < .5 ? -bev : bev);
    // 路緣石帶
    float X0=uCity.x, Z0=uCity.y, P=uCity.z, Q=uCity.w;
    float ia = floor((p.x - X0)/P + .5); float dx = abs(p.x - (X0 + ia*P));
    float js = floor((p.y - Z0)/Q + .5); float dz = abs(p.y - (Z0 + js*Q));
    float curb = max(step(dx, 8.35) * step(8., dx), step(dz, 8.35) * step(8., dz));
    // 裂縫：四分之一的板有一道帶抖動的斜裂
    float ca = hs2 * 6.2832; vec2 cd = vec2(-sin(ca), cos(ca));
    float dl = abs(dot(tf - .5 - (vec2(hs, h21(ti + 5.)) - .5) * .4, cd)) + (n2(tf*7. + hs*9.) - .5) * .05;
    float crack = step(.75, h21(ti + 9.)) * (1. - newSl) * (1. - smoothstep(.0015, .005, dl*1.5)) * smoothstep(.0, .12, ed) * kFine;
    alb *= 1. - .55*crack;
    // 口香糖：18 cm 一格，約 6% 的格子有一顆 1 cm 的黑點；靠路緣的一側多
    vec2 gq = p / .18, gi = floor(gq); float gh = h21(gi + 3.7);
    float cdist = min(abs(dx - 8.35), abs(dz - 8.35));
    vec2 go = vec2(h21(gi + 1.3), h21(gi + 8.9)) * .6 + .2;
    float gum = step(1. - .06*(1. + 1.2*(1. - smoothstep(.5, 3., cdist))), gh) * (1. - smoothstep(.008, .013, length(fract(gq) - go) * .18)) * kFine * (1. - curb);
    alb *= 1. - .55*gum;
    // 靠路緣的一側被車濺、行人踩得較髒
    alb *= 1. - .22*(1. - smoothstep(.0, 1.4, cdist)) * (.6 + .4*n2(p*1.7)) * (1. - curb);
    alb = mix(alb, vec3(.2,.19,.18) * dt.rgb * (.8 + .3*n2(p*6.)), curb);
    float stain = smoothstep(.5, .8, fbm(p*.25 + 3.));
    alb *= 1. - stain * .35;
    float pud = smoothstep(.62, .7, fbm(p*.2 + 11.) + dirtJ*.08) * (1. - curb);
    float dist = length(vW - uCam);
    if (dist < 30.) nn.xz += ripple(p, uTime + 3.) * .35 * pud * (1. - dist/30.);
    nn.xz += (vec2(hs, h21(ti + 4.)) - .5) * .04;
    if (uFac.y > .5 && dt.a > .5) { vec3 tn = texture(uFacN, vec3(p / 2.5 + vec2(hs, hs2) * 7., 2.)).rgb; nn.xz += vec2(tn.r*2. - 1., 1. - tn.g*2.) * .35 * (1. - pud) * kFine; }
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
  // 草色：大片的濃綠與曬黃、成叢的深色、細的草紋（遠處淡掉）、零星露土，彩度比純綠低（原本一整片均勻的螢光綠）
  float n3 = fbm(p*.06 + 3.), blade = n2(p*vec2(17., 23.)), bare = smoothstep(.7, .8, fbm(p*.22 + 11.));
  vec3 alb = mix(vec3(.034,.05,.02), vec3(.07,.064,.03), smoothstep(.42, .78, n3) * .8);
  alb = mix(alb, vec3(.018,.03,.013), smoothstep(.55, .8, n1) * .6) * (.78 + .44*fine);
  alb *= mix(1., .8 + .4*blade, 1. - smoothstep(.1, .4, fwidth(p.x * 17.)));
  alb = mix(alb, vec3(.06,.045,.03) * (.8 + .4*fine), bare * .65);
  float px = abs(fract((p.x - X0)/P) - .5)*P, pz = abs(fract((p.y - Z0)/Q) - .5)*Q;
  float path = max(smoothstep(1.9, 1.6, px), smoothstep(1.9, 1.6, pz));
  alb = mix(alb, vec3(.12,.11,.095) * (.8 + .4*h21(floor(p*9.))), path);
  float pud = smoothstep(.6, .7, fbm(p*.12 + 5.)) * (.4 + .6*path);
  vec3 c = wetSurface(alb, vec3(0., 1., 0.), mix(.3, .6, path), pud, 0.);
  gl_FragColor = vec4(applyFog(c, vW), 1.);
}`;
const ASPH_U = { uAsB: { value: null }, uAsN: { value: null }, uAsOn: { value: 0 }, uAsM: { value: new T.Vector3(1, 1, 1) } };   // 路面與連接道路共用
const MAT_ROAD = new T.ShaderMaterial({ name: 'road', uniforms: { ...shared(ALLU), ...reflU, ...ASPH_U }, vertexShader: GROUND_VS, fragmentShader: ROAD_FS });
const MAT_WALK = new T.ShaderMaterial({ name: 'walk', uniforms: { ...shared(ALLU), ...reflU }, vertexShader: GROUND_VS, fragmentShader: WALK_FS });
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
  // 路面：每片只鋪留下來的街區周圍（路中心線到路中心線一格；旁邊那格拿掉了或在別片，就鋪到那條路的外緣）。切成 12 m 的格子，彎曲才看得出來
  for (const zn of ZONES) {
    const pos = [], has = (i, j) => i >= zn.ni0 && i < zn.ni1 && j >= zn.nj0 && j < zn.nj1 && !cellDropped(i, j);
    for (let i = zn.ni0; i < zn.ni1; i++) for (let j = zn.nj0; j < zn.nj1; j++) {
      if (!has(i, j)) continue;
      const x0 = avX(i) - (has(i - 1, j) ? 0 : HR), x1 = avX(i + 1) + (has(i + 1, j) ? 0 : HR), z0 = stZ(j) - (has(i, j - 1) ? 0 : HR), z1 = stZ(j + 1) + (has(i, j + 1) ? 0 : HR);
      const nx = Math.ceil((x1 - x0) / WARP_SEG), nz = Math.ceil((z1 - z0) / WARP_SEG);
      for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
        const u0 = x0 + (x1 - x0) * a / nx, u1 = x0 + (x1 - x0) * (a + 1) / nx, v0 = z0 + (z1 - z0) * b / nz, v1 = z0 + (z1 - z0) * (b + 1) / nz;
        pos.push(u0, 0, v0, u0, 0, v1, u1, 0, v1, u0, 0, v0, u1, 0, v1, u1, 0, v0);
      }
    }
    if (!pos.length) continue;
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(pos.map((_, k) => k % 3 === 1 ? 1 : 0), 3));
    groundAdd(new T.Mesh(g, MAT_ROAD), zn);
  }
  // 人行道：每個街區一塊高 15 公分的板（建築就坐在上面）；每區合併成一個網格
  const parts = new Map();
  // 廣場（斜的大道穿過的街區）：人行道板沿大道兩側切成兩塊多邊形（離中心線 HR 以外），頂面與側面（路緣）自己建
  const half = (P0, ax, az, nx, nz, d) => {   // 留下 (p − a)·n ≥ d 的那一半（凸多邊形）
    const out = [], f = p => (p[0] - ax) * nx + (p[1] - az) * nz - d;
    for (let k = 0; k < P0.length; k++) {
      const p = P0[k], q = P0[(k + 1) % P0.length], fp = f(p), fq = f(q);
      if (fp >= 0) out.push(p);
      if ((fp >= 0) !== (fq >= 0)) { const t = fp / (fp - fq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
    return out;
  };
  const prism = (Pg, h) => {
    const pos = [], nor = [];
    if (polyArea(Pg) < 0) Pg = Pg.slice().reverse();   // 逆時針（x 往右、z 往下看是順時針，頂面法線朝上）
    for (let k = 1; k < Pg.length - 1; k++) for (const v of [Pg[0], Pg[k + 1], Pg[k]]) { pos.push(v[0], h, v[1]); nor.push(0, 1, 0); }
    for (let k = 0; k < Pg.length; k++) {
      const p = Pg[k], q = Pg[(k + 1) % Pg.length], ex = q[0] - p[0], ez = q[1] - p[1], l = Math.hypot(ex, ez) || 1, nx = ez / l, nz = -ex / l;
      for (const v of [[p, 0], [q, h], [q, 0], [p, 0], [p, h], [q, h]]) { pos.push(v[0][0], v[1], v[0][1]); nor.push(nx, 0, nz); }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    return g;
  };
  for (const b of blocks) if (b.plaza) {
    const p = b.plaza, rect = [[b.x0, b.z0], [b.x1, b.z0], [b.x1, b.z1], [b.x0, b.z1]], zn = zoneAtL((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
    for (const sg of [1, -1]) {
      const Pg = half(rect, p.ax, p.az, p.uz * sg, -p.ux * sg, HR);
      if (Pg.length < 3) continue;
      if (!parts.has(zn)) parts.set(zn, []);
      parts.get(zn).push(prism(Pg, .15));
    }
  }
  for (const b of blocks) for (const r of b.plaza ? [] : zoneClip(b.x0, b.x1, b.z0, b.z1)) {
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
  const lawnMat = new T.ShaderMaterial({ name: 'lawn', uniforms: { ...shared(ALLU), ...reflU }, vertexShader: GROUND_VS, fragmentShader: LAWN_FS }), lawns = new Map();
  for (const b of blocks.filter(b => b.park)) {
    const lg = new T.PlaneGeometry(b.x1 - b.x0 - 2 * SW, b.z1 - b.z0 - 2 * SW); lg.rotateX(-Math.PI / 2); lg.translate((b.x0 + b.x1) / 2, .152, (b.z0 + b.z1) / 2);
    const zn = zoneAtL((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
    if (!lawns.has(zn)) lawns.set(zn, []);
    lawns.get(zn).push(lg);
  }
  for (const [zn, list] of lawns) groundAdd(new T.Mesh(mergeGeometries(list), lawnMat), zn);
}
// ─── 片之間與片外圍到外緣的空地：草地與連接道路（06-roads.js 的 kind 'c'），幾何是世界座標、掛在 scene ───
// 草地鋪滿整個外緣（CITY_POLY）、比路面低一點，片的路面與人行道蓋在上面；連接道路從路口範圍（HR）外面鋪起，蓋過邊界路那一小段。
// 連接道路的 shader 是路面那一套，vL = (橫向, 沿路的距離)，大道的標線（中央雙黃線、車道虛線、人孔）照畫，沒有路口
{
  const seamMat = new T.ShaderMaterial({ name: 'lawnBare', uniforms: { ...shared(ALLU), ...reflU }, vertexShader: GROUND_VS, fragmentShader: LAWN_FS.replace(/float path = max\([^;]*\);/, 'float path = 0.;'),
    side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 });
  const pos = [], nor = [];
  // 岬角的草地也在這裡（同一個材質）；天樞島的水道在外緣裡挖掉（LAKE_P 是洞），島（ISLE_P）另外鋪
  for (const [P, H] of [[CITY_POLY, [LAKE_P]], [ISLE_P, []], ...CAPES.map(h => [h.pts, []])]) {
    const tri = T.ShapeUtils.triangulateShape(P.map(([x, z]) => new T.Vector2(x, z)), H.map(Q => Q.map(([x, z]) => new T.Vector2(x, z)))), V = [...P, ...H.flat()];
    for (const t of tri) for (const k of t) { pos.push(V[k][0], -.01, V[k][1]); nor.push(0, 1, 0); }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.computeBoundingSphere();
  groundAdd(new T.Mesh(g, seamMat), null);
  // 岬角沿水邊的碎石步道：草地 shader 的小徑顏色鋪滿，蓋在草地上
  const walkMat = new T.ShaderMaterial({ name: 'path', uniforms: { ...shared(ALLU), ...reflU }, vertexShader: GROUND_VS, fragmentShader: LAWN_FS.replace(/float path = max\([^;]*\);/, 'float path = 1.;'),
    side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const wp = [], wn = [];
  for (const h of [...CAPES, SHORE, ...LAKE_SHORES]) {   // 外緣臨水的邊、天樞島的水道兩岸也一樣
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
  const vs = GROUND_VS.replace('attribute vec4 aL;', 'attribute vec2 aUV, aAx;').replace('vL = aL.xy; vAx = normalize((modelMatrix * vec4(aL.z, 0., aL.w, 0.)).xz);', 'vL = aUV; vAx = aAx;');
  const fs = ROAD_FS.replace(/float ia = [^\n]*\n\s*float js = [^\n]*\n\s*bool onA = [^\n]*\n/, 'float dx = p.x, dz = 40.;\n  bool onA = true, onS = false;\n');
  if (vs === GROUND_VS || fs === ROAD_FS) throw new Error('connector shader patch failed');
  const connMat = new T.ShaderMaterial({ name: 'roadConn', uniforms: { ...shared(ALLU), ...reflU, ...ASPH_U }, vertexShader: vs, fragmentShader: fs, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  MAT.roadConn = connMat;   // 28-enclave.js 的城寨街道也用這一套（aUV 是橫向、沿路的公尺數）
  // 匝道是單向：不畫中央雙黃線與車道虛線，改成兩側的白色實線邊線
  const fsR = fs.replace(/float yel = [^;]*;/, 'float yel = 0.;').replace(/paint = max\(paint, step\(abs\(ax - 5\.1\), \.07\) \* step\(\.42, fract\(p\.y\*\.25\)\)\);/, `paint = max(paint, step(abs(ax - ${(RAMP_HW - .45).toFixed(2)}), .08));`);
  if (fsR === fs) throw new Error('ramp shader patch failed');
  const rampMat = new T.ShaderMaterial({ name: 'roadRamp', uniforms: { ...shared(ALLU), ...reflU, ...ASPH_U }, vertexShader: vs, fragmentShader: fsR, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  for (const ramp of [false, true]) {
  const P = [], N = [], UV = [], AX = [], I = [];
  for (const e of RN.edges) {
    if (e.kind !== 'c' && e.kind !== 'd' && e.kind !== 'f' || !!e.ramp !== ramp) continue;   // 連接道路、斜的大道與快速道路（06-roads.js）
    const u0 = HR - .4, u1 = e.len - HR + .4, n = Math.max(2, Math.ceil((u1 - u0) / 2.5)), base = P.length / 3;
    for (let k = 0; k <= n; k++) {
      const u = u0 + (u1 - u0) * k / n, [x, z] = edgeAt(e, u), [xa, za] = edgeAt(e, Math.max(0, u - 1.2)), [xb, zb] = edgeAt(e, Math.min(e.len, u + 1.2));
      const l = Math.hypot(xb - xa, zb - za) || 1, ax = (zb - za) / l, az = -(xb - xa) / l;   // 橫向：沿路方向轉成「邏輯 x 軸」那一側（和 nW() 的慣例一樣）
      const y = .004 + (e.kind === 'f' ? fwyH(e, u) : 0);   // 快速道路的上下坡與橋面（06-roads.js）
      const w = e.hw || HR;   // 匝道窄一點（06-roads.js 的 RAMP_HW）
      for (const s of [-1, 1]) { P.push(x + ax * w * s, y, z + az * w * s); N.push(0, 1, 0); UV.push(w * s, u); AX.push(ax, az); }
      if (k) I.push(base + 2 * k - 2, base + 2 * k - 1, base + 2 * k + 1, base + 2 * k - 2, base + 2 * k + 1, base + 2 * k);
    }
  }
  const cg = new T.BufferGeometry();
  cg.setAttribute('position', new T.Float32BufferAttribute(P, 3)); cg.setAttribute('normal', new T.Float32BufferAttribute(N, 3));
  cg.setAttribute('aUV', new T.Float32BufferAttribute(UV, 2)); cg.setAttribute('aAx', new T.Float32BufferAttribute(AX, 2));
  cg.setIndex(I); cg.computeBoundingSphere();
  groundAdd(new T.Mesh(cg, ramp ? rampMat : connMat), null);
  }
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
// 外海的島（光格島、鷹巖村）與機場的座標框 SEA_FR 在上面 landW 那裡（外緣的擋牆要先知道機場的堤道）
// 光格島（21-tron.js；遠景在 21-coast.js 的 FAR_SITES.tron）：SEA_FR 座標的島心（城東南的開闊海面，東面是山、北面是錨灣港外），模型座標（不轉）加上它就是 SEA_FR 座標，島面高 y。
// TRON_LAND 是 tools/walkgrid.mjs 量的陸地（模型座標、每格 res 公尺的遊程編碼，先取近景 isle_tron 的），pier 是北端那條路往北伸 28 m 的碼頭
const TRON_SITE = { x: 2100, z: 2900, y: SEA_Y + 1.6, zn: SEA_FR };
const TRON_LAND = (() => {
  const it = PROPS_SPEC.isle_tron?.items.tron || PROPS_SPEC.far_tron?.items.tron, L = it?.land; if (!L) return null;
  const a = new Uint8Array(L.nx * L.nz); let k = 0, v = 0;
  for (const r of L.rle.split(',')) { const n = parseInt(r, 36); a.fill(v, k, k + n); k += n; v ^= 1; }
  const d = it.dock;
  return { x0: L.x0, z0: L.z0, res: L.res, nx: L.nx, nz: L.nz, a, edges: it.edges || [], pier: d ? { x0: d[0] - 4, x1: d[0] + 4, z0: d[1] - 28, z1: d[1] + 1.5 } : null };
})();
// 模型座標的一點在不在島上（含碼頭）；世界座標版換到 C 區
const tronLandL = (x, z) => {
  const L = TRON_LAND; if (!L) return false;
  const P = L.pier; if (P && x >= P.x0 && x <= P.x1 && z >= P.z0 && z <= P.z1) return true;
  const i = Math.floor((x - L.x0) / L.res), j = Math.floor((z - L.z0) / L.res);
  return i >= 0 && j >= 0 && i < L.nx && j < L.nz && L.a[j * L.nx + i] === 1;
};
const tronLandW = (X, Z) => { if (!TRON_LAND) return false; const [x, z] = toL(X, Z, TRON_SITE.zn); return tronLandL(x - TRON_SITE.x, z - TRON_SITE.z); };
// 地面高度（邏輯座標）：人行道高 0.15；查格子，不逐一比對街區。世界座標的 groundH 在下面
const groundHL = (x, z) => {
  if ((x <= CITY_X0 || x >= CITY_X1 || z <= CITY_Z0 || z >= CITY_Z1) && !(x > 7900 && x < 8600)) {   // 天樞島（x ≥ 8000）照格子查
    for (const r of PIERS) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r.h;
    for (const r of FERRY) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r.h;
    for (const r of BANK_WALKS) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r.h;
    if (x >= BEACH.x0 && x <= BEACH.x1 && z > BEACH.z0) return -Math.min(1, (z - BEACH.z0) / BEACH.len) * BEACH.drop;   // 沙灘
    return 0;
  }
  const i = Math.floor((x - X0) / P), j = Math.floor((z - Z0) / Q);
  if (!gridCell(i, j)) return 0;
  return x > avX(i) + HR && x < avX(i + 1) - HR && z > stZ(j) + HR && z < stZ(j + 1) - HR && plazaD(x, z) >= HR ? .15 : 0;   // 廣場裡斜的大道是路面
};
// 執行時（玩家、車、行人、警察）用的是世界座標：先換回邏輯座標
// 片裡面照邏輯座標查；片之間的空地（外緣裡）高度 0；外緣外面換到最近那一片的邏輯座標（沙灘、碼頭、棧橋）
const groundH = (X, Z) => { const ph = parkGround(X, Z); if (ph !== null) return ph; const eh = encGround(X, Z); if (eh !== null) return eh; const zn = zoneAtW(X, Z); if (!zn && airLandW(X, Z)) return 0;   // 機場島：離片太遠，換到最近那片的邏輯座標會發散
  if (!zn && inCity(X, Z)) return 0; const [x, z] = zoneLocal(zn || zoneNearW(X, Z), X, Z); return groundHL(x, z); };
const onRoad = (X, Z) => groundH(X, Z) === 0;
const districtW = (X, Z) => {
  if (NPARK && NPARK.rail) { const [x, z] = parkL(X, Z), R = NPARK.rail; if (x > R.x0 && x < R.x1 && z > R.z0 && z < R.z1) return `${VIADUCT.name} North Ridge Viaduct`; }
  if (parkHas(X, Z)) return NPARK.name;
  if (tronLandW(X, Z)) return '光格島';
  if (encHas(X, Z)) return `${ENC.name} ${ENC.en}`;
  if (airLandW(X, Z) && !inCity(X, Z)) return AIR.name;
  if (nbrLandW(X, Z)) return '紐柏林賽道 Nürburgring';
  const zn = zoneOfW(X, Z); let [x, z] = toL(X, Z, zn);
  if (zn && inCity(X, Z)) { x = clamp(x, avX(zn.ni0), avX(zn.ni1)); z = clamp(z, stZ(zn.nj0), stZ(zn.nj1)); }   // 片之間的縫（快速道路）：算最近那片路網範圍裡的地名，不要外插到海邊的地名（離片遠時 unwarp 會發散）
  return district(x, z);
};
// ─── 外緣外面的地形（世界座標）：臨水那一側是 8 m 深的海；靠山那一側從外緣往外慢慢升高（21-coast.js 的山照這個建網格），
// 山和海交界的角度之間平滑過渡；舊城北邊河谷（RIVER_E 以西、FAR_Z1 以北）挖成河道，對岸（FAR_BANK_X 以西）壓在對岸的地面底下 ───
const LAKE_Y = -7;   // 天樞島水道的水底
const HILL = (() => {
  const P = CITY_POLY, n = P.length, [cx, cz] = CITY_C, R = P.map(p => Math.hypot(p[0] - cx, p[1] - cz));
  // 每個頂點靠山的程度（臨水 0、靠山 1），左右各平滑 5 個頂點（10°）
  const W = CITY_SHORE.map((_, k) => { let a = 0; for (let d = -5; d <= 5; d++) a += CITY_SHORE[(k + d + n) % n] ? 0 : 1; return a / 11; });
  return { cx, cz, R, W, n };
})();
// ─── 雲梯城寨（28-enclave.js；版面是 blender/enclave.py 寫的 assets/260/enclave/enclave.json，平台、街、地塊、樓、燈都是框座標）───
// 灰石國宅北端、霓虹堡 (15,0) 與地堡 (16,0) 之間那條大道往北出城，外緣外的山腳挖出一塊平台。框 ENC.f：原點是那條大道和第 0 條街的路口，
// 局部 x 沿街、z 和邏輯座標同向（往城裡為正，山上是 −z）。平台外 band 公尺內順著接回山的網格高度（encGround），21-coast.js 把碰到的山網格細分
ENC = (() => {
  const B = (i, j) => blocks.find(o => o.i === i && o.j === j && !o.outer), a = B(15, 0), b = B(16, 0);
  if (!a || !b) return null;
  const hr = (b.x0 - a.x1) / 2, x = (a.x1 + b.x0) / 2, z = b.z0 - hr, zn = zoneAtL(x, b.z0 + 1);
  const [ox, oz] = toW(x, z, zn), [ex, ez] = toW(x + 10, z, zn), f = frameW(ox, oz, ex - ox, ez - oz), S = ENC_SPEC, P = S.pad;
  const [cx, cz] = toW((P.x0 + P.x1) / 2, (P.z0 + P.z1) / 2, f);
  HILL.enc = Math.atan2(cz - HILL.cz, cx - HILL.cx);
  // 地面是 0 的地方：中庭、穿堂（含穿過人行道的那一段，車開得進去）；地塊其餘是人行道高 0.15
  const flat0 = [];
  for (const L of S.lots) {
    const c = L.court; flat0.push([c.x0, c.x1, c.z0, c.z1]);
    for (const p of L.passes) flat0.push(p.side === 's' ? [p.x0, p.x1, c.z1, L.z1] : p.side === 'n' ? [p.x0, p.x1, L.z0, c.z0] : p.side === 'w' ? [L.x0, c.x0, p.z0, p.z1] : [c.x1, L.x1, p.z0, p.z1]);
  }
  return { f, S, pad: P, band: 46, flat0, name: S.name, en: S.en };
})();
const encL = (X, Z) => toL(X, Z, ENC.f);
// 城寨的地面高度（世界座標）：平台上照地塊（外緣裡面不管，照城裡）；平台外 band 公尺內 smoothstep 接回山的網格高度；不在範圍裡回傳 null
function encGround(X, Z) {
  if (!ENC) return null;
  const [x, z] = encL(X, Z), P = ENC.pad, B = ENC.band;
  if (x < P.x0 - B || x > P.x1 + B || z < P.z0 - B || z > 90) return null;
  if (inCity(X, Z)) return null;
  const dx = Math.max(P.x0 - x, x - P.x1, 0), dz = Math.max(P.z0 - z, 0), d = Math.hypot(dx, dz);
  if (d > 0) { const t = Math.min(1, d / B); return hillMeshH(X, Z) * t * t * (3 - 2 * t); }
  return encFlatL(x, z);
}
function encFlatL(x, z) {   // 平台上（框座標）的地面：地塊 0.15，中庭與穿堂 0，街 0
  for (const r of ENC.flat0) if (x > r[0] && x < r[1] && z > r[2] && z < r[3]) return 0;
  for (const L of ENC.S.lots) if (x > L.x0 && x < L.x1 && z > L.z0 && z < L.z1) return .15;
  return 0;
}
// 世界座標的點在城寨裡（平台與外圍一圈，外緣外）；encNear 再往外 pad 公尺（山坡的路與住宅避開）
const encHas = (X, Z) => { if (!ENC) return false; const [x, z] = encL(X, Z), P = ENC.pad; return x > P.x0 - 8 && x < P.x1 + 8 && z > P.z0 - 8 && z < 90 && !inCity(X, Z); };
const encNear = (X, Z, pad = 90) => { if (!ENC) return false; const [x, z] = encL(X, Z), P = ENC.pad; return x > P.x0 - pad && x < P.x1 + pad && z > P.z0 - pad && z < 120; };
const hillAt = a => { const H = HILL, t = ((a + (ZONE_ROT || 0)) * 90 / Math.PI % H.n + H.n) % H.n, k = Math.floor(t), f = t - k, k1 = (k + 1) % H.n; return [H.R[k] * (1 - f) + H.R[k1] * f, H.W[k] * (1 - f) + H.W[k1] * f]; };
function hillH(X, Z) {
  if (inLake(X, Z)) return LAKE_Y;   // 天樞島的水道
  const a = Math.atan2(Z - HILL.cz, X - HILL.cx), [R, w] = hillAt(a), d = Math.max(0, Math.hypot(X - HILL.cx, Z - HILL.cz) - R);
  const n1 = .55 + .3 * Math.sin(a * 5 + 1.3) + .15 * Math.sin(a * 13 + .4), hd = dd => (1 - Math.exp(-dd / 320)) * (70 + 380 * n1) * (.85 + .15 * Math.sin(dd * .011 + a * 3)) + .3;
  // 北嶺公園那個方向（HILL.park，弳度）是一道緩一點的山谷：離外緣的距離打 0.45 折，左右約 ±9° 漸漸接回原本的坡
  const pa = HILL.park === undefined ? 0 : Math.exp(-(((((a - HILL.park + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) / .16) ** 2));
  let h = w <= 0 ? -8 : pa > .01 ? hd(d) * (1 - pa) + hd(d * .45) * pa : hd(d);
  // 雲梯城寨那個方向（HILL.enc）也緩一點：離外緣的距離打 0.55 折、左右約 ±14° 接回原本的坡（平台後面的切坡才不會上百公尺高）
  if (w > 0 && HILL.enc !== undefined) { const pe = Math.exp(-(((((a - HILL.enc + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) / .24) ** 2)); if (pe > .01) h = h * (1 - pe) + hd(d * .55) * pe; }
  // 離外緣 1000 m 外（外緣山林的稜線後面）是石柱峰的盆地：地面降到海面上 40–70 m（21-coast.js 擺石柱峰、蓋雲海），3100 m 外再升回雪山腳下
  // 緩丘（2026-10-28）：離外緣 30 m 起疊上三組不同走向的長波（約 240、150、90 m 一個起伏，振幅隨離外緣的距離加大，最多約 ±16 m），
  // 山坡不再是一整面平滑的坡；外緣與路口那一圈不動
  if (w > 0 && d > 30) {
    const k = sm01((d - 30) / 160) * (.55 + .45 * Math.min(1, d / 700));
    h += k * (8 * Math.sin(X * .0262 + Z * .0098 + 1.7) * Math.sin(Z * .0231 - X * .0071 + .3) + 5 * Math.sin(X * .041 - Z * .029 + 2.9) * Math.sin(Z * .037 + X * .017 + 4.1)
      + 3 * Math.sin(X * .069 + Z * .052) * Math.sin(Z * .073 - X * .044 + 1.1));
  }
  if (w > 0 && d > 1000) { const b = sm01((d - 1000) / 450) * (1 - sm01((d - 3100) / 500)); if (b > 0) h = h * (1 - b) + (SEA_Y + 55 + 15 * Math.sin(a * 7 + d * .004)) * b; }
  if (w > 0) h = akinaH(X, Z, h);   // 09-akina.js：北嶺公園西北的榛嶺（公園建好之前沒有）
  if (w > 0 && w < 1) h = -8 + (h + 8) * w * w * (3 - 2 * w);
  // 舊城北邊的河谷（A1 沒有轉，邏輯 ≈ 世界）
  const [lx, lz] = toL(X, Z, ZONES[0]);
  if (lz < FAR_Z1 + 40 && lx > FAR_BANK_X - 40 && lx < RIVER_E + 120) h = Math.min(h, lx < FAR_BANK_X ? -.6 : -8 + 8.3 * sm01((lx - RIVER_E - 10) / 110));
  else if (lx < FAR_BANK_X && lz < FAR_Z1) h = Math.min(h, -.6);
  return h;
}
// ─── 山坡的網格高度：21-coast.js 的山是 CITY_C 為中心的極座標網格（外緣每個頂點一條射線，往外 HILL_D 那幾圈），網格之間是平面三角形，
// 兩圈之間會比 hillH 低。站在坡上的東西（北嶺公園的步道、樹、圍籬、玩家）照網格的高度才會貼著畫出來的坡 ───
// 2026-10-28 加密：射線原本是外緣每個頂點一條（每 2°）、300 m 外一圈隔 120–300 m，外圈一格上百公尺，緩丘與山的起伏都畫不出來。
// 現在外緣每條直線邊上再插 HILL_SUB − 1 條射線（HILL.ray：x、z 是第 0 圈的點，R 是離 CITY_C 的距離），30 m 外的圈也加密
const HILL_D = [0, 3, 8, 16, 30, 45, 62, 82, 105, 130, 160, 195, 235, 280, 330, 390, 460, 540, 630, 730, 850, 1000, ...Array.from({ length: 80 }, (_, i) => 1030 + i * 30), 3500];   // 1000–3400 m 每 30 m 一圈：09-akina.js 的榛嶺在這一段（山道的挖方要細格子才不會凸到路上）
const HILL_SUB = 2;
HILL.ray = CITY_POLY.flatMap((p, k) => { const q = CITY_POLY[(k + 1) % CITY_POLY.length]; return Array.from({ length: HILL_SUB }, (_, i) => { const x = p[0] + (q[0] - p[0]) * i / HILL_SUB, z = p[1] + (q[1] - p[1]) * i / HILL_SUB; return { x, z, R: Math.hypot(x - HILL.cx, z - HILL.cz) }; }); });
const hillV = (k, j) => { const p = HILL.ray[k], s = (p.R + HILL_D[j]) / p.R; return [HILL.cx + (p.x - HILL.cx) * s, HILL.cz + (p.z - HILL.cz) * s]; };
// HILL.carveH（山路兩側的挖填，路生成之後才有）套在網格高度上；hillMeshRaw 是沒挖過的
function hillMeshH(X, Z) { const h = hillMeshRaw(X, Z); return HILL.carveH ? HILL.carveH(X, Z, h) : h; }
function triDist(P3, x, z) {   // 點到三角形（xz）的距離，在裡面是 0
  let inside = true, sg = 0, d = 1e9;
  for (let q = 0; q < 3; q++) {
    const [ax, az] = P3[q], [bx, bz] = P3[(q + 1) % 3], ex = bx - ax, ez = bz - az, cr = ex * (z - az) - ez * (x - ax);
    if (cr !== 0) { if (sg && Math.sign(cr) !== sg) inside = false; sg = sg || Math.sign(cr); }
    const t = clamp(((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1), 0, 1); d = Math.min(d, Math.hypot(x - ax - ex * t, z - az - ez * t));
  }
  return inside ? 0 : d;
}
function hillMeshRaw(X, Z) {
  const RY = HILL.ray, n = RY.length, m = HILL_D.length;
  if (!HILL.vh) { HILL.vh = new Float32Array(n * m); for (let k = 0; k < n; k++) for (let j = 0; j < m; j++) HILL.vh[k * m + j] = hillH(...hillV(k, j)); }
  const a0 = Math.atan2(RY[0].z - HILL.cz, RY[0].x - HILL.cx), a = Math.atan2(Z - HILL.cz, X - HILL.cx);
  const k0 = Math.floor((((a - a0) / (2 * Math.PI) * n) % n + n) % n), r = Math.hypot(X - HILL.cx, Z - HILL.cz);
  for (const k of [k0, (k0 + n - 1) % n, (k0 + 1) % n, (k0 + n - 2) % n, (k0 + 2) % n]) {   // 插的射線在直線邊上，角度不是完全等距：多看兩條
    const k1 = (k + 1) % n;
    for (let j = 0; j < m - 1; j++) {
      if (r < Math.min(RY[k].R, RY[k1].R) + HILL_D[j] - 40 || r > Math.max(RY[k].R, RY[k1].R) + HILL_D[j + 1] + 40) continue;
      // 和 21-coast.js 一樣的兩個三角形：(k, j) (k1, j) (k, j+1)；(k, j+1) (k1, j) (k1, j+1)
      for (const T3 of [[[k, j], [k1, j], [k, j + 1]], [[k, j + 1], [k1, j], [k1, j + 1]]]) {
        const [A, B, C] = T3.map(([kk, jj]) => hillV(kk, jj)), den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
        if (Math.abs(den) < 1e-9) continue;
        const u = ((B[1] - C[1]) * (X - C[0]) + (C[0] - B[0]) * (Z - C[1])) / den, v = ((C[1] - A[1]) * (X - C[0]) + (A[0] - C[0]) * (Z - C[1])) / den, w = 1 - u - v;
        if (u < -1e-6 || v < -1e-6 || w < -1e-6) continue;
        const [ha, hb, hc] = T3.map(([kk, jj]) => HILL.vh[kk * m + jj]);
        return akinaFine(X, Z, u * ha + v * hb + w * hc);   // 09-akina.js：榛嶺照細網格
      }
    }
  }
  return hillH(X, Z);
}
// ─── 北嶺公園（畫面在 21-park.js）：冠石北端外面的山坡，外緣上一道牌樓門，門外是一條之字形步道爬到山腰的觀景台 ───
// 公園有自己的座標框 NPARK.f（frameW）：原點是門（外緣上），局部 −z 朝山上（離開城市中心的方向），x 是橫向；下面的範圍與步道都是這個框的座標，
// parkW／parkL 換到世界座標與換回來。地面高度照山的網格（hillMeshH）；walk 是圍籬圈起來的範圍（前面沿著外緣，門口留一道 2·gw 寬的口，擺路樁擋車）
const parkW = (x, z) => { const [X, Z] = toW(x, z, NPARK.f); return { x: X, z: Z }; };
const parkL = (X, Z) => { const f = NPARK.f, dx = X - f.ox, dz = Z - f.oz; return [dx * f.c - dz * f.s, dx * f.s + dz * f.c]; };
const parkRawH = (x, z) => { const [X, Z] = toW(x, z, NPARK.f); return inCity(X, Z) ? 0 : hillMeshH(X, Z); };
// 山坡被鐵道橋的山溝、兩端的平台與隧道上的山頭改過之後的高度（VIADUCT 擺好之前就是原本的山坡）。walk：玩家站的高度（模型範圍裡貼著模型地面，不是畫面的 1.5 m 下面）
const parkH = (x, z) => viaCarve(x, z, parkRawH(x, z));
const parkWalkH = (x, z) => viaCarve(x, z, parkRawH(x, z), 1);
// 隧道上面沒挖溝的山坡（21-rail.js 的山頭蓋板照它蓋）
const parkLidH = (x, z) => viaCarve(x, z, parkRawH(x, z), 1, 1);
NPARK = (() => {
  const P = CITY_POLY, n = P.length, [tx, tz] = toW(avX(6) + 30, stZ(0), ZONES[1]);   // 冠石北端
  const cand = [];
  for (let k = 0; k < n; k++) {
    let ok = true; for (let d = -7; d <= 7; d++) if (HILL.W[(k + d + n) % n] < 1) ok = false;   // 左右 ±14° 都是山
    if (!ok) continue;
    const R = HILL.R[k], s = (R + 120) / R, h = hillH(HILL.cx + (P[k][0] - HILL.cx) * s, HILL.cz + (P[k][1] - HILL.cz) * s);
    cand.push({ k, d: Math.hypot(P[k][0] - tx, P[k][1] - tz), h: Math.round(h) });
  }
  const best = (cand.filter(c => c.d < 400).sort((a, b) => a.h - b.h)[0] || cand.sort((a, b) => a.d - b.d)[0]).k;   // 離冠石北端 400 m 內、山腳最緩的那一點
  HILL.park = Math.atan2(P[best][1] - HILL.cz, P[best][0] - HILL.cx);
  const [gx, gz] = P[best], ox = gx - HILL.cx, oz = gz - HILL.cz, ol = Math.hypot(ox, oz), f = frameW(gx, gz, -oz / ol, ox / ol);
  return { f, gx: 0, gw: 6, z1: 0, k: best, name: '北嶺公園 North Ridge Park' };
})();
HILL.vh = null;   // 09-akina.js 的榛嶺照公園的座標框擺，公園建好之前算過的網格高度作廢
{
  const W = (x, z) => toW(x, z, NPARK.f);
  // 外緣在局部 x 這一條線上的位置（局部 z，往山上是負）：從城裡往外找出城的那一點
  const edgeZ = x => { let a = 200, b = -160; for (let it = 0; it < 30; it++) { const m = (a + b) / 2; if (inCity(...W(x, m))) a = m; else b = m; } return (a + b) / 2; };
  NPARK.edgeZ = edgeZ;
  // 步道：出了門就左右來回走之字形（每一折橫過 140 m、往山上 26 m，坡度一成左右），爬到約 50 m 高或 9 折為止；Catmull-Rom 每 2 m 一點
  const C = [[0, 6], [0, -6]];
  for (let leg = 0, side = 1, z = -6; leg < 9; leg++, side = -side) {
    z -= 26; C.push([side * 70, z]);
    if (parkH(side * 70, z) > 50) break;
  }
  { const [lx, lz] = C[C.length - 1]; C.push([lx * .55, lz - 20]); }
  const out = [];
  for (let i = 0; i < C.length - 1; i++) {
    const p0 = C[Math.max(0, i - 1)], p1 = C[i], p2 = C[i + 1], p3 = C[Math.min(C.length - 1, i + 2)];
    const nn = Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 2);
    for (let k = 0; k < nn; k++) {
      const t = k / nn, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => .5 * (2 * p1[j] + (p2[j] - p0[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(C[C.length - 1]);
  NPARK.trail = out;
  // 觀景台（步道盡頭再往上 5 m）、管理站（門內側的山腳，步道西邊）、圍籬範圍、樹的範圍
  const [lx, lz] = out[out.length - 1], cx = lx, cz = lz - 5;
  let h = 0; for (const [dx, dz] of [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5], [0, 0]]) h = Math.max(h, parkH(cx + dx, cz + dz));
  NPARK.look = { x0: cx - 4.5, x1: cx + 4.5, z0: cz - 4.5, z1: cz + 4.5, h: h + .35, cx, cz };
  NPARK.walk = { x0: -100, x1: 100, z0: Math.min(cz - 30, ...out.map(p => p[1] - 25)), z1: 0 };
  NPARK.cabin = { x: -34, z: Math.min(edgeZ(-38), edgeZ(-30)) - 24 };
  NPARK.x0 = -280; NPARK.x1 = 280; NPARK.z0 = NPARK.walk.z0 - 180;
  NPARK.mid = parkW(0, (NPARK.walk.z0 + NPARK.walk.z1) / 2);
  // 門口：外緣靠山那一側的隱形高牆（SHORE 的 edge 牆，外緣的框座標）在兩根石柱之間開口
  const A = parkW(-NPARK.gw, edgeZ(-NPARK.gw)), B = parkW(NPARK.gw, edgeZ(NPARK.gw));
  for (const b of colliders.filter(b => b.edge)) {
    const f = b.zn, u = p => (p.x - f.ox) * f.c - (p.z - f.oz) * f.s, v = p => (p.x - f.ox) * f.s + (p.z - f.oz) * f.c;
    if (Math.abs(v(A)) > 8 || Math.abs(v(B)) > 8) continue;
    const g0 = Math.min(u(A), u(B)), g1 = Math.max(u(A), u(B));
    if (g1 < b.x0 || g0 > b.x1) continue;
    colliders.splice(colliders.indexOf(b), 1);
    if (g0 > b.x0) colliders.push({ ...b, x1: g0 });
    if (g1 < b.x1) colliders.push({ ...b, x0: g1 });
  }
}
// ─── 北嶺鐵道橋（World 第一輪的 railway 掃描：295×100 m，鋼梁高架橋跨過一條山溝，橋面在模型 y≈64）───
// 擺在觀景台北面約 200 m（公園框 NPARK.f 的座標、zn 就是這個框；模型的 x 沿著框的 x，橫過框中線那條往山上的山溝）；
// 步道圍籬往北圍進來（NPARK.rail），山溝底、橋面、兩端的平台與隧道都走得到。
// 模型自帶地形，props.mjs 的 hf 記下每格最低的高度、line 記下橋面中心線（z = c0 + c1·x + c2·x²，模型局部座標）與橋墩的佔地：
// 山坡在模型範圍裡貼到模型地面下 1.5 m（畫面；走的時候貼著模型地面），南北兩頭順著模型邊緣的溝底花 80 m 爬回山坡、東西兩頭 40 m。
// y：模型東西兩端的地面對齊山坡（取中位數），再抬到溝底高過海面（溝底低於 SEA_Y 會變成水）。
// 兩端：鐵軌出了模型順著切線直走，先是 A 公尺長、和橋面一樣高的平台（南側緩坡接步道），再進山裡的隧道（洞門在 o = A，洞長 BORE）。
// 洞口、隧道、平台上的軌道、燈與列車在 21-rail.js；模型由 27-world1.js 下載（以檔案開啟時是 21-rail.js 的程式替身），兩種開法地形都一樣（照洞口模型挖）。
// 21-coast.js 把山的網格碰到 NPARK.carve（挖過的範圍）的三角形細分，照 parkH 畫出來
VIADUCT = (() => {
  const it = PROPS_SPEC.far_rail?.items.rail, hf = it?.hf, ln = it?.line; if (!hf || !ln) return null;
  const { nx, nz, dx, dz } = hf, W = nx * dx, D = nz * dz, x = 0, z = Math.round(NPARK.look.cz - 200 - ln.c[0]);
  // 沒有頂點的格子（模型邊緣的缺口）用同一列最近的格子補；只有橋墩、沒有地面頂點的格子會突然高出幾十公尺，比周圍 3×3 的中位數高 6 m 以上就壓回中位數
  const y0 = hf.y.map((v, k) => {
    if (v != null) return v;
    const i = k % nx, j = (k - i) / nx;
    for (let r = 1; r < nx; r++) for (const ii of [i - r, i + r]) if (ii >= 0 && ii < nx && hf.y[j * nx + ii] != null) return hf.y[j * nx + ii];
    return 0;
  });
  const y = y0.map((v, k) => {
    const i = k % nx, j = (k - i) / nx, L = [];
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if (i + a >= 0 && i + a < nx && j + b >= 0 && j + b < nz) L.push(y0[(j + b) * nx + i + a]);
    L.sort((p, q) => p - q); const m = L[L.length >> 1];
    return v - m > 6 ? m : v;
  });
  const cell = (i, j) => y[clamp(j, 0, nz - 1) * nx + clamp(i, 0, nx - 1)];
  const at = (lx, lz) => {   // 模型局部座標（外框左下角起算）的地面高度，雙線性
    const u = clamp(lx / dx - .5, 0, nx - 1), v = clamp(lz / dz - .5, 0, nz - 1), i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j;
    return (cell(i, j) * (1 - a) + cell(i + 1, j) * a) * (1 - b) + (cell(i, j + 1) * (1 - a) + cell(i + 1, j + 1) * a) * b;
  };
  const d = [];
  for (let j = 0; j < nz; j++) for (const i of [0, 1, 2, nx - 3, nx - 2, nx - 1]) if (hf.y[j * nx + i] != null)
    d.push(parkRawH(x + hf.x0 + (i + .5) * dx, z + hf.z0 + (j + .5) * dz) - hf.y[j * nx + i]);
  d.sort((a, b) => a - b);
  const low = [...y].sort((a, b) => a - b)[Math.floor(y.length * .02)];
  const oy = Math.max(d[d.length >> 1], SEA_Y + 2.6 - low), deck = oy + ln.y;
  // 中心線（公園框的座標）：zc(x) 是那個 x 上鐵軌中心的 z
  const [c0, c1, c2] = ln.c, zc = X => z + c0 + c1 * (X - x) + c2 * (X - x) ** 2;
  // 兩端：p 是模型邊緣上的鐵軌中心，(ux, uz) 是往外（進山）的切線；s −1 西、+1 東
  const A = 24, BORE = 120;
  // 洞口（tools/props.mjs 的 w1_tunnel，21-rail.js 擺模型與替身）。東端的山坡約 1:1（洞口上方比切口高十幾公尺）、西端緩（拱洞那裡只高 6 m）：
  // 東端是岩壁上鑿出的 U 形切口（rock），切口前緣在 o = cut、洞口在 o = in，兩側岩壁內緣 |d| = cw、外緣 aw、頂在橋面上 top；
  // 洞口上方的陡坡往後削（洞口後 2 m 起每公尺升 ramp），削出的土面蓋三塊崖壁（cliffs）；沒有翼牆，切口兩側的土坡往橋那邊花 slope 公尺降到平台。
  // 西端是紅砂岩的拱形涵洞（arch），正面在 o = A、拱洞到 o = in，拱內 |d| = cw、淨高 ch，拱頂上的蓋板是填土（fill），兩側寬到 aw；
  // 翼牆從拱洞兩側（cut, ±(aw + 1)）斜到（cut − 12, ±(aw + 9)），頂從 wall[0] 降到 wall[1]，牆外填土。
  // side：洞口兩側的土至少填到這麼高；lid：隧道上山頭的平頂高度；都是橋面上多少
  const ends = [-1, 1].map(s => {
    const lx = s * W / 2, m = c1 + 2 * c2 * lx, l = Math.hypot(1, m);
    const port = s > 0 ? { kind: 'rock', cut: A - 4.4, in: A + 11, cw: 6.1, ch: 5, top: 20.3, aw: 9.5, side: 20.3, lid: 20, slope: 14, ramp: 5 }
      : { kind: 'arch', cut: A, in: A + 13, cw: 6, ch: 5.1, top: 9.1, fill: 6.4, aw: 9.2, side: 9.6, lid: 11, wall: [9.6, 2] };
    // 模型擺法（tools/props.mjs 量的）：模型的 (x, z) 擺到 o = o0 − z、d = d0 + x（正面朝橋），y 是橋面上多少；
    // 崖壁（cliff）的岩腳在模型 z ≈ 3.5、岩面幾乎垂直（頂在 z ≈ 0），22.6 m 高
    port.model = s > 0 ? { id: 'portal', o0: A + 6.5, d0: -1.4, y: -1.4 } : { id: 'arch', o0: A + 6.3, d0: 0, y: -.5 };
    port.cliffs = s > 0 ? [[port.in + 4.5, 0, 13.8, 0], [port.in + 4, 13, 13, .25], [port.in + 4, -13, 13, -.25]] : [];   // [o0, d, y, 轉角]
    return { x: x + lx, z: zc(x + lx), ux: s / l, uz: s * m / l, s, port };
  });
  const frame = (e, X, Z) => { const dx = X - e.x, dz = Z - e.z; return [dx * e.ux + dz * e.uz, dz * e.ux - dx * e.uz]; };   // [o 往外, d 往左]
  const piers = (ln.piers || []).map(([x0, x1, z0, z1]) => ({ x0: x + x0, x1: x + x1, z0: z + z0, z1: z + z1 }));
  return { x, z, y: oy, zn: NPARK.f, at, W, D, lx0: hf.x0, lz0: hf.z0, ends, deck, zc, frame, A, BORE, piers, name: '北嶺鐵道橋' };
})();
// 步道：控制點之間 Catmull-Rom，每 2 m 取一點（公園框的座標）
const parkSpline = C => {
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
};
NPARK.trails = [NPARK.trail];
// 北嶺鐵道橋那一段：圍籬往北圍到兩座隧道的山頭（rail），和原本的範圍合起來；fence 是圍籬靠山那幾段的折線（兩頭接到外緣，21-park.js 照它蓋）。
// 觀景台旁岔出三條：西、東兩條爬到兩端的平台（從平台南側的緩坡上去），一條之字形下到山溝底、從橋下穿過去
if (VIADUCT) {
  const V = VIADUCT, W = NPARK.walk, L = NPARK.look, [w, e] = V.ends, xs = V.ends.map(e => e.x + e.ux * (V.A + V.BORE));
  NPARK.rail = { x0: Math.floor(xs[0]) - 12, x1: Math.ceil(xs[1]) + 12, z0: Math.round(V.z + V.lz0 - 30), z1: W.z0 };
  const apr = (e, o, d) => [e.x + e.ux * o - e.uz * d, e.z + e.uz * o + e.ux * d];   // 端點座標系（o 往外、d 往左）的點
  const cx = L.cx, cz = L.z0, mz = (cz + V.z + V.lz0 + V.D) / 2;   // 觀景台後緣、觀景台到模型南緣的中間
  NPARK.trails.push(
    parkSpline([[cx - 3, cz], [cx - 30, cz - 16], [-90, W.z0 - 8], [-70, mz + 10], [-120, mz - 4], apr(w, 14, w.s * 66), apr(w, 12, w.s * 30), apr(w, 10, w.s * 6)]),
    parkSpline([[cx + 3, cz], [cx + 34, cz - 12], [70, W.z0 - 8], [56, mz + 10], [104, mz - 4], apr(e, 22, e.s * 70), apr(e, 14, e.s * 32), apr(e, 10, e.s * 6)]),
    parkSpline([[cx, cz], [cx + 10, cz - 24], [cx - 4, mz + 6], [cx + 14, mz - 10], [-8, V.z + V.lz0 + V.D - 4], [-4, V.z + 20], [0, V.z - 20]]),
  );
}
NPARK.inWalk = (x, z) => { const W = NPARK.walk, R = NPARK.rail; return x > W.x0 && x < W.x1 && z > W.z0 && z < W.z1 || !!R && x > R.x0 && x < R.x1 && z > R.z0 && z < R.z1; };
{
  const W = NPARK.walk, R = NPARK.rail;
  NPARK.fence = R ? [[W.x0, W.z0], [R.x0, W.z0], [R.x0, R.z0], [R.x1, R.z0], [R.x1, W.z0], [W.x1, W.z0]] : [[W.x0, W.z0], [W.x1, W.z0]];
}
// 挖過的範圍（公園框，4 m 取樣、各外擴 8 m）：21-coast.js 細分這一塊的山網格；公園的網格範圍（x0…z0）也撐到蓋得住它
if (VIADUCT) {
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let x = -400; x <= 400; x += 4) for (let z = 40; z >= -900; z -= 4) {
    const h = parkRawH(x, z);
    if (Math.abs(viaCarve(x, z, h) - h) < .02 && Math.abs(viaCarve(x, z, h, 1) - h) < .02) continue;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  NPARK.carve = { x0: x0 - 8, x1: x1 + 8, z0: z0 - 8, z1: z1 + 8 };
  NPARK.x0 = Math.min(NPARK.x0, NPARK.carve.x0 - 20); NPARK.x1 = Math.max(NPARK.x1, NPARK.carve.x1 + 20);
  NPARK.z0 = Math.min(NPARK.z0, NPARK.carve.z0 - 20, NPARK.rail.z0 - 40);
}
// 岩壁那一端洞口上方的斜坡上限（橋面上多少）：切口頂，洞口後 2 m 起每公尺升 ramp（藏在崖壁後面，很快就接回山坡）
function railRamp(P, o) { return VIADUCT.deck + P.top + P.ramp * Math.max(0, o - P.in - 2); }
function viaCarve(x, z, h, walk, lid) {
  const V = VIADUCT; if (!V) return h;
  const lx = x - V.x - V.lx0, lz = z - V.z - V.lz0, ex = Math.max(0, -lx, lx - V.W), ez = Math.max(0, -lz, lz - V.D);
  if (ex < 40 && ez < 80) {
    const w = (1 - sstep(0, 80, ez)) * (1 - sstep(0, 40, ex)), inn = Math.min(lx, V.W - lx, lz, V.D - lz);
    h += (V.at(lx, lz) + V.y - 1.5 * (walk ? 1 - sstep(0, 8, inn) : 1) - h) * w;   // 模型底下也墊高，從低處看不會透空
  }
  for (const e of V.ends) {
    const [o, d] = V.frame(e, x, z), ad = Math.abs(d); if (o < -30 || ad > 100) continue;
    // 平台：和橋面一樣高（低 0.25 m 的道碴），往橋那邊 22 m 降回山溝（橋端下的路堤），北側 12–34 m、南側 12–70 m 降回山坡（南側是上來的緩坡）
    const wl = 1 - sstep(12, d * e.ux > 0 ? 70 : 34, ad), wo = sstep(-23, -1, o);
    let g = h + (V.deck - .25 - h) * wl * wo;
    // 隧道上的山頭：洞口那一塊（|d| < 16）在洞口（port.in）之後才隆起（藏在洞口模型後面），兩側從洞口前緣前 14 m 起爬回山坡；過了洞底再慢慢降回山坡
    const P = e.port, top = V.deck + P.lid - .7 * Math.max(0, ad - 10) - .5 * Math.max(0, o - V.A - V.BORE - 5);
    const k = sstep(P.in - 1, P.in + 3, o) * (1 - sstep(16, 22, ad)) + sstep(P.cut - 14, P.cut + 4, o) * sstep(16, 22, ad);
    if (k > 0) g += (Math.max(top, h) - g) * k;
    // 洞口兩側（|d| > aw）：至少填到 side，往外每公尺降 0.4 m；有翼牆的從洞口前緣起，沒有的往橋那邊花 slope 公尺降回平台
    const ks = sstep(P.aw - .5, P.aw + 1, ad) * sstep(P.cut - (P.wall ? 1 : P.slope), P.cut + .5, o) * (1 - sstep(P.in + 2, P.in + 8, o));
    if (ks > 0) g = Math.max(g, g + (Math.max(h, V.deck + P.side - .4 * Math.max(0, ad - P.aw - 6)) - g) * ks);
    // 翼牆外側：牆外填到牆頂下 0.4 m，再往外每公尺降 0.5 m
    if (P.wall && o > P.cut - 20 && o < P.cut + 4 && ad > P.aw) {
      const t = clamp((P.cut - o) / 12, 0, 1), out = ad - (P.aw + 1 + 8 * t);
      if (out > 0) g = Math.max(g, V.deck + P.wall[0] + (P.wall[1] - P.wall[0]) * t - .4 - .5 * out - 1.2 * Math.max(0, P.cut - 12 - o));
    }
    // 岩壁那一端：洞口上方的陡坡往後削（railRamp），|d| < 22 以外慢慢接回山坡
    if (P.ramp && o > P.in - 2 && ad < 30) g = Math.min(g, g + (railRamp(P, o) - g) * (1 - sstep(22, 30, ad)));
    // 隧道經過的地方挖成一條溝（網格約 4 m 一格，溝要寬過洞壁 5.7 m 以上，山坡的三角形才不會穿進洞裡；洞口前的切口與拱洞裡只挖到 |d| = 8），
    // 上面蓋著 21-rail.js 的山頭蓋板（lid：蓋板照沒挖的山坡蓋）
    if (!lid && o > V.A - 1 && o < V.A + V.BORE + 1 && ad < (o < P.in ? 8 : 10)) g = Math.min(g, V.deck - .3);
    h = g;
  }
  return h;
}
// 世界座標的點在公園的範圍裡（圍籬裡、外緣外）；公園的地面高度（觀景台的平台、山坡），不在公園裡回傳 null
function parkHas(X, Z) {
  if (!NPARK) return false;
  const [x, z] = parkL(X, Z), W = NPARK.walk, R = NPARK.rail;
  return (x > W.x0 - 1 && x < W.x1 + 1 && z > W.z0 - 1 && z < 200 || !!R && x > R.x0 - 1 && x < R.x1 + 1 && z > R.z0 - 1 && z < R.z1 + 1) && !inCity(X, Z);
}
function parkGround(X, Z) {
  if (!NPARK) return null;
  const [x, z] = parkL(X, Z);
  if (x < NPARK.x0 || x > NPARK.x1 || z < NPARK.z0 || z > 200 || inCity(X, Z)) return null;
  const L = NPARK.look;
  return x >= L.x0 && x <= L.x1 && z >= L.z0 && z <= L.z1 ? L.h : parkWalkH(x, z);
}
// 山坡上的住宅：外緣靠山那一側（北面與東面）的山坡。照真的開發順序做：先從外緣開十幾條上山的蜿蜒道路（柏油、碎石路肩、中線、路燈），
// 再沿路兩側挖平台（石砌擋土牆、混凝土壓頂、草皮，車道從路緣接上來），最後把 blender/hill_homes.py 的六型住宅擺上平台、正面朝路
// （50-assets.js 載入模型後照 HILL_HOMES 做實例：低模全部畫、細模只畫相機附近的）。路面與平台都貼著畫出來的山網格（hillMeshH；外圈一格上百公尺，照 hillH 會浮在坡上）。
// 原本是 900 次隨機撒的平頂方盒，後來改成程式立面的方盒加屋頂，都太像玩具
const HILL_HOMES = [];
const HILL_GAR_W = 9;   // 路邊嵌進山坡的車庫的寬（29-villa.js 的碰撞與電梯照這個）
// 別墅型號（hill_homes.glb 的物件名）、核心佔地的包圍盒（遊戲座標：x0, x1, z0（正面、含前院花台）, z1（背面））、車道的 x、
// 要不要擺在路的下坡側（往 +z 懸挑的泳池、平台、鋼構：背面要朝山谷）、平台側邊要不要另加泳池平台。改了 hill_homes.py 要跟著改。
//   hm1 懸崖展館  hm2 板岩柱別墅  hm3 洞石刀片牆三層（正面車庫，路的上坡側也能蓋）  hm4 鋼構斜撐屋  hm5 地中海莊園（前庭噴水池）
const HOME_V = [
  ['hm1', -9.2, 9.6, -6.4, 5, 7, 1, 0], ['hm2', -9.2, 9.2, -7.6, 5, 0, 1, 0], ['hm3', -12.2, 9.8, -7.4, 6.8, 4.9, 0, 1],
  ['hm4', -10, 10, -5, 3, 0, 1, 0], ['hm5', -15.6, 15.6, -15.5, 5.6, 0, 0, 1],
];
const HILL_PLANTS = { palm: [], agave: [], shrub: [], shrub_bloom: [], rock: [] };   // 別墅區的植栽與岩石（世界座標；50-assets.js 做實例）
// 別墅區的山坡細分：21-coast.js 把每群別墅 R 公尺內碰到的山網格三角形另外細分（每個切成 N×N，N 固定，群與群之間的接邊才對得起來），
// 高度 h = 山網格 + 起伏 × w（w：路面兩側、平台四周是 0，離別墅 R 公尺淡到 0，所以細分區的外緣和沒細分的三角形接得上），材質是 TX.vhill（照片的乾草地與露岩）
const HILL_VIL = { R: 60, N: 9, groups: [] };   // N：粗網格加密以後從 14 降到 9（細分後的格距差不多）
// 外緣山林（27-props.js 下載 nat_forest 換成近景樹，50-assets.js 畫遠景的 fir_lo／maple_lo）：冷杉與楓樹、林下層的世界座標清單，n 是統計
const HILL_FOREST = { fir: [], maple: [], broad: [], pine: [], und: { fern: [], flower: [], grass: [] }, n: {} };   // und：林下層（27-props.js 只畫近處）
{
  const r2 = rng(77), [cx, cz] = CITY_C, rk = new Kit();
  // 從中心往 a 方向量到外緣的距離
  const edgeR = a => { const dx = Math.cos(a), dz = Math.sin(a); let best = 0; for (let k = 0; k < CITY_POLY.length; k++) { const p = CITY_POLY[k], q = CITY_POLY[(k + 1) % CITY_POLY.length], ex = q[0] - p[0], ez = q[1] - p[1], den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue; const t = ((p[0] - cx) * ez - (p[1] - cz) * ex) / den, u = ((p[0] - cx) * dz - (p[1] - cz) * dx) / den; if (t > 0 && u >= 0 && u <= 1) best = Math.max(best, t); } return best; };
  const inPark = (x, z) => { const [px, pz] = parkL(x, z); return px > NPARK.x0 - 20 && px < NPARK.x1 + 20 && pz > NPARK.z0 - 20; };   // 北嶺公園的範圍不開路、不蓋
  const hillOK = (x, z, pad) => !shoreAt(x, z) && !inPark(x, z) && !encNear(x, z, pad) && polyDistPt(CITY_POLY, x, z) > 2 && Number.isFinite(hillMeshH(x, z));   // encNear：雲梯城寨與切坡；山網格外面（hillMeshH 是 NaN）不開路、不蓋
  // ─── 路：外緣每 2.5° 試一個起點，路口間隔至少約 9°。山路照真的開法（2026-10-28 重寫；原本只看朝外的方向，一半的路段坡度 40–140%）：
  // 每 8 m 一步，邊走邊算縱斷面（每段坡度 ≤ 12%），挑地形最接近「路面再爬 9%」的方向，路就貼著山坡沿等高線走、挖填最少；
  // 橫向走出 70–110 m 試著往上坡折返（髮夾彎，要挖 15 m 以上就不折，繼續橫著走）；離外緣、別的路與自己前面的路段太近、要挖填 15 m 以上的方向不走，
  // 被別的路擋住就接過去成 T 字路口（高差允許的話）。外緣這一圈的坡度大多 60–130%，所以多半是沿山腳與山腰繞的路，只有碰到緩一點的山谷才爬得高。
  // 每一點的第三個值是縱斷面高度，HILL.carveH 照它把路兩側的山坡挖平、填起來 ───
  const ROAD_HW = 3, roads = [], grid = new Map(), gk = (x, z) => Math.floor(x / 24) + ',' + Math.floor(z / 24), RG = .12;
  // 太近：離別的路水平 24 m 內，或 40 m 內而且高差不到 12 m（陡坡上沿等高線一層疊一層的路，像香港半山）；離自己 skip 點以前的路段水平 12 m 內，
  // 或 22 m 內而且高差不到 10 m（同一條路折返上來的那一段，中間是擋土牆）
  const nearRoad = (x, z, y, own, skip) => {
    const i = Math.floor(x / 24), j = Math.floor(z / 24);
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (const p of grid.get((i + a) + ',' + (j + b)) || []) { const d = Math.hypot(x - p[0], z - p[1]); if (d < 24 || (d < 40 && Math.abs(y - p[2]) < 12)) return true; }
    for (let k = 0; k < own.length - skip; k++) { const d = Math.hypot(x - own[k][0], z - own[k][1]); if (d < 12 || (d < 22 && Math.abs(y - own[k][2]) < 10)) return true; }
    return false;
  };
  // 榛嶺山道（09-akina.js）最先開：下面一般的山路照 nearRoad 避開它
  { const ak = akinaRoad(edgeR, hillOK, nearRoad); if (ak) { roads.push(ak); for (const p of ak) { const k = gk(p[0], p[1]); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(p); } } }
  let lastA = -1e9;
  for (let i = 0; i < 144; i++) {
    const a = i / 144 * Math.PI * 2, sg0 = r2() < .5 ? -1 : 1, Dl = 70 + r2() * 40, ph = r2(), Lmax = (380 + r2() * 240) * 2.2;
    if (a - lastA < .16) continue;   // 路口間隔至少約 9°
    const R0 = edgeR(a) + 1, ux = Math.cos(a), uz = Math.sin(a);
    if (!hillOK(cx + ux * (R0 + 60), cz + uz * (R0 + 60)) || hillMeshH(cx + ux * (R0 + 60), cz + uz * (R0 + 60)) < 6) continue;
    const ra = Math.atan2(uz, ux), dm = RG * 8, pts = [[cx + ux * R0, cz + uz * R0, Math.min(hillMeshH(cx + ux * R0, cz + uz * R0), .3)]];
    // 往哪一側橫著走：300 m 內已經有路就往遠離它的那一側（不然一出路口就朝那條路走、走到 24 m 外被擋住），沒有才照抽到的
    let near0 = null, nd = 300;
    for (const L of grid.values()) for (const p of L) { const d = Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]); if (d < nd) { nd = d; near0 = p; } }
    const sgN = near0 ? -Math.sign(Math.sin(Math.atan2(near0[1] - pts[0][1], near0[0] - pts[0][0]) - ra)) : 0;
    let hd = ra, sg = sgN || sg0, lat = (ph - .5) * Dl, lastHp = 0, noHp = false;
    // 每一點的第三個值是縱斷面（路面高）：順著地形、每段最多爬升／下降 RG × 8 m，地形爬得比這快的地方路就挖進坡裡、降得快的地方填起來
    const yOf = (x, z) => clamp(hillMeshH(x, z), pts[pts.length - 1][2] - dm, pts[pts.length - 1][2] + dm);
    const free = (x, z, y, s, skip) => hillOK(x, z) && polyDistPt(CITY_POLY, x, z) >= Math.min(11, 3 + s * .3) && !nearRoad(x, z, y, pts, skip);
    // 髮夾彎：往上坡那一側轉半圈（每步 8 m 轉 30°，半徑約 15 m）。轉不過去（出了山坡、撞到路、要挖 15 m 以上）就不再折返，繼續橫著走
    const hairpin = s => {
      const [px, pz] = pts[pts.length - 1], hL = hillMeshH(px - Math.sin(hd) * 15, pz + Math.cos(hd) * 15), hR = hillMeshH(px + Math.sin(hd) * 15, pz - Math.cos(hd) * 15);
      const dir = (Number.isFinite(hL) ? hL : -1e9) > (Number.isFinite(hR) ? hR : -1e9) ? 1 : -1, n = pts.length;
      let th = hd, x = px, z = pz;
      for (let k = 0; k < 6; k++) {
        th += dir * Math.PI / 6; x += Math.cos(th) * 8; z += Math.sin(th) * 8;
        const y = yOf(x, z);
        if (!free(x, z, y, s, 8 + k) || Math.abs(hillMeshH(x, z) - y) > 15) { pts.length = n; noHp = true; return false; }
        pts.push([x, z, y]);
      }
      hd = th; sg = -sg; lastHp = s; return true;
    };
    for (let s = 8; s <= Lmax; s += 8) {
      const [px, pz, py] = pts[pts.length - 1], yT = py + .09 * 8;
      if (!noHp && Math.abs(lat) > Dl && Math.sign(lat) === sg && hairpin(s)) { s += 48; continue; }   // 橫向走夠了就折返
      // 挑地形最接近「路面再爬 9%」的方向（路貼著山坡走，挖填最少）、往這一趟的側向走的。第一步從外緣往外（路口，±0.3 rad），
      // 第二、三步每步可以轉到 ±0.75 rad（很快轉到沿等高線，路口那個彎半徑約 11 m），之後每步最多轉 0.45 rad；挖填超過 15 m 的方向不走
      let best = null;
      const qn = s === 8 ? 6 : s <= 24 ? 15 : 9;
      for (let q = -qn; q <= qn; q++) {
        const th = hd + q * .05, x = px + Math.cos(th) * 8, z = pz + Math.sin(th) * 8, side = Math.sin(th - ra) * sg, h = hillMeshH(x, z);
        if (s > 24 && side < 0) continue;
        const y = yOf(x, z);
        if (Math.abs(h - y) > 15 || (s > 24 && h < 1) || !free(x, z, y, s, 5)) continue;
        const sc = -Math.abs(h - yT) * 3 + side * (s <= 24 ? 5 : 1.5);
        if (!best || sc > best.sc) best = { th, sc, x, z, y };
      }
      if (!best) { if (!noHp && s > 40 && s - lastHp > 60 && hairpin(s)) { s += 48; continue; } pts.end = s; break; }   // 前面被擋住：提早折返（離上一個髮夾彎太近就不再折，免得連成蛇行）
      hd = best.th;
      if (s === 24) { const sd = Math.sin(hd - ra); if (Math.abs(sd) > .3) sg = Math.sign(sd); }   // 頭三步轉到哪一側（地形不許的時候不一定是預定的那側），這一趟就往那一側走
      lat += 8 * (-Math.sin(ra) * Math.cos(hd) + Math.cos(ra) * Math.sin(hd));
      pts.push([best.x, best.z, best.y]);
    }
    if (pts.length < 12) continue;
    // 被別的路擋住而停下的：40 m 內有一點高差在坡度限制內，就接過去成 T 字路口（不留一段死路）
    if (pts.end) {
      const [ex, ez, ey] = pts[pts.length - 1]; let j = null, jd = 40;
      for (let a2 = -2; a2 <= 2; a2++) for (let b2 = -2; b2 <= 2; b2++) for (const p of grid.get((Math.floor(ex / 24) + a2) + ',' + (Math.floor(ez / 24) + b2)) || []) {
        const d = Math.hypot(p[0] - ex, p[1] - ez); if (d < jd && Math.abs(p[2] - ey) <= d * RG) { jd = d; j = p; }
      }
      if (j) { pts.push([j[0], j[1], j[2]]); pts.tee = 1; }
    }
    lastA = a; roads.push(pts);
    for (const p of pts) { const k = gk(p[0], p[1]); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(p); }
  }
  for (const L of hillLinks(roads, hillOK, edgeR)) roads.push(L);   // 09-hilllink.js：三個別墅區互相接起來的連絡路、多開幾條下到城裡的路（直線剷平，不蓋房子）
  // 路段（含縱斷面高度）放進 24 m 的格子：roadD 是到最近路段（不是路上的點）的距離；HILL.carveH 照每一段把兩側的山坡挖平、填起來
  const sgrid = new Map();
  for (const P of roads) for (let k = 0; k + 1 < P.length; k++) {
    const A = P[k], B = P[k + 1], sgm = [A[0], A[1], A[2], B[0], B[1], B[2], P.akina ? 1 : 0];
    for (let i = Math.floor(Math.min(A[0], B[0]) / 24); i <= Math.floor(Math.max(A[0], B[0]) / 24); i++) for (let j = Math.floor(Math.min(A[1], B[1]) / 24); j <= Math.floor(Math.max(A[1], B[1]) / 24); j++) {
      const key = i + ',' + j; let L = sgrid.get(key); if (!L) sgrid.set(key, L = []); L.push(sgm);
    }
  }
  const segEach = (x, z, R, fn) => {   // R 公尺內的每一段：fn(到路中線的距離, 那一點的路面高, 是不是榛嶺山道)
    const i = Math.floor(x / 24), j = Math.floor(z / 24), c = Math.ceil(R / 24), seen = new Set();
    for (let a = -c; a <= c; a++) for (let b = -c; b <= c; b++) for (const S of sgrid.get((i + a) + ',' + (j + b)) || []) {
      if (seen.has(S)) continue; seen.add(S);
      const [ax, az, ay, bx, bz, by, ak] = S, ex = bx - ax, ez = bz - az, t = clamp(((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1), 0, 1), d = Math.hypot(x - ax - ex * t, z - az - ez * t);
      if (d < R) fn(d, ay + (by - ay) * t, ak);
    }
  };
  const roadD = (x, z) => { let d = 1e9; segEach(x, z, 48, dd => { if (dd < d) d = dd; }); return d; };
  // 挖填：路肩外 0.3 m（RC）以內是路面高；外面挖方 1.4:1（岩壁）、填方 0.75:1，碰到原本的山坡為止（CW 公尺內）。先挖再填，最後路面本身照最近那一段
  // 榛嶺（22-akina.js 在路緣外 1.15 m 砌擋土牆）：挖方的平台多留 2.6 m，斜坡從牆後面才開始，細格子的三角形才不會凸到牆前面
  const RC = ROAD_HW + 1.4, RC_AK = RC + 2.6, CW = 40, CUT = 1.4, FILL = .75;
  HILL.roadN = 12;   // 21-coast.js 細分路兩側的三角形，每個切成 N×N（粗網格加密以後從 20 降到 12，細分後的格距差不多）
  HILL.carveH = (X, Z, h) => {
    let hc = h, best = 1e9, yr = 0, cap = 1e9;
    segEach(X, Z, CW, (d, y, ak) => { if (d < best) { best = d; yr = y; } const c = y + Math.max(0, d - (ak ? RC_AK : RC)) * CUT; if (h > y) hc = Math.min(hc, c); if (ak) cap = Math.min(cap, c); });
    if (best >= CW) return h;
    // 榛嶺的上下兩段路之間，下段的挖方和上段的填方交成一條稜線，細格子斜著切過去是一排鋸齒：照 6 m 的寬度磨圓（smooth max）
    segEach(X, Z, CW, (d, y, ak) => { if (y > hc) { const v = y - Math.max(0, d - RC) * FILL, q = ak ? Math.max(0, 6 - Math.abs(hc - v)) / 6 : 0; hc = Math.max(hc, v) + q * q * 1.5; } });
    // 榛嶺的髮夾彎上下疊：上段的填方不能蓋過下段的挖方斜面（不然下段的路邊被埋掉），上段路緣外的落差由 22-akina.js 的擋土牆擋
    hc = Math.min(hc, cap);
    if (best > RC && AKINA && AKINA.lots) hc = akinaLotH(X, Z, hc);   // OSM 的停車場：整平成一片斜平面
    return best <= RC ? yr : hc;
  };
  HILL.carveW = (X, Z) => { const h = hillMeshRaw(X, Z); return Number.isFinite(h) ? clamp(Math.abs(HILL.carveH(X, Z, h) - h) / .6, 0, 1) : 0; };   // 21-coast.js 的細分：0 的地方照粗網格
  // 21-coast.js：碰到路兩側 CW 公尺的山網格三角形另外細分（三角形的外接框碰到任何一段的外接框就算）
  HILL.carveHit = P3 => {
    const x0 = Math.min(...P3.map(p => p[0])) - CW, x1 = Math.max(...P3.map(p => p[0])) + CW, z0 = Math.min(...P3.map(p => p[1])) - CW, z1 = Math.max(...P3.map(p => p[1])) + CW;
    for (let i = Math.floor(x0 / 24); i <= Math.floor(x1 / 24); i++) for (let j = Math.floor(z0 / 24); j <= Math.floor(z1 / 24); j++) {
      for (const [ax, az, , bx, bz] of sgrid.get(i + ',' + j) || []) {
        if (Math.max(ax, bx) < x0 || Math.min(ax, bx) > x1 || Math.max(az, bz) < z0 || Math.min(az, bz) > z1) continue;
        // 段的中點與兩端到三角形的距離
        for (const t of [0, .5, 1]) { const px = ax + (bx - ax) * t, pz = az + (bz - az) * t; if (triDist(P3, px, pz) < CW) return true; }
      }
    }
    return false;
  };
  hillLinkCarve(roads, RC, CUT, FILL, CW, roadD);   // 09-hilllink.js：連絡路深挖、高填的路段加寬挖填
  // 路面：每一點左右各三條（路肩外緣、路面邊、中線），高度各自照山網格抬 0.25 m；柏油、碎石路肩、虛線的黃中線、每 70 m 一盞路燈（燈頭自發光）
  {
    const pos = [], col = [], mt = [], idx = [], c = new T.Color();
    const strip = (pts, o0, o1, y, hex, mat, dash) => {
      c.set(hex);
      for (let i = 0; i + 1 < pts.length; i++) {
        if (dash && i % 2) continue;
        const q = [pts[i], pts[i + 1]], base = pos.length / 3;
        for (const [k, [x, z]] of q.entries()) {
          const o = pts[Math.min(pts.length - 1, i + k + 1)], p = pts[Math.max(0, i + k - 1)], tx = o[0] - p[0], tz = o[1] - p[1], L = Math.hypot(tx, tz) || 1, nx = -tz / L, nz = tx / L;
          for (const off of [o0, o1]) { const X = x + nx * off, Z = z + nz * off, h = hillMeshH(X, Z); pos.push(X, (Number.isFinite(h) ? h : hillMeshH(x, z)) + y, Z); col.push(c.r, c.g, c.b); mt.push(mat); }
        }
        idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      }
    };
    for (const pts of roads) {
      // 榛嶺山道（09-akina.js）照日本的山路：淺一點的柏油、水泥路緣、黃色實線的中線（禁止超車）、兩側白色的路側線，沒有路燈；
      // 別墅區的山路照同一套參考圖（使用者：別墅區的樣式同步），只是留著路燈
      const ak = pts.akina;
      strip(pts, -ROAD_HW - 1.1, -ROAD_HW, .22, 0x77746c, TX.conc); strip(pts, ROAD_HW, ROAD_HW + 1.1, .22, 0x77746c, TX.conc);
      {   // 使用者：路太乾淨。柏油改用連接道路的路面著色器（MAT.roadConn：柏油貼圖、補丁、裂縫、磨損的中央雙黃線；aUV 是（橫向、沿路）的公尺數），白色邊線也髒一點
        const P = [], N = [], UV = [], AX = [], I = []; let u = 0;
        for (let i = 0; i < pts.length; i++) {
          const [x, z] = pts[i], o = pts[Math.min(pts.length - 1, i + 1)], p = pts[Math.max(0, i - 1)], L = Math.hypot(o[0] - p[0], o[1] - p[1]) || 1, nx = -(o[1] - p[1]) / L, nz = (o[0] - p[0]) / L;
          if (i) u += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
          for (const off of [-ROAD_HW, 0, ROAD_HW]) { const X = x + nx * off, Z = z + nz * off, h = hillMeshH(X, Z); P.push(X, (Number.isFinite(h) ? h : hillMeshH(x, z)) + .25, Z); N.push(0, 1, 0); UV.push(off, u); AX.push(nx, nz); }
          if (i) { const b = (i - 1) * 3; I.push(b, b + 3, b + 1, b + 1, b + 3, b + 4, b + 1, b + 4, b + 2, b + 2, b + 4, b + 5); }
        }
        const ag = new T.BufferGeometry(); ag.setAttribute('position', new T.Float32BufferAttribute(P, 3)); ag.setAttribute('normal', new T.Float32BufferAttribute(N, 3));
        ag.setAttribute('aUV', new T.Float32BufferAttribute(UV, 2)); ag.setAttribute('aAx', new T.Float32BufferAttribute(AX, 2)); ag.setIndex(I); ag.computeVertexNormals(); ag.computeBoundingSphere();
        const am = new T.Mesh(ag, MAT.roadConn); am.name = ak ? 'akinaAsphalt' : 'hillAsphalt'; groundAdd(am, null);
        strip(pts, -ROAD_HW + .2, -ROAD_HW + .36, .27, 0xbdbcb4, 2); strip(pts, ROAD_HW - .36, ROAD_HW - .2, .27, 0xbdbcb4, 2);
      }
      for (let i = 4; !ak && i < pts.length - 1; i += 9) {   // 榛嶺沒有路燈，22-akina.js 立電線桿；別墅區的路燈換成水泥桿（參考圖的電線桿）掛一支燈臂
        const [x, z] = pts[i], o = pts[i + 1], L = Math.hypot(o[0] - x, o[1] - z), nx = -(o[1] - z) / L, nz = (o[0] - x) / L, sd = i % 18 ? 1 : -1;
        const lx = x + nx * sd * (ROAD_HW + .8), lz = z + nz * sd * (ROAD_HW + .8), y = hillMeshH(lx, lz);
        rk.cyl(lx, y + 3.6, lz, .1, .15, 7.2, 8, 0x9c9b95, TX.conc).bar(lx, y + 5.9, lz, lx - nx * sd * 1.4, y + 6, lz - nz * sd * 1.4, .1, .08, 0x3a3d40, TX.enamel);
        rk.box(lx - nx * sd * 1.4, y + 5.92, lz - nz * sd * 1.4, .45, .1, .22, 0xffd9a0, 11);
        (HILL.lampHeads ||= []).push({ x: lx - nx * sd * 1.4, z: lz - nz * sd * 1.4, t: 0, y: Math.max(y - 1.18, -.4) });   // 22-akina.js 寫進路燈表（燈頭高 = 7.1 + y），晚上照亮路面
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setAttribute('aMat', new T.Float32BufferAttribute(mt, 1));
    g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
    if (g.attributes.normal.array[1] < 0) { g.setIndex(idx.map((v, n) => idx[n - n % 3 + [0, 2, 1][n % 3]])); g.computeVertexNormals(); }   // 繞序朝下就翻過來
    const m = new T.Mesh(g, MAT.ux); m.name = 'hillRoads'; cityAdd(m, null);
  }
  // ─── 平台與房子：沿路每 22–40 m 試一棟、左右隨機、型號隨機。照山坡上真的蓋法：地坪跟著靠路那一排的地形（+0.3 m），
  // 下坡那側是混凝土石砌的高基座（最多 5 m，再往下立混凝土墩柱撐到地面）、上坡那側沿邊砌階梯狀的擋土牆（擋住比地坪高的山，房子背面埋進坡裡最多 10 m）；
  // 平台比房子兩側與背面各寬 0.6 m（只是牆厚）、前面留 3 m 前院。平台前緣離路緣 1.5–12 m，挑第一個能讓車道坡度 ≤ 25% 的距離；
  // 地坪比路低太多就填高；比路高太多就在路邊做嵌進山坡的兩格車庫（路面高度），車庫頂接到前院。地坪離最低的地形超過 16 m、平台碰到別的路或平台、出了山坡範圍的不蓋 ───
  // 地中海柏木的樹冠：一顆二十面體細分一次、表面照雜訊起伏（像一團團葉子）、上半收尖，高 1、底在 0（每棵再照 tf 縮放；
  // Kit.add 會把矩陣直接套在非索引的幾何上，所以每棵傳一份 clone，不然變換會一棵疊一棵、最後變成 NaN）
  const CYP_GEO = (() => {
    const g = new T.IcosahedronGeometry(.5, 1), p = g.attributes.position, rc = rng(31);
    const jit = new Map(); for (let k = 0; k < p.count; k++) { const key = p.getX(k).toFixed(3) + p.getY(k).toFixed(3) + p.getZ(k).toFixed(3); if (!jit.has(key)) jit.set(key, .85 + rc() * .3); const j = jit.get(key), y = p.getY(k); p.setXYZ(k, p.getX(k) * j * (1 - Math.max(0, y) * 1.1), y + .5, p.getZ(k) * j * (1 - Math.max(0, y) * 1.1)); }
    g.computeVertexNormals(); return g;
  })();
  const pads = [], drvW = [], rej = { hill: 0, road: 0, wall: 0, back: 0, overlap: 0 }, P = 5, rh = rng(91);   // drvW：車道口（路緣上）的世界座標，護欄在那裡留口   // rh：樹籬的灌木（自己一串，不動 r2 的房子配置）
  for (const pts of roads) if (!pts.link) for (let s = 10 + r2() * 12; s < pts.length * 8 - 8; s += 12 + r2() * 12) {
    const i = Math.floor(s / 8), [x, z] = pts[i], o = pts[i + 1], L = Math.hypot(o[0] - x, o[1] - z), tx = (o[0] - x) / L, tz = (o[1] - z) / L;
    if (pts.akina && akinaIn(x, z, .8)) continue;   // 榛嶺山道：只有山腳那一段蓋房子
    // 路的哪一側：先抽一邊，那邊不是下坡而另一邊是，就換到下坡那邊（陡坡上靠山那側的平台後面會埋進坡裡太深，幾乎都蓋不了）；
    // 那一側蓋不了（山腳的路下坡那側常常就是城市或海岸）再試另一側
    const dn = sd => hillMeshH(x - tz * sd * 34, z + tx * sd * 34) < hillMeshH(x - tz * sd * 8, z + tx * sd * 8) - 2, s0 = r2() < .5 ? -1 : 1, side0 = !dn(s0) && dn(-s0) ? -s0 : s0, edge = ROAD_HW + 1.1;
    let fit = null, why = 'road', pool = 0, px0 = 0, px1 = 0, rad = 0, side, nx, nz, v, x0, x1, z0, z1, dx, pz0, pz1;
    for (const sd of [side0, -side0]) {
    side = sd; nx = -tz * side; nz = tx * side;
    const down = dn(side), q = r2();   // 路的這一側是不是下坡
    v = down ? (q < .3 ? 0 : q < .55 ? 1 : q < .75 ? 3 : q < .9 ? 2 : 4) : (q < .6 ? 2 : 4); let jsPool; [, x0, x1, z0, z1, dx, , jsPool] = HOME_V[v];
    const want = jsPool && r2() < .7 ? (dx > 0 ? -1 : 1) : 0; pz0 = z0 - 3; pz1 = z1 + .6;   // 泳池平台在房子沒有車道的那一側，寬 10 m；放不下就不帶泳池再試一次
    for (const pl of want ? [want, 0] : [0]) {
    pool = pl; px0 = x0 - .6 - (pool < 0 ? 10 : 0); px1 = x1 + .6 + (pool > 0 ? 10 : 0); rad = Math.hypot(px1 - px0, pz1 - pz0) / 2;
    let gfit = null;
    for (const gap of [1.5, 4, 8, 12]) {
      const hx = x + nx * (edge + gap - pz0), hz = z + nz * (edge + gap - pz0);   // 平台前緣（局部 z = pz0）在路緣外 gap
      const W = (lx, lz) => [hx + lx * nz + lz * nx, hz - lx * nx + lz * nz];   // 局部 → 世界（繞 y 轉 ry，局部 +z 朝外、−z 朝路）
      const hg = new Float32Array((P + 1) * (P + 1));   // 平台上 6×6 個點的地形高（[a 沿 x][b 沿 z]，b = 0 是前緣）
      let ok = true;
      for (let a = 0; a <= P && ok; a++) for (let b = 0; b <= P; b++) {
        const [X, Z] = W(px0 + (px1 - px0) * a / P, pz0 + (pz1 - pz0) * b / P);
        if (!hillOK(X, Z)) { ok = false; why = 'hill'; break; }
        if (roadD(X, Z) < edge + .1) { ok = false; why = 'road'; break; }
        hg[a * (P + 1) + b] = hillMeshH(X, Z);
      }
      if (!ok) { if (why === 'hill') break; continue; }
      let hf = -1e9, hmin = 1e9, hmax = -1e9;
      for (let a = 0; a <= P; a++) { hf = Math.max(hf, hg[a * (P + 1)], hg[a * (P + 1) + 1]); for (let b = 0; b <= P; b++) { hmin = Math.min(hmin, hg[a * (P + 1) + b]); hmax = Math.max(hmax, hg[a * (P + 1) + b]); } }
      const [ax, az] = W(dx, pz0 - gap), yr = hillMeshH(ax, az) + .22, lim = gap * .25 + .3, yp = Math.max(hf + .3, yr - lim);   // 比路低太多就把地坪填高到車道接得上
      if (yp - hmin > 16 || hmin < 1) { why = 'wall'; break; }
      if (hmax - yp > 10) { why = 'back'; continue; }
      const [ccx, ccz] = W((px0 + px1) / 2, (pz0 + pz1) / 2);   // 平台中心（泳池那側比房子寬）
      if (pads.some(q => Math.hypot(q[0] - ccx, q[1] - ccz) < q[2] + rad + 1)) { why = 'overlap'; break; }
      const f = { hx, hz, W, yp, hmin, hg, gap, yr, ccx, ccz, drive: yp - yr <= lim };
      if (f.drive) { fit = f; break; }
      if (!gfit && gap >= 4 && yp - yr < 9) gfit = f;
    }
    fit = fit || gfit;
    if (fit) break;
    }
    if (fit) break;
    }
    if (!fit) { rej[why]++; continue; }
    const { hx, hz, W, yp, hmin, hg, gap, yr, drive } = fit, ry = Math.atan2(nx, nz), box = (lx, ly, lz, sx, sy, sz, col, m) => { const [X, Z] = W(lx, lz); rk.box(X, ly, Z, sx, sy, sz, col, m, 0, ry, 0); };
    pads.push([fit.ccx, fit.ccz, rad]);
    const hw = px1 - px0, hd = pz1 - pz0, wb = Math.max(hmin - .8, yp - 5), mx = (px0 + px1) / 2, mz = (pz0 + pz1) / 2;
    box(mx, (yp - .12 + wb) / 2, mz, hw, yp - .12 - wb, hd, 0x8a8478, TX.stone);   // 基座（下坡那側露出來的就是擋土牆）
    // 實心基座最多 5 m；再往下是 3×3 根混凝土墩柱撐到地面（陡坡上的懸挑平台），地形比基座底高的那根不立
    if (hmin - .8 < wb) for (const a of [0, 3, P]) for (const b of [1, 3, P]) {
      const g = hg[a * (P + 1) + b] - .5; if (g >= wb) continue;
      box(px0 + .5 + (hw - 1) * a / P, (g + wb) / 2, pz0 + .5 + (hd - 1) * b / P, .7, wb - g + .02, .7, 0x9a968c, TX.conc);
    }
    box(mx, yp - .05, mz, hw + .2, .16, hd + .2, 0x9a968c, TX.conc);   // 壓頂與前院鋪面
    // 上坡那側：沿兩側與背面切成五段，每段砌到那段最高的地形 +0.4 m（比地坪低的段不砌）
    const cut = (a0, b0, a1, b1, lx, lz, len, alongX) => {
      const t = Math.max(hg[a0 * (P + 1) + b0], hg[a1 * (P + 1) + b1]) + .4 - yp;
      if (t > .3) box(lx, yp + t / 2, lz, alongX ? len + .01 : .45, t, alongX ? .45 : len + .01, 0x7d776c, TX.stone), box(lx, yp + t + .05, lz, alongX ? len + .1 : .6, .1, alongX ? .6 : len + .1, 0x9a968c, TX.conc);
    };
    for (let k = 0; k < P; k++) {
      const u = px0 + (px1 - px0) * (k + .5) / P, w = pz0 + (pz1 - pz0) * (k + .5) / P;
      cut(k, P, k + 1, P, u, pz1 - .22, hw / P, true);   // 背面
      if (k >= 1) { cut(0, k, 0, k + 1, px0 + .22, w, hd / P, false); cut(P, k, P, k + 1, px1 - .22, w, hd / P, false); }   // 兩側（前院那段不砌）
    }
    if (drive) {
      const [ax, az] = W(dx, pz0 - gap), [bx, bz] = W(dx, pz0);
      rk.bar(ax, yr, az, bx, yp + .03, bz, 3.4, .3, 0x77736a, TX.conc);   // 路緣接上平台的車道
    } else {   // 比路高太多：路邊嵌進山坡的車庫（清水混凝土、鍍鋅捲門，路面高度），車庫頂就是前院
      const dy = yp - yr, cz = pz0 - gap / 2, wd = HILL_GAR_W;
      box(dx, (yr - .3 + yp - .12) / 2, cz, wd, yp - .12 - yr + .3, gap, 0x9a968c, TX.conc);
      box(dx, yp - .05, cz, wd + .2, .16, gap + .2, 0x9a968c, TX.conc);
      for (const e of [-1.6, 1.6]) box(dx + e, yr + Math.min(2.5, dy - .5) / 2, pz0 - gap - .03, 2.8, Math.min(2.5, dy - .5), .06, 0x8a8e90, TX.galv);
      // 捲門左邊的人行門（裡面是上前院的電梯，29-villa.js 的 H.lift）與車庫頂上的電梯口（鋼框、深色烤漆，門朝房子）
      box(dx - 3.75, yr + 1.1, pz0 - gap - .03, 1, 2.2, .06, 0x3a3c3e, TX.galv); box(dx - 3.75, yr + 2.27, pz0 - gap - .05, 1.2, .1, .08, 0x26272a, TX.galv);
      box(dx - 3.75, yp + 1.2, pz0 - gap + .95, 1.5, 2.4, 1.5, 0x2a2c30, TX.galv); box(dx - 3.75, yp + 1.1, pz0 - gap + 1.73, 1, 2.2, .06, 0x3a3c3e, TX.galv);
    }
    // 前院：沿前緣一排樹籬（車道那裡留口）、兩角各一棵地中海柏木（細長、上尖）
    const cypress = (lx, lz, hgt) => { const [X, Z] = W(lx, lz); rk.add(CYP_GEO.clone(), 0x1f3518, 2, tf(X, yp + .1, Z, 0, r2() * 6.3, 0, .55 + r2() * .15, hgt, .55 + r2() * .15)); };
    for (const [a, b] of [[px0 + .3, dx - 2.2], [dx + 2.2, px1 - .3]]) if (b - a > .8) {   // 樹籬：矮石花台上一排挨著的灌木（hill_homes.glb 的 shrub 實例，原本是一條綠方塊）
      box((a + b) / 2, yp + .14, pz0 + .5, b - a, .28, .8, 0xc8c0b0, TX.stone);
      for (let k = 0, n = Math.max(1, Math.round((b - a) / .7)); k < n; k++) { const [X, Z] = W(a + (b - a) * (k + .5) / n, pz0 + .5 + (rh() - .5) * .12); HILL_PLANTS.shrub.push({ x: X, y: yp + .2, z: Z, ry: rh() * 6.28, s: .72 + rh() * .2, zn: null }); }
    }
    for (const lx of [px0 + .9, px1 - .9]) if (Math.abs(lx - dx) > 2.6) cypress(lx, pz0 + 1.6, 5 + r2() * 2.5);
    // 泳池平台：木平台、白石壓頂的泳池（水面比壓頂低 5 cm）、圓形按摩池、躺椅與陽傘，外側與後側是玻璃欄杆
    if (pool) {
      const ta = pool > 0 ? x1 + .6 : px0 + .3, tb = pool > 0 ? px1 - .3 : x0 - .6, tw = tb - ta, tcx = (ta + tb) / 2, za = pz0 + 3.2, zb = pz1 - .3, td = zb - za, tcz = (za + zb) / 2;
      box(tcx, yp + .07, tcz, tw, .08, td, 0x6e5038, TX.woodX);
      const pw = 4.2, pl = Math.min(8, td - 2.4), pcx = tcx + pool * (tw / 2 - pw / 2 - .8), pcz = tcz + .3;
      box(pcx, yp + .11, pcz, pw, .02, pl, 0x2fb2c6, TX.pool);
      for (const [cx2, cz2, sx, sz] of [[pcx, pcz - pl / 2 - .17, pw + .7, .35], [pcx, pcz + pl / 2 + .17, pw + .7, .35], [pcx - pw / 2 - .17, pcz, .35, pl], [pcx + pw / 2 + .17, pcz, .35, pl]]) box(cx2, yp + .1, cz2, sx, .14, sz, 0xd8d2c4, TX.stone);
      const ix = tcx - pool * (tw / 2 - 1.5);   // 靠房子那一側：按摩池在後、躺椅與陽傘在前
      { const [X, Z] = W(ix, zb - 1.6); rk.cyl(X, yp + .35, Z, 1.25, 1.25, .5, 14, 0xd8d2c4, TX.stone).cyl(X, yp + .6, Z, 1.02, 1.02, .02, 14, 0x2fb2c6, TX.pool); }
      for (let k = 0; k < 3; k++) { const lz = za + 1 + k * 1.1; box(ix, yp + .32, lz, 1.9, .14, .7, 0xe8e4dc, 2); box(ix - pool * .75, yp + .48, lz, .45, .22, .7, 0xe8e4dc, 2); }
      { const [X, Z] = W(ix + pool * 1.4, za + 2.1); rk.cyl(X, yp + 1.3, Z, .03, .03, 2.4, 6, 0xc8c8c0, TX.steel).cyl(X, yp + 2.6, Z, .05, 1.4, .45, 8, 0xe6dccb, 2); }
      const ox = pool > 0 ? tb + .2 : ta - .2;
      box(ox, yp + .65, (za + zb) / 2, .04, 1.0, td + 3, 0x8aa4ac, 1); box(ox, yp + 1.17, (za + zb) / 2, .06, .05, td + 3, 0x8a8e90, TX.galv);
      box(tcx, yp + .65, zb + .2, tw + .4, 1.0, .04, 0x8aa4ac, 1); box(tcx, yp + 1.17, zb + .2, tw + .4, .05, .06, 0x8a8e90, TX.galv);
      cypress(ta + (pool > 0 ? .3 : tw - .3), zb - .3, 6 + r2() * 2);
    }
    HILL_HOMES.push({ v, x: hx, y: yp + .03, z: hz, ry, zn: null, seed: r2() * 100, pad: [px0, px1, pz0, pz1], drv: [dx, gap, yr, drive ? 1 : 0] });
    drvW.push(W(dx, pz0 - gap));   // pad：平台（局部座標）；drv：車道的 x、路緣到平台的距離、路面高、是不是斜坡車道（29-villa.js 的地面）
    // 植栽：平台前緣與兩側的棕櫚（2–4 棵）、前院與坡上的龍舌蘭、灌木（三成開花）、坡上的岩石；坡上的照山網格的高度
    const put = (k, lx, lz, onPad, s = 1) => { const [X, Z] = W(lx, lz), Y = onPad ? yp + .1 : hillMeshH(X, Z); if (!Number.isFinite(Y) || !onPad && (roadD(X, Z) < edge + .5 || Y > yp - .2 && Math.abs(lz - (pz0 + pz1) / 2) < (pz1 - pz0) / 2 + .5 && lx > px0 - .5 && lx < px1 + .5)) return; HILL_PLANTS[k].push({ x: X, y: Y - (k === 'rock' ? .3 : .05), z: Z, ry: r2() * 6.28, s, zn: null, sl: !onPad }); };
    for (let k = 0, n = 2 + Math.floor(r2() * 3); k < n; k++) put('palm', k % 2 ? px1 - .8 - r2() * 2 : px0 + .8 + r2() * 2, pz0 + .9 + r2() * (pz1 - pz0 - 2), true, .8 + r2() * .45);
    for (let k = 0; k < 4; k++) put('agave', px0 + 1 + r2() * (px1 - px0 - 2), pz0 + .4 + r2() * 1.6, true, .8 + r2() * .5);
    for (let k = 0; k < 28; k++) {   // 平台外圍的坡：左右兩側與背面 2–14 m 內
      const sd2 = r2(), lx = sd2 < .35 ? px0 - 2 - r2() * 12 : sd2 < .7 ? px1 + 2 + r2() * 12 : px0 + r2() * (px1 - px0), lz = sd2 < .7 ? pz0 + r2() * (pz1 - pz0 + 8) : pz1 + 2 + r2() * 12;
      const kk = r2(); put(kk < .45 ? 'shrub' : kk < .6 ? 'shrub_bloom' : kk < .8 ? 'agave' : 'rock', lx, lz, false, .8 + r2() * .9);
    }
    if (r2() < .6) put('palm', px1 + 3 + r2() * 6, pz1 + r2() * 8, false, .9 + r2() * .4);
  }
  // ─── 別墅區山坡的起伏（HILL_VIL）：幾十公尺的起伏、9 m 的小丘、一塊塊突出的岩盤（±1.5 m 上下）；整數雜湊的值雜訊，不動 rnd() ───
  {
    const R = HILL_VIL.R, vh = (i, j) => { let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const vn = (x, z) => { const i = Math.floor(x), j = Math.floor(z), u = sm01(x - i), w = sm01(z - j); return (vh(i, j) * (1 - u) + vh(i + 1, j) * u) * (1 - w) + (vh(i, j + 1) * (1 - u) + vh(i + 1, j + 1) * u) * w; };
    const disp = (X, Z) => 2.2 * (vn(X / 26, Z / 26) - .5) + (vn(X / 9 + 31, Z / 9) - .5) + .9 * sm01((vn(X / 14 + 7, Z / 14 + 3) - .62) / .23) * (.6 + .4 * vn(X / 3, Z / 3));
    const near = (X, Z) => { let d = 1e9; for (const h of HILL_HOMES) d = Math.min(d, Math.hypot(X - h.x, Z - h.z)); return d; };
    const region = (X, Z) => 1 - sm01((near(X, Z) - R * .7) / (R * .3));   // 別墅區的範圍：0.7 R 內是 1，R 淡到 0
    const flat = (X, Z) => { let f = sm01((roadD(X, Z) - ROAD_HW - 2) / 7); for (const [px, pz, rd] of pads) { if (f <= 0) break; f = Math.min(f, sm01((Math.hypot(X - px, Z - pz) - rd - 1.5) / 6.5)); } return f; };
    HILL_VIL.w = (X, Z) => region(X, Z) * flat(X, Z);
    HILL_VIL.region = region;
    HILL_VIL.h = (X, Z) => { const w = HILL_VIL.w(X, Z); return hillMeshH(X, Z) + (w > 0 ? disp(X, Z) * w : 0); };
    // 群：彼此 300 m 內的別墅算同一群（21-coast.js 每群一個網格，畫面外的整群剔掉）
    const gi = HILL_HOMES.map(() => -1);
    for (let a = 0; a < HILL_HOMES.length; a++) {
      if (gi[a] >= 0) continue;
      const g = HILL_VIL.groups.length, st = [a]; gi[a] = g; HILL_VIL.groups.push([]);
      while (st.length) { const k = st.pop(); HILL_VIL.groups[g].push(HILL_HOMES[k]); for (let b = 0; b < HILL_HOMES.length; b++) if (gi[b] < 0 && Math.hypot(HILL_HOMES[b].x - HILL_HOMES[k].x, HILL_HOMES[b].z - HILL_HOMES[k].z) < 300) { gi[b] = g; st.push(b); } }
    }
    // 坡上的植栽與岩石照起伏後的高度（放的時候後面的平台還沒挖，最後統一改）
    for (const k in HILL_PLANTS) for (const t of HILL_PLANTS[k]) if (t.sl) { const w = HILL_VIL.w(t.x, t.z); if (w > 0) t.y += disp(t.x, t.z) * w; }
  }
  // ─── 外緣山林：外緣往外 10–980 m 的山坡（到稜線，後面是 21-coast.js 的石柱峰盆地）（靠山那一側）每 10 m 一格抖動撒一棵；林地雜訊挖出空地，楓樹與冷杉照另一個雜訊分片混生（高處冷杉多）。
  // 避開：山路兩側、別墅平台、北嶺公園與鐵道橋、雲梯城寨、水邊、太陡（40° 起漸稀、> 51°）。外緣多邊形每條邊往外照比例放大（同 hillV），不用每點算到多邊形的距離 ───
  {
    const rf = rng(93), P = CITY_POLY, n = P.length, CELL = 10;
    const fh = (i, j) => { let h = Math.imul(i, 73856093) ^ Math.imul(j, 19349663); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const fn = (x, z) => { const i = Math.floor(x), j = Math.floor(z), u = sm01(x - i), w = sm01(z - j); return (fh(i, j) * (1 - u) + fh(i + 1, j) * u) * (1 - w) + (fh(i, j + 1) * (1 - u) + fh(i + 1, j + 1) * u) * w; };
    const V = VIADUCT, nearVia = (X, Z) => { if (!V || !NPARK) return false; const [px, pz] = parkL(X, Z), lx = px - V.x - V.lx0, lz = pz - V.z - V.lz0; return lx > -40 && lx < V.W + 40 && lz > -40 && lz < V.D + 40; };
    const padD = (X, Z) => { let d = 1e9; for (const [px, pz, rd] of pads) d = Math.min(d, Math.hypot(X - px, Z - pz) - rd); return d; };
    const parkNo = (X, Z) => { if (!NPARK) return false; const [px, pz] = parkL(X, Z); return px > NPARK.x0 - 25 && px < NPARK.x1 + 25 && pz > NPARK.z0 - 25; };
    // 除錯：某一點為什麼沒有樹（99-main.js 的 __nc.forest(x, z)）
    HILL_FOREST.probe = (X, Z) => ({ y: +(HILL_VIL.h || hillMeshH)(X, Z).toFixed(1), shore: shoreAt(X, Z), road: +roadD(X, Z).toFixed(1), pad: +padD(X, Z).toFixed(1), enc: encNear(X, Z, 30), via: nearVia(X, Z), park: parkNo(X, Z),
      dens: +(fn(X / 110, Z / 110) * .75 + fn(X / 31 + 17, Z / 31) * .25 - .22).toFixed(2), slope: +(Math.hypot(hillMeshH(X + 2, Z) - hillMeshH(X - 2, Z), hillMeshH(X, Z + 2) - hillMeshH(X, Z - 2)) / 4).toFixed(2),
      trees: HILL_FOREST.fir.concat(HILL_FOREST.maple, HILL_FOREST.broad, HILL_FOREST.pine).filter(t => Math.hypot(t.x - X, t.z - Z) < 50).length, pines: HILL_FOREST.pine.filter(t => Math.hypot(t.x - X, t.z - Z) < 50).slice(0, 4).map(t => [+t.x.toFixed(1), +t.y.toFixed(1), +t.z.toFixed(1)]) });
    let tried = 0;
    for (let k = 0; k < n; k++) {
      const a = P[k], b = P[(k + 1) % n], el = Math.hypot(b[0] - a[0], b[1] - a[1]), Rk = (HILL.R[k] + HILL.R[(k + 1) % n]) / 2;
      if (HILL.W[k] < .2 && HILL.W[(k + 1) % n] < .2) continue;   // 靠海那側的矮丘也種（水邊與海岸照下面的 shoreAt 排除）
      for (let s = 10, sMax = akinaSMax(a, b, Rk); s < sMax; s += CELL) {   // 榛嶺那個方向種到山的另一側（稜線外的盆地只種山上）
        const sc = (Rk + s) / Rk, m = Math.max(1, Math.round(el * sc / CELL));
        for (let t = 0; t < m; t++) {
          tried++;
          const f = (t + .15 + rf() * .7) / m, s2 = s + rf() * CELL;
          const ex = a[0] + (b[0] - a[0]) * f, ez = a[1] + (b[1] - a[1]) * f, q = (HILL.R[k] * (1 - f) + HILL.R[(k + 1) % n] * f + s2) / (HILL.R[k] * (1 - f) + HILL.R[(k + 1) % n] * f);
          const X = HILL.cx + (ex - HILL.cx) * q, Z = HILL.cz + (ez - HILL.cz) * q, rnd1 = rf(), rnd2 = rf(), rnd3 = rf();
          if (s >= 980 && !akinaIn(X, Z) || akinaWet(X, Z)) continue;
          // 林地：大片的雜訊挖出空地與草坡（約三成）；越往外緣邊越稀（城邊留一圈）
          const dens = fn(X / 110, Z / 110) * .75 + fn(X / 31 + 17, Z / 31) * .25 - .22 + .1 * sm01((s - 20) / 60) + .2 * akinaW(X, Z);   // 榛嶺的林子密，一路長到路邊
          if (rnd1 > dens * 2.2) {   // 空地：三成擺一片草或紫花（草坡上的野花）
            if (rnd1 < .3 + dens * 2.2 && s < 420) {
              const uy = (HILL_VIL.h || hillMeshH)(X, Z);
              if (Number.isFinite(uy) && uy > SEA_Y + 3 && !shoreAt(X, Z) && !parkNo(X, Z) && roadD(X, Z) > ROAD_HW + 2.5 && padD(X, Z) > 3 && !encNear(X, Z, 30) && !nearVia(X, Z)) HILL_FOREST.und[rnd2 < .45 ? 'flower' : 'grass'].push({ x: X, y: uy - .03, z: Z, ry: rnd3 * 6.283, s: .9 + rnd2 * .5, zn: null });
            }
            continue;
          }
          const y = (HILL_VIL.h || hillMeshH)(X, Z);
          if (!Number.isFinite(y) || y < SEA_Y + 3 || shoreAt(X, Z)) continue;
          if (roadD(X, Z) < ROAD_HW + 4.5 || padD(X, Z) < 5 || encNear(X, Z, 30) || nearVia(X, Z)) continue;
          if (parkNo(X, Z)) continue;
          const gx = hillMeshH(X + 2, Z) - hillMeshH(X - 2, Z), gz = hillMeshH(X, Z + 2) - hillMeshH(X, Z - 2);
          const sl = Math.hypot(gx, gz) / 4; if (sl > 1.25 || sl > .9 && rnd3 * .35 < sl - .9) continue;   // 40° 以上漸稀、51° 以上是裸岩（07-kitx.js 的 kxCrag）
          // 樹種：楓樹成片（雜訊高的地方，到處也零星有一成五），高處（> 220 m）冷杉漸多
          const mp = (.15 + .85 * sm01((fn(X / 150 + 40, Z / 150 - 9) - .3) / .3)) * (1 - .8 * sm01((y - 220) / 140));
          // 榛嶺（使用者給的參考圖）：綠色的闊葉雜木林為主（broad），夾著冷杉，楓樹只零星幾棵；選哪一種照位置的雜湊，不多抽 rf()（後面的樹位置不變）
          // 別墅區（山路兩側 25–48 m、平台四周 30–70 m 內）照同一套參考圖：和榛嶺一樣以闊葉樹為主（使用者：別墅區的樣式同步）
          const aw = Math.max(akinaW(X, Z), 1 - sm01((roadD(X, Z) - 25) / 23), 1 - sm01((padD(X, Z) - 30) / 40)), L = rnd2 < mp * (1 - .85 * aw) ? HILL_FOREST.maple : fh(Math.floor(X * 3.1), Math.floor(Z * 3.1)) < .7 * aw ? HILL_FOREST.broad : HILL_FOREST.fir;
          L.push({ x: X, y: y - .15, z: Z, ry: rnd3 * 6.283, s: (.72 + rf() * .5) * (L === HILL_FOREST.broad ? 1.25 : 1), zn: null });   // 闊葉樹大一點，樹冠才連成一片（參考圖）
          // 林下層：每棵樹旁邊 2–6 m 一兩片（冷杉下多蕨、楓樹下多草與紫花）；路邊與平台照樣避開
          for (let u = 0, nu = rf() < .55 ? 1 : 2; u < nu; u++) {
            const ua = rf() * 6.283, ur = 2 + rf() * 4, ux = X + Math.cos(ua) * ur, uz = Z + Math.sin(ua) * ur, uk = rf();
            if (roadD(ux, uz) < ROAD_HW + 2.5 || padD(ux, uz) < 3) continue;
            const uy = (HILL_VIL.h || hillMeshH)(ux, uz); if (!Number.isFinite(uy)) continue;
            HILL_FOREST.und[L === HILL_FOREST.fir ? (uk < .65 ? 'fern' : 'grass') : (uk < .35 ? 'fern' : uk < .65 ? 'flower' : 'grass')].push({ x: ux, y: uy - .03, z: uz, ry: rf() * 6.283, s: .8 + rf() * .45, zn: null });
          }
        }
      }
    }
    if (AKINA && AKINA.lots) for (const [L, m] of [[HILL_FOREST.fir, 4], [HILL_FOREST.maple, 4], [HILL_FOREST.broad, 4], ...Object.values(HILL_FOREST.und).map(u => [u, 1.5])]) { const keep = L.filter(t => !akinaLot(t.x, t.z, m)); L.length = 0; L.push(...keep); }   // OSM 的停車場上不長樹、樹冠也不蓋過去（樹 4 m、林下的草 1.5 m；種完再拿掉，rf() 的順序不變）
    // 冷杉的輪廓（使用者：遠看都一樣）：照位置的雜湊挑三成換成松（forest.py 的 pine），其餘照雜湊拉高變瘦或壓矮變胖（instanced 吃 sx／sy／sz）；種完再分，rf() 的順序不變
    { const F = HILL_FOREST.fir, keep = []; for (const t of F) { const h = fh(Math.floor(t.x * 5.3) + 7, Math.floor(t.z * 5.3) - 3), a = fh(Math.floor(t.x * 2.9), Math.floor(t.z * 2.9) + 11), b = fh(Math.floor(t.z * 4.1) + 5, Math.floor(t.x * 4.1)); if (h < .3) { t.sx = t.sz = t.s * (.85 + .35 * a); t.sy = t.s * (.9 + .3 * b); HILL_FOREST.pine.push(t); } else { t.sx = t.sz = t.s * (.78 + .44 * a); t.sy = t.s * (.82 + .4 * b); keep.push(t); } } F.length = 0; F.push(...keep); }
    HILL_FOREST.n = { tried, fir: HILL_FOREST.fir.length, pine: HILL_FOREST.pine.length, maple: HILL_FOREST.maple.length, broad: HILL_FOREST.broad.length, fern: HILL_FOREST.und.fern.length, flower: HILL_FOREST.und.flower.length, grass: HILL_FOREST.und.grass.length };
  }
  // 護欄：路肩外 3.5 m 比路面低 1.5 m 以上、或 8 m 外低 4 m 以上（山網格外也算）的那一側，路肩上每 4 m 一根鍍鋅鋼柱、掛一條 W 型鋼板。
  // 車道口 8 m 內、別的路接進來的地方、路口頭兩段不立。碰撞是沿路段斜放的薄盒（frameW），ly／hy 只擋這一層路面（上下疊的路不互擋），low：子彈與相機過得去
  {
    let n = 0, nOsm = 0, nAk = 0;
    const drop = (x, z, nx, nz, y) => { const a = hillMeshH(x + nx * (ROAD_HW + 3.5), z + nz * (ROAD_HW + 3.5)), b = hillMeshH(x + nx * (ROAD_HW + 8), z + nz * (ROAD_HW + 8)); return !(a > y - 1.5) || !(b > y - 4); };
    for (const R of roads) for (let k = 2; k + 1 < R.length; k++) {
      const A = R[k], B = R[k + 1], L = Math.hypot(B[0] - A[0], B[1] - A[1]); if (L < .5) continue;
      const tx = (B[0] - A[0]) / L, tz = (B[1] - A[1]) / L, hp = R.akina ? akinaPin(R, k) : 0;
      for (const sd of [-1, 1]) {
        const nx = -tz * sd, nz = tx * sd, out = hp && Math.sign(hp) === -sd;   // out：髮夾彎外側（轉向的另一邊）
        if (R.akina && (R.br[k] || R.gap[k] === sd)) continue;   // OSM：橋上是 22-akina.js 的高欄，支路口那一側留開口
        // 榛嶺的髮夾彎外側：不管落差一律立護欄（紅白相間），另外每 12 m 一面黑底白箭頭的導向牌
        if (out && k % 3 === 0) akinaChevron(rk, A, tx, tz, nx, nz, ROAD_HW + 1.9, hp);
        const osmR = R.akina && R.rail[k] & (sd > 0 ? 1 : 2);   // OSM 畫了 guard_rail 的那一段：不看落差照樣立
        if (!out && !osmR && (!drop(A[0], A[1], nx, nz, A[2]) || !drop(B[0], B[1], nx, nz, B[2]) || !drop((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, nx, nz, (A[2] + B[2]) / 2))) continue;
        // 榛嶺的彎很急：鋼板兩端照前後兩點平均的法線推出去（相鄰兩段共用端點），不然彎道外側一段一段斷開
        const pn = j => { const p = R[Math.max(0, j - 1)], q = R[Math.min(R.length - 1, j + 1)], l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; return [-(q[1] - p[1]) / l * sd, (q[0] - p[0]) / l * sd]; };
        const [anx, anz] = pn(k), [bnx, bnz] = pn(k + 1);
        const o = ROAD_HW + .85, ax = A[0] + anx * o, az = A[1] + anz * o, bx = B[0] + bnx * o, bz = B[1] + bnz * o, mx = (ax + bx) / 2, mz = (az + bz) / 2;
        if (drvW.some(([X, Z]) => Math.hypot(X - mx, Z - mz) < 8)) continue;
        let cross = false; segEach(mx, mz, ROAD_HW + .3, () => { cross = true; }); if (cross) continue;
        const ya = A[2] + .22, yb = B[2] + .22, ry = Math.atan2(tx, tz);
        // 榛嶺與別墅區（參考圖）：白色水泥柱、白漆的鋼板（日本山路的護欄），髮夾彎外側一段紅一段白
        rk.box(ax, ya + .4, az, .15, .8, .15, 0xb4b0a6, TX.conc, 0, ry, 0);
        rk.bar(ax - tx * .02, ya + .6, az - tz * .02, bx + tx * .02, yb + .6, bz + tz * .02, .05, .32, out && k % 2 ? 0xa82a24 : 0xcfd0cc, TX.iron);   // 白漆的鋼板（21 塗漆的鐵：粉化、掉漆、鏽斑與鏽水痕）
        colliders.push({ x0: -.1, x1: L + .1, z0: -.12, z1: .12, zn: frameW(ax, az, bx - ax, bz - az), ly: Math.min(ya, yb) - 2, hy: Math.max(ya, yb) + .9, low: 1 });
        n++; if (osmR) nOsm++; else if (R.akina) nAk++;
      }
    }
    HILL.rails = n; HILL.railsAk = { osm: nOsm, more: nAk };   // 榛嶺：照 OSM 立的段數、OSM 沒畫但照落差／髮夾彎補上的段數
  }
  HILL.homes = { roads: roads.length, homes: HILL_HOMES.length, rej, rails: HILL.rails }; HILL_HOMES.rej = rej; HILL_HOMES.roads = roads.length;
  HILL.roadD = roadD; HILL.roadHW = ROAD_HW; HILL.mouths = roads.filter(p => !p.link || p.mouth).map(p => p[0]); HILL.paths = roads;   // 29-villa.js：山路的地面、外緣隱形牆在路口開口
  cityAdd(new T.Mesh(rk.build(), MAT.ux), null);
}
// 水深（水面在 SEA_Y）：陸地矩形與沙灘外的淺水照 groundH，其他地方照外緣外的地形 hillH（世界座標）
const seaFloorL = (x, z) => inLand(x, z) || x >= BEACH.x0 && x <= BEACH.x1 && z > BEACH.z0 ? groundHL(x, z) : -8;
const seaFloor = (X, Z) => {
  const ph = parkGround(X, Z); if (ph !== null) return ph;
  const eh = encGround(X, Z); if (eh !== null) return eh;   // 雲梯城寨的平台與切坡
  if (tronLandW(X, Z)) return 0;   // 光格島上（含下層街區）不算水
  if (airLandW(X, Z)) return 0;    // 機場島與堤道
  if (nbrIn(X, Z)) return nbrH(X, Z);   // 09-nbr.js：機場南面的紐柏林（含海崖外圈）
  if (inCity(X, Z)) { const zn = zoneAtW(X, Z); return zn ? groundHL(...zoneLocal(zn, X, Z)) : 0; }
  const zn = zoneAtW(X, Z); if (!zn) return hillH(X, Z);   // 海上的縫：同 landW
  const [x, z] = zoneLocal(zn, X, Z), f = seaFloorL(x, z);
  return f > -8 ? f : hillH(X, Z);
};
const waterDepth = (X, Z) => Math.max(0, SEA_Y - seaFloor(X, Z));

// ─── 碰撞的空間索引：室外的靜態盒與圓柱放進 24 m 的格子，查詢只看附近幾格（20×15 的城市有上萬個圓柱：路燈、停車、設施）。
// 陣列長度變了就重建；同一幀先刪後加、長度沒變的地方（搶車、打爛電訊箱、路障）要呼叫 colDirty()。室內的碰撞表很小，直接回傳整個陣列。
const COL_S = 24;
// 生成時碰撞表是邏輯座標；開場的 cityWorld()（99-main.js）一次換成世界座標：盒保留邏輯 AABB，f 是所屬的區（null 是世界座標），
// bx0…bz1 是世界座標的外接框（空間索引與粗篩用）；圓柱直接換成世界座標（w = 1）。之後執行時加進來的盒與圓柱都是世界座標
let cityIsWorld = false;
// 彎曲的片：盒換成自己的仿射座標框（frameA，盒中心那一點的伸縮與斜切，和 frameM4 同一個 R·J；盒變成以中心為原點、邏輯尺寸不變，世界裡是平行四邊形），
// 長的盒先切成 ≤ 24 m 的幾段（boxSplitW），剩下的誤差只有彎曲（24 m 的盒角落約 0.4 m）。以前的框只照 x 軸，斜切 20° 的片沿 z 的牆會偏 3 m（空氣牆）
function boxToW(b, zn = zoneAtL((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2)) {
  if (zn && zn.W) {
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, o = warpJ(zn.W, cx, cz), c = zn.c, s = zn.s;
    const [X, Z] = toW(cx, cz, zn), hx = (b.x1 - b.x0) / 2, hz = (b.z1 - b.z0) / 2;
    b.x0 = -hx; b.x1 = hx; b.z0 = -hz; b.z1 = hz;
    const z0 = zn; zn = frameA(X, Z, c * o[2] + s * o[4], c * o[3] + s * o[5], -s * o[2] + c * o[4], -s * o[3] + c * o[5]);
    zn.lc = [cx, cz, z0];   // 盒中心的邏輯座標與所屬的片（驗收比對用；片的接縫附近 toL 可能猜到隔壁片）
  }
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
    const parts = zoneClip(b.x0, b.x1, b.z0, b.z1).flatMap(boxSplitW);
    if (parts.length > 1) colliders.splice(k, 1, ...parts.map(r => boxToW({ ...b, x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1 }, r.zn)));
    else boxToW(b, parts.length ? parts[0].zn : null);
  }
  for (const c of circles) circleToW(c);
  for (const f of worldHooks) f();
  cityIsWorld = true; colDirty();
}
// 彎曲的片裡，長的盒切成幾段（每段各自一個座標框，相鄰兩段重疊 0.3 m）；城外很遠的（1e5）不切
function boxSplitW(r) {
  if (!r.zn || !r.zn.W) return [r];
  const L = 24, w = r.x1 - r.x0, h = r.z1 - r.z0;
  if (w > 4000 || h > 4000) return [r];
  const nx = Math.max(1, Math.ceil(w / L)), nz = Math.max(1, Math.ceil(h / L)), out = [];
  if (nx * nz === 1) return [r];
  for (let a = 0; a < nx; a++) for (let c = 0; c < nz; c++) out.push({ zn: r.zn, x0: r.x0 + w * a / nx - (a ? .15 : 0), x1: r.x0 + w * (a + 1) / nx + (a < nx - 1 ? .15 : 0), z0: r.z0 + h * c / nz - (c ? .15 : 0), z1: r.z0 + h * (c + 1) / nz + (c < nz - 1 ? .15 : 0) });
  return out;
}
const addBoxL = b => { if (!cityIsWorld) { colliders.push(b); colDirty(); return b; } const zn = b.zn || zoneAtL((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2), parts = boxSplitW({ zn, x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1 }); if (parts.length === 1) colliders.push(boxToW(b, b.zn || zn)); else for (const r of parts) colliders.push(boxToW({ ...b, x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1 }, zn)); colDirty(); return b; };
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
