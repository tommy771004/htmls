
// ═══ 城市：街區、建築立面、路面與人行道 ═══
await bootStep(BOOT.city, '正在鋪路…');
import PROPS_SPEC from '../../../../assets/260/props/props.json';
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
  const posK = names.indexOf('position');
  for (let t = 0; t < n; t++) {
    if (parts) while (pk < parts.length && parts[pk] <= t * 3) { pOut.push(out[posK].length / 3); pk++; }
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
// 世界座標的點在陸地上：外緣裡面，或在上面那些矩形裡（換到點所在那一片的邏輯座標）
const landW = (X, Z) => { if (inCity(X, Z)) return true; const zn = zoneOfW(X, Z); return !!zn && inLand(...zoneLocal(zn, X, Z)); };
// ─── 岬角（世界座標的草地多邊形）：外緣改成不規則的多邊形之後不需要了，留著空的表（21-coast、地圖照樣迭代） ───
const CAPES = [];
// 北嶺公園（下面 hillH 之後建好；畫面在 21-park.js）。開場在那之前問地面高度的（groundH、seaFloor）就當沒有公園
let NPARK = null;
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
const district = (x, z) => {
  const i = (x - X0) / P, j = (z - Z0) / Q;
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
blocks.forEach(makeLots);   // 外圍的樓牆（outer）已經拿掉：片外圍到外緣之間是草地，北面與東面的外面是山
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

// ─── 外緣（05-zones.js 的 CITY_POLY，世界座標）───
// 臨水的邊：4 m 厚的低擋牆（low），外面是沙灘、碼頭這些矩形的那幾段不擋；沿岸每 260 m 一座梯子（擋牆在那裡留 2.2 m 的 swim 缺口）。
// 靠山的邊：一道看不見的高牆。SHORE 是把外緣在擋牆的頭尾切開之後的多邊形，wet[k] 標出臨水的邊（21-coast.js 沿這些邊裝欄杆、
// 路燈、護岸，鋪碎石步道，和以前的岬角同一套）
const SHORE = (() => {
  const P = CITY_POLY, n = P.length, sg = polyArea(P) > 0 ? 1 : -1, pts = [], wet = [];
  let lad = 130;
  for (let k = 0; k < n; k++) {
    const p = P[k], q = P[(k + 1) % n], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (L < .01) continue;
    const ux = (q[0] - p[0]) / L, uz = (q[1] - p[1]) / L, ox = uz * sg, oz = -ux * sg, f = frameW(p[0], p[1], ux, uz), zo = ox * f.s + oz * f.c > 0 ? 1 : -1;   // zo：往外是局部 +z 還是 −z
    const box = (a, b, extra) => colliders.push({ x0: a, x1: b, z0: zo > 0 ? 0 : -4, z1: zo > 0 ? 4 : 0, zn: f, ...extra });
    if (!shoreEdge(k)) { box(-3, L + 3, { edge: 1 }); pts.push(p); wet.push(0); continue; }
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
  const S = { name: '', pts, wet, caps: [] };
  const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  S.bb = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  S.inn = polyInset(pts, wet.map(w => w ? 6 : 0));
  S.walk = [1, 3.4].map(d => polyInset(pts, wet.map(w => w ? d : 0)));
  return S;
})();

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
        shopUnits.push({ x, z, nx: nrm[0], nz: nrm[1], w: uw, shut: (mask >> u) & 1, lot: L, special: L.special });
        if (k === 'pz' && aptDoorOn(x - uw / 2, x + uw / 2, z)) masks[k][0] |= 1 << u;
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
function distCull(cx, cz) { const k = detailK() ** 2; for (const c of cullList) c.obj.visible = (c.x - cx) ** 2 + (c.z - cz) ** 2 < c.r * c.r * k; }   // SET.dist：Esc 選單的細節距離
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
for (const B of chunkBuf.values()) chunkMesh(B);
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
  const lawnMat = new T.ShaderMaterial({ uniforms: { ...shared(ALLU), ...reflU }, vertexShader: GROUND_VS, fragmentShader: LAWN_FS }), lawns = new Map();
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
  const seamMat = new T.ShaderMaterial({ uniforms: { ...shared(ALLU), ...reflU }, vertexShader: GROUND_VS, fragmentShader: LAWN_FS.replace(/float path = max\([^;]*\);/, 'float path = 0.;'),
    side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 });
  const pos = [], nor = [];
  for (const P of [CITY_POLY, ...CAPES.map(h => h.pts)]) {   // 岬角的草地也在這裡（同一個材質）
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
  for (const h of [...CAPES, SHORE]) {   // 外緣臨水的邊也一樣
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
  const connMat = new T.ShaderMaterial({ uniforms: { ...shared(ALLU), ...reflU }, vertexShader: vs, fragmentShader: fs, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const P = [], N = [], UV = [], AX = [], I = [];
  for (const e of RN.edges) {
    if (e.kind !== 'c' && e.kind !== 'd' && e.kind !== 'f') continue;   // 連接道路、斜的大道與快速道路（06-roads.js）
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
    for (const r of PIERS) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r.h;
    for (const r of FERRY) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r.h;
    for (const r of BANK_WALKS) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r.h;
    if (x >= BEACH.x0 && x <= BEACH.x1 && z > BEACH.z0) return -Math.min(1, (z - BEACH.z0) / BEACH.len) * BEACH.drop;   // 沙灘
    return 0;
  }
  const i = Math.floor((x - X0) / P), j = Math.floor((z - Z0) / Q);
  if (i < 0 || j < 0 || i >= NX || j >= NZ || cellDropped(i, j)) return 0;
  return x > avX(i) + HR && x < avX(i + 1) - HR && z > stZ(j) + HR && z < stZ(j + 1) - HR && plazaD(x, z) >= HR ? .15 : 0;   // 廣場裡斜的大道是路面
};
// 執行時（玩家、車、行人、警察）用的是世界座標：先換回邏輯座標
// 片裡面照邏輯座標查；片之間的空地（外緣裡）高度 0；外緣外面換到最近那一片的邏輯座標（沙灘、碼頭、棧橋）
const groundH = (X, Z) => { const ph = parkGround(X, Z); if (ph !== null) return ph; const zn = zoneAtW(X, Z); if (!zn && inCity(X, Z)) return 0; const [x, z] = zoneLocal(zn || zoneNearW(X, Z), X, Z); return groundHL(x, z); };
const onRoad = (X, Z) => groundH(X, Z) === 0;
const districtW = (X, Z) => {
  if (parkHas(X, Z)) return NPARK.name;
  const zn = zoneOfW(X, Z); let [x, z] = toL(X, Z, zn);
  if (zn && inCity(X, Z)) { x = clamp(x, zn.x0, zn.x1); z = clamp(z, zn.z0, zn.z1); }   // 片之間的縫（快速道路）：算最近那片的地名，不要外插到海邊的地名
  return district(x, z);
};
// ─── 外緣外面的地形（世界座標）：臨水那一側是 8 m 深的海；靠山那一側從外緣往外慢慢升高（21-coast.js 的山照這個建網格），
// 山和海交界的角度之間平滑過渡；舊城北邊河谷（RIVER_E 以西、FAR_Z1 以北）挖成河道，對岸（FAR_BANK_X 以西）壓在對岸的地面底下 ───
const HILL = (() => {
  const P = CITY_POLY, n = P.length, [cx, cz] = CITY_C, R = P.map(p => Math.hypot(p[0] - cx, p[1] - cz));
  // 每個頂點靠山的程度（臨水 0、靠山 1），左右各平滑 5 個頂點（10°）
  const W = CITY_SHORE.map((_, k) => { let a = 0; for (let d = -5; d <= 5; d++) a += CITY_SHORE[(k + d + n) % n] ? 0 : 1; return a / 11; });
  return { cx, cz, R, W, n };
})();
const hillAt = a => { const H = HILL, t = ((a + (ZONE_ROT || 0)) * 90 / Math.PI % H.n + H.n) % H.n, k = Math.floor(t), f = t - k, k1 = (k + 1) % H.n; return [H.R[k] * (1 - f) + H.R[k1] * f, H.W[k] * (1 - f) + H.W[k1] * f]; };
function hillH(X, Z) {
  const a = Math.atan2(Z - HILL.cz, X - HILL.cx), [R, w] = hillAt(a), d = Math.max(0, Math.hypot(X - HILL.cx, Z - HILL.cz) - R);
  const n1 = .55 + .3 * Math.sin(a * 5 + 1.3) + .15 * Math.sin(a * 13 + .4), hd = dd => (1 - Math.exp(-dd / 320)) * (70 + 380 * n1) * (.85 + .15 * Math.sin(dd * .011 + a * 3)) + .3;
  // 北嶺公園那個方向（HILL.park，弳度）是一道緩一點的山谷：離外緣的距離打 0.45 折，左右約 ±9° 漸漸接回原本的坡
  const pa = HILL.park === undefined ? 0 : Math.exp(-(((((a - HILL.park + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) / .16) ** 2));
  let h = w <= 0 ? -8 : pa > .01 ? hd(d) * (1 - pa) + hd(d * .45) * pa : hd(d);
  if (w > 0 && w < 1) h = -8 + (h + 8) * w * w * (3 - 2 * w);
  // 舊城北邊的河谷（A1 沒有轉，邏輯 ≈ 世界）
  const [lx, lz] = toL(X, Z, ZONES[0]);
  if (lz < FAR_Z1 + 40 && lx > FAR_BANK_X - 40 && lx < RIVER_E + 120) h = Math.min(h, lx < FAR_BANK_X ? -.6 : -8 + 8.3 * sm01((lx - RIVER_E - 10) / 110));
  else if (lx < FAR_BANK_X && lz < FAR_Z1) h = Math.min(h, -.6);
  return h;
}
// ─── 山坡的網格高度：21-coast.js 的山是 CITY_C 為中心的極座標網格（外緣每個頂點一條射線，往外 HILL_D 那幾圈），網格之間是平面三角形，
// 兩圈之間會比 hillH 低。站在坡上的東西（北嶺公園的步道、樹、圍籬、玩家）照網格的高度才會貼著畫出來的坡 ───
const HILL_D = [0, 3, 8, 16, 30, 55, 90, 140, 210, 300, 420, 580, 800, 1100, 1500, 2000, 2700, 3500];
const hillV = (k, j) => { const p = CITY_POLY[k], s = (HILL.R[k] + HILL_D[j]) / HILL.R[k]; return [HILL.cx + (p[0] - HILL.cx) * s, HILL.cz + (p[1] - HILL.cz) * s]; };
function hillMeshH(X, Z) {
  const n = CITY_POLY.length, m = HILL_D.length;
  if (!HILL.vh) { HILL.vh = new Float32Array(n * m); for (let k = 0; k < n; k++) for (let j = 0; j < m; j++) HILL.vh[k * m + j] = hillH(...hillV(k, j)); }
  const a0 = Math.atan2(CITY_POLY[0][1] - HILL.cz, CITY_POLY[0][0] - HILL.cx), a = Math.atan2(Z - HILL.cz, X - HILL.cx);
  const k0 = Math.floor((((a - a0) / (2 * Math.PI) * n) % n + n) % n), r = Math.hypot(X - HILL.cx, Z - HILL.cz);
  for (const k of [k0, (k0 + n - 1) % n, (k0 + 1) % n]) {
    const k1 = (k + 1) % n;
    for (let j = 0; j < m - 1; j++) {
      if (r < Math.min(HILL.R[k], HILL.R[k1]) + HILL_D[j] - 40 || r > Math.max(HILL.R[k], HILL.R[k1]) + HILL_D[j + 1] + 40) continue;
      // 和 21-coast.js 一樣的兩個三角形：(k, j) (k1, j) (k, j+1)；(k, j+1) (k1, j) (k1, j+1)
      for (const T3 of [[[k, j], [k1, j], [k, j + 1]], [[k, j + 1], [k1, j], [k1, j + 1]]]) {
        const [A, B, C] = T3.map(([kk, jj]) => hillV(kk, jj)), den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
        if (Math.abs(den) < 1e-9) continue;
        const u = ((B[1] - C[1]) * (X - C[0]) + (C[0] - B[0]) * (Z - C[1])) / den, v = ((C[1] - A[1]) * (X - C[0]) + (A[0] - C[0]) * (Z - C[1])) / den, w = 1 - u - v;
        if (u < -1e-6 || v < -1e-6 || w < -1e-6) continue;
        const [ha, hb, hc] = T3.map(([kk, jj]) => HILL.vh[kk * m + jj]);
        return u * ha + v * hb + w * hc;
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
const parkH = (x, z) => { const [X, Z] = toW(x, z, NPARK.f); return inCity(X, Z) ? 0 : hillMeshH(X, Z); };
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
// 世界座標的點在公園的範圍裡（圍籬裡、外緣外）；公園的地面高度（觀景台的平台、山坡），不在公園裡回傳 null
function parkHas(X, Z) {
  if (!NPARK) return false;
  const [x, z] = parkL(X, Z), W = NPARK.walk;
  return x > W.x0 - 1 && x < W.x1 + 1 && z > W.z0 - 1 && z < 200 && !inCity(X, Z);
}
function parkGround(X, Z) {
  if (!NPARK) return null;
  const [x, z] = parkL(X, Z);
  if (x < NPARK.x0 || x > NPARK.x1 || z < NPARK.z0 || z > 200 || inCity(X, Z)) return null;
  const L = NPARK.look;
  return x >= L.x0 && x <= L.x1 && z >= L.z0 && z <= L.z1 ? L.h : hillMeshH(X, Z);
}
// 山坡上的住宅：外緣靠山那一側（北面與東面）的山坡，離外緣 30–550 m 散著低矮的房子（世界座標，底部貼著 hillH；夜裡窗燈像好萊塢山）
{
  const B = buf('sky', null); const r2 = rng(77), [cx, cz] = CITY_C;
  // 從中心往 a 方向量到外緣的距離
  const edgeR = a => { const dx = Math.cos(a), dz = Math.sin(a); let best = 0; for (let k = 0; k < CITY_POLY.length; k++) { const p = CITY_POLY[k], q = CITY_POLY[(k + 1) % CITY_POLY.length], ex = q[0] - p[0], ez = q[1] - p[1], den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue; const t = ((p[0] - cx) * ez - (p[1] - cz) * ex) / den, u = ((p[0] - cx) * dz - (p[1] - cz) * dx) / den; if (t > 0 && u >= 0 && u <= 1) best = Math.max(best, t); } return best; };
  for (let k = 0; k < 900; k++) {
    const a = r2() * Math.PI * 2, rr = 30 + r2() ** 1.6 * 520;
    const w = 10 + r2() * 14, d = 8 + r2() * 10, h = 5 + r2() * 9, sd = r2() * 1000, st = r2() < .6 ? 2 : 3;
    const R = edgeR(a) + rr, x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R;
    if (shoreAt(x, z) || polyDistPt(CITY_POLY, x, z) < 30) continue;   // 只蓋在山那一側
    { const [px, pz] = parkL(x, z); if (px > NPARK.x0 - 20 && px < NPARK.x1 + 20 && pz > NPARK.z0 - 20) continue; }   // 北嶺公園的範圍不蓋
    // 坐在山坡上：底部在四個角最低那點往下 1 m，屋頂高度從最高那點量起
    const hs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => hillH(x + u * w / 2, z + v * d / 2)), y0 = Math.min(...hs) - 1, y1 = Math.max(...hs) + h;
    if (y0 < 1) continue;
    boxFaces(B, x - w / 2, x + w / 2, z - d / 2, z + d / 2, y0, y1, sd, st, null, y1 - y0, null);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(B.p, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(B.n, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(B.uv, 2));
  g.setAttribute('aB', new T.Float32BufferAttribute(B.b, 4));
  g.setAttribute('aB2', new T.Float32BufferAttribute(B.b2, 4));
  g.setIndex(B.idx); g.computeBoundingSphere();
  const m = new T.Mesh(g, MAT_FACADE); m.matrixAutoUpdate = false; cityAdd(m, null);
}

// 水深（水面在 SEA_Y）：陸地矩形與沙灘外的淺水照 groundH，其他地方照外緣外的地形 hillH（世界座標）
const seaFloorL = (x, z) => inLand(x, z) || x >= BEACH.x0 && x <= BEACH.x1 && z > BEACH.z0 ? groundHL(x, z) : -8;
const seaFloor = (X, Z) => {
  const ph = parkGround(X, Z); if (ph !== null) return ph;
  if (inCity(X, Z)) { const zn = zoneAtW(X, Z); return zn ? groundHL(...zoneLocal(zn, X, Z)) : 0; }
  const [x, z] = toL(X, Z), f = seaFloorL(x, z);
  return f > -8 ? f : hillH(X, Z);
};
const waterDepth = (X, Z) => Math.max(0, SEA_Y - seaFloor(X, Z));

// ─── 碰撞的空間索引：室外的靜態盒與圓柱放進 24 m 的格子，查詢只看附近幾格（20×15 的城市有上萬個圓柱：路燈、停車、設施）。
// 陣列長度變了就重建；同一幀先刪後加、長度沒變的地方（搶車、打爛電訊箱、路障）要呼叫 colDirty()。室內的碰撞表很小，直接回傳整個陣列。
const COL_S = 24;
// 生成時碰撞表是邏輯座標；開場的 cityWorld()（99-main.js）一次換成世界座標：盒保留邏輯 AABB，f 是所屬的區（null 是世界座標），
// bx0…bz1 是世界座標的外接框（空間索引與粗篩用）；圓柱直接換成世界座標（w = 1）。之後執行時加進來的盒與圓柱都是世界座標
let cityIsWorld = false;
// 彎曲的片：盒換成自己的座標框（frameW，盒中心那一點的局部方向與伸縮，盒變成以中心為原點），長的盒先切成 ≤ 36 m 的幾段（boxSplitW）
function boxToW(b, zn = zoneAtL((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2)) {
  if (zn && zn.W) {
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, o = warpJ(zn.W, cx, cz), a = o[2], c = o[4], bb = o[3], d = o[5];
    const [X, Z] = toW(cx, cz, zn), [ux, uz] = dirW(zn, 1, 0, cx, cz), sx = Math.hypot(a, c), sz = Math.hypot(bb, d);
    const hx = (b.x1 - b.x0) / 2 * sx, hz = (b.z1 - b.z0) / 2 * sz;
    b.x0 = -hx; b.x1 = hx; b.z0 = -hz; b.z1 = hz; zn = frameW(X, Z, ux, uz);
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
  const L = 36, w = r.x1 - r.x0, h = r.z1 - r.z0;
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
