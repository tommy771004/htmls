// ═══ 第五部曲之四：街道的微結構（neon_nightcity_gta_v3.md 第二節「建築物微結構與街道家具」） ═══
// 撞擊看衝量 J = 車重 × 撞上去的速度（法向分量，N·s），門檻照規格書（ST_J）：落地玻璃 800、施工圍籬 3500、候車亭與電話亭 9000；
// 1600 kg 的轎車分別是時速 2、8、20 km/h，280 kg 的機車要時速 116 才撞得倒候車亭。沒過門檻的照一般碰撞擋住。
// ‧路邊施工區 ST_SITES：大道停車道上圍起來的一段（挖開的路面、鋼板、土堆、發電機、工作燈），三面是臨時鐵絲網圍籬（一片 2.4 m、水泥墩腳），
//   上游端擺兩座紐澤西護欄、一排交通錐與「道路施工」立牌。圍籬被撞（> 3500）整排依序倒下（離撞點每片晚 0.07 秒，倒向車子前進的方向），
//   倒在地上的圍籬車子開過去會刮出火花與聲音、稍微拖慢。交通錐一碰就飛。
// ‧紐澤西護欄（ST_JERSEY_M 1200 kg；包括 20-props.js 原本 Atlas Av 施工段的兩座，畫面與碰撞改由這裡管）：轎車撞上照一般碰撞彈開，
//   時速 70 以上正面撞上會被斜面鏟起來翻飛；車重 3000 kg 以上（運鈔車、戰車、裝甲車）能推著它走。
// ‧熱狗攤：攤車、遮陽傘、醬料（v5street.glb；以檔案開啟是程式建模）與把手下面的紅色液化瓦斯鋼瓶。車撞上去遮陽傘與醬料飛走、攤車翻倒；
//   時速 50 以上撞上或鋼瓶中兩槍：鋼瓶噴火 2 秒後炸開（半徑 7 m）。附近的爆炸會直接引燃（連鎖）。
// ‧公車候車亭（v5street.glb 的 shelter，開口朝馬路，前面前後 8 m 不停車）：背牆三片玻璃打一槍就碎，車撞（> 800）碰到的那幾片也碎；超過 9000 整座連根拔起翻滾。
// ‧電話亭（20-props.js 的 booths）：打一槍玻璃碎（碎片飛出來，模型照舊）；車撞超過 9000 連根拔起。
// ‧VELOCE MOTORS 的落地窗（55-motor-front.js 兩面展示窗前加六片玻璃）：一槍或車撞（> 800）就碎成幾十片反光的三角碎片。
//   展示廳是另一個場景（60-venues.js），所以只能從外面撞碎、車開不進去；規格書寫的是從二樓展示廳撞出來。
// ‧銀行門前的液壓防撞柱（69-heist.js 的 BANK，10 St 路緣一排）：不會壞；時速 60 以上撞上車頭全毀（剩兩成耐久、冒黑煙熄火），
//   駕駛不管有沒有繫安全帶都從擋風玻璃飛出去（69-v3-crash.js 的 ejectPlayer）。
// 碰撞圓沿用 69-v3-break.js 的做法（位置搬到很遠，不重建索引）；推著走的護欄改用 30-vehicles.js 的 dynMore（每幀跟著動的圓）。
// 碎玻璃（st.shards）與翻滾的設施（st.tumble）是自己的實例。排在 69-v5-shops 之後：頂層只用 69-v5-shops 以前的東西。

const ST_J = { glass: 800, fence: 3500, shelter: 9000 };   // 衝量門檻（N·s）
const ST_TANK_V = 50 / 3.6, ST_TANK_SHOTS = 2, ST_TANK_FUSE = 2, ST_TANK_R = 7, ST_TANK_DMG = 300;   // 瓦斯鋼瓶：撞破的車速、中幾槍、噴火幾秒、爆炸半徑與傷害
const ST_JERSEY_M = 1200, ST_PUSH_M = 3000, ST_LAUNCH_V = 70 / 3.6, ST_BOLLARD_V = 60 / 3.6;
const ST_PL = 2.4;   // 一片圍籬的長度
const st = { items: [], grid: new Map(), rays: [], jersey: [], cones: [], fence: [], fallen: [], shards: [], tumble: [], fires: [], ready: false,
  n: { glass: 0, fence: 0, shelter: 0, booth: 0, hotdog: 0, tank: 0, jersey: 0, launch: 0, push: 0, bollard: 0, cone: 0 } };
const _stM = new T.Matrix4(), _stM2 = new T.Matrix4(), _stM3 = new T.Matrix4(), _stQ = new T.Quaternion(), _stV = V3(), _stS = V3(), _stE = new T.Euler(), _stZero = new T.Matrix4().makeScale(0, 0, 0);

// ─── 路邊施工區（邏輯座標）：大道 i 在街區 j 那一段的停車道。side −1 是大道 x 負側（車往 +z 開）、+1 是 x 正側（車往 −z）。
// 30-vehicles.js 擺完路邊車之後用 streetParkClear() 清掉這幾段（不改 rT 的序列），所以這裡只用 30-vehicles 以前的東西 ───
function stSitesL() {
  if (stSitesL.c) return stSitesL.c;
  const R = rng(5207), out = [], ZA = 20, L = 9 * 2.4;   // 路口過後 20 m 起、9 片圍籬（21.6 m；30-vehicles.js 呼叫的時候這個檔的常數還沒宣告，ST_PL 不能用）
  const facBlk = (i, j) => Object.values(FAC).some(F => F.i === i && F.j === j);
  const blk = (i, j) => blocks.find(b => !b.outer && b.i === i && b.j === j);
  const cand = [];
  for (let i = 1; i < NX; i++) for (let j = 0; j < NZ; j++) for (const side of [-1, 1]) cand.push([i, j, side, R()]);
  cand.sort((a, b) => a[3] - b[3]);
  const avoid = [KESTREL_SPOT, DEAL_SPOT, HOME_SPOT, HOSP, PD];
  for (const [i, j, side] of cand) {
    if (out.length >= 8) break;
    if (i === 1 && j === 2) continue;   // Atlas Av 原本就有一段施工（20-props.js 的 works）
    const bi = side < 0 ? i - 1 : i, b = blk(bi, j), b2 = blk(side < 0 ? i : i - 1, j);
    if (!b || !b2 || facBlk(bi, j) || facBlk(side < 0 ? i : i - 1, j) || b.park || b.plaza || b2.plaza) continue;
    const x = avX(i) + side * PARK, za = stZ(j) + ZA, zb = za + L, up = side < 0 ? -1 : 1;   // up：往上游（車流的來向）
    const c0 = side < 0 ? za - 14 : za, c1 = side < 0 ? zb : zb + 14, zn = zoneAtL(x, (za + zb) / 2);
    if (!zn) continue;
    let ok = true;
    for (let z = c0; z <= c1 && ok; z += 1.5) for (const dx of [-7, 0, 1.4]) {
      const xx = x + side * dx;
      if (!inZoneL(zn, xx, z) || plazaD(xx, z) < HR + 3 || rampBlock(xx, z) || garDrive(xx, z)) ok = false;
    }
    if (!ok || avoid.some(o => Math.abs(o.x - x) < 12 && o.z > c0 - 20 && o.z < c1 + 20) || out.some(o => Math.hypot(o.x - x, o.za - za) < 260)) continue;
    out.push({ i, j, side, up, x, za, zb, c0, c1, zn, xl: avX(i) + side * 5.25, curb: avX(i) + side * HR });
  }
  return (stSitesL.c = out);
}
// 30-vehicles.js 擺完路邊車之後呼叫：施工區那幾段（連上游的交通錐與立牌）不停車
function streetParkClear() {
  for (const s of stSitesL()) for (let i = parked.length - 1; i >= 0; i--) {
    const c = parked[i];
    if (Math.abs(c.x - s.x) < 1.6 && c.z > s.c0 - 3 && c.z < s.c1 + 3) parked.splice(i, 1);
  }
}
const ST_SITES = stSitesL();

// ─── 擺放（邏輯座標）：施工區的圍籬、護欄、交通錐、熱狗攤；人行道的候車亭與熱狗攤；銀行的防撞柱；車行的落地窗 ───
const ST_FB = Object.values(FAC);
const stDoorW = (() => {   // 不擋門口：場館的門、提款機、拉麵攤（世界座標）
  const o = [];
  for (const V of Object.values(VENUES)) if (V.door) o.push(V.door);
  for (const a of ATM_SPOTS) o.push(toW(a.x, a.z));
  for (const r of ramenSpots) o.push(toW(r.x, r.z));
  return o.map(p => (Array.isArray(p) ? p : [p.x, p.z]));
})();
const stSpotOK = (x, z, r) => free(x, z, r) && plazaD(x, z) >= HR + 4 && !rampBlock(x, z) && !garDrive(x, z)
  && !ST_FB.some(F => x > F.ax - 1 && x < F.ax + P + 1 && z > F.az - 1 && z < F.az + Q + 1)
  && !ST_SITES.some(s => Math.abs(x - s.x) < 12 && z > s.c0 - 6 && z < s.c1 + 6)
  && (() => { const [wx, wz] = toW(x, z); return !stDoorW.some(([dx, dz]) => Math.hypot(dx - wx, dz - wz) < 6); })();
const stFence = [], stJerseyL = [], stConesL = [], stands = [], shelters = [], stBollardsL = [], stPanesL = [];
// 物件的局部座標 (lx, lz) 轉到邏輯座標（ry 是邏輯座標的 yaw：0 朝 +z、π/2 朝 +x）
const stLoc = (o, lx, lz) => [o.x + lx * Math.cos(o.ry) + lz * Math.sin(o.ry), o.z - lx * Math.sin(o.ry) + lz * Math.cos(o.ry)];
for (const [si, s] of ST_SITES.entries()) {
  // 圍籬：上游端一片（往路緣）、沿著車道九片、下游端一片；一片的局部 x 是長邊
  const row = { panels: [], site: si };
  const along = (z0, n) => { for (let k = 0; k < n; k++) row.panels.push({ x: s.xl, z: z0 + (k + .5) * ST_PL, ry: -Math.PI / 2 }); };
  const end = z => row.panels.push({ x: s.xl + s.side * ST_PL / 2, z, ry: 0 });
  end(s.za); along(s.za, 9); end(s.zb);
  stFence.push(row);
  // 紐澤西護欄（長 3.8 m）：上游端兩座頭尾相接；交通錐從路緣斜到車道邊；立牌在最前面
  const zu = s.up < 0 ? s.za : s.zb;
  for (const d of [2.2, 6.1]) stJerseyL.push({ x: avX(s.i) + s.side * 5.6, z: zu + s.up * d, ry: 0, zn: s.zn });
  for (let k = 0; k < 5; k++) stConesL.push({ x: avX(s.i) + s.side * (5.3 + k * .55), z: zu + s.up * (8.6 + k * .9), zn: s.zn });
  s.sign = { x: avX(s.i) + s.side * 7, z: zu + s.up * 12.6, ry: s.up < 0 ? Math.PI : 0 };
  // 工地旁邊的人行道擺一攤熱狗（工人的午餐）
  const hx = avX(s.i) + s.side * (HR + 1.4);
  for (const dz of [0, -4, 4, -8, 8]) { const hz = (s.za + s.zb) / 2 + dz; if (free(hx, hz, 1.5)) { stands.push({ x: hx, z: hz, ry: s.side < 0 ? 0 : Math.PI, y: .15, zn: zoneAtL(hx, hz) }); claim(hx, hz, 1.5); break; } }
}
// 20-props.js 原本 Atlas Av 施工段的兩座護欄
for (const w of works) if (w.t === 'jersey') stJerseyL.push({ x: w.x, z: w.z, ry: 0, zn: zoneAtL(w.x, w.z) });
{
  // 人行道上靠路緣：候車亭（開口朝馬路）與熱狗攤（長邊順著路緣），用自己的亂數挑 sideSpots，彼此隔開
  const R = rng(6113), nrm = s => (s.ax === 'z' ? [0, s.nz] : [s.nx, 0]);
  for (const s of sideSpots) {
    const r = R(), [nx, nz] = nrm(s);
    if (r < .035) {
      const x = s.x - nx * .35, z = s.z - nz * .35;   // 候車亭中心離路緣 1.25 m（深 1.41 m）
      if (shelters.some(o => Math.hypot(o.x - x, o.z - z) < 100) || !stSpotOK(x, z, 2)) continue;
      shelters.push({ x, z, ry: Math.atan2(nx, nz), y: .15, zn: zoneAtL(x, z) }); claim(x, z, 2);
    } else if (r < .05) {
      const x = s.x - nx * .45, z = s.z - nz * .45;
      if (stands.length >= ST_SITES.length + 12 || stands.some(o => Math.hypot(o.x - x, o.z - z) < 140) || !stSpotOK(x, z, 1.5)) continue;
      stands.push({ x, z, ry: Math.atan2(nx, nz) + Math.PI / 2, y: .15, zn: zoneAtL(x, z) }); claim(x, z, 1.5);
    }
  }
}
// 銀行門前的液壓防撞柱：10 St 北側的路緣，門口左右各 6 m
for (let k = -4; k <= 4; k++) { const x = BANK.x + k * 1.5, z = [.5, 1.2, 1.9].map(d => stZ(4) - HR - d).find(z => free(x, z, .2)); if (z !== undefined) { stBollardsL.push({ x, z, y: .15, zn: zoneAtL(x, z) }); claim(x, z, .2); } }
// 霓虹堡（69-v7-bunker.js 的 FORT，FAC.fort）大門外：圍牆前面左右各一排，擋住從路上直接撞圍牆（大門本身留給柵欄桿）
if (FAC.fort) { const F = FAC.fort; for (const x of [21.5, 23, 24.5, 26, 27.5, 40.5, 42, 43.5, 45, 46.5]) stBollardsL.push({ x: F.ax + x, z: F.az + 50.3, y: 0, zn: facZn(F), fort: 1 }); }
// 車行的落地窗：兩面展示窗各三片（鍍鉻直框之間），貼在窗面外 0.12 m
for (const s of [-1, 1]) for (let i = 0; i < 3; i++) stPanesL.push({ x: DEAL_X + s * 6.1 - 4.7 + 3.133 * (i + .5), z: DEAL_Z + .12, ry: 0, hw: 1.5, y0: .5, y1: 4.35, zn: zoneAtL(DEAL_X, DEAL_Z), deal: 1 });

// ─── 畫面：候車亭與熱狗攤（程式建模，模型下載好就換掉）、瓦斯鋼瓶、防撞柱、施工區的雜物與立牌 ───
// 候車亭：局部座標，開口朝 +z，背牆在 z −0.57（三片玻璃另外畫，打得碎）
const ST_SH_PANES = [[-.946, .418], [.0165, .4235], [.9735, .4235]], ST_SH_PZ = -.567, ST_SH_Y = [.22, 1.97];
const stShelterFb = (() => {
  const k = new Kit();
  k.box(0, 2.37, 0, 3.73, .1, 1.41, 0x16181b, 15).box(0, 2.3, .68, 3.73, .06, .05, 0xffc21a, 8);
  for (const x of [-1.83, -.47, .47, 1.83]) k.box(x, 1.17, ST_SH_PZ - .03, .07, 2.33, .07, 0x2a2c2f, 15);
  k.box(1.83, 1.0, -.05, .05, 1.6, 1.05, 0xa8b4b8, 10).box(-1.83, 1.05, -.05, .05, 1.7, 1.05, 0x1e3a5a, 11);   // 側邊：路線圖、廣告燈箱
  k.box(0, .46, -.4, 2.6, .05, .34, 0xa8835a, 10);
  for (const x of [-1.1, 0, 1.1]) k.box(x, .23, -.4, .05, .46, .3, 0x2a2c2f, 15);
  return instanced(k.build(), MAT.uber, shelters);
})();
// 熱狗攤：原點是攤車底面中心（和 v5street.glb 的三件一樣），長邊沿 z；把手在 −z，鋼瓶在把手下面
const ST_TANK = { x: -.09, z: -.95, r: .14, h: .5 };
const stHdFb = (() => {
  const c = new Kit(), u = new Kit(), s = new Kit();
  c.box(-.09, .62, .2, 1.0, .8, 1.8, 0xece6d8, 10).box(-.09, .62, .2, 1.02, .14, 1.82, 0xd0281e, 10).box(.06, 1.05, .2, 1.3, .05, 1.85, 0x9a9ea2, 15);
  for (const z of [-.3, .35]) c.box(-.09, 1.1, z + .2, .8, .06, .5, 0x2a2a2c, 15);
  for (const x of [-.6, .42]) c.cyl(x, .45, .55, .45, .45, .06, 14, 0x5a3a22, 2, 0, 0, Math.PI / 2);
  for (const x of [-.45, .27]) c.box(x, .92, -.85, .05, .05, .8, 0x3a2a1e, 2);
  u.cyl(-.093, 1.35, 1.13, .025, .025, 1.3, 6, 0x6a6e72, 15).cyl(-.093, 2.05, 1.13, .02, .8, .32, 16, 0xe8262a, 10).cyl(-.093, 1.88, 1.13, .8, .8, .06, 16, 0xffc93a, 10);
  s.cyl(.5, 1.18, .82, .035, .035, .2, 8, 0xffc21a, 10).cyl(.5, 1.18, .95, .035, .035, .2, 8, 0xe0201a, 10);
  return [instanced(c.build(), MAT.uber, stands, LY.NOREFL), instanced(u.build(), MAT.uber, stands, LY.NOREFL), instanced(s.build(), MAT.uber, stands, LY.NOREFL)];
})();
const stTankMesh = instanced(new Kit().cyl(ST_TANK.x, .26, ST_TANK.z, ST_TANK.r, ST_TANK.r, .44, 14, 0xc81a14, 0).cyl(ST_TANK.x, .5, ST_TANK.z, .06, .1, .06, 10, 0xc81a14, 0)
  .cyl(ST_TANK.x, .55, ST_TANK.z, .03, .03, .06, 8, 0x9a9ea2, 3).cyl(ST_TANK.x, .03, ST_TANK.z, .12, .12, .06, 14, 0x2a2a2c, 2).build(), MAT.uber, stands, LY.NOREFL);
const stBollardMesh = instanced(new Kit().cyl(0, .5, 0, .16, .16, 1.0, 14, 0x4a4e52, 15).cyl(0, .78, 0, .165, .165, .1, 14, 0xffc21a, 11).cyl(0, 1.0, 0, .12, .16, .04, 14, 0x2a2c2f, 15)
  .cyl(0, .02, 0, .26, .26, .04, 14, 0x3a3c3e, 15).build(), MAT.uber, stBollardsL, LY.NOREFL);
// 施工區：挖開的路面與鋼板（每段合成一個網格）；土堆、發電機、燈塔與立牌以 http(s) 開啟時換成 v5works.glb 的模型（st.siteFb 是程式建模的替身）
const stSignMat = v5Sign([['道路施工', .42, '#16120a', .36], ['ROAD WORK AHEAD', .2, '#16120a', .76]], 1.4, .9, { bg: '#ffb21a', edge: '#16120a' }).material;
const stSand = [], stGen = [], stTower = [], stWSign = [];
st.siteFb = [];
for (const s of ST_SITES) {
  const k = new Kit(), f = new Kit(), xm = (s.xl + s.curb) / 2, zm = (s.za + s.zb) / 2, L = s.zb - s.za, sd = s.side;
  k.box(xm, .012, zm, 2.6, .02, L - .4, 0x17181a, 2);
  k.box(xm, .03, zm - 3, 1.6, .03, 2.3, 0x55585b, 15).box(xm + sd * .1, .03, zm + .2, 1.6, .03, 2.3, 0x4c4f52, 15);
  k.box(xm, .02, zm + 5.5, 1.1, .03, 3.6, 0x0a0a0b, 2);
  f.cyl(xm - sd * .3, .42, s.za + 2.4, .25, 1.05, .84, 10, 0x5b4734, 2);
  f.box(xm, .38, s.zb - 2.6, .9, .7, .62, 0xd8a21a, 10).box(xm, .4, s.zb - 2.6 + .32, .6, .4, .02, 0x1a1a1a, 2);
  const lx = s.curb - sd * .5, lz = s.zb - 1.2;
  f.cyl(lx, 1.7, lz, .05, .06, 3.4, 8, 0xd8a21a, 15).box(lx, 3.45, lz, .7, .3, .14, 0x2a2c2f, 15).box(lx, 3.45, lz + s.up * -.08, .6, .22, .02, 0xfff4d8, 11);
  for (const d of [-.5, .5]) f.box(s.sign.x + d, .55, s.sign.z, .05, 1.1, .05, 0x2a2c2f, 15);
  cityAdd(new T.Mesh(k.build(), MAT.uber), s.zn);
  const fm = new T.Mesh(f.build(), MAT.uber); cityAdd(fm, s.zn);
  const sm = new T.Mesh(new T.PlaneGeometry(1.4, .9), stSignMat); sm.position.set(s.sign.x, 1.35, s.sign.z); sm.rotation.y = s.sign.ry; cityAdd(sm, s.zn);
  st.siteFb.push(fm, sm);
  // 模型的位置：沙堆在上游端、發電機在沙堆後面靠圍籬、拖車燈塔（3.2 m 長）在下游端順著車道、旗手警示牌在立牌的位置
  stSand.push({ x: xm - sd * .1, z: s.za + 2.0, ry: w2Hash(s.x, s.za) * 6.28, zn: s.zn });
  stGen.push({ x: xm + sd * .55, z: s.za + 4.7, ry: Math.PI / 2 * sd, zn: s.zn });
  stTower.push({ x: xm, z: s.zb - 1.85, ry: s.up < 0 ? 0 : Math.PI, zn: s.zn });
  outLights.push({ x: xm, y: 3.4, z: s.zb - 4.5, col: lin(0xfff0d8), r: 16, i: 1.3 });   // 燈頭朝工地往下照（模型的燈面只有發光貼圖，照不亮地面）
  stWSign.push({ x: s.sign.x, z: s.sign.z, ry: s.sign.ry, zn: s.zn });
}
// 碰撞圓（邏輯座標，cityWorld 之後是同一個物件換成世界座標）
const stCircle = (x, z, r, hy) => addCircleL({ x, z, r, hy });
for (const o of shelters) {
  o.cs = [];
  for (const lx of [-1.5, -.75, 0, .75, 1.5]) { const [x, z] = stLoc(o, lx, ST_SH_PZ); o.cs.push(stCircle(x, z, .3, 2.4)); }
  for (const s of [-1, 1]) for (const lz of [-.3, .2]) { const [x, z] = stLoc(o, s * 1.8, lz); o.cs.push(stCircle(x, z, .25, 2.4)); }
}
for (const o of stands) { o.cs = []; for (const lz of [-.6, .2, .9]) { const [x, z] = stLoc(o, -.09, lz); o.cs.push(stCircle(x, z, .55, 1.2)); } }
for (const o of stBollardsL) o.cs = [stCircle(o.x, o.z, .16, 1.0)];
for (const o of stJerseyL) { o.cs = []; for (const lz of [-1.6, -.8, 0, .8, 1.6]) { const [x, z] = stLoc(o, 0, lz); o.cs.push(stCircle(x, z, .32, .85)); } }
for (const row of stFence) for (const p of row.panels) { p.cs = []; for (const lx of [-.8, 0, .8]) { const [x, z] = stLoc(p, lx, 0); p.cs.push(stCircle(x, z, .14, 2.0)); } }

// ─── 模型：以 http(s) 開啟時下載 v5street.glb，候車亭與熱狗攤三件換成模型（撞爛過的照樣藏起來） ───
st.sh = [stShelterFb]; st.hd = { cart: [stHdFb[0]], umb: [stHdFb[1]], sauce: [stHdFb[2]] };
if (GLB_ON) loadProps('v5street').then(it => {
  if (!it) return;
  const hide = (ms, list) => { for (const m of ms) list.forEach((o, k) => { if (o.down) instSet(m, k, _stZero); }); };
  if (it.shelter && shelters.length) { const ms = w2Inst(it.shelter, shelters, 0, 160); w2Drop(stShelterFb); st.sh = ms; hide(ms, shelters); }
  if (it.hd_cart && stands.length) {
    const c = w2Inst(it.hd_cart, stands, LY.NOREFL, 160), u = w2Inst(it.hd_umb, stands, LY.NOREFL, 160), s = w2Inst(it.hd_sauce, stands, LY.NOREFL, 160);
    w2Drop(...stHdFb); st.hd = { cart: c, umb: u, sauce: s };
    hide(c, stands); stands.forEach((o, k) => { if (o.down) for (const m of [...u, ...s]) instSet(m, k, _stZero); });
  }
  st.glb = 1;
}).catch(e => console.warn('v5street', e));
// v5works.glb：施工區的圍籬、紐澤西護欄、交通錐（會動的：等 stInit 建好替身再換，換上的模型照 stPose 的縮放壓成替身的尺寸）、
// 沙堆、發電機、拖車燈塔、旗手警示牌（不會動，直接擺），以及 20-props.js 的電訊箱（69-market.js 打爛時把 boxesMs 每一串的那一格縮成 0）
function stWorksSwap(it) {
  const swap = (item, list, old, s, layer) => {
    if (!item) return null;
    const ms = w2Inst(item, list.map(() => ({ x: 0, z: 0, zn: null })), layer);
    for (const m of ms) m.frustumCulled = false;
    for (const e of old) w2Drop(e.m);
    return ms.map(m => ({ m, s }));
  };
  const f = swap(it.fence, stFence.flatMap(r => r.panels), st.fMs, [(ST_PL - .08) / it.fence.w, 1, 1], LY.NOREFL);
  if (f) { st.fMs = f; for (const row of stFence) for (const p of row.panels) stFencePose(p); }
  const j = swap(it.jersey, stJerseyL, st.jMs, [.6 / it.jersey.w, .85 / it.jersey.h, 1], 0);
  if (j) { st.jMs = j; for (const o of stJerseyL) stJerseyPose(o); }
  const c = swap(it.cone, stConesL, st.cMs, [1, 1, 1], LY.NOREFL);
  if (c) { st.cMs = c; for (const o of stConesL) stConePose(o); }
  st.wglb = 1;
}
if (GLB_ON) loadProps('v5works').then(it => {
  if (!it) return;
  if (it.sand && it.gen && it.ltower && it.wsign) {
    w2Inst(it.sand, stSand, LY.NOREFL, 220); w2Inst(it.gen, stGen, LY.NOREFL, 160); w2Inst(it.ltower, stTower, 0, 260); w2Inst(it.wsign, stWSign, LY.NOREFL, 220);
    w2Drop(...st.siteFb);
  }
  if (it.tbox && boxesN.length) {
    const ms = w2Inst(it.tbox, boxesL, LY.NOREFL, 160);
    boxesMs.forEach(m => w2Drop(m)); boxesMs.length = 0; boxesMs.push(...ms);
    boxHp.forEach((hp, k) => { if (hp <= 0) for (const m of ms) instSet(m, k, _stZero); });
  }
  st.works = it;
  if (st.ready) stWorksSwap(it);
}).catch(e => console.warn('v5works', e));
// 防撞柱換成 kaimoisch 的混凝土防撞柱掃描（tools/props.mjs 的 fort 組；銀行與霓虹堡共用）
if (GLB_ON && stBollardsL.length) loadProps('fort').then(it => {
  if (!it || !it.bollard) return;
  w2Inst(it.bollard, stBollardsL, LY.NOREFL, 220); w2Drop(stBollardMesh); st.bglb = 1;
}).catch(e => console.warn('fort bollard', e));

// ─── 透明玻璃（候車亭背牆、車行落地窗）：反射環境、邊緣比較不透明 ───
const stGlassMat = new T.ShaderMaterial({
  uniforms: shared(ALLU), transparent: true, depthWrite: false, side: T.DoubleSide,
  vertexShader: /* glsl */`
varying vec3 vW, vN;
void main(){
  vec4 lp = vec4(position, 1.); vec3 nn = normal;
  #ifdef USE_INSTANCING
  lp = instanceMatrix * lp; nn = mat3(instanceMatrix) * nn;
  #endif
  vec4 w = modelMatrix * lp; vW = w.xyz; vN = normalize(mat3(modelMatrix) * nn);
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
  fragmentShader: /* glsl */`
${GL_LIB}
varying vec3 vW, vN;
void main(){
  if (vW.y < uClipY) discard;
  vec3 n = normalize(vN), v = normalize(uCam - vW);
  if (dot(n, v) < 0.) n = -n;
  float F = .05 + .95 * pow(1. - max(dot(n, v), 0.), 5.);
  vec3 c = envMap(reflect(-v, n)) * (.3 + .7 * F) + vec3(.015, .02, .024);
  gl_FragColor = vec4(applyFog(c, vW), clamp(.16 + .7 * F, 0., .82));
}`,
});
// 碎玻璃：小三角形，玻璃材質（反射環境），落地彈兩下躺平，幾秒後縮小消失
const ST_SH_MAX = 480;
const stShardMesh = (() => {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute([-.07, 0, -.05, .08, 0, -.04, -.01, 0, .09], 3));
  g.setAttribute('normal', new T.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute('color', new T.Float32BufferAttribute([.85, .95, 1, .85, .95, 1, .85, .95, 1], 3));
  g.setAttribute('aMat', new T.Float32BufferAttribute([1, 1, 1], 1));
  const m = new T.InstancedMesh(g, MAT.uberD, ST_SH_MAX); m.count = 0; m.frustumCulled = false; m.layers.set(LY.NOREFL); scene.add(m);
  return m;
})();
// 一片玻璃碎掉：(cx, cy, cz) 是中心、(ux, uz) 是寬的方向、hw／hh 半寬半高、(px, pz) 是碎片飛出去的速度
function stShatter(cx, cy, cz, ux, uz, hw, hh, px, pz, n) {
  for (let i = 0; i < n; i++) {
    if (st.shards.length >= ST_SH_MAX) st.shards.shift();
    const a = (Math.random() * 2 - 1) * hw, b = (Math.random() * 2 - 1) * hh, k = .4 + Math.random() * .9;
    st.shards.push({ x: cx + ux * a, y: cy + b, z: cz + uz * a, vx: px * k + (Math.random() - .5) * 1.6, vy: Math.random() * 1.6 - .2, vz: pz * k + (Math.random() - .5) * 1.6,
      q: new T.Quaternion().setFromEuler(_stE.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28)),
      w: V3(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(22), s: .6 + Math.random() * 1.7, t: 0, max: 7 + Math.random() * 4, rest: false });
  }
  if (Math.hypot(cx - camera.position.x, cz - camera.position.z) < 60) sfx.glassBreak();
}
function stShardStep(dt) {
  let c = 0;
  for (let i = st.shards.length - 1; i >= 0; i--) if ((st.shards[i].t += dt) > st.shards[i].max) st.shards.splice(i, 1);
  for (const s of st.shards) {
    if (!s.rest) {
      s.vy -= 9.8 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      const wl = s.w.length(); if (wl > 1e-3) { _stQ.setFromAxisAngle(_stV.copy(s.w).divideScalar(wl), wl * dt); s.q.premultiply(_stQ); }
      const g = groundH(s.x, s.z) + .01;
      if (s.y < g) {
        s.y = g; s.vy *= -.22; s.vx *= .5; s.vz *= .5; s.w.multiplyScalar(.4);
        if (Math.abs(s.vy) < .35 && Math.hypot(s.vx, s.vz) < .35) { s.rest = true; s.q.setFromEuler(_stE.set((Math.random() - .5) * .15, Math.random() * 6.28, (Math.random() - .5) * .15)); }
      }
    }
    const k = Math.min(1, s.max - s.t);
    _stM.compose(_stV.set(s.x, s.y, s.z), s.q, _stS.setScalar(s.s * k)); stShardMesh.setMatrixAt(c++, _stM);
  }
  stShardMesh.count = c;
  if (c) stShardMesh.instanceMatrix.needsUpdate = true;
}

// ─── 翻滾的設施：從實例拿出來（stTake 藏起原本那個），整組當一個剛體繞中心轉、落地彈跳、撐在角上會倒、停下來就不再算 ───
function stTake(ms, k) {
  const out = [];
  for (const m of ms) {
    if (!m || !m.parent) continue;
    const S = m.userData.stream, M = new T.Matrix4();
    if (S) M.fromArray(S.mtx, k * 16); else m.getMatrixAt(k, M);
    if (M.determinant() === 0) continue;
    out.push({ m, mtx: M }); instSet(m, k, _stZero);
  }
  return out;
}
function stTumbleAdd(parts, v, w) {
  if (!parts.length) return null;
  const box = new T.Box3(), b = new T.Box3();
  for (const p of parts) { const g = p.m.geometry; if (!g.boundingBox) g.computeBoundingBox(); b.copy(g.boundingBox).applyMatrix4(p.mtx); box.union(b); }
  const c = box.getCenter(V3()), cn = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) cn.push(V3(x - c.x, y - c.y, z - c.z));
  const ms = parts.map(p => { const m = new T.InstancedMesh(p.m.geometry, p.m.material, 1); m.frustumCulled = false; m.layers.mask = p.m.layers.mask; m.setMatrixAt(0, p.mtx); scene.add(m); return { m, mtx: p.mtx }; });
  const g = { ms, c, p: c.clone(), v: v.clone(), w: w.clone(), q: new T.Quaternion(), cn, rh: Math.max(.2, Math.min(box.max.x - box.min.x, box.max.z - box.min.z) * .4), rest: 0, t: 0, hitT: 0 };
  st.tumble.push(g);
  while (st.tumble.length > 32) stTumbleDrop(st.tumble[0]);
  return g;
}
function stTumbleDrop(g) { const i = st.tumble.indexOf(g); if (i >= 0) st.tumble.splice(i, 1); for (const e of g.ms) { scene.remove(e.m); e.m.dispose(); } }
function stTumbleStep(dt) {
  for (const g of st.tumble) {
    if (g.rest > .6) continue;
    g.t += dt; g.v.y -= 9.8 * dt; g.p.addScaledVector(g.v, dt);
    const wl = g.w.length(); if (wl > 1e-4) { _stQ.setFromAxisAngle(_stV.copy(g.w).divideScalar(wl), wl * dt); g.q.premultiply(_stQ); }
    // 最低的角（幾個角一樣低就是平躺／靠在邊上）
    let lo = 1e9; for (const k of g.cn) { const y = _stV.copy(k).applyQuaternion(g.q).y; if (y < lo) lo = y; }
    let n = 0, ax = 0, az = 0; for (const k of g.cn) { _stV.copy(k).applyQuaternion(g.q); if (_stV.y < lo + .05) { n++; ax += _stV.x; az += _stV.z; } }
    const gy = groundH(g.p.x, g.p.z), touch = g.p.y + lo < gy + .01;
    if (touch) {
      g.p.y = gy - lo;
      if (g.v.y < 0) { if (g.v.y < -3 && g.hitT <= 0) { sfx.impact(clamp(-g.v.y, 2, 8)); dust(g.p.x, gy + .2, g.p.z, 3); g.hitT = .25; } g.v.y *= -.2; }
      const f = Math.exp(-3.5 * dt); g.v.x *= f; g.v.z *= f; g.w.multiplyScalar(Math.exp(-2.2 * dt));
      // 撐在一個角或一條邊上：重力把它往中心那一側推倒（繞水平軸）
      if (n <= 2) { ax /= n; az /= n; const d2 = ax * ax + az * az + lo * lo; g.w.x += -az * 9.8 / d2 * dt * 1.6; g.w.z += ax * 9.8 / d2 * dt * 1.6; }
      else g.w.multiplyScalar(Math.exp(-6 * dt));
    }
    if ((g.hitT -= dt) < 0) g.hitT = 0;
    colY = g.p.y; const r = collideCircle(g.p.x, g.p.z, g.rh, true); colY = 0;   // 撞到牆、路燈彈回來
    if (r.hit) { g.p.x = r.x; g.p.z = r.z; const l = Math.hypot(r.nx, r.nz) || 1, vn = (g.v.x * r.nx + g.v.z * r.nz) / l; if (vn < 0) { g.v.x -= 1.4 * vn * r.nx / l; g.v.z -= 1.4 * vn * r.nz / l; } }
    g.rest = touch && g.v.lengthSq() < .05 && g.w.lengthSq() < .1 ? g.rest + dt : 0;
    _stM.makeRotationFromQuaternion(g.q); _stM.setPosition(g.p); _stM.multiply(_stM2.makeTranslation(-g.c.x, -g.c.y, -g.c.z));
    for (const e of g.ms) { _stM3.multiplyMatrices(_stM, e.mtx); e.m.setMatrixAt(0, _stM3); e.m.instanceMatrix.needsUpdate = true; }
  }
}
const stOff = o => { for (const c of o.cs || []) c.x = 1e7; };   // 碰撞圓搬走（69-v3-break.js 的做法：留在原本的格子裡，但碰不到了）
const stPolice = (x, z) => { if (W.stars || copSees(x, z, 40)) crime('assault', x, z); };

// ─── 開場（cityWorld 之後）：世界座標、空間格子、自己畫的實例（玻璃、圍籬、護欄、交通錐） ───
const ST_CELL = 24, stKey = (x, z) => Math.floor(x / ST_CELL) * 65536 + Math.floor(z / ST_CELL);
function stAdd(it) {
  st.items.push(it);
  const k = stKey(it.x, it.z); let L = st.grid.get(k); if (!L) st.grid.set(k, L = []); L.push(it);
  return it;
}
// 邏輯座標的物件換成世界座標的中心與朝向
const stW = o => { const [x, z] = toW(o.x, o.z, o.zn || undefined); return { x, z, yaw: yawW(o.zn || zoneAtL(o.x, o.z), o.ry || 0, o.x, o.z) }; };
function stInit() {
  st.ready = true;
  // 玻璃：候車亭背牆三片＋車行六片，一個實例網格
  const panes = [];
  shelters.forEach((o, k) => { o.k = k; o.panes = ST_SH_PANES.map(([lx, hw]) => { const [x, z] = stLoc(o, lx, ST_SH_PZ); const p = { x, z, ry: o.ry, hw, y0: .15 + ST_SH_Y[0], y1: .15 + ST_SH_Y[1], zn: o.zn, own: o }; panes.push(p); return p; }); });
  panes.push(...stPanesL);
  st.paneMesh = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), stGlassMat, Math.max(1, panes.length)); st.paneMesh.frustumCulled = false; scene.add(st.paneMesh);
  panes.forEach((p, k) => {
    Object.assign(p, stW(p), { kind: 'pane', k, hx: p.hw, hz: .05, top: p.y1 });
    _stM.compose(_stV.set(p.x, (p.y0 + p.y1) / 2, p.z), _stQ.setFromAxisAngle(_stS.set(0, 1, 0), p.yaw), _stS.set(p.hw * 2, p.y1 - p.y0, .025)); st.paneMesh.setMatrixAt(k, _stM);
    st.rays.push(p); if (!p.own) stAdd(p);
  });
  // 候車亭：腳印 3.7 × 1.4（中心）
  shelters.forEach((o, k) => { Object.assign(o, stW(o), { kind: 'shelter', k, hx: 1.85, hz: .72, top: 2.5 }); stAdd(o); });
  // 公車停靠區不停車：候車亭前面（開口那一側）前後 8 m 的路邊車拿掉（和 69-heist.js 的 clearSpot 一樣，執行時才拿，不動 rT 的序列）
  for (const c of [...parked]) if (shelters.some(o => { const ax = c.x - o.x, az = c.z - o.z, n = ax * Math.sin(o.yaw) + az * Math.cos(o.yaw); return n > 0 && n < 6 && Math.abs(ax * Math.cos(o.yaw) - az * Math.sin(o.yaw)) < 8; })) dropVehicle(detachCar(c));
  // 熱狗攤：腳印是攤車＋把手；鋼瓶的位置
  stands.forEach((o, k) => {
    Object.assign(o, stW(o), { kind: 'hotdog', k, hx: .62, hz: 1.25, top: 1.3, hits: 0 });
    const c = Math.cos(o.yaw), s = Math.sin(o.yaw);
    o.tx = o.x + ST_TANK.x * c + ST_TANK.z * s; o.tz = o.z - ST_TANK.x * s + ST_TANK.z * c;
    stAdd(o); st.rays.push(o);
    // 攤販：站在把手那一端（局部 z −1.75）面向攤車；碰撞圓掛進 o.cs，攤子被撞翻時跟著搬走
    o.vend = { x: o.x - 1.75 * s, z: o.z - 1.75 * c, run: 0 };
    const vc = { x: o.vend.x, z: o.vend.z, r: .3 }; circles.push(vc); o.cs.push(vc);
  });
  // 攤販用 40-people.js 的人物（路人同一套模型與動畫），白上衣；攤子倒了就往人行道裡面跑開（stVendStep）
  st.vend = crowd(Math.max(1, stands.length)); scene.add(st.vend.mesh);
  const rv = rng(4417);
  stands.forEach((o, k) => {
    st.vend.look(k, { r: rv, top: lin(0xeeece6), hat: 0 });
    st.vend.anim(k, k % 3 ? ANIM.idle : ANIM.talk, rv() * 10, 1);
    st.vend.place(k, o.vend.x, groundH(o.vend.x, o.vend.z) > 0 ? .15 : 0, o.vend.z, o.yaw);
  });
  st.vend.mesh.count = stands.length;
  colDirty();
  stBollardsL.forEach((o, k) => { Object.assign(o, stW(o), { kind: 'bollard', k, hx: .17, hz: .17, top: 1.0 }); stAdd(o); });
  // 電話亭（20-props.js 的 booths）：找回它的碰撞圓
  st.booths = booths.map((b, k) => {
    const [x, z] = toW(b.x, b.z, zoneAtL(b.x, b.z)), c = [...circlesNear(x, z, .3)].find(c => Math.abs(c.r - .55) < .01 && Math.hypot(c.x - x, c.z - z) < .05);
    const o = { kind: 'booth', x, z, yaw: 0, k, hx: .48, hz: .48, top: 2.4, cs: c ? [c] : [], glass: 1 };
    stAdd(o); st.rays.push(o); return o;
  });
  // 圍籬：兩個實例網格（框與網面），倒下的時候改矩陣
  const fk = new Kit(), hl = ST_PL / 2;
  for (const s of [-1, 1]) { fk.cyl(s * (hl - .04), 1.02, 0, .025, .025, 1.92, 6, 0x8a8e92, 15); fk.box(s * (hl - .04), .07, 0, .55, .14, .22, 0x8a8680, 2); }
  fk.box(0, 1.96, 0, ST_PL - .08, .035, .035, 0x8a8e92, 15).box(0, .14, 0, ST_PL - .08, .035, .035, 0x8a8e92, 15).box(0, 1.05, 0, ST_PL - .1, .03, .03, 0x7a7e82, 15);
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  { const c = cv.getContext('2d'); c.strokeStyle = '#d0d4d8'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 32); c.lineTo(32, 0); c.lineTo(64, 32); c.lineTo(32, 64); c.closePath(); c.stroke(); }
  const ntx = new T.CanvasTexture(cv); ntx.wrapS = ntx.wrapT = T.RepeatWrapping;
  const ng = new T.PlaneGeometry(ST_PL - .1, 1.8); ng.translate(0, 1.05, 0);
  { const uv = ng.attributes.uv, p = ng.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / .14, p.getY(i) / .14); }
  const panels = stFence.flatMap(r => r.panels);
  st.fFrame = new T.InstancedMesh(fk.build(), MAT.uber, Math.max(1, panels.length)); st.fNet = new T.InstancedMesh(ng, new T.MeshBasicMaterial({ map: ntx, alphaTest: .5, side: T.DoubleSide, color: 0x6a6e72 }), Math.max(1, panels.length));
  for (const m of [st.fFrame, st.fNet]) { m.frustumCulled = false; m.layers.set(LY.NOREFL); scene.add(m); }
  st.fMs = [{ m: st.fFrame, s: [1, 1, 1] }, { m: st.fNet, s: [1, 1, 1] }];
  let pk = 0;
  for (const row of stFence) {
    st.fence.push(row);
    row.panels.forEach((p, i) => { Object.assign(p, stW(p), { kind: 'fence', k: pk++, row, i, hx: hl, hz: .14, top: 2.0, ang: 0, av: 0, t: 0, fd: 1 }); stFencePose(p); stAdd(p); });
  }
  // 紐澤西護欄：實例網格（會被推著走、會被撞飛的車鏟起來）
  const jk = new Kit().box(0, .2, 0, .6, .4, 3.8, 0xb8b4aa, 10).box(0, .6, 0, .36, .4, 3.8, 0xb8b4aa, 10).box(0, .83, 0, .22, .06, 3.8, 0xb8b4aa, 10);
  for (const s of [-1, 1]) jk.box(s * .19, .45, 0, .01, .1, 3.6, 0xff6a10, 11, 0, 0, -s * .3);
  st.jMesh = new T.InstancedMesh(jk.build(), MAT.uber, Math.max(1, stJerseyL.length)); st.jMesh.frustumCulled = false; scene.add(st.jMesh);
  st.jMs = [{ m: st.jMesh, s: [1, 1, 1] }];
  stJerseyL.forEach((o, k) => { Object.assign(o, stW(o), { kind: 'jersey', k, hx: .3, hz: 1.9, top: .85, vx: 0, vz: 0, w: 0, dyn: null }); st.jersey.push(o); st.rays.push(o); stJerseyPose(o); });
  // 交通錐：一碰就飛（沒有碰撞）
  const ck = new Kit().cyl(0, .38, 0, .03, .19, .72, 12, 0xff5a0a, 10).cyl(0, .4, 0, .12, .14, .1, 12, 0xf2f2ee, 11).box(0, .02, 0, .42, .04, .42, 0x222222, 2);
  st.cMesh = new T.InstancedMesh(ck.build(), MAT.uber, Math.max(1, stConesL.length)); st.cMesh.frustumCulled = false; st.cMesh.layers.set(LY.NOREFL); scene.add(st.cMesh);
  st.cMs = [{ m: st.cMesh, s: [1, 1, 1] }];
  stConesL.forEach((o, k) => { const w = stW(o); Object.assign(o, w, { kind: 'cone', k, hx: .2, hz: .2, top: .75, y: groundH(w.x, w.z), q: new T.Quaternion().setFromAxisAngle(_stS.set(0, 1, 0), w.yaw), fly: null }); st.cones.push(o); stAdd(o); stConePose(o); });
  for (const m of [st.paneMesh, st.fFrame, st.fNet, st.jMesh, st.cMesh]) m.instanceMatrix.needsUpdate = true;
  if (st.works) stWorksSwap(st.works);
}
// 三種會動的設施各有一串網格（程式建模的替身，或 v5works.glb 換上的模型）與各自的縮放（模型的比例照替身的尺寸壓過）
function stPose(ms, k) { for (const e of ms) { _stM2.compose(_stV, _stQ, _stS.set(...e.s)); instSet(e.m, k, _stM2); } }
function stFencePose(p) {
  _stQ.setFromEuler(_stE.set(p.fd * p.ang, p.yaw, 0, 'YXZ'));
  _stV.set(p.x, groundH(p.x, p.z), p.z); stPose(st.fMs, p.k);
}
function stJerseyPose(o) {
  _stQ.setFromAxisAngle(_stS.set(0, 1, 0), o.yaw);
  _stV.set(o.x, groundH(o.x, o.z), o.z); stPose(st.jMs, o.k);
}
function stConePose(o) { _stQ.copy(o.q); _stV.set(o.x, o.y, o.z); stPose(st.cMs, o.k); }

// ─── 碰觸：圓 (x, z, r) 碰到物件的腳印（局部座標的長方形）就回傳法線（從物件指向圓心）與穿進去的深度 ───
function stContact(o, x, z, r) {
  const c = Math.cos(o.yaw), s = Math.sin(o.yaw), dx = x - o.x, dz = z - o.z;
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  const qx = clamp(lx, -o.hx, o.hx), qz = clamp(lz, -o.hz, o.hz), ex = lx - qx, ez = lz - qz, d = Math.hypot(ex, ez);
  if (d >= r) return null;
  let nx, nz;
  if (d > 1e-4) { nx = ex / d; nz = ez / d; } else { const a = [o.hx - lx, lx + o.hx, o.hz - lz, lz + o.hz], m = Math.min(...a), i = a.indexOf(m); nx = i === 0 ? 1 : i === 1 ? -1 : 0; nz = i === 2 ? 1 : i === 3 ? -1 : 0; }
  return { nx: nx * c + nz * s, nz: -nx * s + nz * c, pen: r - d, lx: qx, lz: qz };
}
function stNear(x, z) {
  const out = [], cx = Math.floor(x / ST_CELL), cz = Math.floor(z / ST_CELL);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const L = st.grid.get((cx + a) * 65536 + cz + b); if (L) out.push(...L); }
  for (const j of st.jersey) if (Math.abs(j.x - x) < 6 && Math.abs(j.z - z) < 6) out.push(j);
  return out;
}
// 車子這一幀會碰到的設施（69-v3-break.js 的 breakSweep 最前面呼叫：玩家與 AI 的車都會經過）
function streetSweep(v, dt) {
  if (!st.ready || player.where !== 'out' || v.boat || v.fly || v.dead) return;
  const sp = Math.hypot(v.vx, v.vz); if (sp < .4) return;
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), m = v.mass || (v.isCar ? 1600 : 280), seen = new Set();
  for (const s of [1, -1]) {
    const cx = v.x + fx * v.off * s + v.vx * dt, cz = v.z + fz * v.off * s + v.vz * dt;
    for (const o of stNear(cx, cz)) {
      if (o.down || seen.has(o) || (v.y || 0) > o.top) continue;
      const c = stContact(o, cx, cz, v.rad + .05); if (!c) continue;
      const vn = -(v.vx * c.nx + v.vz * c.nz); if (vn < .3) continue;
      seen.add(o); stHit(o, v, m * vn, vn, c, sp);
    }
  }
}
function stHit(o, v, J, vn, c, sp) {
  const mine = v === player.veh, dx = v.vx / sp, dz = v.vz / sp;
  if (o.kind === 'pane') { if (J >= ST_J.glass) { stPaneBreak(o, v.vx * .45, v.vz * .45); if (mine && o.deal) crime('assault', o.x, o.z); } }
  else if (o.kind === 'cone') { o.fly = { vx: v.vx * 1.15 + (Math.random() - .5) * 2, vy: 2.5 + sp * .12, vz: v.vz * 1.15 + (Math.random() - .5) * 2, w: V3(Math.random() - .5, 0, Math.random() - .5).normalize().multiplyScalar(8 + sp * .4) }; o.down = 1; st.n.cone++; sfx.bounce(); }
  else if (o.kind === 'fence') { if (J >= ST_J.fence) { stFenceFall(o.row, o.i, dx, dz); v.vx *= .93; v.vz *= .93; damageVeh(v, 6, mine); if (mine) stPolice(o.x, o.z); } }
  else if (o.kind === 'shelter') {
    if (J >= ST_J.shelter) { stUproot(o, v.vx * .55, 2.5 + sp * .08, v.vz * .55, dx, dz); v.vx *= .8; v.vz *= .8; damageVeh(v, 40, mine); if (mine) { camState.shake = Math.max(camState.shake, .5); stPolice(o.x, o.z); } }
    else if (J >= ST_J.glass) for (const p of o.panes) if (!p.down && Math.hypot(p.x - (v.x + dx * v.len * .5), p.z - (v.z + dz * v.len * .5)) < 1.6) stPaneBreak(p, v.vx * .3, v.vz * .3);
  }
  else if (o.kind === 'booth') {
    if (J >= ST_J.shelter) { stUproot(o, v.vx * .6, 2.5 + sp * .08, v.vz * .6, dx, dz); v.vx *= .85; v.vz *= .85; damageVeh(v, 30, mine); if (mine) stPolice(o.x, o.z); }
    else if (J >= ST_J.glass) stBoothGlass(o, v.vx * .3, v.vz * .3);
  }
  else if (o.kind === 'hotdog') {
    if (J >= ST_J.glass) { stKnock(o, v.vx, v.vz, sp, mine ? 'player' : null); v.vx *= .85; v.vz *= .85; damageVeh(v, 25, mine); if (mine) stPolice(o.x, o.z); if (sp >= ST_TANK_V) stIgnite(o, ST_TANK_FUSE, mine ? 'player' : null); }
  }
  else if (o.kind === 'jersey') stJerseyHit(o, v, vn, c, sp, mine);
  else if (o.kind === 'bollard') {
    if (v.isCar && !v.armored && vn >= ST_BOLLARD_V) {
      const hm = hpLockOf(v); v.hp = Math.min(v.hp, hm * .2);   // 車頭全毀：剩兩成（68-wreck 的黑煙、熄火階段）
      const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
      sparks(v.x + fx * v.len * .5, .7, v.z + fz * v.len * .5, 30, 6); glassBurst(v.x + fx * v.len * .35, (v.y || 0) + 1.2, v.z + fz * v.len * .35); sfx.impact(20);
      v.vx = v.vz = 0; st.n.bollard++;
      if (mine) { ejectPlayer(v, vn, vn, true); toast('撞上液壓防撞柱，車頭全毀，人從擋風玻璃飛了出去'); }   // 有沒有繫安全帶都一樣；toast 蓋掉 ejectPlayer 那句安全帶的提示
    }
  }
}

// ─── 各種設施壞掉 ───
function stPaneBreak(p, px, pz) {
  if (p.down) return;
  p.down = 1; st.n.glass++;
  st.paneMesh.setMatrixAt(p.k, _stZero); st.paneMesh.instanceMatrix.needsUpdate = true;
  const ux = Math.cos(p.yaw), uz = -Math.sin(p.yaw), area = p.hw * 2 * (p.y1 - p.y0);
  stShatter(p.x, (p.y0 + p.y1) / 2, p.z, ux, uz, p.hw, (p.y1 - p.y0) / 2, px, pz, clamp(Math.round(area * 4), 14, 46));
}
function stBoothGlass(o, px, pz) {
  if (!o.glass) return;
  o.glass = 0; st.n.glass++;
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) stShatter(o.x + Math.sin(a) * .45, 1.3, o.z + Math.cos(a) * .45, Math.cos(a), -Math.sin(a), .38, .8, px + Math.sin(a) * 1.2, pz + Math.cos(a) * 1.2, 8);
}
// 候車亭、電話亭連根拔起：整座翻滾（還沒碎的玻璃一起碎）
function stUproot(o, vx, vy, vz, dx, dz) {
  if (o.down) return;
  o.down = 1; stOff(o);
  let parts;
  if (o.kind === 'shelter') { for (const p of o.panes) stPaneBreak(p, vx * .5, vz * .5); parts = stTake(st.sh, o.k); st.n.shelter++; }
  else { stBoothGlass(o, vx * .4, vz * .4); parts = brkHide(o.x, o.z, o.x, o.z); st.n.booth++; }
  // 繞水平軸往車子前進的方向倒
  stTumbleAdd(parts, V3(vx, vy, vz), V3(dz * 3.5, (Math.random() - .5) * 2, -dx * 3.5));
  sparks(o.x, .4, o.z, 14, 4); dust(o.x, .3, o.z, 5); sfx.impact(12);
}
// 熱狗攤被撞：遮陽傘與醬料飛走、攤車翻倒（鋼瓶跟著攤車滾）
function stKnock(o, vx, vz, sp, by) {
  if (o.down) return;
  o.down = 1; stOff(o); st.n.hotdog++; stVendFlee(o);
  const s = Math.max(sp, 3), dx = vx / s, dz = vz / s;
  stTumbleAdd(stTake(st.hd.umb, o.k), V3(vx * .7, 4 + sp * .15, vz * .7), V3((Math.random() - .5) * 8, (Math.random() - .5) * 6, (Math.random() - .5) * 8));
  stTumbleAdd(stTake(st.hd.sauce, o.k), V3(vx * .9 + (Math.random() - .5) * 2, 3 + Math.random() * 2, vz * .9 + (Math.random() - .5) * 2), V3(Math.random() * 20, Math.random() * 20, Math.random() * 20));
  o.cart = stTumbleAdd(stTake(st.hd.cart, o.k), V3(vx * .45, 1.2 + sp * .06, vz * .45), V3(dz * 2.6, (Math.random() - .5) * 1.5, -dx * 2.6));
  if (!o.boom) o.tank = stTumbleAdd(stTake([stTankMesh], o.k), V3(vx * .5 + (Math.random() - .5), 1 + sp * .05, vz * .5 + (Math.random() - .5)), V3(Math.random() * 6, 0, Math.random() * 6));
  for (let i = 0; i < 6; i++) emit('spray', o.x, 1.1, o.z, { vx: vx * .5 + (Math.random() - .5) * 3, vy: 2 + Math.random() * 3, vz: vz * .5 + (Math.random() - .5) * 3, max: .8, s0: .1, s1: .25, grav: 9, c: [.9, .45, .2] });
  sfx.impact(8); panic(o.x, o.z, 14, 6);
}
// 鋼瓶噴火 fuse 秒後炸開
function stIgnite(o, fuse, by) {
  if (o.boom) return;
  o.boom = 1; st.n.tank++;
  const a = Math.random() * 6.28;
  st.fires.push({ o, t: fuse, by, dx: Math.sin(a), dz: Math.cos(a), sT: 0 });
}
const stTankAt = o => (o.tank ? o.tank.p : { x: o.tx, y: .3, z: o.tz });
function stFireStep(dt) {
  for (let i = st.fires.length - 1; i >= 0; i--) {
    const f = st.fires[i], p = stTankAt(f.o);
    f.t -= dt;
    for (let k = 0; k < 3; k++) emit('fire', p.x + f.dx * .2, p.y + .25, p.z + f.dz * .2, { vx: f.dx * (6 + Math.random() * 3) + (Math.random() - .5), vy: .8 + Math.random(), vz: f.dz * (6 + Math.random() * 3) + (Math.random() - .5), max: .35 + Math.random() * .25, s0: .25, s1: .9 });
    if ((f.sT -= dt) <= 0) { f.sT = .18; if (Math.hypot(p.x - camera.position.x, p.z - camera.position.z) < 50) sfx.spray(); }
    if (Math.random() < dt * 20) fxLights.push({ x: p.x, y: 1, z: p.z, col: lin(0xff8a3a), r: 9, i: 2.2, life: 0, max: .08 });
    if (player.mode === 'walk' && player.where === 'out') { const ax = player.x - p.x, az = player.z - p.z, d = Math.hypot(ax, az); if (d < 2.6 && (ax * f.dx + az * f.dz) / (d || 1) > .6) hurtPlayer(40 * dt, p.x, p.z); }
    if (f.t > 0) continue;
    st.fires.splice(i, 1);
    if (f.o.tank) { stTumbleDrop(f.o.tank); f.o.tank = null; } else instSet(stTankMesh, f.o.k, _stZero);
    blast(p.x, .5, p.z, ST_TANK_R, ST_TANK_DMG, f.by, null);
  }
}
// 圍籬整排倒：從撞到的那片開始，往兩邊一片一片倒，倒向車子前進的方向
function stFenceFall(row, i0, dx, dz) {
  for (const p of row.panels) {
    if (p.down) continue;
    p.down = 1; stOff(p); st.n.fence++;
    p.t = -Math.abs(p.i - i0) * .07; p.fd = dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw) >= 0 ? 1 : -1;
  }
  sfx.impact(6);
}
function stFenceStep(dt) {
  for (const row of st.fence) for (const p of row.panels) {
    if (!p.down || p.ang >= 1.45) continue;
    if ((p.t += dt) < 0) continue;
    p.av += dt * 10; p.ang = Math.min(1.45, p.ang + p.av * dt);
    if (p.ang >= 1.45) {
      const c = Math.sin(p.yaw) * p.fd, s = Math.cos(p.yaw) * p.fd;
      p.fx = p.x + c * 1.0; p.fz = p.z + s * 1.0; st.fallen.push(p);
      if (Math.hypot(p.x - camera.position.x, p.z - camera.position.z) < 50) sfx.impact(3);
      dust(p.fx, .2, p.fz, 2);
    }
    stFencePose(p);
  }
  // 壓在車底：開過倒下的圍籬刮出火花、稍微拖慢
  for (const v of vehicles) {
    const sp = Math.hypot(v.vx, v.vz); if (sp < 2 || v.boat || v.fly || (v.y || 0) > 1) continue;
    for (const p of st.fallen) {
      if (Math.abs(p.fx - v.x) > 3 || Math.abs(p.fz - v.z) > 3 || Math.hypot(p.fx - v.x, p.fz - v.z) > 1.8) continue;
      const k = 1 - .5 * dt; v.vx *= k; v.vz *= k;
      if (Math.random() < dt * 14) sparks(v.x - v.vx / sp * v.len * .3, .1, v.z - v.vz / sp * v.len * .3, 4, 3);
      if ((v.scrapeT = (v.scrapeT || 0) - dt) <= 0) { v.scrapeT = .2; if (v === player.veh) sfx.impact(2); st.n.scrape = (st.n.scrape || 0) + 1; }
      break;
    }
  }
}
// 紐澤西護欄：重車推著走、輕的車高速撞上被鏟起來
function stJerseyDyn(o) {
  if (o.dyn) return;
  stOff(o); o.dyn = [-1.6, -.8, 0, .8, 1.6].map(lz => ({ x: 0, z: 0, r: .32, hy: .85, lz }));
  dynMore.push(...o.dyn); stJerseyCircles(o);
}
function stJerseyCircles(o) { const s = Math.sin(o.yaw), c = Math.cos(o.yaw); for (const d of o.dyn) { d.x = o.x + s * d.lz; d.z = o.z + c * d.lz; } }
function stJerseyHit(o, v, vn, c, sp, mine) {
  const m = v.mass || 1600;
  if (m >= ST_PUSH_M) {   // 推著走：先把護欄推出重疊的量，再給它這一下的速度
    stJerseyDyn(o);
    o.x -= c.nx * (c.pen + .04); o.z -= c.nz * (c.pen + .04);
    const k = m / (m + ST_JERSEY_M); o.vx -= c.nx * vn * k; o.vz -= c.nz * vn * k;
    o.w += clamp(c.lz, -1.9, 1.9) * vn * .12 * (c.nx * Math.cos(o.yaw) - c.nz * Math.sin(o.yaw) > 0 ? -1 : 1);
    const r = ST_JERSEY_M / (m + ST_JERSEY_M) * .6; v.vx += c.nx * vn * r; v.vz += c.nz * vn * r;
    st.n.push++; stJerseyCircles(o); stJerseyPose(o);
    if (Math.random() < .5) sparks(o.x + c.nx * .3, .3, o.z + c.nz * .3, 5, 2);
  } else if (v.isCar && vn >= ST_LAUNCH_V && !v.tumble) {   // 鏟起來：車頭被斜面抬起，翻著飛過去
    v.y = Math.max(v.y || 0, .95);
    rollStart(v, 3.2 + (vn - ST_LAUNCH_V) * .35, (Math.random() - .5) * 3, -2.4, (Math.random() - .5) * 1.2);
    v.vx *= .85; v.vz *= .85; damageVeh(v, 150, mine);
    stJerseyDyn(o); o.vx -= c.nx * 1.5; o.vz -= c.nz * 1.5; o.w += (Math.random() - .5) * 1.5;
    sparks(o.x, .6, o.z, 20, 5); sfx.impact(16); st.n.launch++;
    if (mine) camState.shake = Math.max(camState.shake, .8);
  }
}
function stJerseyStep(dt) {
  for (const o of st.jersey) {
    if (!o.dyn) continue;
    const sp = Math.hypot(o.vx, o.vz);
    if (sp < .02 && Math.abs(o.w) < .02) continue;
    o.x += o.vx * dt; o.z += o.vz * dt; o.yaw += o.w * dt;
    const k = Math.max(0, sp - 5 * dt) / (sp || 1); o.vx *= k; o.vz *= k; o.w *= Math.exp(-3 * dt);
    colY = .3; const r = collideCircle(o.x, o.z, .35, true); colY = 0;   // 不推進牆裡
    if (r.hit) { o.x = r.x; o.z = r.z; o.vx = o.vz = 0; }
    if (sp > 1 && Math.random() < dt * 10) dust(o.x, .1, o.z, 1);
    stJerseyCircles(o); stJerseyPose(o);
  }
}
function stConeStep(dt) {
  for (const o of st.cones) {
    const f = o.fly; if (!f) continue;
    f.vy -= 9.8 * dt; o.x += f.vx * dt; o.y += f.vy * dt; o.z += f.vz * dt;
    const wl = f.w.length(); if (wl > 1e-3) { _stQ.setFromAxisAngle(_stV.copy(f.w).divideScalar(wl), wl * dt); o.q.premultiply(_stQ); }
    const g = groundH(o.x, o.z) + .12;
    if (o.y < g && f.vy < 0) { o.y = g; f.vy *= -.3; f.vx *= .6; f.vz *= .6; f.w.multiplyScalar(.6); if (Math.abs(f.vy) < .5 && Math.hypot(f.vx, f.vz) < .3) { o.fly = null; o.y = g; } }
    stConePose(o);
  }
}

// ─── 子彈：玻璃、電話亭、熱狗攤（鋼瓶中兩槍噴火）、護欄擋子彈 ───
function stRay(R, o) {   // 射線打到物件局部座標的盒子（x ±hx、y y0…y1、z ±hz）的距離
  const c = Math.cos(o.yaw), s = Math.sin(o.yaw), px = R.ox - o.x, pz = R.oz - o.z;
  const p = [px * c - pz * s, R.oy, px * s + pz * c - (o.roz || 0)], d = [R.dx * c - R.dz * s, R.dy, R.dx * s + R.dz * c], lo = [-o.rx, o.ry0, -o.rz], hi = [o.rx, o.ry1, o.rz];
  let t0 = 0, t1 = 1e9;
  for (let k = 0; k < 3; k++) {
    if (Math.abs(d[k]) < 1e-9) { if (p[k] < lo[k] || p[k] > hi[k]) return Infinity; continue; }
    let a = (lo[k] - p[k]) / d[k], b = (hi[k] - p[k]) / d[k]; if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return Infinity;
  }
  return t0;
}
rayHooks.push((R, hit) => {
  if (!st.ready) return;
  for (const o of st.rays) {
    if (Math.abs(o.x - R.ox) > 150 || Math.abs(o.z - R.oz) > 150) continue;
    if (o.kind === 'pane') { if (o.down) continue; o.rx = o.hw; o.rz = .04; o.ry0 = o.y0; o.ry1 = o.y1; hit(stRay(R, o), 'prop', () => stPaneBreak(o, R.dx * 3, R.dz * 3)); }
    else if (o.kind === 'booth') { if (o.down || !o.glass) continue; hit(rayCyl(R, o.x, o.z, .46, .4, 2.2), 'prop', () => stBoothGlass(o, R.dx * 2.5, R.dz * 2.5)); }
    else if (o.kind === 'hotdog') {
      if (!o.boom) { const p = stTankAt(o); hit(rayCyl(R, p.x, p.z, ST_TANK.r + .03, (p.y || .3) - .3, (p.y || .3) + .3), 'prop', (x, y, z, dmg, R2, mine) => stTankShot(o, x, y, z, mine)); }
      if (!o.down) { o.rx = .55; o.rz = .95; o.roz = .2; o.ry0 = .15; o.ry1 = 1.2; hit(stRay(R, o), 'prop', (x, y, z) => sparks(x, y, z, 5, 2.5)); }
    }
    else if (o.kind === 'jersey') { o.rx = .3; o.rz = 1.9; o.ry0 = 0; o.ry1 = .85; hit(stRay(R, o), 'prop', (x, y, z) => { sparks(x, y, z, 5, 2.5); dust(x, y, z, 2); }); }
  }
});
function stTankShot(o, x, y, z, mine) {
  sparks(x, y, z, 8, 3); o.hits++;
  if (o.hits >= ST_TANK_SHOTS) stIgnite(o, ST_TANK_FUSE, mine ? 'player' : null);
  else emit('spray', x, y, z, { vx: (Math.random() - .5) * 2, vy: 1.5, vz: (Math.random() - .5) * 2, max: 1.2, s0: .15, s1: .8, a: .4, c: [.85, .88, .9] });   // 漏氣
}
// 爆炸（69-combat.js 的 blast 呼叫）：玻璃碎、候車亭與電話亭倒、熱狗攤被掀翻而且鋼瓶跟著引燃、圍籬往外倒、護欄被推開、交通錐飛走
function stBlast(x, y, z, r, mine) {
  if (!st.ready) return;
  for (const o of st.items) {
    const ax = o.x - x, az = o.z - z, d = Math.hypot(ax, az); if (d > r) continue;
    const k = 1 - d / r, ux = ax / (d || 1), uz = az / (d || 1);
    if (o.kind === 'pane') stPaneBreak(o, ux * 8 * k, uz * 8 * k);
    else if (o.kind === 'shelter') { if (k > .45) stUproot(o, ux * 9 * k, 4 + 5 * k, uz * 9 * k, ux, uz); else for (const p of o.panes) stPaneBreak(p, ux * 6 * k, uz * 6 * k); }
    else if (o.kind === 'booth') { if (k > .5) stUproot(o, ux * 9 * k, 4 + 5 * k, uz * 9 * k, ux, uz); else stBoothGlass(o, ux * 5 * k, uz * 5 * k); }
    else if (o.kind === 'hotdog') { stKnock(o, ux * 10 * k, uz * 10 * k, 10 * k, mine ? 'player' : null); stIgnite(o, .25 + Math.random() * .4, mine ? 'player' : null); }
    else if (o.kind === 'fence' && k > .3) stFenceFall(o.row, o.i, ux, uz);
    else if (o.kind === 'cone' && !o.down) { o.down = 1; o.fly = { vx: ux * 12 * k, vy: 4 + 6 * k, vz: uz * 12 * k, w: V3(uz, 0, -ux).multiplyScalar(10) }; }
  }
  for (const o of st.jersey) { const ax = o.x - x, az = o.z - z, d = Math.hypot(ax, az); if (d < r * .6) { stJerseyDyn(o); const k = (1 - d / (r * .6)) * 4; o.vx += ax / (d || 1) * k; o.vz += az / (d || 1) * k; } }
}

// 攤販跑開：背對攤車跑 5 秒（時速 16），之後收起來
function stVendFlee(o) {
  if (!o.vend || o.vend.run) return;
  o.vend.run = 5; st.vend.anim(o.k, ANIM.run, Math.random() * 9, 1.15);
}
function stVendStep(dt) {
  for (const o of stands) {
    const v = o.vend; if (!v || !(v.run > 0)) continue;
    v.run -= dt;
    if (v.run <= 0) { st.vend.place(o.k, 0, -60, 0, 0); continue; }
    v.x -= Math.sin(o.yaw) * 4.5 * dt; v.z -= Math.cos(o.yaw) * 4.5 * dt;
    st.vend.place(o.k, v.x, groundH(v.x, v.z) > 0 ? .15 : 0, v.z, o.yaw + Math.PI);
  }
}
// 每幀（69-v5-civic.js 的 v5Update）
function streetUpdate(dt) {
  if (!st.ready) { if (cityIsWorld) stInit(); else return; }
  stShardStep(dt); stTumbleStep(dt); stFenceStep(dt); stJerseyStep(dt); stConeStep(dt); stFireStep(dt); stVendStep(dt);
}

// 驗收用：每種設施最近的一個（世界座標）、把東西擺到車前面
gtaApi.v5.street = {
  st, sites: ST_SITES, J: ST_J,
  near(kind, x = pX(), z = pZ(), alive = true) {
    const L = kind === 'jersey' ? st.jersey : kind === 'cone' ? st.cones : st.items.filter(o => o.kind === kind);
    let b = null, bd = 1e9; for (const o of L) { if (alive && o.down) continue; const d = Math.hypot(o.x - x, o.z - z); if (d < bd) { bd = d; b = o; } } return b;
  },
  count: () => ({ sites: ST_SITES.length, shelters: shelters.length, stands: stands.length, booths: booths.length, jersey: stJerseyL.length, fence: stFence.reduce((a, r) => a + r.panels.length, 0), bollards: stBollardsL.length, panes: st.paneMesh ? st.paneMesh.count : 0, glb: !!st.glb, works: !!st.wglb, vendors: st.vend ? st.vend.mesh.count : 0, bollardGlb: !!st.bglb, fortBollards: stBollardsL.filter(o => o.fort).length }),
  ignite: (o, f = ST_TANK_FUSE) => stIgnite(o, f, 'player'), knock: (o, vx = 6, vz = 0) => stKnock(o, vx, vz, Math.hypot(vx, vz), 'player'),
  // 從 (x, y, z) 朝 (tx, ty, tz) 開一槍（走 castRay／hitWith，和玩家的子彈同一條路），回傳打到的東西種類
  free: (x, z, r = 1.2) => !collideCircle(x, z, r, false).hit,   // 連路邊車一起算
  shoot(x, y, z, tx, ty, tz, dmg = 30) { const dx = tx - x, dy = ty - y, dz = tz - z, l = Math.hypot(dx, dy, dz), R = { ox: x, oy: y, oz: z, dx: dx / l, dy: dy / l, dz: dz / l }, h = castRay(R, 150, null); if (h.kind) hitWith(h, R, dmg, 'player'); return h.kind; },
};
