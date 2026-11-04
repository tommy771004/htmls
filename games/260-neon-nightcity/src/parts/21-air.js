// ═══ 灰鷺角國際機場（10-city.js 的 AIR：城西外海的填海島與接回楓林西的堤道，SEA_FR 座標框）═══
// 島（SEA_FR 座標 x −3300..−1000、z 20..600）由北到南：航廈前路與停車場、航廈（tools/props.mjs 的 air 組 term，玻璃拱門朝東）、機坪（三座空橋登機門、
// 遠端機位、機庫前）、平行滑行道、東西向跑道（西端外海上有進場燈）。堤道從楓林西第 9 條街出海，S 形接到島東緣北段的航廈前路；
// 東緣南段有一座梯子（游泳或開船上岸，31-boats.js 在旁邊停一艘船）。客機一次一架照固定的流程跑：遠端機位 → 滑行 → 往西起飛爬升到外海 →
// 從西邊進場降落 → 滑回遠端機位（客機不能駕駛）。模型只在 http(s) 下載（玩家離島 AIR_NEAR 公尺內），以檔案開啟用程式建模的替身。
// 座標：這個檔的 x、z 都是 SEA_FR 座標（沒有 ?zrot 時就是世界座標），airW 換成世界；碰撞盒用 AIR_F（沒有框的盒會被當成片的邏輯座標）
const AIR_ZN = SEA_FR, AIR_F = SEA_FR || frameW(0, 0, 1, 0), AIR_NEAR = 3600;
const airW = (x, z) => toW(x, z, AIR_ZN);
const AIR_YAW = AIR_ZN ? AIR_ZN.ry : 0;   // SEA_FR 的 yaw → 世界（剛體框，沒有彎曲）
// 版面（SEA_FR 座標）：跑道、滑行道、機坪、航廈與停機位
const AIR_L = AIR && (() => {
  const I = AIR.isl;
  return {
    I, rwy: { x0: -3200, x1: -1150, z: 500, hw: 22.5 }, twy: { x0: -3150, x1: -1200, z: 410, hw: 11.5 },
    links: [[-3150, 410, 500], [-2500, 410, 500], [-1950, 410, 500], [-1200, 410, 500], [-2300, 360, 410], [-1600, 360, 410], [-1300, 360, 410]],   // [x, z0, z1] 南北向的連絡道
    apron: { x0: -2650, x1: -1280, z0: 200, z1: 360 }, land: { x0: -1810, x1: -1000, z0: 40, z1: 90 }, plaza: { x0: -1815, x1: -1700, z0: 90, z1: 200 }, park: { x0: -1690, x1: -1290, z0: 100, z1: 190 },
    term: { x: -1900, z: 145, ry: Math.PI / 2 }, tower: { x: -1240, z: 160 }, hangar: { x: -2560, z: 265 },
    gates: [-1958, -1900, -1842].map((x, i) => ({ x, z: 200, plane: i === 1 ? 'b737' : 'a320' })),   // 空橋接在航廈南面（z 200），客機機頭朝北
    stands: [{ x: -2250, z: 300, ry: Math.PI, plane: 'b737' }, { x: -2560, z: 342, ry: Math.PI, plane: 'a320' }],   // 遠端機位、機庫門前
    stand: { x: -1360, z: 300 },   // 起降循環那一架停的遠端機位（機頭朝東，開出去不必推）
    ladder: { x: I.x1, z: 560 }, cause: { z0: 50, z1: 70 }, td: -3080,
    ret: { x: -1900, a: Math.PI / 6 },   // 快速脫離滑行道：中線在跑道中線 x −1900 往東北斜 30° 離開、接到平行滑行道（往東降落的客機從這裡出跑道）
    // 第二航廈 T2（填海地 AIR.isl2，2026-11-04）：航廈在 z −120..−60（陸側朝南、空側朝北），四座空橋接在北面，客機機頭朝南（朝航廈）；
    // 北面是 T2 機坪與東西向的滑行通道（z −225），西端沿 x −2300 往南接回 T1 機坪；陸側是落客道、停車場，往東一條連絡路接 T1 的航廈前路
    t2: { x: -1850, z: -90, hx: 160, hz: 30, jz: -130.5, pz: -169.3 },
    gates2: [-1955, -1885, -1815, -1745].map((x, i) => ({ x, plane: i % 2 ? 'b737' : 'a320' })),
    stands2: [{ x: -2120, z: -330, ry: 0, plane: 'a320' }, { x: -1580, z: -330, ry: 0, plane: 'b737' }],
    apron2: { x0: -2328, x1: -1420, z0: -430, z1: -122 }, lane2: { z: -225, x0: -2300, x1: -1450, hw: 11.5 }, link2: { x: -2300, z0: -122, z1: 200 },
    curb2: { x0: -2060, x1: -1600, z0: -54, z1: -36 }, park2: { x0: -2050, x1: -1660, z0: -24, z1: 14 }, conn2: { x0: -1612, x1: -1588, z0: -54, z1: 40 },
    // 支援設施（blender/airfac.py → 52-air-fac.js，2026-11-04）：消防站的正面就是 T1 機坪北緣的圍籬線（z 197，圍籬在 x −2164…−2104 斷開）、油庫、搜索雷達在航廈西邊的陸側；
    // ILS 定位台在跑道東端外的中線上、下滑台與氣象觀測場在著陸區南側；EMAS 在跑道東端（取代原本 50 m 的防爆區，模型 +x 朝跑道外），再往東是定位台、防吹籬（擋起飛前的噴流吹到島東緣的道路）
    fac: { fire: { x: -2140, z: 183 }, fuel: { x: -2520, z: 95 }, asr: { x: -2620, z: 150 }, loc: { x: -1082, z: 500 }, gs: { x: -2880, z: 578 }, met: { x: -2845, z: 576 }, emas: [{ x: -1146, ry: 0 }], blast: { x: -1060, z: 500 },
      // 第二批（2026-11-04）：貨運站（建築中心，北面是卡車碼頭、南面接貨機坪）、機坪西緣的試車坪（開口朝東）、空廚大樓與地勤車基地（K1 西邊，南面直接開向 T1 機坪）
      cargo: { x: -2930, z: 200 }, runup: { x: -2700, z: 316 }, cater: { x: -2395, z: 172 }, gseb: { x: -2340, z: 160 } },
  };
})();
// 快速脫離滑行道的幾何（SEA_FR）：c(z) 是中線在 z 的 x，hx 是水平方向的半寬（滑行道半寬 ÷ sin 30°）；鋪面是跑道北緣（z1）到滑行道南緣（z0）的平行四邊形，
// 兩端切齊跑道、滑行道的邊；x0…x1 是草地挖空的範圍（21-air.js 的 turf，兩邊的草地另外照斜邊補回來）
const AIR_RET = AIR_L && (() => {
  const { rwy: R, twy: W, ret: E } = AIR_L, t = Math.tan(E.a), hx = W.hw / Math.sin(E.a), c = z => E.x + (R.z - z) / t, z1 = R.z - R.hw, z0 = W.z + W.hw;
  return { c, hx, z0, z1, x0: c(z1) - hx - 4, x1: c(z0) + hx + 4, pts: [[c(z1) - hx, z1], [c(z1) + hx, z1], [c(z0) + hx, z0], [c(z0) - hx, z0]] };
})();
// 支援設施的鋪面（混凝土，頂 0.066；底下的草地挖空）：貨運站的卡車場與建築底、貨機坪（南到平行滑行道的北緣）、試車坪（往東接到機坪）、空廚與地勤車基地前的場地
const AIR_LOTS = AIR_L && (() => {
  const F = AIR_L.fac, W = AIR_L.twy;
  return { cargo: { x0: F.cargo.x - 90, x1: F.cargo.x + 90, z0: F.cargo.z - 55, z1: F.cargo.z + 36 }, capron: { x0: -3120, x1: -2770, z0: F.cargo.z + 36, z1: W.z - W.hw },
    runup: { x0: F.runup.x - 40, x1: AIR_L.apron.x0, z0: F.runup.z - 36, z1: F.runup.z + 36 }, sup: { x0: F.cater.x - 30, x1: F.gseb.x + 24, z0: F.gseb.z - 40, z1: AIR_L.apron.z0 } };
})();
if (AIR_L) {   // 00-core.js 的 applyFog：島的範圍（直升機飛到上空時霧變淡）
  const I = AIR_L.I, [cx, cz] = airW((I.x0 + I.x1) / 2, (I.z0 + I.z1) / 2), [ux, uz] = dirW(AIR_ZN, 1, 0);
  U.uAirA.value.set(cx, cz, ux, uz); U.uAirB.value.set((I.x1 - I.x0) / 2 + 60, (I.z1 + I.z0) / 2 - AIR.isl2.z0 + 20, AIR_L.term.x - (I.x0 + I.x1) / 2, AIR_L.term.z - (I.z0 + I.z1) / 2);   // z 半寬包到北邊的 isl2（中心照舊是 isl 的，AHM 與 air-int 都照這個中心）；zw 是第一航廈中心（lib.mjs 的室內補光）
}
// 機場島的日光陰影高度圖（52-air-bld.js 畫、lib.mjs 的 sunVis 查）：貼圖一定要在這裡（材質編譯前）掛上，沒有機場也掛一張 1×1
// 範圍只包有建築與停機位的那一塊（T2 機坪北緣到平行滑行道、機庫到塔台，SEA_FR x −2680..−1180、z −460..390），0.5 m 一格（10 MB 半浮點；範圍裡沒東西的格子是 −0.6：比地面低一點，低太陽時平地不自遮，又不像 −50 會把邊緣的線性內插拉歪）。
// 光柵化用的 h、m（30 MB）在停著的客機畫完後放掉（airModels），之後不再畫
const AHM = AIR_L ? (() => {
  const I = AIR_L.I, cx = (I.x0 + I.x1) / 2, cz = (I.z0 + I.z1) / 2, x0 = -2680, z0 = -460, S = .5, nx = Math.ceil(1500 / S), nz = Math.ceil(850 / S);
  const tex = new T.DataTexture(new Uint16Array(nx * nz).fill(T.DataUtils.toHalfFloat(-.6)), nx, nz, T.RedFormat, T.HalfFloatType);
  tex.minFilter = tex.magFilter = T.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  U.uAHMap.value = tex; U.uAHM.value.set(cx - x0, cz - z0, 1 / (nx * S), 1 / (nz * S));   // lib.mjs：(島中心起算的 SEA_FR 座標 + xy) × zw = uv
  return { S, nx, nz, x0, z0, h: new Float32Array(nx * nz).fill(-50), m: new Uint16Array(nx * nz), tex, max: 0, dirty: false };
})() : null;
if (!AHM) { const t = new T.DataTexture(new Uint16Array([T.DataUtils.toHalfFloat(-50)]), 1, 1, T.RedFormat, T.HalfFloatType); t.needsUpdate = true; U.uAHMap.value = t; }

// ─── 機坪：自己的材質（src/tsl/m-apron.mjs：混凝土版、雨天積水與倒影），登機門一帶的標線與輪胎痕：T1、T2 各一份（AIR_SIDES，機坪局部座標）───
// 機坪標線分兩層：直線、圓弧、實心與斜紋矩形是向量（airApronVec → 著色器照距離算，多近都銳利），字與污漬是貼圖（airApronTex，每公尺 8 像素：R 漆的覆蓋、G 色、B 輪胎痕與油污）。
// 範圍外（遠端機位、滑行道的其他段）照舊是 Kit 的標線。
// 向量表 tAprL：機坪切 4 m 一格（X 範圍），每格最多 APR_K 個圖元、每個 3 格 float（x = 格x·K + k，y = 格z·3 + 列）：
//   列 0：線段 ax az bx bz／圓弧 cx cz r／矩形 x0 z0 x1 z1；列 1：半寬、色（0 黃、1/3 白、2/3 紅、1 黑）、虛線週期或斜紋間距、虛線實的比例；列 2：種類（1 線段、2 圓弧、3 矩形，0 是結尾）、圓弧起訖角
// 登機門那一套照 T1 的座標寫（空橋旋轉廳 z 200、機頭朝北、滑行道中線 lz）；T2 的門用 mir 對旋轉廳點對稱（x → 2·門 − x、z → mir − z，mir = jz + 200；弧的角度 +π、字轉 180°）
const AIR_TX = { x0: -2176, x1: -1664, z0: 196, z1: 364, ppm: 8 }, AIR_TX2 = { x0: -1996, x1: -1712, z0: -244, z1: -124, ppm: 8 }, APR_CELL = 4, APR_K = 12;
const APR_HUE = { y: 0, w: 1 / 3, r: 2 / 3, k: 1 };
const AIR_SIDES = AIR_L ? [
  { X: AIR_TX, lz: 300, laneW: 300, mir: null, t1: 1, seed: 4417, gates: AIR_L.gates.map((g, i, a) => ({ x: g.x, plane: g.plane, no: String(21 + i), edge: i === a.length - 1 })) },
  { X: AIR_TX2, lz: AIR_L.t2.jz + 200 - AIR_L.lane2.z, laneW: AIR_L.lane2.z, mir: AIR_L.t2.jz + 200, t1: 0, seed: 5203, gates: AIR_L.gates2.map((g, i) => ({ x: g.x, plane: g.plane, no: 'B' + (i + 1), edge: i === 0 })) },
] : [];
const aprTf = (S, g) => S.mir == null ? (x, z) => [x, z] : (x, z) => [2 * g.x - x, S.mir - z];
function airApronVec(S) {
  const L = AIR_L, X = S.X, P = [];
  // 線段：butt 端；sq 時兩端各延長半寬（折線的轉角補滿）；dash = [實, 虛]（從起點的實段開始）
  const seg = (ax, az, bx, bz, col, lw = .32, dash, sq) => { if (sq && !dash) { const l = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / l * lw / 2, uz = (bz - az) / l * lw / 2; ax -= ux; az -= uz; bx += ux; bz += uz; }
    P.push({ A: [ax, az, bx, bz], B: [lw / 2, APR_HUE[col], dash ? dash[0] + dash[1] : 0, dash ? dash[0] / (dash[0] + dash[1]) : 0], C: [1, 0, 0, 0],
      bb: [Math.min(ax, bx) - lw, Math.min(az, bz) - lw, Math.max(ax, bx) + lw, Math.max(az, bz) + lw] }); };
  const line = (pts, col, lw, dash) => { for (let i = 1; i < pts.length; i++) seg(...pts[i - 1], ...pts[i], col, lw, dash, true); };
  const arc = (cx, cz, r, a0, a1, col, lw = .32) => { const xs = [], zs = []; for (let i = 0; i <= 16; i++) { const a = a0 + (a1 - a0) * i / 16; xs.push(cx + Math.cos(a) * r); zs.push(cz + Math.sin(a) * r); }
    P.push({ A: [cx, cz, r, 0], B: [lw / 2, APR_HUE[col], 0, 0], C: [2, a0, a1, 0], bb: [Math.min(...xs) - lw, Math.min(...zs) - lw, Math.max(...xs) + lw, Math.max(...zs) + lw] }); };
  const rect = (x0, z0, x1, z1, col, lw = 100, gap = 0) => P.push({ A: [x0, z0, x1, z1], B: [lw / 2, APR_HUE[col], gap, 0], C: [3, 0, 0, 0], bb: [x0 - .1, z0 - .1, x1 + .1, z1 + .1] });
  // 滑行道（通道）中線；T1 另有機坪北緣的雙黃線，T2 是滑行通道兩側的邊線
  seg(X.x0, S.laneW, X.x1, S.laneW, 'y', .3);
  if (S.t1) { seg(X.x0, L.apron.z1 - 1.3, X.x1, L.apron.z1 - 1.3, 'y', .25); seg(X.x0, L.apron.z1 - .8, X.x1, L.apron.z1 - .8, 'y', .25); }
  else for (const s of [-1, 1]) seg(X.x0, S.laneW + s * (L.lane2.hw + 1.2), X.x1, S.laneW + s * (L.lane2.hw + 1.2), 'y', .4);
  const LZ = S.lz;
  S.gates.forEach(g => {
    const f = aprTf(S, g), da = S.mir == null ? 0 : Math.PI, cl = g.x + 4.5, R = 22;
    const gseg = (ax, az, bx, bz, ...r) => seg(...f(ax, az), ...f(bx, bz), ...r);
    const gline = (pts, ...r) => line(pts.map(q => f(...q)), ...r);
    const garc = (cx, cz, r, a0, a1, ...rr) => { let b0 = a0 + da, b1 = a1 + da; if (b0 >= Math.PI - 1e-6) { b0 -= 2 * Math.PI; b1 -= 2 * Math.PI; } arc(...f(cx, cz), r, b0, b1, ...rr); };   // 著色器的 atan 在 −π..π
    const grect = (x0, z0, x1, z1, ...r) => { const [a, b] = f(x0, z0), [c, d] = f(x1, z1); rect(Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d), ...r); };
    gseg(cl, 222.5, cl, LZ - R, 'y'); garc(cl - R, LZ - R, R, 0, Math.PI / 2, 'y'); garc(cl + R, LZ - R, R, Math.PI / 2, Math.PI, 'y');   // 導入線：直線接兩個方向轉進來的四分之一圓
    gseg(cl - 2.2, 222.5, cl + 2.2, 222.5, 'y', .6);                                                                                    // 停止線（T 字）
    grect(cl - 6.4, LZ - 9.4, cl - 1.4, LZ - 5.6, 'k'); grect(cl + 1.4, 262, cl + 6.4, 265.8, 'k');                                      // 機位編號的黑底
    gline([[cl - 19, 204], [cl - 19, 266], [cl + 19, 266], [cl + 19, 204]], 'r', .3);                                                   // 裝備限制線
    { const x0 = g.x - 3.2, x1 = g.x + 3.2, z0 = 201, z1 = 216; gline([[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]], 'r', .25); grect(x0, z0, x1, z1, 'r', .4, 1.6 * Math.SQRT1_2); }   // 空橋輪架底下的斜紋禁停區
    for (const s of [-1, 1]) { const a = Math.min(cl + s * 9, cl + s * 17), b = Math.max(cl + s * 9, cl + s * 17);                    // 地勤車停放格（白色虛線）
      gseg(a, 204, b, 204, 'w', .2, [1, .8]); gseg(b, 204, b, 213, 'w', .2, [1, .8]); gseg(b, 213, a, 213, 'w', .2, [1, .8]); gseg(a, 213, a, 204, 'w', .2, [1, .8]); }
    gseg(cl - 29, 204, cl - 29, LZ - 4, 'w', .2, [3, 3]); if (g.edge) gseg(cl + 29, 204, cl + 29, LZ - 4, 'w', .2, [3, 3]);           // 翼尖淨空線
  });
  // 地勤車道（AIR_GSE 繞圈的路，T1）：兩邊白實線、中間白虛線，穿過滑行道的地方畫斑馬線
  if (S.t1) {
    const RW = 4, loop = [[-2150, 272], [-1790, 272], [-1790, 335], [-2150, 335]];
    for (let i = 0; i < 4; i++) {
      const [ax, az] = loop[i], [bx, bz] = loop[(i + 1) % 4], hx = Math.abs(bx - ax) > 1, nx = hx ? 0 : 1, nz = hx ? 1 : 0, e = RW;
      const ext = (s, o) => [ax - (hx ? Math.sign(bx - ax) * e * s : 0) + nx * o, az - (hx ? 0 : Math.sign(bz - az) * e * s) + nz * o, bx + (hx ? Math.sign(bx - ax) * e * s : 0) + nx * o, bz + (hx ? 0 : Math.sign(bz - az) * e * s) + nz * o];
      seg(...ext(1, -RW), 'w', .2); seg(...ext(1, RW), 'w', .2); seg(...ext(0, 0), 'w', .16, [2.5, 4]);
      if (!hx) seg(ax, 300 - 6.3, ax, 300 + 6.9, 'w', 2 * (RW - .3), [.6, .6]);   // 穿越滑行道的斑馬線：一條寬的虛線
    }
  }
  // 分格
  const nx = Math.ceil((X.x1 - X.x0) / APR_CELL), nz = Math.ceil((X.z1 - X.z0) / APR_CELL), cells = Array.from({ length: nx * nz }, () => []);
  P.forEach((p, n) => { const [x0, z0, x1, z1] = p.bb;
    for (let cz = Math.max(0, Math.floor((z0 - X.z0) / APR_CELL)); cz <= Math.min(nz - 1, Math.floor((z1 - X.z0) / APR_CELL)); cz++)
      for (let cx = Math.max(0, Math.floor((x0 - X.x0) / APR_CELL)); cx <= Math.min(nx - 1, Math.floor((x1 - X.x0) / APR_CELL)); cx++) cells[cz * nx + cx].push(n); });
  const W = nx * APR_K, d = new Float32Array(W * nz * 3 * 4); let over = 0;
  cells.forEach((list, ci) => { const cx = ci % nx, cz = (ci - cx) / nx; if (list.length > APR_K) over++;
    list.slice(0, APR_K).forEach((n, k) => { const p = P[n]; [p.A, p.B, p.C].forEach((v, r) => d.set(v, (((cz * 3 + r) * W) + cx * APR_K + k) * 4)); }); });
  if (over) console.warn('apron marks: cells over', APR_K, over);
  const t = new T.DataTexture(d, W, nz * 3, T.RGBAFormat, T.FloatType);
  t.minFilter = t.magFilter = T.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return { tex: t, nx, nz, n: P.length, over };
}
function airApronTex(S) {
  const X = S.X, w = (X.x1 - X.x0) * X.ppm, h = (X.z1 - X.z0) * X.ppm;
  const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.setTransform(X.ppm, 0, 0, X.ppm, -X.x0 * X.ppm, -X.z0 * X.ppm); g.lineCap = 'butt'; return [c, g]; };
  const [cP, P] = mk(), [cG, G] = mk();
  const COL = { y: 'rgb(255,0,0)', w: 'rgb(255,85,0)', r: 'rgb(255,170,0)', k: 'rgb(255,255,0)' };
  const text = (s, x, z, size, col, rot) => { P.save(); P.setTransform(1, 0, 0, 1, (x - X.x0) * X.ppm, (z - X.z0) * X.ppm); if (rot) P.rotate(Math.PI); P.fillStyle = COL[col]; P.font = `700 ${size * X.ppm * 1.3}px "Helvetica Neue",Arial,sans-serif`; P.textAlign = 'center'; P.textBaseline = 'middle'; P.fillText(s, 0, 0); P.restore(); };   // 字用像素座標畫（變換過的 1 px 字型會糊）
  const grime = (pts, lw, a) => { G.strokeStyle = `rgba(255,255,255,${a})`; G.lineWidth = lw; G.beginPath(); pts.forEach(([x, z], i) => i ? G.lineTo(x, z) : G.moveTo(x, z)); G.stroke(); };
  const blot = (x, z, r, a) => { const gr = G.createRadialGradient(x, z, 0, x, z, r); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); G.fillStyle = gr; G.beginPath(); G.arc(x, z, r, 0, Math.PI * 2); G.fill(); };
  const rnd = rng(S.seed), LZ = S.lz;
  grime([[X.x0, S.laneW], [X.x1, S.laneW]], 1.6, .18);
  S.gates.forEach(g => {
    const f = aprTf(S, g), da = S.mir == null ? 0 : Math.PI, rot = S.mir != null, cl = g.x + 4.5, R = 22;
    const gg = (pts, ...r) => grime(pts.map(q => f(...q)), ...r), gb = (x, z, ...r) => blot(...f(x, z), ...r), gt = (s, x, z, ...r) => text(s, ...f(x, z), ...r, rot);
    for (const o of [-3.3, 0, 3.3]) { gg([[cl + o, 236], [cl + o, LZ - R]], o ? 1.1 : .6, o ? .55 : .35); G.strokeStyle = `rgba(255,255,255,${o ? .3 : .2})`; G.lineWidth = o ? 1.1 : .6;   // 鼻輪與主輪的輪胎痕
      for (const s of [-1, 1]) { G.beginPath(); G.arc(...f(cl + s * R, LZ - R), R - s * o, (s < 0 ? 0 : Math.PI / 2) + da, (s < 0 ? Math.PI / 2 : Math.PI) + da); G.stroke(); } }
    gb(cl - 3.3, 239.5, 2.2, .6); gb(cl + 3.3, 239.5, 2.2, .6); gb(cl, 223.5, 1.3, .45);
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) gb(cl + s * (5.7 + rnd() * 1.5), 228 + rnd() * 8, .8 + rnd() * 1.4, .35 + rnd() * .3);   // 發動機下的油漬
    gt(g.plane === 'b737' ? '737' : 'A320', cl - 4.2, 222.7, 1.1, 'w');                                // 停止線旁的機型字（右邊停著電源車）
    gt(g.no, cl - 3.9, LZ - 7.4, 2.6, 'y'); gt(g.no, cl + 3.9, 264, 2.6, 'y');                          // 機位編號（黑底是向量）
    for (const s of [-1, 1]) { const a = cl + s * 9, b = cl + s * 17; gt('GSE', (a + b) / 2, 208.5, 1.6, 'w'); for (let k = 0; k < 3; k++) gb(a + (b - a) * rnd(), 205 + rnd() * 7, 1 + rnd(), .3); }
  });
  if (S.t1) {
    const loop = [[-2150, 272], [-1790, 272], [-1790, 335], [-2150, 335]];
    for (let i = 0; i < 4; i++) {   // 地勤車道上兩條輪胎痕
      const [ax, az] = loop[i], [bx, bz] = loop[(i + 1) % 4], hx = Math.abs(bx - ax) > 1;
      for (const o of [-1.1, 1.1]) grime([[ax + (hx ? 0 : o), az + (hx ? o : 0)], [bx + (hx ? 0 : o), bz + (hx ? o : 0)]], .7, .28);
    }
  }
  // 合成：R、G 來自字，B 是模糊過的污漬
  const out = new Uint8Array(w * h * 4), pd = P.getImageData(0, 0, w, h).data;
  { const c2 = document.createElement('canvas'); c2.width = w; c2.height = h; const g2 = c2.getContext('2d'); g2.filter = `blur(${X.ppm * .75}px)`; g2.drawImage(cG, 0, 0); const gd = g2.getImageData(0, 0, w, h).data;
    for (let i = 0; i < w * h; i++) { const a = pd[i * 4 + 3] / 255; out[i * 4] = pd[i * 4] * a; out[i * 4 + 1] = pd[i * 4 + 1]; out[i * 4 + 2] = gd[i * 4 + 3]; out[i * 4 + 3] = 255; } }
  const t = new T.DataTexture(out, w, h, T.RGBAFormat, T.UnsignedByteType);
  t.wrapS = t.wrapT = T.ClampToEdgeWrapping; t.magFilter = T.LinearFilter; t.minFilter = T.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 8; t.needsUpdate = true;
  return t;
}
const AIR_APR = AIR_SIDES.map(airApronVec);
if (AIR_L) [AIR_L.apron, AIR_L.apron2].forEach((A, i) => {   // T1、T2 機坪：同一個著色器，各自的標線表與貼圖
  const S = AIR_SIDES[i], X = S.X, V = AIR_APR[i], g = new T.BoxGeometry(A.x1 - A.x0, .26, A.z1 - A.z0);
  g.translate((A.x0 + A.x1) / 2, -.07, (A.z0 + A.z1) / 2);
  const mat = new T.ShaderMaterial({ name: 'apron', defines: { FAR: '0.200' }, uniforms: { ...shared(ALLU), ...reflU, tApr: { value: airApronTex(S) }, uApr: { value: new T.Vector4(X.x0, X.z0, 1 / (X.x1 - X.x0), 1 / (X.z1 - X.z0)) },
    tAprL: { value: V.tex }, uAprG: { value: new T.Vector4(X.x0, X.z0, V.nx, V.nz) } } });
  groundAdd(new T.Mesh(g, mat), AIR_ZN);
});
// ─── 地面、標線、燈、護岸、擋牆、堤道（一個網格，遠景材質：城西的岸邊隔著一公里的海也看得到）───
if (AIR_L) {
  const L = AIR_L, I = L.I, k = new Kit(), grass = 0x3b4733, asph = 0x2b2c2f, twc = 0x34363a, conc = 0x8e8c86, white = 0xe6e4dc, yel = 0xd9ae3a;
  const B = (x0, x1, z0, z1, y0, y1, col, mat = 2) => k.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, col, mat);
  // 水平的多邊形板（快速脫離滑行道這種斜的鋪面）：pts 是 SEA_FR 的 [x, z]，頂在 y1、底在 y0（07-kitx.js 的 prism 轉 −90° 躺平）
  const slab = (pts, y0, y1, col, mat = 2) => k.prism(0, (y0 + y1) / 2, 0, pts.map(([x, z]) => [x, -z]), y1 - y0, col, mat, -Math.PI / 2);
  // 島（頂是草地）：機坪底下的草地壓低到 −0.25（機坪頂 0.06，兩個大平面只差 6 cm 時遠處深度精度不夠，草地會一階一階蓋過機坪）
  const MOW = 15, grass2 = 0x3f4b36, turf = (R0, holes) => {
    const xs = [R0.x0, R0.x1], zs = [R0.z0, R0.z1];
    for (const h of holes) { xs.push(Math.max(R0.x0, Math.min(R0.x1, h.x0)), Math.max(R0.x0, Math.min(R0.x1, h.x1))); zs.push(Math.max(R0.z0, Math.min(R0.z1, h.z0)), Math.max(R0.z0, Math.min(R0.z1, h.z1))); }
    const ux = [...new Set(xs)].sort((a, b) => a - b), uz = [...new Set(zs)].sort((a, b) => a - b);
    for (let i = 1; i < ux.length; i++) for (let j = 1; j < uz.length; j++) {
      const cx = (ux[i - 1] + ux[i]) / 2, cz = (uz[j - 1] + uz[j]) / 2, inH = holes.some(h => cx > h.x0 && cx < h.x1 && cz > h.z0 && cz < h.z1);
      if (inH) { B(ux[i - 1], ux[i], uz[j - 1], uz[j], -9, -.25, grass); continue; }
      for (let z = uz[j - 1]; z < uz[j];) { const b = Math.floor(z / MOW + 1e-6), z1 = Math.min(uz[j], (b + 1) * MOW); B(ux[i - 1], ux[i], z, z1, -9, 0, b & 1 ? grass2 : grass); z = z1; }   // 割草條紋：沿跑道方向 15 m 一條、深淺相間
    }
  };
  // 跑道、滑行道、連絡道底下也挖空壓低（只差 8–10 cm，割草條紋把草地切成 15 m 的長條後，遠看跑道北緣會冒出一排鋸齒）
  // 陸側的落客道、廣場、停車場、航廈四周的混凝土同理（範圍要和下面畫的鋪面一模一樣，不然會露出凹下去的草地）
  const J = AIR.isl2;                                                                          // 北邊的填海地（T2）
  { const R = L.rwy, W = L.twy, C = L.curb2, t = L.t2, K = L.link2, emas = !!document.getElementById('glb-airfac');
    const pave = [L.apron2, { x0: R.x0 - 60, x1: R.x1 + (emas ? 4 : 50), z0: R.z - R.hw, z1: R.z + R.hw }, { x0: W.x0 - W.hw, x1: W.x1 + W.hw, z0: W.z - W.hw, z1: W.z + W.hw },
      ...L.links.map(([x, z0, z1]) => ({ x0: x - W.hw, x1: x + W.hw, z0, z1 })), { x0: K.x - W.hw, x1: K.x + W.hw, z0: K.z0, z1: K.z1 },
      L.land, L.plaza, L.park, { x0: L.term.x - 84, x1: L.plaza.x0, z0: L.term.z - 52, z1: L.apron.z0 },
      C, L.conn2, L.park2, { x0: t.x - t.hx - 30, x1: t.x + t.hx + 30, z0: t.z - t.hz - 4, z1: C.z0 },
      { x0: AIR_RET.x0, x1: AIR_RET.x1, z0: AIR_RET.z0, z1: AIR_RET.z1 }, ...Object.values(AIR_LOTS)];
    turf(I, [L.apron, ...pave]); turf(J, pave);
    // 快速脫離滑行道兩側：挖空的長方形裡，斜邊外的草地照同樣的割草條紋補回來（頂在 0）
    const { c, hx, z0, z1, x0, x1 } = AIR_RET;
    for (let z = z0; z < z1;) {
      const b = Math.floor(z / MOW + 1e-6), zb = Math.min(z1, (b + 1) * MOW), col = b & 1 ? grass2 : grass;
      slab([[x0, z], [c(z) - hx, z], [c(zb) - hx, zb], [x0, zb]], -.25, 0, col);
      slab([[c(z) + hx, z], [x1, z], [x1, zb], [c(zb) + hx, zb]], -.25, 0, col);
      z = zb;
    }
    // 3D 草叢與雜草（27-props.js 拿 nat_forest 的 grass_patch 實例化，只畫 40 m 內）：跑道、滑行道、連絡道兩側草地邊緣一撮撮沒割到的長草，
    // 外面零星幾叢更高的；柏油邊緣的縫裡冒出來的矮雜草（站在鋪面頂）。世界座標（zn: null），方向跟著邊緣（SEA_FR 的 x 軸轉到世界）
    { const rr = rng(4111), [ax, az] = airW(0, 0), [bx, bz] = airW(1, 0), ry0 = Math.atan2(-(bz - az), bx - ax), solid = [L.apron, ...pave];
      const onGrass = (x, z) => [I, J].some(Q => x > Q.x0 + 6 && x < Q.x1 - 6 && z > Q.z0 + 6 && z < Q.z1 - 6) && !solid.some(h => x > h.x0 - .05 && x < h.x1 + .05 && z > h.z0 - .05 && z < h.z1 + .05)
        && !(Math.abs(Math.abs(z - R.z) - R.hw - 3.2) < .9);   // 跑道兩側的排水溝
      const put = (x, z, ry, len, dep, h, y) => { const [X, Z] = airW(x, z); weeds.grass.push({ x: X, y, z: Z, ry: ry0 + ry, sx: len / 4, sy: h / .94, sz: dep / 3.5, zn: null }); };
      // 一條邊：沿 ax（'x' 或 'z'）從 a 到 b、邊在 c、往草地是 n（±1）；鋪面頂 yt
      const edge = (ax, a, b, c, n, yt) => {
        const P = (t, o) => ax === 'x' ? [t, c + n * o] : [c + n * o, t], er = ax === 'x' ? 0 : Math.PI / 2;
        for (let t = a + 2 + rr() * 3; t < b - 2; t += 2 + rr() * 3.5) {
          if (rr() < .75) for (let k = 2 + (rr() * 3 | 0); k > 0; k--) {
            const [x, z] = P(t + (rr() - .5) * 2.4, .1 + rr() * 1.7); if (onGrass(x, z)) put(x, z, er + (rr() - .5) * .5, .8 + rr() * 1.4, .25 + rr() * .3, .3 + rr() * .35, 0);
          }
          if (rr() < .28) { const [x, z] = P(t + (rr() - .5) * 2, -(.04 + rr() * .2)); put(x, z, er + (rr() - .5) * .8, .18 + rr() * .35, .08 + rr() * .1, .07 + rr() * .12, yt); }
          if (rr() < .14) { const [x, z] = P(t, 2.5 + rr() * 7); if (onGrass(x, z)) put(x, z, rr() * 6.28, .5 + rr() * .7, .4 + rr() * .4, .3 + rr() * .3, 0); }
        }
      };
      for (const n of [-1, 1]) { edge('x', R.x0, R.x1, R.z + n * R.hw, n, .1); edge('x', W.x0 - W.hw, W.x1 + W.hw, W.z + n * W.hw, n, .08); }
      for (const [x, z0, z1] of L.links) for (const n of [-1, 1]) edge('z', z0, z1, x + n * W.hw, n, .075);
      for (const n of [-1, 1]) edge('z', K.z0, K.z1, K.x + n * W.hw, n, .079);
    }
  }
  // 護岸：四邊往海裡斜下去的消波石（往外 9 m、斜 32°）；北緣在 isl2 那一段斷開，isl2 自己北、西、東三邊
  const th = .56, rk = 0x56524b, wR = 11;
  const revN = (x0, x1, z, d) => k.box((x0 + x1) / 2, -Math.sin(th) * wR / 2 - .5, z + d * (Math.cos(th) * wR / 2 - .4), x1 - x0, 1.6, wR, rk, 2, d * th);
  const revE = (z0, z1, x, d) => k.box(x + d * (Math.cos(th) * wR / 2 - .4), -Math.sin(th) * wR / 2 - .5, (z0 + z1) / 2, wR, 1.6, z1 - z0, rk, 2, 0, 0, -d * th);
  revN(I.x0 - 8, I.x1 + 8, I.z1, 1);
  revN(I.x0 - 8, J.x0, I.z0, -1); revN(J.x1, I.x1 + 8, I.z0, -1);
  revN(J.x0 - 8, J.x1 + 8, J.z0, -1); revE(J.z0 - 8, I.z0 + 4, J.x0, -1); revE(J.z0 - 8, I.z0 + 4, J.x1, 1);
  k.box(I.x1 + Math.cos(th) * wR / 2 - .4, -Math.sin(th) * wR / 2 - .5, (I.z0 + I.z1) / 2, wR, 1.6, I.z1 - I.z0 + 16, rk, 2, 0, 0, -th);
  k.box(I.x0 - Math.cos(th) * wR / 2 + .4, -Math.sin(th) * wR / 2 - .5, (I.z0 + I.z1) / 2, wR, 1.6, I.z1 - I.z0 + 16, rk, 2, 0, 0, th);
  // 鋪面（高度一層層錯開，遠看不閃）：機坪、滑行道、連絡道、跑道、航廈前路、廣場、停車場
  const A = L.apron, R = L.rwy, W = L.twy;
  // 跑道、滑行道、連絡道與快速脫離滑行道的柏油（連同上面的擦痕、補縫、防爆區）是材質 20（m-uber.mjs：雨天變濕、凹處積水、下雨有漣漪）
  B(W.x0 - W.hw, W.x1 + W.hw, W.z - W.hw, W.z + W.hw, -.2, .08, twc, 20);
  for (const [x, z0, z1] of L.links) B(x - W.hw, x + W.hw, z0, z1, -.2, .075, twc, 20);
  for (const P of Object.values(AIR_LOTS)) B(P.x0, P.x1, P.z0, P.z1, -.2, .066, conc);         // 支援設施的混凝土場地（AIR_LOTS）
  slab(AIR_RET.pts, -.2, .078, twc, 20);                                                       // 快速脫離滑行道（兩端切齊跑道與滑行道的邊）
  B(R.x0, R.x1, R.z - R.hw, R.z + R.hw, -.2, .1, asph, 20);
  B(R.x0 - 60, R.x0, R.z - R.hw, R.z + R.hw, -.2, .09, 0x35322c, 20);                         // 跑道頭外的防爆區（黃色 V 字）
  const emas = !!document.getElementById('glb-airfac');                                     // 東端的防爆區換成 EMAS（52-air-fac.js），只留 4 m
  B(R.x1, R.x1 + (emas ? 4 : 50), R.z - R.hw, R.z + R.hw, -.2, .09, 0x35322c, 20);
  B(L.land.x0, L.land.x1, L.land.z0, L.land.z1, -.2, .06, asph);
  B(L.plaza.x0, L.plaza.x1, L.plaza.z0, L.plaza.z1, -.2, .07, 0x6f6c66);
  B(L.term.x - 84, L.plaza.x0, L.term.z - 52, L.apron.z0, -.2, .066, 0x8e8c86);                // 航廈四周的混凝土（52-air-bld.js 的航廈蓋在上面）
  // 停車場：柏油，停車格那幾排（每排 10 m 深）用材質 17（m-uber.mjs：格線在著色器裡照像素足跡反鋸齒，遠看淡成灰，不會像 14 cm 的薄方塊那樣閃成點陣）
  const lot = (P, rows) => { let z = P.z0; for (const r of rows) { B(P.x0, P.x1, z, r - 5, -.2, .065, 0x3a3b3e); B(P.x0, P.x1, r - 5, r + 5, -.2, .065, 0x3a3b3e, 17); z = r + 5; } B(P.x0, P.x1, z, P.z1, -.2, .065, 0x3a3b3e); };
  lot(L.park, [L.park.z0 + 6, L.park.z0 + 34, L.park.z0 + 56, L.park.z1 - 6]);
  // 跑道標線：中線虛線、邊線、兩端的斑馬線（threshold）、著陸區與瞄準點
  // 漆線一律用材質 19（m-uber.mjs：大片磨損＋細碎掉漆，掉漆處透出柏油；細節比像素小時改用平均值）
  const M = (x0, x1, z0, z1, col = white, y = .12) => B(x0, x1, z0, z1, y - .02, y, col, 19);
  { // T2：落客道與連絡路（瀝青）、停車場、航廈四周的混凝土、滑行通道與往南接回 T1 機坪的連絡滑行道（機坪本身是 apron 材質，下面另一個網格）
    const C = L.curb2, P = L.park2, Q = L.conn2, N = L.lane2, K = L.link2, t = L.t2;
    B(C.x0, C.x1, C.z0, C.z1, -.2, .06, asph); B(Q.x0, Q.x1, Q.z0, Q.z1, -.2, .061, asph); lot(P, [P.z0 + 6, P.z1 - 6]);
    B(t.x - t.hx - 30, t.x + t.hx + 30, t.z - t.hz - 4, C.z0, -.2, .066, conc);                // 航廈底下與兩端
    B(t.x - t.hx - 6, t.x + t.hx + 6, t.z + t.hz, C.z0, -.2, .15, 0xa29f97);                    // 航廈門口的人行道（高出落客道 9 cm）
    B(C.x0, C.x1, C.z1, P.z0 - 2, -.2, .14, 0x9a978f);                                          // 落客道外側的安全島（雨遮的柱、護柱立在上面）與停車場邊的人行道
    B(K.x - W.hw, K.x + W.hw, K.z0, K.z1, -.2, .079, twc, 20);
    M(K.x - .2, K.x + .2, N.z, K.z1, yel, .099);
    for (let x = C.x1 - 4; x > C.x0 + 4; x -= 9) M(x - 3, x, (C.z0 + C.z1) / 2 - .12, (C.z0 + C.z1) / 2 + .12, white, .08);
    for (let z = Q.z0 + 4; z < Q.z1 - 4; z += 9) M((Q.x0 + Q.x1) / 2 - .12, (Q.x0 + Q.x1) / 2 + .12, z, z + 3, white, .081);
    // T2 機坪：登機門那一段（AIR_TX2）的標線在機坪的向量表與貼圖裡，這裡只畫範圍外的滑行通道中線、兩側邊線與遠端機位的導入線
    for (const [x0, x1] of [[N.x0, AIR_TX2.x0], [AIR_TX2.x1, N.x1]]) { M(x0, x1, N.z - .2, N.z + .2, yel, .1); M(x0, x1, N.z - N.hw - 1.4, N.z - N.hw - 1, yel, .08); M(x0, x1, N.z + N.hw + 1, N.z + N.hw + 1.4, yel, .08); }
    for (const sd of L.stands2) M(sd.x - .2, sd.x + .2, sd.z - 25, sd.z + 25, yel, .08);
  }
  for (let x = R.x0 + 120; x < R.x1 - 120; x += 50) M(x, x + 30, R.z - .45, R.z + .45);
  { const { c, hx } = AIR_RET, ra = c(R.z - R.hw + 1.4) - hx - 1, rb = c(R.z - R.hw + .5) + hx + 1;   // 北側邊線在快速脫離滑行道的口斷開
    M(R.x0, R.x1, R.z + R.hw - 1.4, R.z + R.hw - .5); M(R.x0, ra, R.z - R.hw + .5, R.z - R.hw + 1.4); M(rb, R.x1, R.z - R.hw + .5, R.z - R.hw + 1.4); }
  for (const [x, d] of [[R.x0 + 6, 1], [R.x1 - 6, -1]]) {
    for (let i = 0; i < 8; i++) for (const s of [-1, 1]) { const z = R.z + s * (3 + i * 2.3); M(Math.min(x, x + d * 30), Math.max(x, x + d * 30), z - .9, z + .9); }
    for (const [a, w] of [[400, 9], [150, 3], [300, 3], [500, 3], [600, 3]]) for (const s of [-1, 1]) {   // 瞄準點（兩條粗的）與著陸區的成對短條
      const x0 = x + d * a, z = R.z + s * (w > 5 ? 9 : 7.5); M(Math.min(x0, x0 + d * (w > 5 ? 45 : 22)), Math.max(x0, x0 + d * (w > 5 ? 45 : 22)), z - w / 2, z + w / 2);
    }
  }
  for (const [x0, d] of emas ? [[R.x0, 1]] : [[R.x0, 1], [R.x1, -1]]) for (let i = 0; i < 5; i++) for (const s of [-1, 1]) {   // 防爆區的黃色 V 字
    const xa = x0 - d * (8 + i * 10); k.box(xa, .105, R.z + s * 10, 1, .02, 24, yel, 19, 0, s * d * .55);
  }
  // 滑行道：黃色中線、連絡道中線；機坪：停機位的導入線與停止線、機坪邊線
  M(W.x0, W.x1, W.z - .2, W.z + .2, yel, .1);
  for (const [x, z0, z1] of L.links) M(x - .2, x + .2, z0, z1, yel, .095);
  { // 快速脫離滑行道：跑道中線上斜出去的黃色引導線、沿中線一路到平行滑行道；等候線垂直於中線（u 是沿中線離跑道中線的距離，換算成和連絡道等候線同樣的 z）
    const E = L.ret, ca = Math.cos(E.a), sa = Math.sin(E.a), at = u => [E.x + u * ca, R.z - u * sa], u1 = R.hw / sa, u2 = (R.z - W.z) / sa;
    const seg = (u0, u1, y) => { const [ax, az] = at(u0), [bx, bz] = at(u1); k.box((ax + bx) / 2, y, (az + bz) / 2, u1 - u0, .02, .4, yel, 19, 0, E.a); };
    seg(2, u1, .11); seg(u1, u2, .085);
    const bar = (u, v0, v1) => { const [x, z] = at(u), v = (v0 + v1) / 2; k.box(x + v * sa, .087, z + v * ca, .3, .02, v1 - v0, yel, 19, 0, E.a); };
    for (const z of [438.25, 438.85]) bar((R.z - z) / sa, -W.hw, W.hw);
    for (const z of [439.75, 440.35]) for (let v = -W.hw; v < W.hw - .5; v += 1.8) bar((R.z - z) / sa, v, Math.min(v + 1, W.hw));
  }
  for (const [x, z0, z1] of L.links) if (z1 === R.z) {   // 跑道等候線（z 438–441）：滑行道那一側兩條實線、跑道那一側兩條虛線；旁邊的等候點指示牌在 52-air-bld.js
    M(x - W.hw, x + W.hw, 438.1, 438.4, yel, .097); M(x - W.hw, x + W.hw, 438.7, 439, yel, .097);
    for (let s = x - W.hw; s < x + W.hw - .5; s += 1.8) { M(s, Math.min(s + 1, x + W.hw), 439.6, 439.9, yel, .097); M(s, Math.min(s + 1, x + W.hw), 440.2, 440.5, yel, .097); }
  }
  for (const [x0, x1] of [[A.x0, AIR_TX.x0], [AIR_TX.x1, A.x1]]) { M(x0, x1, A.z1 - 1.4, A.z1 - 1, yel, .08); M(x0, x1, 299.8, 300.2, yel, .08); }   // 登機門那一段畫在機坪的貼圖裡
  for (const s of L.stands) { M(s.x - .2, s.x + .2, s.z - 25, s.z + 25, yel, .08); }
  M(L.stand.x - 25, L.stand.x + 25, L.stand.z - .2, L.stand.z + .2, yel, .081);
  { // 支援設施的標線：貨機坪三個機位（從平行滑行道往北的導入線、停止線、紅色的設備限制線）、建築前的黃色邊線；試車坪的導入線與鼻輪停止線；地勤車基地的停車格
    const F = L.fac, CA = AIR_LOTS.capron, red = 0xc23a2c, zs = CA.z0 + 26;
    for (const x of [-3060, -2960, -2860]) {
      M(x - .2, x + .2, zs, CA.z1, yel, .08); M(x - 2, x + 2, zs - .4, zs, white, .081);
      for (const s of [-1, 1]) M(x + s * 31 - .15, x + s * 31 + .15, CA.z0 + 8, zs + 70, red, .079);
      M(x - 31, x + 31, CA.z0 + 7.85, CA.z0 + 8.15, red, .0795);
    }
    for (const z of [CA.z0 + 1, CA.z0 + 1.6]) M(CA.x0, CA.x1, z, z + .3, yel, .08);
    const RU = AIR_LOTS.runup; M(F.runup.x - 14, RU.x1, F.runup.z - .2, F.runup.z + .2, yel, .08); M(F.runup.x - 14.4, F.runup.x - 14, F.runup.z - 2, F.runup.z + 2, white, .081);
    for (let i = 0; i <= 8; i++) { const x = F.gseb.x - 20 + i * 5; M(x - .08, x + .08, F.gseb.z + 10, F.gseb.z + 22, white, .08); }   // 地勤車基地的停車格（9 條線、8 格）
  }
  for (let x = L.land.x1 - 4; x > L.land.x0 + 4; x -= 9) M(x - 3, x, (L.land.z0 + L.land.z1) / 2 - .12, (L.land.z0 + L.land.z1) / 2 + .12, white, .08);
  // 燈：跑道邊燈（白）、跑道頭（綠／紅）、滑行道邊燈（藍）、西端外海的進場燈（燈柱立在海裡）、PAPI
  const lamp = (x, z, col, y = .35, s = .9) => k.box(x, y, z, s, .5, s, col, 11);
  // 跑道與滑行道的邊燈是立式燈具：鋁底座、黃色易斷支柱、發光的燈罩、黑色燈帽（進場燈、跑道頭燈仍是燈箱）
  const fix = (x, z, col, h = .34, r = .27) => { k.box(x, .03, z, .34, .06, .34, 0x6a6d72, 15); k.cyl(x, .06 + h / 2, z, .035, .045, h, 6, yel, 2); k.cyl(x, .06 + h + .13, z, r * .8, r, .26, 10, col, 11); k.cyl(x, .06 + h + .28, z, r * .45, r * .8, .04, 10, 0x2a2b2e, 15); };
  // 跑道邊燈：白，往東降落的最後 600 m 轉黃（警示區）；北側在快速脫離滑行道的口不立燈
  const ret = AIR_RET, inRet = (x, z) => Math.abs(x - ret.c(z)) < ret.hx + 1;
  for (let x = R.x0; x <= R.x1; x += 60) for (const s of [-1, 1]) { const z = R.z + s * (R.hw + 1.5); if (!inRet(x, z)) fix(x, z, x > R.x1 - 600 ? 0xffc23a : 0xfff0d2); }
  for (const [x, c0, c1] of [[R.x0 - 1, 0x4dff7a, 0xff3b30], [R.x1 + 1, 0x4dff7a, 0xff3b30]]) for (let z = R.z - R.hw; z <= R.z + R.hw; z += 4.5) { lamp(x - 1.2, z, c0); lamp(x + 1.2, z, c1); }
  for (let x = W.x0; x <= W.x1; x += 50) for (const s of [-1, 1]) { const z = W.z + s * (W.hw + 1); if (!inRet(x, z)) fix(x, z, 0x3a6bff, .26, .22); }
  // 滑行道中線的嵌入式綠燈（30 m 一盞，平貼在中線上）：平行滑行道、連絡道、T2 的滑行通道與 K1
  const inset = (x, z, y, col = 0x4dff7a, s = 1) => { k.box(x, y, z, .6 * s, .008, .6 * s, 0x55585c, 15); k.box(x, y + .006, z, .4 * s, .008, .4 * s, col, 11); };
  // 跑道中心線燈：15 m 一盞、偏中線 0.9 m（避開中線虛線）；往東降落的倒數 900–300 m 紅白相間、最後 300 m 紅
  for (let x = R.x0 + 7.5, i = 0; x < R.x1; x += 15, i++) inset(x, R.z + .9, .116, x > R.x1 - 300 || (x > R.x1 - 900 && i & 1) ? 0xff3b30 : 0xfff0d2, .8);
  { // 快速脫離滑行道的中線燈：跑道上到等候線之前綠黃相間、之後綠（15 m 一盞，沿引導線）
    const E = L.ret, ca = Math.cos(E.a), sa = Math.sin(E.a), uh = (R.z - 440) / sa, u1 = R.hw / sa, u2 = (R.z - W.z - W.hw) / sa;
    for (let u = 15, i = 0; u < u2; u += 15, i++) inset(E.x + u * ca, R.z - u * sa, u < u1 ? .118 : .1, u < uh && i & 1 ? 0xffc23a : 0x4dff7a, u < u1 ? .8 : 1);
  }
  for (let x = W.x0 + 15; x < W.x1; x += 30) inset(x, W.z, .101);
  for (const [x, z0, z1] of L.links) for (let z = z0 + 15; z < z1 - 8; z += 30) inset(x, z, .096);
  for (let x = L.lane2.x0 + 15; x < L.lane2.x1; x += 30) inset(x, L.lane2.z, .101);
  for (let z = L.link2.z0 + 15; z < L.link2.z1 - 8; z += 30) inset(L.link2.x, z, .1);
  for (let i = 1; i <= 18; i++) {
    const x = R.x0 - 60 - i * 30, top = 1.2 + i * .25;
    k.box(x, (top - 9) / 2, R.z, .5, top + 9, .5, 0x3a3a3a, 15);
    k.box(x, top, R.z, .4, .2, i === 10 ? 30 : 4.5, 0x3a3a3a, 15);
    for (let z = -(i === 10 ? 14 : 2); z <= (i === 10 ? 14 : 2); z += i === 10 ? 3.5 : 1) lamp(x, R.z + z, 0xfff6e4, top + .3, .8);
  }
  for (let i = 0; i < 4; i++) { const z = R.z - R.hw - 14 - i * 9; k.box(R.x0 + 420, .9, z, 1.2, 1, 2.4, 0x2a2a2a, 2); k.box(R.x0 + 420.7, 1.05, z, .3, .5, 2, i < 2 ? 0xffffff : 0xff3b30, 11); }
  { // 鋪面的耗損：觸地區的橡膠擦痕（主輪與鼻輪軌跡上的深色條紋，越往跑道中段越稀越細；比跑道面高 6 mm，標線 20 mm 蓋在上面）、柏油補過的裂縫（tar snake）；跑道兩側的混凝土排水溝與溝蓋
    const rr = rng(20261104);
    for (const [xa, d, n, len] of [[R.x0 + 70, 1, 700, 520], [R.x1 - 70, -1, 260, 360]]) {   // 西端是主要的著陸區（往東落地），東端淡一點
      for (let i = 0; i < n; i++) {
        const t = Math.pow(rr(), 1.7), l = 10 + rr() * 50, x = xa + d * (t * len + l / 2), q = rr();
        const zc = q < .14 ? (rr() - .5) * .8 : (q < .57 ? -1 : 1) * (3.5 + (rr() - .5) * 2.4);   // 鼻輪在中線、主輪在兩側 3.5 m
        const dk = rr() < .5; k.box(x, dk ? .108 : .106, R.z + zc, l, .006, .15 + rr() * .55 * (1 - t * .6), dk ? 0x1f2022 : 0x252629, 20, 0, (rr() - .5) * .012);   // 兩種深淺各一層高度，疊在一起不打架
      }
    }
    const snake = (x, z, y, z0, z1, n) => {   // 一條裂縫：往橫向（偶爾縱向）蜿蜒的折線
      let a = rr() < .7 ? Math.PI / 2 : 0;
      for (let i = 0; i < n; i++) {
        a += (rr() - .5) * .9; const l = 1 + rr() * 1.8, nx = x + Math.cos(a) * l, nz = Math.min(z1, Math.max(z0, z + Math.sin(a) * l));
        k.box((x + nx) / 2, y, (z + nz) / 2, Math.hypot(nx - x, nz - z) + .04, .006, .045 + rr() * .035, 0x1a1b1d, 20, 0, -Math.atan2(nz - z, nx - x)); x = nx; z = nz;
      }
    };
    for (let i = 0; i < 70; i++) snake(R.x0 + rr() * (R.x1 - R.x0), R.z + (rr() - .5) * 2 * (R.hw - 2), .111, R.z - R.hw + .5, R.z + R.hw - .5, 6 + (rr() * 10 | 0));
    for (let i = 0; i < 45; i++) snake(W.x0 + rr() * (W.x1 - W.x0), W.z + (rr() - .5) * 2 * (W.hw - 1), .083, W.z - W.hw + .3, W.z + W.hw - .3, 4 + (rr() * 8 | 0));
    for (const s of [-1, 1]) {
      const zc = R.z + s * (R.hw + 3.2);
      B(R.x0, R.x1, zc - .55, zc + .55, -.2, .05, 0x77746d);
      for (let x = R.x0 + 12; x < R.x1; x += 30) { k.box(x, .055, zc, 1.0, .012, .7, 0x2c2d30, 15); for (let g = -3; g <= 3; g++) k.box(x + g * .13, .062, zc, .04, .004, .62, 0x46484c, 15); }
    }
  }
  // 擋牆：島邊 0.9 m 的混凝土矮牆（堤道接口、梯子前留開口）
  const pc = 0xa7a49a, wall = (x0, x1, z0, z1, swim) => { B(x0, x1, z0, z1, 0, .9, pc); colliders.push({ x0, x1, z0, z1, low: 1, zn: AIR_F, ...(swim ? { swim: 1 } : {}) }); };
  wall(I.x0, J.x0, I.z0, I.z0 + .5); wall(J.x1, I.x1, I.z0, I.z0 + .5); wall(I.x0, I.x0 + .5, I.z0, I.z1);
  wall(J.x0, J.x1, J.z0, J.z0 + .5); wall(J.x0, J.x0 + .5, J.z0, I.z0 + .5); wall(J.x1 - .5, J.x1, J.z0, I.z0 + .5);
  if (NBR) { const q = NBR.road.p.reduce((a, b) => Math.abs(b[1] - I.z1) < Math.abs(a[1] - I.z1) ? b : a), g = NBR.road.hw + 3; wall(I.x0, q[0] - g, I.z1 - .5, I.z1); wall(q[0] + g, I.x1, I.z1 - .5, I.z1); } else wall(I.x0, I.x1, I.z1 - .5, I.z1);   // 南緣：紐柏林的進場路（09-nbr.js）從這裡上引道坡，留一個口
  const lz = L.ladder.z;
  wall(I.x1 - .5, I.x1, I.z0, L.cause.z0); wall(I.x1 - .5, I.x1, L.cause.z1, lz - 1.1); wall(I.x1 - .5, I.x1, lz + 1.1, I.z1);
  colliders.push({ x0: I.x1 - .5, x1: I.x1, z0: lz - 1.1, z1: lz + 1.1, low: 1, swim: 1, zn: AIR_F });   // 梯子前的缺口：游泳的人可以過
  { const [X, Z] = airW(I.x1, lz), [nx, nz] = dirW(AIR_ZN, 1, 0); LADDERS.push({ x: X, z: Z, nx, nz, w: 1, ok: 1 }); }
  // 機場圍籬（空側與陸側的分界，SEA_FR）：T2 機坪南緣 z −116（T2 航廈兩端接牆）、連絡滑行道 K1 東側 x −2283、T1 機坪北緣 z 197（接 T1 航廈兩端）。
  // 2.4 m 的鍍鋅鐵絲網：網面是一片薄板，菱形網目在著色器裡畫（m-uber.mjs 的材質 18，比像素細時淡掉，遠處只剩柱子與橫管）；3 m 一支柱、頂上往陸側斜 45° 的刺絲帶（也是網面材質）。
  // T1 航廈東邊留一個車輛出入口（崗亭、抬起的柵欄臂），開車可以從航廈前的廣場進機坪
  const FH = 2.4, gal = 0x8e9296, fence = (ax, az, bx, bz, out) => {   // out：刺絲帶斜向的那一側（+1 是線段方向的左手邊 (−uz, ux)）
    const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len, nx = -uz * out, nz = ux * out, ry = -Math.atan2(uz, ux), mx = (ax + bx) / 2, mz = (az + bz) / 2, n = Math.max(1, Math.round(len / 3));
    for (let i = 0; i <= n; i++) { const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n; k.rod(x, 0, z, x, FH + .04, z, .035, 6, gal, 15).rod(x, FH, z, x + nx * .4, FH + .4, z + nz * .4, .02, 4, gal, 15); }
    k.rod(ax, FH, az, bx, FH, bz, .024, 6, gal, 15).rod(ax, .12, az, bx, .12, bz, .012, 4, gal, 15);
    k.box(mx, FH / 2 + .07, mz, len, FH - .1, .01, 0x9a9ea2, 18, 0, ry);
    k.box(mx + nx * .19, FH + .2, mz + nz * .19, len, .5, .01, 0x8a8e92, 18, out * Math.PI / 4, ry);
    colliders.push({ x0: Math.min(ax, bx) - .06, x1: Math.max(ax, bx) + .06, z0: Math.min(az, bz) - .06, z1: Math.max(az, bz) + .06, zn: AIR_F });
    for (let d = 60; d < len - 20; d += 150) {   // 空側那一面每 150 m 一支監視器桿（6 m，橫臂上兩支攝影機朝圍籬兩個方向）
      const px = ax + ux * d - nx * 1.6, pz = az + uz * d - nz * 1.6;
      k.rod(px, 0, pz, px, 6.2, pz, .07, 8, gal, 15, .05).rod(px, 5.9, pz, px + nx * .7, 5.9, pz + nz * .7, .03, 6, gal, 15);
      for (const sg of [-1, 1]) k.box(px + nx * .6 + ux * sg * .2, 5.72, pz + nz * .6 + uz * sg * .2, .42, .2, .2, 0xdedcd6, 2, 0, ry).box(px + nx * .6 + ux * sg * .42, 5.72, pz + nz * .6 + uz * sg * .42, .04, .14, .14, 0x101114, 1, 0, ry);
      k.box(px - nx * .12, 1.4, pz - nz * .12, .3, .45, .18, 0x8e9296, 15, 0, ry);
      const [X, Z] = airW(px, pz); circles.push({ x: X, z: Z, r: .12, w: 1 });
    }
  };
  { const t = L.t2, T0 = L.term, xw = -2283, zt = -116, zn = 197, Tw = T0.x - 78.5, Te = T0.x + 78.8, gx0 = -1736, gx1 = -1722;
    fence(xw, zt, t.x - t.hx, zt, 1); fence(t.x + t.hx, zt, J.x1 - .5, zt, 1);        // T2：南邊是陸側
    fence(xw, zt, xw, zn, -1);                                                            // K1 東側：東邊是陸側
    const fs = L.fac.fire; if (document.getElementById('glb-airfac')) { fence(xw, zn, fs.x - 24, zn, -1); fence(fs.x + 36, zn, Tw, zn, -1); } else fence(xw, zn, Tw, zn, -1);   // 消防站的正面（車庫門）就是圍籬線
    fence(Tw, zn, Tw, T0.z + 45.3, -1);                                                   // T1 航廈西邊，接到航廈南牆
    fence(Te, T0.z + 45.3, Te, zn, -1); fence(Te, zn, gx0, zn, -1); fence(gx1, zn, I.x1 - .5, zn, -1);   // T1 航廈東邊、出入口、到島的東緣
    for (const x of [gx0, gx1]) k.box(x, 1.4, zn, .3, 2.8, .3, 0x5a5e62, 15);              // 出入口的門柱
    k.box(gx1 + .6, .55, zn - .7, .3, 1.1, .3, 0xd9b23a, 21).box(gx1 + .6, 1.15, zn - .7, .4, .2, .4, 0x2a2b2e, 21);   // 柵欄機的機箱
    for (let i = 0; i < 6; i++) k.box(gx1 + .6, 1.6 + i * .9, zn - .7, .1, .9, .1, i & 1 ? 0xc2261c : 0xeeeeea, 21);   // 抬起的柵欄臂（紅白相間）
    k.box(gx1 + 3.4, 1.3, zn - 3.2, 3, 2.6, 2.4, 0xc9c6bf, 34).box(gx1 + 3.4, 2.7, zn - 3.2, 3.4, .2, 2.8, 0x55585c, 15).box(gx1 + 1.89, 1.6, zn - 3.2, .02, 1, 1.8, 0x1b2a2c, 1);   // 崗亭（窗朝出入口）
    colliders.push({ x0: gx1 + 1.9, x1: gx1 + 4.9, z0: zn - 4.4, z1: zn - 2, zn: AIR_F }); circles.push(...[gx0, gx1].map(x => { const [X, Z] = airW(x, zn); return { x: X, z: Z, r: .25, w: 1 }; }));
    const [X, Z] = airW(gx1 + 3.4, zn - 4.6); signLights.push({ x: X, y: 3, z: Z, col: lin(0xfff0da), r: 14, i: 2, w: 1 });
  }
  // 機坪的高桿燈（南緣，夜裡照亮停機位）
  // 燈在 26 m 高：照度隨距離平方衰減（00-core.js 的 pointLights），強度要比 4 m 高的路燈大幾十倍，地上的光圈才有 40 m 左右
  // 桿：12 角的錐形鋼管、基座板與螺栓、離地 1 m 的檢修門（高桿燈與南緣的投光燈共用）
  const hmPole = (x, z, H) => {
    k.cyl(x, H / 2, z, .22, .42, H, 12, 0x6a6e72, 15).cyl(x, .2, z, .78, .78, .4, 12, 0x8a8a86, 2).cyl(x, .43, z, .62, .62, .06, 12, 0x55585c, 15);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; k.cyl(x + Math.cos(a) * .52, .5, z + Math.sin(a) * .52, .035, .035, .1, 6, 0x9a9ea2, 15); }
    k.box(x, 1.4, z + .41, .32, .9, .04, 0x5a5e62, 15);
  };
  for (let x = A.x0 + 40; x < A.x1; x += 100) {   // 機坪南緣：直線的桁架燈架，六具投光燈朝北（機坪）
    const H = 28, z = A.z1 + 4; hmPole(x, z, H);
    k.cyl(x, H + .25, z, .3, .3, .5, 12, 0x3c3f43, 15);
    for (const y of [H - .25, H + .35]) k.rod(x - 3.1, y, z - .45, x + 3.1, y, z - .45, .05, 6, 0x6a6e72, 15).rod(x - 3.1, y, z + .1, x + 3.1, y, z + .1, .05, 6, 0x6a6e72, 15);
    for (let i = 0; i <= 6; i++) { const xx = x - 3.1 + i * 6.2 / 6; k.rod(xx, H - .25, z - .45, xx, H + .35, z - .45, .03, 5, 0x6a6e72, 15).rod(xx, H - .25, z + .1, xx, H + .35, z + .1, .03, 5, 0x6a6e72, 15); }
    for (let i = 0; i < 6; i++) { const xx = x - 2.6 + i * 1.04;
      k.box(xx, H - .7, z - .55, .78, .5, .62, 0x2a2c30, 15, .55).box(xx, H - .96, z - .7, .68, .04, .5, 0xfff1d6, 11, .55); }
    const [X, Z] = airW(x, A.z1 - 2); signLights.push({ x: X, y: 26, z: Z, col: lin(0xffe2b8), r: 90, i: 45, w: 1 }); const [cx, cz] = airW(x, A.z1 + 4); circles.push({ x: cx, z: cz, r: .6, w: 1 });
  }
  // 登機門之間（翼尖淨空線上、地勤車道外側）的高桿燈：錐形的鋼管、頂上細管燈環與 8 具朝下的投光燈
  const mast = (x, z) => {
    const H = 28; hmPole(x, z, H);
    // 燈架：細管的燈環（不是實心圓盤）、四支輻臂、頂上的升降機構罩；八具投光燈掛在燈環外側、往外往下斜
    const R = 1.45, ring = i => [x + Math.cos(i / 16 * Math.PI * 2) * R, z + Math.sin(i / 16 * Math.PI * 2) * R];
    for (let i = 0; i < 16; i++) { const [ax, az] = ring(i), [bx, bz] = ring(i + 1); k.rod(ax, H - .05, az, bx, H - .05, bz, .05, 6, 0x5c6064, 15); }
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 8; k.rod(x + Math.cos(a) * .25, H + .1, z + Math.sin(a) * .25, x + Math.cos(a) * R, H - .05, z + Math.sin(a) * R, .045, 6, 0x5c6064, 15); }
    k.cyl(x, H + .25, z, .32, .38, .6, 12, 0x3c3f43, 15).cyl(x, H + .62, z, .12, .3, .16, 12, 0x3c3f43, 15);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, cx = x + Math.cos(a) * (R + .3), cz = z + Math.sin(a) * (R + .3);
      k.rod(x + Math.cos(a) * R, H - .05, z + Math.sin(a) * R, cx, H - .3, cz, .03, 5, 0x5c6064, 15);
      k.box(cx, H - .42, cz, .62, .4, .5, 0x2a2c30, 15, 0, -a, .5).box(cx + Math.cos(a) * .08, H - .63, cz + Math.sin(a) * .08, .54, .04, .42, 0xfff4e0, 11, 0, -a, .5); }
    k.box(x, H + 2.2, z, .05, 3.2, .05, 0x55585c, 15).box(x, H + 3.85, z, .16, .16, .16, 0xff3020, 9);   // 避雷針與航空障礙燈
    const [X, Z] = airW(x, z); signLights.push({ x: X, y: H - 1.5, z: Z, col: lin(0xfff0da), r: 95, i: 60, w: 1, dir: [0, -1, 0], cos: -3 }); circles.push({ x: X, z: Z, r: .5, w: 1 });   // cos −3：lib.mjs 的蝙蝠翼配光
    mastCones.push({ x: X, z: Z, sx: 8.6, sz: 8.6, sy: (H - .6) / 7, zn: null });
  };
  const mastCones = [];   // 燈下的光錐（20-props.js 的 coneMat：加法混合、只在夜裡、雨天更明顯），同一個 7 m 高的開口圓錐拉到燈頭高
  for (const [x, z] of [...[...L.gates.map(g => g.x + 4.5 - 29), L.gates[2].x + 4.5 + 29].map(x => [x, 284]), ...[L.gates2[0].x - 4.5 - 29, ...L.gates2.map(g => g.x - 4.5 + 29)].map(x => [x, L.lane2.z + 16])]) mast(x, z);   // T2：滑行通道南側
  for (const x of [-3108, -3010, -2910, -2782]) mast(x, 244);                                // 貨機坪北緣（貨運站的雨遮外）
  { const cg = new T.CylinderGeometry(.22, 3.1, 7, 24, 1, true); cg.translate(0, 3.5, 0); const cm = coneMat(0xfff2dc); cm.uniforms.uColor.value.multiplyScalar(3.5); instanced(cg, cm, mastCones, LY.NOREFL); }   // 高桿燈比路燈亮得多：顏色乘上去（加法混合，可以超過 1）
  for (let x = L.gates[0].x - 40; x <= L.gates[2].x + 40; x += 58) {   // 航廈南面（登機門那一側）屋簷下的泛光燈：照空橋與停在門口的客機（簷口在 z 196、底面 15.3 m，airbld.py）
    const [X, Z] = airW(x, L.term.z + 50.5); signLights.push({ x: X, y: 14.6, z: Z, col: lin(0xfff0dc), r: 70, i: 22, w: 1 });
  }
  for (let x = L.gates2[0].x - 40; x <= L.gates2[3].x + 40; x += 60) {   // T2 北面懸挑下的泛光燈（簷口 z −128、底面約 20 m，airbld.py 的 term2）
    const [X, Z] = airW(x, L.t2.z - L.t2.hz - 6); signLights.push({ x: X, y: 18.5, z: Z, col: lin(0xfff0dc), r: 70, i: 24, w: 1 });
  }
  { const [X, Z] = airW(L.plaza.x0 + 40, (L.plaza.z0 + L.plaza.z1) / 2); signLights.push({ x: X, y: 9, z: Z, col: lin(0xffd6a0), r: 55, i: 6, w: 1 }); }
  const pole = (x, z, h = 10) => {   // 航廈前路與停車場的路燈
    k.box(x, h / 2, z, .3, h, .3, 0x4d5055, 15); k.box(x, h - .1, z, .9, .14, .9, 0xffe8c4, 11);
    const [X, Z] = airW(x, z); signLights.push({ x: X, y: h - .4, z: Z, col: lin(0xffdcae), r: 34, i: 5, w: 1 }); circles.push({ x: X, z: Z, r: .3, w: 1 });
  };
  for (let x = L.land.x0 + 30; x < L.land.x1 - 10; x += 70) pole(x, L.land.z1 + 1.5);
  for (let x = L.park.x0 + 50; x < L.park.x1; x += 100) for (const z of [L.park.z0 + 20, L.park.z1 - 20]) pole(x, z, 12);   // 停車格之間的走道上
  for (let x = L.park2.x0 + 45; x < L.park2.x1; x += 100) pole(x, (L.park2.z0 + L.park2.z1) / 2, 12);   // T2 停車場、往 T1 的連絡路
  for (let z = L.conn2.z0 + 30; z < L.conn2.z1; z += 50) pole(L.conn2.x1 + 1.5, z);
  // 堤道：路面（雙向四線）、標線、兩側的紐澤西護欄與往海裡斜下去的消波石、路燈。外緣裡面那一段只鋪路面
  const RD = AIR.road, hw = AIR.hw;
  for (let i = 1; i < RD.length; i++) {
    const [ax, az] = RD[i - 1], [bx, bz] = RD[i], len = Math.hypot(bx - ax, bz - az), ry = -Math.atan2(bz - az, bx - ax), cx = (ax + bx) / 2, cz = (az + bz) / 2;
    const [WX, WZ] = airW(cx, cz), out = !inCity(WX, WZ) && !(cx <= I.x1);
    if (cx <= I.x1 - 2) continue;
    const seg = (y, w, h, off, col, mat = 2) => k.box(cx + Math.sin(ry) * off, y, cz + Math.cos(ry) * off, len + .4, h, w, col, mat, 0, ry);
    seg(-.12, hw * 2, .36, 0, asph);
    if ((i & 1) === 0) seg(.071, .25, .02, 0, white);                                       // 中線虛線（8 m 一段，隔一段畫一段）
    for (const s of [-1, 1]) { seg(.07, .2, .02, s * (hw - 1.6), white); seg(.071, .12, .02, s * .35, yel); }
    if (!out) continue;
    for (const s of [-1, 1]) {
      seg(.45, .6, .8, s * (hw - .3), 0xb4b1a8);
      k.box(cx + Math.sin(ry) * s * (hw + 4.5), -2.6, cz + Math.cos(ry) * s * (hw + 4.5), len + .6, 1.4, 10, rk, 2, s * .5, ry);
      const [ex, ez] = airW(bx, bz), [sx, sz] = airW(ax, az);
      const f = frameW(sx, sz, ex - sx, ez - sz);
      colliders.push(s < 0 ? { x0: -.2, x1: len + .2, z0: -hw - .3, z1: -hw + .5, low: 1, zn: f } : { x0: -.2, x1: len + .2, z0: hw - .5, z1: hw + .3, low: 1, zn: f });
    }
    k.box(cx, -5, cz, len + .4, 9.6, hw * 2 + 2, rk, 2, 0, ry);                                // 路堤
    if (i % 6 === 3) {
      const s = i % 12 === 3 ? 1 : -1, px = cx + Math.sin(ry) * s * (hw + .2), pz = cz + Math.cos(ry) * s * (hw + .2);
      k.box(px, 5, pz, .3, 10, .3, 0x4d5055, 15); k.box(px - Math.sin(ry) * s * 1.4, 9.9, pz - Math.cos(ry) * s * 1.4, .35, .2, 2.8, 0x4d5055, 15, 0, ry + Math.PI / 2);
      k.box(px - Math.sin(ry) * s * 2.6, 9.75, pz - Math.cos(ry) * s * 2.6, .6, .12, .9, 0xffe8c4, 11, 0, ry);
      const [X, Z] = airW(px - Math.sin(ry) * s * 2.6, pz - Math.cos(ry) * s * 2.6); signLights.push({ x: X, y: 9.4, z: Z, col: lin(0xffdcae), r: 30, i: 5, w: 1 });
    }
  }
  cityAdd(new T.Mesh(k.build(), MAT.far), AIR_ZN);
}

// ─── 建築與客機：模型（http(s)）或程式建模的替身 ───
// 替身：客機是機身圓筒＋後掠翼＋尾翼＋兩具發動機；航廈是一道弧形屋頂的長廳；塔台是一根柱子頂一個六角的塔頂；機庫是半圓筒
function airPlaneKit(len = 38) {
  const k = new Kit(), wht = 0xeceeef, gry = 0x9aa0a6, s = len / 38;
  k.cyl(0, 3.3 * s, 0, 1.95 * s, 1.95 * s, len * .78, 16, wht, 10, Math.PI / 2);
  k.cyl(0, 3.3 * s, len * .43, .5 * s, 1.95 * s, len * .08, 16, wht, 10, Math.PI / 2);   // 機頭（圓筒的頂端轉到 +z）
  k.cyl(0, 3.6 * s, -len * .45, .4 * s, 1.95 * s, len * .12, 16, wht, 10, -Math.PI / 2);
  for (const sd of [-1, 1]) {
    k.box(sd * 9 * s, 2.4 * s, -1 * s, 16 * s, .35 * s, 4.2 * s, wht, 10, 0, sd * .42);
    k.cyl(sd * 5.7 * s, 1.5 * s, 2.5 * s, 1.05 * s, 1.05 * s, 4 * s, 12, gry, 15, Math.PI / 2);
    k.box(sd * 3.4 * s, 4.6 * s, -16.5 * s, 6 * s, .25 * s, 2.4 * s, wht, 10, 0, sd * .5);
  }
  k.box(0, 7.6 * s, -16.8 * s, .35 * s, 6.5 * s, 4 * s, wht, 10, -.35);
  k.box(0, 3.8 * s, len * .4, 3 * s, .5 * s, 1.2 * s, 0x15181c, 1);                             // 駕駛艙窗
  return k;
}
// 航行燈：左翼尖紅、右翼尖綠（機頭朝 +z 時右邊是 −x）、尾燈白、機背的紅色閃光燈
function airLightsKit(span) {
  const k = new Kit(), h = span / 2;
  k.box(h - .3, 3.2, -6, .4, .3, .5, 0xff2a2a, 11).box(-h + .3, 3.2, -6, .4, .3, .5, 0x2aff6a, 11).box(0, 5.4, -19.5, .3, .3, .3, 0xffffff, 11);
  k.box(0, 5.55, -2, .5, .3, .5, 0xff2020, 9).box(0, .6, 3, .5, .25, .5, 0xff2020, 9);
  return k;
}
const AIR_M = { items: null, req: false, proxies: [], jet: [] };
if (AIR_L) {
  const L = AIR_L, add = (o, x, z) => { o.position.set(x, o.position.y, z); cityAdd(o, AIR_ZN); AIR_M.proxies.push(o); return o; };
  // 航廈、空橋、塔台、機庫是 Blender 模型（blender/airbld.py），擺放、碰撞與沒有模型時的替身在 52-air-bld.js
  const pk = airPlaneKit().build();
  for (const p of [...L.gates.map(g => ({ x: g.x + 4.5, z: 238.8, ry: Math.PI, plane: g.plane })), ...L.stands, ...L.gates2.map(g => ({ x: g.x - 4.5, z: L.t2.pz, ry: 0 })), ...L.stands2]) { const m = new T.Mesh(pk, MAT.far); m.rotation.y = p.ry; add(m, p.x, p.z); }
  // 碰撞：停著的客機機身（航廈、塔台、機庫在 52-air-bld.js）
  const box = (x0, x1, z0, z1) => colliders.push({ x0, x1, z0, z1, zn: AIR_F });
  for (const g of L.gates) box(g.x + 2.5, g.x + 6.5, 220, 257.6);
  for (const s of L.stands) box(s.x - 2, s.x + 2, s.z - 18.8, s.z + 18.8);
  for (const g of L.gates2) box(g.x - 6.5, g.x - 2.5, L.t2.pz - 18.8, L.t2.pz + 18.8);   // T2：空橋與客機整組轉 180°（機頭朝南，空橋在機身東側）
  for (const s of L.stands2) box(s.x - 2, s.x + 2, s.z - 18.8, s.z + 18.8);
}
// ─── 客機塗裝（灰鷺航空，虛構的本地航空公司）：材質 'plane'（src/tsl/m-plane.mjs）照模型座標塗，原模型的白漆才塗 ───
// tLiv：上半是機名（R）、左下是尾翼的鷺（G）、右下是註冊號（B）。AIR_LIV 是兩個機型量出來的機身軸高、半徑、機頭／機尾 z、尾翼範圍與發動機位置
const AIR_LIV = {
  a320: { liv: [3.37, 1.98, 18.8, -18.8], liv2: [-18.07, -11.68, 11.22, 1.2], liv3: [5.75, 2.2, 7.5, 1.15], reg: 'B-HRA21' },
  b737: { liv: [3.5, 1.86, 19.75, -19.75], liv2: [-19.34, -11.73, 12.37, 1.7], liv3: [4.95, 1.4, 6.9, 1.25], reg: 'B-HRB37' },
};
let airLivTex = null;
function airLiveryTex() {
  if (airLivTex) return airLivTex;
  const W = 2048, H = 1024, mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return [c, c.getContext('2d')]; };
  const [cT, gT] = mk(), [cL, gL] = mk(), [cR, gR] = mk();
  gT.fillStyle = '#fff'; gT.textBaseline = 'middle';
  gT.font = '700 300px "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif'; gT.fillText('灰鷺航空', 30, 250);
  const tw = gT.measureText('灰鷺航空').width; gT.font = '600 100px "Helvetica Neue",Arial,sans-serif'; gT.fillText('GREY HERON', Math.min(tw + 70, W - 40 - gT.measureText('GREY HERON').width), 300);
  // 鷺：細長的身體往前（左）伸頸、尖喙，翅膀一道往後掠的弧；放在 1024×512 的格子裡（左＝機頭）
  gL.fillStyle = '#fff'; gL.translate(0, 512);
  gL.beginPath(); gL.moveTo(90, 210); gL.lineTo(250, 228); gL.quadraticCurveTo(330, 236, 360, 200); gL.quadraticCurveTo(400, 120, 470, 112); gL.quadraticCurveTo(560, 104, 620, 170);
  gL.quadraticCurveTo(760, 300, 940, 330); gL.quadraticCurveTo(760, 350, 600, 300); gL.quadraticCurveTo(520, 270, 470, 270); gL.quadraticCurveTo(420, 270, 400, 300); gL.quadraticCurveTo(380, 380, 330, 430);
  gL.lineTo(300, 420); gL.quadraticCurveTo(350, 330, 340, 270); gL.quadraticCurveTo(320, 248, 250, 240); gL.closePath(); gL.fill();
  gL.beginPath(); gL.moveTo(560, 150); gL.quadraticCurveTo(700, 90, 930, 120); gL.quadraticCurveTo(760, 150, 640, 205); gL.closePath(); gL.fill();
  gR.fillStyle = '#fff'; gR.textBaseline = 'middle'; gR.font = '700 190px "Helvetica Neue",Arial,sans-serif';
  const out = new Uint8Array(W * H * 4), dT = gT.getImageData(0, 0, W, H).data, dL = gL.getImageData(0, 0, W, H).data;
  const regs = Object.values(AIR_LIV).map(v => v.reg);   // 右下一格只放得下一組字：兩個機型共用一個前綴，機號用同一組（看不出來）
  gR.fillText(regs[0], 1060, 512 + 256, 960); const dR = gR.getImageData(0, 0, W, H).data;
  for (let i = 0; i < W * H; i++) { out[i * 4] = dT[i * 4 + 3]; out[i * 4 + 1] = dL[i * 4 + 3]; out[i * 4 + 2] = dR[i * 4 + 3]; out[i * 4 + 3] = 255; }
  const t = new T.DataTexture(out, W, H, T.RGBAFormat, T.UnsignedByteType);
  t.wrapS = t.wrapT = T.ClampToEdgeWrapping; t.minFilter = T.LinearMipmapLinearFilter; t.magFilter = T.LinearFilter; t.generateMipmaps = true; t.anisotropy = 8; t.needsUpdate = true;
  return airLivTex = t;
}
// 兩個機型各一個材質（uniform 與原材質共用同一批物件，時間、天氣照樣跟著動）；換掉 items 裡客機的 mat，回傳要預熱的 parts
function airLivery(items) {
  const out = [];
  for (const [id, v] of Object.entries(AIR_LIV)) {
    const it = items[id]; if (!it) continue;
    const mats = new Map();
    for (const p of it.parts) {
      let m = mats.get(p.mat);
      if (!m) { const s = p.mat; m = new T.ShaderMaterial({ name: 'plane', uniforms: { ...s.uniforms, tLiv: { value: airLiveryTex() }, uLiv: { value: new T.Vector4(...v.liv) }, uLiv2: { value: new T.Vector4(...v.liv2) }, uLiv3: { value: new T.Vector4(...v.liv3) } }, defines: { ...s.defines, DOUBLE: '' }, side: T.DoubleSide }); mats.set(p.mat, m); }
      p.mat = m; out.push(p);
    }
  }
  return out;
}
// 模型下載好：換掉替身、擺上停著的客機（每架共用同一份幾何；空廚車改用 airgse.glb 的 gse_cater，52-air-gse.js 擺）
function airModels(items) {
  // 停著的客機也畫進機場高度圖（日光陰影）：掛進城市前先記下每個網格的 SEA_FR 矩陣，光柵化分幀做（一架約 14 ms）
  const L = AIR_L, hm = [], put = (id, x, z, ry, y = 0) => { const o = propObject(items[id], x, y, z, ry); o.updateMatrixWorld(true); o.traverse(m => { if (m.isMesh) hm.push([m.geometry, m.matrixWorld.elements.slice()]); }); cityAdd(o, AIR_ZN); return o; };
  for (const g of L.gates) {
    put(g.plane, g.x + 4.5, 238.8, Math.PI);   // 機身左側貼著空橋機艙，左前門對著機艙（機頭在 z 220）
  }
  for (const s of L.stands) put(s.plane, s.x, s.z, s.ry);
  for (const g of L.gates2) put(g.plane, g.x - 4.5, L.t2.pz, 0);   // T2：機頭朝南（z −150.5）對著 T2 北面，空橋機艙對著機身左前門（東側）
  for (const s of L.stands2) put(s.plane, s.x, s.z, s.ry);
  put('a320', L.hangar.x, L.hangar.z - 4, 0);   // 機庫裡維修中的一架（機頭朝門；工作台與塔架在 blender/airbld.py 的 hangar()，碰撞在 52-air-bld.js）
  warmJob(async () => { const c = warmClock(); for (const [g, e] of hm) { ahmGeo(g, e); await c.tick(); } ahmFlush(); AHM.h = AHM.m = null; });   // 最後一批：光柵化的暫存放掉
  for (const o of AIR_M.proxies) o.removeFromParent();
  AIR_M.proxies.length = 0;
  for (const p of AIR_P.planes) if (items[p.id]) { p.body.clear(); p.body.add(propObject(items[p.id], 0, 0, 0, 0)); }
}

// ─── 起降循環：一架客機（A320 與 737 輪流）停在遠端機位 → 滑行 → 往西起飛 → 消失在外海 → 從西邊進場降落 → 滑回遠端機位 ───
// 路徑是 SEA_FR 座標的折線，轉角用半徑 r 的圓角（二次貝茲近似）切細，照弧長走
function airPath(pts, r = 24) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], [cx, cz] = pts[i + 1], l1 = Math.hypot(bx - ax, bz - az), l2 = Math.hypot(cx - bx, cz - bz);
    const t = Math.min(r, l1 / 2, l2 / 2), p1 = [bx - (bx - ax) / l1 * t, bz - (bz - az) / l1 * t], p2 = [bx + (cx - bx) / l2 * t, bz + (cz - bz) / l2 * t];
    for (let j = 0; j <= 8; j++) { const u = j / 8, a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u; out.push([a * p1[0] + b * bx + c * p2[0], a * p1[1] + b * bz + c * p2[1]]); }
  }
  out.push(pts[pts.length - 1]);
  const s = [0]; for (let i = 1; i < out.length; i++) s.push(s[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
  return { p: out, s, len: s[s.length - 1] };
}
function airAt(P, d) {   // 路徑上弧長 d 的點與方向（yaw：0 朝 +z）
  d = clamp(d, 0, P.len); let i = 1; while (i < P.s.length - 1 && P.s[i] < d) i++;
  const [ax, az] = P.p[i - 1], [bx, bz] = P.p[i], u = (d - P.s[i - 1]) / Math.max(1e-6, P.s[i] - P.s[i - 1]);
  return [ax + (bx - ax) * u, az + (bz - az) * u, Math.atan2(bx - ax, bz - az)];
}
// ─── 機坪的地勤車：每座登機門西側停一列（拖車＋兩台行李車，車頭朝航廈），另一列（拖車＋三台）沿著登機門後面與遠端機位之間的矩形繞圈。
// 模型是 air_gse 組（和 air 組一起在 AIR_NEAR 內下載），以檔案開啟用方塊替身；停著的是 SEA_FR 座標的固定碰撞盒，繞圈的是 dynMore 的圓 ───
const GSE_GAP = [4.05, 3.9];   // 拖車中心到第一台行李車、行李車之間（車長 3.3／3.0，間隔 0.9 m）
const AIR_GSE = { units: [], loop: [], d: 0, v: 4.5, dyn: [], hooked: false };
function gseKit(kind) {
  const k = new Kit();
  if (kind === 'gse_tug') k.box(0, .55, .35, 1.85, .7, 2.5, 0xe9e9e4, 10).box(0, .75, -1.15, 1.6, .35, .9, 0x24366e, 0).box(0, .32, 0, 1.9, .5, 3.2, 0x2a2c2e, 15);
  else k.box(0, 1.2, 0, 1.5, 1.6, 2.9, 0xd6d8d8, 10).box(0, .3, 0, 1.4, .25, 3, 0x2a2c2e, 15);
  return k;
}
function gseUnit(kind) {
  const g = new T.Group(), m = new T.Mesh(gseKit(kind).build(), MAT.uber); g.add(m);
  const u = { kind, g, fb: m }; AIR_GSE.units.push(u); return u;
}
// 一列車：拖車在 d，行李車依序在後面（offs 是沿著車頭方向往後的距離）
const gseOffs = n => [0, ...Array.from({ length: n }, (_, i) => GSE_GAP[0] + GSE_GAP[1] * i)];
if (AIR_L) {
  const L = AIR_L;
  for (const gt of L.gates) {   // 西側：上一座登機門客機的翼尖（x − 35.5）與這架的翼尖（x − 13.3）之間；車頭朝北（航廈）
    const x = gt.x - 23, z0 = 226, offs = gseOffs(2);
    offs.forEach((o, i) => { const u = gseUnit(i ? 'gse_cart' : 'gse_tug'); u.g.position.set(x, 0, z0 + o); u.g.rotation.y = Math.PI; cityAdd(u.g, AIR_ZN); });
    colliders.push({ x0: x - 1, x1: x + 1, z0: z0 - 1.7, z1: z0 + offs[2] + 1.6, zn: AIR_F });
  }
  // 繞圈：登機門客機機尾（z 258）後面往西到遠端機位客機的翼尖（x −2232）前，再往南繞回來（逆時針看下去是：西、南、東、北）
  AIR_GSE.path = airPath([[-1970, 272], [-2150, 272], [-2150, 335], [-1790, 335], [-1790, 272], [-1970, 272]], 9);   // 從北邊中段出發、回到同一點
  for (const [i] of gseOffs(3).entries()) { const u = gseUnit(i ? 'gse_cart' : 'gse_tug'); scene.add(u.g); AIR_GSE.loop.push(u); AIR_GSE.dyn.push({ x: 1e6, z: 1e6, r: 1.1 }); }
}
function gseModels(items) {
  for (const u of AIR_GSE.units) if (items[u.kind]) { u.fb.removeFromParent(); u.fb.geometry.dispose(); u.g.add(propObject(items[u.kind], 0, 0, 0, 0)); }
}
function gseUpdate(dt) {
  const G = AIR_GSE, P = G.path; if (!P) return;
  if (!G.hooked) { G.hooked = true; dynMore.push(...G.dyn); }
  const len = P.len;
  G.d = (G.d + G.v * dt) % len;
  const offs = gseOffs(3);
  G.loop.forEach((u, i) => {
    const d = ((G.d - offs[i]) % len + len) % len, [x, z, yaw] = airAt(P, d), [X, Z] = airW(x, z);
    u.g.position.set(X, 0, Z); u.g.rotation.y = yaw + AIR_YAW;
    G.dyn[i].x = X; G.dyn[i].z = Z;
  });
}
const AIR_P = { planes: [], cur: 0, st: 'park', t: 12, d: 0, v: 0, x: 0, y: 0, z: 0, yaw: Math.PI / 2, pitch: 0, roll: 0, n: 0, dyn: [] };
if (AIR_L) {
  const L = AIR_L, S = L.stand, R = L.rwy, W = L.twy;
  AIR_P.out = airPath([[S.x, S.z], [-1300, S.z], [-1300, W.z], [R.x1 - 50, W.z], [R.x1 - 50, R.z], [R.x1 - 95, R.z]], 22);
  const E = L.ret; AIR_P.inn = airPath([[E.x - 40, R.z], [E.x, R.z], [E.x + (R.z - W.z) / Math.tan(E.a), W.z], [-1600, W.z], [-1600, S.z], [S.x, S.z]], 24);   // 從快速脫離滑行道出跑道
  for (const [id, len, span] of [['a320', 37.6, 35.5], ['b737', 39.5, 36]]) {
    const g = new T.Group(), body = new T.Group(); g.add(body); g.visible = false; scene.add(g);
    body.add(new T.Mesh(airPlaneKit(len).build(), MAT.far));
    g.add(new T.Mesh(airLightsKit(span).build(), MAT.far));
    AIR_P.planes.push({ id, g, body, len });
  }
  [AIR_P.x, AIR_P.z] = [S.x, S.z];
  for (let i = 0; i < 4; i++) AIR_P.dyn.push({ x: 1e6, z: 1e6, r: i < 3 ? 2.6 : 1.6 });   // 30-vehicles.js 的 dynMore 還沒宣告：第一次 airUpdate 才放進去
}
const AIR_GLIDE = Math.tan(3 * Math.PI / 180), AIR_FINAL = 4200;
function airUpdate(dt) {
  if (!AIR_L) return;
  const P = AIR_P, L = AIR_L, R = L.rwy;
  if (!P.hooked) { P.hooked = true; dynMore.push(...P.dyn); }
  // 走近才下載模型
  if (!AIR_M.req && GLB_ON) {
    const [cx, cz] = airW((L.I.x0 + L.I.x1) / 2, (L.I.z0 + L.I.z1) / 2);
    if (Math.hypot(pX() - cx, pZ() - cz) < AIR_NEAR) {
      AIR_M.req = true; loadProps('air').then(async items => { if (items) { await glbWarm(airLivery(items)); AIR_M.items = items; airModels(items); } });
      loadProps('air_gse').then(items => { if (items) gseModels(items); }).catch(e => console.warn('air_gse', e));
    }
  }
  gseUpdate(dt);
  airIntTick();
  P.t -= dt;
  const pl = P.planes[P.cur];
  if (P.st === 'park') { [P.x, P.z, P.yaw, P.y, P.pitch] = [L.stand.x, L.stand.z, Math.PI / 2, 0, 0]; if (P.t <= 0) { P.st = 'out'; P.d = 0; P.v = 0; } }
  else if (P.st === 'out' || P.st === 'in') {   // 滑行：起步加速、轉彎與快到終點時放慢
    const path = P.st === 'out' ? P.out : P.inn, left = path.len - P.d;
    P.v = damp(P.v, Math.min(9, Math.max(2, left * .25)), 1.2, dt); P.d += P.v * dt;
    const [x, z, yaw] = airAt(path, P.d), [, , yaw2] = airAt(path, P.d + 6);
    [P.x, P.z] = [x, z]; P.yaw = yaw; P.roll = 0; P.pitch = 0; P.y = 0;
    P.yawRate = ((yaw2 - yaw + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
    if (left < .3) { if (P.st === 'out') { P.st = 'line'; P.t = 6; } else { P.st = 'park'; P.t = 30; } }
  } else if (P.st === 'line') { if (P.t <= 0) { P.st = 'roll'; P.v = 0; } }
  else if (P.st === 'roll') {   // 往西加速，70 m/s 抬頭，爬升角慢慢加到 8°
    P.v = Math.min(88, P.v + (P.v < 75 ? 2.3 : 1.2) * dt); P.x -= P.v * dt; P.yaw = -Math.PI / 2;
    if (P.v > 70) { P.pitch = damp(P.pitch, .16, 1.5, dt); P.y += P.v * Math.sin(Math.min(P.pitch * .85, .14)) * dt; }
    if (P.x < R.x0 - 5600 || P.y > 650) { P.st = 'gone'; P.t = 15; }
  } else if (P.st === 'gone') {
    if (P.t <= 0) { pl.g.visible = false; P.cur = (P.cur + 1) % P.planes.length; P.st = 'final'; P.x = L.td - AIR_FINAL; P.z = R.z; P.y = AIR_FINAL * AIR_GLIDE; P.v = 72; P.yaw = Math.PI / 2; P.pitch = .05; }
  } else if (P.st === 'final') {   // 3° 下滑道，著陸前拉平
    P.x += P.v * dt; P.y = Math.max(0, (L.td - P.x) * AIR_GLIDE); P.pitch = damp(P.pitch, P.y < 12 ? .09 : .05, 2, dt);
    if (P.x >= L.td) { P.st = 'rollout'; P.y = 0; P.v0 = P.v; }
  } else if (P.st === 'rollout') {   // 減速到 12 m/s 正好到快速脫離滑行道的口
    const dec = (P.v0 * P.v0 - 144) / (2 * (L.ret.x - 40 - L.td));
    P.v = Math.max(12, P.v - dec * dt); P.x += P.v * dt; P.pitch = damp(P.pitch, 0, 1.5, dt);
    if (P.x >= L.ret.x - 40) { P.st = 'in'; P.d = 0; P.v = 12; }
  }
  if (P.st === 'roll' || P.st === 'final') P.roll = 0;
  // 擺到世界：機體跟著 yaw、pitch（機頭抬起是繞 x 負轉）
  const cur = P.planes[P.cur], vis = P.st !== 'gone';
  for (const p of P.planes) p.g.visible = p === cur && vis;
  const [X, Z] = airW(P.x, P.z), yaw = P.yaw + AIR_YAW;
  cur.g.position.set(X, P.y, Z); cur.g.rotation.set(-P.pitch, yaw, 0, 'YXZ');
  // 地面上的時候擋人和車：機身三個圓、機頭一個小圓
  const ground = P.y < 2 && cur.g.visible, fx = Math.sin(yaw), fz = Math.cos(yaw);
  P.dyn.forEach((c, i) => { const o = [-11, 0, 11, 17][i]; c.x = ground ? X + fx * o : 1e6; c.z = ground ? Z + fz * o : 1e6; });
}
const airApi = {
  get L() { return AIR_L; }, get P() { return AIR_P; }, get M() { return AIR_M; }, get int() { return AIR_IN; }, gse: AIR_GSE, AIR, land: (x, z) => airLandL(x, z), landW: (X, Z) => airLandW(X, Z),
  W: (x, z) => airW(x, z), L2: (X, Z) => toL(X, Z, AIR_ZN), district: (X, Z) => districtW(X, Z),
  tp: (x, z, yaw = 0) => { const [X, Z] = airW(x, z); window.__nc.tp(X, Z, yaw + AIR_YAW); },
  set: (st, t = 0) => { AIR_P.st = st; AIR_P.t = t; if (st === 'final') { AIR_P.x = AIR_L.td - AIR_FINAL; AIR_P.z = AIR_L.rwy.z; AIR_P.y = AIR_FINAL * AIR_GLIDE; AIR_P.v = 72; AIR_P.yaw = Math.PI / 2; } if (st === 'out' || st === 'in') { AIR_P.d = 0; AIR_P.v = 0; } },
};
